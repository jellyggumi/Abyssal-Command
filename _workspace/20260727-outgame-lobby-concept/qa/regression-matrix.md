# Regression Matrix — Lobby Pass 1

**Scope under test:** presentation-only redesign of the 출정 lobby (`app.js` + `styles.css` ONLY; `git diff --name-only` → exactly `app.js`, `styles.css`, +282/−11).
**Environment:** node v26.0.0, Playwright 1.52.0 (lock-backed), darwin 25.4.0 / Apple M5 Pro.
**Local server:** `python3 -m http.server 4173 --bind 127.0.0.1` (PID 80216) → `curl http://127.0.0.1:4173/index.html` = `HTTP 200`. (The `.cjs` browser contracts self-host on their own ephemeral 127.0.0.1 port; the 4173 server is the manual-check surface.)
**Static gates:** `node --check app.js` → OK; CSS brace balance = 395 open / 395 close (BALANCED).

---

## 1. CI-gated browser contracts (3/3 PASS)

Each `.cjs` contract is silent on success and prints a stack + `process.exitCode=1` on failure. All three exited 0 with `pass: true`.

```yaml
browser_contracts:
  - name: defense-hud-responsive-browser.cjs
    command: "node tests/defense-hud-responsive-browser.cjs"
    result: PASS
    exit_code: 0
    payload_pass: true
    wall_time_s: 17.59
    viewports: [390x844, 360x800, 844x390, 667x375, 2056x1082]
    note: "all directional controls 44x44; 일시 정지 >=44; no rotate/overflow; state=starting"
  - name: defense-survivor-browser.cjs
    command: "node tests/defense-survivor-browser.cjs"
    result: PASS
    exit_code: 0
    payload_pass: true
    wall_time_s: 36.32
    note: "full lobby->battle survivor journey; journey.errors=[]; webgl renderer active; growth picks applied"
  - name: defense-performance-browser.cjs
    command: "node tests/defense-performance-browser.cjs"
    result: PASS
    exit_code: 0
    payload_pass: true
    wall_time_s: 5.90
    failures: []
    note: "G6 numbers captured below (gate-measurements.md #g6)"
```

---

## 2. Full unit suite

```yaml
unit_suite:
  command: "node --test tests/*.test.mjs"
  node: "v26.0.0"
  totals:
    tests: 411
    pass: 397
    fail: 3
    skipped: 11
    todo: 0
    suites: 0
    duration_ms: 66574.6
  exit_code: 1   # expected: 3 pre-existing baseline failures below
```

### Failing set == the known 3-failure baseline (UNCHANGED)

```yaml
baseline_failures_expected: 3
baseline_failures_observed: 3
new_regressions: 0
failures:
  - file: tests/battle-session-cutscene-audio.test.mjs
    signature: 'ReferenceError: getComputedStyle is not defined (asynchronous activity after test ended -> unhandledRejection)'
    baseline_match: true
    touches_changed_dom: false   # greps for idle-return|toast|briefing|currency = 0 hits
  - file: tests/stage1b-evidence-exporters.test.mjs
    subtest: 'Stage 1b persistence exporter proves all three paths without unaccepted Elite Extract writes'
    signature: 'stage1b-persistence: victory expected terminal VICTORY, observed DEFEAT at tick 1129 (deterministic sim divergence)'
    baseline_match: true
    touches_changed_dom: false   # sim/exporter path, no lobby DOM
  - file: tests/world-presentation-contract.test.mjs
    subtest: 'BattleSession projects exactly the allowed 2.5x actor categories and leaves canonical data unchanged'
    signature: 'ReferenceError: getComputedStyle is not defined (asynchronous activity after test ended -> unhandledRejection)'
    baseline_match: true
    touches_changed_dom: false   # greps for idle-return|toast|briefing|currency-rail = 0 hits
```

**Confirmation:** the observed failing set is byte-for-byte the pre-existing baseline (getComputedStyle-after-teardown x2 + deterministic VICTORY/DEFEAT sim divergence x1). Zero NEW failures introduced by Lobby Pass 1.

---

## 3. Spec-flagged likely-affected tests (all PASS as-is — NO retargeting needed)

The change moves the briefing `<dl class="briefing-stats">` inside a **closed** `<details class="briefing-detail">`, removes the now-duplicated `다음 보상` `<dt>` row (promoted to the `.briefing-reward` gold headline), and replaces the SETTLED-with-award idle-toast `<p>` with structured payday markup (eyebrow + `+N` count + `누적 {total}`). Every candidate assertion still holds because they read `textContent` (which includes hidden `<details>` text) and the `누적 {total}` line is painted from first frame.

```yaml
candidate_tests:
  - name: defense-public-contract-browser.cjs
    command: "node tests/defense-public-contract-browser.cjs"
    result: PASS
    exit_code: 0
    why_holds: >
      L82 asserts idleSummary.textContent() matches expectedAward; new payday markup keeps
      `누적 {total}` (== data-idle-return-total) from first paint. L86-87 assert on
      #briefing-stage-narrative (in .briefing-target, untouched). data-idle-return-outcome/-total
      attributes unchanged.
    retargeted: false
  - name: world-presentation-browser.cjs
    command: "node tests/world-presentation-browser.cjs"
    result: PASS
    exit_code: 0
    why_holds: >
      L74 reads .briefing-panel textContent (reads closed-<details> text). L75 asserts
      title/domain/terrain/chokepath/hazard/occupation/extraction/landmark labels -- ALL preserved
      verbatim inside the <details>. It does NOT assert the removed `다음 보상` label.
    retargeted: false
  - name: defense-stat-delta-browser.test.mjs
    command: "node --test tests/*.test.mjs  (line 189)"
    result: PASS
    wall_time_s: 27.68
    why_holds: "asserts growth current->upgraded values; greps for briefing/idle/currency = 0 hits"
    retargeted: false
  - name: battle-session-cutscene-audio.test.mjs
    result: FAIL (baseline getComputedStyle)
    why_not_a_regression: "asserts nothing on idle-return/toast/briefing/currency (0 grep hits); failure is the pre-existing getComputedStyle-after-teardown unhandledRejection"
    retargeted: false
```

### Retargeted test files: NONE

```yaml
retargeted_tests: []
```

No test file was modified. Every spec-flagged candidate passed against the new DOM without weakening or retargeting, because the spec's DOM-preservation discipline (keep all 5 briefing rows inside `<details>`; keep `누적 {total}` from first paint; keep `data-idle-return-outcome`/`-total`) kept every existing `textContent`/attribute assertion valid. `git status --porcelain` shows no `tests/` modifications.

---

## Disposition

| Gate | Result |
|---|---|
| 3 CI-gated browser contracts | **3/3 PASS** |
| Full unit suite failing set | **exactly the known 3 baseline failures; 0 new regressions** |
| Spec-flagged candidate tests | **all PASS as-is; 0 retargeted** |
| Production code edited by QA | **none** (only `app.js`/`styles.css` from the build task; no test edits) |

**Verdict: NO REGRESSION.** Lobby Pass 1 ships clean against the shipped build.
