# NPR Toon Render Specification

**Scope:** Non-photorealistic rendering upgrade for Abyssal Surge battle presentation  
**Renderer:** `battle-realtime-three.js` (WebGL2 snapshot-only adapter)  
**Fallback:** `battle-visualizer.js` (Canvas2D)  
**Constraint:** Renderer must never write back into simulation state or affect `getRunDigest()` [OBSERVED from project context]

---

## 1. Half-Lambert Quantization & Cel Shading

### 1.1 Current Implementation [OBSERVED]

**File:** `battle-realtime-three.js`  
**Lines:** 831–881

- `celRampPolicy: "runtime-lighting"` [OBSERVED L832] — banding deferred to renderer, not baked into textures
- `CEL_SHADOW_BANDS = 3` [OBSERVED L842]
- `celGradient()` (L845–859): creates a 1D `THREE.DataTexture` (3×1, RedFormat) [OBSERVED]
  - `steps[0] = 70`   (shadow band)
  - `steps[1] = 163`  (mid-tone band, rounded from 162.5)
  - `steps[2] = 255`  (light band)
  - Formula: `Math.round(70 + (185 * index) / (CEL_SHADOW_BANDS - 1))` [OBSERVED L851]
  - Filtering: `THREE.NearestFilter` (min/mag) [OBSERVED L854–855] — produces hard band edges
- `toonMaterial()` (L861–881): converts materials to `THREE.MeshToonMaterial`
  - **Gradient injection point:** `gradientMap: celGradient()` [OBSERVED L877]
  - Preserves: `color`, `map`, `normalMap`, `normalScale`, `emissive`, `emissiveMap`, `emissiveIntensity`, `alphaMap`, `transparent`, `opacity`, `alphaTest`, `side` [OBSERVED L864–876]
  - Stores metadata: `userData.celShadowBands = 3` [OBSERVED L879]

### 1.2 Half-Lambert Formula [TARGET]

THREE.js `MeshToonMaterial` internally implements:

```glsl
float halfLambert = (dot(normal, lightDirection) + 1.0) / 2.0;
float quantized = texture2D(gradientMap, vec2(halfLambert, 0.5)).r / 255.0;
```

- **N·L remapping:** `(N·L + 1) / 2` maps `[-1, 1]` → `[0, 1]` [INFERENCE from MeshToonMaterial behavior]
- **Quantization:** nearest-neighbor lookup into the 3-texel ramp [OBSERVED L854–855]
- **Result:** 3 discrete intensity levels (70/255 ≈ 0.275, 163/255 ≈ 0.639, 255/255 = 1.0) [INFERENCE from observed values]

### 1.3 Band Threshold Values [TARGET]

With 3 bands and nearest filtering, the implicit thresholds fall at texel boundaries:

- **Shadow band (70/255):** `halfLambert ∈ [0.00, 0.33)`
- **Mid-tone band (163/255):** `halfLambert ∈ [0.33, 0.67)`
- **Light band (255/255):** `halfLambert ∈ [0.67, 1.00]`

No smoothstep applied — `NearestFilter` produces instantaneous transitions [OBSERVED L854–855].

### 1.4 Per-Stage Palette Integration [INFERENCE]

Comment block (L831–837) states: *"a baked ramp would fight the per-stage palette"* [OBSERVED]. The runtime 3-band quantization preserves the ability to modulate `material.color` per stage without re-authoring textures.

---

## 2. Outline Strategy

### 2.1 Decision: Inverted Hull (Vertex Normal Expansion) [TARGET]

**Rationale [INFERENCE from observed constraints]:**

1. **Canvas2D fallback compatibility:** `battle-visualizer.js` is a Canvas2D adapter [OBSERVED from project context]. A depth-normal Sobel post-pass requires fragment shaders and framebuffer access, unavailable in Canvas2D. Inverted hull works in both renderers (WebGL draws a backface-culled shell; Canvas2D can stroke geometry or skip outlines entirely).

