# PM / Designer Negotiation Record — Stage 1

## Scope

This records concept-validation decisions between the `game-pm` and `game-designer` roles. Each numerical decision is a target pending measurement, not a shipped value or a passed gate. Role signatures indicate the shared artifact decision, not a change to the product contract or runtime rules.

```yaml
artifact_contract:
  schema_version: artifact-contract/1
  artifact_id: pm.negotiation-record
  stage: stage-1-concept-validation
  status: target_pending_measurement
  current_gate_status: unpassed
  parties:
    - role: game-pm
    - role: game-designer
  signed_numeric_decisions:
    - decision_id: PMD-01
      topic: guaranteed_permanent_progress
      decision: "Target: an associated permanent companion or equal-power tactical alternative completes within at most three eligible completions, with visible nonresetting progress and condition."
      target_values:
        eligible_completions_maximum: { value: 3, unit: completions, status: target_pending_measurement }
        tactic_affecting_unlocks_with_hidden_probability: { value: 0, unit: percent, status: target_pending_measurement }
      tradeoff: "Accept a finite, explicit cadence over repeated uncertain pursuit; preserve active encounter competence rather than scarcity pressure."
      signatures:
        - { role: game-designer, signed: true, signed_for: concept_target, date: 2026-07-22 }
        - { role: game-pm, signed: true, signed_for: concept_target, date: 2026-07-22 }
      validation:
        gate: G5
        status: unpassed
        evidence_path: qa/gate-measurements.md
        falsifier: "Any eligible path needs a fourth completion, resets visible progress, or gates tactical capability behind hidden chance, duplicates, payment, or return timing."
    - decision_id: PMD-02
      topic: local_archive_return
      decision: "Target: one active-issued permit settles once into fixed-point Archive-restricted credit, capped at twelve hours and one-fifth of issued active-seal value."
      target_values:
        unsettled_permit_limit: { value: 1, unit: permits, status: target_pending_measurement }
        settlements_per_permit: { value: 1, unit: settlements, status: target_pending_measurement }
        accepted_absence_cap: { value: 12, unit: hours, status: target_pending_measurement }
        return_credit_ceiling: { value: 20, unit: percent_of_active_seal_value_at_issue, status: target_pending_measurement }
        minimum_active_seal_share: { value: 80, unit: percent, status: target_pending_measurement }
        mechanical_return_randomness: { value: 0, unit: percent, status: target_pending_measurement }
      tradeoff: "Permit a small visible preparation signal while forbidding simulated combat, combat-stat gain, stage access, extraction resolution, companion unlock, boss resolution, or ending progress from absence."
      signatures:
        - { role: game-designer, signed: true, signed_for: concept_target, date: 2026-07-22 }
        - { role: game-pm, signed: true, signed_for: concept_target, date: 2026-07-22 }
      validation:
        gate: G5
        status: unpassed
        evidence_path: qa/test-plan.md
        falsifier: "Repeated reopen mutates totals, an invalid/negative interval grants credit, credit exceeds the ceiling, or a credit spend changes a combat/progression field."
    - decision_id: PMD-03
      topic: ten_to_twenty_session_tactical_parity
      decision: "Target: permanent breadth and return credit must not make the twenty-session account materially outperform a matched ten-session account in core active-play outcomes."
      target_values:
        completion_time_difference_maximum: { value: 15, unit: percent_absolute, status: target_pending_measurement }
        boss_clear_time_difference_maximum: { value: 15, unit: percent_absolute, status: target_pending_measurement }
        completion_rate_difference_maximum: { value: 5, unit: percentage_points, status: target_pending_measurement }
        boss_clear_rate_difference_maximum: { value: 5, unit: percentage_points, status: target_pending_measurement }
        normalized_damage_taken_difference_maximum: { value: 10, unit: percent_absolute, status: target_pending_measurement }
        movement_hazard_error_difference_maximum: { value: 10, unit: percent_absolute, status: target_pending_measurement }
      tradeoff: "Allow strategy breadth, not raw automatic combat-stat escalation or absence-derived superiority."
      signatures:
        - { role: game-designer, signed: true, signed_for: concept_target, date: 2026-07-22 }
        - { role: game-pm, signed: true, signed_for: concept_target, date: 2026-07-22 }
      validation:
        gate: G5
        status: unpassed
        evidence_path: qa/benchmark-notes.md
        falsifier: "A preregistered matched comparison exceeds a band, has an unresolved bootstrap confidence interval, or shows return credit is required for a feasible Stage 1–10 route."
    - decision_id: PMD-04
      topic: no_fomo_idle_policy
      decision: "Target: the return ceiling limits inflation only; it does not create an appointment, loss, or commercial pressure."
      target_values:
        notification_exposure: { value: 0, unit: notifications, status: target_pending_measurement }
        late_return_loss_reports: { value: 0, unit: reports, status: target_pending_measurement }
        obligation_rating_4_to_5_maximum: { value: 10, unit: percent_of_moderated_participants, status: target_pending_measurement }
        Stage_10_reachable_without_return_credit: { value: 100, unit: percent_of_fixture_accounts, status: target_pending_measurement }
      tradeoff: "Choose indefinite claimability and local receipt clarity over daily-login mechanics, streaks, countdowns, storage-full prompts, scheduled events, notifications, or paid skips."
      signatures:
        - { role: game-designer, signed: true, signed_for: concept_target, date: 2026-07-22 }
        - { role: game-pm, signed: true, signed_for: concept_target, date: 2026-07-22 }
      validation:
        gate: G5
        status: unpassed
        evidence_path: qa/benchmark-notes.md
        falsifier: "A player loses a unique reward/content for late return, sees notification or countdown pressure, or moderated obligation exceeds the target band."
    - decision_id: PMD-05
      topic: reward_choice_information_band
      decision: "Target: an XP offer exposes no more than three simultaneously comparable choices and each choice has an explicit mechanical effect."
      target_values:
        maximum_options_per_offer: { value: 3, unit: options, status: target_pending_measurement }
        immediate_effect_prediction_rate_minimum: { value: 80, unit: percent, status: target_pending_measurement }
        ambiguous_or_duplicate_commit_rate: { value: 0, unit: percent, status: target_pending_measurement }
      tradeoff: "Choose bounded inspection and a visible recommendation reason over option volume or opaque synergy math; no countdown or auto-pick is permitted."
      signatures:
        - { role: game-designer, signed: true, signed_for: concept_target, date: 2026-07-22 }
        - { role: game-pm, signed: true, signed_for: concept_target, date: 2026-07-22 }
      validation:
        gate: G6
        status: unpassed
        evidence_path: qa/benchmark-notes.md
        falsifier: "An option lacks a mechanical summary, cannot be compared in one state, commits ambiguously, or fails the preregistered comprehension threshold."
    - decision_id: PMD-06
      topic: G2_measurement_only_equal_budget_profile_contract
      decision: "ACCEPTED FOR INSTRUMENTATION ONLY: authorize five analytic fixture profiles and observer-safe damage/cooldown records to close XR-13/XR-14 measurement gaps. This authorizes neither a player-facing class, a catalog balance change, nor a combat retune."
      authorized_measurement_values:
        analytic_profile_count: { value: 5, unit: profiles, status: authorized_for_measurement_only }
        profile_ids: [Bulwark, Striker, Gambit, Conductor, Rift_hybrid]
        catalog_rule_changes_authorized: { value: 0, unit: player_facing_rule_changes, status: not_authorized }
        player_facing_class_changes_authorized: { value: 0, unit: classes, status: not_authorized }
        equal_authoring_budget_definition: "A fixture budget is the recorded tuple of health multiplier, crit chance, crit multiplier, and cadence selected within the approved profile envelope. Each profile uses the same stage/enemy setup, seed/input policy, baseline commander/companion condition, and zero campaign, Archive, commercial, or hidden modifiers. Equal budget means no unrecorded modifier and no profile may lead simultaneously in survival, crit EV, and cadence; it is not a scalar power score or a balance conclusion."
        profile_envelopes:
          Bulwark: { health_multiplier: [1.25, 1.40], crit_chance_percent: [5, 10], crit_multiplier: [1.5, 1.7], active_cooldown_ticks: [240, 360] }
          Striker: { health_multiplier: [0.90, 1.05], crit_chance_percent: [10, 20], crit_multiplier: [1.5, 1.8], passive_cadence_ticks: [18, 45] }
          Gambit: { health_multiplier: [0.85, 1.00], crit_chance_percent: [25, 35], crit_multiplier: [1.8, 2.0], active_cooldown_ticks: [120, 240] }
          Conductor: { health_multiplier: [0.95, 1.10], crit_chance_percent: [10, 20], crit_multiplier: [1.5, 1.8], active_cooldown_ticks: [60, 150], cooldown_ev_share_percent: [15, 40] }
          Rift_hybrid: { health_multiplier: [0.90, 1.05], crit_chance_percent: [15, 25], crit_multiplier: [1.7, 1.9], setup_cadence_ticks: [90, 210] }
        required_observer_records:
          resolved_damage: [baseDamage, finalDamage, target, source, simTick]
          cooldown: [abilityId, previousReadyTick, readyTick, state]
        reward_idle_and_commercial_deltas:
          player_reward_changes: { value: 0, unit: changes, status: not_authorized }
          idle_return_changes: { value: 0, unit: changes, status: not_authorized }
          monetization_or_commerce_changes: { value: 0, unit: changes, status: prohibited }
      tradeoff: "Accept a measurement surface that can falsify parity and EV/cooldown claims while preserving the no-commerce, offline, deterministic fairness contract. Do not spend this instrumentation authorization as approval to retune combat or progression."
      signatures:
        - { role: game-pm, signed: true, signed_for: measurement_only_contract, date: 2026-07-22 }
        - { role: game-designer, signed: false, signed_for: counterpart_recorded_in_design_balance_sheet, date: pending }
      validation:
        gate: G2
        status: NOT MEASURED
        verdict: NOT PASSED
        blocking_findings: [XR-13, XR-14]
        evidence_path: qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl
        future_retune_precondition: "No combat, reward, idle-return, or monetization retune is approved by this decision. A future retune requires a measured G2 result at the named evidence path that identifies a violated preregistered threshold, followed by a new PM and designer signed correction."
        fairness_status_unchanged: "G5 remains NOT MEASURED / NOT PASSED; this analytic fixture contract is not G5 evidence."
  non_negotiable_constraints:
    - "Target: no commerce, ads, paid power, paid skips, subscription, account, cloud sync, or social comparison surface."
    - "Target: no gameplay-time network, provider, or realtime API dependency; build-time-only reviewed audio assets never carry credentials into the shipped runtime."
    - "Target: defense-catalog.js is the authored rules authority; 60 Hz deterministic rules resolve rewards before every observer receives an event."
    - "Target: W-01 through W-05 remain canon labels, bounded PCG stays authored, and Stage 10 remains the ending."
  source_paths:
    - intake/production-brief.md
    - production/team-roster.md
    - ../../../docs/abyssal-command-defense-survivor-design.md
    - research/progression-rewards-idle.md
    - research/progression-idle-economy.md
    - research/qa-measurement-protocol.md
    - research/telemetry-playtest-contract.md
    - research/stage-world-procedural.md
    - research/pcg-map-grammar.md
    - research/combat-systems-balance.md
    - research/combat-feedback-controls.md
    - research/vfx-hud-feedback.md
    - research/controls-accessibility.md
    - research/audio-narration-direction.md
    - research/elevenlabs-integration.md
```

