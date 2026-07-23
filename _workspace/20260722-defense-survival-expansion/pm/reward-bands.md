# Reward bands — no-commerce fairness contract

```yaml
contract_version: pm-reward-bands-v2
rules_version: defense-survivor-v1
acquisition:
  path: free-play
  commerce_present: false
  paid_power_present: false
  paid_rerolls_or_recovery: false
  growth_choices_per_offer: 3
  predicted_growth_offers_per_clear: [2, 4]
  elite_item_opportunities_per_stage: 1
  elite_extraction_opportunities_per_stage: 1
  occupation_opportunities_per_stage: 1
  occupation_hold_ticks_band: [180, 360]
  occupation_move_multiplier_band: [1.04, 1.08]
  occupation_range_multiplier_band: [1.06, 1.12]
  occupation_recovery_per_second_band: [4, 12]
  extraction_window_ticks: 600
  boss_reward_choices_presented_per_clear: 3
  boss_rewards_selected_per_clear: 1
  first_clear_stage_unlocks: 1
separation:
  run_items_persist: false
  growth_skills_persist: false
  extracted_companions_persist: true
  stage_rewards_persist: true
  archive_numeric_combat_delta: 0
  companion_loadout_max: 3
  companion_evolution_band: [1, 3]
steady_progression:
  free_tactical_parity_sessions_band: [10, 20]
  parity_definition: "free players have equivalent access to each core tactical family; campaign completion is measured separately"
  current_paid_comparator: none
  current_structural_paid_free_delta_pp: 0
fairness:
  paid_free_winrate_delta_max_pp: 5
  campaign_winrate_band: [0.45, 0.55]
  boss_ttk_tolerance_fraction: 0.15
  combo_ev_cap_vs_median: 1.30
  tested_archetypes_min: 5
  viable_archetypes_min: 3
occupation_candidate:
  persistent: false
  deterministic_simulation_owned: true
  validation_status: "signed round-2 candidate; narrow spatial/rate/counter semantics verified; final post-tuning current-head mandatory-loop and G2/G3/G5 evidence pending"
  adoption_condition: "pass G2/G3/G5 with 45–55% wins, at least three viable archetypes, complete ±15% boss-TTK coverage, accepted full combo EV, and mandatory elite/item/growth/occupation/extraction ordering"
comeback:
  name: Domain
  implementation_status: "W-04 design state only; no current catalog/simulation/campaign field"
  deterministic_simulation_owned: true
  acquisition_path: free-play
  paid_trigger_allowed: false
  activation_cap_per_run: 1
  offer_probability_max: 0.30
  reversal_probability_max: 0.30
  probability_denominator: "eligible runs only"
  baseline_forecast_events: 0
  release_rule: "do not count or present Domain until catalog-backed state, deterministic seeded roll, and telemetry exist"
presentation:
  require_current_to_upgraded_values: true
  separate_rows: [run_item, growth_skill, stat, synergy, extracted_companion, stage_reward, archive]
```

## Interpretation

- The `10–20` session band is a measured free-progression parity window, not a grind target and not evidence that the current build has passed G5. With no paid comparator, paid/free parity is structural only; session telemetry must still prove free tactical access cadence.
- The `≤5 pp` fairness limit is a hard maximum for any future gameplay-affecting comparison. The current build must not create such a comparison; its product contract remains `0 pp` paid advantage.
- Domain is a bounded comeback, never a purchase, ad reward, login reward, pity purchase, or account entitlement. Even after implementation it may activate at most once per run; both eligible-run offer probability and conditional reversal probability are capped at `0.30`.
- A “reversal” means an eligible disadvantaged run moves from its pre-Domain loss prediction to a terminal victory. Gate recovery without terminal victory is not counted as a reversal.
- Rewards are rebalanced only in `defense-catalog.js`. Any change must retain win rate `45–55%`, boss TTK within `±15%`, combo EV `≤1.30×` median, and at least three viable results across five tested archetypes. Candidate occupation bands and the progression forecast are not gate evidence. Current-head balance, mandatory-order, and all-pair combo measurements must be frozen together after the final approved tuning lever before any PASS claim.

## Current → upgraded display requirements

| family | required before/after values |
|---|---|
| growth skill | owned/rank state plus damage, cooldown, radius, integrity, basic damage, or pickup range actually changed |
| run item | commander/Gate current value → post-pickup value and “run only” label |
| stat | raw pre-value → raw post-value; percent and ticks must not be mixed |
| synergy | each component’s value plus combined measured EV versus median; never a vague “stronger” tag |
| extracted companion | loadout slot and companion damage/fire ticks/range; evolution record shown separately |
| stage reward | unowned/owned state and next-run modifier value |
| Archive | locked → recorded and explicit `0 combat delta` |

## Evidence rule

Targets are not PASS results. Current-catalog command `node _workspace/20260722-defense-survival-expansion/qa/run-final-g5.mjs /Users/jangyoung/orca/Abyssal-Surge/results/defense-final-g5-no-commerce.json` generated `results/defense-final-g5-no-commerce.json` at `2026-07-22T11:58:08.421Z`: `20/20` nominal free/paid initial-and-terminal pairs matched with `0 pp` structural delta; all ten stages/tactics were reachable through the authored free path in `10` successful sessions, inside the `10–20` target; all `11/11` primary balance-touching revenue points audited by the runner had signed R1/R2; and the commerce-source audit was clean. Domain remains design-only with baseline `0` events, cap `1`, and offer/reversal caps `0.30`, but no runtime state or cooldown exists. Therefore G5 remains `FIX`: authored reachability is not observed p50/p90 session parity, Domain has no cadence evidence, and G2 is not closed.