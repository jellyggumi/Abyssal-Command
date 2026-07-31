#!/usr/bin/env python3
"""Measure how much of a bench clip's motion survives a rotation-only export.

The ingame retarget deletes every non-rotation channel, so a clip whose meaning lives
in root translation (a fall, a leap) reads as sliding or floating once pinned, while a
clip whose meaning lives in joint rotation (a slump, a swing) survives intact.

For each requested FBX this reports, over the clip's frame range:
  rot_<bone>  max angle (deg) between a bone's rest orientation and its posed
              orientation -- the part the export KEEPS
  root_trans  hips translation range (cm) -- the part the export DISCARDS

A high rot / low root_trans ratio means the clip is safe to pin.

Run under Blender:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P <this> -- --files "A.fbx" "B.fbx"
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import mathutils

REPO_ROOT = Path(__file__).resolve().parents[5]
BENCH_DIR = REPO_ROOT / "assets/motion/bench"

PROBE_BONES = (
    "mixamorig:Hips",
    "mixamorig:Spine1",
    "mixamorig:Spine2",
    "mixamorig:Head",
    "mixamorig:LeftUpLeg",
    "mixamorig:LeftLeg",
    "mixamorig:RightUpLeg",
    "mixamorig:RightLeg",
    "mixamorig:LeftArm",
    "mixamorig:RightArm",
)


def script_args() -> list[str]:
    values = list(sys.argv)
    return values[values.index("--") + 1 :] if "--" in values else values[1:]


def frame_bounds(armature) -> tuple[int, int]:
    lo, hi = None, None
    animation = armature.animation_data
    action = animation.action if animation else None
    if action is not None:
        start, end = action.frame_range
        lo, hi = int(round(start)), int(round(end))
    if lo is None:
        scene = bpy.context.scene
        lo, hi = int(scene.frame_start), int(scene.frame_end)
    return lo, hi


def probe(name: str) -> dict:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 24
    bpy.ops.import_scene.fbx(filepath=str(BENCH_DIR / name), global_scale=1.0)

    armature = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    if armature is None:
        return {"file": name, "error": "no armature"}

    start, end = frame_bounds(armature)
    peak = {bone: 0.0 for bone in PROBE_BONES}
    hips = armature.pose.bones.get("mixamorig:Hips")
    lo = mathutils.Vector((1e9, 1e9, 1e9))
    hi = mathutils.Vector((-1e9, -1e9, -1e9))

    for frame in range(start, end + 1):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        for bone_name in PROBE_BONES:
            pose_bone = armature.pose.bones.get(bone_name)
            if pose_bone is None:
                continue
            rest = pose_bone.bone.matrix_local.to_3x3()
            posed = pose_bone.matrix.to_3x3()
            delta = (rest.inverted() @ posed).to_quaternion().normalized()
            angle = math.degrees(2.0 * math.acos(min(1.0, abs(delta.w))))
            if angle > peak[bone_name]:
                peak[bone_name] = angle
        if hips is not None:
            translation = hips.matrix_basis.translation
            for axis in range(3):
                lo[axis] = min(lo[axis], translation[axis])
                hi[axis] = max(hi[axis], translation[axis])

    root_translation = max(hi[axis] - lo[axis] for axis in range(3)) if hips else 0.0
    rotations = {k: round(v, 1) for k, v in peak.items()}
    return {
        "file": name,
        "frames": end - start + 1,
        "rotation_peak_deg": rotations,
        "rotation_max_deg": round(max(rotations.values()), 1),
        "root_translation_cm": round(root_translation, 1),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--files", nargs="+", required=True)
    parser.add_argument("--out", default="")
    args = parser.parse_args(script_args())

    results = [probe(name) for name in args.files]
    print("PROBE_RESULT_JSON:" + json.dumps(results))
    if args.out:
        Path(args.out).write_text(json.dumps(results, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
