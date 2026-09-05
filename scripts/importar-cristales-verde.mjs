/* =====================================================================
   LOS CRISTALES DEL VIVERO — del pliego ilustrado a las doce piezas
   ---------------------------------------------------------------------
   Los cristales NO salen de Blender: los dibuja la misma IA que dibujó
   las islas, en un solo pliego sobre verde lima —cuatro minerales en
   filas, tres etapas en columnas— y este script lo convierte en las
   doce piezas que el juego intercambia sobre cualquier baldosa.

   El primer intento fue procedural (scripts/blender/cristales-…py) y
   dio cilindros con brillo: al lado de la piedra pintada de la isla se
   leían como velas de plástico. Un cristal de esta isla tiene que estar
   PINTADO por la misma mano que la isla, y eso es un pliego, no un
   shader.

   Lo que hace, y por qué cada cosa sale mal a mano:

     1. Quita el verde DES-PREMULTIPLICANDO: en el borde el píxel es una
        mezcla de cristal y fondo, y en vez de bajarle la opacidad y
        dejarlo verdoso, se despeja la ecuación y se recupera el color
        real del cristal. Después un limitador (g ≤ max(r, b)) mata el
        derrame que queda. Acá no hay follaje que cuidar: ningún cristal
        es verde, así que el limitador puede ser duro.
     2. Corta el pliego en celdas por las franjas vacías, sin medir nada.
     3. En cada celda separa el CUERPO de los destellos, porque el apoyo
        y el tamaño se miden sobre el cuerpo: si contaran los destellos,
        el maduro apoyaría flotando y saldría más chico que su vecino.
     4. Encuadra cada fila POR SU MADURO y aplica ese mismo encuadre al
        brote y al creciendo, forzando además la progresión de tamaños
        que pide MVP.md §4: maduro ≈ 3 × brote. Si cada etapa se
        encuadrara sola, el brote saldría del tamaño del maduro.
     5. Apoya cada pieza en (50 %, 75 %) de un lienzo cuadrado de 512:
        es el CONTRATO con CampoCristales.tsx —esa coordenada es "el
        centro de la baldosa"— y lo que permite cambiar una pieza sin
        mover un número.

   Deja los PNG en Images/automatizacion/render/, de donde los toma
   scripts/import-automatizacion-art.mjs para pasarlos a WebP, y un
   pliego de contacto en .preview-automatizacion/ para MIRARLOS antes de
   darlos por buenos.

     npm install sharp --no-save
     node scripts/importar-cristales-verde.mjs
     node scripts/import-automatizacion-art.mjs
===================================================================== */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const RAIZ = path.resolve(import.meta.dirname, "..");
const HOJA = path.join(RAIZ, "Images", "automatizacion", "cristales", "hoja-verde.png");
const RENDER = path.join(RAIZ, "Images", "automatizacion", "render");
const PREVIEW = path.join(RAIZ, ".preview-automatizacion");
const CAMPO = path.join(RAIZ, "public", "assets", "automatizacion", "campo");
const GRILLA = path.join(RAIZ, "Images", "automatizacion", "islas", "grilla.json");

/** Filas del pliego, de arriba abajo, y columnas de izquierda a derecha.
 *  Es el único lugar donde el orden del dibujo se traduce a nombres. */
const VARIANTES = ["punta", "racimo", "prisma", "estrella"];
const ETAPAS = ["brote", "creciendo", "maduro"];

/** Contrato con el juego: el ancla y el ancho en pantalla salen del
 *  MISMO módulo que usa CampoCristales.tsx, compilado al vuelo, así el
 *  pliego de contacto se arma con los números reales y no con una copia. */
const TAMANO = 512;
const ESCENA = await cargarEscena();
const ANCLA = ESCENA.ANCLA_PIEZA;