## Open items and handoff

| Open item | Owner | Required evidence | Current state |
| --- | --- | --- | --- |
| Extraction condition currently described as a chance in the product contract | Game designer + programmer | A deterministic condition or a finite disclosed progress meter, then fixed-seed tests | UNRESOLVED; no implementation decision made here |
| Idle formula and save transaction | Game programmer + QA | Clock/storage fault matrix, state allowlist diff, no-network trace | UNPASSED |
| Equal-power sidegrade definition | Game designer + combat systems designer | Equal-budget profile sweep, 10–20-session parity fixture | UNPASSED |
| Return-pressure experience | Game PM + QA | Moderated zero/two/cap/over-cap study with predeclared questionnaire | UNPASSED |
| Build-only audio boundary | Audio systems engineer + QA | Compiled-output provider/credential scan; offline/fallback replay | UNPASSED |

The signatures above do not authorize commercialization, hidden probability, real-time API use, or a gate pass. Every numerical bound remains subject to the named future evidence.

## Stage 2 negotiation proposal — reward/growth correction gate

**Proposal status:** **UNSIGNED / TARGETS ONLY.** PMD-07 does not approve a reward or progression change, does not amend PMD-01 through PMD-06, and does not establish retention, monetization, engagement, fairness, or player-satisfaction results. G5, G7, and G8 are each **NOT MEASURED / NOT PASSED**. The only signed Stage 2-adjacent decision remains PMD-06's instrumentation-only G2 contract; it expressly authorizes zero reward, idle-return, or commerce changes (`pm/negotiation-record.md#L104-L137`).

