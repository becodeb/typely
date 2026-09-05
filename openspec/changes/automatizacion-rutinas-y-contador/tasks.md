# Tasks: Rutinas y contador (Modo Automatización, cut 4)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Slice 1 ≈385, Slice 2 ≈470 (combined ≈855) |
| 400-line budget risk | High (combined); Low per slice |
| Chained PRs recommended | Yes |
| Suggested split | Slice 1 (routines) → Slice 2 (counter/tamaño) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main (target branch: `dev`, per repo convention) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High (combined) / Low (per slice)

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Slice 1 — routines (`def`/`call`, capacity, tick+depth safety, shop, PROGRESION §6) | PR 1 → `dev` | `npm run build` | `node scripts/probar-automatizacion.mjs` (new `RUTINAS` section R1–R8) | Revert PR 1 commit; no `def`/`call` remain, `Veces` type never introduced (design confirms slice 2 reverts cleanly on top) |
| 2 | Slice 2 — counter + `tamaño del campo` (both forms) + `Hacer A con N` | PR 2 → `dev`, stacked on PR 1 | `npm run build` | `node scripts/probar-automatizacion.mjs` (new `CONTADOR Y TAMAÑO DEL CAMPO` section C1–C8) | Revert PR 2 commit only; slice 1 blocks stay intact |

