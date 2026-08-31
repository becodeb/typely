/* Contraseñas — restablecer la de otra persona.
 *
 * Es el pedido más repetido de un aula ("me la olvidé") y hasta ahora la
 * única salida era borrar y recrear la cuenta, que se lleva el progreso
 * puesto. Por eso vive como columna fija y no detrás de un menú: se usa
 * a diario, y siempre en el medio de otra cosa.
 *
 * **Quién puede sobre quién.** Cada rol alcanza a los de abajo suyo:
 * el superadmin a todos, el admin a docentes y alumnos de su sede, el
 * docente a los alumnos de sus grupos. `RESETTABLE` es solo comodidad de
 * la interfaz —esconde lo que no vas a poder hacer— y NO es la defensa:
 * la API lo verifica de nuevo con la misma matriz (`api/src/rbac.ts`) y
 * es la que decide. Si las dos se separan alguna vez, gana la API.
 *
 * Nadie aparece a sí mismo en la lista. Cambiar la propia contraseña pide
 * la actual a propósito, para que un token robado no alcance para quedarse
 * con la cuenta; llegar a la propia por acá saltearía ese pedido.
 *
 * La temporal se muestra UNA vez y no queda guardada en claro en ningún
 * lado, así que la fila la retiene hasta que la cierres a mano.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiUser, Role } from "../../types";
import { api, ApiError } from "../../utils/api";
import { Spinner } from "./ui";

/** A qué roles alcanza cada rol. Espejo de `GRANTABLE` en la API. */
const RESETTABLE: Record<Role, readonly Role[]> = {
  superadmin: ["superadmin", "admin", "docente", "alumno"],
  admin: ["docente", "alumno"],
  docente: ["alumno"],
  alumno: [],
};

const ROLE_TAG: Record<Role, { label: string; bg: string; fg: string }> = {
  superadmin: { label: "superadmin", bg: "#efeaff", fg: "#6141c8" },
  admin: { label: "admin", bg: "#e7eeff", fg: "#3159e8" },
  docente: { label: "docente", bg: "#e0f6f1", fg: "#0f8f7c" },
  alumno: { label: "alumno", bg: "#eef3f9", fg: "#5b708f" },
};

