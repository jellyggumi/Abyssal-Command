# Stage 2→3 QA test plan

**Run:** `20260718-strategy-control-depth`  
**Status:** DRAFT / FUTURE EXECUTION — no command in this plan was run by this QA lane.  
**Non-goal:** this document does not authorize production-code, test, workflow, cache, or asset changes.

## Objective

Prove that larger tactical maps deliver strategy depth without breaking the single authoritative campaign reducer, renderer/fallback parity, error-free command intent, or measurable responsiveness. Balance evidence and live-runtime evidence are separate: reducer simulation cannot stand in for human timing, pathing, rendering, camera, or input measurements.

## Hard invariants

1. `campaign-state.js` remains the sole authority for accepted/rejected campaign actions, encounter state, rewards, retry, saves, and replay traces.
2. WebGL2, Canvas fallback, keyboard, mouse/pen pointer, and touch may change presentation but must not change the normalized authoritative action or resulting campaign state.
3. Every stage exposes ≥3 mechanically distinct lanes/zones under the definition in `benchmark-notes.md`.
4. Matched wall-clock movement and camera results are frame-rate independent at 30/60/120 Hz.
5. No result receives PASS without rules/build stamp, exact command/session, raw evidence path, threshold, measured value, and defect links.

## Evidence already available

A studio-shared run at `/tmp/abyssal-balance-v6.json` reports rules v6, deterministic rusher 0% at Echo Throne after 20 actions, comeback 0% at Howling Sprawl after 47, greedy economy 100% over 116 actions, optimal 100% over 103, and casual 40% over 200 seeded trials. Casual defeats concentrate at Echo Throne (78), Sunken Bastion (19), and Howling Sprawl (17), with six elsewhere. The same summary reports 150,000 fuzz operations with zero findings and branch fractions 0.6923–0.8537. Treat those numbers as reducer/arithmetic observations only; they do not satisfy any live-runtime or human fairness gate.

## Planned probe surfaces

The commands below are **future command contracts**, not current repository commands. Before execution, a later implementation task must create a dedicated runner without weakening existing tests or changing the campaign reducer:

- `node scripts/run-stage2-qa.mjs --scenario <id> --rules abyssal-surge-rules-v6 --out <json>` for deterministic campaign/archetype probes.
- `node scripts/run-runtime-qa.mjs --scenario <id> --renderer <webgl2|canvas> --input <pointer|keyboard|touch> --fps <30|60|120> --out <json>` for isolated, fake-clock runtime probes.
- `node tests/playtest-browser-3stage.cjs --qa-probe <id> --trace <json>` only after an explicit future browser-harness extension is reviewed; current script was inspected and must not be assumed to support this flag.

Every runner must exit non-zero on gate failure and emit the raw samples as well as aggregates.

## Scenario inventory and exact acceptance

### QA-MAP-001 — lane camping / Anchor Sentinel

- **Exact setup:** rules v6; each of ten stages; load the proposed map graph; enumerate its three declared lanes; place the maximum legal legion in the smallest camp footprint intersecting the most standardized portal→objective shortest paths; issue no reposition command after wave 1; run 200 paired seeds against the same waves used for a rotating three-lane defense.
- **Observable result:** lane IDs and route used per enemy; percentage of traffic intercepted without reposition; stage result; integrity; wave and boss TTK; stationary time.
- **Severity:** S2 if a static footprint intercepts >60% of traffic or wins >55%; S1 if enemies deadlock and campaign completion becomes impossible.
- **Gate:** ≥3 distinct lanes; no one camp covers >60%; each lane ≥15% successful route share; Sentinel win rate 45–55%; no route stall >500 ms.
- **Future command/probe:** `node scripts/run-stage2-qa.mjs --scenario QA-MAP-001 --seeds 200 --stages all --out evidence/QA-MAP-001.json`.

### QA-CTL-002 — click-spam / Micro Dispatcher

- **Exact setup:** stage 3 and stage 10; one legal and one cooldown-blocked action target; WebGL2 and Canvas; enqueue 100 pointer-up attempts in 10 s (10 Hz), 30 mapped keyboard attempts in 10 s, and ten same-frame pointer+keyboard pairs; preserve event IDs and reducer trace IDs.
- **Observable result:** normalized intents, accepted/rejected reducer transitions, trace growth, visible/audio acknowledgement, duplicate effects, event→feedback latency.
- **Severity:** S1 for duplicate authoritative transitions/state corruption; S2 for false/missing success feedback or p95 >100 ms.
- **Gate:** exactly one transition per accepted event ID; zero transition for rejected IDs; identical final state/trace across renderers and input surfaces; p95 ≤100 ms, max ≤200 ms.
- **Future command/probe:** `node scripts/run-runtime-qa.mjs --scenario QA-CTL-002 --renderer all --input all --samples 500 --out evidence/QA-CTL-002.json`.

