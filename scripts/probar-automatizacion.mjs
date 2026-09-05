/* =====================================================================
   EXAMEN DEL MOTOR DEL MODO AUTOMATIZACIÓN — sin abrir el juego
   ---------------------------------------------------------------------
   Corre los catorce casos manuales imprescindibles de
   docs/modo-automatizacion/IMPLEMENTACION.md §14 que se pueden decidir
   sin interfaz, más las invariantes de la economía.

     node scripts/probar-automatizacion.mjs

   Usa el MISMO motor que la página, compilado al vuelo con el esbuild
   que ya trae Vite — igual que scripts/simular-tormenta.mjs. No hay una
   copia de las reglas acá que pueda desviarse de las de src/.
===================================================================== */
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RAIZ = path.resolve(import.meta.dirname, "..");
const SALIDA = path.join(RAIZ, ".preview-automatizacion");
mkdirSync(SALIDA, { recursive: true });

async function cargar(rel, nombre) {
  const out = path.join(SALIDA, nombre);
  await build({
    entryPoints: [path.join(RAIZ, ...rel)],
    bundle: true,
    format: "esm",
    outfile: out,
    logLevel: "silent",
  });
  return import(pathToFileURL(out).href);
}

const M = await cargar(["src", "utils", "automatizacion", "motor.ts"], "motor.bundle.mjs");
const P = await cargar(["src", "utils", "automatizacion", "programa.ts"], "programa.bundle.mjs");
const B = await cargar(["src", "data", "automatizacion", "balance.ts"], "balance.bundle.mjs");
const A = await cargar(["src", "utils", "automatizacion", "almacenamiento.ts"], "almacenamiento.bundle.mjs");

/* ------------------------------------------------------------------ */
let ok = 0;
let fallos = 0;

function prueba(nombre, fn) {
  try {
    fn();
    ok++;
    console.log("  \x1b[32m✓\x1b[0m " + nombre);
  } catch (err) {
    fallos++;
    console.log("  \x1b[31m✗\x1b[0m " + nombre);
    console.log("      " + err.message);
  }
}
function igual(a, b, msg) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error((msg ?? "") + "  esperaba " + sb + ", vino " + sa);
}
function cierto(v, msg) {
  if (!v) throw new Error(msg ?? "esperaba verdadero");
}

/** RNG con semilla, para que las variantes de cristal no muevan el examen. */
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
const azar = rngCon(7);

/** Estado con el campo ya expandido a NxN, que es como estaban escritos
 *  los casos del 2x2 antes de que el campo arrancara en 1x1. */
function campoDe(lado) {
  const e = M.estadoInicial(azar);
  while (e.lado < lado) M.expandirCampo(e, azar);
  for (const c of e.celdas) { c.etapa = 0; c.restanteMs = M.msPorEtapa(e); }
  const idx = M.indice(e, e.lado - 1, 0);
  e.celdas[idx].etapa = 3;
  return e;
}

const acc = (type, id = type) => ({ id, type });
const plantar = (mineral, id = "p" + mineral) => ({ id, type: "plant", mineral });
/** Saldos de sobra en los cuatro minerales. */
const rico = (n = 999) => M.porMineral(n);
const rep = (times, body, id = "r" + times) => ({ id, type: "repeat", times, body });

/** Corre un programa entero sobre un estado y devuelve los eventos. */
function correr(e, programa) {
  const { pasos } = P.expandir(programa);
  return pasos.map((p) => M.ejecutarPaso(e, p.nodoId, p.tipo, azar, p.mineral));
}

/* ================================================================== */
console.log("\nNAVE Y CAMPO");

prueba("1 · un programa vacío no produce ningún paso", () => {
  igual(P.expandir([]).pasos.length, 0);
});

prueba("2 · la nave empieza abajo a la izquierda mirando arriba", () => {
  const e = M.estadoInicial(azar);
  igual(e.nave, { fila: e.lado - 1, col: 0, direccion: "north" });
});

prueba("2b · el campo arranca en 1x1 y avanzar sólo rebota", () => {
  const e = M.estadoInicial(azar);
  igual(e.lado, 1);
  igual(correr(e, [acc("move_forward")])[0].tipo, "bump");
});

prueba("3 · avanzar desde el origen sube a la celda de arriba", () => {
  const e = campoDe(2);
  const [ev] = correr(e, [acc("move_forward")]);
  igual(ev.tipo, "move");
  igual({ fila: e.nave.fila, col: e.nave.col }, { fila: e.lado - 2, col: 0 });
});

prueba("4 · cuatro giros a la derecha recuperan la orientación", () => {
  const e = M.estadoInicial(azar);
  correr(e, [acc("turn_right", "a"), acc("turn_right", "b"), acc("turn_right", "c"), acc("turn_right", "d")]);
  igual(e.nave.direccion, "north");
});

prueba("4b · girar a izquierda y a derecha son inversos", () => {
  const e = M.estadoInicial(azar);
  correr(e, [acc("turn_left", "a"), acc("turn_right", "b")]);
  igual(e.nave.direccion, "north");
});

prueba("5 · el borde rebota, consume el paso y el programa sigue", () => {
  const e = campoDe(2);
  // Mirando al norte desde el origen: dos avances y el segundo choca.
  const evs = correr(e, [acc("move_forward", "m1"), acc("move_forward", "m2"), acc("turn_right", "g")]);
  igual(evs.map((x) => x.tipo), ["move", "bump", "turn"]);
  igual({ fila: e.nave.fila, col: e.nave.col }, { fila: 0, col: 0 });
});

prueba("6 · cosechar una veta madura suma y la reinicia a etapa 0", () => {
  const e = M.estadoInicial(azar);
  const idx = M.indice(e, e.nave.fila, e.nave.col);
  igual(e.celdas[idx].etapa, 3, "el origen arranca maduro para el primer ingreso");
  const [ev] = correr(e, [acc("harvest")]);
  igual(ev.tipo, "harvest");
  igual(ev.premio, B.MINERALES.punta.valor);
  igual(e.saldos.punta, B.MINERALES.punta.valor);
  igual(e.celdas[idx].etapa, 0);
  cierto(e.celdas[idx].restanteMs > 0, "la veta reiniciada tiene que volver a contar");
});

prueba("7 · cosechar en vacío consume el paso y no paga", () => {
  const e = M.estadoInicial(azar);
  correr(e, [acc("harvest", "h1")]); // deja la celda en 0
  const saldoPrevio = e.saldos.punta;
  const [ev] = correr(e, [acc("harvest", "h2")]);
  igual(ev.tipo, "empty_harvest");
  igual(ev.premio, 0);
  igual(e.saldos.punta, saldoPrevio);
});

prueba("8 · las vetas crecen con el programa detenido", () => {
  const e = M.estadoInicial(azar);
  const idx = M.indice(e, 0, 0);
  e.celdas[idx] = { etapa: 0, variante: "punta", restanteMs: M.msPorEtapa(e) };
  const paso = B.AJUSTES.dtMaximoMs;
  const necesarios = Math.ceil((M.msPorEtapa(e) * 3) / paso) + 3;
  for (let i = 0; i < necesarios; i++) M.avanzarMundo(e, paso);
  igual(e.celdas[idx].etapa, 3, "tres etapas de crecimiento tienen que llegar a madura");
});

prueba("9 · una veta madura NO sigue creciendo ni desborda", () => {
  const e = M.estadoInicial(azar);
  const idx = M.indice(e, e.nave.fila, e.nave.col);
  for (let i = 0; i < 200; i++) M.avanzarMundo(e, B.AJUSTES.dtMaximoMs);
  igual(e.celdas[idx].etapa, 3);
});

prueba("10 · ocultar la pestaña no genera progreso (dt recortado)", () => {
  const e = M.estadoInicial(azar);
  const idx = M.indice(e, 0, 0);
  e.celdas[idx] = { etapa: 0, variante: "punta", restanteMs: M.msPorEtapa(e) };
  // Cuatro horas de reloj de pared en un solo salto, como al volver del fondo.
  M.avanzarMundo(e, 4 * 60 * 60 * 1000);
  igual(e.celdas[idx].etapa, 0, "un salto enorme no puede madurar nada");
  cierto(e.relojMs <= B.AJUSTES.dtMaximoMs, "el reloj jugado tampoco puede saltar");
});

prueba("11 · volver al origen no toca el campo ni el saldo", () => {
  const e = M.estadoInicial(azar);
  correr(e, [acc("harvest"), acc("move_forward")]);
  const saldo = e.saldos.punta;
  const campo = JSON.stringify(e.celdas);
  M.volverAlOrigen(e);
  igual(e.nave, { fila: e.lado - 1, col: 0, direccion: "north" });
  igual(e.saldos.punta, saldo);
  igual(JSON.stringify(e.celdas), campo);
});

