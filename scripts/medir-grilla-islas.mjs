/* =====================================================================
   MEDIR LA GRILLA DE BALDOSAS SOBRE LAS ISLAS ILUSTRADAS
   ---------------------------------------------------------------------
   Las islas ya no salen de Blender —las dibuja una IA— así que nadie
   exporta las coordenadas: hay que medirlas sobre la imagen. A ojo son
   30 mediciones que envejecen mal: cambia el arte y hay que rehacerlas
   todas.

   El ancla son LAS JUNTAS DE LUZ TURQUESA entre baldosas. Son lo único
   de la imagen con ese color, forman la grilla exacta por construcción,
   y no dependen de que el modelo dibuje bien un detalle chico.

   (El primer intento buscó el destello grabado en cada zócalo. Falló:
   ese grabado es de bajo contraste, y el filtro de brillo se enganchaba
   con las juntas y con los cristales colgando de la roca, que son más
   claros y más grandes. Las juntas, en cambio, son inconfundibles.)

   El ajuste asume proyección isométrica simétrica —la cámara mira a 45°
   de azimut, que es como están dibujadas las cuatro islas— así que la
   grilla queda descrita por cuatro números: el centro (cx, cy) y los
   dos semipasos (p, q). De ahí sale cualquier baldosa.

     node scripts/medir-grilla-islas.mjs
     node scripts/medir-grilla-islas.mjs --ver    deja PNG con los centros
===================================================================== */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const RAIZ = path.resolve(import.meta.dirname, "..");
const CAMPO = path.join(RAIZ, "public", "assets", "automatizacion", "campo");
const SALIDA = path.join(RAIZ, "Images", "automatizacion", "islas", "grilla.json");
const VER = process.argv.includes("--ver");

/** Turquesa encendido de las juntas. Nada más en la paleta se le acerca:
 *  la piedra es rosada, el musgo amarillento, las flores blancas. */
function esJunta(r, g, b) {
  return b > 170 && g > 165 && b > r + 22 && g > r + 8;
}

/** Centro de la baldosa (fila, col) para una grilla dada.
 *  +col baja hacia la derecha; +fila baja hacia la izquierda. */
function centro(g, lado, fila, col) {
  const c = col - (lado - 1) / 2;
  const f = fila - (lado - 1) / 2;
  return { x: g.cx + (c - f) * g.p, y: g.cy + (c + f) * g.q };
}

/** Qué tan bien explica esta grilla las juntas dibujadas.
 *
 *  Cuenta los píxeles que caen sobre CADA junta por separado y devuelve
 *  el MÍNIMO, no la suma. Esa distinción es la que hace que el ajuste
 *  funcione: sumando, una grilla del doble de paso puntúa alto porque
 *  acierta una junta sí y una no, y el optimizador se queda contento con
 *  la mitad de las líneas. Exigiendo que la peor junta también tenga
 *  apoyo, esa solución tramposa vale cero. */
function puntaje(nube, g, lado, cota) {
  if (g.p < 4 || g.q < 2 || lado < 2) return -1;
  /* Cota dura al paso. Sin ella, con una sola junta por dirección (el
     caso del 2x2) el refinamiento agranda la grilla indefinidamente:
     una grilla enorme mete toda la nube dentro de una única línea y el
     puntaje sigue subiendo mientras la geometría se vuelve absurda. */
  if (cota && (g.p < cota.min || g.p > cota.max)) return -1;
  /* Y cota a la proporción: las cuatro islas están dibujadas con la
     misma cámara isométrica, así que el aplastamiento vertical cae
     siempre en esta franja. Fuera de ella el ajuste está inventando. */
  if (g.q / g.p < 0.42 || g.q / g.p > 0.75) return -1;
  const juntas = lado - 1;
  const porCol = new Int32Array(juntas);
  const porFila = new Int32Array(juntas);

  for (const [x, y] of nube) {
    const dx = (x - g.cx) / g.p;
    const dy = (y - g.cy) / g.q;
    const col = (dx + dy) / 2 + (lado - 1) / 2;
    const fila = (dy - dx) / 2 + (lado - 1) / 2;
    if (col < -0.6 || fila < -0.6 || col > lado - 0.4 || fila > lado - 0.4) continue;

    // Las juntas están en col = 0.5, 1.5, … y lo mismo en fila.
    const kc = Math.round(col - 0.5);
    if (kc >= 0 && kc < juntas && Math.abs(col - 0.5 - kc) < 0.055) porCol[kc]++;
    const kf = Math.round(fila - 0.5);
    if (kf >= 0 && kf < juntas && Math.abs(fila - 0.5 - kf) < 0.055) porFila[kf]++;
  }

  let peor = Infinity;
  for (let i = 0; i < juntas; i++) {
    peor = Math.min(peor, porCol[i], porFila[i]);
  }
  return peor;
}

