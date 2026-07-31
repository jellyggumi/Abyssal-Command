# Prompt versions

One row per approved prompt version. A prompt that encodes a repository invariant must be revised in
the same commit that changes the invariant.

| Prompt | Version | Date | Source | Bound to | Change |
|---|---|---|---|---|---|
| `approved/00-stage-map-blueprint.md` | v1 | 2026-07-31 | custom + prompts.chat C.R.A.F.T. | `stage-world-catalog.js` `validateProfile`, `ARENA` in `defense-catalog.js` | Initial. Band grid derived from the three shipped profiles. |
| `approved/01-encounter-progression.md` | v1 | 2026-07-31 | `/skill:design-game-encounters` + C.R.A.F.T. | `STAGE_ENCOUNTER_ROUTES`, `STAGE_TACTICS`, `STAGES` | Initial. Objective/wave/cap envelope from the three shipped stages. |
| `approved/02-stage-world-authoring.md` | v1 | 2026-07-31 | `/skill:author-game-levels` + C.R.A.F.T. | `validateProfile` lines 382-563 of `stage-world-catalog.js` | Initial. All 24 validator clauses inlined. |
| `approved/03-procedural-layout.md` | v1 | 2026-07-31 | prompts.chat `Act as a Procedural Content Generator` (CC0) | `validateProfile` obstacle/route clearance clauses | Initial. Retargeted from infinite 2D caves to a bounded, hand-curated 24000x12000 plane. |
| `approved/04-stage-dressing-assets.md` | v1 | 2026-07-31 | catalog §5 + `CLAUDE.md` §3 | prop count 8-14, provenance rule | Initial. |
| `approved/05-vfx-and-budget.md` | v1 | 2026-07-31 | `/skill:create-game-vfx`, `/skill:optimize-threejs-games` | `vfxCue` path/clip contract | Initial. |
| `approved/06-regression-and-proof.md` | v1 | 2026-07-31 | `/skill:test-playable-web-games` + `CLAUDE.md` §6 | `tests/**/*.test.mjs` | Initial. Records the 2026-07-31 baseline, including the pre-existing `stage-wave-doctrine` failure. |
| `approved/07-release.md` | v1 | 2026-07-31 | `/skill:ship-web-games` | `CLAUDE.md` §5 git safety | Initial. |
| `RUNBOOK.md` | v1 | 2026-07-31 | derived from code | `STAGES`, `STAGE_TACTICS`, `STAGE_ENCOUNTER_ROUTES`, `STAGE_WORLD_PROFILES`, `STAGE_STORIES` | Initial. Resolves every `${placeholder}` for stages 1-3; cross-checked against the catalogs by script on 2026-07-31. |
| `approved/10-presentation-cue-spec.md` | v1 | 2026-07-31 | `/skill:game-vfx` + C.R.A.F.T. | `MAX_VISUAL_EFFECTS`, `NEW_VFX_FAMILY_LIVE_BUDGET`, `CRITICAL_VFX_EVENT_TYPES`, `resolveVfxLifetimeTicks` | Initial. Pool 40, families drop 3 / buff 2 / spawn 4 / deform 1, 88 event ids, 17 exempt by type. |
| `approved/11-arrival-choreography.md` | v1 | 2026-07-31 | user addendum + `/skill:design-game-encounters` | `spawnPoint()`, the single `ENEMY_SPAWNED` emit site, `isCriticalVfxEvent`, `motionProfileFor` | Initial. Records that `grade`/`telegraphTicks` are never emitted, so the graded-arrival path is unreachable in production. |
| `approved/12-impact-and-knockback-feel.md` | v1 | 2026-07-31 | user addendum + `/skill:create-game-vfx` | `IMPACT_KNOCKBACK_*`, `IMPACT_SHAKE_*`, `AOE_BURST_BUDGET`, `TARGET_HEIGHT` | Initial. Records that knockback exists only as a renderer offset. |
| `approved/13-motion-source-and-retarget.md` | v1 | 2026-07-31 | `/skill:video-motion-previs`, `/skill:threejs-animation` | `tests/ingame-motion-pack.test.mjs` rosters, `motionProfileFor` bounds | Initial. 11 promoted GLBs, 11 canonical actions, 21 overlay sources, rotation-only. |
| `approved/14-runtime-vfx-implementation.md` | v1 | 2026-07-31 | `/skill:create-game-vfx`, `/skill:threejs-shaders` | stage `vfxCues` path/clip contract, `spawnVfx`, `effectAnchor` | Initial. 44 px readability floor carried from the drop-beacon derivation. |
| `approved/15-camera-and-cinematic.md` | v1 | 2026-07-31 | `/skill:video-production`, `/skill:video-shotcraft` | `STAGE_CAMERA_ENVELOPES`, `CAMERA_PHASE_TIERS`, `presentation.cinematic.intro` | Initial. Intro dolly 90 / 96 / 102 ticks. |
| `approved/16-audio-cue-layer.md` | v1 | 2026-07-31 | `/skill:build-game-audio-feedback` | `AUDIO_CUES` (15 cues), `eventCue`, `scripts/generate-defense-audio.mjs` | Initial. Procedural oscillators remain the authoritative fallback. |
| `approved/17-frame-budget-recovery.md` | v1 | 2026-07-31 | `/skill:optimize-threejs-games`, `/skill:optimize-web-animations` | `MAX_ANIMATION_TICK_DELTA`, `AOE_BURST_BUDGET`, the three quality tiers | Initial. |
| `approved/18-presentation-regression-proof.md` | v1 | 2026-07-31 | `/skill:test-playable-web-games` + `CLAUDE.md` §6 | the ten presentation suites | Initial. Records the 2026-07-31 baseline: 129 tests / 129 pass / 0 fail / 19836 ms. |
| `approved/19-presentation-capture-and-release.md` | v1 | 2026-07-31 | `/skill:browser-video-recording`, `/skill:video-shotcraft` | `CLAUDE.md` §5 git safety, `design/assets/cinematic/*.csv` | Initial. |
| `approved/20-encounter-pattern-brief.md` | v1 | 2026-07-31 | `/skill:design-game-encounters` + C.R.A.F.T. | `STAGE_WAVE_DOCTRINE`, `STAGE_ENCOUNTER_ROUTES`, `ENEMIES`, `ATTACK_PATTERNS` | Initial. Envelope from the three shipped stages after the `echo-throne` retune. |
| `approved/21-enemy-behaviour-policy.md` | v1 | 2026-07-31 | `/skill:tune-enemy-ai` | `ENEMY_POLICIES`, the seeded policy pool in `buildWaveSchedule`, `ATTACK_PATTERNS`, `AI_RESPONSE_PATTERNS`, `GATE_PRESSURE_RELEASE_LEAD`, `MIDBOSS_PROFILE` | Initial. Records that pinning a normal wave's policy deletes seeded behaviours from that stage. |
| `approved/22-difficulty-budget.md` | v1 | 2026-07-31 | `/skill:game-studio-harness` (numeric-balance role) | `PLAYER_BASELINE_DPS 2250`, `WAVE_PRESSURE_BP 5500`, `WAVE_KIND_PROFILE`, `MIDBOSS_PROFILE`, the ≤2.0× clear-budget cap | Initial. Body counts are derived, never authored. |
| `approved/23-doctrine-and-catalog-write.md` | v1 | 2026-07-31 | `/skill:author-game-levels` | `stage()` validation, `buildDoctrineWavePlan` direction/approach rule, quest-point coupling, pinned digest fixtures | Initial. |
| `approved/24-system-variation-package.md` | v1 | 2026-07-31 | `/skill:game-studio-harness` (freshness gate) | `ABYSS_DEPTH_PACKAGES` 1–3, `ABYSS_DEPTH_MAX 3`, the read-without-rolling RNG contract | Initial. |
| `approved/25-balance-simulation.md` | v1 | 2026-07-31 | `/skill:data-analysis`, `/skill:ab-test-analysis` | `run-defense-balance-sim.mjs`, `measure-stage-playtime.mjs`, `run-stage1b-symmetric-trials.mjs` | Initial. Records the 2026-07-31 `HEAD` baseline (outcomes, ticks, playtime medians and ranges). |
| `approved/26-gate-evaluation.md` | v1 | 2026-07-31 | `/skill:game-studio-harness` (8 numeric gates) | `evaluate-stage1b-gates.mjs` thresholds for G2, G3, G5, G6, G7, G8 and both readiness artifacts | Initial. Thresholds transcribed verbatim from the evaluator. |
| `approved/27-monotony-and-variation-scan.md` | v1 | 2026-07-31 | `/skill:pattern-detection` | `scripts/scan-stage-variation.mjs` (20 axes, `MAX_SHARED_AXIS_RATIO 0.2`), `tests/stage-variation-doctrine.test.mjs` | Initial. Ratchet set at the shipped worst pair 3/20 = 0.15 plus one axis of headroom. |
| `approved/28-systems-regression-proof.md` | v1 | 2026-07-31 | `/skill:test-playable-web-games` + `CLAUDE.md` §6 | the systems suite list | Initial. Records the 2026-07-31 baseline including two failures isolated to another session's in-flight simulation work. |
| `approved/29-balance-changelog-and-release.md` | v1 | 2026-07-31 | `/skill:build-game-changelog`, `/skill:ship-web-games` | `RULES_VERSION`, `CLAUDE.md` §5 git safety | Initial. |
| `scripts/scan-stage-variation.mjs` | v1 | 2026-07-31 | derived from the catalogs | `STAGE_WAVE_DOCTRINE`, `STAGE_TACTICS`, `STAGE_ENCOUNTER_ROUTES`, `ENEMIES` | Initial. 20 axes; the axis count is asserted by `tests/stage-variation-doctrine.test.mjs`. |