/* ================================================================== */
console.log("\nPROGRAMA Y CAPACIDAD");

prueba("12 · Repetir 3 con dos acciones produce seis pasos", () => {
  const { pasos } = P.expandir([rep(3, [acc("move_forward", "a"), acc("harvest", "b")])]);
  igual(pasos.length, 6);
  igual(pasos.map((p) => p.tipo), ["move_forward", "harvest", "move_forward", "harvest", "move_forward", "harvest"]);
  igual(pasos.map((p) => p.vuelta), [1, 1, 2, 2, 3, 3]);
});

prueba("13 · el contenedor cuenta a sí mismo Y a su contenido", () => {
  igual(P.capacidadUsada([acc("move_forward")]), 1);
  igual(P.capacidadUsada([rep(3, [acc("move_forward", "a"), acc("harvest", "b")])]), 3);
});

prueba("14 · la capacidad inicial no alcanza para el recorrido completo", () => {
  /* El giro del 2x2 es Repetir 4 [avanzar, cosechar, girar] = 4 unidades,
     y la memoria inicial son 3. Esto no es un bug: es el momento en que
     comprar una ranura CAUSA el descubrimiento del bucle. Si algún día
     cambia el balance, este examen avisa que ese momento se movió. */
  const e = campoDe(2);
  const vuelta = [rep(4, [acc("move_forward", "a"), acc("harvest", "b"), acc("turn_right", "c")])];
  igual(P.capacidadUsada(vuelta), 4);
  igual(M.capacidad(e), 3);
  cierto(!P.entra([], M.capacidad(e), P.capacidadUsada(vuelta)), "no tiene que entrar todavía");
  e.mejoras.capacidad = 1;
  cierto(P.entra([], M.capacidad(e), P.capacidadUsada(vuelta)), "con una ranura más, sí");
});

prueba("15 · Repetir 4 [avanzar, cosechar, girar] recorre el 2x2 entero", () => {
  const e = campoDe(2);
  for (const c of e.celdas) c.etapa = 3;
  const evs = correr(e, [rep(4, [acc("move_forward", "a"), acc("harvest", "b"), acc("turn_right", "c")])]);
  igual(evs.filter((x) => x.tipo === "harvest").length, 4, "tiene que cosechar las cuatro baldosas");
  igual(evs.filter((x) => x.tipo === "bump").length, 0, "y sin chocar una sola vez");
  igual(e.nave, { fila: e.lado - 1, col: 0, direccion: "north" }, "y volver sola al muelle");
});

prueba("16 · un bucle rinde más que una secuencia con la misma memoria", () => {
  const conBucle = P.expandir([rep(4, [acc("move_forward", "a"), acc("harvest", "b")])]).pasos.length;
  const suelto = P.expandir([acc("move_forward", "a"), acc("harvest", "b"), acc("move_forward", "c")]).pasos.length;
  igual(P.capacidadUsada([rep(4, [acc("move_forward", "a"), acc("harvest", "b")])]), 3);
  cierto(conBucle > suelto, "3 unidades con Repetir tienen que dar más pasos que 3 sueltas");
});

prueba("17 · la expansión se corta en el tope y avisa", () => {
  const r = P.expandir([rep(4, [acc("move_forward", "a")])], 3);
  igual(r.pasos.length, 3);
  igual(r.completo, false);
});

prueba("18 · el anidamiento tiene dos niveles: un Repetir adentro de otro sí, tres no", () => {
  cierto(P.validarPrograma([rep(2, [rep(2, [acc("move_forward", "a")], "interno")])]) !== null, "dos niveles");
  igual(P.validarPrograma([rep(2, [rep(2, [rep(2, [acc("move_forward", "a")], "nieto")], "interno")])]), null, "tres, no");
});

prueba("19 · se rechaza un N fuera de las opciones", () => {
  igual(P.validarPrograma([rep(99, [acc("move_forward", "a")])]), null);
  cierto(P.validarPrograma([rep(3, [acc("move_forward", "a")])]) !== null);
});

prueba("20 · se rechaza basura y un programa a medias se descarta entero", () => {
  igual(P.validarPrograma("no soy un programa"), null);
  igual(P.validarPrograma([{ id: "x", type: "borrar_todo" }]), null);
  igual(P.validarPrograma([acc("move_forward"), { id: "y", type: "hackear" }]), null);
});

prueba("21 · quitar un nodo lo encuentra también adentro del contenedor", () => {
  const prog = [rep(3, [acc("move_forward", "a"), acc("harvest", "b")])];
  const sin = P.quitarNodo(prog, "b");
  igual(P.capacidadUsada(sin), 2);
  igual(P.quitarNodo(prog, "r3").length, 0);
});

/* ================================================================== */
console.log("\nARRASTRAR PIEZAS");

prueba("D1 · colocar: al final, antes de un bloque, y adentro de un Repetir", () => {
  const base = [acc("move_forward", "a"), rep(2, [acc("harvest", "h")], "r")];
  igual(P.colocar(base, acc("turn_left", "x"), { tipo: "final" }).map((n) => n.id), ["a", "r", "x"]);
  igual(P.colocar(base, acc("turn_left", "x"), { tipo: "antes", id: "a" }).map((n) => n.id), ["x", "a", "r"]);
  igual(P.colocar(base, acc("turn_left", "x"), { tipo: "antes", id: "h" })[1].body.map((n) => n.id), ["x", "h"]);
  igual(P.colocar(base, acc("turn_left", "x"), { tipo: "dentro", id: "r" })[1].body.map((n) => n.id), ["h", "x"]);
});

prueba("D2 · el anidamiento tiene tope: dos niveles, y Por siempre sólo en la libreta", () => {
  const base = [rep(2, [acc("harvest", "h")], "r")];
  const otro = rep(3, [], "r2");
  igual(P.colocar(base, otro, { tipo: "dentro", id: "r" })[0].body.map((n) => n.id), ["h", "r2"], "un Repetir adentro de otro, sí");
  const conHijo = rep(3, [acc("turn_left", "x")], "r3");
  const anidado = P.colocar(base, conHijo, { tipo: "dentro", id: "r" });
  const nieto = rep(2, [], "r4");
  cierto(P.colocar(anidado, nieto, { tipo: "dentro", id: "r3" }) === anidado, "un tercer nivel, no");
  cierto(P.colocar(anidado, nieto, { tipo: "antes", id: "x" }) === anidado, "ni antes de un nieto");
  const siempre = { id: "s", type: "forever", body: [] };
  cierto(P.colocar(base, siempre, { tipo: "dentro", id: "r" }) === base, "Por siempre no va adentro de nada");
  igual(P.colocar(base, siempre, { tipo: "final" }).map((n) => n.id), ["r", "s"], "pero sí en la libreta");
  cierto(P.colocar(base, rep(2, [siempre], "r5"), { tipo: "final" }).length === 2, "colocar al final no mira adentro: eso lo hace la validación");
  cierto(P.validarPrograma([rep(2, [siempre], "r5")]) === null, "y la validación lo rechaza");
});

prueba("D3 · mover: reordena, mete y saca de un contenedor, y no pierde bloques", () => {
  const base = [acc("move_forward", "a"), acc("turn_left", "b"), rep(2, [acc("harvest", "h")], "r")];
  igual(P.moverNodo(base, "b", { tipo: "antes", id: "a" }).map((n) => n.id), ["b", "a", "r"]);
  const adentro = P.moverNodo(base, "a", { tipo: "dentro", id: "r" });
  igual(adentro.map((n) => n.id), ["b", "r"]);
  igual(adentro[1].body.map((n) => n.id), ["h", "a"]);
  const afuera = P.moverNodo(base, "h", { tipo: "final" });
  igual(afuera.map((n) => n.id), ["a", "b", "r", "h"]);
  igual(afuera[2].body.length, 0);
  igual(P.capacidadUsada(afuera), P.capacidadUsada(base), "mover no cambia la memoria usada");
});

prueba("D4 · mover: soltar en el mismo lugar o adentro de sí mismo no hace nada", () => {
  const base = [acc("move_forward", "a"), rep(2, [acc("harvest", "h")], "r")];
  cierto(P.moverNodo(base, "a", { tipo: "antes", id: "a" }) === base);
  cierto(P.moverNodo(base, "r", { tipo: "dentro", id: "r" }) === base, "un contenedor adentro de sí mismo");
  cierto(P.moverNodo(base, "r", { tipo: "antes", id: "h" }) === base, "ni antes de su propio hijo");
  igual(P.despuesDe(base, "a"), { tipo: "antes", id: "r" });
  igual(P.despuesDe(base, "h"), { tipo: "dentro", id: "r", rama: "body" });
  igual(P.despuesDe(base, "r"), { tipo: "final" });
});