### QA-CTL-003 — drag/click ambiguity

- **Exact setup:** 1280×720 and 390×844 viewports at DPR 1 and 3; mouse, pen, and touch; pointerdown at canvas center followed by offsets `(0,0)`, `(2,1)`, `(3,1)`, `(4,0)`, `(6,0)`, `(7,0)`, and normalized 0.5%, 1%, 2% of the shorter viewport dimension; replay in WebGL2 and Canvas; repeat with one `pointercancel` before release.
- **Observable result:** classification (`click/action`, `move`, `box-select`, `orbit`, `cancel`), selected unit IDs, requested action, camera delta, pointer-capture release.
- **Severity:** S2 for authoritative action divergence or cancelled gesture committing; S3 for presentation-only camera/selection mismatch.
- **Gate:** identical normalized intent across renderers for each input sequence; cancelled sequence produces no command; a classified drag produces no click action; zero stuck capture. Threshold may be renderer-specific internally but semantic classification may not diverge.
- **Future command/probe:** `node scripts/run-runtime-qa.mjs --scenario QA-CTL-003 --renderer all --input pointer,touch --out evidence/QA-CTL-003.json`.

### QA-PATH-004 — stuck pathing and dynamic blockers

- **Exact setup:** every stage; each declared lane; stratify ≥1,000 legal origin→destination cell pairs per stage; test no blocker, one static blocker, one crossing ally, and a three-unit choke; execute at 30/60/120 Hz using commander 4.1, surge 7.2, and enemy 2.4 world units/s; separately command every unwalkable cell.
- **Observable result:** route cells, position per frame, progress timestamp, completion time, collision contacts, unwalkable entries, order cancellation/replan reason.
- **Severity:** S1 for out-of-bounds/chasm entry or unrecoverable campaign block; S2 for legal-route completion <99% or stall >500 ms.
- **Gate:** ≥99% legal completion; 0 unwalkable/collider penetration; no unexplained progress stall >500 ms; duration ≤1.25× ideal time +250 ms; illegal targets preserve last legal order/state.
- **Future command/probe:** `node scripts/run-runtime-qa.mjs --scenario QA-PATH-004 --stages all --pairs 1000 --fps 30,60,120 --out evidence/QA-PATH-004.json`.

### QA-CTL-005 — held-key focus loss

- **Exact setup:** focus WebGL2 canvas; hold `W+Shift`; after 500 ms trigger, separately, canvas `blur`, window `blur`, `document.hidden=true`, and app switch; in another case hold touch pointer then issue `pointercancel`; restore after 2 s without keyup/pointerup; preserve an active click-to-move order in half the cases.
- **Observable result:** pressed-key set, commander displacement after loss, surge state, pointer state/capture, click-order identity, commands after restore.
- **Severity:** S2 for continued movement/surge or phantom action; S3 if a valid click-to-move order is incorrectly cancelled.
- **Gate:** held set clears in the same task; no displacement after the loss boundary; no resumed movement until a new input; pointer cancel commits nothing; click-to-move order is preserved where specified. Existing unit coverage for keyboard was inspected but not run.
- **Future command/probe:** `node scripts/run-runtime-qa.mjs --scenario QA-CTL-005 --renderer webgl2 --input keyboard,touch --out evidence/QA-CTL-005.json`.

### QA-TIME-006 — extreme delta-time and refresh-rate equivalence

- **Exact setup:** identical stage 3 snapshot and target; simulate 2.0 s of wall time with frame steps 4.167, 8.333, 16.667, 33.333, and 50 ms; inject single raw gaps of 250 ms and 2,000 ms through the public frame boundary after hide/resume; repeat normal and Shift movement, enemy advance, particles, cooldown, and camera step target.
- **Observable result:** final positions, collision crossings, cooldowns, particle counts, camera residual at 100/250/500/1,000 ms, number of updates, clamped delta.
- **Severity:** S1 for state corruption/tunneling into void; S2 for frame-rate-dependent movement/path result or camera gate failure.
- **Gate:** movement positions differ ≤0.05 world units at matched time; same collision/path outcome; resume frame consumes ≤0.05 s simulated delta; camera residual ≤5% by 500 ms and differs ≤2 pp across 30/60/120 Hz. Current fixed `lerp(...,0.12)` is an inspection risk expected to miss equivalence, not a run result.
- **Future command/probe:** `node scripts/run-runtime-qa.mjs --scenario QA-TIME-006 --fps 30,60,120,240 --gaps 250,2000 --out evidence/QA-TIME-006.json`.

