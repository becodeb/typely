/* El programa que el chico arma: el árbol, su validación y su expansión.
 *
 * En la ficción es la LIBRETA DEL NAVEGANTE — la lista de instrucciones
 * que el robot de la izquierda va a leer en voz alta para que el de la
 * derecha maneje. Por eso el bloque activo se ilumina: es el renglón que
 * está leyendo.
 *
 * Tres reglas que no se negocian (IMPLEMENTACION.md §3):
 *
 *   1. NUNCA se genera ni se evalúa JavaScript. Nada de `eval`, `Function`
 *      ni scripts dinámicos. Los bloques son datos, y el intérprete
 *      (interprete.ts) los recorre. Un editor de bloques que compila a
 *      código es un agujero de seguridad servido a un menor de edad.
 *   2. Todo lo que entra se valida. Un snapshot guardado puede venir de
 *      una versión vieja, de otro dispositivo o de alguien jugando con el
 *      localStorage; si no cierra, se descarta entero y se arranca limpio.
 *   3. Todo está acotado: profundidad, valor de N, cantidad de nodos y
 *      pasos expandidos.
 *
 * Los identificadores (`move_forward`, `repeat`, …) están en inglés a
 * propósito: son el formato PERSISTIDO, el contrato con los snapshots ya
 * guardados, y nunca se le muestran a nadie.
 *
 * CUATRO CONTENEDORES (PROGRESION.md §5): `Repetir N`, `Por siempre`,
 * `Mientras [sensor]` y `Si [sensor]` (con o sin `sino`). Todos tienen un
 * cuerpo; `Si` puede tener dos. Todo lo que recorre el árbol lo hace por
 * `ramas()`, así agregar un contenedor nuevo es agregar un tipo, no
 * tocar diez funciones.
 */

import { AJUSTES, MINERALES, type Mineral } from "../../data/automatizacion/balance";

export type TipoAccion =
  | "move_forward"
  | "move_back"
  | "turn_left"
  | "turn_right"
  | "harvest"
  | "plant"
  | "wait";

export interface NodoAccion {
  id: string;
  type: TipoAccion;
  /** Sólo `plant`: qué mineral se planta. */
  mineral?: Mineral;
}

/** Lo que la nave puede mirar en la baldosa donde está parada. */
export type TipoSensor = "listo" | "vacia" | "es" | "borde";

export interface Sensor {
  tipo: TipoSensor;
  /** Sólo `es`: qué mineral. */
  mineral?: Mineral;
  /** Negado: "no está listo", "no está vacía"… */
  no?: boolean;
}

export interface NodoRepetir {
  id: string;
  type: "repeat";
  times: number;
  body: NodoPrograma[];
}

export interface NodoSiempre {
  id: string;
  type: "forever";
  body: NodoPrograma[];
}

export interface NodoMientras {
  id: string;
  type: "while";
  sensor: Sensor;
  body: NodoPrograma[];
}

export interface NodoSi {
  id: string;
  type: "if";
  sensor: Sensor;
  body: NodoPrograma[];
  /** Presente sólo en el `Si / sino`. */
  sino?: NodoPrograma[];
}

export type NodoContenedor = NodoRepetir | NodoSiempre | NodoMientras | NodoSi;
export type NodoPrograma = NodoAccion | NodoContenedor;
export type Programa = NodoPrograma[];

const ACCIONES: readonly TipoAccion[] = [
  "move_forward",
  "move_back",
  "turn_left",
  "turn_right",
  "harvest",
  "plant",
  "wait",
];
const SENSORES: readonly TipoSensor[] = ["listo", "vacia", "es", "borde"];
const CONTENEDORES = ["repeat", "forever", "while", "if"] as const;

export function esContenedor(n: NodoPrograma): n is NodoContenedor {
  return (CONTENEDORES as readonly string[]).includes(n.type);
}

export function esRepetir(n: NodoPrograma): n is NodoRepetir {
  return n.type === "repeat";
}

/** ¿Tiene sensor? `Mientras` y `Si`. */
export function conSensor(n: NodoPrograma): n is NodoMientras | NodoSi {
  return n.type === "while" || n.type === "if";
}

/** Las cavidades de un contenedor: el cuerpo, y el `sino` si lo hay. */
export type Rama = "body" | "sino";

export function ramas(n: NodoContenedor): Rama[] {
  return n.type === "if" && n.sino ? ["body", "sino"] : ["body"];
}

export function listaDeRama(n: NodoContenedor, rama: Rama): NodoPrograma[] {
  return rama === "sino" && n.type === "if" ? (n.sino ?? []) : n.body;
}

