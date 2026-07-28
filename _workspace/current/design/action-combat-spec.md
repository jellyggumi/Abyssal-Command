# Action Combat Spec — Hit & Slash 전투 동사

```yaml
run_id: 20260728-onslaught-action-pivot
status: "[TARGET] — 미측정 설계 목표"
owner_skill: design-action-combat
authority: design/master-numeric-contract.md
scope: 플레이어 전투 동사, 입력 계약, 접촉 권위, 콤보, 히트스톱 경계
```

---

## 1. 동사 상태 기계

모든 동사는 `IDLE → STARTUP → ACTIVE → RECOVERY → IDLE`을 지난다. 각 구간은 tick 단위 고정
길이이며 애니메이션이 아니라 **시뮬레이션이 소유**한다. 렌더러는 이 구간을 읽어 포즈를
맞추며, 포즈가 구간 길이를 바꾸지 못한다.

### 1.1 동사별 완전 사양

| 동사 | startup | active | recovery | 총 | 자원 | 접촉 형상 | 배율 | 쿨다운 |
|---|---|---|---|---|---|---|---|---|
| `LIGHT_1` | 8 | 3 | 8 | 19 | 없음 | 부채꼴 120° / 1500 | ×1.00 | 없음 |
| `LIGHT_2` | 9 | 3 | 9 | 21 | 없음 | 부채꼴 120° / 1500 | ×1.10 | 없음 |
| `LIGHT_3` | 12 | 5 | 20 | 37 | 없음 | 원형 360° / 2200 | ×1.80 | 없음 |
| `HEAVY` | 14 | 6 | 22 | 42 | 없음 | 원뿔 60° / 2600 | ×2.60 | 없음 |
| `DASH` | 2 | 10 (무적) | 6 | 18 | 충전 1 | 없음 | — | 충전 재생 90 |

수치 출처: `master-numeric-contract.md#3`, `#3.1`. 이 문서는 재정의하지 않는다.

기준 피해 `basicDamage = 900` (`defense-catalog.js#COMMANDER` `[OBSERVED]`)에 배율을 곱한다.

**startup이 긴 이유:** 콤보 취소가 recovery를 건너뛰므로(§1.2), 균형은 취소-압축
타임라인에서만 성립한다. 짧은 startup + 취소는 체인 DPS를 `HEAVY` 대비 43% 지배 경로로
만든다. startup을 늘려 취소-압축 상한을 `HEAVY` 옆(3510 vs 3343)에 고정했다.
권위 계산은 `master-numeric-contract.md#3.3`이다.

### 1.2 취소 규칙

| 동사 | 취소 가능 시점 | 취소로 진입 가능한 동사 |
|---|---|---|
| `LIGHT_1` | active 종료 후(tick 11~) | `LIGHT_2`, `DASH`, `SKILL_CAST` |
| `LIGHT_2` | active 종료 후(tick 12~) | `LIGHT_3`, `DASH`, `SKILL_CAST` |
| `LIGHT_3` | recovery 10 tick 경과 후(tick 27~) | `DASH`만 |
| `HEAVY` | startup 중(tick 0~13) | `DASH`만 |
| `DASH` | recovery 중(tick 12~) | `LIGHT_1` |

취소 시점은 각 동사 시작 tick 기준 상대값이다.

**설계 의도:** `LIGHT_3`와 `HEAVY`는 커밋이다. `LIGHT_3`는 광역 피니셔라서, `HEAVY`는
최고 배율이라서 각각 접촉 후 15 tick / 28 tick의 취소 불가 구간을 갖는다. 이 구간이
"무처벌 공격"을 막는 유일한 장치다(§5).

`HEAVY`의 startup 취소는 **페인트**를 허용한다: 예고를 본 적이 반응하면 대시로 빠진다.
이것은 의도된 심리전이며 startup 14 tick이 그 값을 만든다.

### 1.3 상태 전이표

