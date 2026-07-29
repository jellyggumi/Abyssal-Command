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
import struct
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
QUATERNION_NORM_TOLERANCE = 1e-6
QUATERNION_CONTINUITY_TOLERANCE = -1e-6


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


def normalize_glb_quaternion_continuity(path: Path) -> dict[str, int]:
    raw = bytearray(path.read_bytes())
    if len(raw) < 20 or raw[:4] != b"glTF":
        raise ValueError(f"{path}: not a GLB file")
    version, declared_length = struct.unpack_from("<II", raw, 4)
    if version != 2 or declared_length != len(raw):
        raise ValueError(
            f"{path}: invalid GLB header version={version} "
            f"declaredLength={declared_length} actualLength={len(raw)}"
        )

    json_chunks: list[tuple[int, int]] = []
    bin_chunks: list[tuple[int, int]] = []
    chunk_types: list[int] = []
    offset = 12
    while offset < len(raw):
        if offset + 8 > len(raw):
            raise ValueError(f"{path}: truncated GLB chunk header at byte {offset}")
        chunk_length, chunk_type = struct.unpack_from("<II", raw, offset)
        if chunk_length % 4:
            raise ValueError(
                f"{path}: GLB chunk at byte {offset} is not 4-byte aligned"
            )
        chunk_start = offset + 8
        chunk_end = chunk_start + chunk_length
        if chunk_end > len(raw):
            raise ValueError(f"{path}: truncated GLB chunk at byte {offset}")
        if chunk_type == 0x4E4F534A:
            json_chunks.append((chunk_start, chunk_end))
        elif chunk_type == 0x004E4942:
            bin_chunks.append((chunk_start, chunk_end))
        chunk_types.append(chunk_type)
        offset = chunk_end
    if offset != len(raw):
        raise ValueError(f"{path}: GLB chunk lengths do not consume the file")
    if len(json_chunks) != 1 or len(bin_chunks) != 1:
        raise ValueError(
            f"{path}: expected one JSON and one BIN chunk, "
            f"found JSON={len(json_chunks)} BIN={len(bin_chunks)}"
        )
    if chunk_types[:2] != [0x4E4F534A, 0x004E4942]:
        raise ValueError(f"{path}: GLB JSON/BIN chunks are not first and second")

    json_start, json_end = json_chunks[0]
    try:
        json_text = bytes(raw[json_start:json_end]).decode("utf-8")
        document, json_payload_end = json.JSONDecoder().raw_decode(json_text)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"{path}: invalid GLB JSON chunk: {exc}") from exc
    if any(character != " " for character in json_text[json_payload_end:]):
        raise ValueError(f"{path}: GLB JSON chunk has invalid padding")
    if not isinstance(document, dict):
        raise ValueError(f"{path}: GLB JSON payload is not an object")
    asset = document.get("asset")
    if (
        not isinstance(asset, dict)
        or asset.get("version") != "2.0"
        or asset.get("minVersion") not in (None, "2.0")
    ):
        raise ValueError(f"{path}: unsupported glTF asset version: {asset}")

    accessors = document.get("accessors")
    buffer_views = document.get("bufferViews")
    buffers = document.get("buffers")
    animations = document.get("animations")
    nodes = document.get("nodes")
    if not isinstance(accessors, list):
        raise ValueError(f"{path}: GLB accessors are missing")
    if not isinstance(buffer_views, list):
        raise ValueError(f"{path}: GLB bufferViews are missing")
    if not isinstance(buffers, list):
        raise ValueError(f"{path}: GLB buffers are missing")
    if not isinstance(animations, list):
        raise ValueError(f"{path}: GLB animations are missing")
    nodes = nodes if isinstance(nodes, list) else []
    bin_start, bin_end = bin_chunks[0]
    binary_length = bin_end - bin_start
    if not buffers or not isinstance(buffers[0], dict) or "uri" in buffers[0]:
        raise ValueError(f"{path}: GLB buffer 0 is missing or external")
    declared_binary_length = buffers[0].get("byteLength")
    binary_padding_length = (
        binary_length - declared_binary_length
        if isinstance(declared_binary_length, int)
        and not isinstance(declared_binary_length, bool)
        else -1
    )
    if (
        binary_padding_length not in (0, 1, 2, 3)
        or any(raw[bin_start + declared_binary_length : bin_end])
    ):
        raise ValueError(
            f"{path}: invalid GLB BIN byteLength/padding "
            f"declared={declared_binary_length} actual={binary_length}"
        )

    rotation_outputs: dict[int, tuple[str, str]] = {}
    non_rotation_outputs: set[int] = set()
    sampler_inputs: set[int] = set()
    for animation_index, animation in enumerate(animations):
        if not isinstance(animation, dict):
            raise ValueError(f"{path}: animation {animation_index} is not an object")
        animation_name = str(animation.get("name", f"animation[{animation_index}]"))
        samplers = animation.get("samplers")
        channels = animation.get("channels")
        if not isinstance(samplers, list) or not isinstance(channels, list):
            raise ValueError(f"{path}: {animation_name}: samplers/channels are invalid")
        for channel_index, channel in enumerate(channels):
            if not isinstance(channel, dict):
                raise ValueError(
                    f"{path}: {animation_name}: channel {channel_index} is not an object"
                )
            sampler_index = channel.get("sampler")
            if (
                not isinstance(sampler_index, int)
                or isinstance(sampler_index, bool)
                or not 0 <= sampler_index < len(samplers)
            ):
                raise ValueError(
                    f"{path}: {animation_name}: channel {channel_index} "
                    f"has invalid sampler {sampler_index}"
                )
            sampler = samplers[sampler_index]
            if not isinstance(sampler, dict):
                raise ValueError(
                    f"{path}: {animation_name}: sampler {sampler_index} is not an object"
                )
            input_index = sampler.get("input")
            if (
                not isinstance(input_index, int)
                or isinstance(input_index, bool)
                or not 0 <= input_index < len(accessors)
            ):
                raise ValueError(
                    f"{path}: {animation_name}: sampler {sampler_index} "
                    f"has invalid input accessor {input_index}"
                )
            sampler_inputs.add(input_index)
            output_index = sampler.get("output")
            if (
                not isinstance(output_index, int)
                or isinstance(output_index, bool)
                or not 0 <= output_index < len(accessors)
            ):
                raise ValueError(
                    f"{path}: {animation_name}: sampler {sampler_index} "
                    f"has invalid output accessor {output_index}"
                )
            target = channel.get("target")
            target = target if isinstance(target, dict) else {}
            target_path = target.get("path")
            if target_path != "rotation":
                non_rotation_outputs.add(output_index)
                continue
            if sampler.get("interpolation", "LINEAR") != "LINEAR":
                raise ValueError(
                    f"{path}: {animation_name}: rotation sampler {sampler_index} "
                    f"uses unsupported interpolation "
                    f"{sampler.get('interpolation')}"
                )
            node_index = target.get("node")
            node_name = (
                str(nodes[node_index].get("name", f"node[{node_index}]"))
                if isinstance(node_index, int)
                and not isinstance(node_index, bool)
                and 0 <= node_index < len(nodes)
                and isinstance(nodes[node_index], dict)
                else f"node[{node_index}]"
            )
            rotation_outputs.setdefault(output_index, (animation_name, node_name))

    shared_with_non_rotation = sorted(set(rotation_outputs).intersection(non_rotation_outputs))
    if shared_with_non_rotation:
        raise ValueError(
            f"{path}: rotation output accessors are shared with non-rotation channels: "
            f"{shared_with_non_rotation}"
        )
    shared_with_inputs = sorted(set(rotation_outputs).intersection(sampler_inputs))
    if shared_with_inputs:
        raise ValueError(
            f"{path}: rotation output accessors are shared with sampler inputs: "
            f"{shared_with_inputs}"
        )

    component_sizes = {
        5120: 1,
        5121: 1,
        5122: 2,
        5123: 2,
        5125: 4,
        5126: 4,
    }
    component_counts = {
        "SCALAR": 1,
        "VEC2": 2,
        "VEC3": 3,
        "VEC4": 4,
        "MAT2": 4,
        "MAT3": 9,
        "MAT4": 16,
    }

    def accessor_element_size(accessor: dict[str, Any]) -> int | None:
        component_size = component_sizes.get(accessor.get("componentType"))
        component_count = component_counts.get(accessor.get("type"))
        if component_size is None or component_count is None:
            return None
        accessor_type = accessor["type"]
        if accessor_type.startswith("MAT"):
            matrix_size = int(accessor_type[-1])
            column_size = matrix_size * component_size
            return matrix_size * ((column_size + 3) // 4 * 4)
        return component_size * component_count

    def storage_layout(
        view_index: Any,
        byte_offset: Any,
        count: Any,
        element_size: Any,
    ) -> tuple[int, int, int, int] | None:
        if (
            not isinstance(view_index, int)
            or isinstance(view_index, bool)
            or not 0 <= view_index < len(buffer_views)
            or not isinstance(byte_offset, int)
            or isinstance(byte_offset, bool)
            or byte_offset < 0
            or not isinstance(count, int)
            or isinstance(count, bool)
            or count <= 0
            or not isinstance(element_size, int)
            or isinstance(element_size, bool)
            or element_size <= 0
        ):
            return None
        view = buffer_views[view_index]
        if not isinstance(view, dict) or view.get("buffer") != 0:
            return None
        view_offset = view.get("byteOffset", 0)
        stride = view.get("byteStride", element_size)
        if (
            not isinstance(view_offset, int)
            or isinstance(view_offset, bool)
            or view_offset < 0
            or not isinstance(stride, int)
            or isinstance(stride, bool)
            or stride < element_size
        ):
            return None
        return view_offset + byte_offset, count, stride, element_size

    def accessor_layout(accessor: Any) -> tuple[int, int, int, int] | None:
        if not isinstance(accessor, dict):
            return None
        return storage_layout(
            accessor.get("bufferView"),
            accessor.get("byteOffset", 0),
            accessor.get("count"),
            accessor_element_size(accessor),
        )

    def whole_view_layout(view_index: Any) -> tuple[int, int, int, int] | None:
        if (
            not isinstance(view_index, int)
            or isinstance(view_index, bool)
            or not 0 <= view_index < len(buffer_views)
        ):
            return None
        view = buffer_views[view_index]
        if not isinstance(view, dict) or view.get("buffer") != 0:
            return None
        view_length = view.get("byteLength")
        return storage_layout(view_index, 0, 1, view_length)

    def overlaps_rotation_spans(
        rotation_spans: list[tuple[int, int]],
        layout: tuple[int, int, int, int],
    ) -> bool:
        start, count, stride, element_size = layout
        layout_end = start + (count - 1) * stride + element_size
        for rotation_start, rotation_end in rotation_spans:
            if rotation_end <= start or rotation_start >= layout_end:
                continue
            first = max(
                0,
                (rotation_start - start - element_size) // stride + 1,
            )
            last = min(count - 1, (rotation_end - 1 - start) // stride)
            if first <= last:
                return True
        return False

    non_rotation_references = set(sampler_inputs).union(non_rotation_outputs)
    for mesh in document.get("meshes", []) or []:
        if not isinstance(mesh, dict):
            continue
        for primitive in mesh.get("primitives", []) or []:
            if not isinstance(primitive, dict):
                continue
            if isinstance(primitive.get("indices"), int):
                non_rotation_references.add(primitive["indices"])
            attributes = primitive.get("attributes")
            if isinstance(attributes, dict):
                non_rotation_references.update(
                    value for value in attributes.values() if isinstance(value, int)
                )
            for target in primitive.get("targets", []) or []:
                if isinstance(target, dict):
                    non_rotation_references.update(
                        value for value in target.values() if isinstance(value, int)
                    )
    for skin in document.get("skins", []) or []:
        if isinstance(skin, dict) and isinstance(skin.get("inverseBindMatrices"), int):
            non_rotation_references.add(skin["inverseBindMatrices"])
    shared_with_other_data = sorted(
        set(rotation_outputs).intersection(non_rotation_references)
    )
    if shared_with_other_data:
        raise ValueError(
            f"{path}: rotation output accessors are reused by non-rotation data: "
            f"{shared_with_other_data}"
        )

    rotation_span_sets: dict[int, list[tuple[int, int]]] = {}
    for accessor_index in rotation_outputs:
        layout = accessor_layout(accessors[accessor_index])
        if layout is None:
            continue
        start, count, stride, element_size = layout
        rotation_span_sets[accessor_index] = [
            (
                start + key_index * stride,
                start + key_index * stride + element_size,
            )
            for key_index in range(count)
        ]

    rotation_span_rows = sorted(rotation_span_sets.items())
    for row_index, (accessor_index, spans) in enumerate(rotation_span_rows):
        for other_index, other_spans in rotation_span_rows[row_index + 1 :]:
            other_layout = accessor_layout(accessors[other_index])
            if other_layout is not None and overlaps_rotation_spans(spans, other_layout):
                raise ValueError(
                    f"{path}: rotation accessors {accessor_index} and {other_index} "
                    "alias BIN bytes"
                )

    other_layouts: list[tuple[str, tuple[int, int, int, int]]] = []
    for other_index, other_accessor in enumerate(accessors):
        if other_index in rotation_outputs or not isinstance(other_accessor, dict):
            continue
        base_layout = accessor_layout(other_accessor)
        if base_layout is not None:
            other_layouts.append((f"accessor {other_index}", base_layout))
        elif "bufferView" in other_accessor:
            view_layout = whole_view_layout(other_accessor.get("bufferView"))
            if view_layout is not None:
                other_layouts.append((f"accessor {other_index}", view_layout))

        sparse = other_accessor.get("sparse")
        if not isinstance(sparse, dict):
            continue
        sparse_count = sparse.get("count")
        sparse_indices = sparse.get("indices")
        if isinstance(sparse_indices, dict):
            indices_layout = storage_layout(
                sparse_indices.get("bufferView"),
                sparse_indices.get("byteOffset", 0),
                sparse_count,
                component_sizes.get(sparse_indices.get("componentType")),
            )
            if indices_layout is None:
                indices_layout = whole_view_layout(sparse_indices.get("bufferView"))
            if indices_layout is not None:
                other_layouts.append(
                    (f"accessor {other_index} sparse indices", indices_layout)
                )
        sparse_values = sparse.get("values")
        if isinstance(sparse_values, dict):
            values_layout = storage_layout(
                sparse_values.get("bufferView"),
                sparse_values.get("byteOffset", 0),
                sparse_count,
                accessor_element_size(other_accessor),
            )
            if values_layout is None:
                values_layout = whole_view_layout(sparse_values.get("bufferView"))
            if values_layout is not None:
                other_layouts.append(
                    (f"accessor {other_index} sparse values", values_layout)
                )

    for image_index, image in enumerate(document.get("images", []) or []):
        if not isinstance(image, dict) or "bufferView" not in image:
            continue
        image_layout = whole_view_layout(image.get("bufferView"))
        if image_layout is not None:
            other_layouts.append((f"image {image_index}", image_layout))

    for accessor_index, rotation_spans in rotation_span_sets.items():
        for owner, owner_layout in other_layouts:
            if overlaps_rotation_spans(rotation_spans, owner_layout):
                raise ValueError(
                    f"{path}: rotation accessor {accessor_index} aliases {owner} BIN bytes"
                )

    rotation_keyframes = 0
    sign_flips = 0
    for accessor_index, (animation_name, node_name) in rotation_outputs.items():
        accessor = accessors[accessor_index]
        context = (
            f"{path}: clip={animation_name} node={node_name} "
            f"accessor={accessor_index}"
        )
        if not isinstance(accessor, dict):
            raise ValueError(f"{context}: accessor is not an object")
        if "sparse" in accessor:
            raise ValueError(f"{context}: sparse rotation outputs are unsupported")
        if accessor.get("componentType") != 5126 or accessor.get("type") != "VEC4":
            raise ValueError(
                f"{context}: rotation output must be FLOAT VEC4, "
                f"found componentType={accessor.get('componentType')} "
                f"type={accessor.get('type')}"
            )
        if "normalized" in accessor and accessor["normalized"] is not False:
            raise ValueError(f"{context}: normalized FLOAT accessor is invalid")
        count = accessor.get("count")
        if (
            not isinstance(count, int)
            or isinstance(count, bool)
            or count <= 0
        ):
            raise ValueError(f"{context}: invalid accessor count {count}")
        view_index = accessor.get("bufferView")
        if (
            not isinstance(view_index, int)
            or isinstance(view_index, bool)
            or not 0 <= view_index < len(buffer_views)
        ):
            raise ValueError(f"{context}: bufferless or invalid output accessor")
        view = buffer_views[view_index]
        if not isinstance(view, dict):
            raise ValueError(f"{context}: bufferView {view_index} is not an object")
        buffer_index = view.get("buffer")
        if (
            not isinstance(buffer_index, int)
            or isinstance(buffer_index, bool)
            or buffer_index != 0
            or buffer_index >= len(buffers)
        ):
            raise ValueError(
                f"{context}: bufferView {view_index} has invalid buffer {buffer_index}"
            )
        buffer = buffers[buffer_index]
        if not isinstance(buffer, dict) or "uri" in buffer:
            raise ValueError(f"{context}: rotation output is not backed by the GLB BIN chunk")
        buffer_length = buffer.get("byteLength")
        if (
            not isinstance(buffer_length, int)
            or isinstance(buffer_length, bool)
            or buffer_length < 0
            or buffer_length > binary_length
        ):
            raise ValueError(
                f"{context}: invalid buffer byteLength {buffer_length} "
                f"for BIN length {binary_length}"
            )
        view_offset = view.get("byteOffset", 0)
        view_length = view.get("byteLength")
        accessor_offset = accessor.get("byteOffset", 0)
        stride = view.get("byteStride", 16)
        if (
            not isinstance(view_offset, int)
            or isinstance(view_offset, bool)
            or view_offset < 0
            or view_offset % 4
            or not isinstance(view_length, int)
            or isinstance(view_length, bool)
            or view_length < 0
            or not isinstance(accessor_offset, int)
            or isinstance(accessor_offset, bool)
            or accessor_offset < 0
            or accessor_offset % 4
            or not isinstance(stride, int)
            or isinstance(stride, bool)
            or stride < 16
            or stride > 252
            or stride % 4
        ):
            raise ValueError(
                f"{context}: invalid offsets/length/stride "
                f"viewOffset={view_offset} viewLength={view_length} "
                f"accessorOffset={accessor_offset} stride={stride}"
            )
        view_end = view_offset + view_length
        accessor_end = accessor_offset + (count - 1) * stride + 16
        if view_end > buffer_length or accessor_end > view_length:
            raise ValueError(
                f"{context}: accessor range exceeds its bufferView or buffer "
                f"viewEnd={view_end} bufferLength={buffer_length} "
                f"accessorEnd={accessor_end} viewLength={view_length}"
            )

        previous: tuple[float, float, float, float] | None = None
        previous_norm = 0.0
        for key_index in range(count):
            value_offset = bin_start + view_offset + accessor_offset + key_index * stride
            quaternion = struct.unpack_from("<4f", raw, value_offset)
            if not all(math.isfinite(value) for value in quaternion):
                raise ValueError(f"{context}: key={key_index} contains non-finite values")
            quaternion_norm = math.sqrt(sum(value * value for value in quaternion))
            if (
                not math.isfinite(quaternion_norm)
                or abs(quaternion_norm - 1.0) > QUATERNION_NORM_TOLERANCE
            ):
                raise ValueError(
                    f"{context}: key={key_index} quaternion norm={quaternion_norm} "
                    f"exceeds tolerance={QUATERNION_NORM_TOLERANCE}"
                )
            if previous is not None:
                dot = (
                    sum(a * b for a, b in zip(previous, quaternion))
                    / (previous_norm * quaternion_norm)
                )
                if dot < 0.0:
                    quaternion = tuple(-value for value in quaternion)
                    struct.pack_into("<4f", raw, value_offset, *quaternion)
                    sign_flips += 1
            previous = quaternion
            previous_norm = quaternion_norm
            rotation_keyframes += 1

    path.write_bytes(raw)
    return {
        "rotationAccessors": len(rotation_outputs),
        "rotationKeyframes": rotation_keyframes,
        "signFlips": sign_flips,
    }


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
    with path.open("rb") as handle:
        glb_header = handle.read(12)
    document_asset = document.get("asset")
    glb2 = (
        len(glb_header) == 12
        and glb_header[:4] == b"glTF"
        and struct.unpack_from("<I", glb_header, 4)[0] == 2
        and struct.unpack_from("<I", glb_header, 8)[0] == path.stat().st_size
        and isinstance(document_asset, dict)
        and document_asset.get("version") == "2.0"
        and document_asset.get("minVersion") in (None, "2.0")
    )
    if not glb2:
        errors.append("GLB 2.0 container/asset version contract failed")
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
    quaternion_continuity = True
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
            if path_name == "rotation":
                normalized_values: list[tuple[float, float, float, float] | None] = []
                for key_index, row in enumerate(values):
                    if len(row) != 4 or not all(math.isfinite(float(value)) for value in row):
                        quaternion_continuity = False
                        normalized_values.append(None)
                        errors.append(
                            f"quaternion invalid clip={animation_name} node={target_name} "
                            f"key={key_index}"
                        )
                        continue
                    quaternion = tuple(float(value) for value in row)
                    quaternion_norm = math.sqrt(sum(value * value for value in quaternion))
                    if (
                        not math.isfinite(quaternion_norm)
                        or abs(quaternion_norm - 1.0) > QUATERNION_NORM_TOLERANCE
                    ):
                        quaternion_continuity = False
                        normalized_values.append(None)
                        errors.append(
                            f"quaternion invalid clip={animation_name} node={target_name} "
                            f"key={key_index} norm={quaternion_norm}"
                        )
                        continue
                    normalized_values.append(
                        tuple(value / quaternion_norm for value in quaternion)
                    )
                for key_index in range(1, len(normalized_values)):
                    previous = normalized_values[key_index - 1]
                    current = normalized_values[key_index]
                    if previous is None or current is None:
                        continue
                    dot = sum(a * b for a, b in zip(previous, current))
                    if dot < QUATERNION_CONTINUITY_TOLERANCE:
                        quaternion_continuity = False
                        errors.append(
                            f"quaternion continuity violation clip={animation_name} "
                            f"node={target_name} key={key_index} dot={dot}"
                        )
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
        "glb2": glb2,
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
        "quaternionContinuity": quaternion_continuity,
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

    quaternion_normalization = normalize_glb_quaternion_continuity(model_path)

    validation, glb_gate_errors = validate_glb(
        model_path,
        asset_id,
        expected_action_names,
        retarget,
    )
    validation["rigReportReceipts"] = rig_receipt_validation
    validation["quaternionNormalization"] = quaternion_normalization
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
