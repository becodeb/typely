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
 *   - `Hacer A` apila un marco para el cuerpo de `Mi rutina A` —nunca lo
 *     copia—, así que se permite recursión, directa e indirecta. La
 *     misma regla del tic la vuelve segura: una llamada cuya vuelta no
 *     produjo ninguna acción también tiquea, y la pila de llamadas está
 *     acotada (`MAX_LLAMADAS_ANIDADAS`); pasado el tope se saltea en
 *     silencio y la corrida se desarma sola, un pulso por nivel.
 *
 * Es lógica pura, como el motor: no sabe de React ni de relojes. Quien
 * lo llama decide cuánto esperar entre paso y paso.
 */

import type { Mineral } from "../../data/automatizacion/balance";
import { MAX_LLAMADAS_ANIDADAS } from "./limites";
import { indice, type EstadoCampo } from "./motor";
import {
  esContador,
  esContenedor,
  esLlamada,
  listaDeRama,
  resolverVeces,
  rutinasDe,
  type NodoCall,
  type NodoContenedor,
  type NodoPrograma,
  type Programa,
  type Sensor,
  type TipoAccion,
} from "./programa";

export interface Paso {
  /** El bloque que se ilumina. En un tic, es el contenedor que espera. */
  nodoId: string;
  /** Una acción, `tick` (una vuelta vacía de un bucle) o `counter`
   *  (`Contador +1`/`Contador = 0`: nunca llega a `motor.ts`). */
  tipo: TipoAccion | "tick" | "counter";
  mineral?: Mineral;
}

/** Tope de seguridad: un programa que da este número de pasos sin que
 *  nadie lo detenga es un bucle sin sentido. Alcanzarlo se trata como
 *  una detención normal, sin cartel. */
export const MAX_PASOS_CORRIDA = 100_000;

/** Re-exportado por compatibilidad: quien ya importaba el tope de acá
 *  (y `programa.ts`, que también lo usa) lo toman ahora de `limites.ts`
 *  — ver ese archivo para el porqué del tercer módulo. */
export { MAX_LLAMADAS_ANIDADAS };

/** Un sensor, evaluado contra la baldosa donde está la nave.
 *
 *  El tercer parámetro es opcional y sólo lo usa el sensor `contador`:
 *  las llamadas existentes (y el examen) siguen compilando sin tocarse. */
export function evaluarSensor(sensor: Sensor, e: EstadoCampo, contador?: number): boolean {
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
    case "contador": {
      // Igualdad discreta, nunca `<`/`>=`: PROGRESION.md §5 "Qué NO entra".
      // "lado" hace de esto mismo la forma booleana de "tamaño del campo".
      const objetivo = sensor.valor === undefined ? 0 : resolverVeces(sensor.valor, e.lado);
      valor = (contador ?? 0) === objetivo;
      break;
    }
  }
  return sensor.no ? !valor : valor;
}

interface Marco {
  lista: NodoPrograma[];
  i: number;
  /** El contenedor que abrió este marco, o la llamada (`Hacer A`) que lo
   *  apiló — una llamada nunca copia su cuerpo, así que el marco de una
   *  rutina se distingue igual que el de cualquier otro bloque. */
  contenedor: NodoContenedor | NodoCall | null;
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
  /** El contador: vive en la corrida, nunca en el campo, y arranca en
   *  cero en cada corrida (PROGRESION.md §6). */
  contador: number;
}

