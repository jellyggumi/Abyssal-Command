# Canvas 2D performance and rendering budget

**Status:** target-only research and implementation contract. No target mobile device capture, profiler trace, or gate evidence exists. Every number marked **Target** is a falsifiable acceptance threshold, not a measured result. **G6 remains `NOT MEASURED` / `NOT PASSED`.**

## Decision and scope

Abyssal Command remains a foreground, offline, deterministic 60 Hz browser defense-survivor. The Canvas 2D renderer, sprite/VFX queue, Web Audio presentation, edge HUD, PCG preparation, and diagnostics are snapshot observers. They **MUST NOT** alter a simulation tick, RNG/deck cursor, input ordering, collision, target selection, damage, cooldown, choice, MapPlan/WavePlan, reward, persistence, or campaign result.

This packet specifies the target-device budgets and evidence needed before implementation can claim G6 coverage. It does not change runtime source, select an asset, select a browser support policy, or report a pass. The binding project contract is the Canvas-2D snapshot projection and 60 Hz rules contract in [`docs/abyssal-command-defense-survivor-design.md`](../../../docs/abyssal-command-defense-survivor-design.md).

### Implementation boundaries

| Stage | Allowed performance work | Explicit boundary | Relevant gates |
|---|---|---|---|
| **Stage 1 — concept / presentation / core loop** | Define Canvas layers, static semantic fallbacks, asset manifest limits, telemetry schema, dense-replay fixtures, and pre-run PCG hand-off. | No simulation or rule/API change; standard and reduced-motion projections consume only confirmed snapshots/events. | G4, G6, G7 |
| **Stage 2 — balance / rewards / growth / encounters** | Profile the fixed encounter/reward corpus; precompute and validate deterministic MapPlan/WavePlan data before a run; tune presentation density only from observer data. | Never generate/re-roll maps, waves, offers, rewards, or balance inside an active frame or in response to frame pressure. Existing Stage 2 measurement work does not establish G6. | G2, G5, G6, G7, G8 |
| **Stage 3 — combat feedback / resources / performance / QA / release** | Execute target-device traces, asset/resource audit, 30-minute soak, reduced-motion/mute/missing-asset differentials, offline export/delete, and rollback evidence. | Do not trade accessibility, semantic feedback, offline operation, or deterministic outcomes for a smoother capture. | G4, **G6**, G7 |

## Target devices, workload, and measurement rules

### Required mobile cells

The exact OS and browser build are recorded at capture time; an emulator, desktop throttling, or mean-FPS-only capture is not a substitute. Until the release owner freezes a support matrix, these are the **Target v1** acceptance cells:

| Cell | Physical target | Browser | Logical / backing viewport | Required workload |
|---|---|---|---|---|
| `android-baseline-v1` | Google Pixel 6a, retail, thermally normal, battery >= 50%, no power-save mode | Chrome Stable for Android | 844×390 CSS px; DPR 3; 2532×1170 backing px at 1.0 render scale | Cinder Span 90 s dense replay, 10 min paired presentation run, 30 min soak |
| `ios-baseline-v1` | iPhone 13, retail, thermally normal, battery >= 50%, Low Power Mode off | Safari on the installed iOS release | 844×390 CSS px; DPR 3; 2532×1170 backing px at 1.0 render scale | Same fixture/tape and phases as Android |
| `low-viewport-v1` | One of the two above at the declared low profile; a second lower-class retail Android is supplemental, not a replacement | Native supported browser | 480×270 CSS px; 1× backing px; 1.0 render scale | Dense replay and reduced-motion/muted differential |

**Target hardware caveat:** these named devices are acceptance targets, not a claim that their current browser/OS versions or thermals have been measured. The G6 receipt MUST record model, OS, browser version, battery/thermal state if exposed, viewport, DPR, backing-store dimensions, render scale, build/rules/serializer/grammar/asset-manifest digests, fixture ID, input source, and presentation mode.

### Sampling and percentiles

