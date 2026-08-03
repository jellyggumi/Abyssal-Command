#!/usr/bin/env python3
"""Assign selected DEF-bone rest rotations from a certified target rig.

The repair is a glTF JSON-chunk edit: only `nodes[i].rotation` of the bones named
by the approved static-pose policy is replaced with the certified target rig's
local rest rotation. The BIN chunk, every accessor, the inverse bind matrices and
all baked animation samplers are copied through verbatim, so promoted clips play
back bit-identically while the overlay pack's rest-relative deltas finally
compose against the rest pose they were authored for.

Fail-closed codes (exit 2, nothing on stdout):

    SPR_ARGS              contradictory or missing CLI arguments
    SPR_POLICY            the policy file is unreadable or malformed
    SPR_POLICY_HASH       the policy's evidence manifest does not hash as declared
    SPR_TARGET_RIG_HASH   the target rig does not hash as the policy declares
    SPR_POLICY_SET        the policy's actor/bone selection is not the approved set
    SPR_ASSET_ID          an --asset-id outside the approved selection
    SPR_ACTOR_MODEL       a selected actor model is missing or unreadable
    SPR_GLB               a GLB container is not a single-buffer glTF 2.0 binary
    SPR_RIG               a rig is missing a selected bone or has a broken hierarchy
    SPR_WRITE             a post-write readback did not reproduce what was written

A completed run prints one `STATIC_POSE_REPAIR_RESULT_JSON:<json>` line and exits
0 when every selected bone is within tolerance in both spaces, 1 when it is not.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import struct
import sys
import traceback
from pathlib import Path
from typing import Any

GLB_MAGIC = b"glTF"
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942

# The user-approved focus, restated in code. The policy file may be edited; this
# constant may not, so a widened policy fails closed instead of quietly
# repairing an actor nobody signed off on.
APPROVED_DECISION = "focused-ember-cohort-and-possessed"
APPROVED_SET: dict[str, frozenset[str]] = {
    "ember-cohort": frozenset(
        {
            "DEF-upper_arm.R",
            "DEF-forearm.R",
            "DEF-hand.R",
            "DEF-foot.L",
            "DEF-foot.R",
            "DEF-toe.L",
            "DEF-toe.R",
        }
    ),
    "possessed": frozenset(
        {
            "DEF-foot.L",
            "DEF-foot.R",
            "DEF-toe.L",
            "DEF-toe.R",
            "DEF-forearm.L",
            "DEF-upper_arm.L",
            "DEF-hand.L",
        }
    ),
}

# Code-side anchors for the evidence chain. The policy file is operator-supplied,
# so a policy that self-consistently declares a digest for a perturbed rig would
# otherwise validate against itself. These two constants are what the approved
# decision was actually made over.
APPROVED_TARGET_RIG_SHA256 = (
    "a2fd435880d12a56d70599d701c3b562c0869a0d51062e7d7db26b4a066137e6"
)
APPROVED_EVIDENCE_MANIFEST_SHA256 = (
    "dea668ccbdbdc0dba8f47913ae1254da6cca4249c8eeebc754402622b2d50564"
)

RESULT_PREFIX = "STATIC_POSE_REPAIR_RESULT_JSON"


class RepairError(RuntimeError):
    """A fail-closed condition: nothing is written and nothing is reported."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code


# ---------------------------------------------------------------------------
# quaternion helpers -- (x, y, z, w), matching glTF node.rotation
# ---------------------------------------------------------------------------


def quaternion_multiply(a: list[float], b: list[float]) -> list[float]:
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ]


def quaternion_length(q: list[float]) -> float:
    return math.sqrt(sum(component * component for component in q))


def quaternion_normalize(q: list[float], label: str) -> list[float]:
    length = quaternion_length(q)
    if not math.isfinite(length) or length <= 0.0:
        raise RepairError("SPR_RIG", f"{label}: degenerate quaternion {q}")
    return [component / length for component in q]


