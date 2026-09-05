/* El taller: la caja de piezas y el espacio donde se arma el programa.
 *
 * En la ficción esto es la LIBRETA DEL NAVEGANTE — la lista que el robot
 * de la izquierda va a leer en voz alta para que el de la derecha maneje.
 * Por eso el bloque que se está ejecutando se ilumina: es el renglón que
 * está leyendo, no un "highlight de debugger".
 *
 * Los bloques son CSS, no imágenes, y eso no es una decisión de gusto:
 * los contenedores tienen que ESTIRARSE según cuántas piezas les metan
 * adentro, y una imagen no se estira sin deformar la lengüeta.
 *
 * Sin etiquetas de texto en las piezas (MVP.md §3). El nombre existe
 * como `aria-label` para teclado y lector de pantalla, no en pantalla.
 * Los sensores son PASTILLAS dentro del contenedor: se tocan para
 * cambiarlos y muestran el dibujo del sensor, con una barra roja cuando
 * están negados.
 *
 * TRES FORMAS DE EDITAR, y ninguna es la única (MVP.md §7):
 *
 *   - TOCAR: en la caja agrega al final; en la libreta quita.
 *   - ARRASTRAR: sacar una pieza de la caja y soltarla donde va, o
 *     reordenar las que ya están. Con Pointer Events y no con el
 *     drag-and-drop de HTML5, porque ése no anda con el dedo, y las
 *     Chromebook del aula son táctiles. Mientras se arrastra, la pieza
 *     se LEVANTA (un fantasma que sigue al puntero) y en la pila se abre
 *     UN HUECO del color de la pieza donde va a caer: un arrastre sin
 *     destino visible es peor que no tener arrastre. Soltar fuera de la
 *     libreta devuelve la pieza a la caja (la quita). Donde no cabe (el
 *     tope de anidamiento) no se abre hueco y soltar no hace nada.
 *   - TECLADO: con el foco en una pieza, las flechas la suben o bajan y
 *     Suprimir la quita.
 *
 * El toque y el arrastre conviven en el mismo `pointerdown`: no se
 * arrastra hasta que el puntero se movió unos píxeles, así que un toque
 * torpe sigue siendo un toque.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as PointerEventReact,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  IcoAvanzar,
  IcoEsperar,
  IcoRetroceder,
  IcoCosechar,
  IcoGirarDer,
  IcoGirarIzq,
  IcoMientras,
  IcoMineral,
  IcoNo,
  IcoPlantar,
  IcoRepetir,
  IcoSensorBorde,
  IcoSensorListo,
  IcoSensorVacia,
  IcoSi,
  IcoSiempre,
  IcoSino,
} from "./IconosAuto";
import { AJUSTES, MINERALES, type Mineral } from "../../data/automatizacion/balance";
import {
  buscarNodo,
  capacidadUsada,
  colocar,
  costoDeNodo,
  despuesDe,
  esContenedor,
  esRepetir,
  listaDeRama,
  ramas,
  type Destino,
  type NodoAccion,
  type NodoContenedor,
  type NodoPrograma,
  type Programa,
  type Rama,
  type Sensor,
  type TipoAccion,
} from "../../utils/automatizacion/programa";

/* ------------------------------------------------------------------ */
/* Colores y nombres                                                   */
/* ------------------------------------------------------------------ */

const COLOR: Record<TipoAccion, string> = {
  move_forward: "#4aa8f0",
  move_back: "#3d8fd4",
  turn_left: "#9b7cff",
  turn_right: "#9b7cff",
  harvest: "#f5b73c",
  plant: "#5cc98a",
  wait: "#8fa3c8",
};
/** El bloque de plantar va del color del mineral que planta. */
const COLOR_PLANTAR: Record<Mineral, string> = {
  punta: "#3fb8d6",
  racimo: "#a67cf5",
  prisma: "#ff6fb5",
  estrella: "#f0b429",
};
/** Los contenedores: los bucles en rosas, las decisiones en verdes. */
const COLOR_CONTENEDOR: Record<NodoContenedor["type"], string> = {
  repeat: "#ff8fc0",
  forever: "#f06aa8",
  while: "#2fb389",
  if: "#3fc79b",
};

