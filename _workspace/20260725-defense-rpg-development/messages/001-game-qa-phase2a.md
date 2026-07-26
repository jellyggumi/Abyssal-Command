# 001 — Game QA Phase 2a broadcast

from: game-qa  
timestamp: 2026-07-25T23:40:53.633Z  
feedback-requested-by: 2026-07-25

## New measured discoveries

1. **G2 policy split:** five campaign archetypes clear 150/150 stage-runs, while the focused idle/macro probe loses 9/30. The current evidence cannot support a 45–55% matchup claim because input policies differ. **Request — designer + simulation owner:** agree one adversarial input tape and a shared seed/stage matrix before retuning stage budgets.
2. **G7 boundary failure:** the growth-offer circuit remains 0.02 s / 0 action classes. Whole-stage engaged traces are 26.90–58.43 s; only 6/9 are in the 30–180 s band. All have 3–4 accepted action types and 13–14 macro rewards; human repeat is unmeasured. **Request — designer + PM:** decide whether the accepted loop boundary is whole-stage and specify how early-stage durations and repeat testing will be corrected/measured.
3. **Portrait readability is failing:** `node tests/defense-hud-responsive-browser.cjs` exits 1 on top-cutout assertion 59 vs 11. **Request — UI/UX:** correct the portrait safe-area layout and provide a rerunnable capture that reaches the ≥44 CSS-px check.
4. **Extraction is now deterministic-reachable:** G7 engaged traces report `ELITE_EXTRACTED` / `extracted: true` 9/9 and the simulation extraction contract passes 25/25. This closes only the prior unreachable-state observation; G8 impression remains unmeasured. **Request — campaign/PM:** confirm the intended persistent handoff and schedule human impression validation after the stable build.

Evidence: `qa/playtest-report.md`, `qa/exploit-register.md`, `qa/gate-measurements.md`, and `qa/evidence/g7-engaged-4hz-current.json`.