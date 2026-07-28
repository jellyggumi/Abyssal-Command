# HUD Layout Spec — Lobby → Idle-Style Side-Dock Redesign

Author: ui-senior-developer · Run: `20260727-lobby-dock-redesign`
Grounded against the shipped D9 state: `app.js` `renderCommandShell()` (L619–855) /
`mountShell()` (L865–910), `styles.css` L1–70 + L300–345 + L548–631 + L942–980,
`README.md` 플레이/기술 계약, `tests/defense-hud-responsive-browser.cjs` (viewport
matrix), `tests/defense-performance-browser.cjs` (DOM/latency gates),
`tests/defense-survivor-browser.cjs` (load-time selector contract).

## 1. Problem with the shipped D9 shell

`#command-shell` is `position: fixed; inset: 0` — a full-viewport translucent
overlay stacked on top of `#defense-battle-surface` by DOM order
(`styles.css:18-20`). `shellExpanded` (`app.js:141`) is a single boolean: true
= the entire lobby (header, hero, 5-tab deck, archive tools) covers the whole
screen; false = it's invisible and only `.shell-dock-toggle`, a 2.6rem FAB
top-right, remains (`styles.css:21`). This **is** a lobby screen in every way
that matters to the player — it's "screen 1" that must be dismissed (tap the
FAB or start a run) before "screen 2" (combat) is visible. That's the exact
pattern the request rejects: idle/방치형 games don't have a lobby screen to
enter or leave; persistent-progression UI lives at the edges of the always-
visible simulation, permanently.

## 2. Genre grounding

Named references for the target pattern (all mobile idle/incremental titles
the request explicitly points at or that share the same IA shape):

- **Toss 뱅커** (뱅커게임) and BagelCode-family idle RPGs (예: 어스이터,
  단간론파류 방치형 캐주얼) — persistent live simulation (numbers ticking,
  characters idling/auto-battling) fills the screen; upgrade/roster/quest
  panels are anchored strips at the left/right/bottom edges that open as
  drawers, never as a full-screen takeover.
