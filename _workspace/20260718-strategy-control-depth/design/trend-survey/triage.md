# RTS trend survey triage

**Run:** 20260718-strategy-control-depth  
**Mode:** Stage 2 balance cycle entering Stage 3 responsiveness  
**Decision status:** designer-approved discovery handoff; no production values changed and no implementation gate is implied.

## Evidence labels

- **Observed** means the value was read from the repository or stated by a cited publisher/upstream source.
- **[INFERENCE]** means a design translation from the evidence, not a fact about a comparable title.
- **Target** means an unimplemented numeric acceptance band. No browser latency, frame-time, traversal, or revised balance measurement was run in this research pass.

## Triage decisions

| ID | Decision | Evidence | Disposition |
|---|---|---|---|
| T-01 | Expand the authored navigation canvas from 16×8 to **24×12 cells** for all ten stages. | Observed: `stage-navigation.js` exports `STAGE_GRID_WIDTH = 16`, `STAGE_GRID_HEIGHT = 8`; current stages mostly encode one corridor or two terraces. Comparable survey repeatedly uses territory, capture points, region control, or multi-front base access. | **Approve for topology prototype.** Exact topology is in `solutions.md`. |
| T-02 | Require **3 routes/zones**, **2 reconnect junctions**, **≥4-cell frontage**, **≥50% nonshared cells per lane**, **≥1 distinct affordance per lane**, and **longest route ≤1.35× shortest**. | [INFERENCE] Three choices prevent the current 16×8 layouts from collapsing into one corridor while remaining readable for one commander. | **Approve.** Measured lane success must be 15–70% each and static-camp time ≤60%. |
| T-03 | Retain commander **4.1 units/s**, Shift surge **7.2 units/s**, and enemy advance **2.4 units/s** for the first larger-map prototype. | Observed in `battle-realtime-three.js`: `MOVE_CODE`/`SURGE_CODES`, `COMMANDER_MOVE_SPEED`, `COMMANDER_SURGE_SPEED`, `ENEMY_ADVANCE_SPEED`. | **Approve hold.** Change geometry before speed so causal balance remains legible. |
| T-04 | Replace frame-dependent camera follow `0.12/frame` with **λ = 7.67 s⁻¹**, `alpha = 1 - exp(-λ·dt)`; preserve default zoom **18** and clamp **9–30**. | Observed: `updateCamera(dt)` calls `cameraTarget.lerp(..., 0.12)`; `this.zoom = 18`; wheel clamp is 9–30. λ preserves the current 60 Hz response because `-ln(0.88)×60 = 7.67`. Three.js documents delta-time damping [S9]. | **Approve.** p95 camera convergence must be equivalent at 30/60/120 Hz within ±1 frame of the sampled trace. |
| T-05 | Make click/drag classification cumulative from pointer-down with a **6 CSS-pixel Euclidean threshold for mouse/pen** and **12 CSS pixels for touch**. | Observed: `onPointerMove` flips `moved` after per-event Manhattan distance >3, then overwrites x/y; slow drags can remain clicks. Pointer Events provide one shared event model while `pointerType` supports calibrated intent thresholds [S8]. | **Approve.** Same authoritative action and target must resolve for pointer, keyboard activation, and touch. |
| T-06 | Gate command-to-visible-feedback at **p50 ≤50 ms, p95 ≤100 ms, max ≤200 ms**, with active animation work **≤10 ms/frame**, using **≥500 samples per input/device profile**. | Google RAIL specifies visible response within 100 ms, input processing within 50 ms, and 10 ms animation work [S7]; p50/max/sample size are the frozen studio gate. | **Approve as Stage 3 gate.** Measurement is not yet run. |
| T-07 | Cap the battle HUD at **≤5 visible primary controls**, with **≤4 enabled authoritative campaign actions** at once. | Observed stage definitions expose 5–7 command keys; the public reducer remains the only authority. Comparable RTS interfaces use contextual command sets and hotkeys rather than presenting the entire rules vocabulary simultaneously. | **Approve.** Hide only contextually impossible actions; never create a renderer-only action. |
| T-08 | Keep encounter pressure on **14–16 s wave spacing**, preserve **30–180 s** stage loops, and require seeded casual wins **45–55%** before implementation acceptance. | Observed wave times: S1 8/22/36; S4–5 10/24/38/52; S6–9 10/26/42/58; S10 adds 74. Observed `/tmp/abyssal-balance-v6.json`: casual 40% over 200, so the current evidence is out of band. | **Approve targets; current gate FAIL.** No claim of a retune is made. |
| T-09 | Trial **Undertow Reversal** only on Stages 7 and 9: one chosen current lane reverses for **6 s**, **30 s cooldown**, one active reversal maximum. | Survey found no equivalent player-triggered, temporary route-direction reversal in the six reviewed title sources; see `novelty-scorecard.md`. This is bounded novelty evidence, not a universal absence claim. | **Approve as the sole novelty candidate.** Must remain a reducer action and renderer/fallback parity feature. |

## Rejected patterns

- **Reject** numeric imitation of commercial map size, camera speed, or traversal time: official sources do not publish a comparable normalized unit, so cross-game numbers would be fabricated.
- **Reject** more than three live fronts in the first prototype: seven current campaign verbs plus encounter alerts already approach the readable-command ceiling.
- **Reject** pointer-only lane powers, WebGL-only hazards, or a second battle state machine: all violate authoritative reducer and fallback parity constraints.
- **Reject** changing movement speed and geometry together: it destroys attribution of traversal and balance effects.
- **Reject** declaring the 45–55% casual gate passed: the available v6 artifact reports 40%, and no simulator run was authorized for this pass.

## Source index

- **S1** Blizzard, *StarCraft II* official game page: https://starcraft2.blizzard.com/en-us/
- **S2** Age of Empires, official support portal and *Age of Empires IV* publisher page: https://support.ageofempires.com/ and https://www.ageofempires.com/games/age-of-empires-iv/
- **S3** Relic, *Company of Heroes 3* official site: https://www.companyofheroes.com/
- **S4** Funcom/Shiro, *Dune: Spice Wars* official site: https://www.dunespicewars.com/
- **S5** Shiro, *Northgard* official game page: https://northgard.net/game/
- **S6** EA, *Command & Conquer Remastered* official page and released upstream source: https://www.ea.com/games/command-and-conquer/command-and-conquer-remastered and https://github.com/electronicarts/CnC_Remastered_Collection
- **S7** Google web.dev, RAIL response/animation budgets: https://web.dev/articles/rail
- **S8** MDN, Pointer Events: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- **S9** Three.js `MathUtils.damp`: https://threejs.org/docs/api/en/math/MathUtils.html#damp
