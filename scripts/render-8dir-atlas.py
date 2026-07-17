"""Blender headless render helpers for Canvas 2D battle art.

Default mode preserves the original one-model 8-direction scene renderer:

    Blender --background <file.blend> --python scripts/render-8dir-atlas.py -- \
        --out /abs/dir --size 256

Pack mode imports each existing Abyssal Command GLB in isolation and converts it
to Canvas-ready transparent PNGs.  Action atlases have eight yaw columns and four
source-frame rows (1, 10, 20, 30); terrain gets one static plate:

    Blender --background --python scripts/render-8dir-atlas.py -- \
        --pack --project-root /abs/Abyssal-Surge --size 128
"""

import argparse
import array
import hashlib
import json
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector


GENERATION_VERSION = "glb-raster-pack-v1"
FRAME_SAMPLES = (1, 10, 20, 30)
YAW_DEGREES = tuple(range(0, 360, 45))


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="/tmp/atlas")
    parser.add_argument("--size", type=int, default=256)
    parser.add_argument("--pack", action="store_true")
    parser.add_argument(
        "--asset-id",
        action="append",
        default=[],
        help="Render one declared asset per invocation; repeatable for bounded chunks.",
    )
    parser.add_argument(
        "--publish",
        action="store_true",
        help="Atomically publish the final manifest/media inventory from completed chunks.",
    )
    parser.add_argument(
        "--project-root",
        default=str(Path(__file__).resolve().parents[1]),
        help="Repository root; defaults to the parent of scripts/.",
    )
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def configure_render(scene, size):
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.045, 0.05, 0.07)


def look_at(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat(
        "-Z", "Y"
    ).to_euler()


def add_deterministic_lights(scene, target, scale):
    """Use explicit lights so embedded PBR textures read under transparent film."""
    target = Vector(target)
    distance = max(scale * 2.5, 4.0)
    lights = (
        ("atlas_key", "AREA", (distance, -distance, distance * 1.5), 1100.0, 5.0),
        ("atlas_fill", "AREA", (-distance, -distance * 0.25, distance), 450.0, 4.0),
        ("atlas_rim", "AREA", (0.0, distance, distance * 1.2), 800.0, 3.0),
        ("atlas_sun", "SUN", (distance, -distance, distance * 2.0), 8.0, None),
    )
    for name, light_type, offset, energy, size in lights:
        data = bpy.data.lights.new(name, light_type)
        data.energy = energy
        if light_type == "AREA":
            data.shape = "DISK"
            data.size = size
        light = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(light)
        light.location = target + Vector(offset)
        look_at(light, target)


def fresh_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.materials, bpy.data.meshes, bpy.data.cameras, bpy.data.lights):
        for item in tuple(block):
            if item.users == 0:
                block.remove(item)


def import_glb(path):
    fresh_scene()
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = tuple(bpy.context.scene.objects)
    if not imported:
        raise RuntimeError(f"GLB import produced no objects: {path}")
    return imported


def find_root(asset_id, imported):
    expected = f"{asset_id}-root"
    root = bpy.data.objects.get(expected)
    if root is None or root not in imported:
        available = ", ".join(sorted(obj.name for obj in imported if obj.parent is None))
        raise RuntimeError(f"Expected root {expected!r}; top-level objects: {available}")
    return root


def find_declared_action(action_name):
    action = bpy.data.actions.get(action_name)
    if action is None:
        available = ", ".join(sorted(action.name for action in bpy.data.actions))
        raise RuntimeError(f"Expected imported action {action_name!r}; actions: {available}")
    return action


def select_clip(imported, root, action_name):
    """Activate the imported NLA export for every animated object.

    Blender's glTF importer may expose a clip as an NLA track or directly as an
    action depending on which channels the GLB contains.  Prefer the named track,
    while assigning the declared action to the named asset root as the reliable
    fallback for root-only clips.
    """
    action = find_declared_action(action_name)
    matching_track = False
    for obj in imported:
        animation = obj.animation_data
        if animation is None:
            continue
        for track in animation.nla_tracks:
            track.mute = True
            if track.name == action_name or any(
                strip.action and strip.action.name == action_name for strip in track.strips
            ):
                track.mute = False
                matching_track = True
        if animation.action is not None:
            animation.action = None
    if not matching_track:
        root.animation_data_create()
        root.animation_data.action = action
    return action


