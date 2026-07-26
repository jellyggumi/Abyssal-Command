# Task Manifest — Stage 2 Defense/RPG Development

run-id: `20260725-defense-rpg-development` · director · 2026-07-25
Operating mode: **Stage 2 retune/develop** (Tier 0 first, then a measurable defense/offense + RPG slice)
Next public beat: four Tier-0 fixes remeasured, followed by a readable 30–180 s defense/offense + RPG loop.

| task | owner | stage.phase | artifact / evidence | gate link | status | next beat |
|---|---|---|---|---|---|---|
| Intake and source freeze | director | intake | `intake/production-brief.md` | — | done | packet accepted |
| Tier 0.1 canon string replacement | programmer + narrative QA | retune | `app.js`; narrative audit receipt | G1 | planned | re-run shipped-string audit; no `그림자군단` |
| Tier 0.2 extraction reachability | simulation engineer | retune | `defense-run-simulation.js`; accepted-input/event receipt | G7/G8 | planned | defeat elite, open Bind window, accept `EXTRACT_ELITE` |
| Tier 0.3 pedestal removal | asset engineer | retune | GLB pipeline receipt; scale/rig/clip report | G4/G6 | planned | remeasure rendered-height parity and triangle/draw-call delta |
| Tier 0.4 skeleton disposal | renderer engineer | retune | `battle-realtime-three.js`; 40-cycle leak receipt | G6 | planned | renderer-held textures remain flat after spawn/despawn |
| Tier 0 re-measurement | verifier + balance QA | verify | dated receipts under new run packet | G1/G4/G6/G7/G8 | blocked on fixes | publish pass/fix evidence only; do not infer PASS |
| Defense/offense slice | game designer + simulation engineer | develop | simulation trace: move, target pressure, skill/item response | G2/G3/G7 | planned | one stage contains Gate pressure, offense choice, and meaningful Warden risk |
| RPG choice slice | RPG/catalog owner + UI/UX | develop | `rpg-catalog.js`/catalog-backed growth trace; current → upgraded UI | G2/G3/G7 | planned | one three-choice growth offer plus one run item/reward |
| Extraction-to-companion handoff | simulation + campaign owner | develop | `ELITE_EXTRACTED` + persistent local companion trace | G7/G8 | planned | same trace adds run companion and local collection |
| UI hierarchy and touch calibration | UI/UX designer | develop | `design/ui-ux-layout.md`; browser capture receipt | G3/G4/G6 | planned | primary targets ≥44 CSS px and four critical objects readable |
| Asset/provenance gate | asset/provenance engineer | develop | `engineering/resource-provenance.md`; sidecars/manifests | G4 | planned | only rights-cleared, runtime-verified assets can ship |
| Cartoon stage texture and background pipeline | technical artist + asset/provenance engineer | S3 preparation | GTI concept reference → provenance sidecar → Blender GLB embedding → WebGL/fallback/perf receipt | G4/G6 | blocked: Tier 0.3/0.4 | build Cinder Span atmosphere only after runtime asset gates |
| Hourly review and escalation | QA lead + director | all | `qa/hourly-review-protocol.md`; review rows | all applicable | planned | stop on regression; escalate with exact receipt |
| Hourly isolated-studio preflight recovery | director + operator | ops | `_workspace/20260725-hourly-coreloop-development/ops/hourly-run-contract.md`; `.studio-loop/state.json` | G6 | blocked: foreign worker changes | review the isolated worker's `.gitignore` / driver edits; never discard another session's work |
| 30-minute main-PR validation and apply gate | QA + director | ops | `.github/workflows/pr-guard.yml`; `scripts/pr-merge-decision.mjs`; `tests/pr-merge-decision.test.mjs` | G6 | blocked: local-only remote | validate the merge result; apply only after explicit `auto-merge` label once the GitHub remote is configured |

## Gate links and current baseline

- **G1:** 1 S1 + 3 S3 narrative violations; source `_workspace/20260725-wellmade-verification/qa/narrative-audit.md#g1`.
- **G2:** 0/700 defeats; turtle TTK ceiling violated in 6/10 stages; source `_workspace/20260725-wellmade-verification/qa/gate-measurements.md#g2`.
- **G3:** 7/7 archetypes viable only vacuously; stance behavior decorative; source `_workspace/20260725-wellmade-verification/qa/gate-measurements.md#g3`.
- **G4:** 4 boss idles frozen; 23/24 characters off-canon flat material; source `_workspace/20260725-wellmade-verification/production/gate-reviews/stage-gate-review.md`.
- **G6:** low-tier mobile p95 24.2 ms / 8.302% long frames; GPU texture leak confirmed; source `_workspace/20260725-wellmade-verification/engineering/evidence/g6-*.json`.
- **G7:** only whole-stage sortie currently falls in 30–180 s; `EXTRACT_ELITE` unreachable; source `_workspace/20260725-wellmade-verification/design/core-loop.md#g7-delta` and `_workspace/20260725-wellmade-verification/production/gate-reviews/stage-gate-review.md`.
- **G8:** frequency result 0/11 comparable titles, impression blocked because the mechanic is unreachable; source `_workspace/20260725-wellmade-verification/design/novelty-scorecard.md#g8-frequency`.

These are carried observations. This run has no new gate evidence until the listed receipts exist.
