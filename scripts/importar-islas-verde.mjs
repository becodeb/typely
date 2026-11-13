/* =====================================================================
   SACAR EL VERDE DE LAS ISLAS ILUSTRADAS
   ---------------------------------------------------------------------
   Las islas se generan sobre un verde lima plano porque las IA de
   imágenes casi nunca entregan transparencia real, y un fondo blanco
   "casi transparente" deja un halo sucio alrededor de cada hoja.

   Este script hace tres cosas que a mano salen mal:
     1. recorta el verde con un margen suave, para que el borde no quede
        dentado;
     2. QUITA EL DERRAME — el verde rebota sobre los bordes claros y deja
        un filo verdoso que sólo se ve una vez montado sobre el cielo;
     3. recorta el sobrante transparente y anota el encuadre resultante,
        que es lo que después ubica la grilla de baldosas.

     node scripts/importar-islas-verde.mjs
===================================================================== */
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import sharp from "sharp";

const RAIZ = path.resolve(import.meta.dirname, "..");
const FUENTE = path.join(RAIZ, "Images", "automatizacion", "islas");
const DESTINO = path.join(RAIZ, "public", "assets", "automatizacion", "campo");

/** Verde puro del fondo. Nada de la paleta del juego se le acerca. */
const FONDO = { r: 2, g: 248, b: 3 };

/** Distancia al verde por debajo de la cual el píxel es fondo, y por
 *  encima de la cual es arte. En el medio, transparencia parcial: es lo
 *  que da un borde suave en vez de un recorte con escalera. */
const DENTRO = 90;
const FUERA = 190;

function distancia(r, g, b) {
  return Math.hypot(r - FONDO.r, g - FONDO.g, b - FONDO.b);
}

export async function quitarVerde(origen, destino) {
  const { data, info } = await sharp(origen).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const d = distancia(r, g, b);

    if (d < DENTRO) {
      data[i + 3] = 0;
      continue;
    }
    if (d < FUERA) {
      data[i + 3] = Math.round(((d - DENTRO) / (FUERA - DENTRO)) * 255);
    }

    /* Derrame: donde el verde domina sin que el píxel sea follaje, se
       baja el canal verde al promedio de los otros dos. El musgo tiene
       rojo alto, así que no lo toca. */
    if (g > r + 26 && g > b + 26 && r < 200) {
      const medio = Math.round((r + b) / 2);
      data[i + 1] = Math.round(g * 0.35 + medio * 0.65);
    }
  }

  const recortado = await sharp(data, { raw: { width, height, channels } })
    .png()
    .toBuffer();

  // `trim` sobre alfa: deja el arte pegado a los bordes del lienzo, que
  // es lo que hace comparables los encuadres entre islas.
  const salida = await sharp(recortado).trim({ threshold: 1 }).toBuffer();
  const meta = await sharp(salida).metadata();
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  await sharp(salida).webp({ quality: 92, effort: 5 }).toFile(destino);
  return { ancho: meta.width, alto: meta.height };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mapa = JSON.parse(fs.readFileSync(path.join(FUENTE, "mapa.json"), "utf8"));
  for (const [lado, archivo] of Object.entries(mapa)) {
    const origen = path.join(FUENTE, archivo);
    if (!fs.existsSync(origen)) {
      console.log(` falta: ${archivo}`);
      continue;
    }
    const destino = path.join(DESTINO, `campo-${lado}x${lado}.webp`);
    const r = await quitarVerde(origen, destino);
    const kb = (fs.statSync(destino).size / 1024).toFixed(0);
    console.log(` ${lado}x${lado}: ${r.ancho}x${r.alto}  ${kb} KB`);
  }
}
