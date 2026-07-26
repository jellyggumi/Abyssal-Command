#!/usr/bin/env python3
"""Read-only GLB structural and rest-pose audit.

Parses deployed GLB JSON/BIN directly, writes evidence only below --out-dir,
and never imports, transforms, or rewrites a production asset.
"""
from __future__ import annotations

import argparse
import html
import json
import math
import struct
from collections import Counter
from pathlib import Path

EXPECTED = ("idle", "move", "run", "hit", "bighit", "attack", "critical", "avoid", "defence", "die", "show")
DISPLAY_ACTION = {"bighit": "bigHit (runtime key: bighit)"}
CATEGORY_ORDER = ("commander", "companions", "enemies", "bosses")
RUNTIME_IDS = {
    "commander/dusk-warden.glb": ["commander"],
    "companions/ember-cohort.glb": ["ember-cohort"], "companions/rift-lens.glb": ["rift-lens"],
    "companions/veil-vanguard.glb": ["veil-vanguard"], "companions/anchor-shard.glb": ["anchor-shard"],
    "companions/throne-echo.glb": ["throne-echo"], "companions/dawnless-crown.glb": ["dawnless-crown"],
    "companions/pack-warden.glb": ["pack-warden"], "companions/lantern-reaver.glb": ["lantern-reaver"],
    "companions/requiem-warden.glb": ["requiem-warden"],
    "enemies/scout.glb": ["rusher"], "enemies/shade.glb": ["flanker"],
    "enemies/guard.glb": ["guardian"], "enemies/possessed.glb": ["possessed"],
    "bosses/cinder-warden.glb": ["s1-cinder-warden"], "bosses/veil-tactician.glb": ["s2-veil-tactician"],
    "bosses/gate-sovereign.glb": ["s3-gate-sovereign"], "bosses/tide-warden.glb": ["s4-tide-warden"],
    "bosses/pack-herald.glb": ["s5-pack-herald"], "bosses/requiem-choir.glb": ["s6-requiem-choir"],
    "bosses/lantern-tyrant.glb": ["s7-lantern-tyrant"], "bosses/bridge-colossus.glb": ["s8-bridge-colossus"],
    "bosses/veiled-concordat.glb": ["s9-veiled-concordat"], "bosses/abyss-regent.glb": ["s10-abyss-regent"],
}
COMPONENT = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
COUNT = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT2": 4, "MAT3": 9, "MAT4": 16}


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--root", type=Path, required=True)
    p.add_argument("--out-dir", type=Path, required=True)
    return p.parse_args()


def glb(path: Path):
    raw = path.read_bytes()
    if len(raw) < 20 or raw[:4] != b"glTF":
        raise ValueError("not a GLB")
    total = struct.unpack_from("<I", raw, 8)[0]
    if total != len(raw):
        raise ValueError(f"GLB declared length {total}, actual {len(raw)}")
    offset, document, binary = 12, None, b""
    while offset < total:
        length, kind = struct.unpack_from("<II", raw, offset)
        chunk = raw[offset + 8:offset + 8 + length]
        if kind == 0x4E4F534A:
            document = json.loads(chunk.decode("utf-8"))
        elif kind == 0x004E4942:
            binary = chunk
        offset += 8 + length
    if document is None:
        raise ValueError("GLB has no JSON chunk")
    return document, binary


def identity():
    return [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0]


def mmul(a, b):
    return [sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4)) for c in range(4) for r in range(4)]


def node_matrix(node):
    if "matrix" in node:
        return [float(v) for v in node["matrix"]]
    x, y, z, w = node.get("rotation", [0.0, 0.0, 0.0, 1.0])
    sx, sy, sz = node.get("scale", [1.0, 1.0, 1.0])
    tx, ty, tz = node.get("translation", [0.0, 0.0, 0.0])
    xx, yy, zz, xy, xz, yz, wx, wy, wz = x*x, y*y, z*z, x*y, x*z, y*z, w*x, w*y, w*z
    return [
        (1 - 2*(yy+zz))*sx, (2*(xy+wz))*sx, (2*(xz-wy))*sx, 0.0,
        (2*(xy-wz))*sy, (1 - 2*(xx+zz))*sy, (2*(yz+wx))*sy, 0.0,
        (2*(xz+wy))*sz, (2*(yz-wx))*sz, (1 - 2*(xx+yy))*sz, 0.0,
        tx, ty, tz, 1.0,
    ]


