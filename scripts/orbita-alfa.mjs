/* Recuperación del alpha autorizada por Ezequiel el 07/09/2026.
 * El generador integrado entregó RGB aun pidiendo transparencia. Se procesa
 * una COPIA en memoria: nunca se modifica el PNG original. La inundación
 * parte del borde para conservar blancos y sombras encerrados en el objeto. */
import sharp from "sharp";

export async function quitarMate(origen, mate) {
  const { data, info } = await sharp(origen).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const n = w * h;
  const fondo = new Uint8Array(n);
  const cola = new Int32Array(n);
  let inicio = 0, fin = 0;
  function agregar(p) {
    if (fondo[p]) return;
    const i = p * 4;
    const menor = Math.min(data[i], data[i + 1], data[i + 2]);
    const mayor = Math.max(data[i], data[i + 1], data[i + 2]);
    const elegible = mate === "negro" ? mayor < 65 : menor > 150 && mayor - menor < 100;
    if (!elegible) return;
    fondo[p] = 1; cola[fin++] = p;
  }
  for (let x = 0; x < w; x++) { agregar(x); agregar((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { agregar(y * w); agregar(y * w + w - 1); }
  while (inicio < fin) {
    const p = cola[inicio++], x = p % w;
    if (x > 0) agregar(p - 1);
    if (x < w - 1) agregar(p + 1);
    if (p >= w) agregar(p - w);
    if (p < n - w) agregar(p + w);
  }
  let vacios = 0, suaves = 0;
  for (let p = 0; p < n; p++) {
    if (!fondo[p]) continue;
    const i = p * 4;
    const mayor = Math.max(data[i], data[i + 1], data[i + 2]);
    const menor = Math.min(data[i], data[i + 1], data[i + 2]);
    const alpha = mate === "negro" ? Math.max(0, Math.min(1, (mayor - 5) / 60))
      : Math.max(0, Math.min(1, (mayor - menor - 6) / 75));
    data[i + 3] = Math.round(alpha * 255);
    if (!data[i + 3]) vacios++;
    else if (alpha < 1) suaves++;
    // Quitar el color del mate evita un contorno blanco/negro al componer.
    for (let c = 0; c < 3; c++) data[i + c] = alpha === 0 ? 0
      : Math.max(0, Math.min(255, Math.round((data[i + c] - (1 - alpha) * (mate === "negro" ? 0 : 247)) / alpha)));
  }
  if (vacios < n * .02) throw new Error(`No se pudo identificar el fondo ${mate}: solo ${(vacios / n * 100).toFixed(1)} % transparente.`);
  console.log(`  alpha recuperado desde mate ${mate}: ${(vacios / n * 100).toFixed(1)} % vacío, ${(suaves / n * 100).toFixed(1)} % de borde suave; original intacto`);
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}