/* Grillas puestas a mano, en fracción del lienzo.
 *
 * Sólo hacen falta para las islas donde el ajuste automático NO PUEDE
 * funcionar, y conviene entender por qué antes de tocarlas:
 *
 *  - 1x1 no tiene juntas: no hay nada que medir.
 *  - 2x2 tiene UNA sola junta por dirección. Eso fija la orientación de
 *    la grilla pero no su tamaño: cualquier escala pasa por el mismo
 *    cruce y puntúa idéntico. Y el truco de usar los extremos de la nube
 *    como esquinas tampoco sirve, porque el resplandor de la junta se
 *    derrama hacia abajo por las caras laterales y estira el extremo
 *    inferior.
 *
 * De 3x3 en adelante hay juntas de sobra y el ajuste solo es confiable:
 * no agregar entradas acá para esos casos. */
const A_MANO = {
  1: { cx: 0.508, cy: 0.307, p: 0.366, q: 0.23 },
  2: { cx: 0.4984, cy: 0.3269, p: 0.2145, q: 0.1453 },
};

function ajustar(nube, lado, ancho, alto) {
  const cota = { min: ancho / (3.4 * lado), max: ancho / (1.5 * lado) };
  const cx0 = nube.reduce((s, p) => s + p[0], 0) / nube.length;
  const cy0 = nube.reduce((s, p) => s + p[1], 0) / nube.length;

  let mejor = { cx: cx0, cy: cy0, p: ancho / (2 * lado), q: ancho / (4 * lado) };
  let mejorPunt = -1;

  // Barrido grueso y después refinamiento: el espacio es chico y suave.
  for (let p = ancho / (3.2 * lado); p <= ancho / (1.6 * lado); p += ancho / (60 * lado)) {
    for (let q = p * 0.34; q <= p * 0.72; q += p * 0.02) {
      const cand = { cx: cx0, cy: cy0, p, q };
      const s = puntaje(nube, cand, lado, cota);
      if (s > mejorPunt) { mejorPunt = s; mejor = cand; }
    }
  }

  for (const escala of [8, 3, 1, 0.4]) {
    let mejoro = true;
    while (mejoro) {
      mejoro = false;
      for (const [k, paso] of [["cx", escala], ["cy", escala], ["p", escala * 0.5], ["q", escala * 0.3]]) {
        for (const signo of [1, -1]) {
          const cand = { ...mejor, [k]: mejor[k] + signo * paso };
          const s = puntaje(nube, cand, lado, cota);
          if (s > mejorPunt) { mejorPunt = s; mejor = cand; mejoro = true; }
        }
      }
    }
  }

  return { grilla: mejor, aciertos: mejorPunt, total: nube.length, alto };
}

