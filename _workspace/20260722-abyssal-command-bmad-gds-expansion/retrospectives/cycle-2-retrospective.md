# Cycle 2 retrospective — deterministic balance and novelty measurement

**Cycle date:** 2026-07-22  
**Owner:** game-production-director  
**Cycle mode:** bounded G2/G8 deterministic measurement  
**Outcome:** **Stage 2 REDO**

## Retrospective verdict

| Status | Decision |
| --- | --- |
| **PASS** | **No.** G2 and G8 are **NOT MEASURED / NOT PASSED**; no G1–G8 gate is passed. |
| **FIX** | **No.** The evidence run did not expose a completed result requiring a bounded correction; it exposed missing prerequisite measurement capabilities. |
| **REDO** | **Yes.** Return to a narrow prerequisite implementation cycle for catalog-owned analytic fixtures and observer-safe events, then re-run G2 measurement. |

Cycle 2 is not a release decision. It does not authorize player-facing combat, catalog, reward, idle-return, monetization, provider, network, or G8 changes. The Stage 2 manifest limits this entry to G2/G8 evidence and explicitly withholds release and gate-PASS authority ([`production/task-manifest.md`](../production/task-manifest.md)).

## Evidence produced and verified

| Receipt | Exact command or artifact | Observed fact | Correct interpretation |
| --- | --- | --- | --- |
| Combined deterministic test receipt | `node --test tests/defense-run-simulation.test.mjs tests/cinder-span-vertical-slice.test.mjs` | 18 tests passed; 0 failed, cancelled, skipped, or todo. | Bounded deterministic simulation coverage only; not five-profile balance, EV/cooldown-share, human outcome, or gate evidence. |
| Cinder Span subset receipt | `node --test tests/cinder-span-vertical-slice.test.mjs` | 3 tests passed; 0 failed, cancelled, skipped, or todo. | Local wave-alternative, critical-semantic, and lore-surprise behavior only; not a G8 impression result. |
| Phase 2a tactical replay | `qa/playtest-report.md` | 15 rows (five current tactical loadouts × seeds 17/18/19) replayed byte-identically with FNV-1a `e185f567`; each reached `VICTORY`. | Deterministic fixture behavior under the recorded policy only. The fixtures are not the five analytic equal-budget profiles. |
| G8 artifact | `qa/evidence/gates/G8-novelty-comparison-and-impression.json` | Comparator context and three local deterministic checks are recorded. | G8 remains **NOT MEASURED / NOT PASSED** because no human impression session, score, or moderated first-exposure study exists. |

The command receipts were rerun from `/Users/jangyoung/orca/Abyssal-Surge`. The Stage 2 QA re-verification records the same receipts and their gate limits ([`qa/stage-2-reverification.md`](../qa/stage-2-reverification.md)).

## What held up

1. **Determinism was reported without overclaiming.** The 18/18 command and the independently recorded 15-row hash establish local reproducibility within the specified fixtures, seeds, and policy; they were not relabeled as parity, dominance, human, or gate evidence ([`qa/playtest-report.md`](../qa/playtest-report.md); [`qa/stage-2-reverification.md`](../qa/stage-2-reverification.md)).
2. **G8 has a bounded deterministic artifact.** The artifact records fixed-seed variation, a critical-hit semantic check, and a non-combat lore-surprise check, while retaining its missing human-session evidence ([`qa/evidence/gates/G8-novelty-comparison-and-impression.json`](../qa/evidence/gates/G8-novelty-comparison-and-impression.json)).
3. **The scope stayed measurement-only.** The deferred engineering response records no runtime, balance, reward, idle-return, or monetization change in Phase 2c ([`engineering/architecture-contract.md`](../engineering/architecture-contract.md)).

## What failed to become measurable

| Gap | Root cause | Consequence |
| --- | --- | --- |
| **XR-13 — equal-budget five-profile surface absent** | Phase 2a exercised baseline/companion tactical loadouts and one global commander crit profile, not the controlled Bulwark, Striker, Gambit, Conductor, and Rift analytic profiles. | G2 parity, target-band, and dominance conclusions are invalid. |
| **XR-14 — active-skill EV/cooldown accounting absent** | Current observations provide casts and projectile impacts but no general ordinary active-skill resolved-damage event. | Total active-skill EV and cooldown EV share are unmeasured. |
| **G8 human impression evidence absent** | The G8 artifact records no human session, no impression score, and no moderated first-exposure study. | G8 cannot satisfy the required QA impression threshold of at least 4/5. |

