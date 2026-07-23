# Stage 2 director gate review — balance and novelty measurement

**Review date:** 2026-07-22  
**Review owner:** game-production-director  
**Operating mode:** bounded deterministic measurement review  
**Scope:** G2 and G8 evidence only. The Stage 2 manifest assigns the deterministic fixture sweep to G2, the fixed-seed comparison/impression artifact to G8, and the director review to G2/G8; it authorizes neither a release nor a gate PASS ([`production/task-manifest.md`](../task-manifest.md)).

## Director decision

| Decision | Status | Evidence-based reason |
| --- | --- | --- |
| **PASS** | **DENIED** | G2 has only a bounded canonical 5-profile × 3-seed / 360-tick diagnostic, not its required preregistered paired full-route/matchup, TTK, combo, and threshold evidence. G8 lacks the required human QA impression result. |
| **FIX** | **NOT SELECTED** | The historical XR-13/XR-14 observation-surface gap is corrected for the bounded diagnostic; the remaining work is full-G2 preregistration and full-route measurement, not a gate correction. |
| **REDO** | **REQUIRED** | Complete the approved full-G2 preregistration and paired full-route collection before re-measuring G2. |

**Stage 2 disposition: REDO — not a release decision.** G2 and G8 are **NOT MEASURED / NOT PASSED**. No G1–G8 gate is marked passed by this review.

## Verified command receipts

Commands were rerun from the simulation source root, `/Users/jangyoung/orca/Abyssal-Surge`.

| Exact command | Observed result | Evidence boundary |
| --- | --- | --- |
| `node --test tests/defense-run-simulation.test.mjs tests/cinder-span-vertical-slice.test.mjs` | **18 tests passed; 0 failed, cancelled, skipped, or todo.** | Confirms bounded deterministic local simulation coverage. It does not measure equal-budget five-profile parity, active-skill EV/cooldown share, player outcomes, or a gate pass. |
| `node --test tests/cinder-span-vertical-slice.test.mjs` | **3 tests passed; 0 failed, cancelled, skipped, or todo.** | Confirms the Cinder Span wave-alternative, critical-semantic, and lore-surprise checks. It does not measure a five-title human impression score or pass G8. |

The Phase 2a replay corpus separately records 15 tactical-fixture rows—five current loadouts across seeds 17, 18, and 19—that replayed byte-identically with FNV-1a `e185f567`; all rows reached `VICTORY`. That corpus is bounded simulation evidence, not the five analytic G2 profiles and not a parity, dominance, EV, cooldown-share, or human-outcome result ([`qa/playtest-report.md`](../../qa/playtest-report.md); [`qa/stage-2-reverification.md`](../../qa/stage-2-reverification.md)).

## Gate state

| Gate | Measurement state | Verdict | Evidence and limit |
| --- | --- | --- | --- |
| **G1 — narrative/worldview consistency** | `NOT MEASURED` | `NOT PASSED` | Not evaluated in this G2/G8-only entry; the QA ledger remains authoritative. |
| **G2 — rules and balance numbers** | **`NOT MEASURED`** | **`NOT PASSED`** | `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` is integrity-valid for a bounded 5-profile × 3-seed / 360-tick diagnostic. XR-13/XR-14 are resolved for that observation surface, but full-G2 preregistration and paired full-route/matchup, TTK, combo, coverage, and threshold evidence remain blocked. |
| **G3 — player-type diversity** | `NOT MEASURED` | `NOT PASSED` | Not evaluated in this G2/G8-only entry; the QA ledger remains authoritative. |
| **G4 — effects and animation immersion** | `NOT MEASURED` | `NOT PASSED` | Not evaluated in this G2/G8-only entry; the QA ledger remains authoritative. |
| **G5 — fairness and no-commerce reward balance** | `NOT MEASURED` | `NOT PASSED` | Not evaluated in this G2/G8-only entry; the PM contract explicitly leaves G5 unchanged. |
| **G6 — operations, performance, and telemetry** | `NOT MEASURED` | `NOT PASSED` | Not evaluated in this G2/G8-only entry; the QA ledger remains authoritative. |
| **G7 — core loop** | `NOT MEASURED` | `NOT PASSED` | Not evaluated in this G2/G8-only entry; the QA ledger remains authoritative. |
| **G8 — novelty / striking element** | **`NOT MEASURED`** | **`NOT PASSED`** | The artifact verifies three local deterministic checks and comparator-source context, but no human impression session, impression score, or moderated first-exposure study exists. |

