#!/usr/bin/env python3
"""Bake a per-character cartoon albedo atlas into every non-commander character.

The whole-body motion pass fixed how the cast *moves*; it did not give the cast
anything to *look at*. 23 of the 24 characters shipped with no albedo art at
all: one shared 256 px detail tile (``abyssal-toon-surface-subtle-v01.png``)
multiplied by a single per-character ``baseColorFactor``. A flat tint under a
cel ramp is exactly what makes a character read as a soft blob instead of a
drawn silhouette.

This stage rasterises each character's own UV unwrap and bakes a four-band
cartoon albedo into it, so the art is generated *against the atlas the mesh
actually uses* rather than against a lost source layout:

  * the character's existing ``baseColorFactor`` stays the mid palette anchor,
    so nobody's silhouette colour changes identity;
  * local height, surface normal and radial panel breakup drive a quantised
    four-step ramp (shadow / body / lit / rim), which is what a cel-shaded
    character reads as;
  * a waist sash and a boot band are stamped in the character's accent hue so
    the torso and legs separate at gameplay camera distance;
  * the shared detail tile is modulated back in at low amplitude so the surface
    keeps its grain instead of going plastic.

Every baked island is then dilated outward, which is what stops a UV **seam**
from sampling background when the GPU filters or mips the atlas.

The commander is copied through untouched: it is the one character that already
owns authored albedo art, and its deployed bytes are pinned by
tests/commander-guard-pose.test.mjs.

  python3 scripts/bake-character-albedo.py            # bake the candidate lane
  python3 scripts/bake-character-albedo.py --check    # verify only
"""

from __future__ import annotations

import argparse
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

PIPELINE_ROOT = Path(
    "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline"
)
INPUT_LANE = PIPELINE_ROOT / "runtime-candidates" / "wholebody-motion"
INPUT_MANIFEST = INPUT_LANE / "wholebody-motion.manifest.json"
OUTPUT_LANE = PIPELINE_ROOT / "runtime-candidates" / "character-albedo"
OUTPUT_MANIFEST = OUTPUT_LANE / "character-albedo.manifest.json"


# The commander already carries authored albedo art and pinned deployed bytes.
COPY_THROUGH_ASSET_IDS: tuple[str, ...] = ("dusk-warden",)
DETAIL_TILE = (
    PIPELINE_ROOT
    / "all-mesh-texture-candidates-v2"
    / "derived-textures"
    / "abyssal-toon-surface-subtle-v01.png"
)
ATLAS_SIZE = 1024
DILATION_TEXELS = 12
# Linear value that still encodes to a non-zero 8-bit sRGB channel, so a baked
# texel can never be mistaken for untouched atlas background.
LINEAR_FLOOR = 0.0005

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
    """Raised when a bake or verification invariant is violated."""


def repository_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "package.json").is_file():
            return parent
    raise BakeError("repository root with package.json not found")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


# ---------------------------------------------------------------------------
# GLB reading / writing
# ---------------------------------------------------------------------------


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
        elif chunk_type == GLB_BIN_CHUNK:
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
    out = bytearray()
    out += b"glTF" + struct.pack("<II", 2, total)
    out += struct.pack("<II", len(json_bytes), GLB_JSON_CHUNK) + json_bytes
    if binary:
        out += struct.pack("<II", len(binary), GLB_BIN_CHUNK) + binary
    return bytes(out)


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


def repack_with_image(
    document: dict[str, Any], binary: bytes, image_index: int, png_bytes: bytes
) -> tuple[dict[str, Any], bytes]:
    """Rewrite the BIN chunk, replacing exactly one image's bufferView payload.

    bufferView *indices* are preserved, so every accessor, image and skin
    reference stays valid; only byteOffset/byteLength move.
    """
    image = document["images"][image_index]
    if "bufferView" not in image:
        raise BakeError("expected an embedded (bufferView-backed) base colour image")
    target_view = image["bufferView"]
    out = bytearray()
    views = document["bufferViews"]
    for index, view in enumerate(views):
        start = view.get("byteOffset", 0)
        payload = png_bytes if index == target_view else binary[start : start + view["byteLength"]]
        if len(payload) != view["byteLength"] and index != target_view:
            raise BakeError("bufferView payload truncated while repacking")
        out += b"\0" * (-len(out) % 4)
        view["byteOffset"] = len(out)
        view["byteLength"] = len(payload)
        out += payload
    out += b"\0" * (-len(out) % 4)
    document["buffers"] = [{"byteLength": len(out)}]
    for view in views:
        view["buffer"] = 0
    return document, bytes(out)


