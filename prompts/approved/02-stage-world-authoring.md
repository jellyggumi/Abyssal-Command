# 02 — Stage world authoring

- **Version** v1 (2026-07-31)
- **Skill** `/skill:author-game-levels`
- **Produces** the `profiles[]` entry for `${stageId}` in `stage-world-catalog.js` — the single
  deterministic placement source of truth for gameplay and presentation.
- **Placeholders** `${stageId}`, `${stageName}`, `${sequence}`, `${blueprintPath}`,
  `${encounterSpecPath}`, `${silhouetteProfile}`, `${accentHex}`.

---

**CONTEXT:**
`stage-world-catalog.js` freezes one profile per canonical stage and validates it at module load
through `validateProfile` (lines 382–563). An invalid profile does not fail a test — it throws on
import and takes the whole game down. Every constraint below is a literal clause of that validator,
so treat this section as executable, not advisory. Gameplay data (`bounds`, `obstacles`, `surfaces`,
`meshColliders`, `routes`) feeds the simulation; presentation data (`palette`, `atmosphere`,
`cinematic`, `silhouette`, `camera`, `landmarks`, `props`, `visibilityAnchors`, `vfxCues`, `npcs`,
`questPoints`) feeds the renderer and may never write back.

**ROLE:**
You are a level author who ships deterministic, data-driven levels for browser games. You keep
authored level data, visual geometry, collision geometry, navigation, and encounter zones as
separate layers sharing stable IDs, and you never infer a collision or navigation boundary from
decoration. You motivate every local light with a visible emitter.

**ACTION:**

1. Read `${blueprintPath}` and `${encounterSpecPath}`. List every coordinate you are about to write
   and its source line. Any coordinate without a source is a defect.
2. Write `stageId`, `sequence`, `name`, and the terrain strategy. Choose exactly one:
   - promoted runtime mesh: `terrainGlbPath` under `assets/mesh/terrain/…/runtime/…`,
     `terrainRuntimeEligible: true`, and **no** `terrainFallback`; or
   - procedural fallback: `terrainFallback: { kind: "procedural-flat-support", reason: "<why>" }`,
     `terrainRuntimeEligible: false`, no `terrainGlbPath`, and a retained
     `terrainSourceCandidatePath` under `assets/mesh/terrain/`.
   `/textured-candidate/` paths are never runtime-eligible.
3. Write `gameplay.bounds` inside `0..24000` × `0..12000`, containing `(22000 ± 900, 6000 ± 900)`.
4. Write `gameplay.obstacles` (3–6). Each needs `elevation 0`, `radius > 0`, a `propId`, a footprint
   fully inside bounds, `hypot(x-22000, y-6000) ≥ radius + 900`, and a prop at the identical `x`,
   `y`, `footprintRadius`.
5. Write `gameplay.surfaces: []` and exactly one `meshCollider` whose triangles are all inside
   bounds, all `elevation 0`, and none degenerate (signed area ≠ 0).
6. Write `gameplay.routes`: exactly one `critical` route and at least one `optional-detour`. Each
   route needs `corridorWidth ≥ 600` and ≥ 3 waypoints, each waypoint at least `corridorWidth / 2`
   inside bounds. The critical route needs ≥ 2 `intermediate-*` waypoints and a `final-gate`
   waypoint at exactly `(22000, 6000)`.
7. Verify route clearance for every segment against every obstacle **and** every prop:
   `pointSegmentDistance(entity, start, end) ≥ entity.radius + corridorWidth / 2`.
8. Write `presentation.props` (8–14). Each `modelPath` starts with `assets/mesh/`, `elevation 0`,
   inside bounds, `footprintRadius > 0`, and no two props overlap
   (`distance ≥ r_left + r_right`).
9. Write `presentation.landmarks` (≥ 4), each pointing at an existing prop id and placed flat inside
   bounds. Landmark ids use the `landmark.` prefix.
