#!/usr/bin/env python3
"""Bind the static `<asset>_pedestal` lower mesh into the skinned character body.

Nineteen runtime characters ship their lower silhouette as `<asset>_pedestal`:
an unskinned, unanimated mesh node that shares the body material.  Because the
node carries no skin and no animation channel it is mathematically frozen, so
every clip tears the character apart at the seam -- measured at 0.19 m to 0.69 m
of seam displacement on the `move` clip while the lower mesh never moves.  That
is the "feet welded to the floor" defect.

This pass transfers skin weights from the body onto the lower mesh and joins the
two into one skinned mesh, so the whole silhouette animates together.  Runtime
GLBs stay read-only; output lands in the candidate lane.

Verification (no Blender required)::

  python3 scripts/bind-static-lower-mesh.py --check

Staging (requires Blender, imports bpy lazily)::

  blender --background --factory-startup --python scripts/bind-static-lower-mesh.py -- --write
"""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path
from typing import Any, Mapping

RUNTIME_ROOT = Path("assets/images/battle/glb")
PIPELINE_ROOT = Path(
    "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline"
)
CANDIDATE_ROOT = PIPELINE_ROOT / "runtime-candidates" / "rigged-lower-mesh"
MANIFEST_NAME = "rigged-lower-mesh.manifest.json"

CHARACTER_CATEGORIES = ("commander", "bosses", "companions", "enemies")
BODY_SUFFIX = "_body"
STATIC_SUFFIX = "_pedestal"
GLB_JSON_CHUNK = 0x4E4F534A
SCHEMA_VERSION = 1

# The joined lower mesh must actually move once bound.  Anything under this on
# the locomotion clip means the weight transfer silently produced zero weights.
MIN_BOUND_DISPLACEMENT = 0.02
MOTION_CLIP_MARKERS = ("::move::", "::run::")
MOTION_SAMPLE_FRAMES = 40

RIGHTS_RECEIPT = "candidate-only-no-promotion-pending-runtime-rights-review"
RUNTIME_RECEIPT = (
    "static-lower-mesh-bound-to-armature-animations-preserved-browser-fallback-pending"
)


class BindError(RuntimeError):
    """Raised when a staging or verification invariant is violated."""


def repository_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "package.json").is_file():
            return parent
    raise BindError("repository root with package.json not found")


def script_argv(argv: list[str] | None = None) -> list[str]:
    values = list(sys.argv[1:] if argv is None else argv)
    if "--" in values:
        return values[values.index("--") + 1 :]
    return values


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_glb_json(path: Path) -> Mapping[str, Any]:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise BindError(f"not a GLB file: {path}")
    version, declared = struct.unpack_from("<II", data, 4)
    if version != 2 or declared != len(data):
        raise BindError(f"invalid GLB header: {path}")
    offset = 12
    document = None
    while offset < len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        start = offset + 8
        end = start + length
        if end > len(data):
            raise BindError(f"truncated GLB chunk: {path}")
        if chunk_type == GLB_JSON_CHUNK:
            document = json.loads(data[start:end].decode("utf-8").rstrip("\0 \t\r\n"))
        offset = end
    if not isinstance(document, dict):
        raise BindError(f"GLB JSON chunk missing: {path}")
    return document


def mesh_records(document: Mapping[str, Any]) -> list[dict[str, Any]]:
    materials = [item.get("name") for item in document.get("materials", [])]
    accessors = document.get("accessors", [])
    records = []
    for node in document.get("nodes", []):
        if "mesh" not in node:
            continue
        mesh = document["meshes"][node["mesh"]]
        for primitive in mesh.get("primitives", []):
            attributes = primitive.get("attributes", {})
            position = accessors[attributes["POSITION"]]
            material_index = primitive.get("material")
            material = document["materials"][material_index] if material_index is not None else {}
            records.append(
                {
                    "node": node.get("name"),
                    "material": materials[material_index] if material_index is not None else None,
                    "skinned": "skin" in node,
                    "triangles": (
                        accessors[primitive["indices"]]["count"] // 3
                        if "indices" in primitive
                        else position["count"] // 3
                    ),
                    "min": position.get("min"),
                    "max": position.get("max"),
                    "hasUv": "TEXCOORD_0" in attributes,
                    "hasJoints": "JOINTS_0" in attributes,
                    "hasBaseColorTexture": "baseColorTexture"
                    in material.get("pbrMetallicRoughness", {}),
                    "hasNormalTexture": "normalTexture" in material,
                }
            )
    return records


