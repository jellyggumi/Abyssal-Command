#!/usr/bin/env python3
"""Read-only loose-component classifier for Abyss Chancel OBJ sources."""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

import bpy


MAX_LEGACY_EXTENT = 0.02
PIPELINE_PATH = Path(__file__).resolve().with_name("build-abyss-chancel-terrain.py")


def load_pipeline():
    spec = importlib.util.spec_from_file_location("abyss_chancel_pipeline", PIPELINE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load pipeline module: {PIPELINE_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pipeline = load_pipeline()


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--prefix", required=True)
    parser.add_argument("--out", type=Path, required=True)
    return parser.parse_args(argv)


def main():
    args = parse_args()
    source = args.source.resolve()
    if not source.is_file():
        raise RuntimeError(f"source OBJ missing: {source}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.obj_import(filepath=str(source), use_split_objects=False, use_split_groups=False, validate_meshes=True)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"expected one OBJ mesh before split, got {len(meshes)}")
    pipeline.select_only(meshes[0])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()
    parts = sorted(
        (obj for obj in bpy.context.scene.objects if obj.type == "MESH"),
        key=lambda obj: tuple(pipeline.bbox(obj)["center"]),
    )
    records = []
    for index, obj in enumerate(parts, start=1):
        record = pipeline.mesh_summary(obj)
        record["componentId"] = f"{args.prefix}-{index:03d}"
        record["maxExtent"] = max(
            record["bounds"]["max"][axis] - record["bounds"]["min"][axis]
            for axis in range(3)
        )
        record["legacySimplePlane"] = (
            record["vertices"] == 3
            and record["triangles"] == 1
            and record["maxExtent"] < MAX_LEGACY_EXTENT
        )
        records.append(record)
    legacy = [record for record in records if record["legacySimplePlane"]]
    report = {
        "source": str(source),
        "components": len(records),
        "legacyPredicate": {
            "vertices": 3,
            "triangles": 1,
            "maxExtentExclusive": MAX_LEGACY_EXTENT,
        },
        "legacyCount": len(legacy),
        "legacyVertices": sum(record["vertices"] for record in legacy),
        "legacyTriangles": sum(record["triangles"] for record in legacy),
        "remainingComponents": len(records) - len(legacy),
        "remainingVertices": sum(record["vertices"] for record in records) - sum(record["vertices"] for record in legacy),
        "remainingTriangles": sum(record["triangles"] for record in records) - sum(record["triangles"] for record in legacy),
        "componentsDetail": records,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"components": report["components"], "legacyCount": report["legacyCount"], "out": str(args.out)}, sort_keys=True))


if __name__ == "__main__":
    main()
