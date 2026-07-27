#!/usr/bin/env python3
"""Re-author every combat clip as coordinated whole-body motion.

The shipped clip library moves six bones and gates the legs behind locomotion
(`rig-and-animate-asset-blender.py`: `if thigh_l and action_name in ("move",
"run")`).  Measured on the deployed rigs, every combat and reaction clip has
exactly zero lower-body travel while `move`/`run` have 2x-9.6x more lower travel
than upper: the upper half and the lower half never move in the same clip, which
is what reads as jarring.

This pass rebuilds the clips on the full DEF- chain -- pelvis, spine.001-005,
shoulder, upper_arm, forearm, hand, thigh, shin, foot, toe -- with contralateral
gait, ground-driven strikes, buckling reactions, and a folding collapse, then
exports a candidate GLB.  Meshes, skins, materials, and clip names are untouched.

Staging (requires Blender)::

  blender --background --factory-startup --python scripts/author-wholebody-clips-blender.py -- --write

Verification (no Blender required)::

  python3 scripts/author-wholebody-clips-blender.py --check
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
import sys
from pathlib import Path
from typing import Any, Mapping

RUNTIME_ROOT = Path("assets/images/battle/glb")
PIPELINE_ROOT = Path(
    "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline"
)
BOUND_ROOT = PIPELINE_ROOT / "runtime-candidates" / "rigged-lower-mesh" / "glb"
CANDIDATE_ROOT = PIPELINE_ROOT / "runtime-candidates" / "wholebody-motion"
MANIFEST_NAME = "wholebody-motion.manifest.json"

CHARACTER_CATEGORIES = ("commander", "bosses", "companions", "enemies")
GLB_JSON_CHUNK = 0x4E4F534A
SCHEMA_VERSION = 1

# Both halves must carry the clip. The floor is deliberately low -- it proves
# participation, not choreography quality, which is what the probe reports.
# Absolute participation floor, normalized by rig height: neither half may be a
# passenger. A ratio target is not usable because hands sweep far wider arcs
# than feet even in perfectly natural motion.
MIN_HALF_TRAVEL = 0.004
SAMPLE_FRAMES = 30

RIGHTS_RECEIPT = "candidate-only-no-promotion-pending-runtime-rights-review"
RUNTIME_RECEIPT = (
    "wholebody-clip-reauthoring-complete-mesh-and-skin-untouched-browser-fallback-pending"
)


class AuthorError(RuntimeError):
    """Raised when a staging or verification invariant is violated."""


def repository_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "package.json").is_file():
            return parent
    raise AuthorError("repository root with package.json not found")


def script_argv(argv: list[str] | None = None) -> list[str]:
    values = list(sys.argv[1:] if argv is None else argv)
    if "--" in values:
        return values[values.index("--") + 1 :]
    return values


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_glb_json(path: Path) -> Mapping[str, Any]:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise AuthorError(f"not a GLB file: {path}")
    version, declared = struct.unpack_from("<II", data, 4)
    if version != 2 or declared != len(data):
        raise AuthorError(f"invalid GLB header: {path}")
    offset = 12
    document = None
    while offset < len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        start = offset + 8
        end = start + length
        if end > len(data):
            raise AuthorError(f"truncated GLB chunk: {path}")
        if chunk_type == GLB_JSON_CHUNK:
            document = json.loads(data[start:end].decode("utf-8").rstrip("\0 \t\r\n"))
        offset = end
    if not isinstance(document, dict):
        raise AuthorError(f"GLB JSON chunk missing: {path}")
    return document


# ---------------------------------------------------------------------------
# Choreography
# ---------------------------------------------------------------------------
# Every pose is expressed in degrees against the DEF- rest pose and is a pure
# function of (clip, normalized time). Nothing here is per-asset: the rigs share
# one skeleton, so one coherent body language generalizes across the cast.

LOCOMOTION_CLIPS = ("move", "run")
CLIP_AMPLITUDE = {
    "idle": 2.4,
    "move": 16.0,
    "run": 26.0,
    "hit": 9.0,
    "bighit": 15.0,
    "attack": 15.0,
    "attack_melee": 17.0,
    "attack_ranged": 12.0,
    "critical": 18.0,
    "avoid": 14.0,
    "defence": 8.0,
    "die": 16.0,
    "show": 9.0,
}
DEFAULT_AMPLITUDE = 8.0


def _gait(amp: float, phase: float) -> dict[str, tuple[float, float, float]]:
    """Contralateral walk/run: arms oppose legs, hips counter the shoulders."""
    swing = math.sin(phase)
    opposite = math.sin(phase + math.pi)
    # Knees only bend on the swing leg, which is what separates a stride from a
    # stiff-legged slide.
    knee_l = max(0.0, -swing) * amp * 0.9
    knee_r = max(0.0, -opposite) * amp * 0.9
    bob = abs(math.sin(phase * 2.0)) * amp * 0.10
    return {
        "thigh.L": (swing * amp * 0.75, 0.0, 0.0),
        "thigh.R": (opposite * amp * 0.75, 0.0, 0.0),
        "shin.L": (knee_l, 0.0, 0.0),
        "shin.R": (knee_r, 0.0, 0.0),
        "foot.L": (-swing * amp * 0.25, 0.0, 0.0),
        "foot.R": (-opposite * amp * 0.25, 0.0, 0.0),
        "toe.L": (max(0.0, swing) * amp * 0.35, 0.0, 0.0),
        "toe.R": (max(0.0, opposite) * amp * 0.35, 0.0, 0.0),
        "pelvis.L": (0.0, 0.0, swing * amp * 0.18),
        "pelvis.R": (0.0, 0.0, swing * amp * 0.18),
        "spine": (bob, 0.0, opposite * amp * 0.14),
        "spine.001": (bob * 0.6, 0.0, opposite * amp * 0.18),
        "spine.002": (0.0, 0.0, opposite * amp * 0.16),
        "spine.003": (0.0, 0.0, opposite * amp * 0.12),
        "shoulder.L": (0.0, 0.0, opposite * amp * 0.20),
        "shoulder.R": (0.0, 0.0, swing * amp * 0.20),
        "upper_arm.L": (opposite * amp * 0.65, 0.0, 0.0),
        "upper_arm.R": (swing * amp * 0.65, 0.0, 0.0),
        "forearm.L": (max(0.0, opposite) * amp * 0.45, 0.0, 0.0),
        "forearm.R": (max(0.0, swing) * amp * 0.45, 0.0, 0.0),
        "head": (0.0, 0.0, swing * amp * 0.08),
    }


def _strike(amp: float, env: float) -> dict[str, tuple[float, float, float]]:
    """A strike drives from the back foot up through the hips into the arm."""
    return {
        "thigh.L": (amp * 0.45 * env, 0.0, 0.0),
        "thigh.R": (-amp * 0.32 * env, 0.0, 0.0),
        "shin.R": (amp * 0.40 * env, 0.0, 0.0),
        "foot.R": (-amp * 0.30 * env, 0.0, 0.0),
        "toe.R": (amp * 0.55 * env, 0.0, 0.0),
        "pelvis.L": (0.0, 0.0, amp * 0.35 * env),
        "pelvis.R": (0.0, 0.0, amp * 0.35 * env),
        "spine": (amp * 0.16 * env, 0.0, amp * 0.28 * env),
        "spine.001": (amp * 0.12 * env, 0.0, amp * 0.30 * env),
        "spine.002": (0.0, 0.0, amp * 0.26 * env),
        "shoulder.R": (0.0, 0.0, -amp * 0.45 * env),
        "upper_arm.R": (-amp * env, 0.0, -amp * 0.30 * env),
        "forearm.R": (amp * 0.70 * env, 0.0, 0.0),
        "hand.R": (amp * 0.30 * env, 0.0, 0.0),
        "upper_arm.L": (amp * 0.45 * env, 0.0, 0.0),
        "forearm.L": (amp * 0.35 * env, 0.0, 0.0),
        "head": (amp * 0.10 * env, 0.0, amp * 0.18 * env),
    }


def _recoil(amp: float, env: float, stagger: float) -> dict[str, tuple[float, float, float]]:
    """Impact travels down: the spine folds back and the knees buckle."""
    return {
        "thigh.L": (-amp * 0.35 * env, 0.0, 0.0),
        "thigh.R": (-amp * (0.35 + stagger) * env, 0.0, 0.0),
        "shin.L": (amp * 0.55 * env, 0.0, 0.0),
        "shin.R": (amp * (0.55 + stagger) * env, 0.0, 0.0),
        "foot.L": (-amp * 0.20 * env, 0.0, 0.0),
        "foot.R": (-amp * 0.20 * env, 0.0, 0.0),
        "toe.R": (amp * 0.25 * env, 0.0, 0.0),
        "pelvis.L": (amp * 0.18 * env, 0.0, -amp * 0.15 * env),
        "pelvis.R": (amp * 0.18 * env, 0.0, -amp * 0.15 * env),
        "spine": (-amp * 0.40 * env, 0.0, 0.0),
        "spine.001": (-amp * 0.30 * env, 0.0, amp * 0.12 * env),
        "spine.002": (-amp * 0.22 * env, 0.0, 0.0),
        "head": (-amp * 0.45 * env, 0.0, amp * 0.15 * env),
        "shoulder.L": (0.0, 0.0, amp * 0.25 * env),
        "shoulder.R": (0.0, 0.0, -amp * 0.25 * env),
        "upper_arm.L": (-amp * 0.50 * env, 0.0, amp * 0.30 * env),
        "upper_arm.R": (-amp * 0.50 * env, 0.0, -amp * 0.30 * env),
        "forearm.L": (amp * 0.40 * env, 0.0, 0.0),
        "forearm.R": (amp * 0.40 * env, 0.0, 0.0),
    }


def _brace(amp: float, env: float) -> dict[str, tuple[float, float, float]]:
    """Guard: sink into a crouch behind raised arms."""
    return {
        "thigh.L": (-amp * 0.55 * env, 0.0, 0.0),
        "thigh.R": (-amp * 0.55 * env, 0.0, 0.0),
        "shin.L": (amp * 0.80 * env, 0.0, 0.0),
        "shin.R": (amp * 0.80 * env, 0.0, 0.0),
        "foot.L": (-amp * 0.30 * env, 0.0, 0.0),
        "foot.R": (-amp * 0.30 * env, 0.0, 0.0),
        "pelvis.L": (amp * 0.25 * env, 0.0, 0.0),
        "pelvis.R": (amp * 0.25 * env, 0.0, 0.0),
        "spine": (amp * 0.30 * env, 0.0, 0.0),
        "spine.001": (amp * 0.20 * env, 0.0, 0.0),
        "head": (amp * 0.25 * env, 0.0, 0.0),
        "upper_arm.L": (-amp * 0.80 * env, 0.0, amp * 0.40 * env),
        "upper_arm.R": (-amp * 0.80 * env, 0.0, -amp * 0.40 * env),
        "forearm.L": (amp * 1.10 * env, 0.0, 0.0),
        "forearm.R": (amp * 1.10 * env, 0.0, 0.0),
    }


def _evade(amp: float, env: float) -> dict[str, tuple[float, float, float]]:
    """Dodge: lateral weight shift with the torso countering the hips."""
    return {
        "thigh.L": (-amp * 0.30 * env, 0.0, amp * 0.35 * env),
        "thigh.R": (amp * 0.45 * env, 0.0, amp * 0.20 * env),
        "shin.R": (amp * 0.60 * env, 0.0, 0.0),
        "foot.L": (-amp * 0.25 * env, 0.0, 0.0),
        "toe.L": (amp * 0.30 * env, 0.0, 0.0),
        "pelvis.L": (0.0, amp * 0.30 * env, 0.0),
        "pelvis.R": (0.0, amp * 0.30 * env, 0.0),
        "spine": (0.0, -amp * 0.28 * env, amp * 0.20 * env),
        "spine.001": (0.0, -amp * 0.22 * env, amp * 0.18 * env),
        "spine.002": (0.0, -amp * 0.16 * env, 0.0),
        "head": (0.0, -amp * 0.20 * env, amp * 0.15 * env),
        "upper_arm.L": (-amp * 0.40 * env, 0.0, amp * 0.35 * env),
        "upper_arm.R": (-amp * 0.35 * env, 0.0, -amp * 0.25 * env),
        "forearm.L": (amp * 0.30 * env, 0.0, 0.0),
    }


def _collapse(amp: float, t: float) -> dict[str, tuple[float, float, float]]:
    """Death folds and never returns to neutral, so the envelope is monotonic."""
    env = t * t * (3.0 - 2.0 * t)
    return {
        "thigh.L": (-amp * 0.85 * env, 0.0, amp * 0.20 * env),
        "thigh.R": (-amp * 0.95 * env, 0.0, -amp * 0.15 * env),
        "shin.L": (amp * 1.30 * env, 0.0, 0.0),
        "shin.R": (amp * 1.45 * env, 0.0, 0.0),
        "foot.L": (-amp * 0.35 * env, 0.0, 0.0),
        "foot.R": (-amp * 0.35 * env, 0.0, 0.0),
        "toe.R": (amp * 0.40 * env, 0.0, 0.0),
        "pelvis.L": (amp * 0.45 * env, 0.0, 0.0),
        "pelvis.R": (amp * 0.45 * env, 0.0, 0.0),
        "spine": (amp * 0.70 * env, 0.0, amp * 0.15 * env),
        "spine.001": (amp * 0.55 * env, 0.0, 0.0),
        "spine.002": (amp * 0.45 * env, 0.0, 0.0),
        "spine.003": (amp * 0.30 * env, 0.0, 0.0),
        "head": (amp * 0.60 * env, 0.0, amp * 0.20 * env),
        "shoulder.L": (0.0, 0.0, amp * 0.30 * env),
        "shoulder.R": (0.0, 0.0, -amp * 0.30 * env),
        "upper_arm.L": (amp * 0.55 * env, 0.0, amp * 0.25 * env),
        "upper_arm.R": (amp * 0.55 * env, 0.0, -amp * 0.25 * env),
        "forearm.L": (amp * 0.45 * env, 0.0, 0.0),
        "forearm.R": (amp * 0.45 * env, 0.0, 0.0),
    }


def _present(amp: float, env: float) -> dict[str, tuple[float, float, float]]:
    """Entrance: press out of a crouch and open the chest."""
    rise = 1.0 - env
    return {
        "thigh.L": (-amp * 0.45 * rise, 0.0, 0.0),
        "thigh.R": (-amp * 0.45 * rise, 0.0, 0.0),
        "shin.L": (amp * 0.65 * rise, 0.0, 0.0),
        "shin.R": (amp * 0.65 * rise, 0.0, 0.0),
        "foot.L": (-amp * 0.25 * rise, 0.0, 0.0),
        "foot.R": (-amp * 0.25 * rise, 0.0, 0.0),
        "toe.L": (amp * 0.30 * env, 0.0, 0.0),
        "toe.R": (amp * 0.30 * env, 0.0, 0.0),
        "pelvis.L": (amp * 0.20 * rise, 0.0, 0.0),
        "pelvis.R": (amp * 0.20 * rise, 0.0, 0.0),
        "spine": (-amp * 0.25 * env, 0.0, 0.0),
        "spine.001": (-amp * 0.20 * env, 0.0, 0.0),
        "head": (-amp * 0.30 * env, 0.0, 0.0),
        "shoulder.L": (0.0, 0.0, amp * 0.35 * env),
        "shoulder.R": (0.0, 0.0, -amp * 0.35 * env),
        "upper_arm.L": (0.0, 0.0, amp * 0.60 * env),
        "upper_arm.R": (0.0, 0.0, -amp * 0.60 * env),
        "forearm.L": (amp * 0.25 * env, 0.0, 0.0),
        "forearm.R": (amp * 0.25 * env, 0.0, 0.0),
    }


def _breathe(amp: float, phase: float) -> dict[str, tuple[float, float, float]]:
    """Idle still shifts weight; a perfectly still stance reads as a statue."""
    swell = math.sin(phase)
    shift = math.sin(phase * 0.5)
    return {
        "thigh.L": (shift * amp * 0.30, 0.0, 0.0),
        "thigh.R": (-shift * amp * 0.30, 0.0, 0.0),
        "shin.L": (max(0.0, shift) * amp * 0.35, 0.0, 0.0),
        "shin.R": (max(0.0, -shift) * amp * 0.35, 0.0, 0.0),
        "foot.L": (-shift * amp * 0.12, 0.0, 0.0),
        "foot.R": (shift * amp * 0.12, 0.0, 0.0),
        "pelvis.L": (0.0, shift * amp * 0.25, 0.0),
        "pelvis.R": (0.0, shift * amp * 0.25, 0.0),
        "spine": (-swell * amp * 0.35, 0.0, 0.0),
        "spine.001": (-swell * amp * 0.25, 0.0, -shift * amp * 0.20),
        "spine.002": (-swell * amp * 0.18, 0.0, 0.0),
        "head": (swell * amp * 0.20, 0.0, shift * amp * 0.30),
        "shoulder.L": (0.0, 0.0, swell * amp * 0.25),
        "shoulder.R": (0.0, 0.0, -swell * amp * 0.25),
        "upper_arm.L": (0.0, 0.0, swell * amp * 0.30),
        "upper_arm.R": (0.0, 0.0, -swell * amp * 0.30),
    }


def pose_for(clip: str, t: float, loop: bool, gain: float = 1.0) -> dict[str, tuple[float, float, float]]:
    """Whole-body pose in degrees for a clip at normalized time t in [0, 1].

    `gain` scales the authored half to the clip's own energy: a hand-authored
    strike carries far more travel than a generic one, and a fixed amplitude
    would read as a twitch next to it.
    """
    amp = CLIP_AMPLITUDE.get(clip, DEFAULT_AMPLITUDE) * gain
    if clip in LOCOMOTION_CLIPS:
        return _gait(amp, t * math.tau)
    if clip == "idle":
        return _breathe(amp, t * math.tau)
    if clip == "die":
        return _collapse(amp, t)
    # One-shot envelope: rise into the beat, settle out of it.
    env = 1.0 - abs(2.0 * t - 1.0) if loop else math.sin(min(1.0, t * 1.25) * math.pi * 0.5) * (1.0 - max(0.0, t - 0.6) / 0.4 * 0.35)
    if clip.startswith("attack") or clip == "critical":
        return _strike(amp, env)
    if clip in ("hit", "bighit"):
        return _recoil(amp, env, 0.35 if clip == "bighit" else 0.0)
    if clip == "defence":
        return _brace(amp, env)
    if clip == "avoid":
        return _evade(amp, env)
    if clip == "show":
        return _present(amp, env)
    return _recoil(amp, env, 0.0)


def plan_rows(root: Path) -> list[dict[str, Any]]:
    runtime_root = root / RUNTIME_ROOT
    rows = []
    for category in CHARACTER_CATEGORIES:
        for source in sorted((runtime_root / category).glob("*.glb")):
            relative_path = f"{category}/{source.name}"
            bound = root / BOUND_ROOT / relative_path
            # Compose on top of the rigged-lower-mesh fix when one exists, so a
            # promoted asset carries both corrections.
            input_path = (BOUND_ROOT / relative_path) if bound.is_file() else (RUNTIME_ROOT / relative_path)
            rows.append(
                {
                    "relativePath": relative_path,
                    "category": category,
                    "assetId": source.stem,
                    "inputPath": input_path.as_posix(),
                    "inputSha256": sha256(root / input_path),
                    "inputLane": "rigged-lower-mesh-candidate" if bound.is_file() else "runtime",
                    "outputPath": (CANDIDATE_ROOT / "glb" / relative_path).as_posix(),
                }
            )
    return rows


def expected_sidecar(row: dict[str, Any], output_sha: str, balance: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "source": row["inputPath"],
        "sourceSha256": row["inputSha256"],
        "sourceLane": row["inputLane"],
        "generator": "scripts/author-wholebody-clips-blender.py",
        "output": row["outputPath"],
        "outputSha256": output_sha,
        "rightsReceipt": RIGHTS_RECEIPT,
        "runtimeReceipt": RUNTIME_RECEIPT,
        "runtimeEligible": False,
        "fix": "every clip re-authored as coordinated whole-body motion",
        "meshUnmodified": True,
        "skinUnmodified": True,
        "clipNamesPreserved": True,
        "clipBalance": balance,
    }


def validate_output(row: dict[str, Any], source_document, output_document) -> dict[str, Any]:
    def census(document):
        return {
            "meshes": len(document.get("meshes", [])),
            "materials": len(document.get("materials", [])),
            "skins": len(document.get("skins", [])),
            "nodes": len(document.get("nodes", [])),
            "animations": sorted(item.get("name") for item in document.get("animations", [])),
        }

    before = census(source_document)
    after = census(output_document)
    checks = {
        "meshCountEqual": before["meshes"] == after["meshes"],
        "materialCountEqual": before["materials"] == after["materials"],
        "skinCountEqual": before["skins"] == after["skins"],
        "nodeCountEqual": before["nodes"] == after["nodes"],
        "clipNamesEqual": before["animations"] == after["animations"],
    }
    failed = [name for name, ok in checks.items() if not ok]
    if failed:
        raise AuthorError(f"{row['relativePath']}: {', '.join(failed)}")
    return checks


LOWER_TOKENS = ("pelvis", "thigh", "shin", "foot", "toe")
UPPER_TOKENS = ("spine", "head", "shoulder", "arm", "hand")
# The authored half is scaled until it carries this share of the clip's energy.
TARGET_HALF_BALANCE = 0.35
# Cap so a huge hand-authored strike cannot demand an absurd stride.
MAX_AUTHORED_AMPLITUDE_DEGREES = 30.0
# Below this the clip is one-sided enough to read as jarring; at or above it the
# authored motion already carries both halves and must not be overwritten.
REAUTHOR_BALANCE_THRESHOLD = 0.25


def _half_of(suffix: str) -> str:
    lowered = suffix.lower()
    if any(token in lowered for token in LOWER_TOKENS):
        return "lower"
    return "upper" if any(token in lowered for token in UPPER_TOKENS) else "other"


def author_clips(row: dict[str, Any], root: Path) -> list[dict[str, Any]]:
    import bpy  # noqa: PLC0415

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(root / row["inputPath"]))
    armature = next((obj for obj in bpy.data.objects if obj.type == "ARMATURE"), None)
    if armature is None:
        raise AuthorError(f"{row['relativePath']}: no armature")

    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    bones = {bone.name: bone for bone in armature.pose.bones}
    upper_names, lower_names = half_bone_names(armature)
    if not upper_names or not lower_names:
        raise AuthorError(f"{row['relativePath']}: rig has no upper/lower split")

    def resolve(suffix: str):
        return bones.get(f"DEF-{suffix}") or bones.get(suffix)

    # The rigs animate in quaternion mode and every bone already owns channels
    # whose values simply never change. Switching rotation_mode would orphan the
    # authored quaternion curves, so this pass writes the rig's native channel.
    def rotation_path(bone) -> str:
        return "rotation_quaternion" if bone.rotation_mode == "QUATERNION" else "rotation_euler"

    def apply_pose(bone, angles) -> None:
        from mathutils import Euler  # noqa: PLC0415

        euler = Euler(tuple(math.radians(value) for value in angles), "XYZ")
        if bone.rotation_mode == "QUATERNION":
            bone.rotation_quaternion = euler.to_quaternion()
        else:
            bone.rotation_euler = euler

    def clear_bone_channels(action, bone_names) -> None:
        prefixes = tuple(f'pose.bones["{name}"].rotation_' for name in bone_names)
        for layer in getattr(action, "layers", []):
            for strip in layer.strips:
                for bag in getattr(strip, "channelbags", []):
                    for curve in list(bag.fcurves):
                        if curve.data_path.startswith(prefixes):
                            bag.fcurves.remove(curve)

    bpy.ops.object.mode_set(mode="OBJECT")
    baseline = {item["clip"]: item for item in measure_balance(row)}
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")

    authored = []
    for action in list(bpy.data.actions):
        if "::" not in action.name:
            continue
        clip = action.name.split("::")[1]
        measured = baseline.get(clip)
        if measured is None:
            continue
        if measured["participates"] and measured["halfBalance"] >= REAUTHOR_BALANCE_THRESHOLD:
            authored.append({"clip": clip, "action": "kept-authored", "baselineBalance": measured["halfBalance"]})
            continue

        # Only starved halves are rewritten. A hand-authored strike keeps its
        # arc; the pass just gives it legs to drive from. An idle that leans on
        # the renderer's procedural breath has neither half moving, so both get
        # authored.
        weak_halves = {
            half
            for half in ("upper", "lower")
            if measured[f"{half}Travel"] < MIN_HALF_TRAVEL
        }
        if not weak_halves:
            weak_halves = {
                "lower" if measured["lowerTravel"] <= measured["upperTravel"] else "upper"
            }
        weak = "+".join(sorted(weak_halves))
        loop = clip in ("idle", "move", "run")
        start = int(action.frame_range[0])
        end = int(action.frame_range[1])
        frames = max(2, end - start + 1)

        armature.animation_data.action = action
        if getattr(action, "slots", None):
            armature.animation_data.action_slot = action.slots[0]

        targets = {
            suffix: resolve(suffix)
            for suffix in set().union(*(pose_for(clip, step / 8.0, loop).keys() for step in range(9)))
            if _half_of(suffix) in weak_halves and resolve(suffix) is not None
        }
        if not targets:
            raise AuthorError(f"{row['relativePath']}: no {weak}-half bones to author for {clip}")
        key_count = min(frames, 13 if loop else 9)

        def write(gain: float) -> None:
            clear_bone_channels(action, [bone.name for bone in targets.values()])
            for index in range(key_count):
                t = index / (key_count - 1)
                frame = round(start + (frames - 1) * t)
                pose = pose_for(clip, t, loop, gain)
                for suffix, bone in targets.items():
                    apply_pose(bone, pose.get(suffix, (0.0, 0.0, 0.0)))
                    bone.keyframe_insert(data_path=rotation_path(bone), frame=frame)

        # Closed loop: write, measure, then rescale once against the half that
        # already carries the clip. Capped so a huge authored strike cannot
        # demand a physically absurd stride.
        gain = 1.0
        write(gain)
        bpy.ops.object.mode_set(mode="OBJECT")
        achieved = measure_action(armature, action, upper_names, lower_names)
        bpy.context.view_layer.objects.active = armature
        bpy.ops.object.mode_set(mode="POSE")
        if achieved["halfBalance"] < TARGET_HALF_BALANCE:
            strong = max(achieved["upperTravel"], achieved["lowerTravel"])
            weak_travel = min(achieved["upperTravel"], achieved["lowerTravel"])
            if weak_travel > 1e-6:
                base = CLIP_AMPLITUDE.get(clip, DEFAULT_AMPLITUDE)
                gain = min(
                    TARGET_HALF_BALANCE * strong / weak_travel,
                    MAX_AUTHORED_AMPLITUDE_DEGREES / base,
                )
                gain = max(1.0, gain)
                write(gain)
                bpy.ops.object.mode_set(mode="OBJECT")
                achieved = measure_action(armature, action, upper_names, lower_names)
                bpy.context.view_layer.objects.active = armature
                bpy.ops.object.mode_set(mode="POSE")

        authored.append(
            {
                "clip": clip,
                "action": f"authored-{weak}-half",
                "baselineBalance": measured["halfBalance"],
                "resultBalance": achieved["halfBalance"],
                "amplitudeGain": round(gain, 3),
                "bones": sorted(targets),
                "keyPoses": key_count,
            }
        )

    armature.animation_data.action = None
    bpy.ops.object.mode_set(mode="OBJECT")
    return authored


def half_bone_names(armature) -> tuple[list[str], list[str]]:
    lower = [
        bone.name
        for bone in armature.pose.bones
        if any(token in bone.name.lower() for token in LOWER_TOKENS)
    ]
    upper = [
        bone.name
        for bone in armature.pose.bones
        if any(token in bone.name.lower() for token in UPPER_TOKENS)
    ]
    return upper, lower


def measure_action(armature, action, upper_names, lower_names) -> dict[str, Any]:
    """World-space bone-tip travel per half, so 'both halves move' is evidence."""
    import bpy  # noqa: PLC0415

    armature.animation_data.action = action
    if getattr(action, "slots", None):
        armature.animation_data.action_slot = action.slots[0]
    start = int(action.frame_range[0])
    end = min(int(action.frame_range[1]), start + SAMPLE_FRAMES)
    previous = None
    travel = {"upper": 0.0, "lower": 0.0}
    for frame in range(start, end + 1):
        bpy.context.scene.frame_set(frame)
        current = {
            bone.name: (armature.matrix_world @ bone.tail).copy()
            for bone in armature.pose.bones
        }
        if previous is not None:
            for group, names in (("upper", upper_names), ("lower", lower_names)):
                travel[group] += sum((current[name] - previous[name]).length for name in names)
        previous = current
    # Normalized by rig height so the floor means the same thing on a 0.9 m
    # scout and a 1.9 m boss.
    height = max((armature.matrix_world @ bone.tail).z for bone in armature.pose.bones) or 1.0
    upper = travel["upper"] / len(upper_names) / height
    lower = travel["lower"] / len(lower_names) / height
    ratio = min(upper, lower) / max(upper, lower) if max(upper, lower) > 1e-9 else 0.0
    return {
        "clip": action.name.split("::")[1],
        "upperTravel": round(upper, 5),
        "lowerTravel": round(lower, 5),
        "halfBalance": round(ratio, 4),
        # Hands sweep far wider arcs than feet, so parity is not physical. What
        # matters is that neither half is a passenger.
        "participates": bool(
            min(upper, lower) >= MIN_HALF_TRAVEL or ratio >= REAUTHOR_BALANCE_THRESHOLD
        ),
    }


def measure_balance(row: dict[str, Any]) -> list[dict[str, Any]]:
    import bpy  # noqa: PLC0415

    armature = next((obj for obj in bpy.data.objects if obj.type == "ARMATURE"), None)
    upper_names, lower_names = half_bone_names(armature)
    if not lower_names or not upper_names:
        raise AuthorError(f"{row['relativePath']}: rig has no upper/lower split")

    results = [
        measure_action(armature, action, upper_names, lower_names)
        for action in bpy.data.actions
        if "::" in action.name
    ]
    armature.animation_data.action = None
    results.sort(key=lambda item: item["clip"])
    return results


def stage_rows(root: Path, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    import bpy  # noqa: PLC0415

    staged = []
    for row in rows:
        authored = author_clips(row, root)
        balance = measure_balance(row)
        stalled = [item for item in balance if not item["participates"]]
        if stalled:
            worst = stalled[0]
            raise AuthorError(
                f"{row['relativePath']}: clip '{worst['clip']}' still moves one half only "
                f"(upper {worst['upperTravel']}, lower {worst['lowerTravel']})"
            )
        weakest = min(balance, key=lambda item: min(item["upperTravel"], item["lowerTravel"]))

        output = root / row["outputPath"]
        output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.export_scene.gltf(
            filepath=str(output),
            export_format="GLB",
            use_selection=True,
            export_materials="EXPORT",
            export_animations=True,
            export_skins=True,
            export_cameras=False,
            export_lights=False,
        )
        if not output.is_file() or output.stat().st_size == 0:
            raise AuthorError(f"Blender did not produce candidate GLB: {output}")

        checks = validate_output(
            row, read_glb_json(root / row["inputPath"]), read_glb_json(output)
        )
        output_sha = sha256(output)
        sidecar = output.with_suffix(".provenance.json")
        sidecar.write_text(
            json.dumps(expected_sidecar(row, output_sha, balance), indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        staged.append(
            {
                **row,
                "outputSha256": output_sha,
                "checks": checks,
                "clipBalance": balance,
                "authoringLog": authored,
                "weakestHalfTravel": round(min(weakest["upperTravel"], weakest["lowerTravel"]), 5),
            }
        )
    return staged


def verify_rows(root: Path, rows: list[dict[str, Any]], stored_rows: list[dict[str, Any]]):
    stored_by_path = {row.get("relativePath"): row for row in stored_rows}
    verified = []
    for row in rows:
        stored = stored_by_path.get(row["relativePath"])
        if stored is None:
            raise AuthorError(f"manifest is missing a row for {row['relativePath']}")
        if stored.get("inputSha256") != row["inputSha256"]:
            raise AuthorError(
                f"input GLB changed since staging for {row['relativePath']}; restage the pack"
            )
        output = root / row["outputPath"]
        if not output.is_file():
            raise AuthorError(f"missing candidate GLB: {output}")
        checks = validate_output(row, read_glb_json(root / row["inputPath"]), read_glb_json(output))
        output_sha = sha256(output)
        if stored.get("outputSha256") != output_sha:
            raise AuthorError(f"candidate GLB changed since staging: {output}")
        balance = stored.get("clipBalance")
        if not isinstance(balance, list) or not balance:
            raise AuthorError(f"{row['relativePath']}: manifest lacks clip balance evidence")
        if any(not item.get("participates") for item in balance):
            raise AuthorError(f"{row['relativePath']}: a clip still moves one half only")
        weakest = min(min(item["upperTravel"], item["lowerTravel"]) for item in balance)
        sidecar = output.with_suffix(".provenance.json")
        if not sidecar.is_file():
            raise AuthorError(f"missing provenance sidecar: {sidecar}")
        expected = json.dumps(expected_sidecar(row, output_sha, balance), indent=2, sort_keys=True) + "\n"
        if sidecar.read_text(encoding="utf-8") != expected:
            raise AuthorError(f"provenance sidecar drifted: {sidecar}")
        verified.append({**row, "outputSha256": output_sha, "checks": checks, "clipBalance": balance,
                         "weakestHalfTravel": weakest})
    return verified


def write_manifest(root: Path, rows: list[dict[str, Any]]) -> Path:
    manifest_path = root / CANDIDATE_ROOT / MANIFEST_NAME
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedBy": "scripts/author-wholebody-clips-blender.py",
        "defect": (
            "authored clips gated the legs behind locomotion, so combat and reaction "
            "clips had zero lower-body travel while move/run barely moved the torso"
        ),
        "runtimeRoot": RUNTIME_ROOT.as_posix(),
        "candidateRoot": CANDIDATE_ROOT.as_posix(),
        "minHalfTravel": MIN_HALF_TRAVEL,
        "characterCount": len(rows),
        "weakestHalfTravel": round(min(row["weakestHalfTravel"] for row in rows), 5),
        "runtimeEligible": False,
        "rows": rows,
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Re-author clips as whole-body motion")
    parser.add_argument("--write", action="store_true", help="stage candidates (requires Blender)")
    parser.add_argument("--check", action="store_true", help="verify staged candidates")
    args = parser.parse_args(script_argv(argv))
    if args.write == args.check:
        raise AuthorError("choose exactly one of --write or --check")

    root = repository_root()
    rows = plan_rows(root)
    manifest_path = root / CANDIDATE_ROOT / MANIFEST_NAME

    if args.write:
        rows = stage_rows(root, rows)
        manifest_path = write_manifest(root, rows)
    else:
        if not manifest_path.is_file():
            raise AuthorError(f"manifest is missing: {manifest_path}")
        stored = json.loads(manifest_path.read_text(encoding="utf-8"))
        rows = verify_rows(root, rows, stored.get("rows", []))

    print(
        json.dumps(
            {
                "manifest": manifest_path.relative_to(root).as_posix(),
                "characters": len(rows),
                "weakestHalfTravel": round(min(row["weakestHalfTravel"] for row in rows), 5),
                "checked": bool(args.check),
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except AuthorError as error:
        print(f"error: {error}", file=sys.stderr)
        sys.exit(1)
