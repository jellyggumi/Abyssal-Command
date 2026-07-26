# Reward Bands — Stage 2 No-Monetization Boundary

## G5 decision

**G5: N/A — not PASS.** This cycle deliberately has no paid path, account, premium currency, ads, or gacha. G5 measures revenue–balance synergy through paid/free comparison, comeback activation limits, and free-path parity; its paid/free cohorts and revenue points therefore do not exist here. No threshold has been measured, so N/A records an inapplicable gate rather than a successful fairness result.

Evidence: `production/task-manifest.md#hard-policy` prohibits every commerce surface and says G5 is N/A unless the product boundary changes explicitly. `qa/gate-measurements.md#boundary-note--g5` independently confirms the boundary. The QA baseline broadcast (`messages/001-qa-baseline.md#gate-position`, 2026-07-26T01:21:22Z) directs PM to preserve it and not imply a paid/free conclusion.

## One final data-only retune — PM boundary

**Decision: CONDITIONAL GO for exactly one final data-only proposal; not an implementation approval and not a gate verdict.** The proposal must name each existing runtime data field with its current and proposed value, its expected measurement effect, and no fields beyond the approved list. QA’s post-retune results remain **G2 FIX**, **G3 FIX**, **G5 N/A**, **G7 BLOCKED**, and **G8 BLOCKED**.

The prior six-value retune is now the current state: Cinder `gateTicks=900`; its active authored wave totals are `rusher:7`, `flanker:5`, and `ranged:4`; `BOSS_RALLY_COOLDOWN_REDUCTION=0`; and `TURRET.derivedFrontCount=1`. That state still yields Cinder gate minima of `88.0–96.8%` in all 15 rows and rally-then-TURRET post-switch companion damage of `0` in `50/50` conversions. Therefore:

- **Pressure levers are assessable only** when they are existing, stage-local Cinder timing or authored-wave-composition fields. The likely player cost—lower gate integrity and more losses—is acceptable only inside the numeric band below. The PM does not authorize global enemy-stat, reward, extraction, ID, schema, canon, GLB, renderer, or source/test changes.
- **Formation levers are assessable only** when they are existing, named data fields that change the observed retained-rally post-switch risk. Repeating the already-applied `0` cooldown-reduction value or `1` TURRET FRONT value without a new data effect is not a proposal; targetability alone was insufficient. Re-enabling a rally cooldown benefit is not acceptable.
- **Extraction and commerce are not levers.** Their frozen values and exclusions below are binding, not candidate trade-offs.

### Assessed final proposal — only these existing data fields

| Existing runtime data field | Current → proposed value | PM assessment and acceptable gameplay cost |
|---|---|---|
| `defense-catalog.js#CINDER_SPAN_WAVE_PLAN[0]` | arrival tick `0 → 0`; pure `rusher 7 → 14`; mixed `rusher 4 + flanker 3 → rusher 8 + flanker 6` | **Conditionally acceptable.** It increases the opening packet without a new enemy, branch, or reward. The resulting loss of safety is acceptable only if every 15-row Cinder minimum is `55–80%`, defeats remain `0–20%`, and boss TTK remains `5.95–8.05 s`. |
| `defense-catalog.js#CINDER_SPAN_WAVE_PLAN[1]` | arrival tick `180 → 120`; pure `flanker 5 → 10`; mixed `flanker 3 + rusher 2 → flanker 7 + rusher 3` | **Conditionally acceptable.** Earlier, doubled pressure may make flank response costly; it is rejected if it breaches the same pressure, defeat, or TTK bounds. |
| `defense-catalog.js#CINDER_SPAN_WAVE_PLAN[2]` | arrival tick `390 → 240`; pure `ranged 4 → 8`; mixed `ranged 2 + flanker 2 → ranged 5 + flanker 3` | **Conditionally acceptable.** Earlier denial is allowed only as part of the combined `16 → 32` authored-wave total and only under the same measured Cinder bounds. |
| `rpg-catalog.js#STANCE_CONFIG.TURRET.offsets[0]` | `{ E * 0.3 } → { W * 0.3 }`; retain `derivedFrontCount=1` | **Conditionally acceptable.** Repositioning a still-targetable FRONT is acceptable only if all `50/50` rally-then-TURRET conversions take positive post-switch companion damage and zero retain both rally and zero damage. |
| `rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[0]` and `[1]` | `{ NW/SW * 1.4 } → { NW/SW * 2.0 }`; retain `derivedFrontCount=2` | **Conditionally acceptable.** The separation cost is acceptable only if the 100 VANGUARD/SPLIT stance runs record at least one non-TURRET companion down while Cinder defeats remain at or below `20%`. |

