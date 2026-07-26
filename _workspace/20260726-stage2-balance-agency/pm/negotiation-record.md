# Stage 2c Negotiation Record — Cinder Pressure and Formation Trade-off

**Round result:** **AGREED — GO to Stage 2d for the six listed data-only values only.** This authorizes implementation and the mandatory remeasurement plan; it does **not** pass G2, G3, G7, or G8. G5 remains **N/A, not PASS**.

## Evidence basis

- QA found Cinder saturated at a 98.00% minimum gate for all three stances, with boss TTKs of 6.83/7.17/6.77 s and no Cinder defeats: `qa/gate-measurements.md#g2`, `qa/playtest-report.md#cinder-span-pressure`, `qa/exploit-register.md#s2-001`.
- QA reproduced rally-then-Turret in 10/10 runs with a retained rally, zero post-switch companion damage, zero downs, and zero defeats: `qa/exploit-register.md#s2-003`, `qa/gate-measurements.md#g3`.
- The designer's exact data proposal and its target bands are in `design/balance-sheet.md#before--proposed-data-change`; the extraction preservation rationale is in `design/core-loop.md#before--proposed-model` and `engineering/extraction-agency-analysis.md#recommendation-and-guardrails`.
- PM constraints are the no-monetization product boundary, one accepted elite handoff per run, zero paid comeback activations, and a 0.0 maximum retained-rally/zero-post-switch-damage conversion rate: `pm/reward-bands.md#retune-handoff`.

