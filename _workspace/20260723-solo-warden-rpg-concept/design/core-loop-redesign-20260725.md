# 코어루프 재설계 델타 — 3-스탠스 편성이 assault 단계에 통합되는 방식 (2026-07-25)

run-id: `20260723-solo-warden-rpg-concept` · lane: `design/core-loop-redesign-20260725.md` · role: game-designer (Core Loop)
입력: `design/stage1-reentry-synthesis-20260725.md` §2.3, `design/lane-coreloop.md`, `design/UNIFIED-GDD.md` §2/§4/§7/§9,
`pm/lane-engagement-map.md` EP-9, `qa/lane-risk-register.md` R2, `engineering/lane-formation-sim.md`,
`design/trend-survey/defense-offense-rpg-hybrid-deep-research-20260725.md`.

**이 문서는 델타다** — `design/lane-coreloop.md`/`design/UNIFIED-GDD.md`를 직접 수정하지 않는다. 디렉터가 병합할
갱신안만 정의한다. hunt→extract→materialize→capture→assault 체인은 불변(synthesis §1 기준선) — 이 문서는
assault 단계 내부 구조만 재설계한다.

## 0. 갭의 정확한 서술 (재확인, synthesis §2.3 인용)

`design/UNIFIED-GDD.md:77-85`가 전열(Vanguard)/포대(Turret)/분산(Split) 3-스탠스를 오프셋·반경·효과·파생
FRONT수까지 완전히 수치화했다 [OBSERVED, UNIFIED-GDD.md:79-85]. 그러나 라이브 코드는 여전히 2슬롯 FRONT/BACK
이진 시스템이다:

- `rpg-catalog.js:97-100` — `MAX_FRONT_SLOTS = 2`, `FORMATION_SLOTS = ["FRONT", "BACK"]`,
  `BACK_ROW_SYNERGY_DAMAGE_BONUS = 0.25`(고정 25%, 스탠스 개념 없음). [OBSERVED, 직접 코드 확인]
- `defense-run-simulation.js:200-207` `resolveFormation` — 동료별 개별 FRONT/BACK 배정을 받아 처리할 뿐,
  "스탠스"라는 전역 단위 입력이 없다. [OBSERVED]
- `defense-run-simulation.js:174-177` `livingFrontCompanions`, `:192-196` `playerSideTarget` — FRONT 슬롯
  동료만 적의 유효 타겟 후보다(synthesis §2.2 RESOLVED와 일치). 오프셋 좌표(1,400유닛 전방 등) 개념은
  존재하지 않는다 — `defense-run-simulation.js:240` `addCompanion`은 여전히 `run.commander.x/y`에 스폰하고
  틱마다 커맨더 좌표로 스냅한다(§2 인용, `lane-coreloop.md:11`). [OBSERVED]
- `app.js:394-399` `formationRowMarkup` — 동료 1기씩 "전열로"/"후열로" 토글 버튼(`data-warden-formation-target`)만
  제공. 이 함수는 동료 탭 편성 세그먼트(`app.js:437`, 오프배틀)와 일시정지 오버레이(`app.js:1572`,
  `interactive=false` 읽기 전용)에서만 호출된다 — **전투 중 실시간 편집 UI 자체가 존재하지 않는다.**
  [OBSERVED, 직접 코드 확인]
- `campaign-state.js:88,121-126,281-289` `companionFormationSlot`/`validCompanionFormation`/
  `setCompanionFormationSlot` — 편성은 캠페인 레벨에 저장되는 **동료별 개별 슬롯 맵**(`{companionId: "FRONT"|"BACK"}`)이며,
  런 시작 시 `resolveFormation`이 이 맵을 1회 소비해 얼려 넣는다. **런 중 스탠스 전환 커맨드나 그 처리
  경로가 어디에도 없다** — `defense-run-simulation.js` 전체에 "stance" 문자열 자체가 등장하지 않는다.
  [OBSERVED, grep 결과]

