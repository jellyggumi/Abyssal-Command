# Stage 2 Gate Measurements — QA Baseline

run-id: `20260726-stage2-balance-agency`  
measurement window: `2026-07-26T01:16:30Z–01:21:22Z`  
rules version: `defense-survivor-v1`  
method: deterministic headless scripted simulation; no human playtest and no game/test/source edits.

The raw command outputs remain at `/tmp/abyssal-s2-*.{json,jsonl}` for this session. This file is the durable derived evidence and links to the exact command, timestamp, expected band, and assessment for every reported number.

## #g2 — Rules and balance numbers

**Assessment: FIX.** The current stage workspace has no `design/balance-sheet.md`, so the required mechanics-coverage audit and TTK target are absent. The ±15% TTK threshold cannot be evaluated without inventing a target.

| Measured value | Method / command / timestamp | Expected band | Evidence path | Assessment |
|---|---|---|---|---|
| Five active campaign rotations: **50/50** stage clears, **0 defeats**. Mean boss TTK ticks: rusher 558.3; turtle 704.7; economy-greed 708.5; micro-optimizer 627.6; casual 555.2. | `node scripts/run-g2-archetype-rotation.mjs <archetype> --seeds 401 --output /tmp/abyssal-s2-<archetype>-active.json` · `2026-07-26T01:20:50Z–01:21:22Z` | TTK must be within ±15% of a documented target; no dominant pair >1.3× median EV | `qa/playtest-report.md#scripted-full-campaign-rotation` | FIX — one seed is a baseline, not a pass sample; target and pairwise EV measurement are missing |
| RPG-inactive rusher: **10/10** stage clears, **0 defeats**, mean boss TTK **810.8** ticks. | `node scripts/run-g2-archetype-rotation.mjs rusher --seeds 401 --rpg-inactive --output /tmp/abyssal-s2-rusher-inactive.json` · `2026-07-26T01:20:50Z–01:21:22Z` | Base content should distinguish a stripped progression control if calibrated | `qa/playtest-report.md#rpg-inactive-control` | FIX — no outcome pressure appears even in the stripped control |
| Bare-stage pressure, three stances × all ten stages × seed 401: **0/30 defeats**, **0 companion downs**. Worst minimum integrity: SPLIT gate **29.00%**, commander **9.82%**; TURRET **37.00% / 16.07%**; VANGUARD **70.54% / 61.50%**. | `node scripts/run-g2-margin-probe.mjs --seeds 401 --stances VANGUARD,TURRET,SPLIT --output /tmp/abyssal-s2-margin.json` · `2026-07-26T01:19:33Z–01:20:05Z` | TTK ±15% of target; no saturated outcome proxy | `qa/gate-measurements.md#g2` | FIX — tail-stage risk exists but does not produce a defeat; calibration target remains missing |
| Cinder Span pressure, bare stage: each stance ends with minimum gate **98.00%**; commander minimum is VANGUARD **100.00%**, TURRET **98.00%**, SPLIT **98.00%**. Boss TTK: **410 / 430 / 406 ticks** (6.83 / 7.17 / 6.77 s). | Same P4 command and timestamp above | Current public beat requires a non-saturated Cinder Span sortie; TTK target absent | `qa/playtest-report.md#cinder-span-pressure` | FIX — the named base stage is non-threatening under all measured stances |
| Controlled five-profile Cinder diagnostic: **15/15** replay digests match; all profiles take **0** gate and commander damage in the 360-tick window. | `node scripts/run-g2-archetype-sweep.mjs --output /tmp/abyssal-s2-cinder-rotation.jsonl` · `2026-07-26T01:19:24Z` | ≥5 archetypes tested; this runner explicitly cannot measure full-route TTK or win rate | `qa/playtest-report.md#controlled-cinder-rotation` | PASS for deterministic diagnostic only; NOT a G2 completion artifact |

**G2 blocking facts:** no current balance sheet, no target TTK, no pairwise combo-EV sample, and no non-saturated base-stage defeat criterion. No numeric retune is prescribed by QA.

## #g3 — Player-type diversity

**Assessment: FIX.** The count threshold is met by a scripted baseline, but independent viability is not established under meaningful pressure and the defensive identity has no observed companion-loss consequence.

