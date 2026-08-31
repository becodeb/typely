/* Tablero — cómo va la gente que tenés a cargo.
 *
 * Es la pantalla de entrada del docente y también sirve al admin y al
 * superadmin: la API acota el alcance sola según quién pregunta (`docente`
 * → sus grupos, `admin` → su escuela, `superadmin` → la escuela elegida),
 * así que el mismo componente sirve a los tres sin una sola condición.
 *
 * **Lo primero que se ve es quién necesita ayuda**, no el total. Un tablero
 * que abre con "148 alumnos" obliga a buscar; este abre con los que hace
 * una semana que no entran y los que están por debajo del 60 % — que es lo
 * que un docente hace a la mañana antes de dar la clase.
 *
 * Las estrellas son las MISMAS que ve el chico en el juego (3 desde 90 %
 * de precisión, 2 desde 75 %, 1 si completó), y la isla que se muestra al
 * lado de cada alumno es la de su grado. Si el panel contara el progreso
 * con otra vara que el juego, docente y alumno hablarían de cosas
 * distintas mirando la misma pantalla.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Overview } from "../../utils/api";
import { api, ApiError } from "../../utils/api";
import { useAuth } from "../../hooks/useAuth";
import { assets, islandMapThumb } from "../../utils/assets";
import { useSede } from "./ManageShell";
import { Card, EmptyState, ErrorBanner, Spinner, islandForGrade, tintForGrade } from "./ui";

/** "hace 3 días", "hoy", "nunca". Un timestamp crudo obliga a hacer la
 *  resta mental, y la pregunta real siempre es cuánto hace. */
function since(iso: string | null): { text: string; stale: boolean } {
  if (!iso) return { text: "Nunca entró", stale: true };
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return { text: "Hoy", stale: false };
  if (days === 1) return { text: "Ayer", stale: false };
  if (days < 7) return { text: `Hace ${days} días`, stale: false };
  if (days < 30) return { text: `Hace ${Math.floor(days / 7)} sem.`, stale: true };
  return { text: `Hace ${Math.floor(days / 30)} meses`, stale: true };
}

