# ElevenLabs Audio Pipeline Specification — TTS, SFX, BGM

run-id: `20260726-stage1b-cinder-pressure-agency`  
owner: engineering / audio integration  
scope: Extend `scripts/generate-audio.mjs` to replace procedural oscillator waveforms with ElevenLabs-sourced TTS dialogue, SFX transients, and seamless BGM loops  
labels: **[OBSERVED]** = measured in existing code; **[INFERENCE]** = derived from implementation patterns; **[TARGET]** = proposed contract, not yet implemented

---

## 1. Voice Settings Table — TTS Character Profiles

**[OBSERVED]** Existing voice normalization: `scripts/generate-audio.mjs:85-93` `normalizeVoiceSettings()` accepts `{stability, similarityBoost|similarity_boost, style, useSpeakerBoost|use_speaker_boost, speed}`  
**[OBSERVED]** ElevenLabs TTS API requires voice ID + settings object per request  
**[OBSERVED]** Named characters: Haram, Meri, Rael (from pre-grounded facts) + narrator  
**[TARGET]** Character voice profiles for `_workspace/.../production/storyboard-motion-sound-matrix.json` voice registry:

| Character | Voice ID | Stability | Similarity Boost | Style | Speaker Boost | Speed | Tone Prompt |
|-----------|----------|-----------|------------------|-------|---------------|-------|-------------|
| **Narrator** | `${NARRATOR_VOICE_ID}` | 0.50 | 0.75 | 0.30 | true | 1.00 | "Detached mission briefing. Terse military broadcast, no emotional color. Echo Deep command authority." |
| **Haram** | `${HARAM_VOICE_ID}` | 0.40 | 0.70 | 0.65 | true | 0.95 | "Gruff veteran defender. Weary resolve, protective instinct. Low register, deliberate pacing." |
| **Meri** | `${MERI_VOICE_ID}` | 0.45 | 0.72 | 0.60 | true | 1.05 | "Focused striker. Sharp, decisive, minimal hesitation. Mid-register, clipped delivery." |
| **Rael** | `${RAEL_VOICE_ID}` | 0.55 | 0.78 | 0.50 | true | 1.00 | "Analytical support caster. Measured, precise. Clear enunciation, steady rhythm." |

**[INFERENCE]** Voice IDs loaded from `.env.game-audio` (never committed), fallback to `ELEVENLABS_VOICE_ID` for all if unset  
**[TARGET]** Add to `.env.game-audio` template (documented in repo README, never tracked):
```bash
# ElevenLabs API credentials — NEVER COMMIT THIS FILE
ELEVENLABS_API_KEY=sk_...
# Character voice IDs (obtain from https://www.elevenlabs.io/app/voice-library)
NARRATOR_VOICE_ID=...
HARAM_VOICE_ID=...
MERI_VOICE_ID=...
RAEL_VOICE_ID=...
# Fallback if character-specific IDs unset
ELEVENLABS_VOICE_ID=...
```

**[TARGET]** Voice profile resolution in `scripts/generate-audio.mjs` (new helper function):
```javascript
function resolveVoiceId(voiceProfile) {
  const characterMap = {
    narrator: process.env.NARRATOR_VOICE_ID,
    haram: process.env.HARAM_VOICE_ID,
    meri: process.env.MERI_VOICE_ID,
    rael: process.env.RAEL_VOICE_ID,
  };
  return characterMap[voiceProfile?.toLowerCase()] || process.env.ELEVENLABS_VOICE_ID;
}
```

---

## 2. SFX Generation Contract — Combat & World Events

**[OBSERVED]** Current audio cues: `defense-catalog.js:162-184` `AUDIO_CUES` defines 15 procedural waveform entries  
**[OBSERVED]** Current runtime: `defense-audio.js` (implied from pre-grounded facts) generates oscillator tones on event emission  
**[TARGET]** Replace with ElevenLabs **text-to-sound** API (`model_id: eleven_text_to_sound_v2`) for event-triggered transients

### 2.1 Combat SFX — Frame-Accurate Transients

**[OBSERVED]** Combat FSM timing: `_workspace/.../engineering/combat-motion-fsm-spec.md:370-387` defines event emission ticks  
**[OBSERVED]** Hit-frame tick: t12 in 24-tick attack cycle (0.2s @ 60Hz), hit-stop duration 2-10 ticks  
**[TARGET]** SFX rows with deterministic output naming for pre-bake asset pipeline:

