# Conflict register — 20260722 Abyssal Command BMAD-GDS expansion

| id | detected | competing claims | decision | evidence | owner | status |
|---|---|---|---|---|---|---|
| C-01 | 2026-07-22 | Research-local gate mappings and a lighter engineering performance target conflicted with the harness quality-gate contract. | Restore harness meanings: G2 balance, G4 immersion, G5 fairness, G6 operations/performance, G7 core loop, G8 novelty. Enforce G6 p95 frame ≤16.7 ms, long frames <0.5%, and 30-minute memory soak. | `production/decision-log.md#D-08`; `engineering/perf-budget.md`; `research/{qa-measurement-protocol,telemetry-playtest-contract}.md` | game-production-director | resolved |
| C-02 | 2026-07-22 | Artifact verifier found target-package state described as missing in QA blockers. | Name existing contracts as unverified targets and retain only missing implementation, fixture, export, and participant evidence as blockers. | `qa/gate-measurements.md`; `production/decision-log.md#D-07` | game-production-director | resolved |

No unresolved data conflicts remain. This is a concept-validation package; every G1–G8 result remains NOT MEASURED and NOT PASSED.
