# Automated archetype playtest report

**Baseline executed:** 2026-07-22, before the same-session combat integration reported at approximately 08:40Z.  
**Pinned baseline surface:** harness snapshots `defense-run-simulation.js#69A1` and `defense-catalog.js#9CA1` (`defense-survivor-v1`), plus the browser/PWA smoke journey. The shared workspace changed after this receipt; no commit SHA was captured, so the harness snapshot tags and recorded actions are the narrowest available identity.  
**Evidence class:** automated observation only. There was no human panel, no human impression score, and no gameplay-video review in this pass. This baseline is historical diagnostic evidence, not current-head gate evidence.

## Procedure and reproducibility

Two existing commands were run from `/Users/jangyoung/orca/Abyssal-Surge`:

```text
node tests/defense-survivor-browser.cjs
node scripts/run-defense-balance-sim.mjs --strict
```

The browser command returned `pass: true` with lobby, battle, keyboard movement during and after the cutscene, cutscene dismissal, touch movement, and one growth selection (`soul-magnet`), with no page/console errors. The strict balance command returned `pass: true` for its internal contract over seeds `1, 17, 991`; that receipt does **not** establish G2 because it does not enforce the 45–55% archetype win target, boss-only TTK band, or combo EV.

Five archetype sessions were then executed in the persistent JavaScript evaluation kernel by importing `defense-run-simulation.js` and `defense-catalog.js`. Each controller used only public simulation APIs: `createDefenseRun`, `getRunSnapshot`, `queueInput`, `advanceDefenseRun`, and `isTerminalRun`. State advanced in deterministic 30-tick batches (0.5 seconds), stopping for growth offers. Every available active skill was recast when its cooldown reached zero; extraction was accepted or intentionally declined per policy; the first stage reward was selected. Maximum budget was 18,000 ticks. A same-seed control repeated all five policies at seed `4242`.

This evaluation-kernel procedure is a command/session receipt, not a new test file. It changed no game code or test code.

## Current-head supersession

After the baseline rotation, combat integration changed the shared runtime. The authoritative current-head QA receipt in [`../messages/20260722-qa-stage1-fix-broadcast.md`](../messages/20260722-qa-stage1-fix-broadcast.md) reports:

- focused simulation/campaign tests: latest 08:54:09Z rerun `15/23` pass, `8/23` fail (superseding the linked broadcast’s `9/23`; item pickup and later-stage cutscene now pass);
- strict balance automation: `0/30` wins despite its internal `pass:true`;
- post-routing five-archetype × ten-stage seed-17 matrix at 09:05Z: `5/50` wins (10%), superseding the pre-routing `0/50`; Gatekeeper 0/10, Hunter 2/10, Collector 1/10, Skirmisher 0/10, Generalist 2/10, hence `0/5` viable archetypes;
- pre-elite extraction at tick 157 with no candidate at tick 178 and split extraction state;
- remote Bind without commander-position or extraction-point-hold validation;
- terrain rates quantized from authored 4–12/s to 60/s and occupation progress overflowing to 214/180;
- browser, presentation, release-closure, responsive-HUD, and short-performance smokes independently green.

Those current-head results supersede the baseline’s `5/5` victories for gate decisions. They do not erase the baseline hook-bypass discovery: before integration, four roaming policies could win without seeing item, growth, or extraction. Retest the funnel only after event/state semantics and spatial extraction are fixed. G2 and G8 remain **FIX**.

## Primary five-session rotation

All sessions used `cinder-span`; terminal duration is stage-start-to-terminal time, **not boss-only TTK**.

| archetype | seed | deterministic policy and repeated decisions | outcome | duration | final Gate | growth / casts | extraction / item | automation finding |
|---|---:|---|---|---:|---:|---:|---:|---|
| Gatekeeper | 11 | `IDLE`; prefer `void-aegis`, `ward-binder`, area clear; cast active on cooldown; accept extraction | VICTORY | 1,470 ticks / 24.5s | 866/1000 | 1 / 4 | 1 / 1 | Saw the complete local gate → elite candidate → growth → extraction → boss terminal sequence, although the offered cards forced `grave-pulse` rather than the first two preferences. |
| Hunter | 17 | alternate `W/E` every 210 ticks; prefer `rift-bolt`, `soul-lance`, damage; recast actives; accept extraction if offered | VICTORY | 1,782 / 29.7s | 854/1000 | 0 / 0 | 0 / 0 | Nine movement decisions; no elite candidate, item, growth, or active skill became available. |
| Collector | 991 | `W,W,E,E` every 150 ticks; prefer `soul-magnet`, area clear; accept extraction | VICTORY | 2,046 / 34.1s | 894/1000 | 0 / 0 | 0 / 0 | Fourteen movement decisions but no pickup/growth/extraction opportunity; “collector” behavior did not produce collection play. |
| Skirmisher | 2026 | `NW,SW,SE,NE` every 120 ticks; prefer mobility/cooldown; intentionally decline extraction | VICTORY | 1,782 / 29.7s | 844/1000 | 0 / 0 | 0 / 0 | Fifteen movement decisions; no candidate appeared, so the planned decline decision was never exercised. |
| Generalist | 60722 | `W,IDLE,E,IDLE` every 240 ticks; balanced preference; accept extraction | VICTORY | 2,310 / 38.5s | 854/1000 | 0 / 0 | 0 / 0 | Ten movement decisions; won without seeing growth, item, or extraction systems. |

