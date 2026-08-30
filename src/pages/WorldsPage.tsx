import {
  AppWindow,
  Asterisk,
  AtSign,
  BookOpen,
  Check,
  Command,
  Flag,
  FlaskConical,
  Flower2,
  Gem,
  GraduationCap,
  Lock,
  LogOut,
  MessageSquare,
  MousePointerClick,
  Medal,
  Menu,
  PenLine,
  Search,
  Star,
  Trophy,
  Type,
  UserRound,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getWorldStarRequirements, getWorldStatesForUser, getWorldsForUser, worldStarProgress, type World } from "../data/worlds";
import { Toast } from "../components/common/Toast";
import { StarCounter } from "../components/common/StarCounter";
import { CharacterSkin } from "../components/common/CharacterSkin";
import { SkinProgressBar } from "../components/common/SkinProgressBar";
import { SkinUnlockCelebration } from "../components/common/SkinUnlockCelebration";
import { assets } from "../utils/assets";
import { getUserContext, loadMyGroup, makeRapidClickDetector } from "../utils/userContext";
import { getTotalStars, loadProgress, hydrateProgress, flushProgressQueue } from "../utils/progress";

/* ------------------------------------------------------------------ */
/* Asset pre-fetch cache                                               */
/* ------------------------------------------------------------------ */
const prefetched = new Set<string>();
function prefetchImage(src: string) {
  if (!src || prefetched.has(src)) return;
  prefetched.add(src);
  const img = new Image();
  img.decoding = "async";
  img.src = src;
}

/* ------------------------------------------------------------------ */
/* World-map layout helpers                                            */
/* ------------------------------------------------------------------ */
/* Right-edge padding past the last island. Has to cover the island's
   20vw footprint + hover/selected lift + a visual gutter so the last
   island doesn't sit flush against the scroll edge (which would let
   the right half of the island get clipped by the scene's
   overflow:hidden + the body padding). 40vw is enough for the 20vw
   island plus the lift margin and ~5–6vw of visual breathing room on
   every viewport. */
const TRACK_PADDING_VW = 40;

function trackWidth(worlds: World[]) {
  if (!worlds.length) return 100;
  return Math.max(...worlds.map((w) => w.map.x)) + TRACK_PADDING_VW;
}

/** Visual centre of an island (for the SVG trail path). */
function islandCenter(world: World) {
  return { x: world.map.x + 10, y: world.map.y + 16 };
}

