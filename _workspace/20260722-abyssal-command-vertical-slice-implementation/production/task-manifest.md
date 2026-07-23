# Production Task Manifest — 20260722 Abyssal Command vertical-slice implementation

**Operating mode:** Stage 1 FIX / vertical-slice implementation plus measurement.  
**Public beat:** internal Cinder Span Command Feedback fixture.

| task | owner | stage.phase | artifact / ownership | gate | status | beat |
|---|---|---|---|---|---|---|
| Define immutable combat, reward, PCG, wave, world-link schema | game-designer + combat + PCG + wave | 1a | `defense-catalog.js` | G1/G2/G5/G7/G8 | active | deterministic contract |
| Resolve crit, health, cooldown, map, wave, reward events | game-programmer + combat systems | 1d | `defense-run-simulation.js` | G2/G4/G7 | blocked by schema | truthful events |
| Issue/settle idempotent local idle receipt | game-pm + progression economy | 1d | `campaign-state.js`, `app.js` | G5/G7 | blocked by schema | fair return |
| Project events to VFX, fallback, HUD, audio, narration | VFX + audio + sound + narrative + accessibility | 1d | renderer/audio/cutscene/app surfaces | G1/G4/G6 | blocked by event schema | readable feedback |
| Project local event truth to offline telemetry | telemetry analyst | 1d | `defense-telemetry.js` | G2/G4/G6/G7/G8 | blocked by event schema | evidence-ready slice |
| Add rule, campaign, observer, browser regression coverage | QA team | 1d shadow | affected `tests/` files | G1–G8 | blocked by implementation | deterministic proof |
| Run focused checks and browser/performance measurement | QA + programmer | 1 review | `qa/evidence/` and results | G1/G4/G6/G7 | pending | measured fixture |
| Issue gate review and retrospective | production director | 1 review | `production/gate-reviews/`, `retrospectives/` | G1/G6/G7 | pending | truthful re-entry |

## Ownership and sequencing

1. The catalog schema lands first. It owns all numeric values and allowed finite alternatives.
2. Simulation lands second and defines additive, tick-stamped observer events. It may not consume the existing growth/wave RNG stream for new systems.
3. Persistence, observer, UI, audio, renderer, telemetry, and test lanes consume that fixed contract only.
4. QA broadcasts every observed defect to all roles through `messages/`; no failure is silently converted to a target.
5. This manifest authorizes only the named vertical slice. It does not authorize a release or any G1–G8 PASS claim.
