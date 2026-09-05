/* =====================================================================
   VERIFICAR LA PROMESA DE LOS 2 MINUTOS — sin abrir el juego
   ---------------------------------------------------------------------
   Hace jugar al motor de "Tormenta de palabras" contra tipeadores
   sintéticos de todos los niveles — del lector de 8 PPM al de 85 — y mide
   cuánto duró cada partida. La promesa central del modo (§4 del diseño)
   es que TODOS terminan cerca de los 2:00, ±30 s, cada uno a su propia
   amenaza. Este script es el examen de esa promesa.

     node scripts/simular-tormenta.mjs
     node scripts/simular-tormenta.mjs --semillas 40   (más corridas)

   Corre el MISMO motor que la página (src/utils/orbita/motor.ts, con el
   corpus real del currículum), compilado al vuelo con el esbuild que ya
   trae Vite. Si un ajuste de AJUSTES cambia, este examen cambia con él —
   no hay una copia de las fórmulas que pueda desviarse.

   El tipeador sintético no es un autómata perfecto: tiene tiempo de
   reacción, ritmo con temblor, comete errores con la tasa de su perfil
   (y los reintenta), y a veces caza una cápsula. Es un chico plausible,
   no un script que aprieta la tecla exacta en el microsegundo exacto.
===================================================================== */
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RAIZ = path.resolve(import.meta.dirname, "..");
const SALIDA = path.join(RAIZ, ".preview-orbita");
mkdirSync(SALIDA, { recursive: true });

const BUNDLE = path.join(SALIDA, "motor.bundle.mjs");
await build({
  entryPoints: [path.join(RAIZ, "src", "utils", "orbita", "motor.ts")],
  bundle: true,
  format: "esm",
  outfile: BUNDLE,
  logLevel: "silent",
});
const { MotorTormenta } = await import(pathToFileURL(BUNDLE).href);

