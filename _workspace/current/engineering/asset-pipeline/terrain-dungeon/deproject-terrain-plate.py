#!/usr/bin/env python3
"""De-project an axonometric terrain plate render into a top-down tileable floor texture.

The concept plates in `assets/mesh/terrain/*/raw/*-terrain.raw.png` are 1536x1024
three-quarter-view renders of a rectangular floor slab standing on white. Runtime
needs a **top-down orthographic albedo** so the slab can be laid flat on the
gameplay plane (elevation 0) and tiled into a composed dungeon floor.

Method
------
1. Segment the slab silhouette from the white background.
2. Locate the top-face corners. Under an axonometric projection a rectangle maps
   to a parallelogram, so three silhouette extremes determine the fourth corner:
       N = topmost silhouette point      (far corner of the top face)
       W = leftmost silhouette point     (left corner of the top face)
       E = rightmost silhouette point    (right corner of the top face)
       S = W + E - N                     (near corner, by parallelogram closure)
3. Solve the homography that maps N,E,S,W onto the corners of an output rectangle
   and resample. A homography (not a bare affine) absorbs the mild perspective the
   generative renders carry.
4. Write the rectified albedo plus a provenance receipt.

Outputs stay in the concept lane. Promotion to `assets/**` requires an explicit
audit per CLAUDE.md section 3.

Usage
-----
    python3 deproject-terrain-plate.py \
        --plate assets/mesh/terrain/terrain-cinder-span/raw/terrain-cinder-span-terrain.raw.png \
        --out-dir _workspace/current/engineering/asset-pipeline/terrain-dungeon/deprojected \
        --slab-id cinder-span-floor --size 1024
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

WHITE_LEVEL = 0.90
WHITE_SATURATION = 0.06


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--plate", type=Path, required=True, help="source axonometric plate PNG")
    parser.add_argument("--out-dir", type=Path, required=True, help="directory for rectified output")
    parser.add_argument("--slab-id", required=True, help="stable id for the rectified slab texture")
    parser.add_argument("--size", type=int, default=1024, help="output edge length in pixels")
    parser.add_argument("--aspect", type=float, default=1.0, help="output width/height ratio")
    parser.add_argument("--inset", type=float, default=0.012, help="fractional inset to drop the bevel rim")
    parser.add_argument("--seamless", action="store_true", help="blend opposite edges so the tile repeats")
    parser.add_argument("--seam-margin", type=float, default=0.06, help="fractional width of the seam blend band")
    parser.add_argument(
        "--tile-size",
        type=int,
        default=512,
        help="final runtime tile edge; rectify happens at --size then downscales to this",
    )
    return parser.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_rgb(path: Path) -> np.ndarray:
    if not path.is_file():
        raise SystemExit(f"plate is missing: {path}")
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float32) / 255.0


def slab_mask(rgb: np.ndarray) -> np.ndarray:
    """True where the slab is, False on the white studio background."""
    high = rgb.min(axis=2) > WHITE_LEVEL
    flat = (rgb.max(axis=2) - rgb.min(axis=2)) < WHITE_SATURATION
    mask = ~(high & flat)
    # Drop isolated speckle: keep pixels with at least 4 of 8 neighbours set.
    padded = np.pad(mask.astype(np.uint8), 1)
    neighbours = sum(
        padded[1 + dy : padded.shape[0] - 1 + dy, 1 + dx : padded.shape[1] - 1 + dx]
        for dy in (-1, 0, 1)
        for dx in (-1, 0, 1)
        if (dy, dx) != (0, 0)
    )
    return mask & (neighbours >= 4)


def top_face_corners(mask: np.ndarray) -> dict[str, tuple[float, float]]:
    """Return the top-face parallelogram corners as (x, y) pixel coordinates.

    The slab is a box, so its silhouette also contains the two visible side faces.
    At the leftmost and rightmost columns the silhouette spans the whole vertical
    edge, from the top-face corner down to the base. Taking the middle of that run
    would pull the corner down by half the slab thickness and shear the rectified
    tile, so those extremes resolve to their topmost pixel instead.
    """
    ys, xs = np.nonzero(mask)
    if xs.size == 0:
        raise SystemExit("slab silhouette is empty; check the background threshold")

    def column_top(column: int) -> tuple[float, float]:
        rows = ys[xs == column]
        return float(column), float(rows.min())

    def row_middle(row: int) -> tuple[float, float]:
        columns = xs[ys == row]
        return float(np.median(columns)), float(row)

    north = row_middle(int(ys.min()))
    west = column_top(int(xs.min()))
    east = column_top(int(xs.max()))
    south = (west[0] + east[0] - north[0], west[1] + east[1] - north[1])
    return {"north": north, "east": east, "south": south, "west": west}


def inset_quad(corners: dict[str, tuple[float, float]], fraction: float) -> np.ndarray:
    quad = np.array([corners["north"], corners["east"], corners["south"], corners["west"]], dtype=np.float64)
    centre = quad.mean(axis=0)
    return centre + (quad - centre) * (1.0 - fraction)


def homography(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    """Solve H with dst ~ H @ src for four point pairs."""
    rows = []
    for (sx, sy), (dx, dy) in zip(src, dst):
        rows.append([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy, -dx])
        rows.append([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy, -dy])
    _, _, vt = np.linalg.svd(np.array(rows, dtype=np.float64))
    return (vt[-1] / vt[-1][-1]).reshape(3, 3)


def sample_bilinear(rgb: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    height, width = rgb.shape[:2]
    x = np.clip(x, 0, width - 1)
    y = np.clip(y, 0, height - 1)
    x0 = np.floor(x).astype(np.int32)
    y0 = np.floor(y).astype(np.int32)
    x1 = np.minimum(x0 + 1, width - 1)
    y1 = np.minimum(y0 + 1, height - 1)
    fx = (x - x0)[..., None]
    fy = (y - y0)[..., None]
    top = rgb[y0, x0] * (1 - fx) + rgb[y0, x1] * fx
    bottom = rgb[y1, x0] * (1 - fx) + rgb[y1, x1] * fx
    return top * (1 - fy) + bottom * fy


def rectify(rgb: np.ndarray, quad: np.ndarray, width: int, height: int) -> np.ndarray:
    # Output corner order matches quad order: north -> (0,0), east -> (w,0), south -> (w,h), west -> (0,h).
    dst = np.array([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype=np.float64)
    matrix = np.linalg.inv(homography(quad, dst))
    grid_x, grid_y = np.meshgrid(np.arange(width, dtype=np.float64), np.arange(height, dtype=np.float64))
    ones = np.ones_like(grid_x)
    stacked = np.stack([grid_x, grid_y, ones], axis=-1) @ matrix.T
    src_x = stacked[..., 0] / stacked[..., 2]
    src_y = stacked[..., 1] / stacked[..., 2]
    return sample_bilinear(rgb, src_x, src_y)


def make_seamless(tile: np.ndarray, margin: float) -> np.ndarray:
    """Pull opposite edges toward their shared mean so the tile repeats cleanly.

    Both edges converge on the same value at the seam and relax back to the
    original pixels as distance from the seam grows, so interior detail survives.
    Reads come from an immutable copy; writing into a view the next line still
    reads would blend already-blended pixels and leave the seam intact.
    """
    height, width = tile.shape[:2]
    source = tile.copy()
    out = tile.copy()

    band_x = max(2, min(width // 2, int(round(width * margin))))
    # weight 0.5 at the seam column, 0 at the inner edge of the band
    weight_x = (0.5 * (1.0 - np.arange(band_x, dtype=np.float32) / band_x))[None, :, None]
    left = source[:, :band_x]
    right = source[:, width - band_x :][:, ::-1]
    out[:, :band_x] = left + (right - left) * weight_x
    out[:, width - band_x :] = (right + (left - right) * weight_x)[:, ::-1]

    band_y = max(2, min(height // 2, int(round(height * margin))))
    weight_y = (0.5 * (1.0 - np.arange(band_y, dtype=np.float32) / band_y))[:, None, None]
    vertical = out.copy()
    top = vertical[:band_y]
    bottom = vertical[height - band_y :][::-1]
    out[:band_y] = top + (bottom - top) * weight_y
    out[height - band_y :] = (bottom + (top - bottom) * weight_y)[::-1]
    return out


def seam_error(tile: np.ndarray) -> dict[str, float]:
    return {
        "horizontalMeanAbs": float(np.mean(np.abs(tile[:, 0] - tile[:, -1]))),
        "verticalMeanAbs": float(np.mean(np.abs(tile[0] - tile[-1]))),
    }


def main() -> None:
    args = parse_args()
    rgb = load_rgb(args.plate)
    mask = slab_mask(rgb)
    corners = top_face_corners(mask)
    quad = inset_quad(corners, args.inset)

    height = args.size
    width = int(round(args.size * args.aspect))
    tile = rectify(rgb, quad, width, height)
    raw_seam = seam_error(tile)

    # Downscale to the runtime tile size BEFORE the seam blend. Any resampling kernel
    # wide enough to be worth using reads across the wrap edge, so resizing after the
    # blend reintroduces a discontinuity; a wrap-aware tile-resize-crop does not fix it
    # either (measured 0.4557 vs 0.4049 naive at 256). Blending last converges the
    # edges by construction, so the seam stays exactly 0 at any output size.
    if args.tile_size and args.tile_size != height:
        target_h = args.tile_size
        target_w = int(round(args.tile_size * args.aspect))
        resized = Image.fromarray((np.clip(tile, 0, 1) * 255).round().astype(np.uint8)).resize(
            (target_w, target_h), Image.LANCZOS
        )
        tile = np.asarray(resized, dtype=np.float32) / 255.0
        width, height = target_w, target_h
    resized_seam = seam_error(tile)

    if args.seamless:
        tile = make_seamless(tile, args.seam_margin)
    final_seam = seam_error(tile)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    albedo_path = args.out_dir / f"{args.slab_id}-albedo.png"
    Image.fromarray((np.clip(tile, 0, 1) * 255).round().astype(np.uint8)).save(albedo_path)

    luminance = tile @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    height_path = args.out_dir / f"{args.slab_id}-height.png"
    Image.fromarray((np.clip(luminance, 0, 1) * 255).round().astype(np.uint8), mode="L").save(height_path)

    receipt = {
        "schemaVersion": 1,
        "slabId": args.slab_id,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "tool": "deproject-terrain-plate.py",
        "assetLane": "concept",
        "runtimeEligible": False,
        "source": {"path": str(args.plate), "sha256": sha256(args.plate), "size": [int(rgb.shape[1]), int(rgb.shape[0])]},
        "silhouette": {
            "maskCoverage": float(mask.mean()),
            "topFaceCorners": {key: [round(value[0], 2), round(value[1], 2)] for key, value in corners.items()},
            "insetFraction": args.inset,
        },
        "output": {
            "albedo": str(albedo_path),
            "height": str(height_path),
            "size": [width, height],
            "rectifiedSize": [int(round(args.size * args.aspect)), args.size],
            "tileSize": args.tile_size,
            "format": "PNG",
            "seamless": bool(args.seamless),
            "seamMargin": args.seam_margin if args.seamless else None,
            "seamErrorAfterRectify": raw_seam,
            "seamErrorAfterResize": resized_seam,
            "seamErrorAfterBlend": final_seam,
        },
    }
    receipt_path = args.out_dir / f"{args.slab_id}.provenance.json"
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")

    print(f"corners N/E/S/W: {[receipt['silhouette']['topFaceCorners'][k] for k in ('north', 'east', 'south', 'west')]}")
    print(f"mask coverage: {mask.mean():.1%}")
    print(f"seam rectify: h={raw_seam['horizontalMeanAbs']:.4f} v={raw_seam['verticalMeanAbs']:.4f}")
    print(f"seam resize:  h={resized_seam['horizontalMeanAbs']:.4f} v={resized_seam['verticalMeanAbs']:.4f}")
    print(f"seam final:   h={final_seam['horizontalMeanAbs']:.4f} v={final_seam['verticalMeanAbs']:.4f}")
    print(f"wrote {albedo_path}")
    print(f"wrote {height_path}")
    print(f"wrote {receipt_path}")


if __name__ == "__main__":
    main()
