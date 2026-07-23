# Presentation specification — observer-only semantic feedback

**Stage status:** Stage 1 and Stage 3 direction only. All performance, recognition, timing, responsiveness, and delivery values are **UNVERIFIED TARGETS**; **G1–G8 are NOT MEASURED / NOT PASSED** and release remains **BLOCKED**. G2 is receipt-integrity-only and is not assessed by this presentation packet. This document makes no claim that assets, cues, media, or an implementation already exist; **no media has been generated**.

## Observer boundary

`defense-catalog.js` and deterministic simulation resolve rules first. Every presentation request carries a stable source event/state identity such as `(simTick, entityId, kind, ordinal)` or an immutable `eventId`. HUD, Canvas, VFX, SFX, BGM, captions, narration, haptics, telemetry, and accessibility settings may read it and return only projection actions:

```text
showCaption | showStaticMarker | playLocalCue | requestVfx | requestHaptic | emitObserverTelemetry | suppress
```

They may not create/delay/merge/cancel a combat event, write health/Gate/skill/offer/reward/stage/persistence state, consume rules RNG, choose a PCG module, alter input ordering, use animation/audio completion as a rules clock, or retry through a gameplay-time network call. Missing assets, decoder stalls, mute, reduced motion, dropped frames, and observer suppression all resolve to no or fallback presentation while the source event remains unchanged.

## Attention hierarchy

| Rank | Meaning | Standard projection | Never displaced by |
| --- | --- | --- | --- |
| 1 | Imminent threat, confirmed player harm, W-03 Gate danger, boss first threat. | World-local boundary/directional marker plus stable player/Gate HUD. | Crits, normal hits, ambient art, narration. |
| 2 | Confirmed skill result, cooldown readiness, critical result. | Skill geometry/affected boundary, status shape, fracture-ring plus `CRIT`. | Texture or decorative stage motion. |
| 3 | Selected elite/boss identity, W-anchor and stage progression identity. | One anchored health/rank plate, concise placard/caption, icon/text. | Common-enemy bars or repeated bark variants. |
| 4 | Normal automatic hits, ambient texture, exertion. | Bounded/aggregated local impact, optional sound. | Any active rank 1–3 state. |

Lower ranks must not cover, recolor, intersect, or lower the contrast of an active rank-1 protected zone. Common enemies do not receive persistent health bars. The density governor is a proposed capture-test contract: rank-4 coverage <=18% of viewport at alpha >=0.15, <=8% within 160dp of rank-1 boundaries, no more than six rank-4 emitters/two aggregate labels per 500ms within 160dp of the player, and zero rank-4 intersection with protected zones. All are **UNVERIFIED TARGETS**.

## Event-to-observer rules

| Resolved source | Observer projection | Standard mode | Reduced-motion / failure fallback | Forbidden return path |
| --- | --- | --- | --- | --- |
| Hostile telegraph / W-03 state change | Threat adapter | Patterned world contour/edge direction marker; optional P0 cue. | Static outlined/patterned boundary, icon/text and Gate state; no shake/flash/pulse required. | Cue cannot schedule impact, decide safe time, or repair Gate Integrity. |
| `damage_resolved` | Damage adapter | HUD decrement, local directional wedge, compact impact cue. | Same text/icon/fill and one static wedge; no full-screen red wash. | HUD/VFX cannot apply or negate damage. |
| `critical_resolved` | Critical adapter | Angular fracture-ring, `CRIT` token, optional cue. | Static ring + `CRIT` icon/text; no fragments, scale, flash, or sound requirement. | Crit feedback cannot reroll/boost damage or advance RNG. |
| Skill resolved / cooldown state | Skill adapter | Confirmed origin/area/resolve geometry; radial/wedge gauge and ready shape. | Static sigil/outlined affected area; stepped fill, numeric option, ready border. | HUD cannot choose target, accepted tick, cooldown, or effect area. |
| Elite/boss arrival/state | Identity adapter | Spawn locator, boss silhouette/rank, one boss plate; optional arrival sting. | Static source-location frame and persistent rank/health plate. | Music/VFX/narration cannot spawn, target, or defeat a boss. |
| Stage entry/objective map state | Stage adapter | Narrow edge placard + world ingress/objective marker. | Static top/edge placard and committed marker; no movement lock. | Renderer cannot select map, reveal/relocate objective, or alter route. |
| `stageResultCommitted` | W-05 result adapter | Caption-first recap, optional local voice/BGM transition. | Static, dismissible result text with Archive marker. | Delivery cannot award, retain run skills, restart, or unlock stage. |
| Validated `resumeSummaryReady` | Archive adapter | Optional quiet caption/voice plus stored receipt. | Static receipt; indefinite review, no auto-dismiss. | No narration/clock reads can calculate credit, grant it, or simulate absence. |

