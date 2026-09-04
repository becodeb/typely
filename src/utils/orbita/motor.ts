/* Motor de "Tormenta de palabras" — el minijuego del modo Órbita.
 *
 * Es LÓGICA PURA: nada de DOM, nada de React, nada de reloj propio. La
 * página lo alimenta con `tick(dtMs)` desde requestAnimationFrame y con
 * `tecla(ch)` desde el pipeline de entrada, y consume los eventos que
 * devuelve. Esa pureza no es prolijidad: es lo que permite SIMULAR
 * partidas enteras con tipeadores sintéticos y verificar la promesa
 * central del diseño — que la partida dura ~2 minutos para cualquiera —
 * antes de dibujar un solo píxel (scripts/simular-tormenta.mjs).
 *
 * El corazón es el CONTROLADOR DE LAZO CERRADO (§4 de la especificación):
 *
 *   R      = ppm × precisión^1.7        el rendimiento real, medido en una
 *                                       ventana deslizante de 10 s
 *   R̂      = techo estimado             sólo sube, nunca baja
 *   margen(t) = m0 + (t/120)^1.6 · mMax + auxilio · 0.02
 *   demanda   = R̂ · (1 + margen)        lo que el juego exige, en PPM
 *
 * Como el margen crece con el reloj y nunca baja, el juego siempre come
 * terreno: podés mejorar y te sigue, pero la brecha se ensancha sola y en
 * algún momento no la alcanzás. Ese momento cae cerca de los 2 minutos
 * POR CONSTRUCCIÓN — verificado en la simulación, no deseado.
 *
 * De la demanda sale UN número — la amenaza — y de la amenaza salen las
 * cinco perillas (vida de la palabra, cadencia, simultáneas, banda,
 * largo). Nada se ajusta por su cuenta: con cinco perillas independientes
 * el juego sería incalibrable.
 */

import { CORPUS_BANDAS, LARGO_MEDIO_BANDA } from "../../data/orbitaCorpus";

/* ==================================================================== */
/* Ajustes                                                              */
/* ==================================================================== */

/** Todos los números mágicos juntos y con nombre. La simulación corre con
 *  estos mismos valores: si un ajuste cambia acá, cambia en el juego y en
 *  la verificación de los 2 minutos a la vez. */
