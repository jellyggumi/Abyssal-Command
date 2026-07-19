# Stage 2 Gate Review — G2/G3/G6/G7/G8

```yaml
run_id: "20260718-strategy-control-depth"
review_date: "2026-07-19"
review_type: "Stage 2 implementation-entry adjudication; not Stage 2 exit"
operating_mode: "Stage 2 integrated balance/core-loop/control implementation entering conditional Stage 3 responsiveness"
public_beat: "rules-v7 ten-stage 24x12 tactical campaign candidate with exactly three materially distinct routes per stage, deterministic parity, and measured responsiveness"
overall_verdict: FIX
stage_2_exit: BLOCKED
stage_3_gate_pass: BLOCKED
production_implementation: AUTHORIZED_WITH_ORDER_AND_BOUNDS
production_authority: "campaign-state.js remains the sole campaign reducer and save/replay authority"
qa_measurement_source: "_workspace/20260718-strategy-control-depth/qa/gate-measurements.md"
qa_measurement_status: "v6 baseline is pre-change only; required durable v7 Q2/Q3/G6 measurements are not attached"
```

## Evidence discipline

A document/model target is not a measured value. The director ran no tests. `/tmp/abyssal-balance-v6.json` and Main's isolated copied-module Echo probe are pre-change rationale only. Every current gate sample must pin `abyssal-surge-rules-v7`, save schema `5`, exact command, build/revision, timestamp, seeds/profile, checksum, and retained output in `qa/gate-measurements.md`. No gate below is PASS.

## Numeric verdict table

| Gate | Required numeric value | Current observed value | Director verdict | Exact blocker / next evidence |
|---|---|---|---|---|
| **G2 — rules and balance** | v7 mechanic coverage `100%`; matchup/casual win `45–55%`; TTK within `±15%`; max combo EV `≤1.30×` median | v6 designer ledger exists but current v7 audit is `NOT RUN`; v6 pre-change casual `40.0%/200` and 12-pair max/median `1.16845` are comparators only; integrated v7 24×12 TTK/build matrix `NOT RUN` | **FIX** | QA must measure v7 topology + Echo/caps as one integrated candidate, reporting exact provenance, CI/defeat histogram/identical double-run, TTK, all current mechanics, and all-stage build combos. |
| **G3 — player-type diversity** | `≥5` archetypes tested; `≥3` independently viable at `45–55%`; no archetype `>50%` of optimal selections | v6 deterministic risk baseline was rusher `0%`, greedy `100%`, optimal `100%`, comeback `0%`, casual `40%`; it is not a v7 or human archetype result; integrated v7 rotation `NOT RUN` | **FIX** | ≥5 declared v7 archetypes, ≥200 stratified runs or sessions per declared method, ≥3 viable, strategy/action/route distinctions, dominance share, and human rotation/play evidence. |
| **Implementation verification** | E2/E4/E5 control/runtime foundation deployed; no P0/P1 source blockers | frame-independent camera (τ=0.1304s, alpha=1-exp(-dt/τ)) unit-tested at `battle-realtime-three.js:1509-1513`; fixed-step sim (1/60s, 0.10s clamp, 6-step max) at `battle-realtime-three.js:966-993`; pointer-capture safety (activePointerId tracking, lostpointercapture handler) at `battle-visualizer.js:228-232,837-932`; three fixes applied: CSS compact-stage-id visibility (styles.css), pointer deduplication, hidden-summary→lang-toggle test correction (tests/playtest-browser-3stage.cjs); 71/71 focused + 9/9 app tests passing (FinalBlockerReview) | **VERIFIED SOURCE, NOT MEASURED** | No P0/P1 production blocker. Source-level implementation verified. All browser/frame/latency evidence still required for G6. |
| **G6 — runtime/performance** | mean frame `≤16.7 ms`, p95 `≤20 ms`, p99 `≤25 ms`; no over-budget streak `>3`; feedback p50/p95/hard max `≤50/100/200 ms` over `≥500` samples/profile; movement endpoint delta `≤.02 u`; camera target delta `≤.001 u`; path-build median/p95 `≤8/12 ms`; WebGL2/Canvas parity `100%`; 30-minute soak leak `≤5%`; v6-envelope acceptance `0` | source-level implementation verified (frame accumulator clamping at battle-visualizer.js:1885-1940, exponential camera, pointer deduplication, anchor parity); zero numeric measurement of: 30/60/120Hz camera divergence, feedback latency traces, frame distribution samples, cross-renderer action traces, soak memory growth, or v6-envelope rejection counts; behavioral inspection and unit tests show no P0/P1 defect but cannot substitute for profiled runtime evidence | **NOT RUN** — all evidence absent | (1) Run durable v7 browser measurement: all 10 stages, all renderer/input/device profiles (60 cells), capturing raw frame/latency/path/soak/parity data with UTC/checksums; (2) Verify v7 fuzz ≥1000×150 ops, zero v6-envelope accepts; (3) Measure 30/60/120 Hz camera endpoint delta ≤0.02 u, target delta ≤0.001 u, t90 spread ≤35 ms. |
| **G7 — core loop** | every stage loop `30–180 s`; `≥3` actions and `≥1` reward; voluntary repeat/re-entry proxy `≥70%` | designer model freezes S1–S10 targets `60–90, 70–105, 80–120, 85–125, 90–130, 95–135, 100–140, 105–145, 110–155, 120–165 s`; v6 reducer proxy reported `9–12` actions and one reward/stage but cannot score v7; actual v7 browser timing/re-entry `NOT RUN` | **FIX — MODEL ACCEPTED, PLAYTEST NOT RUN** | v7 browser/session timings, decision/action/route/contact/stationary traces, reward closure, and voluntary re-entry evidence `≥70%`. |
| **G8 — striking element** | matching pattern frequency `≤2` of `≥5` comparable titles; QA impression `≥4/5`; direction/expiry comprehension `≥90%` | Undertow Reversal bounded survey frequency `0/6`; designer candidate score `23/30`; QA impression and comprehension `NOT RUN` | **FIX — FREQUENCY SUBCRITERION PASS** | only after base S7/S9 topology and G2 candidate measurement: causal A/B `≤5 pp`, lane share `15–70%`, static camp `≤60%`, save/retry/parity, QA impression and five-second comprehension probes. |

