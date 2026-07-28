#!/usr/bin/env python3
"""Freeze the shipped character scale contract before the meshes are regenerated.

WHY THIS EXISTS
---------------
`rodin-tpose-regen.py` sized each T-pose blockout by measuring THAT character's
already-deployed GLB, so the ControlNet condition matched the character's own
silhouette instead of a generic 1.8 m human. A full asset regeneration deletes
those GLBs, which would silently drop every character back to the generic
default and change all relative scale in the game.

The meshes are still readable from the pre-regeneration git tag. Read the height
out of each one there -- without restoring any file into the tree -- and freeze
it as the scale contract the regenerated meshes must reproduce.

Shoulder width is deliberately NOT frozen: it is re-measured from the new
concept plate, because the new art is the authority on silhouette.

  python3 scripts/freeze-character-scale.py --tag pre-fullasset-regen-20260728
"""
import argparse
import json
import struct
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parent.parent
CATEGORIES = ("companions", "enemies", "bosses", "commander")
COMPONENT = {5120: "<i1", 5121: "<u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def git(*args):
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True)


def list_tagged_glbs(tag):
    out = git("ls-tree", "-r", "--name-only", tag, "assets/images/battle/glb/")
    if out.returncode != 0:
        raise SystemExit(f"cannot read tag {tag}: {out.stderr.decode()[:200]}")
    paths = [p for p in out.stdout.decode().splitlines() if p.endswith(".glb")]
    return [p for p in paths if p.split("/")[4] in CATEGORIES]


def measure_blob(blob):
    """Height of the character body from raw GLB bytes.

    Only `*_body` nodes count: a cape or weld-on prop would inflate the bounding
    box and push the blockout taller than the character actually is.
    """
    total = struct.unpack_from("<I", blob, 8)[0]
    off, js, binc = 12, None, None
    while off < total:
        clen, ctype = struct.unpack_from("<II", blob, off)
        off += 8
        chunk = blob[off:off + clen]
        off += clen
        if ctype == 0x4E4F534A:
            js = json.loads(chunk.decode("utf-8"))
        elif ctype == 0x004E4942:
            binc = chunk
    if js is None or binc is None:
        return None

    def gather(predicate):
        pts = []
        for node in js.get("nodes", []):
            if "mesh" not in node or not predicate(str(node.get("name", ""))):
                continue
            for prim in js["meshes"][node["mesh"]]["primitives"]:
                acc = js["accessors"][prim["attributes"]["POSITION"]]
                bv = js["bufferViews"][acc["bufferView"]]
                dt = np.dtype(COMPONENT[acc["componentType"]])
                n = NCOMP[acc["type"]]
                base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
                arr = np.frombuffer(binc, dtype=dt, count=acc["count"] * n, offset=base)
                pts.append(arr.reshape(acc["count"], n).astype(float))
        return pts

    pts = gather(lambda name: name.endswith("_body"))
    scope = "body"
    if not pts:
        # Older assets predate the _body naming convention; fall back to the
        # whole mesh set and record that the number is less precise.
        pts = gather(lambda name: True)
        scope = "all-meshes"
    if not pts:
        return None
    P = np.vstack(pts)
    return {"height": round(float(P[:, 1].max() - P[:, 1].min()), 4), "scope": scope}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--tag", required=True)
    p.add_argument("--out", default="_workspace/current/engineering/asset-pipeline/character-scale.json")
    args = p.parse_args()

    out = Path(args.out)
    if not out.is_absolute():
        out = REPO / out

    entries = {}
    for path in list_tagged_glbs(args.tag):
        blob = git("cat-file", "blob", f"{args.tag}:{path}")
        if blob.returncode != 0:
            print(f"  {path}: unreadable", file=sys.stderr)
            continue
        m = measure_blob(blob.stdout)
        if not m:
            print(f"  {path}: no geometry", file=sys.stderr)
            continue
        parts = path.split("/")
        entries[Path(path).stem] = {"category": parts[4], "height": m["height"], "scope": m["scope"]}
        print(f"  {Path(path).stem:24} {parts[4]:11} h={m['height']:.4f} ({m['scope']})")

    heights = [e["height"] for e in entries.values()]
    doc = {
        "schemaVersion": 1,
        "frozenFrom": args.tag,
        "frozenAt": datetime.now(timezone.utc).isoformat(),
        "purpose": "Scale contract the regenerated character meshes must reproduce.",
        "shoulderPolicy": "re-measured from the new concept character plate, not frozen",
        "medianHeight": round(float(np.median(heights)), 4) if heights else None,
        "characters": dict(sorted(entries.items())),
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, indent=2))
    print(f"\nfroze {len(entries)} character heights -> {out.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