export const AJUSTES = {
  /* Ventana de medición del tipeo. */
  ventanaMs: 10_000,

  /* VUELO DE PRUEBA (fase 1): 8-10 s en los que llueven palabras cada vez
     más rápido y NADA lastima. El juego te mide el techo mientras calentás,
     y la partida real arranca ya a tu nivel. Para encontrar un techo hay
     que ofrecer MÁS de lo que se puede tipear: la versión anterior daba una
     palabra por vez durante 24 s y medía 12 PPM a cualquiera. */
  calDemanda0: 8, //          PPM con los que arranca todo el mundo
  calCrecimiento: 1.2, //     × por segundo, más el empuje por pantalla vacía
  calTope: 3, //              palabras en pantalla durante el vuelo de prueba
  calMinSegundos: 4, //       s OCUPADOS (con algo en pantalla) antes de poder
  //                          cortar por meseta
  calMesetaSegundos: 2.5, //  s ocupados sin nuevo máximo de R → techo hallado.
  //                          Ocupados, no de reloj: si el juego no ofreció
  //                          nada durante 3 s eso no es una meseta del chico
  //                          (un tipeador de 60 PPM salía del vuelo a los 4 s
  //                          con techo 12 por una pausa entre palabras)
  calIntervaloMax: 2.5, //    s entre palabras durante el vuelo, como mucho: es
  //                          una sonda y tiene que sobrepasar, no esperar 4,5 s
  //                          a que un chico de 8 PPM "pida" la siguiente
  calMaxSegundos: 10, //      el vuelo de prueba nunca dura más que esto
  calCasiImpacto: 0.86, //    progreso que corta la calibración (te alcanzó)
  calAtascoSegundos: 1.5, //  tope de palabras lleno durante esto → el jugador
  //                          es el cuello de botella: cortar. Con el tope
  //                          lleno el spawner se frena y la cola no crece, así
  //                          que "la más vieja" sola no delataba al rápido:
  //                          seguía hasta los 10 s con demanda 89 y techo 49
  calAtascoProgreso: 0.3, //  con el tope de palabras lleno y la más vieja
  //                          pasada de acá, la demanda ya te superó: cortar.
  //                          Esperar al casi-impacto (7.7 s de vuelo) dejaba
  //                          que la demanda siguiera duplicándose mientras
  //                          la cola crecía
  calOcupadoMin: 2, //        s mínimos de "pantalla con algo" para medir:
  //                          por debajo el techo medido es ruido
  /* El vuelo mide en palabras cortas (la demanda arranca en 8 y la banda
     sube con ella), y en una palabra corta manda el tiempo de reacción,
     no el tipeo: un tipeador de 60 PPM rinde 25 en letras sueltas y 45 en
     palabras de diez. Por eso se miden por separado el ritmo DENTRO de la
     palabra y la sobrecarga POR palabra, y el techo se extrapola al largo
     medio de la banda en la que va a jugar. */
  calIntervalosMin: 6, //     teclas dentro de palabra necesarias para extrapolar
  calExtrapolacionTope: 1.8, // la extrapolación nunca supera esto × lo medido
  calAlivioVida: 1.4, //      las palabras que sobreviven al vuelo son la cola
  //                          que dejó la demanda desbordada: se les estira el
  //                          viaje para que la partida real no arranque con
  //                          un impacto ya cocinado

  /* Empuje por pantalla vacía: si destruiste todo y estás esperando, el
     juego se quedó corto. Cada segundo vacío (y tipeando hace poco) la
     demanda sube 30 %. Es lo que vuelve la adaptación instantánea en vez
     de por reloj — y al lento no lo toca, porque nunca vacía la pantalla. */
  vacioEmpuje: 1.3, //        × por segundo con la pantalla vacía, en el vuelo de prueba
  vacioEmpujeJuego: 1.25, //  × por segundo en la partida real
  /* Qué hueco cuenta como "esperar": una FRACCIÓN del intervalo entre
     palabras, no un número fijo de segundos. Con 0.6 s fijos el empuje
     solo actuaba con intervalos largos (demanda baja): a un tipeador de
     60 PPM que salía del vuelo de prueba subestimado (lo mide en palabras
     cortas, donde manda el tiempo de reacción) nada lo corregía y jugaba
     45 s por debajo de su nivel. El hueco relativo se apaga solo cuando
     la demanda llega a ~85 % del techo real — ahí ya no hay hueco. */
  vacioFraccionIntervalo: 0.15,
  vacioSostenidoMin: 0.25, //  s: el temblor de un frame no es un hueco
  vacioTechoSobreDemanda: 1.35, // el empuje no lleva R̂ más allá de esto × la
  //                          demanda actual: una pantalla vacía a demanda 50
  //                          prueba que el techo está algo arriba de 50, no
  //                          que es 100. Sin techo, tras un pulso R̂ pasaba
  //                          de 50 a 102 en cinco segundos
  vacioTipeoReciente: 2.5, // s desde la última tecla para que cuente como "esperando"
  rhatTope: 160, //           el techo estimado no se dispara al infinito

  /* Persecución y colapso (fases 2 y 3). La demanda de la partida real es
     techo × (1 + margen), y el margen sube con el reloj desde margenInicio
     hasta margenMax a los 120 s. ARRANCA NEGATIVO a propósito: el vuelo
     de prueba ahora mide el techo con precisión (antes lo subestimaba un
     25 % y ese error era el aire), y una partida que arranca justo en el
     techo se pierde en 30 s — no por lento, por no tener margen para
     reaccionar. Con 0.85 la presión cruza 1 cerca de los 60 s. */
  margenInicio: -0.15, //     la partida real arranca al 85 % del techo medido
  margenMax: 0.35, //         a t=120 s la demanda es 1.35 × techo
  margenExponente: 1.5,
  margenColapso: 0.15, //     de acá en más la fase se llama "colapso"
  margenPorAuxilio: 0.05, //  cada poder cobrado acelera el final. Subió de
  //                          0.02 cuando los poderes pasaron a viajar en
  //                          palabras comunes: antes se cazaban a veces,
  //                          ahora se cobran todos, y sin esto el lector
  //                          lento se estiraba a 190 s
  demandaPiso: 8, //          nunca se exige menos que esto…
  pisoDeriva: 0.025, //       …y el piso sube solo (PPM por segundo): nadie
  //                          queda flotando para siempre por lento que vaya
  rhatMinimo: 8, //           techo mínimo aunque no tipee nada. Igual al piso
  //                          de demanda: así el más lento arranca la partida
  //                          real con presión 1, no con las palabras ya
  //                          aceleradas (con 6 moría a los 50 s)
  suavizadoDemanda: 1.4, //   qué tan rápido persigue la demanda a su objetivo

  /* Amenaza = demanda / esta constante (120 PPM de demanda → amenaza 100). */
  ppmPorAmenaza: 1.2,

  /* Perillas derivadas de la amenaza y de la PRESIÓN (demanda ÷ techo del
     jugador). La presión es la señal RELATIVA: para un chico de 10 PPM y
     uno de 90, "el juego te está superando" es presión > 1 en los dos,
     aunque sus amenazas absolutas vivan en rangos distintos. La vida de
     la palabra escala con la presión — si dependiera solo de la amenaza,
     el lector lento jugaría eternamente con una palabra plácida de 13 s. */
  vidaMax: 9, //              s de viaje de una palabra sin presión (13 se
  //                          sentía muerto: el lento igual tipea la letra en 2-3 s)
  vidaMin: 2.8, //            s, piso duro
  vidaPresionExp: 1.5, //     vida = vidaMax / presión^esto (1.8 con palabras de
  //                          9 s hacía que una presión leve ya matara al lento)
  intervaloMin: 0.55, //      s entre apariciones, piso
  intervaloMax: 5, //         s, techo (3.4 forzaba a un chico de 10 PPM a recibir
  //                          palabras de tres letras más seguido de lo que su
  //                          demanda pedía: moría a los 67 s)
  simultaneasMax: 8, //       techo duro de palabras vivas (legibilidad)
  empujeRetroceso: 0.045, //  cuánto retrocede una palabra por letra correcta

  /* Asomo de la banda siguiente ("lo aprendido y un poco más allá").
     Desde el primer segundo, no desde amenaza 30: un chico de banda 0 veía
     SOLO letras sueltas, porque nunca llegaba a la amenaza del asomo. */
  asomoProbBase: 0.15,
  asomoProbMax: 0.35,
  asomoAmenazaTope: 60, //  a esta amenaza el asomo ya está en su máximo

  /* Mayúsculas — variedad de teclado. Las bandas bajas vienen en minúscula;
     el motor sortea cuáles salen con mayúscula (Shift), y la página las
     pinta de otro color para que se vea antes de tipear. */
  mayusculaLetraSuelta: 0.3,
  mayusculaInicial: 0.15,
  mayusculaHastaBanda: 4, //  de la 5 en adelante ya traen sus propias mayúsculas

  /* Respiro anti-frustración: 2 corazones antes de este segundo → freno. */
  respiroAntesDe: 45,
  respiroFactor: 0.85,
  respiroSegundos: 8,

  /* Poderes escondidos: viajan en una palabra común con estela especial,
     y recién al destruirla el poder vuela a la nave y se revela cuál era. */
  poderPrimero: [20, 35] as const, //   s (rango sorteado)
  poderCadencia: [18, 28] as const, //  s entre poderes
  poderViajeSegundos: 0.6, //           lo que tarda en volar a la nave
  lentoFactor: 0.45,
  lentoSegundos: 5,
  rayoSegundos: 8,
  cosechaSegundos: 10,
  miraSegundos: 10,

  /* Vida e impactos. */
  corazones: 3,
  escudoTope: 2,
  invulnerableSegundos: 1.5, // una oleada = UN corazón: con 0.8 los tres se
  //                            iban en 2-3 s y el final era un fogonazo
  //                            ilegible en vez de un "¡me quedan dos!"

  /* Puntaje. */
  puntosBase: 10,
  puntosPorLetra: 4,
  puntosPorBanda: 0.16, //    multiplicador: 1 + banda × esto
  rachaPaso: 3, //            cada tantas palabras sin error sube el mult
  rachaSalto: 0.5,
  rachaTope: 4,

  /* Tope absoluto de seguridad: si algo del lazo fallara, la partida
     igual termina. La simulación nunca se acerca a esto. */
  duracionTopeSegundos: 300,
} as const;