def angle_between_deg(a: list[float], b: list[float], label: str) -> float:
    na = quaternion_normalize(a, label)
    nb = quaternion_normalize(b, label)
    dot = min(1.0, abs(sum(x * y for x, y in zip(na, nb))))
    return math.degrees(2.0 * math.acos(dot))


# ---------------------------------------------------------------------------
# GLB container
# ---------------------------------------------------------------------------


class Glb:
    """A parsed single-buffer GLB whose BIN chunk is kept verbatim."""

    def __init__(self, path: Path | None, raw: bytes | None = None, label: str | None = None) -> None:
        self.path = path
        if raw is None:
            if path is None:
                raise RepairError("SPR_GLB", "Glb requires a path or raw bytes")
            raw = path.read_bytes()
        name = label if label is not None else str(path)
        if len(raw) < 20 or raw[0:4] != GLB_MAGIC:
            raise RepairError("SPR_GLB", f"{name}: not a GLB container")
        version, declared = struct.unpack_from("<II", raw, 4)
        if version != 2:
            raise RepairError("SPR_GLB", f"{name}: GLB version {version}")
        if declared != len(raw):
            raise RepairError("SPR_GLB", f"{name}: declared length {declared} != {len(raw)}")

        json_chunk: bytes | None = None
        bin_chunk: bytes | None = None
        offset = 12
        while offset < len(raw):
            if offset + 8 > len(raw):
                raise RepairError("SPR_GLB", f"{name}: truncated chunk header")
            byte_length, chunk_type = struct.unpack_from("<II", raw, offset)
            start = offset + 8
            end = start + byte_length
            if end > len(raw):
                raise RepairError("SPR_GLB", f"{name}: chunk payload out of bounds")
            if chunk_type == CHUNK_JSON:
                if json_chunk is not None:
                    raise RepairError("SPR_GLB", f"{name}: duplicate JSON chunk")
                json_chunk = raw[start:end]
            elif chunk_type == CHUNK_BIN:
                if bin_chunk is not None:
                    raise RepairError("SPR_GLB", f"{name}: duplicate BIN chunk")
                bin_chunk = raw[start:end]
            else:
                # The writer only re-emits JSON+BIN, so a vendor chunk would be
                # silently dropped. Refuse rather than quietly discard it.
                raise RepairError("SPR_GLB", f"{name}: unsupported chunk type {chunk_type:#x}")
            offset = end
        if json_chunk is None or bin_chunk is None:
            raise RepairError("SPR_GLB", f"{name}: expected one JSON and one BIN chunk")

        try:
            self.document: dict[str, Any] = json.loads(json_chunk.decode("utf-8").rstrip("\x00 "))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise RepairError("SPR_GLB", f"{name}: unreadable JSON chunk ({error})") from error
        if not isinstance(self.document, dict):
            raise RepairError("SPR_GLB", f"{name}: JSON chunk is not an object")

        buffers = self.document.get("buffers")
        if not isinstance(buffers, list) or len(buffers) != 1 or "uri" in buffers[0]:
            raise RepairError("SPR_GLB", f"{name}: expected exactly one embedded buffer")

        self.binary = bin_chunk

    def write(self, verify_against: bytes | None = None) -> None:
        """Re-serialize the JSON chunk; copy the BIN chunk byte-for-byte.

        The candidate is built and proven in a sibling temp file, then committed
        with `os.replace`, so a crash mid-write cannot leave a torn asset.
        """
        try:
            payload = json.dumps(
                self.document, separators=(",", ":"), ensure_ascii=False, allow_nan=False
            ).encode("utf-8")
        except ValueError as error:  # non-finite numbers
            raise RepairError("SPR_WRITE", f"{self.path}: unserializable glTF ({error})") from error
        padded = payload + b" " * (-len(payload) % 4)
        if len(self.binary) % 4 != 0:
            raise RepairError("SPR_WRITE", f"{self.path}: BIN chunk is not 4-byte padded")
        total = 12 + 8 + len(padded) + 8 + len(self.binary)
        out = bytearray()
        out += GLB_MAGIC
        out += struct.pack("<II", 2, total)
        out += struct.pack("<II", len(padded), CHUNK_JSON)
        out += padded
        out += struct.pack("<II", len(self.binary), CHUNK_BIN)
        out += self.binary
        candidate = bytes(out)

        # Prove the container the tool is about to commit, in the tool, rather
        # than leaving byte-exactness to an external suite.
        proof = Glb.__new__(Glb)
        Glb.__init__(proof, None, raw=candidate, label=str(self.path))
        expected = self.binary if verify_against is None else verify_against
        if proof.binary != expected:
            raise RepairError("SPR_WRITE", f"{self.path}: BIN chunk would not survive the rewrite")
        declared = proof.document.get("buffers", [{}])[0].get("byteLength")
        if not isinstance(declared, int) or not 0 <= len(proof.binary) - declared < 4:
            raise RepairError(
                "SPR_WRITE", f"{self.path}: buffer byteLength {declared} disagrees with the BIN chunk"
            )

        temporary = self.path.with_name(f".{self.path.name}.repair-tmp")
        try:
            temporary.write_bytes(candidate)
            os.replace(temporary, self.path)
        finally:
            temporary.unlink(missing_ok=True)


