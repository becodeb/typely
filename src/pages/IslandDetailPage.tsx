import { ArrowLeft, ArrowRight, Lock, MapPin, RotateCcw, Star } from "lucide-react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { StarCounter } from "../components/common/StarCounter";
import { CharacterSkin } from "../components/common/CharacterSkin";
import { SkinUnlockCelebration } from "../components/common/SkinUnlockCelebration";
import { SkinProgressBar } from "../components/common/SkinProgressBar";
import { AvisoSoloEnComputadora } from "../components/common/SoloEnComputadora";
import { useEsCelular } from "../hooks/useEsCelular";
import { LevelStars } from "../components/common/LevelStars";
import { getWorldBySlug, getWorlds, worldStarProgress, WORLD_PEDAGOGY_ORDER, type Level, type LevelPosition } from "../data/worlds";
import { LevelPositionEditor, type PerspField, type PerspMode } from "../components/dev/LevelPositionEditor";
import { assets, islandArt, levelButtonFor, levelNumberDoneColor } from "../utils/assets";

/* The dev level-position editor is available in local dev builds, OR when a
   superadmin entered "modo desarrollador" from the god-mode chooser (which
   sets the `typely_dev_editor` flag). Never available to normal users. */
/* The editor is ONLY available in superadmin "Modo desarrollador" (which sets
   the typely_dev_editor flag via setViewAsStored). It is NOT shown in local dev
   for the demo student, nor to any normal user. Checked dynamically because the
   flag is set after this module first loads. */
