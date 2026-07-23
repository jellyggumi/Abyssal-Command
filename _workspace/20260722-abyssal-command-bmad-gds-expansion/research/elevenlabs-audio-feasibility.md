# ElevenLabs audio feasibility — offline deterministic asset pipeline

**Status:** research and proposed build contract only. No ElevenLabs account, credential, API request, generated file, license clearance, runtime integration, or gate measurement is asserted. **G1–G8 remain NOT MEASURED / NOT PASSED.**

## Decision

ElevenLabs is technically feasible only as an **optional, private build-time candidate generator**. The shipped single-player browser game may consume approved, content-addressed, same-origin audio bytes; it MUST NOT contain an ElevenLabs SDK, endpoint/hostname, browser credential, signed/private URL, retry logic, runtime prompt, or network-dependent audio path. The deterministic 60 Hz simulation remains authoritative; audio is a fallible observer and may be silent.

Implementation requires **user-provided ElevenLabs credentials and a documented rights/terms review**. This document neither requests nor accepts credentials.

## Official evidence ledger

All sources were accessed **2026-07-22**. API availability or a provider statement is not a clearance to generate, distribute, or ship an asset.

| ID | Official source | Established fact | Bounded use here |
|---|---|---|---|
| EL-01 | [Create speech — `POST /v1/text-to-speech/{voice_id}`](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) | Converts text with a chosen `voice_id` and returns audio; supports `output_format`, model selection, language/model constraints, and pronunciation dictionaries. | Candidate narration or non-verbal vocalizations only. |
| EL-02 | [Create sound effect — `POST /v1/sound-generation`](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert) | Text-to-SFX endpoint accepts `text`, optional `duration_seconds`, `loop`, `prompt_influence`, and `model_id`; returns binary audio. The reference limits `duration_seconds` to 0.5–30 s. | Candidate one-shots and ambience, never per-tick combat generation. |
| EL-03 | [Sound effects capability](https://elevenlabs.io/docs/overview/capabilities/sound-effects) | Describes game SFX, a maximum 30 s generation, MP3 output, 48 kHz WAV for non-looping effects, and looping effects. | Separate sparse SFX/ambience from music. |
| EL-04 | [Compose music — `POST /v1/music`](https://elevenlabs.io/docs/api-reference/music/compose) and [Eleven Music](https://elevenlabs.io/docs/overview/capabilities/music) | Music endpoint composes from a prompt or plan; docs list output formats. Capability page states API availability for paid subscribers, 3 s–5 min generation, and MP3/WAV output. | Optional pre-rendered instrumental bed/stem; no live score. |
| EL-05 | [API keys](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys) | Keys are secrets and MUST NOT be exposed in browser/app client code; service-account keys are recommended for automation and can use scopes, quotas, IP allowlists, and rotation. | Private worker credential boundary. |
| EL-06 | [API errors](https://elevenlabs.io/docs/eleven-api/resources/errors) | Documents 429 rate/concurrency errors, exponential backoff for rate limiting, and waiting for active work at concurrency limits. | Private batch behavior only; no runtime retry path. |
| EL-07 | [Terms of Service, non-EEA](https://elevenlabs.io/terms-of-use) (last updated 2026-03-31) | Free use is non-commercial; paid use may be commercial subject to terms/use policy. User warrants necessary Input rights; Terms describe Output rights, moderation, and non-uniqueness. | Per-asset legal/rights decision—not a blanket license or legal advice. |
| ACC-01 | [W3C WAI: Making Audio and Video Media Accessible](https://www.w3.org/WAI/media/av/) | Calls for captions for speech and meaningful non-speech audio, transcripts, and accessibility planning during scripting. | Caption/transcript requirement and non-audio equivalence. |

## Capability and constraints assessment

| Need | Official API/resource | Feasible build-time use | Constraints and rejection rules |
|---|---|---|---|
| Narration | EL-01 `POST /v1/text-to-speech/{voice_id}` | Generate a short approved Korean or localized line from canonical text. | Reject when a voice’s consent/authorization is absent, the line differs from the player-visible canonical text, or speech implies hidden timing/reward/mechanics. Do not use a clone, celebrity likeness, recognizable performer request, or uploaded voice recording without documented express authorization and legal review. |
| Battle vocalization | EL-01 TTS | Generate sparse non-verbal exertion or short original command callouts. | No gameplay authority; no high-rate attack bark; no recognizable/imitative voice request. Suppress when voice bus is muted or a higher-priority threat must play. |
| SFX/ambience | EL-02 `POST /v1/sound-generation` | Generate reviewed one-shots for boss arrival, confirmed Bind/Extract, Domain, Gate pressure, and optional loopable ambience. | Limit source request duration to 0.5–30 s. Reject weapons/impact spam, third-party game/franchise/style mimic prompts, misleading event semantics, clipping, or poor loop seam. |
| Music | EL-04 `POST /v1/music` | Generate reviewed instrumental menu/stage beds or stems. | Only after plan-specific music terms and commercial-use review. No vocal/copyright-like prompt, no known-song/artist imitation, no live generation, and no musical bar as a simulation clock. Music is optional; silence is valid. |

**Provider capability does not prove output quality, Korean intelligibility, accessibility, legal clearance, commercial eligibility, or uniqueness.** Those remain review gates.

## Proposed asset and runtime boundary

### Fixed rules

1. **Private generation boundary:** a human operator or non-browser build worker may call provider APIs. The PWA, static bundle, service worker, tests, public manifest, browser console, and client telemetry may not hold a key, token, account ID, private URL, raw response, or prompt requiring secrecy.
2. **Offline delivery:** only reviewed same-origin files enter the release package and precache list. Runtime cue lookup is a static map from an already-resolved observer event to an approved asset ID/fallback ID.
3. **Observer-only presentation:** generation/playback/caption timing cannot create, delay, cancel, merge, or reinterpret a simulation event; it cannot alter input, RNG, combat, objective, reward, or ending state.
4. **No live recovery:** provider outage, 401/403/429/5xx, missing credentials, cache miss, load/decode failure, permission denial, mute, or absent asset never triggers a browser request. Runtime selects the local fallback or silence and retains text/UI state.
5. **No attribution assumption:** a release record must state whether attribution is required by the actual plan, terms, asset source, or additional agreement. Do not claim ElevenLabs endorsement; use its trademark only where legally/review-approved.

### Build pipeline

| Step | Private-only action | Required evidence / measurable target | Stop condition |
|---|---|---|---|
| 1. Intake | Register original script/prompt, category, cue ID, fallback, canonical text/caption, intended territory/use, and rights attestation. | **Target:** 100% request records have a named human requester and reviewer, source/prompt hash, terms URL/date, plan context, and consent state. | Missing/ambiguous rights, consent, or canonical text rejects the request. |
| 2. Moderation | Pre-screen prompt/script and source material for prohibited, unlawful, deceptive, privacy-invasive, trademarked, copyrighted, artist/actor imitative, or unsafe content. Use provider moderation/terms controls where available plus human review; provider moderation is not the sole gate. | **Target:** 0 candidates bypass the logged moderation decision; `approved`, `rejected`, and reason code are recorded without storing sensitive raw input in the public manifest. | Any denied/uncertain result is quarantined; no import. |
| 3. Generate | Private worker invokes the appropriate EL endpoint with user-provided scoped credentials. Batch sequentially or within declared safe concurrency; use EL-06’s 429 guidance only here. | **Target:** maximum 3 attempts per immutable request; request ID may be stored privately as an opaque reference, never publicly. | Any HTTP/validation/auth/rate-limit failure is `deferred`; existing release mapping remains unchanged. |
| 4. Quarantine and review | Download candidate to non-repository staging; inspect semantic fit, voice consent, intelligibility, disclosure/attribution, copyrights/style risk, loop seam, clipping, caption match, and canonical gameplay meaning. | **Target:** narration exact semantic-match review; 100% chosen voice records have consent/authorization evidence. | Fail review: purge/quarantine candidate under the retention policy; retain only necessary sanitized decision evidence. |
| 5. Normalize and measure | Transcode/normalize approved derivative locally, measure codec/sample rate/channels/duration/integrated loudness/true peak, hash bytes, and generate caption/transcript resources. | **Target:** see numeric delivery profile below; output SHA-256 and decoded measurements must match manifest. | Measurement mismatch, clipped output, or budget breach blocks import. |
| 6. Immutable import | Write a new `assets/audio/<cue-id>.<sha256-prefix>.<ext>` file and a sanitized manifest record; update precache only after validation. Never overwrite an approved path in place. | **Target:** 100% approved imports have a local fallback and rollback predecessor/none declaration. | A changed byte hash requires a new review/import record; old mapping stays live on failure. |
| 7. Offline release check | Scan compiled release output for provider domains/SDKs/keys/private URLs; run an offline cue fixture with normal, missing, decode-failure, mute, mono, and reduced-motion variants. | **Target:** zero provider surfaces; identical simulation event sequence/final hash across all presentation variants. | Failure blocks release evidence and relates to G6/G4; it cannot be waived by a working provider call. |

### Caching and retention

- Cache **only after review**: cache key is `outputSha256`, not a prompt alone. The private generation cache may additionally key on `requestId + scriptOrPromptSha256 + provider + model/version + voiceId? + requestedFormat`; invalidating any component creates a new candidate.
- A cache hit reuses already reviewed bytes only when its rights review, terms review date, consent status, and required attribution remain current. It never silently regenerates.
- Retain private request/candidate data only for the organization’s approved retention window. The public manifest contains hashes and sanitized provenance, not raw prompts, recordings, API headers, account IDs, or provider response bodies.
- Runtime precache contains only the final local file and public-safe manifest fields. Its eviction/failure invokes `fallbackId`, not any provider fetch.

## Numeric delivery profile — targets, not measured results

These are acceptance targets for a future implementation. They are intentionally conservative product constraints, not claims about ElevenLabs output or a provider recommendation.

| Category | Final delivery target | Mix/quality target | Fallback | Relevant gates |
|---|---|---|---|---|
| Narration | MP3 `44100 Hz/128 kbps`; mono unless spatial effect is non-essential; 1–12 s; ≤256 KiB each | **Target:** normalize to -16 LUFS integrated (stereo) or -19 LUFS (mono), cap true peak ≤-1 dBTP; human Korean intelligibility review | Immediate canonical caption/status + optional local tone or silence | G1, G4, G6, G7 |
| Battle vocal | MP3 `44100 Hz/128 kbps`; mono; ≤1.5 s; ≤64 KiB | **Target:** ≤-1 dBTP; no masking of P0 threat; at most one per event family per 2 s | Static icon/text state; silence permitted | G4, G6 |
| One-shot SFX | MP3 `44100 Hz/128 kbps`; mono; ≤2 s; ≤100 KiB | **Target:** ≤-1 dBTP; at most one imported high-salience cue per `(cueId, event key)` per 250 ms | Existing procedural cue or silence plus visual/caption equivalent | G4, G6, G7 |
| Ambience/music | MP3 `44100 Hz/128 kbps`; stereo permitted; ≤60 s loop/stem; ≤1 MiB per imported file | **Target:** ≤-16 LUFS integrated and ≤-1 dBTP before local ducking; verified loop seam | Duck/stop/silence; never state-bearing | G4, G6 |

Use original uncompressed WAV/PCM only in private staging/mastering if necessary; package the reviewed final format above. The API docs expose multiple formats and tier restrictions (EL-01–EL-04), so the selected request format must be checked against the user’s actual plan before a request. Browser support and final device playback must be validated independently.

## Safe public asset-manifest proposal

```yaml
schema: abyssal.audio-asset-manifest
schemaVersion: 1
status: target_not_implemented
records:
  - assetId: narration.stage-01.v1
    cueId: STAGE_STARTED
    category: narration # narration | vocal | sfx | ambience | music
    runtimeEventMapping:
      event: STAGE_STARTED
      authority: observer_only
    path: assets/audio/narration.stage-01.a1b2c3d4.mp3
    outputSha256: <64-hex-sha256>
    bytes: 0
    codec: mp3
    sampleRateHz: 44100
    channels: 1
    durationMs: 0
    loudnessIntegratedLufs: 0
    truePeakDbtp: 0
    fallbackId: fallback.stage-start.caption-and-tone
    accessibility:
      captionId: caption.stage-01.ko
      transcriptId: transcript.stage-01.ko
      nonAudioEquivalent: "Stage/objective text is rendered before playback."
    provenance:
      sourceClass: text-to-speech # text-to-speech | sound-effect | music | local-procedural
      provider: ElevenLabs # omit when not used
      modelId: <actual-model-id-or-omitted>
      modelVersion: <actual-version-or-omitted>
      voiceId: <actual-voice-id-or-omitted>
      sourceSha256: <private-request-or-master-hash>
      canonicalScriptId: stage-01-intro.ko
      canonicalScriptSha256: <64-hex-sha256>
      generatedAt: <RFC3339-or-omitted>
      importedAt: <RFC3339>
    rights:
      inputRightsAttestationId: rights-attestation-123
      consentRecordId: consent-voice-456 # required for a real/person-derived voice
      termsUrl: https://elevenlabs.io/terms-of-use
      termsReviewedAt: <YYYY-MM-DD>
      planOrLicenseContext: <reviewed-plan-and-music-terms-if-applicable>
      attributionRequirement: <none-or-exact-approved-text>
      reviewer: <human-role-or-id>
      decision: approved
    moderation:
      decision: approved
      reviewRecordId: moderation-789
      reasonCode: original-asset-safe
    version: 1
```

**Schema rejection rules:** reject if `outputSha256`, decoded measurements, `fallbackId`, human reviewer, rights decision, or category-required caption/transcript is absent; reject `provider: ElevenLabs` with missing actual model/voice fields when supplied by the generation record; reject any `apiKey`, token, account ID, raw prompt/recording, private URL, request header, or raw provider response. A real/person-derived voice additionally requires explicit consent record and authorization scope; absent consent means no generation/import.

## Fallback and accessibility matrix

| Player moment | Standard approved asset | Required local fallback | Caption/transcript requirement | Invariant |
|---|---|---|---|---|
| Stage/canon/terminal narration | TTS narration | Canonical on-screen text + speaker label; optional local tone/silence | Exact text caption and transcript; available before/without playback | Text/event state is authoritative; clip completion cannot advance stage or ending. |
| Boss/Gate arrival | SFX/vocal sting | Static boss/Gate identity, rank, direction/threat marker, optional procedural sting | Caption only for meaningful arrival/threat sound, e.g. `[Boss arrives]` | Spawn/timing/targetability unchanged. |
| Bind/Extract/Domain resolution | Short SFX | Existing procedural cue or silence + resolved icon/text | Caption for selected major event; no dense hit spam | Sound cannot establish eligibility, success, duration, or reward. |
| Automatic-hit texture | Optional SFX | Silence permitted | No routine caption required | Damage/crit must already be visually clear. |
| Music/ambience | Static local loop/stem | Duck, stop, or silence | No caption unless it communicates material narrative content | Music never supplies a countdown, phase change, or input timing. |

Caption controls, contrast, timing, speaker label, and transcript discoverability require a future accessibility review. W3C accessibility guidance supports treating meaningful non-speech audio and speech as text alternatives; it does not certify this proposal.

## Gate linkage and future evidence

| Gate | Feasibility contribution only | Required future artifact/measurement | Current status |
|---|---|---|---|
| G1 — narrative/worldview consistency | Canonical-script hash and semantic review prevent narration from inventing lore/mechanics. | Player-visible canon audit including narration/caption strings. | NOT MEASURED / NOT PASSED |
| G4 — effects and animation immersion | Caption-first, mute/mono/reduced-motion fallbacks and sparse cue targets support a readable presentation experiment. | Captures plus counterbalanced normal/reduced-motion/sound-off readability/immersion study. | NOT MEASURED / NOT PASSED |
| G6 — operations/performance/telemetry | Provider-free compiled-output scan, content hashes, offline fallback, asset budgets, rollback, and local-only evidence target operations safety. | Named G6 operations/performance/local-telemetry evidence, including network-disabled and resource audit. | NOT MEASURED / NOT PASSED |
| G7 — core loop | Observer-only audio prevents narrated/music timing from becoming a loop authority. | Full fixed 90-second trace and repeat study with audio presentation variants. | NOT MEASURED / NOT PASSED |

## Implementation boundaries and go/no-go checklist

**In scope for a later implementation:** a private importer, local transcoding/measurement, public-safe manifest validator, static same-origin asset mapping, caption/transcript resources, local procedural/silent fallback, compiled-output provider/secret scan, and offline observer-differential tests.

**Out of scope:** obtaining an account, storing/providing credentials, calling any API, voice cloning, uploading recordings, creating or licensing assets, runtime SDK integration, runtime network/caching, commerce, analytics to ElevenLabs, or changing deterministic rules.

Proceed to private candidate generation only when all are true:

- [ ] User has supplied credentials through an approved secret system, not source/chat/manifest/browser configuration.
- [ ] A scoped, quota-limited service-account key and private operator/worker boundary exist (EL-05).
- [ ] The exact plan, applicable terms—including music-specific terms when relevant—and commercial/attribution implications were reviewed by an authorized person.
- [ ] Each input has original-IP/necessary-rights attestation; every real/person-derived voice has express documented consent and approved use scope.
- [ ] Content moderation and human semantic/rights reviews passed; no imitation, deceptive instruction, or privacy-invasive content remains.
- [ ] Every candidate has a local fallback, caption/transcript where needed, final SHA-256, decoded measurements, immutable import path, and rollback record.
- [ ] The compiled release has zero provider/secret/network surfaces, and future offline/missing/decode/mute/reduced-motion observer-differential evidence succeeds.

Until then, retain current local procedural/silent audio behavior. This feasibility packet authorizes neither an API call nor a gate PASS.
