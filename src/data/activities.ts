export type ActivityMode = "assisted" | "independent";
export type ActivityInputType =
  | "letter"
  | "word"
  | "phrase"
  | "symbol"
  | "correction"
  | "skill"
  | "shortcut";

/* The original 5 islands plus the 10 expansion islands (island6 … island15).
   Adding ids here is the single source of truth — progress, worlds map and
   the gameplay router all derive their world list from this union. */
export type WorldId =
  | "island1"
  | "island2"
  | "island3"
  | "island4"
  | "island5"
  | "island6"
  | "island7"
  | "island8"
  | "island9"
  | "island10"
  | "island11"
  | "island12"
  | "island13"
  | "island14"
  | "island15";

/* ── Guion de un nivel de atajos ────────────────────────────────────────
   Un nivel de atajos servía una lista de combos sueltos: "Ctrl+C" tres
   veces seguidas. Se apretaba la tecla correcta sin que pasara nada que se
   entendiera, y copiar nunca terminaba en pegar.

   Con `steps` el nivel pasa a ser UNA tarea contada paso a paso: cada paso
   dice qué hay que hacer y por qué, y el simulador conserva su estado entre
   pasos, así lo que seleccionás sigue pintado cuando copiás y lo que
   copiaste aparece cuando pegás.

   Es opcional: un nivel sin `steps` se sigue jugando como antes, que es lo
   que hacen las islas 12 y 14. */

/** El cartel concreto que se muestra en un paso de Enter/Escape. Sin esto
 *  todos los diálogos decían lo mismo, y aceptar o cancelar daba igual: la
 *  gracia es que Enter guarde algo que querés y Escape frene algo que no. */
export type ShortcutDialog = {
  /** Quién muestra el cartel: la app o la página. */
  app: string;
  /** Lo que pregunta el cartel. */
  question: string;
  /** Rótulo del botón que acepta. */
  accept: string;
  /** Rótulo del botón que cancela. */
  cancel: string;
  /** true cuando lo correcto es CANCELAR (descargas raras, premios falsos).
   *  Pinta el cartel como alerta en vez de como confirmación amable. */
  danger?: boolean;
  /** Qué pasó, según lo que se haya elegido. */
  resultAccept: string;
  resultCancel: string;
};

/** Un paso de la tarea: un atajo, más la consigna de ese momento. */
export type ShortcutStep = {
  /** El atajo, mismo formato que `targets` ("Ctrl+C", "Enter"…). */
  combo: string;
  /** Qué hacer ahora, en una línea y con motivo. Se muestra grande. */
  prompt: string;
  /** Sólo para pasos de Enter/Escape. */
  dialog?: ShortcutDialog;
  /** Dónde transcurre el paso. Normalmente se deduce del atajo, pero el
   *  atajo solo no siempre alcanza: Escape cierra un cartel o cierra el
   *  buscador según la tarea, y sin esto un "cerrá el buscador" terminaba
   *  mostrando un cartel de guardar que no venía a cuento. */
  env?: "text-editor" | "find-box" | "dialog" | "browser-tabs";
};

/** Qué clase de página es una pestaña del navegador simulado.
 *
 *  Existe por una razón concreta: todas las pestañas se dibujaban igual —
 *  el título arriba y "Contenido de la página" abajo —, así que cambiar de
 *  pestaña no se veía y abrir una más daba lo mismo. Cada tipo tiene su
 *  propia interfaz, con su ícono y sus colores, para que se note de un
 *  vistazo en cuál estás parado. */
export type ShortcutTabKind =
  | "nueva"        // la pestaña en blanco que abre Ctrl+T
  | "buscador"     // resultados de una búsqueda
  | "video"        // reproductor
  | "texto"        // tarea o documento
  | "diccionario"
  | "mapa"
  | "mensajes"     // chat o correo
  | "juego"
  | "anuncio"      // publicidad molesta: está para cerrarla
  | "clima"
  | "calculadora";

/** Una pestaña del navegador simulado. */
export type ShortcutTab = {
  /** Lo que dice la solapa. Corto: entra en pocos caracteres. */
  title: string;
  kind: ShortcutTabKind;
  /** Contenido de la página. Cada tipo lee las líneas a su manera:
   *    buscador     [0] lo buscado, [1…] títulos de resultados
   *    texto        [0] título,     [1…] renglones
   *    diccionario  [0] la palabra, [1] la definición
   *    mapa         [0] el lugar,   [1] el detalle
   *    mensajes     "Quién: qué dice", una por línea
   *    video        [0] título,     [1] duración
   *    juego        [0] nombre,     [1] detalle
   *    anuncio      [0] el título grande, [1] la letra chica
   *    clima        [0] temperatura, [1] detalle
   *    calculadora  [0] la cuenta
   *    nueva        no usa líneas */
  lines?: string[];
};

/** El contenido del simulador de un nivel, para que no sea siempre el mismo
 *  texto de ejemplo sino algo que el chico reconozca. */
export type ShortcutScene = {
  /** Lo que hay en la caja de origen. */
  source?: string;
  /** Rótulo de la caja de origen ("Nota de la seño"). */
  sourceLabel?: string;
  /** Rótulo de la caja de destino ("Tu cuaderno"). */
  targetLabel?: string;
  /** Nombre del archivo que se ve en la barra del editor. Con esto el
   *  simulador deja de ser "un editor" y pasa a ser EL informe que estás
   *  haciendo, que es lo que le da sentido a guardarlo. */
  docLabel?: string;
  /** Lo que ya está en el portapapeles al empezar el nivel. Sirve para los
   *  niveles que arrancan pegando: sin esto habría que copiar algo primero
   *  aunque el nivel no sea sobre copiar. */
  clipboard?: string;
  /** El texto de la página en los pasos de Ctrl+F. */
  page?: string;
  /** Lo que se busca ahí; se resalta al abrir el buscador. */
  find?: string;
  /** Con qué pestañas arranca el navegador simulado (isla 12). */
  tabs?: ShortcutTab[];
  /** En cuál está parado al empezar. 0 si no se dice. */
  activeTab?: number;
  /** Qué va apareciendo al abrir algo, EN ORDEN: cada Ctrl+T y cada Ctrl+N
   *  toman la siguiente de esta lista. Así abrir una pestaña lleva al lugar
   *  que pedía la consigna en vez de a una página vacía sin sentido. Si la
   *  lista se agota sale una pestaña nueva en blanco. */
  opens?: ShortcutTab[];
};

export interface Activity {
  id: string;
  worldId: WorldId;
  levelNumber: number;
  level: number;
  title: string;
  subtitle: string;
  instruction: string;
  listenText: string;
  targets: string[];
  mode: ActivityMode;
  type: ActivityInputType;
  inputType: ActivityInputType;
  difficulty: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  description: string;
  requiresShift?: boolean;
  requiresAccent?: boolean;
  /** Set when inputType === "skill" — points at an entry in digitalSkillsCatalog. */
  skillChallengeId?: string;
  /** Correction levels only: text prefilled WITH a mistake, parallel to `targets`.
   *  The student must Backspace the wrong part and type the correct text. */
  initialTexts?: string[];
  /** Correction levels only: per-objective task hint, parallel to `targets`. */
  correctionHints?: string[];

  /** Shortcut levels: la tarea contada paso a paso (ver ShortcutStep). Si
   *  está, manda sobre `targets` y el simulador no se reinicia entre pasos. */
  steps?: ShortcutStep[];
  /** Shortcut levels: qué texto y qué rótulos muestra el simulador. */
  scene?: ShortcutScene;
}

type ActivityDraft = Omit<Activity, "id" | "level" | "type" | "inputType" | "difficulty"> & {
  difficulty?: Activity["difficulty"];
  inputType?: ActivityInputType;
};

function makeActivity(draft: ActivityDraft & { inputType: ActivityInputType; difficulty: Activity["difficulty"] }): Activity {
  return {
    ...draft,
    id: `${draft.worldId}-l${draft.levelNumber}`,
    level: draft.levelNumber,
    type: draft.inputType,
  } as Activity;
}

const world1: Activity[] = [
  makeActivity({
    worldId: "island1",
    levelNumber: 1,
    title: "Mis primeras teclas",
    subtitle: "Conocé la fila central",
    instruction: "Presioná la letra que aparece.",
    listenText: "Buscá la letra que aparece en pantalla.",
    targets: ["A", "S", "D", "F", "J", "K", "L"],
    mode: "assisted",
    inputType: "letter",
    difficulty: 1,
    description: "Reconocé las teclas de la fila central del teclado.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 2,
    title: "Vocales mágicas",
    subtitle: "Ubicá cada vocal",
    instruction: "Presioná la vocal que aparece.",
    listenText: "Buscá la vocal que aparece en pantalla.",
    targets: ["A", "E", "I", "O", "U", "A", "I"],
    mode: "assisted",
    inputType: "letter",
    difficulty: 1,
    description: "Practicá las cinco vocales.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 3,
    title: "Fila de arriba",
    subtitle: "Q W E R T Y U I O P",
    instruction: "Presioná la letra de la fila de arriba.",
    listenText: "Buscá la letra de la fila superior.",
    targets: ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    mode: "assisted",
    inputType: "letter",
    difficulty: 2,
    description: "Conocé las letras de la fila superior.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 4,
    title: "Fila de abajo",
    subtitle: "Z X C V B N M",
    instruction: "Presioná la letra de la fila inferior.",
    listenText: "Buscá la letra de la fila inferior.",
    targets: ["Z", "X", "C", "V", "B", "N", "M"],
    mode: "assisted",
    inputType: "letter",
    difficulty: 2,
    description: "Practicá las letras de la fila inferior.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 5,
    title: "Mezcla de letras",
    subtitle: "Todo el abecedario",
    instruction: "Presioná la letra correcta sin ayuda visual.",
    listenText: "Presioná la letra correcta.",
    targets: ["G", "H", "P", "B", "N", "F", "T", "L", "M", "R"],
    mode: "independent",
    inputType: "letter",
    difficulty: 3,
    description: "Reconocé letras de todo el teclado.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 6,
    title: "Letra veloz",
    subtitle: "Reto final de letras",
    instruction: "Presioná rápido cada letra que aparece.",
    listenText: "Presioná rápido cada letra que aparece.",
    targets: ["F", "J", "D", "K", "S", "L", "A", "Ñ", "G", "H", "R", "U"],
    mode: "independent",
    inputType: "letter",
    difficulty: 3,
    description: "Cerrá el mundo 1 con velocidad y precisión.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 7,
    title: "Lluvia de letras",
    subtitle: "Reto relámpago del bosque",
    instruction: "Presioná cada letra que cae antes de que se apague.",
    listenText: "Presioná rápido cada letra que aparece en pantalla.",
    targets: ["E", "T", "O", "N", "C", "I", "M", "A", "P", "V", "S", "Ñ"],
    mode: "independent",
    inputType: "letter",
    difficulty: 3,
    description: "Atrapá la lluvia de letras del bosque con velocidad y precisión.",
  }),
];

