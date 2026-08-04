#!/usr/bin/env python3
"""Audit measured mesh/texture/rig/animation detail for every runtime character GLB.

This is a read-only measurement pass ahead of the texture/mesh/motion detail
uplift work: it imports each of the 24 character GLBs under
``assets/images/battle/glb/{bosses,commander,companions,enemies}/`` into a
clean headless Blender scene and records what is *actually* on disk --
vertex/polygon/triangle counts, UV-layer presence, per-material Base Color
texture resolution, armature bone counts, and every animation clip's frame
range/duration. It never imports, modifies, or exports anything back into
``assets/images/battle/glb/``; the only write is the JSON report below.

Run (headless Blender, no base .blend needed -- starts from Blender's empty
default scene and imports one GLB at a time)::

  /Applications/Blender.app/Contents/MacOS/Blender --background --python \
    scripts/audit-mesh-detail-blender.py -- \
    --out _workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline/mesh-detail-audit.json

Optional ``--glbs`` accepts a comma-separated override list; it defaults to
every GLB directly under the four character category directories (the same
set produced by
``find assets/images/battle/glb -name '*.glb' | grep -vE 'previs|props|terrain|vfx'``).
"""

import sys
import argparse
import hashlib
import json
from pathlib import Path

import bpy

RUNTIME_ROOT = Path("assets/images/battle/glb")
CHARACTER_CATEGORIES = ("bosses", "commander", "companions", "enemies")
DEFAULT_OUT = Path(
    "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline/mesh-detail-audit.json"
)


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    p = argparse.ArgumentParser()
    p.add_argument(
        "--glbs",
        default=None,
        help="comma-separated GLB paths; defaults to every bosses/commander/companions/enemies GLB",
    )
    p.add_argument("--out", default=str(DEFAULT_OUT))
    return p.parse_args(argv)


def discover_glbs():
    paths = []
    for category in CHARACTER_CATEGORIES:
        paths.extend(sorted((RUNTIME_ROOT / category).glob("*.glb")))
    return paths


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def measure_geometry(mesh_objects):
    vert_total = 0
    poly_total = 0
    tri_total = 0
    uv_layer_counts = []
    active_uv_names = []
    for obj in mesh_objects:
        mesh = obj.data
        vert_total += len(mesh.vertices)
        poly_total += len(mesh.polygons)
        mesh.calc_loop_triangles()
        tri_total += len(mesh.loop_triangles)
        uv_layer_counts.append(len(mesh.uv_layers))
        if mesh.uv_layers.active is not None:
            active_uv_names.append(mesh.uv_layers.active.name)
    return {
        "vertexCount": vert_total,
        "polygonCount": poly_total,
        "triangleCount": tri_total,
        "meshObjectCount": len(mesh_objects),
        "uvLayerCount": max(uv_layer_counts) if uv_layer_counts else 0,
        "hasUv": any(count > 0 for count in uv_layer_counts),
        "activeUvMaps": active_uv_names,
    }


