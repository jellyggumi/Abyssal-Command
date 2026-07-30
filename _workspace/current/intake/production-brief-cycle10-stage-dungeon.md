# Production brief — cycle 10: 스테이지 던전 구성

run-id: `20260728-onslaught-action-pivot`
cycle: 10
director: game-production-director (jeo session)
operating mode: **Stage 1 re-entry — content/asset build for three stage dungeons**
next public beat: 3스테이지 5–15분 사람 플레이 판정

---

## 0. 동시 사이클 경계 [OBSERVED]

`_workspace/current/intake/production-brief-cycle9.md`가 **cycle 9**를 선언한 상태로
트리에 있고, git에서 untracked다. cycle 9의 선언 범위는 **core-loop restructure +
control feel**(추출 게이팅, 군단 정원 3→10, 아날로그 입력, 조준 타게팅)이다.

이 브리프는 그것을 대체하지 않는다. 경계:

| 소유 | cycle 9 (타 세션) | cycle 10 (이 세션) |
|---|---|---|
| 코어 루프 순서·추출 게이팅 | **소유** | 읽기만 |
| 군단 정원 3→10 | **소유** | 읽기만 |
| 아날로그 입력 벡터·조준 | **소유(계약)** | 조이스틱 DOM/CSS 표면만 확장 |
| 스테이지 던전 레이아웃·경로 | 읽기만 | **소유** |
| 지형 런타임 자산 | 읽기만 | **소유** |
| 드롭·버프 시스템 | 읽기만 | **소유** |
| VFX 신규 큐 | 읽기만 | **소유** |
| 오디오 발소리·BGM 상태 | 읽기만 | **소유** |
| UI 전면 개편 | 읽기만 | **소유** |

`design/core-loop-legion-spec.md`(cycle 9)의 입력 계약이 조이스틱의 **권위**다.
이 사이클은 그 위에 DOM·CSS·가시성만 얹는다. octant 계약을 재정의하지 않는다.

---

## 1. bmad-gds intake schema

| Field | Value |
|---|---|
| game_type | Isometric action roguelite, wave-defense → extraction, browser |
| team_shape | Single operator + agent studio harness |
| engine | **Three.js + WebGL** (`vendor/three.module.js`) |
| current_stage | Stage 1 (concept/presentation/resources/core build) — 콘텐츠·자산 축 |
| next_public_beat | 3스테이지 각 5–15분 사람 플레이 판정 |
| source_packet | 오퍼레이터 요청 + `engineering/runtime-surface-maps/` 5개 discovery 보고서 |
| main_constraint | 결정론 불변: `getRunDigest()` depth-0 바이트 동일성. 신규 확률은 **파생 RNG 스트림**만 사용. |
| main_question | 세 스테이지가 각각 5–15분 동안 **읽히는 던전**이 되는가 — 평면 폴리곤 1장이 아니라 조합된 바닥, 기믹, 동선, 드롭으로? |

---

## 2. 요청 분해 [OBSERVED 근거]

| # | 요청 | 코드 현실 | 작업 등급 |
|---|---|---|---|
| 1 | 스테이지 3개 던전 컨셉별 터레인·맵 구성 | 세 스테이지 모두 `terrainGlbPath: null`, `procedural-flat-support` 폴백. 실측: 전투 화면 바닥이 **평면 폴리곤 1장**. `stage-world-catalog.js:122-125,202-205,285-288` | **신규 자산 + 카탈로그 재저작** |
| 2 | `*.terrain.raw.png` 기반 Blender 바닥 지형 | raw 플레이트 13개 존재. 기존 파이프라인은 **diorama**를 만들어 flat-gameplay 부적격 판정을 받았다 (`authored-diorama-not-flat-gameplay-eligible`) | **신규 flat-surface 경로** |
| 3 | 1개가 아닌 3개조합·5개조합 | 조합 개념 자체가 없다. 아레나는 24000×12000 단일 사각 | **신규 타일 조합 스키마** |
| 4 | 스토리라인에 맞는 맵·이동 경로 | 스토리 4목표×3스테이지 존재, route는 4웨이포인트 직선 1개 + 우회 1개 | **경로 재설계** |
| 5 | 5–15분 플레이타임 | gate-hold 170/175/180초 + 웨이브 10/10/11 + 보스. 현 목표는 300–480초 | **페이싱 재조정** |
| 6 | prop 아이템 드롭 → 스탯 버프 | `applyItem`이 **영구** 스탯을 즉시 부여. **시한 버프·모디파이어 기구 없음** (`map-simulation.md` §5) | **신규 시스템** |
| 7 | UI 전면 개편 | HUD 6패널 + 좌우 deck. 실측 1440×900에서 좌상단 밀집 | **재구성** |
| 8 | 가상키패드 → 가상조이스틱 | 조이스틱 DOM·CSS 존재하나 `(pointer: coarse) and (orientation: landscape)`에만 노출. 5버튼 상시 노출 | **가시성 컷오버** |
| 9 | 드롭·적등장·지형변형 이팩트 | VFX 33 이벤트 존재. `ITEM_COLLECTED` 있음. **드롭 발생·적 스폰·지형 변형 큐 없음** | **신규 큐 3종** |
| 10 | 배경음·효과음(걷기·공격·회피) | 오디오 50+ 이벤트, 100% 절차 합성. BGM/앰비언스 soundscape 6상태 **존재**. `movement=silentPolicy` — **발소리 없음** | **발소리 신규 + 상태 확장** |

---

## 3. 게이트 연결

| 게이트 | 이 사이클 입력 | 판정 조건 |
|---|---|---|
| G1 세계관 | 던전 레이아웃이 스토리 4목표를 서술하는가 | 스테이지별 목표↔공간 1:1 매핑 |
| G2 밸런스 | 5–15분 페이싱 | 시뮬레이션 측정 300–900초 |
| G4 몰입/접근성 | UI 개편 + 조이스틱 | 44×44 터치, 오버플로 0, 중앙 가시밴드 |
| G6 운영/성능 | 조합 지형 드로우콜·프레임 | p95 ≤16.7ms, 드로우콜 예산 |
| G7 코어 루프 | 던전 동선 완주 | 3스테이지 브라우저 완주 증거 |
| G8 최초 노출 | 조이스틱 학습 곡선 | 사람 플레이 판정 |

**이 사이클은 어떤 게이트도 PASS로 바꾸지 않는다.** 설계·자산은 측정이 아니다.

---

## 4. 증거 규칙

- 신규 수치는 전부 `[TARGET]`이다.
- 지형 승격은 `stage-world-catalog.js:387-394` 검증기가 요구하는 3항목 동시 충족으로만 성립한다:
  `terrainGlbPath`가 `assets/mesh/terrain/**/runtime/**` 하위, `terrainRuntimeEligible: true`,
  `terrainFallback` 삭제. 둘을 동시에 두면 "requires one eligible runtime strategy"로 throw된다.
- 회귀 베이스라인은 변경 착수 **이전에** 측정한다. 타 세션 변경 7건이 이미 트리에 있으므로
  사후 판별이 불가능하다.
- 결정론: 신규 확률은 `run.dropRng` 등 **파생 스트림**을 쓴다. `run.rng`를 소비하면
  하위 draw가 전부 이동해 시드 픽스처와 `getRunDigest()`가 깨진다.
  기존 패턴: `run.combatRng = rngNext(seed ^ 0x9e3779b9)` (`defense-run-simulation.js:3217,3446`).
