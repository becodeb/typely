/* Marco de las pantallas de gestión — tres columnas, alto fijo.
 *
 * La izquierda es CONTEXTO y no cambia al navegar: en qué escuela estás,
 * el alta de cuentas y los totales. El medio es trabajo. La derecha son
 * HERRAMIENTAS que se usan mientras mirás otra cosa —hoy, restablecer
 * contraseñas— y por eso no viven detrás de un menú.
 *
 * La de la derecha aparece recién en pantallas anchas (`xl`). Por debajo
 * de eso le comería a la lista de grupos el espacio donde muestra sus
 * métricas, y esa lista es la pantalla; la herramienta, no.
 *
 * **La pantalla no scrollea.** Ocupa exactamente el alto de la ventana y
 * lo que crece —la lista de grupos— scrollea adentro de su propia zona.
 * Así la columna izquierda y el encabezado están siempre a la vista: con
 * scroll de página, crear una cuenta obligaba a subir de nuevo.
 *
 * Lo que hace posible ese alto fijo es la cadena de `min-h-0`: sin ella un
 * hijo flex se niega a achicarse por debajo de su contenido y el scroll se
 * escapa a la página. Cada eslabón está marcado abajo.
 *
 * Por qué el alta vive en la columna y no detrás de un botón: crear
 * cuentas es la tarea que más se repite al arrancar un año, y esconderla
 * en un menú cuesta un click por alumno. Acá el rol es un control siempre
 * visible, así que dar de alta es escribir un nombre y apretar.
 *
 * El marco también resuelve el alcance:
 *   - un `admin` pertenece a UNA escuela y no elige;
 *   - el `superadmin` no pertenece a ninguna y las administra todas.
 *
 * Y es dueño de dos datos compartidos —los grupos y las credenciales
 * recién emitidas— porque los usan tanto la columna como la pantalla de
 * la derecha, y cargarlos dos veces los haría discrepar entre sí.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import type { Group, IssuedCredentials, Role, Sede } from "../../types";
import { api, ApiError } from "../../utils/api";
import { useAuth } from "../../hooks/useAuth";
import { assets } from "../../utils/assets";
import { CredentialsPanel } from "./Credentials";
import { Button, Card, ErrorBanner, Field, Input, Spinner } from "./ui";

interface ManageContextValue {
  sedeId: string;
  sedeName: string;
  /** Todas las escuelas alcanzables. Para el admin es una sola. */
  sedes: Sede[];
  /** Solo el superadmin puede cambiar de escuela. */
  canSwitch: boolean;
  /** Relee las escuelas: la usa la pantalla de Escuelas tras crear o editar. */
  reloadSedes: () => void;
  /** `null` mientras carga. Lo comparten la columna y la lista. */
  groups: Group[] | null;
  groupsError: string;
  reloadGroups: () => void;
  /** Muestra el panel de credenciales recién emitidas. */
  showCredentials: (title: string, list: IssuedCredentials[]) => void;
}

const ManageContext = createContext<ManageContextValue | null>(null);

export function useSede(): ManageContextValue {
  const ctx = useContext(ManageContext);
  if (!ctx) throw new Error("useSede tiene que usarse dentro de ManageShell");
  return ctx;
}

const NAV_ALL = [
  { to: "/gestion/grupos", label: "Grupos", superadminOnly: false },
  { to: "/gestion/usuarios", label: "Personas", superadminOnly: false },
  { to: "/gestion/sedes", label: "Escuelas", superadminOnly: true },
];

/* Crepúsculo: el cielo del juego al anochecer. El violeta sale del arte
   real (`#7488fc` es su tono saturado), llevado a una profundidad donde el
   texto de 10.5px se lee — el tono tal cual da 3.15 de contraste contra
   blanco y las etiquetas no se leerían. */
const RAIL_BG = "linear-gradient(168deg, #33306f 0%, #262456 52%, #1a1840 100%)";
const RAIL_MUTED = "#a6a7d8";

