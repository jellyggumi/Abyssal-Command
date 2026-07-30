# Terrain & Prop Asset Pipeline Map

**Abyssal Surge** — Asset inventory, schemas, runtime pipeline, and Blender workflows  
Date: 2026-07-30 · Reader: Blender agent preparing multi-tile terrain generation  
Scope: `/assets/mesh/terrain/**`, `/assets/mesh/prop/**`, `/scripts/`, `defense-asset-manifest.json`, `generate_layers.py`

---

## Surface Map

### 1. Stage Inventory by Role

**Three canonical stages:** `cinder-span`, `abyss-chancel`, `echo-throne`

#### Stage: `terrain-cinder-span`
**Directory:** `/assets/mesh/terrain/terrain-cinder-span/`  
**Status:** `terrainRuntimeEligible: false` — authored diorama not flat gameplay-eligible  
**Inventory:**

| Type | Files | Notes |
|------|-------|-------|
| **Raw Concept** | `terrain-cinder-span-terrain.raw.png` | Generated from concept via `gti` (god-tibo-imagen); white background, no text |
| | `terrain-cinder-span-background-terrain.raw.png` | Far silhouette backdrop layer |
| | `terrain-cinder-span-background-object.raw.png` | Background object/creature silhouettes |
| | `terrain-cinder-span-terrain-feature.raw.png` | Interactive objects/decor (keyed extraction) |
| **Derived PNGs** | `terrain-cinder-span-terrain.png` (seen in glob) | Post-processed from raw; used in runtime packs |
| | `terrain-cinder-span-background-terrain.png` (implied) | Processed backdrop |
| | `terrain-cinder-span-background-object.png` (implied) | Processed objects |
| | `terrain-cinder-span-terrain-feature.png` (implied) | Processed features |
| **OBJ Meshes** | `terrain-cinder-span-object.obj` (implied; base split via `split-terrain-obj-parts.py`) | Merged terrain geometry from plate |
| | `terrain-cinder-span-terrain-feature.obj` (implicit; feature/obj/base variant) | Feature extraction OBJ |
| **GLB Meshes (Runtime)** | `/runtime/terrain/terrain-cinder-span.glb` | **Promoted diorama**, loaded if `terrainRuntimeEligible === true` (currently false) |
| | `/runtime/packs/terrain-cinder-span-features.glb` | Feature billboard GLB, **runtime-loaded** |
| | `/runtime/packs/terrain-cinder-span-props.glb` | Prop placement GLB, **runtime-loaded** |
| **Layers JSON** | `terrain-cinder-span.layers.json` | Concept layer extraction metadata; schema v1 |
| **Manifest** | `/runtime/terrain-cinder-span-resources.manifest.json` | References to loaded mesh parts; node naming convention source |

**Asymmetries:** Cinder has a **promoted runtime GLB** in `/runtime/terrain/`, indicating an earlier diorama build attempt. Abyss and Echo-Throne do **not** have promoted runtime GLBs — only textured candidates.

---

#### Stage: `terrain-abyss-chancel`
**Directory:** `/assets/mesh/terrain/terrain-abyss-chancel/`  
**Status:** `terrainRuntimeEligible: false` — source-candidate-not-runtime-eligible  
**Inventory:**

| Type | Files | Notes |
|------|-------|-------|
| **Raw Concept** | `terrain-abyss-chancel-terrain.raw.png` | No layers.json found; see note below |
| | `terrain-abyss-chancel-background-terrain.raw.png` | |
| | `terrain-abyss-chancel-background-object.raw.png` | |
| | `terrain-abyss-chancel-terrain-feature.raw.png` | |
| **OBJ Meshes** | `terrain-abyss-chancel.obj` | Merged base geometry |
| | `terrain-abyss-chancel-terrain-feature.obj` | Feature extraction OBJ |
| **GLB Meshes** | `/textured-candidate/terrain/terrain-abyss-chancel-textured-cleaned.glb` | **Textured candidate** — not promoted; retained for offline inspection only |
| | `/textured-candidate/feature/terrain-abyss-chancel-feature-billboards.glb` | Feature billboard candidate |
| | `/textured-candidate/background-terrain/terrain-abyss-chancel-background-terrain-billboards.glb` | Background layer candidate |
| | `/textured-candidate/background-object/terrain-abyss-chancel-background-object-billboards.glb` | Background object candidate |
| **Candidate OBJs** | `/textured-candidate/feature/obj/terrain-abyss-chancel-feature-NNN.obj` (001–039) | Individual feature objects; paired with `.mtl` files |
| | `/textured-candidate/background-terrain/obj/terrain-abyss-chancel-background-terrain-001.obj` | Background layer mesh |
| | `/textured-candidate/background-object/obj/terrain-abyss-chancel-background-object-NNN.obj` (001–035) | Background object meshes |
| **Textures** | `/textured-candidate/terrain/textures/terrain-abyss-chancel-albedo-1x1.png` | Single texel placeholder |
| | `/textured-candidate/feature/textures/terrain-abyss-chancel-terrain-feature.png` | Feature atlas texture |
| | `/textured-candidate/background-terrain/textures/...` | Background layer textures |
| | `/textured-candidate/background-object/textures/...` | Background object textures |
| **Provenance** | `/textured-candidate/audit/feature-overlap-audit.json` | QA audit; notes `"terrainAndObjectCanLoadTogether": false` |
| | `/textured-candidate/asset-manifest.json` | Local asset tracking for this candidate build |

