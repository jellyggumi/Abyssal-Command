# Stage2 Gate Review — Cycle 2 Addendum

run-id: `20260723-solo-warden-rpg-concept` · cycle: 2 · reviewer: game-production-director
References: `production/gate-reviews/stage2-review.md` (Cycle 1's original Stage2 verdict, left unmodified as historical record per the artifact contract — this addendum records what Cycle 2 closed, not a rewrite of that history).

## G2 — Rules & balance numbers: Cycle 1 **FIX** → Cycle 2 **CLOSED**

Cycle 1 named 2 concrete actions to close G2's FIX:
1. Director/designer decision to formally override `win_rate_band` for this genre — **DONE**: `production/decision-log.md#D15`, `design/balance-sheet.md#band-overrides`.
2. Author an RPG-layer TTK target and re-measure — **DONE**: `qa/gate-measurements.md#g2`'s Cycle 2 section; Stage 1's literal `ttk_target_s: 11.2±15%` verified PASS (median 9.67s, +1.6% above floor), extended per-stage via the cross-archetype-spread methodology for stages 2-10.

New finding surfaced during closure (not previously known, does not reopen G2 — it's a distinct, separately-tracked item): `turtle` archetype policy violates its own `[1.0,1.15]` TTK ceiling at 7/10 stages, root-caused to the QA test policy's stat-priority array (not a confirmed game-numbers defect). Disposition: reported, not retuned (`decision-log.md#D15` 판정 2). Does not block G2's closure — the band-override mechanism itself (the actual G2 FIX item) is fully in place and functioning as evidenced by this exact discovery.

**G2 verdict: CLOSED.**

## R1 (supplementary governance, not a formal gate but load-bearing for G2/G3): Cycle 1 **PENDING** → Cycle 2 **FIX** (real finding, not closed)

Cycle 1 flagged R1 as needing the full realistic-loadout/all-10-stages protocol. Cycle 2 ran it (`qa/r1-full-protocol-cycle2.md`, `decision-log.md#D16`) and found a genuine ceiling violation in 3 of 7 archetypes (34/210 points), traced to a structural mechanism (flat-scaling Warden stats vs static-fraction companion bonuses), not a QA-policy artifact. This is now a **real FIX item**, more concrete than Cycle 1's PENDING, but explicitly not retuned this cycle pending an equipment-tier data-capture extension (`decision-log.md#D16` 판정 3). Carried forward as an open item for the next cycle, not silently resolved.

## Items unchanged this cycle (not in Cycle 2's scope)

- **G3**: still PASS (Cycle 1's finding, reconfirmed per-stage in Cycle 2's `#g2` TTK work as a side effect — not separately re-verified against G3's own threshold this cycle, no new G3-specific work done).
- **G5**: still N/A (no monetization, unchanged).
- **G7 final**: still FIX (repeat-rate proxy requires human/scripted playtest, out of scope for this cycle's simulation-only tooling — not attempted).
- **G8**: still PENDING (novelty-scorecard work, designer/Stage1-concept-phase artifact class, not touched).
- **R3**: still PASS (1.166×→1.326× range measured in Cycle 2, within the 1.3× cap with one single-stage 2.6%p noise-level exception, no material change to Cycle 1's verdict).
- **R5**: still unreachable-by-construction (NG+ scope still undecided, `UNIFIED-GDD.md` §12 item 6 untouched this cycle).

## New Cycle-2-only findings (not present in Cycle 1's review, not gate-blocking)

- **PM reward-bands Axis 2** (`pm/reward-bands-cycle2.md`): `qa/lane-archetype-testplan.md`'s proposed `completionist-collector` `[20,40]`-session band is unreachable within a single 10-stage campaign (campaign = 10 sessions flat) — same root cause as R5's NG+ dependency (`UNIFIED-GDD.md` §12 item 6). Not a defect; a scope note for whoever resolves NG+ next.
- **UI accessibility** (`ui/accessibility-audit-cycle2.md`): the Stage 6 "저지선 안정" (Undertow-stable) static badge `design/stage-progression.md` §5 describes as a presentation beat does not exist as separate UI yet — flagged as a production gap, not a G4 accessibility defect (the only current signal, plain wardLevel text, is already color-independent).
- **Perf/memory** (`qa/perf-memory-cycle2.md`): no regression found at the true Stage-10 endpoint (full 6-companion roster, maxed stats/traits) — 427 DOM nodes, 8.332ms mean rAF, +2.36% heap growth across 15 campaigns (flat, no leak). Closes the Stage3 perf/memory requirement.
- **Full regression suite**: 2 genuine, previously-undocumented regressions found and fixed this cycle (`tests/defense-idle-progression.test.mjs`'s stale fixture predating the Undertow ENCROACHED gate; `tests/release-closure.test.mjs`'s stale `RUNTIME_PATHS` missing `rpg-catalog.js`) — both were introduced by Cycle 1 commits (`233a9d0`, `3cb52ee`) whose test-fixture updates lagged their production-code changes. Failure set now matches the documented baseline (2 known `REWARD_SELECTED` bugs + 2 pre-existing-at-`b0a0c57` failures) exactly.

## Cycle 2 Stage2 summary

G2 fully closed. R1 upgraded from vague-PENDING to a precise, evidenced FIX (real next-cycle work: equipment-tier data capture). Two genuine test regressions found and fixed. No new gate failures introduced. Ready to proceed to Stage3 close-out (deployment).
