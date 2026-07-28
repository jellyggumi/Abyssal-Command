# Blender Procedural VFX Specification

**Run:** `20260726-stage1b-cinder-pressure-agency`  
**Lane:** Engineering  
**Status:** [TARGET] Draft specification for procedural slash-trails, toon explosions, and lightning VFX  
**Dependencies:** `scripts/export-battle-glb.py` [OBSERVED], `battle-realtime-three.js` runtime [OBSERVED], geometry-nodes workflow

---

## 1. Simulation-Zone Slash-Trail Node Algorithm

**[TARGET]** The slash-trail effect captures weapon tip/base vertex positions per frame and generates a swept ribbon mesh with age-based decay, using Blender's Geometry Nodes Simulation Zone.

### Node Graph Build Steps (ordered)

1. **Capture Weapon Vertex Positions**
   - Input: Named Empty objects `weapon_tip` and `weapon_base` parented to weapon armature
   - Node: `Self Object` + `Object Info` → get global transforms
   - Node: `Invert Matrix` (parent armature object) → convert to local space
   - Node: `Transform Geometry` → apply inverse matrix to tip/base Empty positions
   - Output: Per-frame local-space point positions

2. **Simulation Zone: Point Cloud with Frame History**
   - Node: `Simulation Zone` (input/output pair)
   - Node: `Join Geometry` → merge new frame points with previous zone output
   - Node: `Store Named Attribute` → write frame index as `curve_index` (integer)
   - Node: `Store Named Attribute` → initialize `Age` = 0 for new points, increment by 1 for existing

3. **Curve Index Offset and Decay**
   - Node: `Offset Point in Curve` → shift curve_index by +1 each frame (creates trail ordering)
   - Node: `Attribute Statistic` → compute max(Age)
   - Node: `Compare` (Age > threshold) → Boolean mask
   - Node: `Delete Geometry` → remove points older than 8–12 frames [TARGET trail length]

4. **Age → Visual Attribute Mapping**
   - Node: `Map Range` (Age → 0.0–1.0 normalized decay)
   - Node: `ColorRamp` (3-stop gradient):
     - Position 0.0: Full emission (R=1.5, emission strength 2.0) [TARGET]
     - Position 0.5: Mid-fade (emission strength 1.0, alpha 0.7)
     - Position 1.0: Transparent dissolve (alpha 0.0)
   - Node: `Store Named Attribute` → write `emission_strength`, `alpha`, `hue_shift` attributes

5. **Curve to Mesh Sweep**
   - Node: `Points to Curve` → convert point cloud to curve (using curve_index grouping)
   - Node: `Set Curve Radius` → base radius 0.08m at Age=0, taper to 0.02m at max Age
   - Node: `Curve to Mesh` → sweep with Circle profile (8 vertices)
   - Node: `Set Material` → assign slash-trail toon material (see §5)

6. **Output Geometry**
   - Node: `Realize Instances` → bake instanced geometry for GLB export
   - Output socket → connect to modifier stack output

**[INFERENCE]** This simulation-zone approach generates frame-coherent trails without external caching; the Age attribute drives all decay behavior deterministically.

---

## 2. Toon Explosion and Lightning Recipes

### 2A. Toon Explosion (IcoSphere Snap + ColorRamp)

**[TARGET]** Stylized expanding sphere burst with cel-shaded color bands and rim emission.

**Node Recipe:**
1. `IcoSphere` (subdivisions 2, radius 0.5m initial)
2. `Set Position` + `Noise Texture` (scale 3.0, strength 0.3) → radial displacement
3. `Geometry Nodes: Extrude Mesh` → per-face offset 0.02m outward
4. `Scale Elements` → per-face scale 0.8–1.2 random (snap to discrete sizes)
5. `Attribute Statistic` (distance from origin) → compute radial gradient
6. `Map Range` + `ColorRamp` (3-step palette):
   - Stop 1 (inner core): Bright orange-yellow (emission 3.0)
   - Stop 2 (mid-band): Red-orange (emission 1.5)
   - Stop 3 (outer edge): Dark red + transparency (alpha 0.2)
7. `Set Material` → toon explosion material with vertex color input
8. Animation: Keyframe IcoSphere radius 0.5 → 2.0m over 12 frames, then scale to zero over 6 frames