| from | to | 전제 | 최소 체류 | 부수 효과 |
|---|---|---|---|---|
| `IDLE` | `STARTUP` | 입력 수락 + 동사 사용 가능 | — | `VERB_STARTED` 방출 |
| `STARTUP` | `ACTIVE` | startup tick 소진 | startup 전체 | 접촉 형상 활성화 |
| `STARTUP` | `IDLE` | 취소 입력 (`HEAVY`만) | 0 | `VERB_CANCELLED` |
| `ACTIVE` | `RECOVERY` | active tick 소진 | active 전체 | 접촉 형상 비활성화 |
| `RECOVERY` | `IDLE` | recovery tick 소진 | recovery 전체 | 콤보 창 개시 |
| `RECOVERY` | `STARTUP` | 콤보/취소 입력 + 허용 시점 | §1.2 표 | 콤보 카운터 +1 |
| any | `STAGGERED` | 피격 + 경직 판정 | 20 | 진행 중 동사 즉시 종료 |
| `STAGGERED` | `IDLE` | 경직 tick 소진 | 20 | 콤보 리셋 |

**`STAGGERED`는 `DASH` active 중 진입하지 않는다.** 무적 프레임의 정의가 그것이다.

### 1.4 발생 피드백

| 동사 | 시작 | 접촉 | 종료 |
|---|---|---|---|
| `LIGHT_1/2` | 검광 트레일 짧음 | 히트스파크 소 + 히트스톱 2 | — |
| `LIGHT_3` | 검광 원형 축적 | 원형 충격파 + 히트스톱 5 | 잔광 12 tick |
| `HEAVY` | 자세 예고 + 지면 균열 예고 | 방사 균열 + 히트스톱 6 | 먼지 20 tick |
| `DASH` | 잔상 3장 | — | 착지 먼지 |

VFX 상세는 `design/camera-vfx-direction.md`가 소유한다. 이 표는 트리거 목록일 뿐이다.

---

## 2. 입력 계약

### 2.1 신규 입력 타입

기존 `processInput`은 `MOVE`, `SKILL_CAST`, `SKILL_SELECTED`, `GROWTH_OFFER_SELECTED`,
`REWARD_SELECTED`, `STANCE_CYCLE`, `EXTRACT_ELITE`, `M4_CARD_DECISION`, `M3_TARGET_PROBE`를
수락한다 `[OBSERVED]` (`defense-run-simulation.js:1198-1283`). 다음을 추가한다:

| 타입 | payload | 수락 조건 | 거부 사유 코드 |
|---|---|---|---|
| `ATTACK_LIGHT` | `{ facing?: octant }` | 상태가 `IDLE` 또는 취소 허용 시점 | `VERB_LOCKED` |
| `ATTACK_HEAVY` | `{ facing?: octant }` | 상태가 `IDLE` | `VERB_LOCKED` |
| `DASH` | `{ direction: octant }` | 충전 ≥ 1 이며 상태가 `IDLE` 또는 취소 허용 시점 | `NO_DASH_CHARGE` / `VERB_LOCKED` |

`ATTACK_LIGHT`는 **단일 입력**이다. `LIGHT_1/2/3` 분기는 시뮬레이션이 콤보 카운터로
결정한다. 클라이언트가 `LIGHT_2`를 직접 요청할 수 없다 — 이것이 콤보 위조를 막는다.

### 2.2 입력 버퍼

| 키 | 값 | 의미 |
|---|---|---|
| `INPUT_BUFFER_TICKS` | 8 | 버퍼 유지 길이 `[TARGET]` |
| `BUFFER_DEPTH` | 1 | 큐 깊이 — 1개만 보관 `[TARGET]` |

- **버퍼 대상:** `ATTACK_LIGHT`, `ATTACK_HEAVY`, `DASH`.
- **버퍼 비대상:** `MOVE`(항상 즉시 반영), `SKILL_CAST`(쿨다운이 이미 게이트), 그 외 전부.
- 버퍼된 입력은 다음 취소 허용 시점 또는 `IDLE` 진입 시 소비한다. 8 tick 안에 소비되지
  않으면 **폐기**하고 `INPUT_BUFFER_DROPPED`를 방출한다.
