# Dock Removal → Persistent RPG Command Layout — routing + plan note

```yaml
run_id: 20260729-ui-dock-removal
lane: ui
owner_skill: web-game-development  # narrowest match: build-mobile-threejs-games (HUD/touch layout)
status: "[TARGET] at write time — measured evidence lands in ui/dock-removal-evidence.md"
authority: ui/hud-information-architecture.md
supersedes: _workspace/archive/20260727-lobby-dock-redesign/ui/component-contracts.md §1–§3
scope: app.js, styles.css, 6 browser tests. NOT assets/motion/**, NOT scripts/rig-*, NOT README/package.json/workflows.
```

## 0. Engine routing (CLAUDE.md §2)

Three.js + WebGL browser game. Single narrowest upstream sub-skill:
**mobile Three.js game HUD/touch layout**. No Unity/Unreal concept is applied.
Renderer/simulation boundary is untouched: every control in the new layout calls an
existing pure `campaign-state.js` transition and reassigns `campaign`; the only
sim-adjacent call remains `session.beginRun()` from `#start-defense`.
`getRunDigest()` inputs are not read or written by this pass.

## 1. User directive (verbatim, authoritative)

> 기존 ui의 좌우 슬라이드 메뉴는 제거하고, 왼쪽의 인벤토리와 스킬부분은 활용할수있게 ui
> 개선이 필요해. rpg 의 기본 구성을 지키면서 연출적인 부분은 텍스트위주가아니라 화면과
> 이미지로 구성해야해.

Decomposed into four checkable requirements:

| # | Requirement | Mechanism chosen |
|---|---|---|
| R1 | 좌우 슬라이드 메뉴 제거 | delete rail/panel open-close state machine entirely (§3) |
| R2 | 왼쪽 인벤토리 + 스킬을 활용 가능하게 | both mounted **unconditionally**, zero disclosure taps (§4.1) |
| R3 | RPG 기본 구성 유지 | character sheet left · battlefield centre · ops right (§4) |
| R4 | 연출은 텍스트가 아니라 화면 + 이미지 | icon layer + mesh portraits + bars/frames replace prose (§5) |

## 2. What exists today `[OBSERVED]`

- `app.js:917-961` `renderDockSide()` — rail + conditionally-mounted panel, click
  toggles `dockOpen[side]`, `.dock-panel-close` closes.
- `app.js:182-203` `dockOpen` / `activeLeftDockTab` / `activeRightDockTab` /
  `dockTier` / `dockMediaQuery` / `computeDefaultDockOpen()`.
- `app.js:1374-1398` `renderRailCurrency()` + `openLeftDockTab()` — currency chips
  pinned in the collapsing rail, deep-linking by *opening* a panel.
- `app.js:1439-1448` `setupDockTierListener()` — matchMedia tier flip re-runs the
  default-open computation.
- `styles.css:33-49,147-206,285-316,1198,1211-1212,1219-1238` — rail geometry,
  panel geometry, `data-peek-left/right` de-overlap, reduced-motion transition.
- Panel content that must survive verbatim: `renderGrowthTab`, `renderCompanionsTab`,
  `renderInventoryTab`, `renderStrongholdTab`, `renderSortieTabBody`,
  `monarchStatusMarkup`, and the `wardenStatsMarkup` / `wardenSkillsMarkup` /
  `wardenTraitsMarkup` / `equipmentOwnersMarkup` / `formationRowMarkup` helpers
  (the last five are ALSO called read-only by `renderPauseOverlay()` at
  `app.js:2908-2910` — their signatures and `.command-segment*` CSS stay).

## 3. Deletions (R1) — no aliases, no dead branches, no commented corpses

