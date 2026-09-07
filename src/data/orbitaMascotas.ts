/** Solo presentación: este registro nunca entra al motor ni al puntaje. */
export interface MascotaOrbitaDef {
  id: string;
  nombre: string;
  imagen: string;
  movimiento: "flota" | "rebota" | "planea";
}

export const MASCOTAS_ORBITA: readonly MascotaOrbitaDef[] = [
  { id: "mascota-botito", nombre: "Botito", imagen: "/assets/orbita/mascotas/botito/neutra.webp", movimiento: "flota" },
  { id: "mascota-lunita", nombre: "Lunita", imagen: "/assets/orbita/mascotas/lunita/neutra.webp", movimiento: "flota" },
  { id: "mascota-gatito-cometa", nombre: "Gatito cometa", imagen: "/assets/orbita/mascotas/gatito-cometa/neutra.webp", movimiento: "planea" },
  { id: "mascota-medusa-burbuja", nombre: "Medusa burbuja", imagen: "/assets/orbita/mascotas/medusa-burbuja/neutra.webp", movimiento: "flota" },
  { id: "mascota-pulpito-dj", nombre: "Pulpito DJ", imagen: "/assets/orbita/mascotas/pulpito-dj/neutra.webp", movimiento: "rebota" },
  { id: "mascota-dino-patinador", nombre: "Dino patinador", imagen: "/assets/orbita/mascotas/dino-patinador/neutra.webp", movimiento: "rebota" },
  { id: "mascota-capibara-astronauta", nombre: "Capibara astronauta", imagen: "/assets/orbita/mascotas/capibara-astronauta/neutra.webp", movimiento: "planea" },
  { id: "mascota-dragon-gelatina", nombre: "Dragón de gelatina", imagen: "/assets/orbita/mascotas/dragon-gelatina/neutra.webp", movimiento: "planea" },
];

export function mascotaPorId(id: string | null | undefined): MascotaOrbitaDef | null {
  return MASCOTAS_ORBITA.find(m => m.id === id) ?? null;
}
