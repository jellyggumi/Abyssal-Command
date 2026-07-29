#!/usr/bin/env python3
"""Publish the audited Cinder Span resource manifest with portable asset paths."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


RESOURCE_KEYS = {
    "terrain": ("terrain", "glb"),
    "featurePack": ("featurePack", "pack"),
    "propPack": ("propPack", "pack"),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--staged-manifest", type=Path, required=True)
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--terrain", type=Path, required=True)
    parser.add_argument("--features", type=Path, required=True)
    parser.add_argument("--props", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
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
        raise RuntimeError(f"missing {label}: {resolved}")
    return resolved


def relative_path(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root).as_posix()


def normalize_paths(value, root: Path):
    if isinstance(value, dict):
        return {key: normalize_paths(child, root) for key, child in value.items()}
    if isinstance(value, list):
        return [normalize_paths(child, root) for child in value]
    if isinstance(value, str) and value.startswith("/"):
        return relative_path(Path(value), root)
    return value


def receipt(path: Path, root: Path) -> dict:
    return {
        "bytes": path.stat().st_size,
        "path": relative_path(path, root),
        "sha256": sha256(path),
    }


def main() -> None:
    args = parse_args()
    root = args.root.resolve()
    staged_manifest_path = require_file(args.staged_manifest, "staged resource manifest")
    audit_path = require_file(args.audit, "Blender audit")
    final_paths = {
        "terrain": require_file(args.terrain, "terrain GLB"),
        "featurePack": require_file(args.features, "feature pack GLB"),
        "propPack": require_file(args.props, "prop pack GLB"),
    }

    manifest = normalize_paths(json.loads(staged_manifest_path.read_text()), root)
    audit = json.loads(audit_path.read_text())
    if audit.get("passed") is not True:
        raise RuntimeError("Blender audit did not pass")
    audit_resources = {resource["kind"]: resource for resource in audit.get("resources", [])}

    promoted = []
    for resource_key, (audit_kind, receipt_key) in RESOURCE_KEYS.items():
        final_path = final_paths[resource_key]
        final_receipt = receipt(final_path, root)
        staged_receipt = manifest[resource_key][receipt_key]
        audit_receipt = audit_resources.get(audit_kind)
        if audit_receipt is None or audit_receipt.get("passed") is not True:
            raise RuntimeError(f"missing passing audit resource: {audit_kind}")
        expected_hashes = {staged_receipt.get("sha256"), audit_receipt.get("sha256")}
        if expected_hashes != {final_receipt["sha256"]}:
            raise RuntimeError(f"promoted {audit_kind} hash differs from staged/audited resource")
        manifest[resource_key][receipt_key] = final_receipt
        manifest[resource_key]["runtimeEligible"] = True
        promoted.append({
            "kind": audit_kind,
            **final_receipt,
            "meshCount": audit_receipt["meshCount"],
            "triangles": audit_receipt["triangles"],
            "vertices": audit_receipt["vertices"],
        })

    manifest["runtimeEligible"] = True
    manifest["promotionGate"] = "passed Blender re-import audit and Three.js GLTFLoader smoke test"
    manifest["promotionAudit"] = {
        "blenderVersion": audit["blenderVersion"],
        "passed": True,
        "report": relative_path(audit_path, root),
        "reportSha256": sha256(audit_path),
        "resources": promoted,
    }

    out = args.out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"manifest": relative_path(out, root), "resources": promoted}, sort_keys=True))


if __name__ == "__main__":
    main()