정리: 현재 코드는 (1) 스탠스가 아니라 동료별 개별 슬롯 토글이고, (2) 오프셋 좌표가 없어 3기가 항상 커맨더
좌표에 완전히 겹치고, (3) 편성 변경이 오프배틀 전용이라 런 중 재구성 자체가 불가능하다. 목표 설계(§2.2)는
이 세 가지 모두를 바꾼다.

## 1. Assault 단계 통합: 스탠스 선택 UX 플로우

### 1.1 트리거 지점 — pre-assault decision point (EP-9 확장)

`pm/lane-engagement-map.md:56` EP-9("습격 편성 재구성")는 이미 트리거를 "보스/습격 대상 확정 후 편성 화면
진입"으로 정의했고, `:98`은 가역성을 "스탠스(Vanguard/Rally/Split)는 습격 전 자유 재구성 가능"으로
명시했다(당시 "Rally"는 §2.2 개명 이전 이름, 지금은 Turret로 대체됨 — EP 문서 자체의 오탈자, 이 문서가
정정하지 않고 UI 레인 병합 시 함께 정정 필요). [OBSERVED, `pm/lane-engagement-map.md:56,98`]

**이 문서가 추가하는 것**: EP-9는 습격 대상 확정 "후"만 다루지만, `design/lane-coreloop.md:81`(후보 A
행동목록 2번, "포메이션 스탠스 전환")과 `:96`(후보 B, "포메이션 커밋")을 종합하면 스탠스 선택 지점은
**두 곳**이다:

1. **일반 웨이브 중 (후보 A, Vanguard Circuit 루프)**: 스탠스는 런 스코프 상태이며 언제든 재전환 가능
   (4초 쿨다운 게이팅만 적용). EP-9의 "습격 편성 재구성"이 사전-습격 1회성 이벤트처럼 읽히지만, 실제로는
   `lane-coreloop.md:82`가 명시한 대로 "자동전투 소모" 액션과 나란히 상시 가용한 액션이다 — 즉 EP-9는
   assault 단계에서 반복 가능한 인게이지먼트 포인트이지, 1회 한정 게이트가 아니다.
2. **정예/보스 조우 직전 (후보 B, Formation Assault 내포 루프)**: `lane-coreloop.md:95` "포메이션 커밋"이
   해당 조우 전용으로 스탠스를 **락**한다 — Kingshot expedition의 "출전 전 배치 확정"과 대응. 이 지점이
   EP-9가 원래 서술한 "보스/습격 대상 확정 후" 트리거와 정확히 일치한다.

**통합 결론**: EP-9는 두 트리거 모두를 포괄하도록 재서술되어야 한다 — (a) 상시 가용한 자유 재전환(4초
쿨다운만 게이팅), (b) 정예/보스 조우 직전의 커밋 락. `pm/lane-engagement-map.md:98`의
`reversible: true`는 (a)에는 맞지만 (b) 커밋 구간에는 적용되지 않는다 — **PM 레인이 EP-9 YAML에
`reversible: "true, except during formation-assault commit window"`로 세분화할 것을 제안**(이 문서의
소관이 아니므로 강제하지 않는다).

### 1.2 조작 감각 — 탭-사이클(tap-cycle) 단일 버튼, 메뉴/드래그 아님

**연구 근거 대조 (카테고리 1 vs 카테고리 3)**:

- 카테고리 1(Kingshot/Whiteout)은 **드래그앤드롭이 아니다** — Kingshot은 병종(보병/기병/궁병) 간 퍼센트
  분할 프리셋(50/20/30 등)을 선택하는 방식이고 [OBSERVED, 리서치 §1-1 세부질문3], Whiteout은 빈 슬롯 탭 →
  영웅 선택기 팝업의 2단계 탭 플로우다 [OBSERVED, 리서치 §1-2 세부질문3]. 두 게임 모두 "명명된 슬롯 배정"
  이지 "타일에 유닛을 드래그"가 아니다.
- 카테고리 3(Arknights)은 정반대 — **타입이 지정된 그리드로의 드래그앤드롭**이며, 근접/원거리 타일이
  구분되어 모든 타일이 모든 오퍼레이터를 받지 않는다 [OBSERVED, 리서치 §3-2 세부질문2]. KR Vengeance는
  탭-선택(원형 메뉴)이며 드래그를 전혀 쓰지 않는다 [OBSERVED, 리서치 §3-1 세부질문2].

