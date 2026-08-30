import type { Activity } from "./activities";

/* =====================================================================
   LEVEL MARKER POSITIONS  ·  single source of truth
   ---------------------------------------------------------------------
   Each entry is the position of a level marker over its island artwork,
    expressed as PERCENTAGES of the level map container (the level-map
    <section> in IslandDetailPage, which covers the whole island stage):

     x → horizontal %, 0 = left edge, 100 = right edge
     y → vertical %,   0 = top edge,  100 = bottom edge

   The marker is centered on (x, y) — CSS applies translate(-50%, -50%) —
   so x/y is the CENTER of the level bubble, which should sit on the
   center of the painted platform.

   These are percentages (never pixels), so they stay aligned when the
   screen resizes. The island background uses object-fit: cover, so for
   pixel-perfect placement edit at the aspect ratio you ship at.

   HOW TO EDIT BY HAND:
     - Tweak the numbers below, or
     - Open an island in dev with the visual editor (see
       src/components/dev/LevelPositionEditor + IslandDetailPage):
         1. visit  /worlds/<islandId>?editor=1   (dev build only)
         2. drag each numbered marker onto its platform
         3. click "Copiar arreglo" and paste the array back here.

   Level counts vary per island (6, 7 or 8) — each array keeps exactly the
   number of markers that island needs; they are not padded to a fixed size.
===================================================================== */

export type LevelPosition = {
  x: number;
  y: number;
  /** Uniform scale (1 = normal). */
  scale?: number;
  /** 3D tilt backward/forward in degrees. Positive = top tilts away, like lying on the ground. */
  rotateX?: number;
  /** 3D tilt left/right in degrees. */
  rotateY?: number;
  /** 2D spin rotation in degrees. */
  rotateZ?: number;
  /** Perspective depth in px. Lower = stronger 3D effect (camera closer). Default ~500. */
  perspective?: number;

  /* ── El número encima del botón ────────────────────────────────────
     El número se dibuja en el centro de la caja del nodo, que es el
     centro del PNG. Cuando un nodo se inclina o se agranda, ese centro
     deja de coincidir con el centro visible del disco, y el número queda
     corrido. Estos tres campos lo reacomodan por nivel.

     numX/numY van en % del ANCHO DEL BOTÓN (unidad cqw), no en píxeles:
     el nodo declara container-type: inline-size, así que el número se
     mueve junto con el botón en cualquier resolución. Un valor de 5
     desplaza el número un 5 % del ancho del botón.                    */

  /** Corrimiento horizontal del número, en % del ancho del botón. + derecha. */
  numX?: number;
  /** Corrimiento vertical del número, en % del ancho del botón. + abajo. */
  numY?: number;
  /** Tamaño del número relativo al normal (1 = normal). */
  numSize?: number;

  /* Al apretarse, el disco del botón se HUNDE, y cuánto se hunde lo decide el
     dibujo de cada isla: no es el mismo salto en una galleta que en un aro de
     piedra. Estos dos campos son la posición del número en el estado apretado.
     Si no están, se usa la de reposo con el hundido genérico, que es lo que
     hacía antes para las quince por igual y en varias quedaba corrido. */

  /** Corrimiento horizontal del número con el botón apretado, en % del ancho. */
  numXHover?: number;
  /** Corrimiento vertical del número con el botón apretado, en % del ancho. */
  numYHover?: number;
};

/* Per-island level marker positions, placed by hand with the visual editor
   over each island's painted platforms. Coordinates are percentages of the
   ISLAND IMAGE itself — NOT the viewport. islandDetailPage translates them
   to container-relative at render time, which keeps nodes aligned to the
   painted platforms on every screen size regardless of object-fit cropping.

   Each island keeps its own level count (6, 7 or 8) and the order matches
   the level order (index 0 = level 1, index 1 = level 2, …). */
