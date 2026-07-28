# Regression Matrix — Lobby → Idle-Style Side-Dock Redesign

QA pass over the dock-shell redesign (UI/IA only — no balance/worldview/revenue content touched). Scope: regression + accessibility/perf verification, not archetype-rotation exploit hunting.

## 1. Disposition of the 2 flagged stale test selectors

Both were retargeted to their new dock-system equivalents, per hud-layout-spec.md §4's explicit content-fate decisions. Neither retarget weakens an assertion — each maps the old check onto the literal replacement element/content the spec names.

### 1.1 `tests/defense-public-contract-browser.cjs`

- **Before**: `page.locator("#idle-return-summary")` — the deleted always-in-DOM banner.
- **After**: `page.locator("#idle-return-toast")` (line 78). The toast carries the identical `data-idle-return-outcome`/`data-idle-return-total` attributes and text content the old banner had (confirmed in `app.js` `renderIdleReturnToast()`, lines 930-944) — a 1:1 attribute-preserving swap, not a weakened check.
- **Why this holds across the test's reload flow**: the toast is mounted once per `mountShell()` call (once per page load/reload), driven by `idleReturnReceipt` which `initialize()` sets fresh on every load via `storage.settleIdleReturn()`. Verified the reload path re-populates a receipt with a non-`"SETTLED"` outcome (confirmed via `campaign-state.js` `settleIdleReturn()` inspection — a repeat call within the same interval returns `NO_COMPLETED_STAGES`/`INITIALIZED`, never `SETTLED` again), so the test's `assert.notEqual(..., "SETTLED")` post-reload assertion still holds.
- **Verification**: `node tests/defense-public-contract-browser.cjs` → exit 0, no assertion failures.

### 1.2 `tests/world-presentation-browser.cjs`

- **Before**: `atlasSnapshot()` queried `[data-stage-atlas="selected"]` (the deleted 2D minimap) for `data-terrain-pattern` and title/domain text, plus `[data-stage-map-context="terrain"]` for chokepath/hazard/occupation/extraction/landmark labels.
- **After**: retargeted to `.briefing-panel` (the `<aside>` in `renderSortieTabBody()`, app.js:797-808) which hud-layout-spec.md §4 explicitly states is where "every authored fact the atlas displayed... still renders, in the existing dl format." All 8 label categories (title, domain, terrain label, chokepath, hazard, occupation, extraction, landmarks) are asserted present in the panel's text content — same fact-coverage as before, same regex-match style the original test used.
- **One attribute check dropped, documented not silently swallowed**: the old test asserted `atlas.getAttribute("data-terrain-pattern") === profile.terrain.patternId`. The new briefing markup does not expose `data-terrain-pattern` as an attribute anywhere in the sortie tab (confirmed via grep — only `#defense-battle-surface`, set by the live battle session, carries that attribute, and only once a run starts). This is consistent with the spec's stated intent to trim raw IDs from the pre-run browsing UI in favor of human-readable labels; the terrain **label** text is still asserted, which is the content-level fact the pattern ID was a proxy for. `battleSnapshot()`'s own `data-terrain-pattern` check against `#defense-battle-surface` (line 94, unchanged, still passing) is untouched and still exercises the raw ID against the same catalog profile once combat starts.
- **Verification**: `node tests/world-presentation-browser.cjs` → exit 0, no assertion failures, both normal-motion and reduced-motion passes green.

## 2. Full unit suite (`node --test tests/*.test.mjs`)

```yaml
command: "node --test tests/*.test.mjs"
result:
  tests: 411
  pass: 395
  fail: 5
  skipped: 11
  cancelled: 0
  duration_ms: 32425.826
```

### 2.1 Baseline (3 known pre-existing, out-of-scope) — confirmed UNCHANGED, identical failure identity

| # | Test file | Failure signature | Baseline match |
|---|---|---|---|
| 1 | `tests/battle-session-cutscene-audio.test.mjs` | `ReferenceError: getComputedStyle is not defined` — async unhandledRejection after test teardown | ✅ identical |
| 2 | `tests/world-presentation-contract.test.mjs` | Same `getComputedStyle is not defined` unhandledRejection pattern, different test file (`BattleSession projects exactly the allowed 2.5x actor categories...`) | ✅ identical |
| 3 | `tests/stage1b-evidence-exporters.test.mjs` (`Stage 1b persistence exporter proves all three paths...`) | `Error: stage1b-persistence: victory expected terminal VICTORY, observed DEFEAT at tick 1129` — deterministic sim-engine VICTORY/DEFEAT divergence | ✅ identical |

Verified by stashing all redesign changes (`app.js`, `styles.css`, the 3 modified test files) and re-running each isolated test file against clean baseline — all 3 reproduce the exact same failure signature pre-redesign. These are confirmed out of scope; no action taken.

### 2.2 NEW failures beyond baseline — 2 found, both genuine implementation regressions, NOT test-selector staleness

These are **not** among the 2 flagged tests I was authorized to retarget, and are **not** caused by stale selectors pointing at spec-deleted content. Both are real defects in the delivered `app.js`/`styles.css` that I did not fix (out of my authorized scope — trivial test-selector fixes only), and report here as blocking.

