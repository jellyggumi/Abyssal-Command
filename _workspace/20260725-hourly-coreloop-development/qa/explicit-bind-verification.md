# Explicit Bind Verification — 2026-07-25

## Command and observed result

```text
node tests/defense-survivor-browser.cjs --allow-missing-browser
exit 0
```

The fresh browser run used the `844×390` desktop-landscape viewport configured in `tests/defense-survivor-browser.cjs:253-255`. Its world-HUD drive observed:

- `Bind 대기 · Ember Cohort` with `#extract-elite` enabled (`disabled: false`, `aria-disabled: "false"`).
- Exactly one Bind start before readiness.
- `추출 가능 · Ember Cohort` at pump `252` (`25.2 s` simulated game time, because each pump is `100 ms`; `tests/defense-survivor-browser.cjs:345, 409`).
- The ready CTA remained enabled (`disabled: false`, `aria-disabled: "false"`).
- No page or console errors (`tests/defense-survivor-browser.cjs:256-258, 452`).

The same command's boss check observed model path `bosses/cinder-warden.glb`, scene root `Scene`, and `2` mesh descendants through the renderer actor inspection (`tests/defense-survivor-browser.cjs:539-584`).

## What this exercises

The browser test starts the live app, pumps its request-animation-frame queue with a synthetic `100 ms` clock, dismisses the entry cutscene, chooses growth offers, clicks the enabled Bind control once, and waits for the ready prompt (`tests/defense-survivor-browser.cjs:260-410`). The fixed-pump protocol advances simulation game time independently of slow software-WebGL wall-clock frames (`tests/defense-survivor-browser.cjs:264-275, 330-350`).

## Gate interpretation and limits

- **G7/G8 explicit player-confirmation subrequirement: evidenced.** The command above covers the visible pre-Bind state, one player activation, and the visible ready state.
- **G7 overall: FIX, not PASS.** The broader loop-duration issue remains unresolved; this record does not re-measure it.
- **G2/G3/G4/G5/G6: untouched.** The command supplies no balance, readability, reward, or performance verdict.
- **Mobile: not measured.** `844×390` is desktop landscape; this is not a portrait/mobile visual-regression verdict.
- **Full-suite freshness: not established here.** This is browser evidence only; carry-forward suite status is recorded in `qa/regression-status.md`.

## Sources

- Live control and prompt projection: `app.js:1439-1467`, `app.js:1610-1646`.
- Simulation extraction authority: `defense-run-simulation.js:894-931`.
- Browser assertions and boss scene-graph inspection: `tests/defense-survivor-browser.cjs:238-605`.
