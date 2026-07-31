# 28 — Systems regression proof

- **Version** v1 (2026-07-31)
- **Skill** `/skill:test-playable-web-games` (deterministic fixtures + real browser evidence) with
  `/skill:game-build-log-triage` when a suite fails for an unrelated reason
- **Produces** the only artifact that may call a pattern / difficulty / variation change correct:
  the recorded suite result, with every failure attributed.
- **Placeholders** `${stageId}`, `${changeSummary}`, `${baselineRef}`.

---

**CONTEXT:**
The systems gate for this track is this suite list (`CLAUDE.md` §6: the full regression uses the
quoted glob `node --test 'tests/**/*.test.mjs'` — a shell-expanded glob is not equivalent):

| Suite | Guards |
|---|---|
| `tests/stage-wave-doctrine.test.mjs` | hold band, wave count/cadence/kind rhythm, clear-budget cap, mid-boss contract, wave-clear recovery, skill ranks, carry-over, the 3–6 minute bot run |
| `tests/stage-variation-doctrine.test.mjs` | shared-axis ratchet, stage-unique rhythm/mid-boss/rotation, response-type escalation, final-stage class coverage |
| `tests/stage2-balance-retune.test.mjs` | the pinned stage-2 retune contract (stance geometry, boss rally 0, frozen ids and coordinates) |
| `tests/stage-world-encounter-routing-contract.test.mjs` | objective ownership, approach paths, finale routing |
| `tests/stage-world-quest-points.test.mjs`, `tests/stage-story-progression.test.mjs` | quest coordinates bound to objective points, progression |
| `tests/defense-expansion-contract.test.mjs` | the six enemy policies as observable behaviour |
| `tests/defense-stage-world-movement.test.mjs` | movement/traversal against the authored world |
| `tests/defense-run-simulation.test.mjs` | the simulation contract **and the pinned per-stage digest fixtures** |
| `tests/stage1b-*.test.mjs` (5 suites) | gate evaluator, G3/G7 verification, pressure packets, persistence, evidence exporters |
| `tests/stage-runtime-proof-browser.test.mjs`, `tests/progression-mobile-ui-browser.cjs` | real-browser proof |

RECORDED BASELINE, 2026-07-31, working tree of this session:

- `stage-wave-doctrine` alone: **10 tests / 10 pass / 0 fail / 22 885 ms** — this suite is green;
  the pre-existing failure recorded by the map track in `prompts/VERSIONS.md` no longer reproduces.
- `stage-variation-doctrine` alone: **6 / 6 / 0**.
- Seven-suite systems run (`stage-wave-doctrine`, `stage2-balance-retune`,
  `stage-world-encounter-routing-contract`, `stage-world-quest-points`, `stage-story-progression`,
  `defense-stage-world-movement`, `defense-expansion-contract`): **64 tests / 62 pass / 2 fail /
  156 055 ms**. Both failures are one assertion — `gate pressure advances toward the gate` — from
  another session's in-flight `defense-run-simulation.js` arrival work, proven by sandbox isolation:
  HEAD simulation + HEAD catalog 17/17, HEAD simulation + this session's catalog 17/17, working
  simulation + either catalog 15/17.
- `defense-run-simulation`: **40 / 39 / 1** on the first run — the pinned `echo-throne/12/500 bare`
  digest fixture, invalidated by the `echo-throne` doctrine retune and, at that moment, by the
  concurrent arrival work as well. Once the arrival work became digest-neutral at every pinned
  checkpoint, the remaining delta was attributable to the retune alone, the row was recomputed to
  `01972547…` (the same value the HEAD-simulation sandbox produces for this catalog), and the suite
  re-ran at **40 / 40 / 0** with the other three fixture rows byte-identical.
- The five `stage1b-*` suites exceeded a 20-minute budget in this session and were not run to
  completion; they are `cinder-span`-only and that stage's digests were shown byte-identical.

**ROLE:**
You are the QA engineer who owns the "is it correct" question. You never report a suite you did not
run, you never call a failure unrelated without an isolation experiment, and you never make a suite
pass by weakening it.

**ACTION:**

1. Run `git status --short` first. Record which files are yours and which belong to another session.
2. Run the systems suite list above with explicit paths in one `node --test` invocation. Record
   tests / pass / fail / duration verbatim.
3. For every failure, isolate before attributing. Build a sandbox that copies `${baselineRef}`'s
   modules and swaps in exactly one changed file at a time (copy — never symlink; Node resolves a
   symlinked module from its realpath, and the sandbox silently loads the working-tree file).
   Report the 2×2: baseline/baseline, baseline+your change, working/your change.
4. Recompute every pinned digest fixture your change invalidates and update it in the same commit —
   unless the same line is owned by another session's in-flight work, in which case record the
   recomputed value, the command, and the owner, and do not edit the file (`CLAUDE.md` §5).
5. Run the real-browser proof (`tests/stage-runtime-proof-browser.test.mjs`) when the change alters
   anything visible: wave labels, mid-boss announcements, objective HUD, or stage naming.
6. Re-run `node scripts/scan-stage-variation.mjs --strict` and
   `node scripts/measure-stage-playtime.mjs --seeds 3` as part of the proof, not as an afterthought.
7. Write the receipt: exact commands, exact counts, exact durations, attribution per failure, and an
   explicit list of what was NOT run and why.

**FORMAT:**
A markdown receipt in the change's report and a one-paragraph entry for `log.md`, both containing
the exact command lines and the observed counts.

**TARGET AUDIENCE:**
The release owner (prompt 29). They may ship only what this receipt proves.

**HARD CONSTRAINTS:**

- Report what was actually checked: the exact command or artifact path and the observed result
  (`CLAUDE.md` §6). Distinguish carried evidence, new evidence, unresolved blockers.
- Never suppress a test, relax an assertion, or delete a fixture to reach green.
- Never claim a suite you did not run to completion; state the budget that stopped you.
- Never revert or absorb another session's changes; isolate around them.
- A digest fixture is recomputed, never hand-typed toward the expected value.
- Browser proof is required for player-visible changes; deterministic suites alone are not enough.

**DONE WHEN:**
Every suite in the list has either a recorded result or a recorded reason it was not run, every
failure is attributed by an isolation experiment, every invalidated baseline is recomputed (or its
owner named), and the receipt is written where the next session can find it without chat history.
