# Component Contracts — Lobby → Idle-Style Side-Dock Redesign

Author: ui-senior-developer · Run: `20260727-lobby-dock-redesign`
Companion to `ui/hud-layout-spec.md` (read that first for content mapping,
genre grounding, and the responsive-tier rationale). This document is the
implementation contract: state model, DOM structure, CSS positioning
strategy, event wiring, and migration checklist. No literal CSS/JS is
prescribed as copy-paste — every rule below states the exact mechanism,
selector target, and numeric value a programmer needs to implement it
directly in `app.js`/`styles.css` without further clarification.

## 1. State model — replaces `shellExpanded` / `activeCommandTab`

```yaml
removed_module_state:
  - "let shellExpanded = true;"              # app.js:141
  - "let activeCommandTab = COMMAND_TABS[0].id;" # app.js:135, COMMAND_TABS const itself also removed

new_module_state:
  dockOpen:
    type: "{ left: boolean, right: boolean }"
    initial: "computed by computeDefaultDockOpen() at mountShell() time (see §2)"
    invariant_compact_tier: "at most one of {left, right} is true whenever tier==='compact'"
    invariant_mid_run: "both false whenever session?.started === true, enforced at
      the moment beginRun() fires (not re-checked every render — see §5 run-start hook)"
  activeLeftDockTab:
    type: "'growth' | 'companions' | 'inventory'"
    initial: "'growth'"
    persists: "across dock close/reopen, across renders — same lifetime as
      today's activeGrowthSegment"
  activeRightDockTab:
    type: "'sortie' | 'stronghold'"
    initial: "'sortie'"
  dockTier:
    type: "'wide' | 'compact'"
    source: "matchMedia('(min-width: 900px)').matches ? 'wide' : 'compact'"
    recompute_trigger: "matchMedia change listener (see §5), NOT a plain
      resize listener — avoids re-deriving on every pixel of a drag-resize"
  # UNCHANGED, reused verbatim, still module-level:
  # activeGrowthSegment, activeCompanionSegment (sub-nav within the growth/
  # companions dock tabs — untouched, same 'stats'|'skills'|'traits' and
  # 'list'|'formation' values as today)
```

```yaml
computeDefaultDockOpen: # called once at mountShell(), and again whenever
                         # dockTier flips (see §5)
  wide:   "{ left: true, right: true }"
  compact: "{ left: false, right: true }"   # right (Ops/sortie) open by
                                             # default at EVERY viewport —
                                             # see hud-layout-spec.md §5.1 for
                                             # why (load-time test contract
                                             # + genre "map is home" convention)
```

### 1.1 Test impact (explicit — implementer must action this)

`tests/defense-survivor-browser.cjs` (L100-101, and 3 more call sites) and
`tests/defense-hud-responsive-browser.cjs` (L44-46) click `#start-defense`
and read `[data-stage="…"]` immediately after page load at 390×844 with no
prior interaction. Because `computeDefaultDockOpen('compact') = { left:
false, right: true }` keeps the sortie tab (containing both) open by
default, **these specific assertions continue to pass unmodified**. No other
existing test clicks `data-growth-segment`, `data-companion-segment`,
`data-companion`, or `data-warden-*` controls without first navigating a
tab (confirmed: zero matches in `tests/` for those selectors before this
change), so the left dock defaulting closed at compact tier introduces no
other test breakage. State this explicitly in the PR description; do not
silently rely on it holding.

## 2. DOM structure — before/after diff

### 2.1 Before (current, `app.js` L879-905 `mountShell()` + L701-712 `renderCommandShell()`)

```
#defense-app (root)
├── #defense-battle-surface (unchanged, persistent)
│   └── … canvas, world-hud-overlay, defense-edge-hud … (untouched)
└── #command-shell                          [position:fixed;inset:0]
    ├── button#shell-dock-toggle            [FAB, fixed, top-right]
    └── .command-shell-inner                [scroll container, centered, max 1180px]
        ├── header.command-header           [brand mark + status]
        ├── p#idle-return-summary           [always-in-DOM banner]
        ├── nav.command-tab-bar             [5 tab buttons, sticky]
        ├── div.command-tab-panel           [ONE of 5 tab bodies, swapped on click]
        └── details.archive-tools           [export/import/reset — DUPLICATED
                                              inside stronghold tab body too]
```

### 2.2 After