## Known limitations

- The band grid in `00` is descriptive of the three shipped stages, not a proof that a fourth stage
  must use it. A stage that departs from it must still clear `validateProfile` and every suite in
  `06`; departures are recorded here.
- `03` cannot emit runtime data directly. WFC/BSP/Dungeon Architect output is a *proposal*; only a
  human-curated transcription into `stage-world-catalog.js` is authoritative.
- `RUNBOOK.md` is a transcription of code. When a catalog value changes, re-run the cross-check
  script in `log.md` (2026-07-31 runbook entry) rather than editing the table from memory.
- `04` cannot promote generated meshes on its own. `CLAUDE.md` §3 requires an adjacent
  `.provenance.json` with `runtimeEligible: false` and an explicit audit before runtime use.
- `10`–`19` restate renderer budgets that are **exported** (`MAX_VISUAL_EFFECTS`,
  `MOTION_PROFILE_REFERENCE_HEIGHT`, `AOE_BURST_BUDGET`, `STAGE_CAMERA_ENVELOPES`,
  `CAMERA_PHASE_TIERS`) and some that are **not** (`NEW_VFX_FAMILY_LIVE_BUDGET`,
  `IMPACT_KNOCKBACK_*`, `VFX_LIFETIME_TICKS`, `MAX_DROP_BEACONS`, `TARGET_HEIGHT`). The unexported
  ones are copied values and will drift silently if the renderer changes without a `VERSIONS.md`
  row. Prefer exporting a budget over restating it, as `MAX_VISUAL_EFFECTS` already is.
