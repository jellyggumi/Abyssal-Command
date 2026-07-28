# In-game mesh candidate lane

`ingame-mesh/` is the isolated candidate lane for every replacement web-battle mesh: actors, terrain, props, and VFX. It is not a runtime asset root. The runtime GLB directory remains `assets/images/battle/glb/` and must stay empty until every promotion gate passes.

## Current evidence

- Six candidate GLBs were exported from the current `tpose-conditions` inputs with `scripts/rig-and-animate-asset-blender.py`.
- Each candidate contains 11 authored contract animations and has a `.provenance.json` sidecar with `runtimeEligible: false`.
- The Blender export emitted `Mesh ... is not valid, and may be exported wrongly`; these are candidate artifacts, not accepted production meshes.
- `guard.glb` needs an explicit skin audit: the exported GLB has `skins=0` despite the authoring script completing.
- No cartoon texture was promoted. The first `god-tibo-imagen` attempt for `broken-court-monarch-boss` failed with private Codex HTTP 429.
- Six per-character motion prompt packets (11 actions each) were generated under `characters/animations/` using the current `action-pipeline.json`. No Motion Previs export was produced: `motion-previs-studio` is not installed or present on `PATH`.
- Motion reference pages were captured with Scrapling at `references/mixamo-motion.html` and `references/actorcore-free-motion.html` (both HTTP 200).
- `assets/images/battle/glb/` contained no deployed `.glb` files when checked, so no runtime deletion was performed. The six t-pose condition inputs were preserved.

## Required gates before promotion

1. Complete Rodin GUI/browser handoff and replace condition-derived candidates with authenticated Rodin outputs.
2. Generate per-character cartoon albedo textures with `gti`; attach provenance and apply them only after UV validation.
3. Install/run Motion Previs Studio, ingest the captured motion references, and export keypoint/blender bundles.
4. Retarget/import the Motion Previs output into the deform rig; preserve concept-specific action and skill clips.
5. Re-run mesh, skin, UV, clip, visual, and Three.js runtime QA.
6. Only then issue a runtime receipt and promote into `assets/images/battle/glb/`.

`ingame-mesh.manifest.json` records the six already-exported actor candidates. `web-battle-resource-manifest.json` is the generated complete 56-target registry; regenerate it with `./build-resource-manifest.py` and prove it current with `./build-resource-manifest.py --check`. Neither file may set `runtimeEligible` to `true` manually.
## Generation request packet

The current texture/item/background request packet is `resources/generation-requests.json`. It contains six character texture requests, eight item texture requests, and two environment background requests. `web-battle-resource-manifest.json` extends that scope to each of the 56 runtime assets and classifies item and terrain meshes separately from actor Rodin meshes. Both packets are candidate-only and remain `runtimeEligible: false`; `gti --dry-run` validated the request shape, but the latest live generation attempt returned HTTP 429 and stopped after the first request, so no PNG was produced.
