"""READ-ONLY Blender probe: confirm the DEF-spine rest orientation independently of the
glTF node math in audit-kinematic-bounds.mjs.  Imports only; writes nothing."""
import json
import math
import sys

import bpy
from mathutils import Quaternion

REPO = "/private/tmp/abyssal-motion-repair"
TR = f"{REPO}/_workspace/current/engineering/asset-pipeline/motion-bench/target-rig"
SUBJECTS = [
    ("CANONICAL human-command-boss", f"{TR}/human-command-boss-def-humanoid-v1.glb"),
    ("CANONICAL dusk-warden", f"{TR}/dusk-warden-def-humanoid-v1.glb"),
    ("ACTOR shadow-commander-boss", f"{REPO}/assets/motion/ingame/characters/shadow-commander-boss/model.glb"),
    ("ACTOR shadow-soldier-v04", f"{REPO}/assets/motion/ingame/characters/shadow-soldier-v04/model.glb"),
    ("ACTOR guard", f"{REPO}/assets/motion/ingame/characters/guard/model.glb"),
]
BONES = ["DEF-spine", "DEF-spine.001", "DEF-foot.L", "DEF-toe.L"]


def angular_distance_degrees(left, right):
    """Frozen contract: d(q1,q2) = 2*acos(clamp(abs(dot(q1,q2)), 0, 1))."""
    a, b = left.normalized(), right.normalized()
    dot = min(1.0, max(0.0, abs(float(a.dot(b)))))
    return math.degrees(2.0 * math.acos(dot))


def wipe():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load(path):
    wipe()
    bpy.ops.import_scene.gltf(filepath=path)
    arms = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    if len(arms) != 1:
        raise RuntimeError(f"expected exactly one armature in {path}, got {len(arms)}")
    return arms[0]


results = {}
for label, path in SUBJECTS:
    arm = load(path)
    obj_q = arm.matrix_world.to_quaternion()
    entry = {"armatureObjectQuat": [round(v, 6) for v in (obj_q.x, obj_q.y, obj_q.z, obj_q.w)], "bones": {}}
    for bone_name in BONES:
        bone = arm.data.bones.get(bone_name)
        if bone is None:
            entry["bones"][bone_name] = None
            continue
        # matrix_local = bone rest matrix in ARMATURE space (parent chain already inherited)
        rest_armature = bone.matrix_local.to_quaternion()
        rest_world = (arm.matrix_world @ bone.matrix_local).to_quaternion()
        parent = bone.parent
        rest_parent_relative = (
            (parent.matrix_local.inverted() @ bone.matrix_local).to_quaternion()
            if parent is not None
            else rest_armature
        )
        entry["bones"][bone_name] = {
            "parent": parent.name if parent else None,
            "restArmatureQuat": [round(v, 6) for v in (rest_armature.x, rest_armature.y, rest_armature.z, rest_armature.w)],
            "restWorldQuat": [round(v, 6) for v in (rest_world.x, rest_world.y, rest_world.z, rest_world.w)],
            "restParentRelativeQuat": [round(v, 6) for v in (rest_parent_relative.x, rest_parent_relative.y, rest_parent_relative.z, rest_parent_relative.w)],
        }
    results[label] = entry

print("\n@@@BLENDER_PROBE_BEGIN@@@")
for label, entry in results.items():
    print(f"\n### {label}")
    print(f"    armature object quat (xyzw): {entry['armatureObjectQuat']}")
    for bone_name, data in entry["bones"].items():
        if data is None:
            print(f"    {bone_name:<14} MISSING")
            continue
        print(f"    {bone_name:<14} parent={str(data['parent']):<14} restArmature={data['restArmatureQuat']}")
        print(f"    {'':<14} restParentRel={data['restParentRelativeQuat']}")

print("\n### RESIDUALS measured inside Blender (frozen abs() contract), ARMATURE space")
print(f"{'actor':<28}{'vs canonical':<22}{'bone':<15}{'armatureDeg':>13}{'parentRelDeg':>14}")
for canon_label in ("CANONICAL human-command-boss", "CANONICAL dusk-warden"):
    canon = results[canon_label]
    for actor_label in ("ACTOR shadow-commander-boss", "ACTOR shadow-soldier-v04", "ACTOR guard"):
        actor = results[actor_label]
        for bone_name in BONES:
            cb, ab = canon["bones"].get(bone_name), actor["bones"].get(bone_name)
            if not cb or not ab:
                continue
            def q(vals):
                return Quaternion((vals[3], vals[0], vals[1], vals[2]))
            arm_deg = angular_distance_degrees(q(ab["restArmatureQuat"]), q(cb["restArmatureQuat"]))
            rel_deg = angular_distance_degrees(q(ab["restParentRelativeQuat"]), q(cb["restParentRelativeQuat"]))
            print(f"{actor_label.replace('ACTOR ',''):<28}{canon_label.replace('CANONICAL ',''):<22}{bone_name:<15}{arm_deg:>13.5f}{rel_deg:>14.5f}")
print("@@@BLENDER_PROBE_END@@@")
