/* Marco de las pantallas de gestión — dos columnas.
 *
 * La izquierda es CONTEXTO y no cambia al navegar: en qué escuela estás,
 * el alta de cuentas y los totales. La derecha es trabajo.
 *
 * Por qué el alta vive en la columna y no detrás de un botón: crear
 * cuentas es la tarea que más se repite al arrancar un año, y esconderla
 * en un menú cuesta un click por alumno. Acá el rol es un control siempre
 * visible, así que dar de alta es escribir un nombre y apretar.
 *
 * El marco también resuelve el alcance:
 *   - un `admin` pertenece a UNA escuela y no elige;
 *   - el `superadmin` no pertenece a ninguna y las administra todas.
 * Las pantallas de adentro solo preguntan `useSede()`.
 *
 * Y es dueño de dos datos compartidos —los grupos y las credenciales
 * recién emitidas— porque los usan tanto la columna como la pantalla de
 * la derecha, y cargarlos dos veces los haría discrepar entre sí.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import type { Group, IssuedCredentials, Sede } from "../../types";
import { api, ApiError } from "../../utils/api";
import { useAuth } from "../../hooks/useAuth";
import { CredentialsPanel } from "./Credentials";
import { Button, Card, ErrorBanner, Field, Input, Spinner } from "./ui";

interface ManageContextValue {
  sedeId: string;
  sedeName: string;
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
  { to: "/gestion/sedes", label: "Escuelas", superadminOnly: true },
];

/* Paleta de la marca (src/styles/global.css). El navy es estructura, no
   decoración: por eso ocupa una columna entera y no un borde. */
