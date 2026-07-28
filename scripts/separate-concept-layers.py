#!/usr/bin/env python3
"""Separate a concept illustration into discrete in-game resource layers.

WHY THIS EXISTS
---------------
docs/concept-to-web-game-3d-pipeline.md Phase 1 goes concept -> T-pose refstyle
-> UV atlas -> blockout. It never separates the concept itself. But Rodin's
prompt contract (Phase 2-A) forbids weapons, held props, terrain, pedestal and
background geometry inside the character source mesh -- which means every one of
those elements has to exist as its OWN concept plate before mesh generation, or
it simply never gets a mesh.

This script produces that missing lane: one concept illustration in, N separated
in-game layer plates out, each with alpha and provenance.

TWO SEPARATION MODES, CHOSEN BY EVIDENCE
----------------------------------------
1. `key`  -- deterministic. The concept was rendered on a uniform keyable
             background (white for T-pose plates, magenta for prop plates).
             Flood-fill from the border with a tolerance, write straight RGBA.
             No model call, byte-reproducible, free.

2. `gen`  -- generative. The concept is a full-bleed scene (terrain plates) with
             no keyable background, so the layers are not separable in pixel
             space. Re-render each layer in isolation with `gti` using the
             concept as an image reference, then key the result.

Mode is auto-detected from border uniformity unless forced with --mode.

LAYER TAXONOMY
--------------
character         body + worn clothing only (Rodin source-mesh input)
weapon            held weapon, detached from the hand
accessory         worn/carried props: lantern, pouch, chain, banner
terrain           playable ground surface
background-terrain  distant landform, silhouette only
terrain-feature   pillars, walls, bridges, stairs -- placeable geometry
background-object debris, foliage, banners, set dressing

USAGE
-----
  # detect mode + list the plan, write nothing
  python3 scripts/separate-concept-layers.py --concept <png> --asset-id <id> \
      --out-dir <lane> --dry-run

  # deterministic key pass only (no model calls)
  python3 scripts/separate-concept-layers.py --concept <png> --asset-id <id> \
      --out-dir <lane> --layers character

  # full separation including generated layers
  python3 scripts/separate-concept-layers.py --concept <png> --asset-id <id> \
      --out-dir <lane> --layers character,weapon,accessory --allow-generate

Generated output is CONCEPT LANE ONLY. This script never writes under
assets/images/battle/glb.
"""
import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
RUNTIME_GLB = REPO / "assets/images/battle/glb"