## Exact implementation authorization

1. **Parity/control foundation is PASS-FOR-IMPLEMENTATION, not a gate PASS:** one reducer-external deterministic tactical snapshot shared by Three.js and Canvas; fixed `1/60 s`, `.10 s` delta clamp, six catch-up steps; preserve `4.1/7.2/2.4 u/s`; acceleration/deceleration `28/36 u/s²`; camera `τ=.1304 s`, zoom `18`, clamp `9–30`; cumulative Euclidean drag `6 CSS px` mouse/pen and `12 CSS px` touch, tap `≤500 ms`; at most five visible/four enabled primary controls.
2. **Base topology is PASS-FOR-IMPLEMENTATION:** all ten final stages `24×12`; `40×24` stress-only; exactly three routes, two reconnects, frontage `≥4` cells, nonshared fraction `≥50%`, one distinct affordance/route, longest route `≤1.35×` shortest, lane success `15–70%`, static camp `≤60%`. Use the exact route/anchor/path/wave matrix in `design/trend-survey/solutions.md`.
3. **Rules v7 scope is PASS-FOR-INTEGRATED-IMPLEMENTATION and retained at `[campaign-state.js#05B1]`:** Echo Throne counter `8→6`; aggregate caps cooldown multiplier `≥.60`, possessed bonus `≤4`, counter reduction `≤3`, materialize bonus `≤4`, entry aegis `≤2`. Source reward values remain Rift Lens `+4`, Stillwater Hourglass `20%` + auto-extract, Shadebreaker `−2`, Colossus `−2`; no other reward source-value change is authorized. The rules may land before topology authoring finishes, but they may not be measured/presented/released standalone.
4. **Undertow Reversal is BLOCKED until the completed v7 base topology/counter/cap candidate is measured:** if unblocked, S7 Barge Deck and S9 Rite Bridge only, `6 s`, `30 s` cooldown, maximum one active, no walkability/damage/node-reachability change.
5. **Broad reward source-value retuning is BLOCKED:** PM zero-paid-power bounds carry forward; any value beyond the exact SD-021 scope requires a signed reward-by-reward proposal, new rules version, and post-topology measurement.

## Dependency and exit blockers

`SD-018 parity/control foundation → 24×12 ten-stage topology → graph/reachability/renderer checks → freeze SD-021 v7 Echo/cap scope → durable v7 Q2/Q3 balance/archetype/loop/save evidence → Undertow prototype if still in band → G2/G3/G7/G8 exit review → Stage 3 G6 execution.`

Stage 2 exit remains blocked by integrated v7 Q2/Q3 measurement, current-v7 mechanic coverage, five-archetype viability/rotation, human G7 sessions, QA G8 impression/comprehension, signed approval for any future reward source-value move, and confirmation of zero open S1 defects. Stage 3 gate passage remains blocked by all v7 G6 browser/runtime/save/soak evidence.

## Linked artifacts

- Director authorization: `production/decision-log.md#sd-020-final-stage-2-numeric-adjudication-and-integrated-implementation-order` and `#sd-021-rules-v7-cutover-is-required-and-scope-locked`
- Task/dependency state: `production/task-manifest.md`
- Design numbers: `design/balance-sheet.md`, `design/core-loop.md`, `design/novelty-scorecard.md`, `design/trend-survey/solutions.md`
- QA plans/current non-verdicts: `qa/test-plan.md`, `qa/benchmark-notes.md`, `qa/exploit-register.md`
- Engineering specification: `engineering/architecture-contract.md`, `engineering/movement-optimization.md`, `engineering/perf-budget.md`
