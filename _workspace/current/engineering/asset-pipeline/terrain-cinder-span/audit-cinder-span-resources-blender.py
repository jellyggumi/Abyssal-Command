#!/usr/bin/env python3
"""Re-import and verify promoted Cinder Span runtime GLBs in Blender."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


TOLERANCE = 1e-4


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--terrain", type=Path, required=True)
    parser.add_argument("--features", type=Path, required=True)
    parser.add_argument("--props", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    return parser.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def triangles(obj) -> int:
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def bounds(obj) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )


def image_names(material) -> set[str]:
    if material is None or not material.use_nodes:
        return set()
    return {
        node.image.name.lower()
        for node in material.node_tree.nodes
        if node.type == "TEX_IMAGE" and node.image is not None
    }


def mapped_channels(material) -> set[str]:
    names = image_names(material)
    channels = set()
    for name in names:
        if "basecolor" in name or "diffuse" in name:
            channels.add("baseColor")
        if "normal" in name:
            channels.add("normal")
        if "orm" in name:
            channels.update(("occlusion", "roughness", "metallic"))
        if "emission" in name:
            channels.add("emission")
    return channels


def rounded(vector: Vector) -> list[float]:
    return [round(value, 6) for value in vector]


def audit_file(path: Path, kind: str, expected_meshes: int, prefix: str | None = None) -> dict:
    if not path.is_file():
        raise FileNotFoundError(path)
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
    bpy.context.view_layer.update()
    meshes = sorted((obj for obj in bpy.context.scene.objects if obj.type == "MESH"), key=lambda obj: obj.name)
    failures: list[str] = []
    if len(meshes) != expected_meshes:
        failures.append(f"mesh count {len(meshes)} != {expected_meshes}")

    expected_channels = {"baseColor", "normal", "occlusion", "roughness", "metallic"}
    if kind == "terrain":
        expected_channels.add("emission")

    total_vertices = 0
    total_triangles = 0
    union_min = Vector((float("inf"),) * 3)
    union_max = Vector((float("-inf"),) * 3)
    asset_rows = []
    seen_names = set()
    for obj in meshes:
        seen_names.add(obj.name)
        tri_count = triangles(obj)
        total_vertices += len(obj.data.vertices)
        total_triangles += tri_count
        minimum, maximum = bounds(obj)
        for axis in range(3):
            union_min[axis] = min(union_min[axis], minimum[axis])
            union_max[axis] = max(union_max[axis], maximum[axis])
        materials = [slot.material for slot in obj.material_slots if slot.material is not None]
        channels = set().union(*(mapped_channels(material) for material in materials)) if materials else set()
        if not obj.data.uv_layers:
            failures.append(f"{obj.name}: missing UV map")
        if not materials:
            failures.append(f"{obj.name}: missing material")
        missing_channels = expected_channels - channels
        if missing_channels:
            failures.append(f"{obj.name}: missing mapped channels {sorted(missing_channels)}")
        if tri_count <= 1:
            failures.append(f"{obj.name}: legacy fragment with {tri_count} triangle(s)")

        if prefix is not None:
            origin = obj.matrix_world.translation
            center_x = (minimum.x + maximum.x) * 0.5
            center_y = (minimum.y + maximum.y) * 0.5
            if abs(origin.x - center_x) > TOLERANCE or abs(origin.y - center_y) > TOLERANCE or abs(origin.z - minimum.z) > TOLERANCE:
                failures.append(
                    f"{obj.name}: origin {rounded(origin)} is not Blender bottom-center "
                    f"{[round(center_x, 6), round(center_y, 6), round(minimum.z, 6)]}"
                )
        asset_rows.append({
            "node": obj.name,
            "vertices": len(obj.data.vertices),
            "triangles": tri_count,
            "uvLayers": len(obj.data.uv_layers),
            "mappedChannels": sorted(channels),
            "min": rounded(minimum),
            "max": rounded(maximum),
        })

    if prefix is not None:
        expected_names = {f"{prefix}-{index:03d}" for index in range(1, expected_meshes + 1)}
        missing_names = sorted(expected_names - seen_names)
        unexpected_names = sorted(name for name in seen_names if name not in expected_names)
        if missing_names:
            failures.append(f"missing named nodes: {missing_names}")
        if unexpected_names:
            failures.append(f"unexpected mesh nodes: {unexpected_names}")

    return {
        "kind": kind,
        "path": path.as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "meshCount": len(meshes),
        "materialCount": len({slot.material.name for obj in meshes for slot in obj.material_slots if slot.material}),
        "imageCount": len({image.name for image in bpy.data.images if image.source != "VIEWER"}),
        "vertices": total_vertices,
        "triangles": total_triangles,
        "bounds": {"min": rounded(union_min), "max": rounded(union_max)},
        "assets": asset_rows,
        "failures": failures,
        "passed": not failures,
    }


def main() -> None:
    args = parse_args()
    reports = [
        audit_file(args.terrain, "terrain", 70),
        audit_file(args.features, "featurePack", 40, "terrain-cinder-span-feature"),
        audit_file(args.props, "propPack", 50, "terrain-cinder-span-prop"),
    ]
    payload = {
        "schemaVersion": 1,
        "blenderVersion": bpy.app.version_string,
        "tolerance": TOLERANCE,
        "passed": all(report["passed"] for report in reports),
        "resources": reports,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "report": str(args.report.resolve()),
        "passed": payload["passed"],
        "resources": [
            {
                "kind": report["kind"],
                "meshes": report["meshCount"],
                "triangles": report["triangles"],
                "failures": len(report["failures"]),
            }
            for report in reports
        ],
    }, sort_keys=True))
    if not payload["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
