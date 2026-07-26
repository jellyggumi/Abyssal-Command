# Gate Measurements — T-pose Rigging and Animation

run-id: `20260726-tpose-rig-animation`  
measured by: QA (director-operated evidence review)  
measured at: 2026-07-26

## Scope

This is a focused Stage 3 resource/animation verification pass. It measures the 24 deployed runtime character GLBs for structural rig state and records whether a non-destructive, workspace-only T-pose candidate exists for the Dusk Warden. It does **not** substitute structural GLB facts for human immersion scoring or a live performance soak.

## Measurement inputs

| Check | Command / method | Result | Evidence |
|---|---|---|---|
| Runtime rig and clip contract | `node --test tests/character-rig-contract.test.mjs` | 24/24 pass; each tested runtime actor has a 24-joint skin and 11 named clips/tracks | `rig-contract-baseline.md` |
| T-pose structural audit | Direct GLB decode plus generated skeleton projections and Blender 5.1.2 rendered front/side frames | 1/24 passes the exact bilateral 12° threshold; 23/24 have A-pose or asymmetric arms | `../engineering/tpose-rig-audit.md`, `../engineering/tpose-rig-audit.json`, `../engineering/visual/` |
| Dusk Warden candidate feasibility | Source inspection of `scripts/build-world-content-pack.py:build_commander` and pipeline inspection of `scripts/rig-character-asset-blender.py` | BLOCKED; procedural source has no arms, hands, legs, or feet, and the pipeline fuses unrelated meshes before pose bake | `../engineering/dusk-warden-candidate-blocker.md`, `../engineering/dusk-warden-candidate-blocker.json` |
| Action clip coverage | Direct GLB audit of action library | 11 actual runtime clips/tracks per deployed character | `../engineering/tpose-rig-audit.json`, `../engineering/tpose-rig-audit.md` |

## G4 — Effects and animations give immersion

```yaml
status: FAIL
measured_value:
  median_immersion_score: not_measured
  effect_feedback_latency_ms: not_measured
  unresolved_S1_S2_readability_complaints: not_measured
structural_animation_evidence:
  deployed_action_clip_names: 11
  tpose_compatible_deployed_actors: 1
  tpose_incompatible_deployed_actors: 23
  dusk_warden_candidate: blocked_no_candidate_created
method: Structural audit only; no structured player scoring or latency probes were performed.
evidence:
  - ../engineering/tpose-rig-audit.md
  - ../engineering/tpose-rig-audit.json
  - ../engineering/dusk-warden-candidate-blocker.md
threshold: median immersion >= 4.0/5, effect feedback <= 100ms, zero unresolved S1/S2 readability complaints
reason: Missing required human-scored and latency evidence alone fails G4. The absent T-pose-compatible Dusk Warden candidate is an additional asset-production blocker.
```

## G6 — Game operations plan appropriately applied

```yaml
status: NOT_MEASURED_FAIL
measured_value:
  perf_p95_frame_ms: not_measured
  long_frame_rate: not_measured
  memory_30_min_soak: not_measured
  input_latency_ms: not_measured
  telemetry_contract_emission: not_measured
  rollback_runbook_tested: not_measured
  release_readiness_checklist: not_measured
method: Direct workspace prerequisite inventory; the structural asset audit does not measure G6 operation fields.
evidence:
  - g6-prerequisite-audit.md
  - ../engineering/tpose-rig-audit.md
threshold: telemetry, rollback, release readiness, and all performance limits defined in quality-gates.md G6
reason: The prerequisite inventory records 0/3 required G6 artifacts and 0/5 required runtime measurements. Missing evidence fails G6.
```

## G1 — Narrative consistency

```yaml
status: FAIL
measured_value:
  worldview_source_artifacts_present: 0
  required_worldview_source_artifacts: 1
  player_visible_content_trace_coverage: 0%
  unwaived_lore_violations: not_measured
method: Direct workspace prerequisite inventory and task-manifest scope review.
evidence:
  - g1-prerequisite-audit.md
threshold: 0 un-waived lore violations and 100% of shipped strings/effects/scenarios trace to design/worldview.md
reason: The run has no worldview source or trace audit. Missing evidence fails G1.
```

## Blocking result

No Stage 3 exit gate passes from this measurement. Required next evidence is a real T-pose Dusk Warden source mesh with independently owned lantern, blade, cape, and pedestal attachments; then a workspace-only rig/export candidate, exact pose and action audit, human immersion scoring, latency checks, and G6 ops/performance evidence.
