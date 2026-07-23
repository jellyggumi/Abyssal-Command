# Growth-Panel Accessibility Audit — Cycle 2 (Full 10-Stage Range)

- role: `ui-senior-developer` (Growth Panel Accessibility Auditor)
- run-id: `20260723-solo-warden-rpg-concept`
- closes: `qa/gate-measurements.md#g4` PARTIAL item's Stage3 follow-up — Cycle 1's #g4 audit verified touch-target/color-independent-encoding/reduced-motion structurally at **one** DOM state (post-`purchaseEquipmentTier` call, unspecified stage). This audit re-verifies the same three properties **across the full 10-stage progression range**, at 4 prescribed milestones + 1 bonus state, using real simulation-driven campaign state (not mocked DOM).

**Verdict: PASS.** All three accessibility properties (touch-target ≥48dp, color-independent tier encoding, reduced-motion parity) hold at every tested stage-state milestone, with zero regressions found across the full progression range.

**Evidence path used: BOTH — static-CSS-argument (primary) confirmed by live-multi-stage-DOM-check (empirical verification at 5 distinct campaign states)**, because the CSS-staticness argument alone is sufficient by construction (see §1) but the assignment explicitly asked for stage-state coverage where different UI configurations exist (trait-selection panel, formation-panel slot count 1→3, equipment-panel icon population 0→5+), which only a live DOM check can confirm actually renders correctly at each configuration — CSS staticness proves the *rules* apply uniformly, live DOM checks prove the *rendered markup* at each state actually satisfies those rules with real data.

---

## 1. Static-CSS argument — `styles.css` `.growth-*`/`.tier-icon` rules

Read `styles.css` lines 65–90 in full (the entire `.growth-*`/`.tier-icon` block). **Confirmed: zero of these rules are conditionally scoped by game/stage state.** Every selector is either an unconditional class selector or an unconditional attribute selector; none are nested inside a stage-specific ancestor selector, JS-injected inline style, or any `@media` query except the single global `@media (prefers-reduced-motion: reduce)` (line 63), which is a blanket override applying identically regardless of state.

Exact selectors checked (`styles.css:65-90`):

| selector | rule | conditional on stage/state? |
|---|---|---|
| `.growth-panel` | layout/border/background | No — always rendered (`app.js:298` unconditionally calls `renderGrowthPanel()` in `renderLobby()`) |
| `.growth-panel summary` | `min-height: 48px` | No |
| `.growth-stat-grid, .growth-skill-grid, .growth-equip-grid` | grid layout | No |
| `.growth-stat-row, .growth-skill-node` | box layout | No |
| `.growth-skill-node.is-unlocked` | border-color/background only (no sizing) | Modifier class toggles color, not touch-target size |
| `.growth-stat-row button, .growth-skill-node button, .growth-equip-slot button` | `min-width: 48px; min-height: 48px` | No — unconditional, applies to every button in these 3 containers regardless of disabled/unlocked state |
| `.growth-trait-offers` | grid layout | No (grid exists whether or not offers are populated — see §3 bonus milestone) |
| `.growth-trait-card` | `min-height: 56px` | No |
| `.growth-equip-owner, .growth-equip-slots, .growth-equip-slot` | box layout | No — same rule whether 1 owner (Warden only, no companions) or 4 owners (Warden + 3-companion loadout) |
| `.growth-equip-slot small` | text sizing | No |
| `.growth-formation-row, .growth-formation-slot` | `min-height: 48px` on slot | No — same rule at 0, 1, 2, or 3 loadout slots |
| `.growth-formation-slot button` | `min-width: 48px; min-height: 48px` | No |
| `.tier-icon` | base 14×14px box | No |
| `.tier-icon[data-tier-vertices="0"]` .. `="6"]` | `clip-path`/`border-radius` per vertex count | Attribute-selector driven by the `data-tier-vertices` value `app.js:225` writes at render time from `EQUIPMENT_TIERS[tierIndex].vertexCount` (`rpg-catalog.js:107-112`) — the CSS rule itself is static; only the *value* of the attribute varies by equipment tier owned, which is exactly the color-independent-encoding mechanism working as designed |

**Conclusion**: because none of these rules are gated behind stage-specific selectors, structural coverage extends to all 10 stages by construction — a rule that applies unconditionally to `.growth-stat-row button` applies identically whether that button is visible at Stage 1 or Stage 10. This closes the *rule-definition* half of the Stage3 follow-up. The remaining open question — does the *data* rendered into these static rules (variable equipment-slot counts 0→12, variable formation-slot counts 1→3, variable trait-offer visibility) ever produce markup that violates the rule at some specific stage state? — is answered empirically in §3.

