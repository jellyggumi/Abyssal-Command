#!/usr/bin/env python3
"""Measure separated character plates into a metrics file Blender can read.

WHY THIS IS A SEPARATE STEP
---------------------------
The blockout builder runs inside Blender, and Blender's bundled Python has no
Pillow. Installing it there would make the pipeline depend on a mutated Blender
install that no other machine reproduces. Measuring here with the system Python
and handing Blender a plain JSON keeps Blender's environment stock.

Height comes from the frozen scale contract; this script contributes the
silhouette ratios that only the new art can supply.

  python3 scripts/measure-character-plates.py
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
DEFAULT_PLATES = "_workspace/current/engineering/asset-pipeline/concept-layers"
DEFAULT_SCALE = "_workspace/current/engineering/asset-pipeline/character-scale.json"
DEFAULT_OUT = "_workspace/current/engineering/asset-pipeline/plate-metrics.json"


def measure(plate_path):
    alpha = np.asarray(Image.open(plate_path).convert("RGBA"))[:, :, 3]
    ys, xs = np.nonzero(alpha)
    if len(ys) < 32:
        return None
    top, bottom = int(ys.min()), int(ys.max())
    px_height = bottom - top
    if px_height <= 0:
        return None
    cx = float(np.median(xs))

    # In a T-pose the arms are horizontal at shoulder height, so any band taken
    # at the shoulders measures the full arm span, not the torso. Sample the
    # chest instead -- 28-45% down is below the armpits on a T-posed figure --
    # and take the median row width so a stray cape spike cannot dominate.
    rows = []
    for y in range(top + int(px_height * 0.28), top + int(px_height * 0.45)):
        row = np.nonzero(alpha[y])[0]
        if len(row) > 2:
            rows.append(float(max(row.max() - cx, cx - row.min())))
    if rows:
        torso_half_px = float(np.median(rows))
        band_source = "chest-band-median"
    else:
        torso_half_px = px_height * 0.16
        band_source = "fallback-ratio"

    # The widest point IS the arm reach, which is what a T-pose blockout's arm
    # span has to match.
    arm_half_px = float(max(xs.max() - cx, cx - xs.min()))
    span_px = float(xs.max() - xs.min())
    return {
        "pixelHeight": int(px_height),
        "torsoHalfRatio": round(torso_half_px / px_height, 5),
        "armSpanHalfRatio": round(arm_half_px / px_height, 5),
        "spanRatio": round(span_px / px_height, 4),
        "bandSource": band_source,
        "alphaCoverage": round(float((alpha > 0).mean()), 5),
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--plates", default=DEFAULT_PLATES)
    p.add_argument("--scale", default=DEFAULT_SCALE)
    p.add_argument("--out", default=DEFAULT_OUT)
    args = p.parse_args()

    plate_root = REPO / args.plates if not Path(args.plates).is_absolute() else Path(args.plates)
    scale_path = REPO / args.scale if not Path(args.scale).is_absolute() else Path(args.scale)
    out = REPO / args.out if not Path(args.out).is_absolute() else Path(args.out)

    scale_doc = json.loads(scale_path.read_text()) if scale_path.exists() else {}
    characters = scale_doc.get("characters", {})
    median = scale_doc.get("medianHeight")

    assets = {}
    for plate in sorted(plate_root.glob("*/*-character.png")):
        aid = plate.parent.name
        m = measure(plate)
        if not m:
            print(f"  {aid:26} empty plate")
            continue
        known = characters.get(aid)
        height = known["height"] if known else median
        if height is None:
            print(f"  {aid:26} no height available")
            continue
        m["height"] = round(float(height), 4)
        m["torsoHalf"] = round(m["torsoHalfRatio"] * height, 4)
        m["armSpanHalf"] = round(m["armSpanHalfRatio"] * height, 4)
        m["category"] = known["category"] if known else "characters"
        m["scaleSource"] = "frozen-contract" if known else "median-fallback"
        m["plate"] = str(plate.relative_to(REPO))
        assets[aid] = m
        flag = "" if m["spanRatio"] >= 0.8 else "  <- narrow span, verify T-pose"
        print(f"  {aid:26} h={height:.3f} torso={m['torsoHalf']:.3f} "
              f"armSpan={m['armSpanHalf']:.3f} span={m['spanRatio']:.2f} "
              f"[{m['scaleSource']}]{flag}")

    doc = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "plateRoot": str(plate_root.relative_to(REPO)),
        "scaleContract": str(scale_path.relative_to(REPO)),
        "assets": assets,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, indent=2))
    print(f"\nmeasured {len(assets)} plates -> {out.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