const NAVY = "#17355f";
const RAIL_MUTED = "#7d9ac6";
const RAIL_TEXT = "#a9c0e0";

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
            canSwitch: isSuperadmin,
            reloadSedes: () => void loadSedes(),
            groups,
            groupsError,
            reloadGroups: () => void loadGroups(),
            showCredentials: (title, list) => setCredentials({ title, list }),
          }
        : null,
    [current, isSuperadmin, loadSedes, groups, groupsError, loadGroups],
  );

  return (
    <div className="font-body flex min-h-dvh bg-[#fbfcfe] text-[#17355f]">

      {/* ================= Columna de contexto ================= */}
      <aside
        style={{ background: NAVY }}
        className="hidden w-[296px] shrink-0 flex-col gap-6 px-[22px] py-[26px] text-white md:flex"
      >
        <div className="flex items-center gap-2.5">
          <span className="font-display text-[21px] font-extrabold">TYPELY</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: RAIL_MUTED }}>
            Gestión
          </span>
        </div>

        {/* Escuela */}
        <div className="rounded-[13px] border border-white/10 bg-white/[0.07] px-[15px] py-3.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: RAIL_MUTED }}>
            Escuela
          </div>
          {loadingSedes ? (
            <div className="mt-2 flex items-center gap-2 text-sm" style={{ color: RAIL_TEXT }}>
              <Spinner /> Cargando…
            </div>
          ) : !current ? (
            <div className="mt-1.5 text-sm font-semibold text-white">Todavía no hay ninguna</div>
          ) : isSuperadmin && sedes.length > 1 ? (
            <select
              value={selected ?? ""}
              onChange={(e) => setSelected(e.target.value)}
              aria-label="Escuela"
              className="mt-1.5 w-full cursor-pointer rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-sm font-semibold text-white outline-none focus:border-[#33c7f0]"
            >
              {sedes.map((s) => (
                <option key={s.id} value={s.id} className="text-[#17355f]">
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-1.5 text-sm font-semibold leading-snug text-white">{current.name}</div>
          )}
        </div>

        {/* Navegación */}
        <nav aria-label="Secciones">
          <ul className="flex flex-col gap-0.5">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `block rounded-[9px] px-3 py-2 text-[13.5px] font-semibold transition-colors ${
                      isActive ? "bg-white/[0.14] text-white" : "text-[#a9c0e0] hover:bg-white/[0.07]"
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
            groups={groups}
            onCreated={(title, list) => {
              setCredentials({ title, list });
              void loadGroups();
            }}
          />
        )}

        {/* Totales */}
        <div className="mt-auto flex flex-col">
          <RailStat label="Grupos" value={groups ? groups.length : null} />
          <RailStat label="Alumnos" value={studentTotal} />
          <RailStat label="Docentes" value={teacherCount} last />
        </div>

        <div className="border-t border-white/10 pt-4">
          <div className="mb-2.5 leading-tight">
            <div className="truncate text-[13px] font-semibold text-white">{user?.name}</div>
            <div className="text-[11px]" style={{ color: RAIL_MUTED }}>
              {isSuperadmin ? "Superadmin" : "Administrador"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full rounded-[9px] border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] font-semibold text-[#a9c0e0] transition-colors hover:bg-white/10 hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ================= Columna de trabajo ================= */}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        {/* Barra compacta donde la columna no entra. */}
        <div className="mb-5 flex items-center gap-2 md:hidden">
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
          <CredentialsPanel
            title={credentials.title}
            credentials={credentials.list}
            onClose={() => setCredentials(null)}
          />
        )}

        {loadingSedes ? (
          <div className="flex items-center gap-2 py-16 text-sm text-[#667085]">
            <Spinner /> Cargando…
          </div>
        ) : sedeError ? (
          <ErrorBanner message={sedeError} onRetry={() => void loadSedes()} />
        ) : !ctx ? (
          <FirstSede onCreated={() => void loadSedes()} />
        ) : (
          <ManageContext.Provider value={ctx}>
            <Outlet />
          </ManageContext.Provider>
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RailStat({ label, value, last }: { label: string; value: number | null; last?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between py-2.5 ${last ? "" : "border-b border-white/[0.09]"}`}>
      <span className="text-[12.5px]" style={{ color: RAIL_TEXT }}>
        {label}
      </span>
      <span className="font-display text-[18px] font-bold text-white">{value === null ? "—" : value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Alta de cuentas                                                     */
/* ------------------------------------------------------------------ */

/** Un solo formulario para las dos altas. El rol no es un menú: es un
 *  control siempre visible, y lo único que cambia debajo es un campo. */
function NewAccountForm({
  sedeId,
  groups,
  onCreated,
}: {
  sedeId: string;
  groups: Group[] | null;
  onCreated: (title: string, list: IssuedCredentials[]) => void;
}) {
  const [role, setRole] = useState<"alumno" | "docente">("alumno");
  const [fullName, setFullName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isAlumno = role === "alumno";

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
      const res = await api.createUser({
        fullName: clean,
        role,
        sedeId,
        groupId: isAlumno && groupId ? groupId : null,
        email: !isAlumno && email.trim() ? email.trim().toLowerCase() : null,
      });
      setFullName("");
      setEmail("");
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
    "w-full rounded-[10px] border border-white/[0.13] bg-white/[0.06] px-3 py-2 text-[13px] text-white outline-none transition-colors placeholder:text-[#7d9ac6] focus:border-[#33c7f0] focus:bg-white/10";

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: RAIL_MUTED }}>
        Crear cuenta
      </div>

      <div className="flex rounded-[11px] bg-white/[0.08] p-[3px]" role="group" aria-label="Rol de la cuenta">
        {(["alumno", "docente"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => { setRole(r); setError(""); }}
            aria-pressed={role === r}
            className={`flex-1 rounded-[9px] py-2 text-[13px] font-semibold capitalize transition-colors ${
              role === r ? "bg-white text-[#17355f]" : "text-[#a9c0e0] hover:text-white"
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

      {isAlumno ? (
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
      ) : (
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
        <p role="alert" className="text-[11.5px] font-semibold text-[#ffb4c4]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="mt-0.5 flex h-10 items-center justify-center gap-2 rounded-[10px] border-0 text-[13.5px] font-bold text-[#0d2646] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #22c7b8, #33c7f0)" }}
      >
        {saving && <Spinner />}
        {isAlumno ? "Crear alumno" : "Crear docente"}
      </button>

      <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: RAIL_MUTED }}>
        {isAlumno
          ? "No necesita email. El usuario y la contraseña se generan y se muestran una sola vez."
          : "Después de crearlo, se le asignan grupos desde el detalle de cada uno."}
      </p>
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
