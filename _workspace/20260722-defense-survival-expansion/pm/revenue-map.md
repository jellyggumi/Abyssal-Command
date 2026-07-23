# No-commerce economy and reward map

## Commercial boundary

This public beat has **no commerce**: no price, premium currency, store, purchase SDK, account, ad reward, paid entitlement, paid reroll, paid recovery, or network dependency. Every gameplay-affecting value is earned through the deterministic offline run and local campaign save. Financial revenue for this build is therefore `0` by contract; “revenue point” below means a player-value/reward point, not a transaction.

No paid power is preserved by four invariants:

1. `acquisition_path` is always `free-play`.
2. The current paid/free win-rate delta is structurally `0 pp` because no paid cohort or entitlement exists. The current-catalog G5 receipt confirms `20/20` nominal free/paid pairs have identical initial and terminal public state, while passing no label into gameplay APIs. G5 remains `FIX`, not `PASS`, because observed session parity is absent and Domain intentionally has no runtime state.
3. Any future non-gameplay commercial proposal requires a new designer ↔ PM negotiation. It may not change simulation input, reward odds, stats, stage access, companion access, Archive power, Domain eligibility, or recovery.
4. If a future proposal creates any gameplay-affecting comparison despite rule 3, free players must reach equivalent tactical choice access in `10–20` sessions and the measured paid/free win-rate delta must be `≤5 pp`.

## Implemented reward flow

| ID | player reward point | implemented source/state | persistent? | balance touch | current → upgraded presentation |
|---|---|---|---:|---|---|
| `RP-01` | Echo recovery → three-choice growth | `XP_GROWTH`; `GROWTH_OFFER`; `SKILL_SELECTED`; eight `SKILLS` IDs | no | damage, cooldown, radius, integrity, pickup range | show the affected current value and catalog value after selection; never merge skill, item, stat, or synergy rows |
| `RP-02` | elite run item | `STAGE_ITEM_IDS`; `ITEM_COLLECTED`; five `ITEMS` IDs | no | basic damage, Gate integrity, pickup range, cooldown scale | show current → post-item value and “this run” duration |
| `RP-03` | occupation/extraction opportunity | ten `STAGE_TACTICS.*.occupation` states; `OCCUPATION_PROGRESS`/`OCCUPATION_CAPTURED`; `ELITE_CANDIDATE_AVAILABLE`; `ELITE_EXTRACTED` | extraction persists; occupation is run-only | movement `×1.04–1.08`, range `×1.06–1.12`, recovery `+4–12/s`, companion access | show hold/current state → captured effects and extraction window → resulting prototype |
| `RP-04` | extracted companion collection/loadout | `companionCollection`, evolution `1–3`, `companionLoadout.prototypeIds`, maximum loadout `3` | yes, local save | companion damage/fire interval/range | show empty/current slot → companion values; duplicate capture shows evolution record, not an invented numeric bonus |
| `RP-05` | boss stage-reward choice | `TERMINAL.rewardChoices`; `REWARD_SELECTED`; `rewardIds`; three authored options, one selection | yes, local save | companion, cooldown, Gate damage, integrity, companion damage, or zero-power Archive | show current owned state/value → selected next-run state/value |
| `RP-06` | Archive record | `rift-lens-archive`, `throne-echo-record`, `dawnless-crown` | yes, local save | exactly `0` numeric combat delta | show locked → recorded; never imply a hidden stat |
| `RP-07` | free campaign progression | `resolvedIds`, `achievementIds`, `unlockedStageIndex`, `lastResolution` | yes, local save | stage access, not combat stats | show current stage → newly unlocked stage, or final completion |
| `RP-08` | bounded Domain comeback | worldview state `W-04`; no catalog, simulation, or campaign field exists on current HEAD | no implemented persistence | future comeback probability only | baseline is unavailable → unavailable; must remain `0` forecast events until simulation-owned state exists |

The authoritative loop is **Gate defense → Echo recovery → growth → occupation/extraction → boss kill**. Current source authors all five beats, ten tactic records, seeded variation, and enemy policy IDs. Authored reward capacity is not validated cadence: current-head balance, TTK, mandatory-order, and full combo-pair evidence must come from the exact final post-tuning QA packet. Provisional matrix snapshots are historical only and must not be presented as reliable player progression.

## Catalog-backed values

### Run-only items

| catalog ID | effect |
|---|---|
| `ashen-sigil` | commander basic damage `+180` |
| `ward-splinter` | Gate maximum/current integrity `+80/+80` |
| `echo-compass` | XP pickup range `+2500` |
| `hourglass-fragment` | skill cooldown scale `−0.10`, subject to simulation clamp |
| `dawnless-crown-shard` | commander basic damage `+240`; Gate maximum/current integrity `+120/+120` |

### Run-only occupation effects — round-2 candidate bounds

`STAGE_TACTICS` provides one distinct occupation point per stage. Signed catalog candidate bounds are: hold `180–360` ticks (`3–6 s` at 60 Hz), movement `×1.04–1.08`, range `×1.06–1.12`, and recovery `+4–12/s`. Narrow deterministic probes verified catalog-rate recovery, capped progress, pre-elite extraction rejection, and remote Bind rejection. The bands remain candidate-only pending final current-head mandatory-loop and G2/G3/G5 evidence; they never persist or sell.

### Persistent companions and stage rewards

| catalog/state ID | current → upgraded value |
|---|---|
| `ember-cohort`, `rift-lens`, `veil-vanguard`, `anchor-shard`, `throne-echo`, `dawnless-crown` | absent/loadout-empty → catalog damage, `fireTicks`, and range; exact values remain in `COMPANIONS` |
| `ember-cohort-legacy` | not owned → `ember-cohort` added at run start |
| `veil-vanguard-legacy` | not owned → `veil-vanguard` added at run start |
| `stillwater-hourglass` | cooldown scale `1.00 → 0.80` before other earned reductions; owned-reward clamp remains simulation-owned |
| `bulwark-brand` | Gate damage reduction `0 → 2` |
| `anchor-shard-archive` | Gate maximum/current integrity `1000 → 1040` at run start |
| `abyssal-banner` | companion damage bonus `0 → +60` |
| `rift-lens-archive`, `throne-echo-record`, `dawnless-crown` | locked → recorded; numeric combat delta stays `0` |

`dawnless-crown` is both a companion ID and an Archive reward ID in separate catalog maps; telemetry must include `entity_kind`/`reward_kind` so those meanings are never conflated.

## Progression and fairness ownership

The simulation owns seeded randomness, offers, terrain/occupation effects, enemy policy, and 60 Hz state. `app.js` only orchestrates the offline campaign and renderers/audio only observe. Chokepaths, flanks, elevation, hazards, scout→pressure→flank→ranged→elite→boss patterns, six enemy policy intents, and occupation effects are authored. Cadence, balance, TTK, full combo EV, and session parity require the exact final post-tuning current-head QA packet. Domain remains unimplemented and stays at zero forecast events.

Archive growth is collection/progression only in this cycle. It cannot sell or silently grant power. Generated media is optional and cannot change reward eligibility or values.