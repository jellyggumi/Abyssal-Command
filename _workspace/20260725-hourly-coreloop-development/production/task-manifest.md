# Task Manifest — Hourly Core-Loop Development

run-id: `20260725-hourly-coreloop-development` · director · 2026-07-25
Operating mode: **Stage 2 retune / develop** — one bounded vertical slice per
hourly run; advance only with evidence.

| task | owner | stage.phase | artifact | gate | status | beat |
|---|---|---|---|---|---|---|
| Intake + prior-cycle evidence binding | director | intake | `intake/production-brief.md` | — | done | stage-2 re-entry |
| Hourly worker preflight and isolation audit | director + programmer | ops | `ops/hourly-run-contract.md` | G6 | running | safe recurring work |
| Reference-game research outline and evidence | designer | S2 discovery | `design/reference-research/` | G7/G8 input | running | research-informed cadence |
| Benchmark/readability plan + Cinder test matrix | QA | S2a | `qa/test-plan.md`, `qa/playtest-report.md` | G2/G3/G4/G7 | planned | measurable player choice |
| Cinder Span pressure budget proposal | designer | S2b | `design/balance-sheet.md` | G2/G3 | blocked: QA baseline | legitimate loss path |
| Reward and fairness contract update | PM | S2b | `pm/reward-bands.md`, `pm/negotiation-record.md` | G5 | blocked: design proposal | preserve meaningful growth |
| Explicit elite-bind confirmation tests | QA test engineer | S2d | `targeted test files`, `qa/explicit-bind-verification.md` | G7/G8 | done | browser evidence: one Bind start; ready at pump 252 |
| Cinder explicit-bind + pressure vertical slice | programmer | S2d | source change + `engineering/vertical-slice-cinder.md` | G2/G7/G8 | done | explicit-Bind slice complete; G2 untouched, G7 remains FIX |
| 3D resource lifecycle leak closure | renderer programmer | S3a prerequisite | source change + `engineering/perf-budget.md` | G6 | planned | no linear GPU texture leak |
| Stage concept reference generation | technical artist | S3a preparation | `design/reference-images/cinder-span-stage.png` | G4 input | done | source composition only; not shipped texture |
| Mobile UI/control and visual regression | QA | S2/S3 verification | `qa/visual-verification.md` | G4/G7 | planned: mobile viewport not measured | portrait playability |
| Gate review + hour retrospective | director | close | `production/gate-reviews/`, `retrospectives/hour-*.md` | all touched | planned | evidence-backed next task |

## Hourly task policy

1. The worker chooses the first `planned` task whose dependencies are `done`.
2. A source change is prohibited until its test/measurement task is `done`.
3. An hour ends after one task has either passed its own check or recorded an
   evidence-backed block. It never starts a second unrelated fix.
4. Every QA discovery is broadcast to all five roles through a numbered file in
   `messages/` with `feedback-requested-by`.
5. A failing G2/G3/G7 re-measurement returns to S2b. No move to art, animation,
   or campaign-wide pressure changes without a Cinder measured result.
6. The generated stage image is design reference only. It cannot be shipped as a
   GLB texture until the project-then-bake pipeline and resource closure validate
   it.
