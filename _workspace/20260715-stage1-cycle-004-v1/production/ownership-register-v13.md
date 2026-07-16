---
run_id: 20260715-stage1-cycle-004-v1
owner: game-production-director
created_at: 2026-07-16T00:20:00Z
artifact_version: v13
immutable: true
append_only: true
status: ready
decision_ids:
  - C004-D-021
supersedes:
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/ownership-register-v12.md
input_artifacts:
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/decision-log-v13.md
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/task-manifest-v12.md
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/ownership-register-v12.md
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/messages/005-game-production-director.md
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/qa/qa-verdict-v1.md
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/qa/defect-register-v1.md
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/qa/regression-matrix-v1.md
input_hashes:
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/decision-log-v13.md: 1e88dc975dbd844fd11e7dee29651b4ed9e87b3f22510782acb411d840e1d42a
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/task-manifest-v12.md: ba1aeb1b6e58894b359ce0abb1f7003d18cfaed16711391a60604bebcac1d721
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/ownership-register-v12.md: b90b006d69733adf7372bb973ca5eacd41a296140ea969a7f7be0014104dc294
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/messages/005-game-production-director.md: 6a6e74cb82de159d157df264da501454a3ca23474a28edb6bf9ccda43598afe8
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/qa/qa-verdict-v1.md: e7a963b4de454133b5126fb11d99368cdfc532e45ab177f87f9396637986ffad
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/qa/defect-register-v1.md: a8d4534345fa560db831e4e962cae647efb2d83c2d092c7aff3730898b01a12c
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/qa/regression-matrix-v1.md: 5b9c2275abe52745789bd24deb5d5e1207989889badf5acbb0c7a243bd9ba7c4
---
# Immutable v13 ownership successor — C004-D-021 boundary

`ownership-register-v12.md` and all P4 QA artifacts remain immutable by pinned reference.

| Contractual role | Exclusive C004-D-021 scope | State and prohibition |
|---|---|---|
| game-production-director | This v13 governance trio and immutable `messages/006-game-production-director.md`. | Governance only. |
| game-engineering-lead | P3 remains closed. | P3 closed. No other phase work is authorized. |
| adversarial-qa-lead | P4 QA artifacts remain closed. | P4 closed. No other phase work is authorized. |
| live-operations-lead | P5 Operations execution: `ops/telemetry-contract-v1.md`, `ops/rollback-runbook-v1.md`, and `ops/release-readiness-v1.md`. | Ready. `STOP-SHIP` is absolute and non-overridable. |

No ownership transfer or overlap is created.