```
#defense-app (root)
├── #defense-battle-surface (UNCHANGED, persistent — not touched by this pass)
│   └── … canvas, world-hud-overlay, defense-edge-hud … (untouched, except
│         the CSS rule change in §7)
├── #command-dock-left                      [replaces #command-shell's left half]
│   ├── nav.dock-rail  data-dock-side="left"
│   │   ├── button.dock-rail-tab  data-dock-tab="growth"       (icon + sr-only label)
│   │   ├── button.dock-rail-tab  data-dock-tab="companions"
│   │   └── button.dock-rail-tab  data-dock-tab="inventory"
│   └── section.dock-panel  [rendered ONLY when dockOpen.left === true — see §2.4]
│       ├── header.dock-panel-header
│       │   ├── span.dock-brand ("AC" mark, small)
│       │   ├── nav.dock-panel-tabs  [same 3 tabs, now inline in the open panel]
│       │   └── button.dock-panel-close
│       └── div.dock-panel-body  [ONE of growth/companions/inventory tab HTML —
│                                  IDENTICAL innerHTML to today's renderGrowthTab()/
│                                  renderCompanionsTab()/renderInventoryTab() output]
├── #command-dock-right                     [mirror of left, data-dock-side="right"]
│   ├── nav.dock-rail  data-dock-side="right"
│   │   ├── button.dock-rail-tab  data-dock-tab="sortie"
│   │   └── button.dock-rail-tab  data-dock-tab="stronghold"
│   └── section.dock-panel  [rendered ONLY when dockOpen.right === true]
│       ├── header.dock-panel-header  [same shape as left]
│       └── div.dock-panel-body  [TRIMMED sortie tab (§hud-layout-spec.md §4) OR
│                                  stronghold tab, single archive-tools copy]
├── button#start-defense.sortie-fab         [VISIBLE only pre-run; REMOVED
│                                             from DOM once session?.started,
│                                             not just hidden — mirrors today's
│                                             conditional rendering pattern]
└── output#idle-return-toast                [rendered ONLY once, on load, IF
                                              idleReturnSummary().outcome is
                                              non-empty; self-removes on
                                              dismiss/timeout — same lifecycle
                                              class as showToast()'s existing
                                              .edge-card.defense-toast]
```

`#command-shell` as an id/wrapper is **deleted entirely** — there is no
single "shell" container left; `#command-dock-left` and `#command-dock-right`
are two independent siblings of `#defense-battle-surface`, each `position:
fixed`, each covering only its own edge, never the full viewport. This is
the structural guarantee that the full-bleed canvas can never again be
covered by one monolithic overlay node.

### 2.3 What is REUSED verbatim inside `.dock-panel-body`

`renderGrowthTab()`, `renderCompanionsTab()`, `renderInventoryTab()` bodies:
byte-identical HTML output to today (same `.growth-panel`/`.loadout-panel`
markup, same `data-growth-segment`/`data-companion-segment`/`data-warden-*`/
`data-companion`/`data-command-tab`→now `data-dock-tab` attributes for event
delegation). Only the OUTER wrapper they're injected into changes (dock
panel body instead of `.command-tab-panel`). `renderStrongholdTab()` is
reused with its ALREADY-PRESENT `<details class="archive-tools">` kept; the
duplicate copy that today lives in `renderCommandShell()`'s own template
(app.js:711) is deleted, not moved.

### 2.4 Render-only-when-open (the DOM-count lever)

`.dock-panel` (header + body) is only present in the DOM while that dock's
`dockOpen.{side}` is true — same pattern the current `#command-shell`
already uses for `.command-tab-panel` (only the ACTIVE tab's body exists,
inactive tabs render nothing), extended one level up: a fully collapsed
dock renders NOTHING but its rail (6-9 nodes). This is a net DOM-count
IMPROVEMENT over today, where the full `.command-shell-inner` (header +
banner + tab-bar + one tab body + archive-tools) always exists in the DOM,
merely `opacity:0;visibility:hidden` when collapsed
(`styles.css:20` — `#command-shell[data-expanded="false"]
.command-shell-inner { opacity: 0; … visibility: hidden; }`) — today's
"collapsed" state pays the FULL node cost and hides it visually; this
design's collapsed state pays almost none.

## 3. Component contracts

### 3.1 `DockRail` (one instance per side: left, right)

