# Per-Stage Camera Framing Addendum

```yaml
run_id: 20260730-three-stage-camera-gaps
status: "[CURRENT] — per-stage framing contract addendum"
applies_to: camera-vfx-direction.md §3
authorities:
  - battle-realtime-three.js#CAMERA_PHASE_TIERS
  - battle-realtime-three.js#resolveCameraPhase
  - stage-world-catalog.js#STAGE_WORLD_PROFILES
scope: zoom range, occluding props, pitch minimums, extraction framing
```

## 1. Per-stage zoom range

Global clamp `10.4–41.6` is the baseline. Each stage narrows its effective manual range so the camera stays inside the corridor's readable envelope:

| Stage | Corridor | Manual zoom clamp | Reason |
|-------|----------|-------------------|--------|
| `cinder-span` | 1200 (wide) | `10.4–41.6` (full range) | Open bridge — no occlusion risk at any zoom |
| `abyss-chancel` | 1000 (medium) | `12.0–36.0` | Colonnade props create occlusion below 12; wider than 36 loses side-ingress context |
| `echo-throne` | 1100 (wide) | `10.4–41.6` (full range) | Axial court stays readable at extremes |

When `resolveCameraPhase()` returns a tier target outside the stage's manual clamp, the tier target wins (gameplay readability > user preference). Manual zoom ±10% layer applies inside the stage clamp.

## 2. Per-stage occlusion policy

Tall props must never hide the commander, active objective marker, ingress arrow, or extraction point. When a prop would naturally occlude these at the current camera position:

| Stage | Occluding props | Policy |
|-------|----------------|--------|
| `cinder-span` | Ash bridge pylons, forge structure | Pylons are narrow — camera orbits around them (no fade). Forge may be faded to `0.15` opacity when camera is within `5` units and line-of-sight to commander is blocked. |
| `abyss-chancel` | Apse colonnades, nave pillars (8+ props, three approaches) | Colonnade pillars wider than `1.2` units — automatically fade to `0.10` opacity when they intersect the camera-to-commander segment. At intro `96` ticks the apse must not occlude the contest point. |
| `echo-throne` | Fracture walls, dais fragments | Fracture walls are dressing only and fade to `0.15` when intersecting camera visibility. Dais fragments never fade (they are landmark geometry). |

**Implementation**: `battle-realtime-three.js` already has `ensureStageTerrain()` and stage-specific terrain loading. Add an `occlusionFadeProps` array per stage returned by `resolveStageTerrain()`. During `updateCamera()`, perform camera-to-prop ray check; set `material.opacity` with `0.35s` transition.

Reduced motion: skip the opacity animation — snap to target opacity immediately or keep opaque (the geometry is still readable; only the fade animation is removed).

## 3. Stage-specific pitch minimum

Baseline pitch clamp is `30°–85°` with authored baseline `55°`. Confined stages raise the minimum at certain phases:

| Stage | Phase | Pitch minimum | Reason |
|-------|-------|---------------|--------|
| `abyss-chancel` | `DESCENT`/`SKIRMISH` | `35°` | Colonnade overhangs block view below 35° |
| `abyss-chancel` | `BIGWAVE`/`FINALE` | `30°` (baseline) | Pulled-back camera clears overhangs naturally |
| `cinder-span` | All | `30°` (baseline) | Open bridge has no overhead occlusion |
| `echo-throne` | All | `30°` (baseline) | Axial court has no overhead occlusion |

**Implementation**: `stageFogRange()` already returns stage-specific fog. Add parallel `stagePitchRange(stageId, phase)` returning `{ min, max, baseline }`. `updateCamera()` clamps pitch per-stage after the generic `30°–85°` check.

## 4. Boss/extraction phase look-at offset per stage

Currently all phases aim at `(snapshot.commander.x, 0, snapshot.commander.y)`. For boss and extraction phases, add a stage-specific look-at offset to keep the boss threat silhouette and extraction point in the same frame:

| Stage | Phase | Look-at offset | Effect |
|-------|-------|----------------|--------|
| `cinder-span` | `FINALE` | `offsetY +1000` (up-corridor) | Boss forge + extraction bind both visible |
| `abyss-chancel` | `FINALE` | `offsetY -800` (down-nave) | Keep transept boss path + chancel bind readable |
| `echo-throne` | `FINALE` | zero offset | Axial court already frames dais + throne-bind |
| Any | post-extraction | smooth return to commander | After extraction window opens, ease look target back to commander over `90` ticks |

**Implementation**: `resolveCameraPhase()` already returns the phase string. In `updateCamera()`, after computing `cameraTarget`, apply the stage-specific offset only when the resolved phase is `FINALE`. The offset is additive to the existing commander-follow logic.

## 5. Verification

Existing `tests/camera-slice-contract.test.mjs` covers tier targets, fog clarity, transitions, frame independence, and corner clamping.

**[OBSERVED] 2026-07-30 — §§1, 3, 4 are implemented and verified.**
`battle-realtime-three.js` exports `STAGE_CAMERA_ENVELOPES`, `stageZoomClamp()`,
`stagePitchRange()`, and `stageFinaleLookOffset()`; `updateCamera()` caches
`cameraStageId`/`cameraPhase` and applies the pitch floor plus the FINALE
look-at offset, while `orbit()`/`zoom()` clamp against the same stage envelope.

`tests/stage-framing-and-motion-profile.test.mjs` (7/7 pass,
`node --test tests/stage-framing-and-motion-profile.test.mjs`):

```
cam-per-stage-zoom   — every stage clamp stays inside the global 10.4–41.6 envelope,
                       abyss-chancel narrows to 12.0–36.0, and a FINALE tier target
                       outside that clamp still wins
cam-per-stage-pitch  — abyss-chancel DESCENT/SKIRMISH floor is >= 35°, every other
                       stage/phase keeps the 30° baseline, and orbit() reports the cut
cam-boss-look-offset — FINALE look target carries exactly the authored stage offset;
                       non-FINALE phases and echo-throne carry zero
```

**[TARGET] §2 (occlusion fade) is not implemented.** It needs a per-stage
`occlusionFadeProps` registry on `resolveStageTerrain()` that does not exist yet;
`cam-per-stage-fade` stays unwritten until that registry lands. The post-extraction
90-tick look-target ease-back in §4 is likewise deferred — the current implementation
applies the FINALE offset for the whole phase.
