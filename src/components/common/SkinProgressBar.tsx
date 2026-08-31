import { useEffect, useRef, useState } from "react";
import { Star, Crown } from "lucide-react";
import { skinUrl } from "../../utils/assets";
import { getSkinPhaseProgress, SKIN_PHASE_THRESHOLDS, type SkinPhaseProgress } from "../../utils/progress";

/* Barra ÉPICA de progreso hacia el PRÓXIMO personaje (fase de skin por
 * estrellas). Es protagonista de la pantalla: panel grande de vidrio anclado
 * abajo-centro en el mapa de mundos y en el detalle de isla (NUNCA en el
 * gameplay). pointer-events-none → nunca tapa los niveles ni el mapa.
 *
 * Comparte el lenguaje visual de la celebración de desbloqueo: orbes con aro
 * de luz girando (mini sunburst), halos pulsantes, chispas flotando, relleno
 * dorado con destello que lo recorre y una estrella-cometa en la punta.
 *
 * El orbe izquierdo es el personaje ACTUAL; el derecho es el MISTERIOSO (la
 * silueta REAL de la próxima fase, ennegrecida + un "?" brillante) — un teaser
 * verdadero del que viene. En fase máxima el orbe derecho revela al personaje
 * final con una corona.
 *
 * Animación de llenado: el último total VISTO queda en localStorage; al montar
 * la barra se dibuja en ese valor y transiciona hasta el total real, así las
 * estrellas ganadas desde la última visita se ven "entrar". Escucha
 * edutic:progress para subir en vivo. Al cruzar de fase salta a 0 sin animar
 * hacia atrás y llena de nuevo (la celebración cubre ese momento). */

const SEEN_STARS_KEY = "edutic_skin_seen_stars_v1";
const TOTAL_PHASES = SKIN_PHASE_THRESHOLDS.length;

/* Chispas decorativas alrededor del panel (deterministas — sin Math.random
   para que cada render sea idéntico). */
const SPARKS: Array<{ top: string; left: string; size: number; color: string; delay: number; glyph: string }> = [
  { top: "-14%", left: "8%",  size: 13, color: "#ffd552", delay: 0.0, glyph: "✦" },
  { top: "-20%", left: "34%", size: 10, color: "#9b7cff", delay: 1.1, glyph: "★" },
  { top: "-10%", left: "62%", size: 12, color: "#54e8c6", delay: 0.6, glyph: "✶" },
  { top: "-22%", left: "88%", size: 11, color: "#ff9fca", delay: 1.7, glyph: "✦" },
  { top: "108%", left: "20%", size: 10, color: "#25c8df", delay: 0.9, glyph: "★" },
  { top: "104%", left: "78%", size: 12, color: "#ffd552", delay: 2.0, glyph: "✶" },
];