def mesh_bounds(imported, root):
    """Return conservative local bounds, excluding animated root translation."""
    dependency_graph = bpy.context.evaluated_depsgraph_get()
    root_position = root.matrix_world.translation.copy()
    points = []
    for obj in imported:
        if obj.type != "MESH" or obj.hide_render:
            continue
        evaluated = obj.evaluated_get(dependency_graph)
        for corner in evaluated.bound_box:
            points.append(evaluated.matrix_world @ Vector(corner) - root_position)
    if not points:
        raise RuntimeError(f"No visible meshes found for {root.name}")
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return minimum, maximum


def orthographic_scale(imported, root, frames):
    """Fit all source samples, so a clip cannot crop while its root moves."""
    minimum = Vector((float("inf"),) * 3)
    maximum = Vector((float("-inf"),) * 3)
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        low, high = mesh_bounds(imported, root)
        minimum = Vector((min(minimum.x, low.x), min(minimum.y, low.y), min(minimum.z, low.z)))
        maximum = Vector((max(maximum.x, high.x), max(maximum.y, high.y), max(maximum.z, high.z)))
    extent = maximum - minimum
    return max(float(extent.x), float(extent.y), float(extent.z), 1.0) * 1.9


def render_pixels(scene, camera, root, yaw_degrees, frame, size, distance, sample_path):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    root_position = root.matrix_world.translation.copy()
    yaw = math.radians(yaw_degrees)
    elevation = math.radians(30.0)
    horizontal = distance * math.cos(elevation)
    camera.location = root_position + Vector(
        (math.sin(yaw) * horizontal, -math.cos(yaw) * horizontal, distance * math.sin(elevation))
    )
    look_at(camera, root_position)
    scene.render.filepath = str(sample_path)
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(str(sample_path), check_existing=False)
    try:
        if tuple(image.size) != (size, size):
            raise RuntimeError(f"Unexpected render size {tuple(image.size)} for {sample_path}")
        pixels = array.array("f", [0.0]) * (size * size * 4)
        image.pixels.foreach_get(pixels)
        return pixels
    finally:
        bpy.data.images.remove(image, do_unlink=True)
        sample_path.unlink(missing_ok=True)


def pack_atlas(scene, camera, root, samples, size, output_path, is_terrain):
    columns = 1 if is_terrain else len(YAW_DEGREES)
    rows = 1 if is_terrain else len(samples)
    width, height = size * columns, size * rows
    packed = array.array("f", [0.0]) * (width * height * 4)
    source_frames = (1,) if is_terrain else samples
    source_yaws = (0,) if is_terrain else YAW_DEGREES
    distance = camera.data.ortho_scale * 2.5
    sample_path = output_path.with_name(f".{output_path.stem}.sample.png")
    for row, frame in enumerate(source_frames):
        for column, yaw in enumerate(source_yaws):
            pixels = render_pixels(scene, camera, root, yaw, frame, size, distance, sample_path)
            # Blender pixel arrays are bottom-up; row 0 is the top atlas row.
            destination_y = (rows - row - 1) * size
            for pixel_row in range(size):
                source_start = pixel_row * size * 4
                destination_start = ((destination_y + pixel_row) * width + column * size) * 4
                packed[destination_start:destination_start + size * 4] = pixels[source_start:source_start + size * 4]
    image = bpy.data.images.new(f"atlas_{output_path.stem}", width=width, height=height, alpha=True)
    image.pixels.foreach_set(packed)
    image.filepath_raw = str(output_path)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)
    return width, height


def camera_metadata(camera):
    return {
        "projection": "orthographic",
        "elevationDegrees": 30,
        "yawColumnsDegrees": list(YAW_DEGREES),
        "rootTracking": "camera target equals evaluated <asset-id>-root translation for each source sample",
        "orthoScale": round(camera.data.ortho_scale, 6),
    }


