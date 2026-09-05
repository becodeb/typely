/* Todas las perillas del Modo Automatización, en un solo lugar.
 *
 * Están acá y no repartidas por los componentes por una razón práctica:
 * estos números NO son diseño cerrado (MVP.md §15). Son la primera
 * calibración razonable y se van a mover en cuanto un chico lo pruebe.
 * Si alguna de estas constantes aparece escrita a mano dentro de un
 * componente, el playtesting se vuelve imposible: ajustar el ritmo pasa
 * a ser una cacería por el árbol de archivos.
 *
 * El objetivo de ESTA primera calibración (IMPLEMENTACION.md §8):
 *   - la primera interacción se entiende en menos de un minuto;
 *   - la primera compra cae dentro de una sesión corta;
 *   - `Repetir` aparece temprano y se nota en la producción;
 *   - más memoria sirve, pero se encarece rápido.
 *
 * Y desde PROGRESION.md, la regla que ordena todo lo demás: CADA COLOR
 * ES UN RECURSO. Los cuatro minerales forman una cadena (chispa → cuarzo
 * → prisma → estrella) y cada uno se paga con el anterior, igual que en
 * The Farmer Was Replaced el heno paga la madera y la madera las
 * zanahorias. Nada se saltea.
 */

/* ------------------------------------------------------------------ */
/* Los minerales                                                       */
/* ------------------------------------------------------------------ */

export type Mineral = "punta" | "racimo" | "prisma" | "estrella";

/** Un precio: cuánto de cada mineral. `{ punta: 5 }`, `{ racimo: 3, punta: 10 }`. */
export type Costo = Partial<Record<Mineral, number>>;

export interface FichaMineral {
  nombre: string;
  valor: number;
  factorCrecimiento: number;
  /** Desde qué lado de isla existe. */
  desdeLado: number;
  /** Rebrota sola al cosecharla (o al romperse). */
  rebrotaSolo: boolean;
  /** Cosecharla verde la rompe (vuelve a cero, no paga). */
  seRompeVerde: boolean;
  /** Qué cuesta plantarla, o null si no se planta: brota sola. */
  semilla: Costo | null;
  /** No crece con otra igual al lado (fila o columna). */
  espaciado: boolean;
}

export const MINERALES: Record<Mineral, FichaMineral> = {
  /** La chispa. Gratis y abundante: el heno. Perdona todo. */
  punta: {
    nombre: "Chispa",
    valor: 1,
    factorCrecimiento: 1,
    desdeLado: 1,
    rebrotaSolo: true,
    seRompeVerde: false,
    semilla: null,
    espaciado: false,
  },
  /** El cuarzo. Lento, y se rompe si se cosecha verde: la razón de `Si`. */
  racimo: {
    nombre: "Cuarzo",
    valor: 3,
    factorCrecimiento: 2,
    desdeLado: 2,
    rebrotaSolo: true,
    seRompeVerde: true,
    semilla: null,
    espaciado: false,
  },
  /** El prisma. Sólo si se planta: la razón de `Plantar` y de `está vacía`. */
  prisma: {
    nombre: "Prisma",
    valor: 6,
    factorCrecimiento: 1.5,
    desdeLado: 3,
    rebrotaSolo: false,
    seRompeVerde: true,
    semilla: { punta: 2 },
    espaciado: false,
  },
  /** La estrella. Se planta, tarda, y no crece pegada a otra: la razón de
   *  planificar el campo. */
  estrella: {
    nombre: "Estrella",
    valor: 15,
    factorCrecimiento: 3,
    desdeLado: 4,
    rebrotaSolo: false,
    seRompeVerde: true,
    semilla: { racimo: 3 },
    espaciado: true,
  },
};

export const ORDEN_MINERALES: readonly Mineral[] = ["punta", "racimo", "prisma", "estrella"];

/** El mineral anterior en la cadena: con él se paga parte de la evolución. */
export function mineralAnterior(m: Mineral): Mineral | null {
  const i = ORDEN_MINERALES.indexOf(m);
  return i > 0 ? ORDEN_MINERALES[i - 1] : null;
}

/* ------------------------------------------------------------------ */
/* Evolución de los cristales (PROGRESION.md §3)                       */
/* ------------------------------------------------------------------ */