### QA-RULE-007 — cooldown stacking / multi-surface race

- **Exact setup:** for each command (`hunt`, `extract`, `materialize`, `capture`, `assault`, plus stage-specific `possess`/`domain` where available), place state exactly legal with cooldown 0; dispatch pointer, keyboard, and touch intents sharing one logical action ID in the same microtask; repeat at cooldown boundary `-1 ms`, exact, and `+1 ms`; 1,000 sequences/command.
- **Observable result:** accepted count, rejection reason, cooldown value, resource deltas, encounter events, trace IDs, visual/audio cues.
- **Severity:** S1 for multiple accepted transitions, negative cooldown/resource, or trace corruption; S2 for feedback disagreeing with reducer result.
- **Gate:** exactly one accepted transition at legal boundary; every duplicate rejected without mutation; cooldown never negative/non-finite; final state identical across surface order permutations.
- **Future command/probe:** `node scripts/run-stage2-qa.mjs --scenario QA-RULE-007 --sequences 1000 --commands all --out evidence/QA-RULE-007.json`.

### QA-BAL-008 — thin-legion rush / Tempo Raider

- **Exact setup:** rules v6; all ten stages; paired 200-seed trials using (a) first legally reachable assault with the minimum legion and (b) capacity-building control; same reward choice and encounter RNG per pair. Retain the observed v6 deterministic rusher baseline (0%, Echo Throne defeat, 20 actions) as a separate one-path datum.
- **Observable result:** win/loss, defeat stage, legion at assault, actions, integrity, wave/boss TTK, resource remainder.
- **Severity:** S2 if rush is dominant (>55%) or non-viable (<45%) after challenge calibration; S3 if only one stage misses while campaign remains viable.
- **Gate:** 45–55% win rate, 95% Wilson interval intersects band, max strategy gap ≤10 pp, TTK within ±15% of target. The current single deterministic 0% result is insufficient to score the gate.
- **Future command/probe:** `node scripts/run-stage2-qa.mjs --scenario QA-BAL-008 --seeds 200 --paired --stages all --out evidence/QA-BAL-008.json`.

### QA-BAL-009 — reward snowball / Veil Economist

- **Exact setup:** 200 paired ten-stage campaigns; same seed/actions except reward policy: highest projected campaign EV versus median-EV legal reward; add deterministic greedy-economy (observed 100%/116 actions) and optimal (observed 100%/103) as reference paths; record benefits before and after every reward.
- **Observable result:** per-stage benefits, integrity, legion/economy, actions, TTK, win, defeat stage, completion/action EV, reward-pair outcome.
- **Severity:** S2 for runaway dominant reward/strategy; S1 for benefit duplication, non-exclusive rewards, save/retry compounding exploit, or non-finite state.
- **Gate:** win-rate gap ≤10 pp; no reward pair >1.3× median completion/action EV; TTK remains ±15%; reward choice applies exactly once and survives save/retry without duplicate gain.
- **Future command/probe:** `node scripts/run-stage2-qa.mjs --scenario QA-BAL-009 --seeds 200 --paired --campaigns 200 --out evidence/QA-BAL-009.json`.

### QA-PAR-010 — offline / Canvas fallback parity

- **Exact setup:** block network after cached shell, deny WebGL2 context, and load all ten stages into Canvas fallback; run a canonical legal action/reward sequence and a matched sequence with rejected cooldown actions; then trigger WebGL context loss mid-stage and continue via fallback; compare with WebGL2 source run.
- **Observable result:** normalized intents, campaign state/trace hash after every action, fallback status, asset/network errors, visible feedback, latency, frame time, save envelope.
- **Severity:** S1 for authoritative state/save divergence or lost campaign access; S2 for unavailable action/control; S3 for presentation-only degradation outside budget.
- **Gate:** byte-equivalent canonical campaign snapshot/trace after each action; same accept/reject and feedback semantics; p95 feedback ≤100 ms; Canvas p95 frame ≤16.7 ms; no uncaught rejection.
- **Future command/probe:** `node tests/playtest-browser-3stage.cjs --qa-probe QA-PAR-010 --renderer-parity --offline --trace evidence/QA-PAR-010.json` after the future probe flag exists.

