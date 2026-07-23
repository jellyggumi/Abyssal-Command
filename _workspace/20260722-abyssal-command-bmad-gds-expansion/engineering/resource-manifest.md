# Resource manifest — Stage 1 asset boundary

**Status:** prospective manifest contract; no asset generation, import, rights clearance, or runtime validation has occurred.

## Audience and action

Audio/VFX/narrative engineers and release operators use one manifest record per approved static resource. The contract prevents unreviewed media or provider credentials from entering the PWA and preserves readable fallbacks.

## Build-only ElevenLabs boundary

```yaml
external_generation:
  provider: ElevenLabs
  permitted_phase: private_build_ingestion_only
  runtime_network: forbidden
  runtime_sdk: forbidden
  runtime_credentials: forbidden
  static_delivery: same_origin_content_addressed_file
  secret_location: approved_private_worker_environment_or_secret_store
  prohibited_surfaces: [source_repository, committed_manifest, static_bundle, service_worker, browser_environment, browser_logs]
  release_precondition: per_asset_rights_and_provenance_approval
  current_status: not_run
```

The shipped client MUST contain no provider hostname/endpoint, SDK import, `fetch`/XHR/WebSocket, signed URL, iframe/worker bridge, secret/token, account ID, private URL, raw provider response, or retry path. A provider outage, rate limit, expired plan, missing cache, bad decode, mute, or absent file resolves to the mapped local procedural cue or silence while retaining caption/status text and all deterministic outcomes.

## Proposed public manifest schema

```yaml
asset_manifest:
  schema: abyssal.resource-manifest
  schema_version: 1
  current_status: target_not_implemented
  record_required: [assetId, cueId, category, runtimeEventMapping, path, outputSha256, bytes, codec, sampleRateHz, channels, durationMs, loudnessIntegratedLufs, truePeakDbtp, fallbackId, accessibilityFallback, provenance, rightsReview, version]
  provenance:
    required: [sourceClass, promptOrScriptId, sourceSha256, outputSha256, importedAt, approver]
    provider_fields_when_supplied: [provider, model, modelVersion, voiceId, providerJobReference, generatedAt]
    forbidden: [apiKey, token, accountId, privateUrl, rawResponse]
  rightsReview:
    required: [inputRightsAttestation, termsUrl, termsReviewDate, planOrLicenseContext, reviewer, decision]
    rejection_on_missing_field: true
```

For narration, `canonicalScriptId`, `canonicalScriptSha256`, Korean visible caption/transcript ID, and an exact semantic-match review are required. Narration cannot promise a hidden mechanic, future reward, timing window, or command absent from the authoritative event/catalog trace.

## Resource categories and fallbacks

| Category | Required event/state binding | Standard resource | Reduced-motion / mute / failure fallback |
|---|---|---|---|
| VFX health | confirmed player/W-03/elite-boss health snapshot | edge fill, number/icon, directional wedge | identical static fill, label, icon/pattern; no red wash/pulse |
| VFX critical | `combat.damage.resolved` with `crit=true` | bounded fracture-ring glyph | static ring plus `CRIT` text/icon; sound optional |
| VFX cooldown | confirmed cooldown state/ready tick | icon plus radial/segmented state | static segmented fill, numeric option, ready/not-ready shape |
| VFX threat/gate | confirmed hazard/Gate event | bounded world/edge telegraph | patterned/static boundary and status text |
| SFX | confirmed threat, damage, Bind/Extract, Domain, Gate, skill/boss state | local one-shot, bus-routed | semantic visual/caption remains; procedural cue or silence |
| narration | confirmed stage/objective/result/authorized resume summary | local preregistered voice | caption with speaker/status and static marker; silence permitted |
| music/ambience | presentation-state observer only | static local loop/stem | duck/stop/silence; never supplies timing or gameplay state |

Normal automatic-hit texture is lowest priority and may be coalesced, culled, or silent. No asset may be the sole source of health, crit, cooldown, threat, stage, objective, or result meaning. Do not use color/flash/motion alone; all essential resources name a static equivalent.

## Stage 3 resource-admission matrix

