# Reward Bands — Phase 2b

## Status and evidence boundary

This is a PM target contract for the next 30–180-second defense/offense + RPG beat. It does not change a catalog, simulation, campaign save, UI, or gate verdict. Current QA remains **G2 FIX, G3 FIX, G4 FIX, G7 BLOCKED, and G8 BLOCKED**. In particular, 150/150 campaign-policy clears, the 9/30 idle/macro defeats, the 59 != 11 portrait failure, and the three 26.90–27.70-second Cinder Span samples reject any claim that the current rhythm, loss pressure, or readability already passes.

```yaml
artifact_contract:
  schema_version: artifact-contract/1
  artifact_id: pm.reward-bands
  artifact_path: pm/reward-bands.md
  run_id: 20260725-defense-rpg-development
  stage: stage-2-phase-2b
  status: target_pending_measurement
  current_gate_status:
    G2: FIX
    G3: FIX
    G4: FIX
    G5: BLOCKED_no_commerce_surface
    G7: BLOCKED
    G8: BLOCKED
  authority_boundary:
    rules_and_rewards: "Existing deterministic simulation resolves run events and outcomes."
    persistence: "Existing campaign authority records only accepted persistent handoffs."
    observers: "UI, renderer, and audio display resolved state only and cannot grant, defer, reroll, recover, or persist a reward."
    product_exclusions: [commerce, paid_power, paid_reroll, paid_recovery, account, network, ads, subscription]
  monetary_paid_free_fairness:
    status: out_of_scope
    reason: "No paid or free entitlement variants exist in this beat; no paid/free cohort, delta, or monetary fairness metric is manufactured."
    future_trigger: "A separately approved commercial proposal would require a new product contract before any comparison is defined."
  reward_scope:
    run_local:
      labels_required: ["this run", "lost on defeat"]
      families: [growth_skill, run_item, derived_stat, synergy]
      loss_rule: "A defeat or return-to-lobby clears these values; neither a retry nor presentation setting may carry them forward."
      numeric_bands:
        growth_options_per_offer:
          value: 3
          unit: options
          status: target_pending_measurement
          reject_with: "Future G7 trace plus UI capture finds an offer with other than three visible comparable options."
        stage_local_item_opportunities_per_qualifying_loop:
          value: 1
          unit: opportunities
          status: target_pending_measurement
          reject_with: "Future deterministic slice trace lacks one authored run-item opportunity or records more than one without a new negotiated contract."
        accepted_temporary_comeback_activations_per_run:
          value: 0
          unit: activations
          status: target_pending_measurement
          reject_with: "Future event audit records a temporary comeback/revival activation; it is out of scope unless separately negotiated."
    persistent_local_campaign:
      labels_required: ["persists locally", "accepted only"]
      families: [accepted_extracted_companion, accepted_stage_reward, Archive_growth]
      write_rule: "Only an authoritative accepted handoff may write local campaign state; an offer, candidate, preview, expiry, failure screen, or UI acknowledgement is not a persistent grant."
      numeric_bands:
        accepted_extraction_handoffs_per_run_maximum:
          value: 1
          unit: handoffs
          status: target_pending_measurement
          reject_with: "Future extraction trace records more than one accepted persistent handoff in a run."
        accepted_stage_reward_selections_per_victory:
          value: 1
          unit: selections
          status: target_pending_measurement
          reject_with: "Future terminal-reward trace records zero or more than one accepted selection for a victory."
        persistent_writes_from_defeat_without_prior_acceptance:
          value: 0
          unit: writes
          status: target_pending_measurement
          reject_with: "Future defeat fixture shows a new companion, stage reward, or Archive record without a prior accepted authoritative event."
        Archive_growth_combat_delta:
          value: 0
          unit: direct_combat_delta
          status: target_pending_measurement
          reject_with: "Future campaign-state diff shows Archive growth directly changes a combat field."
    steady_progression:
      rule: "Persistent breadth may be earned only by disclosed active extraction or victory/reward conditions. It may not substitute for Gate/Warden defense, create a paid recovery, or make loss impossible."
      numeric_bands:
        persistent_reward_families_in_public_beat_maximum:
          value: 3
          unit: families
          status: target_pending_measurement
          reject_with: "Future campaign-state and UI inventory finds a fourth persistent reward family outside extracted companion, stage reward, and Archive growth."
        active_conditions_required_for_persistent_reward:
          value: 100
          unit: percent_of_persistent_reward_grants
          status: target_pending_measurement
          reject_with: "Future reward audit finds a persistent grant without accepted active extraction or victory/reward condition."
        hidden_or_random_mechanical_persistent_grants:
          value: 0
          unit: grants
          status: target_pending_measurement
          reject_with: "Future reward-table and replay audit finds a hidden or random mechanical persistent grant."
  loop_guardrails:
    duration:
      minimum: { value: 30, unit: seconds, status: target_pending_measurement, reject_with: "G7 duration receipt records a qualifying candidate below 30 seconds." }
      maximum: { value: 180, unit: seconds, status: target_pending_measurement, reject_with: "G7 duration receipt records a qualifying candidate above 180 seconds." }
    deliberate_action_classes_minimum: { value: 3, unit: classes, status: target_pending_measurement, reject_with: "G7 ordered-action trace records fewer than three distinct deliberate classes." }
    accepted_reward_events_minimum: { value: 1, unit: events, status: target_pending_measurement, reject_with: "G7 trace has no accepted reward event." }
  required_future_probes:
    - "Deterministic G7 trace: seed, stage, first-input tick, accepted-reward tick, action classes, reward type, extraction outcome, terminal outcome, and every persistent-write event."
    - "Campaign-state before/after diff for victory, defeat after accepted extraction, defeat before extraction, reward preview, reward acceptance, retry, and return-to-lobby."
    - "Portrait HUD capture and touch probe proving labels, current → upgraded values, and scope/loss text remain readable; the current 59 != 11 failure is unresolved."
    - "Shared adversarial input-tape balance matrix by five archetypes, with Gate/Warden minima and defeat/victory outcomes; campaign 150/150 clears and idle/macro 9/30 defeats may not be combined as one rate."
  source_paths:
    - intake/production-brief.md
    - qa/gate-measurements.md
    - qa/playtest-report.md
    - qa/exploit-register.md
    - design/core-loop-implementation.md
    - design/ui-ux-layout.md
    - design/reference-patterns.md
    - production/decision-log.md
```

