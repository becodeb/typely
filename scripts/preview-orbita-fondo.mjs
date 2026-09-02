/* =====================================================================
   VER EL FONDO DE LA TORMENTA, ANTES DE QUE EXISTA EL JUEGO
   ---------------------------------------------------------------------
   Apila las tres capas —estrellas + nebulosa + polvo— teñidas a tres
   niveles de amenaza, y dibuja palabras encima al tamaño real.

     node scripts/preview-orbita-fondo.mjs
     -> .preview-orbita/fondo.png   (gitignored)

   Por qué las palabras. El fondo de este juego tiene UN trabajo y no es
   verse lindo: es dejar leer texto en movimiento que un chico tiene que
   escribir a toda velocidad. Un fondo se aprueba con las palabras encima
   o no se aprueba. Es el mismo criterio por el que import-gameplay-bg
   mide el pedestal contra una tecla en vez de mirarlo.

   Cómo funciona el teñido, que es lo que justifica generar la nebulosa
   en GRIS: la nebulosa no se pinta, se usa como MÁSCARA. Su luminancia
   por su alfa decide cuánto color de amenaza entra en cada píxel. Por eso
   la misma imagen puede ir de azul tranquilo a rojo sin ensuciarse — cosa
   imposible si viniera ya coloreada.

   Necesita sharp:  npm install sharp --no-save
===================================================================== */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const RAIZ = path.resolve(import.meta.dirname, "..");
const FONDO = path.join(RAIZ, "public", "assets", "orbita", "fondo");
const SALIDA_DIR = path.join(RAIZ, ".preview-orbita");

const W = 1000;
const H = 562; // 16:9, la proporción de la Chromebook

/* Los tres momentos de una partida. El color no está en el arte: está acá,
   y en el juego lo interpola el controlador de dificultad (§4 del diseño). */
/* Pervinca → violeta → coral: la tormenta es color de tormenta, no de
   sangre (TINTE_PARADAS en TormentaPage.tsx; cambiar los dos juntos). */
const MOMENTOS = [
  { nombre: "amenaza 8 · Cadete",   color: [84, 112, 224], fuerza: 0.55 },
  { nombre: "amenaza 52 · As",      color: [146, 92, 236], fuerza: 0.85 },
  { nombre: "amenaza 94 · Leyenda", color: [236, 84, 124], fuerza: 1.0 },
];

/* Palabras de las bandas reales del currículum, a los tamaños en que van
   a aparecer: chicas al nacer en el punto de fuga, grandes al acercarse.
   Las dos últimas cruzan la franja del horizonte, que es donde una capa
   nueva puede robarles la lectura. */
const PALABRAS = [
  { t: "bosque",   x: 0.5,  y: 0.28, s: 15, o: 0.55 },
  { t: "montaña",  x: 0.27, y: 0.42, s: 26, o: 0.9 },
  { t: "¿cuándo?", x: 0.72, y: 0.46, s: 28, o: 0.9 },
  { t: "reloj",    x: 0.44, y: 0.62, s: 38, o: 1 },
  { t: "señal",    x: 0.78, y: 0.66, s: 34, o: 1 },
  { t: "planeta",  x: 0.32, y: 0.76, s: 42, o: 1 },
  { t: "¡Vamos!",  x: 0.66, y: 0.8,  s: 44, o: 1 },
];

const falta = ["estrellas", "nebulosa", "polvo"].filter(
  (n) => !fs.existsSync(path.join(FONDO, `${n}.webp`)),
);
if (falta.length) {
  console.error(`Faltan capas importadas: ${falta.join(", ")}.`);
  console.error("Corré primero: node scripts/import-orbita-art.mjs fondo");
  process.exit(1);
}

/** La nebulosa gris convertida en nube DEL COLOR de la amenaza.
 *  Su luminancia × su alfa deciden la densidad; el color lo pone el juego.
 *  Esto es exactamente lo que hará el CSS con mask-image. */