2. **Renderer structure:** No observed post-processing pipeline in `battle-realtime-three.js` [OBSERVED from L1430–1530 scan: scene setup, fog, lights, groups — no `EffectComposer`, `RenderPass`, or post-FX infrastructure]. Adding a Sobel pass would require:
   - Off-screen render targets
   - Depth/normal pre-pass
   - Full-screen quad + custom ShaderMaterial
   - Integration points in the render loop (not observed)

3. **Asset pipeline alignment:** The existing `scripts/apply-cartoon-texture-blender.py` [OBSERVED from project context] already operates on geometry; vertex-color stamping for outline control fits naturally into that Blender-export step.

### 2.2 Implementation Parameters [TARGET]

**Vertex Shader Expansion:**

```glsl
vec3 expandedPosition = position + normal * outlineThickness * vertexColor.r;
```

- **`outlineThickness` (uniform):** base width in world units, modulated by:
  - **Vertex color R channel:** per-vertex thickness multiplier (ILM mask, §3.3)
  - **Camera distance scaling:** `outlineThickness *= mix(1.0, 0.4, smoothstep(minDist, maxDist, cameraDistance))`
    - `minDist = MIN_ORBIT_DISTANCE` [OBSERVED L1454]
    - `maxDist = MAX_ORBIT_DISTANCE` [OBSERVED L1455]
    - Prevents outline aliasing at max zoom-out while preserving detail at close range [INFERENCE]

**Material Properties:**

```javascript
new THREE.MeshBasicMaterial({
  color: 0x000000,  // or per-character accent color
  side: THREE.BackSide,  // render only back faces (front faces culled)
  depthWrite: true,
  depthTest: true,
})
```

- **Vertex color channels:**
  - **R:** thickness scale `[0, 1]` → suppress outlines on interior edges, emphasize silhouettes [TARGET]
  - **G:** alpha modulation `[0, 1]` → fade outlines for translucent/ephemeral VFX [TARGET]
  - **B:** discontinuity cut flag `{0, 1}` → force hard edge at UV seams / material boundaries [TARGET]

### 2.3 Rendering Order [TARGET]

1. Clear depth/color buffers
2. **Outline pass:** draw inverted hulls (BackSide) with expanded vertex positions
3. **Toon-shaded pass:** draw front-facing geometry (FrontSide) with `MeshToonMaterial`
4. **Additive VFX pass:** projectiles, emissives, particles (existing) [OBSERVED L1032–1039]

---

## 3. ILM Mask & Asset Pipeline

### 3.1 Mask Texture Specification [TARGET]

**Format:** RGBA, 8-bit per channel, same UV layout as albedo map  
**Channels:**

- **R: Specular Mask** `[0, 1]`
  - 0 = fully diffuse (cloth, matte surfaces)
  - 1 = specular highlights allowed (metal, wet surfaces)
  - Modulates `MeshToonMaterial.specular` intensity (if specular term added; current impl has none [OBSERVED L863–878])

- **G: Shadow Receive** `[0, 1]`
  - 0 = reject all shadows (emissive elements, force-lit details)
  - 1 = full shadow participation
  - Lerp between lit and shadowed gradient-map lookups: `mix(litBand, shadowBand, shadowReceive * shadowTerm)`

- **B: Outline Thickness Bias** `[0, 1]`
  - 0 = suppress outline (interior faces, soft transitions)
  - 1 = maximum outline width (silhouette edges, hard corners)
  - Feeds vertex color R channel (§2.2)

- **A: Rim Suppression** `[0, 1]`
  - 0 = full rim-light contribution (hair, shoulders, silhouette accents)
  - 1 = zero rim-light (faces, concave regions where rim is implausible)
  - Modulates `rimLight` intensity in fragment shader [INFERENCE; rimLight observed L1464–1468]

### 3.2 Albedo-Baked AO & Curvature [TARGET]

**Current state [OBSERVED L835–836]:**  
> *"23 of 24 characters carry no albedo art at all, only a shared 256 px detail tile times one baseColorFactor"*

**Target pipeline:**