## Standard audio and narration direction

- **BGM:** four observer-only stems—abyssal bed, pressure rhythm, command texture, boss weight. A confirmed state can request a stem transition; bar alignment can delay only the local stem change, never the state/event. **UNVERIFIED TARGET:** no more than one full bed-transition request per four seconds and no base-bed restart in a 60-second boss fixture.
- **SFX:** protect P0 threat/damage, then P1 arrival, then P2 skill/critical, before P3 basic attack. Bucket normal automatic hits into 125ms windows at no more than eight emitted basic impacts per second. Criticals must remain distinguishable but never duck P0 danger. All numeric values are **UNVERIFIED TARGETS**.
- **Narration:** use authored, one-sentence, caption-first command-log beats only from confirmed allowlisted fields. **UNVERIFIED TARGET:** combat-time lines are <=12 words and no non-emergency line is introduced within eight seconds of its predecessor. A Stage 10 line observes campaign completion only; it never implies a new stage.
- **W signatures:** W-01 Echo, W-02 Bind, W-03 Gate Integrity, W-04 Domain, and W-05 Archive may each receive a sparse original cue/icon shape, but all retain text/static semantics in mute, mono, missing-asset, and reduced-motion modes.

## Build-time-only external audio boundary

ElevenLabs is not a runtime system in this design. Any future provider-derived narration, music, or SFX must be generated/imported by an authorized build-time process after per-asset rights review, then shipped as reviewed, content-hashed same-origin local files with provenance metadata. The production bundle must contain **no** provider SDK, API token, credential, HTTP/WebSocket/streaming call, signed URL, runtime generation, runtime retry, or gameplay-time provider telemetry. This package does not request, store, or accept secrets.

## Accessibility projection matrix

| Semantic state | Standard enrichment | Reduced-motion fallback | Sound-off/mono fallback | Invariant |
| --- | --- | --- | --- | --- |
| Threat / Gate danger | Bounded contour animation + P0 cue. | Static patterned boundary and edge direction. | Same boundary, icon/text; audio optional. | Location, affected area, resolved state/tick. |
| Player/Gate health | Fill transitions and compact damage tail. | Static fill, label, number/icon, wedge. | Same HUD; no sound needed. | Health value and player-vs-Gate distinction. |
| Critical | Brief glyph/fragments + cue. | Static fracture ring/`CRIT`. | Static glyph/token; cue optional. | Resolved crit identity, not damage amount. |
| Skill/cooldown | Motion path/radial gauge/ready cue. | Static area outline + stepped fill/ready border. | Icon/text/numeric option. | Confirmed result and ready/not-ready state. |
| Boss/stage | Locator/placard, sting, BGM weight. | Static location/rank/stage marker. | Caption and anchored plate. | Spawn/stage identity and rules state. |
| Narration/result/return | Voice, caption, restrained transition. | Caption/log/static receipt. | Caption/log/static receipt. | Committed state exists and input/rules continue independently. |

No essential state may rely on color, sound, stereo, haptic, flash, continuous motion, or a central blocking panel. The source-derived flash ceiling of no component above three flashes per second remains a safety constraint; it is not a claim of platform conformance.

## Stage 3 presentation readiness — build direction, not a build result

**Decision enabled.** Designers, implementation owners, audio owners, and QA can prepare one bounded presentation slice without letting feedback become a second combat system. This section specifies proposed contracts and future evidence only; it neither authorizes assets/code/provider integration nor records a measured gate result.

### Effect language and hierarchy

