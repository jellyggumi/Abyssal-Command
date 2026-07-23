---
gate: G1/G4/G6
owner: audio-designer
status: implemented-audio-acceptance
public_beat: playable defense-survival candidate plus gameplay video
---
# Offline procedural audio detail report

## Delivered scope

`defense-audio.js` now builds the presentation mix entirely from Web Audio oscillator and gain nodes. No fetched file, media element, decoded buffer, worklet, timer, or third-party package is involved. Audio remains an optional observer: failure cannot mutate, delay, or replace the deterministic 60 Hz simulation.

The sound language follows the authoritative loop **Gate defense → Echo recovery → growth → occupation/extraction → boss kill**:

| Beat | Procedural identity | Runtime binding | Trace |
|---|---|---|---|
| Gate entry | two-layer rising seal | `STAGE_STARTED` → `stage-start` | W-03 |
| Movement | short dry stone/armor pulse | `MOVE` direction transition → `movement-step` | W-03 |
| Weapon | square command transient plus triangular edge | `WEAPON_FIRED` / `ENEMY_ATTACK` → `weapon-fire` | W-04 |
| Impact / Gate pressure | low saw hit plus square body; lower denial variant | `PROJECTILE_IMPACT`, `COMMANDER_DAMAGED`, `GATE_BREACHED`, `HAZARD_DAMAGE`, `PICKUP_DENIED`, `ECHO_DENIED`, `OBJECTIVE_FAILED`, `EXTRACTION_REJECTED`, `EXTRACTION_INTERRUPTED`, `OCCUPATION_INTERRUPTED` → `impact-hit` | W-01, W-03, W-04 |
| Echo recovery | bright two-layer pickup/recovery mark | `ITEM_COLLECTED` / `TERRAIN_RECOVERY` → `item-collected` | W-01 |
| Growth | rising offer; a separate higher confirmation voicing for selection | `GROWTH_OFFER` / `SKILL_SELECTED` → `growth-offer` | W-01, W-04 |
| Active skill | descending command blade | `SKILL_CAST` → `skill-cast` | W-04 |
| Extraction window | two-ring readiness mark plus restrained progress pulse | `ELITE_CANDIDATE_AVAILABLE` / `EXTRACTION_PROGRESS` → `extraction-ready` | W-02 |
| Elite bind | three staggered seal tones | `ELITE_EXTRACTED` / `EXTRACTION_COMPLETED` → `elite-extracted` | W-02 |
| Occupation | restrained hold pulse resolving to an ascending control-point dyad | `OCCUPATION_PROGRESS` / `OCCUPATION_CAPTURED` → `occupation-captured` | W-02, W-03, W-04 |
| Boss | three-layer subharmonic descent | `BOSS_SPAWNED` → `boss-spawned` | W-03, W-04 |
| Terminal / Archive | distinct defeat, victory, final-completion, and reward-selection voicings | `TERMINAL` / `REWARD_SELECTED` → `terminal` | W-03, W-05 |

Enemy defeat retains its own short two-layer Echo-collapse cue (`enemy-defeated`, W-01), distinct from the harder Gate/impact profile. Every frequency envelope, gain, attack, delay, and duration is recorded in `assets/audio/defense-audio-manifest.json`.

## Layered ambience and battle music

The Echo Deep ambience is a 29 Hz sine foundation plus a 43.5 Hz triangular fracture layer. The Dusk Warden battle bed is a low 55 / 82.41 / 123.47 Hz three-voice stack. `DefenseAudio.start()` starts both only after the existing battle-session user gesture creates the `AudioContext`; `stopAmbience()`, `stopBattleMusic()`, and `stop()` provide explicit lifecycle boundaries. No autoplay bypass was introduced.

When `prefers-reduced-motion: reduce` is active (or the constructor receives `reducedMotion: true`), the decorative five persistent oscillator layers are not allocated. Semantic UI remains authoritative and event micro-cues remain available. Missing Web Audio, a closed/suspended context, failed oscillator allocation, or rejected `resume()`/`close()` promises degrades to silence without throwing through the battle loop.

## Bounded allocation and teardown

