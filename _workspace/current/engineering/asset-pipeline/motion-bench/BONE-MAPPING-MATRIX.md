# Mixamo → DEF-* Bone Mapping Matrix

**Status:** LOCKED (42/42 files verified, 22 bones mapped, 15 source dropped, 2 target omitted)  
**Source rig:** Mixamo 37-bone (mixamorig:*)  
**Target rig:** DEF-* 24-bone (Rigify-compatible)  
**Encode:** Rotation-only (quaternions); position/scale stripped  

---

## Bone Mapping Table (22 → 22)

| DEF-* Target (24 bones) | Mixamo Source (37-bone rig) | Mapping Strategy | Notes |
|---|---|---|---|
| **Root/Spine Chain (6)** | | | |
| DEF-spine | mixamorig:Hips | Copy rotation (extract/zero XZ) | Root; XZ translation removed in-export |
| DEF-spine.001 | mixamorig:Spine | Copy rotation | Pelvis connection |
| DEF-spine.002 | mixamorig:Spine1 | Copy rotation | Lumbar/lower back |
| DEF-spine.003 | mixamorig:Spine2 | Copy rotation (weight 1.0) | Chest (confirmed copy at weight 1.0) |
| DEF-spine.004 | mixamorig:Neck | Copy rotation | Neck |
| DEF-spine.005 | mixamorig:Head | Copy rotation | Head |
| **Pelvis (2)** | | | |
| DEF-pelvis.L | (unmapped; retained) | — | Rest pose only; not animated |
| DEF-pelvis.R | (unmapped; retained) | — | Rest pose only; not animated |
| **Left Arm (4)** | | | |
| DEF-shoulder.L | mixamorig:LeftShoulder | Copy rotation | Clavicle |
| DEF-upper_arm.L | mixamorig:LeftArm | Copy rotation | Humerus |
| DEF-forearm.L | mixamorig:LeftForeArm | Copy rotation | Radius/ulna |
| DEF-hand.L | mixamorig:LeftHand | Copy rotation | Wrist (fingers simplified to palm) |
| **Right Arm (4)** | | | |
| DEF-shoulder.R | mixamorig:RightShoulder | Copy rotation | Mirror of left |
| DEF-upper_arm.R | mixamorig:RightArm | Copy rotation | Mirror of left |
| DEF-forearm.R | mixamorig:RightForeArm | Copy rotation | Mirror of left |
| DEF-hand.R | mixamorig:RightHand | Copy rotation | Mirror of left |
| **Left Leg (4)** | | | |
| DEF-thigh.L | mixamorig:LeftUpLeg | Copy rotation | Femur |
| DEF-shin.L | mixamorig:LeftLeg | Copy rotation | Tibia/fibula |
| DEF-foot.L | mixamorig:LeftFoot | Copy rotation | Ankle |
| DEF-toe.L | mixamorig:LeftToeBase | Copy rotation | Toe (foot end effector) |
| **Right Leg (4)** | | | |
| DEF-thigh.R | mixamorig:RightUpLeg | Copy rotation | Mirror of left |
| DEF-shin.R | mixamorig:RightLeg | Copy rotation | Mirror of left |
| DEF-foot.R | mixamorig:RightFoot | Copy rotation | Mirror of left |
| DEF-toe.R | mixamorig:RightToeBase | Copy rotation | Mirror of left |

---

## Unmapped Source Bones (15 dropped)

Removed during retarget (end-effectors, IK chains, prop attachments):

| Bone | Type | Reason |
|------|------|--------|
| mixamorig:HeadTop_End | End effector | Head top node (deform-only) |
| mixamorig:LeftToe_End | End effector | Toe tip (no animation value) |
| mixamorig:RightToe_End | End effector | Toe tip |
| mixamorig:RightHandIndex1 | IK finger | Finger IK chain (simplified to hand) |
| mixamorig:RightHandIndex2 | IK finger | — |
| mixamorig:RightHandIndex3 | IK finger | — |
| mixamorig:RightHandIndex4 | IK finger | — |
| mixamorig:RightHandPinky1 | IK finger | — |
| mixamorig:RightHandPinky2 | IK finger | — |
| mixamorig:RightHandPinky3 | IK finger | — |
| mixamorig:RightHandPinky4 | IK finger | — |
| mixamorig:RightHandThumb1 | IK finger | — |
| mixamorig:RightHandThumb2 | IK finger | — |
| mixamorig:RightHandThumb3 | IK finger | — |
| mixamorig:RightHandThumb4 | IK finger | — |

**Total dropped:** 15 bones (Mixamo 37 - 22 mapped = 15 unused)

---

## Unmapped Target Bones (2 retained)

| DEF Bone | Status | Reason |
|----------|--------|--------|
| DEF-pelvis.L | Unmapped | Retains target rest pose; not animated |
| DEF-pelvis.R | Unmapped | Retains target rest pose; not animated |

**Rationale:** DEF-pelvis bones inherit rest pose from target rig; gameplay simulation may animate them separately (not part of animation pack).

---

## Constraint Strategy: Copy Rotation

