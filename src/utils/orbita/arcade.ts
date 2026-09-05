/* Persistencia del modo Órbita — el mismo contrato que progress.ts.
 *
 * El camino caliente es local: al terminar una partida se guarda el
 * récord en localStorage y la pantalla de resultado responde al instante.
 * El envío al servidor va por una COLA con reintento — el wifi flojo de
 * una escuela no puede costarle a un chico su mejor partida. Se reintenta
 * al terminar la próxima, al volver la conexión y al entrar a /orbita.
 *
 * El modo demo juega, ve su puntaje local y NO manda nada: sin cuenta no
 * hay ranking ni cristales que acuñar (CLAUDE.md §4, sin excepciones).
 */

import {
  api,
  getAccessToken,
  type ArcadePerfil,
  type ArcadeRunPayload,
  type ArcadeRunResponse,
} from "../api";
import { isDemoMode } from "../storage";
import type { ResultadoPartida } from "./motor";

const COLA_KEY = "typely_orbita_cola_v1";
const PERFIL_KEY = "typely_orbita_perfil_v1";
const RECORD_KEY = "typely_orbita_record_v1";

/* ------------------------------------------------------------------ */
/* Sincronización                                                      */
/* ------------------------------------------------------------------ */

/** ¿Esta sesión manda partidas al servidor? El demo no tiene cuenta, y
 *  los roles de gestión no compiten en el ranking de los chicos. */
export function sincronizaArcade(rol: string | undefined): boolean {
  return Boolean(getAccessToken()) && !isDemoMode() && rol === "alumno";
}

function leerCola(): ArcadeRunPayload[] {
  try {
    const raw = localStorage.getItem(COLA_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ArcadeRunPayload[]) : [];
  } catch {
    return [];
  }
}

function escribirCola(items: ArcadeRunPayload[]) {
  try {
    /* Tope defensivo, como la cola de progreso: semanas sin conexión no
       pueden hacer crecer esto sin límite. Se quedan las más recientes. */
    localStorage.setItem(COLA_KEY, JSON.stringify(items.slice(-50)));
  } catch {
    /* Sin espacio: preferimos perder la cola antes que romper el juego. */
  }
}

let vaciando = false;

/** Vacía la cola. Devuelve la última respuesta del servidor (la que trae
 *  posiciones y saldo) o null si no había nada o no hay red. */
export async function vaciarColaArcade(rol: string | undefined): Promise<ArcadeRunResponse | null> {
  if (vaciando || !sincronizaArcade(rol)) return null;
  const pendientes = leerCola();
  if (!pendientes.length) return null;

  vaciando = true;
  try {
    const res = await api.postArcadeRuns(pendientes.slice(0, 5));
    escribirCola(leerCola().slice(Math.min(5, pendientes.length)));
    if (res.balance != null) actualizarPerfilLocal({ crystals: res.balance });
    return res;
  } catch {
    return null; // queda encolado para la próxima
  } finally {
    vaciando = false;
  }
}

/** Convierte el resultado del motor en el payload del servidor, lo encola
 *  y trata de mandarlo ya. */
export function registrarPartida(
  resultado: ResultadoPartida,
  rol: string | undefined,
): Promise<ArcadeRunResponse | null> {
  guardarRecordLocal(resultado);
  if (!sincronizaArcade(rol)) return Promise.resolve(null);

  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - resultado.duracionMs);
  escribirCola([
    ...leerCola(),
    {
      gameId: "tormenta",
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: resultado.duracionMs,
      score: resultado.puntaje,
      peakThreat: resultado.amenazaMax,
      rankId: resultado.rango,
      wpmAvg: resultado.ppmMedio,
      wpmPeak: resultado.ppmPico,
      accuracy: resultado.precision,
      wordsDestroyed: resultado.palabras,
      charsTyped: resultado.caracteres,
      errors: resultado.errores,
      crystalsClaimed: resultado.cristales,
      /* Mejoras permanentes: lo tipeado (sobre eso se acuñan los
         cristales), el nivel y la build. El servidor lo usa para creerle a
         una partida donde la bala destruyó palabras que nadie tipeó. */
      wordsTyped: resultado.palabrasTipeadas,
      level: resultado.nivel,
      upgrades: resultado.mejoras.map((m) => ({ id: m.id, level: m.nivel })),
    },
  ]);
  return vaciarColaArcade(rol);
}

/* Al volver la conexión se intenta vaciar sin que el alumno haga nada.
   El rol no se conoce acá: se prueba y sincronizaArcade corta si no va. */
if (typeof window !== "undefined") {
  window.addEventListener("online", () => void vaciarColaArcade("alumno"));
}

/* ------------------------------------------------------------------ */
/* Perfil — cache local del perfil del servidor                        */
/* ------------------------------------------------------------------ */

export function perfilLocal(): ArcadePerfil | null {
  try {
    const raw = localStorage.getItem(PERFIL_KEY);
    return raw ? (JSON.parse(raw) as ArcadePerfil) : null;
  } catch {
    return null;
  }
}

export function actualizarPerfilLocal(parche: Partial<ArcadePerfil>) {
  const base: ArcadePerfil = perfilLocal() ?? {
    alias: null,
    crystals: 0,
    bestScore: 0,
    bestThreat: 0,
    bestRank: null,
    owned: [],
    equipped: { trail: null, beam: null },
  };
  try {
    localStorage.setItem(PERFIL_KEY, JSON.stringify({ ...base, ...parche }));
  } catch {
    /* sin espacio — el valor del servidor vuelve en la próxima carga */
  }
}

/** Trae el perfil del servidor y lo deja en cache. Silencioso sin red:
 *  se sigue con lo último que se supo, que es lo que el juego necesita. */
export async function hidratarPerfil(rol: string | undefined): Promise<ArcadePerfil | null> {
  if (!sincronizaArcade(rol)) return perfilLocal();
  try {
    const res = await api.arcadeMe();
    localStorage.setItem(PERFIL_KEY, JSON.stringify(res.profile));
    return res.profile;
  } catch {
    return perfilLocal();
  }
}

export function limpiarPerfilLocal() {
  try {
    localStorage.removeItem(PERFIL_KEY);
  } catch {
    /* ignorar */
  }
}

/* ------------------------------------------------------------------ */
/* Récord local — también para el demo                                 */
/* ------------------------------------------------------------------ */

export interface RecordLocal {
  puntaje: number;
  amenazaMax: number;
  rango: string;
  ppmPico: number;
}

export function recordLocal(): RecordLocal | null {
  try {
    const raw = localStorage.getItem(RECORD_KEY);
    return raw ? (JSON.parse(raw) as RecordLocal) : null;
  } catch {
    return null;
  }
}

function guardarRecordLocal(r: ResultadoPartida) {
  const previo = recordLocal();
  if (previo && previo.puntaje >= r.puntaje) return;
  try {
    localStorage.setItem(
      RECORD_KEY,
      JSON.stringify({
        puntaje: r.puntaje,
        amenazaMax: r.amenazaMax,
        rango: r.rango,
        ppmPico: r.ppmPico,
      } satisfies RecordLocal),
    );
  } catch {
    /* ignorar */
  }
}