const NOMBRE: Record<TipoAccion, string> = {
  move_forward: "Avanzar",
  move_back: "Retroceder",
  turn_left: "Girar a la izquierda",
  turn_right: "Girar a la derecha",
  harvest: "Cosechar",
  plant: "Plantar",
  wait: "Esperar",
};

export function nombreDe(nodo: NodoPrograma): string {
  if (nodo.type === "plant" && nodo.mineral) return `Plantar ${MINERALES[nodo.mineral].nombre.toLowerCase()}`;
  if (nodo.type === "repeat") return `Repetir ${nodo.times} veces`;
  if (nodo.type === "forever") return "Por siempre";
  if (nodo.type === "while") return `Mientras ${nombreSensor(nodo.sensor)}`;
  if (nodo.type === "if") return `Si ${nombreSensor(nodo.sensor)}${nodo.sino ? ", y si no" : ""}`;
  return NOMBRE[nodo.type];
}

export function nombreSensor(s: Sensor): string {
  const base =
    s.tipo === "listo"
      ? "está listo"
      : s.tipo === "vacia"
        ? "está vacía"
        : s.tipo === "borde"
          ? "hay borde adelante"
          : `es ${s.mineral ? MINERALES[s.mineral].nombre.toLowerCase() : "…"}`;
  return s.no ? `no ${base}` : base;
}

/** Lo que se puede sacar de la caja. */
export type Pieza =
  | TipoAccion
  | "repeat"
  | "forever"
  | "while"
  | "if"
  | "if_else"
  | `plant:${Mineral}`;

/** Un nodo nuevo a partir de una pieza de la caja. */
export function crearNodo(pieza: Pieza, id: string): NodoPrograma {
  if (pieza === "repeat") return { id, type: "repeat", times: AJUSTES.opcionesRepetir[0], body: [] };
  if (pieza === "forever") return { id, type: "forever", body: [] };
  if (pieza === "while") return { id, type: "while", sensor: { tipo: "listo", no: true }, body: [] };
  if (pieza === "if") return { id, type: "if", sensor: { tipo: "listo" }, body: [] };
  if (pieza === "if_else") return { id, type: "if", sensor: { tipo: "listo" }, body: [], sino: [] };
  if (pieza.startsWith("plant:")) return { id, type: "plant", mineral: pieza.slice(6) as Mineral };
  return { id, type: pieza as TipoAccion };
}

function Dibujo({ tipo }: { tipo: TipoAccion }) {
  if (tipo === "move_forward") return <IcoAvanzar />;
  if (tipo === "move_back") return <IcoRetroceder />;
  if (tipo === "turn_left") return <IcoGirarIzq />;
  if (tipo === "turn_right") return <IcoGirarDer />;
  if (tipo === "plant") return <IcoPlantar />;
  if (tipo === "wait") return <IcoEsperar />;
  return <IcoCosechar />;
}

function DibujoContenedor({ tipo, className }: { tipo: NodoContenedor["type"]; className?: string }) {
  if (tipo === "repeat") return <IcoRepetir className={className} />;
  if (tipo === "forever") return <IcoSiempre className={className} />;
  if (tipo === "while") return <IcoMientras className={className} />;
  return <IcoSi className={className} />;
}

function DibujoSensor({ sensor }: { sensor: Sensor }) {
  return (
    <span className="auto-sensor__dibujo">
      {sensor.tipo === "listo" && <IcoSensorListo />}
      {sensor.tipo === "vacia" && <IcoSensorVacia />}
      {sensor.tipo === "borde" && <IcoSensorBorde />}
      {sensor.tipo === "es" && sensor.mineral && <IcoMineral mineral={sensor.mineral} />}
      {sensor.no && <IcoNo className="auto-sensor__no" />}
    </span>
  );
}

function colorDe(nodo: NodoPrograma): string {
  if (esContenedor(nodo)) return COLOR_CONTENEDOR[nodo.type];
  if (nodo.type === "plant" && nodo.mineral) return COLOR_PLANTAR[nodo.mineral];
  return COLOR[nodo.type];
}

/** La pieza que se arrastra desde la caja todavía no existe en el
 *  programa: esto es lo que el fantasma dibuja hasta que se suelta. */