**[TARGET]** Explosion material uses `MixRGB` node to blend vertex color with base albedo; rim emission at grazing angles (Fresnel × emission_strength).

### 2B. Lightning Arc (Curve Line + Noise + Instanced Sparks)

**[TARGET]** Jagged electric arc with secondary spark instances.

**Node Recipe:**
1. `Mesh Line` or `Curve Line` (start/end points, 16 vertices)
2. `Set Position` + `Noise Texture` (4D noise, W = frame offset for animation) → offset vertices perpendicular to arc direction (strength 0.15m)
3. `Trim Curve` → remove random segments (50% probability per segment) for discontinuous arcs [INFERENCE: stylistic choice]
4. `Subdivide Curve` (cuts 2) → increase resolution for sweep
5. `Curve to Mesh` → sweep with 0.03m radius circular profile
6. `Instance on Points` (secondary spark geometry: small IcoSphere, scale 0.05m) → 20% spawn probability
7. `Set Material` → lightning material (bright cyan-white emission, additive blend in shader)

**[TARGET]** Lightning material: `Emission BSDF` (strength 5.0) mixed with `Principled BSDF` (metallic 1.0, roughness 0.1).

---

## 3. Bake/Export Path and Runtime Integration

### 3A. Observed Runtime Architecture

**[OBSERVED]** From pre-grounded facts:
- `scripts/export-battle-glb.py` exports collections to GLB files (one per collection, via `--manifest` arg)
- `battle-realtime-three.js` runtime uses:
  - `MeshToonMaterial` for character/environment meshes (cel-shading)
  - `MeshBasicMaterial` for projectile/trail meshes (unlit, vertex colors or texture-based)

**[INFERENCE]** VFX geometry (slash-trails, explosions, lightning) should export as:
1. **Option A (Static Baked Mesh):** Pre-animated GLB with vertex animation texture (VAT) or morph targets
2. **Option B (Runtime Procedural):** Export base geometry (trail curve skeleton, explosion sphere, lightning spline) + metadata; runtime generates mesh via Three.js `BufferGeometry` manipulation
3. **Option C (Hybrid):** Export keyframe meshes (e.g., explosion frames 0, 6, 12) as separate GLB; runtime interpolates or swaps

**[TARGET]** Recommended approach: **Option A (Baked Mesh)** for explosions/lightning (short-lived, predictable timing); **Option B (Runtime Procedural)** for slash-trails (dynamic, player-driven timing).

### 3B. Proposed Export Script: `scripts/build-procedural-vfx-blender.py`

**[TARGET]** CLI contract matching observed conventions:

```bash
# Headless batch export of VFX geometry nodes to GLB
blender --background assets/vfx-library.blend \
  --python scripts/build-procedural-vfx-blender.py -- \
  --out-dir assets/models/vfx \
  --manifest slash_trail,slash-trail-8f.glb;explosion_burst,explosion-toon.glb;lightning_arc,lightning-bolt.glb \
  --bake-frames 0-12 \
  --frame-step 2
```

**Arguments:**
- `--out-dir`: Output directory (relative to repo root) [required]
- `--manifest`: Semicolon-separated `collectionName,outputPath.glb` pairs [required]
- `--bake-frames`: Frame range to bake (e.g., `0-12`, `1-60`) [default: current frame only]
- `--frame-step`: Export every Nth frame (reduces file size for interpolation) [default: 1]

**[OBSERVED]** CLI pattern from `boss-motion-previs-blender.py`: use `_extract_script_args()` helper to parse `--` separator.

**[TARGET]** Script implementation steps:
1. Parse args via `argparse` (reuse `_extract_script_args()` pattern)
2. Iterate manifest entries; for each:
   - Load collection by name
   - Apply Geometry Nodes modifier evaluation (if present)
   - Bake to mesh via `bpy.ops.object.modifier_apply()` or `bpy.ops.nla.bake()`
   - Export via `bpy.ops.export_scene.gltf(filepath=..., use_selection=True, export_colors=True, export_attributes=True)`
3. Write export log (collection name, vertex count, file size)

**[INFERENCE]** Geometry Nodes attributes (e.g., `emission_strength`, `alpha`, `hue_shift` from §1) should export as vertex color layers or custom attributes; Three.js runtime reads these via `geometry.attributes.color` or `geometry.userData`.

