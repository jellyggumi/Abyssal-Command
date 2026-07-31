# 14 — Runtime VFX implementation

- **Version** v1 (2026-07-31)
- **Skills** `/skill:create-game-vfx`, `/skill:threejs-shaders`
- **Produces** the shipped cue: asset, wiring, anchoring, lifetime, cleanup — implementing prompt 10's
  spec exactly.
- **Placeholders** `${cueId}`, `${effectId}`, `${eventType}`, `${stageId}`, `${fixtureSeed}`.

---

**CONTEXT:**
Two cue shapes exist and they are not interchangeable.

**Stage ambient cue** — authored in `stage-world-catalog.js`, validated at import, one per stage:

```
modelPath      assets/motion/stage-vfx/${effectId}.glb        exact string, no tolerance
clip           stage-vfx::${stageId}::loop::v01               exact string, no tolerance
qualityGroups  { core: "vfx-core", detail: "vfx-detail", decor: "vfx-decor" }
reducedMotion  "core-static"
placement      cinder-span 15400,6000 · abyss-chancel 14200,6000 · echo-throne 15400,6000
```

Built offline by `scripts/build-stage-vfx-blender.py`. `instantiateStageVfx()` fails closed on a
missing node name rather than cloning the whole scene — a typo'd group name is a hard failure, which
is the intended behaviour.

**Transient event cue** — pooled, driven by `VFX_MODELS` (88 event ids), capped at
`MAX_VISUAL_EFFECTS = 40` with per-family live budgets `drop 3 / buff 2 / spawn 4 / deform 1`.
`spawnVfx()` offsets every placeholder 0.6 above its anchor and `worldPointInto()` maps gameplay
elevation through the same `WORLD_SCALE`/arena-height ratio the actor path uses. Arena is
24000 × 12000 mapped to ±14 world units.

The failure mode is **silent absence**: `effectAnchor()` returns null for an unanchorable event and
`spawnVfx()` hard-returns with no console warning. A cue that never spawns looks exactly like a cue
that was never requested.

Readability floor: 44 px at every zoom tier. The drop beacon is authored at 1.35 world units for
exactly this reason — 92 px at default orbit and 46 px at max zoom — while the 1.2 default VFX height
gives 41 px zoomed out and fails the floor.

**ROLE:**
You are a Three.js VFX engineer who pools transient objects, reuses geometry and materials, caps
particles, and never allocates per frame. You degrade decorative work before touching combat
readability. You know a shader is the last resort, not the first idea.

**ACTION:**

1. Re-read prompt 10's spec for `${cueId}`. Implement it. A change of mind here is a change to that
   file first, in the same commit.
2. Choose the cue shape. Persistent stage ambience is a stage cue; anything triggered by an event is
   a pooled transient. Persistent scenery that must not consume a pool slot follows the drop-beacon
   precedent: `MAX_DROP_BEACONS = 8`, its own group, its own sweep, no pool record.
3. Build the asset with `scripts/build-stage-vfx-blender.py` and write the exact `modelPath` and
   `clip` strings. For a stage cue, author all three quality group node names or the load fails.
4. Anchor the cue. If `effectAnchor()` cannot resolve `${eventType}`, extend it deliberately and say
   what the anchor is — an event may be its own anchor, as the drop and deformation families are.
   Never leave an event that reaches `spawnVfx()` without an anchor.
5. Resolve lifetime through `resolveVfxLifetimeTicks()` and let the payload win. Do not add a new
   constant when the event already carries the number the rule uses.
6. Meet the 44 px readability floor at max zoom (`41.6` on `cinder-span` / `echo-throne`, `36` on
   `abyss-chancel`). State the pixel size at the default orbit and at max zoom. Height, not area,
   when the cue must read as a vertical marker.
7. Reach for a custom shader only after instancing, geometry reuse and material reuse have been tried
   and measured. If a `ShaderMaterial` or `onBeforeCompile` hook is genuinely required, keep uniforms
   minimal, keep the material shared, and confirm it does not force a second render pass. Actors
   render with banded cel shading rather than smooth PBR — a new material must not break that.
8. Implement cleanup as idempotent. Reset, death, stage switch, pause and `dispose()` must not leak
   an effect, and a second cleanup must be a no-op. Stage switches replace decor resources; `dispose()`
   clears all tracked stage presentation.
9. Implement the reduced-motion branch from the spec, and re-pose it synchronously in
   `setReducedMotion()` so a runtime toggle takes effect immediately rather than on the next tick.
10. Verify the failure modes: overlapping cues, multiple targets, rapid repetition, the pool at 40,
    the family at its live budget, a cold load racing an active cue, pause/resume, the software
    renderer tier, `prefers-reduced-motion`, and both touch orientations.

**FORMAT:**
Markdown at `_workspace/current/engineering/vfx-${cueId}.md`: the implemented contract diffed against
prompt 10's spec, the anchor derivation, the lifetime branch taken, the pixel-size table at default
and max zoom per stage, the shader justification if any, the cleanup idempotence proof, and the
failure-mode checklist with pass/fail per row.

**TARGET AUDIENCE:**
The performance owner running prompt 17 and the QA session running prompt 18.

**HARD CONSTRAINTS:**

- `modelPath` and `clip` must match the validator strings exactly; there is no tolerance.
- One stage ambient cue per stage unless the validator and its tests change in the same commit.
- The pool budget is imported, never restated. Family live budgets are `drop 3 / buff 2 / spawn 4 /
  deform 1`.
- A cue that can reach `spawnVfx()` must have a resolvable anchor. Silent absence is a defect, not a
  quiet default.
- Every cue clears the 44 px readability floor at that stage's max zoom.
- Presentation may read simulation snapshots and must never write back or alter `getRunDigest()`
  inputs.
- Cleanup is idempotent; a second cleanup is a no-op.
- Banded cel shading is the shipped look. A new material must not silently reintroduce smooth PBR.
- No allocation per frame. Pool, reuse, cap.

**DONE WHEN:**
The cue spawns, anchors, lives for the resolved lifetime and retires under every failure mode; the
readability floor is met with stated pixel numbers; cleanup is proven idempotent; reduced motion
re-poses synchronously; and `node --test tests/combat-presentation-contract.test.mjs
tests/world-presentation-contract.test.mjs tests/runtime-visual-assets.test.mjs` passes.
