# Production Decision Log — Stage 2c Numeric Negotiation

## D-20260726-S2C-01 — Authorize bounded data-only Cinder retune

**Decision:** **GO — Stage 2d may implement only the signed data values in `pm/negotiation-record.md`.**

This is an implementation-and-remeasurement authorization, not a gate verdict. G2 and G3 remain **FIX**; G7 and G8 remain **BLOCKED**; G5 is **N/A, not PASS**. No Stage 2 gate may be promoted from this decision.

```yaml
artifact_contract:
  schema_version: artifact-contract/1
  artifact_id: production.decision-log
  artifact_path: production/decision-log.md
  run_id: 20260726-stage2-balance-agency
  stage: stage-2-phase-2c
  decision_id: D-20260726-S2C-01
  decision: go_to_stage_2d_data_only
  unambiguous_go_no_go: GO
  approved_implementation_scope:
    - { field: "defense-catalog.js#STAGES[cinder-span].gateTicks", before: 720, approved: 900 }
    - { field: "defense-catalog.js#CINDER_SPAN_WAVE_PLAN[0]", before: { pure: { rusher: 4 }, mixed: { rusher: 2, flanker: 2 } }, approved: { pure: { rusher: 7 }, mixed: { rusher: 4, flanker: 3 } } }
    - { field: "defense-catalog.js#CINDER_SPAN_WAVE_PLAN[1]", before: { pure: { flanker: 3 }, mixed: { flanker: 2, rusher: 1 } }, approved: { pure: { flanker: 5 }, mixed: { flanker: 3, rusher: 2 } } }
    - { field: "defense-catalog.js#CINDER_SPAN_WAVE_PLAN[2]", before: { pure: { ranged: 2 }, mixed: { ranged: 1, flanker: 1 } }, approved: { pure: { ranged: 4 }, mixed: { ranged: 2, flanker: 2 } } }
    - { field: rpg-catalog.js#BOSS_RALLY_COOLDOWN_REDUCTION, before: 0.20, approved: 0.00 }
    - { field: rpg-catalog.js#STANCE_CONFIG.TURRET.derivedFrontCount, before: 0, approved: 1 }
  signed_agreement:
    artifact: pm/negotiation-record.md
    entries: [1, 2, 3, 4, 5, 6]
    signed: [game-designer, game-pm]
  implementation_limits:
    data_only: true
    no_source_or_test_scope_in_this_decision: true
    preserve_runtime_ids: [cinder-span, s1-ember-hunter, rusher, ember-cohort]
    preserve_extraction:
      occupation: { radius: 900, holdTicks: 180, moveMultiplier: 1.05, rangeMultiplier: 1.08 }
      extraction: { radius: 1000, windowTicks: 600, hard_floor_windowTicks: 180 }
    preserve_one_handoff_safeguard: { accepted_ELITE_EXTRACTED_handoffs_per_run_maximum: 1 }
    preserve_g1_user_visible_canon: "No player-visible strings, effects, scenarios, runtime IDs, campaign schema, GLBs, or renderer behavior may change."
    no_monetization:
      retained: true
      prohibited: [paid_path, account, premium_currency, ads, gacha, paid_power, paid_reroll, paid_recovery]
      G5_status: N/A
      G5_not_pass_because: "No paid/free cohorts, revenue point, or commerce measurement exists."
  evidence:
    - path: messages/001-qa-baseline.md#material-findings
      observed: "Cinder is saturated; rally-then-Turret is a 10/10 candidate exploit; no Stage 2 gate is ready to pass."
      method: "QA deterministic scripted baseline, 2026-07-26T01:16:30Z–01:21:22Z."
    - path: design/balance-sheet.md#before--proposed-data-change
      observed: "The exact six data values, target Cinder pressure band, TTK band, and post-change probe plan."
      method: "Designer Phase 2b numeric proposal."
    - path: design/core-loop.md#before--proposed-model
      observed: "Extraction values remain frozen and scripted reachability requires separate human evidence for G7."
      method: "Designer G7 model and regression plan."
    - path: pm/reward-bands.md#G5-decision
      observed: "G5 is N/A, not PASS, under the no-monetization boundary."
      method: "PM boundary contract."
    - path: pm/negotiation-record.md
      observed: "Designer and PM signed all six field agreements with numeric bounds."
      method: "Stage 2c agreement record."
  gate_state_after_decision:
    G1: "carried forward only while user-visible canon remains unchanged"
    G2: FIX
    G3: FIX
    G5: N/A
    G7: BLOCKED
    G8: BLOCKED
  mandatory_post_change_measurement:
    cinder_pressure_and_ttk:
      command: "node scripts/run-g2-margin-probe.mjs --seeds 401,402,403,404,405 --stances VANGUARD,TURRET,SPLIT --output /tmp/abyssal-s2-retune-margin.json"
      require: { cinder_rows: 15, gateMinPct_band: [55.0, 80.0], defeat_rate_band: [0.0, 0.20], boss_TTK_s_band: [5.95, 8.05] }
      evidence_destination: qa/gate-measurements.md#g2
    archetype_and_matchup:
      required: "Run rusher, turtle, economy-greed, micro-optimizer, and casual at seeds 401–405; separately provide the required 20-paired-trial-per-archetype symmetric matchup export before any 45–55% matchup claim."
      evidence_destination: [qa/gate-measurements.md#g2, qa/playtest-report.md]
    formation_and_exploit:
      commands:
        - "node scripts/run-g3-stance-events.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-retune-stance.json"
        - "node scripts/run-g3-exploit-probe.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-retune-exploit.json"
      require: "No cooldown-reduction benefit retained by rally-then-Turret; TURRET has one targetable FRONT companion; maxEV/medianEV <= 1.30; at least one consequential companion-risk signal appears outside TURRET."
      evidence_destination: [qa/gate-measurements.md#g3, qa/exploit-register.md]
    extraction_regression_and_human_proof:
      scripted_command: "node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-retune-g7-scripted.json"
      scripted_require: "For Cinder seeds 901–903, retain EXTRACTION_WINDOW_OPENED, window-open to ready <10.00 s, accepted EXTRACT_ELITE, EXTRACTION_COMPLETED, ELITE_EXTRACTED, extracted=true, and no more than one accepted handoff per run."
      persistence_require: "For victory, defeat after acceptance, and defeat before acceptance, retain event traces plus campaign-state before/after diffs; reject duplicate accepted handoffs and any persistent write without acceptance."
      human_require: "Rendered moderated session: 10 participants, 20 eligible re-entry decisions, at least 14 voluntary Cinder re-entries, and retained player-visible evidence for the elite prompt, movement, hold, accepted action, result/persistence, and re-entry choice."
      evidence_destination: [qa/gate-measurements.md#g7, qa/playtest-report.md]
  escalation_rule: "Any value outside approved_implementation_scope, any extraction/canon/monetization change, or failure of a mandatory measurement returns to Stage 2b for a new numeric negotiation; it is not an implicit Stage 2 gate pass."
```