Also re-confirmed the reduced-motion-by-construction claim from Cycle 1: **zero** `transition`/`animation` declarations exist anywhere in the `.growth-*`/`.tier-icon` block (full-file read, `styles.css:65-90`) — the block declares no property for the global `@media (prefers-reduced-motion: reduce)` (`styles.css:63`) to have to disable. This too is stage-independent by construction (the CSS never had motion, regardless of stage).

---

## 2. Live browser-verification method

Served the repo root locally (`python3 -m http.server 4183 --bind 127.0.0.1`, per `README.md`'s documented `python3 -m http.server 4173` pattern). Opened `index.html` in a real headless Chromium tab. Drove campaign state via `await import('./campaign-state.js')` + `./defense-storage.js` + `./rpg-catalog.js` executed **in the page's own module context** (`tab.evaluate`) — the exact pattern the assignment specified, matching Cycle 1's browser-verification approach (`qa/gate-measurements.md#g4`: "real `document.documentElement.style.filter = 'grayscale(100%)'` render").

For each milestone: built a campaign object using only the **real, exported, unmodified `campaign-state.js` mutation functions** (`createCampaign`, `startRun`, `captureElite`, `applyCampaignRunResult`, `selectWardenTrait`, `setCompanionLoadout`, `setCompanionFormationSlot`, `purchaseEquipmentTier`) chained in sequence to reach the target stage/trait/equipment state, verified the resulting campaign object's `resolvedIds`/`companionCollection`/`traitIds`/`wardLevel`/`ownedEquipmentIds` against `design/stage-progression.md` §1's ground table (exact match required before proceeding to DOM inspection), persisted it via the real `DefenseStorage.save()` (real IndexedDB write + SHA-256 envelope hash, not a mock), then `tab.goto()`-reloaded `index.html` so the app's own `initialize()` loaded the campaign from storage and called the real, unmodified `renderLobby()`/`renderGrowthPanel()`. No DOM was hand-constructed and no render function was patched — every screenshot-equivalent DOM query below reflects the actual production render path.

At each reload: queried `document.querySelectorAll('.growth-panel button')` bounding-client-rects for the ≥48px check, and `.tier-icon[data-tier-vertices]` + computed `clip-path` for the color-independent-encoding check, matching Cycle 1's exact query targets (`.growth-stat-row button`, `.growth-skill-node button`, `.growth-equip-slot button`, `.growth-formation-slot button`, `.tier-icon`).

Why browser-driving the *exact* prescribed milestones was practical here (unlike the assignment's anticipated fallback case): `campaign-state.js` exposes pure, composable state-mutation functions with no hidden RNG or async-simulation dependency for progression bookkeeping (elite capture / stage resolution / trait selection / equipment purchase are all synchronous, deterministic, and directly chainable) — jumping straight to "Stage 6, 5 companions, 3 traits, wardLevel 8" doesn't require playing through combat, only replaying the campaign's bookkeeping API forward from `createCampaign()`. This made the live-DOM path both practical and the stronger evidence choice over the CSS-argument-only fallback described in the assignment's step 3.

---

## 3. Milestone results

All 4 numeric values (resolvedIds count, companion count, trait count, wardLevel) were cross-verified against `design/stage-progression.md` §1's ground table before DOM inspection — every milestone matched the table exactly (methodology note: `wardLevel` has no formal tier structure like equipment's T1–T5; the assignment's "T2 wardLevel range" for milestone (b) is read as shorthand for the mid-campaign wardLevel value the table documents for Stage 4, i.e. 6 — distinct from Stage 1's baseline 1 and Stage 10's endpoint 13).

| milestone | resolvedIds | companions (loadout) | traits | wardLevel | table match | interactive elements | below-48px | non-zero tier-icons rendered |
|---|---|---|---|---|---|---|---|---|
| (a) Stage 1 pre-trait-unlock | 1 (`cinder-span`) | 1 (1) | 0 | 1 | ✓ exact | 18 | **0** | 0 (all 6 slots vertices=0, unequipped) |
| (b) Stage 4 mid-progression | 4 | 4 (3) | 2 (`first-strike`,`gate-keeper`) | 6 | ✓ exact | 26 | **0** | 2 (T3 diamond vertices=4, T2 triangle vertices=3) |
| (c) Stage 6 Undertow-immunity | 6 | 5 (3) | 3 (+`companions-wardpact`) | 8 (immunity threshold, first reached) | ✓ exact | 26 | **0** | 1 (T4 pentagon vertices=5) |
| (d) Stage 10 endpoint | 10 (all) | 6 (all, 3 loadout) | 5/5 (all sequences) | 13 | ✓ exact | 26 | **0** | 1 (T5 hexagon vertices=6, max reachable) |
| (bonus) trait-offer-visible | 2 | 2 (0 loadout set) | 0, sequence-2 offer open | 1 | n/a (not a prescribed milestone; added because none of a/b/c/d render `.growth-trait-offers`) | 3 trait-cards, 291.6×80.2px each | **0** | n/a |

**Zero interactive elements below the 48px floor in either dimension at any of the 5 tested states**, across a range spanning 18→26 buttons and 0→12 equipment slots (0→4 owners × 3 slots) and 1→3 formation slots.

**Color-independent tier encoding**, verified at milestone (b) specifically because it is the first state where **two distinct non-zero tiers render simultaneously** (Cycle 1 only verified T1-vs-T2 in isolation): re-ran Cycle 1's exact method — `document.documentElement.style.filter = 'grayscale(100%)'` — on the live milestone-(b) DOM. Both non-zero `.tier-icon` elements share an **identical** computed `background-color` (`rgb(158, 204, 228)`) under grayscale, yet remain unambiguously distinct by `clip-path` shape alone: `polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)` (diamond, T3/4-vertex) vs. `polygon(50% 0%, 0% 100%, 100% 100%)` (triangle, T2/3-vertex). Confirms the shape channel — not color — carries the tier signal, exactly as `styles.css`'s comment at line 84 states.

**Viewport check**: milestone (b)'s state was also re-verified at a 390×844 mobile-portrait viewport (the project's primary target per `styles.css:3`'s `min-width: 320px`) — still 26/26 interactive elements ≥48px, ruling out the touch-target claim being a desktop-viewport artifact.

**Reduced-motion parity**, verified empirically at the densest tested state (milestone d, 106 total descendant elements under `.growth-panel`): `getComputedStyle()` on every descendant element shows **0/106** with any active `transitionDuration≠0s`+`transitionProperty≠none` or `animationName≠none`. Confirms §1's static-CSS argument holds under real rendered markup at the campaign's most complex UI state, not just by reading the stylesheet.

**Trait-offer grid** (bonus milestone): none of the 4 prescribed milestones happen to land on a state where `.growth-trait-offers`/`.growth-trait-card` are populated and unselected (by the time each milestone script called `selectWardenTrait()` to reach its target trait count, the offer grid had already collapsed back to the "선택됨" summary view) — added a 5th state (Stage 2 cleared, trait not yet picked) specifically to exercise this grid, since it's a common real-play state (occurs after every even-numbered stage clear until picked) and the assignment names trait-selection UI explicitly as a state that "only appears at specific stages." All 3 rendered trait-offer cards measured 291.6×80.2px — well above the 48px floor.

## 4. Finding (not an accessibility defect — scope note)

`design/stage-progression.md` §5 describes a Stage-6 "저지선 안정" (Undertow-stable) **static badge** as the presentation tie-in for reaching wardLevel 8. Grepped `app.js`, `styles.css`, and `react-game-ui.css` for `badge` — **zero matches in all three files**; this badge widget does not exist as separate UI yet (it is design-doc scope, listed as a Stage3 presentation item, not implemented this cycle). The only current in-panel signal of this threshold is the existing `.panel-count` text `저지 Lv${level}` (verified live at milestone c: `"EC 0/24 · BF 6/6 · 저지 Lv8"`), which is plain text and therefore already color-independent by construction — so nothing currently shipped is an accessibility regression. Flagging the badge's absence as a production gap for the director/designer, not a G4 accessibility failure.

## 5. Evidence

- This file.
- `styles.css:65-90` (full `.growth-*`/`.tier-icon` block, read in full this session).
- `app.js:182-242` (`renderGrowthPanel()`, unmodified, read in full this session).
- `rpg-catalog.js:104-113` (`EQUIPMENT_TIERS` vertex-count table, cross-checked against CSS attribute selectors — exact match, 0/3/4/5/6 vertices ↔ 5 tiers).
- `design/stage-progression.md` §1 (10-stage ground table) — used to validate every milestone's resolvedIds/companion/wardLevel numbers before DOM inspection; all 4 prescribed milestones matched exactly.
- Live browser session this task (headless Chromium via `python3 -m http.server 4183`, `tab.evaluate` driving real `campaign-state.js`/`defense-storage.js`/`rpg-catalog.js` imports, real `renderLobby()`/`renderGrowthPanel()` render path, no mocked DOM) — 5 distinct campaign states persisted to real `IndexedDB` and reloaded, DOM bounding-rects + computed `clip-path`/transition/animation styles queried at each.

## 6. Verdict

**PASS.** Growth-panel accessibility properties (touch-target ≥48dp, color-independent tier encoding, reduced-motion parity) hold across the full 10-stage progression range.

**Justification of evidence path**: used both — the CSS-staticness argument (§1) proves the *rules* are stage-independent by construction, and live multi-stage DOM verification (§2–3, 5 real campaign states spanning Stage 1→10, 18→26 interactive elements, 0→2 simultaneous non-zero tier icons) empirically confirms the *rendered markup* at each of those states actually satisfies the rules with zero violations, which the CSS argument alone cannot prove for variable-count containers (equipment/formation slots) whose element counts are only known at render time.