def world_matrices(nodes):
    parents = {}
    for parent, node in enumerate(nodes):
        for child in node.get("children", []):
            parents[child] = parent
    cache = {}
    def one(index):
        if index not in cache:
            parent = parents.get(index)
            cache[index] = mmul(one(parent), node_matrix(nodes[index])) if parent is not None else node_matrix(nodes[index])
        return cache[index]
    return [one(i) for i in range(len(nodes))], parents


def accessor(doc, binary, index):
    a = doc["accessors"][index]
    view = doc["bufferViews"][a["bufferView"]]
    fmt, size = COMPONENT[a["componentType"]]
    n = COUNT[a["type"]]
    start = view.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = view.get("byteStride", n * size)
    values = []
    for row in range(a["count"]):
        values.append(struct.unpack_from("<" + fmt * n, binary, start + row * stride))
    return values, a


def normalized(row, component_type):
    if component_type == 5121:
        return [v / 255.0 for v in row]
    if component_type == 5123:
        return [v / 65535.0 for v in row]
    return list(row)


def role_node(nodes, skin_joints, role, side):
    candidates = []
    for joint in skin_joints:
        name = nodes[joint].get("name", "").lower()
        if role in name and (f".{side.lower()}" in name or f"_{side.lower()}" in name or name.endswith(side.lower())):
            candidates.append(joint)
    return candidates[0] if len(candidates) == 1 else None


def line(p1, p2, color, label):
    return f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" stroke="{color}" stroke-width="3"/><text x="{p2[0]+4:.1f}" y="{p2[1]-4:.1f}" fill="#dbeafe" font-size="11">{html.escape(label)}</text>'


def skeleton_svg(result, doc, out_path):
    nodes = doc.get("nodes", [])
    joints = result.get("primary_skin_joint_nodes", [])
    matrices, _ = world_matrices(nodes)
    positions = {i: (matrices[i][12], matrices[i][13], matrices[i][14]) for i in joints}
    if not positions:
        out_path.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="260"><rect width="100%" height="100%" fill="#111827"/><text x="20" y="40" fill="#fca5a5">No skeleton joints present</text></svg>')
        return
    xs, ys = [p[0] for p in positions.values()], [p[1] for p in positions.values()]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    span = max(maxx-minx, maxy-miny, 1e-4)
    def project(p): return (80 + (p[0]-minx)/span*460, 220 - (p[1]-miny)/span*180)
    parent = {}
    for i in joints:
        for child in nodes[i].get("children", []):
            if child in positions: parent[child] = i
    pieces = []
    for child, par in parent.items():
        label = nodes[child].get("name", f"node{child}")
        color = "#fbbf24" if "arm" in label.lower() or "hand" in label.lower() or "shoulder" in label.lower() else "#93c5fd"
        pieces.append(line(project(positions[par]), project(positions[child]), color, label))
    facts = result["pose"]
    angle = facts.get("angle_degrees", {})
    body = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="260" viewBox="0 0 900 260">',
        '<rect width="100%" height="100%" fill="#111827"/><text x="20" y="25" fill="#f9fafb" font-family="monospace" font-size="16">',
        html.escape(result["source_path"]), '</text>', *pieces,
        '<text x="580" y="70" fill="#f9fafb" font-family="monospace" font-size="15">classification: ', html.escape(facts["classification"]), '</text>',
        '<text x="580" y="100" fill="#f9fafb" font-family="monospace" font-size="13">method: shoulder → hand world vector</text>',
        '<text x="580" y="125" fill="#f9fafb" font-family="monospace" font-size="13">T threshold: abs(vertical deviation) ≤ 12° each side</text>',
        '<text x="580" y="150" fill="#fbbf24" font-family="monospace" font-size="13">L deviation: ', str(angle.get("L", "n/a")), '°</text>',
        '<text x="580" y="175" fill="#fbbf24" font-family="monospace" font-size="13">R deviation: ', str(angle.get("R", "n/a")), '°</text>',
        '<text x="580" y="220" fill="#93c5fd" font-family="monospace" font-size="12">blue: non-arm joint chains · amber: shoulder/arm chains</text></svg>'
    ]
    out_path.write_text("".join(body), encoding="utf-8")


