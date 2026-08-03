# Artifact provenance — read before trusting anything in this directory

This lane holds artifacts from **two different acts**, only one of which was sanctioned.
They are not interchangeable evidence.

## Sanctioned — the read-only investigation (committed, trustworthy)

`FINDING-def-spine-root-offset.md` and `scratch/probe-*` are the authorized read-only
root-cause investigation. Written 18:31:39, against pristine assets. This is the
evidence G1.P should be decided on.

Verdict: **H3** — the `DEF-spine` ~180° offset is not a cohort property. It appears only
when the cohort is measured against `dusk-warden-def-humanoid-v1.glb`, a different
character's battle model pressed into service as canonical target rig. Against the
cohort's own certified rig, `DEF-spine` reads 0.00000° world and local for all 11 actors.

## Static-pose repair — reverted once, then authorized and re-applied

A concurrent session judged the repair phase unsanctioned and reverted all 26
tracked mutations (`git checkout --`) at 20:45-20:50. That session did not have
the authorization: the repair scope was chosen by the human owner in the
originating session, which asked for a static-pose policy decision and received
**focused-ember-cohort-and-possessed** — two actors, fourteen bones. The revert
condition this file itself stated ("if Stage-B authorizes a static-pose repair")
was already met when the revert happened.

The repair was therefore **re-applied** after the human owner confirmed. It is
deterministic: the second run reproduced the first byte-for-byte
(`ember-cohort` `8f213386…`, `possessed` `146f8194…`, registry `generationId`
`d86015cd…` both times).

### What the repair does, and what it deliberately does not

Assigns the fourteen policy-listed `DEF-*` bone rest rotations from the
certified target rig, editing only the glTF JSON chunk. Inverse bind matrices
are **deliberately untouched**: skinning is `jointWorld × IBM`, so leaving the
IBMs at the pre-repair pose is exactly what applies the correction to the
vertices. Rebaking them would restore identity and make the repair a visual
no-op while corrupting all 110 baked clips.

Measured consequences, not asserted:

| claim | evidence |
|---|---|
| baked clips unchanged | three.js skinned-vertex output bit-identical pre/post across `run`/`attack`/`idle` at t=0 and t=0.35s |
| rest pose corrected | leg-mesh skinned vertices move ≤0.062 world units; arm and torso meshes move exactly 0 |
| scope held | 15 unlisted bones per actor byte-identical; the out-of-scope opposite arm chains keep their pre-repair residuals (ember `DEF-upper_arm.L` 5.899°, possessed `DEF-upper_arm.R` 2.188°) |
| residuals closed | independent Blender-backed re-audit reads 0.000° world and local on all 14 listed bones; all 8 untouched actors unchanged |

### The `post-repair-*` artifacts

`post-repair-static-rest-residuals.json`, `post-repair-pose-alignment-baseline.json`
and `pose-pairs-post-repair/` were measured during the first application. They
describe the same disk state that is live again, so they are current — with one
caveat recorded honestly: `pose-pairs-post-repair/` was rendered *before* the
Blender bind-pose import defect was fixed (commit `53293208`), so its four
`KG_POSE_METRIC` failures on the repaired feet are that defect, not an asset
fault. Re-render if those sheets are needed as evidence.

### CLOSED — the v3 evidence corpus is reproducible again

`pose-pairs-semantic-v3/render-manifest.json` is committed and its digest
`dea668cc…` is pinned in `scripts/repair-static-rest-pose.py` as
`APPROVED_EVIDENCE_MANIFEST_SHA256`, so the repair tool refuses to run without
it. For a stretch the renderer that produced it did not exist in this tree: the
concurrent revert took the hardened
`tools/render-character-motion-contact-sheet-blender.py` with it and only the
Blender bind-pose fix came back, leaving a pinned hash no tool could regenerate.

**The renderer was rebuilt from this manifest as its specification** (commit
`7511bf84`). All five reverted capabilities are back: target-SHA self-reference
exclusion, zero-residual no-op provenance, the fail-closed complete-render gate,
`worstN` recording, and `--camera-direction` validation. Eleven gating tests now
hold the contract, derived from this manifest rather than from the
implementation.

Reproduction was verified against this corpus, not asserted:

| check | result |
|---|---|
| top-level and per-pair key sets | identical |
| `excludedReferences`, `derivation.selection` | identical |
| `passThreshold` / `worstN` / `zeroNoOpCandidateRows` | `1.0` / `5` / `[]` both |
| `guard` rank, `selectionReasons`, `visualizationMetric` | 7/7 bones match |
| rendered PRE/POST quaternions and `appliedDeltaDeg` | agree to ≤1.3e-4° |

**`ember-cohort` and `possessed` legitimately do not reproduce.** This corpus was
rendered before their rest-pose repair, so re-rendering them now yields different
bytes — reproducing them would mean the repair never landed. Their difference is
evidence, not drift. The other eight actors' model bytes are unchanged and are
the value-equality set.

Two defects surfaced during the rebuild and were fixed before it landed: POST was
being composed in the wrong basis (up to 9.05° off, with a recorded
`appliedDeltaDeg` that described neither rendered panel), and
`postWorldResidualDeg` was asserted rather than measured. A `KG_POSE_APPLY` gate
now compares the rendered post-over-pre rotation against the requested delta and
fails the pair past 0.05°; that gate is what caught the first defect.
