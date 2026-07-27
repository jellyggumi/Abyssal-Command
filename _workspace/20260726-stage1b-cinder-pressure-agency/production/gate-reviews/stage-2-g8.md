# Stage 2 G8 Director Review — BLOCKED, REDO

run-id: `20260726-stage2-balance-agency`  
decision: `D-20260726-S2C-03`  
reviewed evidence: final `D-20260726-S2C-02` remeasurement, `2026-07-26T02:25:53Z`

## Contract and evidence

G8 requires at least one candidate element present in `<=2` of `>=5` comparable surveyed titles and a QA human-impression score `>=4/5`. The candidate, `pressure-bound-elite-extraction`, is defined but definition is not evidence of frequency or player impression.

| Measure | Final value | Method | Evidence | Result |
|---|---|---|---|---|
| Comparable-title direct-feature survey | `0/5` completed direct-feature survey entries; no reviewed five-title frequency table and therefore no `<=2/5` conclusion. | Artifact check `2026-07-26T02:25:53Z`. | `qa/gate-measurements.md#final-d-20260726-s2c-02-remeasurement`, `qa/post-retune-derived-summary.json#g8`, `design/novelty-scorecard.md#five-title-survey-protocol--missing-evidence-to-collect` | BLOCKED |
| Human first-exposure impression | `0/10` rendered human-impression sessions; median is not measured. | Artifact check `2026-07-26T02:25:53Z`. | `qa/post-retune-derived-summary.json#g8`, `qa/playtest-report.md#unmeasured-human-gates`, `messages/003-qa-final-retune.md` | BLOCKED |
| Candidate route precondition | G7 final scripted Cinder route completes only `1/3` seeds; two routes fail before the extraction window. | Final scripted G7 command generated `2026-07-26T02:20:40.094Z`. | `qa/post-retune-derived-summary.json#g7.scriptedCinder`, `qa/exploit-register.md#final-d-20260726-s2c-02-remeasurement-delta--redo` | Not ready for credible impression measurement. |

## Director result — **BLOCKED → REDO**

G8 remains **BLOCKED** and contributes to the cycle **REDO**. There is no survey frequency, no human impression median, and no stable Cinder route upon which to run a fair first-exposure session. No PASS is claimed.

## Exact future prerequisite

After the Stage 1 Cinder agency redesign makes the route reliably observable, collect a five-title reviewed direct-feature table with source URL, quote/mechanical evidence, taxonomy, reviewer, and date for every row; the direct frequency must be `<=2/5`. Then conduct ten rendered-build first-exposure sessions with recordings and raw `1–5` scores; the median must be `>=4.0/5`. These thresholds remain unchanged; numerical tuning may not resume before the redesign/instrumentation packet is reviewed.