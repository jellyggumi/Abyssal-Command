# Character 3D asset pipeline

**Type:** concept — production pipeline
**Source doc:** [[wiki/sources/concept-to-web-game-3d-pipeline]] (`docs/concept-to-web-game-3d-pipeline.md`)
**Related:** `docs/character-asset-pipeline.md` (validated-lane process for the same output)

Entity: [[wiki/entities/abyssal-surge]]

## Pipeline shape

```
Concept art (gti) → T-pose refstyle (gti) → UV atlas texture sheet (gti)
  → T-pose blockout mesh (Blender, scripts/tpose_blockout.py)
  → 3D mesh via Rodin Bridge (BoundingBox ControlNet, body-only contract)
  → candidate lane + provenance JSON → cartoon texture bake (per-mesh UV, not shared tile)
  → rigging (deform-only skeleton, Rigify DEF- naming, T-pose rest, ≤12° deviation)
  → 11 authored action clips → motion via Motion Previs Studio → Blender NLA
  → audio (ElevenLabs TTS/SFX/BGM) → Three.js GLB runtime integration (state-machine playback)
```

Tool ownership is fixed per CLAUDE.md §3 — never improvise a generator:

| Asset class | Tool |
|---|---|
| Concept art, textures, UV atlases, terrain/character/prop plates | `god-tibo-imagen` (`gti`) |
| 2D sprites / sprite sheets | `perfectpixel` (`ppgen`) |
| Story/scenario/episode script | `webtoon-harness` agent teams |
| 3D mesh from concept | Blender + Rodin Bridge |

## Rodin prompt contract (absolute)

**Positive:** game-ready humanoid, genuine T-pose, body only.
**Negative:** terrain, floor, pedestal, rocks, platform, weapon, shield,
held prop, equipment, debris, background geometry, text/logo/watermark.

Because Rodin refuses weapons/props/terrain inside the character mesh, every
non-body element needs its own separate concept plate before mesh generation
— this is what `scripts/separate-concept-layers.py` exists to produce (see
below).

## 11 authored action clips (absolute contract)

`idle`, `move`, `run`, `hit`, `bighit`, `attack`, `critical`, `avoid`,
`defence`, `die`, `show` — each with defined signature poses and keyframe
budget (42–120 frames). Cross-fade transitions: 8-frame default, 2–18 frame
range, contact/recovery-boundary only.

## Candidate-lane discipline

Every stage writes into `_workspace/<run-id>/engineering/asset-pipeline/`
candidate subdirectories (`rodin-candidates/`, `texture-candidates/`,
`rig-candidates/`) with an adjacent `.provenance.json`
(`runtimeEligible: false` until an explicit audit promotes it). Runtime
lanes are never written to directly.

## New pipeline scripts (2026-07-28 merge, texture-pipeline commits)

| Script | Purpose |
|---|---|
| `scripts/freeze-character-scale.py` | Freezes each shipped character's height from its *pre-regeneration* GLB (read via git tag, not restored to tree) so a full asset regen can't silently reset scale to a generic 1.8m default. Shoulder width is deliberately re-measured from new art, not frozen. |
| `scripts/measure-character-plates.py` | Measures separated concept plates into a metrics JSON Blender can consume — runs under system Python (with Pillow/numpy) because Blender's bundled Python lacks Pillow and the pipeline avoids mutating the Blender install. |
| `scripts/separate-concept-layers.py` | Splits one concept illustration into N separate in-game layer plates (character/weapon/prop/terrain), each with alpha + provenance. Two modes: `key` (deterministic flood-fill from a keyable magenta/white background, free) and `gen` (generative re-render per layer via `gti`, for non-keyable full-bleed scenes like terrain). |
| `scripts/run-concept-layer-batch.py` | Drives `separate-concept-layers.py` across the whole concept lane; classifies by concept id (`terrain-*` → terrain, known ids → prop, else → character/weapon/accessory). Runs the free deterministic pass to completion for every asset before any paid model call, and resumes from `batch-state.json` instead of re-billing finished work. |
| `scripts/qa-textured-candidates.mjs` | Candidate-only browser QA for UV-baked procedural GLBs; hosts `privacy.html` (not `index.html`) deliberately, since the production entry point owns the renderer/RAF loop and a second WebGL test renderer there would be non-deterministic. |

## Per-character albedo bake (replaces shared detail-tile approach)

Bakes directly onto each mesh's actual UV unwrap instead of a shared detail
tile × per-character `baseColorFactor`: rasterize triangles into UV space,
build a 4-band shadow/body/lit/rim from the existing `baseColorFactor` as mid
anchor, multiply in shared detail grain at low amplitude, dilate 12 texels
past island edges (mipmap/filter seam safety), then reset
`baseColorFactor` to `[1,1,1,1]` to avoid double-tinting.

## Cross-references

- `docs/concept-to-web-game-3d-pipeline.md` — full 7-phase spec with prompts
- `docs/character-asset-pipeline.md` — validated-lane process doc
- CLAUDE.md §3 — asset generation tool-per-class table (operating rule)
