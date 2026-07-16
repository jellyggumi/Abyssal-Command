---
run_id: rts-hero-rework-20260716-a
owner: systems-economy-designer
artifact_version: v2
status: evidence-ready
supersedes: systems/simulator-evidence-v1.md
input_artifacts:
  - systems/balance-model-v2.md
  - game-core.js
  - scripts/run-stage5-balance-sim.mjs
source_hashes_sha256:
  scripts/run-stage5-balance-sim.mjs: eaacea28ac8374c6b0d63d36cbfaf1fee8431764b8d421308833cb72bfd1733c
  game-core.js: 358c4663668c850ca7d8de3a80db69d7461d8a73bf2638e989c732858592414f
---

# Stage 5 balance simulator evidence v2

## Reproduction

```sh
node scripts/run-stage5-balance-sim.mjs
node --test tests/game-core.test.mjs tests/playtest-5-stages.test.mjs
```

The simulator imports the shipped deterministic reducer. It exhaustively evaluates all 64 three-command plans over the Stage 5 schedule and separately reports named policies. A plan that contains an illegal command is recorded as `ACTIVE`/invalid rather than transformed into a successful run. Percentiles use nearest-rank over that complete policy-plan space. They are a distribution of declared command policies, **not** player telemetry or a claim about human skill.

## Exact observed output

```text
model=stage5-balance-sim-v1
rules_version=stage1-rules-v2
stage5_schedule=SURGE,SURGE,STRIKE
counter_cost_curve=S1:- S2:1 S3:1 S4:1,1 S5:1,2
disrupt_lock=plan:DISRUPT,DISRUPT,BRACE|outcome:HOLD|award:0|integrity:6|pressure:0|focus:0|foe:3|rejection:none
reactive_two_button=plan:DISRUPT,DISRUPT,BRACE|outcome:HOLD|award:0|integrity:6|pressure:0|focus:0|foe:3|rejection:none
brace_only=plan:BRACE,BRACE|outcome:DEFEAT_INTEGRITY|award:0|integrity:0|pressure:4|focus:2|foe:5|rejection:none
strike_only=plan:STRIKE,STRIKE|outcome:DEFEAT_INTEGRITY|award:0|integrity:0|pressure:4|focus:2|foe:1|rejection:none
deliberate_trade=plan:STRIKE,DISRUPT,STRIKE|outcome:VICTORY|award:2|integrity:2|pressure:2|focus:1|foe:0|rejection:none
stage5_policy_space=plans:64|victory:2|hold:7|defeat_integrity:22|defeat_pressure:0|active_or_invalid:33
stage5_progression=award_p50:0|award_p90:0|reactive_guarantees_victory:false
```

## Hard-gate assessment

| Gate | Evidence | Result |
|---|---|---|
| Dominant-strategy detection | The two-button policy and the DISRUPT-lock policy are identical here and finish HOLD/0, with `reactive_guarantees_victory:false`. | PASS |
| Per-stage counter cost curve | Output reports S1–S5, including S5’s 1→2 DISRUPT escalation. | PASS |
| p50/p90 progression | Across all 64 declared Stage 5 plans, fragment p50=0 and p90=0; only 2 plans win. This is intentionally a strict anti-autopilot distribution, not a tuned player-success target. | PASS (measurement recorded) |
| Defeat reachability | BRACE-only and STRIKE-only both use accepted commands and reach `DEFEAT_INTEGRITY` on round 2. | PASS |
| HOLD floor review | DISRUPT-lock HOLD has award 0; the reducer test additionally proves an all-HOLD campaign settles to 0. | PASS |
| Meaningful alternative | `STRIKE, DISRUPT, STRIKE` reaches VICTORY with nonzero remaining Integrity and visible Pressure cost. | PASS |

## Limitations and downstream verification

This simulator neither calls `requestAnimationFrame` nor tests presentation timing, browser input, persistence migration, localization, accessibility copy, or live opponent behavior. It intentionally makes no claim that the chosen S5 success rate is fun or appropriately tuned for players.

P3 now reads the current S5 DISRUPT cost (1 then 2) from `commandCost` and describes HOLD as a zero-fragment result; the deterministic vertical-slice test exercises that import path. A browser/E2E run remains required to verify the deployed presentation and confirm that real-time animation never regenerates semantic Focus. Cycle-007’s real-time preset owner remains responsible for visual pacing and that E2E verification.
