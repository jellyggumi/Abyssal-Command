# Source note — stage pattern / difficulty level / system diversification skill catalog (2026-07-31)

Raw capture: [[raw/sources/2026-07-31-stage-pattern-difficulty-system-variation-skill-catalog]]

The operator's third catalog, read to answer one question: *how is a stage's wave pattern, its
difficulty level, and the campaign's variety authored and proven in this repository.*

| # | Source | What it settles | What it does not |
|---|---|---|---|
| S1 | Operator catalog §§1–6 — the local skill roster (encounter design, enemy AI tuning, action-combat timing, studio harness, simulation/telemetry analysis, QA gates, planning frameworks) | the vocabulary and the ordering of the work: behaviour before numbers, numbers only from simulation, diversification as a set of named axes | contains no repository threshold; every skill row is engine-agnostic and the "8 numeric quality gates" of `game-studio-harness` are not the same gates this repository ships |
| S2 | Operator catalog §7–8 — external references (PCG Book, Hunicke DDA, MDA, WFC, Machinations, ML-Agents, Optuna, PostHog) | the theory for difficulty curves and rule variation, and the tool landscape for offline balance search | none of it is runnable against this build: there is no telemetry pipeline, no RL harness, and no live cohort. Offline search tools may only *propose* catalog values |
| S3 | Operator catalog §9 — the repository mapping (data owners, scripts, regression gates, 8-step order) | that the executable contract already exists here and the skills sit inside it | the mapping lists artifacts, not thresholds. Every number in the synthesis was recovered from the code, not from this section |

Verification of §9 on 2026-07-31: all three data owners and all eight scripts named there exist.
The regression table is accurate except that `tests/stage-wave-doctrine.test.mjs` is now green
(10 tests / 10 pass), whereas `prompts/VERSIONS.md` still carried it as a known pre-existing failure
from the map track — that limitation row was corrected in the same session.

Synthesis: [[wiki/concepts/stage-difficulty-and-system-variation]] — the clear-budget derivation,
the doctrine rows, the gate thresholds, the twenty variation axes, and the ten-step pipeline.

Applied artifacts: `prompts/approved/20`–`29`, `scripts/scan-stage-variation.mjs`,
`tests/stage-variation-doctrine.test.mjs`, and the `echo-throne` doctrine retune in
`defense-catalog.js`.

Reading note: the catalog's core discipline — *난이도는 적 HP 배수가 아니라 요구되는 대응의 종류
수* — is the one claim in it that turned out to be load-bearing and testable here. Applied as a
measurement it immediately caught a shipped defect: the campaign's HP scale climbed 100 → 115 → 130
while the number of distinct answers demanded fell 16 → 17 → 16, because the last stage fielded
three enemy classes against stage 2's four and copied stage 1's mid-boss class, pressure lane and
wave-kind rhythm. That is the difference between the catalog as prose and the catalog as a gate.