The authoritative G2 and G8 methods and thresholds remain those in [`qa/gate-measurements.md`](../../qa/gate-measurements.md): G2 requires an equal-budget deterministic sweep over Bulwark, Striker, Gambit, Conductor, and Rift hybrid; G8 requires at least one element found in no more than two of at least five comparables **and** a QA impression of at least 4/5.

## Root cause and evidence boundary

### G2: historical observation-surface gap — superseded for the bounded diagnostic

- **XR-13 (historical):** Phase 2a used baseline plus companion tactical loadouts. The canonical `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` now records the five signed equal-budget analytic profiles; this resolves fixture selection for the bounded diagnostic only.
- **XR-14 (historical):** Phase 2a observations lacked general ordinary active-skill resolved-damage events. The canonical diagnostic now retains detached active-skill and cooldown accounting records; this resolves event capture for the bounded diagnostic only.
- **Remaining G2 blocker:** the bounded diagnostic is `INCOMPLETE / NOT_PASSED`, not a full G2 result. Required full-G2 preregistration approvals and paired full-route/matchup, TTK, combo-comparator, coverage, and threshold-decision evidence remain outstanding.

### G8: deterministic evidence is incomplete gate evidence

The G8 artifact records local deterministic confirmation of seed variation, critical semantics, and lore surprise; the three authored Cinder Span assertions pass. It also explicitly records `human_impression_session_conducted: false`, no score, and no moderated objective-direction first-exposure study. Its gate state remains **NOT MEASURED / NOT PASSED** ([`qa/evidence/gates/G8-novelty-comparison-and-impression.json`](../../qa/evidence/gates/G8-novelty-comparison-and-impression.json)).

## Historical prerequisite implementation record — completed

**Supersession note:** the prerequisite implementation described below completed and produced the canonical bounded diagnostic at [`qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl`](../../qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl). This historical record does not authorize a gate pass; the only remaining G2 work is the approved full-G2 preregistration and paired full-route measurement.

1. Add the signed `g2-measurement-fixture-budget-v1` analytic fixtures to the catalog as QA-only inputs.
2. Add a QA-only `createDefenseRun` profile-selection path that materializes the five equal-authoring-budget profiles under controlled inputs.
3. Emit local, observer-only active-skill resolved-damage records (`source`, `target`, `baseDamage`, `finalDamage`, `simTick`) and cooldown/readiness records sufficient to audit EV and cooldown share.
4. Preserve canonical simulation state and outcomes, the current player-facing catalog, and the existing offline/no-commerce boundary.

This entry is authorized by the designer's measurement-instrumentation-only signature and PMD-06; it is not authorization for player-facing classes, combat or catalog retunes, rewards, idle return, monetization, G8 changes, network/provider changes, or release ([`design/balance-sheet.md`](../../design/balance-sheet.md); [`pm/negotiation-record.md`](../../pm/negotiation-record.md); [`engineering/architecture-contract.md`](../../engineering/architecture-contract.md)).

The canonical bounded JSONL now exists and has been independently reviewed for integrity. A later G8 impression task remains required before G8 can be measured; this review does not infer or authorize a human outcome.

## Source ledger

- [`production/task-manifest.md`](../task-manifest.md) — Stage 2 scope, gate ownership, and no-release/no-PASS review constraint.
- [`qa/stage-2-reverification.md`](../../qa/stage-2-reverification.md) — rerun receipts, G2/G8 limits, and deferred responses.
- [`qa/playtest-report.md`](../../qa/playtest-report.md) — Phase 2a tuple, 15-row replay, and FNV-1a receipt.
- [`qa/exploit-register.md`](../../qa/exploit-register.md) — XR-13 and XR-14 observations.
- [`qa/evidence/gates/G8-novelty-comparison-and-impression.json`](../../qa/evidence/gates/G8-novelty-comparison-and-impression.json) — G8 local-check and missing-session evidence.
- [`design/balance-sheet.md`](../../design/balance-sheet.md) and [`pm/negotiation-record.md`](../../pm/negotiation-record.md) — signed measurement-only fixture/observer contract.
- [`engineering/architecture-contract.md`](../../engineering/architecture-contract.md) — deferred multi-file measurement-surface boundary.
- [`qa/gate-measurements.md`](../../qa/gate-measurements.md) — authoritative G1–G8 measurement states and gate methods.

## Prerequisite implementation receipt — 2026-07-22