10. Write `presentation.camera`: `arenaBounds` inside gameplay bounds, `focus` inside bounds at
    `elevation 0`, `readableMargin ≥ 400`.
11. Write `presentation.visibilityAnchors`: ≥ 2 `motivated-light` (each `sourcePropId` referencing a
    prop and sharing its exact `x`/`y`) and ≥ 1 `fog-break`. All anchors: `occlusionSafe: true`,
    `elevation 0`, `radius > 0`, inside bounds, and ≥ `obstacle.radius + 300` away from every
    obstacle.
12. Write `presentation.vfxCues`: `modelPath` exactly
    `assets/motion/stage-vfx/<effectId>.glb` and `clip` exactly
    `stage-vfx::${stageId}::loop::v01`.
13. Write `presentation.npcs`: exactly one quest giver using
    `assets/mesh/character/lantern-reaver-character/glb/base_basic_pbr.glb`, flat, inside bounds,
    with `questCue: "quest-offer"`, `interactionRadius > 0`, and a `questId` prefixed
    `${stageId}:`.
14. Write `presentation.questPoints` — exactly four, in this order, with distinct visual roles and
    distinct placements, all sharing the quest giver's `questId`:
    | order | visualRole | placement must equal | eventBinding |
    |---|---|---|---|
    | 1 | `route-objective` | `STAGE_ENCOUNTER_ROUTES[stageId].objectives[0].point` | `{ type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: <objective 0 id> }` |
    | 2 | `route-gate` | `objectives[1].point` | `{ type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: <objective 1 id> }` |
    | 3 | `occupation-focus` | `STAGE_TACTICS[stageId].occupation` | `{ type: "OCCUPATION_CAPTURED", occupationPointId: <occupation id> }` |
    | 4 | `extraction-beacon` | `STAGE_TACTICS[stageId].extraction` | `{ type: "OBJECTIVE_COMPLETED", objectiveId: "boss-kill" }` |
15. Write `presentation.palette`, `atmosphere` (with distinct `fogNear`/`fogFar`), `cinematic.intro`
    (`durationTicks` an integer in `1..300`), `silhouette.profile = ${silhouetteProfile}` (unique
    across all stages), and `editorial(order, title, summary, rewardHint)`.
16. Re-run the validator by importing the module (`node -e "import('./stage-world-catalog.js')"`)
    before claiming anything.

**FORMAT:**
A direct edit to `stage-world-catalog.js` in the existing style: helper constructors (`bounds`,
`obstacle`, `meshCollider`, `triangle`, `waypoint`, `route`, `landmark`, `prop`,
`visibilityAnchor`, `vfxCue`, `lookout`, `questPoint`, `editorial`), one entity per line, no new
abstraction layer, no reformatting of untouched lines. Report the diff plus the validator result.

**TARGET AUDIENCE:**
Reviewers who read `validateProfile` first and the prose second, and the renderer session that will
load the profile without a fallback.

**HARD CONSTRAINTS:**

- Every `elevation` is `0`. No stairs, ramps, platforms, pits, ledges, or vertical traversal. Visual
  height, if any, is non-walkable background dressing that changes nothing about navigation,
  occlusion, targetability, or camera.
- All ids are unique within the profile and prefixed `${stageId}:` — except landmarks (`landmark.`).
- The number of profiles must equal `STAGES.length`, and each `silhouette.profile` must be unique.
  `STAGE_SHOWCASE_IDS` currently asserts exactly three editorial showcases: adding a fourth stage
  requires updating that assertion deliberately, in the same commit, with a stated reason.
- Presentation never mutates simulation state and never alters `getRunDigest()` inputs.

**DONE WHEN:**
The module imports without throwing and
`node --test tests/stage-world-quest-points.test.mjs tests/stage-world-encounter-routing-contract.test.mjs tests/world-presentation-contract.test.mjs tests/defense-stage-world-movement.test.mjs tests/stage-terrain-environment-contract.test.mjs`
passes with the counts reported verbatim.
