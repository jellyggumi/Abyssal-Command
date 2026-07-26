# Representative character GLB visual T-pose audit

**Audit date:** 2026-07-26  
**Scope:** Four deployed runtime representatives only—one commander, companion, enemy, and boss. This is not a claim about the other 20 deployed character GLBs.

## Method and evidence

Fresh Blender 5.1.2 workbench renders were produced from the deployed GLBs, without opening or saving them, using the repository's `scripts/render-pose-contact-sheet.py`:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b \
  -P scripts/render-pose-contact-sheet.py -- \
  --out _workspace/20260726-tpose-rig-animation/design/pose-frames/front \
  --axis front --res 768 --glb <the four source paths below>
# repeated with --axis side and .../pose-frames/side
```

The renderer imports each GLB, frames its mesh bounds with an orthographic camera, and reports imported armature bone count. The generated `index.json` files record 24 imported bones for every representative. Direct GLB decode supplements the images in [`tpose-visual-structural-facts.json`](./tpose-visual-structural-facts.json): it checks glTF skins, `JOINTS_0`/`WEIGHTS_0`, exact animation names/track counts, and evaluates the default skeleton shoulder-to-hand vectors.

**Pass rule.** A representative is **confirmed** only when both orthographic views show an upright, symmetric, uncluttered neutral arm placement and the decoded default skeleton puts *both* shoulder-to-hand vectors no more than 20° from horizontal. The asset must also carry a real skin and the complete action library. This avoids calling a model T-compatible from its filename, a single image, or clip presence alone.

All four representatives contain one skin with 24 joints and one skinned body mesh with `JOINTS_0`/`WEIGHTS_0`. `dusk-warden`, `veil-vanguard`, and `guard` also contain an unskinned pedestal mesh; `tide-warden` does not. Each has 11 actual, 72-track clips:

`attack`, `avoid`, `bighit`, `critical`, `defence`, `die`, `hit`, `idle`, `move`, `run`, `show`.

`bighit` is the exact deployed clip spelling; it is not an inference from the requested camel-case `bigHit` action label.

## Results

| Category | Exact deployed source and snapshot | Fresh visual evidence | Visual + imported-skeleton assessment | Classification | Exact repair prerequisite |
|---|---|---|---|---|---|
| Commander | `assets/images/battle/glb/commander/dusk-warden.glb`  
SHA-256 `a74ffd2252a6b7ee661f5a89b07cae2ca1cce2d7e91cbb6a06e8807cac696393` | [front](./pose-frames/front/dusk-warden.png), [side](./pose-frames/side/dusk-warden.png) | The silhouette is upright but its arms/held forms hang beside the torso; the two sides are not a readable neutral pair. Decoded default shoulder→hand angles are **L 23.75°**, **R 76.00°** from horizontal, confirming the visual asymmetry rather than a T rest pose. Skin/24 joints/11 real clips are present. | **nonconforming** | Obtain the authoring mesh before the carried props and body are posed; set both arm chains to a symmetric horizontal neutral bind (each shoulder→hand vector ≤20° from horizontal), keep the lantern/blade as separately bindable attachments, then rebind and re-export. |
| Companion | `assets/images/battle/glb/companions/veil-vanguard.glb`  
SHA-256 `56eaa0f47d18125681334ca3ea6cadf87629a9baa25708e246e0a6dbcfc173ad` | [front](./pose-frames/front/veil-vanguard.png), [side](./pose-frames/side/veil-vanguard.png) | The default silhouette is a crouched, shield-forward guard pose; the shield and bent body obscure a neutral bilateral arm read. Skeleton measurements are **L 22.81°**, **R 30.22°** from horizontal, and both chains project forward/down rather than forming a clean T. Skin/24 joints/11 real clips are present. | **nonconforming** | Supply an upright, unarmed source-body bind pose. Detach the shield and pedestal from the body bind decision (either rigid attachment or separately weighted accessory), expose both shoulders/arms, then bind and export only after the symmetric T gate passes. |
| Enemy | `assets/images/battle/glb/enemies/guard.glb`  
SHA-256 `57e4f23c2ced8988a0e4be15e112cd1736b440c1797b2453b29da898a23108ae` | [front](./pose-frames/front/guard.png), [side](./pose-frames/side/guard.png) | The weapon, layered cloak/armor, and asymmetric arm presentation prevent a clean neutral silhouette. The decoded left chain is near-horizontal only in part of its forward projection (**18.29°**), while the right chain descends (**33.15°**); the pair is not symmetric or readable as T-compatible. Skin/24 joints/11 real clips are present. | **nonconforming** | Recover an unarmed source mesh with both arms visible. Separate the weapon and loose garment pieces into deliberate attachment/weight groups, place both arm chains horizontally and symmetrically in the bind pose, validate the two arm-vector measurements, then rebind and re-export. |
| Boss | `assets/images/battle/glb/bosses/tide-warden.glb`  
SHA-256 `2107dd36da0890a9990e562d32e0e79c0ab0a50a6f2f162db7a64dc90e4cf211` | [front](./pose-frames/front/tide-warden.png), [side](./pose-frames/side/tide-warden.png) | The default silhouette is dominated by a heavily asymmetric arm/armor mass. Imported skeleton data agrees: the left shoulder→hand chain is almost vertical (**81.02°** from horizontal) while the right is short/near-horizontal (**9.30°**). That is neither a symmetric T nor a safe neutral bind read. Skin/24 joints/11 real clips are present. | **nonconforming** | Obtain the boss's pre-pose source geometry and establish a bilateral neutral arm configuration before conversion; isolate or deliberately bind the asymmetrical armor/weapon mass, rebuild both visible arm chains to a symmetric horizontal rest pose, verify the T gate, then rebind and re-export. |

## Decision

No representative is confirmed as T-pose-compatible. The deployed files are structurally animation-bearing (skin plus the complete, named 11-clip library), but their default visual/skeletal arm layouts do **not** satisfy the neutral T-bind criterion. They may continue to be treated as existing animated runtime assets; they must not be used as clean T-pose source assets for a destructive conversion until the stated per-asset prerequisite is met.

The repository's conversion pipeline has an explicit T-pose stop gate (`scripts/rig-character-asset-blender.py`, `tpose_ok` / `axisDeviationDeg`): these visual findings are a precondition for that gate, not a substitute for rerunning it after repair.
