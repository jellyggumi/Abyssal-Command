#!/usr/bin/env python3
"""Render exact final Abyss Chancel and Gate Zenith GLBs from top and oblique views."""

import math
from pathlib import Path

import bpy
from mathutils import Vector

REPO = next(parent for parent in Path(__file__).resolve().parents if (parent / "package.json").is_file())
TERRAIN = REPO / "assets/images/battle/glb/terrain"
QA = REPO / "_workspace/20260726-stage1b-cinder-pressure-agency/qa/stage-overhaul"
QA.mkdir(parents=True, exist_ok=True)


def bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects if obj.type == "MESH" for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return minimum, maximum


def aim(camera, target):
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def render_stage(stage_id):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.studio_light = "paint.sl"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = "BOTH"
    scene.display.shading.curvature_ridge_factor = 1.45
    scene.display.shading.curvature_valley_factor = 1.15
    scene.display.shading.background_type = "VIEWPORT"
    scene.display.shading.background_color = (0.008, 0.010, 0.020)
    bpy.ops.import_scene.gltf(filepath=str(TERRAIN / f"{stage_id}.glb"))
    meshes = [obj for obj in scene.objects if obj.type == "MESH"]
    minimum, maximum = bounds(meshes)
    center = (minimum + maximum) * 0.5
    size = maximum - minimum
    extent = max(size.x, size.y, size.z)
    camera_data = bpy.data.cameras.new(f"{stage_id} Review Camera")
    camera_data.lens = 52
    camera = bpy.data.objects.new(camera_data.name, camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    views = {
        "oblique": center + Vector((extent * 1.35, -extent * 1.65, extent * 1.22)),
        "top": center + Vector((0.0, 0.0, extent * 2.25)),
    }
    for view, location in views.items():
        camera.location = location
        aim(camera, center + (Vector((0, 0, size.z * 0.10)) if view == "oblique" else Vector((0, 0, 0))))
        output = QA / f"abyss-chancel-gate-zenith.canonical-{stage_id}-{view}.png"
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        if not output.is_file() or output.stat().st_size < 10000:
            raise RuntimeError(f"Preview render failed: {output}")
        print(f"{stage_id} {view}: {output} ({output.stat().st_size} bytes)")


for stage in ("abyss-chancel", "gate-zenith"):
    render_stage(stage)