**Admission status:** NOT STARTED. This is a future intake contract, not a generated, imported, licensed, or runtime-loaded asset set. It does not add or select a fallback asset; existing local procedural, static, text, icon, and silence behavior remains governed by the current runtime. `gti --dry-run` is configuration-only and cannot satisfy an admission row.

Every future admission record is owned by the named discipline and must be reviewed before candidate generation or import. The record is rejected unless its canonical output path is same-origin and content-addressed, its output hash matches the bytes, its fallback resolves locally, and its required evidence is present. `outputSha256` means the full SHA-256; `<sha256-prefix>` is a deterministic prefix of that value and is never the only integrity field.

| Resource class | Canonical delivery and hash-manifest requirement | Rights / provenance requirement | Offline local-load requirement | Owner; validation method; required evidence path | Explicit current blocking condition |
|---|---|---|---|---|---|
| Sprites | `assets/images/sprites/<asset-id>.<sha256-prefix>.png` (RGBA PNG atlas), with a sidecar frame manifest. The approved record MUST bind `assetId`, revision, `outputSha256`, bytes, atlas dimensions, action/direction map, frame rects, pivots, source/baked-frame hashes, and fallback ID. | Original-source attestation, brief hash/revision, generator/provider fields only when actually used, terms snapshot, input/output rights decision, and human art/technical reviewer are required. | A static same-origin PNG and sidecar map MUST load from the pinned local manifest without a provider, network request, or filename inference; the renderer-facing fallback remains independently local. | **Owner:** art pipeline lead. **Method:** decode atlas; validate bounds, alpha/matte, exact declared directions/actions, pivots, and output hash. **Evidence:** `qa/resource-audit/sprite-atlas-validation.json`. | `ppgen` has no compatible configured provider: its observed allowlist rejects `god-tibo-imagen`. No sprite request may be made until a supported provider, its terms/rights, cost approval, and compatible brief are approved. |
| Effects | `assets/images/vfx/<asset-id>.<sha256-prefix>.png` (RGBA PNG atlas/flipbook), with a sidecar timeline/semantic manifest. The approved record MUST bind `assetId`, revision, `outputSha256`, bytes, source revision, frame range, semantic rank, observed event binding, static equivalent, and fallback ID. | Original art/bake-source attestation, `.blend` hash and render/bake metadata when Blender-derived, source-frame hashes, terms snapshot if a provider is actually used, rights decision, and art/technical/accessibility reviews are required. | The atlas and semantic sidecar MUST resolve by pinned local asset ID from same-origin storage; missing/decode-failed art MUST not cause a network request or presentation-to-simulation path. | **Owner:** VFX technical artist. **Method:** decode frame count/dimensions/alpha; compare source and output hashes; inspect flash, coverage, semantic-rank, static-equivalent, and observer-replay capture. **Evidence:** `qa/resource-audit/vfx-atlas-validation.json` and `qa/accessibility/audio-vfx-fallback-capture.json`. | Blender object-summary inspection timed out; no scene, source hash, or bake plan is established. No Blender preview, bake, or effect import may begin until the scene is inspected and its pre-production record is approved. |
| Audio (SFX / ambience / music) | `assets/audio/<cue-id>.<sha256-prefix>.mp3` (reviewed final MP3). The approved record MUST bind `assetId`, `cueId`, category, `outputSha256`, bytes, codec, sample rate, channels, duration, loudness, true peak, local fallback ID, provenance, rights review, and version. | Original prompt/source attestation, sanitized private request hash, actual provider/model fields only if used, terms snapshot/date, plan or license context, attribution decision, moderation decision, and human rights/audio review are required. | The file MUST be same-origin, content-addressed, included only after manifest validation, and playable offline from a pinned local map; mute, missing, decode-failure, or cache absence must not contact a provider. | **Owner:** audio engineer. **Method:** decode and measure media; verify bytes against SHA-256; scan built output for provider/secret surfaces; replay normal/missing/decode-failure/mute variants. **Evidence:** `qa/resource-audit/media-measurements.json`, `qa/resource-audit/runtime-provider-scan.json`, and `qa/replay-corpus/audio-observer-differential.json`. | ElevenLabs credentials and a reviewed rights/terms basis are unavailable. No API request, candidate generation, or static-audio import is authorized. |
| Narration | `assets/audio/narration.<beat-id>.<sha256-prefix>.mp3` (reviewed final MP3), with local caption/transcript resources. The approved record MUST include all audio fields plus canonical script ID/SHA-256, language, speaker label, caption ID, transcript ID, semantic-match decision, and fallback ID. | The canonical script must be allowlisted; input-rights attestation, voice authorization/consent where applicable, actual provider/model/voice fields only when used, terms snapshot, attribution decision, moderation, and human narrative/rights review are required. | Voice, caption, and transcript MUST resolve locally from the pinned manifest before playback; caption-first delivery remains readable with audio absent, muted, missing, or undecodable and never creates a provider request. | **Owner:** narrative director with audio engineer. **Method:** compare script/caption/transcript hashes and semantic meaning; perform Korean intelligibility and accessibility review; run offline/missing/mute observer-differential replay. **Evidence:** `qa/resource-audit/narration-semantic-review.json`, `qa/resource-audit/media-measurements.json`, and `qa/accessibility/audio-vfx-fallback-capture.json`. | ElevenLabs credentials, voice authorization, and per-asset rights/terms review are unavailable. No narration generation, voice selection, or import is authorized. |
| Cinematic release assets | `assets/video/release/<release-id>.<sha256-prefix>.mp4` (release-only MP4), with `<release-id>.<sha256-prefix>.vtt` captions. Each approved record MUST bind release ID, revision, both output hashes, bytes, beat-map hash, source-footage/art register, caption hash, rights decision, and explicit `runtimeDisposition: marketing-only`. | Approved marketing brief, source-footage/art provenance, narration and music rights plan, terms snapshot for any actual provider, visual/caption/rights reviewer decisions, and release-owner approval are required. | The video and captions are optional same-origin release files only; they MUST NOT be in the gameplay manifest, service-worker install-critical path, simulation, or gate evidence. A release page may omit them without affecting local game load. | **Owner:** release producer. **Method:** verify content-addressed files and caption timing; compare all source claims with approved capture/catalog evidence; audit rights register and gameplay-bundle exclusion. **Evidence:** `qa/resource-audit/release-cinematic-validation.json` and `qa/resource-audit/gameplay-bundle-exclusion.json`. | Vox Director requires an approved beat map, style board, narration plan, music/rights plan, and spend authorization before any cloud keyframe, motion, or audio step. None is approved. |