async function nubeTeñida(color, fuerza) {
  const { data, info } = await sharp(path.join(FONDO, "nebulosa.webp"))
    .resize(W, H, { fit: "cover" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(W * H * 4);
  for (let i = 0, j = 0; i < data.length; i += info.channels, j += 4) {
    const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    out[j] = color[0];
    out[j + 1] = color[1];
    out[j + 2] = color[2];
    out[j + 3] = Math.round(Math.min(255, data[i + 3] * lum * fuerza));
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

/** Las palabras, con halo oscuro detrás del glifo (paint-order: stroke),
 *  que es la misma solución que usan los números blancos sobre los discos
 *  claros del mapa de islas. */
function palabras() {
  const t = PALABRAS.map(
    (p) => `<text x="${(p.x * W).toFixed(0)}" y="${(p.y * H).toFixed(0)}"
        font-family="Baloo 2, Trebuchet MS, sans-serif" font-size="${p.s}" font-weight="700"
        text-anchor="middle" fill="#ffffff" fill-opacity="${p.o}"
        stroke="#050b1e" stroke-width="${(p.s * 0.16).toFixed(1)}" stroke-opacity="0.75"
        paint-order="stroke">${p.t}</text>`,
  ).join("");
  return Buffer.from(`<svg width="${W}" height="${H}">${t}</svg>`);
}

/* El horizonte es opcional: si todavía no se importó, la preview sale sin
   él (y lo dice). Va entre la nube y el polvo, anclado abajo, igual que la
   capa .orb-horizonte de la página. */
const horizontePath = path.join(FONDO, "horizonte.webp");
const conHorizonte = fs.existsSync(horizontePath);
const horizonte = conHorizonte
  ? await sharp(horizontePath).resize(W, H, { fit: "cover", position: "bottom" }).png().toBuffer()
  : null;

const paneles = [];
for (const m of MOMENTOS) {
  const base = await sharp(path.join(FONDO, "estrellas.webp")).resize(W, H, { fit: "cover" }).toBuffer();
  const nube = await nubeTeñida(m.color, m.fuerza);
  const polvo = await sharp(path.join(FONDO, "polvo.webp")).resize(W, H, { fit: "cover" }).png().toBuffer();

  const capasPanel = [{ input: nube }];
  if (horizonte) capasPanel.push({ input: horizonte });
  capasPanel.push({ input: polvo }, { input: palabras() });

  paneles.push(await sharp(base).composite(capasPanel).png().toBuffer());
}

const PAD = 14;
const ALTO_ETQ = 26;
const TOTAL_H = PAD + MOMENTOS.length * (H + ALTO_ETQ + PAD);

const capas = [];
MOMENTOS.forEach((m, i) => {
  const y = PAD + i * (H + ALTO_ETQ + PAD);
  capas.push({ input: paneles[i], left: PAD, top: y });
  capas.push({
    input: Buffer.from(
      `<svg width="${W}" height="${ALTO_ETQ}"><text x="0" y="17" font-family="monospace" font-size="13" fill="#8fa4cc">${m.nombre}</text></svg>`,
    ),
    left: PAD,
    top: y + H + 4,
  });
});

fs.mkdirSync(SALIDA_DIR, { recursive: true });
const salida = path.join(SALIDA_DIR, "fondo.png");
await sharp({
  create: { width: W + PAD * 2, height: TOTAL_H, channels: 4, background: { r: 5, g: 9, b: 24, alpha: 1 } },
})
  .composite(capas)
  .png()
  .toFile(salida);

console.log(`${MOMENTOS.length} momentos · ${W}x${H} cada uno${conHorizonte ? " · con horizonte" : " · SIN horizonte (falta fondo/horizonte.webp)"}`);
console.log(`-> ${path.relative(RAIZ, salida)}`);
console.log("Mirá una sola cosa: si las palabras se leen en los tres, sobre todo en coral y cruzando el horizonte.");
