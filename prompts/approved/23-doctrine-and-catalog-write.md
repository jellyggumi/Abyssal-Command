# 23 — Doctrine and catalog write

- **Version** v1 (2026-07-31)
- **Skill** `/skill:author-game-levels` (narrowest match for deterministic level data;
  `/skill:design-game-encounters` only if an objective's slot ownership moves)
- **Produces** the actual edit: the `STAGE_WAVE_DOCTRINE`, `STAGE_TACTICS` and/or
  `STAGE_ENCOUNTER_ROUTES` change for `${stageId}`, in the data ledger and nowhere else.
- **Placeholders** `${stageId}`, `${briefPath}` (20–22), `${changedFields}`.

---

**CONTEXT:**
`defense-catalog.js` is the ledger. Writing to it triggers import-time validation that throws before
a single test runs:

- `stage()` requires a doctrine row, ≥ 2 encounter objectives, and that the objectives own every
  wave slot **exactly once, in ascending objective order**; otherwise
  `Encounter route must own every wave slot once and in objective order`.
- Route path ids must be unique and non-empty, waypoint ids unique per path, and the finale's
  `elitePathId` / `bossPathId` must exist.
- `buildDoctrineWavePlan()` throws `Wave <stage>:<slot> requires an authored objective path for
  <direction>` when a wave's rotated direction has no authored approach for its objective. This is
  the trap: `spawnDirections` and the per-objective `approaches` must agree for every slot.
- `STAGE_PRESENTATION_BY_ID` must cover every stage; `stage-world-catalog.js` asserts its profile
  set equals `STAGES` and `STAGE_SHOWCASE_IDS.length === 3`.
- Objective points are reused verbatim by the quest layer; moving one without moving its quest point
  throws on import (`tests/stage-world-quest-points.test.mjs`).

**ROLE:**
You are a level-data engineer. You make the smallest edit that expresses the design, in the file's
existing single-line-per-entry style, with a comment that records *why the previous value was
wrong*, not what the new value is.

**ACTION:**

1. Re-read the current row before editing. Another session may have changed it; run
   `git status --short` and treat unexpected changes as another session's work (`CLAUDE.md` §5).
2. Apply `${changedFields}` to the doctrine row only. Keep the entry on one line, in the existing
   key order: `gateIntegrity, defenseTicks, waveCount, classes, kindCycle, pressureLane,
   midbossEnemy`.
3. If the wave count or the objective slot split changed, update `STAGE_ENCOUNTER_ROUTES` in the
   same edit so the partition stays total and ordered.
4. If a spawn direction was added, author its approach path for *every* objective of that stage
   before the direction can be rotated into a slot.
5. Write the comment above the row: the measured defect the change answers, with the number
   (e.g. "fielded three classes against stage 2's four; response types 16 vs 17"). No adjectives.
6. Re-derive the plan and print it: per slot, `kind`, direction, primary composition, remix
   composition, mid-boss id and HP. Compare against prompt 22's table line by line.
7. Report the digest delta per stage: `getRunDigest()` at a fixed seed/tick before and after. A
   doctrine change to one stage must leave the other stages byte-identical; if it does not, the edit
   touched shared data and must be reverted and re-scoped.
8. Update every pinned baseline the change invalidates *in the same commit* — in particular the
   digest fixtures in `tests/defense-run-simulation.test.mjs` (`<stage>/<seed>/<steps> bare`) and any
   recorded value in `prompts/RUNBOOK.md`. Recompute, never hand-edit toward green.

**FORMAT:**
The edit itself, plus a short report: fields changed, re-derived plan table, per-stage digest
before/after, and the list of baselines updated. No new file is created by this step.

**TARGET AUDIENCE:**
The reviewer who will run prompt 25 and 28 and will reject any catalog change whose digest delta is
unexplained or whose baseline was edited without recomputation.

**HARD CONSTRAINTS:**

- The data ledger only. This prompt never edits `defense-run-simulation.js`,
  `battle-realtime-three.js`, or a renderer.
- One stage per edit. Cross-stage edits cannot be attributed by the balance simulation.
- Never widen a validator to make an edit pass. The validator is the contract.
- `freeze()` every added array/object exactly as the neighbours do.
- Determinism is a hard invariant; a digest change is reported, never absorbed.
- Concurrent sessions: stage explicit pathspecs only, never `git add -A`, never revert another
  session's file (`CLAUDE.md` §5).
- No Unity/Unreal data concepts. Three.js + WebGL.

**DONE WHEN:**
The module imports without throwing (`node -e "import('./defense-catalog.js')"`), the re-derived plan
matches prompt 22 line by line, unrelated stages' digests are byte-identical, every invalidated
baseline is recomputed, and
`node --test tests/stage-wave-doctrine.test.mjs tests/stage-variation-doctrine.test.mjs
tests/stage-world-encounter-routing-contract.test.mjs tests/stage2-balance-retune.test.mjs` passes.
