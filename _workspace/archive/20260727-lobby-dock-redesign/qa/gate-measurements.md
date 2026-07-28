# Gate Measurements — Lobby → Idle-Style Side-Dock Redesign

Measured against the numbers in `ui/hud-layout-spec.md` §9 and `ui/component-contracts.md` §8. All measurements taken via live headless-browser sessions against a local static server (`python3 -m http.server 4173 --bind 127.0.0.1`), not read off the spec's structural estimates.

## #g4 — Accessibility

Scope: touch targets, reduced-motion. Immersion is N/A-scoped-out — no new scenes/effects/cutscenes were added by this pass (UI/IA relayout only).

### Touch targets

```yaml
gate: ">=48dp on every new interactive dock element (component-contracts.md §8), with one
       documented exception: dock-panel-close at 44px, justified as reusing the project's
       existing base-button floor for a non-primary dismiss action"
measurements:
  dock_rail_tab_button:
    spec_floor_px: 48
    measured_px: { width: 48, height: 48 }
    sampled: "all 5 rail buttons (growth/companions/inventory on left, sortie/stronghold on
              right) at compact tier, 390x844 viewport"
    verdict: PASS, exact match
  dock_panel_close_button:
    spec_floor_px: 44
    measured_px: { width: 44, height: 44 }
    sampled: "left dock panel-close button, compact tier, 390x844"
    verdict: "PASS — matches the documented 44px exception (base button floor for a
              secondary dismiss action, per component-contracts.md §8 note)"
  sortie_fab:
    spec_floor_px: { min_width: 56, min_height: 56 }
    measured_px: { width: 358.8, height: 56 }
    sampled: "compact tier, 390x844, pre-run"
    verdict: PASS
  panel_interior_control_sample:
    control: "stage-card (stage-rail button, sortie tab body)"
    spec_floor_px: 48
    measured_px: { width: 215.4, height: 99.0 }
    verdict: "PASS — well above floor (existing .stage-card sizing, unchanged by this pass,
              inherited by the dock body verbatim per component-contracts.md §2.3)"
evidence: >
  Browser session at 390x844 (compact tier): `tab.evaluate` read
  `getBoundingClientRect()` on every `.dock-rail-tab` not inside a `.dock-panel-header`
  (5 buttons total, both docks), the `.dock-panel-close` button, `.sortie-fab`, and 3
  sampled `.stage-card` elements. All measured widths/heights recorded above are the
  literal `DOMRect` values returned by the live rendered page, not spec estimates.
```

### `prefers-reduced-motion` guard

```yaml
gate: "the .dock-panel open/close transform transition must be suppressed under
       prefers-reduced-motion: reduce (styles.css:828-831, wraps .dock-panel transition:none
       inside the existing @media (prefers-reduced-motion: reduce) block)"
method: >
  Puppeteer session, `page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value:
  "..." }])`, followed by a fresh `page.goto()` + `getComputedStyle(document.querySelector(
  ".dock-panel"))` read of `transitionDuration`/`transitionProperty`.
measured:
  no_preference: { transitionDuration: "0.2s", transitionProperty: "transform" }
  reduce:        { transitionDuration: "0s",   transitionProperty: "none" }
verdict: >
  PASS — the transition is fully suppressed (0s duration, property set to none) under the
  emulated reduced-motion media feature, computed live from the rendered page, not asserted
  from source inspection alone.
```

## #g6 — Performance

### DOM count vs. ceiling

```yaml
ceiling: 5000   # tests/defense-performance-browser.cjs:174, unchanged by this redesign
measurements:
  wide_tier_default_pre_run:
    viewport: "1280x720 (>=900px, wide tier)"
    state: "both docks open by default (growth tab left, sortie tab right — the actual
            computeDefaultDockOpen('wide') result)"
    measured_dom_nodes: 292
    method: "document.querySelectorAll('*').length, live browser session"
  wide_tier_worst_case_both_panels_heaviest_tabs:
    viewport: "1280x720"
    state: "left=inventory (heaviest left tab per component-contracts.md's own estimate),
            right=stronghold (heaviest right tab)"
    measured_dom_nodes: 296
    method: "same, after dispatching real click() on the panel-header inventory and
             stronghold tab buttons and awaiting the synchronous re-render"
    spec_estimate_reference: "~211 (component-contracts.md §8 worst_case_both_panels_open_wide)"
    implementer_measured_reference: "278 (implementer's own smoke-test measurement, growth+sortie tabs open)"
    note: >
      My measured 296 (heaviest-tab combination) and the implementer's 278 (default-tab
      combination) both exceed the spec's own 211 structural estimate slightly — expected,
      since structural estimates undercount hydratePortraits()-injected mesh-thumbnail
      subtrees and other runtime DOM the static markup-function inspection couldn't see.
      All values are a small fraction of the 5000 ceiling regardless.
  compact_tier_default_pre_run:
    viewport: "390x844 (<900px, compact tier)"
    state: "right dock open (sortie, the default), left dock rail-only"
    measured_dom_nodes: 247
    method: "document.querySelectorAll('*').length"
  mid_run_both_docks_collapsed:
    viewport: "844x390 (compact tier, landscape)"
    state: "post #start-defense click, data-defense-started=true, both docks force-collapsed
            to rail-only (run-start collapse, hud-layout-spec.md §6)"
    measured_dom_nodes: 124
    method: "document.querySelectorAll('*').length, after clicking #start-defense and
             awaiting the data-defense-started=true DOM flip"
  ci_gated_performance_test_own_measurement:
    source: "tests/defense-performance-browser.cjs live run"
    viewport_844x390: 117
    viewport_2056x1082: 117
    note: "the CI test's own domNodes reading (rails-only, mid-run sample window) — slightly
           lower than my 124 mid-run reading above because the CI test samples during a
           steady-state RAF window, not immediately post-click; both are consistent with
           the same rail-only structural state and both are ~2.3-2.5% of the 5000 ceiling"
verdict: >
  PASS at every measured state. Worst observed (296, wide-tier, both panels open on the
  heaviest tabs) is 5.9% of the 5000-node ceiling — effectively zero DOM-count risk,
  confirming hud-layout-spec.md §9's own "effectively zero DOM-count risk" claim against
  live measurement, not just structural estimation.
command_evidence: "node tests/defense-performance-browser.cjs → exit 0, domNodes: 117 at both tested viewports (844x390, 2056x1082)"
```