export type Ajustes = typeof AJUSTES;

/* ==================================================================== */
/* Tipos                                                                */
/* ==================================================================== */

export type PowerupId =
  | "reparacion"
  | "escudo"
  | "pulso"
  | "lento"
  | "rayo"
  | "cosecha"
  | "mira";

export type RangoId = "cadete" | "piloto" | "explorador" | "as" | "capitan" | "leyenda";

/** Amenaza máxima alcanzada → rango. El puntaje rankea; el rango se cuenta
 *  en el recreo. */
export const RANGOS: readonly { id: RangoId; nombre: string; desde: number }[] = [
  { id: "cadete", nombre: "Cadete", desde: 0 },
  { id: "piloto", nombre: "Piloto", desde: 15 },
  { id: "explorador", nombre: "Explorador", desde: 30 },
  { id: "as", nombre: "As", desde: 50 },
  { id: "capitan", nombre: "Capitán", desde: 70 },
  { id: "leyenda", nombre: "Leyenda", desde: 90 },
];

export const CRISTALES_POR_RANGO: Record<RangoId, number> = {
  cadete: 4,
  piloto: 8,
  explorador: 14,
  as: 22,
  capitan: 32,
  leyenda: 45,
};

export function rangoPorAmenaza(amenazaMax: number): RangoId {
  let r: RangoId = "cadete";
  for (const item of RANGOS) if (amenazaMax >= item.desde) r = item.id;
  return r;
}

export interface PalabraViva {
  id: number;
  texto: string;
  /** Cuántos caracteres ya se escribieron bien. */
  escrito: number;
  banda: number;
  /** 0 = acaba de nacer · 1 = impacta en la nave. */
  progreso: number;
  /** Segundos de viaje totales asignados al nacer. */
  vida: number;
  /** Posición lateral en el punto de fuga, -1..1. */
  carril: number;
  /** Poder escondido que trae, si trae. La página lo ve como "trae algo"
   *  (estela especial) pero no cuál: eso se revela al llegar a la nave. */
  poder: PowerupId | null;
}

export type FaseMotor = "calibracion" | "persecucion" | "colapso";

export interface EfectosActivos {
  lentoHasta: number;
  rayoHasta: number;
  cosechaHasta: number;
  miraHasta: number;
}

export interface ResultadoPartida {
  duracionMs: number;
  puntaje: number;
  amenazaMax: number;
  rango: RangoId;
  ppmMedio: number;
  ppmPico: number;
  /** 0-100. */
  precision: number;
  palabras: number;
  caracteres: number;
  errores: number;
  /** palabras + extra de cosecha + bono de rango. */
  cristales: number;
}

export type EventoMotor =
  | { tipo: "nace"; palabra: PalabraViva }
  | { tipo: "engancha"; id: number }
  | { tipo: "suelta"; id: number }
  | { tipo: "acierto"; id: number }
  | { tipo: "error"; id: number | null }
  | { tipo: "destruida"; id: number; puntos: number; porRayo: boolean; porPulso: boolean }
  /** La palabra murió y su poder está volando hacia la nave. */
  | { tipo: "poderViaja"; id: number; powerup: PowerupId; segundos: number }
  /** El poder llegó y se aplicó: recién acá se muestra cuál era. */
  | { tipo: "poderAplicado"; powerup: PowerupId }
  | { tipo: "impacto"; id: number; escudoAbsorbio: boolean; corazones: number }
  /** Una palabra llegó a la nave DURANTE el vuelo de prueba: no lastima,
   *  solo termina la medición. */
  | { tipo: "roce"; id: number }
  /** Una palabra llegó a la nave dentro de la ventana de invulnerabilidad
   *  que sigue a un impacto: rebota sin daño. La página tiene que borrarla
   *  igual que a cualquier otra que ya no está en `vivas`. */
  | { tipo: "rebote"; id: number }
  | { tipo: "respiro" }
  | { tipo: "fin"; resultado: ResultadoPartida };

/* ==================================================================== */
/* Motor                                                                */
/* ==================================================================== */

export interface OpcionesMotor {
  /** Banda máxima desbloqueada por el modo historia (0..10). */
  bandaMax: number;
  /** RNG inyectable — la simulación corre con semilla. */
  rng?: () => number;
  /** Ajustes parciales para experimentar (la simulación tunea acá). */
  ajustes?: Partial<Ajustes>;
}

interface Pulsacion {
  t: number;
  ok: boolean;
}

export class MotorTormenta {
  readonly aj: Ajustes;
  private readonly rng: () => number;
  private readonly bandaMax: number;

  /* Reloj propio del juego, en segundos JUGADOS. La página no llama a
     tick con la pestaña oculta (rAF se frena solo), así que una
     interrupción de aula pausa la partida en vez de regalarle impactos. */
  t = 0;
  fase: FaseMotor = "calibracion";
  terminada = false;

  corazones: number;
  escudo = 0;
  puntaje = 0;
  racha = 0;

  amenaza = 2;
  amenazaMax = 2;

  vivas: PalabraViva[] = [];
  engancheId: number | null = null;

  efectos: EfectosActivos = { lentoHasta: -1, rayoHasta: -1, cosechaHasta: -1, miraHasta: -1 };

