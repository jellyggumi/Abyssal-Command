# Refinement Prompts — 5 Directions (Mesh-Size-Aware Retargeting)

> Produced via prompts.chat workflow (classify → fetch → adapt → output)
> Each prompt is a standalone role-based template ready for agent execution.

---

## Prompt #1 — 액션 다양화 (Action Diversification)

**Role**: 3D 게임 애니메이션 엔지니어 — 블렌더 리타겟 + Three.js 런타임 전문가

**Context**:  
현재 `battle-realtime-three.js`는 11개의 액션 키만 지원합니다:
`idle, walk, run, attack, hit, bighit, avoid, defence, critical, die, show`

각 캐릭터는 단일 `model.glb` (MOTION_MODELS)를 로드하며, 공격은 `Punching.fbx` 하나뿐입니다.
enemy 모델 매핑: `guardian→shadow-soldier-v04`, `rusher→scout`, `flanker→shade`, `ranged→possessed`, `player→lantern-reaver`, `commander→human-command-boss`, `monarch→broken-court-monarch-boss`, `shadow-commander→shadow-commander-boss`

소스 FBX 인벤토리 (`_workspace/current/animation-audit.json`): 6 Mixamo 캐릭 × 42 모션

**Task**:  
`attack` 하나를 최소 4가지 액션으로 확장하세요:
1. **attack_melee** — 근접 기본 (현재 Punching.fbx 계승, 개선)
2. **attack_ranged** — 원거리 공격 (새로운 Mixamo 모션 할당, 예: `Throw` 계열)
3. **attack_combo** — 2~3히트 연속기 (추가 FBX → 런타임 체이닝)
4. **attack_charge** — 차지 강공격 (크리티컬과 분리, 느린 템포 + 큰 리치)

**Mesh-Size-Aware Retargeting Constraint (MANDATORY)**:
- Mixamo 소스 FBX는 표준 1.8m Mixamo骨架 기준으로 모션을 제작함
- 타겟 캐릭터의 본 길이 비율이 소스와 다르면(예: boss 상완골 0.5u vs companion 0.3u) 단순 quaternion 델타 복사로는 mesh가 심하게 뒤틀림
- `retarget-ingame-motion-blender.py`의 현재 `rotation-only` 방식을 **per-bone proportional retargeting**으로 업그레이드:
  1. 각 본 쌍(source→target)에 대해 rest-pose bone-length ratio 계산
  2. quaternion 델타 적용 전, source 모션의 관절 arc radius를 ratio로 scaling
  3. `fitHeight()` 이후에 본 비율 보정이 undo되지 않도록 적용 순서 보장
- 런타임에서 `triggerAction()` (L2380)이 새로운 네 가지 attack key를 인식하도록 `startOneShot()` 분기 추가
- `beatPriority` 테이블: combo(가장 낮은 우선순위) < melee < ranged < charge(가장 높은 우선순위)

**Output**:  
1. 블렌더 리타겟 스크립트의 proportional bone-length 보정 로직 (diff)
2. `battle-realtime-three.js`에 추가할 attack 확장 코드 (triggerAction, MOTION_MODELS 업데이트)
3. 새 manifest.json에 추가될 clip entry들
4. `_workspace/current/engineering/asset-pipeline/motion-bench/`에 검증 스크립트

---

## Prompt #2 — 히트 리액션 정교화 (Hit Reaction Refinement)

**Role**: 액션 게임 애니메이션 디렉터 — 넉백/스턴/스태거 시스템 전문가

**Context**:  
현재 `hit` / `bighit` 두 가지만 존재하며, 모두 Mixamo 표준 리액션 FBX에서 단일 방향으로 리타겟됩니다.
런타임에서 히트 판정은 `battle-realtime-three.js`의 impact feel 시스템(라인 3498~)이 처리하지만,
애니메이션 자체는 방향/대미지 레벨에 관계없이 동일한 one-shot만 재생됩니다.

`animation-audit.json` 기준으로 다음 방향별 리액션 FBX가 존재:
- `Standing React Small From Left.fbx` (hit, 좌측)
- `Standing React Small From Right.fbx` (hit, 우측)
- `Receive Uppercut To The Face.fbx` (bighit, 정면 상단)
- `Standing React Large From Left.fbx` (bighit, 좌측)
- `Standing React Large From Right.fbx` (bighit, 우측)
- `Stomach Hit.fbx` (중단 대미지)
- `Knee Hit.fbx` (하단 대미지)

**Task**:  
히트 리액션을 **방향 × 대미지 레벨 2D 행렬**로 정교화하세요:

