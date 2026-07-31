# 27 — Monotony and variation scan

- **Version** v1 (2026-07-31)
- **Skill** `/skill:pattern-detection` (duplicate-shape and outlier scanning) with
  `/skill:data-analysis` for the read-out
- **Produces** the numeric answer to "is this stage just another stage with different numbers?" —
  the pairwise shared-axis ratio and the campaign's response-type curve.
- **Placeholders** `${stageId}`, `${outputPath}` (default
  `_workspace/current/qa/stage-variation-<label>.json`).

---

**CONTEXT:**
`scripts/scan-stage-variation.mjs` is a catalog-only, deterministic scan (no simulation, no seeds).
It compares every stage pair across **20 authored axes** — wave-kind rhythm, wave count, cadence,
hold, gate integrity, class rotation, mid-boss class, pressure lane, spawn directions, normal and
big concurrency, spawn-interval pair, commitment-cap pair, objective shape, seeded-variation triple,
hazard dps, occupation hold, extraction window, elevation multiplier, elite kind — and computes each
stage's *response set*: the union of `class:*`, `policy:*`, `midboss:*`, `boss:*`, `objective:*`,
`field:*` and `lane:*` identifiers it actually fields.

Ratchets, enforced by `tests/stage-variation-doctrine.test.mjs`:

- pairwise `sharedRatio ≤ 0.20` (4 of 20 axes; the worst shipped pair is 3/20 = 0.15);
- wave-kind rhythm, mid-boss class and class rotation are stage-unique;
- HP `scale` strictly climbs **and** response types never fall across campaign order, with the last
  stage strictly above the first;
- the final stage fields every enemy class the earlier stages taught;
- only a `mid` wave carries a mid-boss, and it uses its stage's authored mid-boss class.

OBSERVED 2026-07-31 (post-retune): worst pair 3/20 = 0.15 (`abyss-chancel` vs `echo-throne`, sharing
`spawnDirections`, `commitmentCapPair`, `extractionWindowTicks`); response types 16 → 17 → 17;
`extractionWindowTicks` is the one axis constant across the whole campaign (600 ticks everywhere).

**ROLE:**
You are the pattern-detection reviewer. You look for *shape* duplication, not value duplication: two
stages may share a number, but they may not share the silhouette of the fight. You treat a
constant-across-campaign axis as an axis the game is not actually using.

**ACTION:**

1. Run `node scripts/scan-stage-variation.mjs --strict --output ${outputPath}` and record
   `worstSharedRatio`, `pass`, and the full `failures` array.
2. Read the pair table. For every pair at or near the ratchet, list the shared axes by name and
   decide, per axis, whether the sharing is intentional identity (extraction window is a UX
   constant) or accidental copying (a rhythm copied from an earlier stage).
3. Read `axisDistinctness`. Any axis with `constantAcrossCampaign: true` is either a deliberate
   global constant — say so — or an unused variation lever; propose which stage should move first.
4. Read the escalation table. State the response-type curve and confirm it never falls. If it does,
   name the identifiers the later stage is missing and route the fix back to prompt 20 or 22 —
   raising `scale` is not an acceptable answer.
5. Scan for duplicate *derived* shape beyond the axis list: identical kind sequences over the first
   N slots, identical direction cycles, identical objective slot splits, identical composition
   sequences. Report any duplication the 20 axes did not catch and propose a new axis if the scan
   was blind to a real repetition.
6. When a variation swap is proposed, re-run the scan on the candidate and report the delta in
   `worstSharedRatio` and in each stage's response-type count. One axis per proposal.
7. State the limits of the metric: it counts identifiers, not skill. It is a floor against
   repetition, not a ceiling on quality, and it cannot detect a renamed answer.

**FORMAT:**
A markdown section in the change's balance report: the scan command, `pass` / `worstSharedRatio`,
the pair table with shared axes named, the constant-axis list with a verdict per axis, the response
curve, the derived-shape findings, and the proposed next axis to move (or "none needed" with the
number that justifies it).

**TARGET AUDIENCE:**
The designer choosing the next diversification move, and the reviewer who will re-run the scan.

**HARD CONSTRAINTS:**

- The ratchet only moves down. Raising `MAX_SHARED_AXIS_RATIO` to make a change pass is prohibited;
  a change that needs it is the wrong change.
- Adding an axis to the scan is a contract change: the axis count is asserted (20) and adding one
  requires a `VERSIONS.md` row and a re-baselined ratchet.
- The scan is catalog-only and must stay free of simulation, seeds and wall-clock.
- Difficulty may never be argued from `scale` alone.
- No Unity/Unreal analysis tooling; `ast-grep`/`semgrep` may be used to scan *source shape*, but the
  authored-data verdict comes from this scanner.

**DONE WHEN:**
`node scripts/scan-stage-variation.mjs --strict` exits 0,
`node --test tests/stage-variation-doctrine.test.mjs` passes, every near-ratchet shared axis has an
explicit intentional/accidental verdict, and the response-type curve is recorded with the change's
delta.
