# Character Asset Root Cause — director direct measurement (2026-07-25)

Sources of evidence, all reproducible this session:
- Direct GLB binary parse (JSON chunk + accessor walk) of all 51 GLB in `assets/images/battle/glb/`.
- The rig pipeline's own reports, `/tmp/rig-staging/reports/*.json` (24 files).
- Blender front-ortho renders of all 51 GLB: `blender -b -P scripts/render-pose-contact-sheet.py -- --out /tmp/pose-audit --res 384`.
- Run-cycle deformation frames: `blender -b -P scripts/render-clip-frames.py -- --glb <path> --clip run --frames 1,20,40,60 --out /tmp/clips/<id>`.
- Code read of `battle-realtime-three.js` and `scripts/rig-all-characters.sh`.

Rig world positions use full TRS matrix composition (parent rotation included).

## Corrections issued during this audit

Two earlier readings in this session were wrong and are retracted here rather
than quietly amended:

1. **"The pedestal is skinned to pelvis/spine and swings with the hips."**
   WRONG. The plinth is an unskinned separate mesh. It never deforms.
2. **"The rig floats — foot bone at 12–49% of mesh height on 20 models."**
   WRONG. That measured against *total* height (body + plinth). Measured against
   **body** height, the foot bone sits at **exactly 6% on all 24 models**. The
   rig is correctly fitted to the body on every character, plinth cohort
   included. `bodyY0 == pedestalTop` on every plinth model — the body sits on
   the slab and the rig sits in the body.

What follows is only what survived re-verification.

## D1 — T-pose normalization silently no-ops on 23 of 24 models

From the pipeline's own report (`guard.json`, representative):

```json
"tpose_apply": { "rotatedDeg": {}, "axisDeviationDeg": {"L": 79.81, "R": 64.14}, "tolerance": 12 },
"tposeOk": false
```

- `tposeOk: false` on **23 of 24**. Only `pack-herald` passes (10°/12°).
- Arm axis deviation **33°–96°** against a **12°** tolerance. Worst:
  `gate-sovereign` 96°, `veil-tactician` 94°, `tide-warden` 91°, `scout` 87°.
- `rotatedDeg` is `{}` on **every** model — the step measures the deviation and
  applies no correction.
- The Blender renders show why: the source sculpts are statue/action poses —
  arms spread, weapons raised, cloaks flared — not T-poses.

**Why it ships anyway:** `scripts/rig-all-characters.sh:47-58` gates on the
Blender process exit code only. A model whose own report says `tposeOk: false`
still prints `OK` and is copied into the runtime tree by `--install`.
`tests/character-rig-contract.test.mjs` passes 24/24 because it asserts weight
*shape*, not pose validity.

**Consequence:** bind poses deviate from the animation authoring assumption.
This is the defect most likely to explain any limb deformation seen in play,
but the visible severity is unmeasured here — VisualG4 owns that call.

## D2 — the renderer scales characters by their plinth

`fitHeight()` (`battle-realtime-three.js:462-475`) scales an actor so its whole
`Box3` height equals the class target, then drops `box.min.y` to the ground.
The box includes the plinth, which is part of the same GLB.

So the **visible character** is scaled down by exactly the plinth's share of
total height:

| model | body h | plinth h | character renders at |
|---|---|---|---|
| pack-herald | 1.02 | 0.88 | **54%** of intended |
| abyss-regent | 1.05 | 0.82 | **56%** |
| requiem-choir | 1.06 | 0.82 | **56%** |
| pack-warden | 0.97 | 0.68 | **59%** |
| cinder-warden | 1.20 | 0.68 | 64% |
| anchor-shard | 1.21 | 0.69 | 64% |
| guard | 1.14 | 0.46 | 71% |
| dawnless-crown, scout | | | 76% |
| … 12 more between 79% and 94% | | | |
| gate-sovereign, lantern-tyrant, tide-warden, veiled-concordat | — | none | **100%** |

**54%–100% — a 46 percentage-point spread across characters authored to the same
class height.** A boss can render shorter than a companion. This is a renderer
bug, not an art bug, and it is the most player-visible of the confirmed defects.

## D3 — 24% of all character geometry is inert plinth

The plinth is a separate named mesh (`<id>_pedestal`), unskinned, present in
**20 of 24** characters. `scripts/rig-character-asset-blender.py:770-784`
deliberately preserves and re-exports it.

**134,969 of 563,249 character triangles (24%)** never animate and serve no
gameplay purpose. Worst self-ratios: `abyss-regent` 58% of its own triangles are
plinth, `requiem-choir` 53%, `pack-warden` 46%, `pack-herald` 43%,
`cinder-warden` 43%.

## D4 — animation authored at two sample rates; 4 stage bosses got the sparse one

Clip *durations* are identical across both cohorts (idle 5.00s, attack 3.75s,
avoid 1.75s …), so this is pure sample-rate loss, not different choreography.

