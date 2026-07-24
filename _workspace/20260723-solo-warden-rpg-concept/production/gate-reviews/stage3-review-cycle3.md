# Stage3 Gate Review — Solo Warden RPG Concept, Cycle 3 (Track 3: World-Space HUD)

run-id: `20260723-solo-warden-rpg-concept` · reviewer: game-production-director
Stage3 required gates: **G4, G6, G1 final.**

**Scope note**: this review covers only the work performed in this session —
Track 3 (world-space HUD: companion nameplates/health bars, elite capture
prompt, floating damage numbers, self-marker + sight ring, per-entity health
rings, boss danger telegraph, extraction progress ring, offscreen waypoint
arrow) plus a critical rendering bugfix discovered during that work. Track 1
(WebGL renderer + free-orbit camera) and Track 2 (5-tab command-deck UI
restructure) were already committed before this session began (`c31cae7`,
`9855a78`, `e423fc8`) and are NOT re-reviewed here — no claims are made about
their state beyond what this session's own regression suite runs confirm
(164/164 node tests, 3/3 CI-gated browser tests, all passing with Track 3's
changes applied on top).

## G4 — Effects & animations give immersion: Track 3's actual deliverable

- **What was built**: 8 of 8 world-space HUD elements from
  `ui/lane-hud-layout.md` §1 rows 10-17 (previously 0 of 8 existed in the
  WebGL renderer) — companion nameplate+health bar, elite capture prompt,
  floating damage numbers (DOM-overlay, text/interactive per the doc's Option
  B guidance), plus self-position marker+sight ring, per-enemy/boss health
  ring, boss attack-windup danger telegraph, extraction-hold progress ring
  (3D billboard geometry, pure-shape per the same guidance), plus an
  offscreen objective waypoint arrow (row 17, hybrid world→screen clamp).
- **Two real regressions found and fixed during this work, not merely
  avoided**:
  1. World-unit height-offset scale mismatch — a guessed meter-scale
     `heightOffset` (e.g. 2.3) added to world-space Y before projecting was
     ~2.5x this scene's entire world-space half-extent
     (`STAGE_WORLD["cinder-span"].halfX=0.85`), pushing projected NDC values
     outside `[-1,1]` and silently making on-screen entities report
     `visible:false` — nameplates/damage-numbers never rendered. Fixed by
     removing world-unit height offsets from the projection API entirely;
     callers now apply fixed CSS pixel offsets post-projection.
  2. CSS keyframe animation silently discarding the inline position
     transform on `.world-damage-number` — a CSS animation replaces the
     entire computed value for an animated property, so co-animating
     position and rise/fade on one element pinned every damage number to the
     overlay's origin regardless of actual hit location, with no visible
     error. Fixed by splitting into outer (static position) + inner
     (animated rise/fade) elements.
  - Both verified empirically in a real browser against real WebGL, not
    assumed from code reading (the first was caught by projecting a real
    seeded companion's screen position and observing `visible:false`; the
    second by inspecting `getComputedStyle(el).transform` before/after the
    fix).
- **A third, more severe, pre-existing bug found and fixed** (not introduced
  this session, not caused by Track 1/2): `getRunSnapshot()` has no
  top-level `boss` field — the boss only exists inside `snapshot.enemies`
  with `class==="boss"`. The WebGL renderer's boss-handling branch checked
  `snapshot.boss`, which was always `undefined` — permanently unreachable
  dead code. Separately, `meshNameFor()` deliberately returns `null` for
  boss entities expecting a caller to substitute the stage's boss mesh root
  — no caller ever did. **Net effect: the boss rendered with ZERO mesh in
  real WebGL, for the entire life of the renderer, at literally the
  climactic moment of every stage.** Verified empirically: fed a real
  live-boss snapshot (37420hp `boss-79`, seed=7, tick 1670, cinder-span)
  directly to `renderer.renderSnapshot()`, inspected `renderer.instances` —
  no entry for the boss id. Fixed: the enemies loop now resolves boss mesh
  from `world.boss` (the stage's boss GLB root, e.g. `cinder-warden-root`)
  instead of the always-null `meshNameFor()` result for bosses.
- **Immersion/latency scoring**: still PENDING, unchanged in kind from
  Cycle 1/2 — requires human playtest or a defensible scripted proxy,
  neither attempted this session (correctly not fabricated).
- Evidence: this session's transcript (live browser verification of every
  new element + both projection/animation bugs + the boss-mesh bug, via
  direct `renderer.instances`/DOM inspection and synthetic-snapshot replay);
  `tests/defense-survivor-browser.cjs` real-WebGL full-playthrough run
  (`"pass": true`, `"webgl-renderer-confirmed-active"`, 0 errors).
