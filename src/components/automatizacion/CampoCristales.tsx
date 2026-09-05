/* El campo: la isla, las vetas y la nave.
 *
 * Todo se posiciona en PORCENTAJE de la escena, nunca en píxeles, y esos
 * porcentajes no los escribió nadie a mano: los midió
 * scripts/medir-grilla-islas.mjs sobre la ilustración, siguiendo las
 * juntas de luz. Cambiar el arte es reemplazar el PNG y volver a correr
 * ese script; las posiciones se actualizan con la imagen.
 *
 * LA JERARQUÍA VISUAL (PROGRESION.md §8): la isla es el tablero, los
 * cristales nacen del tablero, la nave se mueve por él. Tres cosas la
 * sostienen y las tres fueron errores reales:
 *
 *   - Cada pieza se apoya por su ANCLA (el punto del lienzo que significa
 *     "centro de la baldosa"), y su sombra de contacto se dibuja EN el
 *     ancla, no en la base del lienzo. La sombra de la nave estaba abajo
 *     del todo y la nave se leía delante de la isla entera.
 *   - Los tamaños son pasos de baldosa (escena.ts). Un cristal más alto
 *     que media baldosa deja de nacer del anillo y pasa a flotar delante.
 *   - El orden en profundidad es la fila: cada pieza lleva un z-index por
 *     su `y`. La nave va apenas por encima de las piezas de su fila.
 *
 * Cada pieza se dibuja en capas anidadas y eso es a propósito:
 *
 *   .auto-ancla  — posición y transición al moverse entre baldosas
 *   .auto-cuerpo — despegue/aterrizaje e inclinación de la nave
 *   .auto-flota  — el vaivén de flotar, en `transform`
 *
 * Si vivieran en el mismo elemento se pisarían: cada capa anima una
 * propiedad distinta (`left/top`, `translate`, `transform`).
 *
 * LA NAVE GIRA DE VERDAD. Tiene dieciséis vistas (una cada 22,5°) y un
 * ángulo continuo que este componente anima con su propio rAF hacia el
 * rumbo del motor, por el camino más corto. Es la única animación que
 * no es CSS: elegir una imagen por cuadro no se puede expresar en una
 * transición.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { campoDe, type Baldosa } from "../../data/automatizacion/campos";
import {
  ANCHO_CRISTAL,
  ANCHO_NAVE,
  ANCLA_PIEZA,
  DESVIO_MUELLE,
  ESCALA_ESCENA,
  TINTE_VARIANTE,
  VISTAS_NAVE,
} from "../../data/automatizacion/escena";
import type {
  Celda,
  Direccion,
  EstadoCampo,
  VarianteCristal,
} from "../../utils/automatizacion/motor";

const ETAPA_ARCHIVO: Record<number, string> = { 1: "brote", 2: "creciendo", 3: "maduro" };

/** Lo que el campo anima cuando la nave hace algo que se tiene que VER:
 *  cosechar (el cristal sube hacia la nave y sale un +1), cosechar en
 *  vacío (un anillo que se disipa: no había nada) y chocar contra el
 *  borde (la nave se sacude). Las acciones inútiles no son errores
 *  (MVP.md §6), pero el desperdicio tiene que verse. `n` crece con cada
 *  evento para que dos seguidos se dibujen los dos. */
export interface EventoCampo {
  n: number;
  tipo: "harvest" | "empty_harvest" | "bump" | "break" | "plant" | "plant_fail";
  celda: number;
  /** El mineral que había (o el que se quiso plantar). */
  variante: VarianteCristal;
  /** En qué etapa estaba antes del paso: para dibujar lo que se rompió. */
  etapaPrevia: number;
  /** Cuánto pagó la cosecha. */
  premio: number;
}

const ANGULO_DE: Record<Direccion, number> = { north: 0, east: 90, south: 180, west: 270 };
const PASO_VISTA = 360 / VISTAS_NAVE;
const MS_GIRO = 380;