function nodoDeMuestra(pieza: Pieza): NodoPrograma {
  return crearNodo(pieza, "fantasma");
}

/** Umbral en píxeles antes de que un toque se convierta en arrastre. */
const UMBRAL_ARRASTRE = 7;

type Origen = { desde: "caja"; tipo: Pieza } | { desde: "libreta"; id: string };

interface Arrastre {
  origen: Origen;
  nodo: NodoPrograma;
  /** Posición del puntero. */
  x: number;
  y: number;
  /** Dónde se agarró la pieza, medido desde su esquina: el fantasma se
   *  dibuja con ese mismo desfase para que no salte al levantarse. */
  dx: number;
  dy: number;
  ancho: number;
}

/** A dónde caería la pieza: un destino, `null` (fuera de la libreta) o
 *  "nocabe" (adentro, pero donde el anidamiento no lo permite). */
type DestinoEditor = Destino | { tipo: "nocabe" } | null;

export interface PiezasDeControl {
  esperar: boolean;
  si: boolean;
  sino: boolean;
  mientras: boolean;
  siempre: boolean;
}

interface Props {
  programa: Programa;
  capacidad: number;
  tieneRepetir: boolean;
  piezas: PiezasDeControl;
  /** Qué minerales tienen bloque de plantar hoy (los que la isla ya permite). */
  plantables: Mineral[];
  corriendo: boolean;
  nodoActivo: string | null;
  onAgregar: (pieza: Pieza, destino?: Destino) => void;
  onQuitar: (id: string) => void;
  onMover: (id: string, destino: Destino) => void;
  onDesplazar: (id: string, delta: -1 | 1) => void;
  onCambiarVeces: (id: string) => void;
  onCambiarSensor: (id: string) => void;
}

const mismoDestino = (a: DestinoEditor, b: DestinoEditor) =>
  a?.tipo === b?.tipo &&
  (a?.tipo === "final" ||
    a?.tipo === "nocabe" ||
    ((a as { id?: string }).id === (b as { id?: string }).id &&
      ((a as { rama?: Rama }).rama ?? "body") === ((b as { rama?: Rama }).rama ?? "body")));