| SFX ID | Text Description | Duration (s) | Prompt Influence | Loop | Output Format | Model | Emission Event | Frame Alignment |
|--------|------------------|--------------|------------------|------|---------------|-------|----------------|-----------------|
| `attack-windup-melee` | "Metal scrape, weapon draw from sheath, sharp whoosh" | 0.20 | 0.30 | false | mp3_44100_128 | eleven_text_to_sound_v2 | `ATTACK_WINDUP_START` (melee) | Tick 0, 12-tick windup |
| `attack-windup-ranged` | "Energy charge hum, rising arc-caster whine, crystalline resonance" | 0.20 | 0.35 | false | mp3_44100_128 | eleven_text_to_sound_v2 | `ATTACK_WINDUP_START` (ranged) | Tick 0, 12-tick windup |
| `weapon-fire-melee` | "Impact transient, sharp metal strike, blade-edge contact ping" | 0.055 | 0.25 | false | mp3_44100_128 | eleven_text_to_sound_v2 | `WEAPON_FIRED` (melee) | Tick 12, hit-frame |
| `weapon-fire-ranged` | "Arc-caster discharge, electric snap, projectile release whoosh" | 0.055 | 0.30 | false | mp3_44100_128 | eleven_text_to_sound_v2 | `WEAPON_FIRED` (ranged) | Tick 12, hit-frame |
| `impact-hit-light` | "Soft flesh hit, muffled thud, air displacement puff" | 0.07 | 0.20 | false | mp3_44100_128 | eleven_text_to_sound_v2 | `IMPACT_CONTACT` (damage < 500) | Tick 13-14 |
| `impact-hit-heavy` | "Heavy armor impact, deep metallic clang, resonant shockwave" | 0.12 | 0.35 | false | mp3_44100_128 | eleven_text_to_sound_v2 | `IMPACT_CONTACT` (damage ≥ 500) | Tick 13-14 |
| `critical-hit-burst` | "Explosive critical strike, glass shatter, electric crackle burst" | 0.18 | 0.40 | false | mp3_44100_128 | eleven_text_to_sound_v2 | `CRITICAL_HIT` | On critical resolve |
| `hitstop-flash` | "Time freeze stutter, low-frequency rumble, reality snap" | 0.08 | 0.30 | false | mp3_44100_128 | eleven_text_to_sound_v2 | `HITSTOP_START` | Tick 18, freeze both actors |

**[OBSERVED]** Existing category duration: `scripts/generate-audio.mjs:78-83` `inferCategoryDuration()` returns 1.3s for `sfx`  
**[INFERENCE]** ElevenLabs text-to-sound allows explicit `duration_seconds` parameter; override inferred category duration  
**[TARGET]** SFX generation flags: `--category sfx --duration-override <value> --model eleven_text_to_sound_v2`

### 2.2 Enemy & Movement SFX

**[OBSERVED]** Enemy archetypes: `defense-catalog.js:137` `TARGET_PRIORITY = {boss, elite, ranged, guardian, flanker, rusher}`  
**[TARGET]** Enemy-specific SFX for spawn/defeat events:

| SFX ID | Text Description | Duration (s) | Prompt Influence | Model | Emission Event |
|--------|------------------|--------------|------------------|-------|----------------|
| `enemy-spawn-rusher` | "Rushing footsteps, rapid clattering, lightweight armor jangle" | 0.25 | 0.30 | eleven_text_to_sound_v2 | Enemy spawn (rusher) |
| `enemy-spawn-flanker` | "Agile movement, quick dash, fabric whip snap" | 0.28 | 0.32 | eleven_text_to_sound_v2 | Enemy spawn (flanker) |
| `enemy-spawn-guardian` | "Heavy armor march, ground thud, chain drag low rumble" | 0.40 | 0.38 | eleven_text_to_sound_v2 | Enemy spawn (guardian) |
| `enemy-spawn-ranged` | "Weapon ready click, scope adjustment, tense bowstring creak" | 0.30 | 0.30 | eleven_text_to_sound_v2 | Enemy spawn (ranged) |
| `enemy-spawn-elite` | "Ominous presence, deep metallic hum, reality distortion ripple" | 0.50 | 0.42 | eleven_text_to_sound_v2 | Enemy spawn (elite) |
| `enemy-spawn-boss` | "Earth-shaking arrival, colossal footstep, orchestral hit stinger" | 0.80 | 0.50 | eleven_text_to_sound_v2 | `bossSpawned` event |
| `enemy-defeated-generic` | "Final gasp, armor collapse, dissipating energy hiss" | 0.18 | 0.25 | eleven_text_to_sound_v2 | `enemyDefeated` event |
| `movement-step-light` | "Single footstep, quick tap, leather boot on stone" | 0.045 | 0.15 | eleven_text_to_sound_v2 | `movementStep` event |
| `movement-step-heavy` | "Heavy boot stomp, armor weight shift, ground impact" | 0.060 | 0.20 | eleven_text_to_sound_v2 | Commander movement |

**[OBSERVED]** Existing `AUDIO_CUES.movementStep`: `{frequency: 92, duration: 0.045}`  
**[TARGET]** Replace procedural oscillator with pre-baked ElevenLabs `movement-step-light.mp3`

