/**
 * Centralised asset paths for the app.
 *
 * Every entry points to the optimised WebP build produced by
 * `scripts/optimize_images.py`. The original PNG sources are kept on disk
 * untouched so artists and the existing `Images-new/` pipeline can still
 * regenerate them — only the *web* references go through WebP. If a kid is
 * on a browser without WebP (extremely rare in 2026: <0.4% globally), the
 * `<picture>` fallback in `Img.tsx` lets us re-introduce the PNG without
 * editing this file again.
 */
export const assets = {
  loginBg: "/assets/edutic-art/login-sky-islands-bg.webp",
  homeBg: "/assets/edutic-art/sky-soft-bg.webp",
  gameplayBg: "/assets/edutic-art/gameplay-bg.webp",

  // Male mascot.
  mascotMaleWave: "/assets/edutic-art/mascot-wave.webp",
  mascotMaleJump: "/assets/edutic-art/mascot-jump.webp",
  mascotMaleProud: "/assets/edutic-art/mascot-proud.webp",
  mascotMaleLaptop: "/assets/edutic-art/mascot-laptop.webp",
  mascotMaleNatural: "/assets/edutic-art/mascot-natural.webp",

  // Female mascot.
  mascotFemaleWave: "/assets/edutic-art/mascot-women-wave.webp",
  mascotFemaleLaptop: "/assets/edutic-art/mascot-women-laptop.webp",

  /* El arte de cada isla — cielo, isla, miniatura, escena de juego y botón —
     NO vive acá: lo resuelve islandArt() y compañía, más abajo. Una isla es
     una carpeta, no once entradas sueltas repartidas por este archivo. */
  shipFront: "/assets/edutic-art/spaceships/ship-front.webp",
  shipBack: "/assets/edutic-art/spaceships/ship-back.webp",
  shipLeft: "/assets/edutic-art/spaceships/ship-left.webp",
  shipRight: "/assets/edutic-art/spaceships/ship-right.webp",
  shipDiagonalLeft: "/assets/edutic-art/spaceships/ship-diagonal-left.webp",
  shipDiagonalRight: "/assets/edutic-art/spaceships/ship-diagonal-right.webp",
  /* Island 5 props — used by SkillLevelView for the mouse-skill levels. */
  i5Star:    "/assets/edutic-art/island5/star.webp",
  i5Apple:   "/assets/edutic-art/island5/apple.webp",
  i5Rabbit:  "/assets/edutic-art/island5/rabbit.webp",
  i5Ball:    "/assets/edutic-art/island5/ball.webp",
  i5Shot:    "/assets/edutic-art/island5/shot.webp",
  i5Penguin: "/assets/edutic-art/island5/penguin.webp",
  i5Bag:     "/assets/edutic-art/island5/bag.webp",
  i5Chest:   "/assets/edutic-art/island5/cofre.webp",
  i5Potion:  "/assets/edutic-art/island5/potion.webp",
  i5Apps:    "/assets/edutic-art/island5/apps.webp",
  i5WindowControls: "/assets/edutic-art/island5/cerrar-maximizar-minimizar-ventana.webp",
  i5Message: "/assets/edutic-art/island5/mensaje.webp",
  i5Notes:   "/assets/edutic-art/island5/notas.webp",
  i5WindowMedia: "/assets/edutic-art/island5/ventana-mismedios.webp",
  i5BrowserTabs: "/assets/edutic-art/island5/pestanas-explorador-videos-dibujos.webp",
  i5DrawingsWindow: "/assets/edutic-art/island5/dibujos-ventana.webp",
  i5Mouse:   "/assets/edutic-art/island5/mouse.webp",
  i5CastleVertical: "/assets/edutic-art/island5/castillo-vertical.webp",
  i5CastleSquare:   "/assets/edutic-art/island5/castillo-cuadrada.webp",
  i5ZoomBtns:       "/assets/edutic-art/island5/zoom-mas-menos.webp",
};

/* =====================================================================
   ARTE DE ISLA — UNA CARPETA POR ISLA
   ---------------------------------------------------------------------
   Todo lo que se dibuja de una isla vive junto, en su propia carpeta:

     public/assets/islands/islandN/
       sky.webp             el fondo, sin plataformas
       island.webp          la isla recortada, con alpha (sólo si está separada)
       map.webp             la miniatura del mapa de mundos
       gameplay.webp        el fondo de la pantalla de juego
       button.webp          botón de nivel, libre
       button-pressed.webp  botón de nivel, apretado

   Las fuentes (PNG, láminas, versiones grandes) van en el espejo
   Images/islands/islandN/ y NO se publican.

   Antes esto eran tres arreglos paralelos indexados por posición, más un
   puñado de entradas sueltas en `assets`: la isla 6 se servía de un archivo
   llamado background-island1.webp y había que saberlo de memoria. Ahora la
   ruta se arma con el worldId, así que no hay corrimiento posible.

   La tabla de abajo es lo único que hay que tocar al sumar o separar una
   isla. `split` dice que su arte YA está en dos capas — cielo aparte de la
   isla; sin él, sky.webp todavía es la escena entera con el cielo pintado
   adentro y la página lo desenfoca para rellenar los bordes.
===================================================================== */
const ISLANDS_DIR = "/assets/islands";

