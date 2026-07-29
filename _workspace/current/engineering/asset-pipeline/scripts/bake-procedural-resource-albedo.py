#!/usr/bin/env python3
"""Bake UV-aligned, asset-specific albedo textures into procedural GLB candidates.

The staged meshes in ``ingame-mesh/staged`` deliberately contain only authored
geometry and material factors. This tool turns each primitive's existing
``TEXCOORD_0`` UV layout into a power-of-two PNG atlas, embeds that atlas in a
*new* GLB under ``ingame-mesh/textured``, and records a candidate-only receipt.

It never edits the staged source meshes or ``assets/images/battle/glb``. The
output is evidence for later visual and browser QA, not a runtime promotion.

    python3 _workspace/current/engineering/asset-pipeline/scripts/bake-procedural-resource-albedo.py
    python3 _workspace/current/engineering/asset-pipeline/scripts/bake-procedural-resource-albedo.py --check
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
import math
import struct
import sys
from pathlib import Path
from typing import Any, Mapping

import numpy as np
from PIL import Image

SCRIPT_ROOT = Path(__file__).resolve().parent
PIPELINE_ROOT = SCRIPT_ROOT.parent / "ingame-mesh"
SOURCE_ROOT = PIPELINE_ROOT / "staged"
OUTPUT_ROOT = PIPELINE_ROOT / "textured"
RUNTIME_ROOT = Path("assets/images/battle/glb")
MANIFEST_NAME = "textured-procedural-resources.manifest.json"
ATLAS_SIZE = 256
DILATION_TEXELS = 16
SCHEMA_VERSION = 1
GLB_JSON_CHUNK = 0x4E4F534A
GLB_BIN_CHUNK = 0x004E4942
COMPONENT_DTYPES = {
    5120: np.dtype("<i1"),
    5121: np.dtype("<u1"),
    5122: np.dtype("<i2"),
    5123: np.dtype("<u2"),
    5125: np.dtype("<u4"),
    5126: np.dtype("<f4"),
}
TYPE_COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


class BakeError(RuntimeError):
    """Raised when a candidate mesh cannot be safely UV-baked."""


def repository_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "package.json").is_file():
            return parent
    raise BakeError("repository root with package.json not found")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def read_glb(path: Path) -> tuple[dict[str, Any], bytes]:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise BakeError(f"not a GLB file: {path}")
    version, declared = struct.unpack_from("<II", data, 4)
    if version != 2 or declared != len(data):
        raise BakeError(f"invalid GLB header: {path}")
    offset = 12
    document: dict[str, Any] | None = None
    binary = b""
    while offset < len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        start = offset + 8
        end = start + length
        if end > len(data):
            raise BakeError(f"truncated GLB chunk: {path}")
        if chunk_type == GLB_JSON_CHUNK:
            document = json.loads(data[start:end].decode("utf-8").rstrip("\0 \t\r\n"))
        elif chunk_type == 0x004E4942:
            binary = data[start:end]
        offset = end
    if not isinstance(document, dict):
        raise BakeError(f"GLB JSON chunk missing: {path}")
    return document, binary


def write_glb(document: Mapping[str, Any], binary: bytes) -> bytes:
    json_bytes = json.dumps(document, separators=(",", ":"), sort_keys=False).encode("utf-8")
    json_bytes += b" " * (-len(json_bytes) % 4)
    binary = binary + b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(json_bytes) + (8 + len(binary) if binary else 0)
    payload = bytearray()
    payload += b"glTF" + struct.pack("<II", 2, total)
    payload += struct.pack("<II", len(json_bytes), GLB_JSON_CHUNK) + json_bytes
    if binary:
        payload += struct.pack("<II", len(binary), 0x004E4942) + binary
    return bytes(payload)


def read_accessor(document: Mapping[str, Any], binary: bytes, index: int) -> np.ndarray:
    accessor = document["accessors"][index]
    if "bufferView" not in accessor:
        raise BakeError("sparse or bufferless accessors are not supported")
    view = document["bufferViews"][accessor["bufferView"]]
    dtype = COMPONENT_DTYPES[accessor["componentType"]]
    components = TYPE_COMPONENTS[accessor["type"]]
    count = accessor["count"]
    element = components * dtype.itemsize
    stride = view.get("byteStride") or element
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    raw = np.frombuffer(binary, dtype=np.uint8, count=count * stride, offset=start)
    packed = np.lib.stride_tricks.as_strided(
        raw, shape=(count, element), strides=(stride, 1)
    ).tobytes()
    return np.frombuffer(packed, dtype=dtype).reshape(count, components)


def srgb_encode(linear: np.ndarray) -> np.ndarray:
    linear = np.clip(linear, 0.0, 1.0)
    return np.where(
        linear <= 0.0031308,
        linear * 12.92,
        1.055 * np.power(linear, 1.0 / 2.4) - 0.055,
    )


def encode_png(linear: np.ndarray) -> bytes:
    encoded = np.clip(np.round(srgb_encode(linear) * 255.0), 0, 255).astype(np.uint8)
    output = io.BytesIO()
    Image.fromarray(encoded, mode="RGB").save(output, format="PNG", optimize=True)
    return output.getvalue()


def rasterize_attributes(
    uv: np.ndarray, position: np.ndarray, normal: np.ndarray, triangles: np.ndarray, size: int
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Rasterize local position and normal through the primitive's real UV map."""
    positions = np.zeros((size, size, 3), dtype=np.float32)
    normals = np.zeros((size, size, 3), dtype=np.float32)
    covered = np.zeros((size, size), dtype=bool)
    # glTF defines UV (0, 0) at the upper-left texture corner. PNG rows use
    # the same origin, and the runtime GLTFLoader sets texture.flipY=false.
    pixel = np.empty_like(uv)
    pixel[:, 0] = uv[:, 0] * size
    pixel[:, 1] = uv[:, 1] * size

    for triangle in triangles:
        p0, p1, p2 = pixel[triangle]
        min_x = max(int(math.floor(min(p0[0], p1[0], p2[0]))), 0)
        max_x = min(int(math.ceil(max(p0[0], p1[0], p2[0]))), size - 1)
        min_y = max(int(math.floor(min(p0[1], p1[1], p2[1]))), 0)
        max_y = min(int(math.ceil(max(p0[1], p1[1], p2[1]))), size - 1)
        if min_x > max_x or min_y > max_y:
            continue
        denominator = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1])
        if abs(denominator) < 1e-12:
            continue
        ys, xs = np.mgrid[min_y : max_y + 1, min_x : max_x + 1]
        px, py = xs + 0.5, ys + 0.5
        w0 = ((p1[1] - p2[1]) * (px - p2[0]) + (p2[0] - p1[0]) * (py - p2[1])) / denominator
        w1 = ((p2[1] - p0[1]) * (px - p2[0]) + (p0[0] - p2[0]) * (py - p2[1])) / denominator
        w2 = 1.0 - w0 - w1
        inside = (w0 >= -0.002) & (w1 >= -0.002) & (w2 >= -0.002)
        if not inside.any():
            continue
        selected_y, selected_x = ys[inside], xs[inside]
        barycentric = np.stack([w0[inside], w1[inside], w2[inside]], axis=1).astype(np.float32)
        positions[selected_y, selected_x] = barycentric @ position[triangle]
        normals[selected_y, selected_x] = barycentric @ normal[triangle]
        covered[selected_y, selected_x] = True

    vertex_x = np.clip(pixel[:, 0].astype(np.int64), 0, size - 1)
    vertex_y = np.clip(pixel[:, 1].astype(np.int64), 0, size - 1)
    missing = ~covered[vertex_y, vertex_x]
    if missing.any():
        positions[vertex_y[missing], vertex_x[missing]] = position[missing]
        normals[vertex_y[missing], vertex_x[missing]] = normal[missing]
        covered[vertex_y[missing], vertex_x[missing]] = True
    return positions, normals, covered


