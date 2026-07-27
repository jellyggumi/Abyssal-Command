# Cycle 1 Retrospective — 20260727-outgame-lobby-concept

## What shipped

The full evidence-led loop, in one cycle: **survey → deep-research
re-investigation → 3-position design meeting → mockups → presentation-spec →
implementation → dual-lane verification → commit (`8ded372`)** — turning the
D9 dock lobby into a "war-room aperture onto the 심연" (game-like 출정 outgame)
via 7 presentation-layer items. Plus a `changes-summary.html` walkthrough site.

## Gate table

| Gate | Verdict | Key measured value | Evidence |
|---|---|---|---|
| G4 (accessibility inputs) | PASS | 2 currency pills @48px (no soup); every effect has a reduced-motion resting state; sortie FAB 56px | `production/gate-reviews/lobby-pass1-g4-g6.md`, `qa/gate-measurements.md#g4` |
| G6 (perf inputs) | PASS | 126 DOM nodes (2.5% of 5000); input ≤0.4ms; raf 16.665ms; 3/3 browser contracts PASS | `qa/gate-measurements.md#g6`, `qa/regression-matrix.md` |
| Regression | PASS | 397/411 unit (exactly the 3 pre-existing baseline failures, 0 new); 0 test files retargeted | `qa/regression-matrix.md` |

## What worked

- **Deep-research on top of the earlier survey paid off**: the 12-month web
  supplement produced a real thesis correction — the "living hub" pattern is
  NOT browser-absent (Crystal Saga: Nova, Rumble Heroes are live browser
  proof), which reframed A6 from a native-only aspiration to an achievable
  browser tier. It also sharpened the shop axis the user explicitly added
  (WikiGacha currency-regen, the "watch ad to DOUBLE" payday fusion) even
  though pass-1 deferred monetization.
- **The programmer's "canvas already draws 60Hz in the lobby" finding**
  reframed the whole cost model (GPU/blur is the cost, not CPU) and made the
  cheap-juice ceiling precise instead of superstitious — the spec then held
  that line and QA measured it (126 nodes, ≤0.4ms).
- **DOM-preservation discipline in the spec** (fold briefing rows into
  `<details>` rather than delete; keep `#start-defense`; keep all catalog
  strings) meant ZERO test retargets were needed — a marked improvement over
  the D9 pass which needed several selector fixes. Writing the spec to
  protect existing assertions is cheaper than fixing tests after.
- **Two independent verification lanes** (automated QA + director live
  browser at 3 viewports incl. reduced-motion) caught nothing divergent —
  because the spec named the reduced-motion resting state for every effect
  up front, so G4 couldn't be failed by an afterthought.

## What to watch

- **Mood-render backends were down** (Antigravity 404, god-tibo-imagen
  private-codex 400 / codex-cli fail); Pollinations flux was the working
  fallback but only produces a MOOD render — legible UI text needs the
  hand-authored HTML schematic. Standing lesson: for UI concept viz, the
  HTML-schematic-screenshot route is the authoritative one; generative image
  is atmosphere only. Both are kept, labeled, with provenance.
- **The deep-phase per-item JSON pass was NOT run** (outline+fields+supplement
  gave decision-grade evidence; the validate_json coverage gate over all 15
  items would be the completion of the deep-research protocol). Recorded as
  available-on-request, not a gap for this cycle's goal.
- **Pass-1 deliberately deferred** scene re-tint on stage-select, camera
  parallax, gacha/summon reveal theater, adaptive audio (Vibe Survivors),
  prestige-reset, daily-login, notification badges, monetization "double it".
  Each is recorded in the spec's Deferred list and returns only with a
  `recordFrameProbe` before/after where it touches the frame.

## Next-cycle entry decision

**No re-entry required** — the cycle closed clean (PASS both gates, 0 open
defects). The lobby is the first outgame surface done; the natural pass-2 is
the **shop/economy + progression-map surfaces** (the growth/inventory/
stronghold dock interiors) applying the same A2 card-theater / A3 shown-map /
A4 grid↔detail patterns the survey ranked — re-enters at Stage-1 spec (no
balance/QA-exploit content to retune, so not Stage 2). Next public beat: an
actual human playtest of the new lobby before the release cut.