export async function medir(archivo, lado) {
  const img = sharp(archivo);
  const meta = await img.metadata();
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;

  const nube = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * c;
      if (data[i + 3] < 200) continue;
      if (esJunta(data[i], data[i + 1], data[i + 2])) nube.push([x, y]);
    }
  }
  return { ancho: meta.width, alto: meta.height, nube };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const previo = fs.existsSync(SALIDA) ? JSON.parse(fs.readFileSync(SALIDA, "utf8")) : {};
  const salida = {};

  for (const lado of [1, 2, 3, 4]) {
    const archivo = path.join(CAMPO, `campo-${lado}x${lado}.webp`);
    if (!fs.existsSync(archivo)) continue;
    const { ancho, alto, nube } = await medir(archivo, lado);

    let grilla;
    if (A_MANO[lado]) {
      const m = A_MANO[lado];
      grilla = { cx: ancho * m.cx, cy: alto * m.cy, p: ancho * m.p, q: alto * m.q };
      console.log(` ${lado}x${lado}: grilla puesta a mano (ver A_MANO y su comentario)`);
    } else {
      const r = ajustar(nube, lado, ancho, alto);
      grilla = r.grilla;
      console.log(
        ` ${lado}x${lado}: ${r.total} px de junta, apoyo mínimo ${r.aciertos} px por junta` +
          `  (paso ${(2 * grilla.p).toFixed(1)}×${(2 * grilla.q).toFixed(1)} px)`,
      );
    }

    const baldosas = [];
    for (let fila = 0; fila < lado; fila++) {
      for (let col = 0; col < lado; col++) {
        const c = centro(grilla, lado, fila, col);
        baldosas.push({
          fila,
          col,
          x: +((c.x / ancho) * 100).toFixed(3),
          y: +((c.y / alto) * 100).toFixed(3),
        });
      }
    }

    salida[lado] = {
      ancho,
      alto,
      /* Semipaso en % del ancho: con esto el juego escala cristales y
         nave sin que nadie elija un tamaño a ojo. */
      pasoX: +((grilla.p / ancho) * 100).toFixed(4),
      pasoY: +((grilla.q / alto) * 100).toFixed(4),
      baldosas,
    };

    if (VER) {
      const r = Math.max(5, Math.round(ancho / 110));
      const puntos = baldosas
        .map((b) => {
          const x = (b.x / 100) * ancho, y = (b.y / 100) * alto;
          return (
            `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#ff2d6f" stroke-width="3"/>` +
            `<circle cx="${x}" cy="${y}" r="2.5" fill="#ff2d6f"/>` +
            `<text x="${x}" y="${y - r - 5}" font-size="${r * 2.2}" fill="#ff2d6f" text-anchor="middle" ` +
            `font-family="sans-serif" font-weight="bold">${b.fila}${b.col}</text>`
          );
        })
        .join("");
      fs.mkdirSync(path.join(RAIZ, ".preview-automatizacion"), { recursive: true });
      await sharp(archivo)
        .composite([{ input: Buffer.from(`<svg width="${ancho}" height="${alto}">${puntos}</svg>`) }])
        .png()
        .toFile(path.join(RAIZ, ".preview-automatizacion", `grilla-${lado}x${lado}.png`));
    }
  }

  // Proporción media del centro, para las islas sin juntas.
  const conJuntas = Object.entries(salida).filter(([l]) => +l > 1);
  if (conJuntas.length) {
    const fx = conJuntas.reduce((s, [, v]) => s + v.baldosas.reduce((a, b) => a + b.x, 0) / v.baldosas.length, 0) / conJuntas.length / 100;
    const fy = conJuntas.reduce((s, [, v]) => s + v.baldosas.reduce((a, b) => a + b.y, 0) / v.baldosas.length, 0) / conJuntas.length / 100;
    salida.__ejes = { fx: +fx.toFixed(4), fy: +fy.toFixed(4) };
  }

  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, JSON.stringify(salida, null, 2));
  console.log(" ->", path.relative(RAIZ, SALIDA));

  /* ---- y el archivo que consume el juego ---- */
  const lados = Object.keys(salida).filter((k) => !k.startsWith("__")).map(Number).sort();
  const ts = `/* GENERADO por scripts/medir-grilla-islas.mjs — no editar a mano.
 *
 * Un campo es una ilustración más la posición de sus baldosas, medida
 * sobre esa misma ilustración. Para cambiar el arte: reemplazar el PNG
 * en Images/automatizacion/islas/, correr el importador del verde y
 * después este script. Las posiciones se actualizan con la imagen.
 */

export interface Baldosa {
  fila: number;
  col: number;
  /** Centro de la baldosa, en % del ancho de la imagen. */
  x: number;
  /** Centro de la baldosa, en % del alto, desde arriba. */
  y: number;
}

export interface Campo {
  lado: number;
  imagen: string;
  ancho: number;
  alto: number;
  /** Medio paso de la grilla, en % del lienzo. Con esto se escalan los
   *  cristales y la nave sin que nadie elija un tamaño a ojo. */
  pasoX: number;
  pasoY: number;
  baldosas: Baldosa[];
}

export const CAMPOS: Record<number, Campo> = {
${lados
  .map(
    (l) => `  ${l}: {
    lado: ${l},
    imagen: "/assets/automatizacion/campo/campo-${l}x${l}.webp",
    ancho: ${salida[l].ancho},
    alto: ${salida[l].alto},
    pasoX: ${salida[l].pasoX},
    pasoY: ${salida[l].pasoY},
    baldosas: [
${salida[l].baldosas.map((b) => `      { fila: ${b.fila}, col: ${b.col}, x: ${b.x}, y: ${b.y} },`).join("\n")}
    ],
  },`,
  )
  .join("\n")}
};

export const LADO_MAXIMO = ${Math.max(...lados)};

export function campoDe(lado: number): Campo {
  return CAMPOS[Math.min(Math.max(lado, 1), LADO_MAXIMO)] ?? CAMPOS[1];
}
`;
  const destinoTs = path.join(RAIZ, "src", "data", "automatizacion", "campos.ts");
  fs.writeFileSync(destinoTs, ts);
  console.log(" ->", path.relative(RAIZ, destinoTs));
}
