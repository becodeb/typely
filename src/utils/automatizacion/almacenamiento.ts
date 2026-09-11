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
 *
 * MIGRACIÓN v1/v2 → v3 (el lienzo). Un snapshot de v1 o v2 tenía un solo
 * `programa` plano. El orden plano viejo ERA el orden de ejecución, así
 * que partirlo en dos no cambia lo que hace: las `Mi rutina` (`def`)
 * salen a `rutinas` —siempre fueron raíz y nunca producían un paso— y
 * todo lo demás queda colgando del bloque verde EN SU ORDEN ORIGINAL,
 * con `pilasSueltas: []`. Ninguna partida se pierde. La geometría del
 * lienzo (`x`/`y`, el ancla del verde) se RECORTA cuando no cierra, nunca
 * descarta la partida — sólo un nodo mal formado sigue siendo todo o
 * nada, igual que hoy.
 */

import { AJUSTES, EVOLUCION, ORDEN_MINERALES, type Mineral } from "../../data/automatizacion/balance";
import {
  PUNTO_INICIO,
  VARIANTES,
  origen,
  porMineral,
  puntoRutinaPorDefecto,
  type Celda,
  type Cosecha,
  type EstadoCampo,
  type EtapaCristal,
  type Lienzo,
  type Pila,
  type Punto,
  type VarianteCristal,
} from "./motor";
import {
  capacidadDeLienzo,
  esDefinicion,
  nuevoId,
  validarPrograma,
  type NodoDef,
  type NombreRutina,
  type Programa,
} from "./programa";

const CLAVE = "typely_automatizacion_v1";
const CLAVE_DEMO = "typely_automatizacion_demo_v1";

/** El estado sin lo que es de la corrida: eso no viaja al disco. Desde
 *  v3 esto serializa tres colecciones del lienzo además de `programa`:
 *  `rutinas`, `pilasSueltas` y `lienzo` (la geometría). */
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

/* ------------------------------------------------------------------ */
/* Lienzo: rutinas, pilas sueltas y geometría (v3)                     */
/* ------------------------------------------------------------------ */

const MAX_PILAS = 24;
const LIENZO_MIN = -4000;
const LIENZO_MAX = 4000;

/** Geometría: se RECORTA, nunca se descarta. Un `x`/`y` gigantesco, NaN o
 *  ausente cae adentro de rango en vez de tirar la partida entera —
 *  perder un cuaderno entero por un píxel fuera de rango es inaceptable
 *  (design.md decisión #10). */
const recortarCoord = (v: unknown): number =>
  numeroFinito(v) ? Math.min(LIENZO_MAX, Math.max(LIENZO_MIN, Math.round(v))) : 0;

const validarPunto = (v: unknown, defecto: Punto): Punto => {
  if (typeof v !== "object" || v === null) return defecto;
  const o = v as Record<string, unknown>;
  return { x: recortarCoord(o.x), y: recortarCoord(o.y) };
};

/** `rutinas` sólo lleva `def`, y la PRIMERA definición de cada letra
 *  gana: la misma regla que `rutinasDe`, para que la corrida nunca sea
 *  ambigua sin importar de dónde vino cada una. */
function fusionarRutinas(base: NodoDef[], extra: NodoDef[]): NodoDef[] {
  const vistas = new Set<NombreRutina>();
  const salida: NodoDef[] = [];
  for (const d of [...base, ...extra]) {
    if (vistas.has(d.rutina)) continue;
    vistas.add(d.rutina);
    salida.push(d);
  }
  return salida;
}

function validarRutinas(v: unknown): NodoDef[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;
  const lista = validarPrograma(v); // profundidad 0: `def` es válido acá
  if (!lista || !lista.every(esDefinicion)) return null;
  return lista as NodoDef[];
}

function validarPilas(v: unknown): Pila[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;
  const salida: Pila[] = [];
  for (const p of v.slice(0, MAX_PILAS)) {
    if (typeof p !== "object" || p === null) return null;
    const o = p as Record<string, unknown>;
    const nodos = validarPrograma(o.nodos ?? []);
    if (!nodos) return null; // nodo roto: se descarta la partida entera
    if (nodos.length === 0) continue; // pila vacía: no es un error, se tira
    if (nodos.some(esDefinicion)) return null; // una rutina nunca es pila suelta
    const id = typeof o.id === "string" && o.id.length > 0 && o.id.length <= 40 ? o.id : nuevoId();
    salida.push({ id, x: recortarCoord(o.x), y: recortarCoord(o.y), nodos });
  }
  return salida;
}

/** Geometría: se RECORTA, nunca se descarta. Una clave que no nombra
 *  ninguna rutina viva se cae sola —sólo se copian los ids vivos—, y una
 *  rutina sin coordenada recibe una de la fila por defecto. Un
 *  `idInicio` que no cierra se REGENERA en vez de invalidar la partida. */