The visual baseline is quiet, bounded, and semantic: geometry identifies the fact, a non-color pattern/text/icon preserves it, and palette supplies only secondary affect. Use the established canon without copying external content:

| Semantic family | Proposed visual language | Rank and protected reading | Static equivalent |
| --- | --- | --- | --- |
| W-01 Echo / confirmed normal contact | Broken crescent or compact contact stamp directed from observed source to resolved target. | Rank 4 texture; aggregate/cull before any survival state. | One fixed crescent/stamp; optional numeric label omitted under density. |
| W-04 Domain / resolved skill area | Asymmetric lattice or authored sigil clipped to the authoritative observed area. | Rank 2 command result; never implies collision outside that area. | Fixed sigil plus outlined observed boundary/path and resolve icon. |
| Critical result | Angular fracture ring plus localized `CRIT` token; it overlays a confirmed result rather than replacing it. | Rank 2 outcome; lower than active threat or survival state and never a flash/shake requirement. | Fixed ring plus token/icon. |
| Player or W-03 Gate loss | Stable edge-HUD fill, number/icon, and local broken-chevron directional wedge when the source is known. | Rank 1 survival; player and Gate remain visibly distinct. | Identical fill/number/icon/wedge; no full-screen wash. |
| Cooldown / ready state | Stable edge gauge: wedge/bar while unavailable, distinct open/ready border when observed ready. | Rank 2 command state; it never becomes an aim, attack, or target control. | Stepped fill, numeric option, and lock/open shape; no radial spin. |

An active harmful telegraph and confirmed player/Gate loss outrank every other projection. Resolved skill/cooldown and critical feedback follow; elite/boss identity follows; normal automatic-hit particles and ambient texture are disposable. A lower rank must be suppressed or made static rather than cover, recolor, or intersect a higher-rank protected zone. Essential state must not depend on color, sound, stereo, haptics, flash, continuous motion, or a central blocking panel.

### 60 Hz observer boundary and timing windows

The fixed simulation is the only 60 Hz authority. A presentation adapter receives immutable ordered observations such as `{eventId, simTick, sequence, type, subjectId, sourceId, targetId, authoritativeArea, healthAfter, cooldownState, readyTick}` and may issue a local projection disposition only. Its stable key is `(eventId, recipeVersion)`; variation, if ever used, derives only from `hash(eventId, recipeVersion)`.

- An effect, caption, audio cue, haptic, telemetry record, cull, or missing-asset fallback is downstream. It cannot create, defer, merge, cancel, predict, or reinterpret a combat result; alter input ordering; consume rules RNG; choose target/area; write health, Gate, cooldown, reward, stage, receipt, or persistence state; or use frame/audio/animation completion as a rules clock.
- An attempted, rejected, unresolved, duplicate, or schema-invalid action receives no semantic success projection. A missing authoritative area means no inferred skill area; a missing cooldown fact means no inferred readiness; a missing health fact means no displayed health result. Local logs may say `suppressed`/`schemaRejected`, never fabricate a gameplay outcome.
- Renderer cadence may interpolate between source ticks, but start, expiry, coalescing, culling, and static substitution remain tick-bounded. Input continues through the normal simulation path under every presentation profile; no camera impulse, hit-stop, decoder stall, narration completion, or cue queue may pause or reorder it.
- **Target safety ceiling:** no component flashes more than three times in any one-second interval. This is a capture-review constraint, not a platform-conformance claim.

| Observed semantic fact | **Target** start and bounded window at 60 Hz | Standard projection | Reduced-motion projection |
| --- | --- | --- | --- |
| Confirmed player/Gate decrease | HUD update begins within two rendered frames after observation; one tail for 24 ticks (400 ms). | Edge-HUD transition plus local wedge. | Same stable HUD state plus static wedge. |
| Confirmed critical | Starts from the same resolved damage observation; 12–18 ticks (200–300 ms); one full flourish per target per 20 ticks, then glyph-only. | Fracture ring, token, optional P2 cue. | Ring and token only. |
| Resolved skill | Starts only after a resolved skill observation with authoritative area; 24–42 ticks (400–700 ms). | Sigil, bounded area/path, resolve mark. | Static sigil, exact outlined area/path, resolve icon. |
| Observed cooldown change / ready | Gauge reflects observed state no slower than every six ticks; ready settles for 10 ticks. | Gauge and ready shape; optional P2 cue after readiness is observed. | Stepped fill and open/lock shape; no spin or bounce. |
| Normal confirmed hit | 9–14 ticks (150–233 ms); aggregate rather than increase density. | Local crescent/stamp; optional P3 texture cue. | Static stamp or suppression under density. |