**Asymmetry:** No `.layers.json` file exists for abyss-chancel. Likely because the layers extraction failed or was not completed. The raw PNG inputs exist, but no formal separation/key metadata.

---

#### Stage: `terrain-echo-throne`
**Directory:** `/assets/mesh/terrain/terrain-echo-throne/`  
**Status:** `terrainRuntimeEligible: false` — source-candidate-not-runtime-eligible  
**Inventory:**

| Type | Files | Notes |
|------|-------|-------|
| **Raw Concept** | `terrain-echo-throne-terrain.raw.png` | Keyed white background |
| | `terrain-echo-throne-background-terrain.raw.png` | Distant backdrop |
| | `terrain-echo-throne-background-object.raw.png` | Background entities |
| | `terrain-echo-throne-terrain-feature.raw.png` | Feature/decor layer |
| **Derived PNGs** | `terrain-echo-throne-terrain.png` | Post-processed terrain plate |
| | `terrain-echo-throne-background-terrain.png` | Post-processed backdrop |
| | `terrain-echo-throne-background-object.png` | Post-processed background objects |
| | `terrain-echo-throne-terrain-feature.png` | Post-processed features |
| **OBJ Meshes** | (No base `.obj` in glob; assumed split or merged elsewhere) | |
| **GLB Meshes** | `/textured-candidate/terrain/terrain-echo-throne-textured.glb` | **Textured candidate** — retained for offline checks, not runtime |
| | `/textured-candidate/feature/terrain-echo-throne-feature-billboards.glb` | Feature billboard pack |
| | `/textured-candidate/background-terrain/terrain-echo-throne-background-terrain-billboards.glb` | Background layer pack |
| | `/textured-candidate/background-object/terrain-echo-throne-background-object-billboards.glb` | Background object pack |
| **Candidate OBJs** | `/textured-candidate/feature/obj/terrain-echo-throne-feature-NNN.obj` (001–039) | 39 individual feature objects + `.mtl` |
| | `/textured-candidate/background-terrain/obj/terrain-echo-throne-background-terrain-001.obj` | Single background terrain mesh |
| | `/textured-candidate/background-object/obj/terrain-echo-throne-background-object-NNN.obj` (001–035) | 35 background object parts |
| **Textures** | `/textured-candidate/terrain/textures/terrain-echo-throne-albedo-1x1.provenance.json` | Single-texel placeholder; provenance recorded |
| | `/textured-candidate/terrain/textures/terrain-echo-throne-albedo-1x1.png` | |
| | `/textured-candidate/feature/textures/terrain-echo-throne-terrain-feature.png` | Feature atlas |
| | `/textured-candidate/background-terrain/textures/terrain-echo-throne-background-terrain.png` | Background texture atlas |
| | `/textured-candidate/background-object/textures/terrain-echo-throne-background-object.png` | Background object atlas |
| **Layers JSON** | `terrain-echo-throne.layers.json` | Concept layer extraction metadata; schema v1, mode=`"key"` (keyed separation) |
| **Build Report** | `/textured-candidate/terrain-echo-throne-build-report.json` | Generation success summary |

**Asymmetries:** Echo-Throne has **four separate layer GLBs** (terrain, feature, background-terrain, background-object) whereas Cinder has only two (features, props). This indicates a more granular decomposition approach.

---

### 2. Layers JSON Schema

**File:** `/assets/mesh/terrain/{stage}/terrain-{stage}.layers.json`  
**Examples:** `terrain-cinder-span.layers.json`, `terrain-echo-throne.layers.json`  
**Note:** `terrain-abyss-chancel.layers.json` does not exist.