function readSeenStars(): number {
  const n = Number(localStorage.getItem(SEEN_STARS_KEY));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** % del tramo de la fase actual que cubre `stars` (100 en fase máxima). */
function segmentPct(p: SkinPhaseProgress, stars: number): number {
  if (p.isMax || p.nextThreshold === null) return 100;
  const span = p.nextThreshold - p.prevThreshold;
  return Math.max(0, Math.min(100, ((stars - p.prevThreshold) / span) * 100));
}

export function SkinProgressBar({ className = "" }: { className?: string }) {
  const [prog, setProg] = useState(() => getSkinPhaseProgress());
  const [pct, setPct] = useState(() =>
    segmentPct(getSkinPhaseProgress(), Math.min(readSeenStars(), getSkinPhaseProgress().totalStars)),
  );
  const [gaining, setGaining] = useState(false);
  /* Primer pintado sin transición (la barra aparece YA en el valor visto). */
  const [instant, setInstant] = useState(true);
  const phaseRef = useRef(prog.phaseIndex);
  const gainTimer = useRef<number | null>(null);

  useEffect(() => {
    const pulse = () => {
      setGaining(true);
      if (gainTimer.current !== null) window.clearTimeout(gainTimer.current);
      gainTimer.current = window.setTimeout(() => setGaining(false), 2200);
    };

    /* Tras el primer pintado: animar desde el valor visto hasta el real. */
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setInstant(false);
        const current = getSkinPhaseProgress();
        const target = segmentPct(current, current.totalStars);
        setPct((drawn) => {
          if (target > drawn) pulse();
          return target;
        });
        localStorage.setItem(SEEN_STARS_KEY, String(current.totalStars));
      }),
    );

    const update = () => {
      const next = getSkinPhaseProgress();
      setProg(next);
      localStorage.setItem(SEEN_STARS_KEY, String(next.totalStars));
      if (next.phaseIndex !== phaseRef.current) {
        /* Fase nueva → tramo nuevo: snap a 0 (sin animar hacia atrás) y llenar. */
        const grewPhase = next.phaseIndex > phaseRef.current;
        phaseRef.current = next.phaseIndex;
        setInstant(true);
        setPct(0);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            setInstant(false);
            /* Releer fresco: si llegó OTRO evento mientras este rAF estaba
               pendiente, el snapshot capturado quedaría viejo y pisaría el
               valor más nuevo. */
            const fresh = getSkinPhaseProgress();
            setPct(segmentPct(fresh, fresh.totalStars));
            if (grewPhase) pulse();
          }),
        );
      } else {
        setPct((drawn) => {
          const target = segmentPct(next, next.totalStars);
          if (target > drawn) pulse();
          return target;
        });
      }
    };
    window.addEventListener("edutic:progress", update);
    window.addEventListener("storage", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("edutic:progress", update);
      window.removeEventListener("storage", update);
      if (gainTimer.current !== null) window.clearTimeout(gainTimer.current);
    };
  }, []);

  const mysteryPhase = prog.isMax ? prog.phaseIndex : prog.phaseIndex + 1;
  const ariaLabel = prog.isMax
    ? `Personajes al máximo nivel con ${prog.totalStars} estrellas`
    : `Llevás ${prog.totalStars} de ${prog.nextThreshold} estrellas para el próximo personaje`;

  return (
    /* z-40: visible sobre el mapa/isla, por debajo de la celebración (z-[55]),
       del menú/HUD superior (z-50) y del banner de impersonación (z-[60]). */
    <div
      className={[
        "fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[92vw] px-2",
        "pointer-events-none select-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="relative animate-skin-bar-rise">
        {/* Aura pulsante detrás del panel (look soñado, paleta de marca). */}
        <div
          className="absolute -inset-1.5 rounded-[2rem] blur-xl opacity-55 animate-loader-halo"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(255,220,130,0.45), rgba(155,124,255,0.22) 45%, rgba(37,200,223,0.16) 65%, transparent 78%)",
          }}
          aria-hidden="true"
        />

        {/* Chispas flotando alrededor del panel. */}
        {SPARKS.map((s, i) => (
          <span
            key={i}
            className="absolute font-display animate-twinkle"
            style={{
              top: s.top,
              left: s.left,
              fontSize: s.size,
              color: s.color,
              textShadow: `0 0 8px ${s.color}cc`,
              animationDelay: `${s.delay}s`,
            }}
            aria-hidden="true"
          >
            {s.glyph}
          </span>
        ))}

        {/* Panel principal de vidrio. Fondo blanco OPACO fijo (no translúcido)
            para que el color del panel NO cambie según el arte que tiene detrás
            y coincida exactamente con el header de arriba en cualquier isla. */}
        <div
          className="glass-card skin-bar-panel relative flex items-center gap-2.5 sm:gap-3 rounded-full pl-1.5 pr-3.5 py-1.5 sm:pr-4 border border-white/60 overflow-hidden"
          style={{ background: "rgba(255,255,255,0.82)" }}
        >
          {/* Brillo superior que recorre el panel en loop (estilo marca). */}
          <span
            className="absolute inset-x-0 top-0 h-px animate-route-shimmer pointer-events-none"
            style={{
              backgroundImage: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)",
              backgroundSize: "200% 100%",
            }}
            aria-hidden="true"
          />

          {/* ── Orbe del personaje ACTUAL ── */}
          <span className="relative grid place-items-center shrink-0 w-10 h-10 sm:w-11 sm:h-11">
            <span className="skin-orb-ring absolute inset-0 rounded-full animate-sparkle-spin blur-[1.5px]" aria-hidden="true" />
            <span
              className="absolute inset-[6%] rounded-full animate-loader-halo"
              style={{ background: "radial-gradient(circle, rgba(255,224,140,0.7), transparent 70%)" }}
              aria-hidden="true"
            />
            <span className="relative w-[84%] h-[84%] rounded-full bg-white/75 border border-white/85 grid place-items-center overflow-hidden shadow-inner">
              <img
                src={skinUrl("male", prog.phaseIndex)}
                alt=""
                decoding="async"
                className="w-[82%] h-[82%] object-contain drop-shadow animate-mascot-float"
              />
            </span>
          </span>

          {/* ── Centro: etiqueta + conteo + barra + evolución ── */}
          <div className="min-w-0 w-[9.5rem] sm:w-[12rem] flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display font-bold uppercase tracking-[0.12em] text-[0.56rem] sm:text-[0.62rem] text-accent-strong/80 truncate">
                {prog.isMax ? "¡Completa!" : "Próximo personaje"}
              </span>
              <span className="flex items-center gap-0.5 font-display font-black text-text tabular-nums leading-none text-xs sm:text-sm whitespace-nowrap">
                {prog.isMax ? prog.totalStars : `${prog.totalStars}/${prog.nextThreshold}`}
                <Star
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 drop-shadow-[0_1px_3px_rgba(250,204,21,0.7)]"
                  strokeWidth={1.5}
                  fill="currentColor"
                />
              </span>
            </div>

            {/* Riel de progreso del tramo actual + cometa en la punta. El sheen
                que recorre el oro lo aporta .skin-bar-fill::after; el cometa
                (.skin-bar-tip) viaja con el % como hermano del riel (fuera del
                overflow-hidden) para que su glow no se recorte. */}
            <div className="relative">
              <span className="block h-2 sm:h-2.5 rounded-full bg-white/45 border border-white/60 overflow-hidden shadow-inner">
                <span
                  className={`skin-bar-fill block h-full rounded-full ${gaining ? "animate-skin-bar-gain" : ""}`}
                  style={{ width: `${pct}%`, ...(instant ? { transition: "none" } : null) }}
                />
              </span>
              {!prog.isMax && pct > 0 && (
                <span
                  className="skin-bar-tip"
                  style={{ left: `${pct}%`, ...(instant ? { transition: "none" } : null) }}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Los puntos de evolución. Antes iban en un TERCER renglón, con la
                leyenda "Evolución 1 de 5" al lado, y ese renglón era el que más
                alto le agregaba al panel para decir algo que los puntos ya
                dicen solos. Ahora van pegados al riel, chiquitos, y la leyenda
                vive en el aria-label para quien use lector de pantalla. */}
            <div className="flex items-center gap-[3px]" aria-hidden="true">
              {Array.from({ length: TOTAL_PHASES }, (_, i) => (
                <span
                  key={i}
                  className={
                    i <= prog.phaseIndex
                      ? "w-1.5 h-1.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-[0_0_5px_rgba(250,204,21,0.8)]"
                      : "w-1.5 h-1.5 rounded-full bg-white/60 border border-white/70"
                  }
                />
              ))}
            </div>
          </div>

          {/* ── Orbe MISTERIOSO (próxima fase) / personaje final en fase máxima ── */}
          <span className="relative grid place-items-center shrink-0 w-10 h-10 sm:w-11 sm:h-11">
            <span className="skin-orb-ring absolute inset-0 rounded-full animate-sparkle-spin blur-[1.5px]" aria-hidden="true" />
            <span
              className="absolute inset-[6%] rounded-full animate-loader-halo"
              style={{
                background: prog.isMax
                  ? "radial-gradient(circle, rgba(255,224,140,0.8), transparent 70%)"
                  : "radial-gradient(circle, rgba(155,124,255,0.55), transparent 70%)",
                animationDelay: "0.8s",
              }}
              aria-hidden="true"
            />
            <span className="relative w-[84%] h-[84%] rounded-full bg-white/75 border border-white/85 grid place-items-center overflow-hidden shadow-inner">
              <img
                src={skinUrl("male", mysteryPhase)}
                alt=""
                decoding="async"
                className={`w-[82%] h-[82%] object-contain ${
                  prog.isMax ? "drop-shadow animate-mascot-float" : "brightness-0 opacity-80"
                }`}
              />
              {!prog.isMax && (
                <span
                  className="absolute inset-0 grid place-items-center font-display font-black text-white text-xl sm:text-2xl animate-mystery-pulse"
                  aria-hidden="true"
                >
                  ?
                </span>
              )}
            </span>
            {/* Corona al alcanzar la última fase. */}
            {prog.isMax && (
              <Crown
                className="absolute -top-2 sm:-top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 sm:w-6 sm:h-6 text-amber-400 drop-shadow-[0_1px_4px_rgba(250,204,21,0.9)] animate-star-wiggle"
                fill="currentColor"
                strokeWidth={1.2}
                aria-hidden="true"
              />
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
