/* El intérprete: corre el programa UN PASO POR VEZ mirando el campo.
 *
 * `expandir()` aplanaba el programa a una lista antes de arrancar y la
 * nave la ejecutaba a ciegas. Con sensores eso ya no alcanza: un `Si`
 * mira la baldosa en el momento en que la nave está parada ahí, y un
 * `Mientras` decide en cada vuelta. Así que acá hay una pila —dónde va
 * en cada contenedor, cuántas vueltas lleva— y cada `siguiente()`
 * devuelve la próxima ACCIÓN que la nave tiene que hacer, o un TIC.
 *
 * Reglas de tiempo (PROGRESION.md §6):
 *
 *   - Las acciones cuestan un turno (`msPorAccion`): la nave las anima.
 *   - Los sensores son gratis: se evalúan y listo.
 *   - Una vuelta de `Mientras` o `Por siempre` que NO ejecutó ninguna
 *     acción cuesta un TIC (un cuarto de turno). Así `Mientras no está
 *     listo → (nada)` es una espera visible, con el contenedor latiendo,
 *     y no un bucle que cuelga la pestaña.
 *   - `Esperar` es una acción que no hace nada: cuesta un turno entero.
 *
 * Es lógica pura, como el motor: no sabe de React ni de relojes. Quien
 * lo llama decide cuánto esperar entre paso y paso.
 */

import type { Mineral } from "../../data/automatizacion/balance";
import { indice, type EstadoCampo } from "./motor";
import {
  esContenedor,
  listaDeRama,
  type NodoContenedor,
  type NodoPrograma,
  type Programa,
  type Sensor,
  type TipoAccion,
} from "./programa";

export interface Paso {
  /** El bloque que se ilumina. En un tic, es el contenedor que espera. */
  nodoId: string;
  /** Una acción, o `tick`: una vuelta vacía de un bucle. */
  tipo: TipoAccion | "tick";
  mineral?: Mineral;
}

/** Tope de seguridad: un programa que da este número de pasos sin que
 *  nadie lo detenga es un bucle sin sentido. Alcanzarlo se trata como
 *  una detención normal, sin cartel. */
export const MAX_PASOS_CORRIDA = 100_000;

/** Un sensor, evaluado contra la baldosa donde está la nave. */
export function evaluarSensor(sensor: Sensor, e: EstadoCampo): boolean {
  const celda = e.celdas[indice(e, e.nave.fila, e.nave.col)];
  let valor: boolean;
  switch (sensor.tipo) {
    case "listo":
      valor = !!celda && celda.variante !== null && celda.etapa === 3;
      break;
    case "vacia":
      valor = !!celda && celda.variante === null;
      break;
    case "es":
      valor = !!celda && celda.variante !== null && celda.variante === sensor.mineral;
      break;
    case "borde": {
      let { fila, col } = e.nave;
      if (e.nave.direccion === "north") fila -= 1;
      else if (e.nave.direccion === "south") fila += 1;
      else if (e.nave.direccion === "east") col += 1;
      else col -= 1;
      valor = fila < 0 || col < 0 || fila >= e.lado || col >= e.lado;
      break;
    }
  }
  return sensor.no ? !valor : valor;
}

interface Marco {
  lista: NodoPrograma[];
  i: number;
  contenedor: NodoContenedor | null;
  /** Vueltas hechas (para `Repetir`). */
  vuelta: number;
  /** Cuántas acciones devolvió esta vuelta: cero = vuelta vacía = tic. */
  acciones: number;
}

export interface Interprete {
  /** El próximo paso, o null cuando el programa terminó. */
  siguiente(): Paso | null;
  /** Cuántos pasos devolvió hasta ahora (acciones y tics). */
  pasos: number;
}

export function crearInterprete(programa: Programa, e: EstadoCampo): Interprete {
  const pila: Marco[] = [{ lista: programa, i: 0, contenedor: null, vuelta: 0, acciones: 0 }];
  const interprete: Interprete = { pasos: 0, siguiente };

  function entrar(c: NodoContenedor, rama: "body" | "sino" = "body"): void {
    pila.push({ lista: listaDeRama(c, rama), i: 0, contenedor: c, vuelta: 0, acciones: 0 });
  }

  function devolver(p: Paso): Paso {
    interprete.pasos += 1;
    for (const m of pila) m.acciones += 1;
    return p;
  }

  function tic(c: NodoContenedor): Paso {
    interprete.pasos += 1;
    return { nodoId: c.id, tipo: "tick" };
  }

  function siguiente(): Paso | null {
    if (interprete.pasos >= MAX_PASOS_CORRIDA) return null;
    // Cota a las decisiones sin acción por llamada: sensores falsos en
    // cadena no pueden colgar la pestaña.
    for (let guarda = 0; guarda < 10_000; guarda++) {
      const marco = pila[pila.length - 1];
      if (!marco) return null;

      if (marco.i >= marco.lista.length) {
        const c = marco.contenedor;
        if (!c) return null; // fin de la libreta

        if (c.type === "repeat") {
          marco.vuelta += 1;
          if (marco.vuelta < c.times) {
            marco.i = 0;
            marco.acciones = 0;
            continue;
          }
          pila.pop();
          continue;
        }
        if (c.type === "forever") {
          const vacia = marco.acciones === 0;
          marco.i = 0;
          marco.acciones = 0;
          if (vacia) return tic(c);
          continue;
        }
        if (c.type === "while") {
          if (evaluarSensor(c.sensor, e)) {
            const vacia = marco.acciones === 0;
            marco.i = 0;
            marco.acciones = 0;
            if (vacia) return tic(c);
            continue;
          }
          pila.pop();
          continue;
        }
        // if / sino: se ejecutó una vez y se sale
        pila.pop();
        continue;
      }

      const nodo = marco.lista[marco.i];
      marco.i += 1;

      if (!esContenedor(nodo)) {
        return devolver({ nodoId: nodo.id, tipo: nodo.type, mineral: nodo.mineral });
      }

      if (nodo.type === "repeat" || nodo.type === "forever") {
        if (nodo.body.length === 0) {
          // Un bucle vacío para siempre es una espera: un tic por vuelta.
          if (nodo.type === "forever") {
            marco.i -= 1;
            return tic(nodo);
          }
          continue;
        }
        entrar(nodo);
        continue;
      }

      if (nodo.type === "while") {
        if (!evaluarSensor(nodo.sensor, e)) continue;
        if (nodo.body.length === 0) {
          // `Mientras` sin cuerpo: espera, un tic por vuelta, sin avanzar.
          marco.i -= 1;
          return tic(nodo);
        }
        entrar(nodo);
        continue;
      }

      // if
      if (evaluarSensor(nodo.sensor, e)) {
        if (nodo.body.length > 0) entrar(nodo, "body");
      } else if (nodo.sino && nodo.sino.length > 0) {
        entrar(nodo, "sino");
      }
    }
    return null;
  }

  return interprete;
}
