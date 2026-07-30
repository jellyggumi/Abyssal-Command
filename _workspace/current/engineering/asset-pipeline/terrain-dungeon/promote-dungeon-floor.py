#!/usr/bin/env python3
"""Promote a built dungeon floor from the concept lane into the runtime asset tree.

    python3 promote-dungeon-floor.py \
        --root /Users/jangyoung/orca/Abyssal-Surge-dungeon \
        --stage-id cinder-span \
        --floor-glb .../terrain-cinder-span-floor.glb \
        --build-report .../terrain-cinder-span-floor.build-report.json \
        --out .../promotion-receipt.json

Promotion is the only step that makes a floor visible to the game, and it is the
step the previous terrains failed. Three independent gates must all hold, and this
script refuses rather than warns.

Gate 1 — the surface is flat.
    The build report must record `surface.coplanar: true` at gameplay elevation 0.
    `stage-world-catalog.js` rejected the earlier dioramas with
    `authored-diorama-not-flat-gameplay-eligible`; a non-coplanar floor would earn
    the same verdict and fall straight back to the procedural plane.

Gate 2 — the destination is a runtime path.
    The catalog validator requires `terrainGlbPath` under
    `assets/mesh/terrain/**/runtime/**`. A `/textured-candidate/` path is what
    `scripts/defense-runtime-assets.mjs` currently registers for chancel and throne,
    and it is not promotable.

Gate 3 — the catalog edit is all-or-nothing.
    The validator throws `requires one eligible runtime strategy` when a profile
    carries both an eligible path and a fallback. So the three fields must change
    together: set `terrainGlbPath`, set `terrainRuntimeEligible: true`, delete
    `terrainFallback`. This script does not edit the catalog — it emits the exact
    three-field patch an implementer applies, so the requirement is explicit
    instead of remembered.

The script copies bytes and writes receipts. It never edits JavaScript.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

STAGE_IDS = ("cinder-span", "abyss-chancel", "echo-throne")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", type=Path, required=True, help="repository root the runtime path is relative to")
    parser.add_argument("--stage-id", required=True, choices=STAGE_IDS)
    parser.add_argument("--floor-glb", type=Path, required=True, help="built floor GLB in the concept lane")
    parser.add_argument("--build-report", type=Path, required=True, help="build report emitted beside the GLB")
    parser.add_argument("--out", type=Path, required=True, help="promotion receipt path")
    parser.add_argument("--dry-run", action="store_true", help="run every gate and print the patch without copying")
    return parser.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_file(path: Path, label: str) -> Path:
    resolved = path.resolve()
    if not resolved.is_file() or resolved.stat().st_size == 0:
        raise SystemExit(f"{label} is missing or empty: {resolved}")
    return resolved


def gate_flat_surface(report: dict, stage_id: str) -> dict:
    surface = report.get("surface") or {}
    if report.get("stageId") != stage_id:
        raise SystemExit(f"build report is for stage {report.get('stageId')!r}, not {stage_id!r}")
    if surface.get("kind") != "flat-gameplay-floor":
        raise SystemExit(f"surface.kind is {surface.get('kind')!r}; only 'flat-gameplay-floor' is promotable")
    if surface.get("coplanar") is not True:
        raise SystemExit("surface.coplanar is not true — a non-flat floor repeats the diorama rejection")
    if surface.get("gameplayElevation") != 0:
        raise SystemExit(f"gameplayElevation is {surface.get('gameplayElevation')!r}; gameplay must sit at 0")
    if not report.get("slabs"):
        raise SystemExit("build report lists no slabs")
    return surface


def gate_runtime_destination(root: Path, stage_id: str) -> Path:
    destination = root / "assets" / "mesh" / "terrain" / f"terrain-{stage_id}" / "runtime" / "terrain" / f"terrain-{stage_id}-floor.glb"
    relative = destination.relative_to(root).as_posix()
    if "/runtime/" not in relative:
        raise SystemExit(f"destination is not a runtime path: {relative}")
    if "textured-candidate" in relative:
        raise SystemExit(f"destination is a candidate path, which is never promotable: {relative}")
    return destination


def catalog_patch(stage_id: str, relative_path: str, slabs: list[dict]) -> dict:
    return {
        "file": "stage-world-catalog.js",
        "stageId": stage_id,
        "applyAllThreeTogether": True,
        "reason": "the validator throws 'requires one eligible runtime strategy' if a profile keeps both an eligible path and a fallback",
        "set": {
            "terrainGlbPath": relative_path,
            "terrainRuntimeEligible": True,
        },
        "delete": ["terrainFallback"],
        "keep": {
            "terrainSourceCandidatePath": "unchanged — retained for provenance",
        },
        "alsoRegister": {
            "file": "scripts/defense-runtime-assets.mjs",
            "addToRetainedAssetPaths": relative_path,
            "note": "chancel and throne currently register textured-candidate paths; without this edit the promotion is invisible to the runtime",
        },
        "slabNodes": [slab["node"] for slab in slabs],
    }


def main() -> None:
    args = parse_args()
    root = args.root.resolve()
    floor = require_file(args.floor_glb, "floor GLB")
    report_path = require_file(args.build_report, "build report")
    report = json.loads(report_path.read_text(encoding="utf-8"))

    surface = gate_flat_surface(report, args.stage_id)
    destination = gate_runtime_destination(root, args.stage_id)
    relative_path = destination.relative_to(root).as_posix()

    recorded = (report.get("output") or {}).get("sha256")
    actual = sha256(floor)
    if recorded and recorded != actual:
        raise SystemExit(
            "floor GLB does not match its build report sha256 — rebuild rather than promote a stale artifact"
        )

    patch = catalog_patch(args.stage_id, relative_path, report["slabs"])

    if args.dry_run:
        print(f"[dry-run] all gates pass for {args.stage_id}")
        print(f"[dry-run] would copy {floor} -> {destination}")
        print(json.dumps(patch, indent=2))
        return

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(floor, destination)

    receipt = {
        "schemaVersion": 1,
        "stageId": args.stage_id,
        "promotedAt": datetime.now(timezone.utc).isoformat(),
        "tool": "promote-dungeon-floor.py",
        "gates": {
            "flatSurface": "PASS",
            "runtimeDestination": "PASS",
            "buildReportChecksum": "PASS" if recorded else "ABSENT",
        },
        "surface": surface,
        "source": {"path": str(floor), "sha256": actual, "bytes": floor.stat().st_size},
        "destination": {"path": relative_path, "sha256": sha256(destination), "bytes": destination.stat().st_size},
        "slabs": report["slabs"],
        "catalogPatch": patch,
        "runtimeEligible": True,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")

    print(f"promoted {args.stage_id}: {relative_path} ({receipt['destination']['bytes']} bytes)")
    print(f"slab nodes: {', '.join(patch['slabNodes'])}")
    print(f"wrote {args.out}")
    print("catalog patch is in the receipt under catalogPatch — apply all three fields together.")


if __name__ == "__main__":
    main()