async function cargarEscena() {
  const out = path.join(PREVIEW, "escena.bundle.mjs");
  fs.mkdirSync(PREVIEW, { recursive: true });
  await build({
    entryPoints: [path.join(RAIZ, "src", "data", "automatizacion", "escena.ts")],
    bundle: true,
    format: "esm",
    outfile: out,
    logLevel: "silent",
  });
  return import(pathToFileURL(out).href);
}

/** Altura del cuerpo de cada etapa como fracción de la del maduro. Los
 *  mismos números del generador procedural: "listo" se lee por tamaño. */
const ALTURA_ETAPA = { brote: 0.33, creciendo: 0.62, maduro: 1.0 };

/** Tope del maduro dentro del lienzo, en píxeles: por encima del apoyo
 *  hay 384 px y se deja aire para el destello y para el vaivén. El ancho
 *  se acota aparte porque el prisma es más ancho que alto. Nunca se
 *  agranda un dibujo: si el pliego lo trae más chico, queda más chico. */
const MAX_ALTO_MADURO = 336;
const MAX_ANCHO_MADURO = 300;

/** Cuánto se sube el apoyo desde el borde inferior del cuerpo, en
 *  fracción de la altura del cuerpo. Una base plana vista desde arriba es
 *  una elipse cuyo centro queda por encima de su borde de abajo; una
 *  punta que termina en vértice apoya en el vértice mismo. */
const ALZA_APOYO = { punta: 0.0, racimo: 0.045, prisma: 0.0, estrella: 0.045 };

/** Verde puro del fondo, el mismo de las islas. */
const FONDO = { r: 2, g: 249, b: 2 };
const DENTRO = 70;
const FUERA = 210;

/* ------------------------------------------------------------------ */
/* 1 · quitar el verde                                                 */
/* ------------------------------------------------------------------ */

async function quitarVerde(archivo) {
  const { data, info } = await sharp(archivo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const d = Math.hypot(r - FONDO.r, g - FONDO.g, b - FONDO.b);
    if (d < DENTRO) {
      data[i + 3] = 0;
      continue;
    }
    let a = d >= FUERA ? 1 : (d - DENTRO) / (FUERA - DENTRO);
    a = Math.pow(a, 0.85); // el borde queda un pelo más lleno: no se adelgaza el dibujo
    /* Des-premultiplicar: C = a·F + (1−a)·G  ⇒  F = (C − (1−a)·G) / a */
    let fr = r, fg = g, fb = b;
    if (a < 1) {
      fr = (r - (1 - a) * FONDO.r) / a;
      fg = (g - (1 - a) * FONDO.g) / a;
      fb = (b - (1 - a) * FONDO.b) / a;
    }
    /* Limitador de verde: ningún cristal tiene el verde por encima del
       rojo Y del azul, así que lo que sobra es derrame, siempre. */
    fg = Math.min(fg, Math.max(fr, fb));
    data[i] = clamp(fr);
    data[i + 1] = clamp(fg);
    data[i + 2] = clamp(fb);
    data[i + 3] = Math.round(a * 255);
  }
  return { data, width, height, channels };
}

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/* ------------------------------------------------------------------ */
/* 2 · cortar en celdas                                                */
/* ------------------------------------------------------------------ */

/** Franjas con tinta a lo largo de un eje. `medir(k)` devuelve cuánta
 *  alfa hay en la fila/columna k. */
function franjas(largo, medir, minimo = 3) {
  const salida = [];
  let inicio = -1;
  for (let k = 0; k <= largo; k++) {
    const tinta = k < largo && medir(k) > minimo;
    if (tinta && inicio < 0) inicio = k;
    if (!tinta && inicio >= 0) {
      salida.push([inicio, k - 1]);
      inicio = -1;
    }
  }
  return salida;
}

