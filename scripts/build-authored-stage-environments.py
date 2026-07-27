#!/usr/bin/env python3
"""Build ten concept-matched, textured runtime stage environments in Blender 5.1."""

import argparse
import hashlib
import json
import math
import sys
import os
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
STAGES = (
    ("cinder-span", "cinder-span.glb", "concept-terrain-cinder-span.png"),
    ("veil-citadel", "veil-citadel.glb", "concept-terrain-veil-citadel.png"),
    ("echo-throne", "echo-throne-steps.glb", "concept-terrain-echo-throne.png"),
    ("sunken-bastion", "sunken-bastion.glb", "concept-terrain-sunken-bastion.png"),
    ("howling-sprawl", "howling-sprawl.glb", "concept-terrain-howling-sprawl.png"),
    ("glass-necropolis", "glass-necropolis.glb", "concept-terrain-glass-necropolis.png"),
    ("starless-canal", "starless-canal.glb", "concept-terrain-starless-canal.png"),
    ("shattered-causeway", "shattered-causeway.glb", "concept-terrain-shattered-causeway.png"),
    ("abyss-chancel", "abyss-chancel.glb", "concept-terrain-abyss-chancel.png"),
    ("gate-zenith", "gate-zenith.glb", "concept-terrain-gate-zenith.png"),
)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--surface", required=True)
    parser.add_argument("--normal", required=True)
    parser.add_argument("--out-dir", default=str(ROOT / "assets/images/battle/glb/terrain"))
    parser.add_argument("--blend-dir", required=True)
    parser.add_argument("--render-dir", required=True)
    parser.add_argument("--only", choices=[stage[0] for stage in STAGES])
    return parser.parse_args(argv)


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def repository_path(path):
    resolved = Path(path).resolve()
    try:
        return resolved.relative_to(ROOT).as_posix()
    except ValueError as error:
        raise ValueError(f"provenance path is outside repository root: {resolved}") from error


def file_facts(path):
    return {
        "path": repository_path(path),
        "sha256": sha256_file(path),
    }


def write_provenance(path, stage_facts, args):
    script_path = Path(__file__).resolve()
    manifest = {
        "schemaVersion": 1,
        "generator": {
            "scriptPath": repository_path(script_path),
            "scriptSha256": sha256_file(script_path),
            "blenderVersion": bpy.app.version_string,
        },
        "inputs": {
            "surface": file_facts(args.surface),
            "normal": file_facts(args.normal),
        },
        "stages": {
            stage_id: facts
            for stage_id, facts in stage_facts
        },
    }
    manifest_path = Path(path).resolve()
    repository_path(manifest_path)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(manifest, indent=2, sort_keys=True) + "\n"
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            dir=manifest_path.parent,
            encoding="utf-8",
            prefix=f".{manifest_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary.write(payload)
            temporary.flush()
            os.fsync(temporary.fileno())
            temporary_path = Path(temporary.name)
        os.replace(temporary_path, manifest_path)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
    return manifest


def reset_scene(stage_id):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    collection = bpy.data.collections.new(f"{stage_id}-authored-environment")
    bpy.context.scene.collection.children.link(collection)
    return collection


def load_image(path, colorspace):
    image = bpy.data.images.load(str(Path(path).resolve()), check_existing=True)
    image.colorspace_settings.name = colorspace
    return image


def make_material(name, color, surface_image, normal_image, metallic=0.0, roughness=0.72, emission=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness

    surface = nodes.new("ShaderNodeTexImage")
    surface.name = f"{name} Albedo"
    surface.image = surface_image
    surface.interpolation = "Linear"
    tint = nodes.new("ShaderNodeRGB")
    tint.name = f"{name} Tint"
    tint.outputs[0].default_value = (*color, 1.0)
    multiply = nodes.new("ShaderNodeMixRGB")
    multiply.name = f"{name} Toon Multiply"
    multiply.blend_type = "MULTIPLY"
    multiply.inputs[0].default_value = 0.28
    links.new(tint.outputs["Color"], multiply.inputs[1])
    links.new(surface.outputs["Color"], multiply.inputs[2])
    links.new(multiply.outputs["Color"], bsdf.inputs["Base Color"])

    normal = nodes.new("ShaderNodeTexImage")
    normal.name = f"{name} Normal"
    normal.image = normal_image
    normal.image.colorspace_settings.name = "Non-Color"
    normal.interpolation = "Linear"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.42
    links.new(normal.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])

    if emission:
        emission_color, strength = emission
        bsdf.inputs["Emission Color"].default_value = (*emission_color, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    material["texturePolicy"] = "GTI cartoon albedo and normal embedded"
    material["sourceBaseColor"] = list(color)
    return material


def finish(obj, name, collection, material, bevel=0.0):
    obj.name = name
    obj.data.name = f"{name}-mesh"
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new("Authored edge bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if bevel:
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.ops.object.shade_smooth_by_angle()
    obj.select_set(False)
    return obj


def box(name, location, scale, collection, material, rotation=(0.0, 0.0, 0.0), bevel=0.045):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, collection, material, bevel)


def cylinder(name, location, radius, depth, collection, material, vertices=12, rotation=(0.0, 0.0, 0.0), bevel=0.035):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    return finish(bpy.context.object, name, collection, material, bevel)


def cone(name, location, radius1, radius2, depth, collection, material, vertices=6, rotation=(0.0, 0.0, 0.0), bevel=0.025):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location, rotation=rotation)
    return finish(bpy.context.object, name, collection, material, bevel)


def torus(name, location, major_radius, minor_radius, collection, material, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=24,
        minor_segments=6,
        location=location,
        rotation=rotation,
    )
    return finish(bpy.context.object, name, collection, material, 0.018)


def sphere(name, location, radius, collection, material):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=location)
    return finish(bpy.context.object, name, collection, material, 0.0)


