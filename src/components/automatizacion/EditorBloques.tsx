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
 *   - TOCAR: en la caja agrega al final de la cadena verde; en el
 *     lienzo quita ese bloque (la cadena se vuelve a unir).
 *   - ARRASTRAR: sacar una pieza de la caja o agarrar un bloque puesto
 *     —y con él, todo lo que cuelga debajo (`cortarEn`, programa.ts)—
 *     y soltarlo donde va. Con Pointer Events y no con el
 *     drag-and-drop de HTML5, porque ése no anda con el dedo, y las
 *     Chromebook del aula son táctiles. Mientras se arrastra, la cadena
 *     se LEVANTA (un fantasma que la sigue al puntero) y cerca de un
 *     conector se abre UN HUECO del color de la pieza (encastre); lejos
 *     de todo conector se ve un CONTORNO punteado (`.auto-contorno`):
 *     ahí va a caer como pila nueva, suelta. Soltar en el vacío del
 *     lienzo NUNCA borra (Lienzo, decisión #6, design.md) — eso es
 *     justamente el gesto normal de dejar algo en un lugar vacío.
 *     Borrar es un acto aparte: el tachito o la paleta (Fase 3). Donde
 *     no cabe (el tope de anidamiento) no se abre hueco ni contorno y
 *     soltar no hace nada.
 *   - TECLADO: con el foco en una pieza, las flechas la suben o bajan
 *     dentro de su propia pila y Suprimir la quita.
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
  IcoContadorCero,
  IcoContadorMas,
  IcoEsperar,
  IcoInicio,
  IcoRecentrar,
  IcoRetroceder,
  IcoCosechar,
  IcoGirarDer,
  IcoGirarIzq,
  IcoHacer,
  IcoMientras,
  IcoMineral,
  IcoNo,
  IcoPlantar,
  IcoRepetir,
  IcoRutina,
  IcoSensorBorde,
  IcoSensorContador,
  IcoSensorListo,
  IcoSensorVacia,
  IcoSi,
  IcoSiempre,
  IcoSino,
  IcoTamanoCampo,
} from "./IconosAuto";
import { AJUSTES, MINERALES, type Mineral } from "../../data/automatizacion/balance";
import {
  buscarNodo,
  cabeA,
  capacidadDeLienzo,
  contiene,
  cortarEn,
  costoDeNodo,
  despuesDe,
  esContenedor,
  esRepetir,
  listaDeRama,
  profundidadDe,
  ramas,
  rutinasDe,
  RUTINAS,
  type Destino,
  type NodoAccion,
  type NodoCall,
  type NodoContenedor,
  type NodoDef,
  type NodoMientras,
  type NodoPrograma,
  type NodoRepetir,
  type NodoSi,
  type NombreRutina,
  type Programa,
  type Rama,
  type Sensor,
  type TipoAccion,
  type TipoContador,
  type Veces,
} from "../../utils/automatizacion/programa";
import { puntoRutinaPorDefecto, type Lienzo, type Pila, type Punto } from "../../utils/automatizacion/motor";

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
/** Los contenedores: los bucles en rosas, las decisiones en verdes.
 *  `def` usa el violeta de la rutina A como respaldo — `colorDe` lo pisa
 *  con el color de la letra que le toque a cada bloque en concreto. */
const COLOR_CONTENEDOR: Record<NodoContenedor["type"], string> = {
  repeat: "#ff8fc0",
  forever: "#f06aa8",
  while: "#2fb389",
  if: "#3fc79b",
  def: "#7c71ff",
};

/** Cada rutina tiene su propio violeta (CLAUDE.md §5, familia
 *  eléctrico/violeta): la letra la nombra, el color la hace reconocible
 *  de un vistazo entre `Mi rutina` y su `Hacer` correspondiente. */
const COLOR_LLAMADA: Record<NombreRutina, string> = {
  A: "#7c71ff",
  B: "#9b7cff",
  C: "#5932d4",
};

/** El contador: turquesa para sumar, azul eléctrico para reiniciar — la
 *  misma familia que `IcoProduccion`, así se lee como parte del HUD de
 *  números y no como una pieza de control más. */
