# Exploration: free canvas for the block editor

## Current state — `Programa` is a flat ordered list

`programa.ts` defines `export type Programa = NodoPrograma[]`. The root is one
linear array and **execution order IS array order**. Containers
(`repeat/forever/while/if/def`) hold nested bodies via `ramas()`/`listaDeRama()`/
`conRama()` — that nesting is orthogonal to the root-list problem and does not
need to change.

### Call sites that assume one root sequence

Each is real work:

- `capacidadUsada(programa)` — sums root + recursive bodies; assumes one root list is the whole program.
- `rutinasDe(programa)` — scans the root array for `def` siblings.
- `validarPrograma` / `validarLista` — validates one array as the whole program.
- `expandir(programa, …)` — walks the root array as literal execution order.
- `quitarNodo`, `buscarNodo`, `contiene`, `profundidadDe`, `listaDe`, `despuesDe`.
- `insertarAntes`, `insertarEn`, `colocar`, `moverNodo`, `desplazarNodo`.
- `interprete.ts::crearInterprete` — seeds its frame stack with `{ lista: programa, i: 0, … }`; "end of root list" means "program finished". No concept of root content that never runs.
- `almacenamiento.ts::validarCampo` — persists/validates `programa: Programa` as a flat array (schemaVersion 2).
- `motor.ts::EstadoCampo.programa: Programa`.
- `EditorBloques.tsx` (~1030 lines) — the whole pointer-drag "hueco" preview (`calcularDestino`) is 1D vertical hit-testing inside one `.auto-pila` column.
- `AutomatizacionPage.tsx` — wires `e.programa` into the editor, the interpreter, and the capacity gate.
- `scripts/probar-automatizacion.mjs` (924 lines, 71 assertions) — every builder (`acc`, `rep`, `si`, `mientras`, `siempre`, `def`, `llamar`, …) constructs a bare `NodoPrograma[]` and feeds it to `crearInterprete`/`validarPrograma`/`expandir`/`capacidadUsada`. A first-class call site.

## Data shape options

### Approach A — unified `Canvas` type

```ts
interface Pila { id: string; x: number; y: number; nodos: NodoPrograma[] }
interface Canvas { pilas: Pila[]; idInicio: string | null }
```

One uniform literal model, but every helper signature changes — the biggest
`EditorBloques` and test-harness diff.

### Approach B — parallel fields, `Programa` stays narrow (RECOMMENDED)

```ts
interface EstadoCampo {
  programa: NodoPrograma[];   // unchanged type — the chain hanging off START
  rutinas: NodoDef[];         // definitions: always root, always callable
  pilasSueltas: Pila[];       // loose/dimmed stacks, each with id + x/y
}
```

`interprete.ts` and `expandir()` need **zero signature changes**. `rutinasDe`
collapses to a `Map` built from `e.rutinas` — a simplification over today's tree
walk. Total capacity is
`capacidadUsada(programa) + rutinas.reduce(costoDeNodo) + pilasSueltas.reduce(p => capacidadUsada(p.nodos))`.
Most of the 71 existing assertions need no change. Biggest size lever available.

### Approach C — cosmetic-only canvas (REJECTED)

A non-authoritative `x`/`y` map that does not gate execution, connectivity or
capacity. Smallest diff, fails nearly every requirement.

## schemaVersion 3 and the migration

The v2→v3 migration is mechanical and behaviour-preserving: split every `def`
out of the old flat list into `rutinas`, and put everything else, in its original
relative order, into the green `programa` chain. Since the old flat order WAS the
execution order, the migrated program behaves exactly as before. No partida is
lost — same discipline as the existing v1→v2 migration.

## Capacity — a deliberate behaviour change

Today "capacity used" equals "capacity that will execute", because loose blocks
did not exist. On a free canvas, "used" stops meaning "runs". That is intended,
and must be stated as a spec change rather than slipped in.

The PROGRESION.md §11 invariant "a routine called three times costs less than
three copies" is **unaffected**: `Mi rutina A [body]` still costs
`1 + capacidadUsada(body)` once wherever it sits, and each `Hacer A` still costs 1.

## The `Mi rutina` tension

A `def` stack is never connected to START, yet is not inert — `Hacer A` on the
green chain must find and run it. Dimming everything not attached to green would
visually lie about definitions. This is the one place where the visual-state
taxonomy genuinely collides and needs its own answer.

