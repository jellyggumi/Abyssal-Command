# Revenue Map — Stage 1

## Decision

Abyssal Command is an offline/local, no-commerce product. There are no paid-power paths and no monetized alternatives to active play. This is a concept-validation decision, not a forecast of market performance.

```yaml
artifact_contract:
  schema_version: artifact-contract/1
  artifact_id: pm.revenue-map
  stage: stage-1-concept-validation
  status: target_pending_measurement
  current_gate_status: unpassed
  decision:
    id: PM-RM-01
    statement: "Target: keep every player-facing commercial route at zero; progression, Stage 10 completion, and sidegrades are earned locally through active play."
    target_values:
      paid_currency_count: { value: 0, unit: currencies, status: target_pending_measurement }
      paid_power_path_count: { value: 0, unit: paths, status: target_pending_measurement }
      purchase_or_ad_unlock_path_count: { value: 0, unit: paths, status: target_pending_measurement }
      account_or_subscription_requirement_count: { value: 0, unit: requirements, status: target_pending_measurement }
      required_network_or_realtime_api_dependency_count: { value: 0, unit: dependencies, status: target_pending_measurement }
  product_boundaries:
    - "Target: movement-first automatic combat remains the active source of combat XP, extraction, boss resolution, stage access, and the Stage 10 ending."
    - "Target: defense-catalog.js remains the sole authored rules authority; the deterministic 60 Hz simulation owns rewards and progression outcomes."
    - "Target: PCG may vary only bounded authored route/pressure composition; it cannot create a reward, change a disclosed condition, or select the Stage 10 outcome."
    - "Target: HUD, VFX, audio, music, narration, and haptics observe confirmed results only; missing or muted presentation cannot change a reward."
    - "Target: any ElevenLabs-derived asset is optional, reviewed, pre-generated build content; shipped runtime provider calls and credentials remain zero."
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
  validation:
    gate: G5
    status: unpassed
    required_evidence_paths:
      - qa/test-plan.md
      - qa/gate-measurements.md
      - qa/exploit-register.md
      - ops/telemetry-contract.md
      - engineering/architecture-contract.md
    falsifiers:
      - "Any payment, ad, premium-currency, paid-skip, account, subscription, cloud-sync, or social-pressure progression path exists."
      - "Any reward, extraction, stage unlock, boss result, or Stage 10 ending depends on an online service, presentation callback, or provider availability."
      - "Any build output contains an ElevenLabs endpoint, SDK, credential surface, signed URL, remote audio URL, or runtime generation path."
```

## Player value map

| Surface | Player value | Allowed source | Explicitly excluded |
| --- | --- | --- | --- |
| Active run | Movement mastery, automatic-build choices, boss progress | Deterministic 60 Hz rules and catalog-authored conditions | Purchases, ads, paid retries, pay-to-accelerate boosts, manual-aim shortcuts |
| Permanent breadth | Visible companion/Archive progress and equal-power sidegrade options | Disclosed active encounter condition or finite progress meter | Hidden odds, duplicate dilution, rarity sale, paid unlock, superior raw combat stat |
| Offline return | Small, one-time, formula-visible Archive preparation credit | One active-issued local permit; no combat simulation | Daily-login chain, expiring vault, notification pressure, paid collection multiplier |
| Stage/world continuity | W-05 factual recap from an already-resolved stage result | Allowlisted local outcome payload and bounded authored grammar | New progression flags, run-skill carryover, unbounded world simulation, Stage 11 promise |
| Presentation | Readable health/critical/cooldown, music, SFX, narration | Snapshot/event observers and local static assets | Gameplay gating by audio, VFX, device capability, network, or a provider API |

The revenue decision is intentionally inseparable from fairness: no player may exchange money, attention, identity data, calendar adherence, or audio-provider availability for power or progress. W-01 Command Echo, W-02 Bind/Extract, W-03 Gate Integrity, W-04 Domain, and W-05 Archive remain canon labels; Stage 10 remains the ending.

## Revenue-risk validation plan

All targets below are unmeasured and therefore **UNPASSED**.

| Target question | Future method | Evidence path | Gate state |
| --- | --- | --- | --- |
| Does the build preserve the zero-commercial-route target? | Static source and compiled-output scan for payment/ad/account/cloud/SDK/provider surfaces; manual product-flow inventory | `qa/gate-measurements.md` | UNPASSED |
| Does offline play require no service? | Cold install/reload plus network-blocked active-run, reward, idle-return, and Stage 10 fixture | `qa/test-plan.md`, `qa/gate-measurements.md` | UNPASSED |
| Does audio remain optional and local? | Normal, muted, missing-asset, decode-failure, and reduced-motion replay comparison | `qa/benchmark-notes.md`, `ops/telemetry-contract.md` | UNPASSED |
| Are PCG and stage handoff non-commercial and rules-safe? | Fixed-key map corpus plus outcome-payload allowlist review | `qa/gate-measurements.md`, `engineering/architecture-contract.md` | UNPASSED |

No pricing, conversion, ARPU, purchase, ad-impression, or revenue-growth target is defined because no such commercial surface is permitted in this Stage 1 contract.
