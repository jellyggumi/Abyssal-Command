#!/usr/bin/env python3
"""Build a portable terrain OBJ/GLB from the Abyss Chancel raw-image composition.

The isometric input is visual reference, not a height map. This exporter creates the
validated 3:2 planar terrain surface required for direct UV mapping, then applies
the generated seamless albedo that was derived from that reference.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path

import bpy


PIPELINE_PATH = Path(__file__).resolve().with_name("build-abyss-chancel-terrain.py")
PROJECT_ROOT = PIPELINE_PATH.parents[5]
FOOTPRINT_MIN_X = -0.943801
FOOTPRINT_MAX_X = 0.937226
FOOTPRINT_MIN_Z = 0.0
FOOTPRINT_MAX_Z = 1.239477
SURFACE_Y = 0.129146
GRID_X_SEGMENTS = 24
GRID_Z_SEGMENTS = 16


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
    parser.add_argument("--raw-image", type=Path, required=True)
    parser.add_argument("--texture", type=Path, required=True)
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


def create_planar_mesh() -> object:
    width = FOOTPRINT_MAX_X - FOOTPRINT_MIN_X
    depth = FOOTPRINT_MAX_Z - FOOTPRINT_MIN_Z
    vertices = []
    for z_index in range(GRID_Z_SEGMENTS + 1):
        z = FOOTPRINT_MIN_Z + depth * z_index / GRID_Z_SEGMENTS
        for x_index in range(GRID_X_SEGMENTS + 1):
            x = FOOTPRINT_MIN_X + width * x_index / GRID_X_SEGMENTS
            vertices.append((x, SURFACE_Y, z))

    faces = []
    row_width = GRID_X_SEGMENTS + 1
    for z_index in range(GRID_Z_SEGMENTS):
        for x_index in range(GRID_X_SEGMENTS):
            lower_left = z_index * row_width + x_index
            faces.append((
                lower_left,
                lower_left + row_width,
                lower_left + row_width + 1,
                lower_left + 1,
            ))

    mesh = bpy.data.meshes.new("TerrainAbyssChancelRawImagePlane_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        vertex = mesh.vertices[loop.vertex_index].co
        uv_layer.data[loop.index].uv = (
            (vertex.x - FOOTPRINT_MIN_X) / width,
            (vertex.z - FOOTPRINT_MIN_Z) / depth,
        )
    terrain = bpy.data.objects.new("TerrainAbyssChancelRawImagePlane", mesh)
    bpy.context.collection.objects.link(terrain)
    return terrain


def rewrite_mtl_texture_path(path: Path, texture: Path) -> None:
    texture_directory = os.path.relpath(texture.parent, start=path.parent)
    texture_target = (Path(texture_directory) / texture.name).as_posix()
    lines = path.read_text(encoding="utf-8").splitlines()
    rewritten = [
        f"map_Kd {texture_target}" if line.startswith("map_Kd ") else line
        for line in lines
    ]
    path.write_text("\n".join(rewritten) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    raw_image = require_file(args.raw_image, "raw terrain image")
    texture = require_file(args.texture, "terrain albedo")
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    terrain = create_planar_mesh()
    terrain["visualReferenceImage"] = relative(raw_image)
    terrain["geometrySource"] = "procedural planar grid aligned to terrain footprint"
    material = pipeline.principled_texture_material(
        "abyss_chancel_terrain_raw_image_plane",
        texture,
        roughness=0.73,
        metallic=0.08,
    )
    material["sourceTexture"] = f"terrain/textures/{texture.name}"
    terrain.data.materials.append(material)

    pipeline.select_only(terrain)
    obj_path = out / "terrain-abyss-chancel-raw-image-plane.obj"
    glb_path = out / "terrain-abyss-chancel-raw-image-plane.glb"
    pipeline.export_obj(obj_path)
    rewrite_mtl_texture_path(obj_path.with_suffix(".mtl"), texture)
    pipeline.export_glb(glb_path)

    report = {
        "assetId": "terrain-abyss-chancel-raw-image-plane",
        "runtimeEligible": False,
        "referenceImage": receipt(raw_image),
        "geometrySource": {
            "kind": "procedural planar grid aligned to terrain footprint",
            "axes": ["x", "z"],
            "surfaceY": SURFACE_Y,
            "minX": FOOTPRINT_MIN_X,
            "maxX": FOOTPRINT_MAX_X,
            "minZ": FOOTPRINT_MIN_Z,
            "maxZ": FOOTPRINT_MAX_Z,
            "xSegments": GRID_X_SEGMENTS,
            "zSegments": GRID_Z_SEGMENTS,
            "textureAspectRatio": 1.5,
            "footprintAspectRatio": round((FOOTPRINT_MAX_X - FOOTPRINT_MIN_X) / (FOOTPRINT_MAX_Z - FOOTPRINT_MIN_Z), 6),
            "textureStretchPercent": round((((FOOTPRINT_MAX_X - FOOTPRINT_MIN_X) / (FOOTPRINT_MAX_Z - FOOTPRINT_MIN_Z)) / 1.5 - 1) * 100, 3),
        },
        "texture": receipt(texture),
        "object": pipeline.mesh_summary(terrain),
        "outputs": {
            "obj": receipt(obj_path),
            "mtl": receipt(obj_path.with_suffix(".mtl")),
            "glb": receipt(glb_path),
        },
        "material": material.name,
        "textureMappedUv": terrain.data.uv_layers.active.name,
    }
    report_path = out / "terrain-abyss-chancel-raw-image-plane-report.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"report": relative(report_path), "obj": relative(obj_path), "glb": relative(glb_path)}, sort_keys=True))


if __name__ == "__main__":
    main()