class Rig:
    """Node-name indexed local/world rest rotations over a parsed glTF document."""

    def __init__(self, document: dict[str, Any], label: str) -> None:
        nodes = document.get("nodes")
        if not isinstance(nodes, list) or not nodes:
            raise RepairError("SPR_RIG", f"{label}: document carries no nodes")
        self.label = label
        self.nodes = nodes
        self.parent_of: dict[int, int] = {}
        for index, node in enumerate(nodes):
            for child in node.get("children", []) or []:
                if child in self.parent_of:
                    raise RepairError("SPR_RIG", f"{label}: node {child} has two parents")
                self.parent_of[child] = index
        self.index_of: dict[str, int] = {}
        for index, node in enumerate(nodes):
            name = node.get("name")
            if not isinstance(name, str):
                continue
            if name in self.index_of:
                # A second same-named node would be neither repaired nor
                # drift-checked, so resolution by name must stay unambiguous.
                raise RepairError("SPR_RIG", f"{label}: duplicate node name {name!r}")
            self.index_of[name] = index

    def require(self, bone: str) -> int:
        index = self.index_of.get(bone)
        if index is None:
            raise RepairError("SPR_RIG", f"{self.label}: missing bone {bone}")
        return index

    def local(self, index: int) -> list[float]:
        rotation = self.nodes[index].get("rotation")
        if rotation is None:
            return [0.0, 0.0, 0.0, 1.0]
        if not isinstance(rotation, list) or len(rotation) != 4:
            raise RepairError("SPR_RIG", f"{self.label}: node {index} rotation arity")
        values = [float(component) for component in rotation]
        if not all(math.isfinite(component) for component in values):
            raise RepairError("SPR_RIG", f"{self.label}: node {index} non-finite rotation")
        return values

    def world(self, index: int) -> list[float]:
        rotation = self.local(index)
        current = index
        seen = {current}
        while current in self.parent_of:
            current = self.parent_of[current]
            if current in seen:
                raise RepairError("SPR_RIG", f"{self.label}: cycle in the node hierarchy")
            seen.add(current)
            rotation = quaternion_multiply(self.local(current), rotation)
        return rotation

    def residuals(self, target: "Rig", bone: str) -> tuple[float, float]:
        mine = self.require(bone)
        theirs = target.require(bone)
        world = angle_between_deg(self.world(mine), target.world(theirs), f"{self.label}/{bone}")
        local = angle_between_deg(self.local(mine), target.local(theirs), f"{self.label}/{bone}")
        return world, local


