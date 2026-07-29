# Regression attribution — UI asset refresh (20260728)

Purpose: state exactly which suites were run, what passed, and for every failure
whether this pass caused it. Method for each attribution: apply/revert the diff in an
isolated worktree at `HEAD` and re-run the same file.

Baseline worktree definition used throughout:
`git worktree add --detach /tmp/as-baseline HEAD` + the prior session's staged slice-2
diff applied + untracked `lobby-cinematic.js` copied in + `node_modules` symlinked.
That is "everything except this pass's diff".

---

## 1. CI-gated suites — the set that decides the deploy

`.github/workflows/static.yml` gates the release on exactly these.

| Gate | Suites | Result |
|---|---|---|
| `engine_contract` | `defense-run-simulation`, `defense-campaign-adapter`, `defense-renderer-contract`, `defense-asset-manifest`, `no-rts-closure` | [OBSERVED] **65 pass / 0 fail** (combined run with `release-closure`) |
| `release_closure` | `release-closure` | [OBSERVED] **4 pass / 0 fail** |
| `browser_contract` | `defense-hud-responsive-browser.cjs` | [OBSERVED] `pass: true`, exit 0 |
| `browser_contract` | `defense-survivor-browser.cjs` | [OBSERVED] `pass: true`, exit 0 |
| `browser_contract` | `defense-performance-browser.cjs` | [OBSERVED] `pass: true`, exit 0 |

Exact command for the engine set:

```bash
node --test tests/defense-run-simulation.test.mjs tests/defense-campaign-adapter.test.mjs \
  tests/defense-renderer-contract.test.mjs tests/defense-asset-manifest.test.mjs \
  tests/no-rts-closure.test.mjs tests/release-closure.test.mjs
# -> # tests 65 / # pass 65 / # fail 0
```

## 2. Bundle proof — `package_pages` + `artifact_smoke` simulated locally

[OBSERVED] `git archive` of the staged tree, restricted to `PAGES_RUNTIME_PATHS`,
produced a 122-file bundle whose contents equal the allowlist **exactly** (set
comparison, not a spot check). Served over HTTP and booted in Chromium:

- all 16 generated assets decode at their declared sizes;
- 19 `[data-ui-icon]` nodes mount, each resolving a `.webp`;
- **zero** console errors, **zero** responses ≥400;
- lobby cinematic, both dock rails, and the sortie FAB all present.

This step caught two real blockers before CI could:
`lobby-cinematic.js` untracked and absent from every release surface (the deployed
game would not have booted), and a first bundle built from a stale index that omitted
this pass's own `app.js`/`styles.css` wiring.

## 3. Full-suite runs and every failure attributed

`node --test 'tests/**/*.test.mjs'` — parallel, completed. A second serial attempt
(`--test-concurrency=1`) exhausted a 3600 s budget without reaching a verdict and was
abandoned: the browser-heavy files cannot serialise inside that budget. The parallel
run plus the per-file isolation below is the evidence of record.

| # | Failing file / subtest | Cause | Mine? |
|---|---|---|---|
| 1 | `asset-lane-separation.test.mjs` (3 subtests) | Test-isolation race. The validator scans the whole repository while sibling tests write candidate files, so it counts their transient files as violations. [OBSERVED] all 9 subtests pass when the file runs alone, and `validate-asset-lanes.py --json --allow-missing-candidates` exits 0 with `violationCount: 0`. | **No** — pre-existing suite-design flaw |
| 2 | `battle-session-cutscene-audio.test.mjs` (file-level) | Async teardown leak: `overlay.querySelector("#lobby-cine-seq").textContent = …` runs after the test ends; `TestElement.querySelector` returns null in the stub, which does not parse `innerHTML`. All 5 subtests pass. The write belongs to another session's lobby-cinematic code — this pass added zero `textContent` writes and zero timers ([OBSERVED] `git diff \| grep '^+'` for both patterns). | **No** — another session's uncommitted work |
| 3 | `commander-guard-pose.test.mjs` (2 subtests) | `ENOENT` on `player-combat-animation-candidate/audit.json`. The workspace migration repointed the constant to `current/`, but [OBSERVED] `git log --all` shows that file only ever tracked under `_workspace/archive/…` (commit `64999bd`) and the dated root held only the GLB. | **Yes — caused by the migration, and FIXED**: the frozen audit + authoring script now read from the archive (same pattern as `scripts/audit-stage-scenes.mjs`), while the candidate GLB still reads `current/`. [OBSERVED] 2 pass / 0 fail after the fix. |
| 4 | `companion-autonomy.test.mjs` — "combat targeting remains orthogonal while a COLLECT companion fires" | Expected `undefined`, got `'enemy-7'`. | **No** — [OBSERVED] reproduces at baseline |
| 5 | `defense-run-simulation-rpg.test.mjs` — solo FRONT companion DOWNED transition | Expected down at tick 8614, got `null`. | **No** — [OBSERVED] reproduces at baseline |
| 6 | `defense-run-simulation-rpg.test.mjs` — `STANCE_CYCLE` wrap | Cycle ends `SPLIT, SPLIT` instead of wrapping to `VANGUARD`. | **No** — [OBSERVED] reproduces at baseline |
| 7 | `defense-expansion-contract.test.mjs` — hazard damage / occupation recovery | `damaged.commander.integrity < maxIntegrity` false. | **No** — [OBSERVED] reproduces at baseline |
| 8 | `defense-expansion-contract.test.mjs` — occupation/extraction progress | `occupationProgress.holdTicks > 0` false. | **No** — [OBSERVED] reproduces at baseline |
| 9 | `defense-stat-delta-browser.test.mjs` — truthful growth values | Expected `'growth'`, got `'gate-defense'`. | **No** — [OBSERVED] reproduces at baseline |

