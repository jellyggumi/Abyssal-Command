# Meeting Position — UI (IA / HUD / Input / Accessibility)

run: `20260728-gameplay-gap-research` · role: ui-senior-developer · read-only, no source touched
domain owned: information architecture, component contracts, HUD layout, accessibility, input-latency
inputs read in full: `production/gap-analysis.md`, `production/current-structure-baseline.md`, `engineering/current-systems-inventory.md`, `intake/design-intent-digest.md`, `research/comparable-gameplay/report.md` (10 titles), plus the SHIPPED dock this pass would extend: `app.js:143-1290`, `_workspace/archive/20260727-lobby-dock-redesign/ui/{hud-layout-spec,component-contracts,perf-notes}.md`.

## 0. The UI-domain thesis in one line

**Every system the priority ranking wants to surface (G2 sink, G1 tier ladder, G3 M4 card + reward companions + formation depth) maps onto an IA slot that ALREADY EXISTS in the shipped 2-dock / 5-tab shell. Zero new docks, zero new tabs, zero new full-screen surfaces.** The gaps are unbuilt *mechanics wired to dead data* (baseline §Dead 1-9), not missing screens. From the UI seat this makes G2+G1 genuinely cheap to surface — and makes G3's in-run pieces the only real HUD-density risk, because the edge-HUD top band already FAILED perf/portrait (G6 mobile p95 33-50ms; portrait top band 157px of 844 = 18.6%, `current-ui-stage-audit` OBSERVED).

---

## 1. IA placement — where each proposed system LIVES (reuse docks, add no chrome)

Shipped shell, code-verified (`app.js`):
- **Left dock `성장 덱` / `#command-dock-left`** — tabs `growth · companions · inventory` (`app.js:747-756`, `LEFT_DOCK_TABS`). Owns permanent power spend; reads both currencies via `renderRailCurrency()` (`app.js:1152-1166`); deep-linkable via `openLeftDockTab()` (`app.js:1170-1176`).
- **Right dock `전황 덱` / `#command-dock-right`** — tabs `sortie · stronghold` (`app.js:942-956`, `RIGHT_DOCK_TABS`). Owns "where/what campaign" — stage select + briefing, and permanent record + archive tools.
- **`#start-defense.sortie-fab`** — the one persistent pre-run CTA (`app.js:1050-1058`), removed from DOM on `beginRun()`.
- Both docks force-collapse to rail-only on run start (`app.js:1056,1287`); mid-run peek allowed, edge-HUD stays visible (decoupled, `hud-layout-spec §6`).

| Proposed system | IA home (EXISTING slot) | Placement decision | Cost |
|---|---|---|---|
| **G2 idle-sink "settlement"** | **Left dock, as a THIRD currency** | Undertow output becomes a spendable currency pill on `#command-dock-left .dock-rail` next to the shipped EC/BF pills (`renderRailCurrency()` already renders 2). Its SINK is the growth/companions/inventory spend flows already in that dock. **No settlement "screen" — settlement = a currency + existing spend targets.** | 1 pill node + accept-new-currency in existing spend guards |
| **G1 tier-ladder selector** | **Right dock, sortie tab, above the stage rail** | A segmented "Encroachment 티어 N" stepper sits atop the shipped stage-rail spine (sortie tab). Reuses the 10 stages as a re-run ladder (baseline G1 = "reuse 10 stages"); tier multiplies the briefing's reward preview `<dl>`. **No new stage screen — a modifier on the home view.** | 1 stepper (≤3 controls) + multiplier line in existing briefing dl |
| **G4 M4 card (sim exists, UI=0)** | **Edge-HUD, in-run, as a paused decision card** | The natural G3 in-run decision surface. Reuse the shipped growth-offer modal component (paused 1-of-N card, focus mgmt, `app.js:2430`) — M4 is a binary SELECT/DECLINE commit at an occupation checkpoint (`defense-run-simulation.js:1132-1156`). **NOT a dock element** — it's a run-scoped decision, belongs beside the D-pad. | reuse growth-card contract; 1 new snapshot-feedback branch |
| **G4 reward-only companions (3, never collect)** | **Left dock, companions tab, as locked slots** | Surface `pack-warden / lantern-reaver / requiem-warden` (baseline §Dead 7) as a "materialize for N Undertow" locked-slot state in `renderCompanionsListSegment()` (`app.js:597-601`). This is HoloCure's collection-as-sink (see §2). | 1 new `is-locked` slot state in existing loadout-slots markup |
| **G3 formation-depth feedback (AFK model)** | **Edge-HUD, state-on-existing-nodes** | No new panel. The legion roster + formation/stance readouts already exist (`#battle-legion-roster`, `#battle-formation-state`, `#battle-stance-mode`, `app.js:1260`). Synergy-threshold and positional-role state ride those nodes as glyph/text badges. (See §3.) | 0 new nodes; state attrs on shipped readouts |