1. **Ambient occlusion:** bake into albedo RGB as a multiply (0.3–1.0 range recommended) — darkens crevices, preserves toon-flat appearance without runtime SSAO cost
2. **Curvature accents:** paint subtle value shifts (±10%) on convex edges (lighter) and concave seams (darker) — guides the viewer's eye without fighting the cel bands
3. **Detail tile reuse:** preserve the existing 256 px shared tile where appropriate; overlay character-specific AO/curvature as a second multiply layer in Blender export

### 3.3 UV Texel Density & Straightening Rules [TARGET]

**Density target:** 512 px/meter for primary characters, 256 px/meter for background NPCs and stage props  
**Motivation:** Outlines are vertex-based (§2.2); if UVs are warped/compressed, the ILM mask's outline-thickness map will exhibit stretching. Straightened UVs minimize this artifact.

**Straightening pass (in Blender):**

1. Auto-unwrap with `Angle Limit = 66°`, `Island Margin = 0.02`
2. **Manual straightening:** select long edges (limbs, cylindrical forms), `U → Follow Active Quads`
3. Pack with `Average Island Scale` enabled
4. Validate: select all UVs, open UV Editor's `Display Stretching` (set to `Area`), reject islands with >30% red distortion

**UV seam placement:**

- Align seams with natural occlusion boundaries (under arms, back of legs, hairline) so outline discontinuities (vertex color B = 1) are visually motivated
- Avoid seams on facial features or primary silhouette edges

---

## 4. Migration Checklist

### 4.1 Remaining MeshStandardMaterial → MeshToonMaterial [OBSERVED]

The following still use `THREE.MeshStandardMaterial` and must be converted:

| Object | Line(s) | Current Properties | Migration Notes |
|--------|---------|-------------------|-----------------|
| `gateMesh` | 1475–1477 | `color: COLORS.gate`, `emissive: COLORS.gate`, `emissiveIntensity: 0.6`, `roughness: 0.3` | [OBSERVED] Emissive preserved by `toonMaterial()` (L869–871); roughness dropped (toon shading has no roughness parameter). Convert via `toonMaterial()` or use `MeshBasicMaterial` if purely emissive. |
| `pressureLane` | 1494–1505 | `color: STAGE_PALETTE_TINTS["cinder-span"]`, `emissive`, `emissiveIntensity: 0.85`, `transparent`, `opacity: 0.34`, `side: DoubleSide`, `depthWrite: false` | [OBSERVED] Transparent emissive overlay. Candidate for `MeshBasicMaterial` (like projectiles L1032–1039) since it has no lighting-dependent shading. |
| `pressureArrow` | 1506–1515 | `color: COLORS.pickup`, `emissive`, `emissiveIntensity: 1.2`, `roughness: 0.25`, `depthWrite: false` | [OBSERVED] Same reasoning as `pressureLane`. |
| `pressureTargetRing` | 1517–1526 | `color: COLORS.pickup`, `emissive`, `emissiveIntensity: 1.2`, `roughness: 0.25`, `depthWrite: false` | [OBSERVED] Same reasoning as `pressureLane`. |

### 4.2 Actor & Terrain Materials [INFERENCE]

- **Actors:** converted via `applyCelShading()` (L883–894), which traverses the loaded GLTF and wraps all materials in `toonMaterial()` [OBSERVED L888]
- **Terrain:** not explicitly observed in the scanned ranges; assume same `applyCelShading()` traversal applies to `terrainGroup` (L1470)

### 4.3 Projectiles [OBSERVED]

- **Already `MeshBasicMaterial`** (L1032–1039) with `AdditiveBlending` [OBSERVED L1038]
- **Action:** None required; additive VFX should remain unlit for intentional glow effect [INFERENCE]

### 4.4 Environment Map [OBSERVED]

- `scene.environment = this.environmentTexture` (L1444) [OBSERVED]
- `MeshToonMaterial` does **not** use environment maps (no IBL reflections) [INFERENCE from THREE.js docs]
- **Action:** Verify `this.environmentTexture` disposal still occurs (GPU resource leak risk if retained but unused). Consider removing `buildEnvironmentMap()` call (L1443) if no materials consume it post-migration.