### Audio-cue handoff

Audio receives the same immutable observer envelope after the visual adapter has classified its semantic family. It may log `candidate`, `queued`, `played`, `bucketed`, `preempted`, `suppressed`, or `deviceFailed`; that disposition is presentation evidence, not a rules event. P0 threat and confirmed player/Gate damage may pre-empt lower-priority audio; P2 skill/critical may replace P3 normal-hit texture; P3 normal hits enter a proposed 125 ms bucket with at most eight emitted basic impacts per second. Music-bar alignment can defer only a local stem transition. Narration remains caption-first, allowlisted, and optional: queue, skip, mute, decoder failure, and completion cannot affect a timing window, stage, reward, or ending.

No runtime provider is authorized. The known conditions remain blocking facts: ElevenLabs credentials and rights are unavailable; any future media would require separate approved rights/provenance review and a local build-time manifest. This document creates no asset brief execution, provider request, generated media, or rights-cleared delivery.

### Stage 3 delivery and 60 Hz evidence matrix

Every row is a future **TARGET** and remains blocked until its named evidence exists and is independently reviewed. Paths are required evidence destinations, not evidence claimed to exist.
For reproducible profile selection, the future fixture manifest must identify `P-STD`, `P-RM`, `P-MUTE-MONO`, `P-MISSING-ASSET`, `P-D0`, `P-D1`, `P-D2`, `P-D3`, `P-D4`, and `P-BLOCKED-AUDIO`; each profile may alter only named local observer choices.