The hard budgets are 64 total tracked nodes and 48 transient nodes. Normal startup tracks 14 nodes: master plus three buses (4), ambience oscillators/gains (4), and music oscillators/gains (6). Reduced-motion startup tracks only the four mix nodes. A micro-cue is dropped before allocation if either cap would be crossed. Refractory intervals suppress high-rate movement (70 ms), weapon (25 ms), impact (25 ms), extraction-progress (120 ms), and occupation-progress (120 ms) clutter before allocation. Ended oscillators release their oscillator/gain pair; teardown stops every stoppable node, disconnects all tracked nodes, clears voices and buses, closes the context, and reports zero nodes.

A deliberately non-ending fake Web Audio implementation was stressed with 1,000 two-layer defeat cues. Allocation stopped at 62 nodes (14 persistent + 48 transient), below the 64-node hard ceiling; `stop()` returned the tracked count to zero. This checks the worst case where an implementation never delivers `ended` cleanup.

## Runtime event coverage

The manifest enumerates all 34 source event contracts found by a combined scan of direct event objects and `emit(run, ...)` calls: `STAGE_STARTED`, `MOVE`, `WAVE_VARIANT_STARTED`, `ENEMY_SPAWNED`, `ENEMY_POLICY_SELECTED`, `OBJECTIVE_PHASE_CHANGED`, `OBJECTIVE_COMPLETED`, `OBJECTIVE_FAILED`, `WEAPON_FIRED`, `ENEMY_ATTACK`, `PROJECTILE_IMPACT`, `COMMANDER_DAMAGED`, `GATE_BREACHED`, `HAZARD_DAMAGE`, `PICKUP_DENIED`, `ECHO_DENIED`, `ENEMY_DEFEATED`, `ELITE_CANDIDATE_AVAILABLE`, `ELITE_EXTRACTED`, `EXTRACTION_PROGRESS`, `EXTRACTION_COMPLETED`, `EXTRACTION_REJECTED`, `EXTRACTION_INTERRUPTED`, `OCCUPATION_PROGRESS`, `OCCUPATION_CAPTURED`, `OCCUPATION_INTERRUPTED`, `TERRAIN_RECOVERY`, `ITEM_COLLECTED`, `GROWTH_OFFER`, `SKILL_SELECTED`, `SKILL_CAST`, `BOSS_SPAWNED`, `TERMINAL`, and `REWARD_SELECTED`. Spawn/policy/wave/phase telemetry is listed as semantic-only to avoid duplicate or noisy cues. Events that carry catalog cue IDs retain them unless an exact event mapping deliberately supplies a more specific profile; this makes `OCCUPATION_CAPTURED` resolve to its dedicated cue instead of its generic pickup cue.

SystemsDesigner landed immutable `movement-step`, `weapon-fire`, `impact-hit`, `extraction-ready`, and `occupation-captured` catalog entries with the requested base parameters. CombatEngineer landed the exact movement, weapon, enemy attack/denial, projectile impact, objective, terrain, occupation, and extraction event contracts with identifiers for dedupe. Audio observes those events but never generates simulation state, randomness, timing, damage, recovery, or occupation progress.

The broader authoritative chokepath/flank/elevation/hazard, occupation effects, seeded wave-policy, and balance behavior is simulation/catalog work outside the audio lane. This module is ready to observe the named events without owning randomness or gameplay state.

## Verification evidence

1. `node --check defense-audio.js` — exit 0, no syntax output.
2. Final Bun/JS unavailable-Web-Audio smoke — all 13 manifest cue IDs resolved from the catalog; `start()` and `play()` returned false without throwing, all 34 declared event shapes were accepted by `consume()`, and post-stop metrics were `nodes: 0`, `started: false`.
3. Final Bun/JS bounded fake-Web-Audio smoke — after the expanded event set plus 1,000 cue attempts, metrics were `nodes: 62`, `transientNodes: 48`, `maxNodes: 64`; after `stop()` metrics were `nodes: 0`, `transientNodes: 0`, `voices: 0`, `started: false`.
4. Final reduced-motion fake-Web-Audio smoke — startup tracked exactly four mix nodes and no ambience/music oscillators; `stop()` returned zero nodes.
5. Final forced oscillator-failure smoke — context/buses started, optional cue playback returned false rather than throwing, and post-stop node count was zero.
6. Final manifest/source coverage check — schema 2 parsed; 13 cue definitions, 34 declared observer contracts, 34 unique current source event types with zero missing from the manifest, two ambience layers, three music layers, `network: false`, and `mediaDecode: false`.

No test file, catalog, app, simulation, renderer, or unrelated audio asset was edited by this lane.
