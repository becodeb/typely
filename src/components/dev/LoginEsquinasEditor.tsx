import { Copy, Move, RotateCcw, Save, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  ESQUINAS_ORDEN,
  GIRO_BASE,
  LOGIN_ESQUINAS,
  type EsquinaClave,
  type EsquinaLogin,
} from "../../data/loginEsquinas";

/* =====================================================================
   LoginEsquinasEditor — DEV-ONLY: colocar los adornos de esquina del login.

   Es el mismo flujo que el editor de posiciones de nivel: se abre con
   /login?editor=1 (con la bandera `typely_dev_editor` en localStorage),
   se arrastra la pieza sobre la tarjeta REAL y Ctrl/Cmd + S escribe
   src/data/loginEsquinas.ts a través del server de dev. Todo lo que guarda
   es relativo al ancho de la tarjeta, nunca píxeles (ver el archivo de
   datos), así que lo que acomodás acá queda bien en cualquier resolución.

   Atajos (modo conmutable — una vez entra, otra sale):
     click            seleccionar una esquina
     arrastrar        mover
     ←↑↓→             mover 0,5 %   ·  Shift ×10  ·  Alt fino (0,1 %)
     S                modo ANCHO   ↑↓ ajusta
     Z                modo GIRO    ←→ ajusta
     Escape           deseleccionar / salir del modo
     Ctrl/Cmd + C     copiar el objeto al portapapeles
     Ctrl/Cmd + S     GUARDAR en src/data/loginEsquinas.ts
   ===================================================================== */

export type Esquinas = Record<EsquinaClave, EsquinaLogin>;
type Modo = "ancho" | "giro" | null;

const R1 = (v: number) => Math.round(v * 10) / 10;
const ETIQUETA: Record<EsquinaClave, string> = {
  ai: "arriba izq.",
  ad: "arriba der.",
  bd: "abajo der.",
  bi: "abajo izq.",
};

export function editorLoginDisponible(): boolean {
  return (
    typeof window !== "undefined" &&
    localStorage.getItem("typely_dev_editor") === "1" &&
    new URLSearchParams(window.location.search).has("editor")
  );
}

/** El objeto tal como va en el archivo, para "Copiar". */
export function esquinasLiteral(e: Esquinas): string {
  return `{\n${ESQUINAS_ORDEN.map((k) => `  ${k}: { x: ${R1(e[k].x)}, y: ${R1(e[k].y)}, ancho: ${R1(e[k].ancho)}, giro: ${R1(e[k].giro)} },`).join("\n")}\n}`;
}

