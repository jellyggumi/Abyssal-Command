# Task Manifest — Stage 1b Cinder Pressure and Agency

run-id: `20260726-stage1b-cinder-pressure-agency` · director · 2026-07-26
operating mode: **Stage 1 concept/architecture redesign and instrumentation**
source decision: `D-20260726-S2C-03`
next public beat: **deferred** until a rendered vertical slice reliably shows a persistent Elite Extract decision.

| task | owner | stage.phase | artifact | gate | status |
|---|---|---|---|---|---|
| Freeze pressure/agency redesign contract | designer + director | S1b scope | `design/pressure-agency-redesign.md` | G2/G3/G7/G8 | drafted; scope review required |
| Specify machine evidence records | programmer + QA | S1b instrumentation | `engineering/instrumentation-contract.md` | G2/G3/G7 | drafted; implementation after scope review |
| Define rendered human study | QA + director | S1b study | `study/rendered-study-protocol.md` | G7/G8 | drafted; protocol review required |
| Correct measurement semantics | programmer | S1b implementation | probe/schema changes | G2/G3/G7 | not started |
| Repair extraction fixture | QA + programmer | S1b implementation | focused test fixture | G7 | not started |
| Add persistence trace/diff coverage | programmer + QA | S1b implementation | scenario exports | G7 | not started |
| Issue Stage 1b scope decision | director | S1b review | `production/gate-reviews/stage-1b-scope.md` | all | pending |

## Hard policy

1. D-20260726-S2C-03 prohibits another data-only numerical retune until this packet is reviewed and the evidence surfaces are implemented.
2. Preserve D-20260726-S2C-01 and D-20260726-S2C-02 historical values and all frozen boundaries: runtime IDs, extraction geometry/timing, one-handoff cap, player-visible canon, campaign schema, GLBs, renderer, and no-monetization scope.
3. Do not relabel synthetic scripted probes as human G7/G8 evidence.
4. Existing thresholds are unchanged: Cinder gate minimum `55.0–80.0%`, defeat `0–3/15`, per-row boss TTK `5.95–8.05 s`, G3 phase requirements, G7 `14/20` voluntary re-entries, and G8 survey/impression thresholds.
5. A missing required field or trace is a failure, not a pass or a reason to substitute a new threshold.
