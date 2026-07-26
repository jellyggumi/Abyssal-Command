# Stage 2 G7 Director Review — BLOCKED, REDO

run-id: `20260726-stage2-balance-agency`  
decision: `D-20260726-S2C-03`  
reviewed evidence: final `D-20260726-S2C-02` remeasurement, `2026-07-26T02:20:05Z–02:25:53Z`

## Contract and evidence

G7 requires a modeled loop of `30–180 s`, at least three actions and one reward event, plus a human playtest repeat-rate proxy of `>=70%` voluntary re-entry. Scripted execution and missing human proof do not complete the gate.

| Measure | Final value | Method | Evidence | Result |
|---|---|---|---|---|
| Scripted Cinder route | Seed `901`: window `20.62 s`, completion `23.10 s`, window-to-completion `2.48 s`, one accepted handoff, extracted=true, victory. Seeds `902/903`: defeated before window open; `0` accepted actions and extracted=false. Aggregate: `1/3` happy paths, `2/3` pre-extraction defeats. | `node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-final-g7-scripted.json`; generated `2026-07-26T02:20:40.094Z`. | `qa/gate-measurements.md#final-d-20260726-s2c-02-remeasurement`, `qa/post-retune-derived-summary.json#g7.scriptedCinder`, `qa/playtest-report.md#final-d-20260726-s2c-02-scripted-remeasurement`, `qa/exploit-register.md#final-d-20260726-s2c-02-remeasurement-delta--redo` | FAIL; scripted route is not reliable. |
| Persistence regression | `0` retained trace-and-campaign-state-diff sets for victory, defeat-after-acceptance, and defeat-before-acceptance. | Artifact check `2026-07-26T02:25:53Z`. | `qa/post-retune-derived-summary.json#g7.missingRequiredEvidence`, `qa/regression-matrix.md#final-d-20260726-s2c-02-regression-verdict` | BLOCKED |
| Human completion and re-entry | `0/10` participants, `0/20` eligible re-entry decisions, `0/14` voluntary re-entries; no rendered player-visible prompt, movement, hold, accepted-action, result, persistence, or re-entry evidence. | Artifact check `2026-07-26T02:25:53Z`; deterministic scripts are explicitly not human evidence. | `qa/post-retune-derived-summary.json#g7.missingRequiredEvidence`, `qa/playtest-report.md#unmeasured-human-gates`, `messages/003-qa-final-retune.md` | BLOCKED |

## Director result — **BLOCKED → REDO**

G7 remains **BLOCKED** and triggers cycle **REDO**. The final retest fails two of three required scripted Cinder routes; persistence and human agency evidence are absent. No PASS is claimed.

## Exact future prerequisite

The Stage 1 redesign/instrumentation packet must first make the Cinder circuit reliably observable for seeds `901–903` without changing the G7 `30–180 s`, `>=3` action, `>=1` reward, or `>=70%` re-entry thresholds. Before a renewed gate review it must collect retained traces and before/after state diffs for victory, defeat-after-acceptance, and defeat-before-acceptance. A rendered moderated session must then evidence `10` participants, `20` eligible re-entry decisions, `>=14` voluntary Cinder re-entries, and the complete visible route sequence. Numerical pressure tuning is prohibited until the redesign/instrumentation scope is reviewed.