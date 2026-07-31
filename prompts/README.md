# Repository prompt library

Curated, repository-bound prompts for Abyssal Surge, in three tracks:

- **Stage map (`00`–`07`)** — layout, encounter progression, procedural layout curation, dressing,
  VFX/perf, QA proof, release.
- **Presentation (`10`–`19`)** — cue specification, arrival and engagement choreography, contact
  feel, motion retarget, runtime VFX, camera and cinematic, audio, frame budget, regression, capture.
- **Systems, difficulty and variation (`20`–`29`)** — encounter pattern brief, enemy behaviour
  policy, difficulty budget, doctrine write, variation package, balance simulation, gate evaluation,
  monotony scan, systems regression, balance changelog and release.

These prompts are **instructions handed to a skill or an agent**, not documentation. Each file is a
complete, copy-pasteable brief with the repository's hard invariants inlined, so a session that has
never read `stage-world-catalog.js`, `defense-catalog.js` or `battle-realtime-three.js` still cannot
author an invalid stage, an unbudgeted effect, or a difficulty curve made of HP multipliers.

## Layout

```
prompts/
  README.md                      this file
  RUNBOOK.md                     stages 1-3: every ${placeholder} resolved from code
  VERSIONS.md                    change log per prompt
  approved/                      prompts cleared for use
    00-stage-map-blueprint.md    map skeleton: bands, gate, corridors, anchor budget
    01-encounter-progression.md  /skill:design-game-encounters — objectives, waves, caps
    02-stage-world-authoring.md  /skill:author-game-levels — the deterministic profile
    03-procedural-layout.md      WFC / BSP / Dungeon Architect output → curated obstacles
    04-stage-dressing-assets.md  props, landmarks, skybox, provenance gate
    05-vfx-and-budget.md         /skill:create-game-vfx → /skill:optimize-threejs-games
    06-regression-and-proof.md   node --test gates + /skill:test-playable-web-games
    07-release.md                /skill:ship-web-games
    10-presentation-cue-spec.md          /skill:game-vfx — pool budget, lifetime, reduced motion
    11-arrival-choreography.md           abreast / encircle / emerge / skydrop, sim + entry split
    12-impact-and-knockback-feel.md      knockback, flash, camera impulse, AoE burst
    13-motion-source-and-retarget.md     previs/mocap → Blender retarget → audit gate
    14-runtime-vfx-implementation.md     /skill:create-game-vfx + /skill:threejs-shaders
    15-camera-and-cinematic.md           zoom clamp, pitch floor, intro dolly, cutscene ledgers
    16-audio-cue-layer.md                /skill:build-game-audio-feedback + ElevenLabs batch
    17-frame-budget-recovery.md          /skill:optimize-threejs-games + optimize-web-animations
    18-presentation-regression-proof.md  the ten-suite gate, baseline 129/129/0
    19-presentation-capture-and-release.md  /skill:browser-video-recording, /skill:video-shotcraft
    20-encounter-pattern-brief.md        /skill:design-game-encounters — answers before numbers
    21-enemy-behaviour-policy.md         /skill:tune-enemy-ai — policy, pattern, counter-response
    22-difficulty-budget.md              the clear-budget derivation; no authored body counts
    23-doctrine-and-catalog-write.md     STAGE_WAVE_DOCTRINE / TACTICS / ENCOUNTER_ROUTES only
    24-system-variation-package.md       Abyss Depth packages and the 20 variation axes
    25-balance-simulation.md             determinism, termination, playtime, attributed deltas
    26-gate-evaluation.md                evaluate-stage1b-gates thresholds, PASS/FAIL/BLOCKED
    27-monotony-and-variation-scan.md    /skill:pattern-detection — shared-axis + escalation ratchet
    28-systems-regression-proof.md       the systems suite list and the recorded baseline
    29-balance-changelog-and-release.md  /skill:build-game-changelog → /skill:ship-web-games
  drafts/                        unproven prompts; never cited as an approved gate
```

## Order of use

**Stage map.** Run `00 → 07` for a new stage; enter at the matching step for a revision. `00` and
`01` decide numbers, `02` writes them into code, `03`–`05` dress and pay back the frame budget, `06`
is the only step that can call the work correct, `07` deploys it.

**Presentation.** Run `10 → 19` for a new effect, motion or arrival pattern; enter at the matching
step for a revision. `10` fixes the contract before any asset exists, `11`–`12` change what the
player sees happen to bodies, `13`–`16` build the visual, camera and audio layers, `17` pays the
frame budget back, `18` is the only step that can call the work correct, `19` records it.

