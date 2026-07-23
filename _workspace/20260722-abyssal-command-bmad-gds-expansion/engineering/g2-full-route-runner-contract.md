# G2 full-route deterministic runner contract — PROPOSED / UNVERIFIED

**Owner:** game-programmer (runner and canonical-state integration) + game-qa (signed matrix, execution, and independent review)  
**State:** `PROPOSED / UNVERIFIED — BLOCKED BEFORE COLLECTION`  
**Gate state:** **G2 remains `NOT MEASURED / NOT PASSED`.** This is a feasibility contract, not runner code, a collection authorization, a balance result, or a release decision. G8 remains separately blocked on its preregistered human first-exposure/impression task.

## Evidence basis and current gap

The only current executable evidence surface is `scripts/run-g2-archetype-sweep.mjs`, checked by `tests/g2-archetype-sweep-cli.test.mjs`. It produces a checksummed 5-profile × 3-seed Cinder Span diagnostic with a fixed `WINDOW_TICKS = 360`, a no-movement/single-active-skill tape, and a repeated final snapshot digest. Its own records mark ordinary, elite, and Stage-10 TTK, multi-skill combo percentiles, and route win rate unavailable; the terminal result is permitted to be `INCOMPLETE_WINDOW`. The existing test proves exactly this bounded package shape and repeated digest equality—not a terminal full-route corpus.

The full-route corpus remains blocked from admission and collection. `qa/g2-canonical-preregistration.md` now binds assessment, cohort, comparator, seed, tape, and expected-tuple registers, but it does not attest a completed runner, fixture adapter, corpus, test result, or gate result. Its narrow authorization permits implementation of a headless deterministic 60 Hz measurement runner only; it does not authorize candidate selection, execution, collection, measurement, or a G2 verdict. The required G2 surfaces include ordinary, elite, Stage-10, pressure, declared/adversarial movement, cooldown C-1/C/C+1, relief/card-exhaustion, and the QA matrix's normal/reduced/muted/dropped A/B observer and 30/60/120 Hz harness-cadence replays; they are not derivable from the 360-tick diagnostic.

## Authorized implementation boundary and canonical inputs

The authorized implementation boundary is a **headless deterministic 60 Hz full-route measurement runner** plus its QA-only recording/admission surface. It MAY be implemented by game-programmer and game-qa without altering the existing bounded Cinder Span diagnostic runner or its test. It MUST consume only:

- workspace-root `g2-expected-tuples-v1.json` — the sole QA-owned canonical expected-tuple register;
- `qa/g2-full-route-seed-register-v1.json` — the canonical QA seed register; and
- `qa/g2-input-tape-register-v1.json` — the canonical QA input-tape register.

Workspace-root `g2-full-route-seed-register-v1.json` and `g2-input-tape-register-v1.json` are non-authoritative duplicate provenance, not runner inputs. Before candidate selection or execution, the runner MUST validate the expected tuple register's embedded seed and input-tape digests against those canonical QA registers. The documented embedded seed digest `sha256:b8764d2e5a9da8580b8fea5a859bd224648953bba489f2e1d173251aa38941be` and input-tape digest `sha256:480b3b359ed92fbf28ace6f8807128d65b1c4f301c435117ba58bdd985ca2fe0` do not match the canonical QA register digests. Therefore, until reconciliation, any implemented runner MUST fail closed: it MUST NOT select or execute a candidate, MUST emit only the applicable blocked/incomplete result, and MUST preserve G2 as `NOT MEASURED / NOT PASSED`. This implementation authorization does not authorize corpus collection or any evidence admission.

| Required target — all **PROPOSED / UNVERIFIED** | Owner | Method | Evidence path | Blocker |
| --- | --- | --- | --- | --- |
| Full-route candidate corpus | game-qa + game-programmer | Enumerate only the signed finite coverage matrix after collection admission; append each immutable candidate tuple and its declared terminal outcome or signed tick-ceiling stop to the canonical G2 corpus, preserving the existing bounded diagnostic manifest as a distinct historical package. | `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` *(canonical target; full-route rows not created)* | Collection is blocked: the expected-tuple register's embedded seed/input digests do not match the canonical QA registers, and fixture/signature admission, runner attestation, role attestations, and independent R1/R2 review remain incomplete. |
| Replay and observer differential corpus | game-qa + game-programmer | Re-run each candidate by baseline repeat, 30/60/120 Hz observer cadence, and observer A/B/disabled modes; compare every required checkpoint and terminal record. | `qa/evidence/determinism/G2-full-route-observer-differentials.jsonl` *(proposed; not created)* | Current bounded runner has one `local-no-render` observer configuration only. |
| First-divergence / invalid-candidate register | game-qa | Preserve the first unequal canonical field/checkpoint or admission failure without retrying, substituting a seed, or collecting a replacement result. | `qa/evidence/gates/G2-full-route-first-divergence.jsonl` *(proposed; not created)* | Checkpoint schema, map/wave admission identity, and full-route replay contract are not implemented or frozen. |
| Independent completeness review | game-qa independent reviewer | Verify tuple uniqueness, artifact checksums, required variants, terminal completeness, replay comparisons, and no omitted first-falsifier. | `qa/evidence/gates/G2-full-route-runner-review.md` *(proposed; not created)* | No collection is authorized until cross-register links reconcile and all preceding implementation, attestation, and review blockers are resolved. |

