# Deformation Gate Contract

## Purpose
Validate that 24 runtime character GLBs can safely apply the shared 9-clip unarmed-core motion pack without deformation artifacts, rest pose misalignment, or vertex explosions.

## Input Assets

### Character GLBs (24 total)
- **Commander**: `dusk-warden.glb` (1)
- **Companions**: 9 characters (ember-cohort, rift-lens, veil-vanguard, anchor-shard, throne-echo, dawnless-crown, pack-warden, lantern-reaver, requiem-warden)
- **Enemies**: 4 characters (scout, shade, guard, possessed)
- **Bosses**: 10 characters (cinder-warden, veil-tactician, gate-sovereign, tide-warden, pack-herald, requiem-choir, lantern-tyrant, bridge-colossus, veiled-concordat, abyss-regent)

All staged with `--rest-pose tpose` for arm axis alignment.

### Motion Pack
- **File**: `assets/motion/ingame/unarmed-core.glb`
- **Bones**: 24 DEF-* (spine.0–5, shoulder/upper_arm/forearm/hand L/R, thigh/shin/foot/toe L/R)
- **Clips**: 9 (idle, move, run, hit, bighit, attack, critical, avoid, defence)
- **Format**: Local rest-relative quaternion deltas; runtime composition: `qRest * qDelta`

## Measured Metrics

### 1. Weight & Bone Structure (per character)

#### 1.1 Unweighted Vertices
- **Metric**: Count of vertices with zero total weight.
- **Expected**: 0
- **Threshold (FAIL)**: > 0
- **Risk**: Vertices without weights won't deform; they stay in rest pose, creating visual splits.

#### 1.2 Weight Normalization
- **Metric**: Count of vertices where `sum(weights) ≠ 1.0` (tolerance 1e-5).
- **Expected**: 0
- **Threshold (FAIL)**: > 0 (or > 1% of total if minor engine/export artifacts exist)
- **Risk**: Non-normalized weights cause unpredictable blending; runtime composition formula breaks.

#### 1.3 Bone Count & Names
- **Metric**: Verify 24 DEF-* bones present and named exactly.
- **Expected**: Exactly 24 DEF-* bones
- **Threshold (FAIL)**: <24 or mismatched names
- **Risk**: Missing bones mean missing limbs; name mismatch breaks animation mapping.

#### 1.4 Bone Influences per Vertex
- **Metric**: Max number of bones influencing any single vertex.
- **Expected**: ≤4 (typical skinned mesh)
- **Threshold (WARN)**: >4 (high influence count)
- **Risk**: Excessive influences slow runtime evaluation and may cause numerical instability.

### 2. Rest Pose Alignment (per character)

#### 2.1 Arm Axis Alignment
- **Metric**: Angle between shoulder→elbow→wrist chain and horizontal plane (X-axis).
- **Measurement**: At rest pose, compute angle of (elbow - shoulder) to global X.
- **Expected**: 0° ± 12° (TPOSE_TOLERANCE_DEG from rig-character-asset-blender.py)
- **Threshold (FAIL)**: |angle| > 12°
- **Risk**: Misaligned rest pose causes animated bones to reach unintended orientations; overlaid motion assumes canonical T-pose.

#### 2.2 Pelvis/Spine Rest Position
- **Metric**: Verify DEF-spine (hips) is grounded (Y ≈ 0 in world space at rest).
- **Expected**: Y coordinate within [−0.05, 0.05] (standing on ground)
- **Threshold (WARN)**: |Y| > 0.1
- **Risk**: Floating pelvis causes foot/ground misalignment during motion.

### 3. Deformation Safety (per character × clip)

#### 3.1 Edge Collapse Detection
- **Metric**: Detect edges where both endpoints are within ε distance (edge length < 1e-4).
- **Expected**: 0 collapsed edges
- **Threshold (FAIL)**: Any collapsed edge detected
- **Sampling**: Rest pose + sampled keyframes (frame_start, frame_end, every 5th frame)
- **Risk**: Collapsed edges indicate singular vertices; vertices may explode under slight variation.

#### 3.2 Face Inversion Detection
- **Metric**: Detect flipped faces (normal direction reversed from rest pose).
- **Expected**: 0 inverted faces
- **Threshold (FAIL)**: >0 inverted faces at any sampled frame
- **Sampling**: Rest pose + sampled keyframes
- **Risk**: Inverted faces break lighting and cause visual artifacts; indicate volume collapse.

#### 3.3 Self-Penetration Proxy (Conservative)
- **Metric**: Spatial hash of rest-pose mesh; flag if any non-adjacent faces occupy same voxel.
- **Expected**: 0 penetrations at rest
- **Threshold (FAIL)**: Any rest-pose penetration
- **Sampling**: Rest pose only (establishes baseline)
- **Risk**: Rest penetration indicates malformed rig; motion can only make it worse.
- **Note**: Extreme-frame penetration checks deferred to runtime; this gate validates baseline.

