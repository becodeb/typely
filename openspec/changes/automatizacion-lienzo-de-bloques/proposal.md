# Proposal: Lienzo libre de bloques (Modo Automatización)

## Intent

The block editor is one ordered list: order is execution and there is nowhere to
park an idea. Children cannot draft, compare or set aside a fragment. Move to a
Scratch-style free canvas where a green START block owns what runs, everything
else sits inert, and "how much memory I used" becomes visible and physical.

## Scope

### In Scope
- Free 2D placement of stacks; drag carries the grabbed block **and everything below it**.
- Always-present green START block (fixed anchor + recenter); only its chain executes.
- Capacity counts **every** block on the canvas, connected or not. At maximum: palette grey, memory dots red.
- Loose stacks render **dimmed** (never grey — grey means "forbidden"). `def` stacks render at **full colour**, distinguished by hat shape.
- Two deletes: bin in the bottom-left, and dropping onto the palette area.
- Canvas pan + zoom reusing `IslandDetailPage`'s lens pattern (CLAUDE.md §6.1/§6.2).
- `schemaVersion` 3 + v2→v3 migration; docs MVP.md §5/§7, IMPLEMENTACION.md §3/§4/§7, PROGRESION.md §5/§10/§11.

### Out of Scope
- Container internals: `Repetir`, `Si`, `Si/sino`, `Mientras`, `Por siempre`, `Mi rutina` keep their slots and `maxProfundidad = 2`.
- Cut 5 (5×5, segunda nave); deferred crystal-evolution CSS.
- Multiple START blocks; block comments; copy/paste.

## Capabilities

### New Capabilities
- `automatizacion-lienzo`: canvas model, START connectivity, stack grab/cut/attach, placement, pan/zoom, delete affordances, visual states, keyboard.
- `automatizacion-persistencia-lienzo`: schemaVersion 3, v2→v3 migration, coordinate/`idInicio` clamping.

### Modified Capabilities
None in `openspec/specs/` (still empty). The capacity change must be reconciled at archive time with the sibling change's `automatizacion-contador-y-tamano` delta.

## Approach

Exploration's **Approach B**: `programa: NodoPrograma[]` keeps its exact type and now means "the chain hanging off START"; two sibling fields join it on `EstadoCampo` — `rutinas: NodoDef[]` and `pilasSueltas: Pila[]` (`{ id, x, y, nodos }`). `interprete.ts` and `expandir()` need zero signature changes and most of the 71 harness assertions survive. New primitive `cortarDesde(pila, id) → { arriba, agarrado }` provides Scratch grab semantics; `cabeA` generalises from one node to the tallest element of a chain.

### Recorded decisions (resolved, not open)

| # | Decision |
|---|---|
| 1 | Approach B data shape; `Programa` type unchanged |
| 2 | `def` stacks are isolated singletons (hat-block rule) |
| 3 | `def` stacks always full colour; hat shape, not opacity, marks them |
| 4 | Canvas owns its pan/zoom viewport; own transform layer, HUD via portal, `getBoundingClientRect()` untouched; touch on empty canvas = pan, on a block = drag; field panel not shrunk, three columns survive |
| 5 | START has a fixed anchor plus a recenter affordance |
| 6 | Bin and palette-drop both delete the whole grabbed chain |
| 7 | v3 validator **clamps** bad `x`/`y` and a dangling `idInicio`; structural node validity stays all-or-nothing-discard |
| 8 | Keyboard reordering keeps working within a stack (`desplazarNodo` unchanged); cross-stack keyboard is designed in slice 3, not dropped |

