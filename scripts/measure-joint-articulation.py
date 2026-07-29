#!/usr/bin/env python3
"""Measure joint articulation on the CURRENT runtime character GLBs.

Answers one question with numbers: does the skinned mesh behave like a jointed
body (rigid segments that bend only at joints) or like rubber (segments that
stretch and shear because weight is spread across unrelated bones)?

Unlike scripts/measure-deformation-gate.py, this reads
`assets/motion/ingame/characters/registry.json` and measures the GLBs the
runtime actually loads. It never mutates an asset.

Metrics per asset:

  segmentRigidity      For each bone, take the vertices it dominates (max
                       weight) and measure how much their pairwise distances
                       change across the clip. A jointed limb keeps its own
                       length: ratio -> 1.0. Rubber stretches: ratio drifts.
  weightConcentration  Fraction of total skin weight owned by each bone, and
                       the ratio of the single heaviest bone to the whole spine
                       chain. `guard.glb` historically gave DEF-hand.R more
                       weight than its entire spine -- that reads as rubber.
  jointSpanStretch     Edge-length ratio for edges that cross a joint boundary
                       (vertices dominated by parent vs child bone). These
                       SHOULD flex; the rest should not.
  strayInfluence       Vertices whose dominant bone is anatomically far from
                       their rest position (e.g. torso vertices owned by a
                       hand bone), i.e. nearest-bone fallback damage.

Run headless:
  blender -b -P scripts/measure-joint-articulation.py -- \
    --out _workspace/current/engineering/asset-pipeline/motion-bench/joint-articulation-report.json
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
from pathlib import Path
from typing import Any

import bpy
import mathutils


def repository_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "package.json").is_file():
            return parent
    raise SystemExit("repository root (package.json) not found")


ROOT = repository_root()
REGISTRY = ROOT / "assets/motion/ingame/characters/registry.json"

SPINE_BONES = (
    "DEF-spine",
    "DEF-spine.001",
    "DEF-spine.002",
    "DEF-spine.003",
    "DEF-spine.004",
    "DEF-spine.005",
)

# Parent -> child pairs whose shared edges legitimately flex.
JOINT_CHAINS = (
    ("DEF-thigh.L", "DEF-shin.L"),
    ("DEF-shin.L", "DEF-foot.L"),
    ("DEF-foot.L", "DEF-toe.L"),
    ("DEF-thigh.R", "DEF-shin.R"),
    ("DEF-shin.R", "DEF-foot.R"),
    ("DEF-foot.R", "DEF-toe.R"),
    ("DEF-shoulder.L", "DEF-upper_arm.L"),
    ("DEF-upper_arm.L", "DEF-forearm.L"),
    ("DEF-forearm.L", "DEF-hand.L"),
    ("DEF-shoulder.R", "DEF-upper_arm.R"),
    ("DEF-upper_arm.R", "DEF-forearm.R"),
    ("DEF-forearm.R", "DEF-hand.R"),
)

# Sampling: enough frames to catch a stretch spike without measuring 275 frames
# of an 11-second idle.
MAX_SAMPLES = 12
# Pairwise distance sampling per bone, deterministic stride.
MAX_PAIRS_PER_BONE = 400
# A pair of vertices closer than this fraction of the mesh bbox diagonal carries
# no length information: dividing by it turns sub-millimetre bind noise into a
# 60x "stretch". Measured on guard_body: 67 of 42486 forearm pairs sit under
# 1e-4 on a 2.276-unit diagonal, and those pairs alone produced the 30x devMax.
MIN_REST_LENGTH_FRACTION = 0.005
# Weight below this does not visibly move a vertex; counting it as an influence
# would flag every soft falloff as rubber.
INFLUENCE_EPSILON = 0.10
# Bone-hierarchy distance between the two furthest-apart bones that meaningfully
# weight one vertex. 1 = the vertex belongs to a joint (parent+child only), which
# is what makes a limb read as jointed. 3+ = one vertex is driven by the entire
# limb chain, so the segment smears instead of bending.
MAX_ACCEPTABLE_CHAIN_SPREAD = 2


def script_argv(argv: list[str] | None = None) -> list[str]:
    values = list(sys.argv[1:] if argv is None else argv)
    if "--" in values:
        return values[values.index("--") + 1 :]
    return []


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

def import_glb(path: Path) -> None:
    # Blender 5.1's glTF importer dropped the 4.x `import_materials` /
    # `import_cameras` / `import_lights` toggles. `guess_original_bind_pose`
    # must stay False: this library ships a frozen natural rest pose, and
    # guessing a bind pose would silently re-pose the rig we are measuring.
    bpy.ops.import_scene.gltf(
        filepath=str(path),
        guess_original_bind_pose=False,
        bone_heuristic="BLENDER",
    )


def armature_and_meshes():
    arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    return arm, meshes


def dominant_bone_map(mesh) -> dict[int, str]:
    """vertex index -> bone name owning the largest weight."""
    group_names = {g.index: g.name for g in mesh.vertex_groups}
    out: dict[int, str] = {}
    for vert in mesh.data.vertices:
        best_name = None
        best_weight = 0.0
        for elem in vert.groups:
            name = group_names.get(elem.group)
            if name is None:
                continue
            if elem.weight > best_weight:
                best_weight = elem.weight
                best_name = name
        if best_name is not None:
            out[vert.index] = best_name
    return out


def weight_totals(mesh) -> dict[str, float]:
    group_names = {g.index: g.name for g in mesh.vertex_groups}
    totals: dict[str, float] = {}
    for vert in mesh.data.vertices:
        for elem in vert.groups:
            name = group_names.get(elem.group)
            if name is None:
                continue
            totals[name] = totals.get(name, 0.0) + float(elem.weight)
    return totals


def bone_depth_map(armature) -> dict[str, list[str]]:
    """bone name -> ancestor chain (root first), for hierarchy distance."""
    chains: dict[str, list[str]] = {}
    for bone in armature.data.bones:
        chain = []
        cursor = bone
        while cursor is not None:
            chain.append(cursor.name)
            cursor = cursor.parent
        chains[bone.name] = list(reversed(chain))
    return chains


def hierarchy_distance(chains: dict[str, list[str]], a: str, b: str) -> int:
    """Edges between two bones in the armature tree. Adjacent joint == 1."""
    if a == b:
        return 0
    ca, cb = chains.get(a), chains.get(b)
    if ca is None or cb is None:
        return 99
    shared = 0
    for x, y in zip(ca, cb):
        if x != y:
            break
        shared += 1
    return (len(ca) - shared) + (len(cb) - shared)


def chain_spread(mesh, armature) -> dict[str, Any]:
    """How far apart, in the bone tree, are the bones that actually drive a vertex.

    A vertex on a forearm should be driven by the forearm and at most its
    immediate neighbour (spread <= 1-2). A vertex driven by shoulder + upper_arm
    + forearm + hand simultaneously (spread 3) cannot bend at a joint -- every
    joint rotation drags it, so the limb reads as one rubber tube.
    """
    group_names = {g.index: g.name for g in mesh.vertex_groups}
    chains = bone_depth_map(armature)
    spreads: list[int] = []
    influence_counts: list[int] = []
    offenders: dict[str, int] = {}
    worst = {"vertex": None, "spread": 0, "bones": []}
    for vert in mesh.data.vertices:
        active = [
            (group_names[e.group], float(e.weight))
            for e in vert.groups
            if group_names.get(e.group) and e.weight >= INFLUENCE_EPSILON
        ]
        if not active:
            continue
        influence_counts.append(len(active))
        names = [n for n, _ in active]
        spread = 0
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                spread = max(spread, hierarchy_distance(chains, names[i], names[j]))
        spreads.append(spread)
        if spread > MAX_ACCEPTABLE_CHAIN_SPREAD:
            dominant_name = max(active, key=lambda kv: kv[1])[0]
            offenders[dominant_name] = offenders.get(dominant_name, 0) + 1
            if spread > worst["spread"]:
                worst = {
                    "vertex": vert.index,
                    "spread": spread,
                    "bones": [(n, round(w, 4)) for n, w in sorted(active, key=lambda kv: -kv[1])],
                }
    total = len(spreads) or 1
    over = sum(1 for s in spreads if s > MAX_ACCEPTABLE_CHAIN_SPREAD)
    return {
        "influenceEpsilon": INFLUENCE_EPSILON,
        "maxAcceptableSpread": MAX_ACCEPTABLE_CHAIN_SPREAD,
        "verticesMeasured": len(spreads),
        "meanInfluences": round(sum(influence_counts) / (len(influence_counts) or 1), 3),
        "maxInfluences": max(influence_counts) if influence_counts else 0,
        "meanSpread": round(sum(spreads) / total, 3),
        "maxSpread": max(spreads) if spreads else 0,
        "overSpreadVertices": over,
        "overSpreadFraction": round(over / total, 5),
        "overSpreadByDominantBone": dict(sorted(offenders.items(), key=lambda kv: -kv[1])),
        "worstVertex": worst,
    }


def evaluated_coords(mesh) -> list[mathutils.Vector]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = mesh.evaluated_get(depsgraph)
    data = evaluated.to_mesh()
    coords = [mesh.matrix_world @ v.co.copy() for v in data.vertices]
    evaluated.to_mesh_clear()
    return coords


def sample_frames(action) -> list[int]:
    start, end = (int(round(v)) for v in action.frame_range)
    if end <= start:
        return [start]
    span = end - start
    count = min(MAX_SAMPLES, span + 1)
    step = span / (count - 1) if count > 1 else 0
    return sorted({int(round(start + i * step)) for i in range(count)})


def pair_indices(indices: list[int]) -> list[tuple[int, int]]:
    """Deterministic subset of vertex pairs for a bone's territory."""
    n = len(indices)
    if n < 2:
        return []
    pairs: list[tuple[int, int]] = []
    stride = max(1, (n * (n - 1) // 2) // MAX_PAIRS_PER_BONE)
    counter = 0
    for i in range(n - 1):
        for j in range(i + 1, n):
            if counter % stride == 0:
                pairs.append((indices[i], indices[j]))
                if len(pairs) >= MAX_PAIRS_PER_BONE:
                    return pairs
            counter += 1
    return pairs


def crossing_edges(mesh, dominant: dict[int, str]) -> dict[tuple[str, str], list[tuple[int, int]]]:
    out: dict[tuple[str, str], list[tuple[int, int]]] = {}
    wanted = {frozenset(pair): pair for pair in JOINT_CHAINS}
    for edge in mesh.data.edges:
        a, b = edge.vertices
        ba, bb = dominant.get(a), dominant.get(b)
        if ba is None or bb is None or ba == bb:
            continue
        key = wanted.get(frozenset((ba, bb)))
        if key is None:
            continue
        out.setdefault(key, []).append((a, b))
    return out


def measure_asset(asset: dict[str, Any]) -> dict[str, Any]:
    model_path = ROOT / asset["model"]
    reset_scene()
    import_glb(model_path)
    arm, meshes = armature_and_meshes()
    if arm is None or not meshes:
        return {
            "assetId": asset["assetId"],
            "model": asset["model"],
            "error": "armature or mesh missing",
        }

    mesh = max(meshes, key=lambda m: len(m.data.vertices))
    dominant = dominant_bone_map(mesh)
    totals = weight_totals(mesh)
    total_weight = sum(totals.values()) or 1.0
    spread = chain_spread(mesh, arm)

    local = [v.co for v in mesh.data.vertices]
    bbox_diagonal = (
        mathutils.Vector((max(v.x for v in local), max(v.y for v in local), max(v.z for v in local)))
        - mathutils.Vector((min(v.x for v in local), min(v.y for v in local), min(v.z for v in local)))
    ).length
    min_rest_length = bbox_diagonal * MIN_REST_LENGTH_FRACTION

    spine_weight = sum(totals.get(name, 0.0) for name in SPINE_BONES)
    heaviest_name, heaviest_weight = max(totals.items(), key=lambda kv: kv[1]) if totals else ("", 0.0)

    territory: dict[str, list[int]] = {}
    for index, bone in dominant.items():
        territory.setdefault(bone, []).append(index)
    for bone in territory:
        territory[bone].sort()

    bone_pairs = {bone: pair_indices(idx) for bone, idx in territory.items() if len(idx) >= 2}
    joint_edges = crossing_edges(mesh, dominant)

    # Rest reference.
    bpy.context.scene.frame_set(int(round(bpy.context.scene.frame_start)))
    for action_holder in (arm,):
        if action_holder.animation_data:
            action_holder.animation_data.action = None
    bpy.context.view_layer.update()
    rest_coords = evaluated_coords(mesh)

    rest_pair_len = {
        bone: [(rest_coords[a] - rest_coords[b]).length for a, b in pairs]
        for bone, pairs in bone_pairs.items()
    }
    rest_joint_len = {
        key: [(rest_coords[a] - rest_coords[b]).length for a, b in edges]
        for key, edges in joint_edges.items()
    }

    if arm.animation_data is None:
        arm.animation_data_create()

    clip_rows: list[dict[str, Any]] = []
    for action in sorted(bpy.data.actions, key=lambda a: a.name):
        arm.animation_data.action = action
        frames = sample_frames(action)
        worst_segment = {"bone": None, "ratio": 1.0, "frame": None}
        segment_ratios: list[float] = []
        joint_flex: dict[str, float] = {}
        for frame in frames:
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            coords = evaluated_coords(mesh)
            for bone, pairs in bone_pairs.items():
                rest_lengths = rest_pair_len[bone]
                ratios = []
                for (a, b), rest_len in zip(pairs, rest_lengths):
                    if rest_len < min_rest_length:
                        continue
                    ratios.append((coords[a] - coords[b]).length / rest_len)
                if not ratios:
                    continue
                # A rigid segment keeps every internal distance. Track the
                # single worst deviation, which is what reads as rubber.
                deviation = max(abs(x - 1.0) for x in ratios)
                segment_ratios.append(deviation)
                if deviation > abs(worst_segment["ratio"] - 1.0):
                    worst_segment = {"bone": bone, "ratio": 1.0 + deviation, "frame": frame}
            for key, edges in joint_edges.items():
                rest_lengths = rest_joint_len[key]
                ratios = []
                for (a, b), rest_len in zip(edges, rest_lengths):
                    if rest_len < min_rest_length:
                        continue
                    ratios.append((coords[a] - coords[b]).length / rest_len)
                if ratios:
                    label = f"{key[0]}->{key[1]}"
                    joint_flex[label] = max(joint_flex.get(label, 0.0), max(abs(x - 1.0) for x in ratios))

        clip_rows.append(
            {
                "clip": action.name,
                "framesSampled": len(frames),
                "segmentDeviationMax": round(max(segment_ratios), 5) if segment_ratios else 0.0,
                "segmentDeviationP95": round(
                    statistics.quantiles(segment_ratios, n=20)[18], 5
                )
                if len(segment_ratios) >= 20
                else (round(max(segment_ratios), 5) if segment_ratios else 0.0),
                "worstSegment": worst_segment,
                "jointFlexMax": {k: round(v, 5) for k, v in sorted(joint_flex.items())},
            }
        )

    bone_share = {
        name: round(value / total_weight, 5)
        for name, value in sorted(totals.items(), key=lambda kv: -kv[1])
    }

    return {
        "assetId": asset["assetId"],
        "role": asset.get("role"),
        "category": asset.get("category"),
        "model": asset["model"],
        "mesh": mesh.name,
        "vertexCount": len(mesh.data.vertices),
        "boneCount": len(arm.data.bones),
        "weightConcentration": {
            "heaviestBone": heaviest_name,
            "heaviestShare": round(heaviest_weight / total_weight, 5),
            "spineShare": round(spine_weight / total_weight, 5),
            "heaviestOverSpine": round(heaviest_weight / spine_weight, 5) if spine_weight > 0 else None,
            "boneShare": bone_share,
        },
        "chainSpread": spread,
        "restLengthFloor": {
            "bboxDiagonal": round(bbox_diagonal, 5),
            "fraction": MIN_REST_LENGTH_FRACTION,
            "absolute": round(min_rest_length, 6),
            "pairsBelowFloor": sum(
                1 for lengths in rest_pair_len.values() for value in lengths if value < min_rest_length
            ),
            "pairsTotal": sum(len(lengths) for lengths in rest_pair_len.values()),
        },
        "territorySizes": {bone: len(idx) for bone, idx in sorted(territory.items())},
        "unownedVertices": len(mesh.data.vertices) - len(dominant),
        "jointEdgeCoverage": {f"{k[0]}->{k[1]}": len(v) for k, v in sorted(joint_edges.items())},
        "clips": clip_rows,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Measure joint articulation of runtime character GLBs")
    parser.add_argument("--out", default=None, help="report path (default: motion-bench lane)")
    parser.add_argument("--asset-id", action="append", default=None, help="limit to asset id(s)")
    args = parser.parse_args(script_argv(argv))

    registry = json.loads(REGISTRY.read_text())
    assets = registry["assets"]
    if args.asset_id:
        wanted = set(args.asset_id)
        assets = [a for a in assets if a["assetId"] in wanted]

    rows = [measure_asset(asset) for asset in assets]

    out_path = (
        Path(args.out)
        if args.out
        else ROOT / "_workspace/current/engineering/asset-pipeline/motion-bench/joint-articulation-report.json"
    )
    if not out_path.is_absolute():
        out_path = ROOT / out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)

    report = {
        "schemaVersion": 1,
        "generatedBy": "scripts/measure-joint-articulation.py",
        "registry": str(REGISTRY.relative_to(ROOT)),
        "registryGenerationId": registry.get("generationId"),
        "sampling": {"maxFramesPerClip": MAX_SAMPLES, "maxPairsPerBone": MAX_PAIRS_PER_BONE},
        "assets": rows,
    }
    out_path.write_text(json.dumps(report, indent=1) + "\n")
    try:
        shown = out_path.relative_to(ROOT)
    except ValueError:
        shown = out_path
    print(f"wrote {shown} ({len(rows)} assets)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