export function crearInterprete(programa: Programa, e: EstadoCampo): Interprete {
  // Un mapa letra→cuerpo, construido UNA vez por corrida: llamar no
  // vuelve a buscar la definición en el árbol en cada paso.
  const rutinas = rutinasDe(programa);
  const pila: Marco[] = [{ lista: programa, i: 0, contenedor: null, vuelta: 0, acciones: 0 }];
  const interprete: Interprete = { pasos: 0, contador: 0, siguiente };

  function entrar(c: NodoContenedor, rama: "body" | "sino" = "body"): void {
    pila.push({ lista: listaDeRama(c, rama), i: 0, contenedor: c, vuelta: 0, acciones: 0 });
  }

  /** Apila un marco para el cuerpo de la rutina llamada — nunca lo
   *  copia. Corre UNA vez (no vuelve a entrar como `Repetir`); si su
   *  vuelta termina sin acciones, tiquea igual que cualquier otra. */
  function entrarLlamada(c: NodoCall, cuerpo: NodoPrograma[]): void {
    pila.push({ lista: cuerpo, i: 0, contenedor: c, vuelta: 0, acciones: 0 });
  }

  /** Cuántas llamadas (`Hacer`) hay hoy en la pila — no cuántos marcos en
   *  total: un `Repetir` o un `Si` adentro de una rutina no cuentan. */
  function llamadasEnPila(): number {
    let n = 0;
    for (const m of pila) if (m.contenedor && esLlamada(m.contenedor)) n += 1;
    return n;
  }

  function devolver(p: Paso): Paso {
    interprete.pasos += 1;
    for (const m of pila) m.acciones += 1;
    return p;
  }

  function tic(c: NodoContenedor | NodoCall): Paso {
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

        if (esLlamada(c)) {
          // Una llamada corre su cuerpo una sola vuelta: si no produjo
          // ninguna acción, igual cuesta un tic —lo mismo que `Mientras`
          // o `Por siempre`— y es lo que vuelve segura la recursión:
          // nunca hay progreso de tiempo cero.
          const vacia = marco.acciones === 0;
          pila.pop();
          if (vacia) return tic(c);
          continue;
        }

        if (c.type === "repeat") {
          marco.vuelta += 1;
          if (marco.vuelta < resolverVeces(c.times, e.lado)) {
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
          if (evaluarSensor(c.sensor, e, interprete.contador)) {
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

      if (nodo.type === "def") continue; // una definición no produce ningún paso

      if (esContador(nodo)) {
        // `Contador +1` / `Contador = 0`: nunca llegan a
        // `motor.ts::ejecutarPaso` — se resuelven acá y listo, un turno
        // entero como cualquier acción (PROGRESION.md §6).
        if (nodo.type === "counter_add") interprete.contador += 1;
        else interprete.contador = 0;
        return devolver({ nodoId: nodo.id, tipo: "counter" });
      }

      if (esLlamada(nodo)) {
        if (llamadasEnPila() >= MAX_LLAMADAS_ANIDADAS) continue; // se saltea en silencio, sin cartel
        if (nodo.veces !== undefined) {
          // `Hacer A con N` es azúcar de `Repetir N [Hacer A]`: se arma
          // ESE árbol, nunca guardado —vive sólo en la pila— para que las
          // N rondas compartan el mismo tope de anidamiento y el mismo
          // tic por ronda vacía que cualquier otra llamada (design.md).
          const veces = resolverVeces(nodo.veces, e.lado);
          const llamadaSimple: NodoCall = { id: nodo.id, type: "call", rutina: nodo.rutina };
          entrar({ id: nodo.id, type: "repeat", times: veces, body: [llamadaSimple] });
        } else {
          // Letra sin definir: cuerpo vacío, un no-op válido que igual
          // tiquea al terminar su vuelta sin acciones.
          entrarLlamada(nodo, rutinas.get(nodo.rutina) ?? []);
        }
        continue;
      }

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
        if (!evaluarSensor(nodo.sensor, e, interprete.contador)) continue;
        if (nodo.body.length === 0) {
          // `Mientras` sin cuerpo: espera, un tic por vuelta, sin avanzar.
          marco.i -= 1;
          return tic(nodo);
        }
        entrar(nodo);
        continue;
      }

      // if
      if (evaluarSensor(nodo.sensor, e, interprete.contador)) {
        if (nodo.body.length > 0) entrar(nodo, "body");
      } else if (nodo.sino && nodo.sino.length > 0) {
        entrar(nodo, "sino");
      }
    }
    return null;
  }

  return interprete;
}
