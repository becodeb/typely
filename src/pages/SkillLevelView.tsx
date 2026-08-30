import { RotateCcw, Star, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Activity } from "../data/activities";
import { assets } from "../utils/assets";
import { getGameplayBackground } from "../data/worlds";
import { getStarsFromAccuracy, markLevelComplete } from "../utils/progress";
import { StarCounter } from "../components/common/StarCounter";

interface SkillLevelViewProps {
  activity: Activity;
}

/* Tone map for clickable items (replaces i5-clickable--{tone}) */
const clickableTones: Record<string, string> = {
  violet: "bg-violet-400/20 ring-violet-400/30",
  blue: "bg-blue-400/20 ring-blue-400/30",
  teal: "bg-teal-400/20 ring-teal-400/30",
  green: "bg-green-400/20 ring-green-400/30",
  pink: "bg-pink-400/20 ring-pink-400/30",
  amber: "bg-amber-400/20 ring-amber-400/30",
  rose: "bg-rose-400/20 ring-rose-400/30",
  sky: "bg-sky-400/20 ring-sky-400/30",
  mint: "bg-emerald-300/20 ring-emerald-300/30",
  lime: "bg-lime-400/20 ring-lime-400/30",
  cyan: "bg-cyan-400/20 ring-cyan-400/30",
  purple: "bg-purple-400/20 ring-purple-400/30",
  orange: "bg-orange-400/20 ring-orange-400/30",
  coral: "bg-rose-300/20 ring-rose-300/30",
  gold: "bg-amber-300/20 ring-amber-300/30",
};

/* =====================================================================
   Island 5 — Mouse skills.
   Each level is its own interactive mini-game wrapped in a shared
   pastel-fantasy shell (header + scene + metrics + completion modal).
===================================================================== */
export function SkillLevelView({ activity }: SkillLevelViewProps) {
  switch (activity.levelNumber) {
    case 1:
      return <LeftClickLevel activity={activity} />;
    case 2:
      return <RightClickLevel activity={activity} />;
    case 3:
      return <DragDropLevel activity={activity} />;
    case 4:
      return <WindowsLevel activity={activity} />;
    case 5:
      return <ScrollLevel activity={activity} />;
    case 6:
      return <DoubleClickLevel activity={activity} />;
    case 7:
      return <ShortcutsLevel activity={activity} />;
    default:
      return <FallbackLevel activity={activity} />;
  }
}

/* ------------------------------------------------------------------ */
/* Shared shell                                                       */
/* ------------------------------------------------------------------ */

interface ShellProps {
  activity: Activity;
  kicker: string;
  title: string;
  subtitle: string;
  instruction: string;
  goal: string;
  progress: number;
  total: number;
  metrics: { left: string; leftValue: number | string; mid: string; midValue: number | string; precision: number };
  completed: boolean;
  onRetry: () => void;
  children: React.ReactNode;
  feedback?: string;
}