- 깊이 1은 의도적이다. 깊이 2 이상은 플레이어가 의도하지 않은 3타 자동 재생을 만든다.

### 2.3 지향(facing) 결정

기존 이동은 8방향 옥탄트다 `[OBSERVED]` (`defense-catalog.js#OCTANT_VECTORS`).

| 상황 | 지향 결정 |
|---|---|
| `MOVE` 입력 유지 중 공격 | 이동 방향 옥탄트 |
| 정지 중 공격 | 직전 이동 옥탄트 유지 |
| payload에 `facing` 명시 | 명시값 우선 |
| 명시 없음 + 반경 2600 안에 적 존재 | **최근접 적 방향으로 스냅** |

**옥탄트 스냅을 선택한 이유(터치 정당화):** 자유 조준은 두 번째 아날로그 입력을 요구한다.
휴대폰에서 왼손 이동 + 오른손 공격 버튼 배치(`ui/hud-information-architecture.md`)는 조준용
세 번째 접점을 낼 수 없다. 8방향 스냅 + 최근접 적 보정은 조준 부담을 0으로 만들면서
`HEAVY`의 60° 원뿔을 실용적으로 만든다. 결정론도 보존된다 — 연속 각도는 부동소수 재현성
위험을 키운다.

스냅 보정은 **`HEAVY`에만** 최근접 적을 사용한다. `LIGHT`는 120° 부채꼴이라 보정 없이도
맞고, 보정을 넣으면 플레이어가 의도한 방향과 어긋난다.

---

## 3. 접촉 권위

### 3.1 해결 순서

1. 시뮬레이션이 `ACTIVE` 진입 tick에 접촉 형상을 생성한다.
2. 형상 안의 적을 `id` 오름차순으로 정렬한다(결정론).
3. 각 대상에 대해 유효성 게이트를 통과시킨다.
4. 통과분에 피해를 적용하고 `MELEE_CONTACT`를 방출한다.
5. 렌더러가 방출된 이벤트를 읽어 VFX를 재생한다.

**렌더러는 접촉을 판정하지 않는다.** 시각 상태에서 물리 결과를 역산하는 경로는 없다.

### 3.2 유효성 게이트

| 게이트 | 조건 | 실패 시 |
|---|---|---|
| 방향 | 대상이 형상 각도 안 | 무접촉 |
| 사거리 | `distance ≤ 형상 사거리 + 대상 radius` | 무접촉 |
| 페이즈 | 대상이 `defeated`/`despawning`이 아님 | 무접촉 |
| 상태 | 공격자가 `ACTIVE` 구간 | 무접촉 |
| 중복 | `(actionId, targetId)` 미기록 | 무접촉 |

`actionId`는 동사 시작 시 발급하는 단조 증가 정수다. active 구간이 여러 tick이어도 한
대상은 **1회만** 맞는다.

### 3.3 방출 이벤트

| 이벤트 | 필드 | 시점 |
|---|---|---|
| `VERB_STARTED` | `verb`, `actionId`, `facing`, `atTick` | STARTUP 진입 |
| `VERB_CANCELLED` | `verb`, `actionId`, `intoVerb`, `atTick` | 취소 성립 |
| `MELEE_CONTACT` | `verb`, `actionId`, `targetId`, `damage`, `isCrit`, `atTick` | 접촉 성립 |
| `COMBO_ADVANCED` | `fromStep`, `toStep`, `atTick` | 콤보 진행 |
| `COMBO_DROPPED` | `atStep`, `reason`, `atTick` | 콤보 종료 |
| `DASH_IFRAME_START` | `actionId`, `atTick` | DASH active 진입 |
| `DASH_IFRAME_END` | `actionId`, `atTick`, `negatedHits` | DASH active 종료 |
| `INPUT_BUFFER_DROPPED` | `inputType`, `atTick` | 버퍼 만료 |
| `COMMANDER_STAGGERED` | `sourceId`, `ticks`, `atTick` | 경직 진입 |

