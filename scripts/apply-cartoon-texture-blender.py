#!/usr/bin/env python3
"""Apply a concept cartoon texture to one staged GLB body mesh.

The script deliberately keeps the concept and runtime lanes separate.  A source
GLB is opened read-only from the caller's perspective, while every export is a
candidate (``runtimeEligible`` is always false).  Use regular Python for a
preflight report, or invoke the same script from Blender for the actual GLB
round-trip::

  python3 scripts/apply-cartoon-texture-blender.py \
    --glb assets/images/battle/glb/commander/dusk-warden.glb \
    --texture assets/images/battle/pilot/dusk-warden-cartoon-albedo.png \
    --asset-id dusk-warden --dry-run

  blender --background --python scripts/apply-cartoon-texture-blender.py -- \
    --glb assets/images/battle/glb/commander/dusk-warden.glb \
    --texture assets/images/battle/pilot/dusk-warden-cartoon-albedo.png \
    --asset-id dusk-warden

Only the stdlib is imported at module load time.  ``bpy`` is imported inside
``run_in_blender`` so dry-run remains usable on a normal Python installation.
"""

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

WORKSPACE = Path(
    os.environ.get(
        "ASSET_PIPELINE_WORKSPACE",
        "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline",
    )
)
RUNTIME_ROOT = Path("assets/images/battle/glb")
DEFAULT_CANDIDATE_ROOT = WORKSPACE / "runtime-candidates"


def _script_argv(argv=None):
    """Return arguments after Blender's optional ``--`` separator."""
    values = list(sys.argv[1:] if argv is None else argv)
    if "--" in values:
        return values[values.index("--") + 1 :]
    return values


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Apply a concept cartoon texture to a staged GLB body"
    )
    parser.add_argument("--glb", required=True, help="source GLB (read-only)")
    parser.add_argument("--texture", required=True, help="concept/reference texture image")
    parser.add_argument("--asset-id", required=True, help="catalog id, for example dusk-warden")
    parser.add_argument(
        "--normal",
        default=None,
        help="optional shared tangent-space normal texture",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="candidate GLB output (defaults under _workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline)",
    )
    parser.add_argument(
        "--report",
        default=None,
        help="candidate JSON report (defaults beside the candidate GLB)",
    )
    parser.add_argument("--dry-run", action="store_true", help="validate and report without importing bpy")
    args = parser.parse_args(_script_argv(argv))

    # Defaults intentionally point at the staging/candidate lane, never at the
    # deployed runtime lane.  Keep these paths deterministic for audit tools.
    if args.out is None:
        args.out = str(DEFAULT_CANDIDATE_ROOT / "cartoon-texture" / "glb" / f"{args.asset_id}.glb")
    if args.report is None:
        args.report = str(DEFAULT_CANDIDATE_ROOT / "cartoon-texture" / "reports" / f"{args.asset_id}.json")
    args.glb = str(Path(args.glb))
    args.texture = str(Path(args.texture))
    args.normal = str(Path(args.normal)) if args.normal is not None else None
    args.out = str(Path(args.out))
    args.report = str(Path(args.report))
    return args


def _sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _is_within(path, root):
    try:
        Path(path).resolve().relative_to(Path(root).resolve())
        return True
    except ValueError:
        return False


def _concept_provenance(texture):
    """Require an explicit non-runtime sidecar for tracked concept media."""
    concept_roots = (
        Path("assets/images/battle/pilot"),
        WORKSPACE / "concept-input",
        WORKSPACE / "texture-candidates",
    )
    if not any(_is_within(texture, root) for root in concept_roots):
        return None
    sidecar = texture.with_suffix(".provenance.json")
    if not sidecar.is_file():
        raise FileNotFoundError(f"concept texture provenance sidecar does not exist: {sidecar}")
    try:
        data = json.loads(sidecar.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"invalid concept texture provenance sidecar: {sidecar}") from exc
    if not isinstance(data, dict) or data.get("runtimeEligible") is not False:
        raise ValueError(f"concept texture sidecar must explicitly set runtimeEligible=false: {sidecar}")
    return sidecar


def _validate_paths(args):
    source = Path(args.glb).expanduser()
    texture = Path(args.texture).expanduser()
    output = Path(args.out).expanduser()
    report = Path(args.report).expanduser()
    normal = Path(args.normal).expanduser() if args.normal else None
    if not source.is_file():
        raise FileNotFoundError(f"source GLB does not exist: {source}")
    if not texture.is_file():
        # Missing concept media must stop the pipeline before Blender starts.
        raise FileNotFoundError(f"texture does not exist: {texture}")
    if normal is not None and not normal.is_file():
        raise FileNotFoundError(f"normal texture does not exist: {normal}")
    if _is_within(texture, RUNTIME_ROOT):
        raise ValueError("concept texture cannot be sourced from the runtime asset lane")
    _concept_provenance(texture)
    if source.resolve() == output.resolve():
        raise ValueError("refusing to overwrite the source GLB")
    if _is_within(output, RUNTIME_ROOT) or _is_within(report, RUNTIME_ROOT):
        raise ValueError("runtime asset paths are read-only; use a candidate output/report path")
    if output.suffix.lower() != ".glb":
        raise ValueError(f"candidate output must be a .glb: {output}")
    if report.suffix.lower() != ".json":
        raise ValueError(f"candidate report must be a .json: {report}")
    return source, texture, normal, output, report


