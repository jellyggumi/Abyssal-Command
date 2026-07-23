# Telemetry contract — local deterministic diagnostics

**Status:** future instrumentation contract. No records, exports, cohorts, measurements, or gates currently exist.

## Non-negotiable boundary

Telemetry is a renderer- and rules-neutral observer. It receives detached resolved events, checkpoints, normalized-input timing, and browser performance samples; it has no rules/campaign mutation API and no right to read or advance RNG. Collection, analysis, and explicit export are local only: no `fetch`, XHR, beacon, WebSocket, analytics SDK, account, cloud sync, remote cohort assignment, or gameplay-time provider call.

```yaml
telemetry:
  schema: abyssal.telemetry
  schema_version: 1
  scope: offline-local-diagnostic
  transport: forbidden
  persistent_default: false
  export: explicit_local_user_or_facilitator_action
  correlation_ids: [fresh_local_session_id, fresh_local_run_id]
  prohibited_fields: [name, contact, account_id, IP, advertising_id, fingerprint, exact_location, raw_gesture_path, voice_recording, free_text, credential]
  observer_state_effect_on_rules: none
  current_status: not_implemented
```

## Envelope and retention

```yaml
record_envelope:
  required: [schemaVersion, seq, event, runId, sessionId, buildId, simTick, monotonicMs, observer, payload]
  simTick: integer_or_null_only_before_admission
  sequence: monotonically_increasing_per_session
  deterministic_fields: [rulesVersion, serializerVersion, grammarVersion, catalogDigest, mapDigest, wavePlanDigest, canonicalStateHash, rngCursor, inputCursor]
  export_manifest: [schemaVersion, fieldDictionaryVersion, redactionProfile, buildId, fixtureId, eventCount, droppedCount, checksum]
  default_retention: bounded_in_memory_ring
  target_default_max_records: 4096
  target_hard_max_records: 16384
```

The recorder de-duplicates repeat-render copies within a tick using event identity and stable payload fields. It records dropped count, does not backpressure simulation, and may omit unavailable browser fields as `null`. Raw gesture paths, text, or personal identity are never substituted to improve diagnosis.

## Proposed event catalog

| Event | Producer | Required payload | Purpose |
|---|---|---|---|
| `abyssal.session.started` | bootstrap observer | platform/viewport/input class, reduced-motion, sound/storage mode | fixture segmentation only |
| `abyssal.input.captured` | input observer | input ID, action kind, normalized vector/slot, monotonic time | start control chain |
| `abyssal.input.admitted` | deterministic core | input ID, admitted tick, normalized action, reject reason? | authoritative admission |
| `abyssal.map.plan.committed` | deterministic core | `MapKey`, map digest, validation result, selected module trace reference | PCG replay identity |
| `abyssal.wave.plan.committed` | deterministic core | grammar/catalog digest, selected cards/anchors, scheduler state hash | encounter replay identity |
| `abyssal.sim.checkpointed` | deterministic core | canonical hash, RNG/deck cursor, input cursor, map/wave digest | first divergence localization |
| `abyssal.combat.resolved` | deterministic core | resolution ID, source/target, base/final value, crit flag, cursor, health before/after | health/crit truth |
| `abyssal.cooldown.changed` | deterministic core | ability, prior/ready tick, state | cooldown truth |
| `abyssal.encounter.started/completed` | deterministic core | descriptor, duration ticks, result, damage taken, event count | wave pacing, not enjoyment inference |
| `abyssal.feedback.presented` | observer | source event ID, snapshot revision, channels, static cue, mode, result | observer-to-rule join |
| `abyssal.audio.cue.presented` | observer | source event ID?, cue ID, bus/mode, fallback/result | mute/fallback audit |
| `abyssal.narration.cue.presented` | observer | objective/result link, cue ID, caption availability, result | W-01…W-05 readability audit |
| `abyssal.choice.offered/committed` | core | offer/option IDs/order/hash, summaries, input ID, before/after hash | exactly-once choice integrity |
| `abyssal.idle.calculated/claimed` | core | basis, valid elapsed, award, before/after, idempotency key, result | bounded local receipt |
| `abyssal.frame.sampled` | observer | frame interval, sim steps, backlog, update/render time, sample rate | performance pressure |
| `abyssal.export.created/deleted` | export controller | schema, count, redaction profile, result | explicit local data action |

## Measurement rules

```yaml
future_measurement_contract:
  pcg_corpus:
    minimum_keys: 64
    repetitions_per_key: 3
    checks: [map_bytes, map_digest, validation_report, selection_trace, checkpoints]
    evidence: qa/replay-corpus/map-plan-replay-report.json
  observer_differential:
    dimensions: [30hz, 60hz, 120hz, reduced_motion, muted, missing_audio, alternate_renderer, export_on_off]
    equality: [canonical_hash, rng_cursor, input_cursor, map_digest, wave_digest, damage, cooldown, terminal, persistent_totals]
    evidence: qa/replay-corpus/observer-differential-report.json
  performance:
    evidence: qa/performance/input-chain-trace.json
  privacy_network_off:
    evidence: qa/ops/network-disabled-export-trace.json
  all_status: future_target_not_measured
```

A trace can establish a fact about that fixture, not player comprehension, enjoyment, boredom, retention, or fairness. Moderated probes are required for those claims, must use a separate consent/code sheet, and must not join identity into gameplay exports.

## Export, deletion, and incident rules

Export only follows an explicit local action. It includes schema and redaction manifest, event count, dropped count, checksum, fixture/build/version metadata, and no network upload. Deletion is local and auditable only as an action/result. A schema mismatch, missing required join, duplicate local run ID, unexpected persistent storage, or network dependency invalidates the measurement; it is not a partial pass.

## Gate evidence status

| Surface | Required future path | Current status |
|---|---|---|
| G2 health/crit/feedback correspondence | `qa/telemetry/feedback-event-join.json` | NOT-RUN |
| G4 input/performance/replay | `qa/performance/input-chain-trace.json` | NOT-RUN |
| G6 choice integrity | `qa/telemetry/choice-commit-chain.json` | NOT-RUN |
| G7 local idle/no-network | `qa/ops/idle-clock-storage-matrix.json` | NOT-RUN |
| G8 PCG/wave variety/replay | `qa/replay-corpus/map-plan-replay-report.json` | NOT-RUN |

**G1–G8 remain UNPASSED.**

## Sources

`research/telemetry-playtest-contract.md`, `research/qa-measurement-protocol.md`, `research/pcg-map-grammar.md`, `research/wave-encounter-composition.md`, `research/combat-systems-balance.md`, and current contract `docs/abyssal-command-defense-survivor-design.md`.
