# PM ↔ Designer Negotiation Record — Stage 2 Phase 2c

## Record status

This is a signed **constraint and measurement** record, not a balance retune, runtime gate result, catalog authorization, or presentation approval. Current QA evidence remains **G2 FIX, G3 FIX, G4 FIX, G6 FIX, G7 BLOCKED, and G8 BLOCKED**. In particular, the 150/150 campaign-policy clears and the unrelated 9/30 idle/macro defeats are incomparable; three Cinder Span receipts remain below 30 s; the portrait test fails **59 !== 11**; and extraction reachability (9/9, contract 25/25) is not human-impression evidence.

```yaml
artifact_contract:
  schema_version: artifact-contract/1
  artifact_id: pm.negotiation-record
  artifact_path: pm/negotiation-record.md
  run_id: 20260725-defense-rpg-development
  stage: stage-2-phase-2c
  status: signed_measurement_boundary_no_balance_retune
  authority_boundary:
    rules: Existing deterministic simulation only.
    persistence: Existing campaign authority only after accepted events.
    observers: UI, renderer, and audio observe resolved state and queue public input only; they cannot resolve, alter, or persist rewards.
  prohibited: [commerce, paid_power, paid_recovery, paid_reroll, account, network, ads, subscription, generated_art_runtime, catalog_retune, reward_value_change, persistent_reward_effect_change]
  current_gate_status:
    G2: FIX
    G3: FIX
    G4: FIX
    G6: FIX
    G7: BLOCKED
    G8: BLOCKED
  evidence_authority:
    - qa/gate-measurements.md
    - qa/exploit-register.md
  no_current_pass_claim: true
```

## First implementation authorization — deliberately narrow

Only the following work is authorized. It is ordered; neither item authorizes a catalog, balance, reward, persistence, generated-art, or gate-status change.

```yaml
implementation_authorization:
  status: authorized_narrow_measurement_and_ui_fix_only
  authorization_a:
    name: correct_tested_portrait_safe_area
    allowed: Correct the portrait HUD safe-area layout needed for the existing physical-top-cutout assertion and allow its existing target-coverage checks to run.
    prohibited: [simulation_rule_change, campaign_state_change, catalog_change, stage_value_change, reward_value_change, persistent_reward_effect_change, generated_art, new_UI_asset]
    current_falsifier: "node tests/defense-hud-responsive-browser.cjs currently exits 1 with portrait cards must avoid the physical top cutout; actual 59, expected 11."
    acceptance_command: node tests/defense-hud-responsive-browser.cjs
    acceptance_destination: qa/gate-measurements.md#g4 and qa/exploit-register.md#X-03
    pass_condition: The exact command exits 0 and emits the test's existing target-size coverage; a screenshot alone is insufficient.
  authorization_b:
    name: implement_shared_adversarial_tape_measurement_only
    allowed: Add the g2-adversarial-tape-v1 adapter and its deterministic trigger/input receipts through the existing public input queue, then write the specified evidence JSON.
    required_contract:
      tape_id: g2-adversarial-tape-v1
      tuple_matrix: 5_archetypes_x_10_stages_x_3_seeds
      samples_per_archetype: 30
      total_samples: 150
      replay_requirement: Run every tuple twice and require byte-stable outcome and accepted-input logs per identical tuple.
      input_only: true
      forbidden: [renderer_state_reads, audio_state_reads, wall_clock_time, runtime_randomness, catalog_value_mutation, direct_damage_write, direct_wave_write, direct_reward_write, direct_outcome_write, direct_campaign_storage_write]
      evidence_schema_required:
        tuple_identity: [rules_version, tape_id, tape_hash, stage, seed, archetype, duplicate_replay_hash]
        accepted_input_rows: [tick, event_trigger, requested_action, accepted_action, rejection_reason, position_or_target_directive]
        terminal_and_balance: [terminal_outcome, terminal_cause, minimum_gate_integrity, minimum_warden_integrity, boss_spawn_tick, boss_defeat_tick, boss_ttk_ticks, ordered_accepted_action_classes, combo_ev_max_over_median]
        offer_and_item_boundary: [growth_offer_id, growth_option_ids, growth_accepted_selection_count, run_item_opportunity_count, run_item_scope, run_item_campaign_write_count]
        extraction_boundary: [elite_candidate_tick, bind_requested_tick, bind_terminal_outcome, elite_extracted_tick, accepted_extraction_handoff_count, companion_campaign_write_count]
        state_boundaries: [catalog_snapshot_hash_before, catalog_snapshot_hash_after, run_state_hash_before, run_state_hash_after, campaign_state_hash_before, campaign_state_hash_after, persistent_write_families]
    prohibited: [defense-catalog.js_change, rpg-catalog.js_change, authored_stage_value_change, reward_value_change, generated_art, persistent_reward_effect_change]
    acceptance_evidence: qa/evidence/g2-adversarial-tape-v1.json
    measurement_destinations: [qa/gate-measurements.md#g2, qa/gate-measurements.md#g3, qa/exploit-register.md#X-01]
    falsifier: "Any missing tuple, non-byte-stable duplicate replay, direct authority write, renderer/audio/wall-clock/random read, catalog snapshot-hash change, or evidence row missing a required schema field rejects this implementation slice."
  interpretation:
    - The tape makes G2/G3 measurable; it cannot turn either gate into PASS.
    - The portrait correction can close only the tested X-03 assertion and target coverage; it cannot establish human readability, immersion, or G4 PASS.
    - G7 duration/repeat and G8 human-impression evidence remain independently blocked.
```