prueba("D5 · desplazar con el teclado: un lugar por vez, dentro de su lista, sin salirse", () => {
  const base = [acc("move_forward", "a"), acc("turn_left", "b"), rep(2, [acc("harvest", "h"), acc("turn_right", "g")], "r")];
  igual(P.desplazarNodo(base, "b", -1).map((n) => n.id), ["b", "a", "r"]);
  cierto(P.desplazarNodo(base, "a", -1) === base, "el primero no sube más");
  cierto(P.desplazarNodo(base, "r", 1) === base, "el último no baja más");
  igual(P.desplazarNodo(base, "g", -1)[2].body.map((n) => n.id), ["g", "h"]);
  cierto(P.desplazarNodo(base, "g", 1) === base, "el último de la cavidad tampoco sale de ella");
});

/* ================================================================== */
console.log("\nEL INTÉRPRETE");

const I = await cargar(["src", "utils", "automatizacion", "interprete.ts"], "interprete.bundle.mjs");
const si = (sensor, body, sino, id = "si") => ({ id, type: "if", sensor, body, ...(sino ? { sino } : {}) });
const mientras = (sensor, body, id = "mi") => ({ id, type: "while", sensor, body });
const siempre = (body, id = "s") => ({ id, type: "forever", body });

/** Corre con el intérprete hasta que termine o hasta `tope` pasos, y
 *  entre paso y paso deja correr el mundo `dtMs`. Devuelve los pasos y
 *  los eventos. */
function correrVivo(e, programa, { tope = 200, dtMs = 0 } = {}) {
  const it = I.crearInterprete(programa, e);
  const pasos = [];
  const eventos = [];
  for (let n = 0; n < tope; n++) {
    const p = it.siguiente();
    if (!p) break;
    pasos.push(p);
    // `tick` y `counter` nunca llegan a `ejecutarPaso`: el segundo es la
    // interceptación del contador (PROGRESION.md §6), no un evento de campo.
    if (p.tipo !== "tick" && p.tipo !== "counter") eventos.push(M.ejecutarPaso(e, p.nodoId, p.tipo, azar, p.mineral));
    if (dtMs) M.avanzarMundo(e, dtMs);
  }
  return { pasos, eventos, terminado: it.siguiente() === null };
}

prueba("I1 · sin sensores, el intérprete da los mismos pasos que expandir", () => {
  const prog = [acc("move_forward", "a"), rep(3, [acc("harvest", "b"), acc("turn_right", "c")]), acc("move_back", "d")];
  const { pasos } = correrVivo(campoDe(2), prog);
  igual(pasos.map((p) => p.nodoId), P.expandir(prog).pasos.map((p) => p.nodoId));
  igual(pasos.length, 8);
});

prueba("I2 · Si mira la baldosa: cosecha sólo cuando está listo, y el sino va por el otro lado", () => {
  const e = campoDe(2);
  const idx = M.indice(e, e.lado - 1, 0);
  e.celdas[idx] = { etapa: 3, variante: "racimo", restanteMs: 0 };
  const prog = [si({ tipo: "listo" }, [acc("harvest", "h")], [acc("wait", "w")])];
  let r = correrVivo(e, prog);
  igual(r.pasos.map((p) => p.nodoId), ["h"], "listo: cosecha");
  igual(e.saldos.racimo, B.MINERALES.racimo.valor);
  e.celdas[idx] = { etapa: 1, variante: "racimo", restanteMs: 500 };
  r = correrVivo(e, prog);
  igual(r.pasos.map((p) => p.nodoId), ["w"], "verde: espera en vez de romperlo");
  igual(e.celdas[idx].etapa, 1, "y el cuarzo sigue entero");
  igual(r.eventos[0].tipo, "wait");
});

prueba("I3 · Mientras no está listo → esperar: la nave espera lo justo y cosecha apenas madura", () => {
  const e = campoDe(2);
  const idx = M.indice(e, e.lado - 1, 0);
  e.celdas[idx] = { etapa: 2, variante: "punta", restanteMs: 1000 };
  const prog = [mientras({ tipo: "listo", no: true }, [acc("wait", "w")]), acc("harvest", "h")];
  const r = correrVivo(e, prog, { dtMs: 250 });
  const esperas = r.pasos.filter((p) => p.nodoId === "w").length;
  cierto(esperas >= 4 && esperas <= 5, "esperó ~1000 ms en pasos de 250: " + esperas);
  igual(r.pasos[r.pasos.length - 1].nodoId, "h");
  igual(e.saldos.punta, 1);
  cierto(r.terminado);
});

prueba("I4 · Mientras sin cuerpo y Por siempre vacío dan tics, nunca cuelgan", () => {
  const e = campoDe(2);
  const idx = M.indice(e, e.lado - 1, 0);
  e.celdas[idx] = { etapa: 2, variante: "punta", restanteMs: 800 };
  let r = correrVivo(e, [mientras({ tipo: "listo", no: true }, []), acc("harvest", "h")], { dtMs: 250, tope: 100 });
  const tics = r.pasos.filter((p) => p.tipo === "tick").length;
  cierto(tics >= 3 && tics <= 5, "un tic por vuelta vacía, hasta que madura (800 ms en pasos de 250): " + tics);
  igual(r.pasos[r.pasos.length - 1].nodoId, "h");
  r = correrVivo(campoDe(2), [siempre([])], { tope: 50 });
  igual(r.pasos.length, 50);
  cierto(r.pasos.every((p) => p.tipo === "tick" && p.nodoId === "s"));
});

prueba("I5 · Por siempre no termina solo, y una vuelta sin acciones también es un tic", () => {
  const e = campoDe(2);
  for (const c of e.celdas) { c.etapa = 1; c.restanteMs = 99999; }
  const prog = [siempre([si({ tipo: "listo" }, [acc("harvest", "h")])])];
  const r = correrVivo(e, prog, { tope: 300 });
  igual(r.pasos.length, 300, "no terminó");
  cierto(r.pasos.every((p) => p.tipo === "tick"), "nada listo: sólo tics");
  cierto(!r.terminado);
});

prueba("I6 · los sensores: vacía, es color, borde adelante, y su negación", () => {
  const e = campoDe(3);
  const idx = M.indice(e, e.lado - 1, 0);
  e.celdas[idx] = { etapa: 0, variante: null, restanteMs: 0 };
  cierto(I.evaluarSensor({ tipo: "vacia" }, e));
  cierto(!I.evaluarSensor({ tipo: "vacia", no: true }, e));
  cierto(!I.evaluarSensor({ tipo: "listo" }, e));
  e.celdas[idx] = { etapa: 2, variante: "prisma", restanteMs: 10 };
  cierto(I.evaluarSensor({ tipo: "es", mineral: "prisma" }, e));
  cierto(!I.evaluarSensor({ tipo: "es", mineral: "punta" }, e));
  cierto(!I.evaluarSensor({ tipo: "borde" }, e), "mirando al norte desde abajo hay campo");
  e.nave.direccion = "south";
  cierto(I.evaluarSensor({ tipo: "borde" }, e), "mirando al sur desde abajo está el borde");
  e.nave.direccion = "west";
  cierto(I.evaluarSensor({ tipo: "borde" }, e));
});

prueba("I7 · un programa con sensores sobrevive al guardado (validación) y el tope de anidamiento se respeta", () => {
  const prog = [siempre([si({ tipo: "listo" }, [acc("harvest", "h")], [acc("move_forward", "m")]), mientras({ tipo: "es", mineral: "racimo", no: true }, [acc("wait", "w")])])];
  const v = P.validarPrograma(JSON.parse(JSON.stringify(prog)));
  cierto(v !== null, "válido");
  igual(P.capacidadUsada(v), 6, "siempre + si + 2 acciones + mientras + 1 acción");
  cierto(P.validarPrograma([si({ tipo: "es" }, [])]) === null, "`es` sin mineral no vale");
  cierto(P.validarPrograma([siempre([rep(2, [si({ tipo: "listo" }, [])])])]) === null, "tres niveles no");
  cierto(P.validarPrograma([rep(2, [siempre([])])]) === null, "Por siempre adentro no");
});

/* ================================================================== */
console.log("\nRUTINAS");

const def = (rutina, body, id = "def" + rutina) => ({ id, type: "def", rutina, body });
const llamar = (rutina, id = "call" + rutina) => ({ id, type: "call", rutina });

prueba("R1 · una definición sola no produce ningún paso", () => {
  igual(P.expandir([def("A", [acc("move_forward", "m"), acc("harvest", "h")])]).pasos.length, 0);
});