def output_record(asset, source_path, source_hash, staged_path, output_path, width, height, clip=None):
    root = f"{asset['id']}-root"
    record = {
        "assetId": asset["id"],
        "category": asset["category"],
        "kind": "terrainPlate" if clip is None else "actionAtlas",
        "source": {
            "path": source_path,
            "sha256": source_hash,
            "root": root,
        },
        "output": {
            "path": output_path,
            "sha256": sha256(staged_path),
            "bytes": os.path.getsize(staged_path),
            "width": width,
            "height": height,
            "mimeType": "image/png",
        },
        "_stagedPath": str(staged_path),
    }
    if clip is None:
        record["frameSamples"] = [1]
        record["layout"] = {"columns": 1, "rows": 1, "cellWidth": width, "cellHeight": height}
        record["camera"] = {
            "projection": "orthographic",
            "elevationDegrees": 30,
            "yawColumnsDegrees": [0],
            "rootTracking": "static terrain root at source frame 1",
        }
    else:
        record["clip"] = clip
        record["action"] = f"{asset['id']}__{clip}"
        record["frameSamples"] = list(FRAME_SAMPLES)
        record["layout"] = {"columns": 8, "rows": len(FRAME_SAMPLES), "cellWidth": width // 8, "cellHeight": height // len(FRAME_SAMPLES)}
    return record


def sync_media_manifest(project_root, records):
    path = project_root / "assets/media-manifest.json"
    payload = json.loads(path.read_text())
    assets = payload["assets"]
    generated_prefix = "assets/images/battle/glb/"
    assets[:] = [entry for entry in assets if not entry["filename"].startswith(generated_prefix)]
    for record in records:
        source = record["source"]["path"]
        output = record["output"]
        description = (
            f"Canvas 2D raster derived by importing {source} with its embedded GLB "
            f"materials/textures and rendering static terrain at frame 1."
            if record["kind"] == "terrainPlate"
            else f"Canvas 2D {record['clip']} atlas derived by importing {source} with its "
            f"embedded GLB materials/textures; 8 yaw columns × {len(record['frameSamples'])} "
            f"source frame(s) {record['frameSamples']}, with camera target tracking "
            f"{record['source']['root']} translation."
        )
        assets.append(
            {
                "filename": output["path"],
                "media_type": "image/png",
                "bytes": output["bytes"],
                "generated_by": f"scripts/render-8dir-atlas.py ({GENERATION_VERSION}; Blender {bpy.app.version_string})",
                "source_key_art": [],
                "source_assets": [source],
                "derivation": description,
                "sha256": output["sha256"],
            }
        )
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, indent=2) + "\n")
    temporary.replace(path)

def write_chunk_records(output_dir, asset_id, records):
    parts_dir = output_dir / ".parts"
    parts_dir.mkdir(exist_ok=True)
    temporary = parts_dir / f"{asset_id}.json.tmp"
    final = parts_dir / f"{asset_id}.json"
    temporary.write_text(json.dumps(records, indent=2) + "\n")
    temporary.replace(final)


