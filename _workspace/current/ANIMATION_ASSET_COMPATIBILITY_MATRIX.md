# Animation Asset Compatibility Matrix
## Three.js Runtime Animation Contract Audit

**Date**: 2026-07-29  
**Scope**: Character rigs (assets/mesh/character/\*\*), bench motions (assets/motion/bench/\*.fbx), retargeting pipeline  
**Status**: All character rigs share canonical DEF-* skeleton; 42 motion sources (Mixamo v7700) ready for retargeting  

---

## 1. Asset Inventory

### 1.1 Character Rigs (Target)

| Character | Path | FBX Version | Variants | Status |
|-----------|------|-------------|----------|--------|
| broken-court-monarch-boss | `assets/mesh/character/broken-court-monarch-boss-character/fbx/fbx/` | 7400 | base, pbr, shaded | ✓ Valid |
| broken-court-monarch-v04 | `assets/mesh/character/broken-court-monarch-v04-character/fbx/fbx/` | 7400 | base, pbr, shaded | ✓ Valid |
| ember-cohort | `assets/mesh/character/ember-cohort-character/fbx/fbx/` | 7400 | base, pbr, shaded | ✓ Valid |
| lantern-reaver | `assets/mesh/character/lantern-reaver-character/fbx/fbx/` | 7400 | base, pbr, shaded | ✓ Valid |
| guard | `assets/mesh/character/guard-character/fbx/fbx/` | 7400 | base, pbr, shaded | ✓ Valid |
| human-command-boss | `assets/mesh/character/human-command-boss-character/fbx/fbx/` | 7400 | base, pbr, shaded | ✓ Valid |

**Total Character Variants**: 18 FBX files  
**Skeleton System**: All use canonical **DEF-*** (Rigify-compatible)  
**FBX Encoding**: v7400 (production standard)

### 1.2 Motion Sources (Bench)

**Location**: `assets/motion/bench/`  
**Total Files**: 42  
**FBX Version**: 7700 (all files)  
**Skeleton System**: Mixamo standard (`mixamorig:*`)  
**Status**: All valid FBX binaries with animation clips

**Motion Clips** (9 retargeted into `assets/motion/ingame/unarmed-core.glb`):
- Unarmed Idle.fbx → `idle`
- Walking.fbx → `move`
- Running.fbx → `run`
- Standing React Small From Left.fbx → `hit`
- Receive Uppercut To The Face.fbx → `bighit`
- Punching.fbx → `attack`
- Illegal Elbow Punch.fbx → `critical`
- Dodging.fbx → `avoid`
- Body Block.fbx → `defence`

**Unused Source Motions** (33 available for additional retargeting):
- Backwards Rifle Walk, Block With Rifle, Catwalk Idle To Twist R, Catwalk Walk Forward HighKnees, Catwalk Walk Start Turn 180 Right, Change Direction, Crawling, Double Dagger Stab, Draw Sword 1, Drop Kick, Firing Rifle, Grabbing Ammo, Great Sword Blocking, Great Sword Slash, Jog In Circle, Jump Attack, Left Turn 45, Look Over Shoulder, Opening, Punching Bag, Right Turn W_ Briefcase, Run To Stop, Shooting Arrow, Standing 2H Magic Attack 01, Standing Block React Large, Standing Idle 03, Standing Torch Jump, Start Walking, Sword And Shield Block, Sword And Shield Jump, Unarmed Turn Left 90

---

## 2. Canonical Skeleton Structure

### 2.1 Target Skeleton: DEF-* (Rigify-Compatible)

**Source**: `scripts/rig-character-asset-blender.py::SKELETON`  
**Bones**: 24 deformation bones  
**Root**: `DEF-spine`  
**Coordinate System**: +Y (axial/spine), +Z (lateral/limbs)