def census(document: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "meshes": len(document.get("meshes", [])),
        "materials": len(document.get("materials", [])),
        "skins": len(document.get("skins", [])),
        "animations": len(document.get("animations", [])),
        "animationNames": sorted(item.get("name") for item in document.get("animations", [])),
    }


def merged_bounds(records: list[dict[str, Any]]) -> tuple[list[float], list[float]]:
    lows = [min(item["min"][axis] for item in records) for axis in range(3)]
    highs = [max(item["max"][axis] for item in records) for axis in range(3)]
    return lows, highs


def bounds_equal(left, right, tolerance: float = 1e-4) -> bool:
    left_low, left_high = merged_bounds(left)
    right_low, right_high = merged_bounds(right)
    return all(
        abs(left_low[axis] - right_low[axis]) <= tolerance
        and abs(left_high[axis] - right_high[axis]) <= tolerance
        for axis in range(3)
    )


def plan_rows(root: Path) -> list[dict[str, Any]]:
    runtime_root = root / RUNTIME_ROOT
    rows = []
    for category in CHARACTER_CATEGORIES:
        for source in sorted((runtime_root / category).glob("*.glb")):
            relative_path = f"{category}/{source.name}"
            asset_id = source.stem
            records = mesh_records(read_glb_json(source))
            body = [item for item in records if item["node"] == f"{asset_id}{BODY_SUFFIX}"]
            static = [item for item in records if item["node"] == f"{asset_id}{STATIC_SUFFIX}"]
            if not body:
                raise BindError(f"{relative_path}: no `{asset_id}{BODY_SUFFIX}` node")
            lows, highs = merged_bounds(records)
            rows.append(
                {
                    "relativePath": relative_path,
                    "category": category,
                    "assetId": asset_id,
                    "runtimeSource": (RUNTIME_ROOT / relative_path).as_posix(),
                    "runtimeSourceSha256": sha256(source),
                    "staticLowerMeshPresent": bool(static),
                    "staticTriangles": sum(item["triangles"] for item in static),
                    "bodyTriangles": sum(item["triangles"] for item in body),
                    "staticShareOfSilhouette": (
                        round(
                            (static[0]["max"][1] - static[0]["min"][1]) / (highs[1] - lows[1]), 6
                        )
                        if static
                        else 0.0
                    ),
                    "action": "bind" if static else "already-fully-skinned",
                    "outputPath": (
                        (CANDIDATE_ROOT / "glb" / relative_path).as_posix() if static else None
                    ),
                }
            )
    return rows


def expected_sidecar(row: dict[str, Any], output_sha: str, motion: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "source": row["runtimeSource"],
        "generator": "scripts/bind-static-lower-mesh.py",
        "output": row["outputPath"],
        "outputSha256": output_sha,
        "runtimeSource": row["runtimeSource"],
        "runtimeSourceSha256": row["runtimeSourceSha256"],
        "rightsReceipt": RIGHTS_RECEIPT,
        "runtimeReceipt": RUNTIME_RECEIPT,
        "runtimeEligible": False,
        "fix": "static lower mesh skinned to the character armature and joined into the body",
        "geometryPreserved": True,
        "animationPreserved": True,
        "boundLowerMeshMotion": motion,
    }


def validate_output(row: dict[str, Any], source_document, output_document) -> dict[str, Any]:
    asset_id = row["assetId"]
    before = census(source_document)
    after = census(output_document)
    source_records = mesh_records(source_document)
    output_records = mesh_records(output_document)

    checks = {
        "animationCountEqual": before["animations"] == after["animations"],
        "animationNamesEqual": before["animationNames"] == after["animationNames"],
        "materialCountEqual": before["materials"] == after["materials"],
        "singleSkin": after["skins"] == 1,
        "staticNodeRemoved": all(
            item["node"] != f"{asset_id}{STATIC_SUFFIX}" for item in output_records
        ),
        "singleMeshNode": after["meshes"] == 1,
        "triangleCountPreserved": sum(item["triangles"] for item in source_records)
        == sum(item["triangles"] for item in output_records),
        "silhouetteBoundsPreserved": bounds_equal(source_records, output_records),
        "everyPrimitiveSkinned": all(item["hasJoints"] for item in output_records),
        "everyPrimitiveHasUv": all(item["hasUv"] for item in output_records),
        "everyPrimitiveHasBaseColorTexture": all(
            item["hasBaseColorTexture"] for item in output_records
        ),
        "everyPrimitiveHasNormalTexture": all(item["hasNormalTexture"] for item in output_records),
    }
    failed = [name for name, ok in checks.items() if not ok]
    if failed:
        raise BindError(f"{row['relativePath']}: {', '.join(failed)}")
    return checks