type IslandArtEntry = {
  /** El arte ya está separado en cielo + isla recortada. */
  split?: boolean;
  /** El dibujo nace cortado de punta a punta a propósito — sin margen de aire,
   *  con bordes que asumen que algo sigue fuera de cámara. Encogerla para que
   *  entre entera mostraría ese corte crudo. En vez de "contain" (entra
   *  entera, quizás con bandas) usa "cover": llena la pantalla siempre, y lo
   *  que sobre por ancho o alto se recorta — nunca al revés. */
  cover?: boolean;
};

const ISLAND_ART: Record<string, IslandArtEntry> = {
  island1:  { split: true },  // teclas: piedra helada, cristales y florcitas
  island2:  { split: true },               // piedra con pasto y florcitas
  island3:  { split: true },               // mármol y oro, pasto y pétalos
  island4:  { split: true },               // cerezo: aro dorado y pétalos
  island5:  { split: true },               // piedra con pasto y cubos de hielo
  island6:  { split: true },               // portal de cristal: runas y drusas
  island7:  { split: true },               // jardín: cerezo en flor
  island8:  { split: true },               // reloj helado: hielo, bronce y nieve
  island9:  { split: true },               // otoño: barro cocido y hojas de arce
  island10: { split: true },               // ruinas en la selva: piedra, musgo y helechos
  island11: { split: true },               // caramelo: galleta glaseada
  island12: { split: true },               // cañón del desierto: roca naranja, arena y cactus
  island13: { split: true },               // arcoíris: aros pastel y pasto
  island14: { split: true },               // alquimia: bronce, runas y cristales
  island15: { split: true },               // laguna: agua, nenúfares y juncos
};

export type IslandArt = {
  /** El fondo: llena la pantalla entera y se puede recortar sin costo, porque
   *  no lleva nada posicionado encima. En una isla ya separada es sky.webp, el
   *  cielo de verdad; en una que todavia no, es scene.webp, la escena entera,
   *  y la pagina la reusa desenfocada para tapar las bandas. */
  sky: string;
  /** La isla con sus plataformas, recortada. Es la caja contra la que se
   *  miden los % de levelPositions.ts. `null` mientras esa isla siga siendo
   *  una sola imagen con el cielo adentro. */
  island: string | null;
  /** true si el escenario tiene que llenar la pantalla siempre (recortando lo
   *  que sobre), en vez de entrar entero con bandas. Ver `IslandArtEntry.cover`. */
  cover: boolean;
};

const islandFile = (worldId: string, file: string) => `${ISLANDS_DIR}/${worldId}/${file}`;

/** Las dos capas del arte de un mundo.
 *
 *  El archivo de fondo cambia de nombre segun el estado, a proposito: mientras
 *  la isla no esta separada el archivo NO es un cielo, es la escena completa, y
 *  llamarlo sky.webp hacia que uno abriera la carpeta y creyera que faltaba el
 *  arte. scene.webp dice lo que es. Al separar, scene.webp se va y aparecen
 *  sky.webp + island.webp. */
export function islandArt(worldId: string): IslandArt {
  const separada = !!ISLAND_ART[worldId]?.split;
  return {
    sky: islandFile(worldId, separada ? "sky.webp" : "scene.webp"),
    island: separada ? islandFile(worldId, "island.webp") : null,
    cover: !!ISLAND_ART[worldId]?.cover,
  };
}

/** Miniatura de la isla en el mapa de mundos (recortada, con alpha). */
export const islandMapThumb = (worldId: string) => islandFile(worldId, "map.webp");

/** Escena pintada detrás del teclado en la pantalla de juego. */
export const islandGameplayBg = (worldId: string) => islandFile(worldId, "gameplay.webp");

/** Botón de nivel de un mundo. Cae al de piedra sin decorar (_default) si esa
 *  isla no figura en la tabla — hoy no le pasa a ninguna, queda de red por si
 *  algún día se suma un mundo nuevo. `pressed` es el estado apretado. */
export function levelButtonFor(worldId: string, pressed = false): string {
  const dir = ISLAND_ART[worldId] ? worldId : "_default";
  return islandFile(dir, `button${pressed ? "-pressed" : ""}.webp`);
}

