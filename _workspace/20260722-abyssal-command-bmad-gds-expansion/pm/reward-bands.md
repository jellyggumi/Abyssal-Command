# Reward Bands — Stage 1

## Purpose

This target contract defines readable active rewards, guaranteed permanent breadth, optional disclosed non-mechanical probability, and a bounded local idle return. It does not change `defense-catalog.js`, add a new rules authority, or assert that any target has been measured.

```yaml
comeback:
  status: target_pending_measurement
  name: Domain
  acquisition_path: free_play
  activation_cap: "1 per run"
  reversal_probability_max: 0.30
  release_rule: "No Domain runtime state exists in this concept-validation cycle; do not present or count it until catalog, deterministic roll, telemetry, and G5 evidence exist."
steady:
  status: target_pending_measurement
  parity_sessions_band: [10, 20]
  free_tactical_access: "equal-power sidegrades and disclosed finite progress only"
fairness:
  status: target_pending_measurement
  paid_power_present: false
  paid_free_winrate_delta_max_pp: 5
  current_product_boundary: "No paid path or purchase exists; the target is a future guard, not a measured comparison."
artifact_contract:
  schema_version: artifact-contract/1
  artifact_id: pm.reward-bands
  artifact_path: pm/reward-bands.md
  gate: G5
  stage: stage-1-concept-validation
  status: target_pending_measurement
  current_gate_status: unpassed
  evidence_paths:
    deterministic_rewards: qa/gate-measurements.md
    fairness_fixture: qa/test-plan.md
    local_event_trace: ops/telemetry-contract.md
  rules_authority:
    target: "defense-catalog.js plus deterministic 60 Hz simulation resolve every reward condition and outcome."
    status: target_pending_measurement
  reward_bands:
    active_run_choice:
      target_values:
        maximum_options_per_xp_offer: { value: 3, unit: options, status: target_pending_measurement }
        immediate_effect_prediction_rate_minimum: { value: 80, unit: percent, status: target_pending_measurement }
      rule: "Target: every option displays one mechanical effect, one tactical-role tag, and a before/after value when numerical; a recommendation is optional and must state its build-based reason."
      forbidden: [autopick_countdown, hidden_effect, ambiguous_commit, manual_aim_requirement]
    permanent_progress:
      target_values:
        eligible_completions_to_associated_unlock_maximum: { value: 3, unit: completions, status: target_pending_measurement }
        tactic_affecting_unlocks_with_disclosed_deterministic_condition: { value: 100, unit: percent, status: target_pending_measurement }
        tactic_affecting_unlocks_with_hidden_probability_or_duplicates: { value: 0, unit: percent, status: target_pending_measurement }
      rule: "Target: from the first eligible elite completion, show a nonresetting current/3 progress value, reward identity, and active condition before the next run. Permanent breadth may expose equal-power alternatives but must not create a raw health, damage, armor, rate, or automatic-targeting superiority."
    disclosed_probabilistic_nonmechanical_surprise:
      target_values:
        mechanical_value: { value: 0, unit: value, status: target_pending_measurement }
        disclosed_outcome_set_visibility: { value: 100, unit: percent, status: target_pending_measurement }
        disclosed_exact_probability_visibility: { value: 100, unit: percent, status: target_pending_measurement }
        duplicate_free_until_exhaustion: { value: 100, unit: percent, status: target_pending_measurement }
      rule: "Target: this band is optional and not recommended for the slice. If later approved, show the complete outcome set and exact chance before commitment, persist table revision and seed before reveal, provide a static/reduced-motion reveal, and grant no combat or progression value."
    archive_return:
      target_values:
        permit_limit: { value: 1, unit: unsettled_permits, status: target_pending_measurement }
        settlement_limit: { value: 1, unit: settlements_per_permit, status: target_pending_measurement }
        accepted_absence_cap: { value: 12, unit: hours, status: target_pending_measurement }
        return_credit_ceiling: { value: 20, unit: percent_of_active_seal_value_at_issue, status: target_pending_measurement }
        active_seal_share_for_sidegrade_minimum: { value: 80, unit: percent, status: target_pending_measurement }
        mechanical_return_probability: { value: 0, unit: percent, status: target_pending_measurement }
      formula: "Target: acceptedHours = clamp((resumeWallMs - issuedAtWallMs) / 3600000, 0, 12); returnCredit = activeSealValueAtIssue × 0.20 × (acceptedHours / 12), calculated in fixed-point units and persisted atomically."
      rule: "Target: a concluded active run may issue one permit. A resume settles it once; reopen reads the receipt. Negative or invalid local-clock deltas yield zero new credit without deleting progress."
      prohibited_outcomes: [combat_xp, run_xp, run_skill, extraction_success, companion_unlock, stage_unlock, boss_resolution, campaign_ending, combat_stat_change, simulated_combat]
    ten_to_twenty_session_tactical_parity:
      target_values:
        completion_time_difference_maximum: { value: 15, unit: percent_absolute, status: target_pending_measurement }
        boss_clear_time_difference_maximum: { value: 15, unit: percent_absolute, status: target_pending_measurement }
        completion_rate_difference_maximum: { value: 5, unit: percentage_points, status: target_pending_measurement }
        boss_clear_rate_difference_maximum: { value: 5, unit: percentage_points, status: target_pending_measurement }
        normalized_damage_taken_difference_maximum: { value: 10, unit: percent_absolute, status: target_pending_measurement }
        movement_hazard_error_difference_maximum: { value: 10, unit: percent_absolute, status: target_pending_measurement }
      rule: "Target: compare matched 10-session and 20-session fixtures with identical active-earned state, fixed seeds, and returnCredit set to zero versus maximum eligible, then repeat with appropriate unlocked equal-power sidegrades. Use preregistered bootstrap 95% confidence intervals; a value outside a band or an unresolved interval is not a pass."
    no_fomo:
      target_values:
        notification_exposure: { value: 0, unit: notifications, status: target_pending_measurement }
        late_return_loss_reports: { value: 0, unit: reports, status: target_pending_measurement }
        obligation_rating_4_to_5_maximum: { value: 10, unit: percent_of_moderated_participants, status: target_pending_measurement }
        Stage_10_reachable_without_return_credit: { value: 100, unit: percent_of_fixture_accounts, status: target_pending_measurement }
      rule: "Target: no daily-login deficit, countdown, expiry, storage-full alarm, streak, scheduled event, missed-reward screen, social comparison, paid skip, or return-time multiplier. At the cap, the receipt remains claimable indefinitely; time beyond the cap neither erases nor downgrades content."
  source_paths:
    - ../../../docs/abyssal-command-defense-survivor-design.md
    - intake/production-brief.md
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
  validation:
    gate: G5
    status: unpassed
    evidence_paths:
      deterministic_rewards: qa/gate-measurements.md
      choice_comprehension: qa/benchmark-notes.md
      idle_fault_matrix: qa/test-plan.md
      local_event_trace: ops/telemetry-contract.md
      save_and_rules_boundary: engineering/architecture-contract.md
```