/* ------------------------------------------------------------------ */
/* RNG con semilla (mulberry32) — corridas reproducibles               */
/* ------------------------------------------------------------------ */
function rngCon(semilla) {
  let a = semilla >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* El tipeador sintético                                               */
/* ------------------------------------------------------------------ */
/* wpm: velocidad sostenida · err: probabilidad de tecla errada ·
   banda: hasta dónde desbloqueó en el modo historia. Los perfiles bajan
   en error a medida que suben en velocidad, como los chicos reales. */
const PERFILES = [
  { nombre: "1er grado lento ", wpm: 8, err: 0.14, banda: 0 },
  { nombre: "1er grado típico", wpm: 15, err: 0.1, banda: 1 },
  { nombre: "3er grado típico", wpm: 25, err: 0.08, banda: 3 },
  { nombre: "5to grado típico", wpm: 40, err: 0.06, banda: 6 },
  { nombre: "6to muy bueno   ", wpm: 60, err: 0.04, banda: 9 },
  { nombre: "tecleador experto", wpm: 85, err: 0.03, banda: 10 },
];

function simular(perfil, semilla) {
  const rng = rngCon(semilla);
  const motor = new MotorTormenta({
    bandaMax: perfil.banda,
    rng: rngCon(semilla ^ 0x9e37),
    ajustes: AJUSTES_CLI,
  });

  const cps = (perfil.wpm * 5) / 60;
  let esperaTecla = 0.4; // arranca mirando la pantalla
  let reaccionando = 0;
  let resultado = null;
  let impactos = 0;
  let capsulas = 0;

  const PASO = 0.05; // 50 ms — granularidad sobrada para ritmos de tipeo
  for (let pasos = 0; pasos < 320 / PASO && !resultado; pasos++) {
    for (const ev of motor.tick(PASO * 1000)) {
      if (ev.tipo === "fin") resultado = ev.resultado;
      if (ev.tipo === "impacto") impactos++;
      /* Cambio de objetivo → tiempo de reacción humano. */
      if (ev.tipo === "destruida" || ev.tipo === "impacto" || ev.tipo === "suelta" || ev.tipo === "rebote") {
        reaccionando = 0.25 + rng() * 0.35;
      }
    }
    if (resultado) break;

    /* Subió de nivel (pasa dentro de tecla(), no del tick): elige al azar.
       Este examen mide la promesa de duración, no la estrategia. La pausa
       de la elección no cuenta como partida. */
    if (motor.eligiendo) {
      capsulas++;
      const carta = motor.eligiendo[Math.floor(rng() * motor.eligiendo.length)];
      for (const e2 of motor.elegir(carta.id)) if (e2.tipo === "fin") resultado = e2.resultado;
      reaccionando = 0.6 + rng() * 0.6;
      continue;
    }

    if (reaccionando > 0) {
      reaccionando -= PASO;
      continue;
    }

    esperaTecla -= PASO;
    if (esperaTecla > 0) continue;
    /* Ritmo con temblor ±25 %. */
    esperaTecla = (1 / cps) * (0.75 + rng() * 0.5);

    /* ¿Qué tecla aprieta? */
    const vivas = motor.vivas;
    if (!vivas.length) continue;

    let objetivo = null;
    if (motor.engancheId != null) {
      objetivo = vivas.find((p) => p.id === motor.engancheId) ?? null;
    }
    if (!objetivo) {
      /* Elige la más urgente. Los poderes ahora viajan escondidos en
         palabras comunes: no hay nada especial que cazar. */
      objetivo = [...vivas].sort((a, b) => b.progreso - a.progreso)[0] ?? null;
      if (!objetivo) continue;
      reaccionando = 0.15 + rng() * 0.25; // apuntar a algo nuevo cuesta un instante
    }

    const esperado = objetivo.texto[Math.min(objetivo.escrito, objetivo.texto.length - 1)];
    const seEquivoca = rng() < perfil.err;
    const tecla = seEquivoca ? (esperado === "x" ? "z" : "x") : esperado;
    for (const ev of motor.tecla(tecla)) {
      if (ev.tipo === "fin") resultado = ev.resultado;
    }
  }

  /* Si el bucle agotó los 320 s sin `fin`, el lazo está roto: eso es
     exactamente lo que este script existe para detectar. */
  return { resultado, impactos, capsulas, colgada: !resultado };
}

/* ------------------------------------------------------------------ */
const argSemillas = process.argv.indexOf("--semillas");
const N = argSemillas > 0 ? Number(process.argv[argSemillas + 1]) || 20 : 20;
/* --ajuste clave=valor (repetible): probar una perilla sin tocar el motor. */
const AJUSTES_CLI = {};
process.argv.forEach((arg, i) => {
  if (arg !== "--ajuste") return;
  const [clave, valor] = String(process.argv[i + 1] ?? "").split("=");
  if (clave && Number.isFinite(Number(valor))) AJUSTES_CLI[clave] = Number(valor);
});

const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const seg = (ms) => (ms / 1000).toFixed(0) + "s";

console.log(`Tormenta de palabras — ${N} partidas por perfil\n`);
console.log(
  "perfil            banda   duración (med · min–max)   amenaza  rango       ppm~   palabras  poderes",
);
console.log("-".repeat(105));

let todoBien = true;
for (const perfil of PERFILES) {
  const corridas = [];
  let colgadas = 0;
  for (let s = 1; s <= N; s++) {
    const r = simular(perfil, s * 7919);
    if (r.colgada) colgadas++;
    else corridas.push(r);
  }
  if (colgadas) {
    todoBien = false;
    console.log(`${perfil.nombre}  ⚠ ${colgadas}/${N} partidas NUNCA terminaron — lazo roto`);
    continue;
  }
  const dur = corridas.map((c) => c.resultado.duracionMs);
  const durMed = mediana(dur);
  const amenaza = Math.round(mediana(corridas.map((c) => c.resultado.amenazaMax)));
  const rango = corridas[Math.floor(corridas.length / 2)].resultado.rango;
  const ppm = Math.round(mediana(corridas.map((c) => c.resultado.ppmMedio)));
  const palabras = Math.round(mediana(corridas.map((c) => c.resultado.palabras)));
  const poderes = Math.round(mediana(corridas.map((c) => c.capsulas)));

  /* La promesa del HÍBRIDO (mejoras permanentes, 2026-09-04): la partida
     base sigue en ~2:00, una buena build estira, y NADA pasa de 3:45. Por
     eso dos topes: la mediana entre 1:30 y 3:00, y el máximo de las 20
     partidas en 225 s o menos (el motor corta ahí). */
  const durMax = Math.max(...dur);
  const medianaOk = durMed >= 90_000 && durMed <= 180_000;
  const techoOk = durMax <= 225_000;
  const dentro = medianaOk && techoOk;
  if (!dentro) todoBien = false;
  console.log(
    `${perfil.nombre}   B${String(perfil.banda).padEnd(4)}` +
      ` ${seg(durMed).padStart(5)} · ${seg(Math.min(...dur))}–${seg(durMax)}`.padEnd(28) +
      `${String(amenaza).padStart(5)}    ${rango.padEnd(10)}` +
      ` ${String(ppm).padStart(4)}   ${String(palabras).padStart(6)}  ${String(poderes).padStart(6)}` +
      (medianaOk ? "" : "   ← mediana FUERA de 90–180 s") +
      (techoOk ? "" : "   ← máximo PASA el techo de 225 s"),
  );
}

console.log("");
console.log(
  todoBien
    ? "La promesa se cumple: mediana de todos los perfiles entre 1:30 y 3:00, y ninguna partida pasa de 3:45."
    : "Hay perfiles fuera del objetivo — tocar AJUSTES en src/utils/orbita/motor.ts y volver a correr.",
);
process.exitCode = todoBien ? 0 : 1;