prueba("R2 · Hacer A ejecuta el cuerpo de A, y el intérprete coincide con expandir en los nodoId", () => {
  const cuerpo = [acc("move_forward", "m"), acc("harvest", "h")];
  const prog = [def("A", cuerpo), llamar("A", "raiz")];
  igual(P.expandir(prog).pasos.map((p) => p.nodoId), ["m", "h"], "expandir inlinea el cuerpo resuelto");
  const e = campoDe(2);
  for (const c of e.celdas) c.etapa = 3;
  const r = correrVivo(e, prog);
  igual(r.pasos.map((p) => p.nodoId), ["m", "h"], "el intérprete corre el mismo cuerpo");
});

prueba("R3 · una rutina llamada tres veces ocupa menos memoria que las tres copias", () => {
  const cuerpo = [acc("move_forward", "a"), acc("harvest", "b"), acc("wait", "c")]; // b = 3
  const conRutina = [def("A", cuerpo), llamar("A", "l1"), llamar("A", "l2"), llamar("A", "l3")];
  igual(P.capacidadUsada(conRutina), 7, "1 (def) + 3 (cuerpo) + 3 (llamadas) = 7, como en design.md");
  const copiasInline = [...cuerpo, ...cuerpo, ...cuerpo];
  igual(P.capacidadUsada(copiasInline), 9, "tres copias sueltas = 9");
  cierto(P.capacidadUsada(conRutina) < P.capacidadUsada(copiasInline), "la rutina pesa menos que las copias");
});

prueba("R4 · la recursión directa corre, nunca cuelga, y termina sola en el tope de profundidad", () => {
  const prog = [def("A", [acc("move_forward", "m"), llamar("A", "otra")]), llamar("A", "raiz")];
  const e = campoDe(2);
  for (const c of e.celdas) c.etapa = 3;
  const r = correrVivo(e, prog, { tope: 200 });
  igual(r.pasos.length, 32, "el tope de llamadas anidadas corta a las 32 acciones");
  cierto(r.pasos.every((p) => p.tipo === "move_forward"), "todas fueron la acción del cuerpo, nunca un cuelgue");
  cierto(r.terminado, "la corrida se desarma sola");
});

prueba("R5 · la recursión indirecta A→B→A también corre y termina sola", () => {
  const prog = [
    def("A", [acc("move_forward", "ma"), llamar("B", "aLlamaB")]),
    def("B", [acc("harvest", "hb"), llamar("A", "bLlamaA")]),
    llamar("A", "raiz"),
  ];
  const e = campoDe(2);
  for (const c of e.celdas) c.etapa = 3;
  const r = correrVivo(e, prog, { tope: 200 });
  igual(r.pasos.length, 32, "el tope de llamadas anidadas es el mismo, sin importar cuántas rutinas se turnan");
  cierto(r.terminado);
});

prueba("R6 · Mi rutina A = [Hacer A] sólo da tics, nunca una acción, y se desarma sola", () => {
  const prog = [def("A", [llamar("A", "otra")]), llamar("A", "raiz")];
  const e = campoDe(2);
  const r = correrVivo(e, prog, { tope: 200 });
  igual(r.pasos.length, 32, "32 llamadas apiladas, 32 tics al desarmarse");
  cierto(r.pasos.every((p) => p.tipo === "tick"), "ninguna acción: la llamada vacía cuesta un tic, no cuelga");
  cierto(r.terminado);
});

prueba("R7 · `def` sólo va en la raíz, llamar a una letra sin definir es un no-op válido, y cada rutina tiene su propio tope de anidamiento", () => {
  cierto(P.validarPrograma([llamar("A", "x")]) !== null, "Hacer A sin ninguna Mi rutina A definida sigue siendo válido");
  cierto(P.validarPrograma([{ id: "y", type: "call", rutina: "Z" }]) === null, "una letra que no sea A/B/C no vale");

  const e = campoDe(2);
  const r = correrVivo(e, [llamar("A", "x")], { tope: 5 });
  igual(r.pasos.map((p) => p.tipo), ["tick"], "llamar a una letra sin definir: un tic, y listo");
  cierto(r.terminado);

  cierto(
    P.validarPrograma([def("A", [si({ tipo: "listo" }, [rep(3, [llamar("B", "hb")], "r")])])]) !== null,
    "Si [Repetir [Hacer B]] adentro de una rutina: dos niveles, sí",
  );
  cierto(
    P.validarPrograma([
      def("A", [si({ tipo: "listo" }, [rep(3, [si({ tipo: "listo" }, [acc("move_forward", "m")], undefined, "si2")], "r")])]),
    ]) === null,
    "un tercer nivel adentro de una rutina, no",
  );
  cierto(P.validarPrograma([rep(2, [def("A", [])], "r")]) === null, "Mi rutina adentro de otro bloque no vale: sólo en la raíz");
});

prueba("R8 · un campo v2 con def/call migra a v3: la rutina sale a `rutinas`, la llamada queda en `programa`", () => {
  const prog = [def("A", [acc("move_forward", "m")]), llamar("A", "raiz")];
  const base = M.estadoInicial(azar);
  const { nave: _nave, ...guardado } = base;
  guardado.schemaVersion = 2;
  guardado.programa = JSON.parse(JSON.stringify(prog));
  const e = A.validarCampo(guardado);
  cierto(e !== null, "el campo con rutinas se lee");
  igual(e.schemaVersion, 3, "migra a v3");
  igual(e.programa.map((n) => n.type), ["call"], "la llamada queda colgando del verde");
  igual(e.rutinas.map((n) => n.type), ["def"], "la definición sale al lienzo");
});

/* ================================================================== */
console.log("\nEL LIENZO");

prueba("L1 · cortarDesde corta la cadena en dos por el id, y null si no está", () => {
  const cadena = [acc("move_forward", "a"), acc("turn_left", "b"), acc("harvest", "c")];
  const corte = P.cortarDesde(cadena, "b");
  igual(corte.arriba.map((n) => n.id), ["a"]);
  igual(corte.agarrado.map((n) => n.id), ["b", "c"]);
  igual(P.cortarDesde(cadena, "zzz"), null, "un id que no está: null");
});

prueba("L2 · cortarEn corta adentro de una cavidad sin tocar el resto del árbol", () => {
  const prog = [
    acc("move_forward", "a"),
    rep(2, [acc("harvest", "h"), acc("turn_right", "g"), acc("wait", "w")], "r"),
  ];
  const corte = P.cortarEn(prog, "g");
  igual(corte.agarrado.map((n) => n.id), ["g", "w"], "se lleva el bloque y todo lo que cuelga debajo, DENTRO de la cavidad");
  igual(corte.restante[0].id, "a", "lo de afuera de la cavidad no se toca");
  igual(corte.restante[1].body.map((n) => n.id), ["h"], "adentro de la cavidad sólo queda lo de arriba del corte");
  igual(P.cortarEn(prog, "zzz"), null, "un id que no está en ningún lado: null");
});

prueba("L3 · colocarCadena empalma una cadena entera antes de un bloque, en orden", () => {
  const base = [acc("move_forward", "a"), acc("harvest", "b")];
  const cadena = [acc("turn_left", "x"), acc("turn_right", "y")];
  const salida = P.colocarCadena(base, cadena, { tipo: "antes", id: "b" });
  igual(salida.map((n) => n.id), ["a", "x", "y", "b"]);
});

prueba("L4 · colocarCadena pega al final, en orden", () => {
  const base = [acc("move_forward", "a")];
  const cadena = [acc("turn_left", "x"), acc("turn_right", "y")];
  igual(P.colocarCadena(base, cadena, { tipo: "final" }).map((n) => n.id), ["a", "x", "y"]);
});

prueba("L5 · colocarCadena rechaza la cadena ENTERA y devuelve la misma referencia si el eslabón más alto no entra", () => {
  const base = [rep(2, [acc("harvest", "h")], "r")];
  // altura 2: Repetir[Si[avanzar]]. Sola, a profundidad 1 (dentro de "r"),
  // 1 + 2 = 3 > maxProfundidad(2): no entra.
  const alto = rep(2, [si({ tipo: "listo" }, [acc("move_forward", "m")])], "r2");
  const cadena = [acc("turn_left", "x"), alto]; // "x" solo sí entraría
  const salida = P.colocarCadena(base, cadena, { tipo: "dentro", id: "r" });
  cierto(salida === base, "ni siquiera el primer bloque de la cadena se coloca: todo o nada");
});

