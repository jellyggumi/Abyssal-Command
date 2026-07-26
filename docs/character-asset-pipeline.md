# Character Asset Pipeline — Rodin → Cartoon Texture → Rig → Animation

이 문서는 Abyssal Surge 캐릭터 리소스를 재생성할 때 사용하는 재현 가능한 파이프라인이다. 목표는 **캐릭터 본체만 genuine T-pose로 생성**하고, 지형·발판·무기·손에 든 소품은 처음부터 제외한 뒤, 별도 후보 lane에서 텍스처·리깅·애니메이션을 검증하는 것이다.

상태 표기: `[OBSERVED]`는 이 저장소에서 확인한 결과, `[TARGET]`은 통과 조건, `[BLOCKED]`는 현재 환경에서 아직 수행할 수 없는 단계다.

## 1. 절대 계약

1. Rodin 입력은 캐릭터 본체만 생성한다.
2. `terrain`, `floor`, `pedestal`, `platform`, `rocks`, `weapons`, `shields`, `held props`, `equipment`가 포함된 결과는 후보로도 통과시키지 않고 재생성한다. 융합된 marching-cubes 메시에 사후 본/오브젝트 회전을 적용해 제거하지 않는다.
3. T-pose 조건 메쉬, 생성 결과, 텍스처, 리그, 애니메이션은 `assets/images/battle/glb/` 밖의 별도 candidate lane에만 저장한다.
4. 텍스처는 캐릭터 본체의 active UV를 통해 Base Color에 매핑한다. UV가 없는 메시는 실패시킨다.
5. 실제 런타임 GLB 승격 전에는 rights receipt, T-pose, 지형/무기 부재, skin weight, 11개 clip, GLB export, Three.js 및 Canvas fallback 검증이 모두 필요하다.
6. 런타임 ID와 기존 배포 GLB는 자동으로 덮어쓰지 않는다.

## 2. 현재 lane layout

현재 cycle: `_workspace/20260726-stage2-balance-agency/`

```text
_workspace/20260726-stage2-balance-agency/engineering/asset-pipeline/
├── asset-lanes.json                         # lane validator policy
├── action-pipeline.json                     # 11-action timing/NLA contract
├── concept-input/                           # Rodin/gti reference and texture candidates
├── tpose-conditions/                        # Rodin BoundingBox ControlNet condition GLBs
├── runtime-candidates/                      # downloaded Rodin candidate GLBs, never shipped directly
├── texture-candidates/                      # Blender texture-mapped candidate GLBs
├── rig-candidates/                          # body-only skinned candidate GLBs
└── animation-candidates/                    # NLA-baked candidate GLBs
```

- Concept/reference input: `assets/images/battle/pilot/`
- Deployed runtime lane: `assets/images/battle/glb/`
- Validator: `scripts/validate-asset-lanes.py`
- Policy: `_workspace/20260726-stage2-balance-agency/engineering/asset-pipeline/asset-lanes.json`

A candidate `.glb`/image requires a sibling `.provenance.json` with `runtimeEligible: false` until promotion review. The validator intentionally allows missing candidate directories for a clean baseline.

## 3. Rodin Bridge prompt

### Positive prompt

```text
Generate a game-ready humanoid character source mesh in a genuine T-pose:
full body centered, arms extended horizontally, feet separated, neutral pose,
clean silhouette, topology suitable for skinning and animation. Character body
only; exclude terrain, floor, pedestal, rocks, platform, weapons, shields, held
props, equipment, debris, and background geometry. No text, logos, or watermark.
```

### Negative prompt

```text
terrain, floor, pedestal, rocks, platform, weapon, shield, sword, staff,
held prop, equipment, debris, background geometry, text, logo, watermark
```

`rodin-tpose-regen.py` stores this contract in the generated plan, uses a measured per-character blockout as the `bbox` condition, and never writes directly to `assets/images/battle/glb/`.

```bash
blender -b -P scripts/rodin-tpose-regen.py -- --plan-only
blender -P scripts/rodin-tpose-regen.py -- --submit --only cinder-warden
```

The submit step requires GUI Blender and an authenticated Rodin browser session. A downloaded result must first be copied into `runtime-candidates/<category>/`; no direct runtime replacement is allowed.

## 4. Cartoon texture generation and mapping

The texture prompt must request a **reference atlas**, not a perspective character illustration:

```text
Create a clean, game-ready cartoon-render albedo texture reference sheet for a
humanoid dark-fantasy character. Use an orthographic UV-atlas style layout with
separated front, side, back, limb, hand, leg, boot, cloth, and cloak material
panels; flat readable color blocks; blackened steel; ash-gray cloth; muted silver
edge accents; restrained cyan emissive accents; hand-painted cel-shaded wear.
This is a texture sheet/reference only, not a character illustration. No 3D
render, perspective, floor, terrain, pedestal, rocks, weapon, shield, held prop,
equipment, character silhouette, scene background, text, logo, or watermark.
```

`god-tibo-imagen` dry-run validation:

```bash
gti --prompt "<texture prompt>" \
  --image assets/images/battle/pilot/dusk-warden-idle-gti-refstyle.png \
  --size 1024x1024 --dry-run
```

The generated candidates used for this record are:

