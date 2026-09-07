import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const outfile = path.resolve('.preview-orbita/sin-limite-test.mjs');
await build({ entryPoints: ['src/utils/orbita/motor.ts'], bundle: true, format: 'esm', outfile, logLevel: 'silent' });
const { MotorTormenta } = await import(pathToFileURL(outfile));
const m = new MotorTormenta({ bandaMax: 4, rng: () => .4 });
// Aislar el reloj de los daños: una partida invulnerable debe poder continuar.
m.invulnerableHasta = Infinity;
for (let i = 0; i < 18001; i++) {
  const eventos = m.tick(100);
  assert.ok(!eventos.some(e => e.tipo === 'fin'), `no debe finalizar por tiempo a los ${m.t}s`);
}
assert.ok(m.t > 1800);
assert.equal(m.corazones, 3);
assert.equal(m.terminada, false);
m.invulnerableHasta = 0;
m.corazones = 1;
m.vivas.length = 0;
m.vivas.push({ id: 99999, texto: 'fin', escrito: 0, progreso: .999, vida: 1, banda: 1, carril: 0 });
const eventos = m.tick(100);
assert.equal(m.corazones, 0);
assert.equal(eventos.filter(e => e.tipo === 'fin').length, 1);
assert.equal(m.terminada, true);
assert.ok(eventos.find(e => e.tipo === 'fin').resultado.duracionMs > 1800000);
assert.deepEqual(m.tick(100), [], 'no repite el cierre');
console.log('PASS: 30 minutos con vidas sin corte; perder la última vida cierra exactamente una vez.');
