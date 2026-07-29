#!/usr/bin/env python3
"""Rig + 11-clip action library for Rodin/Hyper3D character GLBs.

Supersedes scripts/rig-and-animate-asset-blender.py, which produced every
shipped character with a broken bind:

  * It added Rigify's stock human metarig unmodified. That metarig is authored
    in an A-pose (upper_arm -> hand descends 30.94 deg below horizontal), while
    design/previs-rigging-guide.md section 1 requires a T-pose bind -- "arms at
    ~90 deg from the torso ... gives auto-weighting algorithms an unambiguous,
    non-self-intersecting armpit/shoulder region". All 20 rigged GLBs measured
    exactly 30.94 deg: the metarig default, untouched.
  * The metarig was only *uniformly scaled* to mesh height, never fitted to
    the source limbs. The shipped character renders are authored in a
    horizontal-arm/T-pose silhouette, so an A-pose or arms-down bind put the
    arm bones outside the mesh and made bone-heat fall back to nearest-bone
    weighting. Symptoms in the shipped GLBs included DEF-hand.R outweighing
    the entire spine chain and roughly one third of vertices landing on head.

Pipeline:

  1. Landmark-fit a deform armature to the mesh (shoulder line, per-side arm
     axis, hip width, ground plane) so bones lie INSIDE the geometry.
  2. Bind in the mesh's sculpted pose, via bone-heat -> envelope ->
     inverse-distance, gated on how much weight the arm chain actually owns.
  3. Freeze the rest pose (`--rest-pose`, below), then repair every vertex to
     one dominant DEF bone plus at most one hierarchy-adjacent DEF bone.
  4. Author the 11-clip action library.
  5. Partition faces into bounded semantic skinned meshes, then export GLB.

`--rest-pose natural` (default) preserves the sculpted source bind pose.
This is the runtime-safe option for this library. Runtime output preserves
bounded adjacent blends and partitions faces into semantic torso, arm, and leg
skinned regions; duplicated boundary vertices keep each region's deformation
independent instead of tearing across fused cape/pauldron seams.

`--rest-pose tpose` is retained only as an explicit diagnostic mode. It rotates
each arm onto +/-X and bakes that as rest, but can drag fused outboard geometry
into wings while the actual arms stay put (rendered proof: cinder-warden).
Automatic arm isolation does not work here -- PCA over the outboard point cloud
diverges between subsets of the same arm (+55.4 deg vs -81.7 deg on
cinder-warden.L) because the cape dominates the cloud. A real T-pose on this
art needs either an ML auto-rigger (UniRig, guide section 2.4) or T-posed
source meshes.

Why a hand-built armature instead of Rigify: Rigify's DEF- bones are driven by
constraints from ORG-/MCH- bones, so `pose.armature_apply` does not move the
rest pose -- the T-pose step silently no-ops and the asset exports still A-posed
(measured: rest stayed 35.98 deg after a full generate+pose+apply cycle). A
plain deform-only armature has no constraint layer, so rest-pose application is
exact. Bone names and hierarchy still follow the Rigify DEF- convention the
runtime and the guide's retarget table expect, and the rig drops from 222 bones
to 27 with no "baking because of unsupported constraints" export warnings.

Run headless:
  blender -b -P scripts/rig-character-asset-blender.py -- \
    --glb assets/images/battle/glb/enemies/guard.glb \
    --asset-id guard --category enemies \
    --out /tmp/rig-staging/enemies/guard.glb \
    --report /tmp/rig-staging/reports/guard.json
"""
import sys
import json
import math
from pathlib import Path

# Fallback frame budgets (target frames, key poses, loop), mirroring
# production/boss-motion-previs-action-pipeline.json keyframeBudgets.
DEFAULT_BUDGETS = {
    "idle":     {"targetFrames": 120, "keyPoses": 4, "loop": True},
    "move":     {"targetFrames": 72,  "keyPoses": 6, "loop": True},
    "run":      {"targetFrames": 84,  "keyPoses": 7, "loop": True},
    "hit":      {"targetFrames": 54,  "keyPoses": 6, "loop": False},
    "bighit":   {"targetFrames": 84,  "keyPoses": 8, "loop": False},
    "attack":   {"targetFrames": 90,  "keyPoses": 8, "loop": False},
    "critical": {"targetFrames": 72,  "keyPoses": 6, "loop": False},
    "avoid":    {"targetFrames": 42,  "keyPoses": 5, "loop": False},
    "defence":  {"targetFrames": 78,  "keyPoses": 5, "loop": False},
    "die":      {"targetFrames": 72,  "keyPoses": 5, "loop": False},
    "show":     {"targetFrames": 96,  "keyPoses": 6, "loop": False},
}

# Max |angle| between shoulder->hand and horizontal in the exported rest pose
# for the asset to count as T-posed. scripts/audit-tpose.py uses the same value.
TPOSE_TOLERANCE_DEG = 12.0

# Canonical DEF roll policy used before bind.
# Axial rig bones (spine/pelvis/legs) align to global +Y;
# arms/shoulders/hands/feet/toes align to global +Z.
# These choices match the production contract used by downstream tooling.
ROLL_POLICY = {
    "axial": (0.0, 1.0, 0.0),   # +Y
    "lateral": (0.0, 0.0, 1.0),  # +Z
}

# Weight repair thresholds.
WEIGHT_EPSILON = 1e-6
ADJACENT_SECONDARY_MIN = 0.02
MEANINGFUL_SECONDARY_MIN = 0.12
DROPPED_MASS_SYNTHESIS_MIN = 0.05
SYNTH_SECONDARY_MIN = MEANINGFUL_SECONDARY_MIN
SYNTH_SECONDARY_MAX = 0.22
DISTAL_RIGID_BONES = frozenset({
    "DEF-hand.L",
    "DEF-hand.R",
    "DEF-toe.L",
    "DEF-toe.R",
})
DISTAL_RIGID_START = 0.85
FORBIDDEN_SOURCE_TOKENS = (
    "terrain",
    "floor",
    "pedestal",
    "platform",
    "rock",
    "weapon",
    "sword",
    "shield",
    "staff",
    "prop",
)

SEMANTIC_REGION_ORDER = (
    "torso_head",
    "upper_arm_l",
    "lower_arm_l",
    "upper_arm_r",
    "lower_arm_r",
    "upper_leg_l",
    "lower_leg_l",
    "upper_leg_r",
    "lower_leg_r",
)

SEMANTIC_REGION_BONES = {
    "torso_head": (
        "DEF-spine", "DEF-spine.001", "DEF-spine.002",
        "DEF-spine.003", "DEF-spine.004", "DEF-spine.005",
    ),
    "upper_arm_l": ("DEF-shoulder.L", "DEF-upper_arm.L"),
    "lower_arm_l": ("DEF-forearm.L", "DEF-hand.L"),
    "upper_arm_r": ("DEF-shoulder.R", "DEF-upper_arm.R"),
    "lower_arm_r": ("DEF-forearm.R", "DEF-hand.R"),
    "upper_leg_l": ("DEF-pelvis.L", "DEF-thigh.L"),
    "lower_leg_l": ("DEF-shin.L", "DEF-foot.L", "DEF-toe.L"),
    "upper_leg_r": ("DEF-pelvis.R", "DEF-thigh.R"),
    "lower_leg_r": ("DEF-shin.R", "DEF-foot.R", "DEF-toe.R"),
}

# Rigify-compatible deform skeleton. Each entry drives one bone; positions come
# from per-asset landmarks at fit time. `parent` is the bone name, `connect`
# whether head snaps to the parent's tail.
#   name, parent, connect
SKELETON = [
    ("DEF-spine",         None,               False),
    ("DEF-spine.001",     "DEF-spine",        True),
    ("DEF-spine.002",     "DEF-spine.001",    True),
    ("DEF-spine.003",     "DEF-spine.002",    True),
    ("DEF-spine.004",     "DEF-spine.003",    True),   # neck
    ("DEF-spine.005",     "DEF-spine.004",    True),   # head
    ("DEF-pelvis.L",      "DEF-spine",        False),
    ("DEF-pelvis.R",      "DEF-spine",        False),
    ("DEF-shoulder.L",    "DEF-spine.003",    False),
    ("DEF-upper_arm.L",   "DEF-shoulder.L",   False),
    ("DEF-forearm.L",     "DEF-upper_arm.L",  True),
    ("DEF-hand.L",        "DEF-forearm.L",    True),
    ("DEF-shoulder.R",    "DEF-spine.003",    False),
    ("DEF-upper_arm.R",   "DEF-shoulder.R",   False),
    ("DEF-forearm.R",     "DEF-upper_arm.R",  True),
    ("DEF-hand.R",        "DEF-forearm.R",    True),
    ("DEF-thigh.L",       "DEF-spine",        False),
    ("DEF-shin.L",        "DEF-thigh.L",      True),
    ("DEF-foot.L",        "DEF-shin.L",       True),
    ("DEF-toe.L",         "DEF-foot.L",       True),
    ("DEF-thigh.R",       "DEF-spine",        False),
    ("DEF-shin.R",        "DEF-thigh.R",      True),
    ("DEF-foot.R",        "DEF-shin.R",       True),
    ("DEF-toe.R",         "DEF-foot.R",       True),
]


def script_args(argv=None):
    argv = list(sys.argv if argv is None else argv)
    return argv[argv.index("--") + 1:] if "--" in argv else []