XR-13 and XR-14 are observed measurement-integrity gaps, not gameplay exploits. They are recorded in [`qa/exploit-register.md`](../qa/exploit-register.md) and re-verified in [`qa/stage-2-reverification.md`](../qa/stage-2-reverification.md). The G8 threshold and missing-evidence condition are defined by [`qa/gate-measurements.md`](../qa/gate-measurements.md) and the G8 artifact.

## Gate state at close

| Gate | State at cycle close | Reason |
| --- | --- | --- |
| **G1** | `NOT MEASURED / NOT PASSED` | Outside this G2/G8-only entry; no status change is inferred. |
| **G2** | **`NOT MEASURED / NOT PASSED`** | XR-13 and XR-14 prevent the required equal-budget five-profile sweep and auditable active-skill EV/cooldown accounting. |
| **G3** | `NOT MEASURED / NOT PASSED` | Outside this G2/G8-only entry; no status change is inferred. |
| **G4** | `NOT MEASURED / NOT PASSED` | Outside this G2/G8-only entry; no status change is inferred. |
| **G5** | `NOT MEASURED / NOT PASSED` | Outside this G2/G8-only entry; the PM contract does not make this fixture decision G5 evidence. |
| **G6** | `NOT MEASURED / NOT PASSED` | Outside this G2/G8-only entry; no status change is inferred. |
| **G7** | `NOT MEASURED / NOT PASSED` | Outside this G2/G8-only entry; no status change is inferred. |
| **G8** | **`NOT MEASURED / NOT PASSED`** | Local checks and comparator context do not substitute for a human impression session or score. |

[`qa/gate-measurements.md`](../qa/gate-measurements.md) remains the authoritative QA ledger. This retrospective does not promote any test, artifact, target, signature, or local deterministic check into a gate pass.

## Process correction

The next cycle must establish the measurement substrate before it asks for a G2 result:

- Treat the signed five-profile budget as a QA-only fixture contract, not a balance conclusion.
- Require catalog-owned fixture inputs and an explicit QA-only selection path; do not model the profiles as player-facing classes.
- Emit observer-only resolved-damage and cooldown/readiness records for every active-skill resolution, then prove that the events do not alter canonical state or outcomes.
- Re-run the equal-budget sweep only after those prerequisites are present; keep G2 **NOT MEASURED / NOT PASSED** until its named JSONL exists and is independently reviewed.
- Keep G8 **NOT MEASURED / NOT PASSED** until the separate fixed-seed human impression task and moderated first-exposure evidence exist.

The designer signed `g2-measurement-fixture-budget-v1` for instrumentation only, and PMD-06 authorizes five analytic fixture profiles plus observer-safe damage/cooldown records. Neither signature authorizes a combat retune, player-facing class, reward change, idle-return change, or monetization change ([`design/balance-sheet.md`](../design/balance-sheet.md); [`pm/negotiation-record.md`](../pm/negotiation-record.md)).

## Next authorized cycle

**Entry decision: prerequisite implementation cycle — narrow, measurement-only, and not a release.**

The next authorized work is exactly:

1. implement the signed catalog-owned analytic fixtures under `g2-measurement-fixture-budget-v1`;
2. implement a QA-only `createDefenseRun` profile-selection factory for the five controlled equal-authoring-budget fixtures;
3. implement local observer-safe active-skill resolved-damage and cooldown/readiness events; and
4. preserve the player-facing catalog and canonical outcomes, with no runtime balance, reward, idle, monetization, provider, or network change.

This scope follows the deferred architecture response for XR-13/XR-14 ([`engineering/architecture-contract.md`](../engineering/architecture-contract.md)). It does **not** authorize a release, a player-facing change, a retune, a gate pass, or a claimed human outcome. Only after this prerequisite cycle may QA attempt the named G2 evidence export; G8 still requires its distinct human impression evidence.

## Evidence ledger

- [`production/task-manifest.md`](../production/task-manifest.md) — bounded G2/G8 Stage 2 scope and review constraints.
- [`qa/stage-2-reverification.md`](../qa/stage-2-reverification.md) — test receipts and G2/G8 evidence limits.
- [`qa/playtest-report.md`](../qa/playtest-report.md) — Phase 2a runner, fixtures, 15-row replay, and FNV-1a digest.
- [`qa/exploit-register.md`](../qa/exploit-register.md) — XR-13 and XR-14 integrity gaps.
- [`qa/gate-measurements.md`](../qa/gate-measurements.md) — authoritative G1–G8 statuses, thresholds, and methods.
- [`qa/evidence/gates/G8-novelty-comparison-and-impression.json`](../qa/evidence/gates/G8-novelty-comparison-and-impression.json) — local G8 checks and absent human-study evidence.
- [`design/balance-sheet.md`](../design/balance-sheet.md) and [`pm/negotiation-record.md`](../pm/negotiation-record.md) — signed measurement-only fixture and observer contract.
- [`engineering/architecture-contract.md`](../engineering/architecture-contract.md) — deferred prerequisite implementation boundary.