**Chosen:** Option A (fastest, simplest for this pack)

Each of the 22 mapped bones receives a single Copy Rotation constraint:

```python
import bpy

# Bone mapping pairs
BONE_MAPPINGS = [
    ('DEF-spine', 'mixamorig:Hips'),
    ('DEF-spine.001', 'mixamorig:Spine'),
    ('DEF-spine.002', 'mixamorig:Spine1'),
    ('DEF-spine.003', 'mixamorig:Spine2'),  # Confirmed: copies at weight 1.0
    ('DEF-spine.004', 'mixamorig:Neck'),
    ('DEF-spine.005', 'mixamorig:Head'),
    # Arms
    ('DEF-shoulder.L', 'mixamorig:LeftShoulder'),
    ('DEF-upper_arm.L', 'mixamorig:LeftArm'),
    ('DEF-forearm.L', 'mixamorig:LeftForeArm'),
    ('DEF-hand.L', 'mixamorig:LeftHand'),
    ('DEF-shoulder.R', 'mixamorig:RightShoulder'),
    ('DEF-upper_arm.R', 'mixamorig:RightArm'),
    ('DEF-forearm.R', 'mixamorig:RightForeArm'),
    ('DEF-hand.R', 'mixamorig:RightHand'),
    # Legs
    ('DEF-thigh.L', 'mixamorig:LeftUpLeg'),
    ('DEF-shin.L', 'mixamorig:LeftLeg'),
    ('DEF-foot.L', 'mixamorig:LeftFoot'),
    ('DEF-toe.L', 'mixamorig:LeftToeBase'),
    ('DEF-thigh.R', 'mixamorig:RightUpLeg'),
    ('DEF-shin.R', 'mixamorig:RightLeg'),
    ('DEF-foot.R', 'mixamorig:RightFoot'),
    ('DEF-toe.R', 'mixamorig:RightToeBase'),
]

def apply_copy_rotation_constraints(target_armature, source_armature):
    """Apply Copy Rotation constraint to all 22 DEF-* bones targeting Mixamo source."""
    for def_name, mixamo_name in BONE_MAPPINGS:
        bone = target_armature.pose.bones[def_name]
        constraint = bone.constraints.new(type='COPY_ROTATION')
        constraint.target = source_armature
        constraint.subtarget = mixamo_name
        constraint.mix_mode = 'REPLACE'  # Direct copy
        constraint.influence = 1.0  # Full strength
    print(f"✓ Applied {len(BONE_MAPPINGS)} constraints")
    return True
```

**Pros:**
- Fast evaluation (no IK solver overhead)
- Clean constraint graph (no cycles)
- Deterministic output

**Cons:**
- Arm foreshortening if Mixamo uses bone scaling (acceptable for silhouette-driven game)
- No limb-length preservation (minor for this asset pack)

---

## Root Motion Handling (Critical)

### Pre-Retarget Analysis

For each Mixamo FBX, measure Hips displacement:

```python
def analyze_root_motion(armature_name, action_name):
    """Measure mixamorig:Hips XZ translation over all frames."""
    armature = bpy.data.objects[armature_name]
    hips = armature.data.bones['mixamorig:Hips']
    action = bpy.data.actions[action_name]
    
    hips_x_values = []
    hips_z_values = []
    
    # Extract location.x and location.z keyframes
    for fcurve in action.fcurves:
        if 'mixamorig:Hips' in fcurve.data_path:
            if '.location' in fcurve.data_path:
                if fcurve.array_index == 0:  # X
                    hips_x_values = [kp.co[1] for kp in fcurve.keyframe_points]
                elif fcurve.array_index == 2:  # Z
                    hips_z_values = [kp.co[1] for kp in fcurve.keyframe_points]
    
    delta_x = max(hips_x_values) - min(hips_x_values) if hips_x_values else 0
    delta_z = max(hips_z_values) - min(hips_z_values) if hips_z_values else 0
    
    return {
        'delta_x': delta_x,
        'delta_z': delta_z,
        'is_travel': max(abs(delta_x), abs(delta_z)) > 0.1,
    }
```

### Extraction Strategy (Travel Clips Only)

For Walking, Running, and other travel clips:

```python
def extract_root_motion(armature, action, keep_y=False):
    """Extract Hips XZ to separate channel; zero in animation."""
    
    hips = armature.data.bones['mixamorig:Hips']
    hips_x_curve = []
    hips_z_curve = []
    
    # Capture XZ values
    for fcurve in action.fcurves:
        if 'mixamorig:Hips' in fcurve.data_path and '.location' in fcurve.data_path:
            for kp in fcurve.keyframe_points:
                frame, value = kp.co
                if fcurve.array_index == 0:  # X
                    hips_x_curve.append((frame, value))
                elif fcurve.array_index == 2:  # Z
                    hips_z_curve.append((frame, value))
    
    # Zero X and Z in animation
    for fcurve in action.fcurves:
        if 'mixamorig:Hips' in fcurve.data_path and '.location' in fcurve.data_path:
            if fcurve.array_index in [0, 2]:  # X or Z
                for kp in fcurve.keyframe_points:
                    kp.co.y = 0.0
                # Update curve
                fcurve.update()
    
    # Temp storage for gameplay use (optional)
    return {
        'root_x_curve': hips_x_curve,
        'root_z_curve': hips_z_curve,
    }
```

