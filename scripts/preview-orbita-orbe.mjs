/* =====================================================================
   VER UN ORBE ARMADO, ANTES DE QUE EXISTA LA PANTALLA
   ---------------------------------------------------------------------
   Apila las tres capas —mundo + cristal + brillo— sobre el cielo real del
   selector y sobre un fondo oscuro, en los dos tamaños en que se va a ver.

     node scripts/preview-orbita-orbe.mjs
     -> .preview-orbita/orbes.png   (gitignored)

   Por qué existe: un orbe NO se aprueba mirando el PNG del cristal suelto.
   Las dos cosas que lo hunden sólo aparecen al apilarlo — que el aro le
   grite al mundo de adentro, y que el aro pierda el filo contra el cielo
   pálido del fondo. Las dos se ven en un segundo acá y no se ven nunca
   mirando las capas por separado.

   Toma lo que haya: prefiere el WebP ya importado y si no está usa el
   PNG fuente, así se puede mirar una capa recién generada sin importar
   nada todavía. Si falta el mundo, usa la miniatura de una isla como
   doble de riesgo — alcanza para juzgar si el aro convive con un
   interior pastel.

   Necesita sharp:  npm install sharp --no-save
===================================================================== */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const RAIZ = path.resolve(import.meta.dirname, "..");
const FUENTES = path.join(RAIZ, "Images", "orbita", "orbes");
const IMPORTADO = path.join(RAIZ, "public", "assets", "orbita", "orbes");
const PUBLICO = path.join(RAIZ, "public", "assets");
const SALIDA_DIR = path.join(RAIZ, ".preview-orbita");

/* El WebP importado gana: es lo que carga el juego. La fuente es el
   plan B para mirar algo recién generado sin importarlo todavía. */
function capa(nombre) {
  const w = path.join(IMPORTADO, `${nombre}.webp`);
  if (fs.existsSync(w)) return { archivo: w, origen: "importado" };
  for (const ext of ["png", "webp", "jpg", "jpeg"]) {
    const p = path.join(FUENTES, `${nombre}-source.${ext}`);
    if (fs.existsSync(p)) return { archivo: p, origen: "fuente" };
  }
  return null;
}

/** Máscara circular del tamaño pedido. */
const circulo = (lado) =>
  Buffer.from(
    `<svg width="${lado}" height="${lado}"><circle cx="${lado / 2}" cy="${lado / 2}" r="${lado / 2 - 1}" fill="#fff"/></svg>`,
  );

/** Doble de riesgo cuando todavía no hay ningún mundo generado: el cielo
 *  del juego con una isla encima. No es el arte final, pero tiene el
 *  mismo problema — es pastel y claro, que es lo que hay que ver si el
 *  aro respeta. */
async function mundoProvisorio(lado) {
  const cielo = path.join(PUBLICO, "edutic-art", "sky-soft-bg.webp");
  const isla = path.join(PUBLICO, "islands", "island1", "map.webp");
  const base = await sharp(cielo).resize(lado, lado, { fit: "cover" }).toBuffer();
  if (!fs.existsSync(isla)) return base;
  const thumb = await sharp(isla).resize(Math.round(lado * 0.62)).toBuffer();
  return sharp(base)
    .composite([{ input: thumb, gravity: "center" }])
    .toBuffer();
}

