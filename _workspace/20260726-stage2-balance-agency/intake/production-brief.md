# Production Brief — Stage 2 Balance and Agency

run-id: `20260726-stage2-balance-agency`  
director: 2026-07-26  
operating mode: **Stage 2 balance, core-loop stability, and novelty development**  
next public beat: a non-saturated sortie where a player can choose and complete elite extraction before the run resolves.

## bmad-gds intake

```yaml
game_type: mobile-first 2.5D defense-survivor RPG
team_shape: director + designer + PM + programmer + QA
engine: browser JavaScript with Three.js renderer
current_stage: Stage 2, Phase 2a
next_public_beat: non-saturated Cinder Span sortie with reachable Elite Extract decision
source_packet:
  - _workspace/20260726-g1-remediation/retrospectives/cycle-1-retrospective.md
  - _workspace/20260726-tpose-rig-animation/production/full-quality-status.md
  - _workspace/20260725-wellmade-verification/qa/gate-measurements.md
  - _workspace/20260725-wellmade-verification/design/core-loop.md
main_constraint: preserve the current G1 PASS, runtime IDs, deployed GLBs, and user-authored work; use measurable data-driven balance changes before behavior/renderer rewrites
main_question: can base-stage pressure and extraction readiness become reachable without exceeding G2/G3 bands or invalidating the no-monetization boundary?
next_public_beat: one non-saturated sortie with an observable Elite Extract decision
```

## Gate intent

- G2: move base-stage outcomes into measurable win/TTK bands before interpreting RPG power.
- G3: obtain ≥5 archetype rotation sessions with at least three independently viable strategies.
- G5: preserve no-monetization boundary; record N/A rather than claiming paid/free PASS.
- G7/G8: make `EXTRACT_ELITE` a player-reachable decision, then measure voluntary re-entry and impression rather than infer them from scripted runs.
