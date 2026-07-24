#!/usr/bin/env python3
"""
Builds the Solo Warden RPG cycle's world-content pack: terrain (stages 4-10),
characters (7 bosses + 6 companions), items (3 reward props + 5 equipment-tier
gems), and VFX (6 effects tied to shipped telemetry events).

Run headless against the canonical resource pack, writes a NEW file
(does not mutate the shared canonical pack other workstreams reference):

  /Applications/Blender.app/Contents/MacOS/Blender --background \
    assets/models/abyssal-command/abyssal-command-resource-pack.blend \
    --python scripts/build-world-content-pack.py -- \
    --out _workspace/20260723-solo-warden-rpg-concept/production/world-content-pack.blend

Style match (verified against existing warden-*/cinder-*/extractor-* objects
this session): low-poly primitives (Cone/Cube/Cylinder/Icosphere/Torus), one
mesh datablock per part, named materials from a shared palette, root EMPTY
per entity, one Collection per entity.
"""
import argparse
import math
import os
import sys

import bpy


# ---------------------------------------------------------------------------
# Arg parsing (Blender passes its own args before "--")
# ---------------------------------------------------------------------------
def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    return p.parse_args(argv)


# ---------------------------------------------------------------------------
# Material palette: reuse existing 10 + add themed materials for stages 4-10
# ---------------------------------------------------------------------------
EXISTING_MATERIALS = {
    "Ash Cloth": (0.340, 0.310, 0.380, 1.0, 0.00, 0.94),
    "Cinder Ember": (0.900, 0.100, 0.025, 1.0, 0.05, 0.28),
    "Cold Steel": (0.170, 0.190, 0.280, 1.0, 0.72, 0.32),
    "Cyan Rift": (0.025, 0.420, 0.670, 1.0, 0.10, 0.20),
    "Gate Gold": (0.750, 0.340, 0.050, 1.0, 0.78, 0.25),
    "Obsidian": (0.095, 0.075, 0.145, 1.0, 0.48, 0.26),
    "Old Bone": (0.540, 0.480, 0.370, 1.0, 0.00, 0.70),
    "Violet Ether": (0.250, 0.055, 0.550, 1.0, 0.12, 0.26),
    "Void Obsidian": (0.045, 0.025, 0.105, 1.0, 0.32, 0.32),
}

# New materials, one thematic accent per stage-4..10 / companion / item family,
# grounded in each stage's cutscene lore (defense-catalog.js CUTSCENES) and
# the storyboard prompts already authored this cycle
# (design/defense-rpg-cinematic-arc.md).
NEW_MATERIALS = {
    # Stage 4 Sunken Bastion / Tide Warden -- "가라앉은 보루", "조류의 명령"
    "Tide Teal": (0.055, 0.320, 0.310, 1.0, 0.15, 0.30),
    "Barnacle Grey": (0.420, 0.440, 0.400, 1.0, 0.05, 0.75),
    # Stage 5 Howling Sprawl / Pack Herald -- "울부짖는 황야", "바람길"
    "Dust Tan": (0.560, 0.460, 0.310, 1.0, 0.00, 0.85),
    "Windworn Bone": (0.620, 0.560, 0.460, 1.0, 0.00, 0.60),
    # Stage 6 Glass Necropolis / Requiem Choir -- "유리 묘역", "반사되는 사선"
    "Glass Shard": (0.680, 0.720, 0.780, 0.55, 0.20, 0.05),
    "Choir Silver": (0.720, 0.700, 0.760, 1.0, 0.60, 0.18),
    # Stage 7 Starless Canal / Lantern Tyrant -- "별 없는 운하", "잠긴 수문"
    "Starless Indigo": (0.045, 0.035, 0.140, 1.0, 0.05, 0.35),
    "Lantern Amber": (0.850, 0.520, 0.080, 1.0, 0.10, 0.22),
    # Stage 8 Shattered Causeway / Bridge Colossus -- "부서진 둑길", "거상의 압력"
    "Causeway Rust": (0.420, 0.190, 0.080, 1.0, 0.35, 0.55),
    "Colossus Slate": (0.230, 0.230, 0.250, 1.0, 0.20, 0.60),
    # Stage 9 Abyss Chancel / Veiled Concordat -- "서약", "명령 잔향을 역전"
    "Vow Violet": (0.320, 0.075, 0.420, 1.0, 0.15, 0.24),
    "Concordat Gold": (0.680, 0.560, 0.180, 1.0, 0.55, 0.28),
    # Stage 10 Gate Zenith / Abyss Regent -- "명령망이 끊겼다", crimson sigil throne
    "Regent Crimson": (0.560, 0.045, 0.060, 1.0, 0.10, 0.24),
    "Zenith Void Gold": (0.720, 0.580, 0.140, 1.0, 0.72, 0.20),
    # Companion accents (distinct from boss materials at same thematic root)
    "Ember Cohort Orange": (0.850, 0.340, 0.070, 1.0, 0.08, 0.32),
    "Rift Lens Cyan": (0.075, 0.560, 0.720, 1.0, 0.15, 0.18),
    "Vanguard Iron": (0.260, 0.280, 0.340, 1.0, 0.55, 0.40),
    "Anchor Shard Blue": (0.090, 0.260, 0.360, 1.0, 0.20, 0.30),
    "Echo Ghost Violet": (0.360, 0.220, 0.560, 0.75, 0.10, 0.22),
    "Moonless Silver": (0.560, 0.580, 0.640, 1.0, 0.40, 0.30),
    # VFX accents
    "Critical Flash": (1.000, 0.870, 0.230, 1.0, 0.00, 0.05),
    "Ward Shield Cyan": (0.120, 0.680, 0.820, 0.55, 0.05, 0.05),
    "Awakening Violet": (0.480, 0.140, 0.780, 0.65, 0.05, 0.05),
}


def _unlink_broken_image_textures(mat):
    """Disconnect outgoing links from any Image Texture node whose image is
    missing or unresolvable on disk, so the Principled BSDF falls back to
    its (correctly set) default_value instead of rendering solid magenta.
    Pre-existing defect in reused canonical materials (Obsidian, Cold Steel,
    etc. all reference textures/*.png files that don't exist in the repo) --
    fixed here so every rebuild is self-contained, not a one-off patch.
    """
    if mat.node_tree is None:
        return 0
    removed = 0
    for node in mat.node_tree.nodes:
        if node.type != "TEX_IMAGE":
            continue
        broken = node.image is None
        if not broken and node.image.packed_file is None:
            abspath = bpy.path.abspath(node.image.filepath, library=node.image.library)
            broken = not os.path.exists(abspath)
        if not broken:
            continue
        for link in list(mat.node_tree.links):
            if link.from_node == node:
                mat.node_tree.links.remove(link)
                removed += 1
    return removed


