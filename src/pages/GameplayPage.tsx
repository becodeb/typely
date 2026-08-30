import { ArrowRight, RotateCcw, Star, Volume2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getActivityById } from "../data/activities";
import { assets } from "../utils/assets";
import { getGameplayBackground } from "../data/worlds";
import { getStarsFromAccuracy, getTotalStars, markLevelComplete } from "../utils/progress";
import { achievementMeta } from "../data/achievements";
import { SkillLevelView } from "./SkillLevelView";
import { ShortcutLevelView } from "./ShortcutLevelView";
import { StarCounter } from "../components/common/StarCounter";
import { CharacterSkin } from "../components/common/CharacterSkin";
import { LevelStarReward } from "../components/common/LevelStarReward";
import { SkinUnlockCelebration } from "../components/common/SkinUnlockCelebration";

const MOTIVATION_PHRASES = [
  "¡Vamos que podés!",
  "Probá despacio.",
  "Respirá y seguí.",
  "Buen ritmo 👏",
  "Sos un crack.",
  "¡Increíble, así se hace!",
  "Una más y la sacás.",
  "Practicar es ganar.",
];

const ERROR_PHRASES = [
  "Tranqui, intentá de nuevo.",
  "Todos nos equivocamos.",
  "Mirá la tecla y volvelo a intentar.",
  "¡Casi! Otra vez.",
];

type KeyboardRow = { id: string; tone: "num" | "top" | "home" | "bot" | "mod"; keys: string[] };

const keyboardRows: KeyboardRow[] = [
  { id: "num",  tone: "num",  keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "'", "¿"] },
  { id: "top",  tone: "top",  keys: ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "´"] },
  { id: "home", tone: "home", keys: ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"] },
  { id: "bot",  tone: "bot",  keys: ["Z", "X", "C", "V", "B", "N", "M", ",", ".", "-", "Backspace"] },
  { id: "mod",  tone: "mod",  keys: ["Shift", "Space", "Enter"] },
];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/* Accented vowels: on a Spanish keyboard you press the dead key ´ then the
   vowel; on an English/US keyboard the OS gives you the same letter via
   Option/AltGr + the vowel. We show ´ + a as the universal hint — the kid
   recognises "the tilde mark, then the letter". */
const ACCENT_MAP: Record<string, string> = {
  "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u",
  "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U",
};

/* Dieresis/umlaut (¨) is a DIFFERENT dead key on ES keyboards. ¨ lives on
   the ´ key but ONLY when Shift is held (without Shift, ´ is the acute
   accent). The right teaching combo is therefore Shift + ´ then the vowel —
   NOT just ´ + u (which on ES-LA would produce "ú", not "ü"). The user
   explicitly asked for this fix. */
const DIERESIS_MAP: Record<string, string> = {
  "ü": "u",
  "Ü": "U",
};

/* Shift combinations on a Latin-American Spanish keyboard.
   Keys on the right of the table reference the *cap labels* used by the
   visual keyboard above, so highlighting works without any extra mapping. */
const SHIFT_COMBOS: Record<string, string[]> = {
  "!":  ["Shift", "1"],
  "?":  ["Shift", "'"],   // ES-LA: ? lives on the ' key
  /* @ is special: on ES-LA keyboards it is AltGr + Q (or AltGr + 2 on ES-ES).
     We surface AltGr + Q as the primary combo and light up the Q cap. The
     `comboFor()` helper adds the playful "o también Shift + 2" hint. */
  "@":  ["AltGr", "Q"],
  "#":  ["Shift", "3"],
  "$":  ["Shift", "4"],
  "%":  ["Shift", "5"],
  "&":  ["Shift", "7"],
  "*":  ["Shift", "8"],
  "(":  ["Shift", "9"],
  ")":  ["Shift", "0"],
  "_":  ["Shift", "-"],
  "+":  ["Shift", "="],
  ":":  ["Shift", "."],
  ";":  ["Shift", ","],
  "¡":  ["Shift", "¿"],   // ¡ is Shift on the ¿ cap
  '"':  ["Shift", "'"],
  "<":  ["Shift", ","],
  ">":  ["Shift", "."],
};

/* Friendly alternate ways to type the same symbol — purely informational,
   rendered as a secondary hint below the primary combo. */
const SECONDARY_COMBOS: Record<string, string[][]> = {
  "@": [["Shift", "2"], ["AltGr", "2"]],
};

/* Maps a character → the cap printed on our visual keyboard. */
function keyCapFor(character: string): string {
  if (!character) return "";
  if (character === " ") return "Space";
  // Accented vowels, dieresis & ñ render on the keyboard as the *base* letter.
  if (ACCENT_MAP[character]) return ACCENT_MAP[character].toUpperCase();
  if (DIERESIS_MAP[character]) return DIERESIS_MAP[character].toUpperCase();
  if (/^[a-zA-Z]$/.test(character)) return character.toUpperCase();
  if (character === "ñ" || character === "Ñ") return "Ñ";
  return character; // digits, punctuation, ¿, ', etc. render as-is.
}

/* Returns the set of keyboard caps to highlight for a given target char.
   - lowercase letter / digit / punctuation that exists on the keyboard → 1 key
   - Shift combo                                                       → 2 keys
   - uppercase letter                                                   → 2 keys (Shift + LETTER)
   - accented vowel                                                     → 1 key (base letter)
   - uppercase accented vowel                                           → 2 keys (Shift + LETTER)
   - dieresis (ü / Ü)                                                   → 1 key (base letter U);
                                                                           the visual hint in `comboFor`
                                                                           covers the Shift + ´ combo.
*/
function expectedKeysFor(character: string): string[] {
  if (!character) return [];
  if (SHIFT_COMBOS[character]) return SHIFT_COMBOS[character];

  // Accented vowel
  if (ACCENT_MAP[character]) {
    const base = ACCENT_MAP[character];
    if (/[A-Z]/.test(base)) return ["Shift", base];
    return [base.toUpperCase()];
  }

  // Dieresis (ü / Ü) — highlight the base letter only; Shift + ´ is a hint,
  // not a key the kid is supposed to press for the cap highlight.
  if (DIERESIS_MAP[character]) {
    return [DIERESIS_MAP[character].toUpperCase()];
  }

  // Plain uppercase letter (a-z or Ñ)
  if (/^[A-ZÑ]$/.test(character)) return ["Shift", character];

  return [keyCapFor(character)];
}