/** Un orbe completo, con transparencia, al tamaño pedido. */
async function armarOrbe(mundo, cristal, brillo, lado) {
  let disco;
  if (mundo) {
    disco = await sharp(mundo.archivo).resize(lado, lado, { fit: "cover" }).ensureAlpha().png().toBuffer();
  } else {
    disco = await mundoProvisorio(lado);
  }
  /* El mundo entra recortado en círculo — igual que hace el importador. */
  disco = await sharp(disco).composite([{ input: circulo(lado), blend: "dest-in" }]).png().toBuffer();

  const encima = [];
  for (const c of [cristal, brillo]) {
    if (!c) continue;
    encima.push({
      input: await sharp(c.archivo).resize(lado, lado, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
    });
  }
  return sharp(disco).composite(encima).png().toBuffer();
}

/* ------------------------------------------------------------------ */

const cristal = capa("cristal");
const brillo = capa("brillo");
const mundos = ["mundo-aventura", "mundo-orbita", "mundo-dormido"].map((n) => ({ n, c: capa(n) }));

if (!cristal) {
  console.error("No encontré el cristal. Poné Images/orbita/orbes/cristal-source.png y volvé a correr.");
  process.exit(1);
}

console.log(`cristal: ${cristal.origen}`);
console.log(`brillo:  ${brillo ? brillo.origen : "FALTA — sin él la esfera se queda en aro (§4.2)"}`);
for (const m of mundos) console.log(`${m.n}: ${m.c ? m.c.origen : "falta, se usa el doble de riesgo"}`);

const GRANDE = 300; // el orbe en el selector, en foco
const CHICO = 130;  // el mismo orbe en reposo, al costado
const PAD = 28;
const FILAS = mundos.length;
const ALTO_FILA = GRANDE + PAD;
const W = PAD * 2 + GRANDE + CHICO + PAD * 2 + 300;
const H = PAD + FILAS * ALTO_FILA + PAD + 44;

/* Fondo izquierdo: el cielo REAL del selector. Derecho: oscuro, para ver
   si el aro depende de un fondo claro para leerse. */
const cielo = await sharp(path.join(PUBLICO, "edutic-art", "sky-soft-bg.webp"))
  .resize(Math.round(W / 2), H, { fit: "cover" })
  .toBuffer();
const oscuro = await sharp({
  create: { width: W - Math.round(W / 2), height: H, channels: 4, background: { r: 8, g: 16, b: 40, alpha: 1 } },
}).png().toBuffer();

const capas = [
  { input: cielo, left: 0, top: 0 },
  { input: oscuro, left: Math.round(W / 2), top: 0 },
];

for (let i = 0; i < mundos.length; i++) {
  const m = mundos[i];
  const y = PAD + i * ALTO_FILA;
  const g = await armarOrbe(m.c, cristal, brillo, GRANDE);
  const c = await armarOrbe(m.c, cristal, brillo, CHICO);
  /* La misma fila sobre los dos fondos, para comparar de un vistazo. */
  capas.push({ input: g, left: PAD, top: y });
  capas.push({ input: c, left: PAD + GRANDE + PAD, top: y + Math.round((GRANDE - CHICO) / 2) });
  capas.push({ input: g, left: Math.round(W / 2) + PAD, top: y });
  capas.push({ input: c, left: Math.round(W / 2) + PAD + GRANDE + PAD, top: y + Math.round((GRANDE - CHICO) / 2) });
}

const etiquetas = mundos
  .map((m, i) => {
    const y = PAD + i * ALTO_FILA + GRANDE + 16;
    const t = m.c ? m.n : `${m.n} (doble de riesgo)`;
    return `<text x="${PAD}" y="${y}" font-family="monospace" font-size="13" fill="#2a3f6b">${t}</text>
            <text x="${Math.round(W / 2) + PAD}" y="${y}" font-family="monospace" font-size="13" fill="#93a8d4">${t}</text>`;
  })
  .join("");

capas.push({
  input: Buffer.from(
    `<svg width="${W}" height="${H}">
       <text x="${PAD}" y="${H - 16}" font-family="monospace" font-size="13" fill="#2a3f6b">sobre el cielo del selector — sky-soft-bg.webp</text>
       <text x="${Math.round(W / 2) + PAD}" y="${H - 16}" font-family="monospace" font-size="13" fill="#93a8d4">sobre fondo oscuro</text>
       ${etiquetas}
     </svg>`,
  ),
  left: 0,
  top: 0,
});

fs.mkdirSync(SALIDA_DIR, { recursive: true });
const salida = path.join(SALIDA_DIR, "orbes.png");
await sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
  .composite(capas)
  .png()
  .toFile(salida);

console.log("");
console.log(`${W}x${H} -> ${path.relative(RAIZ, salida)}`);
console.log("Mirá dos cosas: si el aro le grita al mundo de adentro, y si sigue");
console.log("teniendo filo sobre el cielo pálido de la izquierda.");
