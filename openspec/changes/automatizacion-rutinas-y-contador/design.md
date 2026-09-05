# Design: Rutinas y contador (Modo Automatización, cut 4)

## Technical Approach

Routines are a new **container node kind** (`def`) plus a new **leaf node kind**
(`call`) living in the same top-level `programa` array as `forever`. The
interpreter resolves a call by pushing a frame onto the existing `Marco[]`
stack — it never expands or copies a body — which is what makes the capacity
saving real. The counter is run state on the `Interprete` object, so
`counter_add` / `counter_reset` never reach `motor.ts::ejecutarPaso`.
`tamaño del campo` is one value token (`"lado"`) reused by every numeric slot
and by the counter sensor, so the two existing cycling mechanisms stay two.

Delivered as two independently playable and revertable slices on
`docs/modo-automatizacion-mvp` (PR into `dev`, never `production`).

## Architecture Decisions

### Decision: routine definitions live in the same top-level `programa` array

**Choice**: `NodoDef` is a root-level container inside `EstadoCampo.programa`,
exactly like `forever`. No new `EstadoCampo` field.
**Alternatives considered**: a separate `EstadoCampo.rutinas: Record<letra, Programa>`.
**Rationale**: verified in `almacenamiento.ts` — `CampoGuardado = Omit<EstadoCampo,"nave">`
serialises whatever fields exist, and `validarCampo` delegates program shape
entirely to `validarPrograma(s.programa ?? [])`. A new field would need a new
validator branch and a defaulting rule; a new node kind needs neither.
**Consequence for persistence**: **decision 8 is CONFIRMED — no schemaVersion
bump.** Old v2 (and v1) snapshots contain no `def`/`call` and validate
unchanged. One caveat found and flagged below (see Migration).

### Decision: capacity accounting is unchanged — the saving falls out of the existing rule

**Choice**: `def` is a container (1 + body, via `esContenedor`/`ramas`); `call`,
`counter_add`, `counter_reset` are leaves (1). **Zero edits to
`capacidadUsada` / `costoDeNodo` / `entra`.**
**Rationale**: with a body of `b` blocks called `n` times,
`def` costs `1 + b + n`; the `n` inline copies cost `n · b`. For the canonical
`plantar, esperar, cosechar` (b = 3):

| llamadas | rutina | copias |
|---|---|---|
| 1 | 1+3+1 = **5** | 3 |
| 2 | 1+3+2 = **6** | 6 |
| 3 | 1+3+3 = **7** | **9** |
| 4 | 1+3+4 = **8** | **12** |

Break-even is `1 + b + n < n·b` → for b = 3, `n ≥ 3`. The acceptance criterion
("llamada tres veces ocupa menos memoria que las tres copias") is exactly the
first winning case, so the existing rule is already the right rule.
`maxNodos: 60` needs no change: capacity tops out at `capacidadInicial(3) +
capacidad.maxNivel(12) = 15`, and every node costs 1.

### Decision: frame-stack depth bound = 32 nested calls

**Choice**: `MAX_LLAMADAS_ANIDADAS = 32` in `interprete.ts`, next to
`MAX_PASOS_CORRIDA` (a safety cap, not a playtest knob — it does not go in
`balance.ts`). Over the bound the call is **skipped silently**; the frame that
contained it then ends with `acciones === 0` and emits a tick, so the stack
unwinds one visible pulse per level and the run ends normally. No banner.
**Alternatives considered**: 8 or 12 (too tight), returning `null` immediately
(a hard stop mid-field reads as a bug).
**Rationale**: the largest legitimate self-recursion sweeps the whole field one
tile per level — 16 on the maximum 4×4 (`AJUSTES.ladoMaximo = 4`). 32 is
`2 × ladoMaximo²`, leaving room for an alternating A→B sweep that costs two
frames per tile. Worst-case unwind is 32 ticks ≈ 5.2 s at the default
`msPorAccion / 4` = 162 ms — watchable and interruptible. The stack is
explicit, not JS recursion, so there is no stack-overflow risk; 32 call levels
× 3 frames ≈ 96 `Marco` objects.

### Decision: the time invariant, and how the action-less call tick is detected