| | 경대미지 (hit) | 중대미지 | 중대미지 (bighit) |
|---|---|---|---|
| **정면** | Standing React Small From Back | Stomach Hit | Receive Uppercut |
| **좌측** | Standing React Small From Left | (좌측 중간) | Standing React Large From Left |
| **우측** | Standing React Small From Right | (우측 중간) | Standing React Large From Right |
| **후방** | (정면 미러) | (후방 중간) | Standing React Large From Back |
| **하단** | (정면 소) | Knee Hit | (하단 대형) |

**Mesh-Size-Aware Retargeting Constraint (MANDATORY)**:
- 히트 리액션은 mesh 변형이 가장 눈에 띄는 모션 클래스: 상대적으로 작은 캐릭터(companion, ~9.1u)가 boss 크기의 리액션을 재생할 때 과도한 mesh 찌그러짐 방지 필수
- **per-bone weight-based reaction scaling**: 각 히트 리액션의 joint arc를 타겟 mesh의 bone-length ratio로 조정
  - 예: boss 상체 대비 작은 상체를 가진 companion의 "Uppercut" 리액션은 chin arc radius를 companion 비율로 축소
- 팔다리가 짧은 캐릭터(scout류)는 리액션의 extremity offset을 비례 축소하여 mesh 펴짐 방지
- `author-wholebody-clips-blender.py`의 전체 참여율(absolute participation) 측정로직을 참고: 각 히트 리액션의 body-part activation threshold가 캐릭터 mesh size에 따라 달라져야 함

**Output**:  
1. 방향×레벨 히트 리액션 매트릭스 manifest entry
2. 리액션 방향 선택을 위한 공격 방향 감지 로직 (`combatDelivery` 확장)
3. per-bone length ratio 보정이 적용된 업그레이드 리타겟 스크립트
4. mesh-size에 따라 히트 리액션 강도(arc radius)를 스케일링하는 런타임 코드

---

## Prompt #3 — 오버레이 시스템 구현 (Overlay System Implementation)

**Role**: Three.js 애니메이션 시스템 아키텍트 — composite animation 레이어링 전문가

**Context**:  
`RUNTIME_ANIMATION_CONTRACT.md` §0 (2026-07-29 amendment)는 **overlay architecture**를 명세합니다:
> "Single skeletal composite — each body is a single `unarmed-core.glb` skeleton receiving secondary overlay on specific joint chains through a separate overlay GLB containing only additive tracks for those chains"

그러나 현재 `battle-realtime-three.js`의 `MOTION_MODELS`(L141-153)는 각 캐릭터가 단일 `model.glb`만 로드합니다. **Overlay 시스템은 CONTRACT에만 존재하고 런타임 코드에는 전혀 구현되지 않았습니다.**

`retarget-ingame-motion-blender.py`의 `COMPATIBLE_MESHES` 배열은 overlay 대상이어야 할 20개 mesh를 나열하지만, 실제로는 단일 `unarmed-core.glb`로 통합되어 모든 캐릭터가 같은 모션을 공유합니다.

**Task**:  
CONTRACT의 overlay architecture를 완전히 구현하세요:

1. **2-layer composite 시스템 구축**:
   - Layer 0 (base): `unarmed-core.glb` — locomotion(idle/walk/run/avoid/defence) + 전신 베이스
   - Layer 1 (overlay): 캐릭터별 `{character}-overlay.glb` — 상체 attack/critical/combo + 상체 리액션(hit/bighit)

2. **런타임 오버레이 믹서**:
   - `updateAnimations()`(L3445) 내에서 `presentationMixers`(L3455)는 현재 VFX 전용 — overlay composite mixer로 확장
   - `AnimationMixer.crossFade()`로 base→overlay 블렌딩 (cross-fade duration: 0.1s)
   - overlay 활성 시 base의 해당 본 체인은 델타만 얹고 pos/scale은 base 유지

3. **overlay 본 체인 정의** (CONTRACT 기준):
   - 상세: spine.004→spine.005→shoulder.L/R→upper_arm→forearm→hand
   - 하체: 일부 attack에서 lower body sync (차지/킥)

**Mesh-Size-Aware Retargeting Constraint (MANDATORY)**:
- Overlay GLB의 quaternion 델타는 **base skeleton의 bone-length ratio에 따라 재조정**되어야 함
- 즉, `unarmed-core.glb`는 표준 비율로 생성되지만, 각 캐릭터 mesh의 실제 bone 길이가 다르므로 overlay 델타를 적용할 때 target bone length / source bone length 비율로 delta magnitude를 스케일링
- 이것이 없으면: Lantern Reaver(긴 팔)의 overlay punch가 Shadow Soldier(짧은 팔)에 적용될 때 손이 뚫고 나가거나 mesh가 찢어짐
- `repair-joint-weights.py` 정규화 게이트 (spread + seam + seamDisjoint + rigidity + normalized)를 overlay 정합성 검증에 재사용

