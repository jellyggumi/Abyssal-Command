# 01 — Encounter progression

- **Version** v1 (2026-07-31)
- **Skill** `/skill:design-game-encounters` (narrowest match; combine with
  `/skill:design-action-combat` only for boss-phase state machines)
- **Produces** the encounter and tactics payload for `${stageId}` — objectives, approaches, finale,
  wave plan, caps, occupation/extraction/hazard geometry — plus the fixture that proves it.
- **Placeholders** `${stageId}`, `${stageName}`, `${sequence}`, `${bossName}`,
  `${blueprintPath}` (output of prompt 00).

---

**CONTEXT:**
`defense-catalog.js` owns encounter truth for *Abyssal Surge*: `STAGES` (boss, HP, elites, wave
triples), `STAGE_TACTICS` (chokepath, flank, elevation, hazard, occupation, extraction, spawn
directions, seeded variation), and `STAGE_ENCOUNTER_ROUTES` (ordered objectives, per-direction
approach paths, finale paths, concurrency and commitment caps). `defense-run-simulation.js` consumes
them deterministically — the same seed must yield the same `getRunDigest()`. Presentation may
decorate objective points but may never redefine their order, wave ownership, pacing, retry budget,
or fairness caps.

OBSERVED envelope from the three shipped stages (2026-07-31):

| Field | cinder-span | abyss-chancel | echo-throne |
|---|---|---|---|
| `commitmentCap` | 3 | 4 | 4 |
| `maxConcurrentEnemies` | 8 | 9 | 10 |
| big-wave concurrent / cap / interval | 22 / 7 / 5 | 24 / 8 / 6 | 26 / 8 / 4 |
| `spawnIntervalTicks` | 18 | 24 | 15 |
| objective 1 | `corridor` r1100 @ (14600, 5200), waves 0-4 | `corridor` r1000 @ (15000, 6000), waves 0-3 | `corridor` r1050 @ (15200, 6000), waves 0-5 |
| objective 2 | `arena` r1400 @ (17400, 6000), waves 5-9 | `arena` r1500 @ (17600, 8200), waves 4-9 | `arena` r1550 @ (18000, 6000), waves 6-10 |
| retry budget | `maxAttempts: 3`, recovery 180–270 ticks | same | same |
| occupation | r900, hold 180 | r800, hold 330 | r800, hold 240 |
| extraction | r1000, window 600 | r850, window 600 | r900, window 600 |
| hazard | r1100, 8 dps | r1450, 16 dps | r1250, 10 dps |
| spawn directions | W, SW | W, SW, NW | W, SW, NW |
| boss HP scalar / boss ticks | 100 / 900 | 115 / 780 | 130 / 840 |

**ROLE:**
You are an encounter designer who has tuned live action games for twenty years. You design
encounters as decisions, not as actor counts. You add one pressure source at a time and require each
enemy archetype to force a distinct player response. You consider an encounter unfair if the player
cannot see the threat before committing, cannot recover after a mistake, or can be chain-killed off
screen.

**ACTION:**

1. Read `${blueprintPath}` and restate the map's anchor coordinates. Do not move them; if an anchor
   is wrong for the encounter, say so and stop for a blueprint revision.
2. Define the objective chain: objective 1 (`corridor`) and objective 2 (`arena`) with id, point,
   radius, owned wave slots, `recoveryTicks`, `maxAttempts`, `commanderFloorBp`, `gateFloorBp`, and
   the per-attempt reward deltas. Objective points must equal the blueprint anchors exactly —
   `stage-world-catalog.js` re-checks equality and throws otherwise.
3. Define approach paths per spawn direction. Each objective gets one path per direction in
   `spawnDirections`; the second objective's paths route through `contest:<objective-1-id>`.
4. Define the finale: contest waypoints, `contestTicks`, radii, and the boss threshold.
5. Define `STAGE_TACTICS`: chokepath (x, half-width), flank entry, elevation anchor and range
   multiplier, hazard (x, y, radius, dps), occupation (radius, `holdTicks`, effects), extraction
   (radius, `windowTicks`), `spawnDirections`, `seededVariation`.
6. Define the wave plan: per-slot tick, enemy archetype, count. Keep body counts inside the authored
   clear budget — `tests/stage-wave-doctrine.test.mjs` asserts that counts do not scale with stage
   HP.
7. State the caps: `commitmentCap`, `maxConcurrentEnemies`, and the big-wave triple. Justify each
   against the player's readable screen area at the real camera distance.
8. Specify the deterministic fixtures: low-resource start, each wave, each objective failure/retry,
   boss phase, victory, and death/retry — each as a seed plus tick offset.
9. State the reward cadence and prove each reward can be granted exactly once across a failure,
   a retry, and a re-entry.

**FORMAT:**
Two artifacts. (a) A markdown spec at
`_workspace/current/design/stage-encounter-${stageId}.md` containing the tables above and the
fairness argument. (b) A JavaScript patch proposal for `defense-catalog.js` written as the exact
literal that will be inserted into `STAGES`, `STAGE_TACTICS`, and `STAGE_ENCOUNTER_ROUTES`, in the
existing single-line-per-entry style of the file. No prose inside the code block.

**TARGET AUDIENCE:**
The implementing session and the numeric-balance reviewer. Both reject any value that is not
justified against an observed measurement or an explicit target.

**HARD CONSTRAINTS:**

- Determinism is a hard invariant. No `Math.random`, no wall-clock, no iteration over an unordered
  map in simulation-facing code. Same seed ⇒ same `getRunDigest()`.
- Every objective point coordinate is reused verbatim by the quest points in step 02; they are
  compared with `!==` on `x` and `y`.
- `maxAttempts` must stay finite and retry must be idempotent — no duplicated rewards, no reset that
  re-grants an item.
- Exactly two encounter objectives per stage: index 0 `corridor`, index 1 `arena`.
- Caps: committed attackers may never exceed the authored cap on any tick, in any wave, on any
  device.
- No Unity/Unreal concepts. This is Three.js + WebGL.

**DONE WHEN:**
`node --test tests/stage-wave-doctrine.test.mjs tests/stage-world-encounter-routing-contract.test.mjs`
passes for the new data, the committed-attacker cap test passes for every stage, and the retry
idempotence subtest passes for `${stageId}`.
