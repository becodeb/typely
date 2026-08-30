import sharp from "sharp";
import { botonDe } from "./island-paths.mjs";

/* Color del número de cada nivel, una fila por isla.
   ---------------------------------------------------------------------
   SIN COMPLETAR el número va BLANCO en las quince. Es lo que más contrasta
   contra cualquier disco y no hay que pensarlo por isla.

   COMPLETADO toma el color del PROPIO BOTÓN, más oscuro. Se mide el color que
   el número tiene detrás — no el disco entero: justo la franja donde se
   dibuja — se conserva su TONO y se le baja la luminosidad hasta que se lee.
   La idea es que el número completado se distinga del botón sin gritar como
   el blanco: mismo color, apagado y hundido, como si estuviera grabado.

   Dos detalles que no son adorno:

     - La saturación se sostiene en un mínimo. Al oscurecer en HSL un disco
       poco saturado sale GRIS, y el gris ya significa otra cosa en esta
       pantalla: es el color del número de un nivel BLOQUEADO. Un número
       completado gris se leería como bloqueado, que es lo contrario.

     - Si el disco YA es oscuro, bajar la luminosidad no gana contraste — no
       hay lugar hacia abajo. En ese caso se sube, y sale un tinte claro del
       mismo tono. Sigue siendo el color del botón y sigue siendo más suave
       que el blanco del nivel sin completar, que es lo que se pedía.

   Correr:  node scripts/level-number-colors.mjs
   Pegar la última tabla en LEVEL_NUMBER_DONE (src/utils/assets.ts).
*/

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}
function hue2rgb(p, q, t) {
  if (t < 0) t += 1; if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function hsl2rgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)].map((v) => Math.round(v * 255));
}
const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

/* Franja donde el juego dibuja el número, en el lienzo 600x445. */
const CAJA = { x0: 255, x1: 345, y0: 165, y1: 265 };

async function fondoDelNumero(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W } = info, C = 4;
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = CAJA.y0; y <= CAJA.y1; y++) {
    for (let x = CAJA.x0; x <= CAJA.x1; x++) {
      const i = (y * W + x) * C;
      if (data[i + 3] < 200) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
  }
  return [r / n, g / n, b / n].map(Math.round);
}

/* Objetivo de contraste del número completado contra su disco.

   3.2 y no 4.5, y la diferencia importa. El piso exigible para texto grande es
   3:1, y este número es enorme y en negrita, muy por encima del tamaño que
   pide ese piso. Con 4.5 pasaban dos cosas, las dos malas: los discos medios
   había que llevarlos casi a NEGRO — y negro no es "el color del botón más
   oscuro", es negro —, y los nueve discos que ya son oscuros no llegaban
   nunca, así que se daban vuelta a tintes claros. Con 3.2 el número se
   oscurece lo justo para leerse y sigue siendo del color del disco.

   La búsqueda para APENAS pasa el objetivo, no sigue de largo: cuanto menos se
   aleje del color del disco, más se lee como el mismo color apagado, que es lo
   que se pidió. */
const OBJETIVO = 3.2;
/* Por debajo de esto no se acepta un color: sería ilegible. */
const PISO = 3;

/* Mínimo de saturación al oscurecer. Sin esto, un disco grisáceo da un número
   gris oscuro y el gris ya es el color de "bloqueado" en esta pantalla. */
const SAT_MIN_OSCURO = 0.45;
const SAT_MIN_CLARO = 0.35;

/** Recorre la luminosidad en una dirección buscando el objetivo, sin tocar el
 *  tono. Devuelve el mejor que encontró aunque no haya llegado. */
function buscar(fondo, dir, satMin) {
  const [h, s, l] = rgb2hsl(...fondo);
  const sat = Math.min(0.9, Math.max(satMin, s));
  let mejor = null;
  for (let nl = l; dir < 0 ? nl >= 0 : nl <= 1; nl += dir * 0.005) {
    const rgb = hsl2rgb(h, sat, nl);
    const k = contraste(rgb, fondo);
    if (!mejor || k > mejor.k) mejor = { rgb, k };
    if (k >= OBJETIVO) return { rgb, k, llego: true };
  }
  return { ...mejor, llego: false };
}

function colorCompletado(fondo) {
  /* Primero hacia abajo, que es lo pedido: el color del botón pero más
     oscuro. */
  const oscuro = buscar(fondo, -1, SAT_MIN_OSCURO);
  if (oscuro.llego) return { ...oscuro, sentido: "oscuro" };
  /* El disco ya era oscuro y abajo no queda lugar. Se sube: tinte claro del
     mismo tono, que sigue siendo el color del botón y sigue siendo más suave
     que el blanco. */
  const claro = buscar(fondo, +1, SAT_MIN_CLARO);
  if (claro.llego) return { ...claro, sentido: "claro" };
  /* Ninguno llegó al objetivo: gana el que más contraste haya conseguido. */
  return oscuro.k >= claro.k
    ? { ...oscuro, sentido: "oscuro" }
    : { ...claro, sentido: "claro" };
}

const filas = [];
for (let n = 1; n <= 15; n++) {
  const id = `island${n}`;
  const fondo = await fondoDelNumero(botonDe(id));
  const [, , l] = rgb2hsl(...fondo);
  const elegido = colorCompletado(fondo);
  filas.push({
    id, fondo, luz: l,
    color: hex(elegido.rgb), k: elegido.k, sentido: elegido.sentido,
    blanco: contraste([255, 255, 255], fondo),
  });
}

console.log("isla       fondo del numero   luz   BLANCO (sin completar)   COMPLETADO");
for (const f of filas) {
  const alertaBlanco = f.blanco < PISO ? "  <-- NO LLEGA A 3:1" : "";
  const alertaColor = f.k < PISO ? "  <-- NO LLEGA A 3:1" : f.k < OBJETIVO ? "  (por debajo de 4.5)" : "";
  console.log(
    `${f.id.padEnd(10)} rgb(${f.fondo.join(",").padEnd(11)}) ${f.luz.toFixed(2)}  ` +
    `${f.blanco.toFixed(2)}:1${alertaBlanco.padEnd(22)}  ` +
    `${f.color} ${f.sentido.padEnd(6)} ${f.k.toFixed(2)}:1${alertaColor}`
  );
}

console.log("\n// para pegar en LEVEL_NUMBER_DONE (src/utils/assets.ts)");
for (const f of filas) {
  console.log(`  ${(f.id + ":").padEnd(10)} "${f.color}",   // ${f.sentido === "oscuro" ? "tono propio oscurecido" : "tono propio aclarado (disco oscuro)"} — ${f.k.toFixed(2)}:1`);
}