### Input latency spot-check — dock-open interaction

```yaml
gate: "budget_ms: 100 (tests/defense-performance-browser.cjs:184, project-wide, unchanged);
       dock_specific_contract per component-contracts.md §8: every dock state transition
       must perform its DOM mutation SYNCHRONOUSLY inside the triggering click handler — no
       setTimeout/rAF/await between event and visible DOM change"
method: >
  Compact tier (390x844), pre-run default state (right dock open on sortie, left rail-only).
  Clicked the left rail's 'growth' tab button via a real `.click()` call inside
  `page.evaluate`, timed with `performance.now()` immediately before and after the
  synchronous call returns, then read the DOM state in the SAME evaluate call (no
  microtask/macrotask boundary crossed) to confirm the mutation had already landed.
measured:
  sync_handler_duration_ms: 1.2
  left_dock_panel_present_immediately_after_click_returns: true
  right_dock_panel_present_immediately_after_click_returns: false   # single-exclusive-panel
                                                                     # rule fired in the same tick
verdict: >
  PASS — 1.2ms, ~1.2% of the 100ms budget. Confirms the click handler's `renderShell()` call
  (app.js:671-682) is genuinely synchronous: both the opened left panel AND the
  single-exclusive-panel-rule closure of the right panel are observable in the DOM the
  instant the synchronous `.click()` call returns, with no await/setTimeout/rAF gap — matching
  component-contracts.md §8's "input observable" contract by construction, verified live
  rather than asserted from source reading alone.
ci_input_latency_reference: >
  tests/defense-performance-browser.cjs's own D-pad/skill-input latency measurement (a
  different, already-automated input path) recorded inputLatencyMs [0.3, 0.2] at 844x390 and
  [0.4, 0.1] at 2056x1082 — both far under the 100ms budget, corroborating the same
  synchronous-mutation pattern this codebase already uses everywhere.
```

### Perf budget table — still green

```yaml
source: "node tests/defense-performance-browser.cjs (full CI-gated run, both required viewports)"
result: PASS (exit 0)
table:
  - viewport: "844x390"
    renderer: webgl
    cadenceMode: full-resolution
    rafMeanMs: { value: 16.665, budget: 100, unit_note: "<100ms full-resolution budget" }
    rafMaxMs: { value: 16.8, budget: 500 }
    domNodes: { value: 117, budget: 5000 }
    inputLatencyMs: { value: [0.3, 0.2], budget: 100 }
  - viewport: "2056x1082"
    renderer: webgl
    cadenceMode: full-resolution
    rafMeanMs: { value: 16.665, budget: 100 }
    rafMaxMs: { value: 16.8, budget: 500 }
    domNodes: { value: 117, budget: 5000 }
    inputLatencyMs: { value: [0.4, 0.1], budget: 100 }
failures: []
verdict: "every cell green at both required viewports; no regression against the project-wide
          perf contract"
```

## Cross-reference: known blocking defect affecting this gate area (see regression-matrix.md §4)

`tests/defense-hud-responsive-browser.cjs` — one of the 3 CI-gated browser contracts — **fails**, for reasons independent of the measurements above: `#idle-return-toast` incorrectly carries the `.edge-card` class (a genuine app.js implementation bug, not a stale-selector issue), which makes it collide with `#defense-edge-hud`'s own battle-card safe-inset contract check. This does not invalidate the touch-target/reduced-motion/DOM-count/input-latency measurements taken directly above (all independently verified via live browser sessions, not via that failing test), but it IS a real, reproducible regression in the shipped `defense-hud-responsive-browser.cjs` CI gate. See regression-matrix.md Defect C for full root-cause analysis, git-stash A/B confirmation, and the one-line fix recommendation (drop `edge-card` from `app.js:935`'s toast className — outside my authorized test-only fix scope, reported not silently patched).
