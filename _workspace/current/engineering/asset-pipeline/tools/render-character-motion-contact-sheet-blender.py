#!/usr/bin/env python3
"""Render one labeled key pose per runtime clip from a character motion GLB."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[5]
ACTION_ORDER = ("idle", "move", "run", "hit", "bighit", "attack", "critical", "avoid", "defence", "die", "show")


def script_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render character motion key poses")
    parser.add_argument("--model")
    parser.add_argument("--asset-id")
    parser.add_argument("--out-dir")
    parser.add_argument("--pose-pairs", type=Path)
    parser.add_argument("--target-rig", type=Path)
    parser.add_argument("--actors-root", type=Path)
    parser.add_argument("--worst-n", type=int, default=5)
    parser.add_argument("--out", type=Path)
    return parser.parse_args(script_args())


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.image_settings.file_format = "PNG"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("MotionReviewWorld")
    scene.world.color = (0.012, 0.016, 0.025)
    scene.view_settings.look = "AgX - Medium High Contrast"


def bind_action_slot(armature: bpy.types.Object, action: bpy.types.Action) -> None:
    armature.animation_data_create()
    animation_data = armature.animation_data
    animation_data.action = action
    candidates = [slot for slot in action.slots if slot.target_id_type == armature.id_type]
    if len(candidates) != 1:
        raise RuntimeError(f"KG_ACTION_SLOT: expected one {armature.id_type} slot for {action.name}, found {len(candidates)}")
    animation_data.action_slot = candidates[0]
    if animation_data.action_slot != candidates[0]:
        raise RuntimeError(f"KG_ACTION_SLOT: failed to bind action slot for {action.name}")


def assert_action_sampled(armature: bpy.types.Object, action: bpy.types.Action, frame: int) -> None:
    animation_data = armature.animation_data
    slot = animation_data.action_slot
    curves = []
    layers = list(getattr(action, "layers", []))
    if layers:
        for layer in layers:
            for strip in layer.strips:
                if strip.type == "KEYFRAME":
                    channelbag = strip.channelbag(slot)
                    if channelbag is not None:
                        curves.extend(channelbag.fcurves)
    else:
        curves.extend(getattr(action, "fcurves", []))
    groups: dict[str, dict[int, bpy.types.FCurve]] = {}
    for curve in curves:
        if "rotation_quaternion" not in curve.data_path:
            continue
        groups.setdefault(curve.data_path, {})[curve.array_index] = curve
    for data_path, group in groups.items():
        if set(group) != {0, 1, 2, 3}:
            raise RuntimeError(f"KG_ACTION_SLOT: incomplete quaternion group in {action.name}: {data_path}")
        bone_name = data_path.split('pose.bones["', 1)[1].split('"]', 1)[0]
        pose_bone = armature.pose.bones.get(bone_name)
        if pose_bone is None:
            raise RuntimeError(f"KG_ACTION_SLOT: action {action.name} targets missing bone {bone_name}")
        expected = [float(group[index].evaluate(frame)) for index in range(4)]
        rest = list(pose_bone.bone.matrix_local.to_quaternion())
        expected_rest_dot = abs(sum(left * right for left, right in zip(expected, rest)))
        if expected_rest_dot < 1.0 - 1e-5:
            actual = list(pose_bone.rotation_quaternion)
            actual_expected_dot = abs(sum(left * right for left, right in zip(actual, expected)))
            if actual_expected_dot < 1.0 - 1e-4:
                raise RuntimeError(f"KG_ACTION_SLOT: sampled animated bone stayed at rest for {action.name}/{bone_name}")
            return

def evaluated_extents(
    scene: bpy.types.Scene,
    armature: bpy.types.Object,
    plans: list[tuple[int, str, bpy.types.Action, int]],
    transform=None,
) -> tuple[Vector, Vector]:
    minimum = Vector((float("inf"), float("inf"), float("inf")))
    maximum = Vector((float("-inf"), float("-inf"), float("-inf")))
    found_vertex = False
    for _, _, action, frame in plans:
        bind_action_slot(armature, action)
        scene.frame_set(frame)
        assert_action_sampled(armature, action, frame)
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        for obj in scene.objects:
            if obj.type != "MESH":
                continue
            evaluated = obj.evaluated_get(depsgraph)
            mesh = evaluated.to_mesh()
            try:
                for vertex in mesh.vertices:
                    point = evaluated.matrix_world @ vertex.co
                    if transform is not None:
                        point = transform @ point
                    for axis in range(3):
                        minimum[axis] = min(minimum[axis], point[axis])
                        maximum[axis] = max(maximum[axis], point[axis])
                    found_vertex = True
            finally:
                evaluated.to_mesh_clear()
    if not found_vertex:
        raise RuntimeError("model has no evaluated mesh vertices")
    return minimum, maximum


def frame_camera(
    scene: bpy.types.Scene,
    armature: bpy.types.Object,
    plans: list[tuple[int, str, bpy.types.Action, int]],
) -> bpy.types.Object:
    minimum, maximum = evaluated_extents(scene, armature, plans)
    center = (minimum + maximum) * 0.5
    span = max(0.1, max(maximum[axis] - minimum[axis] for axis in range(3)))

    camera_data = bpy.data.cameras.new("MotionReviewCamera")
    camera = bpy.data.objects.new("MotionReviewCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.data.type = "ORTHO"
    camera.location = center + Vector((0.48, -1.0, 0.12)).normalized() * (span * 4.0)
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()

    projected_minimum, projected_maximum = evaluated_extents(
        scene,
        armature,
        plans,
        camera.matrix_world.inverted(),
    )
    local_center = Vector((
        (projected_minimum.x + projected_maximum.x) * 0.5,
        (projected_minimum.y + projected_maximum.y) * 0.5,
        0.0,
    ))
    camera.location += camera.matrix_world.to_quaternion() @ local_center
    camera.data.ortho_scale = max(
        projected_maximum.x - projected_minimum.x,
        projected_maximum.y - projected_minimum.y,
    ) * 1.12
    return camera


def add_lighting(scene: bpy.types.Scene, camera: bpy.types.Object) -> None:
    key_data = bpy.data.lights.new("MotionReviewKey", "AREA")
    key_data.energy = 1100.0
    key_data.shape = "DISK"
    key_data.size = 4.0
    key = bpy.data.objects.new("MotionReviewKey", key_data)
    scene.collection.objects.link(key)
    key.location = camera.location + Vector((-1.0, 0.5, 2.0))
    key.rotation_euler = camera.rotation_euler

    fill_data = bpy.data.lights.new("MotionReviewFill", "AREA")
    fill_data.energy = 650.0
    fill_data.size = 3.0
    fill = bpy.data.objects.new("MotionReviewFill", fill_data)
    scene.collection.objects.link(fill)
    fill.location = camera.location + Vector((2.0, 1.0, 0.5))
    fill.rotation_euler = camera.rotation_euler


def add_label(camera: bpy.types.Object) -> bpy.types.Object:
    label_data = bpy.data.curves.new("MotionReviewLabel", "FONT")
    label_data.align_x = "LEFT"
    label_data.align_y = "BOTTOM"
    label_data.size = camera.data.ortho_scale * 0.038
    label_data.extrude = 0.001
    label_data.materials.append(bpy.data.materials.new("MotionReviewLabelMaterial"))
    label_data.materials[0].diffuse_color = (0.92, 0.95, 1.0, 1.0)
    label = bpy.data.objects.new("MotionReviewLabel", label_data)
    bpy.context.scene.collection.objects.link(label)
    label.parent = camera
    label.location = (-camera.data.ortho_scale * 0.47, -camera.data.ortho_scale * 0.45, -2.0)
    label.rotation_euler = (0.0, 0.0, 0.0)
    return label


def build_contact_sheet(images: list[Path], output: Path) -> None:
    import shutil
    import subprocess

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise RuntimeError("ffmpeg is required to assemble the contact sheet")
    command = [ffmpeg, "-y"]
    for image in images:
        command.extend(("-i", str(image)))
    scaled = ";".join(
        f"[{index}:v]scale=320:320:flags=lanczos[s{index}]"
        for index in range(len(images))
    )
    inputs = "".join(f"[s{index}]" for index in range(len(images)))
    layout = "|".join(f"{(index % 4) * 320}_{(index // 4) * 320}" for index in range(len(images)))
    command.extend((
        "-filter_complex",
        f"{scaled};{inputs}xstack=inputs={len(images)}:layout={layout}:fill=0x141820[v]",
        "-map",
        "[v]",
        "-frames:v",
        "1",
        "-update",
        "1",
        str(output),
    ))
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"contact sheet assembly failed: {exc.stderr.strip()}") from exc


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def repo_path(path: Path, label: str) -> Path:
    resolved = path.resolve()
    try:
        resolved.relative_to(REPO_ROOT)
    except ValueError as exc:
        raise RuntimeError(f"{label} must stay under repository root {REPO_ROOT}: {resolved}") from exc
    return resolved


def static_camera(scene: bpy.types.Scene) -> bpy.types.Object:
    minimum = Vector((float("inf"), float("inf"), float("inf")))
    maximum = Vector((float("-inf"), float("-inf"), float("-inf")))
    depsgraph = bpy.context.evaluated_depsgraph_get()
    found = False
    for obj in scene.objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            for vertex in mesh.vertices:
                point = evaluated.matrix_world @ vertex.co
                minimum = Vector((min(minimum[i], point[i]) for i in range(3)))
                maximum = Vector((max(maximum[i], point[i]) for i in range(3)))
                found = True
        finally:
            evaluated.to_mesh_clear()
    if not found:
        raise RuntimeError("model has no evaluated mesh vertices")
    center = (minimum + maximum) * 0.5
    span = max(0.1, max(maximum[axis] - minimum[axis] for axis in range(3)))
    camera_data = bpy.data.cameras.new("MotionPosePairCamera")
    camera = bpy.data.objects.new("MotionPosePairCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = span * 1.18
    camera.location = center + Vector((0.48, -1.0, 0.12)).normalized() * (span * 4.0)
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    return camera


def render_static_pose(model: Path, output: Path, label_text: str, bone: str) -> None:
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(model))
    scene = bpy.context.scene
    armatures = [obj for obj in scene.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1 or bone not in armatures[0].pose.bones:
        raise RuntimeError(f"model must have exactly one armature with pose-alignment bone: {bone}")
    armature = armatures[0]
    camera = static_camera(scene)
    add_lighting(scene, camera)
    label = add_label(camera)
    label.data.body = label_text
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def render_pose_pairs(args: argparse.Namespace) -> int:
    if args.target_rig is None or args.actors_root is None or args.out is None:
        raise RuntimeError("--pose-pairs requires --target-rig, --actors-root, and --out")
    if args.worst_n <= 0:
        raise RuntimeError("--worst-n must be positive")
    residuals_path = repo_path(args.pose_pairs, "pose-pairs")
    target_rig = repo_path(args.target_rig, "target-rig")
    actors_root = repo_path(args.actors_root, "actors-root")
    out = repo_path(args.out, "out")
    residuals = json.loads(residuals_path.read_text())
    provenance_path = target_rig.with_suffix(".provenance.json")
    if not provenance_path.is_file():
        raise RuntimeError(f"KG_TARGET_RIG_HASH: certification provenance missing: {provenance_path}")
    provenance = json.loads(provenance_path.read_text())
    target_sha = file_sha256(target_rig)
    if provenance.get("targetRigSha256") != target_sha or residuals.get("targetRigSha256") != target_sha:
        raise RuntimeError("KG_TARGET_RIG_HASH: target rig hash does not match certification/residual input")
    grouped: dict[str, list[dict]] = {}
    for row in residuals.get("rows", []):
        grouped.setdefault(row["actorId"], []).append(row)
    if not grouped:
        raise RuntimeError("static-rest-residuals contains no rows")
    out.mkdir(parents=True, exist_ok=True)
    pair_rows = []
    for actor_id in sorted(grouped):
        selected = sorted(grouped[actor_id], key=lambda row: (-float(row["restResidualDeg"]), row["bone"]))[:args.worst_n]
        actor_model = actors_root / actor_id / "model.glb"
        for rank, row in enumerate(selected, start=1):
            bone = row["bone"]
            pair_dir = out / actor_id
            pair_dir.mkdir(parents=True, exist_ok=True)
            canonical = pair_dir / f"{rank:02d}-{bone}-canonical.png"
            actor = pair_dir / f"{rank:02d}-{bone}-actor.png"
            entry = {"actorId": actor_id, "bone": bone, "rank": rank, "frame": 0, "restResidualDeg": row["restResidualDeg"],
                     "canonical": str(canonical.relative_to(REPO_ROOT)), "actor": str(actor.relative_to(REPO_ROOT)),
                     "actorModel": str(actor_model.relative_to(REPO_ROOT)), "status": "failed"}
            try:
                if not actor_model.is_file():
                    raise RuntimeError(f"actor model missing: {actor_model}")
                entry["actorModelSha256"] = file_sha256(actor_model)
                render_static_pose(target_rig, canonical, f"CANONICAL  {bone}", bone)
                render_static_pose(actor_model, actor, f"{actor_id.upper()}  {bone}", bone)
                entry["status"] = "passed"
            except Exception as exc:  # batch failures are recorded, not aborting
                entry["error"] = str(exc)
            pair_rows.append(entry)
    passed = [row for row in pair_rows if row["status"] == "passed"]
    actor_coverage = {actor_id: any(row["actorId"] == actor_id for row in passed) for actor_id in grouped}
    manifest = {
        "schemaVersion": 1, "kind": "pose-pairs", "targetRig": str(target_rig.relative_to(REPO_ROOT)),
        "targetRigSha256": target_sha, "residuals": str(residuals_path.relative_to(REPO_ROOT)),
        "residualsSha256": file_sha256(residuals_path), "actorsRoot": str(actors_root.relative_to(REPO_ROOT)),
        "camera": {"type": "ORTHO", "direction": [0.48, -1.0, 0.12], "orthoSpanMultiplier": 1.18},
        "lighting": {"keyEnergy": 1100.0, "fillEnergy": 650.0}, "resolution": [640, 640],
        "pairs": pair_rows, "passedPairs": len(passed), "totalPairs": len(pair_rows),
        "passThreshold": 0.9, "actorCoverage": actor_coverage,
    }
    manifest_path = out / "render-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    successful = bool(pair_rows) and len(passed) / len(pair_rows) >= 0.9 and all(actor_coverage.values())
    print("MOTION_POSE_PAIR_RESULT_JSON:" + json.dumps({"manifest": str(manifest_path), "passed": successful, "pairs": len(pair_rows)}))
    return 0 if successful else 2


def main() -> int:
    args = parse_args()
    if args.pose_pairs is not None:
        return render_pose_pairs(args)
    if args.model is None or args.asset_id is None or args.out_dir is None:
        raise RuntimeError("default contact-sheet mode requires --model, --asset-id, and --out-dir")
    model = Path(args.model).resolve()
    out_dir = Path(args.out_dir).resolve()
    if not model.is_file():
        raise RuntimeError(f"model missing: {model}")
    for label, path in (("model", model), ("out-dir", out_dir)):
        try:
            path.relative_to(REPO_ROOT)
        except ValueError as exc:
            raise RuntimeError(f"{label} must stay under repository root {REPO_ROOT}: {path}") from exc
    keypose_dir = out_dir / "keyposes"
    keypose_dir.mkdir(parents=True, exist_ok=True)

    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(model))
    scene = bpy.context.scene
    armatures = [obj for obj in scene.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"expected one armature, found {len(armatures)}")
    armature = armatures[0]
    armature.animation_data_create()
    for track in list(armature.animation_data.nla_tracks):
        track.mute = True

    plans: list[tuple[int, str, bpy.types.Action, int]] = []
    for index, action_key in enumerate(ACTION_ORDER):
        action_name = f"{args.asset_id}::{action_key}::v01"
        action = bpy.data.actions.get(action_name)
        if action is None:
            raise RuntimeError(f"missing action: {action_name}")
        start, end = [int(round(value)) for value in action.frame_range]
        fraction = 0.4 if action_key in {"idle", "move", "run"} else 0.58
        frame = start + int(round((end - start) * fraction))
        plans.append((index, action_key, action, frame))

    camera = frame_camera(scene, armature, plans)
    add_lighting(scene, camera)
    label = add_label(camera)

    rows = []
    rendered_images: list[Path] = []
    for index, action_key, action, frame in plans:
        bind_action_slot(armature, action)
        scene.frame_set(frame)
        assert_action_sampled(armature, action, frame)
        bpy.context.view_layer.update()
        label.data.body = f"{index + 1:02d}  {action_key.upper()}"
        output = keypose_dir / f"{index:02d}-{action_key}.png"
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        rendered_images.append(output)
        output_relative = str(output.relative_to(REPO_ROOT))
        rows.append({"action": action_key, "clipName": action.name, "frame": frame, "image": output_relative})

    contact_sheet = out_dir / "contact-sheet.png"
    build_contact_sheet(rendered_images, contact_sheet)
    review_path = out_dir / "contact-sheet.json"
    review_path.write_text(json.dumps({
        "assetId": args.asset_id,
        "model": str(model.relative_to(REPO_ROOT)),
        "contactSheet": str(contact_sheet.relative_to(REPO_ROOT)),
        "keyposes": rows,
    }, indent=2) + "\n")
    print("MOTION_CONTACT_RESULT_JSON:" + json.dumps({"assetId": args.asset_id, "keyposes": len(rows), "report": str(review_path)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
