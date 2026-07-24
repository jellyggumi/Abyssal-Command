#!/usr/bin/env python3
"""
Rig-and-animate pipeline for single-mesh Rodin/Hyper3D GLB assets: separates
the static pedestal from the deforming body via a radius-minima height cut,
fits a Rigify human metarig to the body, binds it with automatic weights,
authors the project's 11-action keyframe library onto the resulting armature,
and exports a single game-ready GLB.

Supersedes the empty/proxy object-transform previs approach in
scripts/boss-motion-previs-blender.py for character-type assets (bosses,
companions, enemies) that need real bone deformation. See
_workspace/20260723-solo-warden-rpg-concept/design/previs-rigging-guide.md
for the full research/rationale behind every step below.

Usage (Blender runtime, one asset):
  blender --background --python scripts/rig-and-animate-asset-blender.py -- \
    --glb path/to/raw.glb --asset-id anchor-shard --category companions \
    --outdir _workspace/20260723-solo-warden-rpg-concept/pipeline \
    --actions-json _workspace/20260723-solo-warden-rpg-concept/production/boss-motion-previs-action-pipeline.json \
    --fps 60

Usage (dry-run, no bpy, validates args + actions JSON only):
  python scripts/rig-and-animate-asset-blender.py -- \
    --glb path/to/raw.glb --asset-id anchor-shard --category companions \
    --outdir _workspace/20260723-solo-warden-rpg-concept/pipeline \
    --actions-json _workspace/20260723-solo-warden-rpg-concept/production/boss-motion-previs-action-pipeline.json \
    --dry-run
"""

import argparse
import json
import sys
from pathlib import Path

# Fallback frame budgets (target frame count, key-pose count) if the project's
# action-pipeline JSON is unavailable or missing an entry -- mirrors the table
# in design/previs-rigging-guide.md section 4.1.
DEFAULT_ACTION_BUDGETS = {
    "idle": {"targetFrames": 120, "keyPoses": 4, "loop": True},
    "move": {"targetFrames": 72, "keyPoses": 5, "loop": True},
    "run": {"targetFrames": 84, "keyPoses": 6, "loop": True},
    "hit": {"targetFrames": 54, "keyPoses": 6, "loop": False},
    "bighit": {"targetFrames": 84, "keyPoses": 7, "loop": False},
    "attack": {"targetFrames": 90, "keyPoses": 7, "loop": False},
    "critical": {"targetFrames": 72, "keyPoses": 6, "loop": False},
    "avoid": {"targetFrames": 42, "keyPoses": 5, "loop": False},
    "defence": {"targetFrames": 78, "keyPoses": 5, "loop": False},
    "die": {"targetFrames": 72, "keyPoses": 5, "loop": False},
    "show": {"targetFrames": 96, "keyPoses": 6, "loop": False},
}

CATEGORIES_NEEDING_RIG = {"bosses", "companions", "enemies"}


def _extract_script_args(argv=None):
    if argv is None:
        argv = sys.argv[1:]
    if "--" in argv:
        return argv[argv.index("--") + 1 :]
    return argv


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Rig + animate a single Rodin GLB asset")
    p.add_argument("--glb", required=True, help="Input raw GLB path")
    p.add_argument("--asset-id", required=True, help="Catalog id, e.g. anchor-shard")
    p.add_argument("--category", required=True, choices=sorted(CATEGORIES_NEEDING_RIG))
    p.add_argument("--outdir", required=True, help="Pipeline workspace root (per-category raw/basemesh/rig/previs dirs live here)")
    p.add_argument("--actions-json", default=None, help="Path to boss-motion-previs-action-pipeline.json (optional; falls back to built-in defaults)")
    p.add_argument("--fps", type=int, default=60)
    p.add_argument("--final-glb-out", default=None, help="Final export path; defaults to <outdir>/../models-out/<asset-id>.glb")
    p.add_argument("--dry-run", action="store_true", default=False)
    return p.parse_args(_extract_script_args(argv))


def load_action_budgets(actions_json_path):
    if not actions_json_path:
        return DEFAULT_ACTION_BUDGETS
    path = Path(actions_json_path)
    if not path.exists():
        return DEFAULT_ACTION_BUDGETS
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return DEFAULT_ACTION_BUDGETS
    budgets = dict(DEFAULT_ACTION_BUDGETS)
    lib = data.get("actionBudgets") or data.get("actions") or {}
    if isinstance(lib, dict):
        for name, spec in lib.items():
            if isinstance(spec, dict) and "targetFrames" in spec:
                budgets[name] = {
                    "targetFrames": int(spec.get("targetFrames", DEFAULT_ACTION_BUDGETS.get(name, {}).get("targetFrames", 72))),
                    "keyPoses": int(spec.get("keyPoses", 5)),
                    "loop": bool(spec.get("loop", False)),
                }
    return budgets


