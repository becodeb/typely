/* El programa que el chico arma: el árbol, su validación y su expansión.
 *
 * En la ficción es la LIBRETA DEL NAVEGANTE — la lista de instrucciones
 * que el robot de la izquierda va a leer en voz alta para que el de la
 * derecha maneje. Por eso el bloque activo se ilumina: es el renglón que
 * está leyendo.
 *
 * Desde el Lienzo (automatizacion-lienzo-de-bloques): `Programa` sigue
 * siendo exactamente el mismo tipo, pero cambia de SENTIDO — ahora es la
 * cadena que cuelga del bloque verde de arranque. `EstadoCampo.rutinas` y
 * `.pilasSueltas` (motor.ts) son sus hermanos en el lienzo; este archivo
 * sigue sin saber nada de ellos como GEOMETRÍA (decisión de diseño #2:
 * `programa.ts` se queda libre de estado de mundo), pero sí sabe agarrar,
 * cortar y recomponer una CADENA de nodos (`cortarDesde`, `cortarEn`,
 * `colocarCadena`) y sumar la capacidad de cualquier colección de listas
 * de nodos (`capacidadDeLienzo`, con un parámetro estructural en vez de
 * un `Pila` importado).
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
import { MAX_LLAMADAS_ANIDADAS } from "./limites";

/* Las cuatro direcciones absolutas (`move_north`…`move_west`) son las que
   hoy salen de la caja: la nave gira sola hacia donde se mueve, así que
   el chico piensa "arriba" y no "girar, girar, avanzar".

   `move_forward`, `move_back`, `turn_left` y `turn_right` SIGUEN siendo
   tipos válidos y ejecutables: hay programas ya guardados que los usan y
   `validarNodo` descarta el snapshot entero —y con él toda la partida—
   si aparece un tipo que no reconoce. Se quitaron de la caja, no del
   contrato. */
export type TipoAccion =
  | "move_north"
  | "move_east"
  | "move_south"
  | "move_west"
  | "move_forward"
  | "move_back"
  | "turn_left"
  | "turn_right"
  | "harvest"
  | "clear"
  | "plant"
  | "wait";

export interface NodoAccion {
  id: string;
  type: TipoAccion;
  /** Sólo `plant`: qué mineral se planta. */
  mineral?: Mineral;
}

/** Lo que la nave puede mirar en la baldosa donde está parada. */
export type TipoSensor = "listo" | "vacia" | "es" | "borde" | "contador";

export interface Sensor {
  tipo: TipoSensor;
  /** Sólo `es`: qué mineral. */
  mineral?: Mineral;
  /** Sólo `contador`: contra qué valor comparar. Incluye `"lado"`
   *  (tamaño del campo): es la única igualdad discreta que involucra el
   *  tamaño de la isla, y no hace falta ningún operador de comparación. */
  valor?: Veces;
  /** Negado: "no está listo", "no está vacía"… */
  no?: boolean;
}

/** Un número de vueltas/valor, o `"lado"`: el tamaño actual del campo.
 *  Un solo token para las tres cosas que antes hubieran sido tres
 *  mecanismos (PROGRESION.md §5, "tamaño del campo"): el operando de
 *  `Repetir [N]`, de `Hacer A con [N]`, y del sensor del contador. */
export type Veces = number | "lado";

/** Resuelve un valor de `Veces` contra el campo actual. `"lado"` se
 *  resuelve UNA vez, cuando se apila el marco (interprete.ts) o cuando se
 *  entra al contenedor (expandir): así una vuelta cuenta estable adentro
 *  de una misma corrida aunque el campo crezca antes de la próxima. */
export function resolverVeces(v: Veces, lado: number): number {
  return v === "lado" ? lado : v;
}

