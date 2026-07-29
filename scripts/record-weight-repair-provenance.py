#!/usr/bin/env python3
"""Re-stamp character-motion-library manifests after a skin-weight repair.

`scripts/gate-joint-weight-repair.py` patches `WEIGHTS_0`/`JOINTS_0` in place in
both the runtime tree and the authoring library. That invalidates each manifest's
`modelSha256`/`modelBytes`, so
`_workspace/current/engineering/asset-pipeline/tools/build-character-motion-library-index.py`
correctly refuses with `model checksum drift`.

This step re-stamps the authoring manifests from the patched bytes AND records
the repair in a `weightRepair` block, so the manifest still explains how the
shipped bytes were produced. Without that block the library would claim the
weights came straight from `build-character-motion-library-blender.py`, which is
no longer true.

Order of operations for the whole repair:

  1. scripts/gate-joint-weight-repair.py --write --sync-library
  2. scripts/record-weight-repair-provenance.py --write        <- this step
  3. .../tools/build-character-motion-library-index.py --promote
  4. .../tools/build-character-motion-library-index.py --check

Run:
  python3 scripts/record-weight-repair-provenance.py --check
  python3 scripts/record-weight-repair-provenance.py --write
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


def repository_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "package.json").is_file():
            return parent
    raise SystemExit("repository root (package.json) not found")


ROOT = repository_root()
LIBRARY_ROOT = ROOT / "_workspace/current/engineering/asset-pipeline/character-motion-library"
GATE_REPORT = ROOT / "_workspace/current/engineering/asset-pipeline/motion-bench/joint-weight-repair-gate.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Re-stamp manifests after a weight repair")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)

    if not GATE_REPORT.is_file():
        raise SystemExit(f"gate report missing: {GATE_REPORT.relative_to(ROOT)}")
    gate = json.loads(GATE_REPORT.read_text())

    updated: list[str] = []
    skipped: list[str] = []
    drifted: list[str] = []

    for row in gate["assets"]:
        asset_id = row["assetId"]
        if not row.get("written"):
            skipped.append(asset_id)
            continue

        manifest_path = LIBRARY_ROOT / asset_id / "manifest.json"
        model_path = LIBRARY_ROOT / asset_id / "model.glb"
        if not manifest_path.is_file() or not model_path.is_file():
            raise SystemExit(f"{asset_id}: library manifest or model missing")

        manifest = json.loads(manifest_path.read_text())
        actual_sha = sha256_file(model_path)
        actual_bytes = model_path.stat().st_size

        if manifest.get("modelSha256") == actual_sha and manifest.get("modelBytes") == actual_bytes:
            continue

        drifted.append(asset_id)
        if not args.write:
            continue

        repair = row["repair"]
        manifest["modelSha256"] = actual_sha
        manifest["modelBytes"] = actual_bytes
        # Provenance: the weights in this GLB are no longer purely what the
        # Blender authoring step produced.
        manifest["weightRepair"] = {
            "tool": "scripts/repair-joint-weights.py",
            "gate": "scripts/gate-joint-weight-repair.py",
            # Deliberately NO `_workspace/` path in this block: the runtime
            # manifest is derived from this one, and
            # `.../asset-pipeline/tests/character-motion-library.test.mjs` asserts
            # that no authoring path reaches the runtime lane. The gate report is
            # discoverable from the tool names above.
            "keepRadius": gate["keepRadius"],
            "relaxIterations": row["relaxIterations"],
            "relaxStrength": row["relaxStrength"],
            "shaBeforeRepair": row["sha256Before"],
            "changedVertices": repair["changedVertices"],
            "droppedInfluences": repair["droppedInfluences"],
            "seededSecondInfluence": repair.get("seededSecondInfluence", 0),
            "overSpreadFractionBefore": row["before"]["overSpreadFraction"],
            "overSpreadFractionAfter": row["after"]["overSpreadFraction"],
            "maxSpreadBefore": row["before"]["maxSpread"],
            "maxSpreadAfter": row["after"]["maxSpread"],
            "seamEdgesOverOneBefore": row["before"]["seamEdgesOverOne"],
            "seamEdgesOverOneAfter": row["after"]["seamEdgesOverOne"],
            "seamEdgesDisjointBefore": row["before"].get("seamEdgesDisjoint"),
            "seamEdgesDisjointAfter": row["after"].get("seamEdgesDisjoint"),
            "bridgedSeamEdges": repair.get("bridgedSeamEdges", 0),
            "seamBridgeCap": repair.get("seamBridgeCap"),
            "rationale": (
                "Shipped bind spread single vertices across bones 3-10 hierarchy edges apart, so "
                "limbs deformed as one rubber tube instead of bending at joints. Influences are "
                "masked to the dominant bone's 1-edge neighbourhood, relaxed across mesh topology "
                "to keep the falloff continuous, then renormalized. Rest pose is bit-stable: at "
                "rest every joint matrix is identity, so a weight set summing to 1.0 reproduces "
                "the original vertex exactly."
            ),
        }
        manifest_path.write_text(json.dumps(manifest, indent=1) + "\n")
        updated.append(asset_id)

    print(f"repaired assets in gate report: {len(gate['assets']) - len(skipped)}")
    print(f"untouched by repair (left at shipped bytes): {len(skipped)}" + (f" -> {', '.join(skipped)}" if skipped else ""))
    if args.write:
        print(f"manifests re-stamped: {len(updated)}" + (f" -> {', '.join(updated)}" if updated else ""))
    else:
        print(f"manifests needing re-stamp: {len(drifted)}" + (f" -> {', '.join(drifted)}" if drifted else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
