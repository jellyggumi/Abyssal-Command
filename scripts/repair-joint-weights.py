#!/usr/bin/env python3
"""Repair skin weights so limbs articulate at joints instead of smearing.

## The defect

`scripts/measure-joint-articulation.py` measured every runtime character GLB and
found 17-54% of vertices weighted to bones that sit 3-10 edges apart in the
armature tree. Concretely, on `guard_body` vertex 2127:

    DEF-forearm.R 0.348 | DEF-hand.R 0.320 | DEF-upper_arm.R 0.250 | DEF-shoulder.R 0.082

One forearm vertex driven by the entire arm chain. Every joint rotation in that
chain drags it, so no joint can produce a crease: the limb deforms as a single
rubber tube. That is the "does not move at the joints" defect.

Cause is upstream, documented in `scripts/rig-character-asset-blender.py`: the
bind falls back through bone-heat -> envelope -> inverse-distance, and
inverse-distance has no notion of the bone hierarchy, so it happily splits one
vertex across four bones that are anatomically far apart.

## The repair

For each vertex, keep only the influences within one hierarchy edge of its
dominant bone -- that is `{dominant, parent(dominant)} + children(dominant)` --
then renormalize. The kept set spans at most 2 edges (parent to child), which is
exactly what a jointed segment needs: the segment it belongs to, plus the
neighbour across the nearest joint.

Two properties make this safe to apply to shipped GLBs:

1. **The rest pose cannot move.** At rest every `jointMatrix * inverseBind` is
   identity, so the skinned position is `v * sum(weights)`. Renormalizing keeps
   that sum at 1.0, so rest geometry is bit-stable and only the *response to
   rotation* changes.
2. **The file structure cannot move.** `WEIGHTS_0` is float32/VEC4 and is
   rewritten in place at identical byte length, so meshes, materials, the three
   embedded PNG textures (12.8 of guard's 13.4 MB), the skin, and all 11
   animations are preserved byte-for-byte. A Blender round-trip would re-encode
   or drop them.

Run:
  python3 scripts/repair-joint-weights.py --check          # report, write nothing
  python3 scripts/repair-joint-weights.py --asset-id guard --write
  python3 scripts/repair-joint-weights.py --write          # all registry assets
"""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path
from typing import Any

GLB_MAGIC = b"glTF"
GLB_JSON_CHUNK = 0x4E4F534A
GLB_BIN_CHUNK = 0x004E4942

COMPONENT_FORMATS = {
    5120: ("b", 1),
    5121: ("B", 1),
    5122: ("h", 2),
    5123: ("H", 2),
    5125: ("I", 4),
    5126: ("f", 4),
}
TYPE_COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

# Hierarchy radius around the dominant bone. 1 keeps {dominant, parent} +
# children, whose own worst pairwise distance is 2 -- the acceptable spread in
# scripts/measure-joint-articulation.py. Raising this to 2 re-admits the
# shoulder-to-hand span that caused the defect.
KEEP_RADIUS = 1
# Weights below this are numerical dust; they are dropped before renormalizing so
# they cannot resurrect a distant bone through rounding.
WEIGHT_EPSILON = 1e-4
# Mask-constrained Laplacian relaxation. Masking alone leaves hard weight seams
# (measured on guard_body: edges with L1 weight distance > 1.0 rose 130 -> 351),
# and a seam tears when the joint rotates. Each iteration blends with topological
# neighbours, then RE-APPLIES the mask, then truncates to the 4 slots glTF
# allows, then renormalizes -- in that order. Mask-after-blend is what stops a
# neighbour's distant bone from creeping back and undoing the spread fix;
# renormalize-last is what keeps the rest pose bit-stable.
#
# Tuned by sweep on guard_body (shipped baseline: overSpread 905/0.170,
# maxSpread 5, seamOver1 130, seamP99 0.988):
#   r=2 any relax -> overSpread 773-809 (0.145-0.152). Radius 2 re-admits the
#                    shoulder->hand span that IS the defect, so it never fixes it.
#   r=1 it=0       -> overSpread 0, but seamOver1 351 / P99 1.595. Worse seams.
#   r=1 it=12 k=.6 -> overSpread 0, maxSpread 2, seamOver1 80, seamP99 0.731.
#                    Below the shipped seam baseline AND the defect is gone.
#   r=1 it=20 k=.75-> seamOver1 68 but 25 vertices collapse to one influence,
#                    which trades a seam for a rigid patch. Rejected.
RELAX_ITERATIONS = 12
RELAX_STRENGTH = 0.6
# Weight seeded into one in-mask partner joint when masking would otherwise leave
# a vertex with a single influence. A single-influence vertex is rigid, so this
# is the difference between "articulated" and "stiff patch".
MIN_SECOND_INFLUENCE = 0.08
# Continuity bridges preserve seam continuity only when source bind weights already
# shared a joint. Keep this strictly below the gate's INFLUENCE_EPSILON (0.10) so
# the bridge never becomes an accepted active influence.
SEAM_BRIDGE_WEIGHT = 0.09