## Reward disclosure and stage/world linkage

- **Guaranteed mechanical value.** Target: boss victory remains the only mechanical route to the next stage, Stage 10 boss victory remains campaign completion, and active encounter conditions remain the only route for extraction/companion outcomes. W-02 may name an already-confirmed Bind/Extract result; it must never promise one. W-05 may recap a result, never create it.
- **Bounded reward context.** Target: an authored stage plan may vary only permitted map and wave composition before play. Its canonical objective, boss gate, reward condition, and Stage 10 ending cannot be rerolled by a seed, return time, narration variant, or presentation setting.
- **Presentation-safe clarity.** Target: health, critical, cooldown, reward choice, and return receipt have a static shape/text/contrast path in reduced motion and with audio muted. Music, SFX, narration, haptics, and optional build-time assets do not grant, delay, or describe a hidden reward.
- **No realtime dependency.** Target: reward calculation, receipt persistence, choice commit, stage handoff, and all validation fixtures operate offline. Any ElevenLabs content is a pre-generated, rights-reviewed asset with text/silence fallback; it makes zero live API calls and accepts zero credentials in the runtime.

## Target validation plan

| Target | Future test | Required evidence path | Current status |
| --- | --- | --- | --- |
| Guaranteed permanent progression | Fixed eligible-completion fixtures for first through third completion; assert visible condition/progress and no fourth completion required | `qa/gate-measurements.md` | UNPASSED |
| Choice clarity | Moderated stated-goal selection with fixed offers; verify effect prediction and one unambiguous commit | `qa/benchmark-notes.md`, `ops/telemetry-contract.md` | UNPASSED |
| Probability restraint | Reward-table audit; attempt mechanical chance, hidden odds, duplicate, and near-miss insertion | `qa/exploit-register.md` | UNPASSED |
| Idle bound and idempotency | Inject zero, short, cap, cap-plus-one, negative, rollback, malformed-save, storage-denied, and reopen cases | `qa/test-plan.md`, `qa/gate-measurements.md` | UNPASSED |
| 10–20-session parity | Preregister fixtures and confidence intervals; compare matched treatment pairs and equal-power sidegrade cohorts | `qa/benchmark-notes.md`, `ops/telemetry-contract.md` | UNPASSED |
| No-FOMO experience | Moderated zero/two/cap/over-cap resume study; record obligation, understanding, late-loss, and notification exposure | `qa/benchmark-notes.md` | UNPASSED |
| Rules/presentation separation | Replay normal, muted, missing-asset, reduced-motion, and alternate render conditions; compare reward and state hashes | `qa/gate-measurements.md`, `engineering/architecture-contract.md` | UNPASSED |