```yaml
DockRail:
  dom: "nav.dock-rail[data-dock-side='left'|'right']"
  props_read_from_module_state:
    - "tabs: the 3 (left) or 2 (right) { id, label, icon } entries for this side"
    - "activeTab: activeLeftDockTab | activeRightDockTab"
    - "isOpen: dockOpen.left | dockOpen.right"
  render_rule: >
    ALWAYS rendered, at every tier, in every dock state (open or collapsed).
    When isOpen===true, the rail's own tab-strip visually merges into the
    adjacent panel header (§2.2) — implementation note: this can be done by
    either (a) hiding the standalone rail tab-buttons for the OPEN side via
    a `[data-dock-open="true"]` attribute selector while its icons re-render
    inside `.dock-panel-header nav.dock-panel-tabs`, or (b) keeping one
    physical button set and having CSS reposition it into the header via
    the same `.dock-panel-header` flex row. Either is acceptable; the
    OBSERVABLE contract is: when a dock is open, its own tab-switcher UI
    must not occupy a second 56px column outside the panel (see
    hud-layout-spec.md §5.4 canvas-visibility math, which assumes exactly
    one 56px rail width when a panel is open, not rail+panel-header both
    showing tabs).
  events:
    - "click on a rail tab button when isOpen===false → sets
       dockOpen.{side}=true, activeTab={clicked id}; on compact tier ALSO
       sets the OTHER side's dockOpen=false (single-exclusive-panel rule,
       hud-layout-spec.md §5.3)"
    - "click on a rail tab button when isOpen===true and it's already the
       active tab → sets dockOpen.{side}=false (acts as the close toggle)"
    - "click on a rail tab button when isOpen===true and it's a DIFFERENT
       tab → sets activeTab={clicked id}, dockOpen.{side} stays true (tab
       switch within an already-open dock, no close/reopen flicker)"
  a11y:
    - "role='tablist' on the <nav>, role='tab' + aria-selected on each
       button, aria-controls pointing at the dock-panel's id when open"
    - "each button carries a visible icon glyph + a visually-hidden
       (.sr-only, NOT aria-hidden) text label — reuses the project's
       existing color-independent-encoding rule (role badges, entity
       nameplates) so rail icons are never meaning-by-color/shape alone
       without a text fallback for screen readers"
  touch_target: "48x48px button, centered in the 56px rail column (4px
    gutter each side) — see §8 gate block"
```

### 3.2 `DockPanel` (one instance per side, conditionally rendered)

```yaml
DockPanel:
  dom: "section.dock-panel[data-dock-side='left'|'right']"
  mount_condition: "dockOpen.{side} === true (else: not in DOM, per §2.4)"
  props_read_from_module_state:
    - "activeTab: activeLeftDockTab | activeRightDockTab"
    - "tabBodyHtml: result of calling the SAME existing render function
       (renderGrowthTab/renderCompanionsTab/renderInventoryTab for left;
       trimmed-sortie/renderStrongholdTab for right) keyed by activeTab"
  header_contents: "small brand glyph (replaces the dropped .command-header
    masthead, hud-layout-spec.md §4) + inline tab nav (see DockRail render_rule
    above) + close button (×)"
  events:
    - "click on .dock-panel-close → dockOpen.{side}=false"
    - "click on a .dock-panel-header tab button → same activeTab-switch
       behavior as DockRail's 'different tab' case above (same dock stays open)"
    - "all EXISTING per-tab-body handlers (data-growth-segment,
       data-companion-segment, data-stage, data-companion, data-warden-stat,
       data-warden-skill, data-warden-trait, data-warden-equip-owner,
       data-warden-formation, export/import/reset/telemetry buttons) are
       re-attached identically to today, scoped to
       `dockPanelEl.querySelectorAll(...)` instead of
       `shell.querySelectorAll(...)` — same delegation pattern, same
       callback bodies, no logic change (see §4 table)"
  read_only_binding_rule: >
    DockPanel content NEVER mutates `session`/`this.run`'s live sim state
    directly — every interactive control here calls an existing pure
    campaign-state transition function (allocateWardenStatPoint,
    unlockWardenSkillNode, selectWardenTrait, purchaseEquipmentTier,
    setCompanionFormationSlot, setCompanionLoadout) and reassigns the
    returned new `campaign` object, then persists and re-renders — IDENTICAL
    to every existing handler in today's renderCommandShell(). This is the
    same non-mutating-observer discipline the codebase already applies to
    battle-realtime-three.js's VFX/nameplate rendering (reads `snapshot`,
    NEVER calls mutation methods on `this.run` — grep-verified: no
    write-path calls from that module into defense-run-simulation.js). The
    ONLY sim-adjacent action a dock button performs is the sortie FAB's
    `session?.beginRun()` call, which is the SAME single call
    `#start-defense`'s handler already makes today (app.js:808) — not a new
    write path.
  max_height_mid_run: >
    When mounted while `session?.started === true` (mid-run peek), the panel
    is height-capped so `#defense-edge-hud`'s `.defense-bottom` row (gate-
    panel, one-thumb-controls D-pad, hud-actions skill bar) stays reachable
    underneath it — see §6 for the exact reserve calculation.
```

### 3.3 `SortieFab` (was `#start-defense`)

