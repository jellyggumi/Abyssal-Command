# Gate Measurements — Stage 2 Phase 2a

run-id: `20260725-defense-rpg-development`  
measurement window: `2026-07-25T23:37:52.890Z`–`2026-07-25T23:40:53.633Z` UTC  
rules/catalog version observed: `defense-survivor-v1`

Statuses are evidence inputs only. The director owns final gate decisions.

## Current evidence index

- deterministic outputs: `qa/evidence/balance-sim-current.json`, `qa/evidence/archetype-*-current.json`, `qa/evidence/g7-engaged-4hz-current.json`
- captured command sessions: `qa/evidence/probe-session-20260725T.json`, `qa/evidence/probe-followup-session-20260725T.json`
- previous-cycle baseline: `_workspace/20260725-wellmade-verification/retrospectives/cycle-1-retrospective.md`

## #g1 — Narrative consistency

- **Measured value:** no new narrative enumeration. Carried baseline: 1 S1 + 3 S3 violations; 111/119 nouns trace (93.3%).
- **Method:** prior reviewed evidence only; Phase 2a ran no narrative command because the assigned slice is defense/offense + RPG.
- **Command/session:** no current command; carried source `_workspace/20260725-wellmade-verification/retrospectives/cycle-1-retrospective.md`.
- **Timestamp:** carried evidence dated 2026-07-25; reviewed 2026-07-25T23:37:52.890Z.
- **Evidence path:** prior retrospective above; current non-measurement scope recorded here.
- **Status: BLOCKED.** Current G1 cannot pass without a rerun on current shipped strings.

## #g2 — Rules and balance

- **Measured value:** five direct archetype rotations (rusher, turtle, economy-greed, micro-optimizer, casual), 3 seeds × 10 stages each: **150/150 clears, 0 defeats**. Mean boss TTK ticks: 562.83, 735.90, 732.67, 637.17, 605.73; five-archetype median 637.17; max ratio **1.155×**, under the 1.3× cap. A separate idle/macro policy measured **9/30 defeats (30.0%)**: `starless-canal` seed 991; `shattered-causeway` seeds 17/991; all seeds for `abyss-chancel` and `gate-zenith`.
- **Method:** deterministic campaign rotation plus the existing focused balance probe. The policy difference prevents using either result as the required 45–55% matchup rate.
- **Commands/session:** `node scripts/run-g2-archetype-rotation.mjs <id> --seeds 301,302,303 --output _workspace/20260725-defense-rpg-development/qa/evidence/archetype-<id>-current.json`; `node scripts/run-defense-balance-sim.mjs --output _workspace/20260725-defense-rpg-development/qa/evidence/balance-sim-current.json`.
- **Timestamp:** 2026-07-25T23:37:52.890Z.
- **Evidence path:** `qa/evidence/archetype-*-current.json`; `qa/evidence/balance-sim-current.json`; `qa/playtest-report.md`.
- **Status: FIX.** The combo cap is in-band for this five-archetype sample, but no shared policy establishes the 45–55% band or a trustworthy TTK target comparison.

## #g3 — Player-type diversity

- **Measured value:** **5 archetypes directly tested** (required ≥5); all 150 campaign stage-runs clear. Observed mean TTK spread is 0.883–1.155× of median; all recorded formation stances are `VANGUARD`.
- **Method:** deterministic archetype-rotation sessions; distinct investment policies, but no controlled action/stance comparison and no loss pressure in those campaigns.
- **Commands/session:** five `node scripts/run-g2-archetype-rotation.mjs <id> --seeds 301,302,303 --output ...` commands listed in `qa/playtest-report.md`.
- **Timestamp:** 2026-07-25T23:37:52.890Z.
- **Evidence path:** `qa/evidence/archetype-*-current.json`; `qa/playtest-report.md`.
- **Status: FIX.** Coverage is met, but independent viability cannot be inferred when every policy clears and no alternate stance is observed; none may be called >50% dominant or independently viable from this evidence.

## #g4 — Effects, animation, and readability

- **Measured value:** corrected independent responsive HUD rerun exits **0** against the restored approved toast anchor. In the portrait physical-inset probe, top safe edge is **11 CSS px** and the observed toast top is **59 CSS px** (`59 >= 11`); the existing test completed its assertion that every rendered edge control is at least **44 CSS px** in both dimensions. The prior `[11]` toast-top receipt is immutable historical evidence of a temporary layout regression, not a valid baseline. Growth delta browser test remains **1/1 pass**. No current immersion median or effect-latency sample exists.
- **Method:** focused Playwright browser probe; this is automated headless evidence, not human scoring.
- **Commands/session:** `node tests/defense-hud-responsive-browser.cjs` (exit 0); `node --test tests/defense-stat-delta-browser.test.mjs` (carried 1/1 pass).
- **Timestamp:** corrected X-03 rerun recorded 2026-07-26T00:01:37Z; superseded temporary-layout rerun recorded 2026-07-25T23:58:28Z; growth-delta receipt 2026-07-25T23:37:52.890Z.
- **Evidence path:** `qa/evidence/x03-portrait-safe-area-correction-20260726T000137Z.json`; immutable historical `qa/evidence/x03-portrait-safe-area-rerun-20260725T235828Z.json`; `qa/evidence/probe-session-20260725T.json`; `qa/playtest-report.md`.
- **Status: FIX.** The current approved-anchor baseline satisfies X-03's automated top-cutout and target-size assertions. This cannot establish human readability, immersion, or effect latency, so G4 remains FIX.

## #g5 — Revenue–balance synergy

