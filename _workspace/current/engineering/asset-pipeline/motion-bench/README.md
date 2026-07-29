# Motion Bench FBX Analysis — Final Report

**Status:** ✓ COMPLETE (42/42 files analyzed, 9/9 overrides locked)  
**Date:** 2026-07-29  
**Audience:** Main, BlenderPipeline, RuntimeMotionTrace, MeshRigAudit

---

## Quick Summary

All **42 Mixamo FBX files** in `assets/motion/bench/` have been analyzed via Blender 5.2 import and classified against the **9-action runtime contract**.

| Metric | Value | Status |
|--------|-------|--------|
| **Total files** | 42 | ✓ All Mixamo (mixamorig:* armature, 37 bones) |
| **Source FPS** | 24 | ✓ All clips measured |
| **Travel clips** | 19 | ✓ Root motion extracted |
| **In-place clips** | 23 | ✓ Hips XZ verified ≈ 0 |
| **9-action overrides locked** | 9/9 | ✓ Finalized in `assets/motion/ingame/manifest.json` |
| **Target skeleton** | DEF-* (24 bones) | ✓ Mapped from Mixamo 37 bones |
| **Mapped source bones** | 22 | ✓ Confirmed |
| **Unmapped source bones** | 15 | ✓ Finger/toe end effectors, prop IK |
| **Mapped target bones** | 22 | ✓ Spine(6), arms(8), legs(8) |
| **Unmapped target bones** | 2 | ✓ DEF-pelvis.L/R (retain target rest) |
| **Synthesized target bones** | 0 | ✓ None required |
| **Compatible meshes** | 24 | ✓ All rigs confirmed |
| **Runtime fallback actions** | 4 | ✓ die, show, attack_melee, attack_ranged |

---

## Artifacts in This Directory

### Core Documents

1. **`MOTION-BENCH-ANALYSIS.md`**
   - Comprehensive analysis with observed Blender metrics
   - Sections: findings, travel/in-place classification, override decisions
   - Use: Strategic reference, constraint audit

2. **`ROOT-MOTION-AUDIT.md`**
   - Runtime contract: in-place animation requirement
   - Travel clip audit: 19 clips with XZ displacement measured
   - In-place verification: 23 clips with Hips XZ ≈ 0
   - Use: Retarget implementation, validation protocol

3. **`BONE-MAPPING-MATRIX.md`**
   - 22-bone mapping (Mixamo 37 → DEF-* 24)
   - Constraint strategies and bake templates
   - Root motion handling pseudocode
   - Constraint audit checklist
   - Use: Blender retarget scripting, QA validation

4. **`EXPORT-CONTRACT-LOCKED.md`**
   - 9 override slot assignments + frame ranges
   - Rotation-only export requirements
   - Manifest schema (locked)
   - Runtime integration (Three.js AnimationMixer)
   - Use: Final retarget validation, runtime binding

5. **`MAIN-OVERRIDE-ASSIGNMENTS.md`**
   - Authority declarations for 9 override slots
   - Prop dependency audit (all weapon-less)
   - Validation checklist per file
   - Use: Phase 2a test sign-off, retarget prioritization

6. **`DISCOVERY-SUMMARY.md`**
   - Blender integration findings
   - Retarget strategy (copy-rotation + bake)
   - Phase-by-phase execution plan
   - Known issues & mitigations
   - Use: Phase 2a test readiness, workflow documentation

### Data Artifacts

- **`fbx-audit-report-FULL-OBSERVED.json`** (43.6 KB)  
  Blender 5.2 headless import results: 42 files, 37 bones each, frame counts, FPS, bone names, travel classification

- **`42-FILE-INVENTORY.json`** (7.8 KB)  
  Machine-readable inventory (obsolete; superseded by manifest.json)

### Implementation References

- **`scripts/retarget-ingame-motion-blender.py`**  
  Blender script: import Mixamo FBX, apply copy-rotation constraints, bake, extract root motion, export GLB

