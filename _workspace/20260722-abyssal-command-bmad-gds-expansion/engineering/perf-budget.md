# Performance budget — Cinder Span slice

**Status:** Stage 3 verification-ready, target-only engineering contract. No target-device browser capture, profiler trace, resource audit, or gate evidence exists. **G1–G8 remain NOT MEASURED / NOT PASSED; G2 is integrity-only, not a balance conclusion; release remains BLOCKED.** This document changes no runtime code, asset, provider, or gate result.

## Scope and non-negotiable boundary

The 90-second Cinder Span dense replay retains the deterministic 60 Hz simulation while Canvas/HUD/VFX/audio/narration and reduced-motion/muted/missing-asset paths consume only detached snapshots and confirmed events. Render pressure, buffer state, audio scheduling, degradation, and diagnostics MUST NOT change simulation ticks, input order, RNG/deck cursor, MapPlan/WavePlan, targeting, damage, cooldown, result, or persistence.

```yaml
performance_contract:
  simulation_rate_hz: 60
  tick_budget_ms: 16.667
  fixture: cinder-span-90s-dense-replay
  target_cells:
    - android-baseline-v1: Pixel_6a_retail__Chrome_Stable__844x390_css__DPR_3
    - ios-baseline-v1: iPhone_13_retail__Safari__844x390_css__DPR_3
    - low-viewport-v1: 480x270_css__1x_backing
  measurements_are: TARGET_only
  required_clocks: [monotonic_input_time, simulation_tick, presentation_time]
  forbidden_substitutions: [average_fps_only, desktop_throttling, emulator_only, render_delta_as_rule_time, cross-browser_metric_substitution]
  failure_artifact: first_budget_breach_or_first_divergent_tick
```

The named devices/cells are acceptance targets, not observed support or performance results. The capture receipt records device, OS/browser version, thermal/power state when exposed, CSS and backing viewport, DPR, render scale, build/rules/serializer/grammar/asset-manifest digests, fixture/tape/map/wave digests, input source, and presentation mode.

## Stage 3 target ledger

Every value below is a **TARGET**, not an observed result. `Blocked` means no result can be claimed until the named instrumentation, fixture, and raw evidence exist.