# ---------------------------------------------------------------------------
# Palette + albedo bake
# ---------------------------------------------------------------------------


def srgb_encode(linear: np.ndarray) -> np.ndarray:
    linear = np.clip(linear, 0.0, 1.0)
    low = linear * 12.92
    high = 1.055 * np.power(linear, 1.0 / 2.4) - 0.055
    return np.where(linear <= 0.0031308, low, high)


def srgb_decode(encoded: np.ndarray) -> np.ndarray:
    encoded = np.clip(encoded, 0.0, 1.0)
    low = encoded / 12.92
    high = np.power((encoded + 0.055) / 1.055, 2.4)
    return np.where(encoded <= 0.04045, low, high)


def character_palette(base_color_factor: list[float]) -> dict[str, list[float]]:
    """Five ramp stops in linear space, anchored on the character's own tint."""
    mid = np.array(base_color_factor[:3], dtype=np.float64)
    if not np.any(mid > 0):
        mid = np.array([0.35, 0.32, 0.38])
    # Abyssal shadows go cool and violet; lit sides go warm, like the key light.
    shadow = mid * np.array([0.44, 0.40, 0.62])
    body = mid
    lit = np.clip(mid * np.array([1.62, 1.55, 1.44]) + 0.035, 0.0, 1.0)
    rim = np.clip(mid * np.array([2.15, 2.05, 1.95]) + 0.11, 0.0, 1.0)
    # Accent = the tint rotated one channel, so every character's sash reads as
    # its own hue instead of a shared gold.
    accent = np.clip(np.array([mid[2], mid[0], mid[1]]) * 1.9 + 0.06, 0.0, 1.0)
    return {
        "shadow": [round(float(value), 6) for value in shadow],
        "body": [round(float(value), 6) for value in body],
        "lit": [round(float(value), 6) for value in lit],
        "rim": [round(float(value), 6) for value in rim],
        "accent": [round(float(value), 6) for value in accent],
    }