**Revert hazard (from design.md — carry into both PRs' descriptions):** `validarCampo` drops any `mejoras` key absent from `AJUSTES.mejoras`, and `validarPrograma` discards a program WHOLE on an unknown node `type`. Reverting a slice after a player used its blocks in a saved field voids that purchase and wipes the **entire** saved field, not just the new blocks. Acceptable only because this feature is unshipped (never reached `production`) — revert before merge, not after.

## Phase 1: Slice 1 — `programa.ts` foundation

- [x] 1.1 Add `NombreRutina`, `RUTINAS`, `NodoDef`, `NodoCall`, extend `NodoContenedor`/`NodoPrograma` unions, `CONTENEDORES` += `"def"` in `src/utils/automatizacion/programa.ts`. Satisfies: Requirement "Routine definition and call".
- [x] 1.2 Add `esDefinicion`, `esLlamada`, `rutinasDe(programa)` (first definition of a letter wins). Satisfies: "Define and call", "Call precedes definition".
- [x] 1.3 `validarNodo`: `def`/`forever` rejected below root (`profundidad > 0`); `def` recurses its body with `profundidad = 0` (own `maxProfundidad = 2` budget); `call` is a leaf, never rejected for recursion, undefined-letter call is a valid no-op. Satisfies: "Recursion is allowed", "Routine body depth is validated independently".
- [x] 1.4 **RED**: add harness case R7 in `scripts/probar-automatizacion.mjs` asserting (a) a call to an undefined letter validates as a no-op, (b) `Si [Repetir [Hacer B]]` inside a routine body validates (2 levels), (c) a 3rd level inside a routine body is rejected. Expect failure until 1.3 ships.
- [x] 1.5 **GREEN**: confirm 1.3 makes R7 pass.
- [x] 1.6 `alturaDe(def) = 0`, `cabeA` rejects `def` below root; **`profundidadDe` resets to 0 descending into a `def` branch** — touches `insertarAntes`, `insertarEn`, `colocar`, `moverNodo` as consumers, no separate edits needed in those functions themselves.
- [x] 1.7 `expandir()`: `def` produces no steps; `call` inlines the resolved body with its own call-depth counter, cutting at `MAX_LLAMADAS_ANIDADAS` with `completo = false` (not an error).
- [x] 1.8 Zero edits to `capacidadUsada`/`costoDeNodo`/`entra` — confirm via harness (task 1.10, R3) that the existing container/leaf rule already prices `def` at `1 + body` and `call` at `1`.

## Phase 2: Slice 1 — interpreter safety

- [x] 2.1 In `src/utils/automatizacion/interprete.ts` add `MAX_LLAMADAS_ANIDADAS = 32`, build `rutinasDe(programa)` once per run, push a `Marco` on `call` (never expand/copy the body).
- [x] 2.2 A call frame ending its round with `marco.acciones === 0` returns `tic(nodoCall)` (mirrors `while`/`forever`); over `MAX_LLAMADAS_ANIDADAS` the call is skipped silently — the containing frame ticks and the stack unwinds with no banner.
- [x] 2.3 **RED**: harness case R6 asserting `Mi rutina A = [Hacer A]` yields only `tick` steps, never a hang, and unwinds cleanly at the bound (pair with R4/R5 for direct/indirect recursion). Expect failure until 2.1–2.2 ship.
- [x] 2.4 **GREEN**: confirm R4, R5, R6 pass against 2.1–2.2.

## Phase 3: Slice 1 — editor and shop

- [x] 3.1 `EditorBloques.tsx`: add `def`/`call` to `Pieza`, `crearNodo`, `COLOR_CONTENEDOR.def`, `COLOR_LLAMADA`, `nombreDe`, `DibujoContenedor` (letter badge `A`/`B`/`C` + colours `#7c71ff`/`#9b7cff`/`#5932d4`), box filtering (`def:X` hidden once defined, `call:X` offered only once defined via `rutinasDe`).
- [x] 3.2 `IconosAuto.tsx`: add `IcoRutina`, `IcoHacer`, `IcoPiezaRutinas`.
- [x] 3.3 `BarraMejoras.tsx`: add `DIBUJO.rutinas`, `NOMBRE.rutinas`, `ORDEN` entry. `motor.ts`: `piezasCompradas` += `rutinas`.
- [x] 3.4 `src/data/automatizacion/balance.ts`: add `mejoras.rutinas` (60 prismas, `maxNivel: 1`) and `revelado.rutinas` (`lado: 3, requiere: "mientras"`).
- [x] 3.5 **RED**: harness case R8 confirming a `def`/`call` program survives `validarCampo` unchanged and `schemaVersion` stays `2` (regression guard, no new implementation expected — should already pass; if it fails, stop and flag per decision 8).
- [x] 3.6 Wire the shop flag through `src/pages/automatizacion/AutomatizacionPage.tsx`. (No code change needed: `piezas={piezasCompradas(e)}` already forwards the whole object generically, and both `motor.ts::piezasCompradas` and `EditorBloques`'s `PiezasDeControl` type now include `rutinas` — the flag flows through the existing prop automatically.)

## Phase 4: Slice 1 — docs and full verification

- [x] 4.1 Replace `docs/modo-automatizacion/PROGRESION.md` §6 lines 167–169 (the "sin recursión" sentence) with the exact Spanish replacement text from design.md, preserving register and tildes.
- [x] 4.2 Add harness cases R1 (definition alone produces no steps), R2 (`Hacer A` runs A's body; interpreter and `expandir` agree on `nodoId`s), R3 (7-vs-9 capacity arithmetic from design.md) to the new `RUTINAS` section.
- [x] 4.3 Run `npm run build` and `node scripts/probar-automatizacion.mjs`; all R1–R8 pass. (63/63 total, all green.)
- [ ] 4.4 **Manual browser check**: drag a `Repetir [Si]` into a routine body (must succeed) and into a 3rd level (must be refused); watch a recursive routine run, pause, and unwind silently at the depth bound; buy the routine card in shop order. Exercise `insertarAntes`/`insertarEn`/`colocar`/`moverNodo` specifically since `profundidadDe` now resets inside `def` (task 1.6). **NOT DONE by this agent — requires a human in a browser.**
- [ ] 4.5 **Verify old snapshots**: load a pre-existing v2 localStorage snapshot with no `def`/`call` nodes; confirm it still loads and plays unchanged after Slice 1 ships. **Partially covered by harness M8/R8 (schemaVersion stays 2, `validarCampo` accepts v1/v2 and a def/call program); the actual browser/localStorage round-trip was NOT manually verified by this agent.**

## Phase 5: Slice 2 — `programa.ts` and `interprete.ts` widening

- [x] 5.1 Add `Veces = number | "lado"`, `resolverVeces(v, lado)`; widen `NodoRepetir.times: Veces` and add `NodoCall.veces?: Veces`. Satisfies: "`tamaño del campo` numeric form", "`Hacer A con N`".
- [x] 5.2 Add `TipoContador`, `NodoContador`; extend `Sensor.valor: Veces`, `TipoSensor += "contador"`.
- [x] 5.3 `validarNodo`: `times`/`veces`/`sensor.valor` must be `"lado"` or a member of `AJUSTES.opcionesRepetir`/`opcionesContador`.
- [x] 5.4 **RED**: harness case C8 asserting out-of-range `times`/`veces`/`valor` are rejected while legacy `times: 3` (and existing `times: 99` rejection, case 19, using the shared `rep()` helper) still resolve correctly under the widened `Veces` type. Expect failure until 5.1–5.3 ship.
- [x] 5.5 **GREEN**: confirm C8 and case 19 both pass; run `tsc --noEmit` to enumerate every `times`/`veces` read site forced to resolve `Veces` (design.md Testing Strategy, "Types" row) and fix each.
- [x] 5.6 `expandir(programa, maxPasos, lado)`: new third parameter; `resolverVeces` applied at frame push so a round count is fixed for the invocation. `counter_add`/`counter_reset` skipped on this path (inert, `TipoAccion` untouched).
- [x] 5.7 `interprete.ts`: add `Interprete.contador` (run state, starts at 0, never persisted); intercept `counter_add`/`counter_reset` before they reach `motor.ts::ejecutarPaso`; `Paso.tipo += "counter"`; `evaluarSensor` gains optional 3rd `contador` param and a `"contador"` case with discrete equality only.

## Phase 6: Slice 2 — editor, shop, executor wiring

- [x] 6.1 `EditorBloques.tsx`: extract `RanuraNumero(nodo)` JSX helper (function returning JSX, not a render-defined component) covering `repeat.times`, `call.veces`, and `while`/`if` with `sensor.tipo === "contador"` — all firing the existing `onCambiarVeces(id)`; `"lado"` renders as the `IcoTamanoCampo` glyph.
- [x] 6.2 Add counter pieces (`Contador +1`, `Contador = 0`) and the counter sensor to `DibujoSensor`/`PiezasDeControl`; extend the pastilla cycle with `contador es N` + negation, gated on `mejoras.contador`.
- [x] 6.3 `AutomatizacionPage.tsx`: extend `sensoresDisponibles(e)` with counter/`tamaño del campo` entries; generalise `cambiarVeces` to pick field+list by node inspection; add a `"counter"` branch in the executor that runs a **full turn with no `ejecutarPaso` call**; show the counter in the running HUD.
- [x] 6.4 `balance.ts`: add `opcionesContador: [0,1,2,3,4]`, `mejoras.contador` (100 prismas, era 4), `mejoras.hacer_con` (80 estrellas, era 4, `requiere: "contador"`), matching `revelado` entries. **Deviation**: design.md's own `balance.ts` snippet listed `contador: { lado: 3, ... }`, but PROGRESION.md §5's curriculum table, spec.md's explicit "revealed at era 4" requirement/scenario, and this work unit's own instructions all agree on era/lado 4 — implemented as `lado: 4` for `contador` (see tasks.md Key Learnings below).
- [x] 6.5 `BarraMejoras.tsx`/`IconosAuto.tsx`: two shop cards, `IcoContadorMas`, `IcoContadorCero`, `IcoSensorContador`, `IcoTamanoCampo`.

## Phase 7: Slice 2 — docs and full verification

- [x] 7.1 Update `docs/modo-automatizacion/PROGRESION.md` §10 cut-4 line so it stops reading "Pendiente."
- [x] 7.2 Add harness cases C1 (`Contador +1` costs a full turn, no field event), C2 (counter starts at 0 each run), C3 (`Contador = 0`), C4 (`contador es N`), C5 (`contador es tamaño del campo` true at 3 on 3×3 / 4 on 4×4), C6 (**acceptance criterion**: same program harvests `lado` tiles on 3×3 and 4×4), C7 (`Hacer A con N` repeats N times, costs 1), C8 (out-of-range rejected; legacy/case 19 still resolve) to the new `CONTADOR Y TAMAÑO DEL CAMPO` section. Also fixed the shared `correrVivo()` harness helper to skip `ejecutarPaso` for the new `"counter"` step type, mirroring its existing `"tick"` skip (same class of fix `tasks.md` flagged for `rep()`/case 19).
- [x] 7.3 Run `npm run build` and `node scripts/probar-automatizacion.mjs`; all C1–C8 plus R1–R8 pass together (71/71 total, all green).
- [ ] 7.4 **Manual browser check**: cycle the widened numeric slot (`Repetir`, `Hacer A con N`) and the pastilla through `"lado"` on both a 3×3 and a 4×4 field; confirm the counter HUD updates live and resets between runs. **NOT DONE by this agent — requires a human in a browser.**
- [ ] 7.5 **Verify old snapshots**: load the same pre-existing v2 snapshot from task 4.5, plus a Slice-1-only snapshot (routines, no counter), and confirm both still load unchanged after Slice 2 ships. **Partially covered by harness M8/R8/C8 (schemaVersion stays 2, `validarCampo`/`validarPrograma` accept v1/v2 snapshots and reject unknown/out-of-range shapes); the actual browser/localStorage round-trip was NOT manually verified by this agent.**

## Key Learnings

1. The harness's shared `rep()` helper and case 19 (`times: 99` rejection) are the concrete site forcing every `NodoRepetir.times` read to resolve the widened `Veces` type.
2. `profundidadDe` resetting inside a `def` branch is a single change in `programa.ts`, but its correctness is only observable through four drag/drop consumers (`insertarAntes`, `insertarEn`, `colocar`, `moverNodo`), which is why it needs a manual browser pass, not just a harness case.
3. Reverting either slice after real play voids the whole saved field because `validarPrograma` discards unknown node types wholesale — both PR descriptions must repeat this hazard.
4. `Hacer A con N` on the LIVE interpreter (not just `expandir`'s sensor-free exam path) is implemented by building a synthetic, never-persisted `{ type: "repeat", times: resolverVeces(veces, lado), body: [callSinVeces] }` at the moment the call is encountered, reusing the interpreter's existing `entrar()`/repeat end-of-frame logic. This makes `Hacer A con N` genuinely sugar for `Repetir N [Hacer A]` (matching design.md's own framing) instead of a bespoke marco field, and it makes each of the N rounds independently subject to `MAX_LLAMADAS_ANIDADAS` and the per-round tic rule, with zero special-casing.
5. design.md's own `balance.ts` snippet for `revelado.contador` said `lado: 3`, but that contradicts spec.md's explicit "revealed at era 4" requirement/scenario, PROGRESION.md §5's curriculum table (both counter+sensor and `Hacer con N` listed under "Nivel 4"), and this work unit's task instructions. Implemented as `lado: 4`; flagged rather than silently resolved. See tasks.md 6.4.
6. `correrVivo()` in the harness only skipped `ejecutarPaso` for `"tick"` steps; adding the `"counter"` step type required the same skip there too, otherwise `Contador +1` would have reached the field engine through the test harness even though the real executor never does — a second concrete site (besides `rep()`/case 19) where widening the `Paso.tipo` union forced a pre-existing helper to be updated.
