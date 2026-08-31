/* Genera las copias web del logo, desde los originales de Images/brand/logos.
 *
 *   node scripts/import-brand-logo.mjs
 *
 * Los originales NO se tocan: pesan entre 1,3 y 2,6 MB cada uno y son PNG,
 * inservibles para servir. Acá salen recortados, escalados y en WebP.
 *
 * **Se usan las variantes "simplificado", no las cargadas.** Las cargadas
 * llevan los dos robots y dos islas alrededor de las letras: hermoso a
 * tamaño grande, ruido ilegible en una barra de 268 px o en una pestaña de
 * 32 px. La versión simple es el mismo logo, con nubes y gemas y sin la
 * escena.
 *
 * El recorte del margen transparente es lo que hace predecible el tamaño:
 * sin él, el alto que ves depende del aire que dejó el render, no del
 * dibujo.
 */

import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = `${ROOT}Images/brand/logos/`;
const OUT_ASSETS = `${ROOT}public/assets/brand/`;
const OUT_ROOT = `${ROOT}public/`;

mkdirSync(OUT_ASSETS, { recursive: true });

/* ---- La marca horizontal, para la barra de los paneles ---- */
{
  const out = `${OUT_ASSETS}logo-typely.webp`;
  const img = sharp(`${SRC}logo-horizontal-simplificado.png`).trim();
  await img
    .resize({ width: 640, withoutEnlargement: true })
    .webp({ quality: 90 })
    .toFile(out);
  const meta = await sharp(out).metadata();
  console.log(`logo-typely.webp        ${meta.width}x${meta.height}`);
}

/* ---- El circular, para la pestaña del navegador ----
   A 16 px las letras no se leen y eso está bien: lo que identifica a esa
   altura es el anillo dorado y el disco pastel, que sí sobreviven. */
const circular = sharp(`${SRC}logo-circular-simplificado.png`).trim();
const circularBuf = await circular.png().toBuffer();

async function png(size) {
  return sharp(circularBuf)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

for (const [size, name] of [[256, "favicon-256.png"], [180, "apple-touch-icon.png"]]) {
  writeFileSync(`${OUT_ROOT}${name}`, await png(size));
  console.log(`${name.padEnd(23)} ${size}x${size}`);
}

/* Un .ico es un contenedor: puede llevar PNG adentro tal cual, así que no
   hace falta una dependencia para armarlo. Encabezado de 6 bytes, una
   entrada de 16 por tamaño, y los PNG pegados atrás. */
const SIZES = [16, 32, 48];
const blobs = await Promise.all(SIZES.map(png));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);            // reservado
header.writeUInt16LE(1, 2);            // 1 = icono
header.writeUInt16LE(SIZES.length, 4);

let offset = 6 + SIZES.length * 16;
const entries = SIZES.map((size, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(size === 256 ? 0 : size, 0); // 0 significa 256
  e.writeUInt8(size === 256 ? 0 : size, 1);
  e.writeUInt8(0, 2);                       // paleta
  e.writeUInt8(0, 3);                       // reservado
  e.writeUInt16LE(1, 4);                    // planos
  e.writeUInt16LE(32, 6);                   // bits por píxel
  e.writeUInt32LE(blobs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += blobs[i].length;
  return e;
});

writeFileSync(`${OUT_ROOT}favicon.ico`, Buffer.concat([header, ...entries, ...blobs]));
console.log(`favicon.ico             ${SIZES.join("+")} px`);