#### Root Schema

```json
{
  "schemaVersion": 1,
  "assetId": "terrain-cinder-span",
  "concept": "assets/images/battle/pilot/concept-terrain-cinder-span.png",
  "conceptSha256": "<40-char hex digest>",
  "generatedAt": "2026-07-29T04:50:10.592941+00:00",
  "assetLane": "concept",
  "runtimeEligible": false,
  "separation": { ... },
  "layers": [ ... ]
}
```

**Root Fields:**
- `schemaVersion`: Always `1`.
- `assetId`: Stage identifier (e.g., `"terrain-cinder-span"`).
- `concept`: Path to reference concept image used for generation.
- `conceptSha256`: Integrity checksum of the concept image.
- `generatedAt`: ISO 8601 timestamp when extraction completed.
- `assetLane`: Always `"concept"` — indicates these are concept-layer artifacts, not runtime-promoted.
- `runtimeEligible`: Always `false` — candidate layers are never directly runtime-eligible. Promotion happens via separate scripts.
- `separation`: Metadata about layer separation method (see below).

#### Separation Object

**Cinder-span (mode: `"gen"`):**
```json
"separation": {
  "detectedMode": "gen",
  "mode": "gen",
  "borderMedianRgb": [33, 25, 24],
  "borderSpread": 26.383,
  "rationale": "full-bleed scene -> layers are not separable in pixel space"
}
```

**Echo-throne (mode: `"key"`):**
```json
"separation": {
  "detectedMode": "key",
  "mode": "key",
  "borderMedianRgb": [5, 7, 10],
  "borderSpread": 8.397,
  "rationale": "uniform keyable border -> pixel key is exact and free"
}
```

**Interpretation:**
- **`"gen"` mode:** Layers extracted via generative LLM; no clean pixel boundary. `borderMedianRgb` is the RGB of the detected background; `borderSpread` is the standard deviation of that color across the margin. High spread means inconsistent border, layers less cleanly separable.
- **`"key"` mode:** Layers extracted via chroma key; uniform border allows exact pixel-based keying. Low `borderSpread` indicates uniform, keyable background.

#### Layer Entry Schema

Each entry in `layers[]` represents one extracted layer (e.g., `"terrain"`, `"background-terrain"`, `"background-object"`, `"terrain-feature"`).

```json
{
  "layer": "terrain",
  "prompt": "<generation prompt used for extraction>",
  "output": "_workspace/current/engineering/asset-pipeline/concept-layers/terrain-cinder-span/terrain-cinder-span-terrain.png",
  "generate": {
    "model": "gti",
    "seed": 0,
    "timestamp": "...",
    "status": "success"
  },
  "rawOutput": "_workspace/current/engineering/asset-pipeline/concept-layers/terrain-cinder-span/raw/terrain-cinder-span-terrain.raw.png",
  "key": {
    "algorithm": "chroma-key",
    "colorRgb": [255, 255, 255],
    "tolerance": 30,
    "result": "success"
  },
  "status": "generated+keyed",
  "source": "gti",
  "sha256": "b63fef5134461c89aa460e6392ef9627d49005def864e6d61e4d3924707d2756"
}
```

**Layer Entry Fields:**
- `layer`: Name of the extracted layer (e.g., `"terrain"`, `"background-terrain"`, `"terrain-feature"`, `"background-object"`).
- `prompt`: The exact text prompt sent to the image generator (e.g., `god-tibo-imagen`) to isolate this layer. Defines what should be included/excluded.
- `output`: Final processed PNG after generation + keying.
- `generate`: Metadata from the generative step (model name, seed for reproducibility, timestamp, success/failure status).
- `rawOutput`: Unprocessed PNG directly from the generator before key/cleanup.
- `key`: Chroma key metadata if applicable. `colorRgb` is the background color to key (usually `[255,255,255]` white); `tolerance` is the RGB distance threshold for matching.
- `status`: Combined status (e.g., `"generated+keyed"`, `"generated"`, `"failed"`).
- `source`: Generator used (e.g., `"gti"` for god-tibo-imagen).
- `sha256`: Integrity checksum of the final output PNG.

**Prompt Contract Example:**
The terrain layer prompt (both stages use identical wording):
```
Isolate ONLY the playable ground surface from the reference scene, rendered as a standalone 
terrain tile in the same art style: the walkable floor plane, its material, and its edge treatment, 
viewed from a raised three-quarter angle. Exclude every character, creature, weapon, and prop. 
Exclude distant background landforms, sky, pillars, walls, bridges, statues, debris, foliage, and 
set dressing. Pure flat white background, no text, no logo, no watermark.
```

