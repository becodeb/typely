/* Los dibujos de los bloques y de las mejoras.
 *
 * Van en SVG y no como imágenes por la misma razón que los bloques van
 * en CSS: tienen que cambiar de tamaño y de color según el estado, y una
 * imagen no hace ninguna de las dos cosas.
 *
 * Ninguno lleva texto. Un bloque se reconoce por dibujo, forma y color
 * (MVP.md §3, "lectura mínima"); el nombre existe sólo como `aria-label`
 * para quien navega con teclado o lector de pantalla.
 */

import type { CSSProperties, ReactNode } from "react";
import type { Mineral } from "../../data/automatizacion/balance";

type Props = { className?: string; style?: CSSProperties };

const trazo = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 5.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IcoAvanzar({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <path d="M17 29V9M17 5l-9 9M17 5l9 9" {...trazo} />
    </svg>
  );
}

export function IcoRetroceder({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <path d="M17 5v20M17 29l-9-9M17 29l9-9" {...trazo} />
    </svg>
  );
}

export function IcoGirarIzq({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <path d="M25 29V19a8 8 0 0 0-8-8H8" {...trazo} />
      <path d="M14 5 7 11l7 6" {...trazo} />
    </svg>
  );
}

export function IcoGirarDer({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <path d="M9 29V19a8 8 0 0 1 8-8h9" {...trazo} />
      <path d="m20 5 7 6-7 6" {...trazo} />
    </svg>
  );
}

/** La nave levantando el cristal con su rayo: es literalmente lo que
 *  pasa en el campo cuando este bloque se ejecuta.
 *
 *  Tres formas y nada más, porque se dibuja a 31 px: el platillo arriba
 *  (la silueta de la nave real), el cono de luz que baja, y adentro del
 *  cono el cristal —la misma silueta hexagonal que la moneda del saldo,
 *  así el chico liga "este bloque" con "esos cristales de arriba". Las
 *  facetas del cristal van del color del bloque para que no sea un
 *  óvalo blanco. */
