#!/usr/bin/env python3
"""Build a power-of-two, periodic Cinder Span PBR texture set in Blender."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
import numpy as np

TARGET_SIZE = 1024
SEAM_MARGIN = 32
SEAM_RATIO_THRESHOLD = 1.5


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--source-provenance", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    return parser.parse_args(argv)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_file(path: Path, label: str) -> Path:
    resolved = path.resolve()
    if not resolved.is_file():
        raise RuntimeError(f"{label} is missing: {resolved}")
    return resolved


def pixels(image) -> np.ndarray:
    width, height = image.size
    flat = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(flat)
    return flat.reshape((height, width, 4))


def periodicize(array: np.ndarray, margin: int) -> np.ndarray:
    result = array.copy()
    height, width = result.shape[:2]
    if margin * 2 >= min(width, height):
        raise RuntimeError("seam margin is too large for image")
    for index in range(margin):
        weight = 0.5 * (1.0 - index / margin)
        left = result[:, index, :3].copy()
        right = result[:, width - 1 - index, :3].copy()
        average = (left + right) * 0.5
        result[:, index, :3] = left * (1.0 - weight) + average * weight
        result[:, width - 1 - index, :3] = right * (1.0 - weight) + average * weight
    for index in range(margin):
        weight = 0.5 * (1.0 - index / margin)
        bottom = result[index, :, :3].copy()
        top = result[height - 1 - index, :, :3].copy()
        average = (bottom + top) * 0.5
        result[index, :, :3] = bottom * (1.0 - weight) + average * weight
        result[height - 1 - index, :, :3] = top * (1.0 - weight) + average * weight
    result[:, -1, :3] = result[:, 0, :3]
    result[-1, :, :3] = result[0, :, :3]
    result[..., 3] = 1.0
    return result


def seam_metrics(array: np.ndarray) -> dict[str, float]:
    rgb = array[..., :3]
    horizontal = float(np.mean(np.abs(rgb[:, 0] - rgb[:, -1])))
    vertical = float(np.mean(np.abs(rgb[0] - rgb[-1])))
    horizontal_baseline = float(np.mean(np.abs(rgb[:, 1:] - rgb[:, :-1])))
    vertical_baseline = float(np.mean(np.abs(rgb[1:] - rgb[:-1])))
    return {
        "horizontalMeanAbsoluteError": horizontal,
        "verticalMeanAbsoluteError": vertical,
        "horizontalInteriorBaseline": horizontal_baseline,
        "verticalInteriorBaseline": vertical_baseline,
        "horizontalRatio": horizontal / max(horizontal_baseline, 1e-6),
        "verticalRatio": vertical / max(vertical_baseline, 1e-6),
    }


def blur_periodic(array: np.ndarray, passes: int) -> np.ndarray:
    result = array.astype(np.float32, copy=True)
    for _ in range(passes):
        result = (
            result * 4.0
            + np.roll(result, 1, axis=0)
            + np.roll(result, -1, axis=0)
            + np.roll(result, 1, axis=1)
            + np.roll(result, -1, axis=1)
        ) / 8.0
    return result


def smoothstep(edge0: float, edge1: float, value: np.ndarray) -> np.ndarray:
    t = np.clip((value - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def rgba(rgb: np.ndarray) -> np.ndarray:
    alpha = np.ones((*rgb.shape[:2], 1), dtype=np.float32)
    return np.concatenate((np.clip(rgb, 0.0, 1.0).astype(np.float32), alpha), axis=2)


def grayscale(value: np.ndarray) -> np.ndarray:
    return rgba(np.repeat(np.clip(value, 0.0, 1.0)[..., None], 3, axis=2))


def save_image(array: np.ndarray, path: Path, colorspace: str) -> None:
    height, width = array.shape[:2]
    image = bpy.data.images.new(path.stem, width=width, height=height, alpha=True, float_buffer=False)
    image.colorspace_settings.name = colorspace
    image.pixels.foreach_set(np.ascontiguousarray(array, dtype=np.float32).reshape(-1))
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)
    if not path.is_file() or path.stat().st_size == 0:
        raise RuntimeError(f"failed to save image: {path}")


def provenance(path: Path, role: str, sources: list[dict], details: dict) -> dict:
    return {
        "schemaVersion": 1,
        "asset": str(path),
        "status": "blender-derived-candidate",
        "generatedAt": "2026-07-29",
        "generator": {
            "tool": "Blender headless Python",
            "blenderVersion": bpy.app.version_string,
            "script": str(Path(__file__).resolve()),
            "algorithm": "periodic seam blend plus deterministic NumPy PBR derivation",
        },
        "role": role,
        "sourceInputs": sources,
        "output": {
            "format": "png",
            "width": TARGET_SIZE,
            "height": TARGET_SIZE,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        },
        "details": details,
        "runtimeEligible": False,
    }


def main() -> None:
    args = parse_args()
    source = require_file(args.source, "generated base-color source")
    reference = require_file(args.reference, "terrain reference")
    source_provenance = require_file(args.source_provenance, "source provenance")
    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    loaded = bpy.data.images.load(str(source), check_existing=False)
    input_dimensions = list(loaded.size)
    loaded.colorspace_settings.name = "sRGB"
    loaded.scale(TARGET_SIZE, TARGET_SIZE)
    raw = pixels(loaded)
    before = seam_metrics(raw)
    needs_periodic_blend = max(before["horizontalRatio"], before["verticalRatio"]) > SEAM_RATIO_THRESHOLD
    base = periodicize(raw, SEAM_MARGIN) if needs_periodic_blend else raw.copy()
    after = seam_metrics(base)
    bpy.data.images.remove(loaded)

    rgb = base[..., :3]
    luminance = rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722
    low = float(np.percentile(luminance, 3.0))
    high = float(np.percentile(luminance, 97.0))
    normalized = np.clip((luminance - low) / max(1e-6, high - low), 0.0, 1.0)
    red_signal = rgb[..., 0] - np.maximum(rgb[..., 1] * 1.35, rgb[..., 2] * 1.65)
    ember = smoothstep(0.015, 0.18, red_signal) * smoothstep(0.025, 0.22, rgb[..., 0])
    ember = blur_periodic(ember, 2)

    broad = blur_periodic(normalized, 4)
    height = np.clip(0.20 + broad * 0.80 - ember * 0.72, 0.0, 1.0)
    normal_height = blur_periodic(height, 2)
    dx = (np.roll(normal_height, -1, axis=1) - np.roll(normal_height, 1, axis=1)) * 5.5
    dy = (np.roll(normal_height, -1, axis=0) - np.roll(normal_height, 1, axis=0)) * 5.5
    normal_vector = np.stack((-dx, -dy, np.ones_like(dx)), axis=2)
    normal_vector /= np.maximum(np.linalg.norm(normal_vector, axis=2, keepdims=True), 1e-6)
    normal = rgba(normal_vector * 0.5 + 0.5)

    roughness = np.clip(0.78 + (1.0 - broad) * 0.16 - ember * 0.52, 0.24, 0.96)
    metallic = np.clip(0.035 + normalized * 0.02 - ember * 0.045, 0.0, 0.08)
    ambient_occlusion = np.clip(0.48 + height * 0.52, 0.42, 1.0)
    emission_rgb = np.stack((ember, ember * 0.16, ember * 0.018), axis=2)
    orm = rgba(np.stack((ambient_occlusion, roughness, metallic), axis=2))

    maps = {
        "basecolor": (base, "sRGB", "seam-gated 1024 power-of-two base color"),
        "normal": (normal, "Non-Color", "OpenGL tangent-space normal from periodic height gradients"),
        "roughness": (grayscale(roughness), "Non-Color", "high stone roughness with smoother molten fissures"),
        "metallic": (grayscale(metallic), "Non-Color", "near-dielectric basalt metallic response"),
        "ao": (grayscale(ambient_occlusion), "Non-Color", "crevice ambient-occlusion mask"),
        "orm": (orm, "Non-Color", "glTF packed occlusion-red roughness-green metallic-blue"),
        "emission": (rgba(emission_rgb), "sRGB", "molten fissure emission mask and color"),
        "height": (grayscale(height), "Non-Color", "periodic scalar height with recessed molten fissures"),
    }
    source_rows = [
        {"path": str(source), "sha256": sha256(source), "role": "god-tibo-imagen base-color source"},
        {"path": str(reference), "sha256": sha256(reference), "role": "terrain appearance reference"},
        {"path": str(source_provenance), "sha256": sha256(source_provenance), "role": "generation provenance"},
    ]
    outputs = {}
    for role, (array, colorspace, description) in maps.items():
        path = out_dir / f"terrain-cinder-span-{role}.png"
        save_image(array, path, colorspace)
        details = {
            "description": description,
            "inputDimensions": input_dimensions,
            "targetDimensions": [TARGET_SIZE, TARGET_SIZE],
            "seamMarginPixels": SEAM_MARGIN if needs_periodic_blend else 0,
            "seamRatioThreshold": SEAM_RATIO_THRESHOLD,
            "periodicBlendApplied": needs_periodic_blend,
            "seamMetricsBefore": before,
            "seamMetricsAfter": after,
        }
        record = provenance(path, role, source_rows, details)
        provenance_path = path.with_suffix(".provenance.json")
        provenance_path.write_text(json.dumps(record, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        outputs[role] = {
            "path": str(path),
            "provenance": str(provenance_path),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }

    report = {
        "schemaVersion": 1,
        "blenderVersion": bpy.app.version_string,
        "source": str(source),
        "inputDimensions": input_dimensions,
        "outputDimensions": [TARGET_SIZE, TARGET_SIZE],
        "periodicBlendApplied": needs_periodic_blend,
        "seamMetricsBefore": before,
        "seamMetricsAfter": after,
        "outputs": outputs,
        "runtimeEligible": False,
    }
    report_path = out_dir / "terrain-cinder-span-textures.manifest.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"report": str(report_path), "maps": len(outputs), "periodicBlendApplied": needs_periodic_blend, "seamMetricsAfter": after}, sort_keys=True))


if __name__ == "__main__":
    main()
