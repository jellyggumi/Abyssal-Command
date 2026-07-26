# Balance sheet — shared adversarial-tape experiment

run-id: `20260725-defense-rpg-development`  
owner: game designer  
status: proposed measurement contract; no catalog retune and no new result

## Current evidence, kept separate

- Five campaign policies cleared **150/150** stage-runs with **0 defeats**; all recorded `VANGUARD` stance. This is saturation evidence, not the G2 matchup rate.
- A different idle/macro probe produced **9 defeats / 30** samples (30.0%). It is not a valid substitute because it used a different policy and matrix.
- The current five-archetype mean boss TTK range is 562.83–735.90 ticks, but no shared tape/reference target comparison exists. This document does **not** declare a current TTK, win rate, viable archetype, or catalog change.

Sources: `qa/gate-measurements.md#g2`, `qa/playtest-report.md#archetype-rotation-sessions`, and `qa/exploit-register.md#x-01`.

## X-01 response — one policy, one matrix, one verdict

The next measurement is an **adversarial-tape replay**, not a retune. It replaces both incomparable controllers with one versioned, deterministic control contract. The simulation remains the authority; the tape only queues public input, then records accepted actions and authoritative events.

```yaml
system: shared-adversarial-tape-g2
status: proposed_not_measured
rules_version_to_record: defense-survivor-v1
purpose: resolve_policy_conflict_without_changing_catalog_values
source_defect: X-01
measurement_owner: QA
implementation_owner: simulation_engineer
input_tape:
  id: g2-adversarial-tape-v1
  authority: input_only
  deterministic_rule: identical_stage_seed_archetype_tuple_replays_identically
  forbidden:
    - renderer_state_reads
    - audio_state_reads
    - wall_clock_time
    - runtime_randomness
    - catalog_value_mutation
  action_schedule:
    - id: opening-lane
      trigger: STAGE_STARTED
      action: MOVE
      directive: move_to_authored_safe_route_for_stage
    - id: pressure-response
      trigger: priority_threat_visible
      action: MOVE
      directive: rotate_to_counter_route_or_gate_intercept
    - id: growth
      trigger: GROWTH_OFFER
      action: SKILL_SELECTED
      directive: choose_first_eligible_option_by_frozen_role_priority
    - id: domain
      trigger: DOMAIN_AVAILABLE
      action: DOMAIN_OCCUPY
      directive: hold_until_capture_or_authoritative_interruption
    - id: bind
      trigger: ELITE_CANDIDATE_AVAILABLE
      action: EXTRACT_ELITE
      directive: attempt_bind_at_authored_point_until_completion_or_expiry
    - id: boss-response
      trigger: BOSS_SPAWNED
      action: MOVE_OR_SKILL_CAST
      directive: use_frozen_priority_then_safe_route_rule
  accepted_input_log_required:
    - tick
    - requested_action
    - accepted_action
    - rejection_reason
    - event_trigger
    - position_or_target_directive
matrix:
  stages: [cinder-span, veil-citadel, echo-throne, sunken-bastion, howling-sprawl, glass-necropolis, starless-canal, shattered-causeway, abyss-chancel, gate-zenith]
  seeds: [301, 302, 303]
  archetypes: [rusher, turtle, economy-greed, micro-optimizer, casual]
  samples_per_archetype: 30
  total_samples: 150
g2_thresholds:
  win_rate_band: [0.45, 0.55]
  integer_passes_per_30_samples: [14, 16]
  ttk_tolerance: 0.15
  combo_ev_cap_vs_median: 1.30
  reference_ttk_source: _workspace/20260722-defense-survival-expansion/design/balance-sheet.md#frozen-pre-measurement-boss-ttk-targets
  cinder_span_reference_ttk_ticks: 656
  cinder_span_reference_ttk_tick_band: [558, 754]
  missing_boss_ttk_is_in_band: false
required_output:
  file: qa/evidence/g2-adversarial-tape-v1.json
  per_sample:
    - rules_version
    - tape_id_and_hash
    - stage
    - seed
    - archetype
    - terminal_outcome
    - terminal_cause
    - minimum_gate_integrity
    - minimum_warden_integrity
    - boss_spawn_tick
    - boss_defeat_tick
    - boss_ttk_ticks
    - ordered_accepted_action_classes
    - extraction_outcome
  aggregates:
    - wins_and_defeats_per_archetype
    - win_rate_per_archetype
    - pooled_win_rate
    - ttk_vs_frozen_band_per_stage
    - action_class_and_stance_distribution
    - combo_ev_max_over_median
pass_rules:
  - every_archetype_rate_is_within_win_rate_band
  - every_required_boss_ttk_is_within_its_frozen_stage_band
  - combo_ev_max_over_median_lte_1_30
  - all_150_tuples_emit_replayable_accepted_input_logs
  - no_missing_sample_is_counted_as_a_win_or_in_band_ttk
current_measurement:
  win_rate: null
  ttk_result: null
  verdict: unmeasured
```

### Bounded programmer slice

1. Add a measurement-only tape adapter that maps the YAML action directives to the existing public input queue; it must never write damage, waves, rewards, outcomes, or campaign storage directly.
2. Add deterministic trigger snapshots for the six named event conditions and append accepted/rejected input rows to the evidence object.
3. Replay exactly the 150 tuples above twice; require byte-stable outcome/action logs for each identical tuple before QA interprets balance.
4. Produce the specified JSON only; do not modify `defense-catalog.js`, `rpg-catalog.js`, authored stage values, or reward values as part of this slice.

## Decision interpretation

- A 0/150 result under the shared tape is an out-of-band **measurement result**, not proof that the old campaign policy was wrong.
- A 9/30-style failure rate under the shared tape is likewise only a result after all 150 tuples use the same tape and matrix.
- If the tape cannot make an action because the public input path lacks a required trigger, record `missing-control-surface`; do not silently idle, auto-complete, or infer a win.
- G3 remains open even if G2 becomes measurable: at least three strategies need distinct, recorded action/stance signatures, not identical clears.

## Defect linkage

| QA defect | Design response | Future accept/reject measurement |
|---|---|---|
| X-01 policy conflict | Freeze `g2-adversarial-tape-v1` and 5 × 10 × 3 matrix. | `qa/evidence/g2-adversarial-tape-v1.json`; 14–16 wins per 30 for every archetype, frozen TTK bands, combo cap ≤1.30. |
| X-02 mixed/short loop | Do not treat Cinder’s current 26.90–27.70 s receipts as qualifying; preserve the 30–180 s rule in every tape output. | Future `measure-g7-core-loop` receipt records duration from first combat input to accepted reward. |
| X-03 portrait failure | Tape evidence carries no UI pass claim; Cinder control spec keeps touch/safe-area verification independent. | `tests/defense-hud-responsive-browser.cjs` must complete and publish coverage. |
| D-01 extraction handoff | Tape records candidate, Bind request, accept/reject, and extracted outcome rather than assuming reachability. | Same evidence object plus `defense-run-simulation` extraction contract rerun. |
