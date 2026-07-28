# Gate Measurements — Lobby Pass 1

Gate-checkable numbers for G4 (accessibility / reduced-motion + touch targets) and G6 (performance). Every claim carries the exact command that produced it. All Playwright measurements: node v26.0.0 + Playwright 1.52.0, self-hosted 127.0.0.1 ephemeral port, seeded SETTLED idle-return campaign (`campaign-state.js` `createCampaign` → clear STAGES[:-1] → `idleReturn.lastSettledAt = NOW − 2×IDLE_RETURN_INTERVAL_MS`).

---

## #g4 — Accessibility (reduced-motion resting states + touch targets)

Command (self-hosted, seeded, both motion modes; assertions embedded, `G4_MEASURE_PASS` on success):
`NODE_PATH="$(pwd)/node_modules" node /tmp/g4-measure.cjs` → exit 0, `G4_MEASURE_PASS`, `errors: []` in both modes.
Rail-hide command: `NODE_PATH="$(pwd)/node_modules" node /tmp/rail-hide.cjs` → exit 0, `RAIL_HIDE_PASS`.

### Touch targets (≥48dp for new interactive elements)

```yaml
touch_targets:
  currency_pill_echo_core:
    width_px: 131.58
    height_px: 48        # meets >=48dp (min-height:48px in .currency-pill)
    hit_area_ok: true
    aria_label: "에코 코어 27 · 성장 열기"
  currency_pill_bound_fragment:
    width_px: 163.31
    height_px: 48        # meets >=48dp
    hit_area_ok: true
    aria_label: "속박 파편 9 · 인벤토리 열기"
  sortie_fab_start_defense:
    width_px: 358.8
    height_px: 56
    min_height_css: "56px"   # >=48dp (unchanged; polish-only)
    hit_area_ok: true
  stage_reward_chip:
    role: decorative
    aria_hidden: "true"      # NOT a hit target -- label-only chip on selected card face
    text: "✦ 보상"
    note: "not counted as an interactive target by design (aria-hidden); card itself stays >=48dp: 215.42 x 129.34"
```

Every NEW interactive element (2 currency pills, the polished FAB) is ≥48dp. The reward chip is intentionally `aria-hidden` decorative (not a tap target), so it does not add a sub-48dp hit area.

### Reduced-motion resting states (`prefers-reduced-motion: reduce`)

Global block `styles.css:248` — `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }` — suppresses every added animation/transition; each effect lands on a meaningful static state (verified: `errors: []`, nothing silently disappears).

```yaml
reduced_motion_resting_states:
  idle_payday_countup:
    verified_by: "/tmp/g4-measure.cjs (reducedMotion: reduce)"
    normal_countText: "+18"          # counts 0->18 via self-terminating rAF
    normal_hasReveal: true           # .idle-payday-reveal applied
    reduced_countText: "+18"         # JS paints final number immediately (spec item 5 / G4)
    reduced_hasReveal: false         # NO reveal animation class added under reduced motion
    total_line_present_from_first_paint: true   # "누적 18" == data-idle-return-total
    resting_state: "final +18 + 누적 18 (no count-up, no rise) -- nothing hidden"
  currency_pills:
    resting_state: "static pills; value color-transition (120ms) killed by global rule -> resting = final number"
    verified: "2 pills rendered, values static, errors:[]"
  sortie_fab:
    active_feedback: ".sortie-fab:active applies static pressed bg+border (linear-gradient #d84a22->#7f2410, border #ffd7c4); :active transform:scale(.97) is compositor-thread and the pressed BACKGROUND survives reduced-motion as the perceivable feedback"
    breathe_glow: "::after breathe animation killed by global rule -> resting = static .35 opacity glow"
    particle_burst: "spawnSortieBurst early-returns when matchMedia('(prefers-reduced-motion: reduce)').matches -> burst skipped entirely (JS-gated, G4)"
  stage_selected_card:
    resting_state: "static brighter border (.stage-card.is-selected border-color + box-shadow); rc-glow-ring already reduced-motion guarded elsewhere -> degrades to static border"
  briefing_details:
    resting_state: "native <details> toggle, no animation needed; closed by default"
  dock_seams:
    resting_state: "static inset 1px cyan-rift box-shadow (item 1) -- zero per-frame cost, unaffected by motion pref"
```

