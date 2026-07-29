#!/usr/bin/env python3
"""Split a merged terrain OBJ into individually placeable part files.

## Why

`battle-realtime-three.js:1024 instantiateTerrainModel()` loads
`assets/mesh/terrain/terrain-cinder-span/.../obj/base.obj` as ONE object and clones it
whole. That file is not one prop -- it holds **160 connected components, 88 of them
larger than 20 faces** (measured). So the stage cannot place a lantern here and a bridge
rib there; it can only place the entire terrain blob at one transform.

That is the merged-OBJ placement the direction rules out: parts must be positioned
individually. This script is the enabling step -- it decomposes the merged file into one
OBJ per component so the runtime (and any authoring pass) can address parts by name.

## What it does

- Parses `v`/`vn`/`vt`/`f` only. No materials are rewritten: every part keeps the shared
  `textureBasicPack`, so the material contract is unchanged.
- Unions faces by shared vertex index to find connected components, exactly the measurement
  that motivated the split.
- Emits one `part-NNN.obj` per component above `--min-faces`, with vertex indices remapped
  to a local 1-based range so each file is independently loadable.
- Writes `parts-manifest.json` recording, per part: face count, vertex count, local-space
  bounding box, and centroid. The centroid is what a placement pass needs in order to put a
  part back at its authored position, so the split is reversible by construction.
- Components at or below `--min-faces` are collected into `part-debris.obj` rather than
  dropped, so no geometry is lost.

Nothing under `assets/` is modified: output goes to a directory the caller names, in the
concept/authoring lane, and promotion into the runtime allowlist is a separate audited step
(CLAUDE.md §3).

Run:
  python3 scripts/split-terrain-obj-parts.py --check
  python3 scripts/split-terrain-obj-parts.py --write \
    --obj assets/mesh/terrain/terrain-cinder-span/terrain-cinder-span-object/object/obj/base.obj \
    --out _workspace/current/engineering/asset-pipeline/terrain-parts/cinder-span
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

DEFAULT_OBJ = (
    "assets/mesh/terrain/terrain-cinder-span/terrain-cinder-span-object/object/obj/base.obj"
)
DEFAULT_OUT = "_workspace/current/engineering/asset-pipeline/terrain-parts/cinder-span"
# Components at or below this face count are cosmetic debris (measured: the character meshes
# carry 10 single-face strays). They are written to one debris file rather than 100 tiny ones.
DEFAULT_MIN_FACES = 20


def repository_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "package.json").is_file():
            return parent
    raise SystemExit("repository root (package.json) not found")


ROOT = repository_root()


class DisjointSet:
    """Union-find over vertex indices, for connected-component discovery."""

    def __init__(self) -> None:
        self.parent: dict[int, int] = {}

    def find(self, item: int) -> int:
        root = item
        while self.parent.get(root, root) != root:
            root = self.parent[root]
        # Path compression keeps this linear for meshes with long face chains.
        while self.parent.get(item, item) != item:
            self.parent[item], item = root, self.parent[item]
        return root

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[ra] = rb


def parse_obj(path: Path) -> dict[str, Any]:
    positions: list[tuple[float, float, float]] = []
    normals: list[str] = []
    uvs: list[str] = []
    faces: list[list[tuple[int, int | None, int | None]]] = []

    def index(raw: str, total: int) -> int:
        value = int(raw)
        # OBJ allows negative (relative) indices.
        return value if value > 0 else total + value + 1

    with path.open("r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            if line.startswith("v "):
                parts = line.split()
                positions.append((float(parts[1]), float(parts[2]), float(parts[3])))
            elif line.startswith("vn "):
                normals.append(line.rstrip("\n"))
            elif line.startswith("vt "):
                uvs.append(line.rstrip("\n"))
            elif line.startswith("f "):
                corners: list[tuple[int, int | None, int | None]] = []
                for token in line.split()[1:]:
                    bits = token.split("/")
                    v = index(bits[0], len(positions))
                    t = index(bits[1], len(uvs)) if len(bits) > 1 and bits[1] else None
                    n = index(bits[2], len(normals)) if len(bits) > 2 and bits[2] else None
                    corners.append((v, t, n))
                if len(corners) >= 3:
                    faces.append(corners)
    return {"positions": positions, "normals": normals, "uvs": uvs, "faces": faces}


def components(faces: list[list[tuple[int, int | None, int | None]]]) -> dict[int, list[int]]:
    sets = DisjointSet()
    for face in faces:
        first = face[0][0]
        for corner in face[1:]:
            sets.union(first, corner[0])
    grouped: dict[int, list[int]] = {}
    for face_index, face in enumerate(faces):
        grouped.setdefault(sets.find(face[0][0]), []).append(face_index)
    return grouped


def write_part(
    out_path: Path,
    mesh: dict[str, Any],
    face_indices: list[int],
    part_name: str,
) -> dict[str, Any]:
    positions = mesh["positions"]
    faces = mesh["faces"]

    vertex_map: dict[int, int] = {}
    uv_map: dict[int, int] = {}
    normal_map: dict[int, int] = {}
    lines: list[str] = [f"# split from a merged terrain OBJ by scripts/split-terrain-obj-parts.py",
                        f"o {part_name}"]
    body: list[str] = []

    for face_index in face_indices:
        tokens: list[str] = []
        for v, t, n in faces[face_index]:
            if v not in vertex_map:
                vertex_map[v] = len(vertex_map) + 1
                x, y, z = positions[v - 1]
                lines.append(f"v {x:.6f} {y:.6f} {z:.6f}")
            if t is not None and t not in uv_map:
                uv_map[t] = len(uv_map) + 1
            if n is not None and n not in normal_map:
                normal_map[n] = len(normal_map) + 1
            piece = str(vertex_map[v])
            if t is not None or n is not None:
                piece += "/" + (str(uv_map[t]) if t is not None else "")
                if n is not None:
                    piece += "/" + str(normal_map[n])
            tokens.append(piece)
        body.append("f " + " ".join(tokens))

    # Emit the referenced uv/normal blocks in local order, after positions.
    for source_map, source_list in ((uv_map, mesh["uvs"]), (normal_map, mesh["normals"])):
        for original in sorted(source_map, key=lambda key: source_map[key]):
            if 1 <= original <= len(source_list):
                lines.append(source_list[original - 1])

    lines.extend(body)
    out_path.write_text("\n".join(lines) + "\n")

    xs = [positions[v - 1][0] for v in vertex_map]
    ys = [positions[v - 1][1] for v in vertex_map]
    zs = [positions[v - 1][2] for v in vertex_map]
    return {
        "part": part_name,
        "file": out_path.name,
        "faces": len(face_indices),
        "vertices": len(vertex_map),
        # Centroid is what a placement pass needs to restore the authored position, so the
        # split stays reversible.
        "centroid": [round(sum(xs) / len(xs), 6), round(sum(ys) / len(ys), 6), round(sum(zs) / len(zs), 6)],
        "boundingBox": {
            "min": [round(min(xs), 6), round(min(ys), 6), round(min(zs), 6)],
            "max": [round(max(xs), 6), round(max(ys), 6), round(max(zs), 6)],
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Split a merged terrain OBJ into placeable parts")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help="emit part files")
    mode.add_argument("--check", action="store_true", help="report the decomposition only")
    parser.add_argument("--obj", default=DEFAULT_OBJ)
    parser.add_argument("--out", default=DEFAULT_OUT)
    parser.add_argument("--min-faces", type=int, default=DEFAULT_MIN_FACES)
    args = parser.parse_args(argv)

    obj_path = Path(args.obj)
    if not obj_path.is_absolute():
        obj_path = ROOT / obj_path
    if not obj_path.is_file():
        raise SystemExit(f"OBJ not found: {obj_path}")

    mesh = parse_obj(obj_path)
    grouped = components(mesh["faces"])
    sized = sorted(grouped.items(), key=lambda kv: -len(kv[1]))
    keep = [(root, faces) for root, faces in sized if len(faces) > args.min_faces]
    debris = [face for root, faces in sized if len(faces) <= args.min_faces for face in faces]

    print(f"source            {obj_path.relative_to(ROOT)}")
    print(f"faces             {len(mesh['faces'])}")
    print(f"components        {len(grouped)}")
    print(f"parts (> {args.min_faces} faces) {len(keep)}")
    print(f"debris faces      {len(debris)}")

    if not args.write:
        for index, (_, faces) in enumerate(keep[:12]):
            print(f"  part-{index:03d}  {len(faces)} faces")
        if len(keep) > 12:
            print(f"  ... {len(keep) - 12} more")
        return 0

    out_dir = Path(args.out)
    if not out_dir.is_absolute():
        out_dir = ROOT / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = []
    for index, (_, faces) in enumerate(keep):
        name = f"part-{index:03d}"
        rows.append(write_part(out_dir / f"{name}.obj", mesh, faces, name))
    if debris:
        rows.append(write_part(out_dir / "part-debris.obj", mesh, debris, "part-debris"))

    manifest = {
        "schemaVersion": 1,
        "generatedBy": "scripts/split-terrain-obj-parts.py",
        "source": str(obj_path.relative_to(ROOT)),
        "minFaces": args.min_faces,
        "sourceFaces": len(mesh["faces"]),
        "sourceComponents": len(grouped),
        "partCount": len(rows),
        "runtimeEligible": False,
        "note": (
            "Authoring output. Promotion into the runtime allowlist requires the four-file "
            "allowlist update (defense-runtime-assets.mjs RETAINED_ASSET_PATHS, "
            "assets/defense-asset-manifest.json, static.yml PAGES_RUNTIME_PATHS, sw.js "
            "CORE_ASSETS) plus a provenance/rights receipt per CLAUDE.md 3."
        ),
        "parts": rows,
    }
    (out_dir / "parts-manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")

    total = sum(row["faces"] for row in rows)
    print(f"wrote             {len(rows)} files -> {out_dir.relative_to(ROOT)}")
    print(f"face conservation {total} of {len(mesh['faces'])} " + ("OK" if total == len(mesh["faces"]) else "MISMATCH"))
    return 0 if total == len(mesh["faces"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
