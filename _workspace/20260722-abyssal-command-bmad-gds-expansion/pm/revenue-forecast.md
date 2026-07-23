# Revenue Forecast — Stage 1

## Forecast boundary

This is a zero-commercial-surface forecast, not a business-revenue model. Stage 1 has no authorized payment, advertising, subscription, premium currency, paid skip, account, commerce partner, or realtime provider dependency. Therefore it makes no claim about demand, sales, retention, conversion, or profitability.

```yaml
artifact_contract:
  schema_version: artifact-contract/1
  artifact_id: pm.revenue-forecast
  stage: stage-1-concept-validation
  status: target_pending_measurement
  current_gate_status: unpassed
  forecast_basis:
    type: policy_constrained_zero_revenue_surface
    rule: "Target: all player-facing commercial and realtime-provider routes remain absent from the Cinder Span Command Feedback slice."
  target_forecast:
    currency: local_product_units_not_monetary
    values:
      paid_price: { value: 0, unit: paid_price_points, status: target_pending_measurement }
      premium_currency_count: { value: 0, unit: currencies, status: target_pending_measurement }
      paid_power_path_count: { value: 0, unit: paths, status: target_pending_measurement }
      paid_skip_or_retry_path_count: { value: 0, unit: paths, status: target_pending_measurement }
      advertising_reward_path_count: { value: 0, unit: paths, status: target_pending_measurement }
      subscription_or_account_gate_count: { value: 0, unit: gates, status: target_pending_measurement }
      social_or_notification_pressure_path_count: { value: 0, unit: paths, status: target_pending_measurement }
      required_network_request_count_in_core_fixture: { value: 0, unit: requests, status: target_pending_measurement }
      required_runtime_elevenlabs_or_other_provider_call_count: { value: 0, unit: calls, status: target_pending_measurement }
      runtime_credential_acceptance_surface_count: { value: 0, unit: surfaces, status: target_pending_measurement }
  non_monetary_value_hypotheses:
    active_play:
      target: "Movement, automatic-build choices, readable health/critical/cooldown feedback, varied bounded map/wave pressure, and boss resolution form the value proposition."
      status: target_pending_measurement
    permanent_breadth:
      target: "Visible deterministic progress expands equal-power companion/Archive options without raw power escalation."
      status: target_pending_measurement
    return_convenience:
      target: "A one-time local Archive receipt provides small, formula-visible preparation without substituting for active movement, extraction, boss resolution, stage progress, or Stage 10 completion."
      status: target_pending_measurement
    continuity:
      target: "A factual W-05 recap may connect an authoritative stage outcome to the next stage without persisting run skills, rerolling rewards, or asserting a new world simulation."
      status: target_pending_measurement
  execution_boundaries:
    - "Target: defense-catalog.js remains the sole authored rules authority and the fixed 60 Hz simulation resolves all reward and progression conditions."
    - "Target: PCG selects only authored bounded variants before tick zero; a seed cannot create a paid, random, hidden, or provider-served reward."
    - "Target: audio, music, SFX, narration, VFX, HUD, haptics, and reduced-motion variants are observer-only; their availability never changes a receipt, offer, extraction, stage result, or ending."
    - "Target: ElevenLabs is optional build-operator tooling only after rights review. The shipping bundle accepts no credentials and performs zero live provider calls; pre-rendered assets fall back to local procedural cue or silence with visible text."
  validation:
    status: unpassed
    gates:
      G5:
        claim: "The fair no-commerce reward and idle-return model remains within its target bounds."
        evidence_paths: [qa/gate-measurements.md, qa/test-plan.md, qa/benchmark-notes.md]
      G6:
        claim: "Reward choices remain visible, comparable, and exactly committed without monetized or time-pressure alternatives."
        evidence_paths: [qa/gate-measurements.md, ops/telemetry-contract.md]
      G7:
        claim: "Local idle settlement and all core flows work without network, account, or provider dependency."
        evidence_paths: [qa/test-plan.md, qa/gate-measurements.md, engineering/architecture-contract.md]
      G8:
        claim: "Bounded PCG and stage/world handoff vary authored play without changing rewards or campaign outcomes."
        evidence_paths: [qa/gate-measurements.md, qa/benchmark-notes.md]
    falsifiers:
      - "A player can exchange money, advertising attention, identity/account data, calendar adherence, or provider availability for power, reward, access, or a better outcome."
      - "A network-disabled fixture cannot complete the active-run, reward-choice, idle-return, stage handoff, and Stage 10 outcome path."
      - "A static or compiled output scan finds provider endpoint, SDK, credential, signed remote audio URL, or runtime generation path."
      - "A presentation setting, narration/audio asset, PCG seed, or idle timer changes deterministic reward/progression state outside the authored rule contract."
  source_paths:
    - ../../../docs/abyssal-command-defense-survivor-design.md
    - intake/production-brief.md
    - production/team-roster.md
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

## Stage 2 PM measurement decision

```yaml
measurement_only_addendum:
  decision_id: PMD-06
  status: accepted_for_instrumentation_only
  signed_by: { role: game-pm, date: 2026-07-22 }
  scope: "Authorize the five analytic equal-budget profile fixtures and observer-safe resolved-damage/cooldown records needed to measure G2 after XR-13 and XR-14. The profiles are not player-facing classes, entitlement tiers, products, or reward routes."
  authorized_numeric_contract:
    analytic_profile_count: { value: 5, unit: profiles }
    equal_authoring_budget: "One recorded health/crit/cadence tuple per profile, with identical stage/enemy setup, seed/input policy, baseline commander/companion condition, and zero campaign, Archive, commercial, or hidden modifiers. No profile may lead simultaneously in survival, crit EV, and cadence."
    player_reward_changes: { value: 0, unit: changes, status: not_authorized }
    idle_return_changes: { value: 0, unit: changes, status: not_authorized }
    monetization_or_commerce_changes: { value: 0, unit: changes, status: prohibited }
    paid_power_path_changes: { value: 0, unit: changes, status: prohibited }
    required_network_requests: { value: 0, unit: requests, status: prohibited }
    required_runtime_provider_calls: { value: 0, unit: calls, status: prohibited }
  retained_fairness_boundaries:
    - "No payment, advertising attention, account, subscription, premium currency, paid skip, or provider availability may alter profile selection, damage, cooldown, reward, idle receipt, access, or outcome."
    - "The fixture state is local/offline and observer-only. It must not persist campaign progress, alter idle-return math, or create a monetized forecast surface."
  gate_status:
    G2: { status: NOT MEASURED, verdict: NOT PASSED }
    G5: { status: NOT MEASURED, verdict: NOT PASSED, note: "Unaffected; this decision is not fairness evidence." }
    G8: { status: NOT MEASURED, verdict: NOT PASSED, note: "Unaltered." }
  unapproved_future_work: "No combat, reward, idle-return, or monetization retune is approved. Any future retune requires a measured G2 result in qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl that identifies a violated preregistered threshold, followed by a newly signed PM/designer correction."
