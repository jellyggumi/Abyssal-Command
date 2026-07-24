# Blender 5.1 Character Rigging & Animation Pipeline for AI-Generated Previs Assets

**Scope:** Solo-dev previs pipeline for Abyssal Surge. Target runtime: Blender 5.1.2 (macOS,
headless CLI + interactive MCP). Source assets: single-mesh GLB blobs from Rodin/Hyper3D with no
skeleton, no bone weights, arbitrary topology. Goal: replace the current empty/proxy previs script
(`scripts/boss-motion-previs-blender.py`) with a real bone-armature pipeline that is fully
bpy-scriptable, matches 2026 game-dev/previs practice, and exports cleanly to Unity/Unreal via
glTF/FBX.

**Recency note (read first):** Blender's core rigging tools (Rigify, `ARMATURE_AUTO` weights,
NLA) are stable and well-documented as of 2024–2025 and this guide cites primary sources for them.
Two areas are **2026-current but thin on independent secondary sources** and are flagged inline
where they occur: (a) Blender 5.1's specific point-release notes and the "Bone Info" geometry-nodes
addition, sourced to blender.org's own 5.1 release notes; (b) the ML auto-rigger landscape
(UniRig/SkinTokens), which is fast-moving 2025 research without a stable bpy integration yet. Where
only 2024/2025 material was available and no 2026 update was found, that is stated explicitly.

---

## 1. T-pose base mesh + pedestal separation convention

**Principle:** the rigged, deforming character and the static ground/display base are always
**separate objects**, never one mesh. This is the industry-standard split between a *Skeletal
Mesh* (Unreal) / *SkinnedMeshRenderer* (Unity) and a *Static Mesh* / plain `MeshRenderer`, and it
holds for previs pipelines the same way it holds for shipping game assets.

Why:

- **Deformation cost and correctness.** Only geometry that needs to bend around bones should carry
  bone weights. A pedestal, plinth, or ground plate never deforms; including it in the skinned mesh
  wastes GPU skinning cost and risks accidental weight bleed onto static geometry during automatic
  weight painting.
- **Origin/pivot semantics differ.** A character's origin must sit at the root/feet for locomotion,
  navmesh, and animation retargeting to work. A pedestal's origin is a ground-contact footprint used
  for physics/navmesh queries and doesn't move with the character's root motion.
- **Reuse and swap.** The same rigged character should be usable standing on different pedestals (or
  no pedestal — in-game) without re-exporting the skeleton. Conversely, the pedestal/base can be
  swapped for a collision capsule or nav-mesh cutout independent of animation work.
- **Export hygiene.** glTF/FBX exporters that see a static mesh accidentally parented into an
  armature's vertex groups will either skip it (silently dropping geometry) or export it as a
  degenerate skinned mesh with a single all-1.0 bone weight — neither is what you want.

### Recommended object hierarchy

```
<asset-id>                      (Empty, "Plain Axes", at world origin — asset root)
├── <asset-id>_pedestal          (Mesh — static, NO armature modifier, NO vertex groups)
├── <asset-id>_armature           (Armature object — the rig)
└── <asset-id>_body               (Mesh — the deforming character, parented to armature w/ auto weights)
```

Naming convention used throughout this guide (matches the existing `{bossId}::{action}::{variant}`
clip-id convention already in `boss-motion-previs-action-pipeline.json`):

| Suffix | Object type | Deforms? | Notes |
|---|---|---|---|
| `<id>` | Empty | — | Asset root; single point all exports/imports pivot around |
| `<id>_pedestal` | Mesh | No | Ground-contact footprint; feeds physics/navmesh, not skinned |
| `<id>_armature` | Armature | — | The skeleton; parented to `<id>` root, not to the pedestal |
| `<id>_body` | Mesh | Yes | The Rodin/Hyper3D GLB mesh, parented to `<id>_armature` |

The pedestal and the armature are **siblings** under the asset root, not parent/child of each
other — this means moving/rotating the pedestal (e.g. repositioning it in a diorama) never touches
bone transforms, and re-generating the rig never touches the pedestal mesh.

```python
import bpy

def build_asset_hierarchy(asset_id, body_obj, pedestal_obj, armature_obj):
    """Wire up the asset-root / pedestal / armature / body hierarchy convention."""
    root = bpy.data.objects.new(asset_id, None)
    root.empty_display_type = 'PLAIN_AXES'
    bpy.context.scene.collection.objects.link(root)

    pedestal_obj.name = f"{asset_id}_pedestal"
    pedestal_obj.parent = root

    armature_obj.name = f"{asset_id}_armature"
    armature_obj.parent = root

    body_obj.name = f"{asset_id}_body"
    # body's parenting to the armature (with auto weights) happens separately —
    # see section 5.2. Do not parent body directly to `root`.
    return root
```

