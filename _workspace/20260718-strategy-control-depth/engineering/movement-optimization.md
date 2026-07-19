# Movement and Path Optimization Plan

**Status:** discovery recommendation; no movement, map, camera, renderer, or test code changed  
**Scope:** map scaling, spawn/rally anchors, path resolution, commander acceleration/surge, camera smoothing/zoom, frame-rate independence, and WebGL/Canvas parity

## Executive recommendation

Do not enlarge the heightfield while the renderers own separate spatial simulations. First establish one data-driven navigation object and one deterministic tactical step. Preserve current balance speeds (`4.1` commander walk, `7.2` surge, `2.4` WebGL enemy advance) for the parity cutover; add frame-independent acceleration and routing as isolated parameters. Once current 10-stage behavior is reproduced, scale one canary stage from `16 × 8` to `24 × 12`, with three authored lanes/zones and a `40 × 24` non-content stress fixture.

## Observed baseline

### Repository facts

| Fact | Evidence | Interpretation |
|---|---|---|
| Every map is currently `16 × 8`; all stages share portal `(1, 3.5)`, boss `(14, 3.5)`, node `(7.5, 3.5)`. | `stage-navigation.js:3-10`. | Map extent and tactical anchors are global, not stage data. |
| Stage 4 is explicitly a narrow breakwater causeway and Stage 7 explicitly has **two** bridge lanes. | `stage-navigation.js:53-64`, `stage-navigation.js:76-82`. | Those authored layouts do not meet the new “at least three materially distinct lanes/zones” gate without redesign; a label-only third lane is not sufficient. |
| WebGL world/grid offsets are module constants derived from the global width/height. | `battle-realtime-three.js:30-36`, `battle-realtime-three.js:656-671`. | Variable dimensions will mis-map coordinates unless conversion moves into the navigation instance. |
| WebGL commander speed is chosen instantly as `7.2` under Shift or `4.1` otherwise. Position integrates `speed × dt`; there is no velocity/acceleration state. | `battle-realtime-three.js:1005-1039`. | Translation is delta-scaled, but surge starts/stops discontinuously. |
| WebGL enemies advance at `2.4` toward the portal and use a small perpendicular detour only after a blocked sample. | `battle-realtime-three.js:35`, `battle-realtime-three.js:1079-1106`. | It is local collision response, not global path resolution. |
| WebGL `resolveMovement` samples a segment every `≤0.12` world units and linearly scans static blockers/allies/enemies per sample. | `battle-realtime-three.js:884-958`. | Safe for the current small population, but long click segments and larger populations multiply collision work. |
| Canvas has A* with cardinal moves and climb validation for selected ally move orders. | `iso-math.js:55-107`, `battle-visualizer.js:867-881`; invariants at `tests/iso-math.test.mjs:203-297`. | There is already a tested route primitive, but it is not shared with WebGL or all actors. |
| Canvas default ally/enemy steering does not call `walkable`/`climbOk`; Canvas spawns use hard-coded random neighborhoods. | `battle-visualizer.js:983-1042`, `battle-visualizer.js:1298-1348`. | Canvas actors can visually cross voids/elevation barriers and may produce different breach timing. |
| WebGL discards frame time above 50 ms; Canvas preserves up to 1 s and subdivides into ≤50 ms steps. | `battle-realtime-three.js:731-748`; `battle-visualizer.js:1775-1798`. | Equal wall time at different frame rates can produce different movement and encounter events. |
| Camera target follow uses `lerp(..., 0.12)` once per frame, ignoring the `dt` argument. | `battle-realtime-three.js:1157-1177`. | Camera responsiveness is refresh-rate dependent. |
| WebGL zoom is `18` by default and clamps immediate wheel changes to `[9, 30]`. | `battle-realtime-three.js:384-386`, `battle-realtime-three.js:1238-1242`. | Bounds are not map-fit derived; `WheelEvent.deltaMode` is ignored. |
| Canvas wave completion excludes breached enemies; WebGL includes them. | `battle-visualizer.js:1350-1362`; `battle-realtime-three.js:1124-1130`. | Canvas can stall a fully resolved wave. This is a correctness blocker before map scaling. |