```

## What is intentionally not forecast

- No monetary revenue, price, conversion rate, ARPU, ad inventory, subscription count, paid retention, acquisition cost, or commercial break-even value is a valid Stage 1 target.
- No user data collection, remote experimentation, account-based entitlement, cloud save, social loop, push notification, timed event, or replayable purchase opportunity is proposed to fill that gap.
- No ElevenLabs (or other provider) runtime request, retry, token, key, webhook, signed URL, streaming connection, or dynamic asset selection is proposed. Rights-reviewed candidate files, if ever adopted, are static build artifacts and do not create a commercial or realtime game dependency.

## Validation ledger

| Contract claim | Future evidence | Evidence path | Current gate status |
| --- | --- | --- | --- |
| Zero commercial routes | Source/build scan plus player-flow inventory, including reward, fail/retry, and settings surfaces | `qa/gate-measurements.md`, `qa/exploit-register.md` | UNPASSED |
| Offline core loop | Network-disabled cold reload: active run, XP choice, deterministic reward, idle receipt, stage transition, Stage 10 ending | `qa/test-plan.md` | UNPASSED |
| Provider-free runtime | Compiled JS/HTML/service-worker scan plus valid/missing/decode-failed local-audio replay | `qa/gate-measurements.md`, `engineering/resource-manifest.md` | UNPASSED |
| No paid-power substitute for fairness | Audit all permanent/idle spend routes and matched 10–20-session parity fixtures | `qa/benchmark-notes.md`, `qa/exploit-register.md` | UNPASSED |
| Bounded authored variety preserves outcomes | Fixed-key corpus, objective/reward allowlist audit, normal/reduced-motion replay hashes | `qa/gate-measurements.md`, `ops/telemetry-contract.md` | UNPASSED |
| Stage/world continuity stays factual | Win/loss payload allowlist and W-05 recap fixture, including muted/missing-voice paths | `qa/benchmark-notes.md`, `engineering/architecture-contract.md` | UNPASSED |

The only forecast supported by this Stage 1 artifact is a target of zero commercial and realtime-service reliance. It becomes credible only after the listed future evidence exists; until then every value remains a target and every gate remains unpassed.