function conRama(n: NodoContenedor, rama: Rama, lista: NodoPrograma[]): NodoContenedor {
  if (rama === "sino" && n.type === "if") return { ...n, sino: lista };
  return { ...n, body: lista } as NodoContenedor;
}

/** Id estable y corto. Sirve para resaltar el bloque que se está ejecutando. */
export function nuevoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ------------------------------------------------------------------ */
/* Capacidad                                                           */
/* ------------------------------------------------------------------ */

/** Unidades de memoria que ocupa el programa.
 *
 *  Cada acción vale 1, y un contenedor vale 1 MÁS lo que tenga adentro
 *  (MVP.md §7), en todas sus cavidades. Que el contenido cuente es
 *  justamente lo que hace interesante al bucle: `Repetir 4 [avanzar,
 *  cosechar]` ocupa 3 ranuras y produce 8 acciones. Si el contenido
 *  fuera gratis, la respuesta óptima sería siempre un `Repetir` con todo
 *  adentro y no habría nada que pensar. */
export function capacidadUsada(programa: Programa): number {
  let total = 0;
  for (const nodo of programa) {
    total += 1;
    if (esContenedor(nodo)) for (const r of ramas(nodo)) total += capacidadUsada(listaDeRama(nodo, r));
  }
  return total;
}

/** ¿Entra un nodo más de tamaño `costo` sin pasarse de `capacidad`? */
export function entra(programa: Programa, capacidad: number, costo = 1): boolean {
  return capacidadUsada(programa) + costo <= capacidad;
}

/** Costo en memoria de quitar/agregar ese nodo (él más su contenido). */
export function costoDeNodo(nodo: NodoPrograma): number {
  return esContenedor(nodo) ? 1 + ramas(nodo).reduce((s, r) => s + capacidadUsada(listaDeRama(nodo, r)), 0) : 1;
}

/** Cuántos contenedores hay anidados dentro de un nodo, contándolo:
 *  una acción mide 0, un `Si` con acciones adentro 1, un `Repetir` con
 *  un `Si` adentro 2. Es lo que se suma a la profundidad del lugar
 *  donde se suelta para saber si cabe. */
export function alturaDe(nodo: NodoPrograma): number {
  if (!esContenedor(nodo)) return 0;
  let max = 0;
  for (const r of ramas(nodo)) for (const h of listaDeRama(nodo, r)) max = Math.max(max, alturaDe(h));
  return 1 + max;
}

/* ------------------------------------------------------------------ */
/* Validación                                                          */
/* ------------------------------------------------------------------ */

function validarSensor(valor: unknown): Sensor | null {
  if (typeof valor !== "object" || valor === null) return null;
  const s = valor as Record<string, unknown>;
  if (typeof s.tipo !== "string" || !SENSORES.includes(s.tipo as TipoSensor)) return null;
  const sensor: Sensor = { tipo: s.tipo as TipoSensor };
  if (s.tipo === "es") {
    if (typeof s.mineral !== "string" || !(s.mineral in MINERALES)) return null;
    sensor.mineral = s.mineral as Mineral;
  }
  if (s.no === true) sensor.no = true;
  return sensor;
}

function validarLista(valor: unknown, profundidad: number, contador: { n: number }): NodoPrograma[] | null {
  if (!Array.isArray(valor)) return null;
  const salida: NodoPrograma[] = [];
  for (const hijo of valor) {
    const v = validarNodo(hijo, profundidad, contador);
    if (!v) return null;
    salida.push(v);
  }
  return salida;
}

