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

## 6. Gate verdict on the current working tree `[OBSERVED]`

Run after the replacements landed, so this measures the tree as it stands rather than what
this session committed:

```
$ python3 scripts/gate-joint-weight-repair.py --check
broken-court-monarch-boss  spread 0.0000 maxSpr 0 seam>1     0 disjoint    0 inf1  28708 (100.0%) RIGID
broken-court-monarch-v04   spread 0.0000 maxSpr 0 seam>1     0 disjoint    0 inf1   5788 (100.0%) RIGID
ember-cohort               spread 0.0000 maxSpr 0 seam>1     0 disjoint    0 inf1   5679 (100.0%) RIGID
guard                      spread 0.0000 maxSpr 0 seam>1     0 disjoint    0 inf1   5325 (100.0%) RIGID
human-command-boss         spread 0.0000 maxSpr 0 seam>1     0 disjoint    0 inf1   4933 (100.0%) RIGID
lantern-reaver             spread 0.0000 maxSpr 0 seam>1     0 disjoint    0 inf1   5436 (100.0%) RIGID
possessed                  spread 0.0000 maxSpr 2 seam>1    47 disjoint   37 inf1     72 (  1.2%) ok
scout                      spread 0.0000 maxSpr 2 seam>1   188 disjoint  124 inf1      7 (  0.1%) ok
shade                      spread 0.0000 maxSpr 2 seam>1   135 disjoint   93 inf1     19 (  0.3%) ok
shadow-soldier-v04         spread 0.0000 maxSpr 2 seam>1   232 disjoint  169 inf1     56 (  0.3%) ok
shadow-commander-boss      spread 0.0000 maxSpr 2 seam>1   555 disjoint  507 inf1    127 (  0.5%) ok
```

Six assets are **100% single-influence**: every vertex bound to exactly one bone. A
single-influence vertex cannot bend at all, so this is a different failure mode from the
original smear — parts crease and separate at joints instead of deforming.

### Why three columns read green on the broken assets

`spread 0.0000`, `seam>1 0` and `disjoint 0` are **artifacts of the same degeneracy**, not
passes. With one influence per vertex there is no pair of bones to span, so spread has nothing
to measure; and adjacent vertices never share a bone, so "disjoint" is the normal state rather
than a defect signal. Three of five columns are therefore uninformative here, which is why
check mode gained the explicit `RIGID` verdict in this pass — before that, the gate reported a
clean row for a fully rigid asset.

`sumErr` is a useful provenance fingerprint: a single weight of exactly 1.0 sums with zero
float error, while renormalized multi-influence weights carry ~4.47e-08. The column alone
separates the two pipelines without consulting git history.

### Threshold contract changed in the working tree `[OBSERVED]`

`scripts/gate-joint-weight-repair.py` is modified but uncommitted, and the rigidity rule is
not the one this session's results were produced under:

| | committed (`6e2ab06`) | working tree |
|---|---|---|
| constant | `RIGIDITY_FLOOR_FRACTION = 0.005` | `RIGIDITY_CEILING_FRACTION = 0.25` |
| budget | `max(baseline, 0.5% of verts)` | `min(baseline, 25% of verts)` |

This is a different contract, not merely a looser number. `min(baseline, ceiling)` means an
asset can never be allowed to get more rigid than it shipped, which is **stricter** than the
committed rule for low-baseline assets — lantern-reaver ships with `inf1 = 3`, so its budget
becomes 3, which is exactly the absolute-zero bar this session rejected as unusable when
tuning the sweep. The 25% ceiling only binds on assets that already ship heavily rigid.

Both rules flag the regression above (1.00 > 0.25), so the verdict stands either way. But the
**9 of 11 pass recorded in `6e2ab06` was produced under 0.005 and `max()`**, and should not be
read as having cleared a 25% bar. Which rule is right is a decision for whoever owns the
articulation lane now; it is recorded rather than arbitrated here.

## 7. The gate output above is version-dependent — use these instead `[OBSERVED]`

Important caveat for anyone re-running the numbers. The other session also changed the gate's
epsilon constants, so **HEAD's gate and the working-tree gate read the same GLB bytes and
report different figures**. Running HEAD's version against the current assets gives, for
example, `broken-court-monarch-boss spread 0.5984 / inf1 0` where the working-tree version
gives `spread 0.0000 / inf1 28708`. Neither is wrong; the metric definitions moved.

A reader who runs the committed gate and gets different numbers should not conclude this
report was mistaken — they should check which epsilon their copy carries.

