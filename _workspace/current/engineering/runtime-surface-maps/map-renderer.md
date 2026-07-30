# Abyssal Surge Three.js Renderer: Surface Map

## Surface Map

| Component | Symbol → File:Line | Responsibility |
|-----------|-------------------|-----------------|
| **Scene Bootstrap** | `THREE.WebGLRenderer` → battle-realtime-three.js:2151 | WebGL context creation with antialiasing, alpha transparency disabled (0 alpha). |
| | `THREE.Scene` → battle-realtime-three.js:2153 | Main scene graph root; contains terrain, actor, VFX groups. |
| | `THREE.PerspectiveCamera` → battle-realtime-three.js:2154 | 35° FOV; near 0.05, far 50; position/look controlled by orbit system. |
| | `THREE.HemisphereLight` → battle-realtime-three.js:2155 | Hemisphere ambient (0xfff2d6 sky / 0x140a06 ground, intensity 1.1). |
| | `THREE.DirectionalLight` (sun) → battle-realtime-three.js:2156 | Key light 0xffd9a8, intensity 1.6; rim light at 20 units, 35° pitch (battle-realtime-three.js:195-196). |
| **Unit Conversion** | `WORLD_SCALE` → battle-realtime-three.js:45 | **14 world units per gameplay unit**. Arena is 24000×12000 gameplay units; normalized to [-1,1] by app.js, then scaled by 14. Ground plane: 28 world units square. |
| | `worldPointInto()` → battle-realtime-three.js:875-887 | Dual-mode resolver: detects normalized [-1,1] vs raw ARENA [0..24000] and maps to world center. |
| | `TERRAIN_TARGET_HALF_EXTENT` → battle-realtime-three.js:52 | 14 × 1.15 = **16.1 world units** (footprint auto-fit target for all terrain GLBs). |
| **Terrain Load Path** | `profile.terrainRuntimeEligible` → battle-realtime-three.js:2641-2663 | Gate: if true, load GLB; else procedural fallback. Checked via `stageWorldFor(stageId)`. |
| | `profile.terrainGlbPath` → battle-realtime-three.js:2663 | Path to terrain GLB asset (e.g. `assets/...terrain.glb`). |
| | `instantiateTerrainModel()` → battle-realtime-three.js:1644-1652 | Load via `loadGltf()` (battle-realtime-three.js:1192-1205), clone with SkeletonUtils, fit footprint, inspect mesh integrity, record as "promoted-glb". |
| | `profile.terrainFallback` → battle-realtime-three.js:2641-2668 | Fallback on load error: `kind` field specifies fallback type (default "procedural-flat-support"). Reason field captures error. |
| | `instantiateProceduralTerrain()` → battle-realtime-three.js:1654-1675 | Create flat plane mesh (PlaneGeometry), center at 0, fit to TERRAIN_TARGET_HALF_EXTENT, ground at Y=0, record source as fallback kind. |
| | `profile.presentation.props` → battle-realtime-three.js:2707 | Array of prop definitions from stage-world-catalog; instantiated via `instantiateStageProp()`. |
| **GLTF Loader** | `gltfLoader` → battle-realtime-three.js:1176 | `new GLTFLoader()` from `vendor/loaders/GLTFLoader.js` (three.js official). |
| | `gltfCache` → battle-realtime-three.js:1177 | Map: path → Promise<gltf>. Dedups concurrent load requests; persistence across scene lifetime. |
| | `loadGltf(path)` → battle-realtime-three.js:1192-1205 | Central loader: enqueues `gltfLoader.load()`, caches promise, rejects on timeout, injects error context. **No draco/ktx2 support visible** (standard three.js GLTFLoader, extensions not declared). |
| **Props (PROP_MODELS)** | `PROP_MODELS` → battle-realtime-three.js:359-365 | Map: reward ID → prop mesh GLB path. E.g. "stillwater-hourglass" → PROP_RELIC_MESH. |
| | `PROP_BLADE_MESH` → battle-realtime-three.js:222 | `assets/mesh/prop/prop-sprite-sheet-single-object.03/glb/base_basic_pbr.glb` (item pickup mesh). |
| | `PROP_RELIC_MESH` → battle-realtime-three.js:223 | `assets/mesh/prop/prop-sprite-sheet-single-object.05/glb/base_basic_pbr.glb` (relic pickup mesh). |
| | `instantiateStageProp()` → battle-realtime-three.js:1717-1752 | Load prop GLB, optionally select node by name (prop.modelNode), clone, fit footprint via `fitFootprint()`, ground via `groundObjectOnPlane()`, place at prop.placement, apply yaw, record with stageDecorKind="prop". |
| | `fitFootprint()` → battle-realtime-three.js:1354-1360 | Uniform scale to target half-extent (radius in gameplay units × WORLD_SCALE / half-arena). |
| | `fitHeight()` → battle-realtime-three.js:1339-1352 | Uniform scale (getSize().y) to TARGET_HEIGHT[kind]; boss 1.8, enemy 1.2, companion 1.6, stageNpc 1.8, pickup 0.7. |
| **VFX Pool & Registry** | `MAX_VISUAL_EFFECTS` → battle-realtime-three.js:14 | **24 concurrent transient VFX cap**. |
| | `vfxInstances[]` → battle-realtime-three.js:2306 | Array of { root, effectRoot?, untilTick, eventType, mixer?, action?, ... }. Retired when untilTick <= tick. |
| | `VFX_MODELS` → battle-realtime-three.js:289-323 | Event type → GLB path registry (33 event ids mapped to 3 stage-vfx files). |
| | `SKILL_VFX_MODELS` → battle-realtime-three.js:324-330 | Skill ID → GLB path (5 skills: rift-bolt, soul-lance, grave-pulse, void-aegis, shadow-step). |
| | `VFX_LIFETIME_TICKS` → battle-realtime-three.js:373-403 | Event type → lifetime in 60Hz ticks (most 30 ticks default, telegraphed boss 60+). |
| | `CRITICAL_VFX_EVENT_TYPES` → battle-realtime-three.js:404-422 | 6 event types (CRITICAL_HIT, BOSS_ATTACK_TELEGRAPHED, BOSS_RALLY_WINDOW, GATE_BREACHED, COMPANION_DOWNED, TERMINAL). Exempted from pool eviction. |
| **VFX Spawn Path** | `spawnVfx()` → battle-realtime-three.js:4020-4080 | (1) Resolve GLB path from event type / skill id. (2) Fetch lifetime from VFX_LIFETIME_TICKS (or windupTicks for telegraphed). (3) Resolve anchor via `effectAnchor()`. (4) Create placeholder Group at anchor. (5) **Queue load**: call `instantiateVfxModel()` with generation guard. (6) On load: replace placeholder child, play clip if present, add to vfxGroup. (7) On lifetime expiry: retire via `retireVfxRecord()`. |
| | `effectAnchor()` → battle-realtime-three.js:1136-1157 | Returns placement (x, y, z) for VFX spawn: quest-point-based if quest event, else entity impact point. |
| | `instantiateVfxModel()` → battle-realtime-three.js:2082-2094 | Load GLB, clone, own resources, fit height 1.2, position Y=0.6, find clip matching `::loop::` or first clip, play looped. |
| | `retireVfxRecord()` → battle-realtime-three.js:4000-4003 | Stop mixer, remove from vfxGroup, dispose root. |
| **VFX Effect Ids (All 33 Types)** | | INPUT_ACCEPTED, INPUT_REJECTED, PICKUP_DENIED, ECHO_DENIED, EXTRACTION_REJECTED, OBJECTIVE_FAILED, ENCOUNTER_OBJECTIVE_FAILED, PROJECTILE_BLOCKED, PROJECTILE_EXPIRED, BOSS_ATTACK_CANCELLED, CRITICAL_HIT, MELEE_IMPACT, PROJECTILE_IMPACT, SKILL_RESOLVED_DAMAGE, COMMANDER_DAMAGED, COMPANION_DAMAGED, ITEM_COLLECTED, OBJECTIVE_PHASE_CHANGED, ENCOUNTER_OBJECTIVE_STARTED, OBJECTIVE_COMPLETED, ENCOUNTER_OBJECTIVE_COMPLETED, WAVE_CLEARED, EXTRACTION_WINDOW_OPENED, OCCUPATION_CAPTURED, EXTRACTION_COMPLETED, BOSS_ATTACK_TELEGRAPHED, BOSS_SPAWNED, BOSS_RALLY_WINDOW, GATE_BREACHED, WARDENS_WARD_TRIGGERED, ECHO_WARDEN_AWAKENING_TRIGGERED, COMPANION_DOWNED, TERMINAL. |
| **Pickup Rendering** | `ensurePickup()` → battle-realtime-three.js:2928-2976 | (1) Check if exists in actors Map. (2) Create Group with fallback OctahedronGeometry mesh (pickup color 0xffaa00). (3) Determine modelPath: "item" → PROP_BLADE_MESH, else PROP_RELIC_MESH. (4) Queue async load via `instantiatePickupModel()`. (5) On load: replace fallback child, record loading=false. Add to actorGroup. |
| | `instantiatePickupModel()` → battle-realtime-three.js:1677-1685 | Load GLB, clone, own resources, fit height 0.7, ground at Y=0, inspect integrity. |
| | `run.pickups` → battle-realtime-three.js:3553-3558 | From snapshot.pickups or snapshot.drops; for each pickup: call ensurePickup(), sync position via `syncActorPosition()`. |
| | `syncActorPosition()` → battle-realtime-three.js:3299-3301 | Map gameplay coords to world position via `worldPoint()`, set actor.root.position. Snapshot-read-only. |
| | Snapshot Boundary | Pickups are read from snapshot.pickups only; no simulation state written back (immutable presentation contract). |
| **Motion/Animation** | `MOTION_MODELS` → battle-realtime-three.js:201-213 | Asset ID → GLB path registry (11 character models, e.g. "lantern-reaver", "human-command-boss"). |
| | `RIG_ACTION_KEYS` → battle-realtime-three.js:454-462 | Canonical 11-clip library: idle, move, run, hit, bighit, attack, critical, avoid, defence, die, show. |
| | Clip Naming Convention → battle-realtime-three.js:1395-1403 | `<assetId>::<action>::v01` (extracted by `actionKeyFromClipName()`). Tolerates bare names (idle, attack). |
| | `instantiateActorModel()` → battle-realtime-three.js:1529-1560 | (1) Load GLB via `loadGltf()`. (2) Clone with SkeletonUtils (owned skeleton per instance). (3) Fit height to actorTargetHeight. (4) Apply cel shading. (5) Build actions: { idle, move, run loop; hit, bighit, attack, critical, avoid, defence, die, show one-shot }. (6) Load & adapt overlay animations (unarmed-core.glb). |
| | `buildActions()` → battle-realtime-three.js:1410-1429 | For each clip in gltf.animations: extract action key, create AnimationAction via mixer.clipAction(), set loop/clamp based on key. Return { actionKey → action }. |
| | Overlay Deltas → battle-realtime-three.js:1207-1215 | REST-relative quaternion adjustments from assets/motion/ingame/unarmed-core.glb; composed onto imported character rigs. Contract: RUNTIME_ANIMATION_CONTRACT.md §5. |
| **Camera System** | `MIN_ORBIT_PITCH` → battle-realtime-three.js:76 | 30° (radians: π/6). |
| | `MAX_ORBIT_PITCH` → battle-realtime-three.js:77 | 85° (radians: π/1.43). |
| | `ORBIT_ZOOM_DEFAULT` → battle-realtime-three.js:78 | **20.8 world units** (default distance at 55° base pitch). |
| | `MIN_ORBIT_DISTANCE` → battle-realtime-three.js:81 | 10.4 (0.5× default). |
| | `MAX_ORBIT_DISTANCE` → battle-realtime-three.js:82 | 41.6 (2.0× default). |
| | `MANUAL_ZOOM_RATIO_MIN / MAX` → battle-realtime-three.js:79-80 | 0.9–1.1 (±10% pinch zoom within active tier). |
| | `CAMERA_PHASE_TIERS` → battle-realtime-three.js:86-93 | Six phases (DESCENT, SKIRMISH, OBJECTIVE, BIGWAVE, FINALE, CUTSCENE) with zoomFactor targets. |
| | `stageZoomClamp()` → battle-realtime-three.js:132-138 | Stage-specific min/max zoom envelope (per-stage-camera-framing-addendum.md); global bounds override. |
| | Camera Smoothing → battle-realtime-three.js:83-84 | CAMERA_POSITION_LAMBDA=6, CAMERA_LOOK_LAMBDA=11 (exponential smoothing factors). CAMERA_TIER_TRANSITION_TICKS=90. |
| **Lighting** | `buildEnvironmentMap()` → battle-realtime-three.js:2250-2274 | Bake 6-face PMREM cubemap: MeshBasicMaterial boxes (self-lit) in fixed room with COLORS palette tints. Per-stage tint optional (D22 judgment 8: dynamic geometry cubes deferred). |
| | `scene.environment` → battle-realtime-three.js:2420-2423 | PMREM texture auto-picked up by MeshStandardMaterial for implicit IBL (no per-material wiring needed). |
| **Materials & Shading** | `applyCelShading()` → battle-realtime-three.js:1516-1527 | Convert MeshStandardMaterial to MeshToonMaterial; apply cel gradient ramp (3-step bands, CEL_SHADOW_BANDS=3). |
| | `celGradient()` → battle-realtime-three.js:1478-1492 | Create CanvasTexture with 3 colors (dark→mid→light), minFilter=THREE.NearestFilter for hard bands. |
| | Owned Textures → battle-realtime-three.js:1362-1393 | Clone textures (map, normalMap, roughnessMap, metalnessMap, emissiveMap) for each instance; no sharing. |