# Isolation prompt per layer. Every prompt states what to KEEP and then names
# every sibling layer as an exclusion, so a layer can never smuggle in geometry
# that belongs to another plate.
LAYER_PROMPTS = {
    "full-plate": (
        "(deterministic alpha cut of the source concept -- no model call)"
    ),
    "character": (
        "Isolate ONLY the character body and the clothing worn on that body, in the same "
        "T-pose and the same art style as the reference. Full body centered, arms extended "
        "horizontally, feet separated, clean readable silhouette. "
        "Exclude every held weapon, sword, blade, staff, shield, gun, and held prop. "
        "Exclude detachable accessories, lantern, banner, pouch, satchel, and loose chain. "
        "Exclude terrain, ground, floor, pedestal, platform, rocks, scenery, and background objects. "
        "Pure flat white background, no shadow cast on the background, no text, no logo, no watermark."
    ),
    "weapon": (
        "Isolate ONLY the weapon carried by the character in the reference image, rendered as a "
        "standalone game prop in the same art style. Present the weapon alone in a clean "
        "three-quarter orthographic view, full length visible, correct proportions. "
        "Exclude the character, any hand, arm, glove, or body part gripping it. "
        "Exclude terrain, ground, pedestal, scenery, background objects, and all other equipment. "
        "Pure flat white background, no text, no logo, no watermark."
    ),
    "accessory": (
        "Isolate ONLY the detachable worn accessories from the reference image -- lantern, "
        "pouch, satchel, belt hardware, chain, pendant, banner -- laid out as separate standalone "
        "game props in the same art style, evenly spaced on one sheet. "
        "Exclude the character body, clothing worn flat against the body, and any held weapon. "
        "Exclude terrain, ground, pedestal, scenery, and background objects. "
        "Pure flat white background, no text, no logo, no watermark."
    ),
    "terrain": (
        "Isolate ONLY the playable ground surface from the reference scene, rendered as a "
        "standalone terrain tile in the same art style: the walkable floor plane, its material, "
        "and its edge treatment, viewed from a raised three-quarter angle. "
        "Exclude every character, creature, weapon, and prop. "
        "Exclude distant background landforms, sky, pillars, walls, bridges, statues, debris, "
        "foliage, and set dressing. "
        "Pure flat white background, no text, no logo, no watermark."
    ),
    "background-terrain": (
        "Isolate ONLY the distant background landform from the reference scene -- the far "
        "silhouette of cliffs, ruins, mountains, or skyline -- rendered as a standalone "
        "backdrop layer in the same art style, flattened for parallax use. "
        "Exclude the playable foreground ground plane. "
        "Exclude every character, creature, weapon, prop, and near-field object. "
        "Pure flat white background, no text, no logo, no watermark."
    ),
    "terrain-feature": (
        "Isolate ONLY the placeable structural features from the reference scene -- pillars, "
        "broken walls, bridge spans, stairs, arches, gates -- laid out as separate standalone "
        "game props in the same art style, evenly spaced on one sheet. "
        "Exclude the ground plane itself and the distant background landform. "
        "Exclude every character, creature, and weapon. "
        "Pure flat white background, no text, no logo, no watermark."
    ),
    "background-object": (
        "Isolate ONLY the loose set-dressing objects from the reference scene -- debris, rubble, "
        "crates, foliage, hanging banners, lanterns, bones -- laid out as separate standalone "
        "game props in the same art style, evenly spaced on one sheet. "
        "Exclude the ground plane, structural architecture, and the distant background landform. "
        "Exclude every character, creature, and weapon. "
        "Pure flat white background, no text, no logo, no watermark."
    ),
    "prop": (
        "Isolate ONLY the prop object itself from the reference image, rendered as a standalone "
        "game asset in the same art style, in a clean three-quarter orthographic view. "
        "Exclude the pedestal, base, plinth, platform, podium, display stand, and the ground "
        "plane it rests on -- the object must float free with nothing underneath it. "
        "Exclude every character, hand, arm, creature, terrain, scenery, and background object. "
        "Pure flat white background, no cast shadow, no text, no logo, no watermark."
    ),
}

CHARACTER_LAYERS = ("full-plate", "character", "weapon", "accessory")
TERRAIN_LAYERS = ("terrain", "background-terrain", "terrain-feature", "background-object")
PROP_LAYERS = ("prop",)


def assert_concept_lane(path, label):
    """Reject any write into the deployed runtime GLB tree."""
    try:
        path.resolve().relative_to(RUNTIME_GLB.resolve())
    except ValueError:
        return
    raise ValueError(f"{label} must not be under the runtime lane {RUNTIME_GLB}: {path}")


def border_profile(rgb, band=6):
    """Sample the image border and report how uniform it is.

    A keyable plate has a near-constant border; a full-bleed scene does not.
    """
    edges = np.concatenate([
        rgb[:band, :, :].reshape(-1, 3),
        rgb[-band:, :, :].reshape(-1, 3),
        rgb[:, :band, :].reshape(-1, 3),
        rgb[:, -band:, :].reshape(-1, 3),
    ])
    median = np.median(edges, axis=0)
    spread = float(np.mean(np.abs(edges.astype(np.int16) - median).max(axis=1)))
    return median.astype(np.int16), spread


def detect_mode(rgb, threshold=18.0):
    median, spread = border_profile(rgb)
    return ("key" if spread <= threshold else "gen"), median, spread


def is_chroma_key(key_rgb):
    """True when the background colour cannot plausibly occur in the artwork.

    A saturated magenta/green screen is a deliberate key: no part of a blackened
    steel character is ever 251,2,251. A neutral white/grey/black border is NOT
    a key colour in that sense -- white highlights and black shadows are real
    paint -- so those must stay connectivity-bound.
    """
    mx, mn = int(max(key_rgb)), int(min(key_rgb))
    return mx >= 180 and (mx - mn) >= 100


