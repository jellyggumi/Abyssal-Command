# Finding — the `DEF-spine` ~180° world offset

Date: 2026-08-03 · Worktree `/private/tmp/abyssal-motion-repair` · Branch `motion-rig-repair`
Scope: read-only root-cause investigation. No runtime asset modified.

---

## Verdict: **H3 — genuine asset difference**, with a scoping correction that matters more than the verdict

The half-turn is real, not a measurement artifact and not a frame error. But it is **not a
property of the actor cohort**. It appears only when the cohort is measured against
`dusk-warden-def-humanoid-v1.glb`, which is **a different character's battle model** pressed
into service as a canonical target rig.

Against the cohort's own certified canonical rig, `DEF-spine` reads **exactly 0.00000° world
and 0.00000° local for all 11 actors**. There is no root-bone offset in the cohort.

| | reference rig | `DEF-spine` world | `DEF-spine` local |
|---|---|---|---|
| reported evidence | `dusk-warden-def-humanoid-v1.glb` | 180.00000 | 180.00000 |
| certified cohort rig | `human-command-boss-def-humanoid-v1.glb` | **0.00000** | **0.00000** |

The premise in the assignment ("the cohort's root-most spine bone sitting ~180° off canonical")
traces to `dusk-warden-static-rest-residuals.json`, not to `static-rest-residuals.json`. The
latter — the cohort artifact — contains **zero rows above 90°** across all 242 rows
(11 actors × 22 bones); its maximum world residual is 22.194°.

---

## H1 — measurement artifact (quaternion double-cover): **RULED OUT**

`abs()` is present on **every** angular-distance implementation in the repository, on both the
world-space and the local-space paths:

| file | line | expression |
|---|---|---|
| `_workspace/current/engineering/asset-pipeline/motion-bench/lib/kinematic-gate.mjs` | **24** | `Math.abs(a.reduce(...))` |
| `_workspace/current/engineering/asset-pipeline/tools/kinematic_gate.py` | **36** | `abs(sum(a * b ...))` |
| `_workspace/current/engineering/asset-pipeline/tools/audit-kinematic-bounds.mjs` | **148** (local) / **149** (world) | both delegate to the `abs()`-correct `angularDistanceDegrees` |
| `_workspace/current/engineering/asset-pipeline/tools/render-character-motion-contact-sheet-blender.py` | 339 | `abs(float(left_normalized.dot(...)))` |
| `scripts/audit-character-deformation-blender.py` | 719 | `abs(_clamp(asset_q...dot(...)))` |
| `scripts/qa-visual-verification.mjs` | 251 | `Math.abs(...)` |
| `scripts/qa-actor-readability-probe.mjs` | 233 | `Math.abs(...)` |

`static-rest-residuals.json` was emitted by `audit-kinematic-bounds.mjs`; lines 148 and 149 call
the same frozen helper, so the local/world split cannot come from an asymmetric `abs()`.
Supporting math is also correct: `quatMultiply` (line 39) is a valid Hamilton product for
`(x,y,z,w)`, and `worldOrientation` (line 94) composes `parentWorld * local` in the right order.

**The decisive discriminator is the dot product, not the code.** Double-cover degeneracy
requires `dot ≈ -1` (where a missing `abs()` clamps to 0 and reports exactly 180°). The
observed pairs have **`dot ≡ 0` exactly**, where `abs()` is a no-op:

```
DEF-spine  actor  (glTF x,y,z,w) = [ 0, -1, 0, 0 ]      ← 180° flip, w = 0
DEF-spine  dusk-warden           = [ 0,  0, 0, 1 ]      ← identity
dot = 0·0 + (-1)·0 + 0·0 + 0·1 = 0   →   2·acos(|0|) = 180.00000°
```

I ran the counterfactual directly (`scratch/probe-spine-root.mjs`, section 3), computing every
residual twice — once with the frozen contract and once with a deliberately `abs()`-free
implementation:

