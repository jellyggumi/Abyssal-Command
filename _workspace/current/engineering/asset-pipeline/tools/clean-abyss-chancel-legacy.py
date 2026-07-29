#!/usr/bin/env python3
"""Export a conservative, categorized Abyss Chancel legacy-cleanup candidate.

Only disconnected one-triangle, three-vertex specks are removed when their
longest bounding-box extent is below 0.05 source units. Source assets remain
untouched. The feature asset is categorized into simple planes and protrusions;
terrain is joined back to one runtime mesh after cleanup.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path


import bpy


LEGACY_MAX_EXTENT = 0.05

PIPELINE_PATH = Path(__file__).resolve().with_name("build-abyss-chancel-terrain.py")


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
    parser.add_argument("--texture", type=Path, required=True)
    parser.add_argument("--terrain-obj", type=Path, required=True)
    parser.add_argument("--object-obj", type=Path, required=True)
    parser.add_argument("--object-textures", type=Path, required=True)
    parser.add_argument("--feature-obj", type=Path, required=True)
    parser.add_argument("--feature-textures", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    return parser.parse_args(argv)


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


def split_loose_parts(source: Path) -> list:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.obj_import(
        filepath=str(source),
        use_split_objects=False,
        use_split_groups=False,
        validate_meshes=True,
    )
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"expected one source mesh before split, got {len(meshes)}")
    pipeline.select_only(meshes[0])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()
    parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not parts:
        raise RuntimeError("loose-part split produced no mesh objects")
    return sorted(parts, key=lambda obj: tuple(pipeline.bbox(obj)["center"]))


def extents(record: dict) -> list[float]:
    return [record["bounds"]["max"][axis] - record["bounds"]["min"][axis] for axis in range(3)]


def is_legacy_simple_plane(record: dict) -> bool:
    return record["vertices"] == 3 and record["triangles"] == 1 and max(extents(record)) < LEGACY_MAX_EXTENT


def is_simple_plane(record: dict) -> bool:
    dimensions = extents(record)
    longest = max(dimensions)
    return longest > 0 and min(dimensions) <= longest * 1e-5


def name_and_partition(parts: list, prefix: str) -> tuple[list, list]:
    retained, legacy = [], []
    for index, obj in enumerate(parts, start=1):
        component_id = f"{prefix}-{index:03d}"
        obj.name = component_id
        obj.data.name = f"{component_id}_mesh"
        record = pipeline.mesh_summary(obj)
        record["componentId"] = component_id
        record["maxExtent"] = round(max(extents(record)), 6)
        record["simplePlane"] = is_simple_plane(record)
        if is_legacy_simple_plane(record):
            legacy.append(record)
        else:
            retained.append((obj, record))
    if not retained:
        raise RuntimeError("legacy predicate removed every mesh component")
    return retained, legacy


def assign_material(obj, material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0


def select_many(objects: list) -> None:
    pipeline.deselect_all()
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def join(objects: list, name: str):
    select_many(objects)
    bpy.ops.object.join()
    merged = bpy.context.view_layer.objects.active
    merged.name = name
    merged.data.name = f"{name}_mesh"
    return merged


def receipt(path: Path) -> dict:
    payload = path.read_bytes()
    return {"path": str(path), "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}

def export_clean_terrain(source: Path, texture: Path, out: Path) -> dict:
    retained, legacy = name_and_partition(split_loose_parts(source), "terrain-abyss-chancel-component")
    material = pipeline.principled_texture_material(
        "abyss_chancel_terrain_albedo_cleaned",
        texture,
        roughness=0.73,
        metallic=0.08,
    )
    for obj, _ in retained:
        if not obj.data.uv_layers:
            raise RuntimeError(f"terrain component has no UV map: {obj.name}")
        assign_material(obj, material)
    merged = join([obj for obj, _ in retained], "TerrainAbyssChancelCleaned")
    out.mkdir(parents=True, exist_ok=True)
    obj_path = out / "terrain-abyss-chancel-textured-cleaned.obj"
    glb_path = out / "terrain-abyss-chancel-textured-cleaned.glb"
    pipeline.select_only(merged)
    pipeline.export_obj(obj_path)
    pipeline.export_glb(glb_path)
    return {
        "source": str(source),
        "componentCountBeforeJoin": len(retained),
        "legacyRemoved": legacy,
        "material": material.name,
        "texture": str(texture),
        "obj": str(obj_path),
        "glb": str(glb_path),
        "meshObjectCount": 1,
        "mesh": pipeline.mesh_summary(merged),
    }


def export_clean_objects(source: Path, textures: Path, out: Path) -> dict:
    retained, legacy = name_and_partition(split_loose_parts(source), "terrain-abyss-chancel-object")
    material = pipeline.background_pbr_material(textures)
    obj_dir = out / "obj"
    out.mkdir(parents=True, exist_ok=True)
    records = []
    for obj, record in retained:
        if not obj.data.uv_layers:
            raise RuntimeError(f"object component has no UV map: {obj.name}")
        assign_material(obj, material)
        pipeline.select_only(obj)
        obj_path = obj_dir / f"{obj.name}.obj"
        pipeline.export_obj(obj_path)
        record.update({"obj": str(obj_path), "glbNode": obj.name, "material": material.name, "textureMapped": True})
        records.append(record)
    combined_glb = out / "terrain-abyss-chancel-object-cleaned.glb"
    select_many([obj for obj, _ in retained])
    pipeline.export_glb(combined_glb)
    return {
        "source": str(source),
        "componentCount": len(records),
        "legacyRemoved": legacy,
        "texturePack": str(textures),
        "material": material.name,
        "combinedGlb": str(combined_glb),
        "objects": records,
    }


def export_clean_features(source: Path, textures: Path, out: Path) -> dict:
    retained, legacy = name_and_partition(split_loose_parts(source), "terrain-abyss-chancel-feature")
    simple = [(obj, record) for obj, record in retained if record["simplePlane"]]
    protrusions = [(obj, record) for obj, record in retained if not record["simplePlane"]]
    if not simple or not protrusions:
        raise RuntimeError("feature categorization requires both simple planes and protrusions")
    material = pipeline.background_pbr_material(textures)
    for obj, _ in retained:
        if not obj.data.uv_layers:
            raise RuntimeError(f"feature component has no UV map: {obj.name}")
        assign_material(obj, material)
    simple_mesh = join([obj for obj, _ in simple], "TerrainAbyssChancelFeatureSimplePlanes")
    protrusion_mesh = join([obj for obj, _ in protrusions], "TerrainAbyssChancelFeatureProtrusions")
    obj_dir = out / "obj"
    out.mkdir(parents=True, exist_ok=True)
    simple_obj = obj_dir / "terrain-abyss-chancel-feature-simple-planes.obj"
    protrusion_obj = obj_dir / "terrain-abyss-chancel-feature-protrusions.obj"
    pipeline.select_only(simple_mesh)
    pipeline.export_obj(simple_obj)
    pipeline.select_only(protrusion_mesh)
    pipeline.export_obj(protrusion_obj)
    combined_glb = out / "terrain-abyss-chancel-feature-cleaned.glb"
    select_many([simple_mesh, protrusion_mesh])
    pipeline.export_glb(combined_glb)
    return {
        "source": str(source),
        "componentCount": len(retained),
        "legacyRemoved": legacy,
        "texturePack": str(textures),
        "material": material.name,
        "simplePlanes": {"componentCountBeforeJoin": len(simple), "obj": str(simple_obj), "mesh": pipeline.mesh_summary(simple_mesh)},
        "protrusions": {"componentCountBeforeJoin": len(protrusions), "obj": str(protrusion_obj), "mesh": pipeline.mesh_summary(protrusion_mesh)},
        "combinedGlb": str(combined_glb),
    }


def main() -> None:
    args = parse_args()
    texture = require_file(args.texture, "terrain texture")
    terrain_obj = require_file(args.terrain_obj, "terrain OBJ")
    object_obj = require_file(args.object_obj, "object OBJ")
    object_textures = require_directory(args.object_textures, "object texture folder")
    feature_obj = require_file(args.feature_obj, "feature OBJ")
    feature_textures = require_directory(args.feature_textures, "feature texture folder")
    out = args.out.resolve()
    terrain = export_clean_terrain(terrain_obj, texture, out / "terrain")
    objects = export_clean_objects(object_obj, object_textures, out / "object")
    features = export_clean_features(feature_obj, feature_textures, out / "feature")
    report = {
        "assetId": "terrain-abyss-chancel-cleaned",
        "stage": "candidate",
        "runtimeEligible": False,
        "legacyPredicate": {
            "description": "Disconnected simple speck only: exactly three vertices, one triangle, and max extent below 0.05 source units.",
            "vertices": 3,
            "triangles": 1,
            "maxExtentExclusive": LEGACY_MAX_EXTENT,
        },
        "terrain": terrain,
        "objects": objects,
        "features": features,
        "receipts": {
            "terrainObj": receipt(Path(terrain["obj"])),
            "terrainGlb": receipt(Path(terrain["glb"])),
            "objectGlb": receipt(Path(objects["combinedGlb"])),
            "objectObj": [receipt(Path(record["obj"])) for record in objects["objects"]],
            "featureSimplePlanesObj": receipt(Path(features["simplePlanes"]["obj"])),
            "featureProtrusionsObj": receipt(Path(features["protrusions"]["obj"])),
            "featureGlb": receipt(Path(features["combinedGlb"])),
        },
    }
    report_path = out / "terrain-abyss-chancel-cleaned-report.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "report": str(report_path),
        "terrainLegacyRemoved": len(terrain["legacyRemoved"]),
        "objectLegacyRemoved": len(objects["legacyRemoved"]),
        "objectComponents": objects["componentCount"],
        "featureLegacyRemoved": len(features["legacyRemoved"]),
        "featureSimplePlanes": features["simplePlanes"]["componentCountBeforeJoin"],
        "featureProtrusions": features["protrusions"]["componentCountBeforeJoin"],
    }, sort_keys=True))


if __name__ == "__main__":
    main()