**판정 — 어느 쪽도 그대로 이식하지 않는다, 이유가 다른 층위다**: Abyssal의 스탠스는 Arknights식
"오퍼레이터 개별을 타일에 배치"가 아니라 **전 편성이 하나의 프리셋 형태(전열/포대/분산)로 동시에
전환**되는 구조다 — Kingshot의 "병종 비율 프리셋 선택"과 구조적으로 더 가깝다(개별 유닛이 아니라 전체
배치 패턴을 한 번에 고르는 것). 이 유사성만으로도 드래그가 아닌 탭 기반 선택이 정답이지만, 별개로
edge-only-HUD 제약(`docs/abyssal-command-defense-survivor-design.md` "전장은 full-bleed... 중앙 패널로
위험 영역을 덮지 않는다")이 Arknights식 드래그-타겟 타일을 전장 위에 노출하는 것 자체를 차단한다 —
두 근거가 같은 결론(탭 기반)으로 독립적으로 수렴한다.

**채택**: `#battle-actions` 클러스터에 단일 edge-HUD 버튼(기존 `#extract-elite` 버튼 패턴 확장,
`ui/lane-hud-layout.md`가 소유할 정확한 좌표) — **탭 시 전열→포대→분산→전열 순으로 순환(cycle)**.
Whiteout의 "탭해서 열고 탭해서 고르는" 2단계 메뉴보다 더 단순한 이유: 옵션이 항상 정확히 3개로 고정되고
(N-슬롯 일반화 전까지, §2.4 디렉터 결정), 매번 전체 목록을 펼칠 필요 없이 단일 버튼 반복 탭으로 3개 중
원하는 것에 도달 가능(최악 2탭). 이는 Kingshot/Whiteout 둘 다 확인한 "메뉴 목록/드래그 아님" 원칙을
그대로 유지하면서, edge-HUD 1-버튼 제약에 맞춰 Whiteout의 2단계 팝업 메뉴보다 화면공간을 덜 쓰는 형태로
단순화한 것이다. 현재 선택된 스탠스는 정적 아이콘 상태로 표시(`lane-coreloop.md:28` "스탠스는 정적
아이콘 상태로 표현 가능"과 일치).

### 1.3 쿨다운 피드백

`lane-coreloop.md:49`/`UNIFIED-GDD.md:85`가 확정한 4초 쿨다운[TARGET]은 UI 피드백 없이는 "탭했는데 왜
반응이 없지"로 읽힌다. 기존 추출 진행 카운트다운의 시각 관용구(`ui/lane-hud-layout.md:83`, 링 형태
프로그레스)를 재사용해 스탠스 버튼에 방사형(radial) 채움 오버레이를 씌우는 것을 제안 — 신규 시각 언어
발명 없이 기존 패턴 재사용 원칙(§1.1 "죽일 수 없는 신기술은 출시하지 않는다"와 정합하는 저비용 선택).
정확한 시각 처리는 `UILayoutRedesign`(UI 재설계 델타) 소관 — 이 문서는 요구사항만 명시한다.

### 1.4 상태 스코프 — 런 스코프 유지, 변경 없음

`UNIFIED-GDD.md:105` "포메이션 스탠스 선택도 런 스코프 상태다"는 그대로 유지된다. 이 문서는 이 규칙에
변화를 제안하지 않는다 — 스탠스 전환 자체는 §1.1에서 서술한 대로 자유 재전환/커밋 락 두 트리거를 갖지만,
어느 쪽도 캠페인 영구 상태에 도달하지 않는다.

## 2. 코드 갭 — Before/After 명시 비교

| 축 | Before (라이브 코드) | After (GDD §2.2 목표 설계) | 파일:라인 |
|---|---|---|---|
| 편성 단위 | 동료 1기씩 개별 FRONT/BACK 토글 | 3기 전원이 하나의 스탠스(전열/포대/분산)로 동시 전환 | `app.js:394-399` (개별 토글 UI) vs `UNIFIED-GDD.md:79-83` (스탠스 표) |
| 슬롯 수 | 2슬롯(FRONT/BACK) | 3슬롯(전열/포대/분산) — 슬롯이 아니라 "전역 프리셋"으로 재정의 | `rpg-catalog.js:98` `FORMATION_SLOTS = ["FRONT", "BACK"]` |
| FRONT 상한 | 고정 2 (모든 편성 공통) | 스탠스별 파생값 — 전열2/포대0/분산1 | `rpg-catalog.js:97` `MAX_FRONT_SLOTS = 2` vs `UNIFIED-GDD.md:81-83` 표 |
| 위치 오프셋 | 없음 — 전원 `run.commander.x/y`에 스냅 | 스탠스별 8방향 이산 오프셋 벡터(전열 전방1,400/포대 후방300/분산 좌우2,000+후방300) | `defense-run-simulation.js:240` `addCompanion` (좌표 하드코딩 없음) vs `UNIFIED-GDD.md:81-83`, `lane-coreloop.md:49` (`OCTANT_VECTORS` 재사용 제안) |
| 후열 시너지 | 슬롯 기반, 고정 25% | 시너지 자체는 변경 없음(FRONT≥1 생존 시 BACK +25%) — 스탠스는 이 계산에 영향 없음, "몇 명이 FRONT인가"만 바꿈 | `defense-run-simulation.js:1595-1596`(변경 없음, 파생 FRONT수만 스탠스에 좌우) |
| 전환 시점 | 오프배틀 전용(동료 탭 편성 세그먼트) — 런 중 UI 없음 | 상시 가용(자유 재전환, 4초 쿨다운) + 정예/보스 직전 커밋 락 2단계 | `app.js:437`(오프배틀 세그먼트), `app.js:1572`(일시정지 읽기전용) — 런 중 편집 경로 부재 vs `lane-coreloop.md:81,95`(신규 요구) |
| 입력 채널 | 없음(전투 중 편성 입력 자체가 없음) | 신규 이산 커맨드, 기존 `MOVE` 옥탄트 입력과 나란히 추가 | 부재 vs `lane-coreloop.md:137` |
| 조작 UX | 카드형 버튼 "전열로"/"후열로"(동료별 반복) | 단일 탭-사이클 버튼(§1.2) | `app.js:398` (`data-warden-formation-target`) vs 이 문서 §1.2 |

**결론**: 이것은 점진적 확장이 아니라 데이터 모델 자체의 교체다 — "동료별 슬롯 맵"에서 "전역 스탠스
프리셋(각 프리셋이 오프셋+파생FRONT수를 결정론적으로 산출)"으로 축이 바뀐다. `campaign-state.js`의
`companionFormation: {companionId: slot}` 스키마는 스탠스 도입 후에도 **내부 파생값 저장용으로는
유지 가능**하다 — 플레이어가 스탠스를 선택하면 시스템이 로드아웃 순서 기준으로 몇 번째 동료가 FRONT인지
결정론적으로 파생시켜 이 맵을 채우는 방식(§2.1 매핑 표, `lane-coreloop.md:53-58`)을 유지하면 기존
`resolveFormation`/`validCompanionFormation` 계약을 크게 흔들지 않고 스탠스 레이어를 그 위에 얹을 수
있다 — 단, 이는 구현 세부사항이며 최종 스키마 확정은 `ProgFormationSim`/`ProgDataArch` 소관이다
[INFERENCE — 구현 난이도를 낮추는 설계 의도, 최종 판단은 프로그래머 레인].

## 3. R2 리스크 재평가 — 2슬롯에서 3스탠스로

### 3.1 원 R2의 정확한 서술 (재인용)

`qa/lane-risk-register.md:81-114` R2: "편성 조합이 동료 다양성을 무의미하게 만듦" — 메커니즘은 **인접
보너스(예: "같은 역할군 인접 시 +X%")** 방식이 도입될 경우 수학적으로 우월한 단일 편성 레시피가 발견될
위험 [OBSERVED, `qa/lane-risk-register.md:86-90`]. 완화 제약은 "동일 역할군 인접 보너스를 체감(diminishing
returns)으로 강제"+"최소 2개의 구조적으로 다른 편성 아키타입이 동일 보스 컨텐츠를 서로 다른 동료 역할
비율로 클리어 가능"[OBSERVED, `:99-103`].

