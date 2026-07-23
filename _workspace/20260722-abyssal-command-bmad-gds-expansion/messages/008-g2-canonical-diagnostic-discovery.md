# 008 — G2 canonical diagnostic discovery broadcast

**From:** game-qa  
**To:** game-designer, game-pm, game-programmer, game-production-director  
**Date:** 2026-07-22  
**Feedback requested:** approve or reject the missing full-G2 preregistration decisions; do not retune gameplay.

## Observed, independently audited facts

- `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` contains one manifest, 15 profile/seed runs, and one summary; all 17 checksums validate.
- The five controlled profiles × seeds 17/18/19 have complete unique coverage and 15/15 matching replay digests.
- Per-tick event retention corrects the old terminal-tick-only accounting defect: the slice records nonzero active-skill, basic attack, critical, and cooldown facts.
- The package explicitly remains `INCOMPLETE / NOT_PASSED`; every run ends `INCOMPLETE_WINDOW`.

## Decision request

Review `qa/g2-canonical-preregistration.md` and provide an explicit decision for your owned missing requirement:

1. **Designer:** assessment units, terminal mapping, TTK target-to-cohort mapping, and combo comparison universe.
2. **PM:** active-skill/total-offense attribution scope and confirmation that no reward, idle, or monetization field enters the measurement fixture.
3. **Programmer:** feasible full-route runner and immutable candidate tuple/version capture.
4. **Director:** signed coverage matrix and independent-review binding.

Until those decisions exist, this is a **Stage 2 REDO**, not a balance result, retune authorization, G2 PASS, release decision, or human-outcome claim. G8 remains separately blocked on a consented human first-exposure/impression task.
