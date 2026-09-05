# Tasks: Lienzo libre de bloques (Modo Automatización)

> Size note: like `design.md`, the `sdd-tasks` word budget is deliberately
> exceeded. The orchestrator asked for every load-bearing risk item to become
> an explicit, traceable task, plus per-slice verification gates — that cannot
> fit in 530 words without dropping load-bearing detail.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,725 total (Slice 1 ~595, Slice 2 ~705, Slice 3 ~425) |
| Session review budget (config override) | 800 lines (`openspec/config.yaml` `sdd_session.review_budget_lines`) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Slice 1: motor) → PR 2a (Slice 2 canvas core) → PR 2b (Slice 2 2D snap/inversion) → PR 3 (Slice 3: el resto) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain (tracker `docs/modo-automatizacion-mvp`) |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

**Slice 2 is the budget-risk slice (~705 lines).** `design.md` pre-plans the
cut as a hard requirement, not a fallback: **2a** = viewport, pan/zoom, HUD
portal, green START, hat `def`, canvas rendering of all three stack kinds,
using the EXISTING 1D `calcularDestino` scoped to the green chain only
(~380 lines, playable on its own). **2b** = 2D connector snap,
`.auto-contorno` ghost outline, the `alSoltar` inversion, and bridge removal
(~325 lines). The task phases below are structured so 2a/2b is a clean unit
boundary, never a retrofit.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Slice 1 — motor: data model, v3 schema+migration, temporary bridge | PR 1 (base: `docs/modo-automatizacion-mvp`) | `npm run build` | `node scripts/probar-automatizacion.mjs` → 71→83 | Revert PR 1; v3-only localStorage snapshots become unreadable by v2 code (accepted per design's rollback note) |
| 2a | Canvas viewport, pan/zoom, HUD, green START render, all 3 stack kinds rendered, drag scoped to green chain via existing 1D `calcularDestino` | PR 2a (base: PR 1 branch) | `npm run build` | `node scripts/probar-automatizacion.mjs` → 83/83 unchanged (no new engine logic) | Revert PR 2a alone; bridge from Slice 1 still in place, game stays playable |
| 2b | 2D `calcularDestinoLienzo`, ghost outline, `alSoltar` inversion, bridge removal | PR 2b (base: PR 2a branch) | `npm run build` | `node scripts/probar-automatizacion.mjs` → 83→86 | Revert PR 2b alone; 2a's single-stack green-chain drag still functions |
| 3 | Bin, palette-delete, capacity-full grey/red-dots, cross-stack keyboard | PR 3 (base: PR 2b branch) | `npm run build` | `node scripts/probar-automatizacion.mjs` → 86→90 | Revert PR 3 alone; delete stays tap-to-remove only, all Slice 1/2 behaviour intact |

---

## Phase 1: Slice 1 — Motor (~595 lines)

- [x] 1.1 `programa.ts`: add `cortarDesde`, `cortarEn`, `colocarCadena`, `alturaDeCadena`, `conListaDe`, `profundidadDestino`; generalize `cabeA(nodo: NodoPrograma | NodoPrograma[], profundidad)`.
- [x] 1.2 `programa.ts`: add `capacidadDeLienzo(programa, rutinas?, pilasSueltas?: readonly { nodos }[])` as a structural function — MUST NOT import/name `Pila` (programa.ts stays free of world state, decision #2).
- [x] 1.3 `motor.ts`: add `Punto`, `Pila`, `Lienzo`, `PUNTO_INICIO`, `puntoRutinaPorDefecto`, `lienzoInicial`, `capacidadUsadaCampo`; extend `EstadoCampo` to `schemaVersion: 3` + `rutinas`/`pilasSueltas`/`lienzo`; seed defaults in `estadoInicial`.
- [x] 1.4 `interprete.ts`: merge `rutinasDe(programa)` with `rutinasDe(e.rutinas ?? [])` in `crearInterprete` (one line + comment, signature unchanged).
- [x] 1.5 `programa.ts`: add optional 4th param `rutinasLienzo: NodoDef[] = []` to `expandir` (additive, default `[]`) merging into the same rutina map. Verify every existing call site compiles and behaves identically — zero-signature-break exception is deliberate and documented in design decision #4.
- [x] 1.6 `almacenamiento.ts`: implement v3 `validarCampo` path — `validarRutinas`, `validarPilas`, `validarLienzo`, `validarPunto`, `fusionarRutinas`, `recortarCoord`; accept `schemaVersion` 1, 2, or 3.
- [x] 1.7 `almacenamiento.ts`: implement v1/v2→v3 split — `def` nodes move to `rutinas` via `fusionarRutinas`, everything else keeps original relative order in `programa`, `pilasSueltas = []`.
- [x] 1.8 `almacenamiento.ts`: run exactly ONE `capacidadDeLienzo(programa, rutinas, pilasSueltas) > AJUSTES.maxNodos` check on the whole canvas after the split — NOT three separate per-array bounds (three loose `validarPrograma` calls would silently triple the bound from 60 to 180).
- [x] 1.9 `AutomatizacionPage.tsx`: add the ~35-line **temporary bridge** — render `EditorBloques` with `programa={[...e.rutinas, ...e.programa]}`, re-split `def` out on every edit callback. Comment it as TEMPORARY, removed in task 3b.5. Without this task, a migrated v2 partida stops showing the child their own routine even though `Hacer A` still runs — a visible regression.
- [x] 1.10 `scripts/probar-automatizacion.mjs`: add `EL LIENZO` section, cases L1–L12 (cut/cavity/splice/append/reject/cabeA-chain/cabeA-nested-reject/capacity-13/PROGRESION-§11-invariant/v2→v3-order/clamping/canvas-wide-overcount).
- [x] 1.11 `scripts/probar-automatizacion.mjs`: rewrite R8 and M8 to assert `schemaVersion === 3` and the `programa`/`rutinas` split — these are the ONLY 2 of the 71 existing assertions that change.
- [x] 1.12 Verify: run `node scripts/probar-automatizacion.mjs` and confirm the other 69 pre-existing assertions pass byte-verbatim, unedited — do not treat this as an assumption.
- [x] 1.13 `docs/modo-automatizacion/MVP.md` §7: apply the exact "Edición" and "Capacidad" replacements from `design.md`'s Documentation edits section.
- [x] 1.14 `docs/modo-automatizacion/PROGRESION.md` §11: apply the exact replacement block from `design.md`.
- [x] 1.15 Verify: `npm run build` passes.
- [ ] 1.16 **Manual browser check (not harness-verifiable):** load a pre-existing v2 localStorage snapshot in the running app (with the Task 1.9 bridge active) and confirm the child's own routine still displays and `Hacer A` still runs it identically to before the split. — NOT PERFORMED this run: no browser available in this execution environment; left for a human/manual verification pass before archive.

## Phase 2a: Slice 2 — Canvas core (~380 lines, playable alone)

- [x] 2a.1 `EditorBloques.tsx`: `.auto-lienzo` becomes the viewport (`position: relative; overflow: hidden`, drops `overflow: auto`); add child `.auto-lienzo__capa` carrying `transform: translate(x,y) scale(z)` with **`transform-origin: 0 0`** — deliberately NOT `center` like `IslandDetailPage`, because this transform layer holds data coordinates and `(cx - r.left)/z` is only exact with a `0 0` origin.
- [x] 2a.2 `EditorBloques.tsx`: add `aLienzo`/`aPantalla` coordinate conversion, `acercarEn` (zoom-at-cursor), `recentrar` (`setVista({z:1, x:MARGEN, y:MARGEN})`).
- [x] 2a.3 `EditorBloques.tsx`: add `alRodar` (wheel, `{passive:false}`, gated `!corriendo`), pinch handlers (native touch listeners, `{passive:false}` + `preventDefault`), `alBajar` pan-vs-drag disambiguation guarded on `[data-nodo]`.
- [x] 2a.4 `EditorBloques.tsx`: render HUD (memory dots, recenter button) through `createPortal(…, document.body)` with a `ResizeObserver` on `.auto-lienzo` — MANDATORY because `.auto-taller` carries `backdrop-filter`, which makes `position: fixed` relative to that element instead of the viewport, exactly the trap the existing drag ghost already portals around.
- [x] 2a.5 `EditorBloques.tsx`: render the green `.auto-inicio` START block — fixed anchor, hat shape, no `data-nodo` (not itself draggable, only its chain is).
- [x] 2a.6 `EditorBloques.tsx`: render hat-shaped `def` stacks (`.auto-repetir--sombrero`) at full colour as isolated singletons, and loose stacks (`.auto-pila--suelta`, dimmed) — all three stack kinds positioned absolutely from `lienzo` coordinates.
- [x] 2a.7 `EditorBloques.tsx`: scope drag-and-drop to the green chain only, reusing the EXISTING 1D `calcularDestino` — no 2D snap, no ghost outline, no bin/palette-delete in this unit (that is 2b/3's job). Implemented via a new `arrastrable` flag threaded through `dibujarNodo`/`dibujarCavidad`/`dibujarLista` (default `true` for the green chain; `false` for `def` hats and loose stacks) that suppresses `data-nodo`/`data-clase`/the pointer-down "asa" — hiding them from `calcularDestino`'s DOM scan — while deliberately KEEPING tap-to-quit/cycle-veces/cycle-sensor/keyboard-reorder alive inside a `Mi rutina` body and the "activo" execution pulse (see Deviations in the apply report: a fully-static alternative was rejected because it would have silently broken the `Hacer A` execution highlight).
- [x] 2a.8 `IconosAuto.tsx`: add `IcoInicio`, `IcoRecentrar` (CSS/SVG-drawn, CLAUDE.md §15).
- [x] 2a.9 `global.css`: `.auto-lienzo` viewport, `.auto-lienzo__capa`, `.auto-inicio`, `.auto-repetir--sombrero`, `.auto-pila--suelta`, HUD/`.auto-recentrar` styles.
- [x] 2a.10 `AutomatizacionPage.tsx`: wire `cambiarCampo`, `capacidadUsadaCampo` gate; the Task 1.9 bridge stays in place until 2b.5.
- [x] 2a.11 `docs/modo-automatizacion/MVP.md` §5 and `IMPLEMENTACION.md` §4: apply the exact replacement blocks from `design.md`.
- [x] 2a.12 Verify: `npm run build` passes; `node scripts/probar-automatizacion.mjs` stays at 83/83 (no new engine logic in this unit).
- [ ] 2a.13 **Manual browser check (not harness-verifiable):** pan/zoom on a touch device, HUD not magnified by the lens, green-chain drag still works, 1366×768 no-scroll layout intact.

## Phase 2b: Slice 2 — 2D snap + inversion (~325 lines)

- [x] 2b.1 `EditorBloques.tsx`: implement `calcularDestinoLienzo` (`DestinoLienzo`: `cadena`/`nueva`/`papelera`/`paleta`/`nocabe`) — connector proximity via `RADIO_ENCASTRE = 28`, deepest-first `data-nivel` sort, `cabeA(a.cadena, prof)` guard. Generalized across all three pila kinds (green chain, each `def` body, each loose stack) via a `RefPila`-tagged `data-pila` attribute and a distance-based candidate scan (nearest connector within `RADIO_ENCASTRE`), not just the green chain. `papelera`/`paleta` steps are wired per the type contract but structurally unreachable this slice (no `[data-papelera]` element and no palette rect check yet — those are tasks 3.1/3.2).
- [x] 2b.2 `EditorBloques.tsx` + `global.css`: `.auto-contorno` dashed ghost outline for the `{tipo:"nueva"}` landing preview. No animation was added to `.auto-contorno`, so no `prefers-reduced-motion` override was needed (nothing to disable).
- [x] 2b.3 `EditorBloques.tsx`: invert `alSoltar` — delete ONLY on `papelera`/`paleta` (structurally unreachable this slice, see 2b.1); `nocabe` is a no-op; `cadena` splices via `cortarEn`/`colocarCadena`; `nueva` places as a new loose stack (`onSoltarNueva`/`onSoltarCadena`). The old `quitar(...)`-on-no-destination fallback is removed entirely.
- [x] 2b.4 `EditorBloques.tsx` / `AutomatizacionPage.tsx`: thread `RefPila` through `onMoverCadena`, `onSoltarCadena`, `onSoltarNueva`, `onAgregar(pieza, pila?, destino?)`. `onMover` (the old 1D-only callback) was removed as obsolete.
- [x] 2b.5 `AutomatizacionPage.tsx`: DELETE the Task 1.9 temporary bridge — `EditorBloques` now receives `programa`/`rutinas`/`pilasSueltas`/`lienzo` natively, no re-splitting on every edit. The `esDefinicion`-based tap-to-add guard is gone with it (its reason — the green chain and `rutinas` no longer share one fused array — disappeared too).
- [x] 2b.6 `scripts/probar-automatizacion.mjs`: add L13–L15 (cut-then-place round-trip identity; `def` can never enter `pilasSueltas`; drop-as-new-stack preserves node identity and total capacity).
- [x] 2b.7 Verify: `npm run build` passes; `node scripts/probar-automatizacion.mjs` → 86/86.
- [ ] 2b.8 **Manual browser check (not harness-verifiable):** drag any stack to empty canvas space and confirm it becomes a loose stack, never deleted; drop on the bin/palette deletes the whole chain; a chain carrying a `Repetir[Si]` (height 2) is correctly rejected at nesting depth 1; connector snap into a cavity still works. — NOT PERFORMED this run: no browser available in this execution environment; left for a human/manual verification pass before archive, along with `RADIO_ENCASTRE = 28`'s touch validation (open question, design.md).

## Phase 3: Slice 3 — el resto (~425 lines)

- [ ] 3.1 `IconosAuto.tsx` + `EditorBloques.tsx`: `IcoTachito`, `.auto-papelera` bin hit-test, `onBorrarCadena` wiring — deletes the whole grabbed chain.
- [ ] 3.2 `EditorBloques.tsx`: palette-drop hit-test against `.auto-caja`'s client rect, routed to the same `onBorrarCadena` path.
- [ ] 3.3 `EditorBloques.tsx` + `global.css`: capacity-full state — `.auto-caja--llena`, `.auto-luz--llena`, `.auto-memoria--tope`, gated on `capacidadUsadaCampo(e) >= capacidad(e)`.
- [ ] 3.4 `EditorBloques.tsx`: cross-stack keyboard — `Alt+↑/↓` attaches the focused chain to the previous/next stack's end; `Alt+Shift+↓` detaches it as a loose stack. The handler MUST call `preventDefault()` BEFORE checking selection state — `Alt+←` is the browser's Back, the same trap `LevelPositionEditor` documents (CLAUDE.md §6.1).
- [ ] 3.5 `docs/modo-automatizacion/IMPLEMENTACION.md` §3, `PROGRESION.md` §5 and §10: apply the exact replacement blocks from `design.md`.
- [ ] 3.6 `scripts/probar-automatizacion.mjs`: add L16–L19 (chain delete removes exact `capacidadDeLienzo` delta and nothing else; empty `Pila` dropped on save/load; capacity-full predicate matches `capacidadUsadaCampo(e) >= capacidad(e)`; cross-stack keyboard move preserves total capacity).
- [ ] 3.7 Verify: `npm run build` passes; `node scripts/probar-automatizacion.mjs` → 90/90.
- [ ] 3.8 **Manual browser check (not harness-verifiable), on a touch Chromebook:** bin delete, palette-drop delete, capacity-full grey palette + red memory dots at maximum, `Alt+↑/↓`/`Alt+Shift+↓` cross-stack chords confirming the browser's Back is never hijacked, and `RADIO_ENCASTRE = 28` px is reachable with a finger and does not steal the "land as new stack" drop next to an existing chain (open question in `design.md`, unvalidated until this pass).

## Phase 4: Cross-slice closeout

- [ ] 4.1 Confirm the final harness count progression 71 → 83 (Slice 1) → 86 (Slice 2) → 90 (Slice 3) matches `design.md` exactly, with no assertion other than R8/M8 ever edited.
- [ ] 4.2 Confirm each of the 8 carried risk items (bridge add/remove, `transform-origin: 0 0`, single canvas-wide capacity check, HUD portal, `expandir`'s additive 4th param, the 69-unchanged-assertions guarantee, `RADIO_ENCASTRE`/keyboard `preventDefault`, and the `alSoltar` inversion) has a completed, checked-off task above before this change is archived.