`DASH_IFRAME_END.negatedHits`는 무적으로 무효화한 피격 수다. QA가 "회피가 실제로
작동했는가"를 세는 유일한 신뢰 지표다.

---

## 4. 콤보 규칙

### 4.1 체인

```
LIGHT_1 --(24tick 내 ATTACK_LIGHT)--> LIGHT_2 --(24tick 내)--> LIGHT_3 --> 리셋
```

`COMBO_WINDOW_TICKS = 24`는 직전 동사의 **active 종료 시점부터** 센다
(`master-numeric-contract.md#3`).

### 4.2 리셋 조건

| 조건 | 결과 |
|---|---|
| 24 tick 안에 `ATTACK_LIGHT` 없음 | 리셋 → `COMBO_DROPPED{reason:"WINDOW_EXPIRED"}` |
| `LIGHT_3` 완료 | 리셋 → `COMBO_DROPPED{reason:"CHAIN_COMPLETED"}` |
| `HEAVY` 사용 | 리셋 → `COMBO_DROPPED{reason:"HEAVY_USED"}` |
| 피격 경직 | 리셋 → `COMBO_DROPPED{reason:"STAGGERED"}` |
| `DASH` 사용 | **유지** — 창 24 tick 재시작 |

**`DASH`가 콤보를 유지하는 것이 이 전투의 핵심 설계다.** 회피가 공격의 반대말이 아니라
연장선이 되며, "hit & slash + 역동적" 요구를 만드는 장치다.

### 4.3 `HEAVY` 체인 금지

`LIGHT_2`에서 `HEAVY`로 이을 수 없다. 이유: `LIGHT_2`(×1.10) → `HEAVY`(×2.60)는
취소-압축 시 43 tick에 3330 피해(4646 DPS)를 내며 다른 모든 경로를 지배한다. 지배 전략을
막기 위해 `HEAVY`는 항상 `IDLE`에서만 시작한다.

### 4.4 워크드 예제 — 취소-압축 체인 타임라인

기준: `basicDamage` 900, 크리티컬 미적용, 단일 대상 `rusher`(HP 3000 `[OBSERVED]`).
**취소를 사용한 숙련 경로**이며, 이것이 균형 계산의 권위 타임라인이다
(`master-numeric-contract.md#3.3`).

| tick | 구간 | 사건 | 누적 피해 | rusher 잔여 HP |
|---|---|---|---|---|
| 0–7 | `LIGHT_1` STARTUP | `VERB_STARTED` | 0 | 3000 |
| 8–10 | `LIGHT_1` ACTIVE | `MELEE_CONTACT` 900 (tick 8) | 900 | 2100 |
| 11 | 취소 → `LIGHT_2` | `COMBO_ADVANCED{1→2}` — recovery 8 tick 생략 | 900 | 2100 |
| 11–19 | `LIGHT_2` STARTUP | — | 900 | 2100 |
| 20–22 | `LIGHT_2` ACTIVE | `MELEE_CONTACT` 990 (tick 20) | 1890 | 1110 |
| 23 | 취소 → `LIGHT_3` | `COMBO_ADVANCED{2→3}` — recovery 9 tick 생략 | 1890 | 1110 |
| 23–34 | `LIGHT_3` STARTUP | — | 1890 | 1110 |
| 35–39 | `LIGHT_3` ACTIVE | `MELEE_CONTACT` 1620 (tick 35) | 3510 | **처치** |
| 40–59 | `LIGHT_3` RECOVERY | 취소 불가. tick 50부터 `DASH`만 | 3510 | — |
| 60 | `IDLE` | `COMBO_DROPPED{CHAIN_COMPLETED}` | 3510 | — |

**체인 총 60 tick = 1.00 s, 총 피해 3510, 3510 DPS.**

취소를 쓰지 않으면 recovery 17 tick이 그대로 소비되어 77 tick / 2735 DPS가 된다.
**취소 숙련의 보상은 +28%다.**

### 4.4.1 도달 가능 경로 비교

