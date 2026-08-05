# Design-Intent Digest — Abyssal Command / Abyssal Surge

run-id: `20260728-gameplay-gap-research` · role: Design-Doc Archivist (read-only) · date: 2026-07-28
purpose: capture what the game is **SUPPOSED** to be (design intent) so a later gap-analysis can separate *designed-but-unbuilt* from *genuinely-absent*. This digest reads DESIGN DOCS + RETROSPECTIVES; it is **not** a code audit. Where a design doc's own OBSERVED code map (`engineering/current-core-loop-map-20260726.md`) verifies shipped state, that is cited as `[core-loop-map]`.

Sources read (newest→oldest):
- `_workspace/20260727-lobby-dock-redesign/` (brief, task-manifest, cycle-1 retro, `production/gate-reviews/ui-g4-g6.md`)
- `_workspace/20260727-outgame-lobby-concept/` (`design/presentation-spec.md`, cycle-1 retro)
- `_workspace/20260727-outgame-reference-survey/` (brief, `design/adoptable-pattern-shortlist.md`)
- `_workspace/20260726-stage1b-cinder-pressure-agency/` (brief, task-manifest, cycle-2 retro, `qa/gate-measurements.md`, `design/{core-loop,pressure-agency-redesign,novelty-scorecard}.md`, `pm/{reward-bands,revenue-forecast}.md`, `engineering/current-core-loop-map-20260726.md`, `design/foundation-20260723-concept.md`)
- `_workspace/20260723-solo-warden-rpg-concept/` — NOT a live folder; recovered read-only from git commit `cc73402` (`design/UNIFIED-GDD.md`, `retrospectives/cycle-4-retrospective.md`)
- repo-root `docs/abyssal-command-defense-survivor-design.md`, `docs/abyssal-surge-production-cycle.md`

**No `UNIFIED-GDD.md` exists at repo root or in any live run.** The only unified GDD is the Stage-1 concept GDD, addressable read-only via `git show cc73402:_workspace/20260723-solo-warden-rpg-concept/design/UNIFIED-GDD.md`. Its status header states verbatim: *"Stage 1 Concept — 문서 확정, 코드 미구현"* (document-frozen, code-unimplemented). Much of what it specified as [TARGET] has since been built (see features table); treat the GDD as the design ceiling, not current state.

---

## 1. Game vision / core fantasy / pillars

**Product definition (repo-root contract, `docs/abyssal-command-defense-survivor-design.md`):** a **mobile-first single-player defense-survivor**. Player moves a survivor; basic combat auto-resolves. One run = an XP build + permanent companion collection, across a fixed **10-stage campaign** (Stage 10 boss = campaign complete). Deployed as static GitHub Pages, offline/local-first, JSON export/import.

**Core fantasy (stage1b brief):** *"command one abyssal warden and a small formation through a readable hold-surge-extract cycle"* — i.e. read pressure → choose growth/formation/extraction → see the decision persist into the next sortie.

**Layered vision (UNIFIED-GDD):** an **RPG deepening layer** ("Solo Warden RPG") bolted on top of the shipped defense-survivor, importing *structural* principles (not names/art/numbers) from Solo Leveling (only one hero grows uniquely), Kingshot (stronghold growth + stronghold defense + formation), and generic RPG vocabulary (stats/inventory/skilltree/tiers/roles). Canon preserved: Dusk Warden, Echo Deep, Moonless Court, Gate Zenith; verb chain **hunt→extract→materialize→capture→assault**.

**Pillars / hard boundaries (repeated across every doc — these are load-bearing):**
1. **Deterministic 60 Hz simulation** authoritative; renderer reads frozen snapshots only, never writes back, never alters `getRunDigest()`.
2. **Movement-only player input**; auto-attack + auto-target. New agency lives in the **3-stance formation** strategic layer, not manual aiming.
3. **Mobile-first full-bleed Canvas + edge-only HUD**; fullscreen/landscape-lock auto-request; reduced-motion respected.
4. **No monetization, ever** — no paid path, account, premium currency, ads, gacha, paid power/reroll/recovery. (This is why **G5 is permanently N/A, never PASS**.)
5. **Run-scoped vs campaign-permanent state strictly separated** (2-path ownership: permanent ledger vs discarded run snapshot).
6. **Zero runtime dependencies** (empty `package.json` deps); a WebGL renderer was built once and deleted (6,761 lines, commits `161a2ab`~`141b8f7`) — the deterministic-sim boundary is deliberately minimal-surface.