  /* — internos del controlador — */
  private demanda: number;
  private rhat = 0;
  private auxilio = 0;
  /** Segundos OCUPADOS desde el último máximo de R (meseta del vuelo). */
  private ocupadoDesdeMax = 0;
  /** Desde cuándo está lleno el tope del vuelo de prueba (-1 = no lo está). */
  private calTopeLlenoDesde = -1;
  /** Largo de la última palabra nacida: la cadencia se mide contra ÉL.
   *  Con el largo medio de la banda, un ítem de un solo signo (".", "@")
   *  dejaba la pantalla vacía casi todo su intervalo y el empuje leía
   *  "sobra capacidad" — el trinquete que llevaba a amenaza 100. */
  private largoUltimo = 0;
  private frenoHasta = -1;
  private respiroUsado = false;
  private invulnerableHasta = -1;
  private ultimaTecla = -10;
  private vacioDesde = -1;
  /** Intervalo entre apariciones del último tick: el umbral de "hueco" se
   *  mide contra él. */
  private intervaloActual = 1;
  /** Cuándo terminó el vuelo de prueba: el reloj del margen corre desde
   *  ahí, no desde el segundo 0 — la partida real empieza cuando el juego
   *  ya te conoce. */
  private tInicioPartida = 0;
  /** Segundos del vuelo de prueba con algo en pantalla: el techo se mide
   *  sobre este tiempo, no sobre el reloj — esperar palabras no es lentitud. */
  private tOcupado = 0;
  /* Ritmo dentro de la palabra y sobrecarga por palabra, medidos en el
     vuelo de prueba (ver calIntervalosMin). */
  private ultimaTeclaDe = new Map<number, number>();
  private calIntervalos = 0;
  private calSegundosTipeo = 0;
  private calPalabras = 0;
  /** Hasta cuándo NO cuenta la pantalla vacía como "el juego se quedó
   *  corto": un pulso o un rayo la vacían sin mérito del tipeo. */
  private empujeSuspendidoHasta = -1;

  /* — spawn — */
  private proximoId = 1;
  /* Infinito: la primera palabra sale en el primer tick. Con 0, la cuenta
     regresiva terminaba y la pantalla quedaba vacía hasta 4,5 s. */
  private acumuladorSpawn = Number.POSITIVE_INFINITY;
  private proximoPoder: number;
  private siguienteConPoder = false;
  private poderesEnViaje: { powerup: PowerupId; aplicaEn: number }[] = [];

  /* — estadísticas — */
  private pulsaciones: Pulsacion[] = [];
  private aciertosTotal = 0;
  private erroresTotal = 0;
  private palabrasTotal = 0;
  private extraCosecha = 0;
  ppmPico = 0;

  constructor(opciones: OpcionesMotor) {
    this.aj = { ...AJUSTES, ...opciones.ajustes };
    this.rng = opciones.rng ?? Math.random;
    this.bandaMax = Math.max(0, Math.min(CORPUS_BANDAS.length - 1, opciones.bandaMax));
    this.corazones = this.aj.corazones;
    this.demanda = this.aj.calDemanda0;
    this.proximoPoder = this.entre(...this.aj.poderPrimero);
  }

  /* ------------------------------------------------------------------ */
  /* Lecturas para el HUD                                                */
  /* ------------------------------------------------------------------ */

  get ppmInstantaneo(): number {
    const win = this.ventana();
    const correctos = win.reduce((a, p) => a + (p.ok ? 1 : 0), 0);
    return (correctos / 5) * (60_000 / this.aj.ventanaMs);
  }

  get precisionInstantanea(): number {
    const win = this.ventana();
    if (!win.length) return 1;
    return win.reduce((a, p) => a + (p.ok ? 1 : 0), 0) / win.length;
  }

  get cristalesVivos(): number {
    return this.palabrasTotal + this.extraCosecha;
  }

  get rangoActual(): RangoId {
    return rangoPorAmenaza(this.amenazaMax);
  }

  /* ------------------------------------------------------------------ */
  /* Tick                                                                */
  /* ------------------------------------------------------------------ */

