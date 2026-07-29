#!/usr/bin/env python3
"""Generate the complete candidate-only web-battle mesh replacement catalog.

The catalog is derived from the runtime path registry. It never creates, copies,
or promotes a GLB or texture. Run with --check to prove the checked-in planning
artifact is current without changing it.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[5]
PIPELINE = REPO / "_workspace/current/engineering/asset-pipeline"
DEFAULT_OUT = PIPELINE / "ingame-mesh/web-battle-resource-manifest.json"
REGISTRY = REPO / "scripts/defense-runtime-assets.mjs"

BOSS_CONCEPT_IDS = {
    "abyss-regent": "s10-abyss-regent",
    "bridge-colossus": "s8-bridge-colossus",
    "cinder-warden": "s1-cinder-warden",
    "gate-sovereign": "s3-gate-sovereign",
    "lantern-tyrant": "s7-lantern-tyrant",
    "pack-herald": "s5-pack-herald",
    "requiem-choir": "s6-requiem-choir",
    "tide-warden": "s4-tide-warden",
    "veil-tactician": "s2-veil-tactician",
    "veiled-concordat": "s9-veiled-concordat",
}
CONCEPT_ALIASES = {
    "abyss-chancel": "terrain-abyss-chancel",
    "cinder-span": "terrain-cinder-span",
    "dusk-warden": "player-core-v04",
    **BOSS_CONCEPT_IDS,
    **{f"tier-t{tier}": "equipment-tier-gems" for tier in range(1, 6)},
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--check", action="store_true")
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"expected object JSON: {path}")
    return value


def runtime_paths() -> tuple[list[str], str]:
    text = REGISTRY.read_text(encoding="utf-8")
    paths = re.findall(r"'((?:assets/images/battle/glb)/[^']+\.glb)'", text)
    unique = list(dict.fromkeys(paths))
    if not unique:
        raise ValueError("runtime registry has no GLB paths")
    return unique, text


def concept_index() -> dict[str, dict[str, Any]]:
    entries: dict[str, dict[str, Any]] = {}
    for manifest in sorted((PIPELINE / "concept-layers").glob("*/*.layers.json")):
        source = read_json(manifest)
        asset_id = source.get("assetId")
        if not isinstance(asset_id, str) or not asset_id:
            raise ValueError(f"missing assetId in {manifest}")
        layers = source.get("layers")
        if not isinstance(layers, list):
            raise ValueError(f"missing layers[] in {manifest}")
        entries[asset_id] = {
            "manifest": manifest.relative_to(REPO).as_posix(),
            "concept": source.get("concept"),
            "generatedLayers": sorted(
                layer["layer"]
                for layer in layers
                if isinstance(layer, dict)
                and isinstance(layer.get("layer"), str)
                and str(layer.get("status", "")).startswith(("generated", "keyed"))
            ),
            "failedLayers": sorted(
                layer["layer"]
                for layer in layers
                if isinstance(layer, dict)
                and isinstance(layer.get("layer"), str)
                and str(layer.get("status", "")).startswith("failed")
            ),
            "pendingLayers": sorted(
                layer["layer"]
                for layer in layers
                if isinstance(layer, dict)
                and isinstance(layer.get("layer"), str)
                and "needs-generate" in str(layer.get("status", ""))
            ),
        }
    return entries


def asset_class(category: str) -> str:
    classes = {
        "bosses": "actor",
        "enemies": "actor",
        "companions": "actor",
        "commander": "actor",
        "terrain": "terrain",
        "props": "prop",
        "vfx": "vfx",
    }
    try:
        return classes[category]
    except KeyError as exc:
        raise ValueError(f"unsupported runtime GLB category: {category}") from exc


def strategy(kind: str) -> dict[str, str]:
    strategies = {
        "actor": {
            "mesh": "Rodin Bridge genuine-T-pose body mesh",
            "texture": "god-tibo-imagen per-asset cartoon albedo after active-UV audit",
            "motion": "Motion Previs reference then Blender deform rig and NLA 11-clip bake",
        },
        "terrain": {
            "mesh": "Blender-authored playable diorama from separated terrain references",
            "texture": "god-tibo-imagen environment atlas after active-UV audit",
            "motion": "not applicable",
        },
        "prop": {
            "mesh": "Blender-authored prop mesh from separated prop references",
            "texture": "god-tibo-imagen per-prop cartoon albedo after active-UV audit",
            "motion": "not applicable unless this prop has an authored state",
        },
        "vfx": {
            "mesh": "Blender-authored lightweight VFX GLB; do not route VFX through Rodin",
            "texture": "provenanced emissive/material atlas when a texture is required",
            "motion": "authored one-shot transform or shader timing; no humanoid retargeting",
        },
    }
    return strategies[kind]

def verified_receipt(artifact: Path, sidecar: Path) -> dict[str, Any]:
    if not artifact.is_file() or not sidecar.is_file():
        raise ValueError(f"missing artifact or provenance sidecar: {artifact}")
    receipt = read_json(sidecar)
    declared = receipt.get("sha256")
    actual = hashlib.sha256(artifact.read_bytes()).hexdigest()
    if declared != actual:
        raise ValueError(f"provenance hash mismatch: {artifact}")
    return receipt


def candidate_artifact(output: str) -> dict[str, Any] | None:
    glb = REPO / output
    sidecar = glb.with_suffix(".provenance.json")
    if not glb.is_file() and not sidecar.is_file():
        return None
    receipt = verified_receipt(glb, sidecar)
    return {
        "path": output,
        "sha256": receipt["sha256"],
        "textureStatus": receipt.get("textureStatus"),
        "visualFidelityStatus": receipt.get("visualFidelityStatus"),
        "runtimeEligible": receipt.get("runtimeReceipt", {}).get("runtimeEligible"),
    }


def texture_artifact(asset_id: str, category: str) -> dict[str, Any] | None:
    sidecar = PIPELINE / f"ingame-mesh/textures/{category}/{asset_id}-concept.provenance.json"
    if not sidecar.is_file():
        return None
    receipt = read_json(sidecar)
    output = receipt.get("output")
    if not isinstance(output, str):
        raise ValueError(f"texture receipt missing output: {sidecar}")
    receipt = verified_receipt(REPO / output, sidecar)
    return {
        "path": output,
        "sha256": receipt["sha256"],
        "textureStatus": receipt.get("textureStatus"),
        "assetRole": receipt.get("assetRole"),
        "runtimeEligible": receipt.get("runtimeReceipt", {}).get("runtimeEligible"),
    }



def build_catalog() -> dict[str, Any]:
    paths, registry_text = runtime_paths()
    policy = read_json(PIPELINE / "asset-lanes.json")
    actions = read_json(PIPELINE / "action-pipeline.json")
    concepts = concept_index()
    assets: list[dict[str, Any]] = []

    for runtime_path in paths:
        relative = Path(runtime_path).relative_to("assets/images/battle/glb")
        category, asset_id = relative.parts[0], relative.stem
        kind = asset_class(category)
        concept_id = CONCEPT_ALIASES.get(asset_id, asset_id)
        concept = concepts.get(concept_id)
        blockers: list[str] = []
        if concept is None:
            concept_ref: dict[str, Any] = {"assetId": concept_id, "status": "missing"}
            blockers.append("missing-separated-concept-reference")
        else:
            concept_ref = {"assetId": concept_id, **concept}
            if concept["failedLayers"]:
                blockers.append("concept-layer-generation-failed")
            if concept["pendingLayers"]:
                blockers.append("concept-layer-generation-pending")
        if kind == "actor":
            blockers.extend(("interactive-Rodin-Bridge-submission-required", "Motion-Previs-bundle-required"))
        if kind in {"actor", "terrain", "prop"}:
            blockers.append("per-asset-texture-generation-required")

        candidate_output = f"_workspace/current/engineering/asset-pipeline/ingame-mesh/staged/{relative.as_posix()}"
        artifact = candidate_artifact(candidate_output)
        texture = texture_artifact(asset_id, category)
        assets.append({
            "assetId": asset_id,
            "runtimePath": runtime_path,
            "category": category,
            "assetClass": kind,
            "candidateOutput": candidate_output,
            "candidateArtifact": artifact,
            "textureArtifact": texture,
            "conceptReference": concept_ref,
            "generation": strategy(kind),
            "status": "candidate-exported-blocked" if artifact else ("blocked" if blockers else "ready-for-candidate-generation"),
            "blockers": blockers,
            "runtimeEligible": False,
        })

    return {
        "schemaVersion": 1,
        "lane": "candidate/ingame-mesh",
        "status": "partial-candidate-coverage-no-runtime-promotion" if any(asset["candidateArtifact"] is not None for asset in assets) else "planning-only-no-runtime-promotion",
        "createdAt": "2026-07-28",
        "ownerSkills": {
            "primary": "build-hybrid-game-assets",
            "rigging": "build-game-monster-system",
            "motionReference": "motion-previs-studio",
        },
        "authority": {
            "runtimeRegistry": "scripts/defense-runtime-assets.mjs",
            "runtimeRegistrySha256": hashlib.sha256(registry_text.encode()).hexdigest(),
            "assetLanePolicy": "_workspace/current/engineering/asset-pipeline/asset-lanes.json",
            "characterContract": "docs/character-asset-pipeline.md",
            "motionContract": "_workspace/current/engineering/asset-pipeline/action-pipeline.json",
        },
        "scope": {
            "runtimeGlbRoot": "assets/images/battle/glb",
            "runtimeTargetCount": len(assets),
            "byCategory": dict(sorted(Counter(asset["category"] for asset in assets).items())),
            "candidateExportedCount": sum(asset["candidateArtifact"] is not None for asset in assets),
            "candidateExportedByCategory": dict(sorted(Counter(asset["category"] for asset in assets if asset["candidateArtifact"] is not None).items())),
            "textureConceptCount": sum(asset["textureArtifact"] is not None for asset in assets),
            "deployedRuntimeGlbsObserved": 0,
            "runtimeDeletionPerformed": False,
        },
        "promotionContract": {
            "mode": "clean-cutover-only-after-per-asset-receipt",
            "candidateRoot": "_workspace/current/engineering/asset-pipeline/ingame-mesh/staged",
            "forbidDirectWrites": "assets/images/battle/glb",
            "requiredCandidateSidecarFields": policy["lanes"]["candidate"]["sidecar"]["requiredFields"],
            "requiredBeforeRuntimePromotion": [
                "source-and-rights receipt",
                "class-specific mesh audit",
                "active UV map and texture embedding audit when textured",
                "actor skin weights and 11 canonical clips when the asset class is actor",
                "Three.js load and Canvas fallback evidence",
                "explicit runtime receipt",
            ],
            "runtimeEligibleDefault": False,
        },
        "actorContract": {
            "requiredClipKeys": actions["runtimeContract"]["requiredClipKeys"],
            "clipNamePattern": "{assetId}::{action}::v01",
            "sourceFps": actions["sourceFps"],
            "runtimeFps": actions["runtimeFps"],
            "excludeFromRodin": [
                "terrain", "floor", "pedestal", "platform", "rocks", "weapons",
                "shields", "held props", "equipment", "debris", "background geometry",
            ],
        },
        "assets": assets,
    }


def validate_runtime_ineligibility(catalog: dict[str, Any]) -> None:
    invalid: list[str] = []
    for asset in catalog["assets"]:
        if asset["runtimeEligible"] is not False:
            invalid.append(f"{asset['assetId']}: asset runtimeEligible={asset['runtimeEligible']!r}")
        artifact = asset["candidateArtifact"]
        if artifact is not None and artifact["runtimeEligible"] is not False:
            invalid.append(f"{asset['assetId']}: candidate runtimeEligible={artifact['runtimeEligible']!r}")
        texture = asset["textureArtifact"]
        if texture is not None and texture["runtimeEligible"] is not False:
            invalid.append(f"{asset['assetId']}: texture runtimeEligible={texture['runtimeEligible']!r}")
    if invalid:
        raise ValueError("runtime promotion is not authorized: " + "; ".join(invalid))


def main() -> int:
    args = parse_args()
    out = args.out if args.out.is_absolute() else (REPO / args.out)
    catalog = build_catalog()
    validate_runtime_ineligibility(catalog)
    rendered = json.dumps(catalog, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.check:
        if not out.is_file():
            print(f"missing manifest: {out}", file=sys.stderr)
            return 1
        actual = out.read_text(encoding="utf-8")
        if actual != rendered:
            print(f"stale manifest: {out}", file=sys.stderr)
            return 1
        print(f"resource manifest current: {out.relative_to(REPO)}")
        return 0
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(rendered, encoding="utf-8")
    eligible = sum(asset["runtimeEligible"] is True for asset in catalog["assets"])
    print(f"WROTE {out.relative_to(REPO)} targets={catalog['scope']['runtimeTargetCount']} runtimeEligibleCount={eligible}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
