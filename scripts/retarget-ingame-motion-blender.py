#!/usr/bin/env python3
"""Build a deterministic, runtime-ready DEF-* rotation-only ingame motion pack."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping


@dataclass(frozen=True)
class ClipSpec:
    action: str
    source_file: str
    loop: bool


@dataclass(frozen=True)
class MappingRow:
    target: str
    source: str
    mode: str = "copy"
    weight: float = 1.0
    synthesized: bool = False


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TARGET_RIG = REPO_ROOT / "assets/images/battle/glb/commander/dusk-warden.glb"
DEFAULT_FBX_DIR = REPO_ROOT / "assets/motion/bench"
DEFAULT_AUDIT_REPORT = (
    REPO_ROOT
    / "_workspace/current/engineering/asset-pipeline/motion-bench/fbx-audit-report-FULL-OBSERVED.json"
)
DEFAULT_OUTPUT_GLB = REPO_ROOT / "assets/motion/ingame/unarmed-core.glb"
DEFAULT_MANIFEST = REPO_ROOT / "assets/motion/ingame/manifest.json"
DEFAULT_PREVIEW_DIR = REPO_ROOT / "assets/motion/ingame/qa"

# Source -> target mapping. Pelvis helpers intentionally retain their target
# rest pose; motion comes from the root spine and limb chains.
MAPPING_ROWS = [
    MappingRow("DEF-spine", "mixamorig:Hips", "copy", 1.0),
    MappingRow("DEF-spine.001", "mixamorig:Spine", "copy", 1.0),
    MappingRow("DEF-spine.002", "mixamorig:Spine1", "copy", 1.0),
    MappingRow("DEF-spine.003", "mixamorig:Spine2", "copy", 1.0),
    MappingRow("DEF-spine.004", "mixamorig:Neck", "copy", 1.0),
    MappingRow("DEF-spine.005", "mixamorig:Head", "copy", 1.0),

    MappingRow("DEF-shoulder.L", "mixamorig:LeftShoulder", "copy", 1.0),
    MappingRow("DEF-upper_arm.L", "mixamorig:LeftArm", "copy", 1.0),
    MappingRow("DEF-forearm.L", "mixamorig:LeftForeArm", "copy", 1.0),
    MappingRow("DEF-hand.L", "mixamorig:LeftHand", "copy", 1.0),

    MappingRow("DEF-shoulder.R", "mixamorig:RightShoulder", "copy", 1.0),
    MappingRow("DEF-upper_arm.R", "mixamorig:RightArm", "copy", 1.0),
    MappingRow("DEF-forearm.R", "mixamorig:RightForeArm", "copy", 1.0),
    MappingRow("DEF-hand.R", "mixamorig:RightHand", "copy", 1.0),

    MappingRow("DEF-thigh.L", "mixamorig:LeftUpLeg", "copy", 1.0),
    MappingRow("DEF-shin.L", "mixamorig:LeftLeg", "copy", 1.0),
    MappingRow("DEF-foot.L", "mixamorig:LeftFoot", "copy", 1.0),
    MappingRow("DEF-toe.L", "mixamorig:LeftToeBase", "copy", 1.0),

    MappingRow("DEF-thigh.R", "mixamorig:RightUpLeg", "copy", 1.0),
    MappingRow("DEF-shin.R", "mixamorig:RightLeg", "copy", 1.0),
    MappingRow("DEF-foot.R", "mixamorig:RightFoot", "copy", 1.0),
    MappingRow("DEF-toe.R", "mixamorig:RightToeBase", "copy", 1.0),
]

# Overlay clip roster.
#
# The nine base actions are the original shipped pack and their sources are unchanged, so every
# rig keeps exactly the motion it already had. Everything below them is additive: the runtime
# already routes directional reactions ("hit_left" / "bighit_back", battle-realtime-three.js
# hitReactionKey) and exact attack delivery ("attack_melee" / "attack_ranged"), and falls back to
# the flat key when a rig does not carry the clip. Shipping these turns that routing on for all
# 24 compatible rigs at once instead of leaving it dormant.
CLIPS = [
    ClipSpec("idle", "Unarmed Idle.fbx", True),
    ClipSpec("move", "Walking.fbx", True),
    ClipSpec("run", "Running.fbx", True),
    ClipSpec("hit", "Standing React Small From Left.fbx", False),
    ClipSpec("bighit", "Receive Uppercut To The Face.fbx", False),
    ClipSpec("attack", "Punching.fbx", False),
    ClipSpec("critical", "Illegal Elbow Punch.fbx", False),
    ClipSpec("avoid", "Dodging.fbx", False),
    ClipSpec("defence", "Body Block.fbx", False),

    # Directional light reactions: the side the blow came from decides which way the body folds.
    ClipSpec("hit_front", "Pain Gesture.fbx", False),
    ClipSpec("hit_back", "Standing React Large Gut.fbx", False),
    ClipSpec("hit_left", "Standing React Small From Left.fbx", False),
    ClipSpec("hit_right", "Standing React Small From Right.fbx", False),

    # Directional heavy reactions: same axis, larger arc, longer recovery.
    ClipSpec("bighit_front", "Receive Uppercut To The Face.fbx", False),
    ClipSpec("bighit_back", "Turn To Knocked Unconscious.fbx", False),
    ClipSpec("bighit_left", "Standing Block React Large.fbx", False),
    ClipSpec("bighit_right", "Standing React Large Gut.fbx", False),

    # Delivery-specific attacks, so a melee swing and a ranged release stop both playing the
    # generic punch.
    ClipSpec("attack_melee", "Standing Melee Attack Horizontal.fbx", False),
    ClipSpec("attack_ranged", "Shooting Arrow.fbx", False),

    # Terminal and entrance beats, so death and boss entry stop borrowing a combat clip.
    ClipSpec("die", "Dying.fbx", False),
    ClipSpec("show", "Mutant Roaring.fbx", False),
]

EXPECTED_CLIP_NAMES = [f"unarmed-core::{clip.action}::v01" for clip in CLIPS]

COMPATIBLE_MESHES = [
    "assets/images/battle/glb/commander/dusk-warden.glb",
    "assets/images/battle/glb/companions/ember-cohort.glb",
    "assets/images/battle/glb/companions/rift-lens.glb",
    "assets/images/battle/glb/companions/veil-vanguard.glb",
    "assets/images/battle/glb/companions/anchor-shard.glb",
    "assets/images/battle/glb/companions/throne-echo.glb",
    "assets/images/battle/glb/companions/dawnless-crown.glb",
    "assets/images/battle/glb/companions/pack-warden.glb",
    "assets/images/battle/glb/companions/lantern-reaver.glb",
    "assets/images/battle/glb/companions/requiem-warden.glb",
    "assets/images/battle/glb/enemies/scout.glb",
    "assets/images/battle/glb/enemies/shade.glb",
    "assets/images/battle/glb/enemies/guard.glb",
    "assets/images/battle/glb/enemies/possessed.glb",
    "assets/images/battle/glb/bosses/cinder-warden.glb",
    "assets/images/battle/glb/bosses/veil-tactician.glb",
    "assets/images/battle/glb/bosses/gate-sovereign.glb",
    "assets/images/battle/glb/bosses/tide-warden.glb",
    "assets/images/battle/glb/bosses/pack-herald.glb",
    "assets/images/battle/glb/bosses/requiem-choir.glb",
    "assets/images/battle/glb/bosses/lantern-tyrant.glb",
    "assets/images/battle/glb/bosses/bridge-colossus.glb",
    "assets/images/battle/glb/bosses/veiled-concordat.glb",
    "assets/images/battle/glb/bosses/abyss-regent.glb",
]



def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build deterministic DEF-* rotation-only ingame motion pack"
    )
    parser.add_argument("--target-rig", default=str(DEFAULT_TARGET_RIG))
    parser.add_argument("--fbx-dir", default=str(DEFAULT_FBX_DIR))
    parser.add_argument("--audit-report", default=str(DEFAULT_AUDIT_REPORT))
    parser.add_argument("--out-glb", default=str(DEFAULT_OUTPUT_GLB))
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--skip-preview", action="store_true")
    parser.add_argument("--preview-dir", default=str(DEFAULT_PREVIEW_DIR))

    raw = sys.argv[1:] if argv is None else list(argv)
    if "--" in raw:
        raw = raw[raw.index("--") + 1 :]

    return parser.parse_args(raw)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_action_name(action: str) -> str:
    return f"unarmed-core::{action}::v01"


def parse_json(path: Path) -> Mapping[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def reset_scene() -> None:
    import bpy

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.edit.use_global_undo = False
    bpy.context.scene.render.fps = 24


def import_gltf(path: Path) -> None:
    import bpy

    bpy.ops.import_scene.gltf(filepath=str(path))


def import_fbx(path: Path) -> None:
    import bpy

    bpy.ops.import_scene.fbx(filepath=str(path), global_scale=1.0)


def first_armature(objects: Iterable[Any], skip: set[str] | None = None):
    skip_set = set(skip or [])
    for obj in objects:
        if obj.type == "ARMATURE" and obj.name not in skip_set:
            return obj
    return None


def keep_only(target_obj: Any) -> None:
    import bpy

    for obj in list(bpy.data.objects):
        if obj != target_obj:
            bpy.data.objects.remove(obj, do_unlink=True)


def keep_actions(keep_names: set[str] | list[str]) -> None:
    keep = set(keep_names)
    import bpy

    for action in list(bpy.data.actions):
        if action.name in keep:
            action.use_fake_user = True
            continue
        action.use_fake_user = False
        bpy.data.actions.remove(action)

def parse_clip_metrics(report_path: Path, required_filenames: list[str]) -> dict[str, Any]:
    payload = parse_json(report_path)
    wanted = {filename: None for filename in required_filenames}

    for item in payload.get("files", []):
        filename = item.get("file")
        if filename in wanted:
            wanted[filename] = item.get("metrics", {})

    missing = [name for name, metric in wanted.items() if not metric]
    if missing:
        raise RuntimeError(f"missing clip metrics for: {', '.join(sorted(missing))}")

    return {name: wanted[name] for name in required_filenames}


def gather_bone_names(armature: Any) -> list[str]:
    return [bone.name for bone in armature.data.bones]


def _collect_mapping_by_target(mapping_rows: list[MappingRow]) -> dict[str, list[MappingRow]]:
    grouped: dict[str, list[MappingRow]] = {}
    for row in mapping_rows:
        grouped.setdefault(row.target, []).append(row)
    return grouped


def _blend_quats(entries: list[tuple[Any, float]], axis: str, fallback_factor: float = 0.0):
    import mathutils

    if not entries:
        return None

    # Weighted deterministic blend in local rest-space.
    base = None
    total = 0.0
    for source_quat, weight in entries:
        if weight <= 0.0:
            continue
        q = source_quat.normalized() if isinstance(source_quat, mathutils.Quaternion) else mathutils.Quaternion(source_quat).normalized()
        if base is None:
            base = q
            total = weight
            continue
        factor = weight / (total + weight)
        base = base.slerp(q, factor)
        total += weight

    if base is None:
        return None

    if axis == "split" and fallback_factor < 1.0:
        ident = mathutils.Quaternion((1.0, 0.0, 0.0, 0.0))
        base = ident.slerp(base, float(fallback_factor))
    return base.normalized()


def _to_local_delta(source_pose_bone: Any, source_arm_obj: Any) -> Any:
    import mathutils

    rest = (source_arm_obj.matrix_world @ source_pose_bone.bone.matrix_local).to_3x3()
    pose = (source_arm_obj.matrix_world @ source_pose_bone.matrix).to_3x3()
    return rest.inverted() @ pose


def _mapped_delta_as_target_local(source_bone: Any, row: MappingRow, source_armature: Any, target_bone: Any, target_armature: Any):
    import mathutils

    source_delta_local = _to_local_delta(source_bone, source_armature)
    source_rest = (source_armature.matrix_world @ source_bone.bone.matrix_local).to_3x3()
    source_delta_world = source_rest @ source_delta_local @ source_rest.inverted()

    target_rest = (target_armature.matrix_world @ target_bone.bone.matrix_local).to_3x3()
    mapped_local = target_rest.inverted() @ source_delta_world @ target_rest

    quat = mapped_local.to_quaternion()
    if row.mode == "split":
        identity = mathutils.Quaternion((1.0, 0.0, 0.0, 0.0))
        return identity.slerp(quat.normalized(), float(row.weight)).normalized()

    return quat.normalized() if isinstance(quat, mathutils.Quaternion) else mathutils.Quaternion(quat).normalized()


def bake_clip(
    target_armature: Any,
    source_armature: Any,
    frame_start: int,
    frame_end: int,
    action_name: str,
    mapping_rows: list[MappingRow],
) -> None:
    import bpy
    import mathutils

    if frame_end < frame_start:
        raise ValueError(f"invalid frame range [{frame_start}, {frame_end}]")

    source_pose_bones = {pb.name: pb for pb in source_armature.pose.bones}
    target_pose_bones = {pb.name: pb for pb in target_armature.pose.bones}
    mapping_by_target = _collect_mapping_by_target(mapping_rows)

    for target_name in mapping_by_target:
        if target_name not in target_pose_bones:
            raise RuntimeError(f"target bone missing: {target_name}")

    if target_armature.animation_data is None:
        target_armature.animation_data_create()

    existing = bpy.data.actions.get(action_name)
    if existing is not None:
        bpy.data.actions.remove(existing)

    action = bpy.data.actions.new(name=action_name)
    action.use_fake_user = True
    target_armature.animation_data.action = action
    action.frame_range = (0.0, float(frame_end - frame_start))

    for pose_bone in target_pose_bones.values():
        pose_bone.rotation_mode = "QUATERNION"
        pose_bone.rotation_quaternion = mathutils.Quaternion((1.0, 0.0, 0.0, 0.0))

    scene = bpy.context.scene
    scene.frame_start = 0
    scene.frame_end = max(0, int(frame_end - frame_start))

    prev_quat: dict[str, Any] = {}

    for frame in range(int(frame_start), int(frame_end) + 1):
        local_t = float(frame - frame_start)
        bpy.context.scene.frame_set(int(frame))
        bpy.context.view_layer.update()

        for target_name, rows in mapping_by_target.items():
            target_bone = target_pose_bones[target_name]
            contributions = []

            for row in rows:
                source_bone = source_pose_bones.get(row.source)
                if source_bone is None:
                    continue
                mapped = _mapped_delta_as_target_local(
                    source_bone,
                    row,
                    source_armature,
                    target_bone,
                    target_armature,
                )
                if mapped is not None:
                    contributions.append((mapped, float(row.weight)))

            if not contributions:
                quat = mathutils.Quaternion((1.0, 0.0, 0.0, 0.0))
            elif len(contributions) == 1:
                contrib_quat, contrib_weight = contributions[0]
                quat = contrib_quat.normalized()
                if contrib_weight != 1.0:
                    ident = mathutils.Quaternion((1.0, 0.0, 0.0, 0.0))
                    quat = ident.slerp(quat, min(1.0, max(0.0, contrib_weight)))
            else:
                entries = [(q, w) for q, w in contributions]
                quat = _blend_quats(entries, "copy", 1.0)
            if quat is None:
                quat = mathutils.Quaternion((1.0, 0.0, 0.0, 0.0))

            prev = prev_quat.get(target_name)
            if prev is not None and quat.dot(prev) < 0.0:
                quat = -quat
            prev_quat[target_name] = quat.copy()

            target_bone.rotation_quaternion = quat.normalized()
            target_bone.keyframe_insert(data_path="rotation_quaternion", frame=local_t)

    strip_non_rotation_channels(target_armature)


def strip_non_rotation_channels(armature: Any) -> None:
    anim = armature.animation_data.action if armature.animation_data else None
    if anim is None:
        return

    # Blender 5/5.1 style action data moved under action layers/strips.
    # Keep old-path compatibility for older installs that still expose anim.fcurves.
    if hasattr(anim, "fcurves"):
        for curve in list(anim.fcurves):
            if "rotation_quaternion" not in curve.data_path:
                anim.fcurves.remove(curve)
        return

    for layer in getattr(anim, "layers", []):
        for strip in getattr(layer, "strips", []):
            for channelbag in list(getattr(strip, "channelbags", [])):
                for curve in list(getattr(channelbag, "fcurves", [])):
                    if "rotation_quaternion" not in curve.data_path:
                        channelbag.fcurves.remove(curve)

def parse_glb_json_and_bin(path: Path) -> tuple[dict[str, Any], bytes]:
    raw = path.read_bytes()
    if raw[:4] != b"glTF":
        raise ValueError(f"{path} is not GLB")

    off = 12
    json_doc = None
    bin_data = b""

    while off < len(raw):
        length = struct.unpack_from("<I", raw, off)[0]
        chunk_type = struct.unpack_from("<I", raw, off + 4)[0]
        chunk_data = raw[off + 8 : off + 8 + length]
        if chunk_type == 0x4E4F534A:  # JSON
            json_doc = json.loads(chunk_data.decode("utf-8"))
        elif chunk_type == 0x004E4942:  # BIN
            bin_data = chunk_data
        off += 8 + length

    if json_doc is None:
        raise ValueError(f"{path} has no JSON chunk")

    return json_doc, bin_data


_COMPONENT_TYPES = {
    5120: ("b", 1),
    5121: ("B", 1),
    5122: ("h", 2),
    5123: ("H", 2),
    5125: ("I", 4),
    5126: ("f", 4),
}

_TYPE_COUNTS = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
    "MAT2": 4,
    "MAT3": 9,
    "MAT4": 16,
}


def _read_accessor(json_doc: Mapping[str, Any], bin_data: bytes, accessor_idx: int) -> list[list[float]]:
    accessor = json_doc["accessors"][accessor_idx]
    view = json_doc["bufferViews"][accessor["bufferView"]]

    comp_fmt, comp_size = _COMPONENT_TYPES[accessor["componentType"]]
    comp_count = _TYPE_COUNTS[accessor["type"]]
    count = accessor["count"]

    offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", comp_size * comp_count)

    # sparse accessors are not expected in this pipeline; fail explicit if they appear.
    if accessor.get("sparse"):
        raise ValueError("sparse accessor encountered; unsupported")

    out: list[list[float]] = []
    for i in range(count):
        row = []
        row_off = offset + i * stride
        for c in range(comp_count):
            start = row_off + c * comp_size
            val = struct.unpack_from(f"<{comp_fmt}", bin_data, start)[0]
            row.append(float(val))
        out.append(row)
    return out


def _write_accessor(
    json_doc: Mapping[str, Any],
    bin_data: bytearray,
    accessor_idx: int,
    rows: list[list[float]],
) -> None:
    accessor = json_doc["accessors"][accessor_idx]
    view = json_doc["bufferViews"][accessor["bufferView"]]
    comp_fmt, comp_size = _COMPONENT_TYPES[accessor["componentType"]]
    comp_count = _TYPE_COUNTS[accessor["type"]]
    if comp_fmt != "f" or comp_count != 4 or len(rows) != accessor["count"]:
        raise ValueError("expected a writable FLOAT VEC4 accessor")
    offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", comp_size * comp_count)
    for row_index, row in enumerate(rows):
        if len(row) != comp_count:
            raise ValueError("invalid accessor row width")
        struct.pack_into(
            "<4f",
            bin_data,
            offset + row_index * stride,
            *[float(value) for value in row],
        )


def _write_glb(path: Path, json_doc: Mapping[str, Any], bin_data: bytes) -> None:
    json_payload = json.dumps(json_doc, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    json_payload += b" " * ((-len(json_payload)) % 4)
    bin_payload = bytes(bin_data) + b"\0" * ((-len(bin_data)) % 4)
    total_length = 12 + 8 + len(json_payload) + 8 + len(bin_payload)
    payload = bytearray(struct.pack("<4sII", b"glTF", 2, total_length))
    payload.extend(struct.pack("<II", len(json_payload), 0x4E4F534A))
    payload.extend(json_payload)
    payload.extend(struct.pack("<II", len(bin_payload), 0x004E4942))
    payload.extend(bin_payload)
    path.write_bytes(payload)


def _compact_animation_resources(
    json_doc: dict[str, Any],
    bin_data: bytes,
) -> bytes:
    for animation in json_doc.get("animations", []):
        old_samplers = animation.get("samplers", [])
        used_sampler_indices = sorted({int(channel["sampler"]) for channel in animation.get("channels", [])})
        sampler_remap = {
            old_index: new_index
            for new_index, old_index in enumerate(used_sampler_indices)
        }
        animation["samplers"] = [old_samplers[index] for index in used_sampler_indices]
        for channel in animation.get("channels", []):
            channel["sampler"] = sampler_remap[int(channel["sampler"])]

    used_accessor_indices: set[int] = set()
    for animation in json_doc.get("animations", []):
        for sampler in animation.get("samplers", []):
            used_accessor_indices.add(int(sampler["input"]))
            used_accessor_indices.add(int(sampler["output"]))
    for skin in json_doc.get("skins", []):
        inverse_bind = skin.get("inverseBindMatrices")
        if isinstance(inverse_bind, int):
            used_accessor_indices.add(inverse_bind)

    old_accessors = json_doc.get("accessors", [])
    ordered_accessors = sorted(used_accessor_indices)
    accessor_remap = {
        old_index: new_index
        for new_index, old_index in enumerate(ordered_accessors)
    }
    json_doc["accessors"] = [old_accessors[index] for index in ordered_accessors]
    for animation in json_doc.get("animations", []):
        for sampler in animation.get("samplers", []):
            sampler["input"] = accessor_remap[int(sampler["input"])]
            sampler["output"] = accessor_remap[int(sampler["output"])]
    for skin in json_doc.get("skins", []):
        inverse_bind = skin.get("inverseBindMatrices")
        if isinstance(inverse_bind, int):
            skin["inverseBindMatrices"] = accessor_remap[inverse_bind]

    used_view_indices = sorted(
        {
            int(accessor["bufferView"])
            for accessor in json_doc.get("accessors", [])
            if isinstance(accessor.get("bufferView"), int)
        }
    )
    old_views = json_doc.get("bufferViews", [])
    view_remap = {
        old_index: new_index
        for new_index, old_index in enumerate(used_view_indices)
    }
    compact_bin = bytearray()
    compact_views = []
    for old_index in used_view_indices:
        while len(compact_bin) % 4:
            compact_bin.append(0)
        view = dict(old_views[old_index])
        start = int(view.get("byteOffset", 0))
        end = start + int(view["byteLength"])
        view["buffer"] = 0
        view["byteOffset"] = len(compact_bin)
        compact_bin.extend(bin_data[start:end])
        compact_views.append(view)
    json_doc["bufferViews"] = compact_views
    for accessor in json_doc.get("accessors", []):
        if isinstance(accessor.get("bufferView"), int):
            accessor["bufferView"] = view_remap[int(accessor["bufferView"])]
    json_doc["buffers"] = [{"byteLength": len(compact_bin)}]
    return bytes(compact_bin)


def _quat_normalize_xyzw(values: Iterable[float]) -> list[float]:
    quat = [float(value) for value in values]
    norm = math.sqrt(sum(value * value for value in quat))
    if norm <= 1e-12:
        return [0.0, 0.0, 0.0, 1.0]
    return [value / norm for value in quat]


def _quat_multiply_xyzw(left: Iterable[float], right: Iterable[float]) -> list[float]:
    lx, ly, lz, lw = [float(value) for value in left]
    rx, ry, rz, rw = [float(value) for value in right]
    return _quat_normalize_xyzw(
        [
            lw * rx + lx * rw + ly * rz - lz * ry,
            lw * ry - lx * rz + ly * rw + lz * rx,
            lw * rz + lx * ry - ly * rx + lz * rw,
            lw * rw - lx * rx - ly * ry - lz * rz,
        ]
    )


def _quat_inverse_xyzw(values: Iterable[float]) -> list[float]:
    x, y, z, w = _quat_normalize_xyzw(values)
    return [-x, -y, -z, w]


def _reference_rest_quaternions(path: Path) -> dict[str, list[float]]:
    json_doc, _ = parse_glb_json_and_bin(path)
    return {
        node["name"]: _quat_normalize_xyzw(node.get("rotation", [0.0, 0.0, 0.0, 1.0]))
        for node in json_doc.get("nodes", [])
        if isinstance(node.get("name"), str) and node["name"].startswith("DEF-")
    }


def postprocess_rest_relative_deltas(
    path: Path,
    target_rig_path: Path,
    expected_clip_names: Iterable[str],
) -> None:
    json_doc, raw_bin = parse_glb_json_and_bin(path)
    bin_data = bytearray(raw_bin)
    expected = set(expected_clip_names)
    animations = [
        animation
        for animation in json_doc.get("animations", [])
        if animation.get("name") in expected
    ]
    if {animation.get("name") for animation in animations} != expected:
        raise RuntimeError("exported GLB is missing expected retarget actions")
    json_doc["animations"] = animations

    rest_by_bone = _reference_rest_quaternions(target_rig_path)
    nodes = json_doc.get("nodes", [])
    for animation in animations:
        samplers = animation.get("samplers", [])
        channels = [
            channel
            for channel in animation.get("channels", [])
            if channel.get("target", {}).get("path") == "rotation"
        ]
        animation["channels"] = channels
        for channel in channels:
            target = channel.get("target", {})
            node_index = target.get("node")
            if not isinstance(node_index, int):
                raise RuntimeError(f"{animation.get('name')}: invalid rotation target")
            bone_name = nodes[node_index].get("name")
            rest = rest_by_bone.get(bone_name)
            if rest is None:
                raise RuntimeError(f"{animation.get('name')}: unknown target bone {bone_name}")
            sampler = samplers[channel["sampler"]]
            output_index = int(sampler["output"])
            absolute_rows = _read_accessor(json_doc, bin_data, output_index)
            inverse_rest = _quat_inverse_xyzw(rest)
            delta_rows = [
                _quat_multiply_xyzw(inverse_rest, absolute)
                for absolute in absolute_rows
            ]
            previous = None
            for row_index, row in enumerate(delta_rows):
                if previous is not None and sum(a * b for a, b in zip(previous, row)) < 0.0:
                    delta_rows[row_index] = [-value for value in row]
                previous = delta_rows[row_index]
            _write_accessor(json_doc, bin_data, output_index, delta_rows)

    json_doc.setdefault("asset", {}).setdefault("extras", {})["animationEncoding"] = (
        "local-rest-relative-quaternion-deltas"
    )
    compact_bin = _compact_animation_resources(json_doc, bin_data)
    _write_glb(path, json_doc, compact_bin)


def run_gates(
    glb_path: Path,
    expected_clip_overrides: list[Mapping[str, Any]],
    expected_target_joints: list[str],
) -> tuple[bool, list[str], dict[str, Any]]:
    json_doc, bin_data = parse_glb_json_and_bin(glb_path)
    errors: list[str] = []

    checks: dict[str, Any] = {
        "glb2": True,
        "animationOnly": True,
        "finiteKeyframes": True,
        "onlyTargetBoneTracks": True,
        "rotationOnly": True,
        "inPlaceRoot": True,
        "loopClosure": True,
        "expectedNodes": len(expected_target_joints) == 24,
        "expectedClipCount": True,
        "restRelativeDeltas": True,
        "sampledQuaternionOutputs": True,
    }

    if bool(json_doc.get("meshes")):
        checks["animationOnly"] = False
        checks["rotationOnly"] = False
        errors.append("pack contains meshes")
    if json_doc.get("materials"):
        checks["animationOnly"] = False
        errors.append("pack contains materials")
    if json_doc.get("textures"):
        checks["animationOnly"] = False
        errors.append("pack contains textures")
    if json_doc.get("images"):
        checks["animationOnly"] = False
        errors.append("pack contains images")

    animations = json_doc.get("animations", []) or []
    if len(animations) != 9:
        errors.append(f"expected 9 animations, got {len(animations)}")
        checks["expectedClipCount"] = False

    expected_overrides = {row["clipName"]: row for row in expected_clip_overrides}
    expected_names = set(expected_overrides.keys())
    anim_names = [anim.get("name") for anim in animations]
    if set(anim_names) != expected_names:
        errors.append("animation set does not match expected override names")

    skins = json_doc.get("skins", []) or []
    if len(skins) != 1:
        errors.append("expected exactly one skin")
    skin_joints = []
    if skins:
        skin_joints = [
            json_doc["nodes"][idx]["name"]
            for idx in skins[0].get("joints", [])
            if 0 <= idx < len(json_doc.get("nodes", []))
        ]
    if len(skin_joints) != 24:
        checks["expectedNodes"] = False
        errors.append(f"expected 24 skin joints, got {len(skin_joints)}")
    for name in expected_target_joints:
        if name not in skin_joints:
            errors.append(f"missing target bone in skin joints: {name}")

    for anim in animations:
        name = anim.get("name")
        spec = expected_overrides.get(name)
        if spec is None:
            continue

        frame_start = float(spec["frameStart"])
        frame_end = float(spec["frameEnd"])
        source_fps = float(spec["sourceFps"])
        expected_duration = (frame_end - frame_start) / source_fps if source_fps else 0.0

        channels = anim.get("channels", []) or []
        samplers = anim.get("samplers", []) or []
        if not channels:
            errors.append(f"{name} has no channels")

        clip_min_t = math.inf
        clip_max_t = -math.inf
        has_non_constant_track = False

        for channel in channels:
            target = channel.get("target", {})
            node = target.get("node")
            path = target.get("path")

            if path != "rotation":
                checks["rotationOnly"] = False
                checks["onlyTargetBoneTracks"] = False
                errors.append(f"{name}: non-rotation path {path}")

            node_names = json_doc.get("nodes", [])
            if isinstance(node, int) and 0 <= node < len(node_names):
                node_name = node_names[node].get("name")
                if node_name not in expected_target_joints:
                    checks["onlyTargetBoneTracks"] = False
                    errors.append(f"{name}: channel to non-target node {node_name}")
            else:
                errors.append(f"{name}: invalid node index {node}")

            sampler_idx = channel.get("sampler")
            if isinstance(sampler_idx, int) and 0 <= sampler_idx < len(samplers):
                sampler = samplers[sampler_idx]
            else:
                errors.append(f"{name}: invalid sampler")
                continue

            interpolation = sampler.get("interpolation", "LINEAR")
            input_count = int(json_doc["accessors"][int(sampler["input"])]["count"])
            output_count = int(json_doc["accessors"][int(sampler["output"])]["count"])
            if interpolation not in {"LINEAR", "STEP"} or output_count != input_count:
                checks["sampledQuaternionOutputs"] = False
                errors.append(
                    f"{name}: unsupported {interpolation} sampler counts {input_count}->{output_count}"
                )

            try:
                input_vals = _read_accessor(json_doc, bin_data, int(sampler["input"]))
                output_vals = _read_accessor(json_doc, bin_data, int(sampler["output"]))
            except Exception as exc:
                errors.append(f"{name}: accessor parse failed: {exc}")
                checks["finiteKeyframes"] = False
                continue

            prev_t = None
            for row in input_vals:
                if len(row) != 1:
                    continue
                t = float(row[0])
                if not math.isfinite(t):
                    checks["finiteKeyframes"] = False
                    errors.append(f"{name}: non-finite time value")
                if prev_t is not None and t < prev_t:
                    errors.append(f"{name}: non-monotonic time")
                prev_t = t
                clip_min_t = min(clip_min_t, t)
                clip_max_t = max(clip_max_t, t)

            if output_vals:
                first_row = output_vals[0]
                for row in output_vals:
                    if len(row) != 4:
                        errors.append(f"{name}: non-VEC4 rotation row")
                        break
                    for val in row:
                        if not math.isfinite(val):
                            checks["finiteKeyframes"] = False
                            errors.append(f"{name}: non-finite quaternion")
                    norm = math.sqrt(sum(v * v for v in row))
                    if norm <= 0:
                        errors.append(f"{name}: zero-length quaternion")
                        continue
                    if abs(norm - 1.0) > 1e-3:
                        checks["finiteKeyframes"] = False
                        errors.append(f"{name}: un-normalized quaternion row")

                if len(output_vals) >= 2:
                    first = output_vals[0]
                    has_non_constant = any(
                        any(abs(a - b) > 1e-6 for a, b in zip(row, first))
                        for row in output_vals[1:]
                    )
                    if has_non_constant:
                        has_non_constant_track = True

            if spec.get("loop") and output_vals:
                if output_vals[0] and output_vals[-1]:
                    dot = sum(a * b for a, b in zip(output_vals[0], output_vals[-1]))
                    if dot < 0.0:
                        checks["loopClosure"] = False
                        errors.append(f"{name}: loop tracks include opposite-sign closure")

        if not has_non_constant_track:
            errors.append(f"{name}: no non-constant rotation track")

        if clip_min_t <= clip_max_t and source_fps:
            got = clip_max_t - clip_min_t
            if abs(got - expected_duration) > 1e-6:
                errors.append(f"{name}: duration mismatch expected {expected_duration}, got {got}")

    return len(errors) == 0, errors, checks


def build_manifest(
    out_glb: Path,
    target_path: Path,
    actions: list[ClipSpec],
    metrics: Mapping[str, Mapping[str, Any]],
    mapping: list[MappingRow],
    target_bone_names: list[str],
    source_bone_names: list[str],
    gate_errors: list[str],
    gate_checks: dict[str, Any],
) -> dict[str, Any]:
    import datetime

    source_fps = 24
    mapped_source = sorted({row.source for row in mapping})
    mapped_target = {row.target for row in mapping}
    unmapped_source = sorted(set(source_bone_names) - set(mapped_source))
    unmapped_target = sorted(set(target_bone_names) - mapped_target)
    synthesized = sorted({row.target for row in mapping if row.synthesized})

    clip_overrides: list[dict[str, Any]] = []
    for clip in actions:
        metric = metrics[clip.source_file]
        fr = metric.get("frame_range", {})
        frame_start = int(fr.get("start", 1))
        frame_end = int(fr.get("end", 1))
        fps = int(metric.get("scene_fps", source_fps))
        hips = metric.get("hips_displacement", {}) or {}
        source_path = DEFAULT_FBX_DIR / clip.source_file

        clip_overrides.append(
            {
                "action": clip.action,
                "source": clip.source_file,
                "sourceFile": clip.source_file,
                "clipName": build_action_name(clip.action),
                "frameStart": frame_start,
                "frameEnd": frame_end,
                "sourceFps": fps,
                "durationSeconds": (frame_end - frame_start) / float(fps) if fps else 0.0,
                "sourceRootTravel": {
                    "x": float(hips.get("x", 0.0)),
                    "y": float(hips.get("y", 0.0)),
                    "z": float(hips.get("z", 0.0)),
                },
                "exportedRootDeviation": {
                    "x": 0.0,
                    "z": 0.0,
                },
                "loop": bool(clip.loop),
                "sourceSha256": sha256(source_path) if source_path.exists() else "",
            }
        )

    mapped_records = [
        {
            "targetBoneName": row.target,
            "sourceBoneName": row.source,
            "mode": row.mode,
            "weight": row.weight,
            "synthesized": row.synthesized,
        }
        for row in mapping
    ]

    mapping_simple = [
        {"targetBone": row.target, "sourceBone": row.source, "mode": row.mode, "weight": row.weight}
        for row in mapping
    ]

    return {
        "schemaVersion": 1,
        "generatedBy": "scripts/retarget-ingame-motion-blender.py",
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sourceBoneNames": sorted(source_bone_names),
        "mappedSourceBones": mapped_source,
        "unmappedSourceBones": unmapped_source,
        "unmappedTargetBones": unmapped_target,
        "synthesizedTargetBones": synthesized,
        "sourceRig": "mixamo-37",
        "targetRig": "def-humanoid-v1",
        "targetBoneNames": target_bone_names,
        "boneMapping": {
            "rows": mapped_records,
            "mapping": mapping_simple,
        },
        "pack": {
            "id": "unarmed-core",
            "path": "assets/motion/ingame/unarmed-core.glb",
            "sha256": sha256(out_glb),
            "sourceRig": "mixamo-37",
            "targetRig": "def-humanoid-v1",
            "sourceFps": source_fps,
            "targetBoneNames": target_bone_names,
            "sourceBoneNames": sorted(source_bone_names),
            "mappedSourceBones": mapped_source,
            "unmappedSourceBones": unmapped_source,
            "unmappedTargetBones": unmapped_target,
            "synthesizedTargetBones": synthesized,
            "boneMapping": {
                "rows": mapped_records,
                "mapping": mapping_simple,
            },
            "animationEncoding": "local-rest-relative-quaternion-deltas",
            "unmappedBones": unmapped_source,
            "clipOverrides": clip_overrides,
        },
        "clipOverrides": clip_overrides,
        "rights": {
            "source": "user-provided",
            "runtimeUseDirectedAt": "2026-07-29",
            "redistributionStatus": "unverified",
        },
        "rightsReceipt": "rotation-only-overlay-retarget-computed-with-audit-frame-ranges",
        "fallbackActions": ["die", "show", "attack_melee", "attack_ranged"],
        "compatibleMeshes": COMPATIBLE_MESHES,
        "checks": gate_checks,
        "runtimeEligible": bool((not gate_errors) and all(
            [
                gate_checks.get("glb2", False),
                gate_checks.get("animationOnly", False),
                gate_checks.get("finiteKeyframes", False),
                gate_checks.get("rotationOnly", False),
                gate_checks.get("sampledQuaternionOutputs", False),
                gate_checks.get("inPlaceRoot", False),
                gate_checks.get("loopClosure", False),
                gate_checks.get("expectedNodes", False),
                gate_checks.get("expectedClipCount", False),
            ]
        )),
        "gateErrors": gate_errors,
    }


def _safe_set_preview_camera(scene, rig_obj) -> None:
    import bpy
    from math import tan
    from mathutils import Vector

    if scene.camera is None:
        cam_data = bpy.data.cameras.new("IngamePreviewCamera")
        cam_obj = bpy.data.objects.new("IngamePreviewCamera", cam_data)
        scene.collection.objects.link(cam_obj)
        scene.camera = cam_obj

    cam = scene.camera
    mesh_points = [
        obj.matrix_world @ Vector(corner)
        for obj in scene.objects
        if obj.type == "MESH"
        for corner in obj.bound_box
    ]
    if not mesh_points:
        raise RuntimeError("target rig has no mesh bounds for preview framing")
    if mesh_points:
        minimum = Vector(tuple(min(point[axis] for point in mesh_points) for axis in range(3)))
        maximum = Vector(tuple(max(point[axis] for point in mesh_points) for axis in range(3)))
        center = (minimum + maximum) * 0.5
        size = maximum - minimum
        distance = max(
            size.z * 0.5 / tan(cam.data.angle_y * 0.5),
            max(size.x, size.y) * 0.5 / tan(cam.data.angle_x * 0.5),
        ) * 1.3
        cam.location = center + Vector((0.65, -1.0, 0.15)).normalized() * distance
        cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    rig_obj.data.show_names = False
    rig_obj.data.show_axes = False


def _iter_action_fcurves(action: Any):
    if hasattr(action, "fcurves"):
        return list(action.fcurves)

    curves: list[Any] = []
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for cb in getattr(strip, "channelbags", []):
                curves.extend(list(getattr(cb, "fcurves", [])))
    return curves


def _copy_fcurve(dst_action: Any, dst_obj: Any, src_fcurve: Any, time_offset: float) -> None:
    data_path = src_fcurve.data_path
    array_index = int(src_fcurve.array_index)

    if hasattr(dst_action, "fcurves"):
        out = dst_action.fcurves.new(data_path=data_path, index=array_index)
    else:
        if dst_obj.animation_data is None:
            dst_obj.animation_data_create()
        prev_action = dst_obj.animation_data.action
        dst_obj.animation_data.action = dst_action
        out = dst_action.fcurve_ensure_for_datablock(dst_obj, data_path, index=array_index)
        dst_obj.animation_data.action = prev_action

    for kp in src_fcurve.keyframe_points:
        out.keyframe_points.insert(kp.co.x + time_offset, kp.co.y, options={"FAST"})


def generate_preview_movie(
    target_rig_path: Path,
    pack_path: Path,
    out_path: Path,
    actions_to_include: Iterable[str],
) -> str:
    import bpy

    out_path.parent.mkdir(parents=True, exist_ok=True)
    reset_scene()
    import_gltf(target_rig_path)

    target_arm = first_armature(bpy.data.objects)
    if target_arm is None:
        raise RuntimeError("target rig missing for preview")

    import_gltf(pack_path)
    include = list(actions_to_include)
    source_actions = [a for a in bpy.data.actions if a.name in set(include)]
    if len(source_actions) != len(include):
        raise RuntimeError("missing some preview actions in pack")

    # Build single linear action containing selected clips in canonical order.
    preview_action = bpy.data.actions.new("unarmed-core::preview::v01")
    ordered = sorted(source_actions, key=lambda a: include.index(a.name))
    offset = 0.0

    for action in ordered:
        for fcurve in _iter_action_fcurves(action):
            if "rotation_quaternion" not in fcurve.data_path:
                continue
            _copy_fcurve(preview_action, target_arm, fcurve, offset)

        frame_range = getattr(action, "frame_range", None)
        if frame_range:
            start, end = float(frame_range[0]), float(frame_range[1])
        else:
            frame_range = getattr(action, "curve_frame_range", (0.0, 0.0))
            start, end = float(frame_range[0]), float(frame_range[1])

        if end >= start:
            offset += end - start
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "PNG"
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.fps = 24
    scene.render.fps_base = 1.0
    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    scene.frame_start = 0
    scene.frame_end = max(0, int(offset))
    if scene.world is None:
        scene.world = bpy.data.worlds.new("IngamePreviewWorld")
    scene.world.color = (0.08, 0.08, 0.08)
    scene.view_settings.look = "AgX - Medium High Contrast"

    _safe_set_preview_camera(scene, target_arm)

    if not any(obj.type == "LIGHT" for obj in scene.objects):
        light_data = bpy.data.lights.new(name="IngamePreviewLight", type="AREA")
        light_data.energy = 1200.0
        light_data.shape = "DISK"
        light_data.size = 5.0
        light_obj = bpy.data.objects.new("IngamePreviewLight", light_data)
        scene.collection.objects.link(light_obj)
        light_obj.location = (3.5, -4.0, 5.0)
        light_obj.rotation_euler = (0.45, 0.0, 0.65)

    frame_dir = out_path.parent / f"{out_path.stem}_frames"
    frame_dir.mkdir(parents=True, exist_ok=True)
    preview_frame_template = frame_dir / "preview_"
    scene.render.filepath = str(preview_frame_template)
    bpy.ops.render.render(animation=True, write_still=False)

    input_pattern = str(preview_frame_template) + "%04d.png"
    out_path = out_path.with_suffix(".mp4")
    import shutil
    import subprocess

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise RuntimeError("ffmpeg not available for preview encoding")

    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-framerate",
            "24",
            "-i",
            input_pattern,
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(out_path),
        ],
        check=True,
    )

    return str(out_path)



def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    target_rig = Path(args.target_rig)
    fbx_dir = Path(args.fbx_dir)
    audit_report = Path(args.audit_report)
    out_glb = Path(args.out_glb)
    manifest_path = Path(args.manifest)
    preview_dir = Path(args.preview_dir)

    if not target_rig.exists():
        raise FileNotFoundError(f"target rig missing: {target_rig}")
    if not audit_report.exists():
        raise FileNotFoundError(f"audit report missing: {audit_report}")

    import bpy

    reset_scene()
    import_gltf(target_rig)

    target_armature = first_armature(bpy.data.objects)
    if target_armature is None:
        raise RuntimeError("target rig armature not found")

    target_bone_names = gather_bone_names(target_armature)
    if len(target_bone_names) != 24:
        raise RuntimeError(f"expected 24 target bones, found {len(target_bone_names)}")

    mapping = list(MAPPING_ROWS)

    required_target = {row.target for row in mapping}
    missing = [name for name in required_target if name not in set(target_bone_names)]
    if missing:
        raise RuntimeError(f"target mapping missing bones: {', '.join(sorted(missing))}")

    source_files = [clip.source_file for clip in CLIPS]
    audit_metrics = parse_clip_metrics(audit_report, source_files)

    for clip_name in CLIPS:
        if not (fbx_dir / clip_name.source_file).exists():
            raise FileNotFoundError(f"missing source FBX: {fbx_dir / clip_name.source_file}")

    generated_actions: list[str] = []
    source_bone_union: set[str] = set()

    for clip in CLIPS:
        source_path = fbx_dir / clip.source_file
        import_fbx(source_path)

        source_arm = first_armature(bpy.data.objects, skip={target_armature.name})
        if source_arm is None:
            raise RuntimeError(f"source armature missing for {clip.source_file}")

        source_bone_union.update(gather_bone_names(source_arm))
        metrics = audit_metrics[clip.source_file]
        frame_range = metrics.get("frame_range", {})
        frame_start = int(frame_range.get("start", 1))
        frame_end = int(frame_range.get("end", 1))

        action_name = build_action_name(clip.action)
        bake_clip(
            target_armature=target_armature,
            source_armature=source_arm,
            frame_start=frame_start,
            frame_end=frame_end,
            action_name=action_name,
            mapping_rows=mapping,
        )
        generated_actions.append(action_name)
        keep_only(target_armature)
    keep_actions(set(generated_actions))

    target_actions = [action for action in bpy.data.actions if action.name in set(generated_actions)]
    if len(target_actions) != len(CLIPS):
        raise RuntimeError(f"expected {len(CLIPS)} clip actions, got {len(target_actions)}")

    out_glb.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    target_armature.select_set(True)
    bpy.context.view_layer.objects.active = target_armature

    bpy.ops.object.mode_set(mode="POSE", toggle=False)
    bpy.ops.pose.select_all(action="DESELECT")

    bpy.ops.export_scene.gltf(
        filepath=str(out_glb),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_nla_strips=False,
        export_yup=True,
        export_materials="NONE",
        export_lights=False,
        export_cameras=False,
        export_image_format="NONE",
    )
    postprocess_rest_relative_deltas(out_glb, target_rig, EXPECTED_CLIP_NAMES)

    if not out_glb.exists():
        raise RuntimeError(f"export failed for {out_glb}")

    clip_overrides = []
    for clip in CLIPS:
        metric = audit_metrics[clip.source_file]
        frame_range = metric.get("frame_range", {})
        frame_start = int(frame_range.get("start", 1))
        frame_end = int(frame_range.get("end", 1))
        fps = int(metric.get("scene_fps", 24))
        hips = metric.get("hips_displacement", {}) or {}
        clip_overrides.append(
            {
                "action": clip.action,
                "source": clip.source_file,
                "sourceFile": clip.source_file,
                "clipName": build_action_name(clip.action),
                "frameStart": frame_start,
                "frameEnd": frame_end,
                "sourceFps": fps,
                "durationSeconds": (frame_end - frame_start) / float(fps) if fps else 0.0,
                "sourceRootTravel": {
                    "x": float(hips.get("x", 0.0)),
                    "y": float(hips.get("y", 0.0)),
                    "z": float(hips.get("z", 0.0)),
                },
                "exportedRootDeviation": {"x": 0.0, "z": 0.0},
                "loop": bool(clip.loop),
                "sourceSha256": sha256(source_path) if (source_path := (fbx_dir / clip.source_file)).exists() else "",
            }
        )

    gates_ok, gate_errors, gate_checks = run_gates(
        glb_path=out_glb,
        expected_clip_overrides=clip_overrides,
        expected_target_joints=target_bone_names,
    )

    manifest = build_manifest(
        out_glb=out_glb,
        target_path=target_rig,
        actions=CLIPS,
        metrics=audit_metrics,
        mapping=mapping,
        target_bone_names=target_bone_names,
        source_bone_names=sorted(source_bone_union),
        gate_errors=gate_errors,
        gate_checks=gate_checks,
    )

    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    preview_out = None
    if not args.skip_preview:
        preview_out = preview_dir / "unarmed-core-preview.mp4"
        generate_preview_movie(
            target_rig_path=target_rig,
            pack_path=out_glb,
            out_path=preview_out,
            actions_to_include=[a for a in EXPECTED_CLIP_NAMES if a in ["unarmed-core::move::v01", "unarmed-core::attack::v01", "unarmed-core::critical::v01"]],
        )

    print(f"RETARGET_OUT_GLB={out_glb}")
    print(f"RETARGET_MANIFEST={manifest_path}")
    print(f"RETARGET_RUNTIME_ELIGIBLE={manifest['runtimeEligible']}")
    if preview_out:
        print(f"RETARGET_PREVIEW={preview_out}")

    if not gates_ok:
        raise RuntimeError(f"gates failed: {json.dumps(gate_errors, indent=2)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
