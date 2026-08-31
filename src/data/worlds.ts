import { activitiesByWorld, WORLD_PEDAGOGY_ORDER, type Activity } from "./activities";
import { islandLevelLayouts, type LevelPosition } from "./levelPositions";
import { islandArt, islandGameplayBg, islandMapThumb } from "../utils/assets";
import {
  getBestStarsForLevel,
  getTotalStars,
  getWorldMaxStars,
  getWorldStarProgress,
  isLevelCompleted,
  levelState,
  loadProgress,
  type CurriculumProgress,
  type WorldStarProgress,
} from "../utils/progress";
import { getVisibleWorldIds, type UserContext } from "../utils/userContext";


export type LevelState = "Completado" | "Actual" | "Bloqueado";

export type Level = {
  title: string;
  name: string;
  state: LevelState;
  description: string;
  activityId: string;
  levelNumber: number;
  /** Best stars earned in this level (0-3), derived from best accuracy. */
  stars: number;
};

/* Level marker positions now live in their own config — see
   src/data/levelPositions.ts. Re-exported here so existing importers
   (IslandDetailPage etc.) keep working unchanged. */
export type { LevelPosition };

/* Position of an island on the horizontally-scrolling world map.
   `x` is in viewport-width units (vw) measured along the whole track, so the
   first worlds keep their original on-screen spots and later worlds continue
   to the right. `y` is a vertical % within the viewport. */
export type MapPosition = {
  x: number;
  y: number;
};

export type World = {
  id: Activity["worldId"];
  slug: Activity["worldId"];
  title: string;
  /** Short topic/theme label shown to teachers (e.g. "Atajos de teclado"). */
  topic: string;
  /** 1-based difficulty order (position in WORLD_ORDER).
   *  Same value as `order` for the free path; a course-path student may
   *  see a smaller set of these but the number itself is the canonical
   *  pedagogical position. */
  order: number;
  /** "Mundo N" label in the same pedagogical position as `order`. */
  displayNumber: number;
  thumbnail: string;
  background: string;
  /** Background painted behind the actual typing/shortcut gameplay screen. */
  gameplayBg: string;
  route: string;
  levels: Level[];
  levelPositions: LevelPosition[];
  map: MapPosition;
};

/* Teacher-facing topic/theme per world. */
export const WORLD_TOPICS: Record<Activity["worldId"], string> = {
  island1: "Escritura — primeras teclas",
  island6: "Escritura",
  island2: "Palabras",
  island7: "Palabras largas",
  island13: "Mensajes",
  island3: "Signos y tildes",
  island8: "Signos",
  island4: "Símbolos y código",
  island9: "Mails",
  island10: "Búsquedas en navegador",
  island5: "Mouse y habilidades digitales",
  island11: "Comandos básicos",
  island12: "Ventanas y pestañas",
  island14: "Comandos avanzados",
  island15: "Reto final",
};

type WorldMetaEntry = {
  title: string;
  thumbnail: string;
  background: string;
  gameplayBg: string;
  positions: LevelPosition[];
  map: MapPosition;
};

/* Titles for the 10 expansion islands, in island6 → island15 order. */

/* =====================================================================
   Pedagogical world order (difficulty, easiest → hardest).
   Copia legible de WORLD_PEDAGOGY_ORDER, que es la fuente de verdad — si
   se cambia una, hay que cambiar la otra:
     1  island1  – basic letters / home row / vowels
     2  island6  – writing: syllables → short words
     3  island2  – short words (3–6 letters, phrases)
     4  island7  – long words + longer phrases
     5  island13 – friendly messages in context
     6  island5  – digital / mouse skills
     7  island3  – library: uppercase, ñ, accents, ¿¡
     8  island8  – signs / punctuation
     9  island9  – email writing
    10  island4  – symbols / code (@ + full punctuation mix)
    11  island10 – browser searches
    12  island11 – basic keyboard commands (Enter → Ctrl+F)
    13  island12 – windows & tabs shortcuts (Ctrl+T/W/Tab)
    14  island14 – advanced shortcuts
    15  island15 – grand final challenge
===================================================================== */