function buildRoute(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

/* ------------------------------------------------------------------ */
/* Per-island theme gradients (replaces BEM `world-island--islandN`)   */
/* ------------------------------------------------------------------ */
const islandTheme: Record<World["slug"], { ring: string; glow: string; badge: string }> = {
  island1:  { ring: "from-sky-300 to-blue-400",       glow: "rgba(51,199,240,0.45)", badge: "from-sky-400 to-blue-500" },
  island2:  { ring: "from-emerald-300 to-teal-400",    glow: "rgba(34,199,184,0.45)", badge: "from-emerald-400 to-teal-500" },
  island3:  { ring: "from-violet-300 to-purple-400",   glow: "rgba(156,113,255,0.45)", badge: "from-violet-400 to-purple-500" },
  island4:  { ring: "from-indigo-300 to-blue-500",     glow: "rgba(83,107,255,0.45)",  badge: "from-indigo-400 to-blue-600" },
  island5:  { ring: "from-cyan-300 to-sky-400",        glow: "rgba(51,199,240,0.45)", badge: "from-cyan-400 to-sky-500" },
  island6:  { ring: "from-teal-300 to-emerald-400",    glow: "rgba(89,203,183,0.45)", badge: "from-teal-400 to-emerald-500" },
  island7:  { ring: "from-lime-300 to-green-400",      glow: "rgba(132,204,22,0.40)", badge: "from-lime-400 to-green-500" },
  island8:  { ring: "from-amber-300 to-orange-400",    glow: "rgba(251,191,36,0.45)", badge: "from-amber-400 to-orange-500" },
  island9:  { ring: "from-rose-300 to-pink-400",       glow: "rgba(255,159,202,0.45)", badge: "from-rose-400 to-pink-500" },
  island10: { ring: "from-fuchsia-300 to-pink-400",    glow: "rgba(217,70,239,0.40)", badge: "from-fuchsia-400 to-pink-500" },
  island11: { ring: "from-blue-300 to-indigo-400",     glow: "rgba(99,102,241,0.45)", badge: "from-blue-400 to-indigo-500" },
  island12: { ring: "from-sky-300 to-cyan-400",        glow: "rgba(56,189,248,0.45)", badge: "from-sky-400 to-cyan-500" },
  island13: { ring: "from-pink-300 to-rose-400",       glow: "rgba(255,127,160,0.45)", badge: "from-pink-400 to-rose-500" },
  island14: { ring: "from-yellow-300 to-amber-400",    glow: "rgba(250,204,21,0.45)", badge: "from-yellow-400 to-amber-500" },
  island15: { ring: "from-violet-400 to-fuchsia-400",  glow: "rgba(168,85,247,0.50)", badge: "from-violet-500 to-fuchsia-500" },
};

/* ------------------------------------------------------------------ */
/* Badge + label dictionaries                                          */
/* ------------------------------------------------------------------ */
const worldBadges: Record<World["slug"], LucideIcon> = {
  island1: Gem,
  island2: FlaskConical,
  island3: Flower2,
  island4: BookOpen,
  island5: MousePointerClick,
  island6: Type,
  island7: PenLine,
  island8: Asterisk,
  island9: AtSign,
  island10: Search,
  island11: Command,
  island12: AppWindow,
  island13: MessageSquare,
  island14: Zap,
  island15: Trophy,
};

const worldLabels: Record<World["slug"], string> = {
  island1: "Mundo letras",
  island2: "Mundo palabras",
  island3: "Mundo biblioteca",
  island4: "Mundo símbolos",
  island5: "Mundo digital",
  island6: "Mundo escritura",
  island7: "Mundo palabras largas",
  island8: "Mundo signos",
  island9: "Mundo correos",
  island10: "Mundo búsquedas",
  island11: "Mundo comandos",
  island12: "Mundo ventanas",
  island13: "Mundo mensajes",
  island14: "Mundo atajos",
  island15: "Mundo gran reto",
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
export function WorldsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  /* The island art is now optimized/lightweight, so we no longer hold a
     "preparando…" splash — the map renders immediately on every visit. */
  const [worldsReady] = useState(true);
  /* Slugs that became unlocked since the last visit → play a celebratory
     reveal animation when the student returns to the map. */
  const [justUnlocked, setJustUnlocked] = useState<Set<string>>(new Set());
  const pendingNav = useRef<number | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  /* Trail path + the real stars that glide along it (positioned each frame
     by sampling the path — see the rAF effect below). */
  const routePathRef = useRef<SVGPathElement | null>(null);
  const starRefs = useRef<(HTMLSpanElement | null)[]>([]);
  /* Inner track + per-island refs so we can measure each island's REAL visual
     centre and route the trail through it (a static % offset can't be right at
     every aspect ratio — that's why the line drifted off-centre on different
     screen sizes). */
  const trackRef = useRef<HTMLDivElement | null>(null);
  const islandRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [measuredCenters, setMeasuredCenters] = useState<{ x: number; y: number }[]>([]);

  /* Build the user context + world model once per user (not on every render).
     Rebuilding all 15 worlds + reading localStorage on each hover/menu toggle
     was a real cost; memoizing removes it. Progress is stable within a mount
     (this page never writes it). */
  /* Al entrar al juego se traen dos cosas del servidor:
       - el grupo del alumno, que dice qué islas habilitó su docente;
       - su progreso, para que sobreviva a cambiar de computadora.
     Y de paso se vacía la cola de niveles que quedaron sin enviar.

     Nada de esto bloquea el dibujado: la pantalla se arma con lo que hay
     en localStorage y se vuelve a armar cuando llega la respuesta. Si no
     hay red, se juega igual. */
  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.all([loadMyGroup(), hydrateProgress()]);
      await flushProgressQueue();
      if (!cancelled) setSyncTick((t) => t + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const context = useMemo(() => getUserContext(user), [user, syncTick]);
  const progress = useMemo(() => loadProgress(), [user, syncTick]);
  const visibleWorlds = useMemo(() => getWorldsForUser(context, progress), [context, progress]);
  const worldStates = useMemo(() => getWorldStatesForUser(context, progress), [context, progress]);

  /* Track widths and SVG path — memoized so the heavy SVG path string is
     rebuilt only when the visible set changes, not on every hover/focus
     render. Cheaper than relying on the referential stability of
     `visibleWorlds` (the function reads localStorage). */
  const trackWidthVw = useMemo(() => trackWidth(visibleWorlds), [visibleWorlds]);
  /* Approximate centres (used until the real ones are measured on first paint). */
  const fallbackCenters = useMemo(() => visibleWorlds.map(islandCenter), [visibleWorlds]);
  /* Measure each island's real centre (in SVG units: x in vw, y in % of track
     height) so the trail passes through the middle of every island, on any
     screen size. Re-runs on mount, when the visible set changes, and on resize. */
  useLayoutEffect(() => {
    function measure() {
      const track = trackRef.current;
      if (!track) return;
      const trackRect = track.getBoundingClientRect();
      const vwPx = window.innerWidth / 100;
      const next: { x: number; y: number }[] = [];
      for (let i = 0; i < visibleWorlds.length; i++) {
        const el = islandRefs.current[i];
        if (!el) return; // not all mounted yet — try again next frame
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2 - trackRect.left;
        const cy = r.top + r.height / 2 - trackRect.top;
        next.push({ x: cx / vwPx, y: (cy / trackRect.height) * 100 });
      }
      setMeasuredCenters(next);
    }
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [visibleWorlds]);

  const centers =
    measuredCenters.length === visibleWorlds.length && visibleWorlds.length > 0
      ? measuredCenters
      : fallbackCenters;
  const ROUTE_D = useMemo(() => buildRoute(centers), [centers]);
  const routeSparkles = useMemo(
    () =>
      centers.slice(0, -1).map((c, i) => ({
        x: (c.x + centers[i + 1].x) / 2,
        y: (c.y + centers[i + 1].y) / 2,
        delay: (i % 4) * 0.6,
      })),
    [centers],
  );

  /* Hidden 5-click dev bypass — clicking an island 5× quickly enters it
     even if it is locked.  No UI feedback is shown; it's invisible to
     normal students. */
  const devClickRef = useRef(makeRapidClickDetector(450, 5));

  /* Auto-scroll so the next unlocked world is centred on load. */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const currentWorld =
      visibleWorlds.find((w) => worldStates[w.slug] === "current") ?? visibleWorlds[0];
    if (!currentWorld) return;
    const vwPx = window.innerWidth / 100;
    const targetPx = (currentWorld.map.x + 8) * vwPx;
    const left = Math.max(0, targetPx - scene.clientWidth / 2);
    scene.scrollTo({ left, behavior: "smooth" });
    // Run once on mount; unlock-state changes after page-load are rare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Glide the real stars slowly along the trail. We sample the SVG path with
     getPointAtLength (undistorted user units: x in vw, y in %) and position
     the star spans over the map each frame. Honours reduced-motion. */
  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const path = routePathRef.current;
    if (!path) return;
    let len = 0;
    try {
      len = path.getTotalLength();
    } catch {
      return;
    }
    if (!len) return;
    const N = starRefs.current.length || 2;
    const SPEED = len / 18000; // full pass ≈ 18 s → gentle, slow drift
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const elapsed = t - start;
      for (let i = 0; i < N; i++) {
        const el = starRefs.current[i];
        if (!el) continue;
        const dist = (elapsed * SPEED + (i * len) / N) % len;
        const p = path.getPointAtLength(dist);
        el.style.left = `${p.x}vw`;
        el.style.top = `${p.y}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ROUTE_D]);

  /* Detect islands unlocked since the last visit and flag them for the reveal
     animation. Runs once the map is actually visible (after the loader). On a
     student's very first ever visit we only record the baseline — no burst. */
  useEffect(() => {
    if (!worldsReady) return;
    const KEY = "edutic.unlockedSeen";
    const unlockedSlugs = visibleWorlds
      .filter((w) => worldStates[w.slug] !== "locked")
      .map((w) => w.slug);
    let prev: string[] | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      prev = raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
      prev = null;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(unlockedSlugs));
    } catch {
      /* ignore */
    }
    if (!prev) return; // first ever visit — just record the baseline
    const prevSet = new Set(prev);
    const newly = unlockedSlugs.filter((s) => !prevSet.has(s));
    if (newly.length === 0) return;
    setJustUnlocked(new Set(newly));
    const t = window.setTimeout(() => setJustUnlocked(new Set()), 2400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldsReady]);

  function leave() {
    logout();
    navigate("/login");
  }

  function enterWorld(world: World, bypassLock = false) {
    if (worldStates[world.slug] === "locked" && !bypassLock) {
      const need = starRequirements[world.id] ?? 0;
      setMessage(
        `Necesitás ${need} estrellas para abrir este mundo. Llevás ${totalStars}. ` +
          "¡Conseguí más estrellas en los mundos anteriores!",
      );
      return;
    }
    /* Pre-fetch the island background so the destination page paints instantly.
       We used to gate the navigation on a JS timer (430–1100 ms) so the radial
       white flash had time to animate. The flash itself is CSS — it keeps
       playing while we navigate — so the JS timer was just blocking the user.
       A simple `setSelectedWorld` flips the `.is-entering-world` class, the
       CSS transition (`.world-transition.is-active`) handles the fade, and
       the next page appears as soon as React commits. Net effect: navigation
       feels snappier, especially on slow devices, with no visual regression. */
    setSelectedWorld(world.id);
    prefetched.add(world.background);
    if (pendingNav.current != null) window.clearTimeout(pendingNav.current);
    /* Tiny delay so the CSS transition starts before the route changes,
       otherwise the new page mounts over the still-fading overlay. 1
       frame is enough. */
    pendingNav.current = window.setTimeout(() => {
      pendingNav.current = null;
      navigate(world.route);
    }, 16);
  }

  function handleIslandClick(world: World) {
    const isLocked = worldStates[world.slug] === "locked";

    /* Hidden dev bypass: 5 quick clicks on the same island open it even when
       locked (for testing / presenting the full product). Everyone else —
       including the admin/superadmin player — must reach this world's
       cumulative star requirement first, so the gate actually blocks play. */
    const devBypass = devClickRef.current(world.id);
    if (devBypass && isLocked) {
      enterWorld(world, true);
      return;
    }
    enterWorld(world, false);
  }

  function prefetchWorld(world: World) {
    prefetchImage(world.background);
  }

  /* Real running account-wide star total — drives the menu chip, the top-right
     StarCounter and the world-unlock gate (was a per-visible-world sum). */
  const totalStars = useMemo(() => getTotalStars(progress), [progress]);
  /* Stars needed to UNLOCK each visible world (cumulative max of prior worlds). */
  const starRequirements = useMemo(
    () => getWorldStarRequirements(visibleWorlds.map((w) => w.id)),
    [visibleWorlds],
  );

  return (
    <main
      className={[
        "relative min-h-dvh overflow-hidden bg-cover bg-center animate-page-fade",
        "transition-opacity duration-500",
        selectedWorld ? "opacity-60" : "opacity-100",
      ].join(" ")}
      style={{ backgroundImage: `url("${assets.homeBg}")` }}
    >
      {/* Atmospheric radial-gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(51,199,240,0.14), transparent 60%)," +
            "radial-gradient(ellipse 60% 50% at 20% 70%, rgba(156,113,255,0.10), transparent 55%)," +
            "radial-gradient(ellipse 60% 50% at 80% 80%, rgba(255,159,202,0.10), transparent 55%)",
        }}
        aria-hidden="true"
      />

      {/* ── Star counter + hamburger menu (top-right, always visible).
          z-50: por encima de TODO el mapa (los badges de costo de las islas
          usan z-10 y pisaban el menú desplegado cuando compartían z-30). ── */}
      <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <StarCounter />
          <button
            type="button"
            className="glass w-11 h-11 grid place-items-center rounded-full border-0 cursor-pointer text-text shadow-md transition-transform hover:scale-105 active:scale-95"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={25} /> : <Menu size={27} />}
          </button>
        </div>

        {menuOpen && (
          <div
            className="glass-surface grid gap-1 p-3 rounded-2xl animate-menu-reveal min-w-[12rem]"
            aria-label="Menú de estudiante"
          >
            <button
              type="button"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-text font-semibold text-sm cursor-pointer bg-transparent border-0 hover:bg-white/40 transition-colors text-left w-full"
              onClick={() => navigate("/misiones")}
            >
              <Flag size={19} />
              <span>Misiones</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-text font-semibold text-sm cursor-pointer bg-transparent border-0 hover:bg-white/40 transition-colors text-left w-full"
              onClick={() => navigate("/logros")}
            >
              <Medal size={19} />
              <span>Logros</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-text font-semibold text-sm cursor-pointer bg-transparent border-0 hover:bg-white/40 transition-colors text-left w-full"
              onClick={() => navigate("/mi-cuenta")}
            >
              <UserRound size={19} />
              <span>Mi cuenta</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-text font-semibold text-sm cursor-pointer bg-transparent border-0 hover:bg-white/40 transition-colors text-left w-full"
              onClick={() => navigate("/logros")}
            >
              <Star size={19} />
              <span>{totalStars} estrellas</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-text font-semibold text-sm cursor-pointer bg-transparent border-0 hover:bg-white/40 transition-colors text-left w-full"
              onClick={leave}
            >
              <LogOut size={19} />
              <span>Salir</span>
            </button>
          </div>
        )}

      </div>

      {/* ── Horizontally scrollable world journey ── */}
      <section
        className="world-scroll relative w-full h-dvh overflow-x-auto overflow-y-hidden scroll-smooth"
        aria-label="Selección de mundos"
        ref={sceneRef}
      >
        <div
          ref={trackRef}
          className="relative h-full"
          style={{ width: `${trackWidthVw}vw` }}
        >
          {/* Magical trail SVG */}
          <svg
            className="absolute top-0 left-0 pointer-events-none h-full"
            viewBox={`0 0 ${trackWidthVw} 100`}
            aria-hidden="true"
            preserveAspectRatio="none"
            style={{ width: `${trackWidthVw}vw` }}
          >
            <defs>
              {/* El gradiente de la ruta CICLA los colores de marca (igual que
                  el texto de bienvenida del login) vía SMIL — ver §5 paleta. */}
              <linearGradient id="world-route-gradient" x1="0%" y1="35%" x2="100%" y2="40%">
                <stop offset="0%" stopOpacity="0.55">
                  <animate
                    attributeName="stop-color"
                    values="#54e8c6;#25c8df;#536bff;#9b7cff;#ff9fca;#54e8c6"
                    dur="8s"
                    repeatCount="indefinite"
                  />
                </stop>
                <stop offset="50%" stopOpacity="0.95">
                  <animate
                    attributeName="stop-color"
                    values="#536bff;#9b7cff;#ff9fca;#54e8c6;#25c8df;#536bff"
                    dur="8s"
                    repeatCount="indefinite"
                  />
                </stop>
                <stop offset="100%" stopOpacity="0.55">
                  <animate
                    attributeName="stop-color"
                    values="#ff9fca;#54e8c6;#25c8df;#536bff;#9b7cff;#ff9fca"
                    dur="8s"
                    repeatCount="indefinite"
                  />
                </stop>
              </linearGradient>
              <filter id="world-route-glow" x="-18%" y="-32%" width="136%" height="164%">
                {/* stdDeviation 1.25 → 0.8: a tighter blur is dramatically
                    cheaper to re-rasterize on every `routeShimmer` tick, and
                    the glow stays visible because the gradient itself is
                    pastel. */}
                <feGaussianBlur stdDeviation="0.8" result="blur" />
                {/* Soft white-cyan glow (no violet tint). */}
                <feColorMatrix
                  in="blur" result="tint" type="matrix"
                  values="0 0 0 0 0.80  0 0 0 0 0.92  0 0 0 0 1  0 0 0 0.8 0"
                />
                <feMerge>
                  <feMergeNode in="tint" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Shared route geometry — measured by the travelling stars so
                they ride exactly along the trail (see rAF effect above). */}
            <path ref={routePathRef} id="world-route-path" d={ROUTE_D} fill="none" stroke="none" />
            {/* Soft violet glow behind the line */}
            <path
              d={ROUTE_D}
              fill="none"
              stroke="url(#world-route-gradient)"
              strokeWidth="2.6"
              strokeLinecap="round"
              opacity="0.5"
              filter="url(#world-route-glow)"
            />
            {/* One clean, solid line — no dots, no dashes */}
            <path
              d={ROUTE_D}
              fill="none"
              stroke="url(#world-route-gradient)"
              strokeWidth="0.9"
              strokeLinecap="round"
            />
          </svg>

          {/* Sparkles between islands */}
          {routeSparkles.map((spark, idx) => (
            <span
              key={idx}
              className="absolute w-2.5 h-2.5 rounded-full animate-spark-twinkle pointer-events-none"
              style={{
                left: `${spark.x}vw`,
                top: `${spark.y}%`,
                animationDelay: `${spark.delay}s`,
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.95), rgba(191,234,255,0.5) 60%, transparent 80%)",
                boxShadow: "0 0 6px 2px rgba(191,234,255,0.5)",
              }}
              aria-hidden="true"
            />
          ))}

          {/* Real stars gliding slowly along the trail (positioned each frame
              by the rAF effect via the path ref). */}
          {[0, 1].map((i) => (
            <span
              key={`travel-star-${i}`}
              ref={(el) => {
                starRefs.current[i] = el;
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[5] animate-spark-twinkle"
              style={{ left: 0, top: 0, filter: "drop-shadow(0 0 5px rgba(255,255,255,0.95))" }}
              aria-hidden="true"
            >
              <Star size={18} className="text-amber-200" fill="currentColor" strokeWidth={1} />
            </span>
          ))}

          {/* Island buttons */}
          {visibleWorlds.map((world, wIdx) => {
            const BadgeIcon = worldBadges[world.slug];
            const state = worldStates[world.slug];
            const isLocked = state === "locked";
            const isCompleted = state === "completed";
            const isCurrent = state === "current";
            const starInfo = worldStarProgress(world.id, progress);
            /* Unlock price for this island (cumulative ★ of all prior worlds):
               0 for the first island, 21 for the 2nd, 42 for the 3rd, … */
            const cost = starRequirements[world.id] ?? 0;
            const ctaLabel = isCompleted
              ? "Volver a jugar"
              : isCurrent
                ? "Seguir jugando"
                : "Jugar";
            const theme = islandTheme[world.slug];

            return (
              <div
                key={world.id}
                className="absolute"
                style={{ left: `${world.map.x}vw`, top: `${world.map.y}%` }}
              >
                <button
                  type="button"
                  ref={(el) => {
                    islandRefs.current[wIdx] = el;
                  }}
                  className={[
                    /* Base island styles. Size scales with the viewport so the
                       islands grow on bigger screens. `min(20vw, 34vh)` keeps the
                       proportional 20vw look while the 34vh term caps the square's
                       HEIGHT below the 36%-of-viewport gap between the two island
                       rows — so they never overlap vertically on wide-but-short
                       screens (where a flat `20vw` would collide). */
                    "relative w-[min(24vw,38vh)] max-w-[22rem] aspect-square rounded-full border-0 p-0",
                    "cursor-pointer transition-all duration-300 ease-out",
                    "hover:scale-105 hover:-translate-y-1",
                    "active:scale-95",
                    "overflow-visible",
                    /* State: locked — bien apagada para que se lea "bloqueada"
                       de un vistazo (más gris + más tenue que antes). */
                    isLocked
                      ? "grayscale saturate-0 opacity-50 brightness-90 cursor-not-allowed hover:scale-100 hover:translate-y-0"
                      : "",
                    /* State: just unlocked → reveal animation */
                    justUnlocked.has(world.slug) ? "animate-unlock-reveal" : "",
                    /* State: selected → shrink + fade for transition */
                    selectedWorld === world.id
                      ? "scale-110 opacity-90"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleIslandClick(world)}
                  onPointerEnter={() => !isLocked && prefetchWorld(world)}
                  onFocus={() => !isLocked && prefetchWorld(world)}
                  aria-label={`${worldLabels[world.slug]}${
                    isLocked
                      ? ` (bloqueado, necesitás ${cost} estrellas)`
                      : isCompleted
                        ? " (completado)"
                        : ""
                  }`}
                  aria-disabled={isLocked}
                >
                  {/* Island art — transparent PNG shown at its natural shape
                      (object-contain, NOT cropped into a circle). */}
                  <img
                    src={world.thumbnail}
                    alt=""
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-contain drop-shadow-[0_10px_18px_rgba(40,70,120,0.28)]"
                  />

                  {/* Number + theme badge only on reachable islands. Locked
                      islands show just a padlock centred on the island. */}
                  {!isLocked && (
                    <span
                      className={[
                        "absolute -top-2 left-1/2 -translate-x-1/2",
                        "flex items-center gap-1 px-2.5 py-1 rounded-full",
                        "bg-gradient-to-br text-white font-display font-bold text-xs",
                        "shadow-md pointer-events-none whitespace-nowrap",
                        `bg-gradient-to-br ${theme.badge}`,
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      <span>M{world.displayNumber}</span>
                      <BadgeIcon size={14} strokeWidth={2.1} />
                    </span>
                  )}

                  {/* Star chip — not shown on locked islands. */}
                  {!isLocked && (
                    <span
                      className={[
                        "absolute -bottom-3.5 left-1/2 -translate-x-1/2",
                        "flex items-center gap-1.5 pl-2 pr-3 py-1 rounded-full",
                        "text-sm font-black whitespace-nowrap pointer-events-none",
                        "shadow-md border border-white/60",
                        isCompleted
                          ? "bg-gradient-to-r from-emerald-400 to-teal-400 text-white"
                          : "glass-strong text-text",
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      <Star
                        size={17}
                        strokeWidth={1.5}
                        className={`${isCompleted ? "text-white" : "text-amber-400"} drop-shadow-[0_1px_3px_rgba(250,204,21,0.7)]`}
                        fill="currentColor"
                      />
                      {starInfo.earnedStars}/{starInfo.totalStars}
                    </span>
                  )}

                  {/* Completion tick — decorative, aria-label already
                      announces "completado". */}
                  {isCompleted && (
                    <span
                      className="absolute top-1 right-1 w-7 h-7 rounded-full bg-emerald-500 text-white grid place-items-center shadow-md animate-tick-pop"
                      aria-hidden="true"
                    >
                      <Check size={18} strokeWidth={3.4} />
                    </span>
                  )}


                  {/* Celebratory sparkle burst when this island is unlocked. */}
                  {justUnlocked.has(world.slug) && (
                    <span
                      className="absolute inset-0 pointer-events-none"
                      aria-hidden="true"
                    >
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <i
                          key={i}
                          className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full animate-unlock-burst"
                          style={{
                            background: ["#c9b8ff", "#bff3ff", "#ffd9f1", "#fff8ff", "#ffe4b8", "#b8ffe4"][i],
                            animationDelay: `${i * 0.08}s`,
                            transform: `rotate(${i * 60}deg) translateY(-3rem)`,
                          }}
                        />
                      ))}
                    </span>
                  )}
                </button>
                {/* Precio de desbloqueo (en estrellas) — se muestra en TODAS las
                    islas con costo (la 1ª es gratis). Va FUERA del <button> para
                    que el filtro de gris de las bloqueadas nunca lo apague.
                    Bloqueada → centrado y grande con candado; ya abierta →
                    etiqueta chica arriba a la izquierda. */}
                {cost > 0 && (
                  <span
                    className={[
                      "absolute z-10 flex items-center gap-1 rounded-full glass-strong",
                      "border border-white/70 shadow-md font-black whitespace-nowrap pointer-events-none",
                      isLocked
                        ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 text-base"
                        : "left-1 top-1 px-2 py-0.5 text-xs",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {isLocked && <Lock size={15} strokeWidth={2.6} className="text-slate-600" />}
                    <Star
                      size={isLocked ? 16 : 13}
                      strokeWidth={1.5}
                      className="text-amber-400 drop-shadow-[0_1px_3px_rgba(250,204,21,0.7)]"
                      fill="currentColor"
                    />
                    <span className="text-text">{cost}</span>
                  </span>
                )}

                {/* Kept for visual continuity with prior layout — also gives
                    a label that screen-readers can announce. */}
                <span className="sr-only">{ctaLabel}: {worldLabels[world.slug]}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── World-enter transition overlay ── */}
      <div
        className={[
          "fixed inset-0 z-40 pointer-events-none transition-all duration-500",
          selectedWorld
            ? "bg-white/90 opacity-100 backdrop-blur-sm"
            : "bg-white/0 opacity-0",
        ].join(" ")}
      />

      {/* The mascot float lives on the wrapper (animate-mascot-float).
          The <img> carries no filter so the rasterizer is not forced to
          re-blur the alpha channel of a 14–24rem tall PNG on every frame. */}
      <span className="absolute bottom-0 left-0 animate-mascot-float pointer-events-none select-none z-10">
        <CharacterSkin
          kind="female"
          className="w-auto max-h-[33vh] drop-shadow-lg"
          alt=""
          loading="lazy"
        />
      </span>
      <div className="absolute bottom-0 right-0 flex flex-col items-end pointer-events-none select-none z-10">
        <span
          className="glass-strong px-4 py-2 rounded-2xl rounded-br-sm text-text font-display font-bold text-[clamp(1.05rem,1.9vmin,1.5rem)] mb-2 animate-bubble-pop shadow-md"
        >
          ¡Vamos!
        </span>
        <span className="animate-mascot-float">
          <CharacterSkin
            kind="male"
            className="w-auto max-h-[33vh] drop-shadow-lg"
            alt=""
            loading="lazy"
          />
        </span>
      </div>

      <Toast message={message} />

      {/* Barra ÉPICA de progreso al próximo personaje — protagonista
          abajo-centro, entre los robots de las esquinas. */}
      <SkinProgressBar />

      {/* Celebración al desbloquear una fase de personaje nueva (por estrellas). */}
      <SkinUnlockCelebration />
    </main>
  );
}