# ---------------------------------------------------------------------------
# bpy-dependent implementation (only imported/used when actually running
# inside Blender; dry-run mode never touches this).
# ---------------------------------------------------------------------------

def run_in_blender(args, budgets):
    import bpy
    import bmesh
    import addon_utils
    import numpy as np
    from math import radians

    outdir = Path(args.outdir)
    raw_dir = outdir / args.category / "raw"
    basemesh_dir = outdir / args.category / "basemesh"
    rig_dir = outdir / args.category / "rig"
    previs_dir = outdir / args.category / "previs"
    for d in (raw_dir, basemesh_dir, rig_dir, previs_dir):
        d.mkdir(parents=True, exist_ok=True)

    log = {"assetId": args.asset_id, "category": args.category, "steps": []}

    # --- 1. Import raw GLB -------------------------------------------------
    bpy.ops.wm.read_factory_settings(use_empty=True)
    existing = set(o.name for o in bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(args.glb))
    imported = [o for o in bpy.data.objects if o.name not in existing and o.type == "MESH"]
    if not imported:
        raise RuntimeError(f"No mesh objects imported from {args.glb}")
    raw_obj = imported[0]
    log["steps"].append({"step": "import", "object": raw_obj.name, "vertCount": len(raw_obj.data.vertices)})

    # --- 1b. Merge-by-distance: Rodin/Hyper3D marching-cubes output is
    # heavily fragmented into thousands of disconnected micro-islands (this
    # asset: 550K verts / 74,381 islands, largest island only 6,528 verts).
    # Bone-heat automatic weighting requires a walkable connected surface to
    # diffuse weights from each bone -- on fragmented input it silently
    # produces vertex groups with ZERO actual weight assignments (no
    # exception, no operator-report failure string; only detectable by
    # inspecting per-vertex .groups afterwards). Weld coincident vertices
    # first so bone-heat has a single connected island to work with.
    verts_before_merge = len(raw_obj.data.vertices)
    bm = bmesh.new()
    bm.from_mesh(raw_obj.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
    bm.to_mesh(raw_obj.data)
    raw_obj.data.update()
    bm.free()
    log["steps"].append({
        "step": "merge_by_distance",
        "vertsBefore": verts_before_merge,
        "vertsAfter": len(raw_obj.data.vertices),
    })

    # --- 2. Find pedestal cut height via radius-minima heuristic ----------
    coords = np.array([v.co for v in raw_obj.data.vertices])
    z = coords[:, 2]
    x = coords[:, 0]
    y = coords[:, 1]
    z_min, z_max = float(z.min()), float(z.max())
    height = z_max - z_min
    n_bins = 40
    edges = np.linspace(z_min, z_max, n_bins + 1)
    radii = []
    for i in range(n_bins):
        lo, hi = edges[i], edges[i + 1]
        mask = (z >= lo) & (z < hi)
        if mask.sum() > 5:
            xs, ys = x[mask], y[mask]
            radii.append(float(max(xs.max() - xs.min(), ys.max() - ys.min()) / 2))
        else:
            radii.append(0.0)

    # search for the strongest local minimum within the bottom 55% of height
    # (pedestals are always at the base; never search the top of the mesh).
    search_end = int(n_bins * 0.55)
    best_idx, best_score = None, -1.0
    for i in range(2, max(3, search_end)):
        if radii[i] == 0.0:
            continue
        left_max = max(radii[max(0, i - 4):i]) if i > 0 else radii[i]
        right_max = max(radii[i + 1:min(n_bins, i + 5)]) if i < n_bins - 1 else radii[i]
        score = (left_max - radii[i]) + (right_max - radii[i])
        if score > best_score:
            best_score, best_idx = score, i
    if best_idx is None:
        # fallback: no clear waist found (e.g. non-humanoid/no pedestal) -- cut at 15% height
        cut_frac = 0.15
    else:
        cut_frac = (edges[best_idx] + edges[best_idx + 1]) / 2 / height if height > 0 else 0.15
        cut_frac = float(np.clip(cut_frac, 0.05, 0.5))
    cut_z = z_min + height * cut_frac
    log["steps"].append({"step": "pedestal_cut_detect", "cutHeightFrac": round(cut_frac, 4), "cutZ": round(cut_z, 5), "radiusProfile": [round(r, 4) for r in radii]})

    # --- 3. Bisect mesh at cut_z into pedestal (below) + body (above) -----
    bpy.context.view_layer.objects.active = raw_obj
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(raw_obj.data)
    bmesh.ops.bisect_plane(
        bm,
        geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
        plane_co=(0.0, 0.0, cut_z),
        plane_no=(0.0, 0.0, 1.0),
        clear_inner=False,
        clear_outer=False,
    )
    bmesh.update_edit_mesh(raw_obj.data)
    bpy.ops.object.mode_set(mode="OBJECT")

    # select faces below cut_z (pedestal) and separate
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    for f in raw_obj.data.polygons:
        avg_z = sum(raw_obj.data.vertices[vi].co.z for vi in f.vertices) / len(f.vertices)
        f.select = avg_z < cut_z
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")

    parts = [o for o in bpy.data.objects if o.name.startswith(raw_obj.name)]
    if len(parts) != 2:
        raise RuntimeError(f"Expected 2 parts after separation, got {len(parts)}: {[o.name for o in parts]}")
    # the separated (.001) piece holds the selected (below-cut) faces == pedestal
    pedestal_obj = next(o for o in parts if o.name.endswith(".001"))
    body_obj = next(o for o in parts if o != pedestal_obj)
    log["steps"].append({
        "step": "separate",
        "pedestalVerts": len(pedestal_obj.data.vertices),
        "bodyVerts": len(body_obj.data.vertices),
    })

    # --- 4. Build asset hierarchy ------------------------------------------
    root = bpy.data.objects.new(args.asset_id, None)
    root.empty_display_type = "PLAIN_AXES"
    bpy.context.scene.collection.objects.link(root)
    pedestal_obj.name = f"{args.asset_id}_pedestal"
    pedestal_obj.parent = root
    body_obj.name = f"{args.asset_id}_body"

    # --- 5. Fit + generate Rigify metarig on body ---------------------------
    if not addon_utils.check("rigify")[1]:
        addon_utils.enable("rigify", default_set=True)

    body_zs = [ (body_obj.matrix_world @ v.co).z for v in body_obj.data.vertices ]
    body_z_min, body_z_max = min(body_zs), max(body_zs)
    body_height = body_z_max - body_z_min

    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.object.armature_basic_human_metarig_add()
    metarig = bpy.context.object
    metarig.location = (body_obj.location.x, body_obj.location.y, body_z_min)
    default_metarig_height = 1.8
    scale_factor = body_height / default_metarig_height if default_metarig_height else 1.0
    metarig.scale = (scale_factor, scale_factor, scale_factor)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    import rigify
    bpy.ops.object.select_all(action="DESELECT")
    metarig.select_set(True)
    bpy.context.view_layer.objects.active = metarig
    rigify.generate.generate_rig(bpy.context, metarig)
    rig_obj = bpy.data.objects.get("rig")
    if rig_obj is None:
        raise RuntimeError("Rigify generate_rig did not produce an object named 'rig'")
    rig_obj.name = f"{args.asset_id}_armature"
    rig_obj.parent = root
    log["steps"].append({"step": "rigify_generate", "armature": rig_obj.name, "boneCount": len(rig_obj.data.bones), "bodyHeight": round(body_height, 4)})

    # --- 6. Bind body to rig with automatic weights ------------------------
    bpy.ops.object.select_all(action="DESELECT")
    body_obj.select_set(True)
    bpy.context.view_layer.objects.active = body_obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bpy.ops.object.select_all(action="DESELECT")
    body_obj.select_set(True)
    rig_obj.select_set(True)
    bpy.context.view_layer.objects.active = rig_obj
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")

    def_bones = {b.name for b in rig_obj.data.bones if b.name.startswith("DEF-")}
    missing = def_bones - {vg.name for vg in body_obj.vertex_groups}
    log["steps"].append({"step": "bind_automatic_weights", "defBoneCount": len(def_bones), "missingVertexGroups": sorted(missing)})

    # --- 7. Author keyframe animations per action library -------------------
    control_candidates = {
        "chest": ["chest", "torso"],
        "head": ["head"],
        "upper_arm_l": ["upper_arm_fk.L", "upper_arm_ik.L"],
        "upper_arm_r": ["upper_arm_fk.R", "upper_arm_ik.R"],
        "thigh_l": ["thigh_fk.L", "thigh_ik.L"],
        "thigh_r": ["thigh_fk.R", "thigh_ik.R"],
    }

    def resolve(pbones, role):
        for cand in control_candidates[role]:
            if cand in pbones:
                return pbones[cand]
        return None

    def ensure_euler(pb):
        if pb.rotation_mode not in {"XYZ", "XZY", "YXZ", "YZX", "ZXY", "ZYX"}:
            pb.rotation_mode = "XYZ"

    bpy.context.view_layer.objects.active = rig_obj
    bpy.ops.object.mode_set(mode="POSE")
    pbones = rig_obj.pose.bones
    chest = resolve(pbones, "chest")
    head = resolve(pbones, "head")
    arm_l = resolve(pbones, "upper_arm_l")
    arm_r = resolve(pbones, "upper_arm_r")
    thigh_l = resolve(pbones, "thigh_l")
    thigh_r = resolve(pbones, "thigh_r")
    for b in (chest, head, arm_l, arm_r, thigh_l, thigh_r):
        if b is not None:
            ensure_euler(b)

    authored_actions = []
    rig_obj.animation_data_create()
    for action_name, budget in budgets.items():
        duration = budget["targetFrames"]
        clip_id = f"{args.asset_id}::{action_name}::v01"
        action = bpy.data.actions.get(clip_id) or bpy.data.actions.new(name=clip_id)
        action.use_fake_user = True
        rig_obj.animation_data.action = action

        # deterministic-but-distinct per-action pose amplitude, keyed on a
        # small set of key poses spread across the action's frame budget --
        # a generic pose-to-pose "vital sign" motion, not per-asset hand
        # authored choreography (see guide section 4.5 for the reference
        # idle-breathing pattern this generalizes).
        n_keys = max(2, budget.get("keyPoses", 4))
        amp = {
            "idle": 2.2, "move": 5.0, "run": 9.0, "hit": 6.0, "bighit": 10.0,
            "attack": 12.0, "critical": 10.0, "avoid": 8.0, "defence": 4.0,
            "die": 6.0, "show": 5.0,
        }.get(action_name, 4.0)

        for k in range(n_keys):
            frame = round(1 + (duration - 1) * (k / (n_keys - 1)))
            # triangular envelope so loop actions return to neutral at both ends
            t = k / (n_keys - 1)
            env = 1.0 - abs(2 * t - 1) if budget.get("loop") else (t if t < 0.5 else (1 - t) * 2)
            pitch = radians(amp * env)
            if chest:
                chest.rotation_euler = (pitch * 0.4, 0.0, 0.0)
                chest.keyframe_insert(data_path="rotation_euler", frame=frame)
            if head:
                head.rotation_euler = (0.0, 0.0, radians(amp * 0.25) * env)
                head.keyframe_insert(data_path="rotation_euler", frame=frame)
            if arm_l:
                arm_l.rotation_euler = (0.0, 0.0, radians(amp) * env)
                arm_l.keyframe_insert(data_path="rotation_euler", frame=frame)
            if arm_r:
                arm_r.rotation_euler = (0.0, 0.0, -radians(amp) * env)
                arm_r.keyframe_insert(data_path="rotation_euler", frame=frame)
            if thigh_l and action_name in ("move", "run"):
                thigh_l.rotation_euler = (radians(amp * 0.6) * env, 0.0, 0.0)
                thigh_l.keyframe_insert(data_path="rotation_euler", frame=frame)
            if thigh_r and action_name in ("move", "run"):
                thigh_r.rotation_euler = (-radians(amp * 0.6) * env, 0.0, 0.0)
                thigh_r.keyframe_insert(data_path="rotation_euler", frame=frame)

        track = rig_obj.animation_data.nla_tracks.new()
        track.name = clip_id
        track.strips.new(name=action.name, start=1, action=action)
        rig_obj.animation_data.action = None
        authored_actions.append({"clipId": clip_id, "frames": duration, "keyPoses": n_keys})

    bpy.ops.object.mode_set(mode="OBJECT")
    log["steps"].append({"step": "author_animations", "actions": authored_actions})

    # --- 8. Save WIP blend + export final GLB --------------------------------
    wip_blend = rig_dir / f"{args.asset_id}_rigged.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(wip_blend), copy=True)

    final_out = Path(args.final_glb_out) if args.final_glb_out else (outdir / ".." / "models-out" / f"{args.asset_id}.glb")
    final_out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in (root, pedestal_obj, rig_obj, body_obj):
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(final_out),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_force_sampling=True,
        export_yup=True,
        export_skins=True,
        export_all_influences=False,
        export_def_bones=True,
    )
    log["steps"].append({"step": "export", "wipBlend": str(wip_blend), "finalGlb": str(final_out)})
    log["status"] = "completed"
    return log


def main(argv=None):
    args = parse_args(argv)
    budgets = load_action_budgets(args.actions_json)

    if args.dry_run:
        print(json.dumps({
            "status": "dry_run_ok",
            "assetId": args.asset_id,
            "category": args.category,
            "needsRig": args.category in CATEGORIES_NEEDING_RIG,
            "actionBudgets": budgets,
        }, indent=2))
        return

    try:
        import bpy  # noqa: F401
    except ImportError:
        print(json.dumps({"status": "error", "message": "bpy not available -- run under `blender --background --python`"}))
        sys.exit(1)

    result = run_in_blender(args, budgets)
    print("RIG_ANIMATE_RESULT_JSON:" + json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
