/* =====================================================================
   JUGAR TORMENTA DE PALABRAS EN TODOS LOS CASOS — el banco de escenarios
   ---------------------------------------------------------------------
   simular-tormenta.mjs contesta UNA pregunta: ¿dura ~2 minutos para
   cualquiera? Este script contesta la otra: ¿SE SIENTE bien? Hace jugar
   al motor real contra jugadores GUIONADOS que cambian de conducta con
   el tiempo — el que arranca mal y termina brillante, el que se distrae,
   el que mira el teclado a ratos, el que no toca nada — y mide lo que un
   jugador siente aunque no lo diga:

     · hueco máximo   — segundos seguidos SIN nada que tipear (aburrimiento)
     · ahogo          — segundos con 6 o más palabras vivas (pánico)
     · corazones      — en qué segundo se perdió cada uno
     · amenaza@t      — cómo respondió el juego al cambio de conducta
     · poderes        — cada uno verificado: ¿hizo lo que dice?
     · invariantes    — topes de pantalla, fin garantizado, fórmulas

     node scripts/jugar-tormenta.mjs
     node scripts/jugar-tormenta.mjs --semillas 12

   Corre el MISMO motor que la página, compilado al vuelo.
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
const { MotorTormenta, CRISTALES_POR_RANGO } = await import(pathToFileURL(BUNDLE).href);

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
/* Los jugadores guionados                                             */
/* ------------------------------------------------------------------ */
/* conducta(t) → { wpm, err, activo }. `activo=false` = no toca el teclado.
   `procrastina` = solo tipea cuando hay al menos tantas palabras vivas. */
const ESCENARIOS = [
  { nombre: "bueno constante (60 PPM)", banda: 9, conducta: () => ({ wpm: 60, err: 0.04, activo: true }) },
  { nombre: "malo constante (10 PPM)", banda: 1, conducta: () => ({ wpm: 10, err: 0.15, activo: true }) },
  {
    nombre: "malo 30 s → muy bueno",
    banda: 9,
    conducta: (t) => (t < 30 ? { wpm: 10, err: 0.15, activo: true } : { wpm: 70, err: 0.03, activo: true }),
  },
  {
    nombre: "muy bueno 40 s → se distrae",
    banda: 9,
    conducta: (t) => (t < 40 ? { wpm: 70, err: 0.03, activo: true } : { wpm: 12, err: 0.2, activo: true }),
  },
  {
    nombre: "intermitente 5 s sí / 4 s no",
    banda: 6,
    conducta: (t) => ({ wpm: 45, err: 0.05, activo: t % 9 < 5 }),
  },
  { nombre: "no toca nada", banda: 3, conducta: () => ({ wpm: 0, err: 0, activo: false }) },
  { nombre: "máquina perfecta (130 PPM)", banda: 10, conducta: () => ({ wpm: 130, err: 0, activo: true }) },
  { nombre: "rápido y torpe (55 PPM, 30 % err)", banda: 6, conducta: () => ({ wpm: 55, err: 0.3, activo: true }) },
  {
    nombre: "procrastinador (espera 2 vivas)",
    banda: 6,
    conducta: () => ({ wpm: 50, err: 0.05, activo: true }),
    procrastina: 2,
  },
  { nombre: "principiante real (8 PPM, B0)", banda: 0, conducta: () => ({ wpm: 8, err: 0.14, activo: true }) },
];

const PASO = 0.05;
const HITOS = [5, 10, 20, 30, 45, 60, 90, 120];