export const EVOLUCION = {
  /** Niveles 1 a 4. Multiplicador del valor de la cosecha por nivel. */
  valor: [1, 1.6, 2.5, 4] as const,
  /** Multiplicador del tiempo de crecimiento por nivel (menos es más rápido). */
  crecimiento: [1, 0.9, 0.8, 0.7] as const,
  nivelMaximo: 4,
  /** Precio del nivel siguiente: base × mult^(nivel−1) del propio mineral,
   *  más la mitad del anterior. Evolucionar exige seguir cosechando lo
   *  de abajo: nada queda obsoleto. */
  base: 12,
  multiplicador: 2.2,
} as const;

export function precioEvolucion(m: Mineral, nivelActual: number): Costo | null {
  if (nivelActual >= EVOLUCION.nivelMaximo) return null;
  const propio = Math.round(EVOLUCION.base * Math.pow(EVOLUCION.multiplicador, nivelActual - 1));
  const costo: Costo = { [m]: propio };
  const anterior = mineralAnterior(m);
  if (anterior) costo[anterior] = Math.round(propio / 2);
  return costo;
}

/* ------------------------------------------------------------------ */
/* El resto de las perillas                                            */
/* ------------------------------------------------------------------ */

export const AJUSTES = {
  /* Lado de la cuadrícula al empezar. UNA baldosa, como en "The Farmer
     Was Replaced": al principio lo único que se puede hacer es cosechar,
     y esa pobreza es intencional. La primera compra —más tierra— es la
     que estrena el movimiento, y por eso se siente. Si el campo
     empezara grande, la expansión sería una mejora más entre otras en
     vez del momento en que el juego se abre. */
  ladoInicial: 1,
  ladoMaximo: 4,

  /** Ranuras de memoria al empezar (MVP.md §7). */
  capacidadInicial: 3,

  /** Cuánto tarda la nave en ejecutar UNA instrucción, sin mejoras. */
  msPorAccion: 650,
  /** Cada nivel de "velocidad" multiplica ese tiempo por esto. */
  factorVelocidad: 0.78,
  /** Piso duro: por debajo de esto la nave se vuelve ilegible. */
  msPorAccionMinimo: 180,

  /** Cuánto tarda una veta de CHISPA en pasar de una etapa a la
   *  siguiente. Tres segundos: el ciclo entero se ve en una sesión
   *  corta. Los otros minerales lo multiplican (MINERALES). */
  msPorEtapa: 3_000,
  /** Cada nivel de "crecimiento" multiplica ese tiempo por esto. */
  factorCrecimiento: 0.82,
  msPorEtapaMinimo: 700,

  /* --- topes de ejecución (IMPLEMENTACION.md §6) --------------------
     Aunque no exista `Por siempre`, un programa tiene que terminar. Un
     `Repetir` con N grande dentro de un campo grande puede expandirse a
     miles de pasos, y alcanzar el tope se trata como una detención
     normal: sin modal, sin la palabra error. */
  maxPasosEjecucion: 120,
  /** Cuántos nodos puede tener un programa antes de considerarlo inválido. */
  maxNodos: 60,
  /** Anidamiento: un contenedor adentro de otro, y nada más. Un `Si`
   *  dentro de un `Repetir` dentro de un `Por siempre` ya no se lee. */
  maxProfundidad: 2,
  /** Valores de N que ofrece el contenedor. Pocos, elegibles a golpe de vista. */
  opcionesRepetir: [2, 3, 4] as const,

  /* --- producción reciente (IMPLEMENTACION.md §9) ------------------- */
  /** Ventana sobre la que se promedia la tasa. */
  ventanaTasaMs: 60_000,
  /** Menos cosechas que esto en la ventana y no se publica un récord:
      una sola cosecha afortunada no puede inflar la marca personal. */
  minCosechasParaRecord: 5,

  /* --- reloj del mundo ---------------------------------------------
     El mundo NO avanza con el reloj de pared sino con el tiempo jugado
     (ver motor.ts). Este tope corta el salto que produce una pestaña
     que vuelve del fondo o un frame trabado: sin él, volver después de
     un rato regalaría cosechas maduras. */
  dtMaximoMs: 250,

  /* --- economía ----------------------------------------------------
     Precio del nivel n:  base × multiplicador^n  (n arranca en 0), en
     el mineral que diga `moneda`. La tierra es la excepción: cada era
     se paga con lo que la era anterior enseñó a cosechar. */
  mejoras: {
    /** Cada nivel agranda el campo un lado: 1×1 → 2×2 → … Es la compra
     *  más cara de su momento y la única que cambia el mundo. */
    campo: {
      precios: [{ punta: 5 }, { punta: 40 }, { racimo: 60 }, { prisma: 120 }] as Costo[],
      maxNivel: 3,
    },
    capacidad: { moneda: "punta" as Mineral, base: 8, multiplicador: 1.8, maxNivel: 12 },
    velocidad: { moneda: "punta" as Mineral, base: 16, multiplicador: 2.0, maxNivel: 6 },
    crecimiento: { moneda: "punta" as Mineral, base: 20, multiplicador: 2.1, maxNivel: 6 },
    /* Las piezas no son niveles: se compran una vez y aparecen en la
       caja. Cada una se paga con el mineral de la etapa anterior a la
       que la necesita (PROGRESION.md §5). */
    repetir: { moneda: "punta" as Mineral, base: 28, multiplicador: 1, maxNivel: 1 },
    esperar: { moneda: "punta" as Mineral, base: 15, multiplicador: 1, maxNivel: 1 },
    si: { moneda: "racimo" as Mineral, base: 20, multiplicador: 1, maxNivel: 1 },
    sino: { moneda: "racimo" as Mineral, base: 30, multiplicador: 1, maxNivel: 1 },
    mientras: { moneda: "racimo" as Mineral, base: 40, multiplicador: 1, maxNivel: 1 },
    siempre: { moneda: "racimo" as Mineral, base: 60, multiplicador: 1, maxNivel: 1 },
  },

  /* --- revelado progresivo (MVP.md §8, PROGRESION.md §7) -------------
     Nunca una tienda llena de candados: cada categoría aparece cuando
     empieza a ser útil, y de a UNA. Se revela por ERA (lado de la isla),
     por lo cosechado en total (valor acumulado histórico, que gastar no
     baja) o por haber cosechado un mineral en particular.

     Con el campo arrancando en 1×1, más memoria no sirve para nada
     hasta que haya a dónde ir: la tierra va primero porque es la única
     compra que el chico puede entender sin haber jugado todavía. */
  revelado: {
    campo: {},
    capacidad: { lado: 2, acumulado: 6 },
    crecimiento: { acumulado: 20 },
    velocidad: { lado: 2, acumulado: 34 },
    repetir: { lado: 2, acumulado: 50 },
    /* Los bloques de control llegan cuando el campo ya creó la
       necesidad: `Esperar` con la 2×2; `Si` cuando ya hay cuarzo en el
       campo (que se rompe si no se mira); cada uno de los siguientes,
       después del anterior. */
    esperar: { lado: 2, acumulado: 12 },
    si: { lado: 2, cosechado: ["racimo", 1] as [Mineral, number] },
    sino: { requiere: "si" },
    mientras: { requiere: "si" },
    siempre: { requiere: "mientras" },
    evo_punta: { cosechado: ["punta", 12] as [Mineral, number] },
    evo_racimo: { cosechado: ["racimo", 5] as [Mineral, number] },
    evo_prisma: { cosechado: ["prisma", 4] as [Mineral, number] },
    evo_estrella: { cosechado: ["estrella", 3] as [Mineral, number] },
  } as Record<string, { lado?: number; acumulado?: number; cosechado?: [Mineral, number]; requiere?: string }>,
} as const;

export type ClaveMejora = keyof typeof AJUSTES.mejoras;

/** Precio del PRÓXIMO nivel de una mejora, o null si ya está al tope. */
export function precioMejora(clave: ClaveMejora, nivelActual: number): Costo | null {
  const m = AJUSTES.mejoras[clave];
  if (nivelActual >= m.maxNivel) return null;
  if ("precios" in m) return m.precios[nivelActual] ?? null;
  return { [m.moneda]: Math.round(m.base * Math.pow(m.multiplicador, nivelActual)) };
}