**Output**:  
1. `{character}-overlay.glb` 생성 파이프라인 (블렌더 스크립트)
2. `battle-realtime-three.js`의 overlay mixer 구현 코드
3. per-character bone-length ratio 테이블 생성 스크립트
4. overlay delta 스케일링 수학 (quaternion delta * length ratio)
5. 정합성 QA 게이트 (joint weight 분포 + mesh penetration 검증)

---

## Prompt #4 — 모션 품질 개선 (Motion Quality Pass)

**Role**: 게임 애니메이션 품질 리뷰어 — 모션 캡처 대체 및 Mixamo 탈피 전문가

**Context**:  
현재 121개 전체 클립 중 110개가 Mixamo FBX → rotation-only retarget입니다.
Mixamo 모션은 표준 T-pose 1.8m skeletal 비율 기반이므로, 비인간형 캐릭터(boss, monarch)에 적용 시 품질 한계가 명확합니다.

`animation-audit.json`:
- Mixamo 소스: Unarmed Idle, Walking, Running, Punching, Dodging, Body Block...
- Authored fallback: `_workspace/current/engineering/asset-pipeline/motion-bench/authored/` (11개만 존재)
- `author-wholebody-clips-blender.py`: 블렌더 Python API로 whole-body clip 제작 도구 있음

**Task**:  
다음 3단계로 모션 품질을 개선하세요:

1. **Phase A — Critical Clip 교체** (우선순위 최상):
   - `critical` (현재 `Illegal Elbow Punch.fbx`) → 느린 모션 + 큰 윈드업 + 카메라 연동
   - `bighit` (현재 `Receive Uppercut To The Face.fbx`) → 방향별 3종으로 확장
   - `die` → 캐릭터 역할별 차별화된 사망 모션

2. **Phase B — Additive 커브 도입**:
   - locomotion loop(idle/walk/run)에 body-sway, breathing, 무게중심 이동을 additive 커브로 추가
   - NLA track 기반 additive blending (retarget 후 별도 통과)

3. **Phase C — Authored Signature 모션**:
   - boss 전용: `author-wholebody-clips-blender.py`를 활용한 완전 오서드 모션
   - `measure-joint-articulation.py`로 관절 가동범위 측정 → Mixamo 범위 대비 차이가 큰 본 체인에 오서드 clip 적용

**Mesh-Size-Aware Retargeting Constraint (MANDATORY)**:
- 모든 새 clip 교체 및 오서드 제작 시, **캐릭터 mesh bone-length 비율을 모션 디자인 파라미터로 입력**받아야 함
- 예: boss Lantern Tyrant(~12.6u)의 `die` 모션은 Mixamo 표본 비율에 맞춰진 Uppercut 리액션을 사용할 수 없음 → giant skeleton 전용 낙하 모션을 bone ratio에 맞춰 오서드
- additive 커브(breathing sway, idle fidget)는 캐릭터 torso 폭/길이 비율에 비례하여 amplitude 조정
- `freeze-character-scale.py`(12개 캐릭터 frozen height) + `measure-character-plates.py`(pixel→world ratio) 데이터를 모션 길이/폭 파라미터로 직접 활용

**Output**:  
1. Critical/bighit/die clip 교체 manifest diff
2. Additive NLA track 블렌더 생성 스크립트 (per-character amplitude proportional)
3. 오서드 시그니처 모션: boss용 낙하/광폭화, commander용 지휘 poses
4. `freeze-character-scale.py` 출력을 읽어 모션 파라미터를 자동 조정하는 파이프라인

---

## Prompt #5 — 캐릭터별 차별화 (Per-Character Differentiation)

**Role**: 게임플레이 애니메이션 디자이너 — 캐릭터 역할(role) 기반 모션 세트 전문가

**Context**:  
현재 `ENEMY_MODELS` 매핑은 존재하지만, 모든 캐릭터가 동일한 `unarmed-core.glb` 모션 세트(110 retargeted + 11 authored 동일 분배)를 공유합니다.