## Extension Points

### Adding a New Terrain GLB
1. **stage-world-catalog.js**: Add profile entry with `terrainGlbPath: "assets/..."`, `terrainRuntimeEligible: true`.
2. **instantiateTerrainModel()** (battle-realtime-three.js:1644-1652) is the load entry point. GLB must:
   - Be a valid three.js-loadable GLTF/GLB file.
   - Have a footprint (bounding box X-Z extent) that will be scaled to TERRAIN_TARGET_HALF_EXTENT (16.1 world units).
   - Define Y=0 as ground plane (meshIntegrity inspection will ground it).
3. **Fallback**: if load fails, instantiateProceduralTerrain() auto-creates a flat plane.

### Adding a New VFX Effect
1. **battle-realtime-three.js:289-323** (VFX_MODELS): Add event type → GLB path mapping.
2. **battle-realtime-three.js:373-403** (VFX_LIFETIME_TICKS): Set lifetime in ticks (or omit for default 30).
3. **Optional**: Add to CRITICAL_VFX_EVENT_TYPES (battle-realtime-three.js:404-422) if it should survive pool eviction.
4. **GLB requirements**:
   - Looped animation: clip named `*::loop::*` or first clip auto-loops.
   - Height: will be fitted to 1.2 world units via `fitHeight()`.
   - Position: spawned at Y=0.6 + effectAnchor offset.
