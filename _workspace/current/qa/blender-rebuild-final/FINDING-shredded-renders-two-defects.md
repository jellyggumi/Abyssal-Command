# Finding — two separate defects, only one of which was the importer

run-id: `20260728-onslaught-action-pivot`
status: `[OBSERVED]` — every number below carries the command that produced it
scope: explains `guard-attack-mid.png`, `lantern-reaver-attack-mid.png`,
`lantern-reaver-attack-rest.png`, `lantern-reaver-attack-mid-torso-reassigned.png`

---

## 1. Verdict — corrected mid-investigation

This document began as "the renders are an importer artifact, the assets are fine." Runtime
renders of the **current** bytes contradicted the second half of that, so the verdict is split:

| claim | status |
|---|---|
| Blender's importer re-derives armature rest from IBMs and shredded these renders | **holds** (§2, §6) |
| the REST pose is healthy in the current bytes | **holds** — `current-bytes/current-guard-rest.png` is a clean T-pose |
| the shipped assets are therefore fine | **FALSE for the animated pose** (§1.1) |

### 1.1 Every actor shreds under animation, in the runtime, with current bytes

Rendered through the runtime's own `GLTFLoader` under `mixer.update(1/60)` — no Blender
involved, so the importer flag cannot be the cause:

| actor | rest | attack mid |
|---|---|---|
| `scout` | intact | **shredded** |
| `guard` | intact | **shredded** |
| `lantern-reaver` | intact | **shredded** |

Evidence: `current-bytes/reframed-{scout,guard,lantern-reaver}-{rest,attack-mid}.png`. Use the
`reframed-` set, not the wider `current-` set — see §1.1b for why the wide framing misleads.

There is **no intact control among these three**. The failure is not specific to an actor, a rig
shape, or a weight profile: rest is clean everywhere and the animated pose comes apart everywhere.

It is also not the single-influence regression the prior lane chased. Today's gate reports
`guard inf1 31 (0.6%)` and `lantern-reaver inf1 1090 (19.4%)` with normalized sums (§4), so the
weights are multi-influence and the mesh comes apart regardless.

The user's original report — that the rig's motion animation crumples the mesh — is **correct, and
universal across the actors tested.** The timestamp evidence in §2 explains the five-day-old PNGs;
it does not excuse this.

### 1.1a Retracted: "rig shape is the discriminator" `[MEASURED — FALSE]`

An earlier revision asserted `scout` was a single-mesh multi-influence rig while `guard` had 35
part-split meshes and `lantern-reaver` 67, and concluded rig shape was the discriminator. **Both
halves were wrong.** The counts came from `joint-repair-runtime-verification.md` §7, which
described an older generation of bytes, and were committed without re-measurement.

Measured from the GLB JSON chunks directly:

| actor | mesh nodes | skins | skinned nodes | joints | clips | IBM basis-column norms | joints with non-identity rest |
|---|---|---|---|---|---|---|---|
| `scout` | 9 | 1 | 9 | 24 | 11 | 1.0000–1.0000 | 13 / 24 |
| `guard` | 9 | 1 | 9 | 24 | 11 | 1.0000–1.0000 | 13 / 24 |
| `lantern-reaver` | 9 | 1 | 9 | 24 | 11 | 1.0000–1.0000 | 13 / 24 |
| `ember-cohort` | 9 | 1 | 9 | 24 | 11 | — | — |
| `possessed` | 9 | 1 | 9 | 24 | 11 | — | — |

All five are structurally identical. `scout` is 12510880 bytes, `lantern-reaver` 12510868 — a
12-byte difference. There was never a rig-shape split to find, which is consistent with §1.1:
the failure is universal, so nothing needed to discriminate it.

No hypothesis about per-part `inverseBindMatrices` mismatch is asserted. A previous revision named
one; it was inference dressed as a finding, and the structural measurement above removed its only
support.

### 1.1b Camera framing hid the failure on one actor `[OBSERVED]`

Worth recording as a measurement hazard, because it produced a wrong committed claim.

`current-scout-attack-mid.png` frames the figure small. At that distance scout's shards read as
authored cloak tatters — the actor's rest pose genuinely has a ragged hem — and the render looks
intact. `reframed-scout-attack-mid.png` frames the same pose closer and shows the torso split into
floating fragments, the same failure as the other two.

This is a fourth entry in the running list of ways to misjudge a rig, alongside the three in
`joint-repair-runtime-verification.md` (sanitized bone names, `setTime` without `update`,
`Box3.setFromObject` on a SkinnedMesh reading bind pose): **a wide camera on an actor with authored
raggedness makes shredding look like art direction.** Judge deformation on tight framing, or better,
on per-joint world displacement rather than by eye.

### 1.2 What must NOT be done about it