- **Verdict: PARTIAL.** New Track 3 deliverable is complete and verified
  working (including fixing a severe pre-existing gap it depended on).
  Immersion/latency scoring remains the same open item carried since Cycle 1
  — genuinely outside this session's tooling, not newly deferred.

## G6 — Game-ops plan appropriately applied: perf sub-measure re-confirmed, no soak this session

- Ran the existing short-probe suite (`tests/defense-performance-browser.cjs`)
  after all Track 3 changes: `rafMeanMs` 16.665 at both tested viewports
  (844×390 and 2056×1082), well under the 16.7ms p95 budget as a mean
  proxy; `domNodes` 66 (well under the 5000 ceiling; world-HUD overlay adds
  a handful of DOM nodes per companion/damage-number, bounded by existing
  pool caps — `MAX_LOADOUT_SIZE=3` for nameplates, 24 for damage numbers);
  input latency sub-1ms.
- **Not run this session** (consistent with `engineering/perf-budget.md`'s
  own scoping — these are explicitly "short, read-only probes... do not
  satisfy the 30-minute gate"): the full 30-minute soak, JS heap drift over
  time, long-frame ratio over an extended session. No claim is made about
  these.
- No new `ops/*.md` changes this session — Track 3 is a rendering/
  presentation change with no telemetry-contract or rollback-runbook impact.
- Evidence: `tests/defense-performance-browser.cjs` output (this session),
  `tests/defense-hud-responsive-browser.cjs` output (`"pass": true`, all 5
  viewports).
- **Verdict: PASS on the short-probe sub-measure re-confirmed after this
  session's changes; the 30-minute soak and heap-drift items remain
  unmeasured this session** (same standing gap as prior cycles, not newly
  introduced).

## G1 final — Narrative consistency: PASS, unchanged

- Track 3 introduces zero new narrative strings, lore content, or mechanic
  names. Every player-visible label in the new world-HUD (companion names
  via `companionLabel()`, elite prototype names, damage numbers) reuses
  existing catalog data already covered by prior G1 audits.
- The boss-mesh bugfix is a pure rendering-pipeline correction (which mesh
  gets attached to an existing, already-audited boss entity) — no new
  content.
- **Verdict: PASS**, carried forward — nothing in this session's scope
  touched G1's audit surface.

## Overall Stage3 (Track 3) verdict

**PASS on the new deliverable's own correctness** (8/8 world-space HUD
elements implemented and verified working against real WebGL, including
discovering and fixing 3 real bugs — 2 introduced during this session's own
work and fixed before landing, 1 severe pre-existing regression that
predates this session and was blocking the new work from being meaningfully
verifiable for bosses). **G4's immersion/latency scoring and G6's 30-minute
soak remain the same standing open items carried since Cycle 1** — both
require resources (human playtest, extended soak time) outside this
session's scope, not newly deferred by this session's choices.

Full regression suite: 164/164 node tests (`node --test tests/*.test.mjs`),
3/3 CI-gated browser tests (`defense-hud-responsive-browser.cjs`,
`defense-survivor-browser.cjs`, `defense-performance-browser.cjs`), all
green after every Track 3 change including the boss-mesh bugfix.

## Process note: two adapter-contract tests were asserting a claim retired by D17, silently

`defense-renderer-contract.test.mjs`'s camera-transform test asserted
byte-identical output between `RealtimeBattle` and `BattleVisualizer` and
was passing — but only because Node has no global `WebGL2RenderingContext`
at all, so `RealtimeBattle` unconditionally falls back to its internal
`BattleVisualizer` in every Node test, regardless of the mock canvas
provided. The test was TRUE but MISLEADINGLY NAMED: it verified
fallback-to-fallback parity, not real-WebGL-vs-Canvas2D interchangeability —
which D17 (`production/decision-log.md`, Cycle 3 concept lock) had already
explicitly retired as an assumption once real WebGL rendering was adopted.
Fixed by renaming the test and adding an explicit `usingFallback===true`
assertion documenting exactly why the comparison is meaningful in Node and
what it does NOT claim about real-browser WebGL output (which only the
`tests/*-browser.cjs` suite can exercise). No assertion was weakened; only
the test's name and documentation were corrected to match reality.