- **`tests/ingame-motion-pack.test.mjs`**  
  Runtime validation: load manifest, verify 9 clips, bind to 24 compatible rigs, assert rotation-only tracks

- **`runtime-attack-three-rigs.png`**  
  Visual evidence: Three.js runtime with 3 rigs playing critical (Illegal Elbow Punch) override

### Preserved Files

- **`PARSER-DEFECT-LOG.md`** — Unchanged (documents binary FBX parser failure; Blender import is source of truth)

---

## Nine Override Slots (LOCKED)

All 9 slots use weapon-less Mixamo clips, rotation-only export, 24 fps source sampled deterministically:

| Action | Source File | Frames | Duration | Travel | Status |
|--------|---------|--------|----------|--------|--------|
| `idle` | Unarmed Idle.fbx | 1–47 | 1.917s | ≈ 0 | ✓ |
| `move` | Walking.fbx | 1–34 | 1.375s | 145.08m Z | ✓ |
| `run` | Running.fbx | 1–31 | 1.25s | 350.09m Z | ✓ |
| `hit` | Standing React Small From Left.fbx | 1–19 | 0.75s | ≈ 0 | ✓ |
| `bighit` | Receive Uppercut To The Face.fbx | 1–31 | 1.25s | ≈ 0 | ✓ |
| `attack` | Punching.fbx | 1–31 | 1.25s | ≈ 0 | ✓ |
| `critical` | Illegal Elbow Punch.fbx | 1–55 | 2.25s | ≈ 0 | ✓ |
| `avoid` | Dodging.fbx | 1–40 | 1.625s | ≈ 0 | ✓ |
| `defence` | Body Block.fbx | 1–83 | 3.417s | ≈ 0 | ✓ |

**Note:** Frame counts from Blender import (observed 24 fps). Duration = (frameEnd - frameStart) / 24.

---

## Bone Mapping Summary

### Mapped Bones (22 source → 22 target, rotation-only)

**Spine chain (6):** mixamorig:{Hips,Spine,Spine1,Spine2,Neck,Head} → DEF-{spine,spine.001-005}  
**Arms (8):** mixamorig:{L/R}{Shoulder,Arm,ForeArm,Hand} → DEF-{shoulder,upper_arm,forearm,hand}.L/R  
**Legs (8):** mixamorig:{L/R}{UpLeg,Leg,Foot,ToeBase} → DEF-{thigh,shin,foot,toe}.L/R  

Copy-rotation constraint (weight 1.0) applied to each mapped bone; constraints baked to keyframes before export.

### Unmapped Bones (15 source, 2 target)

**Source dropouts (15):** Finger ends {Index/Pinky/Thumb}[1-4], toe end, head top (end effectors, IK chains)  
**Target omissions (2):** DEF-pelvis.L/R retain target rest pose (not animated, owned by simulation)

---

## Runtime Contract

- **GLB format:** rotation-only; no position/scale tracks
- **Animation sampling:** LINEAR (rotation) for all clips, STEP (integer keyframes) for explicit timing
- **Compatible rigs:** 24 character meshes (scout, commander, warden, bridge-colossus, etc.)
- **Fallback actions:** die, show, attack_melee, attack_ranged (authored separately; not from bench)
- **Manifest:** `assets/motion/ingame/manifest.json` (schemaVersion 1, generated 2026-07-29)

---

## References

- **Source Manifest:** `assets/motion/ingame/manifest.json` (42/42 files imported, 9 overrides locked)
- **Blender Audit:** `fbx-audit-report-FULL-OBSERVED.json` (verified 24 fps, 37 bones, travel classification)
- **Retarget Script:** `scripts/retarget-ingame-motion-blender.py` (Blender constraint + bake implementation)
- **Runtime Test:** `tests/ingame-motion-pack.test.mjs` (Three.js AnimationMixer validation)
- **Visual Evidence:** `runtime-attack-three-rigs.png` (Three.js runtime with critical override playing)

---

**Status:** Ready for Phase 2a test and batch retarget. All 42 files analyzed. No blockers to retarget initiation.