- **Melvor Idle** (web idle RPG, the closest structural analogue to this
  project's stat/skill-tree/equipment split) — a persistent left-edge
  navigation rail (skills/combat/bank/etc., icon+label list) that expands a
  panel beside the always-rendered game view; the game view is never
  covered by a modal screen for routine navigation.
- **AFK Arena** — Hero/Inventory/Formation open as side or bottom-anchored
  panels over the (frozen when idle) battle stage, dismissed by tapping the
  same icon or an explicit close affordance, never a route/screen change.

The design below (edge rails that expand into adjacent panels, never a
full-screen swap) is a direct structural match to Melvor Idle's left-rail
pattern, mirrored on both edges to hold this project's larger tab count (5
tabs vs. Melvor's flatter nav), with AFK Arena/BagelCode-style translucent
glass panels (reusing this project's own shipped `.rc-glass` material) so the
live 3D scene stays visible through them, matching the "로비와 전투가 같이
있어야 돼" requirement that D9 already established and this pass preserves.

## 3. Screen-space vs. world-space

Everything specified in this document — both dock rails, both dock panels,
the sortie action button, the idle-return toast — is **screen-space, fixed
UI**, exactly like the current `#command-shell` and `#defense-edge-hud`. None
of it is a world-space/camera-projected element (that's the separate,
unchanged `#world-hud-overlay` system — nameplates, damage numbers, capture
prompts — driven by `battle-realtime-three.js`'s `worldToNDC()`). This is a
fixed 2D dock system bolted to the viewport edges; it does not move, rotate,
or scale with the camera or the portrait-rotation transform applied to
`#defense-canvas`/`#world-hud-overlay` (`styles.css:77-82`). Confirm during
implementation that dock elements are NOT children of `#world-hud-overlay`
and do not inherit its `transform: rotate(90deg) translateY(-100%)` portrait
rule.

## 4. Content mapping: 5 tabs → 2 docks

```yaml
left_dock:
  id: growth-deck
  label_ko: "성장 덱"
  theme: "character power progression (between-run, no time pressure)"
  tabs:
    - id: growth
      label_ko: "성장"
      source: renderGrowthTab() — UNCHANGED (stats/skills/traits segment-bar)
    - id: companions
      label_ko: "동료"
      source: renderCompanionsTab() — UNCHANGED (list/formation segment-bar)
    - id: inventory
      label_ko: "인벤토리"
      source: renderInventoryTab() — UNCHANGED (equipment owner grid)
  rationale: >
    All three tabs read the same wardenGrowthData() and spend the same two
    currencies (Echo Core, Battle Fragments) against the same
    campaign.wardenProgress — they are one "build my Warden" concern.
    Matches Melvor Idle's left-rail skills/mastery grouping and BagelCode-
    style idle RPGs' single "성장" entry point that fans out to stats/gear/
    roster sub-screens.

right_dock:
  id: ops-deck
  label_ko: "전황 덱"
  theme: "world state: where am I fighting, what have I earned"
  tabs:
    - id: sortie
      label_ko: "출정"
      source: renderCommandShell()'s inline sortieTabHtml — TRIMMED, see §5
    - id: stronghold
      label_ko: "요새"
      source: renderStrongholdTab() — TRIMMED (dedupes archive-tools), see §5
  rationale: >
    Both are "where the campaign stands" content: current front (sortie =
    stage-select + briefing) and permanent record (stronghold = rewards +
    export/import). Matches the idle-genre right-side map/quest-log +
    vault pairing (AFK Arena's Campaign+Vault grouping).

start_action:
  extracted_from: sortieTabHtml's inline #start-defense CTA
  becomes: persistent floating action button, NOT inside any dock
  rationale: >
    The single most important pre-run action must stay reachable and
    thumb-zone-anchored regardless of which dock is open or collapsed; a
    genre-standard idle game always has one obvious "go" button independent
    of its side panels (see: AFK Arena's bottom-center Campaign/Play CTA).

idle_return_notice:
  extracted_from: #idle-return-summary banner (was top-of-shell, always in DOM)
  becomes: transient top-center toast, same mechanism as the existing
    showToast()/#battle-event-feedback pattern, auto-shown once at load when
    idleReturnSummary().outcome is non-empty, dismissible
  secondary_placement: a persisted one-line recap stays inside the
    stronghold tab (요새) for a player who dismissed the toast and wants to
    re-check what happened offline
  rationale: >
    It's a one-time "welcome back" notice, not persistent-progression UI —
    it doesn't earn a permanent dock slot, but the information isn't lost.

shell_chrome_dropped:
  - element: .command-header (brand-lockup "AC" mark + "Warden Corps 방어선"
      <h1> + "기록실 연결됨" status line)
    fate: DROPPED as standalone chrome; a small brand mark + dock title
      folds into each dock panel's own header instead (see component-
      contracts.md §DockPanel)
    rationale: >
      A full-width branded masthead is exactly the "lobby screen" framing
      the request rejects. Idle games don't show a title-card header once
      the simulation is live; wardens don't need reminding which game
      they're in every time they open a panel.
  - element: sortieTabHtml's <div class="tactical-map stage-atlas"> (the
      decorative 2D minimap — route-a/route-b lines, map-node glyphs,
      atlas-contours, stage art background)
    fate: DROPPED from the dock. Its DATA (terrain label, hazard/flank,
      occupation→extraction, landmark list) is KEPT, folded into the
      briefing `<dl>` that already exists in the same tab (briefing-stats).
    rationale: >
      The atlas was a stand-in battlefield preview when the lobby covered
      the real battlefield. Now the actual live 3D canvas IS that stage,
      rendering in real time behind the dock — a second 2D decorative map
      of the same stage, squeezed into a ≤21rem side panel, would be
      illegible AND redundant with the thing it's sitting next to. This is
      a content-fate decision, not a data loss: every authored fact the
      atlas displayed (hazard, flank, chokepath, elevation, occupation,
      extraction, landmark list) still renders, in the existing dl format.
  - element: sortieTabHtml's oversized hero-copy (`<h2>` "심연의 문을 다시
      닫아라" clamp(2rem,6vw,3.7rem) headline + hero-lede paragraph +
      hero-facts strip)
    fate: DROPPED. Replaced by a single compact line in the sortie panel
      header — current stage name + boss name (already duplicated in the
      briefing block immediately below it in the current markup).
    rationale: same as command-header above — marketing-copy-sized
      headlines are lobby-screen theater, not persistent dock content.
  - element: renderCommandShell()'s trailing <details class="archive-tools">
      (export/import/reset), which today renders a SECOND time whenever
      renderStrongholdTab() is the active tab (renderStrongholdTab() already
      has its own identical <details class="archive-tools"> block at
      app.js:614) — an existing duplication bug
    fate: CONSOLIDATED to exactly one copy, living only inside the
      stronghold dock tab. The shell-level copy is deleted.
    rationale: >
      In-scope cleanup: this exact region is being rebuilt by this pass,
      and shipping the same duplication forward into two dock copies would
      double the bug instead of fixing it.
```

## 5. Responsive strategy — the narrow-portrait tension, resolved explicitly

### 5.1 Two viewport tiers, one existing breakpoint

```yaml
viewport_tiers:
  wide:
    min_width: 900px          # reuses styles.css's existing `@media (max-width: 900px)`
                               # breakpoint already used by .command-hero/.ops-grid — no new
                               # arbitrary breakpoint introduced
    tested_viewports_in_tier: ["2056x1082"]
    default_state: both docks OPEN (panel, not just rail), simultaneously
  compact:
    max_width: 899px
    tested_viewports_in_tier: ["390x844", "360x800", "844x390", "667x375"]
    default_state: RIGHT dock OPEN (ops-deck, sortie tab active), LEFT dock
      collapsed to rail-only. Only ONE dock's panel may be open at a time —
      opening the other closes this one (see §5.3).
```

Why the right dock defaults open even on the narrowest phones (not both
collapsed to rails): the project's own browser contracts
(`tests/defense-survivor-browser.cjs:100-101`,
`tests/defense-hud-responsive-browser.cjs:44-46`) click `#start-defense`
immediately after page load with **zero prior interaction**, at 390×844.
Collapsing sortie behind a tap-to-open rail on load would silently break
that contract's assumption (a real behavior change the implementer must
carry into the test, see component-contracts.md §Test impact) unless sortie
content — and the CTA — stay reachable without interaction, matching what's
shipped today. Defaulting Ops open (not Growth) also matches genre
convention: the map/stage-select is the "home" view in every referenced idle
title; growth/inventory are opt-in secondary panels.

### 5.2 Why NOT "both docks always open, everywhere"

At compact tier, two independently-sized panels cannot coexist with a
legible canvas. Concretely, at the wide tier's own math (both panels open,
2056px viewport): 56(rail)+336(panel)+56(rail)+336(panel) = 784px of chrome,
leaving 1272px (62%) of canvas clear — comfortable. Run that same "both open"
math at 844px (the narrowest LANDSCAPE viewport in the test matrix, still
tagged compact because it's <900px): chrome would be 784px again, leaving
only 60px (7%) of canvas — a de facto crush. That's precisely the tension
the assignment calls out; the fix is tier-gating simultaneity, not just
shrinking panel width further (a panel narrow enough to leave room for BOTH
at 360px would be too narrow to render Korean stage names/boss names
legibly — see §5.4's width derivation).

### 5.3 Compact-tier interaction model: single-exclusive panel

```yaml
compact_tier_rule:
  rails: "ALWAYS both visible" # left rail + right rail are permanent,
                                # collapsed-width (3.5rem/56px) edge strips —
                                # this is the literal "flanking, not covering"
                                # requirement: at rest with a panel closed,
                                # BOTH sides always show their dock's presence
  panels: "AT MOST ONE open at a time"
  open_by_tap: >
    Tapping a rail's active-tab icon (or any of its tab icons) opens that
    dock's panel, sliding out adjacent to its OWN rail. If the OTHER dock's
    panel was open, it closes automatically (its content unmounts from the
    DOM — see component-contracts.md DOM-count rationale) and that dock
    reverts to rail-only. The rail whose panel is open shows its tab-strip
    INSIDE the panel header (no separate floating rail chrom next to an
    open panel on the same edge — avoids double UI stacked on one side).
  close_by_tap: >
    Tapping the open panel's own close control (×) — or tapping its own
    already-active rail icon again — collapses it back to rail-only. Neither
    dock is ever force-open outside of the pre-run default (§5.1).
  run_start: "both docks force-collapse to rail-only, see §6"
```

### 5.4 Panel width formula and the canvas-visibility table

```yaml
dock_panel_width:
  formula: "clamp(15rem, 70vw, 21rem)"   # 240px .. 336px
  derivation: >
    Lower bound (15rem/240px): the narrowest width that still fits the
    existing .stage-card compact grid-template (3.15rem art + 1.8rem index +
    remainder text column, already shipped at the ≤620px breakpoint,
    styles.css:958-963) without truncating Korean stage/boss names below
    single-line legibility — verified against today's shipped shell, which
    already renders this exact card layout inside a ~340-369px effective
    content column at 390px viewport width (padding-inline:.65rem each
    side). 240px is comparable, not a new unproven width.
    Upper bound (21rem/336px): matches the wide-tier panel width so ONE
    container-width-scoped stylesheet serves both tiers (see
    component-contracts.md §CSS structure) instead of two separate
    "compact panel" and "wide panel" style sets.
  applies_to: "both left and right dock panels, both tiers"
rail_width: "3.5rem (56px), fixed, all tiers"
```

Canvas-visible math per tested viewport (worst case: default pre-run state
at compact tier = right panel open + left rail; wide tier = both panels
open; formula per §5.3/§5.1):

```yaml
canvas_visibility_by_viewport:
  # compact tier, pre-run default: left rail (56px) + right panel
  # (clamp(240, 0.70*width, 336))
  "360x800":  { chrome_px: 308, canvas_px: 52,  canvas_pct: "14%" }
  "390x844":  { chrome_px: 329, canvas_px: 61,  canvas_pct: "16%" }
  "667x375":  { chrome_px: 392, canvas_px: 275, canvas_pct: "41%" } # panel hits 336 cap
  "844x390":  { chrome_px: 392, canvas_px: 452, canvas_pct: "54%" } # panel hits 336 cap
  # wide tier, default: both rails (56+56) + both panels (336 cap each,
  # since 0.70*2056 far exceeds the cap)
  "2056x1082": { chrome_px: 784, canvas_px: 1272, canvas_pct: "62%" }
  # ALL tiers, BOTH docks collapsed to rail-only (mid-run default, or
  # user-collapsed pre-run) -- the canvas-priority floor:
  "360x800_rails_only":  { chrome_px: 112, canvas_px: 248, canvas_pct: "69%" }
  "390x844_rails_only":  { chrome_px: 112, canvas_px: 278, canvas_pct: "71%" }
```

**This is the honest resolution of the narrow-portrait tension, stated
plainly**: at 360×844, the pre-run *browsing* default leaves a visible-but-
narrow 52–61px full-height canvas sliver next to one open, translucent
(`.rc-glass`, blurred, not opaque) panel — a real, if tight, improvement over
today's 0% (full 100vw overlay). The moment a run starts — which is the
actual moment the README's "don't obscure the battlefield and danger
signals" clause is about — both docks collapse to rail-only and canvas
visibility jumps to 69%+ at every tested viewport, guaranteed, with the full
edge-HUD combat display also visible (see §6). Pre-run browsing legibility
and combat danger-signal visibility are different requirements with
different acceptable trade-offs; this design meets both, deliberately, at
the point each one actually matters. This is also not a new category of
trade-off for the project: the shipped `.edge-card` toast is already
`min(84vw, 620px)` — up to 84% of viewport width — and `.hud-panel` is
already `min(42vw, 340px)` per corner, both accepted, both translucent
glass over the canvas, both precedent for "partial overlay coverage of the
full-bleed canvas is the established idiom here," not a violation of it.

## 6. Pre-run vs. mid-run behavior

```yaml
pre_run: # session?.started === false
  docks: "per §5.1 tier default (compact: right open/left rail; wide: both open)"
  user_can: "freely open/close either dock; browse all 5 tabs' content"
  sortie_action_button: "VISIBLE, thumb-zone anchored bottom-center"
  edge_hud: "hidden (data-defense-started=false already hides it, UNCHANGED rule)"
  idle_return_toast: "shown once if applicable, auto-dismiss or manual close"

run_start_transition: # BattleSession.beginRun() fires
  trigger: "click on the sortie action button (was #start-defense, same id)"
  effect: "both docks force-collapse to rail-only, regardless of prior state"
  sortie_action_button: "removed from DOM (no more 'start' to trigger)"

mid_run: # session?.started === true
  docks: "rail-only by default, on EVERY viewport tier (wide tier no longer
    defaults both-open once combat starts — canvas takes priority over
    genre-standard 'always both open' the instant there is something to
    protect)"
  peek_interaction: >
    Tapping a rail opens that ONE dock's panel as an overlay ON TOP of the
    now-visible #defense-edge-hud (edge-hud visibility is no longer coupled
    to dock state at all — see the CSS-rule change in
    component-contracts.md §7). The opened panel is height-capped to keep
    `.defense-bottom` (gate-panel / one-thumb-controls / hud-actions — the
    live D-pad and skill buttons) fully reachable and tappable underneath
    it; see component-contracts.md §6 for the exact reserve.
  simulation_state: >
    UNCHANGED from today: opening a dock panel mid-run does NOT pause
    BattleSession's tick loop (that remains userPaused's separate, existing
    responsibility via the #toggle-pause button and #defense-pause-overlay
    — out of scope, untouched). Combat continues advancing under a peeked
    panel exactly as it continues today under a re-expanded shellExpanded
    overlay.
  improvement_over_today: >
    Today, re-expanding the shell mid-run (shellExpanded=true) hides
    #defense-edge-hud entirely (styles.css:54-55,
    `[data-shell-expanded="true"] #defense-edge-hud { display: none; }`) —
    a genuine "blind peek." This redesign removes that coupling: the
    edge-hud's visibility depends ONLY on `data-defense-started`, so a
    mid-run dock peek never blacks out the live combat readout underneath
    it.
```

## 7. Interaction with `#defense-edge-hud` (unchanged scope, explicit interface)

Out of scope per the assignment — the edge-HUD's own panels, D-pad, and
skill bar are not redesigned. The ONE required change, because the current
rule structurally depends on the shell being a single all-or-nothing
overlay: `styles.css:54-55`'s second selector,
`#defense-battle-surface[data-shell-expanded="true"] #defense-edge-hud {
display: none; }`, must be deleted (see component-contracts.md §7 for the
precise diff) — edge-hud visibility becomes solely a function of
`data-defense-started`, which is the first selector on that same line and
is kept as-is. `app.js`'s `surfaceEl.dataset.shellExpanded` write
(L641-642) is likewise removed since nothing reads it anymore once that CSS
rule is gone.

## 8. What stays exactly as-is (no redesign, explicit non-goals honored)

- `#defense-battle-surface` — single persistent node, mounted once in
  `mountShell()`, never re-created. Nothing in this design touches it or
  reduces its box (`--defense-physical-width/height`, set by
  `defense-viewport.js`, is never modified by dock state).
- `#defense-canvas` sizing (`position:absolute; inset:0; width/height:100%`)
  — unchanged; it is always full-bleed inside its always-full-viewport
  parent, at every tier, in every dock state.
- `#world-hud-overlay`, `#defense-edge-hud`'s internal content (mission
  panel, loop-state panel, top-right-hud, gate-panel, one-thumb-controls,
  hud-actions), `#defense-pause-overlay`, portrait-rotation transform,
  cutscene system — untouched.
- All 5 tabs' underlying data/logic/state-mutation functions
  (`allocateWardenStatPoint`, `unlockWardenSkillNode`, `selectWardenTrait`,
  `purchaseEquipmentTier`, `setCompanionFormationSlot`,
  `setCompanionLoadout`, storage export/import/reset) — reused verbatim;
  this is an IA/layout revision, not a data or rules change.

## 9. Gate-checkable numbers (summary; full contracts in component-contracts.md)

```yaml
touch_targets:
  rail_button: { width_px: 48, height_px: 48, floor_dp: 48 }
  panel_interactive_elements: { min_height_px: 48, min_width_px: 48 }
  gate: ">=48dp on every new interactive dock element"
dom_count:
  budget_ceiling: 5000        # tests/defense-performance-browser.cjs:174, unchanged
  structural_estimate_worst_case_pre_run: 240   # both wide-tier panels open, heaviest content
  structural_estimate_worst_case_mid_run: 130   # rails-only + one peeked panel + existing edge-hud (~40-80)
  methodology: "see component-contracts.md §DOM count estimate"
  verification_required: "re-run tests/defense-performance-browser.cjs after implementation"
input_latency:
  budget_ms: 100               # existing project-wide contract,
                                # tests/defense-performance-browser.cjs:184
  applies_to: "dock open/close/tab-switch — synchronous DOM mutation inside
    the click handler, same pattern as the existing renderCommandShell()
    click handlers; no debounce/async between tap and visible panel change"
contrast:
  approach: "reuse shipped .rc-glass token pair verbatim (styles.css:398-445)
    — no new colors introduced for dock chrome"
  measured_worst_case_ratio: 7.97   # dimmest existing text token (#8ca9c8)
                                     # against rc-glass's darkest gradient
                                     # stop (rgb(16 10 28))
  wcag_aa_floor: 4.5
  wcag_aaa_floor: 7.0
  verdict: "exceeds AAA (7:1) at the worst-case existing token pairing;
    body/heading text tokens measure 17.0-17.69:1"
```