function jugar(esc, semilla) {
  const rng = rngCon(semilla);
  const motor = new MotorTormenta({
    bandaMax: esc.banda,
    rng: rngCon(semilla ^ 0x9e37),
    ajustes: AJUSTES_CLI,
  });

  const m = {
    fin: null,
    tFinPrueba: null,
    corazonesEn: [],
    roces: 0,
    rebotes: 0,
    amenazaEn: {},
    maxVivas: 0,
    maxVivasPrueba: 0,
    huecoMax: 0,
    ahogo: 0,
    poderes: [],
    fallas: [],
    ambiguedades: 0,
    errores: 0,
    tecleos: 0,
  };
  let huecoActual = 0;
  let esperaTecla = 0.4;
  let reaccionando = 0;
  let corazonesPrev = motor.corazones;
  let hitoIdx = 0;
  let pendienteVerificar = null; // poder aplicado en el tick anterior

  for (let paso = 0; paso < 330 / PASO && !m.fin; paso++) {
    const antes = { corazones: motor.corazones, escudo: motor.escudo, vivas: motor.vivas.length };
    const eventos = motor.tick(PASO * 1000);
    const t = motor.t;

    for (const ev of eventos) {
      if (ev.tipo === "fin") m.fin = ev.resultado;
      if (ev.tipo === "roce") m.roces++;
      if (ev.tipo === "rebote") m.rebotes++;
      if (ev.tipo === "impacto" && !ev.escudoAbsorbio) m.corazonesEn.push(Math.round(t));
      if (ev.tipo === "destruida" || ev.tipo === "impacto" || ev.tipo === "suelta" || ev.tipo === "roce" || ev.tipo === "rebote") {
        reaccionando = 0.25 + rng() * 0.35;
      }
      if (ev.tipo === "poderAplicado") {
        const p = ev.powerup;
        const despues = { corazones: motor.corazones, escudo: motor.escudo, vivas: motor.vivas.length };
        let ok = true;
        if (p === "reparacion") ok = despues.corazones === Math.min(3, antes.corazones + 1);
        if (p === "escudo") ok = despues.escudo === Math.min(2, antes.escudo + 1);
        if (p === "pulso") ok = despues.vivas === 0;
        if (p === "lento") ok = motor.efectos.lentoHasta > t;
        if (p === "rayo") ok = motor.efectos.rayoHasta > t;
        if (p === "cosecha") ok = motor.efectos.cosechaHasta > t;
        if (p === "mira") ok = motor.efectos.miraHasta > t;
        m.poderes.push({ t: Math.round(t), p, ok });
        if (!ok) m.fallas.push(`poder ${p} a los ${Math.round(t)} s no hizo lo que dice`);
      }
    }
    if (m.fin) break;

    /* --- métricas de sensación --- */
    if (m.tFinPrueba === null && motor.fase !== "calibracion") m.tFinPrueba = +t.toFixed(1);
    const vivas = motor.vivas.length;
    m.maxVivas = Math.max(m.maxVivas, vivas);
    if (motor.fase === "calibracion") m.maxVivasPrueba = Math.max(m.maxVivasPrueba, vivas);
    if (vivas >= 6) m.ahogo += PASO;
    const conducta = esc.conducta(t);
    if (vivas === 0 && conducta.activo) {
      huecoActual += PASO;
      m.huecoMax = Math.max(m.huecoMax, huecoActual);
    } else huecoActual = 0;
    if (hitoIdx < HITOS.length && t >= HITOS[hitoIdx]) {
      m.amenazaEn[HITOS[hitoIdx]] = Math.round(motor.amenaza);
      hitoIdx++;
    }
    /* Invariantes duros. */
    if (vivas > 8) m.fallas.push(`${vivas} palabras vivas a los ${Math.round(t)} s (tope 8)`);
    if (motor.fase === "calibracion" && vivas > 3) m.fallas.push(`${vivas} vivas durante el vuelo de prueba`);
    const iniciales = new Set();
    for (const p of motor.vivas) {
      if (p.escrito === 0 && iniciales.has(p.texto[0])) m.ambiguedades++;
      iniciales.add(p.texto[0]);
    }
    if (motor.corazones < corazonesPrev && motor.fase === "calibracion") {
      m.fallas.push(`perdió un corazón DURANTE el vuelo de prueba (t=${Math.round(t)})`);
    }
    corazonesPrev = motor.corazones;

    /* --- el jugador --- */
    if (!conducta.activo) continue;
    if (reaccionando > 0) {
      reaccionando -= PASO;
      continue;
    }
    esperaTecla -= PASO;
    if (esperaTecla > 0) continue;
    const cps = (conducta.wpm * 5) / 60;
    esperaTecla = (1 / cps) * (0.75 + rng() * 0.5);

    if (!motor.vivas.length) continue;
    if (esc.procrastina && motor.engancheId == null && motor.vivas.length < esc.procrastina) continue;

    let objetivo = motor.engancheId != null ? motor.vivas.find((p) => p.id === motor.engancheId) : null;
    if (!objetivo) {
      objetivo = [...motor.vivas].sort((a, b) => b.progreso - a.progreso)[0];
      reaccionando = 0.15 + rng() * 0.25;
    }
    const esperado = objetivo.texto[Math.min(objetivo.escrito, objetivo.texto.length - 1)];
    const seEquivoca = rng() < conducta.err;
    m.tecleos++;
    if (seEquivoca) m.errores++;
    for (const ev of motor.tecla(seEquivoca ? (esperado === "x" ? "z" : "x") : esperado)) {
      if (ev.tipo === "fin") m.fin = ev.resultado;
    }
  }

  if (!m.fin) m.fallas.push("la partida NUNCA terminó (330 s)");
  else {
    const r = m.fin;
    const esperados = r.palabras + CRISTALES_POR_RANGO[r.rango];
    if (r.cristales < esperados || r.cristales > r.palabras * 2 + CRISTALES_POR_RANGO[r.rango]) {
      m.fallas.push(`cristales ${r.cristales} fuera de fórmula (palabras ${r.palabras}, rango ${r.rango})`);
    }
    if (r.precision > 100 || r.precision < 0) m.fallas.push(`precisión ${r.precision}`);
    if (r.ppmPico < r.ppmMedio * 0.5) m.fallas.push(`ppm pico ${r.ppmPico} < medio ${r.ppmMedio}`);
  }
  return m;
}

