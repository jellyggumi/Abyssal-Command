# Release readiness — Stage 3 evidence admission

**Status:** **BLOCKED — do not deploy.** This is a prospective evidence checklist, not a deployment authorization. G1–G8 are `NOT MEASURED / NOT PASSED`; all unmeasured numbers and paths are targets/proposals only.

## Decision rule

An evidence-complete package may inform a separately authorized release decision; this document never grants that authorization. A document, target, browser/CI pass, successful build, or video alone is not a gate pass. Any missing, incomplete, mismatched, failed, unreviewed, or network-dependent evidence is **BLOCKED**.

```yaml
release_tuple_required:
  buildId: immutable build identifier
  sourceRevision: full lowercase 40-character candidate SHA
  rulesVersion: exact candidate value
  catalogDigest: exact candidate value
  mapGrammarVersion: exact candidate value
  waveGrammarVersion: exact candidate value
  serializerVersion: exact candidate value
  MapPlanReplayCorpusVersion: exact candidate value
  assetManifestVersion: exact candidate value
  assetManifestHash: exact candidate value
  targetDeviceBrowserViewport: named device, browser/version, viewport, and mode
  fixtureIds: exact replay/playtest/capture fixture identifiers
  evidenceReportHashes: hash of every required evidence report
  independentReviewer: name, role, timestamp, and non-author relationship
  current_status: absent
```

## G1–G8 admission matrix

| Gate | Owner | Verification method | Required evidence path | Current status and blocker |
|---|---|---|---|---|
| G1 — canon/world | Narrative owner + Game QA | Candidate content/W-01…W-05/Stage-10 audit with independent tuple reconciliation. | `qa/evidence/gates/G1-narrative-canon-audit.json`; `qa/narrative/stage-world-linkage-audit.json` | `NOT MEASURED / NOT PASSED`; final inventory and audit absent. |
| G2 — rules/balance | Systems owner + Game QA | Complete approved full-G2 preregistration and paired equal-budget full-route/matchup sweep with TTK, combo-comparator, EV, cooldown-share, coverage, failure rows, and threshold decision. | `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` | `NOT MEASURED / NOT PASSED`; canonical JSONL exists and is integrity-valid for the bounded 5-profile × 3-seed / 360-tick Cinder Span diagnostic. XR-13/XR-14 are resolved for that observation surface, but full-G2 preregistration and paired full-route/matchup, TTK, combo, coverage, and threshold evidence remain incomplete; release is `BLOCKED — do not deploy`. |
| G3 — diversity | Systems/design owner + Game QA | Five-archetype matched-seed/card rotation plus moderated outcomes; independent stratified review. | `qa/evidence/gates/G3-archetype-rotation-and-playtest.jsonl` | `NOT MEASURED / NOT PASSED`; fixture corpus and controlled session data absent. |
| G4 — feedback/readability | Feedback/accessibility owner + Game QA | Standard/reduced-motion/muted/missing-audio/fallback captures, latency trace, counterbalanced readability/immersion study, and defect triage. | `qa/evidence/gates/G4-presentation-readability-and-playtest.json`; `qa/accessibility/control-and-feedback-audit.json`; `qa/accessibility/audio-vfx-fallback-capture.json`; `qa/replay-corpus/audio-observer-differential.json` | `NOT MEASURED / NOT PASSED`; captures, study, and triage absent. |
| G5 — fairness/no-commerce | Progression/PM owner + Game QA | No-paid-path verification plus reward/idle/property and 10/20-session parity evidence. | `qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl` | `NOT MEASURED / NOT PASSED`; account fixtures, idle implementation, and export absent. |
| G6 — ops/performance/telemetry | Performance/release owner + Game QA | Named-device/browser/viewport 90-second and 30-minute traces; tick/backlog/input/memory, local export/delete, network-disabled, and recovery verification. | `qa/evidence/gates/G6-ops-perf-and-local-telemetry.json`; `qa/performance/{tick-backlog-trace,input-chain-trace,frame-samples,presentation-delta,allocation-soak,vfx-density-audit,audio-cue-audit}.json`; `qa/accessibility/flash-analysis.json`; `qa/telemetry/choice-commit-chain.json`; `qa/ops/network-disabled-export-trace.json`; `qa/ops/rollback-recovery-report.json` | `NOT MEASURED / NOT PASSED`; target-device trace, soak, no-network/export-delete, and recovery evidence absent. |
| G7 — core loop | Design/playtest owner + Game QA | Pinned 30–180-second fixture with >=3 actions, >=1 reward, result/return trace, and preregistered voluntary-repeat result. | `qa/evidence/gates/G7-loop-trace-and-repeat-study.jsonl` | `NOT MEASURED / NOT PASSED`; implementation trace, fixture, and participant repeat data absent. |
| G8 — novelty | Narrative/PCG owner + Game QA | Five-comparable ledger plus fixed-seed implemented slice and QA impression session. | `qa/evidence/gates/G8-novelty-comparison-and-impression.json` | `NOT MEASURED / NOT PASSED`; current artifact says no human impression session occurred and cannot satisfy G8. |

