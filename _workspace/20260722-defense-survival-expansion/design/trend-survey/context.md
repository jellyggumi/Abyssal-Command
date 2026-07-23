# Comparable survey context — defense, controls and extraction

Survey date: 2026-07-22  
Bounded sample: Vampire Survivors, Brotato, Arknights, Hades, Death Must Die  
Decision served: ten-stage 2.5D browser defense-survivor public beat

## Workflow Context

Abyssal Command has an offline deterministic 60 Hz run, a fixed full-field browser view, eight-way pointer/keyboard movement, automatic basic attacks, active skills, XP/growth/item/companion/reward paths and ordered local campaign progression. During this cycle the current head also gained ten stage-tactic records, Warden integrity, seeded timing/density/spawn direction, six policy IDs, occupation and spatial extraction progress. Those additions are candidate implementation, not validated delivery: focused tests and five-archetype outcomes are red.

The survey therefore separates three questions that are easy to conflate:

1. **Familiar control grammar:** what players already understand about movement-led auto/dense combat.
2. **Loop grammar:** how combat pays into run growth and persistent growth.
3. **Strict hook frequency:** whether a defeated elite becomes a named permanent ally specifically through bounded hostile-memory extraction.

Runtime truth remains in `defense-catalog.js`, `defense-run-simulation.js`, `campaign-state.js` and `app.js`. Survey findings shape the contract; they do not execute rules.

## Affected Users

- Mobile and browser players need one-thumb/eight-way movement, ≥44 CSS-pixel decision targets and a stable camera that keeps Gate, ingress, hazard, Domain and extraction readable.
- Survivor players expect pressure to continue while auto-attacks resolve, but still need meaningful movement, build choices and recovery risk.
- Defense players need chokepath, flank and goal pressure—not enemies that differ only by HP.
- Returning players need run items, skills, stats, synergies, companions, stage rewards and Archive growth labeled by lifetime.
- QA and balance owners need seed, tick, phase, policy, spawn direction, HP, density and boss TTK in traces.

## Current Workarounds

The current R2 catalog now authors one chokepath, flank, elevation, hazard, occupation point and extraction point per stage. Occupation candidates hold for 180–360 ticks and apply movement, range and integrity-recovery effects; the simulation also emits occupation/extraction progress. Seeded xorshift scheduling varies three authored wave rows, with elite and boss spawned separately. This is closer to the target but still not the complete six-phase grammar: `wavePattern` names six beats while the schedule has only three wave entries, enemy contest does not yet gate occupation progress, and the extraction window is currently evaluated against stage ticks rather than proven candidate-relative timing.

Current-head QA reports 9/23 focused simulation/adapter failures and 0/50 wins across five archetypes × ten stages. These candidate systems therefore cannot substitute for a verified loop. Documentation may say “authored/implemented candidate,” not PASS, until event ordering, terminal rewards, candidate-relative Bind, policy behavior and viable balance are proven.

## Adjacent Problems

- A 2.5D elevation read can become decorative noise unless pathing/range effects are simulation data and the full-field camera exposes them.
- Automated combat can hide cause/effect unless offers and HUD show numeric current → upgraded values.
- Seeded variation can break replay/debuggability if a renderer, audio adapter or wall clock samples randomness.
- Persistent companions can read as ordinary recruitment unless defeat, countdown, spatial Bind and hostile-memory representation appear in one trace.
- A short boss gate can produce three inputs without a meaningful 30–180-second loop; G7 must count distinct action classes and a resolved reward.
- “No match found” is not a novelty PASS. G8 also requires an implemented trace and five impressions with median ≥4/5.

## Five-title evidence matrix