const COLOR_CONTADOR: Record<TipoContador, string> = {
  counter_add: "#22c7b8",
  counter_reset: "#3159e8",
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

/** Cómo se lee un valor de `Veces`: el número tal cual, o "el tamaño del
 *  campo" cuando es `"lado"` — nunca un dígito para ese caso. */
function nombreVeces(v: Veces): string {
  return v === "lado" ? "el tamaño del campo" : String(v);
}

export function nombreDe(nodo: NodoPrograma): string {
  if (nodo.type === "plant" && nodo.mineral) return `Plantar ${MINERALES[nodo.mineral].nombre.toLowerCase()}`;
  if (nodo.type === "repeat") return `Repetir ${nombreVeces(nodo.times)} veces`;
  if (nodo.type === "forever") return "Por siempre";
  if (nodo.type === "while") return `Mientras ${nombreSensor(nodo.sensor)}`;
  if (nodo.type === "if") return `Si ${nombreSensor(nodo.sensor)}${nodo.sino ? ", y si no" : ""}`;
  if (nodo.type === "def") return `Mi rutina ${nodo.rutina}`;
  if (nodo.type === "call") {
    if (nodo.veces === undefined) return `Hacer ${nodo.rutina}`;
    return `Hacer ${nodo.rutina} con ${nombreVeces(nodo.veces)}${nodo.veces === "lado" ? "" : " veces"}`;
  }
  if (nodo.type === "counter_add") return "Contador +1";
  if (nodo.type === "counter_reset") return "Contador = 0";
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
          : s.tipo === "contador"
            ? `el contador es ${nombreVeces(s.valor ?? 0)}`
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
  | `plant:${Mineral}`
  | `def:${NombreRutina}`
  | `call:${NombreRutina}`
  | `hacer_con:${NombreRutina}`
  | TipoContador;

/** Un nodo nuevo a partir de una pieza de la caja. */
export function crearNodo(pieza: Pieza, id: string): NodoPrograma {
  if (pieza === "repeat") return { id, type: "repeat", times: AJUSTES.opcionesRepetir[0], body: [] };
  if (pieza === "forever") return { id, type: "forever", body: [] };
  if (pieza === "while") return { id, type: "while", sensor: { tipo: "listo", no: true }, body: [] };
  if (pieza === "if") return { id, type: "if", sensor: { tipo: "listo" }, body: [] };
  if (pieza === "if_else") return { id, type: "if", sensor: { tipo: "listo" }, body: [], sino: [] };
  if (pieza === "counter_add" || pieza === "counter_reset") return { id, type: pieza };
  if (pieza.startsWith("plant:")) return { id, type: "plant", mineral: pieza.slice(6) as Mineral };
  if (pieza.startsWith("def:")) return { id, type: "def", rutina: pieza.slice(4) as NombreRutina, body: [] };
  if (pieza.startsWith("hacer_con:"))
    return { id, type: "call", rutina: pieza.slice(10) as NombreRutina, veces: AJUSTES.opcionesRepetir[0] };
  if (pieza.startsWith("call:")) return { id, type: "call", rutina: pieza.slice(5) as NombreRutina };
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

function DibujoContador({ tipo }: { tipo: TipoContador }) {
  return tipo === "counter_add" ? <IcoContadorMas /> : <IcoContadorCero />;
}

function DibujoContenedor({ tipo, className }: { tipo: NodoContenedor["type"]; className?: string }) {
  if (tipo === "repeat") return <IcoRepetir className={className} />;
  if (tipo === "forever") return <IcoSiempre className={className} />;
  if (tipo === "while") return <IcoMientras className={className} />;
  if (tipo === "def") return <IcoRutina className={className} />;
  return <IcoSi className={className} />;
}

function DibujoSensor({ sensor }: { sensor: Sensor }) {
  return (
    <span className="auto-sensor__dibujo">
      {sensor.tipo === "listo" && <IcoSensorListo />}
      {sensor.tipo === "vacia" && <IcoSensorVacia />}
      {sensor.tipo === "borde" && <IcoSensorBorde />}
      {sensor.tipo === "es" && sensor.mineral && <IcoMineral mineral={sensor.mineral} />}
      {sensor.tipo === "contador" && <IcoSensorContador />}
      {sensor.no && <IcoNo className="auto-sensor__no" />}
    </span>
  );
}

function colorDe(nodo: NodoPrograma): string {
  if (nodo.type === "def" || nodo.type === "call") return COLOR_LLAMADA[nodo.rutina];
  if (nodo.type === "counter_add" || nodo.type === "counter_reset") return COLOR_CONTADOR[nodo.type];
  if (esContenedor(nodo)) return COLOR_CONTENEDOR[nodo.type];
  if (nodo.type === "plant" && nodo.mineral) return COLOR_PLANTAR[nodo.mineral];
  return COLOR[nodo.type];
}

/** El valor de una ranura numérica, tal cual se muestra: el dígito, o el
 *  glifo de `tamaño del campo` cuando es `"lado"` — nunca un dígito ahí. */
function ContenidoVeces({ valor }: { valor: Veces }) {
  return valor === "lado" ? <IcoTamanoCampo className="w-[22px] h-[22px]" /> : <>{valor}</>;
}

/** La pieza que se arrastra desde la caja todavía no existe en el
 *  programa: esto es lo que el fantasma dibuja hasta que se suelta. */
function nodoDeMuestra(pieza: Pieza): NodoPrograma {
  return crearNodo(pieza, "fantasma");
}

/** A qué PILA pertenece un bloque: la cadena verde, el cuerpo de una
 *  `Mi rutina` (por el id de su nodo `def`), o una pila suelta (por su
 *  propio id). `cortarEn`/`colocarCadena` (programa.ts) ya operan sobre
 *  cualquier `Programa`, así que ubicar la pila correcta es lo único que
 *  hace falta agregar para que agarrar, cortar y encastrar funcionen
 *  igual en las tres — design.md, "El `alSoltar` inversion". */
export type RefPila = { donde: "verde" } | { donde: "rutina"; id: string } | { donde: "suelta"; id: string };

/** Clave compacta de `RefPila`, para el atributo `data-pila` (el DOM sólo
 *  admite strings) y para comparar dos referencias por igualdad. */
function claveDePila(ref: RefPila): string {
  return ref.donde === "verde" ? "verde" : `${ref.donde}:${ref.id}`;
}
function refDeClave(clave: string): RefPila {
  if (clave === "verde") return { donde: "verde" };
  const i = clave.indexOf(":");
  const donde = clave.slice(0, i);
  const id = clave.slice(i + 1);
  return donde === "rutina" ? { donde: "rutina", id } : { donde: "suelta", id };
}
const mismaClave = (a: RefPila, b: RefPila) => claveDePila(a) === claveDePila(b);

/** A dónde caería una cadena agarrada. Nunca es `null` (decisión #6,
 *  design.md): "sin destino" pasó a significar "cae como pila nueva",
 *  no "se borra". */
type DestinoLienzo =
  | { tipo: "cadena"; pila: RefPila; destino: Destino } // encastra en un conector
  | { tipo: "nueva"; x: number; y: number } // cae como pila suelta nueva
  | { tipo: "papelera" } // Fase 3 (tarea 3.1): hoy nada produce este destino
  | { tipo: "paleta" } // Fase 3 (tarea 3.2): ídem
  | { tipo: "nocabe" }; // hay conector cerca, pero el anidamiento no entra

/** Umbral en píxeles antes de que un toque se convierta en arrastre. */
const UMBRAL_ARRASTRE = 7;
/** Radio de encastre, en px de PANTALLA (ya transformados): qué tan cerca
 *  tiene que estar la esquina agarrada de un conector para que "cuente".
 *  Valor de partida de design.md, SIN validar en un Chromebook táctil
 *  todavía (open question: puede ser chico para el dedo, o grande y
 *  robarle el "cae como pila nueva" a un lugar vacío cercano). */
const RADIO_ENCASTRE = 28;

type Origen = { desde: "caja"; tipo: Pieza } | { desde: "lienzo"; ref: RefPila; id: string };

interface Arrastre {
  origen: Origen;
  /** El bloque agarrado y TODO lo que cuelga debajo (`cortarEn`): es lo
   *  que se mueve como una unidad, y lo que dibuja el fantasma. Con una
   *  pieza nueva de la caja es un array de un solo elemento. */
  cadena: NodoPrograma[];
  /** Posición del puntero. */
  x: number;
  y: number;
  /** Dónde se agarró la pieza, medido desde su esquina: el fantasma y el
   *  contorno fantasma se dibujan con ese mismo desfase para que no
   *  salten al levantarse. */
  dx: number;
  dy: number;
  ancho: number;
}

export interface PiezasDeControl {
  esperar: boolean;
  si: boolean;
  sino: boolean;
  mientras: boolean;
  siempre: boolean;
  rutinas: boolean;
  contador: boolean;
  hacerCon: boolean;
}

interface Props {
  /** La cadena que cuelga del bloque verde. Nativo (Lienzo, tarea 2b.5):
   *  el puente temporal de la tarea 1.9 que la fusionaba con `rutinas`
   *  para dibujar y volvía a separarla en cada edición ya no existe. */
  programa: Programa;
  /** Las `Mi rutina`: siempre raíz, siempre a todo color, nunca en la
   *  cadena verde ni en una pila suelta. */
  rutinas: readonly NodoDef[];
  /** Pilas sueltas del lienzo: atenuadas, no ejecutan, cuentan memoria. */
  pilasSueltas: readonly Pila[];
  /** Ancla del bloque verde y posición de cada `Mi rutina`. */
  lienzo: Lienzo;
  capacidad: number;
  tieneRepetir: boolean;
  piezas: PiezasDeControl;
  /** Qué minerales tienen bloque de plantar hoy (los que la isla ya permite). */
  plantables: Mineral[];
  corriendo: boolean;
  nodoActivo: string | null;
  /** Tocar en la caja: sin `pila`/`destino`, al final de la cadena verde
   *  (o adentro del último contenedor si está vacío). Arrastrar desde la
   *  caja hasta un conector: con los dos, ahí mismo. */
  onAgregar: (pieza: Pieza, pila?: RefPila, destino?: Destino) => void;
  onQuitar: (id: string) => void;
  onDesplazar: (id: string, delta: -1 | 1) => void;
  onCambiarVeces: (id: string) => void;
  onCambiarSensor: (id: string) => void;
  /** Corta la cadena de `id` en `origen` y la encastra en `destino`,
   *  adentro de `destinoPila` (puede ser la misma pila, para reordenar). */
  onMoverCadena: (origen: RefPila, id: string, destinoPila: RefPila, destino: Destino) => void;
  /** Corta la cadena de `id` en `origen` y la deja como pila suelta nueva
   *  en (x, y): el mismo id de pila no importa, los NODOS conservan el
   *  suyo (L15). */
  onSoltarCadena: (origen: RefPila, id: string, x: number, y: number) => void;
  /** Una pieza nueva de la caja, soltada en el vacío: nace como pila
   *  suelta de un solo bloque en (x, y). */
  onSoltarNueva: (pieza: Pieza, x: number, y: number) => void;
}

/** Tamaño del ancla verde: la cadena cuelga justo debajo, pegada. */
const ALTO_INICIO = 64;
/** Margen inicial de la vista: el ancla no queda pegada a la esquina. */
const MARGEN = 40;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 2.4;

export function EditorBloques(props: Props) {
  const {
    programa,
    rutinas,
    pilasSueltas,
    lienzo: datosLienzo,
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
  /* La memoria es de TODO el lienzo (PROGRESION.md §11): la cadena verde,
     las rutinas y las pilas sueltas — las tres nativas desde que se borró
     el puente temporal (tarea 2b.5). */
  const usada = capacidadDeLienzo(programa, rutinas, pilasSueltas);
  /* Qué letras ya tienen `Mi rutina` definida: mientras no la tengan se
     ofrece definirla, y una vez definida se ofrece llamarla — nunca las
     dos piezas juntas para la misma letra. */
  const rutinasDefinidas = rutinasDe(rutinas as NodoDef[]);

  /* Los oyentes del arrastre viven en `window` y se registran una sola
     vez por gesto, así que leen las props por una referencia y no por
     cierre: si no, un arrastre largo soltaría sobre un programa viejo. */
  const propsRef = useRef(props);
  propsRef.current = props;

  const lienzoRef = useRef<HTMLDivElement>(null);
  const capaRef = useRef<HTMLDivElement>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [destino, setDestino] = useState<DestinoLienzo | null>(null);
  const arrastreRef = useRef<Arrastre | null>(null);
  const destinoRef = useRef<DestinoLienzo | null>(null);
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

  /* ---------------- la ventana: acercar, alejar, recorrer ----------------
     `.auto-lienzo` es el VIEWPORT (tamaño fijo, `overflow:hidden`);
     `.auto-lienzo__capa` es la capa que lleva el transform y guarda
     coordenadas de DATOS. Origen `0 0` y no `center` (decisión #7,
     design.md): con `0 0` el punto (0,0) de esa capa es siempre su propia
     esquina superior izquierda, así que convertir pantalla→lienzo es sólo
     dividir por el zoom, sin restar la mitad del ancho. */
  const [vista, setVista] = useState({ z: 1, x: MARGEN, y: MARGEN });
  const vistaRef = useRef(vista);
  vistaRef.current = vista;
  const paneoRef = useRef<{ sx: number; sy: number; bx: number; by: number } | null>(null);
  const [hudRect, setHudRect] = useState<DOMRect | null>(null);

  /** Aplica un zoom nuevo dejando quieto el punto (sx, sy) de la pantalla:
   *  sin esto el zoom siempre tira hacia el origen y se pierde de vista lo
   *  que se estaba mirando. */
  const acercarEn = useCallback((nextZ: number | ((z: number) => number), sx?: number, sy?: number) => {
    setVista((v) => {
      const pedido = typeof nextZ === "function" ? nextZ(v.z) : nextZ;
      const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pedido));
      const capa = capaRef.current;
      if (!capa || z === v.z) return { ...v, z };
      const r = capa.getBoundingClientRect();
      const px = sx ?? r.left + r.width / 2;
      const py = sy ?? r.top + r.height / 2;
      // Punto de lienzo bajo el cursor, ANTES de aplicar el nuevo zoom.
      const lx = (px - r.left) / v.z;
      const ly = (py - r.top) / v.z;
      return { z, x: v.x - lx * (z - v.z), y: v.y - ly * (z - v.z) };
    });
  }, []);

  /** Vuelve a encuadrar el ancla del bloque verde: el recorte de decisión
   *  #9 (design.md) para no perderlo nunca de vista. */
  const recentrar = useCallback(() => setVista({ z: 1, x: MARGEN, y: MARGEN }), []);

  /* De pantalla a lienzo: dónde cae una pila nueva (tarea 2b.1) y dónde se
     dibuja su contorno fantasma (tarea 2b.2). `aPantalla` queda lista para
     cuando algo necesite la vuelta (hoy nada la usa: el contorno vive
     ADENTRO de `.auto-lienzo__capa`, en coordenadas de lienzo directas). */
  const aLienzo = useCallback((cx: number, cy: number): Punto | null => {
    const capa = capaRef.current;
    if (!capa) return null;
    const r = capa.getBoundingClientRect();
    return { x: (cx - r.left) / vistaRef.current.z, y: (cy - r.top) / vistaRef.current.z };
  }, []);
  const aPantalla = (p: Punto, r: DOMRect, z: number): Punto => ({ x: r.left + p.x * z, y: r.top + p.y * z });
  void aPantalla;

  /** ¿El evento salió de un panel del HUD? Portado a `document.body`
   *  (decisión #8): nunca es descendiente de la capa, pero el chequeo se
   *  mantiene por si algún día algo del HUD vuelve a vivir adentro. */
  const enHud = (t: EventTarget | null): boolean => t instanceof Element && !!t.closest("[data-hud]");

  /* Tocar el vacío del lienzo recorre; tocar un bloque lo arrastra — la
     misma disyuntiva que IslandDetailPage resuelve con `[data-level-node]`
     (CLAUDE.md §6.1/§6.2), acá con `[data-nodo]`. También se excluye
     cualquier `<button>`: en el sombrero de una `Mi rutina` (sin asa
     propia, `refPila=null`) la ranura, el sensor y la cruz de quitar
     siguen vivos, y sin este chequeo un toque ahí arrancaría un paneo a
     la vez que el click — en un dedo, ninguno de los dos llegaría entero. */
  const alBajarLienzo = useCallback((ev: PointerEventReact<HTMLDivElement>) => {
    if (propsRef.current.corriendo) return;
    if (enHud(ev.target)) return;
    if (ev.target instanceof Element && ev.target.closest("button, [data-nodo]")) return;
    ev.preventDefault();
    paneoRef.current = { sx: ev.clientX, sy: ev.clientY, bx: vistaRef.current.x, by: vistaRef.current.y };
  }, []);

  useEffect(() => {
    function alMoverPaneo(ev: PointerEvent) {
      const p = paneoRef.current;
      if (!p) return;
      setVista((v) => ({ ...v, x: p.bx + (ev.clientX - p.sx), y: p.by + (ev.clientY - p.sy) }));
    }
    function alSoltarPaneo() {
      paneoRef.current = null;
    }
    window.addEventListener("pointermove", alMoverPaneo);
    window.addEventListener("pointerup", alSoltarPaneo);
    window.addEventListener("pointercancel", alSoltarPaneo);
    return () => {
      window.removeEventListener("pointermove", alMoverPaneo);
      window.removeEventListener("pointerup", alSoltarPaneo);
      window.removeEventListener("pointercancel", alSoltarPaneo);
    };
  }, []);

  /* Rueda = zoom sobre el cursor. Nativo y no `onWheel` de React: React lo
     registra pasivo, y un listener pasivo no puede `preventDefault`. */
  useEffect(() => {
    const el = lienzoRef.current;
    if (!el) return;
    function alRodar(ev: WheelEvent) {
      if (propsRef.current.corriendo) return;
      if (enHud(ev.target)) return;
      ev.preventDefault();
      const paso = ev.deltaY < 0 ? 1.15 : 1 / 1.15;
      acercarEn((z) => z * paso, ev.clientX, ev.clientY);
    }
    el.addEventListener("wheel", alRodar, { passive: false });
    return () => el.removeEventListener("wheel", alRodar);
  }, [acercarEn]);

  /* Pellizco de dos dedos = zoom, centrado en el punto medio. */
  useEffect(() => {
    const el = lienzoRef.current;
    if (!el) return;
    let base: { dist: number; z: number } | null = null;
    const separacion = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    function alTocarPellizco(ev: TouchEvent) {
      if (propsRef.current.corriendo || ev.touches.length !== 2) return;
      base = { dist: separacion(ev.touches), z: vistaRef.current.z };
    }
    function alMoverPellizco(ev: TouchEvent) {
      if (!base || ev.touches.length !== 2) return;
      ev.preventDefault();
      const cx = (ev.touches[0].clientX + ev.touches[1].clientX) / 2;
      const cy = (ev.touches[0].clientY + ev.touches[1].clientY) / 2;
      acercarEn(base.z * (separacion(ev.touches) / base.dist), cx, cy);
    }
    function alSoltarPellizco(ev: TouchEvent) {
      if (ev.touches.length < 2) base = null;
    }
    el.addEventListener("touchstart", alTocarPellizco, { passive: true });
    el.addEventListener("touchmove", alMoverPellizco, { passive: false });
    el.addEventListener("touchend", alSoltarPellizco, { passive: true });
    return () => {
      el.removeEventListener("touchstart", alTocarPellizco);
      el.removeEventListener("touchmove", alMoverPellizco);
      el.removeEventListener("touchend", alSoltarPellizco);
    };
  }, [acercarEn]);

  /* El HUD (memoria, recentrar) va por un portal a `document.body`
   *  (decisión #8, MANDATORIO): `.auto-taller` lleva `backdrop-filter`, lo
   *  que vuelve `position: fixed` relativo A ÉL — la misma trampa que el
   *  fantasma ya esquiva. Se mide el viewport con un `ResizeObserver` en
   *  vez de escuchar sólo `resize`: acá el tamaño también cambia con la
   *  compra de mejoras que reflowan el layout, no sólo con la ventana. */
  useEffect(() => {
    const el = lienzoRef.current;
    if (!el) return;
    const medir = () => setHudRect(el.getBoundingClientRect());
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    window.addEventListener("resize", medir);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, []);

  /** Lista viva de una pila del lienzo, leída por referencia (siempre el
   *  valor MÁS RECIENTE de las props, nunca uno viejo capturado por
   *  cierre — el mismo motivo que `propsRef` existe). Una `Mi rutina` o
   *  una pila suelta que ya no está devuelve `[]`: nunca revienta, sólo
   *  no encuentra nada que cortar/colocar ahí. */
  const obtenerLista = useCallback((ref: RefPila): NodoPrograma[] => {
    const p = propsRef.current;
    if (ref.donde === "verde") return p.programa;
    if (ref.donde === "rutina") return p.rutinas.find((r) => r.id === ref.id)?.body ?? [];
    return p.pilasSueltas.find((pi) => pi.id === ref.id)?.nodos ?? [];
  }, []);

  const entra = useCallback((costo: number) => {
    const p = propsRef.current;
    return capacidadDeLienzo(p.programa, p.rutinas, p.pilasSueltas) + costo <= p.capacidad;
  }, []);

  /* ---------------- el arrastre ---------------- */

  /** ¿`id` está en la cadena agarrada, o adentro de una de sus cavidades?
   *  Encastrar sobre la propia cadena (o adentro de sí misma) rompería el
   *  árbol, así que esos conectores se descartan como candidatos. */
  const idDeDestino = (d: Destino): string | null => (d.tipo === "final" ? null : d.id);
  const tocaLaCadena = (cadena: NodoPrograma[], id: string | null): boolean =>
    id !== null && cadena.some((n) => n.id === id || contiene(n, id));

  /** La misma cuenta que el `profundidadDestino` privado de
   *  `colocarCadena` (programa.ts): a qué profundidad caería una cadena
   *  si se la suelta en `d`, sin tocar el árbol todavía — así se puede
   *  preguntarle a `cabeA` ANTES de intentar el encastre. */
  const profundidadParaDestino = (prog: NodoPrograma[], d: Destino): number | null => {
    if (d.tipo === "final") return 0;
    if (d.tipo === "antes") return profundidadDe(prog, d.id);
    const p = profundidadDe(prog, d.id);
    return p === null ? null : p + 1;
  };

  const calcularDestinoLienzo = useCallback(
    (cx: number, cy: number, a: Arrastre): DestinoLienzo => {
      const lienzo = lienzoRef.current;
      if (!lienzo) return { tipo: "nueva", x: 0, y: 0 };

      // 1 · papelera (tarea 3.1): sin `[data-papelera]` en el DOM todavía
      // este paso nunca encuentra nada — queda listo, no activo.
      const papelera = document.querySelector("[data-papelera]");
      if (papelera && dentroDe(papelera.getBoundingClientRect(), cx, cy)) return { tipo: "papelera" };
      // 2 · paleta (tarea 3.2): el hit-test contra `.auto-caja` llega en
      // Fase 3; hoy soltar ahí simplemente no encuentra conector y cae en
      // el paso 4 como pila nueva.

      // Sobre el hueco que ya se abrió, el destino no cambia: abrir el
      // hueco corre los bloques de abajo, y sin esta regla el puntero
      // quedaría alternando entre "antes" y "después" veinte veces por
      // segundo (la misma regla del 1D, sobrevive verbatim — design.md).
      const marcaAbierta = lienzo.querySelector("[data-marca]");
      if (marcaAbierta && dentroDe(marcaAbierta.getBoundingClientRect(), cx, cy)) {
        const anterior = destinoRef.current;
        if (anterior && anterior.tipo === "cadena") return anterior;
      }

      // 3 · proximidad de conectores, en cualquier pila del lienzo: la
      // cadena verde, el cuerpo de cada `Mi rutina` y cada pila suelta —
      // todas comparten el mismo escaneo porque todas llevan `data-pila`.
      const excluido = (el: Element) => el.closest("[data-levantado]") !== null;
      const px = cx - a.dx;
      const py = cy - a.dy;
      let mejorRef: RefPila | null = null;
      let mejorDestino: Destino | null = null;
      let mejorDist = RADIO_ENCASTRE;
      const ofrecer = (x: number, y: number, ref: RefPila, destino: Destino) => {
        if (a.origen.desde === "lienzo" && mismaClave(ref, a.origen.ref) && tocaLaCadena(a.cadena, idDeDestino(destino))) return;
        const d = Math.hypot(x - px, y - py);
        if (d < mejorDist) {
          mejorDist = d;
          mejorRef = ref;
          mejorDestino = destino;
        }
      };

      for (const el of lienzo.querySelectorAll<HTMLElement>('[data-clase="accion"]')) {
        if (excluido(el) || !el.dataset.pila) continue;
        const ref = refDeClave(el.dataset.pila);
        const prog = obtenerLista(ref);
        const id = el.dataset.nodo!;
        const r = el.getBoundingClientRect();
        ofrecer(r.left, r.top, ref, { tipo: "antes", id });
        ofrecer(r.left, r.bottom, ref, despuesDe(prog, id));
      }

      const contenedores = [...lienzo.querySelectorAll<HTMLElement>('[data-clase="contenedor"]')]
        .filter((el) => !excluido(el) && el.dataset.pila)
        .sort((p, q) => Number(q.dataset.nivel ?? 0) - Number(p.dataset.nivel ?? 0));
      for (const el of contenedores) {
        const ref = refDeClave(el.dataset.pila!);
        const prog = obtenerLista(ref);
        const id = el.dataset.nodo!;
        const nodo = buscarNodo(prog, id);
        if (!nodo || !esContenedor(nodo)) continue;
        const parte = (p: string) => el.querySelector(`:scope > [data-parte="${p}"], :scope > * > [data-parte="${p}"]`);
        const lomo = parte("lomo")?.getBoundingClientRect();
        const brazo = parte("brazo")?.getBoundingClientRect();
        const brazoMedio = parte("brazo-medio")?.getBoundingClientRect();
        if (!lomo || !brazo) continue;
        const inicioDe = (rama: Rama): Destino => {
          const primero = listaDeRama(nodo, rama)[0];
          return primero ? { tipo: "antes", id: primero.id } : { tipo: "dentro", id, rama };
        };
        ofrecer(lomo.left, lomo.top, ref, { tipo: "antes", id });
        ofrecer(lomo.left, lomo.bottom, ref, inicioDe("body"));
        ofrecer(brazo.left, brazo.top, ref, despuesDe(prog, id));
        if (brazoMedio) ofrecer(brazoMedio.left, brazoMedio.top, ref, inicioDe("sino"));
      }

      if (mejorRef && mejorDestino) {
        const prog = obtenerLista(mejorRef);
        const prof = profundidadParaDestino(prog, mejorDestino);
        if (prof === null || !cabeA(a.cadena, prof)) return { tipo: "nocabe" };
        return { tipo: "cadena", pila: mejorRef, destino: mejorDestino };
      }

      // 4 · lejos de todo conector: cae como pila nueva. Nunca `null`
      // (decisión #6, design.md) — el recorte final de coordenadas ya lo
      // hace `almacenamiento.ts` al guardar (±4000, tarea 1.6).
      const punto = aLienzo(px, py) ?? { x: px, y: py };
      return { tipo: "nueva", x: Math.round(punto.x), y: Math.round(punto.y) };
    },
    [aLienzo, obtenerLista],
  );

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
        let cadena: NodoPrograma[];
        if (p.origen.desde === "caja") {
          cadena = [nodoDeMuestra(p.origen.tipo)];
        } else {
          const corte = cortarEn(obtenerLista(p.origen.ref), p.origen.id);
          if (!corte) {
            limpiar();
            return;
          }
          cadena = corte.agarrado;
        }
        a = { origen: p.origen, cadena, x: ev.clientX, y: ev.clientY, dx: p.dx, dy: p.dy, ancho: p.ancho };
      } else {
        a = { ...a, x: ev.clientX, y: ev.clientY };
      }
      arrastreRef.current = a;
      setArrastre(a);
      const d = calcularDestinoLienzo(ev.clientX, ev.clientY, a);
      destinoRef.current = d;
      setDestino(d);
      ev.preventDefault();
    },
    [calcularDestinoLienzo, limpiar, obtenerLista],
  );

  const alSoltar = useCallback(() => {
    const a = arrastreRef.current;
    const d = destinoRef.current;
    limpiar();
    if (!a || !d) return; // fue un toque: el `click` se encarga
    const api = propsRef.current;

    /* BORRAR es ahora un acto DELIBERADO (decisión #6, design.md). Antes,
       "soltar sin destino" quitaba la pieza; en un lienzo libre eso es
       justamente el gesto normal —dejarla en un lugar vacío— y hubiera
       hecho desaparecer la cadena entera sin que nadie la mandara ahí. */
    if (d.tipo === "papelera" || d.tipo === "paleta") {
      // El tachito y el borrado por paleta llegan en la Fase 3 (tareas
      // 3.1/3.2): hoy ningún elemento del DOM produce este destino, así
      // que esta rama nunca se alcanza — queda lista para no repetir el
      // `if` cuando se conecte `onBorrarCadena`. Mientras tanto, NADA se
      // borra soltando en el lienzo.
    } else if (d.tipo === "nocabe") {
      // Donde no cabe no pasa nada: la cadena vuelve a donde estaba.
    } else if (d.tipo === "cadena") {
      if (a.origen.desde === "caja") api.onAgregar(a.origen.tipo, d.pila, d.destino);
      else api.onMoverCadena(a.origen.ref, a.origen.id, d.pila, d.destino);
    } else {
      // d.tipo === "nueva"
      if (a.origen.desde === "caja") api.onSoltarNueva(a.origen.tipo, d.x, d.y);
      else api.onSoltarCadena(a.origen.ref, a.origen.id, d.x, d.y);
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

  /* El hueco de encastre sólo existe para `{tipo:"cadena"}`: `"nueva"` se
     ve con el contorno fantasma más abajo, y `"nocabe"`/`"papelera"`/
     `"paleta"` no abren nada acá. */
  const destinoVisible = destino && destino.tipo === "cadena" ? destino : null;

  const marca = arrastre ? (
    <div
      key="marca"
      className={`auto-bloque auto-bloque--marca${esContenedor(arrastre.cadena[0]) ? " auto-bloque--marca-ancha" : ""}`}
      data-marca=""
      style={{ "--auto-color": colorDe(arrastre.cadena[0]) } as CSSProperties}
      aria-hidden="true"
    />
  ) : null;

  const marcaEn = (contenedor: string | null, rama: Rama, refPila: RefPila | null): boolean =>
    !!destinoVisible &&
    !!refPila &&
    mismaClave(destinoVisible.pila, refPila) &&
    ((contenedor === null && destinoVisible.destino.tipo === "final") ||
      (contenedor !== null &&
        destinoVisible.destino.tipo === "dentro" &&
        destinoVisible.destino.id === contenedor &&
        (destinoVisible.destino.rama ?? "body") === rama));

  /* ---------------- dibujar la libreta ---------------- */

  /** Funciones que devuelven JSX, no componentes definidos adentro del
   *  render: un componente creado en cada render es un tipo NUEVO para
   *  React, que desmonta y vuelve a montar todos los bloques —y con
   *  ellos el foco del teclado y la animación del bloque activo.
   *
   *  Por la misma razón cada entrada lleva de clave el id de su nodo (y
   *  el hueco, la suya): con claves por posición, subir un bloque con la
   *  flecha lo remontaba y el foco se perdía en el primer movimiento. */
  function dibujarLista(
    nodos: NodoPrograma[],
    contenedor: string | null,
    rama: Rama,
    nivel: number,
    estatico: boolean,
    refPila: RefPila | null,
  ): ReactNode[] {
    const salida: ReactNode[] = [];
    for (const n of nodos) {
      if (
        !estatico &&
        destinoVisible &&
        refPila &&
        mismaClave(destinoVisible.pila, refPila) &&
        destinoVisible.destino.tipo === "antes" &&
        destinoVisible.destino.id === n.id
      ) {
        salida.push(marca);
      }
      salida.push(dibujarNodo(n, nivel, estatico, refPila));
    }
    if (!estatico && marcaEn(contenedor, rama, refPila)) salida.push(marca);
    return salida;
  }

  /** El botón que muestra y cicla un valor de `Veces`: el número de
   *  `Repetir`, el de `Hacer A con N`, o el del sensor del contador. Las
   *  tres ranuras numéricas de la libreta pasan por ACÁ y disparan el
   *  mismo `onCambiarVeces(id)` — la página decide qué campo y qué lista
   *  le toca a cada una inspeccionando el nodo (design.md: "los dos
   *  mecanismos de ciclado existentes se quedan en dos"). */
  function RanuraNumero(nodo: NodoRepetir | NodoCall | NodoMientras | NodoSi): ReactNode {
    const valor: Veces =
      nodo.type === "repeat"
        ? nodo.times
        : nodo.type === "call"
          ? (nodo.veces ?? AJUSTES.opcionesRepetir[0])
          : (nodo.sensor.valor ?? AJUSTES.opcionesContador[0]);
    return (
      <button
        type="button"
        className="auto-repetir__veces"
        disabled={corriendo}
        onClick={alClick(() => onCambiarVeces(nodo.id))}
        onKeyDown={teclas(nodo.id)}
        aria-label={`${nombreDe(nodo)}. Tocar para cambiar; flechas para mover el bloque`}
      >
        <ContenidoVeces valor={valor} />
      </button>
    );
  }

  function dibujarCavidad(nodo: NodoContenedor, rama: Rama, nivel: number, estatico: boolean, refPila: RefPila | null): ReactNode {
    const lista = listaDeRama(nodo, rama);
    return (
      <div className="auto-repetir__cuerpo">
        <div className="auto-repetir__espina" />
        <div className="auto-repetir__cavidad" data-parte="cavidad" data-rama={rama}>
          {dibujarLista(lista, nodo.id, rama, nivel + 1, estatico, refPila)}
          {lista.length === 0 && !(!estatico && marcaEn(nodo.id, rama, refPila)) && (
            <div className="auto-hueco auto-hueco--cavidad" />
          )}
        </div>
      </div>
    );
  }

  /** `refPila === null` dibuja el nodo VIVO —colores, pulso de "activo",
   *  tocar para quitar, ciclar sensor/veces, teclado— pero sin asa de
   *  arrastre ni `data-nodo`/`data-clase`/`data-pila`: es EXCLUSIVAMENTE
   *  el sombrero de una `Mi rutina`, que no se arrastra a sí mismo
   *  (decisión #9, design.md). Su CUERPO sigue siendo arrastrable: más
   *  abajo, el `def` fuerza `refHijos = {donde:"rutina", id}` para su
   *  propia cavidad sin importar el `refPila` que él mismo recibió. Las
   *  pilas sueltas ya no pasan por acá con `refPila=null` (tarea 2b):
   *  ahora son una pila arrastrable más, como la cadena verde. */
  function dibujarNodo(nodo: NodoPrograma, nivel: number, estatico: boolean, refPila: RefPila | null): ReactNode {
    const levantado = !estatico && arrastre?.origen.desde === "lienzo" && arrastre.cadena.some((n) => n.id === nodo.id);
    const activo = !estatico && nodoActivo === nodo.id;
    const puedeArrastrar = !estatico && refPila !== null;

    if (esContenedor(nodo)) {
      const refFijo = refPila;
      const asa = puedeArrastrar
        ? (ev: PointerEventReact<HTMLElement>) => agarrar(ev, { desde: "lienzo", ref: refFijo!, id: nodo.id })
        : undefined;
      // El cuerpo de una `Mi rutina` es SU PROPIA pila, sin importar si el
      // sombrero llegó con `refPila=null` (no se arrastra a sí mismo).
      const refHijos: RefPila | null = nodo.type === "def" ? { donde: "rutina", id: nodo.id } : refPila;
      return (
        <div
          key={nodo.id}
          className={`auto-repetir${levantado ? " auto-repetir--levantado" : ""}${activo ? " auto-repetir--activo" : ""}${nodo.type === "def" ? " auto-repetir--sombrero" : ""}`}
          style={{ "--auto-tono": nodo.type === "def" ? COLOR_LLAMADA[nodo.rutina] : COLOR_CONTENEDOR[nodo.type] } as CSSProperties}
          data-nodo={puedeArrastrar ? nodo.id : undefined}
          data-clase={puedeArrastrar ? "contenedor" : undefined}
          data-pila={puedeArrastrar ? claveDePila(refFijo!) : undefined}
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
                <span className="auto-repetir__veces">
                  <ContenidoVeces valor={nodo.times} />
                </span>
              ) : (
                RanuraNumero(nodo)
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
            {(nodo.type === "while" || nodo.type === "if") && nodo.sensor.tipo === "contador" &&
              (estatico ? (
                <span className="auto-repetir__veces">
                  <ContenidoVeces valor={nodo.sensor.valor ?? AJUSTES.opcionesContador[0]} />
                </span>
              ) : (
                RanuraNumero(nodo)
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
            {nodo.type === "def" && (
              // La letra no se toca —es la identidad de la rutina, no una
              // perilla— así que va suelta, nunca en un botón.
              <span className="auto-repetir__veces" aria-hidden="true">
                {nodo.rutina}
              </span>
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
          {dibujarCavidad(nodo, "body", nivel, estatico, refHijos)}
          {nodo.type === "if" && nodo.sino && (
            <>
              <div className="auto-repetir__brazo auto-repetir__brazo--medio" data-parte="brazo-medio" onPointerDown={asa}>
                <IcoSino className="w-[20px] h-[20px] opacity-90" />
              </div>
              {dibujarCavidad(nodo, "sino", nivel, estatico, refHijos)}
            </>
          )}
          <div className="auto-repetir__brazo" data-parte="brazo" onPointerDown={asa}>
            <DibujoContenedor tipo={nodo.type} className="w-[18px] h-[18px] opacity-80" />
          </div>
        </div>
      );
    }

    if (nodo.type === "call") {
      // Hoja como `Plantar`: se distingue de sus hermanas por el color de
      // su letra, no por un dibujo distinto (COLOR_LLAMADA en colorDe).
      const clase = `auto-bloque${activo ? " auto-bloque--activo" : ""}${levantado ? " auto-bloque--levantado" : ""}`;
      const estilo = { "--auto-color": colorDe(nodo) } as CSSProperties;
      if (estatico) {
        return (
          <div key={nodo.id} className={clase} style={estilo}>
            <IcoHacer />
            {nodo.veces !== undefined && (
              <span className="auto-repetir__veces">
                <ContenidoVeces valor={nodo.veces} />
              </span>
            )}
          </div>
        );
      }
      if (nodo.veces === undefined) {
        return (
          <button
            key={nodo.id}
            type="button"
            className={clase}
            style={estilo}
            data-nodo={puedeArrastrar ? nodo.id : undefined}
            data-clase={puedeArrastrar ? "accion" : undefined}
            data-pila={puedeArrastrar ? claveDePila(refPila!) : undefined}
            disabled={corriendo}
            onPointerDown={puedeArrastrar ? (ev) => agarrar(ev, { desde: "lienzo", ref: refPila!, id: nodo.id }) : undefined}
            onClick={alClick(() => onQuitar(nodo.id))}
            onKeyDown={teclas(nodo.id)}
            aria-label={`${nombreDe(nodo)}. Tocar para quitar; flechas para mover`}
          >
            <IcoHacer />
          </button>
        );
      }
      // `Hacer A con N`: lleva una ranura numérica, así que el asa no
      // puede ser el propio botón (anidaría botones) — vive en un `div`,
      // igual que el lomo de un contenedor, con el número y la cruz de
      // quitar como sus dos únicos hijos interactivos.
      return (
        <div
          key={nodo.id}
          className={clase}
          style={estilo}
          data-nodo={puedeArrastrar ? nodo.id : undefined}
          data-clase={puedeArrastrar ? "accion" : undefined}
          data-pila={puedeArrastrar ? claveDePila(refPila!) : undefined}
          onPointerDown={puedeArrastrar ? (ev) => agarrar(ev, { desde: "lienzo", ref: refPila!, id: nodo.id }) : undefined}
        >
          <IcoHacer />
          {RanuraNumero(nodo)}
          <button
            type="button"
            className="auto-repetir__quitar"
            disabled={corriendo}
            onClick={alClick(() => onQuitar(nodo.id))}
            aria-label={`Quitar el bloque ${nombreDe(nodo).toLowerCase()}`}
          >
            ×
          </button>
        </div>
      );
    }

    if (nodo.type === "counter_add" || nodo.type === "counter_reset") {
      const clase = `auto-bloque${activo ? " auto-bloque--activo" : ""}${levantado ? " auto-bloque--levantado" : ""}`;
      const estilo = { "--auto-color": colorDe(nodo) } as CSSProperties;
      if (estatico) {
        return (
          <div key={nodo.id} className={clase} style={estilo}>
            <DibujoContador tipo={nodo.type} />
          </div>
        );
      }
      return (
        <button
          key={nodo.id}
          type="button"
          className={clase}
          style={estilo}
          data-nodo={puedeArrastrar ? nodo.id : undefined}
          data-clase={puedeArrastrar ? "accion" : undefined}
          data-pila={puedeArrastrar ? claveDePila(refPila!) : undefined}
          disabled={corriendo}
          onPointerDown={puedeArrastrar ? (ev) => agarrar(ev, { desde: "lienzo", ref: refPila!, id: nodo.id }) : undefined}
          onClick={alClick(() => onQuitar(nodo.id))}
          onKeyDown={teclas(nodo.id)}
          aria-label={`${nombreDe(nodo)}. Tocar para quitar; flechas para mover`}
        >
          <DibujoContador tipo={nodo.type} />
        </button>
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
        data-nodo={puedeArrastrar ? accion.id : undefined}
        data-clase={puedeArrastrar ? "accion" : undefined}
        data-pila={puedeArrastrar ? claveDePila(refPila!) : undefined}
        disabled={corriendo}
        onPointerDown={puedeArrastrar ? (ev) => agarrar(ev, { desde: "lienzo", ref: refPila!, id: accion.id }) : undefined}
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
    ...(compradas.rutinas
      ? RUTINAS.flatMap((r) =>
          rutinasDefinidas.has(r)
            ? [`call:${r}` as const, ...(compradas.hacerCon ? [`hacer_con:${r}` as const] : [])]
            : [`def:${r}` as const],
        )
      : []),
    ...(compradas.contador ? (["counter_add", "counter_reset"] as const) : []),
  ];

  const huecoFinal =
    usada < capacidad &&
    !(destinoVisible && destinoVisible.pila.donde === "verde" && destinoVisible.destino.tipo === "final");
  /* El contorno fantasma (tarea 2b.2): "acá va a caer como pila nueva".
     Vive en coordenadas de lienzo — mismas que `destino.x`/`.y` — así
     hereda el pan/zoom de `.auto-lienzo__capa` sin cuentas aparte. El
     tamaño es una aproximación con el ancho capturado al agarrar (ya en
     px de pantalla, se divide por el zoom para volver a px de lienzo) y
     una altura por bloque de la cadena — no el tamaño exacto de cada
     contenedor, que dependería de medir el fantasma ya montado. */
  const contorno =
    destino && destino.tipo === "nueva" ? (
      <div
        className="auto-contorno"
        style={{
          left: destino.x,
          top: destino.y,
          width: arrastre ? arrastre.ancho / vista.z : 172,
          height: arrastre ? Math.max(56, arrastre.cadena.length * 54) : 56,
        }}
        aria-hidden="true"
      />
    ) : null;

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
              ) : muestra.type === "call" ? (
                <IcoHacer />
              ) : muestra.type === "counter_add" || muestra.type === "counter_reset" ? (
                <DibujoContador tipo={muestra.type} />
              ) : (
                <Dibujo tipo={muestra.type} />
              )}
            </button>
          );
        })}
      </div>

      {/* El lienzo: viewport de tamaño fijo (`overflow:hidden`) con una
          capa propia adentro que lleva el pan/zoom (decisión #7 y #3 del
          load-bearing list: el transform nunca va sobre un elemento que ya
          anima `transform` por su cuenta). */}
      <div
        ref={lienzoRef}
        className={`auto-lienzo${arrastre ? " auto-lienzo--recibiendo" : ""}`}
        onPointerDown={alBajarLienzo}
      >
        <div
          ref={capaRef}
          className="auto-lienzo__capa"
          style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.z})` }}
        >
          {/* El ancla verde: fija, con forma de sombrero, sin `data-nodo`
              — no se arrastra, sólo su cadena. */}
          <div
            className="auto-inicio"
            style={{ left: datosLienzo.inicio.x, top: datosLienzo.inicio.y }}
            aria-hidden="true"
          >
            <IcoInicio className="w-[28px] h-[28px]" />
          </div>

          {/* La cadena verde: lo ÚNICO que ejecuta. Cuelga pegada del ancla. */}
          <div
            className="auto-pila"
            style={{ left: datosLienzo.inicio.x, top: datosLienzo.inicio.y + ALTO_INICIO }}
          >
            {dibujarLista(programa, null, "body", 0, false, { donde: "verde" })}
            {huecoFinal && <div className="auto-hueco" />}
            {programa.length === 0 && !arrastre && (
              <p className="auto-lienzo__pista">Tocá una pieza, o arrastrala hasta acá.</p>
            )}
          </div>

          {/* `Mi rutina`: sombrero aislado a todo color (decisión #9) —
              `Hacer A` la sigue encontrando aunque no cuelgue del verde,
              así que atenuarla mentiría. El sombrero mismo no lleva asa
              (nunca se arrastra a sí mismo, `refPila=null`), pero su
              cuerpo sí: `dibujarNodo` fuerza `{donde:"rutina", id}` para
              la cavidad sin importar lo que reciba acá. */}
          {rutinas.map((def, i) => {
            const pt = datosLienzo.rutinas[def.id] ?? puntoRutinaPorDefecto(i);
            return (
              <div key={def.id} style={{ position: "absolute", left: pt.x, top: pt.y }}>
                {dibujarNodo(def, 0, false, null)}
              </div>
            );
          })}

          {/* Pilas sueltas: atenuadas, no ejecutan, pero son una pila
              arrastrable más (tarea 2b) — agarrar su primer bloque se
              lleva la pila entera, como cualquier cadena. */}
          {pilasSueltas.map((pila) => (
            <div key={pila.id} className="auto-pila--suelta" style={{ left: pila.x, top: pila.y }}>
              {dibujarLista(pila.nodos, null, "body", 0, false, { donde: "suelta", id: pila.id })}
            </div>
          ))}

          {contorno}
        </div>
      </div>

      {/* HUD portado a `document.body` (decisión #8, MANDATORIO): igual
          que el fantasma, esquiva el `backdrop-filter` de `.auto-taller`,
          que convertiría `position: fixed` en relativo a él. */}
      {hudRect &&
        createPortal(
          <div
            data-hud=""
            style={{ position: "fixed", left: hudRect.left, top: hudRect.top, width: hudRect.width, height: hudRect.height, pointerEvents: "none" }}
          >
            {/* La memoria: luces, no un número. Es la misma hilera que
                dibuja la mejora "más memoria", así el chico liga las dos. */}
            <div
              className={`auto-memoria${sacudida ? " auto-memoria--llena" : ""}`}
              role="img"
              aria-label={`Memoria: ${usada} de ${capacidad}`}
              style={{ pointerEvents: "auto" }}
            >
              {Array.from({ length: capacidad }, (_, i) => (
                <span key={i} className={`auto-luz${i < usada ? " auto-luz--on" : ""}`} />
              ))}
            </div>

            <button
              type="button"
              className="auto-recentrar"
              style={{ pointerEvents: "auto" }}
              onClick={recentrar}
              aria-label="Volver a encuadrar el bloque de arranque"
            >
              <IcoRecentrar className="w-[22px] h-[22px]" />
            </button>
          </div>,
          document.body,
        )}

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
              width: esContenedor(arrastre.cadena[0]) ? undefined : arrastre.ancho,
            }}
            aria-hidden="true"
          >
            {arrastre.cadena.map((n) => dibujarNodo(n, 0, true, null))}
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