def slab_route(prefix, collection, material, x_values, width=2.0, z=0.0, jitter=0.035):
    for index, x in enumerate(x_values):
        box(
            f"{prefix}-slab-{index + 1:02d}",
            (x, ((index % 3) - 1) * jitter * 3.0, z + ((index % 2) * 0.018)),
            (0.52, width + (index % 2) * 0.1, 0.18),
            collection,
            material,
            rotation=(0.0, 0.0, math.radians(((index * 5) % 7) - 3) * jitter),
            bevel=0.055,
        )


def stair_flight(prefix, collection, material, start, count, step, size, axis="x"):
    x, y, z = start
    for index in range(count):
        loc = (x + step[0] * index, y + step[1] * index, z + step[2] * index)
        sx, sy, sz = size
        if axis == "x":
            sx = max(sx, abs(step[0]) * 0.72)
        else:
            sy = max(sy, abs(step[1]) * 0.72)
        box(f"{prefix}-step-{index + 1:02d}", loc, (sx, sy, sz), collection, material, bevel=0.025)


def pylon(prefix, collection, stone, trim, location, height=2.4, spire=True):
    x, y, z = location
    box(f"{prefix}-foot", (x, y, z + 0.18), (0.55, 0.55, 0.18), collection, trim, bevel=0.07)
    box(f"{prefix}-base", (x, y, z + 0.48), (0.42, 0.42, 0.3), collection, stone, bevel=0.06)
    cylinder(f"{prefix}-shaft", (x, y, z + 0.75 + height * 0.5), 0.28, height, collection, stone, vertices=8)
    box(f"{prefix}-capital", (x, y, z + 0.8 + height), (0.42, 0.42, 0.18), collection, trim, rotation=(0.0, 0.0, math.radians(22.5)), bevel=0.04)
    if spire:
        cone(f"{prefix}-spire", (x, y, z + 1.35 + height), 0.34, 0.02, 0.92, collection, trim, vertices=6)


def portal(prefix, collection, stone, trim, glow, location, width=2.0, height=2.4, depth=0.34):
    x, y, z = location
    for side in (-1, 1):
        box(f"{prefix}-pier-{side:+d}", (x, y + side * width * 0.62, z + height * 0.5), (depth, 0.3, height * 0.5), collection, stone, bevel=0.07)
        cone(f"{prefix}-finial-{side:+d}", (x, y + side * width * 0.62, z + height + 0.42), 0.26, 0.01, 0.84, collection, trim, vertices=5)
    torus(f"{prefix}-arch", (x, y, z + height * 0.72), width * 0.62, 0.18, collection, trim, rotation=(0.0, math.pi / 2.0, 0.0))
    torus(f"{prefix}-inner-light", (x - depth * 0.12, y, z + height * 0.72), width * 0.47, 0.045, collection, glow, rotation=(0.0, math.pi / 2.0, 0.0))


def brazier(prefix, collection, stone, glow, location):
    x, y, z = location
    cylinder(f"{prefix}-stand", (x, y, z + 0.38), 0.22, 0.76, collection, stone, vertices=8)
    torus(f"{prefix}-bowl", (x, y, z + 0.78), 0.32, 0.1, collection, stone)
    cone(f"{prefix}-flame", (x, y, z + 1.1), 0.2, 0.01, 0.62, collection, glow, vertices=7)


def chain(prefix, collection, material, start, end, links=9):
    a = Vector(start)
    b = Vector(end)
    for index in range(links):
        t = index / max(1, links - 1)
        point = a.lerp(b, t)
        point.z -= math.sin(math.pi * t) * 0.32
        torus(
            f"{prefix}-link-{index + 1:02d}",
            point,
            0.11,
            0.035,
            collection,
            material,
            rotation=(math.pi / 2.0 if index % 2 else 0.0, 0.0, 0.0),
        )


def crystal(prefix, collection, material, location, height=1.5, radius=0.35, lean=0.0):
    x, y, z = location
    return cone(
        prefix,
        (x, y, z + height * 0.5),
        radius,
        0.015,
        height,
        collection,
        material,
        vertices=5,
        rotation=(math.radians(lean), math.radians(-lean * 0.45), math.radians((x + y) * 7.0)),
    )


def make_palette(stage_id, surface, normal, colors):
    mats = {}
    for role, spec in colors.items():
        color = spec[0]
        metallic = spec[1] if len(spec) > 1 else 0.0
        roughness = spec[2] if len(spec) > 2 else 0.72
        emission = spec[3] if len(spec) > 3 else None
        mats[role] = make_material(f"{stage_id} {role}", color, surface, normal, metallic, roughness, emission)
    return mats