## Negotiated entries

### PMD-2B-01 — Growth skill

```yaml
entry: PMD-2B-01
revenue_point: growth_skill
balance_number: "Existing offer cardinality and selection behavior only; no damage, cooldown, radius, integrity, pickup-range, or combo-EV value is authorized to change."
designer_bound:
  status: accepted_scope_only
  constraint: "Freeze the existing skill catalog and its effect values. A growth offer may be measured only as one accepted existing skill from three visible comparable existing options; no proposed trade-off becomes a numeric retune before the shared tape reports a failed target."
pm_bound:
  constraint: "One accepted skill from three visible comparable options remains run-local and displays current → upgraded values."
  numeric_targets: {visible_options: 3, accepted_choices_per_offer: 1, deliberate_action_classes_minimum: 3}
agreed: "signed_scope_only — preserve the PM offer/selection contract as a measurement target; do not alter catalog values or infer G2/G3/G7 success."
direct_falsifier:
  method: "The required growth_offer_id, growth_option_ids, and growth_accepted_selection_count fields show other than three comparable options, zero or more than one accepted selection, or the before/after catalog snapshot hashes differ."
  command_or_evidence: "qa/evidence/g2-adversarial-tape-v1.json (required offer-and-item and state-boundary fields); node --test tests/defense-stat-delta-browser.test.mjs checks existing current → upgraded rendering only."
measurement_destination: [qa/gate-measurements.md#g2, qa/gate-measurements.md#g3, qa/playtest-report.md]
signed: [game-designer, game-pm]
```

### PMD-2B-02 — Run item

```yaml
entry: PMD-2B-02
revenue_point: run_item
balance_number: "Existing run-item opportunity and scope only; no basic-damage, Gate-integrity, pickup-range, or cooldown value is authorized to change."
designer_bound:
  status: accepted_scope_only
  constraint: "Freeze existing item effects. At most one authored existing item opportunity may be observed per qualifying loop, remains run-local, and creates no campaign write; its balance trade-off is pending shared-tape evidence."
pm_bound:
  constraint: "One authored item opportunity is run-local, visible as current → upgraded, and clears on defeat or return."
  numeric_targets: {opportunities_per_qualifying_loop: 1, persistent_item_writes: 0}
agreed: "signed_scope_only — measure one run-local existing-item opportunity and its loss boundary; no item effect or catalog retune is authorized."
direct_falsifier:
  method: "The required run_item_opportunity_count, run_item_scope, run_item_campaign_write_count, and campaign-state hashes show a missing or additional opportunity, non-run-local scope, or persistent run-item write."
  command_or_evidence: "qa/evidence/g2-adversarial-tape-v1.json (required offer-and-item and state-boundary fields)."
measurement_destination: [qa/gate-measurements.md#g2, qa/exploit-register.md]
signed: [game-designer, game-pm]
```

### PMD-2B-03 — Elite extraction and companion

```yaml
entry: PMD-2B-03
revenue_point: elite_extraction_and_companion
balance_number: "Maximum one accepted existing handoff per run; no companion combat, formation, damage, fire-interval, range, or loss-pressure value is authorized to change."
designer_bound:
  status: accepted_scope_only
  constraint: "Keep the existing player-closed Bind chain observable: candidate → Bind request → accepted/rejected/expired result → ELITE_EXTRACTED. No new companion effect or persistent-reward implementation is authorized; reachability is separate from human novelty/impression."
pm_bound:
  constraint: "Elite defeat opens a player-closed Bind; expiry or defeat before acceptance grants nothing, while accepted extraction emits one authoritative handoff."
  numeric_targets: {accepted_handoffs_per_run_maximum: 1, persistent_grants_without_accepted_event: 0}
agreed: "signed_scope_only — retain the existing authoritative handoff boundary for measurement only; it authorizes neither companion retuning nor a G8 PASS claim."
direct_falsifier:
  method: "The required extraction fields show more than one accepted handoff, a companion campaign write without a completed ELITE_EXTRACTED chain, or no terminal Bind outcome."
  command_or_evidence: "qa/evidence/g2-adversarial-tape-v1.json (required extraction-boundary and state-boundary fields); node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output _workspace/20260725-defense-rpg-development/qa/evidence/g7-engaged-4hz-current.json; node --test tests/defense-run-simulation.test.mjs."
measurement_destination: [qa/gate-measurements.md#g8, qa/exploit-register.md#D-01]
signed: [game-designer, game-pm]
unresolved_gate_condition: "Five independent human impression scores with median ≥4.0/5 remain absent; this signed scope does not resolve G8."
```