prueba("L6 · cabeA con una cadena: decide el eslabón MÁS ALTO, no el primero", () => {
  const bajo = acc("move_forward", "a");
  const alto = rep(2, [si({ tipo: "listo" }, [acc("harvest", "h")])], "r"); // altura 2
  cierto(P.cabeA([bajo, alto], 0), "al nivel del lienzo (profundidad 0): 0+2<=2, entra");
  cierto(!P.cabeA([bajo, alto], 1), "a profundidad 1: 1+2>2, no entra, aunque `bajo` solo sí entraría");
  cierto(P.cabeA(bajo, 1), "de referencia: el nodo bajo SOLO sí entra a profundidad 1");
});

prueba("L7 · cabeA rechaza una cadena que lleva un Por siempre o una Mi rutina fuera del nivel del lienzo", () => {
  const siempreNodo = { id: "s", type: "forever", body: [] };
  const defNodo = def("A", []);
  cierto(P.cabeA([acc("move_forward", "a"), siempreNodo], 0), "Por siempre en la cadena, al nivel del lienzo: sí");
  cierto(!P.cabeA([acc("move_forward", "a"), siempreNodo], 1), "la misma cadena adentro de un contenedor: no");
  cierto(P.cabeA([defNodo], 0), "una rutina, al nivel del lienzo: sí");
  cierto(!P.cabeA([acc("move_forward", "a"), defNodo], 1), "una rutina en la cadena, adentro de un contenedor: no");
});

prueba("L8 · capacidadDeLienzo suma la cadena verde, las rutinas y las pilas sueltas", () => {
  const programa = [
    rep(4, [acc("move_forward", "a"), acc("harvest", "b")], "r"), // 3
    llamar("A", "call1"), // 1
    { id: "cm", type: "counter_add" }, // 1
  ]; // total 5
  const rutinas = [def("A", [acc("move_forward", "m"), acc("harvest", "h"), acc("wait", "w")])]; // 1 + 3 = 4
  const pilasSueltas = [
    { nodos: [acc("turn_left", "gi"), acc("harvest", "co")] }, // 2
    { nodos: [rep(2, [acc("wait", "es")], "r2")] }, // 2
  ]; // total 4
  igual(P.capacidadDeLienzo(programa, rutinas, pilasSueltas), 13, "5 + 4 + 4 = 13, el ejemplo de design.md");
});

prueba("L9 · PROGRESION §11 sigue valiendo con la rutina en el lienzo: 1 vez la definición + 3 llamadas < 3 copias", () => {
  const cuerpo = [acc("move_forward", "a"), acc("harvest", "b"), acc("wait", "c")]; // 3
  const rutinas = [def("A", cuerpo)]; // 1 + 3 = 4
  const programa = [llamar("A", "l1"), llamar("A", "l2"), llamar("A", "l3")]; // 3
  const total = P.capacidadDeLienzo(programa, rutinas, []);
  igual(total, 7, "1 (def, una sola vez en rutinas) + 3 (cuerpo) + 3 (tres llamadas) = 7");
  const copiasInline = [...cuerpo, ...cuerpo, ...cuerpo];
  igual(P.capacidadUsada(copiasInline), 9, "tres copias sueltas = 9");
  cierto(total < P.capacidadUsada(copiasInline), "la rutina en el lienzo sigue pesando menos que las copias, 7 < 9");
});

prueba("L10 · la migración v2→v3 conserva el orden y produce los MISMOS pasos que el programa plano original (con rutinas, Hacer A con N, y Contador)", () => {
  // Un programa de cut 4: `Mi rutina A`, `Hacer A con N` y `Contador +1`
  // mezclados con acciones sueltas — el snapshot que la persistencia-lienzo
  // spec pide verificar explícitamente.
  const plano = [
    acc("move_forward", "m1"),
    def("A", [acc("harvest", "h")]),
    acc("turn_right", "g"),
    { id: "call1", type: "call", rutina: "A", veces: 3 }, // Hacer A con N
    { id: "cm1", type: "counter_add" },
    acc("wait", "w"),
  ];
  const pasosOriginal = P.expandir(plano).pasos.map((p) => p.nodoId);

  const base = M.estadoInicial(azar);
  const { nave: _nave, ...guardado } = base;
  guardado.schemaVersion = 2;
  guardado.programa = JSON.parse(JSON.stringify(plano));
  const e = A.validarCampo(guardado);
  cierto(e !== null, "un v2 con rutinas + Hacer A con N + Contador se lee");
  igual(
    e.programa.map((n) => n.id),
    ["m1", "g", "call1", "cm1", "w"],
    "el orden original, sin el def, se conserva EN SU LUGAR",
  );
  igual(e.rutinas.map((n) => n.id), ["defA"], "la definición sale a rutinas");

  const pasosMigrado = P.expandir(e.programa, undefined, undefined, e.rutinas).pasos.map((p) => p.nodoId);
  igual(pasosMigrado, pasosOriginal, "correr la partida migrada produce la MISMA secuencia de pasos que la original");

  // Vivo, con el intérprete (el camino real del juego): mismos nodoId de
  // acción en el mismo orden, tanto para el programa original como el
  // migrado — "se comporta igual" no es sólo expandir().
  const eOriginal = M.estadoInicial(azar);
  const itOriginal = I.crearInterprete(plano, eOriginal);
  const pasosVivosOriginal = [];
  for (let n = 0; n < 50; n++) {
    const p = itOriginal.siguiente();
    if (!p) break;
    pasosVivosOriginal.push(p);
  }
  const itMigrado = I.crearInterprete(e.programa, e);
  const pasosVivosMigrado = [];
  for (let n = 0; n < 50; n++) {
    const p = itMigrado.siguiente();
    if (!p) break;
    pasosVivosMigrado.push(p);
  }
  igual(
    pasosVivosMigrado.map((p) => [p.nodoId, p.tipo]),
    pasosVivosOriginal.map((p) => [p.nodoId, p.tipo]),
    "el intérprete corre la partida migrada IDÉNTICA a la original, tick a tick",
  );
});

prueba("L11 · clamping: coordenadas fuera de rango o inválidas se recortan, el lienzo ausente no rompe nada, una clave colgante se cae sola, y un nodo roto en una pila suelta descarta la partida entera", () => {
  const base = M.estadoInicial(azar);
  const { nave: _nave, ...guardado } = base;
  guardado.schemaVersion = 3;
  guardado.rutinas = [];
  guardado.pilasSueltas = [{ id: "p1", x: NaN, y: 999999, nodos: [acc("move_forward", "m")] }];
  // `lienzo` queda ausente (undefined): no puede romper la validación.
  const e = A.validarCampo(guardado);
  cierto(e !== null, "un x/y fuera de rango o NaN no descarta la partida");
  igual(e.pilasSueltas[0].x, 0, "NaN se recorta a 0");
  igual(e.pilasSueltas[0].y, 4000, "un y gigantesco se recorta al máximo del lienzo");
  cierto(typeof e.lienzo.idInicio === "string" && e.lienzo.idInicio.length > 0, "sin lienzo, se regenera uno entero");

  const conRutina = M.estadoInicial(azar);
  const { nave: _n2, ...g2 } = conRutina;
  g2.schemaVersion = 3;
  g2.rutinas = [def("A", [])];
  g2.pilasSueltas = [];
  g2.lienzo = { idInicio: 12345, inicio: { x: 0, y: 0 }, rutinas: { "no-existe": { x: 1, y: 1 } } };
  const e2 = A.validarCampo(g2);
  cierto(e2 !== null);
  cierto(
    typeof e2.lienzo.idInicio === "string" && e2.lienzo.idInicio.length > 0,
    "un idInicio inválido se regenera en vez de tirar la partida",
  );
  igual(Object.keys(e2.lienzo.rutinas), [g2.rutinas[0].id], "sólo sobrevive la clave de la rutina viva, la colgante se cae sola");

  const g3 = { ...g2, pilasSueltas: [{ id: "roto", x: 0, y: 0, nodos: [{ id: "x", type: "no_existe" }] }] };
  igual(A.validarCampo(g3), null, "un nodo mal formado en una pila suelta descarta TODA la partida");
});

prueba("L12 · el tope de nodos es del LIENZO ENTERO: tres listas, cada una por debajo de 60, pueden sumar más y se rechazan juntas", () => {
  const accs = (n, prefix) => Array.from({ length: n }, (_, i) => acc("wait", prefix + i));
  const base = M.estadoInicial(azar);
  const { nave: _nave, ...guardado } = base;
  guardado.schemaVersion = 3;
  guardado.programa = accs(25, "p");
  guardado.rutinas = [def("A", accs(25, "r"))]; // 1 + 25 = 26
  guardado.pilasSueltas = [{ id: "s1", x: 0, y: 0, nodos: accs(25, "s") }]; // 25
  cierto(A.validarCampo(guardado) === null, "25 + 26 + 25 = 76 > 60: se rechaza aunque cada lista sola entraría");

  guardado.pilasSueltas = [{ id: "s1", x: 0, y: 0, nodos: accs(9, "s") }]; // 25 + 26 + 9 = 60
  cierto(A.validarCampo(guardado) !== null, "exactamente en el tope (60), sí entra");
});

