/* La API se compila en su propio contenedor: lleva solo los largos y los
 * ids del corpus, sin importar archivos por fuera de su rootDir. */
import { build } from "esbuild";
import { writeFileSync } from "node:fs";
const compilado = await build({entryPoints:["src/data/carreraTextos.ts"],bundle:true,format:"esm",write:false,logLevel:"silent"});
const { TEXTOS_CARRERA } = await import(`data:text/javascript;base64,${Buffer.from(compilado.outputFiles[0].text).toString("base64")}`);
writeFileSync("api/src/carreraTextos.json", JSON.stringify(Object.fromEntries(TEXTOS_CARRERA.map(t=>[t.id,t.texto.length])),null,2)+"\n");
console.log("Metadatos del corpus preparados para la API.");
