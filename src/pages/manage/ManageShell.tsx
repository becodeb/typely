/* Marco de las pantallas de gestión.
 *
 * Resuelve una cosa que las pantallas de adentro no deberían tener que
 * resolver cada una: **sobre qué sede se está trabajando**.
 *
 *   - Un `admin` pertenece a UNA sede y no elige: es la suya.
 *   - El `superadmin` no pertenece a ninguna y las administra todas, así
 *     que elige con un desplegable.
 *
 * Las dos pantallas de gestión son las mismas para los dos roles —el
 * superadmin tiene exactamente los mismos permisos que el admin, más el
 * alcance— así que en vez de duplicarlas, el selector vive acá y abajo
 * todo lee `useSede()`.
 *
 * Si el superadmin todavía no creó ninguna sede, esta pantalla no deja
 * pasar: sin sede no hay grupos, ni usuarios, ni nada que administrar.
 * Mostrarle una lista vacía sería decirle "no hay nada" cuando el
 * problema real es "falta crear la primera".
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import type { Sede } from "../../types";
import { api, ApiError } from "../../utils/api";
import { useAuth } from "../../hooks/useAuth";
import { roleLabel } from "../../utils/storage";
import { Button, Card, ErrorBanner, Field, Input, Spinner } from "./ui";

interface SedeContextValue {
  sedeId: string;
  sedeName: string;
  /** Solo el superadmin puede cambiar de sede. */
  canSwitch: boolean;
  /** Vuelve a pedir la lista de sedes. La usa la pantalla de Sedes tras
   *  crear o editar una, para que el selector de arriba quede al día. */
  reloadSedes: () => void;
}

const SedeContext = createContext<SedeContextValue | null>(null);

export function useSede(): SedeContextValue {
  const ctx = useContext(SedeContext);
  if (!ctx) throw new Error("useSede tiene que usarse dentro de ManageShell");
  return ctx;
}

/* El ítem de Sedes es solo del superadmin: un admin pertenece a una y no
   administra ninguna. */
const NAV_ALL = [
  { to: "/gestion/sedes", label: "Escuelas", superadminOnly: true },
  { to: "/gestion/grupos", label: "Grupos", superadminOnly: false },
];

export function ManageShell() {
  const { user, logout } = useAuth();
  const isSuperadmin = user?.role === "superadmin";
  const NAV = NAV_ALL.filter((i) => !i.superadminOnly || isSuperadmin);

  const [sedes, setSedes] = useState<Sede[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isSuperadmin) {
        const all = await api.sedes();
        setSedes(all);
        /* Se conserva la elección previa si esa sede sigue existiendo; si
           no, se cae a la primera. */
        setSelected((prev) => (prev && all.some((s) => s.id === prev) ? prev : (all[0]?.id ?? null)));
      } else {
        const mine = await api.mySede();
        setSedes([mine]);
        setSelected(mine.id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos cargar tus sedes.");
    } finally {
      setLoading(false);
    }
  }, [isSuperadmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = sedes.find((s) => s.id === selected) ?? null;

  return (
    <div className="min-h-dvh bg-[#f6f7f9] font-body text-[#1a2233]">
      {/* ---- Barra superior ---- */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-[#e3e6ec] bg-white px-4 sm:px-6">
        <span className="font-display text-lg font-extrabold tracking-tight text-[#101828]">TYPELY</span>
        <span className="hidden text-xs font-semibold uppercase tracking-wider text-[#98a2b3] sm:inline">
          Gestión
        </span>

        {/* Sede: desplegable para el superadmin, texto fijo para el admin. */}
        {current && (
          <div className="ml-2 min-w-0">
            {isSuperadmin && sedes.length > 1 ? (
              <select
                value={selected ?? ""}
                onChange={(e) => setSelected(e.target.value)}
                aria-label="Sede"
                className="max-w-[14rem] rounded-lg border border-[#d5d9e2] bg-white px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-[#3159e8]"
              >
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="truncate text-sm font-semibold text-[#344054]">{current.name}</span>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-semibold text-[#344054]">{user?.name}</p>
            <p className="text-xs text-[#98a2b3]">{user ? roleLabel(user.role) : ""}</p>
          </div>
          <Button variant="ghost" onClick={() => void logout()}>
            Cerrar sesión
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[80rem] gap-6 px-4 py-6 sm:px-6">
        {/* ---- Navegación ---- */}
        <nav className="hidden w-48 shrink-0 md:block" aria-label="Secciones">
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      isActive ? "bg-[#eaefff] text-[#3159e8]" : "text-[#475069] hover:bg-[#eef1f6]"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">
          {loading ? (
            <div className="flex items-center gap-2 py-16 text-sm text-[#667085]">
              <Spinner /> Cargando…
            </div>
          ) : error ? (
            <ErrorBanner message={error} onRetry={() => void load()} />
          ) : !current ? (
            <FirstSede onCreated={() => void load()} />
          ) : (
            <SedeContext.Provider
              value={{
                sedeId: current.id,
                sedeName: current.name,
                canSwitch: isSuperadmin,
                reloadSedes: () => void load(),
              }}
            >
              {/* Navegación en pantallas angostas, debajo del encabezado. */}
              <nav className="mb-4 flex gap-1 md:hidden" aria-label="Secciones">
                {NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-1.5 text-sm font-semibold ${
                        isActive ? "bg-[#eaefff] text-[#3159e8]" : "text-[#475069]"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <Outlet />
            </SedeContext.Provider>
          )}
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Primera sede                                                        */
/* ------------------------------------------------------------------ */

/** Sin sedes no hay nada que administrar, así que en vez de una lista
 *  vacía se pide crear la primera. Solo la ve el superadmin: un admin sin
 *  sede es un estado que la base impide. */
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
      setError(err instanceof ApiError ? err.message : "No pudimos crear la sede.");
      setSaving(false);
    }
  }

  return (
    <Card className="mx-auto max-w-lg p-6">
      <h1 className="text-lg font-bold text-[#101828]">Creá tu primera escuela</h1>
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
          <Input
            id="sede-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Rosario"
          />
        </Field>
        <Button type="submit" variant="primary" loading={saving} className="self-start">
          Crear escuela
        </Button>
      </form>
    </Card>
  );
}