/* ------------------------------------------------------------------ */
const argN = process.argv.indexOf("--semillas");
const N = argN > 0 ? Number(process.argv[argN + 1]) || 6 : 6;
/* --ajuste clave=valor (repetible): probar una perilla sin tocar el motor. */
const AJUSTES_CLI = {};
process.argv.forEach((arg, i) => {
  if (arg !== "--ajuste") return;
  const [clave, valor] = String(process.argv[i + 1] ?? "").split("=");
  if (clave && Number.isFinite(Number(valor))) AJUSTES_CLI[clave] = Number(valor);
});
const med = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

console.log(`Tormenta de palabras — banco de escenarios, ${N} semillas por caso\n`);
let fallasTotales = 0;
for (const esc of ESCENARIOS) {
  const corridas = [];
  for (let s = 1; s <= N; s++) corridas.push(jugar(esc, s * 104729));
  const terminadas = corridas.filter((c) => c.fin);
  const dur = med(terminadas.map((c) => c.fin.duracionMs / 1000));
  const amenaza = med(terminadas.map((c) => c.fin.amenazaMax));
  const rango = terminadas[Math.floor(terminadas.length / 2)]?.fin.rango ?? "—";
  const palabras = med(terminadas.map((c) => c.fin.palabras));
  const hueco = med(corridas.map((c) => c.huecoMax));
  const ahogo = med(corridas.map((c) => c.ahogo));
  const prueba = med(corridas.map((c) => c.tFinPrueba ?? 0));
  const corazones = corridas[0].corazonesEn.join(", ") || "—";
  const amz = HITOS.map((h) => `${h}s:${corridas[0].amenazaEn[h] ?? "·"}`).join(" ");
  const poderes = corridas.flatMap((c) => c.poderes);
  const poderesOk = poderes.filter((p) => p.ok).length;
  const fallas = [...new Set(corridas.flatMap((c) => c.fallas))];
  fallasTotales += fallas.length;

  console.log(`■ ${esc.nombre}  (banda ${esc.banda})`);
  console.log(
    `    duración ${dur.toFixed(0)} s · amenaza máx ${amenaza} · ${rango} · ${palabras} palabras` +
      ` · vuelo de prueba termina a los ${prueba.toFixed(1)} s`,
  );
  console.log(`    amenaza en el tiempo → ${amz}`);
  console.log(`    corazones perdidos (semilla 1) en s: ${corazones} · roces en prueba: ${corridas[0].roces} · rebotes: ${corridas.reduce((a, c) => a + c.rebotes, 0)}`);
  console.log(
    `    hueco máx sin palabras ${hueco.toFixed(1)} s · ahogo (≥6 vivas) ${ahogo.toFixed(1)} s` +
      ` · máx vivas ${Math.max(...corridas.map((c) => c.maxVivas))} (prueba ${Math.max(...corridas.map((c) => c.maxVivasPrueba))})`,
  );
  console.log(
    `    poderes verificados ${poderesOk}/${poderes.length}` +
      ` · ambigüedades de inicial ${corridas.reduce((a, c) => a + c.ambiguedades, 0)} muestras`,
  );
  if (fallas.length) for (const f of fallas) console.log(`    ✗ ${f}`);
  console.log("");
}
console.log(fallasTotales ? `${fallasTotales} falla(s) de invariantes.` : "Sin fallas de invariantes.");
process.exitCode = fallasTotales ? 1 : 0;
