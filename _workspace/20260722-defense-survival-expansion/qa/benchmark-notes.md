# Benchmark notes — public-beat calibration

**Dated:** 2026-07-22  
**Evidence:** source-backed desk comparison; no comparable was hands-on tested in this pass. Full claims, limitations, and source ledger: [`benchmark-survey/comparison-survey.md`](benchmark-survey/comparison-survey.md).

## Comparable takeaways

| comparable | source-backed pattern worth borrowing | boundary for Abyssal Surge |
|---|---|---|
| Vampire Survivors | Official Steam copy supports touch and conventional inputs, minimalistic play, in-run collection, and gold-funded next-run upgrades. | Borrow low simultaneous-input load and dense pickup legibility; do not flatten the Gate, extraction, or occupation decisions into passive auto-play. [Steam](https://store.steampowered.com/app/1794680/Vampire_Survivors/) · [App Store](https://apps.apple.com/us/app/vampire-survivors/id6444525702) |
| Brotato | Official Steam copy documents auto-fire by default, optional manual aim, 20–90s waves, sub-30-minute runs, material/XP collection, a between-wave shop, and adjustable enemy HP/damage/speed. | Borrow bounded pressure beats and explicit balance dimensions; do not add a between-wave economy that obscures the five-beat defense loop. [Steam](https://store.steampowered.com/app/1942280/Brotato/) · [App Store](https://apps.apple.com/us/app/brotato-premium/id1668755109) |
| Arknights | The official site identifies a mobile strategic RPG; official metadata identifies tower defense, deployment, and skill activation. | Borrow threatened-lane, chokepath, facing, and tap-target clarity; continuous avatar movement must remain one-thumb readable rather than becoming deployment micromanagement. [Official site](https://www.arknights.global/) |
| Hades | Official Steam copy documents permanent growth, story progression per attempt, fully voiced characters, thousands of story events, hand-painted environments, and an original score. | Use as the authored presentation ceiling for intros, elite decisions, and terminal beats; keep all outcome authority in the deterministic simulation. [Steam](https://store.steampowered.com/app/1145360/Hades/) · [Developer](https://www.supergiantgames.com/games/hades/) |
| Death Must Die | Official Steam copy documents bullet-heaven combat, hundreds of synergistic blessings, randomized items that help later attempts, relic risk, Guardians, varied heroes, and personal stories. | Borrow clear build identity and risk framing; prevent dense 2.5D effects from hiding the Gate, hazard, occupation/extraction point, or priority target. [Steam](https://store.steampowered.com/app/2334730/Death_Must_Die/) |

## Required control and presentation calibration

1. A touch player must move continuously with one thumb while auto-combat runs. Extraction, growth, occupation, and stage reward decisions must use large single-tap targets and pause or safely bound combat where necessary.
2. Every stage must communicate one immediately threatened route, while distinct chokepaths, flanks, elevation, hazards, and occupation/extraction points change movement, range, or recovery. Cosmetic route labels do not meet the Arknights-derived readability bar.
3. Use a deterministic scout → pressure → flank → ranged → elite → boss rhythm with seeded variation. Brotato supports short pressure windows, but the authored policy taxonomy is Abyssal Surge’s own required defense identity.
4. Keep run items, three-choice skills, stat upgrades, synergies, extracted companions, stage rewards, and Archive growth separate. Every upgrade choice should state `current → upgraded` values.
5. Presentation can approach Hades-like authorship through renderer-observed cutscenes, sound cues, and strong silhouettes. It must never mutate combat state or disguise unavailable mechanics.
6. In 2.5D combat, the Gate, priority threat, occupation/extraction point, safe route, pickups, and range/impact feedback must remain separable under peak effect density.

## Baseline contrast and current-head supersession

The pre-integration baseline rotation pinned in [`playtest-report.md`](playtest-report.md) found five victories out of five (100%), a 24.5–38.5s terminal range, and only one session that saw elite extraction, item, growth offer, and active skill. Four roaming policies won without the signature loop. This is historical automated evidence from harness snapshots `defense-run-simulation.js#69A1` and `defense-catalog.js#9CA1`, not a human impression and not current-head gate evidence.

Combat integration later superseded that balance state. The linked QA broadcast captured `9/23` failures and a pre-routing `0/50` matrix. QA’s later reruns supersede both current claims: at 08:54:09Z the focused suite was `15/23` pass and `8/23` fail after item-pickup and later-stage-cutscene recovery; after objective routing at 09:05Z the five-archetype × ten-stage seed-17 matrix improved to `5/50` wins (10%) but still had `0/5` viable archetypes. Strict simulation still reports `0/30` wins despite internal `pass:true`; pre-elite extraction, remote Bind without spatial hold, terrain-rate quantization, and occupation overflow remain open. See [`../messages/20260722-qa-stage1-fix-broadcast.md`](../messages/20260722-qa-stage1-fix-broadcast.md) for the earlier receipt. The baseline hook bypass remains credible for the old global-event-gate design, but occupation as remedy remains a hypothesis until event/state semantics and spawn/contact/candidate causality are isolated.

Updated source may contain authored path, occupation, wave, policy, and value fields, but source presence and green observer smokes are not behavioral evidence. Current-head regressions block end-to-end claims. G2 and G8 stay **FIX** pending corrected event/spatial semantics plus fresh shared-seed archetype, boss-TTK, density/spawn-direction, combo-EV, and human-impression receipts.

## Novelty boundary

The complete Echo-command extraction conjunction was evidenced in `0/5` surveyed official descriptions. Each comparable contains partial ingredients—persistent upgrades, recruited characters, relationships, bosses, or run items—but none of the cited descriptions establishes defeated elite → bounded extraction → named permanent companion → recovered enemy memory.

This supports keeping the hook as a **novelty candidate**. It does not pass G8: five human impressions with a mean score ≥4/5 remain absent. No automated run or analyst note is a substitute for that panel.
