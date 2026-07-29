# 그림자군단 — Combat & Extraction Systems Design

> **Status:** [TARGET] — all values pending QA simulation pass.
> **Lane:** design
> **Lifecycle:** systems (per CLAUDE.md §2 lifecycle order)

---

## 1. System Overview

그림자군단의 전투 및 추출 시스템은 다음 핵심 원칙으로 설계됨:

- **논타겟팅 범위공격**: 모든 공격은 특정 적을 타겟하지 않고 범위 내 적에게 피해를 입힘
- **적 추출 → 동료 소환**: 처치된 모든 적(기본/중간보스/보스)의 사체를 추출하여 동료로 변환
- **장비 범용 착용**: 무기/방어구/장신구를 플레이어·적·보스·동료 모두 착용 가능
- **등급 조합 성장**: 레벨업 + 3개 합성으로 등급 상승

---

## 2. Enemy Grade System (적 등급 시스템)

**파일:** `engineering/enemy-grade-system.js`

### 2.1 등급 분류

| 등급 | ID | 설명 | 메쉬 매핑 |
|---|---|---|---|
| 기본 | `BASIC` | 일반 적 개체 | `assets/mesh/enemy/possessed/`, `scout/`, `shadow-soldier-v04/` |
| 중간보스 | `SHADOW` | 그림자 정예 | `assets/mesh/enemy/shade/`, `shadow-commander-boss/` |
| 보스 | `BOSS` | 보스 등급 | `assets/mesh/boss/*` (s1~s10) |

### 2.2 기본 스탯 배율 [TARGET]

| 스탯 | BASIC | SHADOW (배율) | BOSS (배율) |
|---|---|---|---|
| HP | 3,000 | 15,000 (×5) | 45,000 (×15) |
| Damage | 12 | 42 (×3.5) | 96 (×8) |
| XP | 10 | 80 (×8) | 200 (×20) |
| Defense | 0 | 15 | 40 |
| CritChance | 500bp | 1,000bp | 1,500bp |

### 2.3 스탯 편차 (65% 범위)

같은 등급 내 각 스탯은 `[base × 0.65, base × 1.0]` 범위에서 결정론적 xorshift 시드로 변동.
총 편차 범위 = 35% (기준값 대비 최소 65%).

### 2.4 등급별 레벨 성장 수식


gradeMultiplier(grade, level) = (1 + growthRate)^(level - 1)
  BASIC:  growthRate = 0.08 (+8% 복리/레벨)
  SHADOW: growthRate = 0.06 (+6%)
  BOSS:   growthRate = 0.05 (+5%)


상위 등급은 기본 수치가 절대적으로 높고, 레벨당 성장률은 낮지만 기준값이 높아 결과적으로 항상 상위.

---

## 3. Combat & Weapon System (전투 & 무기 시스템)

**파일:** `engineering/item-weapon-catalog.js`

### 3.1 무기 사거리 분류

| 분류 | ID | 사거리 | AoE 패턴 | 최대 타격 | 피격 스타일 |
|---|---|---|---|---|---|
| 근거리 | `MELEE` | 900wu | 전방 180° 호형 | 5체 | 참격/강타 |
| 중거리 | `MID_RANGE` | 3,000wu | 60° 원뿔 또는 관통선 | 3체 | 찌르기/연쇄 |
| 원거리 | `RANGED` | 6,000wu | 1,200wu 반경 폭발 | 8체 | 폭발/관통 |

### 3.2 무기 목록 (12종, 사거리별 4종)

**근거리:** 그림자검, 불씨도끼, 공허철퇴, 심연송곳니
**중거리:** 쇄사창, 메아리채찍, 균열미늘창, 장막언월도
**원거리:** 혼궁, 묘지팡이, 폭풍쇠뇌, 여명포

### 3.3 AoE 히트 판정

충돌 시스템의 `queryBodiesInRadius()`로 범위 내 적 검색 후, 무기별 `aoePattern`에 따라 타격 대상 필터링.

