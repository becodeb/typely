/* =====================================================================
   VER LAS INSIGNIAS Y LAS GEMAS COMO FAMILIA
   ---------------------------------------------------------------------
   El equivalente de preview-orbita-iconos.mjs, pero para los objetos 3D
   del rediseño (ORBITA.md §7.3 y §7.4).

     node scripts/preview-orbita-objetos.mjs
     -> .preview-orbita/objetos.png   (gitignored)

   Por qué existe. Una insignia suelta siempre parece linda; el problema
   aparece en fila, que es como se ven de verdad: en el podio hay tres
   juntas, y un chico distingue su rango del de al lado CONTANDO galones.
   Por eso la lámina las pone una al lado de la otra y a tres tamaños:

     · 140 px — el resultado y el podio, donde se lucen;
     ·  96 px — el tamaño en el que tiene que seguir contándose la forma;
     ·  40 px — el hub. Si algo se rompe, se rompe acá.

   Y sobre DOS fondos, porque viven en los dos: el índigo de la escena y
   el vidrio claro de la tarjeta de resultado. Un objeto con halo blanco
   se ve precioso sobre el oscuro y desaparece sobre el vidrio.

   Necesita sharp:  npm install sharp --no-save
===================================================================== */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ARTE = path.join(RAIZ, "public", "assets", "orbita");
const SALIDA_DIR = path.join(RAIZ, ".preview-orbita");

/* El orden es el del juego, no el alfabético: los rangos suben. */
const ORDEN_INSIGNIAS = ["cadete", "piloto", "explorador", "as", "capitan", "leyenda"];
const ORDEN_GEMAS = [
  "cristal",
  "reparacion",
  "escudo",
  "pulso",
  "lento",
  "rayo",
  "cosecha",
  "mira",
];

const TAMANOS = [140, 96, 40];
const PAD = 16;
const ALTO_ETQ = 22;

/* Los dos fondos reales: la escena y el vidrio de la tarjeta. */
const FONDOS = [
  { nombre: "sobre la escena (índigo)", color: { r: 20, g: 27, b: 77, alpha: 1 }, texto: "#8fa4cc" },
  { nombre: "sobre el vidrio de la tarjeta", color: { r: 223, g: 228, b: 245, alpha: 1 }, texto: "#52658f" },
];

function presentes(grupo, orden) {
  const dir = path.join(ARTE, grupo);
  if (!fs.existsSync(dir)) return [];
  const hay = new Set(
    fs.readdirSync(dir).filter((f) => f.endsWith(".webp")).map((f) => path.basename(f, ".webp")),
  );
  /* Primero los conocidos en su orden; después cualquier extra, para que
     una pieza con nombre nuevo no quede invisible. */
  const conocidos = orden.filter((n) => hay.has(n));
  const extra = [...hay].filter((n) => !orden.includes(n)).sort();
  return [...conocidos, ...extra];
}

function etiqueta(texto, ancho, color, tam = 12) {
  return Buffer.from(
    `<svg width="${ancho}" height="${ALTO_ETQ}"><text x="0" y="${ALTO_ETQ - 7}" font-family="monospace" font-size="${tam}" fill="${color}">${texto}</text></svg>`,
  );
}

async function bloque(grupo, nombres, fondo) {
  if (!nombres.length) return null;
  const ancho = PAD + nombres.length * (TAMANOS[0] + PAD);
  const altoFilas = TAMANOS.reduce((a, t) => a + t + PAD, 0);
  const alto = ALTO_ETQ + PAD + altoFilas + ALTO_ETQ;

  const capas = [];
  capas.push({ input: etiqueta(`${grupo} — ${fondo.nombre}`, ancho, fondo.texto, 13), left: PAD, top: 4 });

  let y = ALTO_ETQ + PAD;
  for (const tam of TAMANOS) {
    let x = PAD;
    for (const nombre of nombres) {
      const img = await sharp(path.join(ARTE, grupo, `${nombre}.webp`))
        .resize(tam, tam, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      /* Centrado en la celda del tamaño más grande, alineado abajo: así la
         fila se lee como una repisa y se comparan los tamaños reales. */
      capas.push({
        input: img,
        left: Math.round(x + (TAMANOS[0] - tam) / 2),
        top: Math.round(y + (TAMANOS[0] - tam) / 2),
      });
      x += TAMANOS[0] + PAD;
    }
    y += tam + PAD;
  }

  let x = PAD;
  for (const nombre of nombres) {
    capas.push({ input: etiqueta(nombre, TAMANOS[0], fondo.texto), left: x, top: alto - ALTO_ETQ });
    x += TAMANOS[0] + PAD;
  }

  return {
    buffer: await sharp({ create: { width: ancho, height: alto, channels: 4, background: fondo.color } })
      .composite(capas)
      .png()
      .toBuffer(),
    ancho,
    alto,
  };
}

const grupos = [
  { grupo: "insignias", nombres: presentes("insignias", ORDEN_INSIGNIAS) },
  { grupo: "gemas", nombres: presentes("gemas", ORDEN_GEMAS) },
].filter((g) => g.nombres.length);

if (!grupos.length) {
  console.error("No hay objetos importados todavía.");
  console.error("Corré primero: node scripts/import-orbita-art.mjs insignias gemas");
  process.exit(1);
}

const bloques = [];
for (const g of grupos) {
  for (const fondo of FONDOS) {
    const b = await bloque(g.grupo, g.nombres, fondo);
    if (b) bloques.push(b);
  }
}

const anchoTotal = Math.max(...bloques.map((b) => b.ancho));
const altoTotal = bloques.reduce((a, b) => a + b.alto, 0);

fs.mkdirSync(SALIDA_DIR, { recursive: true });
const salida = path.join(SALIDA_DIR, "objetos.png");
let top = 0;
const capas = bloques.map((b) => {
  const c = { input: b.buffer, left: 0, top };
  top += b.alto;
  return c;
});

await sharp({
  create: { width: anchoTotal, height: altoTotal, channels: 4, background: { r: 8, g: 12, b: 30, alpha: 1 } },
})
  .composite(capas)
  .png()
  .toFile(salida);

for (const g of grupos) console.log(`${g.grupo}: ${g.nombres.join(" · ")}`);
console.log(`-> ${path.relative(RAIZ, salida)}`);
console.log("Mirá dos cosas: si la fila se ve como UNA familia (misma cámara, mismo brillo),");
console.log("y si a 96 px todavía se pueden CONTAR los galones sin mirar el color.");
