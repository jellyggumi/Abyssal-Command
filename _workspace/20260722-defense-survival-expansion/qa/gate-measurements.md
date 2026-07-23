# Gate measurements

Audit timestamp: 2026-07-22T09:14:28Z

Global disposition: **Stage 1 FIX / BLOCKED.** Open/deferred S1 defects QA-D001, QA-D002, QA-D006, and QA-D010 block every G1–G8 PASS under the studio contract. The latest stable-source evidence is 14/23 targeted tests, 11/50 wins, and 8/50 nonterminal runs; older receipts are historical only.

## G1 — worldview consistency

- **Measured value:** 136/136 catalog names/events have W-01…W-05 trace IDs and zero live lore/continuity violations in those six groups. Four presentation/integration gaps remain, and app-only player-visible strings are sampled rather than exhaustively traced.
- **Method:** catalog inventory and player-visible trace audit against `design/worldview.md`; cinematic reachability cross-check against the current deterministic run.
- **Timestamp:** 2026-07-22.
- **Evidence:** `qa/lore-audit.md`; `design/worldview.md`; `messages/20260722-lore-audit-broadcast.md`; current-head run regression in `qa/defect-register.md#qa-d001`.
- **Verdict input:** **FIX** — the zero-violation catalog limb passes, but the threshold also requires a complete shipped-content trace; the sampled full-app boundary is not a PASS.

## G2 — rules and balance

- **Measured value:** 14/23 targeted simulation/campaign tests pass and 9 fail; latest stable-source five-archetype probe is 11/50 victories (22% overall: Gatekeeper 0%, Hunter 40%, Collector 40%, Skirmisher 0%, Generalist 30%) with 8 nonterminal Skirmisher runs at 18,000 ticks. Boss TTK ±15% and combo EV ≤1.30× median are unmeasured. The strict smoke can report `pass:true` outside these bands.
- **Method:** `node --test tests/defense-run-simulation.test.mjs tests/defense-campaign-adapter.test.mjs`; `node scripts/run-defense-balance-sim.mjs --strict`; persistent-JS 5 archetypes × 10 stages at seed 17 with an 18,000-tick cap.
- **Timestamp:** 2026-07-22T09:14:28Z.
- **Evidence:** current command receipts; `qa/defect-register.md#qa-d001`; `qa/defect-register.md#qa-d002`; `qa/defect-register.md#qa-d010`; `results/defense-balance-dd49f9e.json` is reference-only pre-integration evidence.
- **Verdict input:** **FIX / BLOCKED** — 0/5 archetypes are in the 45–55% band, 8/50 runs do not terminate within 300s, and TTK/combo bounds have no current evidence.

## G3 — archetype diversity

- **Measured value:** 5/5 archetypes executed, but 0/5 are viable in the 45–55% band and Skirmisher lacks a valid terminal denominator. Win rates and mean ticks: Gatekeeper 0/10, 1329.4; Hunter 4/10, 2504.2; Collector 4/10, 3399.9; Skirmisher 0/10 with 8 unresolved, 15291.1; Generalist 3/10, 2277.9.
- **Method:** deterministic ten-stage rotation per archetype at seed 17 with distinct offer/movement policies and an 18,000-tick cap.
- **Timestamp:** 2026-07-22T09:14Z.
- **Evidence:** current-head probe summarized in `qa/exploit-register.md`; `qa/defect-register.md#qa-d002`; `qa/defect-register.md#qa-d010`.
- **Verdict input:** **FIX / BLOCKED** — the gate requires at least three independently viable archetypes in band and terminal runs.

## G4 — immersion and feedback

- **Measured value:** 1/5 required presentation scenes has current automated browser reachability (stage intro). At 2026-07-22T09:11Z the overlay rendered, dismissed, preserved keyboard/touch input, and admitted a real `ward-binder` growth choice with no page/console errors. Extraction/item-growth/victory scene coverage is still incomplete; immersion panel is 0/5 people and no median exists. Current short input samples are ≤0.5ms.
- **Method:** `node tests/defense-survivor-browser.cjs`; `node tests/defense-performance-browser.cjs`; scene reachability audit against failed simulation paths; required five-person scoring panel not run.
- **Timestamp:** 2026-07-22T09:11Z.
- **Evidence:** browser command receipts; `tests/defense-survivor-browser.cjs`; `engineering/perf-budget.md`; `design/presentation-spec.md`; `qa/defect-register.md#qa-d001`.
- **Verdict input:** **FIX / BLOCKED** — no human immersion median and only one scene has live-path evidence.

