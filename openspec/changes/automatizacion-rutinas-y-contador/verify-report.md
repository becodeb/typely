# Verification Report: automatizacion-rutinas-y-contador — Slice 1 (routines)

**Scope**: Phases 1–4 of `tasks.md` only (`def`/`call`, capacity accounting,
tick/depth safety, shop entry, PROGRESION.md §6, harness R1–R8). Slice 2
(counter, `tamaño del campo`, `Hacer A con N` — Phases 5–7) is intentionally
NOT implemented and is out of scope for this verification pass.

**Verdict: PASS WITH WARNINGS**

## Completeness (tasks.md)

| Phase | Status |
|---|---|
| 1 — `programa.ts` foundation (1.1–1.8) | All checked, code confirmed present |
| 2 — interpreter safety (2.1–2.4) | All checked, code confirmed present |
| 3 — editor and shop (3.1–3.6) | All checked, code confirmed present |
| 4 — docs and full verification (4.1–4.3) | All checked, confirmed |
| 4.4 — manual browser drag/drop check | Correctly left unchecked — requires a human in a browser. Not reported as a defect. |
| 4.5 — manual old-snapshot browser check | Correctly left unchecked — code-level regression claimed covered by M8/R8; browser/localStorage round-trip genuinely not run. Not reported as a defect. |
| 5–7 (Slice 2) | Correctly untouched — no code for `Veces`, `NodoContador`, `tamaño del campo`, `Hacer A con N` exists anywhere in the diff |

## Gate evidence (re-run independently by this verify pass, not taken on trust)

| Command | Exit | Result |
|---|---|---|
| `npm run build` (`tsc --noEmit && vite build`) | 0 | Clean; only a pre-existing "chunk >500kB" advisory unrelated to this change |
| `node scripts/probar-automatizacion.mjs` | 0 | **63/63 pass**, including all 8 new `RUTINAS` cases R1–R8 |

`build_output_sha256=1b5caa5d89f176ba0192815644228be57d471368bfc94c07bdfef395a5864091`
`test_output_sha256=b9b607ca6d4a24bc520134cdb868dd9c33e5d3c5441120e200f8641107ba82ec`

## Spec compliance matrix (`specs/automatizacion-rutinas/spec.md`)

| Requirement | Scenario | Evidence | Status |
|---|---|---|---|
| Routine definition and call | Define and call | R2 (`correrVivo` + `expandir` agree on nodoIds) | PASS |
| Routine definition and call | Call precedes definition | `rutinasDe` scans whole root array before resolving; R2/R7 exercise this ordering implicitly | PASS |
| Recursion is allowed, direct/indirect | Direct recursion validates | R7 (`validarPrograma` on self-referential `def`/`call` via R4/R5 fixtures) + R4 runtime | PASS |
| Recursion is allowed, direct/indirect | Indirect recursion validates | R5 | PASS |
| Capacity charges definition once | Three calls cheaper than three copies | R3: `capacidadUsada` = 7 vs 9, exact match to design.md table | PASS |
| Action-less call costs a tick | Empty-effect recursive call ticks | R6: 32 ticks, zero actions, `p.tipo === "tick"` on every step | PASS |
| Action-less call costs a tick | Non-double-charged action call | R2 (`move_forward` returned, not tick) | PASS |
| Frame-stack depth bounded, degrades silently | Unbounded recursion stops silently | R4/R5/R6: exactly 32 steps, `terminado: true`, no exception/error path in code | PASS |
| Frame-stack depth bounded, degrades silently | Depth bound does not trip on normal use | Covered generically by pre-existing I-series/E-series harness cases exercising `maxProfundidad=2` nesting without hitting `MAX_LLAMADAS_ANIDADAS` | PASS (indirect) |
| Routine body depth validated independently | Body nests to normal limit | R7 (`Si [Repetir [Hacer B]]`, 2 levels, accepted) | PASS |
| Routine body depth validated independently | Call adds no structural depth to caller | R7 (undefined-letter call as leaf; `profundidadDe`/`cabeA` reviewed directly in `programa.ts`) | PASS |
| Routine shop entry — 60 prismas, era 3 | Hidden before era 3, purchasable at era 3 | **No dedicated runtime test.** `reveladas()`/`comprar()` are fully generic/data-driven (verified by source read) and the `rutinas` entry uses the identical `{lado, requiere}` shape already exercised by harness case 26 and the `si→sino→mientras→siempre` `requiere` chain — but no test asserts `rutinas` specifically appears/disappears at the era-3 boundary. | **WARNING — untested at the specific-entry level, though the mechanism is generic and analogous cases pass** |
| Old saved programs keep validating | Pre-cut-4 v2 snapshot still loads | M8 covers v1→v2 migration with an empty program; R8 covers a v2 snapshot WITH new `def`/`call` nodes staying at `schemaVersion: 2`. Neither is a snapshot with a *populated legacy-only* program (repeat/if/while) run through `validarCampo` post-change — but every other pre-existing harness case (I1–I7, E1–E4, M1–M7, 22–29) does exactly that and all 63 pass, so regression is covered in aggregate, just not by one named case. | PASS (via aggregate regression), matches tasks.md's own honest self-assessment |
| New block labels are correct Spanish | Labels match design doc | `nombreDe()` returns `Mi rutina ${rutina}` / `Hacer ${rutina}`, verified verbatim against PROGRESION.md §5 table (`Mi rutina A/B/C` / `Hacer A/B/C`) | PASS |

