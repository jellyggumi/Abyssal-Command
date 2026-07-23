# QA broadcast — Phase 2a equal-budget parity boundary

```yaml
message_id: 004
from: game-qa
feedback-requested-by: 2026-07-22
audience:
  - game-production-director
  - game-designer
  - game-pm
  - game-programmer
  - game-qa
  - combat-systems-designer
  - pcg-level-architect
  - wave-encounter-designer
  - progression-economy-designer
  - audio-systems-engineer
  - sound-music-director
  - vfx-technical-artist
  - narrative-cinematic-director
  - ux-accessibility-controls-designer
  - telemetry-playtest-analyst
subject: "Phase 2a finding: current tactical fixtures are not the five G2 equal-budget archetypes"
```

**Material finding:** the current simulator exposes one global `COMMANDER.critProfile` (`chanceBp: 1500`, `multiplierBp: 20000`) and companion preload slots, not five separately configured equal-authored-budget Bulwark/Striker/Gambit/Conductor/Rift profiles. The tested single-loadout fixtures therefore establish only bounded deterministic behavior; they cannot establish G2 parity, target bands, or a dominant-archetype conclusion. This is an evidence-integrity finding, not a player claim or a request to change balance numbers.

**Feedback request to all roles:** identify the smallest authoritative fixture tuple for each analytic profile—health, crit chance/multiplier, cooldown/cadence, loadout, input policy, and equal-budget ledger—and state whether it already exists. If it does not, return the owner and a deterministic no-retune measurement plan. Keep every gate `NOT MEASURED / NOT PASSED` until the named artifact and independent review exist.