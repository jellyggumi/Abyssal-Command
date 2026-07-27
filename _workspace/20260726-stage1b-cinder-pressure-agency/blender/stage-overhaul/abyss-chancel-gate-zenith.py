#!/usr/bin/env python3
"""Author and validate the Abyss Chancel and Gate Zenith runtime terrain GLBs."""

import bpy
import json
import math
import struct
from pathlib import Path
from mathutils import Vector

REPO = next(parent for parent in Path(__file__).resolve().parents if (parent / "package.json").is_file())
OUT_DIR = REPO / "assets/images/battle/glb/terrain"
WORK_DIR = REPO / "_workspace/20260726-stage1b-cinder-pressure-agency/blender/stage-overhaul"
QA_DIR = REPO / "_workspace/20260726-stage1b-cinder-pressure-agency/qa/stage-overhaul"
ALBEDO_PATH = REPO / "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline/shared-textures/abyssal-toon-surface-v01.png"
NORMAL_PATH = REPO / "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline/shared-textures/abyssal-toon-normal-v01.png"
SOURCE_BLEND = WORK_DIR / "abyss-chancel-gate-zenith.blend"
EVIDENCE_PATH = QA_DIR / "abyss-chancel-gate-zenith.evidence.json"

WORK_DIR.mkdir(parents=True, exist_ok=True)
QA_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1024
scene.render.resolution_y = 768
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 1.15
world = bpy.data.worlds.new("Abyssal Review World")
scene.world = world
world.color = (0.003, 0.004, 0.012)
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.003, 0.004, 0.014, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.28

albedo = bpy.data.images.load(str(ALBEDO_PATH), check_existing=True)
albedo.name = "abyssal-toon-surface-v01"
albedo.colorspace_settings.name = "sRGB"
albedo.pack()
normal = bpy.data.images.load(str(NORMAL_PATH), check_existing=True)
normal.name = "abyssal-toon-normal-v01"
normal.colorspace_settings.name = "Non-Color"
normal.pack()


def make_material(name, tint, metallic=0.1, roughness=0.6, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = albedo
    tex.interpolation = "Linear"
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs[6].default_value = (1, 1, 1, 1)
    mix.inputs[7].default_value = (*tint, 1.0)
    ntex = nodes.new("ShaderNodeTexImage")
    ntex.image = normal
    ntex.interpolation = "Linear"
    nmap = nodes.new("ShaderNodeNormalMap")
    nmap.inputs["Strength"].default_value = 0.72
    links.new(tex.outputs["Color"], mix.inputs[6])
    links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    links.new(ntex.outputs["Color"], nmap.inputs["Color"])
    links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*tint, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission
    mat.diffuse_color = (*tint, 1.0)
    return mat


def link_only(obj, collection):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)


