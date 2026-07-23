# No-commerce reward and progression forecast

## Forecast boundary

This is a measurable **reward-cadence and free-progression forecast**, not a sales forecast. The public beat contains no commerce, accounts, network, ads, premium currency, or paid entitlements. Contract financial revenue is therefore `$0`; ARPU, conversion, payer mix, and purchase revenue are not applicable and must not be fabricated.

Forecast source is current `defense-catalog.js` plus campaign state in `campaign-state.js` under `defense-survivor-v1`. Values below are predictions until current-head local telemetry or deterministic simulations confirm them.

## Assumptions and counting rules

- One session is one started run attempt.
- A clear means `VICTORY` or `FINAL_COMPLETION`.
- Predicted growth offers assume the player collects all authored non-boss XP before terminal and selects each offer. Boss XP is excluded because terminal resolution occurs on boss death.
- Each stage authors one occupation point, one elite item, one extraction opportunity, and three terminal reward choices. A clear permits one terminal reward selection.
- Occupation capture assumes the player holds the actual stage point for its authored `180–360` ticks. Extraction succeeds only if the player sends `EXTRACT_ELITE` within the actual 600-tick candidate window. Forecast capacity is not a success claim.
- Domain has no current catalog/simulation/campaign state, so its baseline forecast count is `0`.
- Presentation of stats/synergies does not create another reward event; it must display the simulation-owned before/after result.
 
### Current-head evidence boundary

The table below is **authored full-clear capacity**, not validated cadence or a G2/G3/G5 PASS. Final evidence must be generated after the last approved deterministic tuning lever and must report five-archetype win rate, terminal/replay completeness, per-stage boss-TTK coverage, mandatory Gate → Echo → growth → occupation → extraction → boss order, and normalized combo acquisition status. Provisional matrix snapshots are preserved as history but are not forecast evidence.

## Ten-stage cadence

| # | actual stage ID | growth | occupation: hold ticks; move/range/recovery | run item | extraction: elite → companion | terminal reward choices (select 1) |
|---:|---|---:|---|---|---|---|
| 1 | `cinder-span` | 2 | `cinder-seal`: 180; ×1.05/×1.08/+4s⁻¹ | `ashen-sigil` | `s1-ember-hunter` → `ember-cohort` | `ember-cohort-legacy`, `stillwater-hourglass`, `bulwark-brand` |
| 2 | `veil-citadel` | 2 | `veil-signal`: 210; ×1.04/×1.10/+5s⁻¹ | `ward-splinter` | `s2-veil-sentinel` → `rift-lens` | `rift-lens-archive`, `anchor-shard-archive`, `abyssal-banner` |
| 3 | `echo-throne` | 3 | `throne-domain`: 240; ×1.06/×1.08/+6s⁻¹ | `echo-compass` | `s3-throne-wraith` → `throne-echo` | `throne-echo-record`, `veil-vanguard-legacy`, `stillwater-hourglass` |
| 4 | `sunken-bastion` | 3 | `bastion-pump`: 240; ×1.05/×1.08/+7s⁻¹ | `hourglass-fragment` | `s4-anchor-diver` → `anchor-shard` | `anchor-shard-archive`, `bulwark-brand`, `abyssal-banner` |
| 5 | `howling-sprawl` | 3 | `sprawl-beacon`: 270; ×1.08/×1.06/+6s⁻¹ | `ashen-sigil` | `s5-pack-sentinel` → `veil-vanguard` | `veil-vanguard-legacy`, `ember-cohort-legacy`, `rift-lens-archive` |
| 6 | `glass-necropolis` | 3 | `glass-choir`: 270; ×1.04/×1.12/+7s⁻¹ | `ward-splinter` | `s6-choir-adept` → `throne-echo` | `rift-lens-archive`, `stillwater-hourglass`, `anchor-shard-archive` |
| 7 | `starless-canal` | 3 | `canal-toll`: 300; ×1.07/×1.08/+8s⁻¹ | `echo-compass` | `s7-toll-keeper` → `anchor-shard` | `abyssal-banner`, `bulwark-brand`, `throne-echo-record` |
| 8 | `shattered-causeway` | 3 | `causeway-brace`: 300; ×1.05/×1.10/+9s⁻¹ | `hourglass-fragment` | `s8-keystone-warden` → `ember-cohort` | `ember-cohort-legacy`, `veil-vanguard-legacy`, `abyssal-banner` |
| 9 | `abyss-chancel` | 4 | `chancel-oath`: 330; ×1.05/×1.11/+10s⁻¹ | `ashen-sigil` | `s9-oathbound-signatory` → `dawnless-crown` | `dawnless-crown`, `throne-echo-record`, `bulwark-brand` |
| 10 | `gate-zenith` | 3 | `zenith-last-seal`: 360; ×1.06/×1.12/+12s⁻¹ | `dawnless-crown-shard` | `s10-regent-herald` → `dawnless-crown` | `dawnless-crown`, `throne-echo-record`, `rift-lens-archive` |

