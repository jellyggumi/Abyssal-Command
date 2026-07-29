# Motion Bench FBX Analysis — Final Report

**Status:** Complete (42/42 files analyzed, 9/9 overrides locked)  
**Date:** 2026-07-29  
**Tool:** Blender 5.2 headless import (fbx-audit-report-FULL-OBSERVED.json)  
**Contract:** DEF-* 24-bone rotation-only export

---

## Executive Summary

All 42 FBX files in `assets/motion/bench/` are **Mixamo rigs** (mixamorig armature, 37 bones each) at **24 fps**.

**Classification [OBSERVED]:**
- **19 travel clips:** Root motion detected (Walking, Running, Crawling, Dodging, Body Block, etc.)
- **23 in-place clips:** Hips XZ ≈ 0 (Idle variants, combat, defense)
- **9 override slots:** Locked to runtime (see EXPORT-CONTRACT-LOCKED.md)
- **24 compatible meshes:** All confirmed in runtime target list

---

## Key Findings

### 1. Retarget Compatibility

**Confirmed [OBSERVED]:**
- All 42 files have Mixamo 37-bone armature with mixamorig:Hips as root
- 22 bones map cleanly to DEF-* 24-bone skeleton (spine, arms, legs)
- 15 source bones unmapped (finger end-effectors, toe ends, IK chains)
- No prop-specific dependencies in override slots

**Status:** ✓ All files structurally compatible. No blockers to retarget.

### 2. Frame Budget Compliance

All 9 override clips verified within action-pipeline.json budgets:

| Action | File | Frames | Duration | Budget | Status |
|--------|------|--------|----------|--------|--------|
| idle | Unarmed Idle.fbx | 47 | 1.917s | ≤ 2.0s | ✓ |
| move | Walking.fbx | 34 | 1.375s | ≤ 2.0s | ✓ |
| run | Running.fbx | 31 | 1.25s | ≤ 2.0s | ✓ |
| hit | Standing React Small From Left.fbx | 19 | 0.75s | ≤ 1.5s | ✓ |
| bighit | Receive Uppercut To The Face.fbx | 31 | 1.25s | ≤ 2.0s | ✓ |
| attack | Punching.fbx | 31 | 1.25s | ≤ 2.0s | ✓ |
| critical | Illegal Elbow Punch.fbx | 55 | 2.25s | ≤ 3.0s | ✓ |
| avoid | Dodging.fbx | 40 | 1.625s | ≤ 2.0s | ✓ |
| defence | Body Block.fbx | 83 | 3.417s | ≤ 4.0s | ✓ |

**Note:** Frame ranges from Blender import. Duration = (frameEnd - frameStart) / 24 fps.

### 3. Root Motion Classification [OBSERVED]

**19 Travel Clips (Hips XZ > 0.1m):**
- Backwards Rifle Walk
- Catwalk Idle To Twist R
- Catwalk Walk Forward HighKnees
- Catwalk Walk Start Turn 180 Right
- Change Direction
- Crawling
- Draw Sword 1
- Drop Kick
- Grabbing Ammo
- Great Sword Blocking
- Jump Attack
- Right Turn W_ Briefcase
- Run To Stop
- Running
- Start Walking
- Sword And Shield Block
- Sword And Shield Jump
- Unarmed Turn Left 90
- Walking

**23 In-Place Clips (Hips XZ ≈ 0):**
- Block With Rifle
- Body Block
- Dodging
- Double Dagger Stab
- Firing Rifle
- Great Sword Slash
- Idle
- Illegal Elbow Punch
- Jog In Circle
- Left Turn 45
- Look Over Shoulder
- Opening
- Punching Bag
- Punching
- Receive Uppercut To The Face
- Rifle Aiming Idle
- Shooting Arrow
- Standing 2H Magic Attack 01
- Standing Block React Large
- Standing Idle 03
- Standing React Small From Left
- Standing Torch Jump
- Unarmed Idle

**Strategy:** Travel clips: extract Hips XZ to separate channel, zero in export. In-place clips: export as-is (rotation-only). All clips: verify root XZ ≈ 0 post-bake.

### 4. Nine Override Slots (LOCKED)

All slots are **weapon-less, rotation-only**, sourced from bench:

| Slot | File | Frames | Hips XZ | Status |
|------|------|--------|---------|--------|
| idle | Unarmed Idle.fbx | 1–47 | ≈ 0 | ✓ |
| move | Walking.fbx | 1–34 | 145.08m (travel) | ✓ |
| run | Running.fbx | 1–31 | 350.09m (travel) | ✓ |
| hit | Standing React Small From Left.fbx | 1–19 | ≈ 0 | ✓ |
| bighit | Receive Uppercut To The Face.fbx | 1–31 | ≈ 0 | ✓ |
| attack | Punching.fbx | 1–31 | ≈ 0 | ✓ |
| critical | Illegal Elbow Punch.fbx | 1–55 | ≈ 0 | ✓ |
| avoid | Dodging.fbx | 1–40 | ≈ 0 | ✓ |
| defence | Body Block.fbx | 1–83 | ≈ 0 | ✓ |

**Note:** Hips XZ values from fbx-audit-report-FULL-OBSERVED.json. Move/run carry travel distance (recorded in manifest for gameplay); exported rotation-only (XZ removed).

### 5. Fallback Actions (Authored Separately)

Not from bench; retained as base rig defaults:
- **die** — Authored collapse sequence
- **show** — Authored introduction/reveal
- **attack_melee** — Authored unarmed strike fallback
- **attack_ranged** — Authored ranged stance fallback