### 2.3 UI & World Event SFX

| SFX ID | Text Description | Duration (s) | Prompt Influence | Model | Emission Event |
|--------|------------------|--------------|------------------|-------|----------------|
| `stage-start-fanfare` | "Mission begin horn, low brass fanfare, gate activation hum" | 0.25 | 0.35 | eleven_text_to_sound_v2 | `stageStart` event |
| `item-collected-chime` | "Crystalline chime, item pickup sparkle, reward acquisition ding" | 0.20 | 0.25 | eleven_text_to_sound_v2 | `itemCollected` event |
| `elite-extracted-resolve` | "Deep resolution chord, extraction success, containment lock snap" | 0.40 | 0.40 | eleven_text_to_sound_v2 | `eliteExtracted` event |
| `growth-offer-notification` | "Level-up notification, ascending chime cascade, option present glow" | 0.28 | 0.30 | eleven_text_to_sound_v2 | `growthOffer` event |
| `skill-cast-activation` | "Skill trigger whoosh, ability activate surge, energy release snap" | 0.20 | 0.35 | eleven_text_to_sound_v2 | `skillCast` event |
| `extraction-ready-pulse` | "Extraction point active, pulsing beacon, readiness indicator hum" | 0.30 | 0.30 | eleven_text_to_sound_v2 | `extractionReady` event |
| `occupation-captured-lock` | "Control point lock, territory claim, mechanism engage clunk" | 0.22 | 0.30 | eleven_text_to_sound_v2 | `occupationCaptured` event |
| `terminal-gate-strain` | "Gate damage rumble, structural stress, failing integrity groan" | 0.50 | 0.40 | eleven_text_to_sound_v2 | `terminal` event |
| `camera-clamp-tick` | "Soft boundary bump, gentle control limit tap, minimal feedback" | 0.035 | 0.10 | eleven_text_to_sound_v2 | `cameraClamp` event (renderer-only) |

**[OBSERVED]** `cameraClamp` cue: `defense-catalog.js:177-183` explicitly renderer-side, never in simulation digest  
**[INFERENCE]** Camera boundary SFX loaded by renderer (`app.js` pointer handlers), not from simulation event stream

---

## 3. BGM Generation — Music Composition API

**[OBSERVED]** Existing category duration: `scripts/generate-audio.mjs:79` `inferCategoryDuration()` returns 12s for `bgm`  
**[OBSERVED]** Game scenes from project structure: **lobby** (menu/companion selection), **stage** (active defense run), **boss** (elite/boss encounter)  
**[TARGET]** Use ElevenLabs **Music** API (undocumented in pre-grounded facts; assume available) or **text-to-sound with long duration + loop markers**

### 3.1 BGM Track Specifications

| Track ID | Scene | Prompt | Duration (s) | Seamless Loop | Output Format | Model |
|----------|-------|--------|--------------|---------------|---------------|-------|
| `bgm-lobby-wait` | Lobby | "Ambient tension underscore, soft strings, distant echo, preparation mood, 80 BPM, Dorian mode, minimal percussion" | 120 | true | mp3_44100_128 | eleven_music_v1 or eleven_text_to_sound_v2 |
| `bgm-stage-combat` | Stage (waves 1-3) | "Intense action combat, driving rhythm, industrial percussion, metallic textures, 140 BPM, minor key, relentless forward momentum" | 180 | true | mp3_44100_128 | eleven_music_v1 or eleven_text_to_sound_v2 |
| `bgm-stage-late` | Stage (waves 4+) | "Escalating pressure, layered synth arpeggios, urgent string ostinato, rising tension, 150 BPM, Phrygian dominant, building complexity" | 180 | true | mp3_44100_128 | eleven_music_v1 or eleven_text_to_sound_v2 |
| `bgm-boss-encounter` | Boss | "Epic boss battle, orchestral hit accents, heroic brass fanfare, choir swells, 130 BPM, dramatic shifts, climactic peak moments" | 240 | true | mp3_44100_128 | eleven_music_v1 or eleven_text_to_sound_v2 |
| `bgm-victory-resolve` | Stage clear | "Triumphant resolution, ascending chord progression, warm strings, release of tension, 90 BPM, major key, 30s outro fade" | 45 | false | mp3_44100_128 | eleven_music_v1 or eleven_text_to_sound_v2 |
| `bgm-defeat-somber` | Gate destroyed | "Somber defeat, descending minor progression, distant echo, fading hope, 60 BPM, minimal instrumentation, 20s decay" | 30 | false | mp3_44100_128 | eleven_music_v1 or eleven_text_to_sound_v2 |

**[INFERENCE]** Seamless loop requirement: BGM tracks MUST have clean loop points (fade-in/out tail overlap OR loop marker metadata)  
**[TARGET]** Post-processing hook in `scripts/generate-audio.mjs`: detect loop flag, apply 2-second cross-fade tail if `seamless_loop: true`