This ensures consistent, clean extraction across all stages.

---

### 3. Terrain → Runtime Pipeline

**Objective:** Turn a raw concept plate (`terrain-{stage}-terrain.raw.png`) into a runtime-loadable GLB that stage-world-catalog.js can reference.

#### 3.1 Current Status

**Cinder-span:**
- ✅ Candidate created: `/textured-candidate/...` (exists)
- ✅ **Promoted to runtime:** `/runtime/terrain/terrain-cinder-span.glb` exists
- ⚠️ **Not actually used:** `terrainRuntimeEligible: false`; gameplay uses procedural flat plane instead
- Reason: `"authored-diorama-not-flat-gameplay-eligible"` — the promoted mesh is visually beautiful but not flat-plane compatible (actor silhouettes would clip/occlude)

**Abyss-chancel & Echo-throne:**
- ✅ Candidate created: `/textured-candidate/...` (exists)
- ❌ **Not promoted:** No `/runtime/terrain/` GLB
- ⚠️ **Not used:** `terrainRuntimeEligible: false`; gameplay uses procedural flat plane
- Reason: `"source-candidate-not-runtime-eligible"` — candidates rejected; no audit clearance for promotion

#### 3.2 Transformation Pipeline

**Entry:** Concept image (e.g., `concept-terrain-cinder-span.png`)  
**Output:** GLB suitable for Three.js runtime loading

**Step 1: Layer Extraction**  
Script: `/scripts/run-concept-layer-batch.py`, `/scripts/generate_layers.py`  
Input: Concept PNG + layer prompts (from `layers.json`)  
Output: `{stage}-terrain.raw.png`, `{stage}-terrain-feature.raw.png`, etc.  
Process:
- Uses `god-tibo-imagen` (gti CLI) to generate each layer in isolation
- Applies chroma key or generative cleanup to remove background
- Records generation metadata in `.layers.json`

**Step 2: Image-to-OBJ Conversion**  
Script: (Likely a Blender-based or external tool; not explicitly named in glob)  
Input: `{stage}-terrain-feature.raw.png` (as example)  
Output: `{stage}-terrain-feature.obj`  
Process:
- Converts 2D plate into 3D geometry (height field from luminance, normal map from texture, etc.)
- Applies standard Blender mesh export to OBJ + MTL

**Step 3: Mesh Refinement & Splitting** (Cinder-span only)  
Script: `/scripts/split-terrain-obj-parts.py`  
Input: Merged terrain OBJ (e.g., `terrain-cinder-span-object.obj`)  
Output: Per-part OBJs, manifest JSON  
Process:
```bash
python3 scripts/split-terrain-obj-parts.py --check
python3 scripts/split-terrain-obj-parts.py --write \
  --obj assets/mesh/terrain/terrain-cinder-span/terrain-cinder-span-object.obj \
  --out _workspace/current/engineering/asset-pipeline/terrain-parts/cinder-span
```
- Performs connected-component analysis on the mesh
- Splits by face connectivity; parts ≥ 20 faces are individual OBJs, smaller parts go to debris file
- Outputs: individual part OBJs + `manifest.json` with part inventory
- Reason: For modular placement and independent deformation/animation

**Step 4: Texturing (Textured-candidate lane)**  
Script: (Implicit; textures applied via MTL or Blender material export)  
Input: Per-part OBJ + albedo/normal/roughness/metallic PNGs  
Output: `/textured-candidate/{layer}/obj/base.obj` + textures/  
Process:
- Each layer (terrain, feature, background-terrain, background-object) gets its own textured OBJ tree
- Materials reference embedded textures (PBR workflow)
- Echo-throne and Abyss-chancel stop here (candidates, not promoted)

**Step 5: OBJ → GLB Export**  
Script: `/scripts/build-cinder-span-runtime.py` (Cinder-span only)  
Input: Refined OBJs + textures  
Output: `/runtime/packs/terrain-cinder-span-features.glb`, `/runtime/packs/terrain-cinder-span-props.glb`, `/runtime/terrain/terrain-cinder-span.glb`  
Process:
```bash
blender -b -P scripts/build-cinder-span-runtime.py -- \
  --out /Users/jangyoung/orca/Abyssal-Surge/assets/mesh/terrain/terrain-cinder-span/runtime/terrain/terrain-cinder-span.glb
```
- Opens Blender headless
- Imports OBJ parts
- Applies Blender materials (PBR, cartoon shaders, bevel, etc.)
- Exports as single GLB with embedded meshes and materials
- Cinder's `build-cinder-span-runtime.py` specifically constructs the bridge diorama procedurally (arches, ember stones, etc.)