/** Sin tildes y en minúsculas: buscar "jose" tiene que encontrar a "José". */
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function PasswordTool({
  sedeId,
  actorRole,
  actorId,
}: {
  sedeId: string;
  actorRole: Role;
  actorId: string;
}) {
  const [people, setPeople] = useState<ApiUser[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  /* Una sola fila a la vez en cada estado: confirmando, o mostrando la
     temporal recién emitida. Tener varias abiertas invita a copiar la
     contraseña equivocada. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ id: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setPeople(null);
    try {
      /* El superadmin no pertenece a ninguna sede, así que no aparece en
         el listado de una: se piden aparte y se fusionan. Sin esto, el
         único rol al que el superadmin NO llegaría es el suyo. */
      const [inSede, supers] = await Promise.all([
        api.users({ sedeId }),
        actorRole === "superadmin" ? api.users({ role: "superadmin" }) : Promise.resolve([]),
      ]);
      const seen = new Set<string>();
      setPeople([...supers, ...inSede].filter((u) => !seen.has(u.id) && seen.add(u.id)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos cargar las cuentas.");
    }
  }, [sedeId, actorRole]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (!people) return [];
    const allowed = RESETTABLE[actorRole];
    const q = fold(query.trim());
    return people
      .filter((u) => u.id !== actorId && allowed.includes(u.role))
      .filter((u) => !q || fold(u.fullName).includes(q) || fold(u.username).includes(q));
  }, [people, actorRole, actorId, query]);

  async function reset(user: ApiUser) {
    setBusy(user.id);
    setError("");
    try {
      const res = await api.resetPassword(user.id);
      setIssued({ id: user.id, password: res.temporaryPassword });
      setConfirming(null);
      setCopied(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos restablecer la contraseña.");
      setConfirming(null);
    } finally {
      setBusy(null);
    }
  }

  async function copy(user: ApiUser, password: string) {
    try {
      await navigator.clipboard.writeText(`${user.fullName}\t${user.username}\t${password}`);
      setCopied(true);
    } catch {
      /* Sin permiso de portapapeles queda a la vista para anotarla. */
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-4 pb-4 pt-[26px]">
      <div>
        <h2 className="font-display text-[15px] font-bold leading-tight text-[#17355f]">Contraseñas</h2>
        <p className="mt-0.5 text-[11.5px] leading-snug text-[#7f92b0]">
          Generá una temporal para quien la olvidó. La tendrá que cambiar al entrar.
        </p>
      </div>

      <div className="relative shrink-0">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9fb0c9]"
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o usuario"
          aria-label="Buscar persona"
          className="w-full rounded-xl border border-[#dde5f0] bg-white py-2 pl-8 pr-3 text-[12.5px] text-[#17355f] outline-none transition-colors placeholder:text-[#9fb0c9] focus:border-[#33c7f0] focus:ring-4 focus:ring-[#33c7f0]/15"
        />
      </div>

      {error && (
        <p role="alert" className="shrink-0 rounded-lg bg-[#fff1f4] px-3 py-2 text-[11.5px] font-semibold text-[#c0335c]">
          {error}
        </p>
      )}

      {/* La lista es lo único que scrollea de esta columna. */}
      <div className="-mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
        {people === null && !error ? (
          <div className="flex items-center gap-2 py-6 text-[12px] text-[#7f92b0]">
            <Spinner /> Cargando…
          </div>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-[12px] leading-snug text-[#93a5c2]">
            {query ? "Nadie coincide con esa búsqueda." : "Todavía no hay cuentas a las que puedas alcanzar."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {visible.map((u) => {
              const tag = ROLE_TAG[u.role];
              const showing = issued?.id === u.id;
              return (
                <li key={u.id} className="rounded-xl border border-[#e6edf6] bg-white px-2.5 py-2">
                  {/* El botón ocupa solo el primer renglón, así el segundo
                      tiene el ancho entero para el usuario. Compartiendo
                      renglón con la etiqueta de rol, el usuario se recortaba
                      a dos letras — y es el dato que hay que leerle a la
                      persona, porque es con lo que entra. */}
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold leading-tight text-[#17355f]">
                      {u.fullName}
                    </span>
                    {!showing && confirming !== u.id && (
                      <button
                        type="button"
                        onClick={() => { setConfirming(u.id); setIssued(null); }}
                        className="shrink-0 rounded-lg border border-[#dde5f0] px-2 py-1 text-[11px] font-semibold text-[#3d5580] transition-colors hover:border-[#33c7f0] hover:text-[#17355f]"
                      >
                        Restablecer
                      </button>
                    )}
                  </div>

                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className="shrink-0 rounded px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.04em]"
                      style={{ background: tag.bg, color: tag.fg }}
                    >
                      {tag.label}
                    </span>
                    <span className="truncate font-mono text-[10.5px] text-[#7f92b0]">{u.username}</span>
                  </div>

                  {/* Confirmación en la fila y no en un modal: el modal tapa
                      a quién estás por tocar, que es justo el dato que hay
                      que releer antes de apretar. */}
                  {confirming === u.id && (
                    <div className="mt-2 rounded-lg bg-[#fff8e8] px-2.5 py-2">
                      <p className="text-[11px] leading-snug text-[#8a6420]">
                        Se le corta la sesión en todos sus dispositivos y va a tener que elegir
                        una nueva al entrar.
                      </p>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => void reset(u)}
                          disabled={busy === u.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#3159e8] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                        >
                          {busy === u.id && <Spinner />}
                          Restablecer
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          disabled={busy === u.id}
                          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[#7f92b0] hover:text-[#17355f]"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {showing && (
                    <div className="mt-2 rounded-lg bg-[#eef7f4] px-2.5 py-2">
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#0f8f7c]">
                        Contraseña temporal
                      </div>
                      <div className="mt-1 select-all font-mono text-[14px] font-bold tracking-wide text-[#17355f]">
                        {issued.password}
                      </div>
                      <p className="mt-1 text-[10.5px] leading-snug text-[#5b708f]">
                        Se muestra una sola vez. Anotala antes de cerrar.
                      </p>
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => void copy(u, issued.password)}
                          className="rounded-lg border border-[#c6e5dc] bg-white px-2 py-1 text-[11px] font-semibold text-[#0f8f7c]"
                        >
                          {copied ? "Copiado" : "Copiar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIssued(null); setCopied(false); }}
                          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[#7f92b0] hover:text-[#17355f]"
                        >
                          Listo
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