### 3.2 BGM Triggering & Cross-Fade

**[OBSERVED]** Game state transitions: lobby → stage-start → combat-waves → boss-spawn → victory/defeat  
**[TARGET]** BGM manager (`defense-audio.js` or new `audio-manager.js`) cross-fade logic:

| Transition | From Track | To Track | Cross-Fade Duration (s) | Trigger Event |
|------------|------------|----------|-------------------------|---------------|
| Lobby → Stage | `bgm-lobby-wait` | `bgm-stage-combat` | 3.0 | `stageStart` event |
| Stage Wave 3 → Wave 4 | `bgm-stage-combat` | `bgm-stage-late` | 4.0 | Wave counter >= 4 |
| Stage → Boss | `bgm-stage-late` | `bgm-boss-encounter` | 2.0 | `bossSpawned` event |
| Boss → Victory | `bgm-boss-encounter` | `bgm-victory-resolve` | 2.5 | Stage clear event |
| Combat → Defeat | (any) | `bgm-defeat-somber` | 1.5 | Gate destroyed |

**[INFERENCE]** Cross-fade handled renderer-side via Web Audio API `GainNode` envelope, NOT in simulation  
**[TARGET]** BGM state tracked in renderer, observes simulation events to trigger transitions

---

## 4. Integration with Existing `generate-audio.mjs` — CLI & Plan Matrix

**[OBSERVED]** Existing flags: `scripts/generate-audio.mjs` supports `--force --list-voices --stages --matrix --only`  
**[OBSERVED]** Plan matrix default: `_workspace/20260723-solo-warden-rpg-concept/production/storyboard-motion-sound-matrix.json`  
**[TARGET]** New flags and plan fields to add:

### 4.1 New CLI Flags

| Flag | Argument | Behavior |
|------|----------|----------|
| `--voice-profile` | `<name>` | Generate TTS clips for specific character (narrator, haram, meri, rael); default: all |
| `--sfx-category` | `<category>` | Generate SFX for category: combat, enemy, movement, world, ui; default: all |
| `--bgm-scene` | `<scene>` | Generate BGM for scene: lobby, stage, boss, victory, defeat; default: all |
| `--duration` | `<seconds>` | Override inferred category duration for SFX/BGM |
| `--model` | `<model_id>` | Force specific ElevenLabs model (eleven_multilingual_v2, eleven_text_to_sound_v2, eleven_music_v1) |
| `--loop` | (boolean) | Force seamless loop processing for BGM |
| `--pitch-mod` | `<semitones>` | Pitch modulation range for multi-variation capture (e.g., ±2 semitones) |
| `--variations` | `<count>` | Generate N variations per SFX via random prompt_influence jitter (1-5) |

**[OBSERVED]** Existing `--only <id>` flag filters plan matrix by clip ID  
**[INFERENCE]** New flags compose with `--only` to refine selection

### 4.2 Plan Matrix Extensions

**[OBSERVED]** Existing plan structure: `scripts/generate-audio.mjs:95-176` `parsePlan()` reads `narrationClips`, `stateNarrations`, `skillNarrations`, `bgmById`, `sfxById`, `ambienceById`, `battleTriggerSfx`, `animationSfxMap`  
**[TARGET]** Extend plan schema with new fields:

```json
{
  "schemaVersion": "v2-elevenlabs",
  "voiceProfiles": {
    "narrator": {
      "voiceId": "${NARRATOR_VOICE_ID}",
      "stability": 0.50,
      "similarity_boost": 0.75,
      "style": 0.30,
      "use_speaker_boost": true,
      "speed": 1.00,
      "tonePrompt": "Detached mission briefing..."
    },
    "haram": { /* ... */ },
    "meri": { /* ... */ },
    "rael": { /* ... */ }
  },
  "sfxClips": [
    {
      "id": "attack-windup-melee",
      "category": "combat",
      "text": "Metal scrape, weapon draw from sheath, sharp whoosh",
      "duration_seconds": 0.20,
      "prompt_influence": 0.30,
      "loop": false,
      "output_format": "mp3_44100_128",
      "model_id": "eleven_text_to_sound_v2",
      "emissionEvent": "ATTACK_WINDUP_START",
      "frameAlignment": "Tick 0, 12-tick windup",
      "variations": 3,
      "pitchModRange": 2
    }
    // ... all SFX rows from §2
  ],
  "bgmTracks": [
    {
      "id": "bgm-lobby-wait",
      "scene": "lobby",
      "prompt": "Ambient tension underscore...",
      "duration_seconds": 120,
      "seamless_loop": true,
      "output_format": "mp3_44100_128",
      "model_id": "eleven_music_v1"
    }
    // ... all BGM rows from §3
  ],
  "audioClipsByCategory": {
    "bgm": { /* existing structure */ },
    "sfx": { /* existing structure */ }
  }
}
```