def flood_key(rgb, key_rgb, tolerance=26):
    """Border-connected flood fill -> alpha mask.

    Connectivity matters for neutral keys: keying by colour alone would punch
    holes through any interior region that happens to match the background (a
    white highlight, a black shadow). Only background reachable from the border
    is removed.

    For a saturated chroma key the opposite is true. A tattered cape lets the
    screen show through holes that never touch the border, and connectivity
    alone leaves those as magenta confetti inside the silhouette. So for chroma
    keys the colour match is applied globally and unioned with the flood.
    """
    h, w = rgb.shape[:2]
    close = (np.abs(rgb.astype(np.int16) - key_rgb).max(axis=2) <= tolerance)

    visited = np.zeros((h, w), dtype=bool)
    stack = []
    for x in range(w):
        for y in (0, h - 1):
            if close[y, x]:
                stack.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if close[y, x]:
                stack.append((y, x))

    # Scanline flood fill: each pop expands a full horizontal run, then seeds the
    # rows above and below. Orders of magnitude fewer iterations than per-pixel.
    while stack:
        y, x = stack.pop()
        if visited[y, x] or not close[y, x]:
            continue
        xl = x
        while xl > 0 and close[y, xl - 1] and not visited[y, xl - 1]:
            xl -= 1
        xr = x
        while xr < w - 1 and close[y, xr + 1] and not visited[y, xr + 1]:
            xr += 1
        visited[y, xl:xr + 1] = True
        for ny in (y - 1, y + 1):
            if 0 <= ny < h:
                row = close[ny, xl:xr + 1] & ~visited[ny, xl:xr + 1]
                idx = np.flatnonzero(row)
                stack.extend((ny, xl + int(i)) for i in idx)

    background = visited
    if is_chroma_key(key_rgb):
        # Widen the match for the global pass: screen bleed through a thin cape
        # hole is dimmer and less saturated than the clean border sample.
        wide = (np.abs(rgb.astype(np.int16) - key_rgb).max(axis=2) <= tolerance * 2)
        background = background | wide
    alpha = np.where(background, 0, 255).astype(np.uint8)
    return alpha


def despill(rgb, alpha, key_rgb, strength=0.85):
    """Pull keyed-background colour out of the edge pixels.

    A magenta key leaves a magenta rim on every silhouette edge; left alone it
    shows up as a coloured halo the moment the plate is composited in-game.
    """
    out = rgb.astype(np.float32)
    edge = (alpha > 0) & (alpha < 255)
    if not edge.any():
        return out.astype(np.uint8)
    key = key_rgb.astype(np.float32)
    delta = out[edge] - key
    out[edge] = key + delta * (1.0 + strength)
    return np.clip(out, 0, 255).astype(np.uint8)


def tight_crop(rgba, pad=8):
    alpha = rgba[:, :, 3]
    ys, xs = np.nonzero(alpha)
    if len(ys) == 0:
        return rgba
    y0, y1 = max(0, ys.min() - pad), min(rgba.shape[0], ys.max() + 1 + pad)
    x0, x1 = max(0, xs.min() - pad), min(rgba.shape[1], xs.max() + 1 + pad)
    return rgba[y0:y1, x0:x1]


def key_to_rgba(src_png, out_png, tolerance=26, crop=True):
    im = Image.open(src_png).convert("RGB")
    rgb = np.asarray(im)
    _, key_rgb, spread = detect_mode(rgb)
    alpha = flood_key(rgb, key_rgb, tolerance=tolerance)
    rgb = despill(rgb, alpha, key_rgb)
    rgba = np.dstack([rgb, alpha])
    if crop:
        rgba = tight_crop(rgba)
    out_png.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode="RGBA").save(out_png)
    coverage = float((alpha > 0).mean())
    return {
        "keyRgb": [int(v) for v in key_rgb],
        "borderSpread": round(spread, 3),
        "tolerance": tolerance,
        "alphaCoverage": round(coverage, 5),
        "size": [rgba.shape[1], rgba.shape[0]],
    }


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def run_gti(prompt, reference, out_png, size, dry_run):
    cmd = ["gti", "--prompt", prompt, "--image", str(reference),
           "--output", str(out_png), "--size", size]
    if dry_run:
        cmd.append("--dry-run")
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return {
        "command": cmd,
        "returncode": proc.returncode,
        "stdout": proc.stdout[-2000:],
        "stderr": proc.stderr[-2000:],
    }


