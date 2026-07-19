# Revenue forecast — premium PC, zero combat monetization

**Owner:** game-pm  
**Forecast status:** **PLANNING SCENARIOS ONLY — no sales, wishlist, price, conversion, refund, regional mix, tax, platform statement, or cost actuals were provided.**  
**Forecast scope:** One premium base-game license. No microtransactions, paid combat power, paid reward, booster, revive, reroll, shortcut, premium currency, battle pass, randomized purchase, or paywall inside the campaign.

## Product-policy boundary

```yaml
commercial_model: premium-pc-single-purchase
forecast_horizon: first_12_months
combat_monetization_revenue: 0
paid_gameplay_power_delta_pp: 0
paid_free_tempo_delta_pp: 0
paid_reward_access_delta_pp: 0
included_revenue:
  - premium_base_game_unit_sales
excluded_revenue:
  - microtransactions
  - paid_combat_dlc
  - boosters
  - paid_revives
  - reward_rerolls
  - premium_progression
  - advertising
  - soundtrack_or_cosmetic_dlc_until_separately_approved
currency: USD
status: assumptions-not-forecast-facts
```

Every owner of the full game receives the same ten-stage campaign, authoritative reducer, controls, reward offers, recovery rules, and combat information. A demo may expose less content, but cannot carry a stronger or weaker reward table into the paid game. Any future edition or cosmetic must remain gameplay-identical; the required paid/free gameplay delta is `0 pp`, not the harness's generic `≤5 pp` tolerance.

## Observed evidence versus unknowns

### Observed internal evidence

- Rules v6 has ten stages and earned stage-victory rewards (`campaign-state.js:31-514, 1069-1102`). No reward purchase path is part of this forecast.
- The supplied v6 simulator output reports deterministic greedy and optimal campaign completions, deterministic rusher/comeback failures, a seeded casual-policy win rate of `40%` over `200`, `150,000` fuzz operations with `0` findings, and deterministic double-run identity (`/tmp/abyssal-balance-v6.json:18-411, 1321-1331, 1434`). These are automated baseline facts, not human retention, conversion, quality, or revenue evidence.
- The early Stage 1×Stage 2 reward-pair table reports a maximum completion-per-action ratio of `1.16845×`, but it does not cover later reward-stack parity (`/tmp/abyssal-balance-v6.json:413-427, 1102-1105`).

### External platform facts used only to shape the model

- Valve's official pricing documentation says Steam supports a single full-game purchase, that partners set and manage their own pricing, and that pricing decisions should consider playtime, replayability, comparable games, and future promotions. It also says regional prices are set across supported currencies rather than inferred from one USD sticker price: <https://partner.steamgames.com/doc/store/pricing>.
- Valve's official wishlist documentation says wishlists express interest and produce release/discount notifications, but explicitly says there is **no formula to accurately predict sales from wishlists**: <https://partner.steamgames.com/doc/marketing/wishlist>.
- Valve's official refund policy permits refund requests broadly and describes the standard games window as within 14 days and under two hours of play, while noting additional review and jurisdictional rights: <https://store.steampowered.com/steam_refunds/>. Therefore the model uses realized ASP after refunds rather than treating list price × gross units as collectible revenue.

### Unknown at this discovery gate

```yaml
unknown_inputs:
  approved_usd_list_price: null
  regional_price_table: null
  launch_discount: null
  wishlists_total: null
  demo_unique_players: null
  demo_completion_rate: null
  store_page_visits: null
  unit_sales_actual: null
  refund_rate: null
  regional_sales_mix: null
  realized_asp: null
  contractual_platform_remittance_rate: null
  taxes_and_withholding: null
  publisher_recoup_or_revenue_share: null
  marketing_spend: null
  development_cost_to_recoup: null
  post_launch_support_cost: null
```

No output below is an actual forecast until those inputs have owners, dates, and source reports.

## Parametric forecast model

