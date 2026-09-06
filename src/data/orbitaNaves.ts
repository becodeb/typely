/** Naves exclusivas de Órbita. No dependen de las estrellas de Aventura.
 * Cada pose conserva el lienzo del PNG; sus anclajes son porcentajes
 * medidos sobre el dibujo, nunca píxeles de pantalla.
 */
export type PoseNave = "neutra" | "izquierda" | "derecha";
export interface PuntoNave { x: number; y: number }
export interface VistaNave {
  imagen: string;
  emisor: PuntoNave;
  motores: readonly [PuntoNave, PuntoNave];
}
export interface NaveOrbitaDef {
  id: string;
  nombre: string;
  vistas: Record<PoseNave, VistaNave>;
}

const base = "/assets/orbita/naves/orbita-01";
export const NAVE_ORBITA_BASE: NaveOrbitaDef = {
  id: "orbita-01",
  nombre: "Nave de Órbita",
  vistas: {
    neutra: {
      imagen: `${base}/neutra.webp`,
      emisor: { x: 49.9, y: 6.3 },
      motores: [{ x: 38.4, y: 81.5 }, { x: 61.1, y: 81.5 }],
    },
    izquierda: {
      imagen: `${base}/izquierda.webp`,
      emisor: { x: 33.0, y: 12.7 },
      motores: [{ x: 44.7, y: 81.2 }, { x: 65.0, y: 76.4 }],
    },
    derecha: {
      imagen: `${base}/derecha.webp`,
      emisor: { x: 66.5, y: 14.0 },
      motores: [{ x: 32.6, y: 72.2 }, { x: 50.6, y: 76.8 }],
    },
  },
};

/** Registro abierto para sumar skins más adelante. La compra/equipamiento
 * de naves se implementará cuando exista un catálogo aprobado. */
export const NAVES_ORBITA = [NAVE_ORBITA_BASE] as const;

/** Alinea el eje cristal → centro de propulsores de cada vista.
 * Al deshacer el giro pintado y registrar el mismo pivote, se pueden
 * mezclar las vistas sin que el cristal salte a otro lugar del lienzo. */
export function geometriaVista(v: VistaNave) {
  const atras = { x: (v.motores[0].x + v.motores[1].x) / 2, y: (v.motores[0].y + v.motores[1].y) / 2 };
  const dx = v.emisor.x - atras.x;
  const dy = v.emisor.y - atras.y;
  return {
    angulo: Math.atan2(dx, -dy) * 180 / Math.PI,
    escala: 75 / Math.hypot(dx, dy),
    pivote: { x: v.emisor.x - dx * 0.65, y: v.emisor.y - dy * 0.65 },
  };
}