### 3.2 코드 확인 — R2가 가정한 "역할 인접 보너스"는 현재 존재하지 않는다

`rpg-catalog.js:86-90` `COMPANION_ROLES`(vanguard/striker/support)를 직접 확인한 결과, 각 역할의 보너스는
**전원 무조건 고정 패시브**다: vanguard=자체 내구+30%/커맨더피격-5%, striker=피해+20%/보스대상+10%,
support=획득반경+10%/쿨다운-5% [OBSERVED]. 이 셋 중 어느 것도 "같은 역할군이 인접하면"이라는 조건을
갖지 않는다 — 실제로 존재하는 유일한 위치 기반 보너스는 `defense-run-simulation.js:1595-1596`의
슬롯 기반(역할 무관) 후열 시너지(FRONT≥1 생존 시 BACK 전원 +25%, 역할 조합과 무관)뿐이다. **R2가
가정한 정확한 실패 모드("같은 역할군 인접" 승수)는 현재 코드에 존재하지 않는다** — 이는 R2가 틀렸다는
뜻이 아니라, R2가 예방하려던 메커니즘이 아직 구현 전이므로 이번 3-스탠스 설계 단계에서 그 형태로
들어가지 않도록 계속 막아야 한다는 뜻이다.

### 3.3 3-스탠스가 R2의 "구조적 다양성" 요구를 부분적으로 자동 충족한다

