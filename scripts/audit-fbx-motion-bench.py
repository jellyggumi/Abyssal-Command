#!/usr/bin/env python3
"""
Complete FBX motion-bench audit driven by real Blender import observations.

Usage:
  blender --background --python scripts/audit-fbx-motion-bench.py -- \
    --bench-dir assets/motion/bench \
    --output _workspace/current/engineering/asset-pipeline/motion-bench/fbx-audit-report.json
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path
from math import inf

import bpy


FBX_MAGIC_23 = b"Kaydara FBX Binary  \x00\x1a\x00"
EXPECTED_REPORT_COUNT = 42


def parse_args(argv=None):
    """Parse command-line arguments after ``--`` separator."""
    if argv is None:
        argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]

    parser = argparse.ArgumentParser(
        description="Audit all FBX motion-bench files from real Blender import"
    )
    parser.add_argument("--bench-dir", required=True, help="Bench directory path")
    parser.add_argument("--output", required=True, help="Output JSON file path")
    parser.add_argument(
        "--expect-count",
        type=int,
        default=EXPECTED_REPORT_COUNT,
        help=(
            "Exact number of .fbx files the bench must contain. The guard stays "
            "mandatory; widening the corpus is an explicit, recorded choice."
        ),
    )
    return parser.parse_args(argv)


def fbx_version_from_header(fbx_path: Path) -> str:
    """Return FBX version string from the 23-byte header."""
    data = fbx_path.read_bytes()[:64]
    if len(data) < 27:
        return "unknown"

    header = data[:23]
    if header != FBX_MAGIC_23:
        return "unknown"

    version = int.from_bytes(data[23:27], "little")
    major = version // 1000
    minor = (version % 1000) // 100
    patch = version % 100
    return f"{major}.{minor}.{patch}"


def file_hash_sha256(fbx_path: Path) -> str:
    digest = hashlib.sha256()
    with fbx_path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def reset_scene():
    """Reset Blender state for deterministic per-file import."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_fbx(fbx_path: Path):
    """Import one FBX file with deterministic options."""
    return bpy.ops.import_scene.fbx(
        filepath=str(fbx_path),
        use_image_search=False,
        automatic_bone_orientation=True,
    )


def collect_armatures():
    return [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]


def collect_mesh_objects():
    return [obj for obj in bpy.data.objects if obj.type == "MESH"]


def collect_source_actions(armature_obj):
    """Collect animation sources used by an armature (legacy + Blender 5.2 slots)."""
    action_sources = []
    if not armature_obj.animation_data:
        return action_sources

    animation_data = armature_obj.animation_data

    def add_action(action, source):
        if not action:
            return
        if action.name in {entry["name"] for entry in action_sources}:
            return
        frame_start, frame_end = action.frame_range
        frame_start = int(round(float(frame_start)))
        frame_end = int(round(float(frame_end)))
        if frame_end < frame_start:
            frame_start, frame_end = frame_end, frame_start
        if frame_start == frame_end:
            frame_count = 1
        else:
            frame_count = frame_end - frame_start + 1
        action_sources.append(
            {
                "name": action.name,
                "source": source,
                "frame_range": {
                    "start": frame_start,
                    "end": frame_end,
                    "count": frame_count,
                },
            }
        )

    add_action(animation_data.action, "animation_data.action")

    # Blender 5.2 Action Slots support (Blender can expose action slots on animation data)
    if hasattr(animation_data, "action_slots"):
        for idx, slot in enumerate(animation_data.action_slots):
            if getattr(slot, "action", None):
                add_action(slot.action, f"animation_data.action_slots[{idx}]")

    # NLA strips are often populated on some FBX imports
    for track_idx, track in enumerate(getattr(animation_data, "nla_tracks", [])):
        if not track:
            continue
        for strip_idx, strip in enumerate(track.strips):
            if getattr(strip, "action", None):
                add_action(strip.action, f"nla_track[{track_idx}].strip[{strip_idx}]")

    return action_sources


