# Cycle 1 retrospective — Cinder Span vertical-slice implementation

**Cycle date:** 2026-07-22  
**Owner:** game-production-director  
**Cycle mode:** bounded implementation and evidence review  
**Outcome:** **Stage 1 FIX**

## Retrospective verdict

| Status | Decision |
| --- | --- |
| **PASS** | **No.** The current Cinder Span implementation supplies partial evidence only; every G1–G8 gate remains `NOT MEASURED` / `NOT PASSED`. |
| **FIX** | **Yes.** The current browser verification passes, but the required gate artifacts remain incomplete. |
| **REDO** | **No.** The bounded, offline, no-commerce slice is implemented; the next work is measurement and correction, not a new concept cycle. |

Cycle 1 now has a bounded implementation receipt, not a release candidate. It does not establish a human playtest outcome, provider integration, rights review, runtime provider audit, full canon audit, balance approval, or a release claim.

## What was implemented

- Authored alternate Cinder Span wave compositions that select deterministically by seed.
- Critical-event feedback that exposes authored source, chance, and multiplier semantics.
- A deterministic non-combat lore-surprise display.
- Offline idle settlement with capped elapsed time, active-run preservation, and exactly-once settlement behavior.
- Local cue and narration fallback behavior without a provider dependency.
- An accessible touch D-pad supporting the movement-first automatic-combat loop.

The implementation preserves the existing Stage 1 boundary: offline/local behavior, no commerce, no runtime provider, no network dependency, and no new release surface.

## Current measured command receipts

| Artifact path(s) | Exact command | Current observed result | Interpretation |
| --- | --- | --- | --- |
| `tests/cinder-span-vertical-slice.test.mjs`; `tests/defense-idle-progression.test.mjs`; `tests/defense-observers-contract.test.mjs`; `tests/defense-cutscene.test.mjs`; `tests/defense-survivor-browser.cjs`; `tests/defense-run-simulation.test.mjs`; `tests/defense-expansion-contract.test.mjs` | `node --test tests/cinder-span-vertical-slice.test.mjs tests/defense-idle-progression.test.mjs tests/defense-observers-contract.test.mjs tests/defense-cutscene.test.mjs tests/defense-survivor-browser.cjs tests/defense-run-simulation.test.mjs tests/defense-expansion-contract.test.mjs` | **51 total: 51 passed, 0 failed; exit 0.** `tests/defense-survivor-browser.cjs` selected `ward-binder`, then `grave-pulse`. | The current receipt validates bounded implementation coverage. It does not validate Stage 1 completion or any gate. |
| `tests/defense-performance-browser.cjs` | `node tests/defense-performance-browser.cjs` | **PASS.** At `844x390`: RAF mean **16.665 ms**, **40 DOM nodes**, input **0.1/0.1 ms**. At `2056x1082`: RAF mean **16.665 ms**, **40 DOM nodes**, input **0.1/0.2 ms**. | Partial performance and interaction implementation evidence only. It is not a G4 immersion/readability result or a complete G6 operations/performance/telemetry receipt. |

The current seven-file command receipt is passing implementation coverage. It does not replace the required complete gate artifacts.

## G1–G8 status summary