function validarNodo(valor: unknown, profundidad: number, contador: { n: number }): NodoPrograma | null {
  if (typeof valor !== "object" || valor === null) return null;
  const n = valor as Record<string, unknown>;
  if (typeof n.id !== "string" || n.id.length === 0 || n.id.length > 40) return null;
  if (typeof n.type !== "string") return null;

  contador.n += 1;
  if (contador.n > AJUSTES.maxNodos) return null;

  if (n.type === "plant") {
    if (typeof n.mineral !== "string" || !(n.mineral in MINERALES)) return null;
    if (MINERALES[n.mineral as Mineral].semilla === null) return null;
    return { id: n.id, type: "plant", mineral: n.mineral as Mineral };
  }

  if (ACCIONES.includes(n.type as TipoAccion)) {
    return { id: n.id, type: n.type as TipoAccion };
  }

  if (!(CONTENEDORES as readonly string[]).includes(n.type)) return null;
  if (profundidad >= AJUSTES.maxProfundidad) return null;
  // `Por siempre` sólo al nivel de la libreta: adentro de otro bucle no
  // significa nada que un chico pueda leer.
  if (n.type === "forever" && profundidad > 0) return null;

  const body = validarLista(n.body, profundidad + 1, contador);
  if (!body) return null;

  if (n.type === "repeat") {
    if (typeof n.times !== "number" || !Number.isInteger(n.times)) return null;
    if (!(AJUSTES.opcionesRepetir as readonly number[]).includes(n.times)) return null;
    return { id: n.id, type: "repeat", times: n.times, body };
  }
  if (n.type === "forever") return { id: n.id, type: "forever", body };

  const sensor = validarSensor(n.sensor);
  if (!sensor) return null;
  if (n.type === "while") return { id: n.id, type: "while", sensor, body };

  const nodo: NodoSi = { id: n.id, type: "if", sensor, body };
  if (n.sino !== undefined) {
    const sino = validarLista(n.sino, profundidad + 1, contador);
    if (!sino) return null;
    nodo.sino = sino;
  }
  return nodo;
}

/** Valida un programa venido de JSON. Devuelve null si algo no cierra:
 *  se descarta ENTERO, nunca a medias. Un programa parcialmente válido
 *  es peor que ninguno — el chico vería su libreta mutilada sin saber
 *  por qué. */
export function validarPrograma(valor: unknown): Programa | null {
  if (!Array.isArray(valor)) return null;
  const contador = { n: 0 };
  return validarLista(valor, 0, contador);
}

/* ------------------------------------------------------------------ */
/* Expansión                                                           */
/* ------------------------------------------------------------------ */

export interface PasoExpandido {
  /** Id del nodo que produce este paso — es el bloque que se ilumina. */
  nodoId: string;
  tipo: TipoAccion;
  /** Sólo `plant`: qué mineral. */
  mineral?: Mineral;
  /** Id del contenedor que lo contiene, si está adentro de uno. El
   *  contenedor late en cada vuelta y esto es lo que lo permite. */
  contenedorId?: string;
  /** Vuelta actual del contenedor, empezando en 1. */
  vuelta?: number;
}

/** Aplana el árbol a la lista de pasos que la nave va a ejecutar.
 *
 *  Sirve para programas SIN SENSORES: `Repetir` y `Por siempre` (que se
 *  corta en el tope). Un `Si` o un `Mientras` dependen del campo en el
 *  momento, así que acá se saltean: el juego los corre con el intérprete
 *  (interprete.ts), y esto queda para simular y examinar rutas fijas.
 *
 *  Si se alcanza el tope, la lista se corta y `completo` queda en false.
 *  Llegar al tope NO es un error: la corrida simplemente termina, igual
 *  que si hubiera terminado sola. */
export function expandir(programa: Programa, maxPasos = AJUSTES.maxPasosEjecucion): {
  pasos: PasoExpandido[];
  completo: boolean;
} {
  const pasos: PasoExpandido[] = [];
  let completo = true;

  const recorrer = (nodos: Programa, contenedorId?: string, vuelta?: number): void => {
    for (const nodo of nodos) {
      if (!completo) return;
      if (nodo.type === "repeat") {
        for (let v = 1; v <= nodo.times; v++) {
          recorrer(nodo.body, nodo.id, v);
          if (!completo) return;
        }
        continue;
      }
      if (nodo.type === "forever") {
        for (let v = 1; completo; v++) {
          if (nodo.body.length === 0) {
            completo = false;
            return;
          }
          recorrer(nodo.body, nodo.id, v);
        }
        return;
      }
      if (esContenedor(nodo)) continue; // con sensor: no se puede expandir a ciegas
      if (pasos.length >= maxPasos) {
        completo = false;
        return;
      }
      pasos.push({ nodoId: nodo.id, tipo: nodo.type, mineral: nodo.mineral, contenedorId, vuelta });
    }
  };

  recorrer(programa);
  return { pasos, completo };
}

/* ------------------------------------------------------------------ */
/* Edición del árbol                                                   */
/* ------------------------------------------------------------------ */

/** Quita un nodo del árbol por id, mire donde mire. Devuelve un árbol
 *  nuevo: el programa es inmutable durante una corrida y React necesita
 *  la identidad cambiada para repintar. */
export function quitarNodo(programa: Programa, id: string): Programa {
  const salida: Programa = [];
  for (const nodo of programa) {
    if (nodo.id === id) continue;
    if (esContenedor(nodo)) {
      let copia: NodoContenedor = nodo;
      for (const r of ramas(nodo)) copia = conRama(copia, r, quitarNodo(listaDeRama(nodo, r), id));
      salida.push(copia);
    } else {
      salida.push(nodo);
    }
  }
  return salida;
}