/* Map placement: x is vw from left-edge of the track, y is % of viewport
   height.  Islands alternate high (y≈13) and low (y≈49) to create the
   classic staircase-path look.  Spacing is a constant 20 vw between each
   island so the whole row reads evenly. */
const worldMapPositions: Record<Activity["worldId"], MapPosition> = {
  island1:  { x:   6, y: 13 },  // #1
  island6:  { x:  26, y: 49 },  // #2
  island2:  { x:  46, y: 13 },  // #3
  island7:  { x:  66, y: 49 },  // #4
  island13: { x:  86, y: 13 },  // #5
  island5:  { x: 106, y: 49 },  // #6
  island3:  { x: 126, y: 13 },  // #7
  island8:  { x: 146, y: 49 },  // #8
  island9:  { x: 166, y: 13 },  // #9
  island4:  { x: 186, y: 49 },  // #10
  island10: { x: 206, y: 13 },  // #11
  island11: { x: 226, y: 49 },  // #12
  island12: { x: 246, y: 13 },  // #13
  island14: { x: 266, y: 49 },  // #14
  island15: { x: 286, y: 13 },  // #15
};

/* El arte de un mundo se resuelve por su id — ver islandArt() en
   utils/assets.ts. Las quince se arman igual: no hay una rama para las cinco
   originales y otra para la expansión, ni índices paralelos que mantener en
   orden. Lo único propio de cada isla es su título y dónde cae en el mapa. */
const worldTitles: Record<Activity["worldId"], string> = {
  island1:  "Isla de teclas",
  island2:  "Isla de palabras",
  island3:  "Isla de la biblioteca",
  island4:  "Isla del árbol",
  island5:  "Isla digital",
  island6:  "Isla de la escritura",
  island7:  "Isla de palabras largas",
  island8:  "Isla de los signos",
  island9:  "Isla de los correos",
  island10: "Isla de las búsquedas",
  island11: "Isla de los comandos",
  island12: "Isla de ventanas",
  island13: "Isla de los mensajes",
  island14: "Isla de atajos",
  island15: "Isla del gran reto",
};

const worldMeta = Object.fromEntries(
  (Object.keys(worldTitles) as Activity["worldId"][]).map((id) => [
    id,
    {
      title: worldTitles[id],
      thumbnail: islandMapThumb(id),
      background: islandArt(id).sky,
      gameplayBg: islandGameplayBg(id),
      positions: islandLevelLayouts[id],
      map: worldMapPositions[id],
    } satisfies WorldMetaEntry,
  ]),
) as Record<Activity["worldId"], WorldMetaEntry>;

function buildLevels(worldId: Activity["worldId"], progress: CurriculumProgress): Level[] {
  return activitiesByWorld[worldId].map((activity) => {
    const state = levelState(progress, worldId, activity.levelNumber);
    const description =
      state === "Bloqueado"
        ? "Completá el nivel anterior para desbloquear este desafío."
        : activity.description;
    return {
      title: `Nivel ${activity.levelNumber}`,
      name: activity.title,
      state,
      description,
      activityId: activity.id,
      levelNumber: activity.levelNumber,
      stars: getBestStarsForLevel(progress, worldId, activity.levelNumber),
    };
  });
}

function buildWorld(worldId: Activity["worldId"], progress: CurriculumProgress): World {
  const meta = worldMeta[worldId];
  const pedagogyPosition = pedagogyOrderOf(worldId);
  return {
    id: worldId,
    slug: worldId,
    title: meta.title,
    topic: WORLD_TOPICS[worldId],
    order: pedagogyPosition,
    displayNumber: pedagogyPosition,
    thumbnail: meta.thumbnail,
    background: meta.background,
    gameplayBg: meta.gameplayBg,
    route: `/worlds/${worldId}`,
    levels: buildLevels(worldId, progress),
    levelPositions: meta.positions,
    map: meta.map,
  };
}