## Specific hard checks requested

1. **Recursion genuinely allowed** — confirmed by reading `validarNodo` in `programa.ts`: the `call` branch (lines ~275–282) never checks profundidad and carries an explicit comment that it is never rejected for recursion, direct or indirect. No cycle-detection code exists anywhere in the validator.
2. **Every interpreter step is action or tick, never zero-time** — confirmed. `interprete.ts`'s call-frame-end branch (`esLlamada(c)` check) returns `tic(c)` when `marco.acciones === 0`. The tick's actual real-world cost is applied uniformly at the call site in `AutomatizacionPage.tsx:198`: `p.tipo === "tick"` schedules `Math.max(80, Math.round(msPorAccion(e) / 4))`, the same path already used for `while`/`forever` ticks — no special-casing needed or added for calls, so the invariant is structural, not a one-off patch.
3. **`MAX_LLAMADAS_ANIDADAS = 32` bound** — confirmed skip-silent behavior: `if (llamadasEnPila() >= MAX_LLAMADAS_ANIDADAS) continue;` in `interprete.ts` — the call is dropped with no error state, the containing frame naturally ticks/unwinds. R4/R5/R6 all runtime-confirm exactly 32 steps and `terminado: true` with no error path.
4. **Capacity accounting 7 vs 9** — confirmed both by direct reading of `capacidadUsada` (generic container/leaf sum, zero special-casing for `def`/`call`) and by R3's runtime assertion (`igual(..., 7, ...)` / `igual(..., 9, ...)`), matching design.md's table exactly.
5. **Per-body independent depth budget** — confirmed: `validarNodo`'s `def` branch validates its body with `profundidad = 0` (own budget), and `profundidadDe` in `programa.ts` resets to 0 when descending into a `def` branch, which is the single change that makes `insertarAntes`/`insertarEn`/`colocar`/`moverNodo` honor it without their own edits (task 1.6's claim is correct — verified by reading `profundidadDe`, `cabeA`, and the four consumer functions).
6. **No `EstadoCampo.schemaVersion` bump** — confirmed. `almacenamiento.ts::validarCampo` still accepts only `version === 1 || version === 2` and always emits `schemaVersion: 2` on output; program shape is fully delegated to `validarPrograma`. R8 exercises a `def`/`call` program through `validarCampo` and confirms `schemaVersion` stays 2.
7. **PROGRESION.md §6 edit** — confirmed via diff: the old "sin recursión" sentence is fully removed; the replacement text is byte-identical to design.md's prescribed replacement, in grammatically correct Spanish with correct tildes (recursión, sí misma is no longer used, acotada, etc.). No other paragraph in the diff was touched — the diff is a clean 8-line replacement of exactly lines 167–169.
8. **`TOPE_LLAMADAS_EXPANDIR` duplication deviation** — judged sound but not optimal. `programa.ts` cannot import `MAX_LLAMADAS_ANIDADAS` from `interprete.ts` without creating a real circular import (`interprete.ts` already imports from `programa.ts`). Defining a same-valued sibling constant with a cross-referencing comment in both files is a reasonable pragmatic call for an MVP safety cap (not a `balance.ts` tuning knob, so drift risk from playtesting changes is low). However, this is still a genuine DRY violation: nothing prevents the two values from silently diverging if either is edited without updating the other. **SUGGESTION**: extract both constants into a small shared module (e.g. `src/utils/automatizacion/limites.ts`) that both `programa.ts` and `interprete.ts` import, which would fully eliminate the cycle risk and the duplication with minimal effort. Rated WARNING, not CRITICAL, given the low practical drift risk and the honest documentation already in place.
9. **Slice 1 self-containment** — confirmed via targeted grep: no `Veces` type, no `NodoContador`/`TipoContador`, no `"lado"` value-token, no `tamaño del campo` string anywhere in `programa.ts` or `interprete.ts`. `NodoCall` has no `veces` field. Slice 2 can layer on top cleanly per design.md's stated plan.
10. **Scope creep** — one file outside the feature's intended surface was modified: **`.atl/skill-registry.md`** (a full rebuild — unrelated to `automatizacion-rutinas-y-contador`, not listed in design.md's File Changes table, not mentioned in any task). This is almost certainly a `sdd-init`-phase side effect from this session rather than something the apply agent introduced on purpose, but it is real diff noise sitting on this feature branch. **WARNING**: recommend excluding this file from the Slice 1 PR (or committing it separately as unrelated housekeeping) before opening the PR into `dev`, since design.md's ≈385-line estimate and the review-workload budget did not account for it. No other file outside the design.md table was touched; `AutomatizacionPage.tsx` correctly has a zero-line diff matching task 3.6's claim that no code change was needed there.

