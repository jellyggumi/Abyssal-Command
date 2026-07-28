#!/usr/bin/env python3
"""Regenerate character source meshes in a genuine T-pose via Rodin/Hyper3D.

WHY THIS EXISTS
---------------
The shipped characters cannot be converted to a T-pose after the fact. Their
Rodin meshes are a SINGLE fused primitive with one material -- cape, pauldrons
and weapons are welded to the arms with no separable boundary -- so rotating an
arm bone drags whatever geometry surrounds it. Eight placement x weighting
combinations were built and rendered, and every one failed:

  arm placement   weighting            result
  --------------  -------------------  --------------------------------------
  PCA detect      bone-heat            cape stretched into wings, arms stayed
  PCA detect      envelope             same, plus shoulder collapse
  PCA detect      inverse-distance     same
  proportion      bone-heat (scout)    silhouette destroyed
  proportion      bone-heat (rift)     mesh shredded into ribbons
  proportion      envelope             head/shoulder collapsed inward
  proportion      inverse-distance     head absorbed into shoulder mass
  (measurement)   --                   PCA over the same arm's point cloud
                                       diverges: +55.4 deg vs -81.7 deg, and
                                       cross-section radius falls smoothly
                                       0.43 -> 0.07 with no arm/cape boundary

The fix has to happen at GENERATION time: submit a T-pose blockout as Rodin's
BoundingBox ControlNet condition so the generated mesh is born in a T-pose.
That is Rodin's own documented path ("Click T/A pose button for direct T/A pose
assets"), and it costs ~0.5 credits per character.

The local ML alternative (UniRig, guide section 2.4) is not available on this
machine: it requires spconv + flash-attn, both CUDA-only, and this is Apple
Silicon.

WHAT THIS DOES
--------------
Per asset: builds a T-pose blockout scaled to that character's measured height
and shoulder width, loads its concept PNG, sets Rodin's condition to `bbox`
with the blockout selected, and submits.

AUTH IS INTERACTIVE AND YOURS TO DO. The addon bridges Blender to a browser
session on hyper3d.ai (local websocket on :61863, Chrome relays the task). The
first submit opens Chrome; log in there once and the rest of the batch reuses
the session. There is no API-key path in this addon -- checked
src/rodin/preference.py, it only exposes a `dev_api` host override, and the
Chrome profile currently holds only analytics/consent cookies for hyper3d.ai
(no auth token), so nobody is logged in right now.

VERIFIED SO FAR, headless: the payload path runs end to end -- blockout built
and proportioned, concept PNG staged in the concept-input lane, condition mesh
exported to tpose-conditions, websocket client connected, and the task accepted
by the local bridge ("Submit Prepare" -> "Prepare Images" -> "Prepare Mesh" ->
task added).
NOT verified: the browser handoff. `blender -b` exits the moment the task is
pushed, so Chrome never opens and the task never reaches Rodin -- no result
GLB is produced. That last hop needs a GUI Blender plus a logged-in session.

  # 1. dry run -- builds staged conditions, writes the plan, submits nothing
  blender -b -P scripts/rodin-tpose-regen.py -- --plan-only

  # 2. real run -- GUI, so the process stays alive for the Chrome handoff.
  #    Start with one asset, confirm the result, then drop --only for the rest.
  blender -P scripts/rodin-tpose-regen.py -- --submit --only cinder-warden

Downloaded results must be staged under
  _workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline/runtime-candidates/<category>/
before any explicit `--accept-runtime` review; this script never writes
assets/images/battle/glb.
"""
import sys
import json
from contextlib import contextmanager
import math
import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
GLB_DIR = REPO / "assets/images/battle/glb"
PILOT = REPO / "assets/images/battle/pilot"
DEFAULT_CONCEPT_ROOT = "_workspace/current/engineering/asset-pipeline/concept-layers"
SCALE_CONTRACT = "_workspace/current/engineering/asset-pipeline/character-scale.json"
DEFAULT_CANDIDATE_ROOT = "_workspace/current/engineering/asset-pipeline/runtime-candidates"
RODIN_PROMPT = (
    "Generate a game-ready humanoid character source mesh in a genuine T-pose: "
    "full body centered, arms extended horizontally, feet separated, neutral pose, "
    "clean silhouette, topology suitable for skinning and animation. "
    "Character body only; exclude terrain, floor, pedestal, rocks, platform, "
    "weapons, shields, held props, equipment, debris, and background geometry. "
    "No text, logos, or watermark."
)
RODIN_NEGATIVE_PROMPT = (
    "terrain, floor, pedestal, rocks, platform, weapon, shield, sword, staff, "
    "held prop, equipment, debris, background geometry, text, logo, watermark"
)

