---
run_id: rts-hero-rework-20260716-a
owner: systems-economy-designer
artifact_version: v2
status: evidence-ready
supersedes: systems/balance-model-v1.md
source_of_change: balance-directive-20260716
semantic_source: game-core.js
simulator_source: scripts/run-stage5-balance-sim.mjs
---

# Stage 5 balance model v2 — anti-dominance contract

## Decision

This revision treats the live cycle-007 observations as failing balance evidence, not as a passing playtest. It changes only deterministic semantic rules; it does not change `foeCooldown`, unit speed, telegraph timing, or any presentation preset.

| Directive defect | Semantic response | Verifiable consequence |
|---|---|---|
| DISRUPT-lock has no meaningful cost | Stage 5 `DISRUPT` costs `1 + disrupt_uses`: the two displayed SURGEs cost **1, then 2 Focus**. | Countering both consumes 3 of the 4 starting Focus; a third 1-Focus BRACE is the only no-damage response to the final STRIKE. |
| Two-button reaction clears Stage 5 | Stage 5 schedule is `SURGE → SURGE → STRIKE`, with 6 Integrity, 4 Focus, and 5 foe health. | `DISRUPT → DISRUPT → BRACE` is a 0-reward HOLD with 3 foe health, not a victory. |
| BRACE-only farms HOLD rewards | A HOLD awards **0 fragments**. Victory remains worth 2. | Five HOLDs settle to 0 fragments and 0 resolve marks. |
| Focus slack masks the finale | The core has no wall-clock Focus regeneration; Focus changes only through accepted commands. | The counter curve is deterministic and replayable; real-time presentation cannot refill the semantic ledger. |

## Per-stage counter-cost curve

The following is the semantic curve exercised by `scripts/run-stage5-balance-sim.mjs`. A dash means no SURGE counter is present in that schedule.

| Stage | Schedule | DISRUPT costs for its SURGEs | Start Focus | Foe health |
|---|---|---:|---:|---:|
| S1 | STRIKE, STRIKE, STRIKE | — | 3 | 6 |
| S2 | SURGE, STRIKE, STRIKE | 1 | 3 | 8 |
| S3 | STRIKE, SURGE, STRIKE | 1 | 4 | 10 |
| S4 | STRIKE, SURGE, SURGE | 1, 1 | 3 | 12 |
| S5 | SURGE, SURGE, STRIKE | **1, 2** | **4** | **5** |

S5's 3-Focus counter cost is deliberately 75% of its opening ledger. The counter itself still works and remains readable; its opportunity cost is now explicit instead of being refunded by hidden/passive regeneration.

## Stage 5 policy contract

| Policy | Commands | Result | Why it matters |
|---|---|---|---|
| DISRUPT lock / reactive two-button | DISRUPT, DISRUPT, BRACE | HOLD; 0 award; foe 3; Focus 0 | No longer a winning or rewarding dominant strategy. |
| BRACE only | BRACE, BRACE | DEFEAT_INTEGRITY at round 2 | Passive response cannot farm a settlement floor. |
| STRIKE only | STRIKE, STRIKE | DEFEAT_INTEGRITY at round 2 | The loss condition is reachable through legal commands. |
| Deliberate trade | STRIKE, DISRUPT, STRIKE | VICTORY; Integrity 2; Pressure 2; 2 award | The player can win by accepting the first visible SURGE exposure, preserving the second counter, and finishing on the final STRIKE. |

**BAL-INV-02 (dominance):** a policy that maps every SURGE to DISRUPT and every STRIKE to BRACE must not end S5 in VICTORY and must not earn fragments.

**BAL-INV-03 (loss reachability):** S5 must retain at least one fully accepted command sequence that ends in a defeat; a failed command or timeout alone does not satisfy this invariant.

**BAL-INV-04 (HOLD floor):** `awardFor(HOLD) === 0`, and an all-HOLD campaign earns zero fragments.

## P2 → P3 handoff

`game-core.js` is versioned as `stage1-rules-v2`; stale v1 records are rejected by version mismatch rather than silently replayed under the new economy. The P3 app imports `commandCost` and displays the current S5 DISRUPT cost rather than a static “1 focus” string; it also describes HOLD as a zero-fragment result. Cycle-007 retains ownership of real-time preset tuning; no `foeCooldown`, unit speed, or telegraph setting changed here.

The executable evidence and reducer tests are the gate for this model. A visual/E2E run remains required to verify that the live deployed UI exposes the dynamic cost and that no real-time path mutates Focus outside the reducer.