def build_cinder(c, m):
    for index, (x, sx, sy, z) in enumerate(((-4.8, 2.0, 2.4, 0.72), (0.0, 2.25, 2.15, 0.9), (4.8, 2.0, 2.4, 1.08))):
        box(f"cinder-bridge-court-{index}", (x, 0, z), (sx, sy, 0.26), c, m["Basalt"], bevel=0.09)
    for index, x in enumerate((-2.45, 2.45)):
        box(f"cinder-bridge-span-{index}", (x, 0, 0.82 + index * 0.18), (0.55, 1.72, 0.18), c, m["Basalt"], bevel=0.05)
    for side in (-1, 1):
        for index, x in enumerate((-4.7, -2.35, 0.0, 2.35, 4.7)):
            z = 0.58 + 0.09 * index
            torus(f"cinder-underarch-{side}-{index}", (x, side * 2.35, z), 0.72, 0.13, c, m["Iron"], rotation=(math.pi / 2, 0, 0))
            box(f"cinder-arch-pier-{side}-{index}", (x, side * 2.38, 0.18), (0.18, 0.28, 0.72), c, m["Basalt"], bevel=0.035)
        for index, x in enumerate((-6.0, -5.1, -3.7, -1.4, 1.4, 3.7, 5.1, 6.0)):
            box(f"cinder-battlement-{side}-{index}", (x, side * 2.48, 1.43 + (0.18 if x > 2 else 0.0)), (0.34, 0.2, 0.35), c, m["Ash"], rotation=(0, 0, math.radians(side * (index % 3 - 1) * 4)), bevel=0.035)
    portal("cinder-forge-gate", c, m["Basalt"], m["Iron"], m["Ember"], (5.7, 0, 1.24), 1.9, 2.9)
    torus("cinder-west-seal", (-4.65, 0, 1.0), 1.25, 0.1, c, m["Iron"])
    torus("cinder-west-seal-ember", (-4.65, 0, 1.02), 0.72, 0.055, c, m["Ember"])
    for index, (x, y, angle) in enumerate(((-5.5, -0.6, -18), (-4.3, 0.1, 12), (-3.1, 0.45, -8), (-1.3, -0.35, 19), (0.2, 0.28, -14), (1.7, -0.18, 10), (3.1, 0.5, -21), (4.4, -0.42, 16), (5.4, 0.18, -7))):
        box(f"cinder-lava-fissure-{index}", (x, y, 1.18 + 0.035 * index), (0.5, 0.045, 0.025), c, m["Ember"], rotation=(0, 0, math.radians(angle)), bevel=0.008)
    for index, (x, y, h, lean) in enumerate(((-6.4, -2.7, 2.1, -12), (-6.1, 2.8, 1.6, 14), (-4.0, -2.8, 1.2, 10), (1.2, 2.75, 1.4, -9), (4.1, -2.85, 1.7, 13), (6.3, 2.8, 2.3, -14))):
        crystal(f"cinder-basalt-crag-{index}", c, m["Ash"], (x, y, -0.1), h, 0.42, lean)
    for index, y in enumerate((-1.2, 1.2)):
        brazier(f"cinder-gate-brazier-{index}", c, m["Iron"], m["Ember"], (4.55, y, 1.38))


def build_veil(c, m):
    for index, (x, y, sx, sy, z) in enumerate(((-3.4, 0.0, 2.4, 3.2, 0.2), (0.7, 0.0, 1.75, 3.45, 0.5), (4.4, 0.0, 1.65, 3.0, 1.08))):
        box(f"veil-citadel-court-{index}", (x, y, z), (sx, sy, 0.24), c, m["Slate"], bevel=0.11)
    stair_flight("veil-west-ascent", c, m["Slate"], (-0.9, 0, 0.42), 7, (0.32, 0, 0.09), (0.3, 1.75, 0.1))
    stair_flight("veil-high-ascent", c, m["Slate"], (2.45, 0, 0.78), 7, (0.3, 0, 0.13), (0.28, 1.62, 0.11))
    torus("veil-court-sigil-outer", (-3.35, 0, 0.48), 1.45, 0.11, c, m["Silver"])
    torus("veil-court-sigil-inner", (-3.35, 0, 0.5), 0.82, 0.06, c, m["Veil Light"])
    for side in (-1, 1):
        for index, x in enumerate((-5.5, -4.1, -2.6, -0.5, 1.0, 2.7, 4.2, 5.6)):
            box(f"veil-rampart-{side}-{index}", (x, side * 3.28, 0.78 + 0.1 * max(0, index - 4)), (0.55, 0.2, 0.55), c, m["Slate"], bevel=0.045)
    tower_specs = ((-5.65, -3.45, 3.0), (-5.65, 3.45, 3.6), (-0.2, -3.5, 2.5), (0.8, 3.5, 2.9), (4.25, -3.35, 3.8), (5.55, 3.35, 4.5))
    for index, (x, y, h) in enumerate(tower_specs):
        pylon(f"veil-bastion-tower-{index}", c, m["Slate"], m["Silver"], (x, y, -0.12), h, True)
        box(f"veil-bastion-buttress-{index}", (x - 0.48, y, 0.75 + h * 0.24), (0.22, 0.54, 0.78 + h * 0.22), c, m["Slate"], bevel=0.035)
    portal("veil-arrival-gate", c, m["Slate"], m["Silver"], m["Veil Light"], (-5.65, 0, 0.42), 2.0, 3.0)
    portal("veil-signal-gate", c, m["Slate"], m["Silver"], m["Veil Light"], (5.35, 0, 1.3), 2.1, 3.7)
    chain("veil-chain-north", c, m["Silver"], (-5.65, 3.45, 3.9), (0.8, 3.5, 3.25), 11)
    chain("veil-chain-south", c, m["Silver"], (-0.2, -3.5, 2.85), (4.25, -3.35, 4.15), 9)
    for index, (x, y, z) in enumerate(((-4.2, -3.0, 1.45), (-1.4, 3.0, 1.5), (2.0, -3.0, 1.9), (4.2, 2.95, 2.45))):
        box(f"veil-banner-{index}", (x, y, z), (0.06, 0.54, 0.95), c, m["Banner"], rotation=(0, 0, math.radians(index * 5 - 8)), bevel=0.018)


