/* Ficha de un alumno — por dónde va y qué le cuesta.
 *
 * La abre el docente desde el tablero, y también el admin y el superadmin:
 * la API decide el alcance (un docente solo llega a alumnos de SUS grupos)
 * y devuelve 403 si no corresponde, así que la pantalla es la misma.
 *
 * **Se lee en el vocabulario del juego, no en el de la base.** Las islas se
 * nombran por su mundo pedagógico ("Mundo 3 · Palabras") y se muestran con
 * su arte, porque es lo que el chico nombra cuando cuenta dónde está. Un
 * `island7` en una ficha obliga al docente a traducir.
 *
 * El orden de la pantalla es el de las preguntas reales: dónde está, cómo
 * le está yendo, qué islas ya hizo, y recién al final el detalle nivel por
 * nivel — que es para cuando algo no cierra.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { StudentDetail } from "../../utils/api";
import { api, ApiError } from "../../utils/api";
import { useAuth } from "../../hooks/useAuth";
import { islandMapThumb } from "../../utils/assets";
import { WORLD_TOPICS, pedagogyOrderOf } from "../../data/worlds";
import type { Activity } from "../../data/activities";
import { canResetPassword } from "./permissions";
import { Button, Card, EmptyState, ErrorBanner, PageBody, Spinner } from "./ui";

type WorldId = Activity["worldId"];

/** "Mundo 3 · Palabras". El número es el pedagógico, no el del id: el
 *  `island7` es el cuarto que juega un chico, y decirle "7" lo confunde. */