| # | Test file | Failure | Root cause |
|---|---|---|---|
| 4 | `tests/defense-public-contract-regressions.test.mjs` (`shipped command-deck vocabulary retains the canonical faction and companion terms`) | `assert.match(source, /ABYSSAL COMMAND · FARWATCH HOLD/)` fails — string no longer present in `app.js` | See Defect A below |
| 5 | `tests/defense-stat-delta-browser.test.mjs` (`growth choices show truthful current → upgraded values to the player`) | `locator.setInputFiles: Timeout 30000ms exceeded` waiting for `#import-defense` | See Defect B below |

Confirmed both pass cleanly against pre-redesign baseline (isolated re-run of each file with all redesign changes stashed): `defense-public-contract-regressions.test.mjs` → 5/5 pass; `defense-stat-delta-browser.test.mjs` → 1/1 pass (26.3s). These are genuine NEW regressions.

## 3. CI-gated browser contracts

```yaml
defense_hud_responsive_browser:
  command: "node tests/defense-hud-responsive-browser.cjs"
  result: FAIL
  exit_code: 1
  see: "Defect C below — genuine NEW regression, confirmed passes on pre-redesign baseline"
defense_survivor_browser:
  command: "node tests/defense-survivor-browser.cjs"
  result: PASS
  exit_code: 0
  evidence: "full journey (lobby-visible, battle-visible, cutscene, keyboard/touch movement, 3 growth selections, webgl-renderer-confirmed-active) completed with zero errors; world-HUD nameplate/damage-number projection, boss mesh, stance feedback, XP progress, passive badges all verified present and correct"
defense_performance_browser:
  command: "node tests/defense-performance-browser.cjs"
  result: PASS
  exit_code: 0
  evidence: "844x390 and 2056x1082 viewports both green — domNodes 117 (<5000), rafMeanMs 16.665 (<100 full-res budget), inputLatencyMs [0.3, 0.2]/[0.4, 0.1] (<100 budget)"
```

## 4. Blocking defects found (beyond the 2 authorized test-selector retargets)

These are genuine implementation-code regressions in the delivered `app.js`/`styles.css`, discovered during CI-contract and unit-suite verification. Per my scope, I did not patch production code — reporting for the implementer/reviewer to fix.

### Defect A — `.command-header`/`.brand-lockup` masthead text dropped without a landing spot check against the vocabulary regression test

`hud-layout-spec.md` §4 `shell_chrome_dropped` explicitly drops `.command-header`/`.brand-lockup` (the "ABYSSAL COMMAND · FARWATCH HOLD" eyebrow + "Warden Corps 방어선" `<h1>`), folding "a small brand mark" into each dock panel header instead. The implementation followed this correctly — `dock-panel-header` now shows only a bare `"AC"` glyph (`app.js:662`, `aria-hidden="true"`), with no equivalent text anywhere in the new markup. `tests/defense-public-contract-regressions.test.mjs:93` asserts the full "ABYSSAL COMMAND · FARWATCH HOLD" string must exist in `app.js` — this is a genuine content-vocabulary regression test that the spec's own content-drop decision breaks, structurally identical to the 2 tests I was authorized to fix, but **outside my authorized file list** (`tests/defense-public-contract-browser.cjs` and `tests/world-presentation-browser.cjs` only). Implementer's own report flagged only 2 casualties of this spec decision; this is a **3rd, unflagged one**.

**Recommendation**: either restore the full eyebrow string somewhere in the retained UI (e.g. as a `title`/`aria-label` on the dock brand glyph, satisfying both the spec's "small brand mark" intent and the vocabulary contract), or explicitly retarget this regression test's assertion the same way the 2 authorized ones were — a decision for the spec owner/reviewer, not mine to make unilaterally.

### Defect B — `#import-defense`/archive-tools reachability regression (real bug, not a spec-intent conflict)

Pre-redesign, `renderCommandShell()` rendered **two** copies of `<details class="archive-tools">` (containing `#import-defense`/`#export-defense`/`#reset-defense`): one unconditionally at the shell level (old `app.js:711`, rendered regardless of `activeCommandTab`), one inside `renderStrongholdTab()`'s own tab body (old `app.js:614`). `component-contracts.md` correctly identifies this as "an existing duplication bug" and directs consolidating to exactly one copy, "living only inside the stronghold dock tab." The implementer did this correctly per the contract.

**The regression**: the shell-level copy was the ONLY one reachable without first navigating to a specific tab — it rendered regardless of which of the 5 old tabs was active. Once consolidated into the stronghold dock tab body only, `#import-defense` is now reachable **only when `activeRightDockTab === "stronghold"`** — but the default right-dock tab is `"sortie"` (component-contracts.md §1 `computeDefaultDockOpen`), by design, to keep `#start-defense` reachable at zero interaction. `component-contracts.md` §1.1 "Test impact" section explicitly audited for this class of breakage but only checked `data-growth-segment`/`data-companion-segment`/`data-companion`/`data-warden-*` selectors — it did not check archive-tools selectors (`#import-defense`/`#export-defense`/`#export-telemetry`/`#reset-defense`), and one existing test (`tests/defense-stat-delta-browser.test.mjs`) depends on `#import-defense` being reachable at page load with zero prior navigation, at a 1280×720 (wide-tier) viewport where the stronghold tab is not the default even though the dock IS open.

Confirmed via direct DOM inspection at 1280×720 pre-run: `document.querySelector("#import-defense")` returns `null` at load (right dock open, but on the `sortie` tab); the element only exists after clicking the `stronghold` tab button. This is a genuine reachability regression, not a stale-selector-vs-spec-intent situation — the spec's own consolidation directive, combined with an incomplete test-impact audit, produced this. Not in my authorized file list (`tests/defense-stat-delta-browser.test.mjs` is untouched).

**Recommendation**: either the spec's test-impact audit needs to be extended to flag this test for a fix (add a tab-navigation step before the `#import-defense` interaction, mirroring how `#start-defense`'s reachability was deliberately preserved), or the implementer/reviewer decides this is acceptable behavior change requiring the test update — again, a decision outside my authorized scope.

