#!/usr/bin/env python3
"""Build the direct-load index for staged character-motion libraries."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import shutil
import struct
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[5]
CONFIG_PATH = REPO_ROOT / "_workspace/current/engineering/asset-pipeline/character-motion-library/library-config.json"
ACTION_ORDER = ("idle", "move", "run", "hit", "bighit", "attack", "critical", "avoid", "defence", "die", "show")
LOOPING_ACTIONS = ("idle", "move", "run")
TARGET_ROOT = "assets/motion/ingame/characters"
RIGHTS_RECEIPT_RELATIVE = f"{TARGET_ROOT}/rights-receipt.json"
REGISTRY_RELATIVE = f"{TARGET_ROOT}/registry.json"
BUILT_BY = "_workspace/current/engineering/asset-pipeline/tools/build-character-motion-library-index.py"
HANDOFF_STATUS_SHIPPED = "shipped-runtime-asset-library"
HANDOFF_STATUS_STAGED = "staged-direct-load-not-shipped"
MOTION_AUTHORITY = "derived-retargeted"
ASSET_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
REACHABILITY_METADATA = {
    "broken-court-monarch-boss": {
        "runtimeReachability": "library-only",
    },
    "broken-court-monarch-v04": {
        "runtimeReachability": "library-only",
    },
    "human-command-boss": {
        "runtimeReachability": "library-only",
    },
    "ember-cohort": {
        "runtimeReachability": "catalog-bound",
        "entity": {
            "kind": "companion",
            "companionId": "ember-cohort",
        },
    },
    "guard": {
        "runtimeReachability": "catalog-bound",
        "entity": {
            "kind": "guardian",
        },
    },
    "lantern-reaver": {
        "runtimeReachability": "catalog-bound",
        "entity": {
            "kind": "companion",
            "companionId": "lantern-reaver",
        },
    },
    "possessed": {
        "runtimeReachability": "catalog-bound",
        "entity": {
            "kind": "ranged",
        },
    },
    "scout": {
        "runtimeReachability": "catalog-bound",
        "entity": {
            "kind": "rusher",
        },
    },
    "shade": {
        "runtimeReachability": "catalog-bound",
        "entity": {
            "kind": "flanker",
        },
    },
    "shadow-soldier-v04": {
        "runtimeReachability": "catalog-bound",
        "entity": {
            "kind": "guardian",
        },
    },
    "shadow-commander-boss": {
        "runtimeReachability": "library-only",
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build and validate character motion runtime library artifacts.")
    parser.add_argument("--check", action="store_true", help="Verify promoted artifacts without copying")
    parser.add_argument("--promote", action="store_true", help="Promote staged assets and write runtime artifacts")
    args = parser.parse_args()
    if args.check and args.promote:
        raise RuntimeError("Use exactly one of --check and --promote.")
    return args


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: dict) -> None:
    temporary = path.with_name(f".{path.name}.tmp")
    try:
        temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def resolve_contained_path(relative_path: str, label: str, *, root: Path = REPO_ROOT) -> Path:
    relative = Path(relative_path)
    if relative.is_absolute():
        raise RuntimeError(f"{label} must be repository-relative: {relative_path}")
    path = (REPO_ROOT / relative).resolve()
    allowed_root = root.resolve()
    if not path.is_relative_to(allowed_root):
        raise RuntimeError(f"{label} escapes {allowed_root.relative_to(REPO_ROOT)}: {relative_path}")
    return path


def require_repo_file(relative_path: str, label: str, *, root: Path = REPO_ROOT) -> Path:
    path = resolve_contained_path(relative_path, label, root=root)
    if not path.is_file():
        raise RuntimeError(f"{label} missing: {relative_path}")
    return path


def require_glb(path: Path, label: str) -> None:
    header = path.read_bytes()[:12]
    if len(header) != 12:
        raise RuntimeError(f"{label} is too small to be a GLB")
    magic, version, declared_size = struct.unpack("<4sII", header)
    if magic != b"glTF" or version != 2 or declared_size != path.stat().st_size:
        raise RuntimeError(f"{label} is not a valid self-contained GLB 2.0 container")


def expected_clip_names(asset_id: str) -> dict:
    return {action: f"{asset_id}::{action}::v01" for action in ACTION_ORDER}


def reachability_for_asset(asset_id: str) -> dict:
    metadata = REACHABILITY_METADATA.get(asset_id)
    if metadata is None:
        raise RuntimeError(f"{asset_id}: reachability metadata missing")
    return dict(metadata)


def generation_id(config: dict, assets: list[dict], rights: dict) -> str:
    payload = {
        "sourceFps": config["sourceFps"],
        "sourceRig": config["sourceRig"],
        "targetRig": config["targetRig"],
        "motionBench": config["motionBench"],
        "assets": [
            {
                "assetId": asset["assetId"],
                "role": asset["role"],
                "category": asset["category"],
                "replaces": asset["replaces"],
                "modelSha256": asset["modelSha256"],
                "clips": asset["clips"],
                "reachability": asset["reachability"],
            }
            for asset in assets
        ],
        "rights": rights,
    }
    return hashlib.sha256(
        json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def motion_lineage(config: dict) -> dict:
    return {
        "authority": MOTION_AUTHORITY,
        "sourceRig": config["sourceRig"],
        "sourceLibrary": config["motionBench"],
        "transformation": "retargeted-and-baked",
    }


def validate_rights(rights: dict) -> dict:
    required_scope = {"repository-inclusion", "redistribution"}
    if rights.get("attestedBy") != "user":
        raise RuntimeError("rights must be user attested")
    if rights.get("redistributionStatus") != "user-attested":
        raise RuntimeError("rights redistributionStatus must be user-attested")
    if set(rights.get("attestationScope", ())) != required_scope:
        raise RuntimeError(f"rights attestationScope must be {sorted(required_scope)}")
    if not rights.get("attestationEvidence") or not rights.get("attestedAt"):
        raise RuntimeError("rights attestation evidence and date are required")
    return copy.deepcopy(rights)


def collect_staged_assets(config: dict, rights: dict) -> list[dict]:
    library_root = CONFIG_PATH.parent.resolve()
    motion_bench_root = resolve_contained_path(
        str(config["motionBench"]),
        "motion bench",
    )
    if not motion_bench_root.is_dir():
        raise RuntimeError(f"motion bench missing: {config['motionBench']}")

    characters = config.get("characters")
    if not isinstance(characters, list) or not characters:
        raise RuntimeError("character config must contain at least one character")

    staged_assets: list[dict] = []
    seen_asset_ids: set[str] = set()
    for character in characters:
        asset_id = str(character.get("assetId", ""))
        if not ASSET_ID_PATTERN.fullmatch(asset_id):
            raise RuntimeError(f"unsafe assetId: {asset_id!r}")
        if asset_id in seen_asset_ids:
            raise RuntimeError(f"duplicate assetId: {asset_id}")
        seen_asset_ids.add(asset_id)
        reachability = reachability_for_asset(asset_id)

        asset_root = (library_root / asset_id).resolve()
        if not asset_root.is_relative_to(library_root):
            raise RuntimeError(f"{asset_id}: authoring path escapes the character-motion library")
        manifest_path = asset_root / "manifest.json"
        if not manifest_path.is_file():
            raise RuntimeError(f"{asset_id}: manifest missing")

        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        gate_errors = manifest.get("gateErrors")
        checks = manifest.get("checks")
        if manifest.get("runtimeEligible") is not True:
            raise RuntimeError(f"{asset_id}: runtimeEligible must be true")
        if not isinstance(gate_errors, list) or gate_errors:
            raise RuntimeError(f"{asset_id}: runtime gates not green: {gate_errors}")
        if not isinstance(checks, dict) or not checks or not all(value is True for value in checks.values()):
            raise RuntimeError(f"{asset_id}: one or more manifest checks failed")
        if manifest.get("source") != character.get("source"):
            raise RuntimeError(f"{asset_id}: configured source does not match the staged manifest")
        require_repo_file(str(manifest["source"]), f"{asset_id} source mesh")

        staged_model_path = require_repo_file(
            str(manifest["model"]),
            f"{asset_id} model",
            root=asset_root,
        )
        require_glb(staged_model_path, f"{asset_id} model")
        staged_model_size = staged_model_path.stat().st_size
        if sha256(staged_model_path) != manifest["modelSha256"]:
            raise RuntimeError(f"{asset_id}: model checksum drift")

        require_repo_file(
            str(manifest["reviewBlend"]),
            f"{asset_id} review blend",
            root=asset_root,
        )

        review_root = asset_root / "review"
        contact_sheet = review_root / "contact-sheet.png"
        contact_report = review_root / "contact-sheet.json"
        if not contact_sheet.is_file() or not contact_report.is_file():
            raise RuntimeError(f"{asset_id}: Blender review artifacts missing")

        review = json.loads(contact_report.read_text(encoding="utf-8"))
        if len(review.get("keyposes", [])) != len(ACTION_ORDER):
            raise RuntimeError(f"{asset_id}: expected {len(ACTION_ORDER)} review key poses")
        if review.get("model") != manifest["model"]:
            raise RuntimeError(f"{asset_id}: review model path does not match the manifest")

        expected_contact_sheet = str(contact_sheet.relative_to(REPO_ROOT))
        if review.get("contactSheet") != expected_contact_sheet:
            raise RuntimeError(f"{asset_id}: review contact sheet path mismatch")

        review_by_action = {str(row["action"]): row for row in review["keyposes"]}
        if list(review_by_action) != list(ACTION_ORDER):
            raise RuntimeError(f"{asset_id}: review action order mismatch: {list(review_by_action)}")
        for action, row in review_by_action.items():
            require_repo_file(
                str(row.get("image", "")),
                f"{asset_id} {action} key pose",
                root=review_root,
            )

        clips = manifest.get("clips")
        if not isinstance(clips, list) or len(clips) != len(ACTION_ORDER):
            raise RuntimeError(f"{asset_id}: expected {len(ACTION_ORDER)} staged clips")
        clips_by_action = {str(row["action"]): row for row in clips}
        if set(clips_by_action) != set(ACTION_ORDER):
            raise RuntimeError(f"{asset_id}: clip set mismatch: {tuple(clips_by_action)}")
        clips_by_action = {action: clips_by_action[action] for action in ACTION_ORDER}

        motion_specs = character.get("motions")
        if not isinstance(motion_specs, dict) or set(motion_specs) != set(ACTION_ORDER):
            raise RuntimeError(f"{asset_id}: motion config must declare every action")

        expected_names = expected_clip_names(asset_id)
        for action, expected_name in expected_names.items():
            clip = clips_by_action[action]
            spec = motion_specs[action]
            if clip.get("clipName") != expected_name:
                raise RuntimeError(f"{asset_id}: clip name mismatch for {action}")
            if review_by_action[action].get("clipName") != expected_name:
                raise RuntimeError(f"{asset_id}: review clip name mismatch for {action}")
            if clip.get("source") != spec.get("source"):
                raise RuntimeError(f"{asset_id}: configured source mismatch for {action}")
            if clip.get("loop") is not spec.get("loop"):
                raise RuntimeError(f"{asset_id}: configured loop mismatch for {action}")
            if "gain" in spec and clip.get("gain") != spec["gain"]:
                raise RuntimeError(f"{asset_id}: configured gain mismatch for {action}")

            authored_fallback = spec.get("kind") == "authored-fallback"
            source_relative = (
                str(spec.get("source", ""))
                if authored_fallback
                else f"{config['motionBench']}/{spec.get('source', '')}"
            )
            source_path = require_repo_file(
                source_relative,
                f"{asset_id} {action} motion source",
                root=REPO_ROOT if authored_fallback else motion_bench_root,
            )
            if sha256(source_path) != clip.get("sourceSha256"):
                raise RuntimeError(f"{asset_id}: source checksum mismatch for {action}")

            if authored_fallback:
                if clip.get("kind") != "authored-fallback":
                    raise RuntimeError(f"{asset_id}: {action} must be an authored fallback")
            else:
                required_provenance = ("frameStart", "frameEnd", "sourceFps", "durationSeconds", "sourceRootTravel")
                if any(field not in clip for field in required_provenance):
                    raise RuntimeError(f"{asset_id}: incomplete retarget provenance for {action}")

        normalized_manifest = copy.deepcopy(manifest)
        normalized_manifest["clips"] = clips_by_action
        staged_assets.append(
            {
                "assetId": asset_id,
                "role": manifest["role"],
                "category": manifest["category"],
                "replaces": manifest["source"],
                "stagedModel": manifest["model"],
                "stagedModelBytes": staged_model_size,
                "modelSha256": manifest["modelSha256"],
                "manifestPath": str(manifest_path.relative_to(REPO_ROOT)),
                "runtimeModel": f"{TARGET_ROOT}/{asset_id}/model.glb",
                "runtimeManifest": f"{TARGET_ROOT}/{asset_id}/manifest.json",
                "manifest": normalized_manifest,
                "sourceRights": copy.deepcopy(manifest.get("rights", {})),
                "reviewBlend": manifest["reviewBlend"],
                "contactSheet": str(contact_sheet.relative_to(REPO_ROOT)),
                "clipNames": expected_names,
                "clips": clips_by_action,
                "runtimeEligible": True,
                "reachability": reachability,
            }
        )

    return staged_assets


def build_handoff_output(
    config: dict,
    assets: list[dict],
    *,
    shipped: bool,
    use_runtime_paths: bool,
    revision: str,
) -> dict:
    return {
        "schemaVersion": 1,
        "generatedBy": BUILT_BY,
        "generationId": revision,
        "artifactStatus": HANDOFF_STATUS_SHIPPED if shipped else HANDOFF_STATUS_STAGED,
        "shipped": shipped,
        "commitPolicy": {
            "staging": "explicit-pathspec-only",
            "broadStagingProhibited": True,
            "reviewGeneratedBinariesBeforeCommit": True,
        },
        "sourceFps": config["sourceFps"],
        "sourceRig": config["sourceRig"],
        "targetRig": config["targetRig"],
        "motionLineage": motion_lineage(config),
        "actionOrder": list(ACTION_ORDER),
        "loaderContract": {
            "strategy": "replace-character-model",
            "pathScope": "repository-root-local-runtime" if shipped else "repository-root-local-staging",
            "modelContainsMeshSkinAndAnimations": True,
            "clipLookup": "clipNames[actionId]",
            "loopingActions": list(LOOPING_ACTIONS),
            "inPlaceRootMotion": True,
            "shipped": shipped,
        },
        "promotion": {
            "targetRoot": TARGET_ROOT,
            "requiredBeforeShipping": [
                "record-redistribution-rights-receipt",
                "copy-models-to-tracked-runtime-paths",
                "register-retained-runtime-assets",
                "regenerate-defense-asset-manifest",
                "run-browser-playable-verification",
            ],
        },
        "rights": copy.deepcopy(config["rights"]),
        "assets": [
            {
                "assetId": asset["assetId"],
                "role": asset["role"],
                "category": asset["category"],
                "replaces": asset["replaces"],
                "model": asset["runtimeModel"] if use_runtime_paths else asset["stagedModel"],
                "modelSha256": asset["modelSha256"],
                "manifest": asset["runtimeManifest"] if use_runtime_paths else asset["manifestPath"],
                "reviewBlend": asset["reviewBlend"],
                "contactSheet": asset["contactSheet"],
                "clipNames": asset["clipNames"],
                "clips": asset["clips"],
                "runtimeEligible": True,
                "reachability": asset["reachability"],
            }
            for asset in assets
        ],
    }


def build_rights_receipt(config: dict, assets: list[dict], rights: dict, revision: str) -> dict:
    prior_statuses = sorted(
        {
            str(asset["sourceRights"].get("redistributionStatus", "unverified"))
            for asset in assets
        }
    )
    return {
        "schemaVersion": 1,
        "generatedBy": BUILT_BY,
        "generationId": revision,
        "attestedBy": rights["attestedBy"],
        "attestedAt": rights["attestedAt"],
        "attestationScope": rights["attestationScope"],
        "redistributionStatus": rights["redistributionStatus"],
        "runtimeUseDirectedAt": rights["runtimeUseDirectedAt"],
        "attestationEvidence": rights["attestationEvidence"],
        "source": rights["source"],
        "motionLineage": motion_lineage(config),
        "supersededAssetRedistributionStatuses": prior_statuses,
    }


def build_runtime_manifest(
    asset: dict,
    config: dict,
    rights: dict,
    revision: str,
) -> dict:
    manifest = copy.deepcopy(asset["manifest"])
    for authoring_field in ("generatedAt", "reviewBlend", "rigReport"):
        manifest.pop(authoring_field, None)
    manifest["generatedBy"] = BUILT_BY
    manifest["generationId"] = revision
    manifest["model"] = asset["runtimeModel"]
    manifest["sourceRightsBeforeAttestation"] = asset["sourceRights"]
    manifest["rights"] = copy.deepcopy(rights)
    manifest["rightsReceipt"] = RIGHTS_RECEIPT_RELATIVE
    manifest["motionAuthority"] = MOTION_AUTHORITY
    manifest["motionLineage"] = motion_lineage(config)
    manifest["inPlaceRootMotion"] = True
    manifest["runtimeEligible"] = True
    manifest["clipNames"] = asset["clipNames"]
    manifest["reachability"] = asset["reachability"]
    return manifest


def build_registry(
    config: dict,
    assets: list[dict],
    rights: dict,
    revision: str,
) -> dict:
    total_bytes = sum(asset["stagedModelBytes"] for asset in assets)
    fallback_clips = sum(
        clip.get("kind") == "authored-fallback"
        for asset in assets
        for clip in asset["clips"].values()
    )
    return {
        "schemaVersion": 1,
        "generatedBy": BUILT_BY,
        "generationId": revision,
        "motionAuthority": MOTION_AUTHORITY,
        "motionLineage": motion_lineage(config),
        "rightsReceipt": RIGHTS_RECEIPT_RELATIVE,
        "counts": {
            "assets": len(assets),
            "clips": len(assets) * len(ACTION_ORDER),
            "retargetedClips": len(assets) * len(ACTION_ORDER) - fallback_clips,
            "authoredFallbackClips": fallback_clips,
            "bytes": total_bytes,
        },
        "assets": [
            {
                "assetId": asset["assetId"],
                "role": asset["role"],
                "category": asset["category"],
                "replaces": asset["replaces"],
                "model": asset["runtimeModel"],
                "modelSha256": asset["modelSha256"],
                "manifest": asset["runtimeManifest"],
                "clipNames": asset["clipNames"],
                "clipKinds": {
                    action: clip.get("kind", "retargeted")
                    for action, clip in asset["clips"].items()
                },
                "bytes": asset["stagedModelBytes"],
                "motionAuthority": MOTION_AUTHORITY,
                "loopingActions": list(LOOPING_ACTIONS),
                "inPlaceRootMotion": True,
                "runtimeEligible": True,
                "rightsReceipt": RIGHTS_RECEIPT_RELATIVE,
                **asset["reachability"],
            }
            for asset in assets
        ],
    }


def assert_payload(actual: dict, expected: dict, label: str) -> None:
    if actual == expected:
        return
    differing_fields = sorted(
        key
        for key in set(actual) | set(expected)
        if actual.get(key) != expected.get(key)
    )
    raise RuntimeError(f"{label} drift in fields: {differing_fields}")


def validate_runtime_manifest(
    asset: dict,
    manifest: dict,
    config: dict,
    rights: dict,
    revision: str,
) -> None:
    assert_payload(
        manifest,
        build_runtime_manifest(asset, config, rights, revision),
        f"{asset['assetId']} runtime manifest",
    )


def validate_rights_receipt(
    receipt: dict,
    config: dict,
    assets: list[dict],
    rights: dict,
    revision: str,
) -> None:
    assert_payload(
        receipt,
        build_rights_receipt(config, assets, rights, revision),
        "rights receipt",
    )


def validate_registry(
    registry: dict,
    config: dict,
    assets: list[dict],
    rights: dict,
    revision: str,
) -> None:
    assert_payload(
        registry,
        build_registry(config, assets, rights, revision),
        "registry",
    )


def validate_handoff(
    handoff: dict,
    config: dict,
    assets: list[dict],
    revision: str,
) -> None:
    assert_payload(
        handoff,
        build_handoff_output(
            config,
            assets,
            shipped=True,
            use_runtime_paths=True,
            revision=revision,
        ),
        "handoff",
    )

def write_handoff(
    config: dict,
    assets: list[dict],
    *,
    shipped: bool,
    use_runtime_paths: bool,
    revision: str,
) -> None:
    handoff_path = resolve_contained_path(
        str(config["handoffIndex"]),
        "handoff index",
        root=CONFIG_PATH.parent,
    )
    write_json(
        handoff_path,
        build_handoff_output(
            config,
            assets,
            shipped=shipped,
            use_runtime_paths=use_runtime_paths,
            revision=revision,
        ),
    )


def write_runtime_artifacts(
    config: dict,
    assets: list[dict],
    rights: dict,
    revision: str,
) -> None:
    target_root = resolve_contained_path(TARGET_ROOT, "runtime character root")
    target_root.mkdir(parents=True, exist_ok=True)
    prepared_models: list[tuple[Path, Path]] = []
    try:
        for asset in assets:
            runtime_model_path = resolve_contained_path(
                asset["runtimeModel"],
                f"{asset['assetId']} runtime model",
                root=target_root,
            )
            runtime_model_path.parent.mkdir(parents=True, exist_ok=True)
            temporary_model = runtime_model_path.with_name(f".{runtime_model_path.name}.{revision}.tmp")
            shutil.copy2(REPO_ROOT / asset["stagedModel"], temporary_model)
            require_glb(temporary_model, f"{asset['assetId']} prepared runtime model")
            if temporary_model.stat().st_size != asset["stagedModelBytes"]:
                raise RuntimeError(f"{asset['assetId']}: copied model byte count mismatch")
            if sha256(temporary_model) != asset["modelSha256"]:
                raise RuntimeError(f"{asset['assetId']}: copied model checksum mismatch")
            prepared_models.append((temporary_model, runtime_model_path))

        for temporary_model, runtime_model_path in prepared_models:
            temporary_model.replace(runtime_model_path)

        for asset in assets:
            runtime_manifest_path = resolve_contained_path(
                asset["runtimeManifest"],
                f"{asset['assetId']} runtime manifest",
                root=target_root,
            )
            write_json(
                runtime_manifest_path,
                build_runtime_manifest(asset, config, rights, revision),
            )

        write_json(
            resolve_contained_path(RIGHTS_RECEIPT_RELATIVE, "rights receipt", root=target_root),
            build_rights_receipt(config, assets, rights, revision),
        )
        write_json(
            resolve_contained_path(REGISTRY_RELATIVE, "runtime registry", root=target_root),
            build_registry(config, assets, rights, revision),
        )
    finally:
        for temporary_model, _ in prepared_models:
            temporary_model.unlink(missing_ok=True)


def check_runtime_artifacts(
    assets: list[dict],
    config: dict,
    rights: dict,
    revision: str,
    *,
    require_shipped_handoff: bool = True,
) -> None:
    target_root = resolve_contained_path(TARGET_ROOT, "runtime character root")
    rights_receipt_path = resolve_contained_path(
        RIGHTS_RECEIPT_RELATIVE,
        "rights receipt",
        root=target_root,
    )
    if not rights_receipt_path.is_file():
        raise RuntimeError("rights-receipt.json missing")
    receipt = json.loads(rights_receipt_path.read_text(encoding="utf-8"))
    validate_rights_receipt(receipt, config, assets, rights, revision)

    registry_path = resolve_contained_path(
        REGISTRY_RELATIVE,
        "runtime registry",
        root=target_root,
    )
    if not registry_path.is_file():
        raise RuntimeError("registry.json missing")
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    validate_registry(registry, config, assets, rights, revision)

    declared_files = {RIGHTS_RECEIPT_RELATIVE, REGISTRY_RELATIVE}
    for asset in assets:
        runtime_model_path = resolve_contained_path(
            asset["runtimeModel"],
            f"{asset['assetId']} promoted model",
            root=target_root,
        )
        if not runtime_model_path.is_file():
            raise RuntimeError(f"{asset['assetId']}: promoted model missing")
        require_glb(runtime_model_path, f"{asset['assetId']} promoted model")
        if runtime_model_path.stat().st_size != asset["stagedModelBytes"]:
            raise RuntimeError(f"{asset['assetId']}: promoted model byte count mismatch")
        if sha256(runtime_model_path) != asset["modelSha256"]:
            raise RuntimeError(f"{asset['assetId']}: promoted model hash mismatch")

        runtime_manifest_path = resolve_contained_path(
            asset["runtimeManifest"],
            f"{asset['assetId']} promoted manifest",
            root=target_root,
        )
        if not runtime_manifest_path.is_file():
            raise RuntimeError(f"{asset['assetId']}: promoted manifest missing")
        runtime_manifest = json.loads(runtime_manifest_path.read_text(encoding="utf-8"))
        validate_runtime_manifest(asset, runtime_manifest, config, rights, revision)
        declared_files.update((asset["runtimeModel"], asset["runtimeManifest"]))

    actual_files = {
        str(path.relative_to(REPO_ROOT))
        for path in target_root.rglob("*")
        if path.is_file()
        and not any(part.startswith(".") for part in path.relative_to(target_root).parts)
    }
    if actual_files != declared_files:
        raise RuntimeError(
            "runtime character tree is not closed: "
            f"missing={sorted(declared_files - actual_files)}, "
            f"extra={sorted(actual_files - declared_files)}"
        )

    handoff_path = resolve_contained_path(
        str(config["handoffIndex"]),
        "handoff index",
        root=CONFIG_PATH.parent,
    )
    if not handoff_path.is_file():
        raise RuntimeError("handoff index missing")
    handoff = json.loads(handoff_path.read_text(encoding="utf-8"))
    if require_shipped_handoff:
        validate_handoff(handoff, config, assets, revision)
    else:
        assert_payload(
            handoff,
            build_handoff_output(
                config,
                assets,
                shipped=False,
                use_runtime_paths=False,
                revision=revision,
            ),
            "staged handoff",
        )


def print_summary(config: dict, mode: str, assets: list[dict], revision: str) -> None:
    payload = {
        "mode": mode,
        "generationId": revision,
        "handoffIndex": config["handoffIndex"],
        "assetCount": len(assets),
        "clipCount": len(assets) * len(ACTION_ORDER),
        "totalBytes": sum(asset["stagedModelBytes"] for asset in assets),
    }
    if mode == "promote":
        payload["registry"] = REGISTRY_RELATIVE
        payload["rightsReceipt"] = RIGHTS_RECEIPT_RELATIVE
    print(json.dumps(payload, sort_keys=True))


def main() -> int:
    args = parse_args()
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    rights = validate_rights(config["rights"])
    assets = collect_staged_assets(config, rights)
    revision = generation_id(config, assets, rights)

    if args.check:
        check_runtime_artifacts(
            assets,
            config,
            rights,
            revision,
            require_shipped_handoff=True,
        )
        print_summary(config, "check", assets, revision)
        return 0

    handoff_path = resolve_contained_path(
        str(config["handoffIndex"]),
        "handoff index",
        root=CONFIG_PATH.parent,
    )
    existing_handoff = (
        json.loads(handoff_path.read_text(encoding="utf-8"))
        if handoff_path.is_file()
        else None
    )
    already_shipped = (
        isinstance(existing_handoff, dict)
        and existing_handoff.get("artifactStatus") == HANDOFF_STATUS_SHIPPED
        and existing_handoff.get("shipped") is True
    )

    if args.promote:
        write_handoff(
            config,
            assets,
            shipped=False,
            use_runtime_paths=False,
            revision=revision,
        )
        write_runtime_artifacts(config, assets, rights, revision)
        check_runtime_artifacts(
            assets,
            config,
            rights,
            revision,
            require_shipped_handoff=False,
        )
        write_handoff(
            config,
            assets,
            shipped=True,
            use_runtime_paths=True,
            revision=revision,
        )
        check_runtime_artifacts(
            assets,
            config,
            rights,
            revision,
            require_shipped_handoff=True,
        )
        print_summary(config, "promote", assets, revision)
        return 0

    if already_shipped:
        previous_revision = existing_handoff.get("generationId")
        if previous_revision == revision:
            check_runtime_artifacts(
                assets,
                config,
                rights,
                revision,
                require_shipped_handoff=True,
            )
        elif previous_revision:
            print(
                f"staged inputs changed: {previous_revision} -> {revision}; handoff demoted until --promote",
                file=sys.stderr,
            )
            write_handoff(
                config,
                assets,
                shipped=False,
                use_runtime_paths=False,
                revision=revision,
            )
        else:
            raise RuntimeError("shipped handoff lacks generationId; run --promote to migrate it")
    else:
        write_handoff(
            config,
            assets,
            shipped=False,
            use_runtime_paths=False,
            revision=revision,
        )
    print_summary(config, "build", assets, revision)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError, TypeError, RuntimeError) as error:
        print(f"character motion library error: {error}", file=sys.stderr)
        raise SystemExit(1)