def build_echo(c, m):
    for index, x in enumerate((-5.4, -3.6, -1.8, 0.0, 1.8, 3.6)):
        for side in (-1, 1):
            box(f"echo-hall-tile-{side}-{index}", (x, side * 1.65, 0.18), (0.82, 1.5, 0.18), c, m["Marble"], bevel=0.055)
    box("echo-transept", (2.35, 0, 0.28), (1.25, 3.65, 0.22), c, m["Marble"], bevel=0.08)
    stair_flight("echo-throne-ascent", c, m["Marble"], (3.55, 0, 0.35), 9, (0.28, 0, 0.12), (0.26, 1.7, 0.11))
    box("echo-throne-court", (6.25, 0, 1.4), (1.55, 3.2, 0.28), c, m["Marble"], bevel=0.11)
    cylinder("echo-resonance-dais", (0.3, 0, 0.58), 1.3, 0.42, c, m["Gold"], vertices=16, bevel=0.06)
    torus("echo-dais-sigil", (0.3, 0, 0.8), 0.92, 0.07, c, m["Echo Light"])
    for side in (-1, 1):
        for index, x in enumerate((-5.6, -3.7, -1.8, 0.1, 2.0, 4.0, 5.75)):
            pylon(f"echo-nave-column-{side}-{index}", c, m["Marble"], m["Gold"], (x, side * 3.45, -0.08), 1.65 + 0.18 * (index % 3), index in (0, 6))
        for index, x in enumerate((-4.65, -2.75, -0.85, 1.05, 2.95)):
            torus(f"echo-vault-rib-{side}-{index}", (x, side * 3.18, 2.15), 1.25, 0.09, c, m["Gold"], rotation=(math.pi / 2, 0, 0))
    portal("echo-great-apse", c, m["Marble"], m["Gold"], m["Echo Light"], (6.7, 0, 1.72), 2.35, 4.1)
    for index, y in enumerate((-1.35, 1.35)):
        box(f"echo-throne-arm-{index}", (6.15, y, 2.1), (0.68, 0.42, 0.88), c, m["Gold"], bevel=0.08)
    box("echo-throne-back", (6.6, 0, 2.65), (0.5, 1.55, 1.35), c, m["Marble"], bevel=0.1)
    box("echo-throne-velvet-seat", (5.95, 0, 1.98), (0.68, 1.02, 0.2), c, m["Velvet"], bevel=0.08)
    for index, (x, y) in enumerate(((-4.6, -2.4), (-4.6, 2.4), (-1.7, -2.4), (-1.7, 2.4), (3.35, -2.35), (3.35, 2.35))):
        brazier(f"echo-votive-{index}", c, m["Gold"], m["Echo Light"], (x, y, 0.35))


def build_sunken(c, m):
    for row, y in enumerate((-2.65, -0.9, 0.9, 2.65)):
        for column, x in enumerate((-5.4, -3.6, -1.8, 0.0, 1.8, 3.6, 5.4)):
            box(f"sunken-flood-cell-{row}-{column}", (x, y, -0.08), (0.84, 0.78, 0.05), c, m["Tide Light"], bevel=0.018)
    for index, (x, y, sx, sy, z) in enumerate(((-4.6, 0, 1.4, 2.75, 0.16), (-1.5, -1.75, 1.15, 0.78, 0.22), (-1.5, 1.75, 1.15, 0.78, 0.3), (1.35, 0, 1.25, 1.1, 0.4), (4.75, 0, 1.8, 2.9, 0.88))):
        box(f"sunken-stone-island-{index}", (x, y, z), (sx, sy, 0.2), c, m["Stone"], bevel=0.09)
    stair_flight("sunken-lock-stair", c, m["Stone"], (2.45, 0, 0.5), 8, (0.3, 0, 0.11), (0.27, 1.55, 0.1))
    cylinder("sunken-tide-dais", (-4.55, 0, 0.5), 1.28, 0.46, c, m["Bronze"], vertices=16, bevel=0.06)
    torus("sunken-tide-sigil", (-4.55, 0, 0.75), 0.84, 0.07, c, m["Tide Light"])
    for side in (-1, 1):
        for index, x in enumerate((-5.8, -4.1, -2.4, -0.3, 1.5, 3.1, 4.8, 6.0)):
            box(f"sunken-seawall-{side}-{index}", (x, side * 3.5, 0.5 + 0.06 * index), (0.62, 0.24, 0.52 + 0.08 * (index % 3)), c, m["Moss"], bevel=0.07)
    for index, (x, y, h) in enumerate(((-5.8, -3.55, 1.55), (-5.8, 3.55, 1.85), (-0.2, -3.55, 1.4), (1.2, 3.55, 1.75), (5.5, -3.55, 2.3), (5.5, 3.55, 2.6))):
        pylon(f"sunken-watchtower-{index}", c, m["Stone"], m["Bronze"], (x, y, -0.18), h, False)
    portal("sunken-tide-lock", c, m["Stone"], m["Bronze"], m["Tide Light"], (5.7, 0, 1.1), 2.15, 3.25)
    for index, (x, y, z) in enumerate(((-3.0, -1.7, 0.35), (-3.0, 1.7, 0.35), (0.15, -1.35, 0.45), (0.15, 1.35, 0.45), (4.0, -2.0, 1.12), (4.0, 2.0, 1.12))):
        brazier(f"sunken-tide-beacon-{index}", c, m["Bronze"], m["Tide Light"], (x, y, z))