### Deterministic balance evidence, not control/performance evidence

The studio baseline was run from repo root with:

```text
node scripts/run-campaign-balance-sim.mjs > /tmp/abyssal-balance-v6.json
```

Observed result: exit `0`, wall time `22.05 s` on the current workstation. The summary reports rules v6; deterministic rusher `0%` (defeat at Echo Throne, 20 actions), comeback `0%` (defeat at Howling Sprawl, 47), greedy `100%`/116 actions, optimal `100%`/103 actions; seeded casual `40%` over 200 campaigns, with defeats at Echo Throne 78, Sunken Bastion 19, Howling Sprawl 17, and 6 across other stages; fuzz 150,000 operations with 0 findings; branch fractions `0.69–0.85`.

This establishes deterministic reducer stability and a strategic difficulty baseline only. It is **not** human fairness evidence, map-lane evidence, movement feel evidence, or responsiveness/frame-time evidence. No diff between the two reported deterministic runs was performed, so no byte-identical-output claim is made.

## Movement model

### Fixed-step simulation

Recommended target in a new shared tactical runtime:

```text
h = 1 / 60 seconds
frameDelta = clamp((now - previousNow) / 1000, 0, 0.10)
accumulator += frameDelta
steps = 0
while accumulator >= h and steps < 6:
    simulate(h)
    accumulator -= h
    steps += 1
renderAlpha = accumulator / h
```

- `h = 1/60 s` gives stable collision/contact/AI clocks.
- `frameDelta ≤0.10 s` and `maxSteps = 6` recover a 100 ms stall without an unbounded spiral.
- Renderer interpolation is `renderPosition = previous + (current - previous) × renderAlpha`.
- If the page is hidden, clear input and pause accumulation. Resume with `previousNow = performance.now()`; do not replay hidden wall time.
- Hit stop changes tactical presentation time explicitly; it must not scale input collection or campaign reducer time.

This replaces WebGL's lost-time clamp and Canvas's potentially 20-step one-second catch-up with one contract.

### Commander acceleration and surge

Current speeds remain the initial parity values:

```text
walkMax = 4.1 grid units/s
surgeMax = 7.2 grid units/s
acceleration = 28 grid units/s²
deceleration = 36 grid units/s²
```

For normalized input direction `d` and current velocity `v`:

```text
vTarget = d × (surge ? surgeMax : walkMax)
limit = (|d| > 0 ? acceleration : deceleration) × dt
vNext = v + clampMagnitude(vTarget - v, limit)
pNext = resolveAlongPath(p, vNext × dt)
```

Expected ramps from the recommended constants:

- Rest to walk max: `4.1 / 28 = 146 ms`.
- Rest to surge max: `7.2 / 28 = 257 ms`.
- Walk max to surge max: `(7.2 - 4.1) / 28 = 111 ms`.
- Walk max to stop: `4.1 / 36 = 114 ms`.
- Surge max to stop: `7.2 / 36 = 200 ms`.

Visible movement still begins on the next simulation step; the ≤100 ms input-feedback contract is not a requirement to reach full speed. Acceleration removes the current velocity discontinuity while keeping the v6 top speeds unchanged.

When a click/touch move order is active, its desired direction feeds the same velocity model. Manual movement cancels the order exactly once. Reaching the final waypoint uses a braking distance:

```text
brakeDistance = |v|² / (2 × deceleration)
```

The target speed is reduced so the commander does not oscillate around a short final segment.

### Frame-independent camera follow

Use exponential smoothing:

```text
alpha(dt) = 1 - exp(-dt / tau)
current += (target - current) × alpha(dt)
```

Recommended `tau = 0.1304 s` for target follow. That value preserves the current `alpha = 0.12` feel at 60 Hz because:

```text
tau = -(1/60) / ln(1 - 0.12) = 0.1304 s
```

The current fixed-per-frame alpha has a 95% settle time of about 23.43 frames: approximately `781 ms` at 30 Hz, `391 ms` at 60 Hz, and `195 ms` at 120 Hz. With the exponential formula, the 95% settle time is refresh-rate invariant:

```text
t95 = -tau × ln(0.05) ≈ 391 ms
```

