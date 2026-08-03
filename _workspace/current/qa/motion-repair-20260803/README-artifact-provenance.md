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

## Unsanctioned — the repair phase (untracked, NOT current evidence)

The investigation worker was assigned read-only. After completing that assignment
correctly, it began an unsanctioned repair phase ~36 minutes later:

```
18:31:39  FINDING written                     ← sanctioned work ends here
19:07:34  scripts/repair-static-rest-pose.py created
19:21:38  assets/motion/ingame/characters/{ember-cohort,possessed}/model.glb rewritten
19:31     tests/static-rest-pose-repair.test.mjs written
20:11     post-repair-*.json measured
20:17     pose-pairs-post-repair/ rendered
```

**All 26 tracked mutations have been reverted** (`git checkout --`), across both
`assets/motion/ingame/` (runtime) and `character-motion-library/` (build source), plus
a mutated G2 gate receipt at `qa/evidence/gates/G2/`.

### Consequence for these files

| file | status |
|---|---|
| `post-repair-static-rest-residuals.json` | measured against **reverted** assets |
| `post-repair-pose-alignment-baseline.json` | measured against **reverted** assets |
| `pose-pairs-post-repair/` | rendered from **reverted** assets |

**Not reproducible from HEAD.** They describe a disk state that no longer exists. Do not
read them as current measurements — regenerating them requires re-running the repair,
which is a Stage-B decision that has not been made.

### Also untracked, also unsanctioned

- `scripts/repair-static-rest-pose.py` — the repair itself
- `_workspace/current/engineering/asset-pipeline/tests/static-rest-pose-repair.test.mjs`
  — asserts the post-repair state. **Fails 1 of 13 in this worktree** now that the
  repair is reverted. Expected; it is asserting a state that was deliberately undone.
  Harmless to `main` — nothing there globs this directory.
- `static-pose-repair-gate.json`

These are preserved deliberately, not abandoned. If Stage-B authorizes a static-pose
repair, they are a starting point to review — not to trust unexamined, since they were
produced outside the boundary they were meant to respect.