### Deliberate spec changes
- **"Capacity used" stops meaning "capacity that runs."** Stated, not slipped in.
- PROGRESION.md §11 invariant holds: `Mi rutina A [body]` costs `1 + capacidadUsada(body)` once, each `Hacer A` costs 1 — still cheaper than three inlined copies.
- Grey gains a meaning inside Modo Automatización for the first time. Verified no live collision: `EditorBloques.tsx` omits unpurchased pieces (`...(compradas.si ? ["if"] : [])`) and `BarraMejoras.tsx` avoids grey/lock. It must still read as clearly different from the world-map "locked" grey (CLAUDE.md §6.4/§12).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/utils/automatizacion/programa.ts` | Modified | `Pila`, `cortarDesde`, cross-stack ops, capacity over the whole canvas |
| `src/utils/automatizacion/motor.ts` | Modified | `EstadoCampo.rutinas`, `.pilasSueltas`, `schemaVersion: 3` |
| `src/utils/automatizacion/almacenamiento.ts` | Modified | v3 validation, v2→v3 migration, clamping |
| `src/utils/automatizacion/interprete.ts` | Modified | Plumbing only; signatures unchanged |
| `src/components/automatizacion/EditorBloques.tsx` | Modified | Canvas, pan/zoom, START, 2D snap, bin, visual states |
| `src/pages/automatizacion/AutomatizacionPage.tsx` | Modified | Wiring, capacity gate |
| `src/styles/global.css` | Modified | `.auto-*` canvas, dim/grey states |
| `scripts/probar-automatizacion.mjs` | Modified | Canvas, migration, capacity cases |
| `docs/modo-automatizacion/{MVP,IMPLEMENTACION,PROGRESION}.md` | Modified | Spanish, matching register |

## Delivery

Forecast ~1,000–1,700 changed lines vs an 800-line budget; `delivery_strategy`
is `auto-chain`. Three slices, planned from the outset:

- **Slice 1 — motor**: data model, `rutinas`/`pilasSueltas`, `cortarDesde`, whole-canvas capacity, schemaVersion 3 + migration, interpreter/`expandir` plumbing, harness. No UI. The game stays playable.
- **Slice 2 — lienzo**: canvas rendering with pan/zoom, green START, single-stack drag on the new model, the three visual states.
- **Slice 3 — el resto**: loose stacks, cut-and-attach across stacks, bin, palette-delete, cross-stack keyboard, capacity-full palette grey + red dots.

**Slice 3 may need sub-slicing.** Feature-branch chain on tracker branch
`docs/modo-automatizacion-mvp`; PRs into `dev`, never `production` directly.
All new user-facing copy is Spanish — tildes, ñ and `¿ ¡` must be correct.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Behavioural inversion**: today "no destination while dragging" means DELETE (`alSoltar`'s `quitar(...)`); on a canvas it must mean "place here as a loose stack" | High | Land it in slice 2 with the bin/palette hit-tests; harness + manual drop-anywhere pass |
| v2→v3 migration loses a partida | Med | Old flat order WAS execution order, so the split is behaviour-preserving; clamp instead of reject; harness case per v1/v2 snapshot |
| Capacity-grey reads as "I don't own this" | Med | Distinct from world-map locked grey; red dots carry the message together with the palette |
| Loose-dim confused with mid-drag lift (`.auto-repetir--levantado`, `opacity: 0.28`) | Med | Persistent dim must be visibly distinct from the transient lift |
| Pan/zoom fights the existing `transform` animation, or eats the block drag on touch | Med | Own transform layer, HUD via portal, tap-vs-pan disambiguation (CLAUDE.md §6.1/§6.2) |
| 1366×768 no-scroll fit breaks | Med | Field panel not shrunk; three-column layout preserved; verify at 1366×768 with 44px touch floor |
| Harness drift across three slices | Med | Keep 71 assertions green at every slice; add cases before behaviour |

## Rollback Plan

No auth/RBAC, no API, no DB migration, no deploy-pipeline surface. Each slice is
one revertable commit on `docs/modo-automatizacion-mvp`. The only durable
artefact is localStorage `schemaVersion: 3`: reverting slice 1 leaves v3
snapshots unreadable by v2 code, so the revert must ship with the v2 reader kept
in place, or accept that a v3 partida resets. Slices 2 and 3 are UI-only and
revert independently.

## Dependencies

`automatizacion-rutinas-y-contador` (complete and verified; cuts 1–4 done). No
new packages. No test runner exists — gates are `npm run build`
(`tsc --noEmit && vite build`) and `node scripts/probar-automatizacion.mjs`
(currently 71/71).

## Success Criteria

- [ ] Un bloque se suelta en cualquier parte del área y se queda ahí.
- [ ] Agarrar un bloque se lleva ese bloque y todo lo que cuelga abajo.
- [ ] Solo lo conectado al bloque verde se ejecuta; lo suelto se ve atenuado, nunca gris.
- [ ] Las rutinas (`Mi rutina`) se ven a todo color y `Hacer A` las encuentra.
- [ ] Al llenar la memoria, los puntos se ponen rojos y la paleta gris, y no se puede tomar otro bloque.
- [ ] El tachito y soltar sobre la paleta borran la cadena agarrada entera.
- [ ] Una partida guardada en v2 se abre en v3 y se comporta igual.
- [ ] `npm run build` y `node scripts/probar-automatizacion.mjs` pasan en cada slice.