def ensure_materials():
    all_mats = dict(EXISTING_MATERIALS)
    all_mats.update(NEW_MATERIALS)
    for name, (r, g, b, a, metallic, roughness) in all_mats.items():
        mat = bpy.data.materials.get(name)
        if mat is None:
            mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        _unlink_broken_image_textures(mat)
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf is not None:
            bsdf.inputs["Base Color"].default_value = (r, g, b, a)
            bsdf.inputs["Metallic"].default_value = metallic
            bsdf.inputs["Roughness"].default_value = roughness
            if "Alpha" in bsdf.inputs:
                bsdf.inputs["Alpha"].default_value = a
        if a < 1.0:
            mat.blend_method = "BLEND"
    return {name: bpy.data.materials[name] for name in all_mats}


# ---------------------------------------------------------------------------
# Parametric primitive helpers (name, position, rotation, material -> Object)
# ---------------------------------------------------------------------------
def _link(obj, collection):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def make_cone(name, collection, loc, rot=(0, 0, 0), scale=(1, 1, 1),
              material=None, radius1=0.5, radius2=0.0, depth=1.0, vertices=12):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=radius1, radius2=radius2, depth=depth,
        location=loc, rotation=rot,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    obj.scale = scale
    if material is not None:
        obj.data.materials.append(material)
    return _link(obj, collection)