function worldLabel(worldId: string): string {
  const n = pedagogyOrderOf(worldId as WorldId);
  const topic = WORLD_TOPICS[worldId as WorldId];
  if (!n) return topic ?? worldId;
  return `Mundo ${n}${topic ? ` · ${topic}` : ""}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMinutes(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function StudentDetailPage() {
  const { studentId = "" } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<StudentDetail | null>(null);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await api.student(studentId));
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError ? err.message : "No pudimos cargar la ficha.");
    }
  }, [studentId]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const mayReset = canResetPassword(user?.role ?? "alumno", "alumno", false);

  async function reset() {
    setBusy(true);
    try {
      const res = await api.resetPassword(studentId);
      setIssued(res.temporaryPassword);
      setConfirming(false);
      setCopied(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos restablecer la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <PageBody>
        <BackLink />
        <ErrorBanner message={error} onRetry={() => void load()} />
      </PageBody>
    );
  }

  if (!data) {
    return (
      <PageBody>
        <div className="flex items-center gap-2 py-10 text-sm text-[#667085]">
          <Spinner /> Cargando la ficha…
        </div>
      </PageBody>
    );
  }

  const { student, stats, byWorld, timeline } = data;
  const nuncaJugo = stats.completedLevels === 0 && stats.totalAttempts === 0;

  return (
    <PageBody>
      <BackLink />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.018em] text-[#133463]">
            {student.fullName}
          </h1>
          <p className="mt-0.5 text-[13px] text-[#52719e]">
            <span className="font-mono">{student.username}</span>
            {student.groupName && <> · {student.groupName}</>}
            {" · "}Último ingreso: {fmtDate(student.lastLoginAt)}
          </p>
        </div>
        {mayReset && !issued && !confirming && (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Restablecer contraseña
          </Button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {confirming && (
        <div className="mb-4 rounded-xl bg-[#fff8e8] px-4 py-3.5">
          <p className="text-[13px] leading-snug text-[#8a6420]">
            Se genera una contraseña temporal para <b>{student.fullName}</b>. Se le corta la sesión
            y va a tener que elegir una nueva al entrar. Su progreso no se toca.
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button variant="primary" loading={busy} onClick={() => void reset()}>Restablecer</Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>Cancelar</Button>
          </div>
        </div>
      )}

      {issued && (
        <div className="mb-4 rounded-xl bg-[#eef7f4] px-4 py-3.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#0f8f7c]">
            Contraseña temporal de {student.username}
          </div>
          <div className="mt-1 select-all font-mono text-[19px] font-bold tracking-wide text-[#17355f]">
            {issued}
          </div>
          <p className="mt-1 text-[12px] text-[#5b708f]">
            Se muestra una sola vez y no queda guardada. Anotala antes de cerrar.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${student.fullName}\t${student.username}\t${issued}`);
                  setCopied(true);
                } catch { /* queda a la vista para anotarla */ }
              }}
            >
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button variant="ghost" onClick={() => setIssued(null)}>Listo</Button>
          </div>
        </div>
      )}

      {nuncaJugo ? (
        <Card>
          <EmptyState
            title="Todavía no jugó ningún nivel"
            hint="Cuando entre al juego por primera vez, acá vas a ver por dónde va, cuántas estrellas lleva y qué islas le costaron."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Dónde está AHORA. Es la primera pregunta que hace un docente. */}
          <Card className="flex flex-wrap items-center gap-4 p-4">
            {stats.currentWorld && (
              <span className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-[18px] bg-[#eef3f9]">
                <img
                  src={islandMapThumb(stats.currentWorld)}
                  alt=""
                  aria-hidden="true"
                  className="h-[66px] w-[66px] object-contain"
                />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8a99b5]">
                Va por
              </div>
              <div className="font-display text-[19px] font-bold leading-tight text-[#17355f]">
                {stats.currentWorld ? worldLabel(stats.currentWorld) : "Todavía no arrancó"}
              </div>
              {stats.currentWorld && (
                <div className="mt-0.5 text-[13px] text-[#52719e]">Nivel {stats.currentLevel}</div>
              )}
            </div>
            <div className="flex gap-2.5">
              <Mini label="estrellas" value={`★ ${stats.stars}`} tone="#c98a06" />
              <Mini label="niveles" value={stats.completedLevels} />
              <Mini label="precisión" value={`${stats.avgAccuracy}%`} tone={stats.avgAccuracy < 60 ? "#d1436a" : undefined} />
              <Mini label="racha" value={`${stats.streakDays} d`} />
              <Mini label="jugado" value={fmtMinutes(stats.totalSeconds)} />
            </div>
          </Card>

          {byWorld.length > 0 && (
            <Card className="overflow-hidden">
              <h2 className="border-b border-[#eef3f9] px-4 py-3 font-display text-[15px] font-bold text-[#17355f]">
                Por isla
              </h2>
              <ul className="divide-y divide-[#f1f5fa]">
                {byWorld.map((w) => (
                  <li key={w.worldId} className="flex items-center gap-3 px-4 py-2.5">
                    <img
                      src={islandMapThumb(w.worldId)}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="h-9 w-9 shrink-0 object-contain"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#17355f]">
                      {worldLabel(w.worldId)}
                    </span>
                    <span className="shrink-0 text-[12px] text-[#8a99b5]">
                      {w.completed} nivel{w.completed === 1 ? "" : "es"}
                    </span>
                    <span
                      className="w-[3.2rem] shrink-0 text-right text-[13px] font-bold"
                      style={{ color: w.avgAccuracy < 60 ? "#d1436a" : "#17355f" }}
                    >
                      {w.avgAccuracy}%
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {timeline.length > 0 && (
            <Card className="overflow-hidden">
              <h2 className="border-b border-[#eef3f9] px-4 py-3 font-display text-[15px] font-bold text-[#17355f]">
                Últimos intentos
              </h2>
              <ul className="max-h-[22rem] divide-y divide-[#f1f5fa] overflow-y-auto">
                {timeline.map((t, i) => (
                  <li key={`${t.worldId}-${t.levelNumber}-${t.at}-${i}`} className="flex items-center gap-3 px-4 py-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${t.completed ? "bg-[#22c7b8]" : "bg-[#f0798f]"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#17355f]">
                      {worldLabel(t.worldId)} · nivel {t.levelNumber}
                    </span>
                    <span className="shrink-0 text-[12px] text-[#8a99b5]">
                      {t.errorCount} error{t.errorCount === 1 ? "" : "es"}
                    </span>
                    <span
                      className="w-[3.2rem] shrink-0 text-right text-[12.5px] font-bold"
                      style={{ color: t.accuracy < 60 ? "#d1436a" : "#17355f" }}
                    >
                      {t.accuracy}%
                    </span>
                    <span className="hidden w-[5.5rem] shrink-0 text-right text-[11.5px] text-[#9fb0c9] sm:block">
                      {fmtDate(t.at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </PageBody>
  );
}

function BackLink() {
  return (
    <Link to="/gestion/tablero" className="mb-3 inline-block text-sm font-semibold text-[#3159e8] hover:underline">
      ← Volver al tablero
    </Link>
  );
}

function Mini({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <span className="rounded-xl bg-[#f2f7fd] px-3 py-1.5 text-center">
      <span className="block text-[14px] font-bold leading-none" style={{ color: tone ?? "#17355f" }}>
        {value}
      </span>
      <span className="mt-0.5 block text-[10.5px] text-[#8a99b5]">{label}</span>
    </span>
  );
}