### 3C. Runtime Consumption (Three.js Integration)

**[OBSERVED]** `battle-realtime-three.js` already uses `MeshBasicMaterial` for trails/projectiles.

**[TARGET]** VFX integration pseudocode:

```javascript
// Load baked slash-trail GLB
const gltf = await gltfLoader.loadAsync('assets/models/vfx/slash-trail-8f.glb');
const trailMesh = gltf.scene.children[0];

// Create MeshBasicMaterial with vertex colors + additive blend
trailMesh.material = new THREE.MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

// Play trail animation (if baked as morph targets)
const mixer = new THREE.AnimationMixer(trailMesh);
const clip = gltf.animations[0];
mixer.clipAction(clip).play();

// Or: manual vertex position update from Age attribute (if exported)
const ageAttr = trailMesh.geometry.attributes.age;
trailMesh.onBeforeRender = () => {
  // Update alpha based on elapsed time vs. ageAttr values
};
```

**[INFERENCE]** Additive blending (`THREE.AdditiveBlending`) + `depthWrite: false` creates overlapping glow effect consistent with anime-style VFX.

---

## 4. VFX Texture Prompts for External Generation

**[TARGET]** These prompts target anime/manga-style 2D textures to overlay or modulate procedural 3D geometry (e.g., as opacity masks or emission maps).

### 4A. Anime Slash Wave Texture

**Prompt:**
> "Hand-drawn anime speed-line slash effect, single curved arc sweeping from bottom-left to top-right, thick ink brush stroke with tapered ends, motion blur trails, white core with cyan-blue edge glow, transparent background, 1024×256 PNG, flat 2D graphic style, no shading or gradients inside stroke, pure black lineart with neon accent"

**Usage:** Map to slash-trail mesh as alpha mask (multiply with Age decay); emission color samples from cyan-blue edge gradient.

### 4B. Impact Aura Texture

**Prompt:**
> "Manga-style impact burst aura, radial explosion lines emanating from center point, sharp angular speed lines, black ink on white background, high contrast, no halftones, 512×512 PNG, symmetrical 8-fold radial layout, pure graphic flat design, no 3D depth or shading"

**Usage:** Project onto explosion IcoSphere as decal (UV-mapped to sphere poles); invert colors (white lines on transparent) and blend additively over mesh surface.

**[TARGET]** Both textures should be authored at 2× resolution (2048×512, 1024×1024) for downsampling anti-aliasing, then exported at target size with premultiplied alpha.

---

## 5. Palette/Emission Alignment and Open Risks

### 5A. Palette Alignment (Pending NPR Toon Render Spec)

**[INFERENCE]** Without access to `npr-toon-render-spec.md` (file not found in current run folder), the following assumptions guide palette choices:

- **Assumption 1:** Abyssal Surge uses a dark fantasy palette (cool blues, deep purples, fiery oranges for attacks)
- **Assumption 2:** Cel-shading quantizes colors to 3–4 discrete bands (shadow, midtone, highlight, rim)
- **Assumption 3:** Emission colors should contrast with base environment (e.g., cyan lightning vs. warm rock tones)

**[TARGET]** Recommended VFX palette (subject to npr-toon-render-spec.md verification):

| VFX Type       | Base Color       | Emission Color   | Rim Color        | Alpha Decay |
|----------------|------------------|------------------|------------------|-------------|
| Slash Trail    | Steel blue-gray  | Cyan-white glow  | Electric blue    | 0.0–1.0     |
| Explosion Core | Orange-yellow    | Bright yellow    | Red-orange       | 0.8–0.0     |
| Explosion Edge | Dark red-brown   | (none)           | (none)           | 0.2–0.0     |
| Lightning Arc  | White-cyan       | Cyan (strength 5)| White highlight  | 1.0 (solid) |

**[TARGET]** All emission strengths should scale with game settings (e.g., "Low VFX" mode multiplies by 0.5; "High VFX" by 1.5).

### 5B. Open Risks

1. **[RISK] Geometry Nodes Simulation Zone Performance**
   - **Issue:** Simulation zones accumulate point history every frame; without aggressive pruning (§1 step 3), memory usage grows unbounded in long battles.
   - **Mitigation:** Enforce max 12-frame trail length; add `Delete Geometry` node with hard cap on point count (e.g., 500 points max).
   - **Verification:** [TARGET] Profile in Blender viewport (Statistics overlay) during 60-second simulated combat; point count should plateau below 1000.

