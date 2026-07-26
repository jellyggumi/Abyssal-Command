# Resource Reuse and Provenance Gates

run-id: `20260725-defense-rpg-development`

## Reuse policy

1. Reuse the existing runtime GLB/catalog/renderer surfaces first: `assets/defense-asset-manifest.json`, `defense-catalog.js`, `rpg-catalog.js`, `battle-realtime-three.js`, and the passive fallback path. Do not create a parallel asset registry.
2. Preserve the current observer-only rule: a missing mesh, texture, animation, or generated media must leave simulation state and input usable (`_workspace/20260722-defense-survival-expansion/engineering/architecture-contract.md:13-15`).
3. Tier 0.3 pedestal removal is a pipeline correction before new material or commander authoring; the backlog records 54–100% rendered-height spread and 24% inert triangles as the reason (`_workspace/20260725-wellmade-verification/production/improvement-backlog.md:15-17`).
4. Runtime eligibility requires a sidecar with source/provider/model/request ID, observed format/dimensions/hash/path, rights status, and a successful GLB embedding plus browser load/fallback receipt.

## GTI concept provenance

Observed source: `assets/images/battle/pilot/dusk-warden-cartoon-albedo.provenance.json`.

- Requested: PNG, 1024×1024; provider `private-codex`, model `gpt-5.4`, source `god-tibo-imagen`.
- Observed: PNG RGB, 1254×1254, SHA-256 `87e767ddfcb75d8ff2232019540bbae7832dfc2383d71b05133398d6cf529868`, path `assets/images/battle/pilot/dusk-warden-cartoon-albedo.png`.
- Rights: `pending-runtime-rights-review`.
- Runtime: `runtimeEligible: false`; reason states dimensions differ and no GLB re-embedding or runtime load/fallback verification has occurred.

**Decision:** this image is concept/texture-pilot provenance only. It is not shipped art, not a material pass, and not evidence of runtime appearance. Do not wire it into `battle-realtime-three.js` until every gate below has a dated receipt.

## Asset gate checklist

| gate | evidence required | current status |
|---|---|---|
| Identity | unique asset ID, source path, and manifest entry | sidecar exists for GTI pilot; broader reuse must be checked against `assets/defense-asset-manifest.json` |
| Request/observed match | requested format/size equals observed format/size, or explicit approved conversion receipt | **FAIL for GTI pilot:** requested 1024×1024, observed 1254×1254 |
| Rights | rights review complete for provider, prompt, source reference, and distribution | **OPEN:** sidecar says pending |
| Embedding | material/texture embedded in the target GLB with hash and export receipt | **MISSING for GTI pilot** |
| Runtime | browser load, visible material, and text/glyph fallback verified in both WebGL and fallback/reduced-motion paths | **MISSING for GTI pilot** |
| Performance | renderer frame and texture counts remain within the applicable budget after reuse | **MISSING for any new GTI wiring**; latest low-tier baseline p95 24.2 ms / 8.302% long frames |

Generated media may be shown in a concept review, but it cannot be counted as shipped art or as G4 evidence until the gates pass. `_workspace/20260722-defense-survival-expansion/design/presentation-spec.md` likewise requires provenance before GodTiboImagen/Blender/Vox outputs enter runtime and requires a passive fallback.