## Supplemental Stage 3 admission records

| Record | Owner | Verification method | Required evidence path | Blocker |
|---|---|---|---|---|
| Pinned tuple and independent review | Release owner + independent reviewer | Compare every evidence header/hash against one immutable tuple; reviewer is neither candidate author nor evidence author. | `ops/release-records/<buildId>/tuple-and-independent-review.json` | Any missing/mutable tuple value, report hash/header/device/fixture mismatch, self-review, unsigned review, or evidence from another candidate. |
| Asset provenance admission | Technical-art/audio owner + rights reviewer | Validate final SHA-256, decoded measurements, content-addressed same-origin path, fallback, sanitized provenance, terms URL/date, rights decision, and compiled-output provider/secret/remote-path scan. | `qa/resource-audit/resource-manifest-validation.json`; `qa/resource-audit/media-measurements.json`; `qa/resource-audit/runtime-provider-scan.json` | Missing provenance/rights/hash/measurement/fallback; mutable/remote bytes; provider host/SDK/token/private URL/raw response; or unreviewed replacement. gti remains dry-run only; ppgen lacks a compatible provider; Blender inspection timed out; ElevenLabs credentials/rights are unavailable; Vox lacks an approved beat map. |
| Browser accessibility/performance proof | Accessibility + performance owners + Game QA | Produce browser proof for the same candidate on named device/browser/viewport, including keyboard/focus, reduced-motion/muted fallback, frame/input/backlog traces. CI viewport output is supplemental only. | `qa/browser-proof/<buildId>/accessibility-performance-browser-proof.json`; linked G4/G6 reports | Missing/wrong-tuple proof, absent named device/browser/viewport, focus/fallback failure, or CI-only proof presented as target-device evidence. |
| Local playable-video proof | QA capture owner + accessibility reviewer | Record local packaged-candidate playback from pinned fixture through terminal result; retain SHA-256, tuple metadata, device/browser/viewport/mode, and caption/fallback state. Video proves playback only. | `qa/browser-proof/<buildId>/local-playable-video-proof.json`; `qa/browser-proof/<buildId>/local-playable-video.webm` | Recording/metadata/hash/fixture/fallback state absent, wrong/non-local candidate, or treating video as a gate/rights/accessibility substitute. No proof exists now. |
| GitHub Pages prerequisites | Release operator + independent reviewer | Verify externally supplied repository/workflow settings, immutable artifact chain, deployment permissions/environment, direct `page_url` output, and receipts for candidate SHA. This workspace contains no workflow receipt or Pages configuration. | `ops/release-records/<buildId>/github-pages-prerequisites.json`; later `results/{resolve_revision,package_pages,artifact_smoke,deploy_pages,deployed_smoke,release_receipt}.json` | Missing workflow/config/permissions/environment/receipt, guessed URL, artifact/SHA mismatch, or an attempt to deploy from this checklist. |
| Rollback readiness | Release operator + QA + independent reviewer | Select prior known-good full SHA with its complete tuple; validate restored tuple offline, run scope-affected evidence, and compare exact release hashes before recording recovery. | `qa/ops/rollback-recovery-report.json`; linked `qa/resource-audit/runtime-provider-scan.json`, `qa/replay-corpus/{map-plan-replay-report,observer-differential-report}.json`, `qa/performance/input-chain-trace.json`, `qa/accessibility/audio-vfx-fallback-capture.json`, `qa/ops/network-disabled-export-trace.json` | No qualifying prior tuple, missing recovery report, failed affected evidence, hash mismatch, or treating an app load as recovery. Follow `ops/rollback-runbook.md`; recovery changes no G1–G8 state. |