## Rationale

The baseline provides sufficient evidence to choose bounded mitigation values, not to certify outcome bands. The proposal is therefore limited to the six signed data values: staged Cinder pressure, removal of a bankable rally cooldown benefit, and one targetable TURRET front companion. Extraction stays frozen because its scripted route already completes with 7.54 seconds of window slack; the one-handoff safeguard remains mandatory. The no-monetization boundary keeps G5 inapplicable, and preserving player-visible canon is a condition of carrying G1 forward.

---

## D-20260726-S2C-02 — Final Stage 2b retune authorization

**Director decision:** **GO — apply exactly the six signed current→proposed data values below, once, then remeasure.** The preceding `D-20260726-S2C-01` decision remains immutable history; its now-current values (`gateTicks=900`, rally reduction `0.0`, and TURRET derived FRONT count `1`) are frozen and are not application targets in this decision.

```yaml
final_retune_director_contract:
  decision_id: D-20260726-S2C-02
  proposal_id: stage-2b-final-cinder-data-retune
  status: GO_for_one_data_only_application_and_remeasurement
  go_basis:
    designer_signoff: "design/balance-sheet.md#exact-current--proposed-values"
    pm_signoff: "pm/reward-bands.md#assessed-final-proposal--only-these-existing-data-fields"
    condition: "All six current-to-proposed values and their numeric bounds match across the designer and PM artifacts."
  approved_implementation_scope_exact:
    - field: defense-catalog.js#CINDER_SPAN_WAVE_PLAN[0]
      current: { tick: 0, pure: { rusher: 7 }, mixed: { rusher: 4, flanker: 3 } }
      approved: { tick: 0, pure: { rusher: 14 }, mixed: { rusher: 8, flanker: 6 } }
    - field: defense-catalog.js#CINDER_SPAN_WAVE_PLAN[1]
      current: { tick: 180, pure: { flanker: 5 }, mixed: { flanker: 3, rusher: 2 } }
      approved: { tick: 120, pure: { flanker: 10 }, mixed: { flanker: 7, rusher: 3 } }
    - field: defense-catalog.js#CINDER_SPAN_WAVE_PLAN[2]
      current: { tick: 390, pure: { ranged: 4 }, mixed: { ranged: 2, flanker: 2 } }
      approved: { tick: 240, pure: { ranged: 8 }, mixed: { ranged: 5, flanker: 3 } }
    - field: rpg-catalog.js#STANCE_CONFIG.TURRET.offsets[0]
      current: "freeze({x: Math.round(OCTANT_VECTORS.E.x * 0.3), y: Math.round(OCTANT_VECTORS.E.y * 0.3)})"
      approved: "freeze({x: Math.round(OCTANT_VECTORS.W.x * 0.3), y: Math.round(OCTANT_VECTORS.W.y * 0.3)})"
    - field: rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[0]
      current: "freeze({x: Math.round(OCTANT_VECTORS.NW.x * 1.4), y: Math.round(OCTANT_VECTORS.NW.y * 1.4)})"
      approved: "freeze({x: Math.round(OCTANT_VECTORS.NW.x * 2.0), y: Math.round(OCTANT_VECTORS.NW.y * 2.0)})"
    - field: rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[1]
      current: "freeze({x: Math.round(OCTANT_VECTORS.SW.x * 1.4), y: Math.round(OCTANT_VECTORS.SW.y * 1.4)})"
      approved: "freeze({x: Math.round(OCTANT_VECTORS.SW.x * 2.0), y: Math.round(OCTANT_VECTORS.SW.y * 2.0)})"
  frozen_not_application_targets:
    defense-catalog.js#STAGES[cinder-span].gateTicks: 900
    rpg-catalog.js#BOSS_RALLY_COOLDOWN_REDUCTION: 0.0
    rpg-catalog.js#STANCE_CONFIG.TURRET.derivedFrontCount: 1
    rpg-catalog.js#STANCE_CONFIG.VANGUARD.derivedFrontCount: 2
  immutable_boundaries:
    extraction:
      occupation: { radius: 900, holdTicks: 180, moveMultiplier: 1.05, rangeMultiplier: 1.08, recoveryPerSecond: 4 }
      extraction: { radius: 1000, windowTicks: 600, hard_floor_windowTicks: 180 }
      accepted_elite_handoffs_per_run_maximum: 1
      reject: [duplicate_accepted_handoff, persistent_write_without_accepted_EXTRACT_ELITE]
    runtime_ids: [cinder-span, s1-ember-hunter, rusher, ember-cohort]
    unchanged: [player_visible_canon, campaign_schema, GLBs, renderer, global_enemy_stats, rewards, source, tests]
    no_monetization: [paid_path, account, premium_currency, ads, gacha, paid_power, paid_reroll, paid_recovery]
  gate_state_before_remeasurement: { G2: FIX, G3: FIX, G5: N/A, G7: BLOCKED, G8: BLOCKED }
  required_raw_measurements:
    cinder_pressure:
      command: "node scripts/run-g2-margin-probe.mjs --seeds 401,402,403,404,405 --stances VANGUARD,TURRET,SPLIT --output /tmp/abyssal-s2-final-margin.json"
      pass_conditions: "15 rows; every gateMinPct 55.0–80.0%; aggregate defeats 0–3/15; every boss TTK 5.95–8.05 s."
    archetype_viability:
      commands:
        - "node scripts/run-g2-archetype-rotation.mjs rusher --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-rusher.json"
        - "node scripts/run-g2-archetype-rotation.mjs turtle --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-turtle.json"
        - "node scripts/run-g2-archetype-rotation.mjs economy-greed --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-economy-greed.json"
        - "node scripts/run-g2-archetype-rotation.mjs micro-optimizer --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-micro-optimizer.json"
        - "node scripts/run-g2-archetype-rotation.mjs casual --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-casual.json"
      pass_conditions: "At least 3 independently viable archetypes; the separate symmetric export must contain 20 paired trials per archetype at fixed seeds 401–405, identical value budgets, archetypeId, counterProfileId, seed, and winner before a 45–55% matchup claim; legal-combo maxEV/medianEV <=1.30."
    formation_and_exploit:
      commands:
        - "node scripts/run-g3-stance-events.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-stance.json"
        - "node scripts/run-g3-exploit-probe.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-exploit.json"
      pass_conditions: "BOSS_RALLY_COOLDOWN_REDUCTION=0.0; TURRET FRONT count=1; all 50 rally-then-TURRET conversions have takenAfterSwitch >0; zero zero-damage conversions; 50 VANGUARD plus 50 SPLIT runs have >=1 COMPANION_DOWNED and <=20% combined defeats; legal-combo maxEV/medianEV <=1.30."
    extraction_regression:
      command: "node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-final-g7-scripted.json"
      pass_conditions: "Cinder seeds 901–903 retain EXTRACTION_WINDOW_OPENED, window-open-to-ready <10.00 s, accepted EXTRACT_ELITE, EXTRACTION_COMPLETED, ELITE_EXTRACTED, extracted=true, <=1 accepted handoff, plus event traces and campaign-state before/after diffs for victory, defeat-after-acceptance, and defeat-before-acceptance; reject duplicate accepted handoffs and any persistent write without accepted EXTRACT_ELITE."
  evidence_debt_not_a_pass:
    G7: "Remain BLOCKED until a rendered moderated session has 10 participants, 20 eligible re-entry decisions, >=14 voluntary Cinder re-entries, and visible prompt/movement/hold/accepted-action/result/persistence/re-entry evidence."
    G8: "Remain BLOCKED until a five-title direct-feature survey is <=2/5 and a ten-session human-impression median is >=4.0/5."
    G5: "Remain N/A, not PASS: no paid/free cohort, revenue point, or commerce measurement exists."
  mandatory_redo: "Any signed-value mismatch, frozen-boundary breach, numeric threshold miss, required-output omission, or missing evidence is REDO. Retain G2/G3 FIX, G5 N/A, and G7/G8 BLOCKED; do not substitute values, infer a pass, or issue further retune authority."
```

