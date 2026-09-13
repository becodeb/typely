import { NAVES_ORBITA, NAVE_ORBITA_BASE } from "../../data/orbitaNaves";
import type { FantasmaCarrera } from "./carrera";

export interface RivalCarrera extends FantasmaCarrera { ship?: string | null; trail?: string | null; pet?: string | null }

/** Los cosméticos elegidos se conservan. Los rivales sin nave especial
 * reciben modelos variados para la carrera; no se modifica su cuenta. */
export function navesRivales(rivales: readonly RivalCarrera[], naveAlumno: string) {
  const usadas = new Set([naveAlumno, ...rivales.flatMap(r =>
    NAVES_ORBITA.some(n => n.id === r.ship) ? [r.ship!] : [])]);
  return rivales.map((r, i) => {
    if (r.id === "propio") return naveAlumno;
    const elegida = NAVES_ORBITA.find(n => n.id === r.ship && n.id !== NAVE_ORBITA_BASE.id);
    if (elegida) { usadas.add(elegida.id); return elegida.id; }
    const disponibles = NAVES_ORBITA.filter(n => n.id !== NAVE_ORBITA_BASE.id && !usadas.has(n.id));
    const nave = disponibles[i % disponibles.length] ?? NAVES_ORBITA[1]!;
    usadas.add(nave.id);
    return nave.id;
  });
}

/** Suavizado visual independiente del puntaje y de la velocidad del rival.
 * Con dt cero se congela exactamente; jamás adelanta al valor del motor. */
export function suavizarCarrera(actual: number, destino: number, dt: number, reducido: boolean) {
  if (dt <= 0) return actual;
  if (reducido || Math.abs(destino-actual) < .0001) return destino;
  return actual+(destino-actual)*(1-Math.exp(-dt/95));
}
