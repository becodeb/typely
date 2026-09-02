/* Catálogo del hangar de Órbita — ESPEJO del CATALOGO de
 * `api/src/routes/arcade.ts`. El precio que vale es el del servidor: este
 * archivo solo dibuja. Si cambia uno, cambiar el otro en el mismo commit.
 *
 * Regla de diseño: los cristales compran COSMÉTICOS, nunca ventaja. Una
 * estela y un color de rayo no tocan ni una perilla del motor — el
 * ranking compara habilidad, no billeteras de cristales.
 */

export type TipoCosmetico = "estela" | "rayo";

export interface Cosmetico {
  id: string;
  tipo: TipoCosmetico;
  nombre: string;
  precio: number;
  /** Color con el que se dibuja la estela o el rayo. Paleta §5. */
  color: string;
}

export const COSMETICOS: readonly Cosmetico[] = [
  { id: "estela-menta", tipo: "estela", nombre: "Estela menta", precio: 120, color: "#54e8c6" },
  { id: "estela-violeta", tipo: "estela", nombre: "Estela violeta", precio: 180, color: "#9b7cff" },
  { id: "estela-rosa", tipo: "estela", nombre: "Estela rosa", precio: 260, color: "#ff9fca" },
  { id: "estela-dorada", tipo: "estela", nombre: "Estela dorada", precio: 400, color: "#ffd552" },
  { id: "rayo-violeta", tipo: "rayo", nombre: "Rayo violeta", precio: 100, color: "#9b7cff" },
  { id: "rayo-rosa", tipo: "rayo", nombre: "Rayo rosa", precio: 200, color: "#ff9fca" },
  { id: "rayo-dorado", tipo: "rayo", nombre: "Rayo dorado", precio: 350, color: "#ffd552" },
];

/** El rayo de serie, gratis: turquesa, el color de acción del producto. */
export const RAYO_DEFECTO = "#25c8df";

export function cosmeticoPorId(id: string | null | undefined): Cosmetico | null {
  if (!id) return null;
  return COSMETICOS.find((c) => c.id === id) ?? null;
}

/** Color del rayo según lo equipado (o el de serie). */
export function colorRayo(equippedBeam: string | null | undefined): string {
  return cosmeticoPorId(equippedBeam)?.color ?? RAYO_DEFECTO;
}

/** Color de la estela equipada, o null si vuela sin estela. */
export function colorEstela(equippedTrail: string | null | undefined): string | null {
  return cosmeticoPorId(equippedTrail)?.color ?? null;
}