각 캐릭터는 freeze-character-scale.py 기준 고유한 mesh 사이즈를 가집니다:
- Boss: cinder-warden 12.17u, veil-tactician 11.54u, gate-sovereign 12.16u, tide-warden 12.64u, pack-herald 11.86u, requiem-choir 11.23u, lantern-tyrant 12.14u, bridge-colossus 12.47u, veiled-concordat 10.81u, abyss-regent 11.35u
- Commander: dusk-warden 10.46u, shadow-commander-boss 11.49u, human-command-boss 11.15u
- Companion: ember-cohort 9.44u, rift-lens 9.16u, veil-vanguard 9.26u, anchor-shard 9.18u, throne-echo 9.61u, dawnless-crown 9.37u, pack-warden 9.08u, lantern-reaver 9.52u, requiem-warden 9.42u
- Enemy: scout 9.68u, shade 9.24u, guard 9.82u, possessed 9.04u, shadow-soldier-v04 9.41u

`battle-realtime-three.js`에는 role/gender/build 정보는 없고 `entityKind`와 `ENEMY_MODELS`만 존재합니다.

**Task**:  
캐릭터 역할 기반 3단계 차별화를 구현하세요:

1. **기본 차별화 — 속도/크기**:
   - boss locomotion: walk/run 속도 0.7x, idle 주기 1.5x 길게, fitHeight 후 추가 bone-length 보정
   - companion/light: walk/run 1.2x, idle fidget frequency 높게
   - 각도: boss 공격 윈드업 1.5x, companion 공격 회복 0.8x

2. **중간 차별화 — 역할별 모션 세트**:
   - **guardian류** (soldier/guard): heavy impact, shield 동반 defence
   - **rusher류** (scout): 빠른 어프로치, 낮은 자세
   - **ranged류** (possessed): 원거리 전용, 상체 위주 모션
   - **boss류** (monarch/tyrant): 2~3종 전용 공격, 서사적 die
   - **commander류**: 지휘 gesture, 버프 casting

3. **고급 차별화 — 고유 시그니처**:
   - 세부 역할군별 unique one-shot 등록 (ex: Gate Sovereign 전용 내려찍기, Tide Warden 전용 휩쓸기)
   - `author-wholebody-clips-blender.py`로 오서드한 clip을 별도 overlay GLB에 수납

**Mesh-Size-Aware Retargeting Constraint (MANDATORY)**:
- **이 차별화 과제의 핵심**: 모든 차별화 파라미터(속도 배율, arc radius, 윈드업 시간)는 **고정값이 아니라 캐릭터 mesh bone-length ratio의 함수**여야 함
- 구현: `freeze-character-scale.py` 출력을 런타임에서 읽어 각 캐릭터에 대해 `locomotionSpeedScale = f(legLength / torsoHeight)`, `reactionArcScale = g(boneLengthRatio)` 공식을 적용
- animation mixing(in-place root motion)에서 `inPlaceRootMotion: true`이므로, locomotion clip 자체는 고정 속도로 유지하고 런타임 `playbackRate` 조정으로 속도 차별화
- Monster boss(12.6u) vs Scout(9.7u)의 attack reach 차이는 uniform scale로는 해결 불가 → per-bone length ratio로 attack arc를 개별 스케일링
- `ENEMY_MODELS`를 확장하여 각 enemy entry에 `boneLengthProfile` 필드를 추가 (대/중/소/특수)

**Output**:  
1. 캐릭터 역할 분류 체계 (role taxonomy with motion profile template)
2. per-entity `boneLengthProfile` JSON 생성 스크립트
3. 런타임 `MotionProfile` 클래스 — 캐릭터별 playbackRate/arcScale/windup 적용
4. 역할별 locomotion/attack/reaction 세트 manifest diff
5. 오서드 시그니처 모션 GLB + manifest (boss 전용)

---

## 공통 파이프라인 주의사항 (ALL Prompts)

1. **production-readiness gate**:
   - `repair-joint-weights.py`의 5게이트(spread/seam/seamDisjoint/rigidity/normalized) 통과 필수
   - `RUNTIME_ANIMATION_CONTRACT.md`의 §0 amendment 준수 (자연스러운 joint 움직임, body region별 parent/child chain 바인딩, 단일 whole-body-bone collapse 금지)
   
2. **export contract**:
   - rotation-only retarget 유지 (position/scale tracks 없음)
   - `inPlaceRootMotion: true` 유지
   - GLB 포맷, quaternion xyzw, 24fps

3. **증분 적용 가능성**:
   - 각 prompt의 output은 현재 파이프라인(production 브랜치)에 **증분 적용** 가능해야 함
   - 기존 `unarmed-core.glb` + manifest.json과 충돌 없는 방식으로 설계
