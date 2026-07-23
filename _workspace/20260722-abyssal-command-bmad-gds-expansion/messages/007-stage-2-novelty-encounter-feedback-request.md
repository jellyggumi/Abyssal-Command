# QA broadcast — Stage 2 novelty and encounter validation criteria

```yaml
message_id: 007
from: game-qa
feedback-requested-by: 2026-07-22
audience:
  - game-production-director
  - game-designer
  - game-pm
  - game-programmer
  - game-qa
subject: "Planned Stage 2 encounter, novelty, route, and reward-boundary validation — feedback required"
status: planned / NOT RUN
```

## Scope and non-claims

This broadcast records future QA criteria only. It adds no gameplay implementation, catalog retune, provider integration, asset request, or release authorization. It reports **no new results**. **G2, G3, G5, and G8 remain NOT MEASURED / NOT PASSED.** The prior G2 receipt remains measurement-integrity-only; it is not parity, dominance, EV/cooldown-share, player, or release evidence.

## Criteria entering the Stage 2 queue

1. **Five-archetype rotation:** Bulwark, Striker, Gambit, Conductor, and Rift hybrid require equal-budget paired ordinary, elite, and Stage-10 fixtures with matched rule digest, seed family, starting-health band, anchors, and input tape. Capture TTK distribution, route progress, survival, damage, and active-skill EV/cooldown-EV share. This is planned G2/G3 evidence, not a viability claim.
2. **Same-seed reproducibility:** identical stage/card/anchor/input tuples must yield the same ordered phase checkpoints, card/anchor/count choices, fallback reasons, terminal result, and canonical scheduler hash across normal, reduced-motion, muted/captioned, observer A/B/disabled, invalid-card, and exhausted-deck cases. A mismatch blocks related evidence; it does not permit a reroll.
3. **Non-dominant route check:** every card × archetype cell needs its declared movement answer plus hold-position/path-edge adversarial tape. The +25% route-progress-and-survival alert with no-worse damage is a review flag, not a dominance verdict or authority to add seed-specific punishment.
4. **Reward/idle boundary:** concluded encounter outcomes must be paired with 0 h, cap, cap+1, negative/rollback, storage-denied, stale/double-claim, and reopen ×100 settlement cases. The planned assertion is one valid receipt only, zero invalid-elapsed award, and no mutation of combat/run XP, boss, stage, extraction, companion, campaign, or combat-stat fields.
5. **Boss/large-wave diversity and recovery:** Stage 4–10 landmark schedules must be linted for stable fallback, no deck reset/reroll, repeated signature/three-card rhythm, boss/mini-boss mechanic-vector recurrence, telegraph/safe-lane coverage, relief, and Stage-10 terminal/post-clear behavior.
6. **Human-impression gap:** a deterministic signature lint cannot establish novelty. A later preregistered local, consented, counterbalanced first-exposure study must retain assignment and raw ratings for repetitive, fair/readable, and wanted-more-pressure. No such session currently exists.

## Evidence and current blockers

| Criterion | Planned evidence | Current blocker |
| --- | --- | --- |
| Five-archetype / route checks | `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl`; `qa/evidence/gates/G3-archetype-rotation-and-playtest.jsonl`; `qa/evidence/combat/stage-2-route-dominance-sweep.jsonl` | XR-13 equal-budget fixture surface and XR-14 complete active-skill resolved-damage records are deferred. |
| Same-seed / landmark checks | `qa/evidence/waves/stage-2-same-seed-replay.jsonl`; `qa/evidence/waves/stage-2-landmark-diversity-and-relief.json`; `qa/evidence/waves/stage-2-boss-terminal-trace.jsonl` | Expanded card/deck data, scheduler fixture corpus, checkpoint export, and reachability harness are absent. |
| Reward/idle boundary | `qa/evidence/idle/stage-2-encounter-return-boundary.jsonl`; `qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl` | Settlement implementation, account/session fixture corpus, and G5 export are absent. |
| Human impression | `qa/evidence/gates/G8-novelty-comparison-and-impression.json`; `qa/evidence/playtest/stage-2-encounter-impression.jsonl` | No preregistration assignment or completed local human session exists. |

## Feedback requested

- **Game designer:** confirm the authored card/build coverage matrix, expected movement answer for each of the five profiles, boss/large-wave mechanic vectors, and which route/role change would be eligible for review if XR-16 or XR-20 reproduces. Do not retune from this planned alert alone.
- **Game PM:** confirm reward/idle fixture ownership preserves the no-commerce, active-only boundary and that no return credit, optional objective, or absence-time value becomes an encounter survival/progression requirement.
- **Game programmer:** identify the smallest local observer-only surfaces that can provide equal-budget profile selection, complete active-skill resolved-damage/cooldown records, stable scheduler checkpoints/fallback events, and settlement field diffs without changing canonical rules state.
- **Game-production director:** retain G2/G3/G5/G8 as **NOT MEASURED / NOT PASSED**; assign only the missing fixture/observer/pre-registration work and require independent gate review after matching evidence exists.

## Source anchors

- `qa/expanded-stage-test-plan.md#L59-L65` — planned wave, archetype, reward, parity, and idle test surfaces; `#L152-L154` confirms the plan has no executed suite or gate declaration.
- `research/encounter-boss-variety-survey.md#L112-L120` — target-only recurrence, rotation, landmark, recovery, coverage, and dominance-alert definitions; `#L126-L145` — paired replay and human evidence requirements; `#L147` — gates remain unclaimed.
- `research/wave-encounter-composition.md#L225-L232` — deterministic selection/fallback/checkpoint contract; `#L240-L266` — telemetry limits, anti-dominance constraints, and direct-rating requirement.
- `research/progression-idle-economy-survey.md#L47-L66` and `#L126-L144` — target settlement boundaries and the G5 unmeasured state.
- `qa/stage-2-reverification.md#L39-L67`; `qa/exploit-register.md#L21-L30` — QA-owned planned cases, risks, and current status.
