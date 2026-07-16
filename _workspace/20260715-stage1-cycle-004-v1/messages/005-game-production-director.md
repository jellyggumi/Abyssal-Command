---
run_id: 20260715-stage1-cycle-004-v1
owner: game-production-director
created_at: 2026-07-16T00:15:00Z
immutable: true
append_only: true
decision_id: C004-D-020
input_artifacts:
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/decision-log-v12.md
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/task-manifest-v12.md
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/ownership-register-v12.md
input_hashes:
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/decision-log-v12.md: 95cb81225a7763cd4998a5c9ee32e909921579adf2c8ec3652421dc4514a93b4
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/task-manifest-v12.md: ba1aeb1b6e58894b359ce0abb1f7003d18cfaed16711391a60604bebcac1d721
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/ownership-register-v12.md: b90b006d69733adf7372bb973ca5eacd41a296140ea969a7f7be0014104dc294
---
20260715-stage1-cycle-004-v1 | P4 | game-production-director -> adversarial-qa-lead | authorization | /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/decision-log-v12.md | blocking yes

C004-D-020 authorizes the transition of the Abyssal Surge Campaign Phase 3 to Phase 4 QA. All four P3 engineering specification documents are closed as evidence-ready and are hash-pinned.

The adversarial-qa-lead is now authorized and required to execute P4 QA: running the playtests, recording defects, checking regressions, and authoring `qa/qa-verdict-v1.md`, `qa/defect-register-v1.md`, and `qa/regression-matrix-v1.md` in the cycle 4 folder.

P5 remains blocked. Telemetry, deployment, release, or next-Stage work is not authorized. QA `FAIL` and operations `STOP-SHIP` vetoes remain absolute and non-overridable.
