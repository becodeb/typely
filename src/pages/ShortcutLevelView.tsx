/**
 * ShortcutLevelView.tsx
 *
 * Generic keyboard-shortcut engine used by every Activity with
 * inputType === "shortcut".
 *
 * REGLA DE SEGURIDAD: todo atajo se demuestra dentro de un entorno VIRTUAL
 * que vive entero en este componente, y se llama a event.preventDefault() en
 * todos los keydown de la fase de captura.
 *
 * PERO eso NO alcanza para todos, y conviene tenerlo claro porque acá se
 * había afirmado lo contrario: hay atajos que el navegador y el sistema se
 * reservan y que una página NO puede interceptar ni frenar. Ctrl+T abre una
 * pestaña de verdad, Ctrl+W CIERRA la pestaña y se lleva puesta la partida,
 * Ctrl+Tab cambia de pestaña y Alt+Tab cambia de ventana. En esos casos el
 * keydown ni siquiera llega a la página, así que tampoco se puede puntuar.
 *
 * Para esos hay UNA forma de capturarlos de verdad, y es la que usa este
 * archivo: la API Keyboard Lock (`navigator.keyboard.lock`), que sólo
 * funciona con la página en PANTALLA COMPLETA. Con eso Ctrl+T, Ctrl+W,
 * Ctrl+N y Ctrl+Tab llegan a la página y el navegador no los ejecuta.
 *
 * Tiene dos límites que conviene conocer antes de tocar esto:
 *   - Es de Chromium (Chrome, Edge, Chromebook). Firefox y Safari no la
 *     tienen, y ahí se cae al teclado de la pantalla, que sigue estando.
 *   - Alt+Tab es del sistema operativo, no del navegador, y NO se puede
 *     capturar con ninguna técnica. Por eso ya no se usa en ningún nivel.
 *
 * Los atajos que sí se pueden frenar sin nada de esto (Ctrl+A/C/V/Z/F/S/Y,
 * Enter, Escape) andan con el teclado real siempre, sin pantalla completa.
 *
 * Virtual environments available:
 *   "text-editor"   — Ctrl+A/C/V/Z/Y/S  (un documento entero: seleccionar,
 *                     copiar, pegar, deshacer, rehacer y guardar)
 *   "browser-tabs"  — Ctrl+T / Ctrl+W / Ctrl+Tab / Ctrl+N  (ventanas Y pestañas)
 *   "find-box"      — Ctrl+F / Escape
 *   "dialog"        — Enter / Escape
 *
 * Quedaron cuatro porque había dos que partían en dos cosas que en la
 * computadora de verdad son una sola:
 *   - El simulador de ventanas ("app-switcher") era una grilla de apps
 *     aparte, así que Ctrl+N abría una "ventana" en una pantalla donde no
 *     había ninguna pestaña y no se veía en qué se diferenciaba de Ctrl+T.
 *   - El editor de documentos ("doc-editor") se llevaba Ctrl+S y Ctrl+Y y
 *     dejaba Ctrl+A/C/V/Z en el otro, así que guardar pasaba en una pantalla
 *     donde no habías escrito nada y rehacer no podía devolver lo que
 *     deshacía el simulador de al lado.
 *
 * OJO al escribir un nivel: el simulador se remonta cuando CAMBIA el
 * escenario, así que un nivel puede ir del navegador al editor pero no
 * puede volver — al volver, el escenario arranca de cero.
 */

import { Monitor, RotateCcw, Star, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Activity, ShortcutDialog, ShortcutScene, ShortcutTab } from "../data/activities";
import { assets } from "../utils/assets";
import { getGameplayBackground } from "../data/worlds";
import { StarCounter } from "../components/common/StarCounter";
import { getStarsFromAccuracy, markLevelComplete } from "../utils/progress";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
type VirtualEnvKind =
  | "text-editor"
  | "browser-tabs"
  | "find-box"
  | "dialog";

type Combo = {
  raw: string;
  mods: string[];   // "Ctrl" | "Shift" | "Alt"
  key: string;      // e.g. "C", "Tab", "Enter"
  caps: string[];   // ordered keycap labels
  env: VirtualEnvKind;
};

/* ------------------------------------------------------------------ */
/* Combo parsing                                                       */
/* ------------------------------------------------------------------ */
const MOD_TOKENS = new Set(["ctrl", "control", "shift", "alt", "meta", "cmd"]);

function comboEnv(mods: string[], key: string): VirtualEnvKind {
  const k = key.toLowerCase();
  if (mods.includes("Ctrl")) {
    /* Ctrl+N y Ctrl+Shift+N abren una VENTANA y Ctrl+T una PESTAÑA. Van al
       mismo simulador justamente para que se vea la diferencia: la ventana
       aparece al lado, con su propia fila de pestañas; la pestaña se suma
       a la fila de la ventana donde estás. */
    if (k === "t" || k === "w" || k === "tab" || k === "n") return "browser-tabs";
    if (k === "f") return "find-box";
    /* Guardar y rehacer van al MISMO editor que seleccionar, copiar, pegar y
       deshacer: son cosas que se le hacen a un documento, y separadas no se
       entendían — Ctrl+Y no podía devolver lo que había sacado Ctrl+Z. */
    if (k === "c" || k === "v" || k === "a" || k === "z" || k === "y" || k === "s") return "text-editor";
  }
  if (k === "enter" || k === "escape") return "dialog";
  return "text-editor";
}

/** Atajos que el navegador o el sistema operativo se quedan siempre: la
 *  página no los recibe y preventDefault() no los frena. Se hacen con el
 *  teclado de la pantalla.
 *
 *  Ctrl+T / Ctrl+N abren pestaña o ventana, Ctrl+W cierra la pestaña — esa
 *  es la peor, porque se lleva la partida —, Ctrl+Tab cambia de pestaña y
 *  Alt+Tab es del sistema. Cubre también las variantes con Shift
 *  (Ctrl+Shift+T, Ctrl+Shift+N, Ctrl+Shift+Tab) por la misma razón. */
function esReservado(combo: Combo): boolean {
  const k = combo.key.toLowerCase();
  if (combo.mods.includes("Alt") && k === "tab") return true;
  if (combo.mods.includes("Ctrl")) {
    if (k === "t" || k === "w" || k === "n" || k === "tab") return true;
  }
  return false;
}

/** El `code` de KeyboardEvent que hay que pedirle a Keyboard Lock para cada
 *  atajo reservado. La API bloquea TECLAS, no combinaciones: pidiendo "KeyW"
 *  el navegador deja de quedarse con Ctrl+W y el evento llega a la página. */
function codigoParaBloquear(combo: Combo): string | null {
  const k = combo.key.toLowerCase();
  if (k === "tab") return "Tab";
  if (k.length === 1 && k >= "a" && k <= "z") return `Key${k.toUpperCase()}`;
  return null;
}

type EstadoBloqueo = "no-hace-falta" | "sin-soporte" | "pendiente" | "activo";

/** Pantalla completa + Keyboard Lock, que es lo único que hace que los
 *  atajos del navegador lleguen a la página.
 *
 *  Pide un gesto del alumno (un botón), porque pantalla completa no se puede
 *  pedir sola. Si el navegador no tiene la API, o si el alumno se sale de
 *  pantalla completa, vuelve a "pendiente" y el nivel sigue jugable con el
 *  teclado de la pantalla — nunca queda trabado. */
