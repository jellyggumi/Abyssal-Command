import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
ASSETS = [
    ROOT / "assets/images/battle/glb/terrain/starless-canal.glb",
    ROOT / "assets/images/battle/glb/terrain/shattered-causeway.glb",
]


def parse_glb(path):
    raw = path.read_bytes()
    magic, version, declared_length = struct.unpack_from("<4sII", raw, 0)
    assert magic == b"glTF" and version == 2 and declared_length == len(raw)
    offset = 12
    chunks = []
    while offset < len(raw):
        chunk_length, chunk_type = struct.unpack_from("<II", raw, offset)
        offset += 8
        chunks.append((chunk_type, raw[offset:offset + chunk_length]))
        offset += chunk_length
    document = json.loads(chunks[0][1].decode("utf-8"))
    primitives = [primitive for mesh in document["meshes"] for primitive in mesh["primitives"]]
    materials = document["materials"]
    accessors = document["accessors"]
    position_accessors = [accessors[primitive["attributes"]["POSITION"]] for primitive in primitives]
    mins = [accessor["min"] for accessor in position_accessors]
    maxs = [accessor["max"] for accessor in position_accessors]
    bounds_min = [min(values[axis] for values in mins) for axis in range(3)]
    bounds_max = [max(values[axis] for values in maxs) for axis in range(3)]
    extents = [bounds_max[axis] - bounds_min[axis] for axis in range(3)]
    checks = {
        "primitive_count_gte_20": len(primitives) >= 20,
        "material_count_gte_4": len(materials) >= 4,
        "normals_every_primitive": all("NORMAL" in primitive["attributes"] for primitive in primitives),
        "uvs_every_primitive": all("TEXCOORD_0" in primitive["attributes"] for primitive in primitives),
        "material_every_primitive": all("material" in primitive for primitive in primitives),
        "albedo_every_material": all("baseColorTexture" in material.get("pbrMetallicRoughness", {}) for material in materials),
        "normal_map_every_material": all("normalTexture" in material for material in materials),
        "embedded_images": len(document.get("images", [])) >= 2 and all("bufferView" in image for image in document["images"]),
        "non_degenerate_3d_bounds": all(extent > 0 for extent in extents),
    }
    assert all(checks.values()), {path.name: checks}
    return {
        "asset": str(path.relative_to(ROOT)),
        "bytes": len(raw),
        "meshes": len(document["meshes"]),
        "primitives": len(primitives),
        "materials": len(materials),
        "embedded_images": [image.get("name") for image in document["images"]],
        "bounds_min": bounds_min,
        "bounds_max": bounds_max,
        "extents": extents,
        "checks": checks,
    }


print(json.dumps([parse_glb(path) for path in ASSETS], indent=2))