### Blocker values

`TARGET`/`PROPOSED` means plan only; `MISSING` means the named record is absent; `INCOMPLETE` means an artifact explicitly falls short; `TUPLE_MISMATCH` means any candidate/header/hash/device/fixture differs; `FAILED` means an exclusion, threshold, proof, or recovery requirement failed; and `UNREVIEWED` means independent review is absent or invalid. **Every value means `BLOCKED — do not deploy`.** Only a future `EVIDENCE-COMPLETE` review can inform a separate authorization; it is not authorization itself.

## Mandatory exclusion checks

```yaml
must_be_absent:
  - runtime_ElevenLabs_or_other_provider_network_call
  - browser_credentials_or_private_urls
  - account_commerce_ads_cloud_sync_multiplayer
  - remote_telemetry_or_remote_experiment_assignment
  - manual_aim_target_selection_tactical_queue
  - observer_write_to_rules_campaign_rng_input_or_plan
  - background_combat_or_idle_stage_boss_companion_completion
  - Stage_11_or_post_Stage_10_campaign_continuation
  - color_sound_motion_or_haptic_only_essential_meaning
```

## Evidence review order

1. Confirm the full tuple, evidence report hashes, and independent-review separation before reading results.
2. Confirm G2’s canonical `.jsonl`, G3 rotation, G5 fairness, G7 loop, and G8 human-impression evidence; reject the current G2 integrity receipt and G8 incomplete artifact as gate substitutes.
3. Confirm G1 canon/world and Stage-10 terminal evidence against the same tuple.
4. Confirm G4 capture/study/fallback results and browser keyboard/focus proof under standard, reduced-motion, muted, missing-audio, and fallback-renderer modes.
5. Confirm G6 named-device/browser/viewport performance, input, memory, local export/delete, no-network, and local-playable-video records. A CI browser result or video is not a substitute.
6. Confirm asset provenance/right/fallback admission and the compiled-output no-provider/secret/remote-path scan.
7. Confirm GitHub Pages prerequisite and rollback-recovery records without guessing a URL or treating the checklist as deployment permission.
8. Record the only current verdict: **BLOCKED — do not deploy.**

## Current disposition

```yaml
stage_3_release_disposition:
  state: BLOCKED_do_not_deploy
  gates_G1_to_G8: NOT_MEASURED_NOT_PASSED
  G2: canonical_jsonl_integrity_valid_bounded_diagnostic_not_measured_not_passed
  G8: no_human_impression_session_not_passed
  release_authorization: this_document_does_not_authorize_deployment
  current_evidence: [G2_canonical_bounded_diagnostic, G2_integrity_receipt, G8_incomplete_novelty_artifact]
  absent_prerequisites: [pinned_tuple, independent_review, asset_admission, browser_proof, local_playable_video, github_pages_receipts, rollback_recovery]
  no_claims: [player_comprehension, performance, asset_rights, provider_usage, gate_pass, release_readiness]
```

## References

`engineering/architecture-contract.md`, `engineering/resource-manifest.md`, `engineering/perf-budget.md`, `engineering/movement-optimization.md`, `ops/telemetry-contract.md`, `ops/rollback-runbook.md`; research sources `pcg-map-grammar.md`, `wave-encounter-composition.md`, `combat-systems-balance.md`, `vfx-hud-feedback.md`, `controls-accessibility.md`, `audio-narration-direction.md`, `elevenlabs-integration.md`, `narrative-stage-presentation.md`, `telemetry-playtest-contract.md`; current contract `docs/abyssal-command-defense-survivor-design.md`.
