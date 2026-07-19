# Reward bands — ten-stage strategy-depth audit

**Owner:** game-pm  
**Operating mode:** Stage 2 balance cycle entering Stage 3 responsiveness/performance  
**Authority audited:** `campaign-state.js`, `RULES_VERSION = "abyssal-surge-rules-v6"`  
**Status:** **SOURCE AUDIT COMPLETE; V6 SIM BASELINE OBSERVED; PROPOSED CAPS NOT MEASURED.** Source-defined effects and the cited simulator output are observed facts. Risk labels, caps, human fairness, and parity thresholds remain recommendations until the designer accepts them and QA runs the expanded all-stage reward matrix plus playtests.

## Product-policy and gate block

```yaml
gate: G5
status: NOT-RUN
commercial_model: premium-pc-base-game
fairness:
  paid_gameplay_power: prohibited
  paid_free_winrate_delta_required_pp: 0
  paid_free_tempo_delta_required_pp: 0
  paid_reward_access_delta_required_pp: 0
  cosmetic_information_or_control_advantage: prohibited
comeback:
  reversal_probability_max: 0.30
  activation_cap: "1 earned activation per stage; never purchasable"
  integrity_restore_per_activation_max: 4
  aegis_grant_per_activation_max: 2
  total_aegis_available_per_stage_max: 3
steady:
  paid_shortcut: prohibited
  paid_free_parity: "immediate and exact; no paid gameplay path"
build_parity:
  combo_effectiveness_vs_median_hard_cap: 1.30
  clear_time_spread_p50_max: 0.20
  equal_skill_winrate_spread_max_pp: 10
  normalized_choice_entropy_target_min: 0.75
verification_owner: game-qa
verification_status: "V6 baseline observed; proposed caps, human fairness, and all-stage build parity NOT-RUN"
```

The harness's generic `≤5 pp` paid/free win-rate gate is superseded here by the stricter product policy: **the allowed delta is exactly `0 pp`**. Premium purchase may grant access to the base game, but no second purchase, DLC, cosmetic, preorder item, edition, or entitlement may alter combat power, tempo, information, controls, recovery, reward access, or campaign state.

## Observed implementation facts

- The campaign defines ten ordered stages in `STAGES` (`campaign-state.js:31-514`). A stage victory permits exactly one reward from that stage; `chooseReward` appends that reward, calculates the next-stage entry state, and advances (`campaign-state.js:1069-1102`).
- Reward effects aggregate for the whole remaining campaign. Multipliers multiply; damage, counter reduction, summon bonuses, and entry aegis add; `autoExtract` is sticky (`campaign-state.js:648-679`).
- The public cooldown benefit is clamped to `50%` (`campaign-state.js:686-702`), and `app.js:2113-2115` applies that clamped value to live command cooldown duration.
- Base Materialize summons `2` shades for `2` souls, capacity starts at `10`, and the reward bonus is added before the capacity clamp (`campaign-state.js:16-20, 746-763, 978-982`).
- Counter reduction has a final floor of `1`; aegis instead negates an entire breach or counterblow (`campaign-state.js:831-839, 882-903, 905-918`).
- Between-stage integrity is the maximum of carried integrity plus reward restore plus targeted entry recovery and an entry floor, capped at `10`. The default floor is `4`; Glass Necropolis declares `7` (`campaign-state.js:270-272, 1084-1099`).
- Lord's Domain is node-gated and limited to one use in every stage that defines it. Current grants are `+3/+4` integrity and `2` aegis in Stages 7–9 and `+4` integrity and `3` aegis in Stage 10 (`campaign-state.js:329, 380, 431, 482, 947-997`).

These observations describe arithmetic and guards only. They do not establish that any build is fair, dominant, fun, or viable.

## Observed v6 simulator baseline

The current deterministic simulator was run outside this PM documentation task and its JSON result was supplied at `/tmp/abyssal-balance-v6.json`. The simulator declares that it derives arithmetic from public stage definitions and the reward-benefit API and explicitly says it does **not** measure player time, fairness, or live-session behavior (`scripts/run-campaign-balance-sim.mjs:1-30`).