## Measurement re-entry addendum — 2026-07-22

The prerequisite implementation cycle subsequently generated and independently audited [`qa/evidence/gates/G2-archetype-and-combat-sweep.json`](../qa/evidence/gates/G2-archetype-and-combat-sweep.json) and its [command receipt](../qa/evidence/gates/G2-archetype-and-combat-sweep-receipt.txt).

| New evidence | Observed fact | Retrospective treatment |
| --- | --- | --- |
| Controlled fixture export | 15 records, one for each of five analytic profiles × seeds 17/18/19; all record `digest_matched: true`. | Reproducible 360-tick fixture context only. |
| Command receipt | Exit 0; 15/15 replay equality; 0 mismatches; `INCOMPLETE` / `NOT_PASSED`. | Does not establish player-facing balance or a gate outcome. |
| Independent audit | Checksums, inputs, tuple coverage, and current catalog digest reconcile; evidence-package integrity passes. | The raw export is usable as a bounded measurement input, not as canonical G2 completion. |

**Re-entry decision: Stage 2 REDO, evidence completion only.** G2 remains **NOT MEASURED / NOT PASSED**: the export does not calculate the required 45–55% matchup win-rate, TTK ±15%, combo EV ceiling, or full active-skill EV/cooldown-share result; its `.json` path also does not satisfy the contract's named canonical JSONL artifact. G8 is unchanged, with its missing moderated human-impression evidence. The observed 84.323-second receipt-to-export timestamp difference is recorded for provenance; it does not invalidate the matching tuples, inputs, catalog digest, or checksums.

No balance, reward, idle, monetization, provider/network, release, or gate-PASS authority is granted by this addendum.

## Fail-closed runner closure update — 2026-07-22

The current re-entry delivered an implementation proof, not a corpus. [`g2-full-route-runner.js#L332-L460`](../../../g2-full-route-runner.js) and [`scripts/run-g2-full-route.mjs#L38-L45`](../../../scripts/run-g2-full-route.mjs) implement the headless admission-only path. The expected-tuple seed/tape references are reconciled to their canonical QA registers in [`g2-expected-tuples-v1.json#L12-L25`](../g2-expected-tuples-v1.json).

- **Verification:** `node --test tests/g2-full-route-runner.test.mjs` passed **6/6** on 2026-07-22. [`tests/g2-full-route-runner.test.mjs#L97-L158`](../../../tests/g2-full-route-runner.test.mjs) proves the CLI exits **1** by design and emits only `manifest` → `run_stopped` (`FAIL_COLLECTION_NOT_AUTHORIZED`) → `summary`, all `INCOMPLETE` / `NOT_PASSED`.
- **Collection result:** the same supporting test asserts `started_run_count: 0`, `terminal_run_count: 0`, `collection_started: false`, and no candidate, terminal, outcome, or metric record. This is **zero full-route corpus collection**.
- **Active blocker:** [`g2-full-route-runner.js#L341-L390`](../../../g2-full-route-runner.js) adds `FAIL_COLLECTION_NOT_AUTHORIZED` only after canonical register checks succeed. The active blocker is therefore absent signed collection/runner admission facts, not stale tuple-digest provenance.
- **Provenance regression:** [`tests/g2-full-route-runner.test.mjs#L273-L333`](../../../tests/g2-full-route-runner.test.mjs) proves a self-consistent expected-tuple cross-register digest mismatch exits **1** with `FAIL_REGISTER_PROVENANCE_MISMATCH` and no candidate/terminal/outcome/metric record. This protects future provenance integrity; it does not change the reconciled current-register failure, `FAIL_COLLECTION_NOT_AUTHORIZED`.

**Retrospective re-entry decision: Stage 2 `REDO`.** The next narrow prerequisite is to bind and supply real map/wave/terminal admission facts and signed collection authorization. Per [`qa/g2-coverage-matrix.md#L111-L119`](../qa/g2-coverage-matrix.md), M6 may be extended only after its signed multi-skill fixture/comparator, runner/role attestations, and independent R1/R2 review exist. G2 remains **NOT MEASURED / NOT PASSED**; G8 remains separately **NOT MEASURED / NOT PASSED**; release remains **BLOCKED — do not deploy** ([`ops/release-readiness.md#L1-L7`](../ops/release-readiness.md)). This update grants no collection, gate, or release authority.