---

## 2. Reviving dead content as UI (cite report.md)

**M4 card = the natural G3 in-run decision surface. YES.**
- Sim is complete: `AVAILABLE → RECOVERY_PENDING → RECOVERED/FALLBACK`, binary `SELECT/DECLINE` tied to `card.checkpointObjectiveId`, fires `M4_CARD_AVAILABLE` at run creation (`defense-run-simulation.js:1132-1195, 2235`). Baseline §Dead 4 confirms **"no `renderM4`, no `M4_CARD_DECISION` sender, no combat effect."** It is a fully-built decision engine missing exactly one thing: **its card and its two buttons.**
- report.md GAP-3 evidence converges on a *second in-run axis*: **VS** "add at least one in-run transformation gate… triggered by clearing the occupation-hold or the boss" (VS →Relevance, l.51); **20MTD** synergy card "two prerequisite picks unlock a named combo with a genuine trade-off" (l.131). M4's checkpoint-gated commit is structurally the same shape. Our single 3-of-8 draft (baseline: max Lv9, no ranks/synergy) is *the* thin axis; M4 is a ready-made second axis whose UI is the cheapest in the whole gap set — **reuse the shipped paused-growth-card contract verbatim** (`app.js:2430`), swap 3-of-N for SELECT/DECLINE.

**Reward-only companions as a G2 sink. YES — this is literally HoloCure's model.**
- report.md HoloCure Holo-House: **"a farming/collection layer should have TIERED REINVESTMENT SINKS (worker upgrades, gacha, anvil, casino, decorations) so accrued coins flow back into power AND vanity"** (HoloCure →Relevance, l.111); economy line: sinks are **"numerous and TIERED so the economy keeps reinvesting rather than running dry"** (l.105). The report's explicit ADOPT: "give idle accrual a real currency that funds meta power (equipment tiers, trait unlocks, companion upgrades) plus optional vanity outlets."
- Our 3 reward companions can never enter `companionCollection` (baseline §Dead 7, code-verified `captureElite` only ever gets `stage.eliteCompanion`). Making them **"materialize for N Undertow"** turns dead catalog data into HoloCure's coin→collection sink — collection *is* the retention spine (report l.103) — WITHOUT the Holo-House flaw the report warns against: Holo-House **"requires the app open (no true offline calc) — our offline-settle is architecturally BETTER"** (l.111). We keep true-offline accrual (`settleIdleReturn`, baseline §5), add only the sink UI.

**Idle-return toast is already the perfect entry hook.** Shipped `#idle-return-toast` welcome-back count-up (`app.js:1290`, lobby-concept "payday count-up"). Today it announces a vanity number. Deep-link it into the growth dock (`openLeftDockTab('growth')` exists, `app.js:1170`) so the "payday" immediately lands on a spend target — mirrors AFK Journey "log in, collect, pour resources into leveling" (report l.218) and Melvor "offline output → immediately feed the next loop" (l.164,171).

---

## 3. G3 formation-depth HUD feedback — AFK model without clutter

report.md AFK Journey is the cited model: **"a single tile shift beats higher-stat enemies; faction-synergy thresholds (3+ = team buff), positional roles (bait/protect/group-for-AoE), manual-Ultimate timing turn a near-passive fight into a puzzle"** (AFK →Relevance, l.231). Our version must respect: mobile edge-HUD, reduced-motion, ≤100ms feedback, no new nodes.

Our shipped raw material (all already in the DOM, `app.js:1260`, `rpg-catalog.js:97-173`):
- `#battle-legion-roster` — per-companion chips (already rendered).
- `#battle-formation-state` / `#battle-stance-mode` — live text readouts.
- BACK-row synergy IS ALREADY A REAL THRESHOLD in sim: `BACK_ROW_SYNERGY_DAMAGE_BONUS +25% when ≥1 FRONT alive` (`rpg-catalog.js` / sim `:826-828`) — but it's **invisible to the player.** The AFK "synergy threshold = agency" fix is 80% *communication of a mechanic that already fires*, not new mechanics.