prueba("L13 · cortarEn seguido de colocarCadena de vuelta al mismo lugar es identidad (round-trip)", () => {
  const prog = [
    acc("move_forward", "a"),
    rep(2, [acc("harvest", "h"), acc("turn_right", "g"), acc("wait", "w")], "r"),
    acc("plant", "p"),
  ];
  const corte = P.cortarEn(prog, "g");
  cierto(corte !== null, "el bloque agarrado está en la cavidad de r");
  igual(corte.agarrado.map((n) => n.id), ["g", "w"], "se lleva el bloque y lo que cuelga debajo");
  // Encastrarla de vuelta EXACTAMENTE donde estaba: antes de "w" ya no
  // existe como referencia (se fue con la cadena), así que el lugar
  // equivalente es "dentro de r, después de lo que quedó" — el mismo
  // `despuesDe` que EditorBloques usa para saber "pegado abajo".
  const destino = P.despuesDe(corte.restante, "h");
  const vuelta = P.colocarCadena(corte.restante, corte.agarrado, destino);
  igual(vuelta, prog, "cortar y volver a colocar en el mismo lugar reproduce el árbol original, nodo por nodo");
});

prueba("L14 · una Mi rutina jamás entra como pila suelta, ni siquiera sola: descarta la partida entera", () => {
  const base = M.estadoInicial(azar);
  const { nave: _nave, ...guardado } = base;
  guardado.schemaVersion = 3;
  guardado.rutinas = [];
  guardado.pilasSueltas = [{ id: "p1", x: 10, y: 10, nodos: [def("A", [acc("move_forward", "m")])] }];
  igual(A.validarCampo(guardado), null, "un def dentro de pilasSueltas invalida TODO el snapshot, no sólo esa pila");

  // De referencia: la MISMA rutina, en `rutinas` en vez de `pilasSueltas`, sí vale.
  guardado.rutinas = [def("A", [acc("move_forward", "m")])];
  guardado.pilasSueltas = [];
  cierto(A.validarCampo(guardado) !== null, "la misma definición, en rutinas, sí es válida");
});

prueba("L15 · soltar una cadena agarrada como pila nueva conserva la identidad de los nodos y la capacidad total del lienzo", () => {
  const programa = [
    acc("move_forward", "a"),
    rep(2, [acc("harvest", "h")], "r"),
    acc("plant", "p"),
  ];
  const rutinas = [def("A", [acc("wait", "w")])];
  const pilasSueltas = [];
  const antes = P.capacidadDeLienzo(programa, rutinas, pilasSueltas);

  // El mismo corte que hace `onSoltarCadena` (AutomatizacionPage.tsx): se
  // agarra "r" — y con él, todo lo que cuelga debajo en la MISMA cadena
  // ("p", su hermano de abajo) — y se envuelve en una `Pila` NUEVA: el id
  // de la pila es nuevo, los NODOS no.
  const corte = P.cortarEn(programa, "r");
  cierto(corte !== null);
  const nuevaPila = { id: "pila-nueva-999", x: 120, y: 340, nodos: corte.agarrado };
  const programaSinR = corte.restante;
  const pilasSueltasConNueva = [...pilasSueltas, nuevaPila];

  igual(
    corte.agarrado.map((n) => n.id),
    ["r", "p"],
    "agarrar r se lleva también lo que cuelga debajo en la misma cadena (p), como cualquier arrastre",
  );
  cierto(
    corte.agarrado[0] === programa[1] && corte.agarrado[1] === programa[2],
    "las MISMAS referencias de nodo viajan a la pila nueva: ninguna reconstrucción cambia su identidad",
  );

  const despues = P.capacidadDeLienzo(programaSinR, rutinas, pilasSueltasConNueva);
  igual(despues, antes, "mover bloques del lienzo a una pila suelta nueva no cambia la capacidad total usada");
});

/* ================================================================== */
console.log("\nCONTADOR Y TAMAÑO DEL CAMPO");

const contadorMas = (id = "cm") => ({ id, type: "counter_add" });
const contadorCero = (id = "cz") => ({ id, type: "counter_reset" });
const llamarCon = (rutina, veces, id = "callCon" + rutina) => ({ id, type: "call", rutina, veces });

prueba("C1 · Contador +1 no produce evento de campo y cuesta un turno entero", () => {
  const e = campoDe(2);
  const r = correrVivo(e, [contadorMas()]);
  igual(r.pasos.map((p) => p.tipo), ["counter"]);
  igual(r.eventos.length, 0, "counter_add nunca llega a ejecutarPaso");
  cierto(r.terminado);
});

prueba("C2 · el contador arranca en 0 en cada corrida", () => {
  const e = campoDe(2);
  const it1 = I.crearInterprete([contadorMas()], e);
  igual(it1.contador, 0, "arranca en 0");
  it1.siguiente();
  igual(it1.contador, 1, "sumó uno");
  const it2 = I.crearInterprete([contadorMas()], e);
  igual(it2.contador, 0, "una corrida nueva vuelve a arrancar en 0, no arrastra la anterior");
});

prueba("C3 · Contador = 0 reinicia el contador y no toca el campo", () => {
  const e = campoDe(2);
  const it = I.crearInterprete([contadorMas("a"), contadorMas("b"), contadorCero("z")], e);
  it.siguiente();
  it.siguiente();
  igual(it.contador, 2);
  const saldo = JSON.stringify(e.saldos);
  const celdas = JSON.stringify(e.celdas);
  it.siguiente();
  igual(it.contador, 0, "vuelve a cero");
  igual(JSON.stringify(e.saldos), saldo, "el saldo no se mueve");
  igual(JSON.stringify(e.celdas), celdas, "el campo no se mueve");
});

prueba("C4 · el sensor `contador es N` es igualdad exacta, sin operadores de comparación", () => {
  const e = campoDe(2);
  cierto(!I.evaluarSensor({ tipo: "contador", valor: 3 }, e, 2), "2 no es 3");
  cierto(I.evaluarSensor({ tipo: "contador", valor: 3 }, e, 3), "3 es 3");
  cierto(!I.evaluarSensor({ tipo: "contador", valor: 3 }, e, 4), "4 no es 3");
  cierto(I.evaluarSensor({ tipo: "contador", valor: 3, no: true }, e, 4), "negado: 4 no es 3, así que es verdadero");
  cierto(P.validarPrograma([si({ tipo: "menorQue", valor: 1 }, [])]) === null, "no existe ningún sensor de comparación");
});

prueba("C5 · `contador es tamaño del campo` es verdadero al llegar al lado exacto", () => {
  const e3 = campoDe(3);
  cierto(!I.evaluarSensor({ tipo: "contador", valor: "lado" }, e3, 2), "2 en una isla 3x3: no");
  cierto(I.evaluarSensor({ tipo: "contador", valor: "lado" }, e3, 3), "3 en una isla 3x3: sí");
  const e4 = campoDe(4);
  cierto(!I.evaluarSensor({ tipo: "contador", valor: "lado" }, e4, 3), "3 en una isla 4x4: no");
  cierto(I.evaluarSensor({ tipo: "contador", valor: "lado" }, e4, 4), "4 en una isla 4x4: sí");
});

/** Recorre el borde inferior de un campo NxN con `tamaño del campo` como
 *  tope: el criterio de aceptación de PROGRESION.md §11, "el mismo
 *  programa con tamaño del campo recorre la 3×3 y la 4×4". */
function programaTamanoDeCampo() {
  return [
    mientras(
      { tipo: "contador", valor: "lado", no: true },
      [acc("harvest", "cosechar"), acc("move_forward", "avanzar"), contadorMas("sumar")],
      "recorrido",
    ),
  ];
}

prueba("C6 · CRITERIO DE ACEPTACIÓN: el mismo programa con tamaño del campo recorre la 3×3 y la 4×4", () => {
  const e3 = campoDe(3);
  for (const c of e3.celdas) c.etapa = 3;
  const r3 = correrVivo(e3, programaTamanoDeCampo(), { tope: 200 });
  igual(r3.eventos.filter((x) => x.tipo === "harvest").length, 3, "recorre las 3 baldosas de la 3×3");
  cierto(r3.terminado, "se detiene sola en la 3×3");

  const e4 = campoDe(4);
  for (const c of e4.celdas) c.etapa = 3;
  const r4 = correrVivo(e4, programaTamanoDeCampo(), { tope: 200 });
  igual(r4.eventos.filter((x) => x.tipo === "harvest").length, 4, "el MISMO programa recorre las 4 baldosas de la 4×4");
  cierto(r4.terminado, "se detiene sola en la 4×4");
});

