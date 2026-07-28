#!/usr/bin/env python3
"""Write candidate-only provenance receipts for exported procedural GLBs."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[5]
STAGED = REPO / "_workspace/current/engineering/asset-pipeline/ingame-mesh/staged"
SOURCE_BLEND = "_workspace/current/engineering/blender/procedural-world-resource-pack.blend"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    files = sorted(STAGED.rglob("*.glb"))
    if not files:
        raise SystemExit("no staged procedural GLBs found")
    for glb in files:
        relative = glb.relative_to(REPO).as_posix()
        category = glb.relative_to(STAGED).parts[0]
        receipt = {
            "schemaVersion": 1,
            "source": {
                "kind": "repository-authored-procedural",
                "blend": SOURCE_BLEND,
                "builder": "scripts/build-world-content-pack.py",
                "exporter": "scripts/export-battle-glb.py",
            },
            "generator": "Blender 5.2.0 LTS",
            "output": relative,
            "sha256": sha256(glb),
            "assetClass": category,
            "rightsReceipt": "repository-authored procedural mesh; no third-party generated asset is embedded",
            "runtimeReceipt": {
                "runtimeEligible": False,
                "status": "not-issued",
                "reason": "candidate-only: low-poly material-only export has not passed texture, scale, visual-fidelity, or runtime browser gates",
            },
            "textureStatus": "material-only; no generated albedo atlas embedded",
            "motionStatus": "not-applicable" if category != "actors" else "not-authored",
            "visualFidelityStatus": "not-a-baseline-replacement",
        }
        sidecar = glb.with_suffix(".provenance.json")
        sidecar.write_text(json.dumps(receipt, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"WROTE_RECEIPTS count={len(files)} runtimeEligible=false")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
