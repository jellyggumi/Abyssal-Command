# Runtime Performance and Responsiveness Budget

**Status:** target budget and measurement plan; no browser performance baseline was run  
**Primary mode:** runtime frame budget  
**Secondary mode:** interaction-to-visible-feedback  
**Gate:** Stage 3 G4/G6 candidate; it cannot pass until the probes below produce samples

## Truthful baseline status

No p50/p95 frame, input, path, memory, draw-call, or map-build measurements were captured in this discovery task. The numbers in this document are **budgets**, not current-build results. Repository facts and existing focused test results are separated from recommended gates.

The deterministic balance simulator result in `movement-optimization.md` is reducer/strategy evidence only. Its 22.05 s wall time is not a browser runtime benchmark and must not be used as one.

## External basis

- [web.dev RAIL](https://web.dev/articles/rail) treats response within 100 ms as immediate and recommends keeping event handling work within roughly 50 ms. This project adopts the stricter distribution gate **command-to-visible-feedback p95 ≤100 ms**, not merely a 200 ms web-vitals threshold.
- [web.dev Rendering Performance](https://web.dev/articles/rendering-performance) explains the 60 Hz frame window: 16.67 ms total, with browser overhead reducing time available to application work. This project therefore budgets main-thread work below the full frame window.
- [W3C Event Timing](https://www.w3.org/TR/event-timing/) defines `PerformanceEventTiming` timestamps used to separate input delay, handler processing, and next-paint presentation.
- [W3C Pointer Events](https://www.w3.org/TR/pointerevents/) defines capture, cancellation, and lost-capture lifecycle used by the control probes.

## Observed runtime cost surfaces

| Surface | Source evidence | Current risk/strength |
|---|---|---|
| WebGL frame loop | `battle-realtime-three.js:731-780` updates engagements, commander, allies, enemies, mixers, markers, ambience, particles, camera, audio listener, runtime state, then renders. | One synchronous per-frame hot path; 50 ms clamp loses simulation time under stalls. |
| WebGL collision | `battle-realtime-three.js:884-958` samples every ≤0.12 units and scans blockers/allies/enemies. | Broad scans scale toward actor-pair work; segment length multiplies it. |
| WebGL DPR | `battle-realtime-three.js:68-71`, `battle-realtime-three.js:1179-1187`; tier behavior is covered at `tests/battle-realtime-three.test.mjs:217-284`. | Existing 1.25/1.5/2 caps are a useful GPU guardrail and should be retained until traces justify change. |
| WebGL particles | One fixed 360-point pool and one draw call (`battle-realtime-three.js:104-110`). | Bounded storage/draw cost is good. |
| WebGL shadows | One 1024² shadow map and fixed light frustum (`battle-realtime-three.js:42-46`, `battle-realtime-three.js:449-461`). | Predictable current cost, but fixed extent will not cover arbitrary map bounds. |
| Canvas frame loop | `battle-visualizer.js:1775-1798` can run up to 20 substeps after a 1 s elapsed clamp, then builds/renders dynamic records. | A resumed/slow frame can create a large main-thread spike. |
| Canvas static terrain | `battle-visualizer.js:372-450` scans every tile on build/resize and caches sorted offscreen chunks. | Good static/dynamic separation; larger maps increase build time and offscreen backing memory. |
| Canvas dynamic allocations | Each ally/enemy update creates target/preferred objects and filtered neighbor arrays (`battle-visualizer.js:1298-1348`). Dynamic records add all particles (`battle-visualizer.js:1434-1481`). | Avoidable per-frame garbage; cost grows with actors and effects. |
| Canvas particles | `burst` pushes growable objects; update splices expired objects (`battle-visualizer.js:1131-1144`, `battle-visualizer.js:1365-1379`). | Unlike WebGL, fallback has no capacity bound. |
| Canvas runtime publication | `getRuntimeState` creates an object and `publishRuntimeState` JSON-stringifies it on every update before signature rejection (`battle-visualizer.js:1069-1090`). | Small current cost, but avoidable at 60 Hz. |
| App command feedback | Accepted action synchronizes renderer, triggers semantic visual feedback, and renders before awaiting persistence (`app.js:2118-2147`). | Primary feedback can meet the local latency target without storage. |
| App receipt event | `abyssal:command-resolved` is scheduled in `finally`, after the awaited persistence path completes (`app.js:2147-2155`). | Any UI that treats this receipt as first feedback inherits storage tail latency. Measure separately and do not hide primary feedback behind it. |
| App periodic render | Battle starts a 100 ms `render` interval (`app.js:1465-1473`). | Sufficient for cooldown text, not sufficient as the first movement/action feedback mechanism. |
| Renderer fallback | A WebGL failure constructs and initializes a fresh Canvas renderer, then reapplies campaign state (`app.js:1487-1514`). | Cold asset/static-layer work can delay first fallback frame and recreates spatial simulation. |

## Reference workload

Budgets are evaluated per renderer against the same scenarios.

### Scenario A — current-stage compatibility

- All 10 current `16 × 8` stages.
- Maximum current authored legion/wave combination from v6 campaign data.
- 60 seconds after a 5-second warm-up.
- Repeated move, orbit/drag, zoom, and available campaign actions.

### Scenario B — large-map canary

- `24 × 12`, three material lanes/zones.
- 30 live tactical actors, 360 live presentation particles, one active boss/portal/node set.
- 60 seconds after warm-up; 200 discrete input samples.

### Scenario C — stress, not content acceptance

- `40 × 24` (960 cells), 60 actors, 360 particles.
- Alternating 12 path goals, continuous movement, camera orbit/zoom, and injected 100 ms stalls.
- This scenario may degrade visual quality, but it must not corrupt campaign state, leak memory, exceed bounded catch-up, or diverge between renderers.

### Viewports

- Desktop: `1440 × 900`, device DPR 2, WebGL cap 2.
- Compact touch: `390 × 844`, device DPR 3, WebGL cap 1.25.
- Tactical landscape: `960 × 540`, device DPR 2, WebGL cap 2.
- Both motion-enabled and `prefers-reduced-motion: reduce` Canvas paths.

Record browser/version, OS, viewport, DPR/cap, power mode, thermal state, and whether DevTools CPU throttling is active. Compare only like-for-like samples.

## Numeric budgets

### Interaction and control budgets

All times are event timestamp to the stated milestone unless noted.

| Metric | p50 budget | p95 budget | Hard guardrail | Instrumentation site |
|---|---:|---:|---:|---|
| Campaign command → first visible local acknowledgement | ≤50 ms | **≤100 ms** | No accepted command without feedback | Input interpreter mark → first renderer/local-fallback paint after `app.js:2143-2146` |
| Command input delay (`processingStart - startTime`) | ≤16 ms | ≤50 ms | ≤100 ms | `PerformanceEventTiming` |
| Command synchronous handler processing | ≤4 ms | ≤12 ms | ≤50 ms | `processingEnd - processingStart`; custom marks around intent/reducer/sync |
| Keyboard movement keydown → first changed commander frame | ≤16.7 ms | ≤33.4 ms | ≤50 ms | Key event mark → tactical snapshot/rendered position change |
| Pointer/touch drag sample → changed camera frame | ≤16.7 ms | ≤33.4 ms | ≤50 ms | `pointermove` mark → camera matrix/Canvas view paint |
| Pointer up/cancel/lost capture → gesture state cleared | ≤1 ms | ≤8 ms | Before next input event | Shared input interpreter state assertion |
| WebGL failure → first Canvas frame from retained runtime | ≤50 ms | ≤100 ms | ≤250 ms | Context-loss mark → Canvas paint; separately report cold asset completion |
| Native button vs keyboard vs pointer vs touch p95 spread for same campaign action | — | ≤16.7 ms | No surface >100 ms | Group identical action samples by `source` |

`PerformanceEventTiming.duration` is rounded by the platform and may omit very short entries depending on observer threshold. Pair it with custom high-resolution marks and report both rather than manufacturing precision.

### Frame budgets at 60 Hz

| Metric | p50 budget | p95 budget | p99/guardrail | Notes |
|---|---:|---:|---:|---|
| Presented frame interval | ≤16.7 ms | **≤16.7 ms** | ≤33.4 ms | Stage 3 gate; report dropped-frame percentage as well. |
| Total main-thread application work per active frame | ≤8 ms | ≤12 ms | <16.7 ms | Leaves browser/compositor headroom. |
| Shared tactical `simulate(h)` step, 30 actors | ≤1.5 ms | ≤3 ms | ≤4 ms | Measure without renderer. |
| Shared tactical catch-up, 6 steps | ≤6 ms | ≤10 ms | ≤12 ms | Only after a stall; never unbounded. |
| One cached flow-field lookup for actor step | ≤0.05 ms | ≤0.10 ms | ≤0.25 ms | O(1) typed-array lookup. |
| One new `40 × 24` flow-field build | ≤0.5 ms | ≤2 ms | ≤4 ms | Cold goal; batch separately from frame if needed. |
| Batch route issue to 30 selected actors | ≤1 ms | ≤3 ms | ≤4 ms | Shared field, not 30 independent quadratic A* scans. |
| WebGL JS update + render submission, 30 actors | ≤5 ms | ≤8 ms | ≤10 ms | GPU completion measured separately where supported. |
| WebGL GPU frame | ≤10 ms | ≤14 ms | ≤16.7 ms | Use disjoint timer query when available; otherwise label as trace estimate. |
| Canvas dynamic update + render, 30 actors/360 particles | ≤6 ms | ≤10 ms | ≤12 ms | Static terrain excluded after warm-up. |
| Canvas static build, `24 × 12` | ≤15 ms | ≤30 ms | ≤50 ms | Cold/resize metric, not every frame. |
| Canvas static build, `40 × 24` stress | ≤25 ms | ≤50 ms | ≤100 ms | May be scheduled/yielded if over one frame. |
| Runtime-state publication when unchanged | ≤0.05 ms | ≤0.10 ms | Zero callback | No object/JSON allocation needed on unchanged counters. |

A p95 frame interval of exactly 16.7 ms is intentionally strict. Report raw samples; do not round a 17+ ms sample down or exclude loading/combat frames without naming the filter.

### Capacity and memory budgets

These are ceilings rather than percentile claims.

| Resource | Budget | Reason/measurement |
|---|---:|---|
| Live tactical actors, acceptance workload | 30 | Matches the existing steering comment's intended small-unit scale (`iso-math.js:109-112`). |
| Live actors, stress workload | 60 | Forces spatial-hash and path-cache behavior without setting a content promise. |
| Presentation particles per renderer | 360 | Matches the existing fixed WebGL pool (`battle-realtime-three.js:104`). Canvas must recycle/drop rather than grow. |
| User-goal flow fields | 8 + pinned portal/rally | Bounds typed-array cache and prevents click-spam growth. |
| Navigation cells | 960 stress | `40 × 24`; all per-cell stores use typed arrays, not per-cell objects in hot queries. |
| Canvas offscreen terrain backing storage | ≤16 MiB per active stage | Sum `width × height × 4` for every offscreen canvas at actual backing size. Report, do not infer from CSS dimensions. |
| WebGL shadow map | 1024² initially | Preserve current setting until GPU measurements justify dynamic quality tiers. |
| Active-stage steady JS heap growth over 10 min after warm-up | ≤5 MiB and non-monotonic after GC | Force no GC for the verdict; inspect trend and detached resources. |
| Adapter swaps in one session | 20 forced swaps with ≤1 MiB retained delta after GC | Verifies destroy/retained-runtime lifecycle. |
| Per-actor/per-step allocations in tactical hot loop | 0 target | Reuse vectors/scratch arrays; snapshots may allocate once per published frame if bounded. |

## Frame-rate and time-integrity budgets

The shared runtime recommendation is `1/60 s`, frame delta capped at `0.10 s`, maximum 6 catch-up steps. Acceptance:

| Probe | Budget |
|---|---:|
| Final position after 10 s at 30 vs 60 vs 120 Hz | ≤0.02 grid-unit pairwise difference |
| Camera target after equal wall time at 30/60/120 Hz | ≤0.001 world-unit pairwise difference |
| Ordered `breach`/`wave-cleared` proposal transcript | Exact equality |
| 100 ms injected stall | No lost tactical time; ≤6 catch-up steps; frame returns under p99 guardrail after catch-up |
| 250 ms injected stall | At most 100 ms simulated in one frame; excess recorded as `droppedSimulationMs`, never silently hidden |
| Hidden-tab resume | 0 hidden-time catch-up; input state empty; active click order either explicitly preserved or explicitly cancelled by one shared policy |

Current WebGL will fail the slow-frame movement comparison because it clamps to 50 ms (`battle-realtime-three.js:736`). Current camera will fail cross-refresh equality because it uses a fixed alpha (`battle-realtime-three.js:1158`). These are source-derived expectations, not measured failure samples.

## Instrumentation contract

### Interaction marks

At normalized input reception:

```js
performance.mark(`cmd:${id}:input`, { detail: { action, source } });
```

After reducer acceptance/rejection:

```js
performance.mark(`cmd:${id}:resolved`, { detail: { accepted } });
```

At the first animation frame that actually contains the semantic overlay, particle/static reduced-motion cue, command receipt, or commander position change:

```js
performance.mark(`cmd:${id}:paint-ready`);
performance.measure(`cmd:${id}:input-to-feedback`, `cmd:${id}:input`, `cmd:${id}:paint-ready`);
```

`paint-ready` must be emitted from the renderer/app path that knows the state will be painted, then confirmed by the next `requestAnimationFrame`. Do not mark merely when a callback is queued.

Track persistence independently:

```text
input → reducer-resolved
reducer-resolved → feedback paint
reducer-resolved → persistence complete
```

This prevents IndexedDB/local fallback tails from being mislabeled as rendering latency and exposes the current delayed `abyssal:command-resolved` receipt path.

### Event Timing observer

Browser probe shape:

```js
const eventSamples = [];
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    eventSamples.push({
      name: entry.name,
      startTime: entry.startTime,
      inputDelay: entry.processingStart - entry.startTime,
      processing: entry.processingEnd - entry.processingStart,
      duration: entry.duration,
      interactionId: entry.interactionId,
    });
  }
}).observe({ type: "event", buffered: true, durationThreshold: 16 });
```

Use `duration` as the browser-defined interaction-to-next-paint observation and custom marks for game-semantic first feedback. Preserve raw samples in the QA evidence artifact.

### Frame sampler

Collect at least 600 warm frames per scenario/renderer and all combat frames:

```text
frameInterval = rafNow - previousRafNow
updateMs = afterUpdate - beforeUpdate
renderSubmitMs = afterRenderCall - beforeRenderCall
steps = fixedStepsThisFrame
droppedSimulationMs
actors, particles, pathBuilds, drawCalls, rendererMode
```

Quantiles use nearest-rank on raw, unrounded samples. Report sample count, exclusions, page visibility, long tasks, and frames containing asset initialization. Produce separate warm-runtime and cold-transition tables; never remove the cold data from the report.

### Path sampler

For every path/field request:

```text
stageId, width, height, goalCell, cacheHit, visitedCells, durationMs,
actorCount, pathLength, reachable
```

Run fixed seeds and goals. A path benchmark that changes map/goal between before and after is invalid.

### Memory sampler

- Record `performance.measureUserAgentSpecificMemory()` where supported; otherwise label DevTools heap snapshots as the source.
- Snapshot after 5-minute warm-up, after 10 more minutes, after 20 forced renderer swaps, and after explicit GC only in a dedicated diagnostic run.
- Count WebGL resources, audio nodes, offscreen canvases and their backing bytes, actors, particles, path fields, and event listeners.

## Highest-leverage implementation moves

### 1. Remove duplicated simulation before micro-optimizing

The primary bottleneck risk is architectural: two frame loops independently perform movement/contact/event logic and cannot share caches or parity tests. Extracting one fixed-step tactical runtime removes duplicate work/rules and makes a headless profile possible. It also prevents a renderer swap from respawning/restarting spatial state.

Tradeoff: the cutover touches both adapters. Mitigate with immutable snapshots, current 10-stage transcript fixtures, and an atomic removal of old renderer simulation after both adapters pass.

### 2. Cache common routes and bound Canvas allocations

Use reverse flow fields for portal/rally/group goals, a spatial hash above 30 actors, reusable scratch vectors/arrays, a 360-slot Canvas particle pool, and a cheap unchanged-runtime signature before object/JSON creation.

Tradeoff: caches consume memory and stale invalidation can corrupt paths. Navigation is static per stage; key by immutable navigation revision and clear at stage teardown.

No shadow, DPR, particle-count, visual-quality, or speed reduction is recommended before measurements identify it as the bottleneck.

## Focused verification commands and probes

### Existing narrow commands

```text
node --test tests/battle-realtime-three.test.mjs
node --test tests/battle-visualizer.test.mjs
node --test tests/app-command-feedback.test.mjs
node --test tests/iso-math.test.mjs
```

These verify existing correctness contracts only; they do not produce p50/p95 evidence.

### New focused automated probes after implementation

1. `tactical-runtime-timing.test.mjs`: 30/60/120 Hz plus 100/250 ms stalls, exact event transcript, position/camera tolerances.
2. `stage-navigation-large-map.test.mjs`: `24 × 12` canary and `40 × 24` stress schema, three lanes, route reachability, cache hit/eviction, route duration samples.
3. `battle-input-parity.test.mjs`: pointer id/capture/cancel/lost-capture, 6/12 px thresholds, 500 ms tap bound, `A`/`D` conflict elimination, focus matrix.
4. `battle-renderer-parity.test.mjs`: one runtime snapshot consumed by both adapters; all-breached wave clears exactly once.
5. Browser script: 200 actions per input source/renderer after warm-up, 600+ frames, WebGL loss at mid-wave, touch emulation, compact and desktop viewports.

### Required result table before gate verdict

```text
scenario | renderer | viewport | samples | metric | p50 | p95 | p99/max | budget | PASS/FIX
```

A missing renderer, input source, viewport, or raw sample artifact is **not measured** and cannot pass. A unit test passing does not substitute for browser frame/interaction evidence.

## Risks and stop conditions

- If the current v6 transcript changes during the parity-only extraction, stop and treat it as a correctness regression; do not tune around it.
- If Canvas all-breached completion remains divergent, no fallback parity or Stage 3 gate can pass.
- If a `24 × 12` stage cannot provide three material lanes with legal routes, return to map design; do not label zones to satisfy the count.
- If frame p95 exceeds 16.7 ms, identify update, render submission, GPU, static build, or catch-up as the bottleneck from the trace before reducing quality.
- If action feedback p95 exceeds 100 ms only for `abyssal:command-resolved`, separate primary visual feedback from persistence completion rather than delaying all feedback.
- If performance passes only after excluding stalls, cold fallback, compact touch, or combat frames, the gate is not passed.