| Surface / target | Target threshold | Owner | Browser/device verification method | Required evidence path | Blocked by |
|---|---:|---|---|---|---|
| Foreground frame interval | p95 <=16.7 ms in each target cell, 90-second dense replay | performance engineer + QA | After 120-second warm-up, retain consecutive foreground rAF deltas; five comparable passes/cell; report count, p50/p95/p99/max and first breach. p95 is nearest-rank `ceil(0.95*n)`. | `qa/performance/frame-samples.json`; raw references in `qa/evidence/gates/G6-ops-perf-and-local-telemetry.json` | No device capture, pinned fixture, raw samples, or receipt currently exists. |
| Long/extreme frames | <0.5% >33.4 ms and 0 >100 ms in 30-minute foreground soak | performance engineer + QA | Count raw rAF deltas after warm-up; exclude but log visibility/lifecycle intervals; retain first >33.4/>100 ms sample. | `qa/performance/frame-samples.json` | No 30-minute soak or lifecycle trace exists. |
| Fixed simulation + snapshot CPU | p95 <=5.0 ms; no hidden catch-up, skipped, or extra rules ticks | game programmer + performance engineer | Mark fixed-tick admission through immutable snapshot hand-off; correlate each sample to `simTick`, `simSteps`, and backlog. | `qa/performance/tick-backlog-trace.json` | Observer instrumentation and target-device trace do not exist. |
| Canvas draw / HUD CPU | draw p95 <=6.0 ms; HUD p95 <=0.75 ms and <=1 commit/frame | rendering engineer | Marks for clear/background/world/sprite/VFX/composite and edge-HUD commit; pair with draw/node counts. | `qa/performance/frame-samples.json` | Renderer/HUD probes and capture are absent. |
| Presentation cost | median of five matched-pass p95 deltas <=2.0 ms CPU; <=2.5 ms GPU only where exposed | performance engineer | Compare presentation-on and disabled at matching simulation ticks. GPU field is `null` with capability/tool version if unavailable; rAF is never a GPU proxy. | `qa/performance/presentation-delta.json` | Paired traces and capability-qualified GPU profiler data are absent. |
| Input listener work | p95 <=1.0 ms; p99 <=2.0 ms capture-to-normalized enqueue | input engineer + QA | Local monotonic marks at pointer/keyboard/controller listener entry and enqueue; no layout/readback/decode on the handler path. | `qa/performance/input-chain-trace.json` | Input-chain instrumentation and target-device runs are absent. |
| Input-to-visible chain | capture-to-admission p95 <=33.4 ms (<=2 ticks); accepted static confirmation p95 <=50 ms; full visible chain p95 <=100 ms | input engineer + UI engineer + QA | Join opaque local input ID to enqueue, admitted tick/time, and first frame containing the accepted static state; segment by source and motion/audio mode. | `qa/performance/input-chain-trace.json` | Required joins and physical-device capture are absent. |
| Rank-4 particles / visual coverage | <=6 emitters and <=2 aggregate labels per 500 ms within 160 dp; alpha <=18% viewport and <=8% active rank-1 zone; each confirmed source event receives an emitted/coalesced/culled disposition p95 <=50 ms | VFX engineer + QA | Join immutable source event ID to queue request and disposition; retain reason and static-equivalent/protected-zone flags. Per-frame layer-mask/cull record during dense replay; protected-zone intersection or missing disposition is a failure, not a performance trade-off. | `qa/performance/vfx-density-audit.json`; `qa/replay-corpus/observer-differential-report.json` | Event-to-queue joins, masks, emitter accounting, and fixture capture are absent. |
| Audio scheduler | P0/P1 accepted event to schedule attempt p95 <=50 ms; every P0/P1 result is `scheduled` or records its same-event static/caption fallback; `dropped` is permitted only for lower-priority P3/P4 work | audio engineer + QA | Join confirmed event ID to Web Audio schedule-attempt timestamp and result; audit priority, fallback ID/result, active sources, and cue disposition. Physical speaker latency is not asserted as browser-measurable. | `qa/performance/audio-cue-audit.json`; `qa/replay-corpus/audio-observer-differential.json`; `qa/accessibility/audio-vfx-fallback-capture.json` | Audio observer/fallback records, approved local media, and device capture are absent. |
| Audio/narration density | basic-hit candidates <=1/125 ms and <=8 emitted/s; no overlapping non-emergency narration or line within 8 s | audio engineer + narrative engineer | Audit request/emitted/coalesced/dropped queue records plus active source count; test audible, muted, blocked, and missing/decode-failed modes. | `qa/performance/audio-cue-audit.json`; `qa/replay-corpus/audio-observer-differential.json` | No local audio manifest, rights-cleared media, queue records, or differential run exists. |
| Page-owned memory | p95 <=64 MiB after warm-up; end-start retained delta <=5 MiB and fitted post-warm-up slope <=0.10 MiB/min across 30 min | performance engineer + QA | Chromium: capability-qualified `measureUserAgentSpecificMemory()` plus counters. Safari: owned counters plus remote-inspector trace; never compare totals across engines. | `qa/performance/allocation-soak.json` | Memory probes, disposal records, and 30-minute target-device soaks are absent. |
| JS heap diagnostic | p95 <=48 MiB where the browser exposes a heap counter | performance engineer | Record method/capability as diagnostic only; heap alone cannot pass total-memory coverage. | `qa/performance/allocation-soak.json` | Browser-supported heap capture is unverified. |
| Canvas backing stores | <=2 live full-viewport RGBA8 stores; at 2532×1170 each is about 11.3 MiB and total about 22.6 MiB | rendering engineer | Record each live store width, height, count, bytes `w*h*4`, including offscreen effects, at warm-up, peak, and teardown. | `qa/performance/canvas-buffer-audit.json` | Buffer inventory/lifecycle instrumentation is absent. |
| Atlas, draw, and media residency | <=4 live atlases and <=16 MiB decoded atlas bytes; <=450 draw submissions/frame standard and <=250 reduced-motion; static media <=13 MiB compressed and <=48 MiB decoded residency | rendering engineer + resource owner | Content-addressed manifest audit joined with decoded dimensions/bytes, draw commands by layer, unique atlas count, and disposal log. | `qa/performance/canvas-buffer-audit.json`; `qa/resource-audit/media-measurements.json` | Manifest, approved media, decoded-resource accounting, and audit are absent. |
| Telemetry boundedness | default <=4,096; hard cap <=16,384 records; overflow increments drop count and never backpressures rules | telemetry engineer + QA | Ring-count/overflow test during the soak; correlate dropped diagnostics without dropping canonical events. | `qa/performance/allocation-soak.json`; `qa/evidence/gates/G6-ops-perf-and-local-telemetry.json` | Local telemetry instrumentation is not implemented. |
| Pre-run PCG | p95 <=250 ms; <=8 MiB temporary working set; 0 ms active-run generation | deterministic-core engineer + QA | Mark request/start/end/commit/bytes for 64 MapKeys x 3 generations; verify plan commitment before tick 0 and stable digests. | `qa/replay-corpus/map-plan-replay-report.json` | PCG preparation measurement fixture and raw trace are absent. |

