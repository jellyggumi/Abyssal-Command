# Payload Audit — director direct measurement (2026-07-25)

Measured by direct file inspection and `assets/defense-asset-manifest.json`
cross-reference. PerfG6 owns the transfer-cost and frame-budget verdicts; this
is the asset-inventory half.

## Current GLB payload: 53 MB across 51 files

| group | files | bytes | note |
|---|---|---|---|
| characters (body + plinth) | 24 | ~30 MB | 24% of triangles are inert plinth |
| terrain | 10 | ~0.3 MB | 108–1,008 tris each |
| VFX | 6 | ~0.2 MB | 24–1,232 tris |
| props + equipment tiers | 10 | ~0.1 MB | all referenced, see below |
| **previs** | **1** | **23 MB** | **unreferenced, already marked for deletion** |

## Finding P1 — a 23 MB asset the manifest already condemned is still shipping

`assets/images/battle/glb/previs/anchor-shard.previs.glb` — 500,000 triangles,
23 MB, no skin, 1 animation.

`assets/defense-asset-manifest.json:2781-2789` already records:

```json
{
  "disposition": "delete",
  "currentPath": "assets/images/battle/glb/previs/anchor-shard.previs.glb",
  "runtimeReference": false,
  "testDisposition": "delete"
}
```

The manifest lists four `previs/*.glb` entries as `delete` / `runtimeReference:
false`. Three are already gone from disk. This one is not. **The judgment was
made and never executed**, and the file is 43% of the entire GLB payload.

No code path references it: grep across `*.js`, `*.mjs`, `*.cjs`, `*.json`,
`*.yml`, `*.html` finds it only in the manifest's own delete record.

## Finding P2 — props and equipment tiers ARE wired (no action)

Checked because they looked like candidates. They are not:
- `PROP_MODELS` (`battle-realtime-three.js:212-218`) resolves all 5 prop GLBs for
  reward-card 3D portraits, and all 5 ids appear in `defense-catalog.js`
  `REWARDS` + `STAGE_REWARD_IDS`.
- `EQUIPMENT_TIER_MODELS` (`:228-234`) resolves all 5 tier GLBs.
- All 10 are registered in `scripts/defense-runtime-assets.mjs:55-64`.

A prior cycle deleted `abyssal-banner.glb` / `warden-lantern.glb` as
"unreferenced"; they are referenced now and present. No further pruning here.

## Combined payload opportunity

| action | saving | risk |
|---|---|---|
| delete the condemned previs GLB | **23 MB** | none — manifest already says delete, zero code refs |
| strip `*_pedestal` meshes (validated, see `fix-1-pedestal-removal-validated.md`) | **~5.9 MB** | none — rig/clips preserved byte-for-byte on 4 probes |
| **total** | **~29 MB of 53 MB (55%)** | no art re-authoring required |

Post-fix payload lands near **24 MB**, and the character cast simultaneously
renders at correct scale for the first time.

## Note for PerfG6

Two numbers here are inventory-side only and need your runtime measurement to
become gate evidence:
1. Whether the 53 MB is actually transferred on first load, or whether the
   service worker's precache list and the Pages `git archive` allowlist already
   exclude the previs file in the deployed artifact. It is present in the repo;
   whether it reaches a player is your call to measure.
2. The frame-budget effect of removing 134,969 triangles from the character
   cast. My figure is geometry count, not measured draw cost.
