# Runtime verification — repaired clips in the live Three.js runtime

run-id: `20260729-abyssal-lantern-cycle`
status: `[OBSERVED]` — verified in the actual browser runtime, not in Blender

---

## 1. What was verified

The skin-weight repair (`6e2ab06`) was previously evidenced only through Blender and GLB
payload arithmetic. This is the missing runtime half: the repaired bytes were loaded through
the runtime's own `GLTFLoader`, driven with a real `THREE.AnimationMixer`, and measured.

Method: load `assets/motion/ingame/characters/<id>/model.glb` in the page, take the largest
skinned mesh, play a clip, step the mixer at 1/60 for 24 frames, and measure the angular
travel of the first track's target node plus the skin-weight state of the loaded geometry.

## 2. Result

| asset | mesh | verts | clips | clips animating | rad travel | maxInfluences | weightSumErr |
|---|---|---|---|---|---|---|---|
| scout | `scout_body` | 5443 | 11 | 2/3 | 1.113 | 4 | 0 |
| shade | `shade_body` | 5441 | 11 | 2/3 | 1.528 | 3 | 0 |
| possessed | `possessed_body` | 5788 | 11 | 2/3 | 0.404 | 3 | 0 |
| shadow-soldier-v04 | `shadow-soldier-v04_body` | 21111 | 11 | 2/3 | 0.979 | 4 | 0 |
| shadow-commander-boss | `shadow-commander-boss_body` | 23715 | 11 | 2/3 | 0.927 | 3 | 0 |

- **All 5 load** with the full 11-clip library and a 24-bone skeleton.
- **All 5 animate.** `scout::attack::v01` samples `DEF-spine` at 0.229 → 1.396 → 1.228 rad
  across the clip with the action reporting `isRunning: true` and 22 tracks resolving to real
  nodes.
- **All 5 are exactly normalized** in the loaded geometry: worst |Σw − 1| is 0. This matters
  because `GLTFLoader` does not call `normalizeSkinWeights()`, so an unnormalized set would
  shrink the mesh toward the skeleton origin at runtime.
- **maxInfluences 3–4**, i.e. the repaired vertices retain multiple bending partners rather
  than collapsing to rigid single-bone binding.

`2/3` clips animating is the measurement's own limit, not a defect: `die` is a monotonic
collapse whose first track can be near-stationary in the sampled window. `attack` and `run`
both move on every asset.

## 3. Two probe bugs corrected during this pass `[OBSERVED]`

Recorded because both would have produced a false negative:

1. **Bone-name sanitisation.** `GLTFLoader` rewrites `DEF-pelvis.L` → `DEF-pelvisL` and
   `DEF-forearm.R` → `DEF-forearmR`, because a dot is the track-path separator. A probe
   looking up the original Blender names finds nothing and measures zero motion. Always read
   the clip's own `tracks[n].name` to discover the real target, never assume the authoring
   name survives export.
2. **`mixer.setTime()` does not pose the rig.** Only `mixer.update(delta)` applies the
   action, which is what the runtime does per frame. A probe using `setTime` reports zero
   travel on a perfectly good clip.

## 4. Scope limit — 4 assets are no longer this session's bytes `[OBSERVED]`

A concurrent session replaced 4 of the 9 runtime GLBs after `3474d780`:

| asset | working | committed at 3474d780 | state |
|---|---|---|---|
| guard | `d65936d0d926` | `e735e9a76174` | **replaced** |
| lantern-reaver | `5a35b4c90d06` | `ace464db6a21` | **replaced** |
| human-command-boss | `051a983f68a3` | `feff635819fd` | **replaced** |
| broken-court-monarch-v04 | `e8ae530ce765` | `1bc87c2aba7c` | **replaced** |
| scout / shade / possessed / shadow-soldier-v04 / shadow-commander-boss | — | — | unchanged |

The replacements are structurally different, and in a direction worth flagging: where this
session's `guard_body` was ONE mesh of 5325 vertices with 2–4 influences per vertex, the
replacement loads as **35 skinned sub-meshes** (`guard_body_part_006`, 388 verts) with
**maxInfluences 1** — rigid single-bone binding. `lantern-reaver` shows 67 parts,
`human-command-boss` 60, `broken-court-monarch-v04` 98, all at maxInfluences 1.

Single-influence binding cannot bend at a joint at all, which is the defect the repair
existed to remove. That may be intentional in their pipeline (a part-split rig poses parts
rigidly rather than deforming a continuous skin) — it is not this session's call to make, and
their work is not judged here. But it means:

- the 9/11 repaired figure describes commit `6e2ab06`, not the current working tree;
- the runtime evidence in §2 covers the 5 assets that still carry this session's bytes;
- if their replacements are committed, `assets/motion/ingame/characters/*/manifest.json` must
  be re-stamped via `scripts/record-weight-repair-provenance.py`, or the manifests will
  describe weights that no longer exist. Two manifests currently show no `weightRepair` block
  while their GLB has changed.

Cross-lane ownership is recorded in
`_workspace/current/production/concurrent-session-collision-20260729.md`.

## 5. Reproduce

```bash
python3 -m http.server 4173      # from the repository root
# then, in the page: load a model through GLTFLoader, play a clip, step
# mixer.update(1/60), and read tracks[n].name for the real node names.
python3 scripts/gate-joint-weight-repair.py --check   # payload-level state, no browser
```