  tick(dtMs: number): EventoMotor[] {
    if (this.terminada) return [];
    /* Un frame monstruoso (pestaña que vuelve del fondo) no puede
       convertirse en una lluvia de impactos: se recorta. */
    const dt = Math.min(Math.max(dtMs, 0), 100) / 1000;
    this.t += dt;

    const eventos: EventoMotor[] = [];
    const aj = this.aj;
    const lento = this.t < this.efectos.lentoHasta ? aj.lentoFactor : 1;

    /* ---- Controlador ---- */
    const R = this.ppmInstantaneo * Math.pow(this.precisionInstantanea, 1.7);

    /* ¿Pantalla vacía SOSTENIDA con el jugador tipeando? El juego se quedó
       corto. Sostenida: un hueco de medio segundo entre dos palabras es
       cadencia normal, no espera. */
    if (this.vivas.length === 0) {
      if (this.vacioDesde < 0) this.vacioDesde = this.t;
    } else {
      this.vacioDesde = -1;
    }
    const empujeSuspendido =
      this.t < this.efectos.lentoHasta || this.t < this.empujeSuspendidoHasta;
    const vacio =
      !empujeSuspendido &&
      this.vacioDesde >= 0 &&
      this.t - this.vacioDesde >=
        Math.max(aj.vacioSostenidoMin, aj.vacioFraccionIntervalo * this.intervaloActual) &&
      this.t > 0.5 &&
      this.t - this.ultimaTecla <= aj.vacioTipeoReciente;
    const empuje = vacio
      ? Math.pow(this.fase === "calibracion" ? aj.vacioEmpuje : aj.vacioEmpujeJuego, dt)
      : 1;

    if (this.fase === "calibracion") {
      this.demanda = Math.min(140, this.demanda * Math.pow(aj.calCrecimiento, dt) * empuje);
      if (this.vivas.length) {
        this.tOcupado += dt;
        this.ocupadoDesdeMax += dt;
      }
      if (R > this.rhat + 0.5) {
        this.rhat = R;
        this.ocupadoDesdeMax = 0;
      }
      const masVieja = this.vivas.reduce((m, p) => Math.max(m, p.progreso), 0);
      const casiImpacto = masVieja >= aj.calCasiImpacto;
      if (this.vivas.length >= aj.calTope) {
        if (this.calTopeLlenoDesde < 0) this.calTopeLlenoDesde = this.t;
      } else this.calTopeLlenoDesde = -1;
      const topeLleno =
        this.calTopeLlenoDesde >= 0 && this.t - this.calTopeLlenoDesde >= aj.calAtascoSegundos;
      const atascado =
        topeLleno || (this.vivas.length >= aj.calTope && masVieja >= aj.calAtascoProgreso);
      const meseta =
        this.tOcupado >= aj.calMinSegundos && this.ocupadoDesdeMax >= aj.calMesetaSegundos;
      if (casiImpacto || atascado || meseta || this.t >= aj.calMaxSegundos) {
        this.terminarCalibracion();
      }
    } else {
      /* Lo tipeado (R) sube el techo sin límite; el EMPUJE, solo hasta un
         poco por encima de la demanda que dejó la pantalla vacía. */
      const base = Math.max(this.rhat, R);
      const empujado = Math.min(base * empuje, Math.max(base, this.demanda * aj.vacioTechoSobreDemanda));
      this.rhat = Math.min(aj.rhatTope, empujado);
      const tPartida = Math.max(0, this.t - this.tInicioPartida);
      const margen =
        aj.margenInicio +
        (aj.margenMax - aj.margenInicio) * Math.pow(tPartida / 120, aj.margenExponente) +
        this.auxilio * aj.margenPorAuxilio;
      if (this.fase === "persecucion" && margen > aj.margenColapso) {
        this.fase = "colapso";
      }
      const piso = aj.demandaPiso + this.t * aj.pisoDeriva;
      let objetivo = Math.max(piso, this.rhat * (1 + margen));
      if (this.t < this.frenoHasta) objetivo *= aj.respiroFactor;
      /* Persigue hacia arriba con suavidad; hacia abajo (respiro, sobre-
         estimación) corrige el triple de rápido — aflojar tarde no alivia. */
      const velocidad = objetivo < this.demanda ? aj.suavizadoDemanda * 3 : aj.suavizadoDemanda;
      this.demanda += (objetivo - this.demanda) * Math.min(1, dt * velocidad);
    }

    this.amenaza = Math.min(100, Math.max(2, this.demanda / aj.ppmPorAmenaza));
    /* El máximo que define el rango se toma DESPUÉS de calibrar: el pico
       de la sonda es del instrumento, no del chico. */
    if (this.fase !== "calibracion" && this.amenaza > this.amenazaMax) {
      this.amenazaMax = this.amenaza;
    }

    /* ---- PPM pico (con la ventana ya poblada, no en el arranque) ---- */
    if (this.t > 8) this.ppmPico = Math.max(this.ppmPico, this.ppmInstantaneo);

    /* ---- Perillas ---- */
    const enCalibracion = this.fase === "calibracion";
    const banda = this.bandaActual();
    const cps = (this.demanda * 5) / 60;
    /* Cadencia: la siguiente palabra llega cuando la ÚLTIMA "se pagó" a
       la demanda actual — su largo real dividido por los caracteres por
       segundo. Así la tasa ofrecida es la demanda, palabra por palabra. */
    const largoRef = this.largoUltimo > 0 ? this.largoUltimo : (LARGO_MEDIO_BANDA[banda] ?? 4);
    let intervalo = Math.min(aj.intervaloMax, Math.max(aj.intervaloMin, largoRef / Math.max(cps, 0.5)));
    if (enCalibracion) intervalo = Math.min(intervalo, aj.calIntervaloMax);
    this.intervaloActual = intervalo;
    /* Durante la calibración no hay presión que medir (el techo todavía
       no existe): vida plena y UNA palabra por vez. Aplicar la presión
       antes de tener techo daba palabras de 3 s en el segundo diez de la
       primera partida de un lector lento — muerte injusta e instantánea. */
    const presion = enCalibracion ? 1 : this.demanda / Math.max(this.rhat, aj.rhatMinimo);
    const vida = Math.min(
      aj.vidaMax,
      Math.max(aj.vidaMin, aj.vidaMax / Math.pow(Math.max(presion, 1), aj.vidaPresionExp)),
    );
    /* Después de calibrar siempre pueden convivir al menos TRES — con dos,
       el tipeador lento jugaba de a una palabra, nunca acumulaba cola y la
       partida se estiraba a 190 s. La muerte de este juego es por
       acumulación: el tope tiene que dejar que se acumule. */
    /* Por debajo de amenaza 30 conviven DOS palabras, no tres: con vida de
       9 s, dos ya bastan para que al que reacciona lento se le acumule la
       cola — con tres, los perfiles lentos morían a los 65-75 s. */
    const tope = enCalibracion
      ? aj.calTope
      : this.amenaza < 30
        ? 2
        : Math.min(aj.simultaneasMax, 3 + Math.floor(this.amenaza / 20));

    /* ---- Nacimientos ---- */
    /* ---- ¿La próxima palabra trae un poder escondido? ---- */
    if (
      this.fase !== "calibracion" &&
      !this.siguienteConPoder &&
      !this.vivas.some((p) => p.poder) &&
      this.t >= this.proximoPoder
    ) {
      this.siguienteConPoder = true;
    }

    this.acumuladorSpawn += dt * lento;
    if (this.acumuladorSpawn >= intervalo && this.vivas.length < tope) {
      this.acumuladorSpawn = 0;
      const palabra = this.nacer(banda, vida);
      eventos.push({ tipo: "nace", palabra });
    }

    /* ---- Poderes que llegan a la nave ---- */
    for (const viaje of [...this.poderesEnViaje]) {
      if (this.t < viaje.aplicaEn) continue;
      this.poderesEnViaje = this.poderesEnViaje.filter((v) => v !== viaje);
      eventos.push({ tipo: "poderAplicado", powerup: viaje.powerup });
      eventos.push(...this.aplicarPowerup(viaje.powerup));
    }

    /* ---- Avance y aterrizajes ---- */
    for (const p of [...this.vivas]) {
      p.progreso += (dt * lento) / p.vida;
      if (p.progreso < 1) continue;

      this.quitar(p.id);
      /* Si traía un poder, se perdió con ella: el aterrizaje duele igual. */

      /* Durante el vuelo de prueba nada lastima: te alcanzó una → el juego
         ya sabe tu techo, y la partida real arranca acá. */
      if (this.fase === "calibracion") {
        eventos.push({ tipo: "roce", id: p.id });
        this.terminarCalibracion();
        continue;
      }

      if (this.t < this.invulnerableHasta) {
        /* Rebota sin daño — pero la página TIENE que enterarse. Antes esto
           era un `continue` pelado: la palabra salía de `vivas` sin evento,
           y su elemento quedaba en pantalla para siempre, pegado a la nave,
           sin poder tipearse (el motor ya no la conocía) y sin impactar
           nunca (ya había llegado). Con el tambaleo encima, temblaba. */
        eventos.push({ tipo: "rebote", id: p.id });
        continue;
      }

      let escudoAbsorbio = false;
      if (this.escudo > 0) {
        this.escudo -= 1;
        escudoAbsorbio = true;
      } else {
        this.corazones -= 1;
      }
      this.invulnerableHasta = this.t + aj.invulnerableSegundos;
      eventos.push({ tipo: "impacto", id: p.id, escudoAbsorbio, corazones: this.corazones });

      /* Respiro anti-frustración: la espiral de muerte temprana es la que
         hace que un chico no vuelva a jugar. Una vez por partida. */
      if (
        !this.respiroUsado &&
        !escudoAbsorbio &&
        this.corazones === 1 &&
        this.t < aj.respiroAntesDe
      ) {
        this.respiroUsado = true;
        this.frenoHasta = this.t + aj.respiroSegundos;
        eventos.push({ tipo: "respiro" });
      }

      if (this.corazones <= 0) {
        eventos.push(this.finalizar());
        return eventos;
      }
    }

    if (this.t >= aj.duracionTopeSegundos) eventos.push(this.finalizar());
    return eventos;
  }