prueba("C7 · Hacer A con N repite el cuerpo N veces y sigue costando 1 de memoria", () => {
  const cuerpo = [acc("move_forward", "m")];
  const prog = [def("A", cuerpo), llamarCon("A", 3, "raiz")];
  igual(P.capacidadUsada(prog), 3, "1 (def) + 1 (cuerpo) + 1 (la llamada, con o sin N) = 3");
  const e = campoDe(2);
  const r = correrVivo(e, prog, { tope: 50 });
  igual(r.pasos.filter((p) => p.tipo === "move_forward").length, 3, "corrió el cuerpo tres veces");
  cierto(r.terminado);
});

prueba("C8 · fuera de rango se rechaza; times/veces/valor legados y case 19 siguen resolviendo", () => {
  // Case 19, con el tipo Veces ya ensanchado: sigue rechazando 99 y aceptando 3.
  igual(P.validarPrograma([rep(99, [acc("move_forward", "a")])]), null, "case 19 sigue rechazando times: 99");
  cierto(P.validarPrograma([rep(3, [acc("move_forward", "a")])]) !== null, "case 19 sigue aceptando times: 3");

  // `times`/`veces`/`sensor.valor` fuera de las opciones: rechazados.
  igual(P.validarPrograma([{ id: "r", type: "repeat", times: 7, body: [] }]), null, "times fuera de opcionesRepetir");
  igual(
    P.validarPrograma([def("A", []), { id: "c", type: "call", rutina: "A", veces: 7 }]),
    null,
    "veces fuera de opcionesRepetir",
  );
  igual(
    P.validarPrograma([si({ tipo: "contador", valor: 9 }, [])]),
    null,
    "sensor.valor fuera de opcionesContador",
  );

  // `"lado"` vale para los tres.
  cierto(P.validarPrograma([{ id: "r", type: "repeat", times: "lado", body: [] }]) !== null, "times: lado, sí");
  cierto(
    P.validarPrograma([def("A", []), { id: "c", type: "call", rutina: "A", veces: "lado" }]) !== null,
    "veces: lado, sí",
  );
  cierto(P.validarPrograma([si({ tipo: "contador", valor: "lado" }, [])]) !== null, "sensor.valor: lado, sí");

  // Legado: un `call` sin `veces` sigue siendo válido (Hacer A liso).
  cierto(P.validarPrograma([def("A", []), llamar("A", "x")]) !== null, "Hacer A sin número sigue siendo válido");
});

/* ================================================================== */
console.log("\nEL CAMPO QUE CRECE");

prueba("E1 · comprar tierra agranda el campo un lado", () => {
  const e = M.estadoInicial(azar);
  e.saldos = rico();
  igual(e.lado, 1);
  cierto(M.comprar(e, "campo", azar));
  igual(e.lado, 2);
  igual(e.celdas.length, 4);
});

prueba("E2 · el muelle NO se mueve al crecer, y lo viejo se conserva", () => {
  const e = M.estadoInicial(azar);
  e.saldos = rico();
  const idxMuelle = M.indice(e, e.lado - 1, 0);
  e.celdas[idxMuelle] = { etapa: 2, variante: "prisma", restanteMs: 1234 };
  M.comprar(e, "campo", azar);
  igual(e.nave, { fila: e.lado - 1, col: 0, direccion: "north" }, "la nave sigue abajo a la izquierda");
  const nuevo = e.celdas[M.indice(e, e.lado - 1, 0)];
  igual({ etapa: nuevo.etapa, variante: nuevo.variante }, { etapa: 2, variante: "prisma" },
    "la baldosa del muelle es la misma de antes");
});

prueba("E3 · un programa que servía sigue sirviendo después de expandir", () => {
  /* Ésta es la razón de que la tierra nueva salga arriba y a la derecha.
     Si el origen se corriera, todo programa guardado quedaría desfasado
     una baldosa y el chico vería fallar su rutina sin motivo visible. */
  const e = campoDe(2);
  for (const c of e.celdas) c.etapa = 3;
  const prog = [rep(4, [acc("move_forward", "a"), acc("harvest", "b"), acc("turn_right", "c")])];
  igual(correr(e, prog).filter((x) => x.tipo === "harvest").length, 4);

  const e2 = campoDe(2);
  e2.saldos = rico();
  M.comprar(e2, "campo", azar);
  for (const c of e2.celdas) c.etapa = 3;
  const evs = correr(e2, prog);
  igual(evs.filter((x) => x.tipo === "harvest").length, 4, "el mismo programa sigue cosechando 4");
  igual(evs.filter((x) => x.tipo === "bump").length, 0, "y sin chocar");
});

prueba("E4 · el campo tiene tope y no se puede comprar más allá", () => {
  const e = M.estadoInicial(azar);
  e.saldos = rico(1e9);
  for (let i = 0; i < 20; i++) M.comprar(e, "campo", azar);
  igual(e.lado, B.AJUSTES.ladoMaximo);
  igual(e.celdas.length, B.AJUSTES.ladoMaximo ** 2);
});

/* ================================================================== */
console.log("\nMINERALES");

prueba("M1 · cada mineral paga a su propio contador, con su valor", () => {
  const e = campoDe(2);
  const idx = M.indice(e, e.lado - 1, 0);
  e.celdas[idx] = { etapa: 3, variante: "racimo", restanteMs: 0 };
  const [ev] = correr(e, [acc("harvest")]);
  igual(ev.tipo, "harvest");
  igual(ev.mineral, "racimo");
  igual(ev.premio, B.MINERALES.racimo.valor);
  igual(e.saldos.racimo, B.MINERALES.racimo.valor);
  igual(e.saldos.punta, 0, "la chispa no se entera");
  igual(e.cosechados.racimo, 1);
});

prueba("M2 · cosechar cuarzo verde lo rompe; la chispa verde perdona", () => {
  const e = campoDe(2);
  const idx = M.indice(e, e.lado - 1, 0);
  e.celdas[idx] = { etapa: 2, variante: "racimo", restanteMs: 500 };
  const [ev] = correr(e, [acc("harvest")]);
  igual(ev.tipo, "break");
  igual(ev.mineral, "racimo");
  igual(e.celdas[idx].etapa, 0, "vuelve a cero");
  igual(e.saldos.racimo, 0, "y no paga");
  cierto(e.celdas[idx].variante !== null, "el cuarzo rebrota solo");
  e.celdas[idx] = { etapa: 2, variante: "punta", restanteMs: 500 };
  const [ev2] = correr(e, [acc("harvest", "h2")]);
  igual(ev2.tipo, "empty_harvest");
  igual(e.celdas[idx].etapa, 2, "la chispa sigue creciendo como si nada");
});

prueba("M3 · el prisma no rebrota: hay que plantarlo, y plantar cuesta", () => {
  const e = campoDe(3);
  const idx = M.indice(e, e.lado - 1, 0);
  e.celdas[idx] = { etapa: 3, variante: "prisma", restanteMs: 0 };
  correr(e, [acc("harvest")]);
  igual(e.saldos.prisma, B.MINERALES.prisma.valor);
  igual(e.celdas[idx].variante, null, "queda tierra vacía");
  e.saldos.punta = 0;
  igual(correr(e, [plantar("prisma", "p1")])[0].tipo, "plant_fail", "sin chispas no se planta");
  igual(e.celdas[idx].variante, null);
  e.saldos.punta = 10;
  const [ev] = correr(e, [plantar("prisma", "p2")]);
  igual(ev.tipo, "plant");
  igual(e.celdas[idx].variante, "prisma");
  igual(e.celdas[idx].etapa, 0);
  igual(e.saldos.punta, 10 - B.MINERALES.prisma.semilla.punta, "la semilla se descuenta");
  igual(correr(e, [plantar("prisma", "p3")])[0].tipo, "plant_fail", "donde ya hay algo, no");
});

prueba("M4 · cada mineral llega con su era: el prisma no existe antes de la 3x3", () => {
  const e = campoDe(2);
  cierto(!M.mineralDisponible(e, "prisma"));
  igual(M.plantables(e), []);
  e.saldos.punta = 50;
  e.celdas[M.indice(e, e.lado - 1, 0)].variante = null;
  igual(correr(e, [plantar("prisma")])[0].tipo, "plant_fail");
  igual(M.plantables(campoDe(3)), ["prisma"]);
  igual(M.plantables(campoDe(4)), ["prisma", "estrella"]);
});