def completed_records(project_root, model_manifest, output_dir):
    records = []
    expected_asset_ids = {asset["id"] for asset in model_manifest["assets"]}
    for part in sorted((output_dir / ".parts").glob("*.json")):
        part_records = json.loads(part.read_text())
        if not part_records or any(record["assetId"] != part.stem for record in part_records):
            raise RuntimeError(f"Malformed chunk record file: {part}")
        records.extend(part_records)
    actual_asset_ids = {record["assetId"] for record in records}
    if actual_asset_ids != expected_asset_ids:
        raise RuntimeError(f"Chunk coverage mismatch: expected {sorted(expected_asset_ids)}, got {sorted(actual_asset_ids)}")
    expected_actions = {
        (asset["id"], clip)
        for asset in model_manifest["assets"]
        for clip in asset["actionClips"]
    }
    actual_actions = {
        (record["assetId"], record["clip"])
        for record in records
        if record["kind"] == "actionAtlas"
    }
    terrains = {asset["id"] for asset in model_manifest["assets"] if asset["category"] == "terrain"}
    actual_terrains = {record["assetId"] for record in records if record["kind"] == "terrainPlate"}
    if actual_actions != expected_actions or actual_terrains != terrains:
        raise RuntimeError(
            f"Chunk record coverage mismatch: actions {len(actual_actions)}/{len(expected_actions)}, "
            f"terrain {len(actual_terrains)}/{len(terrains)}"
        )
    for record in records:
        staged = Path(record.get("_stagedPath", ""))
        output = project_root / record["output"]["path"]
        source = project_root / record["source"]["path"]
        candidate = staged if staged.is_file() else output
        if not candidate.is_file() or not source.is_file():
            raise RuntimeError(f"Missing staged/published source artifact for {record['assetId']}")
        if sha256(candidate) != record["output"]["sha256"] or sha256(source) != record["source"]["sha256"]:
            raise RuntimeError(f"Hash mismatch in chunk record for {record['assetId']}")
    return sorted(records, key=lambda record: (record["assetId"], record["kind"], record.get("clip", "")))



def render_pack(project_root, size, asset_ids=(), publish=False):
    model_manifest_path = project_root / "assets/models/abyssal-command/manifest.json"
    model_manifest = json.loads(model_manifest_path.read_text())
    output_dir = project_root / "assets/images/battle/glb"
    output_dir.mkdir(parents=True, exist_ok=True)
    declared_assets = model_manifest["assets"]
    declared_by_id = {asset["id"]: asset for asset in declared_assets}
    unknown = sorted(set(asset_ids) - set(declared_by_id))
    if unknown:
        raise RuntimeError(f"Unknown declared asset IDs: {', '.join(unknown)}")
    assets_to_render = (
        [declared_by_id[asset_id] for asset_id in asset_ids]
        if asset_ids
        else ([] if publish else declared_assets)
    )
    scene = bpy.context.scene
    configure_render(scene, size)
    records = []
    for asset in assets_to_render:
        source_rel = f"assets/models/abyssal-command/{asset['path']}"
        source_path = project_root / source_rel
        source_hash = sha256(source_path)
        imported = import_glb(source_path)
        root = find_root(asset["id"], imported)
        if asset["category"] == "terrain":
            bpy.context.scene.frame_set(1)
            bpy.context.view_layer.update()
            camera_data = bpy.data.cameras.new("atlas_camera")
            camera_data.type = "ORTHO"
            camera_data.ortho_scale = orthographic_scale(imported, root, (1,))
            camera = bpy.data.objects.new("atlas_camera", camera_data)
            bpy.context.collection.objects.link(camera)
            scene.camera = camera
            add_deterministic_lights(scene, root.matrix_world.translation, camera_data.ortho_scale)
            output_rel = f"assets/images/battle/glb/{asset['id']}.png"
            staged_path = output_dir / ".staging" / f"{asset['id']}.png"
            staged_path.parent.mkdir(exist_ok=True)
            width, height = pack_atlas(scene, camera, root, (1,), size, staged_path, True)
            records.append(output_record(asset, source_rel, source_hash, staged_path, output_rel, width, height))
            continue
        if len(asset["actions"]) != len(asset["actionClips"]):
            raise RuntimeError(f"Action declaration mismatch for {asset['id']}")
        for action_name, clip in zip(asset["actions"], asset["actionClips"]):
            select_clip(imported, root, action_name)
            scale = orthographic_scale(imported, root, FRAME_SAMPLES)
            camera_data = bpy.data.cameras.new("atlas_camera")
            camera_data.type = "ORTHO"
            camera_data.ortho_scale = scale
            camera = bpy.data.objects.new("atlas_camera", camera_data)
            bpy.context.collection.objects.link(camera)
            scene.camera = camera
            add_deterministic_lights(scene, root.matrix_world.translation, scale)
            output_rel = f"assets/images/battle/glb/{asset['id']}__{clip}.png"
            staged_path = output_dir / ".staging" / f"{asset['id']}__{clip}.png"
            staged_path.parent.mkdir(exist_ok=True)
            width, height = pack_atlas(scene, camera, root, FRAME_SAMPLES, size, staged_path, False)
            record = output_record(asset, source_rel, source_hash, staged_path, output_rel, width, height, clip)
            record["camera"] = camera_metadata(camera)
            records.append(record)
            bpy.data.objects.remove(camera, do_unlink=True)
            for light in tuple(obj for obj in scene.objects if obj.name.startswith("atlas_") and obj.type == "LIGHT"):
                bpy.data.objects.remove(light, do_unlink=True)
    records.sort(key=lambda record: (record["assetId"], record["kind"], record.get("clip", "")))
    for asset_id in sorted({record["assetId"] for record in records}):
        write_chunk_records(output_dir, asset_id, [record for record in records if record["assetId"] == asset_id])
    if not publish:
        print(
            f"GLB_RASTER_CHUNK assets={len(assets_to_render)} "
            f"action_atlases={sum(record['kind'] == 'actionAtlas' for record in records)} "
            f"terrain_plates={sum(record['kind'] == 'terrainPlate' for record in records)}"
        )
        return
    records = completed_records(project_root, model_manifest, output_dir)
    for record in records:
        staged = Path(record.pop("_stagedPath"))
        destination = project_root / record["output"]["path"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        if staged.is_file():
            staged.replace(destination)
    raster_manifest = {
        "generationVersion": GENERATION_VERSION,
        "generator": "scripts/render-8dir-atlas.py",
        "blenderVersion": bpy.app.version_string,
        "sourceManifest": "assets/models/abyssal-command/manifest.json",
        "atlasLayout": {
            "actionColumns": 8,
            "actionRows": len(FRAME_SAMPLES),
            "frameSamples": list(FRAME_SAMPLES),
            "yawColumnsDegrees": list(YAW_DEGREES),
        },
        "records": records,
    }
    sync_media_manifest(project_root, records)
    manifest_path = output_dir / "manifest.json"
    temporary = manifest_path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(raster_manifest, indent=2) + "\n")
    temporary.replace(manifest_path)
    print(
        f"GLB_RASTER_PACK assets={len(model_manifest['assets'])} "
        f"action_atlases={sum(record['kind'] == 'actionAtlas' for record in records)} "
        f"terrain_plates={sum(record['kind'] == 'terrainPlate' for record in records)} "
        f"outputs={len(records)} manifest={manifest_path}"
    )