| Probe | Observed v6 result | What it establishes | What it does not establish |
|---|---|---|---|
| Deterministic rusher | `0%`, defeated at Echo Throne after `20` actions | This scripted policy fails at the Stage 3 pressure point (`/tmp/abyssal-balance-v6.json:18-23`). | A human rusher's win rate or whether the lesson is readable. |
| Deterministic comeback | `0%`, defeated at Howling Sprawl after `47` actions | The current scripted comeback policy does not recover through Stage 5 (`:297-302`). | Domain reversal probability; the probe reports Domain was used from integrity `8`, outside this artifact's low-integrity reversal definition (`:386-388`). |
| Deterministic greedy economy | `100%`, `116` actions | One economy-heavy policy completes the campaign (`:111-116`). | A population win rate, fun, or build parity. |
| Deterministic optimal | `100%`, `103` actions | One optimized policy completes in `13` fewer actions than the scripted greedy policy (`:204-209`). | That `103` is a player-time target or that other reward paths are viable. |
| Seeded casual policy | `40%` over `200`; `120` defeats: Echo Throne `78`, Sunken Bastion `19`, Howling Sprawl `17`, other stages `6`; winning action count mean `182.2875` (`150–209`) | Under this seeded bot policy, Echo Throne is the primary defeat concentration and the observed success is below the harness's `45–55%` calibration band (`:390-408`). | Human difficulty/fairness, confidence across other policies, or a retune prescription. |
| Early reward pairs | All `12` Stage 1×Stage 2 pairs covered; max completion-per-action ratio `1.16845×`; `12` distinct outcomes | The measured early pair ratio is below the proposed `1.30×` hard cap in this simulator (`:413-427, 1102-1105`). | Full ten-stage build parity: later reward stacks were not exhaustively covered by this pair table. |
| Fuzzer | `1,000 × 150 = 150,000` operations; `0` findings; `6,051` save/restore round trips | No invariant finding was produced by this configured fuzz run (`:1321-1331`). | Absence of balance exploits, usability failures, or defects outside generated coverage. |
| Branch census | Per-policy branch fractions `0.6923–0.8537`; four unique deterministic sequences and outcomes | The scripted policies traverse multiple legal branches (`:1333-1367`). | Reward-choice entropy or human strategy diversity. |
| Determinism | Double run identical | The simulator repeated identically for its configured run (`:1434`). | Renderer/input parity or frame-rate-independent behavior. |

This baseline sharpens priorities without converting recommendations into facts: Echo Throne needs recovery/readability investigation; Stage 1×2 pair efficiency is currently below the `1.30×` cap; and later stacking, player choice entropy, cooldown utilization, command feedback, and the `≤30%` comeback reversal rate remain unmeasured.

## All-stage reward audit

