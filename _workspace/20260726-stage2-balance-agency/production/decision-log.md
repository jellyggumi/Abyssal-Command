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
      scripted_require: "For Cinder seeds 901–903, retain accepted EXTRACT_ELITE, EXTRACTION_COMPLETED, ELITE_EXTRACTED, and no more than one accepted handoff per run."
      human_require: "Rendered moderated session: 10 participants, 20 eligible re-entry decisions, at least 14 voluntary Cinder re-entries, and retained player-visible evidence for the elite prompt, movement, hold, accepted action, result/persistence, and re-entry choice."
      evidence_destination: [qa/gate-measurements.md#g7, qa/playtest-report.md]
  escalation_rule: "Any value outside approved_implementation_scope, any extraction/canon/monetization change, or failure of a mandatory measurement returns to Stage 2b for a new numeric negotiation; it is not an implicit Stage 2 gate pass."
```

## Rationale

The baseline provides sufficient evidence to choose bounded mitigation values, not to certify outcome bands. The proposal is therefore limited to the six signed data values: staged Cinder pressure, removal of a bankable rally cooldown benefit, and one targetable TURRET front companion. Extraction stays frozen because its scripted route already completes with 7.54 seconds of window slack; the one-handoff safeguard remains mandatory. The no-monetization boundary keeps G5 inapplicable, and preserving player-visible canon is a condition of carrying G1 forward.
