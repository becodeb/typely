/* Persistencia del Modo Automatización.
 *
 * Los componentes NO hablan con `localStorage`: hablan con este
 * repositorio (IMPLEMENTACION.md §10). No es ceremonia — el día que el
 * campo se sincronice entre dispositivos, ese cambio ocurre acá adentro
 * y ninguna pantalla se entera.
 *
 * Tres reglas:
 *
 *   - El snapshot se VALIDA al cargar. Puede venir de una versión vieja,
 *     de otra máquina o de alguien jugando con las herramientas del
 *     navegador. Si no cierra, se descarta ENTERO y se arranca limpio:
 *     un campo a medias, con la nave fuera de la cuadrícula o el saldo
 *     en NaN, es peor que empezar de nuevo.
 *
 *   - Nunca se guarda identidad, contraseña ni token. Sólo el campo.
 *
 *   - El demo tiene su propia clave y NUNCA llega a la API. Es una
 *     partida de muestra, no una sesión (CLAUDE.md §4).
 *
 * Lo que NO se persiste es la corrida en curso: al volver, la nave está
 * en el muelle y el programa detenido. Guardar una ejecución a medias
 * obligaría a reconstruir el estado de una animación interrumpida, y no
 * hay nada que ganar — el chico aprieta Empezar de nuevo y listo.
 *
 * MIGRACIÓN v1 → v2 (los minerales). Un snapshot de la versión 1 tenía
 * un solo `saldo` y cosechas como marcas de tiempo. Se lee igual: el
 * saldo pasa a ser chispas, las cosechas valen 1, los niveles arrancan
 * en 1. Ninguna partida se pierde por haber jugado antes del cambio.
 */

import { AJUSTES, EVOLUCION, ORDEN_MINERALES, type Mineral } from "../../data/automatizacion/balance";
import {
  VARIANTES,
  origen,
  porMineral,
  type Celda,
  type Cosecha,
  type EstadoCampo,
  type EtapaCristal,
  type VarianteCristal,
} from "./motor";
import { validarPrograma } from "./programa";

const CLAVE = "typely_automatizacion_v1";
const CLAVE_DEMO = "typely_automatizacion_demo_v1";

/** El estado sin lo que es de la corrida: eso no viaja al disco. */
export type CampoGuardado = Omit<EstadoCampo, "nave">;

function clave(usuario: string | null): string {
  return usuario ? `${CLAVE}:${usuario}` : CLAVE_DEMO;
}

/* ------------------------------------------------------------------ */
/* Validación                                                          */
/* ------------------------------------------------------------------ */

const numeroFinito = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function validarCelda(v: unknown): Celda | null {
  if (typeof v !== "object" || v === null) return null;
  const c = v as Record<string, unknown>;
  if (!numeroFinito(c.etapa) || c.etapa < 0 || c.etapa > 3 || !Number.isInteger(c.etapa)) return null;
  const esVacia = c.variante === null || c.variante === undefined;
  if (!esVacia && (typeof c.variante !== "string" || !VARIANTES.includes(c.variante as VarianteCristal))) {
    return null;
  }
  if (!numeroFinito(c.restanteMs) || c.restanteMs < 0) return null;
  return {
    etapa: esVacia ? 0 : (c.etapa as EtapaCristal),
    variante: esVacia ? null : (c.variante as VarianteCristal),
    /* Un `restanteMs` gigantesco dejaría una veta congelada para
       siempre sin que nada lo delate. Se recorta a un paso completo. */
    restanteMs: Math.min(c.restanteMs, AJUSTES.msPorEtapa * 12),
  };
}

/** Un registro por mineral, con default para los que falten. */
function validarPorMineral(v: unknown, defecto: number, tope: number): Record<Mineral, number> {
  const salida = porMineral(defecto);
  if (typeof v !== "object" || v === null) return salida;
  const o = v as Record<string, unknown>;
  for (const m of ORDEN_MINERALES) {
    const n = o[m];
    if (numeroFinito(n) && n >= 0) salida[m] = Math.min(n, tope);
  }
  return salida;
}

