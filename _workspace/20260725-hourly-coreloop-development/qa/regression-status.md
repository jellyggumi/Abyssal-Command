# Regression Status — 2026-07-25

## Carry-forward full-suite evidence

```text
node --test 'tests/**/*.test.mjs'
result: 251 tests · 250 pass · 0 fail · 1 skipped · exit 0 · 70.9 s
```

This result is **carry-forward evidence** from an earlier 2026-07-25 run. It
predates the app/browser-only UI patch, so it is not a fresh full-suite verdict
for that patch.

## Fresh browser evidence

```text
node tests/defense-survivor-browser.cjs --allow-missing-browser
result: exit 0
```

At desktop-landscape `844×390`, the browser run observed `Bind 대기 · Ember
Cohort` with an enabled CTA, exactly one Bind start, `추출 가능 · Ember Cohort`
at pump `252` / `25.2 s` simulated game time, an enabled ready CTA, no
page/console errors, and the Cinder boss model at `bosses/cinder-warden.glb`
with root `Scene` and `2` mesh descendants. The exact browser record and source
paths are in `qa/explicit-bind-verification.md`.

## Gate disposition

- **G7/G8 explicit player-confirmation subrequirement: evidenced** by the fresh
  browser command above.
- **G7 overall: FIX.** The existing broader loop-duration issue is unresolved;
  this partial evidence is not a project-wide G7 pass.
- **G2/G3/G4/G5/G6: untouched.** The browser command is desktop landscape only
  and is not a mobile visual-regression verdict.