def build_howling(c, m):
    plate_specs = (
        (-4.8, -2.3, 1.75, 1.65, 0.02, -5), (-1.6, -2.4, 1.45, 1.5, 0.08, 3), (1.4, -2.25, 1.5, 1.6, 0.12, -4), (4.65, -2.3, 1.65, 1.55, 0.05, 5),
        (-4.6, 0.3, 1.8, 1.2, 0.12, 4), (-1.35, 0.2, 1.4, 1.2, 0.18, -3), (1.55, 0.25, 1.45, 1.25, 0.22, 5), (4.75, 0.2, 1.7, 1.25, 0.15, -4),
        (-4.7, 2.65, 1.7, 1.05, 0.2, -3), (-1.55, 2.55, 1.45, 1.1, 0.24, 5), (1.45, 2.6, 1.45, 1.08, 0.28, -5), (4.7, 2.55, 1.65, 1.12, 0.22, 4),
    )
    for index, (x, y, sx, sy, z, angle) in enumerate(plate_specs):
        box(f"howling-wind-plateau-{index}", (x, y, z), (sx, sy, 0.2), c, m["Dust"], rotation=(0, 0, math.radians(angle)), bevel=0.11)
    for index, (x, y, angle) in enumerate(((-5.3, -0.8, 14), (-4.0, -0.15, 18), (-2.55, 0.45, 12), (-1.1, 0.85, -9), (0.35, 0.55, -17), (1.8, -0.05, -12), (3.25, 0.5, 13), (4.65, 1.0, 18))):
        box(f"howling-wind-road-{index}", (x, y, 0.46), (0.78, 0.32, 0.035), c, m["Bone"], rotation=(0, 0, math.radians(angle)), bevel=0.025)
    torus("howling-challenge-ring", (2.9, 0.15, 0.48), 1.25, 0.1, c, m["Bone"])
    torus("howling-challenge-ring-inner", (2.9, 0.15, 0.5), 0.72, 0.055, c, m["Banner"])
    fin_clusters = ((-6.0, -3.3, 3.4, -18), (-5.4, 3.45, 2.5, 14), (-3.2, -3.55, 2.0, 11), (-1.1, 3.5, 3.0, -15), (1.1, -3.45, 2.2, 13), (3.1, 3.45, 2.8, -12), (5.3, -3.4, 3.6, 17), (6.0, 3.2, 2.7, -14))
    for index, (x, y, h, lean) in enumerate(fin_clusters):
        crystal(f"howling-ridge-fin-{index}", c, m["Rock"], (x, y, -0.12), h, 0.68, lean)
        crystal(f"howling-ridge-splinter-a-{index}", c, m["Bone"], (x + 0.48, y - 0.28, -0.05), h * 0.58, 0.28, -lean * 0.55)
        crystal(f"howling-ridge-splinter-b-{index}", c, m["Rock"], (x - 0.42, y + 0.24, -0.08), h * 0.42, 0.24, lean * 0.7)
    for index, (x, y) in enumerate(((-4.0, -1.7), (-1.6, 1.7), (1.2, -1.75), (4.1, 1.65))):
        box(f"howling-torn-banner-{index}", (x, y, 1.4), (0.07, 0.6, 0.92), c, m["Banner"], rotation=(math.radians(index * 3), 0, math.radians(index * 7 - 11)), bevel=0.012)


def build_glass(c, m):
    for row, y in enumerate((-2.55, 0.0, 2.55)):
        for column, x in enumerate((-5.4, -3.6, -1.8, 0.0, 1.8, 3.6, 5.4)):
            box(f"glass-necropolis-tile-{row}-{column}", (x, y, 0.12 + 0.035 * ((row + column) % 2)), (0.84, 1.18, 0.18), c, m["Obsidian"], bevel=0.045)
    tomb_specs = ((-4.7, -1.3, 2.4), (-4.7, 1.35, 2.9), (-2.35, -1.25, 1.9), (-2.35, 1.3, 2.4), (0.0, -1.3, 2.6), (0.0, 1.3, 2.1), (2.4, -1.25, 2.2), (2.4, 1.3, 2.8), (4.75, -1.3, 3.0), (4.75, 1.35, 3.5))
    for index, (x, y, h) in enumerate(tomb_specs):
        box(f"glass-tomb-{index}-plinth", (x, y, 0.42), (0.58, 0.52, 0.32), c, m["Silver"], bevel=0.055)
        box(f"glass-tomb-{index}-stele", (x, y, 0.74 + h * 0.42), (0.4, 0.3, h * 0.42), c, m["Crystal"], bevel=0.045)
        cone(f"glass-tomb-{index}-crown", (x, y, 0.78 + h), 0.56, 0.03, 0.82, c, m["Crystal"], vertices=4, rotation=(0, 0, math.radians(45)))
        for side in (-1, 1):
            crystal(f"glass-tomb-{index}-flanker-{side}", c, m["Ice Light"], (x + side * 0.48, y + side * 0.18, 0.5), h * 0.42, 0.16, side * (8 + index % 3 * 3))
    torus("glass-necropolis-sigil-outer", (0, 0, 0.48), 1.4, 0.1, c, m["Silver"])
    torus("glass-necropolis-sigil-inner", (0, 0, 0.5), 0.78, 0.06, c, m["Ice Light"])
    for index, (x, y, h, lean) in enumerate(((-6.25, -3.2, 2.5, -12), (-6.1, 3.25, 3.2, 11), (-3.7, -3.3, 1.8, 9), (-1.2, 3.35, 2.3, -10), (1.35, -3.3, 2.0, 12), (3.75, 3.3, 2.7, -11), (6.15, -3.15, 3.5, 13), (6.2, 3.15, 2.8, -12))):
        crystal(f"glass-perimeter-shard-{index}", c, m["Crystal"], (x, y, -0.08), h, 0.52, lean)
        crystal(f"glass-perimeter-splinter-{index}", c, m["Ice Light"], (x - 0.45, y + 0.25, 0.0), h * 0.55, 0.22, -lean)
    portal("glass-great-stele", c, m["Obsidian"], m["Silver"], m["Ice Light"], (6.0, 0, 0.45), 2.0, 3.6)


def build_canal(c, m):
    for side in (-1, 1):
        for index, x in enumerate((-5.7, -4.3, -2.9, -1.5, -0.1, 1.3, 2.7, 4.1, 5.5)):
            box(f"canal-bank-{side}-{index}", (x, side * 1.75, 0.2 + 0.04 * (index % 2)), (0.62, 0.72, 0.24), c, m["Masonry"], bevel=0.065)
            if index % 2 == 0:
                box(f"canal-house-{side}-{index}", (x, side * 2.65, 1.0), (0.48, 0.5, 1.0 + 0.18 * (index % 3)), c, m["Timber"], bevel=0.055)
                cone(f"canal-roof-{side}-{index}", (x, side * 2.65, 2.18 + 0.18 * (index % 3)), 0.72, 0.04, 0.82, c, m["Roof"], vertices=4, rotation=(0, 0, math.radians(45)))
    for index, x in enumerate((-5.8, -4.4, -3.0, -1.6, -0.2, 1.2, 2.6, 4.0, 5.4)):
        box(f"canal-water-{index}", (x, 0, -0.04), (0.65, 0.83, 0.045), c, m["Water"], bevel=0.012)
    for bridge_index, x in enumerate((-3.2, 3.2)):
        for tile_index, y in enumerate((-1.0, -0.5, 0.0, 0.5, 1.0)):
            box(f"canal-bridge-{bridge_index}-{tile_index}", (x, y, 0.46), (0.7, 0.22, 0.13), c, m["Masonry"], bevel=0.035)
    portal("canal-lock-gate", c, m["Masonry"], m["Iron"], m["Lamp"], (6.25, 0, 0.18), 1.45, 2.6)
    for index, (x, y) in enumerate(((-5.1, -1.25), (-5.1, 1.25), (-1.9, -1.25), (-1.9, 1.25), (1.7, -1.25), (1.7, 1.25), (5.0, -1.25), (5.0, 1.25))):
        brazier(f"canal-lamp-{index}", c, m["Iron"], m["Lamp"], (x, y, 0.32))


