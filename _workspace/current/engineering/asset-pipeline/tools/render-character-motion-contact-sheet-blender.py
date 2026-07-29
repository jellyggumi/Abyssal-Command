#!/usr/bin/env python3
"""Render one labeled key pose per runtime clip from a character motion GLB."""

from __future__ import annotations

import argparse
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
    parser.add_argument("--model", required=True)
    parser.add_argument("--asset-id", required=True)
    parser.add_argument("--out-dir", required=True)
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
        armature.animation_data.action = action
        scene.frame_set(frame)
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


def main() -> int:
    args = parse_args()
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
    armature = next((obj for obj in scene.objects if obj.type == "ARMATURE"), None)
    if armature is None:
        raise RuntimeError("model has no armature")
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
        armature.animation_data.action = action
        scene.frame_set(frame)
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
