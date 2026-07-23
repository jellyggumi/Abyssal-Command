# Movement optimization contract — deterministic one-thumb path

**Status:** Stage 3 verification-ready, target-only contract. It does not add manual aim, attack, target selection, a tactical queue, runtime instrumentation, or new combat authority. No measurement artifact exists. **G1–G8 remain NOT MEASURED / NOT PASSED; release remains BLOCKED.**

## Ownership and action vocabulary

```yaml
movement_contract:
  rules_authority: defense-catalog.js_and_deterministic_core
  simulation_rate_hz: 60
  accepted_actions: [move(x_normalized,y_normalized), ability(slot)_when_catalog_authorized]
  prohibited_action_fields: [targetId, aimAngle, rawScreenCoordinate, damage, cooldownValue, wallClock, presentationState]
  sources: [touch, keyboard, controller, accessibility_switch]
  source_effect_on_rules: none
  event_order: tick_then_monotonic_sequence
  current_status: target_not_implemented
```

Touch, keyboard, controller, and switch input normalize to the same action form. A source label is diagnostic only; it cannot branch rules. Release, cancellation, focus loss, resize/rotation, context loss, and overlay-open enqueue exactly one neutral movement action for the next tick. Resuming requires a fresh action after the lifecycle boundary. An explicit semantic overlay suppresses movement/ability bindings but does not become a combat action or hidden pause.

## Stage 3 path invariants

| Invariant | Owner | Verification method | Required evidence path | Blocker |
|---|---|---|---|---|
| Every live input becomes only a radial-clamped normalized `move(x,y)` or catalog-authorized `ability(slot)`; no raw coordinate, target, aim, device time, or observer state enters rules. | input engineer + deterministic-core engineer | Schema/allowlist test and fixed-tape replay of each source. | `qa/replay-corpus/cross-input-parity.json` | Normalizer/schema fixture does not exist. |
| Inputs admit by fixed tick then monotonic sequence; render cadence, wall-clock, device source, handedness, dead zone, and observer mode cannot reorder them. | deterministic-core engineer + QA | Replay identical normalized tapes at 30/60/120 Hz and source/mode matrix; compare admitted action sequence and every checkpoint. | `qa/replay-corpus/cross-input-parity.json` | Canonical action/event capture and target matrix are absent. |
| Cancel/release/focus-loss/overlay/rotation emits neutral at the next tick; stale vector, held key, or pointer capture never resumes after the boundary without fresh intent. | input engineer + accessibility engineer | Script lifecycle interruption at varying tick boundaries, then compare normalized stream, next neutral tick, and hashes. | `qa/replay-corpus/overlay-rotation-input.json` | Lifecycle fixture and replay instrumentation are absent. |
| A movement card declares a safe lane/escape path and a persistent non-color/non-motion telegraph. A non-relief card has a movement answer; untelegraphed forced hits reject the card. | encounter designer + QA | Deterministic reachability/safe-lane fixtures across `(card, anchor set, baseline build, starting-state envelope)`; record first blocked path separately from steering quality. | `qa/replay-corpus/movement-safe-lane-coverage.json`; `qa/replay-corpus/wave-reachability-report.json` | Declared routes, baseline envelope, and corpus are absent. |
| Scheduler and renderer never reroll an encounter/path. Candidate IDs, tick-only cooldowns, domain-separated RNG, authored fallback order, MapPlan/WavePlan digest, and route declaration remain fixed after admission. | deterministic-core engineer + PCG/encounter engineer | Same tuple replay plus negative reroll/fallback cases; compare canonical plan bytes/digests, event stream, and first mismatch. | `qa/replay-corpus/map-plan-replay-report.json` | Immutable-plan replay corpus is absent. |
| Layout rotation/resize preserves the active logical canvas and cannot remap already-admitted intent, synthesize action, or change tick count. Layout/handedness change is pre-run or authored-intermission only. | UI engineer + input engineer + QA | Rotation/resize at fixed replay ticks with safe-inset/gesture geometry capture; compare input stream/ticks/hash before and after. | `qa/replay-corpus/overlay-rotation-input.json`; `qa/accessibility/control-geometry-audit.json` | Physical-device rotation fixture and geometry capture are absent. |
| Motion/audio/haptic/reduced-motion/fallback-renderer differences remain observer-only. A missing/delayed/duplicated cue cannot alter canonical state. | rendering/audio engineers + QA | Observer differential replay; compare hash, RNG/input cursor, plan digests, damage, cooldown, terminal result, and persistence. | `qa/replay-corpus/observer-differential-report.json` | Observer adapter/instrumentation and corpus are absent. |