```yaml
artifact_contract:
  schema_version: artifact-contract/1
  artifact_id: pm.negotiation-record
  artifact_path: pm/negotiation-record.md
  run_id: 20260726-stage2-balance-agency
  stage: stage-2-phase-2c
  status: agreed_go_to_stage_2d_data_only
  agreement_scope: [cinder_gate_ticks, cinder_wave_0, cinder_wave_1, cinder_wave_2, boss_rally_cooldown_reduction, turret_derived_front_count]
  gate_status_before_remeasurement:
    G2: FIX
    G3: FIX
    G5: N/A
    G7: BLOCKED
    G8: BLOCKED
  implementation_decision:
    stage_2d_data_only: GO
    authorization: "Apply exactly the six agreed numeric data values; then perform the recorded QA remeasurement."
    gate_promotion: "prohibited before post-change evidence"
  agreements:
    - entry: 1
      revenue_point: "none — gameplay-only Cinder pressure; no monetization surface"
      field: defense-catalog.js#STAGES[cinder-span].gateTicks
      balance_number: { before_ticks: 720, proposed_ticks: 900, delta_ticks: 180, before_seconds: 12.0, proposed_seconds: 15.0 }
      designer_bound: { value: 900, rationale: "Allows the authored three-wave packet to create a measurable gate decision without changing the stage ID or objective order." }
      pm_bound: { value: 900, rationale: "Stage-local pressure only; it must not add a revenue, paid recovery, or persistent-reward change and must be remeasured against the agreed 55–80% Cinder gate-minimum band." }
      agreed: 900
      decision: "approve for Stage 2d"
      evidence_refs: [design/balance-sheet.md#before--proposed-data-change, qa/gate-measurements.md#g2, qa/exploit-register.md#s2-001, pm/reward-bands.md#non_monetary_fairness_rule]
      signed: [game-designer, game-pm]
    - entry: 2
      revenue_point: "none — gameplay-only Cinder pressure; no monetization surface"
      field: defense-catalog.js#CINDER_SPAN_WAVE_PLAN[0]
      balance_number: { before: { pure: { rusher: 4 }, mixed: { rusher: 2, flanker: 2 } }, proposed: { pure: { rusher: 7 }, mixed: { rusher: 4, flanker: 3 } }, total_before: 4, total_proposed: 7 }
      designer_bound: { value: { pure: { rusher: 7 }, mixed: { rusher: 4, flanker: 3 } }, rationale: "Raises opening pressure while preserving the existing rusher/flanker variant IDs and the two existing composition branches." }
      pm_bound: { value: { pure_total: 7, mixed_total: 7 }, rationale: "No new enemy, reward, entitlement, or commerce surface; exact existing-variant composition only, followed by the Cinder pressure and extraction regression measurements." }
      agreed: { pure: { rusher: 7 }, mixed: { rusher: 4, flanker: 3 } }
      decision: "approve for Stage 2d"
      evidence_refs: [design/balance-sheet.md#before--proposed-data-change, qa/gate-measurements.md#g2, qa/exploit-register.md#s2-001, design/core-loop.md#before--proposed-model]
      signed: [game-designer, game-pm]
    - entry: 3
      revenue_point: "none — gameplay-only Cinder pressure; no monetization surface"
      field: defense-catalog.js#CINDER_SPAN_WAVE_PLAN[1]
      balance_number: { before: { pure: { flanker: 3 }, mixed: { flanker: 2, rusher: 1 } }, proposed: { pure: { flanker: 5 }, mixed: { flanker: 3, rusher: 2 } }, total_before: 3, total_proposed: 5 }
      designer_bound: { value: { pure: { flanker: 5 }, mixed: { flanker: 3, rusher: 2 } }, rationale: "Makes flank response consequential without changing enemy IDs, policy behavior, or spawn direction." }
      pm_bound: { value: { pure_total: 5, mixed_total: 5 }, rationale: "No additional reward or monetization coupling; retain the same two branches and prove the pressure does not invalidate the one-handoff extraction safeguard." }
      agreed: { pure: { flanker: 5 }, mixed: { flanker: 3, rusher: 2 } }
      decision: "approve for Stage 2d"
      evidence_refs: [design/balance-sheet.md#before--proposed-data-change, qa/gate-measurements.md#g2, qa/exploit-register.md#s2-001, pm/reward-bands.md#reward_safeguards]
      signed: [game-designer, game-pm]
    - entry: 4
      revenue_point: "none — gameplay-only Cinder pressure; no monetization surface"
      field: defense-catalog.js#CINDER_SPAN_WAVE_PLAN[2]
      balance_number: { before: { pure: { ranged: 2 }, mixed: { ranged: 1, flanker: 1 } }, proposed: { pure: { ranged: 4 }, mixed: { ranged: 2, flanker: 2 } }, total_before: 2, total_proposed: 4 }
      designer_bound: { value: { pure: { ranged: 4 }, mixed: { ranged: 2, flanker: 2 } }, rationale: "Creates a denial packet that competes with a passive hold without adding a wave slot." }
      pm_bound: { value: { pure_total: 4, mixed_total: 4 }, rationale: "No new wave slot, reward, paid advantage, or persistence exception; remeasure base-stage pressure and the frozen extract route after implementation." }
      agreed: { pure: { ranged: 4 }, mixed: { ranged: 2, flanker: 2 } }
      decision: "approve for Stage 2d"
      evidence_refs: [design/balance-sheet.md#before--proposed-data-change, qa/gate-measurements.md#g2, qa/exploit-register.md#s2-001, engineering/extraction-agency-analysis.md#current-evidence]
      signed: [game-designer, game-pm]
    - entry: 5
      revenue_point: "none — formation reward conversion is non-commercial gameplay"
      field: rpg-catalog.js#BOSS_RALLY_COOLDOWN_REDUCTION
      balance_number: { before: 0.20, proposed: 0.00, unit: cooldown_reduction_fraction }
      designer_bound: { value: 0.00, rationale: "Removes the bankable cooldown-reduction DPS benefit that survives a switch into TURRET; the rally event may remain observable with zero cooldown-reduction EV." }
      pm_bound: { value: 0.00, rationale: "Matches the 0.0 maximum retained-rally plus zero-post-switch-damage conversion safeguard; no paid comeback or reward path may be introduced." }
      agreed: 0.00
      decision: "approve for Stage 2d"
      evidence_refs: [design/balance-sheet.md#before--proposed-data-change, qa/exploit-register.md#s2-003, qa/gate-measurements.md#g3, pm/reward-bands.md#reward_safeguards]
      signed: [game-designer, game-pm]
    - entry: 6
      revenue_point: "none — formation survivability is non-commercial gameplay"
      field: rpg-catalog.js#STANCE_CONFIG.TURRET.derivedFrontCount
      balance_number: { before: 0, proposed: 1, unit: targetable_front_companions }
      designer_bound: { value: 1, rationale: "TURRET retains one targetable companion instead of total companion immunity; the intended trade-off requires post-change measurement rather than an assumed result." }
      pm_bound: { value: 1, rationale: "Eliminates the zero-targetable-front condition while preserving no paid recovery and requiring the conversion probe to show no retained-rally/zero-damage escape." }
      agreed: 1
      decision: "approve for Stage 2d"
      evidence_refs: [design/balance-sheet.md#before--proposed-data-change, qa/exploit-register.md#s2-002, qa/exploit-register.md#s2-003, pm/reward-bands.md#reward_safeguards]
      signed: [game-designer, game-pm]
  shared_nonnegotiable_constraints:
    extraction_freeze:
      occupation: { radius: 900, holdTicks: 180, moveMultiplier: 1.05, rangeMultiplier: 1.08 }
      extraction: { radius: 1000, windowTicks: 600, hard_floor_windowTicks: 180 }
      rationale: "Cinder scripted extraction is already reachable with 7.54 seconds of window slack; pressure, not extraction availability, is the baseline defect."
      evidence_refs: [design/core-loop.md#extraction_guardrail, engineering/extraction-agency-analysis.md#current-evidence]
    runtime_and_canon_freeze:
      frozen_ids: [cinder-span, s1-ember-hunter, rusher, ember-cohort]
      no_user_visible_canon_change: true
      rationale: "Stage 2d may not change runtime IDs, campaign schema, GLBs, renderer behavior, or player-visible strings/effects/scenarios; G1 is carried forward only while canon remains unchanged."
      evidence_refs: [production/task-manifest.md#hard-policy, design/balance-sheet.md#gate-state, design/core-loop.md#extraction_guardrail]
    one_handoff_safeguard:
      accepted_elite_handoffs_per_run_maximum: 1
      verification: "For victory, defeat after acceptance, and defeat before acceptance, QA retains event traces and campaign-state before/after diffs; reject a duplicate accepted handoff or any persistent write without acceptance."
      evidence_refs: [pm/reward-bands.md#reward_safeguards, qa/playtest-report.md#scripted-extract-elite-route]
    no_monetization_boundary:
      status: retained
      excluded_surfaces: [paid_path, account, premium_currency, ads, gacha, paid_power, paid_reroll, paid_recovery]
      G5: N/A
      evidence_refs: [production/task-manifest.md#hard-policy, pm/reward-bands.md#G5-decision, pm/revenue-forecast.md#g5-assessment]
  required_post_change_measurement:
    - "Run the 15-row Cinder margin probe at seeds 401–405 and stances VANGUARD,TURRET,SPLIT; require Cinder gateMinPct 55–80%, defeat rate 0–20%, and boss TTK 5.95–8.05 s."
    - "Run five-archetype viability at seeds 401–405 and obtain the required deterministic symmetric matchup export before any G2 45–55% claim."
    - "Run the stance and rally-then-Turret probes at seeds 401–405; require zero cooldown-reduction benefit, no zero-targetable-front TURRET condition, maxEV/medianEV <= 1.30, and at least one consequential companion-risk signal outside TURRET."
    - "Run the Cinder scripted extraction regression for seeds 901–903; require EXTRACTION_WINDOW_OPENED, window-open to ready <10.00 s, accepted EXTRACT_ELITE, EXTRACTION_COMPLETED, ELITE_EXTRACTED, extracted=true, and no more than one accepted handoff per run. For victory, defeat after acceptance, and defeat before acceptance, retain event traces plus campaign-state before/after diffs and reject duplicate handoffs or a write without acceptance."
    - "Run the required rendered human session: 10 participants, 20 eligible re-entry decisions, and at least 14 voluntary Cinder re-entries; no scripted result may be reported as G7 completion."
```

