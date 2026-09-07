/** PNG sources remain untouched. All poses retain their square canvas so
 * their pivots do not shift when the animation switches images.
 * Usage: node scripts/import-orbita-naves.mjs [orbita-01]
 * The user authorized local removal of the generated opaque checkerboard.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { keyBackground } from './key-background.mjs';

const root = path.resolve(import.meta.dirname, '..');
const shipId = process.argv[2] ?? 'orbita-01';
if (!/^[a-z0-9-]+$/.test(shipId)) throw new Error('Identificador de nave inválido.');
const source = path.join(root, 'Images/orbita/naves', shipId);
const output = path.join(root, 'public/assets/orbita/naves', shipId);
const preview = path.join(root, '../work/orbita', shipId);
let saturacionMaxima = 5;
let huecoMinimoPx = false;
try {
  const ajustes = JSON.parse(await fs.readFile(path.join(source, 'recorte.json'), 'utf8'));
  if (!Number.isFinite(ajustes.saturacionMaxima) || ajustes.saturacionMaxima < 1 || ajustes.saturacionMaxima > 5) throw new Error('Saturación de recorte inválida.');
  saturacionMaxima = ajustes.saturacionMaxima;
  if (ajustes.huecoMinimoPx !== undefined) {
    if (!Number.isInteger(ajustes.huecoMinimoPx) || ajustes.huecoMinimoPx < 900) throw new Error('Área de hueco inválida.');
    huecoMinimoPx = ajustes.huecoMinimoPx;
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await fs.mkdir(output, { recursive: true });
await fs.mkdir(preview, { recursive: true });
const files = (await fs.readdir(source)).filter(f => /-source\.png$/.test(f));
if (!files.length) throw new Error('No hay PNG fuente para esta nave.');
for (const file of files) {
  const pose = file.replace('-source.png', '');
  const input = path.join(source, file);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (width !== height) throw new Error(`${file}: todas las poses necesitan un lienzo cuadrado.`);
  let transparent = 0;
  for (let i = 3; i < data.length; i += channels) if (data[i] === 0) transparent++;
  if (transparent < width * height * 0.05) {
    // The reference has warm ivory panels; only nearly neutral white/gray
    // pixels connected to the image border are background, never the cabin.
    const bg = keyBackground(data, width, height, channels, [250, 250, 250], huecoMinimoPx,
      { duroDist: 47, duroSat: saturacionMaxima, blandoDist: 0 });
    if (saturacionMaxima === 1) {
      // El recorte estricto preserva el casco neutro, pero deja puntos grises
      // en el borde. Conservamos su interior y usamos el recorte normal para
      // el contorno coloreado. Los RGB originales nunca se alteran.
      const contorno = keyBackground(data, width, height, channels, [250, 250, 250], false,
        { duroDist: 47, duroSat: 5, blandoDist: 0 });
      const mascara = Buffer.from(bg.map(valor => valor ? 0 : 255));
      // En el operador morfológico de sharp el negro es el primer plano:
      // dilate expande el fondo negro y elimina el fleco exterior blanco.
      const interior = await sharp(mascara, { raw: { width, height, channels: 1 } })
        .median(9).dilate(6).toColourspace('b-w').raw().toBuffer();
      for (let i = 0; i < bg.length; i++) bg[i] = contorno[i] && !interior[i] ? 1 : 0;
    }
    for (let i = 0; i < bg.length; i++) if (bg[i]) data[i * channels + 3] = 0;
    // Some generations leave isolated colored specks on the backdrop.
    // Keep the connected ship, including its crystal and both thrusters.
    const visited = new Uint8Array(width * height);
    let largest = [];
    for (let seed = 0; seed < visited.length; seed++) {
      if (visited[seed] || !data[seed * channels + 3]) continue;
      const connected = [seed];
      visited[seed] = 1;
      for (let q = 0; q < connected.length; q++) {
        const p = connected[q], x = p % width, y = Math.floor(p / width);
        for (const n of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1]) {
          if (n < 0 || visited[n] || !data[n * channels + 3]) continue;
          visited[n] = 1;
          connected.push(n);
        }
      }
      if (connected.length > largest.length) largest = connected;
    }
    const ship = new Uint8Array(width * height);
    for (const p of largest) ship[p] = 1;
    for (let p = 0; p < ship.length; p++) if (!ship[p]) data[p * channels + 3] = 0;
  }
  transparent = 0;
  for (let i = 3; i < data.length; i += channels) if (data[i] === 0) transparent++;
  const ratio = transparent / (width * height);
  if (ratio < 0.25 || ratio > 0.85) throw new Error(`${file}: recorte sospechoso (${Math.round(ratio * 100)}% transparente).`);
  const clean = sharp(data, { raw: { width, height, channels } });
  // A full-resolution clean derivative supports visual QA and imagegen
  // references. It is NOT a replacement for the original in Images/.
  await clean.clone().png().toFile(path.join(preview, `${pose}.png`));
  const result = await clean.resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(path.join(output, `${pose}.webp`));
  console.log(`${shipId}/${pose}: ${width}×${height} → ${result.width}×${result.height}, ${Math.round(result.size / 1024)} KiB, ${Math.round(ratio * 100)}% transparente`);
}
