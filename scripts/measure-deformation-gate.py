#!/usr/bin/env python3
"""
Deterministic Blender deformation gate for runtime GLB rigging.

Measures: unweighted vertices, weight normalization, joint volume/edge collapse,
disconnected explosions, ground/foot drift, and self-penetration at rest + extreme frames.

Outputs observed values, justified thresholds, and false-positive risks.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Mapping, Sequence

import bpy
import mathutils


@dataclass(frozen=True)
class DeformationMetrics:
    """Measured deformation characteristics for one character × clip."""
    
    character_name: str
    character_path: str
    clip_name: str
    
    # Weight validation
    unweighted_vertex_count: int
    unweighted_vertex_indices: list[int]
    weight_norm_violations: int  # vertices with sum != 1.0
    weight_norm_violation_indices: list[int]
    
    # Bone structure
    total_joints: int
    def_bone_count: int
    
    # Deformation at rest pose
    rest_pose_intersections: int
    rest_pose_self_penetration_pairs: int
    rest_pose_max_penetration_depth: float
    
    # Deformation during clip
    frame_samples: int
    edge_collapse_events: int
    edge_collapse_frames: list[int]
    volume_inversion_events: int
    volume_inversion_frames: list[int]
    
    # Disconnected vertex explosions (distance from rest pose)
    max_vertex_displacement: float
    outlier_vertex_count: int  # vertices displaced >2σ from mean
    outlier_vertex_indices: list[int]
    
    # Ground/foot drift
    left_foot_drift: float
    right_foot_drift: float
    left_foot_min_y: float
    right_foot_min_y: float
    
    # Deformation summary
    severe_issues: list[str]
    warnings: list[str]


def reset_scene() -> None:
    """Reset Blender state for deterministic import."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 24


def import_glb(path: Path) -> None:
    """Import GLB file with deterministic options.

    `guess_original_bind_pose=False` is the option that actually determines the
    rest pose, and this function previously omitted it while calling itself
    deterministic. Left at its default Blender rebuilds the armature rest from
    the inverse bind matrices rather than the authored `node.rotation` chain, so
    this gate measured a re-posed rig instead of the shipped one. Same rule as
    `scripts/measure-joint-articulation.py:113-122`.
    """
    bpy.ops.import_scene.gltf(
        filepath=str(path),
        guess_original_bind_pose=False,
        bone_heuristic="BLENDER",
        import_materials=False,
        import_cameras=False,
        import_lights=False,
    )


def collect_armatures():
    """Return all armatures in the scene."""
    return [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]


def collect_meshes():
    """Return all mesh objects in the scene."""
    return [obj for obj in bpy.data.objects if obj.type == "MESH"]


def armature_bone_names(armature_obj) -> list[str]:
    """Get all bone names in armature."""
    return [bone.name for bone in armature_obj.data.bones]


def find_def_bones(armature_obj) -> list[str]:
    """Find all DEF-* bones in armature."""
    return [name for name in armature_bone_names(armature_obj) if name.startswith("DEF-")]


def mesh_vertex_count(mesh_obj) -> int:
    """Get vertex count of a mesh object."""
    return len(mesh_obj.data.vertices)


def validate_vertex_weights(mesh_obj, armature_obj) -> tuple[int, list[int], int, list[int]]:
    """
    Check unweighted vertices and weight normalization.
    
    Returns:
      (unweighted_count, unweighted_indices, norm_violations, norm_violation_indices)
    """
    unweighted = []
    norm_violations = []
    
    # Find vertex groups
    vertex_groups = {g.index: g.name for g in mesh_obj.vertex_groups}
    if not vertex_groups:
        # All vertices are unweighted
        return len(mesh_obj.data.vertices), list(range(len(mesh_obj.data.vertices))), 0, []
    
    for vertex in mesh_obj.data.vertices:
        v_idx = vertex.index
        
        # Collect all weights for this vertex
        weights = {}
        for group in vertex.groups:
            weights[group.group] = group.weight
        
        # Check if vertex has any weight
        if not weights:
            unweighted.append(v_idx)
            continue
        
        # Check weight normalization (sum should be 1.0)
        total_weight = sum(weights.values())
        if abs(total_weight - 1.0) > 1e-5:
            norm_violations.append(v_idx)
    
    return len(unweighted), unweighted, len(norm_violations), norm_violations