R2의 완화 제약 중 "최소 2개의 구조적으로 다른 편성 아키타입"[OBSERVED, `:111`]은 **2슬롯 체계에서는
디자이너가 별도로 설계해야 하는 목표**였다(2슬롯 FRONT/BACK만으로는 "몇 명을 전방에 둘 것인가"라는
1차원 축만 존재, 아키타입 다양성이 저절로 생기지 않음). **3-스탠스 도입은 이 축을 3개의 서로 다른
공간적 파생값(전열=FRONT2/포대=FRONT0/분산=FRONT1)으로 자동 세분화**하며, 각 스탠스가 명시적으로 다른
적 유형에 대응한다(`lane-coreloop.md:45-47` 표: 전열↔rusher/guardian, 포대↔단일강적 지속딜링,
분산↔flanker) — 이는 R2가 요구한 "최소 2개"를 초과하는 **3개의 자연 발생 아키타입**을 무료로
제공한다. 이 점에서 3-스탠스는 R2의 완화를 **강화**한다.

### 3.4 그러나 R2의 핵심 우려(역할 다양성 붕괴)는 스탠스 수와 독립적으로 남는다 — 재평가 결론

3-스탠스가 자동 제공하는 것은 **위치 아키타입 다양성**(전열/포대/분산 3종)이지, R2가 진짜 걱정하는
**역할 아키타입 다양성**(vanguard/striker/support 3종 동료를 실제로 다양하게 보유할 유인)이 아니다.
§3.2에서 확인했듯 현재 세 역할의 보너스는 전부 스탠스 위치와 무관한 고정값이므로, 이론상 "스탠스와
무관하게 무조건 striker 3기가 최적"인 시나리오를 배제하지 못한다 — **단 하나의 예외**가 있다:
vanguard 역할의 "배치 중 커맨더 피격-5%"는 §2.2 표의 전열(Vanguard) 스탠스가 만드는 조기교전 상황과
의미상 정합하지만(전열 스탠스가 커맨더보다 먼저 교전에 들어가 커맨더가 피격받을 기회를 원천 차단하는
것과 별개로 vanguard 역할의 피격감소가 중첩 방어를 제공), 이는 **명시적 상호작용으로 코드화되어
있지 않다** — 두 시스템(스탠스 위치, 역할 패시브)은 완전히 직교(orthogonal)하게 설계돼 있다
[OBSERVED, `rpg-catalog.js` 어디에도 `stance`를 참조하는 역할 로직 없음].