function Island5Shell({
  activity,
  kicker,
  title,
  subtitle,
  instruction,
  goal,
  progress,
  total,
  metrics,
  completed,
  onRetry,
  children,
  feedback,
}: ShellProps) {
  const navigate = useNavigate();
  /* La misión se anuncia al abrir el nivel y después baja a reposo. */
  const [misionEntrada, setMisionEntrada] = useState(true);
  useEffect(() => {
    setMisionEntrada(true);
    const bajar = window.setTimeout(() => setMisionEntrada(false), 2800);
    return () => window.clearTimeout(bajar);
  }, [activity.id]);

  function speak() {
    if (!("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(`${title}. ${instruction}`);
    utter.lang = "es-AR";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  return (
    <main className="flex flex-col h-dvh relative overflow-hidden animate-page-fade" style={{ backgroundColor: "#cfeef8" }}>
      {/* Full vivid scene background (was washed to 40% → looked grey). */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none -z-10"
        aria-hidden="true"
        style={{ backgroundImage: `url("${getGameplayBackground(activity.worldId)}")` }}
      />
      {/* Whisper-light top scrim only for header legibility. */}
      <div className="absolute inset-x-0 top-0 h-40 -z-5 pointer-events-none bg-gradient-to-b from-white/35 to-transparent" aria-hidden="true" />
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-5" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-accent-sky/40 animate-twinkle"
            style={{
              left: `${8 + ((i * 19) % 84)}%`,
              top: `${5 + ((i * 29) % 80)}%`,
              animationDelay: `${(i * 0.4) % 4}s`,
            }}
          />
        ))}
      </div>

      <header className="flex items-center justify-between px-4 sm:px-6 py-3">
        <div className="nv-dato flex flex-col sm:flex-row sm:items-baseline gap-x-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-strong">{kicker}</span>
          <strong className="font-display font-extrabold text-lg text-text leading-tight">{title}</strong>
          <em className="text-[10px] text-text/65 italic font-semibold tracking-wider uppercase">{subtitle}</em>
        </div>
        <div className="flex items-center gap-2">
          <StarCounter />
          <button
            type="button"
            className="glass rounded-full w-10 h-10 grid place-items-center border-0 cursor-pointer text-text hover:bg-white/80 transition"
            onClick={() => navigate(`/worlds/${activity.worldId}`)}
            aria-label="Salir"
          >
            <X size={16} />
            <span className="hidden sm:inline text-xs font-bold">Salir</span>
          </button>
        </div>
      </header>

      {/* LA MISIÓN. En esta isla la consigna es lo ÚNICO que dice qué hacer:
          no hay una letra gigante ni un atajo escrito, hay una escena con
          cosas para arrastrar. Sin leerla —o escucharla— no se arranca. */}
      <div className="flex justify-center px-4 pt-1 pb-2 z-20" aria-live="polite">
        <div className={`gp-mision flex items-center gap-3 sm:gap-4 py-2.5 pl-3 pr-5 max-w-3xl ${misionEntrada ? "gp-mision--entrada" : ""}`}>
          <span className="gp-mision__insignia inline-flex items-center gap-1 px-3 py-0.5 font-display font-extrabold text-[11px] uppercase tracking-wider">
            <Star size={11} fill="currentColor" strokeWidth={0} />
            Objetivo {Math.min(progress + (completed ? 0 : 1), total)} de {total}
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
          <h2 className="font-display font-extrabold text-text text-base sm:text-xl leading-snug pt-0.5">{goal}</h2>
        </div>
      </div>

      {/* La escena se apoya ABAJO, no en el centro: los fondos nuevos traen un
          pedestal en el tercio inferior y la actividad tiene que caer encima,
          no flotar arriba de él. `items-end` con aire abajo la sienta ahí; si
          el contenido de un nivel crece, sube desde el pedestal en vez de
          desbordar. */}
      <section className="flex-1 flex items-center justify-center relative min-h-0 overflow-hidden" aria-label="Escena">
        <img className="absolute bottom-0 left-0 w-auto max-h-[44vh] pointer-events-none select-none animate-mascot-float z-10" src={assets.mascotFemaleWave} alt="" decoding="async" />
        <span className="absolute glass-strong rounded-2xl px-2.5 py-1.5 text-xs font-bold text-text animate-bubble-pop max-w-[9rem] bottom-[44%] left-[2%] rounded-bl-sm z-20">¡Vos podés!</span>
        <img className="absolute bottom-0 right-0 w-auto max-h-[44vh] pointer-events-none select-none animate-mascot-float z-10" src={assets.mascotMaleProud} alt="" decoding="async" />
        <span className="absolute glass-strong rounded-2xl px-2.5 py-1.5 text-xs font-bold text-text animate-bubble-pop max-w-[9rem] bottom-[44%] right-[2%] rounded-br-sm z-20">¡Sos un crack!</span>

        {/* La actividad se APOYA abajo, no flota en el centro: los fondos
            nuevos traen un pedestal en el tercio inferior y la escena tiene
            que caer encima. Si el contenido de un nivel crece, crece hacia
            arriba desde el pedestal en vez de desbordar. */}
        <div className="flex items-end justify-center w-full h-full pb-[10vh]">{children}</div>
      </section>

      {/* Readable glass bar for stats + instruction + actions (was plain text
          floating over the bright art). */}
      <div className="nv-dato mx-3 mb-3 px-4 py-1.5 flex flex-col gap-1.5">
        <div className="nv-dato flex items-center justify-center gap-4 text-sm font-bold text-text/90">
          <span className="text-amber-400">★</span>
          <div><b>{metrics.left}:</b> {metrics.leftValue}</div>
          <div className="w-px h-5 bg-text/15" />
          <div><b>{metrics.mid}:</b> {metrics.midValue}</div>
          <div className="w-px h-5 bg-text/15" />
          <div><b>Precisión:</b> {metrics.precision}%</div>
          <span className="text-amber-400">★</span>
        </div>

      <footer className="flex items-center justify-between gap-3">
        <div className="nv-dato text-sm text-text/90 font-semibold flex-1 min-w-0">
          <span aria-hidden="true" className="text-amber-400">★ </span>
          {feedback ?? instruction}
        </div>
        {/* Escuchar se mudó adentro de la misión, que es donde está la
            consigna que hay que escuchar. */}
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white/70 border border-white/60 text-text font-bold text-sm cursor-pointer transition hover:bg-white/90 hover:-translate-y-0.5 active:scale-95 shadow-sm"
          onClick={onRetry}
        >
          <RotateCcw size={16} /> Reintentar
        </button>
      </footer>
      </div>

      {completed && (
        <CompletionModal
          activity={activity}
          onRetry={onRetry}
          stars={getStarsFromAccuracy(metrics.precision)}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Completion modal                                                   */
/* ------------------------------------------------------------------ */

function CompletionModal({ activity, onRetry, stars = 3 }: { activity: Activity; onRetry: () => void; stars?: number }) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" />
      <div className="glass-card-smooth relative z-10 px-8 py-10 flex flex-col items-center gap-4 animate-modal-in w-[min(24rem,90vw)]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="absolute w-2 h-2 rounded-full animate-fall"
              style={{
                left: `${(i * 17) % 100}%`,
                animationDelay: `${(i * 0.12) % 2}s`,
                animationDuration: `${1.5 + (i % 4) * 0.4}s`,
                background: ["#ff7676", "#54e8c6", "#536bff", "#facc15", "#ff9cf5", "#76d4ff"][i % 6],
              }}
            />
          ))}
        </div>
        <div className="text-6xl animate-bounce-trophy" aria-hidden="true">🏆</div>
        <h3 className="font-display text-2xl font-extrabold text-text">¡Muy bien!</h3>
        <p className="text-base text-muted font-semibold">Completaste el nivel</p>
        <div className="flex gap-1 text-3xl" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <span key={i} className={stars >= i ? "" : "opacity-30 grayscale"}>{stars >= i ? "★" : "☆"}</span>
          ))}
        </div>
        <div className="flex gap-3 w-full mt-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-br from-accent-sky to-accent-strong text-white font-extrabold cursor-pointer transition hover:-translate-y-0.5 active:scale-95 shadow-btn flex-1"
            onClick={() => navigate(`/worlds/${activity.worldId}`)}
          >
            Volver a la isla
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white/70 border border-white/60 text-text font-bold text-sm cursor-pointer transition hover:bg-white/90 hover:-translate-y-0.5 active:scale-95 shadow-sm flex-1"
            onClick={onRetry}
          >
            <RotateCcw size={16} /> Repetir nivel
          </button>
        </div>
      </div>
    </div>
  );
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

  const tickCorrect = useCallback(() => {
    setAttempts((a) => a + 1);
    setProgress((p) => {
      const next = Math.min(total, p + 1);
      if (next >= total && !persistedRef.current) {
        persistedRef.current = true;
        const acc = Math.max(
          0,
          Math.round(((attempts + 1 - errors) / Math.max(1, attempts + 1)) * 100),
        );
        markLevelComplete(activity.worldId, activity.levelNumber, acc, Math.max(1, attempts + 1));
        setCompleted(true);
      }
      return next;
    });
  }, [activity.worldId, activity.levelNumber, total, attempts, errors]);

  const tickWrong = useCallback(() => {
    setAttempts((a) => a + 1);
    setErrors((e) => e + 1);
  }, []);

  const reset = useCallback(() => {
    setProgress(0);
    setAttempts(0);
    setErrors(0);
    setCompleted(false);
    persistedRef.current = false;
  }, []);

  const precision = Math.round(((attempts - errors) / Math.max(1, attempts)) * 100);
  return { progress, attempts, errors, completed, precision, tickCorrect, tickWrong, reset };
}

/* ------------------------------------------------------------------ */
/* Level 1 — Left Click                                               */
/* ------------------------------------------------------------------ */

const LEVEL1_OBJECTS = [
  { id: "star",   art: assets.i5Star,   tone: "gold" as const,   label: "Estrella" },
  { id: "apple",  art: assets.i5Apple,  tone: "pink" as const,   label: "Manzana"  },
  { id: "rabbit", art: assets.i5Rabbit, tone: "mint" as const,   label: "Conejo"   },
  { id: "ball",   art: assets.i5Ball,   tone: "blue" as const,   label: "Pelota"   },
  { id: "target", art: assets.i5Shot,   tone: "violet" as const, label: "Diana"    },
];

