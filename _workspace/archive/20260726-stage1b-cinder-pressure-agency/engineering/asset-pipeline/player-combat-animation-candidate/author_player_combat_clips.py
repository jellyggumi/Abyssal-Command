#!/usr/bin/env python3
"""Author Dusk Warden combat clips and deterministically guard every deployed action pose."""

import argparse
import copy
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Euler


MELEE_NAME = "dusk-warden::attack_melee::v01"
RANGED_NAME = "dusk-warden::attack_ranged::v01"
SOURCE_ATTACK = "dusk-warden::attack::v01"
EXPECTED_SOURCE_SHA256 = "746975a660f1027c4c9a572e117a7519eff459b7cbf3d3c1ef81db8880e7888f"
EXPECTED_DEFORM_JOINTS = 24
EXPECTED_SOURCE_ACTIONS = [
    "dusk-warden::attack::v01",
    "dusk-warden::avoid::v01",
    "dusk-warden::bighit::v01",
    "dusk-warden::critical::v01",
    "dusk-warden::defence::v01",
    "dusk-warden::die::v01",
    "dusk-warden::hit::v01",
    "dusk-warden::idle::v01",
    "dusk-warden::move::v01",
    "dusk-warden::run::v01",
    "dusk-warden::show::v01",
]
FPS = 30
FRAME_START = 1
FRAME_END = 30
ROOT_BONE = "DEF-spine"
FOOT_BONES = ["DEF-foot.L", "DEF-toe.L", "DEF-foot.R", "DEF-toe.R"]
GUARD_POSE_DEGREES = 95.0
GUARD_BONE_DEGREES = {
    "DEF-upper_arm.L": -GUARD_POSE_DEGREES,
    "DEF-upper_arm.R": GUARD_POSE_DEGREES,
}
GUARDED_ACTION_KEYS = frozenset({"avoid", "bighit", "defence", "die", "hit", "idle", "move", "run", "show"})
STRIKE_ACTION_KEYS = frozenset({"attack", "critical", "attack_melee", "attack_ranged"})
STRIKE_CONTACT_FRAMES = {
    "attack_melee": 14,
    "attack_ranged": 14,
}
# Source clips are baked at 24 fps. These 1-based samples are the measured
# maximum world-space hand-depth separation (the readable impact silhouette).
SOURCE_STRIKE_CONTACT_SAMPLES = {
    "attack": 45,
    "critical": 29,
}

MELEE_POSES = [
    (1, "guard", {
        "DEF-spine.002": (2, 0, -6), "DEF-spine.003": (0, 0, -4),
        "DEF-spine.005": (0, 2, 4),
        "DEF-shoulder.R": (-5, 0, 6), "DEF-upper_arm.R": (8, -55, -12),
        "DEF-forearm.R": (65, 5, 0), "DEF-hand.R": (0, 0, 8),
        "DEF-shoulder.L": (3, 0, -4), "DEF-upper_arm.L": (-5, 55, 10),
        "DEF-forearm.L": (45, -5, 0), "DEF-hand.L": (0, 0, -5),
    }),
    (6, "guarded_wind_up", {
        "DEF-spine.001": (-2, 0, -8), "DEF-spine.002": (-3, 0, -24),
        "DEF-spine.003": (-2, 0, -14), "DEF-spine.005": (0, 4, 10),
        "DEF-shoulder.R": (0, -5, 16), "DEF-upper_arm.R": (32, -38, -20),
        "DEF-forearm.R": (82, 8, 0), "DEF-hand.R": (0, 0, 18),
        "DEF-shoulder.L": (2, 0, -8), "DEF-upper_arm.L": (-12, 45, 18),
        "DEF-forearm.L": (35, -4, 0), "DEF-hand.L": (0, 0, -8),
    }),
    (10, "loaded_strike", {
        "DEF-spine.001": (-3, 0, -10), "DEF-spine.002": (-5, 0, -31),
        "DEF-spine.003": (-3, 0, -18), "DEF-spine.005": (0, 5, 13),
        "DEF-shoulder.R": (5, -7, 22), "DEF-upper_arm.R": (45, -30, -28),
        "DEF-forearm.R": (88, 10, 2), "DEF-hand.R": (0, -4, 24),
        "DEF-shoulder.L": (4, 0, -10), "DEF-upper_arm.L": (-18, 40, 24),
        "DEF-forearm.L": (30, -5, 0), "DEF-hand.L": (0, 0, -10),
    }),
    (14, "slash_contact", {
        "DEF-spine.001": (5, 0, 12), "DEF-spine.002": (10, 0, 32),
        "DEF-spine.003": (6, 0, 18), "DEF-spine.005": (0, -3, -12),
        "DEF-shoulder.R": (-8, 5, -18), "DEF-upper_arm.R": (-72, -50, 22),
        "DEF-forearm.R": (18, -4, 0), "DEF-hand.R": (0, 6, -30),
        "DEF-shoulder.L": (-2, 0, 12), "DEF-upper_arm.L": (30, 60, -24),
        "DEF-forearm.L": (58, 6, 0), "DEF-hand.L": (0, 0, 14),
    }),
    (18, "follow_through", {
        "DEF-spine.001": (7, 0, 16), "DEF-spine.002": (14, 0, 42),
        "DEF-spine.003": (8, 0, 24), "DEF-spine.005": (0, -4, -16),
        "DEF-shoulder.R": (-12, 8, -24), "DEF-upper_arm.R": (-92, -42, 35),
        "DEF-forearm.R": (8, -8, 0), "DEF-hand.R": (0, 8, -38),
        "DEF-shoulder.L": (-4, 0, 16), "DEF-upper_arm.L": (42, 62, -30),
        "DEF-forearm.L": (64, 8, 0), "DEF-hand.L": (0, 0, 18),
    }),
    (24, "recovery", {
        "DEF-spine.001": (2, 0, 5), "DEF-spine.002": (5, 0, 12),
        "DEF-spine.003": (2, 0, 7), "DEF-spine.005": (0, 0, -3),
        "DEF-shoulder.R": (-4, 2, -6), "DEF-upper_arm.R": (-25, -54, 8),
        "DEF-forearm.R": (42, 0, 0), "DEF-hand.R": (0, 2, -8),
        "DEF-shoulder.L": (1, 0, 3), "DEF-upper_arm.L": (8, 57, -7),
        "DEF-forearm.L": (48, 0, 0), "DEF-hand.L": (0, 0, 4),
    }),
    (30, "settled_guard", {
        "DEF-spine.002": (2, 0, -3), "DEF-spine.003": (0, 0, -2),
        "DEF-spine.005": (0, 1, 2),
        "DEF-shoulder.R": (-3, 0, 3), "DEF-upper_arm.R": (5, -56, -8),
        "DEF-forearm.R": (60, 3, 0), "DEF-hand.R": (0, 0, 5),
        "DEF-shoulder.L": (2, 0, -2), "DEF-upper_arm.L": (-3, 56, 7),
        "DEF-forearm.L": (43, -3, 0), "DEF-hand.L": (0, 0, -3),
    }),
]

