import { activitiesByWorld, type Activity } from "../data/activities";
import { api, getAccessToken, type ProgressItem } from "./api";
import { isDemoMode } from "./storage";

export type WorldKey = Activity["worldId"];

export interface LevelProgress {
  completed: boolean;
  bestAccuracy: number;
  attempts: number;
}

export type WorldProgress = Record<number, LevelProgress>;
export type CurriculumProgress = Record<WorldKey, WorldProgress>;

const STORAGE_KEY = "edutic_progress_v1";

function emptyWorld(): WorldProgress {
  return {};
}

function defaultProgress(): CurriculumProgress {
  return {
    island1: emptyWorld(),
    island2: emptyWorld(),
    island3: emptyWorld(),
    island4: emptyWorld(),
    island5: emptyWorld(),
    island6: emptyWorld(),
    island7: emptyWorld(),
    island8: emptyWorld(),
    island9: emptyWorld(),
    island10: emptyWorld(),
    island11: emptyWorld(),
    island12: emptyWorld(),
    island13: emptyWorld(),
    island14: emptyWorld(),
    island15: emptyWorld(),
  };
}

export function loadProgress(): CurriculumProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<CurriculumProgress>;
    return {
      ...defaultProgress(),
      ...parsed,
    } as CurriculumProgress;
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress: CurriculumProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  /* Notify live UI (the global StarCounter) that the cumulative star total may
     have changed, so it bumps the instant a level is completed. Covers every
     mutation path since markLevelComplete / resetProgress both call this. */
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("edutic:progress"));
  }
}

/* ===================================================================
   SINCRONIZACIÓN CON EL SERVIDOR

   El camino caliente sigue siendo local: al terminar un nivel se escribe
   en localStorage y la pantalla responde al instante, sin esperar la red.
   El envío al servidor va por una COLA.

   Por qué una cola. Antes el envío era `api.post(...).catch(() => [])`:
   si el alumno estaba sin red —una sala con wifi flojo, que es el caso
   normal en una escuela— ese nivel se perdía para siempre y nadie se
   enteraba. Ahora el intento queda encolado y se reintenta al terminar el
   siguiente nivel, al volver la conexión o al recargar la página.

   El reintento es seguro porque el endpoint es idempotente: el servidor
   guarda el MEJOR resultado por nivel, así que reenviar algo ya registrado
   no lo duplica ni lo empeora.
   =================================================================== */

const QUEUE_KEY = "typely_progress_queue_v1";

function readQueue(): ProgressItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ProgressItem[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: ProgressItem[]) {
  try {
    /* Tope defensivo: si alguien juega semanas sin conexión, no dejamos que
       la cola crezca sin límite. Se conservan los más recientes. */
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-200)));
  } catch {
    /* Sin espacio: preferimos perder la cola antes que romper el juego. */
  }
}

/** ¿Esta sesión manda progreso al servidor? El demo no tiene cuenta. */
function syncEnabled(): boolean {
  return Boolean(getAccessToken()) && !isDemoMode();
}

let flushing = false;

/** Vacía la cola. Devuelve los logros recién desbloqueados. */
export async function flushProgressQueue(): Promise<string[]> {
  if (flushing || !syncEnabled()) return [];
  const pending = readQueue();
  if (!pending.length) return [];

  flushing = true;
  try {
    const res = await api.postProgress(pending);
    /* Solo se borra lo que se envió: si mientras tanto se encoló algo más,
       eso queda para la próxima vuelta. */
    writeQueue(readQueue().slice(pending.length));
    return res.unlockedAchievements ?? [];
  } catch {
    /* Queda encolado para el próximo intento. */
    return [];
  } finally {
    flushing = false;
  }
}

/** Trae el progreso del servidor y lo fusiona con lo local.
 *
 *  Esto es lo que hace que el progreso sobreviva a cambiar de computadora
 *  o a borrar el caché. El endpoint existía desde el principio y no lo
 *  llamaba nadie. Se queda siempre el MEJOR resultado de cada lado, así
 *  que jugar sin conexión y sincronizar después nunca pierde nada. */
