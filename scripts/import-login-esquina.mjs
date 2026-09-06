/* Genera la copia web del adorno de esquina del login.
 *
 *   node scripts/import-login-esquina.mjs
 *
 * Fuente: Images/brand/login/esquina-source.png — el adorno generado para la
 * esquina SUPERIOR IZQUIERDA de la tarjeta (PNG con alpha real). El original
 * no se toca. Sale recortado al alpha (así el ancho que ves en CSS es el del
 * dibujo, no el del aire que dejó el render) y en WebP. Las otras tres
 * esquinas son la misma imagen girada por CSS (`.login-esquina--*`).
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = `${ROOT}Images/brand/login/esquina-source.png`;
const OUT = `${ROOT}public/assets/edutic-art/login-esquina.webp`;

const meta = await sharp(SRC).metadata();
if (!meta.hasAlpha) {
  throw new Error("esquina-source.png no tiene canal alpha: el adorno taparía la tarjeta con un cuadrado.");
}

await sharp(SRC)
  .trim()
  .resize({ width: 640, withoutEnlargement: true })
  .webp({ quality: 88, alphaQuality: 92 })
  .toFile(OUT);

const out = await sharp(OUT).metadata();
console.log(`login-esquina.webp  ${out.width}x${out.height}`);
