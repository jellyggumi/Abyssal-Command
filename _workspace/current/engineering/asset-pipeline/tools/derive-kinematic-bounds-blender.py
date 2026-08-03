#!/usr/bin/env python3
"""Stage-A-only rig certification and policy-free motion survey tool.

This file deliberately never bakes or exports motion.  Scratch overlays are compared as
already-existing GLBs, preserving the retargeter as the sole bake authority.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
import sys
import tempfile
import zipfile
from contextlib import contextmanager
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterator

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import bpy
from mathutils import Quaternion

from kinematic_gate import KinematicGateError, angular_distance_degrees, measure_quaternion_track, run_conformance_vectors

REPO_ROOT = Path(__file__).resolve().parents[5]
EXPECTED_MANIFEST = REPO_ROOT / "assets/motion/ingame/manifest.json"
POSE_ALIGNMENT_BONES = (
    "DEF-spine", "DEF-spine.001", "DEF-spine.002", "DEF-spine.003", "DEF-spine.004", "DEF-spine.005",
    "DEF-shoulder.L", "DEF-upper_arm.L", "DEF-forearm.L", "DEF-hand.L",
    "DEF-shoulder.R", "DEF-upper_arm.R", "DEF-forearm.R", "DEF-hand.R",
    "DEF-thigh.L", "DEF-shin.L", "DEF-foot.L", "DEF-toe.L",
    "DEF-thigh.R", "DEF-shin.R", "DEF-foot.R", "DEF-toe.R",
)
OBSERVED_BLENDER_VERSION = "5.1.2"


def require_observed_blender_version() -> None:
    if bpy.app.version_string != OBSERVED_BLENDER_VERSION:
        raise KinematicGateError("KG_BLENDER_VERSION", f"expected Blender {OBSERVED_BLENDER_VERSION}, got {bpy.app.version_string}")




def args_after_dash() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Stage-A kinematic survey/certification tool")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--certify-target-rig")
    mode.add_argument("--survey", action="store_true")
    parser.add_argument("--scratch-overlay")
    parser.add_argument("--scratch-target-rig")
    parser.add_argument("--overlay")
    parser.add_argument("--config")
    parser.add_argument("--corpus-manifest")
    parser.add_argument("--vectors", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args(args_after_dash())
    if args.corpus_manifest is not None and not args.survey:
        parser.error("--corpus-manifest is only valid with --survey")
    if args.survey and args.corpus_manifest is None:
        parser.error("--survey requires --corpus-manifest")
    if args.survey and (args.scratch_overlay or args.overlay or args.scratch_target_rig):
        parser.error("--survey forbids certification-only overlay arguments")
    return args


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ensure_repo_path(path: Path, label: str) -> Path:
    resolved = path.resolve()
    try:
        resolved.relative_to(REPO_ROOT.resolve())
    except ValueError as error:
        raise KinematicGateError("KG_PATH", f"{label} must stay under repository root") from error
    return resolved


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path: Path) -> bpy.types.Object:
    reset_scene()
    # `guess_original_bind_pose` must stay False: left at its default, Blender
    # rebuilds the armature rest from the inverse bind matrices rather than
    # reading `node.rotation`, silently re-posing the rig this tool measures.
    # Same rule and reason as `scripts/measure-joint-articulation.py:113-122`.
    bpy.ops.import_scene.gltf(
        filepath=str(path),
        guess_original_bind_pose=False,
        bone_heuristic="BLENDER",
    )
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise KinematicGateError("KG_TARGET_RIG", f"expected one armature in {path}, found {len(armatures)}")
    armature = armatures[0]
    return armature


def expected_bones() -> set[str]:
    return set(json.loads(EXPECTED_MANIFEST.read_text())["targetBoneNames"])


def canonical_overlay_actions() -> set[str]:
    names = {clip.get("clipName") for clip in json.loads(EXPECTED_MANIFEST.read_text()).get("clipOverrides", [])}
    if len(names) != 21 or None in names or any(not isinstance(name, str) for name in names):
        raise KinematicGateError("KG_OVERLAY_ACTIONS", "shipped manifest must declare exactly 21 unique clipNames")
    return names


def certify_target_rig(rig: Path) -> dict[str, Any]:
    armature = import_glb(rig)
    names = {bone.name for bone in armature.data.bones}
    expected = expected_bones()
    if names != expected:
        raise KinematicGateError("KG_TARGET_RIG_IDENTITY", f"bone identity mismatch; missing={sorted(expected - names)}, extra={sorted(names - expected)}")
    rotations = {bone.name: [float(value) for value in bone.matrix_local.to_quaternion()] for bone in armature.data.bones}
    return {
        "schemaVersion": 1,
        "targetRig": str(rig.relative_to(REPO_ROOT)),
        "targetRigSha256": sha256(rig),
        "targetRigBytes": rig.stat().st_size,
        "blender": {"version": bpy.app.version_string, "executable": bpy.app.binary_path},
        "targetBoneNames": sorted(names),
        "restQuaternions": rotations,
        "poseAlignmentBones": list(POSE_ALIGNMENT_BONES),
        "excludedStaticBones": ["DEF-pelvis.L", "DEF-pelvis.R"],
        "excludedStaticBonesReason": "pelvis helpers intentionally retain target rest pose and are absent from MAPPING_ROWS",
    }


def action_channels(path: Path) -> dict[str, dict[str, Any]]:
    """Extract and immediately sample Blender 5.1 layered action curves at 24 Hz."""
    armature = import_glb(path)
    del armature
    actions: dict[str, dict[str, Any]] = {}
    for action in bpy.data.actions:
        curves = []
        layers = list(getattr(action, "layers", []))
        if layers:
            slots = list(getattr(action, "slots", []))
            if not slots:
                raise KinematicGateError("KG_OVERLAY_ACTIONS", f"layered action {action.name} has no slots")
            for layer in layers:
                for strip in layer.strips:
                    if strip.type != "KEYFRAME":
                        continue
                    for slot in slots:
                        channelbag = strip.channelbag(slot)
                        if channelbag is not None:
                            curves.extend(channelbag.fcurves)
        else:
            legacy = getattr(action, "fcurves", None)
            if legacy is None:
                raise KinematicGateError("KG_OVERLAY_ACTIONS", f"action {action.name} exposes neither layered nor legacy fcurves")
            curves.extend(legacy)
        keyed: dict[str, Any] = {}
        for curve in curves:
            key = curve.data_path + f"[{curve.array_index}]"
            if key in keyed:
                raise KinematicGateError("KG_OVERLAY_CHANNELS", f"ambiguous duplicate fcurve in {action.name}: {key}")
            if not curve.keyframe_points:
                raise KinematicGateError("KG_OVERLAY_CHANNELS", f"empty fcurve in {action.name}: {key}")
            keyed[key] = curve
        if not keyed:
            raise KinematicGateError("KG_OVERLAY_CHANNELS", f"action {action.name} has no keyframe fcurves")
        if action.name in actions:
            raise KinematicGateError("KG_OVERLAY_ACTIONS", f"ambiguous duplicate action name: {action.name}")
        key_times = [float(point.co.x) for curve in keyed.values() for point in curve.keyframe_points]
        start, end = min(key_times), max(key_times)
        sample_times = [start]
        frame = 1
        while start + frame < end - 1e-9:
            sample_times.append(start + frame)
            frame += 1
        if end > start:
            sample_times.append(end)
        actions[action.name] = {
            "sampleTimes": sample_times,
            "channels": {key: [float(curve.evaluate(moment)) for moment in sample_times] for key, curve in keyed.items()},
        }
    return actions

def bind_action_slot(armature: bpy.types.Object, action: bpy.types.Action) -> None:
    armature.animation_data_create()
    animation_data = armature.animation_data
    animation_data.action = action
    candidates = [slot for slot in action.slots if slot.target_id_type == armature.id_type]
    if len(candidates) != 1:
        raise KinematicGateError("KG_ACTION_SLOT", f"expected one {armature.id_type} slot for {action.name}, found {len(candidates)}")
    animation_data.action_slot = candidates[0]
    if animation_data.action_slot != candidates[0]:
        raise KinematicGateError("KG_ACTION_SLOT", f"failed to bind action slot for {action.name}")


def require_rotation_only_channels(channels: dict[str, Any], action_name: str) -> None:
    non_rotation = sorted(channel for channel in channels if "rotation_quaternion" not in channel)
    if non_rotation:
        raise KinematicGateError("KG_OVERLAY_NON_ROTATION", f"{action_name} contains forbidden non-rotation channels: {', '.join(non_rotation)}")

def compare_overlays(scratch: Path, overlay: Path) -> dict[str, Any]:
    left, right = action_channels(scratch), action_channels(overlay)
    expected_actions = canonical_overlay_actions()
    for label, actions in (("scratch", left), ("committed", right)):
        actual_actions = set(actions)
        if actual_actions != expected_actions:
            raise KinematicGateError("KG_OVERLAY_ACTIONS", f"{label} action names differ from shipped manifest; missing={sorted(expected_actions - actual_actions)}, unexpected={sorted(actual_actions - expected_actions)}")
    rows, quaternion_max, max_divergence_location = [], 0.0, None
    for action_name in sorted(left):
        left_action, right_action = left[action_name], right[action_name]
        left_channels, right_channels = left_action["channels"], right_action["channels"]
        if set(left_channels) != set(right_channels):
            raise KinematicGateError("KG_OVERLAY_CHANNELS", f"channel names differ in {action_name}")
        require_rotation_only_channels(left_channels, action_name)
        require_rotation_only_channels(right_channels, action_name)
        if len(left_action["sampleTimes"]) != len(right_action["sampleTimes"]) or any(abs(a - b) > 1e-4 for a, b in zip(left_action["sampleTimes"], right_action["sampleTimes"])):
            raise KinematicGateError("KG_OVERLAY_SAMPLES", f"action duration differs: {action_name}")
        max_scalar = max((abs(a - b) for channel in left_channels for a, b in zip(left_channels[channel], right_channels[channel])), default=0.0)
        groups = defaultdict(dict)
        for channel, samples in left_channels.items():
            if "rotation_quaternion" in channel:
                groups[channel.rsplit("[", 1)[0]][int(channel.rsplit("[", 1)[1][:-1])] = samples
        for prefix, group in groups.items():
            if set(group) != {0, 1, 2, 3}:
                raise KinematicGateError("KG_OVERLAY_CHANNELS", f"incomplete quaternion channel {action_name}/{prefix}")
            right_group = {index: right_channels.get(f"{prefix}[{index}]") for index in range(4)}
            if any(samples is None or len(samples) != len(left_action["sampleTimes"]) for samples in right_group.values()):
                raise KinematicGateError("KG_OVERLAY_CHANNELS", f"incomplete committed quaternion channel {action_name}/{prefix}")
            for sample_index, frame_time in enumerate(left_action["sampleTimes"]):
                scratch_quaternion = [group[index][sample_index] for index in range(4)]
                committed_quaternion = [right_group[index][sample_index] for index in range(4)]
                angular_deviation = angular_distance_degrees(scratch_quaternion, committed_quaternion)
                if angular_deviation > quaternion_max:
                    quaternion_max = angular_deviation
                    bone = prefix.split('pose.bones["', 1)[1].split('"]', 1)[0]
                    max_divergence_location = {
                        "clipName": action_name,
                        "targetBone": bone,
                        "channel": prefix,
                        "frameTime": frame_time,
                        "sampleIndex": sample_index,
                        "angularDeviationDeg": angular_deviation,
                        "scratchQuaternion": scratch_quaternion,
                        "committedQuaternion": committed_quaternion,
                    }
        rows.append({"clipName": action_name, "maxScalarDeviation": max_scalar})
    return {"scratchOverlay": str(scratch.relative_to(REPO_ROOT)), "overlay": str(overlay.relative_to(REPO_ROOT)), "clips": rows, "maxAngularDeviationDeg": quaternion_max, "maxDivergenceLocation": max_divergence_location, "thresholdDeg": 0.5, "passed": quaternion_max <= 0.5}


def load_survey_corpus(manifest_path: Path) -> list[dict[str, Any]]:
    manifest_path = ensure_repo_path(manifest_path, "corpus manifest")
    try:
        manifest = json.loads(manifest_path.read_text())
        loose_root, expected_loose = manifest["looseRoot"], manifest["expectedLooseFbx"]
        archives, death_candidates = manifest["archives"], manifest["deathCandidates"]
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise KinematicGateError("KG_SURVEY_CORPUS", "invalid corpus manifest") from error
    if manifest.get("schemaVersion") != 1 or not isinstance(loose_root, str) or not isinstance(expected_loose, int) or expected_loose < 0 or not isinstance(archives, list) or not isinstance(death_candidates, list) or len(death_candidates) != 5 or len(set(death_candidates)) != 5:
        raise KinematicGateError("KG_SURVEY_CORPUS", "corpus manifest schema/counts are invalid")
    loose_dir = ensure_repo_path(REPO_ROOT / loose_root, "corpus looseRoot")
    if not loose_dir.is_dir():
        raise KinematicGateError("KG_SURVEY_CORPUS", "corpus looseRoot is missing")
    loose_paths = sorted(path for path in loose_dir.iterdir() if path.is_file() and path.suffix.lower() == ".fbx")
    if len(loose_paths) != expected_loose:
        raise KinematicGateError("KG_SURVEY_CORPUS", f"expected {expected_loose} loose FBX files, found {len(loose_paths)}")
    candidates = [{"sourceGroup": {"repoRelativePath": str(path.relative_to(REPO_ROOT.resolve())), "sha256": sha256(path)}} for path in loose_paths]
    for archive in archives:
        if not isinstance(archive, dict) or not isinstance(archive.get("path"), str) or not isinstance(archive.get("expectedFbx"), int):
            raise KinematicGateError("KG_SURVEY_CORPUS", "archive entry is invalid")
        archive_path = ensure_repo_path(REPO_ROOT / archive["path"], "corpus archive")
        if not archive_path.is_file() or not zipfile.is_zipfile(archive_path):
            raise KinematicGateError("KG_SURVEY_CORPUS", f"archive is missing or invalid: {archive['path']}")
        with zipfile.ZipFile(archive_path) as handle:
            members = sorted(member for member in handle.namelist() if member.lower().endswith(".fbx") and not member.endswith("/"))
            if len(members) != archive["expectedFbx"] or len(set(members)) != len(members):
                raise KinematicGateError("KG_SURVEY_CORPUS", f"archive member count mismatch: {archive['path']}")
            for member in members:
                member_path = Path(member)
                if member_path.is_absolute() or ".." in member_path.parts:
                    raise KinematicGateError("KG_SURVEY_CORPUS", f"unsafe archive member: {member}")
                candidates.append({"sourceGroup": {"repoRelativePath": f"{archive['path']}!{member}", "sha256": hashlib.sha256(handle.read(member)).hexdigest()}, "archivePath": archive["path"], "archiveMember": member})
    candidates.sort(key=lambda candidate: candidate["sourceGroup"]["repoRelativePath"])
    provenance = {candidate["sourceGroup"]["repoRelativePath"] for candidate in candidates}
    if not all(isinstance(candidate, str) and candidate in provenance for candidate in death_candidates):
        raise KinematicGateError("KG_SURVEY_CORPUS", "death candidate is absent from the corpus")
    deaths = set(death_candidates)
    for candidate in candidates:
        candidate["candidateActionClasses"] = ["die"] if candidate["sourceGroup"]["repoRelativePath"] in deaths else []
    return candidates


@contextmanager
def materialize_survey_candidate(candidate: dict[str, Any]) -> Iterator[Path]:
    if "archivePath" not in candidate:
        yield ensure_repo_path(REPO_ROOT / candidate["sourceGroup"]["repoRelativePath"], "survey source")
        return
    archive_path = ensure_repo_path(REPO_ROOT / candidate["archivePath"], "survey archive")
    with tempfile.TemporaryDirectory(prefix="kinematic-survey-") as temporary:
        destination = Path(temporary) / candidate["archiveMember"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive_path) as archive:
            destination.write_bytes(archive.read(candidate["archiveMember"]))
        yield destination


def survey(config_path: Path, corpus_manifest_path: Path) -> dict[str, Any]:
    config = json.loads(config_path.read_text())
    bench_root = ensure_repo_path(REPO_ROOT / config["motionBench"], "motion bench")
    source_actions: dict[str, set[str]] = defaultdict(set)
    authored = []
    for character in config["characters"]:
        for action_key, motion in character["motions"].items():
            if motion.get("kind") == "authored-fallback":
                authored.append({"assetId": character["assetId"], "action": action_key, "source": motion["source"]})
            else:
                source_actions[str((bench_root / motion["source"]).relative_to(REPO_ROOT))].add(action_key)
    candidates = load_survey_corpus(corpus_manifest_path)
    for candidate in candidates:
        source_group = candidate["sourceGroup"]["repoRelativePath"]
        if "die" in source_actions.get(source_group, set()) and "die" not in candidate["candidateActionClasses"]:
            raise KinematicGateError("KG_SURVEY_CORPUS", f"config cannot label non-manifest source as die: {source_group}")
    rows = []
    for candidate in candidates:
        source_group = candidate["sourceGroup"]
        action_classes = sorted(set(candidate["candidateActionClasses"]) | source_actions.get(source_group["repoRelativePath"], set()))
        with materialize_survey_candidate(candidate) as source:
            reset_scene()
            bpy.ops.import_scene.fbx(filepath=str(source))
            armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
            if len(armatures) != 1:
                raise KinematicGateError("KG_SURVEY_SOURCE", f"expected one armature in {source_group['repoRelativePath']}, found {len(armatures)}")
            armature = armatures[0]
            actions = list(bpy.data.actions)
            if len(actions) != 1:
                raise KinematicGateError("KG_SURVEY_SOURCE", f"expected one action in {source_group['repoRelativePath']}, found {len(actions)}")
            action = actions[0]
            bind_action_slot(armature, action)
            start, end = (int(round(value)) for value in action.frame_range)
            animated_pose_seen, channel_rows = False, []
            for bone in armature.pose.bones:
                samples = []
                for frame in range(start, end + 1):
                    bpy.context.scene.frame_set(frame)
                    sample = tuple(bone.rotation_quaternion)
                    animated_pose_seen = animated_pose_seen or angular_distance_degrees(sample, tuple(bone.bone.matrix_local.to_quaternion())) > 0.01
                    samples.append(sample)
                metrics = measure_quaternion_track(samples)
                total_variation = sum(angular_distance_degrees(samples[index - 1], samples[index]) for index in range(1, len(samples)))
                channel_rows.append({"bone": bone.name, "peakDeg": metrics["peakDeg"], "stepDeg": metrics["stepDeg"], "totalVariationDeg": total_variation, "animatedCandidate": total_variation > 0.5 or metrics["stepDeg"] > 0.01})
            if not animated_pose_seen:
                raise KinematicGateError("KG_ACTION_SLOT", f"sampled action stayed at rest: {action.name}")
        rows.append({"sourceGroup": source_group, "candidateActionClasses": action_classes, "frameRange": [start, end], "frameCount": end - start + 1, "sampleFps": 24, "channels": channel_rows})
    return {"schemaVersion": 1, "kind": "policy-free-raw-survey", "sampleFps": 24, "blender": {"version": bpy.app.version_string, "executable": bpy.app.binary_path}, "corpusManifest": str(ensure_repo_path(corpus_manifest_path, "corpus manifest").relative_to(REPO_ROOT)), "sources": rows, "authoredFallbacksExcluded": authored}


def main() -> int:
    args = parse_args()
    require_observed_blender_version()
    run_conformance_vectors(Path(args.vectors))
    out = ensure_repo_path(Path(args.out), "out")
    out.parent.mkdir(parents=True, exist_ok=True)
    if args.certify_target_rig:
        rig = ensure_repo_path(Path(args.certify_target_rig), "target rig")
        if not rig.is_file():
            raise KinematicGateError("KG_TARGET_RIG", f"missing target rig: {rig}")
        if bool(args.scratch_overlay) != bool(args.overlay):
            raise KinematicGateError("KG_OVERLAY_PAIR", "--scratch-overlay and --overlay must be supplied together")
        if args.scratch_target_rig and not args.scratch_overlay:
            raise KinematicGateError("KG_OVERLAY_PAIR", "--scratch-target-rig requires --scratch-overlay")
        provenance = rig.with_suffix(".provenance.json")
        if not provenance.is_file():
            raise KinematicGateError("KG_TARGET_RIG_PROVENANCE", f"recovery provenance missing: {provenance}")
        recovery = json.loads(provenance.read_text())
        required_recovery = ("originCommit", "deletedBy", "originPath", "targetRigSha256", "targetRigBytes", "recoveryCommand")
        missing_recovery = [field for field in required_recovery if field not in recovery]
        if missing_recovery:
            raise KinematicGateError("KG_TARGET_RIG_PROVENANCE", f"recovery provenance missing fields: {', '.join(missing_recovery)}")
        if recovery["targetRigSha256"] != sha256(rig) or recovery["targetRigBytes"] != rig.stat().st_size:
            raise KinematicGateError("KG_TARGET_RIG_HASH", "recovery provenance hash/bytes disagree with target rig")
        try:
            recovered = subprocess.run(
                ["git", "show", f"{recovery['originCommit']}:{recovery['originPath']}"],
                cwd=REPO_ROOT, check=True, capture_output=True,
            ).stdout
        except subprocess.CalledProcessError as error:
            raise KinematicGateError("KG_TARGET_RIG_PROVENANCE", "unable to read certified origin blob") from error
        if len(recovered) != recovery["targetRigBytes"] or hashlib.sha256(recovered).hexdigest() != recovery["targetRigSha256"]:
            raise KinematicGateError("KG_TARGET_RIG_PROVENANCE", "certified rig does not match originCommit:originPath")
        report = {**recovery, **certify_target_rig(rig)}
        if args.scratch_overlay:
            scratch_target_rig = ensure_repo_path(Path(args.scratch_target_rig), "scratch target rig") if args.scratch_target_rig else None
            if scratch_target_rig is None or not scratch_target_rig.is_file() or sha256(scratch_target_rig) != sha256(rig):
                raise KinematicGateError("KG_TARGET_RIG_PROVENANCE", "scratch target rig must match the certified target rig")
            report["reproductionDiff"] = compare_overlays(ensure_repo_path(Path(args.scratch_overlay), "scratch overlay"), ensure_repo_path(Path(args.overlay), "overlay"))
            if not report["reproductionDiff"]["passed"]:
                out.write_text(json.dumps(report, indent=2) + "\n")
                raise KinematicGateError("KG_TARGET_RIG_REPRODUCTION", "scratch overlay exceeds 0.5-degree reproduction limit")
        provenance.write_text(json.dumps(report, indent=2) + "\n")
    else:
        if args.scratch_overlay or args.overlay or args.scratch_target_rig or not args.config or not args.corpus_manifest:
            raise KinematicGateError("KG_SURVEY_ARGUMENTS", "--survey requires --config and --corpus-manifest and forbids certification-only overlay arguments")
        report = survey(ensure_repo_path(Path(args.config), "config"), ensure_repo_path(Path(args.corpus_manifest), "corpus manifest"))
    out.write_text(json.dumps(report, indent=2) + "\n")
    print("KINEMATIC_DERIVE_RESULT_JSON:" + json.dumps({"out": str(out), "mode": "certify" if args.certify_target_rig else "survey"}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KinematicGateError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2)