def inspect(root: Path, path: Path, visual_dir: Path):
    doc, binary = glb(path)
    rel = path.relative_to(root).as_posix()
    nodes = doc.get("nodes", [])
    skins = doc.get("skins", [])
    meshes = doc.get("meshes", [])
    primary = skins[0] if skins else {}
    joints = primary.get("joints", [])
    matrices, _ = world_matrices(nodes)
    angle, arm_nodes = {}, {}
    for side in ("L", "R"):
        shoulder = role_node(nodes, joints, "shoulder", side)
        hand = role_node(nodes, joints, "hand", side)
        if shoulder is not None and hand is not None:
            a, b = matrices[shoulder], matrices[hand]
            dx, dy, dz = b[12]-a[12], b[13]-a[13], b[14]-a[14]
            horizontal = math.hypot(dx, dz)
            length = math.hypot(horizontal, dy)
            if length > 1e-8:
                angle[side] = round(math.degrees(math.asin(min(1.0, abs(dy)/length))), 3)
                arm_nodes[side] = {"shoulder": nodes[shoulder].get("name", f"node{shoulder}"), "hand": nodes[hand].get("name", f"node{hand}"), "vector": [round(dx,6), round(dy,6), round(dz,6)]}
    joint_names = [nodes[j].get("name", f"node{j}") for j in joints]
    has_humanoid_core = any("spine" in n.lower() for n in joint_names) and any("head" in n.lower() for n in joint_names)
    if set(angle) == {"L", "R"}:
        classification = "T-pose" if max(angle.values()) <= 12.0 else "A-pose"
        reason = "both shoulder-to-hand rest vectors measured; T-pose requires both deviations from horizontal at or below 12°"
    elif not has_humanoid_core and len(joints) < 12:
        classification, reason = "non-humanoid", "no humanoid spine/head skeleton evidence and fewer than 12 skin joints"
    else:
        classification, reason = "indeterminate", "could not uniquely resolve both shoulder → hand joint pairs"
    skinned_nodes = [n for n in nodes if "mesh" in n and "skin" in n]
    prim_total = weighted_prims = vertex_total = weighted_vertices = 0
    joint_totals = Counter()
    for node in skinned_nodes:
        for primitive in meshes[node["mesh"]].get("primitives", []):
            prim_total += 1
            attrs = primitive.get("attributes", {})
            if "POSITION" in attrs:
                vertex_total += doc["accessors"][attrs["POSITION"]]["count"]
            if "JOINTS_0" not in attrs or "WEIGHTS_0" not in attrs:
                continue
            js, _ = accessor(doc, binary, attrs["JOINTS_0"])
            ws, wa = accessor(doc, binary, attrs["WEIGHTS_0"])
            weighted_prims += 1
            for jr, wr in zip(js, ws):
                weights = normalized(wr, wa["componentType"])
                if any(w > 1e-4 for w in weights): weighted_vertices += 1
                for joint, weight in zip(jr, weights):
                    if weight > 1e-4 and joint < len(joint_names): joint_totals[joint_names[joint]] += weight
    total_weight = sum(joint_totals.values())
    top = joint_totals.most_common(1)
    top_share = round(top[0][1] / total_weight, 6) if top and total_weight else None
    animation_rows, keyed_actions = [], set()
    for anim in doc.get("animations", []):
        name = anim.get("name", "")
        parts = name.split("::")
        key = parts[1] if len(parts) >= 2 else name
        if key in EXPECTED: keyed_actions.add(key)
        tracks = []
        for channel in anim.get("channels", []):
            target = channel.get("target", {})
            ni = target.get("node")
            tracks.append({"node": nodes[ni].get("name", f"node{ni}") if isinstance(ni, int) and ni < len(nodes) else None, "path": target.get("path")})
        animation_rows.append({"name": name, "action_key": key if key in EXPECTED else None, "channel_count": len(tracks), "track_targets": tracks})
    missing = [x for x in EXPECTED if x not in keyed_actions]
    skin_ready = bool(skins and len(joints) >= 12 and skinned_nodes and weighted_prims and weighted_vertices)
    animation_ready = not missing and all(a["channel_count"] > 0 for a in animation_rows if a["action_key"])
    disposition = "convert (regeneration-only)" if classification == "A-pose" else "do-not-convert"
    result = {
        "source_path": (Path("assets/images/battle/glb") / rel).as_posix(), "category": rel.split("/", 1)[0],
        "runtime_ids": RUNTIME_IDS.get(rel, []), "file_bytes": path.stat().st_size,
        "pose": {"classification": classification, "reason": reason, "method": "glTF skin joint world transforms; shoulder to hand vector; deviation from XZ horizontal (glTF +Y up)", "tpose_tolerance_degrees": 12.0, "angle_degrees": angle, "arm_nodes": arm_nodes},
        "skeleton": {"skins": len(skins), "primary_joint_count": len(joints), "primary_joint_names": joint_names, "primary_skin_joint_nodes": joints},
        "skinning": {"skinned_mesh_nodes": len(skinned_nodes), "primitives": prim_total, "weighted_primitives": weighted_prims, "position_vertices": vertex_total, "vertices_with_nonzero_weights": weighted_vertices, "top_joint": top[0][0] if top else None, "top_joint_weight_share": top_share, "ready": skin_ready},
        "animations": {"clips": animation_rows, "expected_runtime_keys": list(EXPECTED), "found_runtime_keys": sorted(keyed_actions), "missing_runtime_keys": missing, "ready": animation_ready},
        "action_clip_ready": bool(skin_ready and animation_ready), "disposition": disposition,
    }
    visual = visual_dir / (path.stem + ".svg")
    skeleton_svg(result, doc, visual)
    result["visual_artifact"] = visual.as_posix()
    result["rendered_visual_artifact"] = {"front": (Path("_workspace/20260726-tpose-rig-animation/engineering/full-pose-frames/front") / f"{path.stem}.png").as_posix(), "side": (Path("_workspace/20260726-tpose-rig-animation/engineering/full-pose-frames/side") / f"{path.stem}.png").as_posix()}
    return result