function LeftClickLevel({ activity }: { activity: Activity }) {
  const total = LEVEL1_OBJECTS.length;
  const prog = useLevelProgress(activity, total);
  const [popped, setPopped] = useState<Record<string, boolean>>({});
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const burstId = useRef(0);

  function onPick(id: string, ev: React.MouseEvent) {
    if (popped[id] || prog.completed) return;
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    burstId.current += 1;
    const newBurst = { id: burstId.current, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setBursts((b) => [...b, newBurst]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== newBurst.id)), 700);
    setPopped((p) => ({ ...p, [id]: true }));
    prog.tickCorrect();
  }

  function onMiss() {
    if (prog.completed) return;
    prog.tickWrong();
  }

  function retry() {
    prog.reset();
    setPopped({});
  }

  return (
    <Island5Shell
      activity={activity}
      kicker="NIVEL 1"
      title="Clickeá 5 imágenes"
      subtitle="CLICK IZQUIERDO"
      instruction="Hacé clic en los objetos que brillan."
      goal="Hacé click sobre 5 dibujos"
      progress={prog.progress}
      total={total}
      metrics={{
        left: "Clicks",
        leftValue: prog.attempts,
        mid: "Aciertos",
        midValue: prog.progress,
        precision: prog.precision,
      }}
      completed={prog.completed}
      onRetry={retry}
    >
      <div className="absolute bottom-0 left-0 right-0 h-1/2 flex items-end justify-center pb-[12%]" onClick={onMiss}>
        <div className="flex items-center justify-center gap-6 sm:gap-10" onClick={(e) => e.stopPropagation()}>
          {LEVEL1_OBJECTS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`relative flex flex-col items-center gap-1 cursor-pointer transition-all duration-200 hover:scale-110 ${popped[o.id] ? "animate-pop-out" : ""}`}
              onClick={(e) => onPick(o.id, e)}
              disabled={popped[o.id]}
              aria-label={`Hacer clic en ${o.label}`}
            >
              {/* Soft glow so the objects "brillan" — no solid colour box. */}
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 sm:w-24 sm:h-24 rounded-full animate-pulse-aura pointer-events-none" />
              <img className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-lg" src={o.art} alt="" draggable={false} decoding="async" />
              {/* Little ground shadow under the floating object. */}
              <span className="w-10 h-2 rounded-[999px] bg-black/15 blur-[2px]" />
            </button>
          ))}
        </div>
      </div>
      {bursts.map((b) => (
        <span key={b.id} className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2" style={{ left: `${b.x}px`, top: `${b.y}px` }} aria-hidden="true">
          {/* expanding ring */}
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-4 border-amber-300/80 animate-burst-ring" />
          {/* particles flying outward */}
          {["⭐", "✨", "💫", "⭐", "✨", "💫"].map((p, i) => {
            const ang = (i / 6) * Math.PI * 2;
            const dist = 46;
            return (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl animate-burst-fly"
                style={{ ["--bx" as never]: `${Math.cos(ang) * dist}px`, ["--by" as never]: `${Math.sin(ang) * dist}px`, animationDelay: `${i * 12}ms` }}
              >
                {p}
              </span>
            );
          })}
        </span>
      ))}
    </Island5Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Level 2 — Right Click                                              */
/* ------------------------------------------------------------------ */

const LEVEL2_OBJECTS = [
  { id: "penguin", art: assets.i5Penguin, label: "Pingüino" },
  { id: "bag",     art: assets.i5Bag,     label: "Mochila"  },
  { id: "chest",   art: assets.i5Chest,   label: "Cofre"    },
  { id: "potion",  art: assets.i5Potion,  label: "Poción"   },
];

const LEVEL2_ROUNDS = [
  {
    objects: LEVEL2_OBJECTS,
    target: "chest",
    targetLabel: "Cofre",
    prompt: "Hacé click derecho y abrí el cofre",
    hint: "El cofre esconde un tesoro 🪙",
    menu: [
      { id: "open", label: "Abrir cofre",  emoji: "📦", correct: true  },
      { id: "look", label: "Mirar",        emoji: "👁",  correct: false },
      { id: "save", label: "Guardar",      emoji: "💾", correct: false },
    ],
  },
  {
    objects: LEVEL2_OBJECTS,
    target: "potion",
    targetLabel: "Poción",
    prompt: "Hacé click derecho y tomate la poción",
    hint: "Una pocioncita mágica para seguir aventurando 🧪",
    menu: [
      { id: "drink", label: "Tomar poción", emoji: "🧪", correct: true  },
      { id: "throw", label: "Tirar",        emoji: "🗑",  correct: false },
      { id: "hide",  label: "Esconder",     emoji: "🙈", correct: false },
    ],
  },
  {
    objects: LEVEL2_OBJECTS,
    target: "bag",
    targetLabel: "Mochila",
    prompt: "Hacé click derecho y abrí la mochila",
    hint: "Adentro hay cosas para tu próxima misión 🎒",
    menu: [
      { id: "open", label: "Abrir mochila", emoji: "📂", correct: true  },
      { id: "tie",  label: "Atar",          emoji: "🪢", correct: false },
      { id: "burn", label: "Quemar",        emoji: "🔥", correct: false },
    ],
  },
];

