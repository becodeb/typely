import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const outfile = path.resolve('.preview-orbita/signos-test.mjs');
await build({ entryPoints: ['src/utils/orbita/motor.ts'], bundle: true, format: 'esm', outfile, logLevel: 'silent' });
const { MotorTormenta } = await import(pathToFileURL(outfile));
const frase = 'tormenta de signos';
const nuevo = () => new MotorTormenta({ rng: () => .4 });
function avanzar(m, segundos) {
  const eventos = [];
  for (let i = 0; i < Math.round(segundos * 20); i++) eventos.push(...m.tick(50));
  return eventos;
}
function calificar(m, intervalo) {
  // Una palabra controlada permite aislar la velocidad, incluso con errores.
  m.vivas.push({ id: 9999, texto: 'abcdefghijklmnop', escrito: 0, progreso: 0, vida: 999, banda: 1, carril: 0 });
  for (const ch of 'abcdefgh') {
    avanzar(m, intervalo);
    m.tecla('~');
    m.tecla(ch);
  }
}
const lento = nuevo();
calificar(lento, 1.5);
lento.vivas.length = 0;
avanzar(lento, 24);
assert.equal(lento.signos.fase, 'inactiva', 'el tipeo lento no activa el bonus');

const m = nuevo();
calificar(m, .4);
m.corazones = 100; // Mantener vivo el escenario de drenaje sin tipear las otras palabras.
avanzar(m, 34);
assert.equal(m.signos.fase, 'inactiva', 'espera a que no queden palabras');
m.vivas.length = 0;
m.tick(50);
assert.equal(m.signos.fase, 'entrada', 'la velocidad basta aunque haya errores');
assert.equal(m.vivas.length, 1);
assert.equal(m.vivas[0].texto, frase, 'la frase llega como único objeto del juego');
const fraseId = m.vivas[0].id;
const reloj = m.t;
m.corazones = 1;
m.escudo = 2;
avanzar(m, 1);
assert.ok(m.vivas[0].progreso > 0, 'la frase avanza hacia la nave');
const disparos = [];
for (const ch of 'tormenta') disparos.push(...m.tecla(ch));
assert.equal(m.engancheId, fraseId, 'la nave mantiene la mirada durante la frase');
assert.equal(disparos.filter(e => e.tipo === 'acierto').length, 8);
assert.equal(m.vivas[0].escrito, 8);
m.tecla('d');
assert.equal(m.signos.escrito, 8, 'no permite omitir el espacio');
for (const ch of ' de signos') m.tecla(ch);
assert.equal(m.signos.fase, 'activa');
assert.equal(m.vivas.length, 0, 'completar la frase la destruye antes del primer signo');
assert.equal(m.engancheId, null);
avanzar(m, 1);
assert.equal(m.vivas.length, 1, 'empieza con un solo signo');
const antes = m.puntaje;
const tecla = m.vivas[0].texto;
m.tecla(tecla);
assert.equal(m.puntaje - antes, 90, 'cada signo vale tres palabras de referencia');
m.tecla(tecla);
assert.equal(m.puntaje - antes, 90, 'una tecla repetida no duplica puntos');
const eventos = avanzar(m, 12);
assert.ok(eventos.some(e => e.tipo === 'signos' && e.estado.motivo === 'impacto'));
assert.ok(!eventos.some(e => e.tipo === 'impacto' || e.tipo === 'fin'));
assert.equal(m.corazones, 1);
assert.equal(m.escudo, 2);
assert.equal(m.signos.aciertos, 1);
assert.equal(m.signos.fase, 'terminada');
assert.ok(m.t - reloj < 3, 'solo avanza el reloj normal después del cierre');
if (m.eligiendo) m.elegir(m.eligiendo[0].id);
m.vivas.length = 0;
m.tick(50);
assert.equal(m.signos.fase, 'terminada', 'no vuelve a ofrecerse en esta partida');
assert.equal(nuevo().signos.fase, 'inactiva', 'una partida nueva reinicia el bonus');

const omitido = nuevo();
omitido.signos.iniciar(omitido.vivas);
avanzar(omitido, 28.1);
assert.equal(omitido.signos.fase, 'cierre');
assert.equal(omitido.signos.motivo, 'entrada');
assert.equal(omitido.corazones, 3);
assert.equal(omitido.t, 0);

for (const reaccion of [.25, .6, 1.5]) {
  const bot = nuevo();
  bot.signos.iniciar(bot.vivas);
  for (const ch of frase) bot.tecla(ch);
  let tiempo = 0, siguiente = reaccion, maxVivas = 0;
  const vistos = new Set();
  while (bot.signos.fase === 'activa' && tiempo < 80) {
    bot.tick(50); tiempo += .05;
    maxVivas = Math.max(maxVivas, bot.vivas.length);
    for (const p of bot.vivas) { assert.notEqual(p.texto, '_'); vistos.add(p.texto); }
    if (tiempo >= siguiente) {
      siguiente = tiempo + reaccion;
      const p = [...bot.vivas].sort((a,b) => b.progreso-a.progreso)[0];
      if (p) bot.tecla(p.texto);
    }
  }
  assert.equal(bot.signos.fase, 'cierre', 'la presión siempre acaba en impacto');
  assert.equal(bot.signos.motivo, 'impacto');
  assert.equal(bot.corazones, 3);
  assert.equal(bot.t, 0, 'ni dificultad ni poderes consumen tiempo durante el bonus');
  assert.ok(tiempo > 25 && tiempo < 50);
  assert.ok(maxVivas >= 2 && maxVivas <= 3);
  assert.ok(vistos.size >= 4);
  console.log(`Reacción ${reaccion}s: bonus ${tiempo.toFixed(1)}s, ${bot.signos.aciertos} signos, máximo ${maxVivas} simultáneos`);
}
console.log('OK: activación, espacios, puntuación, protección, adaptación, cierre y reinicio.');

const perfecto = nuevo();
perfecto.signos.iniciar(perfecto.vivas);
for (const ch of frase) perfecto.tecla(ch);
for (let i = 0; i < 810; i++) {
  perfecto.tick(50);
  for (const p of [...perfecto.vivas]) perfecto.tecla(p.texto);
}
assert.equal(perfecto.signos.fase, 'activa', 'superar 40 segundos no corta el bonus artificialmente');
const tiempoAntes = perfecto.signos.totalSegundos;
perfecto.tick(60000);
assert.ok(perfecto.signos.totalSegundos - tiempoAntes <= .101, 'un frame largo no consume un minuto de bonus');
console.log('OK: sin límite artificial de 40 s y protegido contra saltos de reloj.');
