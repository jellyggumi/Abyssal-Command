#!/usr/bin/env python3
"""
Renders each battle GLB from 8 yaw angles (default 65deg pitch, matching the
D17/presentation-spec default camera pitch) plus 2 extra pitch-extreme shots
(30deg and 85deg, front-on) into one contact-sheet PNG per asset, for visual
arbitrary-angle-viewing-readiness audit ahead of the free-orbit camera
implementation (synthesis doc section 2.2).

Flags per-asset heuristic warnings (via backface-facing-ratio sampling) so the
director can prioritize which assets need closer visual inspection, but the
PNG contact sheets are the actual evidence -- the heuristic is a triage aid,
not a substitute for looking at the renders.

Run headless (no base .blend needed -- starts from Blender's empty default
scene and imports one GLB at a time):
  blender --background --python scripts/audit-glb-angle-readiness.py -- \
    --glbs assets/images/battle/glb/bosses/cinder-warden.glb,... \
    --out-dir /tmp/glb-angle-audit --res 320
"""
import sys
import argparse
import json
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
    p.add_argument("--glbs", required=True, help="comma-separated GLB paths")
    p.add_argument("--out-dir", required=True)
    p.add_argument("--res", type=int, default=320)
    p.add_argument("--samples", type=int, default=16)
    return p.parse_args(argv)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = True
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(55), 0, math.radians(35))
    scene.collection.objects.link(sun)
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.12, 0.12, 0.14, 1.0)
    scene.world = world
    return scene


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


def position_camera(cam_obj, center, radius, yaw_deg, pitch_deg):
    # yaw measured from +Y (front), pitch from ground plane -- matches the
    # presentation-spec.md camera model (pitch clamped [30,85] from ground).
    dist = radius / math.tan(cam_obj.data.angle / 2) * 1.4
    yaw = math.radians(yaw_deg)
    pitch = math.radians(pitch_deg)
    offset = Vector((
        dist * math.cos(pitch) * math.sin(yaw),
        -dist * math.cos(pitch) * math.cos(yaw),
        dist * math.sin(pitch),
    ))
    cam_obj.location = center + offset
    direction = center - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def silhouette_coverage_ratio(png_path):
    """Loads the rendered RGBA PNG and computes (opaque-pixel count) /
    (2D bounding-box area of the opaque silhouette). Detects actual missing
    geometry (holes/gaps from a given angle) far more directly than a
    per-polygon normal-facing check -- and avoids a catastrophically slow
    per-polygon Python loop on the several 500k-face unretopologized
    companion/enemy GLBs (see D19 finding 6 in decision-log.md)."""
    img = bpy.data.images.load(str(png_path))
    try:
        w, h = img.size
        pixels = img.pixels[:]  # flat RGBA floats, bottom-to-top rows
        min_x, max_x, min_y, max_y = w, -1, h, -1
        opaque = 0
        for y in range(h):
            row_base = y * w * 4
            for x in range(w):
                alpha = pixels[row_base + x * 4 + 3]
                if alpha > 0.05:
                    opaque += 1
                    if x < min_x: min_x = x
                    if x > max_x: max_x = x
                    if y < min_y: min_y = y
                    if y > max_y: max_y = y
        if opaque == 0 or max_x < min_x:
            return 0.0, 0
        bbox_area = (max_x - min_x + 1) * (max_y - min_y + 1)
        return (opaque / bbox_area) if bbox_area else 0.0, opaque
    finally:
        bpy.data.images.remove(img)

def main():
    args = parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    glb_paths = [Path(p.strip()) for p in args.glbs.split(",") if p.strip()]

    results = []
    for glb_path in glb_paths:
        name = glb_path.stem
        scene = clear_scene()
        cam_data = bpy.data.cameras.new("Cam")
        cam_data.lens_unit = "FOV"
        cam_data.angle = math.radians(35)
        cam_obj = bpy.data.objects.new("Cam", cam_data)
        scene.collection.objects.link(cam_obj)
        scene.camera = cam_obj
        scene.render.resolution_x = args.res
        scene.render.resolution_y = args.res
        scene.eevee.taa_render_samples = args.samples

        existing = set(o.name for o in bpy.data.objects)
        try:
            # `guess_original_bind_pose=False` — see
            # `scripts/measure-joint-articulation.py:113-122`. Left at its
            # default Blender rebuilds armature rest from the inverse bind
            # matrices, so a rest-corrected rig renders re-posed.
            bpy.ops.import_scene.gltf(
                filepath=str(glb_path),
                guess_original_bind_pose=False,
                bone_heuristic="BLENDER",
            )
        except Exception as exc:
            results.append({"asset": name, "error": f"import failed: {exc}"})
            continue
        imported_meshes = [o for o in bpy.data.objects if o.name not in existing and o.type == "MESH"]
        if not imported_meshes:
            results.append({"asset": name, "error": "no mesh objects imported"})
            continue

        mins, maxs = world_bbox(imported_meshes)
        center = (mins + maxs) / 2
        radius = max((maxs - mins).length / 2, 0.05)

        angles = [(yaw, 65) for yaw in range(0, 360, 45)]  # 8 yaw steps at default pitch
        angles += [(0, 30), (0, 85)]  # pitch extremes, front-on
        frame_paths = []
        coverage_by_angle = {}
        for yaw, pitch in angles:
            position_camera(cam_obj, center, radius, yaw, pitch)
            tag = f"yaw{yaw:03d}_pitch{pitch:02d}"
            out_path = out_dir / f"{name}__{tag}.png"
            scene.render.filepath = str(out_path)
            bpy.ops.render.render(write_still=True)
            frame_paths.append(str(out_path))
            ratio, opaque_px = silhouette_coverage_ratio(out_path)
            coverage_by_angle[tag] = round(ratio, 4)

        coverage_values = list(coverage_by_angle.values())
        front_coverage = coverage_by_angle.get("yaw000_pitch65", 0.0)
        min_coverage = min(coverage_values) if coverage_values else 0.0
        # A single angle's coverage dropping far below the front-on baseline
        # (rather than uniformly, which would just be a thin silhouette)
        # signals a likely gap/hole specific to that viewing direction.
        coverage_drop_flag = front_coverage > 0 and (min_coverage / front_coverage) < 0.55

        results.append({
            "asset": name,
            "glb": str(glb_path),
            "bbox_size": [round(x, 3) for x in (maxs - mins)],
            "frames": frame_paths,
            "silhouette_coverage_by_angle": coverage_by_angle,
            "front_coverage": round(front_coverage, 4),
            "min_coverage": round(min_coverage, 4),
            "flag_needs_review": coverage_drop_flag,
        })
        print(f"DONE {name}: front={front_coverage:.3f} min={min_coverage:.3f} flag={coverage_drop_flag}")

    report_path = out_dir / "audit-report.json"
    report_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"AUDIT_DONE {report_path}")


if __name__ == "__main__":
    main()
