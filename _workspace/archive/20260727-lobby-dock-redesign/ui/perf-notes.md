# Perf Notes — Lobby → Idle-Style Side-Dock Redesign

Author: ui-senior-developer · Run: `20260727-lobby-dock-redesign` · verification pass
Measured against the ACTUAL shipped implementation (`app.js` + `styles.css`), NOT
`hud-layout-spec.md §9`/`component-contracts.md §8`'s structural estimates. Server:
`python3 -m http.server 4173 --bind 127.0.0.1`, measured via real headless-Chromium
browser-tool sessions against `http://127.0.0.1:4173/`.

Gate reference: `qa/gate-measurements.md#g4`/`ui/perf-notes.md` referenced by
`skill://game-studio-harness/references/quality-gates.md` G4 (effect/latency spot
checks) and G6 (DOM-count ceiling + input latency ≤100ms).

## Methodology note: seeding worst-case campaign state

A fresh campaign (`unlockedStageIndex:0`, no rewards, no companions) under-represents
the spec's own "worst case" scenarios (10 reward cards, 4 equipment owners, 9 resolved
stages). To measure the ACTUAL worst case rather than a best-case fresh-save
approximation, a synthetic campaign save was constructed (10/14 catalog rewards, 3/3
loadout companions → 4 equipment owners [warden + 3], 9/10 resolved stages) and
imported via the existing `#import-defense` UI (SHA-256 hash computed client-side via
`crypto.subtle.digest`, matching `defense-storage.js`'s own envelope format exactly —
same code path a real player's `.json` export/import would exercise, not a state
injection bypassing the app). This is the same STAGES/REWARDS/COMPANIONS catalog
`component-contracts.md §8`'s own estimate cites (10 STAGES, up to 9 companion
prototypes, 3 EQUIPMENT_SLOTS × 5 tiers) — evidence below reflects real render output
at that populated state, not a fresh-save floor.

## DOM node counts at worst-case states

```yaml
dom_count_measured:
  ceiling: 5000   # tests/defense-performance-browser.cjs:174, unchanged by this redesign
  method: "tab.evaluate(() => document.querySelectorAll('*').length)"

  compact_tier_single_panel_open__inventory_heaviest_tab:
    viewport: "390x844"
    state: "left dock open on inventory tab (4 equipment owners populated), right dock closed to rail-only"
    measured: 205
    spec_structural_estimate: 141   # component-contracts.md §8 worst_case_single_panel_open_compact
    delta_pct: "+45%"
    pct_of_ceiling: "4.1%"
    verdict: PASS (ceiling); estimate was optimistic by 45%, see "why measured > estimated" below

  wide_tier_both_panels_open__inventory_plus_stronghold_heaviest_tabs:
    viewport: "2056x1082"
    state: "left dock open on inventory (4 owners), right dock open on stronghold (10 reward cards)"
    measured: 294
    spec_structural_estimate: 211   # component-contracts.md §8 worst_case_both_panels_open_wide
    delta_pct: "+39%"
    pct_of_ceiling: "5.9%"
    verdict: PASS (ceiling); estimate optimistic by 39%

  mid_run_one_panel_peeked__inventory_heaviest_tab:
    viewport: "390x844"
    state: >
      session.started=true (real run started via #start-defense click, confirmed
      data-defense-started="true" on #defense-battle-surface), #defense-edge-hud
      visible (display:block, confirmed via getComputedStyle), left dock peeked open
      on inventory tab, height-capped per component-contracts.md §6
    measured: 216
    spec_structural_estimate: 171   # component-contracts.md §8 worst_case_mid_run_one_panel_peeked
    delta_pct: "+26%"
    pct_of_ceiling: "4.3%"
    verdict: PASS (ceiling); estimate optimistic by 26%
    panel_max_height_confirmed_px: 788   # computed via getComputedStyle, matches
                                          # component-contracts.md §6's reserve
                                          # formula: 844 - max(56, safe-bottom+56) = 788

  mid_run_both_docks_collapsed_rails_only_no_peek:
    viewport: "390x844"
    state: "session.started=true, no dock panel open (default post-beginRun() state)"
    measured: 110
    spec_structural_estimate: 130   # hud-layout-spec.md §9 structural_estimate_worst_case_mid_run
    delta_pct: "-15%"
    pct_of_ceiling: "2.2%"
    verdict: PASS; measured UNDER estimate here (only scenario where this holds)

why_measured_exceeds_estimate: >
  The rail-collapse mechanism resolving the §3.1/§5 ambiguity (see
  ui/accessibility-audit.md's deviations section) keeps an open dock's OWN rail
  tab-button nodes present in the DOM (hidden via `visibility:hidden`, parent
  collapsed to zero width) WHILE a duplicate tab-button set renders inside
  `.dock-panel-header .dock-panel-tabs`. Both node sets exist simultaneously per
  open dock (~3 hidden + 3 visible for the left dock's 3 tabs, ~2+2 for the right
  dock's 2 tabs) -- this is explicitly one of the two mechanisms
  component-contracts.md §3.1 authorizes ("hiding the standalone rail tab-buttons
  ... while its icons re-render inside the panel header"), but the §8 DOM-count
  estimate table was written assuming a flatter node count and did not itemize this
  duplication cost. Every measured worst case remains <6% of the 5000 ceiling
  regardless -- zero practical risk, but flagging the estimate-vs-actual gap as
  requested rather than re-asserting the spec's predicted numbers.
gate_verdict: PASS
```