def parse_args(argv):
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--glb", required=True, help="source GLB (shipped or raw)")
    p.add_argument("--asset-id", required=True)
    p.add_argument("--category", required=True,
                   choices=["bosses", "companions", "enemies", "commander"])
    p.add_argument("--out", required=True, help="destination GLB path")
    p.add_argument("--report", default=None, help="write per-asset JSON log here")
    p.add_argument("--budgets-json", default=None, help="action-pipeline JSON with keyframeBudgets")
    p.add_argument("--rest-pose", default="natural", choices=["tpose", "natural"],
                   help="natural = preserve the sculpted source bind pose; "
                        "tpose = explicit diagnostic bake onto +/-X")
    p.add_argument("--arm-fit", default="tpose", choices=["detect", "prior", "tpose"],
                   help="tpose = fit the horizontal-arm source silhouette; "
                        "detect = PCA for irregular silhouettes; "
                        "prior = anthropometric proportions for arms-down silhouettes")
    p.add_argument("--bind-method", default="auto",
                   choices=["auto", "bone_heat", "inverse_distance"],
                   help="auto = bone_heat -> envelope -> inverse_distance, gated on arm weight")
    p.add_argument("--weld-distance", type=float, default=0.0,
                   help="merge coincident verts before fitting; 0.0 keeps source seams (runtime default)")
    p.add_argument("--save-blend", default=None)
    return p.parse_args(argv)


def load_budgets(path):
    if not path or not Path(path).exists():
        return dict(DEFAULT_BUDGETS)
    raw = json.loads(Path(path).read_text())
    kb = raw.get("keyframeBudgets") or {}
    defs = {d["action"]: d for d in raw.get("actionDefinitions", []) if "action" in d}
    out = {}
    for action, fallback in DEFAULT_BUDGETS.items():
        entry = kb.get(action)
        if not entry:
            out[action] = fallback
            continue
        keyp = entry.get("keyPoses")
        out[action] = {
            "targetFrames": int(entry.get("target", fallback["targetFrames"])),
            "keyPoses": int(keyp.get("min", fallback["keyPoses"])) if isinstance(keyp, dict)
                        else fallback["keyPoses"],
            "loop": bool(defs.get(action, {}).get("loop", fallback["loop"])),
        }
    return out


# ---------------------------------------------------------------------------
# bpy implementation
# ---------------------------------------------------------------------------