| Symbol / selector | Disposition |
|---|---|
| `renderDockSide()` | deleted; replaced by `renderDeckSide()` with no open/close arg |
| `dockOpen`, `computeDefaultDockOpen()`, `currentDockTier()`, `dockTier`, `dockMediaQuery`, `setupDockTierListener()` | deleted — responsiveness is now pure CSS |
| `activeLeftDockTab`, `activeRightDockTab`, `LEFT_DOCK_TABS`, `RIGHT_DOCK_TABS` | deleted — no tab state left to hold |
| `activeGrowthSegment`, `activeCompanionSegment` | deleted — those segment bars were the *second* disclosure tap; all segments now mount at once |
| `.dock-rail`, `.dock-rail-tab`, `.dock-rail-icon`, `.dock-panel*`, `.dock-brand`, `[data-dock-tab]`, `data-dock-open`, `data-dock-side`, `#dock-panel-left/right` | deleted from JS + CSS |
| `surface.dataset.peekLeft/peekRight`, `[data-peek-left]`/`[data-peek-right]` CSS, the `.defense-top/.defense-bottom` `padding-inline: 3.5rem` rail-clearance rules | deleted — no deck exists during combat, so nothing to clear or black out |
| `openLeftDockTab()` | replaced by `jumpToDeckSection()` (scrolls, never opens) |

`.command-segment-bar` / `.command-segment` / `.command-segment-body` CSS is
**kept** — still used by `renderPauseOverlay()`. Justified retention, not a leftover.

## 4. New layout (R2, R3) — mobile-first, landscape-primary

Two persistent `position: fixed` edge columns, siblings of `#defense-battle-surface`,
mounted **only before a run**. `renderCommandDecks()` empties both containers the
instant `session.started` is true, and `html[data-defense-started="true"] .command-deck
{ display: none }` removes them from hit-testing so the canvas keeps every touch.
Combat therefore has exactly the HUD it had before — element/text/area budgets in
`hud-information-architecture.md §6` are untouched.

### 4.1 LEFT — `#command-deck-left`, 캐릭터 시트 (R2 core)

Sticky `.deck-masthead` (never scrolls away):
commander mesh portrait · `RANK`/`Lv` ring · 2 currency chips (icon + number) ·
3 `.deck-jump-chip`s (인벤토리 / 성장 / 군단) that `scrollIntoView` — they are
**scroll anchors, not disclosure toggles**; every target is already in the DOM.

Scrolling `.deck-body`, all sections mounted simultaneously:

1. `#monarch-status` — **first element child** (browser contract, §6)
2. `#deck-section-inventory` — `equipmentOwnersMarkup()` 장비 등급 ladder
3. `#deck-section-growth` — `wardenSkillsMarkup()` 스킬트리, then
   `wardenStatsMarkup()` 스탯, then `wardenTraitsMarkup()` 특성
4. `#deck-section-legion` — companion roster grid + `formationRowMarkup()` 편성

Skills and inventory are reachable with **zero** taps and zero gestures (R2).
Order puts 인벤토리 and 스킬 above 특성/군단 because the directive names them.

### 4.2 RIGHT — `#command-deck-right`, 전황 시트

Sticky `.deck-masthead`: brand mark icon + current-front line (`aria-live="polite"`).
`.deck-body`: 3 showcase art cards → briefing (boss portrait + reward chip +
`<details>` for the stat table) → progression `<select>` → guide launcher →
stronghold archive (`renderStrongholdTab()` inline, its existing
`<details class="archive-tools">` retained, so `#import-defense` is in the DOM at load).

### 4.3 Geometry — canvas is never fully covered

| Viewport | Left | Right | Free canvas band |
|---|---|---|---|
| 1440×900 | 20rem = 320 | 18rem = 288 | 832 × 900 |
| 844×390 (landscape primary) | 26vw ≈ 219 | 24vw ≈ 203 | ≈422 × 390 |
| 700×390 | 13rem = 208 | 12rem = 192 | 300 × 390 |
| 390×844 (portrait fallback) | 46vw ≈ 179 | bottom strip, 42dvh | ≈211 × 489 |
| 320×568 | 46vw ≈ 147 | bottom strip, 42dvh | ≈173 × 329 |

`min-width: 700px` → two side columns. Below that the right deck re-anchors to the
bottom (`top:auto; bottom:0; left:<left width>; height:42dvh`) so the left character
sheet keeps a usable width on a portrait phone. `#start-defense` keeps its
bottom-centre fixed anchor at every size and gains `z-index: 6`; both `.deck-body`s
carry the existing compact bottom-padding reserve so no control hides under it.

### 4.4 Preserved hard contracts

- `#start-defense` present and clickable with **zero** interaction at load (it is
  appended by `renderSortieFab()` independent of any deck state — strictly stronger
  than the old `computeDefaultDockOpen('compact')` trick it replaces).
