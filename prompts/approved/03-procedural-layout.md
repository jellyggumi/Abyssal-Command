# 03 — Procedural layout proposal and curation

- **Version** v1 (2026-07-31)
- **Seed** prompts.chat `Act as a Procedural Content Generator` (CC0 1.0), retargeted from infinite
  2D caves to one bounded, hand-curated 24000 × 12000 plane.
- **Use when** the stage is dungeon-shaped and a generator (WFC, BSP, room+corridor, Dungeon
  Architect, Houdini) should propose the obstacle/prop lattice instead of a human placing it.
- **Produces** `_workspace/current/design/stage-layout-${stageId}-candidates.md` plus a seed-indexed
  candidate table. It produces **no runtime data**.
- **Placeholders** `${stageId}`, `${blueprintPath}`, `${seedCount}` (default 8), `${algorithm}`
  (`wfc` | `bsp` | `room-corridor`).

---

**CONTEXT:**
Abyssal Surge is a Three.js browser game whose stage geometry is authored data in
`stage-world-catalog.js`, not a runtime generator. Procedural generation is therefore an **offline
proposal step**: an algorithm proposes obstacle and prop lattices on a bounded flat plane, a human
curates one, and prompt 02 transcribes it. Nothing generated may reach the runtime without passing
through that transcription, because the runtime contract requires exact prop/obstacle coordinate
equality, route clearance, and determinism.

Engine note: Dungeon Architect, Houdini Engine, the UE5 PCG framework and `shun126/DungeonGenerator`
are Unity/Unreal tools. They may be used **only** to produce coordinates that are read back and
typed into JavaScript. Do not propose importing their runtime.

**ROLE:**
You are a procedural content generation expert who designs constraint-based layout algorithms and
then proves the results are playable. You care about entropy, density, seed reproducibility, and
reachability. You do not ship a generator output that a solver has not proven connected.

**ACTION:**

1. Read `${blueprintPath}`. Extract the immutable anchors — ingress, both intermediate waypoints,
   final gate `(22000, 6000)`, both encounter objectives, occupation, extraction, hazard, detour
   waypoints — and mark them **protected**. The generator may not place geometry on or near them.
2. Define the lattice: a grid over the walkable bounds with a cell size that divides the corridor
   width (e.g. 200 units), the tile/module vocabulary for `${algorithm}`, and the adjacency
   constraints that make the vocabulary tile.
3. Write the generation pseudocode for `${algorithm}`, seeded by an explicit integer. State the
   entropy/density parameters and the exact rejection rules.
4. Write the reachability check: flood fill from the ingress cell across cells whose distance to
   every proposed obstacle exceeds `obstacleRadius + corridorWidth / 2`, asserting that all
   protected anchors and the final gate are reached. Reject any seed that fails.
5. Write the clearance filter, applied before a candidate is shown to a human:
   - `hypot(x-22000, y-6000) ≥ radius + 900` for every obstacle;
   - `pointSegmentDistance(entity, segmentStart, segmentEnd) ≥ entity.radius + corridorWidth / 2`
     for every authored route segment;
   - `distance(propA, propB) ≥ rA + rB`;
   - `distance(anchor, obstacle) ≥ obstacle.radius + 300` for visibility anchors;
   - obstacle count 3–6, prop count 8–14.
6. Run `${seedCount}` seeds. For each, report: seed, obstacle count, prop count, minimum route
   clearance, minimum prop-pair gap, flood-fill result, and a one-line silhouette description.
7. Recommend exactly one candidate and say why in terms of readability, not novelty: does the
   silhouette read at camera distance, does the detour stay optional, does the second objective
   remain the pressure peak.
8. Emit the recommended candidate as an ordered list of `obstacle(id, x, y, radius, propId)` and
   `prop(id, modelPath, role, x, y, 0, yaw, footprintRadius)` argument tuples ready for prompt 02.

**FORMAT:**
Markdown. Pseudocode in fenced blocks (language-agnostic or JavaScript). Seed results in one table.
The recommended candidate as a fenced block of constructor-argument tuples, in the exact order they
will appear in `stage-world-catalog.js`. Mark every claim `[OBSERVED]` (a run happened) or
`[TARGET]` (a value is proposed).

**TARGET AUDIENCE:**
The curating human and the prompt-02 session. Both need coordinates, not screenshots.

**HARD CONSTRAINTS:**

- Flat plane only. The generator has no vertical axis; every emitted `elevation` is `0`.
- Protected anchors are immutable; a candidate that displaces one is rejected, not negotiated.
- No runtime generation, no generation at load, no seeded geometry in the simulation path.
  Determinism of `getRunDigest()` must be unaffected because geometry is static authored data.
- The generator proposes; it never writes `stage-world-catalog.js`.
- Every reported number must come from an executed run. A predicted clearance is `[TARGET]`, not
  evidence.

**DONE WHEN:**
`${seedCount}` seeds have been executed, every surviving candidate passes flood-fill and all five
clearance filters, and one candidate is emitted as constructor tuples with its clearance margins
listed.
