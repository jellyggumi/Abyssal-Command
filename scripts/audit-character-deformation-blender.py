#!/usr/bin/env python3
"""Deterministic Blender deformation gate for staged character GLBs.

Reads the raw overlay GLB directly from its JSON/BIN payload and evaluates all
canonical unarmed-core clips against staged character rigs without mutating any
assets.
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import sys
from bisect import bisect_right
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

import bpy
import mathutils

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STAGING_ROOT = Path("/tmp/rig-staging")
DEFAULT_OVERLAY = REPO_ROOT / "assets/motion/ingame/unarmed-core.glb"
DEFAULT_OUTPUT = REPO_ROOT / "_workspace/current/engineering/asset-pipeline/motion-bench/deformation-gate-report.json"
DEFAULT_CATEGORIES = ("commander", "companions", "enemies", "bosses")

CANONICAL_CLIP_NAMES = (
    "unarmed-core::idle::v01",
    "unarmed-core::move::v01",
    "unarmed-core::run::v01",
    "unarmed-core::hit::v01",
    "unarmed-core::bighit::v01",
    "unarmed-core::attack::v01",
    "unarmed-core::critical::v01",
    "unarmed-core::avoid::v01",
    "unarmed-core::defence::v01",
)

EXPECTED_DEF_BONES = (
    "DEF-spine",
    "DEF-spine.001",
    "DEF-spine.002",
    "DEF-spine.003",
    "DEF-spine.004",
    "DEF-spine.005",
    "DEF-pelvis.L",
    "DEF-pelvis.R",
    "DEF-shoulder.L",
    "DEF-upper_arm.L",
    "DEF-forearm.L",
    "DEF-hand.L",
    "DEF-shoulder.R",
    "DEF-upper_arm.R",
    "DEF-forearm.R",
    "DEF-hand.R",
    "DEF-thigh.L",
    "DEF-shin.L",
    "DEF-foot.L",
    "DEF-toe.L",
    "DEF-thigh.R",
    "DEF-shin.R",
    "DEF-foot.R",
    "DEF-toe.R",
)

EXPECTED_BONE_SET = set(EXPECTED_DEF_BONES)


BONE_JOINT_CHAIN_MAP = {
    "shoulder.L": ("DEF-shoulder.L", ("DEF-shoulder.L", "DEF-upper_arm.L")),
    "elbow.L": ("DEF-forearm.L", ("DEF-upper_arm.L", "DEF-forearm.L")),
    "wrist.L": ("DEF-hand.L", ("DEF-forearm.L", "DEF-hand.L")),
    "hip.L": ("DEF-thigh.L", ("DEF-pelvis.L", "DEF-thigh.L")),
    "knee.L": ("DEF-shin.L", ("DEF-thigh.L", "DEF-shin.L")),
    "ankle.L": ("DEF-foot.L", ("DEF-shin.L", "DEF-foot.L", "DEF-toe.L")),
    "shoulder.R": ("DEF-shoulder.R", ("DEF-shoulder.R", "DEF-upper_arm.R")),
    "elbow.R": ("DEF-forearm.R", ("DEF-upper_arm.R", "DEF-forearm.R")),
    "wrist.R": ("DEF-hand.R", ("DEF-forearm.R", "DEF-hand.R")),
    "hip.R": ("DEF-thigh.R", ("DEF-pelvis.R", "DEF-thigh.R")),
    "knee.R": ("DEF-shin.R", ("DEF-thigh.R", "DEF-shin.R")),
    "ankle.R": ("DEF-foot.R", ("DEF-shin.R", "DEF-foot.R", "DEF-toe.R")),
}


COMPONENT_TYPES = {
    5120: ("b", 1, True),
    5121: ("B", 1, False),
    5122: ("h", 2, True),
    5123: ("H", 2, False),
    5125: ("I", 4, False),
    5126: ("f", 4, True),
}
TYPE_COUNTS = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
    "MAT2": 4,
    "MAT3": 9,
    "MAT4": 16,
}

THRESHOLDS: dict[str, Any] = {
    # Broad defaults: intentionally conservative for offline triage and tuning.
    "preflight": {
        "expectedArmatureCount": 1,
        "maxOrphanVertices": 0,
        "maxNonDefEffectiveGroups": 0,
        "maxNegativeWeights": 0,
        "maxNonFiniteWeights": 0,
        "maxWeightNormalizationAbsError": 2e-3,
        "maxInfluencesPerVertex": 4,
        "maxCanonicalRestRotationDeviationDeg": 0.1,
        "expectedEnabledArmatureModifiersPerMesh": 1,
        "expectedTargetingRigModifiersPerMesh": 1,
    },
    "deformation": {
        "bboxAxisRatio": {"min": 0.0, "max": 10.0},
        "bboxDiagonalRatio": {"min": 0.0, "max": 10.0},
        "edgeRatioP01": {"min": 0.0, "max": 10.0},
        "edgeRatioP50": {"min": 0.0, "max": 10.0},
        "edgeRatioP99": {"min": 0.0, "max": 10.0},
        "triangleDegenerateFraction": {"max": 0.30},
        "maxVertexDisplacement": {"max": 5.0},
        "p99VertexDisplacement": {"max": 1.5},
        "jointRadiusRatio": {"min": 0.0, "max": 12.0},
        "penetrationDepthByHeight": {"max": 0.06},
    },
}
EPS = 1e-9
WEIGHT_EPSILON = 1e-6


@dataclass(frozen=True)
class ParsedTrack:
    bone_name: str
    interpolation: str
    times: tuple[float, ...]
    quats: tuple[mathutils.Quaternion, ...]


@dataclass(frozen=True)
class ParsedClip:
    name: str
    tracks: Mapping[str, ParsedTrack]
    sample_times: tuple[float, ...]


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="audit staged character deformation")
    parser.add_argument("--staging-root", type=Path, default=DEFAULT_STAGING_ROOT)
    parser.add_argument("--categories", nargs="+", default=list(DEFAULT_CATEGORIES))
    parser.add_argument("--overlay", type=Path, default=DEFAULT_OVERLAY)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)

    raw = list(sys.argv[1:] if argv is None else argv)
    if "--" in raw:
        raw = raw[raw.index("--") + 1 :]
    return parser.parse_args(raw)


def parse_glb_json_and_bin(path: Path) -> tuple[dict[str, Any], bytes]:
    raw = path.read_bytes()
    if len(raw) < 12 or raw[:4] != b"glTF":
        raise ValueError(f"{path} is not a GLB")

    offset = 12
    json_doc: dict[str, Any] | None = None
    bin_data = b""

    while offset + 8 <= len(raw):
        chunk_length = struct.unpack_from("<I", raw, offset)[0]
        chunk_type = struct.unpack_from("<I", raw, offset + 4)[0]
        chunk_data = raw[offset + 8 : offset + 8 + chunk_length]

        if chunk_type == 0x4E4F534A:  # JSON
            json_doc = json.loads(chunk_data.decode("utf-8"))
        elif chunk_type == 0x004E4942:  # BIN
            bin_data = chunk_data

        offset += 8 + chunk_length

    if json_doc is None:
        raise ValueError(f"{path} missing JSON chunk")

    return json_doc, bin_data


def _read_accessor(json_doc: Mapping[str, Any], bin_data: bytes, accessor_idx: int) -> list[list[float]]:
    accessors = json_doc.get("accessors")
    if not isinstance(accessors, list) or accessor_idx < 0 or accessor_idx >= len(accessors):
        raise ValueError(f"invalid accessor index: {accessor_idx}")

    accessor = accessors[accessor_idx]
    buffer_views = json_doc.get("bufferViews")
    if not isinstance(buffer_views, list):
        raise ValueError("missing bufferViews")

    view_idx = accessor.get("bufferView")
    if not isinstance(view_idx, int) or view_idx < 0 or view_idx >= len(buffer_views):
        raise ValueError("invalid bufferView index")

    if accessor.get("sparse"):
        raise ValueError("sparse accessors are unsupported")

    view = buffer_views[view_idx]
    comp_type = int(accessor["componentType"])
    comp_fmt, comp_size, _ = COMPONENT_TYPES[comp_type]
    comp_count = TYPE_COUNTS[accessor["type"]]
    count = int(accessor["count"])

    base_off = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
    stride = int(view.get("byteStride", comp_size * comp_count))

    out: list[list[float]] = []
    for i in range(count):
        row_off = base_off + i * stride
        row: list[float] = []
        for j in range(comp_count):
            byte_off = row_off + j * comp_size
            val = struct.unpack_from(f"<{comp_fmt}", bin_data, byte_off)[0]
            row.append(float(val))
        out.append(row)

    return out


def _quat_xyzw_to_mathutils(values: Sequence[float]) -> mathutils.Quaternion:
    if len(values) != 4:
        raise ValueError("rotation rows must be VEC4")
    q = mathutils.Quaternion((float(values[3]), float(values[0]), float(values[1]), float(values[2])))
    if not all(math.isfinite(v) for v in q):
        raise ValueError("non-finite quaternion component")
    q_norm2 = q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z
    if q_norm2 <= EPS * EPS:
        raise ValueError("zero-length quaternion")
    return q.normalized()


def _clamp(v: float) -> float:
    return max(-1.0, min(1.0, v))


def sample_quat(track: ParsedTrack, t: float) -> mathutils.Quaternion:
    if len(track.times) == 1 or t <= track.times[0]:
        return track.quats[0]
    if t >= track.times[-1]:
        return track.quats[-1]

    idx = bisect_right(track.times, t) - 1
    if idx < 0:
        return track.quats[0]
    if idx >= len(track.times) - 1:
        return track.quats[-1]

    if track.interpolation == "STEP":
        return track.quats[idx]

    t0 = track.times[idx]
    t1 = track.times[idx + 1]
    if t1 == t0:
        return track.quats[idx]

    q0 = track.quats[idx]
    q1 = track.quats[idx + 1]
    if q0.dot(q1) < 0.0:
        q1 = mathutils.Quaternion((-q1.w, -q1.x, -q1.y, -q1.z))
    alpha = (t - t0) / (t1 - t0)
    return q0.slerp(q1, alpha)


def parse_overlay_overlay(path: Path) -> tuple[dict[str, ParsedClip], list[str], dict[str, Any]]:
    json_doc, bin_data = parse_glb_json_and_bin(path)

    checks: dict[str, Any] = {
        "expectedClipCount": True,
        "requiredClipNames": True,
        "expectedBoneTargets": True,
        "rotationOnly": True,
        "supportedInterpolation": True,
        "sampleTimesPresent": True,
    }

    animations = json_doc.get("animations", []) or []
    nodes = json_doc.get("nodes", []) or []
    node_names = [node.get("name", "") if isinstance(node, Mapping) else "" for node in nodes]

    errors: list[str] = []
    if len(animations) != len(CANONICAL_CLIP_NAMES):
        checks["expectedClipCount"] = False
        errors.append(f"expected {len(CANONICAL_CLIP_NAMES)} animations, got {len(animations)}")

    clips: dict[str, ParsedClip] = {}
    found_names: set[str] = set()

    for anim in animations:
        name = anim.get("name")
        if name is None:
            errors.append("animation missing name")
            checks["requiredClipNames"] = False
            continue
        if name not in CANONICAL_CLIP_NAMES:
            checks["requiredClipNames"] = False
            errors.append(f"unexpected animation name: {name}")
            continue
        if name in clips:
            checks["requiredClipNames"] = False
            errors.append(f"duplicate animation name: {name}")
            continue

        found_names.add(name)

        channels = anim.get("channels") or []
        samplers = anim.get("samplers") or []
        if not channels:
            checks["expectedBoneTargets"] = False
            errors.append(f"{name}: has no channels")
            continue

        tracks: dict[str, ParsedTrack] = {}
        for channel in channels:
            target = channel.get("target") or {}
            if target.get("path") != "rotation":
                checks["rotationOnly"] = False
                errors.append(f"{name}: non-rotation target path={target.get('path')}")
                continue

            node_idx = target.get("node")
            if not isinstance(node_idx, int) or not (0 <= node_idx < len(node_names)):
                errors.append(f"{name}: invalid target node {node_idx}")
                continue

            bone_name = node_names[node_idx]
            if not bone_name:
                errors.append(f"{name}: target node index {node_idx} missing name")
                continue
            if bone_name not in EXPECTED_BONE_SET:
                checks["expectedBoneTargets"] = False
                errors.append(f"{name}: target bone {bone_name} is not canonical DEF bone")
                continue
            if bone_name in tracks:
                errors.append(f"{name}: duplicate track for {bone_name}")
                continue

            sampler_idx = channel.get("sampler")
            if not isinstance(sampler_idx, int) or not (0 <= sampler_idx < len(samplers)):
                errors.append(f"{name}:{bone_name}: invalid sampler index {sampler_idx}")
                continue
            sampler = samplers[sampler_idx]
            interpolation = str(sampler.get("interpolation", "LINEAR")).upper()
            if interpolation not in {"LINEAR", "STEP"}:
                checks["supportedInterpolation"] = False
                errors.append(f"{name}:{bone_name}: unsupported interpolation {interpolation}")
                continue

            try:
                input_idx = int(sampler["input"])
                output_idx = int(sampler["output"])
                input_rows = _read_accessor(json_doc, bin_data, input_idx)
                output_rows = _read_accessor(json_doc, bin_data, output_idx)
            except Exception as exc:
                errors.append(f"{name}:{bone_name}: accessor parse failed: {exc}")
                continue

            if len(input_rows) != len(output_rows):
                checks["expectedBoneTargets"] = False
                errors.append(f"{name}:{bone_name}: input/output length mismatch")
                continue
            if not input_rows:
                errors.append(f"{name}:{bone_name}: empty keyframes")
                continue

            times: list[float] = []
            prev = None
            good_times = True
            for row in input_rows:
                if len(row) != 1:
                    good_times = False
                    errors.append(f"{name}:{bone_name}: malformed time row {row}")
                    break
                t = float(row[0])
                if not math.isfinite(t):
                    good_times = False
                    errors.append(f"{name}:{bone_name}: non-finite time {t}")
                    break
                if prev is not None and t < prev:
                    good_times = False
                    errors.append(f"{name}:{bone_name}: non-monotonic time {t} < {prev}")
                times.append(t)
                prev = t
            if not good_times:
                continue

            quats: list[mathutils.Quaternion] = []
            for row in output_rows:
                try:
                    q = _quat_xyzw_to_mathutils(row)
                except Exception as exc:
                    errors.append(f"{name}:{bone_name}: invalid quaternion {row}: {exc}")
                    break
                quats.append(q)
            if len(quats) != len(times):
                continue

            tracks[bone_name] = ParsedTrack(
                bone_name=bone_name,
                interpolation=interpolation,
                times=tuple(times),
                quats=tuple(quats),
            )

        if set(tracks) != EXPECTED_BONE_SET:
            checks["expectedBoneTargets"] = False
            missing = sorted(EXPECTED_BONE_SET.difference(tracks))
            extra = sorted(set(tracks).difference(EXPECTED_BONE_SET))
            if missing:
                errors.append(f"{name}: missing target bones: {', '.join(missing)}")
            if extra:
                errors.append(f"{name}: extra target bones: {', '.join(extra)}")

        sample_times = tuple(sorted({float(t) for track in tracks.values() for t in track.times}))
        if not sample_times:
            checks["sampleTimesPresent"] = False
            errors.append(f"{name}: no sample times")

        clips[name] = ParsedClip(name=name, tracks=tracks, sample_times=sample_times)

    expected_set = set(CANONICAL_CLIP_NAMES)
    if found_names != expected_set:
        checks["requiredClipNames"] = False
        missing = sorted(expected_set.difference(found_names))
        extra = sorted(found_names.difference(expected_set))
        if missing:
            errors.append(f"missing required animation(s): {', '.join(missing)}")
        if extra:
            errors.append(f"unexpected animation(s): {', '.join(extra)}")

    return clips, errors, checks


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 24
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()

def import_glb(path: Path) -> None:
    bpy.ops.import_scene.gltf(filepath=str(path))


def collect_scene_objects() -> tuple[list[Any], list[Any]]:
    armatures: list[Any] = []
    meshes: list[Any] = []
    for obj in bpy.context.scene.objects:
        if obj.type == "ARMATURE":
            armatures.append(obj)
        elif obj.type == "MESH":
            parent = obj.parent
            has_armature_ancestor = False
            while parent is not None:
                if parent.type == "ARMATURE":
                    has_armature_ancestor = True
                    break
                parent = parent.parent
            has_armature_modifier = any(mod.type == "ARMATURE" for mod in obj.modifiers)
            if has_armature_ancestor or has_armature_modifier:
                meshes.append(obj)
    return armatures, meshes


def is_skinned_mesh(mesh_obj: Any, armature_obj: Any) -> bool:
    if len(mesh_obj.vertex_groups) > 0:
        return True
    return any(
        mod.type == "ARMATURE"
        and mod.show_viewport
        and getattr(mod, "object", None) is armature_obj
        for mod in mesh_obj.modifiers
    )


def _percentile(sorted_vals: list[float], q: float) -> float:
    if not sorted_vals:
        return float("nan")
    if q <= 0:
        return sorted_vals[0]
    if q >= 1:
        return sorted_vals[-1]
    p = (len(sorted_vals) - 1) * q
    lo = int(math.floor(p))
    hi = int(math.ceil(p))
    if lo == hi:
        return sorted_vals[lo]
    frac = p - lo
    return sorted_vals[lo] * (1.0 - frac) + sorted_vals[hi] * frac


def _bbox(values: Sequence[mathutils.Vector]) -> dict[str, Any]:
    min_v = mathutils.Vector((math.inf, math.inf, math.inf))
    max_v = mathutils.Vector((-math.inf, -math.inf, -math.inf))
    for v in values:
        min_v.x = min(min_v.x, v.x)
        min_v.y = min(min_v.y, v.y)
        min_v.z = min(min_v.z, v.z)
        max_v.x = max(max_v.x, v.x)
        max_v.y = max(max_v.y, v.y)
        max_v.z = max(max_v.z, v.z)

    extent = max_v - min_v
    return {
        "min": min_v,
        "max": max_v,
        "extent": extent,
        "diagonal": float(extent.length),
    }


def _triangle_area(a: mathutils.Vector, b: mathutils.Vector, c: mathutils.Vector) -> float:
    return (b - a).cross(c - a).length * 0.5


def _collect_mesh_groups(mesh_obj) -> list[int]:
    group_names = {g.index: g.name for g in mesh_obj.vertex_groups}
    out: list[int] = []
    for v in mesh_obj.data.vertices:
        weights = [mesh_obj.vertex_groups[idx].name for idx in {g.group for g in v.groups if g.group in group_names}]
        if not weights:
            out.append(v.index)
    return out


def collect_weight_stats(mesh_obj) -> dict[str, Any]:
    group_name_by_index = {g.index: g.name for g in mesh_obj.vertex_groups}

    orphan_vertices = 0
    negative_weight_vertices = 0
    non_finite_weight_vertices = 0
    max_norm_error = 0.0
    over_influence_vertices = 0
    non_def_groups: set[str] = set()

    for v in mesh_obj.data.vertices:
        effective_count = 0
        weight_sum = 0.0
        has_effective = False
        for vg in v.groups:
            weight = float(vg.weight)
            if not math.isfinite(weight):
                non_finite_weight_vertices += 1
                continue
            if weight < 0.0:
                negative_weight_vertices += 1
                continue
            if weight > WEIGHT_EPSILON:
                has_effective = True
                effective_count += 1
                weight_sum += weight
                group_name = group_name_by_index.get(vg.group)
                if group_name and not group_name.startswith("DEF-"):
                    non_def_groups.add(group_name)

        if not has_effective:
            orphan_vertices += 1
            continue

        max_norm_error = max(max_norm_error, abs(weight_sum - 1.0))
        if effective_count > THRESHOLDS["preflight"]["maxInfluencesPerVertex"]:
            over_influence_vertices += 1

    return {
        "orphanVertices": orphan_vertices,
        "negativeWeightVertices": negative_weight_vertices,
        "nonFiniteWeightVertices": non_finite_weight_vertices,
        "nonDefWeightGroups": len(non_def_groups),
        "nonDefWeightGroupNames": sorted(non_def_groups),
        "overInfluenceVertices": over_influence_vertices,
        "weightNormErrorMax": max_norm_error,
    }


def inspect_armature_modifiers(mesh_obj, armature_obj) -> dict[str, Any]:
    mods = [mod for mod in mesh_obj.modifiers if mod.type == "ARMATURE" and mod.show_viewport]
    targeting = sum(1 for mod in mods if getattr(mod, "object", None) == armature_obj)
    return {
        "enabledArmatureModifierCount": len(mods),
        "enabledArmatureModifiersTargetingRig": targeting,
    }


def _collect_vertex_indices_by_groups(mesh_obj, target_groups: Sequence[str], min_weight: float = WEIGHT_EPSILON) -> list[int]:
    target = set(target_groups)
    if not target:
        return []
    index_by_group = {g.index: g.name for g in mesh_obj.vertex_groups}
    out: list[int] = []
    for v in mesh_obj.data.vertices:
        use = False
        for vg in v.groups:
            if abs(vg.weight) <= min_weight:
                continue
            group_name = index_by_group.get(vg.group)
            if group_name in target:
                use = True
                break
        if use:
            out.append(v.index)
    return out




def prepare_mesh_context(mesh_obj, armature_obj) -> dict[str, Any]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    eval_obj = mesh_obj.evaluated_get(depsgraph)
    eval_mesh = eval_obj.to_mesh()
    try:
        rest_vertices = [mesh_obj.matrix_world @ v.co.copy() for v in eval_mesh.vertices]
        edges = [(e.vertices[0], e.vertices[1]) for e in eval_mesh.edges]

        # Polygon triangulation via fan (sufficient for ratio metrics and degenerate proxy)
        triangles: list[tuple[int, int, int]] = []
        for poly in eval_mesh.polygons:
            idxs = tuple(poly.vertices)
            if len(idxs) < 3:
                continue
            if len(idxs) == 3:
                triangles.append((idxs[0], idxs[1], idxs[2]))
            else:
                for i in range(1, len(idxs) - 1):
                    triangles.append((idxs[0], idxs[i], idxs[i + 1]))

        valid_edges: list[tuple[int, int, float]] = []
        for i, j in edges:
            dist = (rest_vertices[i] - rest_vertices[j]).length
            if dist > 1e-8:
                valid_edges.append((i, j, dist))

        valid_triangles: list[tuple[int, int, int, float]] = []
        for a, b, c in triangles:
            area = _triangle_area(rest_vertices[a], rest_vertices[b], rest_vertices[c])
            if area > 1e-10:
                valid_triangles.append((a, b, c, area))

        rest_bbox = _bbox(rest_vertices)

        context: dict[str, Any] = {
            "name": mesh_obj.name,
            "restVertices": rest_vertices,
            "restBBox": {
                "extent": rest_bbox["extent"],
                "diagonal": rest_bbox["diagonal"],
            },
            "edges": edges,
            "validEdges": valid_edges,
            "triangles": triangles,
            "validTriangles": [(a, b, c) for a, b, c, _ in valid_triangles],
            "validTriangleAreas": [area for (_a, _b, _c, area) in valid_triangles],
            "vertexCount": len(rest_vertices),
            "jointIndicesByName": {
                joint_name: _collect_vertex_indices_by_groups(mesh_obj, source_groups)
                for joint_name, (joint_bone, source_groups) in BONE_JOINT_CHAIN_MAP.items()
            },
        }
        return context
    finally:
        eval_obj.to_mesh_clear()


def _mesh_deformed_vertices(mesh_obj) -> list[mathutils.Vector]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    eval_obj = mesh_obj.evaluated_get(depsgraph)
    eval_mesh = eval_obj.to_mesh()
    try:
        return [mesh_obj.matrix_world @ v.co.copy() for v in eval_mesh.vertices]
    finally:
        eval_obj.to_mesh_clear()


def extract_node_rest_rotations(json_doc: Mapping[str, Any]) -> dict[str, mathutils.Quaternion]:
    rotations: dict[str, mathutils.Quaternion] = {}
    for node in json_doc.get("nodes", []):
        name = node.get("name")
        if name not in EXPECTED_BONE_SET:
            continue
        rotations[name] = _quat_xyzw_to_mathutils(node.get("rotation", [0.0, 0.0, 0.0, 1.0]))
    return rotations




def evaluate_canonical_rest_rotations(
    asset_rotations: Mapping[str, mathutils.Quaternion],
    canonical_rotations: Mapping[str, mathutils.Quaternion],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    metrics: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    threshold = THRESHOLDS["preflight"]["maxCanonicalRestRotationDeviationDeg"]

    for bone_name in EXPECTED_DEF_BONES:
        asset_q = asset_rotations.get(bone_name)
        canonical_q = canonical_rotations.get(bone_name)
        if asset_q is None or canonical_q is None:
            failures.append(
                {
                    "metric": "canonicalRestRotationNode",
                    "observed": {
                        "assetPresent": asset_q is not None,
                        "canonicalPresent": canonical_q is not None,
                    },
                    "threshold": "bone present in asset and canonical overlay",
                    "label": bone_name,
                }
            )
            continue

        dot = abs(_clamp(asset_q.normalized().dot(canonical_q.normalized())))
        angle_deg = math.degrees(2.0 * math.acos(dot))
        metrics.append({"bone": bone_name, "angleDeg": angle_deg})
        if angle_deg > threshold:
            failures.append(
                {
                    "metric": "canonicalRestRotationDeviationDeg",
                    "observed": angle_deg,
                    "threshold": threshold,
                    "label": bone_name,
                }
            )

    return metrics, failures


def reset_armature_pose(armature_obj) -> None:
    # Imported character GLBs carry their authored action library. Detach any
    # active action/NLA evaluation so only the audited overlay drives the pose.
    if armature_obj.animation_data is not None:
        armature_obj.animation_data_clear()
    for pose_bone in armature_obj.pose.bones:
        pose_bone.matrix_basis = mathutils.Matrix.Identity(4)
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()


def _finite_vec(v: mathutils.Vector) -> bool:
    return all(math.isfinite(v[i]) for i in range(3))


def _record_failure(
    failures: list[dict[str, Any]],
    *,
    asset: str,
    clip: str | None,
    frame_time: float | None,
    metric: str,
    observed: Any,
    threshold: Any,
    label: str,
) -> None:
    failures.append(
        {
            "asset": asset,
            "clip": clip,
            "frameTime": frame_time,
            "metric": metric,
            "observed": observed,
            "threshold": threshold,
            "label": label,
        }
    )


def _update_extrema(extrema: dict[str, Any], key: str, value: float, *, frame_time: float, mesh_name: str) -> None:
    if not math.isfinite(value):
        return
    bucket = extrema.setdefault(
        key,
        {
            "min": {"value": value, "frameTime": frame_time, "mesh": mesh_name},
            "max": {"value": value, "frameTime": frame_time, "mesh": mesh_name},
            "rawMin": value,
            "rawMax": value,
        },
    )
    if value < bucket["min"]["value"]:
        bucket["min"] = {"value": value, "frameTime": frame_time, "mesh": mesh_name}
    if value > bucket["max"]["value"]:
        bucket["max"] = {"value": value, "frameTime": frame_time, "mesh": mesh_name}
    bucket["rawMin"] = min(bucket["rawMin"], value)
    bucket["rawMax"] = max(bucket["rawMax"], value)


def _safe_value(v: float) -> float:
    return float("nan") if not math.isfinite(v) else float(v)


def _evaluate_frame(
    mesh_ctx: Mapping[str, Any],
    deformed_vertices: Sequence[mathutils.Vector],
    armature_obj,
    clip_name: str,
    asset_id: str,
    frame_time: float,
    failures: list[dict[str, Any]],
    rest_joint_world: Mapping[str, mathutils.Vector],
) -> tuple[dict[str, Any], dict[str, float]]:
    mesh_name = str(mesh_ctx["name"])
    stats: dict[str, Any] = {"time": frame_time, "mesh": mesh_name}
    metric_extrema: dict[str, float] = {}

    if len(deformed_vertices) != int(mesh_ctx["vertexCount"]):
        _record_failure(
            failures,
            asset=asset_id,
            clip=clip_name,
            frame_time=frame_time,
            metric="vertexCountConsistency",
            observed={"deformed": len(deformed_vertices), "rest": mesh_ctx["vertexCount"]},
            threshold="equal",
            label=mesh_name,
        )
        return {"time": frame_time, "mesh": mesh_name}, metric_extrema

    if not all(_finite_vec(v) for v in deformed_vertices):
        _record_failure(
            failures,
            asset=asset_id,
            clip=clip_name,
            frame_time=frame_time,
            metric="finiteVertexCoordinates",
            observed="non-finite deformed vertex coordinate",
            threshold="all finite",
            label=mesh_name,
        )

    # Bounding-box ratios.
    deformed_bbox = _bbox(deformed_vertices)
    rest_extent = mesh_ctx["restBBox"]["extent"]
    rest_diag = float(mesh_ctx["restBBox"]["diagonal"])
    deformed_diag = float(deformed_bbox["diagonal"])

    ratios: dict[str, float] = {}
    for axis in ("x", "y", "z"):
        rest_v = float(getattr(rest_extent, axis))
        cur_v = float(getattr(deformed_bbox["extent"], axis))
        if rest_v > EPS:
            ratio = cur_v / rest_v
        elif cur_v <= EPS:
            ratio = 0.0
        else:
            ratio = float("inf")
        ratios[axis] = ratio
        metric_extrema[f"bboxAxisRatio:{axis}"] = ratio

    ratio_diag = deformed_diag / rest_diag if rest_diag > EPS else (0.0 if deformed_diag <= EPS else float("inf"))
    ratios["diagonal"] = ratio_diag
    metric_extrema["bboxDiagonalRatio"] = ratio_diag
    stats["bboxRatios"] = ratios

    if not math.isfinite(deformed_diag):
        _record_failure(
            failures,
            asset=asset_id,
            clip=clip_name,
            frame_time=frame_time,
            metric="finiteDeformedBBox",
            observed="non-finite bbox values",
            threshold="finite",
            label=mesh_name,
        )

    # Edge ratio quantiles, excluding degenerate rest edges.
    edge_ratios: list[float] = []
    for i, j, rest_len in mesh_ctx["validEdges"]:
        ratio = (deformed_vertices[i] - deformed_vertices[j]).length / rest_len
        if math.isfinite(ratio):
            edge_ratios.append(ratio)
    if edge_ratios:
        edge_ratios.sort()
        p01 = _percentile(edge_ratios, 0.01)
        p50 = _percentile(edge_ratios, 0.50)
        p99 = _percentile(edge_ratios, 0.99)
    else:
        p01 = p50 = p99 = float("nan")

    stats["edgeRatio"] = {
        "p01": _safe_value(p01),
        "p50": _safe_value(p50),
        "p99": _safe_value(p99),
        "validCount": len(edge_ratios),
        "droppedDegenerateRestEdges": len(mesh_ctx["edges"]) - len(edge_ratios),
    }
    metric_extrema["edgeRatioP01"] = p01
    metric_extrema["edgeRatioP50"] = p50
    metric_extrema["edgeRatioP99"] = p99

    # Triangle deformation ratio proxy: fraction becoming near-degenerate.
    deg_count = 0
    tri_total = len(mesh_ctx["validTriangles"])
    if tri_total > 0:
        for (a, b, c), rest_area in zip(mesh_ctx["validTriangles"], mesh_ctx["validTriangleAreas"]):
            cur_area = _triangle_area(deformed_vertices[a], deformed_vertices[b], deformed_vertices[c])
            if cur_area <= rest_area * 0.05:
                deg_count += 1
    tri_frac = (deg_count / tri_total) if tri_total > 0 else 0.0
    stats["triangleDegenerateFraction"] = tri_frac
    metric_extrema["triangleDegenerateFraction"] = tri_frac

    # Vertex displacement normalized by rest-height.
    rest_height = max(1.0, mesh_ctx["restBBox"]["extent"].z)
    displacements: list[float] = []
    rest_vertices = mesh_ctx["restVertices"]
    for rest_v, def_v in zip(rest_vertices, deformed_vertices):
        displacements.append((def_v - rest_v).length / rest_height)
    displacements_sorted = sorted(displacements)
    max_disp = displacements_sorted[-1] if displacements_sorted else 0.0
    p99_disp = _percentile(displacements_sorted, 0.99) if displacements_sorted else 0.0
    stats["vertexDisplacement"] = {
        "max": max_disp,
        "p99": _safe_value(p99_disp),
        "count": len(displacements_sorted),
    }
    metric_extrema["maxVertexDisplacement"] = max_disp
    metric_extrema["p99VertexDisplacement"] = p99_disp

    # Joint neighborhood radius ratio.
    joint_scores: dict[str, Any] = {}
    for joint_name, (joint_bone, _source_groups) in BONE_JOINT_CHAIN_MAP.items():
        source_idx = mesh_ctx["jointIndicesByName"].get(joint_name, [])
        if not source_idx:
            continue

        pose_bone = armature_obj.pose.bones.get(joint_bone)
        if pose_bone is None:
            continue

        j_rest = rest_joint_world.get(joint_bone)
        j_def = armature_obj.matrix_world @ pose_bone.head
        if j_rest is None or j_def is None:
            continue

        rest_radius = 0.0
        def_radius = 0.0
        for vi in source_idx:
            r = (rest_vertices[vi] - j_rest).length
            d = (deformed_vertices[vi] - j_def).length
            if r > rest_radius:
                rest_radius = r
            if d > def_radius:
                def_radius = d

        ratio = def_radius / rest_radius if rest_radius > EPS else (0.0 if def_radius <= EPS else float("inf"))
        joint_scores[joint_name] = {
            "jointBone": joint_bone,
            "vertexCount": len(source_idx),
            "jointRestRadius": rest_radius,
            "jointDeformedRadius": def_radius,
            "ratio": ratio,
        }
        metric_extrema[f"jointRadius:{joint_name}"] = ratio

    stats["jointNeighborhood"] = joint_scores

    # Catastrophic limb-through-torso proxy. The central torso capsule is
    # derived from animated hip/shoulder joints, so coats and capes cannot
    # create false positives merely by surrounding a hand or foot.
    def _bone_head_world(bone_name: str) -> mathutils.Vector | None:
        pose_bone = armature_obj.pose.bones.get(bone_name)
        return armature_obj.matrix_world @ pose_bone.head if pose_bone is not None else None

    hip_points = [_bone_head_world(name) for name in ("DEF-thigh.L", "DEF-thigh.R")]
    shoulder_points = [_bone_head_world(name) for name in ("DEF-upper_arm.L", "DEF-upper_arm.R")]
    hip_points = [point for point in hip_points if point is not None]
    shoulder_points = [point for point in shoulder_points if point is not None]

    if len(hip_points) == 2 and len(shoulder_points) == 2:
        torso_lower = (hip_points[0] + hip_points[1]) * 0.5
        torso_upper = (shoulder_points[0] + shoulder_points[1]) * 0.5
        torso_radius = max(
            (hip_points[0] - hip_points[1]).length,
            (shoulder_points[0] - shoulder_points[1]).length,
        ) * 0.35
    else:
        torso_lower = torso_upper = mathutils.Vector((0.0, 0.0, 0.0))
        torso_radius = 0.0

    torso_segment = torso_upper - torso_lower
    torso_segment_len2 = torso_segment.length_squared

    def _penetration_for_bones(bone_names: Sequence[str]) -> dict[str, float]:
        if not bone_names or torso_radius <= EPS or torso_segment_len2 <= EPS:
            return {"fraction": 0.0, "maxDepth": 0.0, "samples": 0, "penetrating": 0}

        penetrating = 0
        max_depth = 0.0
        samples = 0
        for bone_name in bone_names:
            point = _bone_head_world(bone_name)
            if point is None:
                continue
            samples += 1
            alpha = _clamp((point - torso_lower).dot(torso_segment) / torso_segment_len2)
            nearest_axis_point = torso_lower + torso_segment * alpha
            depth = torso_radius - (point - nearest_axis_point).length
            if depth <= rest_height * 0.002:
                continue
            penetrating += 1
            max_depth = max(max_depth, float(depth))

        return {
            "fraction": penetrating / samples if samples else 0.0,
            "maxDepth": max_depth,
            "samples": samples,
            "penetrating": penetrating,
        }

    hand_proxy = _penetration_for_bones(("DEF-hand.L", "DEF-hand.R"))
    foot_proxy = _penetration_for_bones(("DEF-foot.L", "DEF-foot.R"))
    stats["penetration"] = {
        "hand": hand_proxy,
        "foot": foot_proxy,
        "method": "joint center inside animated torso core capsule",
        "torsoRadius": torso_radius,
        "torsoRadiusByHeight": torso_radius / rest_height,
    }

    metric_extrema["handPenetrationFraction"] = float(hand_proxy["fraction"])
    metric_extrema["footPenetrationFraction"] = float(foot_proxy["fraction"])
    metric_extrema["handPenetrationDepthByHeight"] = float(hand_proxy["maxDepth"]) / rest_height
    metric_extrema["footPenetrationDepthByHeight"] = float(foot_proxy["maxDepth"]) / rest_height

    # Threshold checks with explicit evidence.
    for axis in ("x", "y", "z"):
        observed = ratios[axis]
        t = THRESHOLDS["deformation"]["bboxAxisRatio"]
        if not (t["min"] <= observed <= t["max"]):
            _record_failure(
                failures,
                asset=asset_id,
                clip=clip_name,
                frame_time=frame_time,
                metric=f"bboxAxisRatio{axis.upper()}",
                observed=observed,
                threshold=t,
                label=mesh_name,
            )

    t = THRESHOLDS["deformation"]["bboxDiagonalRatio"]
    if not (t["min"] <= ratio_diag <= t["max"]):
        _record_failure(
            failures,
            asset=asset_id,
            clip=clip_name,
            frame_time=frame_time,
            metric="bboxDiagonalRatio",
            observed=ratio_diag,
            threshold=t,
            label=mesh_name,
        )

    if not math.isfinite(p01):
        _record_failure(
            failures,
            asset=asset_id,
            clip=clip_name,
            frame_time=frame_time,
            metric="edgeRatioP01",
            observed=p01,
            threshold=THRESHOLDS["deformation"]["edgeRatioP01"],
            label=mesh_name,
        )
    else:
        t = THRESHOLDS["deformation"]["edgeRatioP01"]
        if not (t["min"] <= p01 <= t["max"]):
            _record_failure(
                failures,
                asset=asset_id,
                clip=clip_name,
                frame_time=frame_time,
                metric="edgeRatioP01",
                observed=p01,
                threshold=t,
                label=mesh_name,
            )

    for key in ("edgeRatioP50", "edgeRatioP99"):
        val = metric_extrema[key]
        t = THRESHOLDS["deformation"][key if key != "edgeRatioP50" else "edgeRatioP50"]
        if not math.isfinite(val):
            _record_failure(
                failures,
                asset=asset_id,
                clip=clip_name,
                frame_time=frame_time,
                metric=key,
                observed=val,
                threshold=t,
                label=mesh_name,
            )
        elif not (t["min"] <= val <= t["max"]):
            _record_failure(
                failures,
                asset=asset_id,
                clip=clip_name,
                frame_time=frame_time,
                metric=key,
                observed=val,
                threshold=t,
                label=mesh_name,
            )

    t = THRESHOLDS["deformation"]["triangleDegenerateFraction"]
    if tri_frac > t["max"]:
        _record_failure(
            failures,
            asset=asset_id,
            clip=clip_name,
            frame_time=frame_time,
            metric="triangleDegenerateFraction",
            observed=tri_frac,
            threshold=t,
            label=mesh_name,
        )

    t = THRESHOLDS["deformation"]["maxVertexDisplacement"]
    if max_disp > t["max"]:
        _record_failure(
            failures,
            asset=asset_id,
            clip=clip_name,
            frame_time=frame_time,
            metric="maxVertexDisplacementNormalized",
            observed=max_disp,
            threshold=t,
            label=mesh_name,
        )

    t = THRESHOLDS["deformation"]["p99VertexDisplacement"]
    if p99_disp > t["max"]:
        _record_failure(
            failures,
            asset=asset_id,
            clip=clip_name,
            frame_time=frame_time,
            metric="p99VertexDisplacementNormalized",
            observed=p99_disp,
            threshold=t,
            label=mesh_name,
        )

    for joint_name, entry in joint_scores.items():
        t = THRESHOLDS["deformation"]["jointRadiusRatio"]
        if not (t["min"] <= entry["ratio"] <= t["max"]):
            _record_failure(
                failures,
                asset=asset_id,
                clip=clip_name,
                frame_time=frame_time,
                metric="jointNeighborhoodRadiusRatio",
                observed=entry["ratio"],
                threshold=t,
                label=f"{mesh_name}:{joint_name}",
            )


    depth_t = THRESHOLDS["deformation"]["penetrationDepthByHeight"]
    hand_depth_norm = float(hand_proxy["maxDepth"]) / rest_height
    foot_depth_norm = float(foot_proxy["maxDepth"]) / rest_height
    if hand_proxy["samples"] > 0 and hand_depth_norm > depth_t["max"]:
        _record_failure(
            failures,
            asset=asset_id,
            clip=clip_name,
            frame_time=frame_time,
            metric="handPenetrationDepthNormalizedByHeight",
            observed=hand_depth_norm,
            threshold=depth_t,
            label=mesh_name,
        )
    if foot_proxy["samples"] > 0 and foot_depth_norm > depth_t["max"]:
        _record_failure(
            failures,
            asset=asset_id,
            clip=clip_name,
            frame_time=frame_time,
            metric="footPenetrationDepthNormalizedByHeight",
            observed=foot_depth_norm,
            threshold=depth_t,
            label=mesh_name,
        )

    return stats, metric_extrema


def evaluate_clip(
    armature_obj,
    mesh_contexts: Sequence[Mapping[str, Any]],
    mesh_objects: Sequence[Any],
    clip: ParsedClip,
    asset_id: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    failures: list[dict[str, Any]] = []
    frame_reports: list[dict[str, Any]] = []
    extrema: dict[str, Any] = {}

    # Reset once per clip.
    for bone_name in EXPECTED_BONE_SET:
        pose_bone = armature_obj.pose.bones.get(bone_name)
        if pose_bone:
            pose_bone.matrix_basis = mathutils.Matrix.Identity(4)
    bpy.context.view_layer.update()

    rest_joint_world = {
        name: armature_obj.matrix_world @ armature_obj.pose.bones[name].head
        for name in EXPECTED_BONE_SET
        if armature_obj.pose.bones.get(name) is not None
    }

    for frame_time in clip.sample_times:
        for bone_name in EXPECTED_BONE_SET:
            pose_bone = armature_obj.pose.bones.get(bone_name)
            if pose_bone is None:
                _record_failure(
                    failures,
                    asset=asset_id,
                    clip=clip.name,
                    frame_time=frame_time,
                    metric="missingPoseBone",
                    observed=bone_name,
                    threshold="pose bone present",
                    label=bone_name,
                )
                continue

            track = clip.tracks.get(bone_name)
            if track is None:
                _record_failure(
                    failures,
                    asset=asset_id,
                    clip=clip.name,
                    frame_time=frame_time,
                    metric="missingClipTrack",
                    observed=bone_name,
                    threshold="track exists for every canonical bone",
                    label=bone_name,
                )
                continue

            delta_q = sample_quat(track, frame_time)
            pose_bone.matrix_basis = delta_q.to_matrix().to_4x4()

        bpy.context.view_layer.update()

        for mesh_ctx, mesh_obj in zip(mesh_contexts, mesh_objects):
            deformed_vertices = _mesh_deformed_vertices(mesh_obj)
            frame_result, frame_metric_extrema = _evaluate_frame(
                mesh_ctx=mesh_ctx,
                deformed_vertices=deformed_vertices,
                armature_obj=armature_obj,
                clip_name=clip.name,
                asset_id=asset_id,
                frame_time=frame_time,
                failures=failures,
                rest_joint_world=rest_joint_world,
            )
            if frame_metric_extrema:
                for key, value in frame_metric_extrema.items():
                    _update_extrema(extrema, key, value, frame_time=frame_time, mesh_name=str(mesh_ctx["name"]))
            frame_reports.append(frame_result)

    # Keep metric extrema only once per clip.
    clip_report = {
        "name": clip.name,
        "sampleCount": len(clip.sample_times),
        "sampleTimes": list(clip.sample_times),
        "extrema": {
            key: {
                "min": entry["min"],
                "max": entry["max"],
                "rawMin": entry["rawMin"],
                "rawMax": entry["rawMax"],
            }
            for key, entry in sorted(extrema.items())
        },
        "frames": frame_reports,
        "passed": True,
        "failures": [],
    }

    for entry in failures:
        if entry.get("asset") == asset_id and entry.get("clip") == clip.name:
            clip_report["failures"].append(entry)
    clip_report["passed"] = len(clip_report["failures"]) == 0

    return clip_report, clip_report["failures"]


def find_assets(staging_root: Path, categories: Sequence[str]) -> list[Path]:
    out: list[Path] = []
    for category in categories:
        category_dir = staging_root / category
        if not category_dir.is_dir():
            continue
        out.extend(sorted(category_dir.glob("*.glb")))
    return out


def _serialize(obj: Any) -> Any:
    if isinstance(obj, mathutils.Vector):
        return [float(v) for v in obj]
    if isinstance(obj, mathutils.Matrix):
        return [[float(v) for v in row] for row in obj]
    if isinstance(obj, set):
        return sorted(obj)
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return str(obj)
    return obj


def run() -> tuple[int, dict[str, Any]]:
    args = parse_args()

    staging_root = args.staging_root
    overlay_path = args.overlay
    if not overlay_path.is_absolute():
        overlay_path = (REPO_ROOT / overlay_path).resolve()
    output_path = args.output
    if not output_path.is_absolute():
        output_path = (REPO_ROOT / output_path).resolve()

    contract = {
        "version": "1.0.0",
        "name": "character-deformation-gate",
        "sampling": "sample every source keyframe time per clip",
        "interpolation": "LINEAR|STEP",
        "expectedClips": list(CANONICAL_CLIP_NAMES),
        "expectedBones": list(EXPECTED_DEF_BONES),
        "armatureMode": "raw local-rest-relative quaternion deltas into poseBone.matrix_basis",
    }

    metadata = {
        "repositoryRoot": str(REPO_ROOT),
        "stagingRoot": str(staging_root),
        "overlay": str(overlay_path),
        "categories": list(args.categories),
        "output": str(output_path),
    }

    failures: list[dict[str, Any]] = []
    all_asset_reports: list[dict[str, Any]] = []
    overlay_checks: dict[str, Any] = {}
    overlay_clips: dict[str, ParsedClip] = {}
    overlay_rest_rotations: dict[str, mathutils.Quaternion] = {}

    def emit_report() -> dict[str, Any]:
        report: dict[str, Any] = {
            "contract": contract,
            "metadata": metadata,
            "thresholds": THRESHOLDS,
            "overlay": {
                "path": str(overlay_path),
                "checks": overlay_checks,
                "clipCount": len(overlay_clips),
            },
            "assets": all_asset_reports,
            "failures": failures,
            "summary": {
                "assetCount": len(all_asset_reports),
                "clipCount": len(CANONICAL_CLIP_NAMES),
                "failureCount": len(failures),
                "passed": len(failures) == 0,
            },
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, indent=2, default=_serialize))
        return report

    if not overlay_path.exists():
        failures.append(
            {
                "asset": None,
                "clip": None,
                "frameTime": None,
                "metric": "overlayPath",
                "observed": str(overlay_path),
                "threshold": "existing overlay GLB",
                "label": "overlay",
            }
        )
        return 1, emit_report()

    overlay_clips, overlay_errors, overlay_checks = parse_overlay_overlay(overlay_path)
    overlay_json_doc, _ = parse_glb_json_and_bin(overlay_path)
    overlay_rest_rotations = extract_node_rest_rotations(overlay_json_doc)
    for msg in overlay_errors:
        failures.append(
            {
                "asset": None,
                "clip": None,
                "frameTime": None,
                "metric": "overlayValidation",
                "observed": msg,
                "threshold": overlay_checks,
                "label": "overlay",
            }
        )

    if overlay_errors:
        return 1, emit_report()

    if not staging_root.exists():
        failures.append(
            {
                "asset": None,
                "clip": None,
                "frameTime": None,
                "metric": "stagingRoot",
                "observed": str(staging_root),
                "threshold": "existing directory",
                "label": "staging",
            }
        )
        return 1, emit_report()

    asset_paths = find_assets(staging_root, args.categories)
    metadata["assetCountDiscovered"] = len(asset_paths)
    if not asset_paths:
        failures.append(
            {
                "asset": None,
                "clip": None,
                "frameTime": None,
                "metric": "stagingAssets",
                "observed": 0,
                "threshold": "at least one staged asset",
                "label": "staging",
            }
        )

    for asset_path in asset_paths:
        asset_id = str(asset_path)
        reset_scene()
        try:
            asset_json_doc, _ = parse_glb_json_and_bin(asset_path)
            asset_rest_rotations = extract_node_rest_rotations(asset_json_doc)
            import_glb(asset_path)
        except Exception as exc:
            failures.append(
                {
                    "asset": asset_id,
                    "clip": None,
                    "frameTime": None,
                    "metric": "assetImport",
                    "observed": f"{exc}",
                    "threshold": "importable GLB",
                    "label": asset_path.name,
                }
            )
            all_asset_reports.append(
                {
                    "assetPath": str(asset_path),
                    "assetId": asset_path.name,
                    "category": asset_path.parent.name,
                    "passed": False,
                    "preflight": {},
                    "clips": [],
                    "failures": [
                        {
                            "asset": asset_id,
                            "clip": None,
                            "frameTime": None,
                            "metric": "assetImport",
                            "observed": f"{exc}",
                            "threshold": "importable GLB",
                            "label": asset_path.name,
                        }
                    ],
                }
            )
            continue

        armatures, meshes = collect_scene_objects()

        preflight: dict[str, Any] = {
            "armatureCount": len(armatures),
            "expectedArmatureCount": THRESHOLDS["preflight"]["expectedArmatureCount"],
            "expectedBoneSet": {
                "expected": list(EXPECTED_DEF_BONES),
                "actual": [b.name for arm in armatures for b in arm.data.bones],
            },
            "meshValidation": {},
            "canonicalRestRotationAlignment": [],
            "canonicalRestRotationFailures": [],
        }

        # Global preflight failures for this asset.
        if len(armatures) != THRESHOLDS["preflight"]["expectedArmatureCount"]:
            _record_failure(
                failures,
                asset=asset_id,
                clip=None,
                frame_time=None,
                metric="armatureCount",
                observed=len(armatures),
                threshold=THRESHOLDS["preflight"]["expectedArmatureCount"],
                label="armature-count",
            )

        if not armatures:
            all_asset_reports.append(
                {
                    "assetPath": str(asset_path),
                    "assetId": asset_path.name,
                    "category": asset_path.parent.name,
                    "passed": False,
                    "preflight": preflight,
                    "clips": [],
                    "failures": [f for f in failures if f.get("asset") == asset_id],
                }
            )
            continue

        armature_obj = armatures[0]
        reset_armature_pose(armature_obj)
        actual_bones = {b.name for b in armature_obj.data.bones}
        missing = sorted(EXPECTED_BONE_SET.difference(actual_bones))
        extra = sorted(actual_bones.difference(EXPECTED_BONE_SET))

        if missing:
            _record_failure(
                failures,
                asset=asset_id,
                clip=None,
                frame_time=None,
                metric="expectedDefBoneSet",
                observed={"missing": missing, "extra": []},
                threshold={"expected": list(EXPECTED_DEF_BONES)},
                label="bone-set",
            )
        if extra:
            _record_failure(
                failures,
                asset=asset_id,
                clip=None,
                frame_time=None,
                metric="expectedDefBoneSet",
                observed={"missing": [], "extra": extra},
                threshold={"expected": list(EXPECTED_DEF_BONES)},
                label="bone-set",
            )

        rest_metrics, rest_failures = evaluate_canonical_rest_rotations(
            asset_rest_rotations,
            overlay_rest_rotations,
        )
        preflight["canonicalRestRotationAlignment"] = rest_metrics
        preflight["canonicalRestRotationFailures"] = rest_failures
        for rest_failure in rest_failures:
            _record_failure(
                failures,
                asset=asset_id,
                clip=None,
                frame_time=None,
                metric=rest_failure["metric"],
                observed=rest_failure["observed"],
                threshold=rest_failure["threshold"],
                label=rest_failure["label"],
            )

        mesh_contexts: list[dict[str, Any]] = []
        mesh_objects: list[Any] = []
        for mesh_obj in meshes:
            mesh_objects.append(mesh_obj)

            weight_stats = collect_weight_stats(mesh_obj)
            modifier_stats = inspect_armature_modifiers(mesh_obj, armature_obj)

            preflight["meshValidation"][mesh_obj.name] = {
                **weight_stats,
                **modifier_stats,
                "vertexCount": len(mesh_obj.data.vertices),
            }

            if weight_stats["orphanVertices"] > THRESHOLDS["preflight"]["maxOrphanVertices"]:
                _record_failure(
                    failures,
                    asset=asset_id,
                    clip=None,
                    frame_time=None,
                    metric="orphanVertices",
                    observed=weight_stats["orphanVertices"],
                    threshold=THRESHOLDS["preflight"]["maxOrphanVertices"],
                    label=mesh_obj.name,
                )
            if weight_stats["nonDefWeightGroups"] > THRESHOLDS["preflight"]["maxNonDefEffectiveGroups"]:
                _record_failure(
                    failures,
                    asset=asset_id,
                    clip=None,
                    frame_time=None,
                    metric="nonDefWeightGroups",
                    observed=weight_stats["nonDefWeightGroups"],
                    threshold=THRESHOLDS["preflight"]["maxNonDefEffectiveGroups"],
                    label=mesh_obj.name,
                )
            if weight_stats["negativeWeightVertices"] > THRESHOLDS["preflight"]["maxNegativeWeights"]:
                _record_failure(
                    failures,
                    asset=asset_id,
                    clip=None,
                    frame_time=None,
                    metric="negativeWeights",
                    observed=weight_stats["negativeWeightVertices"],
                    threshold=THRESHOLDS["preflight"]["maxNegativeWeights"],
                    label=mesh_obj.name,
                )
            if weight_stats["nonFiniteWeightVertices"] > THRESHOLDS["preflight"]["maxNonFiniteWeights"]:
                _record_failure(
                    failures,
                    asset=asset_id,
                    clip=None,
                    frame_time=None,
                    metric="nonFiniteWeights",
                    observed=weight_stats["nonFiniteWeightVertices"],
                    threshold=THRESHOLDS["preflight"]["maxNonFiniteWeights"],
                    label=mesh_obj.name,
                )
            if not math.isfinite(weight_stats["weightNormErrorMax"]):
                _record_failure(
                    failures,
                    asset=asset_id,
                    clip=None,
                    frame_time=None,
                    metric="weightNormErrorMax",
                    observed=weight_stats["weightNormErrorMax"],
                    threshold=THRESHOLDS["preflight"]["maxWeightNormalizationAbsError"],
                    label=mesh_obj.name,
                )
            elif weight_stats["weightNormErrorMax"] > THRESHOLDS["preflight"]["maxWeightNormalizationAbsError"]:
                _record_failure(
                    failures,
                    asset=asset_id,
                    clip=None,
                    frame_time=None,
                    metric="weightNormErrorMax",
                    observed=weight_stats["weightNormErrorMax"],
                    threshold=THRESHOLDS["preflight"]["maxWeightNormalizationAbsError"],
                    label=mesh_obj.name,
                )
            if weight_stats["overInfluenceVertices"] > 0:
                _record_failure(
                    failures,
                    asset=asset_id,
                    clip=None,
                    frame_time=None,
                    metric="overInfluenceVertices",
                    observed=weight_stats["overInfluenceVertices"],
                    threshold=0,
                    label=mesh_obj.name,
                )

            if modifier_stats["enabledArmatureModifierCount"] != THRESHOLDS["preflight"]["expectedEnabledArmatureModifiersPerMesh"]:
                _record_failure(
                    failures,
                    asset=asset_id,
                    clip=None,
                    frame_time=None,
                    metric="enabledArmatureModifiers",
                    observed=modifier_stats["enabledArmatureModifierCount"],
                    threshold=THRESHOLDS["preflight"]["expectedEnabledArmatureModifiersPerMesh"],
                    label=mesh_obj.name,
                )
            if modifier_stats["enabledArmatureModifiersTargetingRig"] != THRESHOLDS["preflight"]["expectedTargetingRigModifiersPerMesh"]:
                _record_failure(
                    failures,
                    asset=asset_id,
                    clip=None,
                    frame_time=None,
                    metric="armatureModifiersTargetingRig",
                    observed=modifier_stats["enabledArmatureModifiersTargetingRig"],
                    threshold=THRESHOLDS["preflight"]["expectedTargetingRigModifiersPerMesh"],
                    label=mesh_obj.name,
                )

            mesh_contexts.append(prepare_mesh_context(mesh_obj, armature_obj))

        # Mesh context setup only once per imported mesh.
        clip_reports: list[dict[str, Any]] = []
        for clip_name in CANONICAL_CLIP_NAMES:
            clip = overlay_clips.get(clip_name)
            if clip is None:
                _record_failure(
                    failures,
                    asset=asset_id,
                    clip=clip_name,
                    frame_time=None,
                    metric="missingCanonicalClip",
                    observed=clip_name,
                    threshold="clip parsed from overlay",
                    label="overlay",
                )
                continue

            # Skip deformation evaluation when rig is clearly invalid.
            if len(armatures) != THRESHOLDS["preflight"]["expectedArmatureCount"] or missing or extra:
                _record_failure(
                    failures,
                    asset=asset_id,
                    clip=clip_name,
                    frame_time=None,
                    metric="deformationSkipped",
                    observed="preflight errors",
                    threshold="preflight clear",
                    label="asset",
                )
                clip_reports.append(
                    {
                        "name": clip_name,
                        "sampleCount": 0,
                        "sampleTimes": [],
                        "extrema": {},
                        "frames": [],
                        "passed": False,
                        "failures": [f for f in failures if f.get("asset") == asset_id and f.get("clip") == clip_name],
                    }
                )
                continue

            clip_report, clip_failures = evaluate_clip(armature_obj, mesh_contexts, mesh_objects, clip, asset_id)
            clip_report["failures"] = clip_failures
            failures.extend(clip_failures)
            clip_reports.append(clip_report)

        # Clamp to this asset for summary.
        asset_failures = [f for f in failures if f.get("asset") == asset_id]
        all_asset_reports.append(
            {
                "assetPath": str(asset_path),
                "assetId": asset_path.stem,
                "category": asset_path.parent.name,
                "preflight": preflight,
                "passed": not any(f.get("asset") == asset_id for f in failures),
                "clips": clip_reports,
                "failures": asset_failures,
            }
        )

    report: dict[str, Any] = {
        "contract": contract,
        "metadata": metadata,
        "thresholds": THRESHOLDS,
        "overlay": {
            "path": str(overlay_path),
            "checks": overlay_checks,
            "clipCount": len(overlay_clips),
        },
        "assets": all_asset_reports,
        "failures": failures,
        "summary": {
            "assetCount": len(all_asset_reports),
            "clipCount": len(CANONICAL_CLIP_NAMES),
            "failureCount": len(failures),
            "passed": len(failures) == 0,
        },
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, default=_serialize))

    return (1 if failures else 0, report)


def main() -> int:
    code, _ = run()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