| 경로 | 주기 tick | 피해 | DPS | 광역 | 취소 불가 구간 | 용도 |
|---|---|---|---|---|---|---|
| 풀 체인 (취소) | 60 | 3510 | **3510** | 360°/2200 | 15 | `SURGE`/`BIGWAVE` 정리 |
| `HEAVY` 반복 | 42 | 2340 | **3343** | 60°/2600 | 28 | 경직 대상 처형 |
| 풀 체인 (취소 없음) | 77 | 3510 | 2735 | 360°/2200 | 15 | 미숙련 기준선 |
| 체인 + `DASH` 이탈 | 78 | 3510 | 2700 | 동일 + 재배치 | 15 | 패턴 회피 병행 |
| `LIGHT_1` 반복 | 35 | 900 | 1543 | 120°/1500 | 0 | **비효율 — 자동 처벌** |

**수렴 폭 3343–3510 (5%).** 지배 경로가 없다. 선택의 근거는 DPS가 아니라 광역 커버리지와
위험 노출이다.

`LIGHT_1` 반복이 1543 DPS인 이유: `ATTACK_LIGHT`는 콤보 카운터로 분기하므로(§2.1)
`LIGHT_1`을 다시 내려면 콤보 창 24 tick 만료를 기다려야 한다. 주기 11 + 24 = 35 tick.
**스팸은 기계적으로 최악의 선택이 된다.**

`rusher` 3000 HP는 `LIGHT_1` + `LIGHT_2`(1890)로는 죽지 않고 3타가 필요하다. 이는
`SKIRMISH`에서 플레이어가 콤보를 완주하도록 강제하는 의도된 HP 설정이다.

### 4.5 광역 상황 검산

`LIGHT_3`가 360°/2200 안의 6명을 동시에 맞히면 1회에 9720 피해다. `SURGE`의 동시 상한
34명 기준, 피니셔 6회로 이론상 전멸시킬 수 있다(6 × 60 tick = 360 tick = 6.0 s). 실제로는
적이 흩어져 있어 `aoe-burst` 스킬이 필요하다 — 이것이 스킬 카테고리 슬롯 2칸을 정당화한다.

---

## 5. 방어 수단의 목적 분리

| 수단 | 목적 | 비용 | 실패 시 |
|---|---|---|---|
| 간격 유지 | 예고를 보고 형상 밖으로 이동 | 시간(딜 손실) | 피격 |
| `DASH` 무적 | 이미 확정된 공격을 무효화 | 충전 1 (재생 90 tick) | 충전 소진 시 대안 없음 |
| `sustain` 스킬 | 회피 실패의 보험 | 슬롯 1 + 쿨다운 | — |
| `HEAVY` 경직 | 적 공격을 시작 전에 끊음 | 28 tick 커밋 | 반격 피격 |

네 수단이 겹치지 않는다. 간격은 무료지만 느리고, 대시는 즉발이지만 자원이며, sustain은
사후이고, 경직은 선제적이지만 위험하다.

### 5.1 금지 패턴과 차단 장치

| 금지 | 차단 장치 |
|---|---|
| 무처벌 공격 | `LIGHT_3` 접촉 후 15 tick / `HEAVY` 28 tick 취소 불가 구간 |
| 회복 루프 | 콤보는 3타에서 강제 리셋. 무한 체인 없음 |
| 회피 불가 피해 | 모든 보스 패턴 최소 예고 45 tick > `DASH` 총 18 tick (§`boss-pattern-spec.md`) |
| 지배적 스팸 | §4.4.1 — **취소-압축 기준** 3343~3510 수렴(5%). 차별점은 광역/위험뿐 |
| 취소 지배 | startup 8/9/12로 취소-압축 상한을 3510에 고정 (§1.1) |
| 대시 스팸 | 충전 2 + 재생 90 tick. 연속 2회 후 1.5 s 공백 |
| 무적 남용 | 무적 10 tick은 지속 장판(hazard)을 막지 않는다 |