**[INFERENCE]** `parsePlan()` extension required to handle `sfxClips` and `bgmTracks` arrays  
**[TARGET]** Backward-compatible: if `sfxClips` absent, fall back to `audioClipsByCategory.sfx`

---

## 5. Deterministic Output Naming & Asset Manifest Registration

**[OBSERVED]** Existing output path: `assets/audio/elevenlabs/{category}/{id}.mp3`  
**[OBSERVED]** Asset manifest: `assets/defense-asset-manifest.json` (referenced in pre-grounded facts)  
**[TARGET]** Naming convention for multi-variation SFX:

### 5.1 Output Path Convention

| Asset Type | Path Pattern | Example |
|------------|--------------|---------|
| TTS (single) | `assets/audio/elevenlabs/narration/{character}/{id}.mp3` | `assets/audio/elevenlabs/narration/haram/stage-intro-01.mp3` |
| TTS (multi-voice) | `assets/audio/elevenlabs/dialogue/{scene}/{id}.mp3` | `assets/audio/elevenlabs/dialogue/boss-encounter/taunt-01.mp3` |
| SFX (single) | `assets/audio/elevenlabs/sfx/{category}/{id}.mp3` | `assets/audio/elevenlabs/sfx/combat/weapon-fire-melee.mp3` |
| SFX (variation) | `assets/audio/elevenlabs/sfx/{category}/{id}-v{N}.mp3` | `assets/audio/elevenlabs/sfx/combat/impact-hit-light-v2.mp3` |
| BGM | `assets/audio/elevenlabs/bgm/{id}.mp3` | `assets/audio/elevenlabs/bgm/bgm-stage-combat.mp3` |

**[OBSERVED]** Variation count per SFX defaults to 1; `--variations <N>` flag overrides  
**[INFERENCE]** Runtime audio manager randomly selects from variation pool to avoid repetition

### 5.2 Asset Manifest Registration

**[TARGET]** `scripts/generate-audio.mjs` post-generation hook updates `assets/defense-asset-manifest.json`:

```json
{
  "audio": {
    "narration": [
      {
        "id": "stage-intro-01",
        "character": "haram",
        "path": "assets/audio/elevenlabs/narration/haram/stage-intro-01.mp3",
        "duration": 3.2,
        "generatedAt": "2026-01-27T14:23:45Z",
        "model": "eleven_multilingual_v2",
        "voiceId": "${HARAM_VOICE_ID}"
      }
    ],
    "sfx": [
      {
        "id": "weapon-fire-melee",
        "category": "combat",
        "variations": 3,
        "paths": [
          "assets/audio/elevenlabs/sfx/combat/weapon-fire-melee.mp3",
          "assets/audio/elevenlabs/sfx/combat/weapon-fire-melee-v2.mp3",
          "assets/audio/elevenlabs/sfx/combat/weapon-fire-melee-v3.mp3"
        ],
        "duration": 0.055,
        "emissionEvent": "WEAPON_FIRED",
        "generatedAt": "2026-01-27T14:25:12Z",
        "model": "eleven_text_to_sound_v2"
      }
    ],
    "bgm": [
      {
        "id": "bgm-stage-combat",
        "scene": "stage",
        "path": "assets/audio/elevenlabs/bgm/bgm-stage-combat.mp3",
        "duration": 180,
        "seamlessLoop": true,
        "loopStart": 2.0,
        "loopEnd": 178.0,
        "generatedAt": "2026-01-27T14:30:00Z",
        "model": "eleven_music_v1"
      }
    ]
  }
}
```

**[OBSERVED]** `.env.game-audio` and machine-local state are never committed (from project instructions)  
**[TARGET]** `assets/defense-asset-manifest.json` IS committed (deterministic asset registry), but voice IDs obfuscated as env var references  
**[INFERENCE]** Manifest allows runtime validation: check all listed paths exist, durations match plan, no orphaned files

---

## 6. Frame-Accurate Sync — Combat FSM Integration

**[OBSERVED]** Combat FSM spec: `_workspace/.../engineering/combat-motion-fsm-spec.md:370-387` defines event emission timing  
**[OBSERVED]** Hit-frame tick: t12 in 24-tick attack cycle, HITSTOP at t18, RECOVERY at t24  
**[TARGET]** SFX transient peak alignment to FSM state transitions:

### 6.1 Transient Peak Alignment

| SFX ID | Peak Offset (ms) | Alignment Target | FSM State | Tick |
|--------|------------------|------------------|-----------|------|
| `attack-windup-melee` | 0 | Attack begins | WINDUP entry | 0 |
| `weapon-fire-melee` | 5-10 | Blade contact | ACTIVE peak | 12 |
| `impact-hit-light` | 0 | Impact frame | Contact resolve | 13-14 |
| `hitstop-flash` | 0 | Freeze start | HITSTOP entry | 18 |
| `critical-hit-burst` | 15-20 | Explosion peak | Critical resolve | Varies |

