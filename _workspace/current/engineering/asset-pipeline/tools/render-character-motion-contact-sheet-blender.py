#!/usr/bin/env python3
"""Render one labeled key pose per runtime clip from a character motion GLB."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector


REPO_ROOT = Path(__file__).resolve().parents[5]
ACTION_ORDER = ("idle", "move", "run", "hit", "bighit", "attack", "critical", "avoid", "defence", "die", "show")

# Pose-pairs (semantic) constants. IMPORTER_METRIC_TOLERANCE_DEG is the same
# 0.001 deg gate the static-pose policy requires in both spaces; a selected bone
# whose source residuals are both inside it has nothing to visualize, so the
# renderer takes the zero-residual no-op path instead of assigning a pose.
DEFAULT_CAMERA_DIRECTION = (0.48, -1.0, 0.12)
IMPORTER_METRIC_TOLERANCE_DEG = 0.001
ORTHO_SPAN_MULTIPLIER = 1.18
BONE_LOCAL_CROP = "selected-bone-head-tail-and-direct-influence-vertices-pre-post"
POSE_PAIR_PASS_THRESHOLD = 1.0
# The rendered rotation is compared against the requested one at this bound. It
# is deliberately far looser than the 0.001 deg metric gate: `2*acos(|dot|)`
# cannot resolve a near-identity angle below roughly 0.05 deg in float32, so a
# tighter limit would reject correct poses. It is still ~180x tighter than the
# wrong-basis write it exists to catch.
POSE_APPLICATION_TOLERANCE_DEG = 0.05
# Emitted key order for a pair row. Pinned explicitly rather than left to dict
# insertion order: fields are filled from several branches (and one is seeded
# before the render so a failed row still carries it), so insertion order would
# silently differ between a passing and a failing row.
PAIR_ROW_KEY_ORDER = (
    "actorId",
    "bone",
    "rank",
    "frame",
    "restResidualDeg",
    "localRestResidualDeg",
    "selectionReasons",
    "pair",
    "actorModel",
    "status",
    "actorModelSha256",
    "visualizationMetric",
    "encoding",
    "zeroResidualNoOp",
    "transformProvenance",
    "boneLocalFraming",
    "panels",
    "preWorldResidualDeg",
    "preLocalResidualDeg",
    "postWorldResidualDeg",
    "postLocalResidualDeg",
    "appliedDeltaQuaternion",
    "appliedDeltaDeg",
)


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
    # Registered unconditionally so an out-of-mode use is rejected by this tool
    # with a diagnosable message instead of argparse's "unrecognized arguments".
    # One comma-separated token rather than nargs=3: a bare `-1.0` is ambiguous
    # with an option flag under argparse and silently misparses the y component.
    parser.add_argument("--camera-direction")
    return parser.parse_args(script_args())


def parse_camera_direction(raw: str | None) -> tuple[float, float, float]:
    """Validate `--camera-direction`; reject before any import or render.

    A degenerate direction cannot aim a camera, so a non-3-component, non-finite
    or zero vector is refused here rather than producing an unusable render.
    """
    if raw is None:
        return DEFAULT_CAMERA_DIRECTION
    parts = [component.strip() for component in str(raw).split(",")]
    if len(parts) != 3:
        raise RuntimeError(
            f"--camera-direction must be three comma-separated numbers, got {len(parts)}: {raw!r}"
        )
    values = []
    for component in parts:
        try:
            value = float(component)
        except ValueError as exc:
            raise RuntimeError(f"--camera-direction component is not a number: {component!r}") from exc
        if not math.isfinite(value):
            raise RuntimeError(f"--camera-direction component is not finite: {component!r}")
        values.append(value)
    if all(value == 0.0 for value in values):
        raise RuntimeError("--camera-direction must not be the zero vector")
    return (values[0], values[1], values[2])


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


def build_pose_pair_sheet(pre: Path, post: Path, output: Path) -> None:
    """Compose the PRE|POST pair at full 640x640 per panel (1280x640 total).

    Kept separate from `build_contact_sheet`, which downscales to 320x320 for an
    11-up grid; a two-panel alignment comparison must not lose that resolution.
    """
    import shutil
    import subprocess

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise RuntimeError("ffmpeg is required to assemble the pose pair")
    command = [
        ffmpeg, "-y", "-i", str(pre), "-i", str(post),
        "-filter_complex", "[0:v][1:v]hstack=inputs=2[v]",
        "-map", "[v]", "-frames:v", "1", "-update", "1", str(output),
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"pose pair assembly failed: {exc.stderr.strip()}") from exc


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def repo_path(path: Path, label: str) -> Path:
    resolved = path.resolve()
    try:
        resolved.relative_to(REPO_ROOT)
    except ValueError as exc:
        raise RuntimeError(f"{label} must stay under repository root {REPO_ROOT}: {resolved}") from exc
    return resolved


def import_actor_gltf(path: Path) -> None:
    # `guess_original_bind_pose` must stay False. Left at its default, Blender
    # rebuilds the armature rest pose from the inverse bind matrices instead of
    # reading `node.rotation`, so a rig whose rest pose was corrected without
    # rebaking its IBMs is silently re-posed back to the pre-correction pose and
    # measured as if the correction never happened. Same rule and reason as
    # `scripts/measure-joint-articulation.py:113-122`.
    bpy.ops.import_scene.gltf(
        filepath=str(path),
        guess_original_bind_pose=False,
        bone_heuristic="BLENDER",
    )


# ---------------------------------------------------------------------------
# semantic pose-pair geometry
#
# Two distinct quaternion frames are in play and must not be conflated:
#
#   * the REST-CHAIN frame - a bone's parent-relative rest rotation, and the
#     product of those rotations up to the root. Residuals are measured here,
#     matching `scripts/repair-static-rest-pose.py`'s `Rig.local`/`Rig.world`,
#     so a number printed by this tool means the same thing the repair gate
#     means. Components are emitted in glTF order (x, y, z, w).
#   * the RENDERED frame - `pose_bone.matrix.to_quaternion()`, the orientation
#     the camera actually saw. Recorded per panel so PRE/POST are provably
#     different states rather than the same image twice.
# ---------------------------------------------------------------------------


def quaternion_xyzw(quaternion: Quaternion) -> list[float]:
    return [float(quaternion.x), float(quaternion.y), float(quaternion.z), float(quaternion.w)]


def quaternion_angle_deg(left: Quaternion, right: Quaternion) -> float:
    """Shortest-arc angle between two orientations, in degrees.

    `Quaternion.rotation_difference().angle` is NOT usable here: it does not
    take the shortest arc for these inputs and disagrees with the repair gate by
    up to ~356 deg. `abs(dot)` folds q and -q onto the same rotation, which is
    what makes this agree with `repair-static-rest-pose.py:angle_between_deg`.
    """
    dot = min(1.0, abs(left.normalized().dot(right.normalized())))
    return math.degrees(2.0 * math.acos(dot))


def rest_local_quaternion(bone: bpy.types.Bone) -> Quaternion:
    if bone.parent is None:
        return bone.matrix_local.to_quaternion()
    return (bone.parent.matrix_local.inverted() @ bone.matrix_local).to_quaternion()


def rest_world_quaternion(bone: bpy.types.Bone) -> Quaternion:
    quaternion = rest_local_quaternion(bone).copy()
    current = bone.parent
    while current is not None:
        quaternion = rest_local_quaternion(current) @ quaternion
        current = current.parent
    return quaternion


def canonical_quaternion(quaternion: Quaternion) -> Quaternion:
    """Force w >= 0 so a recorded delta is the short way round, not the long."""
    if quaternion.w < 0.0:
        return Quaternion((-quaternion.w, -quaternion.x, -quaternion.y, -quaternion.z))
    return quaternion.copy()


def single_armature(scene: bpy.types.Scene, bone: str, label: str) -> bpy.types.Object:
    armatures = [obj for obj in scene.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"{label} must have exactly one armature, found {len(armatures)}")
    if bone not in armatures[0].pose.bones:
        raise RuntimeError(f"{label} is missing pose-alignment bone: {bone}")
    return armatures[0]


def target_rest_rotations(target_rig: Path, bones: list[str]) -> dict[str, dict[str, Quaternion]]:
    """Snapshot the certified target rig's rest rotations once, up front.

    Copies are taken because the scene is reset per pair; the returned
    quaternions must outlive the datablocks they came from.
    """
    reset_scene()
    import_actor_gltf(target_rig)
    scene = bpy.context.scene
    armatures = [obj for obj in scene.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"target rig must have exactly one armature, found {len(armatures)}")
    bpy.context.view_layer.update()
    armature = armatures[0]
    snapshot: dict[str, dict[str, Quaternion]] = {}
    for name in bones:
        bone = armature.data.bones.get(name)
        if bone is None:
            continue
        snapshot[name] = {
            "local": rest_local_quaternion(bone).copy(),
            "world": rest_world_quaternion(bone).copy(),
        }
    return snapshot


def selected_bone_points(
    scene: bpy.types.Scene,
    armature: bpy.types.Object,
    bone: str,
) -> tuple[list[Vector], int]:
    """The selected bone's head/tail plus every vertex it directly influences.

    "Direct influence" is a non-zero weight in the bone's OWN vertex group -
    descendant-only weights are excluded, so the crop tracks the bone whose
    rotation changed rather than drifting to the whole limb.
    """
    bpy.context.view_layer.update()
    pose_bone = armature.pose.bones[bone]
    points = [
        armature.matrix_world @ pose_bone.head.copy(),
        armature.matrix_world @ pose_bone.tail.copy(),
    ]
    influence = 0
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in scene.objects:
        if obj.type != "MESH":
            continue
        group = obj.vertex_groups.get(bone)
        if group is None:
            continue
        group_index = group.index
        indices = [
            vertex.index
            for vertex in obj.data.vertices
            if any(entry.group == group_index and entry.weight > 0.0 for entry in vertex.groups)
        ]
        if not indices:
            continue
        influence += len(indices)
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            if len(mesh.vertices) != len(obj.data.vertices):
                # Index identity is what lets an original-mesh weight lookup
                # address an evaluated-mesh position. A generative modifier
                # breaks that, so refuse instead of cropping to wrong vertices.
                raise RuntimeError(
                    f"{obj.name}: evaluated vertex count {len(mesh.vertices)} != "
                    f"original {len(obj.data.vertices)}; cannot map bone influence"
                )
            for index in indices:
                points.append(evaluated.matrix_world @ mesh.vertices[index].co.copy())
        finally:
            evaluated.to_mesh_clear()
    if influence == 0:
        raise RuntimeError(f"bone {bone} influences no mesh vertices; nothing to frame")
    return points, influence


def bone_local_camera(
    scene: bpy.types.Scene,
    points: list[Vector],
    direction: tuple[float, float, float],
) -> tuple[bpy.types.Object, Vector, Vector]:
    """Frame the union of the PRE and POST crop points.

    Both states share one camera so the two panels are directly comparable; a
    per-state camera would move the subject and make the pair unreadable.
    """
    minimum = Vector((min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector((max(point[axis] for point in points) for axis in range(3)))
    center = (minimum + maximum) * 0.5
    span = max(0.1, max(maximum[axis] - minimum[axis] for axis in range(3)))

    camera_data = bpy.data.cameras.new("MotionPosePairCamera")
    camera = bpy.data.objects.new("MotionPosePairCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.data.type = "ORTHO"
    camera.location = center + Vector(direction).normalized() * (span * 4.0)
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()

    inverse = camera.matrix_world.inverted()
    projected = [inverse @ point for point in points]
    minimum_x = min(point.x for point in projected)
    maximum_x = max(point.x for point in projected)
    minimum_y = min(point.y for point in projected)
    maximum_y = max(point.y for point in projected)
    local_center = Vector(((minimum_x + maximum_x) * 0.5, (minimum_y + maximum_y) * 0.5, 0.0))
    camera.location += camera.matrix_world.to_quaternion() @ local_center
    camera.data.ortho_scale = max(
        max(maximum_x - minimum_x, maximum_y - minimum_y) * ORTHO_SPAN_MULTIPLIER,
        1e-4,
    )
    bpy.context.view_layer.update()
    return camera, minimum, maximum


def apply_world_delta(
    armature: bpy.types.Object,
    bone_name: str,
    world_delta: Quaternion,
) -> None:
    """Left-multiply a world-space rotation onto the selected bone's pose.

    The imported actor is NOT sitting at its armature rest pose - the glTF node
    transforms arrive as a pose over the bind rest - so the correction has to
    compose with that existing pose. Overwriting the pose from a rest-derived
    parent-relative rotation instead re-rotates the bone through its parent
    chain: the residual still reads zero, because that arithmetic is
    self-consistent, while the orientation actually rendered is a different one.

    Location and scale carry through untouched, so the bone turns about its own
    head rather than sliding, the parent keeps its transform, and descendants
    inherit the rotation.
    """
    pose_bone = armature.pose.bones[bone_name]
    location, rotation, scale = pose_bone.matrix.decompose()
    pose_bone.matrix = Matrix.LocRotScale(location, world_delta @ rotation, scale)
    bpy.context.view_layer.update()


def rendered_world_quaternion(armature: bpy.types.Object, bone_name: str) -> Quaternion:
    """The orientation the camera samples for this bone as the scene stands."""
    return armature.pose.bones[bone_name].matrix.to_quaternion()


def render_semantic_pose_pair(
    actor_model: Path,
    bone: str,
    target: dict[str, Quaternion],
    pre_output: Path,
    post_output: Path,
    pair_output: Path,
    actor_label: str,
    direction: tuple[float, float, float],
) -> dict:
    """Render ONE actor twice: its own rest pose, then that bone target-aligned.

    The discredited shape this replaces imported two different GLBs (target and
    actor), framed whole bodies, and only wrote the bone name into a caption -
    the bone was never transformed and never framed, so the image proved nothing
    about that bone. Here a single actor is rendered in both states, cropped to
    the bone that moved, and every recorded orientation is read back from the
    posed armature rather than predicted.
    """
    reset_scene()
    import_actor_gltf(actor_model)
    scene = bpy.context.scene
    armature = single_armature(scene, bone, f"actor {actor_model.name}")
    bpy.context.view_layer.update()

    data_bone = armature.data.bones[bone]
    pose_bone = armature.pose.bones[bone]
    pre_local = rest_local_quaternion(data_bone).copy()
    pre_world = rest_world_quaternion(data_bone).copy()
    parent_rest_world = (
        rest_world_quaternion(data_bone.parent).copy()
        if data_bone.parent is not None
        else Quaternion((1.0, 0.0, 0.0, 0.0))
    )

    imported_pre_world = quaternion_angle_deg(pre_world, target["world"])
    imported_pre_local = quaternion_angle_deg(pre_local, target["local"])

    # A world delta is degenerate once the world metric is already inside
    # tolerance, so visualize whichever space still carries the error.
    metric = "local" if (
        imported_pre_world <= IMPORTER_METRIC_TOLERANCE_DEG
        and imported_pre_local > IMPORTER_METRIC_TOLERANCE_DEG
    ) else "world"
    zero_no_op = (
        imported_pre_world <= IMPORTER_METRIC_TOLERANCE_DEG
        and imported_pre_local <= IMPORTER_METRIC_TOLERANCE_DEG
    )

    original_matrix = pose_bone.matrix.copy()

    # The pose is expressed as the rest-chain orientation the bone must reach,
    # in BOTH spaces, rather than as a delta that later has to be undone to find
    # out where the bone ended up. Composing `target @ pre.inverted() @ pre` to
    # recover it instead costs an inverse and a product in float32 and drifts up
    # to ~0.06 deg - enough to fail the 0.001 deg gate on a correct pose.
    if zero_no_op:
        # Nothing to correct. Assigning a pose anyway would fabricate a visible
        # difference between two identical states, so the original matrix drives
        # both panels and that fact is recorded rather than implied.
        world_delta = None
        recorded_delta = Quaternion((1.0, 0.0, 0.0, 0.0))
        desired_world = pre_world.copy()
        desired_local = pre_local.copy()
    else:
        if metric == "world":
            desired_world = target["world"].copy()
            desired_local = parent_rest_world.inverted() @ target["world"]
            recorded_delta = canonical_quaternion(target["world"] @ pre_world.inverted())
        else:
            # Align the parent-relative rotation; its world consequence follows
            # from the untouched parent chain.
            desired_local = target["local"].copy()
            desired_world = parent_rest_world @ target["local"]
            recorded_delta = canonical_quaternion(target["local"].inverted() @ pre_local)
        world_delta = desired_world @ pre_world.inverted()

    pre_points, influence = selected_bone_points(scene, armature, bone)
    pre_rendered = rendered_world_quaternion(armature, bone).copy()

    if world_delta is None:
        post_points = list(pre_points)
        post_rendered = pre_rendered.copy()
    else:
        apply_world_delta(armature, bone, world_delta)
        post_points, _ = selected_bone_points(scene, armature, bone)
        post_rendered = rendered_world_quaternion(armature, bone).copy()
        pose_bone.matrix = original_matrix.copy()
        bpy.context.view_layer.update()

    # The pose write is verified against the armature rather than trusted. The
    # rotation the render actually shows (post over pre, both sampled from
    # `pose_bone.matrix`) must be the rotation that was asked for; the earlier
    # wrong-basis write passed every residual check while disagreeing here by
    # ~9 deg, so this is the assertion that catches it.
    if world_delta is not None:
        achieved = post_rendered @ pre_rendered.inverted()
        drift = quaternion_angle_deg(achieved, world_delta)
        if drift > POSE_APPLICATION_TOLERANCE_DEG:
            raise RuntimeError(
                f"KG_POSE_APPLY: rendered rotation differs from the requested delta by "
                f"{drift:.6f} deg (limit {POSE_APPLICATION_TOLERANCE_DEG}); the POST panel "
                f"does not show the alignment this row records"
            )

    # Residuals stay in the rest-chain frame they were defined in - the frame
    # `repair-static-rest-pose.py` gates on - and are read off the orientation
    # the bone was placed at. Re-deriving them from the float32 rendered
    # quaternions instead adds ~0.04 deg of noise, because `2*acos(|dot|)` is
    # ill-conditioned near identity and cannot resolve a near-zero angle to
    # better than roughly 0.05 deg. That noise is not a measurement: it would
    # fail correct poses. Whether the render actually reached this orientation
    # is proven separately, by KG_POSE_APPLY above, against the real armature.
    post_world_residual = quaternion_angle_deg(desired_world, target["world"])
    post_local_residual = quaternion_angle_deg(desired_local, target["local"])

    camera, world_minimum, world_maximum = bone_local_camera(
        scene, pre_points + post_points, direction
    )
    add_lighting(scene, camera)
    label = add_label(camera)

    panels = []
    for state, output in (("pre", pre_output), ("post", post_output)):
        pose_bone.matrix = original_matrix.copy()
        bpy.context.view_layer.update()
        if state == "post" and world_delta is not None:
            apply_world_delta(armature, bone, world_delta)
        label.data.body = f"{actor_label}  {bone}  {state.upper()}"
        scene.render.filepath = str(output)
        # Read at render time from the object the camera is about to sample, so
        # a panel cannot claim a state it was not rendered in.
        rendered = quaternion_xyzw(rendered_world_quaternion(armature, bone))
        bpy.ops.render.render(write_still=True)
        panels.append({"state": state, "path": None, "renderedSelectedWorldQuaternion": rendered})

    build_pose_pair_sheet(pre_output, post_output, pair_output)

    return {
        "visualizationMetric": metric,
        "encoding": f"{metric}-quaternion-delta",
        "zeroResidualNoOp": zero_no_op,
        "transformProvenance": {
            "encoding": f"{metric}-quaternion-delta",
            "poseAssignment": "skipped-zero-residual" if zero_no_op else "applied",
            "originalMatrixUsedForBothPanels": zero_no_op,
            "targetWorldQuaternion": quaternion_xyzw(target["world"]),
            "targetLocalQuaternion": quaternion_xyzw(target["local"]),
            "actorPreWorldQuaternion": panels[0]["renderedSelectedWorldQuaternion"],
            "actorPostWorldQuaternion": panels[1]["renderedSelectedWorldQuaternion"],
            "importedPreWorldResidualDeg": imported_pre_world,
            "importedPreLocalResidualDeg": imported_pre_local,
            "importerMetricToleranceDeg": IMPORTER_METRIC_TOLERANCE_DEG,
            "parentTransformUntouched": True,
            "descendantsInheritSelectedBoneTransform": True,
        },
        "boneLocalFraming": {
            "bone": bone,
            "crop": BONE_LOCAL_CROP,
            "pointCount": len(pre_points) + len(post_points),
            "worldMinimum": [float(value) for value in world_minimum],
            "worldMaximum": [float(value) for value in world_maximum],
            "cameraOrthoScale": float(camera.data.ortho_scale),
            "influenceCount": influence,
            "directInfluenceCount": influence,
        },
        "panels": panels,
        "postWorldResidualDeg": post_world_residual,
        "postLocalResidualDeg": post_local_residual,
        "appliedDeltaQuaternion": quaternion_xyzw(recorded_delta),
        "appliedDeltaDeg": quaternion_angle_deg(recorded_delta, Quaternion((1.0, 0.0, 0.0, 0.0))),
    }


def select_pose_pair_rows(actor_rows: list[dict], worst_n: int) -> list[tuple[dict, list[str]]]:
    """Top-N by world residual UNION top-N by local residual.

    Ranking on the world metric alone hides a bone that is locally wrong but
    world-correct through a compensating parent, and vice versa; the union keeps
    both failure shapes visible and names which list selected each row.
    """
    top_world = sorted(actor_rows, key=lambda row: (-float(row["restResidualDeg"]), row["bone"]))[:worst_n]
    top_local = sorted(actor_rows, key=lambda row: (-float(row["localRestResidualDeg"]), row["bone"]))[:worst_n]
    reasons: dict[str, list[str]] = {}
    for row in top_world:
        reasons.setdefault(row["bone"], []).append("restResidualDeg")
    for row in top_local:
        reasons.setdefault(row["bone"], []).append("localRestResidualDeg")
    selected = [row for row in actor_rows if row["bone"] in reasons]
    selected.sort(
        key=lambda row: (
            -max(float(row["restResidualDeg"]), float(row["localRestResidualDeg"])),
            row["bone"],
        )
    )
    return [(row, reasons[row["bone"]]) for row in selected]


def render_pose_pairs(args: argparse.Namespace) -> int:
    if args.target_rig is None or args.actors_root is None or args.out is None:
        raise RuntimeError("--pose-pairs requires --target-rig, --actors-root, and --out")
    if args.worst_n <= 0:
        raise RuntimeError("--worst-n must be positive")
    direction = parse_camera_direction(args.camera_direction)
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

    source_rows = residuals.get("rows", [])
    grouped: dict[str, list[dict]] = {}
    for row in source_rows:
        grouped.setdefault(row["actorId"], []).append(row)
    if not grouped:
        raise RuntimeError("static-rest-residuals contains no rows")
    residual_actor_count = len(grouped)

    # An actor whose model IS the target rig would be compared against itself:
    # every residual is zero by construction, so it is excluded before selection
    # rather than being reported as a passing alignment it never demonstrated.
    excluded_references = []
    candidates: dict[str, list[dict]] = {}
    for actor_id in sorted(grouped):
        actor_model = actors_root / actor_id / "model.glb"
        actor_sha = file_sha256(actor_model) if actor_model.is_file() else None
        if actor_sha == target_sha:
            excluded_references.append({
                "actorId": actor_id,
                "actorModelSha256": actor_sha,
                "reason": "self-target reference",
            })
            continue
        candidates[actor_id] = grouped[actor_id]
    if not candidates:
        raise RuntimeError("every residual actor is the target rig itself; nothing to compare")

    candidate_row_count = sum(len(rows) for rows in candidates.values())
    derivation = {
        "kind": "actor-exclusion",
        "source": str(residuals_path.relative_to(REPO_ROOT)),
        "sourceSha256": file_sha256(residuals_path),
        "selection": (
            "exclude actors whose existing model SHA-256 equals targetRigSha256; "
            "retain all other rows, preserving source row order"
        ),
        "sourceRowCount": len(source_rows),
        "candidateRowCount": candidate_row_count,
        "candidateActorCount": len(candidates),
        "exclusionSelection": "existing actor model SHA-256 equals targetRigSha256",
        "excludedReferences": excluded_references,
    }

    plan: list[tuple[str, int, dict, list[str]]] = []
    for actor_id in sorted(candidates):
        for rank, (row, reasons) in enumerate(select_pose_pair_rows(candidates[actor_id], args.worst_n), start=1):
            plan.append((actor_id, rank, row, reasons))

    target_cache = target_rest_rotations(target_rig, sorted({row["bone"] for _, _, row, _ in plan}))

    out.mkdir(parents=True, exist_ok=True)
    pair_rows = []
    zero_no_op_rows = []
    for actor_id, rank, row, reasons in plan:
        bone = row["bone"]
        actor_model = actors_root / actor_id / "model.glb"
        pair_dir = out / actor_id
        pair_dir.mkdir(parents=True, exist_ok=True)
        pair = pair_dir / f"{rank:02d}-{bone}-pair.png"
        pre = pair_dir / f"{rank:02d}-{bone}-pair-pre.png"
        post = pair_dir / f"{rank:02d}-{bone}-pair-post.png"
        source_world = float(row["restResidualDeg"])
        source_local = float(row["localRestResidualDeg"])
        # Decided from the source metrics, before any import, so the record is
        # the same whether or not the render later succeeds.
        source_zero_no_op = (
            source_world <= IMPORTER_METRIC_TOLERANCE_DEG
            and source_local <= IMPORTER_METRIC_TOLERANCE_DEG
        )
        if source_zero_no_op:
            zero_no_op_rows.append({
                "actorId": actor_id,
                "bone": bone,
                "rank": rank,
                "restResidualDeg": source_world,
                "localRestResidualDeg": source_local,
            })
        entry = {
            "actorId": actor_id,
            "bone": bone,
            "rank": rank,
            "frame": 0,
            "restResidualDeg": row["restResidualDeg"],
            "localRestResidualDeg": row["localRestResidualDeg"],
            "selectionReasons": reasons,
            "pair": str(pair.relative_to(REPO_ROOT)),
            "actorModel": str(actor_model.relative_to(REPO_ROOT)),
            "status": "failed",
            # Seeded from the source metrics before any import so a row that
            # fails to render still reports which path it was on, matching
            # `zeroNoOpCandidateRows`. Overwritten with the measured value on a
            # successful render.
            "zeroResidualNoOp": source_zero_no_op,
        }
        try:
            if not actor_model.is_file():
                raise RuntimeError(f"actor model missing: {actor_model}")
            entry["actorModelSha256"] = file_sha256(actor_model)
            if bone not in target_cache:
                raise RuntimeError(f"target rig is missing pose-alignment bone: {bone}")
            measured = render_semantic_pose_pair(
                actor_model, bone, target_cache[bone], pre, post, pair,
                actor_id.upper(), direction,
            )
            for panel, path in zip(measured["panels"], (pre, post)):
                panel["path"] = str(path.relative_to(REPO_ROOT))
                panel["actorModelSha256"] = entry["actorModelSha256"]
                # Key order: state, path, actorModelSha256, renderedSelected...
                panel_order = ("state", "path", "actorModelSha256", "renderedSelectedWorldQuaternion")
                for key in panel_order:
                    panel[key] = panel.pop(key)
            entry["visualizationMetric"] = measured["visualizationMetric"]
            entry["encoding"] = measured["encoding"]
            entry["zeroResidualNoOp"] = measured["zeroResidualNoOp"]
            entry["transformProvenance"] = measured["transformProvenance"]
            entry["boneLocalFraming"] = measured["boneLocalFraming"]
            entry["panels"] = measured["panels"]
            entry["preWorldResidualDeg"] = row["restResidualDeg"]
            entry["preLocalResidualDeg"] = row["localRestResidualDeg"]
            entry["postWorldResidualDeg"] = measured["postWorldResidualDeg"]
            entry["postLocalResidualDeg"] = measured["postLocalResidualDeg"]
            entry["appliedDeltaQuaternion"] = measured["appliedDeltaQuaternion"]
            entry["appliedDeltaDeg"] = measured["appliedDeltaDeg"]
            selected_post = (
                measured["postWorldResidualDeg"]
                if measured["visualizationMetric"] == "world"
                else measured["postLocalResidualDeg"]
            )
            if not measured["zeroResidualNoOp"] and selected_post > IMPORTER_METRIC_TOLERANCE_DEG:
                # The POST panel is only evidence if it actually resolved the
                # metric being visualized. Unresolved means the pair is not
                # proof, so it is recorded as failed rather than shipped.
                raise RuntimeError(
                    f"KG_POSE_METRIC: {measured['visualizationMetric']} residual "
                    f"{selected_post:.6f} deg exceeds {IMPORTER_METRIC_TOLERANCE_DEG} deg after alignment"
                )
            entry["status"] = "passed"
        except Exception as exc:  # batch failures are recorded, not aborting
            entry["error"] = str(exc)
        ordered = {key: entry[key] for key in PAIR_ROW_KEY_ORDER if key in entry}
        # Anything the contract does not name (currently only `error`) trails it
        # rather than being dropped.
        ordered.update({key: value for key, value in entry.items() if key not in ordered})
        pair_rows.append(ordered)

    passed = [row for row in pair_rows if row["status"] == "passed"]
    actor_coverage = {
        actor_id: any(row["actorId"] == actor_id for row in passed)
        for actor_id in sorted(candidates)
    }
    manifest = {
        "schemaVersion": 2,
        "kind": "pose-pairs",
        "targetRig": str(target_rig.relative_to(REPO_ROOT)),
        "targetRigSha256": target_sha,
        "residuals": str(residuals_path.relative_to(REPO_ROOT)),
        "residualsSha256": file_sha256(residuals_path),
        "actorsRoot": str(actors_root.relative_to(REPO_ROOT)),
        "residualActorCount": residual_actor_count,
        "candidateActorCount": len(candidates),
        "excludedReferences": excluded_references,
        "derivation": derivation,
        "camera": {
            "type": "ORTHO",
            "direction": [float(value) for value in direction],
            "boneLocalCrop": BONE_LOCAL_CROP,
            "orthoSpanMultiplier": ORTHO_SPAN_MULTIPLIER,
        },
        "lighting": {"keyEnergy": 1100.0, "fillEnergy": 650.0},
        "resolution": [640, 640],
        "pairs": pair_rows,
        "passedPairs": len(passed),
        "totalPairs": len(pair_rows),
        "passThreshold": POSE_PAIR_PASS_THRESHOLD,
        "worstN": args.worst_n,
        "zeroNoOpCandidateRows": zero_no_op_rows,
        "actorCoverage": actor_coverage,
    }
    manifest_path = out / "render-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    # Fail-closed: every selected pair must render. A partial corpus previously
    # passed at 0.9, which let a missing pair be read as a clean run.
    successful = (
        bool(pair_rows)
        and len(passed) == len(pair_rows)
        and all(actor_coverage.values())
    )
    print("MOTION_POSE_PAIR_RESULT_JSON:" + json.dumps({
        "manifest": str(manifest_path),
        "passed": successful,
        "pairs": len(pair_rows),
        "passedPairs": len(passed),
    }))
    return 0 if successful else 2


def main() -> int:
    args = parse_args()
    if args.pose_pairs is not None:
        return render_pose_pairs(args)
    if args.camera_direction is not None:
        raise RuntimeError("--camera-direction is only valid with --pose-pairs")
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
    import_actor_gltf(model)
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


def cli() -> int:
    # Blender swallows an uncaught Python exception under `--background
    # --python` and still exits 0, so a raised RuntimeError would read as
    # success to any caller checking the exit status. Convert it here, and put
    # the message on stderr where Blender does not route tracebacks.
    try:
        return main()
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(cli())
