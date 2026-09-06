import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "./Button";
import { skinUrl, type SkinKind } from "../../utils/assets";
import { getSkinPhaseIndex, SKIN_PHASE_THRESHOLDS } from "../../utils/progress";

/* Celebración ÉPICA al desbloquear una FASE de personaje nueva (por estrellas).
 *
 * Coreografía (~2s, todo CSS, estilo TYPELY):
 *   0ms   el fondo se difumina; detrás del card giran rayos dorados/violetas
 *         (sunburst) con un bloom pulsante, y cae una lluvia de estrellas.
 *   60ms  el card de vidrio hace pop.
 *  ~300ms baja el overline y el título con el gradiente de marca animado.
 *  ~550ms los tres personajes SUBEN A ESCENA escalonados (rise con blur +
 *         overshoot) y cada uno dispara un anillo de impacto al aterrizar;
 *         después quedan flotando desincronizados sobre pedestales de luz.
 * ~1250ms chip de estrellas + puntos de evolución (fase X de 5) + CTA.
 *
 * Se monta en las pantallas "hub" (mapa de mundos / detalle de isla): cuando
 * la fase actual supera la última fase celebrada (persistida en localStorage)
 * aparece; al cerrar se registra la fase como celebrada. Primera visita de
 * una cuenta existente: registra la fase actual SIN celebrar (nada
 * retroactivo). Si el progreso se reinicia, se re-sincroniza hacia abajo. */

const CELEBRATED_KEY = "edutic_skin_phase_celebrated_v1";
const REVEAL_KINDS: SkinKind[] = ["female", "ship", "male"];

/* Lluvia de estrellas: partículas deterministas (posición/tamaño/tempo
 * variados a mano — sin Math.random para que cada render sea idéntico). */
const CONFETTI: Array<{ left: string; size: number; color: string; dur: number; delay: number; glyph: string }> = [
  { left: "3%",  size: 16, color: "#facc15", dur: 3.2, delay: 0.0, glyph: "★" },
  { left: "11%", size: 11, color: "#9b7cff", dur: 4.1, delay: 1.3, glyph: "✦" },
  { left: "19%", size: 14, color: "#ff9fca", dur: 3.6, delay: 0.6, glyph: "✶" },
  { left: "27%", size: 10, color: "#ffffff", dur: 4.4, delay: 2.0, glyph: "✦" },
  { left: "35%", size: 17, color: "#ffd552", dur: 3.0, delay: 1.0, glyph: "★" },
  { left: "43%", size: 12, color: "#54e8c6", dur: 3.9, delay: 0.2, glyph: "✶" },
  { left: "51%", size: 15, color: "#facc15", dur: 3.4, delay: 1.7, glyph: "✦" },
  { left: "59%", size: 10, color: "#ff9fca", dur: 4.2, delay: 0.9, glyph: "★" },
  { left: "67%", size: 13, color: "#9b7cff", dur: 3.3, delay: 2.3, glyph: "✶" },
  { left: "75%", size: 16, color: "#ffffff", dur: 3.8, delay: 0.4, glyph: "★" },
  { left: "83%", size: 11, color: "#54e8c6", dur: 4.0, delay: 1.5, glyph: "✦" },
  { left: "91%", size: 14, color: "#ffd552", dur: 3.1, delay: 0.8, glyph: "★" },
  { left: "96%", size: 10, color: "#ff9fca", dur: 4.5, delay: 2.6, glyph: "✶" },
  { left: "47%", size: 9,  color: "#ffffff", dur: 4.8, delay: 3.1, glyph: "✦" },
];