| clip | 20 models | gate-sovereign, lantern-tyrant, tide-warden, veiled-concordat | ratio |
|---|---|---|---|
| idle | 11.0 | **1.2** | 9.2x |
| move | 22.4 | 8.8 | 2.5x |
| attack | 23.1 | 7.5 | 3.1x |
| die | 19.5 | 5.9 | 3.3x |
| **average kf/bone/s** | **20.87** | **6.73** | **3.1x** |

`idle` at 1.2 kf/bone/s is ~6 keyframes across a 5-second loop. Idle is what a
player watches longest — a boss idles while its adds are cleared. All four are
stage bosses, i.e. 40% of the campaign's climax encounters.

These same four are the only plinth-free, correctly-scaled models. The two
source pipelines each got right what the other got wrong.

## D5 — the player's own avatar is a placeholder

`commander/dusk-warden.glb`: **1,002 body triangles** — a cone body, sphere
head, crown spikes. Every other character is 8,676–39,264 body triangles.

| class | body tris | screen time |
|---|---|---|
| boss | 14,987–39,264 | one, late in a stage |
| enemy | 11,043–13,690 | many, continuous |
| companion | 8,676–13,705 | up to 3, continuous |
| **commander (player)** | **1,002** | **always, center-frame, camera-followed** |

It is also the only model carrying the canon 4-colour palette
(`#3e305c` / `#30acd5` / `#dcc768` / `#72788f`).

## D6 — the cast has no material identity

- `textures: 0` on **all 51 GLB** in the project.
- `materials: 1` on 23 of 24 characters. Only `dusk-warden` has 4.
- Every non-commander character is one desaturated mauve: `#a9809f`, `#aa7b85`,
  `#9a5c78`, `#a673ad`, `#77507e`, `#af8886`, `#d4aded`, `#888595`, `#b1b0cf`,
  `#7976b3`, `#8e7684`, `#8b789d`, `#b36174`, `#a484a3`, `#9e6f7f`, `#ad77c6`,
  `#d4b6c4`, `#8f9fae`, `#8e8289`, `#b476af`, `#8873a1`, `#9760a2`.

The renderer applies GLB materials directly (it only adds a PMREM environment,
`battle-realtime-three.js:682-812`), so this flat mauve is exactly what ships.
A 39,000-triangle boss and a 13,000-triangle trash enemy read as the same
untextured pink mass. Silhouette is the only identity channel, and the palette
distinguishes neither faction, threat tier, nor role. VisualG4 owns the
at-distance readability verdict.

## What is NOT wrong

Stated explicitly so a later cycle does not re-litigate it:
- **Rig fit is correct on all 24.** Foot bone at 6% of body height, uniformly.
- **Weight distribution is healthy.** Top-weighted bone 8.1–16.6% on 23 of 24
  (`pack-herald` 24.1%, still under the contract test's bar). The "one bone owns
  half the mesh" defect the rig contract test was written against is genuinely
  fixed.
- **Mesh quality is high.** The sculpts are detailed and characterful; the
  Blender renders show real silhouette variety and design intent.
- **All 51 GLB parse as valid glTF 2.0** with intact BIN chunks.
- **Full suite green:** `node --test 'tests/**/*.test.mjs'` → 209 pass, 0 fail,
  1 skip (documented lost fixture).

## Why the green suite missed all six

- `character-rig-contract.test.mjs` asserts skin presence, 11 clips, and weight
  shape. Not pose validity, not keyframe density, not plinth presence, not
  rendered scale.
- `rig-all-characters.sh` gates on process exit code, not on `tposeOk`.
- `fitHeight()` has no test asserting that the *character* — rather than the
  GLB bounding box — matches its class target height.

## Fix order (cheapest correct sequence)

1. **Exclude `<id>_pedestal` from the exported character GLB** (or skip it in
   `fitHeight()`'s measurement). Fixes D2's 46-point scale spread and D3's
   134,969 inert triangles in one change. The plinth is already a separately
   named mesh, so this is a lookup, not a segmentation problem. Highest value
   per unit work, touches no authored art.
2. **Make `tposeOk: false` fail the build.** Until `rig-all-characters.sh`
   refuses to `--install` a model whose own report failed, every re-run silently
   reinstalls D1.
3. **Re-author the 4 sparse bosses' clips at the 20.87 kf/bone/s baseline.**
   Pure re-bake; those rigs are correct and their clip durations already match.
4. **Normalize the source pose** so `tpose_apply` stops no-op'ing — needed for
   step 2 to pass rather than block everything.
5. **Give the cast material identity** (D6) and **replace the commander
   blockout** (D5). These need art authoring, not pipeline work.
6. **Extend `character-rig-contract.test.mjs`**: no `*_pedestal` mesh, keyframe
   density ≥15 kf/bone/s, `tposeOk` true, and rendered-height parity. Six
   defects survived a 209-test green suite; without these assertions this audit
   must be redone by hand every cycle.

Steps 1, 2 and 6 are pipeline/test work. Steps 3 and 4 are re-bakes. Step 5 is
art.
