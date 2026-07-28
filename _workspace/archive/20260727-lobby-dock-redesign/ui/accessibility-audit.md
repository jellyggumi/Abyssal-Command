# Accessibility Audit — Lobby → Idle-Style Side-Dock Redesign

Author: ui-senior-developer · Run: `20260727-lobby-dock-redesign` · verification pass
Measured against the ACTUAL shipped implementation (`app.js` + `styles.css`, working
tree diff, uncommitted on `feature/first_lee`), NOT `hud-layout-spec.md`/
`component-contracts.md`'s predicted numbers. Server: `python3 -m http.server 4173
--bind 127.0.0.1` (already running), measured via real headless-Chromium browser-tool
sessions (Puppeteer/CDP) against `http://127.0.0.1:4173/`. All coordinates/sizes are
CSS px at `devicePixelRatio` reported by the page; the gate's "48dp" floor is treated
as 48 CSS px per `hud-layout-spec.md §9`'s own `floor_dp: 48` / `width_px: 48` usage.

Gate reference: `qa/gate-measurements.md#g4` (touch target ≥48dp, contrast, reduced-
motion parity) per `skill://game-studio-harness/references/quality-gates.md` G4.

## Implementation deviations affecting this audit (confirmed with the programmer, `DockImplement`)

1. **Rail-collapse mechanism (§3.1 vs §5 ambiguity, resolved)**: spec §3.1 said an open
   dock's own tab-switcher "must not occupy a second 56px column outside the panel";
   §5's literal wording implied wrapper width = rail + panel, always summed. Shipped:
   `.dock-rail[data-dock-open="true"] { width:0; ...; overflow:hidden }` plus
   `.dock-rail-tab { visibility:hidden }` on that state — the rail's OWN tab buttons
   stay in the DOM (hidden, zero-width parent) while a duplicate tab-button set renders
   inside `.dock-panel-header nav.dock-panel-tabs`. Verified empirically below: this
   produces exactly the canvas/chrome split spec's own §5.4 table documents for
   390×844 (61px canvas / 329px chrome), confirming the implementer's reading is the
   one the spec's own worst-case table assumes. This duplication (hidden rail nodes +
   visible header nodes, both present) is why every measured DOM count below runs
   ~26–45% over `component-contracts.md §8`'s structural estimates — a byproduct of a
   spec-authorized mechanism choice (§3.1 explicitly allows "hiding the standalone
   rail tab-buttons... while its icons re-render inside the panel header" as option
   (a)), not a bug. Still far under the 5000-node ceiling in every case (see
   `ui/perf-notes.md`).
