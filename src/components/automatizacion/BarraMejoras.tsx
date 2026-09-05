/* La franja de mejoras.
 *
 * Revelado progresivo: sólo aparecen las categorías que ya se ganaron el
 * derecho a mostrarse, y de a una (MVP.md §8). Nunca una tienda llena de
 * candados el primer día — un candado es una promesa que el chico no
 * pidió y que le dice, sobre todo, todo lo que todavía no puede hacer.
 *
 * Los precios se escriben con el ícono del mineral que piden
 * (PROGRESION.md §7): mirar la tienda enseña qué vale cada color. Y las
 * evoluciones muestran el cristal mismo con sus cuatro luces de nivel.
 *
 * Cuando el saldo no alcanza no hay modal: la tarjeta hace un pulso que
 * conecta el precio con el contador de arriba.
 */
import { useState, type ReactElement } from "react";
import {
  IcoCampo,
  IcoCrecimiento,
  IcoEsperar,
  IcoEvolucion,
  IcoMemoria,
  IcoMientras,
  IcoMineral,
  IcoPieza,
  IcoPiezaRepetir,
  IcoSi,
  IcoSiempre,
  IcoSino,
  IcoVelocidad,
} from "./IconosAuto";
import {
  AJUSTES,
  EVOLUCION,
  MINERALES,
  ORDEN_MINERALES,
  precioEvolucion,
  precioMejora,
  type ClaveMejora,
  type Costo,
  type Mineral,
} from "../../data/automatizacion/balance";
import { alcanza, nivel, reveladas, type EstadoCampo } from "../../utils/automatizacion/motor";

/** Una tarjeta de la tienda: una mejora clásica o la evolución de un mineral. */
export type ClaveTienda = ClaveMejora | `evo_${Mineral}`;

const DIBUJO: Record<ClaveMejora, () => ReactElement> = {
  campo: () => <IcoCampo />,
  capacidad: () => <IcoMemoria />,
  velocidad: () => <IcoVelocidad />,
  crecimiento: () => <IcoCrecimiento />,
  repetir: () => <IcoPiezaRepetir />,
  esperar: () => (
    <IcoPieza color="#8fa3c8">
      <IcoEsperar />
    </IcoPieza>
  ),
  si: () => (
    <IcoPieza color="#3fc79b">
      <IcoSi />
    </IcoPieza>
  ),
  sino: () => (
    <IcoPieza color="#3fc79b">
      <IcoSi />
      <IcoSino />
    </IcoPieza>
  ),
  mientras: () => (
    <IcoPieza color="#2fb389">
      <IcoMientras />
    </IcoPieza>
  ),
  siempre: () => (
    <IcoPieza color="#f06aa8">
      <IcoSiempre />
    </IcoPieza>
  ),
};

const NOMBRE: Record<ClaveMejora, string> = {
  campo: "Más tierra",
  capacidad: "Más memoria",
  velocidad: "Nave más rápida",
  crecimiento: "Los cristales crecen más rápido",
  repetir: "Bloque repetir",
  esperar: "Bloque esperar",
  si: "Bloque si, con sensores",
  sino: "Bloque si y si no",
  mientras: "Bloque mientras",
  siempre: "Bloque por siempre",
};

/** Orden de aparición. Tierra primero: con el campo en 1×1 ninguna otra
 *  mejora tiene sentido todavía. Después las piezas, en el orden en que
 *  el campo las hace necesarias, y las evoluciones al final, en el
 *  orden de la cadena de minerales. */
const ORDEN: ClaveTienda[] = [
  "campo",
  "capacidad",
  "crecimiento",
  "velocidad",
  "repetir",
  "esperar",
  "si",
  "sino",
  "mientras",
  "siempre",
  ...ORDEN_MINERALES.map((m) => `evo_${m}` as const),
];

/** Un precio escrito con los cristales que pide. */
export function Precio({ costo, chico = false }: { costo: Costo; chico?: boolean }) {
  const tam = chico ? "w-[17px] h-[17px]" : "w-[21px] h-[21px]";
  return (
    <span className="auto-precio">
      {(Object.entries(costo) as [Mineral, number][]).map(([m, n]) => (
        <span key={m} className="auto-precio__parte">
          <IcoMineral mineral={m} className={tam} />
          {n}
        </span>
      ))}
    </span>
  );
}