def build_causeway(c, m):
    for court_index, (x, sx, sy, z) in enumerate(((-5.0, 1.75, 2.55, 0.0), (0.0, 1.55, 1.9, 0.28), (5.0, 1.8, 2.55, 0.58))):
        box(f"causeway-court-{court_index}", (x, 0, z), (sx, sy, 0.22), c, m["Stone"], rotation=(0, 0, math.radians((court_index - 1) * 2.5)), bevel=0.09)
    for index, x in enumerate((-2.95, -2.25, 2.2, 2.9)):
        box(f"causeway-bridge-piece-{index}", (x, (index % 2 - 0.5) * 0.12, 0.2 + (0.15 if x > 0 else 0.0)), (0.5, 1.05, 0.16), c, m["Stone"], rotation=(0, math.radians((index % 2) * 2), math.radians((index % 3 - 1) * 3)), bevel=0.055)
    for side in (-1, 1):
        for index, x in enumerate((-6.2, -4.5, -0.7, 0.8, 4.3, 6.2)):
            pylon(f"causeway-pier-{side}-{index}", c, m["Stone"], m["Iron"], (x, side * (2.1 if abs(x) < 2 else 2.65), -0.2), 0.8 + 0.2 * (index % 3), False)
    for index, (x, y, h, lean) in enumerate(((-5.8, -2.1, 2.5, -16), (-4.1, 2.2, 2.1, 13), (-0.9, -1.8, 1.8, -10), (0.9, 1.8, 2.0, 12), (4.0, -2.2, 2.2, -14), (5.8, 2.1, 2.7, 16))):
        crystal(f"causeway-colossus-rib-{index}", c, m["Bone"], (x, y, 0.0), h, 0.42, lean)
    for index, x in enumerate((-5.7, -4.6, -0.7, 0.4, 4.5, 5.7)):
        box(f"causeway-fracture-{index}", (x, math.sin(index) * 0.45, 0.27 + (0.28 if abs(x) < 2 else (0.58 if x > 2 else 0))), (0.42, 0.035, 0.025), c, m["Seam"], rotation=(0, 0, math.radians(index * 11 - 24)), bevel=0.008)
    chain("causeway-chain-a", c, m["Iron"], (-4.5, -2.2, 1.7), (-0.9, -1.8, 1.4), 9)
    chain("causeway-chain-b", c, m["Iron"], (0.9, 1.8, 1.5), (4.0, 2.2, 1.8), 9)


def build_chancel(c, m):
    slab_route("chancel-nave", c, m["Stone"], [x * 0.68 for x in range(-9, 9)], width=2.0, z=0.0)
    for side in (-1, 1):
        for index, x in enumerate((-5.8, -4.0, -2.2, -0.4, 1.4, 3.2, 5.0)):
            box(f"chancel-aisle-{side}-{index}", (x, side * 2.35, 0.03), (0.72, 0.48, 0.18), c, m["Stone"], bevel=0.055)
            pylon(f"chancel-column-{side}-{index}", c, m["Stone"], m["Silver"], (x, side * 2.85, 0.12), 1.45 + 0.18 * (index % 3), index in (0, 6))
    for index, x in enumerate((-4.8, -1.7, 1.5, 4.6)):
        torus(f"chancel-vault-rib-{index}", (x, 0, 1.55), 2.65, 0.1, c, m["Silver"], rotation=(math.pi / 2, 0, 0))
    box("chancel-apse", (6.35, 0, 0.48), (1.0, 2.3, 0.48), c, m["Stone"], bevel=0.1)
    portal("chancel-rose-apse", c, m["Stone"], m["Silver"], m["Votive"], (6.85, 0, 0.72), 2.0, 3.3)
    torus("chancel-floor-sigil", (1.0, 0, 0.25), 1.35, 0.08, c, m["Votive"])
    for index, (x, y) in enumerate(((4.8, -1.45), (4.8, 1.45), (5.8, -1.45), (5.8, 1.45), (-2.4, -2.0), (-2.4, 2.0))):
        brazier(f"chancel-votive-{index}", c, m["Silver"], m["Votive"], (x, y, 0.25 if x < 4 else 0.92))
    for index, y in enumerate((-1.85, 1.85)):
        box(f"chancel-velvet-banner-{index}", (5.85, y, 2.65), (0.05, 0.48, 0.92), c, m["Velvet"], bevel=0.018)