function validarLienzo(v: unknown, rutinas: NodoDef[]): Lienzo {
  const o = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  const idInicio =
    typeof o.idInicio === "string" && o.idInicio.length > 0 && o.idInicio.length <= 40 ? o.idInicio : nuevoId();
  const crudo = (typeof o.rutinas === "object" && o.rutinas !== null ? o.rutinas : {}) as Record<string, unknown>;
  const posiciones: Record<string, Punto> = {};
  rutinas.forEach((d, i) => {
    posiciones[d.id] = validarPunto(crudo[d.id], puntoRutinaPorDefecto(i));
  });
  return { idInicio, inicio: validarPunto(o.inicio, PUNTO_INICIO), rutinas: posiciones };
}

/** Devuelve un estado usable o null. Nunca a medias. */
export function validarCampo(v: unknown): EstadoCampo | null {
  if (typeof v !== "object" || v === null) return null;
  const s = v as Record<string, unknown>;

  const version = s.schemaVersion;
  if (version !== 1 && version !== 2 && version !== 3) return null;
  if (!numeroFinito(s.lado) || !Number.isInteger(s.lado) || s.lado < 1 || s.lado > 12) return null;
  if (!Array.isArray(s.celdas) || s.celdas.length !== s.lado * s.lado) return null;

  const celdas: Celda[] = [];
  for (const c of s.celdas) {
    const celda = validarCelda(c);
    if (!celda) return null;
    celdas.push(celda);
  }

  const programaCrudo = validarPrograma(s.programa ?? []);
  if (!programaCrudo) return null;

  let programa: Programa;
  let rutinas: NodoDef[];
  let pilasSueltas: Pila[];

  if (version === 3) {
    const r = validarRutinas(s.rutinas);
    const p = validarPilas(s.pilasSueltas);
    if (!r || !p) return null; // nodo mal formado: se descarta ENTERO
    // Un `def` que quedó en la cadena verde (snapshot editado a mano) se
    // MUDA a `rutinas` en vez de tirar la partida: es geometría, no un
    // nodo roto.
    rutinas = fusionarRutinas(r, programaCrudo.filter(esDefinicion));
    programa = programaCrudo.filter((n) => !esDefinicion(n));
    pilasSueltas = p;
  } else {
    /* v1/v2 → v3. El orden plano viejo ERA el orden de ejecución, así que
       partirlo en dos no cambia lo que hace: las `Mi rutina` salen a
       `rutinas` (siempre fueron raíz y nunca produjeron un paso) y todo
       lo demás queda colgando del verde EN SU ORDEN ORIGINAL. Ninguna
       partida se pierde, la misma disciplina que la migración v1 → v2. */
    rutinas = fusionarRutinas([], programaCrudo.filter(esDefinicion));
    programa = programaCrudo.filter((n) => !esDefinicion(n));
    pilasSueltas = [];
  }

  /* El tope de nodos es del LIENZO entero, no de cada lista: con tres
     validaciones sueltas de 60 el total podría llegar a 180. */
  if (capacidadDeLienzo(programa, rutinas, pilasSueltas) > AJUSTES.maxNodos) return null;

  const lienzo = validarLienzo(s.lienzo, rutinas);

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
    schemaVersion: 3,
    cuarzosRotos: numeroFinito(s.cuarzosRotos) ? Math.max(0, Math.floor(s.cuarzosRotos)) : 0,
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
    rutinas,
    pilasSueltas,
    lienzo,
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

let avisoGuardado: string | null = null;
let avisoRecuperacion: string | null = null;
export function leerAvisoGuardado(): string | null { return avisoGuardado ?? avisoRecuperacion; }

export const repositorioLocal: RepositorioCampo = {
  cargar(usuario) {
    avisoGuardado = null;
    avisoRecuperacion = null;
    try {
      const crudo = localStorage.getItem(clave(usuario));
      if (!crudo) return null;
      let campo: EstadoCampo | null = null;
      try { campo = validarCampo(JSON.parse(crudo)); } catch { /* preservar debajo */ }
      if (!campo) {
        localStorage.setItem(`${clave(usuario)}:recuperacion`, crudo);
        avisoRecuperacion = "La partida guardada no era válida. Conservamos el archivo original para recuperación y abrimos una partida nueva.";
      }
      return campo;
    } catch {
      /* Storage lleno, deshabilitado o JSON roto: se juega igual, con un
         campo nuevo. Nunca se rompe la pantalla por no poder leer. */
      avisoGuardado = "No se pudo leer el guardado. Descarga una copia antes de cerrar el juego.";
      return null;
    }
  },

  guardar(usuario, estado) {
    try {
      const { nave: _nave, ...resto } = estado;
      localStorage.setItem(clave(usuario), JSON.stringify(resto));
      avisoGuardado = null;
    } catch {
      avisoGuardado = "No se pudo guardar en este navegador. Usa Guardar copia antes de cerrar para no perder tu partida.";
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
