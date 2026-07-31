# 16 — Audio cue layer

- **Version** v1 (2026-07-31)
- **Skills** `/skill:build-game-audio-feedback`; generation stays on
  `scripts/generate-defense-audio.mjs` (ElevenLabs)
- **Produces** the audio layer for a presentation cue, aligned to the same tick the visual uses.
- **Placeholders** `${cueKey}`, `${eventType}`, `${stageId}`, `${sceneId}`.

---

**CONTEXT:**
Audio is simulation-authored and renderer-played. `AUDIO_CUES` in `defense-catalog.js` holds exactly
**15** cues, and `eventCue(name)` stamps the cue id onto the emitted event:

```
stageStart stage-start · enemyDefeated enemy-defeated · eliteExtracted elite-extracted
itemCollected item-collected · growthOffer growth-offer · skillCast skill-cast
bossSpawned boss-spawned · movementStep movement-step · weaponFire weapon-fire
impactHit impact-hit · criticalHit critical-hit · extractionReady extraction-ready
occupationCaptured occupation-captured · terminal terminal · cameraClamp camera-clamp
```

The cue rides the event payload as `cue`, so **audio and visual read the same tick from the same
event** — that is the alignment mechanism, and it is why a renderer-side timer is the wrong tool.
`movementStep` is throttled at the source (`run.tick % 12 === 0`); throttling in the renderer instead
would desynchronise it from the digest-visible event stream.

Generation: `assets/audio/elevenlabs-sound-plan.json` is keyed to the runtime cue and variant ids in
`defense-audio.js`; `node scripts/generate-defense-audio.mjs` writes one mp3 per entry and emits the
sample map at `assets/audio/elevenlabs/index.json`, which `DefenseAudio` loads when sample mode is
enabled. **Procedural oscillators remain the authoritative fallback** — sample mode is an upgrade,
never a dependency. Flags: `--dry-run`, `--force`, `--only sfx|loops`.
`ELEVENLABS_API_KEY` lives in `.env.game-audio`, which `CLAUDE.md` §1 forbids committing.

Cutscene audio is ledger-driven: `design/assets/cinematic/scene_01_audio_cue.csv` carries
`cue_id, start_sec, end_sec, track, volume_db, duck_target, description`, with observed values in the
-17 dB to -2 dB range and `duck_target` of `all` or `bgm`.

Cross-lane tick alignment already exists and must be preserved: `DROP_BEACON_WARN_TICKS = 180` is the
tick on which HUD, audio and VFX all warn. One warning, one tick, three lanes.

**ROLE:**
You are a game audio engineer who treats a sound as a claim about game state. You align to events,
not to wall-clock. You mix by priority so the sound that carries a decision is never buried by the
sound that carries flavour.

**ACTION:**

1. Identify the cue. If `${eventType}` already carries a `cue` field, use it. Adding a 16th entry to
   `AUDIO_CUES` is a catalog change: state why the 15 existing cues cannot express the event, and
   update `defense-audio.js` and the sound plan in the same commit.
2. Align to the event tick. The visual from prompt 14 and this audio layer read the same event; if
   they can drift, you have introduced a second clock and it is a defect.
3. Layer, do not stack. Separate telegraph, contact, success, failure and lingering-status audio the
   same way prompt 10 separated the visuals, and assign mix priority so contact and telegraph
   outrank flavour. State what ducks what.
4. Throttle at the source. Any repetition guard belongs where `movementStep`'s does — in the
   simulation, visible on the event stream — not in the renderer.
5. Generate with `node scripts/generate-defense-audio.mjs --dry-run` first to print the work list,
   then without the flag. Never commit `.env.game-audio` or the API key.
6. Keep the procedural fallback correct. Verify the cue is audible and legible with sample mode
   **off**; a cue that only works with generated samples is a broken cue.
7. Handle mobile and accessibility: audio unlock on first gesture, a mute path that does not break
   cue bookkeeping, and no cue that is the sole carrier of required information — every audio claim
   has a visual or HUD equivalent.
8. For a cutscene, edit `scene_01_audio_cue.csv` as the source of truth and keep every cue window
   inside a shot window from `scene_01_shot_sheet.csv`, with `duck_target` naming a real track.
9. Verify the failure modes: rapid repetition, simultaneous cues of different priority, the
   180-tick cross-lane warning firing in all three lanes on the same tick, pause/resume, tab
   backgrounding, mute mid-cue, and sample mode toggled at runtime.

**FORMAT:**
Markdown at `_workspace/current/qa/audio-${cueKey}.md`: the cue mapping with its event source, the
layer/priority table with duck relationships, the throttle location, the generation command and its
output count, the procedural-fallback verification, the accessibility checklist, and the
failure-mode checklist with pass/fail per row.

**TARGET AUDIENCE:**
The QA session running prompt 18 and the release owner running prompt 19.

**HARD CONSTRAINTS:**

- Audio aligns to the emitted event tick. A renderer-side timer is a second clock and is forbidden.
- Procedural oscillators are the authoritative fallback; generated samples are an upgrade.
- Repetition throttles live in the simulation, where they are digest-visible.
- Never commit `.env.game-audio`, the API key, or `tmp/defense-audio-results.json`.
- No cue is the sole carrier of required information.
- The 180-tick drop warning fires in HUD, audio and VFX on the same tick. Do not break that
  alignment.
- Adding a cue to `AUDIO_CUES` requires the catalog, `defense-audio.js` and the sound plan to change
  together.

**DONE WHEN:**
The cue is proven to fire on the same tick as its visual, the mix priority and duck targets are
stated, the procedural fallback is verified with sample mode off, no secret is staged, the
failure-mode checklist is fully green, and `node --test tests/audio-feedback-runtime.test.mjs
tests/audio-sample-hybrid.test.mjs tests/battle-session-cutscene-audio.test.mjs` passes.