### 4. Vertex Displacement (per character × clip)

#### 4.1 Max Displacement
- **Metric**: Max distance any vertex moves from rest pose to any frame.
- **Expected**: Depends on character size; typical humanoid ≤ 0.5 world units
- **Threshold (WARN)**: >1.0 units
- **Threshold (FAIL)**: >2.0 units (likely explosion)
- **Sampling**: All keyframes
- **Risk**: Excessive displacement suggests vertex explosion, misaligned bone, or scale mismatch.

#### 4.2 Displacement Outliers
- **Metric**: Vertices displaced >2σ from mean displacement.
- **Expected**: <1% of vertices
- **Threshold (WARN)**: 1–5% of vertices are outliers
- **Threshold (FAIL)**: >5% of vertices are outliers
- **Risk**: Outliers indicate misweighted or disconnected vertices.

#### 4.3 Per-Vertex Displacement Distribution
- **Metric**: For each vertex, compute max displacement across all frames.
- **Expected**: Normal distribution centered near center of mass
- **Threshold (WARN)**: Bimodal or heavy-tailed distribution
- **Risk**: Suggests some vertices are poorly constrained.

### 5. Ground/Foot Contact (per character × clip)

#### 5.1 Foot Height Range
- **Metric**: Min and max Y-coordinate of foot bones (DEF-foot.L, DEF-foot.R) across clip.
- **Expected**: Min Y ≥ −0.05 (feet on or above ground), stable contact during idle/move/run
- **Threshold (WARN)**: Min Y < −0.2 (foot sinks into ground)
- **Threshold (FAIL)**: Min Y < −0.5
- **Sampling**: All frames
- **Risk**: Sunken feet indicate misaligned pelvis or bad ankle weight.

#### 5.2 Foot Drift (for looping clips)
- **Metric**: For looping clips (idle, move, run), measure root (DEF-spine) displacement from frame 0 to last frame.
- **Expected**: <0.01 units (perfect loop) for idle; up to 0.2 units for move/run (natural walking)
- **Threshold (WARN)**: >0.5 units for idle/move; >1.0 for run
- **Threshold (FAIL)**: >2.0 units (broken loop)
- **Risk**: Excessive drift breaks loop seamlessness and ground-truth positioning.

### 6. Armature Modifier & Deform Bone Setup

#### 6.1 Armature Modifier Present
- **Metric**: Verify each mesh has an Armature modifier pointing to the character's armature.
- **Expected**: Exactly 1 Armature modifier per mesh
- **Threshold (FAIL)**: 0 or >1 modifiers
- **Risk**: Missing modifier = no deformation; multiple modifiers = double-deformed.

#### 6.2 Modifier Stack Order
- **Metric**: Armature modifier must be before (or at) any other deforming modifier.
- **Expected**: First in stack or before Subdivision Surface / Smooth
- **Threshold (WARN)**: Armature modifier after other deformers
- **Risk**: Wrong order = incorrect deformation application.

#### 6.3 Deform Bone Flags
- **Metric**: All DEF-* bones must have `use_deform` = True.
- **Expected**: All 24 DEF-* bones have `use_deform = True`
- **Threshold (FAIL)**: Any DEF-* with `use_deform = False`
- **Risk**: Non-deforming bones won't move vertices.

## Measurement Sampling Strategy

### Rest Pose
- Always measured (frame 0 or explicit rest pose frame)

### Keyframes (for deformation checks)
- Frame range: action.frame_range (start to end)
- Sampling: start, end, every 5th frame in between
- Rationale: Captures both pose extremes and intermediate deformations

### Duration
- All 9 clips measured for all 24 characters
- Total: 24 characters × 9 clips = 216 measurements

## Output Contract

### Per-Measurement Report
```json
{
  "character_name": "dusk-warden",
  "character_path": "assets/images/battle/glb/commander/dusk-warden.glb",
  "clip_name": "attack",
  "status": "pass" | "warn" | "fail",
  
  "weights": {
    "unweighted_vertices": 0,
    "weight_norm_violations": 0,
    "max_influences_per_vertex": 4
  },
  
  "rest_pose": {
    "arm_axis_angle_deg": 2.1,
    "pelvis_y": 0.01,
    "edge_collapse_count": 0,
    "face_inversion_count": 0,
    "penetration_count": 0
  },
  
  "deformation": {
    "max_vertex_displacement": 0.32,
    "displacement_outlier_pct": 0.2,
    "edge_collapse_events": 0,
    "edge_collapse_frames": [],
    "face_inversion_events": 0,
    "face_inversion_frames": []
  },
  
  "foot_contact": {
    "left_foot_min_y": 0.00,
    "right_foot_min_y": -0.01,
    "left_foot_max_y": 0.05,
    "right_foot_max_y": 0.05,
    "root_drift": 0.001
  },
  
  "issues": {
    "severe": [],
    "warnings": [],
    "notes": []
  }
}
```

