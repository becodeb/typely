/* Los dibujos de los bloques y de las mejoras.
 *
 * La carcasa de cada bloque vive en CSS y las etiquetas en HTML. Los símbolos
 * usan SVG cuando necesitan color dinámico y assets raster cuando la pieza
 * tiene arte ilustrado; así el bloque puede estirarse sin deformar el dibujo.
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

/** Arte raster de los bloques; la carcasa y la etiqueta siguen siendo CSS/HTML. */
function BloqueAsset({ nombre, className, style }: Props & { nombre: string }) {
  return (
    <img
      src={`/assets/automatizacion/bloques/${nombre}.webp`}
      className={className}
      style={style}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

export function IcoAvanzar({ className }: Props) {
  return <BloqueAsset nombre="avanzar" className={className} />;
}

export function IcoRetroceder({ className }: Props) {
  return <BloqueAsset nombre="atras" className={className} />;
}

/* Las cuatro direcciones absolutas. Son la misma flecha girada de a 90°,
   a propósito: se leen como un solo grupo, y el chico reconoce el bloque
   por la punta de la flecha sin tener que leer el nombre. */
export function IcoArriba({ className }: Props) {
  return <BloqueAsset nombre="arriba" className={className} />;
}

function Flecha({ className, giro }: Props & { giro: number }) {
  return <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
    <g transform={`rotate(${giro} 17 17)`}>
      <path d="M14 29h6a2 2 0 0 0 2-2V17h6c2 0 2-2 1-3L19 4a3 3 0 0 0-4 0L5 14c-1 1-1 3 1 3h6v10a2 2 0 0 0 2 2Z" fill="currentColor" />
      <path d="m10 13 7-7 7 7M16 20v5" fill="none" stroke="var(--auto-color, #65a8ef)" strokeWidth="2" strokeLinecap="round" opacity=".5" />
    </g>
  </svg>;
}

export function IcoDerecha({ className }: Props) {
  return <BloqueAsset nombre="derecha" className={className} />;
}

export function IcoAbajo({ className }: Props) {
  return <BloqueAsset nombre="abajo" className={className} />;
}

export function IcoIzquierda({ className }: Props) {
  return <BloqueAsset nombre="izquierda" className={className} />;
}

export function IcoGirarIzq({ className }: Props) {
  return <BloqueAsset nombre="girar-izquierda" className={className} />;
}

export function IcoGirarDer({ className }: Props) {
  return <BloqueAsset nombre="girar-derecha" className={className} />;
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
  return <BloqueAsset nombre="cosechar" className={className} />;
}

export function IcoRepetir({ className }: Props) {
  return <BloqueAsset nombre="repetir" className={className} />;
}

/** Esperar: un reloj de arena. La paciencia explícita. */
export function IcoEsperar({ className }: Props) {
  return <BloqueAsset nombre="esperar" className={className} />;
}

/** Por siempre: el lazo sin fin. */
export function IcoSiempre({ className }: Props) {
  return <BloqueAsset nombre="por-siempre" className={className} />;
}

/** Si: la flecha que se bifurca. Una rama sigue, la otra se desvía. */
export function IcoSi({ className, style }: Props) {
  return <BloqueAsset nombre="si" className={className} style={style} />;
}

/** Si no: la otra rama. */
export function IcoSino({ className, style }: Props) {
  return <BloqueAsset nombre="sino" className={className} style={style} />;
}

/** Mientras: la vuelta que sigue mientras el sensor diga que sí. */
export function IcoMientras({ className }: Props) {
  return <BloqueAsset nombre="mientras" className={className} />;
}

/** Mi rutina: una libreta más chica adentro de la libreta grande — la
 *  definición que se puede llamar más de una vez sin volver a escribirla. */
export function IcoRutina({ className }: Props) {
  return <BloqueAsset nombre="rutina" className={className} />;
}

/** Hacer: la flecha que salta a leer esa libreta chica y vuelve. */
export function IcoHacer({ className }: Props) {
  return <BloqueAsset nombre="hacer-rutina" className={className} />;
}

/** Contador +1: un dial con la flecha subiendo — el odómetro que suma
 *  uno. Turquesa por `--auto-color` en el bloque, como cualquier hoja. */
export function IcoContadorMas({ className }: Props) {
  return <BloqueAsset nombre="contador-mas" className={className} />;
}

/** Contador = 0: el mismo dial, con el centro marcado y una flecha que
 *  vuelve — el reinicio, distinto de un vistazo del `+1`. */
export function IcoContadorCero({ className, style }: Props) {
  return <BloqueAsset nombre="contador-cero" className={className} style={style} />;
}

/* --------------------------- sensores --------------------------- */

/** El contador, como sensor: el mismo dial de las piezas, en la paleta
 *  de colores planos que usan las demás pastillas (no `currentColor`:
 *  la pastilla vive sobre fondo blanco). El valor elegido se muestra
 *  aparte, en la ranura numérica — este dibujo no lleva número. */
export function IcoSensorContador({ className, style }: Props) {
  return <img src="/assets/automatizacion/ui/contador.webp" className={className} style={style} alt="" draggable={false} />;
}

/** `tamaño del campo`: la isla vista de arriba, en una grilla de cuatro.
 *  Dibujado en `currentColor` porque vive DENTRO de una ranura numérica
 *  —reemplaza al dígito, nunca lo acompaña— y tiene que heredar el color
 *  del texto de ese botón (`.auto-repetir__veces`). */
export function IcoTamanoCampo({ className, style }: Props) {
  return <img src="/assets/automatizacion/ui/tamano.webp" className={className} style={style} alt="" draggable={false} />;
}

/** Está listo: el cristal con una tilde. */
export function IcoSensorListo({ className, style }: Props) {
  return <BloqueAsset nombre="sensor-listo" className={className} style={style} />;
}

/** Está vacía: el anillo del zócalo sin nada adentro. */
export function IcoSensorVacia({ className, style }: Props) {
  return <img src="/assets/automatizacion/ui/vacia.webp" className={className} style={style} alt="" draggable={false} />;
}

/** Hay borde adelante: la nave contra la pared del campo. */
export function IcoSensorBorde({ className, style }: Props) {
  return <img src="/assets/automatizacion/ui/borde.webp" className={className} style={style} alt="" draggable={false} />;
}

/** La barra del "no": cruza cualquier sensor. */
export function IcoNo({ className, style }: Props) {
  return <img src="/assets/automatizacion/ui/no.webp" className={className} style={style} alt="" draggable={false} />;
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
  return <img src={`/assets/automatizacion/ui/${mineral}.webp`} className={className} style={style} alt="" draggable={false} />;
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
  return <BloqueAsset nombre="plantar" className={className} />;
}

/** Preparar tierra: herramienta que despeja la baldosa antes de plantar. */
export function IcoPrepararTierra({ className }: Props) {
  return <BloqueAsset nombre="preparar-tierra" className={className} />;
}

/** Evolucionar: un cristal que sube de nivel. Chispa arriba a la
 *  derecha y una flecha corta. */
export function IcoEvolucion({ className, style }: Props) {
  return <img src="/assets/automatizacion/ui/evolucion.webp" className={className} style={style} alt="" draggable={false} />;
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
export function IcoCampo({ className, style }: Props) {
  return <img src="/assets/automatizacion/ui/campo.webp" className={className} style={style} alt="" draggable={false} />;
}

/** La hilera de luces de memoria del taller, con una luz más que se
 *  enciende: exactamente lo que cambia al comprar. */
export function IcoMemoria({ className, style }: Props) {
  return <img src="/assets/automatizacion/ui/memoria.webp" className={className} style={style} alt="" draggable={false} />;
}

/** La nave —platillo con cúpula, la misma silueta del bloque cosechar—
 *  dejando estela. */
export function IcoVelocidad({ className, style }: Props) {
  return <img src="/assets/automatizacion/ui/velocidad.webp" className={className} style={style} alt="" draggable={false} />;
}

/** El cristal —la silueta de la moneda— junto a un reloj que corre. */
export function IcoCrecimiento({ className, style }: Props) {
  return <img src="/assets/automatizacion/ui/crecimiento.webp" className={className} style={style} alt="" draggable={false} />;
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

/** El bloque `Mi rutina`/`Hacer` tal como se ve en la tienda: una ficha
 *  violeta con la libreta chica y las tres letras que se pueden nombrar. */
export function IcoPiezaRutinas({ className }: Props) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <path
        d="M5 8h5l2.5 3h7L22 8h9a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z"
        fill="#7c71ff"
      />
      <path
        d="M11 14h14a2 2 0 0 1 2 2v12l-3-2.2-3 2.2-3-2.2-3 2.2-3-2.2-3 2.2V16a2 2 0 0 1 2-2z"
        fill="#fff"
        opacity="0.92"
      />
      <text
        x="18"
        y="24"
        style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 8.5 }}
        fill="#7c71ff"
        textAnchor="middle"
      >
        A B C
      </text>
    </svg>
  );
}