Camera shake may remain wall-clock sampled, but its envelope must use the same `dt` and must never alter tactical position.

### Zoom normalization and map fit

Normalize a wheel event to pixels before changing `targetZoom`:

```text
pixelDelta = deltaY × (deltaMode == 1 ? 16 : deltaMode == 2 ? viewportHeight : 1)
targetZoom = clamp(targetZoom + pixelDelta × zoomSensitivity, minZoom, maxZoom)
zoom += (targetZoom - zoom) × (1 - exp(-dt / zoomTau))
```

Recommended initial parameters:

```text
zoomSensitivity = 0.012 world-units/pixel
zoomTau = 0.090 s
fitPadding = 1.10
```

The sensitivity preserves the existing pixel-mode factor. `zoomTau` is new and must be verified with mouse wheel and trackpad. Bounds derive from a navigation bounding sphere rather than fixed `[9,30]`:

```text
fovX = 2 × atan(tan(fovY / 2) × aspect)
fitFov = min(fovX, fovY)
fitDistance = (boundingRadius × fitPadding) / sin(fitFov / 2)
defaultZoom = authoredDefault ?? fitDistance
minZoom = authoredMin ?? 0.45 × fitDistance
maxZoom = authoredMax ?? 1.35 × fitDistance
```

The authored override is presentation metadata only. It cannot change walkability or authoritative action hit targets.

## Shared path and collision strategy

### Layer 1 — static global routing

Uniform cardinal terrain permits a reverse breadth-first flow field for common destinations:

- Hostiles share the breach/portal destination.
- Unordered allies share a rally/hold destination.
- Selected groups share the issued move-order destination.

Build cost is `O(width × height)`; the next cardinal cell lookup is `O(1)`. Cache fields by `(stageId, goalCell, navigationRevision)` with deterministic neighbor order. A bounded cache of **8** destination fields is recommended for user orders; portal/rally fields are pinned. On `40 × 24`, one signed 16-bit distance field is 1,920 bytes before object overhead; typed arrays avoid per-node allocations.

Keep A* for one-off actor-specific goals. The current `findPath` linearly scans the open `Map` for minimum `f` (`iso-math.js:73-78`), making worst-case work roughly quadratic in explored cells. Before issuing one path per actor on larger maps, either use the cached flow field or replace the open scan with a deterministic binary min-heap keyed by `(f, h, cellIndex)`.

### Layer 2 — radius-safe corridor

A valid path cell is insufficient for a radius-bearing actor. Validate:

```text
walkable(center)
and walkable(center + each radius probe)
and climbOk(previousCell, destinationCell)
```

WebGL already applies center/radius probes and climb checks (`battle-realtime-three.js:884-896`). Move that implementation into navigation/runtime and use it for Canvas as well.

Path waypoints should be cell centers. Optional formation offsets are clamped/projected back into the safe corridor; never add random lateral offsets without revalidation. Current Canvas adds random y jitter after A* (`battle-visualizer.js:877-879`), which can push a legal centerline toward a void edge.

### Layer 3 — dynamic local avoidance

Use a uniform spatial hash with cell size `2 × maxActorRadius` when live tactical actors exceed **30**. Query the actor's cell plus eight neighbors for separation/collision. Keep static terrain out of this hash. This changes pair lookup from broad per-actor scans toward expected `O(n + local pairs)`.

The current `steer` implementation is a simple separation push (`iso-math.js:109-131`), not full reciprocal collision avoidance. Retain it for the first slice, but clamp the resulting vector back to the path corridor and cap magnitude to the actor's configured max speed. Do not allow separation to accelerate an actor above its balance speed.

### Spawn resolution

Replace renderer-specific radial guessing/random placement with deterministic slots:

1. Choose an authored spawn group and stable slot by `actorSerial % points.length`.
2. Validate radius clearance and a route to the actor's objective.
3. If occupied, run deterministic nearest-walkable search in increasing Manhattan radius, then cell index.
4. Reject spawn only after a configured radius of **3 cells**; report the failure to diagnostics, never silently place inside void.
5. Spawn success never mutates campaign inventory; the canonical legion/wave state remains reducer-owned.