- **Measured value:** no monetized path exists in the active intake’s explicit no-commerce boundary.
- **Method:** intake review; no fairness simulation is applicable without paid/free variants.
- **Command/session:** no current command; source `intake/production-brief.md` lines 26–30, reviewed 2026-07-25T23:37:52.890Z.
- **Timestamp:** 2026-07-25T23:37:52.890Z.
- **Evidence path:** `intake/production-brief.md`; carried baseline `_workspace/20260725-wellmade-verification/retrospectives/cycle-1-retrospective.md`.
- **Status: BLOCKED.** Do not substitute the no-commerce design target for a G5 pass.

## #g6 — Operations and performance

- **Measured value:** narrow desktop-headless browser probe passes its own limits at 844×390 / 2056×1082: **73 DOM nodes**, rAF mean **16.665 / 16.667 ms**, input samples **0.2–0.4 ms**, input sequence **0→2**. It does not produce low-tier p95 or long-frame percentage. Carried low-tier baseline remains p95 **24.2 ms**, long frames **8.302%**, with a texture leak.
- **Method:** existing focused browser performance probe; prior low-tier evidence kept separate.
- **Command/session:** `node tests/defense-performance-browser.cjs`.
- **Timestamp:** 2026-07-25T23:37:52.890Z.
- **Evidence path:** `qa/evidence/probe-session-20260725T.json`; prior `_workspace/20260725-wellmade-verification/retrospectives/cycle-1-retrospective.md`.
- **Status: FIX.** Desktop headless responsiveness is not a remeasurement of the required low-tier p95/long-frame/leak conditions.

## #g7 — Core loop

- **Measured value:** engaged 4 Hz receipt: 9 deterministic whole-stage loops; durations **26.90–58.43 s** (median **40.25 s**), **6/9** within 30–180 s; **3–4** distinct deliberate action classes in every sample; **13–14** macro reward events in every sample; `ELITE_EXTRACTED` / `extracted: true` in **9/9**. L1 growth-offer circuit median is **0.02 s**, **0** action classes, **2** macro rewards. Voluntary repeats: **unmeasured**.
- **Method:** real `createDefenseRun`/`advanceDefenseRun`, per-tick events, engaged 4 Hz policy. Accepted action types and macro reward events are recorded by the existing instrumentation.
- **Command/session:** `node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output _workspace/20260725-defense-rpg-development/qa/evidence/g7-engaged-4hz-current.json`.
- **Timestamp:** 2026-07-25T23:39:59.765Z.
- **Evidence path:** `qa/evidence/g7-engaged-4hz-current.json`; `qa/evidence/probe-followup-session-20260725T.json`; `qa/playtest-report.md`.
- **Status: BLOCKED.** The deterministic receipt proves some whole-stage samples meet duration/action/macro-reward limbs, but three are too short and the required voluntary-repeat proxy is not observed. No qualifying-loop claim is made.

## #g8 — Novelty / striking element

- **Measured value:** carried frequency fact: elite capture occurred in 0/11 comparable titles. New deterministic reachability: `ELITE_EXTRACTED` and `extracted: true` in **9/9** G7 engaged traces; extraction contract **25/25** passes. Human impression score: **unmeasured**.
- **Method:** current deterministic event receipt plus focused extraction contract test; frequency remains carried research evidence.
- **Commands/session:** `node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output _workspace/20260725-defense-rpg-development/qa/evidence/g7-engaged-4hz-current.json`; `node --test tests/defense-run-simulation.test.mjs`.
- **Timestamp:** 2026-07-25T23:39:59.765Z.
- **Evidence path:** `qa/evidence/g7-engaged-4hz-current.json`; `qa/evidence/probe-followup-session-20260725T.json`; `_workspace/20260725-wellmade-verification/retrospectives/cycle-1-retrospective.md`.
- **Status: BLOCKED.** Reachability is now measured, but G8 requires a human impression score; frequency evidence alone cannot pass it.

## Follow-up measurement — extraction-route CTA and browser contracts

- **Timestamp:** `2026-07-25T23:56:42.622Z` UTC; evidence `qa/evidence/g7-engaged-followup-20260725T235642Z.json`.
- **Runtime change:** `app.js` now exposes the pre-Bind `EXTRACT_ELITE` route action as `Bind 시작 · <companion>`, disables it only while `objectiveRoute` is active, and restores `정예 추출 · <companion>` after the 120-tick hold. Simulation authority and rejection semantics are unchanged.
- **G7 follow-up:** engaged policy produced **9/9 victories** at 60 Hz (39.27 s median), 10 Hz (39.28 s), and 4 Hz (40.25 s); the 2 Hz stress cadence produced **5/9 victories** (84.18 s). Whole-stage traces contained 3–4 deliberate action classes and 13 macro rewards. The L1 growth-offer circuit remains **0.02 s / 0 action classes** because the measurement policy auto-selects the offer; voluntary repeat remains unmeasured.
- **Browser evidence:** `node tests/defense-survivor-browser.cjs` passes the full lobby→battle journey, `Bind 대기 · Ember Cohort` → `추출 가능 · Ember Cohort`, enabled/`aria-disabled="false"` CTA agreement, and a live Cinder Warden GLB scene graph with 2 mesh descendants. `node tests/defense-hud-responsive-browser.cjs`, `node tests/defense-portrait-viewport-browser.cjs`, and `node tests/defense-public-contract-browser.cjs` pass.
- **Verdict:** **HOLD**. The route is reachable and the whole-stage loop is in-band for the 60/10/4 Hz deterministic traces, but human comprehension/repeat and low-tier performance remain unmeasured; the 2 Hz stress cadence still defeats 4/9 runs.
- **Next action:** QA/balance owner runs one shared adversarial input tape across all five archetypes and a human repeat/comprehension session before promoting G7/G8; retain the browser CTA and asset guards.