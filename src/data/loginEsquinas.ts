/* =====================================================================
   ADORNOS DE ESQUINA DEL LOGIN  ·  única fuente de verdad
   ---------------------------------------------------------------------
   Dónde va cada copia de `login-esquina.webp` sobre la tarjeta de login.
   La imagen está dibujada para la esquina superior izquierda; las otras
   tres son la misma imagen girada 90°, 180° y 270°.

   Cada esquina se ANCLA a su propio vértice de la tarjeta (`.login-shell`)
   y se mide en % DEL ANCHO de la tarjeta — también la vertical. Así la
   pieza conserva su proporción aunque la tarjeta cambie de alto (ventana
   corta, teléfono) y aunque el hook de ajuste le aplique un zoom:

     x, y   → corrimiento desde el vértice, en % del ancho de la tarjeta.
              Negativo = hacia afuera. Para `ad` x se mide desde el borde
              derecho, para `bi`/`bd` y se mide desde el borde inferior.
     ancho  → ancho de la imagen, en % del ancho de la tarjeta.
     giro   → grados que se SUMAN al giro base de esa esquina
              (ai 0 · ad 90 · bd 180 · bi 270).

   Nunca píxeles: un valor en px queda bien en una sola resolución.

   CÓMO EDITAR:
     - Retocá los números a mano, o
     - Abrí el login en el server de dev con el editor visual:
         1. una vez por navegador: localStorage.setItem("typely_dev_editor","1")
         2. visitá  /login?editor=1
         3. arrastrá cada esquina; flechas para afinar, S = ancho,
            Z = giro, "Espejar a las 4" copia la seleccionada a las otras
         4. Ctrl/Cmd + S guarda ACÁ directo (endpoint del server de dev),
            o "Copiar" y pegás el objeto.
===================================================================== */

export type EsquinaClave = "ai" | "ad" | "bd" | "bi";

export type EsquinaLogin = {
  x: number;
  y: number;
  ancho: number;
  giro: number;
};

/** Giro base de cada esquina: la imagen nace para `ai`. */
export const GIRO_BASE: Record<EsquinaClave, number> = { ai: 0, ad: 90, bd: 180, bi: 270 };

export const ESQUINAS_ORDEN: EsquinaClave[] = ["ai", "ad", "bd", "bi"];

export const LOGIN_ESQUINAS: Record<EsquinaClave, EsquinaLogin> = {
  ai: { x: -4, y: -7.1, ancho: 35.2, giro: 0 },   // arriba izquierda
  ad: { x: -8, y: -8.1, ancho: 35.2, giro: 0 },   // arriba derecha
  bd: { x: -4.9, y: -7.8, ancho: 35.2, giro: 0 },   // abajo derecha
  bi: { x: -7.3, y: -4.8, ancho: 35.2, giro: 0 },   // abajo izquierda
};
