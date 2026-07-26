# G6 Prerequisite Audit — T-pose Rigging and Animation

run-id: `20260726-tpose-rig-animation`  
measured by: QA (director-operated evidence review)  
measured at: 2026-07-26

## Required G6 inputs

| Requirement | Expected run artifact / measurement | Measured value | Result |
|---|---|---:|---|
| Telemetry contract implementation | `_workspace/20260726-tpose-rig-animation/ops/telemetry-contract.md` plus emitted fields | 0 / 1 artifact; emissions not measured | missing |
| Rollback exercise | `ops/rollback-runbook.md` plus one recorded test | 0 / 1 artifact; 0 tests | missing |
| Release-readiness checklist | `ops/release-readiness.md` at 100% | 0 / 1 artifact; checklist not measured | missing |
| Frame performance | p95 <=16.7ms; long frame <0.5%; 30-minute memory soak | 0 measurements | not run |
| Input latency | <=100ms | 0 measurements | not run |

## Method

Direct expected-artifact existence check in the run workspace's `ops/` and `engineering/` lanes, followed by an evidence-scope check. `../engineering/tpose-rig-audit.md` is structural asset evidence only; it does not contain operation telemetry, rollback, release, p95/long-frame/soak, or input-latency measurements.

## Verdict input

```yaml
status: FAIL
measured_value:
  required_ops_artifacts_present: 0
  required_ops_artifacts_expected: 3
  required_runtime_measurements_recorded: 0
  required_runtime_measurements_expected: 5
method: Direct workspace prerequisite inventory and structural-audit scope review.
evidence:
  - g6-prerequisite-audit.md
  - ../engineering/tpose-rig-audit.md
threshold: telemetry contract emitting; rollback tested; release checklist 100%; p95 <=16.7ms; long-frame <0.5%; stable 30-minute memory; input <=100ms
reason: This asset-only pass has none of the required G6 artifacts or measurements. Missing evidence fails G6.
```
