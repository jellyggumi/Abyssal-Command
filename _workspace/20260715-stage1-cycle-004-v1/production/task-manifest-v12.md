---
run_id: 20260715-stage1-cycle-004-v1
owner: game-production-director
created_at: 2026-07-16T00:15:00Z
artifact_version: v12
immutable: true
append_only: true
status: ready
decision_ids:
  - C004-D-020
supersedes:
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/task-manifest-v11.md
input_artifacts:
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/decision-log-v12.md
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/task-manifest-v11.md
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/ownership-register-v11.md
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/p3-v5-independent-fresh-pin-audit.md
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/engineering/architecture-contract-v5.md
input_hashes:
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/decision-log-v12.md: 95cb81225a7763cd4998a5c9ee32e909921579adf2c8ec3652421dc4514a93b4
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/task-manifest-v11.md: 44d091e43a9ac7a703244ab543982c819e78eb3049aabd651088481db10dd11b
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/ownership-register-v11.md: bee8174c016e815519e7bc9e58e0373ec9bafc20a6671124893dd2b2a9082ad4
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/p3-v5-independent-fresh-pin-audit.md: 128591414f8f4aca35dbb4a688461c20f9effc4014c5b537d517ddf31b18857e
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/engineering/architecture-contract-v5.md: eb828eec44fae5a911c59895da1c17eaf6649df2c388996be7a757908225c50c
---
# Immutable v12 task-manifest successor — P3 closed and P4 QA active

This append-only manifest preserves `task-manifest-v11.md` by pinned reference.

| Task ID | Contractual owner | State | Exact scope and dependency |
|---|---|---|---|
| P3-engineering | game-engineering-lead | closed at evidence-ready | All P3 artifacts (`architecture-contract-v5.md`, `determinism-replay-contract-v4.md`, `risky-tech-validation-v3.md`, and `performance-evidence.md`) are finalized, immutable, and audit-PASS. |
| P4-qa-execution | adversarial-qa-lead | ready | May execute Stage 1 Campaign adversarial QA: running the 20 playtest simulation iterations, compiling `qa/defect-register-v1.md`, `qa/regression-matrix-v1.md`, and recording `qa/qa-verdict-v1.md`. |
| P5-operations | live-operations-lead | blocked | Blocked pending P4 verdict, metrics contract, and performance evidence. Operations STOP-SHIP remains active. |

No other phase work, code edits, assets, database, multiplayer, or unapproved provider integration is authorized.
