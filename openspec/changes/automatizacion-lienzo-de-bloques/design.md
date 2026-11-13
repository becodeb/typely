# Design: Lienzo libre de bloques (Modo Automatización)

> Size note: the `sdd-design` 800-word budget is deliberately exceeded. The
> orchestrator required exact TypeScript, exact CSS values, exact verbatim doc
> replacements and a per-slice line budget so that `sdd-apply` re-derives
> nothing. Every section below is load-bearing.

## Technical Approach

Exploration's **Approach B**. `Programa = NodoPrograma[]` keeps its exact type
and changes only its *meaning*: it is now the chain hanging off the green START
block. Two sibling fields join it on `EstadoCampo` (`rutinas: NodoDef[]`,
`pilasSueltas: Pila[]`) plus one geometry side-table (`lienzo: Lienzo`).
`interprete.ts` and `expandir()` keep their signatures; `rutinasDe` keeps its
signature *and body* because `NodoDef[]` is already assignable to `Programa`.

Layering stays as it is today: `programa.ts` knows the AST and list algebra and
imports only `balance` + `limites`; `motor.ts` owns `EstadoCampo` and imports
types from `programa`. So `Pila` / `Punto` / `Lienzo` live in **motor.ts**, and
the whole-canvas capacity arithmetic lives in **programa.ts** as a structural
function that never names `Pila`.

---

## Architecture Decisions

| # | Decision | Alternatives rejected | Rationale |
|---|---|---|---|
| 1 | `programa` keeps its type; `rutinas`/`pilasSueltas` are siblings | Approach A (`Canvas { pilas, idInicio }`); Approach C (cosmetic x/y) | A rewrites every helper signature and every harness builder; C fails connectivity, capacity and execution gating |
| 2 | `Pila`/`Punto`/`Lienzo` in `motor.ts`, `capacidadDeLienzo` in `programa.ts` taking `readonly { nodos }[]` | `Pila` in `programa.ts` | `programa.ts` must stay free of world state; a structural parameter keeps the arithmetic pure and harness-reachable |
| 3 | Canvas coordinates live in `lienzo`, never on AST nodes | `x`/`y` fields on `NodoDef` | `validarNodo` would have to learn geometry, and geometry is *clamped* while nodes are *all-or-nothing* — two policies cannot share one validator |
| 4 | `expandir` gains an optional 4th param `rutinasLienzo: NodoDef[] = []` | a second `expandirCampo()` entry point | Additive and non-breaking: all 71 existing calls compile and behave identically; a second entry point would drift from the first |
| 5 | `cabeA` accepts a node **or a chain**; the tallest link decides | a separate `cabeCadenaA` | The whole chain lands in one list, so the link that does not fit vetoes all of them; one predicate cannot disagree with itself |
| 6 | Delete only on an intentional bin/palette hit; "no destination" is impossible | keep `alSoltar`'s `quitar(...)` fallback | On a free canvas "released over nothing" is the *normal* drop; deleting there would silently destroy a whole chain |
| 7 | Canvas layer uses `transform-origin: 0 0` (IslandDetailPage uses `center`) | mirror `center` verbatim | The island lens has no data in layer coordinates; ours does, and `(cx - r.left)/z` is only exact with a `0 0` origin |
| 8 | HUD (dots, recenter, bin) through `createPortal(document.body)` | absolute sibling inside `.auto-lienzo` | Settled decision 8, and `.auto-taller` has `backdrop-filter`, which turns `position: fixed` into relative-to-it (same trap `.auto-fantasma` already dodges). Cost: a `ResizeObserver` on the viewport |
| 9 | `def` is an isolated singleton at full colour, marked by **hat shape** | dim it like other unconnected stacks | `Hacer A` on the green chain really does run it; dimming would visually lie |
| 10 | Geometry clamps, node structure discards | clamp everything / discard everything | A bad pixel must never cost a partida; a malformed node must never produce a mutilated notebook (`programa.ts` rule 2) |

---

## Interfaces / Contracts

### New types (`motor.ts`)

```ts
export interface Punto { x: number; y: number }

/** Una pila suelta del lienzo: bloques encadenados que NO cuelgan del
 *  bloque verde, con su posición en coordenadas de lienzo. No se ejecuta,
 *  pero ocupa memoria igual (MVP.md §7). */
export interface Pila { id: string; x: number; y: number; nodos: NodoPrograma[] }

/** Dónde está cada cosa en el lienzo. La geometría vive APARTE del árbol:
 *  un nodo es lógica, no píxeles, y `validarPrograma` no tiene que
 *  aprender de coordenadas. */
export interface Lienzo {
  /** Id del bloque verde. Se persiste para resaltarlo y referenciarlo; si
   *  el snapshot trae uno que no cierra, se REGENERA — nunca se descarta
   *  la partida por eso. */
  idInicio: string;
  /** Ancla fija del bloque verde. Siempre (0, 0): el lienzo se define con
   *  el origen en el verde, así "recentrar" es volver la vista a cero. */
  inicio: Punto;
  /** Posición de cada `Mi rutina`, por el id de su nodo `def`. */
  rutinas: Record<string, Punto>;
}

export const PUNTO_INICIO: Punto = { x: 0, y: 0 };
/** Fila por defecto de las rutinas: a la derecha del verde, una debajo de
 *  otra, para que una partida migrada nunca las apile encima. */
export const puntoRutinaPorDefecto = (i: number): Punto => ({ x: 340, y: i * 200 });
export const lienzoInicial = (): Lienzo => ({ idInicio: nuevoId(), inicio: PUNTO_INICIO, rutinas: {} });
```

### `EstadoCampo` additions

```ts
export interface EstadoCampo {
  schemaVersion: 3;              // era 2
  lado: number;
  nave: EstadoNave;
  celdas: Celda[];
  saldos: Record<Mineral, number>;
  acumulado: number;
  cosechados: Record<Mineral, number>;
  niveles: Record<Mineral, number>;
  mejoras: Record<string, number>;
  /** La cadena que cuelga del bloque verde. Es lo ÚNICO que se ejecuta. */
  programa: Programa;
  /** Las definiciones: siempre raíz, siempre llamables, nunca en la cadena. */
  rutinas: NodoDef[];            // NUEVO
  /** Pilas inertes: se ven atenuadas y cuentan para la memoria. */
  pilasSueltas: Pila[];          // NUEVO
  lienzo: Lienzo;                // NUEVO
  mejorTasa: number;
  cosechas: Cosecha[];
  relojMs: number;
}
```

`estadoInicial()` seeds `schemaVersion: 3, rutinas: [], pilasSueltas: [],
lienzo: lienzoInicial()`. `origen`, `capacidad`, `msPorAccion`, `avanzarMundo`,
`ejecutarPaso`, `comprar`, `expandirCampo`, `reveladas` — **untouched**.

```ts
/** La memoria que ocupa TODO el lienzo. */
export function capacidadUsadaCampo(e: EstadoCampo): number {
  return capacidadDeLienzo(e.programa, e.rutinas, e.pilasSueltas);
}
```

### `programa.ts` — every changed / new signature