**무적이 장판을 막지 않는 이유:** 장판을 대시로 통과할 수 있으면 `ground-cluster`와
`arena-close` 패턴이 무의미해진다. 무적은 **순간 판정**만 무효화한다.

---

## 6. 히트스톱과 시뮬레이션 경계

### 6.1 규칙

히트스톱(`master-numeric-contract.md#3.2`, 2~18 tick)은 **연출 계층 전용**이다.

- 시뮬레이션 tick은 멈추지 않는다. `advanceDefenseRun(run, 1)`은 계속 호출된다.
- `getRunDigest()` 입력은 변하지 않는다.
- 리플레이는 히트스톱 없이도 동일 결과를 낸다.

### 6.2 렌더러 구현 계약

렌더러는 시뮬레이션 시계와 분리된 **표시 시계**를 갖는다.

```
displayTime += deltaMs × (holdRemaining > 0 ? 0 : 1)
holdRemaining -= deltaMs
```

- 히트스톱 중 렌더러는 **마지막 보간 포즈를 유지**한다.
- 히트스톱 종료 후 렌더러는 밀린 시뮬레이션 상태로 **보간 없이 즉시 동기**한다
  (`snap`). 이 스냅이 타격감의 실체다.
- 최대 누적 홀드 `HITSTOP_ACCUM_CAP = 20 tick`. 초과분은 폐기한다. 빅웨이브에서 다수
  접촉이 홀드를 누적해 화면이 멈추는 것을 막는다.
- 일시정지·사망·리셋 시 `holdRemaining = 0`으로 즉시 해제한다.

### 6.3 데스싱크 금지 검증

`tests/`에 다음을 둔다: 같은 시드·같은 입력열을 (a) 히트스톱 활성 렌더러, (b) 렌더러 없음
두 경로로 실행해 `getRunDigest()`가 **바이트 동일**함을 단언한다.

---

## 7. 결정론 테스트 픽스처

| # | 픽스처 id | 시드 | 설정 | 단언 |
|---|---|---|---|---|
| 1 | `combat-timing-early` | 7001 | `LIGHT_1` active 종료 전(tick 9) `ATTACK_LIGHT` | 버퍼 적재, tick 11에 소비, `COMBO_ADVANCED` 1회 |
| 2 | `combat-timing-late` | 7002 | active 종료 + 25 tick 후 입력 | `COMBO_DROPPED{WINDOW_EXPIRED}` 선행, 새 `LIGHT_1` |
| 3 | `combat-wrong-direction` | 7003 | 대상이 부채꼴 밖 130° | `MELEE_CONTACT` 0건 |
| 4 | `combat-out-of-range` | 7004 | 대상 거리 1501 (`LIGHT_1` 1500) | `MELEE_CONTACT` 0건 |
| 5 | `combat-range-boundary` | 7005 | 대상 거리 1500 정확 + radius 260 | `MELEE_CONTACT` 1건 |
| 6 | `combat-multi-target` | 7006 | `LIGHT_3` 360°/2200 안에 6명 | `MELEE_CONTACT` 6건, 총 9720, id 오름차순 |
| 7 | `combat-single-contact` | 7007 | active 5 tick 동안 대상 형상 내 체류 | `MELEE_CONTACT` **1건만** |
| 8 | `combat-interrupted` | 7008 | `HEAVY` startup 중 피격 | `STAGGERED` 진입, `MELEE_CONTACT` 0건, `COMBO_DROPPED{STAGGERED}` |
| 9 | `combat-dash-cancel` | 7009 | `HEAVY` startup tick 10에 `DASH` | `VERB_CANCELLED{intoVerb:"DASH"}`, `HEAVY` 미발생 |
| 10 | `combat-dash-iframe` | 7010 | `DASH` active 중 3회 피격 판정 | 피해 0, `DASH_IFRAME_END{negatedHits:3}` |
| 11 | `combat-dash-hazard` | 7011 | `DASH` active 중 hazard 장판 통과 | hazard 피해 **적용됨** |
| 12 | `combat-dash-charges` | 7012 | `DASH` 3연속 | 2회 수락, 3회째 `NO_DASH_CHARGE` |
| 13 | `combat-dash-recharge` | 7013 | `DASH` 1회 후 90 tick 대기 | 충전 2 복귀 |
| 14 | `combat-combo-preserved` | 7014 | `LIGHT_1` → `DASH` → `ATTACK_LIGHT` | `LIGHT_2` 진입 (콤보 유지) |
| 15 | `combat-heavy-no-chain` | 7015 | `LIGHT_2` 후 `ATTACK_HEAVY` | `COMBO_DROPPED{HEAVY_USED}`, `HEAVY`는 `IDLE`에서만 |
| 16 | `combat-phase-change` | 7016 | 보스 70% 페이즈 전환 중 `LIGHT_1` | 전환 무적 존중, 접촉 0건, 콤보 유지 |
| 17 | `combat-cooldown-boundary` | 7017 | `DASH` 재생 89 tick / 90 tick | 89 거부, 90 수락 |
| 18 | `combat-pause-step` | 7018 | active 중 일시정지 → 1 tick step | 구간 tick 정확히 1 증가, 홀드 해제 |
| 19 | `combat-repeat-input` | 7019 | 같은 tick에 `ATTACK_LIGHT` × 5 | 1건 수락, 4건 `INPUT_BUFFER_DROPPED` |
| 20 | `combat-digest-parity` | 7020 | 렌더러 유/무 동일 입력열 | `getRunDigest()` 바이트 동일 |
| 21 | `combat-cancel-dps-ceiling` | 7021 | 최적 취소 체인 1주기 (§4.4) | 주기 정확히 60 tick, 피해 3510, DPS ≤3600 |
| 22 | `combat-nocancel-baseline` | 7022 | 취소 없이 체인 완주 | 주기 77 tick, 피해 3510 |
| 23 | `combat-light1-repeat-floor` | 7023 | 콤보 창 만료 후 `LIGHT_1` 반복 | 주기 35 tick, DPS ≤1600 |