1. Warm each cell for 120 seconds, then exclude the warm-up. Measure only an active, foreground document; page-hide/restore is a separate lifecycle test, never a frame-time sample.
2. Keep the same pinned `MapKey`, MapPlan digest, WavePlan digest, input-tape digest, fixture, build tuple, and visual mode for before/after comparisons. Capture `30`, `60`, and `120` Hz renderer cadence observer differentials separately.
3. Frame interval is the consecutive `requestAnimationFrame` timestamp delta. CPU update/draw spans are explicit marks and are **not** a substitute for display interval. Report count, p50, p95, p99, maximum, and percent above threshold; p95 is nearest-rank `ceil(0.95 × n)` after sort.
4. For a five-pass paired test, compute each pass's p95 delta `(presentation-on - presentation-disabled)` at matched simulation ticks, then report the median of those five p95 values. Never pool device/browser cells.
5. A missing browser API is recorded as `null` plus capability state, not estimated or replaced with a value from a different browser. A raw trace must include dropped-sample count and first failing tick/frame.

## Concrete budgets

### Frame, input, and memory envelope

| Surface and observable | **Target** p95 / ceiling | Method and failure condition | Owner / gate linkage |
|---|---:|---|---|
| Foreground frame interval, dense 90 s replay | p95 **<= 16.7 ms** | Consecutive rAF timestamps after warm-up. Fail the cell above 16.7 ms. | G6 required |
| Long-frame rate, 30 min soak | **< 0.5%** of frames > 33.4 ms | Count raw rAF deltas; report all >33.4 ms and first occurrence. | G6 required |
| Extreme frame | 0 frames > 100 ms during scripted foreground replay | A >100 ms delta is a diagnostic failure even if the percentage remains below 0.5%. Visibility/lifecycle intervals are excluded but logged. | G6 diagnostic |
| Simulation + snapshot extraction CPU | p95 **<= 5.0 ms** | Marks around fixed-tick admission through immutable render snapshot hand-off. No catch-up/drop may conceal a breach. | G6 / G7 |
| Canvas 2D draw CPU | p95 **<= 6.0 ms** | Mark clear, background, world, sprites, VFX, and composite in a foreground rAF. | G6 |
| HUD update CPU | p95 **<= 0.75 ms**; max 1 HUD commit/frame | Mark edge HUD projection; common-enemy state does not create DOM/HUD churn. | G4 / G6 |
| Presentation contribution (dense paired replay) | median-of-five p95 **<= 2.0 ms CPU**, **<= 2.5 ms GPU** where the profiler exposes GPU time | Match on/off frames by tick. GPU unavailable is `null`, not a CPU proxy. | G6 evidence; aligns `engineering/perf-budget.md` |
| Rank-4 VFX | <= 6 local emitters and <= 2 aggregate labels per 500 ms in 160 dp player radius; alpha coverage <=18% viewport and <=8% of active rank-1 zone | Layer-mask audit per frame; cull/coalesce before a rank-1/2 item is obscured. | G4 / G6 |
| Input listener work | p95 **<= 1.0 ms**, p99 **<= 2.0 ms** | `pointer`/keyboard/controller listener start-to-normalized-action enqueue. Passive handler where applicable; no synchronous decode/layout/readback. | G4 / G6 |
| Capture -> tick admission | p95 **<= 33.4 ms** (<=2 ticks) | Local monotonic time at capture and authoritative admitted tick. | G4 / G6 |
| Accepted movement -> visible confirmation | p95 **<= 100 ms** | Join input ID to first presentation frame containing the observed movement state. A presentation-disabled replay establishes added latency. | G4 / G6 |
| Presentation-added movement latency | p95 **<= 1 rendered frame** | Same tape with presentation disabled; compare by accepted tick. | G4 / G6 |
| Audio cue scheduling | p95 accepted P0/P1 observer event -> `AudioContext` schedule attempt **<= 50 ms**; visual confirmation remains <=100 ms if audio is blocked | Log attempt/result (`scheduled`, `muted`, `blocked`, `missing`, `decode-failed`, `dropped`). Physical speaker latency is not claimed measurable in-browser. | G4 / G6 |
| Page-owned resident memory | p95 **<= 64 MiB** after warm-up; end-minus-start retained delta **<= 5 MiB** over 30 min; post-warm-up fitted slope **<= 0.10 MiB/min** | Prefer Chromium `measureUserAgentSpecificMemory()` when available; otherwise record owned cache counters plus DevTools/remote inspector memory trace. Do not compare API totals across engines. | G6 required stability proof |
| JS heap (diagnostic only) | p95 **<= 48 MiB** where the browser exposes a heap counter | Heap alone is not total Canvas/audio memory and cannot pass the total-memory criterion. | G6 diagnostic |
| Telemetry ring | default <=4,096; hard cap <=16,384 records | Existing local telemetry contract. Overflow increments dropped count and never backpressures simulation. | G6 local telemetry |