Baseline reproduction commands and results:

```bash
cd /tmp/as-baseline   # HEAD + slice-2 + lobby-cinematic.js, this pass's diff REVERTED
node --test tests/companion-autonomy.test.mjs tests/defense-run-simulation-rpg.test.mjs
# -> # pass 28 / # fail 3   (rows 4, 5, 6)
node --test tests/defense-expansion-contract.test.mjs
# -> # pass 15 / # fail 2   (rows 7, 8)
node --test tests/defense-stat-delta-browser.test.mjs
# -> # pass 0 / # fail 1    (row 9, same expected/actual pair)
```

### 3.1 Why rows 4–9 are inherited, not introduced

[OBSERVED] `git diff cbe937e --numstat` attributes the simulation-side delta to the
prior session's staged slice-2 work: `defense-run-simulation.js` +526/−78,
`battle-realtime-three.js` +146/−22, `defense-catalog.js` +38/−0,
`stage-world-catalog.js` +67/−0. This pass authored none of it — its own edits are
`styles.css`, DOM attributes in `app.js`, `sw.js`, the three allowlists, the manifest,
and `scripts/build-ui-icon-assets.py`. `app.js` cannot be split by pathspec, so the
full worktree state is committed and the co-ownership is documented in
`../../ui/ui-asset-refresh-routing-and-contract.md` §7.

**None of rows 1–2 and 4–9 is in the CI gate set**, so the release path is unaffected
by them. They are handed forward as pre-existing slice-2 defects, not silently
absorbed and not reported as passing.

## 4. Defects this pass found and fixed

| Defect | Would have shipped as | Proof of fix |
|---|---|---|
| `flex: 1` on the HUD bar fill overrides its JS-written `style.width` | Integrity bars permanently full — all damage invisible, and identical to a healthy screenshot | [OBSERVED] real damage `988/1000` → renders **98.8%**, `1588/1600` → **99.2%** |
| Abspos `::before` on a track carrying `overflow: hidden` | Both stat icons silently clipped away | [OBSERVED] 13×13 unclipped, as real grid siblings |
| Unscoped `#world-hud-overlay { z-index: 2 }` in another session's CSS | Backplate covering the live combat readout; `defense-renderer-contract` red | [OBSERVED] renderer contract 22 pass / 0 fail after scoping to `[data-defense-started="false"]` |
| `action-*` basenames colliding with the no-RTS retention guard | `defense-asset-manifest` red | [OBSERVED] renamed to `control-*`; 0 retained `action-*` rows |
| `lobby-cinematic.js` untracked, in no release surface | Deployed `app.js` importing a file absent from the artifact — game never boots | [OBSERVED] 122-file bundle boots, zero failed requests |
| `stage-world-catalog.js` missing from `sw.js` `CORE_ASSETS` | Cold offline load fails module resolution | Registered in the same edit |

## 5. Not claimed

- No gate moved to PASS. This is an **assets**-stage pass; G2/G4/G6 still require
  re-measurement and G8 remains blocked per `../../production/task-manifest.md`.
- Icon legibility and touch-target numbers are component measurements, not a G4
  immersion/accessibility verdict.
- The serial full-suite run produced **no verdict** and is reported as abandoned, not
  as a pass.

---

## 6. Release receipt — `de45c89`

[OBSERVED] `git push origin de45c89:refs/heads/main` → `12c550b..de45c89`, exit 0.

Pushed history: `fa1f599` (UI asset layer) → `0af55ea` (dated-root migration completed
in the index) → `de45c89` (merge of upstream `12c550b`). The merge was performed in an
isolated worktree because two other sessions hold uncommitted work in the shared tree;
`git merge --ff-only` on the real branch refused non-destructively, so local `main`
intentionally stays at `0af55ea` while `origin/main` is `de45c89`. No other session's
file was overwritten, stashed, or discarded (CLAUDE.md §5).

All nine release gates green — GitHub Actions run `30416003568`:

| Job | Conclusion |
|---|---|
| `resolve_revision` | success |
| `engine_contract` | success |
| `release_closure` | success |
| `browser_contract` | success |
| `package_pages` | success |
| `artifact_smoke` | success |
| `deploy_pages` | success |
| `deployed_smoke` | success |
| `release_receipt` | success |

`release_receipt` asserts `all_gate_pass == true` and fails the run otherwise, so its
success is itself the closure proof.

### 6.1 Live site verification

[OBSERVED] `https://jellyggumi.github.io/Abyssal-Command/version.json` returns
`{"candidate_sha":"de45c89cf13070c12d232378be84ff44dfc30056","rules_version":"defense-survivor-v1"}`
— the deployed artifact is this commit, not a cached predecessor.

[OBSERVED] booted in Chromium against the live URL: shell mounts, lobby cinematic
present, sortie FAB present, **19 `[data-ui-icon]` nodes / 17 visible, every one
resolving a `.webp`**, zero console errors, zero responses ≥400. Evidence:
`05-live-pages-de45c89.png`.

### 6.2 Post-merge validation of the upstream interaction

Upstream `12c550b` ("enforce candidate provenance receipts") tightened the
candidate-lane provenance rules while this pass added 32 files to the concept lane.
[OBSERVED] `tests/asset-lane-separation.test.mjs` on a worktree at the exact pushed
commit `de45c89`: **9 pass / 0 fail** — the concept-lane `.provenance.json` sidecars
satisfy the stricter receipts, and the earlier failure of this file was confirmed to be
only the parallel-run race documented in §3 row 1.
