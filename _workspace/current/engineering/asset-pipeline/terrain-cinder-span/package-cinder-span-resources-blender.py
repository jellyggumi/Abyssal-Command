#!/usr/bin/env python3
"""Map Cinder Span PBR materials and split source OBJs into named runtime packs."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

PROP_CLUSTER_GAP = 0.002
MIN_LOGICAL_PROP_EXTENT = 0.05
RECOMMENDED_WORLD_SCALE = 5.0


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--terrain-source-glb", type=Path, required=True)
    parser.add_argument("--terrain-textures", type=Path, required=True)
    parser.add_argument("--feature-obj", type=Path, required=True)
    parser.add_argument("--feature-textures", type=Path, required=True)
    parser.add_argument("--prop-obj", type=Path, required=True)
    parser.add_argument("--prop-textures", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    return parser.parse_args(argv)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_file(path: Path, label: str) -> Path:
    resolved = path.resolve()
    if not resolved.is_file():
        raise RuntimeError(f"{label} is missing: {resolved}")
    return resolved


def require_directory(path: Path, label: str) -> Path:
    resolved = path.resolve()
    if not resolved.is_dir():
        raise RuntimeError(f"{label} is missing: {resolved}")
    return resolved


def receipt(path: Path) -> dict:
    resolved = path.resolve()
    return {"path": str(resolved), "bytes": resolved.stat().st_size, "sha256": sha256(resolved)}


def copy_texture_tree(source: Path, destination: Path) -> list[dict]:
    destination.mkdir(parents=True, exist_ok=True)
    records = []
    for path in sorted(source.glob("*.png")):
        target = destination / path.name
        shutil.copy2(path, target)
        records.append(receipt(target))
    if not records:
        raise RuntimeError(f"texture directory has no PNG files: {source}")
    return records


def image_pixels(path: Path) -> tuple[np.ndarray, tuple[int, int]]:
    loaded = bpy.data.images.load(str(path), check_existing=False)
    loaded.colorspace_settings.name = "Non-Color"
    width, height = loaded.size
    flat = np.empty(width * height * 4, dtype=np.float32)
    loaded.pixels.foreach_get(flat)
    bpy.data.images.remove(loaded)
    return flat.reshape((height, width, 4)), (width, height)


def save_image(array: np.ndarray, path: Path, colorspace: str) -> None:
    height, width = array.shape[:2]
    generated = bpy.data.images.new(path.stem, width=width, height=height, alpha=True, float_buffer=False)
    generated.colorspace_settings.name = colorspace
    generated.pixels.foreach_set(np.ascontiguousarray(array, dtype=np.float32).reshape(-1))
    generated.filepath_raw = str(path)
    generated.file_format = "PNG"
    generated.save()
    bpy.data.images.remove(generated)
    if not path.is_file() or path.stat().st_size == 0:
        raise RuntimeError(f"failed to save image: {path}")


def build_object_orm(texture_dir: Path, category: str) -> tuple[Path, dict]:
    roughness_path = require_file(texture_dir / "texture_roughness.png", f"{category} roughness texture")
    metallic_path = require_file(texture_dir / "texture_metallic.png", f"{category} metallic texture")
    roughness, roughness_size = image_pixels(roughness_path)
    metallic, metallic_size = image_pixels(metallic_path)
    if roughness_size != metallic_size:
        raise RuntimeError(f"{category} metallic and roughness dimensions differ")
    orm = np.ones_like(roughness, dtype=np.float32)
    orm[..., 0] = 1.0
    orm[..., 1] = roughness[..., 0]
    orm[..., 2] = metallic[..., 0]
    orm[..., 3] = 1.0
    out = texture_dir / "texture_orm.png"
    save_image(orm, out, "Non-Color")
    provenance = {
        "schemaVersion": 1,
        "asset": str(out),
        "status": "blender-derived-candidate",
        "generatedAt": "2026-07-29",
        "generator": {
            "tool": "Blender headless Python",
            "blenderVersion": bpy.app.version_string,
            "script": str(Path(__file__).resolve()),
            "algorithm": "glTF ORM channel pack: R=1 AO, G=roughness, B=metallic",
        },
        "sourceInputs": [receipt(roughness_path), receipt(metallic_path)],
        "output": receipt(out),
        "runtimeEligible": False,
    }
    provenance_path = out.with_suffix(".provenance.json")
    provenance_path.write_text(json.dumps(provenance, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return out, provenance


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load_image(path: Path, colorspace: str):
    loaded = bpy.data.images.load(str(require_file(path, "material texture")), check_existing=True)
    loaded.colorspace_settings.name = colorspace
    loaded.pack()
    return loaded


def gltf_output_group():
    group = bpy.data.node_groups.get("glTF Material Output")
    if group is None:
        group = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        group.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    return group


def make_pbr_material(name: str, basecolor: Path, normal: Path, orm: Path, emission: Path | None = None, emission_strength: float = 1.0):
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    material["runtimeEligible"] = True
    material["textureChannels"] = "baseColor, normal, occlusion(R), roughness(G), metallic(B)" + (", emission" if emission else "")
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (680, 0)
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.location = (400, 0)
    shader.inputs["Emission Strength"].default_value = emission_strength if emission is not None else 0.0
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])

    base = nodes.new("ShaderNodeTexImage")
    base.name = f"{name} Base Color"
    base.label = "Base Color"
    base.location = (-520, 240)
    base.image = load_image(basecolor, "sRGB")
    links.new(base.outputs["Color"], shader.inputs["Base Color"])

    normal_texture = nodes.new("ShaderNodeTexImage")
    normal_texture.name = f"{name} Normal"
    normal_texture.label = "Normal"
    normal_texture.location = (-520, -20)
    normal_texture.image = load_image(normal, "Non-Color")
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.location = (80, -40)
    normal_map.space = "TANGENT"
    normal_map.inputs["Strength"].default_value = 0.72
    links.new(normal_texture.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])

    orm_texture = nodes.new("ShaderNodeTexImage")
    orm_texture.name = f"{name} ORM"
    orm_texture.label = "Occlusion Roughness Metallic"
    orm_texture.location = (-520, -280)
    orm_texture.image = load_image(orm, "Non-Color")
    separate = nodes.new("ShaderNodeSeparateColor")
    separate.location = (-180, -250)
    separate.mode = "RGB"
    links.new(orm_texture.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], shader.inputs["Roughness"])
    links.new(separate.outputs["Blue"], shader.inputs["Metallic"])
    gltf_settings = nodes.new("ShaderNodeGroup")
    gltf_settings.name = "glTF Material Output"
    gltf_settings.label = "glTF Material Output"
    gltf_settings.node_tree = gltf_output_group()
    gltf_settings.location = (80, -350)
    links.new(orm_texture.outputs["Color"], gltf_settings.inputs["Occlusion"])

    if emission is not None:
        emission_texture = nodes.new("ShaderNodeTexImage")
        emission_texture.name = f"{name} Emission"
        emission_texture.label = "Emission"
        emission_texture.location = (-520, -520)
        emission_texture.image = load_image(emission, "sRGB")
        links.new(emission_texture.outputs["Color"], shader.inputs["Emission Color"])

    return material


def select_only(objects: list) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def bounds(objects: list) -> dict:
    corners = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return {
        "min": [round(min(point[axis] for point in corners), 6) for axis in range(3)],
        "max": [round(max(point[axis] for point in corners), 6) for axis in range(3)],
    }


def dimensions(record: dict) -> list[float]:
    return [record["max"][axis] - record["min"][axis] for axis in range(3)]


def mesh_record(obj) -> dict:
    record = bounds([obj])
    record.update({
        "vertices": len(obj.data.vertices),
        "triangles": sum(max(0, len(polygon.vertices) - 2) for polygon in obj.data.polygons),
        "uvLayerCount": len(obj.data.uv_layers),
    })
    record["maxExtent"] = round(max(dimensions(record)), 6)
    return record


def export_glb(path: Path, objects: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    select_only(objects)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_image_format="WEBP",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_extras=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    if not path.is_file() or path.stat().st_size == 0:
        raise RuntimeError(f"GLB export failed: {path}")


def point_camera(camera, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def configure_review(render_path: Path, target: Vector, camera_location: Vector, ortho_scale: float | None = None, energy_scale: float = 1.0) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(render_path)
    scene.world = bpy.data.worlds.new("Cinder Span review world")
    scene.world.color = (0.004, 0.004, 0.007)

    camera_data = bpy.data.cameras.new("Cinder Span review camera")
    camera = bpy.data.objects.new("Cinder Span review camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = camera_location
    point_camera(camera, target)
    if ortho_scale is not None:
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = ortho_scale
    else:
        camera.data.lens = 55
    scene.camera = camera

    for name, location, energy, color, size in (
        ("key", target + Vector((-6.0, -8.0, 10.0)), 1800.0, (1.0, 0.28, 0.08), 7.0),
        ("fill", target + Vector((5.0, -2.0, 8.0)), 1050.0, (0.22, 0.35, 1.0), 6.0),
        ("rim", target + Vector((0.0, 6.0, 9.0)), 1200.0, (1.0, 0.12, 0.04), 5.0),
    ):
        light_data = bpy.data.lights.new(f"Cinder Span {name}", "AREA")
        light_data.energy = energy * energy_scale
        light_data.color = color
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new(f"Cinder Span {name}", light_data)
        scene.collection.objects.link(light)
        light.location = location
        point_camera(light, target)


def render_terrain(objects: list, render_path: Path) -> None:
    render_path.parent.mkdir(parents=True, exist_ok=True)
    record = bounds([obj for obj in objects if obj.type == "MESH"])
    target = Vector(((record["min"][0] + record["max"][0]) * 0.5, (record["min"][1] + record["max"][1]) * 0.5, 0.8))
    configure_review(render_path, target, target + Vector((15.0, -18.0, 13.0)))
    bpy.ops.render.render(write_still=True)


def build_terrain(source_glb: Path, textures: Path, out_dir: Path) -> dict:
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(source_glb))
    imported = [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "EMPTY"}]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("terrain GLB imported no meshes")
    required = {
        "basecolor": require_file(textures / "terrain-cinder-span-basecolor.png", "terrain base color"),
        "normal": require_file(textures / "terrain-cinder-span-normal.png", "terrain normal"),
        "orm": require_file(textures / "terrain-cinder-span-orm.png", "terrain ORM"),
        "emission": require_file(textures / "terrain-cinder-span-emission.png", "terrain emission"),
    }
    material_specs = {
        "basalt": ("Cinder Span Basalt PBR", 0.35),
        "ash": ("Cinder Span Ash PBR", 0.18),
        "iron": ("Cinder Span Iron PBR", 0.55),
        "ember": ("Cinder Span Ember PBR", 2.6),
    }
    materials = {
        token: make_pbr_material(name, required["basecolor"], required["normal"], required["orm"], required["emission"], emission_strength)
        for token, (name, emission_strength) in material_specs.items()
    }
    for mesh in meshes:
        if not mesh.data.uv_layers:
            raise RuntimeError(f"terrain mesh has no UV map: {mesh.name}")
        if not mesh.material_slots:
            raise RuntimeError(f"terrain mesh has no semantic material slot: {mesh.name}")
        for index, slot in enumerate(mesh.material_slots):
            source_name = slot.material.name.lower() if slot.material else ""
            token = next((candidate for candidate in material_specs if candidate in source_name), None)
            if token is None:
                raise RuntimeError(f"unknown Cinder Span terrain material: {slot.material.name if slot.material else '<none>'}")
            mesh.data.materials[index] = materials[token]
    roots = [obj for obj in imported if obj.parent is None]
    for root in roots:
        root["assetId"] = "terrain-cinder-span"
        root["runtimeRole"] = "terrain-environment"
        root["textureChannels"] = "baseColor, normal, ORM, emission"

    terrain_dir = out_dir / "terrain"
    glb_path = terrain_dir / "terrain-cinder-span.glb"
    blend_path = out_dir / "blend" / "terrain-cinder-span.blend"
    review_path = out_dir / "review" / "terrain-cinder-span.png"
    glb_path.parent.mkdir(parents=True, exist_ok=True)
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    render_terrain(imported, review_path)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    export_glb(glb_path, imported)
    return {
        "assetId": "terrain-cinder-span",
        "glb": receipt(glb_path),
        "blend": receipt(blend_path),
        "review": receipt(review_path),
        "meshCount": len(meshes),
        "materialCount": len(materials),
        "bounds": bounds(meshes),
        "textureChannels": ["baseColor", "normal", "occlusion", "roughness", "metallic", "emission"],
        "authoringOnlyMaps": ["height"],
        "runtimeEligible": True,
    }


def separate_loose_parts(source: Path) -> list:
    bpy.ops.wm.obj_import(filepath=str(source), use_split_objects=False, use_split_groups=False, validate_meshes=True)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"expected one source mesh before loose split, got {len(meshes)}")
    select_only(meshes)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()
    parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    def layout_key(obj):
        record = mesh_record(obj)
        center = (Vector(record["min"]) + Vector(record["max"])) * 0.5
        return (center.z, center.x, center.y)

    return sorted(parts, key=layout_key)


def legacy_component(record: dict) -> bool:
    return (record["triangles"] == 1 and record["maxExtent"] < 0.05) or (record["triangles"] <= 20 and record["maxExtent"] < 0.02)


def rectangle_distance(a: dict, b: dict) -> float:
    dx = max(0.0, a["min"][0] - b["max"][0], b["min"][0] - a["max"][0])
    dz = max(0.0, a["min"][2] - b["max"][2], b["min"][2] - a["max"][2])
    return math.hypot(dx, dz)


def logical_groups(parts: list, category: str) -> tuple[list[list], list[dict]]:
    rows = []
    rejected = []
    for index, obj in enumerate(parts, start=1):
        record = mesh_record(obj)
        record["sourceComponent"] = index
        if legacy_component(record):
            record["reason"] = "legacy-micro-component"
            rejected.append(record)
            bpy.data.objects.remove(obj, do_unlink=True)
        else:
            rows.append((obj, record))
    if category == "feature":
        return [[row] for row in rows], rejected

    parent = list(range(len(rows)))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left: int, right: int) -> None:
        left_root = find(left)
        right_root = find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    for left in range(len(rows)):
        for right in range(left + 1, len(rows)):
            if rectangle_distance(rows[left][1], rows[right][1]) <= PROP_CLUSTER_GAP:
                union(left, right)
    grouped = {}
    for index, row in enumerate(rows):
        grouped.setdefault(find(index), []).append(row)
    groups = []
    for group in grouped.values():
        group_bounds = bounds([obj for obj, _ in group])
        max_extent = max(dimensions(group_bounds))
        if max_extent < MIN_LOGICAL_PROP_EXTENT:
            for obj, record in group:
                record["reason"] = "orphan-small-group"
                rejected.append(record)
                bpy.data.objects.remove(obj, do_unlink=True)
        else:
            groups.append(group)
    def group_layout_key(group):
        record = bounds([obj for obj, _ in group])
        center = (Vector(record["min"]) + Vector(record["max"])) * 0.5
        return (center.z, center.x, center.y)

    groups.sort(key=group_layout_key)
    return groups, rejected


def join_group(group: list, asset_id: str, material, collection) -> tuple[object, dict]:
    objects = [obj for obj, _ in group]
    source_components = [record["sourceComponent"] for _, record in group]
    select_only(objects)
    if len(objects) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    before = bounds([obj])
    pivot = Vector(((before["min"][0] + before["max"][0]) * 0.5, (before["min"][1] + before["max"][1]) * 0.5, before["min"][2]))
    bpy.context.scene.cursor.location = pivot
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR", center="MEDIAN")
    obj.location = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    obj.name = asset_id
    obj.data.name = f"{asset_id}-mesh"
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0
    if not obj.data.uv_layers:
        raise RuntimeError(f"split asset has no UV map: {asset_id}")
    obj["assetId"] = asset_id
    obj["runtimeRole"] = "placeable-environment-prop"
    obj["pivotPolicy"] = "bottom-center"
    obj["sourceComponents"] = json.dumps(source_components)
    record = mesh_record(obj)
    record.update({
        "assetId": asset_id,
        "node": asset_id,
        "sourceComponents": source_components,
        "pivot": [round(value, 6) for value in pivot],
        "pivotPolicy": "bottom-center",
        "recommendedWorldScale": RECOMMENDED_WORLD_SCALE,
        "collisionHint": "box" if "feature" in asset_id else "convex-hull",
        "material": material.name,
        "textureMapped": True,
    })
    return obj, record


def render_pack(objects: list, render_path: Path) -> None:
    render_path.parent.mkdir(parents=True, exist_ok=True)
    review_collection = bpy.data.collections.new("Cinder Span review layout")
    bpy.context.scene.collection.children.link(review_collection)
    columns = max(1, math.ceil(math.sqrt(len(objects) * 1.6)))
    rows = math.ceil(len(objects) / columns)
    records = [mesh_record(obj) for obj in objects]
    max_width = max(max(dimensions(record)[0], dimensions(record)[1]) for record in records)
    max_height = max(dimensions(record)[2] for record in records)
    spacing_x = max(max_width * 1.45, 0.16)
    spacing_z = max(max_height * 1.35, 0.2)
    duplicates = []
    for index, obj in enumerate(objects):
        duplicate = obj.copy()
        duplicate.data = obj.data
        duplicate.location = ((index % columns) * spacing_x, 0.0, (rows - 1 - index // columns) * spacing_z)
        review_collection.objects.link(duplicate)
        duplicates.append(duplicate)
    for obj in objects:
        obj.hide_render = True
    center = Vector(((columns - 1) * spacing_x * 0.5, 0.0, (rows - 1) * spacing_z * 0.5 + max_height * 0.5))
    width = columns * spacing_x
    height = rows * spacing_z + max_height
    configure_review(
        render_path,
        center,
        center + Vector((width * 0.15, -max(width, height) * 1.2, height * 0.1)),
        max(width, height) * 1.12,
        energy_scale=0.5,
    )
    bpy.ops.render.render(write_still=True)
    for obj in objects:
        obj.hide_render = False
    for duplicate in duplicates:
        bpy.data.objects.remove(duplicate, do_unlink=True)
    bpy.data.collections.remove(review_collection)


def build_pack(category: str, source_obj: Path, source_textures: Path, package_textures: Path, out_dir: Path) -> dict:
    reset_scene()
    basecolor = require_file(package_textures / "texture_diffuse.png", f"{category} base color")
    normal = require_file(package_textures / "texture_normal.png", f"{category} normal")
    orm = require_file(package_textures / "texture_orm.png", f"{category} ORM")
    material = make_pbr_material(f"Cinder Span {category.title()} PBR", basecolor, normal, orm)
    parts = separate_loose_parts(source_obj)
    component_count = len(parts)
    groups, rejected = logical_groups(parts, category)
    collection = bpy.data.collections.new(f"terrain-cinder-span-{category}-pack")
    bpy.context.scene.collection.children.link(collection)
    prefix = "terrain-cinder-span-feature" if category == "feature" else "terrain-cinder-span-prop"
    assets = []
    objects = []
    for index, group in enumerate(groups, start=1):
        asset_id = f"{prefix}-{index:03d}"
        obj, record = join_group(group, asset_id, material, collection)
        objects.append(obj)
        assets.append(record)
    if not objects:
        raise RuntimeError(f"{category} pack produced no runtime objects")
    root = bpy.data.objects.new(f"terrain-cinder-span-{category}-pack-root", None)
    collection.objects.link(root)
    root["assetId"] = f"terrain-cinder-span-{category}-pack"
    root["runtimeRole"] = "named-node-resource-pack"
    root["assetCount"] = len(objects)
    for obj in objects:
        obj.parent = root

    pack_path = out_dir / "packs" / f"terrain-cinder-span-{category}s.glb"
    blend_path = out_dir / "blend" / f"terrain-cinder-span-{category}s.blend"
    review_path = out_dir / "review" / f"terrain-cinder-span-{category}s.png"
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    export_glb(pack_path, [root, *objects])
    render_pack(objects, review_path)
    return {
        "assetId": f"terrain-cinder-span-{category}-pack",
        "pack": receipt(pack_path),
        "blend": receipt(blend_path),
        "review": receipt(review_path),
        "source": receipt(source_obj),
        "sourceComponentCount": component_count,
        "assetCount": len(assets),
        "rejectedComponentCount": len(rejected),
        "rejectedComponents": rejected,
        "material": material.name,
        "textureSet": str(package_textures),
        "textureChannels": ["baseColor", "normal", "roughness", "metallic"],
        "packLoadContract": "load pack GLB once; getObjectByName(node); clone for placement",
        "assets": assets,
        "runtimeEligible": False,
    }


def main() -> None:
    args = parse_args()
    terrain_source_glb = require_file(args.terrain_source_glb, "staged terrain GLB")
    terrain_textures = require_directory(args.terrain_textures, "terrain texture set")
    feature_obj = require_file(args.feature_obj, "feature OBJ")
    feature_textures = require_directory(args.feature_textures, "feature texture set")
    prop_obj = require_file(args.prop_obj, "prop OBJ")
    prop_textures = require_directory(args.prop_textures, "prop texture set")
    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    reset_scene()
    texture_root = out_dir / "textures"
    terrain_texture_records = copy_texture_tree(terrain_textures, texture_root / "terrain")
    feature_texture_records = copy_texture_tree(feature_textures, texture_root / "feature")
    prop_texture_records = copy_texture_tree(prop_textures, texture_root / "prop")
    feature_orm, feature_orm_provenance = build_object_orm(texture_root / "feature", "feature")
    prop_orm, prop_orm_provenance = build_object_orm(texture_root / "prop", "prop")

    terrain = build_terrain(terrain_source_glb, texture_root / "terrain", out_dir)
    feature = build_pack("feature", feature_obj, feature_textures, texture_root / "feature", out_dir)
    prop = build_pack("prop", prop_obj, prop_textures, texture_root / "prop", out_dir)

    manifest = {
        "schemaVersion": 1,
        "assetId": "terrain-cinder-span-resources",
        "generatedAt": "2026-07-29",
        "generator": {
            "tool": "Blender headless Python",
            "blenderVersion": bpy.app.version_string,
            "script": str(Path(__file__).resolve()),
            "scriptSha256": sha256(Path(__file__).resolve()),
        },
        "coordinateContract": {
            "authoring": "Blender Z-up",
            "runtime": "glTF Y-up",
            "pivot": "bottom-center for named feature and prop nodes",
            "recommendedWorldScale": RECOMMENDED_WORLD_SCALE,
        },
        "terrain": terrain,
        "featurePack": feature,
        "propPack": prop,
        "textures": {
            "terrain": terrain_texture_records,
            "feature": feature_texture_records + [receipt(feature_orm), {"provenance": feature_orm_provenance}],
            "prop": prop_texture_records + [receipt(prop_orm), {"provenance": prop_orm_provenance}],
        },
        "runtimeEligible": False,
        "promotionGate": "independent Blender re-import audit plus Three.js GLTFLoader smoke test",
    }
    manifest_path = out_dir / "terrain-cinder-span-resources.manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "manifest": str(manifest_path),
        "terrainMeshes": terrain["meshCount"],
        "featureAssets": feature["assetCount"],
        "propAssets": prop["assetCount"],
        "rejectedPropComponents": prop["rejectedComponentCount"],
    }, sort_keys=True))


if __name__ == "__main__":
    main()
