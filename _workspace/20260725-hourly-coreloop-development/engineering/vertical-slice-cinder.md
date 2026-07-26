# Cinder Explicit-Bind Vertical Slice — 2026-07-25

## Scope

This Stage-2 slice makes the Cinder elite capture leg an explicit player action. The app projects the state machine; the simulation remains the extraction authority (`app.js:1439-1467`, `defense-run-simulation.js:894-931`). Browser evidence is recorded in `qa/explicit-bind-verification.md`.

## Three-state app control

1. **Bind available** — while an elite candidate exists but extraction is not ready and no route is active, the world prompt reads `Bind 대기 · <companion>` and the control is enabled as `Bind 시작` (`app.js:1446-1461`, `app.js:1611-1628`).
2. **Bind in progress** — the first click sets `bindStartPending`, immediately disables the control, changes its label to `Bind 진행 중`, and sends `EXTRACT_ELITE` with the candidate ID (`app.js:1613-1646`). The simulation rejects that pre-ready request as `EXTRACTION_HOLD_INCOMPLETE` and starts the objective route when the candidate matches (`defense-run-simulation.js:894-923`).
3. **Extraction ready** — after the extraction hold is complete and ready, the prompt reads `추출 가능 · <companion>` and the control is enabled as `정예 추출`; only a matching ready command can add the companion and advance the public extraction objective (`app.js:1448-1461`, `app.js:1611-1628`, `defense-run-simulation.js:897-911`).

## Existing simulation and race protection

The simulation is fixed-step 60 Hz (`docs/abyssal-command-defense-survivor-design.md:24-28`). The browser proof replaces wall-clock rAF timing with a queued synthetic clock: one `__pumpFrame(100)` invokes the loop once and advances exactly `100 ms` of game time (`tests/defense-survivor-browser.cjs:264-295, 330-352`).

`bindStartPending` is a UI latch, not a second rules authority: it suppresses a second start click until the simulation exposes a route or ready state (`app.js:1613-1617, 1636-1645`). Simulation-side guards require an unextracted, matching, unexpired candidate and ready hold before mutation (`defense-run-simulation.js:894-915`). The contract test confirms a same-tick duplicate is FIFO-rejected after one extraction, and an input queued after terminal defeat cannot mutate progress (`tests/defense-run-simulation.test.mjs:292-333, 336-390`).

## Non-goals

- No mobile/portrait verdict: the fresh browser proof is `844×390` desktop landscape (`qa/explicit-bind-verification.md`).
- No resolution of the broader G7 loop-duration issue; overall G7 remains **FIX** (`qa/explicit-bind-verification.md`).
- No G2/G3 balance, G4 visual-quality, G5 reward, or G6 performance claim (`qa/explicit-bind-verification.md`).
- No change to simulation cadence, campaign persistence, boss progression policy, or unrelated controls; the cited app and simulation paths define the slice boundary.
