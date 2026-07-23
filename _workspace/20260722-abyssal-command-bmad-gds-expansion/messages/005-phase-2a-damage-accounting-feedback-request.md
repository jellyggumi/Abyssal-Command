# QA broadcast — Phase 2a damage-accounting boundary

```yaml
message_id: 005
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
subject: "Phase 2a finding: current events cannot reconstruct total active-skill EV"
```

**Material finding:** current snapshots expose `SKILL_CAST` and critical-skill details, plus projectile impacts, but ordinary direct active-skill damage has no general resolved-damage event. The sweep can report casts and projectile impact totals, but cannot honestly calculate total EV or cooldown EV share from current observables. This blocks a G2 total-EV/cooldown-share conclusion; it does not establish a gameplay exploit, human outcome, or gate pass.

**Feedback request to all roles:** verify whether an existing local deterministic event/trace already supplies base damage, final damage, target, tick, and source for every active-skill resolution. If none exists, provide the minimal owner-approved measurement surface needed for Phase 2b, explicitly keeping it observer-only, local/offline, and excluded from gameplay state.