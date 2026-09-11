import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// Import the generated sheet; keep the source untouched.
const source = process.argv[2] ?? 'Images/automatizacion/ui-sheet-2026-09.png';
const out = path.resolve('public/assets/automatizacion/ui');
mkdirSync(out, { recursive: true });
const names = ['punta','racimo','prisma','estrella','campo','memoria',
  'velocidad','crecimiento','evolucion','listo','vacia','borde',
  'contador','tamano','no','sino','contador-cero','inicio',
  'papelera','centrar','lejos','destello','rotura','siembra'];
const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const spill = g - Math.max(r, b);
  if (g > 120 && spill > 65) data[i + 3] = 0;
  else if (g > 120 && spill > 35) { data[i + 3] = Math.round(255 * (65 - spill) / 30); data[i + 1] = Math.max(r, b); }
}
const rows = [0, 288, 524, 740, 1024];
for (let i = 0; i < names.length; i++) {
  const row = Math.floor(i / 6), col = i % 6;
  const cell = await sharp(data, { raw: info }).extract({ left: col * 256, top: rows[row], width: 256, height: rows[row + 1] - rows[row] }).png().toBuffer();
  await sharp(cell).trim({ threshold: 12 }).resize(192, 192, { fit: 'contain', background: '#00000000' })
    .webp({ quality: 90 }).toFile(path.join(out, `${names[i]}.webp`));
}
console.log(`Imported ${names.length} Vivero icons.`);