### Aggregate Report
```json
{
  "timestamp": "2026-07-29T...",
  "motion_pack": "assets/motion/ingame/unarmed-core.glb",
  "character_count": 24,
  "clip_count": 9,
  "total_measurements": 216,
  "pass_count": 216,
  "warn_count": 0,
  "fail_count": 0,
  "summary": {
    "all_weights_valid": true,
    "all_rest_poses_aligned": true,
    "no_deformation_artifacts": true,
    "foot_contact_stable": true,
    "ready_for_production": true
  },
  "measurements": [...]
}
```

## Known False-Positive Risks

### 1. AABB-Based Self-Penetration Detection
- **Risk**: Conservative AABB overlap may flag valid poses (e.g., legs close together).
- **Mitigation**: Conservative proxy only; real penetration checked at runtime via ray-casting or sphere-mesh tests.

### 2. Mesh Scale Variation
- **Risk**: Different character sizes have different expected displacement ranges.
- **Mitigation**: Displacement thresholds scaled by character AABB diagonal.

### 3. Armature-Only vs. Deformed Mesh Comparison
- **Risk**: Measuring bone positions without evaluating mesh deformation is incomplete.
- **Mitigation**: Always measure mesh vertex positions (post-armature-modifier).

### 4. Frame Sampling Sparsity
- **Risk**: Sampling every 5th frame may miss spike artifacts.
- **Mitigation**: If deformation checks flag warnings, re-run with frame_step=1 (all frames).

### 5. Rest Pose Assumption
- **Risk**: Overlay motion assumes rest pose is canonical; if rest pose differs, deltas apply incorrectly.
- **Mitigation**: Arm axis alignment check ensures rest poses are within tolerance.

## Threshold Justification

### Unweighted Vertices (FAIL: >0)
- **Rationale**: Even a single unweighted vertex is a rig error; no exceptions.
- **Source**: Industry standard; any vertex without weight is a bug.

### Weight Normalization (FAIL: >0)
- **Rationale**: Runtime quaternion composition formula assumes normalized weights; denormalized weights corrupt blending.
- **Source**: glTF 2.0 spec; engine expectations.

### Arm Axis Alignment (FAIL: >12°)
- **Rationale**: Value from rig-character-asset-blender.py TPOSE_TOLERANCE_DEG constant; T-pose tolerance.
- **Source**: Existing production rig validation.

### Edge Collapse (FAIL: >0)
- **Rationale**: Collapsed edges are geometric degeneracies; no tolerance.
- **Source**: Mesh validity; collapsing edges indicate singular deformation.

### Face Inversion (FAIL: >0)
- **Rationale**: Inverted faces break rendering and indicate volume collapse.
- **Source**: Mesh topology; inverted faces are always errors.

### Max Displacement (WARN: >1.0, FAIL: >2.0)
- **Rationale**: Typical humanoid moves <0.5 units per bone; >2.0 is a likely explosion.
- **Source**: Observed motion ranges in production clips.

### Displacement Outliers (WARN: 1–5%, FAIL: >5%)
- **Rationale**: 1–2% statistical outliers are normal; >5% suggests systemic misweighting.
- **Source**: Statistical rule of thumb (>2σ).

### Foot Height (FAIL: <−0.5)
- **Rationale**: Feet should not sink significantly into ground.
- **Source**: Visual ground truth; feet at Y ≈ 0.

### Foot Drift (WARN: >0.5 for idle/move, FAIL: >2.0)
- **Rationale**: Ideal loop has no drift; >0.5 is noticeable, >2.0 is broken.
- **Source**: Loop quality standards.

## Implementation Notes

### Script Location
- **Script**: `scripts/measure-deformation-gate.py`
- **Invocation**: `blender -b -P scripts/measure-deformation-gate.py -- --character <path> --clip <name> --output <report.json>`
- **Report Output**: `_workspace/current/deformation-gate-<name>.json` (per character) or aggregate.

### Data Dependencies
- **Character GLBs**: Staged with `--rest-pose tpose`
- **Motion Pack**: `assets/motion/ingame/unarmed-core.glb` (must have all 9 clips)
- **Blender Version**: 5.2+ (for accurate glTF import/export)

### Verification Workflow
1. Stage all 24 characters with `--rest-pose tpose`.
2. Run deformation gate on all 24 × 9 combinations.
3. If FAIL: investigate specific character/clip; re-rig if needed.
4. If WARN: document but proceed (may warrant future corrective shapes).
5. If all PASS: gate is satisfied; motion pack ready for production overlay.

## False-Positive Remediation

If a measurement flags a false positive:
1. Re-run with `--frame-step 1` (all frames, not every 5th).
2. Visually inspect character + clip in Blender.
3. Check if the "violation" is actually a valid pose (e.g., legs close together is not penetration).
4. If confirmed false positive, adjust threshold and document.
5. Re-run full measurement suite.
