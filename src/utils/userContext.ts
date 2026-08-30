/**
 * Qué islas ve cada alumno.
 *
 * Antes esto se resolvía leyendo una base de datos falsa en localStorage:
 * buscaba el curso del alumno en `getDemoData()` y las islas habilitadas en
 * una clave `edutic_class_worlds_*`. Mientras tanto, el docente guardaba su
 * selección en la API. Las dos mitades nunca se hablaron, así que
 * configurar un grupo no tenía ningún efecto visible para el alumno.
 *
 * Ahora hay una sola fuente: la API. `loadMyGroup()` la consulta una vez al
 * entrar y deja el resultado en memoria (con espejo en localStorage para
 * que un refresh no parpadee), y el resto del juego lo lee sincrónicamente.
 */

import type { ActiveUser, GradeId, Group, Role } from "../types";
import { api, getAccessToken } from "./api";
import { isDemoMode } from "./storage";
import type { Activity } from "../data/activities";

/* ------------------------------------------------------------------ */
/* Grupo del alumno — cargado una vez, leído muchas                    */
/* ------------------------------------------------------------------ */

const CACHE_KEY = "typely_my_group_v1";

interface MyGroup {
  grade: GradeId;
  /** Islas que habilitó el docente. `null` = sin restricción. */
  worldIds: string[] | null;
  groupName: string | null;
}

let cached: MyGroup | null = readCache();

function readCache(): MyGroup | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as MyGroup) : null;
  } catch {
    return null;
  }
}

function writeCache(value: MyGroup | null) {
  cached = value;
  try {
    if (value) localStorage.setItem(CACHE_KEY, JSON.stringify(value));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* modo privado / sin espacio — el valor en memoria alcanza */
  }
}

/** Consulta el grupo del alumno. Llamar una vez, al entrar al juego.
 *
 *  En modo demo no hay cuenta, así que no hay grupo que consultar: sin
 *  esta guarda, cada partida de demostración disparaba un pedido al
 *  servidor que solo podía fallar. */
export async function loadMyGroup(): Promise<MyGroup | null> {
  if (!getAccessToken() || isDemoMode()) return null;
  try {
    const res = await api.myGroup();
    const group = res.group as Group | null;
    const value: MyGroup = {
      grade: (group?.grade as GradeId) ?? "1ep",
      worldIds: res.worldIds,
      groupName: group?.name ?? null,
    };
    writeCache(value);
    return value;
  } catch {
    /* Sin red: seguimos con lo último que supimos. El juego no puede
       quedarse esperando a la API para dibujar el mapa. */
    return cached;
  }
}

export function clearMyGroup() {
  writeCache(null);
}

export function myGroupName(): string | null {
  return cached?.groupName ?? null;
}

/* ------------------------------------------------------------------ */
/* Contexto                                                            */
/* ------------------------------------------------------------------ */

export interface UserContext {
  user: ActiveUser | null;
  role: Role | "guest";
  grade: GradeId;
  /** true → solo las islas de su curso. false → todas (demo / staff). */
  isCoursePath: boolean;
  isDemo: boolean;
}

export function getUserContext(user: ActiveUser | null): UserContext {
  const role: Role | "guest" = user?.role ?? "guest";
  const demo = isDemoMode();

  /* El demo y cualquiera que no sea alumno recorren el camino libre: ven
     todas las islas. Solo el alumno real sigue el recorrido de su grado. */
  const freePath = demo || role !== "alumno";
  const grade: GradeId = freePath ? "libre" : (cached?.grade ?? "1ep");

  return { user, role, grade, isCoursePath: !freePath, isDemo: demo };
}

/* ------------------------------------------------------------------ */
/* Grado → islas                                                       */
/* ------------------------------------------------------------------ */

/** Qué islas corresponden a cada grado, en orden de dificultad. */
export const GRADE_WORLDS: Record<GradeId, Activity["worldId"][]> = {
  inicial: ["island1", "island6"],
  "1ep": ["island1", "island6", "island2"],
  "2ep": ["island1", "island6", "island2", "island7", "island13"],
  "3ep": ["island1", "island6", "island2", "island7", "island13", "island3", "island8"],
  "4ep": [
    "island1", "island6", "island2", "island7", "island13",
    "island3", "island8", "island9", "island4", "island10",
  ],
  "5ep": [
    "island1", "island6", "island2", "island7", "island13",
    "island3", "island8", "island9", "island4", "island10",
    "island5", "island11",
  ],
  "6ep": [
    "island1", "island6", "island2", "island7", "island13",
    "island3", "island8", "island9", "island4", "island10",
    "island5", "island11", "island12", "island14", "island15",
  ],
  sec: [
    "island1", "island6", "island2", "island7", "island13",
    "island3", "island8", "island9", "island4", "island10",
    "island5", "island11", "island12", "island14", "island15",
  ],
  libre: [
    "island1", "island6", "island2", "island7", "island13",
    "island3", "island8", "island9", "island4", "island10",
    "island5", "island11", "island12", "island14", "island15",
  ],
};

/** Las islas visibles para este usuario, en orden. */
export function getVisibleWorldIds(context: UserContext): Activity["worldId"][] {
  const base = GRADE_WORLDS[context.grade] ?? GRADE_WORLDS.libre;
  if (!context.isCoursePath) return base;

  /* Alumno con curso: se respeta lo que habilitó su docente. Sin filas
     guardadas (`null`) significa "todas las de su grado". */
  const enabled = cached?.worldIds;
  if (!enabled) return base;
  return base.filter((id) => enabled.includes(id));
}

export function canAccessWorld(worldId: Activity["worldId"], context: UserContext): boolean {
  return getVisibleWorldIds(context).includes(worldId);
}

/* ------------------------------------------------------------------ */
/* Detector de clicks rápidos (atajo de desarrollo)                    */
/* ------------------------------------------------------------------ */

/** Devuelve `true` cuando detecta `required` clicks seguidos sobre el mismo id. */
export function makeRapidClickDetector(windowMs = 450, required = 5) {
  let lastId = "";
  let count = 0;
  let lastTime = 0;

  return function registerClick(id: string): boolean {
    const now = Date.now();
    if (id === lastId && now - lastTime <= windowMs) count += 1;
    else {
      count = 1;
      lastId = id;
    }
    lastTime = now;
    if (count >= required) {
      count = 0;
      lastId = "";
      return true;
    }
    return false;
  };
}