The two tracks share a boundary: `05` owns the *stage ambient* VFX cue authored in
`stage-world-catalog.js`; `10`–`14` own *event-driven transient* cues in the renderer pool. A change
that touches both runs `05` and `14` and reconciles the frame budget once, in `17`.

**Systems, difficulty and variation.** Run `20 → 29` for a new stage pattern, a difficulty retune or
a variation swap; enter at the matching step for a revision. `20`–`21` decide *behaviour* in
language, `22` derives the numbers from the clear budget, `23` writes them into the data ledger,
`24` changes rules rather than stats, `25`–`27` measure (simulation, gates, monotony), `28` is the
only step that can call the work correct, `29` records and ships it.

This track meets the stage-map track at the catalog: `01` owns the *geometry* of an encounter
(objective points, approach paths, caps) and `22`–`23` own the *pressure* running through it (hold,
rhythm, class rotation, budget). A change that moves both runs `01` and `23`, and re-derives the
wave plan once, in `23`.

Skipping `06`, `18` or `28` is not allowed. `CLAUDE.md` §6: "Numbers gate everything. No adjective
passes a gate."

## Authoring rules for this library

1. **Every constraint is a number or an identifier.** No prompt may say "readable" or "balanced"
   without the measurement that decides it.
2. **Constraints are copied from executable truth**, i.e. `validateProfile` in
   `stage-world-catalog.js`, the exported budgets in `battle-realtime-three.js`, and the `tests/`
   suites — not from prose. When the validator or a budget changes, the prompt changes in the same
   commit and gets a `VERSIONS.md` row.
3. **Placeholders use `${name}`** and are listed at the top of each prompt.
4. **C.R.A.F.T. structure** (CONTEXT / ROLE / ACTION / FORMAT / TARGET AUDIENCE) plus two
   repository-specific sections: `HARD CONSTRAINTS` and `DONE WHEN`.
5. **Engine lock.** This is a Three.js + WebGL browser game. A prompt that assumes Unity, Unreal,
   Addressables, GAS, or C# is wrong for this repository — see `CLAUDE.md` §2. Dungeon Architect,
   Houdini, UE5 PCG, Unity/Godot MCP, Unity VFX Graph, Unreal Niagara and EmberGen are usable **only
   as offline generators whose output is transcribed into `stage-world-catalog.js` by hand or baked
   into a GLB / flipbook texture**.
6. **The simulation boundary is a hard constraint, not a style note.** Presentation reads snapshots
   and never writes back or alters `getRunDigest()` inputs. Any prompt whose step changes spawn
   placement, RNG draw order, or an emitted payload says so explicitly and requires the digest to be
   reported before and after.
7. **Difficulty is a response-type count, not an HP multiplier.** A prompt that argues difficulty
   from `scale` alone is wrong for this repository. The clear-budget derivation
   (`PLAYER_BASELINE_DPS 2250`, `WAVE_PRESSURE_BP 5500`, the 100 % → 130 % ramp) and the variation
   ratchet (`scripts/scan-stage-variation.mjs`: ≤ 0.20 shared axes, non-falling response types) are
   the executable form of that rule.

## Provenance

- Structure and the C.R.A.F.T. skeleton: [prompts.chat](https://github.com/f/prompts.chat) —
  prompt data is CC0 1.0. Seed rows are captured verbatim in
  `raw/sources/2026-07-31-stage-map-composition-skill-catalog.md`.
- Stage-map skill roster and tool catalog: same capture, sections 1–7.
- Presentation skill roster and tool catalog:
  `raw/sources/2026-07-31-game-vfx-animation-cinematic-skill-catalog.md`, sections 1–9 plus the
  knockback / arrival-choreography addendum.
- Repository invariants: `stage-world-catalog.js`, `defense-catalog.js`, `battle-realtime-three.js`,
  `defense-run-simulation.js`, `tests/**`, `CLAUDE.md`.
- Systems / difficulty / variation skill roster:
  `raw/sources/2026-07-31-stage-pattern-difficulty-system-variation-skill-catalog.md`, sections 1–9.
- Synthesis: `wiki/concepts/stage-map-composition-pipeline.md` (band layout),
  `wiki/concepts/runtime-presentation-and-arrival-choreography.md` (presentation contract) and
  `wiki/concepts/stage-difficulty-and-system-variation.md` (clear budget, doctrine, gates, the 20
  variation axes).