## Input latency (dock state transitions)

```yaml
input_latency_measured:
  budget_ms: 100   # tests/defense-performance-browser.cjs:184, project-wide, unchanged
  contract: >
    Every dock state transition (rail tap -> panel open, panel-tab switch, close
    button, sortie FAB click) must perform its DOM mutation SYNCHRONOUSLY inside the
    triggering click handler -- no setTimeout/requestAnimationFrame/await between
    the event and the visible DOM change (component-contracts.md §8).

  code_path_verification:
    method: >
      Read the actual shipped event-handler source (app.js) for every dock
      interaction, checking for setTimeout/requestAnimationFrame/await between the
      click event and the renderShell()/DOM-mutation call -- not inferring from the
      spec's own claim.
    dock_rail_tab_click_handler: >
      app.js renderDockSide()'s click listener: synchronously sets
      `dockOpen[side]`/`activeLeftDockTab`/`activeRightDockTab` module state, then
      calls `renderShell()` directly in the same handler invocation -- zero
      setTimeout/rAF/await in this path. CONFIRMED synchronous.
    dock_panel_close_click_handler: >
      Synchronously sets `dockOpen[side] = false`, calls `renderShell()` -- zero
      async gap. CONFIRMED synchronous.
    sortie_fab_click_handler: >
      Synchronously calls `session?.beginRun()` (itself synchronous --
      `void persistCampaign(...)` is fire-and-forget, does not block/await),
      `dockOpen = {left:false, right:false}`, `renderShell()` -- zero async gap.
      CONFIRMED synchronous (grep-verified: `beginRun()` body has no `await` before
      its state mutations complete).
    per_tab_body_mutation_handlers_growth_companions_etc: >
      These DO use `await persistCampaign(...)` (e.g. data-warden-stat,
      data-companion clicks) -- but this is EXISTING, pre-redesign behavior
      (identical to today's shipped renderCommandShell() handlers, per
      component-contracts.md §3.2's explicit read_only_binding_rule), not a NEW
      dock-introduced latency gap, and not what §8's "dock state transition" contract
      is about (that contract scopes to open/close/tab-switch/FAB, all confirmed
      synchronous above).

  real_click_timing_measurement:
    method: >
      tab.evaluate() wrapping `performance.now()` immediately before/after a real
      `.click()` dispatch on the actual DOM element, checking the DOM mutation
      (panel existence / active-tab attribute) is already true in the SAME
      synchronous evaluate() call, immediately after the click returns.
    rail_tab_open_sortie: { latency_ms: 2.9, dom_mutated_immediately: true }
    panel_header_tab_switch_inventory_to_companions: { latency_ms: 4.9, dom_mutated_immediately: true }
    panel_close_button: { latency_ms: 0.5, dom_mutated_immediately: true }
    all_measurements_vs_budget: "2.9ms / 4.9ms / 0.5ms, all <<< 100ms budget"

  gate_verdict: PASS
  note: >
    Confirmed by construction (source-read, zero async gaps in the dock-transition
    code path) AND by direct measurement (real click-to-DOM-mutation timing,
    single-digit milliseconds) -- not just trusting the spec's own claim that this
    "is satisfied by construction."
```

## Effect/DOM-mutation latency spot check (G4 cross-reference)

```yaml
run_start_transition_latency:
  method: >
    Clicked #start-defense, measured time to session?.started flipping true and
    both docks force-collapsing (dockOpen={left:false,right:false}).
  observed: >
    data-defense-started flips to "true" and #start-defense is removed from the DOM
    within the same synchronous click handler (confirmed via immediate
    getBoundingClientRect()/querySelector check after the click resolves) -- no
    intermediate loading/transition state, no async gap.
  verdict: PASS
```

## Summary verdict table

| # | Check | Threshold | Measured | Verdict |
|---|---|---|---|---|
| 1 | DOM count, compact single-panel worst case | <5000 | 205 (4.1%) | PASS |
| 2 | DOM count, wide both-panels worst case | <5000 | 294 (5.9%) | PASS |
| 3 | DOM count, mid-run one-panel-peeked worst case | <5000 | 216 (4.3%) | PASS |
| 4 | DOM count, mid-run rails-only (no peek) | <5000 | 110 (2.2%) | PASS |
| 5 | Dock rail-tap → panel-open latency | ≤100ms | 2.9ms | PASS |
| 6 | Panel tab-switch latency | ≤100ms | 4.9ms | PASS |
| 7 | Panel-close latency | ≤100ms | 0.5ms | PASS |
| 8 | Dock transitions synchronous (no async gap) | required | confirmed (source + measurement) | PASS |

**Overall gate verdict: PASS.** DOM counts run 26–45% over the spec's own structural
estimates at every "single/both panel open" worst case (attributable to the
authorized rail-hide-plus-panel-header-duplicate mechanism, see "why measured exceeds
estimate" above) but remain 4–6% of the 5000-node ceiling in every measured scenario
— zero practical risk. All input-latency measurements are single-digit milliseconds,
two orders of magnitude under the 100ms budget, confirmed both by reading the actual
handler code (no setTimeout/rAF/await in any dock-transition path) and by direct
click-to-DOM-mutation timing.
