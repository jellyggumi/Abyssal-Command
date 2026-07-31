# Runtime presentation and arrival choreography

The executable contract behind every visual, motion, camera and audio decision in this runtime,
plus the one place it is currently thin: how enemies arrive and how contact reads.

Sources: [[wiki/sources/2026-07-31-game-vfx-animation-cinematic-skill-catalog]].
Sibling: [[wiki/concepts/stage-map-composition-pipeline]], [[wiki/concepts/motion-generation-for-runtime-rigs]],
[[wiki/concepts/attack-pattern-presets-and-ai-response]].

---

## 1. The boundary that decides everything

`CLAUDE.md` §2: **presentation may read simulation snapshots and must never write back, and must
never alter `getRunDigest()` inputs.** Every rule below follows from that one line.

| Question | Owner | Consequence |
|---|---|---|
| Where does an enemy spawn? | simulation | changes the digest → seeded-RNG-order rules apply |
| Which route does it walk? | simulation | authored `route`/waypoints, deterministic |
| How does its body *appear* there? | renderer | free to change, provable by contract test only |
| How far is it pushed on a hit? | renderer | render-space offset, reset every frame |
| Does the hit land? | simulation | never a presentation concern |

The practical split for "come at the player in a circle instead of a line": the **positions** are
simulation work under the RNG-order rule; the **rise, the drop, the dust, the flash** are renderer
work under the pool budget. Mixing them is the defect this page exists to prevent.

## 2. The transient VFX pool — the hardest budget in the runtime

All values from `battle-realtime-three.js`, verified by `tests/combat-presentation-contract.test.mjs`.

| Constant | Value | Meaning |
|---|---|---|
| `MAX_VISUAL_EFFECTS` (exported) | **40** | total live transient records; overflow evicts the first non-critical record |
| `NEW_VFX_FAMILY_LIVE_BUDGET` | `drop 3 / buff 2 / spawn 4 / deform 1` | per-family live cap *inside* the 40 |
| `VFX_MODELS` | **88** event ids | every id that can spawn a cue |
| `CRITICAL_VFX_EVENT_TYPES` | **17** | eviction-exempt by type |
| `isCriticalVfxEvent()` | 17 + 2 payload-conditional | `ENEMY_SPAWNED` when `grade === "SHADOW"`; `GIMMICK_*` when class is `deformation` or `hazard` |
| `MAX_VISUAL_EVENT_KEYS` | 128 | de-dupe key ring |
| `MAX_DROP_BEACONS` | 8 | beacons are pool-free scenery, equal to `MAX_FIELD_DROPS` |
| `DROP_BEACON_WARN_TICKS` | 180 | cross-lane: HUD, audio and VFX warn on the same tick |

**`spawn` family cap is 4.** That number is the ceiling on any "twelve enemies erupt around the
player" idea expressed as twelve cues. Choreography for more than four simultaneous arrivals has to
be one cue describing the formation, or per-actor entry *animation* (which costs no pool slot),
not N cues.

### Lifetime resolution order

`resolveVfxLifetimeTicks()` — payload beats table, always:

1. `BOSS_ATTACK_TELEGRAPHED` → `event.windupTicks`, fallback `45`
2. `ENEMY_SPAWNED` → `event.telegraphTicks`, fallback `60` when `grade === "SHADOW"` else `30`
3. `GIMMICK_ARMED` → `event.telegraphTicks`, fallback `180`
4. `SKILL_CAST` → `SKILL_VFX_LIFETIME_TICKS[semanticVfxId]`
5. anything else → `VFX_LIFETIME_TICKS[type]`, global fallback `30`

Authored telegraph tiers: deformation 180 / narrowing gate 120 / progress-ring and mirror 90 /
hazard 60; arrivals 30 / 60 / 90 by grade. The simulation fires `TRIGGERED` at exactly
`ARMED + telegraphTicks`, so reading the field is what keeps cue and rule in agreement.

### Stage ambient cues

One `vfxCues` entry per stage profile, all three shipped stages identical in shape:

```
modelPath  assets/motion/stage-vfx/<effectId>.glb
clip       stage-vfx::<stageId>::loop::v01
qualityGroups { core: "vfx-core", detail: "vfx-detail", decor: "vfx-decor" }
reducedMotion "core-static"
placement  cinder-span 15400,6000 · abyss-chancel 14200,6000 · echo-throne 15400,6000
```

`applyStageVfxPolicy()` resolves quality to exactly one of `full` / `low` / `reduced-motion`;
`low` and `reduced-motion` both hide `detail` and `decor`, and `reduced-motion` additionally stops
the loop action. Reduced motion is a **supported mode with a static equivalent**, never a removal.

## 3. Contact feel — what currently exists

`battle-realtime-three.js:1054-1075`. This is the whole model.