## G5 — no-commerce fairness

- **Measured value:** commerce, paid power, paid rerolls, and accounts are absent; structural paid/free delta is 0 percentage points by construction. Comeback reversal paths are not classified/measured, and parity evidence is 0 sessions versus the required 10–20.
- **Method:** signed reward-band and negotiation-record audit plus stable-source simulation outcome review.
- **Timestamp:** 2026-07-22T09:14Z.
- **Evidence:** `pm/reward-bands.md`; `pm/negotiation-record.md`; `qa/defect-register.md#qa-d002`.
- **Verdict input:** **FIX / BLOCKED** — no-commerce compliance is established, but comeback/parity numeric evidence is absent and the rotation has only 22% wins plus eight nonterminal runs.

## G6 — performance and operational stability

- **Measured value:** current short headless samples at 844×390 and 2056×1082 report mean rAF 17.7767ms and 16.6667ms, respectively, 33 DOM nodes, and maximum input feedback 0.5ms; the smoke command passes its own `<100ms` mean limit. The 844×390 sample includes 66.7ms and 33.3ms startup intervals, so it is not evidence for contractual p95 ≤16.7ms or long frames <0.5%. Presentation/renderer contracts and asset/release closure pass; schema-v1 bounded offline telemetry exists. No 1,800,000ms target-device soak exists, and deterministic rules are 14/23 pass.
- **Method:** `node tests/defense-performance-browser.cjs`; `node --test tests/defense-cutscene.test.mjs tests/defense-renderer-contract.test.mjs`; `node --test tests/defense-asset-manifest.test.mjs tests/no-rts-closure.test.mjs tests/release-closure.test.mjs`; telemetry artifact audit.
- **Timestamp:** 2026-07-22T09:11Z.
- **Evidence:** command receipts; `engineering/perf-budget.md`; `engineering/defense-telemetry-sample.json`; `ops/telemetry-contract.md`; `qa/regression-matrix.md`.
- **Verdict input:** **FIX / BLOCKED** — input/DOM smoke is healthy, but current short-frame output does not prove the release p95/long-frame limits and the exact 30-minute heap/frame soak is absent.

## G7 — core loop

- **Measured value:** authored model is 30–180s with 5 action classes and ≥1 reward. Stable-source archetype means span 1329.4–15291.1 ticks (22.2–254.9s); 11/50 runs win, 8/50 remain nonterminal at 300s, 17 extractions complete, 17 reach a boss, 26 items are collected, and 56 skills are learned. Skirmisher violates the 180s ceiling; terminal reward receipt and voluntary repeat rate remain unmeasured.
- **Method:** model audit plus deterministic archetype event-log review, 18,000-tick terminal cap, and adversarial spatial probe.
- **Timestamp:** 2026-07-22T09:14Z.
- **Evidence:** `design/core-loop.md`; `qa/exploit-register.md#qa-x004`; `qa/defect-register.md#qa-d010`.
- **Verdict input:** **FIX / BLOCKED** — 8/50 runs fail to terminate by 300s, observed duration breaches 180s, and reward/repeat thresholds are unmeasured.

## G8 — novelty

- **Measured value:** 5 named comparable profiles completed; bounded extraction frequency is 0/5, satisfying the ≤2/5 frequency limb. Stable-source runtime reaches 17 extractions and 11 complete objectives in 50 automated runs, but eight runs stall and the full intended hook sequence is not gate-valid. Human impression sample is 0/5, so no median ≥4/5 exists.
- **Method:** official-store/developer comparison survey, hook-frequency scorecard, runtime spatial-sequence probe, and required five-person scoring panel not run.
- **Timestamp:** 2026-07-22T09:14Z.
- **Evidence:** `qa/benchmark-survey/comparison-survey.md`; `design/novelty-scorecard.md`; `qa/exploit-register.md#qa-x004`.
- **Verdict input:** **FIX / BLOCKED** — comparable frequency is measured, but current hook reachability is impaired by terminal stalls and the human impression median is missing.