**Choice**: a call frame that finishes a round with `marco.acciones === 0`
returns `tic(nodoCall)`, mirroring `while` / `forever`. `devolver()` already
increments `acciones` on every frame in the stack, so detection is free.
**Rationale**: this yields the invariant that makes recursion safe —
**every unit of interpreter progress is either an action (a turn) or a tick (a
quarter turn); zero-time progress is impossible.** `Mi rutina A = [Hacer A]`
therefore descends 32 levels and unwinds 32 ticks instead of freezing the tab.
Note this is stricter than `repeat`, which emits no empty-round tick;
justified because `repeat`'s N is small and bounded while a call chain is not.

### Decision: `tamaño del campo` is one value token, not two features

**Choice**: `Veces = number | "lado"`, resolved by
`resolverVeces(v, lado)`. It is the operand of `Repetir [N]`, of
`Hacer A con [N]`, **and** of the counter sensor. The boolean pastilla form is
therefore `contador es [tamaño del campo]` — the only discrete equality
involving field size that needs no comparison operator.
**Alternatives considered**: a standalone boolean sensor `tamaño del campo`
(asserts nothing on its own); adding six `contador es N` entries to the sensor
cycle (would make the pastilla a 16-stop cycle).
**Rationale**: one token, one resolver, one numeric-slot UI. It also delivers
the second acceptance criterion directly:
`Mientras no (contador es tamaño del campo) → [avanzar, cosechar, Contador +1]`
walks the 3×3 and the 4×4 unchanged. `veces`/`times` are resolved **once, when
the frame is pushed**, so a round count is stable within one invocation;
`e.lado` cannot change mid-run because `comprarMejora` returns early while
`corriendo`.

### Decision: routine identity is a letter badge plus a colour

**Choice**: `A` / `B` / `C` drawn on the block, each letter with its own colour
(`#7c71ff` / `#9b7cff` / `#5932d4`, from the CLAUDE.md §5 electric-violet family).
**Alternatives considered**: three distinct glyphs (animals, shapes).
**Rationale**: MVP.md §3 forbids text *labels*, not identifiers; `IcoPiezaRepetir`
already draws a numeral. Three arbitrary glyphs are neither memorable nor
orderable, and a pre-literate child still needs to match a call to its
definition — the colour does that, the letter names it.

## Data Flow

    caja de piezas ──crearNodo──> Programa (EstadoCampo.programa) ──validarPrograma──> localStorage
                                        │
                            crearInterprete(programa, e)
                                        │  rutinasDe(): mapa letra→cuerpo, UNA vez por corrida
                                        ▼
                       pila: Marco[] ────siguiente()────> Paso
                                        │
                ┌───────────────────────┼────────────────────────┐
         tipo "counter"            tipo "tick"              TipoAccion
     interprete.contador ±       msPorAccion / 4        ejecutarPaso() → EventoPaso
     NUNCA llega al motor        late el bloque         el campo se anima

## Interfaces / Contracts

```ts
/* programa.ts — slice 1 */
export type NombreRutina = "A" | "B" | "C";
export const RUTINAS: readonly NombreRutina[] = ["A", "B", "C"];

export interface NodoDef  { id: string; type: "def";  rutina: NombreRutina; body: NodoPrograma[]; }
export interface NodoCall { id: string; type: "call"; rutina: NombreRutina; }

export type NodoContenedor = NodoRepetir | NodoSiempre | NodoMientras | NodoSi | NodoDef;
export type NodoPrograma   = NodoAccion | NodoCall | NodoContenedor;
const CONTENEDORES = ["repeat", "forever", "while", "if", "def"] as const;

export function esDefinicion(n: NodoPrograma): n is NodoDef  { return n.type === "def"; }
export function esLlamada(n: NodoPrograma):    n is NodoCall { return n.type === "call"; }
/** Cuerpo de cada rutina definida al nivel raíz. La PRIMERA definición de una
 *  letra gana: un snapshot editado a mano no puede volver la corrida ambigua. */
export function rutinasDe(p: Programa): Map<NombreRutina, NodoPrograma[]>;

/* programa.ts — slice 2 */
export type Veces = number | "lado";
export function resolverVeces(v: Veces, lado: number): number;   // "lado" → lado
export type TipoContador = "counter_add" | "counter_reset";
export interface NodoContador { id: string; type: TipoContador; }

export interface NodoRepetir { id: string; type: "repeat"; times: Veces; body: NodoPrograma[]; }
export interface NodoCall    { id: string; type: "call"; rutina: NombreRutina; veces?: Veces; }
export type TipoSensor = "listo" | "vacia" | "es" | "borde" | "contador";
export interface Sensor { tipo: TipoSensor; mineral?: Mineral; valor?: Veces; no?: boolean; }
```