At the close of the prerequisite implementation cycle, before the later raw and canonical diagnostic addenda, it had not yet produced the named G2 JSONL artifact, a parity result, a human outcome, or a gate pass.

| Required capability | Delivered evidence | Boundary |
| --- | --- | --- |
| Signed five-profile selection | `MEASUREMENT_FIXTURE_BUDGET_ID` and immutable `MEASUREMENT_PROFILES` in `defense-catalog.js`; catalog-only `measurementProfileId` selection in `createDefenseRun` | Profile selection is QA-only. Unknown or absent IDs retain the ordinary run path. |
| Controlled fixture state | Selected runs receive their signed integrity, basic damage/cadence, crit profile, and one active skill; companions, rewards, runtime item modifiers, growth offers, and additional skills are suppressed in `defense-run-simulation.js` | This is not a player-facing class, balance retune, reward, idle-return, or monetization change. |
| Active-skill/cooldown accounting | `SKILL_RESOLVED_DAMAGE`, `SKILL_COOLDOWN_SET`, and `SKILL_COOLDOWN_READY` expose target-level resolved facts and the actual readiness tick; `defense-telemetry.js` retains their allowlisted fields without same-tick target collapse | Observer records do not mutate canonical simulation state. |
| Regression evidence | `node --test tests/defense-run-simulation.test.mjs tests/defense-observers-contract.test.mjs` — **29 passed; 0 failed, cancelled, skipped, or todo** | Covers signed tuples, ordinary unknown-ID equivalence, 360-tick fixture isolation, real fixture-to-telemetry target/SET/READY flow, and target-sensitive deduplication. It is not a G2 sweep. |

**Historical prerequisite-cycle verdict: PASS — implementation review only.** At that milestone, XR-13/XR-14 were resolved but the canonical JSONL had not yet been generated; the later addendum supersedes that intermediate state. **Current Stage 2 remains REDO for measurement:** canonical `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` is bounded and G2 remains **NOT MEASURED / NOT PASSED** pending approved full-G2 preregistration and paired full-route evidence; G8 is unchanged at **NOT MEASURED / NOT PASSED** pending its required human impression evidence. No G1–G8 gate is passed by this receipt.

## Raw G2 execution addendum — 2026-07-22

The prerequisite instrumentation receipt at lines 80–91 is now followed by a **raw, controlled G2 fixture export**:

| Evidence | Observed result | Correct interpretation |
| --- | --- | --- |
| Historical raw export: [`qa/evidence/gates/G2-archetype-and-combat-sweep.json`](../../qa/evidence/gates/G2-archetype-and-combat-sweep.json) | 15 JSONL rows: Bulwark, Striker, Gambit, Conductor, and Rift × seeds 17/18/19; every row reports `digest_matched: true`. | Superseded as the current evidence path by the correctly named canonical [`qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl`](../../qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl); neither artifact is a completed-route, matchup, balance, or human-outcome result. |
| [`qa/evidence/gates/G2-archetype-and-combat-sweep-receipt.txt`](../../qa/evidence/gates/G2-archetype-and-combat-sweep-receipt.txt) | Exit 0; 15 completed runs; replay equality 15/15; digest mismatches 0; `INCOMPLETE` / `NOT_PASSED`. | Raw reproducibility receipt only. |
| Independent evidence audit | All 15 expected tuples appear exactly once; every run and summary checksum matches; current catalog digest matches the export. | **Evidence-package integrity: PASS. G2: NOT PASSED.** |

The audit identified an 84.323-second receipt-to-export timestamp offset. Counts, command target, input-tape digests, catalog digest, and result fields agree; the offset is a start-versus-export timing discrepancy, not a tuple or checksum contradiction.

**Historical correction:** the original raw `.json` export was superseded by the canonical [`qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl`](../../qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl) documented below. The canonical file is integrity-valid but bounded to 5 profiles × 3 seeds / 360 ticks; it does not measure the G2-required 45–55% matchup win rate, TTK within ±15%, combo EV ceiling, or full active-skill EV/cooldown-share conclusion. G8 remains unchanged at **NOT MEASURED / NOT PASSED** pending human impression evidence. No G1–G8 gate is passed.

The follow-up may only extend measurement evidence. It must not retune player-facing catalog values, rewards, idle return, monetization, provider/network behavior, or release scope.

## Canonical diagnostic correction — 2026-07-22