---

## 5. Open Risks

### 5.1 Canvas2D Fallback Parity [INFERENCE]

**Risk:** `battle-visualizer.js` cannot implement inverted hull outlines or gradient-map cel shading.  
**Mitigation [TARGET]:**

- Outlines: stroke geometry with `ctx.lineWidth` proportional to zoom, or omit entirely (acceptable degradation)
- Cel shading: quantize diffuse term in JavaScript: `intensity = Math.floor((nDotL + 1) / 2 * CEL_SHADOW_BANDS) / CEL_SHADOW_BANDS`, then fill with discrete color steps
- **Acceptance criterion:** Canvas2D must produce a recognizably toon-styled image, not pixel-identical to WebGL

### 5.2 Performance — Outline Double-Draw [INFERENCE]

**Risk:** Drawing every character twice (hull + front) doubles vertex throughput.  
**Measured baseline:** Not observed in scanned files.  
**Mitigation [TARGET]:**

- Batch outline meshes into a single draw call per material (instancing if vertex data allows)
- Cull outline pass for distant/off-screen actors (frustum culling already in place [INFERENCE])
- Profile on target hardware (Steam Deck, low-end laptop) before/after migration

### 5.3 ILM Mask Authoring Cost [TARGET]

**Risk:** 23 of 24 characters have no albedo textures [OBSERVED L835–836]; generating ILM masks + AO-baked albedo for the full cast is a multi-week art task.  
**Phasing [TARGET]:**

1. **Phase 1 (this spec):** Convert renderer; generate procedural default ILM masks (all channels = 0.5) so existing characters render with uniform outlines/shading
2. **Phase 2 (art sprint):** Hand-paint ILM masks + AO for hero characters (player unit + 3–5 story bosses)
3. **Phase 3 (fill):** Batch-generate masks for background enemies using Blender's curvature/AO bake, manual cleanup only where artifacts are severe

### 5.4 `getRunDigest()` Invariance [OBSERVED]

**Constraint:** Renderer must not affect simulation determinism.  
**Verification [TARGET]:**

- After migration, run `node --test 'tests/**/*.test.mjs'` (regression suite) [OBSERVED from project context]
- Confirm no `getRunDigest()` mismatches in replay tests
- **Implementation discipline:** All toon/outline state lives in `battle-realtime-three.js` presentation layer; simulation code (battle state, entity updates) remains untouched

### 5.5 Gradient Map Disposal [INFERENCE]

**Risk:** `celGradientMap` (L843) is created once and cached globally. If multiple `BattleRealtimeThree` instances exist concurrently (e.g., PvP spectator mode, split-screen), the single shared texture is correct. If instances are created/destroyed (session churn), verify the texture is disposed when the last referencing renderer is torn down.  
**Action [TARGET]:** Audit `BattleRealtimeThree.dispose()` (not observed in scanned ranges) to ensure `celGradientMap.dispose()` is called, or accept the small one-time 3-byte leak as negligible.

---

## 6. References

- **Observed file:** `battle-realtime-three.js`
  - Cel gradient: L831–859
  - `toonMaterial()`: L861–881
  - `applyCelShading()`: L883–894
  - `projectileMaterial()`: L1032–1039
  - Stage props (MeshStandardMaterial): L1475–1526
  - Orbit distance constants: L1454–1455
  - Rim light: L1464–1468

- **Project context:**
  - Canvas2D fallback: `battle-visualizer.js` [OBSERVED from pre-grounded facts]
  - Cartoon texture pipeline: `scripts/apply-cartoon-texture-blender.py` [OBSERVED from pre-grounded facts]
  - Renderer invariant: never write to simulation state or affect `getRunDigest()` [OBSERVED from project context]

---

**Status:** [TARGET] specification — implementation pending  
**Next steps:** Review with rendering + art leads, approve phasing plan (§5.3), implement Phase 1 (renderer conversion + procedural ILM defaults)