2. **[RISK] GLB Export of Custom Attributes**
   - **Issue:** glTF 2.0 spec supports vertex colors (COLOR_0) but not arbitrary named attributes (e.g., `emission_strength`, `Age`).
   - **Observed Workaround:** Blender's glTF exporter can encode custom float attributes as additional COLOR_N layers (via `export_attributes=True` flag), but Three.js loader may ignore them.
   - **Mitigation:** Encode `emission_strength` → COLOR_0.r, `alpha` → COLOR_0.a, `hue_shift` → COLOR_0.g (pack 3 scalars into one vec4).
   - **Verification:** [TARGET] Export test GLB, load in Three.js, inspect `geometry.attributes.color.array` for expected values.

3. **[RISK] Additive Blending Overdraw in Dense VFX**
   - **Issue:** Multiple overlapping slash-trails + explosions with `AdditiveBlending` can saturate screen to white (unreadable).
   - **Mitigation:** Clamp per-pixel emission contribution (shader: `gl_FragColor.rgb = min(emissive, vec3(2.0))`); or use `CustomBlending` with `OneFactor` + `OneMinusSrcAlphaFactor`.
   - **Verification:** [TARGET] Stress-test scene with 10 simultaneous slash-trails in view; measure peak luminance (should not exceed 2.0 in HDR pipeline, or 255 in LDR).

4. **[RISK] Baked Animation File Size**
   - **Issue:** Baking 12 frames × 500 vertices × 3 positions = 72KB per trail; 20 simultaneous trails = 1.44MB runtime memory.
   - **Observed Pattern:** `export-battle-glb.py` exports per-collection, implying separate files (not bundled).
   - **Mitigation:** Use `--frame-step 2` (export every 2nd frame, interpolate in runtime) to halve file size; or use morph target compression (glTF `KHR_animation_pointer` + sparse accessors).
   - **Verification:** [TARGET] Measure actual GLB file size after export; compare against 500KB target per VFX asset.

5. **[RISK] Missing NPR Toon Render Spec Alignment**
   - **Issue:** This spec assumes palette/emission guidelines without reading `npr-toon-render-spec.md` (file not found).
   - **Observed:** Current run folder `_workspace/20260726-stage1b-cinder-pressure-agency/engineering/` contains no toon-render spec.
   - **Action Required:** [TARGET] Once `npr-toon-render-spec.md` is authored, cross-check §5A palette table against canonical color definitions; update ColorRamp stops and emission strengths to match.
   - **Verification:** Manual review by art/engineering lead; validate in-game screenshot against reference concept art.

---

## Appendix: Example Blender Python API Snippets

**[TARGET]** Reference implementation fragments for script authors.

### A1. Apply Geometry Nodes and Bake to Mesh

```python
import bpy

obj = bpy.data.objects['slash_trail_generator']
# Ensure Geometry Nodes modifier is first in stack
mod = next((m for m in obj.modifiers if m.type == 'NODES'), None)
if mod:
    # Bake to mesh (Blender 4.0+)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    print(f"Baked {len(obj.data.vertices)} vertices")
```

### A2. Export GLB with Vertex Colors

```python
import bpy

bpy.ops.export_scene.gltf(
    filepath='out/slash-trail.glb',
    use_selection=True,
    export_format='GLB',
    export_colors=True,            # Enable COLOR_0 attribute
    export_attributes=True,         # Enable custom attributes (if supported)
    export_animations=True,
    export_frame_range=True,
    export_frame_start=1,
    export_frame_end=12
)
```

---

**Document Status:** [TARGET] Draft awaiting:
1. Verification of npr-toon-render-spec.md palette definitions
2. Test export of sample slash-trail geometry with Age attribute preservation
3. Three.js runtime integration prototype (load GLB + render with MeshBasicMaterial + additive blend)

**Next Actions:**
- Implement `scripts/build-procedural-vfx-blender.py` per §3B CLI contract
- Author test .blend file (`assets/vfx-library.blend`) with slash-trail, explosion, lightning collections
- Export test GLB and measure file size (validate against §5B risk #4)
- Profile Geometry Nodes simulation performance (validate against §5B risk #1)