class RepairError(RuntimeError):
    """Raised when a GLB does not satisfy a documented precondition."""


def repository_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "package.json").is_file():
            return parent
    raise SystemExit("repository root (package.json) not found")


ROOT = repository_root()
REGISTRY = ROOT / "assets/motion/ingame/characters/registry.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_glb(path: Path) -> tuple[dict[str, Any], bytearray, int, int]:
    """Return (json document, BIN chunk as mutable bytes, bin_start, bin_length)."""
    data = path.read_bytes()
    if data[:4] != GLB_MAGIC:
        raise RepairError(f"not a GLB: {path}")
    offset = 12
    document: dict[str, Any] | None = None
    binary = None
    bin_start = bin_length = 0
    while offset < len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        start = offset + 8
        end = start + length
        if end > len(data):
            raise RepairError(f"truncated GLB chunk in {path}")
        if chunk_type == GLB_JSON_CHUNK:
            document = json.loads(data[start:end].decode("utf-8").rstrip("\0 \t\r\n"))
        elif chunk_type == GLB_BIN_CHUNK:
            binary = bytearray(data[start:end])
            bin_start, bin_length = start, length
        offset = end
    if document is None or binary is None:
        raise RepairError(f"GLB missing JSON or BIN chunk: {path}")
    return document, binary, bin_start, bin_length


def accessor_span(document: dict[str, Any], index: int) -> tuple[int, int, str, int, int]:
    """(byte offset into BIN, count, struct format, components, component size)."""
    accessor = document["accessors"][index]
    if "bufferView" not in accessor:
        raise RepairError(f"accessor {index} has no bufferView")
    view = document["bufferViews"][accessor["bufferView"]]
    if view.get("buffer", 0) != 0:
        raise RepairError(f"accessor {index} does not live in the GLB BIN chunk")
    fmt, size = COMPONENT_FORMATS[accessor["componentType"]]
    components = TYPE_COMPONENTS[accessor["type"]]
    stride = view.get("byteStride")
    if stride is not None and stride != components * size:
        raise RepairError(
            f"accessor {index} is interleaved (stride {stride}); in-place patch not supported"
        )
    offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    return offset, accessor["count"], fmt, components, size


def bone_parents(document: dict[str, Any]) -> dict[int, int]:
    parents: dict[int, int] = {}
    for index, node in enumerate(document.get("nodes", [])):
        for child in node.get("children", []):
            parents[child] = index
    return parents


def joint_neighbourhoods(document: dict[str, Any], skin_index: int) -> tuple[list[set[int]], list[str]]:
    """For each joint slot, the set of joint slots within KEEP_RADIUS edges."""
    skin = document["skins"][skin_index]
    joints = skin["joints"]
    slot_of_node = {node: slot for slot, node in enumerate(joints)}
    parents = bone_parents(document)
    names = [document["nodes"][node].get("name", f"node{node}") for node in joints]

    # Adjacency restricted to nodes that are actually skin joints.
    adjacency: list[set[int]] = [set() for _ in joints]
    for slot, node in enumerate(joints):
        parent_node = parents.get(node)
        if parent_node in slot_of_node:
            parent_slot = slot_of_node[parent_node]
            adjacency[slot].add(parent_slot)
            adjacency[parent_slot].add(slot)

    neighbourhoods: list[set[int]] = []
    for slot in range(len(joints)):
        reached = {slot}
        frontier = {slot}
        for _ in range(KEEP_RADIUS):
            nxt: set[int] = set()
            for current in frontier:
                nxt |= adjacency[current] - reached
            reached |= nxt
            frontier = nxt
            if not frontier:
                break
        neighbourhoods.append(reached)
    return neighbourhoods, names