---

## Bone Mapping (22 → 22)

### Spine Chain (6 DEF bones)

```
DEF-spine ← mixamorig:Hips (copy rotation; XZ translation extracted/zeroed)
DEF-spine.001 ← mixamorig:Spine
DEF-spine.002 ← mixamorig:Spine1
DEF-spine.003 ← mixamorig:Spine2 (note: copies mixamorig:Spine2 at weight 1.0)
DEF-spine.004 ← mixamorig:Neck
DEF-spine.005 ← mixamorig:Head
```

### Arms (8 DEF bones)

```
DEF-shoulder.L ← mixamorig:LeftShoulder
DEF-upper_arm.L ← mixamorig:LeftArm
DEF-forearm.L ← mixamorig:LeftForeArm
DEF-hand.L ← mixamorig:LeftHand

DEF-shoulder.R ← mixamorig:RightShoulder
DEF-upper_arm.R ← mixamorig:RightArm
DEF-forearm.R ← mixamorig:RightForeArm
DEF-hand.R ← mixamorig:RightHand
```

### Legs (8 DEF bones)

```
DEF-thigh.L ← mixamorig:LeftUpLeg
DEF-shin.L ← mixamorig:LeftLeg
DEF-foot.L ← mixamorig:LeftFoot
DEF-toe.L ← mixamorig:LeftToeBase

DEF-thigh.R ← mixamorig:RightUpLeg
DEF-shin.R ← mixamorig:RightLeg
DEF-foot.R ← mixamorig:RightFoot
DEF-toe.R ← mixamorig:RightToeBase
```

### Unmapped Source Bones (15)

Dropped during export (end-effectors, IK chains, prop rigs):
- mixamorig:HeadTop_End
- mixamorig:LeftToe_End
- mixamorig:RightToe_End
- mixamorig:RightHandIndex[1-4]
- mixamorig:RightHandPinky[1-4]
- mixamorig:RightHandThumb[1-4]

### Unmapped Target Bones (2)

Omitted from animation (retain target rest pose, not animated):
- DEF-pelvis.L
- DEF-pelvis.R

---

## Export Requirements

### Rotation-Only Encoding

**EXPORT:**
- ✓ Quaternion rotation tracks (all 22 mapped bones)
- ✓ Deterministic LINEAR sampling for smooth motion
- ✓ STEP sampling for explicit keyframe timing (optional, per clip)

**DO NOT EXPORT:**
- ✗ Position tracks (stripped; gameplay owns root XZ)
- ✗ Scale tracks (stripped; uniform bone sizes)
- ✗ Vertical translation (Y-bob removed in this pack)

**Rationale:** Per-mesh rest pose differences; prevent simulation root duplication.

### Duration Calculation

```
durationSeconds = (frameEnd - frameStart) / 24
```

**Example:** Illegal Elbow Punch (frames 1–55, 24 fps)
```
durationSeconds = (55 - 1) / 24 = 2.25 seconds
```

All 9 slots recorded in manifest.json with exact durations.

---

## Blender Workflow

1. **Import:** `scripts/retarget-ingame-motion-blender.py` loads Mixamo FBX
2. **Constraint:** Apply copy-rotation constraints (22 mappings) from Mixamo → DEF-*
3. **Measure:** Record Hips XZ displacement (classify travel vs. in-place)
4. **Extract:** For travel clips, save Hips XZ curve to temp storage
5. **Zero:** Set Hips.location.{x,z} = 0 for all frames, keyframe
6. **Bake:** `bpy.ops.nla.bake()` constraints to DEF-* keyframes
7. **Clean:** Delete all constraints (export clean)
8. **Export:** GLB with rotation-only AnimationClips

---

## Manifest & Runtime Binding

**Manifest:** `assets/motion/ingame/manifest.json`
- schemaVersion: 1
- generatedBy: scripts/retarget-ingame-motion-blender.py
- generatedAt: 2026-07-29T03:43:32.453194+00:00
- 9 clipOverrides locked (exact frame ranges, durations, SHA256 hashes)
- 24 compatibleMeshes confirmed
- rightsReceipt: rotation-only-overlay-retarget-computed-with-audit-frame-ranges
- runtimeEligible: true

**Runtime:** Three.js AnimationMixer merging external rotation-only clips onto character instances. Mixer applies quaternion transforms to each bone; gameplay owns position/scale.

---

## Test Validation

**tests/ingame-motion-pack.test.mjs:**
- Load manifest.json
- Verify 9 slots present with correct frame ranges
- Import external GLB (rotation-only pack)
- Bind to 24 compatible rigs (scout, commander, warden, etc.)
- Play critical (Illegal Elbow Punch) override
- Assert: quaternion values change, root position unchanged, no NaN/Infinity
- Screenshot: `runtime-attack-three-rigs.png` (visual proof)

---

## Status

**Complete.** All 42 files analyzed. 9 overrides locked. Manifest finalized. Ready for Phase 2a test (retarget validation) and batch export.

**Files changed:** README.md, this document, ROOT-MOTION-AUDIT.md, BONE-MAPPING-MATRIX.md, EXPORT-CONTRACT-LOCKED.md, MAIN-OVERRIDE-ASSIGNMENTS.md, DISCOVERY-SUMMARY.md.

**Files removed:** COMPLETION-BLOCKER.md (obsolete; all blocking metrics now observed).

**Files preserved:** PARSER-DEFECT-LOG.md, fbx-audit-report-FULL-OBSERVED.json, all PNG/JSON artifacts.
