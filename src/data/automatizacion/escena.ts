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

/** Lo mismo para la nave. El render trae mucho aire (antenas, margen),
 *  así que el número es más grande que el del cristal para llegar al
 *  mismo tamaño de casco.
 *
 *  Con 0.82 la nave era la pieza más chica del tablero, y la que más
 *  importa mirar. Con 1.06 el casco llena la baldosa y desborda apenas
 *  sobre el anillo, que es lo que la hace leer como el protagonista y no
 *  como una veta más. Sube junto con la elevación de `.auto-cuerpo`: una
 *  nave más grande apoyada en el piso tapa su propia sombra. */
export const ANCHO_NAVE = 1.06;

/** Cuántas vistas tiene la nave, repartidas en la vuelta entera. 0° es
 *  el norte, 90° el este; las intermedias son lo que la hace girar. */
export const VISTAS_NAVE = 16;

/* Cómo se traduce un RUMBO del campo a una vista del pliego. El render
 * no coincide con el rumbo en NINGUNA de las dos cosas que importan —ni
 * dónde empieza la vuelta ni para qué lado la recorre— y las dos se
 * corrigen acá, no en la tabla de rumbos, porque son propiedades del
 * ARTE: el día que se re-renderice el pliego mirando al norte y girando
 * como el reloj, estos dos números vuelven a 180→0 y −1→1, y no se toca
 * una línea de lógica.
 *
 * Leyendo las vistas contra la grilla: `r000` apunta abajo-izquierda
 * (SUR), `r090` abajo-derecha (ESTE) y `r180` arriba-derecha (NORTE).
 * O sea que el pliego recorre sur→este→norte mientras el rumbo va
 * norte→este→sur. De ahí sale `archivo = 180 − rumbo`.
 *
 * El norte y el sur caen bien con cualquiera de los dos signos —son el
 * eje de simetría de la fórmula—, así que un error de sentido no se ve
 * yendo derecho: se ve recién al girar, y la nave gira para el lado
 * contrario del que se le pidió. */

/** Dónde arranca la vuelta del pliego, en grados. */
export const AJUSTE_MODELO_NAVE = 180;

/** Para qué lado la recorre: −1 porque va al revés que el rumbo. */
export const SENTIDO_MODELO_NAVE = -1;

/** Tinte de cada mineral, para el resplandor que sólo emite el maduro.
 *  Es identidad, no valor: en el MVP los cuatro valen lo mismo. */
export const TINTE_VARIANTE = {
  punta: "#8ff0ff",
  racimo: "#d0a6ff",
  prisma: "#ffa8dc",
  estrella: "#ffdc6e",
} as const;