```yaml
SortieFab:
  dom: "button#start-defense.sortie-fab"   # id UNCHANGED — required by
                                            # tests/defense-survivor-browser.cjs
                                            # and tests/defense-hud-responsive-browser.cjs
                                            # selector `#start-defense`
  position: "fixed, bottom-center, thumb-zone (see §6 for exact placement)"
  render_condition: "session?.started === false — REMOVED from DOM (not
    just hidden) once true, matching today's ternary in sortieTabHtml
    (app.js:657-659) that already swaps the CTA for a live-status <p> on
    start; the live-status note now has no home once the sortie hero-copy
    is trimmed (hud-layout-spec.md §4) — fold it into the sortie dock-panel
    header's compact briefing line instead: '전투 진행 중 · {stage} ·
    {boss}' replaces '{stage} · {boss}' when started===true, same string,
    reused verbatim"
  events:
    - "click → session?.beginRun(); THEN force dockOpen={left:false,
       right:false} (run-start collapse, hud-layout-spec.md §6); re-render"
  label: "same copy as today: '작전 개시' / '{selected.name} · {selected.bossName} 전선으로'"
```

### 3.4 `IdleReturnToast`

```yaml
IdleReturnToast:
  dom: "output#idle-return-toast.idle-return-toast" # NOT .edge-card (that
                                                      # class lives inside
                                                      # #defense-battle-surface
                                                      # and is z-index'd
                                                      # relative to it,
                                                      # styles.css:69) — this
                                                      # toast is a shell-level
                                                      # sibling, needs its own
                                                      # top-center fixed rule,
                                                      # same visual language
                                                      # (border/background)
                                                      # as .edge-card, reused
  mount_condition: "once, at mountShell() time, only if
    idleReturnSummary().outcome is non-empty; self-removes on manual
    dismiss (click) or an 8s auto-timeout (same duration convention as
    showToast()'s default durationMs=4000, doubled here since this message
    is read-once at cold load, not a mid-battle transient — implementer may
    tune, not gate-checked)"
  secondary_placement: "idleReturnSummary().text also renders as a
    <p class='idle-return-recap'> at the top of the stronghold dock-panel
    body, ALWAYS present whenever that panel is open (not just once) —
    unlike the toast, this one persists so a player can re-check it later"
  aria: "role='status' aria-live='polite', same as today's
    #idle-return-summary"
```

## 4. Event wiring table (old → new)

```yaml
- old: "shell.querySelector('#shell-dock-toggle')?.addEventListener('click', …)"
  new: "REMOVED — no single toggle; each DockRail tab button and each
        DockPanel close button independently open/close their own side"
- old: "shell.querySelectorAll('[data-command-tab]') → activeCommandTab = …"
  new: "SPLIT into DockRail/DockPanel tab clicks scoped per side → sets
        activeLeftDockTab or activeRightDockTab depending on which dock's
        rail/panel the click originated in (data-dock-side attribute read
        from the closest('[data-dock-side]') ancestor, or simply two
        separate querySelectorAll calls scoped to #command-dock-left vs.
        #command-dock-right — either works, latter is simpler)"
- old: "shell.querySelectorAll('[data-growth-segment]') → activeGrowthSegment = …"
  new: "UNCHANGED logic, re-scoped to query within #command-dock-left
        (wherever the growth tab body is currently mounted)"
- old: "shell.querySelectorAll('[data-companion-segment]') → activeCompanionSegment = …"
  new: "UNCHANGED logic, re-scoped to #command-dock-left"
- old: "shell.querySelectorAll('[data-stage]') → selectedStageId = …; session?.remountForStage(...)"
  new: "UNCHANGED logic, re-scoped to #command-dock-right (sortie tab body)"
- old: "shell.querySelectorAll('[data-companion]') → setCompanionLoadout(...)"
  new: "UNCHANGED logic, re-scoped to #command-dock-left (companions tab body)"
- old: "shell.querySelectorAll('[data-warden-stat|skill|trait|equip-owner|formation]')"
  new: "UNCHANGED logic, re-scoped to #command-dock-left (respective tab bodies)"
- old: "shell.querySelector('#start-defense')?.addEventListener('click', () => {
        session?.beginRun(); shellExpanded = false; renderCommandShell(); })"
  new: "SortieFab click → session?.beginRun(); dockOpen = {left:false,
        right:false}; render()"
- old: "shell.querySelector('#export-defense'|'#export-telemetry'|
        '#import-defense'|'#reset-defense')"
  new: "UNCHANGED logic, re-scoped to #command-dock-right (stronghold tab
        body, single copy — see hud-layout-spec.md §4 archive-tools
        de-dup)"
- new_only: "matchMedia('(min-width: 900px)') change listener → recompute
        dockTier, re-run computeDefaultDockOpen() ONLY if the tier actually
        flipped since last render (avoid clobbering a user's manual
        open/close mid-session on every resize event within the same tier)"