| Constant | Value |
|---|---|
| `IMPACT_KNOCKBACK_MS` / `_HEAVY_MS` | 160 / 260 |
| `IMPACT_KNOCKBACK_DISTANCE` / `_HEAVY_DISTANCE` | 0.12 / 0.26 world units |
| `IMPACT_FLASH_PEAK` / `_HEAVY_PEAK` | 0.55 / heavy variant |
| `IMPACT_SHAKE_MS` / `_AMPLITUDE` / `_BOSS_AMPLITUDE` / `_MAX_AMPLITUDE` / `_FREQUENCY` | 220 / 0.07 / 0.13 / 0.13 / 38 |
| `AOE_BURST_BUDGET.full` | `ringSegments 48, arcSegments 12, maxArcs 6, core true` |
| `AOE_BURST_BUDGET.software` | `ringSegments 20, arcSegments 6, maxArcs 0, core false` |
| AoE camera impulse admission | `density > 0.25` and not reduced motion |

Knockback is a **render-space offset along the attacker→target axis**; `updateActorFollow()` pulls
the root back to the authoritative position every frame, which is why 0.26 is the heavy ceiling —
it stays well under one actor width, so the offset can never be mistaken for a position.
`grep -n knockback defense-run-simulation.js` returns nothing: there is no authoritative knockback,
and adding one is a simulation change with a digest consequence, not a feel tweak.

`IMPACT_FEEDBACK_SOURCES` maps only **contact** events. Windup/fire events are deliberately absent
because they are not authoritative hits. A new feel effect keyed off a windup event is a bug.

## 4. Motion profile and camera — silhouette-driven, not per-kind

```
TARGET_HEIGHT   commander 1.55 · boss 4.5 · elite 2.2 · enemy 1.7 · companion 1.45 · stageNpc 1.8 · pickup 0.7
MOTION_PROFILE_REFERENCE_HEIGHT = TARGET_HEIGHT.enemy = 1.7
locomotionRate bounds 0.7–1.2   exponent -0.5
oneShotRate    bounds 0.72–1.15 exponent -0.35
reactionArcScale bounds 0.6–1.25 exponent -0.5
```

Bigger silhouettes read heavier: slower stride, longer windup, shorter relative reaction arc.
This is applied as `timeScale`, so **no clip is re-authored and determinism is untouched** — the
correct lever for making a sky-dropped heavy read heavy.

Hit reactions resolve as `HIT_REACTION_DIRECTIONS = front · right · back · left`, named for where the
blow **came from**, in the target's own frame, with a deterministic fallback to the flat clip.

Camera:

```
CAMERA_PHASES  DESCENT SKIRMISH SURGE MIDBOSS BIGWAVE FINALE
CAMERA_PHASE_TIERS zoomFactor 20.8 → 26 → 33 → 38 → 41.5 → 41.5
CAMERA_TIER_TRANSITION_TICKS 90   CAMERA_POSITION_LAMBDA 6   CAMERA_LOOK_LAMBDA 11
global zoom envelope 10.4–41.6
per stage  cinder-span 10.4–41.6 · abyss-chancel 12–36 (pitch floor 35° in DESCENT/SKIRMISH) · echo-throne 10.4–41.6
finaleLookOffset  cinder-span y+1000 · abyss-chancel y-800 · echo-throne 0
stage intro dolly durationTicks  cinder-span 90 · abyss-chancel 96 · echo-throne 102
```

`startStageIntro()` hard-returns under reduced motion, and `setReducedMotion(true)` cancels an
active intro without mutating or reviving snapshots.

## 5. The arrival gap

Today's arrival model, from `defense-run-simulation.js`:

```
spawnPoint(direction, laneOffset)
  W  (default) x 500,   y gateY + laneOffset
  NW           x 1000,  y 1000 + |laneOffset|
  SW           x 1000,  y height - 1000 - |laneOffset|
  N            x 6000 + laneOffset, y 500
  S            x 6000 + laneOffset, y height - 500
elite        fixed x 14000, y gateY
laneJitter   ±400 (seededVariation default)
multi-spawn  laneOffset + spawnIndex * 200
ARENA        24000 x 12000, gateX 22000, gateY 6000
```

Every non-elite body enters from an **arena edge**, and same-wave bodies are separated by 200 units
along one lane. That is the serial column: same edge, same route, 200 apart, walking in.

Two hooks already exist and are unused:

- **`grade` is never emitted.** `ENEMY_SPAWNED` has exactly one emit site
  (`defense-run-simulation.js:1036`) and its payload is
  `entityId, enemyType, elite, midboss, midbossId, spawnDirection, routeId, route, objectiveId, waveIndex`.
  No `grade`, no `telegraphTicks`. So `isCriticalVfxEvent()`'s SHADOW branch never returns true, and
  every arrival cue resolves to the 30-tick fallback and stays evictable. The renderer is already
  written for graded arrivals; the simulation simply never says which grade.
