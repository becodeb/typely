/* Un puesto por minijuego. Las tres dormidas pertenecen a Órbita; no son
 * el modo reservado del selector /modos. */
export type EstadoGalaxia = "activa" | "dormida";
export interface GalaxiaDef {
  id: "tormenta" | "carrera" | "dormida-huevo" | "dormida-hielo" | "dormida-remolino";
  nombre: string;
  estado: EstadoGalaxia;
  ruta: string | null;
  imagen: string;
  gameId: "tormenta" | "carrera" | null;
}
export const GALAXIAS: readonly GalaxiaDef[] = [
  { id: "tormenta", nombre: "Tormenta de palabras", estado: "activa", ruta: "/orbita/tormenta", imagen: "/assets/orbita/galaxias/tormenta.webp", gameId: "tormenta" },
  { id: "carrera", nombre: "Carrera de cohetes", estado: "activa", ruta: "/orbita/carrera", imagen: "/assets/orbita/galaxias/carrera.webp", gameId: "carrera" },
  { id: "dormida-huevo", nombre: "", estado: "dormida", ruta: null, imagen: "/assets/orbita/galaxias/dormida-huevo.webp", gameId: null },
  { id: "dormida-hielo", nombre: "", estado: "dormida", ruta: null, imagen: "/assets/orbita/galaxias/dormida-hielo.webp", gameId: null },
  { id: "dormida-remolino", nombre: "", estado: "dormida", ruta: null, imagen: "/assets/orbita/galaxias/dormida-remolino.webp", gameId: null },
];

const CLAVE_GALAXIA = "typely_orbita_galaxia_v1";
export const indiceGalaxia = (destino: number) => ((destino % GALAXIAS.length) + GALAXIAS.length) % GALAXIAS.length;
export function ultimaGalaxia(): number {
  try {
    return Math.max(0, GALAXIAS.findIndex(g => g.id === localStorage.getItem(CLAVE_GALAXIA)));
  } catch { return 0; }
}
export function recordarGalaxia(galaxia: GalaxiaDef) {
  try { localStorage.setItem(CLAVE_GALAXIA, galaxia.id); }
  catch { /* Sin almacenamiento, el carrusel sigue navegable. */ }
}