```

## 5. CSS positioning strategy (mechanism + exact values, not literal CSS)

```yaml
command-dock-left / command-dock-right:
  position: fixed
  inset_rule: "top:0; bottom:0; left:0 (left dock) / right:0 (right dock);
    height:100dvh"
  width: "auto (content-sized: rail width alone when collapsed, rail+panel
    when open) — do NOT set an explicit width on the outer wrapper; let
    .dock-rail and .dock-panel each carry their own fixed width so the
    wrapper's total footprint is simply their sum"
  pointer_events: "auto on the wrapper itself (unlike today's
    #command-shell, which sets pointer-events:none on its full-viewport
    wrapper because that wrapper spans the whole screen and must let clicks
    through to the D-pad underneath — these new wrappers are edge-anchored
    and narrow, so there is no 'dead zone over the canvas' problem to work
    around)"
  z_index: "4 — matches .edge-card (styles.css:69) and sits above
    #defense-edge-hud's 3 (styles.css:792) so a mid-run peek panel is
    legible over the combat HUD, but below #defense-pause-overlay's 5
    (styles.css:350) so an explicit pause always wins visually over an
    open dock"
  safe_area: "apply env(safe-area-inset-left)/-right/-top/-bottom padding
    directly on .dock-rail and .dock-panel (same env() fallback pattern
    .shell-dock-toggle already uses at styles.css:21, since these wrappers
    are siblings of #defense-battle-surface and do NOT inherit its
    --defense-safe-* custom properties, which are scoped to that element's
    own selector block, styles.css:33-46)"

.dock-rail:
  width: "3.5rem (56px), fixed, ALL tiers"
  layout: "flex column, buttons centered, gap between icons ~0.5rem"
  background: "reuse .rc-glass (styles.css:445) verbatim — translucent,
    blurred, matches existing hud-panel/edge-card material language"
  full_height: "100%, so it always reads as a persistent full-height edge
    presence (the literal 'flanking rail' the request asks for)"

.dock-panel:
  width: "clamp(15rem, 70vw, 21rem) — SAME formula at every tier
    (hud-layout-spec.md §5.4); do NOT special-case wide vs. compact widths
    separately, one clamp() covers both because 70vw naturally saturates to
    the 21rem cap above ~480px viewport width"
  full_height: "100dvh at wide tier and pre-run compact tier; height-capped
    mid-run at compact tier — see §6"
  overflow_y: "auto (same scrollable-body pattern as today's
    .command-shell-inner)"
  transition: "transform (translateX) 200ms ease when opening/closing —
    same duration/easing as today's .command-shell-inner opacity/transform
    transition (styles.css:19), wrapped in the SAME
    @media (prefers-reduced-motion: reduce) { transition:none } guard
    already present at styles.css:975-980"

container_query_note: >
  Because .dock-panel's width is IDENTICAL at every viewport tier (clamp
  saturates the same way whether the outer viewport is 390px or 2056px, so
  long as it's above ~480px), the panel's OWN internal content — stage-
  card grid, growth-stat-grid, etc. — can reuse the EXISTING ≤620px
  "compact" style variants (styles.css:948-967) as its baseline appearance
  rather than the ≥900px wide variants, applied via a container query
  (`container-type: inline-size` on .dock-panel-body, `@container
  (min-width: …)` for any panel-internal breakpoint) INSTEAD OF a viewport
  media query — the panel is always narrow relative to the viewport, so its
  internal layout must respond to ITS OWN width, not the window's. This is
  the one genuinely new CSS mechanism this redesign introduces (container
  queries did not exist in the codebase's dock-adjacent CSS before); every
  other rule above reuses an existing mechanism (fixed positioning, env()
  safe-area, clamp(), rc-glass, prefers-reduced-motion guards).

deleted_selectors:
  - "#command-shell (and its position:fixed;inset:0 rule, styles.css:18)"
  - ".command-shell-inner (both declarations, styles.css:19 and :568)"
  - "#command-shell[data-expanded='false'] .command-shell-inner (styles.css:20)"
  - ".shell-dock-toggle (styles.css:21)"
  - "#command-shell::before (styles.css:569-581, the stage-art backdrop wash
     — RELOCATE this decorative background wash onto .dock-panel instead,
     same --stage-art custom property source, so opening a dock still shows
     the subtle stage-tinted backdrop it does today)"
  - ".command-header, .brand-lockup, .command-status, .signal-dot
     (styles.css:133-138, 582-600) — masthead dropped per hud-layout-spec.md §4"
  - ".command-hero, .hero-copy, .hero-facts, .primary-action,
     .tactical-map/.stage-atlas and its ::before/::after/children
     (styles.css:139-176, 641-660, 700-724+ and the @media 900px/620px
     rules touching them) — dropped per hud-layout-spec.md §4"
  - ".ops-grid, .ops-grid-sortie (styles.css:177, 344) — the sortie tab's
     2-column stage-rail+briefing grid becomes a single-column stack inside
     the narrow dock panel; the grid rules no longer apply"
  - ".command-tab-bar, .command-tab, .command-tab-panel (styles.css:335-338,
     601-631) — replaced by .dock-rail/.dock-panel-tabs"