### QA-MOB-011 — mobile touch, cancellation, and orientation

- **Exact setup:** Chromium mobile emulation 390×844, DPR 3, coarse pointer; WebGL2 and Canvas; single tap on every command, 20 px drag, two-finger contact, `pointercancel`, scroll-start cancellation, and orientation change while pointer is captured; repeat at 320×568 and 768×1024.
- **Observable result:** target reachability, normalized intent, selected IDs, action result, viewport overflow, capture state, camera movement, duplicate click synthesis, visible feedback latency.
- **Severity:** S2 for unreachable command, duplicate/phantom action, or pointer/keyboard divergence; S3 for clipped non-critical presentation.
- **Gate:** all authoritative actions reachable with one touch; 0 duplicate synthesized click; cancel/orientation commits no action; identical action/state trace to pointer/keyboard; p95 feedback ≤100 ms; touch target minimum 44×44 CSS px.
- **Future command/probe:** `node tests/playtest-browser-3stage.cjs --qa-probe QA-MOB-011 --mobile --trace evidence/QA-MOB-011.json` after the future probe flag exists.

### QA-SOAK-012 — long-session stability / Field Survivor

- **Exact setup:** 5-minute warm-up then 60 minutes active play on stage 10’s largest proposed map; 20 stage restarts, 20 hide/resume cycles, 10 renderer loss/fallback cycles where supported, 100,000 mixed pointer/key/touch events, sustained maximum legal unit count, and particle bursts above 360 requested particles; run WebGL2 desktop, WebGL2 mobile, and Canvas fallback.
- **Observable result:** heap/JS listener/mixer/geometry/material/audio-node counts every 5 minutes; active RAFs; particle live count; p50/p95/p99/max frame time and input latency; campaign state hash; uncaught errors.
- **Severity:** S1 for state corruption/data loss; S2 for unbounded growth, duplicate loops/listeners, p95 failure, or control loss; S3 for bounded recoverable degradation.
- **Gate:** one active RAF; no duplicate input listeners; particle capacity ≤360; post-GC heap and retained runtime-object count grow ≤10% from minute 5 to 60; p95 degradation ≤10%; no >100 ms input-adjacent frame; zero uncaught errors.
- **Future command/probe:** `node scripts/run-runtime-qa.mjs --scenario QA-SOAK-012 --minutes 60 --renderer all --input all --out evidence/QA-SOAK-012.json`.

## Sampling and statistics

- **Balance:** ≥200 deterministic paired seeds per policy/challenge. Report raw wins, point estimate, and Wilson 95% interval. A deterministic single policy line is a regression fixture, not a fairness sample.
- **Latency:** ≥500 commands per renderer/input/device profile; report p50/p95/max and missing/false acknowledgement count.
- **Pathing:** ≥1,000 stratified legal cell pairs per stage and every declared lane; report failures individually, not only a percentage.
- **Camera/movement:** ≥30 repeats per refresh rate with the same wall-clock schedule and target vectors.
- **Frame time:** 5-minute warm-up, 10-minute active capture, plus the 60-minute soak; frame budget is evaluated per device profile.
- **TTK:** start at first targetable frame and stop at authoritative defeat event; report median and p90 separately for standard waves and bosses.

## Required evidence schema

Each JSON result must contain:

```text
scenarioId, build, rulesVersion, commit, UTC, renderer, input, device,
viewport, DPR, refreshRate, stageId, seed, setupHash, threshold,
rawSamples, measuredValue, verdict, stateTraceHash, evidenceFiles, defectIds
```

A missing field, missing raw evidence, or unimplemented probe is `NOT RUN`, never PASS.

## Exit criteria for Stage 3 readiness

- All 12 scenarios have executable probes and raw evidence.
- Zero open S1; all S2 findings have either a verified fix or director waiver with expiry.
- Win rate, TTK, path completion, camera convergence, input feedback, and frame-time bands pass exactly as defined in `benchmark-notes.md`.
- Every stage has a measured three-lane/zone score and all renderer/input cells in `regression-matrix.md` are covered.
- Authoritative trace parity is exact across pointer/keyboard/touch and WebGL2/Canvas for the canonical action corpus.