# Presentation Spec — Lobby Pass 1 (implementation contract)

Turns the meeting's DECIDED DIRECTION (`production/meeting-record-lobby-concept.md`, items 1–7) into an implementable contract. **Scope: the 출정 lobby surface only.** vanilla JS + Three.js, no framework. Files touched: `app.js`, `styles.css` (+ `index.html` only if a static node is needed). No sim/logic/catalog/renderer module changes. Every effect names a reduced-motion resting state (G4) and stays on the programmer's cheap-juice ceiling (compositor-thread transform/opacity + one self-terminating count-up + pooled DOM particles; NO new `backdrop-filter:blur` surfaces, NO new three.js scene objects, NO camera-coupled parallax this pass).

Canon palette (styles.css :root, use verbatim): `--canon-void-obsidian #3c2c5b`, `--canon-cold-steel #737990`, `--canon-cyan-rift #2cadd6`, `--canon-zenith-gold #ddc869`, `--canon-cinder-ember #f3592c`, `--rc-panel-glass`, `--rc-panel-border`.

Grounding lines (re-verify before editing — they shift): `renderSortieTabBody` app.js L784-809, `renderDockRight` L812-893, `renderSortieFab` L900-923, `renderIdleReturnToast` L930-944, `idleReturnSummary` L303-319 (returns `{outcome, total, text}`; SETTLED receipt also carries `receipt.awardedProgress`), `wardenGrowthData` L465-476 (available EC = `echoCoreEarned−echoCoreSpent`, available BF = `boundFragmentEarned−boundFragmentSpent`), `renderDockSide` header L657-667, `renderShell` L950+, `mountShell` (mounts the 4 persistent siblings + calls `renderIdleReturnToast` once).

---

## Item 1 — Aperture framing (A6): docks read as bolted to the live scene

**Target:** `styles.css` dock rules (`#command-dock-left/right`, `.dock-panel`), no JS.
**Mechanism (all compositor-thread / static):**
- Add a **static 1px cyan-rift edge seam** on the canvas-facing edge of each dock: `#command-dock-right .dock-panel { box-shadow: inset 1px 0 0 rgb(44 173 214 / .5); }` and mirror for left (`inset -1px 0 0`). No animation.
- Keep the existing `.dock-panel { transition: transform 200ms ease }` slide as the "emit" motion (already present) — do NOT add a new transition.
**Gate:** zero new per-frame cost (static box-shadow). **Reduced-motion resting state:** seam is static, unaffected.
**Non-goal this pass:** no scene re-tint/mesh-swap on stage-select, no parallax (deferred, needs `recordFrameProbe`).

## Item 2 — Persistent 2-currency pill rail (A5)

**Target:** new render fn `renderCurrencyRail()` in `app.js` + a persistent `#currency-rail` node mounted once in `mountShell()` (sibling of the docks, like `#idle-return-toast`); `styles.css` `.currency-rail`/`.currency-pill`.
**Data:** `const ec = echoCoreEarned(campaign) - echoCoreSpent(campaign); const bf = boundFragmentEarned(campaign) - boundFragmentSpent(campaign);` (matches `wardenGrowthData` affordability math). Guard `if (!campaign) return;`.
**Markup:** two `<button>` pills (≥48dp): `◈ Echo Core <n>` (cyan rim) and `✦ Bound Fragment <n>` (gold rim). Each pill `aria-label` names currency + amount. Clicking EC pill opens left dock on `growth`, BF pill opens left dock on `inventory` (`dockOpen.left=true; activeLeftDockTab=…; if compact dockOpen.right=false; renderShell()`), deep-link not duplication.
**CSS:** `.currency-rail { position: fixed; top: max(.6rem, env(safe-area-inset-top)); left: max(.6rem, env(safe-area-inset-left)); z-index: 6; display: flex; gap: .5rem; pointer-events: none; }` pills `pointer-events: auto`. Pill = `.rc-glass`-family bg, `min-height: 44px` (content) but hit-area ≥48dp via padding; EC border `--canon-cyan-rift`, BF border `--canon-zenith-gold`.
**Pre-run-only + yields to combat HUD:** gate visibility on `#defense-battle-surface[data-defense-started="false"]` — hide the rail once `data-defense-started="true"` (mirror the edge-hud rule). Re-render the rail inside `renderShell()` (value updates only on re-render, static DOM otherwise).
**Gate (A5/G6):** exactly **2 pills, no more** (currency-soup guard). DOM add ≈ 8 nodes. **Reduced-motion:** pills are static; value change may use the existing 120ms `transition: color` only, resting state = final number.
**Value-consistency check:** EC/BF shown must equal the affordability balance the growth/inventory docks spend against.

