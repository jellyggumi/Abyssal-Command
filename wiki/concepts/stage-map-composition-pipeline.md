# Stage map composition pipeline

How an Abyssal Surge stage map is composed: what the data contract actually is, which of the
catalogued AI skills/tools may touch it, and which prompt drives each step.

Source: [[wiki/sources/2026-07-31-stage-map-composition-skill-catalog]].
Prompts: `prompts/approved/00`–`07`. Prompts are the operative artifact; this page is the reasoning
behind them.

## 1. The map is code, not an editor scene

`stage-world-catalog.js` is the immutable placement source of truth shared by simulation and
presentation. `defense-catalog.js` owns the arena constant, encounter routes, and tactics.
`battle-realtime-three.js` renders a read-only projection. Two consequences decide everything below:

- **A malformed map is a crash, not a failing test.** `validateProfile` runs at module import; an
  invalid profile throws and takes the game down. So map authoring is constraint satisfaction first
  and aesthetics second.
- **Determinism is a hard invariant.** Same seed ⇒ same `getRunDigest()`. No runtime generation, no
  load-time randomness, no presentation write-back. This is what disqualifies every *runtime*
  procedural-generation tool in the source catalog.

## 2. The canonical band grid [OBSERVED 2026-07-31]

All three shipped stages (`cinder-span`, `abyss-chancel`, `echo-throne`) use one skeleton on the
24000 × 12000 arena, gate at `(22000, 6000)`:

| Band (X) | Purpose | Evidence |
|---|---|---|
| 600–3000 | ingress apron, first beacon | `ingress (1800, 6000)`, ingress beacon props |
| 3000–6200 | approach, spawn resolution | west entries at x 6000–6200 in `STAGE_ENCOUNTER_ROUTES` |
| 6000–11800 | traverse, detour entry, silhouette read | detour entries x 5200–6000 |
| 11800–15200 | objective 1 (`corridor`, r 1000–1100) | `cinder-relay-crossing`, `chancel-nave-advance` |
| 15400–16200 | hazard core + extraction beacon | extraction r 850–1000, window 600 ticks |
| 17400–18400 | objective 2 (`arena`, r 1400–1550) + occupation + chokepath | `cinder-forge-stand`, occupation r 800–900 |
| 19000–21100 | boss threshold | finale contest waypoints |
| 21100–23400 | gate apron, keep-clear r 900 | `final-gate` waypoint |

Y splits into a north dressing band (≤ 2800), the main play band (4400–7600), and a south band
(≥ 9000). Exactly one dressing band carries the optional detour; the other stays non-walkable
dressing. Counts per stage: 3–6 obstacles, 12 props (validator allows 8–14), 6 landmarks (floor 4),
4 motivated lights (floor 2), 1 fog break, 1 VFX cue, 1 quest giver, 4 quest points.

This grid is a description of what shipped, not a law. A stage may depart from it — but it must
still clear every clause in §3, and the departure is recorded in `prompts/VERSIONS.md`.

## 3. The contract a stage map must satisfy

Every clause below is executable (`validateProfile`, `stage-world-catalog.js:382-563`), not advice.

| Area | Constraint |
|---|---|
| Plane | `surfaces: []`, every `elevation === 0`, exactly one flat mesh collider with non-degenerate triangles inside bounds |
| Bounds | inside `0..24000 × 0..12000` and containing `gate ± 900` on both axes |
| Routes | exactly 1 `critical` + ≥ 1 `optional-detour`; `corridorWidth ≥ 600`; ≥ 3 waypoints, each ≥ `corridorWidth/2` inside bounds; ≥ 2 `intermediate-*`; `final-gate` exactly at `(22000, 6000)` |
| Clearance | for every obstacle **and** prop vs every route segment: `distance ≥ radius + corridorWidth/2`; every obstacle vs the gate: `≥ radius + 900` |
| Obstacles | 1:1 with a prop at identical `x`, `y`, `footprintRadius` — invisible collision is a defect |
| Props | 8–14, `assets/mesh/` paths, no pairwise overlap (`distance ≥ rA + rB`) |
| Landmarks | ≥ 4, each bound to an existing prop, ids prefixed `landmark.` |
| Camera | `arenaBounds` inside gameplay bounds, flat focus inside bounds, `readableMargin ≥ 400` |
| Lighting | ≥ 2 `motivated-light` anchors, each sharing its emitter prop's exact position; ≥ 1 `fog-break`; all `occlusionSafe`, ≥ `obstacleRadius + 300` from every obstacle |
| VFX | `assets/motion/stage-vfx/<effectId>.glb` + clip `stage-vfx::<stageId>::loop::v01`, exactly |
| Quest layer | 1 quest giver (Lantern Reaver mesh, `quest-offer`); exactly 4 quest points whose placements **equal** `objectives[0].point`, `objectives[1].point`, `tactics.occupation`, `tactics.extraction`, in that order, with fixed visual roles and event bindings |
| Terrain | promoted `assets/mesh/terrain/**/runtime/**` XOR a `procedural-flat-support` fallback with a retained ineligible candidate; `/textured-candidate/` is never runtime |
| Identity | ids stage-scoped, unique silhouette profile per stage, profile set equal to `STAGES` |