| Proposed delivery / target | Owner | Verification method | Required evidence path | Current blocker |
| --- | --- | --- | --- | --- |
| Semantic recipe register: every rank 1–3 recipe declares source event/state, anchor, fixed tick window, protected-zone rule, static equivalent, and fixed cost/cull path. | Design owner | Schema/manifest review against the observer contract; reject undeclared or looping recipes. | `qa/evidence/stage3/presentation/recipe-register-review.json` | No implementation or reviewed local manifest; assets are not generated. |
| Feedback hierarchy holds in a dense 60 Hz replay: target zero rank-4 overlap with active rank-1 boundary; target rank-4 coverage no more than 18% viewport and 8% of protected zone. | QA + design owner | Per-frame semantic masks over scripted dense, crit-chain, and multi-telegraph fixtures at declared logical targets. | `qa/evidence/stage3/presentation/density-and-protected-zone-report.json` | No capture fixture or measured masks. |
| Flash safety holds across the combined combat surface: target no component exceeds three flashes in any one-second interval, including saturated-red/high-brightness review. | QA + design owner | Largest-logical-viewport capture analysis plus manual combined-effect review; reject a recipe rather than relying on a player-only warning. | `qa/evidence/stage3/presentation/flash-safety-capture-review.json` | No high-density capture, combined-effect analyzer, or reviewed recipe set. |
| Critical, player/Gate health, and cooldown remain distinguishable without color, motion, or audio: target at least 90% critical classification and at least 95% player-vs-Gate / cooldown-state classification. | QA owner | Counterbalanced static-card and reduced-motion participant study; color simulation is prefilter only. | `qa/evidence/stage3/presentation/static-semantic-study.json` | No participant study, capture cards, or accessibility review. |
| Event-to-presentation fidelity: target one source-backed rank 1–3 semantic disposition per eligible resolved observation, target zero semantic-success dispositions for rejected/unresolved/invalid observations, and target zero inferred area, health, or readiness facts. | Presentation implementation owner + QA | Join immutable observer records to local adapter decisions by `(eventId, simTick, sequence, recipeVersion)`; inject invalid/attempted/missing-field cases. | `qa/evidence/stage3/presentation/observer-fidelity-differential.json` | No adapter/log schema or negative fixtures. |
| Input/control responsiveness survives presentation pressure: target equal normalized input order/vector and identical 60 Hz simulation event/checkpoint hashes across `P-STD`, `P-RM`, `P-MUTE-MONO`, `P-MISSING-ASSET`, `P-D0`–`P-D4`, and `P-BLOCKED-AUDIO`; visual confirmation latency is recorded, not inferred from a pass. | QA + controls owner | Replay the same movement micro-fixture and dense combat fixture with the manifest-selected observer profiles; compare canonical streams before reviewing local latency samples. | `qa/evidence/stage3/presentation/60hz-input-and-observer-invariance.json` | No paired replays, input trace, profile manifest, or canonical hash receipt. |
| Timing windows are bounded: target health begins within two rendered frames and tails for 24 ticks; critical persists 12–18 ticks with at most one full flourish/target/20 ticks; skill persists 24–42 ticks; cooldown samples no slower than six ticks and ready settles for 10 ticks; normal hits persist 9–14 ticks; and no cue/camera/audio completion pauses input or rules. | Presentation implementation owner + QA | Tick-indexed trace review under 30/60/120 Hz render adapters and simulated decoder/device delay; assert each start, expiry, coalescence, and ready transition against its source `simTick`. | `qa/evidence/stage3/presentation/tick-window-and-render-cadence-report.json` | No tick-indexed adapter trace, delayed-device fixture, or profile manifest. |
| Audio handoff preserves semantic priority: target zero P0/P1 losses caused by P3 exhaustion; target all muted/mono/device-failed paths retain visual/caption equivalents; P3 disposition is bucketed/pre-empted/suppressed rather than replayed as a gameplay fact. | Audio owner + QA | Event-to-cue disposition audit with effects muted, mono, Comfort mix, and simulated device failure. | `qa/evidence/stage3/presentation/audio-handoff-and-fallback-report.json` | No approved local cue manifest, rights clearance, device fixture, or audio capture. |
| Presentation resource safety: target no runtime provider/network path, no unreviewed generated asset, and no authority-bearing asset callback. | Resource/release owner + QA | Source/manifest/network-off inspection plus observer-boundary review. | `qa/evidence/stage3/presentation/resource-and-authority-boundary-report.json` | gti is dry-run only; ppgen has no compatible provider; Blender inspection timed out; provider credentials/rights are unavailable. |

**Gate status after this section:** the matrix defines future evidence only. **G1–G8 remain NOT MEASURED / NOT PASSED; G2 remains receipt-integrity-only; release remains BLOCKED.**

## Required future evidence

| Claim | Required evidence | Status |
| --- | --- | --- |
| Observer settings do not change deterministic results. | Same seed/input/clock at normal/reduced motion, mute/mono, missing assets, renderer variants, 30/60/120Hz; byte-identical hashes. | **UNPASSED** |
| Semantic feedback remains readable. | First-seen visual/audio/caption probes; static-capture health/crit/cooldown/boss/objective tests. | **UNPASSED** |
| Density is safe and does not hide survival information. | Rank masks, occlusion report, flash review, and peak-load capture. | **UNPASSED** |
| Audio is offline/build-time-only. | Network-off trace, asset/provenance manifest, source scan for live provider paths. | **UNPASSED** |
| Stage/world narration is factual and terminal-safe. | Event-to-beat trace, allowlist rejection tests, Stage 10 completion fixture. | **UNPASSED** |

## Research basis

- `research/vfx-hud-feedback.md`, `research/vfx-and-particle-direction.md`, `research/combat-feedback-survey.md`, `research/combat-feedback-controls.md`, `research/controls-accessibility.md`
- `research/audio-narration-direction.md`, `research/elevenlabs-integration.md`, `research/narrative-stage-presentation.md`
- `research/combat-systems-balance.md`, `research/pcg-map-grammar.md`, `research/stage-world-procedural.md`
- `research/telemetry-playtest-contract.md`, `research/qa-measurement-protocol.md`
- `.survey/abyssal-command-systems-expansion/{context,solutions}.md`
- Current product contract: `_workspace/20260722-defense-survival-expansion/design/gameplay-contract.md`