function readCelebrated(): number | null {
  const raw = localStorage.getItem(CELEBRATED_KEY);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function SkinUnlockCelebration({
  phase,
  onDismiss,
}: {
  /** Modo CONTROLADO: mostrar la celebración de ESTA fase directamente (lo usa
   *  el modal de nivel completado, justo después de la barra que suma las
   *  estrellas). Si es `undefined`, la celebración se AUTO-DETECTA en las
   *  pantallas hub (mapa de mundos / detalle de isla) como hasta ahora. */
  phase?: number;
  onDismiss?: () => void;
} = {}) {
  const controlled = phase !== undefined;
  const [shownPhase, setShownPhase] = useState<number | null>(controlled ? (phase as number) : null);

  /* Auto-detección — SOLO en modo no controlado (pantallas hub). */
  useEffect(() => {
    if (controlled) return;
    const check = () => {
      const currentPhase = getSkinPhaseIndex();
      const celebrated = readCelebrated();
      if (celebrated === null || currentPhase < celebrated) {
        localStorage.setItem(CELEBRATED_KEY, String(currentPhase));
        return;
      }
      if (currentPhase > celebrated) setShownPhase(currentPhase);
    };
    check();
    window.addEventListener("edutic:progress", check);
    window.addEventListener("storage", check);
    return () => {
      window.removeEventListener("edutic:progress", check);
      window.removeEventListener("storage", check);
    };
  }, [controlled]);

  /* Modo controlado — seguir el prop `phase`. */
  useEffect(() => {
    if (controlled) setShownPhase(phase as number);
  }, [controlled, phase]);

  /* Cerrar con Escape mientras está visible. */
  useEffect(() => {
    if (shownPhase === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownPhase]);

  if (shownPhase === null) return null;

  const dismiss = () => {
    /* Registrar la fase ACTUAL como celebrada para que el hub no la repita
       (vale tanto para el modo auto como para el controlado del modal). */
    localStorage.setItem(CELEBRATED_KEY, String(getSkinPhaseIndex()));
    setShownPhase(null);
    onDismiss?.();
  };

  const threshold = SKIN_PHASE_THRESHOLDS[shownPhase] ?? SKIN_PHASE_THRESHOLDS[SKIN_PHASE_THRESHOLDS.length - 1];
  const totalPhases = SKIN_PHASE_THRESHOLDS.length;

  return (
    /* z-[55]: por encima del stack fijo del mapa (z-50, contador + menú) pero
       por debajo del ImpersonationBanner global (z-[60]), que debe quedar
       siempre visible. */
    <div
      className="fixed inset-0 z-[55] grid place-items-center p-4 animate-overlay-fade"
      role="dialog"
      aria-modal="true"
      aria-label="Nuevos personajes desbloqueados"
    >
      <div className="modal-overlay" onClick={dismiss} />

      {/* ── Atmósfera: sunburst girando + bloom pulsante + lluvia de estrellas.
          Va DEBAJO del card de vidrio: su backdrop-blur difumina los rayos y
          el conjunto queda soñado, no estridente. ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none grid place-items-center" aria-hidden="true">
        <div className="skin-rays col-start-1 row-start-1 w-[150vmin] h-[150vmin] rounded-full animate-sparkle-spin" />
        <div
          className="col-start-1 row-start-1 w-[58vmin] h-[58vmin] rounded-full animate-loader-halo"
          style={{ background: "radial-gradient(circle, rgba(255,230,150,0.5), rgba(255,159,202,0.18) 48%, transparent 72%)" }}
        />
        {CONFETTI.map((p, i) => (
          <span
            key={i}
            className="skin-confetti absolute font-display select-none"
            style={{
              left: p.left,
              top: "-7vh",
              fontSize: p.size,
              color: p.color,
              textShadow: `0 0 8px ${p.color}aa`,
              ["--fall-dur" as string]: `${p.dur}s`,
              ["--fall-delay" as string]: `${p.delay}s`,
            }}
          >
            {p.glyph}
          </span>
        ))}
      </div>

      <div
        className="glass-card modal-card tarjeta-marca relative w-full max-w-lg max-h-[92dvh] overflow-y-auto px-6 py-8 text-center animate-card-pop"
        style={{ animationDelay: "60ms" }}
      >
        {/* Overline + título con el gradiente de marca en loop. */}
        <p
          className="font-display font-bold uppercase tracking-[0.22em] text-[0.72rem] text-accent-strong/80 m-0 animate-title-drop"
          style={{ animationDelay: "280ms" }}
        >
          ✦ ¡Lo lograste! ✦
        </p>
        <h2
          className="text-gradient-loop font-display font-bold text-[2rem] sm:text-[2.3rem] leading-tight mt-1 mb-6 animate-title-drop"
          style={{ animationDelay: "380ms" }}
        >
          ¡Tus personajes evolucionaron!
        </h2>

        {/* Trío subiendo a escena: robot mujer · nave (al centro, elevada) ·
            robot hombre. Cada uno con anillo de impacto y pedestal de luz. */}
        <div className="flex items-end justify-center gap-3 sm:gap-6 mb-6">
          {REVEAL_KINDS.map((kind, i) => {
            const riseDelay = 550 + i * 200;
            return (
              <span
                key={kind}
                className={`relative flex flex-col items-center animate-skin-hero-rise ${kind === "ship" ? "pb-5" : ""}`}
                style={{ animationDelay: `${riseDelay}ms` }}
              >
                {/* Anillo de impacto al aterrizar. */}
                <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
                  <i
                    className="w-24 h-24 rounded-full border-[3px] border-amber-300/80 animate-skin-land-ring"
                    style={{ animationDelay: `${riseDelay + 430}ms` }}
                  />
                </span>
                <img
                  src={skinUrl(kind, shownPhase)}
                  alt=""
                  decoding="async"
                  className={`relative object-contain drop-shadow-lg animate-mascot-float ${
                    kind === "ship" ? "w-20 sm:w-26" : "w-24 sm:w-30"
                  }`}
                  style={{ animationDelay: `${-1.3 * i}s` }}
                />
                {/* Pedestal de luz pulsante. */}
                <span
                  className="-mt-1 w-16 sm:w-20 h-3 rounded-full blur-[2px] animate-loader-halo"
                  style={{
                    background: "radial-gradient(ellipse, rgba(255,220,130,0.85), rgba(255,159,202,0.3) 60%, transparent 75%)",
                    animationDelay: `${i * 0.7}s`,
                  }}
                  aria-hidden="true"
                />
              </span>
            );
          })}
        </div>

        {/* Chip de estrellas + progreso de evolución (fase X de 5). */}
        <div className="animate-mission-rise" style={{ animationDelay: "1250ms" }}>
          <span className="glass-surface inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-display font-bold text-text text-sm">
            <Star
              size={17}
              strokeWidth={1.5}
              className="text-amber-400 drop-shadow-[0_1px_3px_rgba(250,204,21,0.7)] animate-star-wiggle"
              fill="currentColor"
            />
            ¡Llegaste a {threshold} estrellas!
          </span>
          <div
            className="flex items-center justify-center gap-1.5 mt-3"
            aria-label={`Evolución ${shownPhase + 1} de ${totalPhases}`}
          >
            {Array.from({ length: totalPhases }, (_, i) => (
              <span
                key={i}
                className={
                  i <= shownPhase
                    ? "w-2.5 h-2.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-[0_0_6px_rgba(250,204,21,0.8)]"
                    : "w-2.5 h-2.5 rounded-full bg-white/50 border border-white/70"
                }
              />
            ))}
          </div>
          <p className="text-muted font-semibold text-xs mt-1.5 mb-0">
            Evolución {shownPhase + 1} de {totalPhases}
          </p>
        </div>

        <div className="animate-mission-rise mt-5" style={{ animationDelay: "1450ms" }}>
          <Button
            className="w-full relative overflow-hidden text-lg"
            style={{ backgroundImage: "linear-gradient(135deg, #54e8c6, #25c8df, #536bff)" }}
            onClick={dismiss}
            autoFocus
          >
            {/* Destello que recorre el botón en loop. */}
            <span
              className="absolute inset-0 animate-route-shimmer pointer-events-none"
              style={{
                backgroundImage: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%)",
                backgroundSize: "200% 100%",
              }}
              aria-hidden="true"
            />
            ¡Genial!
          </Button>
        </div>
      </div>
    </div>
  );
}
