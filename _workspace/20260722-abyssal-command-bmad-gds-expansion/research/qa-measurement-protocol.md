# QA and measurement protocol — feedback, controls, choices, and offline idle

## Research question and scope

**Question.** What observable contracts, local-only instrumentation, and repeatable experiments can validate health/critical-hit feedback, movement-first control response, growth/reward-choice visibility, and survivable offline idle progression in a deterministic mobile action loop?

This is a **testability packet, not feature design**. It does not report present-build measurements, define implementation values, or declare any gate passed. Every proposed threshold is marked **target**; externally published values are separately marked **source-derived**. Recommendations preserve the existing contract: deterministic 60 Hz rules, snapshot-only observers/rendering, offline local persistence, automatic baseline combat, movement-first input, reduced-motion support, and no accounts, network, or commerce.

### Authoritative gate alignment

The harness quality-gate contract is authoritative. This packet contributes evidence surfaces; it does not redefine gates.

| Gate | This packet's contribution | Authoritative pass evidence (future) |
|---|---|---|
| **G2** | Deterministic health, critical, cooldown, and combo truthfulness are balance inputs. | Matchup/TTK/combo-EV evidence under the harness's 45–55%, ±15%, and ≤1.30× constraints. |
| **G4** | Feedback, movement control, and accessibility captures are immersion/readability inputs. | Structured immersion/readability scoring and ≤100 ms feedback-latency probes with no unresolved S1/S2 issue. |
| **G5** | Reward-choice and idle transaction checks protect no-commerce fairness. | PM reward-band/negotiation audit plus fairness and finite-progress evidence. |
| **G6** | Input/frame/tick/telemetry traces are operations evidence. | Implemented telemetry, rollback exercise, release checklist, p95 frame ≤16.7 ms, long frames <0.5%, 30-minute memory soak, and input ≤100 ms. |
| **G7** | Reward choice, objective movement, and repeat study are core-loop evidence. | 30–180-second loop, ≥3 actions, ≥1 reward event, and ≥70% voluntary re-entry. |
| **G8** | PCG comparison and impression work support novelty only. | ≤2-of-5 comparable frequency plus ≥4/5 QA impression score. |

## Evidence ledger

