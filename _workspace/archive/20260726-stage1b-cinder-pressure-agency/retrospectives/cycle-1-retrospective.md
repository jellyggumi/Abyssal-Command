# Cycle 1 Retrospective — Stage 2 Balance and Agency REDO

run-id: `20260726-stage2-balance-agency`  
cycle close: `2026-07-26`  
final decision: `D-20260726-S2C-03`  
final QA measurement window: `2026-07-26T02:20:05Z–02:25:53Z`

## Cycle outcome

The second and final permitted data-only retune did not clear Stage 2. G2 and G3 retain **FIX** state but force **REDO** as their third failed loop; G5 is **N/A, not PASS**; G7 and G8 are **BLOCKED** and also force **REDO**. Historical agreements `D-20260726-S2C-01` and `D-20260726-S2C-02`, including frozen extraction, runtime IDs, one-handoff safeguard, player-visible canon, and no-monetization boundaries, remain preserved and unmodified.

## Gate table

| Gate | Final measured value | Method | Final evidence | Director result |
|---|---|---|---|---|
| G2 | `10/15` Cinder gate-minimum violations; `1/15` defeats; `14/14` in-band TTKs with `1` required TTK missing; `0` qualifying matchup/EV exports. | Final Cinder margin probe, five archetype rotations, and artifact check, `2026-07-26T02:21:40.313124Z–02:25:53Z`. | `qa/gate-measurements.md#final-d-20260726-s2c-02-remeasurement`, `qa/post-retune-derived-summary.json#g2`, `qa/regression-matrix.md#final-d-20260726-s2c-02-regression-verdict`. | FIX → **REDO** |
| G3 | VANGUARD+SPLIT: `0/100` companion downs; rally-then-TURRET: `50/50` zero-damage post-switch conversions; no matchup/EV series. | Final stance and exploit probes, plus artifact check, `2026-07-26T02:24:28.724587Z–02:25:53Z`. | `qa/gate-measurements.md#final-d-20260726-s2c-02-remeasurement`, `qa/post-retune-derived-summary.json#g3`, `qa/exploit-register.md#final-d-20260726-s2c-02-remeasurement-delta--redo`. | FIX → **REDO** |
| G5 | `0` monetization surfaces introduced; paid/free, comeback, parity, and revenue-point evidence does not exist. | Frozen-boundary check, `2026-07-26T02:25:53Z`. | `qa/post-retune-derived-summary.json#g5`, `qa/gate-measurements.md#final-d-20260726-s2c-02-remeasurement`. | **N/A, not PASS** |
| G7 | Cinder scripted extraction completes `1/3` seeds; persistence trace/diff sets `0`; human evidence `0/10` participants, `0/20` decisions, `0/14` re-entries. | Final extraction script and artifact check, `2026-07-26T02:20:40.094Z–02:25:53Z`. | `qa/post-retune-derived-summary.json#g7`, `qa/playtest-report.md#final-d-20260726-s2c-02-scripted-remeasurement`, `qa/regression-matrix.md#final-d-20260726-s2c-02-regression-verdict`. | BLOCKED → **REDO** |
| G8 | Direct-feature survey `0/5`; human-impression sessions `0/10`. | Artifact check, `2026-07-26T02:25:53Z`. | `qa/post-retune-derived-summary.json#g8`, `qa/gate-measurements.md#final-d-20260726-s2c-02-remeasurement`. | BLOCKED → **REDO** |

## Unresolvable evidence debts for this cycle

1. **Balance validity:** no deterministic symmetric `20`-paired-trial-per-archetype export, no `45–55%` matchup result, and no legal-combo `maxEV / medianEV <=1.30` series.
2. **Agency consequence:** no demonstrated non-TURRET `COMPANION_DOWNED` in the required `100` VANGUARD+SPLIT runs and no positive post-switch damage in the required `50` rally-to-TURRET conversions.
3. **Core-loop persistence and humans:** no victory/defeat-after/defeat-before trace-and-diff sets; no rendered moderated `10`-participant / `20`-decision / `>=14` voluntary-re-entry evidence.
4. **Novelty proof:** no reviewed five-title direct-feature table and no ten-session rendered first-exposure impression median.
5. **Commerce evidence:** correctly absent while the no-monetization boundary is in force; G5 cannot be called PASS.

## Next-cycle entry decision

**Re-enter Stage 1, Phase 1b — concept and architecture shift.** The next work item is a separately reviewed **Cinder pressure-and-agency redesign/instrumentation packet**, not another numerical retune. Before any more numerical tuning it must establish all of these prerequisites:

1. An authored pressure and formation-risk model capable of meeting the unchanged G2/G3 envelopes, including all `15` Cinder rows, every required TTK output, a meaningful non-TURRET consequence within the existing defeat ceiling, **positive post-switch companion damage in all `50` required rally-to-TURRET conversions with zero zero-damage conversions**, and no restored rally cooldown benefit.
2. A deterministic evidence surface that emits `20` symmetric paired trials per archetype with fixed seeds `401–405`, equal budgets, `archetypeId`, `counterProfileId`, seed, winner, and a legal-combo EV series.
3. Reliable scripted Cinder routes for `901–903` plus retained persistence traces/state diffs for victory, defeat-after-acceptance, and defeat-before-acceptance.
4. A rendered-build study packet ready to collect G7's `10/20/14` human evidence and G8's five-title direct-feature survey plus ten-session `>=4.0/5` impression evidence.

No existing gate threshold is revised, and no further Stage 2 numerical tuning is authorized before that packet is reviewed.

## Next public beat

The prior public beat, **“a non-saturated Cinder Span sortie with an observable Elite Extract decision,” is not eligible to ship or demonstrate.** The next public beat is deferred until the redesign packet has passed director scope review and produces a rendered vertical slice with a reliably observable, persistent Elite Extract decision; this is a gate, not a release promise.