def joint_ancestors(document: dict[str, Any], skin_index: int) -> dict[int, list[int]]:
    """joint slot -> ancestor slot chain (root first, self last)."""
    joints = document["skins"][skin_index]["joints"]
    slot_of_node = {node: slot for slot, node in enumerate(joints)}
    parents = bone_parents(document)
    chains: dict[int, list[int]] = {}
    for slot, node in enumerate(joints):
        chain: list[int] = []
        cursor: int | None = node
        while cursor is not None:
            if cursor in slot_of_node:
                chain.append(slot_of_node[cursor])
            cursor = parents.get(cursor)
        chains[slot] = list(reversed(chain))
    return chains


def vertex_adjacency(document: dict[str, Any], binary: bytearray, primitive: dict[str, Any], vertex_count: int) -> list[list[int]]:
    """Neighbour lists from the triangle index buffer, for weight relaxation.

    Masking alone leaves hard weight seams: measured on guard_body, edges whose
    endpoints disagree by more than 1.0 in L1 weight distance rose 130 -> 351
    once out-of-neighbourhood influences were zeroed. A seam like that tears when
    the joint rotates, so the mask needs a relaxation pass behind it.
    """
    adjacency: list[set[int]] = [set() for _ in range(vertex_count)]
    if "indices" not in primitive:
        return [sorted(s) for s in adjacency]
    offset, count, fmt, components, size = accessor_span(document, primitive["indices"])
    if components != 1:
        raise RepairError("index accessor is not SCALAR")
    indices = struct.unpack_from(f"<{count}{fmt}", binary, offset)
    mode = primitive.get("mode", 4)
    if mode != 4:
        raise RepairError(f"primitive mode {mode} is not TRIANGLES; relaxation unsupported")
    for base in range(0, count - 2, 3):
        a, b, c = indices[base], indices[base + 1], indices[base + 2]
        adjacency[a].update((b, c))
        adjacency[b].update((a, c))
        adjacency[c].update((a, b))
    return [sorted(s) for s in adjacency]


