# QA benchmark notes — calibration, not achieved results

## Status

All values below are **TARGETS**, **source-derived safety floors**, or future measurement definitions. None is a current build observation. Use them to preregister fixture expectations; do not copy them into a pass claim.

```yaml
benchmark_packet:
  status: NOT MEASURED
  created_on: 2026-07-22
  local_only: true
  gameplay_network: prohibited
  provider_runtime: prohibited
  evidence_roots:
    - qa/evidence
    - results
  rule_of_interpretation: missing required evidence invalidates the comparison
```

## Primary-source calibration ledger

| Surface | Research path / product source | QA use and limit |
|---|---|---|
| Contract | `docs/abyssal-command-defense-survivor-design.md` | Binding: 60 Hz deterministic local simulation, movement-only player focus, observer presentation, Stage 10 ending. |
| Survey synthesis | `.survey/abyssal-command-systems-expansion/{context,triage,solutions}.md` | Confirms current evidence gaps and boundaries; no user-outcome inference. |
| Testability and telemetry | `research/{qa-measurement-protocol,telemetry-playtest-contract}.md` | Event envelope, local privacy, missingness/cohort checks, observer differential and idle property methods. |
| Combat | `research/{combat-systems-balance,combat-feedback-controls}.md` | Health/crit/cooldown arithmetic, five profiles, automatic-combat feedback hierarchy. |
| PCG/stage | `research/{pcg-map-grammar,stage-world-procedural}.md` | MapKey/MapPlan completeness, bounded backbone, validation rejection, world-link payload allowlist. |
| Encounters | `research/wave-encounter-composition.md` | Authored card grammar, mandatory relief, safe-lane and replay checkpoints. |
| Progression/idle | `research/{progression-rewards-idle,progression-idle-economy}.md` | No-commerce certainty, finite progression, single-settlement Archive return. |
| Presentation | `research/vfx-hud-feedback.md` | Rank/protected-zone, static fallbacks, contrast and flash capture methods. |
| Audio/provider | `research/{audio-narration-direction,elevenlabs-integration}.md` | Observer-only cue policy, captions, local fallbacks; ElevenLabs only private build-time candidate source after rights review. |
| Narrative/control | `research/{narrative-stage-presentation,controls-accessibility}.md` | Caption-first canon-safe event bindings, input normalization, focus and reduced-motion parity. |

## Numeric preregistration catalog

```yaml
calibration_targets:
  simulation:
    tick_rate_hz: 60
    observer_differential_render_hz: [30, 60, 120]
    canonical_fields_required_identical:
      - canonical_state_hash
      - rng_or_deck_cursor
      - input_cursor
      - map_plan_digest
      - combat_resolution_ids_and_values
      - choice_offer_and_effect_hashes
      - persistent_totals
  pcg:
    map_keys_minimum: 64
    generation_passes_per_key: 3
    stage_corpus_target_per_stage: 100
    exact_variable_subgraph_collision_rate_max: 0.02
    module_selection_share_max_when_palette_ge_3: 0.40
    objective_recognition_target_per_stage: "10/12 moderated participants"
  encounters:
    relief_ticks_range: [900, 1500]
    probe_ticks_range: [180, 360]
    pressure_ticks_range: [360, 600]
    non_landmark_peak_ticks_max: 900
    role_families_minimum_in_four_non_relief_cards: 3
  combat:
    survival_window_s_range: [7, 12]
    ordinary_ttk_s_range: [0.35, 1.25]
    elite_ttk_s_range: [6, 14]
    stage10_ttk_s_range: [35, 90]
    baseline_crit_bp_range: [500, 1500]
    specialist_crit_bp_range: [2000, 3500]
    crit_hard_cap_bp: 4000
    crit_multiplier_range: [1.5, 2.0]
    crit_multiplier_hard_cap: 2.25
    automatic_active_cooldown_ticks_range: [60, 360]
    cooldown_floor_ticks: 30
    readiness_lead_ticks: 45
  control_and_presentation:
    movement_admission_p95_ticks_max: 2
    input_to_visible_p95_ms_max: 100
    essential_control_min_css_px: 24
    ability_target_dp: 52
    source_flash_ceiling_per_s: 3
    motion_static_recognition_delta_max_pp: 5
    rank4_alpha_coverage_max: 0.18
    rank4_protected_zone_coverage_max: 0.08
  idle:
    cap_hours: 12
    return_credit_max_active_value_fraction: 0.20
    active_seal_min_sidegrade_fraction: 0.80
    repeated_claim_mutation_target: 0
    invalid_elapsed_award_target: 0
  gates:
    balance_win_rate_band: [0.45, 0.55]
    combo_ev_max_vs_median: 1.3
    player_archetypes_minimum: 5
    independently_viable_archetypes_minimum: 3
    effect_latency_ms_max: 100
    immersion_median_min: 4.0
    paid_free_delta_max_pp: 5
    loop_period_s_range: [30, 180]
    actions_per_loop_min: 3
    reward_events_per_loop_min: 1
    loop_repeat_rate_min: 0.70
    novelty_frequency_max_of_comparables: "2 of 5"
```

## Measurement rules

- Segment any timing/readability result by build, fixed fixture, device/viewport, input mode, renderer, sound state, reduced-motion state, grammar/rules/serializer version. Do not pool cells.
- A mean hides critical distribution failures. Report p5/p50/p95 for critical count, drought, combo damage, TTK, and input latency where applicable.
- A seed count is not PCG diversity. Report hard-constraint validity, descriptor signatures, coverage, pairwise distance, collision rate, palette concentration, and objective readability.
- Presentation evidence never promotes its own event to a rule result. Join on rule event ID/tick; playback, render cadence, cue drops, and visual culling can differ only in observer fields.
- For moderated tests, preregister answer key, assignment manifest, missing-response treatment, cohort balance, and stopping rule. Recognition/click telemetry is not human comprehension.
- The current product is no-commerce. G5 paid/free delta is retained as a harness gate schema only; its implemented treatment is **NOT APPLICABLE TO CURRENT PRODUCT / NOT MEASURED**, not zero.

## Evidence naming convention

```yaml
evidence_naming:
  fixture_id: "<system>-<case>-v<version>"
  required_metadata:
    - build_id
    - catalog_digest
    - rules_version
    - serializer_version
    - grammar_version
    - seed_or_map_key_id
    - input_tape_digest
    - clock_case
    - observer_configuration
    - timestamp_utc
    - local_export_checksum
  first_failure_record:
    - first_divergent_tick_or_event_id
    - minimal_reproduction_prefix
    - expected_value
    - actual_value
    - artifact_path
```

No target above becomes a pass until a dated local evidence artifact contains its raw measurement and method.