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
  * The metarig was only *uniformly scaled* to mesh height, never fitted to the
    mesh's limbs. Rodin characters stand arms-down-at-the-sides, so the A-pose
    arm bones sat outside the mesh arms entirely and bone-heat fell back to
    nearest-bone weighting. Symptoms in the shipped GLBs: guard.glb gave
    DEF-hand.R more total weight than its entire spine chain; cinder-warden.glb
    put ~1/3 of all weight on the head bone.

Pipeline:

  1. Landmark-fit a deform armature to the mesh (shoulder line, per-side arm
     axis, hip width, ground plane) so bones lie INSIDE the geometry.
  2. Bind in the mesh's sculpted pose, via bone-heat -> envelope ->
     inverse-distance, gated on how much weight the arm chain actually owns.
  3. Freeze the rest pose (`--rest-pose`, below).
  4. Author the 11-clip action library, export GLB.

`--rest-pose natural` (default) keeps the sculpted pose as the bind pose.
`--rest-pose tpose` rotates each arm onto +/-X, bakes the deformation into the
mesh, and freezes that as rest -- it reaches a measured 0.0 deg axis deviation,
but on these assets it is NOT what you want: the meshes are a single fused
primitive with cape, pauldrons and weapons welded to the arms, so the rotation
drags that geometry outward into wings while the actual arms stay put
(rendered proof: cinder-warden). Automatic arm isolation was tried and does not
work here -- PCA over the outboard point cloud diverges between subsets of the
same arm (+55.4 deg vs -81.7 deg on cinder-warden.L) because the cape dominates
the cloud. A real T-pose on this art needs either an ML auto-rigger (UniRig,
guide section 2.4) or T-posed source meshes.

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
    p.add_argument("--rest-pose", default="tpose", choices=["tpose", "natural"],
                   help="tpose = rotate arms onto +/-X and freeze as rest; "
                        "natural = keep the mesh's sculpted pose as the bind pose")
    p.add_argument("--arm-fit", default="detect", choices=["detect", "prior", "tpose"],
                   help="detect = PCA over the mesh's outboard cloud; "
                        "prior = anthropometric proportions for arms-down silhouettes; "
                        "tpose = fit an already-horizontal source without re-posing it")
    p.add_argument("--bind-method", default="auto",
                   choices=["auto", "bone_heat", "inverse_distance"],
                   help="auto = bone_heat -> envelope -> inverse_distance, gated on arm weight")
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
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
    bm.to_mesh(body.data)
    body.data.update()
    bm.free()
    step("weld", vertsBefore=before, vertsAfter=len(body.data.vertices))

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
    bpy.ops.object.mode_set(mode="OBJECT")
    step("armature_fit", bones=len(arm_data.bones), shoulderZ=round(shoulder_z, 4), arms=arm_fit)

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

    # --- 5. Pose arms to the T-pose axis, apply as rest pose ---------------
    # A T-pose needs the arm along +/-X, not merely level. Rodin characters
    # hold their arms down AND forward/back, so the detected arm axis has a
    # large Y component (guard.glb: (0.069, -0.215, -0.064) -- mostly backward).
    # Rotating only about world Y can flatten Z but never removes that Y
    # component, which left a 12-19 deg residual. Rotate by the full
    # axis-to-axis difference instead.
    rotated = {}
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    sides = (("L", 1.0), ("R", -1.0)) if args.rest_pose == "tpose" else ()
    for side, sgn in sides:
        ua = rig.pose.bones.get(f"DEF-upper_arm.{side}")
        ub = rig.data.bones.get(f"DEF-upper_arm.{side}")
        hb = rig.data.bones.get(f"DEF-hand.{side}")
        if not (ua and ub and hb):
            continue
        cur = (hb.tail_local - ub.head_local)
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

    # ORDER IS LOAD-BEARING. The mesh must be baked through the armature
    # modifier WHILE the arms are still posed; `pose.armature_apply` zeroes the
    # pose (it becomes the new rest), so applying the modifier after it bakes
    # an identity deformation -- bones end up T-posed while the mesh keeps its
    # original arms-down geometry, which is exactly the silent no-op this
    # ordering bug produced before.
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    for m in [mm for mm in body.modifiers if mm.type == "ARMATURE"]:
        bpy.ops.object.modifier_apply(modifier=m.name)

    # Now freeze the posed skeleton as the new rest pose...
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    # ...and re-bind the (now T-posed) mesh to it. Vertex groups survived the
    # modifier application, so this restores skinning without re-weighting.
    newmod = body.modifiers.new(name="Armature", type="ARMATURE")
    newmod.object = rig
    body.parent = rig
    body.matrix_parent_inverse = rig.matrix_world.inverted()

    # Report BOTH numbers: elevation is what a viewer reads as "arms level",
    # axis deviation is the real T-pose test (includes forward/back yaw).
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
    step("tpose_apply", rotatedDeg=rotated, axisDeviationDeg=achieved,
         elevationDeg=elevation, tolerance=TPOSE_TOLERANCE_DEG)

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
                kp.interpolation = "BEZIER"
                kp.easing = "AUTO"

        track = rig.animation_data.nla_tracks.new()
        track.name = clip_id
        track.strips.new(name=act.name, start=1, action=act)
        rig.animation_data.action = None
        authored.append(clip_id)

    bpy.ops.object.mode_set(mode="OBJECT")
    step("author_animations", count=len(authored), clips=authored)
    tpose_ok = bool(achieved) and all(abs(v) <= TPOSE_TOLERANCE_DEG for v in achieved.values())
    if not tpose_ok:
        raise RuntimeError(f"T-pose gate failed: axisDeviationDeg={achieved}")


    pedestal_removed = pedestal is not None
    if pedestal is not None:
        bpy.data.objects.remove(pedestal, do_unlink=True)
        pedestal = None
    # --- 7. Hierarchy + export ---------------------------------------------
    root = bpy.data.objects.new(args.asset_id, None)
    root.empty_display_type = "PLAIN_AXES"
    bpy.context.scene.collection.objects.link(root)
    rig.parent = root
    body.name = f"{args.asset_id}_body"

    if args.save_blend:
        Path(args.save_blend).parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(args.save_blend), copy=True)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in (root, rig, body):
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_force_sampling=True,
        export_yup=True,
        export_skins=True,
        export_all_influences=False,
    )
    step("export", path=str(out), bytes=out.stat().st_size if out.exists() else 0,
         pedestalRemoved=pedestal_removed)
    log["axisDeviationDeg"] = achieved
    log["elevationDeg"] = elevation
    log["bindMethod"] = method
    log["pedestalRemoved"] = pedestal_removed
    log["tposeOk"] = tpose_ok
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
    print("RIG_TPOSE_RESULT_JSON:" + json.dumps(log))
    if log.get("status") != "completed":
        sys.exit(1)


if __name__ == "__main__":
    main()