TERRAIN_POLICY = {
    "assertion": "Generated source mesh must not contain terrain, floor, pedestal, or platform geometry.",
    "status": "required-at-generation-and-visual-audit",
}
WEAPON_POLICY = {
    "assertion": "Generated source mesh must not contain weapons, shields, held props, or equipment.",
    "status": "required-at-generation-and-visual-audit",
}

# Asset -> concept PNG stem. Bosses carry an "sN-" stage prefix on the concept
# that the GLB filename drops, so the mapping is explicit rather than derived.
CONCEPT_OVERRIDES = {
    "abyss-regent": "concept-s10-abyss-regent",
    "bridge-colossus": "concept-s8-bridge-colossus",
    "cinder-warden": "concept-s1-cinder-warden",
    "gate-sovereign": "concept-s3-gate-sovereign",
    "lantern-tyrant": "concept-s7-lantern-tyrant",
    "pack-herald": "concept-s5-pack-herald",
    "requiem-choir": "concept-s6-requiem-choir",
    "tide-warden": "concept-s4-tide-warden",
    "veil-tactician": "concept-s2-veil-tactician",
    "veiled-concordat": "concept-s9-veiled-concordat",
}
# dusk-warden is a procedural Blender blockout, not Rodin output -- it has no
# concept image and does not go through this pipeline.
SKIP = {"dusk-warden"}


def script_args(argv=None):
    argv = list(sys.argv if argv is None else argv)
    return argv[argv.index("--") + 1:] if "--" in argv else []


def parse_args(argv):
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--submit", action="store_true",
                   help="actually submit (opens Chrome for auth); default is plan-only")
    p.add_argument("--plan-only", action="store_true")
    p.add_argument("--only", default=None, help="single asset id")
    p.add_argument("--plan-out", default="/tmp/rodin-tpose-plan.json")
    p.add_argument("--submit-delay", type=float, default=2.0,
                   help="seconds to wait after the local bridge is up before the first "
                        "submit, so the browser plugin can connect first")
    p.add_argument("--blockout-dir", default=None,
                   help="legacy override; defaults to the staged tpose-conditions lane")
    p.add_argument("--concept-root", default=DEFAULT_CONCEPT_ROOT,
                   help="concept/reference image root (concept lane only)")
    p.add_argument("--candidate-root", default=DEFAULT_CANDIDATE_ROOT,
                   help="staged runtime-candidate root; never the deployed GLB tree")
    p.add_argument("--concept-only", action="store_true", default=False,
                   help="keep generated source media in the concept lane (default for plan generation)")
    p.add_argument("--accept-runtime", action="store_true",
                   help="explicitly mark an existing staged runtime candidate eligible; never writes deployed GLBs")
    return p.parse_args(argv)


def repo_path(value):
    """Resolve a CLI path without allowing relative paths to depend on cwd."""
    path = Path(value).expanduser()
    return path if path.is_absolute() else REPO / path


def assert_staged_path(path, label):
    """Reject accidental writes into the deployed runtime lane."""
    resolved = path.resolve()
    try:
        resolved.relative_to(GLB_DIR.resolve())
    except ValueError:
        return
    raise ValueError(f"{label} must not be under deployed runtime path {GLB_DIR}: {path}")


def lane_paths(args):
    candidate_root = repo_path(args.candidate_root)
    # The default candidate root is .../runtime-candidates; its siblings keep
    # concept inputs and condition meshes visibly separate from runtime output.
    staging_root = candidate_root.parent
    concept_input_dir = staging_root / "concept-input"
    condition_dir = repo_path(args.blockout_dir) if args.blockout_dir else staging_root / "tpose-conditions"
    assert_staged_path(concept_input_dir, "concept input directory")
    assert_staged_path(condition_dir, "condition mesh directory")
    assert_staged_path(candidate_root, "runtime candidate directory")
    return {
        "conceptRoot": repo_path(args.concept_root),
        "candidateRoot": candidate_root,
        "conceptInputDir": concept_input_dir,
        "conditionDir": condition_dir,
        "runtimeRoot": candidate_root,
    }


def concept_for(asset_id, concept_root=None):
    stem = CONCEPT_OVERRIDES.get(asset_id, f"concept-{asset_id}")
    root = repo_path(concept_root) if concept_root is not None else PILOT
    png = root / f"{stem}.png"
    return png if png.exists() else None