### Full first-clear-path projection

| measure | predicted capacity across ten clears | measurable acceptance |
|---|---:|---|
| growth offer/selections | `29` | observed `GROWTH_OFFER` and `SKILL_SELECTED` counts, by stage, should match the collected-XP path or explain missed XP |
| occupation opportunities/captures | `10 / up to 10` | one canonical `STAGE_TACTICS.*.occupation` per stage; progress/capture and each before/after effect required |
| elite item opportunities/collections | `10 / up to 10` | exactly one authored item opportunity per stage; collection rate reported separately |
| extraction opportunities/successes | `10 / up to 10` | one candidate per stage; success and expiry separated |
| fixed boss reward choice slots shown | `30` | three canonical IDs on every clear |
| boss reward selections | `10` | one selection on every clear; `alreadyOwned` distinguishes duplicates |
| distinct persistent reward IDs available | `9` | six balance-touching IDs plus three zero-power Archive IDs |
| unique extracted companion prototypes available | `6` | `ember-cohort`, `rift-lens`, `veil-vanguard`, `anchor-shard`, `throne-echo`, `dawnless-crown` |
| duplicate extraction evolution opportunities | `4` | second captures of `ember-cohort`, `throne-echo`, `anchor-shard`, and `dawnless-crown`; runtime records evolution but defines no extra numeric scaling |
| campaign progression resolutions | `10` | nine next-stage unlock transitions plus `gate-zenith` final completion |
| Domain events | `0` baseline | cannot increase until deterministic simulation-owned eligibility, seeded roll, activation, and reversal events exist |

A player following the full-clear assumptions sees `69` balance/reward interactions (`29` growth + `10` occupation + `10` item + `10` extraction opportunity + `10` boss selection), or `6–8` per cleared stage. Campaign resolution adds a separate progression state transition per clear. Only the exact final post-tuning current-head matrix can validate this projection.

## Persistent reward supply

The terminal pool contains exactly these nine `REWARDS` IDs:

- Balance-touching: `ember-cohort-legacy`, `veil-vanguard-legacy`, `stillwater-hourglass`, `bulwark-brand`, `anchor-shard-archive`, `abyssal-banner`.
- Zero-power Archive: `rift-lens-archive`, `throne-echo-record`, `dawnless-crown`.

Across all stage offer tables, appearances are: `bulwark-brand` 4, `abyssal-banner` 4, each zero-power Archive record 2–4, and each remaining balance reward 3. Appearance is not ownership: one selection is recorded per clear and duplicate reward IDs do not create another persistent copy.

The player can first access every persistent **effect family** by clearing stages 1–2: starting companion/cooldown/Gate reduction at `cinder-span`, and integrity/companion damage/Archive at `veil-citadel`. This is a catalog-access observation, not a parity PASS.

## Free progression and fairness forecast

| metric | target/forecast | status |
|---|---|---|
| acquisition path | 100% `free-play` | structural contract |
| paid/free win-rate delta | current structural `0 pp`; hard maximum `≤5 pp` if a future comparison exists | current-catalog G5 receipt: `20/20` nominal pairs match initial/terminal public state, labels never enter gameplay APIs, measured structural delta `0 pp`; no paid cohort; G5 `FIX` |
| tactical parity | equivalent core tactical-family access in sessions `10–20` | authored successful free path reaches all ten stages/tactics in `10` sessions; within band, but p50/p90 observed player parity is not measured |
| campaign win rate | `45–55%` | fresh post-Aegis current-head five-archetype measurement pending; G2 `FIX` |
| boss TTK | per-stage target `±15%` | fresh post-Aegis reference-loadout per-stage measurement pending; G2 `FIX` |
| combo EV | `≤1.30×` median | pre-Aegis `200/200` acquisition/replay normalized result failed at `1.4081019050×`; fresh post-Aegis normalized measurement pending; G2 `FIX` |
| Domain activation cap | `≤1` per run after implementation | current baseline `0`; not implemented |
| Domain eligible-run offer probability | `≤0.30` | current baseline `0`; not implemented |
| Domain conditional reversal probability | `≤0.30` | current baseline `0`; not implemented |

### Current-catalog G5 receipt

Exact command:

`node _workspace/20260722-defense-survival-expansion/qa/run-final-g5.mjs /Users/jangyoung/orca/Abyssal-Surge/results/defense-final-g5-no-commerce.json`

Artifact: `results/defense-final-g5-no-commerce.json`, generated `2026-07-22T11:58:08.421Z`. Evidence boundary is public catalog, campaign, and simulation APIs only. Across seeds `1–20`, the runner created one nominal `free` and one nominal `paid` label per seed but passed neither label to gameplay APIs: all `20/20` initial campaign/run and terminal run pairs matched and structural delta was `0 pp`. The authored free path reached all ten stages and tactics in exactly `10` successful sessions, within the signed `10–20` band, but this is not observed p50/p90 player telemetry. The runner audited `11/11` primary balance-touching revenue points with signed R1/R2 and found zero commerce-source hits. Domain remains absent from catalog/runtime, baseline events stay `0`, and signed limits remain cap `1`, offer `≤0.30`, reversal `≤0.30`. Verdict remains `FIX`, not `PASS`.

