# Telemetry and playtest contract — expanded systems

## Research question and status

**Question.** What deterministic, local-only event contract and controlled playtest design can falsify candidate PCG, balance, feedback, sound, reward, and idle-system claims without granting instrumentation or presentation authority over combat?

This is a **future instrumentation and study contract**. It does **not** assert that telemetry, cohorts, logs, exports, thresholds, or human-playtest results currently exist. It does not alter `defense-catalog.js`, the 60 Hz rules, or any canon. Every number marked **target** must be preregistered for its fixture before it can become gate evidence.

### Authoritative gate alignment

The harness quality-gate contract is authoritative. This telemetry packet supplies future traces without remapping gate meanings: G2 consumes deterministic balance/TTK/combo evidence; G4 consumes presentation and immersion evidence; G5 consumes reward/idle fairness evidence; G6 consumes telemetry, rollback, frame/long-frame/30-minute memory/input evidence; G7 consumes core-loop traces and repeat study; G8 consumes PCG novelty and impression evidence. No target or event in this report is a gate result.

## Source ledger

| ID | Source and provenance | Observed evidence | Bounded use here |
|---|---|---|---|
| S1 | [OpenTelemetry semantic-convention naming](https://opentelemetry.io/docs/specs/semconv/general/naming/) — **primary specification** | The rules apply to event names, attribute keys, and metric names; names should be lowercase and descriptive, dot-delimited namespaces are recommended, and two events must not share a name. | Stable, namespaced event kinds; mutable facts live in typed fields rather than in invented event names. |
| S2 | [OpenTelemetry Trace API — SpanContext](https://opentelemetry.io/docs/specs/otel/trace/api/#spancontext) and [instrumentation scope](https://opentelemetry.io/docs/specs/otel/common/instrumentation-scope/) — **primary specifications** | A scope is a name/version/schema-URL/attributes tuple; a schema URL may identify the governing schema. Trace IDs are identifiers for tracing context. | Use a local `schema_version`, run/session correlation, and event sequence; do **not** treat tracing IDs as player identity. |
| S3 | [EU GDPR, Regulation (EU) 2016/679](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32016R0679), Articles 5, 20, 25 and Recital 39 — **primary legislation** | Purpose limitation, data minimization, storage limitation, privacy by default, and conditional machine-readable portability are stated requirements. | Bound local diagnostic fields and export only an explicit, documented package. Applicability remains fact- and jurisdiction-dependent. |
| S4 | [NIST Privacy Framework v1.0](https://nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.01162020.pdf) — **primary NIST publication** | The framework includes local-device processing to limit observability/linkability, standardized transfer formats, deletion policy, and minimized audit/log records. | Local-first processing, documented fields, explicit export, and deletion action are defensible privacy-design patterns; the framework is not law. |
| S5 | [W3C WCAG 2.2: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) and [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) — **primary W3C accessibility standard/guidance** | Color must not be the sole means of conveying information; graphical objects required to understand content need 3:1 contrast against adjacent colors. | A readability probe must record non-color cue availability and audit critical cue contrast; compliance alone does not prove semantic understanding. |
| S6 | [Microsoft Research: Diagnosing Sample Ratio Mismatch](https://www.microsoft.com/en-us/research/publication/diagnosing-sample-ratio-mismatch-in-online-controlled-experiments-a-taxonomy-and-rules-of-thumb-for-practitioners/) — **primary research publication, ACM SIGKDD 2019** | Sample-ratio mismatch can indicate data-quality faults; ignoring it can make a bad modification appear good or vice versa. | Offline playtest cohorts still need expected-versus-observed assignment checks before any comparison. |
| S7 | [Claypool & Claypool, “Latency and player actions in online games”](https://doi.org/10.1145/1167838.1167860) — **peer-reviewed ACM publication** | The abstract describes latency as affecting player experience and game-design expectations. | Measure an entire input-to-visible-response chain and outcomes, not handler time alone. It supplies no universal millisecond target for this offline game. |
| S8 | [Gravina et al., “Procedural Content Generation through Quality Diversity”](https://arxiv.org/abs/1806.06220) — **author-published academic preprint** | Quality-diversity PCG seeks a collection of varied, high-quality artifacts over defined behavioural descriptors rather than one optimum. | Define stage/encounter descriptors before measuring coverage and pair variety with validity, rather than counting seeds alone. |

## Evidence patterns, constraints, and contradictions

1. **A schema needs one name per event kind and an explicit version.** [INFERENCE from S1–S2] The contract therefore fixes event names and types, while allowing field additions only in a new schema version.
2. **Observed presentation is evidence, never simulation authority.** [INFERENCE from the deterministic product contract] Rule-resolution events originate on integer `sim_tick`; render, VFX, audio, and narration records may only cite their ID and outcome.
3. **Telemetry can prove a trace, not player understanding or enjoyment.** WCAG tests distinguishability (S5), and latency research supports measuring responsiveness (S7), but neither establishes that an Abyssal player understands a cue or is not bored. Moderated task responses remain required.
4. **Variation is not automatically diversity.** Quality-diversity work requires declared descriptors (S8). Different raw seeds that produce the same stage signature are repetition for this contract.
5. **Experiment assignment can corrupt conclusions even locally.** S6 is online-experiment research, but its data-quality warning generalizes only as a bounded inference: compare assigned versus observed cohort counts before judging a variant.

**Risks/contradictions.** Raw input paths, free-text comments, or persistent device identifiers improve diagnosis but conflict with data minimization. High-frequency performance events can perturb the frame profile they intend to measure. Sound-disabled and reduced-motion conditions may make a presentation event absent while the underlying rule event remains valid. PCG feature entropy can look broad while encounter difficulty or stage readability is poor. These are handled by bounded sampling, separate observer tags, modality fields, and quality checks below.

## Authority and deterministic event envelope

### Non-interference rule

The deterministic core remains the only rules authority. It may emit a serializable rule event **after** resolving a state transition; it must not read observer timing, export state, cohort, sound availability, reduced-motion state, or player-study response. Render/audio/VFX/narration adapters can append `observer.*` records only and cannot write simulation state, consume RNG, reorder input, alter PCG, or affect the canonical hash.

Every future record uses this envelope (fields marked `?` are nullable):

```json
{
  "schema_version": "telemetry-playtest/1",
  "event": "abyssal.combat.resolved",
  "seq": 42,
  "run_id": "random-local-diagnostic-id",
  "session_id": "random-local-session-id",
  "build_id": "immutable-build-label",
  "fixture_id": "optional-controlled-fixture",
  "cohort_id": "optional-study-cell",
  "sim_tick": 720,
  "monotonic_ms": 12004.2,
  "observer": false,
  "payload": {}
}
```

`seq` is monotonically increasing within one session. `sim_tick` is an integer or `null` only for pre-admission input/UI events. `monotonic_ms` is diagnostic timing only, never a rule input. `run_id` and `session_id` are fresh random local identifiers; they are neither account IDs nor stable pseudonyms. Reproducibility records add `canonical_state_hash`, `rng_cursor`, `input_cursor`, a non-personal deterministic `seed`, and serializer/rules versions. Stable-key serialization is required for export comparison.

### Proposed event catalog

All rows below are **proposed**; none identifies an existing event implementation.

| Event | Authority | Required payload | Why it exists / invalid condition |
|---|---|---|---|
| `abyssal.session.started` | observer/bootstrap | `platform_class`, `viewport_class`, `input_mode`, `reduced_motion`, `sound_mode`, `storage_mode` | Segments a fixture. Invalid if it includes account, IP, advertising ID, fingerprint, or raw locale/free text. |
| `abyssal.experiment.assigned` | observer/bootstrap | `experiment_id`, `cohort_id`, `assignment_version`, `assignment_method`, `expected_cell` | Makes an offline test cell inspectable. Invalid if assignment can reach rules code or changes a seed after run start. |
| `abyssal.input.captured` | input observer | `input_id`, `kind`, `normalized_vector`, `captured_monotonic_ms` | Starts latency trace. Bounded/sampled; never stores raw gesture path by default. |
| `abyssal.input.admitted` | deterministic core | `input_id`, `admitted_tick`, `normalized_vector`, `reject_reason?` | Proves movement admission. Invalid if event input differs from the authoritative input tape. |
| `abyssal.sim.checkpointed` | deterministic core | `canonical_state_hash`, `rng_cursor`, `input_cursor`, `rules_version`, `serializer_version` | Localizes the first deterministic divergence. |
| `abyssal.pcg.generated` | deterministic core | `stage_id`, `seed`, `grammar_version`, `descriptor_signature`, `validation_result`, `objective_link_id` | Makes generated structure and validity measurable. Invalid if a render-generated layout becomes canonical. |
| `abyssal.encounter.started` / `.completed` | deterministic core | `encounter_id`, `descriptor_signature`, `sim_tick`, `outcome`, `duration_ticks`, `damage_taken`, `rule_event_count` | Measures encounter composition, duration, and outcome without inferring enjoyment. |
| `abyssal.combat.resolved` | deterministic core | `resolution_id`, `source_kind`, `target_kind`, `base_value`, `modifier_ids`, `final_value`, `crit_flag`, `rng_cursor` | Allows balance and feedback truthfulness checks. |
| `abyssal.feedback.presented` | observer | `resolution_id`, `snapshot_revision`, `channels`, `non_color_cue`, `reduced_motion`, `presentation_status` | Correlates a visible static/motion signal to a resolved event. Invalid if it asserts a rule result. |
| `abyssal.audio.cue_requested` / `.presented` | observer | `resolution_id?`, `cue_id`, `mix_mode`, `sound_mode`, `result` | Separates requested from actually presented sound and preserves sound-off evidence. Audio must not gate combat. |
| `abyssal.narration.cue_presented` | observer | `objective_link_id`, `cue_id`, `caption_available`, `sound_mode`, `result` | Tests lore handoff without recording voice, transcript, or network activity. |
| `abyssal.choice.offered` | deterministic core | `offer_id`, `ordered_option_ids`, `effect_summaries`, `offer_hash`, `sim_tick` | Captures exactly what rules offered. |
| `abyssal.choice.inspected` | observer | `offer_id`, `option_id`, `inspection_kind` | Optional comprehension proxy, not proof of comprehension. |
| `abyssal.choice.committed` | deterministic core | `offer_id`, `option_id`, `input_id`, `before_effect_hash`, `after_effect_hash`, `result` | Tests exactly-one valid choice and effect commitment. |
| `abyssal.reward.probe_answered` | study observer | `probe_id`, `offer_id`, `correct`, `response_ms`, `confidence_band`, `skipped` | Direct comprehension outcome. No free text unless separately consented and redacted. |
| `abyssal.readability.probe_answered` | study observer | `probe_id`, `cue_id`, `correct_interpretation`, `correct_action`, `response_ms`, `assist_needed`, `modality_condition` | Measures recognition/action separately across presentation modes. |
| `abyssal.self_report.recorded` | study observer | `prompt_id`, `rating_ordinal`, `shown_after_segment`, `skipped` | Captures bounded boredom/repetition report; no diagnosis is inferred from play duration. |
| `abyssal.idle.calculated` / `.claimed` | deterministic core | `basis_version`, `valid_elapsed_ms`, `award_delta`, `before_total`, `after_total`, `idempotency_key`, `result` | Recomputes idle awards and detects duplicate claims. |
| `abyssal.snapshot.presented` | observer | `snapshot_revision`, `sim_tick`, `presented_monotonic_ms`, `renderer_id` | Closes input-to-visible chain without treating paint as a rule clock. |
| `abyssal.frame.sampled` | observer | `frame_interval_ms`, `sim_steps`, `tick_backlog`, `update_ms`, `render_ms`, `sample_rate` | Finds performance pressure. Sampling must be fixed per fixture. |
| `abyssal.export.created` / `.deleted` | local export controller | `export_schema`, `event_count`, `redaction_profile`, `reason`, `result` | Audits explicit local export/delete actions only; never uploads. |

## Cohorts and study controls

Cohorts are for **pre-recruited, local moderated playtests or deterministic fixture runs**, not live online optimization. Assignment is a checked-in manifest and a local deterministic mapping from `participant_code + study_version` to a cell; the participant code is held outside the exported event package and is not a telemetry ID.

| Experiment | Cells | Hold constant | Primary outcome | Assignment/data-quality check |
|---|---|---|---|---|
| Feedback/readability | normal presentation; reduced-motion static presentation; sound-off captioned presentation | seed, damage/crit tape, text, rules | correct action and correct interpretation | Counterbalance order; compare observed cell counts to manifest allocation; stop comparison on mismatch. |
| Control latency | idle; combat peak; choice overlay | device class, input tape, display mode, build, sample rate | p50/p95 admission and visible-response delay | Never pool device/input classes; reject traces with missing input IDs. |
| Reward comprehension | explicit mechanical summary; compact summary | offer IDs/order/effects, seed, input timing | goal-correct choice and post-choice recognition | Preregister non-inferiority/winner rule; compare cohort allocation and offer parity hashes. |
| PCG diversity/readability | grammar A; grammar B; fixed-seed corpus | descriptor schema, validation rules, challenge budget | valid descriptor coverage and first-attempt objective recognition | Stratify seed corpus; every cell gets the same count of seeds and validation failures. |
| Sound/narration support | sound enabled; sound off + caption; reduced motion | rule event IDs, encounter/objective tape, cue text | cue-to-objective recognition, missed-cue rate | Sound is a presentation condition, never an authority condition; compare missing-cue records by mode. |
| Idle integrity | elapsed-time/save fault matrix | initial persistent state, rule version, injected clock case | recomputation and idempotency | No human participant data; each fixture must replay identically. |

## Session-log measures and formulas

The measures below are analytical definitions for future exports. Each is segmented by `build_id`, fixture/cohort, platform class, input mode, reduced-motion state, sound mode, and grammar/rules version. Report missingness before a result; a metric with absent required records is **not evaluable**.

| Concern | Required events | Formula | Interpretation boundary |
|---|---|---|---|
| Boredom / repetition | `pcg.generated`, encounter events, `self_report.recorded` | **Consecutive repetition** $R_c=\frac{\sum_{i=2}^{n}\mathbf{1}[d_i=d_{i-1}]}{n-1}$ where $d_i$ is descriptor signature. **Descriptor coverage** $C=\frac{|\{d_i\}|}{n}$. **Boredom rate** $B=\frac{\#(rating\geq q)}{\#(rating\ answered)}$ for preregistered ordinal cutoff $q$. | $R_c$ and $C$ describe generated exposure; they do not diagnose boredom. $B$ is self-report only and must retain skipped responses in its denominator report. |
| Readability | `feedback.presented`, `readability.probe_answered` | **Correct-action rate** $A=\frac{\#correct\_action}{\#valid\_answers}$; **interpretation rate** $I=\frac{\#correct\_interpretation}{\#valid\_answers}$; response latency is median and p95 `response_ms`. | A presentation event is exposure, not understanding. Analyze normal/reduced-motion/sound-off conditions separately. |
| Control latency | input, admission, checkpoint, snapshot events | **Admission delay ticks** $L_a=t_{admitted}-t_{first\ eligible}$; **visible delay** $L_v=ms_{presented}-ms_{captured}$. Report p50/p95 and missing-ID rate $M=\frac{\#missing\ links}{\#captured}$. | Do not substitute average FPS or handler duration. `L_v` is device/renderer dependent and cannot be compared across unsegmented hardware. |
| Reward comprehension | choice events, `reward.probe_answered` | **Goal-correct choice** $G=\frac{\#correct\ choice}{\#valid\ probes}$; **effect recall** $E=\frac{\#correct\ postcommit}{\#valid\ probes}$; **commit ambiguity** $U=\frac{\#offers\ with\ 0\ or\ >1\ commits}{\#offers}$. | Fast selection or inspection is not comprehension. `U` is a deterministic integrity metric; $G,E$ require participant probes. |
| Balance / fairness | combat, encounter, choice, idle events | For cohort $k$, **outcome difference** $\Delta_k=median(damage\_taken)_k-median(damage\_taken)_{baseline}$; **reward parity** is the distribution of `award_delta` for identical `basis_version`, initial state, and elapsed case. | Differences flag a candidate investigation; they do not establish fairness without a predeclared reference and outcome-quality review. |
| PCG diversity | `pcg.generated`, encounter events, readability probes | **Feature entropy** $H=-\sum_j p_j\log_2p_j$ over declared descriptor bins; **pairwise signature distance** $D=\frac{2}{n(n-1)}\sum_{i<j}(1-J(d_i,d_j))$ for set descriptors (or preregistered Hamming distance for fixed vectors); **valid coverage** $V=\frac{\#validation\_pass}{\#generated}$. | Use the same bins/descriptor schema across variants. High $H$/$D$ with low $V$, unreadable objectives, or a worse challenge distribution fails the quality side of variety. |
| Sound / narration readability | audio/narration cue and readability-probe events | **Cue delivery** $Q=\frac{\#presented\ cues}{\#requested\ cues}$ by sound mode; **caption-supported recognition difference** $\Delta I=I_{captioned\ sound-off}-I_{sound-on}$. | Sound-off is an accessibility condition, not a defect by itself. Audio delivery can be unavailable while the underlying combat event is correct. |
| Idle integrity | idle calculation/claim and checkpoint events | **Recompute equality** $P=\frac{\#cases\ where\ f(inputs)=award\_delta}{\#valid\ cases}$; **idempotency failure** $F=\frac{\#duplicate\ claim\ mutations}{\#repeated\ claims}$. | This is property evidence under injected clocks/storage faults, not a retention or return-motivation metric. |

## Gate falsification rules

A rule is falsified by the first reproducible failing fixture, not averaged away by a positive aggregate. The proposed targets below are intentionally conditional and are **not current measurements**.

| Gate | Candidate claim to test | Falsifier / required artifact |
|---|---|---|
| G2 | Health, critical, cooldown, and complete-build balance are deterministic and remain within the harness band. | Any resolved damage/cooldown value mismatches the versioned rule; matchup exits 45–55%; boss TTK exits ±15%; or combo EV exceeds 1.30× median. Artifact: equal-budget archetype sweep, fixed seed/tape, canonical rule events, and result export. |
| G4 | Feedback, VFX, sound, narration, and control projection support immersion without hiding state. | Resolved health/crit/objective state lacks its required redundant presentation; a critical cue is color-only or unavailable as static/text in reduced motion; feedback latency exceeds target; or a preregistered immersion/readability condition fails. Artifact: captures, observer records, snapshot/caption evidence, latency probes, and panel rows. |
| G5 | Reward choice and idle return preserve no-commerce fairness. | A persistent reward hides its condition/probability; offer/order/effect hash varies under the same seed; a return claim is non-idempotent or invalid elapsed awards resources; or paired parity/fairness fixture exits its declared band. Artifact: offer/commit chain, clock/save matrix, PM audit, and local network-off trace. |
| G6 | Telemetry, rollback, performance, and local operations meet the harness operations gate. | Telemetry/rollback/readiness output is absent; p95 frame exceeds 16.7 ms; long frames are ≥0.5%; 30-minute memory is unstable; input exceeds 100 ms; or canonical replay diverges. Artifact: local export, rollback receipt, 30-minute soak, input/frame/tick traces, and first divergent tick. |
| G7 | The core loop requires deliberate movement/objective/reward decisions and earns voluntary re-entry. | Fixed 30–180-second trace has fewer than three distinct actions or no accepted reward; objective advance has no meaningful route decision; or moderated voluntary re-entry is <70%. Artifact: loop tape, event sequence, movement/objective trace, and repeat-study rows. |
| G8 | Seeded PCG supplies a distinctive, valid stage/encounter conjunction rather than seed noise or unfair repetition. | Descriptor validation fails; the fixed corpus misses a preregistered descriptor cell; grammar variants differ only in seed while descriptor signatures remain unchanged; a survey frequency exceeds ≤2-of-5; or QA impression is <4/5. Artifact: seed corpus, comparison ledger, and impression rows. |

## Privacy, local export, and retention boundaries

1. **No transport.** Diagnostic collection, storage, analysis, and export remain on device. The contract proposes no account, authentication, cloud sync, analytics SDK, remote experiment assignment, webhook, gameplay-time API, or network request. A network-disabled fixture is mandatory for G5 idle-return and G6 operations evidence and should be run for all export paths.
2. **Data minimization.** Default events contain mechanics, timing, version, and accessibility mode only. They must not contain player name, contact data, account ID, IP, advertising ID, fingerprint, exact location, microphone capture, voice/narration recording, free text, unbounded input path, or raw crash stack containing user content. This applies even when an export is local.
3. **Explicit local export.** Export is created only by an intentional in-product/local test action and includes a manifest: schema version, field dictionary, build/fixture/cohort metadata, redaction profile, event count, and checksum. JSON Lines or JSON is a proposed structured, machine-readable format, consistent with the portability pattern in S3 and standardized-format outcome in S4; it is not a claim of a legal obligation.
4. **Separation of study identity.** A facilitator may maintain a separately stored participant consent/code sheet for a moderated study. The gameplay export contains only a fresh local session/run ID. Joining the two is a deliberate facilitator operation, not automated telemetry.
5. **Review/delete.** The future UI/tooling must expose local diagnostics review and deletion, and an export event records only the action/result. **Target:** retain raw local diagnostic logs only for the active study/build policy, then delete them; do not silently repurpose past data for another study.
6. **Consent boundary.** Instrumented playtest collection beyond essential local QA must state purpose, fields, recipient, retention, export action, and withdrawal/delete path before collection. GDPR applicability and lawful basis require project-specific review; this contract does not decide them.

## Experiments, telemetry checks, and failure mode

1. **Fixed-seed PCG corpus.** Generate the preregistered seed corpus under each grammar version, emit descriptor signatures and validity, then compute $R_c$, $C$, $H$, $D$, and $V$. Pair it with fixed objective-recognition probes. This tests variety and quality; it does not extrapolate to retention.
2. **Feedback modality counterbalance.** Replay normal, reduced-motion, and sound-off/caption states against identical rule IDs. Ask state/action probes in randomized order. Compare $A$, $I$, and response-time distributions only after allocation and missingness checks.
3. **Peak-load control trace.** Run the same movement tape during idle, defined combat peak, and choice overlay on each platform/input cell. Report `L_a`, `L_v`, frame backlog, and canonical hashes. A performance trace lacking hashes is insufficient for a deterministic claim.
4. **Reward comprehension test.** Hold offer rules and order constant, vary one declared presentation factor, and require a stated-goal choice plus post-commit recognition. Stop if offer hashes differ across cells; then the comparison confounds value with presentation.
5. **Idle fault property suite.** Inject zero, cap boundary, cap-plus-one, rollback, future-clock, malformed-save, storage-denied, and repeated-claim cases. Require $P=1$ and $F=0$ over the bounded fixture corpus before interpreting any UX response.
6. **Cohort-integrity check.** Before each variant comparison, calculate observed/expected assignment counts by platform and condition. Any mismatch, duplicated session ID, schema mismatch, missing required link, or leaked cohort into rule events invalidates that comparison pending root-cause analysis.

### Required reproducibility failure mode and test

**Failure mode: observer or cohort state leaks into simulation.** A sound-off, reduced-motion, grammar-cohort, or export-enabled flag changes RNG consumption, input order, PCG output, combat result, or idle award. This leaks presentation/measurement authority into `defense-catalog.js`-governed rules and invalidates both fairness and replay evidence.

**Test.** For every fixed seed/input/clock fixture, run normal versus reduced-motion, sound-on versus sound-off, all cohort labels, export disabled versus enabled, and two observer adapters at 30/60/120 Hz render cadence. Diff canonical hash, RNG cursor, input cursor, PCG descriptor/order, combat resolution IDs/values, choice offer hashes, and persistent totals at every checkpoint. **Target:** byte-identical deterministic fields with observer-only timing records permitted to differ. The first mismatch, its tick, and the minimal input prefix are the defect artifact.

## Original measurable Abyssal implications

1. **Target — a deterministic event ID bridges rules to presentation.** Damage, critical hits, stage objectives, choices, and idle claims each need one rule-issued ID; presentation may cite but never generate it. This makes “the feedback lied” mechanically falsifiable.
2. **Target — PCG needs a descriptor contract before a seed count.** A stage/encounter’s grammar version, descriptor signature, validity, and objective link are the minimum evidence for G8; seed uniqueness alone is not variety.
3. **Target — readability needs an accessibility-safe direct measure.** Critical cues should log available channels and be tested by correct action/interpretation under reduced motion and sound-off, not by clicks or contrast audit alone.
4. **Target — reward and idle results are transactions, not impressions.** Offer/commit/effect hashes and calculation/claim totals allow one-choice and no-double-award assertions before player preference is interpreted.
5. **Target — local exports must be reproducible packages, not silent analytics.** A schema/version/manifest/checksum/redaction package enables facilitator analysis while preserving offline, no-account constraints.

## Handoff checklist

- Freeze event names, types, descriptor schema, cohort manifest, fixture IDs, and expected checkpoint hashes before implementing a measurement.
- Treat any absent required event link, schema mismatch, cohort mismatch, or network dependency as an invalid result, not a pass.
- Store only local, opt-in exports; annotate every future report with build, rules, grammar, serializer, fixture, platform/input, reduced-motion, sound, and redaction versions.
- Report numeric outputs as **measured** only with the underlying export/fixture and falsification result. Until then, every value in this contract remains a target or formula.