```
=== canonical: human-command-boss (CERTIFIED) ===
actor                 bone           world(abs)  local(abs)  world(noabs)  local(noabs)
shadow-commander-boss DEF-foot.L       17.46108    17.46108     180.00000     180.00000   ← noabs FABRICATES 180
shadow-commander-boss DEF-toe.L         0.00000    17.46109     180.00000      17.46109   ← noabs FABRICATES 180

=== canonical: dusk-warden ===
shadow-commander-boss DEF-spine       180.00000   180.00000     180.00000     180.00000   ← IDENTICAL both ways
shadow-commander-boss DEF-spine.001   180.00000     0.00000     180.00000       0.00000   ← IDENTICAL both ways
```

This inverts the hypothesis. A missing `abs()` would have manufactured 180s **against the
certified rig** — where none are observed. The dusk-warden 180s are byte-identical with and
without `abs()`, which is the exact opposite of the double-cover signature.

On the "179.99998 is too clean to be authoring" intuition: that value is *structurally*
expected here, not a numerical coincidence. The cohort's DEF bones are authored with `w = 0`
(pure 180° bone flips, e.g. `DEF-foot.L` actor local `[0, 0.895978, -0.444098, 0]`), while
dusk-warden's are ordinary rotations about X (`[-0.424536, 0, 0, 0.905411]`). For any pair of
the form `dot([0,a,b,0], [c,0,0,d]) = 0`, the dot vanishes identically. Exact-180 readings are
the *predicted* result of comparing a `w=0` rig against a non-flipped rig.

## H2 — wrong reference frame: **RULED OUT** by four independent checks

1. **No one-sided armature-object transform.** Blender reports the armature object quaternion as
   `[0, 0, 0, 1]` (identity) for all five inspected files — both canonical rigs and all three
   actors. Nothing is applied on one side only.
2. **Identical ancestry.** The glTF node chain above `DEF-spine` is structurally the same in
   every file — `<name>` → `<name>_armature` → `DEF-spine` — and both ancestors carry no
   `rotation` property at all (absent ⇒ identity). There is no un-inherited basis.
3. **The residual is invariant under change of basis.** This is the strongest evidence. The
   measurement was reproduced in two different coordinate systems:
   - glTF **Y-up** node space (`probe-spine-root.mjs`): `DEF-spine` = 180.00000°
   - Blender **Z-up** armature space (`blender-spine-probe.py`, Blender 5.1.2): `DEF-spine` = 180.00000°

   These agree to five decimals across all three actors. A Z-up/Y-up handedness error entering
   one path would *change* the measured angle; a genuine rotational difference is invariant
   under a common change of basis. The importer's Y-up→Z-up correction is visibly present and
   consistent — actor `DEF-spine` `[0,-1,0,0]` (glTF) maps to `[0,-0.707107,-0.707107,0]`
   (Blender), and dusk-warden identity maps to `[0.707107,0,0,0.707107]` (+90° about X) — yet
   the residual is unchanged.
4. **The delta is not constant.** A pure frame error yields exactly one delta quaternion for
   every bone. Measured `q(actor⁻¹ · canonical)` in world space against dusk-warden
   (`scratch/probe-delta-output.txt`) spreads by **180.00000°**:

   | bone group | world delta | world° |
   |---|---|---|
   | `DEF-spine` … `DEF-spine.005` | `[0, ±1, 0, 0]` | 180.000 |
   | `DEF-shoulder.*`, `DEF-thigh.*`, `DEF-shin.*` | `[0, 0, 0, 1]` (identity) | 0.000 |
   | `DEF-upper_arm.L`/`forearm.L`/`hand.L` | `[0.0238, 0.0007, 0.0638, 0.9977]` | 7.806 |
   | `DEF-foot.L/R` | `[0, -0.9998, 0.0217, 0]` | 179.99997 |
   | `DEF-toe.L/R` | `[0, -1, 0, 0]` | 179.99959 |

   Ten of 22 bones exceed 90°; twelve are clean. Localized, not uniform.

## H3 — genuine asset difference: **CONFIRMED**

The authored rest quaternions genuinely differ. Blender armature space, `DEF-spine`
(`bone.matrix_local`, parent = `None` — confirming it is root-most):

