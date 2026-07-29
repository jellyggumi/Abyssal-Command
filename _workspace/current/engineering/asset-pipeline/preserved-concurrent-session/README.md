# Preserved: a concurrent session's uncommitted gate changes

status: `[OBSERVED]` — recovered and preserved. **Not this session's work. Not judged here.**

---

## What happened

While this session held `scripts/gate-joint-weight-repair.py`, a concurrent out-of-process
session edited the same file, changing the rigidity contract. This session then needed to
commit only its own check-mode reporting fix without adopting that contract, and did so by
rewriting the file as `HEAD + own hunk`.

**That rewrite deleted their uncommitted work from the working tree.** It was never committed
to any branch, and `git stash list` (3 entries) does not contain it — verified by
`git stash show -p stash@{0..2} -- scripts/gate-joint-weight-repair.py`, all zero matches. The
only surviving copy was a temporary file, so it is preserved here before that could be lost.

CLAUDE.md §5 forbids restoring, discarding, or force-overwriting another session's changes.
The splice violated that as a side effect of an otherwise legitimate separation. Recording it
plainly rather than quietly restoring, because the deletion happened and the next session
should know the file passed through a rewrite.

## The file

`gate-joint-weight-repair.rigidity-ceiling.py`
sha256 prefix `19702e0b1b455ab1`, 50 diff lines against
`HEAD:scripts/gate-joint-weight-repair.py`.

It is a complete, runnable copy of their version — not a patch — so it can be restored with a
plain copy or diffed against whatever the file becomes.

## What their change does

| | committed (`6e2ab06`, this session) | their version |
|---|---|---|
| constant | `RIGIDITY_FLOOR_FRACTION = 0.005` | `RIGIDITY_CEILING_FRACTION = 0.25` |
| budget | `max(baseline, 0.5% of vertices)` | `min(baseline, 25% of vertices)` |
| epsilons | as committed | also changed |

It is a different contract, not a looser number. `min(baseline, ceiling)` means an asset can
never be permitted to become more rigid than it shipped, which is **stricter** than the
committed rule wherever the baseline is small — `lantern-reaver` ships with `inf1 = 3`, so its
budget becomes 3. The 25% ceiling only binds on assets that already ship heavily rigid, which
reads as a migration allowance.

Their epsilon changes also mean the two versions **report different figures for identical GLB
bytes**: theirs gives `broken-court-monarch-boss spread 0.0000 / inf1 28708`, HEAD's gives
`spread 0.5984 / inf1 0`. Neither is wrong; the metric definitions differ. See
`_workspace/current/qa/joint-repair-runtime-verification.md` §7 for the gate-independent
measurements that survive this ambiguity.

## Restoring it

```bash
cp _workspace/current/engineering/asset-pipeline/preserved-concurrent-session/\
gate-joint-weight-repair.rigidity-ceiling.py scripts/gate-joint-weight-repair.py
```

That discards this session's committed check-mode reporting fix (the single-influence share
print, which closes a false green where four of five columns read clean on a 100% rigid
asset). Merging both is the better outcome: their contract plus that reporting line, which
carries no threshold constant and therefore does not conflict.