## Browser/device measurement protocol

1. Use retail `android-baseline-v1`, `ios-baseline-v1`, and `low-viewport-v1` cells; battery >=50%, no power-save/Low Power Mode, thermally normal, foreground document. Emulator, desktop throttling, or average FPS may diagnose but cannot satisfy this contract.
2. Warm each cell for 120 seconds. Keep the build tuple, fixture, MapKey/MapPlan/WavePlan, input tape, viewport, render scale, and mode fixed per comparison. Collect 30/60/120 Hz observer differentials separately.
3. Retain rAF frame deltas separately from named update/draw/HUD spans. Feature-detect and record `PerformanceObserver` capability for `longtask`, `long-animation-frame`, and `event`; missing API data is `null`, not zero or borrowed from another browser.
4. Run five paired presentation-on/disabled passes at matched simulation ticks. Report each pass p95 delta and the median of five p95 deltas; do not pool browser/device cells.
5. Run the 30-minute foreground soak through dense, boss, choice, audio, reduced-motion/muted, missing-audio, and teardown/restart transitions. Log `visibilitychange`, pointer cancellation, audio context state, canvas reset, allocation/disposal, and telemetry drops; hidden time is not a frame sample.
6. Execute observer differential replays at 30/60/120 Hz with standard, reduced-motion, muted, missing-audio, fallback-renderer, and every reached degradation level. Canonical hash, RNG/input cursor, MapPlan/WavePlan digest, damage, cooldown, terminal result, and persistence must be byte-identical.

## Resource and degradation invariants

1. Decode image/audio media before a run or at an authored safe intermission; active input handlers and dense combat frames never fetch, decode, allocate an unbounded cache, or generate a plan.
2. Preserve rank-1 danger, player/Gate vital state, confirmed ability/critical boundary, boss location, cooldown readiness, and their static equivalents. First shed rank-4 texture, duplicate P3/P4 audio, optional ambience, and floating aggregates by observer-only deterministic keys.
3. `prefers-reduced-motion` and in-game reduced-motion select a static semantic projection, not an under-measured lower tier. Remove shake, flash, zoom, translation, parallax, recoil displacement, burst travel, pulse, and rotation while retaining static hazard boundaries, labels/icons/patterns, health/Gate/cooldown state, crit token, action confirmation, and objective/status text.
4. A performance breach writes its first failing sample/checkpoint and fails the fixture. It never authorizes variable time, hidden tick loss, map/wave reroll, lower control geometry, removed semantic feedback, or a pass claim.

## Required evidence envelope

`qa/evidence/gates/G6-ops-perf-and-local-telemetry.json` is a future review receipt, not a self-issued pass. It MUST reference raw frame/tick/input/memory/resource samples and contain the target-cell/build/fixture/mode tuple, percentile method and sample counts, browser capabilities, first failure/missingness counts, export/delete/network-disabled results, and observer-differential equality results. A populated receipt remains **NOT MEASURED / NOT PASSED** until authoritative gate review.

## Missing observed measurements

There are currently no target-device frame, CPU/GPU, input, audio scheduling, Canvas buffer, decoded media, telemetry, PCG-preparation, or memory-soak observations; no performance evidence path listed above currently contains a receipt. No target may be reported as achieved.

## Sources

`research/performance-and-rendering-budget.md`, `research/ui-ux-persona-and-controls.md`, `engineering/architecture-contract.md`, `engineering/resource-manifest.md`, `ops/telemetry-contract.md`, and the current product contract at `docs/abyssal-command-defense-survivor-design.md`.