def _lane_for_texture(texture):
    if _is_within(texture, Path("assets/images/battle/pilot")) or _is_within(texture, WORKSPACE / "concept-input") or _is_within(texture, WORKSPACE / "texture-candidates"):
        return "concept"
    return "external-reference"


def _texture_report(texture):
    sidecar = _concept_provenance(texture)
    if sidecar is None:
        return {"required": False, "path": None}
    return {
        "required": True,
        "path": str(sidecar),
        "sha256": _sha256(sidecar),
        "runtimeEligible": False,
    }


def _lane_for_texture(texture):
    if _is_within(texture, Path("assets/images/battle/pilot")) or _is_within(texture, WORKSPACE / "concept-input") or _is_within(texture, WORKSPACE / "texture-candidates"):
        return "concept"
    return "external-reference"


def _lane_for_source(source):
    if _is_within(source, RUNTIME_ROOT):
        return "runtime"
    if _is_within(source, WORKSPACE):
        return "candidate"
    return "external"


def _base_report(args, source, texture, normal, output, report, dry_run):
    source_hash = _sha256(source)
    texture_hash = _sha256(texture)
    return {
        "schemaVersion": 1,
        "assetId": args.asset_id,
        "assetLane": "candidate",
        "sourceLane": _lane_for_source(source),
        "textureLane": _lane_for_texture(texture),
        "conceptLane": _lane_for_texture(texture),
        "runtimeLane": "assets/images/battle/glb",
        "candidateLane": "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline/runtime-candidates",
        "runtimeEligible": False,
        "dryRun": bool(dry_run),
        "source": {"path": str(source), "sha256": source_hash, "readOnly": True},
        "texture": {
            "path": str(texture),
            "sha256": texture_hash,
            "readOnly": True,
            "provenance": _texture_report(texture),
        },
        "normal": {
            "path": str(normal) if normal is not None else None,
            "sha256": _sha256(normal) if normal is not None else None,
            "readOnly": True,
        },
        # Flat aliases keep the hashes easy to consume from shell validators.
        "sourceSha256": source_hash,
        "textureSha256": texture_hash,
        "output": {"path": str(output), "candidate": True, "wouldWrite": not dry_run},
        "reportPath": str(report),
        "materialPolicy": {
            "name": f"{args.asset_id}_toon_cartoon",
            "bodyOnly": True,
            "imageToPrincipledBaseColor": True,
            "mappingMode": "active-UV-to-Base-Color",
            "requiresActiveUv": True,
            "lowRoughness": 0.22,
            "celCompatible": True,
        },
        "preservation": {
            "sourceGlbUnmodified": True,
            "armature": "preserve imported armature",
            "actions": "preserve imported actions/animation clips",
        },
        "terrainPolicy": {
            "status": "untouched",
            "audit": "Terrain/pedestal geometry is not recolored by this concept-texture pass.",
            "runtimeEligible": False,
        },
        "weaponPolicy": {
            "status": "untouched",
            "audit": "Weapon geometry/materials are not copied into or promoted by this pass.",
            "runtimeEligible": False,
        },
        "verification": {
            "rightsReview": "pending",
            "glbEmbedding": "pending" if dry_run else "complete-if-export-succeeds",
            "browserFallback": "pending",
        },
    }


def _write_report(report_path, report):
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _body_and_hierarchy(asset_id):
    """Resolve imported body, root and armature without deleting any objects."""
    import bpy

    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("GLB import produced no mesh objects")
    body = bpy.data.objects.get(f"{asset_id}_body")
    if body is None or body.type != "MESH":
        body = meshes[0]
    armature = next((obj for obj in bpy.data.objects if obj.type == "ARMATURE"), None)
    root = bpy.data.objects.get(asset_id)
    if root is None:
        cursor = body
        while cursor.parent is not None:
            cursor = cursor.parent
        root = cursor
    return body, armature, root, meshes


