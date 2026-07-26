# Production Brief — T-pose Rigging and Animation

run-id: `20260726-tpose-rig-animation`  
director: `2026-07-26`  
operating mode: **Stage 3 resource/animation verification and repair**

| field | value |
|---|---|
| game_type | Mobile-first single-player 2.5D/WebGL defense-survivor RPG |
| team_shape | Solo operator with file-based executor, QA, and verification passes |
| engine | Vanilla JavaScript + Three.js WebGL; Blender CLI pipeline; deployed GLB assets |
| current_stage | Stage 3 re-entry: resource integrity and animation readiness |
| next_public_beat | All shipped characters load from a verified T-pose-compatible rig with required gameplay clips; live renderer proof records real mesh/clip behavior |
| source_packet | `20260725-hourly-coreloop-development` Bind slice; current `assets/images/battle/glb/`; existing rig pipeline and contract tests |
| main_constraint | Modify generated GLBs only through the existing source/pipeline path; audit first, preserve runtime asset IDs and all clips; no placeholder or still-image substitution for animation |
| main_question | Which deployed character GLBs are not in a safe T-pose-compatible bind pose or lack the action library, and can the existing Blender rig pipeline repair them without degrading rigs, clip names, or runtime loading? |

## Gate scope

- **G4:** measure only resource/animation readiness; this cycle cannot claim human immersion scoring.
- **G6:** require real GLB load, skin/clip integrity, and no runtime asset-path regression.
- **G1/G2/G3/G5/G7/G8:** unchanged unless an asset change demonstrably affects their measurements.
