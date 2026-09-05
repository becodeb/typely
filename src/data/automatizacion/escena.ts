/* Cómo se apoyan las piezas sobre la isla: el contrato entre el arte y
 * el campo.
 *
 * Estos números los leen TRES lugares —CampoCristales.tsx, que dibuja;
 * scripts/importar-cristales-verde.mjs, que arma las piezas; y
 * scripts/import-automatizacion-art.mjs, que las verifica— y por eso
 * viven acá y no repetidos en cada uno. Los scripts los compilan al
 * vuelo con esbuild, igual que el examen del motor: si alguien cambia
 * el ancla o el tamaño en pantalla, el pliego de contacto se arma con
 * el número nuevo y no con uno recordado.
 *
 * La regla de composición (PROGRESION.md §8): LA ISLA ES EL TABLERO, los
 * cristales viven en el tablero y la nave se mueve por él. Todo lo de
 * acá está pensado para que esa jerarquía se lea de un vistazo.
 */

/** Punto de apoyo de cada pieza, en fracción de su lienzo cuadrado. Esa
 *  coordenada ES "el centro de la baldosa": es lo que permite cambiar
 *  cualquier pieza por otra sin mover una sola posición. */
export const ANCLA_PIEZA = { x: 0.5, y: 0.75 } as const;

/** Cuánto del visor ocupa la isla. Menos que todo: la isla es un tablero
 *  visto desde arriba, no un primer plano, y con aire alrededor los
 *  cristales que sobresalen por arriba no se cortan. */
export const ESCALA_ESCENA = 0.82;

/** Ancho del lienzo de un cristal, en PASOS DE BALDOSA (no en píxeles:
 *  así vale para las cuatro islas, dibujadas a escalas distintas).
 *
 *  El lienzo trae aire transparente alrededor, por eso llega a 1. Con
 *  1.0, el maduro más alto mide ~0.6 baldosas y el prisma, el más ancho,
 *  ocupa el anillo sin tapar la baldosa de atrás. Más grande y los
 *  cristales se adelantan a la isla en vez de nacer de ella. */
export const ANCHO_CRISTAL = 1.0;

/** Lo mismo para la nave. El render trae mucho aire (antenas, margen), y
 *  con 0.82 el casco ocupa el anillo de la baldosa sin desbordarlo: se
 *  entiende en qué baldosa está parada. */
export const ANCHO_NAVE = 0.82;

/** Cuántas vistas tiene la nave, repartidas en la vuelta entera. 0° es
 *  el norte, 90° el este; las intermedias son lo que la hace girar. */
export const VISTAS_NAVE = 16;

/** Dónde se estaciona la nave dentro de su baldosa cuando está quieta,
 *  en fracción del medio paso (pasoX, pasoY): corrida hacia el frente y
 *  la derecha, así la veta que crece en el muelle queda a la vista en
 *  vez de tapada. Al arrancar vuelve al centro: se la ve salir. */
export const DESVIO_MUELLE = { x: 0.34, y: 0.62 } as const;

/** Tinte de cada mineral, para el resplandor que sólo emite el maduro.
 *  Es identidad, no valor: en el MVP los cuatro valen lo mismo. */
export const TINTE_VARIANTE = {
  punta: "#8ff0ff",
  racimo: "#d0a6ff",
  prisma: "#ffa8dc",
  estrella: "#ffdc6e",
} as const;