prueba("M5 · dos estrellas pegadas no crecen; separadas sí", () => {
  const e = campoDe(4);
  for (const c of e.celdas) { c.variante = null; c.etapa = 0; c.restanteMs = 0; }
  const a = M.indice(e, 3, 0), b = M.indice(e, 3, 1), lejos = M.indice(e, 0, 3);
  const t = M.msPorEtapaDe(e, "estrella");
  e.celdas[a] = { etapa: 0, variante: "estrella", restanteMs: t };
  e.celdas[b] = { etapa: 0, variante: "estrella", restanteMs: t };
  e.celdas[lejos] = { etapa: 0, variante: "estrella", restanteMs: t };
  const paso = B.AJUSTES.dtMaximoMs;
  const n = Math.ceil((t * 3) / paso) + 3;
  for (let i = 0; i < n; i++) M.avanzarMundo(e, paso);
  igual(e.celdas[a].etapa, 0, "pegada: no creció");
  igual(e.celdas[b].etapa, 0);
  igual(e.celdas[lejos].etapa, 3, "sola: maduró");
  e.saldos.racimo = 100;
  e.nave = { fila: 2, col: 0, direccion: "north" }; // vecina de (3,0)
  igual(correr(e, [plantar("estrella")])[0].tipo, "plant_fail", "plantar al lado de otra tampoco");
});

prueba("M6 · evolucionar sube el valor, apura el crecimiento y se paga con el propio mineral y el anterior", () => {
  const e = campoDe(2);
  igual(M.valorDe(e, "racimo"), B.MINERALES.racimo.valor);
  const precio = B.precioEvolucion("racimo", 1);
  cierto(precio.racimo > 0 && precio.punta > 0, "cuarzo y chispas");
  e.saldos.racimo = precio.racimo;
  e.saldos.punta = precio.punta - 1;
  cierto(!M.evolucionar(e, "racimo"), "sin chispas suficientes, no");
  e.saldos.punta = precio.punta;
  cierto(M.evolucionar(e, "racimo"));
  igual(e.niveles.racimo, 2);
  igual(e.saldos.racimo, 0);
  cierto(M.valorDe(e, "racimo") > B.MINERALES.racimo.valor, "vale más");
  cierto(M.msPorEtapaDe(e, "racimo") < M.msPorEtapaDe({ ...e, niveles: M.porMineral(1) }, "racimo"), "y crece más rápido");
  for (let i = 0; i < 10; i++) { e.saldos = rico(1e6); M.evolucionar(e, "racimo"); }
  igual(e.niveles.racimo, B.EVOLUCION.nivelMaximo, "tope");
});

prueba("M7 · el cuarzo crece más lento que la chispa, y en 1x1 sólo rebrota chispa", () => {
  const e = campoDe(2);
  cierto(M.msPorEtapaDe(e, "racimo") > M.msPorEtapaDe(e, "punta"));
  const e1 = M.estadoInicial(azar);
  const idx = M.indice(e1, 0, 0);
  for (let i = 0; i < 30; i++) {
    e1.celdas[idx].etapa = 3;
    correr(e1, [acc("harvest", "h" + i)]);
    igual(e1.celdas[idx].variante, "punta");
  }
});

prueba("M8 · un snapshot de la versión 1 se lee como versión 3 sin perder nada", () => {
  const celda = { etapa: 1, variante: "punta", restanteMs: 100 };
  const viejo = {
    schemaVersion: 1, lado: 2, celdas: [celda, celda, celda, celda], saldo: 17, acumulado: 40,
    mejoras: { capacidad: 1 }, programa: [], mejorTasa: 3, cosechas: [1000, 2000], relojMs: 5000,
  };
  const e = A.validarCampo(viejo);
  cierto(e !== null, "se lee");
  igual(e.schemaVersion, 3, "migra a v3 (antes: 2)");
  igual(e.saldos, { punta: 17, racimo: 0, prisma: 0, estrella: 0 }, "el saldo pasa a chispas");
  igual(e.cosechas, [{ t: 1000, v: 1 }, { t: 2000, v: 1 }]);
  igual(e.niveles, { punta: 1, racimo: 1, prisma: 1, estrella: 1 });
  igual(e.mejoras.capacidad, 1);
  const { nave: _n, ...guardado } = e;
  guardado.celdas = guardado.celdas.map((c, i) => (i === 0 ? { etapa: 0, variante: null, restanteMs: 0 } : c));
  const e2 = A.validarCampo(JSON.parse(JSON.stringify(guardado)));
  cierto(e2 !== null && e2.celdas[0].variante === null, "la tierra vacía también viaja");
});

/* ================================================================== */
console.log("\nECONOMÍA");

prueba("22 · comprar descuenta una vez y sube el nivel", () => {
  const e = M.estadoInicial(azar);
  e.saldos.punta = 100;
  cierto(M.comprar(e, "capacidad"));
  igual(M.nivel(e, "capacidad"), 1);
  igual(e.saldos.punta, 100 - B.precioMejora("capacidad", 0).punta);
  igual(M.capacidad(e), B.AJUSTES.capacidadInicial + 1);
});

prueba("23 · sin saldo no se compra y no se descuenta nada", () => {
  const e = M.estadoInicial(azar);
  e.saldos.punta = 1;
  cierto(!M.comprar(e, "capacidad"));
  igual(e.saldos.punta, 1);
  igual(M.nivel(e, "capacidad"), 0);
});

prueba("24 · cada ranura de memoria se encarece", () => {
  let previo = 0;
  for (let n = 0; n < 5; n++) {
    const p = B.precioMejora("capacidad", n).punta;
    cierto(p > previo, "el nivel " + n + " tiene que costar más que el anterior");
    previo = p;
  }
});

prueba("25 · las mejoras de velocidad y crecimiento tienen piso", () => {
  const e = M.estadoInicial(azar);
  e.mejoras.velocidad = 99;
  e.mejoras.crecimiento = 99;
  cierto(M.msPorAccion(e) >= B.AJUSTES.msPorAccionMinimo);
  cierto(M.msPorEtapa(e) >= B.AJUSTES.msPorEtapaMinimo);
});

prueba("26 · la tienda se revela de a poco y gastar no esconde nada", () => {
  const e = M.estadoInicial(azar);
  /* La primera categoría es TIERRA, no memoria: con el campo en 1x1 más
     ranuras no sirven para nada hasta que haya a dónde ir. */
  igual(M.reveladas(e), ["campo"], "el primer día se ve UNA categoría");
  e.acumulado = B.AJUSTES.revelado.capacidad.acumulado;
  cierto(!M.reveladas(e).includes("capacidad"), "en 1x1 la memoria no sirve: no se muestra todavía");
  e.saldos = rico();
  M.comprar(e, "campo", azar);
  cierto(M.reveladas(e).includes("capacidad"), "en 2x2 sí");
  e.saldos = M.porMineral(0); // gastó todo
  cierto(M.reveladas(e).includes("capacidad"), "gastar no puede volver a esconderla");
});

prueba("27 · el saldo sólo se mueve por cosecha válida", () => {
  const e = campoDe(2);
  for (const c of e.celdas) c.etapa = 0; // ninguna madura
  correr(e, [acc("turn_right", "a"), acc("move_forward", "b"), acc("harvest", "c")]);
  igual(e.saldos.punta, 0, "girar, chocar y cosechar en vacío no pagan");
});

prueba("28 · el récord pide muestra mínima antes de publicarse", () => {
  const e = M.estadoInicial(azar);
  e.relojMs = 30_000;
  e.cosechas = [1000, 2000].map((t) => ({ t, v: 1 }));
  igual(M.actualizarRecord(e), 0, "dos cosechas no fijan un récord");
  e.cosechas = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ t: n * 1000, v: 1 }));
  cierto(M.actualizarRecord(e) > 0);
});

prueba("29 · las cosechas viejas salen de la ventana de la tasa", () => {
  const e = M.estadoInicial(azar);
  e.relojMs = B.AJUSTES.ventanaTasaMs * 3;
  e.cosechas = [0, 1000, 2000].map((t) => ({ t, v: 1 })); // todas fuera de la ventana
  igual(M.tasaReciente(e), 0);
  igual(e.cosechas.length, 0, "y se podan, no se acumulan para siempre");
});

/* ================================================================== */
const total = ok + fallos;
console.log(
  "\n" + (fallos === 0 ? "\x1b[32m" : "\x1b[31m") + ok + "/" + total + " pruebas\x1b[0m" +
    (fallos ? "  —  " + fallos + " fallando\n" : "\n"),
);
process.exit(fallos ? 1 : 0);