RANGED_POSES = [
    (1, "brace", {
        "DEF-spine.001": (2, 0, -2), "DEF-spine.002": (4, 0, -6),
        "DEF-spine.003": (2, 0, -4), "DEF-spine.005": (0, 2, 4),
        "DEF-shoulder.R": (-3, 0, 6), "DEF-upper_arm.R": (-18, -42, -18),
        "DEF-forearm.R": (72, 6, 0), "DEF-hand.R": (0, -3, 8),
        "DEF-shoulder.L": (2, 0, -5), "DEF-upper_arm.L": (14, 48, 20),
        "DEF-forearm.L": (60, -5, 0), "DEF-hand.L": (0, 3, -6),
    }),
    (6, "raise_aim", {
        "DEF-spine.001": (1, 0, -4), "DEF-spine.002": (2, 0, -10),
        "DEF-spine.003": (1, 0, -7), "DEF-spine.005": (0, 4, 7),
        "DEF-shoulder.R": (-6, -3, 10), "DEF-upper_arm.R": (-36, -25, -12),
        "DEF-forearm.R": (42, 5, -3), "DEF-hand.R": (0, -6, 10),
        "DEF-shoulder.L": (4, 2, -8), "DEF-upper_arm.L": (28, 34, 14),
        "DEF-forearm.L": (54, -4, 3), "DEF-hand.L": (0, 5, -8),
    }),
    (11, "aim_hold", {
        "DEF-spine.001": (1, 0, -5), "DEF-spine.002": (1, 0, -13),
        "DEF-spine.003": (0, 0, -8), "DEF-spine.005": (0, 5, 9),
        "DEF-shoulder.R": (-8, -4, 12), "DEF-upper_arm.R": (-44, -18, -8),
        "DEF-forearm.R": (30, 3, -5), "DEF-hand.R": (0, -8, 12),
        "DEF-shoulder.L": (6, 3, -10), "DEF-upper_arm.L": (34, 28, 10),
        "DEF-forearm.L": (48, -3, 5), "DEF-hand.L": (0, 7, -10),
    }),
    (14, "recoil", {
        "DEF-spine.001": (-6, 0, 2), "DEF-spine.002": (-12, 0, 7),
        "DEF-spine.003": (-8, 0, 5), "DEF-spine.005": (3, -2, -4),
        "DEF-shoulder.R": (6, 4, -7), "DEF-upper_arm.R": (-27, -32, 2),
        "DEF-forearm.R": (58, -2, 6), "DEF-hand.R": (4, 6, -8),
        "DEF-shoulder.L": (-4, -3, 6), "DEF-upper_arm.L": (18, 40, -3),
        "DEF-forearm.L": (68, 3, -5), "DEF-hand.L": (-3, -5, 7),
    }),
    (18, "recoil_settle", {
        "DEF-spine.001": (-2, 0, -1), "DEF-spine.002": (-4, 0, -4),
        "DEF-spine.003": (-3, 0, -2), "DEF-spine.005": (1, 2, 3),
        "DEF-shoulder.R": (0, 0, 4), "DEF-upper_arm.R": (-34, -27, -6),
        "DEF-forearm.R": (46, 2, 1), "DEF-hand.R": (1, -2, 4),
        "DEF-shoulder.L": (2, 0, -4), "DEF-upper_arm.L": (25, 35, 7),
        "DEF-forearm.L": (58, -2, 0), "DEF-hand.L": (-1, 2, -4),
    }),
    (24, "lower_from_aim", {
        "DEF-spine.001": (1, 0, -2), "DEF-spine.002": (3, 0, -6),
        "DEF-spine.003": (1, 0, -4), "DEF-spine.005": (0, 2, 5),
        "DEF-shoulder.R": (-3, 0, 7), "DEF-upper_arm.R": (-24, -39, -13),
        "DEF-forearm.R": (61, 4, -1), "DEF-hand.R": (0, -4, 7),
        "DEF-shoulder.L": (3, 0, -6), "DEF-upper_arm.L": (18, 45, 15),
        "DEF-forearm.L": (62, -4, 1), "DEF-hand.L": (0, 4, -7),
    }),
    (30, "settled_brace", {
        "DEF-spine.001": (1, 0, -1), "DEF-spine.002": (3, 0, -4),
        "DEF-spine.003": (1, 0, -3), "DEF-spine.005": (0, 1, 3),
        "DEF-shoulder.R": (-2, 0, 5), "DEF-upper_arm.R": (-16, -45, -15),
        "DEF-forearm.R": (68, 5, 0), "DEF-hand.R": (0, -3, 6),
        "DEF-shoulder.L": (2, 0, -4), "DEF-upper_arm.L": (12, 50, 18),
        "DEF-forearm.L": (58, -4, 0), "DEF-hand.L": (0, 3, -5),
    }),
]


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--audit", required=True)
    return parser.parse_args(argv)


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def canonical_digest(value):
    return sha256_bytes(json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8"))


def load_glb(path):
    raw = Path(path).read_bytes()
    magic, version, total = struct.unpack_from("<4sII", raw, 0)
    if magic != b"glTF" or version != 2 or total != len(raw):
        raise RuntimeError(f"invalid GLB header: {path}")
    document = None
    binary = b""
    offset = 12
    while offset < len(raw):
        length, kind = struct.unpack_from("<II", raw, offset)
        offset += 8
        payload = raw[offset:offset + length]
        offset += length
        if kind == 0x4E4F534A:
            document = json.loads(payload.decode("utf-8"))
        elif kind == 0x004E4942:
            binary = payload
    if document is None:
        raise RuntimeError(f"GLB has no JSON chunk: {path}")
    return raw, document, binary


def write_glb(path, document, binary):
    document["buffers"][0]["byteLength"] = len(binary)
    json_payload = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_payload += b" " * ((-len(json_payload)) % 4)
    binary_payload = binary + b"\0" * ((-len(binary)) % 4)
    total = 12 + 8 + len(json_payload) + 8 + len(binary_payload)
    raw = bytearray(struct.pack("<4sII", b"glTF", 2, total))
    raw.extend(struct.pack("<II", len(json_payload), 0x4E4F534A))
    raw.extend(json_payload)
    raw.extend(struct.pack("<II", len(binary_payload), 0x004E4942))
    raw.extend(binary_payload)
    Path(path).write_bytes(raw)


def iter_fcurves(action):
    flat = getattr(action, "fcurves", None)
    if flat is not None:
        yield from flat
        return
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for channelbag in getattr(strip, "channelbags", []):
                yield from getattr(channelbag, "fcurves", [])


def blender_action_snapshot(action):
    curves = []
    for curve in iter_fcurves(action):
        keys = []
        for point in curve.keyframe_points:
            keys.append([
                round(float(point.co.x), 6),
                round(float(point.co.y), 9),
                point.interpolation,
            ])
        curves.append({"dataPath": curve.data_path, "arrayIndex": curve.array_index, "keys": keys})
    curves.sort(key=lambda item: (item["dataPath"], item["arrayIndex"]))
    return {"name": action.name, "frameRange": [float(v) for v in action.frame_range], "curves": curves}


def reset_pose(rig):
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()


def author_action(rig, name, poses):
    if bpy.data.actions.get(name):
        raise RuntimeError(f"new action name already exists: {name}")
    action = bpy.data.actions.new(name=name)
    action.use_fake_user = True
    action["looping"] = False
    action["fps"] = FPS
    rig.animation_data.action = action
    animated = set()
    for frame, _stage, rotations in poses:
        reset_pose(rig)
        for bone_name, degrees in rotations.items():
            bone = rig.pose.bones.get(bone_name)
            if bone is None:
                raise RuntimeError(f"missing pose bone: {bone_name}")
            bone.rotation_mode = "QUATERNION"
            bone.rotation_quaternion = Euler(
                tuple(math.radians(value) for value in degrees), "XYZ"
            ).to_quaternion()
            bone.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=bone.name)
            animated.add(bone_name)
    for curve in iter_fcurves(action):
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"
            point.easing = "AUTO"
    rig.animation_data.action = None
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name=name, start=FRAME_START, action=action)
    strip.action_frame_start = FRAME_START
    strip.action_frame_end = FRAME_END
    strip.repeat = 1.0
    strip.extrapolation = "NOTHING"
    return action, track, sorted(animated)