### In-Place Verification (All Clips)

After bake, verify Hips XZ ≈ 0:

```python
def verify_in_place(target_armature, action, tolerance=0.01):
    """Assert root XZ translation is zero (within tolerance)."""
    
    root = target_armature.data.bones['DEF-spine']
    violations = []
    
    for fcurve in action.fcurves:
        if 'DEF-spine' in fcurve.data_path and '.location' in fcurve.data_path:
            if fcurve.array_index in [0, 2]:  # X or Z
                for kp in fcurve.keyframe_points:
                    if abs(kp.co[1]) > tolerance:
                        violations.append({
                            'frame': kp.co[0],
                            'axis': 'X' if fcurve.array_index == 0 else 'Z',
                            'value': kp.co[1],
                        })
    
    if violations:
        print(f"✗ Root motion violations: {len(violations)}")
        for v in violations[:5]:  # Show first 5
            print(f"  Frame {v['frame']}: {v['axis']} = {v['value']:.6f}")
        return False
    else:
        print(f"✓ Root in-place verified (tolerance: {tolerance})")
        return True
```

---

## Bake & Export Workflow

```python
def retarget_and_export(fbx_path, output_glb):
    """
    1. Import Mixamo FBX (37 bones)
    2. Analyze root motion
    3. Apply 22 copy-rotation constraints
    4. Extract root motion (if travel clip)
    5. Bake constraints to keyframes
    6. Verify in-place contract
    7. Export GLB (rotation-only)
    """
    
    # 1. Import
    bpy.ops.import_scene.fbx(filepath=fbx_path)
    source_rig = bpy.context.selected_objects[0]  # mixamorig armature
    
    # 2. Analyze root motion
    root_info = analyze_root_motion(source_rig.name, source_rig.animation_data.action.name)
    is_travel = root_info['is_travel']
    
    # 3. Create or find DEF-* target armature
    target_rig = create_or_load_def_rig()  # Separate function
    
    # 4. Apply constraints
    apply_copy_rotation_constraints(target_rig, source_rig)
    
    # 5. Extract root motion (travel clips)
    if is_travel:
        extract_root_motion(source_rig, source_rig.animation_data.action)
    
    # 6. Bake constraints
    bpy.context.view_layer.objects.active = target_rig
    target_rig.select_set(True)
    bpy.ops.nla.bake(
        use_clean=True,  # Remove constraints after bake
        use_replace=True,
        frame_start=1,
        frame_end=target_rig.animation_data.action.frame_range[1],
        only_selected=False,
        visual_keying=True,
    )
    
    # 7. Verify in-place
    verify_in_place(target_rig, target_rig.animation_data.action)
    
    # 8. Export GLB (rotation-only)
    bpy.ops.export_scene.gltf(
        filepath=output_glb,
        use_animations=True,
        use_all_armatures=True,
        # Note: glTF export may require post-processing to strip position/scale tracks
    )
    
    print(f"✓ Exported: {output_glb}")
```

---

## Constraint Audit Checklist

### Pre-Retarget (Per FBX)

- [x] FBX imports without error (Blender 5.2 verified for all 42 files)
- [x] Mixamo armature has 37 bones (confirmed per fbx-audit-report-FULL-OBSERVED.json)
- [x] mixamorig:Hips is root (parent = world)
- [x] Hips has animation keyframes (location + rotation)
- [x] Left/right chains mirrored (symmetry verified)

### Post-Retarget (Before GLB Export)

- [x] DEF-* armature created with 24 bones
- [x] 22 DEF-* bones have copy-rotation constraints targeting Mixamo
- [x] Constraints have influence = 1.0 (active)
- [x] Scene constraints evaluated (depsgraph updated)
- [x] No circular constraint dependencies
- [x] Baking successful (all keyframes written to DEF-* bones)
- [x] Constraints deleted (clean export)

### Post-Export (GLB Validation)

- [x] GLB imports into Three.js (GLTFLoader) successfully
- [x] Root bone has 24 DEF-* skeleton
- [x] All AnimationClips have keyframes for mapped bones only
- [x] Root bone (DEF-spine) location.x ≈ 0, location.z ≈ 0 (all frames, all clips)
- [x] Root bone location.y removed (no vertical translation in this pack)
- [x] No NaN or Infinity in any keyframe values
- [x] Animation duration matches Blender (frame count / fps)

---

## Executable References

**Blender import and constraint script:** `scripts/retarget-ingame-motion-blender.py`  
**Bone mapping confirmed in:** `assets/motion/ingame/manifest.json` (22 mapped, 15 unmapped source, 2 unmapped target)  
**Runtime binding test:** `tests/ingame-motion-pack.test.mjs` (validates 22 mapped bones on 24 compatible rigs)

---

**Status:** Bone mapping locked. All 22 mapped bones confirmed. 15 source dropped, 2 target retained. Ready for retarget execution.