- 48dp floor on every interactive node in the decks (measured, §6).
- Every icon-only node stays `aria-hidden="true"` beside an `.sr-only` label, or
  carries `role="img"` + `aria-label`. Missing-asset glyph fallback preserved:
  `[data-ui-icon]` is only emitted when the plate exists, else the text glyph.

## 5. Image-driven presentation (R4)

Prose removed, replaced by existing generated art / mesh thumbnails / visual state:

| Was (text) | Now (screen + image) |
|---|---|
| `.monarch-arise-hint` paragraph | ARISE chip beside the gauge, sentence dropped |
| `EC 3/12 · 저지 Lv4` count strings | currency chip icons + gauge fill + `Lv` ring |
| companion list intro paragraph | portrait roster grid; slot frames carry the state |
| 편성 explanation paragraph (2 sentences) | rank-numbered slot frames + FRONT/BACK chips |
| `.lobby-guide-launch` paragraph | icon-led one-line launcher |
| stat/skill/equip rows: full description sentence | name + numeric chip; description kept ONLY where it names a mechanic the icon cannot (skill nodes) |

Icon plates reused from the existing allowlisted layer (`assets/images/battle/ui/hud/`):
`nav-inventory`, `nav-growth`, `nav-companions`, `nav-sortie`, `nav-stronghold`,
`brand-mark`, `control-sortie`, `currency-echo-core`, `currency-bound-fragment`.
Mesh portraits reused via `portraitMarkup()`: commander, per-companion, per-boss.

**No new runtime image file is created by this pass**, so the 4-file runtime
allowlist (`scripts/defense-runtime-assets.mjs`, `assets/defense-asset-manifest.json`,
`.github/workflows/static.yml`, `sw.js`) is untouched.

`[TARGET]` — not requested, recorded here instead of generated: a per-stat icon set
(`stat-vigor`, `stat-focus`, `stat-resolve`, …) and per-slot equipment plates
(`slot-weapon`, `slot-ward`, `slot-trinket`) would let the stat/equip rows drop their
last text labels. Until those exist the rows keep their short Korean labels — a
missing plate must degrade to a readable glyph, never an empty box.

## 6. Test migration (all 6 rewritten, none weakened)

| File | Old premise | New assertion (same user-visible behaviour) |
|---|---|---|
| `lobby-system-window-browser.test.mjs:102,148-150` | click rail tab to reveal `#monarch-status`; it is first child of `#command-dock-left .dock-panel-body` | `#monarch-status` visible with **zero** interaction; first element child of `#command-deck-left .deck-body`; companion roster reachable with zero interaction (the old `[data-dock-tab="companions"]` hop no longer exists — replaced by asserting the roster is already mounted, which is a stronger claim) |
| `lobby-guide-disclosure-browser.test.mjs:121-123` | `openSortieDock()` clicks a rail tab | `[data-stage-progress]` waited on directly — present at load |
| `stage-runtime-proof-browser.test.mjs:199` | conditional rail-tab click | same — direct wait |
| `world-presentation-browser.cjs:71` | conditional rail-tab click before showcase select | same — direct wait on `[data-stage-showcase]` |
| `defense-public-contract-browser.cjs:89` | conditional rail-tab click | same |
| `defense-stat-delta-browser.test.mjs:75-79` | click `.dock-panel-tabs [data-dock-tab="stronghold"]` to reach `#import-defense` | open `.archive-tools` disclosure and assert `#import-defense` visible, then import — plus an explicit new assertion that `#start-defense` is already present at load (the load-time contract the old comment only *documented*) |

## 7. Verification plan (numbers only — CLAUDE.md §6)

1. `grep -rn "dock-rail\|data-dock-tab\|dock-panel\|computeDefaultDockOpen" app.js styles.css index.html tests/` → expect 0.
2. The 6 files run individually; pass counts recorded.
3. `node --test` on the 3 `.test.mjs` of the six; counts recorded.
4. Playwright measurement script: for 844×390 and 1440×900 — free canvas band > 0,
   `#start-defense` hit-testable at load with zero interaction, `#monarch-status`
   visible at load, count of interactive deck nodes with `min(w,h) < 48` → must be 0,
   `documentElement.scrollWidth <= clientWidth`.
5. Screenshots at both viewports into `_workspace/current/ui/`.
6. `git status --short` before and after; nothing staged, nothing committed.