The global 16.7 ms target is the G6 threshold. The component rows identify the first place to investigate; they must not be summed as a proof because browser scheduling/compositing overlaps work. The 60 Hz deterministic simulation retains its own 16.667 ms tick contract even if the browser does not present every frame.

### Canvas, sprite, feedback, HUD, and audio resource limits

| Resource | **Target** limit | Lifecycle / observable metric | Degradation first action |
|---|---:|---|---|
| Full-resolution Canvas backing stores | At most 2 live full-viewport stores; at 2532×1170×RGBA8 this is about 11.3 MiB each / 22.6 MiB total | Record width, height, count, bytes `w×h×4`; an offscreen full-screen effect buffer counts. | Remove optional offscreen effect layer before reducing semantic world/HUD layer. |
| Active sprite atlases | <=16 MiB decoded RGBA; <=4 atlases live; each atlas <=2048×2048 and <=4 MiB decoded at 1024² equivalent | Record decoded dimensions/bytes, draw count, unique texture/atlas count. | Evict inactive-stage rank-4 atlas; retain rank-1/2 static equivalents. |
| Sprite submissions | <=450 `drawImage`/path submissions per frame in dense standard mode; <=250 in reduced-motion | Count draw commands by layer and asset ID. | Coalesce normal impacts, then stop rank-4 animation. |
| Rank-1/2 semantic feedback | No budget-driven cull of active threat, player/Gate vital, confirmed ability area, critical state, boss location, or cooldown-ready state | Presentation-source join and protected-zone mask check; static equivalents are mandatory. | Replace motion with static marker, never omit semantic state. |
| Rank-4 texture | Basic hit <=4 subparticles; crit <=6 fragments; skill <=12 particles, using existing feedback targets | Per-event emitted/coalesced/culled count and reason. | Aggregate label/stamp, then cull oldest/lowest priority. |
| HUD | <=40 live DOM nodes for overlay/UI shell; one Canvas world projection; no per-enemy DOM node or per-hit DOM text | DOM node count, HUD commits/frame, HUD CPU span. | Batch numeric/readiness paint to 10 Hz maximum only for nonessential interpolation; vital state change still commits on its next frame. |
| Static image/VFX payload | <=6 MiB compressed total for first-run Canvas art; <=16 MiB decoded active atlas residency | Manifest bytes, SHA-256, decoded bytes; no runtime art fetch/decode during active combat. | Do not load optional ambience/rank-4 atlas. |
| Short SFX | <=102,400 bytes each; <=3 MiB compressed total; <=12 MiB decoded buffers resident | Manifest and decoded PCM bytes `frames×channels×4`; active source count. | Drop P3/P4/duplicate cue before P0/P1; visual/caption path remains. |
| Narration | <=256,000 bytes each, 1–12 s; <=2 MiB compressed total; <=12 MiB decoded buffers resident | Same manifest/PCM measure; no overlapping non-emergency narration. | Caption/static marker and silence are valid; never delay state. |
| Ambience/music | <=1,048,576 bytes each; <=2 MiB compressed total; <=8 MiB decoded resident | Bus state, decoded bytes, active loop count. | Duck/stop ambience before any gameplay cue. |
| All static media | <=13 MiB compressed install payload and <=48 MiB decoded media residency | Content-addressed manifest, asset bytes, decoded measurements; excludes browser process overhead but feeds page-owned 64 MiB ceiling. | Reject import or demote optional asset before shipping. |
| PCG map/wave preparation | p95 <=250 ms from pre-run request to validated immutable plan; <=8 MiB temporary working set; **0 ms active-run PCG generation** | Mark plan start/end, validation outcome, MapKey/digest, temporary bytes. Plan is committed before tick 0. | Reuse/pregenerate pinned plan; do not simplify/re-roll active run. |