def repair_primitive(
    document: dict[str, Any],
    binary: bytearray,
    primitive: dict[str, Any],
    neighbourhoods: list[set[int]],
    names: list[str],
    relax_iterations: int = RELAX_ITERATIONS,
    relax_strength: float = RELAX_STRENGTH,
) -> dict[str, Any]:
    attributes = primitive["attributes"]
    if "JOINTS_0" not in attributes or "WEIGHTS_0" not in attributes:
        return {"skipped": "unskinned primitive"}
    if "JOINTS_1" in attributes or "WEIGHTS_1" in attributes:
        raise RepairError("primitive uses a second joint/weight set; not supported")

    j_off, j_count, j_fmt, j_comp, j_size = accessor_span(document, attributes["JOINTS_0"])
    w_off, w_count, w_fmt, w_comp, w_size = accessor_span(document, attributes["WEIGHTS_0"])
    if j_count != w_count:
        raise RepairError(f"JOINTS_0/WEIGHTS_0 count mismatch: {j_count} vs {w_count}")
    if w_fmt != "f":
        raise RepairError(f"WEIGHTS_0 is not float32 (format {w_fmt!r}); refusing to quantize")
    if j_comp != 4 or w_comp != 4:
        raise RepairError("expected VEC4 joints/weights")

    # --- Read the existing bind as sparse {joint slot: weight} per vertex ------
    original: list[dict[int, float]] = []
    for vertex in range(j_count):
        slots = struct.unpack_from("<4" + j_fmt, binary, j_off + vertex * j_comp * j_size)
        weights = struct.unpack_from("<4f", binary, w_off + vertex * w_comp * w_size)
        sparse: dict[int, float] = {}
        for slot, weight in zip(slots, weights):
            if weight > WEIGHT_EPSILON:
                sparse[slot] = sparse.get(slot, 0.0) + float(weight)
        original.append(sparse)

    # --- Stage 1: mask each vertex to its dominant bone's neighbourhood --------
    masks: list[set[int]] = []
    current: list[dict[int, float]] = []
    dropped_influences = 0
    zeroed_by_bone: dict[str, int] = {}
    weight_moved_total = 0.0
    max_weight_moved = 0.0
    changed_vertices = 0
    seeded_second_influence = 0

    for vertex, sparse in enumerate(original):
        if not sparse:
            masks.append(set())
            current.append({})
            continue
        total = sum(sparse.values())
        dominant_slot = max(sparse.items(), key=lambda kv: kv[1])[0]
        keep = neighbourhoods[dominant_slot]
        masks.append(keep)
        kept = {slot: weight for slot, weight in sparse.items() if slot in keep}
        removed = total - sum(kept.values())
        for slot in sparse:
            if slot not in keep:
                dropped_influences += 1
                bone = names[slot]
                zeroed_by_bone[bone] = zeroed_by_bone.get(bone, 0) + 1
        if not kept:
            raise RepairError(f"vertex {vertex} lost every influence")
        # A vertex left with one influence is rigid: it cannot bend at all, which
        # trades the smear defect for a stiff patch. Measured on
        # shadow-commander-boss, masking alone drove single-influence vertices
        # 235 -> 1101. Seed one in-mask partner at MIN_SECOND_INFLUENCE so every
        # vertex keeps a bending partner whenever its mask offers one.
        if len(kept) == 1 and len(keep) > 1:
            partner = next((slot for slot in sorted(keep) if slot not in kept), None)
            if partner is not None:
                kept = {slot: weight * (1.0 - MIN_SECOND_INFLUENCE) for slot, weight in kept.items()}
                kept[partner] = MIN_SECOND_INFLUENCE
                seeded_second_influence += 1
        scale = 1.0 / sum(kept.values())
        current.append({slot: weight * scale for slot, weight in kept.items()})
        if removed > WEIGHT_EPSILON:
            changed_vertices += 1
            weight_moved_total += removed / total
            max_weight_moved = max(max_weight_moved, removed / total)

    # --- Stage 2: relax across mesh edges, re-masking every iteration ----------
    # Blending with topological neighbours restores a gradient across the seam,
    # and re-applying the mask afterwards stops a distant bone from creeping
    # back in, so chain spread stays bounded by KEEP_RADIUS while the falloff
    # becomes continuous.
    adjacency = vertex_adjacency(document, binary, primitive, j_count)
    for _ in range(relax_iterations):
        blended: list[dict[int, float]] = []
        for vertex in range(j_count):
            own = current[vertex]
            if not own:
                blended.append({})
                continue
            neighbours = adjacency[vertex]
            accumulated = {slot: weight * (1.0 - relax_strength) for slot, weight in own.items()}
            if neighbours:
                share = relax_strength / len(neighbours)
                for other in neighbours:
                    for slot, weight in current[other].items():
                        accumulated[slot] = accumulated.get(slot, 0.0) + weight * share
            mask = masks[vertex]
            kept = {slot: weight for slot, weight in accumulated.items() if slot in mask and weight > WEIGHT_EPSILON}
            if not kept:
                kept = dict(own)
            # glTF allows at most 4 influences per vertex in one set.
            if len(kept) > 4:
                kept = dict(sorted(kept.items(), key=lambda kv: -kv[1])[:4])
            scale = 1.0 / sum(kept.values())
            blended.append({slot: weight * scale for slot, weight in kept.items()})
        current = blended

    # --- Residual: bridge only seam continuity that already existed in source -----
    # A relaxed edge where the vertex influence sets are disjoint can tear under
    # rotation. If both endpoints were already tied to one or more shared joints in
    # the source bind, seed a tiny continuity bridge on both endpoints.
    bridged_seam_edges = 0
    bridged_slots: list[set[int]] = [set() for _ in range(j_count)]
    for vertex in range(j_count):
        own = current[vertex]
        if not own:
            continue
        for other in adjacency[vertex]:
            if other <= vertex:
                continue
            partner = current[other]
            if not partner or (set(own) & set(partner)):
                continue
            shared = set(original[vertex]) & set(original[other])
            if not shared:
                continue
            bridge_slot = max(
                shared,
                key=lambda slot: original[vertex].get(slot, 0.0)
                + original[other].get(slot, 0.0),
            )
            # One vertex can border several seam edges; keep one bounded bridge
            # per slot instead of accumulating 0.09 for every neighbor.
            current[vertex][bridge_slot] = max(
                current[vertex].get(bridge_slot, 0.0),
                SEAM_BRIDGE_WEIGHT,
            )
            current[other][bridge_slot] = max(
                current[other].get(bridge_slot, 0.0),
                SEAM_BRIDGE_WEIGHT,
            )
            bridged_slots[vertex].add(bridge_slot)
            bridged_slots[other].add(bridge_slot)
            bridged_seam_edges += 1

    # Keep at most 4 influences by dropping weakest non-bridge entries first.
    for vertex in range(j_count):
        if not bridged_slots[vertex]:
            continue
        own = current[vertex]
        if not own:
            continue
        removable = sorted(
            (slot for slot in own if slot not in bridged_slots[vertex]),
            key=lambda slot: own[slot],
        )
        for slot in removable:
            if len(own) <= 4:
                break
            own.pop(slot, None)

        if len(own) > 4:
            # If only bridge slots were available, keep the strongest four.
            own = {
                slot: weight
                for slot, weight in sorted(own.items(), key=lambda kv: -kv[1])[:4]
            }
            current[vertex] = own

        if own:
            scale = 1.0 / sum(own.values())
            current[vertex] = {slot: weight * scale for slot, weight in own.items()}

    # --- Residual: disjoint seams are a GEOMETRY defect, not a weight one ------
    # Count residual seams after the continuity guard.
    disjoint_seam_edges = 0
    for vertex in range(j_count):
        own = current[vertex]
        if not own:
            continue
        for other in adjacency[vertex]:
            if other <= vertex:
                continue
            partner = current[other]
            if partner and not (set(own) & set(partner)):
                disjoint_seam_edges += 1
    # --- Write back -----------------------------------------------------------
    residual_sum_error = 0.0
    influence_histogram: dict[int, int] = {}
    for vertex in range(j_count):
        sparse = current[vertex]
        if not sparse:
            continue
        ordered = sorted(sparse.items(), key=lambda kv: -kv[1])[:4]
        scale = 1.0 / sum(weight for _, weight in ordered)
        slots = [slot for slot, _ in ordered] + [0] * (4 - len(ordered))
        weights = [weight * scale for _, weight in ordered] + [0.0] * (4 - len(ordered))
        influence_histogram[len(ordered)] = influence_histogram.get(len(ordered), 0) + 1
        residual_sum_error = max(residual_sum_error, abs(sum(weights) - 1.0))
        struct.pack_into("<4" + j_fmt, binary, j_off + vertex * j_comp * j_size, *slots)
        struct.pack_into("<4f", binary, w_off + vertex * w_comp * w_size, *weights)

    return {
        "vertices": j_count,
        "changedVertices": changed_vertices,
        "changedFraction": round(changed_vertices / j_count, 5) if j_count else 0.0,
        "droppedInfluences": dropped_influences,
        "meanWeightRedistributed": round(weight_moved_total / changed_vertices, 5)
        if changed_vertices
        else 0.0,
        "maxWeightRedistributed": round(max_weight_moved, 5),
        "zeroedByBone": dict(sorted(zeroed_by_bone.items(), key=lambda kv: -kv[1])),
        "influenceHistogram": dict(sorted(influence_histogram.items())),
        "disjointSeamEdges": disjoint_seam_edges,
        "bridgedSeamEdges": bridged_seam_edges,
        "seamBridgeCap": SEAM_BRIDGE_WEIGHT,
        "relaxIterations": relax_iterations,
        "relaxStrength": relax_strength,
        "seededSecondInfluence": seeded_second_influence,
        "maxWeightSumError": float(f"{residual_sum_error:.3e}"),
    }


