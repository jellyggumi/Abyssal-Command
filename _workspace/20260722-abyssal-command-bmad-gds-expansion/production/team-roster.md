# Expanded studio roster — 15 roles (3× base harness)

| # | role | ownership | active research output |
|---:|---|---|---|
| 1 | game-production-director | operating mode, arbitration, gates | production brief, manifest, gate review |
| 2 | game-designer | core loop, system cohesion | design package |
| 3 | game-pm | fair reward rhythm, return value | PM package |
| 4 | game-programmer | deterministic architecture, runtime boundaries | engineering/ops package |
| 5 | game-qa | gates, exploit and regression evidence | QA package |
| 6 | combat-systems-designer | health, critical, cooldown and EV balance | research/combat-systems-balance.md |
| 7 | pcg-level-architect | bounded procedural map grammar | research/pcg-map-grammar.md |
| 8 | wave-encounter-designer | wave patterns, composition and anti-boredom pacing | research/wave-encounter-composition.md |
| 9 | progression-economy-designer | growth and idle-return fairness | research/progression-idle-economy.md |
| 10 | audio-systems-engineer | ElevenLabs API integration and offline delivery boundary | research/elevenlabs-integration.md |
| 11 | sound-music-director | BGM, SFX, cue hierarchy and narration plan | research/audio-narration-direction.md |
| 12 | vfx-technical-artist | effects, health/crit/cooldown feedback, reduced motion | research/vfx-hud-feedback.md |
| 13 | narrative-cinematic-director | world-state, stage/Boss/player narration | research/narrative-stage-presentation.md |
| 14 | ux-accessibility-controls-designer | micro-controls, input, haptics, accessibility | research/controls-accessibility.md |
| 15 | telemetry-playtest-analyst | instrumentation and experiments | research/telemetry-playtest-contract.md |

## Authority boundaries

Audio/VFX/narration and renderers only observe deterministic simulation events. ElevenLabs output is a pre-generated, versioned build asset after consent/licensing review; it must not be a required live API call during gameplay. PCG chooses only from catalog-authored seeds, ranges, and mappings; it never changes simulation-owned event ordering or reward outcomes.