The per-file audio ceilings preserve the existing resource-manifest contract. Decoded PCM uses 32-bit floating samples for capacity accounting; a compressed byte cap does not imply an equal decoded-memory cost. Runtime remote audio, remote assets, runtime provider SDKs, credentials, fetch/XHR/WebSocket, or retry paths remain forbidden.

## Renderer and preparation architecture

### Canonical observer pipeline

```text
normalized input -> deterministic 60 Hz simulation -> confirmed snapshot/event
                                                     |             |
                                                     |             +-> local telemetry (bounded ring)
                                                     +-> observer queue -> Canvas/HUD/VFX/audio
                                                                              |
                                                                              +-> cull/degrade/log (never rules)
pre-run MapKey -> deterministic PCG validation -> immutable MapPlan/WavePlan -> tick 0
```

1. The active rAF obtains the latest committed immutable snapshot. It may interpolate display positions, but it cannot construct a rule event or advance simulation from wall-clock delta.
2. Canvas layer order is: static background -> world/sprites -> rank-1 protected signal -> rank-2/3 confirmed state -> rank-4 texture -> edge HUD/semantic overlay. Culling is deterministic within the observer queue for reproducible captures, but outcome differences are legal only in observer logs, never canonical state.
3. Static/repeating decoration MAY be prerendered to a supported offscreen surface only after a trace proves it helps on the named cell. `OffscreenCanvas`, workers, `ImageBitmap`, and bitmap-renderer are optional accelerators—not a required runtime dependency. Any unsupported/error path uses the current Canvas 2D adapter.
4. Image decode/atlas creation and audio decode occur before a run or at an authored safe intermission. They MUST NOT occur on a gameplay input handler or dense active-combat frame. Asset failure maps to a local static/procedural fallback or silence.
5. Map/Wave generation is deterministic preparation, not a progressive background effect: validate and commit a plan before tick 0. A time-out, rejection, or unavailable worker is a pre-run failure/retry path and never triggers a frame-pressure-dependent map substitute.

## Instrumentation contract

Instrumentation is local-only, bounded, and read-only. It extends the existing `abyssal.frame.sampled`, input, feedback, audio, and map-plan records; it cannot add personal data, raw touch paths, network transport, or a rules/campaign mutation API.

| Probe | Required fields / sampling | Why it is observable |
|---|---|---|
| `frame.sample` | `frameId`, `rafDeltaMs`, `simTick`, `simSteps`, `backlogTicks`, `updateMs`, `drawMs`, `hudMs`, `vfxMs`, `drawCalls`, `emitterCount`, `renderScale`, `degradationLevel`, `mode` | Separates interval from named observer work; correlates pressure with a deterministic fixture tick. |
| `input.chain` | opaque local `inputId`, source class, `capturedMonotonicMs`, `enqueuedMonotonicMs`, `admittedTick`, `admittedMonotonicMs`, `firstVisibleFrameId`, `firstVisibleMonotonicMs`, reject reason | Computes handler, admission, and visible confirmation without retaining raw coordinates or identity. |
| `feedback.queue` | source event ID/tick, rank, requested/emitted/coalesced/culled, cull reason, static equivalent flag, protected-zone conflict | Proves cosmetic shedding did not remove a semantic item. |
| `audio.cue` | source event ID, cue ID/bus/priority, schedule attempt time, result, active sources, decoded bytes, fallback | Records playback attempt, not a false claim about physical sound-output timing. |
| `hud.sample` | commit count, DOM node count, changed semantic fields, update span, static/motion mode | Detects per-event DOM churn and verifies persistent semantics remain. |
| `memory.sample` | method/capability, page-owned estimate, decoded image/audio bytes, canvas bytes, telemetry count, cache counts, disposal count | Produces an engine-qualified memory series and ownership accounting. |
| `pcg.prepare` | MapKey, request/start/end/commit times, validation status, bytes, plan/map/wave digests, fallback/retry reason | Demonstrates preparation was before tick 0 and not re-rolled at runtime. |
| `lifecycle` | visibility state, `AudioContext` state, pointer cancellation, canvas/context reset, asset release/reload result | Excludes background intervals and makes restore/memory behavior reproducible. |