### PMD-2B-04 — Terminal stage reward

```yaml
entry: PMD-2B-04
revenue_point: terminal_stage_reward
balance_number: "Persistent reward effect ceilings for companion, cooldown, Gate protection, integrity, next-run build, and boss TTK."
designer_bound:
  status: pending
  constraint: "No ceiling or field delta is proposed. Designer requires shared-tape baseline evidence and an explicit, per-field effect-ceiling proposal before a catalog or persistent-reward decision."
pm_bound:
  constraint: "Terminal victory presents one accepted persistent-local choice; defeat, retry, and preview do not create or duplicate it."
  numeric_targets: {accepted_selections_per_victory: 1, new_persistent_reward_writes_on_defeat: 0}
agreed: escalated
missing_measurement: "There is no agreed per-field reward-effect ceiling or controlled reward-ownership cohort result. Current 150/150 clears and 9/30 idle/macro defeats are not falsifiers for those values."
required_before_signature:
  - "A dual-authored per-field ceiling and rollback condition."
  - "A controlled shared-tape reward-ownership matrix with direct campaign before/after diffs."
  - "A named QA evidence schema that can reject each field delta."
measurement_destination: [qa/evidence/g2-adversarial-tape-v1.json, qa/gate-measurements.md#g2, qa/exploit-register.md]
signed: []
implementation_status: not_authorized
```

### PMD-2B-05 — Archive growth

```yaml
entry: PMD-2B-05
revenue_point: Archive_growth
balance_number: "Direct combat delta = 0; recovery/revive paths = 0."
designer_bound:
  status: pending_direct_falsifier
  constraint: "Designer accepts no direct combat delta, revive, or loss-erasure in principle, but cannot sign it until an implementable campaign-field allowlist diff and recovery-path observation are specified."
pm_bound:
  constraint: "Archive growth is a readable locked → recorded local state with no direct combat delta, revive, loss erasure, or paid acceleration."
  numeric_targets: {direct_combat_delta: 0, recovery_or_revive_paths: 0}
agreed: escalated
missing_measurement: "No named campaign-field allowlist-diff producer, field schema, or recovery/revive product-flow observation exists. The portrait HUD command is unrelated and must not be used as a proxy."
required_before_signature:
  - "A deterministic campaign before/after allowlist-diff receipt that attributes changed fields to Archive."
  - "A named recovery/revive product-flow observation with explicit event fields."
measurement_destination: [qa/exploit-register.md, qa/playtest-report.md]
signed: []
implementation_status: not_authorized
```

### PMD-2B-06 — Bounded comeback or recovery

```yaml
entry: PMD-2B-06
revenue_point: bounded_comeback_or_recovery
balance_number: "New comeback activations = 0; paid or automatic recovery paths = 0."
designer_bound:
  status: pending_direct_falsifier
  constraint: "Designer accepts no comeback/revival in principle, but cannot sign it until the tape records recovery event classes and a named product-flow probe can reject automatic or paid recovery."
pm_bound:
  constraint: "No new temporary comeback/revival is authorized for this beat; recovery remains an active positioning/resource consequence, never paid or automatic."
  numeric_targets: {new_comeback_activations: 0, paid_or_automatic_recovery_paths: 0}
agreed: escalated
missing_measurement: "The authorized tape schema does not include comeback/revival event classes or a paid/automatic product-flow probe; current G2 and exploit evidence do not measure either."
required_before_signature:
  - "A versioned recovery-event schema with an explicit zero-count check."
  - "A named product-flow probe that rejects automatic and paid recovery paths."
measurement_destination: [qa/gate-measurements.md#g2, qa/exploit-register.md]
signed: []
implementation_status: not_authorized
```

## Explicit non-authorizations and remaining escalations

- No value may be retuned until `qa/evidence/g2-adversarial-tape-v1.json` is complete, duplicate replays are byte-stable, and a separate dual-signature record names exact field deltas, rollback condition, and QA falsifier.
- PMD-2B-04, PMD-2B-05, and PMD-2B-06 remain escalated; neither terminal-stage-reward effects, Archive expansion, comeback/recovery, nor any other persistent-reward effect may be implemented.
- The portrait safe-area correction is not evidence of human readability or immersion. The 59 !== 11 failure is current evidence; a future exact command result is required before its X-03 assertion can be closed.
- G7 remains blocked on duration/repeat evidence; G8 remains blocked on five independent human-impression scores. No current deterministic receipt substitutes for either missing condition.
