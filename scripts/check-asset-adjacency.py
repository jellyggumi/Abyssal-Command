#!/usr/bin/env python3
"""
Systematic QA: for every listed collection, cluster its mesh objects by
bounding-box proximity (expanded by a tolerance). Reports collections that
split into >1 cluster -- i.e. contain "island" objects floating disconnected
from the main body. Catches exactly the class of bug found by hand in
bridge-colossus (missing arm connectors) and abyssal-banner (floating
cloth/tassels), across the full pack instead of relying on visual spot-checks.

Run headless:
  blender --background <file>.blend --python scripts/check-asset-adjacency.py -- \
    --collections coll1,coll2,... --tolerance 0.08
"""
import sys
import argparse
import math

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--collections", required=True)
    p.add_argument("--tolerance", type=float, default=0.08, help="max gap (world units) to still count as adjacent")
    return p.parse_args(argv)


def obj_bbox(o):
    mins = Vector((math.inf, math.inf, math.inf))
    maxs = Vector((-math.inf, -math.inf, -math.inf))
    for corner in o.bound_box:
        wc = o.matrix_world @ Vector(corner)
        mins.x, mins.y, mins.z = min(mins.x, wc.x), min(mins.y, wc.y), min(mins.z, wc.z)
        maxs.x, maxs.y, maxs.z = max(maxs.x, wc.x), max(maxs.y, wc.y), max(maxs.z, wc.z)
    return mins, maxs


def bbox_gap(a, b):
    """Cheap AABB lower-bound gap: if this alone exceeds tolerance, the true
    (always >= this) surface distance can't be within tolerance either --
    used only as a prefilter to skip the expensive BVH check for far-apart
    pairs, never as the adjacency verdict itself (an AABB corner can overlap
    while a tilted shape's actual surfaces are far apart, or vice versa)."""
    amin, amax = a
    bmin, bmax = b
    dx = max(amin.x - bmax.x, bmin.x - amax.x, 0.0)
    dy = max(amin.y - bmax.y, bmin.y - amax.y, 0.0)
    dz = max(amin.z - bmax.z, bmin.z - amax.z, 0.0)
    return math.sqrt(dx * dx + dy * dy + dz * dz)


def world_space_bvh(obj):
    """Builds a BVHTree in WORLD space. BVHTree.FromObject builds in LOCAL
    space -- verified empirically (querying a known-touching vertex's WORLD
    coordinate against a FromObject tree returned a wildly wrong nonzero
    distance; the same vertex's LOCAL coordinate correctly returned 0).
    Every make_* helper in build-world-content-pack.py sets obj.scale
    per-part (non-uniform), so local-space distances aren't even
    proportional to world-space ones -- this operates on already-world-
    transformed vertex data via FromPolygons, not FromObject, so every
    query below is apples-to-apples in the same (world) space.
    Returns (bvh, world_verts) -- world_verts reused by the caller so the
    matrix multiply isn't repeated per query.
    """
    mesh = obj.data
    world_verts = [obj.matrix_world @ v.co for v in mesh.vertices]
    polygons = [list(p.vertices) for p in mesh.polygons]
    bvh = BVHTree.FromPolygons([tuple(v) for v in world_verts], polygons, all_triangles=False)
    return bvh, world_verts


def surface_distance(bvh_a, verts_a, bvh_b, verts_b):
    """True minimum surface-to-surface distance/overlap between two meshes,
    both already in world-space BVH form -- correct for both tilted shapes
    (AABB-vs-real-surface mismatch, caught on the commander blade/dawnless-
    orb) and face contacts (vertex-to-vertex distance misses e.g. a torus
    penetrating the middle of a flat cube face, which has no vertex
    anywhere near it).
    1. bvh_a.overlap(bvh_b): non-empty -> triangles actually interpenetrate,
       distance is 0 (definitely connected).
    2. Otherwise: min over every vertex of A -> nearest point on B's
       surface, and every vertex of B -> nearest point on A's surface.
       Exact for vertex-to-face/vertex-to-edge nearest cases; can slightly
       overestimate true edge-to-edge minimal distance between two convex
       hulls whose closest points both lie mid-edge (rare for these
       low-poly primitives) -- only makes this check mildly conservative,
       never produces a false "connected" or false "island" verdict.
    """
    if bvh_a.overlap(bvh_b):
        return 0.0
    best = math.inf
    for v in verts_a:
        hit = bvh_b.find_nearest(v)
        if hit[0] is not None and hit[3] < best:
            best = hit[3]
    for v in verts_b:
        hit = bvh_a.find_nearest(v)
        if hit[0] is not None and hit[3] < best:
            best = hit[3]
    return best


def find_clusters(objects, tolerance, depsgraph):
    del depsgraph  # no longer needed: FromPolygons doesn't require one
    meshes = [o for o in objects if o.type == "MESH"]
    names = [o.name for o in meshes]
    by_name = {o.name: o for o in meshes}
    boxes = {o.name: obj_bbox(o) for o in meshes}
    bvh_data = {o.name: world_space_bvh(o) for o in meshes}
    parent = {n: n for n in names}

    def find(n):
        while parent[n] != n:
            parent[n] = parent[parent[n]]
            n = parent[n]
        return n

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            ni, nj = names[i], names[j]
            if bbox_gap(boxes[ni], boxes[nj]) > tolerance:
                continue
            bvh_i, verts_i = bvh_data[ni]
            bvh_j, verts_j = bvh_data[nj]
            if surface_distance(bvh_i, verts_i, bvh_j, verts_j) <= tolerance:
                union(ni, nj)

    clusters = {}
    for n in names:
        r = find(n)
        clusters.setdefault(r, []).append(n)
    return list(clusters.values())


def main():
    args = parse_args()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    flagged = []
    for cn in args.collections.split(","):
        cn = cn.strip()
        coll = bpy.data.collections.get(cn)
        if not coll:
            print(f"MISSING_COLLECTION {cn}")
            continue
        mesh_objs = [o for o in coll.all_objects if o.type == "MESH"]
        if len(mesh_objs) < 2:
            print(f"OK  {cn:32} (single/no mesh object, n={len(mesh_objs)})")
            continue
        clusters = find_clusters(mesh_objs, args.tolerance, depsgraph)
        if len(clusters) == 1:
            print(f"OK  {cn:32} n={len(mesh_objs)} 1 cluster")
        else:
            sizes = sorted((len(c) for c in clusters), reverse=True)
            print(f"ISLANDS {cn:32} n={len(mesh_objs)} -> {len(clusters)} clusters sizes={sizes}")
            for c in sorted(clusters, key=len):
                if len(c) < max(sizes):
                    print(f"    isolated: {c}")
            flagged.append(cn)
    print()
    print("FLAGGED_COLLECTIONS:", ",".join(flagged) if flagged else "NONE")


if __name__ == "__main__":
    main()
