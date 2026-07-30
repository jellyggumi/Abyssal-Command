# Phase 1: Overlay Animation System Architecture

## 1. 2-Layer Composite Model

```
┌─────────────────────────────────────────────────┐
│  Base Layer (authored GLB clips)                │
│  "source: base"                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ Character GLB (e.g. dusk-warden.glb)      │  │
│  │   animations[0]: ::idle::v01  (loop)      │  │
│  │   animations[1]: ::move::v01  (loop)      │  │
│  │   animations[2]: ::run::v01   (loop)      │  │
│  │   animations[3]: ::hit::v01   (one-shot)  │  │
│  │   animations[4]: ::bighit::v01           │  │
│  │   animations[5]: ::attack::v01           │  │
│  │   animations[6]: ::critical::v01         │  │
│  │   animations[7]: ::avoid::v01            │  │
│  │   animations[8]: ::defence::v01          │  │
│  │   animations[9]: ::die::v01   (no-overlay)│  │
│  │   animations[10]: ::show::v01 (no-overlay)│  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Overlay Layer (unarmed-core.glb delta clips)   │
│  "source: overlay"                              │
│  ┌───────────────────────────────────────────┐  │
│  │ quaternion-only, rest-relative deltas     │  │
│  │ no skeleton/skin, animation-only GLB      │  │
│  │   9 clips: idle, move, run, hit, bighit,  │  │
│  │            attack, critical, avoid, defence│  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘

Combined for buildActions():
  [...baseEntries, ...adaptedOverlay]
  → first-match-wins: overlay replaces base on duplicate action keys
  → 9 overlaid + 2 fallback-only (die, show) = 11 total actions
```

## 2. Overlay Action Key Coverage

| Action Key | Base | Overlay | Fallback | Composite |
|------------|------|---------|----------|-----------|
| idle       | Yes  | Yes     | —        | overlay   |
| move       | Yes  | Yes     | —        | overlay   |
| run        | Yes  | Yes     | —        | overlay   |
| hit        | Yes  | Yes     | —        | overlay   |
| bighit     | Yes  | Yes     | —        | overlay   |
| attack     | Yes  | Yes     | —        | overlay   |
| critical   | Yes  | Yes     | —        | overlay   |
| avoid      | Yes  | Yes     | —        | overlay   |
| defence    | Yes  | Yes     | —        | overlay   |
| die        | Yes  | No       | Yes      | base      |
| show       | Yes  | No       | Yes      | base      |
| attack_melee| Yes | No      | Yes      | base      |
| attack_ranged| Yes| No      | Yes      | base      |

**9 overlay-replaced keys**: overlay clips win via first-match  
**4 fallback-only keys**: always use authored clips, never overlaid

## 3. Delta Adaptation Math

The overlay GLB stores **rest-relative quaternion deltas**:
```
delta[X][t] = inverse(target_rig_rest[X]) * absolute_retargeted[X][t]
```

Where:
- `target_rig` = dusk-warden.glb (the reference rig used during offline retargeting)
- `delta[X][t]` = quaternion for bone X at frame t in the overlay GLB
- `absolute_retargeted[X][t]` = the retargeted bone-local absolute rotation

### Runtime Adaptation for Character C

For a character C with rest pose quaternion `C_rest[X]`:
```
adapted_clip[X][t] = C_rest[X] * delta[X][t]
```

This works because:
1. All 24 compatible characters use the same `def-humanoid-v1` skeleton hierarchy
2. `C_rest[X]` is the bone's rest orientation relative to its parent in character C's GLB
3. The overlay delta encodes the retargeted motion relative to the reference rig's rest
4. Pre-multiplying by `C_rest[X]` shifts the motion into character C's bone-local space
5. Result: character C performs the motion naturally

### Rest Pose Extraction

Read from each character GLB's `nodes[]` array:
```javascript
function restQuatsFromGLB(gltf) {
  const rest = {};
  for (const node of gltf.scene?.users?.gltfJson?.nodes ?? []) {
    if (node.name?.startsWith("DEF-")) {
      const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
      rest[node.name] = normalizeQuat([x, y, z, w]);
    }
  }
  return rest;
}
```

### Caching Strategy

```
adaptedOverlayEntriesByModel: Map<string, AdaptedEntry[]>
  key:   modelPath (e.g. "assets/images/battle/glb/enemies/scout.glb")
  value: [{ clip: THREE.AnimationClip, source: "overlay" }, ...]  (9 entries)
```

- Adapted entries computed once per unique model path
- Cache survives for session lifetime
- On overlay load failure: fall back to base clips only (no overlay)

## 4. Overlay GLB Format (Contract)

**File**: `assets/motion/ingame/unarmed-core.glb`  
**Size**: 189,048 bytes (189 KB)  
**Validation**: 0 gate errors, runtimeEligible: true

| Property | Value |
|----------|-------|
| Format | GLB (binary glTF 2.0) |
| Meshes | None (animation-only) |
| Materials | None |
| Textures | None |
| Skins | 1 (24 joint references for rig compatibility check) |
| Bones | 24 DEF-* bones |
| Clips | 9 quaternion-delta `unarmed-core::{action}::v01` |
| Interpolation | LINEAR |
| Keyframe count | Varies per clip (24 FPS time domain) |
| Animation encoding | `local-rest-relative-quaternion-deltas` |
| Bone mapping | 22 rows, `"mode": "copy", "weight": 1.0` |

**9 Clip Details** (from manifest):