```
CANONICAL human-command-boss   [ 0.000000, -0.707107, -0.707107,  0.000000 ]   180° flip (w = 0)
ACTOR shadow-commander-boss    [ 0.000000, -0.707107, -0.707107,  0.000000 ]   bit-identical to canonical
ACTOR shadow-soldier-v04       [ 0.000000, -0.707107, -0.707107,  0.000000 ]   bit-identical to canonical
ACTOR guard                    [ 0.000000, -0.707107, -0.707107,  0.000000 ]   bit-identical to canonical
CANONICAL dusk-warden          [ 0.707107,  0.000000,  0.000000,  0.707107 ]   +90° about X  ← the outlier
```

The three actors and the certified canonical rig are **bit-identical** at the root bone.
Only dusk-warden differs, and it differs genuinely: `dot = 0`, hence exactly 180°.

**Why dusk-warden differs — provenance.** Both rigs pass every `loadCertifiedRig` check
(hash, Blender version, 24 target bones, 22 pose bones, excluded pelvis pair, origin-blob
recovery), so certification did not catch this. Their lineage, however, is not comparable:

| rig | `originPath` |
|---|---|
| `human-command-boss-def-humanoid-v1` | `_workspace/current/engineering/asset-pipeline/character-motion-library/human-command-boss/model.glb` |
| `dusk-warden-def-humanoid-v1` | `assets/images/battle/glb/commander/dusk-warden.glb` |

dusk-warden is recovered from a **battle character model**, not from the character-motion-library.
`dusk-warden` is **not one of the 11 characters** in `library-config.json`. Its spine chain is
authored without the 180° bone flip the cohort shares, and it compensates for that flip further
down the hierarchy — which is exactly why the damage is confined to the spine and the feet:

```
DEF-spine        world 180.00000   local 180.00000   ← root differs; flip introduced here
DEF-spine.001    world 180.00000   local   0.00000   ← locally clean, inherits the root flip
DEF-shoulder.L   world   0.00000   local 180.00000   ← inverse pattern: local flip CANCELS the root flip
DEF-thigh.L      world   0.00000   local 180.00000   ← same cancellation
DEF-toe.L        world 179.99959   local  65.60501   ← genuine per-actor scatter, not 180 at all
```

`DEF-shoulder.*` and `DEF-thigh.*` show the mirror image of the `DEF-spine.001` signature —
local 180 / world 0 — because the two rigs distribute the same limb pose differently along the
chain. `DEF-toe.L` local residuals are scattered per actor (65.605 / 60.176 / 63.201), which no
frame or double-cover error can produce. This is two different characters' rigs, authored to
different spine conventions.

---

## Corrected residual values

The computation was never wrong; the **reference rig** was. "Corrected" below means measured
against the certified cohort rig `human-command-boss-def-humanoid-v1.glb`.

**shadow-commander-boss**

| bone | current (vs dusk-warden) | corrected (vs certified) |
|---|---|---|
| | world / local | world / local |
| `DEF-spine` | 180.00000 / 180.00000 | **0.00000 / 0.00000** |
| `DEF-spine.001` | 180.00000 / 0.00000 | **0.00000 / 0.00000** |
| `DEF-foot.L` | 179.99997 / 179.99998 | **17.46108 / 17.46108** |
| `DEF-toe.L` | 179.99959 / 65.60501 | **0.00000 / 17.46109** |
| 22-bone max | 180.00000 | **17.46108** |
| bones > 90° | 10 of 22 | **0 of 22** |

**shadow-soldier-v04**

| bone | current (vs dusk-warden) | corrected (vs certified) |
|---|---|---|
| | world / local | world / local |
| `DEF-spine` | 180.00000 / 180.00000 | **0.00000 / 0.00000** |
| `DEF-spine.001` | 180.00000 / 0.00000 | **0.00000 / 0.00000** |
| `DEF-foot.L` | 179.99997 / 179.99998 | **12.03213 / 12.03213** |
| `DEF-toe.L` | 179.99959 / 60.17604 | **0.00000 / 12.03213** |
| 22-bone max | 180.00000 | **12.03213** |
| bones > 90° | 10 of 22 | **0 of 22** |

(Third actor, `guard`, for completeness: 180.00000 → **15.05662** max, 10 → **0** bones over 90°.)

Independently confirmed inside Blender 5.1.2 in Z-up armature space, agreeing to five decimals.

---

## The world-space threshold

