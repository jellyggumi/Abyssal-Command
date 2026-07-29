#!/usr/bin/env python3
"""Write candidate-only provenance receipts for exported procedural GLBs."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[5]
STAGED = REPO / "_workspace/current/engineering/asset-pipeline/ingame-mesh/staged"
SOURCE_BLEND = "_workspace/current/engineering/blender/procedural-world-resource-pack.blend"
TPOSE_CONDITIONS = REPO / "_workspace/current/engineering/asset-pipeline/tpose-conditions"
TPOSE_CONCEPT_INPUT = REPO / "_workspace/current/engineering/asset-pipeline/concept-input"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def write_receipt(glb: Path, source: dict[str, str], asset_class: str, runtime_reason: str) -> None:
    relative = glb.relative_to(REPO).as_posix()
    receipt = {
        "schemaVersion": 1,
        "source": source,
        "generator": "Blender 5.2.0 LTS",
        "output": relative,
        "sha256": sha256(glb),
        "assetClass": asset_class,
        "rightsReceipt": "repository-authored procedural mesh; no third-party generated asset is embedded",
        "runtimeReceipt": {
            "runtimeEligible": False,
            "status": "not-issued",
            "reason": runtime_reason,
        },
        "textureStatus": "material-only; no generated albedo atlas embedded",
        "motionStatus": "not-applicable" if asset_class != "actors" else "not-authored",
        "visualFidelityStatus": "not-a-baseline-replacement",
    }
    glb.with_suffix(".provenance.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

def write_tpose_condition_receipt(glb: Path) -> None:
    asset_id = glb.name.removesuffix("-tpose-condition.glb")
    concept = TPOSE_CONCEPT_INPUT / f"{asset_id}-character.png"
    if not concept.is_file():
        raise SystemExit(f"{glb}: missing staged concept input {concept}")
    receipt = {
        "schemaVersion": 1,
        "source": {
            "kind": "repository-authored-procedural-tpose-condition",
            "assetId": asset_id,
            "concept": concept.relative_to(REPO).as_posix(),
            "builder": "scripts/rodin-tpose-regen.py",
            "exporter": "Blender glTF exporter",
        },
        "generator": "Blender 5.2.0 LTS",
        "output": glb.relative_to(REPO).as_posix(),
        "sha256": sha256(glb),
        "assetClass": "tpose-condition",
        "rightsReceipt": "repository-authored procedural condition mesh; no third-party generated asset is embedded",
        "runtimeReceipt": {
            "runtimeEligible": False,
            "status": "not-issued",
            "reason": "candidate-only: T-pose condition mesh has not passed scale, visual-fidelity, or runtime browser gates",
        },
        "runtimeEligible": False,
        "textureStatus": "material-only; no generated albedo atlas embedded",
        "motionStatus": "not-applicable",
        "visualFidelityStatus": "not-a-baseline-replacement",
    }
    glb.with_suffix(".provenance.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    staged = sorted(STAGED.rglob("*.glb"))
    conditions = sorted(TPOSE_CONDITIONS.glob("*.glb"))
    if not staged and not conditions:
        raise SystemExit("no candidate procedural GLBs found")
    staged_source = {
        "kind": "repository-authored-procedural",
        "blend": SOURCE_BLEND,
        "builder": "scripts/build-world-content-pack.py",
        "exporter": "scripts/export-battle-glb.py",
    }
    for glb in staged:
        write_receipt(
            glb,
            staged_source,
            glb.relative_to(STAGED).parts[0],
            "candidate-only: low-poly material-only export has not passed texture, scale, visual-fidelity, or runtime browser gates",
        )
    for glb in conditions:
        write_tpose_condition_receipt(glb)
    print(f"WROTE_RECEIPTS count={len(staged) + len(conditions)} runtimeEligible=false")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