### Browser measurement tools and fallbacks

- Use `performance.mark()`/`measure()` for named spans and local monotonic clocks. Use rAF timestamps for frame intervals.
- Feature-detect `PerformanceObserver` entry types. Where available, retain `longtask`, `long-animation-frame`, `event`, and `first-input` entries in the local ring. Event Timing has a browser-enforced granularity floor, so it supplements—not replaces—the explicit game input chain.
- Use a target-device Chrome/Android and Safari/iOS performance capture for CPU/heap inspection. `performance.measureUserAgentSpecificMemory()` is Chromium-specific/permission-limited in practical deployment; it is an optional total-memory signal, never a Safari requirement. Safari records owned counters plus remote inspector evidence instead.
- A GPU p95 exists only when the chosen target profiler exposes a comparable GPU trace. Otherwise record `gpuTiming: null` with tool/version and evaluate the mandatory CPU/frame/memory metrics; do not fabricate GPU timing from rAF.
- Record browser capabilities in each trace (`eventTiming`, `longTask`, `loaf`, `uaMemory`, `offscreenCanvas`, `imageBitmap`, `webAudio`) so an absent metric is distinguished from a zero result.

## Degradation ladder

The ladder is observer-only. Its trigger inputs and decisions are logged but are never read by the simulation. It cannot alter a run seed, plan, event order, damage, target, input admission, reward, or persistent state.

| Level | Entry condition (after 120 s warm-up) | Allowed presentation change | Forbidden change | Exit condition |
|---|---|---|---|---|
| 0 — standard | Default | Full authored bounded standard presentation. | None. | N/A |
| 1 — texture coalesce | Rolling 120-frame p95 >16.7 ms **or** 3 frames >33.4 ms in 120 frames | Coalesce basic hits; cap rank-4 to 4 emitters/1 label locally; drop duplicate P3/P4 audio. | Cull rank-1/2 semantics, alter HUD vital state, alter audio captions. | 600 consecutive frames with p95 <=14.0 ms and no >33.4 ms frame. |
| 2 — visual simplification | Level 1 persists 10 s or 6 frames >33.4 ms in 10 s | Stop rank-4 particles/trails; convert crit fragments/skill flourish to glyph/boundary; pause ambience; draw optional background at half update frequency. | Hide confirmed crit token, ability boundary, boss/threat position, health/Gate/cooldown state. | Same 600-frame hysteresis; restore one level only. |
| 3 — scale / nonessential HUD reduction | Level 2 persists 10 s or 1 frame >100 ms | Reduce Canvas backing render scale to 0.75 (never below 480×270 effective world backing); retain logical coordinates; update nonessential interpolated HUD values at <=10 Hz. | Resize controls below contract, blur/omit semantic labels, change fixed simulation rate. | Same hysteresis; scale restores before texture. |
| 4 — semantic safe mode | Manual accessibility selection, missing optional assets, audio/context failure, or Level 3 persists 30 s | Static rank-1/2/3 grammar, no rank-4, no camera shake/zoom/translation/pulse, silence/procedural audio fallback, compact stable HUD. | Elide any essential state or use audio/motion/color as its sole channel. | User leaves reduced/safe mode; automatic level 4 may return only at a safe intermission after 30 s stable. |
| 5 — diagnostic failure | Backlog grows, a canonical checkpoint differs, active simulation misses its tick contract, or p95 criterion remains breached after safe mode | Preserve a minimal static presentation and write the first failing sample/checkpoint. | Variable timestep, skipped/unrecorded rules tick, map/wave/reward substitution, claiming the fixture passed. | Requires an implementation change and a fresh measured run. |

