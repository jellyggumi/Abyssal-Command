#!/usr/bin/env python3
"""Render animation-clip frames from a rigged GLB, for pose/deformation review.

The pose-contact-sheet script renders the BIND pose only; this one evaluates a
named clip at several points along its timeline, which is what actually ships.
A rig can measure a perfect T-pose bind and still deform horribly once a clip
plays, so this is the check that matters before batch-converting assets.

  blender -b -P scripts/render-clip-frames.py -- \
    --glb /tmp/rigout/guard.glb --clip idle --frames 1,30,60 --out /tmp/clips
"""
import sys
import json
import math
from pathlib import Path


def script_args(argv=None):
    argv = list(sys.argv if argv is None else argv)
    return argv[argv.index("--") + 1:] if "--" in argv else []


def parse(argv):
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--glb", required=True)
    p.add_argument("--clip", default="idle")
    p.add_argument("--frames", default="1,24,48")
    p.add_argument("--out", required=True)
    p.add_argument("--res", type=int, default=360)
    return p.parse_args(argv)


def main():
    import bpy
    import mathutils

    args = parse(script_args())
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    frames = [int(f) for f in args.frames.split(",") if f.strip()]

    bpy.ops.wm.read_factory_settings(use_empty=True)
    # `guess_original_bind_pose=False` — see
    # `scripts/measure-joint-articulation.py:113-122`. Left at its default this
    # renders a rest-corrected rig re-posed back to its pre-correction pose,
    # which is exactly how a healthy rig comes out looking broken.
    bpy.ops.import_scene.gltf(
        filepath=args.glb,
        guess_original_bind_pose=False,
        bone_heuristic="BLENDER",
    )

    rig = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    stem = Path(args.glb).stem
    result = {"glb": stem, "clip": args.clip, "renders": []}

    # glTF import lands every clip in bpy.data.actions; pick the one whose name
    # carries the requested action key ("<assetId>::<action>::v01").
    action = None
    for a in bpy.data.actions:
        parts = a.name.split("::")
        key = parts[1] if len(parts) >= 2 else parts[0]
        if key == args.clip:
            action = a
            break
    if rig is not None and action is not None:
        if rig.animation_data is None:
            rig.animation_data_create()
        # A GLB round-trip leaves the clips parked in NLA tracks; muting them
        # stops the strips from overriding the action assigned here.
        for tr in rig.animation_data.nla_tracks:
            tr.mute = True
        rig.animation_data.action = action
        result["actionRange"] = [round(v) for v in action.frame_range]

    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lo = [float("inf")] * 3
    hi = [float("-inf")] * 3
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(c)
            for i in range(3):
                lo[i] = min(lo[i], w[i])
                hi[i] = max(hi[i], w[i])
    center = [(lo[i] + hi[i]) / 2 for i in range(3)]
    size = max(hi[i] - lo[i] for i in range(3)) or 1.0

    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = size * 1.35
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = (center[0], center[1] - size * 3, center[2])
    cam.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.scene.camera = cam

    for name, loc, e in (("key", (size, -size, size), 3.0), ("fill", (-size, -size, 0), 1.5)):
        ld = bpy.data.lights.new(name, type="SUN")
        ld.energy = e
        ob = bpy.data.objects.new(name, ld)
        ob.location = loc
        ob.rotation_euler = (math.radians(50), 0, math.radians(30))
        bpy.context.scene.collection.objects.link(ob)

    scn = bpy.context.scene
    scn.render.engine = "BLENDER_WORKBENCH"
    scn.render.resolution_x = scn.render.resolution_y = args.res
    scn.render.image_settings.file_format = "PNG"
    try:
        scn.display.shading.light = "STUDIO"
        scn.display.shading.color_type = "SINGLE"
        scn.display.shading.single_color = (0.72, 0.74, 0.80)
        scn.display.shading.show_cavity = True
        scn.world = bpy.data.worlds.new("w")
        scn.world.color = (0.05, 0.05, 0.07)
    except Exception:
        pass

    for f in frames:
        scn.frame_set(f)
        bpy.context.view_layer.update()
        png = out / f"{stem}-{args.clip}-f{f:03d}.png"
        scn.render.filepath = str(png)
        bpy.ops.render.render(write_still=True)
        result["renders"].append(str(png))

    print("CLIP_RENDER_JSON:" + json.dumps(result))


if __name__ == "__main__":
    main()
