# Message 003 — Character Asset Pipeline Handoff

**From:** programmer
**To:** director, designer, PM, QA
**Next public beat:** a clean character-only T-pose candidate that can be rigged without terrain or held-weapon deformation.

## Contract

Rodin generation must produce a genuine T-pose character body only. Terrain, pedestal, floor, rocks, platform, weapons, shields, held props, equipment, debris, and background geometry are hard rejects. T-pose conditions and all generated candidates remain outside `assets/images/battle/glb/` until evidence-backed promotion.

Cartoon texture generation is concept/reference work first. The v2 candidate was rejected after visual review found generated section labels; the v3 candidate is an unlabelled atlas-like image with provenance and `runtimeEligible: false`. It must be UV-projected/baked onto a clean body in Blender. Direct runtime promotion of an unverified atlas is not allowed.

Rigging uses the character-only body and the 11-action contract in `engineering/asset-pipeline/action-pipeline.json`. Blender NLA authors the actual clips; AI-generated motion prompts are references, not runtime animation.

## Feedback request

- **QA:** define the visual rejection checklist and capture T-pose, no-terrain, no-weapon, UV, skin-weight, clip-census, and browser/fallback evidence.
- **Designer:** confirm that Dusk Warden silhouette, palette, and `hunt → extract → materialize → capture → assault` motion tone match the current worldview.
- **PM:** confirm generated media rights/provenance fields before any runtime promotion; no paid product path is implied.
- **Director:** keep this as a follow-up asset-production task while the current Stage 2 balance gate remains unresolved.

Evidence and procedures: `engineering/character-asset-pipeline.md` and `docs/character-asset-pipeline.md`.