/** Busca un nodo por id, mire donde mire. */
export function buscarNodo(programa: Programa, id: string): NodoPrograma | null {
  for (const nodo of programa) {
    if (nodo.id === id) return nodo;
    if (esContenedor(nodo)) {
      for (const r of ramas(nodo)) {
        const dentro = buscarNodo(listaDeRama(nodo, r), id);
        if (dentro) return dentro;
      }
    }
  }
  return null;
}

/** ¿Está `id` en alguna cavidad de `nodo`, a cualquier profundidad? */
export function contiene(nodo: NodoPrograma, id: string): boolean {
  if (!esContenedor(nodo)) return false;
  return ramas(nodo).some((r) => buscarNodo(listaDeRama(nodo, r), id) !== null);
}

/** A qué profundidad está la LISTA que contiene a `id`: 0 la libreta,
 *  1 adentro de un contenedor de la libreta, etc. Null si no está. */
export function profundidadDe(programa: Programa, id: string, nivel = 0): number | null {
  for (const nodo of programa) {
    if (nodo.id === id) return nivel;
    if (esContenedor(nodo)) {
      for (const r of ramas(nodo)) {
        const p = profundidadDe(listaDeRama(nodo, r), id, nivel + 1);
        if (p !== null) return p;
      }
    }
  }
  return null;
}

/** ¿Cabe `nodo` en una lista que está a `profundidad`? El tope de
 *  anidamiento vale para todo lo que se suelte; `Por siempre` además
 *  sólo va en la libreta. */
export function cabeA(nodo: NodoPrograma, profundidad: number): boolean {
  if (nodo.type === "forever" && profundidad > 0) return false;
  return profundidad + alturaDe(nodo) <= AJUSTES.maxProfundidad;
}

/** Mete `nodo` justo ANTES del bloque `idDestino`, esté donde esté —
 *  también adentro de un contenedor. Es lo que hace que arrastrar una
 *  pieza al medio de la pila la inserte ahí y no al final. Devuelve el
 *  mismo programa si no cabe. */
export function insertarAntes(programa: Programa, nodo: NodoPrograma, idDestino: string): Programa {
  const prof = profundidadDe(programa, idDestino);
  if (prof === null || !cabeA(nodo, prof)) return programa;
  return insertarAntesSinMirar(programa, nodo, idDestino);
}

function insertarAntesSinMirar(programa: Programa, nodo: NodoPrograma, idDestino: string): Programa {
  const salida: Programa = [];
  let puesto = false;
  for (const n of programa) {
    if (n.id === idDestino) {
      salida.push(nodo);
      puesto = true;
    }
    if (esContenedor(n) && !puesto) {
      let copia: NodoContenedor = n;
      let cambio = false;
      for (const r of ramas(n)) {
        const lista = listaDeRama(n, r);
        const nueva = insertarAntesSinMirar(lista, nodo, idDestino);
        if (nueva !== lista) {
          copia = conRama(copia, r, nueva);
          cambio = true;
        }
      }
      if (cambio) {
        salida.push(copia);
        puesto = true;
        continue;
      }
    }
    salida.push(n);
  }
  return puesto ? salida : programa;
}

/** Mete `nodo` al final de una cavidad del contenedor `idContenedor`.
 *  Devuelve el mismo programa si no cabe (tope de anidamiento, o un
 *  `Por siempre` que sólo va en la libreta). */
export function insertarEn(programa: Programa, nodo: NodoPrograma, idContenedor: string, rama: Rama = "body"): Programa {
  const prof = profundidadDe(programa, idContenedor);
  if (prof === null || !cabeA(nodo, prof + 1)) return programa;
  return insertarEnSinMirar(programa, nodo, idContenedor, rama);
}

function insertarEnSinMirar(programa: Programa, nodo: NodoPrograma, idContenedor: string, rama: Rama): Programa {
  let puesto = false;
  const salida = programa.map((n) => {
    if (!esContenedor(n)) return n;
    if (n.id === idContenedor) {
      if (!ramas(n).includes(rama)) return n;
      puesto = true;
      return conRama(n, rama, [...listaDeRama(n, rama), nodo]);
    }
    let copia: NodoContenedor = n;
    for (const r of ramas(n)) {
      const lista = listaDeRama(n, r);
      const nueva = insertarEnSinMirar(lista, nodo, idContenedor, rama);
      if (nueva !== lista) {
        copia = conRama(copia, r, nueva);
        puesto = true;
      }
    }
    return copia;
  });
  return puesto ? salida : programa;
}