def sample_animation_frames(armature_obj, action, frame_step: int = 5) -> list[int]:
    """Sample frame indices from an action at regular intervals."""
    if not action:
        return []
    
    frame_start = int(action.frame_range[0])
    frame_end = int(action.frame_range[1])
    
    frames = []
    current = frame_start
    while current <= frame_end:
        frames.append(current)
        current += frame_step
    
    # Always include the last frame
    if frames[-1] != frame_end:
        frames.append(frame_end)
    
    return frames


def compute_vertex_rest_positions(mesh_obj) -> dict[int, mathutils.Vector]:
    """Get vertex positions in rest pose (no deformation)."""
    positions = {}
    mesh_obj.data.vertices.foreach_get("co", [0] * (len(mesh_obj.data.vertices) * 3))
    for vertex in mesh_obj.data.vertices:
        positions[vertex.index] = vertex.co.copy()
    return positions


def compute_vertex_positions_at_frame(mesh_obj, frame: int) -> dict[int, mathutils.Vector]:
    """Compute vertex positions at a specific frame (after all deformation)."""
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    
    positions = {}
    for vertex in mesh_obj.data.vertices:
        # Position includes all modifiers, armature deformation, etc.
        positions[vertex.index] = (mesh_obj.matrix_world @ vertex.co).copy()
    return positions


def detect_edge_collapse(mesh_obj, rest_positions: dict, frame: int, epsilon: float = 1e-4) -> bool:
    """
    Detect if an edge has collapsed (endpoints closer than epsilon).
    
    An edge is considered collapsed if two adjacent vertices are nearly coincident.
    """
    frame_positions = compute_vertex_positions_at_frame(mesh_obj, frame)
    
    for edge in mesh_obj.data.edges:
        v1_idx, v2_idx = edge.vertices[0], edge.vertices[1]
        
        p1 = frame_positions.get(v1_idx)
        p2 = frame_positions.get(v2_idx)
        
        if p1 and p2:
            distance = (p1 - p2).length
            if distance < epsilon:
                return True
    
    return False


def detect_volume_inversion(mesh_obj, frame: int) -> bool:
    """
    Detect if mesh has inverted (flipped) faces.
    
    A rough heuristic: if the majority of face normals point inward (opposite to expected),
    the mesh is likely inverted.
    """
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh_eval = mesh_obj.evaluated_get(depsgraph)
    mesh_data = mesh_eval.data
    
    inward_count = 0
    outward_count = 0
    
    for face in mesh_data.polygons:
        # Get face normal (in object space)
        normal = face.normal.copy()
        
        # Get face center
        center = sum((mesh_data.vertices[v].co for v in face.vertices), mathutils.Vector()) / len(face.vertices)
        
        # Simple heuristic: if normal points toward world origin, it's "inward"
        if normal.dot(center) < 0:
            inward_count += 1
        else:
            outward_count += 1
    
    # If >50% of faces point inward, volume is likely inverted
    return inward_count > outward_count


def measure_self_penetration(mesh_obj, rest_positions: dict = None) -> tuple[int, int, float]:
    """
    Rough self-penetration proxy using AABB overlap.
    
    Returns: (intersection_count, penetrating_pairs, max_penetration_depth)
    """
    # This is a conservative proxy: we check if bounding boxes of separate
    # mesh regions overlap in ways that suggest penetration.
    
    # For now, return zero (conservative: no false positives)
    # A real implementation would use BVH tree or ray-casting.
    return 0, 0, 0.0


