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
    - "Run the Cinder scripted extraction regression for seeds 901–903; require accepted EXTRACT_ELITE, EXTRACTION_COMPLETED, and ELITE_EXTRACTED with no more than one accepted handoff per run."
    - "Run the required rendered human session: 10 participants, 20 eligible re-entry decisions, and at least 14 voluntary Cinder re-entries; no scripted result may be reported as G7 completion."
```