export function DashboardPage() {
  const { user } = useAuth();
  const { sedeId, groups } = useSede();
  const isDocente = user?.role === "docente";

  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("todos");

  const load = useCallback(async () => {
    setError("");
    try {
      /* El superadmin elige escuela con el selector de la barra; para los
         otros dos la API ignora el parámetro y usa su propio alcance. */
      setData(await api.overview(user?.role === "superadmin" ? sedeId : undefined));
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError ? err.message : "No pudimos cargar el tablero.");
    }
  }, [sedeId, user?.role]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const roster = useMemo(() => {
    if (!data) return [];
    return groupFilter === "todos" ? data.roster : data.roster.filter((r) => r.groupId === groupFilter);
  }, [data, groupFilter]);

  /* Grado por grupo, para saber qué isla dibujar al lado de cada alumno. */
  const gradeByGroup = useMemo(
    () => new Map((groups ?? []).map((g) => [g.id, g.grade as string])),
    [groups],
  );

  const needsAttention = useMemo(
    () => roster.filter((r) => !r.lastActivity || since(r.lastActivity).stale || r.avgAccuracy < 60),
    [roster],
  );

  return (
    <>
      <div className="relative min-h-[128px] shrink-0 overflow-hidden">
        <img
          src={assets.homeBg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center 62%" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(238,246,253,0) 40%, rgba(238,246,253,0.94) 100%)" }}
        />
        <div className="relative px-4 pb-4 pt-6 sm:px-8">
          <h1 className="font-display text-[30px] font-extrabold leading-tight tracking-[-0.018em] text-[#133463]">
            {isDocente ? "Tu curso" : "Tablero"}
          </h1>
          <p className="mt-0.5 text-[13.5px] font-medium text-[#456494]">
            {isDocente
              ? "Cómo viene cada alumno tuyo, y quién necesita una mano."
              : "El pulso de la escuela: actividad, progreso y lo que pide atención."}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-1 sm:px-8">
        {error && !data ? (
          <ErrorBanner message={error} onRetry={() => void load()} />
        ) : !data ? (
          <div className="flex items-center gap-2 py-10 text-sm text-[#667085]">
            <Spinner /> Cargando el tablero…
          </div>
        ) : data.counts.students === 0 ? (
          <Card>
            <EmptyState
              title={isDocente ? "Todavía no tenés alumnos" : "Todavía no hay alumnos"}
              hint={
                isDocente
                  ? "Cuando el administrador de la escuela cargue tu curso, vas a ver acá cómo va cada uno."
                  : "Cargá un curso desde Grupos y el tablero se llena solo."
              }
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Alumnos" value={data.counts.students} hint={`en ${data.counts.groups} grupo${data.counts.groups === 1 ? "" : "s"}`} />
              <Stat label="Entraron hoy" value={data.activeToday} hint={`de ${data.counts.students}`} tone={data.activeToday === 0 ? "warn" : "ok"} />
              <Stat label="Precisión media" value={`${data.avgProgress}%`} hint="sobre lo que ya jugaron" tone={data.avgProgress > 0 && data.avgProgress < 60 ? "warn" : "ok"} />
              <Stat label="Estrellas" value={data.totalStars} hint="ganadas entre todos" tone="star" />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <Roster
                roster={roster}
                groups={(groups ?? []).map((g) => ({ id: g.id, name: g.name }))}
                groupFilter={groupFilter}
                onFilter={setGroupFilter}
                gradeByGroup={gradeByGroup}
              />

              <div className="flex flex-col gap-4">
                <Attention people={needsAttention} total={roster.length} />
                <Week weekly={data.weekly} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Stat({
  label, value, hint, tone = "ok",
}: { label: string; value: number | string; hint?: string; tone?: "ok" | "warn" | "star" }) {
  const color = tone === "warn" ? "#d1436a" : tone === "star" ? "#c98a06" : "#17355f";
  return (
    <Card className="px-4 py-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8a99b5]">{label}</div>
      <div className="font-display mt-0.5 text-[26px] font-extrabold leading-none" style={{ color }}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11.5px] text-[#8a99b5]">{hint}</div>}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function Roster({
  roster, groups, groupFilter, onFilter, gradeByGroup,
}: {
  roster: Overview["roster"];
  groups: { id: string; name: string }[];
  groupFilter: string;
  onFilter: (v: string) => void;
  gradeByGroup: Map<string, string>;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef3f9] px-4 py-3">
        <h2 className="font-display text-[15px] font-bold text-[#17355f]">Alumnos</h2>
        {groups.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <FilterChip label="Todos" on={groupFilter === "todos"} onClick={() => onFilter("todos")} />
            {groups.map((g) => (
              <FilterChip
                key={g.id}
                label={g.name}
                on={groupFilter === g.id}
                onClick={() => onFilter(groupFilter === g.id ? "todos" : g.id)}
              />
            ))}
          </div>
        )}
      </div>

      {roster.length === 0 ? (
        <EmptyState title="Nadie en este grupo" hint="Probá con otro, o sacá el filtro." />
      ) : (
        <ul className="divide-y divide-[#f1f5fa]">
          {roster.map((r) => {
            const grade = r.groupId ? gradeByGroup.get(r.groupId) : undefined;
            const tint = tintForGrade(grade ?? "libre");
            const last = since(r.lastActivity);
            return (
              <li key={r.id}>
                <Link
                  to={`/gestion/alumnos/${r.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#f7fafd]"
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl"
                    style={{ background: tint.soft }}
                  >
                    <img
                      src={islandMapThumb(islandForGrade(grade ?? "libre"))}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="h-9 w-9 object-contain"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold leading-tight text-[#17355f]">
                      {r.fullName}
                    </span>
                    <span className="mt-px block truncate text-[11.5px] text-[#8a99b5]">
                      {r.groupName ?? "Sin grupo"} · <span className={last.stale ? "font-semibold text-[#d1436a]" : ""}>{last.text}</span>
                    </span>
                  </span>

                  {/* Estrellas y niveles: los dos números que el chico
                      también ve, para que docente y alumno hablen igual. */}
                  <span className="hidden w-[5.5rem] shrink-0 text-right sm:block">
                    <span className="text-[13px] font-bold text-[#c98a06]">★ {r.stars}</span>
                    <span className="block text-[11px] text-[#8a99b5]">{r.completedLevels} niveles</span>
                  </span>

                  <span className="hidden w-[6.5rem] shrink-0 md:block">
                    <span className="mb-1 flex justify-between text-[11px]">
                      <span className="text-[#93a5c2]">Precisión</span>
                      <span className="font-bold" style={{ color: r.avgAccuracy < 60 ? "#d1436a" : tint.fg }}>
                        {r.completedLevels === 0 ? "—" : `${r.avgAccuracy}%`}
                      </span>
                    </span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-[#eaf1f9]">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${r.completedLevels === 0 ? 0 : r.avgAccuracy}%`,
                          background: r.avgAccuracy < 60 ? "#f0798f" : tint.bar,
                        }}
                      />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function FilterChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors ${
        on ? "bg-[#3159e8] text-white" : "bg-[#eef3f9] text-[#5b708f] hover:text-[#17355f]"
      }`}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */

/** Quién necesita una mano. Va arriba de todo en la columna derecha
 *  porque es lo único de esta pantalla sobre lo que se ACTÚA. */
function Attention({ people, total }: { people: Overview["roster"]; total: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[#eef3f9] px-4 py-3">
        <h2 className="font-display text-[15px] font-bold text-[#17355f]">Necesitan una mano</h2>
        <p className="mt-0.5 text-[11.5px] text-[#8a99b5]">
          Sin entrar hace una semana, o por debajo del 60 % de precisión.
        </p>
      </div>
      {people.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12.5px] leading-snug text-[#0f8f7c]">
          {total === 0 ? "Todavía no hay alumnos." : "Nadie por ahora. Todos vienen al día."}
        </p>
      ) : (
        <ul className="max-h-[15rem] divide-y divide-[#f1f5fa] overflow-y-auto">
          {people.map((r) => {
            const last = since(r.lastActivity);
            return (
              <li key={r.id}>
                <Link
                  to={`/gestion/alumnos/${r.id}`}
                  className="flex items-center gap-2 px-4 py-2 transition-colors hover:bg-[#fff7f9]"
                >
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#17355f]">
                    {r.fullName}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-[#d1436a]">
                    {last.stale ? last.text : `${r.avgAccuracy}%`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

/** Actividad de los últimos siete días. Barras y no números porque la
 *  pregunta es "¿vienen seguido?", que se contesta con la forma. */
function Week({ weekly }: { weekly: Overview["weekly"] }) {
  const max = Math.max(1, ...weekly.map((d) => d.count));
  const total = weekly.reduce((a, d) => a + d.count, 0);
  return (
    <Card className="px-4 py-3.5">
      <h2 className="font-display text-[15px] font-bold text-[#17355f]">Esta semana</h2>
      <p className="mt-0.5 text-[11.5px] text-[#8a99b5]">
        {total === 0 ? "Sin actividad en los últimos 7 días." : `${total} niveles jugados`}
      </p>
      <div className="mt-3 flex h-[70px] items-end gap-1.5">
        {weekly.map((d) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-[#33c7f0] to-[#5be8ba]"
              style={{ height: `${Math.max(2, (d.count / max) * 56)}px` }}
              title={`${d.label}: ${d.count}`}
            />
            <span className="text-[10px] text-[#9fb0c9]">{d.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
