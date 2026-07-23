# Cycle 1 retrospective — defense-survival expansion

**Operating mode:** Stage 1 implementation and evidence recovery for the existing 10-stage offline defense-survivor build.

## Delivered
- Added `defense-cutscene.js`, a renderer-neutral observer that normalizes authored simulation cutscene events without changing run or campaign state.
- Added a non-blocking, skippable stage-entry cutscene overlay in `app.js`; it is removed on dismissal, after eight seconds, and when a battle session stops.
- Added presentation styling with a reduced-motion-safe static treatment.
- Added unit coverage and extended the Playwright browser journey to verify stage-entry presentation, dismissal, cleared state, keyboard movement, and touch movement.
- Filed the QA subagent review at `messages/20260722-qa-cutscene-review.md`.

## Gate review

| gate | measured state | verdict | evidence |
|---|---|---|---|
| G1 | No full W-01…W-05 trace audit. | FAIL | `qa/gate-measurements.md` |
| G2 | 32 automated tests passed; TTK/matchup/combo bands remain unmeasured. | FIX | test receipt; `qa/gate-measurements.md` |
| G3 | No five-archetype sessions. | FAIL | `qa/test-plan.md` |
| G4 | Stage-entry overlay browser check passed; no five-scene panel or latency probes. | FIX | `tests/defense-survivor-browser.cjs`; `qa/gate-measurements.md` |
| G5 | No paid systems; simulator fairness evidence absent. | FIX | `pm/reward-bands.md` |
| G6 | Browser journey and short responsiveness probes passed; no 30-minute soak or production p95. | FIX | `qa/gate-measurements.md` |
| G7 | Repeat-rate observation absent. | FIX | `design/core-loop.md` |
| G8 | Comparable surveys and impression panel absent. | FAIL | `design/novelty-scorecard.md` |

## Verification receipt

`node --test tests/defense-cutscene.test.mjs tests/defense-run-simulation.test.mjs tests/defense-campaign-adapter.test.mjs tests/defense-renderer-contract.test.mjs tests/defense-asset-manifest.test.mjs tests/no-rts-closure.test.mjs tests/release-closure.test.mjs` passed: 32 tests, 0 failures.

`node tests/defense-survivor-browser.cjs` passed: the stage cutscene accepted movement while visible, was dismissed with its focused keyboard control, then admitted keyboard and touch movement plus a growth selection with no page or console errors.

## Next-cycle entry

**Enter Stage 1 FIX, not release.** Complete the player-visible lore trace, five-scene reduced-motion/readability panel, and a 30-minute browser memory/frame/input soak before considering Stage 2 retuning. Do not mark any gate PASS from this automated cutscene evidence alone.
