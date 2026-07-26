# Character Rig Contract Baseline

**Audit mode:** read-only. No source, test, or GLB was changed.

## Exact focused-test result

```sh
node --test tests/character-rig-contract.test.mjs
```

Observed on 2026-07-26: **24 tests passed; 0 failed, skipped, cancelled, or todo** (196.175 ms).

The test currently covers the 24 actor files in its local `CHARACTER_GLBS` list. It verifies that each has at least one skin, at least 12 joints in `skins[0]`, all required action-key *names*, no `neutral` joint name, a top aggregate joint-weight share below 40%, and at least 10% aggregate arm-chain weight.

## Deployed runtime inventory and structural facts

The renderer's current `BOSS_MODELS`, `ENEMY_MODELS`, `COMPANION_MODELS`, and `COMMANDER_MODEL` resolve exactly the same **24 paths** as `CHARACTER_GLBS`: comparison produced `runtimeOnly: []` and `testOnly: []`.

Directly parsed glTF JSON/BIN facts for every mapped actor:

- each has **1 skin**, **24 joints**, and **1 skinned mesh node**;
- each has **11 animations**;
- every animation has **72 channels**, targets **all 24 skin joints**, and contains `translation`, `rotation`, and `scale` target paths.

| Deployed GLB | Rest elevation L / R | T-pose gate (both <= 12°) |
|---|---:|---:|
| `commander/dusk-warden.glb` | 23.75° / 76.00° | FAIL |
| `companions/ember-cohort.glb` | 18.96° / 10.64° | FAIL |
| `companions/rift-lens.glb` | 28.57° / 68.63° | FAIL |
| `companions/veil-vanguard.glb` | 22.81° / 30.22° | FAIL |
| `companions/anchor-shard.glb` | 32.29° / 16.77° | FAIL |
| `companions/throne-echo.glb` | 83.06° / 55.14° | FAIL |
| `companions/dawnless-crown.glb` | 67.52° / 15.95° | FAIL |
| `companions/pack-warden.glb` | 31.60° / 0.41° | FAIL |
| `companions/lantern-reaver.glb` | 46.47° / 16.12° | FAIL |
| `companions/requiem-warden.glb` | 60.63° / 61.26° | FAIL |
| `enemies/scout.glb` | 1.99° / 15.34° | FAIL |
| `enemies/shade.glb` | 28.55° / 28.96° | FAIL |
| `enemies/guard.glb` | 18.29° / 33.15° | FAIL |
| `enemies/possessed.glb` | 36.65° / 31.41° | FAIL |
| `bosses/cinder-warden.glb` | 49.36° / 35.14° | FAIL |
| `bosses/veil-tactician.glb` | 5.98° / 71.35° | FAIL |
| `bosses/gate-sovereign.glb` | 64.32° / 11.41° | FAIL |
| `bosses/tide-warden.glb` | 81.02° / 9.30° | FAIL |
| `bosses/pack-herald.glb` | 8.08° / 9.19° | PASS |
| `bosses/requiem-choir.glb` | 59.27° / 59.27° | FAIL |
| `bosses/lantern-tyrant.glb` | 65.20° / 58.98° | FAIL |
| `bosses/bridge-colossus.glb` | 51.23° / 51.23° | FAIL |
| `bosses/veiled-concordat.glb` | 73.31° / 73.31° | FAIL |
| `bosses/abyss-regent.glb` | 13.60° / 13.60° | FAIL |

### Rest-pose measurement and visual evidence

The measurement follows the rig pipeline's stated rest-pose criterion in `scripts/rig-character-asset-blender.py`: 12° maximum deviation from horizontal. For each exported GLB, I composed each node's parent-space TRS to world space, formed the `DEF-shoulder.L/R -> DEF-hand.L/R` vector, and calculated `asin(abs(deltaY) / |delta|)` in degrees. Both sides must be at or below 12°.

**Result:** only `bosses/pack-herald.glb` satisfies that structural rest-pose gate. The existing focused test nevertheless passes all 24 assets because it never measures rest pose.

Visual bind-pose evidence was rendered from the deployed GLBs with the repository renderer:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/render-pose-contact-sheet.py -- \
  --out _workspace/20260726-tpose-rig-animation/qa/bind-pose-frames --res 384 --glb <all 24 mapped actor GLBs>
