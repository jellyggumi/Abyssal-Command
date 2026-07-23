# Cycle 1 Retrospective — Solo Warden RPG Concept

run-id: `20260723-solo-warden-rpg-concept` · director: game-production-director (acting all specialist roles this cycle — see task-manifest.md scope note)

## Gate table (measured values, this cycle)

| Gate | Stage | Verdict | Key measured value | Evidence |
|---|---|---|---|---|
| G7 draft | 1 | PASS | Core loop modeled + implemented, live-fire event confirmation | `qa/gate-measurements.md#g7` |
| G1 draft | 1 | PASS | 0 non-canonical proper nouns across 5 new terms | `qa/gate-measurements.md#g1` |
| G6-ops draft | 1 | PASS (FIX closed same-cycle) | Telemetry schema v1→v2, 5 new event types wired | `production/gate-reviews/stage1-review.md` |
| G2 | 2 | FIX | Max cross-archetype efficiency spread 1.166× (within 1.3× cap); win-rate band is a genre mismatch requiring designer override, not a measurement gap | `qa/gate-measurements.md#g2` |
| G3 | 2 | PASS | 7/7 archetypes tested, no dominance, PRED-08 confirmed (single-companion-main measurably worst) | `qa/gate-measurements.md#g3` |
| G5 | 2 | N/A | No monetization exists in this project | `qa/gate-measurements.md#g5` |
| G7 final | 2 | FIX | Loop confirmed with live-fire evidence; repeat-rate proxy requires human playtest | `qa/gate-measurements.md#g7` |
| G8 | 2 | PENDING | Not attempted — designer novelty-scorecard work, out of this implementation cycle's scope | `qa/gate-measurements.md#g8` |
| G4 | 3 | FIX | Accessibility (48dp/grayscale/reduced-motion) MET with real evidence; immersion score requires human playtest | `qa/gate-measurements.md#g4` |
| G6 final | 3 | FIX | Perf (16.6-16.7ms, +6.9% heap over 20k ticks) and telemetry MET; ops-runbook docs don't exist as artifacts | `qa/gate-measurements.md#g6` |
| G1 final | 3 | PASS | 0 new narrative content since Stage1 draft | `qa/gate-measurements.md#g1-final` |

Supplementary (R1/R3/R5 power governance, load-bearing for G2/G3): R3 PASS, R1 partial (isolated stress-test only), R5 unreachable-by-construction within this campaign's 10-stage/no-NG+ scope.

## What shipped

A full Stage1 RPG layer for the Solo Warden concept: Warden stats/skill-tree/traits, 5-tier equipment with color-independent icon encoding, FRONT/BACK formation with Boss Rally Window and DOWNED-state mechanics, Echo Core/Bound Fragment dual economy, idle Undertow Encroachment (a designed extension closing a gap the user caught — "킹샷의 디펜스 요소가 어떻게 들어간건지"), and a minimal but fully accessible growth-panel UI. 57/57 new-code tests pass, 165/165 full-suite tests pass. Real archetype-rotation simulation (7 archetypes × 3 seeds × 10 stages, actual gameplay not estimates) backs every balance claim.

## What went wrong this cycle (the actual lesson, not a euphemism)

**I broke production twice in the commit phase**, both from the same root cause: this repo has multiple concurrent agent workstreams sharing one working tree, and my two large-file commits (`app.js`, `styles.css`, `defense-run-simulation.js`) swept in uncommitted foreign work alongside my own changes. I caught and fixed the `app.js` case *before* pushing (a hunk-count heuristic check saved me), but I missed the same pattern in `styles.css` and `defense-run-simulation.js` because I only checked hunk *count*, not hunk *content*, for those two files — and pushed both. The first broke `app.js` at runtime (undefined imports, ReferenceError on every lobby render); the second broke a passing test (`stageCutscene` fallback logic) and silently inert-ed the formation-targeting mechanic (a function existed but was never called — no error, just dead code).

Three fix-forward commits later (never amend/force-push on a public shared `main` — fix forward, always), the actual RPG-layer deliverable is intact and verified, but the cycle cost real time and, more importantly, real trust: my own commit message on `233a9d0` claimed "165/165 full project suite pass" as verification evidence, and that claim was true for the *test suite* but blind to the *runtime* — no test in this repo imports `app.js` directly (it's a browser entry point), so a completely broken production app shipped past a 100%-green test run. **A passing test suite is not the same claim as "the browser loads it."**

## Root cause, precisely

1. **Shared working tree across concurrent agents is a genuine hazard**, not a hypothetical one — 16 sibling subagents plus at least one other independent workstream (asset-pipeline/theme/HUD-agent) were all writing to the same files in the same session.
2. **`git diff` hunk *count* is not evidence of hunk *content*.** A single contiguous hunk can (and did, twice) contain a mix of my work and someone else's, especially when both parties touch nearby lines.
3. **`node --test` coverage has a blind spot this repo doesn't paper over**: no test imports the browser entry point (`app.js`), so import-level breakage is invisible to the exact verification command this project's own CI (`engine_contract`) runs.

## What actually caught it (and what should catch it next time by default)

A real browser page-load smoke test — not `node --check` (syntax only, blind to undefined references), not the existing test suite (doesn't import `app.js`) — caught the first break. A byte-level `diff` against the last-known-good committed tree (not a hunk-count skim) caught the second and third. **Going forward on this repo specifically**: before any commit touching a file another concurrent workstream might also be editing, do a full byte-level `diff` against the last commit *for that specific file*, not a spot-check of the diff summary; and run an actual headless-browser page load (not just `node --check`) before pushing anything that touches `app.js`, `styles.css`, or any file the browser loads directly.

## Unresolved risks carried forward (real, not hidden)

- **G2 win-rate band mismatch**: needs a director/designer decision to formally override `win_rate_band` for this PvE genre in `balance-sheet.md#band-overrides` — a design decision, not a measurement I can close by testing harder.
- **G7/G4 human-dependent measures** (repeat-rate proxy, immersion score): genuinely require a human playtest round or a defensible scripted proxy; not fabricable from simulation/browser-automation tooling.
- **G8 novelty scoring**: entirely unstarted — designer work against existing `design/trend-survey/` data, out of this implementation cycle.
- **`engine_contract` CI gate**: blocked by 2 pre-existing reward-selection test failures (confirmed present at `b0a0c57`, before this cycle), with an in-progress fix visible in the shared working tree from another workstream — not mine to absorb, documented in `production/task-manifest.md` for whoever owns that fix to land it.
- **PRED-09 (companions-wardpact exploit)**: mitigation mechanism confirmed functional (T1 vs T5 ward survival difference is real and large), but whether a burst-damage strategy still dominates ward investment across a full campaign remains unmeasured.

## Next-cycle entry decision: **Stage 2 retune**, not Stage 1 concept shift

The concept, worldview, and core systems are sound and shipped with real evidence — nothing here calls for revisiting the fundamental design. The next cycle should re-enter at Stage 2 to: (1) get the director/designer win-rate-band override decision recorded, (2) run a human playtest round to close the G4/G7 human-dependent measures, (3) have the designer complete G8 novelty scoring against the existing survey data. None of this requires new implementation work — it's measurement and decision-making against what already shipped.