| ID | Source and provenance | Exact factual support | QA consequence |
|---|---|---|---|
| S1 | [W3C WCAG 2.2 — Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) — **direct page retrieval; primary standards source** | SC 2.3.3 says interaction-triggered motion animation can be disabled unless essential. W3C identifies distraction, dizziness, headache, and nausea risk, and lists `prefers-reduced-motion` techniques. | Reduced-motion must remove non-essential shake/flash/ornamental interpolation without removing a static/textual health, crit, hazard, or choice signal. |
| S2 | [W3C WCAG 2.2 — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) — **direct page retrieval; primary standards source** | SC 2.5.8 requires a pointer target of at least **24 × 24 CSS pixels** or sufficient spacing; its intent is to reduce accidental activation for people with dexterity/fine-motor limits and on touchscreens. | Geometry audit must measure actual logical hit areas, not artwork bounds, for every pause/settings/reward-choice control. |
| S3 | [web.dev — Interaction to Next Paint](https://web.dev/articles/inp) — **direct page retrieval; official Chrome/web guidance** | INP spans input delay, handler processing, and the next presented frame. Its good threshold is 75th-percentile field INP **≤200 ms**, segmented by mobile/desktop; lab runs depend on scripted interactions. | Use the same three-part timing model for movement input and choice commit. The 200 ms figure is a source-derived web benchmark, not a game-frame requirement; slice targets below are explicitly local targets. |
| S4 | [MDN — PerformanceLongTaskTiming](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming) — **direct page retrieval; primary platform documentation** | A long task occupies the UI thread for **50 ms or more** and can create high/variable input and event-handling latency or janky animation. It is experimental. | Where supported, record long-task count/duration as diagnostic evidence only; retain engine-owned frame/tick timing because this browser API is not a cross-browser pass gate. |
| S5 | [Glenn Fiedler — Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/) — **direct page retrieval; author technical reference** | A fixed `1/60` step is shown; variable delta can make behavior frame-rate dependent. Fixed stepping plus a renderer accumulator decouples simulation and render rate; insufficient headroom risks a “spiral of death.” | Replay hashes must be computed from simulation state at tick boundaries, never renderer timing. Stress traces must record tick backlog/clamping rather than silently accepting dropped/extra simulation. |
| S6 | [Game Accessibility Guidelines — full list](https://gameaccessibilityguidelines.com/full-list/) — **direct page retrieval; specialist game-accessibility guidance** | The list calls for large/well-spaced virtual controls, adjustable control sensitivity, stationary accuracy-required controls, no essential information by fixed color alone, alternatives to background movement, and distinct sound/event cues. | Exercise touch, keyboard, and reduced-motion variants; inspect health/crit/choice states with color, motion, audio, and text independently disabled where applicable. |
| S7 | [MDN — `Window.localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) — **direct page retrieval; primary platform documentation** | `localStorage` is origin-scoped and survives browser sessions, but persistence can be blocked by user policy; private browsing clears it when the last private tab closes. | Idle tests must include a storage-denied path and clearly report unavailable persistence; never fabricate an idle award if the authoritative local record cannot be read/validated. |
| S8 | [Nielsen Norman Group — Recognition Rather Than Recall](https://www.nngroup.com/articles/recognition-and-recall/) — **indexed snippet; established UX practitioner source; URL should be direct-retrieved before normative use** | The heuristic says to minimize memory load by making elements, actions, and options visible; comparison tables let users compare options side-by-side. | Choice telemetry must distinguish *shown* from *meaningfully comparable*; observe time, focus/inspection, selection, and effect verification rather than merely counting clicks. |

## Repeated patterns, constraints, and risks

### Repeated patterns

1. **Make the feedback state independently observable.** Motion, color, sound, and numerical/textual representation are complementary; no one channel should be the only witness for a health threshold, critical event, imminent danger, or choice effect (S1, S6).
2. **Measure the full input path, not only handler time.** A player perceives tap/press through the next visual response. Decompose it into capture, accepted simulation tick, and snapshot presentation (S3).
3. **Freeze rules at tick boundaries and let rendering only observe.** A fixed-tick replay can establish behavioral sameness across rendering cadence; a smooth render result cannot establish rule determinism (S5).
4. **Test persistence adversarially.** Browser local persistence can be unavailable or cleared; the correctness question is whether the slice preserves/declines an award honestly, not whether a happy-path demo displays a number (S7).
5. **Choice comprehension is not click-through.** Visibility needs side-by-side facts, a non-expiring decision period for the slice, and verification that the selected effect—not a neighboring option—was committed (S8, S6).

### Contradictions and risks

- **Fixed 60 Hz versus browser stalls.** Fixed rules protect reproducibility, not responsiveness. Catch-up can create backlog/spiral risk (S5); cap and explicitly report backlog policy rather than turning render delta into simulation delta.
- **INP is informative, not sufficient.** It omits scrolling and is a web-page metric; Canvas presentation and deterministic tick receipt must have engine-specific timestamps (S3). Its 200 ms source threshold must not be presented as an achieved game metric.
- **Long Tasks are incomplete and experimental.** Do not make them a blocking mobile gate; use a frame/tick log on every supported browser (S4).
- **`localStorage` is not a durable entitlement service.** Origin changes, private sessions, user policy, manual clearing, and corrupt JSON can invalidate it (S7). G5 needs integrity and recovery behavior, not a promise that all devices persist forever.
- **Accessibility motion controls can hide a signal accidentally.** A reduced-motion toggle must alter presentation only; if it changes crit chance, health arithmetic, choice generation, idle award, or replay hash, that is a determinism defect (S1, S5).

## Observability model and local-only instrumentation

Instrumentation is **append-only in-memory/session diagnostics plus optional user-exported JSON**. It must not change simulation state, seed advancement, choice generation, offline award, or rendering output. It must contain no account identifier, network transmission, or personal data. `run_id` is a random local diagnostic session identifier, not an account.

### Event envelope

Every event should include: `schema_version`, `run_id`, `seq` (monotonic), `sim_tick` (or `null` before admission), `monotonic_ms`, `snapshot_revision` (when relevant), `build_id`, `seed_id`/seed hash (not raw secrets), `input_mode`, `reduced_motion`, and `storage_mode`. Events emitted from the deterministic core must be serializable in stable key order. Rendering diagnostics are explicitly tagged `observer: true`.

| Event | Minimum fields | Purpose / failure signature |
|---|---|---|
| `input_captured` | `input_id`, `kind` (touch/key/pointer), logical `x,y` or vector, `captured_ms` | Count actual input arrival; detects missing/coalesced input. Do not log raw high-frequency path beyond a bounded sampled trace. |
| `input_admitted` | `input_id`, `sim_tick`, normalized movement vector, `reject_reason?` | Proves movement reaches the next eligible deterministic tick; mismatch/missing ID detects control loss. |
| `snapshot_presented` | `snapshot_revision`, `sim_tick`, `presented_ms`, `renderer_id` | Closes input-to-visible-feedback timing without granting renderer authority. |
| `health_changed` | `entity_ref`, `before`, `after`, `delta`, `cause`, `sim_tick` | Supports conservation assertions and health-threshold readability scripts. |
| `damage_resolved` | `event_id`, `source_ref`, `target_ref`, `base_damage`, `crit_flag`, `multiplier`, `final_damage`, `rng_draw_index` | Lets a replay prove a crit label matches the resolved rule, not only VFX. |
| `feedback_observed` | `event_id`, `channels` (`text`,`shape`,`color`,`sound`,`motion`), `snapshot_revision`, `reduced_motion` | Snapshot-test contract that required static channels appear when motion is reduced. |
| `choice_offered` | `offer_id`, ordered option IDs, visible stat/effect summaries, `sim_tick`, `presented_ms` | Establishes what was comparable; stable order matters for replay. |
| `choice_inspected` | `offer_id`, `option_id`, `inspection_kind` | Optional local UX trace; distinguishes exposure from inspection. |
| `choice_committed` | `offer_id`, `option_id`, `input_id`, `sim_tick`, `before_effect_state_hash`, `after_effect_state_hash` | Proves one valid option was selected once and effect state changed only as specified. |
| `save_written` / `save_read` | `save_version`, checksum, persistent/run partition summary, result/error | Audits persistence while never persisting run-only offer/skill state beyond its contract. |
| `idle_accrual_calculated` | trusted local timestamps, elapsed basis, cap/rule version, resource delta, checksum | Enables exact recomputation under controlled clock fixtures. |
| `idle_claim_committed` | `claim_id`, before/after persistent totals, idempotency key, result | Detects double claim, loss, and award into wrong state partition. |
| `replay_checkpoint` | `sim_tick`, canonical state hash, PRNG position, input cursor | First divergence localization across render cadence/device scenarios. |
| `frame_sample` | render interval, `sim_steps`, backlog, update/render durations, long-task summary if available | Captures performance pressure without redefining simulation time. |
| `accessibility_mode_changed` | `reduced_motion`, haptics, contrast/size mode, source (system/app) | Segments QA results; any associated state-hash change is a defect. |

## Practical measurement table

All numeric entries labeled **target** are proposed acceptance values for the future Cinder Span slice. They are not measurements of the present build. “Source-derived” values retain their source label.

| Gate / system | Observable and formula | Fixture / evidence | Threshold | Fails when |
|---|---|---|---|---|
| G2 health state | `health_changed.after = before + Σ resolved deltas`, bounded by the defined min/max; threshold transition snapshot carries text/shape plus non-color cue | Fixed-seed damage script at full/threshold/zero health; normal and reduced-motion snapshots | **Target:** 100% event-to-snapshot mapping in the scripted corpus; 0 arithmetic invariant violations | UI bar changes but state does not; final damage cannot be reconciled; health is only signaled by color/motion. |
| G2 critical-hit truthfulness | `crit_flag ⇒ final_damage = rule(base_damage, multiplier)` and `¬crit_flag ⇒ final_damage = noncrit rule`; feedback ID equals resolution event ID | Seeded forced-crit and forced-noncrit traces; replay hash | **Target:** 100% rule/label agreement in all scripted traces; 0 duplicate/misattributed feedback IDs | Crit VFX/text fires on non-crit, crit damage resolves without feedback, or reduced motion changes damage/rule hash. |
| G4 feedback discrimination | Correct identification / presented events in moderated task; record confidence separately | Counterbalanced static screenshot/short capture tasks; no live claims until participants exist | **Target:** define success criterion before recruitment; do not infer it from internal QA | A test treats exposure or click as comprehension; signal is hidden behind animation/sound. |
| G4 movement admission | `tick_admitted − tick_captured`; `presented_ms − captured_ms`; report p50/p95 by device and input mode | Scripted touch/keyboard movement pulses at idle, combat peak, choice overlay, reduced motion | **Target:** p95 admission ≤2 simulation ticks (≤33.4 ms at 60 Hz); **Target:** p95 input-to-presented feedback ≤100 ms in slice lab runs | Input accepted on different tick under identical replay, input is blocked by non-modal display, or p95 is omitted/merged across devices. |
| G4 target geometry | Logical hitbox width/height and neighbor clearance, independently of texture | Automated layout geometry dump at smallest supported viewport / rotated logical landscape | **Source-derived minimum:** ≥24×24 CSS px or WCAG spacing exception (S2). **Target:** all essential slice controls meet the direct 24×24 target; no reliance on exception. | Visible control is large but logical hit region is small; reward cards overlap; accessibility scale breaks spacing. |
| G6 operations performance | Input-to-paint samples plus main-thread/frame/tick/backlog/heap samples; report p95 and worst separately | Reproducible enemy/effect peak plus 30-minute soak, device matrix, engine frame log, rollback/readiness evidence; optional Long Tasks | **Target:** p95 frame interval ≤16.7 ms; <0.5% frames exceed 33.4 ms; no positive memory-retained slope across 30 minutes; input-to-presented ≤100 ms; 0 unreported simulation-backlog drops. **Source-derived diagnostic:** INP ≤200 ms at field p75 (S3), not a gate substitute. | Presenting only average FPS; renderer alters combat; no rollback/readiness evidence; missing 30-minute soak; long-task API absence suppresses engine timing records. |
| G5 choice visibility | Offer → presented summaries → inspected/selected option → committed effect; selection latency is `commit_ms − presented_ms` | All offer-table variants, first and repeated choice, reduced motion, keyboard/touch | **Target:** 100% offers show name + mechanical effect before commit; 100% commits have exactly one valid option and post-effect hash; no countdown/autopick in slice. | Effect is hidden until after selection, one tap selects an ambiguous card, or offer order/contents vary under same seed. |
| G5 choice comparability | Count visible effect summaries and stable option IDs; task: select named effect from side-by-side offer | Screenshot/DOM-or-snapshot semantic record, not click-only analytics | **Target:** all offered options simultaneously comparable in one state; 0 required recall of prior card text | User must open/close cards to compare, label has no mechanical meaning, or choice presentation blocks the only movement control without intentional pause semantics. |
| G5 idle calculation | `award = f(valid_elapsed, persistent_state, rule_version)`; replay `f` from recorded input and compare totals | Clock-injected test matrix: 0, short, cap-boundary, cap+1, future clock, rollback, missing/corrupt save, storage denied | **Target:** 100% deterministic recomputation and idempotent repeated claim; 0 award on invalid/negative elapsed time; state partition invariants always hold | Award uses wall-clock during active run, repeated reopen doubles award, run-only skills leak into persistence, or malformed local data overwrites valid progress. |
| G5/G6 offline/no-network | Network request count and dependency trace from cold/reload/idle-return flow and local diagnostics export | Browser network disabled; service-worker/cache behavior where applicable; exported local diagnostic | **Target:** 0 required network requests and 0 account/commerce dependencies for the entire fixture | Idle award waits for network, UI claims success after save failure, or telemetry requires online transport. |
| G2/G4/G5/G6/G7 cross-cut determinism | Canonical hash sequence for same seed/input tape at 30/60/120 Hz render cadence and alternate snapshot observer | Headless/controlled render clock replay; renderer swap/fallback if available | **Target:** byte-identical canonical checkpoint hashes at every checkpoint; 0 rule-state writes from observer | Any first mismatch; choice/crit/idle result differs by cadence, reduced motion, renderer, or observer. |

## Failure-mode matrix and required checks

| Surface | Required checks | Expected result | Escalate as |
|---|---|---|---|
| Reduced motion | Force system preference and in-app setting; replay the same input tape; snapshot health/crit/hazard/choice states; inspect CSS/canvas action log for disabled non-essential movement | Rule hashes, crit outcomes, choice offers, and idle award are identical; static shape/text/contrast still identifies states | **P0 determinism/accessibility** if rules change or essential state becomes unavailable. |
| Input | Touch, pointer, and keyboard/adaptive digital-input scenarios; start/stop/reverse movement; movement while feedback/choice UI appears; target geometry at narrow/rotated viewport | Input is admitted in deterministic order; overlays do not silently swallow movement except documented intentional pause; choices are reachable by the same input family | **P0** if input changes simulation unpredictably; **P1** if a key flow is inaccessible. |
| Performance | 90-second scripted peak at representative viewport/device classes; record frame/tick backlog and input timing; repeat with reduced motion | Simulation has headroom; timing is reportable even if optional browser long-task API is unavailable | **P1** for target breach with accurate rules; **P0** for silent tick loss, simulation-rate change, or nonreproducible results. |
| Determinism | Same seed/tape across render cadences, observer adapters, reduced-motion state, restart from checkpoint, and save/load boundary | Canonical state checkpoints and persistent totals match byte-for-byte; diagnostic sequence may differ only in observer timestamps | **P0** at first state-hash mismatch. |
| Reward choice | Repeat offer with each option selected; invalid/repeated/stale input; no selection; storage/reload after commit | One valid commit, correct effect state, no duplicate; unchosen options vanish only at the documented decision boundary | **P0** for wrong/duplicated effect; **P1** for insufficient visible comparison. |
| Idle return | Clock injection and local-storage fault matrix; two reloads; malformed version/checksum; export/import if offered | Valid award is reproducible and idempotent; invalid state is safely rejected/recovered without run-state contamination | **P0** for duplicate/lost persistent resources; **P1** for unclear recoverable failure. |

## Experiment designs

1. **G4 seeded feedback discrimination study.** Build a fixed corpus containing normal hit, critical hit, low-health transition, damage-over-time, and no-event controls. For each state, collect a static reduced-motion snapshot and normal-mode capture. Randomize order and ask participants to identify the state/effect and confidence; retain the event ID and snapshot revision. Compare error rate by presentation mode. **Target:** preregister the success criterion and sample plan before recruitment; do not replace human comprehension with internal click telemetry.

2. **G4 input-response load sweep.** Replay the same movement pulse tape at idle, combat peak, and choice presentation on each device tier. Record capture, admitted tick, and first presentation timestamps, plus `sim_steps`, backlog, and renderer duration. Analyze p50/p95 per device/input mode; do not pool across tiers. **Target:** p95 admission ≤2 ticks and p95 input-to-presented feedback ≤100 ms in the controlled slice run. A hit proves a trace condition, not field responsiveness.

3. **G5 visible-choice comprehension A/B only after copy/layout alternatives exist.** Hold offer IDs, order, effects, seed, and input timing constant. Vary only the representation under test (for example, compact versus explicit mechanical summary). Primary outcome: correct selection for a stated goal; secondary: time-to-commit, cancellation/backtracking, and post-commit recognition. **Target:** choose a preregistered non-inferiority margin before data collection; do not declare a winner from raw selection rate when the offers differ in value.

4. **G5 clock-and-storage fault property suite.** Generate elapsed-time, timestamp-order, save-version, checksum, storage-availability, and reopen-count cases. Assert recomputation, idempotency, nonnegative award, state separation, and no network dependency. **Target:** 100% property assertions across the generated test corpus. This is the core proof for fair idle progression; simulated elapsed time is not a live retention measurement.

5. **G2/G4/G5/G6/G7 cross-gate determinism differential replay.** For each fixed seed/input tape, run 30/60/120 Hz render clocks, normal/reduced motion, snapshot observer A/B, and save/reload at defined checkpoints. Diff canonical state hash, PRNG position, choice offer IDs/order, damage event IDs, and persistent totals at every checkpoint. **Target:** zero canonical differences. Store the first mismatch’s tick and minimal input prefix to make the defect reproducible.

## Original measurable design implications (testability only)

1. **Event identity must bridge rules and presentation.** Give every damage/crit/choice/idle resolution one deterministic ID and require each presentation to cite it. This makes “the feedback lied” reducible to an exact event-to-snapshot mismatch rather than a subjective video review.
2. **Separate three clocks.** Record monotonic input/presentation time, integer simulation tick, and validated idle elapsed basis separately. **Target:** no business rule reads render timing; no offline award reads an unvalidated time source. This prevents a smooth frame trace from masking rule drift.
3. **Make visibility inspectable from a snapshot.** Emit a compact semantic snapshot of health state, crit flag, choice summaries, and accessibility channels alongside Canvas pixels. **Target:** every required G2/G4/G5 state can be asserted without OCR, image guessing, audio playback, or an implementation-only DOM path.
4. **Treat idle return as a transaction.** Persist a versioned basis/checksum and idempotency key before/with a claim, and log before/after persistent totals. **Target:** a second identical claim is a no-op; invalid storage produces an explicit non-award outcome. This is safer than treating idle progression as a cosmetic counter.
5. **Define performance as traceable headroom, not average FPS.** Pair p95 input response with tick backlog and canonical replay equality. **Target:** a performance result is rejected as incomplete when it lacks device/input segmentation, backlog policy, or replay-hash evidence.

## Handoff checklist

- Attach the fixed-seed tapes, canonical state serializer/version, and expected checkpoint hashes to any future gate evidence.
- Keep diagnostic export local and opt-in; do not introduce network analytics to satisfy this protocol.
- Record device/browser/viewport, input mode, reduced-motion state, renderer ID, build ID, and fixture version for every future measurement.
- Report failures with the first divergent tick/event ID and a minimal reproduction tape. Do not relabel a target as achieved without the corresponding evidence artifact.
