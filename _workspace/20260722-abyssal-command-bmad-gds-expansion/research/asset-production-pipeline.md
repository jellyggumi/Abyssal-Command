# Source-controlled asset-production pipeline

**Status:** prospective production contract. No paid/cloud generation, asset mutation, import, rights clearance, runtime change, runtime validation, or gate result is asserted by this packet; non-asset tool-readiness observations are recorded below.

## Decision

Use a **brief → approval → quarantined production → deterministic export → review → immutable import** pipeline. `defense-catalog.js` and the fixed 60 Hz simulation remain the only gameplay authorities. Every produced resource is an optional, same-origin presentation observer; a missing, blocked, delayed, muted, or rejected resource resolves to the local fallback named in its manifest record.

The tools have deliberately narrow roles:

| Tool / lane | Permitted use | Explicitly not permitted | Mandatory pre-spend approval |
|---|---|---|---|
| PerfectPixel (`ppgen`) | Candidate 8-direction pixel-character animation bundles | Runtime generation, unaudited prompt-to-game import, borrowing a named character/style | Pixel brief, action/direction matrix, palette sheet, cost ceiling, and art/technical approval |
| Blender | Versioned `.blend` source for original low-poly references, sprite/VFX bake sources, and local preview renders | Shipping a Blender particle system as a gameplay system; collider/range/timing authority | Source brief, render/bake plan, silhouette and performance review |
| god-tibo-imagen (`gti`) | Optional **concept-only** mood, composition, and palette exploration | A required production dependency, automatic conversion to runtime art, unreviewed reference ingestion | Prompt/reference declaration, concept-use-only decision, approval before any non-dry-run request |
| ElevenLabs | Private, build-time candidate narration/SFX/music generation followed by reviewed static import | SDK, credential, endpoint, streaming, retry, or network at runtime | Canonical script/cue, rights/terms review, language review, cost ceiling, audio approval |
| Vox Director | Release/trailer beat package after the shipped-game asset set is already approved | In-game cutscene/runtime video, game-asset generation, a release gate substitute | Release owner approval of beat map, visual-style board, narration, music/rights plan, and spend ceiling |

`gti --dry-run` may validate prompt/configuration without requesting an image. A Blender local preview is also pre-spend. Neither is an approval, license clearance, nor a production asset.

## Binding boundaries

1. The shipped browser game remains offline, deterministic, single-player, and 60 Hz. No provider hostname, account identifier, private URL, provider response, model call, token, SDK, polling, retry, or nondeterministic selection may enter the runtime bundle, service worker, telemetry, or public manifest.
2. Resource lookup is a static `assetId`/`cueId` map driven only by confirmed observer events and a pinned manifest version. It never consumes simulation RNG, changes catalog data, changes rule order, owns a timer, or blocks input.
3. The current procedural Web Audio implementation is the default audio path. Imported static audio, if later approved, is an optional observer replacement; the existing procedural cue or silence remains its fallback.
4. A model, texture, sprite, particle bake, caption, voice line, or trailer has no collision, targeting, damage, cooldown, objective, reward, Gate Integrity, campaign, or Stage-10 authority. Static text/shape/icon paths remain the semantic baseline.
5. This packet proposes file names and schemas only. Extending `scripts/build-defense-asset-manifest.mjs`, the service-worker precache, renderer, or runtime import code needs a separately approved implementation slice and QA evidence.

Relevant future gates are **G1** canon traceability, **G4** readable/accessible effects, **G6** offline/performance/rollback, and **G7** core-loop clarity. Stage 2 material additionally informs **G2/G3/G5** only through later QA; trailer readiness is a Stage 3 release concern. All G1–G8 are currently **NOT MEASURED / NOT PASSED**.

## Evidence ledger

Sources were accessed **2026-07-22**. Provider capabilities establish tool surfaces, not project approval, output ownership, redistribution rights, quality, or a gate result.

