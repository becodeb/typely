import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/* Arma el prompt del fondo de una isla, listo para pegar en el generador.
   ---------------------------------------------------------------------
   No tiene el prompt adentro: lo LEE de Images/islands/FONDOS.md, entre las
   marcas <!-- PROMPT:ISLA --> y <!-- /PROMPT:ISLA -->, y saca el tema de la
   tabla marcada con <!-- TABLA:TEMAS -->. Así el documento sigue siendo la
   única fuente y no hay dos versiones del prompt que se separen con el uso.

   Uso:
     node scripts/prompt-fondo.mjs island7        imprime el de una isla
     node scripts/prompt-fondo.mjs island7 | clip lo deja en el portapapeles
     node scripts/prompt-fondo.mjs --todos        escribe los quince en archivos
*/

const DOC = "Images/islands/FONDOS.md";
const SALIDA = ".prompts-fondos";

const doc = readFileSync(DOC, "utf8");

function entre(inicio, fin) {
  const a = doc.indexOf(inicio);
  const b = doc.indexOf(fin);
  if (a === -1 || b === -1) {
    console.error(`No encontré ${inicio} … ${fin} en ${DOC}.`);
    console.error("Si moviste o reescribiste esa parte, dejá las marcas donde estaban.");
    process.exit(1);
  }
  return doc.slice(a + inicio.length, b);
}

/* El bloque viene envuelto en una cerca de markdown; se le sacan las cercas. */
const plantilla = entre("<!-- PROMPT:ISLA -->", "<!-- /PROMPT:ISLA -->")
  .replace(/^\s*```\w*\n/, "")
  .replace(/```\s*$/, "")
  .trim();

/* Filas tipo:  | 7 | Isla de palabras largas | piedra de jardín / … | */
const temas = new Map();
for (const linea of entre("<!-- TABLA:TEMAS -->", "<!-- /TABLA:TEMAS -->").split("\n")) {
  const celdas = linea.split("|").map((c) => c.trim());
  if (celdas.length < 5) continue;
  const n = Number(celdas[1]);
  if (!Number.isInteger(n) || n < 1 || n > 15) continue;   // salta cabecera y separador
  temas.set(`island${n}`, { mundo: celdas[2], tema: celdas[3] });
}

if (temas.size !== 15) {
  console.error(`Leí ${temas.size} temas de la tabla y esperaba 15. Revisá ${DOC}.`);
  process.exit(1);
}

function armar(id) {
  const { mundo, tema } = temas.get(id);
  /* La última línea del bloque es el TEMA de ejemplo; se reemplaza por el de
     esta isla. Puede ocupar dos renglones, así que se corta desde "TEMA:". */
  const cuerpo = plantilla.slice(0, plantilla.indexOf("TEMA:")).trimEnd();
  const adjuntos = [
    ["el molde aprobado", "Images/islands/_default/REFERENCIA-fondo-nivel.png"],
    [`la isla ${id}`, `public/assets/islands/${id}/island.webp`],
    [`el botón de ${id}`, `public/assets/islands/${id}/button.webp`],
  ];
  return { mundo, tema, cuerpo, adjuntos, texto: `${cuerpo}\n\nTEMA: ${tema}\n` };
}

const arg = process.argv[2];

if (arg === "--todos") {
  mkdirSync(SALIDA, { recursive: true });

  const partes = [
    "# Prompts de fondo de nivel — los quince",
    "",
    "Generado con `node scripts/prompt-fondo.mjs --todos`. No se edita a mano:",
    "el prompt y los temas viven en `Images/islands/FONDOS.md`, y si se tocan acá",
    "se pierden en la próxima corrida.",
    "",
    "## Qué adjuntar, siempre lo mismo",
    "",
    "En los quince van **tres imágenes, en este orden**:",
    "",
    "1. **El molde**, que es siempre el mismo archivo:",
    "   `Images/islands/_default/REFERENCIA-fondo-nivel.png`",
    "2. **La isla de ese mundo**: `public/assets/islands/islandN/island.webp`",
    "3. **El botón de ese mundo**: `public/assets/islands/islandN/button.webp`",
    "",
    "Cambian sólo las dos últimas, y sólo en el número de la carpeta. Debajo de",
    "cada título están las rutas ya escritas.",
    "",
    "---",
    "",
  ];

  for (const id of temas.keys()) {
    const { mundo, adjuntos, texto } = armar(id);
    writeFileSync(`${SALIDA}/${id}.txt`, texto, "utf8");
    partes.push(`## ${id} — ${mundo}`, "");
    partes.push("Adjuntar:", "");
    adjuntos.forEach(([que, ruta], i) => partes.push(`${i + 1}. ${que} — \`${ruta}\``));
    partes.push("", "```", texto.trimEnd(), "```", "", "---", "");
  }

  writeFileSync(`${SALIDA}/TODOS.md`, partes.join("\n"), "utf8");
  console.log(`Los quince, uno por archivo:  ${SALIDA}/island1.txt … island15.txt`);
  console.log(`Todos juntos en uno:          ${SALIDA}/TODOS.md`);
  process.exit(0);
}

if (!arg || !temas.has(arg)) {
  console.log("Uso:  node scripts/prompt-fondo.mjs island7");
  console.log("      node scripts/prompt-fondo.mjs --todos");
  console.log("\nIslas: " + [...temas.keys()].join(", "));
  process.exit(arg ? 1 : 0);
}

const { mundo, adjuntos, texto } = armar(arg);

console.log(`\n=== ${arg} — ${mundo} ===\n`);
console.log("ADJUNTAR ESTAS TRES IMÁGENES, EN ESTE ORDEN:\n");
adjuntos.forEach(([que, ruta], i) => {
  const marca = existsSync(ruta) ? "" : "   <-- NO EXISTE TODAVÍA";
  console.log(`  ${i + 1}. ${que}`);
  console.log(`     ${resolve(ruta)}${marca}`);
});
console.log("\n--- prompt, de acá para abajo ---\n");
console.log(texto);