---

## Stage 2c final-retune addendum — Final six-field Cinder pressure and formation trade-off

**Round result:** **AGREED — GO to one bounded data-only implementation and mandatory remeasurement.** This addendum is the final permitted Stage 2b retune. It preserves the preceding Stage 2c agreement as immutable history; it does not reopen, replace, or reapply that agreement's `gateTicks`, rally-reduction, or TURRET-FRONT changes.

```yaml
final_retune_contract:
  contract_id: stage-2b-final-cinder-data-retune
  status: agreed_go_to_one_data_only_application
  authorization_count: 1
  implementation_decision: GO
  gate_promotion: prohibited_pending_remeasurement_and_director_verdict
  signer_agreement:
    game_designer:
      source: design/balance-sheet.md#exact-current--proposed-values
      agreement: "All six values below are the final data-only proposal."
    game_pm:
      source: pm/reward-bands.md#assessed-final-proposal--only-these-existing-data-fields
      agreement: "All six values below are conditionally acceptable only within the recorded bounds."
    director_condition: "GO exists only because the designer and PM agree on each exact current-to-proposed value and its acceptance bounds."
  allowed_runtime_data_paths_exact:
    - defense-catalog.js#CINDER_SPAN_WAVE_PLAN[0]
    - defense-catalog.js#CINDER_SPAN_WAVE_PLAN[1]
    - defense-catalog.js#CINDER_SPAN_WAVE_PLAN[2]
    - rpg-catalog.js#STANCE_CONFIG.TURRET.offsets[0]
    - rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[0]
    - rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[1]
  signed_values:
    - field: defense-catalog.js#CINDER_SPAN_WAVE_PLAN[0]
      current: { tick: 0, pure: { rusher: 7 }, mixed: { rusher: 4, flanker: 3 } }
      proposed: { tick: 0, pure: { rusher: 14 }, mixed: { rusher: 8, flanker: 6 } }
    - field: defense-catalog.js#CINDER_SPAN_WAVE_PLAN[1]
      current: { tick: 180, pure: { flanker: 5 }, mixed: { flanker: 3, rusher: 2 } }
      proposed: { tick: 120, pure: { flanker: 10 }, mixed: { flanker: 7, rusher: 3 } }
    - field: defense-catalog.js#CINDER_SPAN_WAVE_PLAN[2]
      current: { tick: 390, pure: { ranged: 4 }, mixed: { ranged: 2, flanker: 2 } }
      proposed: { tick: 240, pure: { ranged: 8 }, mixed: { ranged: 5, flanker: 3 } }
    - field: rpg-catalog.js#STANCE_CONFIG.TURRET.offsets[0]
      current: "freeze({x: Math.round(OCTANT_VECTORS.E.x * 0.3), y: Math.round(OCTANT_VECTORS.E.y * 0.3)})"
      proposed: "freeze({x: Math.round(OCTANT_VECTORS.W.x * 0.3), y: Math.round(OCTANT_VECTORS.W.y * 0.3)})"
    - field: rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[0]
      current: "freeze({x: Math.round(OCTANT_VECTORS.NW.x * 1.4), y: Math.round(OCTANT_VECTORS.NW.y * 1.4)})"
      proposed: "freeze({x: Math.round(OCTANT_VECTORS.NW.x * 2.0), y: Math.round(OCTANT_VECTORS.NW.y * 2.0)})"
    - field: rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[1]
      current: "freeze({x: Math.round(OCTANT_VECTORS.SW.x * 1.4), y: Math.round(OCTANT_VECTORS.SW.y * 1.4)})"
      proposed: "freeze({x: Math.round(OCTANT_VECTORS.SW.x * 2.0), y: Math.round(OCTANT_VECTORS.SW.y * 2.0)})"
  immutable_retained_values:
    defense-catalog.js#STAGES[cinder-span].gateTicks: 900
    rpg-catalog.js#BOSS_RALLY_COOLDOWN_REDUCTION: 0.0
    rpg-catalog.js#STANCE_CONFIG.TURRET.derivedFrontCount: 1
    rpg-catalog.js#STANCE_CONFIG.VANGUARD.derivedFrontCount: 2
  immutable_constraints:
    extraction:
      occupation: { radius: 900, holdTicks: 180, moveMultiplier: 1.05, rangeMultiplier: 1.08, recoveryPerSecond: 4 }
      extraction: { radius: 1000, windowTicks: 600, hard_floor_windowTicks: 180 }
      accepted_elite_handoffs_per_run_maximum: 1
      reject: [duplicate_accepted_handoff, persistent_write_without_accepted_EXTRACT_ELITE]
    frozen_runtime_ids: [cinder-span, s1-ember-hunter, rusher, ember-cohort]
    prohibited_changes: [global_enemy_stats, rewards, extraction, runtime_ids, campaign_schema, player_visible_canon, GLBs, renderer, source, tests, monetization]
    no_monetization: [paid_path, account, premium_currency, ads, gacha, paid_power, paid_reroll, paid_recovery]
  required_measurement:
    data_boundary_audit:
      require: "All six signed proposed values exactly, and every immutable retained value and constraint unchanged."
    cinder_pressure:
      command: "node scripts/run-g2-margin-probe.mjs --seeds 401,402,403,404,405 --stances VANGUARD,TURRET,SPLIT --output /tmp/abyssal-s2-final-margin.json"
      require: { rows: 15, every_gateMinPct_percent: [55.0, 80.0], aggregate_defeats: [0, 3], every_boss_TTK_seconds: [5.95, 8.05] }
    archetype_viability:
      commands:
        - "node scripts/run-g2-archetype-rotation.mjs rusher --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-rusher.json"
        - "node scripts/run-g2-archetype-rotation.mjs turtle --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-turtle.json"
        - "node scripts/run-g2-archetype-rotation.mjs economy-greed --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-economy-greed.json"
        - "node scripts/run-g2-archetype-rotation.mjs micro-optimizer --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-micro-optimizer.json"
        - "node scripts/run-g2-archetype-rotation.mjs casual --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-casual.json"
      require: "At least 3 independently viable archetypes; before any 45–55% matchup claim, 20 paired trials per archetype at fixed seeds 401–405, identical value budgets, archetypeId, counterProfileId, seed, winner, and legal-combo maxEV/medianEV <= 1.30."
    formation_and_exploit:
      commands:
        - "node scripts/run-g3-stance-events.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-stance.json"
        - "node scripts/run-g3-exploit-probe.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-exploit.json"
      require: "BOSS_RALLY_COOLDOWN_REDUCTION=0.0; TURRET FRONT count=1; all 50 rally-then-TURRET conversions have takenAfterSwitch >0; zero zero-damage conversions; across 50 VANGUARD plus 50 SPLIT runs at least 1 COMPANION_DOWNED and <=20% combined defeat rate; legal-combo maxEV/medianEV <=1.30."
    extraction_regression:
      command: "node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-final-g7-scripted.json"
      require: "For Cinder seeds 901–903: EXTRACTION_WINDOW_OPENED, window-open-to-ready <10.00 s, accepted EXTRACT_ELITE, EXTRACTION_COMPLETED, ELITE_EXTRACTED, extracted=true, <=1 accepted handoff; retain event traces and campaign-state before/after diffs for victory, defeat-after-acceptance, and defeat-before-acceptance."
    human_evidence_debt:
      G7: "Rendered moderated session: 10 participants, 20 eligible re-entry decisions, >=14 voluntary Cinder re-entries, and visible prompt/movement/hold/accepted-action/result/persistence/re-entry evidence."
      G8: "Five-title direct-feature survey <=2/5 and ten-session human-impression median >=4.0/5."
  gate_state_before_remeasurement: { G2: FIX, G3: FIX, G5: N/A, G7: BLOCKED, G8: BLOCKED }
  mandatory_redo: "Any data-boundary mismatch, any numeric miss, any missing required evidence, or any immutable-constraint breach is REDO. Keep G2/G3 FIX, G5 N/A, and G7/G8 BLOCKED; do not infer a pass or substitute an unapproved value."
```

**Evidence basis:** The current implemented retune fails the Cinder envelope (`15/15` gate minima `88.0–96.8%`, versus `55.0–80.0%`) and retains zero post-switch companion damage in `50/50` rally-then-TURRET conversions, while its TTK (`6.43–7.17 s`) and defeat count (`0/15`) remain within the prior band. These facts support the bounded proposal, not a prospective pass: `qa/post-retune-derived-summary.json#cinderMargin`, `#exploit`, and `messages/002-qa-post-retune.md`.