### Currency-rail visibility lifecycle (pre-run only, yields to combat HUD)

```yaml
currency_rail_lifecycle:
  verified_by: "/tmp/rail-hide.cjs"
  pre_run:
    present: true
    visible: true
    pill_count: 2          # exactly 2 (currency-soup guard, spec item 2 / A5)
  after_beginRun:
    data_defense_started: "true"
    computed_display: "none"   # html[data-defense-started="true"] .currency-rail { display:none } (styles.css:856), mirrors edge-hud rule
```

### Value-consistency (EC/BF pill == growth/inventory affordability balance)

```yaml
value_consistency:
  verified_by: "/tmp/g4-measure.cjs (asserts pill amount == earned-spent balance)"
  echo_core:
    pill_shown: 27
    affordability_balance: 27     # echoCoreEarned(campaign) - echoCoreSpent(campaign)
    match: true
  bound_fragment:
    pill_shown: 9
    affordability_balance: 9      # boundFragmentEarned(campaign) - boundFragmentSpent(campaign)
    match: true
```

**G4 verdict: PASS.** New interactive targets ≥48dp; count-up paints final number under reduced motion (no rise class); pills/CTA/selected-card land on static resting states; nothing silently disappears; rail correctly hides mid-run; EC/BF match the affordability balance.

---

## #g6 — Performance (DOM count vs 5000 ceiling, input latency < 100ms)

Command: `node tests/defense-performance-browser.cjs` → exit 0, `pass: true`, `failures: []`, wall 5.90s.
Contract limits: `domNodes < 5000`, `rafMeanMs < 100` (full-resolution) / `< 200` (software webgl), `rafMaxMs < 500`, `inputFeedbackMs < 100`.

```yaml
g6_performance:
  command: "node tests/defense-performance-browser.cjs"
  result: PASS
  ceilings:
    dom_nodes_max: 5000
    dom_nodes_5pct_of_ceiling: 250     # acceptance #6: "still <5% of the 5000 ceiling"
    input_latency_max_ms: 100
    raf_mean_budget_ms: 100
  viewports:
    - viewport: "844x390"
      renderer: webgl
      cadence_mode: full-resolution
      dom_nodes: 126               # 2.52% of 5000 ceiling (< 5%)
      raf_mean_ms: 16.665          # < 100
      raf_max_ms: 16.70            # < 500
      input_latency_ms: [0.30, 0.20]   # both < 100
    - viewport: "2056x1082"
      renderer: webgl
      cadence_mode: full-resolution
      dom_nodes: 126               # 2.52% of 5000 ceiling (< 5%)
      raf_mean_ms: 16.665          # < 100
      raf_max_ms: 16.80            # < 500
      input_latency_ms: [0.40, 0.30]   # both < 100
  headroom:
    dom_nodes_pct_of_ceiling: "2.52%"   # well under the 5% acceptance bar (250)
    max_input_latency_ms: 0.40          # 0.4% of the 100ms budget
```

**G6 verdict: PASS.** DOM = 126 nodes at both viewports = 2.52% of the 5000 ceiling (acceptance #6 wants < 5% / 250). Input latency ≤ 0.4ms (< 100ms). rAF mean 16.665ms (60fps) at both viewports. The lobby-pass-1 additions (≈8 currency-rail nodes + payday markup + ≤6 pooled burst spans) keep the DOM budget essentially unmoved.

---

## Cross-gate summary

| Gate | Metric | Measured | Bar | Verdict |
|---|---|---|---|---|
| G4 | currency pill height | 48px x2 | ≥48dp | PASS |
| G4 | sortie FAB height | 56px | ≥48dp | PASS |
| G4 | reduced-motion count-up | final `+18`, no reveal | paint final number | PASS |
| G4 | reward chip | `aria-hidden` decorative | not a sub-48 hit target | PASS |
| G4 | EC/BF value consistency | 27 / 9 == balance | must match | PASS |
| G4 | rail hides mid-run | `display:none` @ started=true | yields to combat HUD | PASS |
| G6 | DOM nodes | 126 (both viewports) | < 250 (5% of 5000) | PASS |
| G6 | input latency | ≤ 0.4ms | < 100ms | PASS |
| G6 | rAF mean | 16.665ms | < 100ms | PASS |