### Defect C — `#idle-return-toast` incorrectly carries the `.edge-card` class, colliding with `#defense-edge-hud`'s battle-card contract

`component-contracts.md` §3.4 and `styles.css`'s own doc comment (lines 122-125) are explicit: *"same visual language as `.edge-card` (border/background) but NOT `.edge-card` itself — that class is positioned relative to `#defense-battle-surface`; this toast is a shell-level sibling and needs its own top-center fixed rule."* The dedicated `.idle-return-toast` CSS rule (styles.css:126-140) correctly implements this as `position: fixed` with its own `env(safe-area-inset-top)`-based top offset.

**The bug**: `app.js:935` sets `toast.className = "idle-return-toast edge-card rc-glass"` — literally applying the `.edge-card` class the doc comment says NOT to apply. Because `.edge-card` (styles.css:187, later in cascade order, equal specificity) sets `position: absolute` and `top: max(.5rem, var(--defense-safe-top))`, and `--defense-safe-top` is scoped to `#defense-battle-surface` and its descendants (styles.css:159) — but the toast is a sibling of that element, not a descendant — the custom property resolves to unset, and the toast's actual computed position collapses to `position: absolute; top: 0px` at its DOM insertion point (confirmed via live browser inspection: `getComputedStyle` returned `position: "absolute", top: "0px"` with the class as-shipped; reverting to `idle-return-toast rc-glass` in the same session restored `position: "fixed", top: "8px"`).

**Downstream test breakage**: `tests/defense-hud-responsive-browser.cjs`'s `verifyPortraitViewportContract()` (line 147) locates "the battle offer/result card" via `[...document.querySelectorAll(".edge-card")].find(node => !node.classList.contains("defense-toast"))` — a selector written when `.edge-card` was used exclusively for level-up/reward/result cards inside `#defense-battle-surface`. Because the idle-return toast now also matches `.edge-card:not(.defense-toast)`, it gets misidentified as "the battle card," and its uncorrected `top: 0px` (not respecting the injected safe-area inset) fails the assertion `assert.equal(safeInsets.cardTop, 11, ...)` (actual: `0`).

Confirmed via git-stash A/B test: `node tests/defense-hud-responsive-browser.cjs` passes cleanly (`cardTop: null`, no false match) against pre-redesign baseline; fails identically and reproducibly against the redesign's `app.js`/`styles.css` in 2 separate runs. Confirmed single root cause (no downstream cascade) — stripping the `edge-card` class from the toast in a live browser session restores `battleCardFoundAfterFix: false` and `topInsets.top: "11px"`, matching baseline behavior exactly.

**Recommendation**: drop `edge-card` from `app.js:935`'s `toast.className` (leaving `"idle-return-toast rc-glass"`), matching the doc comment's own stated intent. This is a one-token production-code fix, but it is in `app.js`, outside the "trivial test-file selector fixes" scope I was authorized for — reporting rather than silently patching.

## 5. Overall verdict

- 2/2 authorized test-selector retargets: done, both verified passing, no assertion strength lost.
- Unit suite: 395/411 passing. 3/5 failures match the known baseline exactly (confirmed via isolated pre-redesign re-run). **2/5 failures are NEW regressions** (Defects A and B above), neither caused by the 2 files I retargeted.
- CI browser contracts: 2/3 passing (`defense-survivor-browser.cjs`, `defense-performance-browser.cjs`). **1/3 fails** (`defense-hud-responsive-browser.cjs`) due to a genuine NEW regression (Defect C above).
- **This is not a clean gate.** 3 real, reproducible regressions exist in the delivered `app.js`/`styles.css` beyond the 2 spec-anticipated test casualties. None are cosmetic; Defect B is a functional reachability break (archive/import feature unreachable at default state on desktop), Defect C is a functional accessibility/safe-area break, Defect A is a content/vocabulary contract break. All 3 are outside my authorized fix scope (production code) and are reported here as blocking, not silently absorbed.