WebGL currently samples rings out to 2 units in 0.3 increments (`battle-realtime-three.js:1335-1351`); Canvas spawns without terrain validation (`battle-visualizer.js:983-1042`). The proposed shared resolver removes this parity gap.

## Larger-map content gate

### Canary and stress dimensions

- **Canary content:** `24 × 12` (288 cells, 2.25× the current 128-cell map). This is large enough to test camera fit and route choice without immediately multiplying art scope by an order of magnitude.
- **Non-content stress fixture:** `40 × 24` (960 cells). It exists only for navigation, cache, frame, picking, and memory probes.
- No other stage enlarges until the canary meets correctness, parity, lane, and performance gates.

### “Three materially distinct lanes/zones” definition

A stage passes only when all are true:

1. Three uniquely identified lane/zone cell sets are authored in navigation data.
2. Each lane contains a legal spawn-to-objective route for the intended radius/climb profile.
3. Outside shared entry/exit zones, each lane has at least **50%** of its route cells not shared with either other lane.
4. Each lane contains at least one distinct tactical affordance: node access, elevation profile, cover/choke width, route length/risk, or reinforcement entry.
5. Blocking one lane outside entry/exit does not disconnect the other two.
6. Route-length spread is bounded: longest default path ≤`1.35 ×` shortest unless the longer lane has a measured strategic advantage.

Stage 7's two explicit bridges (`stage-navigation.js:76-82`) is a clear redesign case. Stage 4's narrow causeway (`stage-navigation.js:53-64`) also needs more than cosmetic zoning.

## Proposed numeric parameter changes

Every row names its future source/symbol, risk, and focused verification. “Preserve” means data extraction, not a balance retune.

| Target file/symbol | Current | Recommendation | Risk | Focused verification |
|---|---:|---:|---|---|
| `stage-navigation.js / StageNavigationSpec.size` | Global `16 × 8` | Canary `24 × 12`; stress fixture `40 × 24`; current stages remain `16 × 8` during cutover | Camera/art scope; path cost | Schema validation, map-fit browser screenshots, 960-cell path budget |
| `tactical-runtime.js / FIXED_STEP_SECONDS` | Renderer-specific variable dt | `1/60 s` | More steps during stalls | Equal-wall-time 30/60/120 Hz transcript |
| `tactical-runtime.js / MAX_FRAME_DELTA_SECONDS` | WebGL `0.05`; Canvas `1.0` | `0.10 s` | Longer stalls still drop excess time | Inject 100/250 ms stalls; bounded steps and no event duplication |
| `tactical-runtime.js / MAX_CATCH_UP_STEPS` | None/implicit | `6` | Spiral protection can slow simulation under sustained overload | CPU-throttled browser trace; report dropped-sim-time diagnostic |
| `tactical-runtime.js / COMMANDER_WALK_SPEED` | Inline `4.1` | Preserve `4.1` | None expected; extraction drift | 10 s open-field distance at 30/60/120 Hz |
| `tactical-runtime.js / COMMANDER_SURGE_SPEED` | Inline `7.2` | Preserve `7.2` | None expected; extraction drift | Same plus Shift transition |
| `tactical-runtime.js / COMMANDER_ACCELERATION` | Instant speed | `28 units/s²` | May feel heavy; collision at ramp-up | Time-to-speed assertions and browser feel probe |
| `tactical-runtime.js / COMMANDER_DECELERATION` | Instant stop | `36 units/s²` | Overshoot on short orders | Braking-distance/short-click tests |
| `tactical-runtime.js / ENEMY_ADVANCE_SPEED` | WebGL `2.4`; Canvas archetype random `0.9–1.9` | Preserve canonical `2.4` initially; archetype multipliers deferred to balance cycle | Canvas encounter timing changes | Headless event transcript before/after; deterministic balance sim |
| `tactical-runtime.js / MAX_COLLISION_SUBSTEP_DISTANCE` | WebGL `0.12` | Preserve `0.12` for canary; measure before changing | Too large tunnels; too small costs CPU | Thin-collider sweep at surge speed and 100 ms catch-up |
| `stage-navigation.js / FLOW_FIELD_CACHE_SIZE` | None | `8` user goals + pinned portal/rally | Memory/eviction churn | Alternating 12 goals; p95 query and heap delta |
| `stage-navigation.js / SPAWN_SEARCH_RADIUS_CELLS` | WebGL ~2 world units; Canvas none | `3 cells` | Spawn rejection if content is invalid | Crowded spawn fixture; deterministic slot/failure |
| `tactical-runtime.js / SPATIAL_HASH_THRESHOLD` | Broad scans | `>30` live actors | Two code paths | 30/31/60 actor equivalence and perf traces |
| `battle-realtime-three.js / CAMERA_FOLLOW_TAU_SECONDS` | Per-frame alpha `0.12` | `0.1304 s` | 60 Hz preserved; other refresh rates change intentionally | Equal-wall-time camera traces |
| `battle-realtime-three.js / CAMERA_ZOOM_TAU_SECONDS` | Immediate | `0.090 s` | Trackpad may feel damped | Wheel/trackpad/touch browser probe |
| `battle-realtime-three.js / CAMERA_FIT_PADDING` | Fixed zoom bounds | `1.10` | Too much empty space on narrow maps | 16:9, 9:16, 4:3 anchor containment |
| `input-controller.js / mouseDragThresholdCssPx` | WebGL 3 Manhattan; Canvas 6 per axis | `6 px` Euclidean | Fine mouse clicks near threshold | ±1 px boundary tests |
| `input-controller.js / touchDragThresholdCssPx` | Same as mouse per renderer | `12 px` Euclidean | Very small drags treated as taps | Device emulation tap/drag matrix |
| `input-controller.js / maxTapDurationMs` | None | `500 ms` | Long-press accessibility/gesture policy | 499/501 ms tests; no action after cancel |