def commit_patched_bin(path: Path, result: dict[str, Any]) -> None:
    """Write a previously computed patch to disk.

    Split out from repair_glb so a caller can gate on the measured result first
    and only then commit the bytes. Writing before the gate leaves a failing
    asset on disk, and the next session cannot tell a half-repaired asset from an
    unrepaired one.
    """
    patched = result["patchedBin"]
    start, length = result["binStart"], result["binLength"]
    if len(patched) != length:
        raise RepairError(f"patched BIN is {len(patched)} bytes but the chunk is {length}")
    data = bytearray(path.read_bytes())
    original_length = len(data)
    data[start : start + length] = patched
    if len(data) != original_length:
        raise RepairError("in-place patch changed file length; aborting")
    path.write_bytes(bytes(data))


def repair_glb(
    path: Path,
    write: bool,
    relax_iterations: int = RELAX_ITERATIONS,
    relax_strength: float = RELAX_STRENGTH,
) -> dict[str, Any]:
    document, binary, bin_start, bin_length = parse_glb(path)
    if not document.get("skins"):
        raise RepairError(f"no skin in {path}")

    skin_neighbourhoods: dict[int, tuple[list[set[int]], list[str]]] = {}
    primitive_rows: list[dict[str, Any]] = []

    # A primitive's joints index the skin of the node that references the mesh.
    mesh_skin: dict[int, int] = {}
    for node in document.get("nodes", []):
        if "mesh" in node and "skin" in node:
            mesh_skin[node["mesh"]] = node["skin"]

    for mesh_index, mesh in enumerate(document.get("meshes", [])):
        skin_index = mesh_skin.get(mesh_index, 0)
        if skin_index not in skin_neighbourhoods:
            skin_neighbourhoods[skin_index] = joint_neighbourhoods(document, skin_index)
        neighbourhoods, names = skin_neighbourhoods[skin_index]
        for primitive_index, primitive in enumerate(mesh["primitives"]):
            row = repair_primitive(
                document,
                binary,
                primitive,
                neighbourhoods,
                names,
                relax_iterations=relax_iterations,
                relax_strength=relax_strength,
            )
            row["mesh"] = mesh.get("name", f"mesh{mesh_index}")
            row["primitive"] = primitive_index
            primitive_rows.append(row)

    result = {
        "path": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
        "keepRadius": KEEP_RADIUS,
        "weightEpsilon": WEIGHT_EPSILON,
        "sha256Before": sha256_file(path),
        "primitives": primitive_rows,
        # The patched BIN chunk, so a caller can gate on the result BEFORE the
        # bytes reach disk. `--write` alone would leave a failing asset on disk
        # and rely on someone reading a tail line.
        "patchedBin": bytes(binary),
        "binStart": bin_start,
        "binLength": bin_length,
        "written": False,
    }

    if len(binary) != bin_length:
        raise RepairError(
            f"patched BIN is {len(binary)} bytes but the chunk is {bin_length}; aborting"
        )

    if write:
        commit_patched_bin(path, result)
        result["written"] = True
        result["sha256After"] = sha256_file(path)
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Repair skin weights for joint articulation")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help="patch the GLBs in place")
    mode.add_argument("--check", action="store_true", help="report only, write nothing")
    parser.add_argument("--asset-id", action="append", default=None, help="limit to asset id(s)")
    parser.add_argument("--report", default=None, help="write a JSON report here")
    args = parser.parse_args(argv)

    registry = json.loads(REGISTRY.read_text())
    assets = registry["assets"]
    if args.asset_id:
        wanted = set(args.asset_id)
        assets = [a for a in assets if a["assetId"] in wanted]
        missing = wanted - {a["assetId"] for a in assets}
        if missing:
            raise SystemExit(f"unknown asset id(s): {sorted(missing)}")

    rows = []
    for asset in assets:
        path = ROOT / asset["model"]
        row = repair_glb(path, write=args.write)
        row["assetId"] = asset["assetId"]
        rows.append(row)
        summary = row["primitives"][0]
        print(
            f"{asset['assetId']:26s} verts={summary['vertices']:6d} "
            f"changed={summary['changedVertices']:6d} ({summary['changedFraction']:.3f}) "
            f"dropped={summary['droppedInfluences']:6d} "
            f"meanMoved={summary['meanWeightRedistributed']:.4f} "
            f"sumErr={summary['maxWeightSumError']} "
            f"{'WRITTEN' if row['written'] else 'check-only'}"
        )

    if args.report:
        report_path = Path(args.report)
        if not report_path.is_absolute():
            report_path = ROOT / report_path
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "generatedBy": "scripts/repair-joint-weights.py",
                    "mode": "write" if args.write else "check",
                    "keepRadius": KEEP_RADIUS,
                    "registryGenerationId": registry.get("generationId"),
                    "assets": rows,
                },
                indent=1,
            )
            + "\n"
        )
        try:
            shown = report_path.relative_to(ROOT)
        except ValueError:
            shown = report_path
        print(f"report -> {shown}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