def render_scene_directions(out_dir, size):
    """Original one-model scene mode, retained for direct .blend rendering."""
    scene = bpy.context.scene
    configure_render(scene, size)
    pivot = bpy.data.objects.new("atlas_pivot", None)
    bpy.context.collection.objects.link(pivot)
    max_dim = 4.0
    for obj in bpy.context.collection.objects:
        if obj.type == "MESH":
            max_dim = max(max_dim, max(obj.dimensions))
    camera_data = bpy.data.cameras.new("atlas_cam")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max_dim * 1.6
    camera = bpy.data.objects.new("atlas_cam", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.parent = pivot
    distance = max_dim * 4
    pitch = math.radians(60)
    camera.location = (0, -distance * math.sin(pitch), distance * math.cos(pitch))
    camera.rotation_euler = (pitch, 0, 0)
    scene.camera = camera
    for direction in range(8):
        pivot.rotation_euler = (0, 0, math.radians(45 * direction))
        scene.render.filepath = f"{out_dir}/dir{direction}.png"
        bpy.ops.render.render(write_still=True)
    print(f"ATLAS_RESULT dirs=8 size={size} out={out_dir} ortho_scale={camera_data.ortho_scale:.2f}")


args = parse_args()
if args.pack:
    render_pack(Path(args.project_root).resolve(), args.size, args.asset_id, args.publish)
else:
    render_scene_directions(args.out, args.size)