## Item 3 — Reward-forward briefing (A2)

**Target:** `renderSortieTabBody` app.js L797-807 (the `.briefing-panel`).
**Change:** promote reward to a headline, collapse the 5-row `<dl>` behind a disclosure:
- Insert, right after the `.briefing-target` block, a **reward headline**: `<p class="briefing-reward"><span>승리 시 →</span> <strong>${escapeHtml(nextRewardName(selected.id))}</strong></p>` — `.briefing-reward strong` colored `--canon-zenith-gold`.
- Wrap the existing `<dl class="briefing-stats">…</dl>` in `<details class="briefing-detail"><summary>전황 상세</summary> … </details>` — **closed by default**. Keep ALL 5 rows verbatim inside (data preserved; only default visibility changes) BUT remove the now-duplicated `<dt>다음 보상</dt>` row (L805) since it's promoted to the headline.
**Gate (A2/constraint#4):** briefing leads with reward + one threat line (`selectedObjective` already in `.briefing-target`); terrain detail is one tap away. **Reduced-motion:** `<details>` is native toggle, no animation needed.
**Test note:** `defense-public-contract-browser.cjs`/`world-presentation-browser.cjs` assert on briefing text — the strings stay in the DOM (inside `<details>`), so `textContent` assertions hold; if any test used `innerText`/visibility, retarget to `textContent` (same fix pattern as the D9 stat-delta test).

## Item 4 — Stage rail: selected-card expand + 봉쇄선 spine (A3/A4)

**Target:** `renderSortieTabBody` stage-rail L788-795 (markup unchanged where possible — prefer CSS) + `styles.css` `.stage-rail`/`.stage-card`.
**Mechanism (CSS-first, wide-tier spine):**
- `.stage-card.is-selected` (class already applied L793) → expanded treatment: larger art thumb, brighter border, keep the single `rc-glow-ring` (already only on selected — do NOT fan out).
- Non-selected cards compact (smaller art, single line). All CSS on existing markup.
- **봉쇄선 spine (wide tier only, `@media (min-width: 900px)`):** a `.stage-rail::before` vertical connector line (cyan-rift→faded gradient) + per-card node dot via `.stage-card::before` (cleared=held/steel, selected=lit/cyan glow, locked=dark). Pure CSS, zero JS, zero per-frame cost. On compact (<900px) the spine connector is `display:none` — the rail stays the A4 grid↔detail read (selected expanded + compact rows).
**Add a reward chip on the selected card face:** in the stage-card markup, when `stage.id === selected.id`, append `<span class="stage-reward-chip">✦ 보상</span>` (gold). Minimal markup add.
**Gate (A3/A4):** selected card visibly expanded; wide-tier spine present; ≥48dp card hit area preserved. **Reduced-motion:** selected card keeps a static border (glow ring already `@media (prefers-reduced-motion: reduce)`-guarded elsewhere — confirm it degrades to static border).

## Item 5 — Idle-return "payday" count-up (A1)

**Target:** `renderIdleReturnToast` app.js L930-944.
**Mechanism (free — sim idle in lobby):** replace the static `<p>` with a bounded **one-shot count-up**:
- Only for `SETTLED` outcome with `receipt.awardedProgress > 0`: render an eyebrow (`귀환 · 봉쇄선이 버텼습니다`), a big `--canon-zenith-gold` number counting 0→`awardedProgress` over ~600ms (≈30 steps via a **self-terminating** `requestAnimationFrame`/`setInterval` that clears itself; never a persistent loop), then a small `누적 ${total}` line. After the count, a `world-damage-rise`-style transform+opacity reveal (idiom at styles.css ~L240) on the number.
- ENCROACHED → cinder-ember eyebrow with the existing no-loss reassurance text (from `idleReturnSummary().text`) surfaced as the beat; no count-up (nothing awarded).
- Other outcomes → current static text.
- **Tap-skippable** (click → jump to final number then remove); **never blocks the FAB** (stays top-center, `max-height:20vh`, does not overlap the bottom FAB); auto-dismiss retained (8s).
**Reduced-motion (G4):** if `matchMedia('(prefers-reduced-motion: reduce)').matches`, **paint the final number immediately** (no count-up, no rise) — resting state = the final `+N` + `누적`.
**Gate (A1):** fires only on real `idleReturnReceipt`; reward-for-returning, not a login leash; zero new economy (reuses `idleReturnSummary`/`awardedProgress`).

## Item 6 — 작전 개시 CTA polish (pattern #1)

**Target:** `renderSortieFab` app.js L900-923 (keep id `#start-defense`, placement, handler — polish only) + `styles.css` `.sortie-fab`.
**Mechanism:**
- Ensure the FAB is the **only `--canon-cinder-ember`-filled element** on the lobby (audit: nothing else uses ember fill pre-run).
- Add sub-100ms press feedback: `.sortie-fab:active { transform: scale(.97); }` (compositor-thread) + one **pooled-DOM particle** burst on click (3–5 screen-space `<span>`s transform+opacity then recycled, NOT three.js). Slow ambient `box-shadow`/opacity breathe (one element, compositor-only).
**Gate/touch:** ≥48dp (already `min-height:56px`); sub-100ms visible response. **Reduced-motion (G4):** `:active` scale + breathe suppressed by the global reduced-motion rule → resting state = a static pressed background/border on `:active` so feedback stays perceivable; particle burst skipped under reduced-motion.

## Item 7 — Palette discipline (A5 + constraint #4)

**Cross-cutting audit, no new mechanism:** verify in the final diff that `--canon-zenith-gold` appears ONLY on reward/payday numbers (currency BF pill rim, reward headline, reward chip, payday count-up) and `--canon-cinder-ember` ONLY on the CTA + any abyss heat; cyan-rift on world/seams/selected-glow; void-obsidian/cold-steel on chrome. Gold-means-reward is the anti-currency-soup rule made visual.

---

## Acceptance (what "pass 1 done" means)

1. `node --check app.js` passes; CSS brace-balanced.
2. All 3 CI-gated browser contracts (`defense-hud-responsive-browser.cjs`, `defense-survivor-browser.cjs`, `defense-performance-browser.cjs`) PASS.
3. Full unit suite: no NEW failures vs the known pre-existing 3-failure baseline (battle-session-cutscene-audio, world-presentation-contract, stage1b-evidence-exporters).
4. Browser-verified at **390×844** (compact: right dock open, currency rail top-left, reward-forward briefing with collapsed 전황 상세, payday count-up on a seeded idle return, ember CTA with tap feedback) and **2056×1082** (wide: both docks + 봉쇄선 spine visible, currency rail, seams).
5. `prefers-reduced-motion: reduce` verified: count-up paints final number, CTA/selected/pills land on static resting states, nothing silently disappears (G4).
6. DOM count still <5% of the 5000 ceiling; input latency <100ms (G6) — re-run the performance contract.
7. 2 currency pills exactly (no soup); EC/BF match the growth/inventory affordability balance.

## Deferred (recorded, not this pass)
Scene re-tint/mesh-swap on stage-select, camera-coupled parallax, new blur surfaces, three.js scene inhabitants, gacha/summon reveal theater, adaptive audio, prestige-reset, daily-login, notification badges, monetization "double it". Each returns only with a `recordFrameProbe` before/after where it touches the frame.
