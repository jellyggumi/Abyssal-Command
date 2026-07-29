#!/usr/bin/env python3
"""Build a textured Abyss Chancel terrain candidate and split its background OBJ.

Runs inside Blender 4.x. Every output is a candidate artifact; no runtime asset path
is written or replaced.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector




def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--texture", type=Path, required=True)
    parser.add_argument("--terrain-obj", type=Path, required=True)
    parser.add_argument("--background-obj", type=Path, required=True)
    parser.add_argument("--background-textures", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    return parser.parse_args(argv)


def require_file(path: Path, label: str) -> Path:
    path = path.resolve()
    if not path.is_file():
        raise RuntimeError(f"{label} is missing: {path}")
    return path


def image(path: Path, non_color: bool = False):
    source = require_file(path, "texture")
    loaded = bpy.data.images.load(str(source), check_existing=True)
    if non_color:
        loaded.colorspace_settings.name = "Non-Color"
    return loaded


def principled_texture_material(name: str, albedo: Path, *, roughness: float, metallic: float):
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    material.diffuse_color = (0.20, 0.23, 0.30, 1.0)
    material["sourceTexture"] = str(albedo)
    material["runtimeEligible"] = False
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (520, 0)
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.location = (240, 0)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    texcoord = nodes.new("ShaderNodeTexCoord")
    texcoord.location = (-520, 0)
    albedo_node = nodes.new("ShaderNodeTexImage")
    albedo_node.location = (-280, 0)
    albedo_node.image = image(albedo)
    links.new(texcoord.outputs["UV"], albedo_node.inputs["Vector"])
    links.new(albedo_node.outputs["Color"], shader.inputs["Base Color"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material

def background_pbr_material(textures: Path):
    diffuse = require_file(textures / "texture_diffuse.png", "background diffuse texture")
    normal = require_file(textures / "texture_normal.png", "background normal texture")
    metallic = require_file(textures / "texture_metallic.png", "background metallic texture")
    roughness = require_file(textures / "texture_roughness.png", "background roughness texture")
    material = bpy.data.materials.new(name="abyss_chancel_background_pbr")
    material.use_nodes = True
    material["runtimeEligible"] = False
    material["sourceTextures"] = [str(diffuse), str(normal), str(metallic), str(roughness)]
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (640, 0)
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.location = (350, 0)
    texcoord = nodes.new("ShaderNodeTexCoord")
    texcoord.location = (-540, 0)

    def texture_node(label: str, path: Path, y: int, non_color: bool):
        node = nodes.new("ShaderNodeTexImage")
        node.label = label
        node.location = (-280, y)
        node.image = image(path, non_color=non_color)
        links.new(texcoord.outputs["UV"], node.inputs["Vector"])
        return node

    diffuse_node = texture_node("Base Color", diffuse, 90, False)
    normal_node = texture_node("Normal", normal, -100, True)
    metallic_node = texture_node("Metallic", metallic, -270, True)
    roughness_node = texture_node("Roughness", roughness, -440, True)
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.location = (80, -100)
    normal_map.inputs["Strength"].default_value = 0.65
    links.new(diffuse_node.outputs["Color"], shader.inputs["Base Color"])
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
    links.new(metallic_node.outputs["Color"], shader.inputs["Metallic"])
    links.new(roughness_node.outputs["Color"], shader.inputs["Roughness"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material






def deselect_all() -> None:
    bpy.ops.object.select_all(action="DESELECT")


def select_only(obj) -> None:
    deselect_all()
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bbox(obj) -> dict[str, list[float]]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return {
        "min": [round(min(point[i] for point in points), 6) for i in range(3)],
        "max": [round(max(point[i] for point in points), 6) for i in range(3)],
        "center": [round(sum(point[i] for point in points) / len(points), 6) for i in range(3)],
    }


def mesh_summary(obj) -> dict:
    return {
        "name": obj.name,
        "vertices": len(obj.data.vertices),
        "triangles": sum(len(poly.vertices) - 2 for poly in obj.data.polygons),
        "uvLayerCount": len(obj.data.uv_layers),
        "bounds": bbox(obj),
    }


def export_glb(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    if not path.is_file() or path.stat().st_size == 0:
        raise RuntimeError(f"GLB export failed: {path}")


def export_obj(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.obj_export(
        filepath=str(path),
        export_selected_objects=True,
        export_uv=True,
        export_normals=True,
        export_materials=True,
        apply_modifiers=True,
    )
    if not path.is_file() or path.stat().st_size == 0:
        raise RuntimeError(f"OBJ export failed: {path}")


def build_terrain(source: Path, texture: Path, out: Path) -> dict:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    out.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.obj_import(
        filepath=str(source),
        use_split_objects=False,
        use_split_groups=False,
        validate_meshes=True,
    )
    imported = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(imported) != 1:
        raise RuntimeError(f"Expected one terrain OBJ mesh, got {len(imported)}")
    terrain = imported[0]
    if not terrain.data.uv_layers:
        raise RuntimeError("terrain OBJ has no UV map; cannot map generated texture")
    terrain.name = "TerrainAbyssChancel"
    terrain.data.name = "TerrainAbyssChancel_mesh"
    material = principled_texture_material(
        "abyss_chancel_terrain_albedo",
        texture,
        roughness=0.73,
        metallic=0.08,
    )
    terrain.data.materials.clear()
    terrain.data.materials.append(material)
    for polygon in terrain.data.polygons:
        polygon.material_index = 0
    select_only(terrain)
    terrain_obj = out / "terrain-abyss-chancel-textured.obj"
    terrain_glb = out / "terrain-abyss-chancel-textured.glb"
    export_obj(terrain_obj)
    export_glb(terrain_glb)
    return {
        "source": str(source),
        "object": mesh_summary(terrain),
        "texture": str(texture),
        "obj": str(terrain_obj),
        "glb": str(terrain_glb),
        "textureMappedObject": terrain.name,
        "textureMappedUv": terrain.data.uv_layers.active.name,
        "material": material.name,
    }


def split_background(source: Path, textures: Path, out: Path) -> dict:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.obj_import(
        filepath=str(source),
        use_split_objects=False,
        use_split_groups=False,
        validate_meshes=True,
    )
    imported = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(imported) != 1:
        raise RuntimeError(f"Expected one OBJ mesh before loose-part split, got {len(imported)}")
    base = imported[0]
    select_only(base)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()

    parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not parts:
        raise RuntimeError("Loose-part split produced no mesh objects")
    parts.sort(key=lambda obj: tuple(bbox(obj)["center"]))
    pbr = background_pbr_material(textures)
    obj_dir = out / "obj"
    out.mkdir(parents=True, exist_ok=True)
    records = []
    for index, obj in enumerate(parts, start=1):
        name = f"terrain-abyss-chancel-background-object-{index:03d}"
        obj.name = name
        obj.data.name = f"{name}_mesh"
        if obj.data.materials:
            obj.data.materials.clear()
        obj.data.materials.append(pbr)
        for polygon in obj.data.polygons:
            polygon.material_index = 0
        select_only(obj)
        obj_path = obj_dir / f"{name}.obj"
        export_obj(obj_path)
        record = mesh_summary(obj)
        record.update(
            {
                "obj": str(obj_path),
                "glbNode": name,
                "material": pbr.name,
                "textureMapped": bool(obj.data.uv_layers),
            }
        )
        records.append(record)
    deselect_all()
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    combined_glb = out / "terrain-abyss-chancel-background-objects.glb"
    export_glb(combined_glb)
    return {
        "input": str(source),
        "componentCount": len(records),
        "texturePack": str(textures),
        "combinedGlb": str(combined_glb),
        "objects": records,
    }


def file_receipt(path: str) -> dict:
    candidate = Path(path)
    payload = candidate.read_bytes()
    return {"path": str(candidate), "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}


def main() -> None:
    args = parse_args()
    texture = require_file(args.texture, "terrain texture")
    terrain_obj = require_file(args.terrain_obj, "terrain OBJ")
    background_obj = require_file(args.background_obj, "background OBJ")
    textures = args.background_textures.resolve()
    if not textures.is_dir():
        raise RuntimeError(f"background texture folder is missing: {textures}")
    out = args.out.resolve()
    terrain = build_terrain(terrain_obj, texture, out / "terrain")
    background = split_background(background_obj, textures, out / "background-object")
    report = {
        "assetId": "terrain-abyss-chancel",
        "stage": "candidate",
        "runtimeEligible": False,
        "terrain": terrain,
        "background": background,
        "receipts": {
            "terrainObj": file_receipt(terrain["obj"]),
            "terrainGlb": file_receipt(terrain["glb"]),
            "backgroundCombinedGlb": file_receipt(background["combinedGlb"]),
            "backgroundObj": [
                {"obj": file_receipt(item["obj"])}
                for item in background["objects"]
            ],
        },
    }
    report_path = out / "terrain-abyss-chancel-build-report.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"report": str(report_path), "backgroundComponents": background["componentCount"]}, sort_keys=True))


if __name__ == "__main__":
    main()