2. **`.primary-action` retained** (spec §5 `deleted_selectors` listed it for removal):
   the class is still referenced by the untouched `#pause-overlay-resume` button
   (out of scope per `hud-layout-spec.md §8`'s explicit non-goals). The programmer
   kept the CSS rule alive verbatim and gave `.sortie-fab` its own standalone rule
   block instead — confirmed zero visual/behavioral change to the pause overlay, zero
   unauthorized touch to out-of-scope code. Not an accessibility-relevant deviation.
3. **`.dock-panel-tabs .dock-rail-tab` 40x40 → 48x48 fix, plus a caught regression**:
   after this audit's finding #1 below (initial FIX-needed), the programmer bumped
   `.dock-panel-tabs .dock-rail-tab` to 48x48. That naive bump alone overflowed the
   left dock's 3-tab header (growth/companions/inventory, 3×48px=144px hard floor)
   past its 252px panel width at 360×800 (one of this project's own tested
   viewports), clipping `.dock-panel-close` outside the panel's `overflow:hidden`
   bounds and making it unreachable. Fix: `.dock-panel-tabs` itself gained
   `min-width:0; overflow-x:auto; -webkit-overflow-scrolling:touch;
   scrollbar-width:none` (same overflow-handling pattern the codebase already used
   for the old `.command-tab-bar`), so excess tab-strip width scrolls internally
   instead of pushing the close button off-panel. Independently re-verified below
   (§1) — not taken on the programmer's report alone.

## 1. Touch targets (gate: ≥48dp on every NEW interactive dock element)

```yaml
touch_targets_measured:
  dock_rail_tab_collapsed_rail:
    left_dock: [{ w_px: 48, h_px: 48 }, { w_px: 48, h_px: 48 }, { w_px: 48, h_px: 48 }]
    right_dock: [{ w_px: 48, h_px: 48 }, { w_px: 48, h_px: 48 }]
    verdict: PASS
    method: >
      tab.evaluate(() => el.getBoundingClientRect()) on
      '#command-dock-{left,right} .dock-rail .dock-rail-tab', compact tier (390x844)
      and wide tier (2056x1082), rail in its default (not-open) state.
  dock_panel_header_tabs_INSIDE_open_panel:
    initial_measurement: { left_dock: "40x40 (all 3 tabs)", right_dock: "40x40 (both tabs)" }
    initial_verdict: FAIL (below 48dp floor, see deviation #3 above)
    after_fix_measurement:
      left_dock_3_tabs_at_360x800: [{ w_px: 48, h_px: 48 }, { w_px: 48, h_px: 48 }, { w_px: 48, h_px: 48 }]
      right_dock_2_tabs_at_360x800: "not overflow-constrained (2x48=96px fits the panel), unaffected by the fix"
    regression_check_at_360x800_left_dock_3_tabs:
      panel_width_px: 252
      panel_right_edge_px: 252
      dock_panel_close_right_edge_px: 241
      close_button_within_panel_bounds: true
      tabs_strip_scrollWidth_px: 154
      tabs_strip_clientWidth_px: 140
      tabs_strip_overflowing_internally: true
      inventory_tab_reachable_via_scroll_and_clickable: true
    right_dock_2_tabs_overflow_check:
      scrollWidth_px: 140
      clientWidth_px: 140
      overflowing: false
      note: "2-tab side never needed the scroll fallback; confirmed no regression there either"
    verdict: PASS
    method: >
      Re-opened a fresh browser session at 360x800 (the narrowest tested viewport
      in this project's own matrix) after the fix landed, independently measured
      via tab.evaluate() getBoundingClientRect() on the tab buttons, the panel, and
      the close button; confirmed the previously-off-panel close button is now
      fully contained, all 3 left-dock tabs hold their full 48x48 target, the
      inventory tab (3rd, initially scrolled off) is reachable via scrollIntoView
      and produces a successful click (activeTab flips to "inventory"), and the
      2-tab right dock was unaffected. Not inferred from the programmer's report —
      independently reproduced.
  dock_panel_close_button:
    left_dock: { w_px: 44, h_px: 44 }
    right_dock: { w_px: 44, h_px: 44 }
    verdict: PASS
    gate_note: >
      Matches component-contracts.md §8's explicitly-authored exception (44px,
      reusing the project's existing base button floor for a non-primary dismiss
      action) exactly as specified — this is the ONE authorized <48px element, and
      it shipped at precisely the spec'd 44px, not smaller. Confirmed intentional,
      not a regression. Also confirmed to REMAIN fully on-panel and clickable at
      360x800 after the tab-target fix above (241px right edge vs. panel's 252px).
    method: tab.evaluate() getBoundingClientRect() on '.dock-panel-close', both docks.
  sortie_fab:
    measured: { w_px: 358.8, h_px: 56 }
    spec_floor: { min_width_px: 56, min_height_px: 56 }
    verdict: PASS
    note: >
      Width (358.8px, from `width: min(92vw, 26rem)`) far exceeds any floor; height
      is exactly the spec'd 56px minimum.
    method: tab.evaluate() getBoundingClientRect() on '#start-defense', compact tier.

overall_verdict: PASS
resolution_note: >
  Initial pass found dock_panel_header_tabs_INSIDE_open_panel at 40x40 (FAIL).
  Reported to the programmer; fix landed (48x48 floor + overflow-x:auto on the tab
  strip to prevent the close-button-clipping regression a naive size bump would
  cause at 360x800); independently re-measured and verified above. All 4 touch
  targets now PASS.
```

## 2. Contrast (dock panel/rail text against `.rc-glass` background)

```yaml
contrast_measured:
  methodology: >
    Screenshotted the LIVE rendered page (compact tier, right dock open, sortie tab
    active) at 1.25x devicePixelRatio, sampled actual composited pixel colors
    (PIL) at each text element's local background (glass gradient + relocated
    .dock-panel::before stage-art wash, both semi-transparent, as they actually
    paint — not the spec's assumed flat darkest-gradient-stop value), converted to
    WCAG relative luminance, computed contrast ratio = (L_lighter+0.05)/(L_darker+0.05).
    Also swept the full rendered panel region in an 8px grid to find the darkest
    ACTUAL on-screen pixel patch, for a true worst-case check independent of any
    single element's local background.
  darkest_actual_rendered_pixel_in_panel_region: { rgb: [9, 10, 16], hex: "#090a10" }
  measured_pairs:
    - element: ".dock-brand 'AC' text (#a6e2ff)"
      text_rgb: [166, 226, 255]
      local_bg_rgb_sampled: [52, 31, 49]
      contrast: 10.82
    - element: ".dock-briefing-line (#9ecce4)"
      text_rgb: [182, 200, 223]
      local_bg_rgb_sampled: [36, 25, 46]
      contrast: 9.82
    - element: ".dock-panel-body h2 (heading, inherited #eef5ff)"
      text_rgb: [238, 245, 255]
      local_bg_rgb_sampled: [21, 23, 39]
      contrast: 16.12
    - element: ".eyebrow AS RENDERED inside .dock-panel-body"
      text_rgb: [182, 200, 223]
      note: >
        DISCREPANCY from spec: hud-layout-spec.md §9 assumed .eyebrow renders as
        the "dimmest existing token" #8ca9c8 (rgb 140,169,200). It does NOT inside
        dock panels — `.dock-panel-body p { color: #b6c8df }` (styles.css:88) has
        higher CSS specificity (class+element vs. spec's assumed class-only) and
        wins the cascade, so .eyebrow-classed <p> elements inside a dock panel body
        actually render #b6c8df (lighter, safer direction). Flagging as an
        implementation/spec drift, not a failure — the ACTUAL dimmest text token
        rendering anywhere in a dock panel is `.briefing-stats dt` at #8fb9d2
        (measured next row), not the spec's assumed #8ca9c8.
      local_bg_rgb_sampled: [24, 25, 39]
      contrast: 10.23
    - element: ".briefing-stats dt (#8fb9d2) -- dimmest text token ACTUALLY rendered in any dock panel"
      text_rgb: [143, 185, 210]
      local_bg_rgb_sampled: [20, 22, 36]
      contrast: 8.58
      vs_darkest_actual_pixel_in_panel: 9.45
    - element: ".briefing-stats dd (#e2edf6)"
      text_rgb: [226, 237, 246]
      local_bg_rgb_sampled: [21, 22, 34]
      contrast: 15.11
    - element: ".briefing-target strong (boss name, inherited #eef5ff)"
      text_rgb: [238, 245, 255]
      local_bg_rgb_sampled: [17, 21, 37]
      contrast: 16.51
    - element: ".briefing-tip p (#b6c8df)"
      text_rgb: [182, 200, 223]
      local_bg_rgb_sampled: [11, 12, 24]
      contrast: 11.41
  worst_case_measured_contrast: 8.58   # dt term vs. its own local background
  worst_case_vs_darkest_actual_panel_pixel: 9.45  # dt term color vs the single
                                                    # darkest pixel found anywhere
                                                    # in the panel region
  wcag_aa_floor: 4.5
  wcag_aaa_floor: 7.0
  verdict: PASS (AAA)
  note: >
    Every measured text/background pairing clears AAA (7:1) with margin, using
    ACTUAL rendered/composited pixel colors (glass gradient + relocated stage-art
    wash overlay), not the spec's theoretical flat-gradient-stop assumption.
    Confirms spec §8/§9's "no new color tokens, inherits AAA" claim, with the minor
    correction that the ACTUAL worst-case token is #8fb9d2 (8.58:1), not the
    spec-assumed #8ca9c8 -- both clear AAA regardless.
  method: >
    tab.screenshot() (compact tier, 390x844, right dock open) + tab.evaluate() for
    element getBoundingClientRect()/computed color, cross-referenced pixel-for-pixel
    via PIL in a Python eval cell. Evidence images: /tmp/dock-compact-right-open.png,
    /tmp/dock-compact-scrolled.png (local temp files from this audit session).
```

## 3. Reduced-motion parity

```yaml
reduced_motion_measured:
  test_1_transition_suppressed:
    method: >
      browser.run with page.emulateMediaFeatures([{name:'prefers-reduced-motion',
      value:'reduce'}]), then tab.evaluate(() => getComputedStyle(openPanel)) on a
      currently-open '.dock-panel'.
    result: { transitionProperty: "none", transitionDuration: "0s", transform: "none" }
    baseline_without_reduced_motion: { transitionProperty: "transform", transitionDuration: "0.2s" }
    verdict: PASS -- transition genuinely suppressed under the media query, confirmed
      against a measured non-reduced baseline (not just asserting the CSS rule exists).
  test_2_no_transition_event_fires:
    method: >
      With reduced-motion active, attached a 'transitionrun' listener to `document`,
      clicked '.dock-panel-close', waited 250ms (longer than the normal 200ms
      transition would take), checked whether the event ever fired.
    result: { transitionFired: false, panelRemovedFromDom: true }
    verdict: PASS -- zero transition activity observed during an actual open/close
      interaction under reduced-motion, not merely a static CSS-rule check.
  secondary_finding_NOT_gate_blocking: >
    DockPanel is conditionally rendered (mounted/unmounted via innerHTML swap), never
    persisted with a toggled CSS class -- so even WITHOUT reduced-motion active, a
    freshly-mounted '.dock-panel' has no prior transform value to animate FROM
    (computed transform stays "none" immediately after mount and 250ms later; no
    'transitionrun' event fires even in the non-reduced-motion baseline). The 200ms
    `transition: transform 200ms ease` rule component-contracts.md §5 calls for
    currently never visually executes in EITHER motion-preference state -- it is
    inert CSS, not a functioning slide animation that reduced-motion suppresses.
    This does not fail the reduced-motion PARITY gate (nothing animates in either
    state, so there is nothing for a reduced-motion user to be exposed to that a
    full-motion user isn't) -- flagging as a visual-polish gap for the
    implementer/QA to decide whether the promised slide-in transition is worth
    wiring (e.g. via a mount-then-toggle-class pattern) as a follow-up, separate
    from this gate's pass/fail.
  dock_rail_width_collapse: >
    `.dock-rail[data-dock-open="true"]` has no `transition` property at all (snaps
    instantly regardless of motion preference) -- confirmed no reduced-motion
    exposure risk since there is no rail-collapse animation to begin with, in either
    preference state.
  global_reduced_motion_rule_present: >
    styles.css:248 -- a pre-existing project-wide rule
    `@media (prefers-reduced-motion: reduce) { *, *::before, *::after {
    transition:none!important; animation:none!important; ... } }` already covers
    EVERY element including `.dock-panel`, making the redesign's own added
    `.dock-panel { transition:none }` entry (styles.css:830, inside the
    cutscene-adjacent reduced-motion block per spec's "extend the existing list"
    instruction) redundant-but-harmless belt-and-suspenders, not a functional gap.
overall_verdict: PASS
```

## 4. Color-independent status encoding

```yaml
color_independent_encoding_measured:
  rail_tab_identity:
    method: >
      tab.ariaSnapshot() + tab.evaluate() querying '.dock-rail-icon' textContent and
      '.dock-rail-tab .sr-only' textContent across both docks.
    measured:
      icons: ["◆ (성장)", "❖ (동료)", "▦ (인벤토리)", "◈ (출정)", "▣ (요새)"]
      sr_only_labels_present: true
      distinct_glyph_per_tab: true
    verdict: PASS -- every rail tab ships a visually-distinct icon GLYPH (not just a
      color swatch) plus a screen-reader-only text label (`.sr-only`, confirmed
      `clip:rect(0,0,0,0)` pattern, NOT `aria-hidden` -- readable by AT, invisible
      sighted). Tab identity is never color-only; confirmed real icon+label markup
      shipped, matching component-contracts.md §3.1's a11y requirement verbatim.
    secondary_note_NOT_gate_blocking: >
      The SELECTED-tab visual indicator itself (`.dock-rail-tab[aria-selected="true"]`,
      styles.css:47) is color/border-only (cyan border + gradient tint, no icon
      change, no bold, no underline) -- a user with color vision deficiency may find
      it harder to spot which tab is active by sight alone. This is DIFFERENT from
      the gated requirement (which is about identity/meaning never being color-only,
      satisfied above) -- state is also programmatically exposed via `aria-selected`
      for AT users regardless. Flagging as a nice-to-have polish item, not a gate
      failure per the assignment's stated scope (icon+label shipped, confirmed).
  stage_card_status_encoding:
    method: tab.ariaSnapshot() on the sortie tab's stage-rail buttons.
    measured: >
      Each stage-card's accessible name includes an explicit status word appended
      as text content -- "01 Cinder Span Cinder Warden 선택됨" (selected), "02 Veil
      Citadel Veil Tactician 잠김" (locked, [disabled]) -- confirmed via
      `.stage-state` span rendering "잠김"/"전투 중"/"CLEAR"/"선택됨"/"출전 가능" text,
      not a color-only badge. Pre-existing pattern (unchanged by this redesign),
      reused verbatim inside the trimmed sortie dock panel.
    verdict: PASS
overall_verdict: PASS
```

## Summary verdict table

| # | Check | Threshold | Measured | Verdict |
|---|---|---|---|---|
| 1a | dock-rail-tab (collapsed rail) touch target | ≥48dp | 48×48 | PASS |
| 1b | dock-panel-header tab (open panel) touch target — initial | ≥48dp | 40×40 | FAIL → fixed |
| 1b | dock-panel-header tab (open panel) touch target — after fix, re-verified | ≥48dp | 48×48 (360×800, no clipping regression) | PASS |
| 1c | dock-panel-close touch target | 44dp (spec exception) | 44×44 | PASS |
| 1d | sortie-fab touch target | ≥56dp | 358.8×56 | PASS |
| 2 | Worst-case contrast, dock text vs. rc-glass | ≥7.0 (AAA) | 8.58:1 | PASS |
| 3 | Reduced-motion suppresses dock transition | transition suppressed | confirmed (no transitionrun, transition:none) | PASS |
| 4 | Rail-tab identity never color-only | icon+label present | confirmed | PASS |

**Overall gate verdict: PASS.** Initial pass found one issue —
`.dock-panel-header .dock-panel-tabs .dock-rail-tab` shipped at 40×40, below the
48dp floor, for a NEW interactive element not covered by the spec's authorized 44px
close-button exception. Reported to the programmer (`DockImplement`); fix landed
(48×48 floor plus `overflow-x:auto` on the tab strip to avoid clipping
`.dock-panel-close` off-panel at 360×800, a regression a naive size bump alone would
have caused) and was independently re-verified in-browser, not taken on report
alone. All checks now pass, several with wide margin (contrast measures
8.58–16.51:1 against a 7.0 floor).
