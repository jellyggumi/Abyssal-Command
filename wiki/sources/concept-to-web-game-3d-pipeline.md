# Source: docs/concept-to-web-game-3d-pipeline.md

**Repo path:** `docs/concept-to-web-game-3d-pipeline.md`
**Introduced:** commit `9e1c03a` (feat(assets): add candidate texture pipeline), merged into this branch at `12c550b`
**Doc date:** 2026-07-28
**Immutability note:** this is a repo-tracked, versioned file — treated as the
immutable source of record via git history; not duplicated into `raw/`.

## Summary

Full 7-phase pipeline spec for Abyssal Surge's Three.js/WebGL character
production: concept image → T-pose image → 3D mesh (Rodin Bridge) → rigging
→ motion animation → audio (ElevenLabs) → runtime integration, with exact
CLI invocations and prompt contracts (positive/negative) for each stage.

Tools named: `god-tibo-imagen` (gti), Blender + Rodin Bridge (Hyper3D Rodin),
Motion Previs Studio v4, Blender Python scripting, ElevenLabs API, Three.js
runtime.

## Synthesis

See [[wiki/concepts/character-3d-asset-pipeline]] for the extracted pipeline
shape, tool table, prompt contracts, and the new scripts this doc's phases
depend on.
