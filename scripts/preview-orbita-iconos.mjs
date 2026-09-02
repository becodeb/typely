/* =====================================================================
   VER LOS ICONOS DE ÓRBITA SIN ABRIR LA APP
   ---------------------------------------------------------------------
   Rasteriza los dieciocho SVG a un solo PNG de contacto, teñidos con el
   color con el que salen en el juego y sobre el azul del espacio.

     node scripts/preview-orbita-iconos.mjs
     -> .preview-orbita/iconos.png   (gitignored)

   Para qué sirve, en concreto: la fila del medio los dibuja a 20px, que
   es donde un icono se rompe. Un trazo fino desaparece a ese tamaño y una
   silueta llena no — el mismo criterio por el que ninguno de estos usa
   trazo como forma principal. Si algo no se distingue en esa fila, hay
   que rehacerlo antes de que llegue al HUD.

   Necesita sharp:  npm install sharp --no-save
===================================================================== */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ICONOS_DIR = path.join(RAIZ, "Images", "orbita", "iconos");
const RANGOS_DIR = path.join(RAIZ, "Images", "orbita", "rangos");
const SALIDA_DIR = path.join(RAIZ, ".preview-orbita");

/* El color de juego de cada uno. `currentColor` no existe fuera de un
   documento, así que para rasterizar hay que fijarlo — y conviene fijarlo
   en el color real y no en blanco, porque medio icono se juzga por cómo
   convive su color con el fondo. */
const ICONOS = [
  ["corazon-lleno", "#ff5f7a"], ["corazon-vacio", "#ff5f7a"],
  ["escudo-entero", "#54e8c6"], ["escudo-agrietado", "#54e8c6"],
  ["cristal", "#9b7cff"], ["pw-reparacion", "#ff5f7a"],
  ["pw-escudo", "#54e8c6"], ["pw-pulso", "#25c8df"],
  ["pw-tiempo", "#7c93ff"], ["pw-rayo", "#ffd552"],
  ["pw-cosecha", "#9b7cff"], ["pw-mira", "#ff9fca"],
];
const RANGOS = ["cadete", "piloto", "explorador", "as", "capitan", "leyenda"];

const COL = 6;
const CELDA = 132;
const PAD = 16;

const leer = (dir, n) => fs.readFileSync(path.join(dir, `${n}.svg`), "utf8");
const teñir = (s, c) => s.replaceAll("currentColor", c);
const png = (s, size) =>
  sharp(Buffer.from(s))
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

const faltan = [...ICONOS.map(([n]) => path.join(ICONOS_DIR, n + ".svg")),
                ...RANGOS.map((n) => path.join(RANGOS_DIR, n + ".svg"))]
  .filter((p) => !fs.existsSync(p));
if (faltan.length) {
  console.error("Faltan SVG:\n  " + faltan.join("\n  "));
  process.exit(1);
}

const capas = [];
let y = PAD;

/* Los iconos a 96px, en filas de seis. */
for (let i = 0; i < ICONOS.length; i++) {
  const [n, c] = ICONOS[i];
  capas.push({
    input: await png(teñir(leer(ICONOS_DIR, n), c), 96),
    left: PAD + (i % COL) * CELDA + 18,
    top: PAD + Math.floor(i / COL) * CELDA + 18,
  });
}
y = PAD + Math.ceil(ICONOS.length / COL) * CELDA;

/* Y los mismos a 20px: la prueba que importa. */
for (let i = 0; i < ICONOS.length; i++) {
  const [n, c] = ICONOS[i];
  capas.push({ input: await png(teñir(leer(ICONOS_DIR, n), c), 20), left: PAD + i * 34 + 8, top: y + 14 });
}
y += 56;

/* Los rangos a 96 y a 30: a 30 se tienen que poder contar los galones. */
for (let i = 0; i < RANGOS.length; i++) {
  capas.push({ input: await png(leer(RANGOS_DIR, RANGOS[i]), 96), left: PAD + i * CELDA + 18, top: y + 16 });
  capas.push({ input: await png(leer(RANGOS_DIR, RANGOS[i]), 30), left: PAD + i * CELDA + 51, top: y + 122 });
}
y += 170;

fs.mkdirSync(SALIDA_DIR, { recursive: true });
const salida = path.join(SALIDA_DIR, "iconos.png");
const W = PAD * 2 + COL * CELDA;
const H = y + PAD;

await sharp({ create: { width: W, height: H, channels: 4, background: { r: 10, g: 20, b: 46, alpha: 1 } } })
  .composite(capas)
  .png()
  .toFile(salida);

console.log(`${ICONOS.length} iconos + ${RANGOS.length} rangos · ${W}x${H}`);
console.log(`-> ${path.relative(RAIZ, salida)}`);
