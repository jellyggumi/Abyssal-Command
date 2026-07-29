#!/usr/bin/env python3
"""Turn god-tibo-imagen concept plates into runtime UI assets.

`gti` returns opaque RGB PNGs (observed 1254x1254 for square prompts, 1672x941 for
wide ones) on a flat near-black field. The runtime needs small alpha-cut icons that
sit on top of the dock rail / HUD panels, so every plate goes through the same
deterministic reduction:

    matte the border-connected dark field to alpha -> crop to the remaining ink
    -> pad to square -> Lanczos downscale -> unsharp -> WebP (lossless for icons)

The matte is deliberately NOT a global luminance key. These plates are
dark-gothic: measured on `concept-ui-stat-commander.png`, 53% of the pixels
inside the emblem fall below luminance 22 and 68% below 40, so a global floor
would erase most of the portrait interior. Only the dark component reachable
from the canvas border is background; an enclosed dark pocket stays opaque.

Wide plates keep their aspect ratio and stay opaque -- they are backplates, not
glyphs, so alpha-keying them would punch holes in the art.

The concept lane (`assets/images/battle/pilot/concept-ui-*.png`) is the immutable
input; this script only writes into the runtime lane. Nothing here mutates a
concept plate, so a re-run is idempotent given the same inputs.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
CONCEPT_LANE = ROOT / "assets/images/battle/pilot"
RUNTIME_LANE = ROOT / "assets/images/battle/ui"

# Luminance at/below this counts as "field-dark" and becomes a flood-fill
# candidate. Gothic art is full of near-black pixels INSIDE the glyph, so a
# global luminance key would punch holes through the interiors -- only the
# dark region reachable from the canvas border is actually background.
FIELD_DARK = 26
# Once the background component is known, its boundary is feathered over this
# luminance span so the soft teal bloom ramps out instead of hard-clipping
# into a jagged edge.
EDGE_FEATHER_FLOOR = 26
EDGE_FEATHER_CEIL = 64


@dataclass(frozen=True)
class Spec:
    """One runtime asset derived from one concept plate."""

    asset_id: str
    size: int
    wide: bool = False

    @property
    def concept(self) -> Path:
        return CONCEPT_LANE / f"concept-ui-{self.asset_id}.png"

    @property
    def runtime(self) -> Path:
        return RUNTIME_LANE / ("plates" if self.wide else "hud") / f"{self.asset_id}.webp"


# Sizes are 2x the largest CSS box the asset renders into, so the icon stays
# crisp on a 2x display without shipping a third variant:
#   .dock-rail-tab   48px box -> 96
#   .rail-currency   ~20px glyph -> 64
#   .dock-brand      1.9rem ~30px -> 64
#   .sortie-fab b    ~20px -> 64
#   .dock-panel-close 44px box -> 96
#   HUD stat glyphs  ~18px -> 64
SPECS: tuple[Spec, ...] = (
    Spec("nav-growth", 96),
    Spec("nav-companions", 96),
    Spec("nav-inventory", 96),
    Spec("nav-sortie", 96),
    Spec("nav-stronghold", 96),
    Spec("currency-echo-core", 64),
    Spec("currency-bound-fragment", 64),
    Spec("stat-gate-integrity", 64),
    Spec("stat-commander", 64),
    Spec("stat-echo-xp", 64),
    Spec("brand-mark", 64),
    Spec("control-sortie", 64),
    Spec("control-close", 96),
    Spec("control-pause", 96),
    Spec("lobby-command-plate", 1280, wide=True),
    Spec("seal-atlas-plate", 1280, wide=True),
)


def keyed_rgba(image: Image.Image) -> Image.Image:
    """Cut only the border-connected dark field to alpha.

    A global luminance key is wrong for this art: the plates are dark-gothic and
    carry large near-black regions *inside* the glyph (recessed stone, shadowed
    arches, the pupil of a helm slit). Keying globally punches holes through
    those interiors. Instead label the field-dark pixels into connected
    components and treat only the components touching the canvas border as
    background -- an enclosed dark pocket keeps full opacity no matter how dark.
    """
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    # Rec. 601 luma -- matches how the eye weights the teal/gold ink over the field.
    luma = rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114

    dark = luma <= FIELD_DARK
    # 4-connectivity: an 8-connected diagonal can leak through a one-pixel
    # engraved seam and swallow an interior pocket along with the field.
    labels, count = ndimage.label(dark, structure=ndimage.generate_binary_structure(2, 1))
    background = np.zeros(dark.shape, dtype=bool)
    if count:
        edge_labels = np.unique(
            np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]])
        )
        edge_labels = edge_labels[edge_labels != 0]
        if edge_labels.size:
            background = np.isin(labels, edge_labels)

    # Feather only where the kept ink is itself dim, so the bloom ramps out
    # smoothly; everything not in the background component starts fully opaque.
    feather = np.clip(
        (luma - EDGE_FEATHER_FLOOR) / (EDGE_FEATHER_CEIL - EDGE_FEATHER_FLOOR), 0.0, 1.0
    )
    alpha = np.where(background, 0.0, np.maximum(feather, 0.0))
    # Dark pixels enclosed by ink are structural, not field -- force them solid.
    enclosed_dark = dark & ~background
    alpha = np.where(enclosed_dark, 1.0, alpha)

    out = np.dstack([rgb, alpha * 255.0]).astype(np.uint8)
    return Image.fromarray(out, mode="RGBA")


def crop_to_ink(image: Image.Image, *, threshold: int = 8) -> Image.Image:
    """Trim the transparent margin so the glyph fills its box."""
    alpha = np.asarray(image.getchannel("A"))
    rows = np.where(alpha.max(axis=1) > threshold)[0]
    cols = np.where(alpha.max(axis=0) > threshold)[0]
    if rows.size == 0 or cols.size == 0:
        return image
    return image.crop((int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1))


def pad_square(image: Image.Image) -> Image.Image:
    """Centre the glyph in a transparent square so downscale never distorts it."""
    side = max(image.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(image, ((side - image.width) // 2, (side - image.height) // 2), image)
    return canvas


def build_icon(spec: Spec) -> dict[str, object]:
    source = Image.open(spec.concept)
    keyed = keyed_rgba(source)
    cropped = crop_to_ink(keyed)
    squared = pad_square(cropped)
    resized = squared.resize((spec.size, spec.size), Image.LANCZOS)
    # Lanczos on a 13x downscale softens the engraved bevels; a light unsharp
    # restores the edge without introducing ringing at this radius.
    sharpened = resized.filter(ImageFilter.UnsharpMask(radius=1.1, percent=118, threshold=3))
    spec.runtime.parent.mkdir(parents=True, exist_ok=True)
    sharpened.save(spec.runtime, "WEBP", lossless=True, method=6)
    coverage = float((np.asarray(sharpened.getchannel("A")) > 8).mean())
    return {
        "sourceSize": list(source.size),
        "croppedSize": list(cropped.size),
        "outputSize": list(sharpened.size),
        "alphaCoverage": round(coverage, 4),
    }


def build_plate(spec: Spec) -> dict[str, object]:
    source = Image.open(spec.concept).convert("RGB")
    scale = spec.size / source.width
    target = (spec.size, max(1, round(source.height * scale)))
    resized = source.resize(target, Image.LANCZOS)
    spec.runtime.parent.mkdir(parents=True, exist_ok=True)
    # Backplates render behind a gradient at ~0.32 opacity, so lossy q=82 is
    # invisible here and keeps the payload far below a lossless encode.
    resized.save(spec.runtime, "WEBP", quality=82, method=6)
    return {
        "sourceSize": list(source.size),
        "outputSize": list(resized.size),
        "alphaCoverage": None,
    }


def git_head() -> str | None:
    try:
        done = subprocess.run(
            ["git", "-C", str(ROOT), "rev-parse", "HEAD"],
            capture_output=True, text=True, check=True,
        )
        return done.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="emit the build report as JSON")
    parser.add_argument("--check", action="store_true",
                        help="verify every runtime asset exists and is newer than its concept plate")
    args = parser.parse_args()

    missing = [s.asset_id for s in SPECS if not s.concept.exists()]
    if missing:
        print(f"missing concept plates: {', '.join(missing)}", file=sys.stderr)
        return 2

    if args.check:
        stale = [
            s.asset_id for s in SPECS
            if not s.runtime.exists()
            or s.runtime.stat().st_mtime < s.concept.stat().st_mtime
        ]
        report = {"ok": not stale, "stale": stale, "assetCount": len(SPECS)}
        print(json.dumps(report, indent=2) if args.json else
              ("ok" if not stale else f"stale: {', '.join(stale)}"))
        return 0 if not stale else 1

    head = git_head()
    rows = []
    for spec in SPECS:
        stats = build_plate(spec) if spec.wide else build_icon(spec)
        rows.append({
            "assetId": spec.asset_id,
            "concept": str(spec.concept.relative_to(ROOT)),
            "runtime": str(spec.runtime.relative_to(ROOT)),
            "bytes": spec.runtime.stat().st_size,
            "wide": spec.wide,
            **stats,
        })

    report = {
        "generator": "scripts/build-ui-icon-assets.py",
        "revision": head,
        "matte": "border-connected-flood-fill",
        "fieldDark": FIELD_DARK,
        "edgeFeather": [EDGE_FEATHER_FLOOR, EDGE_FEATHER_CEIL],
        "assetCount": len(rows),
        "totalBytes": sum(int(r["bytes"]) for r in rows),
        "rows": rows,
    }
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        for row in rows:
            print(f"{row['assetId']:24} {str(row['outputSize']):>12} "
                  f"{int(row['bytes']):>7}B  alpha={row['alphaCoverage']}")
        print(f"\n{report['assetCount']} assets, {report['totalBytes']} bytes total")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