| Symbol | Before | After |
|---|---|---|
| `cabeA` | `(nodo: NodoPrograma, profundidad: number) => boolean` | `(nodo: NodoPrograma \| NodoPrograma[], profundidad: number) => boolean` |
| `expandir` | `(programa, maxPasos?, lado?)` | `(programa, maxPasos?, lado?, rutinasLienzo?: NodoDef[])` |
| `alturaDeCadena` | — | `(cadena: readonly NodoPrograma[]) => number` |
| `cortarDesde` | — | `(nodos: NodoPrograma[], id: string) => { arriba; agarrado } \| null` |
| `cortarEn` | — | `(programa: Programa, id: string) => { restante: Programa; agarrado: NodoPrograma[] } \| null` |
| `colocarCadena` | — | `(programa: Programa, cadena: NodoPrograma[], destino: Destino) => Programa` |
| `capacidadDeLienzo` | — | `(programa, rutinas?, pilasSueltas?: readonly { nodos: NodoPrograma[] }[]) => number` |
| `profundidadDestino` | — | private `(programa, destino) => number \| null` |
| `conListaDe` | — | private `(programa, donde, lista) => Programa` (extracted from `desplazarNodo`'s inline `reemplazar`) |

**Unchanged, verbatim**: `rutinasDe`, `capacidadUsada`, `entra`, `costoDeNodo`,
`alturaDe`, `validarPrograma`, `quitarNodo`, `buscarNodo`, `contiene`,
`profundidadDe`, `listaDe`, `estaAnidado`, `despuesDe`, `insertarAntes`,
`insertarEn`, `colocar`, `moverNodo`, `desplazarNodo`, `ramas`, `listaDeRama`,
`esContenedor`, `esDefinicion`, `esLlamada`, `esContador`, `nuevoId`,
`resolverVeces`, `Destino`, `Rama`, every node interface.

### `cortarDesde` — the grab primitive

```ts
/** Corta una lista en dos por el id: lo de arriba se queda, el bloque y
 *  TODO lo que cuelga debajo se va como UNA unidad. Es la semántica de
 *  Scratch, y es la única regla nueva del arrastre. Null si `id` no está
 *  en esa lista. */
export function cortarDesde(
  nodos: NodoPrograma[],
  id: string,
): { arriba: NodoPrograma[]; agarrado: NodoPrograma[] } | null {
  const i = nodos.findIndex((n) => n.id === id);
  if (i < 0) return null;
  return { arriba: nodos.slice(0, i), agarrado: nodos.slice(i) };
}

/** Lo mismo, pero buscando en cualquier cavidad del árbol: agarrar el
 *  segundo bloque de adentro de un `Repetir` también se lleva sus
 *  hermanos de abajo, sin sacarlos del contenedor. */
export function cortarEn(
  programa: Programa,
  id: string,
): { restante: Programa; agarrado: NodoPrograma[] } | null {
  const donde = listaDe(programa, id);
  if (!donde) return null;
  const corte = cortarDesde(donde.lista, id);
  if (!corte) return null;
  return { restante: conListaDe(programa, donde, corte.arriba), agarrado: corte.agarrado };
}
```

The three drops, expressed:

```ts
// 1 · empalmar en el medio de otra pila
const { restante, agarrado } = cortarEn(origen, id)!;
const destino = colocarCadena(otraPila, agarrado, { tipo: "antes", id: idDestino });

// 2 · pegar al final de otra pila (o de una cavidad)
const destino = colocarCadena(otraPila, agarrado, { tipo: "final" });
//               … o { tipo: "dentro", id: idContenedor, rama: "body" }

// 3 · caer como pila nueva
if (!cabeA(agarrado, 0)) return estado;   // el lienzo es profundidad 0
pilasSueltas = [...pilasSueltas, { id: nuevoId(), x, y, nodos: agarrado }];
```

```ts
/** Coloca una CADENA entera en un destino, en orden, o no coloca nada:
 *  una cadena que no entra jamás se parte a la mitad. */
export function colocarCadena(programa: Programa, cadena: NodoPrograma[], destino: Destino): Programa {
  if (cadena.length === 0) return programa;
  const prof = profundidadDestino(programa, destino);
  if (prof === null || !cabeA(cadena, prof)) return programa;
  let salida = colocar(programa, cadena[0], destino);
  if (salida === programa) return programa;
  for (let i = 1; i < cadena.length; i++) {
    // `despuesDe` ya sabe decir "antes de mi hermano siguiente, o al final
    // de mi lista": es exactamente "pegado abajo del anterior".
    const siguiente = colocar(salida, cadena[i], despuesDe(salida, cadena[i - 1].id));
    if (siguiente === salida) return programa;   // defensivo: `cabeA` ya lo cubrió
    salida = siguiente;
  }
  return salida;
}

function profundidadDestino(programa: Programa, d: Destino): number | null {
  if (d.tipo === "final") return 0;
  if (d.tipo === "antes") return profundidadDe(programa, d.id);
  const p = profundidadDe(programa, d.id);
  return p === null ? null : p + 1;
}
```

### `cabeA` generalised

```ts
/** La altura de la cadena es la del eslabón MÁS ALTO: todos caen en la
 *  misma lista, así que el que no entra decide por todos. */
export function alturaDeCadena(cadena: readonly NodoPrograma[]): number {
  let max = 0;
  for (const n of cadena) max = Math.max(max, alturaDe(n));
  return max;
}

/** ¿Cabe esto en una lista que está a `profundidad`? Acepta un nodo o una
 *  cadena entera. `Por siempre` y `Mi rutina` mantienen su regla propia en
 *  CUALQUIER eslabón: sólo al nivel del lienzo. */
export function cabeA(nodo: NodoPrograma | NodoPrograma[], profundidad: number): boolean {
  const cadena = Array.isArray(nodo) ? nodo : [nodo];
  for (const n of cadena) {
    if (n.type === "forever" && profundidad > 0) return false;
    if (n.type === "def" && profundidad > 0) return false;
  }
  return profundidad + alturaDeCadena(cadena) <= AJUSTES.maxProfundidad;
}
```

Single-node call sites (`insertarAntes`, `insertarEn`) compile and behave
byte-identically: a one-element chain's `alturaDeCadena` *is* `alturaDe`.

### Capacity composition + the PROGRESION §11 arithmetic

```ts
/** La memoria que ocupa TODO el lienzo: la cadena verde, las rutinas y las
 *  pilas sueltas. "Ocupado" dejó de querer decir "se ejecuta" (MVP.md §7):
 *  una idea guardada al costado también pesa, y por eso hay que decidir
 *  qué se tira. */
export function capacidadDeLienzo(
  programa: Programa,
  rutinas: readonly NodoDef[] = [],
  pilasSueltas: readonly { nodos: NodoPrograma[] }[] = [],
): number {
  return (
    capacidadUsada(programa) +
    capacidadUsada(rutinas as Programa) +
    pilasSueltas.reduce((s, p) => s + capacidadUsada(p.nodos), 0)
  );
}
```

Worked example (capacity 13 used):

| Field | Content | Sum |
|---|---|---|
| `programa` | `Repetir 4 [avanzar, cosechar]`, `Hacer A`, `Contador +1` | 1+1+1 + 1 + 1 = **5** |
| `rutinas` | `Mi rutina A [avanzar, cosechar, esperar]` | 1 + 3 = **4** |
| `pilasSueltas` | `[girar ←, cosechar]` = 2, `[Repetir 2 [esperar]]` = 2 | **4** |
| | | **13** |

**PROGRESION.md §11 invariant, verified across the split.** `Mi rutina A
[avanzar, cosechar, esperar]` costs `1 + capacidadUsada(body)` = `1 + 3 = 4`,
counted **once**, in `rutinas`. Three `Hacer A` on the green chain cost `1`
each = `3`. Total `4 + 3 = 7`. Three inlined copies cost `9`. `7 < 9` — the
same two numbers harness case R3 already asserts, because the sum is identical
and only the *partition* moved.

### Rutinas source

`rutinasDe(programa: Programa): Map<NombreRutina, NodoPrograma[]>` — **body and
signature unchanged**, including "the first definition of a letter wins".
`NodoDef[]` is assignable to `Programa`, so `rutinasDe(e.rutinas)` is a legal
call against today's code.

`interprete.ts` line 130 becomes (the only change in the file):

```ts
// Las definiciones viven en el lienzo (`e.rutinas`), no en la cadena
// verde. Se sigue mirando la cadena por compatibilidad: un programa
// armado a mano —el examen, o un v2 recién migrado en memoria— puede
// traerlas adentro, y las del lienzo ganan.
const rutinas = new Map([...rutinasDe(programa), ...rutinasDe(e.rutinas ?? [])]);
```

`crearInterprete(programa, e)` keeps its signature. `expandir` builds the same
merged map from its optional 4th parameter.

---

## Persistence: `CampoGuardado` and the v2→v3 path

`CampoGuardado = Omit<EstadoCampo, "nave">` — the type is unchanged, so it now
serialises three more keys and one bumped version:

```
schemaVersion: 3, lado, celdas, saldos, acumulado, cosechados, niveles,
mejoras, programa, rutinas, pilasSueltas, lienzo, mejorTasa, cosechas, relojMs
```

`nave` stays excluded (the ship always returns to the dock).

Exact `validarCampo` path:

```ts
const version = s.schemaVersion;
if (version !== 1 && version !== 2 && version !== 3) return null;

const programaCrudo = validarPrograma(s.programa ?? []);
if (!programaCrudo) return null;

let programa: Programa;
let rutinas: NodoDef[];
let pilasSueltas: Pila[];

if (version === 3) {
  const r = validarRutinas(s.rutinas);
  const p = validarPilas(s.pilasSueltas);
  if (!r || !p) return null;                       // nodo mal formado: se descarta ENTERO
  // Un `def` que quedó en la cadena verde (snapshot editado a mano) se
  // MUDA a `rutinas` en vez de tirar la partida: es geometría, no un nodo roto.
  rutinas = fusionarRutinas(r, programaCrudo.filter(esDefinicion));
  programa = programaCrudo.filter((n) => !esDefinicion(n));
  pilasSueltas = p;
} else {
  /* v1/v2 → v3. El orden plano viejo ERA el orden de ejecución, así que
     partirlo en dos no cambia lo que hace: las `Mi rutina` salen a
     `rutinas` (siempre fueron raíz y nunca produjeron un paso) y todo lo
     demás queda colgando del verde EN SU ORDEN ORIGINAL. Ninguna partida
     se pierde, la misma disciplina que la migración v1 → v2. */
  rutinas = fusionarRutinas([], programaCrudo.filter(esDefinicion));
  programa = programaCrudo.filter((n) => !esDefinicion(n));
  pilasSueltas = [];
}

/* El tope de nodos es del LIENZO entero, no de cada lista: con tres
   validaciones sueltas de 60 el total podría llegar a 180. */
if (capacidadDeLienzo(programa, rutinas, pilasSueltas) > AJUSTES.maxNodos) return null;

const lienzo = validarLienzo(s.lienzo, rutinas);
```

Helpers:

```ts
const MAX_PILAS = 24;
const LIENZO_MIN = -4000, LIENZO_MAX = 4000;
const recortarCoord = (v: unknown): number =>
  numeroFinito(v) ? Math.min(LIENZO_MAX, Math.max(LIENZO_MIN, Math.round(v))) : 0;
const validarPunto = (v: unknown, defecto: Punto): Punto => {
  if (typeof v !== "object" || v === null) return defecto;
  const o = v as Record<string, unknown>;
  return { x: recortarCoord(o.x), y: recortarCoord(o.y) };
};

/** `rutinas` sólo lleva `def`, y la PRIMERA definición de cada letra gana:
 *  la misma regla que `rutinasDe`, para que la corrida nunca sea ambigua. */
function fusionarRutinas(base: NodoDef[], extra: NodoDef[]): NodoDef[] {
  const vistas = new Set<NombreRutina>();
  const salida: NodoDef[] = [];
  for (const d of [...base, ...extra]) {
    if (vistas.has(d.rutina)) continue;
    vistas.add(d.rutina);
    salida.push(d);
  }
  return salida;
}

function validarRutinas(v: unknown): NodoDef[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;
  const lista = validarPrograma(v);          // profundidad 0: `def` es válido acá
  if (!lista || !lista.every(esDefinicion)) return null;
  return lista as NodoDef[];
}

function validarPilas(v: unknown): Pila[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;
  const salida: Pila[] = [];
  for (const p of v.slice(0, MAX_PILAS)) {
    if (typeof p !== "object" || p === null) return null;
    const o = p as Record<string, unknown>;
    const nodos = validarPrograma(o.nodos ?? []);
    if (!nodos) return null;                 // nodo roto: se descarta la partida
    if (nodos.length === 0) continue;        // pila vacía: no es un error, se tira
    if (nodos.some(esDefinicion)) return null; // una rutina nunca es pila suelta
    const id = typeof o.id === "string" && o.id.length > 0 && o.id.length <= 40 ? o.id : nuevoId();
    salida.push({ id, x: recortarCoord(o.x), y: recortarCoord(o.y), nodos });
  }
  return salida;
}

/** Geometría: se RECORTA, nunca se descarta. Una clave que no nombra
 *  ninguna rutina viva se cae sola —sólo se copian los ids vivos—, y una
 *  rutina sin coordenada recibe una de la fila por defecto. */
function validarLienzo(v: unknown, rutinas: NodoDef[]): Lienzo {
  const o = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  const idInicio =
    typeof o.idInicio === "string" && o.idInicio.length > 0 && o.idInicio.length <= 40
      ? o.idInicio
      : nuevoId();
  const crudo = (typeof o.rutinas === "object" && o.rutinas !== null ? o.rutinas : {}) as Record<string, unknown>;
  const posiciones: Record<string, Punto> = {};
  rutinas.forEach((d, i) => { posiciones[d.id] = validarPunto(crudo[d.id], puntoRutinaPorDefecto(i)); });
  return { idInicio, inicio: validarPunto(o.inicio, PUNTO_INICIO), rutinas: posiciones };
}
```

Return object: `{ schemaVersion: 3, …, programa, rutinas, pilasSueltas, lienzo, … }`.

---

## The 2D snap and hit-test (replacing 1D `calcularDestino`)

New destination type:

```ts
type RefPila =
  | { donde: "verde" }
  | { donde: "rutina"; id: string }    // el id del nodo `def`
  | { donde: "suelta"; id: string };   // el id de la Pila

type DestinoLienzo =
  | { tipo: "cadena"; pila: RefPila; destino: Destino }  // encastra
  | { tipo: "nueva"; x: number; y: number }             // cae como pila suelta
  | { tipo: "papelera" }
  | { tipo: "paleta" }
  | { tipo: "nocabe" };                                  // encastre válido, no cabe
```

`calcularDestinoLienzo(cx, cy, a)` resolves in this order, first match wins:

1. **Papelera** — pointer inside `[data-papelera]`'s client rect → `{tipo:"papelera"}`.
2. **Paleta** — pointer inside `.auto-caja`'s client rect → `{tipo:"paleta"}`.
   Both are explicit rect tests, because "off-canvas" and "over the palette"
   stop being the same region.
3. **Connector proximity** — collect connector points from every stack's DOM
   in **client space** (rects are already transformed, so no division is
   needed — CLAUDE.md §6.1):
   - top-left of a `[data-nodo]` rect → `{tipo:"antes", id}`
   - bottom-left of that rect → `despuesDe(lista, id)`
   - the cavity mouth of a container, read from the existing
     `[data-parte="lomo" | "brazo" | "brazo-medio"]` rects → `{tipo:"dentro", id, rama}`
   Sort containers deepest-first with the existing `data-nivel` comparator, take
   the nearest connector within `RADIO_ENCASTRE = 28` CSS px of the dragged
   chain's top-left corner (`cx - a.dx`, `cy - a.dy`), then apply today's
   `conCabida` guard with `cabeA(a.cadena, prof)`. Result `{tipo:"cadena"}` or
   `{tipo:"nocabe"}`. The existing "over the open hueco → keep the destination"
   rule survives verbatim: it exists to stop 20 Hz flapping and still does.
4. **Otherwise** `{tipo:"nueva", ...aLienzo(cx - a.dx, cy - a.dy)}`, clamped into
   the visible canvas. **There is no `null`.**

Previews, three visually distinct things:

| Situation | Preview | Class |
|---|---|---|
| Connector hit | the existing coloured, pulsing block silhouette, now rendered inside whichever stack owns the destination | `.auto-bloque--marca` (unchanged) |
| Lands as a new stack | **new** dashed unfilled outline at the prospective landing point, sized to the chain's bounding box, inside the transform layer | `.auto-contorno` |
| Bin / palette hit | no hueco, no outline — the bin or palette lights up instead | `.auto-papelera--activa` / `.auto-caja--recibe` |
| `nocabe` | nothing opens; the chain returns | — |

---

## The `alSoltar` inversion

Today's `else { quitar(a.origen.id) }` is **deleted**. New structure:

```ts
const alSoltar = useCallback(() => {
  const a = arrastreRef.current;
  const d = destinoRef.current;
  limpiar();
  if (!a) return;                       // fue un toque: el `click` se encarga
  const api = propsRef.current;

  /* BORRAR es ahora un acto DELIBERADO. Antes, "soltar sin destino"
     quitaba la pieza; en un lienzo libre eso es justamente el gesto
     normal —dejarla en un lugar vacío— y hubiera hecho desaparecer la
     cadena entera sin que nadie la mandara a ningún lado. */
  if (d?.tipo === "papelera" || d?.tipo === "paleta") {
    if (a.origen.desde === "lienzo") api.onBorrarCadena(a.origen.ref, a.origen.id);
    // desde la caja no llegó a existir: no hay nada que borrar
  } else if (d?.tipo === "nocabe") {
    // donde no cabe no pasa nada: la cadena vuelve a donde estaba
  } else if (d?.tipo === "cadena") {
    if (a.origen.desde === "caja") api.onAgregar(a.origen.tipo, d.pila, d.destino);
    else api.onMoverCadena(a.origen.ref, a.origen.id, d.pila, d.destino);
  } else if (d?.tipo === "nueva") {
    if (a.origen.desde === "caja") api.onSoltarNueva(a.origen.tipo, d.x, d.y);
    else api.onSoltarCadena(a.origen.ref, a.origen.id, d.x, d.y);
  }
  // no hay rama `else`: `calcularDestinoLienzo` nunca devuelve null.
  setTimeout(() => { ignorarClick.current = false; }, 0);
}, [limpiar]);
```

Tap-to-remove is **untouched**: tapping a placed block still calls
`onQuitar(ref, id)` → `quitarNodo`, removing exactly that one node while the
chain rejoins. That remains the way to delete a single block from the middle
without dragging.

---

## Pan / zoom, concretely

**Which element carries the transform.** `.auto-lienzo` becomes the *viewport*
(`position: relative; overflow: hidden` — it loses `overflow: auto`, because a
scroller under a transform fights the pan). Inside it, one child
`.auto-lienzo__capa` carries `transform: translate(x,y) scale(z)` with
`transform-origin: 0 0`. Stacks are absolutely positioned inside that layer at
`left: x; top: y` in canvas px. Mirrors IslandDetailPage's rule: the transform
goes on **its own layer**, never on the element that already animates
`transform`.

**Mirrored symbols** (IslandDetailPage → EditorBloques):

| IslandDetailPage | Here | Change |
|---|---|---|
| `view {z,x,y}` | `vista {z,x,y}` | `ZOOM_MIN = 0.6`, `ZOOM_MAX = 2.4` |
| `zoomAt(nextZ, sx, sy)` | `acercarEn(z, sx, sy)` | same anchor-preserving body; clamp derived from the union of stack bounding boxes + margin instead of `((z-1)*r.width)/2`, because origin is `0 0` and the canvas is unbounded |
| `resetView()` | `recentrar()` | `setVista({ z: 1, x: MARGEN, y: MARGEN })` — brings the green anchor `(0,0)` back into view. This is decision 9's recenter affordance |
| `pctFromClient` | `aLienzo` | see below |
| pinch `alTocar`/`alMover`/`alSoltar` `TouchEvent` block | copied in shape | native listeners, `touchmove` with `{passive:false}` + `preventDefault` (React registers passive) |
| `onWheel` native listener | `alRodar` | `{passive:false}`, gated on `!corriendo` |
| `enHud(t)` guard | `enHud` | same `t instanceof Element && t.closest("[data-hud]")` |
| pan `onDown/onMove/onUp` on `window` | same | see disambiguation below |
| `centrarEn` | not needed | `recentrar` covers it |

**Coordinate conversion.**

```ts
/** De coordenadas de pantalla a coordenadas de LIENZO. Mide la capa YA
 *  transformada, igual que `pctFromClient` en IslandDetailPage: como
 *  `getBoundingClientRect()` devuelve el rectángulo transformado, la
 *  cuenta no necesita conocer el corrimiento, sólo la escala. Por eso el
 *  `transform-origin` de la capa es `0 0` y no `center`. */
function aLienzo(cx: number, cy: number): Punto | null {
  const capa = capaRef.current;
  if (!capa) return null;
  const r = capa.getBoundingClientRect();
  return { x: (cx - r.left) / vistaRef.current.z, y: (cy - r.top) / vistaRef.current.z };
}
const aPantalla = (p: Punto, r: DOMRect, z: number) => ({ x: r.left + p.x * z, y: r.top + p.y * z });
```

Everything else stays in client space. Block-vs-block hit-testing keeps using
`getBoundingClientRect()` untouched at any zoom — the guarantee CLAUDE.md §6.1
already documents and §6.2 repeats. Canvas coordinates are needed in exactly two
places: the `{tipo:"nueva"}` drop point and the ghost outline's position.

**HUD via portal.** Memory dots, recenter button and bin render through
`createPortal(…, document.body)` as `position: fixed`, positioned from the
viewport's `getBoundingClientRect()` refreshed by a `ResizeObserver` on
`.auto-lienzo`. Two reasons: the lens must not magnify the HUD, and
`.auto-taller` carries `backdrop-filter`, which turns `position: fixed` into
relative-to-it — the exact trap `.auto-fantasma` already portals around.

**Tap vs pan.** Mirrors IslandDetailPage's `onDown` guard with one selector
swapped (`[data-level-node]` → `[data-nodo]`):

```ts
function alBajar(ev: PointerEvent) {
  if (propsRef.current.corriendo) return;
  if (enHud(ev.target)) return;
  // Tocar un bloque ARRASTRA el bloque; tocar el vacío RECORRE el lienzo.
  if (ev.target instanceof Element && ev.target.closest("[data-nodo]")) return;
  ev.preventDefault();
  paneoRef.current = { sx: ev.clientX, sy: ev.clientY, bx: vista.x, by: vista.y };
}
```

The block-drag path (`agarrar` + `UMBRAL_ARRASTRE = 7`) is untouched, so a
clumsy tap is still a tap.

**Layout survives.** `.auto-pantalla`'s grid, `.auto-taller`'s
`auto minmax(0,1fr)` (palette + canvas) and `.auto-campo`'s `grid-column: 2`
are all untouched: three columns, field panel not shrunk. The canvas gains 2D
room through a *viewport*, not by stealing width — which is what makes the
1366×768 no-scroll fit survive. The bin sits at the canvas viewport's
bottom-left; `Volver` lives in `.auto-cabecera` (grid row 1, normal flow, never
over the canvas), so they cannot collide at any height.

---

## The five simultaneous visual states

| State | Opacity | Saturation | Shape | Duration | Where |
|---|---|---|---|---|---|
| Comprado/activo | 1 | 1 | notch + tab | permanent | anywhere |
| Levantado (mid-drag) | **0.28** | **0.4** | notch + tab | ~0.5 s | the source only |
| Suelto (loose) | **0.72** | **0.92** | notch + tab + **dashed halo** | permanent | loose stacks only |
| Memoria llena (grey) | 1 | **0** | notch + tab | while full | **palette only** |
| Corriendo (pulse) | 1 | 1 | notch + tab | while running | green chain only |
| `Mi rutina` (def) | 1 | 1 | **hat** | permanent | its own singleton |

```css
/* Suelto: NO cuelga del bloque verde, así que no se ejecuta. Atenuado,
   nunca gris —el gris dice "no se puede"— y con la saturación casi
   intacta, que es lo que lo separa del levantado (0.28 y desaturado, y
   además dura medio segundo). El sello punteado lo dice sin depender del
   color, para el que no distingue una atenuación de otra. */
.auto-pila--suelta { position: absolute; opacity: 0.72; }
.auto-pila--suelta .auto-bloque,
.auto-pila--suelta .auto-repetir__lomo,
.auto-pila--suelta .auto-repetir__brazo { filter: saturate(0.92) brightness(0.97); }
.auto-pila--suelta::before {
  content: "";
  position: absolute; inset: -6px -6px -6px -8px;
  border-radius: 18px;
  border: 2px dashed rgba(83, 107, 255, 0.3);
  pointer-events: none;
}

/* Memoria llena: la paleta se apaga. Es un gris de humo, NO el gris de
   "bloqueado" del mapa de mundos (CLAUDE.md §6.4): conserva el dibujo a
   plena opacidad y no lleva candado, así dice "no hay lugar ahora" y no
   "esto no es tuyo". El mensaje lo terminan de dar los puntos en rojo. */
.auto-caja--llena .auto-bloque {
  --auto-color: #9aa6bf;
  filter: grayscale(1) drop-shadow(0 3px 0 #6f7c96);
  cursor: not-allowed;
}
.auto-caja--llena .auto-bloque:hover {
  transform: none;
  filter: grayscale(1) drop-shadow(0 3px 0 #6f7c96);
}
.auto-luz--llena {
  background: linear-gradient(160deg, #ff9fca, #f0466f);
  box-shadow: 0 0 9px rgba(240, 70, 111, 0.75);
}
.auto-memoria--tope { background: #ffe4ec; border-color: #f0466f; }

/* `Mi rutina` es un SOMBRERO: tapa redondeada y sin muesca arriba, que es
   la forma de decir "acá no encastra nada". Va a todo color aunque no
   cuelgue del verde, porque `Hacer A` sí la encuentra: atenuarla mentiría. */
.auto-repetir--sombrero > .auto-repetir__lomo {
  border-radius: 26px 26px 10px 10px;
  padding-top: 10px;
  clip-path: none;
}
.auto-repetir--sombrero > .auto-repetir__lomo::before {
  content: "";
  position: absolute; left: 18px; top: -9px; width: 74px; height: 18px;
  border-radius: 999px 999px 0 0;
  background: color-mix(in srgb, var(--auto-tono) 78%, #fff);
}

/* El bloque verde: ancla fija del lienzo, también con forma de sombrero.
   No se arrastra —no lleva `data-nodo`— sólo su cadena. */
.auto-inicio {
  --auto-tono: #22c7b8;
  position: absolute;
  border-radius: 26px 26px 10px 10px;
  box-shadow: 0 0 0 3px rgba(84, 232, 198, 0.35), 0 10px 22px rgba(54, 86, 134, 0.28);
}

/* El contorno fantasma: "acá va a caer como pila nueva". Sin relleno de
   bloque y sin latido, para que no se confunda con el hueco. */
.auto-contorno {
  position: absolute;
  border-radius: 14px;
  border: 2.5px dashed rgba(84, 232, 198, 0.85);
  background: rgba(84, 232, 198, 0.12);
  pointer-events: none;
}

/* El tachito. 56 px: por encima del piso táctil de 44 (CLAUDE.md §6.5). */
.auto-papelera {
  position: fixed;
  width: 56px; height: 56px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  border: 2px solid rgba(130, 140, 190, 0.28);
  color: #52658f;
  display: grid; place-items: center;
}
.auto-papelera--activa {
  background: linear-gradient(150deg, #ff9fca, #f0466f);
  color: #fff;
  transform: scale(1.12);
  box-shadow: 0 0 0 6px rgba(240, 70, 111, 0.22);
}
.auto-caja--recibe { box-shadow: inset 0 0 0 2px rgba(240, 70, 111, 0.55); }

.auto-lienzo { overflow: hidden; }              /* era `auto` */
.auto-lienzo__capa { position: absolute; inset: 0; transform-origin: 0 0; }
.auto-recentrar { position: fixed; width: 44px; height: 44px; border-radius: 999px; }
```

`.auto-repetir--levantado { opacity: 0.28; filter: saturate(0.4); }` and
`.auto-bloque--activo`'s `auto-late` keyframes are **not touched**. New
`prefers-reduced-motion` entries: `.auto-papelera--activa { transform: none; }`
and `.auto-contorno { animation: none; }`.

---

## Data Flow

```
localStorage ──validarCampo(v1|v2|v3)──▶ EstadoCampo { programa, rutinas, pilasSueltas, lienzo }
                                              │
              ┌───────────────────────────────┼──────────────────────────────┐
              ▼                               ▼                              ▼
       AutomatizacionPage            EditorBloques (lienzo)         crearInterprete(e.programa, e)
       capacidadUsadaCampo(e) ──────▶ usada / capacidad gate            │
       cambiarCampo(fn)      ◀────── on{Mover,Soltar,Borrar}Cadena      │  rutinasDe(programa)
              │                                                         │+ rutinasDe(e.rutinas)
              └──────── guardador.pedir(usuario, e, true) ──────────────▶ Paso ▶ ejecutarPaso
```

Only `e.programa` reaches the interpreter's frame stack. A stray `Hacer A` on a
loose stack is therefore correctly never run — the internal consistency
exploration already noted.

---

## File Changes

| File | Action | Description |
|---|---|---|
| `src/utils/automatizacion/programa.ts` | Modify | `cortarDesde`, `cortarEn`, `colocarCadena`, `alturaDeCadena`, `capacidadDeLienzo`, `profundidadDestino`, `conListaDe`; generalised `cabeA`; optional 4th param on `expandir`; header comment (the notebook is now a canvas) |
| `src/utils/automatizacion/motor.ts` | Modify | `Punto`/`Pila`/`Lienzo`, `PUNTO_INICIO`, `puntoRutinaPorDefecto`, `lienzoInicial`, `capacidadUsadaCampo`; `EstadoCampo` v3 + 3 fields; `estadoInicial` seeds them |
| `src/utils/automatizacion/interprete.ts` | Modify | One line + comment: merge `rutinasDe(e.rutinas)`. Signatures unchanged |
| `src/utils/automatizacion/almacenamiento.ts` | Modify | v3 gate, `validarRutinas`/`validarPilas`/`validarLienzo`/`validarPunto`/`fusionarRutinas`, v1|v2→v3 split, canvas-wide node bound, header comment |
| `src/components/automatizacion/EditorBloques.tsx` | Modify | Viewport + transform layer, `aLienzo`, `acercarEn`, `recentrar`, pinch/wheel/pan, HUD portal, green START, hat `def`, `calcularDestinoLienzo`, ghost outline, `alSoltar` inversion, bin, palette-drop, capacity-grey, `RefPila` in every callback |
| `src/components/automatizacion/IconosAuto.tsx` | Modify | `IcoTachito`, `IcoRecentrar`, `IcoInicio` (CSS/SVG-drawn, per CLAUDE.md §15) |
| `src/pages/automatizacion/AutomatizacionPage.tsx` | Modify | `cambiarCampo` replaces `cambiarPrograma`; chain handlers; `capacidadUsadaCampo` gate |
| `src/styles/global.css` | Modify | `.auto-lienzo` viewport, `.auto-lienzo__capa`, `.auto-pila--suelta`, `.auto-inicio`, `.auto-repetir--sombrero`, `.auto-contorno`, `.auto-papelera`, `.auto-caja--llena`, `.auto-luz--llena`, reduced-motion additions |
| `scripts/probar-automatizacion.mjs` | Modify | New `EL LIENZO` section (19 cases); rewrite R8 and M8 |
| `docs/modo-automatizacion/MVP.md` | Modify | §5, §7 |
| `docs/modo-automatizacion/IMPLEMENTACION.md` | Modify | §3, §4, §7 |
| `docs/modo-automatizacion/PROGRESION.md` | Modify | §5, §10, §11 |

No new packages. No API, DB, auth or deploy surface.

---

## Testing Strategy

There is **no test runner** in this repo — no vitest, jest, playwright or
cypress in either `package.json`. The two gates are:

| Gate | Command | Scope |
|---|---|---|
| Types + build | `npm run build` (`tsc --noEmit && vite build`) | everything |
| Engine harness | `node scripts/probar-automatizacion.mjs` | `src/utils/automatizacion/*`, `src/data/automatizacion/balance.ts` |
| Manual | 1366×768 Chromebook, touch, landscape | drag, pan, pinch, bin, palette-drop, 44 px floor |

### Which of the 71 existing assertions change

**Exactly two. Verified case by case against the code, which confirms and
sharpens exploration.md's "most should not".**

| Case | Why it changes |
|---|---|
| **R8** | Feeds `schemaVersion: 2` with `programa: [def A, call A]` and asserts `e.schemaVersion === 2` and `e.programa.map(type) === ["def","call"]`. Under v3 it becomes `schemaVersion === 3`, `e.programa === ["call"]`, `e.rutinas === ["def"]` |
| **M8** | Asserts `igual(e.schemaVersion, 2)` on a v1 snapshot → `3`. Everything else it checks (saldos, cosechas, niveles, mejoras, empty-soil round-trip) is untouched |

The other **69 stay verbatim**, for these reasons:

- `P.expandir`, `P.capacidadUsada`, `P.validarPrograma`, `P.colocar`,
  `P.moverNodo`, `P.quitarNodo`, `P.despuesDe`, `P.desplazarNodo`, `P.entra`
  all keep their signatures and behaviour for a bare `NodoPrograma[]`.
  → cases 1–21, D1–D5, I1–I7, R1–R7, C7–C8.
- `crearInterprete(prog, e)` takes `e` from `campoDe()` / `estadoInicial()`, so
  `e.rutinas` is `[]` and the merged map equals `rutinasDe(prog)` exactly.
  → R2, R4, R5, R6, C1–C7.
- `cabeA` is never called directly by the harness; through `colocar` a
  single-node chain is byte-identical. → D2's four assertions hold.
- Field, economy and mineral cases never read `programa`. → 1–11, 22–29,
  E1–E4, M1–M7.

### New cases, per slice

**Slice 1** — new section `EL LIENZO` (12): `cortarDesde` splits and rejoins,
`null` on an unknown id (L1); `cortarEn` cuts inside a cavity and leaves the
rest of the tree intact (L2); `colocarCadena` splices before a node preserving
order (L3); appends at `{tipo:"final"}` (L4); rejects the whole chain and
returns the same array identity when the tallest link does not fit (L5);
`cabeA` with a chain — the tallest link decides (L6); `cabeA` rejects a chain
carrying `forever`/`def` at depth > 0 (L7); `capacidadDeLienzo` = 5+4+4 = 13
(L8); the PROGRESION §11 invariant across the split, 7 < 9 (L9); v2→v3
migration keeps order and produces the **same** `expandir` steps as the flat
original (L10); clamping — NaN/huge `x`, missing `lienzo`, dangling
`lienzo.rutinas` key, and a broken node inside `pilasSueltas` discarding the
whole partida (L11); a canvas-wide over-count beyond `maxNodos` is rejected
(L12).

**Slice 2** (3): cut-then-place round-trip is identity (L13); a `def` can never
enter `pilasSueltas` (L14); dropping a chain as a new stack preserves node
identity and total capacity (L15).

**Slice 3** (4): deleting a chain removes exactly its `capacidadDeLienzo` delta
and nothing else (L16); an empty `Pila` is dropped on save/load (L17); the
capacity-full predicate is true iff `capacidadUsadaCampo(e) >= capacidad(e)`
(L18); a cross-stack keyboard move preserves total capacity (L19).

Harness total: 71 → 83 (slice 1) → 86 (slice 2) → 90 (slice 3).

---

## Threat Matrix

**N/A** — no routing, shell command, subprocess, VCS/PR automation,
executable-file classification, or process-integration boundary. The one
untrusted-input surface is the `localStorage` snapshot, and it is already
governed by `programa.ts`'s rule 2 (validate everything, discard entire) plus
the explicit clamp/discard split documented above; no matrix row applies.

---

## Migration / Rollout — three slices

Feature-branch chain on tracker branch `docs/modo-automatizacion-mvp`; PRs into
`dev`, never `production`. Session budget: **800 lines**. Each slice leaves the
game playable and both gates green.

### Slice 1 — motor (~595 lines)

| File | Symbols | Lines |
|---|---|---|
| `programa.ts` | `cortarDesde`, `cortarEn`, `colocarCadena`, `alturaDeCadena`, `capacidadDeLienzo`, `profundidadDestino`, `conListaDe`, `cabeA`, `expandir` | 150 |
| `motor.ts` | `Punto`, `Pila`, `Lienzo`, `PUNTO_INICIO`, `puntoRutinaPorDefecto`, `lienzoInicial`, `capacidadUsadaCampo`, `EstadoCampo`, `estadoInicial` | 55 |
| `interprete.ts` | `crearInterprete` (rutinas merge) | 10 |
| `almacenamiento.ts` | `validarCampo`, `validarRutinas`, `validarPilas`, `validarLienzo`, `validarPunto`, `fusionarRutinas`, `recortarCoord`, `CampoGuardado` comment | 150 |
| `AutomatizacionPage.tsx` | **puente temporal**: renders `EditorBloques` with `programa={[...e.rutinas, ...e.programa]}` and re-splits `def` out on every edit callback | 35 |
| `probar-automatizacion.mjs` | L1–L12, rewritten R8 + M8 | 150 |
| `MVP.md` §7, `PROGRESION.md` §11 | capacity language | 45 |

The **temporary bridge** is what makes this slice genuinely shippable: a
migrated v2 partida would otherwise move its `def` out of `programa`, and an
untouched editor would stop showing the child their own routine. With the
bridge, behaviour is identical while the model moves underneath. It is deleted
in slice 2.

### Slice 2 — lienzo (~705 lines)

| File | Symbols | Lines |
|---|---|---|
| `EditorBloques.tsx` | viewport + `.auto-lienzo__capa`, `aLienzo`, `aPantalla`, `acercarEn`, `recentrar`, `alRodar`, pinch handlers, `alBajar` pan, HUD portal + `ResizeObserver`, `.auto-inicio` render, hat `def`, `calcularDestinoLienzo` (connector snap + `nueva` + `nocabe`, **no** bin/palette yet), `.auto-contorno`, `alSoltar` inversion, `RefPila` threading, bridge removal | 420 |
| `AutomatizacionPage.tsx` | `cambiarCampo`, `onSoltarCadena`, `onMoverCadena`, `onSoltarNueva`, `onMoverPila`, `onAgregar(pila,destino)`, `capacidadUsadaCampo` gate | 90 |
| `IconosAuto.tsx` | `IcoInicio`, `IcoRecentrar` | 25 |
| `global.css` | `.auto-lienzo`, `.auto-lienzo__capa`, `.auto-pila--suelta`, `.auto-inicio`, `.auto-repetir--sombrero`, `.auto-contorno`, `.auto-hud`, `.auto-recentrar` | 110 |
| `probar-automatizacion.mjs` | L13–L15 | 40 |
| `MVP.md` §5, `IMPLEMENTACION.md` §4/§7 | layout + editor language | 45 |

Playable after slice 2: one green chain that runs, freely placed loose stacks
that land where dropped, `Mi rutina` at full colour as a hat singleton, pan and
zoom. Delete is still tap-to-remove only.

### Slice 3 — el resto (~425 lines)

| Piece | Lines |
|---|---|
| Bin: `IcoTachito`, `.auto-papelera`, hit-test, `onBorrarCadena` | 110 |
| Palette-drop hit-test against `.auto-caja`'s rect | 30 |
| Capacity-full: `.auto-caja--llena` + `.auto-luz--llena` + `.auto-memoria--tope` + the gate | 100 |
| Cross-stack keyboard: `Alt+↑/↓` attaches the focused chain to the previous/next stack's end, `Alt+Shift+↓` detaches it as a loose stack. `desplazarNodo` (within-stack `↑/↓`) is untouched | 90 |
| `probar-automatizacion.mjs` L16–L19 | 50 |
| `IMPLEMENTACION.md` §3, `PROGRESION.md` §5/§10 | 45 |

**Does slice 3 need sub-slicing? No** — at ~425 it is comfortably under 800.
The pre-planned cut, if it grows: **3a** = bin + palette-delete + capacity-grey
(~285) and **3b** = cross-stack keyboard (~140). 3b is the only piece with no
user-visible dependency on 3a.

**The slice actually at risk is slice 2 (~705).** Contingency cut: **2a** =
viewport, pan/zoom, HUD portal, green START, hat `def`, canvas rendering of all
three stack kinds, with the existing 1D `calcularDestino` scoped to the green
chain (~380); **2b** = 2D connector snap, ghost outline, `alSoltar` inversion
(~325). 2a alone is playable because drag still works on the green chain.

Forecast total ~1,725 changed lines, at the top of exploration's 1,000–1,700
band. `sdd-tasks` owns the formal guard lines.

### Rollback

The only durable artefact is `schemaVersion: 3`. Reverting slice 1 leaves v3
snapshots unreadable by v2 code, so a revert must either keep the v3 reader in
place or accept that a v3 partida resets. Slices 2 and 3 are UI-only and revert
independently.

---

## Documentation edits (Spanish, exact)

### `MVP.md` §5

**Current, line 92 (inside the ASCII block):**
```
│ PALETA       PROGRAMA                │     CAMPO 2×2       │
```
**Replacement:**
```
│ PALETA       LIENZO (se recorre)     │     CAMPO 2×2       │
```

**Current, lines 105–109:**
```
- Editor grande a la izquierda; campo a la derecha.
- Botón principal inmediatamente debajo del campo.
- Tienda como franja compacta inferior.
- Cabecera solo con volver, saldo y producción reciente.
- Campo y editor son las dos superficies dominantes; no anidar tarjetas.
```
**Replacement:**
```
- Editor grande a la izquierda; campo a la derecha.
- Botón principal inmediatamente debajo del campo.
- Tienda como franja compacta inferior.
- Cabecera solo con volver, saldo y producción reciente.
- Campo y editor son las dos superficies dominantes; no anidar tarjetas.
- El editor es un LIENZO con ventana propia: se acerca, se aleja y se
  recorre con el dedo. Las tres columnas —paleta, lienzo y campo— no
  cambian de ancho, y el campo no se achica para hacerle lugar.
- El bloque verde tiene un ancla fija en el lienzo y un botón para volver
  a encuadrarlo: nunca se puede perder de vista.
- Tachito abajo a la izquierda del lienzo, de 44 px como mínimo. No pisa
  el «Volver», que vive en la cabecera y nunca sobre el lienzo.
```

### `MVP.md` §7 — «Edición»

**Current, lines 158–163:**
```
- Tocar en paleta agrega al próximo espacio libre.
- Tocar un bloque colocado lo quita.
- Arrastrar reordena, pero nunca es la única forma de editar.
- Editor bloqueado mientras corre el programa.
- Bloque activo iluminado en sincronía con la nave.
- Si no hay capacidad, vibran las ranuras y brilla la mejora de memoria.
```
**Replacement:**
```
- Tocar en paleta agrega al final de la cadena verde.
- Tocar un bloque colocado lo quita —sólo ése, y la cadena se vuelve a unir.
- Arrastrar mueve el bloque Y TODO LO QUE CUELGA DEBAJO, y nunca es la
  única forma de editar.
- Soltar en un lugar vacío del lienzo deja la cadena ahí, suelta. Borrar es
  un acto aparte: el tachito, o soltar sobre la paleta. Los dos borran la
  cadena agarrada entera.
- Sólo se ejecuta lo que cuelga del bloque verde. Lo suelto se ve atenuado
  —nunca gris— y sigue ocupando memoria.
- `Mi rutina` se ve a todo color aunque no cuelgue del verde: `Hacer A` la
  encuentra igual. Se distingue por la forma de sombrero, no por el color
  ni por la opacidad.
- Editor bloqueado mientras corre el programa.
- Bloque activo iluminado en sincronía con la nave.
- Si no hay capacidad, vibran las ranuras, los puntos se ponen rojos y la
  paleta se apaga en gris.
```

### `MVP.md` §7 — «Capacidad»

**Current, lines 167–170:**
```
- Inicial provisional: 3 bloques.
- Representar con chips, ranuras o luces.
- Cada acción y cada contenedor `Repetir` ocupan una unidad; también cuentan sus
  bloques interiores.
```
**Replacement:**
```
- Inicial provisional: 3 bloques.
- Representar con chips, ranuras o luces.
- Cada acción y cada contenedor `Repetir` ocupan una unidad; también cuentan sus
  bloques interiores.
- La memoria cuenta TODO el lienzo: la cadena verde, las rutinas y las pilas
  sueltas. «Ocupado» ya no quiere decir «se ejecuta»: una idea guardada al
  costado también pesa, y por eso hay que decidir qué se tira.
```

### `IMPLEMENTACION.md` §3

**Current, lines 51–52:**
```ts
type ProgramNode = ActionNode | RepeatNode;
type Program = ProgramNode[];
```
**Replacement:**
```ts
type ProgramNode = ActionNode | RepeatNode;
type Program = ProgramNode[];

/** El lienzo. `Program` NO cambia de tipo: ahora significa «la cadena que
 *  cuelga del bloque verde». */
type Stack = { id: string; x: number; y: number; nodos: ProgramNode[] };
type Canvas = {
  programa: Program;      // lo único que se ejecuta
  rutinas: DefNode[];     // definiciones: siempre raíz, siempre llamables
  pilasSueltas: Stack[];  // inertes y atenuadas, pero cuentan para la memoria
};
```

**Current, line 58:**
```
- Cada acción y contenedor cuenta para capacidad; también su contenido.
```
**Replacement:**
```
- Cada acción y contenedor cuenta para capacidad; también su contenido, y
  también lo que quedó suelto en el lienzo.
```

### `IMPLEMENTACION.md` §4

**Current, line 76:**
```ts
  schemaVersion: 1;
```
**Replacement:**
```ts
  schemaVersion: 3;
```

**Current, line 82:**
```ts
  program: Program;
```
**Replacement:**
```ts
  program: Program;        // la cadena que cuelga del bloque verde
  routines: DefNode[];
  looseStacks: Stack[];
  canvasView: { startId: string; start: Point; routines: Record<string, Point> };
```

**Current, lines 89–90:**
```
`running` no se persiste. El snapshot cargado siempre inicia detenido en
`{ row: 1, col: 0, direction: "north" }`.
```
**Replacement:**
```
`running` no se persiste. El snapshot cargado siempre inicia detenido en
`{ row: 1, col: 0, direction: "north" }`.

Un snapshot v1/v2 se lee como v3: las `Mi rutina` salen a `routines` y todo
lo demás, EN SU ORDEN ORIGINAL, queda colgando del bloque verde. El orden
plano viejo ERA el de ejecución, así que la partida migrada se comporta
igual. Las coordenadas que no cierran se RECORTAN y una referencia colgante
se descarta; un nodo mal formado, en cambio, sigue invalidando el snapshot
entero.
```

### `IMPLEMENTACION.md` §7

**Current, lines 141–147:**
```
- Tap en paleta: insertar al final o dentro del destino activo.
- Tap en bloque colocado: quitar.
- Drag: reordenar, con alternativa de teclado.
- `Repetir`: cavidad y número; debe verse si el próximo bloque entra dentro.
- Un solo nivel de anidamiento expuesto en el MVP.
- Verificar capacidad antes de insertar.
- Durante ejecución no se edita.
```
**Replacement:**
```
- Tap en paleta: insertar al final de la cadena verde o dentro del destino activo.
- Tap en bloque colocado: quitar ese bloque; la cadena se vuelve a unir.
- Drag: agarra el bloque y todo lo que cuelga debajo, y lo lleva a otra pila
  o a un lugar vacío del lienzo. Con alternativa de teclado.
- Soltar sin encastre NO borra: deja la cadena suelta donde se soltó. Borrar
  exige el tachito o la paleta, y borra la cadena entera.
- El lienzo tiene ventana propia (acercar, alejar, recorrer). El toque sobre
  el vacío recorre; el toque sobre un bloque arrastra.
- `Repetir`: cavidad y número; debe verse si el próximo bloque entra dentro.
- Un solo nivel de anidamiento expuesto en el MVP.
- Verificar capacidad —la de TODO el lienzo— antes de insertar.
- Durante ejecución no se edita.
```

### `PROGRESION.md` §5

**Current, lines 131–136:**
```
La lógica dentro de un `Si` o un `Mientras` es una **pastilla** que encaja
en la ranura del contenedor: se elige tocándola (cicla entre los sensores
comprados) o arrastrándola desde la caja. `es [color]` y `Plantar [color]`
muestran el cristal mismo, no una palabra. Un solo nivel de anidamiento
sigue valiendo para `Repetir` dentro de `Por siempre`; `Si` puede ir adentro
de cualquiera. Profundidad máxima 2.
```
**Replacement:** the same paragraph, followed by a new one:
```
La lógica dentro de un `Si` o un `Mientras` es una **pastilla** que encaja
en la ranura del contenedor: se elige tocándola (cicla entre los sensores
comprados) o arrastrándola desde la caja. `es [color]` y `Plantar [color]`
muestran el cristal mismo, no una palabra. Un solo nivel de anidamiento
sigue valiendo para `Repetir` dentro de `Por siempre`; `Si` puede ir adentro
de cualquiera. Profundidad máxima 2.

La profundidad máxima 2 no cambia con el lienzo, pero ahora la mide la
CADENA: agarrar un bloque se lleva todo lo que cuelga debajo, y lo que decide
si entra es el eslabón MÁS ALTO, no el primero. Una cadena que lleve un `Por
siempre` o una `Mi rutina` sólo puede caer al nivel del lienzo, nunca dentro
de una cavidad.
```

### `PROGRESION.md` §10

**Current, line 260:**
```
5. **Escala** (§4 era 5): isla 5×5 ilustrada, segunda nave. **Pendiente.**
```
**Replacement:**
```
5. **Lienzo libre** (§5, §11): el editor deja de ser una lista y pasa a ser un
   lienzo 2D con un bloque verde de arranque; agarrar se lleva la cadena
   entera; lo suelto no se ejecuta pero ocupa memoria; el tachito y la paleta
   borran; `schemaVersion` 3 con migración. **Pendiente.**
6. **Escala** (§4 era 5): isla 5×5 ilustrada, segunda nave. **Pendiente.**
```

### `PROGRESION.md` §11

**Current, lines 273–274:**
```
- [ ] Una rutina definida una vez y llamada tres veces ocupa menos memoria
      que las tres copias.
```
**Replacement:**
```
- [ ] Una rutina definida una vez y llamada tres veces ocupa menos memoria
      que las tres copias, esté donde esté en el lienzo.
- [ ] Un bloque se suelta en cualquier parte del lienzo y se queda ahí, y
      agarrarlo se lleva ese bloque y todo lo que cuelga abajo.
- [ ] Sólo lo conectado al bloque verde se ejecuta; lo suelto se ve atenuado,
      nunca gris, y las `Mi rutina` a todo color.
- [ ] Al llenar la memoria —contando lo suelto— los puntos se ponen rojos y
      la paleta se apaga; no se puede tomar otro bloque.
- [ ] Una partida guardada en v2 se abre en v3 y se comporta igual.
```

---

## Open Questions

- [ ] `MAX_PILAS = 24` and the `±4000` canvas clamp are first guesses. They are
      hard bounds against a hand-edited snapshot, not game knobs, so they stay
      out of `balance.ts` — the same reasoning as `MAX_LLAMADAS_ANIDADAS`.
      Confirm 24 is generous enough at capacity 15.
- [ ] `RADIO_ENCASTRE = 28` px needs one touch pass on the Chromebook. Too small
      is unreachable with a finger; too large steals the "lands as a new stack"
      drop next to an existing chain.
- [ ] Cross-stack keyboard chords (`Alt+↑/↓`, `Alt+Shift+↓`) are designed, not
      validated. `Alt+←` is the browser's Back, so the handler must
      `preventDefault` before checking the selection — the same trap
      `LevelPositionEditor` documents (CLAUDE.md §6.1).