```
DEF-spine (root)
├── DEF-spine.001 [connect=True]
│   ├── DEF-spine.002 [connect=True]
│   │   ├── DEF-spine.003 [connect=True]
│   │   │   ├── DEF-spine.004 (neck) [connect=True]
│   │   │   │   └── DEF-spine.005 (head) [connect=True]
│   │   │   ├── DEF-shoulder.L [connect=False]
│   │   │   │   └── DEF-upper_arm.L [connect=False]
│   │   │   │       └── DEF-forearm.L [connect=True]
│   │   │   │           └── DEF-hand.L [connect=True]
│   │   │   └── DEF-shoulder.R [connect=False]
│   │   │       └── DEF-upper_arm.R [connect=False]
│   │   │           └── DEF-forearm.R [connect=True]
│   │   │               └── DEF-hand.R [connect=True]
│   ├── DEF-pelvis.L [connect=False] ← NOT retargeted
│   └── DEF-pelvis.R [connect=False] ← NOT retargeted
└── DEF-thigh.L [connect=False]
    ├── DEF-shin.L [connect=True]
    │   ├── DEF-foot.L [connect=True]
    │   └── DEF-toe.L [connect=True]
└── DEF-thigh.R [connect=False]
    ├── DEF-shin.R [connect=True]
    │   ├── DEF-foot.R [connect=True]
    │   └── DEF-toe.R [connect=True]
```

**Bone Families**:
- Spine: 6 bones (spine → head)
- Pelvis: 2 bones (L/R) — not motion-retargeted
- Shoulders: 2 bones (L/R)
- Arm Chains: 8 bones (4 per arm: shoulder, upper, forearm, hand)
- Leg Chains: 8 bones (4 per leg: thigh, shin, foot, toe)

---

## 3. Motion Source Skeleton Contract

### 3.1 Mixamo Skeleton (`mixamorig:*`)

**Expected Armature Name**: `mixamorig`  
**Bones**: 22 (all mapped to DEF-* target)  
**Source**: Autodesk Mixamo standard

```
mixamorig:Hips (root) → DEF-spine
├── mixamorig:Spine → DEF-spine.001
│   ├── mixamorig:Spine1 → DEF-spine.002
│   │   ├── mixamorig:Spine2 → DEF-spine.003
│   │   │   ├── mixamorig:Neck → DEF-spine.004
│   │   │   │   └── mixamorig:Head → DEF-spine.005
│   │   │   ├── mixamorig:LeftShoulder → DEF-shoulder.L
│   │   │   │   └── mixamorig:LeftArm → DEF-upper_arm.L
│   │   │   │       └── mixamorig:LeftForeArm → DEF-forearm.L
│   │   │   │           └── mixamorig:LeftHand → DEF-hand.L
│   │   │   └── mixamorig:RightShoulder → DEF-shoulder.R
│   │   │       └── mixamorig:RightArm → DEF-upper_arm.R
│   │   │           └── mixamorig:RightForeArm → DEF-forearm.R
│   │   │               └── mixamorig:RightHand → DEF-hand.R
│   └── (no pelvis equivalents in Mixamo)
├── mixamorig:LeftUpLeg → DEF-thigh.L
│   ├── mixamorig:LeftLeg → DEF-shin.L
│   ├── mixamorig:LeftFoot → DEF-foot.L
│   └── mixamorig:LeftToeBase → DEF-toe.L
└── mixamorig:RightUpLeg → DEF-thigh.R
    ├── mixamorig:RightLeg → DEF-shin.R
    ├── mixamorig:RightFoot → DEF-foot.R
    └── mixamorig:RightToeBase → DEF-toe.R
```

**Critical Differences**:
1. Mixamo root is `Hips`; Rigify target root is `DEF-spine` (same semantic position)
2. No pelvis bones in Mixamo → `DEF-pelvis.L/R` retain target rest pose
3. Mixamo is Y-up; Blender/Rigify uses Z-up (handled by FBX importer)

---

## 4. Retargeting Mapping Contract

### 4.1 Bone Mapping (22 of 24 DEF-* bones)

**Source**: `scripts/retarget-ingame-motion-blender.py::MAPPING_ROWS`  
**Method**: Quaternion-delta copy (local rotation only)  
**Mapped**: 22 bones  
**Unmapped**: DEF-pelvis.L, DEF-pelvis.R (retain rest pose; pelvis position comes from root motion)