**Current evidence is not a pass:** the prior retune recorded `15/15` Cinder rows above the `80%` gate-minimum ceiling (`88.0–96.8%`) and `0` post-switch companion damage in `50/50` rally-then-TURRET conversions. Its `0/15` defeats and `6.43–7.17 s` TTK are in band. The final six-field GO therefore authorizes only this bounded testable change, while the stated **REDO** rule remains mandatory on any miss.

---

## D-20260726-S2C-03 — Final Stage 2 gate disposition and scope decision

**Director decision:** **REDO — NO GO for another numerical retune. Re-enter Stage 1, Phase 1b for a Cinder pressure-and-agency concept/architecture redesign plus measurement instrumentation packet.**

```yaml
final_gate_disposition:
  decision_id: D-20260726-S2C-03
  reviewed_remeasurement: D-20260726-S2C-02
  final_measurement_window: "2026-07-26T02:20:05Z–2026-07-26T02:25:53Z"
  decision: redo_to_stage_1_phase_1b
  unambiguous_go_no_go: "NO GO for further numerical tuning"
  third_failure_policy:
    G2: "third failure after two FIX loops; retain FIX gate state and force REDO"
    G3: "third failure after two FIX loops; retain FIX gate state and force REDO"
  final_gate_state: { G2: FIX, G3: FIX, G5: N/A, G7: BLOCKED, G8: BLOCKED }
  no_gate_promoted: true
  observed_failure_basis:
    G2:
      cinder_gate_band: "10/15 rows outside 55.0–80.0%"
      required_ttk_output: "1/15 missing after SPLIT seed 403 defeat"
      missing_evidence: "0 qualifying symmetric matchup exports and 0 legal-combo EV series"
    G3:
      non_turret_consequence: "0/100 VANGUARD+SPLIT COMPANION_DOWNED; required >=1"
      rally_then_turret: "50/50 zero-damage post-switch conversions; required 0"
      missing_evidence: "no legal-combo maxEV/medianEV <=1.30 series"
    G5: "N/A, not PASS: 0 monetization surfaces and no cohort-dependent measurement"
    G7:
      scripted_route: "1/3 Cinder seeds complete; 902/903 fail before extraction"
      missing_evidence: "0 persistence trace-and-diff sets; 0/10 participants, 0/20 decisions, 0/14 re-entries"
    G8: "0/5 reviewed direct-feature survey entries; 0/10 human-impression sessions"
  scope_boundary:
    preserve: [D-20260726-S2C-01, D-20260726-S2C-02, runtime_ids, one_handoff_safeguard, extraction_boundary, player_visible_canon, campaign_schema, GLBs, renderer, no_monetization]
    prohibited_until_packet_reviewed: [additional_numeric_retune, threshold_change, inferred_gate_pass]
  required_stage_1_packet:
    name: "Cinder pressure-and-agency redesign/instrumentation"
    prerequisites_before_any_numerical_tuning:
      - "Define an authored pressure model able to observe every Cinder row against the unchanged 55.0–80.0% gate-minimum, 0–3/15 defeat, and 5.95–8.05 s per-row TTK requirements."
      - "Define a formation-risk and rally-to-TURRET transition that can emit a non-TURRET consequence within the unchanged <=20% defeat ceiling and positive post-switch damage in all 50 required conversions without restoring cooldown benefit."
      - "Implement an evidence surface for 20 symmetric paired trials per archetype at fixed seeds 401–405 with equal budgets, archetypeId, counterProfileId, seed, winner, and a legal-combo maxEV/medianEV series."
      - "Restore reliable scripted Cinder routes for 901–903 and emit retained traces plus campaign-state before/after diffs for victory, defeat-after-acceptance, and defeat-before-acceptance."
      - "Prepare the rendered study protocol that can collect G7 10-participant/20-decision/>=14-re-entry evidence and G8 five-title direct-feature plus ten-session >=4.0/5 impression evidence."
  threshold_policy: "All existing G2/G3/G5/G7/G8 thresholds remain unchanged. Missing evidence remains a failure."
  evidence:
    - { path: qa/gate-measurements.md, method: "Final deterministic probes and artifact checks, 2026-07-26T02:20:05Z–02:25:53Z" }
    - { path: qa/post-retune-derived-summary.json, method: "Durable final derived results and commands" }
    - { path: qa/playtest-report.md, method: "Final scripted evidence classification" }
    - { path: qa/exploit-register.md, method: "Final failure register" }
    - { path: qa/regression-matrix.md, method: "Final required-evidence audit" }
    - { path: messages/003-qa-final-retune.md, method: "QA REDO broadcast" }
```

This decision closes the current Stage 2 balance/agency pass. It does not supersede the signed values or safeguards in `D-20260726-S2C-01` and `D-20260726-S2C-02`; it records why their final remeasurement cannot be repaired by a third data-only loop.