**Step 6: Node Naming & Manifest**  
Script: (Implicit in GLB export or post-processing)  
Output: `/runtime/terrain-cinder-span-resources.manifest.json`  
Process:
- Each mesh in the GLB receives a stable object name following the convention:
  - `terrain-{stage}-terrain-{index}` (terrain base meshes)
  - `terrain-{stage}-feature-{index}` (feature/decor objects)
  - `terrain-{stage}-prop-{index}` (prop placement markers)
- The manifest lists these names so `stage-world-catalog.js` can find them via `scene.getObjectByName("terrain-cinder-span-feature-016")`

#### 3.3 Named-Node Convention

**Pattern:** `terrain-{stage}-{role}-{index}`

**Example names in runtime GLBs:**
- `terrain-cinder-span-terrain-001` — base terrain mesh segment 1
- `terrain-cinder-span-feature-016` — decor feature #16 (referenced by stage-world-catalog.js)
- `terrain-cinder-span-prop-033` — prop placement anchor #33

**Runtime Resolution (battle-realtime-three.js):**
```javascript
const gltf = await gltfLoader.load(profile.terrainGlbPath); // e.g., terrain-cinder-span.glb
const terrain = gltf.scene.getObjectByName("terrain-cinder-span-terrain-001");
const feature = gltf.scene.getObjectByName("terrain-cinder-span-feature-016");
// Add to scene, apply materials, etc.
```

**Dependencies:**
- `stage-world-catalog.js` line 123: `terrainSourceCandidatePath: "assets/mesh/terrain/terrain-cinder-span/runtime/terrain/terrain-cinder-span.glb"`
- Test suite: `tests/runtime-visual-assets.test.mjs` line 100+ validates named-node presence and GLB integrity

---

### 4. Blender Scripts Inventory

**All terrain-relevant Blender Python scripts:**

| Script | Purpose | CLI Example | Produces |
|--------|---------|-------------|----------|
| `build-cinder-span-runtime.py` | **Rebuild Cinder diorama GLB** | `blender -b -P scripts/build-cinder-span-runtime.py --` | `/runtime/terrain/terrain-cinder-span.glb` + `/runtime/packs/*` |
| `split-terrain-obj-parts.py` | **Split merged terrain OBJ into individual parts** | `python3 scripts/split-terrain-obj-parts.py --write --obj assets/mesh/terrain/.../obj/base.obj --out /workspace/...` | Per-part OBJs + `manifest.json` |
| `build-stage-vfx-blender.py` | Build looping stage VFX GLBs & review previews for stages 1–3 | `blender -b -P scripts/build-stage-vfx-blender.py --` | `/assets/motion/stage-vfx/{stage}-*.glb` |
| `build-world-content-pack.py` | (Minimal docstring; likely builds consolidated content pack) | (Implicit; used in build pipeline) | Bundled asset GLB |
| `rig-character-asset-blender.py` | Rig characters (not terrain-specific) | `blender -b -P scripts/rig-character-asset-blender.py -- --glb ... --asset-id ...` | Character mesh + skeleton |
| `apply-cartoon-texture-blender.py` | Apply texture atlas to mesh (for characters & props) | `python3 scripts/apply-cartoon-texture-blender.py --glb ... --texture ... --out ...` | Textured GLB |
| `audit-mesh-detail-blender.py` | Audit mesh detail (vertex density, seams, etc.) | `blender -b -P scripts/audit-mesh-detail-blender.py --` | QA report JSON |
| `export-battle-glb.py` | Export battle scene to GLB | `python3 scripts/export-battle-glb.py --in ... --out ...` | Battle scene GLB |

**Non-Blender terrain scripts:**
- `/scripts/generate_layers.py` — Batch image generation for UI concept layers (not terrain; see script line 14–27 assets_to_process list)
- `/scripts/run-concept-layer-batch.py` — Invokes layer extraction batch jobs

---

### 5. Prop Meshes Inventory

**Directory:** `/assets/mesh/prop/`  
**Main asset:** `prop-sprite-sheet-single-object.json` (sprite sheet packing manifest)

#### Prop Variants