def export_authored_stage(rig, path):
    bpy.context.scene.frame_start = FRAME_START
    bpy.context.scene.frame_end = FRAME_END
    bpy.context.scene.render.fps = FPS
    bpy.context.scene.render.fps_base = 1.0
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_materials="EXPORT",
        export_animations=True,
        export_skins=True,
        export_cameras=True,
        export_lights=True,
    )
    if not path.is_file() or path.stat().st_size == 0:
        raise RuntimeError("Blender glTF exporter did not create the authored stage")


def census(document):
    primitives = [primitive for mesh in document.get("meshes", []) for primitive in mesh.get("primitives", [])]
    skin_joint_counts = [len(skin.get("joints", [])) for skin in document.get("skins", [])]
    return {
        "nodes": len(document.get("nodes", [])),
        "meshes": len(document.get("meshes", [])),
        "primitives": len(primitives),
        "materials": len(document.get("materials", [])),
        "materialNames": [item.get("name") for item in document.get("materials", [])],
        "images": len(document.get("images", [])),
        "textures": len(document.get("textures", [])),
        "skins": len(document.get("skins", [])),
        "skinJointCounts": skin_joint_counts,
        "deformJoints": skin_joint_counts[0] if len(skin_joint_counts) == 1 else None,
        "animations": len(document.get("animations", [])),
        "animationNames": [item.get("name") for item in document.get("animations", [])],
        "accessors": len(document.get("accessors", [])),
        "bufferViews": len(document.get("bufferViews", [])),
    }