function celdas(img) {
  const { data, width, height, channels } = img;
  const alfaEn = (x, y) => data[(y * width + x) * channels + 3];

  const filas = franjas(height, (y) => {
    let s = 0;
    for (let x = 0; x < width; x++) if (alfaEn(x, y) > 40) s++;
    return s;
  });
  const columnas = franjas(width, (x) => {
    let s = 0;
    for (let y = 0; y < height; y++) if (alfaEn(x, y) > 40) s++;
    return s;
  });

  if (filas.length !== VARIANTES.length || columnas.length !== ETAPAS.length) {
    throw new Error(
      `El pliego tiene ${filas.length} filas y ${columnas.length} columnas con tinta; ` +
        `se esperaban ${VARIANTES.length} × ${ETAPAS.length}. Si dos piezas se tocan ` +
        `o un destello cruza la franja vacía, hay que regenerar el pliego con más aire.`,
    );
  }
  return { filas, columnas };
}

/* ------------------------------------------------------------------ */
/* 3 · el cuerpo, sin los destellos                                    */
/* ------------------------------------------------------------------ */

/** Componentes conexas de la máscara de alfa dentro de un rectángulo.
 *  Devuelve las cajas de cada una con su área. */
function componentes(img, x0, y0, x1, y1) {
  const { data, width, channels } = img;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const visto = new Uint8Array(w * h);
  const alfa = (x, y) => data[((y0 + y) * width + (x0 + x)) * channels + 3];
  const salida = [];
  const pila = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (visto[y * w + x] || alfa(x, y) < 40) continue;
      let area = 0, ax = x, bx = x, ay = y, by = y;
      pila.push(x, y);
      visto[y * w + x] = 1;
      while (pila.length) {
        const cy = pila.pop(), cx = pila.pop();
        area++;
        if (cx < ax) ax = cx;
        if (cx > bx) bx = cx;
        if (cy < ay) ay = cy;
        if (cy > by) by = cy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (visto[ny * w + nx] || alfa(nx, ny) < 40) continue;
          visto[ny * w + nx] = 1;
          pila.push(nx, ny);
        }
      }
      salida.push({ area, x0: x0 + ax, y0: y0 + ay, x1: x0 + bx, y1: y0 + by });
    }
  }
  return salida;
}

/** Caja del CUERPO: la componente más grande más las que estén cerca de
 *  su tamaño. Los destellos son órdenes de magnitud más chicos y quedan
 *  afuera; una púa suelta de un racimo, no. */
function cuerpo(img, x0, y0, x1, y1) {
  const cs = componentes(img, x0, y0, x1, y1).sort((a, b) => b.area - a.area);
  if (cs.length === 0) throw new Error("celda vacía");
  const mayor = cs[0].area;
  const grandes = cs.filter((c) => c.area >= mayor * 0.06);
  return {
    x0: Math.min(...grandes.map((c) => c.x0)),
    y0: Math.min(...grandes.map((c) => c.y0)),
    x1: Math.max(...grandes.map((c) => c.x1)),
    y1: Math.max(...grandes.map((c) => c.y1)),
    destellos: cs.length - grandes.length,
  };
}

/* ------------------------------------------------------------------ */
/* 4 · encuadrar y apoyar                                              */
/* ------------------------------------------------------------------ */