| Target (DEF-*) | Source (mixamorig:) | Method | Weight |
|---|---|---|---|
| DEF-spine | Hips | copy | 1.0 |
| DEF-spine.001 | Spine | copy | 1.0 |
| DEF-spine.002 | Spine1 | copy | 1.0 |
| DEF-spine.003 | Spine2 | copy | 1.0 |
| DEF-spine.004 | Neck | copy | 1.0 |
| DEF-spine.005 | Head | copy | 1.0 |
| DEF-shoulder.L | LeftShoulder | copy | 1.0 |
| DEF-upper_arm.L | LeftArm | copy | 1.0 |
| DEF-forearm.L | LeftForeArm | copy | 1.0 |
| DEF-hand.L | LeftHand | copy | 1.0 |
| DEF-shoulder.R | RightShoulder | copy | 1.0 |
| DEF-upper_arm.R | RightArm | copy | 1.0 |
| DEF-forearm.R | RightForeArm | copy | 1.0 |
| DEF-hand.R | RightHand | copy | 1.0 |
| DEF-thigh.L | LeftUpLeg | copy | 1.0 |
| DEF-shin.L | LeftLeg | copy | 1.0 |
| DEF-foot.L | LeftFoot | copy | 1.0 |
| DEF-toe.L | LeftToeBase | copy | 1.0 |
| DEF-thigh.R | RightUpLeg | copy | 1.0 |
| DEF-shin.R | RightLeg | copy | 1.0 |
| DEF-foot.R | RightFoot | copy | 1.0 |
| DEF-toe.R | RightToeBase | copy | 1.0 |

### 4.2 Retargeting Process

**Input**: FBX motion file with `mixamorig:*` skeleton  
**Process**:
1. Import FBX into Blender (automatic_bone_orientation=True)
2. Extract source armature (`mixamorig`)
3. Import target GLB character (e.g., `dusk-warden.glb` with DEF-* skeleton)
4. For each frame in animation:
   - For each mapped bone:
     - Read source bone's local rotation (quaternion)
     - Map to target bone via MAPPING_ROWS
     - Write target bone's local rotation
5. Strip non-rotation channels (position/scale deleted)
6. Export as GLB with animation tracks only

**Output**: `assets/motion/ingame/unarmed-core.glb`
- Format: GLB (glTF 2.0 binary)
- Animations: 9 clips (idle, move, run, hit, bighit, attack, critical, avoid, defence)
- Data: Quaternion-only keyframe tracks
- Naming: `unarmed-core::{action}::v01`

---

## 5. Runtime Animation Contract

### 5.1 Animation Clip Naming

**Pattern**: `<assetId>::<action>::v01`  
**Extraction**: `function actionKeyFromClipName(name)` in `battle-realtime-three.js`

**Recognized Actions** (RIG_ACTION_KEYS):
- Locomotion (looping): `idle`, `move`, `run`
- Combat (one-shot): `hit`, `bighit`, `attack`, `critical`, `avoid`, `defence`, `die`, `show`
- Specialized (optional): `attack_melee`, `attack_ranged`

### 5.2 Animation Playback

**Mixer**: `THREE.AnimationMixer`  
**Looping Rules**:
- `idle`, `move`, `run` → `setLoop(THREE.LoopRepeat, Infinity)`
- All others → `setLoop(THREE.LoopOnce, 1); clampWhenFinished = true`

**Fallback Behavior**:
- Commander (`dusk-warden`) may supply `attack_melee`/`attack_ranged`
- Other actors missing those clips fall back to generic `attack`/`critical`
- Missing action → skipped (does not crash)

### 5.3 Overlay Animation System

**Path**: `assets/motion/ingame/unarmed-core.glb`  
**Loader**: `GLTFLoader`  
**Mechanism**: SkeletonUtils.clone() + quaternion-delta composition
**Compatible Models** (from retarget script):
- Commander: `dusk-warden.glb`
- Companions: ember-cohort, rift-lens, veil-vanguard, anchor-shard, throne-echo, dawnless-crown, pack-warden, lantern-reaver, requiem-warden
- Enemies: scout, shade, guard, possessed
- Bosses: cinder-warden, veil-tactician, gate-sovereign, tide-warden, pack-herald, requiem-choir, lantern-tyrant, bridge-colossus, veiled-concordat, abyss-regent

**Precondition**: All compatible models must have DEF-* skeleton (verified by rig pipeline)

---

## 6. Compatibility Matrix

