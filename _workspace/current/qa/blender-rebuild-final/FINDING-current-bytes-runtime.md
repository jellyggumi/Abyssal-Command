# Do the current bytes shred in the actual three.js runtime?

run-id: `20260804-current-bytes-runtime`
status: `[OBSERVED]` — measured in headless Chromium against the runtime's own
`vendor/loaders/GLTFLoader.js` and `vendor/three.module.js` (r185). No Blender anywhere
in this investigation. Assets were read-only throughout; nothing under `assets/` was
touched.

---

## 1. Verdict

**The current bytes are SHREDDED under animation. The REST pose is INTACT.**

This holds for `lantern-reaver` and `guard` — and also for `scout`, which the brief
named as a known-good control. The control is *not* good; it tears too, less severely.

| asset | REST | ANIMATED (attack) | verdict |
|---|---|---|---|
| `lantern-reaver` | intact, seam separation **0.00000** | seam separation **0.475 × bbox diagonal** | **SHREDDED** |
| `guard` | intact, seam separation **0.00000** | seam separation **0.241 × bbox diagonal** | **SHREDDED** |
| `scout` (control) | intact, seam separation **0.00000** | seam separation **0.314 × bbox diagonal** | **SHREDDED (milder)** |

Rest differs from animated absolutely and unambiguously: for these three, at rest every
measurement is exactly zero to float precision. The defect is entirely in the posed state.
(Cohort-wide, two further actors — `ember-cohort` and `possessed` — carry a small non-zero
rest separation for a separate, documented reason; §4b.)

Extended to all 11 actors, **7 are torn and 4 are completely clean** (§4b). The four clean
ones return separation of exactly `0.00000` at rest and throughout the clip, which both
validates the metric and shows this is a regression rather than a pipeline limitation.

**Hypothesis H is falsified.** The shredding is not a Blender preview artifact. It
reproduces in three.js, through the runtime's own loader, with no Blender in the loop
(§5). The expensive mistake the investigation existed to prevent — changing assets to
satisfy Blender and thereby breaking the runtime — is *not* the situation here. The
runtime is what is broken.

---

## 1b. Provenance of the measured bytes

Every number and every render in this document comes from these three files and nothing
else:

```
assets/motion/ingame/characters/lantern-reaver/model.glb
assets/motion/ingame/characters/guard/model.glb
assets/motion/ingame/characters/scout/model.glb
```

Resolved by a hardcoded template in the probes, `/assets/motion/ingame/characters/${id}/model.glb`,
served by `python3 -m http.server 4173` from the repository root. This is the same path
`MOTION_MODELS` in `battle-realtime-three.js:275-287` points at.

Verified rather than asserted — each URL was re-fetched in-page and the received bytes
hashed with `crypto.subtle.digest("SHA-256", …)`, alongside the browser's own request log:

| asset | bytes | SHA-256 (first 16) | matches disk | loader view |
|---|---|---|---|---|
| `lantern-reaver` | 12510868 | `065f7b8195e5c4d8` | yes | 9 meshes, 5617 verts, 1 skeleton, 24 bones, 11 clips |
| `guard` | 13444940 | `4c629a7f707c3fb3` | yes | 9 meshes, 5504 verts, 1 skeleton, 24 bones, 11 clips |
| `scout` | 12510880 | `e05c9eda304e2157` | yes | 9 meshes, 5677 verts, 1 skeleton, 24 bones, 11 clips |

The request log contains only those three URLs. Nothing under `_workspace/` was loaded,
and the runtime GLBs are byte-identical to their
`_workspace/current/engineering/asset-pipeline/character-motion-library/<id>/model.glb`
copies, so no staged or candidate directory can account for any difference.

```bash
node /tmp/provenance-check.mjs http://127.0.0.1:4173 lantern-reaver guard scout
```

**The three actors are structurally identical** — 9 primitives, 1 skin, 24 joints, 11
clips each — and they still behave differently. The defect is therefore in the
`WEIGHTS_0` / `JOINTS_0` data, not in node or skin structure. Structural comparison
cannot detect it; §4 is what does.

---

## 2. Required table