async function main() {
  if (!fs.existsSync(HOJA)) {
    throw new Error(`Falta ${path.relative(RAIZ, HOJA)}: el pliego de 4 filas × 3 columnas sobre verde.`);
  }
  fs.mkdirSync(RENDER, { recursive: true });
  fs.mkdirSync(PREVIEW, { recursive: true });

  const img = await quitarVerde(HOJA);
  const { filas, columnas } = celdas(img);
  const hojaPng = await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } })
    .png()
    .toBuffer();

  const piezas = {};
  const filasTabla = [];

  for (let f = 0; f < VARIANTES.length; f++) {
    const variante = VARIANTES[f];
    const [fy0, fy1] = filas[f];
    const cuerpos = ETAPAS.map((_, c) => {
      const [cx0, cx1] = columnas[c];
      const celda = { x0: cx0, y0: fy0, x1: cx1, y1: fy1 };
      return { celda, cuerpo: cuerpo(img, cx0, fy0, cx1, fy1) };
    });

    // El encuadre de la fila lo fija el maduro.
    const m = cuerpos[ETAPAS.indexOf("maduro")].cuerpo;
    const altoM = m.y1 - m.y0 + 1;
    const anchoM = m.x1 - m.x0 + 1;
    const escalaFila = Math.min(1, MAX_ALTO_MADURO / altoM, MAX_ANCHO_MADURO / anchoM);

    for (let c = 0; c < ETAPAS.length; c++) {
      const etapa = ETAPAS[c];
      const { celda, cuerpo: q } = cuerpos[c];
      const alto = q.y1 - q.y0 + 1;
      const ancho = q.x1 - q.x0 + 1;

      // Tamaño objetivo del cuerpo de esta etapa: fracción del maduro.
      const altoObjetivo = altoM * escalaFila * ALTURA_ETAPA[etapa];
      let escala = altoObjetivo / alto;
      if (escala > 1.0001) {
        console.warn(`   ⚠ ${variante}-${etapa}: haría falta agrandar ×${escala.toFixed(2)}; se deja a ×1`);
        escala = 1;
      }

      // Punto de apoyo en la celda, en píxeles del pliego.
      const apoyoX = (q.x0 + q.x1 + 1) / 2;
      const apoyoY = q.y1 + 1 - alto * ALZA_APOYO[variante];

      // Recorte de la celda (con destellos), escalado.
      const cw = celda.x1 - celda.x0 + 1;
      const ch = celda.y1 - celda.y0 + 1;
      const sw = Math.max(1, Math.round(cw * escala));
      const sh = Math.max(1, Math.round(ch * escala));
      const recorte = await sharp(hojaPng)
        .extract({ left: celda.x0, top: celda.y0, width: cw, height: ch })
        .resize(sw, sh, { kernel: "lanczos3", fit: "fill" })
        .png()
        .toBuffer();

      // Dónde cae la esquina del recorte para que el apoyo quede en el ancla.
      const left = Math.round(TAMANO * ANCLA.x - (apoyoX - celda.x0) * escala);
      const top = Math.round(TAMANO * ANCLA.y - (apoyoY - celda.y0) * escala);
      if (left < 0 || top < 0 || left + sw > TAMANO || top + sh > TAMANO) {
        throw new Error(
          `${variante}-${etapa} no entra en el lienzo (${left},${top} ${sw}×${sh}): ` +
            `bajar MAX_ALTO_MADURO o darle más aire al pliego.`,
        );
      }

      const lienzo = await sharp({
        create: { width: TAMANO, height: TAMANO, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite([{ input: recorte, left, top }])
        .png()
        .toBuffer();

      const nombre = `${variante}-${etapa}`;
      fs.writeFileSync(path.join(RENDER, `${nombre}.png`), lienzo);
      piezas[nombre] = lienzo;
      filasTabla.push({
        pieza: nombre,
        "cuerpo px": `${ancho}×${alto}`,
        escala: escala.toFixed(3),
        "alto final": Math.round(alto * escala),
        "ancho final": Math.round(ancho * escala),
        destellos: q.destellos,
      });
    }
  }

  console.table(filasTabla);

  const meta = {
    fuente: path.relative(RAIZ, HOJA).split(path.sep).join("/"),
    tamano: TAMANO,
    anclaX: ANCLA.x,
    anclaY: ANCLA.y,
    variantes: VARIANTES,
    etapas: ETAPAS,
    alturaEtapa: ALTURA_ETAPA,
  };
  fs.writeFileSync(path.join(RENDER, "cristales.json"), JSON.stringify(meta, null, 2) + "\n");

  await pliegoDeContacto(piezas);
  await sobreLaIsla(piezas);
  console.log(`\n ${Object.keys(piezas).length} piezas en ${path.relative(RAIZ, RENDER)}`);
  console.log(` mirá ${path.relative(RAIZ, PREVIEW)}/cristales-pliego.png y cristales-isla-*.png antes de seguir`);
}

/* ------------------------------------------------------------------ */
/* 5 · para mirar                                                      */
/* ------------------------------------------------------------------ */

/** Las doce sobre violeta claro, con una cruz en el punto de apoyo: las
 *  tres de una fila tienen que leerse como el mismo cristal creciendo,
 *  y las cuatro filas como cuatro minerales distintos. */
async function pliegoDeContacto(piezas) {
  const celda = 256;
  const ancho = celda * ETAPAS.length;
  const alto = celda * VARIANTES.length;
  const capas = [];
  const ay = celda * ANCLA.y;
  const cruz = Buffer.from(
    `<svg width="${celda}" height="${celda}">` +
      `<line x1="${celda / 2 - 8}" y1="${ay}" x2="${celda / 2 + 8}" y2="${ay}" stroke="#ff2f7a" stroke-width="1.5"/>` +
      `<line x1="${celda / 2}" y1="${ay - 8}" x2="${celda / 2}" y2="${ay + 8}" stroke="#ff2f7a" stroke-width="1.5"/>` +
      `</svg>`,
  );
  for (let f = 0; f < VARIANTES.length; f++) {
    for (let c = 0; c < ETAPAS.length; c++) {
      const buf = piezas[`${VARIANTES[f]}-${ETAPAS[c]}`];
      const chica = await sharp(buf).resize(celda, celda).png().toBuffer();
      capas.push({ input: chica, left: c * celda, top: f * celda });
      capas.push({ input: cruz, left: c * celda, top: f * celda });
    }
  }
  await sharp({ create: { width: ancho, height: alto, channels: 4, background: "#d9c9f2" } })
    .composite(capas)
    .png()
    .toFile(path.join(PREVIEW, "cristales-pliego.png"));
}

/** Las piezas sobre las islas reales, con la MISMA cuenta que hace
 *  CampoCristales.tsx: ancho del lienzo = ANCHO_CRISTAL pasos de
 *  baldosa, apoyo en el ancla sobre el centro medido de cada baldosa. Es la prueba
 *  que importa: ¿parecen del mismo mundo? */
async function sobreLaIsla(piezas) {
  if (!fs.existsSync(GRILLA)) return;
  const grilla = JSON.parse(fs.readFileSync(GRILLA, "utf8"));
  const ANCHO_CRISTAL = ESCENA.ANCHO_CRISTAL;
  const escenas = {
    2: ["punta-maduro", "racimo-maduro", "prisma-maduro", "estrella-maduro"],
    4: null,
  };
  for (const lado of [2, 4]) {
    const g = grilla[lado];
    const isla = path.join(CAMPO, `campo-${lado}x${lado}.webp`);
    if (!g || !fs.existsSync(isla)) continue;
    const base = sharp(isla);
    const { width, height } = await base.metadata();
    const anchoPx = Math.round((g.pasoX * 2 * ANCHO_CRISTAL * width) / 100);
    const capas = [];
    const orden = [...g.baldosas].sort((a, b) => a.y - b.y);
    for (let i = 0; i < orden.length; i++) {
      const b = orden[i];
      const nombre =
        escenas[lado]?.[i] ??
        `${VARIANTES[(b.fila + b.col) % VARIANTES.length]}-${ETAPAS[(b.fila * 2 + b.col) % ETAPAS.length]}`;
      const pieza = await sharp(piezas[nombre]).resize(anchoPx, anchoPx).png().toBuffer();
      capas.push({
        input: pieza,
        left: Math.round((b.x * width) / 100 - anchoPx * ANCLA.x),
        top: Math.round((b.y * height) / 100 - anchoPx * ANCLA.y),
      });
    }
    await base.composite(capas).png().toFile(path.join(PREVIEW, `cristales-isla-${lado}x${lado}.png`));
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
