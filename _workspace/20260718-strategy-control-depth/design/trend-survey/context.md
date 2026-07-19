# RTS trend survey context

**Frozen scope:** Stage 2 balance design entering Stage 3 responsiveness. No production code or tests changed/run.

## Evidence labels and method

Six commercial titles were reviewed against one field contract. Publisher/developer pages and EA's released source are primary. **Observed** means repository/source fact; **[INFERENCE]** means an Abyssal Surge design translation. Where sources do not publish normalized dimensions, traversal, camera rates, click thresholds, or latency, this says **not published** instead of inventing numbers.

## Current repository facts

| Surface | Observed fact |
|---|---|
| Campaign | `campaign-state.js` `RULES_VERSION = "abyssal-surge-rules-v6"`; `STAGES` has 10 entries. |
| Navigation | `stage-navigation.js` uses shared 16×8 one-unit cells, global portal/boss/node anchors, and stage-specific height/walkability. |
| Movement | `battle-realtime-three.js`: commander 4.1 units/s, Shift surge 7.2, enemy advance 2.4. |
| Camera | Default zoom 18, clamp 9–30; `updateCamera(dt)` uses frame-dependent `lerp(..., 0.12)`. |
| Pointer | Per-event Manhattan movement >3 marks drag and overwrites the reference point, so segmented slow drags can remain clicks. |
| Commands | Stages expose 5–7 command keys; `app.js` routes `[data-action]` to `applyAction` and emits `abyssal:command-resolved`. |
| Pressure | S1 8/22/36; S4–5 10/24/38/52; S6–9 10/26/42/58; S10 adds 74 seconds. |
| Simulation | `scripts/run-campaign-balance-sim.mjs` is the current deterministic sim/fuzzer. Existing `/tmp/abyssal-balance-v6.json` reports casual **40%/200** and identical determinism double-run. This task did not rerun it. |

## Consistent comparable matrix

| Title | Map dimensions / traversal | Lanes / chokepoints | Economy-pressure cadence | Command density | Camera / zoom | Click vs drag | Responsiveness | Transferable pattern |
|---|---|---|---|---|---|---|---|---|
| **StarCraft II** [S1] | Bounded tile maps; widely documented editor max 256×256. Competitive normalized traversal **not published by cited official page**. | Bases, ramps, expansions, destructibles and alternate attacks. | Continuous worker/production/expansion clocks; no universal interval. | Context command cards, hotkeys, groups and saved camera locations compress high APM. | Pan/minimap/camera locations; numeric speed/range not published. | Point orders and box selection; threshold not published. | No publisher SLA found. | Alternate routes need different strategic access, not cosmetic forks. |
| **Age of Empires IV** [S2] | Multiple lobby/editor sizes and editable playable bounds; normalized traversal not published. | Resources, sacred sites, crossings, walls and base approaches. | Worker/resource growth, age-up and sacred-site pressure overlap; no universal beat. | Remappable contextual controls, groups and camera locations. | Pan/rotate/reset/zoom; numeric rate not published. | Point/box selection; threshold not published. | No publisher SLA found. | Objectives make a detour economically meaningful. |
| **Company of Heroes 3** [S3] | Tactical battlefields; normalized grid/traversal not published. | Roads, cover, buildings, bridges, territory and victory points. | Territory connects space to manpower/munitions/fuel; cited page gives no universal tick. | Squad-context actions and queued-order/tactical-pause support in applicable modes. | Pan/zoom/tactical map; numeric rates not published. | Point/box selection and ground orders; threshold not published. | No publisher SLA found. | Put pressure nodes at route intersections so position changes income/tempo. |
| **Dune: Spice Wars** [S4] | Official page describes exploration/control of regions; dimensions/traversal not published. | Region adjacency, villages, hazards and hostile borders form a strategic graph. | Spice, economy, politics and military pressure overlap; no official universal interval. | Contextual 4X panels; exact command count not published. | Strategic region camera; rates not published. | Region/unit selection; threshold not published. | No publisher SLA found. | A zone should impose a visible commitment and consequence. |
| **Northgard** [S5] | Territory expansion is official; normalized dimensions/traversal not published. | Discrete adjacent zones and constrained local development make connectors legible. | Seasonal survival/resource preparation is forecastable; cited page gives no universal seconds. | Context actions depend on selected zone/building/unit. | Conventional RTS camera; rates not published. | PC point/box interaction; threshold not published. | No publisher SLA found. | Named zones communicate roles better than undifferentiated floor. |
| **Command & Conquer Remastered** [S6] | EA released map-editor/game source including `CellGrid`, `CellMetrics` and `Map`; normalized traversal not published. | Ore, bridges, base entrances, ridges and chokes couple income exposure to routes. | Harvester trips/production queues recur but are map-dependent. | Selection/groups/sidebar production keep the world readable. | Classic pan/scroll; numeric rate not published. | Click orders/drag selection; threshold not published. | No publisher SLA found. | Keep economy exposure spatial and feedback immediate. |

## Recurring pattern synthesis

1. **Space matters through consequence.** All six couple position to objectives, economy, production, expansion or access.
2. **Bounded multi-front choice stays readable.** [INFERENCE] Three routes with two reconnects fit one commander; each route must have ≥50% nonshared cells and ≥1 distinct affordance.
3. **Pressure is forecastable.** Existing 14–16 s waves already provide a compact greed/hold/advance clock.
4. **Commands are contextual.** Retain the reducer vocabulary but show ≤5 primary and ≤4 enabled actions.
5. **Camera reduces map-attention cost.** No comparable justifies copied proprietary numbers; preserve zoom 18, 9–30 and make follow time-based.
6. **Click and drag are distinct intents.** [INFERENCE] Use cumulative displacement through Pointer Events so touch/mouse/pen share authority.
7. **No commercial latency claim was found.** The frozen 50/100/200 ms response distribution derives from Google RAIL [S7] plus the studio gate, not surveyed-title measurement.

## Source index

- **S1** Blizzard, *StarCraft II*: https://starcraft2.blizzard.com/en-us/
- **S2** Age of Empires official support/game page: https://support.ageofempires.com/ and https://www.ageofempires.com/games/age-of-empires-iv/
- **S3** Relic, *Company of Heroes 3*: https://www.companyofheroes.com/
- **S4** Funcom/Shiro, *Dune: Spice Wars*: https://www.dunespicewars.com/
- **S5** Shiro, *Northgard*: https://northgard.net/game/
- **S6** EA page and released source: https://www.ea.com/games/command-and-conquer/command-and-conquer-remastered and https://github.com/electronicarts/CnC_Remastered_Collection
- **S7** Google RAIL: https://web.dev/articles/rail
- **S8** MDN Pointer Events: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- **S9** Three.js delta damping: https://threejs.org/docs/api/en/math/MathUtils.html#damp