/* =====================================================================
   COLOR DEL NÚMERO CUANDO EL NIVEL ESTÁ COMPLETADO
   ---------------------------------------------------------------------
   Sin completar, el número va BLANCO en las quince, sin excepciones.

   Completado toma el color del PROPIO BOTÓN, más oscuro: el mismo tono del
   disco con la luminosidad bajada hasta que se lee. Se distingue del botón
   sin gritar como el blanco — queda como grabado en el disco —, y así el
   contraste entre un nivel hecho y uno pendiente se ve de un vistazo sin
   que los hechos compitan por la atención.

   Antes cada isla llevaba el COMPLEMENTARIO PARTIDO de su disco, elegido de
   una paleta de tonos vivos. Contrastaba bien pero hacía lo contrario de lo
   que conviene: los niveles ya hechos eran los que más saltaban de la
   pantalla, y el que faltaba se perdía entre ellos.

   Dos cosas del cálculo que no son adorno, y están explicadas largo en el
   script que los genera:
     - La saturación tiene un mínimo. Oscurecer un disco poco saturado da
       GRIS, y el gris ya significa "bloqueado" en esta pantalla.
     - Cuatro discos (3, 8, 13 y 15) son tan oscuros que no hay lugar hacia
       abajo: por debajo de ellos ni el negro llega al piso de contraste.
       Ahí el número va hacia el otro lado y sale un tinte CLARO del mismo
       tono, que sigue siendo el color del botón y sigue siendo más suave
       que el blanco del nivel pendiente.

   Se regeneran con:  node scripts/level-number-colors.mjs
   Para mirarlos:     node scripts/preview-level-numbers.mjs
===================================================================== */
const LEVEL_NUMBER_DONE: Partial<Record<string, string>> = {
  island1:  "#244c5f",   // azul del disco, oscurecido      — 3.28:1
  island2:  "#153831",   // verde del disco, oscurecido     — 3.22:1
  island3:  "#d6aab1",   // rosa del disco, aclarado        — 3.22:1
  island4:  "#ba3f1c",   // terracota del disco, oscurecido — 3.22:1
  island5:  "#0c3362",   // azul del disco, oscurecido      — 3.24:1
  island6:  "#0f172b",   // índigo del disco, oscurecido    — 3.21:1
  island7:  "#55271a",   // teja del disco, oscurecida      — 3.21:1
  island8:  "#8dabc8",   // pizarra del disco, aclarada     — 3.21:1
  island9:  "#3f230f",   // naranja del disco, oscurecido   — 3.20:1
  island10: "#0b1d0b",   // verde del disco, oscurecido     — 3.21:1
  island11: "#320f18",   // frambuesa del disco, oscurecida — 3.20:1
  island12: "#0b0904",   // ocre del disco, oscurecido      — 3.21:1
  island13: "#cc9fd1",   // violeta del disco, aclarado     — 3.24:1
  island14: "#0a1b18",   // verdeazul del disco, oscurecido — 3.26:1
  island15: "#8ba4e1",   // azul del disco, aclarado        — 3.22:1
};

/** Color del número de un nivel COMPLETADO en ese mundo. La reserva es un
 *  pizarra oscuro, que es lo que corresponde sobre el botón `_default`: gris
 *  piedra. Ojo si se cambia — tiene que seguir siendo oscuro y no gris puro,
 *  porque el gris es el color del número BLOQUEADO. */
export function levelNumberDoneColor(worldId: string): string {
  return LEVEL_NUMBER_DONE[worldId] ?? "#26333f";
}


/* =====================================================================
   CHARACTER & SHIP PROGRESSION SKINS (unlocked by cumulative star total)
   Five phases per object (f1…f5). The account-wide star total picks the
   phase (see `getSkinPhaseIndex` in utils/progress): 0★→f1 · 5★→f2 · 10★→f3
   · 20★→f4 · 30★→f5. `t1` is the BASE tier; a future character evolution adds
   a `t2` set that restarts at f1 — drop the art in /skins as `<kind>-t2-f<n>`
   and add `skinTier(kind, "t2")` below. Files: optimised WebP under
   public/assets/edutic-art/skins/ (1024px, transparent).
===================================================================== */
const SKINS_DIR = "/assets/edutic-art/skins";

export type SkinKind = "male" | "female" | "ship";

function skinTier(kind: SkinKind, tier: string): string[] {
  return [1, 2, 3, 4, 5].map((f) => `${SKINS_DIR}/${kind}-${tier}-f${f}.webp`);
}

/** [tierIndex][phaseIndex] — tier 0 = base (`t1`). Index 0 → f1 … 4 → f5. */
export const characterSkins: Record<SkinKind, string[][]> = {
  male:   [skinTier("male", "t1")],
  female: [skinTier("female", "t1")],
  ship:   [skinTier("ship", "t1")],
};

/** Resolve a skin URL, clamping tier/phase into range so it never returns
 *  undefined even if thresholds or tier counts change later. */
export function skinUrl(kind: SkinKind, phaseIndex: number, tier = 0): string {
  const tiers = characterSkins[kind];
  const set = tiers[Math.min(Math.max(tier, 0), tiers.length - 1)];
  return set[Math.min(Math.max(phaseIndex, 0), set.length - 1)];
}