function useBloqueoDeTeclado(combos: Combo[], activo: boolean) {
  const reservados = combos.filter(esReservado);
  const hacenFalta = reservados.length > 0;
  const soporta =
    typeof navigator !== "undefined" &&
    !!(navigator as Navigator & { keyboard?: { lock?: unknown } }).keyboard?.lock &&
    !!document.documentElement.requestFullscreen;

  const [enMarcha, setEnMarcha] = useState(false);
  /* Si pantalla completa o el bloqueo fallan, o si el alumno prefiere no
     usarlos, el nivel NO puede quedar trabado detrás del cartel: se juega
     con el teclado de la pantalla, que siempre funciona. */
  const [seJuegaSinBloqueo, setSeJuegaSinBloqueo] = useState(false);

  const soltar = useCallback(() => {
    const teclado = (navigator as Navigator & { keyboard?: { unlock?: () => void } }).keyboard;
    try { teclado?.unlock?.(); } catch { /* al navegador no le importa */ }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setEnMarcha(false);
  }, []);

  const tomar = useCallback(async () => {
    if (!soporta) return;
    const codigos = [...new Set(reservados.map(codigoParaBloquear).filter((c): c is string => !!c))];
    try {
      await document.documentElement.requestFullscreen();
      const teclado = (navigator as Navigator & {
        keyboard?: { lock?: (k: string[]) => Promise<void> };
      }).keyboard;
      await teclado?.lock?.(codigos);
      setEnMarcha(true);
    } catch {
      /* Falla, por ejemplo, si el navegador no considera el clic un gesto
         válido, o si una política de la escuela bloquea pantalla completa.
         En ese caso se sigue con el teclado de la pantalla en vez de dejar
         al alumno mirando un cartel que no avanza. */
      setEnMarcha(false);
      setSeJuegaSinBloqueo(true);
    }
    // reservados se recalcula por render; las teclas del nivel no cambian.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soporta]);

  /* Salirse de pantalla completa suelta el bloqueo del lado del navegador,
     así que hay que enterarse para volver a ofrecer el botón. */
  useEffect(() => {
    if (!hacenFalta) return;
    const alCambiar = () => { if (!document.fullscreenElement) setEnMarcha(false); };
    document.addEventListener("fullscreenchange", alCambiar);
    return () => document.removeEventListener("fullscreenchange", alCambiar);
  }, [hacenFalta]);

  /* Al terminar el nivel o al irse, devolver el teclado y salir de pantalla
     completa: que el juego no se quede con el navegador tomado. */
  useEffect(() => {
    if (!activo && enMarcha) soltar();
  }, [activo, enMarcha, soltar]);
  useEffect(() => () => { soltar(); }, [soltar]);

  const estado: EstadoBloqueo =
    !hacenFalta ? "no-hace-falta"
    : !soporta || seJuegaSinBloqueo ? "sin-soporte"
    : enMarcha ? "activo"
    : "pendiente";
  return { estado, tomar, seguirSinBloqueo: () => setSeJuegaSinBloqueo(true) };
}

/* Clear, simulator-safe copy per combo (§6) — never just "hacé el atajo". */
function comboActionHint(combo: Combo): string {
  const k = combo.key.toLowerCase();
  if (combo.mods.includes("Ctrl")) {
    if (k === "t") return combo.mods.includes("Shift") ? "Recuperá la última pestaña que cerraste." : "Sumá una pestaña a la ventana donde estás.";
    if (k === "w") return "Cerrá la pestaña en la que estás parado.";
    if (k === "tab") return combo.mods.includes("Shift") ? "Volvé a la pestaña anterior del simulador." : "Pasá a la pestaña siguiente del simulador.";
    if (k === "a") return "Seleccioná todo el texto del cuadro.";
    if (k === "c") return "Copiá el texto seleccionado.";
    if (k === "v") return "Pegá el texto en el área de trabajo.";
    if (k === "z") return "Deshacé el último cambio del documento.";
    if (k === "y") return "Volvé a traer lo que deshiciste.";
    if (k === "f") return "Abrí el buscador del simulador.";
    if (k === "s") return "Guardá el documento: mirá el cartel de arriba.";
    if (k === "n") return combo.mods.includes("Shift") ? "Abrí una ventana privada, aparte de las otras." : "Abrí otra ventana entera, con su propia fila de pestañas.";
  }
  if (k === "enter") return "Aceptá con Enter en el simulador.";
  if (k === "escape") return "Cerrá con Escape en el simulador.";
  return "Hacé el atajo dentro del simulador.";
}

function parseCombo(raw: string): Combo {
  const tokens = raw.split("+").map((t) => t.trim()).filter(Boolean);
  const mods: string[] = [];
  let key = "";
  for (const token of tokens) {
    const low = token.toLowerCase();
    if (MOD_TOKENS.has(low)) {
      if (["ctrl", "control", "meta", "cmd"].includes(low)) mods.push("Ctrl");
      else if (low === "shift") mods.push("Shift");
      else if (low === "alt") mods.push("Alt");
    } else {
      key = token;
    }
  }
  return { raw, mods, key, caps: [...mods, key], env: comboEnv(mods, key) };
}

function eventMatchesCombo(ev: KeyboardEvent, combo: Combo): boolean {
  if (combo.mods.includes("Ctrl") !== (ev.ctrlKey || ev.metaKey)) return false;
  if (combo.mods.includes("Shift") !== ev.shiftKey) return false;
  if (combo.mods.includes("Alt") !== ev.altKey) return false;
  return ev.key.toLowerCase() === combo.key.toLowerCase();
}

/* A keydown whose key is *only* a modifier (Ctrl / Shift / Alt / Meta). These
   must never count as an attempt — a shortcut isn't formed until the action
   key is pressed. */
function isModifierOnly(ev: KeyboardEvent): boolean {
  return ev.key === "Control" || ev.key === "Shift" || ev.key === "Alt" || ev.key === "Meta" || ev.key === "OS";
}

/* Returns a normalized combo string ("ctrl+a", "alt+tab", "enter"…) when the
   keydown forms a FULL shortcut attempt, or null when it should be ignored for
   scoring (a lone modifier, or a plain key with no modifier that isn't
   Enter/Escape). */
function normalizeShortcut(ev: KeyboardEvent): string | null {
  if (isModifierOnly(ev)) return null;
  const hasMod = ev.ctrlKey || ev.metaKey || ev.altKey;
  const key = ev.key;
  const isStandalone = key === "Enter" || key === "Escape";
  if (!hasMod && !isStandalone) return null; // plain key → not a shortcut attempt
  const parts: string[] = [];
  if (ev.ctrlKey || ev.metaKey) parts.push("ctrl");
  if (ev.shiftKey) parts.push("shift");
  if (ev.altKey) parts.push("alt");
  parts.push(key.toLowerCase());
  return parts.join("+");
}

/* Runs the simulator's visual action when the parent signals a correct combo
   was performed via the real keyboard or the on-screen keycaps — so those
   paths update the simulation exactly like clicking the action button does.
   The env remounts per combo, so we baseline the signal on mount and only fire
   when it next increments. */
function useKeyboardTrigger(signal: number, act: () => void) {
  const baseline = useRef(signal);
  useEffect(() => {
    if (signal > baseline.current) {
      baseline.current = signal;
      act();
    }
    // act is captured from the latest render; deps intentionally only [signal].
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);
}

/* ------------------------------------------------------------------ */
/* Shared progress hook                                                */
/* ------------------------------------------------------------------ */
function useLevelProgress(activity: Activity, total: number) {
  const [progress, setProgress] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [errors, setErrors] = useState(0);
  const [completed, setCompleted] = useState(false);
  const persistedRef = useRef(false);
  const attemptsRef = useRef(0);
  const errorsRef = useRef(0);
  attemptsRef.current = attempts;
  errorsRef.current = errors;

  const tickCorrect = useCallback(() => {
    setAttempts((a) => { attemptsRef.current = a + 1; return a + 1; });
    setProgress((p) => {
      const next = Math.min(total, p + 1);
      if (next >= total && !persistedRef.current) {
        persistedRef.current = true;
        const a = attemptsRef.current;
        const e = errorsRef.current;
        const acc = Math.max(0, Math.round(((a - e) / Math.max(1, a)) * 100));
        markLevelComplete(activity.worldId, activity.levelNumber, acc, Math.max(1, a));
        setCompleted(true);
      }
      return next;
    });
  }, [activity.worldId, activity.levelNumber, total]);

  const tickWrong = useCallback(() => {
    setAttempts((a) => { attemptsRef.current = a + 1; return a + 1; });
    setErrors((e) => { errorsRef.current = e + 1; return e + 1; });
  }, []);

  const reset = useCallback(() => {
    persistedRef.current = false;
    setProgress(0); setAttempts(0); setErrors(0); setCompleted(false);
  }, []);

  const precision = Math.round(
    ((attempts - errors) / Math.max(1, attempts)) * 100,
  );
  return { progress, attempts, errors, completed, precision, tickCorrect, tickWrong, reset };
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */
export function ShortcutLevelView({ activity }: { activity: Activity }) {
  const navigate = useNavigate();
  /* Un nivel con `steps` es UNA tarea contada paso a paso; sin ellos, la
     lista suelta de siempre. Los combos salen del guion cuando existe. */
  const steps = activity.steps;
  const scene = activity.scene;
  const combos = (steps ? steps.map((s) => s.combo) : activity.targets).map(parseCombo);
  const total = combos.length;
  const background = getGameplayBackground(activity.worldId);
  const prog = useLevelProgress(activity, total);
  const progressRef = useRef(0);
  progressRef.current = prog.progress;

  const [clicked, setClicked] = useState<Record<string, boolean>>({});
  /* La misión se anuncia al abrir el nivel y baja a reposo. Acá importa más
     que en escritura: un atajo no se adivina mirando la pantalla. */
  const [misionEntrada, setMisionEntrada] = useState(true);
  useEffect(() => {
    setMisionEntrada(true);
    const bajar = window.setTimeout(() => setMisionEntrada(false), 2800);
    return () => window.clearTimeout(bajar);
  }, [activity.id]);
  const [feedback, setFeedback] = useState<string | undefined>();
  const [kbTrigger, setKbTrigger] = useState(0);
  const feedbackTimer = useRef<number | null>(null);
  /* Set while the just-performed action is being shown before advancing, so a
     single combo can't be scored twice during the short pause. */
  const advancingRef = useRef(false);

  function flash(msg: string) {
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    setFeedback(msg);
    feedbackTimer.current = window.setTimeout(() => setFeedback(undefined), 1800);
  }

  /* Called by the simulator's act() once it has performed the visual action.
     We hold ~450 ms so the result (selected text, new tab…) is visible, then
     advance. The guard makes ONE combo = ONE scored attempt. */
  function succeed() {
    if (advancingRef.current) return;
    advancingRef.current = true;
    flash("¡Muy bien!");
    window.setTimeout(() => {
      setClicked({});
      prog.tickCorrect();
      advancingRef.current = false;
    }, 450);
  }
  function fail() {
    if (advancingRef.current) return;
    flash("Casi… probá el atajo que se muestra.");
    prog.tickWrong();
  }

  /* A correct combo (keyboard or keycaps) tells the live simulator to perform
     its visual action; the simulator then calls succeed(). This keeps ONE
     code path for visual + scoring. */
  function triggerVirtualAction() {
    if (advancingRef.current) return;
    setKbTrigger((t) => t + 1);
  }

  /* ---- Physical keyboard handler ----
     Captures shortcuts INSIDE the game so the browser/OS never runs them:
       - Ctrl+T won't open a tab, Ctrl+W won't close it, Ctrl+A won't select
         the page, Alt+Tab won't switch apps (best effort — see §5).
     Scoring rule: ONE full combo = ONE attempt. Lone modifiers never count. */
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (prog.completed) return;
      const current = combos[progressRef.current];
      if (!current) return;

      const modifierOnly = isModifierOnly(ev);
      const hasMod = ev.ctrlKey || ev.metaKey || ev.altKey;
      const blockable =
        hasMod || modifierOnly ||
        ["Tab", "Enter", "Escape", "F1", "F2", "F3", "F4", "F5", "F6",
          "F7", "F8", "F9", "F10", "F11", "F12"].includes(ev.key);
      // Block the browser/OS default for anything shortcut-like.
      if (blockable) {
        ev.preventDefault();
        ev.stopPropagation();
      }

      // Only EVALUATE a full combo. Lone Ctrl/Shift/Alt, or a plain key with
      // no modifier (other than Enter/Escape), are ignored for scoring.
      const combo = normalizeShortcut(ev);
      if (!combo) return;

      if (eventMatchesCombo(ev, current)) {
        triggerVirtualAction(); // visual action → succeed()
      } else {
        fail();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prog.completed, combos]);

  /* ---- On-screen keycap clicking (always works, even when OS intercepts) ----
     Completing the keycap combo also drives the visual simulator action. */
  function onKeycapClick(capIdx: number, label: string) {
    if (prog.completed) return;
    const current = combos[prog.progress];
    if (!current) return;
    const key = `${capIdx}:${label}`;
    const next = { ...clicked, [key]: true };
    const allDone = current.caps.every((c, i) => next[`${i}:${c}`]);
    if (allDone) {
      triggerVirtualAction(); // visual action → succeed()
    } else {
      setClicked(next);
    }
  }

  /* Ctrl+W cierra la pestaña de verdad y se lleva la partida a medio hacer, y
     es un accidente probable justamente en los niveles que enseñan a cerrar
     pestañas. Mientras el nivel tenga atajos reservados y no esté terminado
     se pide confirmación antes de descargar la página: no lo evita, pero
     convierte "perdí todo" en "¿seguro que querés salir?".
     Se saca al completar el nivel, así el final no queda con el cartel. */
  const hayReservados = combos.some(esReservado);
  useEffect(() => {
    if (!hayReservados || prog.completed) return;
    const alSalir = (ev: BeforeUnloadEvent) => { ev.preventDefault(); ev.returnValue = ""; };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [hayReservados, prog.completed]);

  function retry() {
    prog.reset();
    setClicked({});
    setFeedback(undefined);
  }

  function speak() {
    if (!("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(`${activity.title}. ${activity.listenText}`);
    utter.lang = "es-AR";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  const currentIdx = Math.min(prog.progress, total - 1);
  const current = combos[currentIdx];
  const currentStep = steps?.[currentIdx];
  /* El escenario sale del atajo salvo que el guion diga otra cosa. */
  const currentEnv = (currentStep?.env as VirtualEnvKind | undefined) ?? current?.env;
  /* ¿Este atajo se lo queda el navegador? Con el bloqueo activo ya no, y se
     pide con el teclado real como cualquier otro. */
  const bloqueo = useBloqueoDeTeclado(combos, !prog.completed);
  const reservado = (current ? esReservado(current) : false) && bloqueo.estado !== "activo";

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden font-body text-text animate-page-fade">
      {/* Per-world background with pastel overlay */}
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: `url("${background}")` }}
        aria-hidden="true"
      />
      {/* Pastel wash so text stays readable over any world art */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-bg-soft/70 via-white/40 to-accent-sky/20 pointer-events-none" aria-hidden="true" />

      {/* Sparkles */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className={`absolute block rounded-full bg-white/80 shadow-[0_0_12px_rgba(255,255,255,0.9)] animate-twinkle ${
              i % 5 === 0 ? "h-2 w-2 top-[8%] left-[10%]" :
              i % 5 === 1 ? "h-1.5 w-1.5 top-[18%] left-[82%] animation-delay-300" :
              i % 5 === 2 ? "h-2.5 w-2.5 top-[36%] left-[6%] animation-delay-700" :
              i % 5 === 3 ? "h-1 w-1 top-[55%] left-[92%] animation-delay-500" :
                             "h-2 w-2 top-[72%] left-[16%] animation-delay-900"
            }`}
            style={{ animationDelay: `${(i % 5) * 300}ms` }}
          />
        ))}
      </div>

      {/* Encabezado — suelto sobre el fondo. El título del nivel no necesita
          una tarjeta propia: lo que tiene que resaltar es la misión. */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-8">
        <div className="nv-dato flex flex-col gap-0.5 max-w-[72%]">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-strong">
            NIVEL {activity.levelNumber}
          </span>
          <strong className="font-display text-base sm:text-lg text-text leading-tight">{activity.title}</strong>
          <em className="text-xs text-text/70 not-italic font-semibold">{activity.subtitle}</em>
        </div>
        <div className="flex items-center gap-2">
          <StarCounter />
          <button
            type="button"
            className="glass rounded-full px-3 py-2 text-sm font-semibold text-text shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0 flex items-center gap-1.5"
            onClick={() => navigate(`/worlds/${activity.worldId}`)}
            aria-label="Salir"
          >
            <X size={16} />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* LA MISIÓN. Acá hace todavía más falta que en los niveles de
          escritura: ahí el objetivo se adivina mirando la pantalla — hay una
          letra gigante —, pero un atajo NO se adivina. Si el chico no lee la
          consigna, no tiene con qué arrancar. Por eso lleva el botón de
          escuchar adelante y es lo único con borde encendido. */}
      <div className="mt-3 flex justify-center px-4 z-20" aria-live="polite">
        <div className={`gp-mision flex items-start gap-3 sm:gap-4 py-2.5 pl-3 pr-5 max-w-3xl ${misionEntrada ? "gp-mision--entrada" : ""}`}>
          <span className="gp-mision__insignia inline-flex items-center gap-1 px-3 py-0.5 font-display font-extrabold text-[11px] uppercase tracking-wider">
            <Star size={11} fill="currentColor" strokeWidth={0} />
            {steps ? "Paso" : "Atajo"} {Math.min(prog.progress + (prog.completed ? 0 : 1), total)} de {total}
          </span>
          <button
            type="button"
            onClick={speak}
            className="gp-mision__audio shrink-0 rounded-full w-11 h-11 sm:w-[3.25rem] sm:h-[3.25rem] flex items-center justify-center text-white transition-transform hover:scale-105"
            aria-label="Escuchar la consigna"
            title="Escuchar la consigna"
          >
            <Volume2 size={22} />
          </button>
          <span className="pt-1">
            <h2 className="font-display font-extrabold text-base sm:text-xl leading-snug text-text">
              {currentStep?.prompt ?? activity.instruction}
            </h2>
            {steps && (
              <p className="text-[13px] font-semibold leading-tight text-[#4a5f88] mt-0.5">{activity.instruction}</p>
            )}
          </span>
        </div>
      </div>

      {/* Los pasos, sueltos bajo la misión: así se entiende que seleccionar,
          copiar y pegar son partes de UNA tarea y no tres ejercicios. */}
      {steps && (
        <ol className="mt-2 flex flex-wrap justify-center gap-1.5 px-4" aria-label="Pasos de la tarea">
          {steps.map((s, i) => (
            <li
              key={i}
              className={[
                "rounded-full px-2.5 py-0.5 text-[11px] font-bold transition backdrop-blur-sm",
                i < prog.progress
                  ? "bg-mint/40 text-accent-teal"
                  : i === prog.progress && !prog.completed
                    ? "bg-white/80 text-accent-strong ring-2 ring-accent/50"
                    : "bg-white/40 text-text/60",
              ].join(" ")}
            >
              {i < prog.progress ? "✓ " : ""}{s.combo}
            </li>
          ))}
        </ol>
      )}

      {/* Stage: mascots + virtual environment */}
      <section
        className="relative mx-4 mt-4 flex flex-1 flex-col items-center justify-center gap-4 sm:mx-8"
        aria-label="Escena"
      >
        <img
          className="hidden sm:block absolute left-0 bottom-4 w-24 md:w-32 animate-mascot-float drop-shadow-xl"
          src={assets.mascotFemaleWave}
          alt=""
          decoding="async"
        />
        <span className="hidden sm:block absolute left-24 md:left-36 bottom-24 glass-card-smooth rounded-2xl rounded-bl-sm px-3 py-1.5 text-xs font-semibold text-text shadow-card animate-bubble-pop">
          ¡Vos podés!
        </span>
        <img
          className="hidden sm:block absolute right-0 bottom-4 w-24 md:w-32 animate-mascot-float drop-shadow-xl"
          style={{ animationDelay: "1.2s" }}
          src={assets.mascotMaleProud}
          alt=""
          decoding="async"
        />
        <span className="hidden sm:block absolute right-24 md:right-36 bottom-24 glass-card-smooth rounded-2xl rounded-br-sm px-3 py-1.5 text-xs font-semibold text-text shadow-card animate-bubble-pop"
          style={{ animationDelay: "400ms" }}>
          ¡Sos un crack!
        </span>

        {/* SIN caja. Antes esto era un glass-card que envolvía al simulador,
            y el simulador ya trae su propio marco adentro: dos blancos, uno
            sobre otro, tapando la isla. El navegador y el documento se
            sostienen solos como objetos apoyados en el pedestal. */}
        <div className="relative z-10 w-full max-w-3xl flex flex-col gap-4">
          {/* Sin guion, un montaje nuevo por combo: cada atajo es su propio
              ejercicio y conviene que el simulador arranque limpio.

              CON guion NO se remonta mientras el escenario sea el mismo, y
              ahí está la diferencia: si el simulador se reinicia entre pasos,
              lo que seleccionaste deja de estar pintado cuando vas a copiar y
              el portapapeles llega vacío al pegar, que era justamente lo que
              hacía que copiar y pegar no se entendieran. Al cambiar de
              escenario (del editor al cartel, por ejemplo) sí se remonta. */}
          <VirtualEnv
            key={steps ? `${currentEnv ?? "none"}` : prog.progress}
            combo={current}
            progress={prog.progress}
            completed={prog.completed}
            triggerSignal={kbTrigger}
            onVirtualAction={succeed}
            scene={scene}
            dialog={currentStep?.dialog}
            stepIndex={currentIdx}
            envOverride={currentEnv}
          />

          {/* Teclado en pantalla. Para los atajos reservados no es un plan B:
              es el ÚNICO camino, porque el navegador se queda con la tecla. */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <span className="nv-dato flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-text/85">
              <Monitor size={16} className="text-accent-strong" />
              {current ? comboActionHint(current) : "Hacé el atajo dentro del simulador."}
            </span>
            {reservado ? (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-200/80 backdrop-blur px-3 py-1 text-[11px] sm:text-xs font-bold text-amber-900 border border-amber-300/70">
                <span aria-hidden="true">👇</span>
                Este atajo lo maneja el navegador: tocá las teclas de acá abajo.
              </span>
            ) : bloqueo.estado === "activo" ? (
              <span className="flex items-center gap-1.5 rounded-full bg-mint/35 backdrop-blur px-3 py-1 text-[11px] sm:text-xs font-bold text-accent-teal border border-mint/50">
                🔒 Teclado capturado: apretá el atajo de verdad, no le pasa nada al navegador.
              </span>
            ) : (
              <span className="nv-dato text-[11px] font-semibold text-text/65">Tocá las teclas de acá abajo o usá el teclado de verdad.</span>
            )}
            {/* ESTAS TECLAS SÍ SE TOCAN, al revés del teclado de los niveles
                de escritura, que es inerte a propósito. Acá hay atajos que el
                navegador se queda —Ctrl+T, Ctrl+W— y que nunca llegan a la
                página: sin poder tocarlas, esos niveles serían imposibles de
                pasar. Por eso levantan al pasar el mouse y son más grandes:
                tienen que verse tocables. */}
            <div className="flex flex-wrap items-center justify-center gap-2" aria-label={`Atajo: ${current?.raw ?? ""}`}>
              {current?.caps.map((cap, i) => (
                <span key={`${i}:${cap}`} className="flex items-center gap-2">
                  <button
                    type="button"
                    className={[
                      "nv-tecla min-w-[3.25rem] h-[2.875rem] px-3 select-none font-display font-bold text-sm sm:text-base",
                      "flex items-center justify-center",
                      clicked[`${i}:${cap}`] ? "nv-tecla--puesta" : "",
                    ].join(" ")}
                    style={{ ["--nv-canto" as string]: reservado ? "#ffd552" : "#33c7f0" }}
                    onClick={() => onKeycapClick(i, cap)}
                    tabIndex={-1}
                  >
                    {cap}
                  </button>
                  {i < current.caps.length - 1 && (
                    <span className="nv-dato px-0.5 text-lg font-bold text-text/70">+</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Puerta de pantalla completa. Sólo aparece en los niveles con atajos
          del navegador y sólo donde la API existe. Hace falta un clic porque
          pantalla completa no se puede pedir sin un gesto del alumno. */}
      {bloqueo.estado === "pendiente" && !prog.completed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-text/45 backdrop-blur-sm" />
          <div className="glass-card-smooth relative w-full max-w-md rounded-3xl p-7 text-center shadow-card animate-modal-in">
            <div className="text-5xl" aria-hidden="true">🔒</div>
            <h3 className="mt-3 font-display text-2xl text-text">Modo pantalla completa</h3>
            <p className="mt-2 text-sm text-muted">
              Este nivel usa atajos que normalmente maneja el navegador, como abrir y
              cerrar pestañas. En pantalla completa el juego se queda con esas teclas,
              así podés apretarlas de verdad sin que se te abra ni se te cierre nada.
            </p>
            <button
              type="button"
              className="mt-5 rounded-full bg-gradient-to-br from-accent to-accent-strong px-6 py-3 text-sm font-bold text-white shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0"
              onClick={bloqueo.tomar}
            >
              Empezar el nivel
            </button>
            <p className="mt-3 text-[11px] text-muted">
              Para salir, apretá Escape sin soltar o usá el botón «Salir».
            </p>
            {/* Salida siempre disponible: si la escuela bloquea pantalla
                completa, el nivel igual se juega con el teclado de abajo. */}
            <button
              type="button"
              className="mt-2 text-[11px] font-semibold text-accent-strong underline underline-offset-2 transition hover:text-accent"
              onClick={bloqueo.seguirSinBloqueo}
            >
              Seguir sin pantalla completa
            </button>
          </div>
        </div>
      )}

      {/* Metrics bar */}
      <div className="nv-dato mx-4 mt-3 mb-2 sm:mx-8 flex items-center justify-center gap-3 text-sm font-semibold text-text/85">
        <span className="text-amber-400">★</span>
        <div><b>Intentos:</b> {prog.attempts}</div>
        <div className="h-4 w-px bg-text/15" />
        <div><b>Aciertos:</b> {prog.progress}</div>
        <div className="h-4 w-px bg-text/15" />
        <div><b>Precisión:</b> {prog.precision}%</div>
        <span className="text-amber-400">★</span>
      </div>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4 sm:px-8">
        <div className="nv-dato flex-1 px-1 py-2 text-sm font-semibold text-text/85 min-w-[200px]">
          <span aria-hidden="true" className="mr-1 text-amber-400">★</span>
          {feedback ?? activity.description}
        </div>
        {/* El botón de escuchar ya no vive acá: se mudó adentro de la misión,
            que es donde está la consigna que hay que escuchar. Al pie, entre
            otros botones, no se leía como parte de ella. */}
        <button
          type="button"
          className="glass-card-smooth rounded-full px-4 py-2 text-sm font-semibold text-text shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0 flex items-center gap-1.5"
          onClick={retry}
        >
          <RotateCcw size={16} /> Reintentar
        </button>
      </footer>

      {/* Completion modal */}
      {prog.completed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-text/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md animate-modal-in">
            <div className="glass-card-smooth relative overflow-hidden rounded-3xl p-8 text-center shadow-card">
              <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                {Array.from({ length: 18 }).map((_, i) => (
                  <span
                    key={i}
                    className={`absolute block h-2 w-2 rounded-full animate-fall ${
                      i % 6 === 0 ? "bg-accent-pink" :
                      i % 6 === 1 ? "bg-accent-sky" :
                      i % 6 === 2 ? "bg-mint" :
                      i % 6 === 3 ? "bg-accent" :
                      i % 6 === 4 ? "bg-rose" :
                                    "bg-accent-teal"
                    }`}
                    style={{
                      left: `${(i * 53) % 100}%`,
                      animationDelay: `${(i * 120) % 1200}ms`,
                      animationDuration: `${1800 + ((i * 300) % 800)}ms`,
                    }}
                  />
                ))}
              </div>
              <div className="text-5xl animate-bounce-trophy" aria-hidden="true">🏆</div>
              <h3 className="mt-3 font-display text-2xl text-text">¡Muy bien!</h3>
              <p className="text-sm text-muted">Completaste el nivel</p>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-2xl" aria-hidden="true">
                {[1, 2, 3].map((i) => {
                  const earned = getStarsFromAccuracy(prog.precision);
                  return (
                    <span
                      key={i}
                      className={earned >= i ? "animate-star-pop-i5 text-amber-400" : "text-text/25"}
                      style={earned >= i ? { animationDelay: `${i * 180}ms` } : undefined}
                    >
                      {earned >= i ? "★" : "☆"}
                    </span>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className="rounded-full bg-gradient-to-br from-accent to-accent-strong px-5 py-2.5 text-sm font-bold text-white shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0"
                  onClick={() => navigate(`/worlds/${activity.worldId}`)}
                >
                  Volver a la isla
                </button>
                <button
                  type="button"
                  className="glass-card-smooth rounded-full px-4 py-2 text-sm font-semibold text-text shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0 flex items-center gap-1.5"
                  onClick={retry}
                >
                  <RotateCcw size={16} /> Repetir nivel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ================================================================== */
/* Virtual Environment — renders the simulated context for each combo  */
/* ================================================================== */

interface VirtualEnvProps {
  combo: Combo | undefined;
  progress: number;
  completed: boolean;
  triggerSignal: number;
  onVirtualAction: () => void;
  /** Contenido propio del nivel (island11); sin esto van los textos genéricos. */
  scene?: ShortcutScene;
  /** Cartel concreto del paso, para Enter/Escape. */
  dialog?: ShortcutDialog;
  /** Índice del paso: los escenarios que persisten lo usan para reiniciarse
   *  cuando el paso cambia sin que cambie el escenario (dos carteles seguidos). */
  stepIndex: number;
  /** Escenario elegido por el guion, cuando el atajo solo no alcanza. */
  envOverride?: VirtualEnvKind;
}

type EnvProps = {
  combo: Combo;
  completed: boolean;
  triggerSignal: number;
  onAction: () => void;
  scene?: ShortcutScene;
  dialog?: ShortcutDialog;
  stepIndex: number;
};

function VirtualEnv({ combo, completed, triggerSignal, onVirtualAction, scene, dialog, stepIndex, envOverride }: VirtualEnvProps) {
  if (!combo) return null;
  const props: EnvProps = { combo, completed, triggerSignal, onAction: onVirtualAction, scene, dialog, stepIndex };
  switch (envOverride ?? combo.env) {
    case "browser-tabs":
      return <VirtualBrowser {...props} />;
    case "find-box":
      return <VirtualFindBox {...props} />;
    case "dialog":
      return <VirtualDialog {...props} />;
    default:
      return <VirtualTextEditor {...props} />;
  }
}

/* ================================================================== */
/* Navegador virtual — VENTANAS y PESTAÑAS (Ctrl+T/W/Tab/N)           */
/*                                                                     */
/* Acá vivían dos simuladores separados y ninguno de los dos alcanzaba:*/
/* uno tenía tres pestañas que se llamaban "Inicio", "Música" y        */
/* "Juegos" y mostraban las tres el mismo cartel "Contenido de la      */
/* página" — así, cambiar de pestaña no se veía —, y el otro era una   */
/* grilla de aplicaciones donde Ctrl+N abría una "ventana" sin que se  */
/* entendiera en qué se diferenciaba de abrir una pestaña.             */
/*                                                                     */
/* Ahora es uno solo, con la jerarquía de verdad: ventanas, y pestañas */
/* dentro de cada ventana. Ctrl+N suma una ventana al lado, con su     */
/* propia fila de solapas; Ctrl+T suma una pestaña a la ventana donde  */
/* estás parado. Y cada pestaña se dibuja según su `kind`, con su      */
/* ícono y su color, para que dos pestañas abiertas no se confundan.   */
/* ================================================================== */

type PestañaViva = ShortcutTab & { uid: number };
type VentanaViva = {
  uid: number;
  etiqueta: string;
  privada: boolean;
  tabs: PestañaViva[];
  activa: number;
};

/** Ícono y color de la solapa según el tipo de página. */
const PESTAÑA_LOOK: Record<ShortcutTab["kind"], { icono: string; solapa: string }> = {
  nueva:       { icono: "🗒️", solapa: "bg-slate-200 text-slate-700" },
  buscador:    { icono: "🔎", solapa: "bg-sky-200 text-sky-900" },
  video:       { icono: "▶️", solapa: "bg-rose-200 text-rose-900" },
  texto:       { icono: "📄", solapa: "bg-amber-200 text-amber-900" },
  diccionario: { icono: "📖", solapa: "bg-violet-200 text-violet-900" },
  mapa:        { icono: "🗺️", solapa: "bg-emerald-200 text-emerald-900" },
  mensajes:    { icono: "💬", solapa: "bg-teal-200 text-teal-900" },
  juego:       { icono: "🎮", solapa: "bg-indigo-200 text-indigo-900" },
  anuncio:     { icono: "📢", solapa: "bg-orange-300 text-orange-950" },
  clima:       { icono: "🌤️", solapa: "bg-cyan-200 text-cyan-900" },
  calculadora: { icono: "🔢", solapa: "bg-lime-200 text-lime-900" },
};

/* Para los niveles que todavía no declaran su escena (isla 14): tres
   pestañas distintas entre sí, que era el punto. */
const PESTAÑAS_POR_DEFECTO: ShortcutTab[] = [
  { title: "Buscador", kind: "buscador", lines: ["cómo hacen miel las abejas", "Las abejas y la colmena", "Video: dentro de un panal"] },
  { title: "Clase grabada", kind: "video", lines: ["La colmena por dentro", "6:20"] },
  { title: "Tu tarea", kind: "texto", lines: ["Ciencias naturales", "Escribir tres cosas que aprendiste sobre las abejas."] },
];

/** El contenido de una pestaña. Un tipo, una interfaz. */
function PaginaVirtual({ tab }: { tab: ShortcutTab }) {
  const l = tab.lines ?? [];
  switch (tab.kind) {
    case "buscador":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
            <span aria-hidden="true">🔎</span>
            <span className="truncate">{l[0] ?? "buscar…"}</span>
          </div>
          {l.slice(1).map((r, i) => (
            <div key={i} className="space-y-1">
              <p className="truncate text-[11px] font-bold text-sky-700 underline underline-offset-2">{r}</p>
              <div className="h-1 w-4/5 rounded-full bg-slate-200" />
              <div className="h-1 w-3/5 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      );
    case "video":
      return (
        <div className="flex flex-col gap-1.5">
          <div className="relative flex h-16 items-center justify-center rounded-lg bg-slate-800">
            <span className="text-2xl text-white/90" aria-hidden="true">▶</span>
            <span className="absolute inset-x-2 bottom-1.5 h-1 rounded-full bg-white/25">
              <span className="block h-full w-1/3 rounded-full bg-rose-400" />
            </span>
          </div>
          <p className="truncate text-[11px] font-bold text-text">{l[0] ?? "Video"}</p>
          {l[1] && <p className="text-[10px] text-muted">{l[1]}</p>}
        </div>
      );
    case "texto":
      return (
        <div className="rounded-lg border border-amber-200 bg-white p-2.5">
          <p className="text-[11px] font-bold text-amber-900">{l[0] ?? "Documento"}</p>
          {l[1] && <p className="mt-1 text-[11px] leading-snug text-slate-600">{l[1]}</p>}
          <div className="mt-2 space-y-1">
            <div className="h-1 w-full rounded-full bg-slate-200" />
            <div className="h-1 w-4/5 rounded-full bg-slate-200" />
            <div className="h-1 w-2/3 rounded-full bg-slate-200" />
          </div>
        </div>
      );
    case "diccionario":
      return (
        <div className="rounded-lg border-l-4 border-violet-400 bg-white p-2.5">
          <p className="font-display text-base leading-tight text-violet-900">{l[0] ?? "palabra"}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-violet-400">sustantivo</p>
          {l[1] && <p className="mt-1 text-[11px] leading-snug text-slate-600">{l[1]}</p>}
        </div>
      );
    case "mapa":
      return (
        <div className="relative h-[6.5rem] overflow-hidden rounded-lg bg-emerald-100">
          <span
            className="absolute inset-0 opacity-50"
            style={{ background: "repeating-linear-gradient(45deg, transparent 0 10px, rgba(255,255,255,0.6) 10px 12px)" }}
            aria-hidden="true"
          />
          <span className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 bg-sky-300/80" aria-hidden="true" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full text-lg" aria-hidden="true">📍</span>
          <div className="absolute inset-x-1.5 bottom-1.5 rounded-md bg-white/90 px-2 py-1">
            <p className="truncate text-[11px] font-bold text-emerald-900">{l[0] ?? "Mapa"}</p>
            {l[1] && <p className="truncate text-[10px] text-slate-600">{l[1]}</p>}
          </div>
        </div>
      );
    case "mensajes":
      return (
        <div className="flex flex-col gap-1.5">
          {(l.length ? l : ["Alguien: ¡hola!"]).map((m, i) => {
            const corte = m.indexOf(":");
            const quien = corte > 0 ? m.slice(0, corte) : "";
            const dice = corte > 0 ? m.slice(corte + 1).trim() : m;
            const mio = quien.toLowerCase() === "vos";
            return (
              <span key={i} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
                <span
                  className={[
                    "max-w-[85%] rounded-2xl px-2.5 py-1 text-[11px] leading-snug",
                    mio
                      ? "rounded-br-sm bg-teal-500 text-white"
                      : "rounded-bl-sm border border-teal-100 bg-white text-slate-700",
                  ].join(" ")}
                >
                  {!mio && quien && <b className="mr-1 text-teal-700">{quien}:</b>}
                  {dice}
                </span>
              </span>
            );
          })}
        </div>
      );
    case "juego":
      return (
        <div className="flex h-[6.5rem] flex-col items-center justify-center gap-1 rounded-lg bg-gradient-to-b from-indigo-400 to-indigo-600">
          <span className="text-2xl" aria-hidden="true">🏎️</span>
          <p className="px-2 text-center text-[11px] font-bold text-white">{l[0] ?? "Juego"}</p>
          {l[1] && (
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold text-white">{l[1]}</span>
          )}
        </div>
      );
    case "anuncio":
      return (
        <div className="flex h-[6.5rem] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-orange-400 bg-gradient-to-b from-amber-200 to-orange-300 text-center">
          <span className="text-2xl" aria-hidden="true">🎁</span>
          <p className="px-2 text-[11px] font-black uppercase leading-tight text-orange-950">{l[0] ?? "¡Oferta!"}</p>
          {l[1] && <p className="px-2 text-[10px] leading-tight text-orange-900/80">{l[1]}</p>}
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-900">
            publicidad
          </span>
        </div>
      );
    case "clima":
      return (
        <div className="flex h-[6.5rem] flex-col items-center justify-center gap-0.5 rounded-lg bg-gradient-to-b from-cyan-100 to-sky-200">
          <span className="text-2xl" aria-hidden="true">🌤️</span>
          <p className="font-display text-2xl leading-none text-sky-900">{l[0] ?? "—"}</p>
          {l[1] && <p className="px-2 text-center text-[10px] text-sky-800">{l[1]}</p>}
        </div>
      );
    case "calculadora":
      return (
        <div className="mx-auto w-full max-w-[11rem] rounded-lg bg-slate-800 p-2">
          <div className="rounded bg-lime-200 px-2 py-1 text-right font-display text-sm text-slate-900">
            {l[0] ?? "0"}
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1" aria-hidden="true">
            {["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "=", "+"].map((b) => (
              <span key={b} className="rounded bg-slate-600 py-0.5 text-center text-[10px] font-bold text-white">
                {b}
              </span>
            ))}
          </div>
        </div>
      );
    default:
      return (
        <div className="flex h-[6.5rem] flex-col items-center justify-center gap-2">
          <span className="text-xl" aria-hidden="true">🗒️</span>
          <span className="w-full max-w-[14rem] rounded-full border border-slate-200 bg-white px-3 py-1 text-center text-[10px] text-slate-400">
            Buscá o escribí una dirección
          </span>
          <p className="text-[10px] text-muted">Pestaña nueva, todavía vacía</p>
        </div>
      );
  }
}

/** Una ventana: barra, fila de solapas y la página de la solapa activa. */
function MarcoVentana({
  ventana, enfocada, varias, destello,
}: { ventana: VentanaViva; enfocada: boolean; varias: boolean; destello: boolean }) {
  const activa = ventana.tabs[ventana.activa];
  return (
    <div
      className={[
        "flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm transition",
        ventana.privada ? "border-slate-600 bg-slate-700" : "border-white/80 bg-white/85",
        /* La que NO tiene el foco se apaga: así se ve de un vistazo en cuál
           de las dos ventanas van a caer Ctrl+T y Ctrl+W. */
        enfocada ? "ring-2 ring-accent/45" : "opacity-60 saturate-50",
        destello && enfocada ? "animate-reward-pop" : "",
      ].join(" ")}
    >
      <div
        className={[
          "flex items-center gap-1.5 px-2 py-1",
          ventana.privada ? "bg-slate-800" : "bg-gradient-to-b from-white/90 to-bg-soft/70",
        ].join(" ")}
      >
        <span className="flex shrink-0 gap-1" aria-hidden="true">
          <span className="block h-2 w-2 rounded-full bg-rose-300" />
          <span className="block h-2 w-2 rounded-full bg-amber-300" />
          <span className="block h-2 w-2 rounded-full bg-emerald-300" />
        </span>
        <span
          className={[
            "truncate text-[10px] font-bold uppercase tracking-wider",
            ventana.privada ? "text-slate-200" : "text-muted",
          ].join(" ")}
        >
          {ventana.privada && <span aria-hidden="true">🕶️ </span>}
          {ventana.etiqueta}
        </span>
        {varias && enfocada && (
          <span className="ml-auto shrink-0 rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold text-accent-strong">
            acá estás
          </span>
        )}
      </div>

      {/* Solapas. No se pueden clickear a propósito: si se pudiera saltar de
          pestaña con el mouse, el nivel de Ctrl+Tab se resolvería sin hacer
          el atajo, que es justo lo que hay que aprender. */}
      <div className="flex gap-1 overflow-x-auto px-1.5 pt-1.5">
        {ventana.tabs.length === 0 && (
          <span className="px-1 py-1 text-[10px] italic text-muted">sin pestañas</span>
        )}
        {ventana.tabs.map((t, i) => {
          const look = PESTAÑA_LOOK[t.kind] ?? PESTAÑA_LOOK.nueva;
          const esActiva = i === ventana.activa;
          return (
            <span
              key={t.uid}
              className={[
                "flex shrink-0 items-center gap-1 rounded-t-lg px-2 py-1 text-[10px] font-bold transition",
                esActiva ? `${look.solapa} shadow-sm` : "bg-white/45 text-muted",
              ].join(" ")}
            >
              <span aria-hidden="true">{look.icono}</span>
              <span className="max-w-[5.5rem] truncate">{t.title}</span>
            </span>
          );
        })}
      </div>

      <div className={["min-h-[7.5rem] p-2", ventana.privada ? "bg-slate-600" : "bg-white/70"].join(" ")}>
        {activa ? (
          <PaginaVirtual tab={activa} />
        ) : (
          <div className="flex min-h-[7rem] flex-col items-center justify-center gap-1 text-center">
            <span className="text-xl" aria-hidden="true">🌥️</span>
            <p className="text-[11px] font-semibold text-muted">No quedó ninguna pestaña abierta</p>
            <p className="text-[10px] text-muted/70">Abrí una con Ctrl + T</p>
          </div>
        )}
      </div>
    </div>
  );
}

function VirtualBrowser({ combo, completed, triggerSignal, onAction, scene, stepIndex }: EnvProps) {
  const uidRef = useRef(0);
  const nuevoUid = () => { uidRef.current += 1; return uidRef.current; };

  const [ventanas, setVentanas] = useState<VentanaViva[]>(() => {
    const base = scene?.tabs ?? PESTAÑAS_POR_DEFECTO;
    return [{
      uid: nuevoUid(),
      etiqueta: "Ventana 1",
      privada: false,
      tabs: base.map((t) => ({ ...t, uid: nuevoUid() })),
      activa: Math.min(Math.max(0, scene?.activeTab ?? 0), Math.max(0, base.length - 1)),
    }];
  });
  const [foco, setFoco] = useState(0);
  const [ocupado, setOcupado] = useState(false);

  /* Lo que va a ir apareciendo, en orden: cada Ctrl+T y cada Ctrl+N toman de
     acá. En un ref y no en estado porque consumirla siempre coincide con un
     cambio de ventanas, que ya provoca el re-render. */
  const colaRef = useRef<ShortcutTab[]>([...(scene?.opens ?? [])]);
  /* Lo cerrado, para que Ctrl+Shift+T (isla 14) recupere algo de verdad. */
  const cerradasRef = useRef<PestañaViva[]>([]);

  useKeyboardTrigger(triggerSignal, () => act());

  /* El paso avanzó: se suelta el freno anti-doble-clic. Sin esto se comía el
     primer intento del paso siguiente, porque el freno dura más que la pausa
     que hace el nivel para mostrar lo que acabás de hacer. */
  useEffect(() => { setOcupado(false); }, [stepIndex]);

  function siguienteDeLaCola(privada = false): ShortcutTab {
    const next = colaRef.current.shift();
    if (next) return next;
    return { title: privada ? "Pestaña privada" : "Pestaña nueva", kind: "nueva" };
  }

  function abrirPestaña(restaurar: boolean) {
    const recuperada = restaurar ? cerradasRef.current.pop() : undefined;
    const tab: PestañaViva = recuperada ?? { ...siguienteDeLaCola(), uid: nuevoUid() };
    setVentanas((prev) =>
      prev.map((v, i) => (i === foco ? { ...v, tabs: [...v.tabs, tab], activa: v.tabs.length } : v)),
    );
  }

  function cerrarPestaña() {
    const v = ventanas[foco];
    if (!v || v.tabs.length === 0) return;
    cerradasRef.current.push(v.tabs[v.activa]);
    /* Cerrar la última pestaña de una ventana cierra la ventana, igual que en
       el navegador de verdad. La excepción es la única ventana que queda: ahí
       el navegador se queda vacío en vez de desaparecer, porque hacer
       desaparecer el simulador entero dejaría al chico sin nada que mirar. */
    if (v.tabs.length === 1 && ventanas.length > 1) {
      setVentanas((prev) => prev.filter((_, i) => i !== foco));
      setFoco((f) => Math.max(0, f - 1));
      return;
    }
    setVentanas((prev) =>
      prev.map((w, i) => {
        if (i !== foco) return w;
        const tabs = w.tabs.filter((_, j) => j !== w.activa);
        return { ...w, tabs, activa: Math.max(0, Math.min(w.activa, tabs.length - 1)) };
      }),
    );
  }

  function moverse(paso: number) {
    setVentanas((prev) =>
      prev.map((v, i) =>
        i !== foco || v.tabs.length === 0
          ? v
          : { ...v, activa: (v.activa + paso + v.tabs.length) % v.tabs.length },
      ),
    );
  }

  function abrirVentana(privada: boolean) {
    const tab: PestañaViva = { ...siguienteDeLaCola(privada), uid: nuevoUid() };
    const nueva: VentanaViva = {
      uid: nuevoUid(),
      etiqueta: privada ? "Ventana privada" : `Ventana ${ventanas.length + 1}`,
      privada,
      tabs: [tab],
      activa: 0,
    };
    setVentanas((prev) => [...prev, nueva]);
    setFoco(ventanas.length); // el foco se va a la ventana nueva, como en serio
  }

  function act() {
    if (completed || ocupado) return;
    setOcupado(true);
    window.setTimeout(() => setOcupado(false), 600);

    const k = combo.key.toLowerCase();
    const shift = combo.mods.includes("Shift");
    if (k === "t") abrirPestaña(shift);
    else if (k === "w") cerrarPestaña();
    else if (k === "tab") moverse(shift ? -1 : 1);
    else if (k === "n") abrirVentana(shift);
    onAction();
  }

  const varias = ventanas.length > 1;
  const abiertas = ventanas.reduce((n, v) => n + v.tabs.length, 0);
  const k = combo.key.toLowerCase();
  const shift = combo.mods.includes("Shift");
  const etiquetaAccion =
    k === "t" ? (shift ? "Reabrir la última que cerraste" : "Abrir pestaña") :
    k === "w" ? "Cerrar esta pestaña" :
    k === "tab" ? (shift ? "Pestaña anterior" : "Pestaña siguiente") :
    k === "n" ? (shift ? "Abrir ventana privada" : "Abrir ventana nueva") :
    "Hacer la acción";

  return (
    <div className="nv-escena flex flex-col gap-3 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {varias ? `${ventanas.length} ventanas` : "1 ventana"} ·{" "}
        {abiertas} {abiertas === 1 ? "pestaña abierta" : "pestañas abiertas"}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        {ventanas.map((v, i) => (
          <MarcoVentana
            key={v.uid}
            ventana={v}
            enfocada={i === foco}
            varias={varias}
            destello={ocupado}
          />
        ))}
      </div>
      <button
        type="button"
        className={[
          "self-center rounded-full px-4 py-2 text-sm font-bold shadow-btn transition",
          ocupado
            ? "scale-95 bg-gradient-to-br from-mint to-accent-teal text-white"
            : "bg-gradient-to-br from-accent to-accent-strong text-white hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0",
        ].join(" ")}
        onClick={act}
      >
        {etiquetaAccion}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Virtual Find Box (Ctrl+F, Escape)                                   */
/* ------------------------------------------------------------------ */
function VirtualFindBox({ combo, completed, triggerSignal, onAction, scene }: EnvProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const SAMPLE = "El gato saltó sobre la mesa. El perro corrió por el jardín. El niño leyó un libro.";
  const texto = scene?.page ?? SAMPLE;
  const buscado = scene?.find;
  /* Posición de la coincidencia, para poder partir el texto y pintarla. */
  const corte = buscado ? texto.indexOf(buscado) : -1;
  const resaltar = open && corte >= 0;

  useKeyboardTrigger(triggerSignal, () => act());

  function act() {
    if (completed) return;
    const k = combo.key.toLowerCase();
    if (k === "f") {
      setOpen(true);
      /* El buscador aparece YA con lo buscado escrito y resaltado en el
         texto: si no, abrirlo no mostraba ningún resultado y no se entendía
         para qué sirve Ctrl+F. */
      if (buscado) setQuery(buscado);
      window.setTimeout(() => inputRef.current?.focus(), 50);
      onAction();
    } else if (k === "escape" && open) {
      setOpen(false);
      onAction();
    } else if (!open) {
      onAction();
    }
  }

  return (
    <div className="nv-escena flex flex-col gap-3 p-4">
      <div className="relative min-h-[8rem] rounded-xl bg-white/80 p-4 text-sm text-text shadow-inner">
        <p>
          {resaltar ? (
            <>
              {texto.slice(0, corte)}
              <mark className="rounded bg-amber-300/70 px-0.5 font-semibold text-text animate-reward-pop">
                {buscado}
              </mark>
              {texto.slice(corte + (buscado?.length ?? 0))}
            </>
          ) : (
            texto
          )}
        </p>
        {open && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-lg border border-white/80 bg-white/90 px-2 py-1 shadow-card animate-modal-in">
            <input
              ref={inputRef}
              className="w-40 sm:w-56 bg-transparent text-xs text-text placeholder:text-muted/70 outline-none"
              placeholder="Buscar en la página…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {resaltar && (
              <span className="whitespace-nowrap rounded-full bg-mint/30 px-1.5 text-[10px] font-bold text-accent-teal">
                1 de 1
              </span>
            )}
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded-full text-sm text-muted transition hover:bg-rose/20 hover:text-rose"
              onClick={() => { setOpen(false); setQuery(""); }}
            >
              ×
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        className={[
          "self-center rounded-full px-4 py-2 text-sm font-bold shadow-btn transition",
          open
            ? "bg-gradient-to-br from-mint to-accent-teal text-white"
            : "bg-gradient-to-br from-accent to-accent-strong text-white hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0",
        ].join(" ")}
        onClick={act}
      >
        {combo.key.toLowerCase() === "f"
          ? open ? "Buscar abierto ✓" : "Abrir buscador"
          : "Cerrar buscador"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Virtual Dialog (Enter / Escape)                                     */
/* ------------------------------------------------------------------ */
function VirtualDialog({ combo, completed, triggerSignal, onAction, dialog, stepIndex }: EnvProps) {
  const [state, setState] = useState<"idle" | "open" | "done">("open");
  useKeyboardTrigger(triggerSignal, () => act());

  /* Con guion el escenario no se remonta entre pasos, así que dos carteles
     seguidos compartirían el estado y el segundo ya aparecería contestado.
     Al cambiar de paso el cartel vuelve a abrirse. */
  useEffect(() => { setState("open"); }, [stepIndex]);

  function act() {
    if (completed || state === "done") return;
    const k = combo.key.toLowerCase();
    if (k === "enter") { setState("done"); onAction(); }
    else if (k === "escape") { setState("idle"); onAction(); }
    else onAction();
  }

  const peligro = dialog?.danger === true;

  return (
    <div className="nv-escena flex flex-col items-center gap-3 p-4">
      <div className="relative flex w-full min-h-[8rem] flex-col items-center justify-center rounded-xl bg-white/80 p-4 text-center text-sm text-text shadow-inner">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          {dialog?.app ?? "Una app"}
        </p>
        {state === "open" && (
          <div
            className={[
              "mt-3 w-full max-w-sm animate-modal-in rounded-2xl border p-4 shadow-card",
              peligro
                ? "border-rose/40 bg-rose/10 ring-2 ring-rose/30"
                : "border-white/80 bg-white/95",
            ].join(" ")}
          >
            {peligro && (
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-rose">
                ⚠ Cuidado
              </p>
            )}
            <p className="text-sm font-semibold text-text">
              {dialog?.question ?? "¿Guardar antes de salir?"}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className={[
                  "rounded-full px-4 py-1.5 text-xs font-bold shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0",
                  peligro
                    ? "border border-text/15 bg-white text-text"
                    : "bg-gradient-to-br from-accent to-accent-strong text-white",
                ].join(" ")}
                onClick={() => { setState("done"); if (!completed) onAction(); }}
              >
                {dialog?.accept ?? "Aceptar"} (Enter)
              </button>
              <button
                type="button"
                className={[
                  "rounded-full px-4 py-1.5 text-xs font-bold shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0",
                  peligro
                    ? "bg-gradient-to-br from-rose to-accent-pink text-white"
                    : "border border-text/15 bg-white text-text",
                ].join(" ")}
                onClick={() => { setState("idle"); if (!completed) onAction(); }}
              >
                {dialog?.cancel ?? "Cancelar"} (Escape)
              </button>
            </div>
          </div>
        )}
        {state === "done" && (
          <p className="mt-2 rounded-full bg-mint/25 px-3 py-1 text-xs font-bold text-accent-teal animate-reward-pop">
            ✓ {dialog?.resultAccept ?? "¡Aceptado!"}
          </p>
        )}
        {state === "idle" && (
          <p className="mt-2 rounded-full bg-rose/20 px-3 py-1 text-xs font-bold text-rose animate-reward-pop">
            ✗ {dialog?.resultCancel ?? "Cancelado."}
          </p>
        )}
      </div>
      {state !== "open" && (
        <button
          type="button"
          className="self-center rounded-full bg-gradient-to-br from-mint to-accent-teal px-4 py-2 text-sm font-bold text-white shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0"
          onClick={() => setState("open")}
        >
          Abrir diálogo otra vez
        </button>
      )}
      <button
        type="button"
        className="self-center rounded-full bg-gradient-to-br from-accent to-accent-strong px-4 py-2 text-sm font-bold text-white shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0"
        onClick={act}
        style={{ marginTop: state !== "open" ? "0.5rem" : undefined }}
      >
        {combo.key.toLowerCase() === "enter"
          ? `${dialog?.accept ?? "Aceptar"} (Enter)`
          : `${dialog?.cancel ?? "Cancelar"} (Escape)`}
      </button>
    </div>
  );
}

/* ================================================================== */
/* Editor virtual — UN DOCUMENTO (Ctrl+A/C/V/Z/Y/S)                   */
/*                                                                     */
/* Antes esto estaba partido en dos simuladores y ninguno cerraba la   */
/* idea: acá vivían seleccionar, copiar, pegar y deshacer, y en otro   */
/* lado, con su propio estado, guardar y rehacer. O sea que Ctrl+Y no  */
/* podía devolver lo que había sacado Ctrl+Z — estaban en pantallas    */
/* distintas — y Ctrl+S guardaba un documento en el que no habías      */
/* escrito nada. Ahora es un solo documento, con historial de verdad y */
/* con el cartel de "sin guardar", que es lo que le da sentido a       */
/* apretar Ctrl+S.                                                     */
/* ================================================================== */
const SOURCE_TEXT = "¡Hola! Soy un texto para copiar.";

function VirtualTextEditor({ combo, completed, triggerSignal, onAction, scene, stepIndex }: EnvProps) {
  const sourceText = scene?.source ?? SOURCE_TEXT;
  /* La selección es SIMULADA con estado interno — nunca se toca la selección
     real del DOM, así que Ctrl+A no puede seleccionar la página entera. */
  const [seleccionado, setSeleccionado] = useState(false);
  const [portapapeles, setPortapapeles] = useState(scene?.clipboard ?? "");

  /* Historial de verdad del documento: `pila[pos]` es lo que se ve, Ctrl+Z
     retrocede y Ctrl+Y avanza. Con un simple "borrar lo pegado" no se podía
     mostrar qué rehace Ctrl+Y, que es justo lo que cuesta entender. */
  const [pila, setPila] = useState<string[]>([""]);
  const [pos, setPos] = useState(0);
  /* En qué punto del historial está lo que hay guardado en la compu. Si el
     documento se mueve de ahí — pegando, deshaciendo o rehaciendo — queda
     "sin guardar" solo, sin tener que acordarse de marcarlo en cada acción. */
  const [guardadoEn, setGuardadoEn] = useState(0);
  const [aviso, setAviso] = useState<"" | "deshecho" | "rehecho" | "guardado">("");
  const avisoTimer = useRef<number | null>(null);
  /* Freno anti-doble-clic: sin esto, dos clics rápidos en el botón pegan dos
     veces y puntúan una sola, y el documento queda distinto de lo que dice
     el paso. Se suelta al cambiar de paso para no comerse el intento
     siguiente. */
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { setOcupado(false); }, [stepIndex]);

  useEffect(() => () => { if (avisoTimer.current) window.clearTimeout(avisoTimer.current); }, []);

  function avisar(que: "deshecho" | "rehecho" | "guardado") {
    if (avisoTimer.current) window.clearTimeout(avisoTimer.current);
    setAviso(que);
    avisoTimer.current = window.setTimeout(() => setAviso(""), 1600);
  }

  const texto = pila[pos];
  const sinGuardar = pos !== guardadoEn;

  useKeyboardTrigger(triggerSignal, () => act());

  function act() {
    if (completed || ocupado) return;
    setOcupado(true);
    window.setTimeout(() => setOcupado(false), 600);

    const k = combo.key.toLowerCase();
    if (k === "a") {
      setSeleccionado(true);
    } else if (k === "c") {
      setSeleccionado(true);
      setPortapapeles(sourceText);
    } else if (k === "v") {
      /* Un cambio nuevo borra lo que había para rehacer, igual que en
         cualquier editor: si escribís después de deshacer, ya no se puede
         volver adelante. */
      const corte = pila.slice(0, pos + 1);
      setPila([...corte, portapapeles || sourceText]);
      setPos(corte.length);
    } else if (k === "z") {
      if (pos > 0) { setPos(pos - 1); avisar("deshecho"); }
    } else if (k === "y") {
      if (pos < pila.length - 1) { setPos(pos + 1); avisar("rehecho"); }
    } else if (k === "s") {
      setGuardadoEn(pos);
      avisar("guardado");
    }
    onAction();
  }

  const k = combo.key.toLowerCase();
  const etiquetaAccion =
    k === "a" ? "Seleccionar todo" :
    k === "c" ? "Copiar" :
    k === "v" ? "Pegar" :
    k === "z" ? "Deshacer" :
    k === "y" ? "Rehacer" :
    k === "s" ? "Guardar" :
    "Hacer la acción";

  return (
    <div className="nv-escena flex flex-col gap-3 p-4">
      {/* Barra del documento. El cartel de la derecha es medio nivel entero:
          sin él, guardar no se distingue de no guardar. */}
      <div className="flex items-center gap-3 rounded-xl border border-white/70 bg-gradient-to-b from-white/90 to-bg-soft/70 px-3 py-1.5 text-[11px] font-semibold text-muted shadow-sm">
        <span aria-hidden="true">📄</span>
        <span className="truncate font-bold text-text">{scene?.docLabel ?? "documento.doc"}</span>
        <span className="hidden sm:inline">Archivo</span>
        <span className="hidden sm:inline">Editar</span>
        <span className="hidden sm:inline">Ver</span>
        <span
          className={[
            "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
            sinGuardar
              ? "bg-amber-100 text-amber-900"
              : "bg-mint/25 text-accent-teal",
            aviso === "guardado" ? "animate-reward-pop" : "",
          ].join(" ")}
        >
          {sinGuardar ? "● Sin guardar" : "✓ Guardado"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 rounded-xl bg-white/70 p-3 shadow-inner">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {scene?.sourceLabel ?? "Texto fuente"}
          </span>
          {/* user-select:none evita que el navegador la seleccione de verdad;
              el resaltado de la selección simulada va por clases. */}
          <p
            className={[
              "select-none rounded-lg p-2 text-sm transition",
              seleccionado ? "bg-accent/25 text-text ring-2 ring-accent/40" : "text-text/80",
            ].join(" ")}
          >
            {sourceText}
          </p>
          {seleccionado && (
            <span className="self-start rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-bold text-accent-strong animate-reward-pop">
              ✓ seleccionado
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl bg-white/70 p-3 shadow-inner">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {scene?.targetLabel ?? "Área de trabajo"}
          </span>
          <div
            className="min-h-[4rem] rounded-lg border border-dashed border-white/80 bg-white/60 p-2 text-sm text-text"
            aria-label="Área de trabajo"
          >
            {texto ? texto : (
              <span className="italic text-muted/70">Acá aparecerá lo que pegues…</span>
            )}
          </div>
          {aviso === "deshecho" && (
            <span className="self-start rounded-full bg-accent-sky/25 px-2 py-0.5 text-[11px] font-bold text-accent-strong animate-reward-pop">
              ↩ deshecho
            </span>
          )}
          {aviso === "rehecho" && (
            <span className="self-start rounded-full bg-mint/30 px-2 py-0.5 text-[11px] font-bold text-accent-teal animate-reward-pop">
              ↪ rehecho — volvió sin escribirlo de nuevo
            </span>
          )}
        </div>
      </div>

      {/* El portapapeles, a la vista. Es lo único del copiar-y-pegar que en la
          computadora de verdad es invisible, y por eso copiar parecía no hacer
          nada: acá se ve que Ctrl+C lo llena y que Ctrl+V lo usa. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/55 px-3 py-2 shadow-inner">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">📋 Portapapeles</span>
        {portapapeles ? (
          <span className="rounded-lg bg-mint/25 px-2 py-1 text-xs font-semibold text-accent-teal">
            «{portapapeles}»
          </span>
        ) : (
          <span className="text-xs italic text-muted/70">vacío — todavía no copiaste nada</span>
        )}
      </div>
      <button
        type="button"
        className="self-center rounded-full bg-gradient-to-br from-accent to-accent-strong px-4 py-2 text-sm font-bold text-white shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0"
        onClick={act}
      >
        {etiquetaAccion}
      </button>
    </div>
  );
}