/* ------------------------------------------------------------------ */
/* Dónde cae una pieza                                                 */
/* ------------------------------------------------------------------ */

/** A dónde va una pieza cuando se suelta. Es lo que el editor calcula
 *  mientras el chico arrastra, y lo único que le pasa a la página. */
export type Destino =
  | { tipo: "final" }
  | { tipo: "antes"; id: string }
  | { tipo: "dentro"; id: string; rama?: Rama };

/** La lista que contiene a `id` —el programa mismo o una cavidad— y ese
 *  contenedor si lo hay. */
export function listaDe(
  programa: Programa,
  id: string,
): { lista: NodoPrograma[]; contenedor: NodoContenedor | null; rama: Rama } | null {
  for (const n of programa) {
    if (n.id === id) return { lista: programa, contenedor: null, rama: "body" };
    if (esContenedor(n)) {
      for (const r of ramas(n)) {
        const lista = listaDeRama(n, r);
        if (lista.some((h) => h.id === id)) return { lista, contenedor: n, rama: r };
        const hondo = listaDe(lista, id);
        if (hondo) return hondo;
      }
    }
  }
  return null;
}

/** ¿Está `id` adentro de un contenedor? */
export function estaAnidado(programa: Programa, id: string): boolean {
  return listaDe(programa, id)?.contenedor !== null;
}

/** El lugar "justo después" de un bloque: antes de su siguiente hermano,
 *  o al final de su lista. Sirve para soltar en la mitad de abajo de un
 *  bloque y para saber si un destino es "el mismo lugar" de donde salió. */
export function despuesDe(programa: Programa, id: string): Destino {
  const donde = listaDe(programa, id);
  if (!donde) return { tipo: "final" };
  const i = donde.lista.findIndex((n) => n.id === id);
  const siguiente = donde.lista[i + 1];
  if (siguiente) return { tipo: "antes", id: siguiente.id };
  return donde.contenedor ? { tipo: "dentro", id: donde.contenedor.id, rama: donde.rama } : { tipo: "final" };
}

/** Pone `nodo` en `destino`. Devuelve el MISMO programa si no se pudo:
 *  el anidamiento tiene tope, y `Por siempre` sólo va en la libreta. */
export function colocar(programa: Programa, nodo: NodoPrograma, destino: Destino): Programa {
  if (destino.tipo === "final") return [...programa, nodo];
  if (destino.tipo === "dentro") return insertarEn(programa, nodo, destino.id, destino.rama ?? "body");
  return insertarAntes(programa, nodo, destino.id);
}

/** Mueve un bloque que ya está en el programa a otro lugar. Es quitar y
 *  colocar, con dos guardas: no se puede soltar un contenedor adentro de
 *  sí mismo, y soltar donde ya estaba no cambia nada. Si el destino no
 *  es válido devuelve el programa original, nunca uno sin el bloque. */
export function moverNodo(programa: Programa, id: string, destino: Destino): Programa {
  const nodo = buscarNodo(programa, id);
  if (!nodo) return programa;
  if (destino.tipo !== "final") {
    if (destino.id === id) return programa;
    if (contiene(nodo, destino.id)) return programa;
  }
  const sin = quitarNodo(programa, id);
  const con = colocar(sin, nodo, destino);
  return con === sin ? programa : con;
}

/** Corre un bloque un lugar hacia arriba o hacia abajo dentro de su
 *  lista. Es la alternativa de teclado al arrastre: arrastrar nunca es
 *  la única forma de editar (MVP.md §7). */
export function desplazarNodo(programa: Programa, id: string, delta: -1 | 1): Programa {
  const donde = listaDe(programa, id);
  if (!donde) return programa;
  const i = donde.lista.findIndex((n) => n.id === id);
  const j = i + delta;
  if (j < 0 || j >= donde.lista.length) return programa;
  const lista = [...donde.lista];
  [lista[i], lista[j]] = [lista[j], lista[i]];
  if (!donde.contenedor) return lista;
  const c = donde.contenedor;
  const reemplazar = (nodos: Programa): Programa =>
    nodos.map((n) => {
      if (!esContenedor(n)) return n;
      if (n.id === c.id) return conRama(n, donde.rama, lista);
      let copia: NodoContenedor = n;
      for (const r of ramas(n)) copia = conRama(copia, r, reemplazar(listaDeRama(n, r)));
      return copia;
    });
  return reemplazar(programa);
}