def build_zenith(c, m):
    slab_route("zenith-procession", c, m["Stone"], [x * 0.7 for x in range(-8, 3)], width=2.25, z=0.0)
    stair_flight("zenith-grand-stair", c, m["Stone"], (2.2, 0, 0.18), 12, (0.3, 0, 0.14), (0.28, 1.65, 0.13))
    box("zenith-gate-court", (6.0, 0, 1.72), (1.35, 2.7, 0.28), c, m["Stone"], bevel=0.1)
    portal("zenith-great-gate", c, m["Stone"], m["Gold"], m["Breach"], (6.75, 0, 1.95), 2.3, 4.4)
    torus("zenith-gate-ring-outer", (6.62, 0, 5.05), 2.0, 0.16, c, m["Gold"], rotation=(0, math.pi / 2, 0))
    torus("zenith-gate-ring-inner", (6.55, 0, 5.05), 1.45, 0.08, c, m["Breach"], rotation=(0, math.pi / 2, 0))
    for index, (x, y, h) in enumerate(((-5.6, -2.7, 2.2), (-5.6, 2.7, 2.5), (-1.8, -2.7, 2.7), (-1.8, 2.7, 3.0), (2.0, -2.7, 3.1), (2.0, 2.7, 3.4), (5.1, -2.8, 3.8), (5.1, 2.8, 4.1))):
        pylon(f"zenith-pylon-{index}", c, m["Stone"], m["Gold"], (x, y, -0.08 if x < 2 else 0.5), h, True)
    for index, angle in enumerate(range(0, 360, 45)):
        radians = math.radians(angle)
        crystal(f"zenith-crown-shard-{index}", c, m["Breach"], (6.45, math.cos(radians) * 2.5, 4.7 + math.sin(radians) * 1.1), 0.9 + (index % 2) * 0.35, 0.16, angle - 180)
    for index, y in enumerate((-1.55, 1.55)):
        brazier(f"zenith-brazier-{index}", c, m["Gold"], m["Breach"], (4.55, y, 1.75))
    chain("zenith-chain-north", c, m["Gold"], (-1.8, 2.7, 3.4), (5.1, 2.8, 4.4), 10)
    chain("zenith-chain-south", c, m["Gold"], (-1.8, -2.7, 3.1), (5.1, -2.8, 4.1), 10)
    for index, y in enumerate((-2.05, 2.05)):
        box(f"zenith-war-banner-{index}", (4.25, y, 3.65), (0.05, 0.55, 1.15), c, m["Banner"], bevel=0.018)


BUILDERS = {
    "cinder-span": (build_cinder, {
        "Basalt": ((0.2, 0.18, 0.2), 0.08, 0.82), "Iron": ((0.28, 0.22, 0.23), 0.58, 0.42),
        "Ash": ((0.34, 0.24, 0.22), 0.0, 0.9), "Ember": ((1.0, 0.12, 0.015), 0.05, 0.28, ((1.0, 0.03, 0.0), 4.8)),
    }, "broken ash bridge, forge arches, ember fissures, seal dais"),
    "veil-citadel": (build_veil, {
        "Slate": ((0.16, 0.22, 0.34), 0.12, 0.78), "Silver": ((0.37, 0.5, 0.7), 0.62, 0.38),
        "Banner": ((0.15, 0.08, 0.28), 0.0, 0.82), "Veil Light": ((0.2, 0.45, 1.0), 0.15, 0.24, ((0.08, 0.22, 1.0), 4.0)),
    }, "mist citadel rampart, ascents, bastion towers, signal gates"),
    "echo-throne": (build_echo, {
        "Marble": ((0.22, 0.18, 0.32), 0.08, 0.68), "Gold": ((0.72, 0.46, 0.16), 0.72, 0.3),
        "Velvet": ((0.28, 0.06, 0.18), 0.0, 0.74), "Echo Light": ((0.72, 0.38, 1.0), 0.12, 0.25, ((0.38, 0.08, 1.0), 4.2)),
    }, "monumental throne court, tiered processional steps, echo rings"),
    "sunken-bastion": (build_sunken, {
        "Stone": ((0.12, 0.26, 0.25), 0.05, 0.9), "Bronze": ((0.4, 0.3, 0.16), 0.64, 0.42),
        "Moss": ((0.16, 0.32, 0.22), 0.0, 0.96), "Tide Light": ((0.02, 0.75, 0.7), 0.0, 0.2, ((0.0, 0.48, 0.42), 3.2)),
    }, "flooded bastion, causeways, stepped seawalls, tide lock"),
    "howling-sprawl": (build_howling, {
        "Dust": ((0.55, 0.34, 0.16), 0.0, 0.92), "Rock": ((0.22, 0.15, 0.12), 0.05, 0.96),
        "Bone": ((0.55, 0.42, 0.3), 0.0, 0.8), "Banner": ((0.45, 0.08, 0.04), 0.0, 0.78),
    }, "wind-scoured sprawl, angled rock fins, rib arches, torn banners"),
    "glass-necropolis": (build_glass, {
        "Obsidian": ((0.12, 0.13, 0.2), 0.24, 0.46), "Silver": ((0.48, 0.54, 0.68), 0.7, 0.26),
        "Crystal": ((0.38, 0.76, 1.0), 0.05, 0.18, ((0.1, 0.4, 1.0), 2.0)), "Ice Light": ((0.65, 0.25, 1.0), 0.1, 0.18, ((0.25, 0.05, 1.0), 4.0)),
    }, "crystalline necropolis, shard aisles, tomb stelae, luminous sigil"),
    "starless-canal": (build_canal, {
        "Masonry": ((0.1, 0.11, 0.13), 0.04, 0.9), "Timber": ((0.14, 0.09, 0.06), 0.0, 0.86),
        "Roof": ((0.08, 0.09, 0.14), 0.12, 0.72), "Iron": ((0.25, 0.22, 0.18), 0.7, 0.36),
        "Water": ((0.02, 0.08, 0.12), 0.15, 0.18, ((0.01, 0.04, 0.09), 1.4)), "Lamp": ((1.0, 0.45, 0.08), 0.0, 0.22, ((1.0, 0.18, 0.02), 5.0)),
    }, "starless canal, twin banks, lock gate, bridges, lamp-lit roofs"),
    "shattered-causeway": (build_causeway, {
        "Stone": ((0.22, 0.17, 0.18), 0.05, 0.9), "Iron": ((0.3, 0.22, 0.18), 0.68, 0.42),
        "Bone": ((0.42, 0.28, 0.25), 0.0, 0.86), "Seam": ((1.0, 0.18, 0.08), 0.0, 0.22, ((1.0, 0.04, 0.01), 4.4)),
    }, "fractured bridge islands, broken colossus ribs, chains, glowing seams"),
    "abyss-chancel": (build_chancel, {
        "Stone": ((0.13, 0.12, 0.22), 0.06, 0.84), "Silver": ((0.38, 0.34, 0.55), 0.58, 0.36),
        "Votive": ((0.35, 0.18, 1.0), 0.04, 0.24, ((0.12, 0.03, 1.0), 4.4)), "Velvet": ((0.24, 0.04, 0.18), 0.0, 0.8),
    }, "suspended cathedral nave, pointed vault ribs, votive apse"),
    "gate-zenith": (build_zenith, {
        "Stone": ((0.2, 0.2, 0.25), 0.08, 0.74), "Gold": ((0.76, 0.5, 0.16), 0.76, 0.26),
        "Banner": ((0.38, 0.04, 0.1), 0.0, 0.76), "Breach": ((1.0, 0.42, 0.12), 0.08, 0.18, ((1.0, 0.12, 0.01), 5.2)),
    }, "ascendant gate, concentric sigil rings, pylon crown, radiant breach"),
}


