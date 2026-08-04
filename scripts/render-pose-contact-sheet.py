#!/usr/bin/env python3
"""Render front-ortho verification frames for character GLBs.

Run headless:
  blender -b -P scripts/render-pose-contact-sheet.py -- --out /tmp/pose-audit [--glb A.glb B.glb]

For each GLB: imports it, frames the mesh bounds with an orthographic front camera,
renders a flat-lit PNG. Used to eyeball bind-pose (T vs A) and mesh/rig alignment.
"""
import sys
import os
import math
import glob
from pathlib import Path


def script_args(argv=None):
    argv = list(sys.argv if argv is None else argv)
    return argv[argv.index("--") + 1:] if "--" in argv else []


def parse(argv):
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--glb", nargs="*", default=None)
    p.add_argument("--res", type=int, default=384)
    p.add_argument("--axis", default="front", choices=["front", "side"])
    return p.parse_args(argv)


def render_one(bpy, mathutils, glb_path, out_png, res, axis):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # `guess_original_bind_pose=False` — see
    # `scripts/measure-joint-articulation.py:113-122`. This renders the pose, so
    # a rest re-derived from the inverse bind matrices shows a rig the runtime
    # never loads.
    bpy.ops.import_scene.gltf(
        filepath=str(glb_path),
        guess_original_bind_pose=False,
        bone_heuristic="BLENDER",
    )

    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if not meshes:
        return {"glb": str(glb_path), "error": "no mesh"}

    # world-space bounds over every imported mesh
    lo = [float("inf")] * 3
    hi = [float("-inf")] * 3
    for o in meshes:
        for corner in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(corner)
            for i in range(3):
                lo[i] = min(lo[i], w[i])
                hi[i] = max(hi[i], w[i])
    center = [(lo[i] + hi[i]) / 2 for i in range(3)]
    size = max(hi[i] - lo[i] for i in range(3)) or 1.0

    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = size * 1.25
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    dist = size * 3
    if axis == "front":
        cam.location = (center[0], center[1] - dist, center[2])
    else:
        cam.location = (center[0] + dist, center[1], center[2])
    cam.rotation_euler = (math.radians(90), 0, 0 if axis == "front" else math.radians(90))
    bpy.context.scene.camera = cam

    # flat 3-point-ish lighting so silhouette reads clearly
    for name, loc, energy in (
        ("key", (dist, -dist, dist), 3.0),
        ("fill", (-dist, -dist, 0), 1.5),
        ("rim", (0, dist, dist), 2.0),
    ):
        ld = bpy.data.lights.new(name, type="SUN")
        ld.energy = energy
        lo_ = bpy.data.objects.new(name, ld)
        lo_.location = loc
        lo_.rotation_euler = (math.radians(50), 0, math.radians(30))
        bpy.context.scene.collection.objects.link(lo_)

    scn = bpy.context.scene
    scn.render.engine = "BLENDER_WORKBENCH"
    scn.render.resolution_x = res
    scn.render.resolution_y = res
    scn.render.film_transparent = False
    scn.render.image_settings.file_format = "PNG"
    scn.render.filepath = str(out_png)
    try:
        scn.display.shading.light = "STUDIO"
        scn.display.shading.color_type = "SINGLE"
        scn.display.shading.single_color = (0.72, 0.74, 0.80)
        scn.display.shading.show_cavity = True
        scn.world = bpy.data.worlds.new("w")
        scn.world.color = (0.05, 0.05, 0.07)
    except Exception:
        pass
    bpy.ops.render.render(write_still=True)

    arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    return {
        "glb": os.path.basename(str(glb_path)),
        "png": str(out_png),
        "meshes": len(meshes),
        "bones": len(arm.data.bones) if arm else 0,
        "height": round(hi[2] - lo[2], 4),
    }


def main():
    import bpy
    import mathutils
    import json

    args = parse(script_args())
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    targets = args.glb or sorted(glob.glob("assets/images/battle/glb/**/*.glb", recursive=True))
    results = []
    for g in targets:
        stem = Path(g).stem
        png = out / f"{stem}.png"
        try:
            results.append(render_one(bpy, mathutils, g, png, args.res, args.axis))
        except Exception as exc:  # keep batch going; report per-asset
            results.append({"glb": os.path.basename(g), "error": str(exc)})
        print(f"[render] {stem} -> {png}")

    (out / "index.json").write_text(json.dumps(results, indent=2))
    print("RENDER_RESULT_JSON:" + json.dumps({"count": len(results), "out": str(out)}))


if __name__ == "__main__":
    main()
