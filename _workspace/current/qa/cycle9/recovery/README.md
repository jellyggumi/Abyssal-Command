# Cycle-9 recovery bundle

**Purpose**: cycle 9 finished verified but **uncommitted** — the git write lock was
held by another session for the whole window. ~1800 lines sat in a working tree
that **three sessions were actively writing to**. A single `git checkout`,
`git stash`, or reset by any of them would have destroyed the cycle with no
recovery path. This bundle is the insurance.

Base commit: **`033877ad`** (`Merge PR #10: Abyss Depth v2 + lobby/combat HUD de-overlap`)

---

## Contents

| File | Contents |
|---|---|
| `01-allowlisted-tracked.patch` | Tracked, modified, cycle-9-owned files: `defense-run-simulation.js`, `defense-catalog.js`, `campaign-state.js`, `tests/campaign-state-rpg.test.mjs` |
| `02-mixed-files-FULL.patch` | `app.js` + `battle-realtime-three.js` — **FULL diffs, foreign hunks INCLUDED.** See the warning below. |
| `03-new-files.tar.gz` | 15 new files: the 5 gate scripts plus every cycle-9 `_workspace/` artifact (specs, brief, blast-radius audit, negotiation record, digest baseline, both pathspec files, retrospective) |

## Restore

```bash
git worktree add /tmp/cycle9-restore 033877ad
cd /tmp/cycle9-restore
git apply <path>/01-allowlisted-tracked.patch
git apply <path>/02-mixed-files-FULL.patch     # see WARNING
tar xzf <path>/03-new-files.tar.gz
```

## Verified [OBSERVED 2026-07-30]

Restore was **tested, not assumed**. Against a clean `033877ad` worktree:

- `git apply --check` passed for both patches
- the tarball extracted all 5 gate scripts
- and with only the patches applied, **all four runnable gates passed**:

```
digest-identity      PASS
analog-live          PASS
extraction-live      PASS
extraction-e2e       PASS
```

The fifth gate, `verify-cycle9-portrait-joystick.cjs`, skips with
`merged: false` until cycle 10's `d37b6568` CSS cutover is present — by design.

---

## WARNING — `02-mixed-files-FULL.patch` is deliberately unfiltered

Both files in it are **co-edited**, and this patch keeps the foreign changes so
nothing is lost. Filter at apply time, not at capture time:

- **`app.js`** — carries cycle-9 analog + 10 capacity sites + the pre-existing
  `[object Object]` fix, **and** a foreign `DefenseAudio({ sampleMapUrl })` hunk
  (`@@ -1814,7 +1874,10 @@`; `HEAD:1817` had no argument). To stage only cycle 9:
  split `git diff HEAD -- app.js` into its 15 hunks, drop the one containing
  `DefenseAudio`, and `git apply --cached` the remaining 14.
- **`battle-realtime-three.js`** — cycle 9 contributed the range ring, corpse
  markers, extraction channel indicator, and impact signatures. The file then grew
  698 → 970 → 981 lines *after* the cycle-9 renderer agent was aborted, gaining
  `attachAoeBurst` / `AOE_BURST_SIGNATURES` / `aoeWorldRadiusFor`.
  **Attribution is unresolved**: those symbols appear in **no branch and no other
  worktree** (`feat/motion-vfx-aoe-boss` → 0, `feat/cycle10-stage-dungeon` → 0,
  both sibling worktrees → 0). They exist only in this working tree. Split by
  symbol before staging, and do not attribute them to cycle 9 without evidence.

`styles.css` is **absent on purpose** — the cycle-9 portrait block was reverted
because cycle 10's `d37b6568` supersedes it. Do not resurrect it.

## The allowlist alone ships an INVISIBLE feature

`cycle9-commit-pathspec.list` is **partial by construction**. It resolves to 24
clean paths, which reads as complete — it is not.

| Landed by allowlist | Requires the filtered files |
|---|---|
| extraction gating, corpse→channel→companion, capacity 3→10 ladder, aim bias, analog *acceptance* in the sim, 37 tests, 5 gates, all artifacts | **`battle-realtime-three.js`**: `rangeRing` ×23, `corpseMarker` ×11, `extractionChannel` ×11 — the entire renderer half. **`app.js`**: the analog contract + 10 capacity UI sites. |

Commit only the allowlist and you get: extraction that works but draws nothing
(no corpse marker, no channel read, no ground range ring), a stick still emitting
8 quantised octants, and a lobby that still hard-blocks the roster at 3 — so the
3→10 capacity the simulation now supports is unreachable by the player.

A functionally complete cycle-9 commit needs **all three**: the allowlist, a
hunk-filtered `app.js`, and a symbol-filtered `battle-realtime-three.js`.

## Before committing from this bundle

1. Acquire `/tmp/abyssal-surge-git-write.lock` with `mkdir` (CLAUDE.md §5 — **stop
   if it already exists**).
2. Re-establish quiescence: hash `git diff HEAD`, wait, hash again, require
   equality. Every measurement in the retrospective was taken on a quiescent tree
   and is void if the tree moved.
3. Stage via the allowlist, never `git add -A`:
   `git add --pathspec-from-file=_workspace/current/qa/cycle9-commit-pathspec.list`
   (`.list` is pure paths — git treats `#` lines as literal pathspecs and the whole
   allowlist degrades to nothing. Rationale lives in the `.txt`.)
4. Re-run all five gates.

## Why request #8 depends on this bundle surviving

Cycle 10's tip carries `moveAnalog` **0** and `defenseMoveAnalog` **0** in `app.js`
and **0** in the simulation. The continuous analog contract exists **nowhere but
this tree**. Cycle 10's cutover makes the stick primary and visible at every
viewport while it still emits 8 quantised octants — so losing this bundle means
the request ships as a *promoted* d-pad, which is worse than the state cycle 9
started from.