| Stage | Current offered effects | Source-derived risk, not a measured outcome | PM band decision |
|---|---|---|---|
| 1 — Cinder Span | Ember Cohort `Materialize +2`; Rift Lens possessed Assault `+4`; Stillwater Hourglass cooldown multiplier `0.8` plus automatic Extract on the second Hunt; Bulwark Brand counter `−2` | Four high-leverage, campaign-long openers create the largest snowball decision. Hourglass bundles two tempo effects; Lens consumes the full proposed burst budget at the first reward; Brand is twice the proposed per-pick defense increment. | Keep four identities, but one pick must fit one family budget. Split or debit bundled utility; do not sell, duplicate, reroll, or grant an extra choice. |
| 2 — Veil Citadel | Veil Vanguard `+4` legion on Echo Throne entry; Anchor Shard `+2` integrity on Echo Throne entry; Abyssal Banner `+1` entry aegis on every later stage and `Materialize +1` | Vanguard/Anchor are one-stage benefits while Banner persists for eight stages. Their opportunity value is structurally unequal unless Echo Throne pressure compensates. | Targeted entry rewards may be stronger for one stage, but measured campaign contribution must remain within `0.80–1.25×` the median pick contribution. |
| 3 — Echo Throne | Throne Echo and Dawnless Crown have empty effect objects | Both are currently zero-power choices despite seven later combat stages. That is a source-confirmed dead gameplay pick, not a measured player reaction. | Either label both explicitly commemorative with no strategic promise or give each a bounded, noncombat archive function. Do not invent combat power merely to fill the gap; designer decision is pending. |
| 4 — Sunken Bastion | Tidebreaker cooldown multiplier `0.9`; Coral Aegis `+1` persistent entry aegis; Depth Cohort `Materialize +1` | Each is individually inside the proposed per-pick band, but all feed long-lived stacks. Coral contributes to a possible six-charge Stage 10 entry; tempo and legion picks can approach their family ceilings early. | Accept only while cumulative caps are enforced and UI shows current value, post-pick value, and clipped value. |
| 5 — Howling Sprawl | Pack Banner combines `Materialize +1` and entry aegis `+1`; Howl Lens possessed Assault `+2`; Sprawl Hourglass multiplier `0.85` | Pack Banner is a two-family bundle; Lens and Hourglass stack with stronger Stage 1 equivalents. Bundle value can dominate without an explicit shared budget. | Combined rewards must spend both family budgets and remain `≤1.25×` median pick effectiveness; otherwise reduce one leg or make it situational. |
| 6 — Glass Necropolis | Glass Chorus multiplier `0.9`; Necropolis Plate counter `−1`; Choir Shard `+2` integrity entering Starless Canal | Choir Shard can realize zero effective recovery when carry plus base restore or the entry floor already determines the result. The stage's entry floor `7` also compresses prior attrition before this selection. | Targeted recovery must preview effective—not nominal—healing. A selectable recovery pick should deliver at least `1` effective integrity in `≥80%` of eligible observed entries or be redesigned. |
| 7 — Starless Canal | Canal Lantern `+1` persistent entry aegis; Tyrant Chain counter `−1`; Starless Cohort `Materialize +1` | Defense has two parallel stacking axes: full-hit negation and counter reduction. Taking both across stages can erase meaningful attrition even when each pick looks small. | Persistent entry aegis cap `2`; counter reduction cap `3`; combined defense must still expose at least one non-negated boss counter in the median successful late-stage line. |
| 8 — Shattered Causeway | Causeway Core `Materialize +2`; Colossus Plate counter `−2`; Span Sigil `+4` legion entering Abyss Chancel | The two persistent picks are at the proposed per-pick ceiling; the targeted pick may skip setup. Materialize-family builds can already fill all ten slots with one Materialize before this reward. | Do not offer a clipped persistent pick as full value. Span Sigil may save setup, but may not satisfy nodes, possession, Domain, waves, or boss gates automatically. |
| 9 — Abyss Chancel | Chancel Veil `+2` aegis entering the final stage; Concord Lens possessed Assault `+2`; Rite Hourglass multiplier `0.85` | This final combat choice can push valid family-max builds to entry aegis `6`, possessed bonus `8`, or raw cooldown reduction `53.182%` (then clamped to `50%`). Hourglass therefore has only `5.08 pp` effective headroom on the maximum tempo path. | Final-stage reward must retain full legible marginal value within the cumulative cap. No pick may be presented as `15%` if only `5.08 pp` can apply. |
| 10 — Gate Zenith | Zenith Crown and Abyssal Oath have empty effect objects | No forward combat remains, so zero power is appropriate; the only risk is implying an unimplemented metaprogression entitlement. | Commemorative only. No New Game+ power, paid archive unlock, premium ending, or hidden inventory value without a separate product decision. |

## Family maxima and exact current effects at risk

Every row is a **valid same-family path** because its picks occur at different stages. “Potential” does not mean a player outcome was measured.

| Reward family | Current maximum source-derived stack | Exact current effects at risk | Proposed bounded budget |
|---|---:|---|---|
| Tempo / cooldown | `0.8 × 0.9 × 0.85 × 0.9 × 0.85 = 0.46818`; raw reduction `53.182%`, live clamp `50%` | Stillwater `20% + autoExtract`; Tidebreaker `10%`; Sprawl `15%`; Glass `10%`; Rite `15%` | Each cooldown pick `8–15%` effective reduction; cumulative live reduction `≤40%`. `autoExtract` removes one command per Hunt cycle and consumes `10 pp` of the tempo budget, so a combined pick may carry at most `15%` cooldown reduction. |
| Possession burst | Cumulative reward bonus `+8`; Stage 10 possessed Assault becomes `5 + 2 + 8 = 15` against `26` boss health | Rift Lens `+4`, Howl Lens `+2`, Concord Lens `+2` | Per pick `+1…+3`; cumulative reward bonus `≤+4`; final possessed Assault `≤11`. No single reward may exceed `75%` of the family cap. |
| Materialize / legion economy | Cumulative bonus `+8`; one Materialize can summon `10` from empty after capacity clamp | Ember `+2`, Banner `+1`, Depth `+1`, Pack `+1`, Starless `+1`, Causeway `+2` | Per pick `+1…+2`; cumulative bonus `≤+4`; one Materialize summons `≤6`, preserving at least two Materialize decisions to fill ten empty slots. |
| Counter reduction | Cumulative `−6`; final counter floor remains `1` | Brand `−2`, Necropolis `−1`, Tyrant `−1`, Colossus `−2` | Per pick `−1`; cumulative `−3`; late-stage pre-aegis counter must remain `≥2` in the median successful legion tier. |
| Persistent entry aegis | Cumulative `+6` on every Stage 10 entry | Banner `+1`, Coral `+1`, Pack `+1`, Canal `+1`, Chancel `+2` | Per pick `+1`; persistent entry cap `2`; total stage-available aegis, including Domain, `≤3`. Any overflow must be prevented or transparently converted to no combat value before selection. |
| Targeted recovery | `+2` to Echo Throne and separately `+2` to Starless Canal; actual effective gain may be `0…2` due to floor/cap | Anchor Shard `+2`; Choir Shard `+2`; base reward restore `1` on Stages 1–2 and `3` on Stages 3–9; entry floors `4`/`7` | Targeted pick `+2` nominal and `≤2` effective; preview the exact post-floor/cap result. Effective gain target `≥1` in `≥80%` of eligible entries. |
| Targeted vanguard | `+4` legion on Echo Throne or Abyss Chancel entry | Veil Vanguard `+4`; Span Sigil `+4` | `+3…+4` legion for one named stage; cannot auto-complete node, possession, wave, Domain, or assault gates; setup actions saved `≤2`. |
| Earned comeback / Domain | One use; current grant up to `+4` integrity and `3` aegis | Stage 10 Domain aegis `3`; Stages 7–9 grant `2`; Stage 3 grants `+4/2`; activation is not currently low-integrity-gated | One earned use per stage; restore `≤4`; grant `≤2` aegis; total available aegis `≤3`; measured victory-within-window reversal probability `≤30%`. Never paid. |
| Commemorative | Empty effects at Stages 3 and 10 | Stage 3 empties occur with seven combat stages remaining; Stage 10 empties are terminal | Combat power exactly `0`. Stage 3 requires an explicit designer classification; Stage 10 remains archive-only. |