- `[OBSERVED]` v2 was rejected as a reference candidate after visual review found generated section labels; it remains non-runtime evidence only.
- `[OBSERVED]` v3: `_workspace/20260726-stage2-balance-agency/engineering/asset-pipeline/concept-input/dusk-warden-cartoon-albedo-v3.png`
- `[OBSERVED]` v3 SHA-256: `0f269d2f0de0b54c314697bda9ed9a6b629c6d84d61be1a536361b97e0c0668d`
- `[OBSERVED]` v3 provenance: adjacent `.provenance.json`, `runtimeEligible: false`
- `[OBSERVED]` v3 visual review shows an unlabelled atlas-like reference with front/side/back armor, arms, hands, legs, boots, cloth, and cloak panels.
- `[TARGET]` Blender must unwrap or project the body UVs and bake/pack the atlas into the candidate body material; the generated 2D atlas is not assumed to match arbitrary Rodin UV islands.

Mapping command:

```bash
python3 scripts/apply-cartoon-texture-blender.py \
  --glb <candidate-body.glb> \
  --texture _workspace/20260726-stage2-balance-agency/engineering/asset-pipeline/concept-input/dusk-warden-cartoon-albedo-v3.png \
  --asset-id dusk-warden \
  --out _workspace/20260726-stage2-balance-agency/engineering/asset-pipeline/texture-candidates/glb/dusk-warden.glb \
  --report _workspace/20260726-stage2-balance-agency/engineering/asset-pipeline/texture-candidates/reports/dusk-warden.json
```

The script preserves the source GLB, modifies only the body material, explicitly connects active UV coordinates to the image texture, and fails when the body has no UV map. Terrain/pedestal and weapon meshes are not recolored or promoted by this pass.

## 5. Character-only rigging and animation

Use `scripts/rig-character-asset-blender.py`, not the retired proxy/previs path. The current rig is a deform-only skeleton with Rigify-compatible `DEF-` names. It fits landmarks to the body, welds fragmented source vertices, binds with gated fallback methods, freezes a T-pose rest pose, and authors the action library.

```bash
blender -b -P scripts/rig-character-asset-blender.py -- \
  --glb <clean-tpose-source.glb> \
  --asset-id dusk-warden \
  --category commander \
  --rest-pose tpose \
  --out _workspace/20260726-stage2-balance-agency/engineering/asset-pipeline/rig-candidates/dusk-warden.glb \
  --report _workspace/20260726-stage2-balance-agency/engineering/asset-pipeline/rig-candidates/dusk-warden.json \
  --budgets-json _workspace/20260726-stage2-balance-agency/engineering/asset-pipeline/action-pipeline.json
```

The source-name audit rejects objects containing terrain/weapon/prop tokens; a pre-existing named `_pedestal` split is removed before export. It does not pretend that a fused mesh can be safely cleaned by name, so visual review remains mandatory.

The canonical action set is:

```text
idle move run hit bighit attack critical avoid defence die show
```

`build-motion-prompt-batch.py` creates concept/reference prompts for these 11 actions. It never creates a runtime animation or GLB:

```bash
python3 scripts/build-motion-prompt-batch.py \
  --asset-id dusk-warden \
  --out _workspace/20260726-stage2-balance-agency/engineering/asset-pipeline/motion-prompts/dusk-warden.json
```

The prompt packet preserves the concept vocabulary `hunt → extract → materialize → capture → assault`; Blender NLA remains the authoring step and runtime clip verification is required.

## 6. Verification checklist

| Check | Required evidence | Status |
|---|---|---|
| Rodin positive/negative prompt recorded | generated plan `promptContract` | `[OBSERVED]` code contract added |
| T-pose condition stored separately | `tpose-conditions/<asset>-tpose-condition.glb` | `[TARGET]` requires GUI Blender/Rodin |
| No terrain/pedestal | visual audit + object/mesh report | `[TARGET]` |
| No weapon/held prop | visual audit + object/mesh report | `[TARGET]` |
| Cartoon texture provenance | image + adjacent provenance JSON | `[OBSERVED]` Dusk Warden v3 candidate |
| Active UV mapping | Blender report `activeUvMap`, `uvLayerCount` | `[TARGET]` |
| Body-only skinning | rig report, weighted vertex counts, T-pose deviation ≤12° | `[TARGET]` |
| 11 action clips | NLA/GLB clip census | `[TARGET]` |
| Runtime safety | lane validator + GLB validator + browser/Canvas fallback | `[TARGET]` |

Current environment limitation:

- `[BLOCKED]` Blender is not installed on this workstation, so the Rodin GUI handoff, UV bake, rig bind, NLA bake, and GLB export have not been claimed as completed.
- `[OBSERVED]` The generation CLI is authenticated and dry-run validated; the Dusk Warden v3 candidate was generated without promoting it to runtime.

## 7. Useful references

- [Hyper3D Rodin](https://hyper3d.ai/)
- [god-tibo-imagen source](https://github.com/NomaDamas/god-tibo-imagen)
- [god-tibo-imagen npm](https://www.npmjs.com/package/god-tibo-imagen)
- [Blender Rigify source](https://github.com/blender/blender-addons/tree/main/rigify)
- [Khronos glTF](https://www.khronos.org/gltf/)
- [glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [glTF Validator](https://github.com/KhronosGroup/glTF-Validator)
- Local Rodin planning tool: `scripts/rodin-tpose-regen.py`
- Local texture mapping tool: `scripts/apply-cartoon-texture-blender.py`
- Local rigging tool: `scripts/rig-character-asset-blender.py`
- Local motion prompt tool: `scripts/build-motion-prompt-batch.py`
