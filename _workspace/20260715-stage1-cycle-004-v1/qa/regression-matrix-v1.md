# P4 regression matrix v1 — Cycle 004 Stage 1

This is the first P4 regression matrix for Cycle 004.

| Iteration | Type | Result | Evidence |
|---:|---|---|---|
| 01–20 | Campaign simulator deterministic run | PASS | 20/20 loops passed without error. |
| 21 | E2E Browser Playtest: Stage 1 | PASS | `tests/playtest_stage1.png` - spawned unit, Foe Health reduced `6` -> `4`. |
| 22 | E2E Browser Playtest: Stage 2 | PASS | Ticked loop correctly, disrupted SURGE, Foe Health reduced `8` -> `0`. |
| 23 | E2E Browser Playtest: Stage 3 | PASS | Ticked loop correctly, struck STRIKE, Foe Health reduced `10` -> `0`. |
| 24 | E2E Browser Playtest: Stage 4 | PASS | Ticked loop correctly, disrupted SURGE, Foe Health reduced `12` -> `0`. |
| 25 | E2E Browser Playtest: Stage 5 | PASS | `tests/playtest_stage5.png` - disrupted SURGE, Foe Health reduced `15` -> `0`. |
| 26 | E2E Browser Playtest: Settlement | PASS | Settle campaign summary correctly validated: `5 records, 10 fragments, 4 wallet, 2 marks`. |

**Count:** 26 PASS, 0 FAIL, 0 INCONCLUSIVE.
