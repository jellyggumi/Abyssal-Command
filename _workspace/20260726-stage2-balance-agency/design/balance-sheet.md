# Stage 2 Balance Sheet — Bounded Cinder Retune

**Gate state:** G2 **FIX**; G3 **FIX**. This is a data-only proposal, not an implemented or measured pass. It preserves G1 strings, runtime IDs, GLBs, campaign schema, and the no-monetization boundary.

## Gate contract

```yaml
gate: G2
status: FIX
rules_version: defense-survivor-v1
scope: "Cinder Span pressure plus formation reward conversion; no renderer, ID, reward-economy, or extraction-schema change"
data_mirrors:
  combat_catalog: defense-catalog.js#ENEMIES
  cinder_stage: defense-catalog.js#CINDER_SPAN_WAVE_PLAN
  cinder_stage_timing: defense-catalog.js#STAGES[cinder-span]
  formation: rpg-catalog.js#STANCE_CONFIG
  formation_rally: rpg-catalog.js#BOSS_RALLY_COOLDOWN_REDUCTION
  extraction_freeze: defense-catalog.js#STAGE_TACTICS[cinder-span].{occupation,extraction}
mechanics_coverage:
  required_systems: [enemy-stats, cinder-wave-composition, stage-gate-timing, boss-ttk, formation-front-back, boss-rally, back-row-synergy, companion-integrity, extraction-route]
  covered_in_this_sheet: [enemy-stats, cinder-wave-composition, stage-gate-timing, boss-ttk, formation-front-back, boss-rally, back-row-synergy, companion-integrity, extraction-route]
  required_coverage_fraction: 1.0
  baseline_coverage_fraction: 0.0
matchup_winrate_band: [0.45, 0.55]
matchup_status: BLOCKED
matchup_blocker: "Existing PvE runners emit campaign outcomes, not a symmetric archetype-versus-counterpressure matchup matrix. Do not infer a 45–55% matchup result from 50/50 saturated clears."
ttk:
  unit: seconds
  cinder_boss_target: 7.0
  tolerance_fraction: 0.15
  permitted_band: [5.95, 8.05]
  baseline_by_stance: {VANGUARD: 6.83, TURRET: 7.17, SPLIT: 6.77}
  status: "target established; post-change measurement pending"
combo_ev:
  cap_vs_median: 1.3
  baseline_status: BLOCKED
  proposed_measure: "per-run companion damage dealt plus gate-loss cost, grouped by fixed stance/loadout/seed; EV = (damageDealt - 0.10 * gateDamageTaken) / runTicks, then normalized to the median legal combo"
base_stage_pressure:
  stage_id: cinder-span
  baseline_min_gate_pct: 98.0
  target_min_gate_pct_band: [55.0, 80.0]
  target_defeat_rate_band: [0.0, 0.20]
  sample: "15 bare-stage runs: 3 stances × seeds 401,402,403,404,405"
g3:
  status: FIX
  archetypes_required: 5
  independently_viable_required: 3
  max_optimal_play_dominance_fraction: 0.50
  baseline_companion_downs: 0
  baseline_rally_then_turret_post_switch_damage: 0
```

### Baseline evidence

QA's deterministic baseline found Cinder Span at **98%** minimum gate integrity in every stance, **0/30** defeats and companion downs, and `rally-then-turret` retaining **10/10** rallies with **0** post-switch companion damage. Five scripted campaign policies cleared **50/50** stage attempts, including an RPG-inactive rusher clearing **10/10**. These are saturation findings, not balance success: `qa/gate-measurements.md#g2`, `#g3`; `qa/playtest-report.md#cinder-span-pressure`; `qa/exploit-register.md#s2-001`–`#s2-003`.

## Before → proposed data change