def copy_concept_input(concept, destination):
    """Stage a reference copy in the concept lane; never promote it to runtime."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    if concept.resolve() != destination.resolve():
        shutil.copy2(concept, destination)
    return destination


def load_scale_contract():
    """Heights frozen from the pre-regeneration meshes.

    Regenerating every mesh from scratch would otherwise reset all relative
    scale in the game -- a 1.15 m scout and a 1.99 m commander would both come
    back as generic humans. The contract keeps that hierarchy intact.
    """
    path = REPO / SCALE_CONTRACT
    if not path.exists():
        return {}, None
    doc = json.loads(path.read_text())
    return doc.get("characters", {}), doc.get("medianHeight")


PLATE_METRICS = "_workspace/current/engineering/asset-pipeline/plate-metrics.json"


def load_plate_metrics():
    """Silhouette metrics precomputed outside Blender.

    Blender ships without Pillow and mutating its install would make the
    pipeline unreproducible, so scripts/measure-character-plates.py does the
    image work with the system Python and leaves plain JSON here.
    """
    path = REPO / PLATE_METRICS
    if not path.exists():
        return {}
    return json.loads(path.read_text()).get("assets", {})


def measure_asset(glb_path):
    """Height and shoulder half-width of a shipped mesh.

    Retained for assets that still have a deployed GLB; the regeneration path
    uses measure_plate() instead.
    """
    import struct
    import numpy as np

    buf = glb_path.read_bytes()
    total = struct.unpack_from("<I", buf, 8)[0]
    off, js, binc = 12, None, None
    while off < total:
        clen, ctype = struct.unpack_from("<II", buf, off)
        off += 8
        chunk = buf[off:off + clen]
        off += clen
        if ctype == 0x4E4F534A:
            js = json.loads(chunk.decode("utf-8"))
        elif ctype == 0x004E4942:
            binc = chunk

    comp = {5120: "<i1", 5121: "<u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
    pts = []
    for node in js.get("nodes", []):
        if "mesh" not in node or not str(node.get("name", "")).endswith("_body"):
            continue
        for prim in js["meshes"][node["mesh"]]["primitives"]:
            a = js["accessors"][prim["attributes"]["POSITION"]]
            bv = js["bufferViews"][a["bufferView"]]
            dt = np.dtype(comp[a["componentType"]])
            n = ncomp[a["type"]]
            base = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
            arr = np.frombuffer(binc, dtype=dt, count=a["count"] * n, offset=base)
            pts.append(arr.reshape(a["count"], n).astype(float))
    if not pts:
        return None
    P = np.vstack(pts)
    # glTF is Y-up: column 1 is height.
    height = float(P[:, 1].max() - P[:, 1].min())
    cx = float(np.median(P[:, 0]))
    up = P[:, 1]
    lo = float(up.min())
    band = P[(up >= lo + height * 0.75) & (up <= lo + height * 0.85)]
    shoulder_half = float(max(band[:, 0].max() - cx, cx - band[:, 0].min())) if len(band) > 8 \
        else height * 0.16
    return {"height": round(height, 4), "shoulderHalf": round(shoulder_half, 4)}


def ui_override(bpy):
    """Build a context override that satisfies UI-dependent operators.

    Both the glTF exporter and the Rodin submit operator read
    `bpy.context.active_object`. That attribute only exists on a window-backed
    context, which a `-P` startup script and a timer callback do not have --
    headless mode is unaffected because `-b` gives operators the full context
    directly. Supplying window/screen/area explicitly closes the gap without
    changing how the script behaves under `-b`.
    """
    if bpy.app.background:
        return None
    wm = bpy.context.window_manager
    if not wm or not wm.windows:
        return None
    window = wm.windows[0]
    screen = window.screen
    override = {
        "window": window,
        "screen": screen,
        "scene": bpy.context.scene,
        "view_layer": bpy.context.view_layer,
    }
    for area in getattr(screen, "areas", []):
        if area.type == "VIEW_3D":
            region = next((r for r in area.regions if r.type == "WINDOW"), None)
            override.update({"area": area, "region": region, "space_data": area.spaces.active})
            break
    return override


@contextmanager
def ui_context(bpy):
    override = ui_override(bpy)
    if override is None:
        yield
        return
    with bpy.context.temp_override(**override):
        yield


def run():
    import bpy
    import addon_utils

    args = parse_args(script_args())
    submit = args.submit and not args.plan_only
    lanes = lane_paths(args)
    concept_root = lanes["conceptRoot"]
    concept_input_dir = lanes["conceptInputDir"]
    condition_dir = lanes["conditionDir"]
    runtime_root = lanes["runtimeRoot"]
    concept_input_dir.mkdir(parents=True, exist_ok=True)
    condition_dir.mkdir(parents=True, exist_ok=True)
    runtime_root.mkdir(parents=True, exist_ok=True)

    sys.path.insert(0, str(REPO / "scripts"))
    from tpose_blockout import build_tpose_blockout

    try:
        addon_utils.enable("a_Rodin", default_set=True, persistent=True)
    except Exception as exc:
        print(f"[warn] could not enable a_Rodin: {exc}")
    have_rodin = hasattr(bpy.ops, "rodin") and hasattr(bpy.ops.rodin, "submit")

    scale_contract, median_height = load_scale_contract()
    plate_metrics = load_plate_metrics()
    plate_root = repo_path(args.concept_root)
    targets = []
    for plate in sorted(plate_root.glob("*/*-character.png")):
        aid = plate.parent.name
        if aid in SKIP:
            continue
        if args.only and aid != args.only:
            continue
        known = scale_contract.get(aid)
        # An asset with no frozen height is new art with no shipped predecessor;
        # the median keeps it in scale with the cast instead of guessing.
        height = known["height"] if known else median_height
        category = known["category"] if known else "characters"
        if height is None:
            print(f"{aid:22} skipped:no-scale")
            continue
        targets.append((category, aid, plate, height))

    concept_only = bool(args.concept_only or not args.accept_runtime)
    plan = {
        "schemaVersion": 2,
        "submitted": submit,
        "haveRodinAddon": have_rodin,
        "assetLane": "concept",
        "conceptOnly": concept_only,
        "conceptRoot": str(concept_root),
        "candidateRoot": str(runtime_root),
        "candidateLayout": {
            "conceptInput": str(concept_input_dir),
            "tposeConditions": str(condition_dir),
            "runtimeCandidates": str(runtime_root),
        },
        "promptContract": {
            "sourceMesh": RODIN_PROMPT,
            "negativePrompt": RODIN_NEGATIVE_PROMPT,
            "pose": "genuine T-pose with arms at approximately 90 degrees from the torso",
            "terrainPolicy": dict(TERRAIN_POLICY),
            "weaponPolicy": dict(WEAPON_POLICY),
            "runtimePolicy": "Candidate output is not shipped runtime and must remain staged until separately audited.",
        },
        "lanePolicy": {
            "concept": "Source/reference images, prompts, and generated Rodin media.",
            "runtimeCandidate": "Staged output only; never assets/images/battle/glb.",
        },
        "assets": [],
    }
    for cat, aid, plate, height in targets:
        runtime_output = runtime_root / cat / f"{aid}.glb"
        assert_staged_path(runtime_output, "runtime candidate output")
        entry = {
            "assetId": aid,
            "category": cat,
            "assetLane": "concept",
            "conceptInput": None,
            "conceptInputStaged": None,
            "conditionMesh": str(condition_dir / f"{aid}-tpose-condition.glb"),
            "runtimeOutput": str(runtime_output),
            "runtimeEligible": bool(args.accept_runtime and runtime_output.exists()),
            "runtimeProvenance": {
                "candidateOnly": True,
                "explicitAcceptance": bool(args.accept_runtime),
                "rights": "pending",
                "glbEmbedding": "pending",
                "browserEvidence": "pending",
                "fallbackEvidence": "pending",
            },
            "terrainPolicy": dict(TERRAIN_POLICY),
            "weaponPolicy": dict(WEAPON_POLICY),
        }
        concept = plate
        dims = plate_metrics.get(aid)
        # Keep the historical key readable while making the lane-specific key
        # authoritative for validators and downstream tooling.
        entry["concept"] = str(concept) if concept else None
        entry["conceptKind"] = "separated-character-plate"
        entry["scaleSource"] = "frozen-contract" if scale_contract.get(aid) else "median-fallback"
        entry["measured"] = dims
        if concept is None or dims is None:
            entry["status"] = "skipped:no-concept" if concept is None else "skipped:no-dims"
            plan["assets"].append(entry)
            print(f"{aid:22} {entry['status']}")
            continue

        staged_concept = copy_concept_input(concept, concept_input_dir / concept.name)
        entry["conceptInput"] = str(concept)
        entry["conceptInputStaged"] = str(staged_concept)

        bpy.ops.wm.read_factory_settings(use_empty=True)
        # read_factory_settings() tears down scene-level PropertyGroups, so the
        # addon's `scene.rodin_prop` vanishes with it. Re-enable per iteration
        # or the first submit dies on AttributeError.
        if have_rodin:
            try:
                addon_utils.enable("a_Rodin", default_set=True, persistent=True)
            except Exception:
                pass
        blockout = build_tpose_blockout(name=f"{aid}_tpose_condition",
                                        height=dims["height"])
        # Widen the blockout's arm span to this character's own shoulders so the
        # ControlNet bias matches its silhouette rather than a generic human.
        # A T-pose condition is judged by its arm reach, so bias the blockout
        # with the plate's measured arm span rather than its torso width.
        span_scale = max(0.8, min(1.6, dims["armSpanHalf"] / (dims["height"] * 0.5)))
        blockout.scale = (span_scale, 1.0, 1.0)
        bpy.context.view_layer.objects.active = blockout
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        entry["spanScale"] = round(span_scale, 3)

        out_glb = condition_dir / f"{aid}-tpose-condition.glb"
        assert_staged_path(out_glb, "condition mesh output")
        with ui_context(bpy):
            bpy.ops.object.select_all(action="DESELECT")
            blockout.select_set(True)
            bpy.ops.export_scene.gltf(filepath=str(out_glb), export_format="GLB",
                                      use_selection=True)
        # Preserve the old key for consumers of the existing plan.
        entry["blockout"] = str(out_glb)
        entry["conditionMesh"] = str(out_glb)

        if not submit:
            entry["status"] = "planned"
            plan["assets"].append(entry)
            print(f"{aid:22} planned  h={dims['height']:.3f} span={span_scale:.2f} "
                  f"-> {out_glb.name}")
            continue

        if not have_rodin:
            entry["status"] = "failed:addon-missing"
            plan["assets"].append(entry)
            continue

        img = bpy.data.images.load(str(staged_concept), check_existing=True)
        prop = bpy.context.scene.rodin_prop
        while len(prop.images) > 0:
            prop.images.remove(0)
        prop.images.add().image = img
        prop.condition_type = "bbox"
        prop.textTo = "Image"

        with ui_context(bpy):
            bpy.ops.object.select_all(action="DESELECT")
            blockout.select_set(True)
            bpy.context.view_layer.objects.active = blockout

            if not bpy.ops.rodin.submit.poll():
                entry["status"] = "failed:poll"
                plan["assets"].append(entry)
                print(f"{aid:22} poll failed -- addon rejected the payload")
                continue
            try:
                res = bpy.ops.rodin.submit()
                entry["status"] = "submitted"
                entry["operatorResult"] = list(res)
                print(f"{aid:22} submitted")
            except Exception as exc:
                entry["status"] = f"failed:{exc}"
                print(f"{aid:22} submit raised: {exc}")
        # Eligibility is deliberately recomputed after submission but remains
        # false unless --accept-runtime and a staged candidate already exists.
        entry["runtimeEligible"] = bool(args.accept_runtime and runtime_output.exists())
        plan["assets"].append(entry)

    plan_out = Path(args.plan_out).expanduser()
    assert_staged_path(plan_out, "plan output")
    plan_out.parent.mkdir(parents=True, exist_ok=True)
    plan_out.write_text(json.dumps(plan, indent=2))
    done = sum(1 for a in plan["assets"] if a["status"] in ("planned", "submitted"))
    print(f"\n{done}/{len(plan['assets'])} ready   plan -> {plan_out}")
    print("RODIN_TPOSE_PLAN_JSON:" + json.dumps(
        {"count": len(plan["assets"]), "ready": done, "submitted": submit}))


def _main():
    """Entry point that respects Blender's startup context.

    In GUI mode a `-P` script executes before the window manager finishes
    building the context, so `bpy.context.active_object` does not exist yet and
    every glTF export raises AttributeError. Headless mode has no such gap.
    Defer to a one-shot timer when running with a UI so the exports and the
    Rodin submit both see a real context -- and the process stays alive
    afterwards, which is exactly what the Chrome handoff needs.
    """
    import bpy

    if bpy.app.background:
        run()
        return
    def _deferred():
        try:
            run()
        except Exception:
            import traceback
            traceback.print_exc()
        return None
    # The bridge pushes a task to whichever plugin client is connected AT THAT
    # MOMENT; a client that connects afterwards never receives the pending task.
    # Holding the first submit gives the browser time to attach.
    delay = 2.0
    argv = script_args()
    if "--submit-delay" in argv:
        try:
            delay = float(argv[argv.index("--submit-delay") + 1])
        except (IndexError, ValueError):
            pass
    print(f"[rodin] bridge up; first submit in {delay:.0f}s -- connect the plugin page now")
    bpy.app.timers.register(_deferred, first_interval=delay)


if __name__ == "__main__":
    _main()