HUD contract (state-on-existing-nodes, no new panels):
1. **Synergy-threshold badge on the roster** — when the `≥1 FRONT alive` condition holds, BACK chips in `#battle-legion-roster` get a `data-synergy="active"` attr → a `+25%` micro-badge + text ("후열 시너지"). Color-independent: **glyph + text**, reusing the shipped color-independent-encoding rule (`component-contracts §3.1 a11y`). When it drops (all FRONT downed), attr clears → badge greys with strike text. This makes the existing dead-silent +25% legible = the single highest-leverage G3-feedback change.
2. **Positional role on each chip** — FRONT/BACK glyph + role tag (vanguard/striker/support already fixed by id, `rpg-catalog.js:86-95`); derive `data-exposed` (BACK unprotected when 0 FRONT) so "protect your backline" reads at a glance.
3. **Stance-switch confirmation reuses the SHIPPED motion-safe glow** — `stanceConfirmUntil` held-glow (`app.js:1365-1371`), which the code comment already flags as **"set under reduced-motion — the held glow is not motion, so it remains a valid accessible success signal."** No new motion introduced.

Clutter/perf discipline: all three are attribute/text updates inside the existing snapshot-render pass (`app.js:1923-1927` feedback scan) — **zero new DOM nodes**, so the FAILED top-band budget (portrait 157px, G6 mobile 33-50ms) does not grow. If synergy state needs its own line, it replaces low-value telemetry text (`RUN STATE · AGENCY` eyebrow), never adds a row — directly answering `current-ui-stage-audit` finding 12 (mixed telemetry, small type).

---

## 4. Accessibility / input-latency + the overcrowding flag

Non-negotiables, all with shipped baselines to hold the line against:
- **≤100ms input feedback.** Shipped dock transitions measured **2.9 / 4.9 / 0.5 ms** (rail-open / tab-switch / close, `perf-notes.md` table) — synchronous DOM mutation, zero setTimeout/rAF/await. Every NEW interaction (settlement spend, tier stepper, materialize, M4 SELECT/DECLINE) MUST stay in that synchronous handler pattern; sim-side M4 rides `queueInput` next-tick (`defense-run-simulation.js:2244`) exactly like the shipped STANCE_CYCLE/SKILL_CAST, so its visible acknowledgment is a snapshot-feedback branch (same path as `battle-event-feedback`, `app.js:1924`).
- **Touch targets ≥48dp.** Shipped rail buttons are 48×48 (`styles.css:46,84`, fixed THIS session-family from a 40×40 defect, `decision-log D`). New tier stepper / materialize / M4 buttons inherit 48×48; the 44×44 panel-close is the one documented exception (`gate-reviews/ui-g4-g6`).
- **Contrast** reuse `.rc-glass` token pair — shipped worst-case **7.97:1 (exceeds AAA)**, so no new color risk (`hud-layout-spec §9`).
- **Reduced-motion** honored by reusing the existing glow-not-move success language (§3.3).

**OVERCROWDING RISK — flagged, with a hard boundary.** We JUST fixed dock overlap this session (`decision-log`: rail-tab 40→48px overlap; the whole 2-dock redesign exists to kill the full-overlay crush). Compact-tier canvas is already only **52-61px (14-16%)** with one panel open (`hud-layout-spec §5.4` table). Therefore:
- ✅ SAFE (what I propose): +1 currency pill on the rail, +1 tier stepper *inside* the sortie panel, +1 locked-slot *state* in companions, M4 as an *edge-HUD run-scoped* card, formation feedback as *state on existing nodes*. Worst-case DOM stays near the shipped **205-294 nodes (4-6% of the 5000 ceiling)** — new additions are ~single-digit nodes each.
- ⛔ BLOCK (what I will oppose): a **6th tab**, a **3rd dock**, or a **Holo-House-style "management board" screen.** Any of those breaks the 56px-rail / single-exclusive-panel math (`hud-layout-spec §5.2-5.3`) and re-introduces the exact "lobby screen" pattern the redesign deleted. The settlement sink MUST be a currency-on-existing-spend, not a new destination. This is the load-bearing UI constraint on the whole G2/G1 concept shift.

---

## 5. Component-contract sketch (implementation-ready, reuses shipped contracts)