new_selectors_to_add:
  - "#command-dock-left, #command-dock-right, .dock-rail, .dock-rail-tab,
     .dock-panel, .dock-panel-header, .dock-panel-tabs, .dock-panel-close,
     .dock-panel-body, .sortie-fab, .idle-return-toast, .idle-return-recap"
retained_unchanged_selectors:
  - ".growth-panel, .growth-stat-grid, .growth-skill-grid,
     .growth-equip-grid, .growth-trait-offers, .loadout-panel,
     .loadout-slots, .companion-grid, .archive-panel, .archive-summary,
     .reward-grid, .command-segment-bar, .command-segment,
     .command-segment-body, .briefing-panel (content moves into the sortie
     dock panel; the class + its rules stay), .briefing-target,
     .briefing-stats, .stage-rail, .stage-card, .mission-panel (same fate
     as .briefing-panel), .idle-return-banner (class kept, reused by
     .idle-return-recap)"
```

## 6. Mid-run height reserve (protecting the D-pad/skill bar)

```yaml
mid_run_dock_panel_max_height:
  reserve_bottom: "keep the bottom max(3.5rem, var(--defense-safe-bottom) +
    3.5rem) of the viewport clear — 3.5rem approximates the D-pad's own
    rendered height (5 buttons at min 44px + gaps + safe-area, matching
    .one-thumb-controls' own sizing, styles.css:242-243) plus a small
    buffer so the panel's bottom edge never visually touches the live
    controls"
  mechanism: "apply this reserve via a max-height calc() ONLY when
    #defense-battle-surface[data-defense-started='true'] — gate the rule
    with that existing attribute selector so pre-run panels stay full-height
    (there is no D-pad to protect before a run starts) and mid-run panels
    are height-capped, anchored to the TOP of the viewport (top:0, the
    calc'd max-height, NOT bottom:0) so the visible edge-HUD top panels and
    the dock panel don't fight for the same top-edge space either — accept
    minor visual overlap with .hud-mission/.hud-loop-state at the very top
    corner (both translucent, this already happens between .hud-mission and
    .hud-loop-state themselves today) rather than pushing the dock panel
    down and shrinking it further"
```

## 7. Required CSS rule change outside the dock system (edge-HUD decoupling)

```yaml
file: styles.css
location: "lines 54-55"
before: |
  #defense-battle-surface[data-defense-started="false"] #defense-edge-hud,
  #defense-battle-surface[data-shell-expanded="true"] #defense-edge-hud { display: none; }
after: |
  #defense-battle-surface[data-defense-started="false"] #defense-edge-hud { display: none; }
also_remove:
  file: app.js
  location: "L641-642 (renderCommandShell()'s surfaceEl.dataset.shellExpanded
    write) — the whole shellExpanded concept is gone (§1), and nothing
    reads this dataset attribute once the second CSS selector above is
    deleted"
rationale_pointer: "hud-layout-spec.md §6 and §7"
```

## 8. Gate-checkable numbers (implementation-ready detail; summary also in hud-layout-spec.md §9)

```yaml
touch_targets:
  dock_rail_tab_button: { width_px: 48, height_px: 48 }
  dock_panel_close_button: { width_px: 44, min_height_px: 44 } # matches
    # the project's BASE button floor (styles.css:5, min-width/height:44px)
    # since this is a secondary dismiss action, not a primary nav target —
    # the STRICTER 48px floor applies specifically to rail nav buttons and
    # every dense-panel interactive control per the existing
    # UNIFIED-GDD.md §6.3 precedent already codified at styles.css:250-257
    # (.growth-panel summary, .growth-stat-row/.growth-skill-node/
    # .growth-equip-slot buttons all min 48px) — dock panel bodies reuse
    # those exact classes verbatim, so they inherit the 48px floor for free
  sortie_fab: { min_width_px: 56, min_height_px: 56 } # primary CTA, sized
    # above the 48dp floor to read as the single most prominent tappable
    # element on screen pre-run, consistent with its role
  gate: "every NEW interactive element introduced by this redesign is
    >=48dp in both dimensions; the one exception (dock-panel-close at 44px)
    is justified above as reusing the project's existing base button floor
    for a non-primary dismiss action — flag for reviewer if 48px is
    preferred there instead, trivial to bump"

dom_count_estimate:
  methodology: >
    Static baseline (canvas + world-hud-overlay + edge-hud markup, ALWAYS
    present, unchanged by this redesign) + variable dock chrome (rails
    always present; panel nodes only when open, counted per active tab
    using the SAME markup functions' existing output, cross-referenced
    against actual catalog sizes: 10 STAGES, 6 WARDEN_STATS, 5
    WARDEN_SKILL_TREE nodes, <=3 offered WARDEN_TRAITS at once, 3
    EQUIPMENT_SLOTS x 5 EQUIPMENT_TIERS, MAX_FRONT_SLOTS=2, up to 9
    companion prototypes across 3 COMPANION_ROLES).
  static_baseline_pre_run: 35    # canvas, world-hud-overlay (empty pre-run),
                                  # edge-hud subtree (present but
                                  # display:none pre-run — still counted,
                                  # querySelectorAll('*') counts hidden nodes)
  static_baseline_mid_run: 75    # edge-hud now display:block with its full
                                  # mission/loop-state/D-pad/skill-bar subtree
  dock_rails_both_collapsed: 20  # 2 rails x (nav + ~3-4 buttons x 2 nodes
                                  # [button+icon/label] + wrapper) ≈ 10 each
  dock_panel_by_active_tab:
    growth_stats: 27       # header(~6) + segment-bar(3 buttons=6) + 6 stat
                            # rows x ~3 nodes
    growth_skills: 25       # header+segment-bar(~12) + 5 skill nodes x ~3
    growth_traits: 18       # header+segment-bar(~12) + <=3 trait cards x ~3
    companions_list: 45     # header(~6) + segment-bar(~8) + 3 loadout slots
                            # x ~4 + up to 9 companion cards x ~5
    companions_formation: 30 # header+segment-bar(~14) + 2 front + up to 7
                            # back formation rows x ~3
    inventory: 76           # header(~6) + up to 4 equip owners (warden + 3
                            # loadout) x (owner wrapper + 3 slots x ~5 nodes)
    sortie_trimmed: 55      # header/briefing(~10) + 10-stage rail x ~6 nodes
                            # each (art/index/info/state) — DOWN from
                            # today's larger hero+atlas markup per
                            # hud-layout-spec.md §4 content drops
    stronghold: 70          # idle-recap(~2) + archive-summary(~8) + up to
                            # 10 reward cards x ~4 + archive-tools details(~10)
  worst_case_single_panel_open_compact: >
    35 (static) + 20 (both rails) + 76 (inventory, heaviest single tab) +
    ~10 (sortie-fab/toast wrapper) = ~141
  worst_case_both_panels_open_wide: >
    35 (static) + 20 (both rails) + 76 (inventory) + 70 (stronghold) +
    ~10 = ~211
  worst_case_mid_run_one_panel_peeked: >
    75 (static, edge-hud live) + 20 (both rails) + 76 (heaviest peeked
    panel) = ~171
  ceiling_from_existing_perf_test: 5000   # tests/defense-performance-browser.cjs:174
  headroom: "every estimated worst case above is <5% of the existing
    budget; this redesign has effectively zero DOM-count risk against the
    shipped gate. These are STRUCTURAL estimates from markup-function
    inspection, not measured values — re-run
    tests/defense-performance-browser.cjs after implementation to confirm,
    per hud-layout-spec.md §9."

input_latency:
  budget_ms: 100  # tests/defense-performance-browser.cjs:184, project-wide,
                  # unchanged
  dock_specific_contract: >
    Every dock state transition (rail tap → panel open, panel-tab switch,
    close button, sortie FAB click) must perform its DOM mutation
    SYNCHRONOUSLY inside the triggering click handler — no
    setTimeout/requestAnimationFrame/await between the event and the
    visible DOM change, matching every existing renderCommandShell() click
    handler's pattern today (direct assignment + synchronous re-render
    call, e.g. app.js:716-719's data-command-tab handler). The 200ms CSS
    transition (§5) is a VISUAL ease-in on top of an already-applied DOM
    state change, not a delay before the change — the new class/attribute
    that drives the transition is set in the same synchronous tick as the
    click, so the "input observable" contract
    tests/defense-performance-browser.cjs:184-186 checks (via
    data-defense-input-seq for D-pad/skill input, not dock UI specifically)
    is satisfied by construction for the analogous dock interactions even
    though no existing automated test currently measures dock-click latency
    directly — flag as a QA follow-up if a dedicated assertion is wanted.

contrast:
  approach: "reuse .rc-glass (styles.css:398-445) token pair verbatim for
    .dock-rail and .dock-panel backgrounds — var(--rc-panel-glass) /
    var(--rc-panel-border), NO new color tokens introduced"
  text_tokens_reused: "#eef5ff (body, root default), #dff3ff (headings,
    .command-shell-inner h1/h2 today), #b6c8df (secondary, .command-shell-inner p
    today), #8ca9c8 (.eyebrow/.hud-eyebrow, dimmest existing token)"
  measured_ratios: # WCAG relative-luminance contrast, computed against the
                    # DARKEST stop of --rc-panel-glass's gradient
                    # (rgb(16 10 28)), i.e. the worst case
    body_text_vs_glass: 17.69
    heading_text_vs_glass: 17.00
    secondary_text_vs_glass: 11.38
    dimmest_existing_token_vs_glass: 7.97
  wcag_aa_floor: 4.5
  wcag_aaa_floor: 7.0
  verdict: "every reused text token clears AAA (7:1) against the reused
    glass background's worst-case (darkest) gradient stop; no new
    contrast risk introduced since no new colors are added"