Rebaking the IBMs to make Blender agree would be a regression: glTF skinning is
`jointWorld × IBM`, so leaving the IBMs at the pre-repair pose is exactly what applies the rest
correction at runtime. `scripts/repair-static-rest-pose.py:4-9` states the contract — only
`nodes[i].rotation` is edited; the BIN chunk, accessors, IBMs and all baked samplers are copied
through verbatim. Rebaking would make the repair a visual no-op in the runtime **and** corrupt
all 110 baked clips. Any fix for §1.1 has to be scoped to the part-split rigs' own bind data,
not applied to the rest-correction mechanism.

## 2. The images predate the fix by four days

| artifact | timestamp | source |
|---|---|---|
| all four PNGs | 2026-07-30 01:30–01:35 | `ls -l --time-style=+%m-%d_%H:%M` |
| `lantern-reaver/model.glb`, `guard/model.glb` regenerated | 2026-07-30 **02:57** | same |
| importer fix `53293208` authored | 2026-08-03 **21:08:11 +0900** | `git log -1 --format=%cI 53293208` |

`git merge-base --is-ancestor 53293208 HEAD` → **yes**. The fix is in `main`.

So the images were taken 87 minutes before the assets they depict were replaced, and four days
before the importer bug that produced them was fixed.

## 3. What the old images do and do not say

Holds:

- `lantern-reaver-attack-rest.png` is shredded **at rest**. A rest pose has no animation applied,
  so for those old bytes the clips were not the cause. (Rest is intact in the current bytes — §1.1.)
- `lantern-reaver-attack-mid.png` and `-torso-reassigned.png` are visually indistinguishable, so an
  earlier "torso reassigned" repair attempt changed nothing.
- `guard-attack-mid.png` is a different actor with the same failure, so it was never
  character-specific.

**Retracted — "the legs and boots stay intact while the torso shreds"** `[MEASURED — FALSE]`.
That was stated early in this investigation from the original PNGs and it is a camera-angle
artifact. `current-bytes/reframed-guard-attack-mid-side.png` shows guard disintegrated completely,
legs included; the front view hid it. There is no per-bone-group localisation to reason from, and
any diagnosis that leaned on "the fault is confined to the upper body" is unsupported.

Both retractions in this document (§1.1a and this one) came from believing a render at the framing
it happened to be taken at. The lesson is recorded in §1.1b.

## 4. Current asset state `[OBSERVED]`

```
$ python3 scripts/gate-joint-weight-repair.py --check
broken-court-monarch-boss  ... inf1 3813 (12.5%) sumErr 2.98e-08 [PASS]
broken-court-monarch-v04   ... inf1 1069 (16.7%) sumErr 2.98e-08 [PASS]
ember-cohort               ... inf1  804 (13.7%) sumErr 2.98e-08 [PASS]
guard                      ... inf1   31 ( 0.6%) sumErr 2.98e-08 [PASS]
human-command-boss         ... inf1  793 (14.8%) sumErr 2.98e-08 [PASS]
lantern-reaver             ... inf1 1090 (19.4%) sumErr 2.98e-08 [PASS]
possessed                  ... inf1   18 ( 0.3%) sumErr 2.98e-08 [PASS]
scout                      ... inf1  807 (14.2%) sumErr 2.98e-08 [PASS]
shade                      ... inf1 1198 (21.0%) sumErr 2.98e-08 [PASS]
shadow-soldier-v04         ... inf1  868 ( 3.9%) sumErr 2.98e-08 [PASS]
shadow-commander-boss      ... inf1 2337 ( 9.3%) sumErr 2.98e-08 [PASS]
```

11/11 PASS, weight sums normalized. Note this gate measures **weights only** — it passed while
these PNGs showed a shredded mesh, so weight health was never the discriminator for this symptom.

## 5. What produced the PNGs

Not the tracked contact-sheet tool. Identified from the PNG bytes rather than by grep: all four
carry Blender's `File/Date/Time/Frame/Camera/Scene/RenderTime` tEXt chunk set at 800×800 with
`File=<untitled>` (a never-saved `.blend`, i.e. a headless run) and cameras
`guard_qa_camera` / `lantern-reaver_qa_camera` / `qa_camera`.

`qa_camera` appears in **no tracked text file**; `git log -S qa_camera` returns exactly one
commit (`2359578b`) whose hits are inside binary `character-motion-library/*/review.blend`. No
tracked script sets 800×800, and
`_workspace/current/engineering/asset-pipeline/tools/render-character-motion-contact-sheet-blender.py`
names its output `keyposes/NN-action.png` and burns a text label into every frame — these PNGs
carry no label.

Conclusion: an ad-hoc headless Blender invocation against the staged `review.blend` scenes. The
renders are therefore not reproducible from a tracked entry point, which is why this finding
relies on the timestamps and the importer semantics rather than on re-running them.

## 6. The live defect this investigation found

The fix in `53293208` was correct but covered **3 of 16** `import_scene.gltf` call sites, and the
regression guarding it enumerated a hand-written two-file list
(`BIND_POSE_TOOLS`), so it passed 53/53 while thirteen call sites were still bare.

### Smoking gun — `scripts/retarget-ingame-motion-blender.py`

This module read the same target rig's rest pose two disagreeing ways:

