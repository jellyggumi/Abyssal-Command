# Cycle 10 — pre-change regression baseline

Recorded before any cycle-10 source edit, so a failure met at Verification can be
attributed instead of guessed at.

## Why the baseline is not from the shared worktree [OBSERVED]

The shared worktree `/Users/jangyoung/orca/Abyssal-Surge` was not a valid baseline
subject at the time of measurement:

- `git status --short` showed **14 unstaged tracked modifications and 19 untracked
  files** authored by a concurrent session, covering every file this cycle targets:
  `app.js`, `battle-realtime-three.js`, `defense-audio.js`, `defense-catalog.js`,
  `defense-run-simulation.js`, `campaign-state.js`, plus new
  `scripts/generate-defense-audio.mjs`, `tests/audio-sample-hybrid.test.mjs`, and
  `assets/audio/elevenlabs/`.
- `defense-run-simulation.js` grew from 3571 to 4002 lines during this session.
- That session was running its own verification concurrently. Traced: a
  `node --test` runner whose parent was a separate 54-minute-old `jeopi` process.
  At peak there were four concurrent full-suite runners and 51 node test workers
  on 12 cores, **load average 101.75–120.98**.

A measurement taken there would have described someone else's half-finished tree
under 8.5× CPU oversubscription. This suite contains wall-clock-sensitive
subtests — one runs 324 s unloaded — so oversubscription manufactures timeout
failures indistinguishable from real regressions.

CLAUDE.md §5 prescribes the remedy, so cycle 10 implements in an isolated
worktree:

```
git worktree add -b feat/cycle10-stage-dungeon \
  /Users/jangyoung/orca/Abyssal-Surge-dungeon HEAD
```

Base commit `033877ad` (`Merge PR #10: Abyss Depth v2 + lobby/combat HUD de-overlap`).
Tracked modifications in that worktree at baseline time: **0**. `git status --short`
is a real signal there again.

Processes belonging to other sessions and to the sibling worktree
`/Users/jangyoung/orca/Abyssal-Surge-motion` were left running untouched, per
CLAUDE.md §5. Only orphaned runners rooted in this repository path were cleared.

## Measured baseline [OBSERVED]

Worktree: `/Users/jangyoung/orca/Abyssal-Surge-dungeon` @ `033877ad`

```
node --test --test-concurrency=2 \
  tests/defense-stage-world-movement.test.mjs \
  tests/stage-world-quest-points.test.mjs \
  tests/stage-terrain-environment-contract.test.mjs \
  tests/stage-world-encounter-routing-contract.test.mjs
```

| Metric | Value |
|---|---|
| tests | 28 |
| pass | **28** |
| fail | **0** |
| cancelled / skipped / todo | 0 / 0 / 0 |
| duration | 36,004 ms |

This subset is the contract surface cycle 10 rewrites: stage bounds and obstacle
clearance, flat-route publication, flat support triangles, walkable-terrain
following, digest identity across routed traversal, terrain GLB offline-source
status, distinct loadable routed worlds, per-stage critical-route clearance,
committed-attacker caps, objective retry idempotency, reward-once progression,
and the four ordered quest surfaces per stage.

Notable individual costs, which set the iteration budget:

| Subtest | ms |
|---|---|
| stage-specific encounter progression grants each reward once | 27,304 |
| committed attackers never exceed the authored cap on any stage | 5,550 |
| objective failure and retry are idempotent for every stage | 2,591 |
| same-seed routed terrain traversal preserves digest identity | 550 |

## Full-suite status: NOT measured

The full glob `node --test 'tests/**/*.test.mjs'` was **not** successfully
baselined. Four attempts were started and all four were killed or invalidated:
two hit their timeout still inside the suite, and all of them overlapped either
each other or the concurrent session's runs. A probe reached subtest 133 with no
failures in that prefix before being killed at 900 s.

Stated plainly: **there is no full-suite pass/fail baseline for cycle 10.** The
final gate must run it once, alone, in the isolated worktree with bounded
concurrency, and compare against the per-file baselines recorded here rather than
against a whole-suite number that does not exist.

Iteration rule for the implementation phase: run targeted per-file tests only.
Reserve the full glob for the final gate.