**[INFERENCE]** SFX audio files MUST have transient peak within first 10ms for frame-accurate triggering  
**[TARGET]** Post-processing validation: analyze waveform, measure peak offset, warn if > 15ms from start

### 6.2 Random Pitch Modulation

**[OBSERVED]** Combat FSM allows multiple attacks per tick; repetition breaks immersion  
**[TARGET]** Runtime pitch modulation per SFX playback instance:

| SFX Category | Pitch Range (semitones) | Application |
|--------------|------------------------|-------------|
| Combat hits | ±2 | Per-instance random on `IMPACT_CONTACT` |
| Weapon fire | ±1 | Per-instance random on `WEAPON_FIRED` |
| Movement steps | ±0.5 | Per-step random on `movementStep` |
| UI/world events | 0 | No modulation (recognizable identity) |

**[INFERENCE]** Pitch modulation applied via Web Audio API `PlaybackRate` (1 semitone = 2^(1/12) rate factor)  
**[TARGET]** Runtime audio manager helper:
```javascript
function playWithPitchMod(audioBuffer, emissionEvent, pitchSemitones = 0) {
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  const randomPitch = (Math.random() - 0.5) * 2 * pitchSemitones;
  source.playbackRate.value = Math.pow(2, randomPitch / 12);
  source.connect(audioContext.destination);
  source.start(0);
}
```

### 6.3 Multi-Variation Capture via Prompt Influence

**[OBSERVED]** ElevenLabs text-to-sound `prompt_influence` parameter (0.0-1.0) affects generation variance  
**[TARGET]** Generate multiple variations per SFX by varying `prompt_influence`:

| Variation | Prompt Influence | Characteristics |
|-----------|------------------|-----------------|
| v1 (base) | Nominal (from plan) | Baseline interpretation |
| v2 | Nominal + 0.05 | Slight timbral shift |
| v3 | Nominal + 0.10 | More pronounced variation |
| v4 | Nominal - 0.05 | Softer/muted version |
| v5 | Nominal - 0.10 | Subdued alternative |

**[INFERENCE]** `--variations <N>` flag generates N files with prompt_influence jitter  
**[TARGET]** Example invocation:
```bash
node scripts/generate-audio.mjs \
  --matrix _workspace/.../audio-plan.json \
  --only weapon-fire-melee \
  --variations 3 \
  --pitch-mod 2
```
Output: `weapon-fire-melee.mp3`, `weapon-fire-melee-v2.mp3`, `weapon-fire-melee-v3.mp3` (each with slightly different prompt_influence)

---

## 7. Runtime Integration — Replacing Procedural Oscillators

**[OBSERVED]** Current runtime cues: `defense-catalog.js:162-184` `AUDIO_CUES` defines procedural waveforms  
**[OBSERVED]** Current audio playback: `defense-audio.js` (implied) generates oscillator tones via Web Audio API `OscillatorNode`  
**[TARGET]** Replace procedural synthesis with pre-baked ElevenLabs MP3 playback:

### 7.1 Audio Manager Refactor

**[TARGET]** New `audio-manager.js` (or extend `defense-audio.js`) with dual-mode playback:

```javascript
class AudioManager {
  constructor(audioContext, manifest) {
    this.ctx = audioContext;
    this.manifest = manifest;  // loaded from defense-asset-manifest.json
    this.buffers = new Map();  // id -> AudioBuffer
    this.fallbackOscillators = AUDIO_CUES;  // procedural fallback
  }

  async loadManifest() {
    // Load all MP3 files from manifest paths into AudioBuffer cache
    for (const category of ['narration', 'sfx', 'bgm']) {
      for (const entry of this.manifest.audio[category] || []) {
        const paths = entry.paths || [entry.path];
        for (const path of paths) {
          const buffer = await this.fetchAudioBuffer(path);
          this.buffers.set(entry.id, buffer);
        }
      }
    }
  }

  playCue(cueId, options = {}) {
    const buffer = this.buffers.get(cueId);
    if (buffer) {
      // ElevenLabs path: play pre-baked MP3
      return this.playBufferWithOptions(buffer, options);
    } else {
      // Fallback path: procedural oscillator (graceful degradation)
      console.warn(`[AudioManager] Missing asset for ${cueId}, using procedural fallback`);
      return this.playProceduralOscillator(this.fallbackOscillators[cueId]);
    }
  }

  playBufferWithOptions(buffer, { pitchMod = 0, volume = 1.0, pan = 0 }) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = Math.pow(2, pitchMod / 12);

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = volume;

    const panNode = this.ctx.createStereoPanner();
    panNode.pan.value = pan;

    source.connect(gainNode).connect(panNode).connect(this.ctx.destination);
    source.start(0);
    return source;
  }

  playProceduralOscillator(cue) {
    // Existing oscillator logic from defense-audio.js
    const osc = this.ctx.createOscillator();
    osc.type = cue.waveform;
    osc.frequency.value = cue.frequency;
    // ... existing implementation
  }
}
```

