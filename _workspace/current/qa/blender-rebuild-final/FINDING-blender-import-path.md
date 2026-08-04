# Finding — Blender glTF import path and `guess_original_bind_pose`

Scope as re-narrowed by Main mid-task: classify the 13 bare `import_scene.gltf`
call sites by whether pinning `guess_original_bind_pose=False` changes intended
behaviour. Main had already verified commit `53293208` is an ancestor of HEAD;
that is not re-derived here.

## 0. Producing script for the four PNGs — identified by render metadata

Nothing in the tree greps for the filenames, so identification came from the PNG
bytes themselves. All four carry Blender's render-metadata `tEXt` chunk set:

| file | Camera | Frame | Date |
|---|---|---|---|
| `guard-attack-mid.png` | `guard_qa_camera` | 022 | 2026/07/30 01:30:38 |
| `lantern-reaver-attack-mid.png` | `lantern-reaver_qa_camera` | 032 | 2026/07/30 01:30:38 |
| `lantern-reaver-attack-rest.png` | `qa_camera` | 000 | 2026/07/30 01:33:17 |
| `...-mid-torso-reassigned.png` | `qa_camera` | 032 | 2026/07/30 01:35:17 |

All 800x800, `File: <untitled>` (never-saved .blend => headless script run).

- These are **Blender** renders, not three.js/puppeteer captures.
- `qa_camera` does **not** appear in any tracked text file. `git log -S qa_camera`
  returns exactly one commit, `2359578b`, and the hits are inside **binary
  `character-motion-library/*/review.blend`** files — the camera is a saved
  object in the staged review scenes, not a string in a script.
- No tracked script sets 800x800 (`resolution_x = 800` matches nothing).
- The sibling directory `_workspace/current/qa/blender-rebuild/` holds
  `{actor}-attack-f045.png` — same actor/clip/frame naming family, same lane.

**Conclusion:** the producer was an ad-hoc/throwaway Blender invocation against
the staged `review.blend` scenes (lane owned by
`tools/build-character-motion-library-blender.py`, which is what writes
`review.blend`). It is **not** `render-character-motion-contact-sheet-blender.py`
— that tool names its output `keyposes/NN-action.png` and burns a text label into
every render via `label.data.body`; these four PNGs have no label. The exact
producing invocation is not recoverable from the tree. This does not block the
classification below, which is what the answer depends on.

## 1. Call-site inventory (16 non-archive sites: 3 pinned, 13 bare)

### Already pinned (`guess_original_bind_pose=False`)
- `scripts/measure-joint-articulation.py:118`
- `tools/derive-kinematic-bounds-blender.py:99`
- `tools/render-character-motion-contact-sheet-blender.py:361`

### (a) MEASURE / RENDER an existing rig — flag BELONGS, no behaviour change
These read a shipped rig and must agree with the runtime. glTF skinning is
`jointWorld x IBM`; the runtime honours `nodes[].rotation`. Any of these left
bare measures a rig Blender re-posed from the IBMs.

| site | note |
|---|---|
| `scripts/measure-deformation-gate.py:78` | see quote below |
| `scripts/audit-character-deformation-blender.py:451` | `def import_glb` — audit only |
| `scripts/audit-glb-angle-readiness.py:149` | audit only |
| `scripts/audit-mesh-detail-blender.py:214` | docstring: "never imports, modifies, or exports anything back"; reads `armature.data.bones` |
| `scripts/render-clip-frames.py:44` | render; picks up `ARMATURE` at :46 |
| `scripts/render-pose-contact-sheet.py:34` | render; picks up `ARMATURE` at :96 |
| `qa/motion-repair-20260803/scratch/blender-spine-probe.py:35` | probe, requires exactly one armature |

`measure-deformation-gate.py:76-83` is the sharpest case — it advertises
determinism while omitting the one option that determines rest pose:

```python
def import_glb(path: Path) -> None:
    """Import GLB file with deterministic options."""
    bpy.ops.import_scene.gltf(
        filepath=str(path),
        import_materials=False,
        import_cameras=False,
        import_lights=False,
    )
```

**Verdict (a): pinning the flag is strictly correct. It changes measured
numbers only where they are currently wrong.**

### (b) RIG / REBUILD from upstream — flag is a NO-OP, do not touch
The imported source has no armature to re-derive, or the armature is deleted
before use.

- `scripts/rig-character-asset-blender.py:316` — imports the Rodin source, then
  **deletes every armature** before rigging:

```python
    # A previously-rigged GLB re-enters with `<id>_body` / `<id>_pedestal`
    # already split. ... and drop the old armature -- its A-pose rest and
    # nearest-bone weights are exactly what this pass replaces.
    for o in list(bpy.data.objects):
        if o.type in {"ARMATURE", "EMPTY"}:
            bpy.data.objects.remove(o, do_unlink=True)
```