def _base_color_image(material):
    """Only follows the direct image->Base Color link this pipeline authors
    (see apply-cartoon-texture-blender.py's ``_toon_material``); it does not
    attempt to resolve arbitrary shader graphs."""
    if not material.use_nodes or material.node_tree is None:
        return None
    principled = next(
        (n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None
    )
    if principled is None:
        return None
    base_color_input = principled.inputs.get("Base Color")
    if base_color_input is None or not base_color_input.is_linked:
        return None
    source = base_color_input.links[0].from_node
    if source.type == "TEX_IMAGE" and source.image is not None:
        return source.image
    return None


def measure_materials(mesh_objects):
    seen = set()
    materials = []
    for obj in mesh_objects:
        for slot in obj.material_slots:
            mat = slot.material
            if mat is None or mat.name in seen:
                continue
            seen.add(mat.name)
            entry = {
                "name": mat.name,
                "useNodes": bool(mat.use_nodes),
                "baseColorFactor": None,
                "roughness": None,
                "metallic": None,
                "baseColorTexture": None,
            }
            if mat.use_nodes and mat.node_tree is not None:
                principled = next(
                    (n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"),
                    None,
                )
                if principled is not None:
                    base_color_input = principled.inputs.get("Base Color")
                    if base_color_input is not None and not base_color_input.is_linked:
                        entry["baseColorFactor"] = [
                            round(v, 5) for v in base_color_input.default_value
                        ]
                    roughness_input = principled.inputs.get("Roughness")
                    if roughness_input is not None:
                        entry["roughness"] = round(float(roughness_input.default_value), 5)
                    metallic_input = principled.inputs.get("Metallic")
                    if metallic_input is not None:
                        entry["metallic"] = round(float(metallic_input.default_value), 5)
            image = _base_color_image(mat)
            if image is not None:
                entry["baseColorTexture"] = {
                    "name": image.name,
                    "width": image.size[0],
                    "height": image.size[1],
                    "channels": image.channels,
                    "packed": bool(image.packed_file),
                }
            materials.append(entry)
    return materials


def measure_armature(armature_obj):
    if armature_obj is None:
        return {"present": False, "boneCount": 0, "defBoneCount": 0, "boneNames": []}
    bones = armature_obj.data.bones
    def_bones = [bone.name for bone in bones if bone.name.startswith("DEF-")]
    return {
        "present": True,
        "boneCount": len(bones),
        "defBoneCount": len(def_bones),
        "boneNames": sorted(bone.name for bone in bones),
    }


def measure_animations(scene):
    fps = scene.render.fps / scene.render.fps_base if scene.render.fps_base else float(scene.render.fps)
    animations = []
    for action in bpy.data.actions:
        start, end = action.frame_range
        frame_count = int(round(end - start)) + 1
        animations.append(
            {
                "name": action.name,
                "frameStart": round(float(start), 3),
                "frameEnd": round(float(end), 3),
                "frameCount": frame_count,
                "fps": round(fps, 4),
                "durationSeconds": round(frame_count / fps, 4) if fps else None,
            }
        )
    return sorted(animations, key=lambda item: item["name"])


def audit_glb(path):
    relative_path = f"{path.parent.name}/{path.name}"
    base = {
        "assetId": path.stem,
        "category": path.parent.name,
        "relativePath": relative_path,
        "sourcePath": str(path),
        "sourceSha256": sha256(path),
        "sourceBytes": path.stat().st_size,
    }
    clear_scene()
    scene = bpy.context.scene
    try:
        # `guess_original_bind_pose=False` — see
        # `scripts/measure-joint-articulation.py:113-122`. This audit reads
        # `armature.data.bones`, i.e. the rest pose itself.
        bpy.ops.import_scene.gltf(
            filepath=str(path),
            guess_original_bind_pose=False,
            bone_heuristic="BLENDER",
        )
    except Exception as exc:  # noqa: BLE001 - report and continue the audit
        base["error"] = f"import failed: {exc}"
        return base

    mesh_objects = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    armature_objects = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if not mesh_objects:
        base["error"] = "no mesh objects imported"
        return base

    base.update(measure_geometry(mesh_objects))
    base["materials"] = measure_materials(mesh_objects)
    base["armature"] = measure_armature(armature_objects[0] if armature_objects else None)
    animations = measure_animations(scene)
    base["animationClipCount"] = len(animations)
    base["animations"] = animations
    return base


def main():
    args = parse_args()
    if args.glbs:
        paths = [Path(p.strip()) for p in args.glbs.split(",") if p.strip()]
    else:
        paths = discover_glbs()
    if not paths:
        raise SystemExit("no GLB paths resolved for audit")

    results = []
    for path in paths:
        print(f"AUDITING {path}")
        result = audit_glb(path)
        results.append(result)
        if "error" in result:
            print(f"ERROR {path}: {result['error']}")
        else:
            print(
                "DONE "
                f"{result['assetId']}: verts={result['vertexCount']} "
                f"polys={result['polygonCount']} tris={result['triangleCount']} "
                f"uv={result['hasUv']} bones={result['armature']['boneCount']} "
                f"clips={result['animationClipCount']}"
            )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "schemaVersion": 1,
        "generator": "scripts/audit-mesh-detail-blender.py",
        "measurementTool": f"Blender {bpy.app.version_string} headless bpy import",
        "runtimeRoot": str(RUNTIME_ROOT),
        "assetCount": len(results),
        "assets": results,
    }
    out_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"AUDIT_DONE {out_path}")


if __name__ == "__main__":
    main()
