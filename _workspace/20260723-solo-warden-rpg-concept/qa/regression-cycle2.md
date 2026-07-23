# Cycle 2 Full Regression Suite — Stage2 Verification

run-id: `20260723-solo-warden-rpg-concept` · cycle: 2 · lane: FullRegressionSuite (QA subagent) · worktree: `Abyssal-Surge-cycle2` (branch `cycle2-stage-progression`) · HEAD at run time: `bec93dabdb7c76ef59a82669b3d3c36e446b1f48`

## Setup

`node_modules/` did not exist in this worktree (gitignored, never installed here). Ran:

```
npm ci
```

→ `added 7 packages in 415ms` (installs `agentation@1.1.0`, `playwright@1.52.0` and their deps per `package.json`). No `test` script is defined in `package.json`; this project's test entrypoint is direct `node --test` invocation (confirmed against `.github/workflows/static.yml` `engine_contract`/`release_closure`/`browser_contract` jobs and `README.md`).

## Commands run (full suite — every test file under `tests/`)

**Node-native suite (18 files, `node:test`):**
```
node --test "tests/**/*.test.mjs"
```

**Browser-contract suite (3 files, standalone Playwright scripts, matching `README.md`'s documented invocation and the CI `browser_contract` job):**
```
node tests/defense-hud-responsive-browser.cjs
node tests/defense-survivor-browser.cjs
node tests/defense-performance-browser.cjs
```

Not run (CI/deploy-time-only smoke tests, not part of the local dev/regression suite per `README.md` — `pages-artifact-smoke.cjs` validates a packaged `.pages-artifact` output that doesn't exist locally, and `deployed-defense-smoke.cjs` validates a live deployed URL):
- `tests/pages-artifact-smoke.cjs`
- `tests/deployed-defense-smoke.cjs`

## Results — Node-native suite

Aggregate (`node --test "tests/**/*.test.mjs"`):

```
# tests 148
# suites 0
# pass 142
# fail 6
# cancelled 0
# skipped 0
# todo 0
```

(148 is the TAP-visible test count including one 6-subtest nested suite in `defense-run-simulation-rpg.test.mjs`'s "enemy policies" test; per-file top-level counts below sum to the same 142 pass / 6 fail.)

Per-file breakdown (each file run in isolation via `node --test tests/<file>`):

| file | pass | fail |
|---|---|---|
| `campaign-state-rpg.test.mjs` | 25 | 0 |
| `cinder-span-vertical-slice.test.mjs` | 2 | **1** |
| `defense-asset-manifest.test.mjs` | 1 | 0 |
| `defense-campaign-adapter.test.mjs` | 9 | 0 |
| `defense-cutscene.test.mjs` | 3 | 0 |
| `defense-expansion-contract.test.mjs` | 17 | 0 |
| `defense-idle-progression.test.mjs` | 3 | **1** |
| `defense-observers-contract.test.mjs` | 9 | 0 |
| `defense-renderer-contract.test.mjs` | 3 | 0 |
| `defense-run-simulation-rpg.test.mjs` | 15 | 0 |
| `defense-run-simulation.test.mjs` | 19 | **2** |
| `defense-stat-delta-browser.test.mjs` | 1 | 0 |
| `g2-archetype-sweep-cli.test.mjs` | 1 | 0 |
| `g2-full-route-runner.test.mjs` | 9 | **1** |
| `g2-measurement-fixture.test.mjs` | 5 | 0 |
| `no-rts-closure.test.mjs` | 1 | 0 |
| `release-closure.test.mjs` | 2 | **1** |
| `rpg-catalog.test.mjs` | 17 | 0 |
| **total** | **142** | **6** |

## Results — Browser-contract suite

All 3 pass (custom JSON-report harnesses, not `node:test` TAP — each exits 0 and reports `"pass": true` / equivalent with an empty `errors` array):

| file | result |
|---|---|
| `defense-hud-responsive-browser.cjs` | exit 0, produced geometry report, no errors |
| `defense-survivor-browser.cjs` | exit 0, `"pass": true`, `"errors": []` |
| `defense-performance-browser.cjs` | exit 0, produced perf report (RAF ~16.6ms, no DOM/latency anomalies), no errors |

## Baseline comparison — does the failure set match the known pre-existing baseline exactly?

**No.** `production/task-manifest.md` (line 52-68) documents exactly **2** known pre-existing failures, both in `tests/defense-run-simulation.test.mjs`, verified broken at baseline commit `b0a0c57` before any RPG-layer work:

1. `terminal victory accepts a queued reward selection and closes the offer`
2. `selecting an already-owned reward closes an all-owned terminal offer`

Both reproduce identically at current HEAD (confirmed above, same assertion: `events.at(-1).type` is `'INPUT_ACCEPTED'`, expected `'REWARD_SELECTED'` — the documented `processInput` terminal-emit-ordering bug, not fixed in this cycle, matching the task-manifest's note that a fix is in-progress in a separate concurrent workstream). **These 2 are confirmed unchanged.**

The current suite has **4 additional failures** the task-manifest does not mention. To classify them, I checked out the documented baseline commit `b0a0c57` in an isolated worktree (`git worktree add --detach /tmp/baseline-check b0a0c57`, `npm ci`, ran the same 4 test files there), then narrowed with `git log b0a0c57..HEAD -- <file>` and a bisect-style checkout of the intermediate commit `233a9d0` (the "Add Solo Warden RPG layer" commit) where needed:

| test | status at `b0a0c57` | status at HEAD | classification |
|---|---|---|---|
| `Cinder Span lore surprise is a deterministic, non-combat event` (`cinder-span-vertical-slice.test.mjs`) | **FAIL** (identical assertion diff) | FAIL | **pre-existing, undocumented** — not caused by cycle 2 |
| `isolated Ed25519 admission fixture exercises the reduced G2 runtime collection route` (`g2-full-route-runner.test.mjs`) | **FAIL** (identical `TypeError`) | FAIL | **pre-existing, undocumented** — not caused by cycle 2 |
| `idle settlement caps elapsed time, awards only completed-stage progress, and leaves an active run unchanged` (`defense-idle-progression.test.mjs`) | **PASS** | FAIL | **new regression**, traced to commit `233a9d0` |
| `Pages workflow preserves the defense-survivor release DAG and closure` (`release-closure.test.mjs`) | **PASS** | FAIL | **new regression**, traced to commit `3cb52ee` |

The task-manifest's baseline note only names the 2 `REWARD_SELECTED` failures; it does not claim the suite was otherwise green at `b0a0c57`, and direct measurement at that commit confirms it was not (5 failures total there, one of which — `defense asset manifest has literal, complete dispositions when generated` — was an artifact of the temporary baseline worktree missing gitignored generated pilot-asset files (`assets/images/battle/pilot/*`, `assets/models/*`), not a real code failure at HEAD; that file passes cleanly in this worktree). Net: **4 of 6 current failures are pre-existing/unrelated to this cycle's scope** (2 documented `REWARD_SELECTED` + 2 undocumented-but-pre-existing), and **2 are new regressions requiring root-cause writeups below.**

## New regression 1 — `defense-idle-progression.test.mjs:34`, "idle settlement caps elapsed time…"

**File/line of the failing assertion:** `tests/defense-idle-progression.test.mjs:44` (`assert.deepEqual(settled.receipt, {...})`).

**Expected vs actual:**
```
expected: { outcome: 'SETTLED',   awardedProgress: 960, ... }
actual:   { outcome: 'ENCROACHED', awardedProgress: 0,   ... }
```

**Mechanism (file/line):** `campaign-state.js:217-249`, function `settleIdleReturn`.

The test (`campaignWithCompletedStages(2)`) builds a campaign with 2 resolved stages and 0 companions, then calls `settleIdleReturn` with an elapsed window of `IDLE_RETURN_MAX_ELAPSED_MS + 3*IDLE_RETURN_INTERVAL_MS` = 8h3m = `28,980,000` ms (test lines 39-42). Inside `settleIdleReturn` (`campaign-state.js:239-242`):

```js
const pressure = wardlinePressure(elapsedMs);   // line 239
const level = wardLevel(next);                   // line 240
if (pressure > level) {                           // line 241
  return { ..., receipt: idleReceipt("ENCROACHED", ...) };
}
```

`wardlinePressure` (`campaign-state.js:220`) computes `Math.min(Math.floor(elapsedMs / (60 * IDLE_RETURN_INTERVAL_MS)), 8)` = `Math.min(floor(28980000/3600000), 8)` = `Math.min(8, 8)` = `8`. `wardLevel` (`campaign-state.js:218`) computes `resolvedIds.length + floor(companionCollection.length/2)` = `2 + floor(0/2)` = `2`. Since `8 > 2`, the function takes the `ENCROACHED` branch (line 242) instead of falling through to the `SETTLED` branch (line 249) the test expects.

**Root cause:** the `wardlinePressure`/`wardLevel`/`ENCROACHED` gate was introduced by commit `233a9d0` ("Add Solo Warden RPG layer") as part of D9's Undertow Encroachment mechanic (documented in `production/decision-log.md` D15 as reusing this exact pre-existing `settleIdleReturn` pattern for the newer wardline-pressure comparison design). That commit added the gate to `campaign-state.js` but did not update this pre-existing test's fixture/expectations — the test's 2-completed-stage, 0-companion, 8h3m-elapsed scenario now legitimately trips the new pressure ceiling (any idle window ≥8h always saturates pressure at 8, which exceeds a wardLevel below 8; this campaign's wardLevel is 2). Verified by checking out commit `233a9d0` directly in an isolated worktree and re-running the test in isolation: fails identically there (`3 pass, 1 fail`), while the immediately preceding baseline `b0a0c57` passes (`4 pass, 0 fail`). This is a test-fixture/implementation mismatch introduced within `233a9d0`, not something this batch's constraints permit fixing (`campaign-state.js` is a read-only core engine file for this lane) — flagged here as verification-only per the assignment.

## New regression 2 — `release-closure.test.mjs:43`, "Pages workflow preserves the defense-survivor release DAG and closure"

**File/line of the failing assertion:** `tests/release-closure.test.mjs:65` (`assert.deepEqual(runtimePaths(workflow), RUNTIME_PATHS)`).

**Expected vs actual:** the workflow's actual `PAGES_RUNTIME_PATHS` (parsed live from `.github/workflows/static.yml`) is a 30-entry set that includes `'rpg-catalog.js'`; the test's hardcoded `RUNTIME_PATHS` constant (`tests/release-closure.test.mjs:14-24`) is a 29-entry set that does not.

**Mechanism (file/line):** commit `3cb52ee` ("fix: add rpg-catalog.js to Pages deploy allowlist and SW precache") correctly added `rpg-catalog.js` to `.github/workflows/static.yml`'s `PAGES_RUNTIME_PATHS: >-` block (per that commit's own message: `233a9d0` added `rpg-catalog.js` as a runtime module imported by `app.js`/`campaign-state.js`/`defense-run-simulation.js` but never added it to the deploy allowlist, which would have shipped a Pages bundle missing the file and 404'd at runtime). That fix updated the workflow file and `sw.js`'s `CORE_ASSETS`, but did not update this test's hardcoded `RUNTIME_PATHS` Set at `tests/release-closure.test.mjs:14-24`, which is the test's own independent source of truth for what the allowlist *should* contain and was never touched by `3cb52ee`.

**Root cause:** a mechanical test-fixture omission in `3cb52ee` — the commit fixed the real deploy-allowlist gap (correct behavior) but missed the corresponding test-fixture update. Verified: checking out `233a9d0` (immediately before `3cb52ee`) and running this test in isolation passes (`3 pass, 0 fail`, `rpg-catalog.js` not yet in the workflow's allowlist at that point either, so the fixture and workflow still agreed). `3cb52ee` is the exact commit that desynced them. Not fixable within this lane's scope (`.github/workflows/static.yml` and the test fixture are outside this batch's read-only/verification-only mandate) — flagged here per the assignment's instruction to report, not fix.

## Summary

- **Total: 148 Node-native tests + 3 browser-contract scripts.**
- **Pass: 142 Node-native + 3 browser-contract = 145.**
- **Fail: 6 Node-native, 0 browser-contract.**
- **Skip: 0.**
- Failure set does **NOT** exactly match the task-manifest's documented 2-item known baseline. It is a superset: the 2 documented `REWARD_SELECTED` failures are present and unchanged, plus 2 further pre-existing-but-undocumented failures (`Cinder Span lore surprise`, `isolated Ed25519 admission fixture` — both already broken at `b0a0c57`, unrelated to any RPG-layer work), plus **2 genuine new regressions** introduced within this shared branch history (not by this QA lane, which touched no engine files): `defense-idle-progression.test.mjs` (broken by commit `233a9d0`) and `release-closure.test.mjs` (broken by commit `3cb52ee`). Root causes for both new regressions are documented above with exact file/line citations; no fixes were applied per this batch's verification-only scope.