# ---------------------------------------------------------------------------
# policy
# ---------------------------------------------------------------------------


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def load_policy(policy_path: Path) -> dict[str, Any]:
    if not policy_path.is_file():
        raise RepairError("SPR_POLICY", f"policy not found: {policy_path}")
    try:
        policy = json.loads(policy_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RepairError("SPR_POLICY", f"{policy_path}: unreadable ({error})") from error
    if not isinstance(policy, dict) or policy.get("kind") != "static-pose-policy":
        raise RepairError("SPR_POLICY", f"{policy_path}: not a static-pose-policy document")
    return policy


def policy_tolerances(policy: dict[str, Any]) -> tuple[float, float]:
    requirements = policy.get("requirements")
    if not isinstance(requirements, dict):
        raise RepairError("SPR_POLICY", "policy carries no requirements block")
    try:
        world = float(requirements["requirePostWorldResidualDegAtMost"])
        local = float(requirements["requirePostLocalResidualDegAtMost"])
    except (KeyError, TypeError, ValueError) as error:
        raise RepairError(
            "SPR_POLICY",
            "policy must declare requirePostWorldResidualDegAtMost and "
            f"requirePostLocalResidualDegAtMost ({error})",
        ) from error
    if not (math.isfinite(world) and math.isfinite(local)) or world <= 0 or local <= 0:
        raise RepairError("SPR_POLICY", "residual tolerances must be positive and finite")
    return world, local


def approved_selection(policy: dict[str, Any]) -> dict[str, list[str]]:
    """Return the policy selection, refusing anything but the approved set."""
    if policy.get("decision") != APPROVED_DECISION:
        raise RepairError(
            "SPR_POLICY_SET",
            f"policy decision {policy.get('decision')!r} is not {APPROVED_DECISION!r}",
        )
    actors = policy.get("actors")
    if not isinstance(actors, dict):
        raise RepairError("SPR_POLICY_SET", "policy carries no actors object")
    if set(actors) != set(APPROVED_SET):
        raise RepairError(
            "SPR_POLICY_SET",
            f"policy actors {sorted(actors)} are not the approved {sorted(APPROVED_SET)}",
        )
    selection: dict[str, list[str]] = {}
    for asset_id in sorted(actors):
        entry = actors[asset_id]
        if not isinstance(entry, dict) or not isinstance(entry.get("bones"), list):
            raise RepairError("SPR_POLICY_SET", f"{asset_id}: policy carries no bones list")
        bones = [str(bone) for bone in entry["bones"]]
        if len(set(bones)) != len(bones):
            raise RepairError("SPR_POLICY_SET", f"{asset_id}: duplicate bone in the selection")
        if set(bones) != set(APPROVED_SET[asset_id]):
            raise RepairError(
                "SPR_POLICY_SET",
                f"{asset_id}: policy bones {sorted(bones)} are not the approved "
                f"{sorted(APPROVED_SET[asset_id])}",
            )
        selection[asset_id] = bones
    return selection


def verify_evidence(policy: dict[str, Any], policy_path: Path, target_rig: Path) -> None:
    evidence = policy.get("evidence")
    if not isinstance(evidence, dict):
        raise RepairError("SPR_POLICY", "policy carries no evidence block")

    declared_target = evidence.get("targetRigSha256")
    if not isinstance(declared_target, str):
        raise RepairError("SPR_POLICY", "policy carries no evidence.targetRigSha256")
    if not target_rig.is_file():
        raise RepairError("SPR_TARGET_RIG_HASH", f"target rig not found: {target_rig}")
    observed_target = sha256_of(target_rig)
    # Both sides of the pair must agree with the code anchor, so a policy that
    # re-declares a digest for a perturbed rig cannot validate against itself.
    for label, digest in (
        ("policy declares", declared_target),
        ("the approved decision was made over", APPROVED_TARGET_RIG_SHA256),
    ):
        if observed_target != digest:
            raise RepairError(
                "SPR_TARGET_RIG_HASH",
                f"{target_rig} hashes {observed_target}, {label} {digest}",
            )

    declared_manifest = evidence.get("manifestSha256")
    manifest_reference = evidence.get("manifest")
    if not isinstance(declared_manifest, str) or not isinstance(manifest_reference, str):
        raise RepairError("SPR_POLICY_HASH", "policy carries no evidence manifest reference")
    manifest_path = (policy_path.parent / manifest_reference).resolve()
    if not manifest_path.is_file():
        raise RepairError("SPR_POLICY_HASH", f"evidence manifest not found: {manifest_path}")
    observed_manifest = sha256_of(manifest_path)
    for label, digest in (
        ("policy declares", declared_manifest),
        ("the approved decision was made over", APPROVED_EVIDENCE_MANIFEST_SHA256),
    ):
        if observed_manifest != digest:
            raise RepairError(
                "SPR_POLICY_HASH",
                f"{manifest_path} hashes {observed_manifest}, {label} {digest}",
            )


# ---------------------------------------------------------------------------
# repair
# ---------------------------------------------------------------------------


def measure(actor: Rig, target: Rig, bones: list[str]) -> dict[str, tuple[float, float]]:
    return {bone: actor.residuals(target, bone) for bone in bones}


def preflight_actor(asset_id: str, model_path: Path, target: Rig, bones: list[str]) -> dict[str, Any]:
    """Open, parse and resolve one actor without writing. Raises before any commit."""
    if not model_path.is_file():
        raise RepairError("SPR_ACTOR_MODEL", f"{asset_id}: model not found: {model_path}")
    glb = Glb(model_path)
    actor = Rig(glb.document, f"{asset_id} ({model_path.name})")
    for bone in bones:
        index = actor.require(bone)
        if "matrix" in actor.nodes[index]:
            raise RepairError(
                "SPR_RIG", f"{asset_id}: {bone} uses a matrix transform, not TRS rotation"
            )
        target.require(bone)
    return {
        "assetId": asset_id,
        "modelPath": model_path,
        "glb": glb,
        "actor": actor,
        "bones": bones,
        "sha256Before": sha256_of(model_path),
        "before": measure(actor, target, bones),
        "unlistedBefore": {
            index: node.get("rotation")
            for index, node in enumerate(actor.nodes)
            if node.get("name") not in set(bones)
        },
    }


def repair_actor(
    loaded: dict[str, Any],
    target: Rig,
    tolerance_world: float,
    tolerance_local: float,
    write: bool,
) -> dict[str, Any]:
    asset_id = loaded["assetId"]
    model_path: Path = loaded["modelPath"]
    bones: list[str] = loaded["bones"]
    glb: Glb = loaded["glb"]
    actor: Rig = loaded["actor"]
    sha_before: str = loaded["sha256Before"]
    before: dict[str, tuple[float, float]] = loaded["before"]
    unlisted_before: dict[int, Any] = loaded["unlistedBefore"]
    unlisted_drift: list[dict[str, Any]] = []

    if write:
        for bone in bones:
            actor.nodes[actor.require(bone)]["rotation"] = list(target.local(target.require(bone)))
        # Verify the candidate bytes before they replace the shipped asset: a
        # torn or drifted write never reaches the actor directory.
        glb.write(verify_against=loaded["glb"].binary)
        glb = Glb(model_path)
        actor = Rig(glb.document, f"{asset_id} ({model_path.name}, written)")
        for index, rotation in unlisted_before.items():
            if actor.nodes[index].get("rotation") != rotation:
                unlisted_drift.append(
                    {
                        "assetId": asset_id,
                        "node": index,
                        "name": actor.nodes[index].get("name"),
                    }
                )
        if unlisted_drift:
            raise RepairError(
                "SPR_WRITE", f"{asset_id}: {len(unlisted_drift)} nodes drifted outside the selection"
            )

    after = measure(actor, target, bones)
    sha_after = sha256_of(model_path) if write else sha_before

    bone_rows: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    for bone in bones:
        pre_world, pre_local = before[bone]
        post_world, post_local = after[bone]
        within = post_world <= tolerance_world and post_local <= tolerance_local
        row = {
            "bone": bone,
            "preWorldResidualDeg": pre_world,
            "preLocalResidualDeg": pre_local,
            "postWorldResidualDeg": post_world,
            "postLocalResidualDeg": post_local,
            "withinTolerance": within,
            # True when this slot's own local rest rotation was out of gate, so
            # the correction had to be made here. False means the slot was
            # already locally on target and its world error came from an
            # ancestor -- the assignment still happens, it just changes nothing
            # a reviewer could see.
            "effective": pre_local > tolerance_local,
        }
        bone_rows.append(row)
        if not within:
            failures.append(
                {
                    "assetId": asset_id,
                    "bone": bone,
                    "postWorldResidualDeg": post_world,
                    "postLocalResidualDeg": post_local,
                }
            )

    return {
        "report": {
            "assetId": asset_id,
            "model": str(model_path),
            "written": write,
            "sha256Before": sha_before,
            "sha256After": sha_after,
            "bones": bone_rows,
        },
        "failures": failures,
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, add_help=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="measure only; never write")
    mode.add_argument("--write", action="store_true", help="assign the approved rest rotations")
    parser.add_argument("--policy", type=Path, required=True)
    parser.add_argument("--target-rig", type=Path, required=True)
    parser.add_argument("--actors-root", type=Path, required=True)
    parser.add_argument(
        "--asset-id",
        action="append",
        default=None,
        help="restrict the run to these approved actors (repeatable)",
    )
    parser.add_argument("--report", type=Path, default=None)
    return parser.parse_args(argv)


def run(argv: list[str]) -> int:
    args = parse_args(argv)
    policy_path = args.policy.resolve()
    target_rig_path = args.target_rig.resolve()
    actors_root = args.actors_root.resolve()

    policy = load_policy(policy_path)
    tolerance_world, tolerance_local = policy_tolerances(policy)
    verify_evidence(policy, policy_path, target_rig_path)
    selection = approved_selection(policy)

    requested = list(dict.fromkeys(args.asset_id)) if args.asset_id else sorted(selection)
    unknown = [asset_id for asset_id in requested if asset_id not in selection]
    if unknown:
        raise RepairError("SPR_ASSET_ID", f"--asset-id outside the approved selection: {unknown}")

    target = Rig(Glb(target_rig_path).document, f"target rig ({target_rig_path.name})")

    # Phase 1: open, parse and resolve every requested actor. A failure here
    # leaves the whole selection untouched, so a bad actor N never lands after
    # actor N-1 was already committed.
    loaded = [
        preflight_actor(asset_id, actors_root / asset_id / "model.glb", target, selection[asset_id])
        for asset_id in requested
    ]

    # Phase 2: measure, and commit when asked.
    actors: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    for entry in loaded:
        outcome = repair_actor(
            entry, target, tolerance_world, tolerance_local, write=bool(args.write)
        )
        actors.append(outcome["report"])
        failures.extend(outcome["failures"])

    result = {
        "schemaVersion": 1,
        "kind": "static-pose-repair",
        "mode": "write" if args.write else "check",
        "policy": str(policy_path),
        "policyDecision": policy.get("decision"),
        "targetRigSha256": sha256_of(target_rig_path),
        "toleranceWorldDeg": tolerance_world,
        "toleranceLocalDeg": tolerance_local,
        "actors": actors,
        "failures": failures,
        # Populated from the post-commit readback. A non-empty list aborts the
        # run before it can be reported, so a completed run always shows [].
        "unlistedDrift": [],
        "pass": not failures,
    }
    # The result reaches stdout before the optional report, so a failing report
    # path can never cost the operator the record of what was written.
    print(RESULT_PREFIX + ":" + json.dumps(result))
    if args.report is not None:
        try:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        except OSError as error:
            raise RepairError("SPR_REPORT", f"{args.report}: unwritable report ({error})") from error
    return 0 if result["pass"] else 1


def main() -> int:
    try:
        return run(sys.argv[1:])
    except RepairError as error:
        print(str(error), file=sys.stderr)
        return 2
    except Exception:  # noqa: BLE001 - a crash must not read as a failing gate
        traceback.print_exc()
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