---

## 4. Mesh Collision System (메쉬 충돌 시스템)

**파일:** `engineering/collision-system.js`

### 4.1 충돌 유형

| 유형 | 함수 | 설명 |
|---|---|---|
| Sphere-vs-Sphere | `sphereVsSphere()` | 모든 액터 간 충돌 (반경 기반) |
| Sphere-vs-Mesh | `sphereVsMeshTriangles()` | 액터 vs 지형 삼각형 메쉬 |
| Body Separation | `separateBodies()` | 12-pass 반복 분리 (기존 시뮬레이션 호환) |
| Terrain Resolve | `resolveTerrainCollision()` | 장애물 원형 충돌 해소 |
| AoE Query | `queryBodiesInRadius()` | 범위 내 바디 검색 |
| Raycast | `raycast()` | 투사체/시선 체크 |

### 4.2 고도(Elevation) 처리

- `stepHeight` (600): 한 틱에 올라갈 수 있는 최대 고도차
- `separationElevationTolerance` (900): 이 이상 고도차 바디는 다른 데크로 간주, 겹침 무시
- 삼각형 평균 고도와 바디 고도 비교하여 충돌 판정

---

## 5. Extraction & Summon System (추출 & 소환 시스템)

**파일:** `engineering/extraction-system.js`

### 5.1 사체 시스템

- 적 처치 시 사체 엔티티 생성 → **10초 (600틱)** 동안 유지
- 사체 위치: 적 사망 좌표 (x, y, elevation)
- `extractable: true` 상태에서 추출 가능

### 5.2 추출 메커닉

| 파라미터 | 값 | 설명 |
|---|---|---|
| 추출 범위 | 1,200wu | 사체 인근/옆/위에서 추출 가능 |
| 채널링 시간 | 2초 (120틱) | 범위 유지 필요 |
| 대상 | 모든 적 | 기본적, 중간보스, 보스 포함 |

### 5.3 추출 동료 스탯 변환 [TARGET]

| 원본 등급 | 피해 배율 | 공격속도 배율 | HP 계승 | 기본 사거리 | 충성도 |
|---|---|---|---|---|---|
| BASIC | ×1.5 | ×0.8 (빠름) | 30% | 4,000wu | 100 |
| SHADOW | ×1.8 | ×0.75 | 40% | 4,600wu | 120 |
| BOSS | ×2.0 | ×0.7 | 50% | 5,200wu | 150 |

---

## 6. Equipment Database (장비 데이터베이스)

**파일:** `engineering/equipment-database.js`

### 6.1 장비 슬롯

`weapon` · `head` · `body` · `hands` · `feet` · `accessory1` · `accessory2` (총 7슬롯)

### 6.2 장비 특성 (15종)

화염피해, 생명력흡수, 범위강화, 속도강화, 방어관통, 치명강화, 생명력재생,
쿨다운감소, 사거리확장, 그림자장막, 메아리증폭, 관문강화, 추출강화, 충성결속, 영혼연결

### 6.3 세트 보너스 (3세트)

| 세트 | 2세트 효과 | 3세트 효과 |
|---|---|---|
| 그림자 세트 | 피해 +10% | 그림자 범위 공격 추가 |
| 메아리 세트 | 사거리 +15% | 메아리 연쇄타 추가 |
| 관문 세트 | 방어력 +20% | 관문 강화 주기적 발동 |

### 6.4 희귀도 등급

`common` → `uncommon` → `rare` → `epic` → `legendary`

### 6.5 착용 대상

모든 장비에 `equippableBy` 배열: `["player", "enemy", "boss", "companion"]`

---

## 7. Leveling & Grade Combination (레벨링 & 등급 조합)

**파일:** `engineering/leveling-system.js`

### 7.1 동료 레벨링