The G2 runner now retains detached public snapshot events after every tick rather than reading only the terminal snapshot. It generated the correctly named [`G2-archetype-and-combat-sweep.jsonl`](../../qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl): one manifest, 15 profile/seed runs, and one summary.

| Audit fact | Result | Gate interpretation |
| --- | --- | --- |
| Package integrity | 17/17 JSONL records and checksums valid; exactly five profiles × seeds 17/18/19; 15/15 matching replay digests; catalog digest matches every record. | Evidence-package integrity **PASS** only. |
| Corrected observation | 33 active casts, 6 active hits, 3,600 active damage, 55 basic fires/hits, 56,070 basic damage, 33 cooldown sets, and 21 observed ready events; every observed ready tick matches its configured boundary. | The final-tick event-loss defect is resolved for this bounded diagnostic slice. |
| Explicit limit | All 15 runs end `INCOMPLETE_WINDOW`; manifest and summary declare `INCOMPLETE / NOT_PASSED`. | This is not full-route matchup, TTK, combo, critical-distribution, mechanics, or observer-invariance evidence. |

**Current Stage 2 disposition remains REDO.** The next full collection cannot start until [`qa/g2-canonical-preregistration.md`](../../qa/g2-canonical-preregistration.md) has the required assessment-unit, terminal-outcome, TTK-cohort, combo-comparator, coverage-matrix, and full-route-runner approvals. G2 remains **NOT MEASURED / NOT PASSED**; G8 remains **NOT MEASURED / NOT PASSED** pending its distinct human-impression evidence. No release or player-facing change is authorized.

## Current full-route runner evidence and disposition — 2026-07-22

This addendum supersedes only the earlier in-document assertion that stale expected-tuple seed/tape provenance is the active fail-closed reason. The tuple links are reconciled in [`g2-expected-tuples-v1.json#L12-L25`](../../g2-expected-tuples-v1.json); the current headless admission runner is implemented in [`g2-full-route-runner.js#L332-L460`](../../../../g2-full-route-runner.js) and invoked by [`scripts/run-g2-full-route.mjs#L38-L45`](../../../../scripts/run-g2-full-route.mjs).

| Supporting command / artifact | Observed result | Director finding |
| --- | --- | --- |
| `node --test tests/g2-full-route-runner.test.mjs` | **6 tests passed, 0 failed** on 2026-07-22. The test's canonical-register CLI invocation asserts exit **1** by design. | The runner implementation and its fail-closed test contract hold; this is not a collection pass or G2 measurement. |
| [`tests/g2-full-route-runner.test.mjs#L109-L158`](../../../../tests/g2-full-route-runner.test.mjs) | Output is exactly `manifest` → `run_stopped` → `summary`, with `FAIL_COLLECTION_NOT_AUTHORIZED`, `INCOMPLETE` / `NOT_PASSED`, zero started runs, zero terminal runs, `collection_started: false`, and no outcome or metric records. | There is **no full-route corpus**, no candidate/terminal result, and no balance conclusion. |
| [`tests/g2-full-route-runner.test.mjs#L273-L333`](../../../../tests/g2-full-route-runner.test.mjs) | A self-consistent cross-register digest mismatch exits **1** with `FAIL_REGISTER_PROVENANCE_MISMATCH`; it admits no candidate and produces no started/terminal, outcome, or metric record. | This regression protects against future provenance drift. It does not alter the current reconciled-register stop, `FAIL_COLLECTION_NOT_AUTHORIZED`. |
| [`g2-full-route-runner.js#L341-L390`](../../../../g2-full-route-runner.js) | After valid cross-register provenance, the sole no-failure admission stop is missing `signed collection authorization`. | The active failure is absent collection/runner admission facts—not stale digest mismatch. |

**Director disposition: Stage 2 `REDO` — not `PASS`, not `FIX`.** Before any collection, bind and supply real signed map/wave/terminal admission facts and signed collection authorization; [`qa/g2-coverage-matrix.md#L111-L119`](../../qa/g2-coverage-matrix.md) also requires runner/role attestations and R1/R2 review. Extend M6 only after its signed multi-skill fixture and comparator population exist ([`qa/g2-coverage-matrix.md#L113-L117`](../../qa/g2-coverage-matrix.md)). G2 is **NOT MEASURED / NOT PASSED**; G8 is separately **NOT MEASURED / NOT PASSED**; release remains **BLOCKED — do not deploy** ([`ops/release-readiness.md#L1-L7`](../../ops/release-readiness.md)). No release or gate pass is issued.
