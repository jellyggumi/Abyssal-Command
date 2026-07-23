# ElevenLabs build-time audio integration research

**Status:** concept-validation packet; no ElevenLabs account, credential, request, generated asset, or rights clearance was used or asserted.

## Research question

Which ElevenLabs capabilities are officially documented for narration, exertions/SFX, and music, and what safe **build-time-only** import path lets this static, offline PWA consume approved files without making presentation authoritative or gameplay dependent on a network service?

## Decision boundary

**[RECOMMENDATION]** Treat ElevenLabs only as an optional, operator-run source of candidate audio before a release. The shipped PWA receives static, reviewed audio files plus provenance metadata. It has no ElevenLabs SDK, HTTP request, WebSocket, signed URL, provider credential, runtime generation, or retry path.

This preserves the project contract: the deterministic 60 Hz simulation and `defense-catalog.js` remain authoritative; renderer/audio/narration are observers only. W-01 Command Echo, W-02 Bind/Extract, W-03 Gate Integrity, W-04 Domain, and W-05 Archive (ending at Stage 10) are not changed by this packet.

## Source ledger

All external sources were read 2026-07-22. “Primary” means the provider or standards body publishing its own contract; a document describes capability, not approval for this project.

| ID | Provenance | Source evidence | Use in this packet |
|---|---|---|---|
| EL-01 | **Primary — ElevenLabs API reference** | [Create speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) documents `POST /v1/text-to-speech/{voice_id}`, text input, a selected voice, audio output, and documented output formats. | Build-time narration/exertion capability only. |
| EL-02 | **Primary — ElevenLabs API reference** | [Create sound effect](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert) documents `POST /v1/sound-generation`, required text, optional duration/prompt influence/looping, and binary audio output. | Candidate one-shot and ambient SFX capability. |
| EL-03 | **Primary — ElevenLabs capability documentation** | [Sound effects](https://elevenlabs.io/docs/overview/capabilities/sound-effects) documents text-to-SFX for games, a 30-second maximum per generation, looping, MP3/WAV output facts, and directs full music production to Music. | Keep combat SFX distinct from music. |
| EL-04 | **Primary — ElevenLabs API reference and capability documentation** | [Compose music](https://elevenlabs.io/docs/api-reference/music/compose) documents `POST /v1/music` from a prompt or composition plan; [Eleven Music](https://elevenlabs.io/docs/overview/capabilities/music) documents the paid-subscriber API, MP3/WAV output, 3-second to 5-minute generated duration, and plan-dependent music terms. | Optional pre-rendered instrumental bed only; not a runtime soundtrack service. |
| EL-05 | **Primary — ElevenLabs workspace documentation** | [API keys](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys) calls a key a secret, prohibits exposing it in browser/app client code, and documents service-account keys, scope restriction, credit quota, IP allowlisting, and rotation. | Credential boundary. |
| EL-06 | **Primary — ElevenLabs API documentation** | [Errors](https://elevenlabs.io/docs/eleven-api/resources/errors) documents 429 rate/concurrency errors and build-client recovery advice: exponential backoff for rate limiting, wait for in-flight calls for concurrency. | Build operator behavior; irrelevant to shipped runtime because it does not call the provider. |
| EL-07 | **Primary — ElevenLabs documentation** | [Streaming and Caching with Supabase](https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/streaming-and-caching-with-supabase) is an official example of server-side generation/storage caching; it uses an environment-held key and a request-parameter cache key. | Evidence that caching is a supported implementation pattern, **not** a license grant for this game. |
| EL-08 | **Primary — ElevenLabs Terms of Service, non-EEA** | [Terms](https://elevenlabs.io/terms-of-use) (last updated 2026-03-31) says free users may use Services/Output only non-commercially; paid users may use them commercially subject to the terms/use policy; the user must have necessary input rights; output rights and use remain subject to the terms. | Rights/plan gate; legal review remains required. |
| ACC-01 | **Primary — W3C WAI** | [Making Audio and Video Media Accessible](https://www.w3.org/WAI/media/av/) calls for captions including meaningful non-speech audio and transcripts; it recommends planning accessibility with the script. | Text/caption/transcript fallback and QA gate. |

## Documented capability versus bounded inference

| Topic | Documented evidence | Bounded inference / project decision |
|---|---|---|
| Narration and exertions | **[DOC: EL-01]** Text-to-speech converts text using a selected voice and returns audio. The reference exposes `voice_settings`, language/model selection, and output format parameters. | **[INFERENCE]** A short Korean command narration and non-verbal exertion are suitable *candidate inputs*, but quality, Korean intelligibility, cast suitability, and rights are unverified until review. Use no cloned or recognizable performer voice without separate documented authorization. |
| SFX | **[DOC: EL-02, EL-03]** Sound generation turns a text description into sound effects; its documented controls include duration, prompt influence, and model-dependent looping. | **[TARGET]** Use this only for sparse, non-authoritative one-shots (bind/extract, capture, Domain, gate warning) and optional ambient loops. Do not generate high-frequency weapon/impact events per combat tick. |
| Music | **[DOC: EL-04]** Music composition is documented and the API is available to paid subscribers; terms/plan constraints apply. | **[TARGET]** Music is an optional, pre-rendered, instrumental-only menu/stage bed. It ducks or stops for narration locally; no dynamic score generation. Music remains out of scope unless a reviewer records the applicable plan and music-terms clearance. |
| Credential and rate limits | **[DOC: EL-05]** Keys are secrets and must not be exposed in client code. **[DOC: EL-06]** provider calls can receive rate/concurrency 429s. | **[TARGET]** A human or private build job makes a bounded, sequential batch before import. It uses a restricted service-account credential from an approved secret store/environment and records no secret in source, logs, asset metadata, or PWA. |
| Cache/import | **[DOC: EL-07]** ElevenLabs documents an example server cache for generated speech. | **[INFERENCE]** Content-addressed local staging and immutable static files make generation reproducible enough to review. EL-07 does **not** establish redistribution, retention, or commercial-use rights; EL-08 plus the relevant plan/music terms must be checked per asset. |

## Build-time-only pipeline

### 1. Private request intake (no runtime connection)

**[TARGET]** Extend the existing private/manual audio-import contract rather than create a second production authority. One immutable request is accepted only when it contains:

- `requestId`, `cueId`, role (`narration`, `exertion`, `sfx`, `ambience`, or `music`), approved player moment, original-IP prompt/script, language for spoken audio, and target duration;
- a canonical script ID and SHA-256 of the approved narration text/caption source; narration wording must match the visible Korean text and must not imply a hidden mechanic;
- source class (`text-to-speech`, `sound-effect`, or `music`), provider (`ElevenLabs` only when actually used), exact model/version and voice ID when supplied, output-format request, generation timestamp, and opaque provider job/reference ID if provided;
- rights attestation: operator authorized the prompt/input; no unauthorized voice clone, recognizable performer, commercial recording, third-party music, or trademarked sound identity; applicable plan/terms URL and review date; and
- an explicit reviewer/approver. Missing or ambiguous provenance/rights is a rejection, not a placeholder.

The request record belongs in a private production channel/staging store, not the PWA, committed assets, service-worker list, or public manifest. No raw response, private download URL, account identifier, access token, key, or secret-bearing request header may cross the boundary.

### 2. Generation boundary

**[TARGET]** A designated audio operator runs generation manually or from a trusted build worker. It may access a narrow, scoped, quota-limited service-account credential only through the worker environment/secret store. The worker is not part of the static PWA and emits sanitized evidence only.

- Batch candidate files with bounded concurrency; treat HTTP 429 as a failed/deferred generation, using EL-06’s retry guidance only in the private job.
- Download each candidate to a quarantined private staging directory. Do not commit it, pre-cache it, or attach it to an asset map until review passes.
- Record the exact sanitized request fields and source SHA-256 before generation; calculate a SHA-256 and inspect duration/codec/channel count on the received source afterward.
- Human review rejects mispronunciation, unintelligible Korean, clipping, excessive loudness, wrong semantic cue, copyrighted/recognizable style request, or content that would falsely imply rule authority.

### 3. Deterministic import and release package

**[TARGET]** Only a reviewed final derivative becomes a same-origin, committed file (for example `assets/audio/<cue-id>.<content-hash>.mp3`). The content hash prevents an unreviewed replacement from silently inheriting an approved filename. A release record must bind:

```text
cueId + role + sourceClass + canonicalScriptHash? + provider/model/voice? +
rightsTermsUrl + rightsReviewDate + sourceSha256 + outputSha256 + bytes +
codec/sampleRate/channels/duration + loudness/truePeak + captions/transcript IDs +
approver + generatedAt + importedAt + runtimeEventMapping + fallbackId
```

`?` means required only for spoken audio/provider metadata actually supplied; it is never fabricated. The public asset manifest may carry sanitized provenance and final measurements, but never credentials, account IDs, private URLs, raw provider payloads, or personal data. Keep a private old/new hash and rollback record when replacing an existing file.

The importer must reject a file if any of these is absent or mismatched: request ID, canonical cue ID, final hash, decoded measurements, terms/rights review, approved transcript/captions (for narration), manifest entry, service-worker precache change for the new static path, or browser offline/fallback QA. A rejected import leaves the old asset map untouched.

### 4. Runtime invariant — reject live request playback

**[INVARIANT / TARGET]** The production bundle MUST satisfy all of the following:

1. Runtime has **zero** calls to ElevenLabs domains/endpoints: no `fetch`, XHR, WebSocket, SDK import, dynamic `<audio src>` URL, signed URL, or worker/iframe bridge.
2. Runtime ships only same-origin committed asset paths and deterministic cue IDs. The service worker precaches approved paths so a first successful installation can replay them offline.
3. Network absence, provider outage, expired provider entitlement, rate limit, malformed asset, decode failure, cache eviction, audio permission denial, and the user’s mute setting leave simulation tick/order/RNG, input handling, objective state, rewards, and ending untouched.
4. Failure resolves locally to the cue’s authored procedural fallback or silence **and** preserves the existing visible text/status/cutscene path. Narration text is immediate and canonical; audio cannot delay, replace, or conceal it.
5. Presentation adapters observe emitted events only. They do not write `run`, campaign state, values from `defense-catalog.js`, or derived gameplay decisions.

This explicitly rejects live request/playback even though EL-01/EL-04 document streaming and EL-07 demonstrates dynamic caching. Those documented online patterns contradict the project’s offline-local-first runtime constraint.

## Observer-event mapping

**[OBSERVED LOCAL CONTRACT]** `defense-run-simulation.js` emits versioned events with `tick` and optional cue IDs; `defense-audio.js` already maps observer-only event types such as `STAGE_STARTED`, `EXTRACTION_COMPLETED`, `OCCUPATION_CAPTURED`, `SKILL_CAST`, `BOSS_SPAWNED`, and `TERMINAL` to `AUDIO_CUES`. `defense-cutscene.js` explicitly states it observes events only. This report proposes assets that replace/augment an observer cue, never an event or rule.

| Runtime observer event / authored presentation | Asset role | Candidate imported output | Local fallback/invariant |
|---|---|---|---|
| `STAGE_STARTED` plus `CUTSCENES[stage].intro` text | Narration | One short Korean Stage 1–10 entry line; TTS candidate. | Present `role=status`/visible cutscene immediately; optional `stage-start` procedural cue or silence. |
| `ELITE_CANDIDATE_AVAILABLE`, `EXTRACTION_PROGRESS`, `EXTRACTION_COMPLETED` | SFX | Bind/Extract confirmation one-shot; sound-effect candidate. | Existing `extraction-ready` / `elite-extracted` cue or silence; no change to eligibility/extraction result. |
| `OCCUPATION_PROGRESS`, `OCCUPATION_CAPTURED`, `OCCUPATION_INTERRUPTED` | SFX | Capture/command pulse, non-looping short effect. | Existing `occupation-captured` / `impact-hit`; gate/node state remains text/UI-readable. |
| `SKILL_CAST` for Domain or other authored skill, `BOSS_SPAWNED`, gate-pressure events | SFX and optional narration | Domain resolve, boss/gate warning stinger; a Korean command line only when it mirrors an existing authored cutscene/objective. | Existing `skill-cast`, `boss-spawned`, `impact-hit`, plus objective/status text; audio must not create a timing window. |
| `TERMINAL` outcome and final Stage 10 Archive ending | Narration + optional music tail | Short final narration and optional instrumental tail, both pre-rendered. | Existing terminal tone and complete text ending; stopping/failed music cannot delay terminal state or archive completion. |
| Ambient/music layers | Ambient/music | Approved static loop or instrumental bed, started/stopped solely by presentation state. | Existing procedural ambience/music or silence. Never map music to a simulation condition that changes play. |

No event creates a provider prompt or chooses a runtime asset by nondeterministic remote output. Event-to-cue lookup is static, reviewable, and keyed by authored IDs.

## Risks and contradictions

1. **Online capability conflicts with offline product.** ElevenLabs documents HTTP/WebSocket/streaming paths, but any live use would add network availability, latency, provider quota, and credential exposure as gameplay dependencies. **Resolution:** hard runtime ban above; build only.
2. **Rights/plan ambiguity.** EL-08 draws a commercial/non-commercial distinction and makes use subject to terms; EL-04 points to music-specific terms. Cached/downloaded bytes do not erase those obligations. **Resolution:** no music or provider-derived asset imports without per-asset rights review; record the exact terms URL/date and plan context. This is product/legal process, not legal advice.
3. **Voice authority leak.** A voiced command can sound like a mechanical instruction even when it conflicts with the UI or rules. **Resolution:** narration scripts are traceable to canonical visible text; `defense-catalog.js`/simulation/UI win on conflict; reject a line that promises a hidden bonus, timing, or command.
4. **Accessibility regression.** Voice-only narration and uncaptioned meaningful SFX exclude users; music can mask speech. **Resolution:** immediate visible Korean text, ARIA status, caption/transcript IDs, independent volume/mute, and ducking that is cosmetic only. Follow ACC-01; reduced-motion remains a no-animation path, not a loss of text feedback.
5. **Reproducibility drift.** Regeneration can produce different bytes/audio for a similar prompt, while provider models/terms may change. **Resolution:** never regenerate in runtime or overwrite an approved asset in place; retain source/final hashes, model/voice metadata when available, prompt/script hashes, review decision, and immutable content-addressed release file.

## Abyssal implications and measurable targets

1. **[TARGET] Narration budget:** one sentence/line per presentation event, Korean source text under 120 grapheme clusters, target final duration 1–12 seconds. The text status is rendered before any playback attempt. Reject if it contains a mechanical promise not present in the stage objective/catalog trace.
2. **[TARGET] SFX density:** only state-boundary cues above; no provider-derived sound for per-tick movement, automatic fire, projectile impact, or damage. Target at most one imported high-salience SFX trigger per event key within 250 ms; retain the existing refractory behavior for high-frequency procedural cues.
3. **[TARGET] Asset budget:** narration ≤250 KiB each; short SFX ≤100 KiB each; ambient/music loop ≤1 MiB each after final encoding. Every final file has a SHA-256, decoded duration, loudness/true-peak result, and offline cache test.
4. **[TARGET] Rights gate:** 100% of new imported assets have a source class, actual provider/model/voice information when available, terms URL/date, rights attestation, prompt/script ID, and named human approval. Missing field rate must be 0%; any missing field blocks merge.
5. **[TARGET] Offline fallback:** in a network-blocked fresh/reload test after service-worker installation, 100% of mapped player moments retain their UI/cutscene text and deterministic outcome whether the corresponding audio file loads, fails decoding, or is absent.

## Experiments and telemetry

No gameplay-time provider telemetry is allowed. Use only local/offline, bounded event observations already compatible with the game’s privacy model.

| Experiment | Method | Pass/fail evidence |
|---|---|---|
| Build separation | Static scan of production JS/HTML/service worker for ElevenLabs hostnames, SDK package names, provider endpoint patterns, token/key patterns, and remote `audio` URLs. | Pass only with zero provider network/credential surfaces. Review the compiled/static output, not just a source allowlist. |
| Offline observer replay | Install/cache the PWA, block network, then replay fixed deterministic inputs through each mapped event. Repeat with valid local file, forced audio decode/load failure, and missing asset. | Event sequence/tick order/snapshot hash and terminal outcome match across all three runs; text/status/cutscene remains available. |
| Authority-leak test (**required failure mode**) | Inject a deliberately contradictory candidate narration line (for example, one saying a command grants an unlisted bonus) in the staging request. | Intake/content review rejects it before import. If it reaches a release asset map or a player-visible cue, the gate fails. |
| Accessibility and mix | Trigger narration, meaningful SFX, and terminal ending with audio muted and with reduced-motion enabled; compare visible text, ARIA status, captions/transcript, focus, and objective state. Measure narration intelligibility with a Korean-speaking reviewer and speech-over-music audibility at the chosen mix. | All mechanical information is available without audio/motion; captions include meaningful non-speech cues; reviewer result and mix measurement are recorded. |
| Provenance/reproducibility | Recompute final hashes and decode measurements from the staged/release file; compare to sanitized manifest and private request/approval record. Attempt a same-filename replacement with different bytes. | All hashes/measurements match; replacement is rejected unless it is a new reviewed release record with rollback evidence. |
| Fairness across audible and non-audible paths (**required failure mode**) | With the same fixed replay, compare two predeclared cohorts: audio-enabled Korean-speaking reviewers and audio-muted/caption-only reviewers. Ask each to identify the current objective/command and the terminal result from the canonical UI; do not score combat performance or collect identity data. | For every scripted prompt, both cohorts reach 100% correct objective/result comprehension from canonical text/UI. Any cohort-specific shortfall, or a task solvable only from sound, fails the asset gate; revise text/captions/mix and repeat. |
| Candidate quality A/B (optional, offline) | Randomize only local pre-rendered variant IDs for a fixed event cohort; collect bounded anonymous local counters such as `cueId`, load/fallback outcome, mute state, and replayed event key. Do not collect provider/account/network data. | Evaluate comprehension and annoyance/mute rate separately from combat success. Do not change balance, pacing, RNG, or player targeting from results. |

## Acceptance checklist for a future implementation

- [ ] Official capability evidence remains linked and dated; documented fact, inference, and target are labeled separately.
- [ ] No credential, token, private URL, account identifier, raw provider response, or unreviewed media is committed.
- [ ] Runtime proves zero provider network paths and only same-origin committed audio paths.
- [ ] Every imported asset has complete provenance/rights/measurement metadata and an approved static fallback.
- [ ] Browser offline, decode-failure, mute, reduced-motion, and authority-leak tests pass with recorded evidence.
- [ ] Rate limiting and caching, if ever used, occur only in the private build operator path; they cannot affect a player session.

**Current evidence status:** research complete; implementation, generated assets, rights clearance, and browser validation are **NOT-RUN**.