| path | how | used for |
|---|---|---|
| A | `import_gltf()` at `:190-193`, **bare** → Blender re-derives rest from IBMs | posing and export (`:1212`, `:1278`) |
| B | `_reference_rest_quaternions()` at `:633-636`, pure Python `node.get("rotation")` | rebasing after export (`:1291`) |

Clips were posed against an IBM-derived rest and then rebased against a `node.rotation` rest. On
a rest-corrected rig those two differ and **the mismatch was written into the shipped motion
pack** — the same 22.194° vs 0.0° discrepancy `53293208` measured.

### Blast radius — latent, not currently firing

`motion-bench/static-pose-repair-gate.json` records `policyDecision=focused-ember-cohort-and-possessed`,
`actors=2`, `failures=0`, `unlistedDrift=0`. Only `ember-cohort`, `possessed` and the certified
target rig carry an un-rebaked rest correction. For the other 22 actors the IBM-derived rest still
equals the `node.rotation` rest, so a bare flag is a **silent no-op today**. It arms itself the
moment the repair scope widens.

That is why this was worth fixing now rather than after it started producing corrupt output.

## 7. Fix applied — script side only, no asset bytes touched

`guess_original_bind_pose=False, bone_heuristic="BLENDER"` pinned at all 16 call sites:

| group | files |
|---|---|
| writers (would bake the corruption into an export) | `retarget-ingame-motion-blender.py`, `author-wholebody-clips-blender.py`, `bind-static-lower-mesh.py`, `apply-cartoon-texture-blender.py` |
| measurement / render (would report or show a rig the runtime never loads) | `measure-deformation-gate.py`, `audit-character-deformation-blender.py`, `audit-glb-angle-readiness.py`, `audit-mesh-detail-blender.py`, `render-clip-frames.py`, `render-pose-contact-sheet.py`, `qa/motion-repair-20260803/scratch/blender-spine-probe.py` |
| rig-from-scratch (flag provably inert) | `rig-character-asset-blender.py`, `rig-and-animate-asset-blender.py` |
| already correct before this pass | `measure-joint-articulation.py`, `derive-kinematic-bounds-blender.py`, `render-character-motion-contact-sheet-blender.py` |

`measure-deformation-gate.py` deserves a note: its docstring said "deterministic options" while
omitting the one option that determines the rest pose. It passed `import_materials`,
`import_cameras` and `import_lights` but not this flag.

The two rig-from-scratch tools discard the imported armature — `rig-character-asset-blender.py:340-342`
removes every `ARMATURE`/`EMPTY` and clears the body's vertex groups; `rig-and-animate-asset-blender.py:125`
keeps only `MESH` objects from raw marching-cubes output. Verified by reading both. The flag is
pinned there anyway so the contract needs **no exception list**, and a future edit that starts
keeping the imported armature cannot silently reintroduce the defect.

## 8. The regression now discovers call sites instead of listing them

`kinematic-gate-world-pose-audit.test.mjs` walks `scripts/`, the pipeline `tools/` directory and
`qa/motion-repair-20260803/scratch/`, collects every `.py` containing `import_scene.gltf(`, and
requires the flag at every call site. It also asserts it discovered at least 14 such files, so a
broken walk fails loudly instead of passing vacuously.

Proven non-vacuous: reverting exactly one call site to the bare form makes the suite exit 1 with
`# fail 1` and name the offender `scripts/render-clip-frames.py:48`. The file was then restored
byte-identically.

```
$ node --test .../kinematic-gate-world-pose-audit.test.mjs
# tests 53
# pass 53
# fail 0
```

## 9. What this finding does and does not establish

Established:

- The importer defect is real, was the cause of these five-day-old PNGs, and is now pinned at all
  16 `import_scene.gltf` call sites with a discovery-based regression proven non-vacuous (§6–§8).
- The animated pose of the part-split rigs is broken **today, in the runtime, with current
  bytes** (§1.1). That is a separate, live defect.

Not established, and deliberately not asserted:

- **The cause of §1.1.** Rig shape correlates perfectly across three actors, and a per-part
  IBM-versus-clip-rest mismatch is the leading hypothesis, but no measurement here isolates it.
  Do not act on that hypothesis without the numbers.
- No fix for §1.1 is included in this pass. The script fix does not address it and was never
  going to: it prevents Blender-side tools from *reporting* a re-derived rig, which is a
  different failure from parts separating under animation in the runtime.
- The four original PNGs are not re-rendered. Their producing invocation is untracked (§5).
- The 22 actors outside the repair scope make the `retarget-ingame-motion-blender.py` defect
  latent today. No shipped motion pack is asserted to be currently corrupt — the claim is that
  the path could write one.

## 10. Correction log

This document asserted in its first draft that the shipped assets were fine and the renders were
purely an importer artifact. That was written before the current-bytes runtime renders existed.
The renders refuted it for the animated pose within the same session, and §1 was rewritten rather
than quietly amended. The original filename
(`FINDING-shredded-renders-are-an-importer-artifact.md`) encoded the half-true conclusion and was
renamed for the same reason.