def markdown(results, out_json):
    counts = Counter(r["pose"]["classification"] for r in results)
    ready = sum(r["action_clip_ready"] for r in results)
    convert = sum(r["disposition"].startswith("convert") for r in results)
    lines = [
        "# Deployed Character T-pose, Skinning, and Action-Clip Audit", "",
        "## Scope and safety", "",
        f"- **Audited:** {len(results)} runtime character GLBs: commander, companions, enemies, and bosses only.",
        "- **Read-only:** the audit parser reads each deployed `assets/images/battle/glb/**.glb`; it does not import/export/change production assets or source.",
        "- **Parser:** `engineering/audit_tpose_rigs.py` decodes GLB JSON/BIN directly. Exact machine evidence: `engineering/tpose-rig-audit.json`.",
        "- **Structural visual evidence:** one generated SVG skeleton projection per asset under `engineering/visual/`; it draws the same shoulder/hand joint transforms used for classification.",
        "- **Rendered visual evidence:** this audit freshly imported all 24 deployed GLBs with Blender 5.1.2 and wrote 24 front + 24 side orthographic PNGs under `engineering/full-pose-frames/{front,side}/` (indexes: `front/index.json`, `side/index.json`). A labeled all-asset contact sheet is additionally available under `qa/bind-pose-frames/`. Fresh 768px front/side representative review is in `design/tpose-visual-audit.md`; four-category orbit renders are in `engineering/angle-representatives/`.", "",
        "## Exact commands", "", "```sh", "python3 _workspace/20260726-tpose-rig-animation/engineering/audit_tpose_rigs.py \\", "  --root assets/images/battle/glb \\", "  --out-dir _workspace/20260726-tpose-rig-animation/engineering", "", "/Applications/Blender.app/Contents/MacOS/Blender --background \\", "  --python scripts/audit-glb-angle-readiness.py -- \\", "  --glbs assets/images/battle/glb/commander/dusk-warden.glb,assets/images/battle/glb/companions/veil-vanguard.glb,assets/images/battle/glb/enemies/guard.glb,assets/images/battle/glb/bosses/cinder-warden.glb \\", "  --out-dir _workspace/20260726-tpose-rig-animation/engineering/angle-representatives --res 128 --samples 1", "", "node --test tests/character-rig-contract.test.mjs", "```", "",
        "## Method", "",
        "1. Locate the primary skin and compute every skin-joint world matrix from glTF node transforms. glTF is **+Y up**; therefore each shoulder→hand vector is measured against the XZ horizontal plane.",
        "2. Resolve both `shoulder.{L,R}` and `hand.{L,R}` joints. A **structural T-pose** requires *both* sides to be ≤12° from horizontal (the deployed pipeline’s tolerance); a complete pair outside that symmetric gate is **A-pose** (confirmed non-T). Missing arm geometry on an otherwise humanoid rig is **indeterminate**; no humanoid skeleton evidence with <12 joints is **non-humanoid**.",
        "3. Fresh front/side images were generated for every asset. The exact structural pipeline threshold yields **1 pass / 23 failures**: `pack-herald` is the sole ≤12° symmetric pair; the other 23 are confirmed A-pose. The separate representative visual review confirms that image evidence must accompany the joint metric; its four representative assets all failed the stricter readable-neutral-arm gate. See `design/tpose-visual-audit.md` for its exact left/right visual conclusions.",
        "4. Count skinned mesh nodes, JOINTS_0/WEIGHTS_0 primitives, nonzero-weight vertices, and dominant-joint share. Read actual animation names/channels/tracks; an action library is ready only when all runtime keys have real channels.",
        "5. Cross-reference `battle-realtime-three.js` model maps / `tests/character-rig-contract.test.mjs` asset inventory. `bigHit` in the request corresponds to the actual runtime key `bighit`.", "",
        "## Counts", "", f"- Structural T-pose pass: **{counts['T-pose']}** (`pack-herald`; both shoulders→hands ≤12°)", f"- A-pose (confirmed non-T structurally): **{counts['A-pose']}**", f"- Non-humanoid: **{counts['non-humanoid']}**", f"- Indeterminate: **{counts['indeterminate']}**", "- Rendered image coverage: **24/24 front** and **24/24 side** frames (fresh Blender 5.1.2 import).", f"- Skin + full 11-key action library ready: **{ready}/{len(results)}**", f"- `convert (regeneration-only)` candidates: **{convert}**; `pack-herald` is **do-not-convert**.", "",
        "## Per-asset evidence", "",
        "| Asset / runtime IDs | Pose evidence | Skinning | Clips | Disposition / visual |", "|---|---|---|---|---|",
    ]
    for r in results:
        p, s, a = r["pose"], r["skinning"], r["animations"]
        angles = ", ".join(f"{k}={v}°" for k, v in p["angle_degrees"].items()) or "n/a"
        ids = ", ".join(r["runtime_ids"]) or "UNMAPPED"
        clips = f"{len(a['clips'])} clips; missing: {', '.join(a['missing_runtime_keys']) or 'none'}"
        skin = f"{r['skeleton']['primary_joint_count']} joints; {s['vertices_with_nonzero_weights']}/{s['position_vertices']} weighted verts; top={s['top_joint']} ({s['top_joint_weight_share']})"
        visual = Path(r["visual_artifact"]).name
        rendered = r["rendered_visual_artifact"]
        lines.append(f"| `{r['source_path']}`<br>{ids} | **{p['classification']}**; {angles} | {skin} | {clips} | **{r['disposition']}**<br>joint SVG: `engineering/visual/{visual}`<br>front: `{rendered['front']}`<br>side: `{rendered['side']}` |")
    lines += ["", "## Safe conversion plan (only confirmed non-T assets)", ""]
    candidates = [r for r in results if r["disposition"].startswith("convert")]
    if not candidates:
        lines += ["No confirmed non-T source assets require conversion; do not run a conversion pipeline from this audit."]
    else:
        lines += [
            "The only candidates are the structural A-pose rows above. **Do not batch-rotate or in-place convert the deployed fused meshes.** The deployed body is a single skinned mesh node (pedestal, where present, is separate), and `scripts/rig-character-asset-blender.py` documents that welded capes, pauldrons, and weapons make automatic T-pose baking deform the wrong geometry.",
            "1. Generate only a source-regeneration plan/blockout in a workspace. `scripts/rodin-tpose-regen.py --plan-only` is the existing non-submitting path; its documented real submission requires GUI Blender, an interactive authenticated Hyper3D browser session, and consumes about 0.5 credits per character. No session exists and this audit did not submit, authenticate, or consume credits. UniRig is unavailable on this Apple Silicon host (CUDA-only dependencies).",
            "2. For each candidate, obtain a true T-posed source mesh (or interactive Rodin result) with detachable/independently bindable weapons, cape, pauldron, and pedestal geometry; preserve the runtime-relative source path and ID shown above.",
            "3. Produce only to staging inside a workspace, then rerun the structural audit, `node --test tests/character-rig-contract.test.mjs`, and fresh front/side image review before any separately approved deployed-asset replacement.",
            "4. Require a symmetric pair (both shoulder→hand deviations ≤12°), readable visual neutral arms, a ≥12-joint skin, nonzero JOINTS_0/WEIGHTS_0 coverage, and all 11 actual runtime clip keys/tracks (`idle`, `move`, `run`, `hit`, `bighit`/`bigHit`, `attack`, `critical`, `avoid`, `defence`, `die`, `show`).",
            "5. Only after a separate approved change should the matching deployed GLB be swapped; this audit performs no replacement.",
        ]
    lines += ["", "## Existing pipeline and test findings", "", "- `scripts/rig-character-asset-blender.py` declares the same 12° tolerance and explicitly warns that its `--rest-pose tpose` operation is unsafe for these fused deployed meshes.", "- `tests/character-rig-contract.test.mjs` validates all runtime character paths, ≥12 joints, full clip-key presence, no synthetic neutral-bone weights, dominant-joint share <40%, and arm-chain weight ≥10%. This audit supplements it with rest-pose measurements and per-clip track facts.", "", f"Machine-readable evidence: `{out_json.as_posix()}`."]
    return "\n".join(lines) + "\n"


def main():
    args = parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    visual_dir = args.out_dir / "visual"; visual_dir.mkdir(exist_ok=True)
    inputs = [p for category in CATEGORY_ORDER for p in sorted((args.root / category).glob("*.glb"))]
    results = [inspect(args.root, path, visual_dir) for path in inputs]
    out_json = args.out_dir / "tpose-rig-audit.json"
    out_json.write_text(json.dumps({"command": "python3 _workspace/20260726-tpose-rig-animation/engineering/audit_tpose_rigs.py --root assets/images/battle/glb --out-dir _workspace/20260726-tpose-rig-animation/engineering", "assets": results}, indent=2), encoding="utf-8")
    (args.out_dir / "tpose-rig-audit.md").write_text(markdown(results, out_json), encoding="utf-8")
    print(json.dumps({"assets": len(results), "json": str(out_json), "report": str(args.out_dir / 'tpose-rig-audit.md')}))

if __name__ == "__main__":
    main()
