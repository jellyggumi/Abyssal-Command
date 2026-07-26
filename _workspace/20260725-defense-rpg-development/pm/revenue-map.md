# Revenue Map — Phase 2b Non-Monetary Player Value

## Decision

No revenue feature, purchase, paid power, premium currency, advertisement reward, account, subscription, network dependency, or recovery sale is in scope. Financial revenue, ARPU, conversion, payer mix, and paid/free fairness are **out of scope**, not zero-valued performance claims. In this document, “revenue map” is retained only as the requested artifact name; its content is a player-value and reward-moment map.

```yaml
artifact_contract:
  schema_version: artifact-contract/1
  artifact_id: pm.revenue-map
  artifact_path: pm/revenue-map.md
  run_id: 20260725-defense-rpg-development
  stage: stage-2-phase-2b
  status: target_pending_measurement
  product_boundary:
    revenue_features_in_scope: false
    paid_power_in_scope: false
    commerce_or_ads_in_scope: false
    account_or_network_in_scope: false
    monetary_paid_free_fairness: out_of_scope
  authority_boundary:
    rewards: "Existing deterministic simulation resolves reward eligibility and outcome."
    persistence: "Existing campaign authority records accepted local persistent rewards."
    presentation: "UI, renderer, and audio observe only; none can create a reward moment or change its value."
  value_moments:
    - id: VM-01
      moment: growth_choice
      player_value: "Make one readable build decision under Gate/Warden pressure."
      scope: run_local
      required_ui: "Three comparable options, current → upgraded values, tactical role, and this-run loss label."
      non_monetary_success_measure:
        target: { value: 3, unit: visible_options, status: target_pending_measurement }
        reject_with: "G7 trace/UI capture shows an offer with other than three comparable options or without an accepted selection event."
      excluded: [reroll_purchase, paid_choice, timed_autopick, hidden_effect]
    - id: VM-02
      moment: run_item
      player_value: "Trade movement and exposure for a concrete run-only tactical change."
      scope: run_local
      required_ui: "Item identity, current → upgraded value, and this-run loss label."
      non_monetary_success_measure:
        target: { value: 1, unit: stage_local_item_opportunities_per_qualifying_loop, status: target_pending_measurement }
        reject_with: "Future deterministic slice trace lacks the authored item opportunity or shows an unnegotiated extra opportunity."
      excluded: [paid_pickup, paid_duplicate, persistent_item_carryover]
    - id: VM-03
      moment: extraction
      player_value: "Close a player-controlled Bind after elite defeat and receive an explicit companion outcome."
      scope: "run-local companion immediately; local persistent collection only after accepted authoritative handoff"
      required_ui: "Elite identity, Bind progress, expiry, accepted/failed outcome, and resulting scope."
      non_monetary_success_measure:
        target: { value: 1, unit: accepted_extraction_handoffs_per_run_maximum, status: target_pending_measurement }
        reject_with: "Future extraction event trace has more than one accepted persistent handoff in a run, or state diff grants one without EXTRACT_ELITE acceptance."
      excluded: [auto_capture, paid_window_extension, paid_rescue, reward_on_expiry]
    - id: VM-04
      moment: stage_reward
      player_value: "After preserving Gate/Warden through the terminal contest, choose one disclosed next-run reward."
      scope: persistent_local_campaign_on_accepted_victory
      required_ui: "Three disclosed reward choices, current → upgraded value, persistent-local label, and one accepted selection."
      non_monetary_success_measure:
        target: { value: 1, unit: accepted_stage_reward_selections_per_victory, status: target_pending_measurement }
        reject_with: "Future terminal trace records zero or more than one accepted stage reward selection for a victory."
      excluded: [defeat_reward, paid_retry, paid_selection, reroll_sale]
    - id: VM-05
      moment: Archive_growth
      player_value: "Retain a visible local record of accepted campaign growth without disguising it as a recovery or power sale."
      scope: persistent_local_campaign
      required_ui: "Locked → recorded state, source event, and explicit 0 direct combat delta."
      non_monetary_success_measure:
        target: { value: 0, unit: direct_combat_delta, status: target_pending_measurement }
        reject_with: "Future campaign-state diff attributes a direct combat-field change to Archive growth."
      excluded: [revive, loss_erasure, paid_acceleration, account_entitlement]
  loss_and_recovery_boundary:
    defeat_can_occur:
      value: true
      status: target_pending_measurement
      reject_with: "Shared adversarial input-tape matrix cannot produce and report defeat outcomes by stage/archetype."
    automatic_or_paid_recovery_paths:
      value: 0
      unit: paths
      status: target_pending_measurement
      reject_with: "Product-flow audit finds an automatic, paid, or presentation-driven recovery path."
  required_measurement_envelope: [rules_version, stage_id, seed, tick, event_type, reward_type, scope, value_before, value_after, Gate_HP_minimum, Warden_HP_minimum, terminal_outcome]
```

## Player-value map

| Moment | What the player gets | Consequence that preserves the loop | Required validation |
| --- | --- | --- | --- |
| Growth choice | A readable, active build direction | It expires with the run; it cannot erase Gate/Warden danger | G7 ordered action/reward trace plus growth UI capture |
| Run item | A concrete tactical shift from active collection | It expires with the run; no persistence or paid duplicate | Item event and run-state before/after diff |
| Extraction | A player-closed companion handoff | Expiry or defeat before acceptance grants nothing; accepted handoff must be explicit | `EXTRACTION_READY` → accepted `EXTRACT_ELITE` → `ELITE_EXTRACTED` trace and campaign diff |
| Stage reward | One accepted post-victory persistent choice | Defeat is not converted into a reward; retry cannot choose again | Terminal outcome + `REWARD_SELECTED` trace and campaign diff |
| Archive growth | A local record of accepted growth | It has no direct combat delta, revive, or loss erasure | Campaign diff and UI screenshot |

## Research boundary

**Transferable inference, not runtime evidence or human-experience evidence:** public descriptions support making deliberate threat, companion, progression, and return consequences legible rather than monetized. Canonical sources are [Monster Hunter](https://www.monsterhunter.com/), [XCOM](https://xcom.com/), [Hades](https://www.supergiantgames.com/games/hades/), and [Darkest Dungeon](https://www.darkestdungeon.com/). The current product may not claim those experiences; only the future local probes above can reject or support these targets.