The quest-point equality clause is the sharpest coupling in the repository: **the encounter design
(prompt 01) fixes coordinates that the world profile (prompt 02) must reproduce byte-identically.**
That is why encounters are designed before layout is authored, not after.

## 4. Which catalogued tools may touch this repository

| Class | Verdict |
|---|---|
| `/skill:author-game-levels`, `/skill:design-game-encounters`, `/skill:create-game-vfx`, `/skill:optimize-threejs-games`, `/skill:test-playable-web-games`, `/skill:ship-web-games`, `/skill:build-mobile-threejs-games` | **In-engine.** Directly applicable; they are the skills prompts 01–07 invoke. |
| WFC, BSP, room+corridor, Watabou, Roguebasin algorithms | **Offline proposal only.** Emit coordinates; a human curates; prompt 02 transcribes. Never at runtime. |
| Dungeon Architect, Houdini Engine, UE5 PCG, `shun126/DungeonGenerator` | **Wrong engine at runtime.** Usable only as an offline layout sketchpad whose coordinates are typed back into JavaScript. `CLAUDE.md` §2 forbids applying Unity/Unreal guidance here. |
| Meshy, Tripo, Sloyd, CSM, Scenario, Blockade Labs, Promethean | **Candidate lane only.** Output lands in the concept lane with `.provenance.json` and `runtimeEligible: false` until an explicit audit; the fixed tool per asset class in `CLAUDE.md` §3 still applies. |
| `/skill:unity-mcp`, Godot MCP, `/skill:omu`, `/skill:unity-gamedev-skill-pack`, `/skill:game-performance-profiler` | **Not applicable.** Different engine; not a translation exercise. |
| BlenderMCP | **Applicable to the offline pipeline** (`scripts/build-stage-vfx-blender.py`, `scripts/retarget-ingame-motion-blender.py`), never to the runtime. |

## 5. The pipeline

| Step | Prompt | Skill/tool | Gate |
|---|---|---|---|
| 0 | `00-stage-map-blueprint` | — | numeric bands, anchors, clearance arithmetic |
| 1 | `01-encounter-progression` | `/skill:design-game-encounters` | wave doctrine + routing contract suites |
| 2 | `02-stage-world-authoring` | `/skill:author-game-levels` | module imports; quest-point + presentation + movement suites |
| 3 | `03-procedural-layout` | WFC/BSP (offline) | flood-fill reachability + five clearance filters |
| 4 | `04-stage-dressing-assets` | gti / Rodin bridge / candidate generators | provenance + promotion audit + budget delta |
| 5 | `05-vfx-and-budget` | `/skill:create-game-vfx` → `/skill:optimize-threejs-games` | before/after frame time on one fixture |
| 6 | `06-regression-and-proof` | `/skill:test-playable-web-games` | quoted full regression + browser matrix |
| 7 | `07-release` | `/skill:ship-web-games` | deployed-artifact proof + rollback record |

Steps 3–5 are optional per stage; steps 0, 1, 2, 6 are not.

## 6. Baseline [OBSERVED 2026-07-31]

`node --test` over `stage-world-quest-points`, `stage-world-encounter-routing-contract`,
`world-presentation-contract`, `defense-stage-world-movement`, `stage-terrain-environment-contract`,
`stage-framing-and-motion-profile`, `stage-wave-doctrine`: **55 tests, 55 pass, 0 fail.**

The initial run of that set was 54/1. The failure was `stage-wave-doctrine` →
"re-picking a learned skill ranks it up instead of duplicating it", which asserted that *every*
passive rank-up increases `basicDamage`. `applySkillRankEffects` banks the stat the passive actually
authors — `eclipse-edge` pays `basicDamage`, `soul-magnet` pays `pickupRange`, `ward-binder` pays
`maxIntegrity` — so the assertion, not the simulation, was wrong. It now checks the authored stat
per passive. Deterministic before the fix (failed twice on the same seed) and green after.