def parse_args(argv=None):
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--concept", required=True, help="source concept PNG")
    p.add_argument("--asset-id", required=True)
    p.add_argument("--out-dir", required=True, help="concept-lane output root")
    p.add_argument("--layers", default=None,
                   help="comma-separated layer ids; default is inferred from --kind")
    p.add_argument("--kind", choices=("character", "terrain"), default=None,
                   help="layer set to infer when --layers is omitted")
    p.add_argument("--mode", choices=("auto", "key", "gen"), default="auto")
    p.add_argument("--tolerance", type=int, default=26)
    p.add_argument("--size", default="1024x1536")
    p.add_argument("--allow-generate", action="store_true",
                   help="permit gti model calls; without it only the key pass runs")
    p.add_argument("--dry-run", action="store_true")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    concept = Path(args.concept)
    if not concept.is_absolute():
        concept = REPO / concept
    if not concept.exists():
        print(f"concept not found: {concept}", file=sys.stderr)
        return 2

    out_root = Path(args.out_dir)
    if not out_root.is_absolute():
        out_root = REPO / out_root
    assert_concept_lane(out_root, "layer output directory")
    asset_dir = out_root / args.asset_id

    rgb = np.asarray(Image.open(concept).convert("RGB"))
    detected, key_rgb, spread = detect_mode(rgb)
    mode = detected if args.mode == "auto" else args.mode

    if args.layers:
        layers = [s.strip() for s in args.layers.split(",") if s.strip()]
    else:
        kind = args.kind or ("terrain" if mode == "gen" else "character")
        layers = list(TERRAIN_LAYERS if kind == "terrain" else CHARACTER_LAYERS)
    unknown = [l for l in layers if l not in LAYER_PROMPTS]
    if unknown:
        print(f"unknown layers: {unknown}", file=sys.stderr)
        return 2

    report = {
        "schemaVersion": 1,
        "assetId": args.asset_id,
        "concept": str(concept.relative_to(REPO)) if concept.is_relative_to(REPO) else str(concept),
        "conceptSha256": sha256(concept),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "assetLane": "concept",
        "runtimeEligible": False,
        "separation": {
            "detectedMode": detected,
            "mode": mode,
            "borderMedianRgb": [int(v) for v in key_rgb],
            "borderSpread": round(spread, 3),
            "rationale": ("uniform keyable border -> pixel key is exact and free"
                          if detected == "key" else
                          "full-bleed scene -> layers are not separable in pixel space"),
        },
        "layers": [],
    }

    for layer in layers:
        entry = {"layer": layer, "prompt": LAYER_PROMPTS[layer]}
        out_png = asset_dir / f"{args.asset_id}-{layer}.png"
        assert_concept_lane(out_png, f"{layer} plate")
        entry["output"] = str(out_png.relative_to(REPO)) if out_png.is_relative_to(REPO) else str(out_png)

        # A keyable concept still holds its weapon, so keying alone cannot
        # produce the character layer -- the Rodin contract forbids weapons in
        # the source mesh. Keying yields the FULL PLATE; the character layer is
        # always generated with the weapon explicitly excluded.
        direct_key = (mode == "key" and layer == "full-plate")

        if args.dry_run:
            entry["status"] = "planned:key" if direct_key else "planned:generate"
            report["layers"].append(entry)
            continue

        if layer == "full-plate" and mode != "key":
            # A full-bleed concept has no key colour, so there is no plate to
            # cut. The semantic layers still get generated; this one is simply
            # not applicable rather than failed.
            entry["status"] = "skipped:not-applicable"
            entry["source"] = "n/a"
            report["layers"].append(entry)
            print(f"  {layer:20} {entry['status']}")
            continue

        if direct_key:
            entry["key"] = key_to_rgba(concept, out_png, tolerance=args.tolerance)
            entry["status"] = "keyed"
            entry["source"] = "deterministic-key"
            entry["sha256"] = sha256(out_png)
        elif not args.allow_generate:
            entry["status"] = "skipped:needs-generate"
            entry["source"] = "gti"
        else:
            raw = asset_dir / "raw" / f"{args.asset_id}-{layer}.raw.png"
            raw.parent.mkdir(parents=True, exist_ok=True)
            gen = run_gti(LAYER_PROMPTS[layer], concept, raw, args.size, dry_run=False)
            entry["generate"] = {k: gen[k] for k in ("returncode", "stderr")}
            if gen["returncode"] != 0 or not raw.exists():
                entry["status"] = "failed:generate"
            else:
                entry["rawOutput"] = str(raw.relative_to(REPO))
                entry["key"] = key_to_rgba(raw, out_png, tolerance=args.tolerance)
                entry["status"] = "generated+keyed"
                entry["source"] = "gti"
                entry["sha256"] = sha256(out_png)
        report["layers"].append(entry)
        print(f"  {layer:20} {entry['status']}")

    if not args.dry_run:
        asset_dir.mkdir(parents=True, exist_ok=True)
        (asset_dir / f"{args.asset_id}.layers.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({
        "assetId": args.asset_id,
        "mode": mode,
        "layers": {e["layer"]: e["status"] for e in report["layers"]},
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