def _toon_material(asset_id, texture_path, normal_path=None):
    """Create or repair one deterministic image->Principled toon material."""
    import bpy

    name = f"{asset_id}_toon_cartoon"
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    material.use_nodes = True
    material.diffuse_color = (0.55, 0.55, 0.55, 1.0)
    material["toonPipeline"] = "cartoon-texture"
    material["celCompatible"] = True
    material["sourceTexture"] = str(texture_path)
    material["runtimeEligible"] = False
    material["roughnessPolicy"] = "low-roughness-cel-compatible"

    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.name = "Toon Material Output"
    output.location = (420, 0)
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Toon Principled BSDF"
    shader.location = (80, 0)
    image = nodes.new("ShaderNodeTexImage")
    image.name = "Concept Cartoon Albedo"
    image.label = "Concept texture (candidate only)"
    image.location = (-260, 0)
    texcoord = nodes.new("ShaderNodeTexCoord")
    texcoord.name = "Active UV Coordinates"
    texcoord.location = (-480, 0)
    links.new(texcoord.outputs["UV"], image.inputs["Vector"])
    image.image = bpy.data.images.load(str(texture_path), check_existing=True)

    base_color = shader.inputs.get("Base Color")
    if base_color is None:
        raise RuntimeError("Blender Principled BSDF has no Base Color input")
    links.new(image.outputs["Color"], base_color)

    if normal_path is not None:
        normal_image = nodes.new("ShaderNodeTexImage")
        normal_image.name = "Shared Toon Normal"
        normal_image.label = "Shared tangent-space normal (candidate only)"
        normal_image.location = (-260, -180)
        normal_image.image = bpy.data.images.load(str(normal_path), check_existing=True)
        normal_image.image.colorspace_settings.name = "Non-Color"
        normal_map = nodes.new("ShaderNodeNormalMap")
        normal_map.name = "Shared Toon Normal Map"
        normal_map.location = (80, -180)
        normal_map.inputs["Strength"].default_value = 0.15
        links.new(normal_image.outputs["Color"], normal_map.inputs["Color"])
        links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])

    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    roughness = shader.inputs.get("Roughness")
    if roughness is not None:
        roughness.default_value = 0.22
    metallic = shader.inputs.get("Metallic")
    if metallic is not None:
        metallic.default_value = 0.0

    # The direct image->Base Color link is glTF-compatible. These custom
    # properties document the cel banding contract without introducing a
    # Shader-to-RGB node that would be dropped by the glTF exporter.
    material["celShadowBands"] = 3
    material["celRampPolicy"] = "runtime-lighting"
    return material


def run_in_blender(args, source, texture, normal, output, report_path):
    """Import, recolor only the body, and export a staged candidate GLB."""
    import bpy

    report = _base_report(args, source, texture, normal, output, report_path, dry_run=False)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # `guess_original_bind_pose=False`: this re-exports the armature alongside
    # the recoloured body, so a rest pose re-derived from the inverse bind
    # matrices would be written into the staged candidate even though this pass
    # only means to change materials. Same rule as
    # `scripts/measure-joint-articulation.py:113-122`.
    bpy.ops.import_scene.gltf(
        filepath=str(source),
        guess_original_bind_pose=False,
        bone_heuristic="BLENDER",
    )
    body, armature, root, meshes = _body_and_hierarchy(args.asset_id)
    if not body.data.uv_layers:
        raise RuntimeError("body mesh has no UV map; unwrap it before cartoon texture mapping")
    active_uv = body.data.uv_layers.active.name
    material = _toon_material(args.asset_id, texture, normal)

    # Replace only the body's slots. Pedestal/terrain, weapons, and every
    # other imported mesh retain their source materials and geometry.
    body.data.materials.clear()
    body.data.materials.append(material)
    for polygon in body.data.polygons:
        polygon.material_index = 0

    bpy.ops.object.select_all(action="DESELECT")
    selected = []
    for obj in (root, armature, body):
        if obj is not None and obj not in selected:
            obj.select_set(True)
            selected.append(obj)
    if not selected:
        raise RuntimeError("could not select root/armature/body for candidate export")
    bpy.context.view_layer.objects.active = root if root is not None else body

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_materials="EXPORT",
        export_animations=True,
        export_skins=True,
        export_cameras=False,
        export_lights=False,
    )
    if not output.is_file() or output.stat().st_size == 0:
        raise RuntimeError(f"Blender did not produce candidate GLB: {output}")
    report.update(
        {
            "bodyObject": body.name,
            "armatureObject": armature.name if armature else None,
            "rootObject": root.name if root else None,
            "activeUvMap": active_uv,
            "uvLayerCount": len(body.data.uv_layers),
            "selectedForExport": [obj.name for obj in selected],
            "meshCountImported": len(meshes),
            "materialName": material.name,
            "output": {
                "path": str(output),
                "candidate": True,
                "wouldWrite": True,
                "sha256": _sha256(output),
                "bytes": output.stat().st_size,
            },
        }
    )
    _write_report(report_path, report)
    return report


def main(argv=None):
    args = parse_args(argv)
    try:
        source, texture, normal, output, report_path = _validate_paths(args)
        if args.dry_run:
            report = _base_report(args, source, texture, normal, output, report_path, dry_run=True)
            _write_report(report_path, report)
        else:
            report = run_in_blender(args, source, texture, normal, output, report_path)
    except (FileNotFoundError, OSError, ValueError, RuntimeError) as exc:
        error = {"ok": False, "error": str(exc), "runtimeEligible": False, "assetLane": "candidate"}
        print(json.dumps(error, sort_keys=True), file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
