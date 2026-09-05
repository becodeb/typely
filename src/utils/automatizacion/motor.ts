/* Motor del Modo Automatización — el campo, la nave y la economía.
 *
 * Es LÓGICA PURA: no toca el DOM, no importa React, no tiene reloj
 * propio y no anima nada. La página lo alimenta con `avanzarMundo(dt)`
 * desde requestAnimationFrame y le pide un paso por vez con
 * `ejecutarPaso()`, y después ANIMA el evento que el motor ya resolvió.
 * La UI nunca decide si hubo cosecha, cuánto sumó el saldo o si la nave
 * chocó: eso ya vino resuelto (IMPLEMENTACION.md §6).
 *
 * Esa separación permite simular partidas enteras sin dibujar un píxel,
 * que es como se va a calibrar el balance.
 *
 * DOS DESVÍOS DELIBERADOS de IMPLEMENTACION.md §4, los dos por el mismo
 * motivo — la regla "no hay crecimiento offline" (MVP.md §6):
 *
 *   1. Las celdas guardan `restanteMs` (una cuenta regresiva) y no
 *      `nextGrowthAt` (una marca de tiempo absoluta). Una marca absoluta
 *      se compara contra el reloj de pared, así que una pestaña cerrada
 *      cuatro horas volvería con todo el campo maduro. Con una cuenta
 *      regresiva, pausar es simplemente dejar de restar: la regla se
 *      cumple sola en vez de depender de que alguien recuerde corregir
 *      las marcas al volver.
 *
 *   2. Las cosechas se registran contra `relojMs`, el TIEMPO JUGADO, no
 *      contra `Date.now()`. Así la producción por minuto mide minutos
 *      jugados: irse a almorzar con la pestaña oculta no hunde la tasa,
 *      pero quedarse mirando sin cosechar sí — que es exactamente lo que
 *      el número tiene que decir.
 *
 * LOS MINERALES SON RECURSOS (PROGRESION.md §2). Cada celda tiene un
 * mineral (o nada: tierra vacía), cada mineral tiene su contador, su
 * valor y su regla, y las reglas son lo que hace que un programa mejor
 * rinda más:
 *
 *   - cosechar verde ROMPE todo lo que no sea chispa;
 *   - prisma y estrella no rebrotan: hay que plantarlos, y plantar cuesta;
 *   - dos estrellas pegadas no crecen.
 *
 * El campo es cuadrado y su lado vive en el estado: agrandar el mundo es
 * cambiar un número, no reescribir esto.
 */

import {
  AJUSTES,
  EVOLUCION,
  MINERALES,
  ORDEN_MINERALES,
  precioEvolucion,
  precioMejora,
  type ClaveMejora,
  type Costo,
  type Mineral,
} from "../../data/automatizacion/balance";
import type { Programa, TipoAccion } from "./programa";

export type Direccion = "north" | "east" | "south" | "west";
export type EtapaCristal = 0 | 1 | 2 | 3;
export type VarianteCristal = Mineral;

export const VARIANTES: readonly VarianteCristal[] = ORDEN_MINERALES;
const RUMBOS: readonly Direccion[] = ["north", "east", "south", "west"];

export interface EstadoNave {
  fila: number;
  col: number;
  direccion: Direccion;
}

export interface Celda {
  etapa: EtapaCristal;
  /** Qué mineral crece acá, o null: tierra vacía, nada plantado. */
  variante: VarianteCristal | null;
  /** Milisegundos de tiempo jugado que faltan para la próxima etapa.
   *  En etapa 3 (madura) no corre: una veta lista espera para siempre. */
  restanteMs: number;
}

/** Una cosecha válida: cuándo (tiempo jugado) y cuánto valió. */
export interface Cosecha {
  t: number;
  v: number;
}