def measure_lower_motion(asset_id: str, seam_height: float) -> dict[str, Any]:
    """Displacement of the formerly static lower vertices over a locomotion clip."""
    import bpy  # noqa: PLC0415

    body = bpy.data.objects.get(f"{asset_id}{BODY_SUFFIX}")
    armature = next((obj for obj in bpy.data.objects if obj.type == "ARMATURE"), None)
    if body is None or armature is None:
        raise BindError(f"{asset_id}: joined body or armature missing for motion measurement")

    def evaluated():
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated_object = body.evaluated_get(depsgraph)
        mesh = evaluated_object.to_mesh()
        points = [body.matrix_world @ vertex.co.copy() for vertex in mesh.vertices]
        evaluated_object.to_mesh_clear()
        return points

    rest = evaluated()
    lower = [index for index, point in enumerate(rest) if point.z <= seam_height]
    if not lower:
        raise BindError(f"{asset_id}: no lower-mesh vertices below the seam height")

    action = next(
        (item for item in bpy.data.actions if any(mark in item.name for mark in MOTION_CLIP_MARKERS)),
        None,
    )
    if action is None:
        raise BindError(f"{asset_id}: no locomotion clip to verify binding")
    if not armature.animation_data:
        armature.animation_data_create()
    armature.animation_data.action = action
    if getattr(action, "slots", None):
        armature.animation_data.action_slot = action.slots[0]

    start = int(action.frame_range[0])
    end = min(int(action.frame_range[1]), start + MOTION_SAMPLE_FRAMES)
    worst = 0.0
    worst_frame = start
    for frame in range(start, end + 1):
        bpy.context.scene.frame_set(frame)
        current = evaluated()
        displacement = max((current[index] - rest[index]).length for index in lower)
        if displacement > worst:
            worst, worst_frame = displacement, frame
    bpy.context.scene.frame_set(start)

    if worst < MIN_BOUND_DISPLACEMENT:
        raise BindError(
            f"{asset_id}: bound lower mesh still static ({worst:.4f} m < {MIN_BOUND_DISPLACEMENT} m)"
        )
    return {
        "clip": action.name,
        "sampledVertices": len(lower),
        "maxDisplacement": round(worst, 4),
        "frame": worst_frame,
    }


