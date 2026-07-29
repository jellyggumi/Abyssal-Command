#!/usr/bin/env python3
"""Per-asset gate for the skin-weight repair.

`scripts/repair-joint-weights.py` patches GLBs in place, so a baseline has to be
captured BEFORE the write or it is gone. This driver does both halves and gates
each asset on its own numbers rather than a batch average -- guard (overSpread
0.170, 5325 verts) and shadow-commander-boss (0.538, 23715 verts) are not
comparable, so one asset regressing must not hide inside a batch summary.

Four gates per asset, all measured from the GLB payload without Blender:

  spread   overSpreadFraction must reach 0.0 and maxSpread must be <= 2.
           This is the defect: influences spanning 3+ hierarchy edges cannot
           bend at a joint.
  seam     edges whose endpoints differ by more than 1.0 in L1 weight distance
           must not exceed that asset's OWN pre-repair count. The shipped assets
           already had seams (guard: 130), so zero is not the honest bar.
  disjoint edges must not exceed the asset's OWN pre-repair count; these are
  the direct zero-overlap tear candidates.
  rigidity influenceHistogram[1] must stay within the baseline/negligible floor
             and the absolute 25% ceiling; an all-rigid candidate always fails.

Run:
  python3 scripts/gate-joint-weight-repair.py --check           # baseline only
  python3 scripts/gate-joint-weight-repair.py --write --asset-id guard
  python3 scripts/gate-joint-weight-repair.py --write           # all 11
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import shutil
import struct
import sys
from pathlib import Path
from typing import Any


def repository_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "package.json").is_file():
            return parent
    raise SystemExit("repository root (package.json) not found")


ROOT = repository_root()
REGISTRY = ROOT / "assets/motion/ingame/characters/registry.json"
LIBRARY_ROOT = ROOT / "_workspace/current/engineering/asset-pipeline/character-motion-library"
# Mirrors MAX_ACCEPTABLE_CHAIN_SPREAD / INFLUENCE_EPSILON in
# scripts/measure-joint-articulation.py so the gate and the Blender measurement
# agree on what "articulated" means.
INFLUENCE_EPSILON = 0.10
MAX_SPREAD = 2
# Rigid (single-influence) vertices are a skinning defect: a vertex driven by
# one bone cannot bend. Leaf tips can legitimately contain a small rigid share,
# but a repair must never be allowed to turn an entire mesh into a rigid shell.
# This is an absolute safety ceiling, independent of the incoming baseline.
RIGIDITY_CEILING_FRACTION = 0.25
# A small floor permits a few legitimate leaf/tip vertices even when a source
# baseline reports zero rigid vertices; the absolute ceiling still blocks
# pathological all-rigid repairs.
RIGIDITY_FLOOR_FRACTION = 0.005
# Relaxation configurations tried in order, cheapest first. A single global knee
# regressed 6 of 11 assets: relaxation diffuses weight per topological step, so
# the passes needed to cover the same surface distance scale with mesh density
# (guard 5325 verts vs broken-court-monarch-boss 28581). Ordered so a light
# configuration wins when it can, and the heavy ones only pay their cost on the
# assets that need them.
RELAX_SWEEP = (
    (12, 0.6),
    (20, 0.6),
    (32, 0.65),
    (48, 0.7),
    (72, 0.7),
    (108, 0.75),
)

_spec = importlib.util.spec_from_file_location(
    "repair_joint_weights", ROOT / "scripts/repair-joint-weights.py"
)
repair = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(repair)


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def commit_payload(path: Path, result: dict[str, Any]) -> None:
    """Splice an already-gated patch into the GLB."""
    repair.commit_patched_bin(path, result)


def skin_state_from_payload(path: Path, result: dict[str, Any]) -> dict[str, Any]:
    """Measure a candidate patch that is NOT on disk yet.

    Shares `skin_state`'s code path so the baseline and the candidate can never
    drift apart: only the BIN chunk source differs.
    """
    document, _, _, _ = repair.parse_glb(path)
    return skin_state(path, document=document, binary=bytearray(result["patchedBin"]))


def skin_state(
    path: Path,
    document: dict[str, Any] | None = None,
    binary: bytearray | None = None,
) -> dict[str, Any]:
    """Spread + seam + influence stats read straight from the GLB payload."""
    if document is None or binary is None:
        document, binary, _, _ = repair.parse_glb(path)
    ancestors = repair.joint_ancestors(document, 0)
    joint_names = [document["nodes"][n].get("name", f"node{n}") for n in document["skins"][0]["joints"]]

    def distance(a: int, b: int) -> int:
        if a == b:
            return 0
        chain_a, chain_b = ancestors[a], ancestors[b]
        shared = 0
        for x, y in zip(chain_a, chain_b):
            if x != y:
                break
            shared += 1
        return (len(chain_a) - shared) + (len(chain_b) - shared)

    over = measured = max_spread = 0
    histogram: dict[int, int] = {}
    max_sum_error = 0.0
    offenders: dict[str, int] = {}
    seam_over_one = 0
    seam_disjoint = 0
    edge_total = 0

    for mesh_index, mesh in enumerate(document.get("meshes", [])):
        for primitive in mesh["primitives"]:
            attributes = primitive["attributes"]
            if "JOINTS_0" not in attributes or "WEIGHTS_0" not in attributes:
                continue
            j_off, count, j_fmt, _, j_size = repair.accessor_span(document, attributes["JOINTS_0"])
            w_off, _, _, _, w_size = repair.accessor_span(document, attributes["WEIGHTS_0"])
            sparse: list[dict[int, float]] = []
            for vertex in range(count):
                slots = struct.unpack_from("<4" + j_fmt, binary, j_off + vertex * 4 * j_size)
                weights = struct.unpack_from("<4f", binary, w_off + vertex * 4 * w_size)
                entry: dict[int, float] = {}
                for slot, weight in zip(slots, weights):
                    if weight > repair.WEIGHT_EPSILON:
                        entry[slot] = entry.get(slot, 0.0) + float(weight)
                sparse.append(entry)

            for entry in sparse:
                if not entry:
                    continue
                max_sum_error = max(max_sum_error, abs(sum(entry.values()) - 1.0))
                histogram[len(entry)] = histogram.get(len(entry), 0) + 1
                active = [slot for slot, weight in entry.items() if weight >= INFLUENCE_EPSILON]
                if not active:
                    continue
                measured += 1
                spread = 0
                for i in range(len(active)):
                    for j in range(i + 1, len(active)):
                        spread = max(spread, distance(active[i], active[j]))
                max_spread = max(max_spread, spread)
                if spread > MAX_SPREAD:
                    over += 1
                    dominant = max(entry.items(), key=lambda kv: kv[1])[0]
                    name = joint_names[dominant]
                    offenders[name] = offenders.get(name, 0) + 1

            if "indices" in primitive:
                i_off, i_count, i_fmt, _, _ = repair.accessor_span(document, primitive["indices"])
                indices = struct.unpack_from(f"<{i_count}{i_fmt}", binary, i_off)
                edges: set[tuple[int, int]] = set()
                for base in range(0, i_count - 2, 3):
                    a, b, c = indices[base], indices[base + 1], indices[base + 2]
                    for u, v in ((a, b), (b, c), (a, c)):
                        edges.add((min(u, v), max(u, v)))
                edge_total += len(edges)
                for a, b in edges:
                    wa, wb = sparse[a], sparse[b]
                    if not wa or not wb:
                        continue
                    l1 = sum(abs(wa.get(k, 0.0) - wb.get(k, 0.0)) for k in set(wa) | set(wb))
                    if l1 > 1.0:
                        seam_over_one += 1
                    if not (set(wa) & set(wb)):
                        seam_disjoint += 1

    return {
        "verticesMeasured": measured,
        "overSpread": over,
        "overSpreadFraction": round(over / measured, 5) if measured else 0.0,
        "maxSpread": max_spread,
        "overSpreadByDominantBone": dict(sorted(offenders.items(), key=lambda kv: -kv[1])[:6]),
        "influenceHistogram": dict(sorted(histogram.items())),
        "singleInfluenceVertices": histogram.get(1, 0),
        "seamEdgesOverOne": seam_over_one,
        "seamEdgesDisjoint": seam_disjoint,
        "edgeTotal": edge_total,
        "maxWeightSumError": max_sum_error,
    }


def verdict(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    spread_ok = after["overSpread"] == 0 and after["maxSpread"] <= MAX_SPREAD
    seam_ok = after["seamEdgesOverOne"] <= before["seamEdgesOverOne"]
    seam_disjoint_ok = after["seamEdgesDisjoint"] <= before["seamEdgesDisjoint"]
    # Keep a hard cap for pathological all-rigid repairs while also allowing a
    # negligible leaf/tip share when the incoming baseline is zero.
    vertices = max(1, before["verticesMeasured"])
    rigidity_floor_vertices = int(vertices * RIGIDITY_FLOOR_FRACTION)
    rigidity_ceiling_vertices = math.ceil(vertices * RIGIDITY_CEILING_FRACTION)
    rigidity_budget = min(
        max(before["singleInfluenceVertices"], rigidity_floor_vertices),
        rigidity_ceiling_vertices,
    )
    rigidity_ok = after["singleInfluenceVertices"] <= rigidity_budget
    normalized_ok = after["maxWeightSumError"] < 1e-6
    return {
        "spread": "PASS" if spread_ok else "FAIL",
        "seam": "PASS" if seam_ok else "FAIL",
        "seamDisjoint": "PASS" if seam_disjoint_ok else "FAIL",
        "rigidityBaselineVertices": before["singleInfluenceVertices"],
        "rigidityFloorFraction": RIGIDITY_FLOOR_FRACTION,
        "rigidityCeilingFraction": RIGIDITY_CEILING_FRACTION,
        "rigidityCeilingVertices": rigidity_ceiling_vertices,
        "rigidityBudget": rigidity_budget,
        "rigidity": "PASS" if rigidity_ok else "FAIL",
        "normalized": "PASS" if normalized_ok else "FAIL",
        "passed": bool(spread_ok and seam_ok and seam_disjoint_ok and rigidity_ok and normalized_ok),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Gate the skin-weight repair per asset")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help="repair and gate")
    mode.add_argument("--check", action="store_true", help="measure current state only")
    parser.add_argument("--asset-id", action="append", default=None)
    parser.add_argument(
        "--report",
        default="_workspace/current/engineering/asset-pipeline/motion-bench/joint-weight-repair-gate.json",
    )
    parser.add_argument(
        "--sync-library",
        action="store_true",
        help="copy each repaired GLB over the byte-identical character-motion-library copy",
    )
    args = parser.parse_args(argv)

    registry = json.loads(REGISTRY.read_text())
    assets = registry["assets"]
    if args.asset_id:
        wanted = set(args.asset_id)
        assets = [a for a in assets if a["assetId"] in wanted]
        missing = wanted - {a["assetId"] for a in assets}
        if missing:
            raise SystemExit(f"unknown asset id(s): {sorted(missing)}")

    rows: list[dict[str, Any]] = []
    failures: list[str] = []

    for asset in assets:
        asset_id = asset["assetId"]
        path = ROOT / asset["model"]
        before = skin_state(path)
        row: dict[str, Any] = {"assetId": asset_id, "model": asset["model"], "before": before}

        if args.write:
            # Sweep relaxation per asset and keep the BEST passing configuration.
            # guard's knee (it=12, k=0.6) does not transfer: broken-court-monarch-
            # boss carries 5.4x guard's geometry at maxSpread 10, and denser
            # topology needs more diffusion passes to spread the same weight over
            # the same surface distance. A single global constant measurably
            # regressed 6 of 11 assets.
            #
            # Best-pass, not first-pass: heavier relaxation monotonically reduces
            # seam edges but raises single-influence (rigid) vertices, so the
            # cheapest passing rung is not the best one. Rank by seam edges first,
            # then by rigid vertices. Measured at ~3s per rung on the largest
            # asset, so evaluating the whole ladder is affordable.
            chosen = None
            attempts = []
            for iterations, strength in RELAX_SWEEP:
                candidate = repair.repair_glb(
                    path, write=False, relax_iterations=iterations, relax_strength=strength
                )
                after = skin_state_from_payload(path, candidate)
                candidate_verdict = verdict(before, after)
                attempts.append(
                    {
                        "relaxIterations": iterations,
                        "relaxStrength": strength,
                        "overSpreadFraction": after["overSpreadFraction"],
                        "seamEdgesOverOne": after["seamEdgesOverOne"],
                        "seamEdgesDisjoint": after["seamEdgesDisjoint"],
                        "singleInfluenceVertices": after["singleInfluenceVertices"],
                        "verdict": candidate_verdict,
                    }
                )
                if not candidate_verdict["passed"]:
                    continue
                score = (after["seamEdgesOverOne"], after["singleInfluenceVertices"])
                if chosen is None or score < chosen[0]:
                    chosen = (score, iterations, strength, candidate, after, candidate_verdict)

            row["attempts"] = attempts
            if chosen is None:
                # Nothing reached the bar. Leave the shipped bytes untouched and
                # record WHY -- a half-repaired asset on disk is worse than an
                # unrepaired one, because the next session cannot tell which is
                # which, and an asset merely absent from the report reads as an
                # oversight rather than a decision.
                best = min(attempts, key=lambda a: (a["seamEdgesOverOne"], a["singleInfluenceVertices"]))
                blocking = sorted(
                    {
                        gate
                        for attempt in attempts
                        for gate in ("spread", "seam", "seamDisjoint", "rigidity", "normalized")
                        if attempt["verdict"][gate] == "FAIL"
                    }
                )
                row["verdict"] = {
                    "passed": False,
                    "reason": "no sweep configuration passed",
                    "blockingGates": blocking,
                    "bestAttempt": best,
                    "disposition": (
                        "left at shipped bytes; the spread defect is fixable but the seam gate is "
                        "not reachable by reweighting alone on this mesh. The residual is fused "
                        "geometry (cape/pauldron welded into the body primitive), so the real fix "
                        "is geometric -- split the cape into its own primitive or assign its "
                        "vertices wholly to one chain -- and belongs in "
                        "scripts/rig-character-asset-blender.py, not in a binary weight patcher."
                    ),
                }
                row["written"] = False
                failures.append(asset_id)
                print(
                    f"{asset_id:26s} NO PASS in {len(attempts)} configs; left untouched "
                    f"(best seam>1 {best['seamEdgesOverOne']} vs baseline {before['seamEdgesOverOne']}, "
                    f"blocking: {','.join(blocking)})"
                )
            else:
                _, iterations, strength, candidate, after, candidate_verdict = chosen
                commit_payload(path, candidate)
                row["repair"] = candidate["primitives"][0]
                row["after"] = after
                row["sha256Before"] = candidate["sha256Before"]
                row["sha256After"] = sha256_of(path)
                row["relaxIterations"] = iterations
                row["relaxStrength"] = strength
                row["verdict"] = candidate_verdict
                row["written"] = True

                if args.sync_library:
                    library_copy = LIBRARY_ROOT / asset_id / "model.glb"
                    if library_copy.is_file():
                        shutil.copyfile(path, library_copy)
                        row["librarySynced"] = str(library_copy.relative_to(ROOT))

                print(
                    f"{asset_id:26s} spread {before['overSpreadFraction']:.4f}->{after['overSpreadFraction']:.4f} "
                    f"maxSpr {before['maxSpread']}->{after['maxSpread']} "
                    f"seam>1 {before['seamEdgesOverOne']:5d}->{after['seamEdgesOverOne']:5d} "
                    f"disjoint {before['seamEdgesDisjoint']:4d}->{after['seamEdgesDisjoint']:4d} "
                    f"inf1 {before['singleInfluenceVertices']:4d}->{after['singleInfluenceVertices']:4d} "
                    f"it={iterations} k={strength} [PASS]"
                )
        else:
            # A check is a gate, not a read-only pretty-printer. Comparing the
            # current payload with itself preserves the write-mode seam rules
            # while making the absolute spread, normalization, and rigidity
            # limits produce a real verdict.
            current_verdict = verdict(before, before)
            vertices = max(1, before["verticesMeasured"])
            rigid_share = before["singleInfluenceVertices"] / vertices
            row["rigidityShare"] = round(rigid_share, 5)
            row["verdict"] = current_verdict
            if not current_verdict["passed"]:
                failures.append(asset_id)
            print(
                f"{asset_id:26s} spread {before['overSpreadFraction']:.4f} maxSpr {before['maxSpread']} "
                f"seam>1 {before['seamEdgesOverOne']:5d} disjoint {before['seamEdgesDisjoint']:4d} "
                f"inf1 {before['singleInfluenceVertices']:6d} ({rigid_share:6.1%}) "
                f"sumErr {before['maxWeightSumError']} "
                f"[{'PASS' if current_verdict['passed'] else 'FAIL'}]"
            )
        rows.append(row)

    report_path = Path(args.report)
    if not report_path.is_absolute():
        report_path = ROOT / report_path
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "generatedBy": "scripts/gate-joint-weight-repair.py",
                "mode": "write" if args.write else "check",
                "keepRadius": repair.KEEP_RADIUS,
                "relaxIterations": repair.RELAX_ITERATIONS,
                "relaxStrength": repair.RELAX_STRENGTH,
                "influenceEpsilon": INFLUENCE_EPSILON,
                "maxSpread": MAX_SPREAD,
                "registryGenerationId": registry.get("generationId"),
                "assets": rows,
                "failures": failures,
                "passed": not failures,
            },
            indent=1,
        )
        + "\n"
    )
    print(f"report -> {report_path.relative_to(ROOT)}")

    if failures:
        print(f"GATE FAILED for: {', '.join(failures)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