## Immutable candidate tuple

Before tick 0, the runner **MUST** canonicalize one JSON object using stable key ordering and SHA-256 it as `candidate_tuple_digest`. The original tuple and digest are immutable for every record belonging to that candidate. A change to any field creates a different candidate; it is not a rerun.

```yaml
candidate_tuple: # PROPOSED / UNVERIFIED
  runner_schema_version: "g2-full-route-runner-v1"
  replay_protocol_version: "g2-full-route-replay-v1"
  canonical_serializer_version: "<frozen snapshot/event serializer version>"
  rules_version: "<defense-catalog RULES_VERSION>"
  catalog_digest: "sha256:<exact frozen catalog serialization>"
  simulation_tick_rate_hz: 60
  assessment_unit_id: "<signed profile × cohort × pressure × input-policy ID>"
  stage_id: "<catalog stage ID>"
  terminal_outcome_mapping_version: "<signed mapping version>"
  profile_id: "<signed equal-budget analytic profile>"
  budget_id: "<signed budget ledger ID>"
  starting_state_digest: "sha256:<frozen allowed start state>"
  seed: "<unsigned deterministic seed>"
  seed_derivation_version: "<frozen derivation ID>"
  prng_algorithm_id: "<frozen PRNG ID>"
  crit_deck_position: "<signed fixed position or family ID>"
  map_key: "<admitted MapKey>"
  map_grammar_version: "<frozen version>"
  module_catalog_version: "<frozen version>"
  map_constraint_version: "<frozen version>"
  map_plan_digest: "sha256:<admitted immutable MapPlan>"
  wave_grammar_version: "<frozen version>"
  encounter_catalog_version: "<frozen version>"
  encounter_plan_id: "<admitted immutable plan ID>"
  wave_plan_digest: "sha256:<admitted immutable WavePlan>"
  wave_pressure_id: "<signed low|median|high or named pressure cell>"
  input_policy_id: "<declared or adversarial policy>"
  input_tape_id: "<immutable normalized tape ID>"
  input_tape_digest: "sha256:<canonical tape>"
  required_checkpoint_schedule_id: "<frozen tick/phase schedule>"
  terminal_tick_ceiling: "<signed finite integer>"
  observer_mode_id: "baseline|observer-a|observer-b|disabled"
  render_cadence_hz: "30|60|120"
  reduced_motion: "true|false"
  audio_caption_mode: "<signed local observer mode>"
  renderer_observer_id: "<signed renderer/observer identity>"
```

The tuple intentionally includes map, wave, serializer, and replay versions. `map_key`, `map_plan_digest`, `wave_plan_digest`, and all version fields are admission facts—not values an observer may regenerate, replace, or infer after tick 0. `simulation_tick_rate_hz` is always 60; 30/60/120 Hz denotes only the observer/render harness cadence.

## Required deterministic execution and records

All records below are **PROPOSED / UNVERIFIED**. They are JSONL, canonical-key serialized, include `schema_version`, `record_type`, `run_id`, `candidate_tuple_digest`, `sequence`, and `record_checksum`, and are append-only. A run cannot be treated as complete until it has exactly one start, at least the declared checkpoints, exactly one terminal-or-stop record, and the required replay-comparison records.