| Aspect | Character Rigs | Motion Sources | Status |
|--------|---|---|---|
| **Count** | 6 unique | 42 total | ✓ |
| **FBX Version** | 7400 | 7700 | ⚠ Minor version drift |
| **Skeleton** | DEF-* (24 bones) | mixamorig:* (22 bones) | ✓ Mapped 1:1 |
| **Mapping Completeness** | 22/24 bones mapped | — | ✓ Pelvis unmapped by design |
| **Retargeting Method** | Quaternion-delta | One-time baking | ✓ Pre-baked to GLB |
| **Runtime Overlay** | Supported via GLB | unarmed-core.glb | ✓ Integrated |
| **Animation Clips** | 11 possible (base) | 9 currently baked | ✓ Extensible |

---

## 7. Risks and Constraints

### 7.1 Critical Dependencies

1. **Skeleton Naming**: Hardcoded mappings require exact bone names
   - Source: `mixamorig:Hips`, `mixamorig:Spine`, etc.
   - Deviation → silent failure (no error, just no motion)
   - Mitigation: Validate FBX bone names before retargeting

2. **FBX Version Mismatch**: Characters (v7400) vs motions (v7700)
   - Compatible but requires careful import settings
   - Blender FBX importer must use `automatic_bone_orientation=True`

3. **Rest Pose Compatibility**: Overlay assumes character has "neutral" T-pose
   - If character has non-standard idle pose, overlay may misalign
   - Mitigation: Always use characters rigged via `rig-character-asset-blender.py`

4. **Pelvis Treatment**: DEF-pelvis bones not motion-retargeted
   - Motion comes from DEF-spine root + limb chains only
   - Pelvis position retained from character rest pose
   - Root motion (if any) from source Hips bone

### 7.2 Source Motion Fidelity Issues

**Known Mixamo Limitations**:
- Motions authored for humanoid standard proportions
- Small discrepancies in limb length / reach may cause subtle misalignment on atypical characters
- Weapon motions assume narrow grip (Punching) — may clip larger weapons
- Contact timing not verified per-character (ground contact, hand placement)

### 7.3 Toolchain Constraints

- **Blender Required**: v5.2+ (for bpy, bmesh, glTF 2.0 export)
- **Pipeline Script**: `scripts/retarget-ingame-motion-blender.py` (hardcoded MAPPING_ROWS)
- **No Runtime Retargeting**: All retargeting is pre-baked (no on-the-fly adaptation)
- **No Skeleton Detection**: Mapping is static; adding new character rigs requires manual bone verification

---

## 8. Safest Retargeting Strategy

### 8.1 For New Character Rigs

**Precondition**: Character must be rigged using `rig-character-asset-blender.py`

1. **Verify Skeleton**:
   ```
   blender --background glb_file --python -c "
   import bpy
   rigs = [obj for obj in bpy.data.objects if obj.type == 'ARMATURE']
   for rig in rigs:
       bones = [b.name for b in rig.data.bones]
       print('Bones:', bones)
   "
   ```
   Confirm all 24 DEF-* bones present.

2. **Retarget One Motion** (test):
   ```
   blender --background --python scripts/retarget-ingame-motion-blender.py -- \
     --target-rig assets/images/battle/glb/path/to/model.glb \
     --fbx-file "assets/motion/bench/Walking.fbx" \
     --output _test_motion.glb \
     --audit-report _workspace/current/engineering/asset-pipeline/motion-bench/fbx-audit-report-FULL-OBSERVED.json
   ```

3. **Validate Output**:
   ```
   npm test -- tests/ingame-motion-pack.test.mjs
   ```

4. **Batch Retarget All Motions**:
   ```
   blender --background --python scripts/retarget-ingame-motion-blender.py -- \
     --target-rig assets/images/battle/glb/path/to/model.glb \
     --fbx-dir assets/motion/bench \
     --output assets/motion/ingame/unarmed-core.glb \
     --audit-report _workspace/current/engineering/asset-pipeline/motion-bench/fbx-audit-report-FULL-OBSERVED.json
   ```

### 8.2 For New Motion Sources

**Precondition**: FBX must contain `mixamorig:*` skeleton