All five selected `ember-cohort-legacy` from the terminal reward offer. Only Gatekeeper acquired `ember-cohort` during the run. Defeated counts were respectively `4, 2, 3, 1, 2`.

### Representative action receipts

| archetype | recorded action sequence (tick: action) |
|---|---|
| Gatekeeper | `0 MOVE IDLE`; `678 SELECT grave-pulse` from `[shadow-step,eclipse-edge,grave-pulse]`; `678 EXTRACT ember-cohort`; `708/948/1188/1428 CAST grave-pulse`; `1470 REWARD ember-cohort-legacy`. |
| Hunter | `0 W`; `210 E`; `420 W`; `630 E`; continued W/E through 9 moves; `1782 REWARD`. |
| Collector | `0 W`; `150 W`; `300 E`; `450 E`; repeated through 14 moves; `2046 REWARD`. |
| Skirmisher | `0 NW`; `120 SW`; `240 SE`; `360 NE`; repeated through 15 moves; `1782 REWARD`. |
| Generalist | `0 W`; `240 IDLE`; `480 E`; `720 IDLE`; repeated through 10 moves; `2310 REWARD`. |

## Same-seed control

At seed `4242`, outcomes reproduced the same strategy ordering: Gatekeeper 25.2s/866 integrity/one growth/one extraction/one item; Hunter 29.7s/854/none; Collector 34.1s/894/none; Skirmisher 29.7s/844/none; Generalist 38.5s/854/none. All five again won. This reduces—but does not eliminate—the seed confound and shows that the observed divergence is primarily policy/path dependent in this stage.

## Baseline gate interpretation — superseded for current-head gating

| requirement | observation | verdict |
|---|---|---|
| G2 win rate 45–55% | `5/5 = 100%` victories in the primary rotation and `5/5 = 100%` in the same-seed control. | **FAIL** |
| G2 TTK ±15% | Boss spawn/defeat timestamps are not exposed as a summarized metric. Terminal-duration proxy median was 29.7s; 24.5s is −17.5% and 38.5s is +29.6%. | **BLOCKED** for boss TTK; proxy also outside target. |
| G2 combo EV ≤1.3× median | Only one session received a skill; no synergy/EV receipt exists. | **BLOCKED** |
| G3 ≥5 tested / ≥3 viable | Five distinct automated controllers terminated in victory. | **Automation supports 5/5 completion**, but this is not human viability or comprehension evidence. |
| G7 loop 30–180s, ≥3 actions, ≥1 reward | Durations were 24.5–38.5s; Hunter/Collector/Skirmisher/Generalist repeated movement and took a reward but did not experience the full feature sequence. Gatekeeper was under the 30s floor. | **FAIL** as a complete repeated loop. |
| G8 human impression ≥4/5 | No people rated the hook. | **BLOCKED** |

The baseline snapshots did not expose direct measurements for spawn density/direction, boss-only TTK, target-policy choice, occupation effects, or combo EV, and did not present the updated path, occupation, wave, or enemy-intent contract. Current-head source has since changed, but its latest `8/23` focused failures and `5/50` post-routing archetype result block behavioral claims. The current matrix logged 21 extractions, 31 items, 59 skills, and 21 boss reaches, yet only 10% wins and no viable archetype. Terrain/occupation effects, deterministic policies, and measurement receipts must be retested rather than inferred from either source presence or the historical baseline.

## Emergent-fun candidates — automated observation, not human impression

1. **Echo conversion changes the run immediately:** Gatekeeper’s extracted Ember Cohort joined before the terminal and the action sequence visibly crossed defense, growth, extraction, casting, and reward systems. This is a supported interaction candidate for later human scoring.
2. **Movement meaningfully changes terminal timing:** fixed-seed policies ranged from 25.2s to 38.5s. A movement pattern can therefore alter engagement range and clear cadence even before terrain systems exist.
3. **Bounded decisions remain automation-readable:** growth, extraction, casting, and reward choices all admit explicit, replayable inputs without renderer ownership.

## Frustration risks — automated observation, not human impression

1. **Baseline hook bypass:** four archetypes won without ever seeing an elite candidate, item, or growth offer. This remains credible historical evidence that global event gates made the signature chain path-sensitive, but it is not a final verdict on current head.
2. **Baseline Collector inversion:** fourteen circulation decisions produced zero collected items and zero growth choices while idle Gatekeeper collected both. Occupation is a contract requirement and a remedy hypothesis, not a proven fix; current-head retesting must isolate spawn/contact/candidate causality.
3. **Pressure swung across integrations:** the baseline let all policies win despite only 1–4 defeated actors; pre-routing current head produced `0/50`, and objective routing improved it only to `5/50` (10%) with `0/5` viable archetypes. Every measured state remains outside the 45–55% target.
4. **Reward choice was repetitive in baseline:** all sessions selected the first identical stage reward. Current-value → upgraded-value disclosure and separated reward families need fresh behavioral evidence after the integration.
5. **Baseline feature cadence missed the target loop:** one run ended before 30 seconds, and four runs completed without Echo recovery, growth, or extraction. Current-head regressions now prevent a replacement completion receipt.

## Human follow-up still required

Recruit at least five people across touch and keyboard/controller. For each, record first-threat identification time, first three growth-card explanations, extraction comprehension, perceived feedback latency, immersion 1–5, frustration moments, repeat intent, and whether the recovered-memory companion hook scores ≥4/5. Do not merge those future observations with this automated dataset.