**Runtime-loadable GLBs (only two exist):**

| Variant | GLB Paths | Status |
|---------|-----------|--------|
| `.03` | `/prop-sprite-sheet-single-object.03/glb/base_basic_pbr.glb`<br/>`/prop-sprite-sheet-single-object.03/glb/base_basic_shaded.glb` | ✅ **Runtime-loaded** by `RETAINED_ASSET_PATHS` |
| `.05` | `/prop-sprite-sheet-single-object.05/glb/base_basic_pbr.glb`<br/>`/prop-sprite-sheet-single-object.05/glb/base_basic_shaded.glb` | ✅ **Runtime-loaded** by `RETAINED_ASSET_PATHS` |
| `.01`, `.02`, `.04`, `.06` | (PNG + JSON only; no GLB subfolder) | ❌ Not runtime-loadable; candidates only |

#### Prop File Organization (example for `.05`)

```
prop-sprite-sheet-single-object.05/
├── obj/
│   ├── textureBasicPack/
│   │   ├── texture_roughness.png
│   │   ├── texture_pbr.png
│   │   ├── texture_normal.png
│   │   ├── texture_metallic.png
│   │   ├── texture_diffuse.png
│   │   └── shaded.png
│   └── obj/
│       └── base.obj
├── glb/
│   ├── base_basic_pbr.glb      ← PBR-textured, **runtime-loaded**
│   └── base_basic_shaded.glb   ← Shaded variant, **runtime-loaded**
├── fbx/
│   ├── textureBasicPack/
│   │   └── (5 textures)
│   └── fbx/
│       ├── base_basic_pbr.fbx
│       ├── base_basic_shaded.fbx
│       └── base.fbx
└── (PNG + JSON metadata at root)
    ├── prop-sprite-sheet-single-object.05.png
    └── prop-sprite-sheet-single-object.05.json
```

**Exact runtime GLB paths retained in `defense-runtime-assets.mjs` line 31–32:**
```javascript
"assets/mesh/prop/prop-sprite-sheet-single-object.03/glb/base_basic_pbr.glb",
"assets/mesh/prop/prop-sprite-sheet-single-object.05/glb/base_basic_pbr.glb",
```

---

### 6. Why Terrains Are Not Runtime-Eligible

**Explicit Reasons (from `stage-world-catalog.js` fallback declarations):**

#### Cinder-span (line 125)
```javascript
terrainFallback: { 
  kind: "procedural-flat-support", 
  reason: "authored-diorama-not-flat-gameplay-eligible" 
}
```
**Rationale:** The promoted GLB at `/runtime/terrain/terrain-cinder-span.glb` is a beautiful, visually complex diorama with **non-flat geometry** (pillars, arches, elevation changes). This violates the core gameplay constraint: **all actor movement and navigation must occur on a single flat plane** (see `pcg-stage-layout-spec.md` line 14–21). Loading a non-flat mesh would:
- Cause actor silhouettes to clip through or occlude geometry
- Produce incorrect shadow casting
- Break pathfinding calculations that assume a flat arena (24000 × 12000 × 0 elevation)

**Audit Evidence:** `/tests/runtime-visual-assets.test.mjs` line 61 and `/tests/stage-terrain-environment-contract.test.mjs` line 405 both assert this reason explicitly.

#### Abyss-chancel & Echo-throne (lines 205, 288)
```javascript
terrainFallback: { 
  kind: "procedural-flat-support", 
  reason: "source-candidate-not-runtime-eligible" 
}
```
**Rationale:** The textured candidate GLBs in `/textured-candidate/terrain/` were generated from candidate plates but **have not passed promotion criteria**. Reasons may include:
- Mesh topology unsuitable for actor placement
- Texture resolution or UV layout issues
- Geometry does not align with flat-plane gameplay
- Audit failure (see `/textured-candidate/audit/feature-overlap-audit.json` for abyss-chancel, which notes `"terrainAndObjectCanLoadTogether": false`)

**Retention Rationale:** The candidates are **retained for offline inspection** (`terrainSourceCandidatePath` field in catalog) as evidence of the attempted build, enabling future debugging or re-promotion if constraints change.

**Fallback Behavior (battle-realtime-three.js line 2661):**
```javascript
if (profile.terrainRuntimeEligible !== true) return instantiateProceduralTerrain(profile);
```
- Generates a flat `PlaneGeometry` at arena bounds (24000 × 12000)
- Places catalog props individually on this support plane
- Applies `inspectMeshIntegrity` and `groundObjectOnPlane` validations
- Ensures actors cannot fall below or occlude terrain

