# Automatización — Rutinas Specification

## Purpose

Defines routine definition and call (`Mi rutina A/B/C` / `Hacer A/B/C`), the
capacity accounting that makes a routine cheaper than inline copies, and the
two safety rules — tick-per-empty-call and bounded frame depth — that make
recursion safe without banning it. Ships in `programa.ts`, `interprete.ts`,
`EditorBloques.tsx`, `BarraMejoras.tsx`.

## Requirements

### Requirement: Routine definition and call

The system MUST support root-level routine definitions (`def`, UI: `Mi rutina
A/B/C`) and calls to them (`call`, UI: `Hacer A/B/C`), resolved by slot rather
than by textual order.

#### Scenario: Define and call

- GIVEN `Mi rutina A` at the root with body `[Avanzar, Cosechar]`, and `Hacer
  A` elsewhere at the root
- WHEN the program runs
- THEN the ship MUST execute `Avanzar, Cosechar` at the `Hacer A` step

#### Scenario: Call precedes definition

- GIVEN `Hacer A` appears before `Mi rutina A` in the root list
- WHEN `validarPrograma` runs
- THEN it MUST still accept the program

### Requirement: Recursion is allowed, direct and indirect

`validarPrograma` MUST NOT reject a program because a routine calls itself or
forms a call cycle (A→B→A).

#### Scenario: Direct recursion validates

- GIVEN `Mi rutina A` body contains `Hacer A`
- WHEN validated
- THEN the program MUST be accepted (non-null)

#### Scenario: Indirect recursion validates

- GIVEN `Mi rutina A` calls `Hacer B` and `Mi rutina B` calls `Hacer A`
- WHEN validated
- THEN the program MUST be accepted

### Requirement: Capacity charges the definition once, calls are leaves

`capacidadUsada` MUST count a routine's definition (header + body) once and
each `Hacer` call as a small fixed leaf cost, never re-expanding the body at
the call site.

#### Scenario: Three calls cost less than three inline copies

- GIVEN `Mi rutina A` with body cost K, plus three `Hacer A` calls at the root
- WHEN `capacidadUsada([def A, call A, call A, call A])` is compared to three
  inline copies of A's body
- THEN the routine version MUST be strictly cheaper
- AND `scripts/probar-automatizacion.mjs` MUST assert this inequality

### Requirement: An action-less call costs a tick

A `Hacer` call whose body completes without producing any action-step MUST
cost exactly one tick (`msPorAccion / 4`), matching the existing
action-less `Mientras`/`Por siempre` turn.

#### Scenario: Empty-effect recursive call ticks, never freezes

- GIVEN `Mi rutina A = [Hacer A]`
- WHEN the interpreter steps one such frame
- THEN `siguiente()` MUST return a `tick` step, not silently loop with zero
  elapsed time

#### Scenario: A call that performs one action is not double-charged

- GIVEN `Mi rutina A = [Avanzar]`
- WHEN `Hacer A` executes
- THEN the step returned MUST be the `move_forward` action, not a tick

### Requirement: Frame-stack depth is bounded and degrades silently

The interpreter MUST cap call-frame depth. Exceeding it MUST stop the run
exactly like `MAX_PASOS_CORRIDA`: a silent stop, no error banner.

#### Scenario: Unbounded recursion stops silently

- GIVEN mutual recursion with no terminating condition
- WHEN the frame stack would exceed the configured maximum
- THEN `siguiente()` MUST return null with no error UI shown

#### Scenario: Depth bound does not trip on normal use

- GIVEN one non-recursive routine call inside the maximum structural nesting
  (`maxProfundidad = 2`)
- WHEN it runs
- THEN it MUST complete without hitting the depth-bound stop

### Requirement: Routine body depth is validated independently

Each `Mi rutina` body MUST be checked against its own `AJUSTES.maxProfundidad
= 2` budget starting at depth 0. A `Hacer` call MUST count as a depth-0 leaf
wherever it is placed.

#### Scenario: A routine body may nest up to the normal limit

- GIVEN `Mi rutina A` body is `Si [sensor] { Repetir 3 [Hacer B] }` (2 levels)
- WHEN `validarPrograma` validates it
- THEN it MUST be accepted

#### Scenario: A call adds no structural depth to its caller

- GIVEN the main program is already at depth 2 (`Repetir { Si { Hacer A } }`)
- WHEN `Hacer A` is validated there
- THEN it MUST be accepted regardless of how deep `Mi rutina A`'s own body
  nests

### Requirement: Routine shop entry — 60 prismas, era 3

`Mi rutina A/B/C` + `Hacer A/B/C` MUST be one shop entry costing 60 prismas,
revealed only from era 3 (`lado >= 3`) via `AJUSTES.revelado`.

#### Scenario: Hidden before era 3, purchasable at era 3

- GIVEN `e.lado === 2`
- WHEN `reveladas(e)` is computed
- THEN the routines key MUST be absent
- AND once `e.lado === 3` and `e.saldos.prisma >= 60`, the entry MUST be
  purchasable and the blocks MUST appear in the palette

### Requirement: Old saved programs keep validating

`def`/`call` MUST NOT require an `EstadoCampo.schemaVersion` bump.
`validarCampo` MUST keep accepting v1/v2 snapshots whose programs use no
routine nodes, unchanged.

#### Scenario: Pre-cut-4 v2 snapshot still loads

- GIVEN a stored `schemaVersion: 2` snapshot with a program using only
  pre-existing node types
- WHEN `validarCampo` runs
- THEN it MUST return a non-null `EstadoCampo`

### Requirement: New block labels are correct Spanish (CLAUDE.md §15)

`Mi rutina A/B/C` and `Hacer A/B/C` labels MUST use correct Spanish, tildes
included, matching PROGRESION.md §5 verbatim.

#### Scenario: Labels match the design doc

- GIVEN the shipped aria-labels/copy in `EditorBloques.tsx`
- WHEN compared to PROGRESION.md §5
- THEN they MUST match verbatim
