# QA test plan

## Archetype rotation (minimum five)

| archetype | distinct strategy | expected diagnostic |
|---|---|---|
| Gatekeeper | ward/integrity choices, holds close to Gate | tests breach pressure |
| Hunter | single-target damage, pursues elite | tests boss/elite TTK |
| Collector | pickup radius/area clear, field circulation | tests growth cadence |
| Skirmisher | mobility/cooldown, crosses flanks | tests path and input clarity |
| Generalist | balanced offers, conservative movement | baseline win-rate |

## Required checks
1. Determinism: identical seed/input produces an identical terminal state and event sequence.
2. Regression: item collection, growth selection, elite extraction, reward persistence, save/restore, renderer fallback.
3. UX: 44px primary hit targets; first-three growth-card comprehension; no combat-center HUD occlusion.
4. Narrative: audit player-visible catalog strings/effects against W-01…W-05.
5. Presentation: five scored scenes; reduced-motion variants; effect feedback spot checks; confirm a stage-entry cutscene renders from `STAGE_STARTED`, is dismissible, and leaves input usable.
6. Exploit: combo matrix and pathing issues go into `exploit-register.md`; S1 blocks every gate.


No gate is marked PASS without command/session evidence in `gate-measurements.md`.