The T-pose itself is a **bind-pose requirement, not a presentation pose**: arms at ~90° from the
torso gives auto-weighting algorithms (bone-heat and ML-based alike) an unambiguous, non-self-
intersecting armpit/shoulder region to compute weight falloff from. Never export or ship the
skinned mesh already fused into a "presentation" pose with the pedestal — pose that combination at
the game-engine/scene level instead (parent the whole rigged actor onto the pedestal object in
Unity/Unreal, not in Blender's mesh data).

---

## 2. Auto-rigging approaches for AI-generated meshes with no existing skeleton

Rodin/Hyper3D GLBs arrive as a single manifold-ish mesh blob: no skeleton, no vertex groups, no
metadata about limb topology. The pipeline needs a fully scriptable path from "raw mesh" to
"skinned, DEF-bone-driven armature" with **zero manual weight-painting budget**. Below is a survey
of the 2025–2026 tool landscape and the concrete recommendation for this project.

### 2.1 Blender Rigify (built-in, free, fully bpy-scriptable) — **recommended primary path**

Rigify ships with Blender and works by (1) adding a **metarig** — a simplified proxy skeleton with
"Rigify Type" metadata per bone — then (2) running **Generate Rig**, which expands the metarig into
a full production rig with `ORG-` (original/source-of-truth), `DEF-` (deformation, the bones you
skin to), `MCH-` (mechanism/IK-FK plumbing), and control bones (the animator-facing handles).

As of Blender 5.1 (released March 17, 2026) the metarig → Generate workflow is unchanged in
mechanics; Blender 5.1 added a "Bone Info" geometry-nodes node and animation-evaluation performance
work, neither of which changes the scripting surface used here. *(This specific 5.1 detail is
sourced to blender.org's own release notes; independent secondary confirmation was thin, so treat
it as informational rather than load-bearing.)*

The catch for **arbitrary AI-generated meshes**: Rigify's stock human metarig assumes roughly
human proportions but is not proportion-aware out of the box — it must be **fit** to each mesh's
actual bounding-box proportions before generating, or the resulting DEF bones will sit outside the
mesh surface and auto-weighting will fail or produce garbage. Section 5.1 below gives a concrete
proportional-fit heuristic (measure the mesh bounding box / silhouette landmarks, scale/reposition
metarig bone chains to match) that requires no manual clicking and degrades gracefully for
roughly-humanoid creature meshes.

This is the path used throughout this guide because it is: free, ships inside Blender (no external
license/service dependency), and every step — metarig add, bone repositioning, `Generate Rig`,
auto-weight parenting — is exposed to `bpy`/`rigify` Python without needing the interactive UI.

### 2.2 Auto-Rig Pro (ARP) — commercial, "Smart" auto-rig feature

ARP's **Smart** feature places anatomical landmark markers (wrists, ankles, spine, neck, etc.) on
the mesh and computes a full rig from them, cutting a normally multi-hour manual rig-build down to
minutes for humanoid bipeds. As of 2025–2026 ARP remains one of the most widely used third-party
Blender rigging addons specifically because of its retargeting and game-engine (Unity/Unreal/Godot)
export reliability.

Fit for this project: **Smart is biped/humanoid-specific.** For non-humanoid or heavily
stylized creature meshes (a real risk with Hyper3D generative output), ARP's own guidance is to
skip Smart markers and use the "Add Limbs" manual-construction workflow instead — which reintroduces
per-asset manual work this pipeline explicitly wants to avoid. ARP also requires a paid license and
is not bundled with Blender, so it is a viable **escalation path** if Rigify's proportional-fit
heuristic proves insufficient for a specific asset, but it is not the zero-manual-budget default.

### 2.3 Mixamo / ActorCore AccuRIG — web-upload auto-rig services

Mixamo (Adobe) accepts a mesh upload and returns a rigged FBX with the well-known
`mixamorig:<BoneName>` skeleton (see section 3). As of July 2026, Mixamo has **not** been
officially discontinued, but Adobe has given it no active development or sunset roadmap — it is in
effective maintenance-only limbo, and it is widely reported to have intermittent upload/auth
instability. **ActorCore AccuRIG** (Reallusion) is the most commonly recommended free alternative
in 2025–2026 discussion of "what replaces Mixamo," offering similar upload-and-auto-rig behavior.

Fit for this project: **both are non-starters for this pipeline's automation requirement.** They
are interactive web/desktop tools with no headless/CLI/bpy entry point, so they cannot be driven
from a CI-style or MCP-driven Blender script. They remain useful as a **manual fallback** for a
one-off hero asset, or as a source of retargetable motion-capture clips, but are excluded from the
automated per-asset pipeline.

### 2.4 ML-based auto-riggers (UniRig and successors)

**UniRig** ("One Model to Rig Them All: Diverse Skeleton Rigging with UniRig," SIGGRAPH 2025,
Tsinghua University / VAST) is a transformer-based model that jointly predicts a topologically valid
skeleton and per-vertex skinning weights for arbitrary meshes — humans, creatures, and stylized
assets alike — trained on the 14,000+ model Rig-XL dataset. This is the most directly relevant
research result to "rig an arbitrary AI-generated mesh with unknown topology" of anything surveyed
here, including reported successor work (**SkinTokens**) unifying the two prediction stages.

**2025-recency flag:** UniRig is a standalone PyTorch research codebase (github.com/VAST-AI-Research/UniRig),
not a Blender addon and not exposed via `bpy`. Using it means running inference **outside** Blender
(a separate Python/PyTorch environment) and importing the resulting skeleton+weights back in — a
real integration but a heavier one than the pure-bpy Rigify path, and one this guide does not have
verified 2026 evidence of a mature Blender-native wrapper for. Treat this as the recommended
**future-upgrade path** if arbitrary non-humanoid topology becomes a frequent problem for Rigify's
proportional-fit heuristic, not as the current default.

### 2.5 The common final step: `bpy.ops.object.parent_set(type='ARMATURE_AUTO')`

Regardless of which of the above produced the skeleton, the mesh-to-armature binding step in
native Blender is the same operator, and it is the one every path in this pipeline actually uses
in this project (Rigify-generated skeleton in, `ARMATURE_AUTO` binds the body mesh). It uses
Blender's "bone heat" weighting algorithm — heat diffusion from each bone through the mesh surface
— which is why a clean, non-self-intersecting, roughly-T-posed manifold mesh matters (see §1).

```python
import bpy

def parent_mesh_with_automatic_weights(mesh_obj, armature_obj):
    """Bind mesh_obj to armature_obj using Blender's bone-heat automatic weights.
    Requires: Object Mode, mesh in (approximately) the armature's rest/bind pose,
    no non-manifold geometry causing 'Bone Heat Weighting Failed'.
    """
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')

    mesh_obj.select_set(True)
    armature_obj.select_set(True)
    bpy.context.view_layer.objects.active = armature_obj  # armature MUST be active

    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
```

Key preconditions the pipeline must enforce before calling this (all discovered from primary/
community documentation, not the operator's own error messages, which are unhelpful):

- Mesh and armature transforms (location/rotation/**scale**) should be applied (`Ctrl+A` /
  `bpy.ops.object.transform_apply`) beforehand — un-applied scale is a common cause of the mesh
  "jumping" after parenting.
- The mesh must be reasonably manifold; Rodin/Hyper3D output occasionally has stray
  disconnected shells or inverted normals that trigger "Bone Heat Weighting Failed" and fall back
  to distance-based (much worse) weights. A pre-flight manifold check (or at minimum wrapping the
  call and checking `bpy.context.window_manager.operators[-1]` / the returned report for the
  failure string) is worth adding to the pipeline's asset-validation gate.

---

## 3. Bone naming/hierarchy conventions (2026 humanoid standards)

Every downstream game-engine target this project cares about (Unity Humanoid/Mecanim, Unreal 5
Mannequin/IK Rig) resolves bone identity by **name and hierarchy position**, not by any embedded
metadata — so the naming choice made at rig-generation time directly determines how much manual
remap work is needed at import time.

- **Rigify** generates deform bones with a `DEF-` prefix over a base name using Blender's `.L`/`.R`
  suffix convention (e.g. `DEF-upper_arm.L`); mechanism/IK-FK plumbing bones use `MCH-`, and the
  metarig's original bones are kept as `ORG-` for regeneration. Only `DEF-` bones should receive
  mesh vertex-group weights.
- **Unreal Engine 5 Mannequin** (`SKM_Manny`/`SKM_Quinn`) uses lowercase, underscore-separated names
  with `_l`/`_r` suffixes (e.g. `upperarm_l`), a `root` bone at the very top (required lowercase for
  the auto-retargeter), and dedicated twist bones between major joints. UE5's IK Rig/Retargeting
  system means a custom skeleton does **not** need to exactly match Manny's names — you map bones
  once in the IK Rig editor — but matching the convention reduces mapping ambiguity.
- **Unity Humanoid (Mecanim)** does not enforce specific bone name strings; it maps whatever names
  you have onto its internal `HumanBodyBones` enum via the Avatar Configuration UI (15 bones
  mandatory: Hips, Spine, Chest, UpperArm/LowerArm ×2, UpperLeg/LowerLeg ×2, plus head/hand/foot
  chains). Using human-readable, per-body-part names (as Rigify and UE conventions both do) makes
  Unity's automatic bone detection succeed without manual remapping. Unity strongly recommends
  configuring the Avatar from a T-pose.
- **Mixamo** uses a `mixamorig:` namespace prefix with PascalCase names (e.g. `mixamorig:LeftArm`,
  `mixamorig:Spine1`). This convention matters only if the pipeline ever retargets Mixamo motion
  library clips onto the project's own rig — the colon is sometimes stripped/rewritten by importers,
  and batch find-replace on `mixamorig:` + `Left`/`Right` is the standard bridge to `.L`/`.R` rigs.

### Bone mapping table (minimum coverage required)

| Body part | Rigify (`DEF-` deform bones) | Unreal 5 Mannequin | Unity Humanoid (`HumanBodyBones`) | Mixamo |
|---|---|---|---|---|
| Hips / pelvis | `DEF-spine` (root of spine chain) | `pelvis` | `Hips` | `mixamorig:Hips` |
| Spine chain | `DEF-spine.001` … `DEF-spine.00N` | `spine_01`, `spine_02`, `spine_03` | `Spine`, `Chest`, `UpperChest` | `mixamorig:Spine`, `Spine1`, `Spine2` |
| Neck | `DEF-spine.005` (or dedicated `DEF-neck`) | `neck_01` | `Neck` | `mixamorig:Neck` |
| Head | `DEF-spine.006` / `DEF-head` | `head` | `Head` | `mixamorig:Head` |
| Shoulder / clavicle | `DEF-shoulder.L` / `.R` | `clavicle_l` / `clavicle_r` | `LeftShoulder` / `RightShoulder` | `mixamorig:LeftShoulder` / `RightShoulder` |
| Upper arm | `DEF-upper_arm.L` / `.R` | `upperarm_l` / `upperarm_r` | `LeftUpperArm` / `RightUpperArm` | `mixamorig:LeftArm` / `RightArm` |
| Forearm | `DEF-forearm.L` / `.R` | `lowerarm_l` / `lowerarm_r` | `LeftLowerArm` / `RightLowerArm` | `mixamorig:LeftForeArm` / `RightForeArm` |
| Hand | `DEF-hand.L` / `.R` | `hand_l` / `hand_r` | `LeftHand` / `RightHand` | `mixamorig:LeftHand` / `RightHand` |
| Thigh | `DEF-thigh.L` / `.R` | `thigh_l` / `thigh_r` | `LeftUpperLeg` / `RightUpperLeg` | `mixamorig:LeftUpLeg` / `RightUpLeg` |
| Shin | `DEF-shin.L` / `.R` | `calf_l` / `calf_r` | `LeftLowerLeg` / `RightLowerLeg` | `mixamorig:LeftLeg` / `RightLeg` |
| Foot | `DEF-foot.L` / `.R` | `foot_l` / `foot_r` | `LeftFoot` / `RightFoot` | `mixamorig:LeftFoot` / `RightFoot` |

**Note on exact spine-bone count:** Rigify's default human metarig spine chain length
(`spine.001`…`spine.00N`) is a configurable property of the metarig rather than a fixed constant,
and community documentation does not converge on one canonical count — treat the numbers above as
representative and always read the actual generated armature's bone list
(`armature_obj.data.bones.keys()`) rather than hardcoding indices in production scripts.

---

## 4. Keyframe animation authoring via bpy

### 4.1 Frame budgets (project-specific, from the existing action pipeline)

This project's action taxonomy (`_workspace/20260723-solo-warden-rpg-concept/production/boss-motion-previs-action-pipeline.json`)
already defines 11 action types with explicit per-action frame budgets at 60 fps. These numbers are
internal project data, not external research, and are reproduced here because the new armature-based
authoring loop should key against them directly:

| Action | Min | Target | Max | Key poses | Loops? |
|---|---|---|---|---|---|
| idle | 72 | 120 | 180 | 3–5 | yes |
| move | 48 | 72 | 108 | 4–7 | yes |
| run | 48 | 84 | 120 | 5–9 | yes |
| hit | 36 | 54 | 84 | 5–8 | no |
| bighit | 54 | 84 | 132 | 6–10 | no |
| attack | 54 | 90 | 132 | 6–10 | no |
| critical | 42 | 72 | 96 | 5–8 | no |
| avoid | 24 | 42 | 72 | 4–7 | no |
| defence | 48 | 78 | 114 | 4–7 | no |
| die | 45 | 72 | 96 | 4–6 | no |
| show | 48 | 96 | 180 | 5–8 | no |

(The assignment's "11 action types, ~72–84 frames each" is an approximation; the real per-action
spread above ranges from 24 to 180 frames and should be treated as the source of truth.)

### 4.2 Pose bone keying pattern

Animate **pose bones** (`armature_obj.pose.bones[...]`), not the armature object's own transform —
object-level keying is exactly what the legacy proxy script does and exactly what this migration
replaces (see §6). Two practical requirements:

- Set `pose_bone.rotation_mode` explicitly (Rigify control bones and glTF/Rodin imports frequently
  default to `QUATERNION`) before keying `rotation_euler`, mirroring the same
  quaternion-vs-Euler footgun the legacy script already guards against at the object level.
- Key through `armature_obj.pose.bones[name].keyframe_insert(data_path=..., frame=...)` (called with
  the armature object as `self` via its pose bones) rather than raw F-curve manipulation — as of
  Blender 4.4+ this is also the *safe* path for another reason: see §4.4.

### 4.3 Action / NLA organization per clip

One Action per `{bossId}::{action}::{variant}` clip, matching this project's existing
`namingConvention.clipId` pattern, each pushed onto its own NLA track so multiple clips can coexist
on the same armature (e.g. for blending/preview) without stomping each other's keyframes:

```python
import bpy

def create_pose_action(armature_obj, action_name):
    """Create (or reuse) a dedicated Action for one clip and make it the
    armature's live action for keying. Blender 4.4+ auto-manages the
    required Action Slot when keyframe_insert() is called on pose bones
    of an object whose animation_data.action is already set to this action —
    see the 4.4+ slot gotcha in 4.4 below before reordering these calls."""
    armature_obj.animation_data_create()
    action = bpy.data.actions.get(action_name) or bpy.data.actions.new(name=action_name)
    action.use_fake_user = True  # survive being pushed to NLA with 0 users
    armature_obj.animation_data.action = action
    return action


def push_action_to_nla(armature_obj, action, track_name, start_frame=0):
    """Push a finished Action onto its own new NLA track (RNA-based —
    avoids bpy.ops.nla.action_pushdown's dependence on UI/editor context)."""
    track = armature_obj.animation_data.nla_tracks.new()
    track.name = track_name
    strip = track.strips.new(name=action.name, start=start_frame, action=action)
    armature_obj.animation_data.action = None  # clear live action; NLA strip now owns it
    return strip
```

### 4.4 Blender 4.4+ / 5.1 "Slotted Actions" gotcha — the single most important scripting change here

Blender's animation data model changed structurally in **4.4** (carried into 5.1): Actions are no
longer directly "the" animation for a data-block. Every animated data-block now needs an explicit
**Action Slot** linking it to the Action; assigning `obj.animation_data.action = my_action` alone
can silently produce *no visible animation* if no matching slot exists. This is a real risk for
this migration because most Rigify/keyframing tutorials and AI training data predate 4.4 and use
the old direct-assignment pattern unchanged.

The safe pattern used above avoids manual slot bookkeeping by relying on the documented behavior
that **`keyframe_insert()` auto-creates the required slot** for you when called normally (through
`pose_bone.keyframe_insert(...)`, not raw F-curve access). Two corollaries to keep in mind if this
pipeline ever needs to touch F-curves directly instead of going through `keyframe_insert`:

- Direct `action.fcurves` access is deprecated in 4.4+; F-curves now live under a `channelbag`
  reached via `action.layers[...].strips[...].channelbag(slot, ensure=True)`.
- If assigning a pre-existing Action to an object *before* any keys are inserted (as in
  `create_pose_action` above), verify `armature_obj.animation_data.action_slot` is non-`None` after
  the first `keyframe_insert()` call in an automated pipeline's self-test, rather than assuming the
  legacy 4.3-and-earlier one-line assignment "just works."

### 4.5 Concrete pose-to-pose keyframing loop

See §5.3 for the full runnable idle-breathing-loop example, which demonstrates the pattern above end
to end (rotation-mode fix, per-key-pose loop, Action naming, NLA push).

### 4.6 glTF/FBX export compatibility gotchas

1. **Quaternion discontinuity.** glTF stores bone rotation as quaternions for SLERP interpolation at
   runtime; a naive Euler animation crossing 180° can get exported as the "short path," silently
   reversing intended motion. Mitigation: enable **"Always Sample Animations"** in the glTF export
   settings (bakes every frame, sidestepping the interpolation ambiguity), or keep intermediate
   keyframes no more than ~90° apart if you deliberately avoid baking.
2. **Bone roll loss.** Blender's internal "bone roll" concept doesn't map 1:1 to glTF's node-local
   rotation representation and can be recalculated/lost on export, especially with non-uniform scale
   on bones (common with Rigify bendy-bone control bones). Apply all object transforms
   (`Ctrl+A`/`transform_apply`) before export, and prefer exporting the `DEF-` deform skeleton rather
   than Rigify's full control rig with its IK/FK mechanism bones.
3. **Root motion.** Game engines expect a single dedicated root bone (top of hierarchy) to carry
   translation for movement; if movement instead comes from IK targets or path constraints, those
   constraints must be **baked to keyframes** (`bpy.ops.nla.bake` / Bake Action) before export — the
   glTF exporter cannot serialize constraint logic itself.
4. **Coordinate system (Y-up vs Z-up).** Blender is Z-up; glTF is Y-up. Exporter mismatches here are
   the most common cause of an unexpected 90° rotation appearing after import into Unity/Unreal —
   verify the exporter's up-axis setting matches the target engine's expectation rather than
   discovering it via trial and error per-asset.

---

## 5. Concrete bpy code patterns

### 5.1 Generating and fitting a Rigify human metarig to an arbitrary imported mesh

```python
import bpy
import addon_utils

def ensure_rigify_enabled():
    """Rigify is bundled with Blender but disabled by default; enable it
    once per session (idempotent) before calling any rigify.* API."""
    if not addon_utils.check("rigify")[1]:
        addon_utils.enable("rigify", default_set=True)


def measure_mesh_landmarks(mesh_obj):
    """Derive rough proportional landmarks from a mesh's world-space bounding
    box: total height, and estimated hip/shoulder/head heights as fractions
    of height. This is a heuristic proxy for real skeletal landmark detection
    (no such detector ships with Blender) — good enough to reposition a
    generic humanoid metarig onto an arbitrary AI-generated mesh's proportions
    without per-asset manual tweaking."""
    deps = bpy.context.evaluated_depsgraph_get()
    eval_obj = mesh_obj.evaluated_get(deps)
    coords = [eval_obj.matrix_world @ v.co for v in eval_obj.data.vertices]
    zs = [c.z for c in coords]
    z_min, z_max = min(zs), max(zs)
    height = z_max - z_min
    return {
        "z_min": z_min,
        "height": height,
        "hip_z": z_min + height * 0.50,
        "shoulder_z": z_min + height * 0.78,
        "head_z": z_min + height * 0.94,
    }


def add_and_fit_human_metarig(mesh_obj):
    """Add Rigify's stock human metarig sample and rescale its main chain
    (root -> spine -> chest -> head) to match the target mesh's measured
    height, keeping default limb proportions (adequate for humanoid/near-
    humanoid Rodin output; non-humanoid creature meshes need Rigify's
    manual bone-chain editing instead — see section 2.2/2.4)."""
    ensure_rigify_enabled()
    landmarks = measure_mesh_landmarks(mesh_obj)

    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.object.armature_basic_human_metarig_add()
    metarig = bpy.context.object
    metarig.location = (mesh_obj.location.x, mesh_obj.location.y, landmarks["z_min"])

    # Rigify's stock human metarig is authored at ~1.8m tall; scale uniformly
    # to the measured mesh height so DEF bones land inside the mesh surface.
    default_metarig_height = 1.8
    scale_factor = landmarks["height"] / default_metarig_height
    metarig.scale = (scale_factor, scale_factor, scale_factor)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    return metarig


def generate_rig_from_metarig(metarig):
    """Run Rigify's Generate Rig step via the rigify module (not bpy.ops),
    which is documented as the more context-stable path for scripted/
    headless generation than the interactive-only operator."""
    import rigify
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    metarig.select_set(True)
    bpy.context.view_layer.objects.active = metarig
    rigify.generate.generate_rig(bpy.context, metarig)
    # Rigify names the generated armature object "rig" by default.
    return bpy.data.objects.get("rig")
```

### 5.2 Parenting the mesh to the resulting armature with automatic weights

```python
import bpy

def bind_body_to_rig(body_mesh_obj, generated_rig_obj):
    """Apply transforms, then bind with bone-heat automatic weights.
    Preconditions: body_mesh_obj is in (approximately) the rig's T-pose bind
    pose; both objects have no un-applied scale (enforced below)."""
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')

    body_mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = body_mesh_obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bpy.ops.object.select_all(action='DESELECT')
    body_mesh_obj.select_set(True)
    generated_rig_obj.select_set(True)
    bpy.context.view_layer.objects.active = generated_rig_obj  # armature must be active

    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    # Sanity check: bone-heat failures fall back to near-useless weights
    # without raising a Python exception, so verify every deform bone that
    # should have influence actually produced a vertex group.
    def_bones = {b.name for b in generated_rig_obj.data.bones if b.name.startswith("DEF-")}
    missing = def_bones - {vg.name for vg in body_mesh_obj.vertex_groups}
    if missing:
        print(f"WARNING: no vertex group created for deform bones: {sorted(missing)}")
```

### 5.3 Keyframing a pose-to-pose animation (idle breathing loop) into a named Action

```python
import bpy
from math import radians

# Rigify FK control-bone names differ slightly by rig version; resolve
# defensively rather than hardcoding a single naming scheme.
_CONTROL_BONE_CANDIDATES = {
    "chest": ["chest", "torso"],
    "head": ["head"],
    "upper_arm_l": ["upper_arm_fk.L", "upper_arm_ik.L"],
    "upper_arm_r": ["upper_arm_fk.R", "upper_arm_ik.R"],
}


def resolve_control_bone(pose_bones, role):
    for candidate in _CONTROL_BONE_CANDIDATES[role]:
        if candidate in pose_bones:
            return pose_bones[candidate]
    raise KeyError(f"No control bone found for role '{role}' among {pose_bones.keys()}")


def ensure_euler_rotation(pose_bone):
    if pose_bone.rotation_mode not in {'XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX'}:
        pose_bone.rotation_mode = 'XYZ'


def author_idle_breathing_action(armature_obj, boss_id, variant="v01", fps=60):
    """Author a simple pose-to-pose idle-breathing loop directly onto pose
    bones, matching this project's frame budget for the 'idle' action
    (target 120 frames @60fps) and its clip-id convention
    '{bossId}::{action}::{variant}'."""
    bpy.context.view_layer.objects.active = armature_obj
    bpy.ops.object.mode_set(mode='POSE')

    pbones = armature_obj.pose.bones
    chest = resolve_control_bone(pbones, "chest")
    head = resolve_control_bone(pbones, "head")
    arm_l = resolve_control_bone(pbones, "upper_arm_l")
    arm_r = resolve_control_bone(pbones, "upper_arm_r")

    for b in (chest, head, arm_l, arm_r):
        ensure_euler_rotation(b)

    action_name = f"{boss_id}::idle::{variant}"
    armature_obj.animation_data_create()
    action = bpy.data.actions.get(action_name) or bpy.data.actions.new(name=action_name)
    action.use_fake_user = True
    armature_obj.animation_data.action = action

    duration = 120  # frames, matches idle target budget (§4.1)
    key_poses = [
        (1,               0.0,              0.0),   # settle / neutral
        (duration * 0.5,  radians(2.2),     -radians(0.6)),  # inhale: chest lift, head micro-tilt
        (duration,        0.0,              0.0),   # exhale back to neutral (loop-safe)
    ]

    for frame, chest_pitch, head_yaw in key_poses:
        frame = round(frame)
        chest.rotation_euler = (chest_pitch, 0.0, 0.0)
        head.rotation_euler = (0.0, 0.0, head_yaw)
        arm_l.rotation_euler = (0.0, 0.0, radians(1.2) * (chest_pitch / radians(2.2) if chest_pitch else 0))
        arm_r.rotation_euler = (0.0, 0.0, -radians(1.2) * (chest_pitch / radians(2.2) if chest_pitch else 0))

        chest.keyframe_insert(data_path="rotation_euler", frame=frame)
        head.keyframe_insert(data_path="rotation_euler", frame=frame)
        arm_l.keyframe_insert(data_path="rotation_euler", frame=frame)
        arm_r.keyframe_insert(data_path="rotation_euler", frame=frame)

    # Ease interpolation for a breathing motion (avoid Blender's default
    # linear/bezier-with-overshoot reading as mechanical).
    for fcurve in _iter_action_fcurves(action):
        for kp in fcurve.keyframe_points:
            kp.interpolation = 'SINE'

    bpy.ops.object.mode_set(mode='OBJECT')

    # Push to its own NLA track so multiple clips (idle/move/run/...) can
    # coexist on the same armature without stomping each other's keys.
    track = armature_obj.animation_data.nla_tracks.new()
    track.name = action_name
    track.strips.new(name=action.name, start=1, action=action)
    armature_obj.animation_data.action = None

    return action


def _iter_action_fcurves(action):
    """F-curve iteration compatible with both the pre-4.4 direct
    action.fcurves API and the 4.4+ layered/channelbag structure — falls
    back to the legacy attribute if the layered one isn't populated,
    since Blender auto-upgrades legacy actions but a freshly scripted
    action may still expose .fcurves directly depending on version."""
    fcurves = getattr(action, "fcurves", None)
    if fcurves:
        yield from fcurves
        return
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for slot in action.slots:
                channelbag = strip.channelbag(slot, ensure=False) if hasattr(strip, "channelbag") else None
                if channelbag:
                    yield from channelbag.fcurves
```

---

## 6. Old approach vs. new approach — what concretely changes

| Aspect | Old (`scripts/boss-motion-previs-blender.py`) | New (this guide) |
|---|---|---|
| Rig object | Single empty/proxy object per boss (`{boss_id}_proxy`), or the raw imported mesh root if present | Three-part hierarchy: asset-root empty, static `_pedestal` mesh, `_armature` (Rigify-generated), `_body` mesh bound with auto weights |
| What gets keyframed | Object-level `location` / `rotation_euler` on the whole proxy/mesh object (`rig.keyframe_insert(data_path="location", ...)`) — a rigid-body transform, no per-limb deformation | Individual **pose bones** on the armature (`pose_bone.keyframe_insert(data_path="rotation_euler", ...)`) driving real mesh deformation through vertex weights |
| Rotation-mode handling | Already guards against `QUATERNION`/`AXIS_ANGLE` on the object (`rig.rotation_mode == "QUATERNION"` check) | Same guard now applied per pose bone (`ensure_euler_rotation`), plus the *new* Blender 4.4+ Action-Slot gotcha (§4.4) that didn't exist when the legacy script was written |
| Action/clip organization | One Action per boss (`{boss_id}_previs`) containing every action segment concatenated on a single timeline, demarcated only by timeline markers (`_build_markers`) | One Action per `{bossId}::{action}::{variant}` clip (matches the project's own clip-id convention already defined in `boss-motion-previs-action-pipeline.json`), each pushed to its own NLA track |
| Pose fidelity | `_derive_runtime_action_pose_data` — a deterministic *hash-based pseudo-drift*, explicitly documented in the old script as "tiny deterministic pose drift to keep preview readable in generated **rigless** output"; not real animation, just enough motion to distinguish clips in preview | Actual key-pose authoring per action's `signaturePoses` (already defined per-action in the pipeline JSON, e.g. idle's "weight settle, micro-balance, shoulder settle, pre-load gaze") driving real bone rotations |
| Asset lookup | `bpy.data.objects.get(boss_id)`, falling back to creating an empty proxy mesh if not found | `bpy.data.objects.get(f"{boss_id}_armature")` — the pipeline now *requires* a generated rig to exist (via §5.1/§5.2) rather than tolerating a rigless fallback |
| Mesh/pedestal separation | Not applicable — no mesh, no pedestal; the "rig" *is* an empty | Explicit: pedestal is a separate static sibling object, never touched by animation or rig-generation steps (§1) |
| Export readiness | Script only saves a `.blend` workfile (`bpy.ops.wm.save_mainfile`); never emits glTF/FBX | Pipeline must add an explicit glTF/FBX export pass per clip with "Always Sample Animations," applied transforms, and baked root motion (§4.6) — the old script has no equivalent step because object-level rigid transforms don't have quaternion-discontinuity or bone-roll problems in the first place |
| Game-engine retargeting | Not possible — proxy objects carry no bone names, so nothing maps to Unity Humanoid or UE5 IK Rig | Possible: DEF-bone names following the convention table (§3) give Unity's automatic bone detection and UE5's IK Rig editor a real, name-addressable skeleton to map onto |
| Markers/sidecar JSON generation | `_build_markers` / `_build_sidecar_for_boss` reference synthetic `startFrame`/`endFrame` fields from the timeline JSON | Conceptually unchanged for QA tooling, but should read actual NLA strip `frame_start`/`frame_end` extents from the generated Action once real per-clip Actions exist, rather than trusting only the source JSON's declared frame range |

**Net effect:** the new pipeline turns previs from "proof that timing/pacing reads correctly on an
inert placeholder" into an actual animation asset that can be exported and used in-engine — at the
cost of requiring every asset to pass through the auto-rig + auto-weight gate (§2/§5) before any
animation authoring can begin, which the empty-proxy approach never needed.

---

## References

- Blender 5.1 release notes (blender.org) — <https://developer.blender.org/docs/release_notes/5.1/>
- Blender Python API — `bpy.types.NlaStrips` (RNA reference for scripted NLA track/strip creation) — <https://docs.blender.org/api/current/bpy.types.NlaStrips.html>
- Blender Python API — `bpy.ops.object` (parent_set / transform_apply / mode_set operators) — <https://docs.blender.org/api/current/bpy.ops.object.html>
- Blender Manual — Rigify addon overview — <https://docs.blender.org/manual/en/latest/addons/rigging/rigify.html>
- UniRig — "One Model to Rig Them All: Diverse Skeleton Rigging with UniRig," SIGGRAPH 2025 — <https://arxiv.org/abs/2504.12451>
- UniRig source (VAST-AI-Research) — <https://github.com/VAST-AI-Research/UniRig>
- Auto-Rig Pro — Smart auto-rig feature documentation — <https://lucky3d.fr/arp/en/tuto.html>
- Unreal Engine 5 — Skeletal Mesh Animation System / Mannequin skeleton — <https://dev.epicgames.com/documentation/en-us/unreal-engine/skeletal-mesh-animation-system-in-unreal-engine>
- Unity Manual — Humanoid Avatar — <https://docs.unity3d.com/Manual/AvatarCreationandSetup.html>
- Blender Stack Exchange — `bpy.ops.object.parent_set(type='ARMATURE_AUTO')` scripting notes — <https://blender.stackexchange.com/questions/tagged/python+armature>
- Blender 4.4 animation system — Slotted Actions (blender.org developer notes) — <https://developer.blender.org/docs/release_notes/4.4/upgrading/>

**Explicit recency gaps (per assignment instruction):**

- The Blender 5.1-specific claims (release date, "Bone Info" geometry-nodes addition, point-release
  bugfix counts) are sourced only to blender.org's own release notes; no independent 2026
  secondary-source corroboration was found during this research pass. Treat the *mechanics* of the
  Rigify/NLA/auto-weight workflow described here as solid (unchanged since 2024–2025), and the
  specific 5.1 version-number framing as informational context only.
- UniRig/SkinTokens are 2025 SIGGRAPH-era research; no 2026 update establishing a mature, drop-in
  Blender/`bpy` integration was found. The recommendation to use Rigify as the primary scriptable
  path (§2.1) rather than UniRig is a direct consequence of this gap, not a preference independent
  of it.
- Mixamo's "not officially shut down but unsupported/unstable" status (§2.3) reflects July 2026
  discussion sources (Reddit, StatusGator, community reporting) rather than an official Adobe
  end-of-life announcement, since none exists as of this research pass.