export async function hydrateProgress(): Promise<void> {
  if (!syncEnabled()) return;
  try {
    const remote = await api.myProgress();
    const local = loadProgress();
    for (const row of remote) {
      const world = (local[row.worldId as WorldKey] ??= {});
      const mine = world[row.levelNumber];
      world[row.levelNumber] = {
        completed: mine?.completed || row.completed,
        bestAccuracy: Math.max(mine?.bestAccuracy ?? 0, row.bestAccuracy),
        attempts: Math.max(mine?.attempts ?? 0, row.attempts),
      };
    }
    saveProgress(local);
  } catch {
    /* Sin red: se sigue con lo local, que es lo que el juego necesita. */
  }
}

export function markLevelComplete(
  worldId: WorldKey,
  levelNumber: number,
  accuracy: number,
  attempts: number,
): Promise<string[]> {
  const progress = loadProgress();
  const previous = progress[worldId]?.[levelNumber];
  const best = Math.max(previous?.bestAccuracy ?? 0, accuracy);
  progress[worldId] = {
    ...progress[worldId],
    [levelNumber]: { completed: true, bestAccuracy: best, attempts },
  };
  saveProgress(progress);

  if (!syncEnabled()) return Promise.resolve([]);

  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - 60_000);
  writeQueue([
    ...readQueue(),
    {
      worldId,
      levelNumber,
      accuracy: Math.round(accuracy),
      errorCount: Math.max(0, Math.round((100 - accuracy) / 8)),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
    },
  ]);

  return flushProgressQueue();
}

/* Al volver la conexión, se intenta vaciar lo pendiente sin que el alumno
   tenga que hacer nada. */
if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flushProgressQueue());
}

export function isLevelCompleted(progress: CurriculumProgress, worldId: WorldKey, levelNumber: number): boolean {
  return Boolean(progress[worldId]?.[levelNumber]?.completed);
}

/* ===================================================================
   STAR SCORING  &  WORLD-UNLOCK BY STARS
   - THREE_STAR_ACCURACY: 85% accuracy (or more) always gives 3 stars.
   - "Best stars per level": stars are derived from each level's BEST stored
     accuracy (markLevelComplete already keeps the best), so repeated attempts
     never stack — only the best result per level counts. Re-passing a 2★ level
     as 3★ therefore adds exactly 1 to the account total, never another 3.
   - CUMULATIVE ACCOUNT TOTAL (`getTotalStars`): the sum of best stars over every
     level in every world. This is the single number shown in the StarCounter.
   - WORLD UNLOCK (handled in `data/worlds.ts`): a world unlocks once the account
     total reaches the sum of the MAX stars of all worlds before it (world 2 needs
     world 1's max, world 3 needs world 1 + world 2's max, …). Entering a world
     never spends stars — it is a pure threshold check against the running total.
   - UNLOCK_STAR_THRESHOLD / WorldStarProgress.requiredStars are legacy per-world
     figures kept only for the informational "x/y stars" chips, NOT the gate.
=================================================================== */
export const MAX_STARS_PER_LEVEL = 3;
export const THREE_STAR_ACCURACY = 85; // percent
export const UNLOCK_STAR_THRESHOLD = 0.7;

/** Maps an accuracy percentage (0-100) to a star count (1-3).
 *  Finishing a level always grants at least 1 star:
 *    85%+ → 3 stars · 45%+ → 2 · below 45% → 1. */
export function getStarsFromAccuracy(accuracyPercent: number): number {
  if (accuracyPercent >= THREE_STAR_ACCURACY) return 3;
  if (accuracyPercent >= 45) return 2;
  return 1;
}

/** Best stars earned in a single level (0 if never completed).
 *  Uses the best stored accuracy, so repeats use the best result only. */
export function getBestStarsForLevel(
  progress: CurriculumProgress,
  worldId: WorldKey,
  levelNumber: number,
): number {
  const level = progress[worldId]?.[levelNumber];
  if (!level?.completed) return 0;
  return getStarsFromAccuracy(level.bestAccuracy);
}

/** Max stars obtainable in a world = number of levels × 3. */
export function getWorldMaxStars(worldId: WorldKey): number {
  return (activitiesByWorld[worldId]?.length ?? 0) * MAX_STARS_PER_LEVEL;
}

/** Account-wide cumulative star counter: the sum of the BEST stars earned in
 *  every level of every world. This is the running total shown in the
 *  StarCounter and used as the world-unlock gate. Because it is re-derived from
 *  best accuracy each time, a level only ever contributes its best result. */
export function getTotalStars(progress: CurriculumProgress = loadProgress()): number {
  let total = 0;
  for (const worldId of Object.keys(activitiesByWorld) as WorldKey[]) {
    for (const activity of activitiesByWorld[worldId]) {
      total += getBestStarsForLevel(progress, worldId, activity.levelNumber);
    }
  }
  return total;
}