function describir(costo: Costo): string {
  return (Object.entries(costo) as [Mineral, number][])
    .map(([m, n]) => `${n} ${MINERALES[m].nombre.toLowerCase()}${n === 1 ? "" : "s"}`)
    .join(" y ");
}

export function BarraMejoras({
  estado,
  onComprar,
}: {
  estado: EstadoCampo;
  onComprar: (clave: ClaveTienda) => boolean;
}) {
  const [corto, setCorto] = useState<string | null>(null);
  const visibles = reveladas(estado);
  /* Una pieza ya comprada vive en la caja: su tarjeta con tilde sería
     ruido, y con seis piezas la franja no entra. Se va de la tienda. */
  const esPieza = (c: ClaveTienda) => c in AJUSTES.mejoras && AJUSTES.mejoras[c as ClaveMejora].maxNivel === 1;
  const tarjetas = ORDEN.filter(
    (c) => visibles.includes(c) && !(esPieza(c) && nivel(estado, c as ClaveMejora) >= 1),
  );

  if (tarjetas.length === 0) return null;

  return (
    <div className="auto-mejoras auto-vidrio" aria-label="Mejoras">
      {tarjetas.map((clave) => {
        const esEvo = clave.startsWith("evo_");
        const mineral = esEvo ? (clave.slice(4) as Mineral) : null;
        const n = mineral ? (estado.niveles[mineral] ?? 1) : nivel(estado, clave as ClaveMejora);
        const precio = mineral ? precioEvolucion(mineral, n) : precioMejora(clave as ClaveMejora, n);
        const tope = precio === null;
        const puede = !tope && alcanza(estado, precio);
        const recien = !mineral && n === 0 && clave !== "campo";
        const nombre = mineral ? `Evolucionar ${MINERALES[mineral].nombre.toLowerCase()}` : NOMBRE[clave as ClaveMejora];

        return (
          <button
            key={clave}
            type="button"
            className={
              "auto-mejora" +
              (recien && puede ? " auto-mejora--nueva" : "") +
              (corto === clave ? " auto-mejora--corto" : "")
            }
            disabled={tope}
            aria-label={
              tope
                ? `${nombre}: al máximo`
                : `${nombre}${mineral ? ` al nivel ${n + 1}` : ""}, cuesta ${describir(precio)}`
            }
            onClick={() => {
              if (tope) return;
              if (!onComprar(clave)) {
                setCorto(clave);
                window.setTimeout(() => setCorto(null), 450);
              }
            }}
            style={tope ? { opacity: 0.45 } : undefined}
          >
            {mineral ? (
              <span className="auto-mejora__evo">
                <img
                  className="auto-mejora__cristal"
                  src={`/assets/automatizacion/cristales/${mineral}-maduro.webp`}
                  alt=""
                  draggable={false}
                />
                <IcoEvolucion className="auto-mejora__flecha" />
                <span className="auto-nivel" aria-hidden="true">
                  {Array.from({ length: EVOLUCION.nivelMaximo }, (_, i) => (
                    <span key={i} className={`auto-nivel__luz${i < n ? " auto-nivel__luz--on" : ""}`} />
                  ))}
                </span>
              </span>
            ) : (
              DIBUJO[clave as ClaveMejora]()
            )}
            <span className="auto-mejora__precio">{tope ? "✓" : <Precio costo={precio} />}</span>
          </button>
        );
      })}

      {/* Un hueco por cada categoría que todavía no se reveló, hasta
          cinco por fila, para que la franja no se reacomode entera
          cuando aparece una nueva. Es un contorno apenas visible, no un
          candado ni una tarjeta gris: dice "acá cabe algo" sin prometer
          nada. */}
      {Array.from({ length: Math.max(0, 5 - tarjetas.length) }, (_, i) => (
        <div key={`hueco-${i}`} className="auto-mejora auto-mejora--hueco" aria-hidden="true" />
      ))}
    </div>
  );
}