  /* ------------------------------------------------------------------ */
  /* Entrada                                                             */
  /* ------------------------------------------------------------------ */

  /** Un carácter ya compuesto por el sistema (á, ñ, ¿ llegan enteros). */
  tecla(ch: string): EventoMotor[] {
    if (this.terminada || !ch) return [];
    this.ultimaTecla = this.t;
    const eventos: EventoMotor[] = [];

    let objetivo = this.engancheId != null ? this.porId(this.engancheId) : null;

    if (!objetivo) {
      /* Enganche por primera letra; si hay empate gana la más cercana a
         impactar — es la que urge. */
      const candidatas = this.vivas
        .filter((p) => p.texto[0] === ch)
        .sort((a, b) => b.progreso - a.progreso);
      objetivo = candidatas[0] ?? null;
      if (!objetivo) {
        this.registrar(false);
        eventos.push({ tipo: "error", id: null });
        return eventos;
      }
      this.engancheId = objetivo.id;
      eventos.push({ tipo: "engancha", id: objetivo.id });
    }

    const esperado = objetivo.texto[objetivo.escrito];
    if (ch !== esperado) {
      /* El error NO desengancha: un tropiezo no te deja indefenso. */
      this.registrar(false);
      eventos.push({ tipo: "error", id: objetivo.id });
      return eventos;
    }

    this.registrar(true);
    objetivo.escrito += 1;
    if (this.fase === "calibracion") this.medirRitmo(objetivo);
    objetivo.progreso = Math.max(0, objetivo.progreso - this.aj.empujeRetroceso);
    eventos.push({ tipo: "acierto", id: objetivo.id });

    if (objetivo.escrito >= objetivo.texto.length) {
      this.engancheId = null;
      eventos.push(...this.matar(objetivo, { porRayo: false, porPulso: false }));
      /* Rayo dividido: la palabra completada daña también a la más
         cercana. */
      if (this.t < this.efectos.rayoHasta) {
        const cercana = [...this.vivas].sort((a, b) => b.progreso - a.progreso)[0];
        if (cercana) eventos.push(...this.matar(cercana, { porRayo: true, porPulso: false }));
      }
    }
    return eventos;
  }

  /** Escape: soltar el enganche para atender una palabra más urgente. */
  escape(): EventoMotor[] {
    if (this.engancheId == null) return [];
    const id = this.engancheId;
    this.engancheId = null;
    return [{ tipo: "suelta", id }];
  }

  /* ------------------------------------------------------------------ */
  /* Privados                                                            */
  /* ------------------------------------------------------------------ */

