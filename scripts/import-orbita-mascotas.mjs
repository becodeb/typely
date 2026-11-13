/** Conserva cada PNG original y optimiza el sprite transparente de la mascota.
 * Uso: node scripts/import-orbita-mascotas.mjs botito [lunita ...] */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const ids = process.argv.slice(2);
if (!ids.length) throw new Error('Indicá al menos una mascota.');
for (const id of ids) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Identificador inválido.');
  const input = path.join(root, 'Images/orbita/mascotas', id, 'neutra-source.png');
  const output = path.join(root, 'public/assets/orbita/mascotas', id);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  for (let i = 3; i < data.length; i += info.channels) if (data[i] === 0) transparent++;
  const ratio = transparent / (info.width * info.height);
  if (ratio < .1 || ratio > .95) throw new Error(`${id}: el PNG no tiene un recorte transparente válido (${Math.round(ratio * 100)}%).`);
  await fs.mkdir(output, { recursive: true });
  const result = await sharp(input).trim({ threshold: 8 })
    .resize({ width: 512, height: 512, fit: 'contain', background: '#00000000' })
    .webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(path.join(output, 'neutra.webp'));
  console.log(`${id}: ${info.width}×${info.height} → 512×512, ${Math.round(result.size / 1024)} KiB, PNG original intacto.`);
}