- **`ENEMY_SPAWNED` already reuses a stage cue** (`echo-throne-fracture-echo.glb`) rather than a
  dedicated arrival asset. The comment at `battle-realtime-three.js:398` names the intended
  dedicated GLBs — `drop-beacon-pillar / arrival-breach-gate / deform-fracture-seam` — as absent.

### The four requested patterns, decomposed

| Pattern | Simulation change | Renderer change | Pool cost |
|---|---|---|---|
| Parallel / abreast | spawn N bodies on one perpendicular offset row instead of `spawnIndex * 200` along the lane | none required | 1 cue for the row |
| Circular / encircling entry | ring of spawn points at radius R around the target, angle from the seeded RNG | per-actor entry yaw facing inward | 1 cue for the ring |
| Emergence around the player | spawn positions inside the player's local radius; body is authoritative from tick 0 | rise from below ground over the telegraph window; ground-crack decal | 1 cue, ≤4 live in `spawn` family |
| Sky drop | same as emergence positionally | fall + landing impact; reuses the AoE burst ring and the camera impulse | 1 cue + impact reuse |

Emergence and sky-drop are the same simulation change (spawn near the target) with different
renderer entry animations. Both **must** telegraph: an enemy that materialises inside the player's
attack range with no arming window is an unfair hit, which is why `telegraphTicks` matters more here
than anywhere else in the pool.

### The determinism trap

`defense-run-simulation.js:1518` states it plainly: the RNG is positional, and **one extra
`rngNext` shifts wave composition, timing jitter, lane offset, spawn direction and policy** for the
entire run. Any arrival formation that draws a random angle or radius changes every seeded run that
follows it. The consequences are a changed `getRunDigest()`, and `tests/defense-run-simulation.test.mjs`
plus the stage-doctrine suites re-baselining. There is no version of this work where the digest is
allowed to move silently.

## 6. Tool verdicts for this repository

| Tool / skill | Verdict |
|---|---|
| `/skill:game-vfx`, `/skill:create-game-vfx`, `/skill:threejs-shaders`, `/skill:threejs-animation` | **Directly usable.** Engine-correct, and they author against the constants above. |
| `/skill:optimize-threejs-games`, `/skill:optimize-web-animations` | **Directly usable** as the budget-recovery half of every cue. |
| `/skill:design-action-combat` | **Usable for timing only.** startup/active/recovery must be expressed as tick counts the simulation already owns, never as clip length. |
| `/skill:video-motion-previs`, `/skill:motion-previs-studio`, Cascadeur, Rokoko, Mixamo, DeepMotion | **Offline source only.** Output is concept-lane, needs `.provenance.json` + audit before `assets/motion/ingame/`. |
| EmberGen, Houdini, ComfyUI/AnimateDiff, Runway/Kling/Luma/Pika/Sora | **Offline bake only.** Value is a flipbook texture or a previs plate, never a runtime dependency. |
| Unity VFX Graph, Unreal Niagara | **Engine-locked out** (`CLAUDE.md` §2). Reference for layered-timeline structure, nothing more. |
| `/skill:dalamud-vfx-editor` | **Reference only.** FFXIV formats; nothing here can load them. |
| `/skill:build-game-audio-feedback` | **Usable**, but generation stays on `scripts/generate-defense-audio.mjs`. |

## 7. The ten-step pipeline

The catalog's eight steps, split where this repository's boundary forced a split, and each bound to
a prompt in `prompts/approved/`:

| # | Step | Prompt |
|---|---|---|
| 10 | Cue specification before any asset exists | `10-presentation-cue-spec.md` |
| 11 | Arrival and engagement choreography (sim placement + entry presentation) | `11-arrival-choreography.md` |
| 12 | Contact feel — knockback, flash, shake, AoE burst | `12-impact-and-knockback-feel.md` |
| 13 | Motion source acquisition and retarget | `13-motion-source-and-retarget.md` |
| 14 | Runtime VFX implementation | `14-runtime-vfx-implementation.md` |
| 15 | Camera framing and cinematic | `15-camera-and-cinematic.md` |
| 16 | Audio cue layer | `16-audio-cue-layer.md` |
| 17 | Frame budget recovery | `17-frame-budget-recovery.md` |
| 18 | Regression proof | `18-presentation-regression-proof.md` |
| 19 | Capture and release | `19-presentation-capture-and-release.md` |

Step 18 is the only step that can call the work correct. `CLAUDE.md` §6.

## 8. Related

- [[wiki/concepts/motion-generation-for-runtime-rigs]] — the retarget pipeline steps 13 depends on
- [[wiki/concepts/attack-pattern-presets-and-ai-response]] — the three-phase step timing steps 11–12 present
- [[wiki/concepts/stage-map-composition-pipeline]] — the map track (`prompts/approved/00`–`07`)