function editorAvailable(): boolean {
  return typeof window !== "undefined" && localStorage.getItem("typely_dev_editor") === "1";
}
const clampPct = (v: number) => Math.min(100, Math.max(0, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

const PERSPECTIVE_BASE = { scale: 1.4, rotateX: 54.5, rotateY: -1.5, rotateZ: 2, perspective: 110 } as const;



/* ---- Status-pill colour map (state → Tailwind classes) ---- */
const STATUS_PILL_CLASSES: Record<string, string> = {
  actual: "bg-accent-sky text-white",
  completado: "bg-mint text-white",
  bloqueado: "bg-rose/80 text-white",
};

export function IslandDetailPage() {
  const { islandId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState("");
  const maybeWorld = useMemo(() => getWorldBySlug(islandId), [islandId, location.key]);
  const allWorlds = useMemo(() => getWorlds(), [location.key]);
  const initialIndex = useMemo(() => {
    if (!maybeWorld) return 0;
    const currentIdx = maybeWorld.levels.findIndex((level) => level.state === "Actual");
    if (currentIdx >= 0) return currentIdx;
    const lastCompleted = [...maybeWorld.levels].reverse().findIndex((l) => l.state === "Completado");
    if (lastCompleted >= 0) return maybeWorld.levels.length - 1 - lastCompleted;
    return 0;
  }, [maybeWorld]);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  /* Gate the entrance animation on the actual background image being
     decoded. Until it's ready we still render the whole page (so React
     can lay out level nodes etc.) but we keep the bg + animations hidden
     under a soft sky-coloured layer. Once the image fires onLoad we flip
     the flag and CSS transitions everything to its final state in one
     smooth fade — no more top-to-bottom paint of the JPEG/WebP. */
  const [bgReady, setBgReady] = useState(false);
  /* The level info popover is closed by default (least intrusive) and opens
     only when a level is tapped; tapping outside closes it again. */
  const [popoverOpen, setPopoverOpen] = useState(false);
  /* Collision-aware popover: after it renders we measure it and nudge it (in
     px) so it never spills off the viewport and never overlaps the fixed top
     header. The base side/vertical anchoring still decides the initial open
     direction; this just clamps it into the safe on-screen band. */
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverNudge, setPopoverNudge] = useState({ dx: 0, dy: 0 });

  /* ---- Dev-only level position editor state ---- */
  const mapRef = useRef<HTMLElement>(null);
  const [editorOn, setEditorOn] = useState(
    () => editorAvailable() && new URLSearchParams(window.location.search).has("editor"),
  );
  const [gridOn, setGridOn] = useState(true);
  const [editorPositions, setEditorPositions] = useState<LevelPosition[]>([]);
  const [dragIndex, setDragIndex] = useState(-1);
  /* Mirror of the active drag index in a ref so pointermove never reads a
     stale closure value between the pointerdown and the next render. */
  const dragIndexRef = useRef(-1);
  const [cursor, setCursor] = useState<LevelPosition | null>(null);
  const [lastClick, setLastClick] = useState<LevelPosition | null>(null);
  /* Which node is selected for perspective editing (keyboard + sliders). */
  const [editorSelectedIndex, setEditorSelectedIndex] = useState(-1);
  /* Hover state for the pressed button image (disabled during editor). */
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  /* Perspective adjustment mode: null = position, otherwise the active 3D property. */
  const [perspMode, setPerspMode] = useState<PerspMode>(null);
  const [numScale, setNumScale] = useState(1);
  /* Muestra el nodo seleccionado en su estado APRETADO. Con esto prendido,
     los modos del número (N y M) y sus sliders escriben numXHover/numYHover
     en vez de numX/numY: es la única forma de acomodar el número del estado
     apretado, porque para verlo habría que tener el mouse encima y entonces
     no se puede usar el teclado. */
  const [previewPressed, setPreviewPressed] = useState(false);

  /* ---- Lupa del editor: zoom + desplazamiento ----------------------
     Es SÓLO una lente. Va como transform CSS sobre el escenario entero,
     así que no toca ni un dato: los % siguen siendo los mismos y
     pctFromClient sigue andando solo, porque getBoundingClientRect ya
     devuelve el rectángulo transformado.

     z = aumento, x/y = corrimiento en px de pantalla. El transform se
     aplica como translate(x,y) scale(z) con origen en el centro. */
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const stageWrapRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ sx: number; sy: number; bx: number; by: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const ZOOM_MIN = 1, ZOOM_MAX = 8;
  /* Con qué acercamiento queda la isla en el celular después de la animación
     de apertura. A 2.2 los nodos vuelven a su proporción correcta (5.34 % del
     escenario) en vez del 11.7 % al que los infla el piso táctil de 44 px. */
  const ZOOM_CELULAR = 2.2;

  /** Aplica un zoom nuevo dejando quieto el punto (sx, sy) de la pantalla.
   *  Sin esto el zoom siempre tira al centro y perdés de vista el nodo que
   *  estabas ajustando. */
  const zoomAt = useCallback((nextZ: number | ((prev: number) => number), sx?: number, sy?: number) => {
    setView((v) => {
      const pedido = typeof nextZ === "function" ? nextZ(v.z) : nextZ;
      const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pedido));
      const el = stageWrapRef.current;
      if (!el || z === v.z) return { ...v, z };
      const r = el.getBoundingClientRect();
      const cxp = r.left + r.width / 2, cyp = r.top + r.height / 2;
      /* Sin punto de anclaje (botones del panel, teclado) se usa el centro. */
      const dx = (sx ?? cxp) - cxp, dy = (sy ?? cyp) - cyp;
      const k = z / v.z;
      let x = dx - (dx - v.x) * k;
      let y = dy - (dy - v.y) * k;
      /* Tope de arrastre: el escenario nunca se puede sacar de pantalla. */
      const mx = ((z - 1) * r.width) / 2, my = ((z - 1) * r.height) / 2;
      x = Math.min(mx, Math.max(-mx, x));
      y = Math.min(my, Math.max(-my, y));
      return z === 1 ? { z: 1, x: 0, y: 0 } : { z, x, y };
    });
  }, []);

  const resetView = useCallback(() => setView({ z: 1, x: 0, y: 0 }), []);

  /* ── Celular: el escenario se recorre con el dedo ────────────────────────
     La isla entera no entra en un teléfono — a 375×812 el `contain` la deja
     en una fajita de 211 px de alto y los nodos, que tienen un piso táctil de
     44 px, se encavallan. La salida es la misma lente que usa el editor, con
     zoom y arrastre. Las coordenadas NO cambian: se mueve la ventana, no el
     sistema de referencia (CLAUDE.md §6.2). */
  const celular = useEsCelular();
  const stageRef = useRef<HTMLDivElement>(null);
  /* Mientras dura la animación de apertura la lente lleva transición; después
     se apaga para que arrastrar responda al toque sin retardo. */
  const [animandoEntrada, setAnimandoEntrada] = useState(false);
  /* Sin zoom no hay nada que arrastrar, y capturar el puntero de gratis
     rompería el toque sobre los nodos. */
  const celularPaneo = celular && view.z > 1;
  const entradaHecha = useRef(false);

  /** Lleva un punto del escenario, en % del arte, al centro de la pantalla. */
  const centrarEn = useCallback((xPct: number, yPct: number, z: number) => {
    const wrap = stageWrapRef.current, stage = stageRef.current;
    if (!wrap || !stage) return;
    const rw = wrap.getBoundingClientRect(), rs = stage.getBoundingClientRect();
    /* rs ya viene con el zoom actual aplicado; se divide para volver a la
       medida sin escalar y no arrastrar el zoom anterior en la cuenta. */
    const sw = rs.width / view.z, sh = rs.height / view.z;
    const dx = (xPct / 100 - 0.5) * sw, dy = (yPct / 100 - 0.5) * sh;
    const mx = ((z - 1) * rw.width) / 2, my = ((z - 1) * rw.height) / 2;
    setView({
      z,
      x: Math.min(mx, Math.max(-mx, -z * dx)),
      y: Math.min(my, Math.max(-my, -z * dy)),
    });
  }, [view.z]);

  /* Pellizco para acercar y alejar. El arrastre de un dedo lo resuelve el
     mismo efecto de paneo del editor, habilitado abajo para el celular. */
  useEffect(() => {
    if (!celular) return;
    const el = stageWrapRef.current;
    if (!el) return;
    let base: { dist: number; z: number } | null = null;
    const separacion = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const alTocar = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      base = { dist: separacion(e.touches), z: view.z };
    };
    const alMover = (e: TouchEvent) => {
      if (!base || e.touches.length !== 2) return;
      e.preventDefault();
      const centroX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centroY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      zoomAt(base.z * (separacion(e.touches) / base.dist), centroX, centroY);
    };
    const alSoltar = (e: TouchEvent) => { if (e.touches.length < 2) base = null; };

    el.addEventListener("touchstart", alTocar, { passive: true });
    el.addEventListener("touchmove", alMover, { passive: false });
    el.addEventListener("touchend", alSoltar, { passive: true });
    return () => {
      el.removeEventListener("touchstart", alTocar);
      el.removeEventListener("touchmove", alMover);
      el.removeEventListener("touchend", alSoltar);
    };
  }, [celular, view.z, zoomAt]);

  /** ¿El evento salió del panel del editor? Chequea que sea un Element antes
   *  de preguntar por closest: el target de un evento no siempre lo es. */
  const enHud = (t: EventTarget | null) => t instanceof Element && !!t.closest("[data-hud]");

  /* Rueda = zoom sobre el cursor. Va como listener nativo y no como onWheel
     de React: React los registra pasivos y un listener pasivo no puede
     preventDefault, así que la página se movería debajo del zoom. */
  useEffect(() => {
    if (!editorOn) return;
    const el = stageWrapRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (enHud(e.target)) return;
      e.preventDefault();
      const paso = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomAt((z) => z * paso, e.clientX, e.clientY);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [editorOn, zoomAt]);

  /* Desplazamiento: botón del medio, o barra espaciadora + arrastre. Los dos
     porque no todos los trackpads de Chromebook tienen botón del medio. */
  useEffect(() => {
    /* Dos usos del mismo arrastre: el editor con barra espaciadora o botón del
       medio, y el CELULAR con un dedo, donde no hay ni teclado ni botón. */
    if (!editorOn && !celularPaneo) return;
    function onDown(e: PointerEvent) {
      if (enHud(e.target)) return;
      /* En el celular no se arrastra desde un nodo: ahí el toque tiene que
         abrir la ficha del nivel, no mover el mapa. */
      if (celularPaneo) {
        if (e.target instanceof Element && e.target.closest("[data-level-node]")) return;
      } else if (e.button !== 1 && !spaceHeld) {
        return;
      }
      e.preventDefault();
      panRef.current = { sx: e.clientX, sy: e.clientY, bx: view.x, by: view.y };
    }
    function onMove(e: PointerEvent) {
      const p = panRef.current;
      if (!p) return;
      const el = stageWrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const mx = ((view.z - 1) * r.width) / 2, my = ((view.z - 1) * r.height) / 2;
      setView((v) => ({
        ...v,
        x: Math.min(mx, Math.max(-mx, p.bx + (e.clientX - p.sx))),
        y: Math.min(my, Math.max(-my, p.by + (e.clientY - p.sy))),
      }));
    }
    function onUp() { panRef.current = null; }
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [editorOn, spaceHeld, celularPaneo, view.x, view.y, view.z]);

  /* La barra espaciadora arma el modo arrastre mientras se la tiene apretada.
     Con preventDefault porque los nodos son <button>: sin eso, la barra
     dispara el que tenga el foco. */
  useEffect(() => {
    if (!editorOn) return;
    function down(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      setSpaceHeld(true);
    }
    function up(e: KeyboardEvent) {
      if (e.code === "Space") { setSpaceHeld(false); panRef.current = null; }
    }
    /* Si el foco se va de la ventana con la barra apretada, el keyup nunca
       llega y el modo queda pegado. */
    function blur() { setSpaceHeld(false); panRef.current = null; }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [editorOn]);

  useEffect(() => {
    setSelectedIndex(initialIndex);
  }, [initialIndex]);

  /* Tamaño natural del arte de fondo. Sólo se usa para sacarle la relación
     de aspecto y pasársela al escenario por --art-ar (ver más abajo); la
     caja en sí la arma el CSS. */
  const [bgImgSize, setBgImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!maybeWorld) return;
    setBgReady(false);
    setBgImgSize(null);
    const bgSrc = islandArt(maybeWorld.slug).sky;
    const img = new Image();
    img.decoding = "async";
    const done = () => {
      if (img.naturalWidth > 0) setBgImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setBgReady(true);
    };
    img.onload = done;
    img.onerror = () => setBgReady(true);
    img.src = bgSrc;
    if (img.complete && img.naturalWidth > 0) done();
  }, [maybeWorld]);

  // Seed the editor draft from the saved config whenever the island changes.
  useEffect(() => {
    if (!maybeWorld) return;
    setEditorPositions(maybeWorld.levelPositions.map((p) => ({ ...p })));
  }, [maybeWorld?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close the level popover when tapping anywhere that isn't a level node.
  useEffect(() => {
    if (!popoverOpen) return;
    function onDocPointerDown(event: PointerEvent) {
      const el = event.target as HTMLElement | null;
      if (el && (el.closest("[data-level-node]") || el.closest("[data-level-popover]"))) return;
      setPopoverOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [popoverOpen]);

  if (!maybeWorld) {
    return <Navigate to="/mundos" replace />;
  }

  const world = maybeWorld;

  /* ---- Escenario de isla ------------------------------------------------
     El arte entra ENTERO (contain) en una caja con su misma relación de
     aspecto, y los nodos de nivel viven dentro de esa caja posicionados en %
     de ella. La caja la arma el CSS (.island-stage, en global.css): acá sólo
     calculamos la relación de aspecto del arte y se la pasamos por --art-ar.

     Antes esto era computeIslandContainer(): medía el viewport, calculaba el
     rect COVER de la imagen en píxeles y lo reescribía en cada `resize`. Eso
     tenía dos problemas. Uno, cover RECORTA: en un teléfono se veía el 25 %
     de la imagen y 4 de 7 nodos quedaban enteramente fuera de pantalla. Dos,
     todo dependía de que el listener de resize corriera — si no corría, los
     nodos quedaban pegados a un rect viejo. Con contain nada se puede
     recortar, y sin JS no hay nada que se pueda desincronizar. ---------- */
  /* Las dos capas del arte. Mientras la isla no esté separada, `island` es
     null y el cielo ES la escena entera — ver islandArt() en assets.ts. */
  const { sky: islandBgPath, island: islandImgPath, cover: stageCover } = islandArt(world.slug);
  const [islandImgSize, setIslandImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!islandImgPath) { setIslandImgSize(null); return; }
    const img = new Image();
    img.onload = () => { if (img.naturalWidth > 0) setIslandImgSize({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => setIslandImgSize(null);
    img.src = islandImgPath;
  }, [islandImgPath]);

  /* El arte que manda es el PNG suelto de la isla si existe (island1, 4:3),
     y el fondo con las plataformas pintadas en el resto (16:9). Mientras no
     se haya medido usamos 16:9, que es lo que sirve para 14 de las 15 islas
     — y de todos modos el escenario está en opacity-0 hasta que carga. */
  const artSize = islandImgPath ? islandImgSize : bgImgSize;
  const artAspect = artSize ? artSize.w / artSize.h : 1672 / 941;
  /* La imagen nítida del escenario, y la que rellena las bandas del contain. */
  const artSrc = islandImgPath ?? islandBgPath;
  /* island1 ya tiene cielo propio (assets.homeBg) → va nítido detrás. En el
     resto el "fondo" ES el arte, así que se reusa ampliado y desenfocado
     para llenar las bandas sin inventar un color plano. */
  const backdropIsArt = !islandImgPath;

  /* Sólo el popover necesita enterarse de un resize (para recalcular su
     colisión con los bordes). Antes venía gratis porque islandContainer
     cambiaba en cada resize; ahora el escenario es CSS puro, así que el
     listener queda acotado a mientras el popover está abierto. */
  const [viewportTick, setViewportTick] = useState(0);
  useEffect(() => {
    if (!popoverOpen) return;
    const onResize = () => setViewportTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [popoverOpen]);

  const actualIndex = world.levels.findIndex((level) => level.state === "Actual");
  const currentIndex = actualIndex >= 0 ? actualIndex : initialIndex;
  const worldNumber = world.displayNumber;
  const safeIndex = Math.min(selectedIndex, world.levels.length - 1);
  const selectedLevel = world.levels[safeIndex];
  /* While the dev editor is on, markers + ship follow the live draft so the
     person placing them sees exactly where they'll land. Otherwise the saved
     config (world.levelPositions) drives everything, unchanged. */
  const activePositions =
    editorOn && editorPositions.length === world.levelPositions.length
      ? editorPositions
      : world.levelPositions;
  const currentPosition = activePositions[currentIndex] ?? activePositions[0];

  /* LA ANIMACIÓN DE APERTURA ES EL TUTORIAL. La isla abre entera y sin zoom, y
     recién CUANDO EL ARTE TERMINÓ DE CARGAR se acerca despacio hasta la nave,
     que está parada en el nivel actual. De ese solo movimiento salen dos
     cosas: el chico llega mirando lo que le toca jugar, y acaba de VER el mapa
     acercarse, así que sabe que es algo que puede hacer él. Dispararla antes
     de que cargue el arte la desperdicia — no habría nada que mirar acercarse. */
  const arteListo = bgReady && (!islandImgPath || !!islandImgSize);
  useEffect(() => {
    if (!celular || !arteListo || entradaHecha.current || editorOn) return;
    entradaHecha.current = true;
    const arranque = window.setTimeout(() => {
      setAnimandoEntrada(true);
      centrarEn(currentPosition.x, currentPosition.y, ZOOM_CELULAR);
    }, 450);
    const fin = window.setTimeout(() => setAnimandoEntrada(false), 450 + 1900);
    return () => { window.clearTimeout(arranque); window.clearTimeout(fin); };
  }, [celular, arteListo, editorOn, centrarEn, currentPosition.x, currentPosition.y]);

  /* The ship is the game's main character (always front-facing, never a
     directional indicator). Its art "evolves" with the cumulative star total,
     same as the mascots — rendered via <CharacterSkin kind="ship" /> below. */
  /* Star progress toward unlocking the next world (70% gate). */
  const starProgress = worldStarProgress(world.slug);
  const isLastWorld = worldNumber >= WORLD_PEDAGOGY_ORDER.length;

  /* "Siguiente" CTA (moved here from the world map). It appears only when the
     student has fully finished this world: every level completed AND ≥70% of
     its stars earned AND a next world exists to go to. */
  const currentWorldIdx = allWorlds.findIndex((w) => w.slug === world.slug);
  const nextWorld = currentWorldIdx >= 0 ? allWorlds[currentWorldIdx + 1] : undefined;
  const allLevelsDone = world.levels.every((level) => level.state === "Completado");
  const canGoToNextWorld = allLevelsDone && starProgress.isUnlockedNext && Boolean(nextWorld);

  /* Compact selected-level popover, anchored BESIDE the selected node. The
     level paths wind mostly vertically, so opening to the side (rather than
     above/below) keeps the popover off the neighbouring nodes. It opens to
     the right for left-half nodes and to the left for right-half nodes, and
     clamps vertically so it never spills off the top/bottom edge. */
  const selectedPos = activePositions[safeIndex] ?? activePositions[0];
  const popoverRight = selectedPos.x <= 50;
  const popoverVBand: "top" | "center" | "bottom" =
    selectedPos.y < 24 ? "top" : selectedPos.y > 76 ? "bottom" : "center";
  const popoverGap = "2.6rem";
  const popoverTx = popoverRight ? popoverGap : `calc(-100% - ${popoverGap})`;
  const popoverTy =
    popoverVBand === "top" ? "-0.6rem" : popoverVBand === "bottom" ? "calc(-100% + 0.6rem)" : "-50%";
  const popoverState = selectedLevel.state.toLowerCase();

  /* Keep the open popover fully inside the viewport AND below the fixed top
     header. We measure the rendered popover and translate it by a few px when
     it would spill off an edge: a node low on the screen flips its card up, a
     high node flips it down, and a card near the header is pushed under it. On
     a fresh open / selection change the nudge resets to zero first, then this
     effect re-runs to clamp the clean position (converges in 1–2 frames). */
  const lastPopoverKey = useRef("");
  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!popoverOpen || !el) {
      if (popoverNudge.dx !== 0 || popoverNudge.dy !== 0) setPopoverNudge({ dx: 0, dy: 0 });
      lastPopoverKey.current = "";
      return;
    }
    const key = String(safeIndex);
    if (lastPopoverKey.current !== key) {
      lastPopoverKey.current = key;
      if (popoverNudge.dx !== 0 || popoverNudge.dy !== 0) {
        setPopoverNudge({ dx: 0, dy: 0 });
        return; // re-runs with a clean slate before measuring
      }
    }
    /* Reconstruct the FULL-SIZE box from the rect centre + layout size. The
       inner pop-in animation scales the panel around its centre, so the rect's
       centre is stable while offsetWidth/Height stay at the un-transformed
       layout size — this makes the clamp accurate even mid-animation. */
    const rect = el.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.top + rect.bottom) / 2;
    const left = cx - w / 2;
    const right = cx + w / 2;
    const top = cy - h / 2;
    const bottom = cy + h / 2;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 14;
    const topSafe = 96; // clear the fixed island header at the top
    let dx = 0;
    let dy = 0;
    if (w < vw - margin * 2) {
      if (left < margin) dx = margin - left;
      else if (right > vw - margin) dx = vw - margin - right;
    }
    if (h >= vh - margin - topSafe) {
      dy = topSafe - top; // taller than the safe band → pin under the header
    } else if (top < topSafe) {
      dy = topSafe - top;
    } else if (bottom > vh - margin) {
      dy = vh - margin - bottom;
    }
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      setPopoverNudge((prev) => ({ dx: prev.dx + dx, dy: prev.dy + dy }));
    }
  }, [popoverOpen, safeIndex, viewportTick, bgReady, popoverNudge.dx, popoverNudge.dy]);

  function selectLevel(index: number) {
    const level = world.levels[index];
    setSelectedIndex(index);
    setPopoverOpen(true);

    if (level.state === "Bloqueado") {
      setMessage("Completá el nivel anterior para desbloquearlo.");
    }
  }

  /* Enters a level by index. Locked levels are blocked unless `bypassLock`
     is set (used by the hidden rapid-click dev shortcut). */
  function enterLevel(index: number, bypassLock = false) {
    const level = world.levels[index];
    if (!level) return;
    if (level.state === "Bloqueado" && !bypassLock) {
      setMessage("Completá el nivel anterior para desbloquearlo.");
      return;
    }
    navigate(`/gameplay/${level.activityId}`);
  }

  /* Rapid-click tracker for the hidden dev shortcut: 5 quick clicks on the
     same level node enter it directly, even when locked. */
  const rapidClick = useRef<{ index: number; count: number; last: number }>({ index: -1, count: 0, last: 0 });
  const RAPID_WINDOW_MS = 450;
  const RAPID_CLICK_COUNT = 5;

  function handleNodeClick(index: number) {
    // In editor mode a click selects the node for perspective editing / keyboard nudging.
    if (editorOn) {
      setEditorSelectedIndex((prev) => (prev === index ? -1 : index));
      return;
    }
    const now = Date.now();
    const tracker = rapidClick.current;
    if (tracker.index === index && now - tracker.last <= RAPID_WINDOW_MS) {
      tracker.count += 1;
    } else {
      tracker.count = 1;
    }
    tracker.index = index;
    tracker.last = now;

    if (tracker.count >= RAPID_CLICK_COUNT) {
      tracker.count = 0;
      tracker.index = -1;
      enterLevel(index, true); // dev/test shortcut — bypasses the lock
      return;
    }

    selectLevel(index);
  }

  /* Double-click is a normal shortcut into the level (respects the lock). */
  function handleNodeDoubleClick(index: number) {
    if (editorOn) return;
    setSelectedIndex(index);
    enterLevel(index, false);
  }

  function openLevel() {
    enterLevel(safeIndex, false);
  }

  /* ---- Dev editor: convert a client point to map % (same box the markers
     are positioned against, so what you place is exactly what renders). ---- */
  function pctFromClient(clientX: number, clientY: number): LevelPosition | null {
    const el = mapRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return {
      x: round1(clampPct(((clientX - r.left) / r.width) * 100)),
      y: round1(clampPct(((clientY - r.top) / r.height) * 100)),
    };
  }
  function handleEditorCursor(clientX: number, clientY: number) {
    if (clientX < -9999) {
      setCursor(null);
      return;
    }
    setCursor(pctFromClient(clientX, clientY));
  }
  async function handleEditorCopyAt(clientX: number, clientY: number) {
    const p = pctFromClient(clientX, clientY);
    if (!p) return;
    setLastClick(p);
    logConfig("Click en mapa");
    try {
      await navigator.clipboard.writeText(`{ x: ${round1(p.x)}, y: ${round1(p.y)} }`);
      setMessage(`Copiado · x ${round1(p.x)} · y ${round1(p.y)}`);
    } catch {
      setMessage(`x ${round1(p.x)} · y ${round1(p.y)}`);
    }
  }
  function onNodePointerDown(event: ReactPointerEvent<HTMLButtonElement>, index: number) {
    if (!editorOn) return;
    event.preventDefault();
    dragIndexRef.current = index;
    setDragIndex(index);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore — capture is best-effort */
    }
  }
  function onNodePointerMove(event: ReactPointerEvent<HTMLButtonElement>, index: number) {
    if (!editorOn || dragIndexRef.current !== index) return;
    const p = pctFromClient(event.clientX, event.clientY);
    if (!p) return;
    setCursor(p);
    setEditorPositions((prev) => prev.map((pos, i) => (i === index ? { ...pos, x: p.x, y: p.y } : pos)));
  }
  function onNodePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragIndexRef.current < 0) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    dragIndexRef.current = -1;
    setDragIndex(-1);
  }
  function resetEditorPositions() {
    setEditorPositions(world.levelPositions.map((p) => ({ ...p })));
    setEditorSelectedIndex(-1);
    setPerspMode(null);
    setMessage("Posiciones restauradas a la configuración guardada.");
  }

  /** Adjust a 3D perspective property on the selected editor node. */
  const handleUpdatePerspective = useCallback(
    (index: number, field: PerspField, value: number) => {
      /* NaN es la señal de "borrá este campo": la usa el botón Centrar para
         limpiar la posición del número apretado, que no tiene un valor
         neutro — no estar definida ES el estado por defecto. */
      const limpio = Number.isFinite(value) ? value : undefined;
      setEditorPositions((prev) =>
        prev.map((pos, i) => (i === index ? { ...pos, [field]: limpio } : pos)),
      );
    },
    [],
  );

  /** Console-log the current full config so it can be hardcoded back into levelPositions.ts. */
  const logConfig = useCallback(
    (label: string) => {
      const r1 = (v: number) => Math.round(v * 10) / 10;
      const arr = activePositions.map((p) => {
        const parts: string[] = [];
        if (p.scale !== undefined && p.scale !== 1) parts.push(`scale: ${Math.round(p.scale * 100) / 100}`);
        if (p.rotateX !== undefined && p.rotateX !== 0) parts.push(`rotateX: ${r1(p.rotateX)}`);
        if (p.rotateY !== undefined && p.rotateY !== 0) parts.push(`rotateY: ${r1(p.rotateY)}`);
        if (p.rotateZ !== undefined && p.rotateZ !== 0) parts.push(`rotateZ: ${r1(p.rotateZ)}`);
        if (p.perspective !== undefined && p.perspective !== 500) parts.push(`perspective: ${r1(p.perspective)}`);
        if (p.numX !== undefined && p.numX !== 0) parts.push(`numX: ${r1(p.numX)}`);
        if (p.numY !== undefined && p.numY !== 0) parts.push(`numY: ${r1(p.numY)}`);
        if (p.numSize !== undefined && p.numSize !== 1) parts.push(`numSize: ${Math.round(p.numSize * 100) / 100}`);
        let s = `{ x: ${p.x}, y: ${p.y}`;
        if (parts.length) s += `, ${parts.join(", ")}`;
        return `  ${s} },`;
      });
      console.log(`\n// ${label} — ${world.slug} (${activePositions.length} niveles)\n[\n${arr.join("\n")}\n],\n`);
    },
    [activePositions, world.slug],
  );

  /* Keyboard shortcuts for the dev editor. */
  useEffect(() => {
    if (!editorOn) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      // Ctrl/Cmd+C: copy config to console + clipboard (always available)
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        e.preventDefault();
        logConfig("Copiado " + new Date().toLocaleTimeString());
        const r1 = (v: number) => Math.round(v * 10) / 10;
        const arr = activePositions.map((p) => {
          const parts: string[] = [];
          if (p.scale !== undefined && p.scale !== 1) parts.push(`scale: ${Math.round(p.scale * 100) / 100}`);
          if (p.rotateX !== undefined && p.rotateX !== 0) parts.push(`rotateX: ${r1(p.rotateX)}`);
          if (p.rotateY !== undefined && p.rotateY !== 0) parts.push(`rotateY: ${r1(p.rotateY)}`);
          if (p.rotateZ !== undefined && p.rotateZ !== 0) parts.push(`rotateZ: ${r1(p.rotateZ)}`);
          if (p.perspective !== undefined && p.perspective !== 500) parts.push(`perspective: ${r1(p.perspective)}`);
          let s = `{ x: ${p.x}, y: ${p.y}`;
          if (parts.length) s += `, ${parts.join(", ")}`;
          return `  ${s} },`;
        });
        navigator.clipboard.writeText(`[\n${arr.join("\n")}\n],`).catch(() => {});
        return;
      }

      // Escape: deselect node + exit perspective mode
      if (e.key === "Escape") {
        setEditorSelectedIndex(-1);
        setPerspMode(null);
        return;
      }

      // Toggle keys for each 3D property
      if (e.key === "s" || e.key === "S") { e.preventDefault(); setPerspMode((p) => p === "scale" ? null : "scale"); return; }
      if (e.key === "x" || e.key === "X") { e.preventDefault(); setPerspMode((p) => p === "rotateX" ? null : "rotateX"); return; }
      if (e.key === "y" || e.key === "Y") { e.preventDefault(); setPerspMode((p) => p === "rotateY" ? null : "rotateY"); return; }
      if (e.key === "z" || e.key === "Z") { e.preventDefault(); setPerspMode((p) => p === "rotateZ" ? null : "rotateZ"); return; }
      if (e.key === "p" || e.key === "P") { e.preventDefault(); setPerspMode((p) => p === "persp" ? null : "persp"); return; }
      if (e.key === "n" || e.key === "N") { e.preventDefault(); setPerspMode((p) => p === "numpos" ? null : "numpos"); return; }
      if (e.key === "m" || e.key === "M") { e.preventDefault(); setPerspMode((p) => p === "numsize" ? null : "numsize"); return; }

      /* Lupa. No cambia ningún dato, sólo cómo se ve. */
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomAt((z) => z * 1.25); return; }
      if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomAt((z) => z / 1.25); return; }
      if (e.key === "0") { e.preventDefault(); resetView(); return; }

      const arrow = e.key;
      const isArrow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(arrow);
      if (!isArrow) return;
      /* preventDefault ANTES de mirar si hay nodo seleccionado: con el editor
         abierto, Alt+← es "atrás" en el historial del navegador y te saca de
         la página en el medio del ajuste. */
      e.preventDefault();
      if (editorSelectedIndex < 0) return;

      /* Tres pasos por propiedad: Shift para grueso, Alt para fino, sin nada
         para el normal. El fino es el que permite terminar de acomodar un
         nodo cuando el paso normal ya se pasa de largo. */
      const big = e.shiftKey;
      const fino = e.altKey;
      const paso = (normal: number, grueso: number, chico: number) =>
        big ? grueso : fino ? chico : normal;

      switch (perspMode) {
        case "scale":
          if (arrow === "ArrowUp" || arrow === "ArrowDown") {
            const sStep = paso(0.02, 0.2, 0.01);
            setEditorPositions((prev) =>
              prev.map((pos, i) => {
                if (i !== editorSelectedIndex) return pos;
                const cur = pos.scale ?? 1;
                const next = Math.max(0.1, Math.round((cur + (arrow === "ArrowUp" ? sStep : -sStep)) * 100) / 100);
                return { ...pos, scale: next === 1 ? undefined : next };
              }),
            );
          }
          return;

        case "rotateX":
          if (arrow === "ArrowUp" || arrow === "ArrowDown") {
            const d = paso(2, 10, 0.5);
            setEditorPositions((prev) =>
              prev.map((pos, i) => {
                if (i !== editorSelectedIndex) return pos;
                const cur = pos.rotateX ?? 0;
                const next = Math.round((cur + (arrow === "ArrowDown" ? d : -d)) * 10) / 10;
                return { ...pos, rotateX: next === 0 ? undefined : next };
              }),
            );
          }
          return;

        case "rotateY":
          if (arrow === "ArrowLeft" || arrow === "ArrowRight") {
            const d = paso(2, 10, 0.5);
            setEditorPositions((prev) =>
              prev.map((pos, i) => {
                if (i !== editorSelectedIndex) return pos;
                const cur = pos.rotateY ?? 0;
                const next = Math.round((cur + (arrow === "ArrowRight" ? d : -d)) * 10) / 10;
                return { ...pos, rotateY: next === 0 ? undefined : next };
              }),
            );
          }
          return;

        case "rotateZ":
          if (arrow === "ArrowLeft" || arrow === "ArrowRight") {
            const d = paso(2, 10, 0.5);
            setEditorPositions((prev) =>
              prev.map((pos, i) => {
                if (i !== editorSelectedIndex) return pos;
                const cur = pos.rotateZ ?? 0;
                const next = Math.round((cur + (arrow === "ArrowRight" ? d : -d)) * 10) / 10;
                return { ...pos, rotateZ: next === 0 ? undefined : next };
              }),
            );
          }
          return;

        case "persp":
          if (arrow === "ArrowUp" || arrow === "ArrowDown") {
            const d = paso(20, 100, 5);
            setEditorPositions((prev) =>
              prev.map((pos, i) => {
                if (i !== editorSelectedIndex) return pos;
                const cur = pos.perspective ?? 500;
                /* Redondeo al entero y no a la decena: si no, el paso fino de 5 se pierde. */
                const next = Math.max(50, Math.round(cur + (arrow === "ArrowUp" ? d : -d)));
                return { ...pos, perspective: next === 500 ? undefined : next };
              }),
            );
          }
          return;

        /* Mueve SÓLO el número sobre el botón, sin tocar el nodo. El paso va
           en % del ancho del botón, igual que el dato que se guarda. */
        case "numpos": {
          const d = paso(0.5, 5, 0.1);
          const dx = arrow === "ArrowRight" ? d : arrow === "ArrowLeft" ? -d : 0;
          const dy = arrow === "ArrowDown" ? d : arrow === "ArrowUp" ? -d : 0;
          /* Con el toggle de apretado prendido se toca el par del hover. */
          const [campoX, campoY] = previewPressed
            ? (["numXHover", "numYHover"] as const)
            : (["numX", "numY"] as const);
          setEditorPositions((prev) =>
            prev.map((pos, i) => {
              if (i !== editorSelectedIndex) return pos;
              /* El hover arranca desde donde esté el de reposo, no desde cero:
                 si no, el primer flechazo lo manda al centro del lienzo. */
              const baseX = pos[campoX] ?? (previewPressed ? pos.numX ?? 0 : 0);
              const baseY = pos[campoY] ?? (previewPressed ? pos.numY ?? 0 : 0);
              const nx = round1(baseX + dx);
              const ny = round1(baseY + dy);
              return {
                ...pos,
                [campoX]: nx === 0 && !previewPressed ? undefined : nx,
                [campoY]: ny === 0 && !previewPressed ? undefined : ny,
              };
            }),
          );
          return;
        }

        case "numsize":
          if (arrow === "ArrowUp" || arrow === "ArrowDown") {
            const d = paso(0.02, 0.2, 0.01);
            setEditorPositions((prev) =>
              prev.map((pos, i) => {
                if (i !== editorSelectedIndex) return pos;
                const cur = pos.numSize ?? 1;
                const next = Math.max(0.3, Math.round((cur + (arrow === "ArrowUp" ? d : -d)) * 100) / 100);
                return { ...pos, numSize: next === 1 ? undefined : next };
              }),
            );
          }
          return;

        default: {
          // No perspective mode — move position
          const step = paso(0.5, 5, 0.1);
          setEditorPositions((prev) =>
            prev.map((pos, i) => {
              if (i !== editorSelectedIndex) return pos;
              let { x, y } = pos;
              if (arrow === "ArrowLeft") x = clampPct(x - step);
              if (arrow === "ArrowRight") x = clampPct(x + step);
              if (arrow === "ArrowUp") y = clampPct(y - step);
              if (arrow === "ArrowDown") y = clampPct(y + step);
              return { ...pos, x: round1(x), y: round1(y) };
            }),
          );
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [editorOn, editorSelectedIndex, perspMode, previewPressed, activePositions, logConfig]);

  return (
    <main
      className={`relative min-h-dvh overflow-hidden bg-cover bg-center animate-page-fade ${editorOn ? "cursor-crosshair" : ""}`}
      /* Soft pastel fallback colour behind everything: covers the pre-load
         frame and any sub-pixel gap so a white edge can never flash. */
      style={{ "--scene-bg": `url("${islandBgPath}")`, backgroundColor: "#ebe3f7" } as CSSProperties}
    >
      {/* ── CAPA 1 · CIELO ──────────────────────────────────────────────
          Llena la pantalla entera con object-cover y puede recortarse todo
          lo que haga falta, porque no contiene nada posicionable: su único
          trabajo es que las bandas que deja el contain no queden vacías.
          En island1 es el cielo pastel de verdad; en el resto es la misma
          imagen del arte, ampliada y desenfocada, para no inventar un color
          plano que pelee con la paleta de cada isla. Cuando el arte se
          rehaga en capas, acá va el cielo real y se cae el desenfoque. */}
      <img
        className={`island-backdrop ${backdropIsArt ? "island-backdrop--blur" : ""} transition-opacity duration-300 ${bgReady ? "opacity-100" : "opacity-0"}`}
        src={islandBgPath}
        alt=""
        aria-hidden="true"
        decoding="async"
        // @ts-expect-error — fetchPriority is supported by all modern browsers
        fetchpriority="high"
      />

      {/* ── CAPA 2 · ESCENARIO ──────────────────────────────────────────
          Caja con la relación de aspecto del arte, centrada y CONTENIDA:
          la imagen entra entera en cualquier pantalla. El arte y todos los
          nodos comparten este sistema de coordenadas, así que los % de
          levelPositions.ts caen sobre las plataformas pintadas siempre.
          La caja la resuelve el CSS — sin medir, sin listener de resize. */}
      <div className="island-stage-wrap" ref={stageWrapRef} style={{ "--art-ar": artAspect } as CSSProperties}>
        {/* Lente del editor. Es una capa aparte y no un transform sobre
            .island-stage porque ahí vive la animación de entrada, que también
            anima transform y se pisarían. Con zoom 1 no emite transform, así
            que fuera del editor este div no hace absolutamente nada. */}
        <div
          className="absolute inset-0"
          style={
            view.z !== 1 || view.x !== 0 || view.y !== 0
              ? {
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
                  transformOrigin: "center",
                  cursor: spaceHeld ? "grab" : undefined,
                  /* Sólo durante la apertura: después se apaga para que el
                     arrastre con el dedo responda sin retardo. */
                  transition: animandoEntrada
                    ? "transform 1900ms cubic-bezier(0.22, 0.61, 0.36, 1)"
                    : undefined,
                }
              : undefined
          }
        >
        <div
          ref={stageRef}
          className={`island-stage ${stageCover ? "island-stage--cover" : ""} transition-opacity duration-300 ${bgReady && (!islandImgPath || islandImgSize) ? "animate-island-zoom" : "opacity-0"}`}
        >
          {/* El arte nítido, llenando el escenario. No lleva object-fit: la
              caja YA tiene su relación de aspecto, así que calza al píxel. */}
          <img
            className="block w-full h-full select-none"
            src={artSrc}
            alt={world.title}
            decoding="async"
          />

          {/* Mapa de niveles — mismo sistema de coordenadas que el arte. */}
          <section
            className="absolute inset-0 pointer-events-none z-10"
            aria-label="Niveles del mundo"
            ref={mapRef}
          >
            {editorAvailable() && editorOn && (
              <LevelPositionEditor
                worldSlug={world.slug}
                positions={activePositions}
                levels={world.levels.map((l) => ({ activityId: l.activityId, levelNumber: l.levelNumber }))}
                cursor={cursor}
                lastClick={lastClick}
                gridOn={gridOn}
                selectedIndex={editorSelectedIndex}
                perspMode={perspMode}
                numScale={numScale}
                onNumScaleChange={setNumScale}
                onSelectIndex={setEditorSelectedIndex}
                onToggleGrid={() => setGridOn((v) => !v)}
                onReset={resetEditorPositions}
                onClose={() => setEditorOn(false)}
                onCursorMove={handleEditorCursor}
                onCopyAt={handleEditorCopyAt}
                onUpdatePerspective={handleUpdatePerspective}
                zoom={view.z}
                onZoom={(factor) => zoomAt((z) => z * factor)}
                onZoomReset={resetView}
                previewPressed={previewPressed}
                onTogglePressed={() => setPreviewPressed((v) => !v)}
                onToast={setMessage}
              />
            )}

            {/* Ship/avatar. Anchored by its BOTTOM-CENTRE just above the current
                level node (translate -50%,-100%), so making it bigger grows it
                UPWARD and it never covers the node it sits on. The bob animation
                lives on the inner <img> so it doesn't fight the positioning
                transform on the wrapper. */}
            <span
              /* El ancho vive ACÁ, no en la imagen: este span sí está anclado
                 al escenario (position:absolute dentro de la <section>), así
                 que el % se resuelve contra el ancho del escenario. Puesto en
                 la <img>, el % se resolvería contra un padre shrink-to-fit
                 —cuyo ancho depende del contenido— y sería circular.
                 10.13 % reproduce los 18vmin de 1920×1080; la nave ahora
                 escala junto con las plataformas, igual que los nodos. */
              className="absolute z-20 pointer-events-none w-[clamp(5rem,10.13%,22rem)]"
              style={{ left: `${currentPosition.x}%`, top: `${currentPosition.y - 3}%`, transform: "translate(-50%,-100%)" }}
            >
              <CharacterSkin
                kind="ship"
                className="block w-full animate-ship-hover"
                alt="Nave de los estudiantes en el nivel actual"
                loading="lazy"
              />
            </span>

            {/* Track hover for pressed button state (disabled during editor). */}
            {world.levels.map((level, index) => {
              const isSelected = index === selectedIndex;
              const position = activePositions[index];
              const cssPos = { left: `${position.x}%`, top: `${position.y}%` };
              const isCompleted = level.state === "Completado";
              const isBlocked = level.state === "Bloqueado";

              /* Stored values: deltas from PERSPECTIVE_BASE (0 = base = image as rendered).
                 Scale and perspective are absolute (not relative to base). */
              const storedRx = position.rotateX ?? 0;
              const storedRy = position.rotateY ?? 0;
              const storedRz = position.rotateZ ?? 0;
              const storedScale = position.scale ?? 1;
              const storedPersp = position.perspective ?? 500;

              /* Effective (absolute) values: base + delta for rotations, absolute for scale/persp. */
              const effRx = Math.round((storedRx + PERSPECTIVE_BASE.rotateX) * 10) / 10;
              const effRy = Math.round((storedRy + PERSPECTIVE_BASE.rotateY) * 10) / 10;
              const effRz = Math.round((storedRz + PERSPECTIVE_BASE.rotateZ) * 10) / 10;
              const effScale = storedScale;
              const effPersp = storedPersp;

              /* Image delta from base: same as stored (since image was rendered at base). */
              const deltaRx = storedRx;
              const deltaRy = storedRy;
              const deltaRz = storedRz;
              const deltaScale = storedScale;

              const hasDelta = deltaScale !== 1 || deltaRx !== 0 || deltaRy !== 0 || deltaRz !== 0;

              /* Build a CSS 3D transform string. */
              const transform3d = (rx: number, ry: number, rz: number, s: number, p: number) =>
                `perspective(${p}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;

              /* Image transform: delta from base (0 = as rendered). */
              const imgTransform = hasDelta ? transform3d(deltaRx, deltaRy, deltaRz, deltaScale, effPersp) : undefined;
              /* ¿Este nodo se está mostrando APRETADO? Fuera del editor lo
                 decide el mouse encima. Dentro del editor lo decide el toggle
                 del panel, y sólo para el nodo seleccionado: así se puede
                 acomodar el número del estado apretado sin tener que sostener
                 el mouse encima mientras se usa el teclado. */
              const pressedNow = editorOn
                ? previewPressed && index === editorSelectedIndex
                : !isBlocked && hoveredIndex === index;
              /* Number 3D transform: perspective MUST be the first function (CSS
                 rule); keep it as in the original pre-rendered image. The screen
                 Y translation lives on a separate wrapper element (see JSX) so
                 it runs in the un-rotated parent frame. */
              const numTransform = `perspective(${effPersp}px) rotateX(${PERSPECTIVE_BASE.rotateX}deg) rotateY(${PERSPECTIVE_BASE.rotateY}deg) rotateZ(${PERSPECTIVE_BASE.rotateZ}deg) scale(${effScale})`;

              /* Tamaño del número = % del ANCHO DEL BOTÓN (cqw), no vmin. El
                 botón declara container-type: inline-size, así que 1cqw = 1 %
                 de su ancho y el número escala junto con él en toda
                 resolución. 24.21 % reproduce los 2.3vmin de 1920×1080, donde
                 el botón medía 102.6 px y el número 24.84 px. */
              const numSize = `${(24.21 * numScale * (position.numSize ?? 1)).toFixed(2)}cqw`;

              /* Contorno oscuro del número BLANCO, en cqw como todo lo demás.
                 El blanco solo no alcanza en todos los discos: el de la isla 4
                 es un rosa pálido y el número quedaba en 1.71:1 — se leía
                 apenas —, y el de la isla 1 en 2.81:1, los dos por debajo del
                 piso de 3:1 que pide un texto grande.

                 Se resuelve con contorno y no cambiando el color porque la
                 regla es que el número pendiente sea blanco en las quince: es
                 lo que hace que se reconozca de una isla a otra. Con el
                 contorno el blanco se lee sobre cualquier disco, por claro que
                 sea, y las otras trece sólo ganan definición.

                 paint-order: stroke pinta el contorno DETRÁS del relleno; sin
                 eso el trazo se come el glifo desde el borde y el número
                 adelgaza. Va sólo en el blanco: el número completado es oscuro
                 y un contorno oscuro alrededor sólo lo engordaría. */
              const numStroke = `${(24.21 * numScale * (position.numSize ?? 1) * 0.11).toFixed(2)}cqw`;

              /* Corrimiento del número respecto del centro del PNG, por nivel.
                 En cqw (% del ancho del botón), nunca en px: el centro del
                 lienzo deja de caer sobre el centro visible del disco apenas
                 el nodo se inclina o se agranda, y la corrección tiene que
                 escalar junto con el botón. */
              const numDx = position.numX ?? 0;
              const numDy = position.numY ?? 0;

              /* Posición del número con el botón apretado. Si esa isla no la
                 definió, se usa la de reposo: el hundido genérico de abajo
                 alcanza para la mayoría. */
              const numHx = pressedNow ? position.numXHover ?? numDx : numDx;
              const numHy = pressedNow ? position.numYHover ?? numDy : numDy;

              /* Hundido del número al apretarse, en cqw y no en px. Era un -6/-1
                 fijo en píxeles: el salto medía lo mismo en una Chromebook que
                 en un monitor grande, así que el efecto se veía distinto según
                 la pantalla. Los valores reproducen esos px a 1920×1080, donde
                 el botón medía 102.6 px, que es la resolución de referencia de
                 todas las conversiones de acá. */
              const lift = pressedNow ? -0.97 : -5.85;

              /* State-driven visual classes for the node button. */
              const stateClass =
                level.state === "Completado"
                  ? "drop-shadow-[0_0_8px_rgba(89,205,183,0.55)]"
                  : level.state === "Bloqueado"
                    ? "grayscale"
                    : "";

              return (
                <button
                  key={level.title}
                  type="button"
                  data-level-node=""
                  /* Id estable por nodo (btnisland<isla>lvl<nivel>): es el
                     CONTENEDOR de las 4 piezas (imagen normal, imagen apretada,
                     número y el pulso celeste), así seleccionarlo en la dev tool
                     mueve/escala todo junto y genera un selector limpio.

                     NO uses "Generar CSS" del DevLayoutEditor sobre estos ids.
                     Una regla `#btnislandNlvlM { transform: translate(…px) }`
                     congela la posición en píxeles y se despega del arte al
                     cambiar la resolución. La posición de un nivel es SIEMPRE
                     un dato en src/data/levelPositions.ts, editable con el
                     LevelPositionEditor (que copia el arreglo, no CSS). */
                  id={`btnisland${world.id.replace(/\D/g, "")}lvl${level.levelNumber}`}
                  className={[
                    "absolute -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-auto",
                    /* Tamaño = % del ESCENARIO (la <section> anclada al rect de
                       la imagen), NO vmin. Con vmin el botón escalaba contra el
                       viewport mientras la plataforma escalaba contra la imagen:
                       fuera de 16:9 se despegaban (hasta −46 % en un teléfono).
                       5.34 % reproduce los 9.5vmin de 1920×1080 y ahora queda
                       clavado al arte en cualquier resolución. El clamp es solo
                       una red de seguridad: mínimo táctil de 44 px, y un techo
                       alto que en la práctica no se toca.
                       aspect-square da el alto — un alto en % se resolvería
                       contra la ALTURA del escenario y el botón no sería
                       cuadrado. container-type habilita los cqw del número. */
                    "w-[clamp(2.75rem,5.34%,14rem)] aspect-square [container-type:inline-size]",
                    "rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky",
                    "transition-opacity duration-150",
                    isSelected ? "animate-platform-pulse" : "",
                    editorOn ? "cursor-move" : "cursor-pointer",
                    dragIndex === index ? "opacity-70 cursor-grabbing" : "",
                    editorOn && editorSelectedIndex === index ? "ring-2 ring-accent ring-offset-2 ring-offset-transparent" : "",
                    stateClass,
                  ].filter(Boolean).join(" ")}
                  style={cssPos}
                  onClick={() => handleNodeClick(index)}
                  onDoubleClick={() => handleNodeDoubleClick(index)}
                  onPointerDown={(e) => onNodePointerDown(e, index)}
                  onPointerMove={(e) => onNodePointerMove(e, index)}
                  onPointerUp={onNodePointerUp}
                  onMouseEnter={() => { if (!editorOn) setHoveredIndex(index); }}
                  onMouseLeave={() => setHoveredIndex(-1)}
                  aria-label={`${level.title}: ${level.name}. ${level.state}`}
                >
                  {/* Image layer: only the delta from base. */}
                  <span
                    className="absolute inset-0"
                    style={hasDelta ? { transform: imgTransform } : undefined}
                  >
                    {/* Botón propio de la isla si lo tiene, básico si no
                        (ver levelButtonFor en utils/assets).

                        Los dos estados están SIEMPRE en el DOM, superpuestos, y
                        lo que cambia es la opacidad: así el cambio es un cruce
                        y no un corte. Con `hidden` el navegador además tenía
                        que decodificar el apretado recién al pasar el mouse, y
                        el primer hover de cada botón parpadeaba. */}
                    <img
                      className="absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ease-out motion-reduce:transition-none"
                      style={{ opacity: pressedNow ? 0 : 1 }}
                      src={levelButtonFor(world.id)}
                      alt=""
                      decoding="async"
                      draggable={false}
                    />
                    <img
                      className="absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ease-out motion-reduce:transition-none"
                      style={{ opacity: pressedNow ? 1 : 0 }}
                      src={levelButtonFor(world.id, true)}
                      alt=""
                      decoding="async"
                      draggable={false}
                    />
                  </span>

                  {/* Capa del número: primero el corrimiento en pantalla y
                      después el span con la perspectiva 3D, que tiene que
                      conservar perspective() como primera función.

                      Todo va en cqw — % del ancho del botón — incluido el
                      hundido al apretarse, para que acompañe al botón en
                      cualquier resolución.

                      La transición se apaga con el editor abierto: si no, cada
                      flechazo para acomodar el número arrastra 200 ms de
                      animación y el ajuste fino se vuelve imposible de leer. */}
                  <span
                    className={`absolute inset-0 flex items-center justify-center ${editorOn ? "" : "transition-transform duration-200 ease-out motion-reduce:transition-none"}`}
                    style={{ transform: `translate(${numHx}cqw, ${numHy + lift}cqw)` }}
                  >
                    <span style={{ transform: numTransform }}>
                      {/* Sin completar el número va BLANCO en las quince islas,
                          con un contorno oscuro que lo hace legible incluso
                          sobre los discos claros (ver numStroke arriba).
                          Completado lleva el color del propio botón oscurecido
                          — ver levelNumberDoneColor en utils/assets —, así el
                          nivel hecho se distingue sin robarle la atención al
                          que falta. La sombra va en los dos casos: es lo que
                          despega el número del arte cuando el disco tiene
                          degradé. */}
                      <span
                        className={[
                          "font-display font-black select-none",
                          isBlocked ? "text-muted" : "drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]",
                          !isCompleted && !isBlocked ? "text-white" : "",
                        ].filter(Boolean).join(" ")}
                        style={{
                          fontSize: numSize,
                          ...(isCompleted && !isBlocked
                            ? { color: levelNumberDoneColor(world.id) }
                            : !isBlocked
                              ? { WebkitTextStroke: `${numStroke} rgba(0,0,0,0.5)`, paintOrder: "stroke" }
                              : {}),
                        }}
                      >
                        {level.levelNumber}
                      </span>
                    </span>
                  </span>

                  {/* Status indicators — no perspective, positioned flat on the button. */}
                  {isCompleted && (
                    <span className="absolute -top-1 -right-1 text-mint drop-shadow-sm" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                  )}
                  {isBlocked && (
                    <span className="absolute -top-1 -right-1 text-rose bg-white/70 rounded-full p-0.5" aria-hidden="true">
                      <Lock size={14} />
                    </span>
                  )}
                  {isCompleted && (
                    <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2">
                      <LevelStars earned={level.stars} size={17} gap={1.5} />
                    </span>
                  )}

                  {editorOn && (
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-white bg-black/60 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none" aria-hidden="true">
                      {position.x} · {position.y}
                      {hasDelta ? `  s${storedScale.toFixed(1)}  rx${storedRx} ry${storedRy} rz${storedRz}` : ""}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Compact selected-level popover, anchored to the selected node.
                Opens on tap, closes on tap-outside. Hidden while editing. */}
            {!editorOn && popoverOpen && (
              <div
                ref={popoverRef}
                data-level-popover=""
                className="absolute z-50 pointer-events-auto"
                style={{
                  left: `${selectedPos.x}%`,
                  top: `${selectedPos.y}%`,
                  /* Base anchor (rem/%) + the collision nudge (px). The pop-in
                     animation lives on the INNER panel, so it never overrides
                     this transform — otherwise the clamp could never settle. */
                  transform: `translate(calc((${popoverTx}) + ${popoverNudge.dx}px), calc((${popoverTy}) + ${popoverNudge.dy}px))`,
                }}
              >
                <div
                  className="animate-popover-in p-4 rounded-2xl min-w-[14rem] relative backdrop-blur-xl border border-white/70 shadow-[0_20px_50px_rgba(40,70,120,0.28)]"
                  style={{ background: "rgba(255,255,255,0.9)" }}
                >
                  {/* Tail — rotated square pointing toward the node */}
                  <span
                    className={[
                      "absolute w-3 h-3 rotate-45 border border-white/70",
                      popoverRight ? "-left-1.5" : "-right-1.5",
                      popoverVBand === "top" ? "top-3" : popoverVBand === "bottom" ? "bottom-3" : "top-1/2 -translate-y-1/2",
                    ].filter(Boolean).join(" ")}
                    style={{ background: "rgba(255,255,255,0.9)" }}
                    aria-hidden="true"
                  />
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <strong className="font-display font-bold text-text text-base">{selectedLevel.title}</strong>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_PILL_CLASSES[popoverState] ?? "bg-accent text-white"}`}>
                      {selectedLevel.state}
                    </span>
                  </div>
                  <h3 className="text-sm text-muted mb-2">{selectedLevel.name}</h3>
                  <span className="block mb-3">
                    <LevelStars earned={selectedLevel.stars} size={19} gap={2} />
                  </span>
                  {/* En el celular la ficha se abre igual —nombre, estado y
                      estrellas ganadas— pero SIN botón de jugar: se explora el
                      juego, no se progresa (CLAUDE.md §6.2). Se muestra el
                      aviso en vez de un botón muerto para que el chico entienda
                      por qué y siga recorriendo. */}
                  {celular ? (
                    <AvisoSoloEnComputadora />
                  ) : (
                    <Button className="w-full" onClick={openLevel}>
                      {selectedLevel.state === "Bloqueado" ? (
                        <><Lock size={17} /> <span>Bloqueado</span></>
                      ) : selectedLevel.state === "Completado" ? (
                        <><RotateCcw size={17} /> <span>Reintentar</span></>
                      ) : (
                        <><span>Entrar al nivel</span> <ArrowRight size={18} strokeWidth={2.8} /></>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
        </div>
      </div>

      {/* Back to worlds map */}
      <button
        type="button"
        className="fixed top-4 left-4 z-30 glass-surface rounded-xl px-3 py-2 flex items-center gap-2 text-text font-bold shadow-card hover:brightness-105 transition cursor-pointer animate-hud-in"
        onClick={() => navigate("/mundos")}
        aria-label="Volver a mundos"
      >
        <ArrowLeft size={20} />
        {/* En el celular queda sólo la flecha: con el texto, este botón y el
            encabezado de la isla se pisaban — no entran los dos en 375 px. */}
        <span className={`text-[clamp(1rem,1.8vmin,1.35rem)] ${celular ? "hidden" : ""}`}>Volver a mundos</span>
      </button>

      {/* Contador de estrellas de la cuenta (siempre visible, arriba a la derecha). */}
      <StarCounter className="fixed top-4 right-4 z-30" />

      {/* Barra ÉPICA de progreso al próximo personaje — abajo-centro, igual
          que en el mapa de mundos (pointer-events-none: no tapa los niveles).
          Se desvanece cuando hay un popover de nivel abierto para que los dos
          paneles de vidrio NUNCA se superpongan abajo (antes el popover de los
          niveles de la fila inferior quedaba escondido detrás de esta barra y
          parecía que el nivel "no se podía entrar"). */}
      <SkinProgressBar
        className={`transition-opacity duration-200 ${popoverOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      />

      {/* Celebración al desbloquear una fase de personaje nueva — acá es donde
          el alumno aterriza con "Volver" justo después de cruzar el umbral. */}
      <SkinUnlockCelebration />

      {editorAvailable() && (
        <button
          type="button"
          className={`fixed bottom-4 left-4 z-30 glass-surface rounded-xl px-3 py-2 flex items-center gap-2 text-text font-bold shadow-card hover:brightness-105 transition cursor-pointer ${editorOn ? "bg-accent/20 ring-2 ring-accent" : ""}`}
          onClick={() => setEditorOn((v) => !v)}
          title="Editor de posiciones de niveles (solo dev)"
        >
          <MapPin size={18} />
          <span>{editorOn ? "Cerrar editor" : "Editar niveles"}</span>
        </button>
      )}

      {/* Compact floating island header — sits in the top-safe area and never
          covers the level nodes. Replaces the old large title/progress panel. */}
      {/* Encabezado de la isla — UNA sola línea.
          Antes eran dos renglones dentro de un bloque blanco de 489x77 que se
          apoyaba justo sobre el eje por donde sube el camino de niveles, y
          entre este panel y la barra de personaje de abajo se comían casi un
          cuarto del alto de la pantalla. Lo que sacó altura fue juntar todo en
          una línea y acortar el texto de progreso: "Faltan 15★ para el próximo
          mundo" decía en ocho palabras lo que "15★ para el próximo" dice en
          cuatro, y el dato completo sigue en el title y en el aria-label. */}
      <header
        className="fixed top-0 left-1/2 -translate-x-1/2 z-20 glass-strong rounded-b-2xl px-4 py-1.5 flex items-center gap-2.5 shadow-card animate-hud-in max-w-[92vw]"
        /* Mismo fondo blanco que la barra de personaje de abajo, para que los
           dos paneles se vean del mismo color sin importar el arte que tengan
           detrás (antes el de arriba dejaba pasar el cielo azul y el de abajo
           las nubes blancas, y no coincidían). */
        style={{ background: "rgba(255,255,255,0.82)" }}
      >
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-700 font-bold text-[11px] whitespace-nowrap">
          <Star size={11} fill="currentColor" />
          M{worldNumber}
        </span>
        <h1 className="font-display font-black text-text text-[clamp(0.95rem,1.7vmin,1.15rem)] truncate leading-tight">{world.title}</h1>
        <span className="inline-flex items-center gap-1 text-yellow-500 font-bold text-[13px] whitespace-nowrap">
          <Star size={12} fill="currentColor" />
          {starProgress.earnedStars}/{starProgress.totalStars}
        </span>
        <span
          className="hidden sm:inline text-[11px] font-semibold text-muted whitespace-nowrap"
          title={
            !isLastWorld && !starProgress.isUnlockedNext
              ? `Te faltan ${Math.max(0, starProgress.requiredStars - starProgress.earnedStars)} estrellas para desbloquear el próximo mundo`
              : undefined
          }
        >
          {!isLastWorld && !starProgress.isUnlockedNext
            ? `${Math.max(0, starProgress.requiredStars - starProgress.earnedStars)}★ para el próximo`
            : "Tocá un nivel"}
        </span>
        {canGoToNextWorld && nextWorld && (
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent text-white font-bold text-[12px] shadow-btn animate-next-pulse hover:brightness-105 transition cursor-pointer whitespace-nowrap"
            onClick={() => navigate(nextWorld.route)}
            aria-label={`Ir al siguiente mundo: ${nextWorld.title}`}
            title={`Ir a ${nextWorld.title}`}
          >
            <span>Siguiente</span>
            <ArrowRight size={14} strokeWidth={2.7} />
          </button>
        )}
      </header>

      <Toast message={message} />
    </main>
  );
}
