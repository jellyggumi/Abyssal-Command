#!/usr/bin/env python3
"""Retarget character-specific Mixamo bench clips onto staged DEF rigs.

Run with Blender 5.2+ in background mode. The script opens the character's
staged review.blend, replaces nine gameplay actions with audited bench motion,
preserves authored die/show fallbacks, exports one directly loadable GLB, and
writes a machine-readable gate manifest beside it.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import importlib.util
import json
import math
import sys
from dataclasses import replace
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[5]
DEFAULT_CONFIG = REPO_ROOT / "_workspace/current/engineering/asset-pipeline/character-motion-library/library-config.json"
RETARGET_SCRIPT = REPO_ROOT / "scripts/retarget-ingame-motion-blender.py"
RETARGET_ACTIONS = ("idle", "move", "run", "hit", "bighit", "attack", "critical", "avoid", "defence", "show")
FALLBACK_ACTIONS = ("die",)
EXPECTED_BONES = (
    "DEF-spine", "DEF-spine.001", "DEF-spine.002", "DEF-spine.003", "DEF-spine.004", "DEF-spine.005",
    "DEF-pelvis.L", "DEF-pelvis.R",
    "DEF-shoulder.L", "DEF-upper_arm.L", "DEF-forearm.L", "DEF-hand.L",
    "DEF-shoulder.R", "DEF-upper_arm.R", "DEF-forearm.R", "DEF-hand.R",
    "DEF-thigh.L", "DEF-shin.L", "DEF-foot.L", "DEF-toe.L",
    "DEF-thigh.R", "DEF-shin.R", "DEF-foot.R", "DEF-toe.R",
)
SEMANTIC_REGIONS = (
    "torso_head",
    "upper_arm_l",
    "lower_arm_l",
    "upper_arm_r",
    "lower_arm_r",
    "upper_leg_l",
    "lower_leg_l",
    "upper_leg_r",
    "lower_leg_r",
)
SEMANTIC_RECEIPT_FIELDS = (
    "policy",
    "parts",
    "partNames",
    "regionFaceCounts",
    "sourceFaces",
    "partitionFaces",
    "faceCountDelta",
    "materialHistogramPreserved",
    "boundaryMaxRestDelta",
    "boundaryMaxWeightDelta",
)
WEIGHT_RECEIPT_FIELDS = (
    "maxHierarchySpread",
    "maxInfluences",
    "orphanCount",
    "nonDefCount",
    "maxWeightSumError",
    "singleInfluenceFraction",
)
WEIGHT_EPSILON = 1e-8


def script_args(argv: list[str] | None = None) -> list[str]:
    values = list(sys.argv if argv is None else argv)
    return values[values.index("--") + 1 :] if "--" in values else values[1:]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build one character-specific motion library")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--asset-id", required=True)
    return parser.parse_args(script_args(argv))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_retarget_module():
    spec = importlib.util.spec_from_file_location("abyssal_retarget_ingame", RETARGET_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load retarget module: {RETARGET_SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def close_loop(action: Any, iter_fcurves) -> None:
    for curve in iter_fcurves(action):
        points = list(curve.keyframe_points)
        if len(points) >= 2:
            points[-1].co.y = points[0].co.y
            points[-1].handle_left.y = points[0].co.y
            points[-1].handle_right.y = points[0].co.y
            points[-1].interpolation = "LINEAR"


def set_linear_interpolation(action: Any, iter_fcurves) -> None:
    for curve in iter_fcurves(action):
        for point in curve.keyframe_points:
            point.interpolation = "LINEAR"


def bake_existing_action_to_quaternion(armature: Any, action_name: str, iter_fcurves) -> None:
    import bpy
    import mathutils

    source = bpy.data.actions.get(action_name)
    if source is None:
        raise RuntimeError(f"authored fallback missing before bake: {action_name}")
    frame_start = int(round(source.frame_range[0]))
    frame_end = int(round(source.frame_range[1]))
    for pose_bone in armature.pose.bones:
        pose_bone.location = (0.0, 0.0, 0.0)
        pose_bone.scale = (1.0, 1.0, 1.0)
        pose_bone.rotation_euler = (0.0, 0.0, 0.0)
        pose_bone.rotation_quaternion = mathutils.Quaternion((1.0, 0.0, 0.0, 0.0))
    armature.animation_data.action = source
    samples: dict[int, dict[str, Any]] = {}
    for frame in range(frame_start, frame_end + 1):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        samples[frame] = {
            pose_bone.name: pose_bone.matrix_basis.to_quaternion().normalized()
            for pose_bone in armature.pose.bones
            if pose_bone.name in EXPECTED_BONES
        }
    start_rotations = samples[frame_start]
    sampled_motion = max(
        1.0 - abs(start_rotations[bone_name].dot(rotation))
        for rotations in samples.values()
        for bone_name, rotation in rotations.items()
    )
    if sampled_motion <= 1e-6:
        raise RuntimeError(f"authored fallback sampled as constant: {action_name}")
    armature.animation_data.action = None
    bpy.data.actions.remove(source)

    baked = bpy.data.actions.new(name=action_name)
    baked.use_fake_user = True
    baked.frame_range = (float(frame_start), float(frame_end))
    armature.animation_data.action = baked
    for frame, rotations in samples.items():
        for bone_name, rotation in rotations.items():
            pose_bone = armature.pose.bones[bone_name]
            pose_bone.rotation_mode = "QUATERNION"
            pose_bone.rotation_quaternion = rotation
            pose_bone.keyframe_insert(data_path="rotation_quaternion", frame=frame)
    set_linear_interpolation(baked, iter_fcurves)
    curve_spread = max(
        max(point.co.y for point in curve.keyframe_points) - min(point.co.y for point in curve.keyframe_points)
        for curve in iter_fcurves(baked)
        if curve.keyframe_points
    )
    if curve_spread <= 1e-6:
        raise RuntimeError(f"authored fallback baked as constant: {action_name}")
    armature.animation_data.action = None


def remove_imported_source(before_objects: set[Any], before_actions: set[Any], keep_action: Any) -> None:
    import bpy

    for obj in list(bpy.data.objects):
        if obj not in before_objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    for action in list(bpy.data.actions):
        if action not in before_actions and action != keep_action:
            bpy.data.actions.remove(action)


def build_tracks(armature: Any, expected_action_names: list[str]) -> None:
    import bpy

    armature.animation_data_create()
    armature.animation_data.action = None
    for track in list(armature.animation_data.nla_tracks):
        armature.animation_data.nla_tracks.remove(track)
    for index, action_name in enumerate(expected_action_names):
        action = bpy.data.actions.get(action_name)
        if action is None:
            raise RuntimeError(f"missing action before NLA rebuild: {action_name}")
        track = armature.animation_data.nla_tracks.new()
        track.name = action_name
        track.strips.new(name=action_name, start=1, action=action)
        track.mute = index != 0


def is_finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))


def validate_rig_receipts(asset_id: str, rig_report: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    steps = rig_report.get("steps", [])
    steps = steps if isinstance(steps, list) else []
    semantic_rows = [
        row for row in steps if isinstance(row, dict) and row.get("step") == "semantic_partition"
    ]
    weight_rows = [
        row for row in steps if isinstance(row, dict) and row.get("step") == "adjacent_weight_repair"
    ]
    semantic = semantic_rows[0] if len(semantic_rows) == 1 else {}
    weight = weight_rows[0] if len(weight_rows) == 1 else {}
    semantic_missing = [field for field in SEMANTIC_RECEIPT_FIELDS if field not in semantic]
    weight_missing = [field for field in WEIGHT_RECEIPT_FIELDS if field not in weight]

    expected_part_names = [f"{asset_id}_{region}" for region in SEMANTIC_REGIONS]
    expected_part_name_set = set(expected_part_names)
    part_names = semantic.get("partNames")
    region_face_counts = semantic.get("regionFaceCounts")
    parts = semantic.get("parts")
    semantic_complete = (
        len(semantic_rows) == 1
        and semantic.get("status") == "completed"
        and not semantic_missing
        and isinstance(semantic.get("policy"), str)
        and bool(semantic["policy"])
        and isinstance(parts, int)
        and not isinstance(parts, bool)
        and 5 <= parts <= 9
        and isinstance(part_names, list)
        and len(part_names) == parts
        and all(isinstance(name, str) for name in part_names)
        and len(set(part_names)) == parts
        and set(part_names).issubset(expected_part_name_set)
        and part_names == [name for name in expected_part_names if name in set(part_names)]
        and isinstance(region_face_counts, dict)
        and len(region_face_counts) == parts
        and all(isinstance(count, int) and not isinstance(count, bool) and count > 0 for count in region_face_counts.values())
        and isinstance(semantic.get("sourceFaces"), int)
        and not isinstance(semantic["sourceFaces"], bool)
        and semantic["sourceFaces"] > 0
        and isinstance(semantic.get("partitionFaces"), int)
        and not isinstance(semantic["partitionFaces"], bool)
        and semantic["partitionFaces"] == semantic["sourceFaces"]
        and isinstance(semantic.get("faceCountDelta"), int)
        and not isinstance(semantic["faceCountDelta"], bool)
        and semantic["faceCountDelta"] == 0
        and semantic.get("materialHistogramPreserved") is True
        and is_finite_number(semantic.get("boundaryMaxRestDelta"))
        and 0.0 <= float(semantic["boundaryMaxRestDelta"]) <= 1e-6
        and is_finite_number(semantic.get("boundaryMaxWeightDelta"))
        and 0.0 <= float(semantic["boundaryMaxWeightDelta"]) <= 1e-6
    )
    weight_complete = (
        len(weight_rows) == 1
        and weight.get("status") == "completed"
        and not weight_missing
        and is_finite_number(weight.get("maxHierarchySpread"))
        and 0 <= float(weight["maxHierarchySpread"]) <= 1
        and is_finite_number(weight.get("maxInfluences"))
        and 1 <= float(weight["maxInfluences"]) <= 2
        and isinstance(weight.get("orphanCount"), int)
        and not isinstance(weight["orphanCount"], bool)
        and weight["orphanCount"] == 0
        and isinstance(weight.get("nonDefCount"), int)
        and not isinstance(weight["nonDefCount"], bool)
        and weight["nonDefCount"] == 0
        and is_finite_number(weight.get("maxWeightSumError"))
        and 0.0 <= float(weight["maxWeightSumError"]) <= 1e-6
        and is_finite_number(weight.get("singleInfluenceFraction"))
        and 0.0 <= float(weight["singleInfluenceFraction"]) < 1.0
    )

    errors = []
    if not semantic_complete:
        errors.append(
            "rig report semantic_partition receipt is missing, stale, incomplete, or violates partition invariants"
        )
    if not weight_complete:
        errors.append(
            "rig report adjacent_weight_repair receipt is missing, stale, incomplete, or violates weight invariants"
        )
    return {
        "checks": {
            "semanticPartitionReceipt": semantic_complete,
            "adjacentWeightRepairReceipt": weight_complete,
        },
        "semanticPartition": {
            "stepCount": len(semantic_rows),
            "status": semantic.get("status"),
            "missingFields": semantic_missing,
            **{field: semantic.get(field) for field in SEMANTIC_RECEIPT_FIELDS},
        },
        "adjacentWeightRepair": {
            "stepCount": len(weight_rows),
            "status": weight.get("status"),
            "missingFields": weight_missing,
            **{field: weight.get(field) for field in WEIGHT_RECEIPT_FIELDS},
        },
    }, errors


def validate_glb(
    path: Path,
    asset_id: str,
    expected_action_names: list[str],
    retarget,
) -> tuple[dict[str, Any], list[str]]:
    document, binary = retarget.parse_glb_json_and_bin(path)
    errors: list[str] = []
    animations = document.get("animations", []) or []
    nodes = document.get("nodes", []) or []
    skins = document.get("skins", []) or []
    meshes = document.get("meshes", []) or []
    materials = document.get("materials", []) or []
    animation_names = [str(animation.get("name", "")) for animation in animations]

    mesh_nodes = [
        (index, node)
        for index, node in enumerate(nodes)
        if isinstance(node, dict) and "mesh" in node
    ]
    mesh_node_count_ok = 5 <= len(mesh_nodes) <= 9
    if not mesh_node_count_ok:
        errors.append(f"expected 5-9 mesh nodes, found {len(mesh_nodes)}")

    expected_semantic_names = [f"{asset_id}_{region}" for region in SEMANTIC_REGIONS]
    expected_semantic_name_set = set(expected_semantic_names)
    mesh_node_names = [str(node.get("name", "")) for _, node in mesh_nodes]
    semantic_names_ok = (
        bool(mesh_nodes)
        and len(set(mesh_node_names)) == len(mesh_node_names)
        and set(mesh_node_names) == expected_semantic_name_set
    )
    if not semantic_names_ok:
        errors.append(f"mesh node semantic names mismatch: {mesh_node_names}")

    all_mesh_nodes_bound = len(skins) == 1 and bool(mesh_nodes)
    primitive_contract_ok = bool(mesh_nodes)
    primitive_count = 0
    weighted_vertices = 0
    orphan_vertices = 0
    single_influence_vertices = 0
    max_effective_influences = 0
    max_weight_sum_error = 0.0
    for node_index, node in mesh_nodes:
        mesh_index = node.get("mesh")
        if (
            node.get("skin") != 0
            or not isinstance(mesh_index, int)
            or not 0 <= mesh_index < len(meshes)
        ):
            all_mesh_nodes_bound = False
            errors.append(
                f"mesh node {node_index} ({node.get('name')}): invalid mesh/skin binding "
                f"mesh={mesh_index} skin={node.get('skin')}"
            )
            if not isinstance(mesh_index, int) or not 0 <= mesh_index < len(meshes):
                primitive_contract_ok = False
                continue
        primitives = meshes[mesh_index].get("primitives", []) or []
        if not primitives:
            primitive_contract_ok = False
            errors.append(f"mesh node {node_index} ({node.get('name')}): no primitives")
        for primitive_index, primitive in enumerate(primitives):
            primitive_count += 1
            attributes = primitive.get("attributes", {}) or {}
            missing = [
                attribute
                for attribute in ("JOINTS_0", "WEIGHTS_0", "TEXCOORD_0")
                if attribute not in attributes
            ]
            material_index = primitive.get("material")
            material_ok = (
                isinstance(material_index, int)
                and not isinstance(material_index, bool)
                and 0 <= material_index < len(materials)
            )
            if missing or not material_ok:
                primitive_contract_ok = False
                errors.append(
                    f"mesh node {node_index} ({node.get('name')}) primitive {primitive_index}: "
                    f"missing attributes={missing} material={material_index}"
                )
            if missing:
                continue
            try:
                joints_rows = retarget._read_accessor(
                    document,
                    binary,
                    int(attributes["JOINTS_0"]),
                )
                weights_rows = retarget._read_accessor(
                    document,
                    binary,
                    int(attributes["WEIGHTS_0"]),
                )
                texcoord_rows = retarget._read_accessor(
                    document,
                    binary,
                    int(attributes["TEXCOORD_0"]),
                )
            except Exception as exc:
                primitive_contract_ok = False
                errors.append(
                    f"mesh node {node_index} ({node.get('name')}) primitive {primitive_index}: "
                    f"attribute accessor read failed: {exc}"
                )
                continue
            if len(joints_rows) != len(weights_rows) or len(texcoord_rows) != len(weights_rows):
                primitive_contract_ok = False
                errors.append(
                    f"mesh node {node_index} ({node.get('name')}) primitive {primitive_index}: "
                    "attribute accessor counts differ"
                )
                continue
            for weights in weights_rows:
                active = [float(weight) for weight in weights if float(weight) > WEIGHT_EPSILON]
                if not active:
                    orphan_vertices += 1
                    continue
                weighted_vertices += 1
                single_influence_vertices += int(len(active) == 1)
                max_effective_influences = max(max_effective_influences, len(active))
                max_weight_sum_error = max(
                    max_weight_sum_error,
                    abs(sum(float(weight) for weight in weights) - 1.0),
                )

    primitive_weights_normalized = (
        weighted_vertices > 0
        and orphan_vertices == 0
        and max_weight_sum_error < 1e-6
    )
    effective_influences_ok = (
        weighted_vertices > 0
        and 1 <= max_effective_influences <= 2
    )
    not_fully_rigid = (
        weighted_vertices > 0
        and single_influence_vertices < weighted_vertices
    )
    if not primitive_weights_normalized:
        errors.append(
            "primitive weights are orphaned or not normalized: "
            f"vertices={weighted_vertices} orphans={orphan_vertices} "
            f"maxError={max_weight_sum_error}"
        )
    if not effective_influences_ok:
        errors.append(
            f"primitive effective influence count outside 1-2: max={max_effective_influences}"
        )
    if not not_fully_rigid:
        errors.append(
            "primitive weights are 100% single-influence: "
            f"{single_influence_vertices}/{weighted_vertices}"
        )

    if set(animation_names) != set(expected_action_names) or len(animation_names) != len(expected_action_names):
        errors.append(f"animation set mismatch: {animation_names}")
    if not meshes:
        errors.append("export contains no mesh")
    if len(skins) != 1:
        errors.append(f"expected one skin, found {len(skins)}")

    joint_names: list[str] = []
    if skins:
        for node_index in skins[0].get("joints", []):
            if isinstance(node_index, int) and 0 <= node_index < len(nodes):
                joint_names.append(str(nodes[node_index].get("name", "")))
    if set(joint_names) != set(EXPECTED_BONES) or len(joint_names) != len(EXPECTED_BONES):
        errors.append(f"skin joint mismatch: {joint_names}")

    finite_keyframes = True
    rotation_only = True
    targets_def_bones = True
    nonconstant_actions: set[str] = set()
    loop_closed = True
    linear_sampling = True

    loop_names = {name for name in expected_action_names if any(f"::{key}::" in name for key in ("idle", "move", "run"))}
    for animation in animations:
        animation_name = str(animation.get("name", ""))
        samplers = animation.get("samplers", []) or []
        for channel in animation.get("channels", []) or []:
            target = channel.get("target", {}) or {}
            node_index = target.get("node")
            path_name = target.get("path")
            if path_name != "rotation":
                rotation_only = False
                errors.append(f"{animation_name}: non-rotation channel {path_name}")
            target_name = nodes[node_index].get("name") if isinstance(node_index, int) and 0 <= node_index < len(nodes) else None
            if target_name not in EXPECTED_BONES:
                targets_def_bones = False
                errors.append(f"{animation_name}: channel targets {target_name}")
            sampler_index = channel.get("sampler")
            if not isinstance(sampler_index, int) or not 0 <= sampler_index < len(samplers):
                finite_keyframes = False
                errors.append(f"{animation_name}: invalid sampler index")
                continue
            sampler = samplers[sampler_index]
            try:
                times = retarget._read_accessor(document, binary, int(sampler["input"]))
                values = retarget._read_accessor(document, binary, int(sampler["output"]))
            except Exception as exc:
                finite_keyframes = False
                errors.append(f"{animation_name}: accessor read failed: {exc}")
                continue
            if sampler.get("interpolation", "LINEAR") != "LINEAR" or len(values) != len(times):
                linear_sampling = False
                errors.append(f"{animation_name}: sampler is not one-to-one LINEAR")
            flattened = [value for row in times + values for value in row]
            if not all(math.isfinite(float(value)) for value in flattened):
                finite_keyframes = False
                errors.append(f"{animation_name}: non-finite keyframe")
            if len(values) >= 2 and any(any(abs(float(a) - float(b)) > 1e-6 for a, b in zip(row, values[0])) for row in values[1:]):
                nonconstant_actions.add(animation_name)
            if animation_name in loop_names and values:
                dot = abs(sum(float(a) * float(b) for a, b in zip(values[0], values[-1])))
                if dot < 0.999:
                    loop_closed = False
                    errors.append(f"{animation_name}: loop closure dot={dot}")

    for action_name in expected_action_names:
        if action_name not in nonconstant_actions:
            errors.append(f"{action_name}: no non-constant track")

    checks = {
        "glb2": path.read_bytes()[:4] == b"glTF",
        "meshPresent": bool(meshes),
        "meshNodeCount5To9": mesh_node_count_ok,
        "singleSkin": len(skins) == 1,
        "allMeshNodesBoundToSingleSkin": all_mesh_nodes_bound,
        "semanticMeshNodeNames": semantic_names_ok,
        "primitiveSkinUvMaterialContract": primitive_contract_ok,
        "primitiveWeightsNormalized": primitive_weights_normalized,
        "effectiveInfluences1To2": effective_influences_ok,
        "notFullyRigid": not_fully_rigid,
        "expectedBoneSet": set(joint_names) == set(EXPECTED_BONES) and len(joint_names) == len(EXPECTED_BONES),
        "expectedClipSet": set(animation_names) == set(expected_action_names) and len(animation_names) == len(expected_action_names),
        "finiteKeyframes": finite_keyframes,
        "rotationOnly": rotation_only,
        "onlyDefBoneTracks": targets_def_bones,
        "loopClosure": loop_closed,
        "linearSampling": linear_sampling,
        "nonconstantActions": len(nonconstant_actions) == len(expected_action_names),
    }
    return {
        "checks": checks,
        "animationNames": animation_names,
        "jointNames": joint_names,
        "meshCount": len(meshes),
        "meshNodeCount": len(mesh_nodes),
        "meshNodeNames": mesh_node_names,
        "primitiveCount": primitive_count,
        "skinCount": len(skins),
        "weightStats": {
            "epsilon": WEIGHT_EPSILON,
            "vertices": weighted_vertices,
            "orphanVertices": orphan_vertices,
            "singleInfluenceVertices": single_influence_vertices,
            "singleInfluenceFraction": (
                single_influence_vertices / weighted_vertices
                if weighted_vertices
                else 0.0
            ),
            "maxInfluences": max_effective_influences,
            "maxWeightSumError": max_weight_sum_error,
        },
    }, errors


def main() -> int:
    args = parse_args()
    config_path = Path(args.config).resolve()
    config = json.loads(config_path.read_text(encoding="utf-8"))
    character = next((row for row in config["characters"] if row["assetId"] == args.asset_id), None)
    if character is None:
        raise KeyError(f"asset not present in config: {args.asset_id}")

    retarget = load_retarget_module()
    import bpy

    asset_id = str(character["assetId"])
    output_dir = config_path.parent / asset_id
    model_path = output_dir / "model.glb"
    review_path = output_dir / "review.blend"
    rig_report_path = output_dir / "rig-report.json"
    manifest_path = output_dir / "manifest.json"
    if not review_path.exists() or not rig_report_path.exists():
        raise FileNotFoundError(f"rig stage missing for {asset_id}")

    rig_report = json.loads(rig_report_path.read_text(encoding="utf-8"))
    if (
        rig_report.get("status") != "completed"
        or rig_report.get("restPose") != "natural"
        or rig_report.get("restPoseOk") is not True
    ):
        raise RuntimeError(
            f"natural-rest rig gate not passed for {asset_id}: "
            f"status={rig_report.get('status')} restPose={rig_report.get('restPose')}"
        )
    rig_receipt_validation, rig_receipt_errors = validate_rig_receipts(asset_id, rig_report)
    if rig_receipt_errors:
        raise RuntimeError(
            f"semantic/weight rig receipts not passed for {asset_id}: "
            + "; ".join(rig_receipt_errors)
        )


    bpy.ops.wm.open_mainfile(filepath=str(review_path))
    bpy.context.scene.render.fps = int(config.get("sourceFps", 24))
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"expected one target armature, found {len(armatures)}")
    target_armature = armatures[0]
    target_bones = [bone.name for bone in target_armature.data.bones]
    if set(target_bones) != set(EXPECTED_BONES) or len(target_bones) != len(EXPECTED_BONES):
        raise RuntimeError(f"target bone contract mismatch: {target_bones}")

    target_armature.animation_data_create()
    target_armature.animation_data.action = None
    for track in list(target_armature.animation_data.nla_tracks):
        target_armature.animation_data.nla_tracks.remove(track)
    for fallback in FALLBACK_ACTIONS:
        bake_existing_action_to_quaternion(
            target_armature,
            f"{asset_id}::{fallback}::v01",
            retarget._iter_action_fcurves,
        )

    audit = json.loads((REPO_ROOT / config["auditReport"]).read_text(encoding="utf-8"))
    audit_by_file = {row["file"]: row["metrics"] for row in audit["files"] if row.get("import_success")}
    motion_dir = REPO_ROOT / config["motionBench"]
    clip_rows: list[dict[str, Any]] = []

    for action_key in RETARGET_ACTIONS:
        motion = character["motions"].get(action_key)
        if not motion:
            raise RuntimeError(f"missing {action_key} motion preset for {asset_id}")
        source_name = str(motion["source"])
        source_path = motion_dir / source_name
        metrics = audit_by_file.get(source_name)
        if not source_path.exists() or metrics is None:
            raise FileNotFoundError(f"audited source missing: {source_path}")
        frame_range = metrics["frame_range"]
        action_name = f"{asset_id}::{action_key}::v01"
        gain = float(motion.get("gain", 1.0))
        if not 0.0 < gain <= 1.0:
            raise ValueError(f"gain must be within (0, 1]: {asset_id}/{action_key}={gain}")

        before_objects = set(bpy.data.objects)
        before_actions = set(bpy.data.actions)
        retarget.import_fbx(source_path)
        source_armature = next((obj for obj in bpy.data.objects if obj not in before_objects and obj.type == "ARMATURE"), None)
        if source_armature is None:
            raise RuntimeError(f"source armature missing after import: {source_name}")
        mapping_rows = [replace(row, weight=float(row.weight) * gain) for row in retarget.MAPPING_ROWS]
        retarget.bake_clip(
            target_armature=target_armature,
            source_armature=source_armature,
            frame_start=int(frame_range["start"]),
            frame_end=int(frame_range["end"]),
            action_name=action_name,
            mapping_rows=mapping_rows,
        )
        action = bpy.data.actions.get(action_name)
        if action is None:
            raise RuntimeError(f"retarget did not create action: {action_name}")
        action.use_fake_user = True
        if bool(motion.get("loop")):
            close_loop(action, retarget._iter_action_fcurves)
        set_linear_interpolation(action, retarget._iter_action_fcurves)
        target_armature.animation_data.action = None
        remove_imported_source(before_objects, before_actions, action)

        clip_rows.append({
            "action": action_key,
            "clipName": action_name,
            "source": source_name,
            "sourceSha256": sha256(source_path),
            "frameStart": int(frame_range["start"]),
            "frameEnd": int(frame_range["end"]),
            "sourceFps": int(metrics["scene_fps"]),
            "durationSeconds": (int(frame_range["end"]) - int(frame_range["start"])) / float(metrics["scene_fps"]),
            "sourceRootTravel": metrics.get("hips_displacement"),
            "loop": bool(motion.get("loop")),
            "gain": gain,
        })

    expected_action_names = [f"{asset_id}::{key}::v01" for key in RETARGET_ACTIONS + FALLBACK_ACTIONS]
    for fallback in FALLBACK_ACTIONS:
        action_name = f"{asset_id}::{fallback}::v01"
        action = bpy.data.actions.get(action_name)
        if action is None:
            raise RuntimeError(f"authored fallback missing: {action_name}")
        action.use_fake_user = True
        clip_rows.append({
            "action": fallback,
            "clipName": action_name,
            "source": "scripts/rig-character-asset-blender.py",
            "sourceSha256": sha256(REPO_ROOT / "scripts/rig-character-asset-blender.py"),
            "loop": False,
            "kind": "authored-fallback",
        })

    for action in list(bpy.data.actions):
        if action.name not in set(expected_action_names):
            bpy.data.actions.remove(action)
    build_tracks(target_armature, expected_action_names)

    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 120
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(review_path), copy=True)

    bpy.ops.object.select_all(action="DESELECT")
    export_objects = [obj for obj in bpy.data.objects if obj.type in {"EMPTY", "ARMATURE", "MESH"}]
    for obj in export_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = target_armature
    bpy.ops.export_scene.gltf(
        filepath=str(model_path),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=False,
        export_yup=True,
        export_skins=True,
        export_all_influences=False,
        export_lights=False,
        export_cameras=False,
    )
    if not model_path.exists():
        raise RuntimeError(f"GLB export missing: {model_path}")

    validation, glb_gate_errors = validate_glb(
        model_path,
        asset_id,
        expected_action_names,
        retarget,
    )
    validation["rigReportReceipts"] = rig_receipt_validation
    gate_errors = [*rig_receipt_errors, *glb_gate_errors]
    checks = dict(validation["checks"])
    checks.update(rig_receipt_validation["checks"])
    semantic_receipt = rig_receipt_validation["semanticPartition"]
    weight_receipt = rig_receipt_validation["adjacentWeightRepair"]
    weight_stats = validation["weightStats"]
    mesh_nodes_match_receipt = (
        len(validation["meshNodeNames"]) == len(semantic_receipt["partNames"])
        and set(validation["meshNodeNames"]) == set(semantic_receipt["partNames"])
    )
    # Semantic face partition duplicates boundary vertices by design. The GLB
    # therefore has a different vertex denominator than the pre-partition
    # receipt; compare invariant weight safety, not the duplicated fraction.
    receipt_weight_matches_glb = (
        int(weight_receipt["maxInfluences"]) == weight_stats["maxInfluences"]
        and 1 <= int(weight_stats["maxInfluences"]) <= 2
        and int(weight_stats["orphanVertices"]) == 0
        and float(weight_stats["maxWeightSumError"]) < 1e-6
        and 0.0 <= float(weight_stats["singleInfluenceFraction"]) < 1.0
    )
    validation["receiptCrossChecks"] = {
        "meshNodesMatchSemanticReceipt": mesh_nodes_match_receipt,
        "weightStatsMatchAdjacentReceipt": receipt_weight_matches_glb,
    }
    checks.update(validation["receiptCrossChecks"])
    if not mesh_nodes_match_receipt:
        gate_errors.append("GLB mesh nodes do not match semantic_partition receipt")
    if not receipt_weight_matches_glb:
        gate_errors.append("GLB weights do not match adjacent_weight_repair receipt")
    checks["rigStageCompleted"] = rig_report.get("status") == "completed"
    checks["rigNaturalRestPose"] = (
        rig_report.get("restPose") == "natural"
        and rig_report.get("restPoseOk") is True
    )
    checks["rigClipCountBeforeRetarget"] = int(rig_report.get("clipCount", 0)) == 11
    runtime_eligible = not gate_errors and all(checks.values())

    manifest = {
        "schemaVersion": 1,
        "generatedBy": "_workspace/current/engineering/asset-pipeline/tools/build-character-motion-library-blender.py",
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "assetId": asset_id,
        "role": character["role"],
        "category": character["category"],
        "source": character["source"],
        "sourceSha256": sha256(REPO_ROOT / character["source"]),
        "sourceRig": config["sourceRig"],
        "targetRig": config["targetRig"],
        "restPose": rig_report["restPose"],
        "model": str(model_path.relative_to(REPO_ROOT)),
        "modelSha256": sha256(model_path),
        "modelBytes": model_path.stat().st_size,
        "reviewBlend": str(review_path.relative_to(REPO_ROOT)),
        "rigReport": str(rig_report_path.relative_to(REPO_ROOT)),
        "targetBoneNames": list(EXPECTED_BONES),
        "clips": clip_rows,
        "rights": config["rights"],
        "rightsReceipt": "user-directed-runtime-use-retargeted-from-audited-bench-with-unverified-redistribution",
        "checks": checks,
        "validation": validation,
        "runtimeEligible": runtime_eligible,
        "gateErrors": gate_errors,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("CHARACTER_MOTION_RESULT_JSON:" + json.dumps({
        "assetId": asset_id,
        "model": str(model_path),
        "clipCount": len(expected_action_names),
        "runtimeEligible": runtime_eligible,
        "gateErrors": gate_errors,
    }, ensure_ascii=False))
    if not runtime_eligible:
        raise RuntimeError(f"character motion gates failed: {gate_errors}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