| Record type | Exact minimum fields | Producer boundary |
| --- | --- | --- |
| `manifest` | runner/replay/serializer schema versions; canonical tuple-list digest; signed matrix ID and digest; expected tuple count; exact source hashes; command; `measurement_status: "BLOCKED"` or `"INCOMPLETE"`; `gate_verdict: "NOT_PASSED"` | Runner shell only; it cannot synthesize an unsigned matrix. |
| `run_started` | full immutable `candidate_tuple`; candidate digest; resolved start-state digest; admitted `MapPlan`/`WavePlan` digests and IDs; tick `0`; input cursor `0`; RNG/deck cursor; observer configuration | Deterministic core admission before tick 0. |
| `input_accepted` | normalized input ID; tape ordinal; intended tick; accepted/rejected status and reason; post-admission input cursor; no raw device coordinate, target ID, or wall-clock field | Input adapter publishes facts after deterministic normalization. |
| `rule_event` | rule-issued event ID; `simTick`; sequence; event/schema version; source/target; base/final resolved damage when applicable; critical provenance; cooldown previous/ready tick when applicable; plan reference | Detached observer copy after rule resolution; no observer writes to rules. |
| `checkpoint` | checkpoint ordinal/reason; tick; canonical-state digest; `MapPlan`/`WavePlan` digests; rules/catalog/serializer/replay versions; input cursor; RNG/deck cursors; wave cursor; sorted live-entity digest; resolved-event-ID digest; offer/persistent-total digest; terminal flag | Immediately after canonical checkpoint, before observer projection. |
| `run_terminal` | terminal status and mapped outcome; terminal tick; terminal canonical digest; target spawn/kill IDs and ticks; route progress; health/Gate totals; full input digest; event digest; all required metric attribution keys; completion status | Deterministic core only. A nonterminal ceiling stop is not a terminal outcome. |
| `run_stopped` | stop code; signed ceiling; last checkpoint; first missing required fact; `measurement_status: "INCOMPLETE"`; `gate_verdict: "NOT_PASSED"` | Runner only; used instead of inventing `VICTORY`, `LOSS`, TTK, or zero-valued metrics. |
| `replay_comparison` | baseline run ID; comparison run ID; both tuple digests; mode delta; each checkpoint digest pair; terminal digest pair; equality boolean; first divergence tick/path/values when unequal | Comparator reads emitted canonical records; it never repairs or reruns a result. |
| `summary` | expected/started/terminal/invalid/missing counts; full tuple-list digest; first-falsifier references; checksum results; explicit `measurement_status`; explicit `gate_verdict: "NOT_PASSED"` until independent gate review | QA evidence packaging only. |

`timestamp_utc` MAY be retained for provenance but **MUST NOT** be part of `candidate_tuple_digest`, canonical-state digest, comparison equality, PRNG input, or gate arithmetic.

## Checkpoint and replay comparison contract

**PROPOSED / UNVERIFIED method:** execute the baseline once, repeat the exact baseline once, then execute the same candidate tuple under render cadence 30 Hz, 60 Hz, and 120 Hz for each required observer mode: `baseline`, `observer-a`, `observer-b`, and `disabled`. Standard/reduced-motion and signed local audio/caption variants belong to the observer configuration only. This is an observer matrix, not a change to the 60 Hz core.

The frozen checkpoint schedule **MUST** include tick 0, every signed phase/wave boundary, every map/wave admission and fallback decision, every target spawn and terminal kill, every accepted/rejected cooldown C-1/C/C+1 action, every relief/card-exhaustion decision, every offer/choice boundary, the terminal tick, and a fixed periodic interval stated in `required_checkpoint_schedule_id`.

For every paired replay, these fields **MUST** be byte-identical at every same checkpoint: canonical-state digest, rules/catalog/serializer/replay versions, map and wave digests, input cursor, RNG/deck cursors, wave cursor, resolved-event-ID digest, health/Gate values, accepted normalized input stream, offers, persistent totals, terminal status, and terminal digest. Only explicitly tagged detached observer playback/timestamp fields may differ. A comparison must report both equality and the first divergent field; a terminal digest match does not excuse an earlier checkpoint mismatch.

## Feasibility boundaries: source and test scope

| Boundary — all **PROPOSED / UNVERIFIED** except the cited current surface | Future owner | Allowed responsibility | Required focused test/evidence | Explicit exclusion / blocker |
| --- | --- | --- | --- | --- |
| Current bounded runner: `scripts/run-g2-archetype-sweep.mjs` and `tests/g2-archetype-sweep-cli.test.mjs` | Existing implementation | Current 360-tick Cinder Span diagnostic only: repeated final digest, captured snapshot events, checksums, 5 × 3 tuple integrity. | `node --test tests/g2-archetype-sweep-cli.test.mjs` validates the bounded package only. | It does not admit immutable map/wave plans, capture full-route terminal outcomes, produce checkpoints, exercise observer/cadence modes, or calculate full G2 metrics. It must not be relabeled as the full-route runner. |
| `defense-run-simulation.js` | game-programmer | Continue to own fixed 60 Hz advancement and authoritative run facts. Future runner may consume only `createDefenseRun`, `queueInput`, `advanceDefenseRun`, `getRunSnapshot`, `getRunDigest`, and `isTerminalRun` or a separately signed equivalent. | Focused deterministic API/checkpoint fixtures for exact tuple cells and first divergence only. | No renderer, telemetry, audio, caption, or harness cadence may write run state, reroll RNG, or choose a replacement plan. |
| `defense-catalog.js` | game-programmer + game-designer signature | Supply frozen `RULES_VERSION`, 60 Hz, and catalog-authorized stage/profile/plan references. | Exact catalog serialization/hash and version-admission test. | No catalog/balance/reward/idle/monetization tuning is authorized by this contract. |
| Authorized headless full-route runner module and serializer | game-programmer + game-qa | Implement only a headless 60 Hz orchestration/recording boundary that consumes the workspace-root expected-tuple register and canonical QA seed/tape registers, validates their cross-register digests before admission, uses stable serialization, and stops on first divergence. | Focused runner-contract proof is expected at `tests/g2-full-route-runner.test.mjs`, including rejection of mismatched tuple-to-QA seed/tape digests. No passing test or implemented module is asserted by this contract. | Implementation is authorized, but candidate selection, execution, corpus collection, measurement, and gate admission remain blocked. The current embedded tuple-register seed/input digest mismatch MUST fail closed as `INCOMPLETE / NOT_PASSED`; no module path or implementation evidence is committed here. |
| Proposed QA corpus and independent review | game-qa | Hold signed matrix/tapes and validate expected-record completeness without mutating the runner. | Proposed JSONL checksum, tuple uniqueness, coverage, and first-falsifier review against the frozen manifest. | It cannot declare G2 pass or derive missing definitions from diagnostic data. |

