#!/usr/bin/env python3
"""Promote the reviewed character candidates into the runtime asset lane.

Three candidate passes are composed here:

  scripts/bind-static-lower-mesh.py       -- skins the frozen `<asset>_pedestal`
                                             lower mesh into the character body
  scripts/author-wholebody-clips-blender.py -- gives every clip a working second
                                             half instead of a frozen one
  scripts/bake-character-albedo.py        -- bakes a per-character cartoon albedo
                                             into the character's own UV atlas,
                                             replacing the shared detail tile the
                                             cast used to share

Every character is promoted. The commander is the one asset the albedo pass
copies through untouched: it already owns authored albedo art, its clips come
from `player-combat-animation-candidate/author_player_combat_clips.py`, and its
deployed bytes are pinned by tests/commander-guard-pose.test.mjs.

Runtime GLB provenance is recorded the way terrain already records it, so
scripts/audit-stage-scenes.mjs can verify promoted characters against their own
build record instead of the texture-pass audit that no longer produced them.
The record also names the *origin* stage of each character's body and albedo, so
"which tool actually made this mesh and this texture" is answerable from the
runtime lane instead of from chat history.

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
ALBEDO_MANIFEST = (
    PIPELINE_ROOT / "runtime-candidates" / "character-albedo" / "character-albedo.manifest.json"
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

# Where each character's *body* came from, and where its *albedo* came from.
# Only the commander went through the Rodin bridge; every other body is a
# parametric blockout (scripts/tpose_blockout.py, added with the 43 GLBs in
# d8e9d9f). Recording it here is what stops "which tool made this?" from being
# answered out of chat history.
COMMANDER_ASSET_ID = "dusk-warden"
RODIN_CANDIDATE = (
    "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline"
    "/rodin-candidates/commander/player-core-rodin-tpose-v01.glb"
)
BODY_ORIGINS = {
    COMMANDER_ASSET_ID: {
        "stage": "rodin-bridge",
        "tool": "scripts/rodin-tpose-regen.py",
        "candidateLane": RODIN_CANDIDATE,
        "note": "the only character body generated through the Rodin bridge",
    },
    "*": {
        "stage": "parametric-tpose-blockout",
        "tool": "scripts/tpose_blockout.py",
        "candidateLane": None,
        "note": "procedural blockout body shipped in d8e9d9f; not a Rodin generation",
    },
}
ALBEDO_ORIGINS = {
    COMMANDER_ASSET_ID: {
        "stage": "authored-cartoon-atlas",
        "tool": "scripts/apply-cartoon-texture-blender.py",
        "conceptReference": (
            "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline"
            "/concept-input/dusk-warden-cartoon-albedo-v3.png"
        ),
        "note": (
            "the god-tibo-imagen concept atlas is reference input only "
            "(runtimeEligible:false in its provenance sidecar); the shipped atlas is the "
            "Blender-authored bake"
        ),
    },
    "*": {
        "stage": "baked-cartoon-albedo",
        "tool": "scripts/bake-character-albedo.py",
        "conceptReference": None,
        "note": "generated against the character's own UV unwrap, not a shared detail tile",
    },
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


def albedo_block(row: Mapping[str, Any]) -> dict[str, Any]:
    """What the albedo pass did to this character, straight from its lane row."""
    if not row.get("albedoBaked"):
        return {
            "baked": False,
            "reason": row.get("copyThroughReason"),
            "atlasSha256": None,
        }
    return {
        "baked": True,
        "atlasSha256": row["atlasSha256"],
        "atlasBytes": row["atlasBytes"],
        "atlasWidth": row["atlasWidth"],
        "atlasHeight": row["atlasHeight"],
        "uvCoverage": row["uvCoverage"],
        "dilatedCoverage": row["dilatedCoverage"],
        "dilationTexels": row["dilationTexels"],
        "palette": row["palette"],
    }


def plan_rows(root: Path) -> list[dict[str, Any]]:
    wholebody = load_manifest(root, WHOLEBODY_MANIFEST)
    rigged = load_manifest(root, RIGGED_MANIFEST)
    albedo = load_manifest(root, ALBEDO_MANIFEST)
    rigged_by_path = {row.get("relativePath"): row for row in rigged.get("rows", [])}
    albedo_by_path = {row.get("relativePath"): row for row in albedo.get("rows", [])}

    rows = []
    for row in wholebody.get("rows", []):
        asset_id = row["assetId"]
        if asset_id in EXCLUDED_ASSET_IDS:
            continue
        albedo_row = albedo_by_path.get(row["relativePath"])
        if albedo_row is None:
            raise PromoteError(f"{row['relativePath']}: no albedo-lane row, bake it first")
        if albedo_row.get("inputSha256") != sha256(root / row["outputPath"]):
            raise PromoteError(
                f"{row['relativePath']}: the albedo pass consumed different whole-body bytes"
            )
        candidate = root / albedo_row["outputPath"]
        if not candidate.is_file():
            raise PromoteError(f"missing candidate GLB: {candidate}")
        rigged_row = rigged_by_path.get(row["relativePath"], {})
        rows.append(
            {
                "relativePath": row["relativePath"],
                "assetId": asset_id,
                "outputPath": (RUNTIME_ROOT / row["relativePath"]).as_posix(),
                "candidatePath": albedo_row["outputPath"],
                "candidateSha256": sha256(candidate),
                "wholebodyCandidatePath": row["outputPath"],
                "wholebodyCandidateSha256": albedo_row["inputSha256"],
                "sourceInputPath": row["inputPath"],
                "sourceInputSha256": row["inputSha256"],
                # A runtime-lane input is the pre-promotion asset this pass
                # consumed, and promotion overwrites it, so it stays historical
                # and is not independently re-hashable afterwards.
                "sourceInputLane": row["inputLane"],
                "upstreamPipeline": UPSTREAM_PIPELINE.get(asset_id),
                "bodyOrigin": BODY_ORIGINS.get(asset_id, BODY_ORIGINS["*"]),
                "albedoOrigin": ALBEDO_ORIGINS.get(asset_id, ALBEDO_ORIGINS["*"]),
                "albedoBake": albedo_block(albedo_row),
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
            "scripts/bake-character-albedo.py",
        ],
        "excludedAssetIds": list(EXCLUDED_ASSET_IDS),
        "assetCount": len(rows),
        "assets": {
            row["outputPath"]: {
                "outputPath": row["outputPath"],
                "outputSha256": row["outputSha256"],
                "sourceCandidatePath": row["candidatePath"],
                "sourceCandidateSha256": row["candidateSha256"],
                "wholebodyCandidatePath": row["wholebodyCandidatePath"],
                "wholebodyCandidateSha256": row["wholebodyCandidateSha256"],
                "sourceInputPath": row["sourceInputPath"],
                "sourceInputSha256": row["sourceInputSha256"],
                "sourceInputLane": row["sourceInputLane"],
                "upstreamPipeline": row["upstreamPipeline"],
                "bodyOrigin": row["bodyOrigin"],
                "albedoOrigin": row["albedoOrigin"],
                "albedoBake": row["albedoBake"],
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