Internally it is consistent: only the green chain feeds the interpreter, so a
stray `Hacer A` on a genuinely loose stack correctly never runs.

## Drag semantics

`moverNodo` relocates exactly one node today; there is no "stack below" concept.
Requirement 3 needs a new primitive: split a stack at a node, carrying it and
everything chained after it as a unit
(`cortarDesde(pila, id) → { arriba, agarrado }`), then splice the grabbed chain
into another stack, append it, or drop it as a new `Pila`. Depth checks (`cabeA`)
generalize from "does this node fit" to "does the tallest element of the chain
fit".

The 1D "hueco" preview becomes 2D proximity/snap detection, plus a new ghost
outline for "lands here as a new stack".

**Behavioural inversion, the riskiest single change:** today "no destination
while dragging" means DELETE (`alSoltar`'s fallback `quitar(...)`). On a free
canvas it must mean "place as a new loose stack here". Delete becomes an explicit
hit on the bin or the palette.

## Delete affordances

Dropping on the palette exists today only as a side-effect of "outside the
notebook"; it must become an intentional hit-test against `.auto-caja`'s rect,
because "off-canvas" and "over the palette" stop being the same region. The bin
is new UI (≥44px, bottom-left, must not collide with the top-left "Volver").

## Visual states — verified against the code

"Grey = locked" is real in the app (CLAUDE.md §6.4/§12) but is **not** used
inside Modo Automatización today: `EditorBloques`'s palette OMITS unpurchased
pieces (`...(compradas.si ? ["if"] : [])`) rather than greying them, and
`BarraMejoras.tsx` deliberately avoids grey/lock for unrevealed shop categories
("no es un candado ni una tarjeta gris"). So a capacity-grey palette introduces
grey-as-meaning here for the first time — no live collision, but it must not read
as "I don't own this" instead of "no room right now".

A third pre-existing dim meaning must stay distinct:
`.auto-repetir--levantado { opacity: 0.28; filter: saturate(0.4); }` is the
transient mid-drag placeholder. Persistent "loose/inert" must not be confusable
with transient "mid-drag".

States needing simultaneous legibility: bought-active, loose-dimmed,
capacity-full-grey (new), mid-drag-lift (existing, transient), running-pulse
(existing, transient), definition-always-live (new).

## Touch / Chromebook

MVP.md §5 fixes the screen to 1366×768 without scrolling, in a three-column
layout that one vertical stack fits today. A real free canvas needs more 2D room
— this is a layout redesign, not only a data-model change.

`IslandDetailPage`'s zoom lens (CLAUDE.md §6.1/§6.2) is a directly reusable
precedent: own transform layer, HUD through a portal, `getBoundingClientRect()`
keeps working. The same trap applies — the single-pointer gesture used for "drag
a block" collides with "pan the canvas" on touch and needs the same
tap-vs-pan disambiguation (touch empty canvas = pan, touch a block = drag).

## Docs to update

`MVP.md` §5 (layout, no-scroll fit) and §7 (list-based edit/capacity language);
`IMPLEMENTACION.md` §3, §4, §7; `PROGRESION.md` §5 (re-check the nesting
language against worst-case chain height), §10 (new cut entry), §11 (add
"capacity counts loose blocks too").

## Size forecast

| Area | Changed lines |
| --- | --- |
| `programa.ts` root shape + cross-stack primitives | 250–350 |
| `interprete.ts` + `expandir` plumbing | 40–80 |
| `almacenamiento.ts` (v3 + migration) | 60–100 |
| `scripts/probar-automatizacion.mjs` | 100–300 (smaller under B) |
| `EditorBloques.tsx` rewrite | 400–700+ |
| `AutomatizacionPage.tsx` | 40–80 |
| `global.css` `.auto-*` | 80–150 |
| Docs | 100–150 |
| **Total** | **~1,000–1,700** |

Well above the 800-line budget. Plan a multi-PR chain from the outset:
(1) engine — data model, interpreter, migration, harness;
(2) editor — canvas rendering plus single-stack drag on the new model;
(3) editor — loose stacks, cut/attach, bin, palette-delete, pan/zoom, keyboard,
visual states. Slice 3 will likely need sub-slicing.
