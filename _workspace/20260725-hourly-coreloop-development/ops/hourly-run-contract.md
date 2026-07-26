# Hourly Run Contract — Core-Loop Development

run-id: `20260725-hourly-coreloop-development` · director · 2026-07-25

## Purpose

One launchd invocation performs one bounded, evidence-backed Stage-2 task in
`/Users/jangyoung/orca/Abyssal-Surge-studio-loop` on `studio-loop/main`. It
never performs a full production cycle, pushes, deploys, switches branches, or
edits the shared main worktree.

## Preconditions

| check | required state | evidence / command |
|---|---|---|
| Isolation | Worker is `/Users/jangyoung/orca/Abyssal-Surge-studio-loop`, not `/Users/jangyoung/orca/Abyssal-Surge` | `scripts/hourly-studio-prompt.md:8-20` |
| Mutual exclusion | `.studio-loop/pass.lock` is absent or belongs to a dead process | `scripts/hourly-studio-cycle.sh:80-103` |
| Worker cleanliness | No tracked or untracked worker-tree changes | driver preflight; `git status --porcelain` in the worker |
| Governance integrity | Driver and prompt hashes remain unchanged during a pass | `scripts/hourly-studio-cycle.sh:310-328` |
| Bounded execution | Pass timeout is under the hourly cadence | `PASS_TIMEOUT_SEC=3000`, driver line 60-62 |
| Test gate | The targeted test passes before a local pathspec commit | driver lines 16-18; prompt lines 152-163 |

## Safe execution and attribution

- The driver writes a lock containing `pid HEAD`, skips rather than overlaps,
  and records stale-lock attribution before recovery.
- A pass may change only its chosen task slice. New files require explicit
  `git add <path>`; all commits require an explicit pathspec. `git add -A`,
  `git add .`, and pathless commits are forbidden.
- The loop never pushes. A human reviews and promotes `studio-loop/main`.
- A failing targeted suite prevents a commit. A claimed improvement is valid
  only with the exact command/scenario in its retrospective.

## Current foreign-tree disposition — blocking, do not mutate

Measured 2026-07-25 in the isolated worker tree:

```
 M .gitignore
 M scripts/hourly-studio-cycle.sh
?? node_modules
```

These changes are not attributable to this cycle. In particular, the driver
is a governance file and the standing prompt forbids a worker from editing it.
`node_modules` is a shared symlink surface and must not be deleted or
reinstalled by the worker.

**Owner:** the human/operator who owns the worker-tree changes.

**Disposition:** the operator must either commit the intentional `.gitignore`
and driver edits on the correct branch after review, or restore them. Until the
worker tree is clean, every scheduled pass must intentionally skip at
preflight. This is safer than staging, reverting, or absorbing another
session's work. The separate shared-main changes in `app.js`,
`battle-realtime-three.js`, `defense-run-simulation.js`, and
`tests/defense-run-simulation.test.mjs` are likewise outside this worker's
ownership and must not be staged by it.

## Recovery

1. Operator resolves the foreign worker changes above.
2. Run `scripts/hourly-studio-cycle.sh --dry-run` from the isolated worker to
   confirm the pinned working directory, prompt, state, and model.
3. Run one pass manually and require its task-level test, retrospective, and
   state entry.
4. If a governing-file fingerprint changes during a pass, do not clear the
   `governTampered` state until the operator has reviewed that exact diff.