Ten first-clear victories are the fastest complete campaign path: ten winning sessions. At the target win-rate band, the naive expected attempts for ten wins are about `18.2` at 55%, `20.0` at 50%, and `22.2` at 45%. Therefore **campaign completion cannot be promised inside 20 sessions at the low edge**. The `10–20` fairness contract is deliberately defined as tactical parity, while campaign completion distribution is reported separately. Any telemetry showing p90 tactical parity after session 20 is a G5 failure requiring reward-access retuning, not a reason to widen the band.

If Domain is later implemented and all ten runs are eligible, offer probability `≤0.30` implies at most `3.0` expected offers/activations across those ten eligible runs, before player non-activation. Conditional reversal `≤0.30` then implies at most `0.9` expected reversals under the maximum-offer model. These are caps, not desired rates, and the deterministic seeded roll must make them reproducible.

## Required local telemetry fields

Telemetry stays local/debug-export only, versioned, and contains no account or network player identifier.

### Common run envelope

| field | purpose |
|---|---|
| `schema_version`, `rules_version` | prevent cross-version aggregation |
| `local_session_index`, `local_run_index`, `run_id` | measure 10–20-session parity without an account |
| `stage_id`, `seed`, `tick`, `event_type` | reproduce deterministic 60 Hz cadence |
| `archetype_id` | separate the five required play styles |
| `acquisition_path` = `free-play`, `commerce_present` = `false`, `paid_entitlement` = `false` | prove no paid-power path entered simulation |

### Echo, growth, item, and synergy

- `xp_before`, `xp_gained`, `xp_after`, `growth_level`, `offer_skill_ids`, `selected_skill_id`, `offer_tick`, `selection_tick`.
- `item_id`, `item_candidate_tick`, `item_collected_tick`, `stat_key`, `value_before`, `value_after`, `duration_scope = run`.
- `owned_skill_ids`, `owned_item_ids`, `companion_loadout_ids`, `derived_combo_id`, `combo_ev`, `median_combo_ev`, `combo_ev_ratio`.
- `boss_id`, `boss_spawn_tick`, `boss_defeat_tick`, `boss_ttk_ticks`, plus run `outcome`.

### Occupation/extraction and companions

- `elite_id`, `prototype_id`, `candidate_tick`, `expires_at_tick`, `extraction_attempted`, `extraction_result`, `extraction_tick`, `failure_reason`.
- `occupation_point_id`, `occupation_state`, `hold_ticks`, `max_hold_ticks`, `movement_before/after`, `range_before/after`, `recovery_before/after`; narrow probes verify catalog-rate recovery and capped hold semantics, but exports are not cadence evidence until mandatory loop order and G2/G3/G5 gates pass.

### Stage reward, Archive, and campaign

- `reward_choice_ids`, `selected_reward_id`, `reward_kind`, `already_owned`, `reward_ids_before/after`.
- `stat_key`, `value_before`, `value_after`; Archive events instead emit `combat_delta = 0` and `archive_state_before/after`.
- `resolved_ids_before/after`, `achievement_id`, `unlocked_stage_index_before/after`, `last_resolution_outcome`, `campaign_complete`.
- `dawnless-crown` events must include `entity_kind = companion|reward` because that ID exists in both catalog maps.

### Domain comeback, once implemented

- `domain_eligible`, `eligibility_reason`, `gate_integrity_ratio`, `pre_domain_loss_prediction`, `offer_roll_seed`, `offer_roll_value`, `offered`, `activation_count_before/after`, `activated_tick`, `terminal_outcome`, `reversal`.
- Aggregates: eligible runs, offers/eligible run, activations/run, reversals/activation, win rate with/without Domain by stage/archetype, and p95 confidence intervals.
- Reject export if `activation_count_after > 1`, any Domain acquisition path is not `free-play`, offer rate exceeds `0.30`, or reversal rate exceeds `0.30` after the predeclared minimum sample.

## Decision thresholds

1. Cadence passes only when every stage has at least one collected reward event, observed fixed touchpoints match authored mappings, and unexplained ID/state mismatches are zero.
2. Tactical parity passes only when p50 and p90 first-equivalent-access session indices both fall in `10–20`, with the cohort definition frozen before collection.
3. Fairness passes only with five archetypes, at least three viable, win rate `45–55%`, complete boss-TTK coverage within `±15%`, accepted full combo EV `≤1.30×` median, and paid/free delta `≤5 pp`. With no paid cohort, report “no paid comparison” rather than inventing samples.
4. Occupation semantics pass narrow deterministic probes, but cadence remains unverified until the exact final post-tuning current-head matrix establishes mandatory order and G2/G3/G5 evidence. Domain cadence stays `0/unimplemented` until simulation-owned deterministic state and local export evidence exist.
