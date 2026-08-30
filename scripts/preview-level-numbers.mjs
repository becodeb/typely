import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { botonDe } from "./island-paths.mjs";

/* Lámina de contacto para MIRAR el número sobre cada botón, en sus dos
   estados: blanco (nivel sin completar) y el color propio de la isla (nivel
   completado). El contraste calculado dice si se puede leer; esto dice si
   se ve bien, que no es lo mismo.

   Correr:  node scripts/preview-level-numbers.mjs
   Sale en  .preview-niveles/numeros.png   (gitignored)
*/

/* Tiene que coincidir con LEVEL_NUMBER_DONE en src/utils/assets.ts. */
const COMPLETADO = {
  island1: "#244c5f", island2: "#153831", island3: "#d6aab1", island4: "#ba3f1c",
  island5: "#0c3362", island6: "#0f172b", island7: "#55271a", island8: "#8dabc8",
  island9: "#3f230f", island10: "#0b1d0b", island11: "#320f18", island12: "#0b0904",
  island13: "#cc9fd1", island14: "#0a1b18", island15: "#8ba4e1",
};

const ANCHO = 300;          // cada botón, escalado a esta caja
const ALTO = Math.round(445 * (ANCHO / 600));
const COLS = 5;

/* El número se dibuja al 24.21 cqw del ancho del botón (§6.1), y el botón
   ocupa 454/600 del lienzo. */
const TAM = Math.round(ANCHO * (454 / 600) * 0.2421 * 2.6);

/* `contorno` reproduce el WebkitTextStroke que lleva el número BLANCO en
   IslandDetailPage: 11 % del tamaño de letra, pintado DETRÁS del relleno. Es
   lo que lo hace legible sobre los discos claros, así que sin esto la lámina
   mentiría justo en el caso que importa. */
function numeroSVG(texto, color, contorno) {
  const trazo = contorno
    ? ` stroke="rgba(0,0,0,0.5)" stroke-width="${(TAM * 0.11).toFixed(1)}" style="paint-order:stroke"`
    : "";
  return Buffer.from(
    `<svg width="${ANCHO}" height="${ALTO}" xmlns="http://www.w3.org/2000/svg">
       <defs><filter id="s"><feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#000" flood-opacity="0.5"/></filter></defs>
       <text x="${ANCHO / 2}" y="${Math.round(ALTO * 0.48)}"
             font-family="Verdana, DejaVu Sans, sans-serif" font-size="${TAM}"
             font-weight="900" fill="${color}"${trazo} text-anchor="middle"
             dominant-baseline="central" filter="url(#s)">${texto}</text>
     </svg>`,
  );
}

mkdirSync(".preview-niveles", { recursive: true });

const celdas = [];
for (let n = 1; n <= 15; n++) {
  const id = `island${n}`;
  const boton = await sharp(botonDe(id)).resize(ANCHO, ALTO, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  /* Dos copias del mismo botón: una con el número blanco y otra con el del
     nivel completado. Van pegadas, para comparar de un vistazo. */
  const sinCompletar = await sharp(boton).composite([{ input: numeroSVG(String(n), "#ffffff", true) }]).toBuffer();
  const completado = await sharp(boton).composite([{ input: numeroSVG(String(n), COMPLETADO[id], false) }]).toBuffer();
  const par = await sharp({
    create: { width: ANCHO * 2, height: ALTO + 22, channels: 4, background: { r: 236, g: 240, b: 245, alpha: 1 } },
  })
    .composite([
      { input: sinCompletar, left: 0, top: 22 },
      { input: completado, left: ANCHO, top: 22 },
      {
        input: Buffer.from(
          `<svg width="${ANCHO * 2}" height="22" xmlns="http://www.w3.org/2000/svg">
             <text x="6" y="15" font-family="Verdana, sans-serif" font-size="12" fill="#333">${id}</text>
             <text x="${ANCHO - 6}" y="15" font-family="Verdana, sans-serif" font-size="11" fill="#777" text-anchor="end">sin completar</text>
             <text x="${ANCHO * 2 - 6}" y="15" font-family="Verdana, sans-serif" font-size="11" fill="#777" text-anchor="end">completado ${COMPLETADO[id]}</text>
           </svg>`,
        ),
        left: 0, top: 0,
      },
    ])
    .png()
    .toBuffer();
  celdas.push(par);
}

const CW = ANCHO * 2, CH = ALTO + 22;
const filas = Math.ceil(celdas.length / (COLS / 1));
const porFila = 3;
const total = Math.ceil(celdas.length / porFila);
await sharp({
  create: { width: CW * porFila, height: CH * total, channels: 4, background: { r: 236, g: 240, b: 245, alpha: 1 } },
})
  .composite(celdas.map((buf, i) => ({ input: buf, left: (i % porFila) * CW, top: Math.floor(i / porFila) * CH })))
  .png()
  .toFile(".preview-niveles/numeros.png");

void filas;
console.log(`Listo → .preview-niveles/numeros.png  (${CW * porFila}x${CH * total})`);
