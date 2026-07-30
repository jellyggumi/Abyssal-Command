# Dungeon floor pipeline — flat gameplay surface from concept plates

Cycle 10 asset lane. Produces the artifact the three stages have never had: a
**flat, gameplay-eligible floor** composed of authored slabs, so the battle
surface stops being a single procedural quad.

## Why a new path instead of promoting the existing terrain

`stage-world-catalog.js:122-125, 202-205, 285-288` marks all three stage terrains
`terrainRuntimeEligible: false`:

| Stage | Reason recorded in the catalog |
|---|---|
| `cinder-span` | `authored-diorama-not-flat-gameplay-eligible` |
| `abyss-chancel` | `source-candidate-not-runtime-eligible` |
| `echo-throne` | `source-candidate-not-runtime-eligible` |

`assets/mesh/terrain/terrain-cinder-span/runtime/terrain/terrain-cinder-span.glb`
already exists and is deliberately retained as ineligible. Re-exporting that
diorama and flipping the flag would reintroduce the exact defect that caused the
fallback. The feature and prop packs already load and stay where they work —
only the **ground plane** is missing, and that is what this pipeline builds.

## Two stages, two tools

### 1. `deproject-terrain-plate.py` — plate to top-down tile

The concept plates are 1536×1024 three-quarter-view renders of a slab on white
(`assets/mesh/terrain/*/raw/*-terrain.raw.png`). A floor laid on the gameplay
plane needs a top-down orthographic albedo, so the plate is de-projected:

1. segment the slab against the white studio background;
2. take the top-face corners — `N` = topmost silhouette row, `W`/`E` = the
   **topmost pixel** of the leftmost/rightmost columns (the silhouette also
   contains the side faces, so the middle of that vertical run would pull the
   corner down by half the slab thickness and shear the result), `S` closes the
   parallelogram as `W + E − N`;
3. solve the homography onto a rectangle and resample bilinearly;
4. optionally converge opposite edges so the tile repeats.

Requires `numpy` + `Pillow`; the kernel python lacks them, so run it with
`/opt/homebrew/bin/python3`.

```sh
/opt/homebrew/bin/python3 deproject-terrain-plate.py \
  --plate assets/mesh/terrain/terrain-cinder-span/raw/terrain-cinder-span-terrain.raw.png \
  --out-dir _workspace/current/engineering/asset-pipeline/terrain-dungeon/deprojected \
  --slab-id cinder-span-floor --size 1024 --seamless
```

Measured seam error, mean absolute channel difference across the wrap edge
[OBSERVED]:

| Slab tile | before blend (h / v) | after blend (h / v) |
|---|---|---|
| `cinder-span-floor` | 0.0664 / 0.0672 | **0.0000 / 0.0000** |
| `abyss-chancel-floor` | 0.0512 / 0.0475 | **0.0000 / 0.0000** |
| `echo-throne-floor` | 0.1085 / 0.1307 | **0.0000 / 0.0000** |

### 2. `build-dungeon-floor-blender.py` — tiles to composed floor GLB

Reads a slab manifest, builds one grid per slab at `z = 0`, applies the
de-projected albedo with per-slab UV repeat, rotation and tint, and exports a
GLB whose node names follow the convention the stage catalog already relies on:
`terrain-{stageId}-floor-{index:03d}`.

The builder refuses to write a floor that is not usable:

- overlapping slab rects are rejected;
- slabs that leave a gap inside their own bounding box are rejected — in a game
  that forbids elevation change, a hole in the floor is an invisible pit;
- a non-coplanar vertex set is rejected, which is precisely the condition that
  disqualified the dioramas.

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -P build-dungeon-floor-blender.py -- \
  --manifest <stage>.slabs.json \
  --texture-dir deprojected \
  --out <out>/terrain-<stage>-floor.glb
```

## Pipeline proof [OBSERVED]

`pipeline-probe.slabs.json` is a throwaway 3-slab manifest — not a stage, never
promoted — used to prove the path end to end before authored layouts land.

Blender 5.1.2 build, then loaded through the repository's own
`vendor/loaders/GLTFLoader.js` in a real WebGL browser session:

| Check | Result |
|---|---|
| Load time | 218 ms |
| Node names | `terrain-pipeline-probe-floor-001` / `-002` / `-003` |
| Materials | `mat-basalt-ember-001`, `mat-flagstone-oath-002`, `mat-polished-echo-003` |
| Bound textures | 3 / 3 |
| Triangles | 6 |
| **Vertical extent** | `minY = 0`, `maxY = 0` — exactly coplanar |
| Footprint | 22.8 × 10.4 Blender m = 22800 × 10400 gameplay units, matching the manifest rects |
| GLB size | 580,036 bytes |

Texture format matters: the first export embedded PNG and weighed 5,708,716
bytes. The runtime `GLTFLoader` has no Draco or KTX2 transcoder
(`engineering/runtime-surface-maps/map-renderer.md`, risk 5), so a multi-megabyte
embedded PNG per slab blocks the main thread on decode. Floor albedo carries no
alpha, so JPEG q88 holds the same pixels at **9.8× smaller** output.

## Promotion contract

Output here is concept-lane and `runtimeEligible: false` until audited.
Promotion into `assets/mesh/terrain/**/runtime/**` requires all three catalog
fields to change together, per the validator at `stage-world-catalog.js:387-394`:

1. `terrainGlbPath` pointing under `assets/mesh/terrain/**/runtime/**` — never
   `/textured-candidate/`;
2. `terrainRuntimeEligible: true`;
3. `terrainFallback` deleted.

Leaving both an eligible path and a fallback throws
`requires one eligible runtime strategy`. Registration in
`scripts/defense-runtime-assets.mjs` must also move off the
`textured-candidate/` paths at lines 25-26, or the promotion is invisible to the
runtime.
