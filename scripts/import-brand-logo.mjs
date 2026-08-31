/* Genera la copia web del logo, desde el original de Images/brand/logos.
 *
 *   node scripts/import-brand-logo.mjs
 *
 * El original NO se toca: son PNG de entre 1,3 y 2,6 MB, inservibles para
 * servir. Acá sale recortado, escalado y en WebP.
 *
 * **Se usa la variante "simplificado", no la cargada.** La cargada lleva
 * los dos robots y dos islas alrededor de las letras: hermoso a tamaño
 * grande, ruido ilegible en una barra de 268 px. La simple es el mismo
 * logo, con nubes y gemas y sin la escena.
 *
 * El recorte del margen transparente es lo que hace predecible el tamaño:
 * sin él, el alto que ves depende del aire que dejó el render, no del
 * dibujo.
 *
 * **El favicon NO sale de acá, y es a propósito.** Se probó con el logo
 * circular y a 16 px no funciona: tanto detalle —anillo, gemas, nubes,
 * cinco letras— colapsa en una mancha. La pestaña sigue con la cara del
 * personaje (`public/favicon-256.png`), que es lo único que se reconoce a
 * ese tamaño. Si algún día se rehace, tiene que ser una marca pensada para
 * 16 px, no una reducción de una ilustración.
 */

import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = `${ROOT}Images/brand/logos/logo-horizontal-simplificado.png`;
const OUT_DIR = `${ROOT}public/assets/brand/`;

mkdirSync(OUT_DIR, { recursive: true });

const out = `${OUT_DIR}logo-typely.webp`;
await sharp(SRC)
  .trim()
  .resize({ width: 640, withoutEnlargement: true })
  .webp({ quality: 90 })
  .toFile(out);

const meta = await sharp(out).metadata();
console.log(`logo-typely.webp  ${meta.width}x${meta.height}`);
