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
  colorMotor?: string;
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

function vista(id: string, pose: PoseNave, x: number, y: number, ax: number, ay: number, bx: number, by: number): VistaNave {
  return { imagen: `/assets/orbita/naves/${id}/${pose}.webp`, emisor: { x, y }, motores: [{ x: ax, y: ay }, { x: bx, y: by }] };
}
export const NAVES_ORBITA: readonly NaveOrbitaDef[] = [NAVE_ORBITA_BASE, {
  id: "nave-aurora", nombre: "Aurora", vistas: {
    neutra: vista("aurora", "neutra", 50.3, 9.2, 40.4, 77, 58.1, 77),
    izquierda: vista("aurora", "izquierda", 33.4, 10.7, 47.1, 77.4, 63.7, 72.7),
    derecha: vista("aurora", "derecha", 60.3, 9.1, 31.6, 75.4, 47.7, 78.5),
  },
}, {
  id: "nave-prisma", nombre: "Prisma", vistas: {
    neutra: vista("prisma", "neutra", 50, 9.7, 36.7, 77.8, 62.3, 77.9),
    izquierda: vista("prisma", "izquierda", 29.7, 10.5, 46.8, 79.8, 68.6, 71.8),
    derecha: vista("prisma", "derecha", 67.5, 12.4, 33.2, 71, 54.9, 77.5),
  },
}, {
  id: "nave-fenix", nombre: "Fénix", colorMotor: "#ffbe35", vistas: {
    neutra: vista("fenix", "neutra", 50, 7.4, 35, 79, 65, 79),
    izquierda: vista("fenix", "izquierda", 27.1, 12.2, 43.1, 77.4, 69.8, 69.7),
    derecha: vista("fenix", "derecha", 73, 9.3, 34, 69.7, 58.5, 77.1),
  },
}, {
  id: "nave-eclipse", nombre: "Eclipse", colorMotor: "#f051ff", vistas: {
    neutra: vista("eclipse", "neutra", 50, 4.3, 28, 83.6, 72, 83.6),
    izquierda: vista("eclipse", "izquierda", 15.8, 5.9, 42.6, 88.7, 78.9, 73.9),
    derecha: vista("eclipse", "derecha", 71.4, 9.9, 19.2, 74.5, 57.7, 84.2),
  },
}, {
  id: "nave-zapatilla-cohete", nombre: "Zapatilla cohete", colorMotor: "#b799ff", vistas: {
    neutra: vista("zapatilla-cohete", "neutra", 50, 7.4, 38.4, 82.2, 60.6, 82.2),
    izquierda: vista("zapatilla-cohete", "izquierda", 17.4, 7.2, 48.8, 85.8, 70.7, 77.4),
    derecha: vista("zapatilla-cohete", "derecha", 77.1, 6.5, 22.5, 77, 44.6, 86.5),
  },
}, {
  id: "nave-tiburon-galactico", nombre: "Tiburón galáctico", colorMotor: "#55dfff", vistas: {
    neutra: vista("tiburon-galactico", "neutra", 50, 5.4, 37, 79.8, 63.2, 79.8),
    izquierda: vista("tiburon-galactico", "izquierda", 16.5, 9.4, 49, 84.6, 74, 71),
    derecha: vista("tiburon-galactico", "derecha", 77.3, 7.4, 22, 70.9, 45, 81.4),
  },
}, {
  id: "nave-dragon-caramelo", nombre: "Dragón de caramelo", colorMotor: "#ffc55c", vistas: {
    neutra: vista("dragon-caramelo", "neutra", 50, 11.8, 37.6, 73.2, 62, 73.2),
    izquierda: vista("dragon-caramelo", "izquierda", 30.3, 15.7, 46.3, 71.6, 70, 63.6),
    derecha: vista("dragon-caramelo", "derecha", 80.4, 9.2, 30.5, 63.6, 53.1, 74.6),
  },
}, {
  id: "nave-ovni-gelatina", nombre: "Ovni gelatina", colorMotor: "#ef78ff", vistas: {
    neutra: vista("ovni-gelatina", "neutra", 50, 10.4, 38, 86.4, 61.2, 86.4),
    izquierda: vista("ovni-gelatina", "izquierda", 21.5, 12.3, 51.3, 83, 72.2, 77),
    derecha: vista("ovni-gelatina", "derecha", 69.4, 12.3, 24, 75.4, 43.7, 80.7),
  },
}, {
  id: "nave-ajolote-espacial", nombre: "Ajolote espacial", colorMotor: "#6ae4ff", vistas: {
    neutra: vista("ajolote-espacial", "neutra", 50, 10.6, 31.8, 77.7, 68.4, 77.7),
    izquierda: vista("ajolote-espacial", "izquierda", 25.6, 9.9, 46.8, 79.6, 82.6, 67.8),
    derecha: vista("ajolote-espacial", "derecha", 76.8, 9.8, 18.1, 71.1, 51.3, 80.1),
  },
}];
export function navePorId(id: string | null | undefined): NaveOrbitaDef {
  return NAVES_ORBITA.find(n => n.id === id) ?? NAVE_ORBITA_BASE;
}

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
