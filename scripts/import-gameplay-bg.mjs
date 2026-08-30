import sharp from "sharp";
import { existsSync } from "node:fs";
import { carpetaDe, fuentesDe } from "./island-paths.mjs";

/* Importa el fondo de la pantalla de juego de una isla.
   ---------------------------------------------------------------------
   Entra   Images/islands/islandN/gameplay-source.png   (o .jpg / .webp)
   Sale    public/assets/islands/islandN/gameplay.webp  1672x941

   1672x941 es 16:9 y es el tamaño que ya usan los quince. Si la fuente viene
   en otra relacion de aspecto — ChatGPT devuelve 3:2 — se recorta al CENTRO,
   y de un 3:2 eso se lleva ~11 % arriba y ~11 % abajo. Arriba es cielo y no
   molesta; abajo esta la plataforma, asi que el script avisa cuanto recorto
   para que se pueda mirar si el pedestal quedo al ras.

   Ademas mide el pedestal al terminar, que es el chequeo que mas importa: si
   la plataforma es tan clara como las teclas, el teclado se funde con el piso.
   Ver Images/islands/FONDOS.md.

   Uso:  node scripts/import-gameplay-bg.mjs island1
         node scripts/import-gameplay-bg.mjs            (todas las que tengan fuente)
*/

const ANCHO = 1672, ALTO = 941;
const CALIDAD = 82;

/* Misma franja y misma tecla de referencia que scripts/medir-pedestal.mjs. */
const ZONA = { x0: 0.265, x1: 0.735, y0: 0.73, y1: 0.96 };
const TECLA = [246, 248, 252];
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

function fuenteDe(id) {
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const p = `${fuentesDe(id)}/gameplay-source.${ext}`;
    if (existsSync(p)) return p;
  }
  return null;
}

async function medirPedestal(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.round(H * ZONA.y0); y < Math.round(H * ZONA.y1); y++) {
    for (let x = Math.round(W * ZONA.x0); x < Math.round(W * ZONA.x1); x++) {
      const i = (y * W + x) * C;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
  }
  return contraste([r / n, g / n, b / n].map(Math.round), TECLA);
}

async function importar(id) {
  const src = fuenteDe(id);
  if (!src) return false;

  const m = await sharp(src).metadata();
  const arFuente = m.width / m.height, arDestino = ANCHO / ALTO;

  await sharp(src)
    .resize(ANCHO, ALTO, { fit: "cover", position: "centre" })
    .webp({ quality: CALIDAD })
    .toFile(`${carpetaDe(id)}/gameplay.webp`);

  const k = await medirPedestal(`${carpetaDe(id)}/gameplay.webp`);
  const nota = k < 2 ? "SE FUNDE con las teclas, plataforma muy clara"
    : k < 2.5 ? "flojo" : k > 6 ? "oscura: el teclado salta mucho, bien si el tema lo es" : "ok";

  console.log(`-- ${id} --`);
  console.log(`   fuente   ${src}  ${m.width}x${m.height}  (${arFuente.toFixed(3)})`);
  if (Math.abs(arFuente - arDestino) < 0.01) {
    console.log(`   encuadre ya venia 16:9, no se recorto nada`);
  } else if (arFuente < arDestino) {
    const perdido = (1 - arFuente / arDestino) / 2 * 100;
    console.log(`   encuadre mas alta que 16:9 -> recorte ${perdido.toFixed(1)} % ARRIBA y ${perdido.toFixed(1)} % ABAJO`);
    console.log(`            mira que la plataforma no haya quedado al ras del borde`);
  } else {
    const perdido = (1 - arDestino / arFuente) / 2 * 100;
    console.log(`   encuadre mas ancha que 16:9 -> recorte ${perdido.toFixed(1)} % a cada COSTADO`);
  }
  console.log(`   salida   ${carpetaDe(id)}/gameplay.webp  ${ANCHO}x${ALTO}`);
  console.log(`   pedestal ${k.toFixed(2)}:1 contra la tecla  -> ${nota}`);
  return true;
}

const arg = process.argv[2];
if (arg) {
  if (!/^island([1-9]|1[0-5])$/.test(arg)) {
    console.log("Uso: node scripts/import-gameplay-bg.mjs island1");
    process.exit(1);
  }
  if (!(await importar(arg))) {
    console.log(`${arg}: no encontre gameplay-source.png en ${fuentesDe(arg)}/`);
    process.exit(1);
  }
} else {
  let n = 0;
  for (let i = 1; i <= 15; i++) if (await importar(`island${i}`)) n++;
  if (!n) console.log("Nada que importar. Dejá gameplay-source.png en Images/islands/islandN/.");
}
