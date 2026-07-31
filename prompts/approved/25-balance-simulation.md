# 25 — Balance simulation

- **Version** v1 (2026-07-31)
- **Skill** `/skill:data-analysis` (decision-first reading of simulation output) with
  `/skill:ab-test-analysis` when comparing two candidate tunings
- **Produces** the numeric verdict on a pattern or difficulty change for `${stageId}`: determinism,
  termination, playtime, and the attributed delta against the pre-change baseline.
- **Placeholders** `${stageId}`, `${changeSummary}`, `${baselineRef}` (a git ref or a saved JSON),
  `${outputDir}` (default `_workspace/current/qa/`).

---

**CONTEXT:**
Three instruments, three different questions. Using the wrong one is the classic error here.

| Instrument | Controller | Answers | Does NOT answer |
|---|---|---|---|
| `scripts/run-defense-balance-sim.mjs --strict` | `MOVE_IDLE` (never moves) | determinism (each stage×seed replayed twice, digests compared), termination inside 24 000 ticks, growth-offer and extraction counts | whether the stage is clearable — an idle commander legitimately loses |
| `scripts/measure-stage-playtime.mjs` | objective-seeking bot | stage length against the 180–360 s target, victory rate, wave kinds reached, mid-boss spawns and kill ticks, growth cadence | frame cost, human agency, subjective difficulty |
| `scripts/run-stage1b-symmetric-trials.mjs` | synthetic, equal-budget archetype profiles | archetype win balance over ordered/reverse pairs (seeds 401–405) | anything about stages other than `cinder-span` |

OBSERVED baseline, 2026-07-31 (bare `HEAD` catalog and simulation, before the `echo-throne` retune):

- balance sim: `pass: true`, 0 failures; `cinder-span` VICTORY@11333 / DEFEAT@19200 / VICTORY@11357,
  `abyss-chancel` DEFEAT@19500 ×3, `echo-throne` FINAL_COMPLETION@12614 / @12685 / @12781
  (seeds 1 / 17 / 991). The DEFEATs are the idle controller, not a balance regression.
- playtime (3 seeds): `cinder-span` median 192.13 s (190.93–193.77), `abyss-chancel` 205.27 s
  (202.67–206.07), `echo-throne` 210.08 s (208.08–212.88); 3/3 victories and 3/3 in target each.

**ROLE:**
You are a decision-first analyst. You start from the decision the number has to support, you refuse
to compare runs whose inputs differ in more than one respect, and you never report an average
without its range.

**ACTION:**

1. Restate `${changeSummary}` and the single question the simulation must answer.
2. Establish isolation *before* measuring. If the working tree contains another session's edits to
   `defense-run-simulation.js` or any shared module, build a sandbox that pairs `${baselineRef}`'s
   simulation with each candidate catalog, and say so in the report. Measuring a two-variable tree
   and attributing the delta to your change is the failure mode this step exists to prevent.
3. Run determinism and termination:
   `node scripts/run-defense-balance-sim.mjs --strict --output ${outputDir}/balance-<label>.json`.
   Report `pass`, the failure list, and per stage×seed the terminal outcome and tick.
4. Run playtime:
   `node scripts/measure-stage-playtime.mjs --seeds 3 --output ${outputDir}/playtime-<label>.json`.
   Report median and range per stage, victories, `inTarget`, and mid-boss spawn/kill ticks.
5. Diff against the baseline, per stage: outcome, tick, digest identity. State explicitly which
   stages are byte-identical — a single-stage doctrine change that moves another stage's digest is a
   defect, not a finding.
6. Attribute every delta. A tick difference is only attributable if exactly one input changed;
   otherwise re-run with the other variable pinned.
7. When two candidate tunings are compared, use the same seeds for both and report the paired
   difference, not two independent medians.
8. State what the run does NOT prove: the idle sim says nothing about clearability, three seeds say
   nothing about the tail, and no bot says anything about human agency (that is G7).

**FORMAT:**
A markdown report at `${outputDir}/balance-report-${stageId}.md`: question, isolation method,
command lines verbatim, per-stage tables (outcome/tick/digest, playtime median/range/inTarget),
attributed deltas, unproven claims. Keep the JSON artifacts next to it.

**TARGET AUDIENCE:**
The gate reviewer (prompt 26) and the release owner (prompt 29), who will re-run the exact commands
quoted in the report.

**HARD CONSTRAINTS:**

- Mark every statement `[OBSERVED]`, `[INFERENCE]` or `[TARGET]` (`CLAUDE.md` §1). A carried
  baseline is never reported as a new measurement.
- Quote the exact command and its output path. "The sim passed" is not evidence.
- Report ranges, not just medians. Three seeds is a smoke test, not a distribution.
- Never edit the simulation to make a measurement pass.
- Playtime target 180–360 s per stage; balance sim must reach a terminal state inside 24 000 ticks
  with identical repeat digests.
- Another session's concurrent edits are treated as their work: measure around them, never revert
  them (`CLAUDE.md` §5).

**DONE WHEN:**
Both instruments have run against both the baseline and the change, the isolation method is stated,
every delta is attributed to exactly one input, unrelated stages are shown byte-identical, and the
report names what remains unproven.