Degradation decisions use hysteresis to avoid shimmer. They may vary by device because they are presentation choices, but the G6 observer-differential test MUST prove canonical state/hash, RNG/deck cursor, MapPlan/WavePlan digest, damage, cooldown, terminal state, and persistent totals are byte-identical for the same tape across 30/60/120 Hz, standard/reduced/muted/missing-audio, and every reached ladder level.

## Memory lifecycle and visibility policy

| Lifecycle point | Required behavior | Leak / authority guard |
|---|---|---|
| Bootstrap | Load manifest metadata and essential static assets; allocate no more than declared Canvas layers; retain only a bounded diagnostics ring. | No remote request, provider client, raw input path, or unbounded cache. |
| Pre-run | Decode/pin stage-required atlas/cues; validate MapPlan/WavePlan; emit memory baseline after warm-up. | Failure stays pre-run; it does not force an on-run replacement plan or change rules. |
| Active run | Reuse bounded request records/pools; evict only rank-4/inactive optional resources; prevent duplicate audio sources and duplicate presentation events. | Any allocation/retained slope beyond target is a G6 failure candidate, not a reason to collect fewer canonical events. |
| Event end | Release particle/request object to bounded pool; disconnect ended audio nodes; drop references to failed/ended source nodes; close superseded `ImageBitmap` objects if used. | Never retain an event callback that can mutate a simulation object. |
| Stage end / restart | Stop/clear optional audio, release stage-only atlas/bitmaps, clear transient queues, reset backpressure counters only with a logged run boundary. | Persistent campaign data is unrelated to renderer cache; no run-only object survives by accident. |
| `visibilitychange` hidden | Stop presentation scheduling, suspend/quiet nonessential audio according to user/browser policy, cancel active pointers, record lifecycle marker. | Do not use elapsed hidden wall time to advance fixed rules or make PCG choices. |
| Restore / context loss | Recreate only presentation resources from the approved manifest and latest committed snapshot; require fresh input after cancellation. | Canonical state comes from deterministic storage/simulation, not GPU/audio cache recovery. |
| Export/delete | Export only explicit, redacted local diagnostic records; deletion clears local diagnostics and records action/result. | No beacon, analytics SDK, account, cloud sync, or hidden persistence. |

## Reduced-motion and sensory-equivalence budget

`prefers-reduced-motion` and the in-game setting select a semantic projection, not a low-priority visual preference. The reduced-motion profile is Level 4 from the start and is measured as its own target-device cell.

| Meaning | Standard mode | Reduced-motion / effects-muted requirement | Observable target |
|---|---|---|---|
| Threat, player/Gate damage | World boundary/directional wedge plus stable HUD | Patterned/static boundary, icon/label/fill and one non-moving wedge | 100% of active rank-1 events retain static shape/text/fill; 0 lower-rank protected-zone intersections. |
| Critical and ability resolution | Bounded fracture/geometry and optional cue | Static `CRIT` token/glyph and affected boundary for the same semantic window | Event-to-presentation join remains complete; no color/sound/motion-only state. |
| Boss/stage state | Locator/plate and compact edge treatment | Static location frame, plate, stage tag; no zoom, camera kick, strobe, or slide | Same source event and static marker available before optional motion. |
| Health/cooldown | Calm persistent edge HUD, bounded response motion | Same number/icon/pattern/segmented fill; no pulse/spin/bounce | Health state begins on next rendered frame; cooldown semantic update remains at least every 6 ticks. |
| Basic hits/ambience | Rank-4 texture and optional P3/P4 sound | Static impact stamp or omission; silence valid | Does not affect canonical result or essential comprehension. |