export interface EstadoCampo {
  schemaVersion: 2;
  lado: number;
  nave: EstadoNave;
  celdas: Celda[];
  /** Un contador por mineral. La chispa es "el saldo" del primer día. */
  saldos: Record<Mineral, number>;
  /** Todo lo cosechado en la historia, en VALOR. Mueve el revelado
   *  progresivo, que no puede depender del saldo actual: gastar no
   *  puede volver a esconder una categoría que ya se mostró. */
  acumulado: number;
  /** Cuántas unidades de cada mineral se cosecharon en la historia. */
  cosechados: Record<Mineral, number>;
  /** Nivel de evolución de cada mineral, 1 a 4 (PROGRESION.md §3). */
  niveles: Record<Mineral, number>;
  mejoras: Record<string, number>;
  programa: Programa;
  mejorTasa: number;
  /** Cosechas válidas recientes, para la producción por minuto. */
  cosechas: Cosecha[];
  /** Tiempo jugado acumulado, en ms. El único reloj del mundo. */
  relojMs: number;
}

export type TipoEvento =
  | "move"
  | "turn"
  | "harvest"
  | "bump"
  | "empty_harvest"
  | "break"
  | "plant"
  | "plant_fail"
  | "wait";

export interface EventoPaso {
  nodoId: string;
  tipo: TipoEvento;
  antes: EstadoNave;
  despues: EstadoNave;
  /** Cristales que sumó este paso. Sólo `harvest` la tiene distinta de 0. */
  premio: number;
  /** Índice de la celda afectada, para que la UI sepa qué animar. */
  celda?: number;
  /** El mineral que se cosechó, se rompió o se plantó. */
  mineral?: Mineral;
}

/* ------------------------------------------------------------------ */
/* Estado inicial                                                      */
/* ------------------------------------------------------------------ */

export function porMineral<T>(valor: T): Record<Mineral, T> {
  return { punta: valor, racimo: valor, prisma: valor, estrella: valor };
}

/** La nave siempre empieza abajo a la izquierda, mirando arriba. Es el
 *  muelle: el lugar al que vuelve al terminar o al detener. */
export function origen(lado: number): EstadoNave {
  return { fila: lado - 1, col: 0, direccion: "north" };
}