**Quality-gate framework (game-studio-harness):** G1 worldview/narrative · G2 balance numbers · G3 player-type diversity · G4 immersion (effects/animation, median ≥4.0/5) + accessibility inputs · G5 monetization fairness (N/A here) · G6 game-ops/performance (p95 ≤16.7ms frame, DOM ≤5000, input ≤100ms, stable soak) · G7 core-loop + Elite-Extract route (needs **human** evidence: 10 participants / 20 eligible decisions / ≥14 voluntary re-entries, every circuit 30–180s) · G8 novelty (≤2/5 comparable-title frequency + human impression median ≥4.0/5).

---

## 2. Features table (feature | status | evidence-run)

Status legend: **[SHIPPED]** verified live by a run's own OBSERVED code map or a PASS gate · **[SHIPPED-INERT]** code path reachable but numeric effect disabled by signed balance policy · **[DESIGNED-NOT-BUILT]** specified in a design doc, no live implementation claimed · **[DEFERRED]** explicitly pushed to a later cycle/stage by a retrospective or spec.

| Feature | Status | Evidence-run / anchor |
|---|---|---|
| Deterministic 60 Hz defense-survivor sim, snapshot-only renderer (Three.js primary, Canvas2D fallback) | [SHIPPED] | stage1b `[core-loop-map]` §executive, §renderer-snapshot |
| Warden movement (D-pad/WASD), auto-attack, auto-target | [SHIPPED] | stage1b `[core-loop-map]` (movement, offense-execution rows) |
| 3-stance formation VANGUARD/TURRET/SPLIT, 4s cooldown, stance-derived FRONT count (2/1/1) | [SHIPPED] | solo-warden cycle-4 retro (spec→impl→verify); stage1b `[core-loop-map]` (stance row) |
| Run-scoped XP skill offers (paused 3-of-N pick, gone if unchosen, wiped at run end) | [SHIPPED] | repo design doc §런과 성장; stage1b `[core-loop-map]` (growth-offer row) |
| Active learned-skill casting (buttons after learning; not a basic-attack button) | [SHIPPED] | stage1b `[core-loop-map]` (offense-execution row) |
| Run-scoped item drops (Echo + stage item, proximity auto-collect, ITEM_COLLECTED) | [SHIPPED] | stage1b `[core-loop-map]` (items row) |
| Elite extraction: spatial occupation hold → timed Bind window → explicit EXTRACT_ELITE → permanent companion capture | [SHIPPED] | repo design doc §런과 성장; stage1b `[core-loop-map]` (elite/extraction + campaign-handoff rows) |
| Track A — Dusk Warden permanent growth: 6 stats + 5-node skill tree, resource **Echo Core** (budget 40) | [SHIPPED] | UNIFIED-GDD §3.2; stage1b `[core-loop-map]` (permanent-Warden row: "Echo Core buys stats/skill-tree nodes") |
| Track B — companion progression: 3 role passives (Vanguard/Striker/Support) + 5-tier equipment (3 slots), resource **Bound Fragment** (budget 10) | [SHIPPED] | UNIFIED-GDD §3.3; stage1b `[core-loop-map]` (permanent-Warden row: "Bound Fragments buy 3-slot equipment tiers") |
| Warden traits: deterministic 3-of-8 offers on cleared-stage sequences | [SHIPPED] | UNIFIED-GDD §3.3; stage1b `[core-loop-map]` ("cleared-stage sequences unlock deterministic 3-of-8 trait offers") |
| Two-currency economy (Echo Core + Bound Fragment), earned/spent tracked | [SHIPPED] | UNIFIED-GDD §3.2/3.3; lobby-concept `presentation-spec.md` (currency-rail wires `echoCoreEarned−echoCoreSpent`, `boundFragmentEarned−boundFragmentSpent`) |
| Companion loadout cap = 3 (MAX_LOADOUT_SIZE), FRONT/BACK slots, DOWNED (run-scoped, no permadeath), back-row synergy | [SHIPPED] | UNIFIED-GDD §2.4/§4; stage1b `[core-loop-map]` (companions + boss/death rows) |
| Formation intent → deterministic companion position-rank at run creation (the "make saved formation real" slice) | [SHIPPED] | stage1b task-manifest ("Bind saved formation intent to deterministic position rank … complete") — note: `[core-loop-map]` §smallest-slice specified it as TARGET; the task-manifest then reports it built same run |
| 10-stage campaign, per-stage unlock, boss victory → next stage, Stage 10 = FINAL_COMPLETION + reward choice | [SHIPPED] | repo design doc; stage1b `[core-loop-map]` (boss/terminal + reward/return rows) |
| Persistent save (IndexedDB→localStorage→memory), JSON export/import, hash-wrapped validation, additive migration chain | [SHIPPED] | stage1b `[core-loop-map]` (persistent-save row) |
| **Undertow Encroachment** idle/offline settle (auto-derived wardLevel, 1 pressure/hr cap 8, ENCROACHED forfeits window progress, no new currency) | [SHIPPED] | UNIFIED-GDD §1.4; verified `campaign-state.js:217-247` (`wardLevel`, `wardlinePressure`, `settleIdleReturn` ENCROACHED branch) |
| Free-orbit camera (drag=orbit, pinch=zoom, world-space follow, eased/bounded, absent from digest) + stage palette / cel-shading direction | [SHIPPED] | solo-warden cycle-4 retro (orbit()/zoom()/applyStagePalette built+verified); stage1b `[core-loop-map]` (camera row) |
| `stage-world-catalog.js` authored world geometry (obstacles/surfaces/landmarks/props/lookouts), sim+presentation shared | [SHIPPED] | verified `stage-world-catalog.js:1-54` (523 lines) |
| Lobby → left/right idle-genre **side-dock shell** (replaced full-overlay #command-shell) | [SHIPPED] | lobby-dock-redesign cycle-1 retro (commit `f1fcb5d`, G4/G6 PASS) |
| Outgame lobby "war-room aperture" pass-1: currency pill rail, reward-forward briefing, stage-rail spine, idle-return payday count-up, CTA juice, palette discipline | [SHIPPED] | outgame-lobby-concept cycle-1 retro (commit `8ded372`, G4/G6 PASS) |
| Pressure/agency HUD readout (objective phase, pressure, growth, formation, extraction cues) — presentation-only snapshot reader | [SHIPPED] | stage1b task-manifest ("Render pressure and agency state from snapshots … complete; presentation-only, not human evidence") |
| Boss Rally Window (boss-spawn targeting override + cooldown cut), FRONT≥1 required | [SHIPPED-INERT] | UNIFIED-GDD §4.3; stage1b `[core-loop-map]` — `BOSS_RALLY_COOLDOWN_REDUCTION=0`, toast shows `0%`, numeric effect inert by signed policy |
| M4 committed-card decision (M4_CARD_DECISION) | [SHIPPED-INERT] | stage1b `[core-loop-map]` §classifications — sim + tests process it; **no app.js send**, player cannot choose; "sim/test-only, no shipped player UI" |
| M3_TARGET_PROBE | [SHIPPED-INERT] | stage1b `[core-loop-map]` — QA instrumentation only, no player control |
| **Formation Surge** (skill-reversal "일발역전" moment: charge 0-3, temp-buff current 3 on under-power boss/elite) | [DESIGNED-NOT-BUILT] | UNIFIED-GDD §7.2 — `label: TARGET — Stage2 QA 전까지 DRAFT` |
| Boss Rally **active cooldown benefit** (re-enable >0 reduction) | [DEFERRED] | reward-bands.md — `BOSS_RALLY_COOLDOWN_REDUCTION` frozen `0.0`, re-enable explicitly not authorized this cycle |
| Loadout cap expansion 3→4→5→6 (needs N-slot stance-offset math generalization) | [DEFERRED] | UNIFIED-GDD §2.4 + §12.7 — "Stage 2 이후 후속 안건" |
| Track A respec | [DEFERRED] | UNIFIED-GDD §12.5 — "미결정, 이번 사이클 범위 밖" |
| Bound Fragment re-earn / NG+ availability (currently only 1 boss-kill=1 campaign-lifetime) | [DEFERRED] | UNIFIED-GDD §12.6 |
| NG+ preset save (Stage 10 preset for NG+) | [DESIGNED-NOT-BUILT] | UNIFIED-GDD §8 pacing table Stage 10 ("프리셋 저장 — NG+용"); no NG+ loop specified as built |
| Cross-category power governance object (R1/R3/R5 unified 1.3×/1.6× ceilings, single balance-sheet source) | [DESIGNED-NOT-BUILT] | UNIFIED-GDD §9.1 — `label: TARGET — Stage2 QA 전까지 DRAFT`; enforcement point still unresolved |
| Run↔session unit conversion ratio (for playstyle-parity R5) | [DESIGNED-NOT-BUILT] | UNIFIED-GDD §7.3, §12.4 — "미해결(Stage 2 필수)" |
| Enemy world-space nameplates (CSS prepared, no application point) | [DESIGNED-NOT-BUILT] | solo-warden cycle-4 retro §미해결 5 — "CSS 준비돼 있으나 적용 지점 없음" |
| Shop/economy + progression-map dock interiors (growth/inventory/stronghold interiors as card-theater / shown-map) | [DEFERRED] | outgame-lobby-concept retro "next-cycle entry decision" — natural pass-2, not built |
| Scene re-tint/mesh-swap on stage-select, camera-coupled parallax, new blur surfaces, three.js scene inhabitants | [DEFERRED] | lobby-concept `presentation-spec.md` §Deferred (each returns only with a `recordFrameProbe`) |
| Gacha/summon reveal theater | [DEFERRED→SKIP] | lobby-concept spec §Deferred + reference-survey shortlist ("2/13, off-genre, SKIP") |
| Adaptive audio (Vibe-Survivors style), prestige-reset, daily-login, notification badges | [DEFERRED] | lobby-concept spec §Deferred; daily-login "adopt-with-caution, tie to play action not login streak" |
| Monetization "double-it" / any commerce surface | [DEFERRED] (permanently out of scope this product) | reward-bands.md / revenue-forecast.md — G5 N/A, boundary binding |

---

## 3. Open structural gaps, deferred items, unmet gates (with flagging run)

### Unmet quality gates (as of newest measured run, stage1b, `qa/gate-measurements.md` + cycle-2 retro)
- **G2 (balance) — FAIL/FIX/REDO.** All 5 archetypes miss the 9-11/20 win envelope; Cinder gate-minimum band 55–80% breached in 10-15/15 rows (post-retune 88-96.8%, "saturated clears"); SPLIT seed 403 defeats before boss TTK; required 20-paired-trial symmetric EV export + `maxEV/medianEV ≤1.30` **absent** (legal-combo EV measured **1.70**). *Flagged: stage1b cycle-2 retro §G2.*
- **G3 (player-type diversity) — FAIL/FIX/REDO.** TURRET now targetable (FRONT 1), but **0 companion downs across 100 VANGUARD+SPLIT runs** (no consequential risk); rally-then-TURRET has **0 post-switch companion damage in 50/50 conversions** (original exploit not proven fixed); dominance EV ceiling unproven. *Flagged: stage1b cycle-2 retro §G3.*
- **G6 (performance/ops) — FAIL.** Desktop frame p95 16.8ms (>16.7); midtier mobile p95 33.3ms, long-frame ratio 0.021 (>0.005); low mobile p95 50ms, ratio 0.193; soak heap slope 0.1138 MiB/min, `memoryStable=false`; rollback-runbook + release-readiness PASS provenance **absent**. *Flagged: stage1b cycle-2 retro §G6.* (Note: lobby-dock and lobby-concept passed **scoped UI-input** G6 — DOM/latency only — not the full sim perf budget.)
- **G7 (core loop + Elite Extract) — BLOCKED.** Scripted 9/9 reachability proven, but **0/10 human participants, 0/20 eligible decisions, 0/14 voluntary re-entries**; persistence traces/state-diffs for victory / defeat-after-accept / defeat-before-accept incomplete. Templates ≠ sessions. *Flagged: stage1b cycle-2 retro §G7 + core-loop.md.*
- **G8 (novelty) — BLOCKED.** Candidate = "pressure-bound elite extraction"; 5-title frequency table (need ≤2/5) unscored (0/5); human impression median (need ≥4.0/5) unscored (0/10). *Flagged: stage1b novelty-scorecard.md + cycle-2 retro §G8.*
- **G5 (monetization) — N/A, not PASS** (by design, no commerce). *Flagged: reward-bands.md / revenue-forecast.md.*
- **G4 (immersion) — PARTIAL / accessibility-only PASS.** Full immersion scoring (median ≥4.0/5 across scenes) never run — "표준 결핍 유지" since cycle 1; lobby runs passed only the accessibility *inputs* (touch/contrast/reduced-motion). *Flagged: solo-warden cycle-4 retro §G4; lobby gate reviews scope-note.*

### Balance-governance risks (UNIFIED-GDD §9 — all [TARGET]/DRAFT, unresolved)
- **R1** Warden permanent growth may neutralize run-skill choice tension — cap 20% of stage power, unverified.
- **R2** Formation combos may make companion diversity meaningless — role bonuses must diminish; ≥2 structurally different comps must clear same boss. *Solo-warden cycle-4 retro §미해결 1: R2 verification matrix NOT expanded — carried to Stage 2 balance-sheet.*
- **R3** item×trait×formation multiplicative chain exceeding G2 band — cross-category ceiling 1.3×; **exact enforcement point (derive-fn + fire-time full chain) unresolved** (§12.2).
- **R4** run/permanent boundary ambiguity → state bugs — mitigated by 2-path ownership (design says resolvable).
- **R5** two permanent axes compounding → parity collapse — cumulative power cap 1.6× by session 15; needs run↔session unit ratio (§12.4).

### Other explicitly-carried open items
- **TURRET ⇄ Boss Rally Window structural mutual-exclusion** — TURRET (FRONT 0) is excluded from both back-row synergy and Boss Rally; adopted as intended trade-off but flagged for post-sim re-review. *Solo-warden cycle-4 retro §미해결 2.*
- **PRED-08** (single-companion-main ≥ diversified comp ⇒ entire Kingshot axis becomes decorative) — top-severity, unverified. *UNIFIED-GDD §10.1.*
- **PRED-09** (free "meat-shield" companion exploit from no-permadeath DOWNED) — mitigation lever (Ward-tier integrity) present but not claimed resolved. *UNIFIED-GDD §4.4/§12.1.*
- **Formal G2/G3/G6 protocol never run on the camera+stance systems** — cycle-4 used only light 5-seed×2-stage measurement. *Solo-warden cycle-4 retro §미해결 3.*
- **Terrain GLB arbitrary-angle audit** incomplete (silhouette heuristic only; UV seam exposure unchecked). *Solo-warden cycle-4 retro §미해결 4.*
- **8 Stage-2 prerequisite items** (UNIFIED-GDD §12): DOWNED re-cost, R3 enforcement point, power-governance object, run/session ratio, Track A respec, Bound Fragment/NG+ availability, loadout 3→N, warm-palette contrast re-measure.
- **3 pre-existing unit-test failures** carried as tech debt across every 2026-07-27 run: `battle-session-cutscene-audio`, `world-presentation-contract`, `stage1b-evidence-exporters`. *Flagged: lobby-dock + lobby-concept retros.*
- **Deep-phase per-item JSON validation** (15-item coverage gate) not run for the outgame survey. *Flagged: lobby-concept retro §what-to-watch.*

---

## 4. Most recent "next public beat" / next-cycle entry decision (per run, newest→oldest)

- **lobby-dock-redesign (newest UI):** closed clean (G4/G6 PASS, 0 defects). **No re-entry required.** Next beat = **internal playtest re-verification of the shell layout before the next release cut**; a real human playtest against the new layout is the recommended next step before shipping to `main`/release branch. Future UI work re-enters at Stage-1d-equivalent.
- **outgame-lobby-concept:** closed clean (G4/G6 PASS). **No re-entry required.** Natural pass-2 = **shop/economy + progression-map dock interiors** (growth/inventory/stronghold interiors) at Stage-1 spec. Next beat = **an actual human playtest of the new lobby before the release cut.**
- **outgame-reference-survey:** research-only, complete + validated. Hands off to a **Stage-1 concept + presentation-spec pass** turning A1–A6 into a spec (which became the lobby-concept run). Awaited user approval before implementation.
- **stage1b-cinder-pressure-agency:** disposition **BLOCKED → returned to director review.** **Next public beat DEFERRED** — reconsideration requires a later evidence packet that clears failed G2/G3/G6 and replaces blocked G7/G8 templates with completed human evidence; rendered persistence alone cannot authorize a beat. No threshold changes proposed; another data-only retune prohibited until redesign reviewed.
- **solo-warden-rpg-concept (cycle-4, git-recovered):** recommended **Stage 2 retune entry** (not a Stage-1 concept re-pivot). Next beat = a build where formal G2/G3 archetype-rotation confirms 3-stance balance lands in the 45–55% band **and** formal G6 perf budget (p95 ≤16.7ms) confirms orbit-camera per-frame spherical math doesn't threaten the frame budget.

**Net trajectory:** the newest live work stream (2026-07-27) is **outgame/lobby presentation polish**, both cycles PASS and pointing at *human playtest before release cut* + a *shop/progression-map interior* pass-2. The **in-game balance/agency/novelty spine (stage1b) is BLOCKED and deferred** pending human G7/G8 evidence and G2/G3/G6 repair — the single largest cluster of unmet gates.
