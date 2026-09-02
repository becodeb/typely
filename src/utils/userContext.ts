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
import { WORLD_PEDAGOGY_ORDER, type Activity } from "../data/activities";

/* ------------------------------------------------------------------ */
/* Grupo del alumno — cargado una vez, leído muchas                    */
/* ------------------------------------------------------------------ */

const CACHE_KEY = "typely_my_group_v1";

interface MyGroup {
  grade: GradeId;
  /** Islas que habilitó el docente. `null` = sin restricción. */
  worldIds: string[] | null;
  groupName: string | null;
  /** El docente puede apagar el modo Órbita para su grupo. */
  arcadeEnabled: boolean;
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
      arcadeEnabled: res.arcadeEnabled ?? true,
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

/** ¿Este alumno tiene el modo Órbita habilitado? Sin dato (demo, sin
 *  grupo, sin red) la respuesta es sí: el estado natural es habilitado y
 *  el orbe dormido es una decisión del docente, no un fallo de cache. */
export function arcadeHabilitado(): boolean {
  return cached?.arcadeEnabled ?? true;
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

/** La isla que REPRESENTA a cada grado en el panel de gestión.
 *
 *  Es solo un emblema para reconocer un curso de un vistazo en la lista de
 *  grupos: ya NO decide a qué juega nadie. Antes esta tabla era la lista de
 *  islas habilitadas por grado, y de ahí salía el recorte que dejaba a un
 *  primer grado con tres islas; ahora todos los alumnos tienen las quince
 *  y lo único que recorta es la selección del docente.
 *
 *  Los valores son los que ya se venían mostrando —la última isla de cada
 *  grado en la tabla vieja— así que el panel se ve igual. */
export const GRADE_EMBLEM: Record<GradeId, Activity["worldId"]> = {
  inicial: "island6",
  "1ep": "island2",
  "2ep": "island13",
  "3ep": "island8",
  "4ep": "island10",
  "5ep": "island11",
  "6ep": "island15",
  sec: "island15",
  libre: "island15",
};
/** Las islas visibles para este usuario, en orden pedagógico.
 *
 *  **Por defecto están todas, sin importar el grado.** El juego se abre
 *  solo: cada isla se desbloquea al terminar la anterior, y esa progresión
 *  ya es la que regula la dificultad. Recortar además por grado hacía que
 *  un chico de primero viera tres islas y, al terminarlas, se quedara sin
 *  juego — con doce islas ahí, invisibles, hasta que alguien le cambiara
 *  el grado al grupo.
 *
 *  Lo único que recorta es la selección del DOCENTE (`group_worlds`), que
 *  es una decisión de aula y no una regla del producto: un docente puede
 *  querer que su curso se quede en las primeras mientras trabaja un tema.
 *  Sin selección guardada (`null`), están todas. */
export function getVisibleWorldIds(context: UserContext): Activity["worldId"][] {
  const base = [...WORLD_PEDAGOGY_ORDER];
  if (!context.isCoursePath) return base;

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