Use platform finance reports as the authority after launch. Until then:

```text
Gross customer receipts = paid units × realized ASP
Illustrative platform-adjusted receipts = gross customer receipts × remittance assumption
Contribution before fixed-cost recoup = platform-adjusted receipts − variable support/fulfilment costs
Break-even paid units = fixed costs to recoup ÷ contribution per paid unit
```

`realized ASP` must already reflect regional mix, discounts, refunds, and applicable customer-price effects to avoid double counting. `remittance assumption` is a placeholder for sensitivity analysis only; the executed distribution agreement and platform statements control.

## Twelve-month planning scenarios — assumptions, not predictions

The rows deliberately span a wide range because no demand evidence was supplied. The `70%` remittance factor is an **illustrative assumption**, not a claimed Steam contract term. No taxes, withholding, publisher share, chargebacks outside realized ASP, fixed development cost, marketing spend, or support cost is deducted.

| Scenario | Assumed paid units | Assumed realized ASP | Assumed remittance factor | Illustrative gross receipts | Illustrative platform-adjusted receipts | Confidence label |
|---|---:|---:|---:|---:|---:|---|
| Downside planning case | `20,000` | `$22.49` | `70%` | `$449,800` | `$314,860` | Hypothesis only |
| Operating planning case | `60,000` | `$25.49` | `70%` | `$1,529,400` | `$1,070,580` | Hypothesis only |
| Upside capacity case | `150,000` | `$27.99` | `70%` | `$4,198,500` | `$2,938,950` | Hypothesis only |

These rows are capacity and cash-planning examples, not probability-weighted outcomes. The operating case is not “expected,” and the upside case is not a target. Do not combine them into a weighted forecast until product leadership supplies scenario probabilities grounded in store and campaign evidence.

## Sensitivity grid

Illustrative gross receipts before any remittance, costs, or taxes:

| Paid units \ realized ASP | `$19.99` | `$24.99` | `$29.99` |
|---:|---:|---:|---:|
| `10,000` | `$199,900` | `$249,900` | `$299,900` |
| `25,000` | `$499,750` | `$624,750` | `$749,750` |
| `50,000` | `$999,500` | `$1,249,500` | `$1,499,500` |
| `100,000` | `$1,999,000` | `$2,499,000` | `$2,999,000` |

The sensitivity grid is arithmetic under explicit assumptions. It does not recommend a list price. The price decision remains pending a comparable-title survey, player-value evidence for campaign length/replayability, regional pricing review, and an approved cost/positioning brief.

## Revenue consistency with strategy depth

Reward tuning is a quality and retention input, never a saleable advantage. The commercial model fails policy review if revenue can increase by making a combat build stronger, hiding a fair build behind an edition, or selling recovery from a difficulty spike.

| Gameplay signal | Current evidence | Revenue-use rule | Prohibited response |
|---|---|---|---|
| Echo Throne defeat concentration | Seeded casual bot: `78/120` defeats at Echo Throne | Treat as a demo/full-game comprehension and balance investigation; measure human funnel before connecting to refund/support risk. | Sell a revive, early reward, easy-build pack, cooldown boost, or stage skip. |
| Deterministic greedy/optimal completion | Both complete; `116` versus `103` actions | Use as automated regression context only. | Market one scripted policy as proof of replayability or guaranteed value. |
| Early reward pair ratio | `1.16845×` max versus pair median | Preserve build diversity and expand coverage across Stages 3–9. | Put the stronger pair in a premium edition. |
| Stage 3 zero-effect rewards | Source-defined empty effects with seven stages remaining | Clarify commemorative intent or redesign within earned reward budgets after designer signoff. | Sell a “real” Stage 3 reward or premium archive power. |
| Input/feedback target | Contract target p95 `≤100 ms`; measurement not supplied here | Treat responsiveness as a release-quality requirement for every buyer and input method. | Offer input assists, command queues, information, or lower latency as paid benefits. |

