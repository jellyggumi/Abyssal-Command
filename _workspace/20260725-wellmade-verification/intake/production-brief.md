# Production Brief — Well-Made Verification Cycle

run-id: `20260725-wellmade-verification` · director · 2026-07-25

## bmad-gds intake schema

| field | value |
|---|---|
| game_type | Mobile-first single-player defense-survivor campaign (Abyssal Command), 10 stages, deterministic 60Hz sim + WebGL presentation |
| team_shape | Solo operator + harness agent team (director/designer/pm/programmer/qa) |
| engine | Vanilla JS + three.js (WebGL) on static GitHub Pages; Blender for asset authoring |
| current_stage | Post-Cycle-4. Prior retrospective recommends **Stage 2 re-entry (retune)**, not Stage 1 concept shift |
| next_public_beat | A build where 3D meshes + animations are uniformly production-grade AND the formal G2/G3/G6 protocols have actually run — i.e. the "well made" claim is backed by measurement, not by shipped-code volume |
| source_packet | 51 GLB (24 rigged characters), `battle-realtime-three.js` WebGL renderer, `defense-run-simulation.js` deterministic sim, prior cycle gate measurements, uncommitted rig-pipeline work in tree |
| main_constraint | Dirty tree (24 modified GLB + renderer + 4 untracked scripts) from an in-flight rig pass; studio-loop skipped its last pass for exactly this reason. No monetization exists (G5 is N/A by project boundary) |
| main_question | 사용자 질문: "리소스를 모두 활용해서 3D 메쉬·애니메이션이 적용된, 밸런스가 잘 잡힌 well-made 게임으로 만들려면 무엇을 개선해야 하는가" → **verification-first cycle**: measure G1–G8 against the live build, produce an evidence-ranked improvement backlog |

## Operating mode (ONE, per harness rule)

**Stage-gate verification review** — measure the current build against G1–G8, issue
per-gate verdicts with evidence paths, and convert every FIX into a ranked
backlog item. This cycle does NOT open new concept work and does NOT ship
feature code; its deliverable is a defensible answer to "what actually needs
improving", with numbers.

## Carried-forward risks from Cycle 4 (must be resolved or re-affirmed)

1. R2 role-diversity verification matrix not extended.
2. Turret ↔ Boss Rally Window structural mutual exclusion — provisional tradeoff.
3. Formal G2/G3/G6 protocols never executed (prior runs were lightweight probes).
4. Terrain GLB arbitrary-angle audit used silhouette-coverage heuristic only; UV seam exposure unverified.
5. Enemy nameplate CSS exists with no application point.
6. 4 bosses (gate-sovereign / tide-warden / lantern-tyrant / veiled-concordat) carried as "rigging failed".

## Director note on risk 6 — already superseded by this cycle's first measurement

The working tree contains an in-flight rig pass that **did** rig all 4. They now
carry skin + 11 clips and pass `tests/character-rig-contract.test.mjs` (24/24).
The residual defect is different from the carried-forward description and is
recorded in `qa/gate-measurements.md#g4-anim-density`.