/* Background painted behind the gameplay screen for a given world.
   ALWAYS resolves to gameplay.webp de la carpeta de esa isla — never the
   island thumbnail, the old backgrounds set, or the fallback gameplay-bg. */
export function getGameplayBackground(worldId: Activity["worldId"]): string {
  return islandGameplayBg(worldId);
}

/** Alias with the descriptive name used elsewhere in the codebase. */
export const getGameplayBackgroundForWorld = getGameplayBackground;

/* Progression order of the five worlds. NOTE: the digital-skills island
   (island5) is the SECOND world in the learning path even though it sits in
   the bottom-right of the map — its on-screen position is unchanged, only its
   place in the sequence. Everything that needs a "Mundo N" number or an
   unlock order derives it from this array. */
/* =====================================================================
   Canonical pedagogical order — THE single source of truth for
   "which world is world N in difficulty".

   `island1..island15` are stable internal ids (used by URLs, localStorage
   and asset paths). They were created in the order the artist files
   arrived, NOT the order a student should play them. The array below
   encodes the correct difficulty sequence. Every other piece of code
   (free-path display, unlock gate, "Mundo N" label, the grade-to-worlds
   map in `userContext.ts`) MUST derive from this array — never
   hand-maintain a parallel list.
===================================================================== */
/* La lista canónica vive en `activities.ts` porque `userContext.ts`
   también la necesita y no puede importar de acá sin cerrar un ciclo. */
export { WORLD_PEDAGOGY_ORDER } from "./activities";

/* O(1) lookup: worldId → 1-based pedagogical position. Used everywhere we
   need to show "Mundo N" to a student, teacher or admin. */
const _pedagogyIndex: Partial<Record<Activity["worldId"], number>> =
  Object.fromEntries(WORLD_PEDAGOGY_ORDER.map((id, i) => [id, i + 1]));

/** Returns the 1-based pedagogical position of a world (1..15). Returns
 *  `0` for unknown ids — callers should treat that as "outside the
 *  curriculum" and fall back to a neutral display. */
export function pedagogyOrderOf(worldId: Activity["worldId"]): number {
  return _pedagogyIndex[worldId] ?? 0;
}

/* `WORLD_ORDER` is now an alias for `WORLD_PEDAGOGY_ORDER` so the rest of
   the codebase (which imports `WORLD_ORDER`) keeps compiling without
   change. New code should prefer `WORLD_PEDAGOGY_ORDER` for clarity. */
/** Canonical difficulty order used for progression unlocking and the
 *  free-path display. Aliased to WORLD_PEDAGOGY_ORDER — prefer the
 *  longer name in new code. */
export const WORLD_ORDER: ReadonlyArray<Activity["worldId"]> = WORLD_PEDAGOGY_ORDER;

export type WorldLockState = "completed" | "current" | "locked";

/* A world counts as fully complete once every level is completed (all levels
   done). Kept for callers that need the strict "all levels done" check. */
export function isWorldComplete(worldId: Activity["worldId"], progress: CurriculumProgress): boolean {
  return activitiesByWorld[worldId].every((activity) => isLevelCompleted(progress, worldId, activity.levelNumber));
}

/** Star progress for a world (re-exported for UI). */
export function worldStarProgress(
  worldId: Activity["worldId"],
  progress: CurriculumProgress = loadProgress(),
): WorldStarProgress {
  return getWorldStarProgress(progress, worldId);
}

/* Cumulative star requirement to UNLOCK each world: the sum of the MAX stars of
   every world BEFORE it in the given order. So world 1 needs 0, world 2 needs
   world 1's max (21★), world 3 needs world 1 + world 2's max (42★), and so on —
   the bar keeps rising as the student advances. worldId → required running
   total. Entering a world never spends stars; this is a pure threshold. */
export function getWorldStarRequirements(
  orderedIds: ReadonlyArray<Activity["worldId"]> = WORLD_ORDER,
): Record<string, number> {
  const reqs: Record<string, number> = {};
  let required = 0;
  for (const id of orderedIds) {
    reqs[id] = required;
    required += getWorldMaxStars(id);
  }
  return reqs;
}