def append_authored_animations(source_document, source_binary, stage_document, stage_binary):
    result = copy.deepcopy(source_document)
    source_length = int(source_document["buffers"][0]["byteLength"])
    result_binary = bytearray(source_binary[:source_length])
    stage_nodes = stage_document.get("nodes", [])
    source_node_by_name = {}
    for index, node in enumerate(result.get("nodes", [])):
        name = node.get("name")
        if name in source_node_by_name:
            raise RuntimeError(f"duplicate source node name: {name}")
        source_node_by_name[name] = index
    accessor_map = {}
    buffer_view_map = {}

    def copy_buffer_view(index):
        if index in buffer_view_map:
            return buffer_view_map[index]
        original = stage_document["bufferViews"][index]
        start = int(original.get("byteOffset", 0))
        end = start + int(original["byteLength"])
        while len(result_binary) % 4:
            result_binary.append(0)
        clone = copy.deepcopy(original)
        clone["buffer"] = 0
        clone["byteOffset"] = len(result_binary)
        result_binary.extend(stage_binary[start:end])
        new_index = len(result.setdefault("bufferViews", []))
        result["bufferViews"].append(clone)
        buffer_view_map[index] = new_index
        return new_index

    def copy_accessor(index):
        if index in accessor_map:
            return accessor_map[index]
        clone = copy.deepcopy(stage_document["accessors"][index])
        if "bufferView" not in clone:
            raise RuntimeError(f"animation accessor {index} has no bufferView")
        clone["bufferView"] = copy_buffer_view(clone["bufferView"])
        if "sparse" in clone:
            raise RuntimeError("sparse animation accessors are not supported")
        new_index = len(result.setdefault("accessors", []))
        result["accessors"].append(clone)
        accessor_map[index] = new_index
        return new_index

    stage_by_name = {item.get("name"): item for item in stage_document.get("animations", [])}
    for name in (MELEE_NAME, RANGED_NAME):
        if name not in stage_by_name:
            raise RuntimeError(f"Blender export omitted {name}")
        accessor_map.clear()
        animation = copy.deepcopy(stage_by_name[name])
        for sampler in animation.get("samplers", []):
            sampler["input"] = copy_accessor(sampler["input"])
            sampler["output"] = copy_accessor(sampler["output"])
        for channel in animation.get("channels", []):
            stage_node = stage_nodes[channel["target"]["node"]]
            node_name = stage_node.get("name")
            if node_name not in source_node_by_name:
                raise RuntimeError(f"authored animation targets unknown source node: {node_name}")
            channel["target"]["node"] = source_node_by_name[node_name]
        result.setdefault("animations", []).append(animation)
    result["buffers"][0]["byteLength"] = len(result_binary)
    return result, bytes(result_binary)


COMPONENT_FORMAT = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
TYPE_COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT2": 4, "MAT3": 9, "MAT4": 16}


def accessor_values(document, binary, index):
    accessor = document["accessors"][index]
    view = document["bufferViews"][accessor["bufferView"]]
    count = int(accessor["count"])
    components = TYPE_COMPONENTS[accessor["type"]]
    fmt = COMPONENT_FORMAT[accessor["componentType"]]
    component_size = struct.calcsize("<" + fmt)
    packed_size = components * component_size
    stride = int(view.get("byteStride", packed_size))
    start = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
    rows = []
    for row in range(count):
        rows.append(list(struct.unpack_from("<" + fmt * components, binary, start + row * stride)))
    return rows


def action_key(name):
    parts = name.split("::") if isinstance(name, str) else []
    return parts[1] if len(parts) >= 3 else None


