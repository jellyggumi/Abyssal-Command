# Stage 2 G3 Director Review — REDO

run-id: `20260726-stage2-balance-agency`  
decision: `D-20260726-S2C-03`  
reviewed evidence: final `D-20260726-S2C-02` remeasurement, `2026-07-26T02:20:05Z–02:25:53Z`

## Contract and evidence

G3 requires at least three independently viable strategies, no archetype above `50%` dominance in optimal play, and at least five archetypes tested. The final retest is the third failure after the two permitted FIX loops.

| Measure | Final value | Method | Evidence | Result |
|---|---|---|---|---|
| Targetable formation | TURRET is FRONT `1/50` with `32,902` companion damage; VANGUARD is FRONT `2/50` with `35,826`; SPLIT is FRONT `1/50` with `5,966`. | `node scripts/run-g3-stance-events.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-stance.json`; output `2026-07-26T02:24:28.724587Z`. | `qa/gate-measurements.md#final-d-20260726-s2c-02-remeasurement`, `qa/post-retune-derived-summary.json#g3.stanceEvents` | Targetability observed only; not a G3 verdict. |
| Consequential non-TURRET risk | VANGUARD+SPLIT has `0/100` `COMPANION_DOWNED`; `1/100` defeats (`1.0%`, within `<=20%`). Required downs: `>=1`. | Same final stance probe and timestamp. | `qa/gate-measurements.md#final-d-20260726-s2c-02-remeasurement`, `qa/post-retune-derived-summary.json#g3.stanceEvents`, `qa/exploit-register.md#final-d-20260726-s2c-02-remeasurement-delta--redo` | FAIL |
| Rally-then-TURRET exploit | `50/50` rallies/switches; FRONT `1`; pre-switch companion damage `35,826`; post-switch damage `0`; `50/50` zero-damage conversions; `0` downs. Required: positive post-switch damage for all `50`, zero zero-damage conversions. | `node scripts/run-g3-exploit-probe.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-exploit.json`; output `2026-07-26T02:24:34.116440Z`. | `qa/gate-measurements.md#final-d-20260726-s2c-02-remeasurement`, `qa/post-retune-derived-summary.json#g3.rallyThenTurret`, `qa/exploit-register.md#final-d-20260726-s2c-02-remeasurement-delta--redo` | FAIL |
| Independent viability, dominance, EV | Five archetype campaigns exist, but the required symmetric matchup export and legal-combo `maxEV / medianEV <=1.30` series are absent. No `<=50%` dominance or three-independent-strategies conclusion is supportable. | Artifact check `2026-07-26T02:25:53Z`. | `qa/post-retune-derived-summary.json#g3.missingRequiredEvidence`, `qa/regression-matrix.md#unmet-required-evidence` and `#final-d-20260726-s2c-02-regression-verdict` | BLOCKED evidence debt. |

## Director result — **REDO**

G3 remains **FIX** in the gate-state record and mandates **REDO**: data-only stance changes yielded targetability but not a consequential trade-off, and they leave every post-rally conversion at zero risk. The absence of matchup/EV instrumentation also prevents the required diversity and dominance judgments. No PASS is claimed.

## Required next entry

Re-enter at **Stage 1, Phase 1b** with the Cinder pressure/agency redesign. Before any further numerical tuning, its reviewed instrumentation packet must define and emit: (1) a player-facing formation-risk model whose deterministic probe records a non-TURRET consequence without exceeding the unchanged `<=20%` defeat ceiling; (2) a rally-to-TURRET state transition that produces positive post-switch companion damage in all `50` required conversions without restoring cooldown benefit; and (3) the same symmetric matchup and legal-combo EV exports required by G2. The G3 viability, dominance, and EV thresholds are not weakened.