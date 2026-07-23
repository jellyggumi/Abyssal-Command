# Decision log — Abyssal Command BMAD-GDS expansion

| id | date | decision | evidence / rationale | owner | status |
|---|---|---|---|---|---|
| D-01 | 2026-07-22 | Use **concept-validation** operating mode only. | User requested deep research and BMAD-GDS expansion; inherited Stage 1 still has evidence gaps. | game-production-director | active |
| D-02 | 2026-07-22 | Preserve automatic baseline combat and movement-first input; do not add manual aim or tactical queues. | Current product contract §§ screen/control and simulation invariants. | game-production-director | locked |
| D-03 | 2026-07-22 | Treat all research-derived values as targets, not shipped measurements. | G1–G8 evidence contract. | game-production-director | locked |
| D-04 | 2026-07-22 | Issue Stage 1 **FIX**; deny PASS and release authorization. | `qa/gate-measurements.md` records G1–G8 as NOT MEASURED / NOT PASSED; no implementation, fixture, human-study, asset, or operations receipt exists. | game-production-director | active |
| D-05 | 2026-07-22 | Enter the next cycle only as **Stage 1 FIX / vertical-slice implementation plus measurement**. | G7 draft, G1 draft, and G6-ops draft need the named loop, canon, and operations evidence from one pinned build tuple before review. | game-production-director | active |
| D-06 | 2026-07-22 | Retain the ElevenLabs boundary: optional rights-reviewed build-time static assets only. | `engineering/resource-manifest.md` and `messages/001-director-expanded-scope.md` prohibit runtime provider calls, SDKs, credentials, remote URLs, and gameplay dependency; no provider use occurred in this cycle. | game-production-director | locked |
| D-07 | 2026-07-22 | Restore artifact-contract compatibility fields and reconcile planning state. | Verification found missing generic G2/G5 YAML envelope, stale QA blockers, absent conflict record, and completed artifacts marked pending. Add explicit target-only compatibility keys; this does not alter rules, evidence, or gate status. | game-production-director | locked |
| D-08 | 2026-07-22 | Restore authoritative G2–G8 mappings and G6 budget thresholds. | Independent review found research-local remapping and an insufficient frame/soak budget. Research now contributes evidence without redefining gates; engineering requires G6's p95 ≤16.7 ms, <0.5% long frames, and 30-minute memory soak. | game-production-director | locked |
