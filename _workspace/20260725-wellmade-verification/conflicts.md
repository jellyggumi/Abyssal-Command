# Conflicts & Tree Incidents — `20260725-wellmade-verification`

## C1 — three prior workspaces deleted from the working tree (recurred once, restored twice)

**Detected:** mid-cycle during a routine `git status`, then **again** at cycle
close after the first restore had already succeeded.

`git status` reported **155 deleted files** across three prior run-ids:

| workspace | files in HEAD |
|---|---|
| `20260722-abyssal-command-bmad-gds-expansion` | 91 |
| `20260722-defense-survival-expansion` | 60 |
| `20260722-abyssal-command-vertical-slice-implementation` | 4 |

This violates the harness contract: *"Preserve `_workspace/` artifacts — they are
the studio's memory across cycles; never delete"* (`SKILL.md`, best practice 4)
and *"Archive nothing away"* (`references/stage-cycle.md`).

### The deletion has a test signal, and it is misleading

Established causally this cycle, which no prior cycle knew:

| tree state | suite result |
|---|---|
| workspaces deleted | **237 pass / 10 fail** |
| workspaces restored | **247 pass / 0 fail / 1 skip** |

The 10 failures are 9 `G2 full-route CLI …` tests plus
`live product closure contains no retired RTS surfaces or terminology`. Every one
of them reads a fixture under `_workspace/20260722-*`.

**The trap:** those names suggest a G2 measurement-pipeline or content-closure
regression. They are neither — they are a deleted-fixture symptom. A future
session that sees them will start debugging the G2 CLI. The first diagnostic
step should be `git status | grep '^ D _workspace'`.

### Resolution

All 155 files were unstaged working-tree deletions with content intact in HEAD.
`git checkout -- _workspace/` restored them both times. Verified after the second
restore: 5 run-ids present, 0 remaining `_workspace` deletions, suite green.

### Attribution

Not established, and the obvious suspect is exonerated. A concurrent
`claude -p` hourly studio-loop session (PID 56216, started 08:00) is running, but
it operates in a **separate worktree** (`~/orca/Abyssal-Surge-studio-loop`,
branch `studio-loop/main`) precisely to avoid touching this tree, and its own log
records the correct refusal: `SKIP: working tree dirty -- refusing to run an
autonomous pass over human/partial work`.

`NarrativeG1` observed the first deletion independently and handled it correctly —
it re-ran its trace against the post-deletion tree and confirmed an identical
result, so no G1 measurement depended on the deleted files.

**Because the cause is unidentified and the deletion recurred once, it may recur
again.** The next session should check `_workspace/` before trusting a red suite.
**Carried lesson:** no test asserts that prior run-ids remain present. The suite
does go red on deletion, but only via 10 fixture-dependent tests whose names
point at G2 and content closure — the signal exists and misdirects. A one-line
assertion that every `_workspace/*/production/task-manifest.md` in HEAD is still
on disk would name the real fault instantly. Added to the backlog as Tier 3.

## C2 — tracked files modified during a measure-only cycle (attribution pending)

The cycle brief scoped every agent to measurement, permitting new scripts and
workspace artifacts but no tracked-file edits. Three tracked files are modified:

| file | diff | assessment |
|---|---|---|
| `sw.js` | +12 / −1 | adds an `IS_RELEASE_BUILD` guard so a locally-served service worker refetches binaries instead of replaying a frozen cache |
| `tests/release-closure.test.mjs` | +94 | new test covering exactly that behaviour |
| `scripts/run-g2-archetype-rotation.mjs` | +16 / −8 | measurement harness, plausibly in-lane for BalanceG2G3 |

The `sw.js` change addresses the stale-service-worker trap that the last four
retrospectives each re-hit, and the accompanying test is real coverage. The
concern is not quality — it is that any screenshot or measurement captured
*through* a patched tree must be labelled as such rather than presented as
taken against HEAD.

Attribution requested from `VisualG4` (sw.js / release-closure) with an explicit
instruction **not** to revert: reverting mid-verification would invalidate
whatever was measured through the change. Disposition will be recorded in the
retrospective once the agent answers.

**Not** a defect in the work; a scope-boundary note so the next reader's
`git status` is interpretable.

## C3 — pre-existing in-flight rig pass (unchanged by this cycle, by design)

The tree arrived dirty with 24 modified character GLBs, a modified
`battle-realtime-three.js`, a staged deletion of
`scripts/rig-and-animate-asset-blender.py`, and 4 untracked rig scripts. This
cycle **measured** that work and neither committed, reverted, nor extended it.
The plinth-removal prototype wrote to `/tmp/probe/` only; `assets/` is untouched
by the director lane.