No other field is assessed or authorized by this PM boundary. In particular, `BOSS_RALLY_COOLDOWN_REDUCTION` remains `0.0`; the final proposal must not reintroduce a cooldown-reduction benefit.

The combined pressure total changes from `16` to `32` enemies across either authored branch and arrivals compress from `0/180/390` to `0/120/240`. This is a bounded gameplay-risk trade: the increased likelihood of gate loss, defeat, and companion loss is acceptable only inside the stated ceilings; no success is inferred before QA measurement.


```yaml
final_data_only_retune_boundary:
  authorization_count: 1
  proposal_precondition:
    each_field_must_include: [runtime_data_path, current_value, proposed_value, expected_measurement_effect]
    permitted_fields_exact: [defense-catalog.js#CINDER_SPAN_WAVE_PLAN[0], defense-catalog.js#CINDER_SPAN_WAVE_PLAN[1], defense-catalog.js#CINDER_SPAN_WAVE_PLAN[2], rpg-catalog.js#STANCE_CONFIG.TURRET.offsets[0], rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[0], rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[1]]
    prohibited_changes: [global_enemy_stats, rewards, extraction, runtime_ids, campaign_schema, player_visible_canon, GLBs, renderer, source, tests, monetization]
  pressure_acceptability:
    observed_current:
      cinder_gate_min_pct: [88.0, 96.8]
      cinder_defeats: "0/15"
      boss_ttk_s: [6.43, 7.17]
    required_post_change:
      sample: "15 rows: VANGUARD, TURRET, SPLIT × seeds 401–405"
      cinder_gate_min_pct_band: [55.0, 80.0]
      cinder_defeat_rate_band: [0.0, 0.20]
      boss_ttk_s_band: [5.95, 8.05]
    gameplay_cost_decision: "Accept a material loss of Cinder safety, including up to a 20% defeat rate; reject a pressure change that exceeds that defeat ceiling or misses the TTK band."
  formation_risk_acceptability:
    preserve:
      boss_rally_cooldown_reduction: 0.0
      turret_targetable_front_companions_minimum: 1
    rally_then_turret:
      sample: "50 conversion attempts at seeds 401–405"
      retained_rally_zero_post_switch_damage_rate_maximum: 0.0
      zero_post_switch_damage_attempts_maximum: 0
      required_post_switch_companion_damage: "positive in every attempted conversion"
    non_turret_consequence:
      sample: "100 stance runs: 50 VANGUARD plus 50 SPLIT at seeds 401–405"
      companion_downs_minimum: 1
      defeat_rate_ceiling: 0.20
    gameplay_cost_decision: "Accept bounded companion vulnerability sufficient to produce an observed non-TURRET down; reject immunity after a retained rally and reject any resulting defeat rate above the Cinder ceiling."
  extraction_freeze:
    occupation: { radius: 900, holdTicks: 180, moveMultiplier: 1.05, rangeMultiplier: 1.08 }
    extraction: { radius: 1000, windowTicks: 600, hard_floor_windowTicks: 180 }
    accepted_elite_handoffs_per_run_maximum: 1
    persistence_rule: "Reject a duplicate accepted handoff or any persistent write without accepted EXTRACT_ELITE."
  no_monetization:
    excluded_surfaces: [paid_path, account, premium_currency, ads, gacha, paid_power, paid_reroll, paid_recovery]
    paid_comeback_activations_per_run_maximum: 0
    G5: N/A
    not_pass_because: "No paid/free cohort, revenue point, or commerce measurement exists."
  mandatory_missing_evidence:
    G2: "Deterministic symmetric export: 20 paired trials per archetype, fixed seeds 401–405, identical value budgets, winner field; no 45–55% claim before it exists."
    G3: "Post-retune stance, exploit, and legal-combo EV data proving maxEV/medianEV <= 1.30 and the numeric formation-risk boundary."
    G7_persistence: "Event traces plus campaign-state before/after diffs for victory, defeat after acceptance, and defeat before acceptance."
    G7_human: "Rendered moderated session with 10 participants, 20 eligible re-entry decisions, at least 14 voluntary Cinder re-entries, and prompt/movement/hold/accepted-action/result/re-entry evidence."
    G8: "Five-title frequency comparison (<=2/5) and QA human impression score >=4/5."
  reproducible_post_change_measurement:
    - "node scripts/run-g2-margin-probe.mjs --seeds 401,402,403,404,405 --stances VANGUARD,TURRET,SPLIT --output /tmp/abyssal-s2-final-margin.json"
    - "node scripts/run-g3-stance-events.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-stance.json"
    - "node scripts/run-g3-exploit-probe.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-exploit.json"
    - "node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-final-g7-scripted.json"
  gate_promotion: prohibited_pending_QA_evidence_and_director_verdict
```

