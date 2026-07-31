# 15 — Camera framing and cinematic

- **Version** v1 (2026-07-31)
- **Skills** `/skill:video-production` (cutscene batch render), `/skill:video-shotcraft` (shot cards),
  `/skill:video-to-superprompt` (reference decomposition)
- **Produces** a camera envelope change, a stage intro dolly, or a cutscene sequence — each with its
  bound proven.
- **Placeholders** `${stageId}`, `${phase}`, `${sceneId}`, `${fixtureSeed}`.

---

**CONTEXT:**
Camera is fully authored and fully bounded. `battle-realtime-three.js`, verified by
`tests/stage-framing-and-motion-profile.test.mjs`:

```
CAMERA_PHASES               DESCENT SKIRMISH SURGE MIDBOSS BIGWAVE FINALE
CAMERA_PHASE_TIERS zoomFactor    20.8   26    33     38      41.5   41.5
                   boundaryDepth 23     28.7  36.5   42      45.9   45.9
CAMERA_TIER_TRANSITION_TICKS 90    CAMERA_POSITION_LAMBDA 6    CAMERA_LOOK_LAMBDA 11
global orbit envelope 10.4 – 41.6
per-stage zoom clamp   cinder-span 10.4–41.6 · abyss-chancel 12–36 · echo-throne 10.4–41.6
pitch floor            abyss-chancel 35° in DESCENT and SKIRMISH; no floor elsewhere
finaleLookOffset       cinder-span y+1000 · abyss-chancel y-800 · echo-throne 0,0
```

A phase tier outside the stage clamp still wins — that is authored behaviour, not a leak, and it is
pinned by test. The FINALE look offset applies in FINALE and nowhere else.

Stage intro dolly, authored in `stage-world-catalog.js` `presentation.cinematic.intro`:

```
cinder-span   durationTicks 90   from distance 6.0, azimuth -0.24, polar -0.34
abyss-chancel durationTicks 96   from distance 6.4, azimuth  0.30, polar -0.30
echo-throne   durationTicks 102  from distance 6.8, azimuth -0.40, polar -0.28
all: to distance 0, azimuth 0, polar 0
```

`startStageIntro()` hard-returns under reduced motion and requires an integer tick. The dolly is
tick-bounded, preserves the player's selected orbit, and never mutates its snapshot. A confirmed
same-stage same-seed tick-zero restart replays the intro without stale de-dupe resets, and an event
tick-zero stage start clears prior-run VFX before deduplicating the retry. `setReducedMotion(true)`
cancels an active intro; re-enabling motion cannot resume a partially completed dolly.

Boss entrance: the **simulation** authors the entrance length on `BOSS_SPAWNED`
(`intro.durationTicks`); `BOSS_INTRO_FALLBACK_MS = 3000` and `BOSS_INTRO_LOOK_BLEND = 0.72` are the
presentation shape of that window only.

Pre-rendered cutscenes are ledger-driven, under `design/assets/cinematic/`:
`scene_01_shot_sheet.csv` (shot_id, shot_desc, duration_sec, source_image, transition, motion_tag),
`scene_01_vfx_priority.csv` (vfx_id, priority, trigger_sec, duration_sec, vfx_tag, desc),
`scene_01_audio_cue.csv` (cue_id, start_sec, end_sec, track, volume_db, duck_target, description),
plus `scene_01_scene_script.csv` and `scene_01_subtitles_kr.csv`.

**ROLE:**
You are a cinematographer who works inside a clamp instead of asking for it to be lifted. You know
that a camera move the player did not ask for is a cost, and you charge it against readability. You
never let a cutscene contradict the runtime look.

**ACTION:**

1. Classify the work: runtime camera envelope, runtime dolly, or pre-rendered cutscene. These use
   different mechanisms and must not be mixed in one change.
2. For an envelope change, state the current and proposed values for the affected stage and prove the
   result stays inside the global 10.4–41.6 orbit envelope. If a phase tier will now fall outside the
   stage clamp, say so explicitly — that is legal and tested, so it must be intentional.
3. For a pitch floor, state the phases it applies to. `abyss-chancel` holds 35° in `DESCENT` and
   `SKIRMISH` because the stage is pushed in; a floor without a stated reason in stage geometry is a
   guess.
4. For a dolly, keep `durationTicks` an integer and the `from` offsets within the shipped range —
   distance 6.0–6.8, |azimuth| ≤ 0.40, polar -0.34 to -0.28. Prove it is tick-bounded, that it
   preserves the selected orbit, and that it never mutates the snapshot it reads.
5. Prove the restart paths: same-stage same-seed tick-zero restart replays the intro; an event
   tick-zero start clears prior-run VFX before de-dupe; a runtime reduced-motion toggle cancels the
   intro without mutating or reviving snapshots and cannot be resumed by re-enabling motion.
6. For a boss entrance, read `intro.durationTicks` off `BOSS_SPAWNED`. Do not author a second
   duration in the renderer; `BOSS_INTRO_FALLBACK_MS` is a fallback for an absent field, not a
   default to prefer.
7. For a cutscene, edit the CSV ledgers as the source of truth and keep the three files consistent:
   every `vfx_id` trigger window must lie inside a shot's duration, and every audio cue's
   `duck_target` must name a track that exists. Then render through `/skill:video-production`.
8. Verify the failure modes: phase change mid-dolly, stage switch mid-dolly, pause/resume, a boss
   entrance overlapping an active intro, reduced motion at every entry point, and both touch
   orientations.

**FORMAT:**
Markdown at `_workspace/current/design/camera-${stageId}-${sceneId}.md`: the classification, a
before/after value table for every constant touched, the clamp proof, the restart-path checklist, the
CSV consistency check if a cutscene is involved, and the failure-mode checklist with pass/fail per
row.

**TARGET AUDIENCE:**
The QA session running prompt 18 and the release owner running prompt 19.

**HARD CONSTRAINTS:**

- Every stage clamp stays inside the global 10.4–41.6 orbit envelope.
- `abyss-chancel` keeps its 35° pitch floor in `DESCENT` and `SKIRMISH` unless the change is
  justified in stage geometry and the test is updated in the same commit.
- `finaleLookOffset` applies in `FINALE` and nowhere else.
- The dolly is tick-bounded, preserves the selected orbit, and never mutates a snapshot.
- Under reduced motion, `startStageIntro()` does not run and an active intro is cancelled, not
  paused.
- Boss entrance length is simulation-authored. The renderer shapes the window, it does not set it.
- Camera impulse from impacts stays at or below `IMPACT_SHAKE_MAX_AMPLITUDE = 0.13` and may never
  push the camera outside its stage clamp.
- Cutscene ledgers are the source of truth; a rendered video that disagrees with the CSV is wrong.

**DONE WHEN:**
Every touched constant has a before/after row, the clamp and floor proofs are numeric, the restart
and reduced-motion paths are verified, the CSV ledgers are internally consistent if touched, and
`node --test tests/stage-framing-and-motion-profile.test.mjs
tests/combat-presentation-contract.test.mjs tests/world-presentation-contract.test.mjs` passes.
