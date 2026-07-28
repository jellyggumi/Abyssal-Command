# In-game mesh candidate lane

`ingame-mesh/` is the isolated candidate lane for every replacement web-battle mesh: actors, terrain, props, and VFX. It is not a runtime asset root. The runtime GLB directory remains `assets/images/battle/glb/` and must stay empty until every promotion gate passes.

## Current evidence

- Six candidate GLBs were exported from the current `tpose-conditions` inputs with `scripts/rig-and-animate-asset-blender.py`.
- Each candidate contains 11 authored contract animations and has a `.provenance.json` sidecar with `runtimeEligible: false`.
- The Blender export emitted `Mesh ... is not valid, and may be exported wrongly`; these are candidate artifacts, not accepted production meshes.
- `guard.glb` needs an explicit skin audit: the exported GLB has `skins=0` despite the authoring script completing.
- No cartoon texture was promoted. The first `god-tibo-imagen` attempt for `broken-court-monarch-boss` failed with private Codex HTTP 429.
- A user-requested live retry on 2026-07-28 stopped at the first request (`broken-court-monarch-boss`) with the same private Codex HTTP 429; the receipt is `resources/regeneration-attempt-20260728T133448Z.json`. It attempted 1 asset, generated 0, and preserved `runtimeEligible: false`.

The current texture/item/background request packet is `resources/generation-requests.json`. It contains six character texture requests, eight item texture requests, and two environment background requests. `web-battle-resource-manifest.json` extends that scope to each of the 56 runtime assets and classifies item and terrain meshes separately from actor Rodin meshes. Both packets are candidate-only and remain `runtimeEligible: false`. The input-conditioned 2048×2048 Stillwater albedo request received HTTP 429, but `gti --provider auto` produced a 1254×1254 concept plate at `textures/props/stillwater-hourglass-concept.png`; it still needs UV projection/bake and a power-of-two atlas before embedding. The Sunken Bastion terrain request produced no PNG because the `auto` fallback could not spawn `codex`; its exact blocker is recorded beside the lane. `stillwater-hourglass-texture-generation-attempt.json`, `sunken-bastion-texture-generation-attempt.json`, and the item provenance sidecar carry the exact evidence.
The prior full-packet retry is recorded in `resources/regeneration-attempt-20260728T130457Z.json`: it stopped after the first private Codex HTTP 429, with 1/16 attempted and 0/16 generated. The latest single-asset retry also stopped at the first HTTP 429; no character texture, item texture, or background resource was promoted or written to a runtime asset path.
- Six per-character motion prompt packets (11 actions each) were generated under `characters/animations/` using the current `action-pipeline.json`. No Motion Previs export was produced: `motion-previs-studio` is not installed or present on `PATH`.
- Motion reference pages were captured with Scrapling at `references/mixamo-motion.html` and `references/actorcore-free-motion.html` (both HTTP 200).
- `assets/images/battle/glb/` contained no deployed `.glb` files when checked, so no runtime deletion was performed. The six t-pose condition inputs were preserved.
- A blank-scene Blender build produced 23 procedural GLB candidates: seven terrain backgrounds, six VFX meshes, five reward props, and five distinct equipment-tier meshes. Their sidecars explicitly mark them `not-a-baseline-replacement`: material-only output without albedo atlases, visual-fidelity QA, or runtime receipts.
- Browser runtime smoke fetched every one of the 56 GLB URLs declared by `scripts/defense-runtime-assets.mjs`: all 56 returned HTTP 404. No battle mesh can load, so the current browser runtime is non-functional. See `runtime-asset-smoke.json`.

## Required gates before promotion

1. Complete Rodin GUI/browser handoff and replace condition-derived candidates with authenticated Rodin outputs.
2. Generate per-character cartoon albedo textures with `gti`; attach provenance and apply them only after UV validation.
3. Install/run Motion Previs Studio, ingest the captured motion references, and export keypoint/blender bundles.
4. Retarget/import the Motion Previs output into the deform rig; preserve concept-specific action and skill clips.
5. Re-run mesh, skin, UV, clip, visual, and Three.js runtime QA.
6. Only then issue a runtime receipt and promote into `assets/images/battle/glb/`.

`ingame-mesh.manifest.json` records the six already-exported actor candidates. `web-battle-resource-manifest.json` is the generated complete 56-target registry; regenerate it with `../scripts/build-resource-manifest.py` and prove it current with `../scripts/build-resource-manifest.py --check`. Neither file may set `runtimeEligible` to `true` manually.
## Generation request packet

The current texture/item/background request packet is `resources/generation-requests.json`. It contains six character texture requests, eight item texture requests, and two environment background requests. `web-battle-resource-manifest.json` extends that scope to each of the 56 runtime assets and classifies item and terrain meshes separately from actor Rodin meshes. Both packets are candidate-only and remain `runtimeEligible: false`. The input-conditioned 2048×2048 Stillwater albedo request received HTTP 429, but `gti --provider auto` produced a 1254×1254 concept plate at `textures/props/stillwater-hourglass-concept.png`; it still needs UV projection/bake and a power-of-two atlas before embedding. The Sunken Bastion terrain request produced no PNG because the `auto` fallback could not spawn `codex`; its exact blocker is recorded beside the lane. `stillwater-hourglass-texture-generation-attempt.json`, `sunken-bastion-texture-generation-attempt.json`, and the item provenance sidecar carry the exact evidence.
