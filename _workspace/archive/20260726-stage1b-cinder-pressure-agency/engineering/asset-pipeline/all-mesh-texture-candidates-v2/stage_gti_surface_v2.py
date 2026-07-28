#!/usr/bin/env python3
"""Replace v1 factor swatches with a subtle GTI-surface detail multiplier."""

import hashlib
import importlib.util
import json
import struct
import shutil
import sys
import traceback
from pathlib import Path

import bpy


DETAIL_SIZE = 256
DETAIL_MIN = 0.94
DETAIL_MAX = 1.0
FACTOR_IMAGE_PREFIX = "__stage_base_factor_"
DERIVED_IMAGE_NAME = "abyssal-toon-surface-subtle-v01"
EXTERNAL_PRETEXTURED_ASSETS = (
    {
        "relativePath": "props/tide-lock-beacon-rodin.glb",
        "runtimePath": "assets/images/battle/glb/props/tide-lock-beacon-rodin.glb",
        "generator": "Rodin Hyper3D",
        "taskId": "e42264aa-3a6c-4a8a-8ab0-d050234dd9c8",
    },
)


def load_v1_module(path):
    spec = importlib.util.spec_from_file_location("stage_all_mesh_textures_v1", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_glb_parts(path):
    raw = path.read_bytes()
    if len(raw) < 20 or raw[:4] != b"glTF":
        raise RuntimeError(f"not a GLB file: {path}")
    version, declared = struct.unpack_from("<II", raw, 4)
    if version != 2 or declared != len(raw):
        raise RuntimeError(f"invalid GLB header: {path}")
    document = None
    binary = b""
    offset = 12
    while offset < len(raw):
        length, chunk_type = struct.unpack_from("<II", raw, offset)
        offset += 8
        chunk = raw[offset : offset + length]
        offset += length
        if chunk_type == 0x4E4F534A:
            document = json.loads(chunk.rstrip(b" \t\r\n\0"))
        elif chunk_type == 0x004E4942:
            binary = chunk
    if offset != len(raw) or document is None:
        raise RuntimeError(f"malformed GLB chunks: {path}")
    return document, binary


def image_payload(document, binary, image_index):
    image = document["images"][image_index]
    view = document["bufferViews"][image["bufferView"]]
    start = view.get("byteOffset", 0)
    return binary[start : start + view["byteLength"]]


def texture_image_index(document, texture_info):
    texture = document["textures"][texture_info["index"]]
    if "source" in texture:
        return texture["source"]
    basisu = texture.get("extensions", {}).get("KHR_texture_basisu")
    if basisu and "source" in basisu:
        return basisu["source"]
    raise RuntimeError("texture has no supported image source")


def texture_hash(document, binary, texture_info):
    index = texture_image_index(document, texture_info)
    return hashlib.sha256(image_payload(document, binary, index)).hexdigest()


def png_dimensions(payload):
    if payload[:8] != b"\x89PNG\r\n\x1a\n" or payload[12:16] != b"IHDR":
        raise RuntimeError("expected embedded PNG")
    return list(struct.unpack_from(">II", payload, 16))


def texture_dimensions(document, binary, texture_info):
    index = texture_image_index(document, texture_info)
    return png_dimensions(image_payload(document, binary, index))


def texture_image_name(document, texture_info):
    index = texture_image_index(document, texture_info)
    return document["images"][index].get("name")


def make_derived_surface(v1, source_path, output_path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = bpy.data.images.load(str(source_path), check_existing=False)
    source.colorspace_settings.name = "sRGB"
    source_dimensions = list(source.size)
    source.scale(DETAIL_SIZE, DETAIL_SIZE)
    pixels = list(source.pixels)
    luminance = []
    for index in range(0, len(pixels), 4):
        luminance.append(
            0.2126 * pixels[index]
            + 0.7152 * pixels[index + 1]
            + 0.0722 * pixels[index + 2]
        )
    low = min(luminance)
    high = max(luminance)
    span = high - low
    if span <= 1e-8:
        raise RuntimeError("GTI surface has no usable luminance variation")

    encoded = []
    for value in luminance:
        normalized = (value - low) / span
        linear_multiplier = DETAIL_MIN + (DETAIL_MAX - DETAIL_MIN) * normalized
        srgb = v1.linear_to_srgb(linear_multiplier)
        encoded.extend((srgb, srgb, srgb, 1.0))

    derived = bpy.data.images.new(
        DERIVED_IMAGE_NAME,
        width=DETAIL_SIZE,
        height=DETAIL_SIZE,
        alpha=True,
        float_buffer=False,
    )
    derived.colorspace_settings.name = "sRGB"
    derived.pixels[:] = encoded
    derived.update()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.unlink(missing_ok=True)
    derived.filepath_raw = str(output_path)
    derived.file_format = "PNG"
    derived.save()
    if not output_path.is_file() or output_path.stat().st_size == 0:
        raise RuntimeError(f"failed to create derived GTI surface: {output_path}")
    return {
        "method": (
            "GTI surface sRGB -> linear luminance -> min/max normalize -> "
            f"near-white [{DETAIL_MIN:.2f},{DETAIL_MAX:.2f}] multiplier -> sRGB PNG"
        ),
        "sourceDimensions": source_dimensions,
        "textureDimensions": [DETAIL_SIZE, DETAIL_SIZE],
        "linearMultiplierRange": [DETAIL_MIN, DETAIL_MAX],
        "sourceLinearLuminanceRange": [low, high],
        "path": str(output_path),
        "sha256": sha256(output_path),
    }


def node_semantics(document):
    nodes = document.get("nodes", [])
    result = {}
    for node in nodes:
        name = node.get("name")
        if name in result:
            raise RuntimeError(f"duplicate node name prevents hierarchy audit: {name}")
        result[name] = {
            "children": sorted(nodes[index].get("name") for index in node.get("children", [])),
            "translation": node.get("translation", [0.0, 0.0, 0.0]),
            "rotation": node.get("rotation", [0.0, 0.0, 0.0, 1.0]),
            "scale": node.get("scale", [1.0, 1.0, 1.0]),
        }
    return result


def transform_equal(left, right, tolerance=1e-5):
    for name, source in left.items():
        output = right.get(name)
        if output is None or source["children"] != output["children"]:
            return False
        for key in ("translation", "scale"):
            if any(abs(float(a) - float(b)) > tolerance for a, b in zip(source[key], output[key])):
                return False
        source_q = source["rotation"]
        output_q = output["rotation"]
        direct = max(abs(float(a) - float(b)) for a, b in zip(source_q, output_q))
        negated = max(abs(float(a) + float(b)) for a, b in zip(source_q, output_q))
        if min(direct, negated) > tolerance:
            return False
    return left.keys() == right.keys()


def material_map(document):
    result = {}
    for material in document.get("materials", []):
        name = material.get("name")
        if name in result:
            raise RuntimeError(f"duplicate material name prevents audit: {name}")
        result[name] = material
    return result


def replace_factor_swatches(v1, replacements, derived_path):
    derived = bpy.data.images.load(str(derived_path), check_existing=True)
    derived.colorspace_settings.name = "sRGB"
    records = []
    materials = {material.name: material for material in bpy.data.materials}
    if replacements.keys() - materials.keys():
        missing = sorted(replacements.keys() - materials.keys())
        raise RuntimeError(f"replacement materials missing after import: {missing}")

    for material_name, policy in replacements.items():
        material = materials[material_name]
        shader = v1.principled_node(material)
        base = shader.inputs.get("Base Color")
        image_nodes = [
            node
            for node in v1.upstream_nodes(material.node_tree, base)
            if node.type == "TEX_IMAGE" and node.image is not None
        ]
        swatches = [
            node for node in image_nodes if node.image.name.startswith(FACTOR_IMAGE_PREFIX)
        ]
        if len(swatches) != 1:
            raise RuntimeError(
                f"expected one v1 factor swatch for {material_name}, found {len(swatches)}"
            )
        swatch = swatches[0]
        swatch.image = derived
        source_socket = tuple(float(value) for value in policy["sourceSocketLinearRgba"])
        for link in list(base.links):
            material.node_tree.links.remove(link)
        factor = material.node_tree.nodes.new("ShaderNodeMix")
        factor.name = "GTI Surface Base Color Factor"
        factor.label = "Color Factor"
        factor.data_type = "RGBA"
        factor.blend_type = "MULTIPLY"
        factor.inputs["Factor"].default_value = 1.0
        factor.inputs[7].default_value = source_socket
        material.node_tree.links.new(swatch.outputs["Color"], factor.inputs[6])
        material.node_tree.links.new(factor.outputs[2], base)
        records.append(
            {
                "material": material_name,
                "replacedV1Image": policy["image"],
                "derivedImage": DERIVED_IMAGE_NAME,
                "sourceBaseColorFactor": policy["sourceBaseColorFactor"],
                "method": (
                    "replace v1 1x1 factor swatch with shared GTI-derived "
                    "near-white detail multiplier; restore original baseColorFactor"
                ),
                "textureDimensions": [DETAIL_SIZE, DETAIL_SIZE],
            }
        )
    return records


def export_candidate(output):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_materials="EXPORT",
        export_animations=True,
        export_skins=True,
        export_cameras=True,
        export_lights=True,
    )
    if not output.is_file() or output.stat().st_size == 0:
        raise RuntimeError(f"Blender did not produce a GLB: {output}")


def validate(v1, source_document, source_binary, output_document, output_binary, replacements, tile_hash):
    before = v1.census(source_document)
    after = v1.census(output_document)
    source_materials = material_map(source_document)
    output_materials = material_map(output_document)

    restored_factors = True
    derived_tiles = True
    existing_base_hashes = True
    normal_hashes_and_scales = True
    for name, source_material in source_materials.items():
        output_material = output_materials[name]
        source_pbr = source_material.get("pbrMetallicRoughness", {})
        output_pbr = output_material.get("pbrMetallicRoughness", {})
        if name in replacements:
            expected = replacements[name]["sourceBaseColorFactor"]
            actual = output_pbr.get("baseColorFactor", [1.0, 1.0, 1.0, 1.0])
            restored_factors = restored_factors and v1.equivalent(expected, actual, 1e-5)
            derived_tiles = derived_tiles and (
                texture_hash(output_document, output_binary, output_pbr["baseColorTexture"])
                == tile_hash
            )
            derived_tiles = derived_tiles and (
                texture_dimensions(output_document, output_binary, output_pbr["baseColorTexture"])
                == [DETAIL_SIZE, DETAIL_SIZE]
            )
        else:
            source_base = source_pbr["baseColorTexture"]
            output_base = output_pbr["baseColorTexture"]
            existing_base_hashes = existing_base_hashes and (
                texture_hash(source_document, source_binary, source_base)
                == texture_hash(output_document, output_binary, output_base)
            )
            source_factor = source_pbr.get("baseColorFactor", [1.0, 1.0, 1.0, 1.0])
            output_factor = output_pbr.get("baseColorFactor", [1.0, 1.0, 1.0, 1.0])
            existing_base_hashes = existing_base_hashes and v1.equivalent(
                source_factor, output_factor, 1e-5
            )

        source_normal = source_material["normalTexture"]
        output_normal = output_material["normalTexture"]
        normal_hashes_and_scales = normal_hashes_and_scales and (
            texture_hash(source_document, source_binary, source_normal)
            == texture_hash(output_document, output_binary, output_normal)
        )
        normal_hashes_and_scales = normal_hashes_and_scales and v1.equivalent(
            source_normal.get("scale", 1.0), output_normal.get("scale", 1.0), 1e-6
        )

    all_base_dimensions = [
        texture_dimensions(
            output_document,
            output_binary,
            material.get("pbrMetallicRoughness", {})["baseColorTexture"],
        )
        for material in output_document.get("materials", [])
    ]
    image_names = [image.get("name", "") for image in output_document.get("images", [])]
    checks = {
        "nodeCountEqual": before["nodes"] == after["nodes"],
        "meshCountEqual": before["meshes"] == after["meshes"],
        "primitiveCountEqual": before["primitives"] == after["primitives"],
        "materialCountEqual": before["materials"] == after["materials"],
        "materialNamesEqual": sorted(before["materialNames"]) == sorted(after["materialNames"]),
        "skinCountEqual": before["skins"] == after["skins"],
        "animationCountEqual": before["animations"] == after["animations"],
        "animationNamesEqual": sorted(before["animationNames"]) == sorted(after["animationNames"]),
        "hierarchyAndTransformsEqual": transform_equal(
            node_semantics(source_document), node_semantics(output_document)
        ),
        "allPrimitivesHaveUv0": after["primitivesWithUv0"] == after["primitives"],
        "allPrimitivesHaveNormal": after["primitivesWithNormal"] == after["primitives"],
        "allMaterialsHaveBaseColorTexture": after["materialsWithBaseColorTexture"] == after["materials"],
        "allMaterialsHaveNormalTexture": after["materialsWithNormalTexture"] == after["materials"],
        "preservedNonBasePbrInputs": v1.equivalent(
            v1.pbr_preservation(source_document),
            v1.pbr_preservation(output_document),
            1e-6,
        ),
        "restoredOriginalBaseColorFactors": restored_factors,
        "derivedGtiTileOnEveryReplacedMaterial": derived_tiles,
        "existingBaseColorImagesUntouched": existing_base_hashes,
        "normalImagesAndScalesUntouched": normal_hashes_and_scales,
        "noGeneratedFactorImageNamesRemain": not any(
            name.startswith(FACTOR_IMAGE_PREFIX) for name in image_names
        ),
        "noOneByOneBaseColorTexturesRemain": [1, 1] not in all_base_dimensions,
    }
    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        raise RuntimeError(f"v2 validation failed: {', '.join(failed)}")
    return before, after, checks


def process_one(v1, source, output, relative_path, replacements, derived_path, tile_hash):
    source_document, source_binary = read_glb_parts(source)
    temporary = output.with_name(output.stem + ".partial.glb")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.unlink(missing_ok=True)
    temporary.unlink(missing_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    derivations = replace_factor_swatches(v1, replacements, derived_path)
    export_candidate(temporary)
    output_document, output_binary = read_glb_parts(temporary)
    before, after, checks = validate(
        v1,
        source_document,
        source_binary,
        output_document,
        output_binary,
        replacements,
        tile_hash,
    )
    temporary.replace(output)
    return {
        "relativePath": relative_path,
        "sourcePath": str(source),
        "outputPath": str(output),
        "sourceSha256": sha256(source),
        "outputSha256": sha256(output),
        "before": before,
        "after": after,
        "materialDerivations": derivations,
        "checks": checks,
        "exceptions": [],
        "status": "ok",
    }


def stage_external_pretextured(v1, repository_root, candidate_root, spec):
    relative_path = spec["relativePath"]
    source = repository_root / spec["runtimePath"]
    output = candidate_root / relative_path
    if not source.is_file():
        raise RuntimeError(f"external pretextured source missing: {source}")
    document, _ = read_glb_parts(source)
    census = v1.census(document)
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, output)
    checks = {
        "copiedByteExact": sha256(source) == sha256(output),
        "hasRodinTaskId": bool(spec["taskId"]),
        "allImagesEmbedded": bool(document.get("images"))
        and all("bufferView" in image and "uri" not in image for image in document["images"]),
        "allPrimitivesHaveUv0": census["primitivesWithUv0"] == census["primitives"],
        "allPrimitivesHaveNormal": census["primitivesWithNormal"] == census["primitives"],
        "allMaterialsHaveBaseColorTexture": (
            census["materialsWithBaseColorTexture"] == census["materials"]
        ),
        "allMaterialsHaveNormalTexture": (
            census["materialsWithNormalTexture"] == census["materials"]
        ),
    }
    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        raise RuntimeError(
            f"external pretextured validation failed for {relative_path}: {', '.join(failed)}"
        )
    return {
        "relativePath": relative_path,
        "sourcePath": str(source),
        "outputPath": str(output),
        "sourceSha256": sha256(source),
        "outputSha256": sha256(output),
        "before": census,
        "after": census,
        "materialDerivations": [],
        "provenance": {
            "mode": "external-pretextured-byte-exact-pass-through",
            "generator": spec["generator"],
            "taskId": spec["taskId"],
            "runtimePath": spec["runtimePath"],
        },
        "checks": checks,
        "exceptions": [],
        "status": "ok",
    }


def main():
    candidate_root = Path(__file__).resolve().parent
    repository_root = next(parent for parent in candidate_root.parents if (parent / "package.json").is_file())
    pipeline_root = candidate_root.parent
    v1_root = pipeline_root / "all-mesh-texture-candidates"
    v1_script = v1_root / "stage_all_mesh_textures.py"
    v1_audit_path = v1_root / "audit.json"
    surface_path = pipeline_root / "shared-textures/abyssal-toon-surface-v01.png"
    normal_path = pipeline_root / "shared-textures/abyssal-toon-normal-v01.png"
    derived_path = candidate_root / "derived-textures/abyssal-toon-surface-subtle-v01.png"
    audit_path = candidate_root / "audit.json"
    for required in (v1_script, v1_audit_path, surface_path, normal_path):
        if not required.is_file():
            raise RuntimeError(f"required input missing: {required}")

    v1 = load_v1_module(v1_script)
    v1_audit = json.loads(v1_audit_path.read_text(encoding="utf-8"))
    derived = make_derived_surface(v1, surface_path, derived_path)
    tile_hash = derived["sha256"]
    rows = []
    external_relative_paths = {
        item["relativePath"] for item in EXTERNAL_PRETEXTURED_ASSETS
    }
    for source_row in v1_audit["rows"]:
        relative_path = source_row["relativePath"]
        if relative_path in external_relative_paths:
            continue
        source = v1_root / relative_path
        output = candidate_root / relative_path
        replacements = {
            item["material"]: item
            for item in source_row["baseColorFactorTexturesAdded"]
        }
        try:
            row = process_one(
                v1,
                source,
                output,
                relative_path,
                replacements,
                derived_path,
                tile_hash,
            )
        except Exception as exc:
            partial = output.with_name(output.stem + ".partial.glb")
            partial.unlink(missing_ok=True)
            output.unlink(missing_ok=True)
            row = {
                "relativePath": relative_path,
                "sourcePath": str(source),
                "outputPath": str(output),
                "exceptions": [str(exc)],
                "traceback": traceback.format_exc(),
                "status": "failed",
            }
        rows.append(row)

    for spec in EXTERNAL_PRETEXTURED_ASSETS:
        try:
            row = stage_external_pretextured(v1, repository_root, candidate_root, spec)
        except Exception as exc:
            relative_path = spec["relativePath"]
            row = {
                "relativePath": relative_path,
                "sourcePath": str(repository_root / spec["runtimePath"]),
                "outputPath": str(candidate_root / relative_path),
                "exceptions": [str(exc)],
                "traceback": traceback.format_exc(),
                "status": "failed",
            }
        rows.append(row)

    observed_candidates = sorted(candidate_root.rglob("*.glb"))
    expected_candidates = sorted(Path(row["outputPath"]) for row in rows)
    missing_candidates = [path for path in expected_candidates if not path.is_file()]
    unmanaged_candidates = [
        path.relative_to(repository_root).as_posix()
        for path in observed_candidates
        if path not in expected_candidates
    ]
    failures = [row for row in rows if row["status"] != "ok"]
    for row in rows:
        row["sourcePath"] = Path(row["sourcePath"]).relative_to(repository_root).as_posix()
        row["outputPath"] = Path(row["outputPath"]).relative_to(repository_root).as_posix()
    derived["path"] = Path(derived["path"]).relative_to(repository_root).as_posix()
    audit = {
        "schemaVersion": 2,
        "blenderVersion": bpy.app.version_string,
        "inputRoot": v1_root.relative_to(repository_root).as_posix(),
        "candidateRoot": candidate_root.relative_to(repository_root).as_posix(),
        "v1Audit": {"path": v1_audit_path.relative_to(repository_root).as_posix(), "sha256": sha256(v1_audit_path)},
        "gtiSurfaceSource": {"path": surface_path.relative_to(repository_root).as_posix(), "sha256": sha256(surface_path)},
        "gtiNormalSource": {
            "path": normal_path.relative_to(repository_root).as_posix(),
            "sha256": sha256(normal_path),
            "retainedStrength": 0.15,
        },
        "derivedSurface": derived,
        "inputCandidateCount": len(v1_audit["rows"]),
        "externalPretexturedCandidateCount": len(EXTERNAL_PRETEXTURED_ASSETS),
        "candidateCount": len(expected_candidates),
        "observedCandidateCount": len(observed_candidates),
        "unmanagedCandidates": unmanaged_candidates,
        "materialsReplaced": sum(len(row.get("materialDerivations", [])) for row in rows),
        "successfulRows": len(rows) - len(failures),
        "failedRows": len(failures),
        "rows": rows,
    }
    audit_path.write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    if failures or missing_candidates:
        raise RuntimeError(
            f"{len(failures)} v2 GLB roundtrip(s) failed and "
            f"{len(missing_candidates)} expected candidate(s) are missing; see {audit_path}"
        )
    print(
        json.dumps(
            {
                "audit": str(audit_path),
                "candidates": len(expected_candidates),
                "unmanagedCandidates": len(unmanaged_candidates),
                "materialsReplaced": audit["materialsReplaced"],
                "failedRows": len(failures),
            }
        )
    )


if __name__ == "__main__":
    main()