  /** Fin del vuelo de prueba: el techo queda fijado y la demanda, que
   *  SIEMPRE sobrepasa (crece hasta chocar), se corrige de un salto — no
   *  suavizado: dos segundos de demanda regalada de más matan injustamente
   *  al que tipea lento. */
  private terminarCalibracion() {
    if (this.fase !== "calibracion") return;
    const aj = this.aj;
    this.fase = "persecucion";
    this.tInicioPartida = this.t;

    /* Techo medido: lo que tipeó bien MIENTRAS HABÍA ALGO QUE TIPEAR, en
       PPM, castigado por precisión — el mismo R de la ventana pero
       dividido por el tiempo ocupado, no por los 10 s. Con la ventana,
       un tipeador de 60 PPM que pasó medio vuelo esperando (la demanda
       arranca en 8) medía 30 y arrancaba aburrido; y el intento anterior
       de "acreditarle" la última demanda cuando terminaba por tiempo
       dependía de cuán vieja era la palabra más avanzada — un chico de
       25 PPM salía con techo 45 y moría a los 30 s. Este número no
       depende de cómo terminó el vuelo: es lo que las manos hicieron. */
    const total = this.aciertosTotal + this.erroresTotal;
    const precision = total ? this.aciertosTotal / total : 1;
    const castigo = Math.pow(precision, 1.7);
    const ocupado = Math.max(aj.calOcupadoMin, this.tOcupado);
    let rMedido = (this.aciertosTotal / 5) * (60 / ocupado) * castigo;

    /* Extrapolación al largo de la banda real: tiempo por palabra =
       sobrecarga + (largo − 1) / ritmo. Iterar tres veces porque la banda
       depende de la demanda que sale de este mismo número. */
    if (
      this.calIntervalos >= aj.calIntervalosMin &&
      this.calPalabras >= 3 &&
      this.calSegundosTipeo > 0
    ) {
      const ritmo = this.calIntervalos / this.calSegundosTipeo; // teclas/s dentro de palabra
      const sobrecarga = Math.max(0.1, (this.tOcupado - this.calSegundosTipeo) / this.calPalabras);
      let r = rMedido;
      for (let i = 0; i < 3; i++) {
        const amenaza = Math.max(2, (r * (1 + aj.margenInicio)) / aj.ppmPorAmenaza);
        const banda = Math.min(this.bandaMax, Math.floor(amenaza / 8));
        const largo = Math.max(1, LARGO_MEDIO_BANDA[banda] ?? 4);
        r = (largo / (sobrecarga + (largo - 1) / ritmo)) * 12 * castigo;
      }
      rMedido = Math.max(rMedido, Math.min(r, rMedido * aj.calExtrapolacionTope));
    }
    this.rhat = Math.max(this.rhat, rMedido, aj.rhatMinimo);
    this.demanda = Math.min(this.demanda, this.rhat * (1 + aj.margenInicio));

    /* Las sobrevivientes son la cola que dejó la demanda desbordada. */
    for (const p of this.vivas) p.vida *= aj.calAlivioVida;
    this.ultimaTeclaDe.clear();
  }

  /** Cada acierto del vuelo de prueba alimenta dos medidas: el ritmo entre
   *  teclas DENTRO de una palabra y cuántas palabras se empezaron (la
   *  sobrecarga por palabra sale del tiempo ocupado que no fue tipeo). Se
   *  acumula tecla a tecla, así la palabra a medio escribir al cerrar el
   *  vuelo también cuenta. */
  private medirRitmo(p: PalabraViva) {
    const anterior = this.ultimaTeclaDe.get(p.id);
    if (anterior === undefined) this.calPalabras += 1;
    else {
      this.calIntervalos += 1;
      this.calSegundosTipeo += this.t - anterior;
    }
    this.ultimaTeclaDe.set(p.id, this.t);
  }

  private bandaActual(): number {
    const aj = this.aj;
    /* ÷8 y no ÷12: a 40 PPM ya hay palabras largas y mensajes, a 60
       tildes y signos. Con ÷12 a 40 PPM seguías en palabras de tres letras. */
    const base = Math.min(this.bandaMax, Math.floor(this.amenaza / 8));
    /* Asomo de la banda siguiente — zona de desarrollo próximo. Siempre
       presente (un chico de banda 0 tiene que ver palabritas, no solo
       letras) y más frecuente a medida que aprieta la amenaza. */
    /* En el vuelo de prueba no hay asomo: la sonda mide velocidad, y una
       palabra de la banda siguiente que quede colgada al cerrar el vuelo
       ("ventana" para un chico de 10 PPM) era un corazón perdido a los
       20 s de la partida real. */
    if (this.fase === "calibracion") return CORPUS_BANDAS[base].length ? base : 0;
    const siguiente = Math.min(base + 1, this.bandaMax + 1, CORPUS_BANDAS.length - 1);
    if (siguiente > base && CORPUS_BANDAS[siguiente].length) {
      const p =
        aj.asomoProbBase +
        (aj.asomoProbMax - aj.asomoProbBase) * Math.min(1, this.amenaza / aj.asomoAmenazaTope);
      if (this.rng() < p) return siguiente;
    }
    return CORPUS_BANDAS[base].length ? base : 0;
  }

  private nacer(banda: number, vida: number): PalabraViva {
    const items = CORPUS_BANDAS[banda];
    /* Hasta 4 sorteos evitando repetir la primera letra de una viva: dos
       palabras con la misma inicial vuelven ambiguo el enganche. */
    let texto = items[Math.floor(this.rng() * items.length)];
    for (let i = 0; i < 4; i++) {
      const inicialOcupada = this.vivas.some((p) => p.texto[0] === texto[0]);
      const repetida = this.vivas.some((p) => p.texto === texto);
      if (!inicialOcupada && !repetida) break;
      texto = items[Math.floor(this.rng() * items.length)];
    }
    /* Mayúsculas: en las bandas bajas (que vienen en minúscula) algunas
       salen con Shift — una letra suelta entera, o la inicial de una
       palabra. La página las pinta distinto para que se anticipe. */
    if (banda <= this.aj.mayusculaHastaBanda && /^[a-záéíóúüñ]/.test(texto)) {
      if (texto.length === 1) {
        if (this.rng() < this.aj.mayusculaLetraSuelta) texto = texto.toUpperCase();
      } else if (this.rng() < this.aj.mayusculaInicial) {
        texto = texto[0]!.toUpperCase() + texto.slice(1);
      }
    }

    let poder: PowerupId | null = null;
    if (this.siguienteConPoder) {
      this.siguienteConPoder = false;
      poder = this.sortearPowerup();
      this.proximoPoder = this.t + this.entre(...this.aj.poderCadencia);
    }

    const palabra: PalabraViva = {
      id: this.proximoId++,
      texto,
      escrito: 0,
      banda,
      progreso: 0,
      vida,
      carril: (this.rng() * 2 - 1) * 0.85,
      poder,
    };
    this.vivas.push(palabra);
    this.largoUltimo = texto.length;
    return palabra;
  }