| ID | Source / type | Evidence used here |
|---|---|---|
| PP-01 | [PerfectPixel Studio](https://github.com/gykim80/perfectpixel-studio) — primary upstream project | Documents the 8-direction bundle workflow and exports including sprite sheets, `manifest.json`, Aseprite JSON, GIF/APNG, and individual PNG frames. |
| BL-01 | [Blender Manual: glTF 2.0](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html) — primary | Documents the Blender glTF export surface. This plan treats nonportable particle systems as bake sources rather than relying on runtime particle export. |
| GTI-01 | [god-tibo-imagen](https://github.com/NomaDamas/god-tibo-imagen) — primary upstream project | Documents local Codex-auth-backed generation and `--dry-run`; its undocumented backend remains unsuitable as a runtime dependency. |
| EL-01 | [ElevenLabs text-to-speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) — primary | Documents build-side speech conversion/output formats. |
| EL-02 | [ElevenLabs sound-effects API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert) and [sound-effects overview](https://elevenlabs.io/docs/overview/capabilities/sound-effects) — primary | Documents candidate SFX generation controls; it does not authorize per-tick or runtime generation. |
| EL-03 | [ElevenLabs API-key guidance](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys) and [terms](https://elevenlabs.io/terms-of-use) — primary | Keys are secrets; plan/output terms and input rights must be reviewed per candidate. |
| VD-01 | [Vox Director](https://github.com/Alisa0808/vox-director) — primary upstream project | Documents the beat-map/style-approval production pattern and cloud-assisted collage-video workflow; this plan restricts it to marketing/release output. |
| ACC-01 | [W3C media accessibility guidance](https://www.w3.org/WAI/media/av/) and [Xbox XAG 103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103) — primary guidance | Meaningful audio and visual feedback require independently usable alternatives. |
| PERF-01 | `research/vfx-hud-feedback.md`, `research/audio-narration-direction.md`, `engineering/resource-manifest.md` — local project research | Supplies the proposed density, static-fallback, audio and offline constraints incorporated below. |

## Tool-readiness observations

These are observed operator facts, not asset-production evidence and not approval to generate:

| Tool | Observation | Pipeline consequence |
|---|---|---|
| god-tibo-imagen | `gti` exists and its dry-run succeeds. No image was generated or imported. | Concept prompts can be configuration-checked locally, but G-PRE/G-RIGHTS/G-SPEND still govern any non-dry-run request. |
| PerfectPixel | The installer completed at `/Users/jangyoung/.claude/skills/perfectpixel/bin/ppgen`. Its observed `--help` provider allowlist is `gemini`, `openrouter`, `fal`, and `byteplus`; it rejects the skill text's `god-tibo-imagen` provider. | **BLOCKED:** do not request a sprite until a supported provider is selected, its terms/rights and cost are approved, and the brief records the compatible provider. Do not infer a gti fallback. |
| Blender | An object-summary attempt timed out after 30 seconds; no Blender scene was inspected and no asset work began. | Blender remains source/bake-only in this plan; inspect the actual scene and record its source hash before any preview or bake approval. |

The `PP-01` upstream capability citation does not override the observed CLI compatibility mismatch. The proposed `ppgen` request below is contingent on resolving it.

## Asset taxonomy and target budgets

Every record has one taxonomy class and one runtime disposition. Numbers are **TARGETS**, not measured values.

| Class | Example IDs | Owner / source lane | Approved runtime form | Target budget / bound | Required fallback and gate relevance |
|---|---|---|---|---|---|
| Pixel actor | `actor.commander`, `enemy.elite.*`, `boss.*` | PerfectPixel output or hand-authored sprites | RGBA PNG atlas + frames/tags JSON | 8 directions exactly; max 1024×1024 atlas page; 32/64/96 px logical cells only; nearest-neighbor display | Shape/rank plate and simple existing canvas entity; G1/G4/G6 |
| Pixel action/VFX | `vfx.crit.fracture`, `vfx.skill.*`, `vfx.breach.*` | Blender bake or hand-authored pixel atlas | RGBA PNG atlas + timeline JSON | rank-4 ≤6 emitters/500 ms; critical ≤6 fragments; no loop unless approved passive gauge | Static glyph/outlined boundary/text; G4/G6 |
| HUD/icon | `ui.gate.*`, `ui.cooldown.*`, `ui.boss-rank.*` | Hand-authored or Blender-to-pixel bake | SVG/PNG + semantic manifest | important standard text/visual contrast target ≥4.5:1; no color-only state | text + icon + pattern; G4/G6/G7 |
| 3D source-only | `source.boss.*`, `source.effect.*` | Blender | `.blend`, optional `.glb` reference, bake camera/scene metadata | one source scene per immutable revision; glTF never required for a particle effect | baked atlas or no asset; no gameplay role; G4/G6 |
| Audio | `cue.stage.*`, `cue.boss.*`, `cue.bind.*`, `music.*` | ElevenLabs candidate or original recording | same-origin, content-addressed audio plus record | narration ≤250 KiB and 1–12 s; short SFX ≤100 KiB; ambience/music ≤1 MiB; one high-salience SFX/event-key/250 ms | existing procedural cue or silence + text/caption; G1/G4/G6 |
| Concept-only | `concept.stage.*`, `concept.palette.*` | god-tibo-imagen or local paintover | private/quarantined PNG/JPG, then reviewed board reference | no runtime ID; no asset-map entry | hand-authored placeholder; no runtime dependency |
| Marketing-only | `trailer.release.*` | Vox Director + local editor | release MP4/WebM, captions/subtitles, poster | 16:9 master; 9:16 derivative only when separately approved; no inclusion in game precache | omit trailer; release remains a separate decision; Stage 3/G6 |

The listed 32/64/96 px cell sizes, 1024 px page ceiling, and media-byte ceilings are production hypotheses. They must be measured against fixed captures and baseline devices before implementation raises them.

## Proposed source-controlled layout

The existing `assets/` tree remains the shipping-output location; `assets/defense-asset-manifest.json` remains the current generated inventory. This proposal adds a non-served authoring root and never commits unapproved candidate media or secrets.

```text
asset-pipeline/                         # source-controlled, non-served authoring contract
  briefs/
    stage-1/{sprite,vfx,hud,audio}.yaml
    stage-2/{encounter,reward,elite,boss}.yaml
    stage-3/{performance,accessibility,release-trailer}.yaml
  approvals/
    APR-<asset-or-batch>-<revision>.json
  manifests/
    approved-assets.v1.json              # prospective canonical approval manifest
    asset-schema.v1.json
    release-trailer.v1.json
  provenance/
    terms-snapshots/<provider>-<date>.md # URL/date/hash summary, no credentials
    source-attestations/<asset-id>.json
  source/
    perfectpixel/<asset-id>/<revision>/{brief,prompt,action-matrix,palette}.yaml
    blender/<asset-id>/<revision>/{scene.blend,bake-plan.yaml,render-settings.json}
    concept/<concept-id>/<revision>/{prompt,reference-register}.yaml
    audio/<cue-id>/<revision>/{script,caption,request}.yaml
    vox/<release-id>/<revision>/{beat-map,style-board,narration,rights-plan}.yaml
  validation/
    <asset-id>/<revision>/{frame-report,atlas-report,media-report,review-report}.json
  staging/                               # gitignored; private, quarantined candidate bytes only
assets/                                  # existing served-output root
  images/{sprites,vfx,ui}/<asset-id>.<sha256-prefix>.png
  models/<asset-id>.<sha256-prefix>.glb  # only after separately approved renderer support
  audio/<cue-id>.<sha256-prefix>.<ext>
  video/release/<release-id>.<sha256-prefix>.{mp4,webm} # never a gameplay dependency
  defense-asset-manifest.json            # existing generated inventory; extension is future work
```

`asset-pipeline/staging/` is gitignored and is deleted or archived in the approved private evidence system after selection. It may contain provider candidate bytes but **never** credentials, raw HTTP responses, account IDs, or private URLs in version control. `source/` contains only original briefs, prompts, scripts, Blender sources, and reference hashes whose rights have been declared.

## Manifest, provenance, and licensing contract

A future importer must reject a record with an absent field **or an unacceptable state**. `provider`, `model`, `modelVersion`, `voiceId`, and `providerJobReference` are present only when actually used; they are not invented for a local/human source.

```yaml
approvedAsset:
  required:
    - assetId
    - revision
    - taxonomy
    - stage
    - runtimeDisposition
    - outputPath
    - outputSha256
    - bytes
    - sourceSha256
    - briefId
    - fallbackId
    - accessibilityFallback
    - eventOrStateBinding
    - provenance
    - license
    - approval
    - validation
  outputPath:
    mustBe: relative, same-origin, content-addressed
    allowRoots: [assets/images, assets/models, assets/audio, assets/video/release]
    reject: [absolutePath, scheme, protocolRelativeUrl, parentTraversal, providerDomain, queryOrFragment]
  fallbackId:
    mustResolveIn: pinned_local_fallback_registry
    mustBe: independently-loadable-approved-asset-or-named-built-in-canvas-or-procedural-baseline
    reject: [missing, externalUrl, cycle, selfReference]
  provenance:
    required: [sourceClass, authoredByRole, sourceSha256, createdAt, importedAt]
    optionalWhenActual: [provider, model, modelVersion, voiceId, providerJobReference, promptId, promptSha256, referenceHashes, blenderVersion]
    forbidden: [apiKey, token, accountId, privateUrl, rawProviderResponse, unreviewedCandidatePath]
  license:
    required: [inputRightsAttestation, outputUseBasis, termsUrl, termsAccessDate, termsSnapshotSha256, reviewer, decision]
    decisionMustBe: approved
    reject: [unclearInputRights, recognizableUnapprovedVoice, thirdPartyCharacterOrLogo, namedLivingArtistStyleRequest, incompatibleOutputTerms, expiredTermsReview]
  approval:
    required: [approvalId, briefRevision, briefHash, gateRecords, candidateCountCeiling, currency, spendCeiling, expiresAt, artDecision, technicalDecision, rightsDecision, approverRoles, decidedAt, spendAuthorized]
    gateRecordsRequired: [G-BRIEF, G-PRE, G-RIGHTS, G-SPEND, G-CANDIDATE, G-IMPORT]
    gateRecord: {required: [gateId, immutableRecordHash, status, decidedAt], statusMustBe: approved}
    decisionMustBe: approved
    spendAuthorizedMustBe: true
    reject: [briefHashMismatch, expiredApproval, candidateCountExceeded, spendCeilingExceeded, rejectedOrMissingGateRecord]
  validation:
    required: [validatorVersion, validationStatus, measuredProperties, fallbackExerciseStatus]
    validationStatusMustBe: passed
    fallbackExerciseStatusMustBe: passed
```

For narration, also require `canonicalScriptId`, `canonicalScriptSha256`, language, speaker label, caption/transcript ID, and an approved semantic-match decision. For a sprite, require `directionSet`, `actionSet`, frame dimensions, pivot/anchor, alpha mode, atlas coordinates, and source/baked frame hashes. For Blender-derived images, require the `.blend` hash, Blender version, render engine/version, bake camera, and source-scene object list. The importer must resolve the fallback registry to a terminal local baseline before import and reject an output whose path is not allowlisted.

**Licensing rule:** an upstream tool's open-source license is not a license for a generated candidate, a provider's output, prompt inputs, voice, logo, music, or reference image. Each item needs its own terms snapshot and rights decision. A rejected or expired-rights asset cannot retain its output path: it is removed from the next approved manifest and resolves to its fallback.

## Approval and spend-control flow

No paid/cloud job begins before **G-PRE** and **G-SPEND** are both recorded. The approval record binds a brief revision and a maximum candidate count/cost so approval is not a blank cheque.

| Gate | Owner roles | Required evidence | Decision and rejection rule |
|---|---|---|---|
| G-BRIEF | discipline owner + narrative/design | taxonomy, stage, event/state binding, static fallback, source class, numeric budget, canon trace | Missing fallback, unbounded duration/frame count, or non-canon claim rejects the brief. |
| G-PRE | art + technical + accessibility reviewer | local Blender frame/turntable preview or concept prompt board; PerfectPixel action/direction matrix; caption-first audio script; Vox beat map/style board | Preview must make the same meaning readable with audio/motion absent. Unapproved prompts/scripts cannot be sent to a provider. |
| G-RIGHTS | rights/release reviewer | input-rights attestation, terms URL/date/hash, plan/license context, voice/reference declaration | Unknown rights, cloned/recognizable voice, copied character/logo, or terms mismatch blocks all production. |
| G-SPEND | producer + asset owner | approved candidate count, maximum spend, provider/model/voice if known, staging location | `spendAuthorized: true` is required immediately before a paid/cloud call; expired/revised brief resets this approval. |
| G-CANDIDATE | art + technical + accessibility | quarantined candidate, hash, side-by-side preview, captions/static fallback, semantic and originality review | Candidate bytes are not committed or mapped until accepted. |
| G-IMPORT | engineering + QA + release | final derivative hash/path, manifest validation, offline/missing/decode/mute replay, precache plan, rollback mapping | Any failed validation keeps the old approved manifest and fallback unchanged. |

A provider outage, rejected candidate, expired entitlement, production cancellation, or missing local cache is never retried by the game. It returns `fallbackId` locally.

## Tool-specific production recipes

### PerfectPixel: 8-direction sprite lane

A `ppgen` request is created only from an approved `source/perfectpixel/.../brief.yaml`. The request specifies an original English description, named palette, required action tags, cell size, opaque/magenta-matte treatment when used, and reference hashes. It must not request a named franchise, actor, living artist style, or source-game asset.

| Target item | Required tags/directions | Export | Acceptance criteria |
|---|---|---|---|
| Commander / normal actor | `idle(6), move(8), attack(6), hurt(4), down(8)` × `N,NE,E,SE,S,SW,W,NW` | atlas PNG, frame PNGs, tag JSON, upstream manifest/Aseprite JSON retained as source evidence | 8 directions complete; shared cell/pivot; 1 px transparent extrusion; no anti-aliasing; no matte fringe; readable silhouette at target cell; no direction/action mismatch |
| Elite | `idle(6), move(8), attack(6), hurt(4), down(8)` × 8 | same | elite rank/shape remains distinct in monochrome/high-contrast review |
| Boss | `idle(8), move(8), attack(8), hurt(4), defeat(10)` × 8 | same, potentially multiple pages | no frame advertises a wider/narrower combat range than observed event geometry; persistent plate remains separate from sprite |
| VFX sprite | declared nonlooping state tags + static equivalent | atlas PNG + timeline JSON | declared tick lifetime; particle/subframe count within event budget; no flash above three times/s; static glyph passes review |

If the upstream bundle creates five canonical facings plus mirrored variants, the manifest must record `derivedFromDirection` and `mirrored: true`. Mirroring is prohibited for asymmetric text, weapons, insignia, directional damage, or any readability difference; those receive authored distinct frames. The runtime-facing atlas uses an explicit ordered direction map, never inferred filename sorting.

### Blender: source geometry and particle-bake lane

Blender is the authoritative **source scene**, not a runtime authority. Source `.blend` files are pinned by hash and render settings. Local preview renders may establish the G-PRE visual board. Game-facing artifacts are baked frames/atlases; `.glb` is only a separately approved optional runtime format with a renderer import contract.

| Source type | Source-controlled input | Export decision | Required validation |
|---|---|---|---|
| Character/prop silhouette reference | `.blend`, collection list, camera, palette | orthographic RGBA turntable/bake → pixel cleanup → PNG atlas | fixed camera/scale, transparent alpha, no source-camera drift, source and bake hashes |
| Skill/boss visual source | `.blend`, declared observed-area template, bake plan | RGBA flipbook/atlas, never collision geometry | observed boundary overlay is tested; art clipped/anchored to it where feasible; static fallback exists |
| Particle source | `.blend`, deterministic local bake seed, frame range | baked RGBA sequence/atlas; do not rely on a browser runtime particle system | declared start/end; no implicit loop; frame count and coverage meet VFX governor; max flash/coverage analysis |
| Optional model | `.blend`, material register, glTF export settings | `.glb` only after separate renderer/asset-loader approval | no unsupported particle dependency; triangle/texture/draw-call budget measured in named target browser |

The pipeline intentionally bakes particles because their simulation and export support are not the gameplay contract. A failed bake leaves the static glyph or existing canvas shape in place.

### god-tibo-imagen: optional concept lane

`gti` is an optional ideation tool only. The only allowed pre-production use is an approved prompt/reference register; `--dry-run` validates configuration without a generation request. A paid/non-dry-run request needs G-SPEND. Candidate images remain in quarantined staging, receive source/prompt/reference hashes, and may inform a hand-authored moodboard only after G-CANDIDATE. They never receive `assetId`, go into `assets/`, become training/reference material for another provider without a new rights review, or ship as a runtime file merely because they look complete.

### ElevenLabs: build-time audio lane

This lane extends, rather than replaces, `engineering/resource-manifest.md` and `research/elevenlabs-integration.md`. A private operator or secret-managed build worker may generate bounded candidates only after G-SPEND. The public repository contains neither a secret nor raw request/response.

| Asset role | Approved static export target | Runtime fallback | Specific review |
|---|---|---|---|
| Narration | content-addressed local audio; canonical caption/transcript retained | caption/speaker label + existing stage cue or silence | Korean/script semantic match, intelligibility, no hidden mechanic or reward promise |
| Sparse state-boundary SFX | content-addressed one-shot | named existing procedural `AUDIO_CUES` cue or silence | event binding, anti-repetition/rate limit, mono-safe meaning |
| Ambient/music | local loop/stem only if rights review includes music terms | existing procedural ambience/music or silence | instrumental-only target, ducking does not control timing/state |

All final imported audio must record codec, sample rate, channels, duration, integrated loudness, true peak, final hash, bytes, cue ID, and fallback. It must preserve the existing procedural audio manifest's no-network Web Audio path until a separately approved static loader is implemented and verified.

### Vox Director: release-only trailer lane

Vox Director is permitted only after a release owner approves a marketing brief. It receives no production-game asset authority. The mandatory first artifact is a beat map: hook, claim, source footage/art register, narration, music plan, style board, intended aspect ratio, and caption plan. Approval of the beat map/style board is required before any cloud keyframe/motion/audio step; a final visual/caption/rights approval is required before export.

Release outputs live under `assets/video/release/` only after approval and are not referenced by gameplay, simulation, service-worker install critical path, or G1–G8 runtime evidence. A trailer may use captured shipped-game footage and separately cleared marketing art. It must never depict unavailable mechanics, a Stage 11, network play, commerce, or an outcome altered by presentation.

## Build/export and validation matrix

| Artifact | Deterministic export requirement | Validation command/measure (future implementation) | Reject if |
|---|---|---|---|
| Sprite atlas | content-addressed filename; JSON maps `assetId/action/direction/frame` to fixed pixel rect/pivot | decode PNG; validate atlas bounds, exact 8-direction/action matrix, alpha/fringe, nearest-neighbor metadata; compare hash to manifest | missing direction/frame, bad pivot/cell, nontransparent matte, unreviewed output hash |
| Blender bake | source/blend/render/bake hashes included; fixed frame range and camera | decode frame count/dimensions, check declared timeline and alpha, render static fallback capture | implicit loop, source scene mismatch, particle-only runtime dependency, breached footprint/flash target |
| UI/VFX | event binding/rank/anchor/lifetime/static equivalent embedded in semantic manifest | fixed 60 Hz replay joins event ID to presentation request; mask/contrast/flash review | no observed event, color-only meaning, rank-1 protected-zone overlap, static fallback absent |
| Audio | content-addressed local path and measured media fields | decode duration/codec/channels/loudness; scan built output for provider/secret URLs; replay valid/missing/decode-failure/mute | provenance/rights/caption incomplete, provider surface found, outcome/hash differs, fallback absent |
| Trailer | content-addressed release file plus captions/subtitles and beat-map hash | inspect aspect/duration/caption timing, no unapproved claims, rights/source register complete | marketed claim lacks catalog/capture evidence, captions missing, project asset copied without provenance |

The prospective QA evidence paths are `qa/resource-audit/resource-manifest-validation.json`, `qa/resource-audit/media-measurements.json`, `qa/resource-audit/runtime-provider-scan.json`, `qa/replay-corpus/audio-observer-differential.json`, and `qa/accessibility/audio-vfx-fallback-capture.json`. They do not exist as evidence yet.

## Runtime fallback matrix

| Failure or player mode | Required local result | Invariant |
|---|---|---|
| Approved sprite/atlas missing, decode fails, or hash mismatch | existing canvas primitive/entity treatment and rank/text cue; suppress decorative VFX | simulation snapshot, targetability, damage, and event order unchanged |
| Blender VFX/model missing or unsupported | static icon/glyph/outlined observed boundary; no visual is preferable to a misleading one | no collision/range/timing claim; reduced-motion meaning survives |
| Concept image unavailable | no visible runtime effect | no runtime concept dependency exists |
| Static audio missing, blocked, decode-fails, autoplay is denied, muted, mono, or reduced-audio | current procedural cue or silence; immediate caption/status remains | tick/RNG/input/objective/reward/ending hash unchanged |
| Provider outage/rate limit/expired credentials | no runtime contact; retain last approved file or the local fallback | no retry/network surface in browser |
| Trailer absent, blocked, or removed | release page omits it; game starts/runs normally | gameplay bundle/service worker does not depend on trailer bytes |

## Stage resource briefs

These are small, implementation-ready requests, not authorization to generate them.

### Stage 1 — concept, presentation, and core loop

| Brief ID | Resource request | Targets and approval focus | Fallback / gate |
|---|---|---|---|
| S1-SPR-01 | Commander 8-direction idle/move/attack/hurt/down test bundle | 64 px cell; required direction/action matrix; W-01/W-04-neutral original silhouette; first use is a one-state style preview only after G-PRE/G-SPEND | existing canvas commander; G4 readability and G6 atlas/decode targets |
| S1-VFX-01 | Static-first critical fracture ring, skill geometry, Gate directional wedge | 12–18 tick crit, 24–42 tick skill; no flash/full-screen wash; static equivalent approved first | glyph/text/outlined boundary; G4 |
| S1-AUD-01 | Stage-entry and boss-arrival script/cue candidates | caption-first Korean canonical text, 1–12 s, one event-bound line; rights/semantic review before build-time generation | current `stage-start`/`boss-spawned` procedural cue or silence; G1/G4/G6 |
| S1-CON-01 | Optional palette/composition board | `gti --dry-run` only until concept G-SPEND; hand-authored extraction, not direct runtime use | existing palette; no runtime effect |

**Hypothesis:** static-first, 8-direction silhouette and caption-first cue artifacts permit a fixed replay to retain stage/boss/critical meaning with motion and audio disabled. The future falsifier is the G4 capture/comprehension matrix plus G6 offline observer-differential replay.

### Stage 2 — balance, rewards, growth, and encounters

| Brief ID | Resource request | Targets and approval focus | Fallback / gate |
|---|---|---|---|
| S2-SPR-01 | Elite and boss 8-direction bundles with non-color rank shape | 64/96 px cells; 8 direction matrix; phase/rank plate external to animation; no frame depicts an unobserved attack area | plain silhouette + named boss/elite plate; G3/G4 |
| S2-VFX-01 | Bind/Extract, Domain, Gate, and reward-confirmed visual family | each only after confirmed event; one static geometry/pattern per W-anchor; density governor review | static icon/status text; G2/G4/G5/G7 |
| S2-AUD-01 | Sparse Bind/Extract, capture, Domain, and reward receipt candidates | maximum one imported high-salience SFX per event key/250 ms; no reward or offer promise outside canonical UI | existing procedural cue/silence + receipt text; G5/G6 |
| S2-BLEND-01 | Boss/encounter reference and particle bake sources | bake-plan overlays observed spawn/area; 10-minute density/performance evidence required before expanding visual count | no bake; static boss/telegraph handling; G2/G3/G4/G6 |

**Hypothesis:** rank-coded asset families improve encounter distinction without revealing balance information unavailable from canonical UI or biasing a five-archetype result. The current G2 receipt reports 15/15 replay-identical controlled runs across five fixtures and seeds 17–19, with 0 digest mismatches, but it is raw deterministic evidence only: **G2 remains INCOMPLETE / NOT PASSED** and authorizes no catalog, reward, idle, or monetization change. G3/G5 remain unmeasured until their named fixtures and studies exist.

### Stage 3 — combat feedback, performance, QA, and release

| Brief ID | Resource request | Targets and approval focus | Fallback / gate |
|---|---|---|---|
| S3-OPT-01 | Atlas consolidation and VFX bake set | max 1024 px pages, stable manifest order, content-addressed outputs; measure presentation contribution against the named baseline | render existing primitives/static icons; G6 |
| S3-ACC-01 | High-contrast/reduced-motion sprite/VFX/UI variants | static semantic baseline, contrast target, no color/sound-only state, caption coverage for meaningful audio | text/icon/pattern; G4/G6 |
| S3-AUD-01 | Final bounded audio candidates and mix packet | media measurement, offline/missing/decode/mute replay, canonical captions, manifest rollback | procedural cue/silence; G4/G6 |
| S3-REL-01 | Release trailer beat package | approved beat map/style board before any paid Vox step; subtitles, visual and music rights; capture-only truthfulness | omit trailer; no gameplay consequence; release readiness/G6 |

**Hypothesis:** source hashes, content-addressed exports, and fallback-replay evidence make a visual/audio refresh reversible and keep 30-minute performance and offline behavior independently testable. No performance or release gate has passed.

## Implementation boundaries and handoff

A future implementation may begin only after a signed resource-manifest schema slice. It should add no generator SDK to browser code. Its bounded work is: validate the prospective approved manifest, extend the existing asset inventory generator only for approved content-addressed outputs, pre-cache approved same-origin paths, and prove every fallback row with a fixed observer replay.

It must not alter rules, catalog values, plan generation, wave order, rewards, campaign state, user data collection, or player input. It must not create network or commerce dependencies. The release/trailer lane is a separate marketing operation and cannot substitute for game QA.

## Acceptance checklist for this plan

- [x] Taxonomy assigns every class a source lane, runtime disposition, numeric target, fallback, and applicable future gate.
- [x] Proposed source/approved/staging directories preserve the existing `assets/` output boundary and prohibit committing unapproved candidates or secrets.
- [x] Manifest fields cover provenance, licensing/terms, approvals, hashes, media/sprite measurements, and fallbacks.
- [x] G-PRE and G-SPEND require human preview/approval before any paid/cloud generation for PerfectPixel, god-tibo-imagen, ElevenLabs, or Vox Director.
- [x] PerfectPixel is specified for explicit eight-direction pixel animation; Blender is source/bake-only; gti is concept-only; ElevenLabs is build-only; Vox is release-only.
- [x] Stage 1–3 briefs define measurable hypotheses and implementation boundaries without a gate-pass claim.
- [x] Every runtime failure and player-mode path resolves locally without changing the deterministic simulation.
