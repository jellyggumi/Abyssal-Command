#!/usr/bin/env python3
"""Detect exact feature geometry duplicated by Abyss Chancel terrain/object OBJs.

This is read-only. It compares loose components and individual triangles using
world-space coordinates rounded to six decimal places, which matches the OBJ
source precision while remaining independent of vertex/face ordering.
"""

from __future__ import annotations

import argparse
from collections import Counter

import hashlib
import json
import sys
from pathlib import Path

import bpy


LEGACY_MAX_EXTENT = 0.05
COORDINATE_DECIMALS = 6


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--terrain", type=Path, required=True)
    parser.add_argument("--object", type=Path, required=True)
    parser.add_argument("--feature", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    return parser.parse_args(argv)


def require_file(path: Path, label: str) -> Path:
    resolved = path.resolve()
    if not resolved.is_file():
        raise RuntimeError(f"{label} missing: {resolved}")
    return resolved


def coordinate(vertex) -> tuple[float, float, float]:
    return tuple(round(value, COORDINATE_DECIMALS) for value in vertex.co)


def triangle_signature(coordinates: list[tuple[float, float, float]]) -> str:
    payload = json.dumps(sorted(coordinates), separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def component_signatures(mesh: bpy.types.Mesh) -> tuple[Counter[str], str, int]:
    mesh.calc_loop_triangles()
    triangle_hashes = [
        triangle_signature([coordinate(mesh.vertices[index]) for index in triangle.vertices])
        for triangle in mesh.loop_triangles
    ]
    component_payload = json.dumps(sorted(triangle_hashes), separators=(",", ":"))
    return Counter(triangle_hashes), hashlib.sha256(component_payload.encode("utf-8")).hexdigest(), len(triangle_hashes)


def max_extent(mesh: bpy.types.Mesh) -> float:
    coordinates = [coordinate(vertex) for vertex in mesh.vertices]
    spans = [max(point[axis] for point in coordinates) - min(point[axis] for point in coordinates) for axis in range(3)]
    return max(spans)


def load_components(path: Path, label: str) -> list[dict]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.obj_import(filepath=str(path), use_split_objects=False, use_split_groups=False, validate_meshes=True)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"{label} import expected one mesh, found {len(meshes)}")
    active = meshes[0]
    bpy.context.view_layer.objects.active = active
    active.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()

    components = []
    for mesh_object in sorted(
        (obj for obj in bpy.context.scene.objects if obj.type == "MESH"),
        key=lambda obj: tuple(round(value, COORDINATE_DECIMALS) for value in obj.bound_box[0]),
    ):
        triangles, component, triangle_count = component_signatures(mesh_object.data)
        components.append({
            "name": mesh_object.name,
            "triangles": triangles,
            "component": component,
            "maxExtent": max_extent(mesh_object.data),
            "vertexCount": len(mesh_object.data.vertices),
            "triangleCount": triangle_count,
        })
    return components


def retained(components: list[dict]) -> list[dict]:
    return [
        component
        for component in components
        if not (component["vertexCount"] == 3 and component["triangleCount"] == 1 and component["maxExtent"] < LEGACY_MAX_EXTENT)
    ]


def target_summary(targets: list[dict]) -> dict:
    component_hashes = {component["component"] for component in targets}
    triangle_counts: Counter[str] = Counter()
    for component in targets:
        triangle_counts.update(component["triangles"])
    return {"componentHashes": component_hashes, "triangleCounts": triangle_counts}


def overlapping_triangles(component: dict, target: dict) -> int:
    return sum(
        min(count, target["triangleCounts"][triangle_hash])
        for triangle_hash, count in component["triangles"].items()
    )


def source_only_triangles(source: dict, target: dict) -> int:
    return sum(
        max(count - target["triangleCounts"][triangle_hash], 0)
        for triangle_hash, count in source["triangleCounts"].items()
    )


def main() -> None:
    args = parse_args()
    terrain = load_components(require_file(args.terrain, "terrain OBJ"), "terrain")
    objects = load_components(require_file(args.object, "object OBJ"), "object")
    features = load_components(require_file(args.feature, "feature OBJ"), "feature")

    terrain_retained = retained(terrain)
    object_retained = retained(objects)
    feature_retained = retained(features)
    terrain_target = target_summary(terrain_retained)
    object_target = target_summary(object_retained)
    combined_target = target_summary(terrain_retained + object_retained)
    terrain_object_exact_components = sum(
        component["component"] in terrain_target["componentHashes"]
        for component in object_retained
    )
    terrain_object_fully_duplicated_components = sum(
        overlapping_triangles(component, terrain_target) == component["triangleCount"]
        for component in object_retained
    )
    terrain_object_duplicate_triangles = sum(
        overlapping_triangles(component, terrain_target)
        for component in object_retained
    )
    terrain_only_triangles = source_only_triangles(terrain_target, object_target)
    object_only_triangles = source_only_triangles(object_target, terrain_target)
    object_records = []
    for component in object_retained:
        terrain_overlap = overlapping_triangles(component, terrain_target)
        object_records.append({
            "name": component["name"],
            "componentHash": component["component"],
            "triangleCount": component["triangleCount"],
            "exactTerrainComponentDuplicate": component["component"] in terrain_target["componentHashes"],
            "triangleOverlapWithTerrain": terrain_overlap,
            "fullyDuplicatedTriangles": terrain_overlap == component["triangleCount"],
        })



    feature_records = []
    for component in feature_retained:
        terrain_overlap = overlapping_triangles(component, terrain_target)
        object_overlap = overlapping_triangles(component, object_target)
        combined_overlap = overlapping_triangles(component, combined_target)
        feature_records.append({
            "name": component["name"],
            "componentHash": component["component"],
            "triangleCount": component["triangleCount"],
            "exactTerrainComponentDuplicate": component["component"] in terrain_target["componentHashes"],
            "exactObjectComponentDuplicate": component["component"] in object_target["componentHashes"],
            "triangleOverlapWithTerrain": terrain_overlap,
            "triangleOverlapWithObject": object_overlap,
            "triangleOverlapWithTerrainOrObject": combined_overlap,
            "fullyDuplicatedTriangles": combined_overlap == component["triangleCount"],
        })

    report = {
        "comparison": {
            "coordinateDecimals": COORDINATE_DECIMALS,
            "legacyPredicate": {
                "vertexCount": 3,
                "triangleCount": 1,
                "maxExtentExclusive": LEGACY_MAX_EXTENT,
            },
            "method": "Exact unordered triangle-coordinate hash; ignores OBJ vertex and face ordering.",
        },
        "sources": {
            "terrain": str(args.terrain.resolve()),
            "object": str(args.object.resolve()),
            "feature": str(args.feature.resolve()),
        },
        "counts": {
            "terrainComponents": len(terrain_retained),
            "objectComponents": len(object_retained),
            "featureComponents": len(feature_retained),
            "objectExactTerrainComponentDuplicates": terrain_object_exact_components,
            "objectFullyDuplicatedAgainstTerrainComponents": terrain_object_fully_duplicated_components,
            "objectDuplicateTrianglesAgainstTerrain": terrain_object_duplicate_triangles,
            "featureExactTerrainComponentDuplicates": sum(record["exactTerrainComponentDuplicate"] for record in feature_records),
            "featureExactObjectComponentDuplicates": sum(record["exactObjectComponentDuplicate"] for record in feature_records),
            "featureFullyDuplicatedComponents": sum(record["fullyDuplicatedTriangles"] for record in feature_records),
            "featureDuplicateTriangles": sum(record["triangleOverlapWithTerrainOrObject"] for record in feature_records),
        },
        "runtimeComposition": {
            "terrainAndObjectCanLoadTogether": terrain_object_duplicate_triangles == 0,
            "preferredCandidateSet": ["terrain", "feature"],
            "deferredCandidate": "object",
            "blockedCandidateSet": ["terrain", "object"],
            "sourceDelta": {
                "terrainOnlyTriangles": terrain_only_triangles,
                "objectOnlyTriangles": object_only_triangles,
            },
            "selectionReason": (
                "Terrain is the texture-mapped candidate; object remains a split-source candidate."
                if terrain_object_duplicate_triangles == 0
                else "Terrain is the texture-mapped candidate. Object is preserved for source inspection only because co-loading duplicates surfaces and replacing terrain changes the recorded source coverage."
            ),
        },
        "featureComponents": feature_records,
        "objectComponents": object_records,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report["counts"], sort_keys=True))


if __name__ == "__main__":
    main()