| Runtime data mirror | Before | Proposed | Bounded intent / gate condition |
|---|---|---|---|
| `defense-catalog.js#STAGES[cinder-span].gateTicks` | `720` ticks (12.0 s) | `900` ticks (15.0 s) | Give the authored three-wave packet time to create a measurable gate decision; no stage ID or objective order changes. |
| `defense-catalog.js#CINDER_SPAN_WAVE_PLAN[0]` | pure `4 rusher`; mixed `2 rusher + 2 flanker` | pure `7 rusher`; mixed `4 rusher + 3 flanker` | Raise opening pressure while preserving both existing variant IDs and total composition count parity. |
| `defense-catalog.js#CINDER_SPAN_WAVE_PLAN[1]` | pure `3 flanker`; mixed `2 flanker + 1 rusher` | pure `5 flanker`; mixed `3 flanker + 2 rusher` | Make the flank response matter without changing enemy IDs, policies, or spawn directions. |
| `defense-catalog.js#CINDER_SPAN_WAVE_PLAN[2]` | pure `2 ranged`; mixed `1 ranged + 1 flanker` | pure `4 ranged`; mixed `2 ranged + 2 flanker` | Make the denial packet compete with a passive hold; no new wave slot. |
| `rpg-catalog.js#BOSS_RALLY_COOLDOWN_REDUCTION` | `0.20` | `0.00` | Remove the bankable numeric DPS benefit that survives a switch into TURRET. The event may remain observable, but it must have zero cooldown-reduction EV until a code-owned stance-scoped rally design exists. |
| `rpg-catalog.js#STANCE_CONFIG.TURRET.derivedFrontCount` | `0` | `1` | Ensure TURRET retains one targetable companion rather than total companion immunity; remeasure its trade-off rather than assume one. |
| `defense-catalog.js#STAGE_TACTICS[cinder-span].occupation` | radius `900`, hold `180`, move `1.05`, range `1.08` | **unchanged** | Freeze the pre-window decision; it is not the baseline failure. |
| `defense-catalog.js#STAGE_TACTICS[cinder-span].extraction` | radius `1000`, window `600` | **unchanged** | Preserve the demonstrated scripted route and its 7.54 s readiness slack; no extraction retune is justified. |

The proposed Cinder wave total is **9 → 16** enemies on either seeded composition branch; `gateTicks` is **720 → 900**. This is intentionally the smallest stage-local pressure packet: it does not alter global `ENEMIES`, bosses, rewards, item effects, stage IDs, `eliteId`, `eliteKind`, or `eliteCompanion`.

## Required verification — no gate claim before all rows are evidenced

1. **Data audit / mechanics coverage:** QA compares every `mechanics_coverage.required_systems` entry above to its named mirror after the programmer applies only the table values. Record `9/9` coverage and the final values in `qa/gate-measurements.md#g2`; any absent mirror or unapproved field change leaves G2 **FIX**.
2. **Base pressure and TTK:**
   ```sh
   node scripts/run-g2-margin-probe.mjs --seeds 401,402,403,404,405 --stances VANGUARD,TURRET,SPLIT --output /tmp/abyssal-s2-retune-margin.json
   ```
   Require all 15 Cinder rows, `gateMinPct` in **55–80%**, defeat rate **0–20%**, and boss TTK in **5.95–8.05 s**. The existing probe includes all stages; QA filters `stageId === "cinder-span"` and retains the raw file.
3. **Five-archetype viability:** run the existing policy runner separately for `rusher`, `turtle`, `economy-greed`, `micro-optimizer`, and `casual`, each with `--seeds 401,402,403,404,405` and a distinct `/tmp/abyssal-s2-retune-<archetype>.json` output. At least three must remain independently viable under the pressure band; five tested is a count only, not a pass.
4. **G2 matchup band — explicitly deferred runner requirement:** the owner must provide a deterministic, symmetric matchup export with 20 paired trials per archetype (five archetypes × four counterpressure profiles), fixed seeds `401–405`, identical value budgets, and fields `archetypeId`, `counterProfileId`, `seed`, `winner`. QA computes each legal matchup win rate as wins / paired trials; every rate must be **45–55%**. Until that exact export exists, `matchup_status` remains **BLOCKED**.
5. **Combo EV / G3 exploit:**
   ```sh
   node scripts/run-g3-stance-events.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-retune-stance.json
   node scripts/run-g3-exploit-probe.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-retune-exploit.json
   ```
   QA calculates the declared EV for legal fixed stance/loadout combinations and verifies `maxEV / medianEV <= 1.30`. `rally-then-turret` must receive no cooldown-reduction benefit and must no longer report zero targetable FRONT companions. At least one consequential companion-risk signal (damage or down) must occur in a non-TURRET arm before G3 can pass; an all-zero-loss result remains **FIX**.
6. **Elite decision regression:**
   ```sh
   node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-retune-g7-scripted.json
   ```
   Scripted Cinder seeds `901,902,903` must still emit accepted `EXTRACT_ELITE`, `EXTRACTION_COMPLETED`, and `ELITE_EXTRACTED`; this only protects reachability and does not pass G7.

## Gate conclusion

The target, data mirrors, and measurement contract now exist. G2 remains **FIX** because the proposed values are not applied, the 45–55% matchup instrument does not exist, and combo EV is unmeasured. G3 remains **FIX** because no post-retune consequence/viability measurement exists. G5 remains **N/A** under the established no-monetization boundary.