def apply_guard_pose_correction(document, binary):
    """Rotate both upper-arm quaternion tracks around local Z for a guarded silhouette."""
    mutable = bytearray(binary)
    allowed_bytes = bytearray(len(mutable))
    node_names = [node.get("name") for node in document.get("nodes", [])]
    channels = []
    actions = {}

    for animation in document.get("animations", []):
        key = action_key(animation.get("name"))
        if key in GUARDED_ACTION_KEYS:
            mode = "guard"
        elif key in STRIKE_ACTION_KEYS:
            mode = "strike"
        else:
            continue
        actions[key] = mode

        for channel in animation.get("channels", []):
            target = channel["target"]
            if target.get("path") != "rotation":
                continue
            bone = node_names[target["node"]]
            if bone not in GUARD_BONE_DEGREES:
                continue

            sampler = animation["samplers"][channel["sampler"]]
            times = [row[0] for row in accessor_values(document, binary, sampler["input"])]
            accessor_index = sampler["output"]
            accessor = document["accessors"][accessor_index]
            view = document["bufferViews"][accessor["bufferView"]]
            if (
                accessor.get("componentType") != 5126
                or accessor.get("type") != "VEC4"
                or "sparse" in accessor
            ):
                raise RuntimeError(f"guard correction requires a dense float VEC4 accessor: {accessor_index}")
            count = int(accessor["count"])
            if len(times) != count or not times or times[-1] <= times[0]:
                raise RuntimeError(f"guard correction has invalid timing for {animation.get('name')}: {times}")

            contact_row = None
            contact_source = None
            if mode == "strike":
                if key in STRIKE_CONTACT_FRAMES:
                    contact_target = STRIKE_CONTACT_FRAMES[key] / FPS
                    contact_source = f"authored-frame-{STRIKE_CONTACT_FRAMES[key]}"
                    contact_row = min(range(count), key=lambda row: abs(times[row] - contact_target))
                elif key in SOURCE_STRIKE_CONTACT_SAMPLES:
                    contact_sample = SOURCE_STRIKE_CONTACT_SAMPLES[key]
                    if not 1 <= contact_sample <= count:
                        raise RuntimeError(f"source contact sample is out of range for {key}: {contact_sample}")
                    contact_row = contact_sample - 1
                    contact_source = f"source-max-hand-depth-sample-{contact_sample}"
                else:
                    raise RuntimeError(f"strike action has no authored contact sample: {key}")
            contact_time = times[contact_row] if contact_row is not None else None

            weights = []
            for row, time in enumerate(times):
                if mode == "guard":
                    weight = 1.0
                elif row <= contact_row:
                    weight = (contact_time - time) / (contact_time - times[0])
                else:
                    weight = (time - contact_time) / (times[-1] - contact_time)
                weights.append(max(0.0, min(1.0, weight)))

            stride = int(view.get("byteStride", 16))
            start = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
            for row, weight in enumerate(weights):
                radians = math.radians(GUARD_BONE_DEGREES[bone] * weight) / 2.0
                sine = math.sin(radians)
                cosine = math.cos(radians)
                offset = start + row * stride
                x, y, z, w = struct.unpack_from("<ffff", mutable, offset)
                corrected = (
                    x * cosine + y * sine,
                    -x * sine + y * cosine,
                    w * sine + z * cosine,
                    w * cosine - z * sine,
                )
                length = math.sqrt(sum(value * value for value in corrected))
                struct.pack_into("<ffff", mutable, offset, *(value / length for value in corrected))
                allowed_bytes[offset:offset + 16] = b"\1" * 16

            corrected_values = accessor_values(document, mutable, accessor_index)
            sampled_degrees = [GUARD_BONE_DEGREES[bone] * weight for weight in weights]
            channels.append({
                "action": animation.get("name"),
                "actionKey": key,
                "mode": mode,
                "bone": bone,
                "timeAccessor": sampler["input"],
                "valueAccessor": accessor_index,
                "keyframes": count,
                "sampleTimeRangeSeconds": [times[0], times[-1]],
                "contactSource": contact_source,
                "contactFrame": STRIKE_CONTACT_FRAMES.get(key),
                "contactSample": (contact_row + 1) if contact_row is not None else None,
                "contactTimeSeconds": contact_time,
                "guardDegreesAtStart": sampled_degrees[0],
                "guardDegreesAtContact": sampled_degrees[contact_row] if contact_row is not None else sampled_degrees[0],
                "guardDegreesAtRecovery": sampled_degrees[-1],
                "correctedValuePayloadSha256": sha256_bytes(
                    json.dumps(corrected_values, separators=(",", ":")).encode("utf-8")
                ),
            })

    expected_actions = GUARDED_ACTION_KEYS | STRIKE_ACTION_KEYS
    if set(actions) != expected_actions:
        raise RuntimeError(f"guard correction action mismatch: {sorted(actions)}")
    channels_by_action = {
        key: [channel for channel in channels if channel["actionKey"] == key]
        for key in expected_actions
    }
    for key, action_channels in channels_by_action.items():
        if len(action_channels) != 2:
            raise RuntimeError(f"guard correction requires exactly two upper-arm channels for {key}")
        if {channel["bone"] for channel in action_channels} != set(GUARD_BONE_DEGREES):
            raise RuntimeError(f"guard correction has incomplete L/R upper-arm coverage for {key}")
        if len({channel["valueAccessor"] for channel in action_channels}) != 2:
            raise RuntimeError(f"guard correction reuses an upper-arm accessor within {key}")
    value_accessors = [channel["valueAccessor"] for channel in channels]
    if len(set(value_accessors)) != len(value_accessors):
        raise RuntimeError("guard correction reuses a quaternion accessor across actions")

    changed_offsets = [
        index
        for index, (before, after) in enumerate(zip(binary, mutable))
        if before != after
    ]
    changed_outside = sum(not allowed_bytes[index] for index in changed_offsets)
    if changed_outside:
        raise RuntimeError(f"guard correction changed {changed_outside} bytes outside declared accessors")
    report = {
        "algorithm": "postmultiply-local-z-piecewise-contact-quaternion-v2",
        "guardPoseDegrees": GUARD_POSE_DEGREES,
        "actions": actions,
        "channels": channels,
        "preCorrectionBinarySha256": sha256_bytes(binary),
        "postCorrectionBinarySha256": sha256_bytes(mutable),
        "changedByteCount": len(changed_offsets),
        "changedBytesOutsideCorrectedAccessors": changed_outside,
        "correctionPayloadSha256": canonical_digest(channels),
    }
    return bytes(mutable), report


def channel_variation(path, values):
    if not values:
        return 0.0
    first = values[0]
    maximum = 0.0
    for value in values[1:]:
        candidate = value
        if path == "rotation" and sum(a * b for a, b in zip(first, value)) < 0:
            candidate = [-item for item in value]
        maximum = max(maximum, math.sqrt(sum((a - b) ** 2 for a, b in zip(first, candidate))))
    return maximum