function RightClickLevel({ activity }: { activity: Activity }) {
  const total = LEVEL2_ROUNDS.length;
  const prog = useLevelProgress(activity, total);
  const [roundIdx, setRoundIdx] = useState(0);
  const [menu, setMenu] = useState<{ x: number; y: number; onObject: string | null } | null>(null);
  const [feedback, setFeedback] = useState<string | undefined>();

  const round = LEVEL2_ROUNDS[Math.min(roundIdx, total - 1)];

  function onContext(ev: React.MouseEvent, objId: string) {
    ev.preventDefault();
    if (prog.completed) return;
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ x: rect.right - 10, y: rect.top + 12, onObject: objId });
  }

  function onLeft(ev: React.MouseEvent) {
    // a normal left-click on objects should give a gentle hint
    ev.preventDefault();
    if (prog.completed) return;
    prog.tickWrong();
    setFeedback("Probá con el botón derecho del mouse 😉");
    setTimeout(() => setFeedback(undefined), 1800);
  }

  function pickMenu(id: string) {
    if (!menu) return;
    const option = round.menu.find((m) => m.id === id);
    const correctObject = menu.onObject === round.target;
    if (option?.correct && correctObject) {
      prog.tickCorrect();
      setFeedback("¡Bien! Apareció el menú secreto.");
      setTimeout(() => {
        setRoundIdx((i) => Math.min(i + 1, total - 1));
        setFeedback(undefined);
      }, 600);
    } else {
      prog.tickWrong();
      setFeedback("Mirá bien el objeto correcto y volvé a probar.");
      setTimeout(() => setFeedback(undefined), 1600);
    }
    setMenu(null);
  }

  function retry() {
    prog.reset();
    setRoundIdx(0);
    setMenu(null);
    setFeedback(undefined);
  }

  useEffect(() => {
    function onDocClick() {
      setMenu(null);
    }
    window.addEventListener("click", onDocClick);
    return () => window.removeEventListener("click", onDocClick);
  }, []);

  return (
    <Island5Shell
      activity={activity}
      kicker="NIVEL 2"
      title="Menú secreto"
      subtitle="CLICK DERECHO"
      instruction={round.prompt}
      goal={round.prompt}
      progress={prog.progress}
      total={total}
      metrics={{
        left: "Intentos",
        leftValue: prog.attempts,
        mid: "Aciertos",
        midValue: prog.progress,
        precision: prog.precision,
      }}
      completed={prog.completed}
      onRetry={retry}
      feedback={feedback}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        {/* The main task already shows in the top goal card — only a small,
            secondary device tip lives here to avoid repeating the instruction. */}
        <p className="absolute top-3 left-1/2 -translate-x-1/2 text-sm text-muted text-center">
          💻 En notebook: click derecho tocando con <strong>dos dedos</strong> en el touchpad.
        </p>
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          {round.objects.map((o) => {
            const isTarget = o.id === round.target;
            return (
              <button
                key={o.id}
                type="button"
                className={`relative flex flex-col items-center gap-2 cursor-pointer transition-all duration-200 hover:scale-110 group rounded-full ${clickableTones.violet} ${isTarget ? "animate-target-pulse-i5 ring-4 ring-rose-400/60" : ""}`}
                onContextMenu={(e) => onContext(e, o.id)}
                onClick={onLeft}
                aria-label={o.label}
              >
                <span className="absolute inset-0 rounded-full animate-pulse-aura pointer-events-none" />
                <img className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-lg" src={o.art} alt="" draggable={false} decoding="async" />
                <span className="w-12 h-3 rounded-full bg-white/40 shadow-inner" />
                <span className="text-xs font-bold text-text bg-white/70 px-2 py-0.5 rounded-full">{o.label}</span>
                {isTarget && <span className="absolute -top-8 text-xs font-bold text-rose whitespace-nowrap animate-bob-arrow">↳ click derecho aquí</span>}
              </button>
            );
          })}
        </div>
      </div>
      {menu && (
        <ul
          className="fixed z-50 glass-card rounded-xl p-2 flex flex-col gap-1 min-w-[10rem] animate-menu-in"
          role="menu"
          style={{ left: `${menu.x}px`, top: `${menu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {round.menu.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/40 cursor-pointer w-full text-left text-xs font-semibold text-text"
                onClick={() => pickMenu(m.id)}
              >
                <span className="text-lg select-none">{m.emoji}</span>
                {m.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Island5Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Level 3 — Drag & Drop                                              */
/* ------------------------------------------------------------------ */

const LEVEL3_ITEMS = [
  { id: "star",   art: assets.i5Star,   label: "Estrella" },
  { id: "apple",  art: assets.i5Apple,  label: "Manzana"  },
  { id: "ball",   art: assets.i5Ball,   label: "Pelota"   },
  { id: "rabbit", art: assets.i5Rabbit, label: "Conejo"   },
];

function DragDropLevel({ activity }: { activity: Activity }) {
  const total = LEVEL3_ITEMS.length;
  const prog = useLevelProgress(activity, total);
  const [placed, setPlaced] = useState<Record<string, boolean>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | undefined>();
  const [moves, setMoves] = useState(0);
  const [rejectingSlot, setRejectingSlot] = useState<string | null>(null);

  /* Slot order is randomised per mount so the matching isn't a trivial
     "row 1 → row 1" pairing. Stable per session via useState initializer. */
  const [slotOrder] = useState<typeof LEVEL3_ITEMS>(() => {
    const arr = [...LEVEL3_ITEMS];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // If the shuffle happens to match the source order, swap two slots.
    if (arr.every((s, i) => s.id === LEVEL3_ITEMS[i].id)) {
      [arr[0], arr[1]] = [arr[1], arr[0]];
    }
    return arr;
  });

  function onDragStart(ev: React.DragEvent, id: string) {
    ev.dataTransfer.setData("text/plain", id);
    ev.dataTransfer.effectAllowed = "move";
    setDragging(id);
  }
  function onDragEnd() {
    setDragging(null);
    setHovered(null);
  }
  function onDragOver(ev: React.DragEvent, slotId: string) {
    ev.preventDefault();
    setHovered(slotId);
  }
  function onDragLeave() {
    setHovered(null);
  }
  function onDrop(ev: React.DragEvent, slotId: string) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData("text/plain");
    setMoves((m) => m + 1);
    setHovered(null);
    setDragging(null);
    if (id === slotId) {
      setPlaced((p) => ({ ...p, [id]: true }));
      prog.tickCorrect();
      setFeedback("¡Perfecto! Encontraste su lugar.");
      setTimeout(() => setFeedback(undefined), 1200);
    } else {
      prog.tickWrong();
      setFeedback("✗ Esa silueta no coincide. Probá otra ranura.");
      setRejectingSlot(slotId);
      // Quick beep via WebAudio (no external asset).
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 180;
        gain.gain.value = 0.05;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        osc.stop(ctx.currentTime + 0.2);
      } catch { /* audio not available — visual feedback is enough */ }
      setTimeout(() => setRejectingSlot(null), 520);
      setTimeout(() => setFeedback(undefined), 1600);
    }
  }

  function retry() {
    prog.reset();
    setPlaced({});
    setMoves(0);
    setRejectingSlot(null);
    setFeedback(undefined);
  }

  return (
    <Island5Shell
      activity={activity}
      kicker="NIVEL 3"
      title="Arrastrá y soltá"
      subtitle="DRAG & DROP"
      instruction="Arrastrá cada objeto y soltalo en el lugar correcto."
      goal="Llevá cada objeto a su lugar"
      progress={prog.progress}
      total={total}
      metrics={{
        left: "Movimientos",
        leftValue: moves,
        mid: "Aciertos",
        midValue: prog.progress,
        precision: prog.precision,
      }}
      completed={prog.completed}
      onRetry={retry}
      feedback={feedback}
    >
      {/* Two-row layout: draggable items on top, mixed drop targets below.
          Keeps every item visible inside the viewport at laptop sizes. */}
      <div className="flex flex-col items-center gap-6 h-full justify-center">
        <div className="flex items-center justify-center gap-6 flex-wrap" role="list" aria-label="Objetos para arrastrar">
          {LEVEL3_ITEMS.map((it) => (
            <div
              key={it.id}
              role="listitem"
              className={`relative flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing transition-all ${placed[it.id] ? "opacity-30 scale-90 pointer-events-none" : ""} ${dragging === it.id ? "opacity-70 scale-110" : ""}`}
              draggable={!placed[it.id]}
              onDragStart={(e) => onDragStart(e, it.id)}
              onDragEnd={onDragEnd}
              aria-label={`Arrastrar ${it.label}`}
            >
              <span className="absolute inset-0 rounded-full animate-float-item pointer-events-none" />
              <img className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-lg" src={it.art} alt="" draggable={false} decoding="async" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 text-2xl text-muted" aria-hidden="true">
          <span>↓ soltá acá ↓</span>
        </div>
        <div className="flex items-center justify-center gap-8 flex-wrap" role="list" aria-label="Destinos">
          {slotOrder.map((it) => (
            <div
              key={it.id}
              role="listitem"
              className={`relative flex flex-col items-center gap-1 w-24 h-24 rounded-2xl border-2 border-dashed transition-all ${
                rejectingSlot === it.id
                  ? "animate-shake-i5 border-rose bg-white/20"
                  : hovered === it.id
                    ? "border-accent-sky bg-accent-sky/10 scale-105"
                    : placed[it.id]
                      ? "border-mint bg-mint/10"
                      : "border-white/60 bg-white/20"
              }`}
              onDragOver={(e) => onDragOver(e, it.id)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, it.id)}
            >
              <img
                className={`w-10 h-10 object-contain drop-shadow ${placed[it.id] ? "animate-reward-pop" : ""}`}
                src={it.art}
                alt=""
                draggable={false}
                decoding="async"
              />
              <span className="text-xs font-bold text-muted">{it.label}</span>
              {rejectingSlot === it.id && <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose text-white rounded-full grid place-items-center text-xs font-bold animate-cross-pop" aria-hidden="true">✕</span>}
            </div>
          ))}
        </div>
      </div>
    </Island5Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Level 4 — Virtual desktop (windows + tabs)                         */
/* ------------------------------------------------------------------ */

interface WinState {
  id: string;
  title: string;
  emoji: string;
  open: boolean;
  tabs?: { id: string; title: string; emoji: string; open: boolean }[];
}

const LEVEL4_TASKS = [
  { kind: "close-tab", windowId: "browser", tabId: "videos", text: 'Cerrá la pestaña \u201cVideos\u201d.' },
  { kind: "close-window", windowId: "drawings", text: 'Cerrá la ventana \u201cDibujos\u201d.' },
  { kind: "open-tab", windowId: "browser", text: 'Abrí una pestaña nueva en el explorador.' },
  { kind: "close-window", windowId: "notes", text: 'Cerrá la ventana \u201cNotas\u201d.' },
] as const;

function WindowsLevel({ activity }: { activity: Activity }) {
  const total = LEVEL4_TASKS.length;
  const prog = useLevelProgress(activity, total);
  const [windows, setWindows] = useState<WinState[]>(() => initialWindows());
  const [tabsOpened, setTabsOpened] = useState(0);
  const [windowsClosed, setWindowsClosed] = useState(0);
  const [feedback, setFeedback] = useState<string | undefined>();

  const task = LEVEL4_TASKS[Math.min(prog.progress, total - 1)];

  function initialWindows(): WinState[] {
    return [
      {
        id: "browser",
        title: "Explorador",
        emoji: "🌐",
        open: true,
        tabs: [
          { id: "explorer", title: "Explorador", emoji: "🌐", open: true },
          { id: "videos", title: "Videos", emoji: "▶", open: true },
        ],
      },
      { id: "drawings", title: "Dibujos", emoji: "🎨", open: true },
      { id: "notes", title: "Notas", emoji: "🗒", open: true },
    ];
  }

  function onCloseWindow(id: string) {
    if (prog.completed) return;
    if (task.kind === "close-window" && task.windowId === id) {
      setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, open: false } : w)));
      setWindowsClosed((c) => c + 1);
      prog.tickCorrect();
      setFeedback("¡Bien! Ventana cerrada.");
      setTimeout(() => setFeedback(undefined), 1200);
    } else {
      prog.tickWrong();
      setFeedback("Esa no era la ventana indicada.");
      setTimeout(() => setFeedback(undefined), 1400);
    }
  }

  function onCloseTab(windowId: string, tabId: string) {
    if (prog.completed) return;
    if (task.kind === "close-tab" && task.windowId === windowId && task.tabId === tabId) {
      setWindows((ws) =>
        ws.map((w) =>
          w.id === windowId
            ? { ...w, tabs: w.tabs?.map((t) => (t.id === tabId ? { ...t, open: false } : t)) }
            : w,
        ),
      );
      prog.tickCorrect();
      setFeedback("¡Pestaña cerrada!");
      setTimeout(() => setFeedback(undefined), 1200);
    } else {
      prog.tickWrong();
      setFeedback("Esa no era la pestaña pedida.");
      setTimeout(() => setFeedback(undefined), 1400);
    }
  }

  function onOpenTab(windowId: string) {
    if (prog.completed) return;
    if (task.kind === "open-tab" && task.windowId === windowId) {
      const newTab = { id: `new-${Date.now()}`, title: "Nueva", emoji: "✨", open: true };
      setWindows((ws) =>
        ws.map((w) => (w.id === windowId ? { ...w, tabs: [...(w.tabs ?? []), newTab] } : w)),
      );
      setTabsOpened((c) => c + 1);
      prog.tickCorrect();
      setFeedback("¡Pestaña nueva lista!");
      setTimeout(() => setFeedback(undefined), 1200);
    } else {
      prog.tickWrong();
      setFeedback("Abrí la pestaña en el explorador.");
      setTimeout(() => setFeedback(undefined), 1400);
    }
  }

  function retry() {
    prog.reset();
    setWindows(initialWindows());
    setTabsOpened(0);
    setWindowsClosed(0);
    setFeedback(undefined);
  }

  return (
    <Island5Shell
      activity={activity}
      kicker="NIVEL 4"
      title="Ventanas y pestañas"
      subtitle="SISTEMA VIRTUAL"
      instruction={task.text ?? "Abrí y cerrá ventanas."}
      goal="Abrí y cerrá ventanas"
      progress={prog.progress}
      total={total}
      metrics={{
        left: "Ventanas",
        leftValue: windowsClosed,
        mid: "Pestañas",
        midValue: tabsOpened,
        precision: prog.precision,
      }}
      completed={prog.completed}
      onRetry={retry}
      feedback={feedback}
    >
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        {/* Inline task pill — the spoken consigna duplicated as a readable
            cue right above the windows so kids always know what to do. */}
        <div className="glass-strong rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-bold text-text" role="status">
          <span className="text-accent-strong uppercase text-xs tracking-wider">Tarea</span>
          <strong>{task.text}</strong>
        </div>

        {/* Clean, illustrated windows — bodies are CSS-only so they never
            clash with painted artwork or stack messily. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-3 flex-1 overflow-y-auto no-scrollbar content-start">
          {windows.filter((w) => w.open).map((w, idx) => (
            <div
              key={w.id}
              className="glass-card rounded-xl overflow-hidden shadow-lg"
              style={{ ["--stack" as never]: idx }}
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-white/30 border-b border-white/20">
                {w.tabs ? (
                  <div className="flex items-center gap-1 flex-1 overflow-x-auto" role="tablist">
                    {w.tabs.filter((t) => t.open).map((t) => (
                      <div key={t.id} className="flex items-center gap-1 px-3 py-1 rounded-md bg-white/40 text-xs font-bold text-text whitespace-nowrap">
                        <span aria-hidden="true">{t.emoji}</span> {t.title}
                        <button
                          type="button"
                          className="w-4 h-4 grid place-items-center rounded-full hover:bg-white/60 text-muted cursor-pointer"
                          onClick={() => onCloseTab(w.id, t.id)}
                          aria-label={`Cerrar pestaña ${t.title}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="w-6 h-6 grid place-items-center rounded-full hover:bg-white/60 text-muted cursor-pointer"
                      onClick={() => onOpenTab(w.id)}
                      aria-label="Nueva pestaña"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-text truncate">
                    <span aria-hidden="true">{w.emoji}</span> {w.title}
                  </span>
                )}
                <span className="flex items-center gap-1.5 ml-auto" aria-hidden="true">
                  <i className="w-2.5 h-2.5 rounded-full" style={{ background: "#ffd552" }} />
                  <i className="w-2.5 h-2.5 rounded-full" style={{ background: "#5be8ba" }} />
                </span>
                <button
                  type="button"
                  className="w-6 h-6 grid place-items-center rounded-full hover:bg-rose/30 cursor-pointer text-muted"
                  onClick={() => onCloseWindow(w.id)}
                  aria-label={`Cerrar ${w.title}`}
                >
                  ×
                </button>
              </div>
              <div className="p-2.5 flex flex-col gap-2 min-h-[5.5rem]">
                {w.id === "browser" && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/40 text-[11px] text-muted">
                      <span className="w-2 h-2 rounded-full bg-mint" />
                      typely.test/aventura
                    </div>
                    <div className="flex items-center justify-center text-4xl py-1">🌐</div>
                    <p className="text-xs text-muted text-center">Página de inicio</p>
                  </div>
                )}
                {w.id === "drawings" && (
                  <div className="bg-white rounded-lg p-3 flex flex-col gap-2">
                    <div className="flex gap-1">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#ff7676" }} />
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#54e8c6" }} />
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#536bff" }} />
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#facc15" }} />
                    </div>
                    <div className="flex items-center justify-center text-3xl h-12">🎨</div>
                  </div>
                )}
                {w.id === "notes" && (
                  <div className="bg-yellow-50/80 rounded-lg p-3">
                    <p className="font-bold text-sm text-text">★ Mis tareas</p>
                    <ul className="list-disc list-inside text-sm text-text space-y-1">
                      <li>Estudiar mecanografía</li>
                      <li>Explorar la isla</li>
                      <li>Saludar al robot</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Island5Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Level 5 — Scroll wheel + zoom                                      */
/* ------------------------------------------------------------------ */

function ScrollLevel({ activity }: { activity: Activity }) {
  const total = 4;
  const prog = useLevelProgress(activity, total);
  const [scrolls, setScrolls] = useState(0);
  const [zooms, setZooms] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [reachedBottom, setReachedBottom] = useState(false);
  const [reachedTop, setReachedTop] = useState(true);
  const [didZoomIn, setDidZoomIn] = useState(false);
  const [feedback, setFeedback] = useState<string | undefined>();
  const objectivesDone = useRef<Set<string>>(new Set());

  /* Four-step pacing forces the kid through every gesture:
       1) scroll down to reveal the bottom of the vertical castle art,
       2) scroll back up to the top,
       3) tap "+" to zoom in,
       4) tap "−" to zoom back out. */
  const objectives = [
    { id: "scroll-down", text: "Hacé scroll hacia abajo hasta ver el final del castillo." },
    { id: "scroll-up",   text: "Subí de nuevo hasta arriba con la rueda del mouse." },
    { id: "zoom-in",     text: "Acercá la imagen tocando el botón ＋" },
    { id: "zoom-out",    text: "Ahora alejá la imagen tocando el botón −" },
  ];
  const current = objectives[Math.min(prog.progress, total - 1)];

  function complete(id: string, message: string) {
    if (objectivesDone.current.has(id)) return;
    objectivesDone.current.add(id);
    prog.tickCorrect();
    setFeedback(message);
    setTimeout(() => setFeedback(undefined), 1200);
  }

  function onScroll(ev: React.UIEvent<HTMLDivElement>) {
    const el = ev.currentTarget;
    setScrolls((s) => s + 1);
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 6;
    const atTop = el.scrollTop <= 4;
    if (atBottom && !reachedBottom) {
      setReachedBottom(true);
      setReachedTop(false);
      if (current.id === "scroll-down") complete("scroll-down", "¡Llegaste al final!");
    }
    if (atTop && reachedBottom) {
      setReachedTop(true);
      if (current.id === "scroll-up") complete("scroll-up", "¡Volviste arriba!");
    }
  }

  function onZoomIn() {
    setZooms((z) => z + 1);
    const next = Math.min(zoom + 0.18, 2);
    setZoom(next);
    setDidZoomIn(true);
    if (current.id === "zoom-in" && next >= 1.3) complete("zoom-in", "¡Zoom in realizado!");
  }
  function onZoomOut() {
    setZooms((z) => z + 1);
    const next = Math.max(zoom - 0.18, 0.7);
    setZoom(next);
    // Only count once the kid has zoomed in first and then back out.
    if (current.id === "zoom-out" && didZoomIn && next <= 1.05) {
      complete("zoom-out", "¡Zoom out realizado!");
    }
  }

  function retry() {
    prog.reset();
    setScrolls(0);
    setZooms(0);
    setZoom(1);
    setReachedBottom(false);
    setReachedTop(true);
    setDidZoomIn(false);
    objectivesDone.current.clear();
  }

  return (
    <Island5Shell
      activity={activity}
      kicker="NIVEL 5"
      title="Usá la rueda"
      subtitle="SCROLL"
      instruction={current.text}
      goal="Desplazate y hacé zoom"
      progress={prog.progress}
      total={total}
      metrics={{
        left: "Scrolls",
        leftValue: scrolls,
        mid: "Zoom",
        midValue: zooms,
        precision: prog.precision,
      }}
      completed={prog.completed}
      onRetry={retry}
      feedback={feedback}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4">
        {/* Scroll card — mouse illustration sits inside the same panel so
            arrows + scroll viewport feel like one coherent unit. */}
        <section className="glass-card overflow-hidden w-full max-w-2xl">
          <header className="flex items-center justify-between px-5 py-3 border-b border-white/20">
            <span className="px-3 py-0.5 rounded-full bg-accent-sky/20 text-accent-strong text-xs font-bold uppercase tracking-wider">SCROLL</span>
            <h3 className="font-display font-bold text-text text-sm">Rueda del mouse</h3>
          </header>
          <div className="flex gap-4 p-4">
            <aside className="flex flex-col items-center gap-3 text-2xl text-muted" aria-hidden="true">
              <div className="animate-bob-arrow">↑</div>
              <img src={assets.i5Mouse} alt="" draggable={false} decoding="async" className="w-10 h-auto object-contain" />
              <div className="animate-bob-arrow" style={{ animationDelay: "0.3s" }}>↓</div>
            </aside>
            <div className="flex-1 overflow-y-auto rounded-lg bg-white/40 h-60" onScroll={onScroll}>
              {/* The "tall vertical image" is composed in pure CSS so it
                  never depends on an external file and can never bug out
                  mid-scroll. Each band paints a different sky layer of a
                  fantasy mountain → castle → cave journey. */}
              <div className="relative flex flex-col" aria-hidden="true">
                <div className="flex items-center justify-center gap-2 h-24 sm:h-32 text-2xl bg-sky-200/30">
                  <span className="text-2xl sm:text-3xl">☀️</span>
                  <strong className="font-bold text-text text-sm">Cielo</strong>
                </div>
                <div className="flex items-center justify-center gap-2 h-24 sm:h-32 text-2xl bg-white/30">
                  <span className="text-2xl sm:text-3xl">☁️</span>
                  <strong className="font-bold text-text text-sm">Nubes</strong>
                </div>
                <div className="flex items-center justify-center gap-2 h-24 sm:h-32 text-2xl bg-gray-200/30">
                  <span className="text-2xl sm:text-3xl">🏔️</span>
                  <strong className="font-bold text-text text-sm">Montaña</strong>
                </div>
                <div className="flex items-center justify-center gap-2 h-24 sm:h-32 text-2xl bg-amber-100/30">
                  <span className="text-2xl sm:text-3xl">🏰</span>
                  <strong className="font-bold text-text text-sm">Castillo</strong>
                </div>
                <div className="flex items-center justify-center gap-2 h-24 sm:h-32 text-2xl bg-green-200/30">
                  <span className="text-2xl sm:text-3xl">🌲</span>
                  <strong className="font-bold text-text text-sm">Bosque</strong>
                </div>
                <div className="flex items-center justify-center gap-2 h-24 sm:h-32 text-2xl bg-purple-200/30">
                  <span className="text-2xl sm:text-3xl">🪄</span>
                  <strong className="font-bold text-text text-sm">Cueva mágica</strong>
                </div>
                <div className="flex items-center justify-center gap-2 h-24 sm:h-32 text-2xl bg-rose-200/30">
                  <span className="text-2xl sm:text-3xl">🏁</span>
                  <strong className="font-bold text-text text-sm">¡Llegaste al final!</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Zoom card — castle artwork lives inside a clean stage with
            obvious + / − controls below, no overlay clash. */}
        <section className="glass-card overflow-hidden w-full max-w-2xl">
          <header className="flex items-center justify-between px-5 py-3 border-b border-white/20">
            <span className="px-3 py-0.5 rounded-full bg-accent-sky/20 text-accent-strong text-xs font-bold uppercase tracking-wider">ZOOM</span>
            <h3 className="font-display font-bold text-text text-sm">Acercá la imagen</h3>
          </header>
          <div className="flex gap-4 p-4">
            <div className="bg-white/40 rounded-lg flex-1">
              <img
                className="bg-white rounded-lg w-full h-auto object-contain transition-transform duration-200"
                src={assets.i5CastleSquare}
                alt="Castillo de zoom"
                draggable={false}
                style={{ transform: `scale(${zoom})` }}
                decoding="async"
              />
              <span className="text-lg font-bold text-text block text-center mt-1">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                className="glass-surface rounded-xl w-10 h-10 grid place-items-center text-lg font-bold cursor-pointer border-0"
                onClick={onZoomOut}
                aria-label="Alejar"
              >
                <strong>−</strong><span className="hidden sm:inline text-xs">Alejar</span>
              </button>
              <button
                type="button"
                className="glass-surface rounded-xl w-10 h-10 grid place-items-center text-lg font-bold cursor-pointer border-0 bg-accent text-white"
                onClick={onZoomIn}
                aria-label="Acercar"
              >
                <strong>+</strong><span className="hidden sm:inline text-xs">Acercar</span>
              </button>
            </div>
          </div>
        </section>
      </div>
      <span className="sr-only" aria-hidden="true">{didZoomIn ? "" : ""}{reachedTop ? "" : ""}</span>
    </Island5Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Level 6 — Double click                                             */
/* ------------------------------------------------------------------ */

const LEVEL6_FOLDERS = [
  { id: "stars",    art: assets.i5Star,   label: "Estrellas" },
  { id: "apples",   art: assets.i5Apple,  label: "Frutas" },
  { id: "bunnies",  art: assets.i5Rabbit, label: "Conejitos" },
];

function DoubleClickLevel({ activity }: { activity: Activity }) {
  const total = LEVEL6_FOLDERS.length;
  const prog = useLevelProgress(activity, total);
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<string | undefined>();
  const singleClickTimerRef = useRef<number | null>(null);

  function onSingleClick(id: string) {
    if (prog.completed || opened[id]) return;
    if (singleClickTimerRef.current !== null) window.clearTimeout(singleClickTimerRef.current);
    singleClickTimerRef.current = window.setTimeout(() => {
      setFeedback("Un clic solo no alcanza — necesitás otro clic enseguida.");
      prog.tickWrong();
      singleClickTimerRef.current = null;
      setTimeout(() => setFeedback(undefined), 1400);
    }, 420);
  }

  function onDoubleClick(id: string) {
    if (prog.completed || opened[id]) return;
    if (singleClickTimerRef.current !== null) {
      window.clearTimeout(singleClickTimerRef.current);
      singleClickTimerRef.current = null;
    }
    setOpened((o) => ({ ...o, [id]: true }));
    prog.tickCorrect();
    setFeedback("¡Doble clic perfecto! Carpeta abierta.");
    setTimeout(() => setFeedback(undefined), 1400);
  }

  function retry() {
    if (singleClickTimerRef.current !== null) {
      window.clearTimeout(singleClickTimerRef.current);
      singleClickTimerRef.current = null;
    }
    prog.reset();
    setOpened({});
    setFeedback(undefined);
  }

  useEffect(() => {
    return () => {
      if (singleClickTimerRef.current !== null) window.clearTimeout(singleClickTimerRef.current);
    };
  }, []);

  return (
    <Island5Shell
      activity={activity}
      kicker="NIVEL 6"
      title="Doble clic"
      subtitle="ABRÍ CARPETAS"
      instruction="Hacé doble clic sobre cada carpeta para abrirla."
      goal="Abrí las 3 carpetas con doble clic"
      progress={prog.progress}
      total={total}
      metrics={{
        left: "Errores",
        leftValue: prog.errors,
        mid: "Aciertos",
        midValue: prog.progress,
        precision: prog.precision,
      }}
      completed={prog.completed}
      onRetry={retry}
      feedback={feedback}
    >
      <div className="flex items-center justify-center gap-6 flex-wrap">
        {LEVEL6_FOLDERS.map((f) => (
          <button
            type="button"
            key={f.id}
            className={`glass-card rounded-2xl w-32 overflow-hidden cursor-pointer transition-all hover:scale-105 ${opened[f.id] ? "ring-2 ring-mint" : ""}`}
            onClick={() => onSingleClick(f.id)}
            onDoubleClick={() => onDoubleClick(f.id)}
            disabled={opened[f.id]}
            aria-label={`Doble clic en ${f.label}`}
          >
            <div className="bg-white/30 px-3 py-1 flex items-center gap-1" />
            <div className="p-4 flex flex-col items-center gap-2">
              {opened[f.id] ? (
                <span className="text-mint font-bold">✓</span>
              ) : (
                <img src={f.art} alt="" draggable={false} decoding="async" className="w-12 h-12 object-contain drop-shadow-sm" />
              )}
            </div>
            <span className="text-sm font-bold text-text block text-center pb-1">{f.label}</span>
            {!opened[f.id] && <span className="text-xs text-muted block text-center pb-2">doble clic</span>}
          </button>
        ))}
      </div>
    </Island5Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Level 7 — Copy & paste                                             */
/* ------------------------------------------------------------------ */

const LEVEL7_SOURCE = "¡Hola, soy un mensaje mágico!";

function ShortcutsLevel({ activity }: { activity: Activity }) {
  const total = 2; // 1) copy, 2) paste
  const prog = useLevelProgress(activity, total);
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<string | undefined>();
  const sourceRef = useRef<HTMLParagraphElement | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement | null>(null);
  const progRef = useRef(prog);
  progRef.current = prog;

  /* Click/tap the source text → select it so Ctrl+C copies. */
  function selectSource() {
    const node = sourceRef.current;
    if (!node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  /* Native copy event — fires whether the user pressed Ctrl+C or used
     the right-click menu. We treat it as the "copy" milestone. */
  useEffect(() => {
    function onCopy(ev: ClipboardEvent) {
      const sel = window.getSelection()?.toString() ?? "";
      if (!sel) return;
      // Mirror the selection into our clipboard so paste works even when the
      // browser blocks raw clipboard reads.
      ev.clipboardData?.setData("text/plain", sel);
      ev.preventDefault();
      if (sel.trim() === LEVEL7_SOURCE) {
        if (!copied) {
          setCopied(true);
          // Only counts toward the copy objective.
          if (progRef.current.progress === 0) {
            progRef.current.tickCorrect();
          }
        }
        setFeedback("¡Texto copiado! Ahora hacé Ctrl + V en la caja de abajo.");
        setTimeout(() => setFeedback(undefined), 1800);
      } else {
        setFeedback("Seleccioná el mensaje completo de arriba y volvé a copiar.");
        setTimeout(() => setFeedback(undefined), 1800);
      }
    }
    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
    // We rely on refs for current progress so the listener stays stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copied]);

  /* Paste from the textarea. The textarea's native onPaste gives us the
     pasted text — we don't need clipboard.read() permission. */
  function onPaste(ev: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = ev.clipboardData.getData("text/plain");
    ev.preventDefault();
    if (!text) return;
    setPasted(text);
    if (text.trim() === LEVEL7_SOURCE) {
      if (!copied) {
        setFeedback("Primero copiá el mensaje con Ctrl + C de arriba.");
        setTimeout(() => setFeedback(undefined), 1800);
        return;
      }
      if (progRef.current.progress === 1) {
        progRef.current.tickCorrect();
      }
      setFeedback("¡Excelente! Copiaste y pegaste el mensaje.");
      setTimeout(() => setFeedback(undefined), 1800);
    } else {
      setFeedback("Eso no es el mismo mensaje. Copiá el de arriba.");
      setTimeout(() => setFeedback(undefined), 1800);
    }
  }

  /* Show clear feedback if the user presses Ctrl+V somewhere outside the
     textarea — guide them to click into the box first. */
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (progRef.current.completed) return;
      const ctrlLike = ev.ctrlKey || ev.metaKey;
      if (!ctrlLike) return;
      const key = ev.key.toLowerCase();
      if (key === "v" && document.activeElement !== pasteRef.current) {
        setFeedback("Hacé click dentro de la caja de abajo antes de pegar.");
        setTimeout(() => setFeedback(undefined), 1800);
      }
      if (key === "c" && !window.getSelection()?.toString()) {
        setFeedback("Primero seleccioná el texto de arriba (click sobre el mensaje).");
        setTimeout(() => setFeedback(undefined), 1800);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function retry() {
    prog.reset();
    setPasted("");
    setCopied(false);
    setFeedback(undefined);
    pasteRef.current && (pasteRef.current.value = "");
  }

  const stepInstruction = !copied
    ? "Hacé click en el mensaje de arriba y copialo con Ctrl + C."
    : "¡Ahora pegalo en la caja de abajo con Ctrl + V!";

  return (
    <Island5Shell
      activity={activity}
      kicker="NIVEL 7"
      title="Copiar y pegar"
      subtitle="CTRL + C / CTRL + V"
      instruction={stepInstruction}
      goal="Copiá el texto de arriba y pegalo abajo"
      progress={prog.progress}
      total={total}
      metrics={{
        left: "Intentos",
        leftValue: prog.attempts,
        mid: "Aciertos",
        midValue: prog.progress,
        precision: prog.precision,
      }}
      completed={prog.completed}
      onRetry={retry}
      feedback={feedback}
    >
      <div className="flex items-center justify-center gap-4 flex-wrap max-w-4xl">
        <div className={`glass-surface rounded-2xl p-4 flex flex-col items-center gap-2 w-48 ${copied ? "ring-2 ring-mint" : ""}`}>
          <span className="text-xs font-bold uppercase tracking-wider text-muted">1 · Texto para copiar</span>
          <p
            ref={sourceRef}
            className="text-lg font-bold text-text py-2 px-3 bg-white/50 rounded-lg text-center select-all cursor-pointer"
            onClick={selectSource}
            tabIndex={0}
            onFocus={selectSource}
          >
            {LEVEL7_SOURCE}
          </p>
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-sky/20 text-accent-strong text-xs font-bold cursor-pointer hover:bg-accent-sky/30">
            <kbd className="px-1.5 py-0.5 rounded bg-white/60 font-mono text-xs">Ctrl</kbd><span className="text-muted font-bold">+</span><kbd className="px-1.5 py-0.5 rounded bg-white/60 font-mono text-xs">C</kbd>
          </span>
        </div>

        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-bold text-muted">2</span>
          <p className="text-sm text-muted text-center">Seleccioná el mensaje, copialo y pegalo abajo.</p>
        </div>

        <div className={`glass-surface rounded-2xl p-4 flex flex-col items-center gap-2 w-48 ${pasted && pasted.trim() === LEVEL7_SOURCE ? "ring-2 ring-mint" : ""}`}>
          <span className="text-xs font-bold uppercase tracking-wider text-muted">3 · Pegá acá</span>
          <textarea
            ref={pasteRef}
            className="w-24 h-16 bg-white/50 rounded-lg text-sm text-text p-2 resize-none border-0 outline-none focus:ring-2 focus:ring-accent-sky/40"
            placeholder="Hacé click acá y presioná Ctrl + V…"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            onPaste={onPaste}
            spellCheck={false}
            aria-label="Caja para pegar"
          />
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-sky/20 text-accent-strong text-xs font-bold cursor-pointer hover:bg-accent-sky/30">
            <kbd className="px-1.5 py-0.5 rounded bg-white/60 font-mono text-xs">Ctrl</kbd><span className="text-muted font-bold">+</span><kbd className="px-1.5 py-0.5 rounded bg-white/60 font-mono text-xs">V</kbd>
          </span>
        </div>
      </div>
    </Island5Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Fallback (levels not yet implemented)                              */
/* ------------------------------------------------------------------ */

function FallbackLevel({ activity }: { activity: Activity }) {
  const total = 1;
  const prog = useLevelProgress(activity, total);
  return (
    <Island5Shell
      activity={activity}
      kicker={`NIVEL ${activity.levelNumber}`}
      title={activity.title}
      subtitle={activity.subtitle}
      instruction={activity.instruction}
      goal={activity.title}
      progress={prog.progress}
      total={total}
      metrics={{ left: "Intentos", leftValue: prog.attempts, mid: "Aciertos", midValue: prog.progress, precision: prog.precision }}
      completed={prog.completed}
      onRetry={() => prog.reset()}
    >
      <div className="absolute bottom-0 left-0 right-0 h-1/2 flex items-end justify-center pb-[12%]">
        <button
          type="button"
          className={`relative flex flex-col items-center gap-2 cursor-pointer transition-all duration-200 hover:scale-110 group rounded-full ${clickableTones.violet}`}
          onClick={() => prog.tickCorrect()}
        >
          <span className="absolute inset-0 rounded-full animate-pulse-aura pointer-events-none" />
          <span className="text-3xl sm:text-4xl select-none">✨</span>
          <span className="w-12 h-3 rounded-full bg-white/40 shadow-inner" />
        </button>
      </div>
    </Island5Shell>
  );
}