  /** Destruye una palabra y, si traía un poder, lo manda de viaje a la
   *  nave: se aplica cuando LLEGA, no antes, para que la sorpresa se
   *  revele donde se ve. */
  private matar(p: PalabraViva, via: { porRayo: boolean; porPulso: boolean }): EventoMotor[] {
    const eventos = this.destruir(p, via);
    /* La pantalla que un rayo o un pulso vacían no dice nada del tipeo:
       el empuje se calla hasta que vuelva a haber cadencia normal. */
    if (via.porRayo || via.porPulso) {
      this.empujeSuspendidoHasta = Math.max(
        this.empujeSuspendidoHasta,
        this.t + this.intervaloActual + 0.5,
      );
    }
    if (p.poder) {
      const segundos = this.aj.poderViajeSegundos;
      this.poderesEnViaje.push({ powerup: p.poder, aplicaEn: this.t + segundos });
      eventos.push({ tipo: "poderViaja", id: p.id, powerup: p.poder, segundos });
    }
    return eventos;
  }

  private sortearPowerup(): PowerupId {
    /* Pesos según el momento: reparación cuando faltan corazones, pulso
       cuando la pantalla está ahogada. */
    const pesos: [PowerupId, number][] = [
      ["reparacion", this.corazones < this.aj.corazones ? 20 : 4],
      ["escudo", this.escudo < this.aj.escudoTope ? 18 : 4],
      ["pulso", this.vivas.length >= 5 ? 16 : 5],
      ["lento", 15],
      ["rayo", 12],
      ["cosecha", 12],
      ["mira", 10],
    ];
    const total = pesos.reduce((a, [, w]) => a + w, 0);
    let azar = this.rng() * total;
    for (const [id, w] of pesos) {
      azar -= w;
      if (azar <= 0) return id;
    }
    return "lento";
  }

  private aplicarPowerup(id: PowerupId): EventoMotor[] {
    const eventos: EventoMotor[] = [];
    const aj = this.aj;
    /* Todo auxilio consumido acelera el margen: sin esto, el que mejor
       juega estira la partida a 4 minutos y la promesa se rompe justo
       para él (§4.5 del diseño). */
    this.auxilio += 1;

    switch (id) {
      case "reparacion":
        this.corazones = Math.min(aj.corazones, this.corazones + 1);
        break;
      case "escudo":
        this.escudo = Math.min(aj.escudoTope, this.escudo + 1);
        break;
      case "pulso":
        for (const p of [...this.vivas]) {
          eventos.push(...this.matar(p, { porRayo: false, porPulso: true }));
        }
        this.engancheId = null;
        break;
      case "lento":
        this.efectos.lentoHasta = this.t + aj.lentoSegundos;
        /* Con la lluvia frenada la pantalla se vacía sola; tampoco cuenta
           el primer intervalo después, que arranca de cero. */
        this.empujeSuspendidoHasta = Math.max(
          this.empujeSuspendidoHasta,
          this.efectos.lentoHasta + this.intervaloActual,
        );
        break;
      case "rayo":
        this.efectos.rayoHasta = this.t + aj.rayoSegundos;
        break;
      case "cosecha":
        this.efectos.cosechaHasta = this.t + aj.cosechaSegundos;
        break;
      case "mira":
        this.efectos.miraHasta = this.t + aj.miraSegundos;
        break;
    }
    return eventos;
  }

  private destruir(
    p: PalabraViva,
    via: { porRayo: boolean; porPulso: boolean },
  ): EventoMotor[] {
    this.quitar(p.id);
    if (this.engancheId === p.id) this.engancheId = null;

    const aj = this.aj;
    const mult = Math.min(
      aj.rachaTope,
      1 + aj.rachaSalto * Math.floor(this.racha / aj.rachaPaso),
    );
    let puntos =
      (aj.puntosBase + aj.puntosPorLetra * p.texto.length) *
      (1 + aj.puntosPorBanda * p.banda) *
      (1 + this.amenaza / 50) *
      mult;
    if (via.porRayo || via.porPulso) puntos *= 0.5;
    puntos = Math.round(puntos);

    this.puntaje += puntos;
    this.palabrasTotal += 1;
    if (this.t < this.efectos.cosechaHasta) this.extraCosecha += 1;
    if (!via.porRayo && !via.porPulso) this.racha += 1;

    return [{ tipo: "destruida", id: p.id, puntos, porRayo: via.porRayo, porPulso: via.porPulso }];
  }

  private finalizar(): EventoMotor {
    this.terminada = true;
    const duracionMs = Math.round(this.t * 1000);
    const rango = rangoPorAmenaza(this.amenazaMax);
    const minutos = Math.max(this.t / 60, 1 / 60);
    const resultado: ResultadoPartida = {
      duracionMs,
      puntaje: this.puntaje,
      amenazaMax: Math.round(this.amenazaMax),
      rango,
      ppmMedio: Math.round(this.aciertosTotal / 5 / minutos),
      ppmPico: Math.round(this.ppmPico),
      precision: this.aciertosTotal + this.erroresTotal
        ? Math.round((this.aciertosTotal / (this.aciertosTotal + this.erroresTotal)) * 100)
        : 100,
      palabras: this.palabrasTotal,
      caracteres: this.aciertosTotal,
      errores: this.erroresTotal,
      cristales: this.palabrasTotal + this.extraCosecha + CRISTALES_POR_RANGO[rango],
    };
    return { tipo: "fin", resultado };
  }

  private registrar(ok: boolean) {
    this.pulsaciones.push({ t: this.t, ok });
    if (ok) this.aciertosTotal += 1;
    else {
      this.erroresTotal += 1;
      this.racha = 0;
    }
  }

  private ventana(): Pulsacion[] {
    const desde = this.t - this.aj.ventanaMs / 1000;
    /* La lista es corta (≤ ~120 pulsaciones en 10 s): filtrar alcanza y
       de paso poda para que no crezca sin límite. */
    this.pulsaciones = this.pulsaciones.filter((p) => p.t >= desde);
    return this.pulsaciones;
  }

  private porId(id: number): PalabraViva | null {
    return this.vivas.find((p) => p.id === id) ?? null;
  }

  private quitar(id: number) {
    this.vivas = this.vivas.filter((p) => p.id !== id);
    if (this.engancheId === id) this.engancheId = null;
  }

  private entre(min: number, max: number): number {
    return min + this.rng() * (max - min);
  }
}