def make_cube(name, collection, loc, rot=(0, 0, 0), scale=(1, 1, 1), material=None, size=1.0):
    bpy.ops.mesh.primitive_cube_add(size=size, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    obj.scale = scale
    if material is not None:
        obj.data.materials.append(material)
    return _link(obj, collection)


def make_cylinder(name, collection, loc, rot=(0, 0, 0), scale=(1, 1, 1),
                   material=None, radius=0.5, depth=1.0, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    obj.scale = scale
    if material is not None:
        obj.data.materials.append(material)
    return _link(obj, collection)


def make_icosphere(name, collection, loc, rot=(0, 0, 0), scale=(1, 1, 1),
                    material=None, radius=0.5, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions, radius=radius, location=loc, rotation=rot,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    obj.scale = scale
    if material is not None:
        obj.data.materials.append(material)
    return _link(obj, collection)


def make_torus(name, collection, loc, rot=(0, 0, 0), scale=(1, 1, 1),
               material=None, major_radius=0.5, minor_radius=0.1,
               major_segments=24, minor_segments=8):
    bpy.ops.mesh.primitive_torus_add(
        location=loc, rotation=rot, major_radius=major_radius, minor_radius=minor_radius,
        major_segments=major_segments, minor_segments=minor_segments,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    obj.scale = scale
    if material is not None:
        obj.data.materials.append(material)
    return _link(obj, collection)


def make_root(name, collection, loc=(0, 0, 0)):
    empty = bpy.data.objects.new(name, None)
    empty.location = loc
    empty.empty_display_size = 0.3
    return _link(empty, collection)


def make_collection(name):
    existing = bpy.data.collections.get(name)
    if existing is not None:
        return existing
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


D = math.radians  # degrees -> radians shorthand


# ===========================================================================
# TERRAIN: stages 4-10 (7 sets). Each modeled as a compact stage-diorama
# matching the existing cinder-span/veil-citadel/echo-throne 3-6 piece pattern.
# ===========================================================================
def build_terrain(mats):
    # --- Stage 4: Sunken Bastion (flooded fortress, anchor motifs) ---
    coll = make_collection("sunken-bastion")
    root = make_root("sunken-bastion-root", coll)
    make_cube("bastion-flooded-floor", coll, (0, 0, -0.22), scale=(2.2, 1.4, 0.14), material=mats["Tide Teal"])
    make_cube("bastion-left-rampart", coll, (-1.195, 0, 0.05), scale=(0.35, 1.3, 0.55), material=mats["Barnacle Grey"])
    make_cube("bastion-right-rampart", coll, (1.195, 0, 0.05), scale=(0.35, 1.3, 0.55), material=mats["Barnacle Grey"])
    make_cylinder("bastion-anchor-post-0", coll, (-0.6, 0.3, 0.28), rot=(D(8), 0, 0), radius=0.09, depth=0.7, material=mats["Cold Steel"])
    make_cylinder("bastion-anchor-post-1", coll, (0.6, -0.3, 0.28), rot=(D(-8), 0, 0), radius=0.09, depth=0.7, material=mats["Cold Steel"])
    make_torus("bastion-tide-ring", coll, (0, 0, -0.1), rot=(D(90), 0, 0), major_radius=0.9, minor_radius=0.04, material=mats["Cyan Rift"])
    root.name = root.name  # keep root last-referenced for lint clarity

    # --- Stage 5: Howling Sprawl (windswept flank wasteland) ---
    coll = make_collection("howling-sprawl")
    make_root("howling-sprawl-root", coll)
    make_cube("sprawl-cracked-ground", coll, (0, 0, -0.2), scale=(2.4, 1.6, 0.1), material=mats["Dust Tan"])
    make_cone("sprawl-windrock-0", coll, (-1.3, 0.4, 0.1), rot=(0, D(12), 0), radius1=0.35, radius2=0.15, depth=0.6, material=mats["Windworn Bone"])
    make_cone("sprawl-windrock-1", coll, (1.1, -0.5, 0.05), rot=(0, D(-18), 0), radius1=0.3, radius2=0.12, depth=0.45, material=mats["Windworn Bone"])
    make_cone("sprawl-windrock-2", coll, (0.2, 0.7, 0.02), rot=(0, D(6), 0), radius1=0.22, radius2=0.08, depth=0.3, material=mats["Dust Tan"])
    make_cylinder("sprawl-flank-marker", coll, (-0.4, -0.6, 0.25), radius=0.05, depth=0.9, material=mats["Old Bone"])

    # --- Stage 6: Glass Necropolis (elevated reflective sightlines) ---
    coll = make_collection("glass-necropolis")
    make_root("glass-necropolis-root", coll)
    make_cylinder("necropolis-high-plateau", coll, (0, 0, 0.18), radius=1.0, depth=0.28, vertices=8, material=mats["Choir Silver"])
    make_cube("necropolis-glass-panel-0", coll, (-0.65, 0.4, 0.5), rot=(0, D(20), D(8)), scale=(0.5, 0.02, 0.55), material=mats["Glass Shard"])
    make_cube("necropolis-glass-panel-1", coll, (0.55, -0.3, 0.46), rot=(0, D(-15), D(-6)), scale=(0.45, 0.02, 0.5), material=mats["Glass Shard"])
    make_cube("necropolis-record-slab", coll, (0.1, 0.55, 0.08), rot=(D(6), 0, 0), scale=(0.3, 0.02, 0.4), material=mats["Old Bone"])
    make_cone("necropolis-spire", coll, (-0.2, -0.5, 0.7), radius1=0.14, radius2=0.02, depth=0.9, material=mats["Choir Silver"])

    # --- Stage 7: Starless Canal (locked floodgate waterway) ---
    coll = make_collection("starless-canal")
    make_root("starless-canal-root", coll)
    make_cube("canal-channel-floor", coll, (0, 0, -0.24), scale=(2.6, 0.6, 0.1), material=mats["Starless Indigo"])
    make_cube("canal-left-bank", coll, (0, 0.47, -0.05), scale=(2.6, 0.5, 0.3), material=mats["Colossus Slate"])
    make_cube("canal-right-bank", coll, (0, -0.47, -0.05), scale=(2.6, 0.5, 0.3), material=mats["Colossus Slate"])
    make_cube("canal-floodgate", coll, (0.9, 0, 0.005), scale=(0.06, 0.62, 0.55), material=mats["Cold Steel"])
    make_icosphere("canal-lantern-0", coll, (-1.0, 0.35, 0.35), radius=0.09, material=mats["Lantern Amber"])
    make_icosphere("canal-lantern-1", coll, (-1.0, -0.35, 0.35), radius=0.09, material=mats["Lantern Amber"])
    make_cylinder("canal-lantern-post-0", coll, (-1.0, 0.35, 0.18), radius=0.025, depth=0.28, material=mats["Cold Steel"])
    make_cylinder("canal-lantern-post-1", coll, (-1.0, -0.35, 0.18), radius=0.025, depth=0.28, material=mats["Cold Steel"])

    # --- Stage 8: Shattered Causeway (collapsed bridge, colossus scale) ---
    coll = make_collection("shattered-causeway")
    make_root("shattered-causeway-root", coll)
    make_cube("causeway-left-span", coll, (-1.1, 0, 0.05), scale=(0.8, 0.4, 0.14), material=mats["Causeway Rust"])
    make_cube("causeway-right-span", coll, (1.1, 0, 0.05), scale=(0.8, 0.4, 0.14), material=mats["Causeway Rust"])
    make_cube("causeway-collapse-shard-0", coll, (-0.15, 0.2, -0.1), rot=(D(18), D(6), D(-10)), scale=(0.28, 0.28, 0.06), material=mats["Colossus Slate"])
    make_cube("causeway-collapse-shard-1", coll, (0.2, -0.25, -0.18), rot=(D(-24), D(-4), D(14)), scale=(0.22, 0.22, 0.06), material=mats["Colossus Slate"])
    make_cylinder("causeway-support-pillar", coll, (0, 0, -0.5), radius=0.18, depth=0.7, vertices=8, material=mats["Cold Steel"])

    # --- Stage 9: Abyss Chancel (vow-bound diplomatic chapel) ---
    coll = make_collection("abyss-chancel")
    make_root("abyss-chancel-root", coll)
    make_cylinder("chancel-floor", coll, (0, 0, -0.18), radius=1.05, depth=0.16, vertices=10, material=mats["Vow Violet"])
    make_cone("chancel-pillar-0", coll, (-0.75, 0.55, 0.17), radius1=0.1, radius2=0.1, depth=0.7, material=mats["Concordat Gold"])
    make_cone("chancel-pillar-1", coll, (0.75, 0.55, 0.17), radius1=0.1, radius2=0.1, depth=0.7, material=mats["Concordat Gold"])
    make_cone("chancel-pillar-2", coll, (-0.75, -0.55, 0.17), radius1=0.1, radius2=0.1, depth=0.7, material=mats["Concordat Gold"])
    make_cone("chancel-pillar-3", coll, (0.75, -0.55, 0.17), radius1=0.1, radius2=0.1, depth=0.7, material=mats["Concordat Gold"])
    make_torus("chancel-vow-seal", coll, (0, 0, 0.02), rot=(D(90), 0, 0), major_radius=0.4, minor_radius=0.03, material=mats["Gate Gold"])

    # --- Stage 10: Gate Zenith (final gate, regent's command network) ---
    coll = make_collection("gate-zenith")
    make_root("gate-zenith-root", coll)
    make_cylinder("zenith-dais", coll, (0, 0, -0.1), radius=1.15, depth=0.2, vertices=12, material=mats["Obsidian"])
    make_torus("zenith-gate-ring-outer", coll, (0, 0, 0.9), rot=(D(90), 0, 0), major_radius=1.0, minor_radius=0.08, material=mats["Zenith Void Gold"])
    make_torus("zenith-gate-ring-inner", coll, (0, 0, 0.9), rot=(D(90), 0, 0), major_radius=0.78, minor_radius=0.04, material=mats["Regent Crimson"])
    make_cone("zenith-sigil-spike-0", coll, (-0.9, 0, 0.3), rot=(0, D(90), 0), radius1=0.12, radius2=0.0, depth=0.4, material=mats["Regent Crimson"])
    make_cone("zenith-sigil-spike-1", coll, (0.9, 0, 0.3), rot=(0, D(-90), 0), radius1=0.12, radius2=0.0, depth=0.4, material=mats["Regent Crimson"])
    make_icosphere("zenith-echo-deep-core", coll, (0, 0, 0.9), radius=0.14, material=mats["Void Obsidian"])
    make_cylinder("zenith-core-pillar", coll, (0, 0, 0.38), radius=0.025, depth=0.82, material=mats["Void Obsidian"])


# ===========================================================================
# CHARACTERS: 7 bosses (stages 4-10) + 6 companions
# ===========================================================================
def build_bosses(mats):
    # s4-tide-warden -- anchor/water, gate-pressure policy, radius 980
    coll = make_collection("tide-warden")
    make_root("tide-warden-root", coll)
    make_cylinder("tide-torso", coll, (0, 0, 1.1), radius=0.34, depth=0.95, material=mats["Tide Teal"])
    make_icosphere("tide-head", coll, (0, 0, 2.2), radius=0.26, material=mats["Barnacle Grey"])
    make_cone("tide-anchor-horn-0", coll, (-0.3, 0, 2.55), rot=(0, D(-40), 0), radius1=0.08, radius2=0.01, depth=0.45, material=mats["Cold Steel"])
    make_cone("tide-anchor-horn-1", coll, (0.3, 0, 2.55), rot=(0, D(40), 0), radius1=0.08, radius2=0.01, depth=0.45, material=mats["Cold Steel"])
    make_cylinder("tide-trident-shaft", coll, (0.85, 0, 1.25), rot=(0, D(-18), 0), radius=0.045, depth=1.35, material=mats["Old Bone"])
    make_cone("tide-trident-head", coll, (0.6012, 0, 2.0156), rot=(0, D(-18), 0), radius1=0.14, radius2=0.02, depth=0.32, material=mats["Cold Steel"])
    make_cylinder("tide-trident-grip", coll, (0.6993, 0, 0.6165), rot=(0, D(91.35), 0), radius=0.03, depth=0.7788, material=mats["Old Bone"])
    make_torus("tide-tide-ring", coll, (0, 0, 1.4), rot=(D(90), 0, 0), major_radius=0.5, minor_radius=0.05, material=mats["Cyan Rift"])
    make_icosphere("tide-barnacle-shoulder-0", coll, (-0.4, 0, 1.55), radius=0.1, material=mats["Barnacle Grey"])
    make_icosphere("tide-barnacle-shoulder-1", coll, (0.4, 0, 1.55), radius=0.1, material=mats["Barnacle Grey"])

    # s5-pack-herald -- wolf-pack/wind, flank policy, speed 2100 (fastest), radius 900
    coll = make_collection("pack-herald")
    make_root("pack-herald-root", coll)
    make_cone("herald-torso", coll, (0, 0, 1.0), radius1=0.3, radius2=0.2, depth=0.85, material=mats["Dust Tan"])
    make_icosphere("herald-head", coll, (0, 0, 1.615), radius=0.24, material=mats["Windworn Bone"])
    make_cone("herald-ear-0", coll, (-0.15, 0, 2.015), rot=(0, D(-15), 0), radius1=0.06, radius2=0.0, depth=0.28, material=mats["Windworn Bone"])
    make_cone("herald-ear-1", coll, (0.15, 0, 2.015), rot=(0, D(15), 0), radius1=0.06, radius2=0.0, depth=0.28, material=mats["Windworn Bone"])
    make_cube("herald-cloak-tatter-0", coll, (-0.25, -0.1, 1.1), rot=(D(10), 0, D(-8)), scale=(0.12, 0.02, 0.55), material=mats["Ash Cloth"])
    make_cube("herald-cloak-tatter-1", coll, (0.28, -0.1, 1.05), rot=(D(-6), 0, D(10)), scale=(0.12, 0.02, 0.5), material=mats["Ash Cloth"])
    make_cube("herald-cloak-tatter-2", coll, (0.02, -0.14, 0.95), rot=(D(4), 0, 0), scale=(0.14, 0.02, 0.45), material=mats["Ash Cloth"])
    make_cylinder("herald-horn-prop", coll, (0.55, 0, 1.35), rot=(0, D(40), 0), radius=0.06, depth=0.4, material=mats["Old Bone"])
    make_torus("herald-pack-mark", coll, (0, 0, 1.15), rot=(D(90), 0, 0), major_radius=0.34, minor_radius=0.025, material=mats["Cinder Ember"])

    # s6-requiem-choir -- glass/choir, low-hp-focus policy, radius 980
    coll = make_collection("requiem-choir")
    make_root("requiem-choir-root", coll)
    make_cone("choir-veil-outer", coll, (0, 0, 1.15), radius1=0.42, radius2=0.24, depth=1.1, material=mats["Ash Cloth"])
    make_cone("choir-torso", coll, (0, 0, 1.05), radius1=0.28, radius2=0.16, depth=0.9, material=mats["Choir Silver"])
    make_icosphere("choir-head", coll, (0, 0, 1.89), radius=0.24, material=mats["Old Bone"])
    make_cone("choir-halo-shard-0", coll, (-0.32, 0.05, 2.0511), rot=(D(70), 0, D(-20)), radius1=0.08, radius2=0.0, depth=0.22, material=mats["Glass Shard"])
    make_cone("choir-halo-shard-1", coll, (0.34, 0.03, 2.0204), rot=(D(75), 0, D(24)), radius1=0.07, radius2=0.0, depth=0.2, material=mats["Glass Shard"])
    make_cone("choir-halo-shard-2", coll, (0.0, -0.1, 2.238), rot=(D(60), 0, 0), radius1=0.09, radius2=0.0, depth=0.24, material=mats["Glass Shard"])
    make_cube("choir-songbook", coll, (0.2703, 0, 1.2), rot=(0, D(-30), 0), scale=(0.22, 0.16, 0.02), material=mats["Old Bone"])

    # s7-lantern-tyrant -- lantern/floodgate, resource-denial policy, radius 980
    coll = make_collection("lantern-tyrant")
    make_root("lantern-tyrant-root", coll)
    make_cylinder("tyrant-torso", coll, (0, 0, 1.15), radius=0.33, depth=1.0, material=mats["Starless Indigo"])
    make_icosphere("tyrant-head", coll, (0, 0, 2.25), radius=0.25, material=mats["Colossus Slate"])
    make_icosphere("tyrant-lantern-0", coll, (-0.55, 0.15, 1.7), radius=0.11, material=mats["Lantern Amber"])
    make_icosphere("tyrant-lantern-1", coll, (0.55, -0.15, 1.7), radius=0.11, material=mats["Lantern Amber"])
    make_cylinder("tyrant-lantern-chain-0", coll, (-0.3964, 0.1081, 1.7332), rot=(D(-14.93), D(-102.18), 0), radius=0.015, depth=0.1952, material=mats["Cold Steel"])
    make_cylinder("tyrant-lantern-chain-1", coll, (0.3964, -0.1081, 1.7332), rot=(D(14.93), D(102.18), 0), radius=0.015, depth=0.1952, material=mats["Cold Steel"])
    make_cone("tyrant-hook-arm", coll, (0.7, 0, 1.15), rot=(0, D(60), 0), radius1=0.06, radius2=0.02, depth=0.75, material=mats["Cold Steel"])
    make_torus("tyrant-gate-collar", coll, (0, 0, 1.75), rot=(D(90), 0, 0), major_radius=0.36, minor_radius=0.04, material=mats["Lantern Amber"])

    # s8-bridge-colossus -- colossus/rust, gate-pressure policy, radius 1100 (largest), damage 300
    coll = make_collection("bridge-colossus")
    make_root("bridge-colossus-root", coll)
    make_cube("colossus-torso", coll, (0, 0, 1.3), scale=(0.42, 0.3, 0.75), material=mats["Colossus Slate"])
    make_cube("colossus-head", coll, (0, 0, 1.705), scale=(0.15, 0.15, 0.16), material=mats["Causeway Rust"])
    make_cube("colossus-shoulder-0", coll, (-0.55, 0, 1.725), scale=(0.22, 0.24, 0.2), material=mats["Causeway Rust"])
    make_cube("colossus-shoulder-1", coll, (0.55, 0, 1.725), scale=(0.22, 0.24, 0.2), material=mats["Causeway Rust"])
    make_cube("colossus-fist-0", coll, (-0.62, 0, 0.85), scale=(0.16, 0.16, 0.18), material=mats["Colossus Slate"])
    make_cube("colossus-fist-1", coll, (0.62, 0, 0.85), scale=(0.16, 0.16, 0.18), material=mats["Colossus Slate"])
    make_cylinder("colossus-arm-0", coll, (-0.585, 0, 1.2825), rot=(0, D(-174.17), 0), radius=0.09, depth=0.7886, material=mats["Causeway Rust"])
    make_cylinder("colossus-arm-1", coll, (0.585, 0, 1.2825), rot=(0, D(174.17), 0), radius=0.09, depth=0.7886, material=mats["Causeway Rust"])
    make_cylinder("colossus-clavicle-0", coll, (-0.325, 0, 1.65), rot=(0, D(90), 0), radius=0.08, depth=0.33, material=mats["Causeway Rust"])
    make_cylinder("colossus-clavicle-1", coll, (0.325, 0, 1.65), rot=(0, D(90), 0), radius=0.08, depth=0.33, material=mats["Causeway Rust"])
    make_cylinder("colossus-crack-vein-0", coll, (-0.1, 0.28, 1.5), rot=(D(90), 0, D(12)), radius=0.02, depth=0.55, material=mats["Cinder Ember"])
    make_cylinder("colossus-crack-vein-1", coll, (0.12, 0.28, 1.15), rot=(D(90), 0, D(-8)), radius=0.02, depth=0.4, material=mats["Cinder Ember"])

    # s9-veiled-concordat -- diplomatic/vow, elite-escort policy, radius 1040
    coll = make_collection("veiled-concordat")
    make_root("veiled-concordat-root", coll)
    make_cone("concordat-torso", coll, (0, 0, 1.1), radius1=0.3, radius2=0.15, depth=0.95, material=mats["Vow Violet"])
    make_icosphere("concordat-head", coll, (0, 0, 2.15), radius=0.25, material=mats["Old Bone"])
    make_cone("concordat-veil-half-0", coll, (-0.18, 0.05, 1.6), rot=(0, D(-8), D(-4)), radius1=0.24, radius2=0.05, depth=0.9, material=mats["Vow Violet"])
    make_cone("concordat-veil-half-1", coll, (0.18, 0.05, 1.6), rot=(0, D(8), D(4)), radius1=0.24, radius2=0.05, depth=0.9, material=mats["Concordat Gold"])
    make_torus("concordat-seal-ring", coll, (0, 0, 1.45), rot=(D(90), 0, 0), major_radius=0.38, minor_radius=0.035, material=mats["Gate Gold"])
    make_cylinder("concordat-scale-beam", coll, (0, 0, 1.9), rot=(0, 0, D(90)), radius=0.02, depth=0.55, material=mats["Cold Steel"])
    make_icosphere("concordat-scale-pan-0", coll, (-0.27, 0, 1.78), radius=0.06, material=mats["Concordat Gold"])
    make_icosphere("concordat-scale-pan-1", coll, (0.27, 0, 1.78), radius=0.06, material=mats["Vow Violet"])

    # s10-abyss-regent -- final boss, regal crimson-gold-void, player-pursuit, radius 1100, hp 150000
    coll = make_collection("abyss-regent")
    make_root("abyss-regent-root", coll)
    make_cone("regent-torso", coll, (0, 0, 1.3), radius1=0.4, radius2=0.2, depth=1.15, material=mats["Regent Crimson"])
    make_icosphere("regent-head", coll, (0, 0, 2.55), radius=0.27, material=mats["Old Bone"])
    for i, ang in enumerate((-0.7, -0.35, 0.0, 0.35, 0.7)):
        make_cone(f"regent-crown-spike-{i}", coll, (ang * 0.55, 0.03, 3.0 - abs(ang) * 0.25),
                  rot=(0, ang * 0.6, 0), radius1=0.06, radius2=0.0, depth=0.4, material=mats["Zenith Void Gold"])
    make_cone("regent-wing-0", coll, (-1.05, 0.05, 2.0), rot=(0, D(-70), D(15)), radius1=0.35, radius2=0.02, depth=1.15, material=mats["Void Obsidian"])
    make_cone("regent-wing-1", coll, (1.05, 0.05, 2.0), rot=(0, D(70), D(-15)), radius1=0.35, radius2=0.02, depth=1.15, material=mats["Void Obsidian"])
    make_cylinder("regent-scepter-shaft", coll, (0.9, 0, 1.35), rot=(0, D(-16), 0), radius=0.045, depth=1.45, material=mats["Zenith Void Gold"])
    make_icosphere("regent-scepter-orb", coll, (1.3, 0, 2.05), radius=0.11, material=mats["Regent Crimson"])
    make_torus("regent-halo-ring", coll, (0, 0, 2.55), rot=(D(90), 0, 0), major_radius=0.55, minor_radius=0.05, material=mats["Zenith Void Gold"])


def build_companions(mats):
    # ember-cohort -- striker, echoes cinder-warden's ember at ally scale
    coll = make_collection("ember-cohort")
    make_root("ember-cohort-root", coll)
    make_cone("ember-body", coll, (0, 0, 0.62), radius1=0.2, radius2=0.13, depth=0.55, material=mats["Ember Cohort Orange"])
    make_icosphere("ember-head", coll, (0, 0, 1.15), radius=0.15, material=mats["Old Bone"])
    make_cylinder("ember-blade", coll, (0.32, 0, 0.72), rot=(0, D(-25), 0), radius=0.02, depth=0.6, material=mats["Cold Steel"])
    make_torus("ember-spark-ring", coll, (0, 0, 0.85), rot=(D(90), 0, 0), major_radius=0.24, minor_radius=0.025, material=mats["Cinder Ember"])

    # rift-lens -- striker, echoes rift-portal cyan
    coll = make_collection("rift-lens")
    make_root("rift-lens-root", coll)
    make_cylinder("lens-body", coll, (0, 0, 0.6), radius=0.16, depth=0.5, material=mats["Cold Steel"])
    make_icosphere("lens-head", coll, (0, 0, 1.1), radius=0.15, material=mats["Rift Lens Cyan"])
    make_torus("lens-eye-lens", coll, (0, -0.13, 1.1), rot=(D(90), 0, 0), major_radius=0.1, minor_radius=0.02, material=mats["Cyan Rift"])
    make_cylinder("lens-focus-rod", coll, (0.28, 0, 0.75), rot=(0, D(-20), 0), radius=0.018, depth=0.55, material=mats["Rift Lens Cyan"])

    # veil-vanguard -- vanguard, tanky shield
    coll = make_collection("veil-vanguard")
    make_root("veil-vanguard-root", coll)
    make_cube("vanguard-body", coll, (0, 0, 0.65), scale=(0.2, 0.16, 0.5), material=mats["Vanguard Iron"])
    make_icosphere("vanguard-head", coll, (0, 0, 1.01), radius=0.16, material=mats["Ash Cloth"])
    make_cube("vanguard-shield", coll, (-0.32, 0, 0.75), scale=(0.03, 0.24, 0.34), material=mats["Cold Steel"])
    make_cylinder("vanguard-shield-arm", coll, (-0.2025, 0, 0.75), rot=(0, D(90), 0), radius=0.025, depth=0.305, material=mats["Vanguard Iron"])
    make_cone("vanguard-veil-cape", coll, (0, -0.14, 0.5), radius1=0.16, radius2=0.06, depth=0.55, material=mats["Ash Cloth"])

    # anchor-shard -- vanguard, echoes tide-warden anchor motif
    coll = make_collection("anchor-shard")
    make_root("anchor-shard-root", coll)
    make_cylinder("anchor-body", coll, (0, 0, 0.62), radius=0.17, depth=0.55, material=mats["Anchor Shard Blue"])
    make_icosphere("anchor-head", coll, (0, 0, 1.015), radius=0.15, material=mats["Barnacle Grey"])
    make_cone("anchor-shard-shoulder-0", coll, (-0.2, 0, 0.88), rot=(0, D(-30), D(15)), radius1=0.07, radius2=0.0, depth=0.24, material=mats["Anchor Shard Blue"])
    make_cone("anchor-shard-shoulder-1", coll, (0.2, 0, 0.88), rot=(0, D(30), D(-15)), radius1=0.07, radius2=0.0, depth=0.24, material=mats["Anchor Shard Blue"])
    make_cone("anchor-hook-prop", coll, (0.3, 0, 0.55), rot=(0, D(70), 0), radius1=0.05, radius2=0.01, depth=0.32, material=mats["Cold Steel"])

    # throne-echo -- support, echoes echo-throne lineage
    coll = make_collection("throne-echo")
    make_root("throne-echo-root", coll)
    make_cone("throneecho-body", coll, (0, 0, 0.6), radius1=0.16, radius2=0.09, depth=0.55, material=mats["Echo Ghost Violet"])
    make_icosphere("throneecho-head", coll, (0, 0, 1.1), radius=0.14, material=mats["Old Bone"])
    make_torus("throneecho-echo-ring", coll, (0, 0, 0.8), rot=(D(90), 0, 0), major_radius=0.22, minor_radius=0.02, material=mats["Violet Ether"])
    make_cylinder("throneecho-staff", coll, (0.26, 0, 0.7), rot=(0, D(-18), 0), radius=0.016, depth=0.65, material=mats["Old Bone"])

    # dawnless-crown ("Moonless Command") -- support, modest crown motif
    coll = make_collection("dawnless-crown")
    make_root("dawnless-crown-root", coll)
    make_cone("dawnless-body", coll, (0, 0, 0.62), radius1=0.18, radius2=0.1, depth=0.55, material=mats["Moonless Silver"])
    make_icosphere("dawnless-head", coll, (0, 0, 0.995), radius=0.15, material=mats["Old Bone"])
    make_cone("dawnless-crown-spike-0", coll, (-0.08, 0, 1.195), rot=(0, D(-10), 0), radius1=0.03, radius2=0.0, depth=0.16, material=mats["Moonless Silver"])
    make_cone("dawnless-crown-spike-1", coll, (0.08, 0, 1.195), rot=(0, D(10), 0), radius1=0.03, radius2=0.0, depth=0.16, material=mats["Moonless Silver"])
    make_icosphere("dawnless-orb-prop", coll, (0.1215, 0, 0.85), radius=0.045, material=mats["Violet Ether"])


# ===========================================================================
# ITEMS: 3 reward props + 5 equipment-tier gems
# (gem vertex counts match styles.css .tier-icon[data-tier-vertices] exactly:
#  T1=0(circle) T2=3(triangle) T3=4(diamond) T4=5(pentagon) T5=6(hexagon))
# ===========================================================================
def build_items(mats):
    # stillwater-hourglass -- reward prop
    coll = make_collection("stillwater-hourglass")
    make_root("stillwater-hourglass-root", coll)
    make_cylinder("hourglass-cap-bottom", coll, (0, 0, 0.05), radius=0.18, depth=0.03, vertices=10, material=mats["Cold Steel"])
    make_cylinder("hourglass-cap-top", coll, (0, 0, 0.55), radius=0.18, depth=0.03, vertices=10, material=mats["Cold Steel"])
    make_cone("hourglass-bulb-lower", coll, (0, 0, 0.16), radius1=0.15, radius2=0.01, depth=0.22, material=mats["Cyan Rift"])
    make_cone("hourglass-bulb-upper", coll, (0, 0, 0.44), rot=(D(180), 0, 0), radius1=0.15, radius2=0.01, depth=0.22, material=mats["Cyan Rift"])
    make_cylinder("hourglass-post-0", coll, (0.16, 0.0, 0.3), radius=0.012, depth=0.5, material=mats["Cold Steel"])
    make_cylinder("hourglass-post-1", coll, (-0.16, 0.0, 0.3), radius=0.012, depth=0.5, material=mats["Cold Steel"])
    make_icosphere("hourglass-sand-pool", coll, (0, 0, 0.09), scale=(1, 1, 0.4), radius=0.1, material=mats["Lantern Amber"])

    # bulwark-brand -- reward prop, "gate breach damage reduction"
    coll = make_collection("bulwark-brand")
    make_root("bulwark-brand-root", coll)
    make_cylinder("brand-shield-face", coll, (0, 0, 0.3), rot=(D(90), 0, 0), radius=0.22, depth=0.03, vertices=8, material=mats["Cold Steel"])
    make_torus("brand-rune-mark", coll, (0, -0.02, 0.3), rot=(D(90), 0, 0), major_radius=0.13, minor_radius=0.015, material=mats["Gate Gold"])
    make_cylinder("brand-handle", coll, (0, -0.06, 0.3), rot=(D(90), 0, 0), radius=0.025, depth=0.14, material=mats["Old Bone"])

    # abyssal-banner -- reward prop, "companion damage bonus"
    coll = make_collection("abyssal-banner")
    make_root("abyssal-banner-root", coll)
    make_cylinder("banner-pole", coll, (0, 0, 0.45), radius=0.02, depth=0.9, material=mats["Void Obsidian"])
    make_cube("banner-cloth", coll, (0.08, 0, 0.65), scale=(0.18, 0.005, 0.22), material=mats["Violet Ether"])
    make_icosphere("banner-finial", coll, (0, 0, 0.93), radius=0.05, material=mats["Gate Gold"])
    make_cone("banner-tassel-0", coll, (0.12, 0, 0.52), radius1=0.015, radius2=0.0, depth=0.1, material=mats["Violet Ether"])
    make_cone("banner-tassel-1", coll, (0.05, 0, 0.53), radius1=0.012, radius2=0.0, depth=0.08, material=mats["Violet Ether"])

    # Equipment-tier gems -- vertex counts match styles.css exactly.
    coll = make_collection("equipment-tier-gems")
    make_root("equipment-tier-gems-root", coll)
    tier_mats = [mats["Cold Steel"], mats["Choir Silver"], mats["Cyan Rift"], mats["Vow Violet"], mats["Gate Gold"]]
    make_icosphere("gem-t1-echo-bound", coll, (-1.6, 0, 0.12), radius=0.12, subdivisions=2, material=tier_mats[0])
    make_cone("gem-t2-umbral-etched", coll, (-0.8, 0, 0.12), radius1=0.13, radius2=0.13, depth=0.16, vertices=3, material=tier_mats[1])
    # Diamond (4 vertices, bipyramid silhouette): two cones base-to-base
    make_cone("gem-t3-void-forged-top", coll, (0.0, 0, 0.2), radius1=0.13, radius2=0.0, depth=0.16, vertices=4, material=tier_mats[2])
    make_cone("gem-t3-void-forged-bottom", coll, (0.0, 0, 0.04), rot=(D(180), 0, 0), radius1=0.13, radius2=0.0, depth=0.16, vertices=4, material=tier_mats[2])
    make_cone("gem-t4-abyss-tempered", coll, (0.8, 0, 0.12), radius1=0.14, radius2=0.14, depth=0.16, vertices=5, material=tier_mats[3])
    make_cylinder("gem-t5-court-sealed", coll, (1.6, 0, 0.12), radius=0.14, depth=0.16, vertices=6, material=tier_mats[4])


# ===========================================================================
# VFX: 6 effects tied to shipped telemetry events (defense-run-simulation.js)
# ===========================================================================
def build_vfx(mats):
    # critical-hit-burst -- CRITICAL_HIT event: radiating spikes + bright core
    coll = make_collection("vfx-critical-hit-burst")
    make_root("vfx-critical-hit-burst-root", coll)
    make_icosphere("critical-core", coll, (0, 0, 0), radius=0.08, material=mats["Critical Flash"])
    for i in range(8):
        ang = i * (360.0 / 8)
        rad = D(ang)
        x, y = 0.22 * math.cos(rad), 0.22 * math.sin(rad)
        make_cone(f"critical-spike-{i}", coll, (x, y, 0), rot=(D(90), 0, rad + D(90)),
                  radius1=0.035, radius2=0.0, depth=0.28, material=mats["Critical Flash"])

    # boss-rally-aura -- BOSS_RALLY_WINDOW event: gold double-ring pulse
    coll = make_collection("vfx-boss-rally-aura")
    make_root("vfx-boss-rally-aura-root", coll)
    make_torus("rally-ring-outer", coll, (0, 0, 0), rot=(D(90), 0, 0), major_radius=0.5, minor_radius=0.03, material=mats["Gate Gold"])
    make_torus("rally-ring-inner", coll, (0, 0, 0), rot=(D(90), 0, 0), major_radius=0.32, minor_radius=0.02, material=mats["Critical Flash"])

    # gate-breach-shockwave -- GATE_BREACHED event: flattened ring + scattered shards
    coll = make_collection("vfx-gate-breach-shockwave")
    make_root("vfx-gate-breach-shockwave-root", coll)
    make_torus("breach-shockwave-ring", coll, (0, 0, 0), rot=(D(90), 0, 0), scale=(1, 1, 0.15),
               major_radius=0.55, minor_radius=0.07, material=mats["Cold Steel"])
    for i in range(5):
        ang = D(i * 72 + 20)
        x, y = 0.4 * math.cos(ang), 0.4 * math.sin(ang)
        make_cube(f"breach-shard-{i}", coll, (x, y, 0.02), rot=(D(15 * i), D(8 * i), ang),
                  scale=(0.08, 0.08, 0.015), material=mats["Colossus Slate"])

    # wardens-ward-shield -- WARDENS_WARD_TRIGGERED event: dome shield
    coll = make_collection("vfx-wardens-ward-shield")
    make_root("vfx-wardens-ward-shield-root", coll)
    make_icosphere("ward-dome", coll, (0, 0, 0), radius=0.5, subdivisions=2, material=mats["Ward Shield Cyan"])
    make_torus("ward-rim-ring", coll, (0, 0, 0), rot=(D(90), 0, 0), major_radius=0.5, minor_radius=0.025, material=mats["Cyan Rift"])

    # echo-warden-awakening -- ECHO_WARDEN_AWAKENING_TRIGGERED event: concentric burst
    coll = make_collection("vfx-echo-warden-awakening")
    make_root("vfx-echo-warden-awakening-root", coll)
    make_icosphere("awakening-flare-core", coll, (0, 0, 0), radius=0.1, material=mats["Awakening Violet"])
    for i, r in enumerate((0.22, 0.36, 0.5)):
        make_torus(f"awakening-ring-{i}", coll, (0, 0, 0), rot=(D(90), 0, 0),
                   major_radius=r, minor_radius=0.018, material=mats["Violet Ether"])

    # companion-downed-fade -- COMPANION_DOWNED event: somber X-cross marker
    coll = make_collection("vfx-companion-downed-fade")
    make_root("vfx-companion-downed-fade-root", coll)
    make_cube("downed-cross-0", coll, (0, 0, 0), rot=(0, 0, D(45)), scale=(0.22, 0.02, 0.02), material=mats["Void Obsidian"])
    make_cube("downed-cross-1", coll, (0, 0, 0), rot=(0, 0, D(-45)), scale=(0.22, 0.02, 0.02), material=mats["Void Obsidian"])


# ===========================================================================
# COMMANDER: player character (Dusk Warden). Absent from the canonical pack
# (verified: 0 orphan objects, no commander/player collection) -- matches the
# shipped concept art (assets/images/battle/pilot/dusk-warden-idle-gti.png):
# dark plate armor, crown-spike helm, trailing cape, cyan-lit core, lantern
# + curved blade props. Reuses Void Obsidian/Cyan Rift/Zenith Void Gold/Cold
# Steel for palette continuity with the rest of the pack.
# ===========================================================================
def build_commander(mats):
    coll = make_collection("dusk-warden")
    make_root("dusk-warden-root", coll)
    make_cylinder("warden-torso", coll, (0, 0, 1.05), radius=0.26, depth=0.75, material=mats["Void Obsidian"])
    make_icosphere("warden-head", coll, (0, 0, 1.585), radius=0.19, material=mats["Void Obsidian"])
    make_cone("warden-cape", coll, (0, -0.12, 0.62), radius1=0.34, radius2=0.1, depth=1.05, material=mats["Void Obsidian"])
    make_torus("warden-core", coll, (0, 0.24, 1.1), rot=(D(90), 0, 0), major_radius=0.09, minor_radius=0.018, material=mats["Cyan Rift"])
    for i, ang in enumerate((-0.6, -0.2, 0.2, 0.6)):
        make_cone(f"warden-crown-spike-{i}", coll, (ang * 0.16, 0.02, 1.885 - abs(ang) * 0.1),
                  rot=(0, ang * 0.7, 0), radius1=0.035, radius2=0.0, depth=0.24, material=mats["Zenith Void Gold"])
    make_cone("warden-shoulder-0", coll, (-0.32, 0, 1.32), rot=(0, D(-25), D(10)), radius1=0.11, radius2=0.03, depth=0.22, material=mats["Zenith Void Gold"])
    make_cone("warden-shoulder-1", coll, (0.32, 0, 1.32), rot=(0, D(25), D(-10)), radius1=0.11, radius2=0.03, depth=0.22, material=mats["Zenith Void Gold"])
    make_cylinder("warden-lantern-chain", coll, (-0.4, 0, 1.0), radius=0.01, depth=0.4, material=mats["Cold Steel"])
    make_cylinder("warden-lantern-body", coll, (-0.4, 0, 0.76), radius=0.07, depth=0.16, vertices=8, material=mats["Zenith Void Gold"])
    make_icosphere("warden-lantern-flame", coll, (-0.4, 0, 0.76), radius=0.045, material=mats["Cyan Rift"])
    make_cylinder("warden-blade-shaft", coll, (0.42, 0, 0.85), rot=(0, D(-16), 0), radius=0.025, depth=0.9, material=mats["Void Obsidian"])
    make_cone("warden-blade-tip", coll, (0.2381, 0, 1.4844), rot=(0, D(-16), 0), radius1=0.09, radius2=0.0, depth=0.36, material=mats["Cold Steel"])


# ===========================================================================
# Main
# ===========================================================================
def main():
    args = parse_args()
    mats = ensure_materials()

    build_terrain(mats)
    build_bosses(mats)
    build_companions(mats)
    build_commander(mats)
    build_items(mats)
    build_vfx(mats)

    bpy.ops.wm.save_as_mainfile(filepath=args.out)

    new_collections = [
        "sunken-bastion", "howling-sprawl", "glass-necropolis", "starless-canal",
        "shattered-causeway", "abyss-chancel", "gate-zenith",
        "tide-warden", "pack-herald", "requiem-choir", "lantern-tyrant",
        "bridge-colossus", "veiled-concordat", "abyss-regent",
        "ember-cohort", "rift-lens", "veil-vanguard", "anchor-shard",
        "throne-echo", "dawnless-crown", "dusk-warden",
        "stillwater-hourglass", "bulwark-brand", "abyssal-banner", "equipment-tier-gems",
        "vfx-critical-hit-burst", "vfx-boss-rally-aura", "vfx-gate-breach-shockwave",
        "vfx-wardens-ward-shield", "vfx-echo-warden-awakening", "vfx-companion-downed-fade",
    ]
    total_objects = sum(len(bpy.data.collections[c].objects) for c in new_collections)
    print(f"BUILD_SUMMARY collections={len(new_collections)} objects={total_objects} out={args.out}")


if __name__ == "__main__":
    main()