const world2: Activity[] = [
  makeActivity({
    worldId: "island2",
    levelNumber: 1,
    title: "Palabras cortas",
    subtitle: "Escribí con precisión",
    instruction: "Escribí la palabra que aparece.",
    listenText: "Escribí la palabra que aparece en pantalla.",
    targets: ["mesa", "dedo", "mano", "gota", "pelo"],
    mode: "assisted",
    inputType: "word",
    difficulty: 2,
    description: "Escribí palabras simples completas.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 2,
    title: "Cosas del cielo",
    subtitle: "Palabras lindas",
    instruction: "Escribí la palabra completa.",
    listenText: "Escribí la palabra completa.",
    targets: ["luna", "nube", "lago", "rosa", "casa"],
    mode: "assisted",
    inputType: "word",
    difficulty: 2,
    description: "Practicá palabras cortas del cielo.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 3,
    title: "Mi mundo",
    subtitle: "Palabras nuevas",
    instruction: "Escribí la palabra que ves.",
    listenText: "Escribí la palabra que ves.",
    targets: ["tecla", "amigo", "verde", "fruta", "libro"],
    mode: "independent",
    inputType: "word",
    difficulty: 3,
    description: "Escribí palabras un poco más largas.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 4,
    title: "Animales",
    subtitle: "Nombres de animales",
    instruction: "Escribí el nombre del animal.",
    listenText: "Escribí el nombre del animal.",
    targets: ["gato", "perro", "conejo", "caballo", "tortuga"],
    mode: "independent",
    inputType: "word",
    difficulty: 3,
    description: "Practicá nombres de animales conocidos.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 5,
    title: "Dos palabras",
    subtitle: "Usá el espacio",
    instruction: "Escribí las dos palabras separadas por un espacio.",
    listenText: "Escribí las dos palabras separadas por un espacio.",
    targets: ["mi casa", "sol grande", "tecla feliz", "nube blanca"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 4,
    description: "Aprendé a usar la barra espaciadora.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 6,
    title: "Borro y corrijo",
    subtitle: "Usá retroceso",
    instruction: "Borrá el error con Backspace y dejá la palabra correcta.",
    listenText: "Borrá el error con retroceso y dejá la palabra correcta.",
    /* Each word has a DIFFERENT kind of mistake so the correction is varied
       and meaningful: extra letter, missing letter, swapped letters, wrong
       vowel, duplicated letter. No accents/punctuation (not taught yet). */
    targets: ["escuela", "estrella", "tablero", "ventana", "mochila"],
    initialTexts: ["escela", "estrellla", "tabelro", "ventona", "moochila"],
    correctionHints: [
      "A «escela» le falta una letra: corregí hasta «escuela».",
      "En «estrellla» sobra una L: corregí hasta «estrella».",
      "En «tabelro» hay dos letras cambiadas de lugar: corregí hasta «tablero».",
      "En «ventona» hay una vocal equivocada: corregí hasta «ventana».",
      "En «moochila» sobra una O: corregí hasta «mochila».",
    ],
    mode: "independent",
    inputType: "correction",
    difficulty: 4,
    description: "Corregí cada palabra con Backspace: el error es distinto en cada una.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 7,
    title: "Reto de palabras",
    subtitle: "Todo lo aprendido",
    instruction: "Escribí la frase completa.",
    listenText: "Escribí la frase completa.",
    /* Cierre de la isla, un escalón sobre "Dos palabras": tres palabras en vez
       de dos, con el vocabulario que ya practicó en los niveles anteriores.
       Sin tildes ni mayúsculas, que se enseñan recién en la isla 3. */
    targets: ["el gato duerme", "mi libro verde", "la luna brilla", "una fruta rica", "el perro corre"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Cerrá la isla escribiendo frases de tres palabras.",
  }),
];

const world3: Activity[] = [
  makeActivity({
    worldId: "island3",
    levelNumber: 1,
    title: "Mayúsculas mágicas",
    subtitle: "Con Shift",
    instruction: "Escribí cada palabra con la primera letra en mayúscula.",
    listenText: "Escribí cada palabra con mayúscula inicial.",
    targets: ["Sofia", "Lucas", "Maria", "Pedro", "Lima"],
    mode: "assisted",
    inputType: "word",
    difficulty: 3,
    description: "Usá Shift para escribir nombres propios.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island3",
    levelNumber: 2,
    title: "La ñ especial",
    subtitle: "Letra del español",
    instruction: "Escribí la palabra con la letra ñ.",
    listenText: "Escribí palabras con ñ.",
    targets: ["niño", "año", "piña", "caña", "España"],
    mode: "assisted",
    inputType: "word",
    difficulty: 4,
    description: "Practicá la letra ñ del español.",
  }),
  makeActivity({
    worldId: "island3",
    levelNumber: 3,
    title: "Acentos suaves",
    subtitle: "Tildes en palabras",
    instruction: "Escribí la palabra con su tilde.",
    listenText: "Escribí cada palabra con su tilde.",
    /* Arranca con palabras cortas y termina con dos largas: son las que
       traía el viejo nivel 4 ("Palabras con tilde"), que practicaba esta
       misma destreza en un nivel aparte. Al pasar la isla a seis niveles se
       fusionó acá en vez de perderse. */
    targets: ["mamá", "papá", "café", "lápiz", "árbol", "camión", "música"],
    mode: "independent",
    inputType: "word",
    difficulty: 4,
    description: "Aprendé a escribir tildes, de palabras cortas a largas.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island3",
    levelNumber: 4,
    title: "¿Preguntas?",
    subtitle: "Signos ¿ y ?",
    instruction: "Escribí la pregunta completa con sus signos.",
    listenText: "Escribí la pregunta completa con sus signos.",
    targets: ["¿Dónde?", "¿Quién?", "¿Cómo estás?", "¿Qué día es?"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Practicá los signos de pregunta.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island3",
    levelNumber: 5,
    title: "¡Exclamaciones!",
    subtitle: "Signos ¡ y !",
    instruction: "Escribí la frase con signos de exclamación.",
    listenText: "Escribí la frase con signos de exclamación.",
    targets: ["¡Hola!", "¡Vamos!", "¡Qué lindo!", "¡Buen día, Sofía!"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Practicá los signos de exclamación.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island3",
    levelNumber: 6,
    title: "Gran dictado",
    subtitle: "Tildes y signos juntos",
    instruction: "Escribí cada frase con sus tildes y signos correctos.",
    listenText: "Escribí cada frase con sus tildes y signos, tal como aparece.",
    targets: ["¿Cómo estás, Martín?", "¡Qué día tan mágico!", "Mi pingüino lee rápido."],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Repaso final de la biblioteca: tildes, ñ y signos del español juntos.",
    requiresAccent: true,
    requiresShift: true,
  }),
];

const world4: Activity[] = [
  makeActivity({
    worldId: "island4",
    levelNumber: 1,
    title: "Puntos y comas",
    subtitle: "Signos básicos",
    instruction: "Escribí el signo que aparece.",
    listenText: "Escribí cada signo de puntuación.",
    targets: [".", ",", ";", ":", "-", "_"],
    mode: "assisted",
    inputType: "symbol",
    difficulty: 4,
    description: "Reconocé los signos de puntuación.",
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 2,
    title: "Arroba y punto",
    subtitle: "Para correos",
    instruction: "Escribí los símbolos especiales.",
    listenText: "Escribí los símbolos especiales.",
    targets: ["@", ".", "@", "-", "_", "."],
    mode: "assisted",
    inputType: "symbol",
    difficulty: 5,
    description: "Aprendé el arroba y el punto.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 3,
    title: "Mi primer correo",
    subtitle: "Dirección de email",
    instruction: "Escribí la dirección de correo completa.",
    listenText: "Escribí la dirección de correo completa.",
    targets: ["sofia@edutic.com", "lucas@edutic.com", "info@edutic.com"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Practicá escribir un correo electrónico.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 4,
    title: "Frases con coma",
    subtitle: "Punto y coma",
    instruction: "Escribí la frase respetando puntos y comas.",
    listenText: "Escribí la frase respetando puntos y comas.",
    targets: ["Hola, Sofía.", "Vamos, ya es hora.", "Sí, claro."],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Frases reales con puntuación.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 5,
    title: "Preguntas reales",
    subtitle: "Frases con ¿?",
    instruction: "Escribí la pregunta completa.",
    listenText: "Escribí la pregunta completa.",
    targets: ["¿Listo, Lucas?", "¿Vamos al parque?", "¿Cómo se llama tu mascota?"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Combiná tildes, signos y puntuación.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 6,
    title: "Reto final",
    subtitle: "Todo junto",
    instruction: "Escribí cada frase exactamente como aparece.",
    listenText: "Escribí cada frase tal como aparece.",
    targets: [
      "¡Hola, mundo!",
      "Mi correo es sofia@edutic.com.",
      "¿Estás listo? ¡Vamos!",
      "Año 2026: ¡a escribir!",
    ],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Reto final con todos los signos del español.",
    requiresAccent: true,
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 7,
    title: "Código experto",
    subtitle: "El reto más difícil",
    instruction: "Escribí la línea completa, con todos sus signos.",
    listenText: "Escribí la línea completa, con todos sus signos.",
    /* Un escalón sobre "Reto final": cada línea combina VARIOS signos a la vez
       (pregunta + exclamación + arroba + dos puntos), en vez de uno o dos. */
    targets: [
      "¿Tu correo es ana@edutic.com?",
      "¡Atención! Clave: 2026-ABC.",
      "Escribí a lucas@escuela.edu.ar, por favor.",
      "¿Listo? ¡Enviá el mensaje ahora!",
    ],
    mode: "independent",
    inputType: "phrase",
    difficulty: 7,
    description: "Combiná varios signos en una misma línea.",
  }),
];

/* =====================================================================
   World 5 — Isla digital: 7 levels covering mouse / touchpad / shortcuts.
   Each level is an Activity with `inputType: "skill"` and a link to the
   matching entry in `digitalSkillsCatalog` (src/data/digitalSkills.ts).
   The GameplayPage renders these through the SkillChallengeShell instead
   of the typing keyboard pipeline.
===================================================================== */
/* The order and content of each entry below mirrors exactly what
   SkillLevelView renders for the same levelNumber, so the level chip on
   the world map, the spoken consigna and the on-screen UI all describe
   the same mechanic. */
const world5: Activity[] = [
  makeActivity({
    worldId: "island5",
    levelNumber: 1,
    title: "Clic izquierdo",
    subtitle: "Tu primer gesto con el mouse",
    instruction: "Hacé clic sobre los 5 objetos que brillan.",
    listenText: "Hacé un clic con el botón izquierdo del mouse en cada dibujo.",
    targets: ["click:primary"],
    mode: "assisted",
    inputType: "skill",
    difficulty: 1,
    description: "Aprendé a hacer clic con el botón principal del mouse sobre cada objeto.",
    skillChallengeId: "ds-click-1",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 2,
    title: "Clic derecho",
    subtitle: "Menús secretos",
    instruction: "Hacé clic derecho sobre el objeto que te indica la consigna.",
    listenText: "Hacé clic con el botón derecho del mouse para abrir el menú secreto.",
    targets: ["click:secondary"],
    mode: "assisted",
    inputType: "skill",
    difficulty: 2,
    description: "Descubrí los menús que esconde el clic derecho sobre cofres, mochilas y pociones.",
    skillChallengeId: "ds-click-2",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 3,
    title: "Arrastrar y soltar",
    subtitle: "Drag & drop",
    instruction: "Arrastrá cada objeto y soltalo en la silueta que coincide.",
    listenText: "Mantené apretado el botón izquierdo y movelo hasta el destino correcto.",
    targets: ["drag:item"],
    mode: "independent",
    inputType: "skill",
    difficulty: 3,
    description: "Practicá arrastrar y soltar — los destinos están mezclados.",
    skillChallengeId: "ds-drag-1",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 4,
    title: "Ventanas y pestañas",
    subtitle: "Sistema virtual",
    instruction: "Abrí y cerrá ventanas y pestañas según las tareas.",
    listenText: "Cerrá las ventanas y pestañas que te pide la tarea.",
    targets: ["window:close", "tab:open", "tab:close"],
    mode: "independent",
    inputType: "skill",
    difficulty: 3,
    description: "Aprendé a manejar ventanas y pestañas del escritorio.",
    skillChallengeId: "ds-tab-3",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 5,
    title: "Scroll y zoom",
    subtitle: "Rueda del mouse",
    instruction: "Desplazate por la imagen del castillo y después acercá y alejá el zoom.",
    listenText: "Usá la rueda del mouse para subir y bajar, y los botones más y menos para hacer zoom.",
    targets: ["scroll:page", "zoom:in", "zoom:out"],
    mode: "independent",
    inputType: "skill",
    difficulty: 3,
    description: "Hacé scroll para revelar la imagen y practicá zoom in y zoom out.",
    skillChallengeId: "ds-scroll-1",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 6,
    title: "Doble clic",
    subtitle: "Abrir carpetas",
    instruction: "Hacé doble clic rápido sobre cada carpeta para abrirla.",
    listenText: "Dos clics seguidos sobre la carpeta y se abre.",
    targets: ["click:double"],
    mode: "assisted",
    inputType: "skill",
    difficulty: 2,
    description: "Diferenciá el clic simple del doble clic para abrir carpetas mágicas.",
    skillChallengeId: "ds-click-3",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 7,
    title: "Copiar y pegar",
    subtitle: "Ctrl + C / Ctrl + V",
    instruction: "Seleccioná el mensaje de arriba, copialo con Ctrl + C y pegalo abajo con Ctrl + V.",
    listenText: "Seleccioná el texto, copialo con Control C y pegalo con Control V.",
    targets: ["shortcut:Ctrl+C", "shortcut:Ctrl+V"],
    mode: "independent",
    inputType: "skill",
    difficulty: 4,
    description: "Reto final: copiá un mensaje y pegalo en la caja de abajo.",
    skillChallengeId: "ds-shortcut-ctrlc",
  }),
];

/* =====================================================================
   EXPANSION — 10 new islands (island6 … island15).
   These reuse the existing engines:
     • typing keyboard engine  → inputType letter/word/phrase/symbol/correction
     • keyboard-shortcut engine → inputType "shortcut" (targets are key combos
       like "Ctrl+C", "Alt+Tab" — see ShortcutLevelView.tsx)
   No engine is duplicated; only data is added here. Difficulty climbs across
   worlds, and advanced uppercase / reserved combos are introduced late.
===================================================================== */

/* World 6 — Isla de la escritura (World 2 in the journey): SYLLABLES first,
   not whole words. Two-letter syllables → three-letter syllables, and only the
   last two levels introduce a few short real words. This keeps it clearly
   different from World 1 (which practises single letters). */
const world6: Activity[] = [
  makeActivity({
    worldId: "island6",
    levelNumber: 1,
    title: "Sílabas mágicas",
    subtitle: "Empezamos a unir letras",
    instruction: "Escribí la sílaba que aparece.",
    listenText: "Escribí la sílaba que ves en pantalla.",
    targets: ["ma", "me", "mi", "mo", "mu", "sa"],
    mode: "assisted",
    inputType: "word",
    difficulty: 1,
    description: "Uní dos letras para formar tus primeras sílabas.",
  }),
  makeActivity({
    worldId: "island6",
    levelNumber: 2,
    title: "Sílabas que suenan",
    subtitle: "Nuevos sonidos",
    instruction: "Escribí la sílaba que aparece.",
    listenText: "Escribí la sílaba que ves en pantalla.",
    targets: ["lo", "pe", "tu", "fi", "ca", "de"],
    mode: "assisted",
    inputType: "word",
    difficulty: 1,
    description: "Practicá más sílabas de dos letras.",
  }),
  makeActivity({
    worldId: "island6",
    levelNumber: 3,
    title: "Sílabas largas",
    subtitle: "Sílabas un poco más largas",
    instruction: "Escribí la sílaba de tres letras.",
    listenText: "Escribí la sílaba de tres letras.",
    targets: ["tra", "pre", "blo", "cli", "gru", "fla"],
    mode: "assisted",
    inputType: "word",
    difficulty: 2,
    description: "Uní tres letras en una sola sílaba.",
  }),
  makeActivity({
    worldId: "island6",
    levelNumber: 4,
    title: "Sílabas veloces",
    subtitle: "Practicá sin mirar",
    instruction: "Escribí la sílaba que aparece.",
    listenText: "Escribí la sílaba que aparece.",
    targets: ["dra", "ple", "tri", "cro", "gla", "bru"],
    mode: "independent",
    inputType: "word",
    difficulty: 2,
    description: "Ganá ritmo con sílabas de tres letras.",
  }),
  makeActivity({
    worldId: "island6",
    levelNumber: 5,
    title: "Uní las sílabas",
    subtitle: "Sonidos seguidos",
    instruction: "Escribí la sílaba que aparece.",
    listenText: "Escribí la sílaba que aparece.",
    targets: ["pla", "tre", "pri", "clo", "fle", "gro"],
    mode: "independent",
    inputType: "word",
    difficulty: 2,
    description: "Más sílabas para soltar los dedos.",
  }),
  makeActivity({
    worldId: "island6",
    levelNumber: 6,
    title: "Primeras palabras",
    subtitle: "Palabras cortitas",
    instruction: "Escribí la palabra completa.",
    listenText: "Escribí la palabra completa.",
    targets: ["sol", "pan", "mar", "luz", "pez"],
    mode: "independent",
    inputType: "word",
    difficulty: 2,
    description: "Ahora sí: unas pocas palabras cortas.",
  }),
  makeActivity({
    worldId: "island6",
    levelNumber: 7,
    title: "Palabras veloces",
    subtitle: "Reto de la isla",
    instruction: "Escribí rápido cada palabra que aparece.",
    listenText: "Escribí rápido cada palabra que aparece.",
    targets: ["casa", "gato", "mesa", "nube"],
    mode: "independent",
    inputType: "word",
    difficulty: 3,
    description: "Cerrá la isla con unas palabras cortas y veloces.",
  }),
];

/* World 7 — Isla de las palabras largas. */
const world7: Activity[] = [
  makeActivity({
    worldId: "island7",
    levelNumber: 1,
    title: "Palabras más largas",
    subtitle: "Escribí con precisión",
    instruction: "Escribí la palabra completa.",
    listenText: "Escribí la palabra completa.",
    targets: ["ventana", "planeta", "camino", "bosque", "puente"],
    mode: "assisted",
    inputType: "word",
    difficulty: 3,
    description: "Animate con palabras de seis letras.",
  }),
  makeActivity({
    worldId: "island7",
    levelNumber: 2,
    title: "Animales del mundo",
    subtitle: "Palabras largas",
    instruction: "Escribí el nombre del animal.",
    listenText: "Escribí el nombre del animal.",
    targets: ["caballo", "tortuga", "delfin", "conejo", "ardilla"],
    mode: "assisted",
    inputType: "word",
    difficulty: 3,
    description: "Practicá nombres de animales conocidos.",
  }),
  makeActivity({
    worldId: "island7",
    levelNumber: 3,
    title: "Palabras gigantes",
    subtitle: "Sin apurarte",
    instruction: "Escribí la palabra larga sin apurarte.",
    listenText: "Escribí la palabra larga sin apurarte.",
    targets: ["mariposa", "elefante", "biblioteca", "computadora"],
    mode: "independent",
    inputType: "word",
    difficulty: 4,
    description: "Tomate tu tiempo con palabras muy largas.",
  }),
  makeActivity({
    worldId: "island7",
    levelNumber: 4,
    title: "Frases de dos",
    subtitle: "Con espacio",
    instruction: "Escribí la frase completa.",
    listenText: "Escribí la frase completa.",
    targets: ["mar tranquilo", "cielo estrellado", "bosque verde"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 4,
    description: "Combiná dos palabras largas en una frase.",
  }),
  makeActivity({
    worldId: "island7",
    levelNumber: 5,
    title: "Frases de tres",
    subtitle: "Más espacios",
    instruction: "Escribí la frase con todos sus espacios.",
    listenText: "Escribí la frase con todos sus espacios.",
    targets: ["el gato salta", "mi casa es linda", "vamos a jugar"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Escribí frases de tres palabras.",
  }),
  makeActivity({
    worldId: "island7",
    levelNumber: 6,
    title: "Reto de frases",
    subtitle: "Velocidad y precisión",
    instruction: "Escribí cada frase tal como aparece.",
    listenText: "Escribí cada frase tal como aparece.",
    targets: ["hoy es un gran dia", "me gusta aprender", "puedo escribir bien"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Cerrá la isla escribiendo frases completas.",
  }),
  makeActivity({
    worldId: "island7",
    levelNumber: 7,
    title: "Frases largas",
    subtitle: "El reto más difícil",
    instruction: "Escribí la frase completa.",
    listenText: "Escribí la frase completa.",
    /* Un escalón sobre "Reto de frases": cinco palabras en vez de cuatro.
       Sigue sin tildes ni mayúsculas, igual que el resto de la isla. */
    targets: [
      "me gusta leer libros nuevos",
      "vamos a jugar en el parque",
      "el elefante camina muy despacio",
      "hoy puedo escribir mucho mejor",
    ],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Cerrá la isla con las frases más largas.",
  }),
];

/* World 8 — Isla de los signos: puntuación y símbolos progresivos. */
const world8: Activity[] = [
  makeActivity({
    worldId: "island8",
    levelNumber: 1,
    title: "Punto y coma",
    subtitle: "Signos básicos",
    instruction: "Escribí el signo que aparece.",
    listenText: "Escribí cada signo que aparece.",
    targets: [".", ",", ".", ",", "."],
    mode: "assisted",
    inputType: "symbol",
    difficulty: 2,
    description: "Conocé el punto y la coma.",
  }),
  makeActivity({
    worldId: "island8",
    levelNumber: 2,
    title: "Dos puntos",
    subtitle: ": y ;",
    instruction: "Escribí el signo que aparece.",
    listenText: "Escribí cada signo que aparece.",
    targets: [":", ";", ":", ";", "-"],
    mode: "assisted",
    inputType: "symbol",
    difficulty: 3,
    description: "Practicá los dos puntos y el punto y coma.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island8",
    levelNumber: 3,
    title: "Preguntas",
    subtitle: "¿ y ?",
    instruction: "Escribí la pregunta completa con sus signos.",
    listenText: "Escribí la pregunta completa con sus signos.",
    targets: ["¿Hola?", "¿Quién?", "¿Cómo estás?", "¿Qué hora es?"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 4,
    description: "Usá los signos de pregunta del español.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island8",
    levelNumber: 4,
    title: "Exclamaciones",
    subtitle: "¡ y !",
    instruction: "Escribí la frase con signos de exclamación.",
    listenText: "Escribí la frase con signos de exclamación.",
    targets: ["¡Hola!", "¡Genial!", "¡Qué lindo!", "¡Vamos ya!"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 4,
    description: "Practicá los signos de exclamación.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island8",
    levelNumber: 5,
    title: "Comillas y guiones",
    subtitle: "\" y -",
    instruction: "Escribí lo que ves con sus signos.",
    listenText: "Escribí lo que ves con sus signos.",
    targets: ["\"sol\"", "alto-bajo", "\"hola\"", "rojo-azul"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Usá comillas y guiones.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island8",
    levelNumber: 6,
    title: "Paréntesis",
    subtitle: "( y )",
    instruction: "Escribí lo que aparece entre paréntesis.",
    listenText: "Escribí lo que aparece entre paréntesis.",
    targets: ["(sol)", "(luna)", "(uno)", "(final)"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Aprendé a usar los paréntesis.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island8",
    levelNumber: 7,
    title: "Reto de signos",
    subtitle: "Todo junto",
    instruction: "Escribí cada frase con todos sus signos.",
    listenText: "Escribí cada frase con todos sus signos.",
    targets: ["¿Listo? ¡Sí!", "Hola, ¿cómo estás?", "¡Qué bien (todo)!"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Cerrá la isla combinando todos los signos.",
    requiresAccent: true,
    requiresShift: true,
  }),
];

/* World 9 — Isla de los correos. */
const world9: Activity[] = [
  makeActivity({
    worldId: "island9",
    levelNumber: 1,
    title: "Mi nombre",
    subtitle: "Escribir nombres",
    instruction: "Escribí el nombre que aparece.",
    listenText: "Escribí el nombre que aparece.",
    targets: ["sofia", "lucas", "maria", "pedro", "valentina"],
    mode: "assisted",
    inputType: "word",
    difficulty: 2,
    description: "Practicá escribir nombres de personas.",
  }),
  makeActivity({
    worldId: "island9",
    levelNumber: 2,
    title: "El arroba",
    subtitle: "La tecla @",
    instruction: "Escribí el símbolo que aparece.",
    listenText: "Escribí el símbolo que aparece.",
    targets: ["@", ".", "@", ".", "@"],
    mode: "assisted",
    inputType: "symbol",
    difficulty: 3,
    description: "Conocé el arroba y el punto de los correos.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island9",
    levelNumber: 3,
    title: "Usuario y arroba",
    subtitle: "nombre@",
    instruction: "Escribí el comienzo del correo.",
    listenText: "Escribí el comienzo del correo.",
    targets: ["sofia@", "lucas@", "info@", "hola@"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 3,
    description: "Uní el nombre con el arroba.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island9",
    levelNumber: 4,
    title: "Dominios",
    subtitle: ".com y más",
    instruction: "Escribí el final del correo.",
    listenText: "Escribí el final del correo.",
    targets: ["gmail.com", "edu.ar", "correo.com", "escuela.edu"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 4,
    description: "Practicá los finales como punto com.",
  }),
  makeActivity({
    worldId: "island9",
    levelNumber: 5,
    title: "Correo completo",
    subtitle: "Dirección entera",
    instruction: "Escribí la dirección de correo completa.",
    listenText: "Escribí la dirección de correo completa.",
    targets: ["sofia@gmail.com", "lucas@edu.ar", "info@escuela.com"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Escribí un correo electrónico completo.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island9",
    levelNumber: 6,
    title: "Asunto del mensaje",
    subtitle: "Título corto",
    instruction: "Escribí el asunto del correo.",
    listenText: "Escribí el asunto del correo.",
    targets: ["Hola amigo", "Mi tarea", "Buenos dias", "Nos vemos"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Practicá escribir asuntos cortos.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island9",
    levelNumber: 7,
    title: "Mensaje amigable",
    subtitle: "Reto final",
    instruction: "Escribí el mensaje completo tal como aparece.",
    listenText: "Escribí el mensaje completo tal como aparece.",
    targets: ["Hola, ¿cómo estás?", "Te escribo a sofia@gmail.com", "¡Gracias por todo!"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Cerrá la isla escribiendo un mensaje real.",
    requiresAccent: true,
    requiresShift: true,
  }),
];

/* World 10 — Isla de las búsquedas: escribir búsquedas y apretar Enter. */
const world10: Activity[] = [
  makeActivity({
    worldId: "island10",
    levelNumber: 1,
    title: "Una palabra",
    subtitle: "Buscar algo simple",
    instruction: "Escribí lo que querés buscar y apretá Enter.",
    listenText: "Escribí una palabra para buscar y apretá Enter.",
    targets: ["perros", "gatos", "estrellas", "dinosaurios"],
    mode: "assisted",
    inputType: "word",
    difficulty: 2,
    description: "Escribí una palabra clave para buscar.",
  }),
  makeActivity({
    worldId: "island10",
    levelNumber: 2,
    title: "Palabras clave",
    subtitle: "Dos palabras",
    instruction: "Escribí la búsqueda y apretá Enter.",
    listenText: "Escribí la búsqueda y apretá Enter.",
    targets: ["perros bebes", "juegos divertidos", "dibujos faciles"],
    mode: "assisted",
    inputType: "phrase",
    difficulty: 3,
    description: "Usá dos palabras clave para buscar mejor.",
  }),
  makeActivity({
    worldId: "island10",
    levelNumber: 3,
    title: "Preguntas al buscador",
    subtitle: "Buscar dudas",
    instruction: "Escribí la pregunta y apretá Enter.",
    listenText: "Escribí la pregunta y apretá Enter.",
    targets: ["como dibujar un gato", "donde vive el pinguino"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 4,
    description: "Hacé preguntas reales al buscador.",
  }),
  makeActivity({
    worldId: "island10",
    levelNumber: 4,
    title: "Corregir la búsqueda",
    subtitle: "Usá Backspace",
    instruction: "Borrá la letra equivocada con Backspace y escribí la correcta.",
    listenText: "Borrá la letra equivocada con retroceso y escribí la correcta.",
    targets: ["recetas faciles", "cuentos cortos", "musica para bailar"],
    initialTexts: ["recetaz", "cuentoz", "musika"],
    correctionHints: [
      "Borrá la Z y escribí S; después completá «recetas faciles».",
      "Borrá la Z y escribí S; después completá «cuentos cortos».",
      "Borrá la K y escribí C; después completá «musica para bailar».",
    ],
    mode: "independent",
    inputType: "correction",
    difficulty: 4,
    description: "Corregí tu búsqueda mientras escribís.",
  }),
  makeActivity({
    worldId: "island10",
    levelNumber: 5,
    title: "Página o búsqueda",
    subtitle: "Sitios web",
    instruction: "Escribí la dirección de la página.",
    listenText: "Escribí la dirección de la página.",
    targets: ["www.google.com", "www.escuela.edu", "www.juegos.com"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Diferenciá una búsqueda de una dirección web.",
  }),
  makeActivity({
    worldId: "island10",
    levelNumber: 6,
    title: "Buscador experto",
    subtitle: "Reto final",
    instruction: "Escribí la búsqueda completa y apretá Enter.",
    listenText: "Escribí la búsqueda completa y apretá Enter.",
    targets: ["animales del oceano", "como cuidar una planta", "juegos de mesa para niños"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Cerrá la isla buscando como un experto.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island10",
    levelNumber: 7,
    title: "Búsqueda experta",
    subtitle: "El reto más difícil",
    instruction: "Escribí la búsqueda completa.",
    listenText: "Escribí la búsqueda completa.",
    /* Un escalón sobre "Buscador experto": preguntas más largas, y una
       dirección web mezclada para alternar entre buscar y navegar. */
    targets: [
      "cuantos planetas tiene el sistema solar",
      "www.biblioteca.escuela.edu.ar",
      "como se llaman las nubes mas altas",
      "juegos para aprender a escribir rapido",
    ],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Buscá con preguntas largas y escribí direcciones web.",
  }),
];

/* World 11 — Isla de los comandos: atajos básicos (engine de atajos). */
const world11: Activity[] = [
  makeActivity({
    worldId: "island11",
    levelNumber: 1,
    title: "Aceptar o cancelar",
    subtitle: "Enter dice que sí, Escape dice que no",
    instruction: "Leé cada cartel y decidí: ¿lo aceptás o lo cancelás?",
    listenText: "Leé el cartel. Si es algo que querés, aceptá con Enter. Si es algo raro, cancelá con Escape.",
    targets: ["Enter", "Escape", "Enter", "Escape"],
    /* Cuatro carteles distintos, dos para aceptar y dos para cancelar. La
       tecla sola no enseña nada: lo que se practica acá es mirar QUÉ pide el
       cartel antes de contestar. */
    steps: [
      {
        combo: "Enter",
        prompt: "Terminaste tu dibujo y te pregunta si lo guardás. Aceptá con Enter.",
        dialog: {
          app: "Dibujo mágico",
          question: "¿Guardar los cambios de tu dibujo?",
          accept: "Guardar",
          cancel: "No guardar",
          resultAccept: "Tu dibujo quedó guardado.",
          resultCancel: "Se perdieron los cambios del dibujo.",
        },
      },
      {
        combo: "Escape",
        prompt: "¡Ojo! Vos no pediste esa descarga. Cancelala con Escape.",
        dialog: {
          app: "juegos-gratis-ya.com",
          question: "Esta página quiere descargar «super-juego.exe». Vos no lo pediste.",
          accept: "Descargar",
          cancel: "Cancelar",
          danger: true,
          resultAccept: "Se descargó un archivo que no pediste. Mejor cancelarlo.",
          resultCancel: "Frenaste la descarga. ¡Bien ahí!",
        },
      },
      {
        combo: "Enter",
        prompt: "La tarea está lista para enviar. Aceptá con Enter.",
        dialog: {
          app: "Aula virtual",
          question: "¿Enviar tu tarea a la maestra?",
          accept: "Enviar",
          cancel: "Todavía no",
          resultAccept: "Tu tarea llegó a la maestra.",
          resultCancel: "La tarea quedó sin enviar.",
        },
      },
      {
        combo: "Escape",
        prompt: "Nadie regala premios por sorpresa. Cerrá el cartel con Escape.",
        dialog: {
          app: "premio-sorpresa.net",
          question: "«¡Ganaste un celular! Escribí tu dirección para recibirlo.»",
          accept: "Escribir mi dirección",
          cancel: "Cerrar",
          danger: true,
          resultAccept: "Le diste tus datos a una página desconocida.",
          resultCancel: "Cerraste la trampa sin dar ningún dato.",
        },
      },
    ],
    mode: "assisted",
    inputType: "shortcut",
    difficulty: 1,
    description: "Enter acepta lo que querés; Escape frena lo que no pediste.",
  }),
  makeActivity({
    worldId: "island11",
    levelNumber: 2,
    title: "Seleccionar y copiar",
    subtitle: "Ctrl + A y después Ctrl + C",
    instruction: "Copiá la nota de la maestra para no perderla.",
    listenText: "Primero seleccioná toda la nota con Control y A. Después copiala con Control y C.",
    targets: ["Ctrl+A", "Ctrl+C"],
    scene: {
      sourceLabel: "Nota de la maestra",
      source: "Mañana traer el cuaderno rojo y una regla.",
      targetLabel: "Tu cuaderno digital",
    },
    steps: [
      { combo: "Ctrl+A", prompt: "Seleccioná toda la nota con Ctrl + A. Vas a ver cómo se pinta." },
      { combo: "Ctrl+C", prompt: "Ahora copiala con Ctrl + C. Se guarda en el portapapeles, mirá abajo." },
    ],
    mode: "assisted",
    inputType: "shortcut",
    difficulty: 2,
    description: "Para copiar algo, primero hay que seleccionarlo.",
  }),
  makeActivity({
    worldId: "island11",
    levelNumber: 3,
    title: "Copiar y pegar",
    subtitle: "Ctrl + A, Ctrl + C y Ctrl + V",
    instruction: "Pasá la lista de útiles a tu cuaderno, sin escribirla de nuevo.",
    listenText: "Seleccioná la lista, copiala y después pegala en tu cuaderno.",
    targets: ["Ctrl+A", "Ctrl+C", "Ctrl+V"],
    scene: {
      sourceLabel: "Lista de útiles",
      source: "Cartuchera, tijera, plasticola y hojas de colores.",
      targetLabel: "Tu cuaderno digital",
    },
    steps: [
      { combo: "Ctrl+A", prompt: "Seleccioná toda la lista con Ctrl + A." },
      { combo: "Ctrl+C", prompt: "Copiala con Ctrl + C." },
      { combo: "Ctrl+V", prompt: "Pegala en tu cuaderno con Ctrl + V. Ahí vas a ver aparecer la lista." },
    ],
    mode: "assisted",
    inputType: "shortcut",
    difficulty: 3,
    description: "Copiar sin pegar no sirve de nada: el par completo es Ctrl + C y Ctrl + V.",
  }),
  makeActivity({
    worldId: "island11",
    levelNumber: 4,
    title: "Deshacer un error",
    subtitle: "Ctrl + Z borra lo último",
    instruction: "Pegaste el chiste en la tarea. Sacalo antes de que lo vea la maestra.",
    listenText: "Copiá el texto, pegalo y después deshacé el cambio con Control y Z.",
    targets: ["Ctrl+A", "Ctrl+C", "Ctrl+V", "Ctrl+Z"],
    scene: {
      sourceLabel: "Chiste del recreo",
      source: "¿Qué le dice un cero a un ocho? ¡Lindo cinturón!",
      targetLabel: "Tu tarea de matemática",
    },
    steps: [
      { combo: "Ctrl+A", prompt: "Seleccioná el chiste con Ctrl + A." },
      { combo: "Ctrl+C", prompt: "Copialo con Ctrl + C." },
      { combo: "Ctrl+V", prompt: "Pegalo en la tarea con Ctrl + V… ¡ups!, ahí no iba." },
      { combo: "Ctrl+Z", prompt: "Sacalo con Ctrl + Z. Deshacer borra lo último que hiciste." },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 3,
    description: "Ctrl + Z te salva cuando pegás algo donde no iba.",
  }),
  makeActivity({
    worldId: "island11",
    levelNumber: 5,
    title: "Buscar en la página",
    subtitle: "Ctrl + F encuentra, Escape cierra",
    instruction: "La página es larga. Encontrá el día del acto sin leerla toda.",
    listenText: "Abrí el buscador con Control y F. Después cerralo con Escape.",
    targets: ["Ctrl+F", "Escape"],
    scene: {
      page: "Bienvenidos a la escuela. Las clases empiezan a las 8. El acto es el viernes 12. La biblioteca abre los martes. El comedor cierra a las 14.",
      find: "viernes 12",
    },
    steps: [
      { combo: "Ctrl+F", prompt: "Abrí el buscador con Ctrl + F para encontrar «viernes 12»." },
      { combo: "Escape", prompt: "Ya lo encontraste. Cerrá el buscador con Escape.", env: "find-box" },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 4,
    description: "Ctrl + F busca una palabra en toda la página, sin leerla entera.",
  }),
  makeActivity({
    worldId: "island11",
    levelNumber: 6,
    title: "Copiar el correo",
    subtitle: "Buscar, copiar y pegar",
    instruction: "Encontrá el correo de la escuela y copialo en el formulario.",
    listenText: "Buscá el correo con Control y F, cerrá el buscador, y después copialo y pegalo.",
    targets: ["Ctrl+F", "Escape", "Ctrl+A", "Ctrl+C", "Ctrl+V"],
    scene: {
      page: "Contacto: la secretaría atiende de 8 a 12. Escribinos a hola@escuela.edu.ar y te respondemos.",
      find: "hola@escuela.edu.ar",
      sourceLabel: "Correo que encontraste",
      source: "hola@escuela.edu.ar",
      targetLabel: "Formulario de contacto",
    },
    steps: [
      { combo: "Ctrl+F", prompt: "Abrí el buscador con Ctrl + F y buscá el correo." },
      { combo: "Escape", prompt: "Ya está a la vista. Cerrá el buscador con Escape.", env: "find-box" },
      { combo: "Ctrl+A", prompt: "Seleccioná el correo con Ctrl + A." },
      { combo: "Ctrl+C", prompt: "Copialo con Ctrl + C." },
      { combo: "Ctrl+V", prompt: "Pegalo en el formulario con Ctrl + V. Copiar evita equivocarse una letra." },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 4,
    description: "Copiar un correo evita el error de escribirlo mal.",
  }),
  makeActivity({
    worldId: "island11",
    levelNumber: 7,
    title: "Reto de comandos",
    subtitle: "Toda la isla en una tarea",
    instruction: "Mandale el mensaje a tu compañero: copialo, arreglá el error y enviá.",
    listenText: "Seleccioná, copiá, pegá, deshacé el error, volvé a pegar y enviá con Enter.",
    targets: ["Ctrl+A", "Ctrl+C", "Ctrl+V", "Ctrl+Z", "Ctrl+V", "Enter"],
    scene: {
      sourceLabel: "Mensaje para tu compañero",
      source: "Te espero en la biblioteca a las 10.",
      targetLabel: "Chat de la clase",
    },
    steps: [
      { combo: "Ctrl+A", prompt: "Seleccioná el mensaje con Ctrl + A." },
      { combo: "Ctrl+C", prompt: "Copialo con Ctrl + C." },
      { combo: "Ctrl+V", prompt: "Pegalo en el chat con Ctrl + V." },
      { combo: "Ctrl+Z", prompt: "Te diste cuenta de que era el chat equivocado: deshacé con Ctrl + Z." },
      { combo: "Ctrl+V", prompt: "Ya estás en el chat correcto. Pegalo de nuevo con Ctrl + V." },
      {
        combo: "Enter",
        prompt: "Último paso: confirmá el envío con Enter.",
        dialog: {
          app: "Chat de la clase",
          question: "¿Enviar el mensaje a tu compañero?",
          accept: "Enviar",
          cancel: "Todavía no",
          resultAccept: "Mensaje enviado. ¡Terminaste la isla!",
          resultCancel: "El mensaje quedó sin enviar.",
        },
      },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 5,
    description: "Cerrá la isla usando todos los comandos en una sola tarea.",
  }),
];

/* World 12 — Isla de ventanas y pestañas (engine de atajos).
 *
 * Estos siete niveles eran listas de un mismo atajo repetido ("Ctrl+T" tres
 * veces) sobre un navegador que se REINICIABA en cada intento: abrías una
 * pestaña, desaparecía, y volvías a abrir la misma. No quedaba nada hecho,
 * así que el atajo no servía para nada dentro del nivel.
 *
 * Ahora cada nivel es UNA tarea con `steps`, y el navegador conserva su
 * estado de un paso al otro: lo que abrís sigue abierto y después lo cerrás
 * vos. Las pestañas se declaran con su tipo (`kind`), y cada tipo se dibuja
 * distinto — un buscador no se ve igual que un video ni que un anuncio —,
 * que era la otra mitad del problema: con todas iguales, cambiar de pestaña
 * no se notaba.
 *
 * Ojo con la consigna HABLADA de esta isla: sus atajos se los queda el
 * navegador salvo que el nivel logre pantalla completa (Ctrl+W hasta cierra
 * la pestaña y se lleva la partida), así que sigue pidiendo el teclado DEL
 * JUEGO, que anda en los dos casos. La consigna escrita de cada paso nombra
 * el atajo, que es lo que hay que aprender. */
const world12: Activity[] = [
  makeActivity({
    worldId: "island12",
    levelNumber: 1,
    title: "Abrir sin perder lo de antes",
    subtitle: "Ctrl + T",
    instruction: "Buscá dos cosas para la tarea sin cerrar la tarea.",
    listenText: "Tocá Control y T en el teclado del juego para abrir una pestaña nueva. La tarea queda abierta.",
    targets: ["Ctrl+T", "Ctrl+T"],
    scene: {
      tabs: [
        { title: "Tarea de ciencias", kind: "texto", lines: ["El sistema solar", "Dibujar los ocho planetas y escribir cuál es el más grande."] },
      ],
      opens: [
        { title: "Fotos del espacio", kind: "buscador", lines: ["fotos del sistema solar", "Los 8 planetas en orden", "Fotos reales del telescopio"] },
        { title: "Mapa del cielo", kind: "mapa", lines: ["Cielo de esta noche", "Júpiter se ve hacia el este"] },
      ],
    },
    steps: [
      { combo: "Ctrl+T", prompt: "Necesitás una foto del sistema solar. Abrí una pestaña con Ctrl + T: mirá que la tarea NO se cierra, queda al lado." },
      { combo: "Ctrl+T", prompt: "Te falta el mapa del cielo. Abrí otra con Ctrl + T. Ahora tenés las tres cosas abiertas a la vez." },
    ],
    mode: "assisted",
    inputType: "shortcut",
    difficulty: 2,
    description: "Ctrl + T abre una pestaña más: lo que ya tenías sigue ahí.",
  }),
  makeActivity({
    worldId: "island12",
    levelNumber: 2,
    title: "Cerrar lo que no usás",
    subtitle: "Ctrl + W",
    instruction: "Tenés la pantalla llena. Dejá abierta sólo la tarea.",
    listenText: "Tocá Control y W en el teclado del juego para cerrar la pestaña en la que estás parado.",
    targets: ["Ctrl+W", "Ctrl+W"],
    scene: {
      /* Arranca parado en el anuncio a propósito: Ctrl+W cierra la pestaña
         ACTIVA, y todavía no sabe cambiarse de pestaña (eso es el nivel 3).
         Al cerrar una, el foco cae en la de al lado, que es la otra que hay
         que cerrar, y termina solo en la tarea. */
      activeTab: 1,
      tabs: [
        { title: "Tarea de lengua", kind: "texto", lines: ["Los animales", "Escribir cinco palabras con ll y cinco con y."] },
        { title: "¡GANASTE!", kind: "anuncio", lines: ["¡Ganaste un celular nuevo!", "Hacé clic acá antes de que se termine"] },
        { title: "Carreras 3D", kind: "juego", lines: ["Carreras 3D", "Seguís en la vuelta 2"] },
      ],
    },
    steps: [
      { combo: "Ctrl+W", prompt: "Estás parado en un anuncio que se abrió solo. Cerralo con Ctrl + W." },
      { combo: "Ctrl+W", prompt: "Quedó el jueguito de ayer y te distrae. Cerralo también con Ctrl + W: vas a volver a la tarea." },
    ],
    mode: "assisted",
    inputType: "shortcut",
    difficulty: 2,
    description: "Ctrl + W cierra la pestaña en la que estás, y sólo esa.",
  }),
  makeActivity({
    worldId: "island12",
    levelNumber: 3,
    title: "Ir y volver entre pestañas",
    subtitle: "Ctrl + Tab",
    instruction: "Juntá los dos datos que te faltan y volvé a la tarea.",
    listenText: "Tocá Control y Tab en el teclado del juego para pasar a la pestaña siguiente.",
    targets: ["Ctrl+Tab", "Ctrl+Tab", "Ctrl+Tab"],
    scene: {
      tabs: [
        { title: "Tu tarea", kind: "texto", lines: ["Geografía", "Qué quiere decir «afluente» y dónde queda el río Paraná."] },
        { title: "Diccionario", kind: "diccionario", lines: ["afluente", "Río que desemboca en otro río más grande."] },
        { title: "Mapa", kind: "mapa", lines: ["Río Paraná", "Cruza Misiones, Corrientes y Santa Fe"] },
      ],
    },
    steps: [
      { combo: "Ctrl+Tab", prompt: "El significado está en el diccionario, la pestaña de al lado. Pasá con Ctrl + Tab." },
      { combo: "Ctrl+Tab", prompt: "Ahora fijate por dónde pasa el río: seguí con Ctrl + Tab hasta el mapa." },
      { combo: "Ctrl+Tab", prompt: "Ya tenés los dos datos. Ctrl + Tab otra vez y volvés a la tarea: después de la última, arranca de nuevo por la primera." },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 3,
    description: "Ctrl + Tab va a la pestaña siguiente y, en la última, vuelve a la primera.",
  }),
  makeActivity({
    worldId: "island12",
    levelNumber: 4,
    title: "Una ventana no es una pestaña",
    subtitle: "Ctrl + N",
    instruction: "Separá lo de la escuela de lo tuyo, en dos ventanas.",
    /* Este nivel era Alt+Tab y hubo que cambiarlo: Alt+Tab lo maneja el
       SISTEMA OPERATIVO, no el navegador, así que no hay forma de capturarlo
       — ni con pantalla completa ni con Keyboard Lock, que sólo alcanza a los
       atajos del navegador. Se apretaba y el alumno terminaba en otra
       ventana, fuera del juego. Ctrl+N queda en el mismo tema y sí se
       captura; además deja mostrar la diferencia que da nombre al nivel. */
    listenText: "Tocá Control y N en el teclado del juego para abrir una ventana nueva, aparte de la que ya tenías.",
    targets: ["Ctrl+N", "Ctrl+T"],
    scene: {
      tabs: [
        { title: "Tarea de historia", kind: "texto", lines: ["25 de Mayo", "Contar con tus palabras qué pasó ese día."] },
        { title: "Buscador", kind: "buscador", lines: ["qué pasó el 25 de mayo de 1810", "La Revolución de Mayo para chicos", "Línea de tiempo de 1810"] },
      ],
      opens: [
        { title: "Videos de gatos", kind: "video", lines: ["Gatos haciendo lío", "4:12"] },
        { title: "Chat con Meli", kind: "mensajes", lines: ["Meli: ¿hiciste la de historia?", "Vos: estoy en eso", "Meli: pasámela después 😅"] },
      ],
    },
    steps: [
      { combo: "Ctrl+N", prompt: "No querés mezclar el recreo con la tarea. Abrí una ventana nueva con Ctrl + N: aparece OTRA ventana entera, con su propia fila de pestañas." },
      { combo: "Ctrl+T", prompt: "Estás parado en la ventana nueva. Abrí una pestaña acá con Ctrl + T y mirá dónde se suma: en ESTA ventana. La de la tarea quedó intacta." },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 4,
    description: "Ctrl + N abre otra ventana entera; Ctrl + T sólo suma una pestaña a la ventana donde estás.",
  }),
  makeActivity({
    worldId: "island12",
    levelNumber: 5,
    title: "Abrir, usar y cerrar",
    subtitle: "Ctrl + T / Ctrl + W",
    instruction: "Buscá dos datos y dejá la pantalla como la encontraste.",
    listenText: "Abrí cada pestaña con Control y T, y cerrala con Control y W cuando ya no la necesites. Usá el teclado del juego.",
    targets: ["Ctrl+T", "Ctrl+W", "Ctrl+T", "Ctrl+W"],
    scene: {
      tabs: [
        { title: "Tu redacción", kind: "texto", lines: ["Las vacaciones", "Escribimos en la bahía hasta que se nubló…"] },
      ],
      opens: [
        { title: "Diccionario", kind: "diccionario", lines: ["bahía", "Entrada de mar en la costa. Se escribe con hache y con tilde en la i."] },
        { title: "Clima", kind: "clima", lines: ["18°", "Mañana: nublado, puede llover a la tarde"] },
      ],
    },
    steps: [
      { combo: "Ctrl+T", prompt: "No sabés si «bahía» lleva hache. Abrí una pestaña con Ctrl + T para buscarlo en el diccionario." },
      { combo: "Ctrl+W", prompt: "Ya lo viste y lo corregiste. Cerrá esa pestaña con Ctrl + W: si dejás todo abierto no encontrás nada." },
      { combo: "Ctrl+T", prompt: "Ahora querés contar si mañana llueve. Abrí otra pestaña con Ctrl + T." },
      { combo: "Ctrl+W", prompt: "Anotado. Cerrala con Ctrl + W y quedás de nuevo en tu redacción, que nunca se fue." },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 4,
    description: "Abrir una pestaña para cada cosa, y cerrarla al terminar, es lo que mantiene la pantalla ordenada.",
  }),
  makeActivity({
    worldId: "island12",
    levelNumber: 6,
    title: "Reto de ventanas",
    subtitle: "Todo junto",
    instruction: "Preparás la exposición del viernes sin perder nada de vista.",
    listenText: "Hacé cada atajo que te pide el paso, con el teclado del juego.",
    targets: ["Ctrl+T", "Ctrl+Tab", "Ctrl+Tab", "Ctrl+W", "Ctrl+N"],
    scene: {
      tabs: [
        { title: "Exposición", kind: "texto", lines: ["Los volcanes", "Falta: una foto y ensayar en voz alta."] },
        { title: "¡100 juegos!", kind: "anuncio", lines: ["¡Descargá 100 juegos gratis!", "Instalá ahora, sin permiso de nadie"] },
      ],
      opens: [
        { title: "Fotos de volcanes", kind: "buscador", lines: ["volcán en erupción", "El Villarrica visto desde Pucón", "Cómo se forma un volcán"] },
        { title: "Ensayo", kind: "texto", lines: ["Ensayo de la exposición", "1) Qué es un volcán. 2) La foto. 3) Una curiosidad."] },
      ],
    },
    steps: [
      { combo: "Ctrl+T", prompt: "Te falta una imagen del volcán. Abrí una pestaña con Ctrl + T y buscala." },
      { combo: "Ctrl+Tab", prompt: "Volvé a la exposición para ver qué más falta: Ctrl + Tab. Estabas en la última, así que arranca por la primera." },
      { combo: "Ctrl+Tab", prompt: "Seguí con Ctrl + Tab: la próxima es el anuncio que se coló solo entre tus pestañas." },
      { combo: "Ctrl+W", prompt: "Ese anuncio no lo abriste vos y no te sirve. Cerralo con Ctrl + W." },
      { combo: "Ctrl+N", prompt: "Para ensayar sin distraerte, abrí una ventana nueva con Ctrl + N: ahí va a estar sólo el ensayo." },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 5,
    description: "Abrir, moverte, cerrar y separar en ventanas: los cuatro atajos en una sola tarea.",
  }),
  makeActivity({
    worldId: "island12",
    levelNumber: 7,
    title: "Malabares de pestañas",
    subtitle: "El reto más difícil",
    instruction: "Ordená todo lo que quedó abierto de anoche.",
    /* Un escalón sobre "Reto de ventanas": la misma familia de atajos, más
       largo y alternando más. NO se suma Ctrl+Shift+Tab: ese se enseña en la
       isla 14, que viene después en el orden pedagógico. */
    listenText: "Hacé cada atajo que te pide el paso, con el teclado del juego.",
    targets: ["Ctrl+W", "Ctrl+Tab", "Ctrl+T", "Ctrl+N", "Ctrl+T", "Ctrl+W"],
    scene: {
      activeTab: 2,
      tabs: [
        { title: "Matemática", kind: "texto", lines: ["Tarea de matemática", "Revisar: 128 × 4 y 96 ÷ 3."] },
        { title: "Clase grabada", kind: "video", lines: ["Fracciones — clase del martes", "12:40"] },
        { title: "¡Premio!", kind: "anuncio", lines: ["¡Sos el visitante un millón!", "Escribí tus datos para cobrar"] },
      ],
      opens: [
        { title: "Calculadora", kind: "calculadora", lines: ["128 × 4 = 512"] },
        { title: "Música", kind: "video", lines: ["Playlist de la tarde", "38 canciones"] },
        { title: "Grupo de la escuela", kind: "mensajes", lines: ["Nico: ¿alguien tiene la 3?", "Vos: me dio 512", "Meli: a mí también 🙌"] },
      ],
    },
    steps: [
      { combo: "Ctrl+W", prompt: "Amaneciste con un premio falso en pantalla. Empezá por ahí: cerralo con Ctrl + W." },
      { combo: "Ctrl+Tab", prompt: "Quedaste en la clase grabada, pero primero va la tarea. Pasá con Ctrl + Tab." },
      { combo: "Ctrl+T", prompt: "Querés revisar una cuenta. Abrí la calculadora en una pestaña nueva con Ctrl + T." },
      { combo: "Ctrl+N", prompt: "Terminaste con la escuela. Abrí una ventana nueva con Ctrl + N para lo tuyo, aparte de todo lo anterior." },
      { combo: "Ctrl+T", prompt: "En esa ventana nueva abrí también el grupo de la escuela, con Ctrl + T." },
      { combo: "Ctrl+W", prompt: "Te llaman a cenar. Cerrá el chat con Ctrl + W y dejá sólo la música sonando." },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 6,
    description: "Seis atajos encadenados, y al final la pantalla queda como vos querías.",
  }),
];

/* World 13 — Isla de los mensajes: frases amigables. */
const world13: Activity[] = [
  makeActivity({
    worldId: "island13",
    levelNumber: 1,
    title: "Saludos",
    subtitle: "Frases cortas",
    instruction: "Escribí el saludo que aparece.",
    listenText: "Escribí el saludo que aparece.",
    targets: ["Hola", "Buen dia", "Que tal", "Adios"],
    mode: "assisted",
    inputType: "phrase",
    difficulty: 3,
    description: "Practicá saludos amigables.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island13",
    levelNumber: 2,
    title: "Frases amables",
    subtitle: "Decir cosas lindas",
    instruction: "Escribí la frase completa.",
    listenText: "Escribí la frase completa.",
    targets: ["Gracias amigo", "Muy buen trabajo", "Te quiero mucho"],
    mode: "assisted",
    inputType: "phrase",
    difficulty: 3,
    description: "Escribí frases amables para tus amigos.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island13",
    levelNumber: 3,
    title: "Mensajes con tilde",
    subtitle: "Acentos",
    instruction: "Escribí el mensaje con su tilde.",
    listenText: "Escribí el mensaje con su tilde.",
    targets: ["¿Cómo estás?", "Estoy acá", "Nos vemos pronto"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 4,
    description: "Sumá tildes a tus mensajes.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island13",
    levelNumber: 4,
    title: "Mensajes largos",
    subtitle: "Frases completas",
    instruction: "Escribí el mensaje completo.",
    listenText: "Escribí el mensaje completo.",
    targets: ["Hoy fue un dia genial", "Me encanta jugar contigo"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Escribí mensajes más largos.",
  }),
  makeActivity({
    worldId: "island13",
    levelNumber: 5,
    title: "Invitaciones",
    subtitle: "Con signos",
    instruction: "Escribí la invitación con todos sus signos.",
    listenText: "Escribí la invitación con todos sus signos.",
    targets: ["¿Querés jugar?", "¡Vení a mi casa!", "¿Vamos al parque?"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Invitá a un amigo con signos correctos.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island13",
    levelNumber: 6,
    title: "Reto de mensajes",
    subtitle: "Mensaje completo",
    instruction: "Escribí el mensaje completo tal como aparece.",
    listenText: "Escribí el mensaje completo tal como aparece.",
    targets: ["¡Hola! ¿Cómo estás hoy?", "Gracias por ser mi amigo.", "¡Nos vemos mañana!"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Cerrá la isla escribiendo un mensaje completo.",
    requiresAccent: true,
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island13",
    levelNumber: 7,
    title: "Mensaje completo",
    subtitle: "El reto más difícil",
    instruction: "Escribí el mensaje completo.",
    listenText: "Escribí el mensaje completo.",
    /* Un escalón sobre "Reto de mensajes": dos oraciones por mensaje en vez de
       una, manteniendo las tildes y los signos de apertura. */
    targets: [
      "¡Hola! ¿Querés jugar en el parque mañana?",
      "Gracias por invitarme, me divertí mucho.",
      "¡Feliz cumpleaños! Te deseo un día genial.",
    ],
    mode: "independent",
    inputType: "phrase",
    difficulty: 7,
    description: "Escribí mensajes de dos oraciones, con todos sus signos.",
  }),
];

/* World 14 — Isla de atajos avanzados (engine de atajos).
 *
 * Misma corrección que la isla 12, por el mismo motivo: eran listas de un
 * atajo repetido ("Ctrl+S" tres veces) sobre simuladores que se reiniciaban
 * en cada intento, así que nada de lo que hacías quedaba hecho. Y encima
 * había órdenes imposibles — el nivel 1 copiaba ANTES de seleccionar y el 2
 * rehacía ANTES de deshacer, que es como pedir que devuelvas algo que
 * todavía no sacaste.
 *
 * Los siete niveles son ahora una misma historia contada por partes: el
 * informe de los volcanes, desde que copiás la consigna hasta que lo
 * entregás por correo. Todos usan `steps`, así el simulador se acuerda de
 * lo que hiciste en el paso anterior.
 *
 * REGLA DE DISEÑO al tocar estos niveles: el simulador se remonta cuando
 * cambia el escenario, así que un nivel puede pasar del navegador al editor
 * pero NO puede volver. Si un nivel vuelve al escenario anterior, ese
 * escenario arranca de cero y la tarea se corta por la mitad. Por eso los
 * niveles 6 y 7 hacen primero todo lo del navegador y después todo lo del
 * documento. */
const world14: Activity[] = [
  makeActivity({
    worldId: "island14",
    levelNumber: 1,
    title: "Repaso de atajos",
    subtitle: "Ctrl + A, Ctrl + C y Ctrl + V",
    instruction: "Pasá la consigna a tu informe sin escribirla de nuevo.",
    listenText: "Seleccioná la consigna con Control y A, copiala con Control y C y pegala con Control y V.",
    /* El orden era Ctrl+C, Ctrl+V, Ctrl+A: copiar antes de seleccionar y
       seleccionar al final, cuando ya no servía para nada. */
    targets: ["Ctrl+A", "Ctrl+C", "Ctrl+V"],
    scene: {
      docLabel: "informe-volcanes.doc",
      sourceLabel: "Consigna de la seño",
      source: "Explicar por qué el volcán Villarrica sigue activo.",
      targetLabel: "Tu informe",
    },
    steps: [
      { combo: "Ctrl+A", prompt: "Seleccioná toda la consigna con Ctrl + A." },
      { combo: "Ctrl+C", prompt: "Copiala con Ctrl + C. Mirá el portapapeles de acá abajo: ahí queda guardada." },
      { combo: "Ctrl+V", prompt: "Pegala arriba de tu informe con Ctrl + V, así la tenés a la vista mientras escribís." },
    ],
    mode: "assisted",
    inputType: "shortcut",
    difficulty: 3,
    description: "Seleccionar, copiar y pegar: los tres van juntos y en ese orden.",
  }),
  makeActivity({
    worldId: "island14",
    levelNumber: 2,
    title: "Deshacer y rehacer",
    subtitle: "Ctrl + Z y Ctrl + Y",
    instruction: "Te arrepentiste de un cambio, y después te arrepentiste de haberte arrepentido.",
    listenText: "Pegá con Control y V, deshacé con Control y Z y volvé a traerlo con Control y Y.",
    /* Era Ctrl+Y, Ctrl+Z, Ctrl+Y: rehacer primero, cuando todavía no había
       nada deshecho, o sea que el atajo no hacía nada. */
    targets: ["Ctrl+V", "Ctrl+Z", "Ctrl+Y"],
    scene: {
      docLabel: "informe-volcanes.doc",
      sourceLabel: "Conclusión que escribiste ayer",
      source: "Sigue activo porque debajo del volcán el magma nunca se enfría del todo.",
      /* Arranca con la conclusión ya copiada: el nivel es sobre deshacer y
         rehacer, no sobre copiar, así que no lo hace empezar copiando. */
      clipboard: "Sigue activo porque debajo del volcán el magma nunca se enfría del todo.",
      targetLabel: "Tu informe",
    },
    steps: [
      { combo: "Ctrl+V", prompt: "Ya tenías copiada la conclusión. Pegala en el informe con Ctrl + V." },
      { combo: "Ctrl+Z", prompt: "Lo pensás mejor y te parece que quedó mal. Sacala con Ctrl + Z." },
      { combo: "Ctrl+Y", prompt: "La seño te dice que estaba bien. Ctrl + Y la trae de vuelta sin tener que escribirla otra vez: eso es rehacer." },
    ],
    mode: "assisted",
    inputType: "shortcut",
    difficulty: 4,
    description: "Ctrl + Z va para atrás y Ctrl + Y vuelve para adelante.",
  }),
  makeActivity({
    worldId: "island14",
    levelNumber: 3,
    title: "Guardar los cambios",
    subtitle: "Ctrl + S",
    instruction: "Sumá el dato al informe y guardalo antes de cerrar.",
    listenText: "Seleccioná el dato, copialo, pegalo y guardá el informe con Control y S.",
    targets: ["Ctrl+A", "Ctrl+C", "Ctrl+V", "Ctrl+S"],
    scene: {
      docLabel: "informe-volcanes.doc",
      sourceLabel: "Dato que encontraste",
      source: "El Villarrica mide 2.847 metros y tuvo su última erupción en 2015.",
      targetLabel: "Tu informe",
    },
    steps: [
      { combo: "Ctrl+A", prompt: "Seleccioná el dato con Ctrl + A." },
      { combo: "Ctrl+C", prompt: "Copialo con Ctrl + C." },
      { combo: "Ctrl+V", prompt: "Pegalo en el informe con Ctrl + V. Mirá arriba: el archivo pasó a decir «sin guardar»." },
      { combo: "Ctrl+S", prompt: "Guardá con Ctrl + S. Recién ahí el cambio queda en la compu y no se pierde si se apaga." },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 4,
    description: "Cambiar algo no es guardarlo: hasta que no hacés Ctrl + S, el archivo sigue sin guardar.",
  }),
  makeActivity({
    worldId: "island14",
    levelNumber: 4,
    title: "Pestaña anterior",
    subtitle: "Ctrl + Shift + Tab",
    instruction: "Volvé para atrás hasta la pestaña donde estaba la consigna.",
    /* Reservado por el navegador, igual que los de la isla 12: se pide el
       teclado del juego y no el real. */
    listenText: "Tocá Control, Shift y Tab en el teclado del juego para volver a la pestaña anterior.",
    targets: ["Ctrl+Shift+Tab", "Ctrl+Shift+Tab", "Ctrl+Shift+Tab"],
    scene: {
      activeTab: 3,
      tabs: [
        { title: "Consigna", kind: "texto", lines: ["Trabajo práctico", "Explicar por qué el Villarrica sigue activo."] },
        { title: "Fotos del volcán", kind: "buscador", lines: ["volcán Villarrica", "El Villarrica visto desde Pucón", "La última erupción, en 2015"] },
        { title: "Mapa de Chile", kind: "mapa", lines: ["Volcán Villarrica", "Región de La Araucanía, cerca de Pucón"] },
        { title: "Video del cráter", kind: "video", lines: ["Adentro del cráter", "3:48"] },
      ],
    },
    steps: [
      { combo: "Ctrl+Shift+Tab", prompt: "Estás en el video. Ctrl + Tab va para adelante; sumándole Shift va para ATRÁS: la anterior es el mapa." },
      { combo: "Ctrl+Shift+Tab", prompt: "Otra vez para atrás con Ctrl + Shift + Tab y llegás a las fotos." },
      { combo: "Ctrl+Shift+Tab", prompt: "Una más y estás en la consigna, que era adonde querías volver." },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 5,
    description: "Ctrl + Tab va para adelante; con Shift, para atrás.",
  }),
  makeActivity({
    worldId: "island14",
    levelNumber: 5,
    title: "Tres teclas a la vez",
    subtitle: "Ctrl + Shift + T / Tab / N",
    instruction: "Arreglá lo que cerraste sin querer y buscá algo en privado.",
    listenText: "Hacé cada atajo de tres teclas con el teclado del juego.",
    targets: ["Ctrl+W", "Ctrl+Shift+T", "Ctrl+Shift+Tab", "Ctrl+Shift+N"],
    scene: {
      activeTab: 2,
      tabs: [
        { title: "Consigna", kind: "texto", lines: ["Trabajo práctico", "Explicar por qué el Villarrica sigue activo."] },
        { title: "Fotos del volcán", kind: "buscador", lines: ["volcán Villarrica", "El Villarrica visto desde Pucón", "La última erupción, en 2015"] },
        { title: "Video del cráter", kind: "video", lines: ["Adentro del cráter", "3:48"] },
      ],
      opens: [
        { title: "Regalos", kind: "buscador", lines: ["regalos para hermana de 8 años", "Diez ideas de regalo", "Juegos de mesa para toda la familia"] },
      ],
    },
    steps: [
      { combo: "Ctrl+W", prompt: "El video ya lo viste entero. Cerralo con Ctrl + W." },
      { combo: "Ctrl+Shift+T", prompt: "¡Uy! Te faltaba anotar un dato de ese video. Ctrl + Shift + T trae de vuelta la última pestaña que cerraste." },
      { combo: "Ctrl+Shift+Tab", prompt: "Ya lo anotaste. Volvé para atrás con Ctrl + Shift + Tab hasta las fotos." },
      { combo: "Ctrl+Shift+N", prompt: "Última: querés buscar el regalo de tu hermana sin que le quede en el historial. Abrí una ventana privada con Ctrl + Shift + N." },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 6,
    description: "Ctrl + Shift + T te salva cuando cerrás una pestaña sin querer.",
  }),
  makeActivity({
    worldId: "island14",
    levelNumber: 6,
    title: "Reto experto",
    subtitle: "Del navegador al documento",
    instruction: "Recuperá la fuente, copiala al informe y guardá.",
    /* Sin Alt+Tab: lo maneja el sistema operativo y no hay forma de
       capturarlo, así que sacaba al alumno del juego (ver la nota del nivel 4
       de la isla 12). Lo reemplazan los atajos de tres teclas de esta isla. */
    listenText: "Hacé cada atajo que te pide el paso, con el teclado del juego.",
    targets: ["Ctrl+Shift+T", "Ctrl+Shift+Tab", "Ctrl+A", "Ctrl+C", "Ctrl+V", "Ctrl+S"],
    scene: {
      activeTab: 1,
      tabs: [
        { title: "Consigna", kind: "texto", lines: ["Trabajo práctico", "Explicar por qué el Villarrica sigue activo."] },
        { title: "Mapa de Chile", kind: "mapa", lines: ["Volcán Villarrica", "Región de La Araucanía, cerca de Pucón"] },
      ],
      opens: [
        { title: "Enciclopedia", kind: "diccionario", lines: ["volcán activo", "El que tuvo erupciones en los últimos diez mil años y puede volver a tenerlas."] },
      ],
      docLabel: "informe-volcanes.doc",
      sourceLabel: "Lo que copiaste de la enciclopedia",
      source: "Un volcán activo es el que tuvo erupciones en los últimos diez mil años y puede volver a tenerlas.",
      targetLabel: "Tu informe",
    },
    steps: [
      { combo: "Ctrl+Shift+T", prompt: "Cerraste sin querer la pestaña de la enciclopedia. Traela de vuelta con Ctrl + Shift + T." },
      { combo: "Ctrl+Shift+Tab", prompt: "Volvé una pestaña para atrás con Ctrl + Shift + Tab: ahí está el mapa con el nombre completo del volcán." },
      { combo: "Ctrl+A", prompt: "Ya tenés todo. Pasá al informe y seleccioná con Ctrl + A la definición que copiaste." },
      { combo: "Ctrl+C", prompt: "Copiala con Ctrl + C." },
      { combo: "Ctrl+V", prompt: "Pegala en el informe con Ctrl + V." },
      { combo: "Ctrl+S", prompt: "Guardá con Ctrl + S antes de cerrar, o el cambio se pierde." },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 6,
    description: "Los atajos del navegador y los del documento, en una sola tarea.",
  }),
  makeActivity({
    worldId: "island14",
    levelNumber: 7,
    title: "Maestro de atajos",
    subtitle: "El reto más difícil",
    instruction: "Último día antes de entregar: dejá todo listo.",
    /* Un escalón sobre "Reto experto": más largo y con los tres atajos de
       TRES teclas, que son los que más cuestan. */
    listenText: "Hacé cada atajo que te pide el paso, con el teclado del juego.",
    targets: ["Ctrl+T", "Ctrl+Shift+Tab", "Ctrl+Shift+N", "Ctrl+A", "Ctrl+C", "Ctrl+V", "Ctrl+S"],
    scene: {
      tabs: [
        { title: "Fotos del volcán", kind: "buscador", lines: ["volcán Villarrica", "El Villarrica visto desde Pucón", "La última erupción, en 2015"] },
        { title: "Consigna", kind: "texto", lines: ["Trabajo práctico", "Entregar el informe por correo antes del viernes."] },
      ],
      opens: [
        { title: "Correo", kind: "mensajes", lines: ["Seño Ana: no se olviden de entregar el viernes", "Vos: ¡ya casi lo tengo!"] },
        { title: "Correo privado", kind: "mensajes", lines: ["Entrar con tu cuenta", "Nadie más va a ver que entraste"] },
      ],
      docLabel: "informe-volcanes.doc",
      sourceLabel: "Tu informe terminado",
      source: "El Villarrica sigue activo porque el magma que tiene debajo nunca se enfría del todo.",
      targetLabel: "Correo para la seño",
    },
    steps: [
      { combo: "Ctrl+T", prompt: "Abrí una pestaña con Ctrl + T para entrar al correo de la escuela." },
      { combo: "Ctrl+Shift+Tab", prompt: "Antes de escribir, volvé para atrás con Ctrl + Shift + Tab y releé la consigna." },
      { combo: "Ctrl+Shift+N", prompt: "Estás en la compu de la escuela y no querés dejar tu cuenta abierta. Abrí una ventana privada con Ctrl + Shift + N." },
      { combo: "Ctrl+A", prompt: "Pasá al informe y seleccionalo entero con Ctrl + A." },
      { combo: "Ctrl+C", prompt: "Copialo con Ctrl + C." },
      { combo: "Ctrl+V", prompt: "Pegalo en el correo para la seño con Ctrl + V." },
      { combo: "Ctrl+S", prompt: "Guardá tu copia con Ctrl + S, por las dudas. ¡Entregado!" },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 7,
    description: "Siete atajos encadenados para terminar y entregar el trabajo.",
  }),
];

/* World 15 — Isla del gran reto: mezcla final de todo lo aprendido.
 *
 * Eran 8 y quedaron 6, en dos podas.
 *
 * La primera fue por el arte: hay un pedestal más arriba de todo, pero la
 * propia lámina lo corta por la mitad, así que el nodo caía en y 2,7 % —
 * pegado al borde superior y debajo del HUD — y el 4 no se veía ni se podía
 * tocar. Se fue con él "Búsqueda del reto", que era el que sobraba: dos
 * frases sueltas en minúscula, sin signos ni tildes ni arroba, o sea la misma
 * destreza que "Frases del reto" pero tres niveles después.
 *
 * La segunda fue a pedido: se sacó el botón que hacía de 3 y con él su nivel,
 * "Frases del reto", y los de atrás corrieron un lugar. Los botones NO se
 * movieron: cada uno quedó donde estaba y sólo cambió el número.
 *
 *   1 letras 3 · 2 palabras 4 · 3 signos y tildes 5
 *   4 correo (arroba y Shift) 6 · 5 atajos 6 · 6 todo junto 7
 *
 * OJO con el escalón entre el 2 y el 3: la isla ya no tiene un nivel de
 * frases sin signos, así que se pasa de escribir palabras sueltas a escribir
 * frases con ¿ ¡ y tildes de una. Si alguna vez se quiere suavizar, el lugar
 * es agregarle a "Signos del reto" una primera frase sin signos. */
const world15: Activity[] = [
  makeActivity({
    worldId: "island15",
    levelNumber: 1,
    title: "Letras veloces",
    subtitle: "Calentamiento",
    instruction: "Presioná rápido cada letra.",
    listenText: "Presioná rápido cada letra que aparece.",
    targets: ["q", "p", "z", "m", "x", "b", "ñ", "v"],
    mode: "independent",
    inputType: "letter",
    difficulty: 3,
    description: "Calentá los dedos para el gran reto.",
  }),
  makeActivity({
    worldId: "island15",
    levelNumber: 2,
    title: "Palabras del reto",
    subtitle: "Velocidad",
    instruction: "Escribí cada palabra rápido y bien.",
    listenText: "Escribí cada palabra rápido y bien.",
    targets: ["aventura", "tesoro", "victoria", "campeon"],
    mode: "independent",
    inputType: "word",
    difficulty: 4,
    description: "Escribí palabras con velocidad.",
  }),
  makeActivity({
    worldId: "island15",
    levelNumber: 3,
    title: "Signos del reto",
    subtitle: "Puntuación",
    instruction: "Escribí cada frase con todos sus signos.",
    listenText: "Escribí cada frase con todos sus signos.",
    targets: ["¡Qué genial!", "¿Estás listo?", "Hola, amigo."],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Combiná signos y tildes.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island15",
    levelNumber: 4,
    title: "Correo del reto",
    subtitle: "Email completo",
    instruction: "Escribí la dirección de correo completa.",
    listenText: "Escribí la dirección de correo completa.",
    targets: ["campeon@gmail.com", "ganador@escuela.edu"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Escribí un correo sin errores.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island15",
    levelNumber: 5,
    title: "Atajos del reto",
    subtitle: "Comandos",
    instruction: "Hacé cada atajo que aparece.",
    listenText: "Hacé cada atajo que aparece en pantalla.",
    targets: ["Ctrl+C", "Ctrl+V", "Ctrl+Z", "Enter"],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 6,
    description: "Demostrá que dominás los atajos.",
  }),
  makeActivity({
    worldId: "island15",
    levelNumber: 6,
    title: "¡Gran final!",
    subtitle: "Todo junto",
    instruction: "Escribí cada frase exactamente como aparece.",
    listenText: "Escribí cada frase exactamente como aparece.",
    targets: [
      "¡Lo logré! Soy un campeón.",
      "Mi correo es campeon@gmail.com.",
      "¿Listo para el final? ¡Vamos!",
    ],
    mode: "independent",
    inputType: "phrase",
    difficulty: 7,
    description: "El gran final: todo lo que aprendiste, junto.",
    requiresAccent: true,
    requiresShift: true,
  }),
];

export const activities: Activity[] = [
  ...world1,
  ...world2,
  ...world3,
  ...world4,
  ...world5,
  ...world6,
  ...world7,
  ...world8,
  ...world9,
  ...world10,
  ...world11,
  ...world12,
  ...world13,
  ...world14,
  ...world15,
];

export const activitiesByWorld: Record<Activity["worldId"], Activity[]> = {
  island1: world1,
  island2: world2,
  island3: world3,
  island4: world4,
  island5: world5,
  island6: world6,
  island7: world7,
  island8: world8,
  island9: world9,
  island10: world10,
  island11: world11,
  island12: world12,
  island13: world13,
  island14: world14,
  island15: world15,
};

export const levelActivityIds = activities.map((activity) => activity.id);

export function getActivityById(id?: string): Activity {
  return activities.find((activity) => activity.id === id) ?? activities[0];
}

export function getActivitiesForWorld(worldId: Activity["worldId"]): Activity[] {
  return activitiesByWorld[worldId];
}

/* ------------------------------------------------------------------ */
/* Orden pedagógico                                                    */
/* ------------------------------------------------------------------ */

/** Las quince islas en el orden en que se aprenden — que NO es el orden
 *  de sus ids: `island6` va segunda y `island2` tercera.
 *
 *  Vive acá, en la hoja del árbol de dependencias, porque la necesitan
 *  tanto `data/worlds.ts` como `utils/userContext.ts`, y ese último no
 *  puede importar de `worlds.ts` sin cerrar un ciclo. */
export const WORLD_PEDAGOGY_ORDER: ReadonlyArray<Activity["worldId"]> = [
  "island1",   // 1  primeras letras
  "island6",   // 2  sílabas y palabras cortas
  "island2",   // 3  palabras
  "island7",   // 4  palabras largas y frases
  "island13",  // 5  mensajes
  "island5",   // 6  mouse y habilidades digitales
  "island3",   // 7  mayúsculas, ñ, tildes
  "island8",   // 8  puntuación y signos
  "island9",   // 9  correo electrónico
  "island4",   // 10 símbolos y código
  "island10",  // 11 búsquedas en el navegador
  "island11",  // 12 comandos básicos
  "island12",  // 13 ventanas y pestañas
  "island14",  // 14 atajos avanzados
  "island15",  // 15 reto final
];