| Measured value | Method / command / timestamp | Expected band | Evidence path | Assessment |
|---|---|---|---|---|
| **5** distinct full-campaign archetypes tested (rusher, turtle, economy-greed, micro-optimizer, casual); each clears **10/10** stages on seed 401; their declared stat/loadout priorities are distinct. | P2 command · `2026-07-26T01:20:50Z–01:21:22Z` | >=5 tested; >=3 independently viable under distinct strategies | `qa/playtest-report.md#scripted-full-campaign-rotation` | Preliminary PASS for count and strategy distinction; FIX for viability because n=1 and all outcomes clear |
| Five controlled Cinder profiles (bulwark, striker, gambit, conductor, rift) × three seeds: **15/15** deterministic replays. | P1 command · `2026-07-26T01:19:24Z` | >=5 archetypes tested | `qa/playtest-report.md#controlled-cinder-rotation` | PASS as a controlled rotation count; its own manifest marks the measurement `INCOMPLETE` for route gates |
| Formation probe, 30 runs: **0 companion downs** and **0 defeats**. VANGUARD/TURRET/SPLIT companion damage taken = **5,562 / 0 / 680**; damage dealt = **869,580 / 847,320 / 840,825**. | `node scripts/run-g3-stance-events.mjs --seeds 401 --output /tmp/abyssal-s2-stance.json` · `2026-07-26T01:20:11Z–01:20:42Z` | At least three viable strategies with consequential trade-offs | `qa/playtest-report.md#formation-risk-and-companion-loss` | FIX — TURRET’s zero-risk condition protects against no observed loss state |
| Gated rewards vary structurally: VANGUARD/TURRET/SPLIT rally windows **10 / 0 / 10**; synergy uptake **42.8% / 0.0% / 70.2%**. | Same P5 command and timestamp | No archetype >50% dominance in optimal play | `qa/playtest-report.md#formation-risk-and-companion-loss` | BLOCKED — single-player simulation has no PvP dominance distribution; outcome comparison remains non-discriminating |
| Rally-then-Turret arm: **10/10** runs retain a rally, take **0** companion damage after switching, and have **0** companion downs/defeats. | `node scripts/run-g3-exploit-probe.mjs --seeds 401 --output /tmp/abyssal-s2-exploit.json` · `2026-07-26T01:20:10Z–01:20:43Z` | No free dominant defensive conversion | `qa/exploit-register.md#s2-003` | FIX — reproducible candidate exploit; remeasure after a design response |

## #g7 — Core loop and Elite Extract route

**Assessment: BLOCKED, with scripted route evidence.** There is no current `design/core-loop.md`, so no approved loop definition, 30–180 s intended period, or repeat-rate protocol exists. A command being accepted is not player completion.

| Measured value | Method / command / timestamp | Expected band | Evidence path | Assessment |
|---|---|---|---|---|
| Engaged scripted route: **9/9** terminal victories, **9/9** `EXTRACT_ELITE` accepted, **9/9** extraction windows opened, **9/9** extraction completions, **9/9** `ELITE_EXTRACTED` events, **9/9** `extracted=true`. | `node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-g7-engaged.json` · `2026-07-26T01:17:10.618Z` | >=1 loop with 30–180 s period, >=3 actions, >=1 reward, >=70% voluntary human re-entry | `qa/playtest-report.md#scripted-extract-elite-route` | PASS for scripted event-chain reachability; BLOCKED for human end-to-end player completion and repeat rate |
| Cinder Span seed 901: elite candidate at tick **846** (14.10 s); extraction window at **17.82 s**; completion at **20.28 s**; `ELITE_EXTRACTED` at **20.30 s**; one accepted `EXTRACT_ELITE`; terminal victory at **26.90 s**. Seeds 902–903 reproduce the chain at 17.70–17.82 s / 20.10–20.28 s / 20.12–20.30 s. | Same P7 command and timestamp | Player-visible route must be observed end to end, not merely command acceptance | `qa/playtest-report.md#scripted-extract-elite-route` | Scripted completion proven; player-visible human observation remains required |
| Whole scripted runs: median **36.9 s**, median **51 actions**, **4** action types, **14** macro rewards (9-run aggregate summary). | Same P7 command and timestamp | 30–180 s applies to the approved loop model, not an improvised whole-run proxy | `qa/playtest-report.md#scripted-extract-elite-route` | Informative only; no G7 pass without core-loop model and human re-entry |

## #g8 — Novelty / striking element

**Assessment: BLOCKED.** `design/novelty-scorecard.md` and its survey evidence are absent in this run. No QA impression score was collected because this assignment ran scripted simulation, not a human playtest.

| Measured value | Method / command / timestamp | Expected band | Evidence path | Assessment |
|---|---|---|---|---|
| Survey frequency: **not measured**; QA impression score: **not measured**. | Filesystem check of current run at baseline creation · `2026-07-26T01:16:30Z` | >=1 element in <=2 of 5 comparable titles and QA impression >=4/5 | `qa/gate-measurements.md#g8` | BLOCKED — missing scorecard/survey and no human impression protocol |

## Boundary note — G5

The production manifest retains the no-monetization boundary: no paid path, account, premium currency, ads, or gacha are in scope. No QA measurement changes that boundary. G5 remains N/A unless the product boundary changes explicitly.