/* ===================================================================
   CHARACTER SKIN PROGRESSION (by cumulative star total)
   The student's character + ship change art as the account-wide star total
   (`getTotalStars`) crosses these thresholds. Five phases (f1…f5):
     0★ → f1 · 5★ → f2 · 10★ → f3 · 20★ → f4 · 30★ → f5.
   The evolution "tier" (base vs. future evo) is a separate axis resolved in
   assets.ts (`characterSkins` / `skinUrl`).
=================================================================== */
export const SKIN_PHASE_THRESHOLDS = [0, 5, 10, 20, 30] as const;

/** Phase index 0..4 (f1..f5) for a cumulative star total. Defaults to the live
 *  account total read from storage. */
export function getSkinPhaseIndex(totalStars: number = getTotalStars()): number {
  let phase = 0;
  for (let i = 0; i < SKIN_PHASE_THRESHOLDS.length; i++) {
    if (totalStars >= SKIN_PHASE_THRESHOLDS[i]) phase = i;
  }
  return phase;
}

export interface SkinPhaseProgress {
  /** Current phase index 0..4 (f1..f5). */
  phaseIndex: number;
  totalStars: number;
  /** Star total where the CURRENT phase began (0 for f1). */
  prevThreshold: number;
  /** Star total that unlocks the NEXT phase, or null at max phase. */
  nextThreshold: number | null;
  isMax: boolean;
}

/** Progress toward the next skin phase — drives the SkinProgressBar
 *  ("27/30 ⭐" + the mystery-character teaser). */
export function getSkinPhaseProgress(totalStars: number = getTotalStars()): SkinPhaseProgress {
  const phaseIndex = getSkinPhaseIndex(totalStars);
  const isMax = phaseIndex >= SKIN_PHASE_THRESHOLDS.length - 1;
  return {
    phaseIndex,
    totalStars,
    prevThreshold: SKIN_PHASE_THRESHOLDS[phaseIndex],
    nextThreshold: isMax ? null : SKIN_PHASE_THRESHOLDS[phaseIndex + 1],
    isMax,
  };
}

export interface WorldStarProgress {
  earnedStars: number;
  totalStars: number;
  requiredStars: number;
  /** true once earnedStars ≥ requiredStars → the next world may unlock. */
  isUnlockedNext: boolean;
}

/** Star progress for a world: sum of best stars per level vs. the 70% gate. */
export function getWorldStarProgress(
  progress: CurriculumProgress,
  worldId: WorldKey,
): WorldStarProgress {
  const levels = activitiesByWorld[worldId] ?? [];
  const totalStars = levels.length * MAX_STARS_PER_LEVEL;
  const earnedStars = levels.reduce(
    (sum, activity) => sum + getBestStarsForLevel(progress, worldId, activity.levelNumber),
    0,
  );
  const requiredStars = Math.ceil(totalStars * UNLOCK_STAR_THRESHOLD);
  return {
    earnedStars,
    totalStars,
    requiredStars,
    isUnlockedNext: earnedStars >= requiredStars,
  };
}

export function getCurrentLevelNumber(progress: CurriculumProgress, worldId: WorldKey): number {
  const worldActivities = activitiesByWorld[worldId];
  for (const activity of worldActivities) {
    if (!isLevelCompleted(progress, worldId, activity.levelNumber)) {
      return activity.levelNumber;
    }
  }
  return worldActivities[worldActivities.length - 1].levelNumber;
}

export function levelState(
  progress: CurriculumProgress,
  worldId: WorldKey,
  levelNumber: number,
): "Completado" | "Actual" | "Bloqueado" {
  if (isLevelCompleted(progress, worldId, levelNumber)) return "Completado";
  const current = getCurrentLevelNumber(progress, worldId);
  if (levelNumber === current) return "Actual";
  return "Bloqueado";
}

export function resetProgress() {
  saveProgress(defaultProgress());
}

/** Clears ONLY the level/star progress used by demo mode.
 *  Removes the single progress key — never the whole localStorage, and never
 *  user/teacher/class/active-session keys. Safe for "Empezar de cero" in demo
 *  without touching admin, teacher or any real account data. */
export function clearDemoProgressOnly() {
  localStorage.removeItem(STORAGE_KEY);
}
