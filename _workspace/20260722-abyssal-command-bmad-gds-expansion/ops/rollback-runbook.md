# Rollback runbook — Stage 1 static release

**Status:** prospective operator runbook. No release artifact, deployment, rollback asset, or production measurement is present.

## Purpose and preconditions

Use this runbook only after a static build candidate exists. The operator restores the last known-good static manifest/revision without corrupting local campaign data or converting a presentation/resource failure into a rules change. Required inputs are a pinned build ID, rules/catalog/grammar/serializer versions, resource manifest hashes, the prior known-good release record, and a local offline validation fixture.

```yaml
rollback_invariants:
  preserve: [defense_catalog_authority, deterministic_60hz, local_campaign_data, Stage_10_ending, movement_first_auto_combat, W-01_to_W-05_labels]
  never_do: [delete_local_saves, regenerate_map_with_new_seed, mutate_campaign_to_match_presentation, invoke_ElevenLabs_at_runtime, upload_diagnostics]
  credentials: never_in_static_release_or_runbook
  current_status: not_run
```

## Trigger conditions

Roll back or block promotion on any of these reproducible conditions:

- canonical checkpoint, RNG/deck cursor, input cursor, `MapPlan`/wave-plan digest, resolved combat, cooldown, stage result, or persistent total differs across required observer/device replay dimensions;
- map/wave grammar admits an invalid plan, uses unlogged fallback seed, loses mandatory relief/safe lane, or changes authored objective/campaign semantics;
- provider hostname, token, secret, runtime SDK, remote audio URL, or required network request reaches the static bundle;
- asset provenance/rights/hash/caption/fallback validation is incomplete, audio failure removes semantic text, or a narration line claims unconfirmed rules;
- health/crit/cooldown/threat meaning becomes color-, sound-, motion-, or haptic-only;
- performance fixture shows tick loss, unrecorded backlog policy, or a target breach with a valid trace;
- telemetry exports transport data, collect prohibited identifiers, or lose required record links.

## Immediate containment

1. Stop promotion and label the candidate **BLOCKED**, not passed.
2. Preserve immutable evidence: build ID/hash, manifest hash, fixture ID, device/browser/viewport, rule/map/wave/asset versions, input tape, raw local export, first failing tick/sample, and redaction state.
3. Disable only optional presentation mapping when it is safely separable; keep visible static labels/status and simulation alive. Do not hot-patch rule values to compensate for an effect/audio defect.
4. For asset/provenance failure, remove the new cue from the approved manifest and select its reviewed static/procedural/silent fallback. Do not retry provider generation from the client.
5. For deterministic/core failure, restore the last known-good app plus matching rules/catalog/grammar and asset manifest as one pinned tuple. Do not mix a new grammar with an old replay corpus.

## Standard rollback paths

| Failure class | Restore | Validate before reopening | Escalate to |
|---|---|---|---|
| VFX/audio/narration only | prior asset manifest/path or authored fallback | normal/reduced/muted/missing-file observer differential; captions/status remain | presentation + accessibility owner |
| static bundle provider/secret surface | last clean build; revoke/rotate credential outside client if exposed | compiled-output provider/secret scan; offline load | security + audio operator |
| map grammar/wave schedule | matching prior grammar/catalog tuple and corpus | positive/negative corpus, phase checkpoints, safe-lane/relief audit | engineering + content owner |
| core determinism/input/persistence | matching prior application/rules/serializer tuple | fixed input replay, save/idle fault matrix, canonical hash | engineering + QA |
| telemetry/export privacy | disable diagnostic export surface only if rules unaffected | no-network export/delete trace, field/redaction audit | ops + privacy reviewer |
| performance | prior renderer/config/asset tuple or safe lower-density presentation fallback | target-device trace with tick backlog and input chain | performance + QA |

## Recovery validation

```yaml
required_recovery_evidence:
  static_bundle_scan: qa/resource-audit/runtime-provider-scan.json
  map_wave_corpus: qa/replay-corpus/map-plan-replay-report.json
  observer_replay: qa/replay-corpus/observer-differential-report.json
  input_trace: qa/performance/input-chain-trace.json
  fallback_capture: qa/accessibility/audio-vfx-fallback-capture.json
  network_off: qa/ops/network-disabled-export-trace.json
  save_idle: qa/ops/idle-clock-storage-matrix.json
  status: all_future_not_run
```

Validate the restored tuple offline, then compare exact released hashes/manifests. A recovery has not passed merely because the app loads. It passes only if required scope-specific evidence is recorded and independently reviewed; otherwise it remains **NOT-RUN/BLOCKED**.

## Escalation and records

Record incident ID, owner, decision time, impacted build tuple, action, old/new hashes, local evidence paths, save compatibility statement, and named reviewer. Never attach secret material or player-identifying data. Do not claim G1–G8 status changes from rollback completion.

## References

`engineering/architecture-contract.md`, `engineering/resource-manifest.md`, `engineering/perf-budget.md`, `ops/telemetry-contract.md`, `research/elevenlabs-integration.md`, `research/pcg-map-grammar.md`, `research/wave-encounter-composition.md`, and current contract `docs/abyssal-command-defense-survivor-design.md`.
