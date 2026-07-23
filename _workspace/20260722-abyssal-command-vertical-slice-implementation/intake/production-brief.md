# Abyssal Command vertical-slice implementation — intake brief

- **game_type:** mobile-first, offline single-player defense-survivor campaign with deterministic 60 Hz combat and local post-run return.
- **team_shape:** 15 roles: director; designer, PM, programmer, QA; combat, PCG, wave, economy, audio, sound, VFX, narrative, accessibility, and telemetry specialists.
- **engine:** static browser/PWA; ES modules, Canvas snapshot renderers, local-first persistence.
- **current_stage:** Stage 1 FIX / vertical-slice implementation plus measurement, following `20260722-abyssal-command-bmad-gds-expansion`.
- **operating_mode:** vertical-slice implementation. Build and measure one bounded Cinder Span loop; do not broaden campaign or release scope.
- **next_public_beat:** internal 90-second **Cinder Span Command Feedback** fixture: deterministic map/wave plans, crit/health/cooldown feedback, explicit rewards plus disclosed non-mechanical chance result, local idle-return receipt, and observer-only sound/VFX/narration.
- **source_packet:** the preceding concept-validation run and its research/design/QA artifacts.
- **main_constraint:** `defense-catalog.js` remains the sole authored balance authority; `defense-run-simulation.js` owns deterministic state and events; render/audio/telemetry observe snapshots only. Offline/local, movement-first automatic combat, reduced-motion, fixed 10-stage campaign, and Stage 10 terminality remain intact. No commerce, accounts, network, cloud sync, runtime provider API, or copied content.
- **main_question:** can the bounded slice deliver readable agency and growth while retaining byte-stable fixed-seed outcomes and a no-commerce, idempotent return path?

## Implementation decisions

1. **Combat:** commander `maxIntegrity` preserves the current effective 1000 baseline. Eligible commander attacks use an isolated deterministic crit stream, with a disclosed catalog profile of 1,500 bp chance and 20,000 bp multiplier. Resolved damage/health/cooldown transitions are tick-stamped observer facts.
2. **Rewards:** stage reward choices remain the certain, authored mechanical reward. The optional probability result is disclosed, deterministic, duplicate-free, and non-mechanical; it cannot grant combat stats, progression, companions, extraction, or stage unlocks.
3. **Idle return:** a successful selected terminal reward issues one local permit. Explicit-time settlement is capped at 12 hours and credits a local non-combat Archive counter; a permit settles once and a negative/invalid delta grants zero.
4. **PCG:** pre-tick map plans select only finite catalog modules, preserve existing objective coordinates/routes, use a separate seed stream, and are observer-visible. Wave alternatives are authored equal-budget formations with deterministic anti-repeat selection. No generated plan changes objectives, balance values, or Stage 10.
5. **Presentation:** particles/VFX/audio/narration/HUD observe deterministic event IDs. Procedural Web Audio remains the default; any future ElevenLabs output is reviewed static build input only and is not required by this slice.

## Non-goals

- No gate is declared PASS without generated evidence and independent review.
- No runtime network request, audio provider, credentials, asset-generation workflow, commerce surface, manual aim, or realtime simulation update.
- No new campaign stage, actor archetype, stage objective, proprietary asset, or unbounded procedural generation.