5. **Entry point**: `spawnVfx()` (battle-realtime-three.js:4020-4080) dequeues async load and manages lifetime.

### Adding a New Prop
1. **stage-world-catalog.js**: Add prop descriptor in a stage profile with `{ id, modelPath, placement: { x, y, z, yawRadians }, footprintRadius, modelNode? }`.
2. **instantiateStageProp()** (battle-realtime-three.js:1717-1752) is the load entry point.
3. **GLB requirements**:
   - footprintRadius: gameplay units; scaled by WORLD_SCALE / (WORLD_WIDTH / 2) in `fitFootprint()`.
   - Optional modelNode: if specified, only that named node is extracted and cloned.
   - Will be grounded via `groundObjectOnPlane()` to detect lowest mesh Y.
4. **Integration**: props are populated into terrainGroup on stage load via profile.presentation.props.

### Extending VFX Lifecycle
- **spawnVfx()** (line 4020) is the dispatch entry; modify `semanticVfxIdForEvent()` (line 340) to add routing rules.
- **effectAnchor()** (line 1136) chooses spatial anchor (quest point vs impact point); extend here for new anchor types.
- **retireVfxRecord()** (line 4000) is the cleanup point; modify here if new vfxInstance fields need disposal.
- **VFX pool eviction** (line 4009-4017): LRU-style, non-critical effects removed first; add to CRITICAL_VFX_EVENT_TYPES to exempt.