**재평가 판정**: 3-스탠스는 R2의 "**공간적** 다양성" 요구를 초과 충족하지만, R2가 실제로 측정하려는
"**역할** 다양성 붕괴"(§3.1 인용)는 스탠스 개수와 무관하게 **balance-sheet.md가 역할별 보너스와 스탠스
사이에 의도적 상호작용을 설계하지 않는 한 여전히 미해결**이다 — 3스탠스 도입이 R2를 자동으로 해소하지
않는다. `qa/lane-risk-register.md:113`의 검증 방법("동일 보스 콘텐츠에 대해 편성 아키타입별 승률
매트릭스")은 이제 **3×3 매트릭스**(스탠스3 × 역할비율N)로 확장해야 정확히 검증된다 — 기존 문서가
암묵적으로 가정했을 2×N(FRONT/BACK 2슬롯 × 역할비율)보다 측정 표면이 넓어졌다.

**추가로 새로 발견된 상호작용 리스크 (이 문서의 신규 관찰)**: 포대(Turret) 스탠스는 파생 FRONT수 0을
가지므로 [OBSERVED, `UNIFIED-GDD.md:82`], `engineering/lane-formation-sim.md:122-123`이 명시한 Boss
Rally Window 발동 조건("FRONT≥1 채워진 편성일 때만 발동")을 **구조적으로 절대 만족시킬 수 없다** —
그러나 포대 스탠스의 설계 의도는 정확히 "단일 강적(정예/보스) 지속 딜링"이다(`lane-coreloop.md:46`).
즉 포대 스탠스는 자신이 가장 유용해야 할 정확한 시나리오(보스전)에서 Boss Rally Window의 쿨다운
20% 단축 보너스를 영구적으로 받을 수 없는 구조적 모순을 갖는다 — 이는 R2(다양성 붕괴)와는 다른
리스크지만 같은 3-스탠스 도입이 만든 신규 상호작용이므로 §5 디렉터 노트에서 별도로 표기한다.

## 4. Hunt/Extract/Materialize/Capture — 연구 기반 신규 제안 없음 (명시적 결론)

8게임 리서치를 hunt→extract→materialize→capture 4단계에 대해 개별 검토했다. **이 문서가 제안할 만한
연구 기반 신규 구조 패턴은 발견되지 않았다** — 이유를 단계별로 명시한다(assignment 요구사항: "새 발견이
없으면 발명하지 않는다"):

- **hunt(이동/웨이브 진행)**: Archero의 stutter-step 마이크로결정, Brotato의 웨이브-경계 케이던스,
  Arknights의 노-스폰-텔레그래프 설계 모두 UI/피드백 층위 발견이며 이미 `design/trend-survey/...md`
  §A/B(전투-성장 화면분리, 페이싱 경계 인터럽트)로 종합돼 UI 레인 백로그(synthesis §3 C/D/E)로 이관됐다
  — hunt 단계의 행동 구조 자체(이동+자동전투) 변경을 뒷받침하는 근거는 없다.
- **extract(정예 추출)**: Whiteout의 Crazy Joe "병력을 비우는 것이 최적"이나 Arknights DP 경제는
  거점방어/타일배치 경제 시스템이며 Abyssal의 결정론적 추출 윈도우(생존+포지셔닝) 구조와 대응하는
  신규 패턴이 없다 — 저지선(Undertow) 압력 정산은 이미 `UNIFIED-GDD.md §1.4`가 흡수했고, 이는 이
  문서 범위 밖의 hub-레이어 시스템이다("순수 hub-레이어 부가 시스템", `UNIFIED-GDD.md:63`).
- **materialize(동료 원형 결정)**: 8게임 중 이 단계에 정확히 대응하는 화면(정수 소비→원형 확정)을
  가진 레퍼런스가 없다 — Archero/Brotato의 3택 카드는 런-스코프 스킬 제안(이미 기존 계약)이지 영구
  원형 결정이 아니다.
- **capture(명부 슬롯 결정)**: 로스터 그리드 UI 패턴(Kingshot/Whiteout의 2단계 공개: 그리드=정체성만,
  드릴인=수치)은 UI 레인 소관(정보 아키텍처)이며 capture의 판단 구조(교체가치 판단, 은퇴 대가) 자체를
  바꾸는 근거가 아니다.

**결론**: hunt/extract/materialize/capture 4단계는 이 리서치 사이클에서 변경 제안 없이 그대로 유지한다.
이 문서가 다루는 유일한 구조 변경은 §1-3의 assault 단계 스탠스 통합이다.

## 5. 디렉터 핸드오프 노트

가장 중요한 단일 결정: **3-스탠스 도입은 R2 리스크를 "해소"하지 않고 "재구성"한다.** 공간적 아키타입
다양성(전열/포대/분산 3종, 각기 다른 적 유형 대응)은 스탠스 시스템 자체가 무료로 제공하므로 R2의
"최소 2개 구조적 아키타입" 요구는 이제 자동 충족되지만(§3.3), R2가 실제로 겨냥한 **역할 다양성**(동료를
다양하게 모으고 싶게 만드는 유인)은 §3.2에서 확인했듯 현재 코드의 역할 패시브(vanguard/striker/support)가
스탠스 위치와 완전히 직교하게 설계돼 있어 **여전히 별도 검증이 필요하다** — `qa/lane-risk-register.md`의
검증 매트릭스를 3(스탠스)×N(역할비율)로 확장해야 하며, 이는 이번 문서가 아니라 `design/balance-sheet.md`
(Stage 2)의 책임이다.

두 번째로 디렉터가 반드시 결정해야 할 것: **포대(Turret) 스탠스와 Boss Rally Window의 구조적 상호배타**
(§3.4 신규 발견) — 포대는 파생 FRONT수 0으로 설계 의도(보스전 지속딜링)를 갖지만 Boss Rally Window는
FRONT≥1을 요구해 포대 선택 시 절대 발동하지 않는다. 세 가지 해법이 있고 이 문서는 셋 중 하나를
선결하지 않는다: (a) 포대 전용 대체 보스전 보너스를 신설, (b) Boss Rally Window의 발동 조건을 FRONT≥1
에서 "편성 존재"로 완화(단, `engineering/lane-formation-sim.md:122-123`이 명시한 하위호환 근거—0-FRONT
레거시 편성과 랠리 미발동을 동일시하는 기존 계약—를 깨는 것이므로 `ProgFormationSim`의 재가 필요),
(c) 의도된 트레이드오프로 그대로 유지("포대는 지속딜은 얻지만 랠리 버스트는 포기"). 이 문서는 (c)를
잠정 기본값으로 제안하지만(추가 시스템 없이 이미 §2.1의 "주 효과" 서술과 상충하지 않으므로), 최종
판단은 밸런스 시트 시뮬레이션 이후 확정할 것을 권고한다.

세 번째: 스탠스 전환 UX(§1.2, 단일 버튼 탭-사이클)는 `UILayoutRedesign` 레인과 IRC로 조율 완료 —
좌표/시각 처리(방사형 쿨다운 링, 아이콘 글리프)는 그쪽 문서가 최종 소유한다. 이 문서가 고정한 것은
상호작용 모델(탭-사이클, 메뉴/드래그 아님)과 그 연구 근거뿐이다.

## Links
- 종합: `design/stage1-reentry-synthesis-20260725.md` §2.3
- 기존 코어루프: `design/lane-coreloop.md`
- 통합 GDD: `design/UNIFIED-GDD.md` §2(핵심루프), §4(포메이션 시뮬레이션), §7.1(EP-9), §9(R1-R5)
- 엔게이지먼트: `pm/lane-engagement-map.md` EP-9
- 리스크: `qa/lane-risk-register.md` R2
- 시뮬레이션 스펙: `engineering/lane-formation-sim.md`
- 리서치: `design/trend-survey/defense-offense-rpg-hybrid-deep-research-20260725.md` 카테고리 1(§1-1,1-2), 카테고리 3(§3-1,3-2)
- 코드 근거: `rpg-catalog.js:86-118`, `defense-run-simulation.js:174-207,1595-1598`, `app.js:394-399,437,1572`, `campaign-state.js:20,88,121-126,281-289`
