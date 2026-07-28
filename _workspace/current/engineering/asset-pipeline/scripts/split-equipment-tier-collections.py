#!/usr/bin/env python3
"""Expose one exportable collection per equipment tier in a candidate Blender pack."""
from __future__ import annotations

import argparse
import sys

import bpy

SOURCE_COLLECTION = "equipment-tier-gems"


def parse_args() -> argparse.Namespace:
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True)
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    source = bpy.data.collections.get(SOURCE_COLLECTION)
    if source is None:
        raise RuntimeError(f"missing collection: {SOURCE_COLLECTION}")
    root = bpy.context.scene.collection
    objects = list(source.all_objects)
    for tier in range(1, 6):
        name = f"tier-t{tier}"
        target = bpy.data.collections.get(name)
        if target is None:
            target = bpy.data.collections.new(name)
            root.children.link(target)
        for object_ in objects:
            if f"gem-t{tier}-" in object_.name:
                target.objects.link(object_)
        if not any(object_.type == "EMPTY" for object_ in target.objects):
            root_empty = bpy.data.objects.new(f"{name}-root", None)
            target.objects.link(root_empty)
    bpy.ops.wm.save_as_mainfile(filepath=args.out)
    print("SPLIT_EQUIPMENT_TIERS count=5")


if __name__ == "__main__":
    main()