---

### 7. Defense Asset Manifest

**File:** `/assets/defense-asset-manifest.json`  
**Generator:** `/scripts/build-defense-asset-manifest.mjs`  
**Role:** Inventory of all runtime-retained assets with disposition (keep/delete) and test status.

#### Schema

```json
{
  "schemaVersion": 1,
  "generatedBy": "scripts/build-defense-asset-manifest.mjs",
  "regeneration": "Run node scripts/build-defense-asset-manifest.mjs --write before destructive deletion commit.",
  "pendingGeneration": false,
  "rows": [
    {
      "disposition": "retain",
      "currentPath": "assets/mesh/terrain/terrain-cinder-span/runtime/terrain/terrain-cinder-span.glb",
      "replacementPath": "assets/mesh/terrain/terrain-cinder-span/runtime/terrain/terrain-cinder-span.glb",
      "extension": ".glb",
      "generator": "scripts/build-defense-asset-manifest.mjs",
      "runtimeReference": true,
      "testDisposition": "retain"
    },
    { ... }
  ],
  "historicalDeletionRows": [ ... ]
}
```

#### Key Fields

| Field | Meaning |
|-------|---------|
| `disposition` | `"retain"` (asset lives in repo) or `"delete"` (scheduled for removal) |
| `currentPath` | Absolute repo path of the asset |
| `replacementPath` | New path if asset is being moved; `null` if deleted |
| `runtimeReference` | `true` if the asset is loaded at runtime; `false` for build-only/candidate artifacts |
| `testDisposition` | `"retain"` or `"delete"` for test suite asset expectations |
| `generator` | Tool that produced this asset (e.g., `"scripts/build-defense-asset-manifest.mjs"`) |

#### Terrain Assets in Manifest

**Retained (runtime-loaded):**
```json
{
  "disposition": "retain",
  "currentPath": "assets/mesh/terrain/terrain-cinder-span/runtime/packs/terrain-cinder-span-features.glb",
  "runtimeReference": true,
  "testDisposition": "retain"
},
{
  "disposition": "retain",
  "currentPath": "assets/mesh/terrain/terrain-cinder-span/runtime/packs/terrain-cinder-span-props.glb",
  "runtimeReference": true,
  "testDisposition": "retain"
},
{
  "disposition": "retain",
  "currentPath": "assets/mesh/terrain/terrain-abyss-chancel/textured-candidate/terrain/terrain-abyss-chancel-textured-cleaned.glb",
  "runtimeReference": true,   ← ⚠️ retained for reference, not actually loaded
  "testDisposition": "retain"
},
{
  "disposition": "retain",
  "currentPath": "assets/mesh/terrain/terrain-echo-throne/textured-candidate/terrain/terrain-echo-throne-textured.glb",
  "runtimeReference": true,   ← ⚠️ retained for reference, not actually loaded
  "testDisposition": "retain"
}
```

#### New Asset Registration

**Rule:** Any new terrain asset (OBJ, GLB, PNG, JSON) must be:
1. **Physically placed** in `/assets/mesh/terrain/{stage}/` tree
2. **Registered** in `defense-asset-manifest.json` with:
   - `disposition: "retain"` (or `"delete"` if retiring)
   - `runtimeReference: true` if it will be loaded by the renderer
   - `currentPath: "assets/mesh/terrain/..."`
   - `testDisposition: "retain"` if tests reference it

3. **Regenerated** before commit:
   ```bash
   node scripts/build-defense-asset-manifest.mjs --write
   ```