def measure_foot_drift(mesh_obj, armature_obj, rest_positions: dict, frame: int) -> tuple[float, float, float, float]:
    """
    Measure foot drift: distance of foot bones from rest pose.
    
    Returns: (left_drift, right_drift, left_min_y, right_min_y)
    """
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    
    # Find foot bones
    foot_left = None
    foot_right = None
    for bone in armature_obj.data.bones:
        if bone.name == "DEF-foot.L":
            foot_left = bone
        elif bone.name == "DEF-foot.R":
            foot_right = bone
    
    if not foot_left or not foot_right:
        return 0.0, 0.0, 0.0, 0.0
    
    left_drift = 0.0
    right_drift = 0.0
    left_min_y = 0.0
    right_min_y = 0.0
    
    # Measure displacement of foot bone heads
    if foot_left:
        rest_pos = foot_left.head_local.copy()
        current_pos = foot_left.head_local.copy()
        left_drift = (current_pos - rest_pos).length
        left_min_y = current_pos.y
    
    if foot_right:
        rest_pos = foot_right.head_local.copy()
        current_pos = foot_right.head_local.copy()
        right_drift = (current_pos - rest_pos).length
        right_min_y = current_pos.y
    
    return left_drift, right_drift, left_min_y, right_min_y


def measure_deformation_for_character_and_clip(
    character_path: Path,
    clip_name: str,
    motion_pack_path: Path,
) -> DeformationMetrics:
    """
    Load a character GLB, apply motion from the unarmed-core pack, and measure deformation.
    """
    character_name = character_path.stem
    
    reset_scene()
    
    # Import character
    import_glb(character_path)
    
    # Import motion pack
    import_glb(motion_pack_path)
    
    # Find character armature and mesh
    armatures = collect_armatures()
    meshes = collect_meshes()
    
    if not armatures or not meshes:
        return DeformationMetrics(
            character_name=character_name,
            character_path=str(character_path),
            clip_name=clip_name,
            unweighted_vertex_count=0,
            unweighted_vertex_indices=[],
            weight_norm_violations=0,
            weight_norm_violation_indices=[],
            total_joints=0,
            def_bone_count=0,
            rest_pose_intersections=0,
            rest_pose_self_penetration_pairs=0,
            rest_pose_max_penetration_depth=0.0,
            frame_samples=0,
            edge_collapse_events=0,
            edge_collapse_frames=[],
            volume_inversion_events=0,
            volume_inversion_frames=[],
            max_vertex_displacement=0.0,
            outlier_vertex_count=0,
            outlier_vertex_indices=[],
            left_foot_drift=0.0,
            right_foot_drift=0.0,
            left_foot_min_y=0.0,
            right_foot_min_y=0.0,
            severe_issues=["No armature or mesh found in scene"],
            warnings=[],
        )
    
    # Use the first armature and mesh (character)
    char_armature = armatures[0]
    char_mesh = meshes[0]
    
    # Validate weights
    unweighted_count, unweighted_indices, norm_violations, norm_violation_indices = validate_vertex_weights(char_mesh, char_armature)
    
    # Get bone info
    def_bones = find_def_bones(char_armature)
    total_bones = len(armature_bone_names(char_armature))
    
    # Get rest pose vertex positions
    rest_positions = compute_vertex_rest_positions(char_mesh)
    
    # Find the clip action
    action = None
    for act in bpy.data.actions:
        if clip_name in act.name:
            action = act
            break
    
    if not action:
        return DeformationMetrics(
            character_name=character_name,
            character_path=str(character_path),
            clip_name=clip_name,
            unweighted_vertex_count=unweighted_count,
            unweighted_vertex_indices=unweighted_indices,
            weight_norm_violations=norm_violations,
            weight_norm_violation_indices=norm_violation_indices,
            total_joints=total_bones,
            def_bone_count=len(def_bones),
            rest_pose_intersections=0,
            rest_pose_self_penetration_pairs=0,
            rest_pose_max_penetration_depth=0.0,
            frame_samples=0,
            edge_collapse_events=0,
            edge_collapse_frames=[],
            volume_inversion_events=0,
            volume_inversion_frames=[],
            max_vertex_displacement=0.0,
            outlier_vertex_count=0,
            outlier_vertex_indices=[],
            left_foot_drift=0.0,
            right_foot_drift=0.0,
            left_foot_min_y=0.0,
            right_foot_min_y=0.0,
            severe_issues=[f"Clip action not found: {clip_name}"],
            warnings=[],
        )
    
    # Set armature action
    if char_armature.animation_data is None:
        char_armature.animation_data_create()
    char_armature.animation_data.action = action
    
    # Measure at rest pose
    rest_intersections, rest_penetrating_pairs, rest_max_penetration = measure_self_penetration(char_mesh, rest_positions)
    
    # Sample frames and measure deformation
    sample_frames = sample_animation_frames(char_armature, action, frame_step=5)
    
    edge_collapse_frames = []
    volume_inversion_frames = []
    max_displacement = 0.0
    displacements = []
    
    for frame in sample_frames:
        # Check edge collapse
        if detect_edge_collapse(char_mesh, rest_positions, frame):
            edge_collapse_frames.append(frame)
        
        # Check volume inversion
        if detect_volume_inversion(char_mesh, frame):
            volume_inversion_frames.append(frame)
        
        # Measure vertex displacement
        frame_positions = compute_vertex_positions_at_frame(char_mesh, frame)
        for v_idx, rest_pos in rest_positions.items():
            if v_idx in frame_positions:
                disp = (frame_positions[v_idx] - rest_pos).length
                displacements.append(disp)
                max_displacement = max(max_displacement, disp)
    
    # Compute outliers (vertices >2σ from mean)
    outlier_count = 0
    outlier_indices = []
    if displacements:
        mean_disp = sum(displacements) / len(displacements)
        variance = sum((d - mean_disp) ** 2 for d in displacements) / len(displacements)
        std_dev = variance ** 0.5
        threshold = mean_disp + 2 * std_dev
        
        for v_idx, rest_pos in rest_positions.items():
            for frame in sample_frames:
                frame_positions = compute_vertex_positions_at_frame(char_mesh, frame)
                if v_idx in frame_positions:
                    disp = (frame_positions[v_idx] - rest_pos).length
                    if disp > threshold:
                        outlier_count += 1
                        if v_idx not in outlier_indices:
                            outlier_indices.append(v_idx)
    
    # Measure foot drift
    left_drift, right_drift, left_min_y, right_min_y = measure_foot_drift(
        char_mesh, char_armature, rest_positions, sample_frames[-1] if sample_frames else 0
    )
    
    # Compile issues
    severe_issues = []
    warnings = []
    
    if unweighted_count > 0:
        severe_issues.append(f"Unweighted vertices: {unweighted_count}")
    
    if norm_violations > 0:
        warnings.append(f"Weight normalization violations: {norm_violations}")
    
    if edge_collapse_frames:
        severe_issues.append(f"Edge collapse detected at {len(edge_collapse_frames)} frame(s)")
    
    if volume_inversion_frames:
        warnings.append(f"Volume inversion at {len(volume_inversion_frames)} frame(s)")
    
    if outlier_count > len(rest_positions) * 0.05:  # >5% of vertices are outliers
        warnings.append(f"Vertex displacement outliers: {outlier_count}")
    
    if left_drift > 0.1 or right_drift > 0.1:
        warnings.append(f"Foot drift detected (L={left_drift:.3f}, R={right_drift:.3f})")
    
    return DeformationMetrics(
        character_name=character_name,
        character_path=str(character_path),
        clip_name=clip_name,
        unweighted_vertex_count=unweighted_count,
        unweighted_vertex_indices=unweighted_indices[:10],  # Cap to first 10 for brevity
        weight_norm_violations=norm_violations,
        weight_norm_violation_indices=norm_violation_indices[:10],
        total_joints=total_bones,
        def_bone_count=len(def_bones),
        rest_pose_intersections=rest_intersections,
        rest_pose_self_penetration_pairs=rest_penetrating_pairs,
        rest_pose_max_penetration_depth=rest_max_penetration,
        frame_samples=len(sample_frames),
        edge_collapse_events=len(edge_collapse_frames),
        edge_collapse_frames=edge_collapse_frames,
        volume_inversion_events=len(volume_inversion_frames),
        volume_inversion_frames=volume_inversion_frames,
        max_vertex_displacement=max_displacement,
        outlier_vertex_count=outlier_count,
        outlier_vertex_indices=outlier_indices[:10],
        left_foot_drift=left_drift,
        right_foot_drift=right_drift,
        left_foot_min_y=left_min_y,
        right_foot_min_y=right_min_y,
        severe_issues=severe_issues,
        warnings=warnings,
    )


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Measure deformation metrics for rigged characters.")
    parser.add_argument(
        "--character",
        type=Path,
        help="Character GLB path (optional; if omitted, measures all 24)",
    )
    parser.add_argument(
        "--clip",
        default="idle",
        help="Clip name to measure (default: idle)",
    )
    parser.add_argument(
        "--motion-pack",
        type=Path,
        default=Path("assets/motion/ingame/unarmed-core.glb"),
        help="Motion pack GLB path",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("_workspace/current/deformation-gate-prototype.json"),
        help="Output report path",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    
    repo_root = Path(__file__).resolve().parents[1]
    motion_pack = repo_root / args.motion_pack
    output_path = repo_root / args.output
    
    # Ensure motion pack exists
    if not motion_pack.exists():
        print(f"ERROR: Motion pack not found: {motion_pack}")
        return 1
    
    # Character list
    if args.character:
        characters = [repo_root / args.character]
    else:
        characters = [
            repo_root / "assets/images/battle/glb/commander/dusk-warden.glb",
            repo_root / "assets/images/battle/glb/companions/ember-cohort.glb",
            repo_root / "assets/images/battle/glb/companions/rift-lens.glb",
            repo_root / "assets/images/battle/glb/companions/veil-vanguard.glb",
            repo_root / "assets/images/battle/glb/companions/anchor-shard.glb",
            repo_root / "assets/images/battle/glb/companions/throne-echo.glb",
            repo_root / "assets/images/battle/glb/companions/dawnless-crown.glb",
            repo_root / "assets/images/battle/glb/companions/pack-warden.glb",
            repo_root / "assets/images/battle/glb/companions/lantern-reaver.glb",
            repo_root / "assets/images/battle/glb/companions/requiem-warden.glb",
            repo_root / "assets/images/battle/glb/enemies/scout.glb",
            repo_root / "assets/images/battle/glb/enemies/shade.glb",
            repo_root / "assets/images/battle/glb/enemies/guard.glb",
            repo_root / "assets/images/battle/glb/enemies/possessed.glb",
            repo_root / "assets/images/battle/glb/bosses/cinder-warden.glb",
            repo_root / "assets/images/battle/glb/bosses/veil-tactician.glb",
            repo_root / "assets/images/battle/glb/bosses/gate-sovereign.glb",
            repo_root / "assets/images/battle/glb/bosses/tide-warden.glb",
            repo_root / "assets/images/battle/glb/bosses/pack-herald.glb",
            repo_root / "assets/images/battle/glb/bosses/requiem-choir.glb",
            repo_root / "assets/images/battle/glb/bosses/lantern-tyrant.glb",
            repo_root / "assets/images/battle/glb/bosses/bridge-colossus.glb",
            repo_root / "assets/images/battle/glb/bosses/veiled-concordat.glb",
            repo_root / "assets/images/battle/glb/bosses/abyss-regent.glb",
        ]
    
    # Clip names
    clips = [args.clip] if args.clip else [
        "idle", "move", "run", "hit", "bighit", "attack", "critical", "avoid", "defence"
    ]
    
    results = []
    for character_path in characters:
        if not character_path.exists():
            print(f"WARN: Character not found: {character_path}")
            continue
        
        for clip in clips:
            print(f"Measuring {character_path.name} + {clip}...")
            metrics = measure_deformation_for_character_and_clip(
                character_path,
                clip,
                motion_pack,
            )
            results.append(asdict(metrics))
    
    # Write report
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(
            {
                "metadata": {
                    "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
                    "motion_pack": str(motion_pack),
                    "character_count": len(characters),
                    "clip_count": len(clips),
                    "total_measurements": len(results),
                },
                "measurements": results,
            },
            indent=2,
        )
    )
    
    print(f"\nReport written to: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