/** Nombre de archivo de la vista más cercana a un ángulo. El nombre
 *  trunca los grados (22.5 → r022), igual que el render. */
function vistaDe(angulo: number): string {
  const i = Math.round((((angulo % 360) + 360) % 360) / PASO_VISTA) % VISTAS_NAVE;
  return `/assets/automatizacion/nave/nave-r${String(Math.floor(i * PASO_VISTA)).padStart(3, "0")}.webp`;
}

const TRASLADO_ANCLA = `${-ANCLA_PIEZA.x * 100}% ${-ANCLA_PIEZA.y * 100}%`;

function suavizar(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** El ángulo de la nave, animado hacia el rumbo por el camino más corto.
 *  Devuelve la vista que hay que dibujar ahora. */
function useAnguloNave(direccion: Direccion): number {
  const objetivo = ANGULO_DE[direccion];
  const [angulo, setAngulo] = useState(objetivo);
  const actual = useRef(objetivo);
  const cuadro = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(cuadro.current);
    const desde = actual.current;
    // Camino más corto: girar a la derecha desde el oeste es +90, no -270.
    let delta = ((objetivo - desde) % 360 + 540) % 360 - 180;
    if (Math.abs(delta) < 0.01) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      actual.current = objetivo;
      setAngulo(objetivo);
      return;
    }
    const t0 = performance.now();
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - t0) / MS_GIRO);
      actual.current = desde + delta * suavizar(t);
      setAngulo(actual.current);
      if (t < 1) cuadro.current = requestAnimationFrame(paso);
      else actual.current = objetivo;
    };
    cuadro.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro.current);
  }, [objetivo]);

  return angulo;
}