def animation_report(document, binary, animation):
    node_names = [node.get("name", f"node_{index}") for index, node in enumerate(document.get("nodes", []))]
    channels = []
    for channel in animation.get("channels", []):
        sampler = animation["samplers"][channel["sampler"]]
        values = accessor_values(document, binary, sampler["output"])
        target = channel["target"]
        path = target["path"]
        variation = channel_variation(path, values)
        channels.append({
            "bone": node_names[target["node"]],
            "path": path,
            "keyframes": len(values),
            "timeAccessor": sampler["input"],
            "valueAccessor": sampler["output"],
            "interpolation": sampler.get("interpolation", "LINEAR"),
            "variation": round(variation, 9),
            "varying": variation > 1e-7,
            "valuePayloadSha256": sha256_bytes(json.dumps(values, separators=(",", ":")).encode("utf-8")),
        })
    timing_accessors = []
    for accessor_index in sorted({sampler["input"] for sampler in animation.get("samplers", [])}):
        times = [row[0] for row in accessor_values(document, binary, accessor_index)]
        steps = [times[index] - times[index - 1] for index in range(1, len(times))]
        timing_accessors.append({
            "accessor": accessor_index,
            "sampleCount": len(times),
            "timeRangeSeconds": [round(times[0], 9), round(times[-1], 9)],
            "max30FpsStepErrorSeconds": (
                round(max(abs(step - 1.0 / FPS) for step in steps), 9) if steps else None
            ),
        })
    bone_channels = [item for item in channels if item["varying"] and item["path"] in ("rotation", "translation", "scale")]
    return {
        "name": animation.get("name"),
        "channels": channels,
        "animatedBoneChannels": bone_channels,
        "animatedBones": sorted({item["bone"] for item in bone_channels}),
        "samplerAccessorPairs": [[sampler["input"], sampler["output"]] for sampler in animation.get("samplers", [])],
        "timingAccessors": timing_accessors,
        "sampledAt30Fps": any(
            item["sampleCount"] >= 3 and item["max30FpsStepErrorSeconds"] <= 1e-6
            for item in timing_accessors
        ),
    }


def translation_drift(document, binary, animation, bone_name):
    node_names = [node.get("name", f"node_{index}") for index, node in enumerate(document.get("nodes", []))]
    for channel in animation.get("channels", []):
        target = channel["target"]
        if target["path"] != "translation" or node_names[target["node"]] != bone_name:
            continue
        sampler = animation["samplers"][channel["sampler"]]
        values = accessor_values(document, binary, sampler["output"])
        first = values[0]
        return max(math.sqrt(sum((a - b) ** 2 for a, b in zip(first, value))) for value in values)
    return 0.0


def animation_fingerprint(document, binary, animation):
    references = []
    for sampler in animation.get("samplers", []):
        pair = {}
        for field in ("input", "output"):
            accessor_index = sampler[field]
            accessor = document["accessors"][accessor_index]
            view = document["bufferViews"][accessor["bufferView"]]
            start = int(view.get("byteOffset", 0))
            end = start + int(view["byteLength"])
            pair[field] = {
                "accessorIndex": accessor_index,
                "accessor": accessor,
                "bufferViewIndex": accessor["bufferView"],
                "bufferView": view,
                "bufferViewSha256": sha256_bytes(binary[start:end]),
            }
        references.append(pair)
    return canonical_digest({"animation": animation, "references": references})


def embedded_texture_report(document):
    images = document.get("images", [])
    textures = document.get("textures", [])
    materials = document.get("materials", [])
    rows = []
    for material in materials:
        pbr = material.get("pbrMetallicRoughness", {})
        for role, info in (("baseColor", pbr.get("baseColorTexture")), ("normal", material.get("normalTexture"))):
            if not info:
                continue
            texture = textures[info["index"]]
            source = texture.get("source", texture.get("extensions", {}).get("KHR_texture_basisu", {}).get("source"))
            image = images[source]
            rows.append({
                "material": material.get("name"),
                "role": role,
                "textureIndex": info["index"],
                "imageIndex": source,
                "imageName": image.get("name"),
                "mimeType": image.get("mimeType"),
                "bufferView": image.get("bufferView"),
                "embedded": "bufferView" in image and "uri" not in image,
            })
    return rows