```

## 9. Accessibility notes (beyond the gate numbers above)

- Focus management: opening a dock panel moves focus to its
  `.dock-panel-header` first focusable element (mirrors the existing
  `#defense-pause-overlay` pattern at `app.js:2113` area, which focuses
  logically after building its markup); closing returns focus to the rail
  button that opened it (mirrors `togglePause()`'s existing
  `focusBeforePause` save/restore pattern at `app.js:2047,2049` — reuse
  that exact save/restore idiom, do not invent a new one).
- `aria-expanded` on each rail's active tab button, reflecting its dock's
  `dockOpen.{side}` state.
- Reduced motion: dock open/close transform transitions are wrapped in the
  existing `@media (prefers-reduced-motion: reduce)` block
  (`styles.css:975-980`) alongside `.command-shell-inner`'s current entry —
  add `.dock-panel` to that same rule list, do not create a second
  reduced-motion block.

## 10. Migration checklist

```yaml
app.js:
  remove: ["COMMAND_TABS const (L128-134)", "activeCommandTab (L135)",
    "shellExpanded (L141)", "renderCommandShell()'s single-function shape
    (L627-855) — split into renderDockLeft()/renderDockRight()/
    renderSortieFab()/renderIdleReturnToast(), each targeting its own
    persistent DOM node", "mountShell()'s single
    '<div id=\"command-shell\"></div>' (L905) — replaced with the 4
    persistent sibling nodes from §2.2", "surfaceEl.dataset.shellExpanded
    write (L641-642)"]
  add: ["dockOpen/activeLeftDockTab/activeRightDockTab/dockTier module
    state (§1)", "computeDefaultDockOpen() (§1)", "matchMedia('(min-width:
    900px)') change listener (§4 new_only row)", "renderDockLeft()/
    renderDockRight() functions per §2.2/§3", "renderSortieFab()/
    renderIdleReturnToast() per §3.3/§3.4"]
  keep_unchanged: ["renderGrowthTab()", "renderCompanionsTab()",
    "renderCompanionsListSegment()", "renderInventoryTab()",
    "renderStrongholdTab() (minus nothing — its archive-tools copy is the
    one that SURVIVES, per hud-layout-spec.md §4)", "wardenStatsMarkup()",
    "wardenSkillsMarkup()", "wardenTraitsMarkup()",
    "equipmentOwnersMarkup()", "formationRowMarkup()", "all campaign-state
    mutation call sites and their try/catch error-to-statusText handling",
    "BattleSession class and its tick loop, pause overlay, edge-hud
    rendering — entirely untouched"]
  sortie_tab_specific_change: "trim sortieTabHtml (§hud-layout-spec.md §4):
    remove hero-copy block and tactical-map/stage-atlas block; fold their
    kept data (hazard/flank/chokepath/elevation/occupation/extraction/
    landmarks) into the existing briefing <dl>; keep the stage-rail
    unchanged"

styles.css:
  remove: "see §5 deleted_selectors list"
  add: "see §5 new_selectors_to_add list"
  edit: "§7's edge-hud visibility rule (delete the data-shell-expanded
    clause, keep the data-defense-started clause)"
  keep_unchanged: "see §5 retained_unchanged_selectors list, plus
    everything under 'World-space HUD overlay' (L83-129), all
    #defense-battle-surface/#defense-canvas/#defense-edge-hud/.hud-panel/
    .one-thumb-controls/.gate-panel rules (L33-73, L217-247),
    #defense-pause-overlay/.pause-overlay-panel (L349-353), .rc-* utility
    classes (L389-546), cutscene rules (L346-, L890-940)"

tests_to_review_post_implementation:
  - "tests/defense-survivor-browser.cjs — confirm '#command-shell
     #start-defense' selector: since #command-shell no longer exists,
     update to '#start-defense' alone (id is preserved per §3.3, just no
     longer nested under a #command-shell wrapper) — REQUIRED edit, not
     optional, or these 4 call sites fail on the selector alone regardless
     of dock behavior"
  - "tests/defense-hud-responsive-browser.cjs — same '#command-shell
     #start-defense'-adjacent check if present; re-verify viewport matrix
     assertions still hold given the new dock chrome's own dimensions"
  - "tests/defense-performance-browser.cjs — re-run to confirm the
     structural DOM estimates in §8 against real measured domNodes"
  - "no changes anticipated for defense-run-simulation.test.mjs,
     defense-campaign-adapter.test.mjs, or any other pure-logic test — this
     redesign touches presentation only"
```