**Non-goals:** The manifest does **not** track:
- Internal build artifacts (candidate lanes, audit files, OBJ source files)
- Version history (that's in `historicalDeletionRows` for audits only)
- Load order or initialization sequence (runtime code defines that)

---

## Extension Points

### For Blender Agent: Multi-Tile Terrain Generation

**Attach point 1: Layer JSON Creation**  
When generating new multi-tile terrain, create a `.layers.json` file matching the schema above:
- File: `/assets/mesh/terrain/terrain-{new-stage}/terrain-{new-stage}.layers.json`
- Populate `layers[]` with each extracted layer (terrain, features, backgrounds)
- Record actual `generate` and `key` metadata from your generation runs
- **Contract:** `runtimeEligible: false` until post-generation promotion audit passes

**Attach point 2: Named-Node Convention**  
When exporting to GLB from Blender:
- Each mesh object must have a name following: `terrain-{stage}-{role}-{index}`
- Example: `terrain-new-stage-terrain-001`, `terrain-new-stage-feature-042`
- Export these names intact in GLB (object names are preserved in glTF 2.0)
- Verify with: `tests/runtime-visual-assets.test.mjs` line 100+ (node naming validation)

**Attach point 3: Script Integration**  
Create parallel scripts to `build-cinder-span-runtime.py`:
- Input: Refined OBJs from split-terrain-obj-parts.py
- Output: `/runtime/packs/{stage}-features.glb`, `/runtime/packs/{stage}-props.glb`
- Command: 
  ```bash
  blender -b -P scripts/build-{new-stage}-runtime.py -- \
    --out assets/mesh/terrain/terrain-{new-stage}/runtime/terrain/terrain-{new-stage}.glb
  ```

**Attach point 4: Manifest Registration**  
Update `/assets/defense-asset-manifest.json`:
```json
{
  "disposition": "retain",
  "currentPath": "assets/mesh/terrain/terrain-{new-stage}/runtime/packs/{new-stage}-features.glb",
  "runtimeReference": true,
  "testDisposition": "retain"
}
```

**Attach point 5: Stage Catalog Entry**  
Add to `/stage-world-catalog.js` (lines 117–364):
```javascript
{
  stageId: "{new-stage}",
  terrainSourceCandidatePath: "assets/mesh/terrain/terrain-{new-stage}/textured-candidate/terrain/terrain-{new-stage}-textured.glb",
  terrainGlbPath: null,  // or runtime path if promoted
  terrainRuntimeEligible: false,  // or true if audit passes
  terrainFallback: { kind: "procedural-flat-support", reason: "..." },
  gameplay: { bounds: bounds(...), obstacles: [...], routes: [...] },
  presentation: { props: [...], vfxCues: [...], ... },
  // ... other fields
}
```

---

## Risks

### 1. **Non-Flat Diorama Loading**
**Risk:** Promoting a non-flat terrain to `terrainRuntimeEligible: true` will cause actor clipping and pathfinding failure.  
**Mitigation:** Validate candidate with `pcg-stage-layout-spec.md` constraint #6: all gameplay geometry must have `elevation === 0`.

### 2. **Missing Named Nodes**
**Risk:** GLB meshes without `terrain-{stage}-{role}-{index}` names will not load at runtime.  
**Mitigation:** Always export Blender objects with stable, unique names. Verify with `tests/runtime-visual-assets.test.mjs` line 100+ before commit.

### 3. **Unregistered Assets**
**Risk:** Assets placed in the tree but not in `defense-asset-manifest.json` may be deleted during cleanup.  
**Mitigation:** Run `node scripts/build-defense-asset-manifest.mjs --write` after adding new assets; commit the updated manifest.

### 4. **Layer JSON Missing for Abyss-Chancel**
**Risk:** No `.layers.json` exists for terrain-abyss-chancel. Regeneration or re-extraction cannot be audited.  
**Mitigation:** If abyss-chancel is re-extracted or remade, ensure `generate_layers.py` and/or `run-concept-layer-batch.py` produce `.layers.json` for it.

### 5. **Asymmetric Decomposition**
**Risk:** Three stages have different layer structures (Cinder = 2 packs, Echo = 4 candidates). Adding a new stage could introduce another variant.  
**Mitigation:** Define a canonical layer structure (e.g., always terrain + features + background-terrain + background-objects) and apply to all stages.

---

## Summary

The terrain asset pipeline converts concept images through layer extraction, 3D modeling, texturing, and GLB export. Only Cinder-span has a promoted runtime GLB; Abyss-chancel and Echo-throne are retained as candidates for offline inspection. All three route gameplay to a procedural flat plane. Named-node convention (`terrain-{stage}-{role}-{index}`) enables runtime mesh lookup. Props use only two runtime GLBs (`.03` and `.05`). All runtime assets are registered in `defense-asset-manifest.json` and validated by test suite.

**Key files for new multi-tile generation:**
- Layers JSON schema: `/assets/mesh/terrain/terrain-{stage}/terrain-{stage}.layers.json`
- Named-node convention: `terrain-{stage}-{role}-{index}` in GLB mesh objects
- Build script template: `/scripts/build-cinder-span-runtime.py` (reference)
- Manifest registration: `node scripts/build-defense-asset-manifest.mjs --write`
- Stage catalog entry: `/stage-world-catalog.js` lines 117–364
- Test validation: `/tests/runtime-visual-assets.test.mjs` line 100+