function expectedKeysForActivity(character: string, activity: ReturnType<typeof getActivityById>): string[] {
  const keys = expectedKeysFor(character);
  const teachesShift = activity.requiresShift || activity.worldId === "island3" || activity.worldId === "island4";
  if (teachesShift) return keys;
  return keys.filter((key) => key !== "Shift");
}

function comboFor(character: string): string[] | null {
  if (!character) return null;
  if (SHIFT_COMBOS[character]) return SHIFT_COMBOS[character];

  // Accented vowels — show the dead-key combo (´ + vowel). Uppercase accented
  // letters also need Shift, so we surface a 3-step hint.
  if (ACCENT_MAP[character]) {
    const base = ACCENT_MAP[character];
    if (base === base.toUpperCase() && /[A-Z]/.test(base)) {
      return ["´", "Shift", base.toLowerCase().toUpperCase()];
    }
    return ["´", base];
  }

  // Dieresis (ü / Ü) — the dead key ¨ lives on Shift + ´ on ES keyboards.
  // Hint: Shift + ´ (then the vowel). Uppercase adds a second Shift.
  if (DIERESIS_MAP[character]) {
    const base = DIERESIS_MAP[character];
    if (base === base.toUpperCase()) {
      return ["Shift", "´", "Shift", base];
    }
    return ["Shift", "´", base];
  }

  // Plain uppercase letters always need Shift + the lowercase letter.
  if (/^[A-ZÑ]$/.test(character)) {
    const lower = character.toLowerCase();
    return ["Shift", lower.toUpperCase()];
  }
  return null;
}

function objectivePrompt(activity: ReturnType<typeof getActivityById>, target: string, index = 0): string {
  if (!target) return "Prepará tus dedos.";
  // Correction levels start with a wrong prefilled word and tell the kid what
  // to fix, so they read as a real "borrá y corregí" task, not blank typing.
  if (activity.inputType === "correction") {
    return activity.correctionHints?.[index] ?? "Usá Backspace para borrar el error y escribí lo correcto.";
  }
  if (activity.inputType === "letter") return `Tocá la letra ${target.toUpperCase()}.`;
  if (activity.inputType === "symbol") return `Escribí el símbolo ${target}.`;
  return `Escribí "${target}".`;
}

/* A short, specific hint for an exact-character mismatch (case / accent / ñ).
   `expected` is the single character the target wants next; `typedChar` is
   what the student actually pressed. */
function exactCharHint(expected: string, typedChar: string): string {
  if (!expected) return "Usá Backspace para corregir.";
  // Same letter, only the case differs → they need Shift.
  if (typedChar.toLowerCase() === expected.toLowerCase()) {
    if (/[A-ZÑ]/.test(expected)) return "Usá Shift para la mayúscula.";
    return `Esperaba "${expected}".`;
  }
  // Same base letter, the accent/tilde differs.
  if (stripAccents(typedChar.toLowerCase()) === stripAccents(expected.toLowerCase())) {
    return "Te falta la tilde. Usá ´ y después la vocal.";
  }
  if (expected === "ñ" || expected === "Ñ") return "Buscá la tecla Ñ.";
  return `Esperaba "${expected}". Probá de nuevo.`;
}

function keyLocationHint(character: string): string {
  const cap = keyCapFor(character);
  if (!cap) return "";
  const row = keyboardRows.find((item) => item.keys.includes(cap));
  const rowLabels: Record<string, string> = {
    num: "fila de números",
    top: "fila de arriba",
    home: "fila central",
    bot: "fila de abajo",
    mod: "teclas grandes",
  };
  return row ? `Buscá ${cap === "Space" ? "Espacio" : `la tecla ${cap}`} en la ${rowLabels[row.tone]}.` : "";
}

function playErrorSound() {
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(180, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(110, context.currentTime + 0.12);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.14);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.15);
  window.setTimeout(() => void context.close(), 220);
}

