# Reward Bands — Stage 2 No-Monetization Boundary

## G5 decision

**G5: N/A — not PASS.** This cycle deliberately has no paid path, account, premium currency, ads, or gacha. G5 measures revenue–balance synergy through paid/free comparison, comeback activation limits, and free-path parity; its paid/free cohorts and revenue points therefore do not exist here. No threshold has been measured, so N/A records an inapplicable gate rather than a successful fairness result.

Evidence: `production/task-manifest.md#hard-policy` prohibits every commerce surface and says G5 is N/A unless the product boundary changes explicitly. `qa/gate-measurements.md#boundary-note--g5` independently confirms the boundary. The QA baseline broadcast (`messages/001-qa-baseline.md#gate-position`, 2026-07-26T01:21:22Z) directs PM to preserve it and not imply a paid/free conclusion.

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