The signed agreement and current QA evidence establish limits, not success: `pm/negotiation-record.md`, `engineering/architecture-contract.md`, `qa/gate-measurements.md`, `qa/post-retune-derived-summary.json`, and `messages/002-qa-post-retune.md`.

```yaml
artifact_contract:
  schema_version: artifact-contract/1
  artifact_id: pm.reward-bands
  artifact_path: pm/reward-bands.md
  run_id: 20260726-stage2-balance-agency
  stage: stage-2-phase-2b
  status: boundary_contract_pending_gameplay_remeasurement
  current_gate_status:
    G2: FIX
    G3: FIX
    G5: N/A
    G7: BLOCKED
    G8: BLOCKED
  evidence:
    - path: production/task-manifest.md#hard-policy
      observed: "No paid path, account, premium currency, ads, or gacha may be introduced; G5 is N/A unless the boundary changes explicitly."
      method: "Director policy artifact, run dated 2026-07-26."
    - path: qa/gate-measurements.md#boundary-note--g5
      observed: "No monetization surface is in scope; QA records G5 as N/A."
      method: "QA baseline artifact."
    - path: messages/001-qa-baseline.md#gate-position
      observed: "G2/G3 are FIX, G7/G8 are BLOCKED, and G5 is N/A unless the boundary changes."
      method: "QA broadcast at 2026-07-26T01:21:22Z."
  product_boundary:
    monetization_in_scope: false
    excluded_surfaces: [paid_path, account, premium_currency, ads, gacha, paid_power, paid_reroll, paid_recovery]
    g5:
      status: N/A
      not_pass_because: "No paid/free entitlement variants, revenue points, or eligible comparison cohort exist; no G5 threshold was exercised."
      current_measurement: "Policy and QA artifact inspection only; no paid/free result was collected or inferred."
      applicability_trigger: "A director-approved product-boundary change that names a concrete revenue point and its gameplay effect."
  reward_safeguards:
    extraction:
      accepted_elite_handoffs_per_run_maximum:
        proposed_cap: 1
        unit: accepted ELITE_EXTRACTED handoffs per run
        current_source:
          path: qa/playtest-report.md#scripted-extract-elite-route
          observed: "Each Cinder Span scripted seed 901–903 submitted one accepted EXTRACT_ELITE and emitted one ELITE_EXTRACTED event."
          evidence_class: scripted simulation, not human play
        intended_metric: "Count accepted ELITE_EXTRACTED events and resulting persistent companion writes for each completed run."
        required_verification: "After any retune, QA records event traces plus campaign-state before/after diffs for victory, defeat after acceptance, and defeat before acceptance; reject any run with more than one accepted handoff or a write without acceptance."
        gate_relation: "Gameplay reward-integrity safeguard; it is not paid/free evidence and cannot convert G5 from N/A to PASS."
    stance_conversion:
      retained_rally_with_zero_post_switch_companion_damage_rate_maximum:
        proposed_cap: 0.0
        unit: proportion of attempted rally-then-Turret conversions
        current_source:
          path: qa/exploit-register.md#s2-003
          observed: "10/10 candidate conversions retained a rally, then took zero post-switch companion damage, with zero downs and zero defeats."
          evidence_class: scripted simulation
        intended_metric: "Proportion of conversion attempts that retain the rally reward while receiving zero post-switch companion damage."
        required_verification: "Re-run the documented ten-run conversion probe and permanent VANGUARD/TURRET controls after the designer response; QA must attach counts, damage, downs, defeats, and terminal outcomes."
        gate_relation: "G2/G3 trade-off safeguard; it prevents a free retained reward plus immunity but is not a monetization result."
    recovery:
      paid_comeback_activations_per_run_maximum:
        proposed_cap: 0
        unit: paid comeback activations per run
        current_source:
          path: production/task-manifest.md#hard-policy
          observed: "Paid paths and related monetization surfaces are prohibited in this cycle."
          evidence_class: product-scope policy, not an activation measurement
        intended_metric: "Count newly introduced paid recovery/comeback activations in a retuned run."
        required_verification: "QA inventories reward/recovery events and traces every paid activation after implementation; any nonzero result is a policy breach and requires director review before G5 applicability is reconsidered."
        gate_relation: "Boundary safeguard only; it does not establish the G5 <=30% reversal threshold because no comeback system is being evaluated."
  non_monetary_fairness_rule:
    rule: "A retune may change pressure or formation trade-offs only through approved gameplay data; it must not create a paid or unaccepted-persistence escape from loss."
    evidence: qa/exploit-register.md#s2-003
    verification: "QA repeats G2/G3 probes and the extraction/persistence audit after approved data changes."
  future_monetization_requirements:
    status: not_applicable_to_this_cycle
    prerequisite: "Separate product approval, privacy/entitlement design, and a signed designer–PM negotiation-record entry for every revenue point that touches a balance number."
    required_data:
      - "A versioned product contract naming the item, price/entitlement, access rule, disclosure, affected reward or recovery behavior, and rollback rule."
      - "Pseudonymous entitlement/cohort data that distinguishes comparable paid and non-paid players or controlled fixtures at equal skill; no account or cohort exists today."
      - "Per-run outcomes, skill/control covariates, stage/seed, loss state, extraction/reward events, and all persistent writes for both cohorts."
      - "Per-activation logs for any comeback/recovery: eligibility, activation, cooldown or cap, pre/post outcome, and whether reversal occurred."
      - "Session-indexed free-path progression data through the approved parity window, plus a signed negotiation-record entry for each revenue point."
    g5_thresholds_to_measure_only_if_applicable:
      paid_free_winrate_delta_maximum: { value: 5, unit: percentage_points, source: skill://game-studio-harness/references/quality-gates.md#g5 }
      comeback_instant_reversal_probability_maximum: { value: 0.30, unit: probability_per_activation, source: skill://game-studio-harness/references/quality-gates.md#g5 }
      free_path_parity_sessions_band: { value: [10, 20], unit: sessions, source: skill://game-studio-harness/references/quality-gates.md#g5 }
      note: "These are harness measurement criteria, not measured results or an approved monetization proposal for this run."
  prohibited_in_this_artifact:
    - "Claiming paid/free parity, conversion, price, revenue, or player willingness to pay."
    - "Treating scripted extraction success as human-play, commercial, or G5-pass evidence."
    - "Changing game data, runtime IDs, renderer behavior, or the negotiation record."
```

## Retune handoff

The designer may use the caps above as constraints while addressing the saturated clears and the rally-then-Turret exploit. QA must remeasure the listed safeguards alongside the G2/G3 work. The extraction route's **9/9 scripted completions** have distinct Cinder milestones: extraction completion at **20.10–20.28 s** and `ELITE_EXTRACTED` at **20.12–20.30 s** (`qa/playtest-report.md#scripted-extract-elite-route`). They are state-machine evidence only; they do not establish human voluntary re-entry, a commercial reward result, or G5 PASS.
