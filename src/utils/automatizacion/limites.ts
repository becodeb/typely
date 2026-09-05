/* Topes de seguridad compartidos por los dos caminos de ejecución del
 * Modo Automatización: el intérprete paso a paso (interprete.ts) y la
 * expansión sin sensores para el examen (programa.ts).
 *
 * Viven en un módulo APARTE, no en ninguno de los dos, porque
 * `interprete.ts` ya importa de `programa.ts` — si el tope viviera ahí,
 * `programa.ts` tendría que importar de `interprete.ts` para reusarlo, y
 * eso cierra un ciclo de módulos. Un tercer archivo sin dependencias
 * rompe el ciclo sin que ninguno de los dos motores dependa del otro.
 */

/** Tope de llamadas anidadas EN LA PILA (no de pasos ejecutados): la
 *  recursión está permitida, directa e indirecta, y lo único que la
 *  limita es esto. Pasado el tope la llamada se saltea en silencio y la
 *  corrida (o la expansión) se desarma sola, sin cartel de error. Es una
 *  cota de SEGURIDAD, no una perilla de juego: no vive en balance.ts,
 *  igual que `MAX_PASOS_CORRIDA`. */
export const MAX_LLAMADAS_ANIDADAS = 32;
