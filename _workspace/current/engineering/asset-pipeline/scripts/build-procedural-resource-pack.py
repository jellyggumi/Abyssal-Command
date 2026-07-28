#!/usr/bin/env python3
"""Create a candidate-only procedural world-resource Blender pack.

Run through Blender, not Python:
  Blender --background --python build-procedural-resource-pack.py -- --out <path>

This starts from a blank scene, creates the three legacy-decoration collection
anchors required by the shared builder, then delegates construction to the
repository's reviewed low-poly resource builder. It never writes runtime paths.
"""
from __future__ import annotations

import argparse
import runpy
import sys
from pathlib import Path

import bpy

REPO = Path(__file__).resolve().parents[5]
SHARED_BUILDER = REPO / "scripts/build-world-content-pack.py"
REQUIRED_ANCHORS = ("cinder-span", "veil-citadel", "echo-throne-steps")


def parse_args() -> argparse.Namespace:
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True)
    return parser.parse_args(argv)


def ensure_anchor_collections() -> None:
    root = bpy.context.scene.collection
    for name in REQUIRED_ANCHORS:
        if bpy.data.collections.get(name) is not None:
            continue
        collection = bpy.data.collections.new(name)
        root.children.link(collection)


def main() -> None:
    args = parse_args()
    ensure_anchor_collections()
    sys.argv = [str(SHARED_BUILDER), "--", "--out", args.out]
    runpy.run_path(str(SHARED_BUILDER), run_name="__main__")


if __name__ == "__main__":
    main()