**[INFERENCE]** Dual-mode allows gradual asset migration: oscillators remain until ElevenLabs SFX generated  
**[OBSERVED]** `.env.game-audio` requirement means ElevenLabs assets are optional (local development may lack API key)

### 7.2 Event-to-SFX Mapping

**[TARGET]** Map simulation events to SFX IDs in audio manager:

```javascript
const EVENT_TO_SFX_MAP = {
  ATTACK_WINDUP_START: (event) => {
    const attackType = event.attackType || 'melee';
    return `attack-windup-${attackType}`;
  },
  WEAPON_FIRED: (event) => {
    const attackType = event.attackType || 'melee';
    return `weapon-fire-${attackType}`;
  },
  IMPACT_CONTACT: (event) => {
    const damage = event.damage || 0;
    return damage >= 500 ? 'impact-hit-heavy' : 'impact-hit-light';
  },
  CRITICAL_HIT: () => 'critical-hit-burst',
  HITSTOP_START: () => 'hitstop-flash',
  enemyDefeated: () => 'enemy-defeated-generic',
  bossSpawned: () => 'enemy-spawn-boss',
  itemCollected: () => 'item-collected-chime',
  stageStart: () => 'stage-start-fanfare',
  // ... full mapping from AUDIO_CUES
};

// In event handler (renderer-side):
function onSimulationEvent(event) {
  const sfxIdOrFn = EVENT_TO_SFX_MAP[event.type];
  if (!sfxIdOrFn) return;
  const sfxId = typeof sfxIdOrFn === 'function' ? sfxIdOrFn(event) : sfxIdOrFn;
  const pitchMod = SFX_PITCH_MODULATION[event.type] || 0;
  audioManager.playCue(sfxId, { pitchMod: (Math.random() - 0.5) * 2 * pitchMod });
}
```

**[INFERENCE]** Event handler runs renderer-side, observes simulation events from snapshot  
**[OBSERVED]** Renderer contract: `battle-realtime-three.js:793-923` reads frozen snapshot, never writes back

---

## 8. Implementation Roadmap & Priority Tiers

**[TARGET]** Phased rollout to avoid blocking gameplay development:

| Phase | Scope | Dependencies | Verification |
|-------|-------|--------------|--------------|
| **Phase 1: TTS Narration** | Generate narrator + character dialogue clips from plan matrix | `.env.game-audio` setup, voice ID acquisition | Manual playback test: `node scripts/generate-audio.mjs --voice-profile narrator --only stage-intro-01` |
| **Phase 2: Combat SFX** | Generate core combat transients (windup, fire, impact, critical) | Phase 1 complete, combat FSM event emission | Frame-accurate playback test: spawn enemy, verify hit-frame SFX aligns with visual contact |
| **Phase 3: Enemy & UI SFX** | Generate enemy spawn/defeat + world event SFX | Phase 2 complete | Event coverage test: trigger all 15 AUDIO_CUES events, verify MP3 playback or procedural fallback |
| **Phase 4: BGM Tracks** | Generate seamless loop BGM for lobby/stage/boss scenes | Music API access or long-duration text-to-sound | Cross-fade test: play lobby → stage transition, measure cross-fade smoothness |
| **Phase 5: Multi-Variation** | Generate 3-5 variations per SFX with pitch-mod runtime selection | Phase 2-3 complete | Repetition avoidance test: fire 20 identical attacks, verify variation in playback |
| **Phase 6: Asset Manifest** | Auto-register all generated files in `defense-asset-manifest.json` | All phases complete | Manifest validation: check all paths exist, no orphaned files, durations match plan |

**[INFERENCE]** Phase 1-2 unblocks critical narrative and combat feel; Phase 3-6 are polish/scalability  
**[OBSERVED]** Current procedural oscillators remain functional fallback throughout all phases

---

## 9. Open Implementation Risks