**It can be frozen.** The root bone is explained: `DEF-spine` reads 0.00000° world and local for
all 11 cohort actors against the certified rig, so nothing propagates to descendants, and
`MODEL_FORWARD_YAW_OFFSET = 0` (`battle-realtime-three.js:1213`) is correct — there is no
half-turn for it to compensate.

Full-cohort distribution from `static-rest-residuals.json` (242 rows, 11 actors × 22 bones,
reference `human-command-boss-def-humanoid-v1.glb`, sha256 `a2fd4358…6137e6`):

```
world   max 22.19400   p99 17.46108   p95 10.85210   median 0.00000   rows>90° : 0
local   max 22.19400   p99 22.19398   p95 12.03213   median 0.00000   rows>90° : 0

per-actor worldMax:  possessed 22.19400 | shadow-commander-boss 17.46108 | guard 15.05662
                     shadow-soldier-v04 12.03213 | broken-court-monarch-boss 11.33060
                     … | human-command-boss 0.00000 (it is the reference)
```

Recommended: **freeze the world-space threshold at 25°**, ~1.13× the observed cohort maximum of
22.194° (`possessed`). This sits far below any half-turn, so a regression reintroducing a
mirrored or flipped root bone still trips it immediately, while leaving headroom for the
legitimate authoring spread already present in the cohort.

Two conditions attach to that number:

1. **The threshold is only valid against the certified reference rig.** It is a property of the
   pair (cohort, reference), not of the cohort alone. Freezing it while
   `dusk-warden-def-humanoid-v1.glb` remains selectable as a target rig would make the gate
   meaningless — that pairing produces 180° at ten bones for every actor.
2. `world` and `local` maxima coincide at 22.19400 and no row exceeds 90° in either space, so
   the world metric carries no double-cover contamination and needs no separate allowance.

**The real defect to fix is rig selection, not the metric.** `loadCertifiedRig` validates hash,
Blender version, bone-name sets and origin-blob recovery, but never checks that the target rig
*belongs to the cohort it is measuring*. That is how a commander battle model from
`assets/images/battle/glb/commander/` passed full certification as a canonical target rig. A
membership check — target rig must resolve to a `library-config.json` character — would have
rejected `dusk-warden-def-humanoid-v1.glb` before any residual was computed.

---

## Adjacent defect noted, not investigated (out of scope)

`dusk-warden-reproduction-failure.json` reports `maxAngularDeviationDeg 180.0` at
`DEF-shoulder.R` frame 47 with this pair:

```
scratch   = [ 0.4324966,  0.5144490, -0.4281917, -0.6041032 ]
committed = [ 0.6041032,  0.4281917,  0.5144490,  0.4324966 ]
```

`committed = [-s[3], -s[2], s[1], s[0]]` — a component **reversal**, i.e. the `(w,x,y,z)` /
`(x,y,z,w)` convention split between Blender's `mathutils` and glTF, not a rotation difference.
This is a separate write-path issue in the reproduction lane and does not affect the static rest
residuals analysed above. Flagged for follow-up; deliberately not chased here, since the
assignment scoped this investigation to the root bone only.

---

## Evidence

Read-only probes written under this lane (`scratch/`):

| file | purpose |
|---|---|
| `probe-spine-root.mjs` → `probe-output.txt` | ancestry, raw quaternions, abs vs no-abs counterfactual, 22-bone spread |
| `probe-delta-uniformity.mjs` → `probe-delta-output.txt` | per-bone delta uniformity, certification gate replay |
| `blender-spine-probe.py` → `blender-probe-output.txt` | independent Blender 5.1.2 confirmation in Z-up armature space |

Blender invoked per repo convention with the full binary path:
`BLENDER_BIN=/Applications/Blender.app/Contents/MacOS/Blender` … `"$BLENDER_BIN" -b -P <script>`.

`scripts/retarget-ingame-motion-blender.py` was **not** invoked. No runtime asset under
`assets/` was modified. No formatter, linter, or project-wide suite was run.

**Final containment check — `git status --porcelain -- assets/ scripts/ tests/ tools/` is empty.**
No out-of-bound writes; nothing needed reverting. All files created by this investigation live
under `_workspace/current/qa/motion-repair-20260803/`.