## UI consequence: scope and loss are explicit

| Moment | UI must show | On failure/retry |
| --- | --- | --- |
| Growth skill, run item, derived stat, synergy | Current → upgraded value and **this run** | Cleared; no paid, automatic, or presentation-driven recovery |
| Elite candidate / Bind | Candidate, expiry, and **not yet persistent** | No grant on expiry or defeat before accepted extraction |
| Accepted extraction | Companion identity and **persists locally** only after the resolved handoff | Already accepted local collection entry remains; run-local combat state still clears |
| Stage reward | Choices, current → upgraded effect, and **persists locally when accepted** | No stage reward from defeat; accepted reward is not re-selected by retry |
| Archive growth | Locked → recorded, with **0 direct combat delta** | Previously recorded Archive state remains; it is never a revive, loss eraser, or paid recovery |

## Research boundary

The following are **transferable inferences, not runtime evidence or human-experience evidence**: readable enemy intent and risk before commitment; active resource triage; visible across-run growth; and explicit failure/return consequences. They are derived from public product descriptions, not playtests: [Into the Breach](https://subsetgames.com/itb.html), [FTL](https://subsetgames.com/ftl.html), [Hades](https://www.supergiantgames.com/games/hades/), and [Darkest Dungeon](https://www.darkestdungeon.com/). The local proposal is therefore falsified only by the listed future traces/captures, never by those sources.
