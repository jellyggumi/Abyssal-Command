# Adoptable-Pattern Shortlist — "Game-like Outgame" for Abyssal Surge

Designer synthesis of the outgame-reference survey (`design/trend-survey/` + `qa/benchmark-notes.md`). This is the **bridge from survey → future redesign cycle**, NOT an implementation plan. It ranks concrete, evidence-backed, viewport-and-perf-safe patterns the wholesale outgame revision should adopt, each mapped to the current dock shell and a reference image.

## The one-line finding

Abyssal Surge structurally already ships 9 of the 13 recurring browser-outgame patterns and is *ahead* of the browser cohort on the rarest one — an always-visible live 3D canvas behind the dock (the "living background" only 1–2/13 comparables have). So the revision is **theater + legibility layered onto the existing dock, not new screens**: make the dock read as a game, not a form, cheaply and touch-safely.

## Adopt (ranked by impact × cheapness, all evidence-backed)

### A1 — Theatricalize idle-return as the loved "payday" recap  ★ highest impact, already-owned system
- Evidence: the idle "welcome back" recap is the ONE metagame surface players reliably *want* on return — "payday": big numbers, animation, distinct icons, optional "double it" (Lane C; AFK Arena ref). Abyssal already has an idle-return system rendered as a silent balance bump / dismissible toast.
- Adopt: on re-entry, present the accrued pile as an animated recap moment (count-up numbers, eased reveal, sound) before it folds into the stronghold recap — reward for *returning*, NOT a forced daily-login leash (avoid the documented backlash).
- Maps to: existing `renderIdleReturnToast()` + stronghold `.idle-return-recap`.

### A2 — Turn upgrade picks into illustrated cards with a verb economy  ★ high impact
- Evidence: `reference-images/soulstone-survivors-levelup-cards.jpg` (3 detailed cards: icon + type tags + full stat breakdown + Reroll/Banish/Lock) and `doodle-rpg-survivor-levelup.png` (browser-native spell cards + reroll). Players engage meta only when a choice feels like a decision, not a row (Lane C).
- Adopt: skill-tree nodes, stage-clear traits, and equipment-tier picks become illustrated cards (icon + tags + before→after stat delta) — the in-run growth-offer card is already close; extend that visual language into the outgame docks.
- Maps to: `renderGrowthTab()` nodes/traits, `renderInventoryTab()` equipment, existing `.edge-card` growth-offer style.

### A3 — Make the skill tree / equipment read as a shown MAP, not a list  ★ high impact
- Evidence: `reference-images/soulstone-survivors-skilltree.jpg` (radial node tree, rank pips X/5, persistent detail tooltip) and `melvor-idle-outgame.jpg` (dense skill rail, X/99 pips). Depth is *shown* — "there is a lot of game here."
- Adopt: lay the 5-node skill tree out as a visually connected node map with rank/cost pips and a persistent detail panel; give 5-tier equipment a tier-ladder visual with owned/next-tier framing.
- Maps to: `renderGrowthTab()` (skill tree segment), `renderInventoryTab()`.

### A4 — Collections as grid ↔ detail sets with locked/owned states  ★ medium-high
- Evidence: `reference-images/vampire-survivors-collection.jpg` (unlock grid 124/127 + detail tooltip) and `holocure-shop.jpg` (left action-rail + right item list + cost). Standard idiom for "filling a visible set."
- Adopt: companions (extractable roster), equipment tiers, and traits shown as icon grids with locked/owned/next states + a selected-detail panel — unlocking reads as completing a set.
- Maps to: `renderCompanionsTab()`, `renderInventoryTab()`, traits in `renderGrowthTab()`.

### A5 — Keep every persistent currency/progression readout always framed on-screen  ★ medium, cheap
- Evidence: all 5 image-backed benchmarks dock gold/souls/XP in framed pills at screen corners, always visible (benchmark-notes Calibration Takeaway 2).
- Adopt: warden points (Echo Core), equipment/Bound-Fragment currency, and idle-reward totals become first-class permanently-visible framed pills on the dock chrome — a reward readout the player passes constantly.
- Maps to: dock rail/header chrome (`renderDockSide()` header).

### A6 — Make the docks feel attached to / emit from the live canvas  ★ signature differentiator, do carefully
- Evidence: the live-canvas "living background" is the rarest, most-prized pattern (Lane A juice literature; benchmark Takeaway 6 "make the menu a place"). Abyssal already has it — the gap is the docks float *beside* it as flat panels.
- Adopt (cheap, viewport-safe only): panels slide/emit from the canvas edge, subtle depth/parallax against the 3D scene, reactive FRONT/BACK companions visible in the scene behind the companion dock, eased open/close tweens, sub-100ms tap feedback (scale + particle) on every dock control. NO heavy shaders — tweens/sprite-FX/pooled particles within the single-thread budget shared with combat.
- Maps to: `styles.css` dock rules + `renderShell()`; must respect reduced-motion parity + ≥48dp targets already established.

## Adopt-with-caution / defer

- **Daily-login reward hook** — only 3/13, and contested as manipulative (Lane C backlash). If added, tie to a play action ("first sortie of the day"), never a bare login streak. DEFER unless a retention need is proven.
- **Gacha/summon screen** — 2/13, primarily a mobile-store pattern; off-genre for a single-player deterministic offline defense-survivor. SKIP.
- **Hero-swap character-select** — Abyssal's identity is one Dusk Warden + companions, not a hero roster; don't import a hero-select just because 8/13 have one. Keep companions/formation as the roster surface.

## Hard constraints any redesign must honor (from the survey)

1. **Mobile-web viewport**: a left/right dock around a live canvas is tight on phones — juice = motion/feedback, not more panels; progressive disclosure for secondary info.
2. **Performance**: static GitHub Pages + Three.js single thread shared with combat — cheap juice only (tweens, sprite-sheet FX, pooled particles); watch first-paint (≈53% mobile bounce >3s).
3. **Touch**: ≥48dp targets, ≥8px spacing, sub-100ms visible tap feedback (no hover), thumb-zone primary actions.
4. **Legibility over exposure**: the #1 complaint is clutter/"currency soup"/nested-menu fatigue — every dock must answer "what does this buy me right now" inline; don't maximally expose.
5. **Don't relocate learned structure**: veterans fear overhauls that move critical info — add theater *around* the dock structure the last redesign established, don't rebuild navigation.
6. **Fast play path always bypasses management**: 출정→play must stay one thumb-reach away; players route around lobbies that gate combat.

## Handoff

This survey is complete and validated. The natural next cycle is a **Stage 1 concept + presentation-spec pass** (designer) that turns A1–A6 into a concrete outgame presentation spec, then ui-senior-developer layout + game-programmer implementation, gated on G4 (immersion/accessibility) and G6 (perf). Await user approval before starting implementation — this cycle was research-only per the intake brief.
