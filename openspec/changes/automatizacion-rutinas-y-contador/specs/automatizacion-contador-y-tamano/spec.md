# Automatización — Contador y Tamaño del Campo Specification

## Purpose

Defines the run-scoped counter (`Contador +1`, `Contador = 0`, sensor
`contador es N`) and `tamaño del campo` in its numeric and boolean-pastilla
forms, plus `Hacer A con N`. These let a program written for one field size
survive growth, without adding variables beyond the counter and field size,
and without comparison operators (PROGRESION.md §5 "Qué NO entra"). Ships in
`interprete.ts` (counter interception), `programa.ts` (sensor/value types),
`EditorBloques.tsx`, `BarraMejoras.tsx`.

## Requirements

### Requirement: Run-scoped counter resets every run

The counter MUST exist only for the duration of one run, MUST start at 0 at
the beginning of every run, and MUST NOT be part of persisted
`EstadoCampo`/`CampoGuardado`.

#### Scenario: Counter resets between runs

- GIVEN a run where `Contador +1` executed 5 times
- WHEN that run ends and a new run starts
- THEN the counter MUST read 0 at the start of the new run

#### Scenario: Counter is never persisted

- GIVEN a snapshot written by `almacenamiento.ts::guardar`
- WHEN its JSON is inspected
- THEN it MUST contain no counter field

### Requirement: Counter mutations never reach the field engine

`counter_add`/`counter_reset` MUST be handled entirely in `interprete.ts`'s
run state and MUST NOT be dispatched to `motor.ts::ejecutarPaso`.

#### Scenario: counter_add is intercepted

- GIVEN a `counter_add` step
- WHEN the interpreter processes it
- THEN `ejecutarPaso` MUST NOT be invoked for that step

#### Scenario: counter_reset touches only the counter

- GIVEN a non-zero run counter
- WHEN `Contador = 0` executes
- THEN the counter MUST become 0
- AND `EstadoCampo` (saldos, celdas) MUST be unchanged

### Requirement: Sensor `contador es N` — discrete equality only

`contador es N` MUST return true only on exact match. No comparison operator
(`<`, `>=`, `>`, `<=`) MUST exist for the counter or any sensor.

#### Scenario: Exact match true, mismatch false

- GIVEN the run counter is 3
- WHEN `contador es 3` and `contador es 4` are each evaluated
- THEN the first MUST be true and the second MUST be false
- AND no comparison-operator block/sensor MUST exist in the palette or AST

### Requirement: `tamaño del campo` numeric form

`tamaño del campo` MUST be usable as the N in `Repetir [N]` and `Hacer A con
[N]`, evaluating to the current `e.lado`.

#### Scenario: Same program adapts from 3×3 to 4×4

- GIVEN `Repetir [tamaño del campo] { Avanzar }` and `e.lado === 3`
- WHEN it runs, `Avanzar` MUST execute exactly 3 times
- WHEN the field later grows to `lado === 4` and the SAME program runs again
- THEN `Avanzar` MUST execute exactly 4 times

### Requirement: `tamaño del campo` boolean pastilla form

`tamaño del campo` MUST also exist as a boolean sensor pastilla for
`Si`/`Mientras`, cycled like `es [color]`, comparing `e.lado` to a fixed
chosen value by discrete equality only.

#### Scenario: Cycles alongside existing pastillas

- GIVEN `sensoresDisponibles(e)` at era 4
- WHEN the child cycles the pastilla
- THEN `tamaño del campo es [N]` MUST appear as an option

#### Scenario: Evaluates by equality only

- GIVEN `e.lado === 4`
- WHEN `tamaño del campo es 4` and `tamaño del campo es 3` are evaluated
- THEN the first MUST be true and the second MUST be false

### Requirement: `Hacer A con N` repeats the body; no parameter binding

`Hacer A con N` MUST behave as sugar for `Repetir N [Hacer A]`. No node inside
the routine body MUST be able to read N.

#### Scenario: Body runs N times

- GIVEN `Mi rutina A = [Avanzar]` and `Hacer A con 3`
- WHEN it runs
- THEN `Avanzar` MUST execute exactly 3 times total

#### Scenario: No parameter-reference node kind exists

- GIVEN the full `NodoPrograma` type union
- WHEN inspected
- THEN it MUST contain no node kind that reads a call-site number inside a
  routine body

### Requirement: Counter/sensor and `Hacer con N` shop unlocks

`Contador +1`, `Contador = 0`, `contador es N`, and `tamaño del campo` (both
forms) MUST be one shop entry for 100 prismas, revealed at era 4. `Hacer A
con N` MUST be a separate entry for 80 estrellas, also era 4; estrella MUST
remain gated at `desdeLado: 4`.

#### Scenario: Both entries gated to era 4

- GIVEN `e.lado === 3`
- WHEN `reveladas(e)` is computed
- THEN neither the counter/sensor key nor the `Hacer con N` key MUST appear

#### Scenario: Hacer con N purchase requires era 4 and enough estrellas

- GIVEN `e.lado === 4` and `e.saldos.estrella < 80`
- WHEN the player attempts the purchase
- THEN `comprar()` MUST return false and no level change MUST occur

### Requirement: No schema bump; old snapshots keep loading

The counter and `tamaño del campo` MUST NOT require `EstadoCampo.schemaVersion`
beyond 2. `validarCampo` MUST keep loading pre-existing v1/v2 snapshots
unchanged.

#### Scenario: A v2 snapshot without counter usage still loads

- GIVEN a stored `schemaVersion: 2` snapshot whose program never used
  `counter_add`/`counter_reset`
- WHEN `validarCampo` runs
- THEN it MUST return a non-null `EstadoCampo`