```ts
/* interprete.ts */
export const MAX_LLAMADAS_ANIDADAS = 32;
export interface Paso { nodoId: string; tipo: TipoAccion | "tick" | "counter"; mineral?: Mineral; }
export interface Interprete { siguiente(): Paso | null; pasos: number; contador: number; }
/** Tercer parámetro opcional: sólo lo usa el sensor `contador`. Las llamadas
 *  existentes (y el examen) siguen compilando sin tocarse. */
export function evaluarSensor(s: Sensor, e: EstadoCampo, contador?: number): boolean;
```

Validation rules added to `validarNodo` (the `def` branch runs **before** the
shared `validarLista(n.body, profundidad + 1, …)`):

- `def` and `forever` are rejected at `profundidad > 0` (root only).
- **`def` recurses with `profundidad = 0`** — decision 9: each body gets its own
  `maxProfundidad = 2` budget.
- `call` is a leaf: no depth check, **never rejected on recursion grounds**
  (decision 1). A call to an undefined letter is valid and does nothing.
- `times` / `veces` / `sensor.valor` must be `"lado"` or a member of
  `AJUSTES.opcionesRepetir` (`opcionesContador` for the sensor).

Tree-editing rules, all in `programa.ts`:

- `alturaDe(def) = 0` and `cabeA` rejects `def` at `profundidad > 0` — same
  shape as the existing `forever` rule.
- **`profundidadDe` resets to 0 when it descends into a `def` branch.** This one
  change makes every consumer (`insertarAntes`, `insertarEn`, `colocar`,
  `moverNodo`) honour the per-body budget, so `Repetir [Si [...]]` drops into a
  routine but a third level still does not.

`expandir()` (kept for the sensor-free exam path):

- `def` → skipped; a definition produces no steps.
- `call` → inlines the resolved body `resolverVeces(veces ?? 1, lado)` times,
  carrying `contenedorId: call.id` and `vuelta`, with its own call-depth
  counter; over `MAX_LLAMADAS_ANIDADAS` it cuts and sets `completo = false`,
  exactly like reaching `maxPasos`. Reaching the top is not an error.
- `counter_add` / `counter_reset` → skipped. The counter is only observable
  through a sensor, and `expandir` already skips every sensor container, so
  counter nodes are inert on this path and `PasoExpandido.tipo` stays `TipoAccion`.
- New third parameter: `expandir(programa, maxPasos = AJUSTES.maxPasosEjecucion,
  lado = AJUSTES.ladoInicial)` — added in **slice 2 only**.

## `balance.ts` entries

Following the existing boolean-unlock pattern (`multiplicador: 1, maxNivel: 1`)
and the `sino: { requiere: "si" }` chaining:

```ts
mejoras: {
  rutinas:   { moneda: "prisma"   as Mineral, base:  60, multiplicador: 1, maxNivel: 1 },  // slice 1
  contador:  { moneda: "prisma"   as Mineral, base: 100, multiplicador: 1, maxNivel: 1 },  // slice 2
  hacer_con: { moneda: "estrella" as Mineral, base:  80, multiplicador: 1, maxNivel: 1 },  // slice 2
},
revelado: {
  rutinas:   { lado: 3, requiere: "mientras" },   // la era del prisma, y ya sabe esperar
  contador:  { lado: 3, requiere: "rutinas"  },
  hacer_con: { lado: 4, requiere: "contador" },   // la estrella existe desde la 4×4
},
opcionesContador: [0, 1, 2, 3, 4] as const,       // slice 2
```

Prices come straight from PROGRESION.md §5. The era gates are redundant with
the currency but keep the card from appearing before its era, matching
`si: { lado: 2, cosechado: ["racimo", 1] }`. `reveladas()` and `precioMejora()`
need no code change; `AJUSTES.revelado` is already `Record<string, …>`.

## Editor: how the two cycling mechanisms stay two

`EditorBloques.tsx` today has (a) `onCambiarVeces` — the `Repetir` number
button, cycling `AJUSTES.opcionesRepetir` — and (b) `onCambiarSensor` — the
pastilla, cycling `sensoresDisponibles(e)`. Slice 2 does **not** add a third.

