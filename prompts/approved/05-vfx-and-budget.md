# 05 — Stage VFX and frame budget

- **Version** v1 (2026-07-31)
- **Skills** `/skill:create-game-vfx`, then `/skill:optimize-threejs-games`
- **Produces** the stage VFX cue and its supporting effect asset, plus a before/after performance
  record proving the budget was paid back.
- **Placeholders** `${stageId}`, `${effectId}` (e.g. `${stageId}-ember-wake`), `${motif}`,
  `${fixtureSeed}`.

---

**CONTEXT:**
`stage-world-catalog.js` accepts exactly one shape of VFX cue: `modelPath` must equal
`assets/motion/stage-vfx/<effectId>.glb` and `clip` must equal `stage-vfx::${stageId}::loop::v01`.
Anything else throws at import. The cue mesh is produced offline by
`scripts/build-stage-vfx-blender.py`; the renderer (`battle-realtime-three.js`) plays it as a
read-only decoration that must not touch simulation state. `CLAUDE.md` §2 forbids building VFX
polish before the system it communicates exists, so this step runs only after prompts 01 and 02 are
green.

**ROLE:**
You are a VFX engineer for a browser game who makes gameplay meaning visible before adding
spectacle, and a performance engineer who measures before changing behaviour. You pool short-lived
objects, reuse materials and geometry, cap particles, and never allocate per frame. You degrade
decorative effects before you touch combat readability or controls.

**ACTION:**

1. Specify the cue: trigger, owner, duration, gameplay meaning, silhouette at the real camera
   distance, colour hierarchy against `${motif}`, spawn cap, cleanup rule, and the reduced-motion
   equivalent. Separate telegraph, contact, success, failure, and lingering-status visuals.
2. Place the cue at the coordinate the blueprint reserved — the three shipped stages put it on the
   hazard/extraction axis (x 14200–15400, y 6000) so it reads as the stage's pressure centre.
3. Build the asset with `scripts/build-stage-vfx-blender.py` and write it to
   `assets/motion/stage-vfx/${effectId}.glb` with clip name `stage-vfx::${stageId}::loop::v01`.
4. Record a baseline **before** wiring the cue in: device, viewport, quality tier, player position,
   enemy count, active effects, frame-time sample, draw calls, triangles, texture count, console
   warnings — captured on the deterministic fixture `${fixtureSeed}` at a fixed tick.
5. Wire the cue into the profile's `vfxCues` and re-measure the identical fixture at the identical
   tick. Report the delta per metric.
6. If frame time regressed, apply low-risk fixes first: reuse geometry/materials, pool transient
   objects, cull offscreen work, cap particles, throttle non-critical UI, update only changed
   transforms. Re-measure after each change; keep quality settings explicit and reversible.
7. Verify the failure modes: overlapping cues, multiple targets, rapid repetition, pause/resume,
   lowest quality tier, `prefers-reduced-motion`, and touch viewports in both orientations.
8. Confirm cleanup is idempotent — reset, death, and pause must not leak an effect, and a second
   cleanup must be a no-op.

**FORMAT:**
Markdown at `_workspace/current/qa/stage-vfx-${stageId}.md`: the effect specification table, a
before/after metrics table with one row per metric and an explicit delta column, the list of applied
optimizations with per-change measurements, and the failure-mode checklist with pass/fail per row.
Every number is `[OBSERVED]` with the command or artifact that produced it.

**TARGET AUDIENCE:**
The QA session running prompt 06 and the performance owner. They compare like with like and reject
any measurement without a stated device, viewport, and fixture.

**HARD CONSTRAINTS:**

- `modelPath` and `clip` must match the validator strings exactly; there is no tolerance.
- Presentation may read simulation snapshots and must never write back or alter `getRunDigest()`
  inputs.
- One VFX cue per stage unless the validator and its tests are updated in the same commit.
- Reduced motion is a supported mode, not a fallback: the cue must have a static equivalent that
  still communicates the same gameplay meaning.
- Do not lower quality blindly to hide a regression, and never suppress a console warning to make a
  gate pass.
- Close temporary servers, benchmarks, and browser tabs opened for measurement; leave resources
  owned by other active tasks alone.

**DONE WHEN:**
Before/after metrics exist for the same fixture, frame time is at or below baseline (or the
regression is explicitly accepted with a number and a reason), the failure-mode checklist is fully
green, and the module still imports without throwing.
