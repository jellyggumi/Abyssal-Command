# Production Brief — Canonical Defense/Offense RPG Studio Cycle

run-id: `20260726-stage1b-cinder-pressure-agency`  
director: 2026-07-26  
operating mode: **Stage 1 concept/UI/core-loop redesign, instrumented implementation, and real-play review**  
canonical workspace: `_workspace/20260726-stage1b-cinder-pressure-agency/`  
next public beat: a rendered Cinder Span sortie where the player reads pressure, chooses growth/formation/extraction, and sees the decision persist into the next sortie.

## bmad-gds intake

```yaml
game_type: responsive web defense/offense action RPG
fantasy: command one abyssal warden and a small formation through a readable hold-surge-extract cycle
team_shape: production director + game designer + game PM + game programmer + game QA
engine: deterministic browser JavaScript simulation with a read-only Three.js presentation layer
current_stage: Stage 1b, research and scope review
workspace_policy: exactly one canonical `_workspace` run folder; retain lineage inside its domain folders
main_constraint: preserve deterministic digests, frozen balance boundaries, runtime IDs, deployed assets, campaign schema, and no-monetization scope
main_question: can reference-backed stage direction, combat HUD hierarchy, control feedback, and a causal agency readout make the defense/offense RPG loop immediately legible without hiding or changing simulation outcomes?
next_public_beat: one real-playable Cinder Span vertical slice with a persistent Elite Extract decision
```

## Player contract

1. Read the threatened objective and next irreversible event without opening a debug panel.
2. Move and orbit responsively while the commander remains simulation-authoritative.
3. Switch formation for a visible tactical reason and read the consequence.
4. Choose RPG growth without losing the defense context.
5. Reach, accept, hold, and verify an elite extraction when the simulation makes it available.
6. Return to the next sortie with the accepted elite state visible and intact.

## Production method

- Deep-research relevant defense, action-RPG, and web-game UI references before design changes.
- Inventory and reuse existing images, GLBs, animations, audio, terrain, props, VFX, and UI resources before requesting new assets.
- Use subagent browser play at desktop and portrait viewports; scripted probes remain synthetic and cannot satisfy human G7/G8 evidence.
- Every implementation slice needs numeric acceptance criteria, focused behavior tests, live-play evidence, and an independent review.
- The scheduled studio loop performs one bounded improvement pass every hour, records review/retrospective evidence, and updates the durable wiki only with verified findings.

## Frozen boundaries

- Equal seeds and identical inputs must remain byte-identical under `getRunDigest()`.
- Renderer, HUD, camera, audio, and presentation physics may read frozen snapshots only; they never write back into simulation or campaign state.
- No numerical Cinder retune, threshold substitution, monetization surface, runtime-ID change, or asset replacement is authorized by this brief.
- Unreachable study paths are reported as blocked, not fabricated or relabelled as observed.