## Evidence-gated forecast refreshes

| Forecast gate | Required source | Minimum fields | Allowed model change |
|---|---|---|---|
| Pricing gate | Approved pricing brief plus Steamworks regional price export | USD list price, regional prices, launch discount, effective date | Replace ASP range with regional weighted planning range; still mark assumptions. |
| Demand gate | Steamworks wishlist/traffic report | wishlists, net adds, store visits, regions, dates, UTM/source | Build demand scenarios; do not use a universal wishlist conversion formula. |
| Demo gate | Store/demo report plus privacy-safe campaign telemetry | downloads, starts, stage reach, completion, sessions, median/p95 feedback latency, input modality | Segment interest and quality risks; no paid combat offer. |
| Balance gate | QA all-stage reward matrix and human playtest | build, stage outcomes, choice shares, entropy, retries, reversal rate, clear time | Adjust retention/refund risk narrative, not combat monetization. |
| Launch gate | Platform sales/finance report | gross units, refunds, net units, realized ASP, region, remittance, taxes | Replace hypotheses with actuals, retaining source date and reporting basis. |
| Cost gate | Finance-approved cost ledger | fixed costs, variable support, marketing, publisher/contract shares | Add contribution and break-even; never infer missing costs. |

## Telemetry contract for commercial learning without pay-to-win

### Store/platform authority

- Daily store-page impressions/visits by source and region.
- Wishlist additions, deletions, purchases, and notification campaign results from the platform report.
- Demo licenses/downloads, launches, and full-game acquisitions using platform-provided aggregate reporting.
- Gross sales, refunds, net units, realized ASP, regional/currency mix, taxes/withholding, and remittance from finance statements.

### Privacy-safe in-game quality telemetry

- Pseudonymous install/run IDs; rules/build version; stage start/end/retry/defeat.
- Reward offered/chosen and effective post-clamp value; no price or entitlement signal enters the campaign reducer.
- Full reward build, choice entropy, clear time, action count, boss assaults, breaches, integrity/aegis, and Domain activation/outcome window.
- Command input and visible-feedback monotonic timestamps by keyboard/pointer/touch/controller; p50/p95/p99; authoritative action result parity.
- Renderer, frame-rate bucket, and hardware performance bucket only to diagnose quality and responsiveness, with retention limits and disclosure.

### Required separation

Commercial events and campaign events may join only in aggregate analysis under the privacy policy. The gameplay reducer must never read purchase, edition, wishlist, region, price, marketing source, refund eligibility, or cosmetic ownership. A failed entitlement service must not change reward availability or action outcomes.

## Stage 3 operating forecast bands

These are **decision thresholds**, not observed values:

```yaml
stage3_readiness_inputs:
  command_to_visible_feedback_p95_ms_max: 100
  authoritative_action_input_divergence_max: 0
  paid_free_gameplay_delta_pp: 0
  telemetry_schema_coverage_required: 1.00
  stage_reward_zero_effect_rate_max_excluding_terminal_commemoration: 0.05
  normalized_reward_choice_entropy_target_min: 0.75
  domain_reversal_probability_max: 0.30
forecast_quality:
  actual_sales_inputs_required_before_expected_case: true
  scenario_probabilities_required_before_weighting: true
  contractual_remittance_required_before_net_revenue_claim: true
  cost_ledger_required_before_break_even_claim: true
```

The supplied v6 simulation is useful readiness evidence but does not satisfy these human, telemetry, commercial, or responsiveness gates.

## Decision

Retain a single-purchase premium PC model. Forecast only base-game unit sales until evidence supports another cosmetic/noncombat product and it passes a separate zero-delta review. No reward, cooldown, damage, aegis, recovery, stage access, control quality, tactical information, or authoritative campaign action is a revenue point. Current numeric revenue rows remain explicitly hypothetical; there is no expected-case revenue claim in this artifact.