def dilate(image: np.ndarray, covered: np.ndarray, texels: int) -> tuple[np.ndarray, np.ndarray]:
    """Pad UV islands, preventing filtered seams from sampling black background."""
    output = image.copy()
    filled = covered.copy()
    for _ in range(texels):
        holes = ~filled
        if not holes.any():
            break
        accumulated = np.zeros_like(output)
        weight = np.zeros(filled.shape, dtype=np.float32)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            shifted = np.roll(np.roll(output, dy, axis=0), dx, axis=1)
            shifted_mask = np.roll(np.roll(filled, dy, axis=0), dx, axis=1)
            accumulated += shifted * shifted_mask[:, :, None]
            weight += shifted_mask
        grew = holes & (weight > 0)
        if not grew.any():
            break
        output[grew] = accumulated[grew] / weight[grew][:, None]
        filled |= grew
    return output, filled


def asset_seed(relative_path: Path, primitive_index: int) -> float:
    digest = hashlib.sha256(f"{relative_path.as_posix()}:{primitive_index}".encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") / 2**32 * math.tau


def material_base_color(document: Mapping[str, Any], material_index: int) -> np.ndarray:
    material = document.get("materials", [])[material_index]
    pbr = material.get("pbrMetallicRoughness", {})
    factor = pbr.get("baseColorFactor", [1.0, 1.0, 1.0, 1.0])
    if len(factor) != 4:
        raise BakeError(f"material {material_index} has malformed baseColorFactor")
    return np.asarray(factor, dtype=np.float32)


def generated_albedo(
    position: np.ndarray,
    normal: np.ndarray,
    covered: np.ndarray,
    base: np.ndarray,
    category: str,
    seed: float,
) -> np.ndarray:
    """Generate restrained, category-specific hand-painted breakup in linear RGB."""
    lengths = np.linalg.norm(normal, axis=2, keepdims=True)
    unit_normal = np.divide(normal, np.where(lengths < 1e-8, 1.0, lengths))
    light = np.clip(unit_normal[:, :, 0] * 0.32 + unit_normal[:, :, 1] * 0.66 + unit_normal[:, :, 2] * 0.28, -1.0, 1.0)
    y = position[:, :, 1]
    x = position[:, :, 0]
    z = position[:, :, 2]
    span = max(float(y[covered].max() - y[covered].min()), 1e-6)
    height = (y - float(y[covered].min())) / span
    grain = (
        np.sin(x * 10.7 + z * 7.1 + seed)
        + 0.5 * np.sin(x * 24.1 - y * 15.3 + seed * 1.7)
        + 0.25 * np.sin(z * 39.7 + y * 11.9 + seed * 0.7)
    ) / 1.75

    if category == "terrain":
        motif = 0.075 * np.sin(height * 22.0 + x * 2.2 + seed) + 0.04 * np.sin(z * 17.0 - seed)
    elif category == "vfx":
        radius = np.sqrt(x * x + y * y + z * z)
        motif = 0.14 * np.sin(radius * 19.0 - seed) + 0.07 * np.sin(np.arctan2(z, x) * 8.0 + seed)
    elif category == "props":
        motif = 0.055 * np.sin(height * 31.0 + np.arctan2(z, x) * 5.0 + seed)
    else:  # tier props
        motif = 0.09 * np.sin(np.arctan2(z, x) * 6.0 + height * 13.0 + seed)

    value = np.clip(0.88 + light * 0.20 + grain * 0.08 + motif, 0.56, 1.20)
    albedo = np.clip(base[:3][None, None, :] * value[:, :, None], 0.0, 1.0)
    albedo[~covered] = 0.0
    return albedo


def append_embedded_texture(
    document: dict[str, Any], binary: bytes, png: bytes, name: str
) -> tuple[dict[str, Any], bytes, int]:
    """Append a PNG and glTF texture entry without moving existing accessors."""
    rebuilt = bytearray(binary)
    rebuilt += b"\0" * (-len(rebuilt) % 4)
    offset = len(rebuilt)
    rebuilt += png
    document.setdefault("bufferViews", []).append(
        {"buffer": 0, "byteOffset": offset, "byteLength": len(png)}
    )
    document["buffers"] = [{"byteLength": len(rebuilt)}]
    image_index = len(document.setdefault("images", []))
    document["images"].append(
        {"name": name, "bufferView": len(document["bufferViews"]) - 1, "mimeType": "image/png"}
    )
    sampler_index = 0
    if not document.get("samplers"):
        document["samplers"] = [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}]
    texture_index = len(document.setdefault("textures", []))
    document["textures"].append({"name": name, "sampler": sampler_index, "source": image_index})
    return document, bytes(rebuilt), texture_index