def stage_rows(root: Path, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    import bpy  # noqa: PLC0415

    staged = []
    for row in rows:
        if row["action"] != "bind":
            staged.append(row)
            continue

        source = root / row["runtimeSource"]
        output = root / row["outputPath"]
        asset_id = row["assetId"]

        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(source))

        body = bpy.data.objects.get(f"{asset_id}{BODY_SUFFIX}")
        static = bpy.data.objects.get(f"{asset_id}{STATIC_SUFFIX}")
        armature = next((obj for obj in bpy.data.objects if obj.type == "ARMATURE"), None)
        if body is None or static is None or armature is None:
            raise BindError(f"{row['relativePath']}: body/static/armature missing after import")
        seam_height = max(
            (body.matrix_world @ vertex.co).z for vertex in static.data.vertices
        )

        # Weights first: joining before the transfer would leave the lower mesh
        # with empty vertex groups, which reads as "bound" but never deforms.
        bpy.ops.object.select_all(action="DESELECT")
        static.select_set(True)
        body.select_set(True)
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.data_transfer(
            data_type="VGROUP_WEIGHTS",
            use_create=True,
            vert_mapping="POLYINTERP_NEAREST",
            layers_select_src="ALL",
            layers_select_dst="NAME",
            mix_mode="REPLACE",
        )

        if not any(modifier.type == "ARMATURE" for modifier in static.modifiers):
            modifier = static.modifiers.new(name="Armature", type="ARMATURE")
            modifier.object = armature

        bpy.ops.object.select_all(action="DESELECT")
        static.select_set(True)
        body.select_set(True)
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.join()

        motion = measure_lower_motion(asset_id, seam_height)

        output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.export_scene.gltf(
            filepath=str(output),
            export_format="GLB",
            use_selection=True,
            export_materials="EXPORT",
            export_animations=True,
            export_skins=True,
            export_cameras=False,
            export_lights=False,
        )
        if not output.is_file() or output.stat().st_size == 0:
            raise BindError(f"Blender did not produce candidate GLB: {output}")

        checks = validate_output(row, read_glb_json(source), read_glb_json(output))
        output_sha = sha256(output)
        sidecar = output.with_suffix(".provenance.json")
        sidecar.write_text(
            json.dumps(expected_sidecar(row, output_sha, motion), indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        staged.append({**row, "outputSha256": output_sha, "checks": checks, "motion": motion})
    return staged


def verify_rows(root: Path, rows: list[dict[str, Any]], stored_rows: list[dict[str, Any]]):
    stored_by_path = {row.get("relativePath"): row for row in stored_rows}
    verified = []
    for row in rows:
        if row["action"] != "bind":
            verified.append(row)
            continue
        stored = stored_by_path.get(row["relativePath"])
        if stored is None:
            raise BindError(f"manifest is missing a row for {row['relativePath']}")
        if stored.get("runtimeSourceSha256") != row["runtimeSourceSha256"]:
            raise BindError(
                f"runtime GLB changed since staging for {row['relativePath']}; restage the pack"
            )
        output = root / row["outputPath"]
        if not output.is_file():
            raise BindError(f"missing candidate GLB: {output}")
        checks = validate_output(row, read_glb_json(root / row["runtimeSource"]), read_glb_json(output))
        output_sha = sha256(output)
        if stored.get("outputSha256") != output_sha:
            raise BindError(f"candidate GLB changed since staging: {output}")
        motion = stored.get("motion")
        if not isinstance(motion, dict) or motion.get("maxDisplacement", 0) < MIN_BOUND_DISPLACEMENT:
            raise BindError(f"{row['relativePath']}: manifest lacks a passing motion measurement")
        sidecar = output.with_suffix(".provenance.json")
        if not sidecar.is_file():
            raise BindError(f"missing provenance sidecar: {sidecar}")
        expected = json.dumps(expected_sidecar(row, output_sha, motion), indent=2, sort_keys=True) + "\n"
        if sidecar.read_text(encoding="utf-8") != expected:
            raise BindError(f"provenance sidecar drifted: {sidecar}")
        verified.append({**row, "outputSha256": output_sha, "checks": checks, "motion": motion})
    return verified


def write_manifest(root: Path, rows: list[dict[str, Any]]) -> Path:
    manifest_path = root / CANDIDATE_ROOT / MANIFEST_NAME
    bound = [row for row in rows if row["action"] == "bind"]
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedBy": "scripts/bind-static-lower-mesh.py",
        "defect": (
            "`<asset>_pedestal` shipped unskinned and unanimated, so the lower "
            "silhouette stayed frozen while the skinned body played every clip"
        ),
        "runtimeRoot": RUNTIME_ROOT.as_posix(),
        "candidateRoot": CANDIDATE_ROOT.as_posix(),
        "minBoundDisplacement": MIN_BOUND_DISPLACEMENT,
        "characterCount": len(rows),
        "boundCount": len(bound),
        "alreadyFullySkinnedCount": len(rows) - len(bound),
        "runtimeEligible": False,
        "rows": rows,
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Bind static lower character meshes to the rig")
    parser.add_argument("--write", action="store_true", help="stage candidates (requires Blender)")
    parser.add_argument("--check", action="store_true", help="verify staged candidates")
    args = parser.parse_args(script_argv(argv))
    if args.write == args.check:
        raise BindError("choose exactly one of --write or --check")

    root = repository_root()
    rows = plan_rows(root)
    manifest_path = root / CANDIDATE_ROOT / MANIFEST_NAME

    if args.write:
        rows = stage_rows(root, rows)
        manifest_path = write_manifest(root, rows)
    else:
        if not manifest_path.is_file():
            raise BindError(f"manifest is missing: {manifest_path}")
        stored = json.loads(manifest_path.read_text(encoding="utf-8"))
        rows = verify_rows(root, rows, stored.get("rows", []))
        bound = len([row for row in rows if row["action"] == "bind"])
        if stored.get("boundCount") != bound:
            raise BindError("manifest boundCount disagrees with the runtime tree")

    bound_rows = [row for row in rows if row["action"] == "bind"]
    print(
        json.dumps(
            {
                "manifest": manifest_path.relative_to(root).as_posix(),
                "characters": len(rows),
                "bound": len(bound_rows),
                "minDisplacement": round(
                    min((row["motion"]["maxDisplacement"] for row in bound_rows), default=0.0), 4
                ),
                "checked": bool(args.check),
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BindError as error:
        print(f"error: {error}", file=sys.stderr)
        sys.exit(1)
