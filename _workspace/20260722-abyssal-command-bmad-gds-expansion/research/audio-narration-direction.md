# Audio and narration direction: readable abyssal command

## Research question and scope

How should *Abyssal Command* use BGM, arrival, attack, skill, critical, exertion, and narration cues to make dense automatic combat legible without granting presentation authority over the deterministic 60 Hz rules simulation?

This packet is a sound-direction and observer-contract proposal. It does not specify combat rules, stage narration copy, soundtrack production, or a third-party audio middleware choice. **Target** means an original, testable product threshold—not a source-derived fact. Cue names below are proposed integration names, not asserted current identifiers.

## Non-negotiable observer boundary

`defense-catalog.js` remains the authored-rules authority. The fixed-step simulation publishes ordered, immutable result records; audio, captions, music, VFX, narration, and haptics consume those records or a rendered snapshot. They may never create, defer, merge, cancel, or reinterpret a simulation result.

- A proposed observer envelope is `{ eventId, simTick, sequence, family, subjectId, sourceId, result }`, where `eventId` is stable for the resolved rule event and `sequence` resolves same-tick order. The audio runtime may derive a deterministic local variation from `hash(eventId, cueFamily)`, but may not consume simulation RNG or write back state.
- A music bar, a voice line, device autoplay state, decoding delay, muted setting, or an exhausted voice pool can change **only what is heard**. They cannot hold an enemy arrival, postpone damage, lengthen an immunity window, or gate the Stage 10 ending.
- Audio choices are local presentation preferences. A deterministic replay records the simulation event stream and relevant audio preset for diagnostics; the simulation hash must remain identical with all buses muted, all buses enabled, mono, reduced-audio, and reduced-motion.

## Source ledger