export function ManageShell() {
  const { user, logout } = useAuth();
  const isSuperadmin = user?.role === "superadmin";
  const nav = NAV_ALL.filter((i) => !i.superadminOnly || isSuperadmin);

  const [sedes, setSedes] = useState<Sede[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadingSedes, setLoadingSedes] = useState(true);
  const [sedeError, setSedeError] = useState("");

  const [groups, setGroups] = useState<Group[] | null>(null);
  const [groupsError, setGroupsError] = useState("");
  const [teacherCount, setTeacherCount] = useState<number | null>(null);
  const [credentials, setCredentials] = useState<{ title: string; list: IssuedCredentials[] } | null>(null);

  const loadSedes = useCallback(async () => {
    setLoadingSedes(true);
    setSedeError("");
    try {
      if (isSuperadmin) {
        const all = await api.sedes();
        setSedes(all);
        setSelected((prev) => (prev && all.some((s) => s.id === prev) ? prev : (all[0]?.id ?? null)));
      } else {
        const mine = await api.mySede();
        setSedes([mine]);
        setSelected(mine.id);
      }
    } catch (err) {
      setSedeError(err instanceof ApiError ? err.message : "No pudimos cargar tus escuelas.");
    } finally {
      setLoadingSedes(false);
    }
  }, [isSuperadmin]);

  useEffect(() => {
    void loadSedes();
  }, [loadSedes]);

  const current = sedes.find((s) => s.id === selected) ?? null;
  const sedeId = current?.id ?? null;

  const loadGroups = useCallback(async () => {
    if (!sedeId) return;
    setGroupsError("");
    try {
      const [gs, teachers] = await Promise.all([
        api.groups(sedeId),
        api.users({ role: "docente", sedeId }),
      ]);
      setGroups(gs);
      setTeacherCount(teachers.length);
    } catch (err) {
      setGroups(null);
      setGroupsError(err instanceof ApiError ? err.message : "No pudimos cargar los grupos.");
    }
  }, [sedeId]);

  /* Al cambiar de escuela se vacía antes de pedir: si no, se ven un
     instante los grupos de la anterior bajo el nombre de la nueva. */
  useEffect(() => {
    setGroups(null);
    setTeacherCount(null);
    void loadGroups();
  }, [loadGroups]);

  const studentTotal = groups ? groups.reduce((a, g) => a + (g.studentCount ?? 0), 0) : null;

  const ctx = useMemo<ManageContextValue | null>(
    () =>
      current
        ? {
            sedeId: current.id,
            sedeName: current.name,
            sedes,
            canSwitch: isSuperadmin,
            reloadSedes: () => void loadSedes(),
            groups,
            groupsError,
            reloadGroups: () => void loadGroups(),
            showCredentials: (title, list) => setCredentials({ title, list }),
          }
        : null,
    [current, sedes, isSuperadmin, loadSedes, groups, groupsError, loadGroups],
  );

  return (
    /* `h-dvh` + `overflow-hidden`: la página nunca scrollea. */
    <div className="font-body flex h-dvh overflow-hidden bg-[#eef6fd] text-[#17355f]">

      {/* ================= Columna de contexto ================= */}
      <aside
        style={{ background: RAIL_BG }}
        className="relative hidden h-full w-[268px] shrink-0 flex-col overflow-hidden text-white md:flex"
      >
        {/* Halos del periwinkle del arte, para que no sea un bloque plano. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-32 h-[380px] w-[380px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(116,136,252,0.30), transparent 68%)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 bottom-20 h-[300px] w-[300px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(155,124,255,0.20), transparent 70%)" }}
        />

        {/* Red de seguridad: en una ventana muy baja el contenido fijo
            scrollea acá adentro en vez de recortarse. */}
        <div className="relative flex h-full min-h-0 flex-col gap-3.5 overflow-y-auto px-4 pb-0 pt-4">

          <div className="flex shrink-0 items-center gap-2">
            <span className="font-display text-[20px] font-extrabold">TYPELY</span>
            <span className="rounded-full bg-[#5be8ba]/[0.16] px-2 py-[2px] text-[9.5px] font-bold uppercase tracking-[0.07em] text-[#5be8ba]">
              Gestión
            </span>
          </div>

          {/* Escuela */}
          <div className="shrink-0 rounded-[14px] border border-white/[0.13] bg-white/[0.08] px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: RAIL_MUTED }}>
              Escuela
            </div>
            {loadingSedes ? (
              <div className="mt-1.5 flex items-center gap-2 text-[13px]" style={{ color: RAIL_MUTED }}>
                <Spinner /> Cargando…
              </div>
            ) : !current ? (
              <div className="mt-1 text-[13px] font-semibold text-white">Todavía no hay ninguna</div>
            ) : isSuperadmin && sedes.length > 1 ? (
              <select
                value={selected ?? ""}
                onChange={(e) => setSelected(e.target.value)}
                aria-label="Escuela"
                className="mt-1 w-full cursor-pointer rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[13px] font-semibold text-white outline-none focus:border-[#7488fc]"
              >
                {sedes.map((s) => (
                  <option key={s.id} value={s.id} className="text-[#17355f]">
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-white">
                {current.name}
              </div>
            )}
          </div>

          {/* Navegación */}
          <nav aria-label="Secciones" className="shrink-0">
            <ul className="flex flex-col gap-0.5">
              {nav.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `block rounded-[10px] px-3 py-[7px] text-[13px] font-semibold transition-colors ${
                        isActive ? "bg-white/[0.14] text-white" : "text-[#a6a7d8] hover:bg-white/[0.07]"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Alta de cuentas */}
          {current && (
            <NewAccountForm
              sedeId={current.id}
              sedes={sedes}
              isSuperadmin={isSuperadmin}
              groups={groups}
              onCreated={(title, list) => {
                setCredentials({ title, list });
                void loadGroups();
              }}
              onSedesChanged={() => void loadSedes()}
            />
          )}

          {/* Totales */}
          <div className="flex shrink-0 gap-1.5">
            <RailStat label="grupos" value={groups ? groups.length : null} />
            <RailStat label="alumnos" value={studentTotal} />
            <RailStat label="docentes" value={teacherCount} />
          </div>

          <div className="shrink-0 border-t border-white/10 pt-2.5">
            <div className="mb-2 leading-tight">
              <div className="truncate text-[12.5px] font-semibold text-white">{user?.name}</div>
              <div className="text-[10.5px]" style={{ color: RAIL_MUTED }}>
                {isSuperadmin ? "Superadmin" : "Administrador"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="w-full rounded-[10px] border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[12.5px] font-semibold text-[#c9cbef] transition-colors hover:bg-white/10 hover:text-white"
            >
              Cerrar sesión
            </button>
          </div>

          {/* La mascota toma lo que sobra y se achica sola: en una pantalla
              baja desaparece antes que empujar algo útil fuera de vista.
              Espejada para que mire hacia el contenido.

              El aire de abajo va como `pb-4` del contenedor, no como margen
              de la imagen: `max-h-full` se mide contra la caja de contenido,
              así que el padding entra en la cuenta y la mascota se despega
              del borde sin que se le recorte la cabeza. */}
          <div className="flex min-h-0 flex-1 items-end justify-center overflow-hidden pb-10">
            <img
              src={assets.mascotMaleLaptop}
              alt=""
              aria-hidden="true"
              className="max-h-full w-auto max-w-[150px] object-contain"
              style={{ transform: "scaleX(-1)" }}
            />
          </div>
        </div>
      </aside>

      {/* ================= Columna de trabajo ================= */}
      {/* `min-h-0` acá y en cada hijo: sin eso el scroll se escapa a la
          página en vez de quedarse en la lista. */}
      <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col">

        {/* Barra compacta donde la columna no entra. */}
        <div className="flex shrink-0 items-center gap-2 border-b border-[#dbe6f4] bg-white px-4 py-2 md:hidden">
          <span className="font-display text-lg font-extrabold">TYPELY</span>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-2.5 py-1.5 text-sm font-semibold ${
                  isActive ? "bg-[#eaefff] text-[#3159e8]" : "text-[#475069]"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => void logout()}
            className="ml-auto text-sm font-semibold text-[#475069]"
          >
            Salir
          </button>
        </div>

        {credentials && (
          <div className="shrink-0 px-4 pt-4 sm:px-7">
            <CredentialsPanel
              title={credentials.title}
              credentials={credentials.list}
              onClose={() => setCredentials(null)}
            />
          </div>
        )}

        {loadingSedes ? (
          <div className="flex items-center gap-2 px-7 py-16 text-sm text-[#667085]">
            <Spinner /> Cargando…
          </div>
        ) : sedeError ? (
          <div className="px-4 py-6 sm:px-7">
            <ErrorBanner message={sedeError} onRetry={() => void loadSedes()} />
          </div>
        ) : !ctx ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-7">
            <FirstSede onCreated={() => void loadSedes()} />
          </div>
        ) : (
          <ManageContext.Provider value={ctx}>
            {/* Contenedor sin scroll propio: cada pantalla decide qué zona
                suya scrollea. La de Grupos deja fijo el encabezado. */}
            <div className="flex min-h-0 flex-1 flex-col">
              <Outlet />
            </div>
          </ManageContext.Provider>
        )}
      </main>

    </div>
  );
}


/* ------------------------------------------------------------------ */

function RailStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex-1 rounded-xl bg-white/[0.07] px-2.5 py-2">
      <div className="font-display text-[17px] font-bold leading-none text-white">
        {value === null ? "—" : value}
      </div>
      <div className="mt-0.5 text-[10px]" style={{ color: RAIL_MUTED }}>
        {label}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Alta de cuentas                                                     */
/* ------------------------------------------------------------------ */

/** Un solo formulario para las tres altas. El rol no es un menú: es un
 *  control siempre visible, y lo único que cambia debajo es un campo.
 *
 *  **Admin solo lo ve el superadmin.** Un admin no puede crear otro admin
 *  — es una regla dura del RBAC, y la API la vuelve a verificar: esconder
 *  la opción es comodidad de la interfaz, nunca la defensa. */
function NewAccountForm({
  sedeId,
  sedes,
  isSuperadmin,
  groups,
  onCreated,
  onSedesChanged,
}: {
  sedeId: string;
  sedes: Sede[];
  isSuperadmin: boolean;
  groups: Group[] | null;
  onCreated: (title: string, list: IssuedCredentials[]) => void;
  onSedesChanged: () => void;
}) {
  const [role, setRole] = useState<"alumno" | "docente" | "admin">("alumno");
  const [fullName, setFullName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [email, setEmail] = useState("");
  /* Escuela destino del admin. Arranca en la que estás mirando, pero se
     puede cambiar: podés crear el admin de otra escuela sin tener que
     cambiar de contexto primero. */
  const [adminSedeId, setAdminSedeId] = useState(sedeId);
  /* null = elegir una existente; string = crear una en el momento. */
  const [newSedeName, setNewSedeName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const roles: Array<"alumno" | "docente" | "admin"> = isSuperadmin
    ? ["alumno", "docente", "admin"]
    : ["alumno", "docente"];

  useEffect(() => {
    setAdminSedeId((prev) => (sedes.some((s) => s.id === prev) ? prev : sedeId));
  }, [sedeId, sedes]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = fullName.trim();
    if (!clean) {
      setError("Escribí el nombre y apellido.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      /* Un admin necesita SIEMPRE una escuela: la base lo exige con un
         CHECK. Si pediste crearla en el momento, se crea primero — sin
         ella la cuenta no puede existir. */
      let targetSede = sedeId;
      let createdSede = false;
      if (role === "admin") {
        if (newSedeName !== null) {
          const cleanSede = newSedeName.trim();
          if (!cleanSede) {
            setError("Escribí el nombre de la escuela nueva.");
            setSaving(false);
            return;
          }
          const created = await api.createSede({ name: cleanSede });
          targetSede = created.id;
          createdSede = true;
        } else {
          targetSede = adminSedeId;
        }
      }

      const res = await api.createUser({
        fullName: clean,
        role,
        sedeId: targetSede,
        groupId: role === "alumno" && groupId ? groupId : null,
        email: role !== "alumno" && email.trim() ? email.trim().toLowerCase() : null,
      });

      setFullName("");
      setEmail("");
      if (createdSede) {
        setNewSedeName(null);
        onSedesChanged();
      }

      /* La contraseña solo viene cuando la generó el servidor, y se ve una
         sola vez: por eso sube al panel en vez de quedarse acá. */
      if (res.temporaryPassword) {
        onCreated(`Credenciales de ${res.user.fullName}`, [
          {
            fullName: res.user.fullName,
            username: res.user.username,
            temporaryPassword: res.temporaryPassword,
            role,
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos crear la cuenta.");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "w-full rounded-[10px] border border-white/[0.13] bg-white/[0.07] px-2.5 py-1.5 text-[12.5px] text-white outline-none transition-colors placeholder:text-[#a6a7d8] focus:border-[#7488fc] focus:bg-white/[0.11]";

  const CTA: Record<string, string> = {
    alumno: "Crear alumno",
    docente: "Crear docente",
    admin: "Crear admin",
  };

  return (
    <form onSubmit={submit} className="flex shrink-0 flex-col gap-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: RAIL_MUTED }}>
        Crear cuenta
      </div>

      <div className="flex rounded-[11px] bg-white/[0.09] p-[3px]" role="group" aria-label="Rol de la cuenta">
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => { setRole(r); setError(""); }}
            aria-pressed={role === r}
            className={`flex-1 rounded-[9px] py-[6px] text-[12px] font-semibold capitalize transition-colors ${
              role === r ? "bg-white text-[#262456]" : "text-[#a6a7d8] hover:text-white"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <input
        value={fullName}
        onChange={(e) => { setFullName(e.target.value); if (error) setError(""); }}
        placeholder="Nombre y apellido"
        aria-label="Nombre y apellido"
        className={fieldClass}
      />

      {role === "alumno" && (
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          aria-label="Grupo"
          className={`${fieldClass} cursor-pointer`}
        >
          <option value="" className="text-[#17355f]">Sin grupo</option>
          {(groups ?? []).map((g) => (
            <option key={g.id} value={g.id} className="text-[#17355f]">
              {g.name}
            </option>
          ))}
        </select>
      )}

      {role === "admin" &&
        (newSedeName === null ? (
          <select
            value={adminSedeId}
            onChange={(e) => {
              if (e.target.value === "__new__") setNewSedeName("");
              else setAdminSedeId(e.target.value);
            }}
            aria-label="Escuela que va a administrar"
            className={`${fieldClass} cursor-pointer`}
          >
            {sedes.map((s) => (
              <option key={s.id} value={s.id} className="text-[#17355f]">
                {s.name}
              </option>
            ))}
            <option value="__new__" className="text-[#17355f]">+ Crear escuela nueva…</option>
          </select>
        ) : (
          <div className="flex gap-1.5">
            <input
              value={newSedeName}
              onChange={(e) => { setNewSedeName(e.target.value); if (error) setError(""); }}
              placeholder="Nombre de la escuela"
              aria-label="Nombre de la escuela nueva"
              autoFocus
              className={fieldClass}
            />
            <button
              type="button"
              onClick={() => setNewSedeName(null)}
              aria-label="Elegir una escuela existente"
              className="shrink-0 rounded-[10px] border border-white/[0.13] bg-white/[0.07] px-2 text-[12.5px] font-semibold text-[#a6a7d8] hover:text-white"
            >
              ✕
            </button>
          </div>
        ))}

      {role !== "alumno" && (
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (opcional)"
          aria-label="Email"
          type="email"
          className={fieldClass}
        />
      )}

      {error && (
        <p role="alert" className="text-[11px] font-semibold text-[#ffb4c4]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="mt-0.5 flex h-[36px] items-center justify-center gap-2 rounded-[11px] border-0 text-[13px] font-bold text-[#0d2646] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #5be8ba, #33c7f0)" }}
      >
        {saving && <Spinner />}
        {CTA[role]}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */

/** Sin escuelas no hay nada que administrar, así que se pide crear la
 *  primera en vez de mostrar una lista vacía. Decir "no hay grupos"
 *  cuando lo que falta es la escuela manda al lugar equivocado. */
function FirstSede({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError("Escribí el nombre de la escuela.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.createSede({ name: clean, city: city.trim() || undefined });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos crear la escuela.");
      setSaving(false);
    }
  }

  return (
    <Card className="mx-auto max-w-lg p-6">
      <h1 className="font-display text-lg font-bold text-[#101828]">Creá tu primera escuela</h1>
      <p className="mt-1.5 text-sm text-[#667085]">
        Todo cuelga de acá: los grupos, los docentes y los alumnos pertenecen a una escuela.
      </p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
        <Field label="Nombre" htmlFor="sede-name" error={error || undefined}>
          <Input
            id="sede-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Escuela N.º 12 Manuel Belgrano"
            invalid={Boolean(error)}
            autoFocus
          />
        </Field>
        <Field label="Localidad" htmlFor="sede-city" hint="Opcional.">
          <Input id="sede-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Rosario" />
        </Field>
        <Button type="submit" variant="primary" loading={saving} className="self-start">
          Crear escuela
        </Button>
      </form>
    </Card>
  );
}
