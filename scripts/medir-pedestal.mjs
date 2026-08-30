import sharp from "sharp";

/* Mide el valor de la plataforma de un fondo de nivel, justo donde el juego
   apoya el teclado, y lo compara con el color de una tecla.
   ---------------------------------------------------------------------
   El teclado es DOM: teclas casi blancas con letra azul oscura y borde claro.
   Si la plataforma tambien es casi blanca, las teclas no se despegan del
   fondo — se leen, pero el teclado deja de leerse como un objeto apoyado.

   La franja que se mide es la union de donde caen las teclas en los tres
   tamaños medidos en FONDOS.md: x 26.5..73.5 %, y 73..96 %.

   Uso:  node scripts/medir-pedestal.mjs <imagen> [<imagen> …]
*/

const ZONA = { x0: 0.265, x1: 0.735, y0: 0.73, y1: 0.96 };
/* Color medio de una tecla en reposo (gradiente blanco -> bg-soft). */
const TECLA = [246, 248, 252];

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const archivos = process.argv.slice(2);
if (!archivos.length) {
  console.log("Uso: node scripts/medir-pedestal.mjs public/assets/islands/island1/gameplay.webp");
  process.exit(0);
}

console.log("archivo                                        plataforma        contra la tecla");
for (const file of archivos) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const x0 = Math.round(W * ZONA.x0), x1 = Math.round(W * ZONA.x1);
  const y0 = Math.round(H * ZONA.y0), y1 = Math.round(H * ZONA.y1);
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * C;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
  }
  const medio = [r / n, g / n, b / n].map(Math.round);
  const k = contraste(medio, TECLA);
  /* Los umbrales salen de MEDIR los fondos que ya funcionan, no de una regla
     general: la isla 10 da 3.71, la 6 da 4.54 y la 8 da 4.51, y en las tres el
     teclado se lee como un objeto apoyado sobre la plataforma. El placeholder
     que comparten las islas 1 a 5 da 1.56 y ahi las teclas se funden con el
     piso. No es contraste de TEXTO — la tecla trae borde y sombra propios —,
     es cuanto se despega el teclado del pedestal. */
  const nota = k < 2 ? "  <-- SE FUNDE, plataforma muy clara"
    : k < 2.5 ? "  (flojo)"
    : k > 6 ? "  <-- plataforma muy oscura" : "  ok";
  console.log(`${file.padEnd(46)} rgb(${medio.join(",").padEnd(11)})  ${k.toFixed(2)}:1${nota}`);
}