## Snowball, dead-pick, cooldown-stack, recovery, and dominance controls

```yaml
risk_controls:
  snowball:
    top_vs_bottom_build_winrate_spread_max_pp: 10
    top_vs_median_combo_effectiveness_max: 1.30
    reward_power_decile_clear_time_advantage_max: 0.20
  dead_pick:
    zero_effect_selection_rate_max: 0.05
    eligible_entry_effect_realization_min: 0.80
    clipped_value_disclosure_required: true
  cooldown_stacking:
    cumulative_effective_reduction_max: 0.40
    minimum_live_cooldown_fraction: 0.60
  recovery:
    domain_uses_max_per_stage: 1
    domain_integrity_restore_max: 4
    domain_aegis_max: 2
    instant_reversal_probability_max: 0.30
  late_stage_dominance:
    reward_family_cap_share_per_pick_max: 0.75
    build_clear_time_spread_p50_max: 0.20
    build_winrate_spread_max_pp: 10
```

Definitions:

- **Combo effectiveness** is the simulator's chosen outcome score for a complete legal reward path divided by the median legal path score. The metric and weights must be frozen before results are viewed; otherwise the `1.30` cap is gameable.
- **Zero-effect selection** means the chosen reward changes no live or next-stage gameplay value because of a clamp, capacity, floor, missing downstream mechanic, or terminal state. Intentional terminal commemoration is reported separately, not hidden in the denominator.
- **Instant reversal** is a Domain activation at `≤4` integrity followed by stage victory without another integrity loss within `60 s` or the next `3` accepted combat actions, whichever occurs first. QA may replace this operational definition only in a signed measurement plan.
- **Effective cooldown reduction** is the value actually applied by `app.js`, not the nominal reward copy or the unclamped multiplier product.

## Build-parity expectations

1. Enumerate or stratify legal reward paths through all ten stages using the deterministic public reducer. Report archetype and individual-reward effects; do not average away a dominant family path.
2. At equal input policy and encounter seed, every supported doctrine archetype must land within `45–55%` success where the scenario is tuned to the harness matchup band, and the largest build-to-build spread must be `≤10 pp`.
3. Median successful clear-time spread between supported builds must be `≤20%`; p95 spread is a diagnostic and must not be presented as passing without a pre-agreed cap.
4. No complete build may exceed `1.30×` median combo effectiveness. `>1.20×` is a design review warning; `>1.30×` blocks Stage 2 exit.
5. For a three-choice stage, observed choice share target is `20–45%` per pick; for four choices, `15–35%`. A pick below `10%` after the pre-registered sample is a dead-pick investigation; a pick above `50%` is a dominance investigation.
6. Normalized reward-choice entropy per stage, `H = -Σ pᵢ ln(pᵢ) / ln(n)`, targets `≥0.75`. This is a diversity signal, not proof of balance.
7. Retry, input method, cosmetic ownership, edition, storefront, and account state may not alter the legal reward set or authoritative action trace. Gameplay-equivalent paid/free delta remains `0 pp`.

## Telemetry required before any balance or forecast claim