| Risk ID | Description | Mitigation |
|---------|-------------|-----------|
| **R1** | ElevenLabs Music API may not exist or may require beta access | **Fallback**: Use `eleven_text_to_sound_v2` with long duration (120-240s) + manual loop marker insertion via Audacity/FFmpeg |
| **R2** | Text-to-sound SFX may have unpredictable transient peak timing (> 15ms offset) | **Mitigation**: Post-processing script analyzes waveform, trims silence before transient, validates peak offset |
| **R3** | Multi-variation prompt_influence jitter may produce overly dissimilar results | **Mitigation**: Constrain jitter to ±0.05 range, manual QA review before committing to manifest |
| **R4** | `.env.game-audio` absence blocks local development if audio manager hard-depends on ElevenLabs assets | **Mitigation**: Dual-mode playback (§7.1) with graceful procedural fallback; CI/CD runs without `.env.game-audio` |
| **R5** | BGM seamless loop cross-fade may introduce audio artifacts (pops/clicks) at loop boundary | **Mitigation**: 2-second overlap region with 1-second exponential fade-out/fade-in envelope; loop marker validation script |
| **R6** | Asset manifest grows large (hundreds of variations); manual updates error-prone | **Mitigation**: `generate-audio.mjs` atomically rewrites manifest on completion; Git diff review catches orphaned entries |
| **R7** | Frame-accurate SFX sync broken if simulation tick rate changes from 60 Hz | **[OBSERVED]** Tick rate constant: `defense-catalog.js:11` `TICK_RATE = 60`; **Mitigation**: Document tick-rate dependency, fail loudly if changed |

**[INFERENCE]** Highest-risk items: R1 (BGM API availability), R2 (transient timing), R4 (local dev fallback)

---

## 10. Verification & Acceptance Criteria

**[TARGET]** Acceptance criteria for ElevenLabs audio pipeline integration:

| ID | Criterion | Evidence |
|----|-----------|----------|
| **V1** | `scripts/generate-audio.mjs --voice-profile narrator` generates TTS clips to `assets/audio/elevenlabs/narration/narrator/*.mp3` | Manual run + file existence check |
| **V2** | Combat SFX `weapon-fire-melee` plays at hit-frame tick (t12), not at windup start (t0) | Browser test: listen to attack cycle, verify sharp transient aligns with visual contact flash |
| **V3** | SFX variation selection: 20 identical attacks produce audibly distinct playback | Automated test: log selected variation index per attack, verify uniform distribution across 3-5 variations |
| **V4** | BGM cross-fade `lobby → stage` completes in 3.0s without pops/clicks | Audio recording test: capture cross-fade, analyze waveform for discontinuities |
| **V5** | Procedural oscillator fallback triggers when `.env.game-audio` absent | Delete `.env.game-audio`, start game, verify oscillator tones play + console warning logged |
| **V6** | `assets/defense-asset-manifest.json` lists all generated SFX/BGM with correct paths and durations | Manifest validation script: iterate entries, verify `fs.existsSync(path)` and metadata matches generated file |
| **V7** | Pitch modulation ±2 semitones on `impact-hit-light` produces recognizable variation without distortion | Manual listen test: play 10 instances, verify pitch variance + no clipping artifacts |
| **V8** | `.env.game-audio` never committed to repository | Git hook test: attempt commit with `.env.game-audio`, verify rejection |

**[INFERENCE]** V1-V2 prove correctness; V3-V7 prove quality; V8 proves security contract  
**[OBSERVED]** Project instructions: `.env.game-audio` never committed (CLAUDE.md §5)

---

## 11. Summary — Execution Path

**[OBSERVED]** Current system: procedural oscillator waveforms on simulation event emission  
**[TARGET]** ElevenLabs pipeline: plan matrix → TTS/SFX/BGM generation → asset manifest → runtime dual-mode playback  
**[INFERENCE]** Implementation order:

1. Extend `.env.game-audio` template with character voice IDs (§1)
2. Add `resolveVoiceId()` helper to `scripts/generate-audio.mjs` (§1)
3. Define SFX/BGM plan matrices with text prompts, durations, models (§2-3)
4. Extend `parsePlan()` to read `sfxClips` and `bgmTracks` arrays (§4.2)
5. Add CLI flags `--voice-profile --sfx-category --bgm-scene --variations --pitch-mod` (§4.1)
6. Implement multi-variation generation loop with prompt_influence jitter (§6.3)
7. Write asset manifest registration hook (§5.2)
8. Refactor `defense-audio.js` into dual-mode `AudioManager` with buffer cache + procedural fallback (§7.1)
9. Map simulation events to SFX IDs with pitch-mod ranges (§7.2)
10. Validate transient peak alignment and seamless loop markers (§6.1, §3.1)

**[OBSERVED]** Grounding files read:
- `scripts/generate-audio.mjs:78-200` (voice settings, plan parsing, category duration)
- `_workspace/.../engineering/combat-motion-fsm-spec.md:1-541` (FSM timing, event keys, frame-accurate sync)
- `defense-catalog.js:1-250` (TICK_RATE, AUDIO_CUES, enemy archetypes, named characters)
- `.env.game-audio` (never committed, documented template only)

**[INFERENCE]** Spec bridges ElevenLabs TTS/SFX/BGM APIs onto existing procedural audio system with graceful fallback, deterministic asset naming, and frame-accurate combat sync.