### Future approval sequence — required before generation or import

This sequence is a future control path. A later implementation may admit an authorized asset only after each applicable record is approved; a failure or missing record stops the sequence and leaves the current runtime unchanged.

| Sequence | Owner | Required evidence path | Verification method | Stop condition |
|---|---|---|---|---|
| 1. Register a bounded brief (`G-BRIEF`) | Resource discipline owner | `asset-pipeline/briefs/stage-3/<asset-id>.yaml` | Confirm taxonomy, event/state binding, canonical output form, static semantic baseline, local fallback reference, source class, and target budget are present. | Missing canonical binding, local fallback reference, or canon-safe brief. |
| 2. Approve the pre-production review (`G-PRE`) | Art/narrative/audio lead, technical reviewer, accessibility reviewer | `asset-pipeline/approvals/APR-<asset-or-batch>-<revision>.json` | Review the declared source/bake plan, action/direction matrix, caption-first script, or release beat map/style board without using a candidate as proof. | Meaning is not independently readable without motion/audio, or the required source plan is absent. |
| 3. Clear provenance and rights (`G-RIGHTS`) | Rights/release reviewer | `asset-pipeline/provenance/source-attestations/<asset-id>.json` and `asset-pipeline/provenance/terms-snapshots/<provider>-<date>.md` | Verify source/input ownership, consent/voice authorization where relevant, terms snapshot hash, intended use, output-use basis, attribution, and reviewer decision. | Unclear input/output rights, missing consent, prohibited imitation/reference, expired or incompatible terms. |
| 4. Authorize any paid/cloud candidate work (`G-SPEND`) | Producer and asset owner | `asset-pipeline/approvals/APR-<asset-or-batch>-<revision>.json` | Confirm the approved brief hash, compatible tool/provider, candidate ceiling, spend ceiling, expiry, and secret-managed private-work boundary. | Any field is absent, the approval is stale, the provider is incompatible, or credentials are unavailable. |
| 5. Quarantine, review, and normalize a candidate (`G-CANDIDATE`) | Discipline owner, technical reviewer, accessibility reviewer | `asset-pipeline/validation/<asset-id>/<revision>/review-report.json` | Validate original/semantic fit, measurements, source/output hashes, captions or static equivalent, and category-specific criteria before any served-path write. | Candidate is unreviewed, exceeds its declared constraints, fails accessibility/semantic review, or lacks required evidence. |
| 6. Admit an immutable local output (`G-IMPORT`) | Engineering, QA, and release owner | `asset-pipeline/manifests/approved-assets.v1.json` and `asset-pipeline/validation/<asset-id>/<revision>/{media-report,atlas-report,frame-report}.json` | Validate the content-addressed same-origin path, full SHA-256, manifest schema, terminal local fallback resolution, offline load, and rollback predecessor/none declaration. | Any hash/schema/path/fallback/offline validation failure; do not modify the approved mapping. |
| 7. Produce release evidence | QA and release owner | `qa/resource-audit/resource-manifest-validation.json`, `qa/resource-audit/media-measurements.json`, `qa/resource-audit/runtime-provider-scan.json`, `qa/replay-corpus/audio-observer-differential.json`, and category-specific evidence named above | Exercise normal, offline, missing, decode-failure, mute, and reduced-motion projections as applicable; compare authoritative outcomes and scan for provider/secret surfaces. | Evidence is missing or any projection changes the authoritative result. G1–G8 remain NOT MEASURED / NOT PASSED until their separately governed evidence and verdicts exist. |