export function estadoInicial(azar: () => number = Math.random): EstadoCampo {
  void azar;
  const lado = AJUSTES.ladoInicial;
  const celdas: Celda[] = [];
  for (let i = 0; i < lado * lado; i++) {
    celdas.push({ etapa: 0, variante: "punta", restanteMs: AJUSTES.msPorEtapa });
  }

  /* El primer ingreso no tiene tutorial (MVP.md §9): lo que enseña es
     que haya UNA veta madura brillando justo donde está la nave. El
     chico toca `cosechar`, aprieta y algo pasa. Con el campo en 1×1 eso
     es literalmente todo lo que se puede hacer, y esa estrechez es la
     que convierte la primera compra de tierra en un acontecimiento. */
  const idxOrigen = (lado - 1) * lado;
  celdas[idxOrigen] = { etapa: 3, variante: "punta", restanteMs: 0 };
  if (lado > 1) {
    celdas[idxOrigen - lado] = { etapa: 2, variante: "racimo", restanteMs: AJUSTES.msPorEtapa };
  }

  return {
    schemaVersion: 2,
    lado,
    nave: origen(lado),
    celdas,
    saldos: porMineral(0),
    acumulado: 0,
    cosechados: porMineral(0),
    niveles: porMineral(1),
    mejoras: {},
    programa: [],
    mejorTasa: 0,
    cosechas: [],
    relojMs: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Derivados de las mejoras y de los minerales                         */
/* ------------------------------------------------------------------ */

export const nivel = (e: EstadoCampo, clave: ClaveMejora): number => e.mejoras[clave] ?? 0;

export function capacidad(e: EstadoCampo): number {
  return AJUSTES.capacidadInicial + nivel(e, "capacidad");
}

export function msPorAccion(e: EstadoCampo): number {
  const v = AJUSTES.msPorAccion * Math.pow(AJUSTES.factorVelocidad, nivel(e, "velocidad"));
  return Math.max(AJUSTES.msPorAccionMinimo, Math.round(v));
}

/** Tiempo por etapa de la CHISPA con las mejoras de crecimiento. */
export function msPorEtapa(e: EstadoCampo): number {
  const v = AJUSTES.msPorEtapa * Math.pow(AJUSTES.factorCrecimiento, nivel(e, "crecimiento"));
  return Math.max(AJUSTES.msPorEtapaMinimo, Math.round(v));
}

/** Tiempo por etapa de un mineral: el de la chispa por lo lento que es
 *  ese mineral, por lo que lo apura su nivel de evolución. */
export function msPorEtapaDe(e: EstadoCampo, m: Mineral): number {
  const nivelEvo = Math.min(Math.max(e.niveles[m] ?? 1, 1), EVOLUCION.nivelMaximo);
  const v = msPorEtapa(e) * MINERALES[m].factorCrecimiento * EVOLUCION.crecimiento[nivelEvo - 1];
  return Math.max(AJUSTES.msPorEtapaMinimo, Math.round(v));
}

/** Cuánto paga cosechar una veta madura de ese mineral, con su nivel. */
export function valorDe(e: EstadoCampo, m: Mineral): number {
  const nivelEvo = Math.min(Math.max(e.niveles[m] ?? 1, 1), EVOLUCION.nivelMaximo);
  return Math.round(MINERALES[m].valor * EVOLUCION.valor[nivelEvo - 1]);
}

/** ¿Ese mineral ya existe en esta isla? Depende del tamaño del campo. */
export function mineralDisponible(e: EstadoCampo, m: Mineral): boolean {
  return e.lado >= MINERALES[m].desdeLado;
}

/** Los minerales que hoy se pueden plantar con un bloque. */
export function plantables(e: EstadoCampo): Mineral[] {
  return ORDEN_MINERALES.filter((m) => MINERALES[m].semilla !== null && mineralDisponible(e, m));
}

export function tieneRepetir(e: EstadoCampo): boolean {
  return nivel(e, "repetir") > 0;
}

/** Qué piezas de control ya se compraron. */
export function piezasCompradas(e: EstadoCampo): { esperar: boolean; si: boolean; sino: boolean; mientras: boolean; siempre: boolean } {
  return {
    esperar: nivel(e, "esperar") > 0,
    si: nivel(e, "si") > 0,
    sino: nivel(e, "sino") > 0,
    mientras: nivel(e, "mientras") > 0,
    siempre: nivel(e, "siempre") > 0,
  };
}

export const indice = (e: EstadoCampo, fila: number, col: number): number => fila * e.lado + col;

/** ¿Alcanza para pagar ese precio? */
export function alcanza(e: EstadoCampo, costo: Costo): boolean {
  return (Object.entries(costo) as [Mineral, number][]).every(([m, n]) => (e.saldos[m] ?? 0) >= n);
}

function pagar(e: EstadoCampo, costo: Costo): void {
  for (const [m, n] of Object.entries(costo) as [Mineral, number][]) e.saldos[m] -= n;
}

/** Qué brota solo cuando una veta se vacía: chispa, y cuarzo desde la
 *  2×2, a partes iguales. Prisma y estrella nunca: se plantan. */
function rebroteAzar(e: EstadoCampo, azar: () => number): Mineral {
  const candidatos = ORDEN_MINERALES.filter((m) => MINERALES[m].rebrotaSolo && mineralDisponible(e, m));
  return candidatos[Math.floor(azar() * candidatos.length)] ?? "punta";
}

/** Una veta que acaba de vaciarse: rebrota sola o queda como tierra. */
function reiniciar(e: EstadoCampo, celda: Celda, azar: () => number): void {
  const anterior = celda.variante;
  if (anterior && MINERALES[anterior].rebrotaSolo) {
    const nuevo = rebroteAzar(e, azar);
    celda.variante = nuevo;
    celda.etapa = 0;
    celda.restanteMs = msPorEtapaDe(e, nuevo);
  } else {
    celda.variante = null;
    celda.etapa = 0;
    celda.restanteMs = 0;
  }
}

/** ¿Alguna vecina (fila o columna) tiene ese mineral? Es la regla de
 *  espaciado de la estrella: pegadas, ninguna crece. */
export function vecinaCon(e: EstadoCampo, idx: number, m: Mineral): boolean {
  const fila = Math.floor(idx / e.lado);
  const col = idx % e.lado;
  const vecinas = [
    [fila - 1, col],
    [fila + 1, col],
    [fila, col - 1],
    [fila, col + 1],
  ];
  return vecinas.some(
    ([f, c]) => f >= 0 && c >= 0 && f < e.lado && c < e.lado && e.celdas[indice(e, f, c)].variante === m,
  );
}

/* ------------------------------------------------------------------ */
/* El reloj del mundo                                                  */
/* ------------------------------------------------------------------ */

/** Hace correr el mundo `dtMs` de tiempo jugado: las vetas crecen aunque
 *  el programa esté detenido, que es lo que hace que el campo se sienta
 *  vivo mientras el chico piensa.
 *
 *  El `dt` se recorta a `dtMaximoMs`. Ese recorte es la regla "no hay
 *  crecimiento offline" hecha código: una pestaña que vuelve del fondo o
 *  un frame trabado entregan un salto enorme, y sin el recorte ese salto
 *  se convertiría en cosechas regaladas.
 *
 *  Muta el estado en vez de copiarlo: corre en cada frame y clonar un
 *  campo entero sesenta veces por segundo es basura para el recolector.
 *  Quien lo llama avisa a React con un contador de versión. */
export function avanzarMundo(e: EstadoCampo, dtMs: number): boolean {
  const dt = Math.min(Math.max(dtMs, 0), AJUSTES.dtMaximoMs);
  if (dt === 0) return false;

  e.relojMs += dt;
  let cambio = false;

  e.celdas.forEach((celda, i) => {
    if (!celda.variante || celda.etapa >= 3) return;
    // Dos estrellas pegadas: ninguna de las dos avanza.
    if (MINERALES[celda.variante].espaciado && vecinaCon(e, i, celda.variante)) return;
    const paso = msPorEtapaDe(e, celda.variante);
    celda.restanteMs -= dt;
    /* El sobrante se arrastra a la etapa siguiente en vez de perderse:
       si no, con `dt` grandes el crecimiento se atrasaría de a poquito
       en cada etapa y el campo iría quedando lento sin motivo visible. */
    while (celda.restanteMs <= 0 && celda.etapa < 3) {
      celda.etapa = (celda.etapa + 1) as EtapaCristal;
      celda.restanteMs += paso;
      cambio = true;
    }
    if (celda.etapa >= 3) celda.restanteMs = 0;
  });

  return cambio;
}

/* ------------------------------------------------------------------ */
/* Ejecución de un paso                                                */
/* ------------------------------------------------------------------ */

function girar(d: Direccion, hacia: -1 | 1): Direccion {
  const i = RUMBOS.indexOf(d);
  return RUMBOS[(i + hacia + RUMBOS.length) % RUMBOS.length];
}

/** Ejecuta UNA instrucción y devuelve qué pasó. Muta el estado.
 *
 *  Las acciones inútiles no son errores y no interrumpen nada (MVP.md
 *  §6): chocar contra el borde consume el turno y sigue, cosechar en
 *  vacío consume el turno y no paga, plantar donde no se puede no hace
 *  nada. Que el desperdicio se VEA es lo que después crea la necesidad
 *  de sensores; un cartel de error, no.
 *
 *  Y una acción inútil que además CUESTA: cosechar verde rompe el
 *  cristal (salvo la chispa). Es el precio de no mirar. */
export function ejecutarPaso(
  e: EstadoCampo,
  nodoId: string,
  tipo: TipoAccion,
  azar: () => number = Math.random,
  mineral?: Mineral,
): EventoPaso {
  const antes: EstadoNave = { ...e.nave };
  const quieto = (): EstadoNave => ({ ...e.nave });

  if (tipo === "wait") {
    // Esperar: un turno entero sin hacer nada. La paciencia explícita.
    return { nodoId, tipo: "wait", antes, despues: quieto(), premio: 0 };
  }

  if (tipo === "turn_left" || tipo === "turn_right") {
    e.nave.direccion = girar(e.nave.direccion, tipo === "turn_left" ? -1 : 1);
    return { nodoId, tipo: "turn", antes, despues: quieto(), premio: 0 };
  }

  if (tipo === "move_forward" || tipo === "move_back") {
    /* Retroceder es avanzar al revés y SIN GIRAR: la nave sigue mirando
       a donde miraba. Es lo que hace que sirva —dar marcha atrás una
       baldosa cuesta un bloque en vez de tres (girar, girar, avanzar)—
       y lo que evita que un chico tenga que razonar la orientación para
       resolver un desvío de una casilla. */
    const atras = tipo === "move_back" ? -1 : 1;
    let { fila, col } = e.nave;
    if (e.nave.direccion === "north") fila -= atras;
    else if (e.nave.direccion === "south") fila += atras;
    else if (e.nave.direccion === "east") col += atras;
    else col -= atras;

    const afuera = fila < 0 || col < 0 || fila >= e.lado || col >= e.lado;
    if (afuera) {
      return { nodoId, tipo: "bump", antes, despues: quieto(), premio: 0 };
    }
    e.nave.fila = fila;
    e.nave.col = col;
    return { nodoId, tipo: "move", antes, despues: quieto(), premio: 0 };
  }

  const idx = indice(e, e.nave.fila, e.nave.col);
  const celda = e.celdas[idx];

  if (tipo === "plant") {
    const m = mineral;
    const semilla = m ? MINERALES[m].semilla : null;
    const sePuede =
      !!m &&
      !!celda &&
      celda.variante === null &&
      semilla !== null &&
      mineralDisponible(e, m) &&
      alcanza(e, semilla) &&
      !(MINERALES[m].espaciado && vecinaCon(e, idx, m));
    if (!sePuede || !m || !semilla) {
      return { nodoId, tipo: "plant_fail", antes, despues: quieto(), premio: 0, celda: idx, mineral: m };
    }
    pagar(e, semilla);
    celda.variante = m;
    celda.etapa = 0;
    celda.restanteMs = msPorEtapaDe(e, m);
    return { nodoId, tipo: "plant", antes, despues: quieto(), premio: 0, celda: idx, mineral: m };
  }

  // harvest
  if (!celda || celda.variante === null || celda.etapa === 0) {
    return { nodoId, tipo: "empty_harvest", antes, despues: quieto(), premio: 0, celda: idx };
  }
  const v = celda.variante;
  if (celda.etapa < 3) {
    if (!MINERALES[v].seRompeVerde) {
      return { nodoId, tipo: "empty_harvest", antes, despues: quieto(), premio: 0, celda: idx, mineral: v };
    }
    // Cosechado verde: se rompe. Vuelve a cero (o a tierra) y no paga.
    reiniciar(e, celda, azar);
    return { nodoId, tipo: "break", antes, despues: quieto(), premio: 0, celda: idx, mineral: v };
  }

  const premio = valorDe(e, v);
  e.saldos[v] += premio;
  e.acumulado += premio;
  e.cosechados[v] += 1;
  e.cosechas.push({ t: e.relojMs, v: premio });
  podarCosechas(e);

  /* La veta se vacía: rebrota sola si es de las que rebrotan, o queda
     como tierra esperando que alguien plante. El campo no se queda
     quieto en el mismo dibujo partida tras partida. */
  reiniciar(e, celda, azar);

  return { nodoId, tipo: "harvest", antes, despues: quieto(), premio, celda: idx, mineral: v };
}

/** Devuelve la nave al muelle. No es una instrucción programable y no
 *  toca nada más: campo, edades y saldo quedan como estaban. */
export function volverAlOrigen(e: EstadoCampo): void {
  e.nave = origen(e.lado);
}

/* ------------------------------------------------------------------ */
/* Producción reciente                                                 */
/* ------------------------------------------------------------------ */

function podarCosechas(e: EstadoCampo): void {
  const corte = e.relojMs - AJUSTES.ventanaTasaMs;
  let i = 0;
  while (i < e.cosechas.length && e.cosechas[i].t < corte) i++;
  if (i > 0) e.cosechas.splice(0, i);
}

/** Valor cosechado por minuto en la ventana reciente. En VALOR y no en
 *  unidades: es el número que dice si el programa nuevo es mejor, y una
 *  estrella tiene que pesar más que quince chispas juntas… igual.
 *
 *  Al principio la ventana todavía no se llenó, así que se divide por lo
 *  jugado y no por la ventana entera — si no, los primeros cuarenta
 *  segundos mostrarían una tasa artificialmente baja justo cuando el
 *  chico está mirando si lo que hizo sirvió. El piso de 15 s evita el
 *  otro extremo: una cosecha en el primer segundo no vale 60/min. */
export function tasaReciente(e: EstadoCampo): number {
  podarCosechas(e);
  const ventana = Math.max(15_000, Math.min(AJUSTES.ventanaTasaMs, e.relojMs));
  const valor = e.cosechas.reduce((s, c) => s + c.v, 0);
  return (valor * 60_000) / ventana;
}

/** Actualiza el récord personal si corresponde. Pide una muestra mínima
 *  para que una racha corta de suerte no clave una marca inalcanzable. */
export function actualizarRecord(e: EstadoCampo): number {
  if (e.cosechas.length < AJUSTES.minCosechasParaRecord) return e.mejorTasa;
  const tasa = tasaReciente(e);
  if (tasa > e.mejorTasa) e.mejorTasa = tasa;
  return e.mejorTasa;
}

/* ------------------------------------------------------------------ */
/* Economía                                                            */
/* ------------------------------------------------------------------ */

/** Compra un nivel de una mejora. Devuelve false si no alcanza o si ya
 *  está al tope; la UI responde con el pulso que conecta precio y
 *  contador, nunca con un modal. */
export function comprar(e: EstadoCampo, clave: ClaveMejora, azar: () => number = Math.random): boolean {
  const actual = nivel(e, clave);
  const precio = precioMejora(clave, actual);
  if (precio === null || !alcanza(e, precio)) return false;
  pagar(e, precio);
  e.mejoras[clave] = actual + 1;
  if (clave === "campo") expandirCampo(e, azar);
  return true;
}

/** Sube un mineral de nivel (PROGRESION.md §3). Misma respuesta que
 *  `comprar`: false si no alcanza o ya está en 4. */
export function evolucionar(e: EstadoCampo, m: Mineral): boolean {
  const actual = e.niveles[m] ?? 1;
  const precio = precioEvolucion(m, actual);
  if (precio === null || !alcanza(e, precio)) return false;
  pagar(e, precio);
  e.niveles[m] = actual + 1;
  return true;
}

/** Agranda el campo un lado y conserva lo que ya había crecido.
 *
 *  La tierra nueva aparece ARRIBA y a la DERECHA, nunca abajo a la
 *  izquierda: ahí está el muelle, y si el origen se moviera, todos los
 *  programas guardados quedarían corridos una baldosa y el chico vería
 *  su rutina fallar sin entender por qué. Con esta regla, un programa
 *  que funcionaba sigue funcionando después de comprar tierra — sólo
 *  deja de aprovechar todo el campo, que es exactamente la invitación a
 *  reescribirlo. */
export function expandirCampo(e: EstadoCampo, azar: () => number = Math.random): boolean {
  if (e.lado >= AJUSTES.ladoMaximo) return false;
  const anterior = e.lado;
  const nuevo = anterior + 1;
  const viejas = e.celdas;
  const celdas: Celda[] = [];

  // El lado nuevo decide qué puede brotar en la tierra nueva.
  e.lado = nuevo;
  for (let fila = 0; fila < nuevo; fila++) {
    for (let col = 0; col < nuevo; col++) {
      // La fila 0 es el norte; al crecer, lo viejo baja una fila.
      const filaVieja = fila - 1;
      const esVieja = filaVieja >= 0 && col < anterior;
      if (esVieja) {
        celdas.push(viejas[filaVieja * anterior + col]);
      } else {
        const m = rebroteAzar(e, azar);
        celdas.push({ etapa: 0, variante: m, restanteMs: msPorEtapaDe(e, m) });
      }
    }
  }

  e.celdas = celdas;
  e.nave = origen(nuevo);
  return true;
}

/** Qué categorías de la tienda ya se ganaron el derecho a mostrarse.
 *  De a una, por era, por lo cosechado en total o por haber cosechado
 *  un mineral: nunca cinco candados el primer día (MVP.md §8). */
export function reveladas(e: EstadoCampo): string[] {
  return Object.entries(AJUSTES.revelado)
    .filter(([, regla]) => {
      if (regla.lado !== undefined && e.lado < regla.lado) return false;
      if (regla.acumulado !== undefined && e.acumulado < regla.acumulado) return false;
      if (regla.cosechado && (e.cosechados[regla.cosechado[0]] ?? 0) < regla.cosechado[1]) return false;
      if (regla.requiere !== undefined && (e.mejoras[regla.requiere] ?? 0) < 1) return false;
      return true;
    })
    .map(([clave]) => clave);
}
