# Audio feedback spec — cycle 10 stage dungeons

run-id: `20260728-onslaught-action-pivot`
cycle: 10
lane: `design` (audio)
owner: AudioFeedbackDesign
authority: **Director ruling v1 + v2 + v3** (event vocabulary), `CLAUDE.md` (workspace/engine/evidence),
`_workspace/current/intake/production-brief-cycle10-stage-dungeon.md` §2 item 10 (scope),
`_workspace/current/design/abyssal-lantern-player-feel-audio-vfx-development-prompt.md` §3 (audio authority constraints)

Engine: **Three.js + WebGL browser only**. No Unity/Unreal, no file playback, no network, no API key.
Non-goals: VFX visuals (`VfxCueDesign`), simulation rules (`DropBuffSystem` / `EncounterPacing`),
UI layout (`UiOverhaulConcept`), dungeon geometry (`DungeonLevelDesign`).

This is a **design-phase specification**. No production source is modified by this document.

---

## 0. Provenance: which tree every citation was measured in [OBSERVED]

**Read this before using any line number in this document.**

There are two working trees. This spec was **authored** in `/Users/jangyoung/orca/Abyssal-Surge`,
which carries a concurrent session's uncommitted work. It will be **implemented** in
`/Users/jangyoung/orca/Abyssal-Surge-dungeon` @ `033877ad`. The two are not the same file set.

**The tooling trap (Director ruling v4 R20, found by `AudioImpl`, reproduced by the Director).**
`grep`, `read`, `glob`, `ast_grep`, `edit`, and `write` resolve a **relative** path against the
authoring tree, not the dungeon worktree. A relative-path measurement is therefore evidence about
the wrong tree. Worse, `edit` has the same defect: only the stale-hash check stops a relative
section header from writing into the forbidden tree, and it stops nothing when a file is
byte-identical across both.

**Consequence for this spec, stated plainly:** an earlier draft of this section contained a
"drift correction" table that was **backwards**. It claimed the assignment's and the Director's
line numbers were stale and that mine were fresh. The opposite was true — the assignment and
ruling numbers were dungeon-correct, and my "corrections" were polluted-tree numbers. **Every
citation in this document has since been re-measured through an absolute dungeon path and
corrected.** The table below is the audit trail.

### Tree identity — **identify by PATH, never by line count** (ruling v7 R32 retires R21)

⚠ **The line-count discriminator below is RETIRED and must not be used.** Ruling v7 R32: the
dungeon tree's own implementers have grown these files, so a reader following R21 literally would
now conclude they are in the *wrong* tree while standing in the right one — and might "correct"
into the forbidden tree. Measured drift since R21 was issued: `defense-catalog.js` 923 → **1077**,
`battle-realtime-three.js` 4846 → **5223**, `app.js` 3807 → **4147**.

**The durable rule is R20: absolute `/Users/jangyoung/orca/Abyssal-Surge-dungeon/...` in every
`read`/`grep`/`glob`/`edit`/`write`, and `cwd` on every bash call.** The only identity check that
does not decay is commit-addressed: `git show 033877ad:<path>`, which returns the base blob
regardless of any working tree.

The table below is retained **only** as the provenance record of when this spec's citations were
taken — it is a timestamp, not a test:

| File | Lines when cited | Snapshot tag then | Status now |
|---|---|---|---|
| `defense-audio.js` | 1313 | `#6D8B` | untouched so far — the only file this spec changes |
| `defense-catalog.js` | 923 | `#9DF3` | **grown to 1077** |
| `defense-run-simulation.js` | 3570 | `#FF03` | untouched at time of writing |
| `battle-realtime-three.js` | 4846 | `#E2C5` | **grown to 5223** |
| `app.js` | **3807** (grew to 3832 under `UiJoystickImpl`'s landed edits) | `#C4D5` |
| `tests/audio-feedback-runtime.test.mjs` | — | `#22B0` |
| `tests/defense-observers-contract.test.mjs` | — | `#C359` |

If a read disagrees with those counts, it is the authoring tree. The authoring tree's
`defense-audio.js` had already grown to **1496** lines — the concurrent session has written
~183 lines of audio there — which is exactly how the polluted numbers entered this document.

### Corrected anchors — measured through `/Users/jangyoung/orca/Abyssal-Surge-dungeon/`

| Symbol | Dungeon line | Earlier draft claimed | Verdict |
|---|---|---|---|
| `this.audio.consume(newAudioEvents)` in `BattleSession.render()` | `app.js:2908` | `:3013` (polluted) / `:2883` (assignment) | both wrong; **2908** measured |
| commander `MOVE` emit | `defense-run-simulation.js:2879` | `:3249` | polluted |
| commander `MOVE` `cue:` field, `run.tick % 12 === 0` | `:2886` | `:3256` | polluted — **ruling v2 R11's `:2886` was right** |
| enemy `MOVE` emit | `:2414-2420` | `:2770` | polluted |
| `AUDIO_CUES.movementStep` / `.weaponFire` | `defense-catalog.js:208` / `:209` | `:297` / `:298` | polluted — **ruling v2 R11's `:208-209` was right** |
| `AUDIO_CUES.cameraClamp` | `defense-catalog.js:221` | — | measured |
| `TICK_RATE = 60` | `defense-catalog.js:11` | `:11` | correct |
| `getRunSnapshot` | `defense-run-simulation.js:3489` | `:3780-3841` | polluted |
| `getRunDigest` | `:3555` | `:3845` | polluted |
| `SNAPSHOT_VERSION = 7` | `:378` | — | measured; **do not bump** |
| `MELEE_IMPACT` / `guardedBy`→`defence` | `battle-realtime-three.js:4513` / `:4514` | `:4947` | polluted |
| `PROJECTILE_IMPACT` / `guardedBy` / `hit === false`→`avoid` | `:4517` / `:4518` / `:4519` | `:4951` / `:4952` | polluted |
| `BOSS_ATTACK_CANCELLED`→`avoid` | `:4529` | `:4962` | polluted |
| `RIG_ACTION_KEYS` (contains `avoid`) | `:455` | `:509` | polluted |
| `avoid: 50` one-shot weight | `:544` | `:598` | polluted |
| `SNAPSHOT_FEEDBACK_TYPES` | `app.js:82` | `:105` | polluted |
| `#battle-event-feedback` `<output>` | `app.js:1766` | `:1815` | polluted |
| `this.audio.start()` | `app.js:2147` | `:2203` | polluted |
| `signalCameraClamp()` | `app.js:2301-2303` | `:2357-2359` | polluted |
| `renderEventFeedback()` | `app.js:2837` | `:2942` | polluted |
| `rallyAcknowledgedBossIds` dedupe | `app.js:2917-2921` | `:3016-3020` | polluted |
| `this.audio.pause()` / `.resume()` | `app.js:3467` / `:3469` | `:3565` / `:3567` | polluted |
| `this.audio.setMuted()` pause overlay | `app.js:3653` | `:3751` | polluted |
| `showToast()` | `app.js:3673` | `:3778` | polluted |
| `play()` camera-clamp priority ternary | `defense-audio.js:1029-1030` | `:1034-1035` | polluted |
| `play()` mute/pause/background guard | `defense-audio.js:1020-1028` | `:1020-1030` | polluted |
| `requiredNodes = profile.length * 2` | `:1039` | `:1063` | polluted |
| `ended` listener / node release | `:1064-1078` | `:1088-1098` | polluted |
| `rememberFeedbackEvent()` | `:1088` | `:1104-1114` | polluted |
| `audioSoundscapeForEvent()` call in `consume()` | `:1225-1232` | `:1231-1238` | polluted |
| `makeRoomForVoice` eviction test | `:1001-1003` | `:1005-1007` | polluted |

**Every `defense-audio.js` anchor outside `play()`'s body was already dungeon-correct**, because
the reads that produced them carried tag `#6D8B`: `MOVE: silentPolicy("movement")` **:230**,
`CUE_PROFILES` **:76-181**, `"movement-step"` profile **:111-113**, `"weapon-fire"` **:114-117**,
`CUE_VARIANTS` **:183-219**, `feedbackPolicy`/`silentPolicy` **:221-224**, `AUDIO_EVENT_POLICY`
**:226-292**, `CUE_REFRACTORY_SECONDS` **:295-319**, `AMBIENCE_LAYERS` **:321-324**,
`MUSIC_LAYERS` **:326-330**, `SOUNDSCAPE_RAMP_SECONDS` **:333**, `STAGE_SOUNDSCAPES` **:334-368**,
`SOUNDSCAPE_STATES` **:369-376**, `audioSoundscapeForEvent` **:378-420**,
`persistentLayerTarget` **:422-434**, `prefersReducedMotion` **:436-442**, `audioCueForEvent`
**:598-639**, `variantKey` **:641-644**, `cueRefractoryKey` **:646-652**, `applyMasterGain`
**:721**, `setMuted` **:727**, `setVolume` **:739**, `attachLifecycle` **:747**, `unlock` **:772**,
`suspendForBackground` **:784**, `resumeFromBackground` **:796**, `pause` **:806**, `resume`
**:815**, `resetRun` **:825**, `release` **:843**, `start` **:857**, `startAmbience` **:907**,
`startBattleMusic` **:920**, `applySoundscape` **:933**, `setSoundscape` **:952**,
`makeRoomForVoice` **:995**, `lookup` **:1011**, `play` **:1018**, `narrate` **:1116**, `consume`
**:1177**, `stop` **:1260**, `debugMetrics` **:1291**.

### Document-vs-blob: the rule this spec was named in

Ruling v6 C3 records three agents citing a design document as shipped behaviour this cycle, and
**this spec is one of them** (the reversed drift table, §0 above). The durable rule:

> A spec is a claim about **intent**. Only a blob is a claim about **code**. When a number's
> justification traces to a `.md`, mark it `[TARGET]` and name the document — do not let it wear
> an `[OBSERVED]` costume. `git show <sha>:<path>` is the one read a working tree cannot fool.

Applied here: every cycle-10 vocabulary item was re-grounded against
`git show 033877ad:defense-catalog.js 033877ad:defense-run-simulation.js`. **`GIMMICK_ARMED`,
`gimmickClass`, `DROP_SPAWNED`, `BUFF_APPLIED`, `slabMaterialAt`, `ingressTicks` — 0 occurrences
each.** They are `[TARGET]` throughout, and §4.6 and §5.3 were relabelled where an earlier revision
had marked a peer's authored intent as `[OBSERVED]`. The one surprise: `telegraphTicks` **does**
exist (1 occurrence, `defense-run-simulation.js:2296`) but on an unrelated event — see §4.6.

### The rule that supersedes every number above

**Anchor on the symbol, not the line.** `app.js` moved 3807 → 3832 *during this session* under
`UiJoystickImpl`'s landed edits, so even a correctly measured `app.js` line is perishable.
Before editing: `grep` the symbol through an absolute dungeon path, read the surrounding range,
confirm the code matches the text this spec quotes, then edit. **If the code differs from what is
quoted here, stop and escalate — do not adapt silently.**

---|---|
| "no file playback, no network, no API key" (header, §1.1) | **Stale as a runtime absolute.** `DefenseAudio` accepts `sampleMapUrl`; `app.js` opts in with `assets/audio/elevenlabs/index.json`. Fetch/decode happens after `start()`; ANY failure falls back per-cue to the procedural profile. The **procedural path remains the authoritative fallback and the test-environment default** (`new DefenseAudio()` without options never touches the network). API key is generation-time only (`scripts/generate-defense-audio.mjs` + `.env.game-audio`), never runtime. |
| "100% 절차 합성" (§1.1) | Procedural profiles are unchanged and still authoritative; 33 one-shot samples + 6 stage loops now shadow them 1:1 by cue/variant key (`assets/audio/elevenlabs-sound-plan.json`). |
| `movement=silentPolicy` — 발소리 없음 | **Unchanged.** `MOVE` is still `silentPolicy("movement")`. A `movement-step` sample exists but is inert until this spec's un-shadowing decision lands — the design authority for that decision stays with this lane. |
| Soundscape 6-state machine | **Unchanged semantics.** Buffered stage loops consume the same `SOUNDSCAPE_STATES` gain/pitch mix (gain ramp + `playbackRate`); stage change swaps loop buffers over the same `SOUNDSCAPE_RAMP_SECONDS`. |

Implication for this spec's new cues: any cue ID this lane adds gets procedural playback
for free; giving it a sample is one entry in `elevenlabs-sound-plan.json` + one
`scripts/generate-defense-audio.mjs` run. No runtime change needed. Contract tests:
`tests/audio-sample-hybrid.test.mjs` (6), `tests/audio-feedback-runtime.test.mjs` (17)
all pass post-change. Manifest authority: `assets/audio/defense-audio-manifest.json`
schemaVersion 3, mode `hybrid-sample-procedural`.

---

## 1. Observed inventory

### 1.1 The claim in the brief, verified

Production brief §2 item 10 states: *"오디오 50+ 이벤트, 100% 절차 합성. BGM/앰비언스
soundscape 6상태 존재. `movement=silentPolicy` — 발소리 없음."* All four parts verified:

| Claim | Verification | Result |
|---|---|---|
| 50+ audio events | `Object.keys(AUDIO_EVENT_POLICY).length` | **65** [OBSERVED] |
| 100% procedural synthesis | **True at `033877ad`, our implementation tree.** No `AudioBuffer`, `decodeAudioData`, `createBufferSource`, `<audio>`, or `fetch` in `defense-audio.js`. Every voice is `context.createOscillator()` + `createGain()` in `DefenseAudio.play()` (`:1018-1086`) and `startPersistentLayer()` (`:886-905`). Only non-oscillator sound path is `speechSynthesis` for Korean story narration (`narrate()`, `:1116-1175`). **Not durable across the cycle-close merge — see R-18.** | **Confirmed for our tree** [OBSERVED] |
| soundscape 6 states | `SOUNDSCAPE_STATES` (`defense-audio.js:369-376`) = `descent`, `active-wave`, `objective-pressure`, `boss`, `victory`, `defeat` | **6** [OBSERVED] |
| `movement = silentPolicy` | `MOVE: silentPolicy("movement")` at **`defense-audio.js:230`** | **Confirmed** [OBSERVED] |

Supporting counts [OBSERVED]:

- 58 audible policies, **7** `intentionalSilence` policies: `MOVE`, `ENEMY_SPAWNED`,
  `ENEMY_POLICY_SELECTED`, `SKILL_COOLDOWN_SET`, `SKILL_COOLDOWN_READY`,
  `ESCORT_LEADER_ACQUIRED`, `ENEMY_PRESSURE_DELAYED`.
- **26** synthesis profiles in `CUE_PROFILES` (`:76-181`), **9** event-keyed overrides in
  `CUE_VARIANTS` (`:183-219`), **20** refractory entries in `CUE_REFRACTORY_SECONDS` (`:295-319`).
- 23 distinct cue ids are reachable from the policy registry; **3 profiles are unreachable**
  (§1.4).
- Priority range across the registry: **0 … 100**. Voice/node caps: `MAX_ACTIVE_VOICES = 12`
  (`:5`), `MAX_TRANSIENT_NODES = 48` (`:4`), `MAX_AUDIO_NODES = 64` (`:3`),
  `CRITICAL_AUDIO_PRIORITY = 80` (`:13`).

### 1.2 Synthesis profile table — all 26 profiles [OBSERVED]

`tone(waveform, frequency, endFrequency, duration, gain, delay, attack)` (`defense-audio.js:17-18`).
Every layer ramps `frequency` exponentially from `frequency` to `endFrequency` across `duration`,
and `gain` linearly up over `attack` then exponentially down to `SILENCE` (`play()`, `:1060-1062`).
"Layers" is the count of concurrent oscillators; each layer costs **2 nodes** (osc + gain), so
`requiredNodes = layers × 2` (`:1039`).

| Cue id | Layers | Layer sketch (waveform freq→end, dur s, gain, delay) | Refractory s | Reachable from policy |
|---|---|---|---|---|
| `stage-start` | 2 | sine 220→330 .18 .16; triangle 330→440 .22 .08 @.045 | — | yes |
| `enemy-defeated` | 2 | triangle 160→72 .08 .13; square 82→48 .055 .04 | 0.06 | yes |
| `elite-extracted` | 3 | sine 420→840 .32 .12; triangle 210→420 .28 .07 @.035; sine 630→945 .22 .045 @.11 | — | yes |
| `item-collected` | 2 | sine 560→780 .2 .11; triangle 840→1120 .14 .055 @.04 | 0.08 | yes |
| `growth-offer` | 2 | triangle 320→400 .24 .1; sine 480→640 .2 .055 @.055 | — | yes |
| `skill-cast` | 2 | sawtooth 260→92 .14 .085; square 520→260 .075 .035 @.012 | — | yes |
| `boss-spawned` | 3 | sawtooth 90→45 .5 .085 atk.025; triangle 135→67.5 .56 .065 @.035; sine 45→36 .62 .07 @.08 | — | yes |
| `terminal` | 2 | sine 120→60 .5 .1 atk.02; triangle 180→90 .42 .055 @.05 | — | yes |
| **`movement-step`** | 1 | triangle 92→72 **.045** .035 atk.004 | **0.07** | **NO — orphan** |
| **`weapon-fire`** | 2 | square 310→155 .055 .045 atk.004; triangle 465→232.5 .04 .025 @.008 | **0.04** | **NO — orphan** |
| `impact-hit` | 2 | sawtooth 118→52 .07 .075 atk.004; square 59→42 .045 .035 | 0.045 | yes |
| `critical-hit` | 2 | square 480→720 .12 .09 atk.004; sine 720→960 .1 .045 @.025 | 0.1 | yes |
| `extraction-ready` | 2 | sine 360→540 .22 .08; triangle 180→270 .18 .04 @.04 | 0.12 | yes |
| `occupation-captured` | 2 | triangle 240→360 .18 .075; sine 120→240 .2 .04 @.035 | 0.12 | yes |
| `camera-clamp` | 1 | sawtooth 90→60 .035 .03 atk.004 | 0.15 | **NO — by design** (§1.4) |
| `input-accepted` | 1 | sine 360→480 .08 .04 atk.004 | 0.06 | yes |
| `input-rejected` | 1 | square 110→70 .09 .045 atk.004 | 0.1 | yes |
| `attack-windup` | 1 | sawtooth 180→260 .11 .045 atk.006 | 0.12 | yes |
| `block-contact` | 1 | triangle 140→92 .1 .05 atk.004 | 0.05 | yes |
| `attack-miss` | 1 | sine 190→120 .08 .026 atk.004 | 0.08 | yes |
| `interrupt-alert` | 2 | square 92→54 .13 .055 atk.006; triangle 184→92 .1 .028 @.02 | 0.12 | yes |
| `warning-pulse` | 2 | sawtooth 170→85 .2 .055 atk.012; sine 255→127.5 .16 .025 @.035 | 0.35 | yes |
| `objective-waypoint` | 2 | sine 300→450 .24 .065; triangle 450→600 .18 .032 @.045 | 0.3 | yes |
| `objective-complete` | 2 | triangle 260→520 .28 .075; sine 390→780 .22 .038 @.05 | 0.2 | yes |
| `boss-phase` | 2 | sawtooth 82→55 .42 .065 atk.02; triangle 123→82 .38 .038 @.045 | 0.5 | yes |
| `death-retry` | 2 | triangle 146→219 .34 .065; sine 219→328.5 .28 .032 @.055 | 0.5 | yes |

Six profiles carry **no** refractory (`stage-start`, `elite-extracted`, `growth-offer`,
`skill-cast`, `boss-spawned`, `terminal`) — they are one-shot milestones already deduplicated by
`rememberFeedbackEvent()` (`:1088-1098`).

`CUE_VARIANTS` overrides, keyed `${cueId}:${event.type}` or `${cueId}:TERMINAL:${outcome}`
(`variantKey()`, `:641-644`): `growth-offer:SKILL_SELECTED`,
`extraction-ready:EXTRACTION_PROGRESS`, `occupation-captured:OCCUPATION_PROGRESS`,
`impact-hit:PICKUP_DENIED`, `impact-hit:STANCE_SWITCH_BLOCKED`, `terminal:REWARD_SELECTED`,
`terminal:TERMINAL:DEFEAT`, `terminal:TERMINAL:VICTORY`, `terminal:TERMINAL:FINAL_COMPLETION`.

### 1.3 Policy registry table — all 65 entries [OBSERVED]

`AUDIO_EVENT_POLICY`, `defense-audio.js:226-292`. Refractory is resolved per **cue**, not per
policy; the effective refractory *key* is `${cueId}:${category}`, with `impact-hit` in category
`contact` or `damage` collapsing to the shared family `impact-hit:hit`
(`cueRefractoryKey()`, `:646-652`).

| # | Event type | Cue id | Priority | Category | Refractory s |
|---|---|---|---|---|---|
| 1 | `STAGE_STARTED` | `stage-start` | 72 | stage | — |
| 2 | `INPUT_ACCEPTED` | `input-accepted` | 34 | input | 0.06 |
| 3 | `INPUT_REJECTED` | `input-rejected` | 48 | input | 0.1 |
| 4 | **`MOVE`** | **`null`** | **0** | **movement** | (0.07 unreachable) |
| 5 | `BASIC_ATTACK` | `attack-windup` | 34 | windup | 0.12 |
| 6 | `WEAPON_FIRED` | `attack-windup` | 32 | windup | 0.12 |
| 7 | `MELEE_SWEEP` | `attack-windup` | 35 | windup | 0.12 |
| 8 | `MIDBOSS_SPAWNED` | `warning-pulse` | 82 | boss | 0.35 |
| 9 | `SKILL_CAST` | `skill-cast` | 42 | windup | — |
| 10 | `BOSS_ATTACK_TELEGRAPHED` | `warning-pulse` | 86 | warning | 0.35 |
| 11 | `BOSS_ATTACK_CANCELLED` | `attack-miss` | 44 | miss | 0.08 |
| 12 | `ENEMY_ATTACK` | `impact-hit` | 46 | contact | 0.045 |
| 13 | `PROJECTILE_IMPACT` | `impact-hit` | 45 | contact | 0.045 |
| 14 | `MELEE_IMPACT` | `impact-hit` | 47 | contact | 0.045 |
| 15 | `PROJECTILE_BLOCKED` | `block-contact` | 52 | block | 0.05 |
| 16 | `PROJECTILE_EXPIRED` | `attack-miss` | 28 | miss | 0.08 |
| 17 | `CRITICAL_HIT` | `critical-hit` | 82 | damage | 0.1 |
| 18 | `SKILL_RESOLVED_DAMAGE` | `impact-hit` | 58 | damage | 0.045 |
| 19 | `COMMANDER_DAMAGED` | `impact-hit` | 74 | damage | 0.045 |
| 20 | `COMPANION_DAMAGED` | `impact-hit` | 70 | damage | 0.045 |
| 21 | `GATE_BREACHED` | `impact-hit` | 76 | damage | 0.045 |
| 22 | `HAZARD_DAMAGE` | `impact-hit` | 72 | damage | 0.045 |
| 23 | `COMPANION_DOWNED` | `interrupt-alert` | 78 | interrupt | 0.12 |
| 24 | `COMMANDER_DOWNED` | `terminal` | 98 | death | — |
| 25 | `OCCUPATION_INTERRUPTED` | `interrupt-alert` | 74 | interrupt | 0.12 |
| 26 | `EXTRACTION_INTERRUPTED` | `interrupt-alert` | 76 | interrupt | 0.12 |
| 27 | `EXTRACTION_REJECTED` | `input-rejected` | 62 | interrupt | 0.1 |
| 28 | `PICKUP_DENIED` | `input-rejected` | 50 | block | 0.1 |
| 29 | `ECHO_DENIED` | `input-rejected` | 50 | block | 0.1 |
| 30 | `OBJECTIVE_FAILED` | `interrupt-alert` | 84 | warning | 0.12 |
| 31 | `ENCOUNTER_OBJECTIVE_FAILED` | `interrupt-alert` | 84 | warning | 0.12 |
| 32 | `OBJECTIVE_PRESSURE_PULSE` | `warning-pulse` | 80 | warning | 0.35 |
| 33 | `OBJECTIVE_PRESSURE_DEADLINE` | `warning-pulse` | 88 | warning | 0.35 |
| 34 | `WAVE_VARIANT_STARTED` | `warning-pulse` | 64 | warning | 0.35 |
| 35 | `ITEM_COLLECTED` | `item-collected` | 56 | pickup | 0.08 |
| 36 | `TERRAIN_RECOVERY` | `item-collected` | 54 | pickup | 0.08 |
| 37 | `ENEMY_DEFEATED` | `enemy-defeated` | 36 | contact | 0.06 |
| 38 | `ELITE_CANDIDATE_AVAILABLE` | `extraction-ready` | 66 | objective | 0.12 |
| 39 | `EXTRACTION_WINDOW_OPENED` | `objective-waypoint` | 68 | objective | 0.3 |
| 40 | `OCCUPATION_PROGRESS` | `occupation-captured` | 40 | objective | 0.12 |
| 41 | `OCCUPATION_CAPTURED` | `occupation-captured` | 64 | objective | 0.12 |
| 42 | `EXTRACTION_PROGRESS` | `extraction-ready` | 42 | objective | 0.12 |
| 43 | `EXTRACTION_COMPLETED` | `elite-extracted` | 72 | objective | — |
| 44 | `ELITE_EXTRACTED` | `elite-extracted` | 74 | objective | — |
| 45 | `OBJECTIVE_PHASE_CHANGED` | `objective-waypoint` | 60 | waypoint | 0.3 |
| 46 | `ENCOUNTER_OBJECTIVE_STARTED` | `objective-waypoint` | 60 | waypoint | 0.3 |
| 47 | `OBJECTIVE_COMPLETED` | `objective-complete` | 64 | objective | 0.2 |
| 48 | `ENCOUNTER_OBJECTIVE_COMPLETED` | `objective-complete` | 64 | objective | 0.2 |
| 49 | `WAVE_CLEARED` | `objective-complete` | 58 | objective | 0.2 |
| 50 | `GROWTH_OFFER` | `growth-offer` | 58 | pickup | — |
| 51 | `SKILL_SELECTED` | `growth-offer` | 56 | input | — |
| 52 | `STANCE_SWITCHED` | `occupation-captured` | 52 | input | 0.12 |
| 53 | `STANCE_SWITCH_BLOCKED` | `input-rejected` | 54 | input | 0.1 |
| 54 | `REWARD_SELECTED` | `terminal` | 70 | input | — |
| 55 | `BOSS_SPAWNED` | `boss-spawned` | 90 | boss | — |
| 56 | `BOSS_RALLY_WINDOW` | `boss-phase` | 88 | boss | 0.5 |
| 57 | `RETRY_STARTED` | `death-retry` | 94 | retry | 0.5 |
| 58 | `RUN_RETRIED` | `death-retry` | 94 | retry | 0.5 |
| 59 | `TERMINAL` | `terminal` | 100 | terminal | — |
| 60 | **`ENEMY_SPAWNED`** | **`null`** | **0** | **spawn** | — |
| 61 | `ENEMY_POLICY_SELECTED` | `null` | 0 | policy | — |
| 62 | `SKILL_COOLDOWN_SET` | `null` | 0 | cooldown | — |
| 63 | `SKILL_COOLDOWN_READY` | `null` | 0 | cooldown | — |
| 64 | `ESCORT_LEADER_ACQUIRED` | `null` | 0 | policy | — |
| 65 | `ENEMY_PRESSURE_DELAYED` | `null` | 0 | policy | — |

Plus one non-registry narration path: `LORE_SURPRISE_RESOLVED` → `narrate` at priority 45, and
six story-narration event types (`STAGE_STARTED`, `OCCUPATION_CAPTURED`, `BOSS_SPAWNED`,
`OBJECTIVE_COMPLETED`, `EXTRACTION_COMPLETED`, `TERMINAL`) that add narration at priority 76
**without replacing** their cue (`audioCueForEvent()`, `:598-639`).

### 1.4 Which movement policy is silent, and the dead-code defect [OBSERVED]

**`MOVE: silentPolicy("movement")` — `defense-audio.js:230`.** Confirmed as the discovery report
claims (`map-ui-audio.md:227,349`).

The consequence is larger than "no footsteps". Three profiles are unreachable from the policy
registry; one is intentional and two are dead code:

| Orphan profile | Status | Evidence |
|---|---|---|
| `camera-clamp` | **Intentional.** A renderer-side, non-event cue. `BattleSession.signalCameraClamp()` calls `this.audio?.play?.("camera-clamp")` directly (`app.js:2301-2303`), driven from `onPointerMove` orbit/pinch saturation (`BattleSession.onPointerMove`, re-grep). The contract that *no simulation event may map to it* is locked by `tests/defense-observers-contract.test.mjs:439-466` (`assert.deepEqual(played, [], "no simulation event maps to the camera-clamp cue")`). Priority is hard-coded 5 by an inline ternary in `play()` (`defense-audio.js:1029-1030`). | test-locked |
| **`movement-step`** | **Dead code.** Cue defined `defense-catalog.js:208`, profile `defense-audio.js:111-113`, refractory `:296`. The simulation *already emits the cue id*: commander `MOVE` carries `cue: run.tick % 12 === 0 ? eventCue("movementStep") : null` (`defense-run-simulation.js:2886`). But `audioCueForEvent()` reaches the `event.cue` catalog fallback **only when no policy exists** (`defense-audio.js:633-639`), and `AUDIO_EVENT_POLICY.MOVE` exists and declares silence — so the fallback is shadowed and the profile never plays. | Director ruling v2 R11 |
| **`weapon-fire`** | **Dead code, same mechanism.** Cue `defense-catalog.js:209`, profile `defense-audio.js:114-117`, refractory `:297`. The simulation sets `cue: eventCue("weaponFire")` on the ranged-fire and melee-sweep events, but `WEAPON_FIRED` and `MELEE_SWEEP` policies both point at `attack-windup` (`:232-233`), which wins over the cue field. **Today the release of a weapon sounds identical to its windup.** | this spec, §3 |

Per Director ruling v2 **R11**, footsteps are an **un-shadowing**, not a new oscillator. §2
specifies the un-shadowing; §3.2 specifies the `weapon-fire` un-shadowing.

Arithmetic correction to the discovery report [OBSERVED]: `map-ui-audio.md:351` and `:511` state
that a 0.07 s refractory implies "~140Hz". `1 / 0.07 = 14.3` steps per second, not 140. The
report's own extension recommendation (`map-ui-audio.md:352,468`: *"ensure footstep fires every
frame movement direction changes"*, `MOVE: feedbackPolicy("movement-step", 28, "movement")`) is
therefore under-damped **and** breaks a named test — see §2.3 and Open risks R-1.

### 1.5 Which combat verbs already have cues [OBSERVED]

| Verb | Has a cue today? | Binding |
|---|---|---|
| Attack windup | **Yes** | `BASIC_ATTACK` 34 / `WEAPON_FIRED` 32 / `MELEE_SWEEP` 35 → `attack-windup` |
| Attack release/fire | **No distinct cue** | shares `attack-windup`; `weapon-fire` profile orphaned |
| Attack contact | **Yes** | `MELEE_IMPACT` 47 / `PROJECTILE_IMPACT` 45 / `ENEMY_ATTACK` 46 → `impact-hit` |
| Critical | **Yes** | `CRITICAL_HIT` 82 → `critical-hit` |
| Miss | **Yes** | `BOSS_ATTACK_CANCELLED` 44 / `PROJECTILE_EXPIRED` 28 → `attack-miss` |
| **Block** | **Yes, partially** | `PROJECTILE_BLOCKED` 52 → `block-contact`. But an *escort-guarded* impact — `MELEE_IMPACT`/`PROJECTILE_IMPACT` with non-null `guardedBy` (`defense-run-simulation.js`, `applyDamage()` returns `{ damage, guardedBy }`) — plays `impact-hit`, not `block-contact`, even though the renderer plays the `defence` animation for it (`battle-realtime-three.js:4514,4518`). |
| **Dodge / avoid** | **NO** | No dodge event and no dodge cue exist. The renderer animates `avoid` from two existing signals: `PROJECTILE_IMPACT` with `event.hit === false` (`battle-realtime-three.js:4519`) and `BOSS_ATTACK_CANCELLED` (`:4529`). Audio maps `PROJECTILE_IMPACT` unconditionally to `impact-hit` 45 — **a fully dodged projectile currently sounds exactly like a landed hit.** |
| Damage taken | **Yes** | `COMMANDER_DAMAGED` 74 / `COMPANION_DAMAGED` 70 / `GATE_BREACHED` 76 / `HAZARD_DAMAGE` 72 → all `impact-hit` (four meanings, one timbre) |

### 1.6 Current test-asserted counts — the numbers that will move

**⚠ THE ONE SUITE RUN IN THIS SESSION IS VOID. No number in it may be cited, including
pass/fail.** It is void for two independent reasons, either of which alone disqualifies it:

1. **Wrong tree.** The command carried **no `cd` prefix**, and this session's default cwd is
   `/Users/jangyoung/orca/Abyssal-Surge` — the forbidden tree. It therefore exercised the
   concurrent session's cycle-9 code against a `defense-audio.js` that is 1496 lines, not our
   1313. A pass there says nothing about our tree; a failure there would not be our regression.
   An earlier revision claimed "a pass under contention is still a pass" and kept the 36/36 as a
   correctness signal. **That was wrong** — contention was never the disqualifying problem.
   *(Ruling v9 R41 retracts the blanket pre-emptive voiding of v8 R35, having found the audited
   PIDs were not attributable to our implementers. It does not rescue this run: the void here is
   self-reported from this session's own unprefixed invocation, not inferred from that audit. The
   mechanism ruling stands and is what matters.)*
2. **Contended machine.** Four concurrent full-suite runners and 51 node workers on 12 cores at
   load average 101.75 [OBSERVED by Main], against a suite with wall-clock-sensitive subtests.

```
node --test tests/audio-feedback-runtime.test.mjs …      ← no cd prefix: FORBIDDEN TREE
→ tests 36 | pass 36 | fail 0 | duration_ms 11752.6      ← VOID, cite none of it
```

**Every per-assertion value in the table below was read from the test file's source**, through an
absolute dungeon path (`tests/audio-feedback-runtime.test.mjs` tag `#22B0`,
`tests/defense-observers-contract.test.mjs` tag `#C359`) — not inferred from any run. That is why
the table survives the void: it never depended on execution. The certified baseline is the
Director's to take; §V-1 names the correctly-prefixed command and R-14 records that nothing here
has been observed to pass.

The specific asserted numbers an implementer must keep or deliberately move:

| # | Assertion | File:line | Current value | Moves in cycle 10? |
|---|---|---|---|---|
| T1 | `audioCueForEvent(MOVE)` deep-equals the silent shape | `audio-feedback-runtime.test.mjs:526-533` | `{method:"silent", cueId:null, priority:0, category:"movement", intentionalSilence:true}` | **No** — §2.3 keeps the off-cadence shape byte-identical |
| T2 | `played` order for a mixed batch | `:520-525` | exactly **4** entries, `MOVE` absent | **No** — the batch's MOVE is at `tick:20`, `20 % 12 ≠ 0` |
| T3 | `feedbackEvents` after that batch | `:534` | **5** | **No** — `MOVE` stays in `FEEDBACK_EVENT_TYPES` |
| T4 | `play("movement-step", MOVE)` at the voice cap returns false | `:547-551` | `false` | **No** — footstep priority 5 < `stage-start` 72 |
| T5 | `maxVoices` | `:539,546,561,572,577-578` | **12** | **No** |
| T6 | Policy priorities for 11 named events | `:463-484` | 60/64/90/88/86/78/98/94/100 | **No** |
| T7 | Terminal > boss > waypoint ordering | `:487-491` | holds | **No** |
| T8 | `resetRun()` post-state | `:718-728` | `feedbackEvents=0, storyNarrations=0, narrations=0, narrationQueue=0, transientNodes=0, voices=0`, `closeCount=0`, persistent osc `stopCount=0` | **No** |
| T9 | `beforeReset` setup counts | `:690-695` | `voices>0, feedbackEvents=1, storyNarrations=2, narrations=2, narrationQueue=1` | **No** |
| T10 | Story narration priority | `:247-250` | **76** | **No** |
| T11 | No sim event maps to `camera-clamp` | `defense-observers-contract.test.mjs:462-463` | `played == []` | **No** — new cues bind to ruled event types, never to `camera-clamp` |

**Numbers that DO move** (new assertions, not edits to the above): policy count 65 → **80**
(§4.6), `SOUNDSCAPE_STATES` 6 → **9** (§5), `CUE_PROFILES` 26 → **34**, reachable cue ids
23 → **31**, orphan profiles 3 → **1** (`camera-clamp` only).

---

## 2. Footstep system

### 2.1 Cadence source — derived from simulation, never a parallel timer

`TICK_RATE = 60` (`defense-catalog.js:11`). The commander `MOVE` event is emitted **only when
the commander's integer position actually changed** in that tick
(`defense-run-simulation.js:2878`: `if (run.commander.x !== commanderFrom.x || run.commander.y !== commanderFrom.y)`).
The payload carries `direction` (the octant, or `"OBJECTIVE_ROUTE"` for auto-pathing) and `speed`
(`:2883-2884`). The enemy `MOVE` emit (`:2414-2420`) carries `entityId, from, to, policyId,
intent, waypointId` and **no `direction` and no `speed`**.

Two consequences that make the design nearly free:

1. **Idle is structurally silent.** With `move === "IDLE"` the octant vector is `{x:0,y:0}`
   (`defense-catalog.js:14`), the position does not change, and **no `MOVE` event is emitted at
   all**. No idle check is needed anywhere in audio. [OBSERVED]
2. **`direction` is an existing commander/enemy discriminator.** A `MOVE` carrying a
   `direction` field is a commander step; one without it is an enemy step. No new field, no id
   lookup, no snapshot access from `consume()`. [OBSERVED]

**Cadence rule [TARGET]:** a footstep is eligible when

```
event.type === "MOVE"
  && typeof event.direction === "string"          // commander, not enemy
  && event.direction !== "IDLE"                   // defensive; unreachable per (1)
  && Number.isInteger(event.tick)
  && event.tick % FOOTSTEP_TICK_INTERVAL === 0    // FOOTSTEP_TICK_INTERVAL = 12
```

`FOOTSTEP_TICK_INTERVAL = 12` is **the interval the simulation already computes** for its own
`cue` field (`defense-run-simulation.js:2886`: `run.tick % 12 === 0`). Deriving it from
`event.tick` rather than reading `event.cue` gives an identical cadence while keeping
`AUDIO_EVENT_POLICY` the sole authority (§2.4). Result: **60 / 12 = 5.0 steps per second**
while a direction is held — one step per 200 ms, frame-rate independent, and identical whether a
frame ran 1 tick or a 12-tick catch-up burst.

| Quantity | Value | Basis |
|---|---|---|
| `FOOTSTEP_TICK_INTERVAL` | 12 ticks | mirrors `defense-run-simulation.js:2886` [OBSERVED] |
| Step cadence while moving | 5.00 /s | `60 / 12` [TARGET] |
| Step period | 200 ms | [TARGET] |
| Refractory (`movement-step`) | **0.07 s, unchanged** | already authored `defense-audio.js:296` [OBSERVED]; at a 200 ms period it never bites in steady state, and it suppresses the double-step that a ≥12-tick catch-up burst would otherwise deliver inside one `consume()` |
| Voice cap contribution | 1 layer = **2 nodes**, 1 voice | `movement-step` is a single-layer profile [OBSERVED] |

### 2.2 Per-surface variation

`DungeonLevelDesign` owns nine slab materials across twelve slabs (Director ruling v1;
**contract received from `DungeonLevelDesign`**, §2.2.1). Only `MOVE` lacks a `slabId` — the
ruled drop/spawn/gimmick payloads all carry one — so footsteps need a presentation-side lookup.

**Resolver contract [TARGET], verbatim from `DungeonLevelDesign`.** `DefenseAudio` gains one
injection point, mirroring how `BattleSession` already owns the renderer-side `camera-clamp`
signal:

```
setSurfaceResolver(fn)
// fn: slabMaterialAt(stageId: string, x: int, y: int) => { slabId, materialId } | null
// default: () => null
```

Note the **three-argument** signature and the **object** return — audio consumes
`result.materialId` for the timbre and may pass `result.slabId` through to telemetry unchanged.

`BattleSession` injects `slabMaterialAt` once at mount (beside `this.audio.start()`,
`app.js:2147`), binding `stageId` from `snapshot.stageId`. Guarantees `DungeonLevelDesign`
specifies, and what each buys footsteps:

| Guarantee (their contract) | What it buys the footstep system |
|---|---|
| READ-ONLY, derives purely from authored `profile.gameplay.terrainTiles[].rect` `{minX,maxX,minY,maxY}`; never writes simulation state, never consumes RNG, never called from the sim tick | Satisfies `CLAUDE.md` §2 and player-feel prompt §3 item 1 without an audio-side guard; V-9 becomes a confirmation rather than a hunt |
| **TOTAL** over stage bounds — slab rects tile the bounds exactly, area sum equals bounds area, pairwise overlap 0, verified numerically on all three stages | Inside the arena a footstep **always** resolves a material; `null` is reachable only out of bounds |
| **Seam ownership single-valued** — ascending slab index, inclusive bounds, **first match wins** | A step exactly on a shared edge always resolves to the lower-index slab, so timbre **cannot flicker between two materials mid-stride**. This is the property that makes per-surface footsteps safe at 5 Hz; without it a player walking a seam would alternate timbres every step. |
| Returns `null` outside bounds, never throws | The §2.2 fallback is the only failure mode |

A `null` return (out of bounds, resolver absent, or stage not yet authored) falls back to the base
`movement-step` profile, so audio degrades to today's timbre rather than going silent.

Footsteps resolve the material from `event.to` (the post-move integer position already in the
payload, `defense-run-simulation.js:2882`).

#### 2.2.1 Slab → material assignment [OBSERVED from `DungeonLevelDesign`]

Twelve slabs, nine material ids — three materials are reused, so the timbre table stays at
**9 entries, not 12**.

| Slab id | Name | Material |
|---|---|---|
| `cinder-span:slab-01` | West Ash Abutment | `ash-drift` |
| `cinder-span:slab-02` | Ember Relay Causeway | `basalt-ember` |
| `cinder-span:slab-03` | Drowned Forge Court | `forge-plate` |
| `abyss-chancel:slab-01` | West Processional Narthex | `flagstone-oath` |
| `abyss-chancel:slab-02` | Nave Crossing | `flagstone-oath` *(reuse)* |
| `abyss-chancel:slab-03` | North Oath Apse | `oath-inlay` |
| `abyss-chancel:slab-04` | South Transept Arm | `vestry-tile` |
| `echo-throne:slab-01` | West Echo Narthex | `polished-echo` |
| `echo-throne:slab-02` | North Repeating Gallery | `fracture-glass` |
| `echo-throne:slab-03` | Sovereign Aisle | `gilt-compass` |
| `echo-throne:slab-04` | South Repeating Gallery | `fracture-glass` *(reuse — 02/04 are exact mirrors about y=6000)* |
| `echo-throne:slab-05` | Crescent Throne Court | `polished-echo` *(reuse)* |

The `echo-throne` 02/04 mirror reuse is **load-bearing for audio**: the two galleries are
deliberate mirrors, so an identical `fracture-glass` timbre is the correct reading — a player
crossing either gallery must hear the same floor, because they are the same floor reflected.

**Variant key extension [TARGET].** `variantKey()` (`defense-audio.js:641-644`) gains one
branch, additive and scoped to a single cue id:

```
if (cueId === "movement-step" && material) return `movement-step:MOVE:${material}`;
```

Existing keys (`${cueId}:${type}`, `${cueId}:TERMINAL:${outcome}`) are untouched.

**Nine material profiles [TARGET].** All single-layer, all gain ≤ 0.040 (base is 0.035), all
duration ≤ 0.060 s. Timbre carries the surface; loudness never does.

| Stage | Material id | Layer | Read |
|---|---|---|---|
| cinder-span | `basalt-ember` | `tone("triangle", 92, 72, 0.045, 0.035, 0, 0.004)` | base profile, unchanged — hard volcanic rock |
| cinder-span | `ash-drift` | `tone("sine", 74, 58, 0.058, 0.026, 0, 0.010)` | soft, muffled, slower attack — deep ash |
| cinder-span | `forge-plate` | `tone("square", 138, 104, 0.038, 0.032, 0, 0.003)` | bright metallic tap — forged plate |
| abyss-chancel | `flagstone-oath` | `tone("triangle", 104, 80, 0.048, 0.034, 0, 0.004)` | dressed stone, slightly brighter than basalt |
| abyss-chancel | `oath-inlay` | `tone("sine", 156, 117, 0.052, 0.028, 0, 0.006)` | inlaid metal-in-stone, ringing tail |
| abyss-chancel | `vestry-tile` | `tone("triangle", 124, 88, 0.040, 0.030, 0, 0.003)` | small hard tile, tight |
| echo-throne | `polished-echo` | `tone("sine", 116, 92, 0.056, 0.032, 0, 0.005)` | polished stone, long clean decay |
| echo-throne | `gilt-compass` | `tone("square", 174, 130, 0.036, 0.030, 0, 0.003)` | gilt inlay, brightest and shortest |
| echo-throne | `fracture-glass` | `tone("sawtooth", 208, 148, 0.044, 0.028, 0, 0.002)` | glass fracture, sharpest onset |

Distinctness rule [TARGET]: adjacent materials **within one stage** differ in waveform *and* by
≥ 25 % in base frequency, so a slab transition is audible without a visual cue. Across stages the
same slot never reuses a waveform+frequency pair.

### 2.3 Policy binding — the un-shadowing

**`AUDIO_EVENT_POLICY.MOVE` stays exactly `silentPolicy("movement")`.** This is not timidity: it
is what keeps assertion **T1** byte-identical, and it remains the truthful default for the
`MOVE` event *class* (60 emits/s across every actor, of which at most 5/s are footsteps).

Beside the registry, one additional frozen policy object built by the **existing**
`feedbackPolicy` factory (`defense-audio.js:221-222`) — no new factory, **no new policy field**:

```
const MOVEMENT_FOOTSTEP_POLICY = feedbackPolicy("movement-step", 5, "movement");
```

`audioCueForEvent()` resolves `MOVE` against the cadence gate (§2.1) and returns
`MOVEMENT_FOOTSTEP_POLICY` on a step tick, `AUDIO_EVENT_POLICY.MOVE` otherwise. Both are
ordinary policy objects with the same six keys, so the spread at `:634-637` produces the same
object shape either way and **T1's `assert.deepEqual` still enumerates exactly six keys**.

**Priority 5 — the mix rule [TARGET].** `makeRoomForVoice()` evicts only when
`candidate.priority < priority` (`defense-audio.js:1001-1003`). The lowest priority any *other*
voice can hold is 5 (`camera-clamp`); every policy-driven cue is ≥ 28. Therefore a footstep at
priority 5 **can never evict any voice** — it is dropped instead. That is a provable guarantee,
not a tuning hope:

| Band | Priority | Members |
|---|---|---|
| terminal | 98–100 | `TERMINAL`, `COMMANDER_DOWNED` |
| retry | 94 | `RETRY_STARTED`, `RUN_RETRIED` |
| boss / critical | 82–90 | `BOSS_SPAWNED`, `OBJECTIVE_PRESSURE_DEADLINE`, `BOSS_RALLY_WINDOW`, `BOSS_ATTACK_TELEGRAPHED`, `OBJECTIVE_FAILED`, `CRITICAL_HIT`, `MIDBOSS_SPAWNED` |
| damage / interrupt | 70–80 | commander/companion/gate/hazard damage, interrupts, pressure pulse |
| objective | 54–74 | occupation, extraction, waypoints, pickups |
| block / input | 46–54 | blocks, rejections, stance |
| contact / windup | 28–47 | impacts, sweeps, windups, enemy defeat, misses |
| **traversal (new)** | **5** | **`movement-step`** — ties `camera-clamp`, evicts nothing |

Because `play()` currently derives priority as
`AUDIO_EVENT_POLICY[event?.type]?.priority ?? (cueId === "camera-clamp" ? 5 : 40)`
(`defense-audio.js:1029-1030`), a footstep would otherwise read **0** from the silent registry
entry. Replace that inline ternary with a table + one rule [TARGET]:

```
const PRESENTATION_CUE_PRIORITY = Object.freeze({
  "camera-clamp": 5,
  "movement-step": 5,
  "buff-warning": 26,        // §4.4
});

const cuePriority = (cueId, event) => {
  const policy = AUDIO_EVENT_POLICY[event?.type];
  if (policy && !policy.intentionalSilence) return policy.priority;
  return PRESENTATION_CUE_PRIORITY[cueId] ?? policy?.priority ?? 40;
};
```

**Merge-safe variant, required if the cycle-close merge lands first (R-18).** The concurrent
session's `defense-audio.js` still carries the original ternary verbatim inside a `play()` whose
body has otherwise changed, so *rewriting* those two lines conflicts. The additive form avoids it
entirely — declare `PRESENTATION_CUE_PRIORITY` as a new module-level table (clean, untouched
region) and extend rather than replace the existing expression:

```js
const priority = AUDIO_EVENT_POLICY[event?.type]?.priority
  ?? PRESENTATION_CUE_PRIORITY[cueId]              // <- inserted line, nothing rewritten
  ?? (cueId === "camera-clamp" ? 5 : 40);
```

That is a one-line insertion instead of a two-line rewrite, and it is behaviourally identical for
every case in the table below because `camera-clamp` resolves 5 from either branch. **It does not
cover the `intentionalSilence` case**, though: `AUDIO_EVENT_POLICY.MOVE.priority` is `0`, which is
not nullish, so `??` short-circuits and a footstep would resolve **0** instead of **5**. Where the
merge forces the additive form, the guard must therefore be `(policy && !policy.intentionalSilence
? policy.priority : undefined) ?? PRESENTATION_CUE_PRIORITY[cueId] ?? …`, which is still an
insertion rather than a rewrite of the existing tail.

This is a strict refactor of an existing hack into a table. Verified against the four tests it
could touch: `camera-clamp` (no policy) still resolves 5 → `defense-observers-contract.test.mjs:453-454`
holds; an unknown catalog cue still resolves 40; **T4** resolves 5 for
`play("movement-step", MOVE)` and 5 < 72 → still `false`.

**Refractory key.** `cueRefractoryKey("movement-step", MOVE)` → category `"movement"` → key
`"movement-step:movement"` (`defense-audio.js:646-652`). One key for all footsteps: a held
direction cannot machine-gun, and the key is not shared with any combat family.

### 2.4 Why this is a contract change and not a prohibited bypass

Player-feel prompt §3 item 3 (`abyssal-lantern-player-feel-audio-vfx-development-prompt.md:97`)
states that `AUDIO_EVENT_POLICY` is the sole event→cue authority, that no sound may be attached
to an `intentionalSilence` entry **without an explicit contract change**, and that the
`event.cue` fallback and renderer-direct `play()` must not be used to route around the silence.

This design satisfies all three clauses:

- The decision is made **inside `audioCueForEvent()`**, the authority function, and is covered by
  new deterministic mapping tests (§V-2, V-3). That is the explicit contract change.
- It **does not read `event.cue`.** The cadence comes from `event.tick`, the actor discriminator
  from `event.direction`.
- It is **not** a renderer-direct `play()`. `app.js` gains no footstep call; the only injection
  is the read-only surface resolver.

**Rejected alternative [INFERENCE].** A dedicated simulation event (`COMMANDER_STEPPED`) would be
cleaner still, but adding an event to `run.events` changes `getRunSnapshot().events` and therefore
the `getRunDigest()` byte stream (`defense-run-simulation.js:3555`), invalidating every stored
seed fixture. That is a simulation-lane decision, not an audio one, and it is not required —
the existing payload already carries everything needed.

### 2.5 Companion footsteps — not deliverable this cycle [OBSERVED]

There are exactly **two** `MOVE` emit sites in the simulation: enemy (`defense-run-simulation.js:2414`)
and commander (`:2879`). **Companions do not emit `MOVE`.** Companion positions are visible in
`snapshot.companions[]`, but deriving steps from frame-to-frame position deltas is precisely what
player-feel prompt §3 item 2 (`:96`) forbids — presentation may not invent a beat the event stream
does not carry.

**Ruling: commander footsteps only.** Prerequisite if the team wants companion steps later: a
simulation-owned emit at the companion move site with `direction` populated, which reuses this
entire spec unchanged (the gate is `direction` + `tick`, not an id). Recorded as Open risk R-6.

### 2.6 Silence under pause, background, mute, and reduced motion

Footsteps inherit every existing guard in `play()` (`defense-audio.js:1020-1028`): the call
returns `false` when `muted`, `paused`, `backgrounded`, or the context is closed — **before any
node is allocated**. `pause()` (`:806`) and `suspendForBackground()` (`:784`) both call
`stopTransientVoices()`, which releases an in-flight footstep immediately.

One addition [TARGET]: **footsteps are suppressed when `reducedMotion` is true.** A 5 Hz
continuous stream is an ambience-class stimulus, and `reducedMotion` already gates exactly that
class — `startAmbience()` (`:908`) and `startBattleMusic()` (`:921`) both return early on it,
while transient cues are unaffected. Footsteps are the first transient cue that behaves like a
bed, so they follow the bed's rule. Discrete combat cues stay audible.

---

## 3. Combat verbs

### 3.1 Distinctness rule

Per player-feel prompt §4-B (`:145`), any two cues in the windup / contact / block / miss /
damage / critical set must differ in **at least two** of {onset (attack), pitch contour,
duration, layer count}. The table below states the pairwise margin explicitly so a reviewer can
check it without listening.

| Verb | Event(s) | Cue | Prio | Refract | Onset | Contour | Dur | Layers |
|---|---|---|---|---|---|---|---|---|
| Windup | `BASIC_ATTACK` 34, `MELEE_SWEEP` 35 | `attack-windup` | 34/35 | 0.12 | 0.006 slow | **rising** 180→260 | 0.11 | 1 |
| **Release (new)** | `WEAPON_FIRED`, `MELEE_SWEEP` | **`weapon-fire`** | **32/35** | **0.04** | 0.004 snap | falling 310→155 | 0.055 | 2 |
| Contact | `MELEE_IMPACT` 47, `PROJECTILE_IMPACT` 45, `ENEMY_ATTACK` 46 | `impact-hit` | 45–47 | 0.045 | 0.004 snap | falling 118→52 | 0.07 | 2 |
| Critical | `CRITICAL_HIT` | `critical-hit` | 82 | 0.1 | 0.004 snap | **rising** 480→720 | 0.12 | 2 |
| Block | `PROJECTILE_BLOCKED` | `block-contact` | 52 | 0.05 | 0.004 snap | falling 140→92 | 0.1 | 1 |
| **Guarded contact (new)** | `MELEE_IMPACT`/`PROJECTILE_IMPACT` with `guardedBy != null` | **`block-contact`** | 45–47 | 0.05 | — | — | — | — |
| Miss | `BOSS_ATTACK_CANCELLED` 44, `PROJECTILE_EXPIRED` 28 | `attack-miss` | 28/44 | 0.08 | 0.004 | falling 190→120 | 0.08 | 1 |
| **Dodge (new)** | `PROJECTILE_IMPACT` with `hit === false` | **`dodge-slip`** | **50** | **0.09** | 0.003 snap | **rising then falling** — see below | 0.075 | 2 |
| Damage taken (commander) | `COMMANDER_DAMAGED` | `impact-hit` variant | 74 | 0.045 | — | — | — | — |
| Damage taken (companion) | `COMPANION_DAMAGED` | `impact-hit` | 70 | 0.045 | — | — | — | — |
| Damage taken (gate) | `GATE_BREACHED` | `impact-hit` | 76 | 0.045 | — | — | — | — |
| Damage taken (hazard) | `HAZARD_DAMAGE` | `impact-hit` | 72 | 0.045 | — | — | — | — |

Windup vs release differ in onset, contour direction, duration and layer count — four of four.
Contact vs critical differ in contour direction and duration. Block vs contact differ in layer
count and contour depth (140→92 is a 34 % fall; 118→52 is 56 %).

### 3.2 Changes to existing bindings [TARGET]

Three re-pointings. None of them touches an asserted mapping: the only policy mappings under test
are the eleven at `audio-feedback-runtime.test.mjs:463-475`, and `WEAPON_FIRED`, `MELEE_SWEEP`,
`PROJECTILE_IMPACT`, `MELEE_IMPACT`, and `ENEMY_ATTACK` are **not among them** (verified).

| # | Change | Reason |
|---|---|---|
| C-1 | `WEAPON_FIRED: feedbackPolicy("weapon-fire", 32, "windup")` and `MELEE_SWEEP: feedbackPolicy("weapon-fire", 35, "windup")`; `BASIC_ATTACK` keeps `attack-windup` 34 | Un-shadows the second dead profile (§1.4). These events *are* the release — the simulation labels them with `cue: eventCue("weaponFire")` itself. Today windup and release are one sound. |
| C-2 | `PROJECTILE_IMPACT` with `event.hit === false` resolves `dodge-slip` 50 instead of `impact-hit` 45 | A dodged projectile currently sounds like a landed hit while the renderer plays `avoid` (`battle-realtime-three.js:4519`). Same discriminator the renderer already uses. |
| C-3 | `MELEE_IMPACT` / `PROJECTILE_IMPACT` with `event.guardedBy != null` resolves `block-contact` at the event's own priority | The renderer already plays `defence` for `guardedBy` (`battle-realtime-three.js:4514,4518`); audio should agree. Damage is still dealt (reduced to ¾), so priority stays in the contact band rather than dropping to `PROJECTILE_BLOCKED`'s 52. |

C-2 and C-3 are resolved in `audioCueForEvent()` on fields **already present in the public
payload** (`hit`, `guardedBy`) — the same mechanism as §2.3, no new policy field, and no
`event.cue` read. Precedence when both apply: `hit === false` wins (a dodge is not a block).

### 3.3 New profiles [TARGET]

```
"dodge-slip": [
  tone("sine",     240, 380, 0.045, 0.030, 0,     0.003),   // rising slip-past
  tone("triangle", 190, 128, 0.075, 0.020, 0.030, 0.004),   // settling tail
]
```

Refractory `"dodge-slip": 0.09` — just above `attack-miss` (0.08) so a burst of dodged
projectiles reads as separate events without buzzing.

Damage-taken differentiation, four meanings currently sharing one timbre. Rather than four new
cues, add three `CUE_VARIANTS` rows on the existing `impact-hit` id — the established pattern
(`impact-hit:PICKUP_DENIED` already exists) [TARGET]:

```
"impact-hit:COMMANDER_DAMAGED": [
  tone("sawtooth", 104, 46, 0.085, 0.078, 0,     0.004),
  tone("square",    52, 38, 0.055, 0.036, 0.010, 0.003),   // lower, longer — it happened to YOU
]
"impact-hit:GATE_BREACHED": [
  tone("sawtooth",  76, 34, 0.110, 0.075, 0,     0.006),
  tone("sine",      38, 30, 0.130, 0.040, 0.020, 0.008),   // sub-heavy structural
]
"impact-hit:HAZARD_DAMAGE": [
  tone("triangle", 132, 58, 0.070, 0.070, 0,     0.005),
  tone("sawtooth",  66, 44, 0.050, 0.030, 0.012, 0.004),   // environmental, not an attacker
]
```

`COMPANION_DAMAGED` keeps the base `impact-hit` profile, so the commander's own damage is
distinguishable from an ally's.

**Crowded-encounter separability.** The shared `impact-hit:hit` refractory family
(`cueRefractoryKey()`, `:648-650`) already collapses contact and damage into one 45 ms gate, so a
10-enemy volley yields ≤ 22 impact voices/s, not 10 × their true rate. The variants above change
timbre **inside** that gate — they add zero voices. `critical-hit` (0.1) and `dodge-slip` (0.09)
have their own keys, so a critical or a dodge is never swallowed by ordinary contact.

---

## 4. New gameplay moments

Every event type, field name, and enum value below is taken **verbatim** from Director ruling
v1 + v2 + v3. No name is coined here. Audio and `VfxCueDesign` bind to the same type
(ruling v2 binding rule).

### 4.1 Vocabulary adopted

| Concept | Ruled type | Ruled payload fields used by audio |
|---|---|---|
| Drop appears | `DROP_SPAWNED` | `dropId, itemId, rarity, grade, x, y, slabId` |
| Drop despawns | `DROP_EXPIRED` | `dropId, itemId, x, y` |
| Drop roll discarded | `DROP_DENIED` (v2 R2) | `itemId, rarity, grade, reason, x, y, slabId`; `reason` is **`"FIELD_CAP"` only** — `"MEASUREMENT_PROFILE"` was **withdrawn** by `DropBuffSystem` (unreachable: a measurement-profile run emits nothing at all, and emitting it would break G2 fixture isolation) |
| Drop collected | `ITEM_COLLECTED` (existing) | `+ dropId, + rarity` |
| Buff gained | `BUFF_APPLIED` | `buffId, itemId, stat, magnitude, durationTicks, stacks, expiresAtTick` |
| Buff re-upped | `BUFF_REFRESHED` (v2 R6) | `buffId, itemId, stacks, expiresAtTick` |
| Buff ends | `BUFF_EXPIRED` | `buffId, itemId, stat, reason`; `reason ∈ TIMEOUT \| EVICTED \| STAGE_TRANSITION \| DEATH` (v2 R10) |
| Enemy arrives | `ENEMY_SPAWNED` | `+ grade ∈ BASIC \| SHADOW \| BOSS` (v2 R4), `slabId`, `telegraphTicks`, `x, y` |
| Midboss arrives | `MIDBOSS_SPAWNED` (existing, v2 R12) | unchanged |
| Boss arrives | `BOSS_SPAWNED` (existing) | unchanged |
| Gimmick telegraph | `GIMMICK_ARMED` | `gimmickId, slabId, gimmickClass, telegraphTicks, x, y` |
| Gimmick fires | `GIMMICK_TRIGGERED` (v2 R5) | `gimmickId, slabId, gimmickClass, corridorWidthBefore, corridorWidthAfter, x, y` |
| Gimmick settles | `GIMMICK_RESOLVED` | `gimmickId, slabId, gimmickClass, x, y` |
| Pacing block starts | `PACING_BLOCK_STARTED` | `blockId, objectiveId, waveSlots` |
| Pacing block clears | `PACING_BLOCK_CLEARED` | `blockId, objectiveId, recoveryTicks` |

`gimmickClass ∈ deformation | gate | mirror | hazard` (v2 R5). `stat` is the seven-value enum
(v3 R17): `basicDamage | gateMaxIntegrity | pickupRange | cooldownScaleBp | moveSpeedBp |
critChanceBp | incomingDamageBp`. `magnitude` is always an integer in basis points (v2 R13).

**Snapshot state, verbatim from `DropBuffSystem`'s final spec
(`_workspace/current/design/item-drop-timed-buff-spec.md`) [OBSERVED from that lane]:**

- `snapshot.buffs` **and** `snapshot.buffStats`, both **conditionally present** — absent entirely
  when no buff is active — sorted by `buffId`. Entry:
  `{ buffId, itemId, stat, magnitude, stacks, appliedAtTick, expiresAtTick, sourceDropId }`.
  Audio must therefore treat `snapshot.buffs` as possibly `undefined`, not as an empty array
  (§4.4).
- Field drops live in **`snapshot.pickups[]` with `kind: "buff"`** — no new array. This is the
  same array `VfxCueDesign` uses for the idle drop beacon, so a lying-drop audio loop, if one is
  ever added, keys off that array and not off an event.
- Caps: `MAX_FIELD_DROPS 8`, `MAX_ACTIVE_BUFFS 6`, `maxStacks ≤ 3`, `DROP_TTL_TICKS 1800`.
- `run.dropRng = rngNext(seed ^ 0x85ebca6b)`, a derived stream; `run.rng` is never consumed —
  so no audio-visible probability shifts the digest.

#### 4.1.1 Payload-field collisions — audio's immunity is structural, and proven

Standing policy (ruling v10): **grep the blob for a payload field name before introducing it** —
`git show 033877ad:<path> | grep -n <field>`. Three fields this spec reads already exist on
shipped events with different meanings:

| Field | Pre-existing owner | Its shipped meaning | This spec reads it on |
|---|---|---|---|
| `telegraphTicks` | `ENCOUNTER_PATH_CONTESTED` (`defense-run-simulation.js:2296`) | `contestTicks` — how long a body must hold a contest waypoint | `GIMMICK_ARMED`, `ENEMY_SPAWNED` |
| `recoveryTicks` | `ENCOUNTER_RECOVERY_STARTED` (`:1049`) | `objective.retry.recoveryTicks` — the retry window | `PACING_BLOCK_CLEARED` (§5.4) |
| `reason` | four incompatible vocabularies across six sites (below) | varies per event | `BUFF_EXPIRED`, `DROP_DENIED` |
| `objectiveId` | **69 occurrences** in the blob, incl. `ENCOUNTER_PATH_CONTESTED` | the encounter objective a body/beat belongs to | `OBJECTIVE_PHASE_CHANGED`, `OBJECTIVE_COMPLETED`, and `PACING_BLOCK_*` payloads |

**Audio cannot suffer the pool-exhaustion vector `EncounterPacing` quantified, and the reason is
structural rather than lucky [OBSERVED — executed, not asserted].** Both colliding events were run
through the real authority functions with their blob-accurate payloads:

| Check | `ENCOUNTER_PATH_CONTESTED` | `ENCOUNTER_RECOVERY_STARTED` |
|---|---|---|
| present in `AUDIO_EVENT_POLICY`? | **false** | **false** |
| `audioCueForEvent(event)` | **`null`** | **`null`** |
| `audioSoundscapeForEvent(event, …)` | **`null`** | **`null`** |
| carries a `cue:` field in the blob? | **no** (0 matches in the emit) | **no** (0 matches) |

Three independent barriers, any one of which suffices: the event is absent from the registry, so
`audioCueForEvent` falls through; the catalog fallback needs `event.cue`, which neither carries;
and `audioSoundscapeForEvent` is a `switch (event?.type)` whose `default` returns `null`. Audio
therefore **never reaches a field read at all** for these events — the collision is unreachable
rather than guarded. `consume()` drops them before `play()`.

**`objectiveId` is the most dangerous of the four, and audio survives it three different ways
[OBSERVED — executed].** `DungeonLevelDesign` measured **69 occurrences** in the blob, and
`ENCOUNTER_PATH_CONTESTED` carries **both `objectiveId` and `telegraphTicks`** — precisely the two
fields a gimmick telegraph would naturally key on. `UiOverhaulConcept`'s framing is the sharpest
in the family: a presence-keyed consumer renders a **complete, plausible-looking** artefact — real
label, real lifetime, real objective — for a route contest with no gimmick. Nothing looks broken,
so it survives review and QA and ships.

`defense-audio.js` reads `objectiveId` at exactly three sites, and each is protected differently:

| Site | Read | Protection |
|---|---|---|
| `:773` | `event.objectiveId === "boss-kill"` | inside `case "OBJECTIVE_PHASE_CHANGED":` of the `switch (event?.type)` — **type-gated by structure** |
| `:863` | `event.objectiveId === "boss-kill"` in `storyNarrationEligible` | guarded by `STORY_NARRATION_EVENT_TYPES.has(event?.type)` — **an allow-set checked before the field read**, the exact shape `DungeonLevelDesign` mandates |
| `:984` | `event?.objectiveId ?? ""` in `feedbackEventKey` | **type-agnostic by design** — it composes a dedupe key from every id field. Protected by an allow-set at *function entry*: `feedbackEventKey` returns `null` unless `FEEDBACK_EVENT_TYPES.has(event?.type)` or `byId[event?.cue]`. `ENCOUNTER_PATH_CONTESTED` satisfies neither, so the function exits before reaching `:984`. |

Executed against the real module with the blob-accurate payload, **three** contest events (as
120–139 bodies per stage would deliver): `audioCueForEvent` → `null`, `audioSoundscapeForEvent` →
`null`, **cues played → 0**, **`feedbackEvents` recorded → 0**, soundscape state unchanged. The
type-agnostic read is real but unreachable.

**Unreachable beats guarded, and the distinction is worth naming.** "Guarded" means someone must
keep guarding it; "unreachable" means a careless future consumer cannot reintroduce the vector.
Audio's position is the latter for all four fields — but only because `AUDIO_EVENT_POLICY` is the
single entry point. **That property belongs to the current structure, not to the codebase**: it
would be lost the moment a consumer reads a snapshot event outside `consume()`. That is the real
content of the prohibition below.

**The one field read this spec does instruct is already type-gated by construction.** §5.4's
`recoveryTicks` read lives inside `case "PACING_BLOCK_CLEARED":` of that same switch, so it is
reachable only for its owning type. **Requirement, so it stays that way:** never introduce a
cross-family helper such as `durationFor(event)` or `effectLifetime(event)` in the audio module.
Every field read must sit inside a `case` arm or behind an explicit `event.type` check. This is
the same shape ruling v10 confirmed in the renderer — `resolveVfxLifetimeTicks` dispatches on
type first, and its two real `telegraphTicks` reads sit inside the `ENEMY_SPAWNED` and
`GIMMICK_ARMED` branches.

**`reason` is the sharpest of the three, and this spec keys two cues on it.** §4.2 gates
`DROP_DENIED` on `reason === "FIELD_CAP"` and §4.3 gates `BUFF_EXPIRED` on `reason === "TIMEOUT"`.
Shipped `reason` sites at `033877ad`, with their vocabularies [OBSERVED, blob-grounded]:

| Event | Line | Value | Vocabulary |
|---|---|---|---|
| `PROJECTILE_EXPIRED` | `:1740` | `outside ? "bounds" : "range"` | **lowercase** |
| `REWARD_SELECTION_DUPLICATE_IGNORED` | `:2018` | `"REWARD_ALREADY_OWNED"` | SCREAMING_SNAKE |
| `REWARD_SELECTED` | `:2044` | `"M4_CARD_INVENTORY_EXHAUSTED"` / `"M4_CARD_DECISION_INVALID"` | SCREAMING_SNAKE |
| *(m4 fallback)* | `:2082` | `run.m4.fallbackReason` | **dynamic** |
| `EXTRACTION_REJECTED` | `:2195`, `:2204` | `rejectionReason` (may be `null`) | **dynamic** |

**Two of those events already carry audio policies** — `PROJECTILE_EXPIRED` → `attack-miss` 28,
`EXTRACTION_REJECTED` → `input-rejected` 62, and `REWARD_SELECTED` → `terminal` 70 — so unlike
the other two collisions these *are* reachable in `play()`. They are safe today only because this
spec's gates are written as `event.type === "BUFF_EXPIRED" && event.reason === "TIMEOUT"`, never as
a bare `reason` lookup. **A `reason`-keyed table without a type gate would fail silently**, because
the value sets happen not to overlap — no throw, no wrong cue, just a gate that never fires or one
that fires on the wrong event. Loud failure would be safer. Tracked as **R-20**.

`TERRAIN_DEFORMED` is **rejected** (v2 R5) — deformation is `GIMMICK_TRIGGERED` with
`gimmickClass === "deformation"`. Existing `TERRAIN_RECOVERY` (occupation scoring) keeps its
`item-collected` 54 binding and is not part of this family.

### 4.2 Drop family [TARGET]

| Event | Cue | Prio | Category | Refract | Rationale |
|---|---|---|---|---|---|
| `DROP_SPAWNED` | `drop-appear` | **38** | pickup | **0.09** | Below `ENEMY_DEFEATED` 36? No — deliberately *above* it, so the reward reads over the kill that produced it, while staying under every damage cue. |
| `DROP_EXPIRED` | `drop-expire` | **30** | pickup | **0.14** | A loss worth noticing, never alarming. Lowest new cue. |
| `DROP_DENIED` | **`null` — `silentPolicy("pickup")`** | 0 | pickup | — | See below. |
| `ITEM_COLLECTED` | `item-collected` (existing 56) | 56 | pickup | 0.08 | Keep; add rarity variants. |

**`DROP_DENIED` is intentionally silent [TARGET].** The event reports a *system-side* cap
(`reason: FIELD_CAP | MEASUREMENT_PROFILE`) on a roll the player never acted on. Sounding it
would fire on every over-cap wave clear and would collide semantically with `PICKUP_DENIED` 50,
which reports a genuine rejected player action. Recorded as an eighth `intentionalSilence` entry
alongside the existing seven, with the visual equivalent in §6.5. This is a design decision, not
an omission.

**Rarity timbre — four tiers (v2 R3) [TARGET].** `rarity ∈ common | rare | resonant | relic`.
Variants on both `drop-appear` and `item-collected`, keyed by the §2.2 variant-key mechanism
extended to `${cueId}:${type}:${rarity}`:

| Rarity | `drop-appear` layers | Read |
|---|---|---|
| `common` | `sine 520→660 .14 .055 atk.005` | single soft chime |
| `rare` | `sine 560→760 .17 .062 atk.005` + `triangle 840→1020 .11 .030 @.035` | two layers, brighter |
| `resonant` | `sine 620→880 .21 .068 atk.005` + `triangle 930→1240 .14 .034 @.040` + `sine 1240→1560 .09 .018 @.085` | three layers, ringing |
| `relic` | `sine 660→990 .26 .072 atk.006` + `triangle 990→1480 .18 .038 @.045` + `sine 1480→1980 .12 .020 @.095` + `sawtooth 330→495 .22 .022 @.010` | four layers + sub — the only drop cue with a sub octave |

Layer count rises 1→2→3→4 with rarity, so tier is audible by density, not just pitch. Node cost
at `relic` is 8 nodes / 1 voice, within `MAX_TRANSIENT_NODES = 48`.

### 4.3 Buff family [TARGET]

| Event | Cue | Prio | Category | Refract | Notes |
|---|---|---|---|---|---|
| `BUFF_APPLIED` | `buff-apply` | **54** | pickup | **0.10** | Just under `ITEM_COLLECTED` 56: collecting is the act, gaining the buff is its consequence, and they arrive in the same batch. |
| `BUFF_REFRESHED` | `buff-refresh` | **44** | pickup | **0.12** | A separate event (v2 R6), a distinctly softer cue — no branch on a flag. |
| `BUFF_EXPIRED`, `reason === "TIMEOUT"` | `buff-expire` | **40** | pickup | **0.12** | v2 R10(a). |
| `BUFF_EXPIRED`, other reasons | **silent** | 0 | pickup | — | `EVICTED`, `STAGE_TRANSITION`, `DEATH` are bookkeeping; sounding them fires a wall of stings on every stage transition. v2 R10(a) ratified. |

**Why the `reason` gate is load-bearing, quantified — and which reason actually fires it.**
`MAX_ACTIVE_BUFFS = 6` (`DropBuffSystem` §4.1), so one sweep can expire **6 buffs in one tick**.
Ungated that is 6 `buff-expire` voices in a single batch — **half the 12-voice pool** spent on
bookkeeping at the exact moment the mix is most contested.

The reachable trigger is **`reason: "DEATH"`**, not `STAGE_TRANSITION`. Correction accepted from
`DropBuffSystem` [OBSERVED in their spec §3.6 and Open risk 9]:

| `reason` | Reachable at 033877ad? | Fires how many at once | Audible? |
|---|---|---|---|
| `TIMEOUT` | yes — `expireBuffs` at Phase A | 1 at a time, spread by `durationTicks` | **yes**, `buff-expire` 40 |
| **`DEATH`** | **yes — `clearBuffs(run, "DEATH")` on `run.terminal` and in the `RETRY_OBJECTIVE` input branch** | **up to 6 in the terminal tick** | no |
| `EVICTED` | yes — `evictOldestBuff` on the 7th distinct buff | 1, mid-combat | no |
| `STAGE_TRANSITION` | **no — unreachable today.** A new stage is a new `createDefenseRun`, which sets `buffs: []` and reseeds `dropRng`; buffs never cross a stage boundary | n/a | no |

The distinction is load-bearing, not pedantry: **if this gate were justified by `STAGE_TRANSITION`
alone, the next reader would check reachability, find it dead, and delete the gate** — and then a
wipe or an objective retry fires the 6-sting burst it was protecting against, on top of
`TERMINAL` (100). `STAGE_TRANSITION` stays in the enum, labelled unreachable-today, so the enum
stays honest.

`EVICTED` is the one silence worth flagging as arguable: the player just **lost** a buff to make
room for a new one, and hears nothing about it. It stays silent here because it always coincides
with the `buff-apply` of the buff that displaced it — one player action, one cue, per the
causal-chain rule. `UiOverhaulConcept` independently gates the strip's expiry accent to
`TIMEOUT` only, for the added reason that an "it ran out" flourish on an `EVICTED` buff would be
a lie about why it ended. Audio and HUD therefore agree on all four reasons.

`maxStacks ≤ 3` likewise bounds `BUFF_REFRESHED`: at most 2 refreshes per buff id before the cap.

```
"buff-apply":   [ tone("triangle", 300, 450, 0.20, 0.070, 0,     0.006),
                  tone("sine",     450, 600, 0.15, 0.034, 0.040, 0.005) ]   // rising, two layers
"buff-refresh": [ tone("triangle", 330, 396, 0.11, 0.040, 0,     0.006) ]   // one layer, shallow rise
"buff-expire":  [ tone("sine",     420, 264, 0.17, 0.042, 0,     0.005) ]   // one layer, falling — mirror of apply
"buff-warning": [ tone("sine",     360, 300, 0.09, 0.026, 0,     0.005) ]   // §4.4
```

`buff-apply` rises and `buff-expire` falls across the same register — gain and loss are inverses,
audible without reading the HUD. `buff-refresh` is a shallow (20 %) rise versus apply's 50 %.

**Stat differentiation [TARGET].** Seven stats (v3 R17) with one cue would be undifferentiated.
Rather than seven cues, `buff-apply` and `buff-expire` take a **base-frequency offset by stat**,
via variant key `${cueId}:${type}:${stat}` — one table, no new cue ids:

| `stat` | Offset | Resulting `buff-apply` base |
|---|---|---|
| `basicDamage` | ×1.00 | 300 → 450 |
| `gateMaxIntegrity` | ×0.75 | 225 → 338 |
| `pickupRange` | ×1.20 | 360 → 540 |
| `cooldownScaleBp` | ×1.35 | 405 → 608 |
| `moveSpeedBp` | ×1.50 | 450 → 675 |
| `critChanceBp` | ×1.68 | 504 → 756 |
| `incomingDamageBp` | ×0.85 | 255 → 383 |

Ratios are ≥ 12 % apart, above a just-noticeable pitch difference for short tones [INFERENCE —
not measured on this hardware; §V-14 is the measurement].

### 4.4 Pre-expiry warning — no new event

Per v2 R10(b) there is no pre-expiry event, and one must not be added: a per-tick warning would
bloat `run.events` every tick. The warning is derived presentation-side from
`snapshot.buffs` [TARGET]. `DropBuffSystem` carries this shape in their §7.1 as
`BUFF_WARN_TICKS = 180`, credited **presentation-only** — the simulation does not act on it.

- **Conditional-presence guard, required.** `snapshot.buffs` is **absent** when no buff is active
  (`DropBuffSystem` final contract), not an empty array. The derivation must read
  `snapshot.buffs ?? []`; a bare `snapshot.buffs.find(...)` throws on the common case of a run
  with no active buff.
- Trigger: `expiresAtTick - snapshot.tick === 180` (`BUFF_WARN_TICKS`, exactly 3.00 s at
  `TICK_RATE = 60`).
- **The threshold and the comparison already exist [OBSERVED].** `BUFF_WARN_TICKS = 180` is
  already declared in `app.js`, and `renderBuffStrip()` already computes
  `warning = remaining > 0 && remaining <= BUFF_WARN_TICKS` from `expiresAtTick − snapshot.tick`,
  reading `snapshot.buffs ?? []` exactly as §4.1 requires. The HUD's `data-buff-warning` hatch is
  therefore live **today**, with no event and no audio dependency. *(Symbol anchors only — `app.js`
  is under active edit by `UiJoystickImpl` and every line number in it is stale on arrival.)*
- **Consequence: 180 is a shared derivation, not presentation-private.** `DropBuffSystem` and
  `UiOverhaulConcept` both originally documented `BUFF_WARN_TICKS` as owned solely by the HUD.
  Once the sting hangs off the same comparison it stops being theirs alone: **there is exactly one
  place the threshold is evaluated, so the strip and the sting can never disagree**, and changing
  180 silently retimes the audio. That is the correct shape — one comparison, two consumers — and
  it is recorded here so no lane changes the number believing it is local.
- Mechanism: the audio cue hangs off that existing comparison —
  `this.audio.signalBuffExpiring?.(buffId)` on the frame `remaining` first drops to `<= 180`, in
  the same pass that sets `data-buff-warning="true"`. Optional-call so a build without the method
  degrades to a silent strip warning instead of throwing inside the render loop. `DefenseAudio`
  side: `signalBuffExpiring(buffId)` → `play("buff-warning")`. This mirrors two existing patterns —
  `signalCameraClamp()` (`app.js:2301-2303`) for a snapshot-derived cue with no event, and
  `rallyAcknowledgedBossIds` (`app.js:2917-2921`) for once-per-id dedupe.
- **Fire once per APPROACH, not once per buff — this is an edge detector, not a fire-once `Set`.**
  Defect found by `UiJoystickImpl`, accepted; it was mine and no test covers it.
  `BUFF_REFRESHED` **extends `expiresAtTick`**, so `remaining` rises back above 180 and the buff
  approaches expiry a **second** time — but under a permanently-held warned-id `Set` its id is
  still present, so it **never warns again for the rest of the run**. Silent failure. The
  correct shape is a rising/falling edge detector:

  ```js
  const warn = remaining > 0 && remaining <= BUFF_WARN_TICKS;   // the ONE comparison, §4.4
  if (warn && !this.warnedBuffIds.has(buffId)) {
    this.warnedBuffIds.add(buffId);
    this.audio.signalBuffExpiring?.(buffId);                    // rising edge → sting
  } else if (!warn) {
    this.warnedBuffIds.delete(buffId);                          // falling edge → re-arm
  }
  ```

  The `delete` on the falling edge is the whole fix: a refresh pushes `remaining` back over 180,
  clears the id, and the next approach warns again. It also subsumes the separate remount concern
  below, because a buff absent from `snapshot.buffs` never evaluates `warn` as true.
- **`Set` must additionally clear in `beginRun()` AND on stage remount.** Gap flagged by
  `UiOverhaulConcept` and accepted: `buffId` is `buff-<n>` from the run-local `nextId` counter, so
  a re-entered stage **reuses ids**. Clearing only in `beginRun()` would leave a re-entered stage
  unable to re-warn a reused id. Not deliberate on my side — a real omission.
- Priority **26** via `PRESENTATION_CUE_PRIORITY` (§2.3), refractory `"buff-warning": 0.25`.
- This is **not** a bypass of an `intentionalSilence` policy: there is no `BUFF_EXPIRING` event to
  silence, exactly as with `camera-clamp`. The
  `defense-observers-contract.test.mjs:462-463` invariant is preserved because no simulation
  event maps to `buff-warning` either.

### 4.5 Spawn family [TARGET]

| Grade | Event | Cue | Prio | Category | Refract |
|---|---|---|---|---|---|
| `BASIC` | `ENEMY_SPAWNED`, `grade === "BASIC"` | **silent (unchanged)** | 0 | spawn | — |
| `SHADOW` | `ENEMY_SPAWNED`, `grade === "SHADOW"` | `shadow-arrival` | **68** | spawn | **0.60** |
| `BOSS` | `BOSS_SPAWNED` (existing) | `boss-spawned` | 90 | boss | — |
| midboss | `MIDBOSS_SPAWNED` (existing, v2 R12) | `warning-pulse` | 82 | boss | 0.35 |

**`BASIC` stays silent, and this is a measurement, not laziness.** `VfxCueDesign`'s standing
worst case is **10 concurrent BASIC + 1 SHADOW in a single tick**. Ten `enemy-defeated`-class
voices at 2 nodes each would consume 20 of 48 transient nodes and 10 of **12** active voices in
one tick, starving every damage and objective cue in the same batch. The existing
`ENEMY_SPAWNED: silentPolicy("spawn")` entry is retained for exactly this reason, with the
visual equivalent in §6.5.

Audio reads **`grade` only** and never re-derives it from `elite`/`midboss` (v2 R4).

```
"shadow-arrival": [ tone("sawtooth", 62, 41, 0.34, 0.062, 0,     0.018),
                    tone("sine",     31, 26, 0.40, 0.048, 0.030, 0.022) ]
```

**Spawn telegraph windows [OBSERVED from `EncounterPacing`].** `ENEMY_SPAWNED.telegraphTicks` is a
real pre-attack reaction window, not decoration: **30** BASIC / **60** SHADOW / **90** BOSS.
The SHADOW arrival cue is 0.40 s (24 ticks) against a 60-tick (1.00 s) window, so the cue
completes with 36 ticks (0.60 s) of reaction time still on the clock — the player hears the
arrival, then still has more than half the window to respond. `shadow-arrival`'s 0.60 s
refractory is set just above its own 0.40 s envelope so two SHADOW arrivals inside one window
cannot overlap into a smear.


**Deliberate two-voice composite at a midboss.** `spawnEnemy()` emits `ENEMY_SPAWNED` and then
`MIDBOSS_SPAWNED` in the same tick, so a midboss produces `shadow-arrival` 68 **and**
`warning-pulse` 82 together. This is not the duplicate emphasis player-feel §4-B forbids: the two
occupy disjoint registers — `shadow-arrival` is 31–62 Hz sub, `warning-pulse` is 170–255 Hz upper
alarm — and read as one layered arrival. Cost is 4 voices, 8 nodes, once per midboss.
Suppressing one of them would require reading `event.midboss`, which v2 R4 forbids. Recorded as
Open risk R-5 with its measurement.

### 4.6 Gimmick family, including terrain deformation [TARGET]

| Event | `gimmickClass` | Cue | Prio | Category | Refract |
|---|---|---|---|---|---|
| `GIMMICK_ARMED` | any | `gimmick-arm` | **72** | warning | **0.40** |
| `GIMMICK_TRIGGERED` | `deformation` | `terrain-deform` | **76** | warning | **0.45** |
| `GIMMICK_TRIGGERED` | `hazard` | `warning-pulse` (existing) | 78 | warning | 0.35 |
| `GIMMICK_TRIGGERED` | `gate` | `occupation-captured` (existing) | 64 | objective | 0.12 |
| `GIMMICK_TRIGGERED` | `mirror` | `gimmick-mirror` | **66** | warning | 0.30 |
| `GIMMICK_RESOLVED` | any | `gimmick-settle` | **34** | objective | 0.25 |

Class branching happens on `gimmickClass`, a ruled payload field — one event type, four
readings, exactly as v2 R5 requires.

```
"gimmick-arm":    [ tone("sawtooth", 128, 192, 0.26, 0.052, 0,     0.020),   // rising telegraph
                    tone("sine",      64,  96, 0.30, 0.030, 0.030, 0.024) ]
"terrain-deform": [ tone("sawtooth",  84,  36, 0.42, 0.080, 0,     0.008),   // collapse
                    tone("square",    42,  28, 0.36, 0.044, 0.020, 0.010),
                    tone("sine",      28,  22, 0.50, 0.052, 0.050, 0.014) ]  // sub settle
"gimmick-mirror": [ tone("sine",     740, 494, 0.22, 0.046, 0,     0.004),   // glass inversion
                    tone("triangle", 494, 370, 0.16, 0.026, 0.030, 0.004) ]
"gimmick-settle": [ tone("triangle", 168, 126, 0.14, 0.034, 0,     0.008) ]
```

`gimmick-arm` **rises**, `terrain-deform` **falls** into a sub — arm and fire are inverses, and
`terrain-deform` is the only cue in the whole registry with three descending layers reaching
22 Hz, so it cannot be confused with `boss-spawned` (which also reaches 36 Hz but rises in its
third layer at 45→36 with a longer 0.62 s tail).

**Telegraph duration — `[TARGET]`, not `[OBSERVED]`.** Relabelled per ruling v6 C3, which names
this spec as one of three instances of a design document wearing an `[OBSERVED]` costume.
Blob-grounded via `git show 033877ad:defense-catalog.js 033877ad:defense-run-simulation.js`:
**`GIMMICK_ARMED`, `gimmickClass`, `DROP_SPAWNED`, `BUFF_APPLIED`, `slabMaterialAt`, and
`ingressTicks` return 0 occurrences each.** Every number below is a peer lane's authored intent.

Contract both authorities agree on: `telegraphTicks` is the **full reaction window** — ARMED at
tick `T` → TRIGGERED at exactly `T + telegraphTicks`.

**Tiers — SETTLED.** An earlier revision recorded a hazard/mirror swap between two authorities.
`DungeonLevelDesign` has since withdrawn their list and adopted ruling v6 C2 verbatim,
self-reporting that their published tiers were wrong for 5 of 13 gimmicks:

| `gimmickClass` | `telegraphTicks` | Seconds | `gimmick-arm` fits? | Headroom vs 18 t |
|---|---|---|---|---|
| `deformation` | 180 | 3.00 | yes | 162 t (2.70 s) |
| narrowing `gate` | 120 | 2.00 | yes | 102 t (1.70 s) |
| progress-ring / `mirror` | 90 | 1.50 | yes | 72 t (1.20 s) |
| `hazard` | 60 | 1.00 | yes | 42 t (0.70 s) |

**Audio required no change through the contradiction or its resolution**, and that is a property
of the design rather than luck: `gimmick-arm` is a fixed 0.30 s (18-tick) envelope marking the
window's **onset**, never its duration, so the smallest tier still clears it by 42 t. Duration is
carried by `VfxCueDesign`'s telegraph visual and the `data-gimmick-state` attribute (§6.5).
R-7 stays **closed**; R-19 now tracks only the residual name collision below.

**Do not hardcode — read the field.** Ruling v6 C2's required form binds every duration-carrying
consumer: `Number.isInteger(event.telegraphTicks) ? event.telegraphTicks : 180`, with 180 as
fallback and clamp, never as the value. Audio needs no such read; this spec must not imply a
constant is safe for those who do.

⚠ **NAME COLLISION with shipped code [OBSERVED, blob-grounded].** `telegraphTicks` **already
exists** at `033877ad` — `defense-run-simulation.js:2296`, on **`ENCOUNTER_PATH_CONTESTED`**, where
it carries `contestTicks` (route-contest duration, default 60) and means something else entirely.
Per-event payloads are independent, so this is not a defect, but a generic "read
`event.telegraphTicks`" helper would silently also match that event. Any such read must key on
`event.type` first. `ENCOUNTER_PATH_CONTESTED` has no `AUDIO_EVENT_POLICY` entry and carries no
`cue`, so it is silent today and stays silent here.

`DungeonLevelDesign` further specifies that **two gimmicks never trigger in the same tick**, so
audio never has to mix two deformation stings — `terrain-deform` (3 layers / 6 nodes) is a
guaranteed solo in its tick. This is what keeps the §6.4 worst-case budget honest.

Because the deformation telegraph is a full 3.00 s and the cue occupies only the first 0.30 s,
the remaining 2.70 s is carried by `VfxCueDesign`'s telegraph visual and the
`data-gimmick-state` attribute (§6.5) — audio marks the *onset* of the window, not its duration.

### 4.7 Pacing blocks are BGM-only [TARGET]

`PACING_BLOCK_STARTED` and `PACING_BLOCK_CLEARED` get **no SFX cue**. They are state
transitions, not moments, and the moments inside them already sound:
`ENCOUNTER_OBJECTIVE_STARTED` 60, `OBJECTIVE_PHASE_CHANGED` 60, `WAVE_CLEARED` 58,
`OBJECTIVE_COMPLETED` 64. Adding a block stinger would double-emphasize the same beat, which
player-feel §4-B forbids. Both events are registered as `silentPolicy` entries **and** drive the
soundscape transition in §5 — a policy may be silent for SFX while still steering BGM, since
`consume()` runs `audioSoundscapeForEvent()` on every fresh event before any cue is played
(`defense-audio.js:1225-1232`), independent of `method`.

### 4.8 Registry delta summary

15 new policy entries: `DROP_SPAWNED`, `DROP_EXPIRED`, `DROP_DENIED`(silent), `BUFF_APPLIED`,
`BUFF_REFRESHED`, `BUFF_EXPIRED`, `GIMMICK_ARMED`, `GIMMICK_TRIGGERED`, `GIMMICK_RESOLVED`,
`PACING_BLOCK_STARTED`(silent), `PACING_BLOCK_CLEARED`(silent) = 11 registry keys, plus 4
conditional resolutions that reuse existing keys (`ENEMY_SPAWNED`/grade, `BUFF_EXPIRED`/reason,
`GIMMICK_TRIGGERED`/class, `PROJECTILE_IMPACT`/hit+guardedBy).

**65 → 76 registry keys.** New `CUE_PROFILES`: `dodge-slip`, `drop-appear`, `drop-expire`,
`buff-apply`, `buff-refresh`, `buff-expire`, `buff-warning`, `shadow-arrival`, `gimmick-arm`,
`terrain-deform`, `gimmick-mirror`, `gimmick-settle` = **26 → 38**. Orphan profiles **3 → 1**
(`camera-clamp`, by design).

---

## 5. BGM state machine

### 5.1 What already exists, and why it is already a controlled transition [OBSERVED]

The soundscape is **not** a track player. `startAmbience()` (`:907`) and `startBattleMusic()`
(`:920`) each start a fixed set of persistent oscillators **once** — 2 ambience layers
(`AMBIENCE_LAYERS`, `:321-324`) and 3 music layers (`MUSIC_LAYERS`, `:326-330`). A state change
then **retunes those same oscillators**:

- `setSoundscape(state, stageId)` (`:952-993`) returns `false` early when both state and stage
  are unchanged — a same-state re-request creates **zero** nodes.
- `applySoundscape()` (`:933-950`) walks the live voices and ramps each one:
  `setValueAtTime` on the current value, then `exponentialRampToValueAtTime` to the target
  frequency and `linearRampToValueAtTime` to the target gain, over
  `SOUNDSCAPE_RAMP_SECONDS = 0.35` (`:333`).
- `persistentLayerTarget()` (`:422-434`) composes the target as
  `stage[kind][index].waveform`, `max(20, stageFrequency × state.pitch)`, and
  `baseLayer.gain × state.gainScale`.

Therefore **"state change with controlled transition, never a restart" is already structurally
guaranteed**: no oscillator is stopped or created on a transition, so the player-feel §4-A budget
of "≤ 2 concurrent music programs, previous program silenced within 1.5 s" is satisfied by
construction with 0 programs created and a 0.35 s ramp. Extending the machine is **adding rows**,
not rewriting the mechanism.

Current transition triggers (`audioSoundscapeForEvent()`, `:378-420`) [OBSERVED]:
`STAGE_STARTED`/`RETRY_STARTED`/`RUN_RETRIED` → `descent`; `TERMINAL` → `victory`|`defeat` by
outcome; `BOSS_SPAWNED`/`BOSS_RALLY_WINDOW` → `boss`; `OBJECTIVE_PHASE_CHANGED` → `boss` if
`objectiveId === "boss-kill"` else `active-wave`; pressure events → `objective-pressure` **unless**
already in `boss`/`victory`/`defeat`; `ENEMY_SPAWNED`/`WAVE_VARIANT_STARTED` → `active-wave` only
from `descent`/`active-wave`; `WAVE_CLEARED`/`OBJECTIVE_COMPLETED` → `active-wave` only from
`objective-pressure`. Every case returns a frozen `{stageId, state}` or `null` for "no change".

### 5.2 Per-stage tonal identity [OBSERVED]

`STAGE_SOUNDSCAPES` (`:334-368`) already differentiates all three stages by waveform family and
tonal centre. Documented here because §5.3's pitch scalars multiply these:

| Stage | Ambience | Music | Waveform character | Tonal centre |
|---|---|---|---|---|
| `cinder-span` | sawtooth 29, triangle 43.5 | sawtooth 55, square 82.41, triangle 123.47 | **harsh** — sawtooth + square | A1–B2 (A=55) |
| `abyss-chancel` | sine 36.71, sine 55 | sine 73.42, triangle 110, sine 164.81 | **pure** — sine-dominant | D2–E3 (D=73.42) |
| `echo-throne` | sine 24.5, sawtooth 36.71 | sine 49, sawtooth 73.42, triangle 98 | **hollow** — sine + sawtooth, lowest register | G1–G2 (G=49) |

Identity is preserved across every state because `state.pitch` is a **scalar** on the stage's own
frequencies — a stage never borrows another stage's interval structure.

### 5.3 Three new states → nine [TARGET]

The eight ruled pacing blocks map onto the state machine with three additions. `midboss`,
`occupation`, and `extraction` currently collapse into `active-wave` or `objective-pressure`,
which is why the middle of a dungeon reads flat.

**Correction accepted from `EncounterPacing`:** the assignment brief listed
"victory/defeat" as a pacing block. It is not. Blocks are spatial/temporal encounter units;
`resolution` is the terminal *block*, and the victory/defeat **outcome** is owned by the existing
`TERMINAL` event (`outcome ∈ DEFEAT | VICTORY | FINAL_COMPLETION`). `resolution` therefore
drives **no** soundscape transition — `TERMINAL`'s existing case already does
(`defense-audio.js:390-395`). Keying an outcome off a block id would give two authorities for one
moment.

| Trigger | Soundscape state | New? | `ambienceGain` | `musicGain` | `pitch` |
|---|---|---|---|---|---|
| `ingress` | `descent` | no | 0.72 | 0.42 | 0.82 |
| `objective-1` | `active-wave` | no | 1.00 | 1.00 | 1.00 |
| `objective-2` | `active-wave` | no | 1.00 | 1.00 | 1.00 |
| (pressure overlay, any block) | `objective-pressure` | no | 1.12 | 1.18 | 1.12 |
| `midboss` | **`midboss`** | **yes** | **0.94** | **1.26** | **0.84** |
| `occupation` | **`occupation`** | **yes** | **1.06** | **1.10** | **1.06** |
| `boss` | `boss` | no | 0.86 | 1.36 | 0.68 |
| `extraction` | **`extraction`** | **yes** | **0.80** | **1.14** | **1.22** |
| `resolution` | *(no transition — `TERMINAL` owns it)* | no | — | — | — |
| `TERMINAL` `outcome: VICTORY` / `FINAL_COMPLETION` | `victory` | no | 0.50 | 0.72 | 1.50 |
| `TERMINAL` `outcome: DEFEAT` | `defeat` | no | 0.38 | 0.50 | 0.55 |

Reading of the three new rows:

- **`midboss`** sits between `active-wave` and `boss`: music louder (1.26), pitch dropping (0.84)
  — the floor is tilting but has not fallen. Strictly interior to both neighbours on every axis.
- **`occupation`** is the only state where ambience exceeds music-relative gain modestly
  (1.06/1.10) with pitch slightly **up** (1.06): held ground, alert but not escalating. Sits below
  `objective-pressure` on all three axes so a pressure pulse during occupation still reads as an
  escalation.
- **`extraction`** inverts the boss shape: ambience **down** (0.80), pitch **up** (1.22) — the
  world thins out and lifts as you leave. It is the only non-`victory` state with pitch > 1.12.

Every new state's `pitch` is ≥ 4 % from its nearest neighbour, so the frequency ramp is audible
across the 0.35 s transition.

**`ingress` becomes a real, audible block — [TARGET], not shipped.** `EncounterPacing` authors it
at **1200 / 1320 / 1440 ticks** (20 / 22 / 24 s) per stage with **zero enemies and zero routed
admission** — the longest uninterrupted quiet window in any stage.

Two evidence corrections, both accepted from `EncounterPacing`:

- **It is [TARGET], not [OBSERVED].** `ingressTicks` is a **new** doctrine field that does not
  exist at `033877ad` — I verified this myself: `grep` for `ingressTicks` and `ingress` across
  `defense-catalog.js` and `defense-run-simulation.js` in the dungeon worktree returns **zero
  matches**. Until `EncounterPacing`'s two `buildDoctrineWavePlan` edits land, wave slot 0 still
  fires at tick 0 and the ingress window is **0 ticks**. An earlier revision of this paragraph
  mislabelled it `[OBSERVED from EncounterPacing]`; a peer's authored target is their design
  intent, not a measurement of our tree.
- **The emptiness is structural, not incidental.** Wave slot 0 fires at `ingressTicks`, and
  `processEncounterSpawns` has nothing in `spawnQueue` before that — so there is no admission to
  suppress and no enemy that can arrive early. The window cannot be eroded by tuning a cap or an
  interval; only re-authoring `ingressTicks` removes it. Footsteps at priority 5 are therefore
  safe there **by construction**, not by margin.

Two consequences for this spec:

1. The `descent` state (ambience 0.72 / music 0.42 / pitch 0.82) is the first soundscape state
   that a player can actually *hear as a state* rather than as a half-second before combat.
2. **It is where footsteps are the primary voice.** For 20–24 s per stage the voice pool is
   effectively empty, so priority 5 costs nothing and the per-surface timbre of §2.2 is the
   dominant audio the player has. This materially softens Open risk R-13.

**`FINAL_COMPLETION` trap [OBSERVED].** `echo-throne` returns `outcome: "FINAL_COMPLETION"`, not
`"VICTORY"`. A victory transition or sting keyed only on `"VICTORY"` is **silent on the campaign's
last stage**. This spec's §5.3 table routes both to `victory`, and the existing registry already
handles the cue side — `CUE_VARIANTS` carries all three of `terminal:TERMINAL:DEFEAT`,
`terminal:TERMINAL:VICTORY`, and `terminal:TERMINAL:FINAL_COMPLETION` (`defense-audio.js:183-219`),
and `audioSoundscapeForEvent` already maps `TERMINAL` to `defeat` only when
`event.outcome === "DEFEAT"` and to `victory` otherwise (`:390-395`), so `FINAL_COMPLETION`
resolves correctly today. Recorded because any *new* outcome-keyed branch must use the same
"defeat, else victory" shape rather than an equality test on `"VICTORY"`.

### 5.4 Transition rules [TARGET]

**Why the block boundary is the only safe place to change state [OBSERVED from `EncounterPacing`].**
BGM transitions are driven off `PACING_BLOCK_STARTED.blockId`, **never** off wave index. Wave
index churns 10–11× per stage; `blockId` changes exactly 8×, and it is the pacing truth.
More importantly, `PACING_BLOCK_CLEARED.recoveryTicks` is an authored recovery window during
which **the next block cannot start** — that window is the only point where combat density is
guaranteed to drop. A 0.35 s (`SOUNDSCAPE_RAMP_SECONDS`) frequency-and-gain ramp landing inside a
dense volley would be masked by transient cues and the player would never hear the state change.
Landing it inside `recoveryTicks` is what makes the transition perceptible, so the ramp budget
carries a hard requirement: **`recoveryTicks ≥ 21`** (0.35 s at 60 Hz) for every block boundary
that changes soundscape state. Recorded as Open risk R-15.

Added cases in `audioSoundscapeForEvent()`, following the existing guard style exactly:

```
case "PACING_BLOCK_STARTED":
  // resolution is owned by TERMINAL; never pre-empt an outcome state
  if (currentState === "victory" || currentState === "defeat") return null;
  switch (event.blockId) {
    case "ingress":                       return { stageId, state: "descent" };
    case "objective-1": case "objective-2":
      // do not downgrade an active pressure overlay
      return currentState === "objective-pressure" ? null : { stageId, state: "active-wave" };
    case "midboss":                       return { stageId, state: "midboss" };
    case "occupation":                    return { stageId, state: "occupation" };
    case "boss":                          return { stageId, state: "boss" };
    case "extraction":                    return { stageId, state: "extraction" };
    case "resolution":                    return null;   // TERMINAL owns it
    default:                              return null;
  }

case "PACING_BLOCK_CLEARED":
  // a cleared block returns to the neutral bed unless a heavier state owns the mix
  if (currentState === "boss" || currentState === "victory" || currentState === "defeat") return null;
  return { stageId, state: "active-wave" };
```

Two existing guards must widen to cover the new states [TARGET]:

| Existing case | Current guard | Required guard | Why |
|---|---|---|---|
| pressure events (`:409-411`) | blocks when `boss`/`victory`/`defeat` | **also block when `extraction`** | An extraction pressure pulse must not drop pitch from 1.22 to 1.12 mid-exfil; `midboss`/`occupation` *should* still escalate. |
| `ENEMY_SPAWNED`/`WAVE_VARIANT_STARTED` (`:413-415`) | allows only from `descent`/`active-wave` | unchanged | Correct already: a spawn during `midboss`/`occupation`/`extraction` must not demote to `active-wave`. |

Invariants that hold without new code, because `setSoundscape()` already enforces them
[OBSERVED at `:952-960`]: an unknown state falls back to `descent`; an unknown stage keeps the
current stage; a same-state request returns `false` and touches no node; `TERMINAL` and
`RETRY_STARTED` keep their existing precedence because their cases are evaluated in the same
switch.

### 5.5 Relationship to the 9-profile contract [INFERENCE]

Player-feel §4-A requires 3 stages × 3 music states = 9 identifiable programs. That contract is
satisfied by `descent` / `active-wave` / `boss` per stage — the three anchor states, which keep
their observed values. The six remaining states are **graded interpolations between those
anchors** on the same three scalars, so the 9-profile signature set is unchanged and a
signature test over the anchors still passes. Total addressable combinations become 3 × 9 = 27.

---

## 6. Browser correctness

Every mechanism below **already exists**; this section names what is reused and what each new cue
must not break.

### 6.1 Unlock from a user gesture [OBSERVED]

`attachLifecycle()` (`:747-770`) binds `pointerdown` and `keydown` on `document` to
`onUserGesture` → `unlock()` (`:772-782`), plus `visibilitychange`, and window `blur`/`focus`.
`unlock()` returns early unless started and not muted/paused/backgrounded, and calls
`context.resume()` **only** when `context.state === "suspended"` — so it is not a per-frame
resume. `start()` (`:857-905`) is invoked once from `BattleSession.start()` (`app.js:2147`) and
calls `attachLifecycle()` then `unlock()`. A failed unlock leaves the listeners attached, so the
next gesture retries. **New cues require no change**: `play()` re-checks
`context.state === "suspended"` and resumes on the success path (`:1080`).

### 6.2 Mute and volume [OBSERVED]

`setMuted()` (`:727-737`) sets master gain to 0 via `applyMasterGain()` (`:721-725`) and calls
`stopTransientVoices()` + `stopNarration()`. `setVolume()` (`:739-745`) clamps to `[0,1]` and
**keeps the previous value on a non-finite input**. `play()` returns `false` when `muted`
**before allocating any node** (`:1020-1028`), which is what makes
`audio-feedback-runtime.test.mjs:600` (`"muted feedback must allocate no Web Audio nodes"`)
pass. UI: deck controls in `renderOpsDeck()` and pause-overlay controls at `app.js:3653` (`setMuted`) — deck-side line numbers omitted deliberately, re-grep `this.audio.setMuted` / `setVolume`.
**Constraint on new cues:** the footstep path and `signalBuffExpiring()` must route through
`play()` and never construct nodes directly, or the zero-allocation mute guarantee breaks.

### 6.3 Node release after completion [OBSERVED]

Each transient oscillator registers a one-shot `ended` listener that calls `release()` on its own
oscillator and gain, filters them out of the voice, decrements `voice.remaining`, and removes the
voice from `activeVoices` at zero (`play()`, `:1064-1078`). `release()` (`:843-849`) deletes from
all three tracking sets and disconnects. `stop()` (`:1260-1289`) stops every stoppable node,
disconnects every node, closes the context once, and resets all state — asserted idempotent at
`audio-feedback-runtime.test.mjs:634`. `resetRun()` (`:825-833`) clears run-local state while
**preserving** the persistent graph (asserted at `:718`, `:728-733`).
**Constraint:** the `relic` drop variant is the largest new profile at 4 layers / 8 nodes; it must
be reached through `play()` so its `ended` listeners are wired.

### 6.4 Simultaneous-voice cap [OBSERVED]

`MAX_ACTIVE_VOICES = 12`, `MAX_TRANSIENT_NODES = 48`, `MAX_AUDIO_NODES = 64`.
`makeRoomForVoice(requiredNodes, priority)` (`:995-1009`) refuses outright when
`requiredNodes > MAX_TRANSIENT_NODES`, then evicts the lowest-priority-oldest voice while any cap
is exceeded, and **returns `false` when the weakest candidate's priority ≥ the incoming
priority**. Worst-case node budget for a single tick under this spec [TARGET]:

| Scenario | Voices | Nodes | Within cap? |
|---|---|---|---|
| Footstep alone | 1 | 2 | yes |
| Midboss arrival (`shadow-arrival` + `warning-pulse`) | 2 | 4 | yes |
| `relic` drop + `BUFF_APPLIED` + `ITEM_COLLECTED` | 3 | 8+4+4 = 16 | yes |
| Deformation (`terrain-deform`) + 10 BASIC spawns (silent) + 3 impacts | 4 | 6+0+6 = 12 | yes |
| 12-voice saturation + incoming footstep | 12 | ≤ 48 | footstep **dropped**, never evicts (§2.3) |

### 6.5 Subtitle / visual equivalent for meaningful cues

Existing surface [OBSERVED]: `<output id="battle-event-feedback" role="status" aria-live="polite"
aria-atomic="true">` (`app.js:1766`), written by `renderEventFeedback()` (`:2837-2860`), gated by
`SNAPSHOT_FEEDBACK_TYPES` (`app.js:82`) which currently contains **only** `CRITICAL_HIT` and
`LORE_SURPRISE_RESOLVED`, auto-cleared after 1800 ms. Non-blocking milestone notices use
`showToast()` (`:3673`).

Required additions [TARGET] — every cue that is silent-by-design or gain-limited must have a
non-audio channel, and `UiOverhaulConcept` owns the surface (they confirmed the HUD reads snapshot
state and emits no audio events):

| Moment | Audio | Required visual equivalent |
|---|---|---|
| `DROP_DENIED` | **silent** | Drop-counter state on the HUD; no announcement (it is a system cap, not a player event) |
| `ENEMY_SPAWNED` grade `BASIC` | **silent** | `VfxCueDesign` spawn cue only |
| `ENEMY_SPAWNED` grade `SHADOW` | `shadow-arrival` | `aria-live` announcement — add `ENEMY_SPAWNED` to `SNAPSHOT_FEEDBACK_TYPES` with a grade filter |
| `GIMMICK_ARMED` (`deformation`) | `gimmick-arm` | `aria-live` announcement + `data-gimmick-state` on `#defense-battle-surface` (`UiOverhaulConcept` confirmed this attribute) |
| `GIMMICK_TRIGGERED` (`deformation`) | `terrain-deform` | same attribute transition |
| `BUFF_APPLIED` / `REFRESHED` / `EXPIRED` | 3 cues | Buff strip (`UiOverhaulConcept` owns; reads the same three events) |
| Pre-expiry warning | `buff-warning` | Buff-strip countdown reaching 3 s — same `expiresAtTick - tick === 180` derivation, so audio and HUD cannot disagree |
| Footsteps | `movement-step` | None required — traversal is already fully visible; **and** footsteps are suppressed under `reducedMotion` (§2.6) |

### 6.6 Pause, tab-background return, mobile [OBSERVED]

- **Pause**: `pause()` (`:806-813`) sets the flag, stops transient voices and narration, and
  suspends the context once — asserted `suspendCount === 1` and non-repeating at
  `audio-feedback-runtime.test.mjs:616,624`. `resume()` (`:815-823`) clears the flag, unlocks, and
  restarts ambience/music **only** when not `reducedMotion` and not `backgrounded`; the
  `.length` guards in `startAmbience`/`startBattleMusic` (`:908`, `:921`) prevent duplicate beds.
  Driven from `app.js:3467`/`:3469`.
- **Background**: `suspendForBackground()` (`:784-794`) and `resumeFromBackground()` (`:796-804`);
  `resumeFromBackground` re-checks `hidden` and refuses to resume a still-hidden document.
  `onWindowFocus` (`:713-717`) likewise. Because transient voices are stopped on the way out and
  `consume()` dedupes by event key, **no queued cue fires on return** — the paused-time
  catch-up prohibition (player-feel §4-C) holds for the new cues automatically.
- **Mobile**: the same `pointerdown` unlock path serves touch. Reduced motion is read once at
  construction via `prefersReducedMotion()` (`:436-442`) inside a `try`, so a missing
  `matchMedia` degrades to `false`. Per §2.6 footsteps additionally respect it.
- **No-Web-Audio environments**: `start()` returns `false` when neither `AudioContext` nor
  `webkitAudioContext` exists (`:863`), and every method guards on `this.context` — locked by
  `defense-observers-contract.test.mjs` *"audio degrades to a silent observer when Web Audio is
  unavailable"*. New cues add no new global reads.

## 7. Implementation ownership and registration path

File ownership is exclusive (Director ruling, file-ownership rule). This section exists so
`AudioImpl` does not stall waiting on a permission it does not need, and does not reach for a
file it does not own.

### 7.1 `AudioImpl` needs exactly one file

**`defense-audio.js` — owned by `AudioImpl`. Every change in §§2–5 lands there and nowhere else.**

The 12 new cue ids need a `byId` entry to be resolvable by `lookup()` (`defense-audio.js:1011`,
which reads `byId[cueId]` and returns `null` on a miss). `byId` is built from **two** sources
(`:37-39`): `AUDIO_CUES` (from `defense-catalog.js` — **not owned by `AudioImpl`**) and
`SYNTHETIC_CUES` (declared **inside `defense-audio.js`** at `:23-35`, factory `syntheticCue` at
`:20-21`).

**Therefore: register all 12 new cue ids in `SYNTHETIC_CUES`. No `defense-catalog.js` edit is
required, and no DM-and-wait on `DropBuffImpl` is required.** The 11 existing entries there are
the precedent (`inputAccepted`, `attackWindup`, `blockContact`, …). Convention: the synthetic
entry's `waveform`/`frequency`/`duration` mirror **layer 1** of the cue's `CUE_PROFILES` entry,
so `fallbackProfile()` degrades sanely if a profile row is ever missing.

| New cue id | `SYNTHETIC_CUES` entry |
|---|---|
| `dodge-slip` | `dodgeSlip: syntheticCue("dodge-slip", "sine", 240, 0.045)` |
| `drop-appear` | `dropAppear: syntheticCue("drop-appear", "sine", 520, 0.14)` |
| `drop-expire` | `dropExpire: syntheticCue("drop-expire", "sine", 300, 0.16)` |
| `buff-apply` | `buffApply: syntheticCue("buff-apply", "triangle", 300, 0.20)` |
| `buff-refresh` | `buffRefresh: syntheticCue("buff-refresh", "triangle", 330, 0.11)` |
| `buff-expire` | `buffExpire: syntheticCue("buff-expire", "sine", 420, 0.17)` |
| `buff-warning` | `buffWarning: syntheticCue("buff-warning", "sine", 360, 0.09)` |
| `shadow-arrival` | `shadowArrival: syntheticCue("shadow-arrival", "sawtooth", 62, 0.34)` |
| `gimmick-arm` | `gimmickArm: syntheticCue("gimmick-arm", "sawtooth", 128, 0.26)` |
| `terrain-deform` | `terrainDeform: syntheticCue("terrain-deform", "sawtooth", 84, 0.42)` |
| `gimmick-mirror` | `gimmickMirror: syntheticCue("gimmick-mirror", "sine", 740, 0.22)` |
| `gimmick-settle` | `gimmickSettle: syntheticCue("gimmick-settle", "triangle", 168, 0.14)` |

`movement-step` and `weapon-fire` need **no** registration — they are already in `AUDIO_CUES`
(`defense-catalog.js:208-209`). The un-shadowing is purely a `defense-audio.js` change (§2.3, §3.2).

### 7.2 What `AudioImpl` cannot do alone

Three items in this spec touch files `AudioImpl` does not own. They are **not** blockers for the
audio work — each degrades safely if it never lands — but they must be requested, not taken.

| Item | File | Owner | Degradation if absent |
|---|---|---|---|
| `setSurfaceResolver` injection at mount (§2.2) | `app.js`, beside `this.audio.start()` — **symbol anchor only.** It measured `:2193` (tag `#C34A`) but `UiJoystickImpl` has since landed five edits and the file is 4147 lines, so every line number here is stale by construction | `UiJoystickImpl` | Resolver stays the default `() => null`; every footstep uses the base `movement-step` timbre. Footsteps still work. |
| `signalBuffExpiring(buffId)` call + warned-id `Set` (§4.4) | `app.js` — existing comparison at `:3321` inside `renderBuffStrip()` `:3296`; `Set` cleared in `beginRun()` `:2155` **and on stage remount** | `UiJoystickImpl` | No pre-expiry sting. The HUD hatch still warns (it is already landed), and every other buff cue still fires. |
| `SNAPSHOT_FEEDBACK_TYPES` additions for the §6.5 visual equivalents | `app.js:82` | `UiJoystickImpl` | Silent-by-design cues (`BASIC` spawn, `DROP_DENIED`) lose their announcement. Audio unaffected. |

**Both blockers `UiJoystickImpl` raised are valid and are answered here, not waved off.** Neither
method exists at 033877ad — `grep` returns zero for `setSurfaceResolver`, `signalBuffExpiring`,
and `slabMaterialAt` — so the naive call site is a `TypeError` **and** a `ReferenceError` on the
same line, in the run-start path, before first paint. The required form is guarded on **both**
halves:

**A named import is UNLANDABLE — use a namespace import.** `UiJoystickImpl` escalated an earlier
form of this section that used `import { slabMaterialAt } from "./stage-world-catalog.js"` plus a
`typeof` guard. They are right and the correction is load-bearing: **a named import of a
non-existent export is a link-time `SyntaxError`**, so the module graph never instantiates and the
runtime guard can never execute. I reproduced it rather than taking it on trust [OBSERVED]:

| Form | Exit | stdout | Error |
|---|---|---|---|
| `import { missingExport } from "./mod.mjs"` + `typeof` guard | **1** | *(nothing — body never runs)* | `SyntaxError: The requested module './mod.mjs' does not provide an export named 'missingExport'` |
| `import * as ns from "./mod.mjs"` then `ns.missingExport` | **0** | `BODY REACHED false value: undefined` | none |

**And the module was wrong too (ruling v9 R38).** `slabMaterialAt` is **not** in
`stage-world-catalog.js` — that module exports exactly three bindings (`STAGE_WORLD_PROFILES`,
`STAGE_SHOWCASE_IDS`, `stageWorldFor`) and `grep -c slabMaterialAt` returns **0** there. It lives
in **`defense-catalog.js`**, where `DropBuffImpl` landed it beside `STAGE_TACTICS`: `grep -c`
returns **1**, and the slab API is now shipped —
`export const STAGE_SLABS` (`:288`), `export function slabAt(stageId, x, y)` (`:320`),
`export function slabMaterialAt(stageId, x, y)` (`:332`), returning `{ slabId, materialId }` or
`null`. **That is the exact 3-arg signature and object return §2.2 specified**, so no adaptation
is needed. The Director declined to add a re-export: two import paths to one symbol is the
translation layer R19 forbids.

So the earlier form did not merely fail to help — it **upgraded** the failure from a run-start
`ReferenceError` (app already up) to a total white-screen: `app.js` never evaluates,
`#defense-battle-surface[data-defense-ready]` never mounts, and every browser suite in the repo
reds on its first `waitFor`. The `typeof` guard defends against a missing **value**; the actual
hazard is a missing **binding**, resolved before any code runs.

**The form to land** — namespace import, property read, guarded call. This is the pattern
`UiJoystickImpl` already used for `BUFF_ITEMS` so the buff strip could land before
`DropBuffImpl`'s catalog existed: same trap, same fix.

```js
// app.js — beside this.audio.start(). Anchor on the SYMBOL, not a line number.
import { slabMaterialAt } from "./defense-catalog.js";      // ruling v9 R38 — canonical, no re-export

this.audio.setSurfaceResolver?.(
  typeof slabMaterialAt === "function"
    ? (stageId, x, y) => slabMaterialAt(stageId, x, y)?.materialId ?? null
    : () => null,
);
```

**A named import is now correct because the export exists.** The link-time hazard above was real
while the symbol was absent; it is not a reason to prefer a namespace import once the binding is
real, and the Director's canonical form is the named one. Both guards remain load-bearing and
neither is redundant: `?.` covers a `DefenseAudio` build without the method, and
`typeof slabMaterialAt === "function"` keeps the line safe if load order ever changes — the shape
already agreed with `UiJoystickImpl`.

**The lesson survives its own resolution.** The general rule stands for any seam added *before*
its symbol lands: a named import of a non-existent export is a link-time `SyntaxError` and no
runtime guard can catch it, so either land the export first (what happened here) or use a
namespace import until it does.

**Generalised lesson, recorded because it cost a near-miss:** a spec can be internally consistent
and still be unlandable, because module linking happens before any logic the spec reasons about.
Any future cross-lane seam in this spec must be reachable through a namespace import or not
introduced at all. `AudioImpl` implements `setSurfaceResolver` and
`signalBuffExpiring` in `defense-audio.js` regardless, so each `app.js` side stays one guarded
line whenever its owner and the Director schedule it.

`AudioImpl` should implement `setSurfaceResolver` and the `"buff-warning"` cue **in
`defense-audio.js` regardless**, so the `app.js` side is a one-line call whenever its owner
schedules it.

### 7.3 Test-file ownership

The matrix below targets three test files. Only the one named in `AudioImpl`'s assignment may be
edited by `AudioImpl`:

| File | Checks | Note |
|---|---|---|
| `tests/audio-feedback-runtime.test.mjs` | V-2…V-6, V-8, V-10…V-25, V-27 | The audio lane's own file. |
| `tests/defense-observers-contract.test.mjs` | V-7, V-9 | **Must stay green unmodified.** V-7 is a regression guard on the `camera-clamp` refactor; if it needs an edit, the refactor is wrong. |
| `tests/battle-session-cutscene-audio.test.mjs` | V-26 | Depends on `snapshot.buffs` (R-9) and the `app.js` hook (§7.2). Defer to the Verification phase. |

---

## Verification matrix

Numbered checks. "Where" names the file an assertion belongs in, or the browser probe.

**Execution ownership.** This lane is in the **design phase** and ran no suite after the
Director's hard stop. Every row below names a command or file for the **Verification phase, which
the Director owns** — a single uncontended baseline run. No row is a claim that it has passed.
Rows V-28/V-29 additionally require the browser proof, which this lane did not run and must not.

| # | Assertion | Where measured |
|---|---|---|
| V-1 | **[Director-owned baseline]** `cd /Users/jangyoung/orca/Abyssal-Surge-dungeon && node --test --test-concurrency=2 tests/audio-feedback-runtime.test.mjs tests/battle-session-cutscene-audio.test.mjs tests/defense-observers-contract.test.mjs` reports `fail 0` on an **uncontended** machine before any edit, and `fail 0` with `tests ≥ 36` after. **The `cd` prefix is mandatory (ruling v8 R35): the default bash cwd is the forbidden tree, so an unprefixed run tests the concurrent session's cycle-9 code.** The 36/36 in §1.6 was unprefixed and is VOID, not a baseline | command output, Verification phase only |
| V-2 | `audioCueForEvent({type:"MOVE", tick:24, direction:"E", to:{x:1000,y:1000}})` → `{method:"play", cueId:"movement-step", priority:5, category:"movement", intentionalSilence:false}` | `tests/audio-feedback-runtime.test.mjs` |
| V-3 | `audioCueForEvent({type:"MOVE", tick:20, direction:"E"})` deep-equals the **unchanged** silent shape `{eventType:"MOVE", method:"silent", cueId:null, priority:0, category:"movement", intentionalSilence:true}` — T1 preserved byte-for-byte | same file, existing test at `:526-533` |
| V-4 | `audioCueForEvent({type:"MOVE", tick:24, entityId:"enemy-3", policyId:"rush"})` (no `direction`) → silent. Enemy movement never sounds | `tests/audio-feedback-runtime.test.mjs` |
| V-5 | Cadence: feeding `MOVE` events for ticks 0…119 with a held direction yields exactly **10** footstep resolutions (`120 / 12`), and 0 for a tick range containing no multiple of 12 | `tests/audio-feedback-runtime.test.mjs` |
| V-6 | Footstep never evicts: fill to `maxVoices` with `stage-start` (72), then `play("movement-step", MOVE@tick24)` → `false`, and `debugMetrics().voices === 12` with oscillator `stopCount` unchanged | `tests/audio-feedback-runtime.test.mjs` (extends T4) |
| V-7 | `play("camera-clamp")` still resolves priority 5 through `PRESENTATION_CUE_PRIORITY`, first call `true`, immediate second `false`, and `consume([{type:"CAMERA_CLAMP"}])` plays nothing | `tests/defense-observers-contract.test.mjs:439-466` (must stay green unmodified) |
| V-8 | All 9 slab materials resolve distinct `movement-step` profiles: `lookup("movement-step", ...)` under each material returns 9 pairwise-unequal profiles, and a `null` material returns the base profile | `tests/audio-feedback-runtime.test.mjs` |
| V-9 | Surface resolver is read-only: `getRunDigest(run)` is byte-identical with the resolver injected and absent, over ≥ 600 ticks on a fixed seed | `tests/defense-observers-contract.test.mjs` (pattern: *"rendering, telemetry, and audio observation leave the simulation digest unchanged"*) |
| V-10 | Dodge distinctness: `audioCueForEvent({type:"PROJECTILE_IMPACT", hit:false, ...})` → `dodge-slip` 50; with `hit:true` → `impact-hit` 45; with `guardedBy:"escort-1"` → `block-contact`; `hit:false` wins over `guardedBy` | `tests/audio-feedback-runtime.test.mjs` |
| V-11 | Windup vs release: `AUDIO_EVENT_POLICY.BASIC_ATTACK.cueId === "attack-windup"` and `AUDIO_EVENT_POLICY.WEAPON_FIRED.cueId === "weapon-fire"`, and `lookup()` returns unequal profiles for the two | `tests/audio-feedback-runtime.test.mjs` |
| V-12 | Zero orphans except `camera-clamp`: every key of `CUE_PROFILES` is either reachable from a non-silent policy, or is exactly `"camera-clamp"` / `"buff-warning"` (the two documented presentation cues) | `tests/audio-feedback-runtime.test.mjs` — a registry-completeness test |
| V-13 | Four rarity tiers resolve 4 pairwise-unequal `drop-appear` profiles with layer counts 1/2/3/4 | `tests/audio-feedback-runtime.test.mjs` |
| V-14 | Seven `stat` values resolve 7 pairwise-unequal `buff-apply` profiles, and every adjacent pair of base frequencies differs by ≥ 12 % | `tests/audio-feedback-runtime.test.mjs` |
| V-15 | `BUFF_EXPIRED` reason gate: `reason:"TIMEOUT"` → `buff-expire` 40; each of `EVICTED`, `STAGE_TRANSITION`, `DEATH` → `method:"silent"` | `tests/audio-feedback-runtime.test.mjs` |
| V-16 | `ENEMY_SPAWNED` grade gate: `grade:"BASIC"` → silent; `grade:"SHADOW"` → `shadow-arrival` 68; the resolver reads only `grade` (a payload with `elite:true, midboss:true` but `grade:"BASIC"` still resolves silent) | `tests/audio-feedback-runtime.test.mjs` |
| V-17 | `GIMMICK_TRIGGERED` class branch: `deformation`→`terrain-deform` 76, `hazard`→`warning-pulse` 78, `gate`→`occupation-captured` 64, `mirror`→`gimmick-mirror` 66; unknown class → `terrain-deform` fallback, never `throw` | `tests/audio-feedback-runtime.test.mjs` |
| V-18 | `SOUNDSCAPE_STATES` has exactly **9** keys, and `midboss`/`occupation`/`extraction` each differ from every other state in ≥ 2 of the 3 scalars | `tests/audio-feedback-runtime.test.mjs` |
| V-19 | No restart: driving all 8 `blockId` values through `setSoundscape()` in order creates **0** new nodes — `debugMetrics().nodes` is constant and persistent oscillator `stopCount`/`disconnectCount` stay 0 | `tests/audio-feedback-runtime.test.mjs` |
| V-20 | Same-state idempotence: 100 consecutive `PACING_BLOCK_STARTED` events with the same `blockId` produce 1 transition and 0 new nodes | `tests/audio-feedback-runtime.test.mjs` |
| V-21 | Guard widening: a pressure event while in `extraction` returns `null` (no downgrade); while in `midboss` or `occupation` it returns `objective-pressure` | `tests/audio-feedback-runtime.test.mjs` |
| V-22 | Anchor profiles preserved: for each of the 3 stages, `descent`/`active-wave`/`boss` produce the same 9 layer targets as the pre-change build | `tests/audio-feedback-runtime.test.mjs` |
| V-23 | Mute is still allocation-free with the largest new cue: `setMuted(true)` then `play("drop-appear", {rarity:"relic"})` → `false` and `context.created.length` unchanged | `tests/audio-feedback-runtime.test.mjs` |
| V-24 | Pause/background release: a footstep in flight is released by `pause()` and by `suspendForBackground()`; `voices === 0`, `transientNodes === 0`, `suspendCount === 1` | `tests/audio-feedback-runtime.test.mjs` |
| V-25 | `reducedMotion: true` suppresses footsteps and leaves discrete combat cues audible (`play("critical-hit", CRITICAL_HIT)` → `true`) | `tests/audio-feedback-runtime.test.mjs` |
| V-26 | Pre-expiry warning fires once per `buffId`: driving `snapshot.buffs[]` past `expiresAtTick - tick === 180` across 30 frames plays `buff-warning` exactly once, and `beginRun()` clears the warned set | `tests/battle-session-cutscene-audio.test.mjs` |
| V-27 | Node ceiling under the worst authored batch: one tick carrying `GIMMICK_TRIGGERED(deformation)` + `DROP_SPAWNED(relic)` + `BUFF_APPLIED` + `ENEMY_SPAWNED(SHADOW)` + `MIDBOSS_SPAWNED` + 3 impacts keeps `nodes ≤ 64`, `transientNodes ≤ 48`, `voices ≤ 12` | `tests/audio-feedback-runtime.test.mjs` |
| V-28 | Browser probe, per stage: run `cinder-span` → `abyss-chancel` → `echo-throne` in real Chromium at 1440×900 and 390×844, capture an audio debug JSON per stage containing `soundscapeState` transitions across all 8 blocks, footstep count vs. moving ticks, peak `voices`/`nodes`, and unlock/pause/background/stop lifecycle counts. Evidence lands in `_workspace/current/qa/` | manual browser session |
| V-29 | Console/network summary from V-28 shows 0 audio errors and 0 network requests attributable to audio | same session |
| V-31 | **Field-collision immunity, executed not asserted.** `audioCueForEvent` and `audioSoundscapeForEvent` both return `null` for `{type:"ENCOUNTER_PATH_CONTESTED", telegraphTicks:60, objectiveId:"occupation", …}` and `{type:"ENCOUNTER_RECOVERY_STARTED", recoveryTicks:180, objectiveId:"occupation"}`; neither type appears in `AUDIO_EVENT_POLICY`; `consume()` of a batch containing both plays zero cues. Extended to `objectiveId`: consuming three `ENCOUNTER_PATH_CONTESTED` events (carrying both `objectiveId` and `telegraphTicks`) plays **0** cues and records **0** `feedbackEvents`, proving `feedbackEventKey`'s entry allow-set fires before its type-agnostic `:984` read. Plus a static check: no cross-family field reader exists — every `event.telegraphTicks` / `event.recoveryTicks` / `event.reason` / `event.objectiveId` read in `defense-audio.js` sits inside a `case` arm, behind an explicit `event.type` comparison, or behind an allow-set checked at function entry | `tests/audio-feedback-runtime.test.mjs` |
| V-30 | Vocabulary conformance: every new policy key is a literal from Director ruling v1/v2/v3; a grep for `TERRAIN_DEFORMED`, `ITEM_DROPPED`, `ITEM_DROP_EXPIRED`, `defId`, `expiresAt` (without `Tick`), `maxIntegrity` (as a `stat` value) returns 0 hits in the audio lane | grep + review |

---

## Open risks

| # | Risk | What it breaks, by name |
|---|---|---|
| **R-1** | The discovery report's own recommendation — `MOVE: feedbackPolicy("movement-step", 28, "movement")` (`map-ui-audio.md:352,468`) — **breaks two live assertions**: `audio-feedback-runtime.test.mjs:526-533` (`audioCueForEvent(MOVE)` must deep-equal the silent shape; it would return `method:"play", priority:28, intentionalSilence:false`) and `:520-525` (the `played` array would gain a 5th entry). An implementer who follows the discovery report instead of §2.3 will red the suite. | `tests/audio-feedback-runtime.test.mjs` — *"consume prioritizes critical events, preserves stable ties, and keeps silent events silent"* |
| **R-2** | Adding any **field** to the `feedbackPolicy`/`silentPolicy` factories (`defense-audio.js:221-224`) breaks the same deep-equal, which enumerates exactly six keys. This spec therefore adds **no** policy field; if a future cycle needs one, that test must be revised in the same commit. | same test, `:526-533` |
| **R-3** | Re-pointing `WEAPON_FIRED`/`MELEE_SWEEP` to `weapon-fire` (C-1) changes an audible mapping that **no test currently pins** — verified: the eleven pinned mappings at `:463-475` do not include them. The risk is therefore silent regression rather than a red test; V-11 exists to pin it going forward. | `tests/audio-feedback-runtime.test.mjs` — *"public event policy maps objective, boss, death, retry, and completion semantics"* |
| **R-4** | The `impact-hit:hit` shared refractory family (`cueRefractoryKey()`, `:648-650`) means `MELEE_IMPACT` and `COMMANDER_DAMAGED` compete for one 45 ms gate. Adding `impact-hit:COMMANDER_DAMAGED` etc. as **variants** does not change that: in a crowded volley the player may hear an enemy contact where their own damage was suppressed. Mitigation would require splitting the family, which changes existing contact behavior. Left as-is deliberately; V-27 measures the batch, not the perceptual outcome. | `tests/audio-feedback-runtime.test.mjs` voice-cap tests at `:537-585` |
| **R-5** | A midboss produces **two** arrival voices (`shadow-arrival` 68 + `warning-pulse` 82) because `spawnEnemy()` emits `ENEMY_SPAWNED` and `MIDBOSS_SPAWNED` in the same tick. Suppressing one requires reading `event.midboss`, which **Director ruling v2 R4 forbids** (presentation reads `grade` only). Cost measured: 4 voices / 8 nodes, once per midboss. If it reads as a double-hit in V-28, the fix belongs in `EncounterPacing` (do not emit both) or in a director ruling, not in audio. | `MIDBOSS_SPAWNED` binding, ruling v2 R4 + R12 |
| **R-6** | **Companion footsteps are not deliverable.** Only enemy and commander emit `MOVE` (`defense-run-simulation.js:2414`, `:2879`); companions emit none. Deriving them from `snapshot.companions[]` position deltas is forbidden by player-feel prompt `:96`. With the legion cap rising 3 → 10 in cycle 9, a 10-companion group will move in total silence. Prerequisite: a simulation-owned companion move emit carrying `direction`. | production brief §0 (cycle 9 owns legion cap); player-feel prompt §3 item 2 |
| **R-7** | **CLOSED.** `DungeonLevelDesign` published `telegraphTicks` = 180 deformation / 120 gate / 90 hazard / 60 mirror, and confirmed ARMED at `T` → TRIGGERED at exactly `T + telegraphTicks`. Every class clears `gimmick-arm`'s 18-tick envelope by ≥ 42 ticks, and two gimmicks never trigger in the same tick, so no deformation-sting mix is possible. No residual risk. | resolved — §4.6 |
| **R-8** | Cues bound to `DROP_SPAWNED`, `DROP_EXPIRED`, `DROP_DENIED`, and all three `GIMMICK_*` types **will sound before their VFX renders**. `VfxCueDesign`'s prerequisite PR-1 (ruling v2 R9) fixes `effectAnchor()` and `worldPointInto()`; until it lands, audio fires and the screen shows nothing. Audio is not blocked by PR-1, but §6.5's visual-equivalent column is. | ruling v2 R9, `battle-realtime-three.js` `effectAnchor()` / `spawnVfx()` |
| **R-9** | `snapshot.buffs` **does not exist yet** — verified absent from `getRunSnapshot()` (`defense-run-simulation.js:3489`). `DropBuffSystem`'s spec is written and specifies it as **conditionally present** (absent, not empty, when no buff is active) plus a sibling `snapshot.buffStats`. Until it lands V-26 cannot run, and any derivation that omits the `?? []` guard (§4.4) will throw on a no-buff run rather than degrade. | `getRunSnapshot()`; `_workspace/current/design/item-drop-timed-buff-spec.md` |
| **R-10** | **CLOSED.** `slabMaterialAt` is landed in `defense-catalog.js` — `STAGE_SLABS` (`:288`), `slabAt(stageId, x, y)` (`:320`), `slabMaterialAt(stageId, x, y)` (`:332`) returning `{ slabId, materialId }` or `null`, which is byte-for-byte the contract §2.2 specified. The 12 slab rects carry `DungeonLevelDesign`'s corrected geometry. V-8's 9-profile check can now run. Superseded text follows for provenance: ~~`slabMaterialAt()` does not exist: a grep for `slab` / `material` in `stage-world-catalog.js` returns **0 hits**. Its authored rects (`profile.gameplay.terrainTiles[].rect`) are a `DungeonLevelDesign` deliverable, and `DropBuffSystem` reports `slabId` is specified as `null` until that list lands. Footsteps therefore ship on the base `movement-step` timbre — a graceful degradation via the §2.2 `null` fallback, not a failure — but V-8's 9-profile check cannot run.~~ | resolved — `defense-catalog.js:288-336` |
| **R-11** | Extending `SNAPSHOT_FEEDBACK_TYPES` (`app.js:82`) for the §6.5 announcements changes what `renderEventFeedback()` writes to `#battle-event-feedback`. That element is a shared single slot with an 1800 ms auto-clear (end of `renderEventFeedback()`, re-grep); adding `ENEMY_SPAWNED` and the gimmick types risks announcement thrash that would drown `CRITICAL_HIT`. Surface is owned by `UiOverhaulConcept`, so the throttle decision is theirs, not this lane's. | `app.js` `renderEventFeedback()`; `UiOverhaulConcept` spec |
| **R-12** | **Provenance, not drift — the four traps of this cycle.** Relative paths in `grep`/`read`/`edit` resolve against the authoring tree, not the dungeon worktree (ruling v4 R20). An earlier draft of §0 asserted the inverse of the truth: it labelled the assignment's and the Director's numbers stale and its own polluted numbers fresh. All citations are now re-measured through absolute dungeon paths (§0), but `app.js` moved 3807 → 3832 **during this session**, so line numbers remain perishable by nature. Anchor on the symbol; the `edit` stale-hash check is the only guard against writing to the wrong tree, and it fails silently when a file is byte-identical across both. | ruling v4 R20/R21; `CLAUDE.md` §5 |
| **R-13** | **Reduced, not closed.** Priority 5 means footsteps vanish whenever 12 voices are live — i.e. through most combat. That is the intended mix (traversal yields to everything), and `EncounterPacing`'s authored `ingress` block now gives footsteps a measured **20–24 s** window per stage with zero enemies and zero admission, plus **≥ 159 ticks** of clear air at each of 8 block boundaries — so the per-surface timbre is genuinely audible somewhere, which was the open question. **Caveat an implementer must not misread:** `ingressTicks` does not exist at `033877ad` (verified,
zero grep matches), so **the quiet window is 0 ticks until `EncounterPacing`'s
`buildDoctrineWavePlan` edits land**. The `descent` state is correct as designed but unreachable
before then — anyone testing audio ahead of the pacing change will hear combat from tick 0 and must
not read the missing quiet as an audio defect. What remains a **design bet** is the *combat* case: if V-28 shows the dungeon feels silent while fighting *and* moving, the fix is not a priority bump (that would let footsteps evict `camera-clamp` and erode the never-evicts guarantee) but a dedicated low-cost voice reservation, which does not exist in the current cap model. | `makeRoomForVoice()` (`defense-audio.js:995-1009`) |
| **R-14** | **No test evidence of any kind exists for this spec, and the one run is VOID.** It is void twice over: (a) **wrong tree** — no `cd` prefix, so it executed in the default cwd `/Users/jangyoung/orca/Abyssal-Surge`, the forbidden tree, against a 1496-line `defense-audio.js` rather than our 1313 (ruling v8 R35); (b) **contended machine** — load average 101.75, four concurrent full-suite runners, 51 workers on 12 cores. An earlier revision of §1.6 salvaged the 36/36 as a correctness signal; that was wrong, because (a) means it never measured our code at all. Every per-assertion value in §1.6 is read from test **source** via absolute dungeon paths and is unaffected. Nothing in the Verification matrix has been observed to pass. | ruling v8 R35; production brief §4 evidence rule; §V-1 |
| **R-15** | **CLOSED.** `EncounterPacing` published the authored windows: minimum `recoveryTicks` across all 12 block boundaries is **180 t (3.00 s)**, against `SOUNDSCAPE_RAMP_SECONDS = 0.35` s = **21 t** — a **8.57×** margin, leaving ≥ 159 ticks of clear air after the ramp completes. The floor is pinned to the smallest authored `retry.recoveryTicks` already shipped (`cinder-relay-crossing`, `defense-catalog.js:482`), so it cannot silently drop below 180 without contradicting catalog data. Drive the transition off the `recoveryTicks` **field**, never off a constant. | resolved — §5.4 |
| **R-20** | **`reason` carries four incompatible vocabularies across six shipped sites, and two of its owners already have audio policies.** `PROJECTILE_EXPIRED` (`:1740`, lowercase `"bounds"`/`"range"`) → `attack-miss` 28 and `EXTRACTION_REJECTED` (`:2195`, `:2204`, dynamic, may be `null`) → `input-rejected` 62 are both **reachable in `play()`**, unlike the `telegraphTicks`/`recoveryTicks` collisions which are unreachable. §4.2 and §4.3 are safe only because their gates are written `event.type === "…" && event.reason === "…"`. A future `reason`-keyed table without a type gate **fails silently** — the value sets do not overlap, so there is no throw and no wrong cue, just a gate that never fires. Silence is the worst failure mode for an audio gate because it is invisible in review and in test. Requirement: no cross-family field reader in the audio module; every read sits inside a `case` arm or behind an explicit `event.type` check. | `AUDIO_EVENT_POLICY` `PROJECTILE_EXPIRED` / `EXTRACTION_REJECTED`; §4.2, §4.3 |
| **R-19** | **Tier contradiction CLOSED; the name collision remains.** `DungeonLevelDesign` has withdrawn their tiers and adopted ruling v6 C2 verbatim — deformation **180**, narrowing gate **120**, progress-ring and mirror **90**, hazard **60** — self-reporting that their published list was wrong for 5 of 13 gimmicks. Audio needed no change under either ordering (below), which is why this was amber not red. Audio is insulated — `gimmick-arm` is a fixed 18-tick envelope marking onset only, and the smallest tier (60 t) clears it by 42 t. `VfxCueDesign` is **not** insulated, which is why ruling v6 C2's `Number.isInteger(event.telegraphTicks) ? event.telegraphTicks : 180` form is mandatory for them: 9 of 13 gimmicks are not 180. **Still open:** `telegraphTicks` is **already a shipped field** (`defense-run-simulation.js:2296`, `ENCOUNTER_PATH_CONTESTED`, meaning `contestTicks`), so any generic read of it must key on `event.type` first. | ruling v6 C2 vs `DungeonLevelDesign`; `ENCOUNTER_PATH_CONTESTED` payload |
| **R-18** | **`defense-audio.js` diverges and ruling v5 R28's merge list omits it.** Measured: ours **1313** lines, the concurrent session's **1496**. Their delta is not cosmetic — it adds **sample/buffer playback**: `loadSamples(mapUrl)`, `sampleFor(cueId, event)`, `refreshPersistentLoops()`, `startBufferedLoop(kind)`, `playSampleVoice(sample)`, and their file contains `decodeAudioData`, `createBufferSource`, and `fetch`. **Two consequences.** (1) §1.1's "100% procedural, zero file playback" is true of our tree and **false of the merged result**; a reviewer must not carry it forward as an invariant. (2) Collision surface, measured per insertion point: all **nine module-level tables this spec edits are at identical line numbers with byte-identical bodies** (`SYNTHETIC_CUES` 23, `CUE_PROFILES` 76, `CUE_VARIANTS` 183, `AUDIO_EVENT_POLICY` 226, `CUE_REFRACTORY_SECONDS` 295, `SOUNDSCAPE_STATES` 369, `audioSoundscapeForEvent` 378, `audioCueForEvent` 598, `variantKey` 641) — every table row this spec adds is additive into untouched regions and merges clean, satisfying R28. The exceptions are the three class methods: `setSoundscape` (+133 offset, body identical), **`applySoundscape` (+106, body CHANGED** — they branch on `voice.buffered` and swap loop buffers**)**, and **`play()` (+170, body CHANGED** — routed through `sampleFor`/`playSampleVoice`**)**. `play()` is the one real conflict, because §2.3's `PRESENTATION_CUE_PRIORITY` refactor rewrites the same `?? (cueId === "camera-clamp" ? 5 : 40)` ternary they still carry verbatim at their `:1199-1200`. **Mitigation, and the reason this is amber not red:** that refactor is the *only* non-additive edit in the entire spec, and it is optional — `PRESENTATION_CUE_PRIORITY` can be introduced as a new module-level table (additive, clean) with the ternary extended to `?? PRESENTATION_CUE_PRIORITY[cueId] ?? (cueId === "camera-clamp" ? 5 : 40)`, a one-token insertion rather than a rewrite. Specify it that way if the merge lands before implementation. | ruling v5 R28; `defense-audio.js` `play()` / `applySoundscape()` |
| **R-17** | **A cross-lane seam can be unlandable even when the spec is self-consistent.** An earlier §7.2 form used a *named* import of `slabMaterialAt`, which does not exist in `stage-world-catalog.js` (exports are `STAGE_WORLD_PROFILES`, `STAGE_SHOWCASE_IDS`, `stageWorldFor` only). A named import of a missing export is a **link-time `SyntaxError`** — reproduced: exit 1, body never runs — so `app.js` would never evaluate, `data-defense-ready` would never mount, and **every** browser suite would red on its first `waitFor`. Escalated by `UiJoystickImpl`; fixed to a namespace import. Residual risk: any future seam added to this spec must be reachable via namespace import, because module linking precedes every guard the spec reasons about. | `app.js` module graph; `stage-world-catalog.js:570-577` |
| **R-16** | **Two audio features are gated on an `app.js` owner, not on audio.** The surface resolver and the pre-expiry warning both need a one-line call in `app.js`, owned by `UiJoystickImpl` (§7.2). Both degrade safely — base timbre, no warning cue — so neither blocks the audio lane, but both will silently never fire if the request is not scheduled. A reviewer checking "per-surface footsteps shipped" must verify the injection landed, not just that `setSurfaceResolver` exists. | `app.js` ownership rule; §2.2, §4.4 |