| Action | Source FBX | Frames | Duration | Loop |
|--------|-----------|--------|----------|------|
| idle | Unarmed Idle.fbx | 1-47 | 1.917s | Yes |
| move | Walking.fbx | 1-34 | 1.375s | Yes |
| run | Running.fbx | 1-31 | 1.250s | Yes |
| hit | Standing React Small From Left.fbx | 1-19 | 0.750s | No |
| bighit | Receive Uppercut To The Face.fbx | 1-31 | 1.250s | No |
| attack | Punching.fbx | 1-21 | 0.833s | No |
| critical | Illegal Elbow Punch.fbx | 1-19 | 0.750s | No |
| avoid | Dodging.fbx | 1-73 | 3.000s | No |
| defence | Body Block.fbx | 1-21 | 0.833s | No |

## 5. Implementation Outline

### 5.1 New Functions in `battle-realtime-three.js`

**Constants** (lines ~717-718):
```javascript
const OVERLAY_ANIMATION_PATH = "assets/motion/ingame/unarmed-core.glb";
const OVERLAY_ACTION_KEYS = ["idle","move","run","hit","bighit","attack","critical","avoid","defence"];
```

**Load function** (~30 lines):
```javascript
let overlayDeltaEntriesPromise = null;
let warnedOverlayLoadFailure = false;

function loadOverlayDeltaEntries() {
  if (!overlayDeltaEntriesPromise) {
    overlayDeltaEntriesPromise = loadGltf(OVERLAY_ANIMATION_PATH)
      .then((gltf) => gltf.animations)
      .catch((err) => {
        if (!warnedOverlayLoadFailure) {
          console.warn("overlay delta pack load failed:", err);
          warnedOverlayLoadFailure = true;
        }
        return null;
      });
  }
  return overlayDeltaEntriesPromise;
}
```

**Normalization** (~20 lines):
```javascript
function normalizeOverlayDeltaClip(clip) {
  // For each quaternion track in clip:
  //   1. Read all keyframes
  //   2. Ensure shortest-path continuity (no sign flips > 180°)
  //   3. Write back corrected values
  // Returns the clip (mutated in place)
}
```

**Adaptation** (~40 lines):
```javascript
const adaptedOverlayEntriesByModel = new Map();

function adaptOverlayEntries(modelPath, instance, deltaEntries) {
  if (adaptedOverlayEntriesByModel.has(modelPath)) {
    return adaptedOverlayEntriesByModel.get(modelPath);
  }
  // Extract rest pose quaternions from instance's skeleton nodes
  const skeleton = instance.getObjectByProperty("type", "SkinnedMesh")?.skeleton;
  if (!skeleton) return [];

  const restQuats = restQuatsFromInstance(instance);
  const adapted = deltaEntries.map((clip) => {
    const adaptedClip = composeDeltaWithRestPose(clip, restQuats);
    return { clip: adaptedClip, source: "overlay" };
  });
  adaptedOverlayEntriesByModel.set(modelPath, adapted);
  return adapted;
}
```

### 5.2 Modified Function: `instantiateActorModel()`

Current (lines 1155-1169):
```javascript
instantiateActorModel(relPath, targetHeight) {
  return serializeInstantiation(async () => {
    const gltf = await loadGltf(modelUrl(relPath));
    // ...
    const mixer = new THREE.AnimationMixer(instance);
    const allClips = gltf.animations;  // <-- base only
    record = { ... actions: buildActions(mixer, allClips), ... };
  });
}
```

Modified:
```javascript
instantiateActorModel(relPath, targetHeight) {
  return serializeInstantiation(async () => {
    const [gltf, overlayEntries] = await Promise.all([
      loadGltf(modelUrl(relPath)),
      loadOverlayDeltaEntries().then((deltaEntries) =>
        deltaEntries ? adaptOverlayEntries(relPath, instance, deltaEntries) : []
      ),
    ]);
    // ...
    const mixer = new THREE.AnimationMixer(instance);
    const allClips = overlayEntries.length
      ? [...gltf.animations, ...overlayEntries]
      : gltf.animations;
    record = { ... actions: buildActions(mixer, allClips), ... };
  });
}
```

**Fallback chain**: If `loadOverlayDeltaEntries()` returns null (load failed), skip overlay entirely — `overlayEntries` will be empty, `allClips` stays as `gltf.animations`.

## 6. Bone Chain

Same 24 DEF-* bones as the runtime skeleton. The overlay GLB animates all 22 mapped bones (same as `MAPPING_ROWS` in retarget script). Bones without delta tracks in the overlay retain their base clip motion unchanged.

```javascript
OVERLAY_MAPPED_BONES = 22; // Same set as retarget pipeline:
// DEF-spine (.001-.005), DEF-shoulder.L/R, DEF-upper_arm.L/R,
// DEF-forearm.L/R, DEF-hand.L/R, DEF-thigh.L/R, DEF-shin.L/R,
// DEF-foot.L/R, DEF-toe.L/R
// Excluded: DEF-pelvis.L, DEF-pelvis.R (synthesized, never motion-source)
```

## 7. Error Recovery

| Scenario | Behavior |
|----------|----------|
| Overlay GLB not found | `warn` once per session, fall back to base clips |
| Overlay GLB malformed | `warn` once, fall back to base clips |
| Character GLB load succeeds, overlay pending | Wait for both; if overlay fails, continue with base clips |
| Character GLB has no skeleton | No overlay applied (unrigged model — terrain/VFX) |
| Character GLB has extra non-DEF bones | Only DEF-* bones get overlay delta; others use base clip |
| `adaptedOverlayEntriesByModel` full | Session-limited; no eviction needed (max 24 unique models) |
