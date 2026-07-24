#!/usr/bin/env python3
"""
Renders isolated-collection review thumbnails with correct bounding-box camera
framing. Used to visually + programmatically QA newly generated world-content-
pack assets before they're approved for the bake pipeline.

Run headless:
  blender --background <file>.blend --python scripts/render-review-thumbnails.py -- \
    --out-dir /tmp/review --view-transform Standard --collections gate-zenith,bridge-colossus
"""
import sys
import argparse
import math
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []
    p = argparse.ArgumentParser()
    p.add_argument("--out-dir", required=True)
    p.add_argument("--view-transform", default="Standard", choices=["Standard", "AgX", "Filmic"])
    p.add_argument("--collections", required=True, help="comma-separated collection names")
    p.add_argument("--engine", default="BLENDER_EEVEE", choices=["BLENDER_EEVEE", "CYCLES", "BLENDER_WORKBENCH"])
    p.add_argument("--res", type=int, default=480)
    p.add_argument("--samples", type=int, default=32)
    return p.parse_args(argv)


def world_bbox(objects):
    mins = Vector((math.inf, math.inf, math.inf))
    maxs = Vector((-math.inf, -math.inf, -math.inf))
    found = False
    for o in objects:
        if o.type != "MESH":
            continue
        found = True
        for corner in o.bound_box:
            world_co = o.matrix_world @ Vector(corner)
            mins.x, mins.y, mins.z = min(mins.x, world_co.x), min(mins.y, world_co.y), min(mins.z, world_co.z)
            maxs.x, maxs.y, maxs.z = max(maxs.x, world_co.x), max(maxs.y, world_co.y), max(maxs.z, world_co.z)
    if not found:
        return None, None
    return mins, maxs


def frame_camera_on_bbox(cam_obj, mins, maxs, azimuth_deg=35, elevation_deg=25):
    center = (mins + maxs) / 2
    size = maxs - mins
    radius = max(size.length / 2, 0.05)
    dist = radius / math.tan(cam_obj.data.angle / 2) * 1.35

    az = math.radians(azimuth_deg)
    el = math.radians(elevation_deg)
    offset = Vector((
        dist * math.cos(el) * math.sin(az),
        -dist * math.cos(el) * math.cos(az),
        dist * math.sin(el),
    ))
    cam_obj.location = center + offset

    direction = center - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def sample_pixels(filepath, n=5):
    img = bpy.data.images.load(filepath)
    w, h = img.size
    px = img.pixels
    samples = []
    for fx, fy in [(0.5, 0.5), (0.3, 0.3), (0.7, 0.3), (0.3, 0.7), (0.7, 0.7)][:n]:
        x, y = int(w * fx), int(h * fy)
        idx = (y * w + x) * 4
        samples.append(tuple(round(v, 3) for v in px[idx:idx + 4]))
    bpy.data.images.remove(img)
    return samples


def main():
    args = parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    scene.render.engine = args.engine
    scene.render.resolution_x = args.res
    scene.render.resolution_y = args.res
    scene.view_settings.view_transform = args.view_transform
    scene.view_settings.look = "None"
    if args.engine == "CYCLES":
        scene.cycles.samples = args.samples
        scene.cycles.use_denoising = True

    for c in bpy.data.collections:
        c.hide_render = True

    cam_data = bpy.data.cameras.new("ReviewCam")
    cam_data.angle = math.radians(40)
    cam = bpy.data.objects.new("ReviewCam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    key = bpy.data.lights.new("ReviewKey", type="SUN")
    key.energy = 2.2
    key_obj = bpy.data.objects.new("ReviewKey", key)
    key_obj.rotation_euler = (math.radians(55), 0, math.radians(35))
    scene.collection.objects.link(key_obj)

    fill = bpy.data.lights.new("ReviewFill", type="SUN")
    fill.energy = 0.6
    fill_obj = bpy.data.objects.new("ReviewFill", fill)
    fill_obj.rotation_euler = (math.radians(65), 0, math.radians(-140))
    scene.collection.objects.link(fill_obj)

    results = {}
    for coll_name in args.collections.split(","):
        coll_name = coll_name.strip()
        coll = bpy.data.collections.get(coll_name)
        if not coll:
            print(f"MISSING_COLLECTION {coll_name}")
            continue
        coll.hide_render = False
        for o in coll.objects:
            o.hide_render = False

        mins, maxs = world_bbox(coll.objects)
        if mins is None:
            print(f"NO_MESH_OBJECTS {coll_name}")
            coll.hide_render = True
            continue

        frame_camera_on_bbox(cam, mins, maxs)

        out_path = out_dir / f"{coll_name}__{args.view_transform}__{args.engine}.png"
        scene.render.filepath = str(out_path)
        bpy.ops.render.render(write_still=True)
        samples = sample_pixels(str(out_path))
        results[coll_name] = samples
        print(f"RENDERED {coll_name} -> {out_path} | samples={samples}")

        coll.hide_render = True

    print("REVIEW_DONE")


if __name__ == "__main__":
    main()
