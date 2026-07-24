#!/usr/bin/env python3
"""
Batch-exports named collections from a source .blend to individual GLB files,
one glTF-Binary file per collection, each file's local origin equal to the
collection's authored "stand point" (root EMPTY at/near world origin, per
this pack's convention -- verified against every collection this session).

Run headless, once per source file:

  blender --background <source>.blend --python scripts/export-battle-glb.py -- \
    --out-dir assets/models/battle --manifest collection1,path1.glb;collection2,path2.glb;...

Each manifest entry is "collectionName,relativeOutputPath.glb" (relative to
--out-dir), semicolon-separated. Only objects that are members of the named
collection are selected for export (use_selection=True) -- nothing else in
the source scene leaks into the output file.
"""
import argparse
import os
import sys
from pathlib import Path

import bpy


def unlink_broken_image_textures():
    """In-memory pre-pass (no save): the canonical resource pack's reused
    materials (Cold Steel, Obsidian, etc.) link Albedo/Normal Image Texture
    nodes to files that don't exist in the repo (see decision-log.md D15).
    A linked Image Texture node overrides the Principled BSDF's Base Color
    default_value even when the image fails to load; the glTF exporter then
    writes baseColorFactor=(1,1,1,1) white (verified empirically this
    session by round-tripping a real export). Every material in this file
    needs this fix before export, not just the ones the world-content-pack
    builder already touched (that fix lives in ensure_materials(), which
    only runs against the *new* file, never this canonical source).
    """
    fixed = 0
    for mat in bpy.data.materials:
        if not mat.node_tree:
            continue
        for node in list(mat.node_tree.nodes):
            if node.type != "TEX_IMAGE":
                continue
            broken = node.image is None
            if not broken and node.image.packed_file is None:
                abspath = bpy.path.abspath(node.image.filepath, library=node.image.library)
                broken = not os.path.exists(abspath)
            if not broken:
                continue
            for link in list(mat.node_tree.links):
                if link.from_node == node:
                    mat.node_tree.links.remove(link)
                    fixed += 1
    print(f"UNLINKED_BROKEN_TEXTURES count={fixed}")


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out-dir", required=True)
    p.add_argument("--manifest", required=True, help="collectionName,relPath.glb;... pairs")
    return p.parse_args(argv)



def export_collection(coll_name, out_path):
    coll = bpy.data.collections.get(coll_name)
    if coll is None:
        print(f"MISSING_COLLECTION {coll_name}")
        return False

    bpy.ops.object.select_all(action="DESELECT")
    count = 0
    for obj in coll.all_objects:
        obj.select_set(True)
        count += 1
    if count == 0:
        print(f"EMPTY_COLLECTION {coll_name}")
        return False

    out_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(out_path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    size = out_path.stat().st_size
    print(f"EXPORTED {coll_name} -> {out_path} ({count} objects, {size} bytes)")
    return True


def main():
    args = parse_args()
    unlink_broken_image_textures()
    out_dir = Path(args.out_dir)

    ok = 0
    failed = []
    for entry in args.manifest.split(";"):
        entry = entry.strip()
        if not entry:
            continue
        coll_name, rel_path = entry.split(",", 1)
        out_path = out_dir / rel_path
        if export_collection(coll_name, out_path):
            ok += 1
        else:
            failed.append(coll_name)

    print(f"EXPORT_SUMMARY ok={ok} failed={len(failed)} failed_names={failed}")


if __name__ == "__main__":
    main()
