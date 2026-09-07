import type { EventoMotor, PalabraViva } from "./motor";

export const SIGNOS = {
  frase: "tormenta de signos",
  desde: 30,
  muestras: 6,
  segundosEntreLetras: 1,
  esperaEntrada: 28,
  cierre: 3,
  puntosReferenciaLetras: 5,
  multiplicador: 3,
} as const;

export type FaseSignos = "inactiva" | "entrada" | "activa" | "cierre" | "terminada";
export interface EstadoSignos {
  fase: FaseSignos;
  escrito: number;
  segundos: number;
  puntos: number;
  aciertos: number;
  motivo: "impacto" | "entrada" | null;
}
const GRUPOS = [".,-", "!?¿¡:;/", '"#%=+()*@$&'];

/** Reloj y adaptación propios. No conoce corazones, escudos ni mejoras. */
export class TormentaSignos {
  fase: FaseSignos = "inactiva";
  escrito = 0;
  segundos = 0;
  totalSegundos = 0;
  puntos = 0;
  aciertos = 0;
  caracteres = 0;
  errores = 0;
  motivo: EstadoSignos["motivo"] = null;
  private ritmo = 2.5;
  private proximo = 0;
  private nacimientos = new Map<number, number>();
  constructor(private rng: () => number, private id: () => number, private puntosPorSigno: number,
    private retroceso: number) {}
  get estado(): EstadoSignos {
    return { fase: this.fase, escrito: this.escrito, segundos: this.segundos,
      puntos: this.puntos, aciertos: this.aciertos, motivo: this.motivo };
  }
  get enCurso() { return this.fase === "entrada" || this.fase === "activa" || this.fase === "cierre"; }
  iniciar(vivas: PalabraViva[]): EventoMotor[] {
    this.fase = "entrada";
    this.segundos = 0;
    const palabra: PalabraViva = { id: this.id(), texto: SIGNOS.frase, escrito: 0,
      banda: 0, progreso: 0, errores: 0, vida: SIGNOS.esperaEntrada, carril: 0 };
    vivas.push(palabra);
    return [{ tipo: "signos", estado: this.estado }, { tipo: "nace", palabra }];
  }
  private cerrar(vivas: PalabraViva[], motivo: "impacto" | "entrada"): EventoMotor[] {
    const eventos: EventoMotor[] = vivas.map(p => ({ tipo: "retira", id: p.id }));
    vivas.length = 0;
    this.nacimientos.clear();
    this.fase = "cierre";
    this.motivo = motivo;
    this.segundos = 0;
    eventos.push({ tipo: "signos", estado: this.estado });
    return eventos;
  }
  tick(dt: number, vivas: PalabraViva[]): EventoMotor[] {
    this.totalSegundos += dt;
    this.segundos += dt;
    if (this.fase === "entrada") {
      const frase = vivas[0];
      if (frase) frase.progreso += dt / frase.vida;
      return !frase || frase.progreso >= 1 ? this.cerrar(vivas, "entrada") : [];
    }
    if (this.fase === "cierre") {
      if (this.segundos < SIGNOS.cierre) return [];
      this.fase = "terminada";
      return [{ tipo: "signos", estado: this.estado }];
    }
    // La recta final acelera hasta ser casi imposible alrededor de los 40 s.
    // No hay corte por tiempo: el fin siempre es un impacto.
    const presion = Math.exp(Math.max(0, this.segundos - 30) / 5);
    for (const p of vivas) {
      p.progreso += dt * presion / p.vida;
      if (p.progreso >= 1) return this.cerrar(vivas, "impacto");
    }
    const tope = this.segundos < 8 || this.aciertos < 3 ? 1
      : this.segundos < 18 || this.ritmo > 1.4 ? 2 : 3;
    if (this.segundos < this.proximo || vivas.length >= tope) return [];
    const grupo = this.segundos < 6 ? 0 : this.segundos < 14 ? 1 : 2;
    const conjunto = GRUPOS.slice(0, grupo + 1).join("");
    const disponibles = [...conjunto].filter(ch => !vivas.some(p => p.texto === ch));
    const texto = disponibles[Math.floor(this.rng() * disponibles.length)] ?? ".";
    const palabra: PalabraViva = {
      id: this.id(), texto, escrito: 0, banda: 0, progreso: 0, errores: 0,
      vida: Math.max(4, Math.min(9, this.ritmo * 2.8)),
      carril: (this.rng() * 2 - 1) * .8,
    };
    vivas.push(palabra);
    this.nacimientos.set(palabra.id, this.segundos);
    this.proximo = this.segundos + Math.max(.08, this.ritmo * .85 / presion);
    return [{ tipo: "nace", palabra }];
  }
  tecla(ch: string, vivas: PalabraViva[]): EventoMotor[] {
    if (this.fase === "entrada") {
      const frase = vivas[0];
      if (!frase) return [];
      if (ch !== SIGNOS.frase[this.escrito]) {
        this.errores++; frase.errores++;
        return [{ tipo: "error", id: frase.id, perdonado: true }];
      }
      this.escrito++; this.caracteres++;
      frase.escrito = this.escrito;
      frase.progreso = Math.max(0, frase.progreso - this.retroceso);
      const eventos: EventoMotor[] = [{ tipo: "acierto", id: frase.id }];
      if (this.escrito === SIGNOS.frase.length) {
        vivas.splice(0, 1);
        eventos.push({ tipo: "destruida", id: frase.id, puntos: 0, via: "tipeo" });
        this.fase = "activa"; this.segundos = 0; this.proximo = .8;
      }
      eventos.push({ tipo: "signos", estado: this.estado });
      return eventos;
    }
    if (this.fase !== "activa") return [];
    const objetivo = vivas.filter(p => p.texto === ch).sort((a, b) => b.progreso - a.progreso)[0];
    if (!objetivo) { this.errores++; this.ritmo = Math.min(4, this.ritmo * 1.08); return [{ tipo: "error", id: null, perdonado: true }]; }
    this.caracteres++;
    this.aciertos++;
    this.puntos += this.puntosPorSigno;
    const respuesta = this.segundos - (this.nacimientos.get(objetivo.id) ?? this.segundos);
    this.ritmo = this.ritmo * .7 + Math.max(.35, Math.min(5, respuesta)) * .3;
    this.nacimientos.delete(objetivo.id);
    vivas.splice(vivas.indexOf(objetivo), 1);
    return [{ tipo: "acierto", id: objetivo.id }, { tipo: "destruida", id: objetivo.id, puntos: this.puntosPorSigno, via: "tipeo" }];
  }
}
