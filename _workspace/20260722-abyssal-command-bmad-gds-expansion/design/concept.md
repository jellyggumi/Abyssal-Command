# Cinder Span Command Feedback — concept

**Stage 1 status:** design contract only. Every target and gate below is **UNVERIFIED / UNPASSED** until a future fixed-seed implementation, capture, and QA evidence exists. This file makes no runtime implementation claim.

## One-sentence concept

A mobile-first, offline defense-survivor asks the player to keep moving through a bounded, seed-authored abyssal stage while automatic combat resolves in deterministic 60 Hz rules; the player's readable decisions are route, timing around available skills, and a three-way run build, not aim or manual targeting.

The Stage 1 validation beat is the **Cinder Span Command Feedback** slice: one **[UNVERIFIED TARGET] 90-second** internal loop in which a player can read threat, player health, W-03 Gate Integrity, critical outcomes, cooldown readiness, a meaningful objective route, and a factual stage-to-Archive handoff.

## Product contract kept intact

- `defense-catalog.js` remains the one authored rules authority. The simulation owns tick order, combat, target selection, critical resolution, cooldowns, offers, extraction, rewards, and stage outcomes.
- Rules run at deterministic 60 Hz. PCG materializes a finite, versioned `MapPlan` before tick 0; it never makes a renderer, audio asset, wall clock, or network response authoritative.
- Presentation is observer-only. Canvas/HUD/VFX/audio/captions/narration may project an already resolved event or snapshot and may never reroll, predict, delay, acknowledge, or mutate it.
- Play remains movement-first automatic combat. There is no manual aim, target choice, command queue, live-service dependency, commerce, account, cloud sync, or background combat.
- Reduced motion preserves the same essential semantic state through static shapes, text, icons, boundaries, and status—not merely by hiding effects.
- Campaign scope is stages 1–10. A Stage 10 boss victory completes the campaign; no design surface may suggest Stage 11.

## The designed promise

| Player question | Designed answer | Evidence needed later |
| --- | --- | --- |
| What can hurt me now? | A world-local, non-color telegraph and stable W-03/player state outrank all flourish. | Fixed-seed hazard captures and comprehension probes. |
| Did my build do something meaningful? | Confirmed skills and criticals have distinct, state-linked feedback; ordinary hits aggregate under density. | Resolution-to-presentation IDs and reduced-motion capture. |
| Where should I move? | The stage's authored objective and Gate route survive a seed's bounded geometry and encounter variation. | `MapPlan` corpus, objective-direction probes, replay hashes. |
| What did I choose and gain? | A maximum of three comparable run choices makes the effect visible before commit; permanent breadth stays active-earned. | Offer/commit/hash chain and comprehension study. |
| Why return after a run? | One active-issued Archive Return Permit may prepare an equal-power sidegrade, but cannot simulate play or earn campaign success. | Clock/save fault suite and parity fixtures. |
| What changed in the world? | Caption-first W-01…W-05 handoff states only a confirmed stage result and existing milestone. | Event-to-beat trace and Stage 10 ending fixture. |

## Vertical-slice hypothesis

1. **Orient.** An authored stage descriptor provides a Domain, objective label, and W-01/W-04 cue. Its seed realizes only bounded spatial and encounter variants.
2. **Commit.** The player moves through a readable lane while automatic attacks resolve. W-03/player health is persistent; avoidable danger remains world-local.
3. **Build.** XP exposes three explicit, run-only choices. A recommended choice, if offered, must explain its build reason and remain optional.
4. **Express.** A resolved skill, cooldown-ready state, or critical uses a distinct semantic projection. It does not become a separate manual-combat system.
5. **Secure.** The objective and authored Gate culminate in a boss/result transition. Stage 1–9 can show an already committed next-stage milestone; Stage 10 is completion only.
6. **Record.** W-05 summarizes existing local state. A post-run Return Permit is one settled, bounded accounting transaction—not an absent-player simulation.

## Core tensions and design decisions

| Tension | Decision |
| --- | --- |
| Spectacle versus survival readability | Reserve attention for telegraph, damage, health/Gate, and boss state; coalesce normal-hit texture first. |
| Variety versus authored purpose | Seed route composition, module choice, encounter cards, and presentation variants only inside authored ranges; objective, Gate, stage order, and ending remain fixed. |
| Return comfort versus movement mastery | Archive credit is capped, local, deterministic, and restricted to active-confirmed equal-power sidegrades. |
| Music/narration atmosphere versus authority | Local BGM/SFX/narration respond to event IDs after resolution. Playback, mute, failure, or timing cannot influence a run. |
| Accessibility versus dense information | Static visual equivalents are the semantic baseline; audio, haptics, and motion reinforce rather than exclusively encode meaning. |

## Stage 1 gate posture

| Gate concern | Current design assertion | Required future evidence | Status |
| --- | --- | --- | --- |
| G1/G8 stage coherence and variety | A finite backbone and bounded encounter/card selection preserve an authored stage promise. | Seed corpus, plan validity, objective-recognition results. | **UNPASSED** |
| G2 health/crit/cooldown truth | Integer rule outputs are observable before feedback. | Forced traces, event-to-feedback joins, state hashes. | **UNPASSED** |
| G4 feedback and movement | Survival signals dominate texture without adding manual aim. | Modal captures, input tapes, comprehension results. | **UNPASSED** |
| G5 fair return/progression | No chance-gated permanent advantage or absent-play completion. | Save/property and 10/20-session parity evidence. | **UNPASSED** |
| G6 choice readability | Three run choices are simultaneously comparable. | Offer semantic snapshots and goal-correct probes. | **UNPASSED** |
| G7 local/offline integrity | Return and telemetry remain local, deterministic, and idempotent. | Network-off, clock, storage, and replay fixtures. | **UNPASSED** |

## Research basis

- `intake/production-brief.md`
- `production/team-roster.md`
- `.survey/abyssal-command-systems-expansion/{context,solutions,triage}.md`
- `research/combat-systems-balance.md`, `research/combat-feedback-controls.md`, `research/vfx-hud-feedback.md`
- `research/pcg-map-grammar.md`, `research/stage-world-procedural.md`, `research/wave-encounter-composition.md`
- `research/progression-rewards-idle.md`, `research/progression-idle-economy.md`
- `research/audio-narration-direction.md`, `research/elevenlabs-integration.md`, `research/narrative-stage-presentation.md`
- `research/controls-accessibility.md`, `research/telemetry-playtest-contract.md`, `research/qa-measurement-protocol.md`
- Current product contract: `_workspace/20260722-defense-survival-expansion/design/gameplay-contract.md`