export function GameplayPage() {
  const { activityId } = useParams();
  const activity = getActivityById(activityId);
  const navigate = useNavigate();

  /* Digital-skill levels (island 5) use a dedicated mini-shell rather than
     the typing keyboard pipeline. We early-return before any keyboard
     state is set up so the two modes stay cleanly isolated. */
  if (activity.inputType === "skill") {
    return <SkillLevelView activity={activity} />;
  }
  /* Keyboard-shortcut levels (comandos, ventanas/pestañas, atajos) use the
     generic shortcut engine. Like skill levels, return before keyboard state. */
  if (activity.inputType === "shortcut") {
    return <ShortcutLevelView activity={activity} />;
  }
  const [targetIndex, setTargetIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [errors, setErrors] = useState(0);
  const [feedback, setFeedback] = useState(() => objectivePrompt(activity, activity.targets[0] ?? ""));
  const [lastKey, setLastKey] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [isErrorActive, setIsErrorActive] = useState(false);
  const [isIdleHintActive, setIsIdleHintActive] = useState(false);
  /* La misión se anuncia al entrar al nivel y después baja a reposo, para no
     competir con el objetivo. Se vuelve a encender con el MISMO gatillo de
     inactividad que ya hace pulsar la tecla pista: si el chico quedó quieto,
     lo más probable es que no sepa qué hacer. */
  const [misionEntrada, setMisionEntrada] = useState(true);
  const [inputSignal, setInputSignal] = useState(0);
  const [unlockedAch, setUnlockedAch] = useState<string[]>([]);
  /* Suma de estrellas a la colección (barra del modal): total ANTES/DESPUÉS de
     completar el nivel. `celebPhase` dispara la celebración de personaje nuevo
     DESPUÉS de que la barra termina de llenarse. */
  const [starRun, setStarRun] = useState<{ before: number; after: number } | null>(null);
  const [celebPhase, setCelebPhase] = useState<number | null>(null);
  const completionSaved = useRef(false);
  const activityRef = useRef(activity);
  const advanceTimeoutRef = useRef<number | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);
  const typedScrollRef = useRef<HTMLSpanElement | null>(null);
  const targetScrollRef = useRef<HTMLElement | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);

  /* Latest state lives in refs so the beforeinput handler can read up-to-date
     values without being torn down/rebuilt on every keystroke (which loses
     focus on some Android browsers). */
  const stateRef = useRef({
    targetIndex: 0,
    typed: "",
    isCompleted: false,
    attempts: 0,
    errors: 0,
    isAdvancing: false,
  });

  activityRef.current = activity;

  const totalObjectives = Math.max(1, activity.targets.length);
  const currentTargetIndex = Math.min(targetIndex, totalObjectives - 1);
  const target = activity.targets[currentTargetIndex] ?? "";
  const visibleObjective = isCompleted ? totalObjectives : Math.min(currentTargetIndex + 1, totalObjectives);

  /* For word/phrase/correction levels the typed text must stay an exact prefix
     of the target. If it isn't (e.g. a correction level's prefilled mistake,
     or a wrong char left in), the player must Backspace before continuing. */
  const typedIsValidPrefix = typed === target.slice(0, typed.length);
  const mustBackspace =
    activity.inputType !== "letter" &&
    activity.inputType !== "symbol" &&
    typed.length > 0 &&
    !typedIsValidPrefix;

  const expectedChar = useMemo(() => {
    if (activity.inputType === "letter" || activity.inputType === "symbol") {
      return target;
    }
    if (!typedIsValidPrefix) return ""; // must backspace first
    return target[typed.length] ?? "";
  }, [activity.inputType, target, typed, typedIsValidPrefix]);

  /* Every keyboard cap that should glow for the current character.
     Multi-key combos (Shift + 1, Shift + ¿) light up *both* caps.
     While a mistake needs deleting, the Backspace cap glows instead. */
  const expectedKeys = useMemo(() => {
    if (mustBackspace) return new Set<string>(["Backspace"]);
    if (!expectedChar) return new Set<string>();
    return new Set(expectedKeysForActivity(expectedChar, activity));
  }, [activity, expectedChar, mustBackspace]);

  const locationHint = keyLocationHint(expectedChar);
  const commaHint = target.includes(",");

  const accuracy = attempts === 0 ? 100 : Math.max(0, Math.round(((attempts - errors) / attempts) * 100));

  /* Keep the ref in sync with React state so the imperative input handlers
     below always read the latest values. */
  useEffect(() => {
    stateRef.current.targetIndex = currentTargetIndex;
    stateRef.current.typed = typed;
    stateRef.current.isCompleted = isCompleted;
    stateRef.current.attempts = attempts;
    stateRef.current.errors = errors;
  }, [currentTargetIndex, typed, isCompleted, attempts, errors]);

  function persistCompletion(finalAccuracy: number, finalAttempts: number) {
    if (completionSaved.current) return;
    completionSaved.current = true;
    const currentActivity = activityRef.current;
    /* Total de la cuenta ANTES de guardar; markLevelComplete escribe el
       progreso de forma síncrona, así que el total DESPUÉS ya refleja la
       ganancia neta (sólo cuenta el mejor resultado por nivel). */
    const before = getTotalStars();
    void markLevelComplete(currentActivity.worldId, currentActivity.levelNumber, finalAccuracy, finalAttempts).then((unlocked) => {
      if (unlocked.length) setUnlockedAch(unlocked);
    });
    const after = getTotalStars();
    setStarRun({ before, after });
  }

  function targetAt(index: number) {
    const targets = activityRef.current.targets;
    const lastIndex = Math.max(0, targets.length - 1);
    return targets[Math.min(index, lastIndex)] ?? "";
  }

  function completeLevel() {
    if (stateRef.current.isCompleted) return;
    if (advanceTimeoutRef.current !== null) {
      window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    const currentActivity = activityRef.current;
    const lastIndex = Math.max(0, currentActivity.targets.length - 1);
    const finalAttempts = stateRef.current.attempts;
    const finalErrors = stateRef.current.errors;
    const finalAccuracy = finalAttempts === 0
      ? 100
      : Math.max(0, Math.round(((finalAttempts - finalErrors) / finalAttempts) * 100));

    stateRef.current.targetIndex = lastIndex;
    stateRef.current.isCompleted = true;
    stateRef.current.isAdvancing = false;
    setTargetIndex(lastIndex);
    persistCompletion(finalAccuracy, finalAttempts);
    setIsCompleted(true);
    setFeedback("¡Nivel completado! Ganaste estrellas.");
  }

  function advance() {
    if (stateRef.current.isCompleted) return;
    const currentActivity = activityRef.current;
    const lastIndex = Math.max(0, currentActivity.targets.length - 1);
    const nextIndex = stateRef.current.targetIndex + 1;

    if (nextIndex > lastIndex) {
      completeLevel();
      return;
    }

    const seeded =
      currentActivity.inputType === "correction"
        ? currentActivity.initialTexts?.[nextIndex] ?? ""
        : "";
    stateRef.current.targetIndex = nextIndex;
    stateRef.current.typed = seeded;
    stateRef.current.isAdvancing = false;
    setTargetIndex(nextIndex);
    setTyped(seeded);
    setFeedback(objectivePrompt(currentActivity, targetAt(nextIndex), nextIndex));
  }

  function recordAttempt(isError: boolean) {
    const nextAttempts = stateRef.current.attempts + 1;
    const nextErrors = stateRef.current.errors + (isError ? 1 : 0);
    stateRef.current.attempts = nextAttempts;
    stateRef.current.errors = nextErrors;
    setAttempts(nextAttempts);
    setErrors(nextErrors);
  }

  function showMistake(message: string) {
    setFeedback(message);
    setIsIdleHintActive(false);
    setIsErrorActive(true);
    playErrorSound();
    if (errorTimeoutRef.current !== null) window.clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = window.setTimeout(() => {
      setIsErrorActive(false);
      errorTimeoutRef.current = null;
    }, 520);
  }

  useEffect(() => {
    if (advanceTimeoutRef.current !== null) {
      window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    const firstSeeded =
      activity.inputType === "correction" ? activity.initialTexts?.[0] ?? "" : "";
    stateRef.current = {
      targetIndex: 0,
      typed: firstSeeded,
      isCompleted: false,
      attempts: 0,
      errors: 0,
      isAdvancing: false,
    };
    setTargetIndex(0);
    setTyped(firstSeeded);
    setAttempts(0);
    setErrors(0);
    setFeedback(objectivePrompt(activity, activity.targets[0] ?? "", 0));
    setIsCompleted(false);
    setIsErrorActive(false);
    setIsIdleHintActive(false);
    setInputSignal((value) => value + 1);
    completionSaved.current = false;
    return () => {
      if (advanceTimeoutRef.current !== null) {
        window.clearTimeout(advanceTimeoutRef.current);
        advanceTimeoutRef.current = null;
      }
      if (errorTimeoutRef.current !== null) {
        window.clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
    };
  }, [activity.id]);

  useEffect(() => {
    if (isCompleted || !expectedChar) {
      setIsIdleHintActive(false);
      return;
    }

    setIsIdleHintActive(false);
    const show = window.setTimeout(() => setIsIdleHintActive(true), 4500);
    const hide = window.setTimeout(() => setIsIdleHintActive(false), 6400);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [currentTargetIndex, expectedChar, inputSignal, isCompleted, typed]);

  /* La misión se anuncia al ABRIR el nivel y baja a reposo sola. No se
     re-dispara con cada objetivo: al tercer acierto ya sería ruido y volvería
     a ser invisible por costumbre. */
  useEffect(() => {
    setMisionEntrada(true);
    const bajar = window.setTimeout(() => setMisionEntrada(false), 2800);
    return () => window.clearTimeout(bajar);
  }, [activity.id]);

  /* Y vuelve a encenderse cuando el chico se queda quieto — el mismo gatillo
     que hace pulsar la tecla pista. Si no sabe qué hacer, lo primero que
     tiene que volver a mirar es la consigna. */
  useEffect(() => {
    if (!isIdleHintActive || isCompleted) return;
    setMisionEntrada(true);
    const bajar = window.setTimeout(() => setMisionEntrada(false), 2000);
    return () => window.clearTimeout(bajar);
  }, [isIdleHintActive, isCompleted]);

  /* Keep the typed-preview pinned to the most recent character so long inputs
     stay legible without wrapping to a new line. */
  useEffect(() => {
    const node = typedScrollRef.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, [typed]);

  /* Auto-scroll the TARGET phrase so the character the student is currently on
     stays centred in view. No visible scrollbar — we drive scrollLeft directly
     (works even with overflow:hidden). */
  useEffect(() => {
    const node = targetScrollRef.current;
    if (!node) return;
    if (node.scrollWidth <= node.clientWidth) {
      node.scrollLeft = 0;
      return;
    }
    const ratio = target.length ? Math.min(1, typed.length / target.length) : 0;
    const desired = ratio * node.scrollWidth - node.clientWidth / 2;
    node.scrollLeft = Math.max(0, Math.min(desired, node.scrollWidth - node.clientWidth));
  }, [typed, target]);

  /* Process one logical character (with accent, ñ, mayúscula already
     composed by the OS). Reused by both the physical-keyboard fallback and
     the beforeinput / composition pipeline used by touch keyboards. */
  function processCharacter(character: string) {
    if (stateRef.current.isCompleted) return;
    if (stateRef.current.isAdvancing) return;
    if (!character || character.length === 0) return;
    setIsIdleHintActive(false);
    setInputSignal((value) => value + 1);

    if (character === " ") setLastKey("Space");
    else setLastKey(keyCapFor(character));

    const currentActivity = activityRef.current;
    const currentTarget = targetAt(stateRef.current.targetIndex);

    if (currentActivity.inputType === "letter") {
      const isCorrect = character.toUpperCase() === currentTarget.toUpperCase();
      recordAttempt(!isCorrect);
      if (isCorrect) {
        advance();
      } else {
        showMistake(`Buscá la tecla ${currentTarget.toUpperCase()}.`);
      }
      return;
    }

    if (currentActivity.inputType === "symbol") {
      const isCorrect = character === currentTarget;
      recordAttempt(!isCorrect);
      if (isCorrect) advance();
      else {
        showMistake(`Escribí el símbolo ${currentTarget}.`);
      }
      return;
    }

    const currentTyped = stateRef.current.typed;
    const validPrefix = currentTarget.slice(0, currentTyped.length);
    const typedIsValid = currentTyped === validPrefix;

    /* Existing text already holds an uncorrected mistake (correction prefill,
       or a wrong char the kid left in). Block new input until they Backspace. */
    if (!typedIsValid) {
      recordAttempt(true);
      showMistake("Usá Backspace para borrar el error y seguí.");
      return;
    }

    const nextTyped = currentTyped + character;
    const targetSoFar = currentTarget.slice(0, nextTyped.length);
    // EXACT match — case, accents (tildes) and ñ must all match. A lowercase
    // letter for an uppercase target, or a missing tilde, counts as an error.
    const isExact = nextTyped === targetSoFar;

    if (!isExact) {
      const expected = currentTarget[currentTyped.length] ?? "";
      recordAttempt(true);
      showMistake(exactCharHint(expected, character));
      // Correction levels LET the wrong char land so the kid sees it and
      // practises deleting it; normal levels simply block the wrong key.
      if (currentActivity.inputType === "correction") {
        stateRef.current.typed = nextTyped;
        setTyped(nextTyped);
      }
      return;
    }

    recordAttempt(false);
    stateRef.current.typed = nextTyped;
    setTyped(nextTyped);
    if (nextTyped === currentTarget) {
      setFeedback("¡Excelente!");
      stateRef.current.isAdvancing = true;
      if (advanceTimeoutRef.current !== null) window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = window.setTimeout(() => {
        advanceTimeoutRef.current = null;
        advance();
      }, 350);
    } else {
      setFeedback("Vas muy bien.");
    }
  }

  function processBackspace() {
    if (stateRef.current.isCompleted) return;
    if (stateRef.current.isAdvancing) return;
    setIsIdleHintActive(false);
    setInputSignal((value) => value + 1);
    setLastKey("Backspace");
    const currentActivity = activityRef.current;
    if (currentActivity.inputType === "letter" || currentActivity.inputType === "symbol") return;
    const next = stateRef.current.typed.slice(0, -1);
    stateRef.current.typed = next;
    setTyped(next);
    /* Correction levels can be finished purely by deleting extra characters
       (e.g. "holaa" → "hola"). Complete the objective when the cleaned-up text
       exactly matches the target. */
    const currentTarget = targetAt(stateRef.current.targetIndex);
    if (next === currentTarget) {
      setFeedback("¡Excelente!");
      stateRef.current.isAdvancing = true;
      if (advanceTimeoutRef.current !== null) window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = window.setTimeout(() => {
        advanceTimeoutRef.current = null;
        advance();
      }, 350);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Input pipeline                                                     */
  /* A hidden <input> stays focused so:                                  */
  /*   - mobile / Chrome touch devices can pop up the OS keyboard,       */
  /*   - dead keys (´ + a → á) and IME-composed text come through        */
  /*     beforeinput / compositionend with the *final* character,        */
  /*   - AltGr combos (e.g. AltGr+Q → @ on ES-LA) are not blocked.       */
  /* On desktop the window-level keydown is still used as a fallback so  */
  /* keys arrive even if the hidden input briefly loses focus. */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const input = captureInputRef.current;
    if (!input) return;

    /* React's synthetic onBeforeInput is *not* a 1:1 alias for the native
       beforeinput event — it's a polyfilled compositionend on most engines.
       We attach the listener natively so dead keys + touch keyboards on
       real Chrome / Edge / Safari deliver composed characters reliably. */
    function onBeforeInput(this: HTMLInputElement, ev: Event) {
      const native = ev as InputEvent;
      const type = native.inputType;
      if (type === "deleteContentBackward" || type === "deleteContentForward" || type === "deleteByCut") {
        ev.preventDefault();
        processBackspace();
        input!.value = "";
        return;
      }
      if (type && type.startsWith("insert")) {
        const data = native.data ?? "";
        if (data && data !== "´" && data !== "`" && data !== "^" && data !== "~" && data !== "¨") {
          for (const ch of data) processCharacter(ch);
        }
        // Android browsers ignore preventDefault — clear next tick to be safe.
        window.setTimeout(() => { if (input) input.value = ""; }, 0);
        ev.preventDefault();
      }
    }
    function onCompositionEnd(this: HTMLInputElement, ev: CompositionEvent) {
      const data = ev.data ?? "";
      if (data) for (const ch of data) processCharacter(ch);
      window.setTimeout(() => { if (input) input.value = ""; }, 0);
    }

    function refocus() {
      window.setTimeout(() => {
        const a = document.activeElement;
        if (a && a.tagName === "BUTTON") return;
        if (a && a.tagName === "INPUT" && a !== input) return;
        input?.focus({ preventScroll: true });
      }, 0);
    }

    input.addEventListener("beforeinput", onBeforeInput as EventListener);
    input.addEventListener("compositionend", onCompositionEnd as EventListener);
    input.focus({ preventScroll: true });
    window.addEventListener("pointerdown", refocus);
    window.addEventListener("touchend", refocus);
    return () => {
      input.removeEventListener("beforeinput", onBeforeInput as EventListener);
      input.removeEventListener("compositionend", onCompositionEnd as EventListener);
      window.removeEventListener("pointerdown", refocus);
      window.removeEventListener("touchend", refocus);
    };
    // processCharacter / processBackspace are stable via stateRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Backspace is captured here so even when the input is empty it still
      // erases a typed character.
      if (event.key === "Backspace") {
        event.preventDefault();
        processBackspace();
        return;
      }
      // Visual press feedback for modifier keys (so the cap glows).
      if (event.key === "Shift") { setLastKey("Shift"); return; }
      if (event.key === "CapsLock" || event.key === "Dead" || event.key === "Process") return;

      // Fallback character pipeline.
      // If the hidden capture input lost focus (e.g. the user clicked a
      // button outside it), beforeinput will not fire and the level would
      // silently ignore keystrokes — including uppercase letters typed with
      // Shift. We process the printable character here and refocus the
      // capture input so subsequent strokes go through the IME pipeline
      // again. We skip when isComposing so accented characters arrive
      // through compositionend instead.
      const active = document.activeElement;
      const captureFocused = active === captureInputRef.current;

      if (!captureFocused && !event.isComposing && event.key.length === 1) {
        // AltGr (Ctrl+Alt) on Windows still produces a printable character —
        // accept it. Skip raw Ctrl/Meta shortcuts.
        const isAltGr = event.ctrlKey && event.altKey;
        if (!isAltGr && (event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        processCharacter(event.key);
        captureInputRef.current?.focus({ preventScroll: true });
        return;
      }

      // Space scroll guard when no input focused.
      if (event.key === " " && !captureFocused && !event.isComposing) {
        event.preventDefault();
        processCharacter(" ");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.inputType, target]);

  function retry() {
    if (advanceTimeoutRef.current !== null) {
      window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    stateRef.current = {
      targetIndex: 0,
      typed: "",
      isCompleted: false,
      attempts: 0,
      errors: 0,
      isAdvancing: false,
    };
    setTargetIndex(0);
    setTyped("");
    setAttempts(0);
    setErrors(0);
    setFeedback(objectivePrompt(activityRef.current, activityRef.current.targets[0] ?? ""));
    setIsCompleted(false);
    setIsErrorActive(false);
    setIsIdleHintActive(false);
    setInputSignal((value) => value + 1);
    completionSaved.current = false;
    setStarRun(null);
    setCelebPhase(null);
  }

  function listen() {
    // El dictado dice QUÉ tipo de objetivo es y cuál es el objetivo concreto
    // ("Palabra a escribir: ventana", "Letra que toca: G"), no solo la
    // consigna genérica.
    const targetPhrase =
      activity.inputType === "letter" ? `Letra que toca: ${target}.` :
      activity.inputType === "symbol" ? `Símbolo que toca: ${target}.` :
      activity.inputType === "correction" ? `Corregí el texto para que quede: ${target}.` :
      /\s/.test(target) ? `Frase a escribir: ${target}.` :
      `Palabra a escribir: ${target}.`;
    const phrase = [activity.listenText ?? activity.instruction, targetPhrase].filter(Boolean).join(" ");
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = "es-AR";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setFeedback("Reproduciendo consigna.");
      return;
    }
    setFeedback(phrase);
  }

  return (
    <main
      className="flex flex-col h-dvh overflow-hidden container-type-[inline-size] animate-page-fade relative bg-cover bg-center"
      style={{ backgroundImage: `url("${getGameplayBackground(activity.worldId)}")` }}
    >
      {/* Hidden capture field — drives beforeinput/composition so accented
          characters work on touch & Spanish-layout keyboards. */}
      <input
        ref={captureInputRef}
        className="sr-only"
        type="text"
        defaultValue=""
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        lang="es"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => { e.currentTarget.value = ""; }}
        onBlur={(e) => {
          // If focus moved to a real interactive element (button/link) let it
          // keep focus. Otherwise re-grab so the keyboard stays available.
          const next = e.relatedTarget as HTMLElement | null;
          if (next && (next.tagName === "BUTTON" || next.tagName === "A")) return;
          window.setTimeout(() => captureInputRef.current?.focus({ preventScroll: true }), 30);
        }}
      />
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        {/* Contador de estrellas de la cuenta — sube al completar un nivel
            (escucha el evento edutic:progress). */}
        <StarCounter />
        {/* El botón de escuchar YA NO VIVE ACÁ: se mudó adentro de la misión.
            Escondido en la esquina, entre otros tres íconos redondos, no se
            leía como "la consigna se puede escuchar" — que es justo lo que
            necesita el chico que todavía no lee de corrido. */}
        <button
          type="button"
          onClick={retry}
          className="glass rounded-full w-12 h-12 flex items-center justify-center text-text shadow-btn hover:scale-105 transition-transform"
          aria-label="Reintentar"
          title="Reintentar"
        >
          <RotateCcw size={20} />
        </button>
        <button
          className="glass rounded-full w-12 h-12 flex items-center justify-center text-text shadow-btn hover:scale-105 transition-transform"
          type="button"
          onClick={() => navigate(`/worlds/${activity.worldId}`)}
          aria-label="Salir"
        >
          <X size={20} />
        </button>
      </div>

      {/* LA MISIÓN — antes era una cápsula de vidrio igual a todas las demás
          de la pantalla, y los chicos directamente no registraban que había
          una consigna. Ahora es la ÚNICA pieza con borde de degradé
          encendido, se anuncia al entrar al nivel y lleva el botón de
          escuchar adelante. Ver .gp-mision en global.css. */}
      {!isCompleted && (
        <div className="shrink-0 mt-5 mb-1 flex justify-center px-4 z-20" aria-live="polite">
          <div className={`gp-mision flex items-center gap-3 sm:gap-4 py-2.5 pl-3 pr-5 sm:pr-6 ${misionEntrada ? "gp-mision--entrada" : ""}`}>
            <span className="gp-mision__insignia inline-flex items-center gap-1 px-3 py-0.5 font-display font-extrabold text-[11px] uppercase tracking-wider">
              <Star size={11} fill="currentColor" strokeWidth={0} />
              Tu misión
            </span>
            <button
              type="button"
              onClick={listen}
              className="gp-mision__audio shrink-0 rounded-full w-11 h-11 sm:w-[3.25rem] sm:h-[3.25rem] flex items-center justify-center text-white transition-transform hover:scale-105"
              aria-label="Escuchar la consigna"
              title="Escuchar la consigna"
            >
              <Volume2 size={22} />
            </button>
            <span className="pt-0.5">
              <h1 className="font-display font-extrabold text-lg sm:text-[1.375rem] text-text leading-tight">{activity.instruction}</h1>
              <p className="text-[13px] sm:text-sm font-semibold leading-tight text-[#4a5f88]">{feedback}</p>
            </span>
          </div>
        </div>
      )}

      <section className="flex flex-col items-center justify-center gap-3 flex-1 min-h-0 px-4 py-1 z-10 overflow-hidden" aria-label={activity.title}>
        {(() => {
          const isPhrase = /\s/.test(target);
          const variant =
            activity.inputType === "letter" ? "letter" :
            activity.inputType === "symbol" ? "symbol" :
            isPhrase ? "phrase" :
            "word";
          const showCombo =
            activity.worldId === "island4" ||
            activity.worldId === "island3" ||
            activity.requiresShift ||
            activity.requiresAccent;
          const combo = showCombo ? comboFor(expectedChar) : null;
          const altCombos = showCombo && expectedChar ? SECONDARY_COMBOS[expectedChar] : undefined;
          const showTypedPreview =
            activity.inputType !== "letter" && activity.inputType !== "symbol";
          const isLongTarget = target.length > 14 || target.includes("@");

          const targetCardSize =
            variant === "letter" ? "text-[clamp(5rem,17vh,10rem)]" :
            variant === "symbol" ? "text-[clamp(4rem,14vh,8rem)]" :
            variant === "phrase" ? "text-3xl sm:text-4xl" :
            "text-4xl sm:text-5xl";
          /* Soft white halo so floating (container-less) text stays readable
             over the bright background art. */
          const floatShadow = { textShadow: "0 1px 12px rgba(255,255,255,0.9), 0 1px 2px rgba(255,255,255,0.9)" } as const;

          return (
            <>
              {/* Objective progress — slim bar with the fraction + live
                  precision folded in, so the screen carries ONE clean status
                  element instead of scattered counters. */}
              <div className="w-[min(20rem,80vw)] flex flex-col gap-1">
                <div
                  className="flex items-baseline justify-between text-[11px] font-extrabold text-text/75 uppercase tracking-[0.14em] px-0.5"
                  style={floatShadow}
                >
                  <span>Objetivo {visibleObjective} / {totalObjectives}</span>
                  <span>{accuracy}% precisión</span>
                </div>
                <div className="gp-riel">
                  <div
                    className="gp-veta transition-all duration-500 ease-out"
                    style={{ width: `${Math.round((visibleObjective / totalObjectives) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Target — the hero. A light floating glass card holds ONLY the
                  letter/word so it reads as the focal point of the scene. */}
              <div
                className={`gp-placa inline-flex items-center justify-center px-10 py-3 sm:px-14 sm:py-5 ${isIdleHintActive ? "animate-target-pulse" : ""}`}
              >
                <strong
                  ref={targetScrollRef}
                  className={`font-display font-black text-text leading-none overflow-x-auto no-scrollbar whitespace-nowrap max-w-[82vw] [text-shadow:0_2px_8px_rgba(83,107,255,0.18)] ${isLongTarget ? "text-2xl sm:text-3xl" : targetCardSize}`}
                >
                  {target}
                </strong>
              </div>

              {/* Secondary instruction — floating text, no container. */}
              {locationHint && !isCompleted && (
                <span className="text-text/80 font-semibold text-base" style={floatShadow}>{locationHint}</span>
              )}
              {commaHint && !isCompleted && (
                <span className="text-accent-strong font-semibold text-sm" style={floatShadow}>
                  Después de una coma va un espacio antes de la siguiente palabra.
                </span>
              )}

              {/* Combo hint — light floating glass pill. */}
              {combo && !isCompleted && (
                <div
                  className="inline-flex items-center gap-2 flex-wrap justify-center rounded-full px-4 py-1.5 bg-amber-200/45 backdrop-blur-md border border-amber-300/60 shadow-sm"
                  aria-label={`Combinación: ${combo.join(" + ")}`}
                >
                  <span className="text-sm font-bold text-amber-900">
                    Para escribir {expectedChar || "este símbolo"}
                  </span>
                  {combo.map((step, i) => (
                    <span key={`${step}-${i}`} className="flex items-center gap-1">
                      {i > 0 && <span className="text-amber-700 font-bold">+</span>}
                      <kbd className="bg-white/90 rounded px-2 py-0.5 text-sm font-bold text-text shadow-sm border border-amber-200">
                        {step}
                      </kbd>
                    </span>
                  ))}
                </div>
              )}
              {altCombos && !isCompleted && (
                <div className="flex items-center gap-2 flex-wrap justify-center text-sm" style={floatShadow} aria-label="Otras formas">
                  <span className="text-text/70 font-medium">o también</span>
                  {altCombos.map((alt, idx) => (
                    <span key={idx} className="flex items-center gap-1">
                      {alt.map((step, i) => (
                        <span key={`${step}-${i}`} className="flex items-center gap-1">
                          {i > 0 && <span className="text-text/60 font-bold">+</span>}
                          <kbd className="bg-white/80 rounded px-2 py-0.5 text-xs font-bold text-text shadow-sm border border-white/60">
                            {step}
                          </kbd>
                        </span>
                      ))}
                      {idx < altCombos.length - 1 && <span className="text-text/50 mx-1">·</span>}
                    </span>
                  ))}
                </div>
              )}
              {(activity.requiresShift || activity.requiresAccent) && !isCompleted && (
                <span className="text-text/70 text-sm font-medium" style={floatShadow}>
                  {activity.requiresShift && "Usá Shift para mayúsculas y símbolos. "}
                  {activity.requiresAccent && "Respetá tildes y la ñ."}
                </span>
              )}

              {/* Typed preview — light floating glass (word/phrase levels). */}
              {showTypedPreview && (
                <div
                  className="inline-flex flex-col items-center gap-1 shrink-0 min-h-[4.5rem] rounded-2xl px-6 py-2.5 bg-white/25 backdrop-blur-2xl border border-white/40 shadow-md"
                  aria-live="polite"
                >
                  <span className="text-[11px] font-bold text-text/55 uppercase tracking-wider">
                    Lo que estás escribiendo
                  </span>
                  <span
                    ref={typedScrollRef}
                    className={`font-mono text-2xl sm:text-3xl text-text font-bold overflow-x-auto no-scrollbar whitespace-nowrap max-w-[70vw] flex items-center ${!typed ? "text-text/50 italic text-lg" : ""}`}
                  >
                    {typed
                      ? Array.from(typed).map((ch, i) =>
                          ch === " " ? (
                            <span
                              key={i}
                              className="inline-block w-4 h-8 border-b-2 border-dashed border-text/40 mx-0.5"
                              aria-label="espacio"
                            />
                          ) : (
                            <span key={i} className="inline-block">{ch}</span>
                          ),
                        )
                      : "Empezá a escribir…"}
                    {typed && (
                      <span
                        className="inline-block w-0.5 h-8 bg-accent-strong ml-0.5 animate-caret-blink"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                </div>
              )}

            </>
          );
        })()}
      </section>

      {/* Two motivational robots flank the keyboard, switching phrases each target. */}
      {!isCompleted && (() => {
        const errored = isErrorActive || (errors > 0 && attempts > 0 && (attempts - errors) / attempts < 0.6);
        const phrasePool = errored ? ERROR_PHRASES : MOTIVATION_PHRASES;
        const leftPhrase = isIdleHintActive && locationHint ? locationHint : phrasePool[targetIndex % phrasePool.length];
        const rightPhrase = phrasePool[(targetIndex + Math.max(1, Math.floor(phrasePool.length / 2))) % phrasePool.length];
        return (
          <>
            {/* Robots APOYADOS sobre el suelo pintado del arte (anclados al
                borde inferior, no flotando a mitad de pantalla). */}
            <figure className="absolute bottom-2 left-1 z-10 flex flex-col items-center gap-2 max-w-[160px] pointer-events-none" aria-hidden="true">
              <div
                className={`glass-surface rounded-2xl rounded-br-sm px-2.5 py-1.5 text-xs font-semibold text-text shadow-sm animate-bubble-pop ${errored ? "bg-rose/20 border-rose/40 text-rose" : ""}`}
              >
                {leftPhrase}
              </div>
              <CharacterSkin
                kind="female"
                alt=""
                className="w-28 sm:w-40 h-auto object-contain animate-mascot-float"
              />
            </figure>
            <figure className="absolute bottom-2 right-1 z-10 flex flex-col items-center gap-2 max-w-[160px] pointer-events-none" aria-hidden="true">
              <div
                className={`glass-surface rounded-2xl rounded-bl-sm px-2.5 py-1.5 text-xs font-semibold text-text shadow-sm animate-bubble-pop ${errored ? "bg-rose/20 border-rose/40 text-rose" : ""}`}
              >
                {rightPhrase}
              </div>
              <CharacterSkin
                kind="male"
                alt=""
                className="w-28 sm:w-40 h-auto object-contain animate-mascot-float"
                style={{ animationDelay: "1s" }}
              />
            </figure>
          </>
        );
      })()}

      <section className="px-4 pb-2 shrink-0" aria-label="Teclado visual">
        <div
          className={`flex flex-col gap-2 w-fit mx-auto rounded-2xl transition-all duration-150 ${
            isErrorActive ? "animate-error-shake ring-2 ring-rose-400/70" : ""
          }`}
        >
          {keyboardRows.map((row) => {
            /* Each row has its own pastel colour so kids can scan home-row
               position by colour (gold numbers, pink top, mint home, violet
               bottom, sky modifiers). Applied to the KEYS, not a panel. */
            /* Keycaps con profundidad real: borde inferior grueso (el "lado"
               de la tecla), brillo superior tipo keycap y sombra suave en
               capas. El color sigue identificando cada fila. */
            /* Teclas esmeriladas blancas y cohesivas. El color de cada fila
               vive SOLO en el borde inferior (el "lado" 3D de la tecla), así
               se conserva la pista de color para escanear el home-row sin el
               ruido de rellenos arcoíris en cada tecla.

               El tono va por --gp-fila y ahora son colores de MARCA (§5) en
               vez de los pasteles sueltos de Tailwind, para que el teclado
               pertenezca a la misma paleta que el resto del juego. */
            const rowKeyTone: Record<string, string> = {
              num: "#ffd552",   // dorado
              top: "#ff9fca",   // rosa
              home: "#59cdb7",  // menta
              bot: "#9b7cff",   // violeta
              mod: "#33c7f0",   // celeste
            };
            return (
              <div
                key={row.id}
                className="flex justify-center gap-1.5"
              >
                {row.keys.map((key) => {
                  const isTarget = !isCompleted && expectedKeys.has(key);
                  const isCombo = isTarget && expectedKeys.size > 1;
                  const isFindHint = isTarget && isIdleHintActive;
                  const isPressed = lastKey === key;
                  const isSpace = key === "Space";
                  const isWide = key === "Backspace" || key === "Shift" || key === "Enter";

                  const keyClasses = [
                    "gp-key font-display font-bold transition-all duration-100",
                    "flex items-center justify-center select-none",
                    isSpace
                      ? "w-48 sm:w-[16.75rem] h-10 sm:h-[2.875rem] text-sm"
                      : isWide
                        ? "w-[4.5rem] sm:w-[6.75rem] h-10 sm:h-[2.875rem] text-xs px-1"
                        : "w-11 h-10 sm:w-[3.25rem] sm:h-[2.875rem] text-[17px]",
                    (isTarget || isCombo) ? "gp-key--target scale-110 animate-target-pulse" : "",
                    isFindHint ? "animate-key-find ring-4 ring-accent-pink/50" : "",
                    isPressed ? "gp-key--pressed animate-key-pop" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  /* <span> y no <button>: el teclado de la pantalla es un MAPA
                     para encontrar la tecla en el teclado de verdad, que es lo
                     que hay que aprender. Como <button> con hover prometía un
                     clic que nunca hizo nada, y un chico que cree que puede
                     resolver el nivel con el mouse deja de mirar sus manos.
                     El pointer-events: none va en .gp-key. */
                  return (
                    <span
                      key={key}
                      className={keyClasses}
                      style={{ ["--gp-fila" as string]: rowKeyTone[row.tone] }}
                      aria-hidden="true"
                    >
                      {key === "Space" ? "Espacio" : key}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      {/* Aire inferior: levanta el teclado del borde de la pantalla. */}
      <div className="pb-6 shrink-0" aria-hidden="true" />

      {isCompleted && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center animate-overlay-fade"
          role="dialog"
          aria-modal="true"
          aria-labelledby="level-complete-title"
        >
          <div className="modal-overlay" aria-hidden="true" />
          <div className="glass-card-smooth modal-card px-8 py-10 flex flex-col items-center gap-4 max-w-md w-full mx-4 relative animate-card-pop">
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl" aria-hidden="true">
              <span className="absolute top-4 left-8 text-3xl text-amber-400 animate-sparkle-burst" style={{ animationDelay: "0s" }}>★</span>
              <span className="absolute top-12 right-12 text-2xl text-pink-400 animate-sparkle-burst" style={{ animationDelay: "0.1s" }}>✦</span>
              <span className="absolute bottom-16 left-12 text-2xl text-accent-sky animate-sparkle-burst" style={{ animationDelay: "0.2s" }}>✧</span>
              <span className="absolute bottom-8 right-8 text-3xl text-amber-400 animate-sparkle-burst" style={{ animationDelay: "0.3s" }}>★</span>
              <span className="absolute top-1/2 left-4 text-2xl text-pink-400 animate-sparkle-burst" style={{ animationDelay: "0.4s" }}>✦</span>
              <span className="absolute top-1/3 right-4 text-2xl text-accent-sky animate-sparkle-burst" style={{ animationDelay: "0.5s" }}>✧</span>
            </div>
            <div className="text-6xl animate-trophy" aria-hidden="true">🏆</div>
            <h2 id="level-complete-title" className="font-display font-bold text-3xl text-text">
              ¡Nivel completado!
            </h2>
            <p className="text-muted font-bold text-lg">Sumaste {accuracy}% de precisión.</p>
            {unlockedAch.length > 0 && (
              <div className="flex flex-col items-center gap-2 w-full">
                <span className="text-xs font-black uppercase tracking-wider text-accent-strong">¡Logro desbloqueado!</span>
                <div className="flex flex-wrap justify-center gap-2">
                  {unlockedAch.map((id) => {
                    const m = achievementMeta(id);
                    return (
                      <span key={id} className="glass-surface rounded-2xl px-3 py-2 flex items-center gap-2 animate-card-pop">
                        <span className="text-2xl">{m.emoji}</span>
                        <span className="text-sm font-bold text-text">{m.label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex items-end gap-4" aria-hidden="true">
              {[1, 2, 3].map((index) => {
                const isOn = getStarsFromAccuracy(accuracy) >= index;
                // The middle star sits a touch higher for a playful arc.
                const lift = index === 2 ? "-translate-y-2" : "";
                return isOn ? (
                  <span
                    key={index}
                    className={`inline-block text-6xl animate-star-bounce ${lift}`}
                    style={{ animationDelay: `${0.18 + index * 0.16}s` }}
                  >
                    <span className="inline-block text-amber-400 animate-star-wiggle drop-shadow-[0_4px_12px_rgba(250,204,21,0.7)]">
                      ★
                    </span>
                  </span>
                ) : (
                  <span key={index} className={`inline-block text-5xl text-gray-300/80 ${lift}`}>
                    ★
                  </span>
                );
              })}
            </div>

            {/* Suma de estrellas a la colección: la barra sube con las estrellas
                ganadas en este nivel; al cruzar de fase dispara la celebración
                de personaje nuevo (después de esta barra). */}
            {starRun && starRun.after > starRun.before && (
              <LevelStarReward
                before={starRun.before}
                after={starRun.after}
                onCrossPhase={(p) => setCelebPhase(p)}
              />
            )}

            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={retry}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-text bg-white/80 border border-white/60 shadow-sm hover:scale-105 transition-transform"
              >
                <RotateCcw size={18} />
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => navigate(`/worlds/${activity.worldId}`)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn hover:scale-105 transition-transform"
              >
                <ArrowRight size={20} />
                Volver a la isla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Celebración de personaje nuevo — CONTROLADA: aparece sólo después de
          que la barra de estrellas terminó de sumar y cruzó de fase. Tapa el
          modal (z-[55] > z-50); al cerrarla queda el modal con Reintentar/Volver. */}
      {celebPhase !== null && (
        <SkinUnlockCelebration phase={celebPhase} onDismiss={() => setCelebPhase(null)} />
      )}
    </main>
  );
}
