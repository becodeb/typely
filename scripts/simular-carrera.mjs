/* Examen del motor real y del corpus. Cada error y cada borrado consumen
 * tiempo de tipeo: corregir no es gratis y el reloj nunca se adapta. */
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
const raiz = path.resolve(import.meta.dirname, "..");
const salida = path.join(raiz, ".preview-orbita");
mkdirSync(salida, { recursive: true });
const bundle = path.join(salida, "carrera-examen.bundle.mjs");
await build({ stdin: { contents: 'export * from "./src/utils/orbita/carrera"; export * from "./src/data/carreraTextos"; export * from "./src/utils/orbita/pistaCarrera";', resolveDir: raiz }, bundle: true, format: "esm", outfile: bundle, logLevel: "silent" });
const { MotorCarrera, TEXTOS_CARRERA, elegirTextoCarrera, camaraCarrera } = await import(pathToFileURL(bundle).href);
// El arco debe dejar libres los cinco carriles y apoyar sobre las banquinas.
// Los límites .135 y .024 salen de la silueta de meta-ancha-source.png.
for (const [ancho,alto] of [[1366,468],[1366,612],[1440,600]]) {
  const c = camaraCarrera(ancho,alto);
  assert(c.imagen.ancho <= 1536, 'La pista no puede ampliar sus píxeles');
  assert(c.techoMeta >= 18, 'El arco no invade la lectura');
  assert(c.llegada < c.salida, 'Queda recorrido delante del arco');
  assert(c.anchoLlegada/2 < c.arco*(.5-.135), 'Ningún pie ocupa un carril');
  assert(c.arco*(.5-.024) < c.anchoLlegada*.8, 'Los pies apoyan dentro de las banquinas');
  for(let carril=0;carril<5;carril++) {
    const nave=c.corredor(1,carril);
    const mitadCasco=65*nave.escala;
    assert(Math.abs(nave.x-ancho/2)+mitadCasco < c.arco*(.5-.135), 'También pasa el casco del rival exterior');
  }
}
assert.equal(TEXTOS_CARRERA.length, 60);
const largosApi = JSON.parse(readFileSync(path.join(raiz,"api/src/carreraTextos.json"),"utf8"));
assert.deepEqual(largosApi,Object.fromEntries(TEXTOS_CARRERA.map(t=>[t.id,t.texto.length])),"Regenerá los largos del servidor si cambió el corpus");
const validacion = await build({entryPoints:[path.join(raiz,"api/src/carrera.ts")],bundle:true,format:"esm",write:false,logLevel:"silent"});
const {validarCarrera,cristalesDeCarrera} = await import(`data:text/javascript;base64,${Buffer.from(validacion.outputFiles[0].text).toString("base64")}`);
assert.equal(new Set(TEXTOS_CARRERA.map(t => t.texto)).size, 60);
assert.equal(new Set(TEXTOS_CARRERA.map(t => t.texto.split(/[.?]/)[0])).size, 60);
for (const {id,texto} of TEXTOS_CARRERA) {
  assert(texto.length >= 90 && texto.length <= 140, `${id}: ${texto.length} caracteres`);
  assert(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ .,¿?]+$/.test(texto), id);
  assert(!/ {2}| [.,?]|^ | $/.test(texto), id);
  assert(/[.?]$/.test(texto), id);
  assert([2,3].includes((texto.match(/[.?]/g) || []).length), id);
  assert.equal(texto.normalize("NFC"), texto);
  assert.notEqual(elegirTextoCarrera(id, () => 0).id, id);
}
function azar(semilla) { let a = semilla; return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const perfiles = [[8,.14],[15,.1],[25,.08],[40,.06],[60,.04],[85,.03]];
const resultados = [];
for (const [ppm,error] of perfiles) {
  const corridas = TEXTOS_CARRERA.slice(0,20).map(({id,texto},i) => {
    const rng = azar(200+i), m = new MotorCarrera({texto,textId:id,fantasmas:[{id:"mediana",alias:"ritmo",ppm:25}]});
    m.tick(2400);
    let errores = 0, teclas = 0;
    while (!m.resultado && teclas++ < 1000) {
      m.tick(12000 / ppm * (.75 + rng() * .5));
      if (m.rojas.length) m.borrar();
      else if (rng() < error) { m.tecla("#"); errores++; }
      else m.tecla(texto[m.indice]);
    }
    assert(m.resultado, `${ppm} PPM debe terminar`);
    assert.equal(m.resultado.errores, errores);
    assert.equal(m.resultado.precision, Math.round(100 * texto.length / (texto.length + errores)));
    assert.equal(m.resultado.ppmNeto, Math.round(texto.length * 12000 / m.tiempoMs));
    assert(m.resultado.puesto >= 1 && m.resultado.puesto <= 2);
    const carga = {textId:id,durationMs:m.resultado.durationMs,charsTyped:texto.length,wpmAvg:m.resultado.ppmNeto,accuracy:m.resultado.precision,score:m.resultado.puntaje,puesto:m.resultado.puesto,level:0,upgrades:[]};
    assert(validarCarrera(carga)); assert.equal(cristalesDeCarrera(carga),m.resultado.cristales);
    for (const cambio of [{score:carga.score+10},{textId:"inexistente"},{charsTyped:99.5},{wpmAvg:251},{level:1},{upgrades:[{}]},{puesto:6},{durationMs:400000}]) assert(!validarCarrera({...carga,...cambio}));
    return m.resultado;
  });
  const mediana = clave => corridas.map(r => r[clave]).sort((a,b)=>a-b)[10];
  // Límite revisado con autorización: 90–140 caracteres a 8 PPM más
  // correcciones no caben en 120 s. Se admite hasta 360 s en servidor.
  const maximo = Math.max(...corridas.map(r=>r.durationMs));
  assert(maximo < 360000);
  if (ppm === 25) assert(mediana("durationMs") >= 45000 && mediana("durationMs") <= 75000);
  if (ppm === 40) assert(mediana("durationMs") >= 25000 && mediana("durationMs") <= 45000);
  resultados.push({ppm,segundos:Math.round(mediana("durationMs")/1000),maximo:Math.round(maximo/1000),puntaje:mediana("puntaje"),precision:mediana("precision")});
}
for (let i=1;i<resultados.length;i++) assert(resultados[i].puntaje > resultados[i-1].puntaje);
const m = new MotorCarrera({texto:"Árbol ñ.",textId:"prueba",fantasmas:[{id:"f",alias:"f",ppm:25}]});
assert.deepEqual(m.tecla("Á"), []); m.tick(2399); assert(!m.largada); m.tick(1); assert(m.largada);
assert.equal(m.tecla("A\u0301")[0].tipo,"acierto");
for (let i=0;i<6;i++) m.tecla("x");
assert.equal(m.rojas.length,5); assert.equal(m.errores,5); assert.equal(m.indice,1);
for (let i=0;i<5;i++) assert.equal(m.borrar()[0].eraError,true);
assert.equal(m.borrar()[0].eraError,false); assert.equal(m.indice,0);
m.pausar(); m.tick(5000); assert.equal(m.tiempoMs,0); m.reanudar();
assert(m.tick(30000).some(e=>e.tipo === "inactivo")); assert.equal(m.tiempoMs,20000);
const progreso = m.fantasmas[0].progreso; m.tick(10000); assert.equal(m.fantasmas[0].progreso,progreso);
assert.equal(m.tecla("a")[0].tipo,"reanuda"); assert.equal(m.indice,0);
for (const ch of m.texto) {m.tick(200);m.tecla(ch);}
assert(m.resultado); const fijo = m.resultado; assert.deepEqual(m.tick(1000),[]); assert.deepEqual(m.borrar(),[]); assert.equal(m.resultado,fijo);
for (const [velocidad,puesto] of [[10,1],[200,2]]) {
  const r = new MotorCarrera({texto:"La nave.",textId:"orden",fantasmas:[{id:"f",alias:"f",ppm:velocidad}]});
  r.tick(2400); for(const ch of r.texto){r.tick(300);r.tecla(ch);} assert.equal(r.resultado.puesto,puesto);
}
console.table(resultados);
writeFileSync(path.join(salida,"carrera-simulacion.json"),JSON.stringify(resultados,null,2));
writeFileSync(path.join(salida,"textos-carrera.html"),`<!doctype html><html lang="es-AR"><meta charset="utf-8"><title>Textos de Carrera · revisión</title><style>body{max-width:850px;margin:40px auto;padding:20px;background:#151e3e;color:#edf3ff;font:18px/1.6 system-ui}li{padding:18px;border-bottom:1px solid #566184}small{color:#a4c6db}</style><h1>Los 60 textos de Carrera</h1><p>Revisión editorial antes de habilitarlos para los chicos. Cada texto conserva su identificador.</p><ol>${TEXTOS_CARRERA.map(t=>`<li><small>${t.id} · ${t.texto.length} caracteres</small><br>${t.texto}</li>`).join("")}</ol></html>`);
console.log("Sin fallas: corpus, seis perfiles, composición, bloqueo, borrado, pausa, inactividad y orden de llegada.");
