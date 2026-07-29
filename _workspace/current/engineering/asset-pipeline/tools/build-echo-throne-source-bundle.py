#!/usr/bin/env python3
"""Build a portable, source-only Echo Throne terrain bundle in Blender.

The terrain is an authored planar grid with a generated tileable albedo. The
background, feature, and loose-object sheets are retained as alpha-blended billboard
components after alpha-threshold segmentation: one independently exportable OBJ per
component, plus one packed GLB per layer. Those billboards are source references,
not collision geometry.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import os
import shutil
from statistics import median
import sys
from pathlib import Path

import bpy


PIPELINE_PATH = Path(__file__).resolve().with_name("build-abyss-chancel-terrain.py")
PROJECT_ROOT = PIPELINE_PATH.parents[5]
TERRAIN_SIZE = 8.0
TERRAIN_SEGMENTS = 32


def load_pipeline():
    spec = importlib.util.spec_from_file_location("abyss_chancel_pipeline", PIPELINE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load pipeline module: {PIPELINE_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pipeline = load_pipeline()


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--terrain-image", type=Path, required=True)
    parser.add_argument("--terrain-albedo", type=Path, required=True)
    parser.add_argument("--terrain-provenance", type=Path, required=True)
    parser.add_argument("--background-terrain-image", type=Path, required=True)
    parser.add_argument("--feature-image", type=Path, required=True)
    parser.add_argument("--background-object-image", type=Path, required=True)
    parser.add_argument("--component-spec", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    return parser.parse_args(argv)


def require_file(path: Path, label: str) -> Path:
    resolved = path.resolve()
    if not resolved.is_file():
        raise RuntimeError(f"{label} is missing: {resolved}")
    return resolved


def relative(path: Path) -> str:
    resolved = path.resolve()
    try:
        return str(resolved.relative_to(PROJECT_ROOT))
    except ValueError as error:
        raise RuntimeError(f"path is outside repository: {resolved}") from error


def receipt(path: Path) -> dict[str, str | int]:
    resolved = path.resolve()
    payload = resolved.read_bytes()
    return {
        "path": relative(resolved),
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
    }


def copy_texture(source: Path, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return destination


def image_material(name: str, texture: Path, *, alpha_cutout: bool):
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (520, 0)
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.location = (240, 0)
    shader.inputs["Roughness"].default_value = 0.72
    shader.inputs["Metallic"].default_value = 0.08
    texcoord = nodes.new("ShaderNodeTexCoord")
    texcoord.location = (-520, 0)
    texture_node = nodes.new("ShaderNodeTexImage")
    texture_node.location = (-280, 0)
    texture_node.image = bpy.data.images.load(str(texture), check_existing=True)
    links.new(texcoord.outputs["UV"], texture_node.inputs["Vector"])
    links.new(texture_node.outputs["Color"], shader.inputs["Base Color"])
    if alpha_cutout:
        links.new(texture_node.outputs["Alpha"], shader.inputs["Alpha"])
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED"
        elif hasattr(material, "blend_method"):
            material.blend_method = "CLIP"
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def create_terrain() -> object:
    vertices = []
    for z_index in range(TERRAIN_SEGMENTS + 1):
        z = -TERRAIN_SIZE / 2 + TERRAIN_SIZE * z_index / TERRAIN_SEGMENTS
        for x_index in range(TERRAIN_SEGMENTS + 1):
            x = -TERRAIN_SIZE / 2 + TERRAIN_SIZE * x_index / TERRAIN_SEGMENTS
            vertices.append((x, 0.0, z))
    row_width = TERRAIN_SEGMENTS + 1
    faces = []
    for z_index in range(TERRAIN_SEGMENTS):
        for x_index in range(TERRAIN_SEGMENTS):
            lower_left = z_index * row_width + x_index
            faces.append((lower_left, lower_left + row_width, lower_left + row_width + 1, lower_left + 1))
    mesh = bpy.data.meshes.new("TerrainEchoThrone_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        vertex = mesh.vertices[loop.vertex_index].co
        uv_layer.data[loop.index].uv = ((vertex.x + TERRAIN_SIZE / 2) / TERRAIN_SIZE, (vertex.z + TERRAIN_SIZE / 2) / TERRAIN_SIZE)
    terrain = bpy.data.objects.new("TerrainEchoThrone", mesh)
    bpy.context.collection.objects.link(terrain)
    return terrain


def create_component_card(name: str, component: dict, height: float, location: tuple[float, float, float], material) -> object:
    width = height * component["width"] / component["height"]
    vertices = [(-width / 2, 0.0, 0.0), (width / 2, 0.0, 0.0), (width / 2, 0.0, height), (-width / 2, 0.0, height)]
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], [(0, 3, 2, 1)])
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    u0, v0, u1, v1 = component["u0"], component["v0"], component["u1"], component["v1"]
    for loop, uv in zip(mesh.loops, ((u0, v0), (u0, v1), (u1, v1), (u1, v0))):
        uv_layer.data[loop.index].uv = uv
    mesh.materials.append(material)
    card = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(card)
    card.location = location
    return card


def select_many(objects: list) -> None:
    pipeline.deselect_all()
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def rewrite_mtl(path: Path, texture: Path, *, alpha_cutout: bool) -> None:
    texture_directory = os.path.relpath(texture.parent, start=path.parent)
    texture_target = (Path(texture_directory) / texture.name).as_posix()
    lines = path.read_text(encoding="utf-8").splitlines()
    rewritten = []
    inserted_alpha = False
    for line in lines:
        if line.startswith("map_Kd "):
            rewritten.append(f"map_Kd {texture_target}")
            if alpha_cutout:
                rewritten.append(f"map_d {texture_target}")
                inserted_alpha = True
        else:
            rewritten.append(line)
    if alpha_cutout and not inserted_alpha:
        rewritten.append(f"map_d {texture_target}")
    path.write_text("\n".join(rewritten) + "\n", encoding="utf-8")


def export_terrain(out: Path, albedo: Path) -> dict:
    terrain = create_terrain()
    material = image_material("echo_throne_terrain_albedo", albedo, alpha_cutout=False)
    terrain.data.materials.append(material)
    pipeline.select_only(terrain)
    obj_path = out / "terrain-echo-throne-textured.obj"
    glb_path = out / "terrain-echo-throne-textured.glb"
    pipeline.export_obj(obj_path)
    rewrite_mtl(obj_path.with_suffix(".mtl"), albedo, alpha_cutout=False)
    pipeline.export_glb(glb_path)
    return {
        "kind": "procedural-planar-grid",
        "object": pipeline.mesh_summary(terrain),
        "obj": receipt(obj_path),
        "mtl": receipt(obj_path.with_suffix(".mtl")),
        "glb": receipt(glb_path),
        "textureMappedUv": terrain.data.uv_layers.active.name,
    }


def export_component_layer(layer_id: str, spec: dict, texture: Path, out: Path, *, base_height: float, depth: float) -> dict:
    material = image_material(f"echo_throne_{layer_id}_alpha_cutout", texture, alpha_cutout=True)
    obj_dir = out / "obj"
    obj_dir.mkdir(parents=True, exist_ok=True)
    components = spec["components"]
    median_pixel_height = median(component["height"] for component in components)
    columns = max(1, math.ceil(math.sqrt(len(components))))
    objects = []
    records = []
    for component in components:
        index = component["id"]
        column = (index - 1) % columns
        row = (index - 1) // columns
        component_height = base_height * component["height"] / median_pixel_height
        location = (
            (column - (columns - 1) / 2) * base_height * 4.0,
            depth + row * base_height * 3.0,
            0.0,
        )
        name = f"terrain-echo-throne-{layer_id}-{index:03d}"
        obj = create_component_card(name, component, component_height, location, material)
        pipeline.select_only(obj)
        obj_path = obj_dir / f"{name}.obj"
        pipeline.export_obj(obj_path)
        rewrite_mtl(obj_path.with_suffix(".mtl"), texture, alpha_cutout=True)
        record = pipeline.mesh_summary(obj)
        record.update({
            "componentId": index,
            "relativeScale": round(component["height"] / median_pixel_height, 6),
            "sourceBoundsPx": {key: component[key] for key in ("minX", "minY", "maxX", "maxY", "width", "height", "pixels")},
            "sourceUvRect": {key: component[key] for key in ("u0", "v0", "u1", "v1")},
            "obj": receipt(obj_path),
            "mtl": receipt(obj_path.with_suffix(".mtl")),
            "textureMapped": True,
        })
        objects.append(obj)
        records.append(record)
    select_many(objects)
    glb_path = out / f"terrain-echo-throne-{layer_id}-billboards.glb"
    pipeline.export_glb(glb_path)
    return {
        "kind": "alpha-blended-billboard-components",
        "sourceImageSize": {"width": spec["width"], "height": spec["height"]},
        "alphaThreshold": spec["threshold"],
        "minimumPixels": spec["minimumPixels"],
        "componentsDetected": spec["componentCount"],
        "componentsRetained": len(records),
        "relativeSizing": {
            "baseHeight": base_height,
            "medianPixelHeight": median_pixel_height,
            "sourcePixelDimensionsPreserved": True,
        },
        "catalogPlacement": "grid layout for asset inspection only; source-sheet pixel positions are not world placement",
        "combinedGlb": receipt(glb_path),
        "objects": records,
        "collisionGeometry": False,
    }


def main() -> None:
    args = parse_args()
    terrain_image = require_file(args.terrain_image, "terrain reference image")
    terrain_albedo = require_file(args.terrain_albedo, "terrain albedo")
    terrain_provenance = require_file(args.terrain_provenance, "terrain albedo provenance")
    background_terrain_image = require_file(args.background_terrain_image, "background terrain image")
    feature_image = require_file(args.feature_image, "terrain feature image")
    background_object_image = require_file(args.background_object_image, "background object image")
    component_spec_path = require_file(args.component_spec, "alpha component specification")
    component_specs = json.loads(component_spec_path.read_text(encoding="utf-8"))
    out = args.out.resolve()

    texture_paths = {
        "terrainAlbedo": copy_texture(terrain_albedo, out / "terrain" / "textures" / terrain_albedo.name),
        "terrainReference": copy_texture(terrain_image, out / "terrain" / "reference" / terrain_image.name),
        "terrainProvenance": copy_texture(terrain_provenance, out / "terrain" / "textures" / terrain_provenance.name),
        "backgroundTerrain": copy_texture(background_terrain_image, out / "background-terrain" / "textures" / background_terrain_image.name),
        "feature": copy_texture(feature_image, out / "feature" / "textures" / feature_image.name),
        "backgroundObject": copy_texture(background_object_image, out / "background-object" / "textures" / background_object_image.name),
    }

    bpy.ops.wm.read_factory_settings(use_empty=True)
    terrain = export_terrain(out / "terrain", texture_paths["terrainAlbedo"])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    background_terrain = export_component_layer("background-terrain", component_specs["backgroundTerrain"], texture_paths["backgroundTerrain"], out / "background-terrain", base_height=12.0, depth=8.0)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    features = export_component_layer("feature", component_specs["feature"], texture_paths["feature"], out / "feature", base_height=2.4, depth=3.0)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    background_objects = export_component_layer("background-object", component_specs["backgroundObject"], texture_paths["backgroundObject"], out / "background-object", base_height=1.4, depth=4.5)

    report = {
        "assetId": "terrain-echo-throne",
        "stage": "source-candidate",
        "runtimeEligible": False,
        "representation": {
            "terrain": "procedural planar grid with generated albedo",
            "backgroundTerrain": "alpha-blended billboard components from source layer",
            "feature": "alpha-blended billboard components from source layer",
            "backgroundObject": "alpha-blended billboard components from source layer",
        },
        "inputs": {
            "terrainImage": receipt(terrain_image),
            "terrainAlbedo": receipt(terrain_albedo),
            "terrainProvenance": receipt(terrain_provenance),
            "backgroundTerrainImage": receipt(background_terrain_image),
            "featureImage": receipt(feature_image),
            "backgroundObjectImage": receipt(background_object_image),
            "componentSpec": receipt(component_spec_path),
        },
        "textureCopies": {name: receipt(path) for name, path in texture_paths.items()},
        "terrain": terrain,
        "backgroundTerrain": background_terrain,
        "features": features,
        "backgroundObjects": background_objects,
    }
    report_path = out / "terrain-echo-throne-build-report.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "report": relative(report_path),
        "backgroundTerrainComponents": background_terrain["componentsRetained"],
        "featureComponents": features["componentsRetained"],
        "backgroundObjectComponents": background_objects["componentsRetained"],
    }, sort_keys=True))


if __name__ == "__main__":
    main()
