#!/usr/bin/env python3
"""Split one prop OBJ into usable connected components, removing only mesh specks.

The source mesh and its textures are read-only. Every output is a candidate under
``_workspace/current`` and carries ``runtimeEligible: false``. A component is
removed only when it is one triangle / three vertices and its longest local
bounding-box extent is under 0.05 source units; larger disconnected pieces may
be authored detail and are retained.

Run through Blender::

  blender --background --python build-clean-prop-components.py -- \
    --asset-id prop-sprite-sheet-single-object.03 \
    --source assets/mesh/prop/prop-sprite-sheet-single-object.03/obj/obj/base.obj \
    --textures assets/mesh/prop/prop-sprite-sheet-single-object.03/obj/textureBasicPack \
    --out _workspace/current/engineering/asset-pipeline/textured-candidates/props/prop-sprite-sheet-single-object.03
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import bpy


SPECK_MAX_EXTENT = 0.05
PIPELINE_PATH = Path(__file__).resolve().with_name("build-abyss-chancel-terrain.py")


def load_pipeline():
    spec = importlib.util.spec_from_file_location("abyss_chancel_pipeline", PIPELINE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load shared Blender helpers: {PIPELINE_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pipeline = load_pipeline()


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset-id", required=True)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--textures", type=Path, required=True)
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
        raise RuntimeError(f"expected one source mesh before loose split, found {len(meshes)}")
    pipeline.select_only(meshes[0])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()
    parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not parts:
        raise RuntimeError("loose split produced no mesh components")
    return sorted(parts, key=lambda obj: tuple(pipeline.bbox(obj)["center"]))


def dimensions(record: dict) -> list[float]:
    return [record["bounds"]["max"][axis] - record["bounds"]["min"][axis] for axis in range(3)]


def classify(record: dict) -> tuple[str, float]:
    max_extent = round(max(dimensions(record)), 6)
    is_single_triangle = record["vertices"] == 3 and record["triangles"] == 1
    if is_single_triangle and max_extent < SPECK_MAX_EXTENT:
        return "removed-disconnected-speck", max_extent
    return "retained-component", max_extent


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


def main() -> None:
    args = parse_args()
    source = require_file(args.source, "source OBJ")
    textures = require_directory(args.textures, "texture directory")
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)

    parts = split_loose_parts(source)
    material = pipeline.background_pbr_material(textures)
    retained = []
    removed = []
    for source_index, obj in enumerate(parts, start=1):
        component_id = f"{args.asset_id}-component-{source_index:03d}"
        obj.name = component_id
        obj.data.name = f"{component_id}_mesh"
        record = pipeline.mesh_summary(obj)
        disposition, max_extent = classify(record)
        record.update({
            "componentId": component_id,
            "sourceComponentIndex": source_index,
            "maxExtent": max_extent,
            "disposition": disposition,
        })
        if disposition != "retained-component":
            removed.append(record)
            continue
        if not obj.data.uv_layers:
            raise RuntimeError(f"retained component has no UV map: {component_id}")
        assign_material(obj, material)
        retained.append((obj, record))

    if not retained:
        raise RuntimeError("cleanup predicate removed every component")

    obj_dir = out / "components" / "obj"
    component_records = []
    for output_index, (obj, record) in enumerate(retained, start=1):
        output_id = f"{args.asset_id}-component-{output_index:03d}"
        obj.name = output_id
        obj.data.name = f"{output_id}_mesh"
        pipeline.select_only(obj)
        obj_path = obj_dir / f"{output_id}.obj"
        pipeline.export_obj(obj_path)
        record.update({
            "componentId": output_id,
            "outputComponentIndex": output_index,
            "obj": str(obj_path),
            "material": material.name,
            "textureMapped": True,
        })
        component_records.append(record)

    merged = join([obj for obj, _ in retained], f"{args.asset_id}-cleaned")
    combined_glb = out / f"{args.asset_id}-cleaned.glb"
    pipeline.export_glb(combined_glb)

    report = {
        "schemaVersion": 1,
        "assetId": args.asset_id,
        "stage": "candidate",
        "runtimeEligible": False,
        "source": str(source),
        "textureDirectory": str(textures),
        "cleanupPolicy": {
            "kind": "one-triangle-disconnected-speck",
            "vertices": 3,
            "triangles": 1,
            "maxExtentExclusive": SPECK_MAX_EXTENT,
            "rationale": "Larger disconnected components remain because they can be intentional authored prop detail.",
        },
        "componentCountBeforeCleanup": len(component_records) + len(removed),
        "componentCountRetained": len(component_records),
        "componentCountRemoved": len(removed),
        "removedComponents": removed,
        "retainedComponents": component_records,
        "combinedGlb": str(combined_glb),
        "combinedMesh": pipeline.mesh_summary(merged),
        "receipts": {
            "combinedGlb": receipt(combined_glb),
            "componentObjs": [receipt(Path(record["obj"])) for record in component_records],
        },
    }
    report_path = out / f"{args.asset_id}-component-report.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    provenance_path = out / f"{args.asset_id}-cleaned.provenance.json"
    provenance = {
        "assetId": f"{args.asset_id}-cleaned",
        "generator": "_workspace/current/engineering/asset-pipeline/tools/build-clean-prop-components.py",
        "source": str(source),
        "output": str(combined_glb),
        "rightsReceipt": "source mesh retained in repository; candidate-only derivative",
        "runtimeReceipt": "runtimeEligible=false; candidate requires explicit promotion",
        "runtimeEligible": False,
        "report": str(report_path),
    }
    provenance_path.write_text(json.dumps(provenance, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "assetId": args.asset_id,
        "combinedGlb": str(combined_glb),
        "removed": len(removed),
        "report": str(report_path),
        "retained": len(component_records),
    }, sort_keys=True))


if __name__ == "__main__":
    main()
