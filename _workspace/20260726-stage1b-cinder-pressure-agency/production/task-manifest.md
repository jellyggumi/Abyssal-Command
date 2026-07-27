# Task Manifest — Stage 1b Cinder Pressure and Agency

run-id: `20260726-stage1b-cinder-pressure-agency` · director · 2026-07-26
operating mode: **Stage 1 concept/architecture redesign and instrumentation**
source decision: `D-20260726-S2C-03`
next public beat: **deferred** until G2, G3, and G6 pass their frozen gates and completed human G7/G8 evidence passes; rendered persistence alone cannot authorize reconsideration.

| task | owner | stage.phase | artifact | gate | status |
|---|---|---|---|---|---|
| Freeze pressure/agency redesign contract | designer + director | S1b scope | `design/pressure-agency-redesign.md` | G2/G3/G7/G8 | complete; frozen thresholds preserved |
| Specify machine evidence records | programmer + QA | S1b instrumentation | `engineering/instrumentation-contract.md` | G2/G3/G7 | complete; implemented and remeasured |
| Define rendered human study | QA + director | S1b study | `study/rendered-study-protocol.md` + templates | G7/G8 | ready to collect; human evidence remains 0 |
| Correct G3 measurement semantics | programmer | S1b implementation | `scripts/run-g3-stance-events.mjs` | G3 | complete; 50 accepted switches retain phase attribution |
| Export packet-level Cinder pressure | programmer + QA | S1b implementation | `scripts/run-stage1b-pressure-packets.mjs` | G2 | complete; 15 runs / 45 packets |
| Repair extraction and persistence scenarios | QA + programmer | S1b implementation | `scripts/run-stage1b-persistence-scenarios.mjs` | G7 | complete; three traces/state diffs, two accepted handoffs |
| Export symmetric archetype trials | programmer + QA | S1b implementation | `scripts/run-stage1b-symmetric-trials.mjs` | G2/G3 | complete; canonical 5×20 paired rows with recomputable EV |
| Bind saved formation intent to deterministic position rank | programmer | S1b implementation | `defense-run-simulation.js`; `rpg-catalog.js` | G3 | complete; stance retains live FRONT-count ownership |
| Render pressure and agency state from snapshots | UI + programmer | S1b implementation | `app.js`; `battle-realtime-three.js`; `styles.css` | G7 | complete; presentation-only, not human evidence |
| Collect isolated performance evidence | QA + programmer | S1b verification | `qa/g6-*.json`; `qa/g6-provenance-20260726.json` | G6 | complete; gate FAIL, release provenance incomplete |
| Evaluate frozen Stage 1b gates | QA | S1b verification | `qa/stage1b-gate-verdict-20260726.json` | all | complete; G2/G3/G6 FAIL, G7/G8 BLOCKED, G5 N/A |
| Issue Stage 1b disposition | director | S1b review | `production/gate-reviews/stage-1b-scope.md`; `production/decision-log.md` | all | complete; return to director redesign, public beat deferred |

## Hard policy

1. D-20260726-S2C-03 prohibits another data-only numerical retune until this packet is reviewed and the evidence surfaces are implemented.
2. Preserve D-20260726-S2C-01 and D-20260726-S2C-02 historical values and all frozen boundaries: runtime IDs, extraction geometry/timing, one-handoff cap, player-visible canon, campaign schema, GLBs, renderer simulation ownership, and no-monetization scope. Presentation-only snapshot readers are permitted by `design/pressure-agency-redesign.md` §3.4.
3. Do not relabel synthetic scripted probes as human G7/G8 evidence.
4. Existing thresholds are unchanged: Cinder gate minimum `55.0–80.0%`, defeat `0–3/15`, per-row boss TTK `5.95–8.05 s`, G3 phase requirements, G7 `14/20` voluntary re-entries across 10 participants with every circuit inclusively `30–180 s`, at least `3` distinct canonical player actions, and at least `1` `ELITE_EXTRACTED` reward event per decision, and G8 survey/impression thresholds.
5. A missing required field or trace is a failure, not a pass or a reason to substitute a new threshold.
## Instrumentation receipt set

The instrumentation-only implementation is limited to the existing Stage1b workspace and these repo-local outputs:

- `qa/evidence/gates/G2/g2-adversarial-tape-evidence.json` + `.receipt.json`
- `qa/evidence/gates/G2/g2-adversarial-tape-fixture.receipt.json`
- `qa/evidence/gates/G2/stage1b-cinder-pressure-packets.json` + `.receipt.json`
- `qa/evidence/gates/G3/stage1b-formation-attribution.json` + `.receipt.json`
- `qa/evidence/gates/G7/stage1b-persistence-scenarios.json` + `.receipt.json`

All receipts carry an injected `sourceRevision`, fixed command/input digests, and no wall-clock or live-HEAD values. The artifacts are synthetic evidence and cannot satisfy human G7/G8 or change the frozen gates.