```yaml
stage_2_proposed_decision:
  decision_id: PMD-07
  topic: deterministic_reward_growth_and_archive_return
  status: proposal_pending_dual_signature_and_QA_evidence
  authority_boundary:
    rules_authority: "defense-catalog.js plus deterministic 60 Hz simulation"
    receipt_and_presentation: "observer/persistence only; cannot grant, reroll, defer, or change a resolved outcome"
    commerce_network_boundary: "No commerce, ads, paid power, paid skips, premium currency, account, cloud entitlement, network dependency, runtime provider call, or credential route."
  proposed_reward_split:
    guaranteed:
      - "Fixed-seed run-growth offer; selected displayed skill/item resolves deterministically and is replay-recorded."
      - "Active eligible completion advances visible, nonresetting finite permanent breadth/passive progression."
      - "Boss, stage, extraction, and campaign outcomes resolve only from their disclosed active conditions."
      - "One active-issued Archive Return Permit settles once by persisted fixed-point formula into restricted preparation credit."
    probabilistic:
      mechanical_probability_percent: { value: 0, unit: percent, status: target_pending_measurement }
      permitted_scope: "Only a separately approved cosmetic/lore table with zero tactical/progression value; not proposed for this slice."
      mandatory_disclosure: "Complete outcome set; every exact weight and percent; displayed sum 100.00%; rounding method; duplicate/exhaustion rule; table revision; deterministic reveal derivation; all material before Reveal."
      prohibited: [hidden_odds, state_dependent_odds, duplicate_before_exhaustion, pity_counter, purchase, ad, timer, retry_pressure, near_miss, mechanical_value]
  passive_progression_boundary:
    permitted: "Known equal-power sidegrade, passive modifier, or companion-role breadth after visible active conditions."
    prohibited: [autonomous_idle_combat, raw_damage_gain, raw_health_gain, raw_armor_gain, raw_rate_gain, idle_only_completion, campaign_or_boss_progress]
  proposed_targets:
    run_choice:
      values:
        visible_options: { value: 3, unit: options, status: target_pending_measurement }
        immediate_effect_prediction_minimum: { value: 80, unit: percent, status: target_pending_measurement }
        timed_or_ambiguous_commit: { value: 0, unit: percent, status: target_pending_measurement }
      owner: "game-pm + game-designer; game-qa measures"
      method: "Counterbalanced stated-goal fixed-offer comprehension and commit-event review."
      evidence: [qa/benchmark-notes.md, ops/telemetry-contract.md, qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl]
      blocked_if: "Any auto-pick, hidden effect, ambiguous/duplicate commit, missing accessibility equivalent, or missing/unfavorable reported result."
    active_permanent_growth:
      values:
        eligible_completions_to_named_unlock_maximum: { value: 3, unit: completions, status: target_pending_measurement }
        disclosed_deterministic_tactical_paths: { value: 100, unit: percent, status: target_pending_measurement }
        hidden_probability_or_duplicate_tactical_paths: { value: 0, unit: percent, status: target_pending_measurement }
      owner: "game-designer proposes; game-pm accepts; game-qa verifies"
      method: "First/second/third eligible-completion fixtures and visible-progress plus prohibited-field-diff audit."
      evidence: [qa/gate-measurements.md, qa/test-plan.md, qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl]
      blocked_if: "Fourth completion, reset progress, hidden chance/duplicate, idle/commercial completion, or prohibited raw-stat field delta."
    archive_return:
      values:
        unsettled_permits: { value: 1, unit: permits, status: target_pending_measurement }
        settlements_per_permit: { value: 1, unit: settlements, status: target_pending_measurement }
        accepted_absence_cap: { value: 12, unit: hours, status: target_pending_measurement }
        return_credit_ceiling: { value: 20, unit: percent_of_active_seal_value_at_issue, status: target_pending_measurement }
        active_seal_share_minimum: { value: 80, unit: percent, status: target_pending_measurement }
        mechanical_return_probability: { value: 0, unit: percent, status: target_pending_measurement }
      owner: "game-pm + game-designer define; game-programmer implements only after approval; game-qa measures"
      method: "Fixed-point 0/short/2h/6h/12h/24h/cap-plus/negative/rollback/forward/malformed/storage-denied/reopen×100/two-tab matrix and settlement field diff."
      evidence: [qa/test-plan.md, qa/gate-measurements.md, qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl]
      blocked_if: "Duplicate/non-atomic settlement, invalid-time grant, over-cap credit, missing receipt inputs, RNG advance, or any combat/progression field delta."
    parity_and_pressure:
      values:
        completion_and_boss_time_difference_maximum: { value: 15, unit: percent_absolute, status: target_pending_measurement }
        completion_and_boss_rate_difference_maximum: { value: 5, unit: percentage_points, status: target_pending_measurement }
        normalized_damage_and_hazard_error_difference_maximum: { value: 10, unit: percent_absolute, status: target_pending_measurement }
        stage_10_reachable_without_return_credit: { value: 100, unit: percent_of_fixture_accounts, status: target_pending_measurement }
        notification_exposure: { value: 0, unit: notifications, status: target_pending_measurement }
        late_return_loss_reports: { value: 0, unit: reports, status: target_pending_measurement }
        obligation_rating_4_to_5_maximum: { value: 10, unit: percent_of_moderated_participants, status: target_pending_measurement }
        receipt_understanding_rating_4_to_5_minimum: { value: 80, unit: percent_of_moderated_participants, status: target_pending_measurement }
      owner: "game-pm preregisters; game-designer supplies equal-power cohorts; game-qa analyzes"
      method: "Matched fixed-seed 10/20-session zero-versus-max-credit pairs, appropriate unlocked sidegrade cohorts, preregistered bootstrap 95% intervals, and 0h/2h/6h/12h/24h moderated returns with full response distribution."
      evidence: [qa/benchmark-notes.md, ops/telemetry-contract.md, qa/exploit-register.md, qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl]
      blocked_if: "Band breach, unresolved interval, unequal active-earned state, return-required Stage 10 route, pressure/late loss, notification, or selective reporting."
  gate_status:
    G5: { status: NOT_MEASURED, verdict: NOT_PASSED, requirement: "All PMD-07 G5 evidence plus no-commerce/no-network scan." }
    G7: { status: NOT_MEASURED, verdict: NOT_PASSED, requirement: "Network-disabled cold fixture covers active run, choice, settlement, stage handoff, and Stage 10." }
    G8: { status: NOT_MEASURED, verdict: NOT_PASSED, requirement: "Independent five-comparable plus first-impression packet; deterministic reward accounting alone is not novelty evidence." }
  correction_precondition:
    required_QA_evidence:
      - "qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl: commercial-path scan, reward-table inspection, fault matrix, and preregistered 10/20-session parity results."
      - "qa/gate-measurements.md: receipt/replay invariance in normal, muted, mono, high-contrast, reduced-motion, skipped-animation, missing-asset, and network-disabled conditions."
      - "qa/test-plan.md: exact idle fault matrix and forbidden-field save diff."
      - "qa/exploit-register.md: probability-table adversarial audit and pressure-content scan, including an explicit no-surface result when applicable."
      - "qa/benchmark-notes.md: full moderated comprehension/obligation responses."
      - "engineering/architecture-contract.md: offline/no-provider/no-account boundary evidence."
    signature_requirement: "After QA identifies a violated preregistered target, and before any implementation, retune, or remeasurement, a new correction record must name the failed metric, controlled cohort/fixture, proposed rule revision, expected field deltas, rollback condition, and evidence paths. It is valid only when both game-pm and game-designer sign it."
  signatures_required_before_retune:
    - { role: game-pm, signed: false, signed_for: future_evidence_backed_correction, condition: "QA packet complete and violation identified" }
    - { role: game-designer, signed: false, signed_for: future_evidence_backed_correction, condition: "QA packet complete and violation identified" }
```

### Decision basis and negotiation position

- The default is a guaranteed, inspectable mechanical path; probability is a constrained fallback for a non-mechanical table only (`research/reward-presentation-and-retention.md#L64-L83`). A disclosure is not permission to add a loot/retention mechanic.
- Active play retains authority over combat, movement, extraction, boss, stage, campaign, run skill, and companion outcomes; Archive return is local accounting only (`research/progression-idle-economy.md#L7-L12`, `research/progression-idle-economy.md#L65-L76`).
- The `12 h`, `20%`, and `>=80%` values are candidate targets, not source-derived optima. The cited research requires testing candidate windows against no-FOMO/clarity outcomes and rejecting a cadence that creates obligation (`research/progression-idle-economy.md#L35-L44`).
- Equal-power passive breadth must remain subordinate to the existing equal-budget/EV guard. It cannot quietly turn permanent progression into a profile that leads in survival, crit EV, and cadence (`design/balance-sheet.md#L28-L29`, `design/balance-sheet.md#L202-L209`).

**Negotiation outcome:** defer all reward/growth implementation and all numerical retunes. The only allowed next action is evidence production under the listed QA packet. Neither PM nor designer signature is present for a correction, so no correction is authorized.
