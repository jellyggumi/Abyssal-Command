# Gate Review — G4 / G6 (scoped) — 20260727-lobby-dock-redesign

```yaml
run_id: 20260727-lobby-dock-redesign
stage: "Stage 1d-equivalent (UI/IA revision, not a full 3-stage cycle)"
gates_reviewed: [G4, G6]
gates_not_applicable: [G1, G2, G3, G5, G7, G8]
gates_not_applicable_reason: >
  No worldview, balance, revenue, or core-loop content was touched — this
  cycle is a UI/IA layout revision only, per intake/production-brief.md's
  explicit scope. G1 (narrative consistency) is not formally in scope, but
  a G1-relevant regression (canonical vocabulary silently dropped) was
  found and fixed as a byproduct of QA's regression pass — see D1/defect_a
  below; recorded here for completeness though this cycle does not claim
  a full G1 audit.
```

## G4 — Effects & animations give immersion (scoped: accessibility inputs only)

```yaml
gate_id: G4
scope_note: >
  Immersion scoring (median >=4.0/5 across scored scenes) is N/A — no new
  scenes/effects/cutscenes were added by this UI/IA-only pass. Scope is the
  gate's accessibility inputs: touch target ceiling, contrast,
  reduced-motion parity, color-independent encoding.
measured_by: DockRegression (qa/gate-measurements.md#g4), DockA11yPerf (ui/accessibility-audit.md)
verdict: PASS
evidence:
  touch_targets: "qa/gate-measurements.md#g4 -- dock-rail-tab 48x48, dock-panel-close 44x44
    (documented exception), sortie-fab 358.8x56, all measured live via getBoundingClientRect()"
  touch_target_fix_applied: >
    DockA11yPerf's first audit pass found .dock-panel-tabs .dock-rail-tab (the inline tab
    button inside an OPEN panel header) at 40x40px, below the 48dp floor -- a real defect,
    since the rail's own tab collapses to zero width once its panel opens, making the
    40px header tab the ONLY reachable tab-switcher. Fixed to 48x48 (styles.css:46,84)
    before this gate review; director independently re-measured live at both the
    collapsed-rail and open-panel-header positions (390x844) and confirmed 48x48 at both.
  contrast: "ui/accessibility-audit.md -- 8.58:1 measured from actual composited screenshot
    pixels (PIL sampling against the real .rc-glass + relocated stage-art wash render),
    clears the 7.0 AAA floor"
  reduced_motion: "qa/gate-measurements.md#g4 -- transitionDuration 0.2s->0s,
    transitionProperty transform->none under emulateMediaFeatures, confirmed live (not
    just CSS-rule presence)"
  color_independent_encoding: "ui/accessibility-audit.md -- every rail tab ships a distinct
    icon glyph + non-aria-hidden sr-only text label, confirmed via ariaSnapshot + DOM query"
narrative_consistency_byproduct_finding: >
  QA's regression pass surfaced a G1-relevant defect (defect_a in
  production/decision-log.md#D1): the canonical brand string "ABYSSAL COMMAND
  · FARWATCH HOLD" was silently dropped from all shipped app.js output when
  the masthead was removed, breaking a vocabulary-consistency test. Director
  investigated, confirmed it was a genuine omission (not a stale test), and
  fixed it by giving the previously-aria-hidden .dock-brand mark a real
  accessible name carrying the canonical string -- closing an accessibility
  gap and the vocabulary regression in the same one-line change. Verified:
  tests/defense-public-contract-regressions.test.mjs 5/5 pass post-fix.
open_issues: none
```

## G6 — Game-ops plan appropriately applied (scoped: DOM/perf inputs, no telemetry/release-runbook content changed)

```yaml
gate_id: G6
scope_note: >
  ops/telemetry-contract.md, ops/rollback-runbook.md, ops/release-readiness.md
  are untouched by this pass (no ops-process content changed). Scope is the
  gate's UI perf inputs: DOM-count ceiling, UI input latency, and the shared
  frame-budget table (verified unchanged/green, not modified).
measured_by: DockRegression (qa/gate-measurements.md#g6), DockA11yPerf (ui/perf-notes.md)
verdict: PASS
evidence:
  dom_count: "qa/gate-measurements.md#g6 -- worst measured state 296 nodes (wide tier, both
    panels open, heaviest tabs), 5.9% of the 5000-node ceiling
    (tests/defense-performance-browser.cjs:174)"
  input_latency: "qa/gate-measurements.md#g6 -- dock-open interaction measured 1.2ms
    synchronous (click-to-DOM-mutation, same evaluate-call timing), 1.2% of the 100ms budget"
  perf_budget_table: "node tests/defense-performance-browser.cjs -> exit 0, all cells green
    at both required viewports (844x390, 2056x1082): rafMeanMs 16.665/16.665 (budget 100),
    domNodes 117/117 (budget 5000), inputLatencyMs [0.3,0.2]/[0.4,0.1] (budget 100)"
defects_found_and_fixed_during_this_gates_verification:
  - id: defect_c
    summary: "idle-return-toast className carried a contradictory 'edge-card' token, causing
      a CSS cascade collision that broke defense-hud-responsive-browser.cjs (one of the 3
      CI-gated contracts this gate's perf-budget-table evidence depends on)"
    disposition: "FIX (production code, app.js:935, one-token removal)"
    detail: "production/decision-log.md#D1/defect_c"
    reverification: "tests/defense-hud-responsive-browser.cjs re-run post-fix -> exit 0"
open_issues: none
```

## CI-gated browser contracts (underpinning both gates' evidence)

```yaml
defense_hud_responsive_browser: { command: "node tests/defense-hud-responsive-browser.cjs", result: PASS, note: "failed on first QA run due to defect_c; PASS after director's fix + re-run" }
defense_survivor_browser: { command: "node tests/defense-survivor-browser.cjs", result: PASS }
defense_performance_browser: { command: "node tests/defense-performance-browser.cjs", result: PASS }
full_unit_suite: { command: "node --test tests/*.test.mjs", tests: 411, pass: 397, fail: 3, skipped: 11, baseline_confirmation: "the exact pre-existing 3-failure set (battle-session-cutscene-audio.test.mjs, world-presentation-contract.test.mjs, stage1b-evidence-exporters.test.mjs), zero new regressions after all fixes" }
```

## Overall verdict

**PASS** (scoped G4/G6). 5 issues surfaced across the verification lanes (2
spec-anticipated test casualties, 3 genuine defects — 2 production-code, 1
test-file) were all found, arbitrated with first-hand evidence, and fixed
before this verdict; nothing was waived or deferred. No FIX-loop or REDO
required — this is the gate's first and only pass for this cycle.
