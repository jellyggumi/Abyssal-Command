# Extraction Agency Feasibility — Stage 2

**Verdict: no data change is required to make `EXTRACT_ELITE` reachable. Do not retune extraction data until the designer has an approved broader G2 pressure proposal.** The live rules path already produces a player-issued, accepted extract after a completed hold. The remaining player-facing validation is QA work, not a data or renderer blocker.

## Current evidence

| Measure | Required comparison | Observed | Command / session / evidence |
|---|---|---:|---|
| Cinder Span engaged extraction acceptance | Public-beat minimum: >=1 accepted `EXTRACT_ELITE` per successful route | **1 per run; 3/3 Cinder seeds** (901–903) | `node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-g7-engaged.json`; `2026-07-26T01:17:10.618Z`; `/tmp/abyssal-s2-g7-engaged.json` |
| Cinder seed 901 handoff | Candidate -> completed hold -> extraction must occur in that order | candidate **14.10 s**; window **17.82 s**; completion **20.28 s**; `ELITE_EXTRACTED` **20.30 s**; `extracted: true`; terminal `VICTORY` | Same command/session; `/tmp/abyssal-s2-g7-engaged.json:266-355` |
| Cinder extraction-window budget | Current data window must exceed the observed route-to-ready time | **600 ticks / 10.00 s** configured; **2.46 s** observed window-to-ready; **7.54 s** slack | Same command/session; evidence above; configuration in `defense-catalog.js:349-357`; 60 Hz is recorded in `/tmp/abyssal-s2-g7-engaged.json:2-5` |
| Cinder pressure sanity check | No formal extract-pressure band exists; this is only a non-saturation signal, not a G2 pass | gate minimum **98.0%**, commander minimum **89.29%**, terminal `VICTORY` | `node scripts/run-g2-margin-probe.mjs --seeds 301 --stances VANGUARD --loadout ember-cohort,rift-lens,veil-vanguard --output /tmp/abyssal-stage2-margin-probe.json`; `2026-07-26T01:22:42Z`; `/tmp/abyssal-stage2-margin-probe.json` |

The first row establishes the requested decision is not merely an accepted input surface: the same scripted route reaches the completed hold, then emits the extraction event and wins. It remains **scripted** evidence, not a voluntary human-player completion or a G7 repeat-rate measurement; no G2/G3/G7/G8 pass is claimed here.

## Existing source path

1. **Elite spawn:** `defense-run-simulation.js` `updateObjectivePhase()` (`1241-1275`) completes gate defense after `STAGES[*].gateTicks`, the seeded wave schedule, and ordinary-enemy clearance. `tick()` then gates `spawnEnemy(run, run.stage.eliteKind, true, ...)` on that completion (`1545-1550`). `spawnEnemy()` reads `ENEMIES[type]`, applies `stage.scale`, and makes the elite `hp * 4`, `speed * 0.8`, and `xp * 4` (`291-329`).
2. **Candidate:** `resolveDeaths()` turns the dead elite into `run.eliteCandidate` using the stage's existing `eliteId` and `eliteCompanion`, starts extraction availability, and completes `echoRecovery` (`950-1003`). The mappings are immutable stage data in `defense-catalog.js` `stage()` / `STAGES` (`506-524`); Cinder Span is `s1-ember-hunter` -> `ember-cohort` (`514`).
3. **Readiness:** `processTerrainEffects()` requires a growth-completed, uncontested occupation hold. It uses `STAGE_TACTICS[stageId].occupation.{radius,holdTicks}`, then opens the window from `extraction.windowTicks` (`1337-1379`). The extraction hold requires the commander inside `extraction.radius`, uncontested, for the runtime hold threshold; it sets `extractionProgress.completed` and `.ready` (`1409-1456`). Cinder values are occupation `(17600,6000), radius 900, holdTicks 180`; extraction `(15400,6000), radius 1000, windowTicks 600` (`349-357`).
4. **Acceptance:** `processInput()` accepts `EXTRACT_ELITE` only when the candidate ID matches, the window has not expired, and `extractionProgress.completed && ready`; it sets `run.extracted`, adds the existing prototype to the run, and emits `ELITE_EXTRACTED` (`860-947`). An early valid request begins `objectiveRoute`, and `tick()` routes it to the extraction point once that phase is active (`929-938`, `1465-1483`).
5. **Companion acquisition:** the browser app is the sole campaign writer. `BattleSession.recordExtraction()` consumes `ELITE_EXTRACTED`, deduplicates its elite ID, calls `captureElite(campaign, eliteId, prototype)`, then persists (`app.js:1197-1205`, called at `1275-1300`). `campaign-state.js` `captureElite()` creates/evolves only canonical `COMPANIONS` records (`251-265`); canonical validation is `canonicalPrototype()` / `validCampaign()` (`35`, `162-166`). The current campaign rotation also records post-Cinder loadout `ember-cohort` at `/tmp/abyssal-s2-rusher-active.json` (seed 401), but that runner calls the campaign API directly; it is corroboration, not browser persistence proof.

