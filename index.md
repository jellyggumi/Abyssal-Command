# Index

This is the content-oriented map of the wiki. Read this file first before broad search.

## Overview

- Current release evidence covers the three-stage mesh-first runtime and the 11-asset natural rest-pose motion library.
- Combat is an always-area model: every contact resolves as a disc weighted by distance, source weight, element matchup and duration (`wiki/concepts/attack-pattern-presets-and-ai-response.md`).
- Stage maps are authored code under a load-bearing validator, not editor scenes; the composition pipeline and its prompts live in `wiki/concepts/stage-map-composition-pipeline.md` and `prompts/approved/`.
- Presentation is budget-bound: a 40-slot transient VFX pool with per-family caps, silhouette-derived motion speed, per-stage camera clamps, and render-space-only knockback (`wiki/concepts/runtime-presentation-and-arrival-choreography.md`).
- Enemy arrival is still a serial edge column, and the graded-arrival hook the renderer already reads (`ENEMY_SPAWNED.grade` / `.telegraphTicks`) is never emitted — the open work is tracked in `prompts/approved/11-arrival-choreography.md`.
- Difficulty is authored as a clear budget and a response-type count, never as an HP multiplier; the doctrine, the gate thresholds and the 20 variation axes live in `wiki/concepts/stage-difficulty-and-system-variation.md` and are enforced by `tests/stage-variation-doctrine.test.mjs`.

## Sources
<!-- SOURCES:START -->
- [2026-07-30 motion generation + encounter pattern research](wiki/sources/2026-07-30-motion-generation-and-encounter-pattern-research.md)
- [2026-07-31 stage map / 3D dungeon / stage composition skill catalog](wiki/sources/2026-07-31-stage-map-composition-skill-catalog.md)
- [2026-07-31 game 3D VFX / animation / cinematic skill catalog](wiki/sources/2026-07-31-game-vfx-animation-cinematic-skill-catalog.md)
- [2026-07-31 stage pattern / difficulty / system diversification skill catalog](wiki/sources/2026-07-31-stage-pattern-difficulty-system-variation-skill-catalog.md)
<!-- SOURCES:END -->

## Entities
<!-- ENTITIES:START -->
<!-- ENTITIES:END -->

## Concepts
<!-- CONCEPTS:START -->
- [Motion generation for runtime rigs](wiki/concepts/motion-generation-for-runtime-rigs.md) — method comparison, retarget pipeline, prompt templates
- [Attack-pattern presets and AI response](wiki/concepts/attack-pattern-presets-and-ai-response.md) — three-phase steps, presets, evade/spread/brace/punish
- [Stage map composition pipeline](wiki/concepts/stage-map-composition-pipeline.md) — band grid, the executable map contract, tool verdicts, seven-step pipeline
- [Runtime presentation and arrival choreography](wiki/concepts/runtime-presentation-and-arrival-choreography.md) — pool budgets, contact feel, motion/camera envelopes, the arrival gap, ten-step pipeline
- [Stage difficulty and system variation](wiki/concepts/stage-difficulty-and-system-variation.md) — clear budget, wave doctrine, archetype answers, depth packages, the 20-axis monotony ratchet, gate thresholds
<!-- CONCEPTS:END -->

## Queries
<!-- QUERIES:START -->
<!-- QUERIES:END -->

## Reports
<!-- REPORTS:START -->
- [2026-07-29 natural rest-pose motion library](wiki/reports/2026-07-29-natural-rest-pose-motion-library.md)
<!-- REPORTS:END -->