/** El ancla del lienzo: un cohete despegando, sobre el bloque verde fijo.
 *  Sin texto —el bloque mismo dice "acá empieza"— y a pura silueta, para
 *  que se lea a 28 px igual que el resto de los dibujos de bloque. */
export function IcoInicio({ className, style }: Props) {
  return <img src="/assets/automatizacion/ui/inicio.webp" className={className} style={style} alt="" draggable={false} />;
}

/** Recentrar: la mira que vuelve a encuadrar el ancla del lienzo. */
export function IcoRecentrar({ className, style }: Props) {
  return <img src="/assets/automatizacion/ui/centrar.webp" className={className} style={style} alt="" draggable={false} />;
}

/** La flecha de "hay más piezas para allá": marca un grupo de bloques que
 *  quedó fuera del viewport del lienzo. Dibujada apuntando a la DERECHA
 *  (0°) a propósito: quien la usa la gira con un solo `rotate`, y un
 *  ángulo en pantalla se lee directamente del `atan2` sin sumarle
 *  ninguna corrección. Las tres rayitas de atrás son estela: dicen
 *  "esto viene de lejos", no sólo "para allá". */
export function IcoLejos({ className, style }: Props) {
  return <img src="/assets/automatizacion/ui/lejos.webp" className={className} style={style} alt="" draggable={false} />;
}

/** El tachito: la papelera del lienzo (tarea 3.1). Tapa con asa y tres
 *  costillas adentro del cuerpo, la misma silueta de siempre para que se
 *  lea como "basura" sin necesidad de texto. */
export function IcoTachito({ className, style }: Props) {
  return <img src="/assets/automatizacion/ui/papelera.webp" className={className} style={style} alt="" draggable={false} />;
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