def attach_primitive_texture(
    document: dict[str, Any], primitive: dict[str, Any], texture_index: int, name: str
) -> int:
    material_index = primitive.get("material")
    if not isinstance(material_index, int):
        raise BakeError("primitive has no material assignment")
    source_material = document.get("materials", [])[material_index]
    material = copy.deepcopy(source_material)
    pbr = copy.deepcopy(material.setdefault("pbrMetallicRoughness", {}))
    original_factor = pbr.get("baseColorFactor", [1.0, 1.0, 1.0, 1.0])
    pbr["baseColorFactor"] = [1.0, 1.0, 1.0, float(original_factor[3])]
    pbr["baseColorTexture"] = {"index": texture_index, "texCoord": 0}
    material["pbrMetallicRoughness"] = pbr
    material["name"] = name
    document["materials"].append(material)
    new_index = len(document["materials"]) - 1
    primitive["material"] = new_index
    return new_index


def bake_primitive(
    document: dict[str, Any], binary: bytes, primitive: dict[str, Any], relative_path: Path,
    category: str, primitive_index: int, size: int,
) -> tuple[bytes, bytes, dict[str, Any]]:
    attributes = primitive.get("attributes", {})
    for required in ("POSITION", "NORMAL", "TEXCOORD_0"):
        if required not in attributes:
            raise BakeError(f"{relative_path}: primitive {primitive_index} has no {required}")
    if "indices" not in primitive:
        raise BakeError(f"{relative_path}: primitive {primitive_index} has no indices")
    uv = read_accessor(document, binary, attributes["TEXCOORD_0"]).astype(np.float64)
    position = read_accessor(document, binary, attributes["POSITION"]).astype(np.float32)
    normal = read_accessor(document, binary, attributes["NORMAL"]).astype(np.float32)
    triangles = read_accessor(document, binary, primitive["indices"]).ravel().astype(np.int64)
    if len(triangles) % 3:
        raise BakeError(f"{relative_path}: primitive {primitive_index} indices are not triangles")
    base = material_base_color(document, primitive["material"])
    positions, normals, covered = rasterize_attributes(uv, position, normal, triangles.reshape(-1, 3), size)
    coverage = float(covered.mean())
    if coverage <= 0.0001:
        raise BakeError(f"{relative_path}: primitive {primitive_index} has no UV texel coverage")
    generated = generated_albedo(positions, normals, covered, base, category, asset_seed(relative_path, primitive_index))
    padded, filled = dilate(generated, covered, DILATION_TEXELS)
    padded[filled] = np.maximum(padded[filled], 0.0005)
    png = encode_png(padded)
    return png, binary, {
        "baseColorFactor": [round(float(value), 6) for value in base],
        "uvCoverage": round(coverage, 6),
        "dilatedCoverage": round(float(filled.mean()), 6),
    }