def main():
    args = parse_args()
    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    audit_path = Path(args.audit).resolve()
    repository_root = next(parent for parent in Path(__file__).resolve().parents if (parent / "package.json").is_file())
    script_path = Path(__file__).resolve().relative_to(repository_root).as_posix()
    input_relative = input_path.relative_to(repository_root).as_posix()
    output_relative = output_path.relative_to(repository_root).as_posix()
    audit_relative = audit_path.relative_to(repository_root).as_posix()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    audit_path.parent.mkdir(parents=True, exist_ok=True)
    stage_path = output_path.parent / ".dusk-warden-authored-stage.glb"

    source_raw, source_document, source_binary = load_glb(input_path)
    source_sha256 = sha256_bytes(source_raw)
    if source_sha256 != EXPECTED_SOURCE_SHA256:
        raise RuntimeError(
            f"source GLB changed; remeasure strike contact samples before authoring: {source_sha256}"
        )
    source_census = census(source_document)
    if source_census["animationNames"] != EXPECTED_SOURCE_ACTIONS:
        raise RuntimeError(f"unexpected source action library: {source_census['animationNames']}")
    if source_census["skins"] != 1 or source_census["deformJoints"] != EXPECTED_DEFORM_JOINTS:
        raise RuntimeError(
            f"unexpected source rig: {source_census['skins']} skins, "
            f"{source_census['deformJoints']} deform joints"
        )
    source_fingerprints = {
        item["name"]: animation_fingerprint(source_document, source_binary, item)
        for item in source_document["animations"]
    }

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(input_path), import_pack_images=True)
    rigs = [item for item in bpy.data.objects if item.type == "ARMATURE"]
    if len(rigs) != 1:
        raise RuntimeError(f"expected one imported armature, found {len(rigs)}")
    rig = rigs[0]
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="POSE")
    rig.animation_data_create()

    imported_actions = {action.name: action for action in bpy.data.actions}
    if sorted(imported_actions) != sorted(EXPECTED_SOURCE_ACTIONS):
        raise RuntimeError(f"Blender imported unexpected actions: {sorted(imported_actions)}")
    old_blender_snapshots = {name: blender_action_snapshot(imported_actions[name]) for name in EXPECTED_SOURCE_ACTIONS}
    attack_snapshot = old_blender_snapshots[SOURCE_ATTACK]
    source_attack_channels = [
        {"dataPath": curve["dataPath"], "arrayIndex": curve["arrayIndex"], "keyframes": len(curve["keys"])}
        for curve in attack_snapshot["curves"]
        if "pose.bones" in curve["dataPath"]
    ]
    if not source_attack_channels:
        raise RuntimeError("source attack has no imported pose-bone channels")

    existing_track_mutes = {track.name: track.mute for track in rig.animation_data.nla_tracks}
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    melee_action, melee_track, melee_bones = author_action(rig, MELEE_NAME, MELEE_POSES)
    ranged_action, ranged_track, ranged_bones = author_action(rig, RANGED_NAME, RANGED_POSES)
    for track in rig.animation_data.nla_tracks:
        if track.name in existing_track_mutes:
            track.mute = existing_track_mutes[track.name]
    melee_track.mute = False
    ranged_track.mute = False
    reset_pose(rig)
    bpy.ops.object.mode_set(mode="OBJECT")

    new_blender_snapshots = {name: blender_action_snapshot(bpy.data.actions[name]) for name in EXPECTED_SOURCE_ACTIONS}
    blender_actions_unchanged = {
        name: canonical_digest(old_blender_snapshots[name]) == canonical_digest(new_blender_snapshots[name])
        for name in EXPECTED_SOURCE_ACTIONS
    }
    if not all(blender_actions_unchanged.values()):
        raise RuntimeError("authoring mutated an imported source action")

    export_authored_stage(rig, stage_path)
    stage_raw, stage_document, stage_binary = load_glb(stage_path)
    stage_names = [item.get("name") for item in stage_document.get("animations", [])]
    if len(stage_names) != 13 or set(stage_names) != set(EXPECTED_SOURCE_ACTIONS + [MELEE_NAME, RANGED_NAME]):
        raise RuntimeError(f"Blender stage export has wrong actions: {stage_names}")

    output_document, merged_binary = append_authored_animations(
        source_document, source_binary, stage_document, stage_binary
    )
    output_binary, guard_pose_report = apply_guard_pose_correction(output_document, merged_binary)
    write_glb(output_path, output_document, output_binary)
    output_raw, final_document, final_binary = load_glb(output_path)
    final_census = census(final_document)
    final_names = final_census["animationNames"]
    final_by_name = {item["name"]: item for item in final_document["animations"]}
    final_fingerprints = {
        name: animation_fingerprint(final_document, final_binary, final_by_name[name])
        for name in EXPECTED_SOURCE_ACTIONS
    }
    source_payloads_corrected = {
        name: source_fingerprints[name] != final_fingerprints[name]
        for name in EXPECTED_SOURCE_ACTIONS
    }

    melee_report = animation_report(final_document, final_binary, final_by_name[MELEE_NAME])
    ranged_report = animation_report(final_document, final_binary, final_by_name[RANGED_NAME])
    for report in (melee_report, ranged_report):
        report["rootTranslationDriftMeters"] = round(
            translation_drift(final_document, final_binary, final_by_name[report["name"]], ROOT_BONE), 9
        )
        report["footTranslationDriftMeters"] = {
            bone: round(translation_drift(final_document, final_binary, final_by_name[report["name"]], bone), 9)
            for bone in FOOT_BONES
        }
        report["frameRange"] = [FRAME_START, FRAME_END]
        report["fps"] = FPS
        report["durationSeconds"] = round((FRAME_END - FRAME_START) / FPS, 9)
        report["looping"] = False

    melee_payload = canonical_digest([
        (item["bone"], item["path"], item["valuePayloadSha256"])
        for item in melee_report["animatedBoneChannels"]
    ])
    ranged_payload = canonical_digest([
        (item["bone"], item["path"], item["valuePayloadSha256"])
        for item in ranged_report["animatedBoneChannels"]
    ])

    source_prefix_equal = final_binary[:source_document["buffers"][0]["byteLength"]] == source_binary[:source_document["buffers"][0]["byteLength"]]
    texture_rows = embedded_texture_report(final_document)
    count_keys = ("meshes", "primitives", "materials", "images", "textures", "skins")
    structure_keys = ("nodes", "meshes", "materials", "images", "textures", "skins")
    source_structure_fingerprints = {
        key: canonical_digest(source_document.get(key, [])) for key in structure_keys
    }
    output_structure_fingerprints = {
        key: canonical_digest(final_document.get(key, [])) for key in structure_keys
    }
    unchanged_structures = {
        key: source_structure_fingerprints[key] == output_structure_fingerprints[key]
        for key in structure_keys
    }
    checks = {
        "outputParsesAsGlb": True,
        "meshMaterialSkinCountsEqualInput": all(source_census[key] == final_census[key] for key in ("meshes", "primitives", "materials", "skins")),
        "textureCountsEqualInput": all(source_census[key] == final_census[key] for key in ("images", "textures")),
        "oneSkin": final_census["skins"] == 1,
        "twentyFourDeformJointRig": final_census["deformJoints"] == EXPECTED_DEFORM_JOINTS,
        "thirteenUniqueAnimations": len(final_names) == 13 and len(set(final_names)) == 13,
        "allOriginalAnimationsPresent": all(name in final_names for name in EXPECTED_SOURCE_ACTIONS),
        "exactNewAnimationNamesPresent": MELEE_NAME in final_names and RANGED_NAME in final_names,
        "originalBlenderActionsUnchanged": all(blender_actions_unchanged.values()),
        "allOriginalGlbActionsGuardCorrected": all(source_payloads_corrected.values()),
        "guardCorrectionCoversAllThirteenActions": set(guard_pose_report["actions"]) == (GUARDED_ACTION_KEYS | STRIKE_ACTION_KEYS),
        "guardCorrectionHasExpectedUpperArmChannels": len(guard_pose_report["channels"]) == 26,
        "guardCorrectionTouchesOnlyDeclaredQuaternionAccessors": guard_pose_report["changedBytesOutsideCorrectedAccessors"] == 0,
        "meshSkinMaterialTextureDataUnchanged": all(unchanged_structures.values()),
        "newClipsHaveBoneDeformationChannels": bool(melee_report["animatedBoneChannels"]) and bool(ranged_report["animatedBoneChannels"]),
        "newClipsHaveDistinctSamplerAccessors": set(map(tuple, melee_report["samplerAccessorPairs"])).isdisjoint(set(map(tuple, ranged_report["samplerAccessorPairs"]))),
        "newClipsSampledAt30Fps": melee_report["sampledAt30Fps"] and ranged_report["sampledAt30Fps"],
        "newClipsHaveDistinctKeyframePayloads": melee_payload != ranged_payload,
        "rootDriftWithin002m": melee_report["rootTranslationDriftMeters"] <= 0.02 and ranged_report["rootTranslationDriftMeters"] <= 0.02,
        "feetGrounded": all(value <= 1e-6 for report in (melee_report, ranged_report) for value in report["footTranslationDriftMeters"].values()),
        "noFootBoneDeformation": all(
            item["bone"] not in FOOT_BONES
            for report in (melee_report, ranged_report)
            for item in report["animatedBoneChannels"]
        ),
        "embeddedAlbedoAndNormalTextures": {row["role"] for row in texture_rows if row["embedded"]} >= {"baseColor", "normal"},
        "onlyAnimationLibraryExpanded": all(source_census[key] == final_census[key] for key in count_keys),
    }
    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        raise RuntimeError(f"combat animation acceptance failed: {failed}")

    command = (
        f"Blender --background --factory-startup "
        f"--python {script_path} -- --input {input_relative} "
        f"--output {output_relative} --audit {audit_relative}"
    )
    audit = {
        "schemaVersion": 2,
        "status": "ok",
        "blenderVersion": bpy.app.version_string,
        "blenderCommand": command,
        "blenderExecutable": "Blender",
        "authorScriptSha256": sha256_bytes(Path(__file__).resolve().read_bytes()),
        "inputPath": input_relative,
        "outputPath": output_relative,
        "auditPath": audit_relative,
        "inputSha256": sha256_bytes(source_raw),
        "outputSha256": sha256_bytes(output_raw),
        "guardPoseCorrection": {
            **guard_pose_report,
            "outputGlbSha256": sha256_bytes(output_raw),
        },
        "before": source_census,
        "after": final_census,
        "authoredStageCensus": census(stage_document),
        "sourceAttackInspection": {
            "name": SOURCE_ATTACK,
            "frameRange": attack_snapshot["frameRange"],
            "poseBoneChannels": source_attack_channels,
        },
        "authoredActions": {
            MELEE_NAME: {
                "frameRange": [FRAME_START, FRAME_END],
                "fps": FPS,
                "looping": False,
                "poseStages": [{"frame": frame, "stage": stage} for frame, stage, _rotations in MELEE_POSES],
                "authoredPoseBones": melee_bones,
                "blenderCurveCount": len(list(iter_fcurves(melee_action))),
                "exported": melee_report,
            },
            RANGED_NAME: {
                "frameRange": [FRAME_START, FRAME_END],
                "fps": FPS,
                "looping": False,
                "poseStages": [{"frame": frame, "stage": stage} for frame, stage, _rotations in RANGED_POSES],
                "authoredPoseBones": ranged_bones,
                "blenderCurveCount": len(list(iter_fcurves(ranged_action))),
                "exported": ranged_report,
            },
        },
        "textures": texture_rows,
        "proof": {
            "originalActionFingerprintsBefore": source_fingerprints,
            "originalActionFingerprintsAfter": final_fingerprints,
            "sourceActionPayloadsCorrected": source_payloads_corrected,
            "originalBlenderActionsUnchanged": blender_actions_unchanged,
            "newClipPayloadSha256": {MELEE_NAME: melee_payload, RANGED_NAME: ranged_payload},
            "distinctSamplerAccessorPairs": {
                MELEE_NAME: melee_report["samplerAccessorPairs"],
                RANGED_NAME: ranged_report["samplerAccessorPairs"],
            },
            "sourceBinaryPrefixBytes": source_document["buffers"][0]["byteLength"],
            "sourceBinaryPrefixChangedByGuardCorrection": not source_prefix_equal,
            "assetStructureFingerprintsBefore": source_structure_fingerprints,
            "assetStructureFingerprintsAfter": output_structure_fingerprints,
            "assetStructuresUnchanged": unchanged_structures,
        },
        "checks": checks,
    }
    audit_path.write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    stage_path.unlink(missing_ok=True)
    print("PLAYER_COMBAT_ANIMATION_AUDIT:" + json.dumps({
        "status": "ok",
        "output": str(output_path),
        "audit": str(audit_path),
        "animations": final_census["animations"],
        "rootDrift": {
            MELEE_NAME: melee_report["rootTranslationDriftMeters"],
            RANGED_NAME: ranged_report["rootTranslationDriftMeters"],
        },
        "checks": checks,
    }, separators=(",", ":")))


if __name__ == "__main__":
    main()
