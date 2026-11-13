/* Corpus de "Tormenta de palabras" — tres bandas, iguales para todos.
 *
 * Decisión de Ezequiel (08/09/2026): la experiencia de Tormenta NO depende
 * de la isla en la que va el chico. Antes el corpus tenía once bandas (una
 * por isla del currículum) y cada alumno jugaba con las que tenía
 * desbloqueadas en Aventura: uno de sexto veía correos y símbolos, uno de
 * primero letras sueltas. Ahora todos juegan el MISMO juego — el de un
 * chico de "banda 1": letras sueltas, sílabas y palabras cortas — y lo que
 * cambia con la habilidad es la PRESIÓN (cadencia, velocidad, simultáneas),
 * que el motor sigue adaptando solo. Los signos viven únicamente en la
 * oleada "tormenta de signos" (`utils/orbita/tormentaSignos.ts`), nunca en
 * la lluvia normal.
 *
 * Tres bandas, por LARGO y no por isla:
 *
 *   B0 — letras sueltas                (a…z, ñ)
 *   B1 — sílabas y palabras cortas     (2–4 letras)
 *   B2 — palabras                      (5–6 letras) · solo como asomo de B1
 *
 * No se inventa vocabulario: todo sale de los `targets[]` que el currículum
 * ya escribió en `activities.ts`, de CUALQUIER isla de tipeo (ya no importa
 * cuál tiene abierta el chico: son palabras comunes). Las frases se
 * desarman en palabras ("el gato salta" aporta "el", "gato" y "salta"), y
 * solo entra lo que es pura letra minúscula sin tilde: ni dígitos ("2026"),
 * ni signos ("(todo)"), ni espacios ("mi casa"), ni tildes ("está"), ni
 * combos ("Ctrl+C"), ni correos. Las mayúsculas no vienen del corpus: el
 * motor sortea cuáles salen con Shift.
 */

import { activitiesByWorld, type Activity } from "./activities";

/** Largo máximo, en letras, de cada banda. El índice ES el número de banda. */
const LARGO_MAX_BANDA: readonly number[] = [1, 4, 6];

const TIPOS_TIPEO: ReadonlyArray<Activity["inputType"]> = [
  "letter",
  "word",
  "phrase",
  "symbol",
  "correction",
];

/** Solo letras minúsculas del teclado español, sin tildes ni diéresis. */
const SOLO_LETRAS = /^[a-zñ]+$/;

/** Puntuación pegada a una palabra dentro de una frase ("¿Querés jugar?"). */
const PUNTUACION_EN_BORDES = /^[.,;:!?¿¡"'()]+|[.,;:!?¿¡"'()]+$/g;

function construir(): string[][] {
  const bandas: Set<string>[] = LARGO_MAX_BANDA.map(() => new Set());

  for (const actividades of Object.values(activitiesByWorld)) {
    for (const act of actividades) {
      if (!TIPOS_TIPEO.includes(act.inputType)) continue;
      for (const bruto of act.targets) {
        /* Un target puede ser una letra, una palabra, una frase o un combo:
           se lo parte por espacios y cada pedazo tiene que ser pura letra.
           La isla 1 guarda sus letras en MAYÚSCULA porque el nivel las
           muestra grandes, pero el chico aprieta la tecla sin Shift: acá
           todo va en minúscula (la coincidencia del motor es exacta). */
        for (const pedazo of bruto.trim().toLowerCase().split(/\s+/)) {
          const palabra = pedazo.replace(PUNTUACION_EN_BORDES, "");
          if (!SOLO_LETRAS.test(palabra)) continue;
          const banda = LARGO_MAX_BANDA.findIndex((max) => palabra.length <= max);
          if (banda >= 0) bandas[banda].add(palabra);
        }
      }
    }
  }

  return bandas.map((s) => [...s]);
}

/** Las tres bandas, construidas una vez al cargar el módulo. */
export const CORPUS_BANDAS: readonly (readonly string[])[] = construir();

/** Largo medio de cada banda — lo usa el controlador para convertir la
 *  demanda (PPM) en cadencia de aparición. */
export const LARGO_MEDIO_BANDA: readonly number[] = CORPUS_BANDAS.map((items) =>
  items.length ? items.reduce((a, s) => a + s.length, 0) / items.length : 4,
);