export function CampoCristales({
  estado,
  evento = null,
  corriendo = false,
}: {
  estado: EstadoCampo;
  evento?: EventoCampo | null;
  /** Con el programa corriendo la nave vuela (despega, se inclina, el
   *  motor se enciende); detenida, aterriza estacionada en su baldosa. */
  corriendo?: boolean;
}) {
  const campo = campoDe(estado.lado);
  const pct = (v: number) => `${v}%`;

  // Ancho de una baldosa en % del lienzo: dos medios pasos.
  const baldosaPct = campo.pasoX * 2;
  const anchoCristal = baldosaPct * ANCHO_CRISTAL;
  const anchoNave = baldosaPct * ANCHO_NAVE;

  const baldosa = (fila: number, col: number): Baldosa =>
    campo.baldosas.find((b) => b.fila === fila && b.col === col) ?? campo.baldosas[0];

  const naveB = baldosa(estado.nave.fila, estado.nave.col);
  const angulo = useAnguloNave(estado.nave.direccion);

  /* Estacionada, la nave se corre del centro para no tapar la veta del
     muelle; al arrancar, la transición de `left/top` la lleva al centro
     y se la ve salir. */
  const naveX = corriendo ? naveB.x : naveB.x + campo.pasoX * DESVIO_MUELLE.x;
  const naveY = corriendo ? naveB.y : naveB.y + campo.pasoY * DESVIO_MUELLE.y;

  /* Cambios de etapa desde el último cuadro: para el "pop" de cada
     rebrote y el estallido al llegar a maduro. Se comparan contra lo
     visto en el commit anterior; la referencia se actualiza después. */
  const etapasVistas = useRef<Map<number, number>>(new Map());
  const estallidos = useRef<Map<number, number>>(new Map());
  const pops = useRef<Map<number, number>>(new Map());
  estado.celdas.forEach((c, i) => {
    const previa = etapasVistas.current.get(i);
    if (previa !== undefined && previa !== c.etapa) {
      pops.current.set(i, (pops.current.get(i) ?? 0) + 1);
      if (c.etapa === 3) estallidos.current.set(i, (estallidos.current.get(i) ?? 0) + 1);
    }
  });
  useEffect(() => {
    const m = new Map<number, number>();
    estado.celdas.forEach((c, i) => m.set(i, c.etapa));
    etapasVistas.current = m;
  });

  /* La baldosa del último evento, para dibujar el efecto encima. */
  const eventoB = evento ? baldosa(Math.floor(evento.celda / estado.lado), evento.celda % estado.lado) : null;
  const golpe = evento?.tipo === "bump" ? evento.n : 0;

  return (
    <div className="auto-visor">
      <div className="auto-escena" style={{ "--auto-escala": ESCALA_ESCENA } as CSSProperties}>
        <img className="auto-isla" src={campo.imagen} alt="" draggable={false} />

        {estado.celdas.map((celda: Celda, i) => {
          const fila = Math.floor(i / estado.lado);
          const col = i % estado.lado;
          const b = baldosa(fila, col);
          const z = Math.round(b.y * 10);

          /* Tierra sin nada plantado: el zócalo tal cual lo dibujó la
             ilustración. Ni latido: acá no va a brotar nada solo. */
          if (celda.variante === null) return null;

          if (celda.etapa === 0) {
            /* Zócalo con semilla. La ilustración ya trae grabado el
               destello de cuatro puntas, así que acá sólo se le suma el
               latido: la marca dice "acá va a brotar algo" sin dibujar
               nada nuevo. */
            return (
              <span
                key={i}
                className="auto-semilla"
                style={{
                  left: pct(b.x),
                  top: pct(b.y),
                  width: pct(baldosaPct * 0.46),
                  zIndex: z,
                }}
              />
            );
          }

          const madura = celda.etapa === 3;
          const pop = pops.current.get(i) ?? 0;
          const estallido = estallidos.current.get(i) ?? 0;
          return (
            <span
              key={i}
              className="auto-ancla"
              style={
                {
                  left: pct(b.x),
                  top: pct(b.y),
                  width: pct(anchoCristal),
                  zIndex: z,
                  translate: TRASLADO_ANCLA,
                  "--auto-tinte": TINTE_VARIANTE[celda.variante],
                } as CSSProperties
              }
            >
              {/* Sombra de contacto: lo que apoya el cristal en el anillo
                  en vez de dejarlo pegado encima. Crece con la etapa. */}
              <span className="auto-apoyo" style={{ width: pct(22 + celda.etapa * 10) }} />
              {/* Sólo el maduro emite: un resplandor en la base que late.
                  Es la segunda señal de "listo" —la primera es el
                  tamaño— para el chico que no distingue los colores. */}
              {madura && <span className="auto-brillo" />}
              {/* Llegar a maduro estalla en destellos: "listo" también se
                  anuncia en el momento en que pasa. */}
              {madura && estallido > 0 && <span key={`e${estallido}`} className="auto-estallido" />}
              {/* Cada cambio de etapa entra con un pop: la clave cambia
                  con la etapa y la animación se dispara sola. */}
              <img
                key={`p${pop}`}
                className={`auto-brota${madura ? " auto-flota auto-flota--lento" : ""}`}
                src={`/assets/automatizacion/cristales/${celda.variante}-${ETAPA_ARCHIVO[celda.etapa]}.webp`}
                alt=""
                draggable={false}
              />
            </span>
          );
        })}

        {/* La cosecha: el cristal que había sube hacia la nave y se
            achica hasta entrar, con un fogonazo en el zócalo. Pasa por
            DETRÁS de la nave (menor z), que es lo que lo hace leer como
            "la nave lo levantó". La veta ya cambió en el estado, así que
            el que sube es una copia con la variedad que tenía. */}
        {evento && eventoB && evento.tipo === "harvest" && (
          <span
            key={`cosecha-${evento.n}`}
            className="auto-ancla auto-efecto"
            style={
              {
                left: pct(eventoB.x),
                top: pct(eventoB.y),
                width: pct(anchoCristal),
                zIndex: Math.round(eventoB.y * 10) + 3,
                translate: TRASLADO_ANCLA,
                "--auto-tinte": TINTE_VARIANTE[evento.variante],
              } as CSSProperties
            }
          >
            <span className="auto-fogonazo" />
            <img
              className="auto-absorbido"
              src={`/assets/automatizacion/cristales/${evento.variante}-maduro.webp`}
              alt=""
              draggable={false}
            />
          </span>
        )}
        {evento && eventoB && evento.tipo === "harvest" && (
          <span
            key={`mas-${evento.n}`}
            className="auto-mas"
            style={
              {
                left: pct(eventoB.x),
                top: pct(eventoB.y),
                zIndex: Math.round(eventoB.y * 10) + 9,
                color: TINTE_VARIANTE[evento.variante],
              } as CSSProperties
            }
            aria-hidden="true"
          >
            +{evento.premio}
          </span>
        )}
        {/* Cosechar verde: el cristal que había se agrieta y se hunde. */}
        {evento && eventoB && evento.tipo === "break" && (
          <span
            key={`roto-${evento.n}`}
            className="auto-ancla auto-efecto"
            style={
              {
                left: pct(eventoB.x),
                top: pct(eventoB.y),
                width: pct(anchoCristal),
                zIndex: Math.round(eventoB.y * 10) + 3,
                translate: TRASLADO_ANCLA,
              } as CSSProperties
            }
          >
            <span className="auto-esquirlas" />
            <img
              className="auto-roto"
              src={`/assets/automatizacion/cristales/${evento.variante}-${ETAPA_ARCHIVO[Math.max(1, evento.etapaPrevia)]}.webp`}
              alt=""
              draggable={false}
            />
          </span>
        )}
        {/* Plantar: un fogonazo del color del mineral en el zócalo. */}
        {evento && eventoB && evento.tipo === "plant" && (
          <span
            key={`siembra-${evento.n}`}
            className="auto-ancla auto-efecto"
            style={
              {
                left: pct(eventoB.x),
                top: pct(eventoB.y),
                width: pct(anchoCristal),
                zIndex: Math.round(eventoB.y * 10) + 3,
                translate: TRASLADO_ANCLA,
                "--auto-tinte": TINTE_VARIANTE[evento.variante],
              } as CSSProperties
            }
          >
            <span className="auto-fogonazo" />
          </span>
        )}
        {/* Cosechar donde no hay nada, o plantar donde no se puede: un
            anillo que se disipa. */}
        {evento && eventoB && (evento.tipo === "empty_harvest" || evento.tipo === "plant_fail") && (
          <span
            key={`nada-${evento.n}`}
            className="auto-nada"
            style={{
              left: pct(eventoB.x),
              top: pct(eventoB.y),
              width: pct(baldosaPct * 0.55),
              zIndex: Math.round(eventoB.y * 10) + 8,
            }}
          />
        )}

        {/* La nave. El ancla lleva la posición (y su transición entre
            baldosas); el cuerpo despega, se inclina y se sacude; la
            imagen flota. La sombra queda EN EL ANCLA, quieta, que es lo
            que vende el vuelo y lo que dice en qué baldosa está. */}
        <span
          className={`auto-ancla auto-ancla--nave${corriendo ? " auto-ancla--volando" : ""}`}
          style={
            {
              left: pct(naveX),
              top: pct(naveY),
              width: pct(anchoNave),
              zIndex: Math.round(naveB.y * 10) + 5,
              translate: TRASLADO_ANCLA,
            } as CSSProperties
          }
        >
          <span className="auto-sombra" />
          <span key={`golpe-${golpe}`} className={`auto-cuerpo${golpe ? " auto-golpe" : ""}`}>
            <span className="auto-motor" />
            <img className="auto-flota" src={vistaDe(angulo)} alt="" draggable={false} />
          </span>
        </span>
      </div>
    </div>
  );
}