export function IcoCosechar({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      {/* el cono de luz */}
      <path d="M12.5 9.5h9L29 32H5z" fill="currentColor" opacity="0.32" />
      {/* el platillo: cúpula y casco */}
      <path d="M13.4 6.2a3.6 3.6 0 0 1 7.2 0z" fill="currentColor" />
      <ellipse cx="17" cy="8.4" rx="10" ry="3.1" fill="currentColor" />
      <ellipse cx="17" cy="9.1" rx="6" ry="1.4" fill="var(--auto-color, #f5b73c)" opacity="0.55" />
      {/* el cristal, subiendo por el rayo */}
      <path d="M17 14.5l5 5.2v7.6l-5 5.2-5-5.2v-7.6z" fill="currentColor" />
      <path
        d="M17 14.5v18M12 19.7h10"
        fill="none"
        stroke="var(--auto-color, #f5b73c)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}

export function IcoRepetir({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <path d="M7 17a10 10 0 1 1 3.6 7.7" {...trazo} />
      <path d="M2.6 12 7.4 17 12 12" {...trazo} />
    </svg>
  );
}

/** Esperar: un reloj de arena. La paciencia explícita. */
export function IcoEsperar({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <path d="M9 4h16M9 30h16M11 4c0 7 6 8 6 13s-6 6-6 13M23 4c0 7-6 8-6 13s6 6 6 13" {...trazo} strokeWidth="4" />
      <path d="M14 26h6l-3-4z" fill="currentColor" />
    </svg>
  );
}

/** Por siempre: el lazo sin fin. */
export function IcoSiempre({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <path d="M17 17c-3-5-5-7-8.5-7a7 7 0 1 0 0 14c3.5 0 5.5-2 8.5-7s5-7 8.5-7a7 7 0 1 1 0 14c-3.5 0-5.5-2-8.5-7Z" {...trazo} strokeWidth="4.6" />
    </svg>
  );
}

/** Si: la flecha que se bifurca. Una rama sigue, la otra se desvía. */
export function IcoSi({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <path d="M17 30V15M17 15l-9-8M17 15l9-8" {...trazo} strokeWidth="4.6" />
      <path d="M4 10l4-3 1 5M30 10l-4-3-1 5" {...trazo} strokeWidth="3.6" />
    </svg>
  );
}

/** Si no: la otra rama. */
export function IcoSino({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <path d="M8 6v10a6 6 0 0 0 6 6h12" {...trazo} strokeWidth="4.2" />
      <path d="M21 16l6 6-6 6" {...trazo} strokeWidth="4.2" />
    </svg>
  );
}

/** Mientras: la vuelta que sigue mientras el sensor diga que sí. */
export function IcoMientras({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <path d="M27 17a10 10 0 1 1-3.6-7.7" {...trazo} strokeWidth="4.6" />
      <path d="M31.4 12 26.6 17 22 12" {...trazo} strokeWidth="4.6" />
      <path d="M12.5 17.5l3 3 5.5-6" {...trazo} strokeWidth="3.6" />
    </svg>
  );
}

/* --------------------------- sensores --------------------------- */

/** Está listo: el cristal con una tilde. */
export function IcoSensorListo({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <path d="M13 4l5 5.5v9l-5 5.5-5-5.5v-9z" fill="#7ff0e0" stroke="#25c8df" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13 4v20M8 9.5h10" stroke="#fff" strokeWidth="1.3" opacity="0.9" />
      <circle cx="25" cy="24" r="7.5" fill="#54e8c6" />
      <path d="M21.5 24l2.6 2.6 4.6-5" fill="none" stroke="#0d3b46" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Está vacía: el anillo del zócalo sin nada adentro. */
export function IcoSensorVacia({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <ellipse cx="17" cy="20" rx="12" ry="6.5" fill="#d8bff5" stroke="#b48ae0" strokeWidth="1.8" />
      <ellipse cx="17" cy="20" rx="7" ry="3.6" fill="#b48ae0" opacity="0.6" />
      <path d="M17 7.5q.5 2.4 2.9 2.9-2.4.5-2.9 2.9-.5-2.4-2.9-2.9 2.4-.5 2.9-2.9Z" fill="#fff" opacity="0.9" />
    </svg>
  );
}

/** Hay borde adelante: la nave contra la pared del campo. */
export function IcoSensorBorde({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <path d="M17 26V12M17 8l-6 6M17 8l6 6" fill="none" stroke="#7c66bd" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 5h24" stroke="#e0459a" strokeWidth="4" strokeLinecap="round" />
      <path d="M8 5v3M14 5v3M20 5v3M26 5v3" stroke="#e0459a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** La barra del "no": cruza cualquier sensor. */
export function IcoNo({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <circle cx="17" cy="17" r="14" fill="none" stroke="#e0344a" strokeWidth="3.2" />
      <path d="M7 27L27 7" stroke="#e0344a" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

/** Una pieza de control tal como se ve en la caja, para la tienda: una
 *  ficha del color del bloque con su dibujo adentro. */
export function IcoPieza({ color, className, children }: Props & { color: string; children: ReactNode }) {
  return (
    <span className={`auto-ficha ${className ?? ""}`} style={{ "--auto-color": color } as CSSProperties}>
      {children}
    </span>
  );
}

/** Paleta de cada mineral para el ícono de la moneda: cara iluminada,
 *  cara en sombra, corona, halo. El mismo tallado, cuatro piedras. */
const PALETA: Record<Mineral, { izq: [string, string]; der: [string, string]; corona: string; cara: string; halo: string }> = {
  punta: { izq: ["#bff7ff", "#4fc9e8"], der: ["#5ad8f0", "#2b8fd6"], corona: "#a5edff", cara: "#d8f7ff", halo: "#7fe8ff" },
  racimo: { izq: ["#efe4ff", "#a67cf5"], der: ["#b58cff", "#6e45d6"], corona: "#dcc8ff", cara: "#efe4ff", halo: "#c9a8ff" },
  prisma: { izq: ["#ffe4f3", "#ff7fc0"], der: ["#ff8fca", "#e0459a"], corona: "#ffc9e8", cara: "#ffeaf6", halo: "#ffa8dc" },
  estrella: { izq: ["#fff5cc", "#ffc83d"], der: ["#ffd25a", "#e8a20c"], corona: "#ffe9a0", cara: "#fff7d6", halo: "#ffdc6e" },
};

/** El cristal en bruto: la moneda del campo, una por mineral.
 *
 *  Es el ícono que más se ve en la pantalla —está en cada contador y en
 *  cada precio— así que está tallado y no dibujado con una silueta plana:
 *  cada faceta tiene su propio degradado, y son esas diferencias entre
 *  caras vecinas las que hacen que se lea como un volumen. Una gema de
 *  un solo color plano parece una calcomanía por más contorno que tenga.
 *
 *  Deliberadamente distinto de la gema tallada de Órbita: son la misma
 *  sustancia en dos estados —bruto y puro— y NO son la misma billetera.
 *  El chico tiene que poder distinguirlas de un vistazo. */
export function IcoMineral({ mineral, className, style }: Props & { mineral: Mineral }) {
  const id = `cr-${mineral}`;
  const p = PALETA[mineral];
  return (
    <svg viewBox="0 0 32 32" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-izq`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.izq[0]} />
          <stop offset="1" stopColor={p.izq[1]} />
        </linearGradient>
        <linearGradient id={`${id}-der`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.der[0]} />
          <stop offset="1" stopColor={p.der[1]} />
        </linearGradient>
        <linearGradient id={`${id}-corona`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor={p.corona} />
        </linearGradient>
      </defs>

      {/* halo, muy tenue: le da el aire de piedra que brilla sola */}
      <ellipse cx="16" cy="17" rx="12" ry="13" fill={p.halo} opacity="0.18" />

      {/* corona: las dos caras de arriba */}
      <path d="M16 2.5 9.2 10h13.6z" fill={`url(#${id}-corona)`} />
      <path d="M16 2.5 22.8 10 16 10z" fill={p.cara} opacity="0.85" />

      {/* cuerpo: cara iluminada y cara en sombra */}
      <path d="M9.2 10h6.8v19.5z" fill={`url(#${id}-izq)`} />
      <path d="M22.8 10h-6.8v19.5z" fill={`url(#${id}-der)`} />

      {/* aristas: finas y claras, nunca un contorno negro */}
      <path
        d="M16 2.5 9.2 10l6.8 19.5L22.8 10zM9.2 10h13.6M16 2.5V10"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.1"
        strokeLinejoin="round"
        opacity="0.9"
      />

      {/* chispa especular arriba a la izquierda, como el resto del arte */}
      <path d="M12.4 12.2q.5 2.6 2.6 3.2-2.1.6-2.6 3.2-.5-2.6-2.6-3.2 2.1-.6 2.6-3.2Z" fill="#fff" opacity="0.9" />
    </svg>
  );
}

/** La chispa, la moneda del primer día. */
export function IcoCristal(props: Props) {
  return <IcoMineral mineral="punta" {...props} />;
}

/** Plantar: la mano de la nave dejando un cristalito en la tierra. Una
 *  flecha que baja y el brote del mineral apoyado en una línea de suelo.
 *  El brote va en blanco con facetas del color del bloque, como el
 *  cristal del bloque cosechar. */
export function IcoPlantar({ className }: Props) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <path d="M17 3v11M17 14l-5-5M17 14l5-5" {...trazo} strokeWidth="4.6" />
      <path d="M17 17l4 4.2v5.6L17 31l-4-4.2v-5.6z" fill="currentColor" />
      <path d="M17 17v14M13 21.2h8" fill="none" stroke="var(--auto-color, #888)" strokeWidth="1.4" opacity="0.75" />
      <path d="M5 31h6M23 31h6" {...trazo} strokeWidth="3.4" opacity="0.8" />
    </svg>
  );
}

/** Evolucionar: un cristal que sube de nivel. Chispa arriba a la
 *  derecha y una flecha corta. */
export function IcoEvolucion({ className }: Props) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#fff" stroke="#25c8df" strokeWidth="1.6" />
      <path d="M10 14.5v-8M10 6.5l-3.2 3.2M10 6.5l3.2 3.2" fill="none" stroke="#25c8df" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IcoProduccion({ className }: Props) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 27V9M16 5l-9 9M16 5l9 9" fill="none" stroke="#22c7b8" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/* --------------------------- mejoras --------------------------- */

/* Cada mejora se dibuja con LO QUE CAMBIA en pantalla, no con un símbolo
   abstracto: la tierra es la isla con una baldosa nueva encendida; la
   memoria es la hilera de luces del taller con una luz más; la velocidad
   es la nave real con estela; el crecimiento es el cristal con un reloj.
   Un chico que no lee tiene que poder señalar en la pantalla qué va a
   pasar si compra esto. */

/** La isla vista igual que en el campo, con la baldosa nueva encendida. */
export function IcoCampo({ className }: Props) {
  // Rombos isométricos de 16×8, con el canto violeta debajo.
  const baldosa = (cx: number, cy: number, fill: string, stroke: string) => (
    <path d={`M${cx} ${cy - 4}l8 4-8 4-8-4z`} fill={fill} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
  );
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      {/* el canto de la isla */}
      <path d="M2 16.5v5l16 8 16-8v-5l-16 8z" fill="#b48ae0" />
      <path d="M2 16.5v5l16 8v-5z" fill="#9f74d3" />
      {/* las tres baldosas de siempre */}
      {baldosa(18, 8.5, "#d8bff5", "#b48ae0")}
      {baldosa(10, 12.5, "#d8bff5", "#b48ae0")}
      {baldosa(18, 16.5, "#d8bff5", "#b48ae0")}
      {/* la baldosa nueva, con la junta de luz turquesa */}
      {baldosa(26, 12.5, "#eafffb", "#25c8df")}
      <path d="M26 5.6q.6 2.4 2.9 2.9-2.3.5-2.9 2.9-.6-2.4-2.9-2.9 2.3-.5 2.9-2.9Z" fill="#fff" />
      <circle cx="29" cy="28" r="6.5" fill="#25c8df" />
      <path d="M29 24.8v6.4M25.8 28h6.4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** La hilera de luces de memoria del taller, con una luz más que se
 *  enciende: exactamente lo que cambia al comprar. */
export function IcoMemoria({ className }: Props) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <rect x="2" y="11" width="32" height="14" rx="7" fill="#e6dcff" stroke="#b9a3e8" strokeWidth="1.6" />
      <circle cx="9.5" cy="18" r="3.6" fill="#25c8df" />
      <circle cx="18" cy="18" r="3.6" fill="#25c8df" />
      <circle cx="26.5" cy="18" r="3.6" fill="#fff" stroke="#b9a3e8" strokeWidth="1.4" strokeDasharray="2.2 1.6" />
      <circle cx="29" cy="28" r="6.5" fill="#25c8df" />
      <path d="M29 24.8v6.4M25.8 28h6.4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** La nave —platillo con cúpula, la misma silueta del bloque cosechar—
 *  dejando estela. */
export function IcoVelocidad({ className }: Props) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <path d="M3 14h8M1.5 19.5h11M4 25h7" stroke="#9b7cff" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <path d="M18.5 15.5a5 5 0 0 1 10 0z" fill="#b9a3e8" />
      <path d="M18.5 15.5a5 5 0 0 1 10 0z" fill="#d8ecff" opacity="0.6" />
      <ellipse cx="23.5" cy="19" rx="11" ry="4.2" fill="#fff" stroke="#7c66bd" strokeWidth="1.6" />
      <ellipse cx="23.5" cy="19.6" rx="6" ry="1.6" fill="#54e8c6" opacity="0.8" />
      <circle cx="30.5" cy="22.5" r="1.6" fill="#25c8df" />
    </svg>
  );
}

/** El cristal —la silueta de la moneda— junto a un reloj que corre. */
export function IcoCrecimiento({ className }: Props) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <path d="M13 3l6 6.5v10L13 26l-6-6.5v-10z" fill="#7ff0e0" stroke="#25c8df" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13 3v23M7 9.5h12" stroke="#fff" strokeWidth="1.4" opacity="0.9" />
      <circle cx="27" cy="25.5" r="7.5" fill="#fff" stroke="#7c66bd" strokeWidth="2" />
      <path d="M27 21.2v4.6l3.2 2" stroke="#7c66bd" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M23 15.5l1.5 3M31 15.5l-1.5 3" stroke="#7c66bd" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** El bloque `Repetir` tal como se va a ver en la caja de piezas: una
 *  ficha rosa con la flecha que da la vuelta. En la tienda dice "una
 *  pieza nueva", no "un símbolo". */
export function IcoPiezaRepetir({ className }: Props) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <path
        d="M5 8h5l2.5 3h7L22 8h9a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z"
        fill="#ff8fc0"
      />
      <path d="M11 19a7 7 0 1 1 2.6 5.4" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M8 15.5l3.2 3.5 3.3-3.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <text
        x="24"
        y="23.5"
        style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 11 }}
        fill="#fff"
        textAnchor="middle"
      >
        3
      </text>
    </svg>
  );
}

/** El destello de cuatro puntas del mundo: marca el zócalo vacío donde
 *  todavía no brotó nada. */
export function Destello({ className, style }: Props) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={style} aria-hidden="true">
      <path
        d="M20 2q2 14 18 18Q22 24 20 38 18 24 2 20 18 16 20 2Z"
        fill="#eafffb"
        opacity="0.95"
      />
    </svg>
  );
}