No target in this file is a current measurement, entitlement, commercial offer, or authorization to add a realtime API.

## Stage 2 proposal — deterministic growth and receipt-first reward accounting

**Status:** **PROPOSAL / TARGETS ONLY.** This section supersedes no runtime rule, authorizes no retune, and makes no retention, engagement, revenue, conversion, or monetization claim. G5, G7, and G8 remain **NOT MEASURED / NOT PASSED**. The reward authority remains `defense-catalog.js` plus the deterministic 60 Hz simulation; a receipt, HUD, audio, VFX, narration, and local persistence only record a resolved rule outcome.

### Reward classes and hard boundaries

| Class | Stage 2 proposal | Required player-visible fact before commitment or settlement | Never allowed |
| --- | --- | --- | --- |
| Run growth skill/item choice | A fixed-seed offer is a **guaranteed offer event**. Once the player selects a displayed option, its growth effect is deterministic and replay-recorded. Skills are run-scoped unless the active progression rule explicitly says otherwise. | Effect, tactical role, before/after value when numeric, and any recommendation reason; close/defer has no penalty. | Auto-pick, hidden synergy/effect, re-roll pressure, probability presented as certainty, paid or network-served option. |
| Permanent passive progression | Active eligible completions advance a visible, nonresetting finite progress record toward a known equal-power sidegrade, passive modifier, or companion-role option. “Passive” means a disclosed persistent record, **not** autonomous combat, idle simulation, or a raw-stat escalation. | Reward identity; active condition; `current / target`; remaining eligible completions; any active-confirmation condition. | Hidden probability, duplicate dilution, chance-gated tactical power, raw damage/health/armor/rate superiority, absence-only completion, commerce. |
| Boss, stage, extraction, and campaign outcomes | These are guaranteed only when their disclosed active condition is confirmed. | Confirmed/failed state, condition, delta, and current/target progress when applicable. | A seed, idle duration, cosmetic table, presentation callback, provider availability, or probability table changing the outcome. |
| Archive Return Permit / offline idle return | One concluded active run may issue one local permit. A persisted, fixed-point formula settles it once into restricted Archive preparation credit; reopening displays the original receipt. | Permit ID, rules/formula revision, accepted elapsed time, cap, inputs, expected/actual fixed-point credit, restricted destination, and final balance. | Background combat, combat RNG advancement, extra permit, re-settlement, expiry/decay, daily cadence, network clock, account/cloud entitlement, paid multiplier. |
| Optional cosmetic or lore surprise | **Not recommended and not in the Stage 2 slice.** If separately approved later, it is non-mechanical only and deterministic from a pre-committed table/reveal record. | Complete outcome set, each exact weight and percent, sum/rounding rule, duplicate/exhaustion rule, table revision, and deterministic reveal derivation. | Tactical/progression value, purchase, ad, timer, retry pressure, hidden state-dependent odds, near-miss presentation, or duplicate conversion. |

