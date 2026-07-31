# 17 — Frame budget recovery

- **Version** v1 (2026-07-31)
- **Skills** `/skill:optimize-threejs-games`, `/skill:optimize-web-animations`
- **Produces** the before/after performance record proving the presentation work from prompts 11–16
  was paid for.
- **Placeholders** `${changeId}`, `${stageId}`, `${fixtureSeed}`, `${device}`, `${viewport}`.

---

**CONTEXT:**
The runtime already carries an explicit degradation ladder, and it is the ladder you must use before
inventing a new one.

```
quality tiers        full / low (softwareRenderer) / reduced-motion   (applyStageVfxPolicy)
transient pool       MAX_VISUAL_EFFECTS 40, families drop 3 / buff 2 / spawn 4 / deform 1
pool-free scenery    MAX_DROP_BEACONS 8
AoE burst   full     ringSegments 48, arcSegments 12, maxArcs 6, core true
            software ringSegments 20, arcSegments 6,  maxArcs 0, core false
animation   SIM_TICK_RATE 60, MAX_ANIMATION_TICK_DELTA 6, MAX_VISUAL_EVENT_KEYS 128
camera      CAMERA_POSITION_LAMBDA 6, CAMERA_LOOK_LAMBDA 11, tier transition 90 ticks
```

`MAX_ANIMATION_TICK_DELTA = 6` is the catch-up ceiling: a stalled tab cannot be paid back by
advancing animation more than six slices, which is what keeps a long session from spiralling.

The measurement rule from `CLAUDE.md` §6 is absolute: a number without a stated device, viewport,
quality tier and fixture is not a measurement. Comparing a run on one fixture to a run on another is
not a delta.

**ROLE:**
You are a performance engineer who measures before changing behaviour and re-measures after every
single change. You degrade decoration before readability, and you never lower a quality setting to
make a number look better without saying you did.

**ACTION:**

1. Record the baseline **before** the presentation change is wired in, on the deterministic fixture
   `${fixtureSeed}` at a fixed tick: `${device}`, `${viewport}`, quality tier, player position,
   enemy count, active effect count, frame-time sample, draw calls, triangles, texture count,
   console warnings.
2. Wire the change in and re-measure the **identical** fixture at the **identical** tick. Report the
   delta per metric in its own column. A missing baseline means there is no delta and the step is not
   done.
3. Measure the worst case, not the median: the pool at 40, the `spawn` family at 4, the arrival
   formation from prompt 11 at its largest wave, a boss telegraph preempting an unresolved impact,
   and the `BIGWAVE`/`FINALE` camera tier at zoom 41.5.
4. If frame time regressed, apply low-risk fixes in this order and re-measure after each one:
   reuse geometry and materials → pool transient objects → cull offscreen work → cap particles →
   throttle non-critical UI → update only changed transforms. Each fix gets its own measured row.
5. Check the animation-side costs specifically: offscreen work paused, no per-frame allocation in the
   rAF loop, mixers retired with their records, no listener or texture retained after `dispose()`,
   and no growth in retained memory across a long session.
6. Prove the degradation ladder still degrades. Measure at `full`, at the software tier, and under
   `prefers-reduced-motion`. The software tier must remain arc-free and core-free on the AoE burst,
   and reduced motion must remain a static-but-legible state rather than an absence.
7. Confirm the animation catch-up ceiling holds: background the tab, return, and verify animation
   advances by at most `MAX_ANIMATION_TICK_DELTA = 6` slices rather than replaying the gap.
8. Close every temporary server, benchmark and browser tab opened for measurement. Leave resources
   owned by other active tasks alone.

**FORMAT:**
Markdown at `_workspace/current/qa/perf-${changeId}.md`: the baseline block with all nine fields, the
before/after table with one row per metric and an explicit delta column, the worst-case measurements,
the applied-optimizations list with per-change measurements, the three-tier degradation table, and
the catch-up verification. Every number `[OBSERVED]` with the command or artifact that produced it.

**TARGET AUDIENCE:**
The QA session running prompt 18 and the release owner running prompt 19, who compare like with like
and reject any measurement without a stated device, viewport, quality tier and fixture.

**HARD CONSTRAINTS:**

- Baseline first, on the same fixture and the same tick. No baseline, no claim.
- Worst case is the measurement that counts. Median frame time hides the eviction storm.
- Do not lower a quality tier blindly to hide a regression, and never suppress a console warning to
  make a gate pass.
- Keep quality settings explicit and reversible.
- No allocation per frame in the render loop.
- `MAX_ANIMATION_TICK_DELTA = 6` is the catch-up ceiling; do not raise it to smooth a stall.
- Close temporary servers and tabs you opened; leave other sessions' resources alone.

**DONE WHEN:**
Before/after metrics exist for the same fixture and tick with an explicit delta column, worst-case
rows are present, frame time is at or below baseline or the regression is explicitly accepted with a
number and a reason, all three quality tiers are measured, the catch-up ceiling is verified, and the
module still imports without throwing.