## Interaction targets and measurement plan

Every threshold below is a **TARGET**, not a result. The input chain uses opaque local input IDs and monotonic timestamps; it records normalized vectors/action kind but never raw gesture paths or identity.

| Measure | Target | Owner | Browser/device protocol | Required evidence path | Blocker |
|---|---:|---|---|---|---|
| Source event -> normalized enqueue | p95 <=16.7 ms | input engineer + QA | On `android-baseline-v1` Pixel 6a/Chrome, `ios-baseline-v1` iPhone 13/Safari, and 480x270 low-viewport cell after 120-second warm-up, mark listener entry and enqueue for touch/keyboard/controller where supported. Report p50/p95/p99/count/missing by source. | `qa/performance/input-chain-trace.json` | No device matrix, handler marks, or raw trace exists. |
| Listener work | p95 <=1.0 ms; p99 <=2.0 ms | input engineer | Record listener start to enqueue only; no synchronous layout, readback, decode, or game rule work may be included as a hidden success path. | `qa/performance/input-chain-trace.json` | No instrumentation or target-device capture exists. |
| Enqueue -> accept/reject | <=1 simulation tick; an arrival at the tick boundary may wait one extra tick; p95 capture -> admission <=33.4 ms | deterministic-core engineer + QA | Join enqueue and authoritative admitted tick/time; run the same tape at 30/60/120 Hz render cadence without pooling cells. | `qa/performance/input-chain-trace.json`; `qa/replay-corpus/cross-input-parity.json` | Authoritative admission joins and replay fixtures are absent. |
| Accepted -> static confirmation | p95 <=50 ms | UI engineer + QA | Join accepted input to first visible static HUD/control state; run standard, reduced-motion, muted, and missing-audio modes. | `qa/performance/input-chain-trace.json` | Event-to-frame join and physical capture are absent. |
| End-to-end visible movement response | p95 <=100 ms | input + rendering engineers + QA | Join capture -> enqueue -> admission -> first presentation frame; compare to presentation-disabled replay to isolate presentation-added latency. | `qa/performance/input-chain-trace.json`; `qa/performance/presentation-delta.json` | Paired traces and presentation-disabled harness are absent. |
| Presentation-added movement latency | p95 <=1 rendered frame | rendering engineer + QA | Match by accepted simulation tick across presentation-on/disabled five-pass pairs; retain per-pass p95 deltas and median. | `qa/performance/presentation-delta.json` | Paired tick-aligned capture is absent. |
| Safe-lane coverage | 100% of declared card/envelope tuples provide a reachable declared answer; relief segment contains no major-role spawn | encounter designer + QA | Enumerate planned fixtures with relief target range 900–1500 ticks; retain route proof, telegraph lead, and first failed tuple. | `qa/replay-corpus/movement-safe-lane-coverage.json` | Route schema, fixture catalog, and baseline envelope are absent. |
| Cross-source/mode parity | Equal canonical result for the same normalized tape across touch/keyboard/controller/switch where supported; standard/reduced/muted/missing-audio/fallback renderer and 30/60/120 Hz | QA + deterministic-core engineer | Compare every checkpoint hash, RNG/deck/input cursors, map/wave digest, damage, cooldown, terminal state, and persistence; first mismatch is P0. | `qa/replay-corpus/cross-input-parity.json`; `qa/replay-corpus/observer-differential-report.json` | Normalized tapes, snapshots, and comparator are absent. |
| Geometry and accessibility controls | 0 required hit-rect overlap with safe/gesture inset; movement zone 50% safe logical width; 88dp pad radius; 48dp persistent and 52dp skill targets | UI/accessibility engineer + QA | Screenshot/geometry assertions at 480x270 and 844x390, both cutout sides, left/right layout, keyboard/controller focus traversal, and one-thumb cancellation trial. | `qa/accessibility/control-geometry-audit.json` | Target-device geometry/focus evidence is absent. |

## Browser/device protocol

