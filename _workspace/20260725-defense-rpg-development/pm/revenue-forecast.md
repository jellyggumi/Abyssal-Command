# Revenue Forecast — Phase 2b Non-Monetary Progression Rhythm

## Forecast label

This is a **target progression-rhythm forecast**, not evidence, a retention forecast, a business forecast, or a runtime-success claim. It forecasts the intended ordering of already-contracted reward moments for one public 30–180-second loop. No monetary revenue, price, conversion, ARPU, paid/free fairness, or user-account measure is defined because those surfaces are out of scope.

The current evidence rejects treating this forecast as achieved: three Cinder Span samples are 26.90–27.70 seconds, the whole-stage set is only 6/9 inside the duration band, voluntary repeat is unmeasured, campaign policies clear 150/150 runs, and a different idle/macro policy loses 9/30. Those are inputs to the next measurement design, not confirmation of this forecast.

```yaml
artifact_contract:
  schema_version: artifact-contract/1
  artifact_id: pm.revenue-forecast
  artifact_path: pm/revenue-forecast.md
  run_id: 20260725-defense-rpg-development
  stage: stage-2-phase-2b
  status: forecast_target_pending_measurement
  evidence_status: not_evidence
  forecast_type: non_monetary_progression_rhythm
  excluded_metrics: [financial_revenue, price, ARPU, conversion, payer_mix, paid_free_fairness, account_retention]
  forecast_window:
    start: first_combat_input
    end: accepted_reward_event
    duration_minimum: { value: 30, unit: seconds, status: target_pending_measurement, reject_with: "Trace duration below 30 seconds." }
    duration_maximum: { value: 180, unit: seconds, status: target_pending_measurement, reject_with: "Trace duration above 180 seconds." }
  intended_rhythm:
    - order: 1
      moment: defend_and_scout
      target_window: { minimum: 0, maximum: 15, unit: seconds, status: target_pending_measurement, reject_with: "No MOVE plus visible Gate/Warden/threat state occurs in the recorded opening window." }
      value: "Read Gate/Warden risk and relocate deliberately."
    - order: 2
      moment: offense_or_recovery
      target_window: { minimum: 15, maximum: 35, unit: seconds, status: target_pending_measurement, reject_with: "No recorded collection, target-geometry change, or threatened-choke response occurs in the window." }
      value: "Leave passive safety for a measurable tactical trade-off."
    - order: 3
      moment: growth_choice
      target_window: { minimum: 30, maximum: 55, unit: seconds, status: target_pending_measurement, reject_with: "No GROWTH_OFFER and accepted SKILL_SELECTED event occurs in the window." }
      visible_options: { value: 3, unit: options, status: target_pending_measurement, reject_with: "Offer payload or UI capture contains other than three visible comparable options." }
      value: "Commit to one current → upgraded run-local change."
    - order: 4
      moment: contest
      target_window: { minimum: 45, maximum: 80, unit: seconds, status: target_pending_measurement, reject_with: "No occupation/pressure event or readable contest state occurs in the window." }
      value: "Balance position and offense against Gate/Warden risk."
    - order: 5
      moment: extraction
      target_window: { minimum: 55, maximum: 100, unit: seconds, status: target_pending_measurement, reject_with: "No extraction-ready plus accepted or expired Bind outcome is recorded." }
      value: "Close or lose a player-controlled elite handoff."
      accepted_handoffs_per_run_maximum: { value: 1, unit: handoffs, status: target_pending_measurement, reject_with: "More than one accepted extraction handoff is recorded in one run." }
    - order: 6
      moment: boss_and_stage_reward
      target_window: { minimum: 70, maximum: 180, unit: seconds, status: target_pending_measurement, reject_with: "No terminal outcome plus accepted REWARD_SELECTED event is recorded in the window." }
      accepted_selections_per_victory: { value: 1, unit: selections, status: target_pending_measurement, reject_with: "Victory has zero or more than one accepted stage reward selection." }
      value: "Preserve Gate/Warden through terminal risk and select one persistent-local reward."
  expected_qualifying_loop:
    deliberate_action_classes_minimum: { value: 3, unit: classes, status: target_pending_measurement, reject_with: "Ordered trace records fewer than three distinct deliberate classes." }
    accepted_reward_events_minimum: { value: 1, unit: events, status: target_pending_measurement, reject_with: "Trace records no accepted reward event." }
    temporary_comeback_activations: { value: 0, unit: activations, status: target_pending_measurement, reject_with: "Trace finds a new automatic or paid comeback/revival event." }
  rhythm_limits:
    persistent_reward_families: [accepted_extracted_companion, accepted_stage_reward, Archive_growth]
    run_local_reward_families: [growth_skill, run_item, derived_stat, synergy]
    defeat_rule: "Run-local rewards clear at defeat/return. Persistent state may exist only when an accepted authoritative handoff predated the defeat."
    no_recovery_sale_or_paid_path: true
  telemetry_fields_required:
    envelope: [schema_version, rules_version, local_run_index, stage_id, seed, tick, event_type, action_class, terminal_outcome]
    integrity_and_pressure: [Gate_HP_minimum, Warden_HP_minimum, threat_id, boss_id, boss_TTK_ticks, peak_density]
    reward_and_scope: [reward_type, reward_id, scope, offer_ids, selected_id, value_before, value_after, accepted_tick]
    extraction: [elite_id, candidate_tick, expires_at_tick, bind_started_tick, extraction_result, extraction_tick, persistent_write_event]
    persistence: [campaign_state_before_hash, campaign_state_after_hash, persistent_write_family, local_only]
    presentation_check: [viewport, control_bounds, safe_area_result, reduced_motion, current_to_upgraded_visible]
  validation_probes:
    - id: P-01
      method: "Fixed-seed deterministic traces across the five required archetypes using one shared adversarial input tape."
      rejects: "Missing action/reward/scope events, impossible loss risk, or rhythm outside the windows."
      destination: qa/gate-measurements.md
    - id: P-02
      method: "Focused Cinder Span timing rerun under the public-beat policy."
      rejects: "Any candidate loop below 30 seconds; explicitly retests the current 26.90–27.70-second samples."
      destination: qa/playtest-report.md
    - id: P-03
      method: "Victory/defeat/retry campaign before-after state diff."
      rejects: "Run-local carryover, unaccepted persistent grant, duplicate stage reward, or Archive combat delta."
      destination: qa/exploit-register.md
    - id: P-04
      method: "Portrait browser capture with HUD control measurement and reward scope labels."
      rejects: "The current safe-area defect or unreadable scope/current → upgraded presentation."
      destination: qa/playtest-report.md
```

## How the forecast is to be read

- The windows can overlap. Their order is an evidence schema, not a promise that every player receives every reward.
- An extraction **candidate** and a reward **preview** are not accepted rewards. Their expiry/failure must be recorded so a reward rate cannot hide loss.
- A defeat is a valid rhythm outcome. It must clear run-local rewards; it must not be softened by a paid, automatic, or UI-authored recovery.
- A successful extracted companion handoff or selected stage reward is local persistent state only after the authoritative event. Archive growth records accepted state but has zero direct combat delta.
- The expected run-local / persistent rhythm is falsifiable by the telemetry fields and probes above. Until those outputs exist, this file is not evidence.

## Research boundary

**Transferable inference, not runtime evidence or human-experience evidence:** short repeatable decision loops benefit from legible pressure, route/position choices, and across-attempt continuity. Canonical public-description sources are [Dead Cells](https://deadcells.com/), [Into the Breach](https://subsetgames.com/itb.html), [FTL](https://subsetgames.com/ftl.html), and [Hades](https://www.supergiantgames.com/games/hades/). These sources do not establish that the forecasted rhythm is fun, readable, or achieved in Abyssal Surge.