## Stop conditions and non-results

The runner **MUST stop the candidate and preserve `run_stopped` plus first-divergence evidence** when any condition below occurs. It **MUST NOT** substitute a seed, map, wave, input tape, profile, observer, or fallback result; retrying is allowed only as the separately recorded exact replay comparison.

1. The signed matrix, assessment unit, terminal mapping, TTK cohort mapping, combo comparator, or tuple version is absent, ambiguous, or mismatched at admission. This includes the current expected-tuple register embedded seed/input digests failing to equal the canonical QA seed/tape register digests; the runner MUST fail closed before selecting or executing a candidate and record only the applicable `INCOMPLETE / NOT_PASSED` blocked result.
2. A MapPlan/WavePlan is absent, differs from the candidate digest/version, regenerates after tick 0, or requires an unlogged fallback.
3. Any candidate hits its signed finite terminal tick ceiling without a mapped terminal result. Record `INCOMPLETE`; do not compute a win/loss or terminal TTK.
4. A required checkpoint, event field, target spawn/kill pair, cooldown boundary, or comparator member is missing. The affected metric is `NOT_OBSERVED`, never zero.
5. Any baseline/repeat, 30/60/120 Hz, or observer A/B/disabled comparison first diverges in a required canonical field.
6. A serializer/replay/schema/rules/catalog/map/wave version mismatch prevents a byte-valid comparison.
7. A forbidden nondeterministic input is observed: wall-clock, locale, network/provider response, async-asset readiness, raw device aim/target data, observer callback, or presentation setting influencing rules.
8. A record checksum, source hash, tuple digest, expected-tuple count, or record ordering/completeness check fails.

Any stop condition invalidates that candidate for G2 measurement. It is an engineering/coverage blocker, not a balance verdict and not permission to tune gameplay.

## Required sources

- `qa/g2-canonical-preregistration.md` — controlling canonical-register paths, bound digests, implementation-only authorization, missing admission decisions, and frozen calculation rules; it states G2 remains `NOT MEASURED / NOT PASSED` until reconciliation, signatures, corpus, and independent review exist.
- `scripts/run-g2-archetype-sweep.mjs` — current bounded 360-tick implementation and explicit unavailable-metric declarations.
- `tests/g2-archetype-sweep-cli.test.mjs` — current test boundary for the 17-record bounded diagnostic package.
- `qa/expanded-stage-test-plan.md` — 60 Hz fixed-tick architecture, A01 observer/cadence matrix, A04/A05/A06 full coverage, and local/PR/scheduled/release evidence split.
- `engineering/architecture-contract.md` — deterministic-core ownership, immutable plan admission, post-checkpoint detached observers, proposed checkpoint fields, and prohibited reverse edges.
- `qa/gate-measurements.md` — authoritative G2 state and the explicit absence of full-route/TTK/combo/cooldown-boundary evidence.
- `production/gate-reviews/stage-2-deterministic-measurement.md` — Stage 2 `REDO`, measurement-only scope, and the bounded diagnostic’s integrity-only limit.

## Gate conclusion

This document neither attests nor selects an implemented runner, fixture, test result, candidate corpus, or measurement result. The director authorizes implementation only of the headless fail-closed runner boundary described above; that authorization is not authorization to admit, select, execute, collect, measure, or review a candidate corpus. Until the expected-tuple register's seed/input links reconcile with the canonical QA registers, the runner and fixture are implemented and attested, the finite corpus is collected, and an independent review validates it, **G2 remains `NOT MEASURED / NOT PASSED`** and Stage 2 remains `REDO`. G8 human-impression evidence remains a separate blocked requirement; release, deployment, and every player-facing/commercial change remain unauthorized.