- `scripts/rig-and-animate-asset-blender.py:124` — keeps only meshes
  (`imported = [o for o in bpy.data.objects if ... o.type == "MESH"]`), raw
  marching-cubes input, builds its own rig.

**Verdict (b): flag is inert. Adding it is harmless but buys nothing. Blender's
guess is not "deliberate" here — it is discarded.**

### (c) WRITERS that import a PRE-RIGGED GLB, keep the armature, and re-export
This is the category that can bake corruption into a shipped asset. All three
are currently **bare**.

- `scripts/author-wholebody-clips-blender.py:457` — requires an armature
  (`raise AuthorError(...: no armature)`), authors pose channels **relative to
  rest**, then exports with `export_animations=True, export_skins=True` (:688-697).
- `scripts/bind-static-lower-mesh.py:331` — imports `row["runtimeSource"]`
  (the runtime GLB), requires body/static/**armature** (:335-337), transfers
  weights against it, re-exports.
- `scripts/apply-cartoon-texture-blender.py:346` — imports, selects
  `(root, armature, body)` (:362) and re-exports the armature.

**Verdict (c): pinning the flag is REQUIRED for correctness on any rest-corrected
actor.** Bare, Blender re-derives rest from the IBMs, the pass authors/binds
against that wrong rest, and the export bakes it in. This is the exact failure
mode the fix commit measured (22.194 deg vs 0.0 deg).

## 2. The sharpest instance: `retarget-ingame-motion-blender.py`

This one script reads the **same target rig's rest pose two different ways**, and
they disagree for any rest-corrected rig.

Path A — Blender, bare, so rest is re-derived from IBMs:
```python
def import_gltf(path: Path) -> None:      # :190
    bpy.ops.import_scene.gltf(filepath=str(path))   # :193
...
    import_gltf(target_rig)               # :1212  (then poses + exports :1278)
```

Path B — pure Python, reads the authored `node.rotation` the runtime honours:
```python
def _reference_rest_quaternions(path: Path) -> dict[str, list[float]]:   # :633
    json_doc, _ = parse_glb_json_and_bin(path)
    return {
        node["name"]: _quat_normalize_xyzw(node.get("rotation", [0.0, 0.0, 0.0, 1.0]))
```
called from `postprocess_rest_relative_deltas(out_glb, target_rig, ...)` at
`:1291`, immediately after the export.

So the clips are posed in Blender against an IBM-derived rest, then their
rest-relative deltas are rebased in post against a `node.rotation` rest. On a
rest-corrected rig those two references differ, and the mismatch is written into
the shipped motion pack. **`retarget` belongs in category (c) and is the
highest-value place to pin the flag.**

## 3. Blast radius today

`motion-bench/static-pose-repair-gate.json` records the applied repair:
`policyDecision: focused-ember-cohort-and-possessed`, `actors: 2`
(`ember-cohort`, `possessed`), `failures: 0`, `unlistedDrift: 0`.

Only those two actors (plus the certified target rig) carry a rest correction
whose IBMs were deliberately not rebaked. For the other 22 actors, IBM-derived
rest and `node.rotation` rest still agree, so the bare flag is a **silent no-op
today** — a latent trap that arms itself the moment the repair scope widens.

## 4. Not previously recorded

`BONE-MAPPING-MATRIX.md`, `PARSER-DEFECT-LOG.md`, `EXPORT-CONTRACT-LOCKED.md`
and `ROOT-MOTION-AUDIT.md` contain no match for `guess_original_bind_pose`,
`re-deriv`, `rest from IBM`, or `inverse bind`. This diagnosis is new to those
docs.

## 5. Regression coverage gap

`kinematic-gate-world-pose-audit.test.mjs:1740-1752` enforces the flag only over
a hardcoded two-entry `BIND_POSE_TOOLS` list. Every site in sections (a) and (c)
is outside that list and therefore unguarded.

## 6. Bottom line

- **Asset change: NO.** The shipped GLBs are correct for the three.js runtime.
  `repair-static-rest-pose.py:4-9` states the contract — only `nodes[i].rotation`
  is edited; "the inverse bind matrices and all baked animation samplers are
  copied through verbatim". Rebaking IBMs to satisfy Blender would make the
  repair a visual no-op in the runtime and corrupt the baked clips.
- **Script change: YES.** Pin `guess_original_bind_pose=False` on category (a)
  and category (c). Category (b) may be left alone.
- Priority order: `retarget-ingame-motion-blender.py:193` (writes the shipped
  motion pack, and self-contradicts), then the other (c) writers
  (`author-wholebody-clips`, `bind-static-lower-mesh`, `apply-cartoon-texture`),
  then the (a) measurement tools, then widen `BIND_POSE_TOOLS`.
