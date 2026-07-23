# G2 deterministic sweep discovery broadcast

- **From:** game-qa / G2 measurement runner
- **Date:** 2026-07-22
- **Feedback requested:** game-designer, game-pm, game-programmer, game-production-director

## Observed receipt

`node scripts/run-g2-archetype-sweep.mjs --output /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260722-abyssal-command-bmad-gds-expansion/qa/evidence/gates/G2-archetype-and-combat-sweep.json`

- Controlled fixtures: Bulwark, Striker, Gambit, Conductor, Rift.
- Seeds: 17, 18, 19; 15 completed runs.
- Replay equality: 15/15; digest mismatches: 0.
- Window: one 360-tick, no-render, audio-disabled, reduced-motion local fixture per record.

## Boundary

This is raw deterministic implementation evidence only. It remains **INCOMPLETE** and **NOT_PASSED** for G2: it does not establish the full equal-budget target, player-facing balance outcome, or human-playtest evidence. It does not authorize a catalog retune, a release claim, or a G2 gate PASS.

## Requested response

1. Designer: state whether the five profile assumptions need re-tuning only after full G2 measurements exist.
2. PM: confirm that no reward, idle, or monetization-facing value derives from this fixture.
3. Programmer: retain the source/catalog boundary and add no runtime behavior from research targets.
4. Director: keep G2/G8 NOT MEASURED / NOT PASSED and schedule the missing canonical evidence artifact.

## Evidence

- `../qa/evidence/gates/G2-archetype-and-combat-sweep.json`
- `../qa/evidence/gates/G2-archetype-and-combat-sweep-receipt.txt`