def rasterize_attributes(
    uv: np.ndarray, position: np.ndarray, normal: np.ndarray, triangles: np.ndarray, size: int
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Barycentric-rasterise position and normal into the mesh's own UV atlas."""
    pos_buffer = np.zeros((size, size, 3), dtype=np.float32)
    nrm_buffer = np.zeros((size, size, 3), dtype=np.float32)
    covered = np.zeros((size, size), dtype=bool)

    # UV origin is top-left in glTF image space.
    pixel = np.empty_like(uv)
    pixel[:, 0] = uv[:, 0] * size
    pixel[:, 1] = uv[:, 1] * size

    for tri in triangles:
        p0, p1, p2 = pixel[tri]
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
        px = xs + 0.5
        py = ys + 0.5
        w0 = ((p1[1] - p2[1]) * (px - p2[0]) + (p2[0] - p1[0]) * (py - p2[1])) / denominator
        w1 = ((p2[1] - p0[1]) * (px - p2[0]) + (p0[0] - p2[0]) * (py - p2[1])) / denominator
        w2 = 1.0 - w0 - w1
        # A small negative tolerance closes the hairline cracks between adjacent
        # triangles that would otherwise show up as unshaded texels on a seam.
        inside = (w0 >= -0.002) & (w1 >= -0.002) & (w2 >= -0.002)
        if not inside.any():
            continue
        sel_y = ys[inside]
        sel_x = xs[inside]
        bary = np.stack([w0[inside], w1[inside], w2[inside]], axis=1).astype(np.float32)
        pos_buffer[sel_y, sel_x] = bary @ position[tri]
        nrm_buffer[sel_y, sel_x] = bary @ normal[tri]
        covered[sel_y, sel_x] = True

    # A vertex that only belongs to zero-area triangles never gets rasterised,
    # so its texel would stay background even though the mesh can still sample
    # it. Stamp those directly, so "every texel this mesh addresses is baked"
    # holds for the whole atlas and can be checked from the PNG alone.
    vx = np.clip(pixel[:, 0].astype(np.int64), 0, size - 1)
    vy = np.clip(pixel[:, 1].astype(np.int64), 0, size - 1)
    missing = ~covered[vy, vx]
    if missing.any():
        pos_buffer[vy[missing], vx[missing]] = position[missing]
        nrm_buffer[vy[missing], vx[missing]] = normal[missing]
        covered[vy[missing], vx[missing]] = True
    return pos_buffer, nrm_buffer, covered



def shade_albedo(
    position: np.ndarray,
    normal: np.ndarray,
    covered: np.ndarray,
    palette: Mapping[str, list[float]],
    detail: np.ndarray,
) -> np.ndarray:
    """Four-band cartoon shading of the rasterised surface, in linear space."""
    height = position[:, :, 1]
    covered_heights = height[covered]
    low = float(covered_heights.min())
    high = float(covered_heights.max())
    span = max(high - low, 1e-6)
    h = np.clip((height - low) / span, 0.0, 1.0)

    length = np.linalg.norm(normal, axis=2, keepdims=True)
    unit = np.divide(normal, np.where(length < 1e-8, 1.0, length))
    up = unit[:, :, 1]

    # Radial panel breakup: cloth/plate facets around the body axis.
    angle = np.arctan2(position[:, :, 0], position[:, :, 2])
    facets = 0.055 * np.sin(9.0 * angle) + 0.03 * np.sin(23.0 * angle + 1.7)

    field = 0.46 * h + 0.44 * (0.5 + 0.5 * up) + facets
    field = np.clip(field, 0.0, 1.0)
    band = np.clip((field * 4.0).astype(np.int32), 0, 3)

    stops = np.stack(
        [
            np.array(palette["shadow"], dtype=np.float32),
            np.array(palette["body"], dtype=np.float32),
            np.array(palette["lit"], dtype=np.float32),
            np.array(palette["rim"], dtype=np.float32),
        ]
    )
    albedo = stops[band]

    accent = np.array(palette["accent"], dtype=np.float32)
    # Waist sash and boot band: two horizontal reads that separate torso, hips
    # and legs at the top-down gameplay camera distance.
    sash = (h > 0.505) & (h < 0.575)
    boots = h < 0.115
    albedo[sash] = accent
    albedo[boots] = np.array(palette["shadow"], dtype=np.float32) * 0.72
    # Crown/hood catch light so the head stays the brightest read.
    crown = (h > 0.895) & (up > 0.1)
    albedo[crown] = np.clip(np.array(palette["rim"], dtype=np.float32) * 1.06, 0.0, 1.0)

    albedo = albedo * (0.88 + 0.24 * detail[:, :, None])
    albedo[~covered] = 0.0
    return np.clip(albedo, 0.0, 1.0)


def dilate(image: np.ndarray, covered: np.ndarray, texels: int) -> tuple[np.ndarray, np.ndarray]:
    """Flood the atlas background outward so filtered UV seams never sample it."""
    out = image.copy()
    filled = covered.copy()
    for _ in range(texels):
        holes = ~filled
        if not holes.any():
            break
        accumulator = np.zeros_like(out)
        weight = np.zeros(filled.shape, dtype=np.float32)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            shifted = np.roll(np.roll(out, dy, axis=0), dx, axis=1)
            shifted_mask = np.roll(np.roll(filled, dy, axis=0), dx, axis=1)
            accumulator += shifted * shifted_mask[:, :, None]
            weight += shifted_mask
        grew = holes & (weight > 0)
        if not grew.any():
            break
        out[grew] = accumulator[grew] / weight[grew][:, None]
        filled |= grew
    return out, filled


_DETAIL_CACHE: dict[tuple[str, int], np.ndarray] = {}


def detail_field(root: Path, size: int) -> np.ndarray:
    """The shared grain tile the cast already wore, repeated across the atlas."""
    key = (str(root), size)
    cached = _DETAIL_CACHE.get(key)
    if cached is not None:
        return cached
    tile = np.asarray(Image.open(root / DETAIL_TILE).convert("L"), dtype=np.float32) / 255.0
    repeats = int(math.ceil(size / tile.shape[0]))
    field = np.tile(tile, (repeats, repeats))[:size, :size]
    _DETAIL_CACHE[key] = field
    return field



def encode_png(linear: np.ndarray) -> bytes:
    encoded = np.clip(np.round(srgb_encode(linear) * 255.0), 0, 255).astype(np.uint8)
    buffer = io.BytesIO()
    Image.fromarray(encoded, mode="RGB").save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def base_colour_image_index(document: Mapping[str, Any], material_index: int) -> int:
    material = document["materials"][material_index]
    texture_index = material["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    return document["textures"][texture_index]["source"]


def bake_asset(root: Path, asset_id: str, source: Path) -> dict[str, Any]:
    document, binary = read_glb(source)
    meshes = document.get("meshes", [])
    primitives = [primitive for mesh in meshes for primitive in mesh.get("primitives", [])]
    if len(primitives) != 1:
        raise BakeError(f"{asset_id}: expected exactly one primitive, found {len(primitives)}")
    primitive = primitives[0]
    attributes = primitive["attributes"]
    for required in ("POSITION", "NORMAL", "TEXCOORD_0"):
        if required not in attributes:
            raise BakeError(f"{asset_id}: primitive has no {required}")

    uv = read_accessor(document, binary, attributes["TEXCOORD_0"]).astype(np.float64)
    position = read_accessor(document, binary, attributes["POSITION"]).astype(np.float32)
    normal = read_accessor(document, binary, attributes["NORMAL"]).astype(np.float32)
    triangles = read_accessor(document, binary, primitive["indices"]).ravel().astype(np.int64)
    triangles = triangles.reshape(-1, 3)

    material_index = primitive["material"]
    material = document["materials"][material_index]
    pbr = material["pbrMetallicRoughness"]
    palette = character_palette(list(pbr.get("baseColorFactor", [1.0, 1.0, 1.0, 1.0])))

    pos_buffer, nrm_buffer, covered = rasterize_attributes(
        uv, position, normal, triangles, ATLAS_SIZE
    )
    coverage = float(covered.mean())
    if coverage < 0.30:
        raise BakeError(f"{asset_id}: UV coverage {coverage:.3f} is too low to bake against")

    detail = detail_field(root, ATLAS_SIZE)
    albedo = shade_albedo(pos_buffer, nrm_buffer, covered, palette, detail)
    dilated, filled = dilate(albedo, covered, DILATION_TEXELS)
    # Every filled texel is lifted off absolute zero, so "all three channels are
    # 0" means "atlas background" exactly -- which is what lets a checker
    # measure the seam padding from the shipped PNG alone.
    dilated[filled] = np.maximum(dilated[filled], LINEAR_FLOOR)
    png_bytes = encode_png(dilated)


    image_index = base_colour_image_index(document, material_index)
    document["images"][image_index]["mimeType"] = "image/png"
    document["images"][image_index]["name"] = f"{asset_id}-cartoon-albedo-v01"
    pbr["baseColorFactor"] = [1.0, 1.0, 1.0, 1.0]
    material["name"] = f"{asset_id}_toon_albedo"
    document, rebuilt = repack_with_image(document, binary, image_index, png_bytes)

    return {
        "glb": write_glb(document, rebuilt),
        "atlasSha256": sha256_bytes(png_bytes),
        "atlasBytes": len(png_bytes),
        "uvCoverage": round(coverage, 6),
        "dilatedCoverage": round(float(filled.mean()), 6),
        "palette": palette,
    }


# ---------------------------------------------------------------------------
# Lane driver
# ---------------------------------------------------------------------------


def build_rows(root: Path) -> list[dict[str, Any]]:
    manifest_path = root / INPUT_MANIFEST
    if not manifest_path.is_file():
        raise BakeError(f"missing input manifest, stage the whole-body pass first: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    rows: list[dict[str, Any]] = []
    for row in manifest.get("rows", []):
        asset_id = row["assetId"]
        relative = row["relativePath"]
        source = root / row["outputPath"]
        if not source.is_file():
            raise BakeError(f"missing whole-body candidate: {source}")
        rows.append(
            {
                "assetId": asset_id,
                "relativePath": relative,
                "inputPath": row["outputPath"],
                "inputSha256": sha256_file(source),
                "outputPath": (OUTPUT_LANE / "glb" / relative).as_posix(),
                "albedoBaked": asset_id not in COPY_THROUGH_ASSET_IDS,
            }
        )
    if not rows:
        raise BakeError("the whole-body manifest lists no characters")
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Bake per-character cartoon albedo atlases into the character candidate lane"
    )
    parser.add_argument("--check", action="store_true", help="verify the lane without writing")
    parser.add_argument(
        "--out",
        default=None,
        help="alternate lane root (used by the determinism test); defaults to the tracked lane",
    )
    args = parser.parse_args(argv)

    root = repository_root()
    lane_root = Path(args.out) if args.out else root / OUTPUT_LANE
    manifest_path = (
        lane_root / OUTPUT_MANIFEST.name if args.out else root / OUTPUT_MANIFEST
    )

    rows = build_rows(root)
    baked = 0
    for row in rows:
        source = root / row["inputPath"]
        destination = (
            lane_root / "glb" / row["relativePath"] if args.out else root / row["outputPath"]
        )
        if row["albedoBaked"]:
            result = bake_asset(root, row["assetId"], source)
            payload = result["glb"]
            row["atlasSha256"] = result["atlasSha256"]
            row["atlasBytes"] = result["atlasBytes"]
            row["atlasWidth"] = ATLAS_SIZE
            row["atlasHeight"] = ATLAS_SIZE
            row["uvCoverage"] = result["uvCoverage"]
            row["dilatedCoverage"] = result["dilatedCoverage"]
            row["dilationTexels"] = DILATION_TEXELS
            row["palette"] = result["palette"]
            baked += 1
        else:
            payload = source.read_bytes()
            row["atlasSha256"] = None
            row["copyThroughReason"] = (
                "authored cartoon albedo already ships with this character and its deployed "
                "bytes are pinned by tests/commander-guard-pose.test.mjs"
            )
        row["outputSha256"] = sha256_bytes(payload)
        if args.check and not args.out:
            if not destination.is_file():
                raise BakeError(f"missing candidate: {destination}")
            if sha256_file(destination) != row["outputSha256"]:
                raise BakeError(f"{row['relativePath']}: candidate bytes drifted from the bake")
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(payload)

    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedBy": "scripts/bake-character-albedo.py",
        "candidateRoot": OUTPUT_LANE.as_posix(),
        "inputManifest": INPUT_MANIFEST.as_posix(),
        "detailTile": DETAIL_TILE.as_posix(),
        "detailTileSha256": sha256_file(root / DETAIL_TILE),
        "atlasSize": ATLAS_SIZE,
        "dilationTexels": DILATION_TEXELS,
        "characterCount": len(rows),
        "bakedCount": baked,
        "copyThroughAssetIds": list(COPY_THROUGH_ASSET_IDS),
        "defect": (
            "23 of 24 characters shipped with no albedo art: one shared 256 px detail tile "
            "times a single baseColorFactor, which reads as an untextured blob under the cel ramp"
        ),
        "runtimeEligible": True,
        "rows": rows,
    }
    serialized = json.dumps(manifest, indent=2, sort_keys=True) + "\n"
    if args.check and not args.out:
        if not manifest_path.is_file():
            raise BakeError(f"missing lane manifest: {manifest_path}")
        if manifest_path.read_text(encoding="utf-8") != serialized:
            raise BakeError(f"lane manifest does not describe the baked lane: {manifest_path}")
    else:
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(serialized, encoding="utf-8")

    print(
        json.dumps(
            {
                "manifest": manifest_path.as_posix(),
                "characters": len(rows),
                "baked": baked,
                "copyThrough": list(COPY_THROUGH_ASSET_IDS),
                "checked": bool(args.check and not args.out),
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BakeError as error:
        print(f"error: {error}", file=sys.stderr)
        sys.exit(1)