전 픽스처는 `node --test 'tests/**/*.test.mjs'` 경로로 실행 가능해야 한다.

---

## 8. 마이그레이션 노트

### 8.1 폐기

| 대상 | 현재 `[OBSERVED]` | 처분 |
|---|---|---|
| `COMMANDER.basicCooldown` | 24 | **삭제** — 자동 공격 없음 |
| `COMMANDER.basicRange` | 6000 | **삭제** — §1.1 형상 사거리가 대체 |
| `COMMANDER.basicDamage` | 900 | **유지** — 배율의 기준값 |
| 자동 타겟 선택 | `orderedTargets(run, commander, basicRange)` | 접촉 형상 판정으로 대체 |
| `COMMANDER.critProfile` | chanceBp 1500 / multBp 20000 | **유지** — `sources`에 동사별 확장 |

`basicRange = 6000`은 `COMPANION_AUTONOMY.itemClaimRange`가 참조한다 `[OBSERVED]`
(`defense-catalog.js:34`). 삭제 시 이 참조를 별도 상수로 분리해야 한다. **엔지니어링 결정
필요.**

### 8.2 `processInput` 변경

- `ATTACK_LIGHT`, `ATTACK_HEAVY`, `DASH` 분기 추가.
- `run.commander.engaged = true` 목록에 3개 신규 타입 추가.
- 신규 런타임 상태: `commander.verbState`, `verbTick`, `actionId`, `comboStep`,
  `comboWindowUntil`, `dashCharges`, `dashRechargeTick`, `inputBuffer`, `staggerUntil`.
- 이 상태는 전부 `getRunSnapshot()`에 노출한다(렌더러가 읽어야 함). 스냅샷은 읽기 전용
  계약을 유지한다.

### 8.3 기존 테스트 영향

`tests/defense-run-simulation.test.mjs`의 자동 공격 DPS 단언은 전부 무효가 된다. 새 픽스처
(§7)로 교체하며, **기존 실패를 새 실패와 분리 보고**한다.