## Issues

### CRITICAL
None.

### WARNING
- W1 — No dedicated runtime test for the routine shop entry's era-3 reveal/purchase gate (spec scenario "Hidden before era 3, purchasable at era 3"). The underlying `reveladas()`/`comprar()` mechanism is generic and proven by structurally identical existing cases, but no assertion targets the `rutinas` key specifically.
- W2 — `TOPE_LLAMADAS_EXPANDIR` in `programa.ts` duplicates `MAX_LLAMADAS_ANIDADAS` from `interprete.ts` by value rather than by import, due to a real circular-import constraint. Documented and low-risk, but a future edit to one without the other would silently diverge the "exam" (`expandir`) path from the live interpreter's call-depth bound.
- W3 — `.atl/skill-registry.md` was modified on this branch and is unrelated to this SDD change; should not ship in the Slice 1 PR diff.

### SUGGESTION
- S1 — Extract `MAX_LLAMADAS_ANIDADAS`/`TOPE_LLAMADAS_EXPANDIR` into one shared constants module imported by both `programa.ts` and `interprete.ts`, removing both the duplication and the circular-import constraint that currently forces it.
- S2 — Consider adding one small harness case asserting `rutinas` is absent from `reveladas(e)` at `lado: 2` and present + purchasable at `lado: 3` with `saldos.prisma >= 60`, closing W1 with the same low-cost pattern already used for `capacidad`/`si`/`sino`/`mientras`/`siempre`.

## Design coherence

All architecture decisions in `design.md` were checked against the shipped code and match: container/leaf capacity accounting unchanged, `MAX_LLAMADAS_ANIDADAS = 32` as a safety cap outside `balance.ts`, the tick-per-empty-round invariant, the letter+colour routine identity, and the `def`/`call` node shapes exactly as specified in the Interfaces/Contracts section. The one recorded deviation (item 8/W2 above) was disclosed by the apply agent and is judged sound.

## Final Verdict

**PASS WITH WARNINGS** — Slice 1 is complete, both gates are genuinely green (verified independently, not taken on trust), and every hard-check item requested for this verification holds up under direct source inspection plus runtime evidence. Three WARNING-level and two SUGGESTION-level items are recorded above for the orchestrator/user; none block proceeding, but W3 (unrelated file on the branch) should be resolved before the Slice 1 PR is opened.
