/* =====================================================================
   IMPORTADOR DE LAS PIEZAS 3D DEL MODO AUTOMATIZACIÓN
   ---------------------------------------------------------------------
   Toma los PNG de Images/automatizacion/render/ —los cristales que arma
   scripts/importar-cristales-verde.mjs a partir del pliego ilustrado, y
   la nave que renderiza Blender— y los deja como WebP donde el juego
   los busca.

   OJO — este script ya NO toca las islas ni src/data/automatizacion/campos.ts.
   Las islas dejaron de salir de Blender: son ilustraciones, entran por
   scripts/importar-islas-verde.mjs y sus coordenadas las mide
   scripts/medir-grilla-islas.mjs, que es el ÚNICO que escribe campos.ts.
   Si este importador volviera a generarlo, pisaría la grilla medida con
   la del modelo procedural y todas las baldosas quedarían corridas.

     npm install sharp --no-save
     node scripts/import-automatizacion-art.mjs
===================================================================== */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const RAIZ = path.resolve(import.meta.dirname, "..");
const FUENTE = path.join(RAIZ, "Images", "automatizacion", "render");
const DESTINO = path.join(RAIZ, "public", "assets", "automatizacion");

const VARIANTES = ["punta", "racimo", "prisma", "estrella"];
const ETAPAS = ["brote", "creciendo", "maduro"];

/** La nave viene en DIECISÉIS vistas, una cada 22,5°, nombradas por su
 *  ángulo (nave-r000 … nave-r338; 0° = norte, 90° = este). El juego lleva
 *  un ángulo continuo y elige la vista más cercana, así la nave gira en
 *  vez de saltar de un rumbo a otro. Salen de
 *  `blender -b modelo.blend -P scripts/blender/render-piezas.py -- --nombre nave --pasos 16`. */
const FUENTE_NAVE = path.join(RAIZ, "Images", "automatizacion", "render-nave");
const VISTAS_NAVE = Array.from({ length: 16 }, (_, i) => `r${String(Math.floor((i * 360) / 16)).padStart(3, "0")}`);

/** El punto de apoyo de cada pieza, en fracción del lienzo. Es el
 *  contrato con el juego: esa coordenada es "el centro de la baldosa", y
 *  por eso una pieza se puede reemplazar por otra sin tocar una sola
 *  posición. Lo garantizan los scripts que arman las piezas; acá sólo se
 *  verifica que el lienzo siga siendo cuadrado, que es de lo que depende.
 *  Se lee del MISMO módulo que usa el juego, compilado al vuelo. */
const ANCLA = (await cargarEscena()).ANCLA_PIEZA;

async function cargarEscena() {
  const out = path.join(RAIZ, ".preview-automatizacion", "escena.bundle.mjs");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await build({
    entryPoints: [path.join(RAIZ, "src", "data", "automatizacion", "escena.ts")],
    bundle: true,
    format: "esm",
    outfile: out,
    logLevel: "silent",
  });
  return import(pathToFileURL(out).href);
}

async function aWebp(origen, destino, { calidad = 92, carpeta = FUENTE } = {}) {
  const img = sharp(path.join(carpeta, origen));
  const meta = await img.metadata();
  if (!meta.hasAlpha) {
    throw new Error(
      `${origen} no tiene canal alfa. Se renderiza con Film > Transparent; ` +
        `sin alfa la pieza tapa la isla que tiene detrás, y el error recién ` +
        `se ve al abrir la página.`,
    );
  }
  if (meta.width !== meta.height) {
    throw new Error(
      `${origen} mide ${meta.width}x${meta.height} y tiene que ser cuadrado: ` +
        `el punto de apoyo está definido como fracción del lienzo (${ANCLA.x}, ${ANCLA.y}).`,
    );
  }
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  await img.webp({ quality: calidad, effort: 5 }).toFile(destino);
  const kb = (fs.statSync(destino).size / 1024).toFixed(0);
  return `${path.basename(destino)} ${meta.width}×${meta.height} ${kb} KB`;
}

const faltantes = [];

for (const v of VARIANTES) {
  for (const e of ETAPAS) {
    const png = `${v}-${e}.png`;
    if (!fs.existsSync(path.join(FUENTE, png))) { faltantes.push(png); continue; }
    console.log(" cristal:", await aWebp(png, path.join(DESTINO, "cristales", `${v}-${e}.webp`)));
  }
}

for (const v of VISTAS_NAVE) {
  const png = `nave-${v}.png`;
  if (!fs.existsSync(path.join(FUENTE_NAVE, png))) { faltantes.push(png); continue; }
  console.log(" nave:", await aWebp(png, path.join(DESTINO, "nave", `nave-${v}.webp`), { carpeta: FUENTE_NAVE }));
}

console.log(`\n ${VARIANTES.length * ETAPAS.length} cristales, ${VISTAS_NAVE.length} vistas de nave`);
if (faltantes.length) console.log(" FALTAN:", faltantes.join(", "));