```yaml
# A. G2 settlement currency (left rail) — extends renderRailCurrency() app.js:1152
UndertowPill:
  dom: "span.dock-currency-pill[data-currency='undertow'] inside #command-dock-left .dock-rail"
  value: "campaign.idleReturn.totalProgress (baseline §5 — TODAY a dead vanity read app.js:310-315; becomes earned-minus-spent like EC/BF)"
  sink_targets: "existing spend guards accept 'undertow' as a 3rd tender for {trait-reroll (new affordance in growth 특성 segment), companion materialize (below), optional vanity}"
  a11y: "aria-label with numeric value; glyph+text, not color-only"
  latency: "read-only render in existing renderRailCurrency() pass; spend = synchronous handler + campaign-state transition, ≤100ms"

# B. G1 tier stepper (sortie tab, above stage rail)
EncroachmentTierStepper:
  dom: "div.tier-stepper[role=group] prepended to sortie tabBody, ABOVE existing stage-rail"
  controls: "[− tier] [티어 N] [+ tier], each ≥48x48; gated by highest cleared tier (reuse unlockedStageIndex gating pattern campaign-state.js:186)"
  effect: "multiplies the reward-preview values in the EXISTING briefing <dl>; feeds a tier param to beginRun() (no new screen)"
  reference: "Soulstone Curse tiers (report l.91) / Survivor.io 3-tier Challenge (l.151) — 'each tier must be cleared to unlock next, multiplies payout'"

# C. G3 M4 card (edge-HUD, in-run) — REUSE growth-offer card contract app.js:2430
M4DecisionCard:
  dom: "section.edge-card.m4-card (same class family as .defense-result / growth card), z-index over canvas, NOT in a dock"
  trigger: "snapshot event M4_CARD_AVAILABLE (already emitted sim:2235); render in the existing SNAPSHOT_FEEDBACK scan app.js:1923"
  controls: "[선택 SELECT] [보류 DECLINE], 48x48+, focus trapped like growth card (focusBeforeGrowth app.js:2430)"
  send: "queueInput(run,'M4_CARD_DECISION',{cardId,decision}) — sim path already live sim:1232"
  reduced_motion: "no entrance motion; reuse growth-card static present"

# D. G4 reward-companion materialize (companions tab) — extend renderCompanionsListSegment app.js:597
LockedCompanionSlot:
  dom: "add 'is-locked' variant to existing .loadout-slot markup (today: is-filled | empty)"
  content: "locked silhouette + '{name} · N ⟨undertow⟩로 소환' button (≥48dp)"
  action: "spend Undertow → add prototype to companionCollection (reuses addCompanion path)"
  reference: "HoloCure coin→collection tiered sink (report l.103,105,111)"

# E. G3 formation feedback (edge-HUD) — state on shipped nodes, ZERO new nodes
FormationSynergyReadout:
  targets: "#battle-legion-roster chips (data-synergy, data-exposed), #battle-formation-state text"
  source: "BACK_ROW_SYNERGY_DAMAGE_BONUS condition already computed in sim :826-828 — surface, don't invent"
  encoding: "glyph + text badge (+25% / 후열 시너지 / strike when lost); reuse motion-safe stanceConfirm glow app.js:1365"
```

---

## VOTE

**Stage 1 concept shift — CONDITIONAL.** From the IA/HUD seat the G2+G1 axis shift is genuinely cheap: every surface it needs already exists in the shipped 2-dock shell (settlement = 3rd currency on the left rail; tier ladder = stepper atop the sortie tab; both reuse `renderRailCurrency`/`openLeftDockTab`/stage-rail). The dead-content revivals (M4 card, reward companions) are the *cheapest* wins in the whole gap set — built sim, missing only their UI. **Condition:** it stays a Stage 1 shift ONLY if the settlement sink is a currency-on-existing-spend and the tier ladder a modifier-on-home-view — **no 6th tab, no 3rd dock, no Holo-House management screen.** The moment G2 wants a dedicated "settlement building" surface, it stops being cheap IA and becomes a shell rebuild that re-opens the overcrowding we just closed — at which point I'd hold it to Stage 2. The real UI risk is not navigation; it's edge-HUD density (G6 already FAIL, portrait top band 18.6%), so G3's in-run pieces (M4 + synergy feedback) must be state-on-existing-nodes, never new chrome.

**Smallest high-leverage step (UI domain):** Wire the Undertow accrual as a **third currency pill** on `#command-dock-left .dock-rail` (extend `renderRailCurrency()` `app.js:1152`) + retarget the shipped idle-return toast's deep-link to `openLeftDockTab('growth')` (`app.js:1170`). This flips baseline §Dead-3 (vanity `totalProgress`) into a visible, spendable, one-tap-to-sink currency using two functions that already exist — no new node beyond one pill, and it lands the "payday → spend" loop (Melvor l.171 / AFK l.218 pattern) on day one.

**Proof-number (input-latency / IA metric):** Every new decision surface (settlement spend, tier stepper, M4 SELECT/DECLINE, materialize) resolves tap→visible-DOM-mutation in **≤100ms** (shipped dock baseline 0.5–4.9ms, `perf-notes.md`), AND total shell DOM stays **<350 nodes** at worst-case compact tier (shipped worst case 205–294, `perf-notes.md`), with **0 new docks / 0 new tabs** and every new interactive target **≥48×48dp**. If any settlement design forces a 6th tab or pushes worst-case DOM/latency past those lines, the IA cost has crossed from Stage-1-cheap to Stage-2-rebuild.