/* Build lock states over an ORDERED list of worldIds using the CUMULATIVE
   account-wide star total:
     - a world is UNLOCKED once the running star total (sum of best stars over
       every level of every world) reaches the sum of the max stars of all the
       worlds before it (see getWorldStarRequirements).
     - "completed" → unlocked AND every level of the world is finished.
     - "current"   → unlocked but still has levels left to finish.
     - "locked"    → the account total has not reached this world's threshold.
   When `unlockAll` is true (free path: demo / superadmin / teacher) nothing is
   ever locked. */
function buildStarStates(
  orderedIds: ReadonlyArray<Activity["worldId"]>,
  progress: CurriculumProgress,
  unlockAll: boolean,
): Record<string, WorldLockState> {
  const states: Record<string, WorldLockState> = {};
  const total = getTotalStars(progress);
  let required = 0; // cumulative max stars of all PRECEDING worlds
  for (const id of orderedIds) {
    const unlocked = unlockAll || total >= required;
    states[id] = !unlocked
      ? "locked"
      : isWorldComplete(id, progress)
        ? "completed"
        : "current";
    required += getWorldMaxStars(id);
  }
  return states;
}

/* Sequential unlocking over the full WORLD_ORDER (no user context).
   Uses the cumulative account-wide star total (see buildStarStates). */
export function getWorldStates(
  progress: CurriculumProgress = loadProgress(),
): Record<Activity["worldId"], WorldLockState> {
  return buildStarStates(WORLD_ORDER, progress, false) as Record<Activity["worldId"], WorldLockState>;
}

/* Context-aware lock states. The cumulative-star gate is applied to EVERY user
   over their ordered worlds, so the unlock gate is real while playing — your
   running star total must reach the sum of the max stars of all earlier worlds
   to open the next one. Demo / superadmin still SEE every world (visibility is
   handled by getWorldsForUser); locked ones simply appear greyed and can be
   opened with the hidden 5-click dev bypass for testing. */
export function getWorldStatesForUser(
  context: UserContext,
  progress: CurriculumProgress = loadProgress(),
): Record<string, WorldLockState> {
  const orderedIds = getWorldsForUser(context, progress).map((w) => w.id);
  return buildStarStates(orderedIds, progress, false);
}

export function getWorlds(progress: CurriculumProgress = loadProgress()): World[] {
  return WORLD_ORDER.map((id) => buildWorld(id, progress));
}

export function getWorldBySlug(slug?: string, progress: CurriculumProgress = loadProgress()): World | undefined {
  if (!slug) return undefined;
  if (!(slug in worldMeta)) return undefined;
  return buildWorld(slug as Activity["worldId"], progress);
}

export const worlds: World[] = getWorlds();

/** Returns worlds visible for a specific user context.
 *
 *  - Demo mode / superadmin / teacher / admin (free path) → EVERY world in
 *    difficulty order, taken directly from WORLD_ORDER. This is independent
 *    of any course/grade list, so it can never be accidentally filtered down
 *    (this is what previously cut demo mode to a 3EP-sized 7 worlds).
 *  - Real students (course path) → only the worlds for their grade, further
 *    narrowed by the teacher's per-class island selection.
 *
 *  Pass the result of getUserContext() from userContext.ts. */
export function getWorldsForUser(
  context: UserContext,
  progress: CurriculumProgress = loadProgress(),
): World[] {
  // Free path: all worlds, always complete, ordered by difficulty.
  if (!context.isCoursePath) {
    return WORLD_ORDER.map((id) => buildWorld(id, progress));
  }
  // Course path: grade + teacher selection (handled in getVisibleWorldIds).
  const visibleIds = getVisibleWorldIds(context);
  return visibleIds.map((id) => buildWorld(id, progress));
}

/** All worlds ordered by difficulty (the canonical free-path list). */
export function getAllWorldsOrderedByDifficulty(
  progress: CurriculumProgress = loadProgress(),
): World[] {
  return WORLD_ORDER.map((id) => buildWorld(id, progress));
}

export type WorldId = World["id"];
export type WorldSlug = World["slug"];