def run(args, budgets):
    import bpy
    import bmesh
    import numpy as np
    from mathutils import Vector, Matrix

    log = {"assetId": args.asset_id, "category": args.category, "source": args.glb, "steps": []}

    def step(name, **kw):
        entry = {"step": name}
        entry.update(kw)
        log["steps"].append(entry)
        return entry
    def classify_roll_reference(name):
        for prefix in ("DEF-upper_arm.", "DEF-forearm.", "DEF-hand.", "DEF-shoulder.",
                       "DEF-foot.", "DEF-toe."):
            if name.startswith(prefix):
                return "lateral"
        for prefix in ("DEF-spine", "DEF-pelvis.", "DEF-thigh.", "DEF-shin."):
            if name.startswith(prefix):
                return "axial"
        return "axial"

    def align_def_bone_roll(phase):
        # Canonical roll alignment must run before binding so the armature and
        # initial skinning share the same orientation contract.
        prev_obj = bpy.context.view_layer.objects.active
        prev_mode = prev_obj.mode if prev_obj else "OBJECT"
        if prev_obj is not rig:
            bpy.context.view_layer.objects.active = rig
        if bpy.context.view_layer.objects.active != rig:
            raise RuntimeError("roll alignment failed: failed to activate generated rig")
        if rig.mode != "EDIT":
            bpy.ops.object.mode_set(mode="EDIT")

        eb = rig.data.edit_bones
        local_matrix = rig.matrix_world.to_3x3().inverted()
        axis_ref = {
            "axial": local_matrix @ Vector(ROLL_POLICY["axial"]),
            "lateral": local_matrix @ Vector(ROLL_POLICY["lateral"]),
        }
        reference_policy = {"axial": "+Y", "lateral": "+Z"}
        fallback_ref = Vector((1.0, 0.0, 0.0))
        near_parallel = 0.99995
        report_rows = []
        for name in list(eb.keys()):
            if not name.startswith("DEF-"):
                continue
            ebone = eb[name]
            policy = classify_roll_reference(name)
            ref = axis_ref[policy].normalized()
            bone_vec = ebone.vector.normalized() if ebone.vector.length else Vector((0.0, 1.0, 0.0))
            used = policy
            if abs(bone_vec.dot(ref)) > near_parallel:
                used = f"{policy}Fallback"
                alt = fallback_ref
                if abs(bone_vec.dot(alt.normalized())) > near_parallel:
                    alt = Vector((0.0, 1.0, 0.0))
                ebone.align_roll(alt.normalized())
            else:
                ebone.align_roll(ref)
            report_rows.append({
                "bone": name,
                "policy": used,
                "rollDeg": round(math.degrees(ebone.roll), 4),
            })
        step("roll_alignment", phase=phase, referencePolicy=reference_policy, rows=report_rows)
        if prev_obj:
            bpy.context.view_layer.objects.active = prev_obj
            bpy.ops.object.mode_set(mode=prev_mode)
        else:
            bpy.ops.object.mode_set(mode="OBJECT")
        return report_rows



    # --- 1. Import --------------------------------------------------------
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(args.glb))
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"no mesh in {args.glb}")
    forbidden_named_meshes = [
        obj.name
        for obj in meshes
        if not obj.name.endswith("_pedestal")
        and any(token in obj.name.casefold() for token in FORBIDDEN_SOURCE_TOKENS)
    ]
    if forbidden_named_meshes:
        raise RuntimeError(
            "source contains forbidden terrain/weapon/prop mesh names; "
            f"regenerate a character-only Rodin source: {forbidden_named_meshes}"
        )

    # A previously-rigged GLB re-enters with `<id>_body` / `<id>_pedestal`
    # already split. Reuse that split (re-deriving the pedestal cut would drift
    # the seam between runs) and drop the old armature -- its A-pose rest and
    # nearest-bone weights are exactly what this pass replaces.
    body = next((o for o in meshes if o.name.endswith("_body")), None)
    pedestal = next((o for o in meshes if o.name.endswith("_pedestal")), None)
    reused_split = body is not None

    for o in list(bpy.data.objects):
        if o.type in {"ARMATURE", "EMPTY"}:
            bpy.data.objects.remove(o, do_unlink=True)

    if body is not None:
        for m in list(body.modifiers):
            if m.type == "ARMATURE":
                body.modifiers.remove(m)
        body.vertex_groups.clear()
        body.parent = None
    step("import", meshes=len(meshes), reusedBodySplit=reused_split,
         hadPedestal=pedestal is not None)

    # --- 1b. Derive body/pedestal when the source was never split ----------
    if body is None:
        others = [o for o in bpy.data.objects if o.type == "MESH"]
        bpy.ops.object.select_all(action="DESELECT")
        for o in others:
            o.select_set(True)
        bpy.context.view_layer.objects.active = others[0]
        if len(others) > 1:
            bpy.ops.object.join()
        body = bpy.context.view_layer.objects.active
        pedestal = None

    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # Weld coincident verts: marching-cubes output is fragmented into micro
    # islands, and bone-heat silently yields all-zero vertex groups on those.
    before = len(body.data.vertices)
    merged = False
    if args.weld_distance > 0.0:
        bm = bmesh.new()
        bm.from_mesh(body.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=args.weld_distance)
        bm.to_mesh(body.data)
        body.data.update()
        bm.free()
        merged = len(body.data.vertices) != before
    step("weld", weldDistance=args.weld_distance, vertsBefore=before,
         vertsAfter=len(body.data.vertices), merged=merged)

    # --- 2. Landmark detection --------------------------------------------
    co = np.array([(body.matrix_world @ v.co)[:] for v in body.data.vertices], dtype=float)
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    z_min, z_max = float(z.min()), float(z.max())
    height = z_max - z_min or 1.0
    cx = float(np.median(x))
    cy = float(np.median(y))
    half_span = float(max(x.max() - cx, cx - x.min())) or height * 0.2

    def band(lo_frac, hi_frac):
        m = (z >= z_min + height * lo_frac) & (z <= z_min + height * hi_frac)
        return co[m]

    # Shoulder line: scan the upper torso for the band where the CENTRAL COLUMN
    # is widest. Using full width instead would lock onto the arm span on
    # wide-stance meshes (guard's arms hang out at ~0.62 height, which is what
    # pulled the first implementation's shoulder line down into the ribcage).
    core = half_span * 0.42
    best_frac, best_w = 0.80, -1.0
    for f in np.arange(0.70, 0.90, 0.02):
        b = band(float(f) - 0.03, float(f) + 0.03)
        if len(b) < 12:
            continue
        cxs = b[np.abs(b[:, 0] - cx) <= core]
        if len(cxs) < 8:
            continue
        w = float(cxs[:, 0].max() - cxs[:, 0].min())
        if w > best_w:
            best_w, best_frac = w, float(f)
    shoulder_z = z_min + height * best_frac
    shoulder_half = max(best_w, height * 0.10) / 2.0

    # Per-side arm axis. Two strategies, because they fail in opposite ways.
    #
    # "detect" (PCA over the outboard point cloud): follows the mesh, so it fits
    # bare-armed or mech silhouettes well -- but on a caped character the cape
    # dominates the cloud and the axis lands on the cape's flared edge instead
    # of the arm. Measured on cinder-warden: PCA over the full outboard cloud
    # gives +55.4 deg, over the front half -81.7 deg. It does not converge.
    #
    # "prior" (anthropometric proportions): ignores the mesh and places the arm
    # where a humanoid's arm has to be -- shoulder at 0.82 h, half-width 0.105 h
    # from the midline, arm length 0.36 h. On cinder-warden the mesh half-span
    # at shoulder height is 0.184 but 0.487 at hand height: the ARM hugs the
    # body (x ~ 0.126) and the CAPE is what flares out. The prior lands inside
    # the arm (296 verts at the predicted hand) precisely because it refuses to
    # follow the widest geometry.
    ARM_PRIOR = {"shoulderZFrac": 0.82, "shoulderHalfFrac": 0.105, "lengthFrac": 0.36}
    torso_half = max(shoulder_half * 0.55, half_span * 0.12)
    arm = {}
    arm_debug = {}

    if args.arm_fit == "prior":
        shoulder_z = z_min + height * ARM_PRIOR["shoulderZFrac"]
        torso_half = height * ARM_PRIOR["shoulderHalfFrac"]
        reach = height * ARM_PRIOR["lengthFrac"]
        for side, sgn in (("L", 1.0), ("R", -1.0)):
            # Hangs straight down from the shoulder, slightly outboard -- the
            # sculpted rest pose these characters actually stand in.
            arm[side] = np.array([cx + sgn * torso_half * 1.15, cy, shoulder_z - reach])
            arm_debug[side] = {"mode": "prior", "reach": round(reach, 4)}
    elif args.arm_fit == "tpose":
        # A generated T-pose has a dense, nearly horizontal outboard band.
        # Derive its height from both arm tips instead of the torso-width
        # minimum used for arms-down/caped sources (which resolves to the neck).
        tpose_cloud = co[
            (np.abs(x - cx) > half_span * 0.65)
            & (z >= z_min + height * 0.55)
            & (z <= z_min + height * 0.90)
        ]
        if len(tpose_cloud) < 48:
            raise RuntimeError("arm-fit tpose found no horizontal outboard arm band")
        shoulder_z = float(np.median(tpose_cloud[:, 2]))
        torso_half = min(half_span * 0.33, height * 0.13)
        for side, sgn in (("L", 1.0), ("R", -1.0)):
            side_reach = sgn * (tpose_cloud[:, 0] - cx)
            pts = tpose_cloud[side_reach > half_span * 0.65]
            if len(pts) < 24:
                arm[side] = None
                continue
            reach = float(np.quantile(sgn * (pts[:, 0] - cx), 0.97))
            tips = pts[sgn * (pts[:, 0] - cx) >= reach * 0.92]
            arm[side] = np.array([
                cx + sgn * reach,
                float(np.median(tips[:, 1])),
                float(np.median(tips[:, 2])),
            ])
            arm_debug[side] = {"mode": "tpose", "reach": round(reach, 4),
                               "pts": int(len(pts)), "tips": int(len(tips))}
    else:
        for side, sgn in (("L", 1.0), ("R", -1.0)):
            m = (z <= shoulder_z + height * 0.04) & (z >= z_min + height * 0.20) \
                & (sgn * (x - cx) > torso_half)
            pts = co[m]
            if len(pts) < 24:
                arm[side] = None
                continue
            origin = np.array([cx + sgn * torso_half, cy, shoulder_z])
            rel = pts - pts.mean(axis=0)
            _, _, vt = np.linalg.svd(rel, full_matrices=False)
            axis = vt[0]
            if axis[0] * sgn < 0:                   # orient outward from the torso
                axis = -axis
            proj = (pts - origin) @ axis
            far = float(np.quantile(proj, 0.94))
            arm[side] = origin + axis * far
            arm_debug[side] = {"mode": "detect",
                               "axis": [round(float(v), 3) for v in axis],
                               "reach": round(far, 4), "pts": int(len(pts))}

    # Mirror or synthesize a missing side (cloaked silhouettes with no
    # separated arm, e.g. gate-sovereign's robe).
    synth = []
    for side, sgn in (("L", 1.0), ("R", -1.0)):
        if arm[side] is not None:
            continue
        other = arm["R" if side == "L" else "L"]
        synth.append(side)
        if other is not None:
            arm[side] = np.array([2 * cx - other[0], other[1], other[2]])
        else:
            arm[side] = np.array([cx + sgn * shoulder_half * 1.6, cy, shoulder_z - height * 0.30])

    hip_z = z_min + height * 0.50
    hips = band(0.44, 0.56)
    hip_half = (float(hips[:, 0].max() - hips[:, 0].min()) / 4.0) if len(hips) > 12 \
        else shoulder_half * 0.5
    hip_half = max(hip_half, height * 0.04)

    feet = band(0.0, 0.06)
    foot_y = float(np.median(feet[:, 1])) if len(feet) > 6 else cy

    step("landmarks", height=round(height, 4), shoulderZFrac=round(best_frac, 3),
         shoulderHalfWidth=round(shoulder_half, 4), hipHalfWidth=round(hip_half, 4),
         handL=[round(float(v), 4) for v in arm["L"]],
         handR=[round(float(v), 4) for v in arm["R"]],
         synthesizedArms=synth, center=[round(cx, 4), round(cy, 4)])

    # --- 3. Build the deform armature, fitted to those landmarks -----------
    arm_data = bpy.data.armatures.new(f"{args.asset_id}_skel")
    rig = bpy.data.objects.new(f"{args.asset_id}_armature", arm_data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones

    torso_span = shoulder_z - hip_z
    head_span = max(z_max - shoulder_z, height * 0.08)
    spine_z = [
        hip_z,
        hip_z + torso_span * 0.34,
        hip_z + torso_span * 0.66,
        shoulder_z,
        shoulder_z + head_span * 0.32,
        shoulder_z + head_span * 0.55,
        shoulder_z + head_span * 0.98,
    ]

    pos = {}
    for i in range(6):
        pos[f"DEF-spine.00{i}" if i else "DEF-spine"] = (
            Vector((cx, cy, spine_z[i])), Vector((cx, cy, spine_z[i + 1])))

    arm_fit = {}
    for side, sgn in (("L", 1.0), ("R", -1.0)):
        hand_pt = Vector([float(v) for v in arm[side]])
        shoulder_pt = Vector((cx + sgn * torso_half, cy, shoulder_z))
        axis = hand_pt - shoulder_pt
        if axis.length < 1e-5:
            axis = Vector((sgn * half_span, 0.0, 0.0))
            hand_pt = shoulder_pt + axis
        pos[f"DEF-shoulder.{side}"] = (
            Vector((cx + sgn * torso_half * 0.2, cy, shoulder_z)), shoulder_pt)
        pos[f"DEF-upper_arm.{side}"] = (shoulder_pt, shoulder_pt + axis * 0.48)
        pos[f"DEF-forearm.{side}"] = (shoulder_pt + axis * 0.48, shoulder_pt + axis * 0.86)
        pos[f"DEF-hand.{side}"] = (shoulder_pt + axis * 0.86, hand_pt)
        pos[f"DEF-pelvis.{side}"] = (
            Vector((cx, cy, hip_z)),
            Vector((cx + sgn * hip_half, cy - height * 0.03, hip_z + height * 0.07)))

        hx = cx + sgn * hip_half
        knee_z = z_min + height * 0.27
        ankle_z = z_min + height * 0.06
        pos[f"DEF-thigh.{side}"] = (Vector((hx, cy, hip_z)), Vector((hx, cy, knee_z)))
        pos[f"DEF-shin.{side}"] = (Vector((hx, cy, knee_z)), Vector((hx, cy, ankle_z)))
        pos[f"DEF-foot.{side}"] = (Vector((hx, cy, ankle_z)),
                                   Vector((hx, foot_y - height * 0.04, z_min + height * 0.015)))
        pos[f"DEF-toe.{side}"] = (Vector((hx, foot_y - height * 0.04, z_min + height * 0.015)),
                                  Vector((hx, foot_y - height * 0.09, z_min + height * 0.01)))
        arm_fit[side] = {"restAngleDeg": round(
            math.degrees(math.atan2(-axis.z, math.hypot(axis.x, axis.y))), 2),
            "length": round(axis.length, 4)}

    for name, parent, connect in SKELETON:
        head, tail = pos[name]
        b = eb.new(name)
        b.head, b.tail = head, tail
        if (tail - head).length < 1e-4:                 # never emit a zero-length bone
            b.tail = head + Vector((0.0, 0.0, height * 0.01))
        b.use_deform = True
    for name, parent, connect in SKELETON:
        if parent:
            eb[name].parent = eb[parent]
            eb[name].use_connect = connect
    # Roll is aligned to contract now, before any binding happens.
    pre_bind_roll = align_def_bone_roll("pre_bind")
    bpy.ops.object.mode_set(mode="OBJECT")
    step("armature_fit", mode=args.arm_fit, bones=len(arm_data.bones), shoulderZ=round(shoulder_z, 4), arms=arm_fit,
         preBindRollCount=len(pre_bind_roll))

    # --- 4. Bind in the mesh's natural pose --------------------------------
    # Bone-heat ("Automatic Weights") is the quality option but it fails hard
    # and SILENTLY on Rodin output: cinder-warden.glb weights 0 of 10,898 verts
    # because the surface is still non-manifold after welding. Envelope
    # weighting is next, and a deterministic inverse-distance skin is the
    # guaranteed floor -- an asset must never leave this step unweighted.
    def measure_weights():
        totals_ = {}
        for v in body.data.vertices:
            for g in v.groups:
                if g.weight > 1e-4:
                    n = body.vertex_groups[g.group].name
                    totals_[n] = totals_.get(n, 0.0) + g.weight
        n_weighted = sum(1 for v in body.data.vertices
                         if any(g.weight > 1e-4 for g in v.groups))
        return totals_, n_weighted

    def parent_with(mode):
        bpy.ops.object.select_all(action="DESELECT")
        body.select_set(True)
        rig.select_set(True)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.parent_set(type=mode)

    n_verts = len(body.data.vertices)

    def inverse_distance_skin():
        """Deterministic inverse-square-distance skin over the K nearest bones.

        Independent of mesh topology, so it survives the non-manifold and
        fragmented geometry that kills bone-heat. Also keeps limb bones
        dominant over the spine on fused silhouettes, because distance to the
        arm bone inside the arm is far smaller than distance to the spine.
        """
        body.vertex_groups.clear()
        for mm in [m for m in body.modifiers if m.type == "ARMATURE"]:
            body.modifiers.remove(mm)
        names = [b.name for b in rig.data.bones]
        groups = {n: body.vertex_groups.new(name=n) for n in names}
        heads = np.array([list(b.head_local) for b in rig.data.bones])
        tails = np.array([list(b.tail_local) for b in rig.data.bones])
        seg = tails - heads
        seg_len2 = np.maximum(np.einsum("ij,ij->i", seg, seg), 1e-12)
        mw = np.array(body.matrix_world)
        pts = np.array([list(v.co) for v in body.data.vertices])
        pts = pts @ mw[:3, :3].T + mw[:3, 3]
        K = 4
        per_bone = {n: ([], []) for n in names}
        for vi in range(len(pts)):
            p = pts[vi]
            t = np.clip(np.einsum("ij,ij->i", p - heads, seg) / seg_len2, 0.0, 1.0)
            d = np.linalg.norm(p - (heads + seg * t[:, None]), axis=1)
            idx = np.argpartition(d, K)[:K]
            w = 1.0 / np.maximum(d[idx], 1e-5) ** 2
            w /= w.sum()
            for j, wi in zip(idx, w):
                if wi > 1e-3:
                    per_bone[names[j]][0].append(vi)
                    per_bone[names[j]][1].append(float(wi))
        for n, (idxs, ws) in per_bone.items():
            for vi, wi in zip(idxs, ws):
                groups[n].add([vi], wi, "REPLACE")
        mod = body.modifiers.new(name="Armature", type="ARMATURE")
        mod.object = rig
        body.parent = rig
        body.matrix_parent_inverse = rig.matrix_world.inverted()

    def arm_weight_fraction(totals_):
        """Share of all weight owned by the arm chains.

        The number that actually predicts whether posing the arms moves the
        mesh. Bone-heat/envelope can report every vertex weighted while giving
        the arm bones almost nothing (arm verts captured by the spine), and
        then the T-pose rotation visibly does nothing.
        """
        total = sum(totals_.values()) or 1.0
        armw = sum(w for n, w in totals_.items()
                   if any(k in n for k in ("upper_arm", "forearm", "hand", "shoulder")))
        return armw / total

    ARM_WEIGHT_FLOOR = 0.10
    attempts = []
    if args.bind_method in ("auto", "bone_heat"):
        parent_with("ARMATURE_AUTO")
        totals, weighted = measure_weights()
        attempts.append(("bone_heat", weighted, round(arm_weight_fraction(totals), 4)))
        method = "bone_heat"
    else:
        totals, weighted, method = {}, 0, None

    def ok(tot, wt):
        return wt >= n_verts * 0.5 and arm_weight_fraction(tot) >= ARM_WEIGHT_FLOOR

    if args.bind_method == "auto" and not ok(totals, weighted):
        body.vertex_groups.clear()
        parent_with("ARMATURE_ENVELOPE")
        totals, weighted = measure_weights()
        attempts.append(("envelope", weighted, round(arm_weight_fraction(totals), 4)))
        method = "envelope"

    if args.bind_method == "inverse_distance" or (
            args.bind_method == "auto" and not ok(totals, weighted)):
        inverse_distance_skin()
        totals, weighted = measure_weights()
        attempts.append(("inverse_distance", weighted, round(arm_weight_fraction(totals), 4)))
        method = "inverse_distance"

    # Fill any vertex the chosen method left unweighted. glTF export has no
    # concept of an unskinned vertex inside a skinned primitive, so the
    # exporter invents a `neutral_bone` and parks them all on it -- they then
    # ignore every clip and tear away from the animated body (dusk-warden shed
    # 106 of 538 verts onto neutral_bone this way, 21.9% of its total weight).
    heads_np = np.array([list(b.head_local) for b in rig.data.bones])
    tails_np = np.array([list(b.tail_local) for b in rig.data.bones])
    bone_names = [b.name for b in rig.data.bones]
    seg_np = tails_np - heads_np
    seg_l2 = np.maximum(np.einsum("ij,ij->i", seg_np, seg_np), 1e-12)
    mw_np = np.array(body.matrix_world)
    orphans = [v.index for v in body.data.vertices
               if not any(g.weight > 1e-4 for g in v.groups)]
    for vi in orphans:
        p = mw_np[:3, :3] @ np.array(body.data.vertices[vi].co) + mw_np[:3, 3]
        t = np.clip(np.einsum("ij,ij->i", p - heads_np, seg_np) / seg_l2, 0.0, 1.0)
        d = np.linalg.norm(p - (heads_np + seg_np * t[:, None]), axis=1)
        name = bone_names[int(np.argmin(d))]
        vg = body.vertex_groups.get(name) or body.vertex_groups.new(name=name)
        vg.add([vi], 1.0, "REPLACE")
    if orphans:
        totals, weighted = measure_weights()
    step("orphan_fill", filled=len(orphans))

    step("bind", method=method, boundGroups=len(totals), weightedVerts=weighted,
         totalVerts=n_verts, armWeightFrac=round(arm_weight_fraction(totals), 4),
         attempts=attempts,
         topWeights=sorted(((round(w, 1), n) for n, w in totals.items()), reverse=True)[:5])
    if weighted < n_verts * 0.5:
        raise RuntimeError(f"all weighting methods failed: {weighted}/{n_verts} verts")

    # Only diagnostic T-pose generation changes rest geometry. Natural pose
    # assets retain the source bind, avoiding rubbery deformation of welded
    # capes, pauldrons, and weapons.
    rotated = {}
    if args.rest_pose == "tpose":
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.mode_set(mode="POSE")
        for side, sgn in (("L", 1.0), ("R", -1.0)):
            ua = rig.pose.bones.get(f"DEF-upper_arm.{side}")
            ub = rig.data.bones.get(f"DEF-upper_arm.{side}")
            hb = rig.data.bones.get(f"DEF-hand.{side}")
            if not (ua and ub and hb):
                continue
            cur = hb.tail_local - ub.head_local
            if cur.length < 1e-6:
                continue
            cur.normalize()
            target = Vector((sgn, 0.0, 0.0))
            delta = math.degrees(cur.angle(target))
            if delta < 0.5:
                rotated[side] = 0.0
                continue
            R = cur.rotation_difference(target).to_matrix().to_4x4()
            pivot = ub.head_local.copy()
            M = ua.matrix.copy()
            M.translation -= pivot
            M = R @ M
            M.translation += pivot
            ua.matrix = M
            bpy.context.view_layer.update()
            rotated[side] = round(delta, 2)

        # T-pose is diagnostic-only. Bake the posed mesh before its rest pose
        # changes, otherwise the mesh/skeleton pair diverges on export.
        bpy.ops.object.mode_set(mode="OBJECT")
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.select_all(action="DESELECT")
        body.select_set(True)
        for m in [mm for mm in body.modifiers if mm.type == "ARMATURE"]:
            bpy.ops.object.modifier_apply(modifier=m.name)

        bpy.ops.object.select_all(action="DESELECT")
        rig.select_set(True)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.mode_set(mode="POSE")
        bpy.ops.pose.select_all(action="SELECT")
        bpy.ops.pose.armature_apply(selected=False)
        bpy.ops.object.mode_set(mode="OBJECT")

        final_rest_roll = align_def_bone_roll("post_tpose_rest")
        if not final_rest_roll:
            raise RuntimeError("roll invariant failed: expected DEF bones after post-T-pose roll alignment")
        newmod = body.modifiers.new(name="Armature", type="ARMATURE")
        newmod.object = rig
        body.parent = rig
        body.matrix_parent_inverse = rig.matrix_world.inverted()
    else:
        # The natural source pose is already fitted before binding.
        final_rest_roll = []
    # Collapse every vertex onto its original dominant DEF bone plus at most
    # one directly parent/child-adjacent DEF bone. This repairs cross-branch
    # heat/envelope leakage without turning the character into rigid chunks.
    def repair_adjacent_def_weights():
        def_names = [
            name for name, _, _ in SKELETON
            if rig.data.bones.get(name) is not None
            and rig.data.bones[name].use_deform
        ]
        if not def_names:
            raise RuntimeError("adjacent weight repair failed: rig has no DEF bones")

        def_rank = {name: index for index, name in enumerate(def_names)}
        def_set = set(def_names)
        adjacency = {name: [] for name in def_names}
        for name in def_names:
            parent = rig.data.bones[name].parent
            if parent is not None and parent.name in def_set:
                adjacency[name].append(parent.name)
                adjacency[parent.name].append(name)
        for name in def_names:
            adjacency[name].sort(key=def_rank.__getitem__)

        for name in def_names:
            if body.vertex_groups.get(name) is None:
                body.vertex_groups.new(name=name)
        source_group_names = [group.name for group in body.vertex_groups]

        armature_modifiers = [m for m in body.modifiers if m.type == "ARMATURE"]
        target_modifier = next((m for m in armature_modifiers if m.object == rig), None)
        if target_modifier is None:
            target_modifier = (
                armature_modifiers[0]
                if armature_modifiers
                else body.modifiers.new(name="Armature", type="ARMATURE")
            )
            target_modifier.object = rig
        for modifier in list(armature_modifiers):
            if modifier != target_modifier:
                body.modifiers.remove(modifier)
        target_modifier.show_viewport = True
        target_modifier.show_render = True

        body_to_world = np.array(body.matrix_world)
        vertex_world = np.array(
            [list(vertex.co) for vertex in body.data.vertices], dtype=float
        )
        vertex_world = (
            vertex_world @ body_to_world[:3, :3].T + body_to_world[:3, 3]
        )
        world_to_rig = np.linalg.inv(np.array(rig.matrix_world))
        vertex_rig_local = (
            np.c_[vertex_world, np.ones(len(vertex_world))] @ world_to_rig.T
        )[:, :3]

        heads = np.array([
            list(rig.data.bones[name].head_local) for name in def_names
        ])
        tails = np.array([
            list(rig.data.bones[name].tail_local) for name in def_names
        ])
        segments = tails - heads
        segment_lengths_sq = np.maximum(
            np.einsum("ij,ij->i", segments, segments), 1e-12
        )

        def influence_histogram():
            counts = {}
            for vertex in body.data.vertices:
                count = sum(
                    1 for element in vertex.groups
                    if math.isfinite(element.weight)
                    and element.weight > WEIGHT_EPSILON
                )
                key = str(count)
                counts[key] = counts.get(key, 0) + 1
            return dict(sorted(counts.items(), key=lambda item: int(item[0])))

        before_histogram = influence_histogram()
        fallback_reasons = {}

        def record_fallback(reason):
            fallback_reasons[reason] = fallback_reasons.get(reason, 0) + 1

        def nearest_def_name(point):
            projection = np.clip(
                np.einsum("ij,ij->i", point - heads, segments)
                / segment_lengths_sq,
                0.0,
                1.0,
            )
            distances = np.linalg.norm(
                point - (heads + segments * projection[:, None]), axis=1
            )
            return def_names[int(np.argmin(distances))]

        def nearest_adjacent_name(dominant_name, point):
            ranked = []
            dominant_bone = rig.data.bones[dominant_name]
            for candidate_name in adjacency[dominant_name]:
                candidate = rig.data.bones[candidate_name]
                joint = (
                    np.array(candidate.head_local)
                    if candidate.parent == dominant_bone
                    else np.array(dominant_bone.head_local)
                )
                ranked.append((
                    float(np.linalg.norm(point - joint)),
                    def_rank[candidate_name],
                    candidate_name,
                ))
            ranked.sort()
            return ranked[0][2] if ranked else None
        def is_distal_rigid_tip(dominant_name, point):
            if dominant_name not in DISTAL_RIGID_BONES:
                return False
            index = def_rank[dominant_name]
            projection = float(np.clip(
                np.dot(point - heads[index], segments[index])
                / segment_lengths_sq[index],
                0.0,
                1.0,
            ))
            return projection >= DISTAL_RIGID_START

        repaired_vertices = 0
        dropped_vertices = 0
        dropped_influences = 0
        dropped_weight = 0.0
        synthesized_count = 0
        retained_adjacent_count = 0
        original_dominants = {}

        for vertex in body.data.vertices:
            original = []
            for element in vertex.groups:
                name = (
                    source_group_names[element.group]
                    if 0 <= element.group < len(source_group_names)
                    else f"<invalid:{element.group}>"
                )
                if math.isfinite(element.weight) and element.weight > WEIGHT_EPSILON:
                    original.append((name, float(element.weight)))

            valid = [
                (name, weight) for name, weight in original if name in def_set
            ]
            original_map = {name: weight for name, weight in original}
            point = vertex_rig_local[vertex.index]
            existing_secondary = None

            if not valid:
                dominant_name = nearest_def_name(point)
                new_weights = {dominant_name: 1.0}
                original_dominants[vertex.index] = None
                record_fallback("orphan_nearest_def")
            else:
                dominant_name, dominant_weight = min(
                    valid, key=lambda item: (-item[1], def_rank[item[0]])
                )
                original_dominants[vertex.index] = dominant_name
                adjacent_existing = [
                    (name, weight)
                    for name, weight in valid
                    if name != dominant_name
                    and name in adjacency[dominant_name]
                    and weight >= ADJACENT_SECONDARY_MIN
                ]
                if adjacent_existing:
                    existing_secondary, secondary_weight = min(
                        adjacent_existing,
                        key=lambda item: (-item[1], def_rank[item[0]]),
                    )
                    pair_sum = dominant_weight + secondary_weight
                    normalized_secondary = secondary_weight / pair_sum
                    if normalized_secondary < MEANINGFUL_SECONDARY_MIN:
                        normalized_secondary = MEANINGFUL_SECONDARY_MIN
                    new_weights = {
                        dominant_name: 1.0 - normalized_secondary,
                        existing_secondary: normalized_secondary,
                    }
                    retained_adjacent_count += 1
                else:
                    valid_total = sum(weight for _, weight in valid)
                    nonadjacent_dropped_fraction = (
                        sum(
                            weight for name, weight in valid
                            if name != dominant_name
                            and name not in adjacency[dominant_name]
                        ) / valid_total
                        if valid_total > 0.0
                        else 0.0
                    )
                    if nonadjacent_dropped_fraction >= DROPPED_MASS_SYNTHESIS_MIN:
                        synthesized_secondary = nearest_adjacent_name(
                            dominant_name, point
                        )
                        if synthesized_secondary is None:
                            new_weights = {dominant_name: 1.0}
                            record_fallback("no_incident_adjacent_bone")
                        else:
                            secondary_weight = min(
                                SYNTH_SECONDARY_MAX,
                                max(
                                    SYNTH_SECONDARY_MIN,
                                    nonadjacent_dropped_fraction,
                                ),
                            )
                            new_weights = {
                                dominant_name: 1.0 - secondary_weight,
                                synthesized_secondary: secondary_weight,
                            }
                            synthesized_count += 1
                    else:
                        synthesized_secondary = nearest_adjacent_name(
                            dominant_name, point
                        )
                        if synthesized_secondary is None:
                            new_weights = {dominant_name: 1.0}
                            record_fallback("no_incident_adjacent_bone")
                        elif is_distal_rigid_tip(dominant_name, point):
                            new_weights = {dominant_name: 1.0}
                            record_fallback("distal_tip_rigid")
                        else:
                            new_weights = {
                                dominant_name: 1.0 - SYNTH_SECONDARY_MIN,
                                synthesized_secondary: SYNTH_SECONDARY_MIN,
                            }
                            synthesized_count += 1
                            record_fallback("rigid_or_weak_secondary_repaired")

            kept_original = {dominant_name}
            if existing_secondary is not None:
                kept_original.add(existing_secondary)
            vertex_dropped = [
                (name, weight)
                for name, weight in original
                if name not in kept_original
            ]
            if vertex_dropped:
                dropped_vertices += 1
                dropped_influences += len(vertex_dropped)
                dropped_weight += sum(weight for _, weight in vertex_dropped)

            all_names = set(original_map) | set(new_weights)
            if any(
                abs(
                    original_map.get(name, 0.0)
                    - new_weights.get(name, 0.0)
                ) > WEIGHT_EPSILON
                for name in all_names
            ):
                repaired_vertices += 1

            for group_index in [
                element.group for element in list(vertex.groups)
            ]:
                if 0 <= group_index < len(body.vertex_groups):
                    body.vertex_groups[group_index].remove([vertex.index])
            for name, weight in new_weights.items():
                body.vertex_groups[name].add(
                    [vertex.index], weight, "REPLACE"
                )

        for group in list(body.vertex_groups):
            if group.name not in def_set:
                body.vertex_groups.remove(group)

        after_histogram = influence_histogram()
        final_group_names = [group.name for group in body.vertex_groups]
        invalid_count = 0
        orphan_count = 0
        non_def_count = 0
        dominant_violation_count = 0
        max_influences = 0
        max_weight_sum_error = 0.0
        max_hierarchy_spread = 0
        single_influence_vertices = 0

        for vertex in body.data.vertices:
            pairs = [
                (final_group_names[element.group], float(element.weight))
                for element in vertex.groups
                if 0 <= element.group < len(final_group_names)
                and math.isfinite(element.weight)
                and element.weight > WEIGHT_EPSILON
            ]
            if not pairs:
                orphan_count += 1
                continue
            if any(name not in def_set for name, _ in pairs):
                non_def_count += 1
            if any(
                not math.isfinite(weight) or weight <= 0.0
                for _, weight in pairs
            ):
                invalid_count += 1
            max_influences = max(max_influences, len(pairs))
            if len(pairs) == 1:
                single_influence_vertices += 1
                spread = 0
            elif (
                len(pairs) == 2
                and pairs[1][0] in adjacency[pairs[0][0]]
            ):
                spread = 1
            else:
                spread = len(def_names) + 1
            max_hierarchy_spread = max(max_hierarchy_spread, spread)
            max_weight_sum_error = max(
                max_weight_sum_error,
                abs(sum(weight for _, weight in pairs) - 1.0),
            )
            expected_dominant = original_dominants[vertex.index]
            stable_dominant = min(
                pairs, key=lambda item: (-item[1], def_rank[item[0]])
            )[0]
            if (
                expected_dominant is not None
                and stable_dominant != expected_dominant
            ):
                dominant_violation_count += 1

        total_vertices = len(body.data.vertices)
        single_influence_fraction = (
            single_influence_vertices / total_vertices
            if total_vertices
            else 0.0
        )
        enabled_modifiers = [
            modifier for modifier in body.modifiers
            if modifier.type == "ARMATURE"
            and modifier.show_viewport
            and modifier.object == rig
        ]
        return {
            "policy": "original_dominant_plus_one_direct_parent_or_child",
            "influenceHistogramBefore": before_histogram,
            "influenceHistogramAfter": after_histogram,
            "repairedVertices": repaired_vertices,
            "droppedVertices": dropped_vertices,
            "droppedInfluences": dropped_influences,
            "droppedWeight": round(dropped_weight, 8),
            "synthesizedCount": synthesized_count,
            "retainedAdjacentCount": retained_adjacent_count,
            "fallbackReasons": dict(sorted(fallback_reasons.items())),
            "enabledArmatureModifiers": len(enabled_modifiers),
            "invalidCount": invalid_count,
            "orphanCount": orphan_count,
            "nonDefCount": non_def_count,
            "dominantViolationCount": dominant_violation_count,
            "maxInfluences": max_influences,
            "maxWeightSumError": max_weight_sum_error,
            "maxHierarchySpread": max_hierarchy_spread,
            "singleInfluenceVertices": single_influence_vertices,
            "singleInfluenceFraction": round(
                single_influence_fraction, 6
            ),
            "vertices": total_vertices,
        }

    weights_report = repair_adjacent_def_weights()
    if weights_report["enabledArmatureModifiers"] != 1:
        raise RuntimeError(
            "weight invariant failed: expected exactly one enabled target "
            "Armature modifier"
        )
    if weights_report["invalidCount"] != 0:
        raise RuntimeError(
            f"weight invariant failed: "
            f"{weights_report['invalidCount']} invalid vertices"
        )
    if weights_report["nonDefCount"] != 0:
        raise RuntimeError(
            f"weight invariant failed: "
            f"{weights_report['nonDefCount']} vertices with non-DEF groups"
        )
    if weights_report["orphanCount"] != 0:
        raise RuntimeError(
            f"weight invariant failed: "
            f"{weights_report['orphanCount']} orphan vertices after repair"
        )
    if weights_report["dominantViolationCount"] != 0:
        raise RuntimeError(
            "weight invariant failed: original dominant DEF ownership changed"
        )
    if weights_report["maxInfluences"] > 2:
        raise RuntimeError(
            f"weight invariant failed: "
            f"{weights_report['maxInfluences']} max influences > 2"
        )
    if weights_report["maxWeightSumError"] > 1e-6:
        raise RuntimeError(
            "weight invariant failed: normalized sum error exceeds 1e-6"
        )
    if weights_report["maxHierarchySpread"] > 1:
        raise RuntimeError(
            "weight invariant failed: retained bones are not direct "
            "hierarchy neighbors"
        )
    step(
        "adjacent_weight_repair",
        status="completed",
        **weights_report,
    )

    # A natural bind does not need a horizontal-arm condition. Retain the
    # measurement for diagnostics, but gate only the explicit T-pose mode.
    achieved = {}
    elevation = {}
    for side, sgn in (("L", 1.0), ("R", -1.0)):
        ub = rig.data.bones.get(f"DEF-upper_arm.{side}")
        hb = rig.data.bones.get(f"DEF-hand.{side}")
        if not (ub and hb):
            continue
        v = hb.tail_local - ub.head_local
        elevation[side] = round(math.degrees(math.atan2(-v.z, math.hypot(v.x, v.y))), 2)
        if v.length > 1e-6:
            achieved[side] = round(math.degrees(v.angle(Vector((sgn, 0.0, 0.0)))), 2)
    rest_pose_ok = (
        args.rest_pose == "natural"
        or (bool(achieved) and all(abs(v) <= TPOSE_TOLERANCE_DEG for v in achieved.values()))
    )
    step("rest_pose", mode=args.rest_pose, rotatedDeg=rotated,
         axisDeviationDeg=achieved, elevationDeg=elevation,
         tposeToleranceDeg=TPOSE_TOLERANCE_DEG, ok=rest_pose_ok)

    # --- 6. Author the 11-clip action library ------------------------------
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    pb = rig.pose.bones

    def bone(name):
        b = pb.get(name)
        if b and b.rotation_mode == "QUATERNION":
            b.rotation_mode = "XYZ"
        return b

    chest = bone("DEF-spine.002")
    head_b = bone("DEF-spine.005")
    arms = {s: bone(f"DEF-upper_arm.{s}") for s in "LR"}
    fores = {s: bone(f"DEF-forearm.{s}") for s in "LR"}
    thighs = {s: bone(f"DEF-thigh.{s}") for s in "LR"}

    # Per-action pose recipes, in degrees, keyed by the action-pipeline's
    # signaturePoses (production/boss-motion-previs-action-pipeline.json).
    # Each entry drives one channel; the envelope below scales them across the
    # clip. A single shared amplitude (the previous approach) made every clip
    # the same motion at a different size, and at the battle camera's distance
    # a 2.2 deg idle moved ~0.2% of the frame -- effectively invisible.
    #
    #   torsoPitch  forward/back lean          armSwing  shoulder swing, mirrored
    #   torsoTwist  yaw about the spine        armLift   both arms out/up
    #   headTurn    look direction             elbow     forearm bend
    #   legStride   thigh counter-swing (walk/run cycles)
    RECIPES = {
        "idle":     dict(torsoPitch=3.5,  headTurn=6.0,  armSwing=5.0,  elbow=4.0),
        "move":     dict(torsoPitch=6.0,  armSwing=18.0, elbow=10.0, legStride=22.0),
        "run":      dict(torsoPitch=14.0, armSwing=34.0, elbow=22.0, legStride=42.0),
        "hit":      dict(torsoPitch=-18.0, torsoTwist=10.0, armSwing=-14.0, headTurn=-12.0),
        "bighit":   dict(torsoPitch=-30.0, torsoTwist=18.0, armSwing=-24.0, headTurn=-20.0),
        "attack":   dict(torsoTwist=32.0, armSwing=48.0, elbow=34.0, torsoPitch=10.0),
        "critical": dict(torsoTwist=40.0, armSwing=60.0, elbow=42.0, torsoPitch=16.0),
        "avoid":    dict(torsoTwist=-28.0, torsoPitch=12.0, armSwing=-20.0, legStride=18.0),
        "defence":  dict(torsoPitch=14.0, armLift=42.0,  elbow=52.0, headTurn=-8.0),
        "die":      dict(torsoPitch=-52.0, torsoTwist=22.0, armSwing=-30.0, headTurn=-26.0),
        "show":     dict(torsoPitch=-12.0, armLift=55.0, torsoTwist=14.0, headTurn=10.0),
    }
    # From a T-pose rest the arms must swing DOWN into a combat-ready
    # silhouette; a natural rest already holds them down, and adding the offset
    # there would fold them through the torso.
    ARM_DOWN = math.radians(58.0) if args.rest_pose == "tpose" else 0.0

    rig.animation_data_create()
    authored = []
    for action_name, budget in budgets.items():
        dur = int(budget["targetFrames"])
        loop = bool(budget.get("loop", False))
        clip_id = f"{args.asset_id}::{action_name}::v01"
        act = bpy.data.actions.get(clip_id) or bpy.data.actions.new(name=clip_id)
        act.use_fake_user = True
        rig.animation_data.action = act
        n_keys = max(3, int(budget.get("keyPoses", 4)))
        rec = RECIPES.get(action_name, RECIPES["idle"])
        g = lambda k: math.radians(rec.get(k, 0.0))

        for k in range(n_keys):
            t = k / (n_keys - 1)
            frame = round(1 + (dur - 1) * t)
            if loop:
                # Full sine cycle: locomotion swings through neutral to the
                # opposite extreme and back, so the clip tiles seamlessly and
                # left/right limbs alternate instead of pumping in unison.
                env = math.sin(2 * math.pi * t)
                stride = math.sin(2 * math.pi * t)
            else:
                # Anticipation -> peak at 40% -> settle, holding ~35% of the
                # peak at the end so clampWhenFinished leaves a readable pose.
                if t < 0.4:
                    env = -0.25 + 1.25 * (t / 0.4)
                else:
                    env = 1.0 - 0.65 * ((t - 0.4) / 0.6)
                stride = env

            if chest:
                chest.rotation_euler = (g("torsoPitch") * env, 0.0, g("torsoTwist") * env)
                chest.keyframe_insert("rotation_euler", frame=frame)
            if head_b:
                head_b.rotation_euler = (0.0, g("headTurn") * env, -g("torsoTwist") * env * 0.4)
                head_b.keyframe_insert("rotation_euler", frame=frame)
            for s, sgn in (("L", 1.0), ("R", -1.0)):
                a = arms[s]
                if a:
                    # armSwing alternates per side (walk/punch); armLift raises
                    # both together (guard, reveal).
                    swing = g("armSwing") * env * sgn
                    lift = g("armLift") * abs(env)
                    a.rotation_euler = (swing, sgn * (ARM_DOWN + lift), 0.0)
                    a.keyframe_insert("rotation_euler", frame=frame)
                f = fores[s]
                if f:
                    f.rotation_euler = (g("elbow") * abs(env), 0.0, 0.0)
                    f.keyframe_insert("rotation_euler", frame=frame)
            if rec.get("legStride"):
                for s, sgn in (("L", 1.0), ("R", -1.0)):
                    th = thighs[s]
                    if th:
                        th.rotation_euler = (g("legStride") * stride * sgn, 0.0, 0.0)
                        th.keyframe_insert("rotation_euler", frame=frame)

        # Blender 5.x moved F-Curves behind Action slots/layers/strips; the
        # flat `action.fcurves` of 4.x is gone. Walk whichever shape exists.
        def iter_fcurves(action):
            flat = getattr(action, "fcurves", None)
            if flat is not None:
                yield from flat
                return
            for layer in getattr(action, "layers", []):
                for strip in getattr(layer, "strips", []):
                    for cbag in getattr(strip, "channelbags", []):
                        yield from getattr(cbag, "fcurves", [])

        for fc in iter_fcurves(act):
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"
                kp.easing = "AUTO"

        track = rig.animation_data.nla_tracks.new()
        track.name = clip_id
        track.strips.new(name=act.name, start=1, action=act)
        rig.animation_data.action = None
        authored.append(clip_id)

    bpy.ops.object.mode_set(mode="OBJECT")
    step("author_animations", count=len(authored), clips=authored)
    if not rest_pose_ok:
        raise RuntimeError(f"{args.rest_pose} rest-pose gate failed: axisDeviationDeg={achieved}")


    pedestal_removed = pedestal is not None
    if pedestal is not None:
        bpy.data.objects.remove(pedestal, do_unlink=True)
        pedestal = None

    def partition_semantic_faces():
        bone_to_region = {}
        for region_index, region_name in enumerate(SEMANTIC_REGION_ORDER):
            for bone_name in SEMANTIC_REGION_BONES[region_name]:
                if bone_name in bone_to_region:
                    raise RuntimeError(
                        f"semantic partition map duplicates bone {bone_name}"
                    )
                bone_to_region[bone_name] = region_index

        deform_bones = {
            bone.name for bone in rig.data.bones if bone.use_deform
        }
        unmapped_bones = sorted(deform_bones - set(bone_to_region))
        if unmapped_bones:
            raise RuntimeError(
                f"semantic partition has unmapped DEF bones: {unmapped_bones}"
            )

        group_names = [group.name for group in body.vertex_groups]
        source_weights = []
        for vertex in body.data.vertices:
            weights = {
                group_names[element.group]: float(element.weight)
                for element in vertex.groups
                if 0 <= element.group < len(group_names)
                and group_names[element.group] in deform_bones
                and math.isfinite(element.weight)
                and element.weight > WEIGHT_EPSILON
            }
            if not weights:
                raise RuntimeError(
                    f"semantic partition found orphan source vertex {vertex.index}"
                )
            source_weights.append(weights)

        source_faces = len(body.data.polygons)
        source_vertices = len(body.data.vertices)
        source_positions = [
            body.matrix_world @ vertex.co.copy()
            for vertex in body.data.vertices
        ]
        source_material_indices = {
            polygon.index: int(polygon.material_index)
            for polygon in body.data.polygons
        }
        def uv_coordinate(layer, loop_index):
            modern_values = getattr(layer, "uv", None)
            if modern_values is not None:
                return tuple(
                    float(value)
                    for value in modern_values[loop_index].vector
                )
            return tuple(
                float(value) for value in layer.data[loop_index].uv
            )

        source_uv_layers = [layer.name for layer in body.data.uv_layers]
        source_uvs = {
            polygon.index: {
                layer.name: [
                    uv_coordinate(layer, loop_index)
                    for loop_index in polygon.loop_indices
                ]
                for layer in body.data.uv_layers
            }
            for polygon in body.data.polygons
        }

        def material_key(mesh, material_index):
            material = (
                mesh.materials[material_index]
                if 0 <= material_index < len(mesh.materials)
                else None
            )
            material_name = material.name if material is not None else "<none>"
            return f"{material_index}:{material_name}"

        def material_histogram(objects):
            histogram = {}
            for obj in objects:
                for polygon in obj.data.polygons:
                    key = material_key(obj.data, int(polygon.material_index))
                    histogram[key] = histogram.get(key, 0) + 1
            return dict(sorted(histogram.items()))

        material_before = material_histogram([body])
        region_face_indices = {
            region_name: [] for region_name in SEMANTIC_REGION_ORDER
        }
        region_source_vertices = {
            region_name: set() for region_name in SEMANTIC_REGION_ORDER
        }
        vertex_regions = [set() for _ in body.data.vertices]
        polygon_regions = {}

        for polygon in body.data.polygons:
            scores = [0.0] * len(SEMANTIC_REGION_ORDER)
            for vertex_index in polygon.vertices:
                for bone_name, weight in source_weights[vertex_index].items():
                    scores[bone_to_region[bone_name]] += weight
            region_index = max(
                range(len(SEMANTIC_REGION_ORDER)),
                key=lambda index: scores[index],
            )
            if scores[region_index] <= WEIGHT_EPSILON:
                raise RuntimeError(
                    f"semantic partition could not score face {polygon.index}"
                )
            region_name = SEMANTIC_REGION_ORDER[region_index]
            polygon_regions[polygon.index] = region_index
            region_face_indices[region_name].append(polygon.index)
            for vertex_index in polygon.vertices:
                region_source_vertices[region_name].add(vertex_index)
                vertex_regions[vertex_index].add(region_index)

        unreferenced_vertices = [
            index for index, regions in enumerate(vertex_regions) if not regions
        ]
        if unreferenced_vertices:
            raise RuntimeError(
                "semantic partition cannot preserve loose source vertices: "
                f"{len(unreferenced_vertices)} unreferenced"
            )

        nonempty_regions = [
            region_name for region_name in SEMANTIC_REGION_ORDER
            if region_face_indices[region_name]
        ]
        if not 5 <= len(nonempty_regions) <= 9:
            raise RuntimeError(
                "semantic partition invariant failed before separation: "
                f"{len(nonempty_regions)} nonempty regions outside 5-9"
            )

        source_vertex_attribute = "_semantic_source_vertex"
        source_face_attribute = "_semantic_source_face"
        region_attribute = "_semantic_region"
        for attribute_name in (
            source_vertex_attribute,
            source_face_attribute,
            region_attribute,
        ):
            if body.data.attributes.get(attribute_name) is not None:
                raise RuntimeError(
                    f"semantic partition temporary attribute already exists: "
                    f"{attribute_name}"
                )

        vertex_attribute = body.data.attributes.new(
            name=source_vertex_attribute, type="INT", domain="POINT"
        )
        face_attribute = body.data.attributes.new(
            name=source_face_attribute, type="INT", domain="FACE"
        )
        label_attribute = body.data.attributes.new(
            name=region_attribute, type="INT", domain="FACE"
        )
        for vertex in body.data.vertices:
            vertex_attribute.data[vertex.index].value = vertex.index
        for polygon in body.data.polygons:
            face_attribute.data[polygon.index].value = polygon.index
            label_attribute.data[polygon.index].value = polygon_regions[
                polygon.index
            ]
        body.data.update()

        mesh_parts = []
        part_regions = {}
        expected_region_faces = {
            region_name: len(region_face_indices[region_name])
            for region_name in nonempty_regions
        }
        bpy.context.tool_settings.mesh_select_mode = (False, False, True)

        for region_name in nonempty_regions:
            region_index = SEMANTIC_REGION_ORDER.index(region_name)
            bpy.ops.object.select_all(action="DESELECT")
            body.select_set(True)
            bpy.context.view_layer.objects.active = body
            bpy.ops.object.mode_set(mode="EDIT")
            edit_mesh = bmesh.from_edit_mesh(body.data)
            region_layer = edit_mesh.faces.layers.int.get(region_attribute)
            if region_layer is None:
                raise RuntimeError(
                    "semantic partition lost its region face attribute"
                )
            for vertex in edit_mesh.verts:
                vertex.select = False
            for edge in edit_mesh.edges:
                edge.select = False
            selected_faces = 0
            for face in edit_mesh.faces:
                selected = face[region_layer] == region_index
                face.select_set(selected)
                if selected:
                    selected_faces += 1
            bmesh.update_edit_mesh(
                body.data, loop_triangles=False, destructive=False
            )
            if selected_faces != expected_region_faces[region_name]:
                raise RuntimeError(
                    f"semantic partition selected {selected_faces} "
                    f"{region_name} faces; expected "
                    f"{expected_region_faces[region_name]}"
                )

            object_pointers_before = {
                obj.as_pointer() for obj in bpy.data.objects
            }
            result = bpy.ops.mesh.separate(type="SELECTED")
            if "FINISHED" not in result:
                raise RuntimeError(
                    f"semantic SELECTED separation failed for {region_name}: "
                    f"{sorted(result)}"
                )
            bpy.ops.object.mode_set(mode="OBJECT")
            created = [
                obj for obj in bpy.data.objects
                if obj.type == "MESH"
                and obj.as_pointer() not in object_pointers_before
            ]
            if len(created) != 1:
                raise RuntimeError(
                    f"semantic SELECTED separation created {len(created)} "
                    f"objects for {region_name}; expected one"
                )
            part = created[0]
            part_name = f"{args.asset_id}_{region_name}"
            name_collision = bpy.data.objects.get(part_name)
            if name_collision is not None and name_collision != part:
                raise RuntimeError(
                    f"semantic part name collision: {part_name}"
                )
            world_matrix = part.matrix_world.copy()
            part.parent = rig
            part.matrix_world = world_matrix
            part.name = part_name
            if part.name != part_name:
                raise RuntimeError(
                    f"semantic part name was not stable: {part.name}"
                )
            mesh_parts.append(part)
            part_regions[part.as_pointer()] = region_index

        body.data.update()
        if len(body.data.polygons) != 0:
            raise RuntimeError(
                f"semantic partition left {len(body.data.polygons)} source faces"
            )

        material_after = material_histogram(mesh_parts)
        partition_faces = sum(
            len(part.data.polygons) for part in mesh_parts
        )
        face_count_delta = partition_faces - source_faces
        vertex_occurrences = [0] * source_vertices
        face_occurrences = [0] * source_faces
        max_rest_position_delta = 0.0
        max_weight_delta = 0.0
        boundary_max_rest_delta = 0.0
        boundary_max_weight_delta = 0.0
        max_uv_delta = 0.0
        modifier_failures = []
        parent_failures = []
        region_assignment_failures = []

        for part in mesh_parts:
            expected_region_index = part_regions[part.as_pointer()]
            source_vertex_ids = part.data.attributes.get(
                source_vertex_attribute
            )
            source_face_ids = part.data.attributes.get(source_face_attribute)
            region_labels = part.data.attributes.get(region_attribute)
            if (
                source_vertex_ids is None
                or source_face_ids is None
                or region_labels is None
            ):
                raise RuntimeError(
                    f"semantic part {part.name} lost verification attributes"
                )

            armature_modifiers = [
                modifier for modifier in part.modifiers
                if modifier.type == "ARMATURE"
            ]
            enabled_target = [
                modifier for modifier in armature_modifiers
                if modifier.show_viewport and modifier.object == rig
            ]
            if len(armature_modifiers) != 1 or len(enabled_target) != 1:
                modifier_failures.append(part.name)
            if part.parent != rig:
                parent_failures.append(part.name)

            part_group_names = [
                group.name for group in part.vertex_groups
            ]
            for vertex in part.data.vertices:
                source_index = int(
                    source_vertex_ids.data[vertex.index].value
                )
                if not 0 <= source_index < source_vertices:
                    raise RuntimeError(
                        f"semantic part {part.name} has invalid source vertex "
                        f"{source_index}"
                    )
                vertex_occurrences[source_index] += 1
                rest_delta = (
                    part.matrix_world @ vertex.co
                    - source_positions[source_index]
                ).length
                max_rest_position_delta = max(
                    max_rest_position_delta, rest_delta
                )
                actual_weights = {
                    part_group_names[element.group]: float(element.weight)
                    for element in vertex.groups
                    if 0 <= element.group < len(part_group_names)
                    and math.isfinite(element.weight)
                    and element.weight > WEIGHT_EPSILON
                }
                expected_weights = source_weights[source_index]
                weight_delta = max(
                    (
                        abs(
                            actual_weights.get(name, 0.0)
                            - expected_weights.get(name, 0.0)
                        )
                        for name in set(actual_weights) | set(expected_weights)
                    ),
                    default=0.0,
                )
                max_weight_delta = max(max_weight_delta, weight_delta)
                if len(vertex_regions[source_index]) > 1:
                    boundary_max_rest_delta = max(
                        boundary_max_rest_delta, rest_delta
                    )
                    boundary_max_weight_delta = max(
                        boundary_max_weight_delta, weight_delta
                    )

            actual_uv_layers = [layer.name for layer in part.data.uv_layers]
            if actual_uv_layers != source_uv_layers:
                raise RuntimeError(
                    f"semantic part {part.name} changed UV layer order"
                )
            for polygon in part.data.polygons:
                source_index = int(
                    source_face_ids.data[polygon.index].value
                )
                if not 0 <= source_index < source_faces:
                    raise RuntimeError(
                        f"semantic part {part.name} has invalid source face "
                        f"{source_index}"
                    )
                face_occurrences[source_index] += 1
                if (
                    int(region_labels.data[polygon.index].value)
                    != expected_region_index
                ):
                    region_assignment_failures.append(source_index)
                if (
                    int(polygon.material_index)
                    != source_material_indices[source_index]
                ):
                    raise RuntimeError(
                        f"semantic face {source_index} changed material index"
                    )
                for layer in part.data.uv_layers:
                    actual_uvs = [
                        uv_coordinate(layer, loop_index)
                        for loop_index in polygon.loop_indices
                    ]
                    expected_uvs = source_uvs[source_index][layer.name]
                    if len(actual_uvs) != len(expected_uvs):
                        raise RuntimeError(
                            f"semantic face {source_index} changed UV corners"
                        )
                    for actual_uv, expected_uv in zip(
                        actual_uvs, expected_uvs
                    ):
                        max_uv_delta = max(
                            max_uv_delta,
                            math.dist(actual_uv, expected_uv),
                        )

        expected_occurrences = [
            len(regions) for regions in vertex_regions
        ]
        occurrence_mismatches = sum(
            actual != expected
            for actual, expected in zip(
                vertex_occurrences, expected_occurrences
            )
        )
        duplicate_occurrences = sum(
            max(0, count - 1) for count in vertex_occurrences
        )
        expected_duplicate_occurrences = sum(
            max(0, count - 1) for count in expected_occurrences
        )
        duplicate_occurrence_delta = (
            duplicate_occurrences - expected_duplicate_occurrences
        )
        face_occurrence_failures = sum(
            count != 1 for count in face_occurrences
        )
        material_preserved = material_after == material_before
        part_names = [part.name for part in mesh_parts]
        region_face_counts = {
            region_name: len(region_face_indices[region_name])
            for region_name in nonempty_regions
        }
        region_vertex_counts = {
            region_name: len(region_source_vertices[region_name])
            for region_name in nonempty_regions
        }

        failures = []
        if not 5 <= len(mesh_parts) <= 9:
            failures.append(f"part count {len(mesh_parts)} outside 5-9")
        if len(set(part_names)) != len(part_names):
            failures.append("semantic part names are not unique")
        if face_count_delta != 0:
            failures.append(f"face count delta {face_count_delta}")
        if not material_preserved:
            failures.append("material face histogram changed")
        if modifier_failures:
            failures.append(
                f"invalid Armature modifiers on {modifier_failures}"
            )
        if parent_failures:
            failures.append(f"invalid rig parent on {parent_failures}")
        if region_assignment_failures:
            failures.append(
                f"{len(region_assignment_failures)} faces changed region"
            )
        if occurrence_mismatches:
            failures.append(
                f"{occurrence_mismatches} source vertex occurrence mismatches"
            )
        if duplicate_occurrence_delta != 0:
            failures.append(
                f"duplicate occurrence delta {duplicate_occurrence_delta}"
            )
        if face_occurrence_failures:
            failures.append(
                f"{face_occurrence_failures} source face occurrence failures"
            )
        if max_rest_position_delta > 1e-6:
            failures.append(
                f"rest position delta {max_rest_position_delta} > 1e-6"
            )
        if max_weight_delta > 1e-6:
            failures.append(
                f"weight delta {max_weight_delta} > 1e-6"
            )
        if max_uv_delta > 1e-6:
            failures.append(f"UV delta {max_uv_delta} > 1e-6")
        if failures:
            raise RuntimeError(
                "semantic partition invariant failed: "
                + "; ".join(failures)
            )

        for part in mesh_parts:
            for attribute_name in (
                source_vertex_attribute,
                source_face_attribute,
                region_attribute,
            ):
                attribute = part.data.attributes.get(attribute_name)
                if attribute is not None:
                    part.data.attributes.remove(attribute)
            part.data.update()
        bpy.data.objects.remove(body, do_unlink=True)

        receipt = {
            "policy": "stable_face_argmax_of_summed_repaired_region_weights",
            "regionOrder": list(SEMANTIC_REGION_ORDER),
            "regionFaceCounts": region_face_counts,
            "regionVertexCounts": region_vertex_counts,
            "parts": len(mesh_parts),
            "partNames": part_names,
            "sourceFaces": source_faces,
            "partitionFaces": partition_faces,
            "faceCountDelta": face_count_delta,
            "materialFaceHistogramBefore": material_before,
            "materialFaceHistogramAfter": material_after,
            "materialHistogramPreserved": material_preserved,
            "boundarySourceVertexCount": sum(
                len(regions) > 1 for regions in vertex_regions
            ),
            "duplicateOccurrences": duplicate_occurrences,
            "expectedDuplicateOccurrences": (
                expected_duplicate_occurrences
            ),
            "duplicateOccurrenceDelta": duplicate_occurrence_delta,
            "maxRestPositionDelta": max_rest_position_delta,
            "maxWeightDelta": max_weight_delta,
            "boundaryMaxRestDelta": boundary_max_rest_delta,
            "boundaryMaxWeightDelta": boundary_max_weight_delta,
            "maxUvDelta": max_uv_delta,
            "sourceVertices": source_vertices,
            "partitionVertexOccurrences": sum(vertex_occurrences),
        }
        return mesh_parts, receipt

    mesh_parts, semantic_receipt = partition_semantic_faces()
    step(
        "semantic_partition",
        status="completed",
        **semantic_receipt,
    )

    # --- 7. Hierarchy + export ---------------------------------------------
    root = bpy.data.objects.new(args.asset_id, None)
    root.empty_display_type = "PLAIN_AXES"
    bpy.context.scene.collection.objects.link(root)
    rig.parent = root

    if args.save_blend:
        Path(args.save_blend).parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(args.save_blend), copy=True)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in (root, rig):
        o.select_set(True)
    for part in mesh_parts:
        part.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_force_sampling=False,
        export_yup=True,
        export_skins=True,
        export_all_influences=False,
    )
    step("export", path=str(out), bytes=out.stat().st_size if out.exists() else 0,
         pedestalRemoved=pedestal_removed, meshParts=len(mesh_parts))
    log["axisDeviationDeg"] = achieved
    log["elevationDeg"] = elevation
    log["bindMethod"] = method
    log["pedestalRemoved"] = pedestal_removed
    log["restPose"] = args.rest_pose
    log["restPoseOk"] = rest_pose_ok
    log["clipCount"] = len(authored)
    log["status"] = "completed"
    return log


def main():
    args = parse_args(script_args())
    budgets = load_budgets(args.budgets_json)
    try:
        log = run(args, budgets)
    except Exception as exc:
        import traceback
        log = {"assetId": args.asset_id, "status": "failed", "error": str(exc),
               "traceback": traceback.format_exc()}
    if args.report:
        Path(args.report).parent.mkdir(parents=True, exist_ok=True)
        Path(args.report).write_text(json.dumps(log, indent=2))
    print("RIG_RESULT_JSON:" + json.dumps(log))
    if log.get("status") != "completed":
        sys.exit(1)


if __name__ == "__main__":
    main()
