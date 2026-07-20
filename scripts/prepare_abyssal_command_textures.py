"""Convert source texture art into embedded-PBR-ready albedo and normal-map PNGs.

Run from the repository root with Blender:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/prepare_abyssal_command_textures.py
"""

from __future__ import annotations

import json
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
TEXTURE_ROOT = ROOT / "assets" / "models" / "abyssal-command" / "textures"
SOURCE_ROOT = TEXTURE_ROOT / "source"

# Source art is retained under textures/source; emitted PBR maps are deliberately
# POT-sized to keep every embedded GLB texture residency bounded.
OUTPUT_TEXTURE_SIZE = 1024

TEXTURES = {
    "void-obsidian": 2.6,
    "cold-steel": 1.8,
    "ash-cloth": 1.0,
    "violet-rift": 1.2,
    "cinder-ember": 1.8,
    "gate-gold": 1.5,
    "old-bone": 1.2,
}

# The two concept-driven replacements are copied into the canonical texture
# family slots so every existing GLB keeps its seven-family manifest contract.
# Their generation provenance stays in texture-manifest.json for review.
TEXTURE_METADATA = {
    "ash-cloth": {
        "generatedBy": "functions.generate_image (openai-codex)",
        "generatedSource": "source/player-void-weave.png",
        "referenceInputs": [
            "assets/images/battle/glb/shade__Idle.png",
            "assets/images/ui/concept-tactical-surface.png",
        ],
        "derivation": "Concept-aligned player shade cloth/obsidian weave generated as a seamless tileable albedo replacement.",
    },
    "void-obsidian": {
        "generatedSource": "source/prop-rift-glyph.png",
        "generatedBy": "functions.generate_image (openai-codex)",
        "referenceInputs": [
            "assets/images/ui/concept-tactical-surface.png",
            "assets/images/battle/glb/rift-portal__Idle.png",
        ],
        "derivation": "Concept-aligned interactive-prop obsidian with violet rift glyph channels generated as a seamless tileable albedo replacement.",
    },
}


def save_albedo(source_path: Path, target_path: Path):
    image = bpy.data.images.load(str(source_path), check_existing=False)
    image.colorspace_settings.name = "sRGB"
    source_width, source_height = image.size
    image.scale(OUTPUT_TEXTURE_SIZE, OUTPUT_TEXTURE_SIZE)
    image.filepath_raw = str(target_path)
    image.file_format = "PNG"
    image.save()
    pixels = np.asarray(image.pixels[:], dtype=np.float32).reshape(OUTPUT_TEXTURE_SIZE, OUTPUT_TEXTURE_SIZE, 4)
    bpy.data.images.remove(image)
    return pixels, (source_width, source_height)


def save_normal(texture_id: str, albedo: np.ndarray, strength: float, target_path: Path):
    rgb = albedo[..., :3]
    height_map = np.dot(rgb, np.asarray((0.2126, 0.7152, 0.0722), dtype=np.float32))
    dx = (np.roll(height_map, -1, axis=1) - np.roll(height_map, 1, axis=1)) * 0.5
    dy = (np.roll(height_map, -1, axis=0) - np.roll(height_map, 1, axis=0)) * 0.5
    tangent = np.dstack((-dx * strength, -dy * strength, np.ones_like(height_map)))
    tangent /= np.maximum(np.linalg.norm(tangent, axis=2, keepdims=True), 1e-6)

    rgba = np.empty_like(albedo)
    rgba[..., :3] = tangent * 0.5 + 0.5
    rgba[..., 3] = 1.0
    height, width = rgba.shape[:2]
    normal = bpy.data.images.new(f"N_{texture_id}", width=width, height=height, alpha=True)
    normal.colorspace_settings.name = "Non-Color"
    normal.pixels.foreach_set(rgba.reshape(-1))
    normal.filepath_raw = str(target_path)
    normal.file_format = "PNG"
    normal.save()
    bpy.data.images.remove(normal)


texture_records = []
for texture_id, strength in TEXTURES.items():
    source = SOURCE_ROOT / f"{texture_id}.png"
    if not source.is_file():
        raise FileNotFoundError(f"Missing source texture: {source}")
    albedo, source_resolution = save_albedo(source, TEXTURE_ROOT / f"{texture_id}-albedo.png")
    save_normal(texture_id, albedo, strength, TEXTURE_ROOT / f"{texture_id}-normal.png")
    texture_records.append({
        "id": texture_id,
        "source": f"source/{texture_id}.png",
        "albedo": f"{texture_id}-albedo.png",
        "normal": f"{texture_id}-normal.png",
        "normalConvention": "OpenGL tangent-space (+Y), tiling Sobel derivation",
        "normalStrength": strength,
        "sourceResolution": list(source_resolution),
        "outputResolution": [OUTPUT_TEXTURE_SIZE, OUTPUT_TEXTURE_SIZE],
        **TEXTURE_METADATA.get(texture_id, {}),
    })

provenance = {
    "version": 2,
    "baseColorSources": texture_records,
}
(TEXTURE_ROOT / "texture-manifest.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
print(f"ABYSSAL_TEXTURES_READY count={len(TEXTURES)} output={TEXTURE_ROOT}")