Two confirmations of the rigidity regression do **not** depend on any gate version:

### Structural: mesh count

Needs no metric definition to interpret. Measured via `GLTFLoader` in the page:

| asset | skinned meshes | this session's bytes |
|---|---|---|
| guard | **35** (`guard_body_part_006`, 388 verts) | 1 (`guard_body`, 5325 verts) |
| lantern-reaver | **67** | 1 |
| human-command-boss | **60** | 1 |
| broken-court-monarch-v04 | **98** | 1 |
| scout / shade / possessed / shadow-soldier-v04 / shadow-commander-boss | 1 | 1 |

### Raw: influence histogram straight from the GLB BIN chunk

Unpacking `WEIGHTS_0` directly and counting components above 0.10 — no gate, no loader:

```
guard           {1: 5325}                            -> 100.0% single-influence
lantern-reaver  {1: 5436}                            -> 100.0% single-influence
scout           {1: 328, 2: 3226, 3: 1882, 4: 7}     ->   6.0% single-influence
shade           {1: 223, 2: 3191, 3: 2027}           ->   4.1% single-influence
```

Both agree with §6 and with each other. A vertex bound to exactly one bone cannot bend, so
`guard` and `lantern-reaver` currently have no articulation at all in the deformation sense —
their parts pose rigidly instead. Whether that is the intended design of the replacing
pipeline is that lane's call; this section only fixes the measurement so the question can be
asked precisely.

## 8. Sections 6 and 7 are STALE — the regression was fixed `[OBSERVED]`

Recorded rather than edited away, because the numbers in §6/§7 were真 when measured and the
correction is the useful part.

§6 and §7 report six assets at 100% single-influence. **That is no longer true.** The gate ran
at 23:48; the other session regenerated the assets at 23:41–23:53, i.e. partly after the
measurement. Re-measured directly from the GLBs at 00:2x, every asset is healthy:

| asset | skinned meshes | verts | inf1 | inf1 % | max &#124;Σw−1&#124; | attack bone travel |
|---|---|---|---|---|---|---|
| guard | 35 | 5325 | 0 | 0.0% | 4.5e-08 | 3.127 rad |
| lantern-reaver | 67 | 5436 | 5 | 0.1% | 4.0e-08 | 2.437 rad |
| human-command-boss | 60 | 4933 | 6 | 0.1% | 4.5e-08 | 1.437 rad |
| broken-court-monarch-v04 | 98 | 5788 | 0 | 0.0% | 4.5e-08 | 2.547 rad |
| ember-cohort | 63 | 5679 | 1 | 0.0% | 4.5e-08 | 3.127 rad |
| broken-court-monarch-boss | 610 | 28708 | 0 | 0.0% | 4.5e-08 | 2.569 rad |
| scout | 1 | 5443 | 7 | 0.1% | 4.5e-08 | 1.432 rad |
| shade | 1 | 5441 | 19 | 0.3% | 4.5e-08 | 2.641 rad |
| possessed | 1 | 5788 | 72 | 1.2% | 4.5e-08 | 2.547 rad |
| shadow-soldier-v04 | 1 | 21111 | 56 | 0.3% | 4.5e-08 | 3.136 rad |
| shadow-commander-boss | 1 | 23715 | 127 | 0.5% | 4.5e-08 | 3.095 rad |

**11 of 11 animate**, worst single-influence share 1.2%, weight sums normalized throughout. The
two assets this session could not repair (the fused capes on the monarch bosses) are resolved:
`broken-court-monarch-boss` is now 610 meshes at 0% rigid. The other session's regeneration is
the right fix and it landed — this section exists so nobody acts on §6's stale figures.

### Probe bug 3: `Box3.setFromObject` on a SkinnedMesh reads BIND pose

Third in the family, and the most tempting. Measuring per-part motion by bounding-box centroid
returns **zero movement for every asset**, including ones independently proven to animate:

```
guard  maxPartMove 0.0000   relativeSpread 0.0000     <- false negative
scout  maxPartMove 0.0000   relativeSpread 0.0000     <- false negative
```

`Box3.setFromObject()` transforms the geometry's bounding box by the node's world matrix. Under
skinning the mesh node **never moves** — the bones do, and deformation happens in the vertex
shader. So the box is constant by construction, whatever the animation does. Measure bone
quaternion travel under `mixer.update(delta)` instead, as the table above does.

Running total of ways to "prove" a working rig is broken: sanitized bone names (`.` is the
track-path separator), `setTime()` without `update()`, and now bind-pose bounding boxes.