| title | genre / controls / camera | disclosed combat→reward loop | disclosed persistence | strict four-part extraction match |
|---|---|---|---|---:|
| Vampire Survivors | top-down survival; bounded control evidence consistently describes movement-led automatic attacks and positioning | survive hordes, collect dropped resources, choose run upgrades | official store copy discloses gold/upgrades and character/build progression | 0 |
| Brotato | top-down arena auto-shooter; auto-firing is default and manual aim is optional; compact arena keeps threats visible | fight 20–90-second waves, collect materials, choose/buy/merge weapons and items | characters/items support future build variety | 0 |
| Arknights | mobile strategic RPG/tower defense; deploy Operators and activate skills on a bounded stage map | build a formation, stop enemy waves from reaching the goal, clear stage | recruit/train persistent Operators and develop the roster | 0 |
| Hades | direct-action isometric roguelike; move/attack/cast/dash inputs carry execution load | clear encounters, choose powers, attempt escape, return after death/success | official/store materials disclose between-attempt advancement around the House/Mirror structure | 0 |
| Death Must Die | action roguelite/survivor; movement plus auto-aim/toggle-attack support is disclosed in indexed control material | kill hordes, choose god powers, collect items, build synergies, face bosses | varied heroes, unlocks and achievements persist | 0 |

Strict match means all of: `elite defeat + bounded post-defeat extraction + hostile-memory representation + named permanent allied unit`. Similarity on one limb—Arknights' persistent Operators, Hades' progression, or survivor pickups—does not count.

## User Voices

No qualifying Abyssal Command human observation session was run in this survey, so this section records public product language rather than inventing tester quotes:

- Vampire Survivors' official store pitch emphasizes mowing down night creatures, surviving until dawn and gathering gold for the next survivor; the reward fantasy is survival snowball, not captured command-memory.
- Brotato's official store description explicitly advertises auto-firing, up to six weapons, 20–90-second waves and material collection; this strongly supports a short movement/build cadence benchmark.
- Arknights' official listing frames strategic Operator deployment and defense against waves; it is the closest defense comparable but its persistence is roster recruitment/training, not elite extraction.
- Hades' official/store copy emphasizes manual hack-and-slash escape attempts and Olympian powers; its control load is a useful contrast to movement-led auto-combat.
- Death Must Die's official store copy emphasizes god-given powers, items, varied heroes and synergies; this makes generic blessings/items a common pattern, not the hook.

## Source ledger

| ID | source | supported use | provenance / limitation |
|---|---|---|---|
| VS-1 | [Vampire Survivors — Steam](https://store.steampowered.com/app/1794680/Vampire_Survivors/) | survival, hordes, gold/upgrades, product framing | direct page retrieval; store disclosure, not exhaustive mechanic inventory |
| VS-2 | [poncle game page](https://poncle.games/vampire-survivors/) | developer product identity and minimalist survival framing | direct page retrieval; sparse controls detail |
| VS-3 | [Vampire Survivors — Wikipedia gameplay summary](https://en.wikipedia.org/wiki/Vampire_Survivors) | direct movement, automatic weapons, XP gems, level-up choices and persistence corroboration | direct page retrieval; secondary synthesis, used for control/loop grammar only |
| BR-1 | [Brotato — Steam](https://store.steampowered.com/app/1942280/Brotato/) | auto-firing/manual aim, six weapons, 20–90-second waves, materials/items | direct page retrieval |
| BR-2 | [Brotato official site](https://www.brotato-game.com/) | fight, improve, gather, weapon acquisition/merging identity | direct page retrieval |
| AK-1 | [Arknights official site](https://www.arknights.global/) | publisher/title identity and strategic RPG framing | direct page retrieval; page body is presentation-heavy |
| AK-2 | [Arknights — Google Play](https://play.google.com/store/apps/details?id=com.YoStarEN.Arknights) | official listing for persistent Operator recruitment/training, RPG/strategy, Auto Deploy and tower-defense category | direct page retrieval; listing does not enumerate every combat input |
| HA-1 | [Hades official page](https://www.supergiantgames.com/games/hades/) | developer identity, action roguelike framing | direct page retrieval |
| HA-2 | [Hades — Steam](https://store.steampowered.com/app/1145360/Hades/) | hack-and-slash escape, powers, input/control and progression disclosure | direct page retrieval |
| DM-1 | [Death Must Die — Steam](https://store.steampowered.com/app/2334730/Death_Must_Die/) | powers, items, synergies, heroes, survivor/action framing | direct page retrieval |
| DM-2 | [Death Must Die news hub](https://store.steampowered.com/news/app/2334730/) | auto-attack/auto-aim control-option corroboration | indexed snippet; secondary to store page and not used for strict-match absence |

All sources were accessed 2026-07-22. Frequency coding is reproduced in `../novelty-scorecard.md`.
