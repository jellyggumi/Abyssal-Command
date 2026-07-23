# Designer ↔ PM negotiation record

Both rounds were signed on 2026-07-22. Designer sign-off approves category separation and numeric targets, contingent on current → upgraded presentation; it is **not** a G2/G3/G5 PASS. No catalog values changed in either round. Provisional balance snapshots do not modify these negotiated bounds; only the exact final post-tuning current-head QA packet may supply gate evidence.

```yaml
record_version: designer-pm-v2
rules_version: defense-survivor-v1
signed_date: 2026-07-22
global_bounds:
  commerce_present: false
  paid_power_present: false
  acquisition_path: free-play
  win_rate: [0.45, 0.55]
  boss_ttk_tolerance_fraction: 0.15
  combo_ev_cap_vs_median: 1.30
  free_parity_sessions: [10, 20]
  paid_free_winrate_delta_max_pp: 5
  current_paid_power_delta_pp: 0
reward_points:
  - id: RP-01
    point: echo-xp-three-choice-growth
    catalog_scope: [rift-bolt, soul-lance, grave-pulse, void-aegis, shadow-step, eclipse-edge, soul-magnet, ward-binder]
    balance_touch: [damage, cooldown_ticks, radius, integrity, basic_damage, pickup_range]
    round_1:
      designer: "Keep growth as a simulation-owned three-choice offer and separate it from items, persistent stats, and synergies."
      game_pm: "Free-only; show current → upgraded values and measure offer/selection cadence."
      agreement: "Three choices; no paid reroll; combo EV ≤1.30× median."
      signed_by: [game-designer, game-pm]
    round_2:
      designer: "Retain all eight IDs and numeric separation; no balance PASS without five-archetype measurement."
      game_pm: "Retain 45–55% win and ±15% boss TTK gates; forecast 2–4 offers per clear as a hypothesis."
      agreement: "No value change; telemetry and current-head simulation required."
      signed_by: [game-designer, game-pm]

  - id: RP-02
    point: elite-run-item
    catalog_scope: [ashen-sigil, ward-splinter, echo-compass, hourglass-fragment, dawnless-crown-shard]
    balance_touch: [basic_damage, gate_integrity, pickup_range, cooldown_scale]
    round_1:
      designer: "Items remain run-only, one authored item opportunity per stage."
      game_pm: "No persistence or purchase; present raw current → post-pickup values."
      agreement: "Keep exact catalog effects; no hidden stacking or paid duplication."
      signed_by: [game-designer, game-pm]
    round_2:
      designer: "Keep item effects separate from skills/stats/synergies."
      game_pm: "Validate item collection rate and archetype win/TTK impact."
      agreement: "No value change; G2/G5 evidence pending."
      signed_by: [game-designer, game-pm]

  - id: RP-03
    point: occupation-extraction-opportunity
    catalog_scope: [STAGE_TACTICS, OCCUPATION_PROGRESS, OCCUPATION_CAPTURED, ELITE_CANDIDATE_AVAILABLE, ELITE_EXTRACTED]
    balance_touch: [hold_ticks, movement_multiplier, range_multiplier, recovery_per_second, companion_access]
    round_1:
      designer: "Occupation/extraction must affect tactical positioning, while extraction remains player-controlled."
      game_pm: "One free opportunity per stage and no paid extension of the authored extraction window."
      agreement: "Require deterministic stage-specific points and current → captured/extracted values."
      signed_by: [game-designer, game-pm]
    round_2:
      designer: "Sign candidate bands: hold 180–360 ticks, move ×1.04–1.08, range ×1.06–1.12, recovery +4–12/s."
      game_pm: "Count one authored occupation opportunity per stage, but do not forecast a successful capture without event evidence."
      agreement: "Candidate semantics accepted after narrow recovery/counter/spatial verification; not PASS until mandatory loop order is observed, 45–55% wins, at least three viable archetypes, complete ±15% boss-TTK coverage, ≤1.30× accepted full combo EV, and G5 cadence/parity evidence."
      signed_by: [game-designer, game-pm]

  - id: RP-04
    point: extracted-persistent-companion
    catalog_scope: [ember-cohort, rift-lens, veil-vanguard, anchor-shard, throne-echo, dawnless-crown]
    balance_touch: [damage, fire_ticks, range, loadout_size, evolution]
    round_1:
      designer: "Bind/Extract creates persistent companion choice, not instant generic power."
      game_pm: "All capture paths are free; loadout maximum is 3 and evolution record is 1–3."
      agreement: "Show slot/current companion → catalog damage/fire ticks/range."
      signed_by: [game-designer, game-pm]
    round_2:
      designer: "Do not invent evolution scaling where the current runtime records evolution only."
      game_pm: "Measure unique capture, duplicate evolution, equip, and win-rate effects across five archetypes."
      agreement: "No value change; 10–20-session tactical parity remains mandatory."
      signed_by: [game-designer, game-pm]

  - id: RP-05
    point: stage-reward-companion-legacy
    catalog_scope: [ember-cohort-legacy, veil-vanguard-legacy]
    balance_touch: [starting_companion, damage, fire_ticks, range]
    round_1:
      designer: "Legacy rewards add their authored companion at next run start."
      game_pm: "One free boss reward selection per clear; duplicate ownership adds no second copy."
      agreement: "No paid companion slot or early unlock."
      signed_by: [game-designer, game-pm]
    round_2:
      designer: "Keep companion legacy distinct from extracted collection and Archive records."
      game_pm: "Show unowned → owned and resulting companion values; measure win-rate delta."
      agreement: "No value change; fairness limit ≤5 pp, target structural 0 pp."
      signed_by: [game-designer, game-pm]

  - id: RP-06
    point: stage-reward-cooldown
    catalog_scope: [stillwater-hourglass]
    balance_touch: [cooldown_scale]
    round_1:
      designer: "Authored effect is cooldown reduction 0.20 at run creation."
      game_pm: "Free stage reward only; display 1.00 → 0.80 before other earned reductions."
      agreement: "Simulation clamp remains authoritative; no paid acceleration."
      signed_by: [game-designer, game-pm]
    round_2:
      designer: "Test active-skill synergies against the 1.30× EV cap."
      game_pm: "Measure selection, ownership, TTK, and archetype win effect."
      agreement: "No value change; G2/G5 evidence pending."
      signed_by: [game-designer, game-pm]

  - id: RP-07
    point: stage-reward-gate-protection
    catalog_scope: [bulwark-brand, anchor-shard-archive]
    balance_touch: [gate_damage_reduction, gate_integrity]
    round_1:
      designer: "Keep reduction and integrity as separate defensive levers."
      game_pm: "Display reduction 0 → 2 and Gate integrity 1000 → 1040; free boss reward only."
      agreement: "No paid recovery or Archive bypass."
      signed_by: [game-designer, game-pm]
    round_2:
      designer: "Measure real defeat pressure against gate-pressure/ranged/flank policies when implemented."
      game_pm: "Track breach damage, terminal result, win rate, and boss TTK by reward ownership."
      agreement: "No value change; policy/runtime dependency blocks a balance PASS."
      signed_by: [game-designer, game-pm]

  - id: RP-08
    point: stage-reward-companion-damage
    catalog_scope: [abyssal-banner]
    balance_touch: [companion_damage]
    round_1:
      designer: "Authored effect is +60 damage to starting and later extracted companions."
      game_pm: "Free stage reward; show each affected companion current → +60 value."
      agreement: "No paid banner, stacking copy, or hidden multiplier."
      signed_by: [game-designer, game-pm]
    round_2:
      designer: "Test multi-companion synergies and low-HP focus pressure."
      game_pm: "Enforce combo EV ≤1.30× median and paid/free delta ≤5 pp."
      agreement: "No value change; measured evidence pending."
      signed_by: [game-designer, game-pm]

  - id: RP-09
    point: archive-only-record
    catalog_scope: [rift-lens-archive, throne-echo-record, dawnless-crown]
    balance_touch: []
    round_1:
      designer: "Archive records preserve collection/narrative state with zero combat value."
      game_pm: "Show locked → recorded and explicit 0 combat delta."
      agreement: "Never convert Archive completion into paid or hidden power."
      signed_by: [game-designer, game-pm]
    round_2:
      designer: "Keep Archive presentation separate from modifiers despite anchor-shard-archive naming."
      game_pm: "Telemetry must include reward kind to avoid ID/name ambiguity."
      agreement: "Zero numeric delta retained."
      signed_by: [game-designer, game-pm]

  - id: RP-10
    point: first-clear-stage-progression
    catalog_scope: [resolvedIds, achievementIds, unlockedStageIndex, lastResolution]
    balance_touch: [stage_access]
    round_1:
      designer: "First victory unlocks the next authored stage; defeat grants no stage reward."
      game_pm: "All ten stages remain free and offline; no timer, ticket, or purchase."
      agreement: "Nine next-stage transitions plus Gate Zenith final completion."
      signed_by: [game-designer, game-pm]
    round_2:
      designer: "Stage identity requires distinct paths, flanks, elevation, hazards, occupation, and wave pressure; current authored tactics remain candidate balance."
      game_pm: "Count catalog stage/tactic access only; post-tuning current-head win rate, viability, boss TTK, mandatory-order clears, and full combo acquisition require a frozen final QA packet."
      agreement: "Free tactical parity target 10–20 sessions; campaign completion and reward cadence are measured separately after gate-valid loop ordering."
      signed_by: [game-designer, game-pm]

  - id: RP-11
    point: bounded-domain-comeback
    catalog_scope: [W-04]
    balance_touch: [comeback_offer_probability, activation_count, terminal_reversal]
    round_1:
      designer: "Domain is deterministic, simulation-owned, and bounded to at most one activation per run."
      game_pm: "Free only; eligible-run offer probability ≤0.30 and conditional reversal probability ≤0.30."
      agreement: "No paid trigger, refresh, cooldown bypass, or second activation."
      signed_by: [game-designer, game-pm]
    round_2:
      designer: "Current runtime has no Domain state; target acceptance is not implementation evidence."
      game_pm: "Forecast baseline is 0 events until catalog state, seeded roll, and telemetry ship."
      agreement: "Activation cap 1; both probabilities capped at 0.30; G5 remains FIX."
      signed_by: [game-designer, game-pm]

  - id: RP-12
    point: derived-stat-and-synergy-presentation
    catalog_scope: [ITEMS, SKILLS, COMPANIONS, REWARDS]
    balance_touch: [displayed_stat_delta, measured_combo_ev]
    round_1:
      designer: "Run items, skills, stats, synergies, companions, stage rewards, and Archive must remain distinct."
      game_pm: "Every balance-touching choice displays current → upgraded raw values."
      agreement: "No vague power grades and no monetized comparison."
      signed_by: [game-designer, game-pm]
    round_2:
      designer: "Synergy labels require measured combined EV, not inferred marketing copy."
      game_pm: "Reject any combination above 1.30× median pending a single-lever catalog retune."
      agreement: "Presentation may observe only; simulation owns all effects and seeded randomness."
      signed_by: [game-designer, game-pm]
```

## Signature scope

`game-designer` confirmed both rounds and the listed bounds, with current → upgraded presentation required and measurement still pending. `game-pm` accepts the same conditions. This record freezes reward/fairness targets; it does not authorize game-code changes, commerce, or a gate PASS. An under-cap raw proxy never overrides missing pair acquisition, incomplete TTK coverage, failed viability, or unmeasured parity.