Bone travel is measured under `mixer.update(1/60)` stepped 24 frames, reading target
names from `clip.tracks[n].name`. Weight figures are read twice: from the raw GLB
payload (authored) and from the loaded geometry.

| asset | skinned meshes | total verts | clips | attack clip | bone quaternion travel (24 frames) | max influences / vertex | worst \|Σw − 1\| |
|---|---|---|---|---|---|---|---|
| `lantern-reaver` | 9 | 5617 | 11 | `lantern-reaver::attack::v01` (2.708 s, 22 tracks, 22/22 resolved) | **4.1538 rad** on `DEF-handL` | 2 | 2.980e-08 |
| `guard` | 9 | 5504 | 11 | `guard::attack::v01` (1.833 s, 22 tracks, 22/22 resolved) | **4.7562 rad** on `DEF-handR` | 2 | 2.980e-08 |
| `scout` | 9 | 5677 | 11 | `scout::attack::v01` (1.250 s, 22 tracks, 22/22 resolved) | **4.2068 rad** on `DEF-handR` | 2 | 2.980e-08 |

`action.isRunning() === true` for all three; 24 bones each; one shared `Skeleton` per
asset; `maxSkinIndex` 23 against 24 bones with **0** out-of-range indices.

Authored influence histograms straight from the `WEIGHTS_0` accessor (components > 1e-4):
`lantern-reaver {1: 1090, 2: 4527}`, `guard {1: 31, 2: 5473}`, `scout {1: 807, 2: 4870}`.
Authored sums are already normalized, so the loader's `normalizeSkinWeights()` changes
nothing here — but see the correction in §7.

Produced by:
```bash
python3 -m http.server 4173 --bind 127.0.0.1        # from the repository root
node /tmp/runtime-skin-probe.mjs http://127.0.0.1:4173 /tmp/current-bytes.json \
  _workspace/current/qa/blender-rebuild-final/current-bytes current \
  lantern-reaver guard scout
python3 /tmp/raw-payload-probe.py lantern-reaver guard scout   # authored weights, no loader
```

---

## 3. The nominated metric returns a FALSE NEGATIVE — reported, not hidden

The brief nominated max per-vertex displacement, as a multiple of the bind-pose
bounding-box diagonal, as "the number that decides this". I measured it as specified,
computing skinned positions by hand:

```
world = matrixWorld · bindMatrixInverse · Σ_j w_j (boneWorld_j · boneInverse_j) · bindMatrix · p
ref   = matrixWorld · p
```

Cross-checked against three.js' own `SkinnedMesh.applyBoneTransform` on every 97th
vertex: **`threeJsAgreementMaxErr = 0.000e+00`**, bit-identical. The arithmetic is right.

| asset | bbox diag | REST max disp ratio | ANIM max disp ratio (frame 24) | worst frame over whole clip |
|---|---|---|---|---|
| `lantern-reaver` | 2.5467 | **9.63e-08** | **0.5223** | 0.5290 |
| `guard` | 2.2761 | **1.32e-07** | **0.6217** | 0.7878 |
| `scout` (control) | 2.6370 | **2.55e-07** | **0.5741** | 0.5750 |

Read naively this says "all healthy, all in the same band, and `lantern-reaver` is the
*least* displaced of the three." That reading is wrong, and the renders prove it.

**Why it fails.** Shredding here is bounded-magnitude but incoherent. The shards
separate by roughly a limb length, so every vertex stays within ~0.5 × the diagonal
while the surface rips apart. Displacement measures *how far a vertex went*; shredding
is about *whether neighbours went together*. No displacement threshold separates a torn
mesh from an intact one in this data — the distributions overlap completely, and the
control sits in the middle of the two broken assets.