- `11` cannot be executed without a decision only the simulation owner can make: whether an arrival
  formation may draw from the seeded RNG. `defense-run-simulation.js:1518` makes one extra `rngNext`
  a whole-run behaviour change, so the prompt requires a before/after `getRunDigest()` instead of
  assuming either answer.
- `11` also depends on a payload that does not exist yet. `ENEMY_SPAWNED` emits neither `grade` nor
  `telegraphTicks`, so `isCriticalVfxEvent()`'s SHADOW branch and the 60-tick arrival telegraph are
  unreachable today. The prompt treats emitting them as required work, not as a precondition.
- `12` cannot deliver authoritative knockback. There is none in `defense-run-simulation.js`, and
  adding it is a digest-visible simulation change requiring separate approval.
- `18`'s baseline covers ten suites, not the full glob. **Corrected 2026-07-31:**
  `tests/stage-wave-doctrine.test.mjs` no longer carries a pre-existing failure — re-measured this
  session at 10 tests / 10 pass / 0 fail / 22885 ms. The earlier row in `06` and `18` describing it
  as a known map-track failure is stale and must not be carried forward as evidence.
- `20`–`29` restate catalog constants that are **exported** (`PLAYER_BASELINE_DPS`,
  `WAVE_PRESSURE_BP`, `WAVE_KIND_PROFILE`, `MIDBOSS_PROFILE`, `STAGE_WAVE_DOCTRINE`,
  `ABYSS_DEPTH_PACKAGES`, `ABYSS_DEPTH_MAX`) and some that are **not** (the seeded policy pool and
  `GATE_PRESSURE_RELEASE_LEAD`, both private to `defense-run-simulation.js`). The unexported ones
  are copied values and will drift silently without a `VERSIONS.md` row.
- `26` cannot be completed by any agent. G7 and G8 require ten human participants, consent, screen
  recordings with sha256 and observer signatures; the evaluator rejects `synthetic_controller: true`.
  An agent may only regenerate the machine evidence and report `BLOCKED`.
- `27`'s response-type metric counts identifiers, not skill. It is a floor against repetition and
  cannot tell a genuinely new answer from a renamed one.
- `28`'s recorded baseline was taken while another session was editing `defense-run-simulation.js`
  (arrival choreography, prompt `11`). The two `defense-expansion-contract` failures it records are
  theirs, proven by sandbox isolation, and remain open at the time of writing. The pinned
  `echo-throne/12/500 bare` digest fixture was re-baselined once the concurrent work was shown
  digest-neutral at every pinned checkpoint, so the delta was attributable to the doctrine retune
  alone; `tests/defense-run-simulation.test.mjs` is 40/40/0.