export function EditorBloques(props: Props) {
  const {
    programa,
    capacidad,
    tieneRepetir,
    piezas: compradas,
    plantables,
    corriendo,
    nodoActivo,
    onQuitar,
    onCambiarVeces,
    onCambiarSensor,
  } = props;
  const usada = capacidadUsada(programa);

  /* Los oyentes del arrastre viven en `window` y se registran una sola
     vez por gesto, así que leen las props por una referencia y no por
     cierre: si no, un arrastre largo soltaría sobre un programa viejo. */
  const propsRef = useRef(props);
  propsRef.current = props;

  const lienzoRef = useRef<HTMLDivElement>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [destino, setDestino] = useState<DestinoEditor>(null);
  const arrastreRef = useRef<Arrastre | null>(null);
  const destinoRef = useRef<DestinoEditor>(null);
  const pendiente = useRef<{ origen: Origen; x0: number; y0: number; dx: number; dy: number; ancho: number } | null>(
    null,
  );
  /* Después de un arrastre el navegador igual dispara `click` sobre la
     pieza de origen, y ese click sería "quitar". Se traga uno. */
  const ignorarClick = useRef(false);

  const [sacudida, setSacudida] = useState(false);
  const sacudidaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sacudir = useCallback(() => {
    setSacudida(true);
    if (sacudidaTimer.current) clearTimeout(sacudidaTimer.current);
    sacudidaTimer.current = setTimeout(() => setSacudida(false), 450);
  }, []);

  const entra = useCallback(
    (costo: number) => capacidadUsada(propsRef.current.programa) + costo <= propsRef.current.capacidad,
    [],
  );

  /* ---------------- el arrastre ---------------- */

  const calcularDestino = useCallback((x: number, y: number, a: Arrastre): DestinoEditor => {
    const lienzo = lienzoRef.current;
    if (!lienzo) return null;
    const L = lienzo.getBoundingClientRect();
    if (x < L.left || x > L.right || y < L.top || y > L.bottom) return null;

    /* Sobre el hueco que ya se abrió, el destino no cambia: abrir el
       hueco corre los bloques de abajo, y sin esta regla el puntero
       quedaría alternando entre "antes" y "después" veinte veces por
       segundo. */
    const marca = lienzo.querySelector("[data-marca]");
    if (marca && dentroDe(marca.getBoundingClientRect(), x, y)) return destinoRef.current;

    const prog = propsRef.current.programa;
    const excluido = (el: Element) => el.closest("[data-levantado]") !== null;
    const rectDe = (id: string) =>
      lienzo.querySelector(`[data-nodo="${id}"]`)?.getBoundingClientRect() ?? null;

    /* ¿Cabe ahí? Si el anidamiento no lo permite, no se abre hueco y
       soltar no hace nada — pero tampoco se quita la pieza. */
    const conCabida = (d: Destino): DestinoEditor => {
      if (d.tipo === "final") return d;
      if (a.origen.desde === "libreta") {
        // Al mover, la pieza ya no ocupa su lugar: se mide sin ella.
        const sinElla = prog; // profundidad del destino no depende de la pieza que se mueve
        return colocar(sinElla, a.nodo, d) === sinElla && !esMismoLugar(d) ? { tipo: "nocabe" } : d;
      }
      return colocar(prog, a.nodo, d) === prog ? { tipo: "nocabe" } : d;
    };
    const esMismoLugar = (d: Destino) => {
      if (a.origen.desde !== "libreta") return false;
      const id = a.origen.id;
      return mismoDestino(d, despuesDe(prog, id)) || (d.tipo === "antes" && d.id === id);
    };

    // 1 · las acciones (también las que están adentro de un contenedor)
    for (const el of lienzo.querySelectorAll<HTMLElement>('[data-clase="accion"]')) {
      if (excluido(el)) continue;
      const r = el.getBoundingClientRect();
      if (y < r.top || y > r.bottom || x < r.left - 40) continue;
      const id = el.dataset.nodo!;
      return conCabida(y < (r.top + r.bottom) / 2 ? { tipo: "antes", id } : despuesDe(prog, id));
    }

    // 2 · los contenedores: lomo, cavidades y brazos dicen cosas distintas.
    //     Los más hondos primero, para que una cavidad anidada gane.
    const contenedores = [...lienzo.querySelectorAll<HTMLElement>('[data-clase="contenedor"]')]
      .filter((el) => !excluido(el))
      .sort((p, q) => Number(q.dataset.nivel ?? 0) - Number(p.dataset.nivel ?? 0));
    for (const el of contenedores) {
      const r = el.getBoundingClientRect();
      if (y < r.top || y > r.bottom || x < r.left - 40) continue;
      const id = el.dataset.nodo!;
      const nodo = buscarNodo(prog, id);
      if (!nodo || !esContenedor(nodo)) continue;
      const parte = (p: string) => el.querySelector(`:scope > [data-parte="${p}"], :scope > * > [data-parte="${p}"]`);
      const lomo = parte("lomo")!.getBoundingClientRect();
      const brazo = parte("brazo")!.getBoundingClientRect();
      const brazoMedio = parte("brazo-medio")?.getBoundingClientRect();
      const inicioDe = (rama: Rama): Destino => {
        const primero = listaDeRama(nodo, rama)[0];
        return primero ? { tipo: "antes", id: primero.id } : { tipo: "dentro", id, rama };
      };
      if (y <= lomo.bottom) {
        return conCabida(y < (lomo.top + lomo.bottom) / 2 ? { tipo: "antes", id } : inicioDe("body"));
      }
      if (y >= brazo.top) return conCabida(despuesDe(prog, id));
      if (brazoMedio) {
        if (y < brazoMedio.top) return conCabida({ tipo: "dentro", id, rama: "body" });
        if (y <= brazoMedio.bottom) return conCabida(inicioDe("sino"));
        return conCabida({ tipo: "dentro", id, rama: "sino" });
      }
      return conCabida({ tipo: "dentro", id, rama: "body" });
    }

    // 3 · por encima de todo, o por debajo de todo
    const primero = prog.find((n) => !(a.origen.desde === "libreta" && n.id === a.origen.id));
    if (primero) {
      const r = rectDe(primero.id);
      if (r && y < r.top) return conCabida({ tipo: "antes", id: primero.id });
    }
    return { tipo: "final" };
  }, []);

  const limpiar = useCallback(() => {
    pendiente.current = null;
    arrastreRef.current = null;
    destinoRef.current = null;
    setArrastre(null);
    setDestino(null);
    window.removeEventListener("pointermove", alMover);
    window.removeEventListener("pointerup", alSoltar);
    window.removeEventListener("pointercancel", alCancelar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alMover = useCallback(
    (ev: PointerEvent) => {
      const p = pendiente.current;
      if (!p) return;
      let a = arrastreRef.current;
      if (!a) {
        if (Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) < UMBRAL_ARRASTRE) return;
        ignorarClick.current = true;
        const nodo =
          p.origen.desde === "caja"
            ? nodoDeMuestra(p.origen.tipo)
            : buscarNodo(propsRef.current.programa, p.origen.id);
        if (!nodo) {
          limpiar();
          return;
        }
        a = { origen: p.origen, nodo, x: ev.clientX, y: ev.clientY, dx: p.dx, dy: p.dy, ancho: p.ancho };
      } else {
        a = { ...a, x: ev.clientX, y: ev.clientY };
      }
      arrastreRef.current = a;
      setArrastre(a);
      const d = calcularDestino(ev.clientX, ev.clientY, a);
      destinoRef.current = d;
      setDestino(d);
      ev.preventDefault();
    },
    [calcularDestino, limpiar],
  );

  const alSoltar = useCallback(() => {
    const a = arrastreRef.current;
    const d = destinoRef.current;
    limpiar();
    if (!a) return; // fue un toque: el `click` se encarga
    const { onAgregar, onMover, onQuitar: quitar } = propsRef.current;
    if (d && d.tipo === "nocabe") {
      // Donde no cabe no pasa nada: la pieza vuelve a donde estaba.
    } else if (a.origen.desde === "caja") {
      if (d) onAgregar(a.origen.tipo, d);
    } else if (d) {
      onMover(a.origen.id, d);
    } else {
      quitar(a.origen.id); // soltar fuera de la libreta devuelve la pieza a la caja
    }
    // El `click` que sigue al `pointerup` llega en la misma vuelta; si no
    // llega (soltó sobre otro elemento), el permiso se limpia igual.
    setTimeout(() => {
      ignorarClick.current = false;
    }, 0);
  }, [limpiar]);

  const alCancelar = useCallback(() => {
    limpiar();
    ignorarClick.current = false;
  }, [limpiar]);

  const agarrar = useCallback(
    (ev: PointerEventReact<HTMLElement>, origen: Origen) => {
      if (propsRef.current.corriendo || ev.button !== 0) return;
      // El lomo de un contenedor es asa, pero sus botones (el número, el sensor, la ×) no.
      if (!ev.currentTarget.matches("button") && (ev.target as HTMLElement).closest("button")) return;
      // Sin memoria no se levanta nada: el toque va a sacudir las luces.
      if (origen.desde === "caja" && !entra(costoDeNodo(nodoDeMuestra(origen.tipo)))) return;
      const r = ev.currentTarget.getBoundingClientRect();
      pendiente.current = {
        origen,
        x0: ev.clientX,
        y0: ev.clientY,
        dx: ev.clientX - r.left,
        dy: ev.clientY - r.top,
        ancho: r.width,
      };
      window.addEventListener("pointermove", alMover);
      window.addEventListener("pointerup", alSoltar);
      window.addEventListener("pointercancel", alCancelar);
    },
    [alCancelar, alMover, alSoltar, entra],
  );

  useEffect(
    () => () => {
      limpiar();
      if (sacudidaTimer.current) clearTimeout(sacudidaTimer.current);
    },
    [limpiar],
  );

  /** Un `click` que viene justo después de un arrastre no es un toque. */
  const alClick = (fn: () => void) => () => {
    if (ignorarClick.current) {
      ignorarClick.current = false;
      return;
    }
    fn();
  };

  const intentarAgregar = (pieza: Pieza) => {
    if (!entra(costoDeNodo(nodoDeMuestra(pieza)))) {
      sacudir();
      return;
    }
    props.onAgregar(pieza);
  };

  const teclas = (id: string) => (ev: KeyboardEvent) => {
    if (corriendo) return;
    if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
      ev.preventDefault();
      props.onDesplazar(id, ev.key === "ArrowUp" ? -1 : 1);
    } else if (ev.key === "Delete" || ev.key === "Backspace") {
      ev.preventDefault();
      onQuitar(id);
    }
  };

  /* ---------------- dónde se abre el hueco ---------------- */

  /* Si la pieza que se mueve ya está donde se la va a soltar, no se abre
     ningún hueco: "antes de sí misma" y "después de sí misma" son el
     mismo renglón. Donde no cabe, tampoco. */
  let destinoVisible: Destino | null = destino && destino.tipo !== "nocabe" ? destino : null;
  if (arrastre?.origen.desde === "libreta" && destinoVisible) {
    const id = arrastre.origen.id;
    const aqui = despuesDe(programa, id);
    if (mismoDestino(destinoVisible, aqui) || (destinoVisible.tipo === "antes" && destinoVisible.id === id)) {
      destinoVisible = null;
    }
  }

  const marca = arrastre ? (
    <div
      key="marca"
      className={`auto-bloque auto-bloque--marca${esContenedor(arrastre.nodo) ? " auto-bloque--marca-ancha" : ""}`}
      data-marca=""
      style={{ "--auto-color": colorDe(arrastre.nodo) } as CSSProperties}
      aria-hidden="true"
    />
  ) : null;

  const marcaEn = (contenedor: string | null, rama: Rama): boolean =>
    !!destinoVisible &&
    ((contenedor === null && destinoVisible.tipo === "final") ||
      (contenedor !== null &&
        destinoVisible.tipo === "dentro" &&
        destinoVisible.id === contenedor &&
        (destinoVisible.rama ?? "body") === rama));

  /* ---------------- dibujar la libreta ---------------- */

  /** Funciones que devuelven JSX, no componentes definidos adentro del
   *  render: un componente creado en cada render es un tipo NUEVO para
   *  React, que desmonta y vuelve a montar todos los bloques —y con
   *  ellos el foco del teclado y la animación del bloque activo.
   *
   *  Por la misma razón cada entrada lleva de clave el id de su nodo (y
   *  el hueco, la suya): con claves por posición, subir un bloque con la
   *  flecha lo remontaba y el foco se perdía en el primer movimiento. */
  function dibujarLista(nodos: NodoPrograma[], contenedor: string | null, rama: Rama, nivel: number, estatico: boolean): ReactNode[] {
    const salida: ReactNode[] = [];
    for (const n of nodos) {
      if (!estatico && destinoVisible?.tipo === "antes" && destinoVisible.id === n.id) salida.push(marca);
      salida.push(dibujarNodo(n, nivel, estatico));
    }
    if (!estatico && marcaEn(contenedor, rama)) salida.push(marca);
    return salida;
  }

  function dibujarCavidad(nodo: NodoContenedor, rama: Rama, nivel: number, estatico: boolean): ReactNode {
    const lista = listaDeRama(nodo, rama);
    return (
      <div className="auto-repetir__cuerpo">
        <div className="auto-repetir__espina" />
        <div className="auto-repetir__cavidad" data-parte="cavidad" data-rama={rama}>
          {dibujarLista(lista, nodo.id, rama, nivel + 1, estatico)}
          {lista.length === 0 && !(!estatico && marcaEn(nodo.id, rama)) && (
            <div className="auto-hueco auto-hueco--cavidad" />
          )}
        </div>
      </div>
    );
  }

  function dibujarNodo(nodo: NodoPrograma, nivel: number, estatico: boolean): ReactNode {
    const levantado = !estatico && arrastre?.origen.desde === "libreta" && arrastre.origen.id === nodo.id;
    const activo = !estatico && nodoActivo === nodo.id;

    if (esContenedor(nodo)) {
      const asa = estatico ? undefined : (ev: PointerEventReact<HTMLElement>) => agarrar(ev, { desde: "libreta", id: nodo.id });
      return (
        <div
          key={nodo.id}
          className={`auto-repetir${levantado ? " auto-repetir--levantado" : ""}${activo ? " auto-repetir--activo" : ""}`}
          style={{ "--auto-tono": COLOR_CONTENEDOR[nodo.type] } as CSSProperties}
          data-nodo={estatico ? undefined : nodo.id}
          data-clase={estatico ? undefined : "contenedor"}
          data-nivel={nivel}
          data-levantado={levantado ? "" : undefined}
        >
          <div className="auto-repetir__lomo" data-parte="lomo" onPointerDown={asa}>
            {/* El Por siempre lleva su dibujo en el asidero de teclado; los
                demás, suelto en el lomo. Un solo ∞, no dos. */}
            {(nodo.type !== "forever" || estatico) && (
              <DibujoContenedor tipo={nodo.type} className="w-[26px] h-[26px]" />
            )}
            {esRepetir(nodo) &&
              (estatico ? (
                <span className="auto-repetir__veces">{nodo.times}</span>
              ) : (
                <button
                  type="button"
                  className="auto-repetir__veces"
                  disabled={corriendo}
                  onClick={alClick(() => onCambiarVeces(nodo.id))}
                  onKeyDown={teclas(nodo.id)}
                  aria-label={`Repetir ${nodo.times} veces. Tocar para cambiar; flechas para mover el bloque`}
                >
                  {nodo.times}
                </button>
              ))}
            {(nodo.type === "while" || nodo.type === "if") &&
              (estatico ? (
                <span className="auto-sensor">
                  <DibujoSensor sensor={nodo.sensor} />
                </span>
              ) : (
                <button
                  type="button"
                  className="auto-sensor"
                  disabled={corriendo}
                  onClick={alClick(() => onCambiarSensor(nodo.id))}
                  onKeyDown={teclas(nodo.id)}
                  aria-label={`${nombreSensor(nodo.sensor)}. Tocar para cambiar el sensor; flechas para mover el bloque`}
                >
                  <DibujoSensor sensor={nodo.sensor} />
                </button>
              ))}
            {nodo.type === "forever" && !estatico && (
              <button
                type="button"
                className="auto-repetir__asidero"
                disabled={corriendo}
                onKeyDown={teclas(nodo.id)}
                aria-label="Por siempre. Flechas para mover el bloque"
              >
                <IcoSiempre className="w-[26px] h-[26px]" />
              </button>
            )}
            {!estatico && (
              <button
                type="button"
                className="auto-repetir__quitar"
                disabled={corriendo}
                onClick={alClick(() => onQuitar(nodo.id))}
                aria-label={`Quitar el bloque ${nombreDe(nodo).toLowerCase()}`}
              >
                ×
              </button>
            )}
          </div>
          {dibujarCavidad(nodo, "body", nivel, estatico)}
          {nodo.type === "if" && nodo.sino && (
            <>
              <div className="auto-repetir__brazo auto-repetir__brazo--medio" data-parte="brazo-medio" onPointerDown={asa}>
                <IcoSino className="w-[20px] h-[20px] opacity-90" />
              </div>
              {dibujarCavidad(nodo, "sino", nivel, estatico)}
            </>
          )}
          <div className="auto-repetir__brazo" data-parte="brazo" onPointerDown={asa}>
            <DibujoContenedor tipo={nodo.type} className="w-[18px] h-[18px] opacity-80" />
          </div>
        </div>
      );
    }

    const accion = nodo as NodoAccion;
    const clase = `auto-bloque${activo ? " auto-bloque--activo" : ""}${levantado ? " auto-bloque--levantado" : ""}`;
    const estilo = { "--auto-color": colorDe(accion) } as CSSProperties;
    if (estatico) {
      return (
        <div key={accion.id} className={clase} style={estilo}>
          <Dibujo tipo={accion.type} />
        </div>
      );
    }
    return (
      <button
        key={accion.id}
        type="button"
        className={clase}
        style={estilo}
        data-nodo={accion.id}
        data-clase="accion"
        disabled={corriendo}
        onPointerDown={(ev) => agarrar(ev, { desde: "libreta", id: accion.id })}
        onClick={alClick(() => onQuitar(accion.id))}
        onKeyDown={teclas(accion.id)}
        aria-label={`${nombreDe(accion)}. Tocar para quitar; flechas para mover`}
      >
        <Dibujo tipo={accion.type} />
      </button>
    );
  }

  /* La caja: acciones, plantar por mineral, y los controles comprados. */
  const piezas: Pieza[] = [
    "move_forward",
    "move_back",
    "turn_left",
    "turn_right",
    "harvest",
    ...plantables.map((m) => `plant:${m}` as const),
    ...(compradas.esperar ? (["wait"] as const) : []),
    ...(tieneRepetir ? (["repeat"] as const) : []),
    ...(compradas.si ? (["if"] as const) : []),
    ...(compradas.sino ? (["if_else"] as const) : []),
    ...(compradas.mientras ? (["while"] as const) : []),
    ...(compradas.siempre ? (["forever"] as const) : []),
  ];

  const huecoFinal = usada < capacidad && !(destinoVisible?.tipo === "final");

  return (
    <section className="auto-taller auto-vidrio" aria-label="Taller de programación">
      {/* La caja de piezas. Con más de siete, dos columnas: que se vean
          todas sin desplazar. */}
      <div className={`auto-caja${piezas.length > 7 ? " auto-caja--doble" : ""}`}>
        {piezas.map((p) => {
          const muestra = nodoDeMuestra(p);
          return (
            <button
              key={p}
              type="button"
              className={`auto-bloque${esContenedor(muestra) ? " auto-bloque--control" : ""}`}
              style={{ "--auto-color": colorDe(muestra) } as CSSProperties}
              disabled={corriendo}
              onPointerDown={(ev) => agarrar(ev, { desde: "caja", tipo: p })}
              onClick={alClick(() => intentarAgregar(p))}
              aria-label={`Agregar ${nombreDe(muestra).toLowerCase()}`}
            >
              {esContenedor(muestra) ? (
                <>
                  <DibujoContenedor tipo={muestra.type} />
                  {muestra.type === "if" && muestra.sino && <IcoSino className="auto-bloque__extra" />}
                </>
              ) : (
                <Dibujo tipo={muestra.type} />
              )}
            </button>
          );
        })}
      </div>

      {/* La libreta */}
      <div
        ref={lienzoRef}
        className={`auto-lienzo${arrastre ? " auto-lienzo--recibiendo" : ""}`}
      >
        {/* La memoria: luces, no un número. Es la misma hilera que dibuja
            la mejora "más memoria", así el chico liga las dos. */}
        <div
          className={`auto-memoria${sacudida ? " auto-memoria--llena" : ""}`}
          role="img"
          aria-label={`Memoria: ${usada} de ${capacidad}`}
        >
          {Array.from({ length: capacidad }, (_, i) => (
            <span key={i} className={`auto-luz${i < usada ? " auto-luz--on" : ""}`} />
          ))}
        </div>

        <div className="auto-pila">
          {dibujarLista(programa, null, "body", 0, false)}
          {huecoFinal && <div className="auto-hueco" />}
        </div>

        {programa.length === 0 && !arrastre && (
          <p className="auto-lienzo__pista">Tocá una pieza, o arrastrala hasta acá.</p>
        )}
      </div>

      {/* El fantasma: la pieza levantada, siguiendo al puntero. Va en un
          portal porque el taller tiene `backdrop-filter` y los bloques
          `filter`, y cualquiera de los dos convierte `position: fixed`
          en relativo a ellos. */}
      {arrastre &&
        createPortal(
          <div
            className="auto-fantasma"
            style={{
              left: arrastre.x - arrastre.dx,
              top: arrastre.y - arrastre.dy,
              width: esContenedor(arrastre.nodo) ? undefined : arrastre.ancho,
            }}
            aria-hidden="true"
          >
            {dibujarNodo(arrastre.nodo, 0, true)}
          </div>,
          document.body,
        )}
    </section>
  );
}

function dentroDe(r: DOMRect, x: number, y: number): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/** Cuántas ramas tiene un contenedor, para quien quiera contarlas. */
export const ramasDe = ramas;

export const OPCIONES_REPETIR = AJUSTES.opcionesRepetir;
