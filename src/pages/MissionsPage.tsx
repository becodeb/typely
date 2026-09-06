import { useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Flag,
  MapPin,
  Sparkles,
  Star,
  Target,
  Trophy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { StarCounter } from "../components/common/StarCounter";
import { assets } from "../utils/assets";
import { useAuth } from "../hooks/useAuth";
import { getUserContext } from "../utils/userContext";
import { activitiesByWorld, type Activity } from "../data/activities";
import {
  getCurrentLevelNumber,
  isLevelCompleted,
  loadProgress,
  type CurriculumProgress,
} from "../utils/progress";
import {
  getWorldStatesForUser,
  getWorldsForUser,
  worldStarProgress,
  type World,
  type WorldLockState,
} from "../data/worlds";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Returns the first not-yet-completed activity of the given world, so the
 *  "continue" button can deep-link straight into gameplay. Falls back to
 *  the very last activity if the world is already complete (so the user
 *  still has a clear CTA — "replay" — instead of a dead button). */
function currentActivityFor(
  worldId: Activity["worldId"],
  progress: CurriculumProgress,
): Activity | null {
  const activities = activitiesByWorld[worldId] ?? [];
  if (activities.length === 0) return null;
  const currentLevel = getCurrentLevelNumber(progress, worldId);
  const found = activities.find((a) => a.levelNumber === currentLevel);
  if (found) return found;
  return activities[activities.length - 1];
}

/** Aggregate progress across the worlds the user can see. */
function summarizeWorlds(worlds: World[], states: Record<string, WorldLockState>, progress: CurriculumProgress) {
  let completedWorlds = 0;
  let totalStars = 0;
  let possibleStars = 0;
  for (const w of worlds) {
    const starInfo = worldStarProgress(w.id, progress);
    totalStars += starInfo.earnedStars;
    possibleStars += starInfo.totalStars;
    if (states[w.slug] === "completed") completedWorlds += 1;
  }
  return {
    totalWorlds: worlds.length,
    completedWorlds,
    totalStars,
    possibleStars,
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function MissionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  /* Memoized reads: same pattern as WorldsPage so progress / world
     resolution is stable across re-renders. */
  const context = useMemo(() => getUserContext(user), [user]);
  const progress = useMemo(() => loadProgress(), [user]);
  const visibleWorlds = useMemo(
    () => getWorldsForUser(context, progress),
    [context, progress],
  );
  const worldStates = useMemo(
    () => getWorldStatesForUser(context, progress),
    [context, progress],
  );

  const summary = useMemo(
    () => summarizeWorlds(visibleWorlds, worldStates, progress),
    [visibleWorlds, worldStates, progress],
  );

  /* The "current" world for the kid is the first one in difficulty order
     that is unlocked but not yet completed. */
  const currentWorld = useMemo(
    () =>
      visibleWorlds.find((w) => worldStates[w.slug] === "current") ??
      visibleWorlds.find((w) => worldStates[w.slug] === "completed") ??
      visibleWorlds[0] ??
      null,
    [visibleWorlds, worldStates],
  );

  const currentActivity = useMemo(
    () => (currentWorld ? currentActivityFor(currentWorld.id, progress) : null),
    [currentWorld, progress],
  );

  /* For the "next locked" world → show it so the kid knows what's coming. */
  const nextLockedWorld = useMemo(
    () => visibleWorlds.find((w) => worldStates[w.slug] === "locked") ?? null,
    [visibleWorlds, worldStates],
  );

  const overallPercent = summary.possibleStars
    ? Math.round((summary.totalStars / summary.possibleStars) * 100)
    : 0;

  const currentWorldStarInfo = currentWorld
    ? worldStarProgress(currentWorld.id, progress)
    : null;
  const currentWorldPercent = currentWorldStarInfo
    ? Math.round((currentWorldStarInfo.earnedStars / currentWorldStarInfo.totalStars) * 100)
    : 0;
  const starsToUnlockNext = currentWorldStarInfo
    ? Math.max(0, currentWorldStarInfo.requiredStars - currentWorldStarInfo.earnedStars)
    : 0;

  /* Friendly label for the current activity so the kid knows what they're
     about to play. */
  const missionHeadline = currentActivity
    ? isLevelCompleted(progress, currentActivity.worldId, currentActivity.levelNumber)
      ? `¡${currentActivity.title} listo!`
      : `Seguí con: ${currentActivity.title}`
    : "¡Mirá tu próxima misión!";

  const missionDescription = currentActivity?.subtitle ?? "Tocá Jugar para seguir aprendiendo.";

  function continueNow() {
    if (!currentWorld) return;
    if (currentActivity) {
      navigate(`/gameplay/${currentActivity.id}`);
    } else {
      navigate(currentWorld.route);
    }
  }

  return (
    <main
      className="relative min-h-dvh flex flex-col items-center gap-6 p-6 pb-12 animate-page-fade bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url("${assets.homeBg}")` }}
    >
      {/* Contador de estrellas de la cuenta (siempre visible, arriba a la derecha). */}
      <StarCounter className="fixed top-4 right-4 z-30" />
      {/* ── Page header ── */}
      <header className="w-full max-w-3xl flex flex-col items-start gap-3">
        <Button variant="secondary" onClick={() => navigate("/mundos")}>
          <ArrowLeft size={20} />
          Volver a mundos
        </Button>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-accent-strong">TYPELY</span>
          <h1 className="text-3xl sm:text-4xl font-black font-display text-text">Misiones</h1>
          <p className="text-muted font-bold">Tu aventura, un nivel a la vez.</p>
        </div>
      </header>

      {/* ── Hero: adventure summary ── */}
      <section
        className="w-full max-w-3xl glass-card-smooth tarjeta-marca p-6 flex flex-col sm:flex-row gap-5 animate-card-in"
        aria-label="Resumen de tu aventura"
      >
        <div
          className="grid place-items-center w-16 h-16 rounded-2xl bg-amber-200/40 text-amber-600 shrink-0"
          aria-hidden="true"
        >
          <Trophy size={36} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-accent-strong">
            Tu aventura
          </span>
          <h2 className="text-2xl font-black font-display text-text flex items-center flex-wrap gap-1">
            {summary.completedWorlds}/{summary.totalWorlds} mundos
            <span className="inline-flex items-center gap-1 text-amber-500 ml-1 animate-star-pop">
              <Star size={20} fill="currentColor" />
              {summary.totalStars}
            </span>
          </h2>
          <p className="text-muted font-bold text-sm">
            Sumaste {summary.totalStars} estrellas de {summary.possibleStars} posibles · {overallPercent}% del viaje.
          </p>
          <div
            className="h-2 rounded-full bg-white/30 overflow-hidden mt-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={overallPercent}
          >
            <span
              className="block h-full rounded-full bg-gradient-to-r from-accent-sky to-accent transition-[width]"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>
      </section>

      {/* ── Featured: mission of the day ── */}
      <section
        className="w-full max-w-3xl glass-card tarjeta-marca p-5 rounded-2xl relative overflow-hidden animate-mission-rise"
        aria-label="Misión del día"
      >
        {/* Background halo decoration */}
        <div
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-accent-sky/20 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-bold w-fit">
            <Sparkles size={16} />
            Misión del día
          </span>

          <h2 className="text-2xl font-black font-display text-text">{missionHeadline}</h2>
          <p className="text-muted font-bold text-sm">{missionDescription}</p>

          {currentWorld && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 text-accent-strong text-xs font-bold">
                <MapPin size={16} />
                {currentWorld.title}
              </span>
              {currentActivity && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 text-muted text-xs font-bold">
                  <Target size={16} />
                  Nivel {currentActivity.levelNumber}
                </span>
              )}
              {currentWorldStarInfo && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 text-muted text-xs font-bold">
                  <Star size={16} fill="currentColor" />
                  {currentWorldStarInfo.earnedStars}/{currentWorldStarInfo.totalStars} ★
                </span>
              )}
            </div>
          )}

          {currentWorld && currentWorldStarInfo && currentWorldStarInfo.earnedStars < currentWorldStarInfo.totalStars && (
            <div
              className="h-2 rounded-full bg-white/30 overflow-hidden mt-1"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={currentWorldPercent}
              aria-label={`Progreso en ${currentWorld.title}`}
            >
              <span
                className="block h-full rounded-full bg-gradient-to-r from-accent-sky to-accent transition-[width]"
                style={{ width: `${currentWorldPercent}%` }}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-2">
            <Button onClick={continueNow} disabled={!currentWorld || !currentActivity}>
              {currentActivity && isLevelCompleted(progress, currentActivity.worldId, currentActivity.levelNumber)
                ? "Volver a jugar"
                : "Jugar ahora"}
              <ArrowRight size={20} />
            </Button>
            {currentWorld && (
              <Button variant="secondary" onClick={() => navigate(currentWorld.route)}>
                Ver la isla
                <Compass size={18} />
              </Button>
            )}
          </div>

          {currentWorldStarInfo && starsToUnlockNext > 0 && nextLockedWorld && (
            <p className="text-sm text-muted font-bold animate-soft-hint-in">
              Te faltan <strong>{starsToUnlockNext}★</strong> para desbloquear{" "}
              <strong>{nextLockedWorld.title}</strong>.
            </p>
          )}
        </div>
      </section>

      {/* ── World cards grid ── */}
      <section className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-label="Mundos en curso">
        {visibleWorlds.map((world) => {
          const state = worldStates[world.slug] as WorldLockState | undefined;
          const stars = worldStarProgress(world.id, progress);
          const worldPercent = stars.totalStars
            ? Math.round((stars.earnedStars / stars.totalStars) * 100)
            : 0;
          const isCurrent = state === "current";
          const isDone = state === "completed";
          const isLocked = state === "locked";

          const stateClasses = isCurrent
            ? "ring-2 ring-violet-400"
            : isDone
              ? "ring-2 ring-emerald-400 opacity-80"
              : isLocked
                ? "opacity-50 grayscale-[0.6]"
                : "";

          const numBg = isDone
            ? "bg-mint"
            : isLocked
              ? "bg-gray-300"
              : "bg-accent-sky";

          return (
            <article
              key={world.id}
              className={`glass-surface tarjeta-marca p-4 rounded-2xl flex flex-col gap-3 ${stateClasses}`}
            >
              <header className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full grid place-items-center text-white font-extrabold text-sm ${numBg}`}>
                  M{world.displayNumber}
                </span>
                <h3 className="text-sm font-extrabold font-display text-text">{world.title}</h3>
              </header>

              <p className="text-sm text-muted font-bold">{world.topic}</p>

              <div
                className="h-2 rounded-full bg-white/30 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={worldPercent}
                aria-label={`Estrellas en ${world.title}`}
              >
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-accent-sky to-accent transition-[width]"
                  style={{ width: `${worldPercent}%` }}
                />
              </div>

              <footer className="flex items-center justify-between text-xs font-bold mt-auto">
                <span className="inline-flex items-center gap-1 text-amber-500">
                  <Star size={14} fill="currentColor" />
                  {stars.earnedStars}/{stars.totalStars}
                </span>
                <span className="inline-flex items-center gap-1 text-text">
                  {isDone && (
                    <>
                      <CheckCircle2 size={16} className="text-mint" />
                      Completado
                    </>
                  )}
                  {isCurrent && (
                    <>
                      <Flag size={16} className="text-violet-500" />
                      En curso
                    </>
                  )}
                  {isLocked && <>Bloqueado</>}
                </span>
              </footer>
            </article>
          );
        })}
      </section>

      {/* ── Footnote ── */}
      <p className="text-sm text-muted font-bold text-center max-w-3xl">
        Cada mundo te pide juntar el 70% de las estrellas para abrir el siguiente. ¡Vamos!
      </p>

      {/* ── Floating star decorations ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden="true">
        <Star
          size={22}
          fill="currentColor"
          className="absolute top-[12%] left-[8%] text-amber-300/50 animate-mascot-float"
          style={{ animationDelay: "0s" }}
        />
        <Star
          size={16}
          fill="currentColor"
          className="absolute top-[28%] right-[12%] text-accent-pink/40 animate-mascot-float"
          style={{ animationDelay: "1.2s" }}
        />
        <Star
          size={18}
          fill="currentColor"
          className="absolute bottom-[18%] left-[15%] text-accent-sky/40 animate-mascot-float"
          style={{ animationDelay: "2.4s" }}
        />
      </div>
    </main>
  );
}
