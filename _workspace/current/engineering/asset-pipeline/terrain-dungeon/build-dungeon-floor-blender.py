#!/usr/bin/env python3
"""Compose a flat, gameplay-eligible dungeon floor GLB from rectified slab tiles.

Run under Blender:

    /Applications/Blender.app/Contents/MacOS/Blender -b -P build-dungeon-floor-blender.py -- \
        --manifest .../cinder-span.slabs.json \
        --texture-dir .../deprojected \
        --out .../terrain-cinder-span-floor.glb

Why this exists
---------------
`stage-world-catalog.js` marks all three stage terrains `terrainRuntimeEligible: false`
(`authored-diorama-not-flat-gameplay-eligible` for cinder-span,
`source-candidate-not-runtime-eligible` for the other two), so the runtime falls back
to a single procedural plane and the battle floor reads as one flat quad. The feature
and prop packs already load; only the ground is missing. Re-exporting the same diorama
and flipping the flag would reintroduce the defect that caused the fallback, so this
builds the missing artifact instead: a flat gameplay surface composed of authored slabs.

Coordinate contract — the part that is easy to get wrong
--------------------------------------------------------
The floor must be authored in **renderer world coordinates**, not gameplay units.

`fitFootprint` (`battle-realtime-three.js`) applies a **uniform** scale
`(TERRAIN_TARGET_HALF_EXTENT * 2) / max(sizeX, sizeZ)` = `32.2 / max(sizeX, sizeZ)`,
while actors are placed **per axis** by `worldPointInto`:

    worldX = (gameplayX / 24000 * 2 - 1) * 14
    worldZ = (gameplayY / 12000 * 2 - 1) * 14

Both axes normalise by their own dimension, so the 2:1 gameplay arena renders as a
28x28 world square. A floor authored at 2:1 would be scaled by one factor for both
axes and land nowhere near the actors.

So: author every vertex through the same two formulas above, then extend the mesh by a
non-walkable **apron** sized so the larger axis is exactly 32.2 world units. `fitFootprint`
then resolves to scale 1.000000 and the walkable rect lands precisely where actors go.
The apron carries no collider and no gameplay meaning; it exists to pin the fit.

Blender is Z-up and the glTF exporter runs with `export_yup=True`, which maps
Blender (x, y, z) to glTF (x, z, -y). Authoring `blenderY = -worldZ` therefore yields
`gltfZ = worldZ`. The builder asserts the exported orientation rather than trusting it.

UV lattice
----------
UVs come from one global lattice anchored at gameplay (0, 0) with period 2000 gameplay
units on X and 1000 on Y — square on screen, because each axis normalises by its own
dimension. Repeat and offset are **derived from the rect**, never hand-authored, so the
stone pattern is continuous across every seam by construction:

    repeatU = (maxX - minX) / 2000      offsetU = minX / 2000
    repeatV = (maxY - minY) / 1000      offsetV = minY / 1000

Manifest contract
-----------------
```json
{
  "schemaVersion": 2,
  "stageId": "cinder-span",
  "arena": { "width": 24000, "height": 12000 },
  "bounds": { "minX": 600, "maxX": 23400, "minY": 800, "maxY": 11200 },
  "apron": { "x": 2400, "y": 1200 },
  "slabs": [
    {
      "id": "cinder-span:slab-01",
      "material": "ash-drift",
      "texture": "cinder-span-floor",
      "rect": { "minX": 600, "maxX": 8600, "minY": 800, "maxY": 11200 },
      "rotationTurns": 2,
      "tint": [1.0, 0.96, 0.92]
    }
  ]
}
```

Slabs must tile `bounds` with no gap and no overlap. A gap in a flat floor is an
invisible pit in a game that forbids elevation change, so the builder refuses to
write one. Two adjacent slabs sharing a material must share `rotationTurns`, or the
global UV lattice discontinues at their seam.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import bpy

GAMEPLAY_ELEVATION = 0.0
WORLD_SCALE = 14.0
ARENA_WIDTH = 24000.0
ARENA_HEIGHT = 12000.0
TERRAIN_TARGET_HALF_EXTENT = WORLD_SCALE * 1.15  # 16.1, matches battle-realtime-three.js
LATTICE_PERIOD_X = 2000.0
LATTICE_PERIOD_Y = 1000.0
FIT_SCALE_TOLERANCE = 1e-4


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Compose a flat dungeon floor GLB from slab tiles.")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--texture-dir", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--report", type=Path, default=None)
    parser.add_argument("--subdivisions", type=int, default=1, help="grid cuts per slab edge")
    return parser.parse_args(argv)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def world_x(gameplay_x: float) -> float:
    return (gameplay_x / ARENA_WIDTH * 2.0 - 1.0) * WORLD_SCALE


def world_z(gameplay_y: float) -> float:
    return (gameplay_y / ARENA_HEIGHT * 2.0 - 1.0) * WORLD_SCALE


def rect_area(rect: dict) -> float:
    return (rect["maxX"] - rect["minX"]) * (rect["maxY"] - rect["minY"])


def rects_overlap(a: dict, b: dict) -> bool:
    return a["minX"] < b["maxX"] and b["minX"] < a["maxX"] and a["minY"] < b["maxY"] and b["minY"] < a["maxY"]


def rects_adjacent(a: dict, b: dict) -> bool:
    """True when the two rects share a positive-length edge."""
    share_x = a["maxX"] == b["minX"] or b["maxX"] == a["minX"]
    share_y = a["maxY"] == b["minY"] or b["maxY"] == a["minY"]
    overlap_y = min(a["maxY"], b["maxY"]) - max(a["minY"], b["minY"]) > 0
    overlap_x = min(a["maxX"], b["maxX"]) - max(a["minX"], b["minX"]) > 0
    return (share_x and overlap_y) or (share_y and overlap_x)


def validate_manifest(manifest: dict) -> dict:
    slabs = manifest["slabs"]
    if not slabs:
        raise SystemExit("manifest declares no slabs")
    bounds = manifest["bounds"]

    seen: set[str] = set()
    for slab in slabs:
        if slab["id"] in seen:
            raise SystemExit(f"duplicate slab id: {slab['id']}")
        seen.add(slab["id"])
        rect = slab["rect"]
        if rect["maxX"] <= rect["minX"] or rect["maxY"] <= rect["minY"]:
            raise SystemExit(f"slab {slab['id']} has a degenerate rect")
        if not (
            bounds["minX"] <= rect["minX"] < rect["maxX"] <= bounds["maxX"]
            and bounds["minY"] <= rect["minY"] < rect["maxY"] <= bounds["maxY"]
        ):
            raise SystemExit(f"slab {slab['id']} escapes the declared stage bounds")

    for index, left in enumerate(slabs):
        for right in slabs[index + 1 :]:
            if rects_overlap(left["rect"], right["rect"]):
                raise SystemExit(f"slabs overlap: {left['id']} and {right['id']}")
            if (
                left["material"] == right["material"]
                and rects_adjacent(left["rect"], right["rect"])
                and int(left.get("rotationTurns", 0)) % 4 != int(right.get("rotationTurns", 0)) % 4
            ):
                raise SystemExit(
                    f"{left['id']} and {right['id']} share material {left['material']!r} across a seam "
                    "but disagree on rotationTurns; the global UV lattice would discontinue"
                )

    covered = sum(rect_area(slab["rect"]) for slab in slabs)
    declared = rect_area(bounds)
    if abs(covered - declared) > 1.0:
        raise SystemExit(
            f"slabs cover {covered:.0f} of {declared:.0f} sq units of the declared bounds; "
            "a gap in a flat floor is an invisible pit"
        )
    return {"bounds": bounds, "coveredArea": covered, "declaredArea": declared}


def build_material(name: str, texture: Path, tint: list[float]) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (600, 0)
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.location = (300, 0)
    principled.inputs["Roughness"].default_value = 0.72
    principled.inputs["Metallic"].default_value = 0.05

    image_node = nodes.new("ShaderNodeTexImage")
    image_node.location = (-260, 0)
    image_node.image = bpy.data.images.load(str(texture))
    image_node.extension = "REPEAT"

    mix = nodes.new("ShaderNodeMixRGB")
    mix.location = (40, 0)
    mix.blend_type = "MULTIPLY"
    mix.inputs["Fac"].default_value = 1.0
    mix.inputs["Color2"].default_value = (*tint, 1.0)

    links.new(image_node.outputs["Color"], mix.inputs["Color1"])
    links.new(mix.outputs["Color"], principled.inputs["Base Color"])
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    return material


def add_quad(name: str, rect: dict, subdivisions: int) -> bpy.types.Object:
    """A flat quad spanning `rect` in gameplay units, authored in renderer world space."""
    x0, x1 = world_x(rect["minX"]), world_x(rect["maxX"])
    # glTF z = -blenderY under export_yup, so author blenderY = -worldZ.
    y0, y1 = -world_z(rect["minY"]), -world_z(rect["maxY"])

    bpy.ops.mesh.primitive_grid_add(
        x_subdivisions=max(1, subdivisions),
        y_subdivisions=max(1, subdivisions),
        size=1.0,
        location=((x0 + x1) / 2, (y0 + y1) / 2, GAMEPLAY_ELEVATION),
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name  # the exporter names primitives from the mesh datablock
    obj.scale = (abs(x1 - x0), abs(y1 - y0), 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for vertex in obj.data.vertices:
        vertex.co.z = GAMEPLAY_ELEVATION
    return obj


def apply_lattice_uv(obj: bpy.types.Object, rect: dict, turns: int) -> dict:
    """Derive UVs from the global lattice so the pattern is continuous across seams."""
    repeat_u = (rect["maxX"] - rect["minX"]) / LATTICE_PERIOD_X
    repeat_v = (rect["maxY"] - rect["minY"]) / LATTICE_PERIOD_Y
    offset_u = rect["minX"] / LATTICE_PERIOD_X
    offset_v = rect["minY"] / LATTICE_PERIOD_Y

    uv_layer = obj.data.uv_layers.active or obj.data.uv_layers.new(name="UVMap")
    for loop_uv in uv_layer.data:
        u, v = loop_uv.uv
        for _ in range(turns % 4):
            u, v = v, 1.0 - u
        loop_uv.uv = (offset_u + u * repeat_u, offset_v + v * repeat_v)
    return {"repeat": [repeat_u, repeat_v], "offset": [offset_u, offset_v], "rotationTurns": turns % 4}


def main() -> None:
    args = parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    geometry = validate_manifest(manifest)
    stage_id = manifest["stageId"]
    bounds = manifest["bounds"]
    apron = manifest.get("apron") or {"x": 0, "y": 0}

    bpy.ops.wm.read_factory_settings(use_empty=True)

    built = []
    for index, slab in enumerate(manifest["slabs"], start=1):
        node = f"terrain-{stage_id}-slab-{index:03d}"
        obj = add_quad(node, slab["rect"], args.subdivisions)
        uv = apply_lattice_uv(obj, slab["rect"], int(slab.get("rotationTurns", 0)))
        texture = args.texture_dir / f"{slab['texture']}-albedo.png"
        if not texture.is_file():
            raise SystemExit(f"slab {slab['id']} references a missing texture: {texture}")
        obj.data.materials.append(
            build_material(f"mat-{slab['material']}-{index:03d}", texture, slab.get("tint", [1.0, 1.0, 1.0]))
        )
        built.append(
            {
                "slabId": slab["id"],
                "node": node,
                "material": slab["material"],
                "rect": slab["rect"],
                "uv": uv,
                "walkable": True,
                "vertices": len(obj.data.vertices),
                "polygons": len(obj.data.polygons),
            }
        )

    # Non-walkable apron. It exists only to make the larger world axis exactly
    # TERRAIN_TARGET_HALF_EXTENT * 2, so fitFootprint resolves to scale 1.0 and the
    # walkable rect lands exactly where worldPointInto puts actors.
    apron_rect = {
        "minX": bounds["minX"] - apron["x"],
        "maxX": bounds["maxX"] + apron["x"],
        "minY": bounds["minY"] - apron["y"],
        "maxY": bounds["maxY"] + apron["y"],
    }
    apron_node = f"terrain-{stage_id}-apron-001"
    apron_obj = add_quad(apron_node, apron_rect, 1)
    apron_uv = apply_lattice_uv(apron_obj, apron_rect, 0)
    apron_texture = args.texture_dir / f"{manifest['slabs'][0]['texture']}-albedo.png"
    apron_obj.data.materials.append(build_material(f"mat-{stage_id}-apron", apron_texture, [0.42, 0.42, 0.46]))
    # Sits a hair below the walkable slabs so it can never z-fight with them, while
    # still reporting elevation 0 to gameplay -- it is presentation only.
    apron_obj.location.z = -0.002

    span_x = abs(world_x(apron_rect["maxX"]) - world_x(apron_rect["minX"]))
    span_z = abs(world_z(apron_rect["maxY"]) - world_z(apron_rect["minY"]))
    fit_scale = (TERRAIN_TARGET_HALF_EXTENT * 2) / max(span_x, span_z)
    if abs(fit_scale - 1.0) > FIT_SCALE_TOLERANCE:
        raise SystemExit(
            f"apron gives world span {span_x:.4f} x {span_z:.4f}, so fitFootprint would scale by "
            f"{fit_scale:.6f} instead of 1.0; the floor would not align with actor placement"
        )

    walkable_elevations = {
        round(vertex.co.z, 6)
        for entry in built
        for vertex in bpy.data.objects[entry["node"]].data.vertices
    }
    if walkable_elevations != {GAMEPLAY_ELEVATION}:
        raise SystemExit(f"walkable floor is not coplanar; found elevations {sorted(walkable_elevations)}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(args.out),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        # Keep the albedo lossless. JPEG quantizes DCT blocks on opposite edges
        # independently, which destroys the wrap continuity the de-projection
        # guarantees: measured mean-abs seam error rose from 0.0000 to 1.3792 at q88
        # and 1.1120 at q95 on the same tile. Tile weight is controlled upstream by
        # --tile-size in deproject-terrain-plate.py; a 512 PNG is 509 KB and seams at 0.
        export_image_format="AUTO",
    )
    if not args.out.is_file() or args.out.stat().st_size == 0:
        raise SystemExit(f"export produced no file: {args.out}")

    report = {
        "schemaVersion": 2,
        "stageId": stage_id,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "tool": "build-dungeon-floor-blender.py",
        "blender": bpy.app.version_string,
        "manifest": {"path": str(args.manifest), "sha256": sha256(args.manifest)},
        "surface": {
            "kind": "flat-gameplay-floor",
            "gameplayElevation": GAMEPLAY_ELEVATION,
            "coplanar": True,
            "coordinateSpace": "renderer-world",
            "worldScale": WORLD_SCALE,
            "bounds": bounds,
            "apron": apron,
            "apronRect": apron_rect,
            "worldSpan": {"x": span_x, "z": span_z},
            "fitFootprintScale": fit_scale,
            "coveredArea": geometry["coveredArea"],
            "declaredArea": geometry["declaredArea"],
            "uvLattice": {"periodX": LATTICE_PERIOD_X, "periodY": LATTICE_PERIOD_Y, "anchor": [0, 0]},
        },
        "slabs": built,
        "apronNode": {"node": apron_node, "rect": apron_rect, "uv": apron_uv, "walkable": False},
        "output": {"path": str(args.out), "bytes": args.out.stat().st_size, "sha256": sha256(args.out)},
        "totals": {
            "slabCount": len(built),
            "vertices": sum(entry["vertices"] for entry in built),
            "polygons": sum(entry["polygons"] for entry in built),
        },
    }
    report_path = args.report or args.out.with_suffix(".build-report.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"stage {stage_id}: {len(built)} walkable slabs + 1 apron, coplanar at z={GAMEPLAY_ELEVATION}")
    for entry in built:
        repeat = entry["uv"]["repeat"]
        print(f"  {entry['node']}  {entry['material']:<16} uv {repeat[0]:.2f}x{repeat[1]:.2f}  turns {entry['uv']['rotationTurns']}")
    print(f"  {apron_node}  (non-walkable apron)")
    print(f"world span {span_x:.4f} x {span_z:.4f} -> fitFootprint scale {fit_scale:.6f}")
    print(f"wrote {args.out} ({report['output']['bytes']} bytes)")
    print(f"wrote {report_path}")


if __name__ == "__main__":
    main()