The performance target does not override safety: no component exceeds the source-derived three-flashes-per-second ceiling. Motion-off, mute, missing-audio, high-contrast, and fallback-renderer runs must all retain the same deterministic result and viable visible semantic path.

## Test plan and evidence packet

### Execution matrix

| Test | Device/mode | Minimum workload | Required measurements | Fails when |
|---|---|---|---|---|
| `dense-frame` | Each Target v1 cell; standard | Cinder Span 90 s dense replay after 120 s warm-up; five repetitions | rAF p50/p95/p99/max, long frames, CPU spans, draw calls, cull counts, input chain | Any p95 frame/input threshold fails or raw samples/metadata are incomplete. |
| `paired-presentation` | Each baseline cell; presentation on vs disabled | Five 10 min passes at exact ticks 10,800–46,800 | Median per-pass p95 CPU/GPU delta, allocations, protected-zone masks | Presentation contribution/mask thresholds fail; GPU absence is explicit, not inferred. |
| `memory-soak` | Each Target v1 baseline browser | 30 min active foreground loop with dense/boss/choice/audio transitions | Memory time series, owned counters, disposal count, telemetry count, long-frame rate | Retained delta/slope/resident cap/long-frame rate breaches or a cache grows without bound. |
| `input-chain` | Touch, keyboard, controller where supported; standard and reduced motion | Narrow-gap/control fixture plus boss/stage interruption | Handler, capture->admit, admit->visible, missed/rejected actions, source switch | p95 >1 ms handler, >33.4 ms admission, >100 ms visible, or canonical result differs by source/mode. |
| `ladder` | Force every degradation level with synthetic observer pressure; normal and reduced | Same pinned dense tape | Trigger/exit logs, semantic event joins, masks, canonical hash/digest | A level drops rank-1/2 semantics, reaches a different canonical state, or oscillates without hysteresis. |
| `audio-lifecycle` | Audible, muted, blocked, missing/decode-failed asset | P0/P1/P3 cue sequence plus narration | Schedule attempt/result, source count, decoded bytes, static/caption fallback | Audio failure delays/changes a rule result, leaks sources/buffers, or removes visual/caption path. |
| `pcg-preparation` | Every Target v1 browser | 64 MapKeys × 3 generations plus stage transition preparation | start/end/commit marks, digest, validation result, temporary bytes, before-tick-0 proof | A plan commits after tick 0, differs for same key/version, exceeds p95/bytes, or any active-frame generation occurs. |
| `visibility-recovery` | Each baseline browser | Hide/restore, audio suspend/resume, pointer cancellation, Canvas resource reinit | lifecycle entries, resource counts, fresh input requirement, checkpoint equality | Restore advances rules from hidden time, retains stale input, leaks resources, or changes result. |
| `offline-ops` | Installed/local bundle, network disabled | Export/delete plus replay with missing optional asset | network audit, local export/deletion result, fallback, canonical hash | Any network/provider dependency, missing rollback artifact, or export/delete transport appears. |

### Required G6 artifact

The release candidate must create `qa/evidence/gates/G6-ops-perf-and-local-telemetry.json` with raw-sample references and this minimum envelope:

```yaml
gate: G6
status: NOT_MEASURED_until_evidence_review
build_tuple: [build_id, rules_version, serializer_version, grammar_version, asset_manifest_hash]
cell: [device_model, os_version, browser_version, viewport_css, backing_store, dpr, render_scale]
fixture: [fixture_id, map_key, map_digest, wave_digest, input_tape_digest]
mode: [input_source, reduced_motion, muted, audio_failure, ladder_level]
metrics:
  frame: [count, p50_ms, p95_ms, p99_ms, max_ms, over_33_4_count]
  input: [handler_p95_ms, capture_to_admit_p95_ms, admitted_to_visible_p95_ms]
  memory: [method, sample_count, p95_mib, start_mib, end_mib, slope_mib_per_min]
  presentation: [cpu_p95_delta_ms, gpu_p95_delta_ms_or_null, vfx_mask_violations]
  pcg: [prepare_p95_ms, temporary_p95_mib, commits_after_tick0]
  diagnostics: [dropped_samples, telemetry_dropped, first_failure]
operations: [network_disabled_result, export_result, deletion_result, rollback_exercise]
canonical_differential: [hash_equal, rng_equal, input_equal, map_equal, wave_equal, damage_equal, cooldown_equal, terminal_equal, persistence_equal]
```

