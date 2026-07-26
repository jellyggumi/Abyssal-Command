# Stage 2 G2 Director Review — REDO

run-id: `20260726-stage2-balance-agency`  
decision: `D-20260726-S2C-03`  
reviewed evidence: final `D-20260726-S2C-02` remeasurement, `2026-07-26T02:20:05Z–02:25:53Z`

## Contract and evidence

G2 requires every measured mechanic to be covered, matchup win rates in `45–55%`, TTK within `±15%` of target, and no legal combo above `1.30×` median EV. The authorized final retune was the second allowed FIX loop. This is the third failure; policy requires a director scope decision rather than another numerical retune.

| Measure | Final value | Method | Evidence | Result |
|---|---|---|---|---|
| Cinder gate-minimum band | `5/15` rows in `55.0–80.0%`; `10/15` violations. Values: VANGUARD `78.0/85.0/91.0/77.4/88.0%`; TURRET `80.2/85.0/92.2/78.4/88.0%`; SPLIT `61.4/51.0/0.0/61.6/41.2%`. | `node scripts/run-g2-margin-probe.mjs --seeds 401,402,403,404,405 --stances VANGUARD,TURRET,SPLIT --output /tmp/abyssal-s2-final-margin.json`; output `2026-07-26T02:24:28.384984Z`. | `qa/gate-measurements.md#final-d-20260726-s2c-02-remeasurement`, `qa/post-retune-derived-summary.json#g2.cinderMargin`, `qa/playtest-report.md#final-d-20260726-s2c-02-scripted-remeasurement` | FAIL |
| Defeat/TTK output | `1/15` defeats (`6.67%`, inside `0–3/15`); `14/14` measured boss TTK values `6.43–7.57 s` are inside `5.95–8.05 s`; SPLIT seed `403` is defeated and has no required boss-TTK value. | Same final margin probe and timestamp. | `qa/gate-measurements.md#final-d-20260726-s2c-02-remeasurement`, `qa/post-retune-derived-summary.json#g2.cinderMargin` | FAIL: every-row TTK output is required. |
| Five archetype campaigns | rusher/turtle/economy-greed/micro-optimizer/casual each: `5` campaigns, `30` successes, `2` Cinder defeats at seeds `403/405`, `32` stage records; mean measured boss TTK ticks `561.7333/725.6667/729.5000/600.9667/582.3667`. | Five `node scripts/run-g2-archetype-rotation.mjs <archetype> --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-<archetype>.json` runs; outputs `2026-07-26T02:21:40.313124Z–02:21:45.210701Z`. | `qa/gate-measurements.md#final-d-20260726-s2c-02-remeasurement`, `qa/post-retune-derived-summary.json#g2.archetypeCampaigns`, `qa/playtest-report.md#final-d-20260726-s2c-02-scripted-remeasurement` | Not viable evidence while Cinder fails. |
| Symmetric matchup and legal-combo EV | `0` qualifying exports: no `20` paired trials per archetype with fixed seeds `401–405`, equal budgets, `archetypeId`, `counterProfileId`, `seed`, and winner; no `45–55%` matchup result; no legal-combo `maxEV / medianEV <=1.30` series. | Artifact check `2026-07-26T02:25:53Z`. | `qa/post-retune-derived-summary.json#g2.missingRequiredEvidence`, `qa/regression-matrix.md#final-d-20260726-s2c-02-regression-verdict`, `qa/exploit-register.md#final-d-20260726-s2c-02-remeasurement-delta--redo` | BLOCKED evidence debt. |

## Director result — **REDO**

G2 remains **FIX** in the gate-state record and mandates **REDO** for the cycle: the second approved data-only retune still misses `10/15` Cinder bounds, omits one required TTK, and lacks the mandatory symmetric-matchup and EV evidence. No PASS is claimed.

## Required next entry

Re-enter at **Stage 1, Phase 1b** for a Cinder pressure/agency concept-and-architecture redesign, not another numerical retune. Before any further numerical tuning, the separately reviewed redesign/instrumentation packet must: (1) define a pressure model that can yield all `15` Cinder rows inside the unchanged `55.0–80.0%`, `0–3/15` defeat, and per-row `5.95–8.05 s` TTK requirements; (2) emit a deterministic symmetric `20`-paired-trial-per-archetype export with the required identity/budget fields and a legal-combo EV series; and (3) preserve an output row for every required boss TTK or explicitly classify a loss without falsely crediting it. The thresholds remain unchanged.