#!/usr/bin/env python3
"""Rebuild the Cinder Span runtime terrain as a textured dark-fantasy bridge."""
import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--surface", required=True)
    parser.add_argument("--normal", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--blend-out", required=True)
    parser.add_argument("--render")
    return parser.parse_args(argv)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    root = bpy.data.collections.get("Collection")
    root.name = "cinder-span-runtime"
    return root


def image(path, colorspace):
    loaded = bpy.data.images.load(str(path), check_existing=True)
    loaded.pack()
    loaded.colorspace_settings.name = colorspace
    return loaded


def material(name, color, surface_image, normal_image, metallic=0.0, roughness=0.72, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    surface = nodes.new("ShaderNodeTexImage")
    surface.name = f"{name} Albedo Detail"
    surface.image = surface_image
    surface.interpolation = "Linear"
    tint = nodes.new("ShaderNodeRGB")
    tint.name = f"{name} Tint"
    tint.outputs[0].default_value = (*color, 1.0)
    multiply = nodes.new("ShaderNodeMixRGB")
    multiply.name = f"{name} Cartoon Albedo"
    multiply.blend_type = "MULTIPLY"
    multiply.inputs[0].default_value = 1.0
    links.new(surface.outputs["Color"], multiply.inputs[1])
    links.new(tint.outputs["Color"], multiply.inputs[2])
    links.new(multiply.outputs["Color"], bsdf.inputs["Base Color"])
    normal = nodes.new("ShaderNodeTexImage")
    normal.name = f"{name} Normal"
    normal.image = normal_image
    normal.interpolation = "Linear"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.34
    links.new(normal.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    if emission is not None:
        emission_color, strength = emission
        bsdf.inputs["Emission Color"].default_value = (*emission_color, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    mat["sourceBaseColor"] = list(color)
    mat["texturePolicy"] = "GTI-derived cartoon surface and normal"
    return mat


def finish(obj, name, collection, mat, bevel=0.0):
    obj.name = name
    obj.data.name = f"{name}-mesh"
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    if bevel > 0:
        modifier = obj.modifiers.new("Edge wear", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth_by_angle()
    obj.select_set(False)
    return obj


def cube(name, location, scale, collection, mat, rotation=(0.0, 0.0, 0.0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, collection, mat, bevel)


def cylinder(name, location, radius, depth, collection, mat, vertices=10, rotation=(0.0, 0.0, 0.0), bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    return finish(bpy.context.object, name, collection, mat, bevel)


def arch(name, x, y, collection, stone, ember):
    cube(f"{name}-left", (x - 0.55, y, 0.72), (0.28, 0.34, 0.72), collection, stone, bevel=0.06)
    cube(f"{name}-right", (x + 0.55, y, 0.72), (0.28, 0.34, 0.72), collection, stone, bevel=0.06)
    cube(f"{name}-lintel", (x, y, 1.42), (0.92, 0.34, 0.22), collection, stone, bevel=0.06)
    cube(f"{name}-ember", (x, y - 0.31, 1.42), (0.52, 0.035, 0.055), collection, ember, bevel=0.02)


def build(args):
    collection = clear_scene()
    surface = image(Path(args.surface).resolve(), "sRGB")
    normal = image(Path(args.normal).resolve(), "Non-Color")
    stone = material("Cinder Basalt", (0.075, 0.055, 0.065), surface, normal, metallic=0.1, roughness=0.82)
    edge = material("Cinder Iron", (0.12, 0.105, 0.13), surface, normal, metallic=0.55, roughness=0.44)
    ash = material("Cinder Ash", (0.18, 0.13, 0.15), surface, normal, roughness=0.92)
    ember = material("Cinder Ember", (0.92, 0.12, 0.025), surface, normal, metallic=0.08, roughness=0.3, emission=((1.0, 0.055, 0.005), 4.0))

    # Three authored walkable beats: spawn court, narrow span, fortified extraction court.
    cube("spawn-court", (-4.05, 0.0, 0.0), (2.05, 3.25, 0.22), collection, stone, bevel=0.09)
    cube("bridge-deck", (0.0, 0.0, 0.03), (2.05, 1.48, 0.18), collection, stone, bevel=0.07)
    cube("extraction-court", (4.05, 0.0, 0.12), (2.05, 3.25, 0.28), collection, stone, bevel=0.1)

    # Deep cliff mass and stepped elevation make the silhouette read from the runtime camera.
    for index, (x, y, sx, sy, h) in enumerate([
        (-4.3, -2.9, 2.3, 0.55, 1.15), (-4.4, 2.9, 2.4, 0.6, 0.95),
        (4.25, -2.95, 2.3, 0.55, 1.55), (4.3, 2.9, 2.25, 0.6, 1.35),
    ]):
        cube(f"cliff-buttress-{index+1}", (x, y, -h * 0.55), (sx, sy, h), collection, ash, rotation=(0.0, 0.0, (index - 1.5) * 0.035), bevel=0.12)

    # Broken parapets preserve actor sightlines while clearly describing dangerous edges.
    for side in (-1, 1):
        for index, x in enumerate((-5.55, -4.55, -3.45, -2.35, 2.35, 3.45, 4.55, 5.55)):
            if (index + (1 if side > 0 else 0)) % 4 == 1:
                continue
            height = 0.32 + 0.08 * ((index * 3) % 3)
            cube(f"parapet-{side:+d}-{index}", (x, side * (3.06 if abs(x) > 2.1 else 1.34), 0.34), (0.38, 0.16, height), collection, stone, rotation=(0.0, 0.0, side * 0.018 * (index % 2)), bevel=0.035)
            cylinder(f"parapet-cap-{side:+d}-{index}", (x, side * (3.06 if abs(x) > 2.1 else 1.34), 0.77), 0.19, 0.16, collection, edge, vertices=8, bevel=0.02)

    # Segment the bridge surface and add raised seams rather than one broad rectangle.
    for index, x in enumerate((-5.2, -4.0, -2.8, -1.35, 0.0, 1.35, 2.8, 4.0, 5.2)):
        width = 1.55 if abs(x) > 2 else 0.98
        cube(f"deck-slab-{index+1}", (x, 0.0, 0.27 if abs(x) > 2 else 0.23), (0.5, width, 0.055), collection, ash, rotation=(0.0, 0.0, math.radians((index % 3 - 1) * 1.4)), bevel=0.018)

    # Emissive fissures trace a directed route but stay below actor feet.
    fissures = [
        (-5.15, -0.7, 0.55, 0.025, -12), (-4.2, -0.35, 0.45, 0.023, 18),
        (-3.35, 0.05, 0.4, 0.022, -16), (-2.5, 0.35, 0.35, 0.02, 14),
        (-1.45, 0.08, 0.38, 0.022, -18), (-0.5, -0.22, 0.33, 0.021, 20),
        (0.4, -0.08, 0.36, 0.022, -15), (1.35, 0.22, 0.38, 0.023, 17),
        (2.35, 0.48, 0.42, 0.024, -16), (3.35, 0.25, 0.48, 0.026, 18),
        (4.4, 0.5, 0.52, 0.028, -14), (5.3, 0.75, 0.46, 0.026, 17),
    ]
    for index, (x, y, length, width, angle) in enumerate(fissures):
        cube(f"ember-fissure-{index+1}", (x, y, 0.337), (length, width, 0.012), collection, ember, rotation=(0.0, 0.0, math.radians(angle)), bevel=0.008)

    arch("drowned-forge-arch", 0.15, -0.92, collection, stone, ember)
    # Extraction court altar / relay silhouette.
    cylinder("relay-dais", (4.75, 0.0, 0.55), 0.82, 0.34, collection, stone, vertices=12, bevel=0.05)
    cylinder("relay-core", (4.75, 0.0, 1.08), 0.24, 0.86, collection, edge, vertices=8, bevel=0.04)
    for index, angle in enumerate((0.0, math.pi * 0.5, math.pi, math.pi * 1.5)):
        x = 4.75 + math.cos(angle) * 0.42
        y = math.sin(angle) * 0.42
        cube(f"relay-brand-{index+1}", (x, y, 1.28), (0.055, 0.055, 0.31), collection, ember, rotation=(0.0, 0.0, -angle), bevel=0.015)

    # Vertical ruins and banner-like teeth frame the courts without blocking play.
    for index, (x, y, height) in enumerate([
        (-5.55, -2.55, 1.8), (-5.4, 2.45, 1.35), (-3.2, -2.65, 1.2),
        (3.0, 2.55, 1.45), (5.35, -2.45, 2.05), (5.6, 2.35, 1.75),
    ]):
        cylinder(f"ruined-pillar-{index+1}", (x, y, height * 0.5 + 0.25), 0.22, height, collection, stone, vertices=8, bevel=0.04)
        cube(f"pillar-band-{index+1}", (x, y, 0.8), (0.29, 0.29, 0.07), collection, edge, rotation=(0.0, 0.0, math.radians(22.5)), bevel=0.02)

    root = bpy.data.objects.new("cinder-span-runtime-root", None)
    collection.objects.link(root)
    root["stageId"] = "cinder-span"
    root["artDirection"] = "segmented basalt bridge, forge arch, ember fissures, chasm silhouette"
    for obj in list(collection.objects):
        if obj != root and obj.parent is None:
            obj.parent = root

    if args.render:
        camera_data = bpy.data.cameras.new("Cinder Review Camera")
        camera = bpy.data.objects.new("Cinder Review Camera", camera_data)
        bpy.context.scene.collection.objects.link(camera)
        camera.location = (11.5, -13.5, 11.0)
        camera.rotation_euler = ((Vector((0.0, 0.0, 0.2)) - camera.location).to_track_quat("-Z", "Y")).to_euler()
        camera.data.lens = 52
        bpy.context.scene.camera = camera
        for name, location, energy, color, size in (
            ("Cinder Key", (-5.0, -4.0, 11.0), 1700.0, (1.0, 0.24, 0.08), 7.0),
            ("Cinder Rim", (6.0, 5.0, 8.0), 1250.0, (0.2, 0.34, 1.0), 5.0),
        ):
            light_data = bpy.data.lights.new(name, "AREA")
            light_data.energy = energy
            light_data.color = color
            light_data.shape = "DISK"
            light_data.size = size
            light = bpy.data.objects.new(name, light_data)
            bpy.context.scene.collection.objects.link(light)
            light.location = location
            light.rotation_euler = ((Vector((0.0, 0.0, 0.0)) - light.location).to_track_quat("-Z", "Y")).to_euler()
        scene = bpy.context.scene
        scene.render.resolution_x = 1440
        scene.render.resolution_y = 900
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.filepath = str(Path(args.render).resolve())
        scene.render.film_transparent = False
        Path(args.render).resolve().parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.render.render(write_still=True)
    bpy.context.scene.render.engine = "BLENDER_EEVEE"
    bpy.context.scene.world.color = (0.008, 0.004, 0.008)
    blend_out = Path(args.blend_out).resolve()
    blend_out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_out))

    bpy.ops.object.select_all(action="DESELECT")
    export_objects = list(collection.all_objects)
    for obj in export_objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
    print({"collectionObjects": len(export_objects), "selectedObjects": len(bpy.context.selected_objects)})
    out = Path(args.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(out), export_format="GLB", use_selection=True, export_apply=True,
        export_yup=True, export_materials="EXPORT", export_animations=False,
        export_cameras=False, export_lights=False,
    )
    meshes = [obj for obj in collection.all_objects if obj.type == "MESH"]
    dimensions = []
    for obj in meshes:
        dimensions.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    mins = [min(point[axis] for point in dimensions) for axis in range(3)]
    maxs = [max(point[axis] for point in dimensions) for axis in range(3)]
    print({"out": str(out), "bytes": out.stat().st_size, "meshes": len(meshes), "materials": len(bpy.data.materials), "bounds": {"min": mins, "max": maxs}})


if __name__ == "__main__":
    build(parse_args())