## Smallest data-only fallback knobs

These are **candidate experiments only**. They preserve simulation IDs, renderer bindings, deployed GLBs, campaign schema, and the no-monetization boundary when only numeric values are changed.

| Priority | Data field and current Cinder value | Safe investigation range | Why it can change reachability | Constraint risk |
|---|---|---:|---|---|
| 1 | `STAGE_TACTICS["cinder-span"].extraction.windowTicks = 600` | **[180, 600] ticks**; never below **140** ticks | Extends the only data-owned post-occupation deadline. With commander speed 4100 (`defense-catalog.js:19-26`), the Cinder occupation-to-extraction route needs about 19 movement ticks to the `radius - 100` stopping boundary plus the fixed 120-tick hold. | Larger windows make failure less meaningful; values below the conservative floor make a route impossible even without contest. Current 600 already has 7.54 s observed slack, so increasing it is unjustified. |
| 2 | `STAGE_TACTICS["cinder-span"].extraction.radius = 1000` | **[1000, 1200]** | Reduces route distance and contest exposure without changing the objective identity or asset lookup. | With occupation radius 900 and point centers 2200 units apart, 1200 leaves only a 100-unit gap; exceed it and the two objectives begin to merge. Do not use unless window pressure is measured as the blocker. |
| 3 | `STAGE_TACTICS["cinder-span"].occupation.holdTicks = 180` | **[120, 180] ticks** | Opens the extraction window earlier; it is the smallest pre-window data lever. | Shortens the occupation decision and may weaken G7 pacing. It does not change the fixed extraction hold. |
| 4 | `STAGE_TACTICS["cinder-span"].occupation.radius = 900` and `.effects.moveMultiplier = 1.05` | radius **[900, 1100]**; multiplier **[1.05, 1.10]** | Makes the preceding hold and subsequent route less brittle without modifying combat or the renderer. | Radius 1100 plus extraction radius 1000 leaves a 100-unit objective gap; multiplier changes general movement and requires G2/G3 remeasurement. |

`ENEMIES[*].hp`, `.damage`, `.speed`, and `STAGES[*].waves` / `.scale` are data-only, but are **not** small extraction knobs. The elite shares its archetype's base values with ordinary enemies and gets fixed multipliers in simulation; changing these fields changes the whole stage's combat curve. Treat them only as a designer-owned G2 pressure retune, with all five-archetype remeasurement.

## Code-only boundary

No code change is needed for the currently demonstrated Cinder decision. The following requests cannot be satisfied by a data-only retune:

- **Change the extraction hold duration:** `createDefenseRun()` hard-codes `extractionProgress.maxHoldTicks: 120` in `defense-run-simulation.js:1825-1836`; `STAGE_TACTICS.extraction.windowTicks` does not control it. Making hold time stage data requires a code/schema change.
- **Tune elite health/speed/XP without touching ordinary enemies of the same type:** the elite factors (`hp * 4`, `speed * 0.8`, `xp * 4`) are code literals in `spawnEnemy()` (`291-329`). A per-stage elite multiplier requires code.
- **Repair a missing candidate, route, acceptance, or campaign persistence event:** those are control-flow/event-consumer paths in `resolveDeaths()`, `processInput()`, `tick()`, and `BattleSession.recordExtraction()`. Data cannot restore a broken event path.

## Recommendation and guardrails

**Recommendation: data-only change = none.** Freeze the listed extraction values for this pass; direct current simulation evidence already clears the reachability predicate with material timing slack. Send balance pressure to the designer as a separate `ENEMIES` / `STAGES` retune only after QA attaches an approved non-saturation target and all affected G2/G3 evidence is re-run.

If a later player-facing run fails specifically on the extraction deadline, test **only `windowTicks` first** within `[180,600]`; do not change IDs or mapping fields (`stage.id`, `eliteId`, `eliteKind`, `eliteCompanion`, `ENEMIES[*].id`, `COMPANIONS[*].id`), renderer code, `app.js`, campaign schema, deployed GLBs, rewards, or any monetization surface. If the desired intervention is hold-time or elite-only tuning, record it as a **code-only blocker**, not a data-only proposal.