A populated artifact is evidence for review, not a self-issued PASS. G6 requires the authoritative threshold—telemetry implemented; rollback/readiness complete; p95 frame <=16.7 ms; long frames <0.5%; stable 30-minute memory; input <=100 ms—plus the local-only offline/export/delete/network-disabled proof. The current G6 ledger records no such evidence.

## Source ledger

| ID | Source | Observed support / bounded use | Accessed |
|---|---|---|---|
| P1 | [Abyssal Command product contract](../../../docs/abyssal-command-defense-survivor-design.md) | Binding 60 Hz deterministic rules, offline/local persistence, Canvas snapshot adapter, movement-first input, and reduced-motion semantic requirement. | 2026-07-22 |
| P2 | [`engineering/perf-budget.md`](../engineering/perf-budget.md) | Existing target-only G6 envelope: p95 <=16.7 ms, <0.5% >33.4 ms, 30-minute memory soak, p95 <=100 ms input, paired presentation targets. | 2026-07-22 |
| P3 | [`research/vfx-hud-feedback.md`](vfx-hud-feedback.md) | Existing rank hierarchy, 18%/8% mask caps, six-emitter/two-label cap, static semantic fallback, paired dense-replay method. | 2026-07-22 |
| P4 | [`engineering/resource-manifest.md`](../engineering/resource-manifest.md) | Existing per-audio-file limits, local same-origin resource and no-runtime-provider boundary. | 2026-07-22 |
| P5 | [`ops/telemetry-contract.md`](../ops/telemetry-contract.md) | Local-only bounded diagnostics, 4,096/16,384 record caps, event joins, and observer-differential evidence shape. | 2026-07-22 |
| E1 | [MDN: `requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) | rAF provides a browser animation callback and is the frame-interval clock used here; visibility behavior requires separate lifecycle treatment. | 2026-07-22 |
| E2 | [MDN: PerformanceObserver](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver), [Long Tasks API](https://developer.mozilla.org/en-US/docs/Web/API/Long_Tasks_API), and [Long Animation Frames](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongAnimationFrameTiming) | Feature-detected diagnostic sources for task/frame attribution; no API is assumed cross-browser. | 2026-07-22 |
| E3 | [web.dev: Optimize INP](https://web.dev/articles/optimize-inp) and [MDN: PerformanceEventTiming](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEventTiming) | Event Timing measures interaction timing but has filtering/granularity limits; explicit game input IDs remain authoritative for the control chain. | 2026-07-22 |
| E4 | [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) | A page lifecycle signal for pause/restore policy; hidden time is excluded from foreground frame sampling. | 2026-07-22 |
| E5 | [MDN: OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas) and [MDN: ImageBitmap.close](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap/close) | Optional worker/offscreen acceleration and explicit bitmap resource release; neither is a required product dependency. | 2026-07-22 |
| E6 | [MDN: Web Audio API best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) | Web Audio needs user-gesture/autoplay handling and resource-aware buffer use; physical output latency is not asserted by this packet. | 2026-07-22 |
| E7 | [MDN: `measureUserAgentSpecificMemory`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory) | Optional, capability-qualified total-memory estimate; unavailable browsers use documented local counters and inspector traces instead. | 2026-07-22 |
| E8 | [W3C: Understanding SC 2.3.1, Three Flashes](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) and [MDN: `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) | Three-flashes safety ceiling and system motion preference motivate the static reduced-motion projection; this is not a certification claim. | 2026-07-22 |

External browser documentation establishes API behavior and constraints, not these numeric performance targets. The targets above are intentionally original acceptance criteria that must be measured on the named devices before G6 can be reconsidered.
