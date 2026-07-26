#!/usr/bin/env python3
"""Build a deterministic concept/reference motion prompt batch.

This tool consumes the canonical action pipeline and emits one prompt per
runtime action key. It deliberately writes a concept/reference candidate
packet: it never calls an image or animation service and never writes GLBs.
Animation authoring remains a Blender NLA job, and runtime eligibility stays
false until the handoff evidence is complete.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ACTIONS_JSON = ROOT / "_workspace/20260723-solo-warden-rpg-concept/production/boss-motion-previs-action-pipeline.json"
DEFAULT_CONCEPT_INPUTS = (
    "assets/images/battle/pilot/dusk-warden-idle-gti.png",
    "assets/images/battle/pilot/dusk-warden-idle-gti-refstyle.png",
    "assets/images/battle/pilot/dusk-warden-cartoon-albedo.png",
)
EXPECTED_ACTIONS = (
    "idle",
    "move",
    "run",
    "hit",
    "bighit",
    "attack",
    "critical",
    "avoid",
    "defence",
    "die",
    "show",
)
DEFAULT_VARIANT = "v01"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--actions-json",
        default=str(DEFAULT_ACTIONS_JSON),
        help="Canonical action pipeline JSON (default: project pipeline).",
    )
    parser.add_argument("--out", required=True, help="Output JSON packet path.")
    parser.add_argument("--asset-id", required=True, help="Runtime actor ID, e.g. dusk-warden.")
    parser.add_argument(
        "--category",
        default="concept-reference",
        help="Concept lane category label (default: concept-reference).",
    )
    return parser.parse_args()


def relative_project_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def load_json(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            value = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read actions JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError("actions JSON must contain an object")
    return value


def validate_asset_id(asset_id: str) -> str:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", asset_id):
        raise ValueError("--asset-id must contain lowercase letters, digits, and hyphens")
    return asset_id


def action_records(pipeline: dict[str, Any]) -> dict[str, dict[str, Any]]:
    records = pipeline.get("actionDefinitions")
    if not isinstance(records, list):
        raise ValueError("actions JSON is missing actionDefinitions[]")
    by_action: dict[str, dict[str, Any]] = {}
    for record in records:
        if not isinstance(record, dict) or not isinstance(record.get("action"), str):
            raise ValueError("every action definition must be an object with an action string")
        action = record["action"]
        if action in by_action:
            raise ValueError(f"duplicate action definition: {action}")
        by_action[action] = record
    missing = [action for action in EXPECTED_ACTIONS if action not in by_action]
    extra = sorted(set(by_action) - set(EXPECTED_ACTIONS))
    if missing or extra:
        details = []
        if missing:
            details.append(f"missing={','.join(missing)}")
        if extra:
            details.append(f"unexpected={','.join(extra)}")
        raise ValueError("actionDefinitions must contain exactly the 11 runtime actions (" + "; ".join(details) + ")")
    return by_action


def ensure_concept_inputs() -> tuple[list[str], list[dict[str, Any]]]:
    """Fail closed when concept art lacks its provenance sidecar."""
    paths = [*DEFAULT_CONCEPT_INPUTS, relative_project_path(DEFAULT_ACTIONS_JSON)]
    records: list[dict[str, Any]] = []
    for rel in DEFAULT_CONCEPT_INPUTS:
        source = ROOT / rel
        sidecar = source.with_suffix(".provenance.json")
        if not source.is_file():
            raise ValueError(f"missing concept source input: {rel}")
        if not sidecar.is_file():
            raise ValueError(f"missing concept provenance sidecar: {sidecar.relative_to(ROOT)}")
        try:
            with sidecar.open("r", encoding="utf-8") as handle:
                provenance = json.load(handle)
        except (OSError, json.JSONDecodeError) as exc:
            raise ValueError(f"invalid concept provenance sidecar {sidecar}: {exc}") from exc
        # A concept reference may never silently become a runtime input.
        if provenance.get("runtimeEligible") is not False:
            raise ValueError(f"concept source is not explicitly runtimeEligible=false: {rel}")
        if "/glb/" in rel or "/models/" in rel:
            raise ValueError(f"runtime path cannot be a concept source input: {rel}")
        records.append(
            {
                "path": rel,
                "sidecarPath": relative_project_path(sidecar),
                "lane": "concept/reference",
                "runtimeEligible": False,
            }
        )
    pipeline_rel = relative_project_path(DEFAULT_ACTIONS_JSON)
    if not (ROOT / pipeline_rel).is_file():
        raise ValueError(f"missing action pipeline source input: {pipeline_rel}")
    records.append(
        {
            "path": pipeline_rel,
            "kind": "action-pipeline",
            "lane": "concept/reference",
            "runtimeEligible": False,
        }
    )
    return paths, records


def display_name(asset_id: str) -> str:
    return " ".join(part.capitalize() for part in asset_id.split("-"))


def key_poses(signature_poses: list[str], budget: dict[str, Any]) -> list[dict[str, Any]]:
    if not signature_poses:
        raise ValueError("action definition has no signaturePoses")
    count = len(signature_poses)
    # Keep deterministic percentages while leaving the first/last pose visible.
    denominator = max(1, count - 1)
    poses = []
    for index, label in enumerate(signature_poses):
        poses.append(
            {
                "timePct": round(index * 100 / denominator, 2),
                "poseLabel": label,
                "speedHint": "hold" if index in (0, count - 1) else "drive",
            }
        )
    # keyframeBudgets describe the eventual Blender bake, while
    # signaturePoses are the compact prompt vocabulary. They intentionally do
    # not have to contain the same number of entries.
    if not isinstance(budget.get("keyPoses", {}), dict):
        raise ValueError("keyframe budget keyPoses must be an object")
    return poses


def make_prompt(
    asset_id: str,
    action: str,
    definition: dict[str, Any],
    budget: dict[str, Any],
    motion_tone: str,
) -> dict[str, Any]:
    variant = DEFAULT_VARIANT
    clip_id = f"{asset_id}::{action}::{variant}"
    character = display_name(asset_id)
    poses = key_poses(definition.get("signaturePoses", []), budget)
    intent = str(definition.get("intent", ""))
    framing = "full-body centered silhouette, unobstructed feet and hands, 2.5D isometric readability"
    prompt_text = (
        f"Concept/reference motion study for {character}, action {action}, variant {variant}. "
        "Abyssal Surge vocabulary: Dusk Warden in the Echo Deep approaching Gate Zenith; "
        "dramatic progression hunt→extract→materialize→capture→assault. "
        f"Use the {motion_tone} tone and {intent}; stage anticipation, clear action peak, and settle/recovery. "
        "Original cel-shaded painterly 2.5D silhouette with sharp edge contrast and restrained particle accents. "
        "No logos, no trademarked silhouettes, no copied emblems, no watermarks, no text. "
        "Concept/reference lane only: do not produce a runtime asset; Blender NLA authors the actual animation and runtime verification is required."
    )
    return {
        "promptId": f"motion-prompt::{clip_id}",
        "clipId": clip_id,
        "runtimeClipKey": action,
        "version": "1.0.0",
        "boss": asset_id,
        "action": action,
        "variant": variant,
        "camera": {"angleDeg": 45, "pitchDeg": 35, "distance": 4.0, "fov": 35},
        "framing": framing,
        "motionIntent": intent,
        "keyPoses": poses,
        "constraints": [
            "concept/reference lane only",
            "no logos, trademarked silhouettes, copied emblems, watermarks, or text",
            "no pedestal, terrain, or weapons in the generated motion reference",
            "preserve a clean T-pose-compatible character silhouette",
            "actual animation is produced by Blender NLA; this prompt is not a runtime clip",
        ],
        "qualityTags": [
            "Dusk Warden",
            "Echo Deep",
            "Gate Zenith",
            "hunt→extract→materialize→capture→assault",
            "cel-shaded",
            "original silhouette",
        ],
        "prompt": prompt_text,
        "timing": {
            "sourceFps": 60,
            "runtimeFps": 30,
            "sourceFrameBudget": budget.get("target"),
            "runtimeFrameBudget": round(budget.get("target", 0) / 2),
            "frameToRuntimeRatio": 2,
            "loop": bool(definition.get("loop", False)),
        },
        "production": {
            "animationAuthoring": "Blender NLA",
            "runtimeVerificationRequired": True,
            "runtimeEligible": False,
        },
    }


def build_batch(actions_path: Path, asset_id: str, category: str) -> dict[str, Any]:
    pipeline = load_json(actions_path)
    by_action = action_records(pipeline)
    source_inputs, source_records = ensure_concept_inputs()
    budgets = pipeline.get("keyframeBudgets")
    if not isinstance(budgets, dict):
        raise ValueError("actions JSON is missing keyframeBudgets")
    transition = pipeline.get("transitionMatrix")
    if not isinstance(transition, dict):
        raise ValueError("actions JSON is missing transitionMatrix")
    profiles = pipeline.get("characterPromptProfiles", {})
    profile = profiles.get("sung-hum", {}) if isinstance(profiles, dict) else {}
    motion_tone = "disciplined-hunter"
    if isinstance(profile, dict) and isinstance(profile.get("motionTone"), str):
        motion_tone = profile["motionTone"]

    prompts = [
        make_prompt(asset_id, action, by_action[action], budgets[action], motion_tone)
        for action in EXPECTED_ACTIONS
    ]
    required_clip_ids = [prompt["clipId"] for prompt in prompts]
    return {
        "schemaVersion": "motion-prompt-batch-1.0",
        "artifactType": "motion-prompt-batch",
        "artifactStatus": "candidate-not-shipped",
        "lane": "concept/reference",
        "category": category,
        "assetId": asset_id,
        "assetDisplayName": display_name(asset_id),
        "sourcePipeline": relative_project_path(actions_path),
        "sourceInputs": source_inputs,
        "sourceInputRecords": source_records,
        "conceptVocabulary": {
            "character": "Dusk Warden",
            "world": ["Echo Deep", "Gate Zenith"],
            "progression": "hunt→extract→materialize→capture→assault",
        },
        "productionContract": {
            "sourceFps": 60,
            "runtimeFps": 30,
            "frameToRuntimeRatio": 2,
            "clipIdPattern": "{assetId}::{action}::{variant}",
            "actionIds": list(EXPECTED_ACTIONS),
            "animationAuthoring": "Blender NLA",
            "runtimeVerificationRequired": True,
        },
        "prompts": prompts,
        "candidateArtifacts": {
            "lane": "staging/candidate",
            "runtimeEligible": False,
            "shipped": False,
            "requiredSidecars": ["{candidate}.provenance.json"],
            "requiredProvenanceFields": [
                "runtimeEligible",
                "source",
                "generator",
                "output",
                "rightsReceipt",
                "runtimeReceipt",
            ],
            "note": "Prompt and generated media candidates remain separate from deployed runtime assets until provenance, rights, GLB embedding, and browser/fallback verification are recorded.",
        },
        "runtimeHandoff": {
            "runtimeEligible": False,
            "required": {
                "tposeOk": True,
                "noPedestal": True,
                "noTerrain": True,
                "noWeapons": True,
                "requiredClipKeys": list(EXPECTED_ACTIONS),
                "requiredClipIds": required_clip_ids,
            },
            "verified": {
                "tposeOk": False,
                "noPedestal": False,
                "noTerrain": False,
                "noWeapons": False,
                "requiredClipKeys": False,
            },
            "verificationStatus": "pending-runtime-verification",
            "runtimeAssetPath": f"assets/images/battle/glb/commander/{asset_id}.glb",
            "preserveExistingRuntimePath": True,
            "note": "Do not copy concept/reference media into the runtime lane. Blender NLA bake, GLB embedding, rights/provenance, and browser/fallback checks must pass before eligibility can change.",
        },
    }


def main() -> int:
    args = parse_args()
    try:
        asset_id = validate_asset_id(args.asset_id)
        actions_path = Path(args.actions_json)
        if not actions_path.is_absolute():
            actions_path = ROOT / actions_path
        output_path = Path(args.out)
        if not output_path.is_absolute():
            output_path = ROOT / output_path
        if "/assets/images/battle/glb/" in output_path.as_posix():
            raise ValueError("refusing to write a concept batch under the runtime GLB path")
        batch = build_batch(actions_path.resolve(), asset_id, args.category)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(batch, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    print(f"WROTE {relative_project_path(output_path)} prompts={len(batch['prompts'])} runtimeEligible={batch['runtimeHandoff']['runtimeEligible']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