def concept_reference(repo: Path, asset_id: str) -> dict[str, Any] | None:
    path = repo / PIPELINE_ROOT / "textures" / "props" / f"{asset_id}-concept.png"
    sidecar = path.with_suffix(".provenance.json")
    if not path.is_file() or not sidecar.is_file():
        return None
    data = json.loads(sidecar.read_text(encoding="utf-8"))
    receipt = data.get("runtimeReceipt", {})
    if receipt.get("runtimeEligible") is not False:
        raise BakeError(f"{sidecar}: candidate concept must explicitly be runtimeEligible=false")
    return {"path": path.relative_to(repo).as_posix(), "sha256": sha256_file(path), "provenance": sidecar.relative_to(repo).as_posix()}


def bake_asset(repo: Path, source: Path, source_root: Path, output_root: Path, atlas_size: int) -> dict[str, Any]:
    relative = source.relative_to(source_root)
    category = relative.parts[0]
    asset_id = source.stem
    document, binary = read_glb(source)
    source_sha = sha256_file(source)
    runtime_receipt = {
        "runtimeEligible": False,
        "status": "not-issued",
        "reason": "candidate-only: texture mapping is complete, but visual-fidelity and in-browser runtime gates remain pending",
    }
    texture_dir = output_root / "textures" / relative.with_suffix("")
    artifacts: list[dict[str, Any]] = []
    primitive_index = 0
    for mesh_index, mesh in enumerate(document.get("meshes", [])):
        for local_index, primitive in enumerate(mesh.get("primitives", [])):
            png, binary, metrics = bake_primitive(
                document, binary, primitive, relative, category, primitive_index, atlas_size
            )
            texture_name = f"{asset_id}-m{mesh_index}-p{local_index}-albedo-v01"
            texture_path = texture_dir / f"{texture_name}.png"
            texture_path.parent.mkdir(parents=True, exist_ok=True)
            texture_path.write_bytes(png)
            document, binary, texture_index = append_embedded_texture(document, binary, png, texture_name)
            material_index = attach_primitive_texture(document, primitive, texture_index, texture_name)
            artifacts.append({
                "meshIndex": mesh_index,
                "primitiveIndex": local_index,
                "materialIndex": material_index,
                "path": texture_path.relative_to(repo).as_posix(),
                "sha256": sha256_bytes(png),
                "bytes": len(png),
                "width": atlas_size,
                "height": atlas_size,
                **metrics,
            })
            primitive_index += 1
    if not artifacts:
        raise BakeError(f"{relative}: GLB contains no mesh primitives")
    glb = write_glb(document, binary)
    output = output_root / "glb" / relative
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(glb)
    row = {
        "assetId": asset_id,
        "assetClass": category,
        "source": relative.as_posix(),
        "sourceSha256": source_sha,
        "output": output.relative_to(repo).as_posix(),
        "outputSha256": sha256_bytes(glb),
        "outputBytes": len(glb),
        "textureArtifacts": artifacts,
        "appearanceReference": concept_reference(repo, asset_id),
        "runtimeEligible": False,
        "textureStatus": "UV-baked generated albedo atlas embedded in candidate GLB",
        "runtimeReceipt": runtime_receipt,
    }
    for artifact in artifacts:
        texture = repo / artifact["path"]
        texture_receipt = {
            "schemaVersion": SCHEMA_VERSION,
            "source": {
                "kind": "repository-authored-procedural-candidate",
                "path": row["source"],
                "sha256": source_sha,
                "readOnly": True,
            },
            "generator": {
                "tool": "scripts/bake-procedural-resource-albedo.py",
                "technique": "deterministic UV rasterization with category-specific procedural color breakup",
                "atlasSize": atlas_size,
                "dilationTexels": DILATION_TEXELS,
            },
            "output": artifact,
            "rightsReceipt": "repository-authored deterministic texture output",
            "runtimeReceipt": runtime_receipt,
            "runtimeEligible": False,
        }
        texture.with_name(f"{texture.stem}.provenance.json").write_text(
            json.dumps(texture_receipt, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    receipt = {
        "schemaVersion": SCHEMA_VERSION,
        "source": {
            "kind": "repository-authored-procedural-candidate",
            "path": row["source"],
            "sha256": source_sha,
            "readOnly": True,
        },
        "generator": {
            "tool": "scripts/bake-procedural-resource-albedo.py",
            "technique": "deterministic UV rasterization with category-specific procedural color breakup",
            "atlasSize": atlas_size,
            "dilationTexels": DILATION_TEXELS,
        },
        "output": {
            "path": row["output"],
            "sha256": row["outputSha256"],
            "embeddedAlbedoTextures": len(artifacts),
        },
        "textureArtifacts": artifacts,
        "appearanceReference": row["appearanceReference"],
        "rightsReceipt": "repository-authored deterministic texture output; any candidate appearance reference remains separately recorded",
        "runtimeReceipt": row["runtimeReceipt"],
        "runtimeEligible": False,
    }
    output.with_suffix(".provenance.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return row


def manifest_for(repo: Path, source_root: Path, output_root: Path, rows: list[dict[str, Any]], atlas_size: int) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "lane": "candidate/ingame-mesh/textured",
        "generatedBy": "scripts/bake-procedural-resource-albedo.py",
        "sourceRoot": source_root.relative_to(repo).as_posix(),
        "outputRoot": output_root.relative_to(repo).as_posix(),
        "atlasSize": atlas_size,
        "dilationTexels": DILATION_TEXELS,
        "assetCount": len(rows),
        "textureCount": sum(len(row["textureArtifacts"]) for row in rows),
        "textureBytes": sum(
            artifact["bytes"] for row in rows for artifact in row["textureArtifacts"]
        ),
        "candidateGlbBytes": sum(row["outputBytes"] for row in rows),
        "lowCoverageThreshold": 0.15,
        "lowCoverageTextureCount": sum(
            artifact["uvCoverage"] < 0.15
            for row in rows
            for artifact in row["textureArtifacts"]
        ),
        "runtimeEligible": False,
        "promotionStatus": "not-issued",
        "rows": rows,
    }


def verify_asset(repo: Path, source_root: Path, row: Mapping[str, Any], atlas_size: int) -> None:
    source = source_root / row["source"]
    output = repo / row["output"]
    if not source.is_file() or sha256_file(source) != row["sourceSha256"]:
        raise BakeError(f"{row['assetId']}: staged source missing or changed")
    if not output.is_file() or sha256_file(output) != row["outputSha256"]:
        raise BakeError(f"{row['assetId']}: candidate GLB missing or changed")
    document, binary = read_glb(output)
    primitives = [primitive for mesh in document.get("meshes", []) for primitive in mesh.get("primitives", [])]
    artifacts = row["textureArtifacts"]
    if len(primitives) != len(artifacts):
        raise BakeError(f"{row['assetId']}: primitive/texture count mismatch")
    for artifact in artifacts:
        texture = repo / artifact["path"]
        if not texture.is_file() or sha256_file(texture) != artifact["sha256"]:
            raise BakeError(f"{row['assetId']}: generated PNG missing or changed")
        texture_receipt = texture.with_name(f"{texture.stem}.provenance.json")
        if not texture_receipt.is_file():
            raise BakeError(f"{row['assetId']}: generated PNG provenance missing")
        texture_data = json.loads(texture_receipt.read_text(encoding="utf-8"))
        output_data = texture_data.get("output", {})
        if (
            texture_data.get("runtimeEligible") is not False
            or texture_data.get("runtimeReceipt", {}).get("runtimeEligible") is not False
            or output_data.get("path") != artifact["path"]
            or output_data.get("sha256") != artifact["sha256"]
        ):
            raise BakeError(f"{row['assetId']}: generated PNG provenance is incomplete or stale")
        with Image.open(texture) as image:
            if image.size != (atlas_size, atlas_size) or image.mode != "RGB":
                raise BakeError(f"{row['assetId']}: atlas is not {atlas_size}px RGB")
    for primitive in primitives:
        material = document["materials"][primitive["material"]]
        texture_index = material.get("pbrMetallicRoughness", {}).get("baseColorTexture", {}).get("index")
        if not isinstance(texture_index, int):
            raise BakeError(f"{row['assetId']}: primitive lacks embedded base-color texture")
        image_index = document["textures"][texture_index].get("source")
        image = document["images"][image_index]
        if image.get("mimeType") != "image/png" or "bufferView" not in image:
            raise BakeError(f"{row['assetId']}: base-color image is not embedded PNG")
        view = document["bufferViews"][image["bufferView"]]
        payload = binary[view.get("byteOffset", 0) : view.get("byteOffset", 0) + view["byteLength"]]
        with Image.open(io.BytesIO(payload)) as embedded:
            if embedded.size != (atlas_size, atlas_size) or embedded.mode != "RGB":
                raise BakeError(f"{row['assetId']}: embedded atlas is malformed")
    receipt = output.with_suffix(".provenance.json")
    if not receipt.is_file():
        raise BakeError(f"{row['assetId']}: candidate provenance receipt missing")
    receipt_data = json.loads(receipt.read_text(encoding="utf-8"))
    if receipt_data.get("runtimeReceipt", {}).get("runtimeEligible") is not False:
        raise BakeError(f"{row['assetId']}: candidate receipt lost runtime guard")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bake UV-aligned albedo maps into procedural candidate GLBs")
    parser.add_argument("--source-root", type=Path, default=SOURCE_ROOT)
    parser.add_argument("--output-root", type=Path, default=OUTPUT_ROOT)
    parser.add_argument("--atlas-size", type=int, default=ATLAS_SIZE)
    parser.add_argument("--check", action="store_true", help="verify generated candidate artifacts without writing")
    args = parser.parse_args(argv)
    if args.atlas_size <= 0 or args.atlas_size & (args.atlas_size - 1):
        parser.error("--atlas-size must be a positive power of two")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    repo = repository_root()
    source_root = (repo / args.source_root).resolve() if not args.source_root.is_absolute() else args.source_root.resolve()
    output_root = (repo / args.output_root).resolve() if not args.output_root.is_absolute() else args.output_root.resolve()
    runtime_root = (repo / RUNTIME_ROOT).resolve()
    if source_root == runtime_root or output_root == runtime_root or runtime_root in output_root.parents:
        raise BakeError("runtime GLB lane is immutable; use the candidate output root")
    if not source_root.is_dir():
        raise BakeError(f"staged candidate source root missing: {source_root}")
    manifest_path = output_root / MANIFEST_NAME
    if args.check:
        if not manifest_path.is_file():
            raise BakeError(f"candidate manifest missing: {manifest_path}")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("runtimeEligible") is not False or manifest.get("atlasSize") != args.atlas_size:
            raise BakeError("manifest does not retain candidate-only texture contract")
        rows = manifest.get("rows", [])
        if len(rows) != len(list(source_root.rglob("*.glb"))):
            raise BakeError("manifest does not cover every staged candidate GLB")
        if manifest.get("textureBytes") != sum(
            artifact["bytes"] for row in rows for artifact in row["textureArtifacts"]
        ):
            raise BakeError("manifest texture byte total is stale")
        if manifest.get("candidateGlbBytes") != sum(row["outputBytes"] for row in rows):
            raise BakeError("manifest GLB byte total is stale")
        for row in rows:
            verify_asset(repo, source_root, row, args.atlas_size)
        print(json.dumps({
            "ok": True,
            "assets": len(rows),
            "textures": manifest["textureCount"],
            "textureBytes": manifest["textureBytes"],
            "candidateGlbBytes": manifest["candidateGlbBytes"],
            "runtimeEligible": False,
        }, sort_keys=True))
        return 0

    sources = sorted(source_root.rglob("*.glb"))
    if not sources:
        raise BakeError(f"no staged GLB candidates under {source_root}")
    rows = [bake_asset(repo, source, source_root, output_root, args.atlas_size) for source in sources]
    manifest = manifest_for(repo, source_root, output_root, rows, args.atlas_size)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "manifest": manifest_path.relative_to(repo).as_posix(),
        "assets": len(rows),
        "textures": manifest["textureCount"],
        "textureBytes": manifest["textureBytes"],
        "candidateGlbBytes": manifest["candidateGlbBytes"],
        "runtimeEligible": False,
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BakeError as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
