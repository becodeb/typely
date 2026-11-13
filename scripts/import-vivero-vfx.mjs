import path from "node:path";
import sharp from "sharp";

const source = path.resolve("Images/automatizacion/vfx-sheet-2026-09.png");
const output = path.resolve("public/assets/automatizacion/ui");
const meta = await sharp(source).metadata();
if (!meta.width || !meta.height) throw new Error("No se pudo leer la lámina de efectos.");
const half = Math.floor(meta.width / 2);
for (const [name, left] of [["anillo", 0], ["rayo-cosecha", half]]) {
  const crop = await sharp(source)
    .extract({ left, top: 0, width: left ? meta.width - half : half, height: meta.height })
    .png()
    .toBuffer();
  await sharp(crop)
    .trim({ threshold: 10 })
    .resize(512, 512, { fit: "contain", background: "#00000000" })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(path.join(output, `${name}.webp`));
}
console.log("Importados: anillo.webp y rayo-cosecha.webp");