1. Capture retail target devices only: Pixel 6a with Chrome Stable, iPhone 13 with installed Safari, and declared 480x270 low profile. Record exact OS/browser, battery/thermal state when exposed, CSS/backing viewport, DPR, render scale, build/rules/serializer/grammar/asset-manifest digests, fixture, MapKey/MapPlan/WavePlan, input tape, source, and observer mode. Desktop throttling and mean FPS do not substitute.
2. Warm each foreground cell for 120 seconds. Keep the pinned build and fixture tuple identical per comparison; collect 30/60/120 Hz as separate observer cadence runs. Missing browser API/profiler fields are capability-qualified `null`, never estimated.
3. Capture listener, enqueue, admission, and first-visible timestamps with the same monotonic clock where possible; record sampling drops/missing joins. The deterministic admission tick remains authoritative. Browser Event Timing may supplement but never replace the explicit chain.
4. Run narrow-gap, dense encounter, boss/stage interruption, overlay open/close, cancel/focus-loss, rotation, left/right handedness, and dead-zone 6/12/18% scenarios. Record completion, reversals, unavailable/misactivation candidates, and hazard outcome as local diagnostic signals only; subjective accessibility requires separate consent-based testing.
5. A target breach or missing critical join writes the first failing input ID/tick/frame and fails that fixture. It cannot be hidden by lowering render rate, suppressing static feedback, forcing a path, changing a plan, or discarding samples.

## Reduced-motion and sensory-equivalence contract

Reduced motion is a required semantic projection from the start, not a post-performance fallback. The in-game setting and `prefers-reduced-motion` remove shake, flash, zoom, rotation, parallax, recoil displacement, burst travel, pulse, and camera translation. They retain a static position/boundary, patterned icon/text/fill, player/Gate health, cooldown/ready state, crit glyph, accepted/unavailable action state, objective/status text, and non-motion/non-color telegraph.

| Semantic delivery target | Owner | Verification method | Required evidence path | Blocker |
|---|---|---|---|---|
| Each active rank-1 threat retains a static shape/text/fill and no lower-rank protected-zone intersection. | VFX/UI engineer + QA | Event-to-presentation join and rank-mask capture in standard/reduced/muted/no-haptic modes. | `qa/accessibility/control-geometry-audit.json`; `qa/performance/vfx-density-audit.json` | Static projection, joins, and masks are absent. |
| Critical/ability resolution retains static `CRIT`/boundary and cooldown state for the same source event; no audio, color, or movement-only meaning. | UI/VFX/audio engineers + QA | Source event ID join across reduced/mute/missing-audio runs; inspect fallback capture. | `qa/replay-corpus/observer-differential-report.json`; `qa/accessibility/audio-vfx-fallback-capture.json` | Feedback adapter, local assets/fallbacks, and captures are absent. |
| Health/Gate/boss/objective state remains persistent and readable; motion removal never delays accepted-action static confirmation beyond target. | UI/accessibility engineer + QA | Fixed replay at both target viewports, high contrast and reduced motion; measure accepted-to-static frame time. | `qa/performance/input-chain-trace.json`; `qa/accessibility/control-geometry-audit.json` | Device capture and accessibility review are absent. |
| Motion/audio/haptic failure yields the same deterministic output and a viable static path. | QA + deterministic-core engineer | Full observer differential including reduced, mute, blocked/missing/decode-failed audio, and fallback renderer. | `qa/replay-corpus/observer-differential-report.json`; `qa/replay-corpus/audio-observer-differential.json` | Differential corpus and approved/fallback media conditions are absent. |

## Evidence and gate discipline

The future artifacts named here are evidence for review, not a pass. The measurement receipt must include raw-sample references, target-cell/build/fixture/mode metadata, percentile method, dropped/missing counts, first failure, and canonical differential result. No observed latency, path coverage, reduced-motion result, input parity, or browser/device performance result is available today. **G1–G8 remain NOT MEASURED / NOT PASSED; G2 is integrity-only and NOT a balance conclusion; release is BLOCKED.**

## Sources

`research/ui-ux-persona-and-controls.md`, `research/performance-and-rendering-budget.md`, `engineering/architecture-contract.md`, `engineering/perf-budget.md`, `ops/telemetry-contract.md`, and the current product contract at `docs/abyssal-command-defense-survivor-design.md`.