Extract one `RanuraNumero(nodo)` JSX helper (a function returning JSX, not a
component defined in render — the file's existing rule) rendered on the lomo
whenever the node owns a numeric slot:

| node | field | option list |
|---|---|---|
| `repeat` | `times` | `[...opcionesRepetir, "lado"]` |
| `call` with `veces !== undefined` | `veces` | `[...opcionesRepetir, "lado"]` |
| `while` / `if` with `sensor.tipo === "contador"` | `sensor.valor` | `[...opcionesContador, "lado"]` |

All three keep firing the **same** `onCambiarVeces(id)`; the page's
`cambiarVeces` picks the field and the list by inspecting the node. `"lado"`
renders as the `IcoTamanoCampo` glyph inside the same button, never a digit.
The pastilla cycle gains exactly two entries (`contador es N` and its
negation), gated on `mejoras.contador`, so tapping it stays short.

The box hides `def:X` for letters already defined and offers `call:X` only for
letters that are, both derived from `rutinasDe(programa)`.

## File Changes

### Slice 1 — rutinas (60 prismas) · ≈ 385 changed lines

| File | Action | Symbols |
|---|---|---|
| `src/utils/automatizacion/programa.ts` | Modify | `NombreRutina`, `RUTINAS`, `NodoDef`, `NodoCall`, unions, `CONTENEDORES`, `esDefinicion`, `esLlamada`, `rutinasDe`, `validarNodo`, `alturaDe`, `cabeA`, `profundidadDe`, `expandir` |
| `src/utils/automatizacion/interprete.ts` | Modify | `MAX_LLAMADAS_ANIDADAS`, `Marco.contenedor`, call push + end-of-frame + empty-frame tick, `def` skip, routine map |
| `src/components/automatizacion/EditorBloques.tsx` | Modify | `Pieza`, `crearNodo`, `COLOR_CONTENEDOR.def`, `COLOR_LLAMADA`, `nombreDe`, `DibujoContenedor`, letter badge, box filtering, `PiezasDeControl.rutinas` |
| `src/components/automatizacion/IconosAuto.tsx` | Modify | `IcoRutina`, `IcoHacer`, `IcoPiezaRutinas` |
| `src/components/automatizacion/BarraMejoras.tsx` | Modify | `DIBUJO.rutinas`, `NOMBRE.rutinas`, `ORDEN` |
| `src/utils/automatizacion/motor.ts` | Modify | `piezasCompradas` += `rutinas` |
| `src/data/automatizacion/balance.ts` | Modify | `mejoras.rutinas`, `revelado.rutinas` |
| `src/pages/automatizacion/AutomatizacionPage.tsx` | Modify | pass the new flag through |
| `docs/modo-automatizacion/PROGRESION.md` | Modify | §6 recursion bullet (below) |
| `scripts/probar-automatizacion.mjs` | Modify | new `RUTINAS` section, R1–R8 |

### Slice 2 — contador y tamaño del campo (100 prismas / 80 estrellas) · ≈ 470 changed lines

| File | Action | Symbols |
|---|---|---|
| `src/utils/automatizacion/programa.ts` | Modify | `Veces`, `resolverVeces`, `TipoContador`, `NodoContador`, `times: Veces`, `NodoCall.veces`, `Sensor.valor`, `TipoSensor` += `contador`, validation, `expandir(…, lado)` |
| `src/utils/automatizacion/interprete.ts` | Modify | `Interprete.contador`, counter interception, `Paso.tipo` += `"counter"`, `evaluarSensor` 3rd param + `contador` case, `resolverVeces` at push |
| `src/components/automatizacion/EditorBloques.tsx` | Modify | `RanuraNumero`, counter pieces, `DibujoSensor` counter case, `PiezasDeControl` += `contador`, `hacerCon` |
| `src/pages/automatizacion/AutomatizacionPage.tsx` | Modify | `sensoresDisponibles` counter entries, generalised `cambiarVeces`, `"counter"` branch in the executor (full turn, **no `ejecutarPaso`**), counter HUD while running |
| `src/data/automatizacion/balance.ts` | Modify | `opcionesContador`, `mejoras.contador`, `mejoras.hacer_con`, revelado |
| `src/components/automatizacion/{BarraMejoras,IconosAuto}.tsx` | Modify | two cards, `IcoContadorMas`, `IcoContadorCero`, `IcoSensorContador`, `IcoTamanoCampo` |
| `docs/modo-automatizacion/PROGRESION.md` | Modify | §10 cut-4 line stops saying "Pendiente" |
| `scripts/probar-automatizacion.mjs` | Modify | new `CONTADOR Y TAMAÑO DEL CAMPO` section, C1–C8 |

Both slices sit under the 800-line budget; combined they would be ≈ 855, which
is what forces the split. Slice 1 introduces **no** `Veces` type — `NodoCall`
has no `veces` field until slice 2 — so slice 2 reverts cleanly without
touching slice 1.

## PROGRESION.md §6 — the exact edit

Current text, verbatim (lines 167–169):

> - Las **rutinas** son definiciones al nivel raíz (`Mi rutina A`) que la
>   llamada expande en su lugar; sin recursión (una rutina no puede llamarse
>   a sí misma: el bloque `Hacer A` no se acepta adentro de `Mi rutina A`).

Replacement:

> - Las **rutinas** son definiciones al nivel raíz (`Mi rutina A`) que la
>   llamada NO expande: el intérprete apila un marco y ejecuta el cuerpo ahí
>   mismo, así una rutina se guarda una sola vez por más veces que se la
>   llame. **La recursión se permite**, directa (`Hacer A` adentro de
>   `Mi rutina A`) e indirecta (A llama a B y B llama a A): no es distinta de
>   un `Repetir`, siempre puede pausarse y cada paso cuesta tiempo. Dos reglas
>   la sostienen: una llamada que no ejecutó ninguna acción cuesta un **tic**,
>   igual que una vuelta vacía de `Mientras`, y la pila de llamadas está
>   acotada (32 niveles); pasado el tope la llamada se saltea y la corrida se
>   desarma sola, como cualquier detención normal, sin cartel.

## Testing Strategy

No test runner exists. Gates are `npm run build` (`tsc --noEmit && vite build`)
and `node scripts/probar-automatizacion.mjs`.

| Layer | What to test | Approach |
|---|---|---|
| Engine (slice 1) | R1 a definition alone produces no steps · R2 `Hacer A` runs A's body (interpreter and `expandir` agree on `nodoId`s) · R3 the 7-vs-9 arithmetic above · R4 direct recursion runs, never hangs, ends at the depth bound · R5 indirect A→B→A · R6 `def A = [Hacer A]` yields only ticks, never zero steps · R7 `def` root-only, call-to-undefined is a valid no-op, per-body depth budget of 2 · R8 a snapshot with `def`/`call` survives `validarCampo` and stays `schemaVersion: 2` | new `RUTINAS` section in `probar-automatizacion.mjs`, reusing `correrVivo` |
| Engine (slice 2) | C1 `Contador +1` produces no field event and costs a full turn · C2 the counter starts at zero every run · C3 `Contador = 0` · C4 `contador es N` · C5 `contador es tamaño del campo` true at 3 on the 3×3 and at 4 on the 4×4 · **C6 the acceptance criterion: the same program harvests `lado` tiles on the 3×3 and on the 4×4** · C7 `Hacer A con N` repeats the body N times and still costs 1 · C8 out-of-range `times`/`veces`/`valor` rejected, legacy `times: 3` still valid | same harness, new section |
| Types | every read site of `times` forced to resolve `Veces` | `tsc --noEmit` enumerates them |
| Manual | drag a `Repetir [Si]` into a routine body (allowed) and a third level (refused); watch a recursive routine unwind and stay stoppable; buy each card in shop order | browser, per slice |

## Threat Matrix

`N/A — no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary.` The one adjacent surface is
untrusted input: a hand-edited `localStorage` snapshot. It is covered by the
existing contract in `programa.ts` — blocks are data, never generated or
evaluated JavaScript, and `validarPrograma` discards a bad program whole.
Cases R7/R8 and C8 keep that true for the new node kinds.

## Migration / Rollout

No data migration. `EstadoCampo.schemaVersion` stays `2` — verified against
`almacenamiento.ts::validarCampo`, which accepts 1 or 2 and delegates program
shape to `validarPrograma`.

**Flagged revert hazard.** `validarCampo` drops any `mejoras` key not present
in `AJUSTES.mejoras`, and `validarPrograma` discards a program whole on an
unknown node `type`. So reverting a slice after a player has bought and used
its blocks silently voids that purchase and **discards the entire saved field**,
not just the offending block. This is acceptable only because the feature is
unshipped: cuts 4–5 live on `docs/modo-automatizacion-mvp` and have never
reached `production`. Revert before merge, not after.

Rollout is the two slices in order, each its own commit, each verified with
`npm run build` and the harness before the next starts.

## Open Questions

- [ ] None blocking. Two judgement calls are recorded above rather than
      deferred: `MAX_LLAMADAS_ANIDADAS = 32` and the three routine colours are
      first calibrations and expected to move in playtest, like every number in
      `balance.ts`.