export const islandLevelLayouts: Record<Activity["worldId"], LevelPosition[]> = {
  island1: [
    { x: 33.5, y: 56.6, scale: 1.92, rotateX: -11, perspective: 290, numX: -7, numY: -32, numSize: 1.35, numYHover: -29 },
    { x: 25.7, y: 43.3, scale: 1.84, rotateX: 27.5, numX: -6, numY: -24.5, numSize: 1.1 },
    { x: 41.7, y: 33.9, scale: 1.84, rotateX: 39.5, rotateZ: 0.5, numX: -3, numY: -21, numSize: 0.96 },
    { x: 62.8, y: 28.7, scale: 1.82, rotateX: 43.5, rotateY: -3.5, rotateZ: 6.5, numX: -3, numY: -18.5, numSize: 0.93 },
    { x: 75.6, y: 38.3, scale: 1.8, rotateX: 27, rotateY: 4.5, numX: -5.5, numY: -22 },
    { x: 60.3, y: 51.7, scale: 1.88, rotateX: 10.5, perspective: 80, numX: -8, numY: -27 },
    { x: 76.5, y: 57.7, scale: 1.91, rotateX: 18.5, rotateY: 8, perspective: 670, numX: -5, numY: -25.5, numSize: 1.19 },
  ],

  island2: [
    /* Isla de palabras — island.webp (1193x930). 7 niveles, 7 discos.

       -- Recolocada sobre los anillos del pedestal (2026-08-29) -----------
       El arte se re-importó recortado (antes 1672x941): mismo dibujo pero la
       caja perdió los márgenes laterales, así que TODOS los % de x se
       corrieron y hubo que volver a medir. Medido con
       node scripts/measure-pedestal.mjs (tolerancia 36) y verificado con
       node scripts/preview-level-positions.mjs island2

       CENTRO. La referencia es el ANILLO del pedestal (el circulo que forman
       las divisiones de los ladrillos), no el borde exterior: el borde se
       confunde con el canto y con el pasto, y arrastra el centro. Como los
       circulos concentricos de un plano proyectan elipses concentricas, el
       centro del anillo ES el centro de la plataforma.

       ROTACION. Si el anillo se ve ovalado es porque esta en escorzo, y el
       boton tiene que acostarse igual. La BASE de level.png (la elipse gris
       que se apoya — NO el bbox del dibujo, que incluye la tapa azul que
       sobresale) trae un ratio 0.553 horneado. rotateX(alfa) la achata por
       cos(alfa), asi que para un anillo de ratio r = alto/ancho EN PIXELES:

           alfa = acos(r / 0.553)

       El ratio baja con la distancia: ~0.537 en los discos de abajo (16°)
       hasta ~0.500 en los de arriba (25°). Ese gradiente es la perspectiva
       de la escena.

       perspective: 4000 ~ ortografico, condicion para que valga el cos(alfa).

       TAMANO. El boton visible ocupa ~92 % del ancho del anillo (cobertura
       por defecto del script). Al convertir, ojo: el dibujo solo llena
       454/600 del ancho de su lienzo.

       NOTA DE ASSET. public/assets/level.png se re-encuadro de 600x378 a
       600x445 para que el centro del lienzo caiga sobre el centro de la base.
       Antes tenia 81px de margen arriba y 29 abajo, y el boton salia corrido
       hacia abajo en TODAS las islas. El original esta en _backups/.
    */
    { x: 55.4, y: 32.8, scale: 2.24, rotateX: 13.9, perspective: 4000, numX: -3, numY: -23.5 },  // N1 — disco abajo-centro    (anillo 0.537, el más cercano → casi sin inclinar)
    { x: 76.4, y: 40.3, scale: 2.36, rotateX: 16.4, perspective: 4000, numY: -23.5 },  // N2 — disco abajo-izquierda (anillo 0.531)
    { x: 74, y: 64.8, scale: 2.69, perspective: 4000, numY: -27.5 },  // N3 — disco medio-izquierda (anillo 0.504)
    { x: 49.3, y: 73.9, scale: 2.44, rotateX: 1.5, perspective: 4000, numY: -27 },  // N4 — disco arriba-centro   (anillo 0.500, el más lejano → el más acostado)
    { x: 26, y: 70.2, scale: 2.56, rotateX: 23.4, perspective: 4000, numY: -26.5 },  // N5 — disco arriba-derecha  (anillo 0.507)
    { x: 27.7, y: 48.9, scale: 2.39, rotateX: 16.7, perspective: 4000, numY: -24 },  // N6 — disco abajo-derecha   (anillo 0.530, centro afinado a ojo)
    { x: 56.4, y: 52.9, scale: 2.39, rotateX: 13.5, perspective: 4000, numY: -24 },  // N7 — disco central         (anillo 0.529)
  ],

  island3: [
    /* island3.webp: ONE big central painted chain (the cluster in the
       heatmap at x 20-70, y 30-95). Los 6 niveles recorren la cadena en un
       camino lógico; no hay plataformas sueltas arriba ni a la derecha.

       Eran 7. El que estaba en (53, 90) se sacó junto con su nivel: a esa
       altura el nodo caía detrás del panel de "Próximo personaje", que es
       fijo abajo de la pantalla, así que el 4 no se veía ni se podía tocar
       y la isla se leía como 1-2-3-5-6-7. Cuidado al bajar un nodo de ~85
       en esta pantalla, por eso mismo. */
    { x: 27.3, y: 60.5, scale: 1.89, rotateX: 30.5, numX: -1.5, numY: -20.5 },   // N1 — upper-centre of the main chain
    { x: 31.2, y: 39, scale: 1.91, rotateX: 49, numX: -0.5, numY: -13.5 },   // N2 — slightly down-right
    { x: 44.5, y: 25.2, scale: 1.76, rotateX: 42, numY: -13 },   // N3 — bottom-right of the main chain
    { x: 69.6, y: 32.6, scale: 1.78, rotateX: 47.5, numY: -11.5 },   // N4 — bottom-left
    { x: 81.3, y: 45.7, scale: 1.94, rotateX: 52.5, numY: -10.5 },   // N5 — mid-left
    { x: 53.3, y: 54.3, scale: 1.83, rotateX: 44, numX: -1, numY: -13.5 },   // N6 — upper-left (desafío final)
  ],

  island4: [
    /* island4.webp: ONE big central painted chain (the main island). The
       "bottom-right small platform" in earlier art isn't a real platform
       in the painted scene (it's just decorative clouds), so all 6 levels
       ride the main chain in a path. */
    { x: 53.2, y: 55.9, scale: 2.5, rotateX: 21, numX: -4.5, numY: -17 },   // N1 — upper-centre of the main chain
    { x: 37.6, y: 63.2, scale: 2.5, rotateX: 21, numX: -2.5, numY: -21 },   // N2 — centre-right
    { x: 26, y: 52.9, scale: 2.5, rotateX: 30.5, numX: -1.5, numY: -17 },   // N3 — centre of the main chain
    { x: 36.4, y: 42.6, scale: 2.5, rotateX: 34, numX: -1, numY: -17.5 },   // N4 — bottom-centre
    { x: 58.5, y: 36.8, scale: 2.22, rotateX: 34, numY: -14 },   // N5 — mid-left of the main chain
    { x: 74.8, y: 45.4, scale: 2.32, rotateX: 37.5, numX: -2.5, numY: -14 },   // N6 — bottom-right of the main chain
    { x: 82.4, y: 56.3, scale: 2.5, rotateX: 36, numY: -15.5 },   // N7 - provisoria, hueco arriba a la derecha
  ],

  island5: [
    { x: 20.6, y: 64.2, scale: 1.78, rotateX: 23.5, numX: -1.5, numY: -13 },
    { x: 46.7, y: 69.1, scale: 1.53, numX: -2, numY: -11.5 },
    { x: 49.6, y: 50.3, scale: 1.4, numX: -1, numY: -11 },
    { x: 34.5, y: 39.3, scale: 1.4, numX: -3.5, numY: -11 },
    { x: 46.8, y: 27.7, scale: 1.38, numX: -2, numY: -11 },
    { x: 62.1, y: 36.5, scale: 1.32, numX: -1.5, numY: -10 },
    { x: 87.5, y: 55.2, scale: 1.55, numX: -4, numY: -12 },  // N7 - separado de N2, que estaba encima; provisoria
  ],

  island6: [
    /* Mundo 2 "Isla de la escritura" — fondo bg01_crystal_portal.webp (1672×941).
       Coordenadas = % de la imagen (la cover-rect math de IslandDetailPage las
       fija a las plataformas pintadas en cualquier viewport). Cadena que sube
       desde el disco de abajo-izquierda hasta el portal. 7 niveles.

       ── Migrado desde CSS (2026-08-24) ───────────────────────────────────
       Estos 7 nodos estaban retocados con reglas `#btnisland6lvl1…7` al final
       de global.css, con translate() y perspective() en PIXELES fijos. Un
       offset en px vale un % distinto de la imagen en cada resolución, así que
       el ajuste solo era válido en la pantalla donde se hizo. Las reglas se
       borraron y sus valores viven acá como datos.

       Conversión px → %: se tomó como referencia 1920×1080, donde el
       rectángulo cover de una imagen 16:9 mide 1920 × 1080.6 px. O sea
       Δx% = px / 19.20  y  Δy% = px / 10.806.

       `perspective: 4000` ≈ proyección ortográfica, que es como se veían las
       rotaciones en CSS (no llevaban función perspective()). No lo bajes sin
       mirar la isla: con valores chicos aparece keystoning.

       OJO: las rotaciones ahora afectan SOLO a la imagen del botón, no al
       número ni a los badges — antes el CSS rotaba el botón entero y dejaba
       los números de esta isla muy achatados. Verificar island6 a ojo. */
    { x: 21.8, y: 78.9, scale: 2.09, rotateX: -35, rotateY: 2, perspective: 4000, numX: 1, numY: -19 },  // N1 — disco rúnico abajo-izquierda (inicio, lleva la nave)
    { x: 17.5, y: 52.5, scale: 1.53, rotateX: 54, rotateZ: -10.5, perspective: 4000, numX: -4, numY: -6 },               // N2 — disco de la cornisa izquierda (más grande)
    { x: 39.3, y: 40.9, scale: 1.55, rotateX: 57, rotateY: 1.5, perspective: 4000, numX: 0.5, numY: -6.5, numSize: 0.92 },                  // N3 — terraza verde sobre la cornisa
    { x: 43.4, y: 76.8, scale: 1.43, rotateX: 27, perspective: 4000, numX: -0.5, numY: -10.5 },               // N4 — escalones de piedra hacia el centro
    { x: 82, y: 64.2, scale: 1.89, rotateX: 56, rotateY: 3, rotateZ: 4, perspective: 4000, numX: 4, numY: -9 },   // N5 — disco rúnico central
    { x: 63.9, y: 45.6, scale: 1.51, rotateX: -57.5, rotateY: -3.5, rotateZ: -2.5, perspective: 4000, numX: -1.5, numY: -3.5 },   // N6 — disco rúnico derecho (abajo)
    { x: 69.3, y: 25.3, scale: 1.62, rotateX: 61.5, rotateY: 2, rotateZ: 0.5, perspective: 4000, numY: -2.5, numSize: 0.88 }, // N7 — explanada al pie del portal
  ],

  island7: [
    { x: 78.6, y: 53.9, scale: 2.5, rotateX: 25.5, numX: -4, numY: -25, numSize: 1.2 },
    { x: 73.5, y: 70.5, scale: 2.5, rotateX: 23.5, numX: -1.5, numY: -28 },
    { x: 47.4, y: 70.6, scale: 2.5, numX: -2, numY: -30 },
    { x: 20.7, y: 61, scale: 2.5, rotateX: 15, rotateY: -1, numX: -6.5, numY: -30 },
    { x: 28, y: 38.1, scale: 2.22, rotateX: 25.5, numX: -3.5, numY: -23.5 },
    { x: 52.4, y: 39.9, scale: 2.38, rotateX: 21, rotateZ: 5, numX: -1, numY: -24.5 },
    { x: 81.2, y: 31.4, scale: 2.5, rotateX: 44, rotateZ: 2.5, numX: 2, numY: -22.5 },
    { x: 46, y: 56 },
  ],

  island8: [
    { x: 20.1, y: 41.5, scale: 1.88, rotateX: 54.5, numX: 2, numY: -15.5, numSize: 0.86 },
    { x: 29.5, y: 66.1, scale: 2.27, rotateX: 50, numX: 1, numY: -22.5 },
    { x: 42.6, y: 79.1, scale: 2.38, rotateX: 44, numX: 2.5, numY: -22.5 },
    { x: 77.5, y: 71.6, scale: 2.5, rotateX: 54.5, numX: 1.5, numY: -23.5 },
    { x: 83.5, y: 55.8, scale: 1.97, rotateX: 52.5, numX: -1, numY: -21.5 },
    { x: 65.7, y: 45.1, scale: 2.01, rotateX: 56, numY: -18.5 },
    { x: 83.2, y: 34.7, scale: 2.3, rotateX: 64, numX: 2, numY: -16.5, numSize: 0.83 },
    { x: 44, y: 68 },
  ],

  island9: [
    { x: 26.3, y: 73.3, scale: 2.5, rotateX: 44, numX: -3.5, numY: -27 },
    { x: 8.9, y: 55.5, scale: 2.04, rotateX: 39.5, numY: -23 },
    { x: 32, y: 48.4, scale: 1.74, rotateX: 44, numY: -18.5 },
    { x: 53.1, y: 24.2, scale: 2.02, rotateX: 57, numX: -2.5, numY: -15, numSize: 0.81 },
    { x: 65.2, y: 37.5, scale: 1.89, rotateX: 57, rotateZ: 10, numX: 4.5, numY: -15.5, numSize: 0.78 },
    { x: 77.7, y: 51.1, scale: 2.01, rotateX: 53.5, rotateZ: 17.5, numX: 9, numY: -16, numSize: 0.77 },
    { x: 83.4, y: 25.2, scale: 1.66, rotateX: 49, rotateZ: 10, numX: 3.5, numY: -14 },
    { x: 46, y: 56 },
  ],

  island10: [
    { x: 21.7, y: 32.9, scale: 1.45, rotateX: 46.5, numX: -0.5, numY: -7.5 },
    { x: 33.8, y: 41.4, scale: 1.42, rotateX: 49, numX: 1, numY: -9, numSize: 0.9 },
    { x: 18.6, y: 60.2, scale: 1.38, rotateX: 17.5, numY: -12.5 },
    { x: 44, y: 76.3, scale: 1.5, rotateX: 30.5, numX: -1, numY: -12.5 },
    { x: 62.1, y: 61.7, scale: 1.28, rotateX: 41, numY: -7.5 },
    { x: 77.4, y: 46.5, scale: 1.45, rotateX: 38.5, numX: -0.5, numY: -9 },
    { x: 57, y: 28.1, scale: 1.1, rotateX: 42, numY: -4 },
    { x: 44, y: 68 },
  ],

  island11: [
    { x: 29.2, y: 70.5, scale: 1.97, rotateX: 43.5, numY: -15.5 },
    { x: 52.2, y: 71.2, scale: 1.76, rotateX: 38, perspective: 580, numY: -13 },
    { x: 85.2, y: 73.9, scale: 1.88, rotateX: 47.5, numY: -10.5 },
    { x: 73, y: 57.3, scale: 1.72, rotateX: 53.5, rotateY: 4.5, rotateZ: -3, numX: -4, numY: -10 },
    { x: 41.5, y: 43.4, scale: 1.76, rotateX: 51, rotateY: 2.5, numY: -11.5 },
    { x: 63.1, y: 39.2, scale: 1.8, rotateX: -51, rotateY: -2.5, rotateZ: -3.5, numY: -14 },
    { x: 85.4, y: 33.4, scale: 1.87, rotateX: 50, rotateZ: 10, numX: 4.5, numY: -10.5 },
    { x: 46, y: 56 },
  ],

  island12: [
    { x: 13.8, y: 36.2, scale: 2.01, rotateX: 32.5, numY: -18.5 },
    { x: 38.9, y: 23.2, scale: 1.73, rotateX: 36, numY: -15.5 },
    { x: 29.3, y: 59.8, scale: 2.01, rotateX: 22, numY: -19.5 },
    { x: 43.7, y: 73.8, scale: 2.11, rotateX: 35, numY: -21.5 },
    { x: 81.3, y: 73.8, scale: 1.79, rotateX: 22, numY: -19 },
    { x: 69.9, y: 57.3, scale: 1.79, rotateX: 25.5, numY: -18.5 },
    { x: 82.9, y: 38.4, scale: 1.78, rotateX: 45.5, numY: -11 },
    { x: 44, y: 68 },
  ],

  island13: [
    { x: 16.2, y: 49.1, scale: 2.19, rotateX: -42.5, rotateY: 1, numX: -1.5, numY: -19 },
    { x: 40.5, y: 45.1, scale: 2.19, rotateX: 50, numY: -13 },
    { x: 66, y: 62.4, scale: 2.37, rotateX: -40.5, numY: -19.5 },
    { x: 81.3, y: 51.1, scale: 2.5, rotateX: 51, numX: -2.5, numY: -13.5 },
    { x: 69.3, y: 24, scale: 1.78, rotateX: 54.5, numX: -0.5, numY: -7.5 },
    { x: 55.2, y: 21.4, scale: 1.73, rotateX: -59.5, numY: -6.5 },
    { x: 34.5, y: 24.1, scale: 1.71, rotateX: 53.5, numY: -7.5 },
    { x: 46, y: 56 },
  ],

  island14: [
    { x: 20.5, y: 45.3, scale: 1.89, rotateX: 49, numX: -0.5, numY: -14 },
    { x: 20, y: 68.1, scale: 1.99, rotateX: 36, numY: -21 },
    { x: 45.5, y: 63.3, scale: 1.89, rotateX: 35, numY: -19.5, numSize: 1.22 },
    { x: 73.5, y: 74, scale: 1.71, rotateX: 43, numY: -15.5, numSize: 0.99 },
    { x: 83.7, y: 55.1, scale: 1.76, rotateX: 49, numY: -12, numSize: 1.02 },
    { x: 62.9, y: 44, scale: 1.78, rotateX: 45.5, numY: -11.5, numSize: 0.92 },
    { x: 44, y: 33.3, scale: 1.78, rotateX: 53.5, perspective: 480, numY: -9.5, numSize: 0.93 },
    { x: 44, y: 68 },
  ],

  /* Eran 8 y quedaron 6, en dos bajas con motivos distintos:

       - El nodo que estaba en (43.9, 2.7) caía sobre el pedestal que la propia
         lámina corta por la mitad: quedaba pegado al borde superior y debajo
         del HUD, así que no se veía ni se podía tocar y la isla se leía como
         1-2-3-5-6-7-8. Cuidado al subir un nodo de menos de ~5 en esta
         pantalla, por eso mismo.
       - El que hacía de 3, en (14.7, 38.8), se sacó a pedido.

     Los seis que quedan NO se movieron: cada botón conserva la posición que
     tenía, y lo único que cambió es el número que le toca. */
  island15: [
    { x: 51.4, y: 72.6, scale: 1.32, rotateX: 25.5, numY: -12 },
    { x: 38.2, y: 51.1, scale: 1.14, rotateX: 24.5, numY: -7.5 },
    { x: 19, y: 62.8, scale: 1.14, rotateX: 37.5 },
    { x: 27.1, y: 27.1, scale: 1.1, rotateX: -30.5 },
    { x: 51.9, y: 37.5, scale: 1.14, rotateX: 39.5, numX: -2.5, numY: -3.5 },
    { x: 80.1, y: 43.7, scale: 1.1, rotateX: 35, numY: -4 },
  ],
};