async function copiar(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Estilo inline de una esquina a partir de sus datos. Las unidades son
 *  `cqw` (1 % del ancho de la tarjeta, que es un contenedor de consulta),
 *  también en vertical: así la pieza no se deforma cuando la tarjeta cambia
 *  de alto. */
export function estiloEsquina(clave: EsquinaClave, e: EsquinaLogin): CSSProperties {
  const horizontal = clave === "ai" || clave === "bi" ? { left: `${e.x}cqw` } : { right: `${e.x}cqw` };
  const vertical = clave === "ai" || clave === "ad" ? { top: `${e.y}cqw` } : { bottom: `${e.y}cqw` };
  return { ...horizontal, ...vertical, width: `${e.ancho}cqw`, rotate: `${GIRO_BASE[clave] + e.giro}deg` };
}

interface Opciones {
  activo: boolean;
  shellRef: RefObject<HTMLElement | null>;
  esquinas: Esquinas;
  setEsquinas: (fn: (prev: Esquinas) => Esquinas) => void;
  onCerrar: () => void;
}

/** Toda la lógica del editor: selección, arrastre, teclado y guardado.
 *  Devuelve los manejadores para las imágenes y el panel a renderizar. */
export function useLoginEsquinasEditor({ activo, shellRef, esquinas, setEsquinas, onCerrar }: Opciones) {
  const [seleccion, setSeleccion] = useState<EsquinaClave | null>(null);
  const [modo, setModo] = useState<Modo>(null);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const arrastre = useRef<{ clave: EsquinaClave; x0: number; y0: number; ex: number; ey: number } | null>(null);

  const avisar = useCallback((t: string) => {
    setMensaje(t);
    window.setTimeout(() => setMensaje(""), 2200);
  }, []);

  const cambiar = useCallback(
    (clave: EsquinaClave, parche: Partial<EsquinaLogin>) => {
      setEsquinas((prev) => ({ ...prev, [clave]: { ...prev[clave], ...parche } }));
    },
    [setEsquinas],
  );

  /** Ancho REAL de la tarjeta en pantalla (con el zoom del hook incluido),
   *  para convertir píxeles de arrastre a % del ancho. */
  const anchoShell = useCallback(() => shellRef.current?.getBoundingClientRect().width || 1, [shellRef]);

  const onPointerDown = useCallback(
    (clave: EsquinaClave) => (ev: ReactPointerEvent<HTMLImageElement>) => {
      if (!activo) return;
      ev.preventDefault();
      ev.stopPropagation();
      setSeleccion(clave);
      const e = esquinas[clave];
      arrastre.current = { clave, x0: ev.clientX, y0: ev.clientY, ex: e.x, ey: e.y };
      ev.currentTarget.setPointerCapture(ev.pointerId);
    },
    [activo, esquinas],
  );

  const onPointerMove = useCallback(
    (ev: ReactPointerEvent<HTMLImageElement>) => {
      const a = arrastre.current;
      if (!a) return;
      const w = anchoShell();
      /* Las esquinas de la derecha miden x desde el borde derecho, y las de
         abajo miden y desde el inferior: el signo del arrastre se invierte. */
      const sx = a.clave === "ai" || a.clave === "bi" ? 1 : -1;
      const sy = a.clave === "ai" || a.clave === "ad" ? 1 : -1;
      cambiar(a.clave, {
        x: R1(a.ex + (sx * (ev.clientX - a.x0) * 100) / w),
        y: R1(a.ey + (sy * (ev.clientY - a.y0) * 100) / w),
      });
    },
    [anchoShell, cambiar],
  );

  const onPointerUp = useCallback(() => {
    arrastre.current = null;
  }, []);

  const guardar = useCallback(async () => {
    setGuardando(true);
    try {
      const res = await fetch("/__typely/login-esquinas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ esquinas }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) avisar("Guardado en src/data/loginEsquinas.ts");
      else avisar(`No se pudo guardar: ${data.error ?? res.status}. Usá "Copiar".`);
    } catch {
      avisar('Sin conexión con el server de dev. Usá "Copiar".');
    } finally {
      setGuardando(false);
    }
  }, [esquinas, avisar]);

  const copiarTodo = useCallback(async () => {
    const txt = esquinasLiteral(esquinas);
    console.log("[typely] esquinas del login:\n" + txt);
    avisar((await copiar(txt)) ? "Objeto copiado al portapapeles" : "No pude copiar: está en la consola");
  }, [esquinas, avisar]);

  const espejar = useCallback(() => {
    if (!seleccion) return;
    const base = esquinas[seleccion];
    setEsquinas((prev) => {
      const next = { ...prev };
      for (const k of ESQUINAS_ORDEN) next[k] = { ...base };
      return next;
    });
    avisar(`${ETIQUETA[seleccion]} copiada a las cuatro`);
  }, [seleccion, esquinas, setEsquinas, avisar]);

  const reset = useCallback(() => {
    setEsquinas(() => ({ ...LOGIN_ESQUINAS }));
    avisar("Valores del archivo restaurados");
  }, [setEsquinas, avisar]);

  /* Teclado. Se ignora mientras se escribe en un input del formulario, salvo
     los atajos con Ctrl/Cmd. */
  useEffect(() => {
    if (!activo) return;
    const onKey = (e: KeyboardEvent) => {
      const enInput = (e.target as HTMLElement | null)?.tagName === "INPUT";
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        void guardar();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C") && !enInput) {
        e.preventDefault();
        void copiarTodo();
        return;
      }
      if (enInput) return;
      if (e.key === "Escape") {
        if (modo) setModo(null);
        else setSeleccion(null);
        return;
      }
      if (e.key === "s" || e.key === "S") { e.preventDefault(); setModo((m) => (m === "ancho" ? null : "ancho")); return; }
      if (e.key === "z" || e.key === "Z") { e.preventDefault(); setModo((m) => (m === "giro" ? null : "giro")); return; }

      const flecha = e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown";
      if (!flecha) return;
      /* preventDefault ANTES de mirar la selección: Alt + ← es "Atrás" en el
         navegador y te saca de la pantalla a mitad del ajuste. */
      e.preventDefault();
      if (!seleccion) return;
      const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
      const dy = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
      const cur = esquinas[seleccion];
      if (modo === "ancho") {
        const paso = e.shiftKey ? 5 : e.altKey ? 0.1 : 1;
        cambiar(seleccion, { ancho: R1(Math.max(1, cur.ancho - dy * paso)) });
        return;
      }
      if (modo === "giro") {
        const paso = e.shiftKey ? 10 : e.altKey ? 0.5 : 1;
        cambiar(seleccion, { giro: R1(cur.giro + dx * paso) });
        return;
      }
      const paso = e.shiftKey ? 5 : e.altKey ? 0.1 : 0.5;
      const sx = seleccion === "ai" || seleccion === "bi" ? 1 : -1;
      const sy = seleccion === "ai" || seleccion === "ad" ? 1 : -1;
      cambiar(seleccion, { x: R1(cur.x + sx * dx * paso), y: R1(cur.y + sy * dy * paso) });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activo, seleccion, modo, esquinas, cambiar, guardar, copiarTodo]);

  const panel = activo
    ? createPortal(
        <LoginEsquinasPanel
          esquinas={esquinas}
          seleccion={seleccion}
          modo={modo}
          mensaje={mensaje}
          guardando={guardando}
          onSeleccionar={setSeleccion}
          onCambiar={cambiar}
          onGuardar={() => void guardar()}
          onCopiar={() => void copiarTodo()}
          onEspejar={espejar}
          onReset={reset}
          onCerrar={onCerrar}
        />,
        document.body,
      )
    : null;

  return { seleccion, onPointerDown, onPointerMove, onPointerUp, panel };
}

interface PanelProps {
  esquinas: Esquinas;
  seleccion: EsquinaClave | null;
  modo: Modo;
  mensaje: string;
  guardando: boolean;
  onSeleccionar: (k: EsquinaClave) => void;
  onCambiar: (k: EsquinaClave, parche: Partial<EsquinaLogin>) => void;
  onGuardar: () => void;
  onCopiar: () => void;
  onEspejar: () => void;
  onReset: () => void;
  onCerrar: () => void;
}

function Deslizador({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="grid grid-cols-[3.2rem_1fr_3.4rem] items-center gap-2 text-[11px] font-semibold text-slate-600">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-violet-500" />
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded border border-slate-300 px-1 py-0.5 text-right text-[11px] text-slate-800" />
    </label>
  );
}

function LoginEsquinasPanel(p: PanelProps) {
  const sel = p.seleccion ? p.esquinas[p.seleccion] : null;
  const btn = "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-bold cursor-pointer transition-colors";
  return (
    <aside
      className="fixed right-4 top-4 z-[9999] w-[19rem] rounded-2xl border border-white/70 bg-white/92 p-4 text-slate-800 shadow-[0_20px_60px_rgba(23,53,95,0.28)] backdrop-blur-md"
      style={{ fontFamily: "var(--font-body)" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <strong className="flex items-center gap-1.5 text-[13px]">
          <Move size={14} /> Esquinas del login
        </strong>
        <button type="button" className="rounded-full p-1 hover:bg-slate-200" onClick={p.onCerrar} aria-label="Cerrar editor">
          <X size={14} />
        </button>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-1">
        {ESQUINAS_ORDEN.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => p.onSeleccionar(k)}
            className={`rounded-lg px-1 py-1.5 text-[11px] font-bold ${p.seleccion === k ? "bg-violet-500 text-white" : "bg-slate-100 hover:bg-slate-200"}`}
          >
            {k.toUpperCase()}
          </button>
        ))}
      </div>

      {sel && p.seleccion ? (
        <div className="mb-3 grid gap-1.5">
          <p className="text-[11px] text-slate-500">
            {ETIQUETA[p.seleccion]} · % del ancho de la tarjeta
            {p.modo && <span className="ml-1 rounded bg-amber-200 px-1 font-bold text-amber-900">modo {p.modo}</span>}
          </p>
          <Deslizador label="x" value={sel.x} min={-40} max={40} step={0.1} onChange={(v) => p.onCambiar(p.seleccion!, { x: v })} />
          <Deslizador label="y" value={sel.y} min={-40} max={40} step={0.1} onChange={(v) => p.onCambiar(p.seleccion!, { y: v })} />
          <Deslizador label="ancho" value={sel.ancho} min={5} max={80} step={0.1} onChange={(v) => p.onCambiar(p.seleccion!, { ancho: v })} />
          <Deslizador label="giro" value={sel.giro} min={-45} max={45} step={0.5} onChange={(v) => p.onCambiar(p.seleccion!, { giro: v })} />
          <button type="button" className={`${btn} justify-center bg-slate-100 hover:bg-slate-200`} onClick={p.onEspejar}>
            Espejar a las 4
          </button>
        </div>
      ) : (
        <p className="mb-3 text-[11px] text-slate-500">Hacé clic en una esquina de la tarjeta o elegila arriba. Arrastrá, flechas para afinar, S = ancho, Z = giro.</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={`${btn} bg-emerald-500 text-white hover:bg-emerald-600`} onClick={p.onGuardar} disabled={p.guardando}>
          <Save size={13} /> {p.guardando ? "Guardando…" : "Guardar en el archivo"}
        </button>
        <button type="button" className={`${btn} bg-slate-100 hover:bg-slate-200`} onClick={p.onCopiar}>
          <Copy size={13} /> Copiar
        </button>
        <button type="button" className={`${btn} bg-slate-100 hover:bg-slate-200`} onClick={p.onReset}>
          <RotateCcw size={13} /> Reset
        </button>
      </div>
      {p.mensaje && <p className="mt-2 text-[11px] font-semibold text-violet-700">{p.mensaje}</p>}
      <p className="mt-2 text-[10px] leading-snug text-slate-400">Ctrl+S guarda · Ctrl+C copia · Shift ×10 · Alt fino · Esc sale</p>
    </aside>
  );
}