def animation_frame_range(scene, action_sources):
    """Return inclusive frame range covering all known action ranges."""
    candidates = []
    for entry in action_sources:
        fr = entry["frame_range"]
        candidates.append((fr["start"], fr["end"]))

    if not candidates:
        return int(scene.frame_start), int(scene.frame_end)

    frame_start = min(start for start, _ in candidates)
    frame_end = max(end for _, end in candidates)
    if frame_end < frame_start:
        frame_start, frame_end = frame_end, frame_start
    return frame_start, frame_end


def hierarchy_entries(armature_data):
    entries = []
    for bone in armature_data.bones:
        entries.append(
            {
                "name": bone.name,
                "parent": bone.parent.name if bone.parent else None,
                "children": [child.name for child in bone.children],
                "head": [round(float(x), 6) for x in bone.head_local],
                "tail": [round(float(x), 6) for x in bone.tail_local],
            }
        )
    return entries


def hierarchy_hash(entries):
    payload = json.dumps(entries, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def analyze_hips_motion(armature_obj, frame_start, frame_end):
    """
    Sample mixamorig:Hips translation in object-local and world space per frame.
    Ground plane in Blender is X/Y; vertical is Z.
    """
    hips = armature_obj.pose.bones.get("mixamorig:Hips")
    if hips is None:
        return None

    def as_vec3(v):
        return {
            "x": round(float(v.x), 6),
            "y": round(float(v.y), 6),
            "z": round(float(v.z), 6),
        }

    local_min = {"x": inf, "y": inf, "z": inf}
    local_max = {"x": -inf, "y": -inf, "z": -inf}
    world_min = {"x": inf, "y": inf, "z": inf}
    world_max = {"x": -inf, "y": -inf, "z": -inf}

    for frame in range(frame_start, frame_end + 1):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()

        local = hips.matrix_basis.translation
        world = armature_obj.matrix_world @ hips.matrix

        for axis in ("x", "y", "z"):
            lval = float(local.__getattribute__(axis))
            wval = float(world.translation.__getattribute__(axis))
            if lval < local_min[axis]:
                local_min[axis] = lval
            if lval > local_max[axis]:
                local_max[axis] = lval
            if wval < world_min[axis]:
                world_min[axis] = wval
            if wval > world_max[axis]:
                world_max[axis] = wval

    def mins_maxs_to_delta(mn, mx):
        return {
            "min": {
                "x": round(float(mn["x"]), 6),
                "y": round(float(mn["y"]), 6),
                "z": round(float(mn["z"]), 6),
            },
            "max": {
                "x": round(float(mx["x"]), 6),
                "y": round(float(mx["y"]), 6),
                "z": round(float(mx["z"]), 6),
            },
            "delta": {
                axis: round(mx[axis] - mn[axis], 6) for axis in ("x", "y", "z")
            },
        }

    local = mins_maxs_to_delta(local_min, local_max)
    world = mins_maxs_to_delta(world_min, world_max)

    three = {
        "local": {
            "min": {"x": local["min"]["x"], "y": local["min"]["z"], "z": local["min"]["y"]},
            "max": {"x": local["max"]["x"], "y": local["max"]["z"], "z": local["max"]["y"]},
            "delta": {
                "x": local["delta"]["x"],
                "y": local["delta"]["z"],
                "z": local["delta"]["y"],
            },
            "axis_interpretation": "Blender X/Y ground-plane, Z up -> Three.js X/Z ground-plane, Y up",
            "mapping": {
                "blender_x_to_three_x": "same",
                "blender_y_to_three_z": "same",
                "blender_z_to_three_y": "same",
            },
        },
        "world": {
            "min": {"x": world["min"]["x"], "y": world["min"]["z"], "z": world["min"]["y"]},
            "max": {"x": world["max"]["x"], "y": world["max"]["z"], "z": world["max"]["y"]},
            "delta": {
                "x": world["delta"]["x"],
                "y": world["delta"]["z"],
                "z": world["delta"]["y"],
            },
            "axis_interpretation": "Blender X/Y ground-plane, Z up -> Three.js X/Z ground-plane, Y up",
            "mapping": {
                "blender_x_to_three_x": "same",
                "blender_y_to_three_z": "same",
                "blender_z_to_three_y": "same",
            },
        },
    }

    ground_motion = max(abs(local["delta"]["x"]), abs(local["delta"]["y"]))
    hips_travel_type = "travel" if ground_motion > 0.001 else "in-place"

    return {
        "bone_name": "mixamorig:Hips",
        "local": local,
        "world": world,
        "threejs_ground_interpretation": three,
        "ground_motion": {
            "x": round(local["delta"]["x"], 6),
            "y": round(local["delta"]["y"], 6),
            "xz_plane_delta": round(ground_motion, 6),
        },
        "travel_type": hips_travel_type,
    }


def analyze_fbx(fbx_path: Path):
    """Import and analyze one FBX file in an isolated scene."""
    result = {
        "file": fbx_path.name,
        "import_success": False,
        "metrics": {},
        "mesh_presence": False,
        "source_actions": [],
        "fbx_version": None,
        "file_size_bytes": None,
        "file_sha256": None,
        "prop_dependency": {
            "status": "[INFERENCE]",
            "source": "filename-based",
            "value": "inferred from filename tokens",
        },
        "outlier": {
            "is_outlier": False,
            "reasons": [],
        },
    }

    try:
        reset_scene()
        result["fbx_version"] = fbx_version_from_header(fbx_path)
        result["file_size_bytes"] = fbx_path.stat().st_size
        result["file_sha256"] = file_hash_sha256(fbx_path)

        import_result = import_fbx(fbx_path)
        if hasattr(import_result, "get"):
            # Blender may return {'FINISHED'} or bool-like.
            if isinstance(import_result, dict):
                if import_result.get("FINISHED", False) is False:
                    result["error"] = import_result
                    return result
            elif not import_result:
                result["error"] = import_result
                return result

        result["import_success"] = True

        scene = bpy.context.scene
        result["metrics"]["scene_fps"] = int(scene.render.fps)
        armatures = collect_armatures()
        result["armature_count"] = len(armatures)
        result["mesh_presence"] = bool(collect_mesh_objects())
        result["metrics"]["mesh_presence"] = result["mesh_presence"]

        if result["armature_count"] == 0:
            result["import_success"] = False
            result["error"] = "No armature found"
            result["outlier"]["is_outlier"] = True
            result["outlier"]["reasons"].append("No armature in imported FBX")
            return result

        armature_summaries = []
        # Use the armature with the most bones as canonical for metrics.
        primary = max(armatures, key=lambda arm: len(arm.data.bones))
        primary_sources = collect_source_actions(primary)
        result["source_actions"] = primary_sources

        if primary_sources:
            frame_start, frame_end = animation_frame_range(scene, primary_sources)
        else:
            frame_start, frame_end = int(scene.frame_start), int(scene.frame_end)
        if frame_end < frame_start:
            frame_start, frame_end = frame_end, frame_start
        frame_count = frame_end - frame_start + 1 if frame_end >= frame_start else 0
        result["metrics"]["frame_range"] = {
            "start": frame_start,
            "end": frame_end,
            "count": frame_count,
        }

        for armature_obj in armatures:
            armature_data = armature_obj.data
            bones = hierarchy_entries(armature_data)
            bone_names = [bone["name"] for bone in bones]
            bone_hash = hierarchy_hash(bones)
            outlier_reasons = []
            if len(bones) <= 0:
                outlier_reasons.append(f"{armature_obj.name}: empty bone list")
            if not armature_obj.pose.bones.get("mixamorig:Hips"):
                outlier_reasons.append(f"{armature_obj.name}: missing mixamorig:Hips")

            armature_summary = {
                "name": armature_obj.name,
                "bone_count": len(bones),
                "bone_names": bone_names,
                "bone_parent_hierarchy": bones,
                "bone_hierarchy_hash": bone_hash,
                "is_outlier": len(outlier_reasons) > 0,
                "outlier_reasons": outlier_reasons,
            }
            if armature_obj is primary:
                motion = analyze_hips_motion(armature_obj, frame_start, frame_end)
                if motion is None:
                    armature_summary["hips_motion"] = None
                    armature_summary["error"] = "Missing mixamorig:Hips bone"
                    result["outlier"]["is_outlier"] = True
                    result["outlier"]["reasons"].append(
                        f"{armature_obj.name}: missing mixamorig:Hips"
                    )
                else:
                    result["metrics"]["hips_displacement"] = motion
                    result["metrics"]["hips_travel_type"] = motion["travel_type"]

                if frame_count <= 0:
                    result["metrics"]["warning"] = "invalid_frame_range"
            armature_summaries.append(armature_summary)

            if outlier_reasons:
                result["outlier"]["is_outlier"] = True
                result["outlier"]["reasons"].extend(outlier_reasons)

        result["metrics"]["armature_count"] = len(armatures)
        result["metrics"]["armatures"] = armature_summaries

        if not result["source_actions"]:
            result["outlier"]["is_outlier"] = True
            result["outlier"]["reasons"].append("No animation sources found")

        if frame_count <= 0:
            result["metrics"]["frame_range"]["count"] = 1
            result["outlier"]["is_outlier"] = True
            result["outlier"]["reasons"].append("Frame range resolved to zero frames")

    except Exception as e:
        result["import_success"] = False
        result["error"] = str(e)
        result["outlier"]["is_outlier"] = True
        result["outlier"]["reasons"].append(f"Exception: {e}")

    return result


def require_legacy_count(files, expected):
    """Fail early if this is not exactly the expected bench corpus."""
    if len(files) != expected:
        print(
            f"[audit-fbx-motion-bench] Expected {expected} files, "
            f"found {len(files)}"
        )
        return False
    return True


def main():
    """Execute complete audit."""
    args = parse_args()
    bench_dir = Path(args.bench_dir)
    output_file = Path(args.output)

    fbx_files = sorted(list(bench_dir.glob("*.fbx")))
    if not require_legacy_count(fbx_files, args.expect_count):
        print("[audit-fbx-motion-bench] Command validation failed before processing.")
        raise SystemExit(1)

    print(f"[audit-fbx-motion-bench] Analyzing {len(fbx_files)} FBX files from {bench_dir}")

    results = {
        "schema": "fbx-audit-report-1.0",
        "tool": "audit-fbx-motion-bench.py",
        "total_files": len(fbx_files),
        "files": [],
        "summary": {
            "import_success": 0,
            "import_failed": 0,
            "travel_clips": 0,
            "in_place_clips": 0,
            "outlier_clips": 0,
            "source_action_count": 0,
        },
    }

    for i, fbx_path in enumerate(fbx_files, 1):
        print(f"  [{i}/{len(fbx_files)}] {fbx_path.name}")
        analysis = analyze_fbx(fbx_path)
        results["files"].append(analysis)
        results["summary"]["source_action_count"] += len(analysis.get("source_actions") or [])

        if analysis["import_success"]:
            results["summary"]["import_success"] += 1
            if "hips_displacement" in analysis.get("metrics", {}):
                if analysis["metrics"]["hips_travel_type"] == "travel":
                    results["summary"]["travel_clips"] += 1
                else:
                    results["summary"]["in_place_clips"] += 1
        else:
            results["summary"]["import_failed"] += 1

        if analysis.get("outlier", {}).get("is_outlier"):
            results["summary"]["outlier_clips"] += 1

    if results["summary"]["import_success"] != EXPECTED_REPORT_COUNT:
        print(
            f"[audit-fbx-motion-bench] Import failures: "
            f"{results['summary']['import_failed']}/{results['total_files']}"
        )

    # Ensure output is always written for auditing transparency.
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(json.dumps(results, indent=2, ensure_ascii=False))

    print(f"\n[audit-fbx-motion-bench] Complete. Output: {output_file}")
    print(
        f"[audit-fbx-motion-bench] Summary: {results['summary']['import_success']}/"
        f"{results['total_files']} success, "
        f"{results['summary']['travel_clips']} travel, "
        f"{results['summary']['in_place_clips']} in-place, "
        f"{results['summary']['outlier_clips']} outlier"
    )

    if (
        results["summary"]["import_success"] != EXPECTED_REPORT_COUNT
        or results["summary"]["import_failed"] > 0
        or results["total_files"] != EXPECTED_REPORT_COUNT
    ):
        raise SystemExit(1)

    raise SystemExit(0)


if __name__ == "__main__":
    main()