| ID | Source / provenance | Observed factual support | Bounded use in this packet |
|---|---|---|---|
| E1 | [Wwise Help: Music transitions](https://www.audiokinetic.com/en/library/edge/?source=Help&id=music_transitions.html), Audiokinetic official product documentation; primary | Documents transition rules between music objects, synchronization points, fades, and transition segments. | Supports treating BGM as independently transitionable layers, not as a simulation clock. It does not prescribe a game’s cue taxonomy or mix values. |
| E2 | [Unity Manual: Audio Mixer](https://docs.unity3d.com/Manual/AudioMixer.html), Unity official documentation; primary | Documents mixer groups, effects, routing, snapshots, and exposed parameters for runtime mixing. | Supports a bus-based mix/duck implementation pattern. This report does not require Unity or claim engine-specific behavior elsewhere. |
| E3 | [Xbox Accessibility Guideline 103: Visual and audio cues](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103), Microsoft official accessibility guidance; primary | States that critical visual and audio information should be expressed through multiple sensory methods, and that haptics need another cue. | Requires an independently readable visual path for every player-relevant sound. |
| E4 | [Xbox Accessibility Guideline 104: Subtitles and captions](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/104), Microsoft official accessibility guidance; primary | Distinguishes subtitles (speech) from captions (all relevant audio) and calls for context such as speaker identification and sound location where needed. | Supports captions for narration and meaningful arrival/threat sounds, not a transcript of every ordinary hit. |
| E5 | [Xbox Accessibility Guideline 105: Custom volume controls](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/105), Microsoft official accessibility guidance; primary | Recommends independent controls for music, narration/voice-over, active and ambient effects, and a stereo-to-mono option for important directional audio. | Supports separate buses and mono-safe critical cues. It is guidance, not a certification claim. |
| E6 | [Xbox Accessibility Guideline 106: Screen narration](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/106), Microsoft official accessibility guidance; primary | Covers narration access to essential on-screen information and use of platform or game narration. It does not prescribe one universal spoken-word rate. | Keeps menu/UI narration distinct from authored in-combat voice; speech-rate numbers below are targets to test, not source claims. |
| E7 | [Game Accessibility Guidelines: full list](https://gameaccessibilityguidelines.com/full-list/), industry guideline collection; secondary | Recommends no sound-only essential information, distinct key-event sounds, separate music/effects volume, and sound alternatives. | Corroborates the sensory redundancy and control pattern; it is not a platform standard. |

### Source-quality notes

E1–E6 are primary/official documentation or guidance. E7 is domain guidance. The sources establish controllability, cue redundancy, caption context, and transition/mixer capability; they do **not** establish that a particular cue, loudness number, voice cadence, or retention outcome is correct. Those are explicitly bounded targets below.

## Observed patterns and synthesis

1. **Interactive music is a transition problem, not a rules clock.** E1 allows music objects to use transitions, synchronization, and fades. For this game, a boss-arrival event can start a sting immediately while a bed changes at a musically clean boundary; neither option may delay the arrival event already resolved by simulation.
2. **A dense mix needs a hierarchy, not one sound per hit.** E2’s group/effect/routing pattern makes it feasible to reserve headroom for player-threatening information while coalescing plentiful basic attacks. The source documents the tooling pattern, while the priority policy is this report’s inference.
3. **Narration is a semantic channel, not combat telemetry.** E4 and E6 support spoken information and accessible text equivalents. A voice line should summarize a durable, player-relevant change, not narrate every proc, kill, or target swap.
4. **Critical audio must have a non-audio equivalent.** E3/E5/E7 make stereo hearing, effects volume, haptics, and any individual frequency range unsafe as requirements for success. Spatial flavor is allowed; location, threat state, and outcome remain visually legible without it.
5. **Captions need triage in high density.** E4 supports captions for relevant non-speech sound and context. Captions for every basic strike would conceal the field and defeat their purpose, so the accessibility layer should expose arrival, player damage, Gate danger, skill state, narration, and selected high-priority criticals—not normal-hit spam.

## Proposed cue taxonomy and deterministic bindings

All rows are presentation observers. `eventId` is the stable resolved event identifier supplied by the simulation/snapshot bridge; the proposed `family` names constrain audio routing and testing. W-01 through W-05 are canon anchors, not new mechanics.

| Priority / bus | Proposed family and event binding | Cue role and original palette | Binding / anti-authority rule |
|---|---|---|---|
| P0 · Threat / Active FX | `combat.threat.onset` from a resolved hostile-telegraph event; `gate.integrity.changed` from `W-03` integrity result | Short low-mid warning contour with a dry edge transient; no long tonal tail. Gate danger adds a restrained pressure pulse. | One cue instance per `eventId`; world/HUD telegraph is primary. Audio never supplies a pre-impact deadline or collision timing. |
| P0 · Player state | `combat.player.damage.resolved` | Compact impact plus a directionally flavored but mono-complete transient. | Fires only after damage has resolved. It does not predict damage or own invulnerability feedback. |
| P1 · Arrival | `combat.elite.arrived`, `combat.boss.arrived` | Enemy/boss arrival = 250–500 ms identity sting over a held, non-directional weight. One distinctive register/instrument family per boss class, without borrowed character motifs. | Once per `(eventId, subjectId)`. The spawn/state exists even if the sting is skipped or audio is unavailable. |
| P1 · BGM | `music.combat.state.changed`; `music.boss.state.changed` derived from observed stage/boss snapshot state | Four stems: abyssal bed, pressure rhythm, command texture, boss weight. W-03 raises pressure; boss state can add weight. | Stem start/fade is local. Musical bar alignment may delay only the stem change; it cannot delay the observed state or request a new state. |
| P2 · Command identity | `W-01.echo.triggered`, `W-02.bind.applied`, `W-04.domain.entered/exited`, `W-05.archive.recorded` | W-01: brief call/answer echo; W-02: constricting two-part clasp; W-04: wide filtered bloom; W-05: dry indexed chime. Each needs an icon/text counterpart. | Each is attached only to its confirmed rule result. A sound cannot cause a bind, extend a domain, repair Gate Integrity, or write Archive state. |
| P2 · Skill / critical | `combat.skill.resolved`; `combat.damage.critical.resolved` | Skill = cast/resolve identity pair only when the rule exposes both; critical = angular, bright-but-brief confirmation distinct from normal hit. | Keep `attempted`, `resolved`, and `critical` families separate. No cue on an attempt that does not resolve; no crit sound upgrades damage. |
| P3 · Basic attack | `combat.attack.basic.resolved`, `combat.damage.normal.resolved` | Low-occupancy click/brush pair chosen from deterministic event-id variation; aggregate layers imply volume rather than replay every projectile. | Per-bucket selection is presentation-only and must not combine/alter source simulation events. |
| P3 · Player exertion | `player.movement.exertion` derived from a sustained observed movement snapshot, never raw input alone | Quiet breath/gear/footing texture; use only during calm enough mix windows. | No exertion during narration or P0 cue. It cannot affect speed, stamina, targeting, or movement response. |
| P1 · Narration / VO | `narration.stage.marker`, `narration.canon.marker`, `narration.ending.marker` from confirmed stage/W-canon transition records | One concise, named-speaker line with caption; sparse command-log delivery rather than real-time commentary. Stage 10 ending is an observer of the completed ending transition. | Queue/skip/replay controls affect only delivery. A voice clip never advances a stage, releases a reward, or becomes required to understand a damage window. |
| P4 · Ambient / UI | `world.ambient.state`, `ui.focus.changed` | Low-density water/metal air, plus short non-combat focus cues. | Ambient yields to all higher priorities; UI sound does not confirm a rule result. |

### Priority and collision policy

1. P0 active threat/Gate and confirmed player-damage cues may pre-empt P1–P4 effects, but do not pre-empt a currently spoken accessibility/menu narration unless a player-danger cue needs to play; in that case the visual signal remains complete.
2. P1 boss arrival and narration have separate roles: arrival establishes immediate identity; narration is optional context. Arrival audio is not a prerequisite for the line, and narration is not a prerequisite for the fight.
3. P2 skills/criticals may replace a P3 basic-attack candidate in the same bucket. P3 has no claim on a voice or warning slot.
4. BGM and ambience are continuous presentation layers. They are never emitted as gameplay events and therefore cannot be used for scoring, timing windows, or replay verification.

## Mix, ducking, cadence, and repetition targets

The values in this section are original tuning targets for capture and playtest, not loudness standards or universal accessibility claims.

| Area | Proposed rule | Measurable target and evidence |
|---|---|---|
| Arrival/threat onset | Dispatch priority cue immediately from the observer envelope; do not wait for music synchronization. | **Target:** 95th-percentile enqueue-to-playback-start ≤100 ms in a controlled device build for `combat.threat.onset`, player damage, and boss arrival; record event, enqueue, and voice-start timestamps. |
| Voice intelligibility | VO sidechains BGM by **Target: 8 dB** and ambience by **Target: 4 dB** with 100 ms attack / 300 ms release; P0 threat and player-damage cues remain above the ducked buses. | **Target:** in a scripted dense-mix comprehension test, ≥90% of listeners identify the speaker’s 1-line message and the concurrent P0 cue’s category. Test stereo and mono separately. |
| Combat headroom | Every P3 basic-hit candidate enters a 125 ms bucket; emit at most one basic impact per bucket and at most 8 per second. P2/P1/P0 may replace, not stack with, the candidate. | **Target:** 0 P0/P1 cue drops caused by P3 voice exhaustion in 30-second dense replay logs; log proposed, played, pre-empted, and dropped counts by family. |
| Critical readability | Critical cue has a protected P2 slot but does not duck P0. | **Target:** ≥90% correct critical-versus-normal classification in isolated audio, and ≥85% during the dense mix; rerun with mono output. |
| Narration cadence | Use one sentence, **Target: ≤12 words** for combat-time lines. Do not introduce a new non-emergency line within **Target: 8 seconds** of the prior line; coalesce superseded lines into the latest durable state. | **Target:** ≥90% caption/voice message recall after a 30-second boss fixture, while no line is cut off by another narration line. Log queue age, coalescence, skip, and completion. |
| BGM behavior | Bed-to-pressure/boss stem transitions fade rather than retriggering the whole music bed; boss arrival uses its own one-shot. | **Target:** no more than one full bed transition request per 4 seconds and no restart of the base bed during a 60-second continuous boss fixture; analyze music-state transition log. |
| Repetition variation | Select an asset via `hash(eventId, family) mod variantCount`; avoid the immediately preceding variant for the same family when another exists. | **Target:** event-for-event audio variant sequence matches across two presentation-only replay runs using the same asset manifest; asset changes are manifest-versioned. |

### Duck and bus map

- **Master**: hard user control; never force a minimum volume.
- **Voice / narration**: authored dialogue, command-log speech, and compatible UI narration—separate control as E5 recommends.
- **Active FX**: P0–P3 combat cues; P0/P1 protected by priority, not by volume escalation.
- **Ambient**: water/metal bed and environmental texture.
- **Music**: four BGM stems; ducked for voice but never used to convey a required timing state.
- **Comfort mix (Target)**: reduces P3 impacts and player exertions first, caps non-essential arrival tails, and preserves captions/static feedback. It is not “mute danger and fail”; all safety-relevant meanings still have visual equivalents.

## Reduced-audio, reduced-motion, caption, and mono fallback matrix

| Meaning | Standard projection | Reduced-audio / mono / muted equivalent | Reduced-motion equivalent | Invariant |
|---|---|---|---|---|
| Hostile onset / Gate danger | P0 contour + possible stereo flavor, world/HUD telegraph | Static patterned world boundary, edge direction marker, Gate icon/text; captions only for major/selected alerts | No audio-driven pulse, shake, flash, or expanding ring required | Hazard location/state and resolved simulation timing |
| Boss arrival | P1 sting + boss-weight stem | Anchored boss identity/state panel, shape/rank marker, optional caption `[Boss arrives]` | Static identity/rank marker replaces animated arrival flourish | Spawn, boss state, and targetability |
| Basic automatic hit | P3 bucketed click/brush | May be silent; no replacement is required because it is non-essential texture | Compact static impact mark, or suppressed at density | Damage remains governed only by rules |
| Critical | P2 angular confirmation | Static angular glyph/`CRIT` label; optional high-priority caption setting | No flash or scale burst required | Critical result is distinguishable without sound/color alone |
| Skill / W-01, W-02, W-04, W-05 | Signature cue plus local visual | Icon/text status and readable local rule result; captions for selected major triggers | Static icon/pattern replaces bloom, echo expansion, or particle motion | Confirmed effect/state, not a decorative beat |
| Narration | Voice with named-speaker subtitle/caption | Caption/log with speaker label, review/skip control, independent voice volume | No camera or UI motion required to accompany speech | Stage/canon/ending state exists without clip completion |
| Player exertion | Quiet breath/gear texture | Suppressed in Comfort mix or mute; no rule information lost | No bob/shake is tied to it | Movement speed/input/result unchanged |

Captioning policy: speech receives subtitles with speaker identity; relevant non-speech P0/P1 cues receive optional captions with concise semantic and directional context when it matters (E4). Basic-hit captions are excluded by default to protect combat readability. Caption display, font/contrast/background, and volume controls need their own accessibility validation; no claim of platform certification follows from this proposal.

## Risks, contradictions, and failure tests

- **Authority leak — music quantization delays a boss.** A musically synchronized transition can tempt implementation to schedule the gameplay event on the next bar. **Failure test:** execute the same boss-arrival fixture with music disabled, a simulated 2 s decoder stall, and normal audio; **Target:** event IDs, simulation ticks, damage, and final state hash are identical. Audio may start late; rules may not.
- **Accessibility failure — headphones become a fairness advantage.** Directional audio can help, but mono speakers, hearing loss, and muted play cannot lose necessary hazard information. **Failure test:** first-seen threat-direction fixture in effects-muted, mono, and Comfort mix; **Target:** visual-only safe-direction accuracy ≥90% and no simulation/encounter outcome changes by preset.
- **Readability contradiction — every event is captioned or voiced.** E4 favors equivalents for relevant audio, while dense combat makes unbounded text/voice obscuring. **Decision:** reserve captions/VO for P0/P1/narrative status; aggregate or omit P3. **Failure test:** capture 30 seconds of highest-density combat; **Target:** 0 P3 captions and ≥95% correct recognition of concurrent P0 visual cue in a paused-frame test.
- **Repetition/implementation risk — local random variants make captures irreproducible.** A presentation RNG can make bug reports hard to compare, even without altering rules. **Failure test:** replay the same event log twice with a pinned asset manifest; **Target:** identical `(eventId, family, variantId, action)` playback decision logs. This does not require identical physical device latency.
- **Narration overload — voice masks a threat.** VO is supportive context, not an emergency channel. **Failure test:** inject a P0 cue during each narration cadence position; **Target:** P0 starts within its latency target and participants retain ≥90% correct threat-category identification, whether the VO is ducked, paused, or captioned.

## Experiments and telemetry packet

1. **Deterministic presentation-invariance replay.** Run scripted baseline, dense, W-01/W-02/W-04/W-05 transition, Gate-critical, boss-arrival, and Stage 10-ending fixtures with standard, all-muted, mono, Comfort mix, reduced-motion, and a simulated blocked audio device. Persist `eventId`, `simTick`, render-snapshot ID, playback decision, asset-manifest version, bus preset, and final simulation hash. Gate: **Target: identical simulation event sequence and final hash for every preset.**
2. **Dense-mix comprehension study.** Use 30-second first-seen clips with audio-only, visuals-only, stereo, mono, Comfort mix, and reduced-motion conditions. Measure threat category, safe direction, critical-versus-normal recognition, boss identification, speaker/message recall, and reported overload. The values in the mix table are gates to validate or revise, not facts assumed true.
3. **Voice/caption cadence audit.** Instrument each line’s trigger tick, enqueue time, play start/end, caption start/end, coalesced predecessor, skip, and interruption reason. Gate: no overlapping non-emergency lines, cadence target met, and captions remain available even if audio playback fails.
4. **Mix-load and omission audit.** On each fixture log every candidate cue and its disposition: played, bucketed, pre-empted, ducked, expired, or suppressed by user setting. Gate: P3 may be suppressed; P0/P1 must never be silently lost to P3. A bus setting can intentionally mute them only when the matching visual/caption fallback remains present.
5. **Accessibility review.** Validate separate bus controls, mono-safe rendering, captions, visual-only gameplay readability, Comfort mix, and reduced-motion static equivalents with disabled/limited audio. Confirm no sound, voice, haptic, stereo direction, or music bar is the exclusive source of a required gameplay state.

## Abyssal implications

1. **[Target] Build audio from resolved event records, never animation callbacks.** This gives every cue a debuggable event ID and makes “audio did not play” a presentation defect rather than a combat-state ambiguity.
2. **[Target] Treat W-01 Echo, W-02 Bind, W-03 Gate Integrity, W-04 Domain, and W-05 Archive as five sparse sonic signatures, each paired with static icon/text semantics.** Their identity should survive muted, mono, Comfort mix, and reduced-motion play.
3. **[Target] Spend mix headroom on danger, damage, arrival, and meaningful resolved powers; bucket ordinary automatic attacks.** Dense combat should sound active without converting every projectile into an equal-priority notification.
4. **[Target] Use narration as an interruptible command log with a caption/log path, not as an action timer.** Stage 10’s ending transition may be celebrated by audio, but ending completion is neither delayed by nor dependent on its line.
5. **[Target] Pin cue-choice decisions to `eventId` and an asset-manifest version.** This preserves replay diagnosis without making audio playback a deterministic simulation dependency.

## Handoff summary

Abyssal sound should be a finite attention system: threat and confirmed survival state first, arrival and resolved powers second, automatic-hit texture last. BGM layers and narration can make the abyss feel directed, but the 60 Hz rules simulation remains sovereign. Every essential sound has a static visual/caption alternative, and every audio setting—including silence, mono, reduced-audio, and delayed playback—leaves the rules outcome untouched.
