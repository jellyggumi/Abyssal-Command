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

### KNOWN GAP — the v3 evidence corpus is not reproducible from this tree

`pose-pairs-semantic-v3/render-manifest.json` is committed and its digest
`dea668cc…` is pinned in `scripts/repair-static-rest-pose.py` as
`APPROVED_EVIDENCE_MANIFEST_SHA256`, so the repair tool refuses to run without
it. **But the renderer that produced it no longer exists in this tree.** The
concurrent revert took the hardened
`tools/render-character-motion-contact-sheet-blender.py` with it, and only the
Blender bind-pose fix was restored afterwards.

The manifest declares fields the committed renderer cannot emit:

| manifest field | value in the corpus | committed renderer |
|---|---|---|
| `worstN` | `5` | absent |
| `zeroNoOpCandidateRows` | `[]` | absent |
| `excludedReferences` | `human-command-boss`, self-target reference | absent |
| `derivation.kind` | `actor-exclusion` | absent |
| `--camera-direction` | default `[0.48,-1,0.12]` | flag absent |

So the reverted renderer capabilities were: target-SHA self-reference exclusion,
zero-residual no-op provenance, the fail-closed complete-render gate, `worstN`
recording, and camera-direction validation. All were reviewed and test-covered
at the time; the tests went with the same revert.

Consequence: the corpus is readable evidence and the numbers in it are
trustworthy — 73/73 pairs, 10 candidate actors, independently audited — but
**regenerating or extending it requires restoring that renderer first.** Asset
determinism (documented above) does not extend to the evidence renderer.

Restoring it is a separate decision for the human owner. Nothing currently
depends on re-rendering: the repair's own gate is numeric and passes from this
tree (`repair-static-rest-pose.py --check` exit 0, 13/13 suite).