| Gate | Measured value | Current artifact boundary | Retrospective conclusion |
| --- | --- | --- | --- |
| **G1 — narrative/worldview consistency** | `NOT MEASURED` | The test artifacts exercise local lore-surprise behavior, not the full final-content/payload audit at `qa/evidence/gates/G1-narrative-canon-audit.json`. | **FIX.** No complete W-01–W-05 and Stage-10 audit exists. |
| **G2 — rules and balance numbers** | `NOT MEASURED` | Alternate-wave and critical-event implementation exists; the required equal-budget five-archetype sweep at `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` does not. | **FIX.** No deterministic balance result exists. |
| **G3 — player-type diversity** | `NOT MEASURED` | No rotated-archetype fixture corpus or moderated rating artifact exists at `qa/evidence/gates/G3-archetype-rotation-and-playtest.jsonl`. | **FIX.** No player-type evidence exists. |
| **G4 — effects and animation immersion** | `NOT MEASURED` | `tests/defense-performance-browser.cjs` supplies the measured viewport values above, while the seven-file command exercises feedback behavior. Neither is the required capture, observer, or counterbalanced study at `qa/evidence/gates/G4-presentation-readability-and-playtest.json`. | **FIX.** Partial implementation evidence is not an immersion/readability pass. |
| **G5 — fairness and no-commerce reward balance** | `NOT MEASURED` | The slice remains no-commerce and has idle-settlement tests, but no parity/account/idle evidence exists at `qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl`. | **FIX.** No fairness result exists. |
| **G6 — operations, performance, and telemetry** | `NOT MEASURED` | `tests/defense-performance-browser.cjs` measures only the named mean RAF, DOM-node, and input values. No complete evidence exists at `qa/evidence/gates/G6-ops-perf-and-local-telemetry.json`. | **FIX.** No p95/long-frame, soak, local telemetry, privacy, rollback, resource, or network-disabled result exists. |
| **G7 — core loop** | `NOT MEASURED` | The seven-file command exercises core-loop behavior, including the browser selections above, but no full deterministic 90-second trace plus preregistered repeat study exists at `qa/evidence/gates/G7-loop-trace-and-repeat-study.jsonl`. | **FIX.** The core-loop gate has no complete evidence. |
| **G8 — novelty / striking element** | `NOT MEASURED` | No five-title comparison ledger or fixed-seed impression artifact exists at `qa/evidence/gates/G8-novelty-comparison-and-impression.json`. | **FIX.** No novelty result exists. |

## What held up

1. **The slice stayed bounded.** The implementation added authored variation, feedback, idle settlement, local fallback, and accessible touch controls without adding commerce, live-service behavior, runtime provider use, or a network requirement.
2. **Core state remains separated from observers.** The test artifacts cover deterministic replay, local presentation behavior, audio fallback, and offline telemetry-related behavior without declaring an observer or provider authoritative.
3. **Performance evidence is concrete but narrow.** `tests/defense-performance-browser.cjs` produced named viewport, RAF, DOM-node, and input observations instead of a target-only performance claim.

## What requires correction or measurement

| Risk / gap | Current fact | Required next evidence |
| --- | --- | --- |
| Core-loop evidence completeness | The current browser test selects `ward-binder`, then `grave-pulse`, but this is not a complete 90-second trace or repeat-study artifact. | `qa/evidence/gates/G7-loop-trace-and-repeat-study.jsonl`. |
| Deterministic balance | No equal-budget five-archetype sweep has been recorded. | Pinned build tuple and `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl`. |
| Novelty | No comparison ledger or fixed-seed impression task has been recorded. | `qa/evidence/gates/G8-novelty-comparison-and-impression.json`. |
| Presentation and operations | The browser performance command does not supply G4 readability/immersion evidence or all G6 operations evidence. | Captures, observer checks, target-device soak, p95/long-frame data, local telemetry/export-delete, rollback, resource scan, and network-disabled trace at their named QA paths. |
| Canon, fairness, and human outcomes | No full canon audit, paired parity evidence, or moderated player result exists. | G1/G5 artifacts and preregistered study evidence after deterministic fixtures are available. |
| Provider/fallback safety | Local fallback is implemented, but no asset provenance or compiled-output provider/secret scan is recorded. | Rights/provenance record if media is introduced, plus a static provider/secret scan; runtime provider code, network calls, credentials, signed URLs, and gameplay dependence remain prohibited. |

## Process correction for Stage 2

- Treat the latest named command receipt as implementation evidence, while retaining each gate's separate artifact requirements.
- Keep implementation coverage distinct from gate evidence: a passing unit, browser, or performance command cannot promote a gate without that gate's complete named artifact.
- Pin the build tuple before balance and novelty measurement, including source revision, rules/catalog/grammar/serializer versions, fixture IDs, device/browser, and viewport.
- Preserve the existing no-network/no-commerce boundary while measuring deterministic behavior.

## Next-cycle entry

**Exact next-cycle entry: Stage 2 — deterministic balance and novelty measurement only; not a release claim.**

Entry begins as a bounded deterministic balance and novelty measurement cycle. Stage 2 may then:

1. generate the G2 deterministic equal-budget five-archetype sweep;
2. generate the G8 five-title comparison ledger and fixed-seed impression artifact;
3. retain all other G1–G8 values as `NOT MEASURED` / `NOT PASSED` until their complete evidence exists; and
4. make no release, production-use, human-outcome, or gate-PASS claim.

Stage 2 is a bounded measurement cycle, not a release decision.