This policy follows the research recommendation to default to visible mechanical progression and receipt-first settlement (`research/reward-presentation-and-retention.md#L3-L19`), the explicit mechanical/probabilistic separation (`research/reward-presentation-and-retention.md#L64-L83`), and the active-authority boundary for Archive return (`research/progression-idle-economy.md#L7-L12`).

### TARGET registry and mandatory later evidence

Every value below is a **TARGET / future measurement**, not an observed result. A target cannot be used to describe retention, fairness, parity, player satisfaction, market demand, or a gate pass until its listed evidence is produced and independently reviewed.

| Proposal target | Owner | Measurement method | Required evidence path | Blocked/deferred condition |
| --- | --- | --- | --- | --- |
| Exactly `3` visible run-growth options; at least `80%` immediate-effect prediction; `0%` timed or ambiguous commits. | Game PM + game designer; QA measures. | Counterbalanced stated-goal sessions with fixed offers; commit-event review; report comprehension, decision time, deferral, regret, dominance, and unintended commit. | `qa/benchmark-notes.md`; `ops/telemetry-contract.md`; `qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl`. | Any hidden effect, auto-pick, ambiguous/duplicate commit, missing accessibility-equivalent, or failed/unreported comprehension result. |
| Permanent growth reaches its named equal-power sidegrade/passive option within `<=3` eligible active completions; `100%` of tactic-affecting paths disclose their condition; `0%` use hidden probability or duplicates. | Game designer proposes; game PM accepts; QA verifies. | Fixed first/second/third eligible-completion fixtures plus field-diff check; inspect the visible `current / target` receipt. | `qa/gate-measurements.md`; `qa/test-plan.md`; `qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl`. | A fourth completion is needed; visible progress resets; a passive item changes prohibited raw-stat fields; an idle/probabilistic/commercial route completes it. |
| Every mechanical probabilistic reward remains `0%`; any separately approved cosmetic table has `0` mechanical value, `100%` pre-commit outcome/odds visibility, exact weights summing to `100.00%`, and `100%` duplicate-free grants until exhaustion. | Game PM owns policy; game designer owns table definition; QA audits. | Inject incomplete sums, hidden modifiers, changed revisions, duplicates, paid/timed retry, and near-miss assets; seeded receipt replay must reproduce the disclosed record. | `qa/exploit-register.md`; `qa/gate-measurements.md`; `qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl`. | No approved cosmetic-only table schema; any tactical value, undisclosed odds, non-100% sum, duplicate before exhaustion, or coercive presentation. |
| One unsettled permit and one settlement per permit; accepted absence cap `12 h`; Archive credit `<=20%` of active-seal value at issue; each sidegrade needs `>=80%` active seals and a separate active confirmation; mechanical return randomness `0%`. | Game PM + game designer define; game programmer implements later; QA measures. | Fixed-point property/fault matrix at `0 h`, short, `2 h`, `6 h`, `12 h`, `24 h`, cap-plus-one, negative, rollback, forward jump, malformed, denied-storage, reopen x100, and two-tab conflict; forbidden-field diff. | `qa/test-plan.md`; `qa/gate-measurements.md`; `qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl`. | Any duplicate grant, non-atomic receipt, over-cap credit, invalid-time grant, missing receipt input, combat RNG advance, or delta to combat XP/run XP/run skill/extraction/boss/stage/companion/campaign/combat-stat fields. |
| Matched 10- and 20-session return-credit cohorts stay within `±15%` median completion and boss-clear time, `5 pp` completion/boss-clear rate, and `±10%` normalized damage taken and movement-hazard errors; Stage 10 is reachable without return credit in `100%` of fixture accounts. | Game PM preregisters; game designer supplies equal-power cohorts; QA analyzes. | Fixed-seed, identical active-earned-state treatment pairs (`returnCredit=0` vs maximum eligible), then appropriate unlocked equal-power sidegrade cohorts; preregistered bootstrap `95%` intervals. | `qa/benchmark-notes.md`; `ops/telemetry-contract.md`; `qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl`. | Point estimate outside a band, unresolved interval, unequal active-earned state, return-only combat outcome, or return credit required for a feasible Stage 1–10 route. |
| No appointment pressure: `0` notifications and late-return loss reports; at most `10%` of moderated participants rate obligation `4–5/5`; at least `80%` rate receipt understanding `4–5/5`. | Game PM defines instrument/questionnaire; QA conducts. | Moderated `0 h`, `2 h`, `6 h`, `12 h`, and `24 h` resumes with full response distribution; content/event scan for expiry, countdown, streak, and urgency language. | `qa/benchmark-notes.md`; `qa/exploit-register.md`; `qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl`. | Any lost/decayed content, pressure surface, notification exposure, selective reporting, or pressure above the target. |
| Core reward, choice, settlement, and receipt flow requires `0` network, account, commerce, ad, paid-skip, premium-currency, provider, or runtime credential paths. | Game PM owns product boundary; QA verifies. | Network-disabled cold reload through active run, choice, permit settlement, stage handoff, and Stage 10; static and compiled-output route/credential scan. | `qa/test-plan.md`; `qa/gate-measurements.md`; `engineering/architecture-contract.md`. | A network-disabled path fails, or any payment/ad/account/cloud/provider route alters reward, growth, or outcome. |