```

Observed: Blender completed **24/24** imports and writes; `index.json` records all frames. The labeled overview is [`bind-pose-frames/contact-sheet-labeled.png`](bind-pose-frames/contact-sheet-labeled.png), with one separately named frame per deployed GLB. The images corroborate that this library is a mixture of sculpted/action rest silhouettes rather than a uniformly horizontal-arm T-pose library. The image is visual corroboration only; the numeric bone measurement is the pass/fail authority.

## Action-key contract and runtime consumption

The deployed clips use the exact lower-case keys:

```text
idle, move, run, hit, bighit, attack, critical, avoid, defence, die, show
```

`bighit` is lower-case in both `battle-realtime-three.js` and the current test. This differs from the requested spelling `bigHit`; a future test must freeze one canonical spelling across producer, test, and runtime rather than silently accepting a casing change.

Runtime path and clip resolution:

1. `actorModelPath()` resolves a commander to `COMMANDER_MODEL`; boss `bossId`, companion `companionId`, and enemy `kind` through the three model maps. `MODEL_ROOT` prefixes the relative result (`./assets/images/battle/glb/`), and `loadGltf()` caches the loader promise by that relative path.
2. `instantiateActorModel()` uses `SkeletonUtils.clone(gltf.scene)`, creates an `AnimationMixer` on that clone, and calls `buildActions(mixer, gltf.animations)`.
3. `actionKeyFromClipName()` extracts the second `::` field from `<assetId>::<action>::v01`; it also accepts a bare key. `buildActions()` silently keeps the first clip for duplicate keys.
4. `idle`, `move`, and `run` loop forever. The other eight keys are one-shot, `LoopOnce`, and `clampWhenFinished`.
5. Spawn starts `idle`; movement cross-fades `idle`/`move`; combat events currently consume only `attack` for `WEAPON_FIRED` and `ENEMY_ATTACK`, `hit` for `ENEMY_ATTACK` targets, and `die` for downed actors. The other declared keys are loaded but have no current event mapping.

## Why green contracts still allow a rig regression

| Coverage gap | Regression that can still pass today |
|---|---|
| No rest-pose assertion | An A-pose, arms-down pose, or arbitrarily posed bind can pass while every skin/clip exists. This is the present baseline: 23/24 fail the stated 12° gate. |
| Clip names only | Empty animation channels, invalid samplers/accessors, zero duration, constant tracks, tracks addressing non-joints, or clips with the wrong asset namespace can pass. |
| Tolerant runtime parsing | A bare `idle`/`attack` name works, and a duplicate action key is silently ignored after the first clip. A malformed deployed file can therefore appear to load without proving the intended clip is selected. |
| Partial skin inspection | The test inspects only `skins[0]` and only mesh nodes carrying a `skin`; an additional unskinned renderable body primitive can escape weight checks. It does not prove all joint indices are in range, all vertex weight sums are valid, or all intended geometry deforms. |
| Hard-coded asset inventory | The current local list matches the runtime maps now, but adding/changing a catalog mapping can leave an actor outside the test until both lists are manually edited. |
| No renderer/mixer contract test | Missing clips are intentionally silent no-ops, so test success does not prove runtime starts idle, loops locomotion, plays one-shots, holds their duration, or returns to locomotion. |
| No visual deformation gate | Weight-share heuristics cannot detect inverted elbows, cape/weapon tearing, detached vertices, floor penetration, or a T-pose that looks wrong after GLB import. |

## Proposed regression-test plan (do not implement in this audit)

For **every changed actor GLB** (and for every runtime mapping changed in the same change set), require this evidence before installation:

1. **Inventory and naming contract — PR blocker.** Derive the tested actor paths from the runtime/catalog maps or a single shared manifest. Assert that the changed path is present exactly once, the GLB is valid, and its animations are exactly the 11 canonical names `<assetId>::<key>::v01`. Reject bare names, duplicate keys, wrong asset-id prefixes, unknown keys, and a `bigHit`/`bighit` casing mismatch.
2. **Skin and bind contract — PR blocker.** Assert one intentional skin, a skinned render node for every deforming body primitive, valid `JOINTS_0` indices, finite normalized positive weights per vertex, no unweighted/neutral parking, and the existing weight-shape safeguards. Keep the current arm-share/top-joint checks as additional safeguards, not as a substitute for per-vertex validity.
3. **T-pose rest contract — PR blocker.** Use the exported GLB's composed node transforms (not an asset name or a screenshot) to assert both shoulder-to-hand elevation angles are <=12°. Emit the two angles in a per-asset result. A changed asset may not be copied to the deployed directory when this assertion fails.
4. **Clip-track readiness — PR blocker.** For every one of the 11 clips on a changed asset, assert non-zero duration; valid sampler input/output accessors; monotonic finite time samples; target nodes are the skin joints; and meaningful non-constant transform deltas. The current baseline gives an expected shape of 72 channels over all 24 joints with translation/rotation/scale, which can be used as a deliberate compatibility bar if all future rigs retain this skeleton.
5. **Runtime consumption test — PR blocker.** Import the runtime at its public boundary or test extracted pure helpers. Prove the changed mapped path reaches `loadGltf`, the namespaced clips produce the expected action map, `idle`/`move`/`run` repeat, one-shots clamp, spawn plays idle, movement cross-fades, combat maps to `attack`/`hit`, downing maps to `die`, and one-shot expiry returns to locomotion. Test the silent no-op path separately so it remains intentional, not accidental.
6. **Rendered visual gate — required human sign-off, artifact retained.** Render a labeled bind-pose front-and-side frame plus `move`, `attack`, `hit`, `defence`, `die`, and `show` at start/peak/end for each changed asset. Review the images for horizontal-arm bind pose, limb/mesh attachment, no cape/weapon tears, no detached geometry, feet/ground placement, and readable one-shot poses. Store the exact image paths alongside the per-asset structural JSON. A still image alone must never grant T-pose status; it supplements step 3 and validates deformation.

### Gate split

- **Local:** focused structural contract over the changed GLB and mapping.
- **PR:** steps 1–5 for every changed actor asset; failure blocks merge/install.
- **Release/manual:** step 6 visual artifact review at the target renderer/import version.
- **Scheduled:** full 24-actor structural and render sweep to catch pipeline/environment drift.

## Baseline decision

The existing test is green for skin presence, aggregate weights, and action-name presence, but the deployed library is **not T-pose-compatible as a set** under the pipeline's 12° criterion: **1 pass, 23 fail**. Do not represent the current focused-test pass as a T-pose or visual-deformation pass.