### Modifying Camera Behavior
- **CAMERA_PHASE_TIERS** (line 86-93): define per-phase distance targets.
- **stageZoomClamp()** (line 132-138): apply per-stage zoom bounds.
- **CAMERA_POSITION_LAMBDA / CAMERA_LOOK_LAMBDA** (line 83-84): control exponential smoothing responsiveness (higher = snappier).

### Adding Character Models
1. **MOTION_MODELS** (line 201-213): Add `assetId → GLB path`.
2. **GLB must embed**:
   - 11 animation clips named `<assetId>::<action>::v01` (idle, move, run, hit, bighit, attack, critical, avoid, defence, die, show).
   - Rigged skeleton (SkeletonUtils.clone requires skinned mesh).
   - Blender Y→Z converted (forward axis = +Z in three.js).
3. **Overlay adaptation**: loaded at runtime via `adaptOverlayEntries()` (line 1309-1322) if base rig lacks unarmed actions.

## Risks

1. **Unit Conversion Fragility**: WORLD_SCALE=14 is hardcoded. Gameplay coords [0..24000] / [0..12000] must normalize to [-1, 1] in app.js or tests will diverge. Dual-mode `worldPointInto()` detects both paths but is easy to bypass.

2. **Terrain Load Silently Falls Back**: If `profile.terrainGlbPath` fails, procedural flat plane silently replaces it. No visual diff from user POV. Monitor stageTerrainError, stageTerrainFailedId in debugMetrics().

3. **VFX Pool Eviction**: When 24 concurrent effects are active, non-critical ones are evicted LRU-style. Fast combat bursts can starve older effects. Cap is process-wide; no per-actor or per-skill prioritization.

4. **Snapshot-Read-Only Boundary**: Pickup rendering reads run.pickups from snapshot only; position sync never writes back (D23 hard constraint). Breaking this invalidates deterministic replay.

5. **No Draco/KTX2**: GLTFLoader has no declared Draco/KTX2 extensions. Large terrain/prop GLBs will block the thread during decode; consider pre-compression offline or streaming if file sizes balloon.

6. **Cel Shading Baked into Material**: `applyCelShading()` converts all actors to MeshToonMaterial + gradient ramp. Per-character or per-skill cel override is not exposed; any future visual variation must modify this globally.

7. **Overlay Animation Failure is Soft**: If overlay (unarmed-core.glb) fails to load, character falls back to base clips only (line 1531: overlayDeltaEntries = null). No warning in production; only console.warn in dev.

