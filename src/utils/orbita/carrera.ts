/* Motor puro: no conoce React, el teclado, la red ni las bandas.
 * Los fantasmas usan su PPM guardado y nunca se adaptan al alumno. */
export interface FantasmaCarrera { id: string; alias: string; ppm: number }
export interface ResultadoCarrera {
  gameId: "carrera"; textId: string; durationMs: number; ppmNeto: number;
  precision: number; puntaje: number; puesto: number; rivales: number;
  caracteres: number; errores: number; cristales: number;
}
export type EventoCarrera =
  | { tipo: "largada" }
  | { tipo: "acierto"; indice: number }
  | { tipo: "error"; indice: number; ch: string }
  | { tipo: "borrado"; indice: number; eraError: boolean }
  | { tipo: "pasa" | "tePasa"; fantasmaId: string }
  | { tipo: "inactivo" | "reanuda" }
  | { tipo: "fin"; resultado: ResultadoCarrera };

export const puntajeCarrera = (ppm: number, precision: number) => Math.round(ppm * (precision / 100) ** 2 * 10);
export const cristalesCarrera = (caracteres: number, puesto: number) => Math.round(caracteres / 5) + ([12, 8, 5, 2, 2][puesto - 1] ?? 2);

export class MotorCarrera {
  readonly texto: string;
  readonly textId: string;
  readonly fantasmas: (FantasmaCarrera & { progreso: number; llegadaMs: number | null })[];
  indice = 0;
  rojas: string[] = [];
  correctas = 0;
  errores = 0;
  tiempoMs = 0;
  cuentaMs = 0;
  inactividadMs = 0;
  pausa = false;
  inactivo = false;
  resultado: ResultadoCarrera | null = null;
  constructor(opciones: { texto: string; textId: string; fantasmas: FantasmaCarrera[]; rng?: () => number }) {
    this.texto = opciones.texto.normalize("NFC");
    if (!this.texto.length) throw new Error("La carrera necesita un texto.");
    this.textId = opciones.textId;
    this.fantasmas = opciones.fantasmas.slice(0, 4).map(f => ({ ...f, ppm: Math.max(0, f.ppm), progreso: 0, llegadaMs: null }));
  }
  get largada() { return this.cuentaMs >= 2400; }
  get progreso() { return this.indice / this.texto.length; }
  get ppm() { return this.tiempoMs > 0 ? Math.round(this.indice * 12000 / this.tiempoMs) : 0; }
  get precision() { return this.correctas + this.errores ? Math.round(100 * this.correctas / (this.correctas + this.errores)) : 100; }
  pausar() { this.pausa = true; }
  reanudar(): EventoCarrera[] {
    if (this.resultado) return [];
    this.pausa = false; this.inactivo = false; this.inactividadMs = 0;
    return [{ tipo: "reanuda" }];
  }
  private posiciones() { return this.fantasmas.map(f => this.progreso > f.progreso); }
  private cruces(antes: boolean[]): EventoCarrera[] {
    return this.fantasmas.flatMap((f, i) => {
      const adelante = this.progreso > f.progreso;
      return adelante === antes[i] ? [] : [{ tipo: adelante ? "pasa" as const : "tePasa" as const, fantasmaId: f.id }];
    });
  }
  tick(dtMs: number): EventoCarrera[] {
    if (this.pausa || this.resultado || !Number.isFinite(dtMs) || dtMs <= 0) return [];
    const eventos: EventoCarrera[] = [];
    let dt = dtMs;
    if (!this.largada) {
      const resto = Math.min(dt, 2400 - this.cuentaMs);
      this.cuentaMs += resto; dt -= resto;
      if (this.largada) eventos.push({ tipo: "largada" });
    }
    if (!this.largada || !dt) return eventos;
    const antes = this.posiciones();
    dt = Math.min(dt, 20000 - this.inactividadMs);
    this.tiempoMs += dt; this.inactividadMs += dt;
    for (const f of this.fantasmas) {
      const llegada = f.ppm > 0 ? this.texto.length * 12000 / f.ppm : Infinity;
      f.progreso = Math.min(1, this.tiempoMs / llegada);
      if (this.tiempoMs >= llegada) f.llegadaMs ??= llegada;
    }
    eventos.push(...this.cruces(antes));
    if (this.inactividadMs >= 20000) { this.inactivo = true; this.pausar(); eventos.push({ tipo: "inactivo" }); }
    return eventos;
  }
  tecla(entrada: string): EventoCarrera[] {
    if (this.inactivo) return this.reanudar();
    if (this.pausa || !this.largada || this.resultado) return [];
    const ch = entrada.normalize("NFC");
    if ([...ch].length !== 1) return [];
    this.inactividadMs = 0;
    if (this.rojas.length >= 5) return [];
    if (this.rojas.length || ch !== this.texto[this.indice]) {
      const indice = this.indice + this.rojas.length;
      this.rojas.push(ch); this.errores++;
      return [{ tipo: "error", indice, ch }];
    }
    const antes = this.posiciones(), indice = this.indice++;
    this.correctas++;
    const eventos: EventoCarrera[] = [{ tipo: "acierto", indice }, ...this.cruces(antes)];
    if (this.indice === this.texto.length) {
      const puesto = 1 + this.fantasmas.filter(f => f.llegadaMs !== null && f.llegadaMs < this.tiempoMs).length;
      this.resultado = {
        gameId: "carrera", textId: this.textId, durationMs: Math.round(this.tiempoMs),
        ppmNeto: this.ppm, precision: this.precision, puntaje: puntajeCarrera(this.ppm, this.precision),
        puesto, rivales: this.fantasmas.length, caracteres: this.texto.length, errores: this.errores,
        cristales: cristalesCarrera(this.texto.length, puesto),
      };
      eventos.push({ tipo: "fin", resultado: this.resultado });
    }
    return eventos;
  }
  borrar(): EventoCarrera[] {
    if (this.inactivo) return this.reanudar();
    if (this.pausa || !this.largada || this.resultado) return [];
    this.inactividadMs = 0;
    const antes = this.posiciones();
    if (this.rojas.length) {
      this.rojas.pop();
      return [{ tipo: "borrado", indice: this.indice + this.rojas.length, eraError: true }];
    }
    if (!this.indice) return [];
    this.indice--;
    return [{ tipo: "borrado", indice: this.indice, eraError: false }, ...this.cruces(antes)];
  }
}
