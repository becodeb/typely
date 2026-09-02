/* Corpus del modo Órbita — las once bandas de vocabulario.
 *
 * No se inventa vocabulario: todo sale de los `targets[]` que el
 * currículum ya escribió en `activities.ts`, agrupado en bandas que
 * siguen el ORDEN PEDAGÓGICO real (no el orden de los ids de isla).
 * Las islas de atajos (11, 12, 14) y la de mouse (5) no aportan corpus
 * de tipeo, y cualquier target con forma de combo ("Ctrl+C") se filtra.
 *
 * Dos derivaciones que NO son inventar, y por qué están:
 *
 *  - Las frases largas se descartan como frase (una frase de 42
 *    caracteres volando es injugable) pero sus PALABRAS se reparten en
 *    las bandas bajas según largo y contenido. "¿Querés jugar?" aporta
 *    "querés" a la banda de tildes y "jugar" a la de palabras cortas.
 *    Sin esto, las bandas quedan con 7-14 items y en una partida rápida
 *    (30+ palabras destruidas) la repetición canta.
 *
 *  - Los prefijos de mail de la isla 9 ("sofia@") se completan con los
 *    dominios que la propia isla enseña, porque un target cortado en el
 *    arroba era un artefacto del nivel, no una unidad de tipeo.
 */

import { activitiesByWorld, type Activity, type WorldId } from "./activities";

/** Banda → isla que la aporta, en orden pedagógico (ORBITA.md §5 del
 *  diseño). El índice del arreglo ES el número de banda. */
export const MUNDO_DE_BANDA: readonly WorldId[] = [
  "island1", //  B0 — letras sueltas, fila central
  "island6", //  B1 — sílabas y palabras de 2-4
  "island2", //  B2 — palabras de 3-6
  "island7", //  B3 — palabras largas
  "island13", // B4 — frases cortas y mensajes
  "island3", //  B5 — mayúsculas, ñ, tildes, ¿ ¡
  "island8", //  B6 — signos y puntuación
  "island9", //  B7 — correos y @
  "island4", //  B8 — símbolos y código
  "island10", // B9 — búsquedas
  "island15", // B10 — mezcla de reto
];

export const BANDAS_TOTAL = MUNDO_DE_BANDA.length; // 11 (B0..B10)

/** Largo máximo de un item por banda: una frase entera de la isla 13 no
 *  puede volar hacia la nave, pero un mensaje corto sí. */
const LARGO_MAX: readonly number[] = [4, 7, 9, 14, 20, 14, 11, 20, 12, 18, 20];

const TIPOS_TIPEO: ReadonlyArray<Activity["inputType"]> = [
  "letter",
  "word",
  "phrase",
  "symbol",
  "correction",
];

/** ¿Es un combo de teclado y no texto para tipear? (isla 15 mezcla). */
const esCombo = (s: string) => /(^|\+)(Ctrl|Alt|Shift|Enter|Tab|F\d+)(\+|$)/i.test(s);

const tieneAcentoOMayus = (s: string) => /[A-ZÁÉÍÓÚÜÑñáéíóúü¿¡]/.test(s);

function palabrasDe(frase: string): string[] {
  return frase
    .split(/\s+/)
    .map((p) => p.replace(/^[.,;:!?"']+|[.,;:!?"']+$/g, ""))
    .filter((p) => p.length >= 2);
}

function construir(): string[][] {
  const bandas: Set<string>[] = MUNDO_DE_BANDA.map(() => new Set());

  MUNDO_DE_BANDA.forEach((worldId, banda) => {
    for (const act of activitiesByWorld[worldId] ?? []) {
      if (!TIPOS_TIPEO.includes(act.inputType)) continue;
      for (const bruto of act.targets) {
        const t = bruto.trim();
        if (!t || esCombo(t)) continue;

        /* Prefijo de mail cortado en el @ → se completa con los dominios
           que la misma isla enseña. */
        if (banda === 7 && t.endsWith("@")) {
          bandas[7].add(t + "mail.com");
          continue;
        }

        /* La isla 1 guarda sus letras en MAYÚSCULA porque el nivel las muestra
           grandes, pero el chico aprieta la tecla sin Shift. En Órbita la
           coincidencia es exacta, así que la banda 0 va en minúscula: la
           mayúscula es un desafío aparte que el motor sortea y pinta distinto. */
        const item = banda === 0 ? t.toLowerCase() : t;
        if (item.length <= LARGO_MAX[banda]) bandas[banda].add(item);

        /* Reparto de las palabras de una frase en las bandas bajas. */
        if (t.includes(" ")) {
          for (const p of palabrasDe(t)) {
            if (p.length > 14) continue;
            const destino = tieneAcentoOMayus(p) ? 5 : p.length <= 4 ? 1 : p.length <= 6 ? 2 : 3;
            /* Nunca por encima de la banda de origen: la isla 13 puede
               regalar hacia abajo, no adelantar contenido. */
            if (destino <= banda) bandas[destino].add(p);
          }
        }
      }
    }
  });

  return bandas.map((s) => [...s]);
}

/** Las once bandas, construidas una vez al cargar el módulo. */
export const CORPUS_BANDAS: readonly (readonly string[])[] = construir();

/** Largo medio de cada banda — lo usa el controlador para convertir la
 *  demanda (PPM) en cadencia de aparición. */
export const LARGO_MEDIO_BANDA: readonly number[] = CORPUS_BANDAS.map((items) =>
  items.length ? items.reduce((a, s) => a + s.length, 0) / items.length : 4,
);

/** La banda más alta que este alumno tiene desbloqueada, dado el conjunto
 *  de mundos abiertos por su total de estrellas. Nunca menor que 0: la
 *  isla 1 está abierta siempre. */
export function bandaMaxDesbloqueada(mundosDesbloqueados: ReadonlySet<string>): number {
  let max = 0;
  MUNDO_DE_BANDA.forEach((worldId, banda) => {
    if (mundosDesbloqueados.has(worldId) && CORPUS_BANDAS[banda].length) max = banda;
  });
  return max;
}