| Event / field | Minimum payload | Decision supported |
|---|---|---|
| `stage_started` | rules version, stage ID, anonymized run ID, complete prior reward IDs, entry integrity/legion/aegis, input modality | Cohort entry state, snowball exposure, modality parity |
| `reward_offered` | stage ID, ordered reward IDs, current and projected post-pick benefit vector, clipped/zero-value flags | Dead-pick and copy/value mismatch |
| `reward_chosen` | stage ID, reward ID, decision latency, prior build, projected effective delta | Choice share, entropy, build intent |
| `action_resolved` | stage ID, action, accepted/rejected, monotonic input and visible-feedback timestamps, cooldown remaining, modality | Tempo utilization and command-to-visible-feedback p95; target `≤100 ms` |
| `encounter_resolved` | wave ID, breaches, clear time, integrity/aegis before and after | Defense/recovery value and attrition |
| `boss_assault_resolved` | boss HP delta, possession, reward damage bonus, counter raw/reduced/negated, integrity after | Burst/counter/aegis dominance |
| `domain_activated` | stage ID, integrity before/after, aegis before/after, nodes, elapsed time | Comeback eligibility and cap use |
| `stage_ended` | victory/defeat/retry, actions, elapsed time, final state, build, Domain-to-outcome actions/time | Win rate, clear-time spread, reversal probability |
| `campaign_ended` | result, full build, total time, retries by stage | Whole-run snowball and strategy diversity |
| `entitlement_equivalence_audit` | build/version and deterministic state hash only; no ownership value enters reducer | Prove paid/cosmetic state has `0` gameplay delta |

Telemetry must use pseudonymous run/session identifiers, avoid raw personal data, and record renderer/input modality only for parity analysis. No telemetry exists merely because this contract names it; implementation and QA evidence are pending.

## Focused verification handoff for each proposed bound

| Proposed change | Exact source file / symbol at risk | Focused verification (not run here) |
|---|---|---|
| Cooldown cap `40%`, combined autoExtract budget | `campaign-state.js` `rewardBenefits`, `getCampaignBenefits`; Stage 1/4/5/6/9 reward effects; `app.js` cooldown start at lines 2113–2115 | Deterministic all-tempo reward path plus fake-clock UI check for each command; assert displayed and actual duration agree and no pick is clipped silently. |
| Possessed bonus cap `+4` | `campaign-state.js` `assaultDamage`; Rift/Howl/Concord Lens effects | Sim Stage 5, 9, 10 bosses across no-lens, single-lens, max-lens paths; compare assault count, clear time, and success. |
| Materialize bonus cap `+4` | `campaign-state.js` `applyAction` materialize branch; all Cohort/Core/Banner effects | From legion `0`, souls `4`, capacity `10`, record accepted actions to capacity for every legion path; require at least two Materialize decisions. |
| Counter cap `−3` and entry aegis cap `2` | `campaign-state.js` `counterDamage`, `applyAssault`, `applyBreach`, `makeStageState`; Brand/Plate/Chain/Aegis/Lantern/Veil effects | Late-stage matrix across reachable legion tiers, breaches, and Domain use; require nonzero attrition and verify counter floor/charge consumption. |
| Domain `+4/2`, one use, `≤30%` reversal | `campaign-state.js` each `commands.domain`, `applyAction` domain branch | Pre-register low-integrity scenarios, run all supported builds, report activation count and operational reversal rate with numerator/denominator. |
| Targeted recovery realization `≥80%` | `campaign-state.js` `chooseReward` carried-integrity formula; Anchor/Choir stage-entry effects | Enumerate legal incoming integrity `0–10`; log nominal versus effective gain under floors/cap, then validate against observed entry distribution. |
| Stage 3 commemorative classification | `campaign-state.js` Echo Throne `rewards` empty effects | Designer review plus reward-screen comprehension test; confirm no player expects later combat value. |
| Build parity and entropy | `scripts/run-campaign-balance-sim.mjs` current deterministic simulator/fuzzer; `campaign-state.js` public reducer | Extend measurement plan, not code in this discovery pass: stratified legal builds, frozen policies/seeds, sample counts, CIs, entropy and dominance tables. |
| Paid/free delta `0 pp` | Campaign reducer, save envelope, reward selection, future entitlement boundary | Identical inputs/seeds with default versus any paid cosmetic/edition; require identical authoritative traces and state hashes. |

## Decision state

The source audit is complete. All caps remain **PM proposals** pending designer numeric targets and QA measurement. No current build is declared fair or unfair from source arithmetic alone, and no production code or test change is authorized by this artifact.
