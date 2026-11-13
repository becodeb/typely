import largos from "./carreraTextos.json" with { type: "json" };
export interface TelemetriaCarrera {
  textId?: string; durationMs: number; charsTyped: number; wpmAvg: number;
  accuracy: number; score: number; puesto?: number; level: number; upgrades: unknown[];
}
/* Espejo de la fórmula del motor; el examen comprueba que no se separen.
 * Los límites revisados preservan párrafos y velocidades reales: una
 * carrera principiante puede superar 180 s y una rápida bajar de 15 s. */
export function validarCarrera(it: TelemetriaCarrera) {
  const largo = largos[it.textId as keyof typeof largos];
  return !!largo && it.charsTyped === largo && largo >= 90 && largo <= 140
    && it.durationMs >= 5000 && it.durationMs <= 360000
    && it.wpmAvg >= 0 && it.wpmAvg <= 250
    && Math.abs(it.wpmAvg - Math.round(largo * 12000 / it.durationMs)) <= 1
    && it.accuracy >= 0 && it.accuracy <= 100
    && Math.abs(it.score - Math.round(it.wpmAvg * (it.accuracy / 100) ** 2 * 10)) <= 2
    && Number.isInteger(it.puesto) && it.puesto! >= 1 && it.puesto! <= 5
    && it.level === 0 && it.upgrades.length === 0;
}
export function cristalesDeCarrera(it: TelemetriaCarrera) {
  return Math.round(it.charsTyped / 5) + ([12,8,5,2,2][Math.max(0,Math.min(4,(it.puesto ?? 5)-1))] ?? 2);
}