export interface NodoRepetir {
  id: string;
  type: "repeat";
  times: Veces;
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

/** Las tres rutinas que se pueden definir (PROGRESION.md §5). Alcanza y
 *  sobra para lo que un chico de primaria nombra de memoria. */
export type NombreRutina = "A" | "B" | "C";
export const RUTINAS: readonly NombreRutina[] = ["A", "B", "C"];

/** `Mi rutina A/B/C`: una definición al nivel raíz. Se apila un marco al
 *  llamarla —nunca se copia su cuerpo— así que cuesta memoria una sola
 *  vez sin importar cuántas veces se la llame. */
export interface NodoDef {
  id: string;
  type: "def";
  rutina: NombreRutina;
  body: NodoPrograma[];
}

/** `Hacer A/B/C`: una hoja. Nunca se rechaza por profundidad ni por
 *  recursión; llamar a una letra sin definir es un no-op válido, se
 *  resuelve recién al correr (interprete.ts). */
export interface NodoCall {
  id: string;
  type: "call";
  rutina: NombreRutina;
  /** Sólo `Hacer A con N`: azúcar de `Repetir N [Hacer A]` (design.md).
   *  Nada adentro del cuerpo de la rutina puede leer este número —no es
   *  un parámetro, es sólo cuántas veces se repite la llamada entera. */
  veces?: Veces;
}

/** `Contador +1` y `Contador = 0`: dos hojas, nunca llegan a
 *  `motor.ts::ejecutarPaso` — el contador vive en el estado de la
 *  corrida (interprete.ts), no en el campo. */
export type TipoContador = "counter_add" | "counter_reset";

export interface NodoContador {
  id: string;
  type: TipoContador;
}

export type NodoContenedor = NodoRepetir | NodoSiempre | NodoMientras | NodoSi | NodoDef;
export type NodoPrograma = NodoAccion | NodoCall | NodoContenedor | NodoContador;
export type Programa = NodoPrograma[];

const ACCIONES: readonly TipoAccion[] = [
  "move_north",
  "move_east",
  "move_south",
  "move_west",
  /* Compatibilidad: el par girar/avanzar ya no se ofrece en la caja,
     pero sigue siendo válido para los programas ya guardados. */
  "move_forward",
  "move_back",
  "turn_left",
  "turn_right",
  "harvest",
  "clear",
  "plant",
  "wait",
];
const SENSORES: readonly TipoSensor[] = ["listo", "vacia", "es", "borde", "contador"];
const CONTENEDORES = ["repeat", "forever", "while", "if", "def"] as const;
const CONTADORES = ["counter_add", "counter_reset"] as const;

export function esContenedor(n: NodoPrograma): n is NodoContenedor {
  return (CONTENEDORES as readonly string[]).includes(n.type);
}

export function esRepetir(n: NodoPrograma): n is NodoRepetir {
  return n.type === "repeat";
}

export function esDefinicion(n: NodoPrograma): n is NodoDef {
  return n.type === "def";
}

export function esLlamada(n: NodoPrograma): n is NodoCall {
  return n.type === "call";
}

/** `Contador +1` / `Contador = 0`: hojas, como cualquier acción. */
export function esContador(n: NodoPrograma): n is NodoContador {
  return (CONTADORES as readonly string[]).includes(n.type);
}

/** Cuerpo de cada rutina definida al nivel raíz. La PRIMERA definición de
 *  una letra gana: un snapshot editado a mano no puede volver la corrida
 *  ambigua. Sólo mira la raíz —`def` no puede vivir en otro lado. */
export function rutinasDe(programa: Programa): Map<NombreRutina, NodoPrograma[]> {
  const mapa = new Map<NombreRutina, NodoPrograma[]>();
  for (const nodo of programa) {
    if (esDefinicion(nodo) && !mapa.has(nodo.rutina)) mapa.set(nodo.rutina, nodo.body);
  }
  return mapa;
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

/** La memoria que ocupa TODO el lienzo: la cadena verde, las rutinas y las
 *  pilas sueltas. "Ocupado" dejó de querer decir "se ejecuta" (MVP.md §7):
 *  una idea guardada al costado también pesa, y por eso hay que decidir
 *  qué se tira. `pilasSueltas` se recibe como forma estructural —sólo
 *  `{ nodos }`— para que este archivo nunca tenga que importar `Pila` de
 *  `motor.ts` (decisión de diseño #2). */
export function capacidadDeLienzo(
  programa: Programa,
  rutinas: readonly NodoDef[] = [],
  pilasSueltas: readonly { nodos: NodoPrograma[] }[] = [],
): number {
  return (
    capacidadUsada(programa) +
    capacidadUsada(rutinas as Programa) +
    pilasSueltas.reduce((s, p) => s + capacidadUsada(p.nodos), 0)
  );
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
  // Una rutina siempre cae al nivel raíz (nunca adentro de nada), así que
  // no le suma altura a donde se la suelta: la valida su PROPIO tope, no
  // el de quien la contiene.
  if (nodo.type === "def") return 0;
  if (!esContenedor(nodo)) return 0;
  let max = 0;
  for (const r of ramas(nodo)) for (const h of listaDeRama(nodo, r)) max = Math.max(max, alturaDe(h));
  return 1 + max;
}

/* ------------------------------------------------------------------ */
/* Validación                                                          */
/* ------------------------------------------------------------------ */

/** `"lado"` o un miembro de `opciones`: el mismo tope que ya vale para
 *  `Repetir` ahora también sostiene el operando del contador. */
function validarVeces(valor: unknown, opciones: readonly number[]): Veces | null {
  if (valor === "lado") return "lado";
  if (typeof valor === "number" && Number.isInteger(valor) && opciones.includes(valor)) return valor;
  return null;
}

function validarSensor(valor: unknown): Sensor | null {
  if (typeof valor !== "object" || valor === null) return null;
  const s = valor as Record<string, unknown>;
  if (typeof s.tipo !== "string" || !SENSORES.includes(s.tipo as TipoSensor)) return null;
  const sensor: Sensor = { tipo: s.tipo as TipoSensor };
  if (s.tipo === "es") {
    if (typeof s.mineral !== "string" || !(s.mineral in MINERALES)) return null;
    sensor.mineral = s.mineral as Mineral;
  }
  if (s.tipo === "contador") {
    const valorContador = validarVeces(s.valor, AJUSTES.opcionesContador);
    if (valorContador === null) return null;
    sensor.valor = valorContador;
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

  if ((CONTADORES as readonly string[]).includes(n.type)) {
    return { id: n.id, type: n.type as TipoContador };
  }

  if (n.type === "call") {
    // Hoja: nunca se rechaza por profundidad ni por recursión (una
    // rutina puede llamarse a sí misma, directa o indirectamente). Una
    // letra sin `Mi rutina` definida es un no-op válido: se resuelve
    // recién al correr, nunca al guardar.
    if (typeof n.rutina !== "string" || !(RUTINAS as readonly string[]).includes(n.rutina)) return null;
    const llamada: NodoCall = { id: n.id, type: "call", rutina: n.rutina as NombreRutina };
    if (n.veces !== undefined) {
      const veces = validarVeces(n.veces, AJUSTES.opcionesRepetir);
      if (veces === null) return null;
      llamada.veces = veces;
    }
    return llamada;
  }

  if (!(CONTENEDORES as readonly string[]).includes(n.type)) return null;
  if (profundidad >= AJUSTES.maxProfundidad) return null;
  // `Por siempre` y `Mi rutina` sólo al nivel de la libreta: adentro de
  // otro bloque no significan nada que un chico pueda leer.
  if ((n.type === "forever" || n.type === "def") && profundidad > 0) return null;

  if (n.type === "def") {
    if (typeof n.rutina !== "string" || !(RUTINAS as readonly string[]).includes(n.rutina)) return null;
    // Cada rutina tiene su PROPIO presupuesto de anidamiento, empezando
    // en 0: llamarla no le suma profundidad estructural a quien llama.
    const body = validarLista(n.body, 0, contador);
    if (!body) return null;
    return { id: n.id, type: "def", rutina: n.rutina as NombreRutina, body };
  }

  const body = validarLista(n.body, profundidad + 1, contador);
  if (!body) return null;

  if (n.type === "repeat") {
    const times = validarVeces(n.times, AJUSTES.opcionesRepetir);
    if (times === null) return null;
    return { id: n.id, type: "repeat", times, body };
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
/** Tope de llamadas anidadas para este camino sin sensores. Comparte el
 *  valor con `MAX_LLAMADAS_ANIDADAS` (interprete.ts) vía `limites.ts`, un
 *  tercer módulo sin dependencias: `interprete.ts` ya importa de acá, así
 *  que importar directamente de ahí cerraría un ciclo. */
const TOPE_LLAMADAS_EXPANDIR = MAX_LLAMADAS_ANIDADAS;

export function expandir(
  programa: Programa,
  maxPasos = AJUSTES.maxPasosEjecucion,
  lado = AJUSTES.ladoInicial,
  // ADITIVO (Lienzo, decisión de diseño #4): las definiciones que viven
  // en `EstadoCampo.rutinas`, no en la cadena. Con el valor por defecto
  // `[]` el mapa fusionado es EXACTAMENTE `rutinasDe(programa)`, así que
  // todo call site existente compila y se comporta byte-idéntico.
  rutinasLienzo: NodoDef[] = [],
): {
  pasos: PasoExpandido[];
  completo: boolean;
} {
  const pasos: PasoExpandido[] = [];
  let completo = true;
  const rutinas = new Map([...rutinasDe(programa), ...rutinasDe(rutinasLienzo)]);

  const recorrer = (nodos: Programa, contenedorId?: string, vuelta?: number, llamadas = 0): void => {
    for (const nodo of nodos) {
      if (!completo) return;
      if (nodo.type === "repeat") {
        const veces = resolverVeces(nodo.times, lado);
        for (let v = 1; v <= veces; v++) {
          recorrer(nodo.body, nodo.id, v, llamadas);
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
          recorrer(nodo.body, nodo.id, v, llamadas);
        }
        return;
      }
      if (nodo.type === "call") {
        // Una llamada inlinea el cuerpo resuelto, con su PROPIO contador
        // de anidamiento: pasado el tope, se corta como si se llegara al
        // tope de pasos — nunca es un error. `Hacer A con N` es la misma
        // llamada, resuelta N veces (azúcar de `Repetir N [Hacer A]`).
        if (llamadas >= TOPE_LLAMADAS_EXPANDIR) {
          completo = false;
          return;
        }
        const cuerpo = rutinas.get(nodo.rutina);
        if (cuerpo && cuerpo.length > 0) {
          const veces = resolverVeces(nodo.veces ?? 1, lado);
          for (let v = 1; v <= veces; v++) {
            recorrer(cuerpo, nodo.id, v, llamadas + 1);
            if (!completo) return;
          }
        }
        continue;
      }
      if (esContador(nodo)) continue; // inerte en este camino: sólo se observa por sensor
      if (esContenedor(nodo)) continue; // con sensor, o una definición: no se puede expandir a ciegas
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
      // Adentro de una rutina el contador arranca de nuevo en 0: es su
      // propio presupuesto de anidamiento, no el de quien la contiene.
      const siguienteNivel = nodo.type === "def" ? 0 : nivel + 1;
      for (const r of ramas(nodo)) {
        const p = profundidadDe(listaDeRama(nodo, r), id, siguienteNivel);
        if (p !== null) return p;
      }
    }
  }
  return null;
}

/** La altura de la cadena es la del eslabón MÁS ALTO: todos caen en la
 *  misma lista al soltarse, así que el que no entra decide por todos. */
export function alturaDeCadena(cadena: readonly NodoPrograma[]): number {
  let max = 0;
  for (const n of cadena) max = Math.max(max, alturaDe(n));
  return max;
}

/** ¿Cabe esto en una lista que está a `profundidad`? Acepta un nodo SUELTO
 *  o una CADENA entera agarrada del lienzo (`cortarDesde`): el arrastre de
 *  Scratch se lleva el bloque tocado y todo lo que cuelga debajo, así que
 *  lo que decide si cabe es el eslabón más alto, no el primero. `Por
 *  siempre` y `Mi rutina` mantienen su regla propia en CUALQUIER eslabón:
 *  sólo al nivel del lienzo (profundidad 0). Con un único nodo,
 *  `alturaDeCadena` es exactamente `alturaDe`, así que todo call site
 *  existente (`insertarAntes`, `insertarEn`) se comporta byte-idéntico. */
export function cabeA(nodo: NodoPrograma | NodoPrograma[], profundidad: number): boolean {
  const cadena = Array.isArray(nodo) ? nodo : [nodo];
  for (const n of cadena) {
    if (n.type === "forever" && profundidad > 0) return false;
    if (n.type === "def" && profundidad > 0) return false;
  }
  return profundidad + alturaDeCadena(cadena) <= AJUSTES.maxProfundidad;
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

/** Un `Por siempre` no termina nunca, así que CIERRA la cadena: todo lo
 *  que se encadene debajo es código muerto. */
export function cierraLaCadena(nodo: NodoPrograma | undefined | null): boolean {
  return nodo?.type === "forever";
}

/** ¿Este destino cae DEBAJO de un `Por siempre`? Es la única regla nueva
 *  de colocación, y vive acá —en el punto donde se decide dónde cae una
 *  pieza— por dos motivos.
 *
 *  1. Es el chokepoint: `colocar` y `colocarCadena` son los dos únicos
 *     caminos por los que una pieza entra al árbol, así que una sola
 *     guarda cubre el arrastre, el teclado y el toque.
 *  2. NO va en `validarNodo`/`validarLista`/`validarPrograma`, y eso es
 *     deliberado, no un olvido: esas funciones devuelven `null` al
 *     rechazar, `almacenamiento.ts` lee ese `null` como "snapshot
 *     corrupto" y `cargar()` descarta LA PARTIDA ENTERA —campo,
 *     minerales, mejoras—. Un programa ya guardado con un bloque después
 *     de un `Por siempre` tiene que seguir cargando exactamente igual que
 *     antes. Esos bloques ya eran inalcanzables en ejecución, así que no
 *     se pierde nada dejándolos donde están. Si alguien alguna vez quiere
 *     "ordenar esto" moviéndolo al validador: eso borra partidas.
 *
 *  `dentro` NUNCA se bloquea: meter bloques ADENTRO del `Por siempre` es
 *  justamente para lo que está. */
export function destinoBloqueado(programa: Programa, destino: Destino): boolean {
  if (destino.tipo === "dentro") return false;
  if (destino.tipo === "final") return cierraLaCadena(programa[programa.length - 1]);
  const donde = listaDe(programa, destino.id);
  if (!donde) return false;
  const i = donde.lista.findIndex((n) => n.id === destino.id);
  return cierraLaCadena(donde.lista[i - 1]);
}

/** Pone `nodo` en `destino`. Devuelve el MISMO programa si no se pudo:
 *  el anidamiento tiene tope, `Por siempre` sólo va en la libreta, y
 *  debajo de un `Por siempre` no entra nada (`destinoBloqueado`). */
export function colocar(programa: Programa, nodo: NodoPrograma, destino: Destino): Programa {
  if (destinoBloqueado(programa, destino)) return programa;
  return colocarSinMirarElFinal(programa, nodo, destino);
}

/** `colocar` sin la guarda del `Por siempre`. La necesita `colocarCadena`
 *  para RE-encadenar los eslabones 2..n de una cadena que ya aprobó su
 *  destino: si la cadena agarrada trae adentro un `Por siempre` con
 *  bloques debajo (un programa viejo, ver `destinoBloqueado`), volver a
 *  preguntar por cada eslabón la partiría a la mitad. La regla se aplica
 *  al lugar que ELIGIÓ el chico, no a la costura interna. */
function colocarSinMirarElFinal(programa: Programa, nodo: NodoPrograma, destino: Destino): Programa {
  if (destino.tipo === "final") return [...programa, nodo];
  if (destino.tipo === "dentro") return insertarEn(programa, nodo, destino.id, destino.rama ?? "body");
  return insertarAntes(programa, nodo, destino.id);
}

/* ------------------------------------------------------------------ */
/* Agarrar y soltar una CADENA (el lienzo)                             */
/* ------------------------------------------------------------------ */

/** Corta una lista en dos por el id: lo de arriba se queda, el bloque y
 *  TODO lo que cuelga debajo se va como UNA unidad. Es la semántica de
 *  Scratch, y es la única regla nueva del arrastre. Null si `id` no está
 *  en esa lista (no busca en cavidades: para eso está `cortarEn`). */
export function cortarDesde(
  nodos: NodoPrograma[],
  id: string,
): { arriba: NodoPrograma[]; agarrado: NodoPrograma[] } | null {
  const i = nodos.findIndex((n) => n.id === id);
  if (i < 0) return null;
  return { arriba: nodos.slice(0, i), agarrado: nodos.slice(i) };
}

/** A qué profundidad caería una CADENA si se la suelta en `d`: la lógica
 *  de `colocar`, pero devolviendo el número en vez de intentar el
 *  encastre — así `colocarCadena` puede pedirle a `cabeA` que mire el
 *  eslabón más alto ANTES de tocar el árbol. */
function profundidadDestino(programa: Programa, d: Destino): number | null {
  if (d.tipo === "final") return 0;
  if (d.tipo === "antes") return profundidadDe(programa, d.id);
  const p = profundidadDe(programa, d.id);
  return p === null ? null : p + 1;
}

/** Coloca una CADENA entera en un destino, en orden, o no coloca nada:
 *  una cadena que no entra jamás se parte a la mitad. */
export function colocarCadena(programa: Programa, cadena: NodoPrograma[], destino: Destino): Programa {
  if (cadena.length === 0) return programa;
  const prof = profundidadDestino(programa, destino);
  if (prof === null || !cabeA(cadena, prof)) return programa;
  // La misma regla que `colocar`, preguntada UNA vez por el destino que
  // eligió el chico: debajo de un `Por siempre` no entra nada.
  if (destinoBloqueado(programa, destino)) return programa;
  let salida = colocarSinMirarElFinal(programa, cadena[0], destino);
  if (salida === programa) return programa;
  for (let i = 1; i < cadena.length; i++) {
    // `despuesDe` ya sabe decir "antes de mi hermano siguiente, o al
    // final de mi lista": es exactamente "pegado abajo del anterior".
    const siguiente = colocarSinMirarElFinal(salida, cadena[i], despuesDe(salida, cadena[i - 1].id));
    if (siguiente === salida) return programa; // defensivo: `cabeA` ya lo cubrió
    salida = siguiente;
  }
  return salida;
}

/** La misma lista que `listaDe` encontró, pero YA reemplazada por
 *  `lista` en el árbol. Sacado de `desplazarNodo`, que hacía esto en
 *  línea: `cortarEn` lo necesita igual para devolver el "resto" después
 *  de sacar una cadena de una cavidad. */
function conListaDe(
  programa: Programa,
  donde: { lista: NodoPrograma[]; contenedor: NodoContenedor | null; rama: Rama },
  lista: NodoPrograma[],
): Programa {
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

/** Lo mismo que `cortarDesde`, pero buscando en cualquier cavidad del
 *  árbol: agarrar el segundo bloque de adentro de un `Repetir` también se
 *  lleva sus hermanos de abajo, sin sacarlos del contenedor. Null si `id`
 *  no aparece en ningún lado. */
export function cortarEn(
  programa: Programa,
  id: string,
): { restante: Programa; agarrado: NodoPrograma[] } | null {
  const donde = listaDe(programa, id);
  if (!donde) return null;
  const corte = cortarDesde(donde.lista, id);
  if (!corte) return null;
  return { restante: conListaDe(programa, donde, corte.arriba), agarrado: corte.agarrado };
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
  /* Bajar por debajo de un `Por siempre` no se puede, igual que no se
     puede soltar ni tocar ahí: el intercambio no pasa por `colocar`, así
     que la guarda hay que repetirla acá o el teclado sería la rendija por
     la que se cuela justo lo que las otras tres puertas rechazan.
     SÓLO se frena hacia abajo: subir siempre queda libre, incluso para
     sacar un bloque de debajo de un `Por siempre` en un programa viejo. */
  if (delta === 1 && cierraLaCadena(donde.lista[j])) return programa;
  const lista = [...donde.lista];
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return conListaDe(programa, donde, lista);
}
