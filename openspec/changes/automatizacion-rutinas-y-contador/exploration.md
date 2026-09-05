# Exploration: Rutinas y contador (Modo Automatización, cut 4)

## Status of the feature

Cuts 1–3 of `docs/modo-automatizacion/PROGRESION.md` §10 are DONE and shipped in
commit `4231aa8` on branch `docs/modo-automatizacion-mvp`. The mode is playable.
Cut 4 (routines and counter) is the subject of this change. Cut 5 (5×5 island,
second ship) and the deferred crystal-evolution CSS (§3) stay out.

## Existing implementation map

| File | Role |
|------|------|
| `src/utils/automatizacion/programa.ts` | AST + validation + editor tree helpers |
| `src/utils/automatizacion/interprete.ts` | Step-by-step interpreter with explicit frame stack |
| `src/utils/automatizacion/motor.ts` | Pure field/economy engine |
| `src/utils/automatizacion/almacenamiento.ts` | Persistence + `validarCampo` |
| `src/components/automatizacion/EditorBloques.tsx` | CSS-drawn blocks, pointer drag, sensor pastilla cycling |
| `src/components/automatizacion/{CampoCristales,BarraMejoras,IconosAuto}.tsx` | Field render, shop, icons |
| `src/pages/automatizacion/AutomatizacionPage.tsx` | Page shell |
| `src/data/automatizacion/{balance,campos,escena}.ts` | Prices/era gates, field defs, scene |
| `scripts/probar-automatizacion.mjs` | The only bespoke harness (~50 assertions) |

There is NO test runner in this repo. Gates are `npm run build`
(`tsc --noEmit && vite build`) and `node scripts/probar-automatizacion.mjs`.

## Verified technical facts

- `programa.ts` holds `NodoAccion`, `NodoRepetir`, `NodoSiempre`, `NodoMientras`,
  `NodoSi`, plus `validarPrograma`, `capacidadUsada` (a container costs 1 +
  everything inside, recursively), and `alturaDe` / `cabeA` bounded by
  `AJUSTES.maxProfundidad = 2`.
- `interprete.ts` keeps an explicit frame stack (`Marco[]`, `pila`); `siguiente()`
  returns one `Paso` per call. Actions cost a turn; sensors are free; an
  action-less loop turn costs a tick (`msPorAccion / 4`); `MAX_PASOS_CORRIDA =
  100_000` is a silent safety cap (treated as a normal stop, no banner).
  `evaluarSensor()` reads the tile under the ship.
- `motor.ts::ejecutarPaso()` dispatches on `TipoAccion` over `EstadoCampo`
  (schemaVersion 2). It knows nothing about run-scoped state.
- `almacenamiento.ts::validarCampo()` accepts schemaVersion 1 or 2 and delegates
  program-shape validation entirely to `validarPrograma`.
- `balance.ts` is the single source of truth for prices and era gates;
  `AJUSTES.ladoMaximo = 4` already. `estrella` is gated at `desdeLado: 4`.
- `EditorBloques.tsx` does CSS-drawn blocks, pointer drag with a live gap
  preview, keyboard reordering, and sensor pastilla cycling via
  `sensoresDisponibles(e)`. `Repetir`'s N cycles through `AJUSTES.opcionesRepetir`.

## Pricing (PROGRESION.md §5)

| Level | Blocks | Price |
|---|---|---|
| 3 | `Mi rutina A/B/C` (define) + `Hacer A/B/C` (call) | 60 prismas |
| 4 | `Contador +1`, `Contador = 0`, sensor `contador es N`, sensor `tamaño del campo` | 100 prismas |
| 4 | `Hacer A con N` | 80 estrellas |

## Hard product boundary — "Qué NO entra" (PROGRESION.md §5)

No lists, dictionaries, text, negative numbers, or loose arithmetic operators.
Parameters are only the single number in `Hacer A con N`. Variables are only the
counter and the field size. Comparison operators such as `<` or `>=` MUST NOT be
introduced.

## User decisions (settled — do not reopen)

1. **Recursion is ALLOWED**, direct (`Hacer A` inside `Mi rutina A`) and indirect
   (A→B→A). Rationale: it is no different from a `Repetir` block; execution can
   always be paused; every step takes time. `validarPrograma` MUST NOT reject a
   call on recursion grounds.
2. **The limit is authored capacity, not execution.** The constraint is how many
   blocks the child places (`capacidadUsada`), never how many steps run. No new
   step-count restriction beyond the existing `MAX_PASOS_CORRIDA` safety cap.
3. **PROGRESION.md §6 currently contradicts decision 1** and must be updated in
   place, in its existing Spanish and register. Today it reads: "Las **rutinas**
   son definiciones al nivel raíz (`Mi rutina A`) que la llamada expande en su
   lugar; sin recursión (una rutina no puede llamarse a sí misma: el bloque
   `Hacer A` no se acepta adentro de `Mi rutina A`)."
4. **Safety constraint that makes decision 1 true in practice:** a call that has
   executed no action MUST cost a tick, exactly like the existing action-less
   `Mientras` / `Por siempre` turn (`msPorAccion / 4`). Without it,
   `Mi rutina A = [Hacer A]` grows the frame stack with zero elapsed time and
   freezes the tab, making "siempre puede pausarse" false. The interpreter frame
   stack depth MUST also be bounded so an unbounded call chain degrades
   gracefully — a normal stop, like `MAX_PASOS_CORRIDA`, with no error banner.
5. **`tamaño del campo` ships BOTH ways:** as a number usable in `Repetir [N]`
   and `Hacer A con [N]`, AND as a boolean pastilla for `Si` / `Mientras` slots
   in the same style as `es [color]`. Discrete equality only, no comparison
   operators.
6. **`Hacer A con N` repeats the routine body N times** — sugar for
   `Repetir N [Hacer A]`, per §5's justification "'Avanzar N' sin escribir N
   veces avanzar". It is NOT parameter binding; nothing inside the body reads N.
7. **The counter lives in run state, not field state** (PROGRESION.md §6: "El
   **contador** vive en el estado de la corrida, no en el campo, y arranca en
   cero en cada corrida"). So `counter_add` / `counter_reset` are intercepted
   inside `interprete.ts` and never reach `motor.ts::ejecutarPaso`.
8. **No `EstadoCampo` schemaVersion bump.** `almacenamiento.ts` delegates program
   validation to `validarPrograma`, so new node kinds need no persistence
   migration; old v2 snapshots must keep loading. If design finds this false,
   flag it — do not silently bump.
9. **Routine body depth is validated independently.** A call counts as a depth-0
   leaf; each `Mi rutina` body gets its own `maxProfundidad = 2` budget.

## Acceptance criteria (PROGRESION.md §11)

- Una rutina definida una vez y llamada tres veces ocupa menos memoria que las
  tres copias.
- El mismo programa con `tamaño del campo` recorre la 3×3 y la 4×4.

## Open risks carried into design

- Bounding frame-stack depth without an error banner needs a chosen limit and a
  stop reason that the UI already renders as a normal stop.
- The `tamaño del campo` dual form (number and boolean pastilla) touches both the
  numeric slot cycling and the sensor pastilla cycling in `EditorBloques.tsx`.
- `capacidadUsada` must count a routine definition and its calls in a way that
  actually makes the "less memory than three copies" criterion measurable.