The fixed-point proposal, one-settlement model, and prohibited fields are grounded in `research/progression-idle-economy.md#L46-L76`; the candidate cap is expressly not evidence-derived and must lose to no-FOMO if the study rejects it (`research/progression-idle-economy.md#L35-L44`). The growth/parity targets remain aligned with the balance-sheet equal-budget guard rather than a raw-stat passive-power path (`design/balance-sheet.md#L28-L29`, `design/balance-sheet.md#L202-L209`).

### Exact QA packet required before a reward or growth retune

No reward, growth skill/item, passive progression, Archive-credit, probability-table, or presentation retune may proceed on this proposal alone. QA must first deliver all of the following:

1. A G5 packet at `qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl` containing the absent-commercial-path scan, complete guaranteed/probabilistic reward-table inspection, settlement property matrix, and 10/20-session parity analysis.
2. Receipt/replay invariance across normal, muted, mono, high-contrast, reduced-motion, skipped-animation, missing-asset, and network-disabled modes, with equal receipt fields and rules/state hashes at `qa/gate-measurements.md`.
3. The idle fault matrix and forbidden-field save diff at `qa/test-plan.md`, including the exact cases listed in the target registry.
4. A probability-table adversarial audit at `qa/exploit-register.md`, even if the result is “no chance surface exists.”
5. The preregistered moderated comprehension/obligation study at `qa/benchmark-notes.md`, reporting every response rather than a favorable subset.
6. A G7 offline-flow verdict based on the network-disabled fixture and architecture evidence above. **G7 remains NOT MEASURED / NOT PASSED** until this evidence exists.
7. If a receipt presentation is ever claimed as distinctive, the independent five-comparable plus first-impression method at `qa/evidence/gates/G8-novelty-comparison-and-impression.json`. Reward determinism is fairness infrastructure, not G8 evidence. **G8 remains NOT MEASURED / NOT PASSED.**

Only after QA identifies a violated preregistered target may PM and designer consider a correction. The correction must name the failed metric, controlled cohort/fixture, proposed rule revision, expected field deltas, and rollback condition; it requires a new PM-and-designer signature in `pm/negotiation-record.md` before any implementation or remeasurement. This does not convert G5, G7, or G8 into a passed gate.
