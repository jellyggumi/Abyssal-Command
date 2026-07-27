#!/usr/bin/env python3
"""Promote the reviewed character candidates into the runtime asset lane.

Two candidate passes are composed here:

  scripts/bind-static-lower-mesh.py       -- skins the frozen `<asset>_pedestal`
                                             lower mesh into the character body
  scripts/author-wholebody-clips-blender.py -- gives every clip a working second
                                             half instead of a frozen one

The commander is deliberately NOT promoted: its clips come from the dedicated
`player-combat-animation-candidate/author_player_combat_clips.py` pipeline and
its deployed bytes are pinned by four assertions in
tests/commander-guard-pose.test.mjs, including a guard-pose correction. Bulk
promotion would silently overwrite that authored work.

Runtime GLB provenance is recorded the way terrain already records it, so
scripts/audit-stage-scenes.mjs can verify promoted characters against their own
build record instead of the texture-pass audit that no longer produced them.

  python3 scripts/promote-character-assets.py            # promote
  python3 scripts/promote-character-assets.py --check    # verify only
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path
from typing import Any, Mapping

RUNTIME_ROOT = Path("assets/images/battle/glb")
PIPELINE_ROOT = Path(
    "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline"
)
WHOLEBODY_MANIFEST = (
    PIPELINE_ROOT / "runtime-candidates" / "wholebody-motion" / "wholebody-motion.manifest.json"
)
RIGGED_MANIFEST = (
    PIPELINE_ROOT / "runtime-candidates" / "rigged-lower-mesh" / "rigged-lower-mesh.manifest.json"
)
PROVENANCE_PATH = RUNTIME_ROOT / "character-build-provenance.json"

# Every character is promoted. The commander additionally carries the upstream
# stage that authored its two commander-only strike clips and its guard-pose
# correction, so the chain stays visible in the build record.
EXCLUDED_ASSET_IDS: tuple[str, ...] = ()
UPSTREAM_PIPELINE = {
    "dusk-warden": (
        "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline"
        "/player-combat-animation-candidate/author_player_combat_clips.py"
    ),
}
GLB_JSON_CHUNK = 0x4E4F534A
SCHEMA_VERSION = 1


class PromoteError(RuntimeError):
    """Raised when a promotion or verification invariant is violated."""


def repository_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "package.json").is_file():
            return parent
    raise PromoteError("repository root with package.json not found")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_glb_json(path: Path) -> Mapping[str, Any]:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise PromoteError(f"not a GLB file: {path}")
    version, declared = struct.unpack_from("<II", data, 4)
    if version != 2 or declared != len(data):
        raise PromoteError(f"invalid GLB header: {path}")
    offset = 12
    document = None
    while offset < len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        start = offset + 8
        end = start + length
        if end > len(data):
            raise PromoteError(f"truncated GLB chunk: {path}")
        if chunk_type == GLB_JSON_CHUNK:
            document = json.loads(data[start:end].decode("utf-8").rstrip("\0 \t\r\n"))
        offset = end
    if not isinstance(document, dict):
        raise PromoteError(f"GLB JSON chunk missing: {path}")
    return document


def runtime_contract(path: Path) -> dict[str, Any]:
    """The same shape tests/runtime-visual-assets.test.mjs enforces on the lane."""
    document = read_glb_json(path)
    materials = document.get("materials", [])
    primitives = [
        primitive
        for mesh in document.get("meshes", [])
        for primitive in mesh.get("primitives", [])
    ]
    if not primitives:
        raise PromoteError(f"{path}: no mesh primitives")
    for index, primitive in enumerate(primitives):
        attributes = primitive.get("attributes", {})
        if "TEXCOORD_0" not in attributes:
            raise PromoteError(f"{path}: primitive#{index} has no UV0")
        if "JOINTS_0" not in attributes:
            raise PromoteError(f"{path}: primitive#{index} is not skinned")
        material_index = primitive.get("material")
        if material_index is None:
            raise PromoteError(f"{path}: primitive#{index} has no material")
        material = materials[material_index]
        if "baseColorTexture" not in material.get("pbrMetallicRoughness", {}):
            raise PromoteError(f"{path}: primitive#{index} has no base colour texture")
        if "normalTexture" not in material:
            raise PromoteError(f"{path}: primitive#{index} has no normal texture")
    animations = sorted(item.get("name") for item in document.get("animations", []))
    if not animations:
        raise PromoteError(f"{path}: no animation clips")
    return {
        "meshes": len(document.get("meshes", [])),
        "materials": len(materials),
        "primitives": len(primitives),
        "skins": len(document.get("skins", [])),
        "animationNames": animations,
    }


def load_manifest(root: Path, relative: Path) -> Mapping[str, Any]:
    path = root / relative
    if not path.is_file():
        raise PromoteError(f"missing candidate manifest, stage it first: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def plan_rows(root: Path) -> list[dict[str, Any]]:
    wholebody = load_manifest(root, WHOLEBODY_MANIFEST)
    rigged = load_manifest(root, RIGGED_MANIFEST)
    rigged_by_path = {row.get("relativePath"): row for row in rigged.get("rows", [])}

    rows = []
    for row in wholebody.get("rows", []):
        asset_id = row["assetId"]
        if asset_id in EXCLUDED_ASSET_IDS:
            continue
        candidate = root / row["outputPath"]
        if not candidate.is_file():
            raise PromoteError(f"missing candidate GLB: {candidate}")
        rigged_row = rigged_by_path.get(row["relativePath"], {})
        rows.append(
            {
                "relativePath": row["relativePath"],
                "assetId": asset_id,
                "outputPath": (RUNTIME_ROOT / row["relativePath"]).as_posix(),
                "candidatePath": row["outputPath"],
                "candidateSha256": sha256(candidate),
                "sourceInputPath": row["inputPath"],
                "sourceInputSha256": row["inputSha256"],
                # A runtime-lane input is the pre-promotion asset this pass
                # consumed, and promotion overwrites it, so it stays historical
                # and is not independently re-hashable afterwards.
                "sourceInputLane": row["inputLane"],
                "upstreamPipeline": UPSTREAM_PIPELINE.get(asset_id),
                "clipBalance": row.get("clipBalance", []),
                "lowerMeshBound": rigged_row.get("action") == "bind",
                "boundLowerMeshMotion": (
                    rigged_row.get("motion") if rigged_row.get("action") == "bind" else None
                ),
            }
        )
    if not rows:
        raise PromoteError("no promotable character candidates were found")
    return rows


def build_provenance(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedBy": "scripts/promote-character-assets.py",
        "pipeline": [
            "scripts/bind-static-lower-mesh.py",
            "scripts/author-wholebody-clips-blender.py",
        ],
        "excludedAssetIds": list(EXCLUDED_ASSET_IDS),
        "assetCount": len(rows),
        "assets": {
            row["outputPath"]: {
                "outputPath": row["outputPath"],
                "outputSha256": row["outputSha256"],
                "sourceCandidatePath": row["candidatePath"],
                "sourceCandidateSha256": row["candidateSha256"],
                "sourceInputPath": row["sourceInputPath"],
                "sourceInputSha256": row["sourceInputSha256"],
                "sourceInputLane": row["sourceInputLane"],
                "upstreamPipeline": row["upstreamPipeline"],
                "lowerMeshBound": row["lowerMeshBound"],
                "boundLowerMeshMotion": row["boundLowerMeshMotion"],
                "clipBalance": row["clipBalance"],
                "runtimeContract": row["runtimeContract"],
            }
            for row in rows
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Promote character candidates into the runtime lane")
    parser.add_argument("--check", action="store_true", help="verify the runtime lane without writing")
    args = parser.parse_args(argv)

    root = repository_root()
    rows = plan_rows(root)

    for row in rows:
        candidate = root / row["candidatePath"]
        runtime = root / row["outputPath"]
        if not args.check:
            runtime.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(candidate, runtime)
        if not runtime.is_file():
            raise PromoteError(f"runtime asset missing: {runtime}")
        row["outputSha256"] = sha256(runtime)
        row["runtimeContract"] = runtime_contract(runtime)
        if row["outputSha256"] != row["candidateSha256"]:
            raise PromoteError(
                f"{row['relativePath']}: runtime bytes differ from the promoted candidate"
            )

    provenance = build_provenance(rows)
    provenance_path = root / PROVENANCE_PATH
    serialized = json.dumps(provenance, indent=2, sort_keys=True) + "\n"
    if args.check:
        if not provenance_path.is_file():
            raise PromoteError(f"missing provenance record: {provenance_path}")
        if provenance_path.read_text(encoding="utf-8") != serialized:
            raise PromoteError(f"provenance record does not describe the runtime lane: {provenance_path}")
    else:
        provenance_path.write_text(serialized, encoding="utf-8")

    print(
        json.dumps(
            {
                "provenance": PROVENANCE_PATH.as_posix(),
                "promoted": len(rows),
                "excluded": list(EXCLUDED_ASSET_IDS),
                "checked": bool(args.check),
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except PromoteError as error:
        print(f"error: {error}", file=sys.stderr)
        sys.exit(1)