def apply_bevel(obj, width=0.12, segments=2):
    mod = obj.modifiers.new("Architectural edge bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)


def cube(name, loc, dims, mat, coll, bevel=0.10, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    link_only(obj, coll)
    obj.data.materials.append(mat)
    if bevel:
        apply_bevel(obj, min(bevel, min(dims) * 0.22), 2)
    return obj


def cylinder(name, loc, radius, depth, mat, coll, vertices=16, bevel=0.08, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    link_only(obj, coll)
    obj.data.materials.append(mat)
    if bevel:
        apply_bevel(obj, min(bevel, radius * 0.25), 2)
    return obj


def cone(name, loc, r1, r2, depth, mat, coll, vertices=10, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    link_only(obj, coll)
    obj.data.materials.append(mat)
    apply_bevel(obj, min(0.06, r1 * 0.15), 2)
    return obj


def torus(name, loc, major, minor, mat, coll, rot=(math.pi / 2, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=32, minor_segments=8, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    link_only(obj, coll)
    obj.data.materials.append(mat)
    return obj


def sphere(name, loc, scale, mat, coll):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    link_only(obj, coll)
    obj.data.materials.append(mat)
    return obj


def arch(name, y, width, height, base_z, depth, mat, coll, x_center=0.0):
    curve_data = bpy.data.curves.new(name + "::Curve", "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 1
    curve_data.bevel_depth = depth
    curve_data.bevel_resolution = 2
    spline = curve_data.splines.new("POLY")
    points = [
        (x_center - width / 2, y, base_z),
        (x_center - width / 2, y, base_z + height * 0.50),
        (x_center - width * 0.22, y, base_z + height * 0.78),
        (x_center, y, base_z + height),
        (x_center + width * 0.22, y, base_z + height * 0.78),
        (x_center + width / 2, y, base_z + height * 0.50),
        (x_center + width / 2, y, base_z),
    ]
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (*co, 1.0)
    obj = bpy.data.objects.new(name, curve_data)
    coll.objects.link(obj)
    obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.select_set(False)
    return obj


def ensure_uv_normals(obj):
    if obj.type != "MESH":
        return
    if not obj.data.uv_layers:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
        bpy.ops.object.mode_set(mode="OBJECT")
        obj.select_set(False)
    for poly in obj.data.polygons:
        poly.use_smooth = False


def add_pillar(prefix, x, y, base, height, mats, coll, scale=1.0):
    stone, trim, glow = mats
    cube(f"{prefix}::Foot", (x, y, base + 0.25 * scale), (1.45 * scale, 1.45 * scale, 0.50 * scale), trim, coll, 0.12)
    cube(f"{prefix}::Plinth", (x, y, base + 0.66 * scale), (1.10 * scale, 1.10 * scale, 0.34 * scale), stone, coll, 0.09)
    cylinder(f"{prefix}::Shaft", (x, y, base + 0.83 * scale + height / 2), 0.44 * scale, height, stone, coll, 12, 0.07)
    cube(f"{prefix}::Capital", (x, y, base + 0.95 * scale + height), (1.18 * scale, 1.18 * scale, 0.34 * scale), trim, coll, 0.08)
    cone(f"{prefix}::Finial", (x, y, base + 1.46 * scale + height), 0.50 * scale, 0.04, 0.85 * scale, glow, coll, 8)


def add_candle_cluster(prefix, x, y, z, wax, flame, coll):
    offsets = [(-0.30, -0.12, 0.38), (0.0, 0.08, 0.58), (0.28, -0.08, 0.44), (-0.10, 0.20, 0.31)]
    for index, (dx, dy, height) in enumerate(offsets):
        cylinder(f"{prefix}::Votive::{index+1}", (x + dx, y + dy, z + height / 2), 0.075, height, wax, coll, 8, 0.018)
        cone(f"{prefix}::Flame::{index+1}", (x + dx, y + dy, z + height + 0.105), 0.075, 0.0, 0.22, flame, coll, 8)


def build_chancel():
    coll = bpy.data.collections.new("TERRAIN::abyss-chancel")
    scene.collection.children.link(coll)
    stone = make_material("Abyss Chancel::Violet Basalt", (0.30, 0.16, 0.43), 0.25, 0.72)
    violet = make_material("Abyss Chancel::Choir Violet", (0.58, 0.20, 0.80), 0.12, 0.50)
    gold = make_material("Abyss Chancel::Antique Gold", (0.92, 0.55, 0.18), 0.78, 0.28)
    glow = make_material("Abyss Chancel::Voidlight", (0.62, 0.22, 1.0), 0.18, 0.25, 2.8)
    wax = make_material("Abyss Chancel::Votive Wax", (0.88, 0.70, 0.52), 0.0, 0.8)
    flame = make_material("Abyss Chancel::Votive Flame", (1.0, 0.34, 0.08), 0.0, 0.25, 4.8)

    # Suspended nave assembled as offset islands: corner voids break the boundary silhouette.
    cube("Chancel::Central Nave Slab", (0, 0, -0.48), (12.4, 26.0, 0.85), stone, coll, 0.20)
    cube("Chancel::West Choir Bay", (-7.8, 0.8, -0.48), (3.2, 20.6, 0.85), stone, coll, 0.18)
    cube("Chancel::East Choir Bay", (7.8, -0.8, -0.48), (3.2, 20.6, 0.85), stone, coll, 0.18)
    cube("Chancel::Rear Transept", (0, 9.6, -0.47), (20.2, 5.5, 0.88), stone, coll, 0.20)
    cube("Chancel::Front Landing", (0, -11.6, -0.47), (16.0, 2.8, 0.88), stone, coll, 0.20)
    cube("Chancel::Central Aisle Inlay", (0, -1.2, 0.01), (3.1, 22.5, 0.10), violet, coll, 0.03)
    for side in (-1, 1):
        for idx, (y, length) in enumerate(((-5.8, 8.1), (5.9, 7.6))):
            cube(f"Chancel::Broken Edge::{side:+d}::{idx+1}", (side * 8.9, y, -1.45), (1.7, length, 2.5), stone, coll, 0.18)
    for x, y, length in [(-10.4, -7.5, 4.5), (10.4, -5.3, 5.0), (-10.2, 4.8, 4.0), (10.3, 6.3, 3.8)]:
        cone(f"Chancel::Void Buttress::{x:+.1f}::{y:+.1f}", (x, y, -2.0), 1.35, 0.62, length, stone, coll, 6, (0, 0, 0.18 if x > 0 else -0.18))

    # Choir pillars and side rails frame rather than obstruct the aisle.
    for side in (-1, 1):
        x = side * 7.4
        for idx, y in enumerate((-7.2, -1.7, 3.8, 8.0)):
            add_pillar(f"Chancel::Choir Pillar::{side:+d}::{idx+1}", x, y, 0.0, 3.3 + (idx % 2) * 0.45, (stone, gold, glow), coll, 0.72)
        cube(f"Chancel::Choir Rail::{side:+d}", (side * 6.15, -1.5, 1.0), (0.34, 19.2, 1.45), stone, coll, 0.10)
        for idx, y in enumerate((-8.0, -3.6, 0.8, 5.2)):
            add_candle_cluster(f"Chancel::Votive Cluster::{side:+d}::{idx+1}", side * 5.85, y, 1.75, wax, flame, coll)

    # Pointed arches at the apse and along the nave give a cathedral silhouette.
    arch("Chancel::Great Apse Arch", 11.35, 12.8, 9.1, 0.0, 0.34, gold, coll)
    arch("Chancel::Inner Apse Arch", 11.12, 8.8, 7.4, 0.8, 0.24, glow, coll)
    for side in (-1, 1):
        for idx, y in enumerate((-5.6, 0.0, 5.6)):
            arch(f"Chancel::Side Pointed Arch::{side:+d}::{idx+1}", y, 4.4, 6.1, 0.2, 0.22, violet, coll, side * 7.0)
    for side in (-1, 1):
        cube(f"Chancel::Apse Wall Wing::{side:+d}", (side * 4.8, 11.68, 3.7), (3.6, 0.72, 7.2), stone, coll, 0.16)
        arch(f"Chancel::Apse Lancet::{side:+d}", 11.28, 2.6, 5.1, 1.15, 0.16, violet, coll, side * 4.8)
        add_pillar(f"Chancel::Apse Buttress::{side:+d}", side * 9.25, 10.7, -0.05, 5.8, (stone, gold, glow), coll, 0.78)

    # Apse dais and altar sit at the destination, leaving the long approach unobstructed.
    cube("Chancel::Apse Platform", (0, 9.7, 0.36), (10.7, 5.1, 0.72), stone, coll, 0.16)
    cube("Chancel::Apse Step One", (0, 7.3, 0.18), (6.2, 1.25, 0.34), gold, coll, 0.08)
    cube("Chancel::Apse Step Two", (0, 8.0, 0.38), (5.2, 1.15, 0.54), violet, coll, 0.08)
    cube("Chancel::Altar Dais", (0, 10.0, 1.02), (3.5, 1.8, 1.12), stone, coll, 0.14)
    cylinder("Chancel::Reliquary Halo", (0, 10.85, 3.35), 1.15, 0.28, gold, coll, 24, 0.04, (math.pi / 2, 0, 0))
    sphere("Chancel::Apse Voidglass", (0, 10.70, 3.35), (0.72, 0.22, 1.28), glow, coll)
    return coll


def add_gate_pylon(prefix, x, y, base, height, mats, coll):
    obsidian, crimson, gold, glow = mats
    cube(f"{prefix}::Foundation", (x, y, base + 0.45), (2.3, 2.7, 0.9), obsidian, coll, 0.18)
    cube(f"{prefix}::Lower Pier", (x, y, base + 2.2), (1.65, 1.75, 3.1), crimson, coll, 0.16)
    cube(f"{prefix}::Upper Pier", (x, y, base + 5.2), (1.35, 1.50, 3.0), obsidian, coll, 0.14)
    cube(f"{prefix}::Gold Collar", (x, y, base + 6.85), (1.75, 1.9, 0.28), gold, coll, 0.07)
    cone(f"{prefix}::Ascendant Finial", (x, y, base + height - 0.6), 0.72, 0.04, 2.4, glow, coll, 8)


def build_gate():
    coll = bpy.data.collections.new("TERRAIN::gate-zenith")
    scene.collection.children.link(coll)
    obsidian = make_material("Gate Zenith::Storm Obsidian", (0.23, 0.10, 0.15), 0.48, 0.58)
    crimson = make_material("Gate Zenith::Processional Crimson", (0.76, 0.075, 0.10), 0.22, 0.48)
    gold = make_material("Gate Zenith::Ascendant Gold", (0.96, 0.58, 0.15), 0.88, 0.22)
    glow = make_material("Gate Zenith::Radiant Breach", (1.0, 0.30, 0.06), 0.12, 0.18, 5.4)
    ivory = make_material("Gate Zenith::Sigil Ivory", (1.0, 0.78, 0.38), 0.50, 0.28, 1.8)
    darkgold = make_material("Gate Zenith::Crown Darkgold", (0.58, 0.30, 0.08), 0.82, 0.30)

    # Tiered processional islands create negative-space corners and a broken ascendant outline.
    cube("Zenith::Central Processional Deck", (0, -0.5, -0.55), (11.8, 26.2, 1.05), obsidian, coll, 0.24)
    cube("Zenith::West Ascendant Wing", (-7.8, 1.9, -0.52), (4.2, 15.4, 1.0), obsidian, coll, 0.20)
    cube("Zenith::East Ascendant Wing", (7.8, 1.9, -0.52), (4.2, 15.4, 1.0), obsidian, coll, 0.20)
    cube("Zenith::West Front Bastion", (-7.8, -9.7, -0.52), (3.8, 4.6, 1.0), darkgold, coll, 0.18)
    cube("Zenith::East Front Bastion", (7.8, -8.7, -0.52), (3.8, 5.2, 1.0), darkgold, coll, 0.18)
    cube("Zenith::Gate Terrace", (0, 9.6, -0.50), (20.8, 6.5, 1.1), obsidian, coll, 0.24)
    cube("Zenith::Crimson Processional Way", (0, -2.2, 0.04), (3.25, 21.8, 0.12), crimson, coll, 0.03)
    for side in (-1, 1):
        for idx, y in enumerate((-6.5, 4.2)):
            cube(f"Zenith::Edge Parapet::{side:+d}::{idx+1}", (side * 9.25, y, 0.50), (1.1, 8.2, 1.1), darkgold, coll, 0.14)
        for idx, y in enumerate((-8.0, -2.5, 3.0)):
            add_pillar(f"Zenith::Processional Spire::{side:+d}::{idx+1}", side * 8.0, y, 0.0, 2.35 + idx * 0.2, (obsidian, gold, glow), coll, 0.58)
    # A raised circular seal court makes the mid-stage ascent legible from oblique view.
    for idx, (y, width, z) in enumerate(((-0.1, 10.8, 0.14), (0.75, 10.2, 0.30), (1.55, 9.6, 0.46))):
        cube(f"Zenith::Lower Ascent Stair::{idx+1}", (0, y, z), (width, 1.15, 0.28), darkgold if idx % 2 else obsidian, coll, 0.06)
        cube(f"Zenith::Lower Crimson Runner::{idx+1}", (0, y - 0.03, z + 0.16), (2.7, 1.05, 0.05), crimson, coll, 0.018)
    cube("Zenith::Raised Sigil Court", (0, 3.25, 0.38), (13.6, 5.4, 0.72), obsidian, coll, 0.16)
    for idx, (radius, minor, mat) in enumerate(((4.35, 0.16, gold), (3.30, 0.13, ivory), (2.20, 0.11, crimson))):
        torus(f"Zenith::Processional Plaza Ring::{idx+1}", (0, 3.25, 0.77 + idx * 0.015), radius, minor, mat, coll, rot=(0, 0, 0))

    # Broad low stairs preserve the center route while reading as an ascent.
    for idx, (y, width, z) in enumerate([(4.9, 10.0, 0.72), (5.8, 9.2, 0.94), (6.7, 8.4, 1.16), (7.6, 7.6, 1.38)]):
        cube(f"Zenith::Processional Stair::{idx+1}", (0, y, z), (width, 1.45, 0.40), obsidian if idx % 2 == 0 else darkgold, coll, 0.07)
        cube(f"Zenith::Crimson Stair Runner::{idx+1}", (0, y - 0.03, z + 0.22), (2.55, 1.35, 0.06), crimson, coll, 0.02)

    # Monumental gate pylons and high lintel frame the radiant destination.
    add_gate_pylon("Zenith::Outer Gate Pylon::West", -9.0, 8.2, 0.0, 9.4, (obsidian, crimson, gold, glow), coll)
    add_gate_pylon("Zenith::Outer Gate Pylon::East", 9.0, 8.2, 0.0, 9.4, (obsidian, crimson, gold, glow), coll)
    add_gate_pylon("Zenith::Gate Pylon::West", -6.35, 10.0, 0.0, 10.3, (obsidian, crimson, gold, glow), coll)
    add_gate_pylon("Zenith::Gate Pylon::East", 6.35, 10.0, 0.0, 10.3, (obsidian, crimson, gold, glow), coll)
    cube("Zenith::Gate Lintel", (0, 10.0, 8.65), (11.4, 1.65, 1.25), obsidian, coll, 0.18)
    arch("Zenith::Ascendant Gate Crest", 9.88, 12.6, 10.8, 0.7, 0.38, gold, coll)

    # Concentric vertical sigil rings and spokes produce the key stage read.
    for idx, (radius, minor, mat) in enumerate([(4.5, 0.25, darkgold), (3.55, 0.20, gold), (2.65, 0.16, ivory)]):
        torus(f"Zenith::Concentric Sigil Ring::{idx+1}", (0, 9.55 - idx * 0.08, 5.05), radius, minor, mat, coll)
    for idx, angle in enumerate(range(0, 180, 30)):
        rad = math.radians(angle)
        length = 8.0
        cube(
            f"Zenith::Sigil Spoke::{idx+1}",
            (0, 9.42, 5.05),
            (length, 0.18, 0.14),
            gold if idx % 2 == 0 else ivory,
            coll,
            0.035,
            (0, rad, 0),
        )
    sphere("Zenith::Radiant Breach Core", (0, 9.22, 5.05), (1.20, 0.42, 2.45), glow, coll)
    cylinder("Zenith::Breach Blade", (0, 8.84, 5.05), 0.28, 7.6, ivory, coll, 12, 0.04)

    # Floating shard crown breaks the skyline above the gate.
    crown_positions = [(-4.4, 9.3, 10.6, -0.42), (-2.7, 9.0, 11.4, -0.24), (-1.1, 8.8, 12.0, -0.10),
                       (1.1, 8.8, 12.0, 0.10), (2.7, 9.0, 11.4, 0.24), (4.4, 9.3, 10.6, 0.42)]
    for idx, (x, y, z, tilt) in enumerate(crown_positions):
        cone(f"Zenith::Floating Crown Shard::{idx+1}", (x, y, z), 0.56, 0.08, 2.7, glow if idx in (2, 3) else gold, coll, 6, (0, tilt, 0))
    return coll


def configure_camera(stage_id, mode):
    camera_data = bpy.data.cameras.get("Review Camera Data") or bpy.data.cameras.new("Review Camera Data")
    camera = bpy.data.objects.get("Review Camera") or bpy.data.objects.new("Review Camera", camera_data)
    if camera.name not in scene.collection.objects:
        scene.collection.objects.link(camera)
    scene.camera = camera
    camera.data.lens = 52 if mode == "oblique" else 58
    if mode == "oblique":
        camera.location = (23.0, -29.0, 20.0 if stage_id == "abyss-chancel" else 22.0)
        target = Vector((0, 1.0, 2.7 if stage_id == "abyss-chancel" else 3.8))
    else:
        camera.location = (0.0, -0.5, 39.0)
        target = Vector((0, -0.5, 0.0))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def ensure_lights(stage_id):
    for obj in list(bpy.data.objects):
        if obj.type == "LIGHT":
            bpy.data.objects.remove(obj, do_unlink=True)
    key_data = bpy.data.lights.new(f"{stage_id} Review Key", "AREA")
    key_data.energy = 3600
    key_data.shape = "DISK"
    key_data.size = 11.0
    key_data.color = (0.72, 0.58, 1.0) if stage_id == "abyss-chancel" else (1.0, 0.55, 0.32)
    key = bpy.data.objects.new(key_data.name, key_data)
    key.location = (-10, -10, 18)
    key.rotation_euler = (Vector((0, 1, 2.5)) - key.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(key)
    fill_data = bpy.data.lights.new(f"{stage_id} Review Fill", "AREA")
    fill_data.energy = 2800
    fill_data.size = 12.0
    fill_data.color = (0.25, 0.48, 1.0) if stage_id == "abyss-chancel" else (1.0, 0.72, 0.30)
    fill = bpy.data.objects.new(fill_data.name, fill_data)
    fill.location = (12, 5, 15)
    fill.rotation_euler = (Vector((0, 2, 3)) - fill.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(fill)
    rim_data = bpy.data.lights.new(f"{stage_id} Review Rim", "POINT")
    rim_data.energy = 1600
    rim_data.color = (0.52, 0.20, 1.0) if stage_id == "abyss-chancel" else (1.0, 0.24, 0.06)
    rim_data.shadow_soft_size = 3.0
    rim = bpy.data.objects.new(rim_data.name, rim_data)
    rim.location = (0, 9, 10)
    scene.collection.objects.link(rim)
    sun_data = bpy.data.lights.new(f"{stage_id} Review Sun", "SUN")
    sun_data.energy = 1.8
    sun_data.angle = math.radians(18)
    sun_data.color = (0.42, 0.38, 0.58) if stage_id == "abyss-chancel" else (0.58, 0.40, 0.30)
    sun = bpy.data.objects.new(sun_data.name, sun_data)
    sun.rotation_euler = (math.radians(28), math.radians(-22), math.radians(35))
    scene.collection.objects.link(sun)


def select_collection_meshes(coll):
    bpy.ops.object.select_all(action="DESELECT")
    meshes = [obj for obj in coll.all_objects if obj.type == "MESH"]
    for obj in meshes:
        obj.hide_render = False
        obj.hide_set(False)
        obj.select_set(True)
    if meshes:
        bpy.context.view_layer.objects.active = meshes[0]
    return meshes


def export_stage(stage_id, coll):
    meshes = select_collection_meshes(coll)
    out = OUT_DIR / f"{stage_id}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    if not out.is_file() or out.stat().st_size == 0:
        raise RuntimeError(f"Failed to export {out}")
    return out, meshes


def render_preview(stage_id, target_coll, mode):
    for coll in (chancel, gate):
        coll.hide_render = coll != target_coll
    ensure_lights(stage_id)
    configure_camera(stage_id, mode)
    path = QA_DIR / f"abyss-chancel-gate-zenith.{stage_id}-{mode}.png"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    if not path.is_file() or path.stat().st_size < 10000:
        raise RuntimeError(f"Preview render failed: {path}")
    return path


def read_glb(path):
    raw = path.read_bytes()
    if raw[:4] != b"glTF" or len(raw) < 20:
        raise RuntimeError(f"Not a GLB: {path}")
    version, declared = struct.unpack_from("<II", raw, 4)
    if version != 2 or declared != len(raw):
        raise RuntimeError(f"Invalid GLB header: {path}")
    offset = 12
    document = None
    while offset < len(raw):
        length, chunk_type = struct.unpack_from("<II", raw, offset)
        offset += 8
        chunk = raw[offset:offset + length]
        offset += length
        if chunk_type == 0x4E4F534A:
            document = json.loads(chunk.rstrip(b" \t\r\n\0"))
    if document is None:
        raise RuntimeError(f"Missing JSON chunk: {path}")
    return document


def accessor_bounds(doc, accessor_index):
    accessor = doc["accessors"][accessor_index]
    return accessor.get("min"), accessor.get("max")


def audit(stage_id, path, preview_paths):
    doc = read_glb(path)
    primitives = [primitive for mesh in doc.get("meshes", []) for primitive in mesh.get("primitives", [])]
    primitive_checks = []
    mins = [float("inf")] * 3
    maxs = [float("-inf")] * 3
    for primitive in primitives:
        attrs = primitive.get("attributes", {})
        pmin, pmax = accessor_bounds(doc, attrs["POSITION"])
        for axis in range(3):
            mins[axis] = min(mins[axis], pmin[axis])
            maxs[axis] = max(maxs[axis], pmax[axis])
        primitive_checks.append({
            "hasNormals": "NORMAL" in attrs,
            "hasUv0": "TEXCOORD_0" in attrs,
            "hasMaterial": "material" in primitive,
        })
    materials = doc.get("materials", [])
    images = doc.get("images", [])
    embedded_images = [img for img in images if "bufferView" in img]
    normal_mapped = [mat for mat in materials if "normalTexture" in mat]
    dimensions = [maxs[i] - mins[i] for i in range(3)]
    checks = {
        "glbParses": True,
        "meshPrimitiveCountAtLeast20": len(primitives) >= 20,
        "materialCountAtLeast4": len(materials) >= 4,
        "everyPrimitiveHasNormalsUvsMaterial": all(all(row.values()) for row in primitive_checks),
        "embeddedTextureImages": len(embedded_images) >= 2,
        "normalMappedMaterials": len(normal_mapped) >= 4,
        "nonDegenerate3dBounds": all(value > 0.01 for value in dimensions),
        "previewFilesNonEmpty": all(p.is_file() and p.stat().st_size > 10000 for p in preview_paths),
    }
    if not all(checks.values()):
        raise RuntimeError(f"Audit failed for {stage_id}: {checks}")
    return {
        "stageId": stage_id,
        "glb": str(path.relative_to(REPO)),
        "bytes": path.stat().st_size,
        "meshCount": len(doc.get("meshes", [])),
        "meshPrimitiveCount": len(primitives),
        "materialCount": len(materials),
        "embeddedImageCount": len(embedded_images),
        "normalMappedMaterialCount": len(normal_mapped),
        "boundsMin": mins,
        "boundsMax": maxs,
        "dimensions": dimensions,
        "previews": [str(p.relative_to(REPO)) for p in preview_paths],
        "checks": checks,
    }


chancel = build_chancel()
gate = build_gate()
for coll in (chancel, gate):
    for obj in coll.all_objects:
        ensure_uv_normals(obj)

chancel_path, chancel_meshes = export_stage("abyss-chancel", chancel)
gate_path, gate_meshes = export_stage("gate-zenith", gate)

bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND))
chancel_previews = [render_preview("abyss-chancel", chancel, mode) for mode in ("oblique", "top")]
gate_previews = [render_preview("gate-zenith", gate, mode) for mode in ("oblique", "top")]

evidence = {
    "authoringScript": str(Path(__file__).resolve().relative_to(REPO)),
    "sourceBlend": str(SOURCE_BLEND.relative_to(REPO)),
    "sharedTextures": [str(ALBEDO_PATH.relative_to(REPO)), str(NORMAL_PATH.relative_to(REPO))],
    "stages": [
        audit("abyss-chancel", chancel_path, chancel_previews),
        audit("gate-zenith", gate_path, gate_previews),
    ],
}
EVIDENCE_PATH.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
print(json.dumps(evidence, indent=2))