| 등급 | 최대 레벨 | 성장률(피해) | 성장률(HP) |
|---|---|---|---|
| BASIC | 30 | +3%/lv | +4%/lv |
| SHADOW | 50 | +3%/lv | +4%/lv |
| BOSS | 70 | +3%/lv | +4%/lv |

XP 공식: `xpForLevel(lv) = floor(100 × 1.12^(lv-1))`

### 7.2 장비 강화

- 최대 강화 레벨: 20
- 주 스탯 +5%/강화, 부 스탯 +2%/강화
- 성공률: 1~10 (100%), 11~15 (90%), 16~18 (70%), 19~20 (50%)
- 비용: `enhanceCost(lv) = lv × 50 + floor(lv² × 2)`

### 7.3 등급 조합


3개 같은 등급 동료 → 1개 상위 등급 동료
  - 스탯 = 입력 평균 × 1.25 × 등급 배율
  - 레벨 = 최고 레벨 × 80%

3개 같은 등급 장비 → 1개 상위 등급 장비
  - 주 스탯 +50%, 최고 강화 레벨 유지
  - 특성 합집합


### 7.4 등급 티어 수치

| 티어 | 배율 (복리 25%) |
|---|---|
| BASIC | ×1.000 |
| UNCOMMON | ×1.250 |
| RARE | ×1.563 |
| EPIC | ×1.953 |
| LEGENDARY | ×2.441 |

---

## 8. Integration Points

### 8.1 파일 구조


_workspace/current/engineering/
  enemy-grade-system.js      ← 적 등급, 스탯 생성, 메쉬 매핑
  item-weapon-catalog.js     ← 무기 카탈로그, AoE 패턴, 피격 스타일
  collision-system.js        ← 충돌 처리 (Sphere/Mesh/AoE)
  extraction-system.js       ← 사체 추출 → 동료 소환
  equipment-database.js      ← 장비 DB, 특성, 세트 보너스
  leveling-system.js         ← 레벨링, 등급 조합, 강화


### 8.2 Import Chain


defense-catalog.js (COLLISION, TICK_RATE, 기존 상수)
  ↓
collision-system.js, extraction-system.js (런타임 상수 참조)
  ↓
defense-run-simulation.js (통합 대상)


### 8.3 기존 시스템 호환

- `meshColliders`, `obstacles`, `surfaces` → `stage-world-catalog.js`에서 동일 구조 사용
- `separateBodies()` → 기존 `COLLISION.separationPasses` (12) 동일 적용
- 결정론적 시뮬레이션 유지: 정수 연산, xorshift RNG

---

## 9. Blender MCP Integration Notes

### 9.1 개별 메쉬 오브젝트

- 각 장비 아이탬은 낱개 메쉬로 분리
- `assets/mesh/prop/` 하위 오브젝트: fbx/glb/obj 포맷 병행
- 착용 시 캐릭터 리그의 attachment point에 결합

### 9.2 착용 호환성

- 무기: `weapon` 본에 부착 (오른손/왼손)
- 방어구: 해당 본 그룹에 skinning
- 장신구: 별도 오버레이 메쉬 또는 파티클 이펙트

### 9.3 애니메이션 호환

- 3D 키프레임 애니메이션 시 장비 메쉬가 캐릭터 본 트랜스폼을 따라가도록
- `SkeletonUtils.clone()` (Three.js) 사용하여 장비 착용 상태의 리그 복제
- Blender MCP를 통한 attachment point 설정 및 weight painting 자동화

---

## 10. 캐릭터 특성 (webtoon-harness 연동)

각 적/보스/동료의 캐릭터 특성은 `webtoon-harness` 에이전트 팀의 서사 설정에 따라:

- **성격/동기** → 전투 AI 정책 (policyId) 매핑
- **외형 묘사** → 메쉬 에셋 선택 및 장비 기본 세트
- **서사 역할** → 등급 및 스탯 편차 시드 결정

---

*이 문서의 모든 수치는 [TARGET] 상태이며, Stage 2 QA 시뮬레이션 통과 후 확정됩니다.*