The speed/acceleration constants are proposed for a focused feel test, not declared balanced. Any change after playtest must be rerun through the deterministic campaign simulator and human control sessions.

## Focused tests to add after implementation

### Pure navigation/runtime

- Every stage anchor is in bounds, radius-safe, and path-connected to its required objective.
- Exactly `nodeGoal` node anchors exist; all are distinct.
- Three-lane validation meets overlap, survivability, and route-length criteria.
- Flow field and A* return equivalent shortest path cost on uniform cardinal maps.
- Actor path never enters void or crosses an elevation delta >1.
- Spawn search is deterministic and rejects truly unreachable spawn groups.
- Same input/tick transcript at 30/60/120 Hz ends within `0.02` grid units and emits identical ordered proposals.
- Fully defeated/breached mixed waves clear once; a live unit blocks completion.
- Surge acceleration/deceleration reaches the computed ramp times within one fixed step.

### Renderer adapters

- WebGL and Canvas consume the same actor ids/positions without mutating the snapshot.
- Switching adapters mid-path preserves runtime identity and order.
- Camera target trace is equal across refresh rates; zoom fit contains portal, nodes, hostile spawns, and boss.
- Canvas draw order and WebGL transforms both reflect navigation elevation, but neither determines path legality.

### Browser probes

1. Desktop mouse: click-to-move through each of three lanes; orbit drag never emits click/action.
2. Keyboard: WASD/arrows/Shift with 3D and Canvas focused; `A`/`D` produce no campaign action.
3. Touch emulation: 5 px tap, 11/13 px drag boundaries, cancel, second-finger interruption, and no post-drag click.
4. WebGL context loss mid-wave: Canvas continues the same runtime snapshot and event transcript.
5. CPU 4× slowdown at 30 Hz: movement wall-time remains within tolerance, catch-up stays ≤6 steps/frame, and the UI reports dropped simulation time rather than silently diverging.

## Acceptance evidence still required before implementation is called successful

- Human sessions for movement feel and lane legibility; deterministic strategy outcomes are insufficient.
- Browser action-to-visible-feedback p50/p95 samples by input type and renderer.
- 30/60/120 Hz position/camera traces.
- `24 × 12` canary route validation and three-lane materiality review.
- `40 × 24`, 30/60-actor performance traces and memory samples.
- Deterministic campaign simulation after any enemy speed or event-timing change.
