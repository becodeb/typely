# Proposal: Rutinas y contador (Modo Automatización, cut 4)

## Intent

Cut 4 of `docs/modo-automatizacion/PROGRESION.md` §10. Today a child must copy
the plant-wait-harvest sequence into every tile, and a program written for the
3×3 field breaks on the 4×4. Routines make repetition nameable; the counter and
`tamaño del campo` make a program survive the field growing.

## Scope

### In Scope
- `Mi rutina A/B/C` (define) + `Hacer A/B/C` (call) — 60 prismas, level 3.
- `Contador +1`, `Contador = 0`, sensor `contador es N`, `tamaño del campo` — 100 prismas, level 4.
- `Hacer A con N` — 80 estrellas, level 4.
- `tamaño del campo` in BOTH forms: a number for `Repetir [N]` / `Hacer A con [N]`, and a boolean pastilla for `Si` / `Mientras`.
- Update PROGRESION.md §6, in its existing Spanish, to allow recursion.
- New harness cases in `scripts/probar-automatizacion.mjs`.

### Out of Scope
- Cut 5 (isla 5×5, segunda nave).
- Deferred CSS for crystal evolution levels (PROGRESION.md §3).
- Lists, text, negative numbers, loose arithmetic, comparison operators (`<`, `>=`).
- Parameter binding: `Hacer A con N` repeats the body N times; nothing inside reads N.

## Capabilities

### New Capabilities
- `automatizacion-rutinas`: routine definition, call, recursion, capacity accounting, tick-per-action-less-call.
- `automatizacion-contador-y-tamano`: run-scoped counter, `contador es N`, `tamaño del campo` dual form, `Hacer A con N`.

### Modified Capabilities
None — `openspec/specs/` is empty.

## Approach

New AST node kinds in `programa.ts` (`def`, `call`); the interpreter resolves
calls by pushing a frame, so a routine is stored once and never expanded into
copies. **Recursion is allowed** — direct and indirect. The limit is authored
capacity (`capacidadUsada`), never executed steps. Two safety rules make that
true: an action-less call costs a tick (`msPorAccion / 4`), and frame-stack
depth is bounded, degrading as a normal stop like `MAX_PASOS_CORRIDA`, with no
error banner. The counter lives in run state, so `counter_add` / `counter_reset`
are intercepted in `interprete.ts` and never reach `motor.ts`. No `EstadoCampo`
schemaVersion bump: old v2 snapshots keep loading.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/utils/automatizacion/programa.ts` | Modified | `def`/`call` nodes, capacity, per-body depth |
| `src/utils/automatizacion/interprete.ts` | Modified | Call frames, counter, tick rule, depth bound |
| `src/components/automatizacion/EditorBloques.tsx` | Modified | New blocks, numeric slot + pastilla cycling |
| `src/components/automatizacion/BarraMejoras.tsx` | Modified | Three shop entries |
| `src/data/automatizacion/balance.ts` | Modified | Prices and era gates |
| `docs/modo-automatizacion/PROGRESION.md` | Modified | §6 recursion paragraph (Spanish) |
| `scripts/probar-automatizacion.mjs` | Modified | New cases |

## Delivery

Forecast ~750–1150 changed lines, above the 800-line budget;
`delivery_strategy` is `auto-chain`. Split on the shop's own pricing boundary:

- **Slice 1 — routines**: `def`/`call`, interpreter support, tick rule, depth bound, PROGRESION.md §6, shop at 60 prismas, harness.
- **Slice 2 — counter and field size**: `counter_add`/`counter_reset`, `contador es N`, `tamaño del campo` both forms, `Hacer A con N`, shop at 100 prismas / 80 estrellas, harness.

Target branch `docs/modo-automatizacion-mvp` (PRs into `dev`); never
`production` directly. All new block labels are Spanish user-facing copy —
tildes, ñ and `¿ ¡` must be correct.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Recursive call freezes the tab | High without mitigation | Tick per action-less call + bounded frame depth |
| Depth bound surfaces as an error | Med | Reuse the silent `MAX_PASOS_CORRIDA` stop path |
| Old v2 snapshots fail to load | Low | `validarCampo` delegates to `validarPrograma`; no bump — flag if false |
| Editor complexity for the dual `tamaño del campo` | Med | Reuse existing numeric slot and pastilla cycling |

## Rollback Plan

No migration, no auth/RBAC, no deploy-pipeline surface. Each slice is one
revertable commit on `docs/modo-automatizacion-mvp`. Reverting restores the
prior blocks; saved fields keep loading because `EstadoCampo` schemaVersion is
unchanged. Slice 2 can be reverted independently of slice 1.

## Dependencies

Cuts 1–3 (shipped, commit `4231aa8`). No new packages.

## Success Criteria

- [ ] Una rutina definida una vez y llamada tres veces ocupa menos memoria que las tres copias.
- [ ] El mismo programa con `tamaño del campo` recorre la 3×3 y la 4×4.
- [ ] A recursive routine runs, stays pausable, and stops silently at the depth bound.
- [ ] `npm run build` and `node scripts/probar-automatizacion.mjs` pass on each slice.
- [ ] PROGRESION.md §6 no longer forbids recursion.