/** Devuelve un estado usable o null. Nunca a medias. */
export function validarCampo(v: unknown): EstadoCampo | null {
  if (typeof v !== "object" || v === null) return null;
  const s = v as Record<string, unknown>;

  const version = s.schemaVersion;
  if (version !== 1 && version !== 2) return null;
  if (!numeroFinito(s.lado) || !Number.isInteger(s.lado) || s.lado < 1 || s.lado > 12) return null;
  if (!Array.isArray(s.celdas) || s.celdas.length !== s.lado * s.lado) return null;

  const celdas: Celda[] = [];
  for (const c of s.celdas) {
    const celda = validarCelda(c);
    if (!celda) return null;
    celdas.push(celda);
  }

  const programa = validarPrograma(s.programa ?? []);
  if (!programa) return null;

  if (!numeroFinito(s.acumulado) || s.acumulado < 0) return null;
  if (!numeroFinito(s.relojMs) || s.relojMs < 0) return null;
  if (!numeroFinito(s.mejorTasa) || s.mejorTasa < 0) return null;

  /* v1: un solo saldo, que era de chispas. */
  let saldos: Record<Mineral, number>;
  if (version === 1) {
    if (!numeroFinito(s.saldo) || s.saldo < 0) return null;
    saldos = porMineral(0);
    saldos.punta = s.saldo;
  } else {
    saldos = validarPorMineral(s.saldos, 0, 1e9);
  }

  /* El acumulado manda el revelado progresivo y nunca puede ser menor
     que lo que hay en los contadores: si lo fuera, alguien editó el
     storage a mano y la tienda mostraría categorías que no se ganaron. */
  const total = ORDEN_MINERALES.reduce((sum, m) => sum + saldos[m], 0);
  const acumulado = Math.max(s.acumulado, total);

  const cosechados = validarPorMineral(s.cosechados, 0, 1e9);
  const niveles = validarPorMineral(s.niveles, 1, EVOLUCION.nivelMaximo);
  for (const m of ORDEN_MINERALES) niveles[m] = Math.max(1, Math.round(niveles[m]));

  const mejoras: Record<string, number> = {};
  if (typeof s.mejoras === "object" && s.mejoras !== null) {
    for (const [k, valor] of Object.entries(s.mejoras as Record<string, unknown>)) {
      if (!(k in AJUSTES.mejoras)) continue;
      const tope = AJUSTES.mejoras[k as keyof typeof AJUSTES.mejoras].maxNivel;
      if (!numeroFinito(valor) || !Number.isInteger(valor) || valor < 0) continue;
      mejoras[k] = Math.min(valor, tope);
    }
  }

  const relojMs = s.relojMs;
  const cosechas: Cosecha[] = [];
  if (Array.isArray(s.cosechas)) {
    for (const c of s.cosechas.slice(-500)) {
      // v1: sólo el instante; v2: instante y valor.
      if (numeroFinito(c)) {
        if (c >= 0 && c <= relojMs) cosechas.push({ t: c, v: 1 });
      } else if (typeof c === "object" && c !== null) {
        const o = c as Record<string, unknown>;
        if (numeroFinito(o.t) && numeroFinito(o.v) && o.t >= 0 && o.t <= relojMs && o.v >= 0) {
          cosechas.push({ t: o.t, v: o.v });
        }
      }
    }
  }

  return {
    schemaVersion: 2,
    lado: s.lado,
    /* La nave no se persiste: siempre se vuelve al muelle. */
    nave: origen(s.lado),
    celdas,
    saldos,
    acumulado,
    cosechados,
    niveles,
    mejoras,
    programa,
    mejorTasa: s.mejorTasa,
    cosechas,
    relojMs: s.relojMs,
  };
}

/* ------------------------------------------------------------------ */
/* Repositorio                                                         */
/* ------------------------------------------------------------------ */

export interface RepositorioCampo {
  cargar(usuario: string | null): EstadoCampo | null;
  guardar(usuario: string | null, estado: EstadoCampo): void;
  borrar(usuario: string | null): void;
}

export const repositorioLocal: RepositorioCampo = {
  cargar(usuario) {
    try {
      const crudo = localStorage.getItem(clave(usuario));
      if (!crudo) return null;
      return validarCampo(JSON.parse(crudo));
    } catch {
      /* Storage lleno, deshabilitado o JSON roto: se juega igual, con un
         campo nuevo. Nunca se rompe la pantalla por no poder leer. */
      return null;
    }
  },

  guardar(usuario, estado) {
    try {
      const { nave: _nave, ...resto } = estado;
      localStorage.setItem(clave(usuario), JSON.stringify(resto));
    } catch {
      /* Sin storage el mundo sigue vivo en memoria hasta que cierren la
         pestaña. Peor sería tirar un error en medio de una cosecha. */
    }
  },

  borrar(usuario) {
    try {
      localStorage.removeItem(clave(usuario));
    } catch {
      /* nada que hacer */
    }
  },
};

/** Guardado con freno: el crecimiento cambia el estado en cada frame y
 *  escribir en `localStorage` sesenta veces por segundo traba la pestaña.
 *  Las compras y las ediciones piden `inmediato` y no esperan. */
export function guardadorConFreno(repo: RepositorioCampo = repositorioLocal, esperaMs = 1500) {
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let pendiente: { usuario: string | null; estado: EstadoCampo } | null = null;

  const volcar = () => {
    if (pendiente) repo.guardar(pendiente.usuario, pendiente.estado);
    pendiente = null;
    temporizador = null;
  };

  return {
    pedir(usuario: string | null, estado: EstadoCampo, inmediato = false) {
      pendiente = { usuario, estado };
      if (inmediato) {
        if (temporizador) clearTimeout(temporizador);
        volcar();
        return;
      }
      if (temporizador) return;
      temporizador = setTimeout(volcar, esperaMs);
    },
    /** Al desmontar o al ocultarse la pestaña: escribir ya y soltar todo. */
    cerrar() {
      if (temporizador) clearTimeout(temporizador);
      volcar();
    },
  };
}