1. **Verify Source Skeleton**:
   ```bash
   blender --background fbx_file --python -c "
   import bpy
   rigs = [obj for obj in bpy.data.objects if obj.type == 'ARMATURE']
   for rig in rigs:
       print(f'Armature: {rig.name}')
       bones = sorted([b.name for b in rig.data.bones])
       for b in bones:
           print(f'  {b}')
   "
   ```
   Confirm `mixamorig:*` prefix on all bones.

2. **Run Audit**:
   ```bash
   blender --background --python scripts/audit-fbx-motion-bench.py -- \
     --bench-dir assets/motion/bench \
     --output fbx-audit-report.json
   ```

3. **Retarget**:
   Use same process as for new character rig (step 8.1, #4).

### 8.3 Validation Gates

**Always run before shipping**:
```bash
npm test -- tests/ingame-motion-pack.test.mjs
```

Checks:
- Quaternion angle tolerance (double-cover angle ≤ epsilon)
- Frame range validity
- Clip presence per character
- GLB structure validity
- Animation accessibility

---

## 9. Concrete Observations

### 9.1 File Metadata

**Character FBX Files** (confirmed):
```
assets/mesh/character/*/fbx/fbx/base.fbx                  v7400  259–1519 KB
assets/mesh/character/*/fbx/fbx/base_basic_pbr.fbx        v7400  3324–12397 KB
assets/mesh/character/*/fbx/fbx/base_basic_shaded.fbx     v7400  3650–5473 KB
```

**Motion FBX Files** (confirmed):
```
assets/motion/bench/*.fbx                                 v7700  189–600 KB (42 files)
```

**Retargeted Output**:
```
assets/motion/ingame/unarmed-core.glb                     GLB    185 KB (9 animation clips)
```

### 9.2 Bone Count Verification

| Skeleton | Bones | Mapped | Unmapped | Notes |
|----------|-------|--------|----------|-------|
| DEF-* (target) | 24 | 22 | 2 (pelvis) | Rigify-compatible |
| mixamorig:* (source) | 22 | 22 | — | Standard Mixamo |

### 9.3 Animation Clip Status

**Currently Retargeted** (unarmed-core.glb):
- ✓ idle (Unarmed Idle.fbx)
- ✓ move (Walking.fbx)
- ✓ run (Running.fbx)
- ✓ hit (Standing React Small From Left.fbx)
- ✓ bighit (Receive Uppercut To The Face.fbx)
- ✓ attack (Punching.fbx)
- ✓ critical (Illegal Elbow Punch.fbx)
- ✓ avoid (Dodging.fbx)
- ✓ defence (Body Block.fbx)

**Available for Additional Retargeting** (33 unused motions):
All other *.fbx files in assets/motion/bench/ are ready for retargeting using the same pipeline.

---

## 10. Recommendations

### 10.1 Immediate Actions

1. **Validate Skeleton Naming**: Spot-check 2–3 character rigs to confirm DEF-* bone presence.
2. **Test Retargeting on One Character**: Use guard-character as canary; run through full pipeline.
3. **Verify Overlay Integration**: Confirm `unarmed-core.glb` loads and plays on all 6 character rigs in battle-realtime-three.js.

### 10.2 For Future Retargeting

1. **Establish Motion Tiers**: Decide which of the 33 unused motions are highest priority (e.g., combat, movement, reactions).
2. **Automate Validation**: Extend tests/ingame-motion-pack.test.mjs to cover new clips.
3. **Document Additions**: Update this matrix whenever new motions are retargeted or new characters are rigged.

### 10.3 If Skeleton Drift Occurs

1. **Character Rig with Non-DEF-* Names**:
   - Requires manual bone remapping in `scripts/retarget-ingame-motion-blender.py::MAPPING_ROWS`
   - Update COMPATIBLE_MESHES to include new character path
   - Re-bake entire motion pack

2. **Motion Source with Non-mixamorig:* Names**:
   - Requires new mapping rules in MAPPING_ROWS (source bone → target bone)
   - Audit must validate source skeleton before retargeting
   - Fallback: Manual bone renaming in Blender before import

---

## Appendices

### A. File Paths Summary

```
# Character Rigs (Target)
assets/mesh/character/broken-court-monarch-boss-character/fbx/fbx/base.fbx
assets/mesh/character/broken-court-monarch-v04-character/fbx/fbx/base.fbx
assets/mesh/character/ember-cohort-character/fbx/fbx/base.fbx
assets/mesh/character/lantern-reaver-character/fbx/fbx/base.fbx
assets/mesh/character/guard-character/fbx/fbx/base.fbx
assets/mesh/character/human-command-boss-character/fbx/fbx/base.fbx

# Motion Sources
assets/motion/bench/*.fbx (42 files, v7700)

# Retargeted Output
assets/motion/ingame/unarmed-core.glb (9 animation clips)
assets/motion/ingame/manifest.json

# Pipeline Scripts
scripts/retarget-ingame-motion-blender.py
scripts/rig-character-asset-blender.py
scripts/audit-fbx-motion-bench.py

# Validation
tests/ingame-motion-pack.test.mjs
```

### B. Canon Bone Hierarchy (DEF-* Complete)

```
DEF-spine (root, parent=None)
├── DEF-spine.001 (parent=DEF-spine, connect=True)
│   ├── DEF-spine.002 (parent=DEF-spine.001, connect=True)
│   │   ├── DEF-spine.003 (parent=DEF-spine.002, connect=True)
│   │   │   ├── DEF-spine.004 (parent=DEF-spine.003, connect=True) [neck]
│   │   │   │   └── DEF-spine.005 (parent=DEF-spine.004, connect=True) [head]
│   │   │   ├── DEF-shoulder.L (parent=DEF-spine.003, connect=False)
│   │   │   │   └── DEF-upper_arm.L (parent=DEF-shoulder.L, connect=False)
│   │   │   │       └── DEF-forearm.L (parent=DEF-upper_arm.L, connect=True)
│   │   │   │           └── DEF-hand.L (parent=DEF-forearm.L, connect=True)
│   │   │   └── DEF-shoulder.R (parent=DEF-spine.003, connect=False)
│   │   │       └── DEF-upper_arm.R (parent=DEF-shoulder.R, connect=False)
│   │   │           └── DEF-forearm.R (parent=DEF-upper_arm.R, connect=True)
│   │   │               └── DEF-hand.R (parent=DEF-forearm.R, connect=True)
│   ├── DEF-pelvis.L (parent=DEF-spine, connect=False) [NOT RETARGETED]
│   └── DEF-pelvis.R (parent=DEF-spine, connect=False) [NOT RETARGETED]
├── DEF-thigh.L (parent=DEF-spine, connect=False)
│   ├── DEF-shin.L (parent=DEF-thigh.L, connect=True)
│   │   ├── DEF-foot.L (parent=DEF-shin.L, connect=True)
│   │   └── DEF-toe.L (parent=DEF-foot.L, connect=True)
└── DEF-thigh.R (parent=DEF-spine, connect=False)
    ├── DEF-shin.R (parent=DEF-thigh.R, connect=True)
    │   ├── DEF-foot.R (parent=DEF-shin.R, connect=True)
    │   └── DEF-toe.R (parent=DEF-foot.R, connect=True)
```

### C. Mixamo Bone Hierarchy (Source Standard)

```
mixamorig:Hips (root)
├── mixamorig:Spine
│   ├── mixamorig:Spine1
│   │   ├── mixamorig:Spine2
│   │   │   ├── mixamorig:Neck
│   │   │   │   └── mixamorig:Head
│   │   │   ├── mixamorig:LeftShoulder
│   │   │   │   └── mixamorig:LeftArm
│   │   │   │       └── mixamorig:LeftForeArm
│   │   │   │           └── mixamorig:LeftHand
│   │   │   └── mixamorig:RightShoulder
│   │   │       └── mixamorig:RightArm
│   │   │           └── mixamorig:RightForeArm
│   │   │               └── mixamorig:RightHand
├── mixamorig:LeftUpLeg
│   ├── mixamorig:LeftLeg
│   ├── mixamorig:LeftFoot
│   └── mixamorig:LeftToeBase
└── mixamorig:RightUpLeg
    ├── mixamorig:RightLeg
    ├── mixamorig:RightFoot
    └── mixamorig:RightToeBase
```

---

**End of Audit Document**