## Import and rollback procedure

1. A private immutable request declares original-IP prompt/script, cue ID, category, target duration, provider metadata when actually used, rights attestation, and named reviewer. Reject unknown cue IDs, recognizable voice/style requests, unclear rights, or secrets before generation.
2. A human or private build worker generates/downloads candidates only into quarantined staging. It records sanitized request fields, source hash, decoded measurements, and provider/model/voice only if supplied.
3. Human review checks semantic correctness, Korean intelligibility where relevant, clipping/loudness, captions, no misleading mechanical claim, and rights/terms. Rejection leaves the old map unchanged.
4. The importer emits a new content-addressed same-origin file and a manifest record. It updates cache inclusion only after manifest validation; it never overwrites an approved path in place.
5. Offline, muted, reduced-motion, missing-file, decode-failure, and observer-differential replay evidence is required before release. A failed import restores the last approved manifest hash and fallback mapping.

```yaml
asset_targets:
  narration: {max_bytes: 256000, duration_seconds: [1, 12]}
  short_sfx: {max_bytes: 102400}
  ambience_or_music: {max_bytes: 1048576}
  salience_rate_limit: {imported_sfx_per_event_key_per_250ms: 1}
  status: future_targets_not_measurements
```

## Future acceptance evidence

| Check | Evidence path | Current status |
|---|---|---|
| static bundle has no provider surface or secret | `qa/resource-audit/runtime-provider-scan.json` | NOT MEASURED / NOT PASSED |
| manifest schema/provenance/rights completeness | `qa/resource-audit/resource-manifest-validation.json` | NOT MEASURED / NOT PASSED |
| hash and media measurement match committed output | `qa/resource-audit/media-measurements.json` | NOT MEASURED / NOT PASSED |
| offline/missing/decode/mute fallback keeps rules hash | `qa/replay-corpus/audio-observer-differential.json` | NOT MEASURED / NOT PASSED |
| captions/static fallbacks are present and readable | `qa/accessibility/audio-vfx-fallback-capture.json` | NOT MEASURED / NOT PASSED |

All measurements are future targets. **G1–G8 remain NOT MEASURED / NOT PASSED. G2 evidence, if present elsewhere, is receipt integrity-only. Release is BLOCKED.**

## Sources

- `research/elevenlabs-integration.md` governs build-only/provider/provenance.
- `research/audio-narration-direction.md`, `research/vfx-hud-feedback.md`, `research/narrative-stage-presentation.md`, and `research/controls-accessibility.md` define observer/fallback requirements.
- Current contract: `docs/abyssal-command-defense-survivor-design.md`.
