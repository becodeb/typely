# Automatización — Persistencia del Lienzo Specification

## Purpose

The free canvas needs a persisted shape that separates the executable START
chain, callable routine definitions, and loose stacks. This spec defines
`schemaVersion` 3, the mechanical v2→v3 migration, and how a corrupt or
stale snapshot is repaired (clamped) versus discarded, following the same
discipline as the existing v1→v2 migration in `almacenamiento.ts`.

## Requirements

### Requirement: schemaVersion 3 data shape
A persisted field snapshot at `schemaVersion` 3 SHALL store three sibling
collections instead of one flat `programa` array: `programa: NodoPrograma[]`
(the chain hanging off START, exact type unchanged), `rutinas: NodoDef[]`
(definitions, always root-level, always callable), and
`pilasSueltas: Pila[]` (loose stacks, each `{ id, x, y, nodos }`).

#### Scenario: v3 snapshot round-trips
- GIVEN a v3 snapshot with a non-empty `programa`, `rutinas`, and `pilasSueltas`
- WHEN it is saved and reloaded
- THEN all three collections are preserved with the same content

### Requirement: v2→v3 migration is behaviour-preserving
Loading a `schemaVersion` 2 snapshot SHALL migrate it to v3 by splitting
every `def` node out of the old flat list into `rutinas`, and placing
everything else, in its original relative order, into the green `programa`
chain. Because the old flat order was already the execution order, the
migrated program MUST behave identically to the original.

#### Scenario: v2 partida loads and runs identically under v3
- GIVEN a saved v2 partida whose flat program includes non-`def` nodes and one or more `def`/`call` nodes (including a cut-4 program using rutinas, `Hacer A con N`, and counter nodes)
- WHEN it is loaded under v3
- THEN every `def` node is moved into `rutinas`
- AND every other node keeps its original relative order in `programa`
- AND running the migrated program produces the same sequence of executed steps as running the original v2 program

#### Scenario: Migration never loses a partida
- GIVEN a valid v2 snapshot
- WHEN migration runs
- THEN the migration always succeeds and produces a valid v3 snapshot (no case discards a structurally valid v2 program during migration)

### Requirement: Bad coordinates and dangling references are clamped
A v3 snapshot with an out-of-range `x`/`y` on a `Pila`, or a dangling
`idInicio`-equivalent anchor reference, SHALL be clamped to a safe value
rather than causing the whole snapshot to be rejected. Structural node
validity (malformed node shapes, unknown types, invalid enum values)
continues to be all-or-nothing: any structurally invalid node still
discards the entire snapshot, exactly as `validarPrograma`/`validarCampo`
already do today.

#### Scenario: Out-of-range coordinates are clamped, not rejected
- GIVEN a v3 snapshot where a `Pila`'s `x` or `y` falls outside the canvas bounds
- WHEN the snapshot is validated
- THEN that `Pila`'s coordinates are clamped into bounds
- AND the snapshot is still accepted

#### Scenario: Dangling anchor reference is clamped
- GIVEN a v3 snapshot whose START anchor reference does not resolve to an existing node
- WHEN the snapshot is validated
- THEN the anchor is reset to the default/fixed START position
- AND the snapshot is still accepted

#### Scenario: Structurally invalid node still discards the whole snapshot
- GIVEN a v3 snapshot containing one node with an unknown `type` or a malformed shape
- WHEN the snapshot is validated
- THEN validation returns null and the entire snapshot is discarded, matching the existing all-or-nothing rule for structural validity
