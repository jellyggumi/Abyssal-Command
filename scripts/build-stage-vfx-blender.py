#!/usr/bin/env python3
"""Build looping stage VFX GLBs and review previews for stages 1-3.

Run with Blender, not system Python:

  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/build-stage-vfx-blender.py -- \
    --output-dir assets/motion/stage-vfx

The source atlas is a visual reference only. It is recorded in provenance and
never embedded, copied, or sampled into the exported GLBs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = REPO_ROOT / "assets/motion/stage-vfx"
REFERENCE_ATLAS = "assets/mesh/prop/prop-sprite-sheet-single-object.03.png"
FPS = 24

EFFECTS = (
    {
        "stageId": "cinder-span",
        "effectId": "cinder-span-ember-wake",
        "durationSeconds": 4.0,
        "palette": {"core": "#FFBB66", "accent": "#F23A20", "shadow": "#301018"},
        "meaning": "Ambient extraction-beacon landmark; cosmetic and non-authoritative.",
        "silhouette": "Lantern core, seal ring, cross-wind ember wake.",
        "reducedMotion": "Keep the static lantern and seal ring; hide moving ash and ember decor.",
    },
    {
        "stageId": "abyss-chancel",
        "effectId": "abyss-chancel-mirror-static",
        "durationSeconds": 5.0,
        "palette": {"core": "#74E4FF", "accent": "#008BC2", "shadow": "#061A2C"},
        "meaning": "Ambient oath beacon showing the chancel's mirror-static sightline; cosmetic only.",
        "silhouette": "Rift lens, twin scan rings, offset mirror shards.",
        "reducedMotion": "Keep the static rift lens and scan frame; hide static filaments and shards.",
    },
    {
        "stageId": "echo-throne",
        "effectId": "echo-throne-fracture-echo",
        "durationSeconds": 6.0,
        "palette": {"core": "#C7A6FF", "accent": "#6B36C9", "shadow": "#150925"},
        "meaning": "Ambient throne-aisle beacon expressing echoes and fractures; cosmetic only.",
        "silhouette": "Caged lantern core, three echo rings, crown-like fractures.",
        "reducedMotion": "Keep the static lantern and innermost echo ring; hide fracture drift and motes.",
    },
)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    return parser.parse_args(argv)


def hex_rgba(value: str) -> tuple[float, float, float, float]:
    value = value.lstrip("#")
    return tuple(int(value[index : index + 2], 16) / 255.0 for index in (0, 2, 4)) + (1.0,)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 432
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("stage-vfx-world")
    scene.world.color = (0.003, 0.005, 0.014)
    scene.view_settings.look = "None"
    scene.view_settings.view_transform = "Standard"
    scene.render.fps = FPS


def make_material(name: str, color: str, emission_strength: float, metallic: float = 0.2, roughness: float = 0.28):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = hex_rgba(color)
    material.metallic = metallic
    material.roughness = roughness
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    rgba = hex_rgba(color)
    if bsdf is not None:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Metallic IOR Level" if "Metallic IOR Level" in bsdf.inputs else "Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        emission_name = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
        strength_name = "Emission Strength"
        bsdf.inputs[emission_name].default_value = rgba
        if strength_name in bsdf.inputs:
            bsdf.inputs[strength_name].default_value = emission_strength
    return material


def attach_material(obj, material) -> None:
    if getattr(obj, "data", None) is not None and hasattr(obj.data, "materials"):
        obj.data.materials.append(material)


def empty(name: str, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def activate(obj) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def cube(name: str, parent, loc, scale, material, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.parent = parent
    attach_material(obj, material)
    return obj


def ico(name: str, parent, loc, radius, material, scale=(1.0, 1.0, 1.0), subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.parent = parent
    attach_material(obj, material)
    return obj


def torus(name: str, parent, loc, major_radius, minor_radius, material, rotation=(0.0, 0.0, 0.0), scale=(1.0, 1.0, 1.0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=32,
        minor_segments=6,
        location=loc,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.parent = parent
    attach_material(obj, material)
    return obj


def cone(name: str, parent, loc, radius, depth, material, vertices=5, rotation=(0.0, 0.0, 0.0), scale=(1.0, 1.0, 1.0)):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius,
        radius2=0.0,
        depth=depth,
        location=loc,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.parent = parent
    attach_material(obj, material)
    return obj


def cylinder(name: str, parent, loc, radius, depth, material, vertices=8, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=loc,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    attach_material(obj, material)
    return obj


def curve_ribbon(name: str, parent, points, material, bevel_depth=0.022):
    curve_data = bpy.data.curves.new(name, "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 1
    curve_data.bevel_depth = bevel_depth
    curve_data.bevel_resolution = 1
    spline = curve_data.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    attach_material(obj, material)
    return obj


def add_lantern(parent, core_material, frame_material, prefix: str, height=1.25):
    ico(f"{prefix}-flame", parent, (0, 0, height), 0.24, core_material, scale=(0.72, 0.72, 1.28), subdivisions=2)
    torus(f"{prefix}-cage-mid", parent, (0, 0, height), 0.34, 0.035, frame_material, rotation=(math.pi / 2, 0, 0))
    torus(f"{prefix}-cage-top", parent, (0, 0, height + 0.34), 0.22, 0.03, frame_material, rotation=(math.pi / 2, 0, 0))
    torus(f"{prefix}-cage-base", parent, (0, 0, height - 0.34), 0.22, 0.03, frame_material, rotation=(math.pi / 2, 0, 0))
    for angle in (0, math.pi / 2, math.pi, math.pi * 1.5):
        cylinder(
            f"{prefix}-cage-bar-{round(angle, 2)}",
            parent,
            (0.29 * math.cos(angle), 0.29 * math.sin(angle), height),
            0.025,
            0.7,
            frame_material,
            vertices=6,
        )


def build_cinder(effect, groups, mats):
    core, detail, decor = groups
    add_lantern(core, mats["core"], mats["frame"], "cinder-lantern", height=1.15)
    torus("cinder-seal-ring", core, (0, 0, 0.06), 1.2, 0.055, mats["accent"])
    torus("cinder-seal-ring-inner", core, (0, 0, 0.08), 0.76, 0.035, mats["core"])
    for side in (-1, 1):
        points = []
        for index in range(10):
            t = index / 9
            points.append((-2.2 + 4.4 * t, side * (0.55 + math.sin(t * math.pi * 2) * 0.18), 0.32 + t * 0.4))
        curve_ribbon(f"cinder-ash-stream-{side}", detail, points, mats["accent"], 0.035)
    for index in range(12):
        angle = index * math.tau / 12
        radius = 0.9 + (index % 3) * 0.5
        cone(
            f"cinder-ember-{index:02d}",
            decor,
            (math.cos(angle) * radius, math.sin(angle) * radius, 0.35 + (index % 4) * 0.33),
            0.07,
            0.25,
            mats["accent"],
            vertices=4,
            rotation=(0.18 * (index % 2), 0.24, -angle),
        )


def build_veil(effect, groups, mats):
    core, detail, decor = groups
    ico("veil-rift-lens", core, (0, 0, 1.1), 0.46, mats["core"], scale=(0.38, 1.0, 1.0), subdivisions=2)
    torus("veil-scan-ring-x", core, (0, 0, 1.1), 0.86, 0.035, mats["accent"], rotation=(0, math.pi / 2, 0), scale=(1.0, 1.0, 1.25))
    torus("veil-scan-ring-z", core, (0, 0, 1.1), 1.18, 0.028, mats["core"], rotation=(math.pi / 2, 0, 0), scale=(1.0, 0.78, 1.0))
    for index in range(8):
        angle = index * math.tau / 8 + 0.2
        radius = 1.2 + (index % 2) * 0.45
        cube(
            f"veil-mirror-shard-{index:02d}",
            detail,
            (math.cos(angle) * radius, math.sin(angle) * radius, 0.7 + (index % 3) * 0.34),
            (0.08, 0.26, 0.42),
            mats["frame"],
            rotation=(angle * 0.24, angle * 0.13, angle),
        )
    for line in range(5):
        points = []
        for index in range(7):
            x = -1.9 + index * 0.63
            y = -0.75 + line * 0.38 + (0.14 if index % 2 else -0.08)
            z = 0.2 + ((index + line) % 3) * 0.24
            points.append((x, y, z))
        curve_ribbon(f"veil-static-filament-{line:02d}", decor, points, mats["accent"], 0.018)


def build_echo(effect, groups, mats):
    core, detail, decor = groups
    add_lantern(core, mats["core"], mats["frame"], "echo-lantern", height=1.2)
    for index, radius in enumerate((0.82, 1.26, 1.72)):
        torus(
            f"echo-resonance-ring-{index}",
            core if index == 0 else detail,
            (0, 0, 0.12 + index * 0.1),
            radius,
            0.035 - index * 0.006,
            mats["core"] if index == 0 else mats["accent"],
            scale=(1.0, 0.72 + index * 0.07, 1.0),
        )
    for index in range(9):
        angle = -1.15 + index * 0.285
        radius = 1.42
        cone(
            f"echo-fracture-crown-{index:02d}",
            detail,
            (math.sin(angle) * radius, math.cos(angle) * radius * 0.62, 1.0 + abs(math.sin(angle)) * 0.72),
            0.12,
            0.68 + (index % 3) * 0.18,
            mats["accent"],
            vertices=4,
            rotation=(0.18, angle * 0.45, -angle),
        )
    for index in range(12):
        angle = index * math.tau / 12
        ico(
            f"echo-mote-{index:02d}",
            decor,
            (math.cos(angle) * (1.0 + (index % 4) * 0.34), math.sin(angle) * (0.8 + (index % 3) * 0.26), 0.35 + (index % 5) * 0.32),
            0.06,
            mats["core" if index % 3 == 0 else "accent"],
            scale=(0.5, 0.5, 1.6),
        )


def animate_root(root, effect):
    duration_frames = round(effect["durationSeconds"] * FPS)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = duration_frames
    root.rotation_euler = (0.0, 0.0, 0.0)
    root.scale = (0.985, 0.985, 0.985)
    root.keyframe_insert(data_path="rotation_euler", frame=1)
    root.keyframe_insert(data_path="scale", frame=1)
    root.rotation_euler.z = math.pi
    root.scale = (1.03, 1.03, 1.03)
    root.keyframe_insert(data_path="rotation_euler", frame=duration_frames // 2)
    root.keyframe_insert(data_path="scale", frame=duration_frames // 2)
    root.rotation_euler.z = math.tau
    root.scale = (0.985, 0.985, 0.985)
    root.keyframe_insert(data_path="rotation_euler", frame=duration_frames)
    root.keyframe_insert(data_path="scale", frame=duration_frames)
    action = root.animation_data.action
    action.name = f"stage-vfx::{effect['stageId']}::loop::v01"
    return duration_frames


def look_at(obj, point=(0.0, 0.0, 0.9)):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_preview_lighting(effect):
    world = bpy.context.scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.0015, 0.002, 0.008, 1.0)
    background.inputs["Strength"].default_value = 0.12

    bpy.ops.object.light_add(type="AREA", location=(4.5, -4.0, 6.0))
    key = bpy.context.object
    key.name = "preview-key"
    key.data.energy = 350
    key.data.shape = "DISK"
    key.data.size = 5.0
    key.data.color = hex_rgba(effect["palette"]["core"])[:3]
    look_at(key)

    bpy.ops.object.light_add(type="AREA", location=(-4.0, 2.5, 3.5))
    rim = bpy.context.object
    rim.name = "preview-rim"
    rim.data.energy = 250
    rim.data.size = 4.0
    rim.data.color = hex_rgba(effect["palette"]["accent"])[:3]
    look_at(rim)

    bpy.ops.object.camera_add(location=(5.8, -7.2, 4.7))
    camera = bpy.context.object
    camera.name = "preview-camera"
    camera.data.lens = 56
    look_at(camera, (0.0, 0.0, 1.0))
    bpy.context.scene.camera = camera


def build_effect(effect, output_dir: Path) -> dict:
    reset_scene()
    root = empty(f"{effect['effectId']}-root")
    core = empty("vfx-core", root)
    detail = empty("vfx-detail", root)
    decor = empty("vfx-decor", root)

    mats = {
        "core": make_material(f"{effect['effectId']}-core", effect["palette"]["core"], 1.2, metallic=0.05, roughness=0.18),
        "accent": make_material(f"{effect['effectId']}-accent", effect["palette"]["accent"], 1.5, metallic=0.15, roughness=0.24),
        "frame": make_material(f"{effect['effectId']}-frame", effect["palette"]["shadow"], 0.1, metallic=0.7, roughness=0.32),
    }

    builders = {
        "cinder-span": build_cinder,
        "abyss-chancel": build_veil,
        "echo-throne": build_echo,
    }
    builders[effect["stageId"]](effect, (core, detail, decor), mats)
    duration_frames = animate_root(root, effect)

    output_dir.mkdir(parents=True, exist_ok=True)
    glb_path = output_dir / f"{effect['effectId']}.glb"
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_frame_range=True,
        export_force_sampling=True,
    )

    setup_preview_lighting(effect)
    bpy.context.scene.frame_set(max(1, duration_frames // 4))
    preview_path = output_dir / "qa" / f"{effect['effectId']}-preview.png"
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(preview_path)
    bpy.ops.render.render(write_still=True)

    glb_hash = sha256(glb_path)
    preview_hash = sha256(preview_path)
    asset_path = glb_path.relative_to(REPO_ROOT).as_posix()
    preview_rel = preview_path.relative_to(REPO_ROOT).as_posix()
    provenance = {
        "schemaVersion": 1,
        "assetId": effect["effectId"],
        "stageId": effect["stageId"],
        "generator": "scripts/build-stage-vfx-blender.py",
        "tool": f"Blender {bpy.app.version_string}",
        "reference": {"path": REFERENCE_ATLAS, "usage": "silhouette-and-material-language-only", "embedded": False},
        "rightsReceipt": "Repository-authored deterministic procedural geometry; no third-party media embedded.",
        "runtimeReceipt": {"runtimeEligible": True, "reason": "Self-contained GLB, bounded geometry, authored quality groups, and loop clip."},
        "output": {"path": asset_path, "sha256": glb_hash},
    }
    write_json(glb_path.with_suffix(".provenance.json"), provenance)
    write_json(
        preview_path.with_suffix(".provenance.json"),
        {
            "schemaVersion": 1,
            "assetId": f"{effect['effectId']}-preview",
            "generator": "scripts/build-stage-vfx-blender.py",
            "source": asset_path,
            "reference": REFERENCE_ATLAS,
            "runtimeEligible": False,
            "output": {"path": preview_rel, "sha256": preview_hash},
        },
    )
    return {
        **effect,
        "path": asset_path,
        "sha256": glb_hash,
        "clip": f"stage-vfx::{effect['stageId']}::loop::v01",
        "fps": FPS,
        "frameRange": [1, duration_frames],
        "spawnCap": 1,
        "qualityGroups": {"core": "vfx-core", "detail": "vfx-detail", "decor": "vfx-decor"},
        "qualityPolicy": {"high": ["core", "detail", "decor"], "balanced": ["core", "detail"], "low": ["core"]},
        "cleanupRule": "Stop the mixer and dispose cloned geometry/material resources on stage change or renderer disposal.",
        "reference": REFERENCE_ATLAS,
        "preview": preview_rel,
    }


def main() -> None:
    args = parse_args()
    output_dir = args.output_dir.resolve()
    entries = [build_effect(effect, output_dir) for effect in EFFECTS]
    manifest = {
        "schemaVersion": 1,
        "generatedBy": "scripts/build-stage-vfx-blender.py",
        "reference": {"path": REFERENCE_ATLAS, "embedded": False},
        "effects": entries,
    }
    manifest_path = output_dir / "manifest.json"
    write_json(manifest_path, manifest)
    print(
        "STAGE_VFX_BUILD_OK",
        "effects=" + str(len(entries)),
        "manifest=" + manifest_path.relative_to(REPO_ROOT).as_posix(),
    )


if __name__ == "__main__":
    main()
