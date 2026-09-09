/* Un puesto por minijuego. Las tres propuestas futuras pertenecen a Órbita; no son
 * el modo reservado del selector /modos. */
export type EstadoJuegoOrbita = "activa" | "dormida";
export interface JuegoOrbitaDef {
  id: "tormenta" | "carrera" | "dormida-huevo" | "dormida-hielo" | "dormida-remolino";
  nombre: string;
  estado: EstadoJuegoOrbita;
  ruta: string | null;
  imagen: string;
  gameId: "tormenta" | "carrera" | null;
}
export const JUEGOS_ORBITA: readonly JuegoOrbitaDef[] = [
  { id: "tormenta", nombre: "Tormenta de palabras", estado: "activa", ruta: "/orbita/tormenta", imagen: "/assets/orbita/destinos/tormenta.webp", gameId: "tormenta" },
  { id: "carrera", nombre: "Carrera de cohetes", estado: "activa", ruta: "/orbita/carrera", imagen: "/assets/orbita/destinos/carrera.webp", gameId: "carrera" },
  { id: "dormida-huevo", nombre: "", estado: "dormida", ruta: null, imagen: "/assets/orbita/destinos/huevo.webp", gameId: null },
  { id: "dormida-hielo", nombre: "", estado: "dormida", ruta: null, imagen: "/assets/orbita/destinos/cristal.webp", gameId: null },
  { id: "dormida-remolino", nombre: "", estado: "dormida", ruta: null, imagen: "/assets/orbita/destinos/cofre.webp", gameId: null },
];

// La clave y los identificadores previos conservan la selección guardada.
const CLAVE_JUEGO = "typely_orbita_galaxia_v1";
export const indiceJuego = (destino: number) => ((destino % JUEGOS_ORBITA.length) + JUEGOS_ORBITA.length) % JUEGOS_ORBITA.length;
export function ultimoJuego(): number {
  try {
    return Math.max(0, JUEGOS_ORBITA.findIndex(g => g.id === localStorage.getItem(CLAVE_JUEGO)));
  } catch { return 0; }
}
export function recordarJuego(juego: JuegoOrbitaDef) {
  try { localStorage.setItem(CLAVE_JUEGO, juego.id); }
  catch { /* Sin almacenamiento, el carrusel sigue navegable. */ }
}