def configure_render(stage_id, render_path, key_color, rim_color):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1440
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(render_path)
    if scene.world is None:
        scene.world = bpy.data.worlds.new(f"{stage_id} review world")
    scene.world.color = (0.005, 0.007, 0.014)

    camera_data = bpy.data.cameras.new(f"{stage_id} review camera")
    camera = bpy.data.objects.new(f"{stage_id} review camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (15.8, -18.5, 14.0)
    camera.rotation_euler = ((Vector((0.5, 0.0, 0.75)) - camera.location).to_track_quat("-Z", "Y")).to_euler()
    camera.data.lens = 56
    scene.camera = camera

    for name, location, energy, color, size in (
        ("key", (-5.0, -7.0, 12.0), 1900.0, key_color, 7.0),
        ("rim", (7.0, 7.0, 10.0), 1500.0, rim_color, 6.0),
        ("fill", (0.0, 0.0, 14.0), 850.0, (0.28, 0.34, 0.55), 8.0),
    ):
        data = bpy.data.lights.new(f"{stage_id} {name}", "AREA")
        data.energy = energy
        data.color = color
        data.shape = "DISK"
        data.size = size
        light = bpy.data.objects.new(f"{stage_id} {name}", data)
        scene.collection.objects.link(light)
        light.location = location
        light.rotation_euler = ((Vector((0.0, 0.0, 0.5)) - light.location).to_track_quat("-Z", "Y")).to_euler()


def build_stage(stage_id, filename, concept_name, args):
    collection = reset_scene(stage_id)
    surface = load_image(args.surface, "sRGB")
    normal = load_image(args.normal, "Non-Color")
    builder, palette_spec, direction = BUILDERS[stage_id]
    materials = make_palette(stage_id, surface, normal, palette_spec)
    builder(collection, materials)
    for obj in collection.all_objects:
        if obj.type != "MESH":
            continue
        for vertex in obj.data.vertices:
            vertex.co = tuple(round(value, 6) for value in vertex.co)
        for uv_layer in obj.data.uv_layers:
            for loop in uv_layer.data:
                loop.uv = tuple(round(value, 4) for value in loop.uv)
        obj.data.update()

    root = bpy.data.objects.new(f"{stage_id}-authored-root", None)
    collection.objects.link(root)
    root["stageId"] = stage_id
    root["sourceConcept"] = f"assets/images/battle/pilot/{concept_name}"
    root["artDirection"] = direction
    root["runtimeRole"] = "concept-matched-terrain-environment"
    for obj in list(collection.objects):
        if obj != root and obj.parent is None:
            obj.parent = root

    blend_path = Path(args.blend_dir).resolve() / f"{stage_id}-authored.blend"
    render_path = Path(args.render_dir).resolve() / f"{stage_id}-authored-oblique.png"
    out_path = Path(args.out_dir).resolve() / filename
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    render_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    key_color = tuple(min(1.0, value * 1.8 + 0.08) for value in palette_spec[next(iter(palette_spec))][0])
    glow_roles = [role for role in palette_spec if len(palette_spec[role]) > 3]
    rim_color = palette_spec[glow_roles[-1]][0] if glow_roles else (0.24, 0.4, 0.8)
    configure_render(stage_id, render_path, key_color, rim_color)
    bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    bpy.ops.export_scene.gltf(
        filepath=str(out_path),
        export_format="GLB",
        use_selection=False,
        collection=collection.name,
        export_extras=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    meshes = [obj for obj in collection.all_objects if obj.type == "MESH"]
    corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    bounds = {
        "min": [round(min(point[axis] for point in corners), 4) for axis in range(3)],
        "max": [round(max(point[axis] for point in corners), 4) for axis in range(3)],
    }
    print({
        "stageId": stage_id,
        "out": str(out_path),
        "bytes": out_path.stat().st_size,
        "meshes": len(meshes),
        "materials": len(materials),
        "bounds": bounds,
        "render": str(render_path),
        "blend": str(blend_path),
    })
    return {
        "outputPath": repository_path(out_path),
        "outputSha256": sha256_file(out_path),
        "conceptPath": repository_path(ROOT / "assets/images/battle/pilot" / concept_name),
        "conceptSha256": sha256_file(ROOT / "assets/images/battle/pilot" / concept_name),
    }


def main():
    args = parse_args()
    stage_facts = []
    for stage_id, filename, concept_name in STAGES:
        if args.only and args.only != stage_id:
            continue
        stage_facts.append((stage_id, build_stage(stage_id, filename, concept_name, args)))

    if args.only:
        print({
            "provenance": "not-written",
            "reason": "--only does not attest unchanged stages; run the full ten-stage build",
        })
        return

    manifest_path = Path(args.out_dir).resolve() / "build-provenance.json"
    write_provenance(manifest_path, stage_facts, args)
    print({
        "provenance": str(manifest_path),
        "stages": len(stage_facts),
    })


if __name__ == "__main__":
    main()