A second metric, per-edge stretch, failed for a different reason and is also recorded:
`scout` — visually the least damaged — scored **worst** (p99 4.325, 2.661 % of edges
over 2× vs `lantern-reaver`'s 2.272 / 1.153 %). Edge stretch flags authored tattered-cloth
motion as damage, and is blind to a tear that runs *between vertices that share a position
but no edge*, which is exactly how these meshes fail.

---

## 4. The measurement that actually decides: seam separation

The exporter splits vertices at UV / normal / material seams, so one surface point can
exist as two or more coincident vertices. **Two vertices at the identical bind position
are the same point of the same surface. Under any correct skin they must stay together.
Any separation is a crack.** The metric is independent of camera, zoom, clip length and
authoring style — and authored tattered strips never enter the set, because they are
already apart at bind.

Pairs found by spatial hash at `EPS = 1e-5 × diag`, then CPU-skinned per frame.

| asset | coincident pairs | pairs w/ mismatched binding | REST max sep | ANIM max sep | **as × diag** | pairs split > 2 % diag |
|---|---|---|---|---|---|---|
| `lantern-reaver` | 1684 | 1369 (81.3 %) | **0.00000** | 1.20911 (f76) | **0.475** | 432 |
| `guard` | 1287 | 769 (59.8 %) | **0.00000** | 0.54789 (f61) | **0.241** | 238 |
| `scout` (control) | 1938 | 1522 (78.5 %) | **0.00000** | 0.82797 (f31) | **0.314** | 496 |

`lantern-reaver` pulls a single surface point apart by **1.209 world units — 47.5 % of
the whole body diagonal**. That is not a crease; it is most of a torso.

**Root cause, measured rather than inferred.** For each coincident pair I compared the
two weight vectors by L1 distance:

| bytes | pairs | different bone SET | different dominant bone | L1 p50 | L1 p99 | L1 max | pairs L1 > 1.5 |
|---|---|---|---|---|---|---|---|
| `lantern-reaver` @6e2ab06d | 1438 | 104 (7.2 %) | 391 (27.2 %) | 0.158 | 1.349 | 1.713 | **6** |
| `lantern-reaver` @current | 1684 | 750 (44.5 %) | 702 (41.7 %) | 0.420 | **2.0000** | **2.0000** | **425** |
| `guard` @6e2ab06d | 1052 | 83 (7.9 %) | 241 (22.9 %) | 0.200 | 1.518 | 1.651 | **17** |
| `guard` @current | 1287 | 303 (23.5 %) | 314 (24.4 %) | 0.076 | **2.0000** | **2.0000** | **139** |
| `scout` @6e2ab06d | 1632 | 152 (9.3 %) | 468 (28.7 %) | 0.241 | 1.408 | 1.958 | **12** |
| `scout` @current | 1938 | 870 (44.9 %) | 679 (35.0 %) | 0.298 | **2.0000** | **2.0000** | **429** |

**L1 = 2.0000 is the maximum possible value.** It means one copy of the point is bound
100 % to bone X and its twin 100 % to bone Y, with zero shared influence. The current
bytes contain 425 / 139 / 429 such fully-disjoint seam pairs; the pre-regeneration bytes
contained 6 / 17 / 12. When bones X and Y diverge during the clip, the surface opens at
every one of those seams — which is precisely the shard pattern in the renders.

```bash
node /tmp/seam-probe.mjs    http://127.0.0.1:4173 /tmp/seam.json    lantern-reaver guard scout
node /tmp/binding-diff.mjs  http://127.0.0.1:4173 /tmp/binding.json "LR@current=/hist/2359578b-lantern-reaver.glb" ...
```

## 4b. All 11 actors — and four genuine controls

Extended to the whole cohort, because the three-asset sample could not show whether clean
seam binding is even achievable in this pipeline. It is.

| asset | coincident pairs | disjoint pairs (L1 > 1.5) | REST sep × diag | worst ANIM sep × diag | verdict |
|---|---|---|---|---|---|
| `broken-court-monarch-boss` | 12078 | **0** | **0.00000** | **0.00000** | **clean** |
| `broken-court-monarch-v04` | 2755 | **0** | **0.00000** | **0.00000** | **clean** |
| `shadow-commander-boss` | 6720 | **0** | **0.00000** | **0.00000** | **clean** |
| `shadow-soldier-v04` | 4691 | **0** (1 pair mismatched, 0.02 %) | 0.00001 | 0.00002 | **clean** |
| `human-command-boss` | 1787 | 250 | 0.00000 | 0.216 | torn |
| `guard` | 1287 | 139 | 0.00000 | 0.241 | torn |
| `scout` | 1938 | 429 | 0.00000 | 0.314 | torn |
| `ember-cohort` | 1697 | 348 | **0.00754** | 0.347 | torn |
| `lantern-reaver` | 1684 | 425 | 0.00000 | **0.475** | torn |
| `shade` | 1980 | 259 | 0.00000 | 0.604 | torn |
| `possessed` | 2158 | 483 | **0.00808** | **0.611** | torn |

Seven of eleven are torn. Every torn actor shows the same `L1 max = 2.0000` signature.

**The four clean actors validate the metric.** `broken-court-monarch-boss` carries 12078
coincident pairs and not one of them moves — separation is exactly `0.00000` at rest and
through the whole clip. The metric therefore has no false-positive floor: it returns hard
zero on a healthy asset, so a non-zero reading is signal, not noise. It also establishes
that coherent seam binding is achievable in this pipeline, which makes the seven torn
actors a **regression, not a limitation**.

**The seam defect is independent of the rest-correction lane.** `ember-cohort` and
`possessed` — the only two actors carrying an un-rebaked rest correction — show the same
`L1 = 2.0000` pattern, and five actors with no rest correction show it too, while four
actors show neither. Seam-weight repair can therefore be scoped without touching inverse
bind matrices.

**One real interaction, small but do not trip over it.** `ember-cohort` and `possessed`
are the only actors with **non-zero REST separation** (0.00754 and 0.00808 × diag; 33 and
5 pairs beyond 0.5 % of diagonal). Every other actor is exactly `0.00000` at rest. This is
the un-rebaked-IBM signature: with `jointWorld × IBM ≠ I` (8.12° / 22.19°, §5), two
coincident vertices bound to disjoint bones already sit apart before any clip plays. The
static contribution is ~0.008 diag against 0.35–0.61 diag animated — roughly 1–2 % of
their total damage. Consequence for any future gate: **do not assert "rest separation == 0"**,
which would legitimately fail those two. Assert hard zero for the other nine and
"must not increase" for these two.

```bash
node /tmp/binding-diff.mjs http://127.0.0.1:4173 /tmp/binding-all.json <all 11 ids>
node /tmp/seam-probe.mjs   http://127.0.0.1:4173 /tmp/seam-all.json    <all 11 ids>
```

---

## 5. Hypothesis H is falsified — and here is where it *is* real

H predicted the shredding comes from Blender re-deriving armature rest from the inverse
bind matrices (`guess_original_bind_pose=True`, commit `53293208`). That mechanism is a
**no-op on these bytes**. Checking `jointWorldRest × IBM == identity` directly in the
glTF JSON chunk, with no Blender and no loader:

| bytes | worst deviation from identity | worst angle |
|---|---|---|
| `lantern-reaver` @current / @28016a40 / @6e2ab06d | 4.00e-07 / 4.00e-07 / 2.83e-07 | 0.0000° |
| `guard` @current / @28016a40 / @6e2ab06d | 1.63e-07 / 1.63e-07 / 3.55e-07 | 0.0000° |
| `scout` @current / @28016a40 / @6e2ab06d | 7.79e-07 / 7.79e-07 / 5.48e-07 | ≤0.025° |

IBM and authored rest agree to float noise in every generation, so a Blender import
would re-derive the *same* rest and change nothing. H cannot explain the runtime tearing,
and it cannot explain the original PNGs either, since the PNG-era bytes are equally
IBM-consistent.

H is nonetheless a real mechanism — just for different actors. Two assets *are*
IBM-inconsistent, and they are exactly the two the static-pose repair targeted:

| asset | worst deviation | worst angle |
|---|---|---|
| `ember-cohort` | 1.394e-01 | **8.1164°** |
| `possessed` | 3.777e-01 | **22.1940°** |

`possessed` reads **22.1940°**, byte-exactly the "22.194 deg" quoted in commit
`53293208`'s message, reproduced here by an independent pure-Python implementation. That
corroborates both the commit and `README-artifact-provenance.md`'s statement that the
repair deliberately leaves IBMs unrebaked. Those two actors would be re-posed by a bare
Blender import; `lantern-reaver`, `guard` and `scout` would not.

---

## 6. Timeline — the tearing regression, and a commit whose name is wrong

Same seam metric, run against bytes extracted from git (`git show <sha>:<path>`), served
by Playwright route interception so nothing was written into the repo:

| asset | `6e2ab06d` 07-29 22:28 (PNG-era) | `28016a40` 07-30 01:55 *"fix: prevent character mesh animation tearing"* | `2359578b` 07-30 05:49 (**current**) |
|---|---|---|---|
| `lantern-reaver` | **0.066** | 0.476 | **0.475** |
| `guard` | **0.084** | 0.216 | **0.241** |
| `scout` | **0.096** | 0.314 | **0.314** |
| `lantern-reaver` verts | 5437 | 5617 | 5617 |

The commit named *"fix: prevent character mesh animation tearing"* is where seam
separation **increased ~7× on `lantern-reaver`** (0.066 → 0.476), ~2.6× on `guard` and
~3.3× on `scout`. It also added ~180 vertices per asset — i.e. it split *more* seams —
and raised fully-disjoint pairs from 6 to 425 on `lantern-reaver`. Its name states an
intent that its bytes do not deliver. The current assets carry that state essentially
unchanged.

Note the consequence for the original PNGs: the bytes they were rendered from tear the
*least* of any generation in the three.js runtime (0.066), yet the PNGs show catastrophic
shredding. So the PNG's shredding was **not** produced by the runtime path measured here.
The directory name `blender-rebuild-final` suggests those images are of a Blender
*rebuild* of the asset rather than of the shipped GLB; that intermediate is not in git and
I could not recover it, so I state this as an open loose end rather than a conclusion.

---

## 7. Corrections to prior art

1. **`GLTFLoader` *does* call `normalizeSkinWeights()`.**
   `joint-repair-runtime-verification.md` §2 states it does not. In this vendored r185
   copy it is called unconditionally for every skinned mesh — `vendor/loaders/GLTFLoader.js:3850-3855`.
   Post-load weight sums therefore cannot evidence authored weight quality; they are the
   loader's output. All authored weight figures in §2 above are read from the raw
   `WEIGHTS_0` accessor instead. (It happens to be a no-op here — the authored sums were
   already normalized to 2.98e-08 — but the reasoning was unsound.)

2. **The asset structure has moved again.** The mesh-count tables in §7 and §8 of that
   document record `lantern-reaver` 67 meshes / 5436 verts, `guard` 35 / 5325,
   `scout` 1 / 5443. The current bytes are **9 primitives for every asset**, 5617 / 5504 /
   5677 verts, verified by SHA-256 in §1b. Those tables describe a generation that no
   longer exists on disk, and citing them for the current bytes will mislead: all three
   actors are now structurally identical, so mesh counts cannot distinguish them at all.

3. **`scout` is not a known-good control.** It tears at 0.314 × diagonal, between the two
   assets under suspicion. Any future comparison that treats it as a clean reference will
   understate the defect.

---

## 8. Visual evidence

Rendered through the runtime's own `GLTFLoader` materials and the runtime light rig
(`HemisphereLight(0xfff2d6, 0x140a06, 1.1)` + `DirectionalLight(0xffd9a8, 1.6)` at
`(2,4,3)`, `battle-realtime-three.js:3257-3260`). Files in `current-bytes/`.

The `reframed-*` set re-aims the camera at the **posed** bounding box at capture time with
a generous near plane; the `current-*` set uses one fixed bind-pose framing. Both are kept
deliberately — see §9.

> **Do not judge cross-asset severity from the `current-*` set.** Its single fixed framing
> makes apparent zoom differ per asset, and at that scale `scout`'s fragments are small
> enough that `current-scout-attack-mid.png` reads as intact. It is not — see
> `reframed-scout-attack-mid.png` and the 0.314 × diag seam separation in §4. Only the
> camera-independent seam number in §4 supports ranking these assets against each other.

| file | what it shows |
|---|---|
| `reframed-lantern-reaver-rest.png` | **intact.** Clean textured T-pose, hood, cloak, boots all coherent. |
| `reframed-guard-rest.png` | **intact.** Clean armored T-pose. |
| `reframed-scout-rest.png` | **intact.** Clean textured T-pose. |
| `reframed-lantern-reaver-attack-mid.png` | **shredded.** Torso torn into radiating shards, one fragment fully detached and floating clear of the body; boots and lower legs intact. |
| `reframed-guard-attack-mid.png` | **shredded.** Torso and pelvis collapsed into overlapping plates, forearm separated from the arm. |
| `reframed-scout-attack-mid.png` | **partially shredded.** Body and limbs hold together; cloak and torso shed a scatter of detached fragments. Clearly damaged, clearly less than the other two. |
| `*-attack-f24.png` | same conclusions at an earlier frame. |
| `reframed-guard-attack-mid-side.png` | **fully disintegrated, legs included.** Contradicts the front view of the same pose. |

**Corrected — the failure is not confined to the upper body.** An earlier revision of this
section generalised the per-asset rows above into "upper body torn, legs and boots intact,"
matching the original PNGs. `reframed-guard-attack-mid-side.png` refutes it: from the second
azimuth `guard` is disintegrated throughout, legs included, and the front framing simply hid it.

The per-asset rows stand as written — they describe what each specific image shows. The
generalisation drawn from them does not, and it is the same error twice over: judging the extent
of the defect from whichever camera angle a render happened to use. §9 records the scale version
of this hazard; this is the azimuth version. Nothing here supports per-bone-group localisation,
so no diagnosis should lean on "the fault spares the legs."

---

## 9. Where visual and numeric disagreed, and how it resolved

They disagreed twice. Both are recorded because both would have produced a wrong verdict.

**Disagreement 1 — numbers said healthy, eyes said destroyed.** Displacement ratio 0.52
for `lantern-reaver` versus a render of obvious debris. I did not pick a side; I looked for
a confound in each. The render's confound was real but not sufficient: the first pass framed
the camera on the *bind* bbox with `near = 0.02 × radius` and never moved it, so a clip
lunging toward the lens could clip geometry and counterfeit shredding exactly. I re-rendered
with the camera reframed on the CPU-skinned **posed** bbox and a near plane guaranteed clear
of the subject. **The shredding survived** — so it is geometry, not clipping. The numeric
side's confound was then the real one: displacement is the wrong observable (§3).

**Disagreement 2 — I nearly mis-cleared the control.** At the first fixed framing `scout`
looked intact and I came close to writing "control healthy, two assets broken". At matched
close framing it visibly sheds fragments, and the seam metric puts it at 0.314. My initial
read was confounded by apparent scale: the reframing zoom differs per asset because the posed
bboxes differ, so severity cannot be judged across these images by eye. Only the
camera-independent seam number supports a cross-asset ranking.

After both were resolved, visual and numeric **agree**: all three tear, `lantern-reaver`
worst, `guard` and `scout` less so, and rest is clean everywhere.

---

## 10. Probe bugs

Avoided, as required:

1. **Bone-name sanitisation** — all target names come from `clip.tracks[n].name`; no
   authoring name is ever looked up. 22/22 tracks resolve on all three assets, so this
   never silently zeroed anything.
2. **`mixer.setTime()`** — never called. Every pose comes from `mixer.update(1/60)` in a
   loop, as the render loop does.
3. **`Box3.setFromObject` on a `SkinnedMesh`** — never used for motion. Every position in
   this document is CPU-skinned per vertex. The one place a posed bounding box was needed
   (camera reframing, §9) computes it from skinned vertices explicitly for this reason.

**The one I nearly hit** was #3's family, in a new disguise: framing the camera from the
**bind-pose** bbox. It is the same underlying error — treating a bind-pose quantity as if it
tracked the animation — and it very nearly produced a false *positive* (near-plane clipping
read as shredding), where the documented version produces false negatives. Ruling it out
took a second render pass.

Two further ways to get this wrong, new to this pass:

4. **Max displacement vs bind is blind to shredding.** Bounded-magnitude, incoherent motion
   keeps every vertex inside ~0.5 × the diagonal while the surface rips. It rated the worst
   asset as the healthiest of three.
5. **Edge stretch scores authored cloth as damage.** It rated the least-damaged asset worst,
   and cannot see a tear between coincident vertices that share no edge — the dominant
   failure mode here.

Running total of ways to "prove" a rig is fine when it is not, or broken when it is not:
sanitized bone names, `setTime()` without `update()`, bind-pose bounding boxes, bind-pose
*camera framing*, max-displacement magnitude, and edge stretch.

---

## 11. Reproduce

```bash
python3 -m http.server 4173 --bind 127.0.0.1          # from the repository root

# authored weights + IBM consistency, no browser, no Blender
python3 /tmp/raw-payload-probe.py lantern-reaver guard scout

# runtime load, clips, bone travel, displacement ratio, screenshots
node /tmp/runtime-skin-probe.mjs http://127.0.0.1:4173 /tmp/current-bytes.json \
     _workspace/current/qa/blender-rebuild-final/current-bytes current lantern-reaver guard scout

# posed-bbox reframed renders (rules out near-plane clipping)
node /tmp/reframe-render.mjs http://127.0.0.1:4173 \
     _workspace/current/qa/blender-rebuild-final/current-bytes /tmp/reframe.json reframed \
     lantern-reaver guard scout

# the decisive metric
node /tmp/seam-probe.mjs   http://127.0.0.1:4173 /tmp/seam.json   lantern-reaver guard scout
node /tmp/binding-diff.mjs http://127.0.0.1:4173 /tmp/binding.json lantern-reaver guard scout
```

Probe sources are in `/tmp` and are throwaway; they were kept outside the repository
because this task was scoped read-only. Raw results: `/tmp/current-bytes.json`,
`/tmp/seam.json`, `/tmp/seam-hist.json`, `/tmp/seam-all.json`, `/tmp/binding.json`,
`/tmp/binding-all.json`, `/tmp/reframe.json`, `/tmp/localize.json`.

---

## 12. What this does and does not license

- The repair target is **seam binding coherence**: coincident vertices must share their
  bone bindings. It is *not* the rest pose, and it is *not* the inverse bind matrices,
  which are consistent to 1e-7 on all three measured assets.
- **Scope is settled by §4b: the seam defect is independent of the rest-correction lane.**
  It appears in five actors that carry no rest correction and is absent in four others, so
  seam weights can be repaired without touching inverse bind matrices.
- **Four actors are already correct** (`broken-court-monarch-boss`, `broken-court-monarch-v04`,
  `shadow-commander-boss`, `shadow-soldier-v04`) and are the reference for what a correct
  result looks like: separation exactly `0.00000` across 12078 / 2755 / 6720 / 4691
  coincident pairs. Any repair should reproduce that, and should be validated against these
  four as negative controls to catch a fix that damages healthy assets.
- Weight normalization is already correct (2.98e-08) and is not the defect.
  `scripts/gate-joint-weight-repair.py --check` passing 11/11 is therefore true and
  irrelevant to this failure — the gate does not measure seam binding agreement, which is
  why a fully torn asset passes it. That is the gap worth closing, and §4b's numbers are
  directly usable as the gate's contract.
- A gate must **not** assert "rest separation == 0" universally. That holds for nine actors
  but legitimately fails `ember-cohort` (0.00754) and `possessed` (0.00808), whose static
  offset is the un-rebaked rest correction interacting with disjoint seam bindings. Assert
  hard zero for the nine and "must not increase" for those two.
- `ember-cohort` and `possessed` carry a genuine IBM/rest inconsistency (8.12°, 22.19°) and
  must **not** be "fixed" by rebaking their IBMs; per
  `README-artifact-provenance.md` that would null the static-pose repair and corrupt 110
  baked clips. That lane stays separate from the tearing described here.
- Whether to repair the current bytes, re-derive them from `6e2ab06d`'s binding, or
  regenerate upstream is not decided here. This document establishes only that the defect
  is real, is in the shipped bytes, is in the runtime rather than in a preview tool, affects
  7 of 11 actors, and entered at `28016a40`.
