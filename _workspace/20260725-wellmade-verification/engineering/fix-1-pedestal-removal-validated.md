# Fix 1 Validation — pedestal removal (prototype, not applied)

Director, 2026-07-25. **Nothing in `assets/` was modified.** The probe wrote to
`/tmp/probe/` only; this is a feasibility proof for the improvement backlog.

## What was tested

`/tmp/strip-pedestal-probe.py` — imports a character GLB, deletes the mesh named
`<id>_pedestal`, re-exports with skins and animations enabled.

```
blender -b -P /tmp/strip-pedestal-probe.py -- \
  --glb assets/images/battle/glb/bosses/pack-herald.glb --out /tmp/probe/pack-herald.glb
```

Ran on 4 plinth models + 1 plinth-free control. Output GLBs re-measured with the
same direct binary parser used for the baseline audit.

## Result — the fix works and costs nothing structurally

| model | | scale (body % of Box3) | tris | MB | skins | joints | clips | keyframes |
|---|---|---|---|---|---|---|---|---|
| pack-herald | before | **54%** | 38,682 | 1.63 | 1 | 24 | 11 | 17,524 |
| | after | **100%** | 22,102 | 1.20 | 1 | 24 | 11 | 17,524 |
| abyss-regent | before | **56%** | 39,438 | 1.62 | 1 | 24 | 11 | 17,524 |
| | after | **100%** | 16,466 | 1.01 | 1 | 24 | 11 | 17,524 |
| pack-warden | before | **59%** | 16,052 | 1.03 | 1 | 24 | 11 | 17,524 |
| | after | **100%** | 8,676 | 0.80 | 1 | 24 | 11 | 17,524 |
| guard | before | **71%** | 15,733 | 0.90 | 1 | 24 | 11 | 17,524 |
| | after | **100%** | 11,043 | 0.78 | 1 | 24 | 11 | 17,524 |
| gate-sovereign (control, no plinth) | before | 100% | 37,960 | 1.58 | 1 | 24 | 11 | 5,484 |
| | after | 100% | 37,960 | 1.58 | 1 | 24 | 11 | 5,484 |

- **Scale is restored to 100% on every plinth model.** This is the D2 fix.
- **Rig and animation survive byte-for-byte** — 1 skin, 24 joints, 11 clips,
  17,524 keyframes, identical before and after. No re-rigging, no re-baking.
- **The plinth-free control is a clean no-op**, so the change is safe to apply
  uniformly without special-casing.

## Projected fleet-wide impact

| metric | value |
|---|---|
| models affected | 20 of 24 |
| rendered scale | 54%–99% → **100% uniformly** |
| triangles removed | **134,969** (24% of all character geometry) |
| payload saved | **~5.9 MB** of the 53 MB GLB total |
| rig / clip risk | none — preserved exactly on all 4 probes |

Largest individual wins: `abyss-regent` −851 KB / −22,972 tris,
`requiem-choir` −772 KB / −20,886 tris, `pack-herald` −630 KB / −16,580 tris.

Combined with deleting the unreferenced 22.5 MB `previs/anchor-shard.previs.glb`
(0 code references, confirmed by grep), the GLB payload drops from 53 MB to
roughly **25 MB — a 53% reduction** with zero art re-authoring.

## Two implementation options

1. **Pipeline-side (recommended):** stop exporting the plinth in
   `scripts/rig-character-asset-blender.py:770-784`, which currently renames and
   re-parents it on purpose. One-line scope, but requires a re-run of the batch
   and re-verification of all 24 outputs.
2. **Renderer-side:** have `fitHeight()` (`battle-realtime-three.js:462`) measure
   the Box3 of the skinned mesh only, ignoring `*_pedestal`. Fixes the scale
   defect immediately with no asset re-export, but leaves the 134,969 inert
   triangles and 5.9 MB in the payload.

Doing 1 makes 2 unnecessary. Doing 2 first is a valid fast mitigation if a
release is imminent.

## Caveat

The probe's own Y-axis readings were discarded: Blender is Z-up and glTF is
Y-up, so the script's in-Blender `.y` measurements were the depth axis, not
height. Every number in this document comes from the direct glTF binary parser
(Y-up, correct), not from the probe's internal measurements. The probe's only
load-bearing output is the exported GLB itself.

Separately, the BlenderMCP addon injects a stray `Icosphere` primitive into the
scene around import; the probe removes non-`_body`/`_pedestal` meshes after
import to keep it out of the export. Any future Blender automation in this repo
needs the same guard.
