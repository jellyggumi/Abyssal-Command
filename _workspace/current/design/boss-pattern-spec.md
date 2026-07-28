# Boss & Enemy AI Spec — 회피 가능한 패턴과 판독 가능한 결정

```yaml
run_id: 20260728-onslaught-action-pivot
status: "[TARGET] — 미측정 설계 목표"
owner_skill: tune-enemy-ai
authority: design/master-numeric-contract.md
depends_on: [design/action-combat-spec.md, design/encounter-wave-spec.md]
scope: 결정 상태 기계, 지각 입력, 잡몹 행동, 보스 패턴 5종, 페이즈, 10보스 배치, 공정성
```

---

## 1. 결정 모델

모든 적대 개체가 같은 상태 기계를 쓴다. 보스는 `windup`/`attack`을 패턴으로 확장할 뿐
기계 자체는 동일하다.

| 상태 | 전제 | 종료 조건 | 최소 체류 | 쿨다운 효과 |
|---|---|---|---|---|
| `idle` | 스폰 직후 또는 타겟 소실 | 지각 범위 내 타겟 | 12 | — |
| `investigate` | 최근 피격 or 소음 | 타겟 확보 또는 30 tick 경과 | 30 | — |
| `pursue` | 타겟 확보 & 거리 > 공격 사거리 | 사거리 진입 또는 타겟 소실 | 20 | — |
| `reposition` | 사거리 내지만 각도/간격 불량 | 간격 확보 또는 45 tick | 20 | 공격 쿨다운 유지 |
| `windup` | 사거리 & 각도 & 쿨다운 0 | 예고 tick 소진 | **전체 (중단 불가)** | — |
| `attack` | `windup` 완료 | active tick 소진 | 전체 | 공격 쿨다운 시작 |
| `recover` | `attack` 완료 | recovery tick 소진 | 전체 | — |
| `stagger` | 경직 피해 수신 | 경직 tick 소진 | 전체 | 공격 쿨다운 +30 |
| `retreat` | HP < 임계 & 후퇴 정책 | 안전 거리 확보 | 40 | — |
| `defeated` | HP ≤ 0 | — | — | — |

### 1.1 지각 → 의도 → 운동 분리

```
1. perceive()  — 관측 입력만 수집. 상태를 바꾸지 않는다.
2. decide()    — 합법 행동 집합에서 의도 1개 선택. 이 tick에 1회만.
3. act()       — 선택된 의도로 이동/애니메이션. 결정을 재작성하지 않는다.
```

**결정은 행동 중간에 다시 쓰이지 않는다.** `windup` 진입 후에는 타겟이 이동해도 공격을
취소하거나 방향을 재조준하지 않는다. 이것이 "예고를 보고 피한다"를 성립시키는 유일한
조건이다.

이동 성공 여부는 **권위 있는 충돌·내비게이션 결과**로 판정한다. 렌더 포즈나 경로 완주
가정으로 역산하지 않는다.

---

## 2. 지각 입력과 결정 tick

### 2.1 수집 항목

| 입력 | 내용 |
|---|---|
| 거리 | 지휘관·동료까지 유클리드 거리 |
| 시야선 | 레이어 3 충돌과의 교차 여부 |
| 타겟 상태 | `DASH` 무적 중인가, 경직 중인가 |
| 점유 | 자기 주변 반경 1200 내 아군 수 (밀집 회피) |
| 위협 | 최근 300 tick 누적 피해원 |
| 체력 | 자기 HP 비율 |
| 타이머 | 공격 쿨다운, 상태 체류 tick |

### 2.2 결정 tick 분산 — 60체 동시 대응

**모든 적이 매 tick 결정하지 않는다.** 60체 × 60 Hz = 3600 결정/초는 프레임 예산
(`master#9` p95 ≤16.7 ms)을 먹는다.

```
DECISION_PERIOD = 6                       // tick
decidesThisTick = (entity.decisionSlot === run.tick % DECISION_PERIOD)
entity.decisionSlot = hash32(entity.id) % DECISION_PERIOD   // 스폰 시 1회 확정
```

- 슬롯은 `entityId` 해시로 **스폰 시 고정**한다. 런타임 재배정 없음 → 결정론 보존.
- 60체가 6슬롯에 분산되어 tick당 평균 10체만 결정한다.
- `windup`/`attack`/`stagger`는 슬롯과 무관하게 **매 tick 진행**한다. 타이밍이 6 tick
  단위로 뭉개지면 예고가 깨진다.
- 최대 결정 지연 5 tick(0.083 s)은 지각 반응으로 허용 가능하며, 오히려 일제히 반응하지
  않아 자연스럽다.

---

## 3. 잡몹 아키타입 행동

`defense-catalog.js#ENEMIES` 4종 `[OBSERVED]`. 각각 **다른 대응 동사**를 강제한다
(`encounter-wave-spec.md#2`).

| 항목 | `rusher` | `flanker` | `guardian` | `ranged` |
|---|---|---|---|---|
| HP / 속도 | 3000 / 3000 | 3600 / 3300 | 9000 / 1700 | 2800 / 2000 |
| 지각 반경 | 7000 | 9000 | 6000 | 11000 |
| 선호 간격 | 접촉 | 측후방 2000 | 접촉 | 5500 |
| 예고 tick | 20 | 16 | 34 | 28 |
| active | 6 | 5 | 10 | 투사체 발사 4 |
| recovery | 24 | 20 | 40 | 36 |
| 커밋 | 예고 후 취소 불가 | 동일 | 동일 | 동일 |
| 대응 동사 | `LIGHT` 풀 체인 | `LIGHT_3` 360° | `HEAVY` 경직 | `DASH` 접근 |

### 3.1 아키타입별 의도 규칙

- **`rusher`** — 최단 경로 직진. `reposition` 없음. 단순함이 정체성이다.
- **`flanker`** — 지휘관 정면 120°(= `LIGHT_1/2` 부채꼴) 밖으로 우회한 뒤 접근한다.
  정면에 있으면 `reposition`으로 측면을 잡는다. **부채꼴 공격이 안 닿는 위치를 노리는
  것이 설계 목적**이며, 그래서 360° 피니셔가 유일한 답이 된다.
- **`guardian`** — 느리고 예고가 길다(34). `HEAVY`(startup 14) 로 예고 중 끊을 수 있다.
  경직 시 공격 쿨다운 +30이 붙어 확정 딜 윈도우가 열린다.
- **`ranged`** — 간격 5500 유지. 지휘관이 3000 안으로 들어오면 `retreat`. 대시 거리
  2600으로는 한 번에 못 붙으므로 **대시 + 이동 조합**을 강제한다.

### 3.2 안티패턴 차단

| 금지 | 차단 장치 |
|---|---|
| 즉시 회두 후 타격 | `windup` 진입 시 방향 고정. active까지 재조준 없음 |
| 영구 추격 | 지각 반경 밖 + 180 tick 경과 시 `idle` 복귀. 셀 경계 리쉬(`pcg#6.1` 19번) |
| 차폐물 관통 공격 | 접촉 판정이 레이어 3 충돌 시야선을 요구 |
| recovery 스팸 | `recover` 종료 후 최소 12 tick `idle` 강제 |
| 동시 포위 | 동시 커밋 공격자 상한 8 (`encounter-wave-spec.md#4.3`) |
| 화면 밖 공격 | `VISIBILITY_RADIUS = 9000` 밖에서는 `windup` 진입 불가 |

---

## 4. 보스 패턴 5종

`master-numeric-contract.md#6`의 골격을 수치로 확정한다.

### 4.1 공통 계약

- 예고는 **월드 공간 데칼**이다. HUD 텍스트 단독 예고 금지.
- 예고 시작 = `windup` 진입. 데칼이 뜨는 순간부터 형상·위치가 **확정되고 변하지 않는다.**
- `PATTERN_COOLDOWN_MIN = 60` — 연속 패턴 사이 최소 간격.
- 반응 예산 **12 tick(0.2 s)** 을 회피 계산에 포함한다.

### 4.2 패턴 상세와 회피 증명

**전 치수는 `VISIBILITY_RADIUS = 3000` 안에 든다.** 근거는
`camera-vfx-direction.md#2.2`의 렌더러 좌표계 실측 — 화면 밖 위험은 회피 불가이므로
패턴 치수의 상한은 취향이 아니라 카메라가 정한다.

| 패턴 | 예고 | active | recovery | 피해 | 형상 | 최대 치수 |
|---|---|---|---|---|---|---|
| `radial-burst` | 90 | 12 | 40 | 220 | 보스 중심 원형, 반경 **2400** | 2400 |
| `line-sweep` | 45 | 10 | 32 | 180 | 직선 2줄, 각 반폭 900, 간격 1800 | 900 |
| `ground-cluster` | 90 | 20 | 36 | 160 ×n | 장판 6개, 각 반경 **1100**, 간극 **1800** | 1800 |
| `charge-rush` | 45 | 24 | 44 | 260 | 직선 돌진, 반폭 1100, 거리 **6000** | 1100 (횡) |
| `arena-close` | 120 | 30 | 50 | 340 | 외곽 수축, 안전지대 반경 **1600**, 최대 이동 **2600** | 2600 |

`charge-rush`의 돌진 거리 6000은 진행 방향 길이이며 **횡방향 회피 거리는 1100**이다.
플레이어는 경로 전체를 볼 필요가 없고 자기 위치의 폭만 판단하면 된다.

**회피 증명** (반응 12 tick 차감, 지휘관 속도 4100/s, `DASH` 2600 / 18 tick / 무적 10).
이동 소요는 **`ceil(거리 / 4100 × 60)`** — tick은 이산이므로 올림한다. 내림하면 1 tick
모자란 이동을 성립으로 받아들이는 픽스처가 만들어진다.

| 패턴 | 회피 수단 | raw tick | 소요 (올림) | 여유 tick | 요구 거리 | 도달 거리 | 가시 | 판정 |
|---|---|---|---|---|---|---|---|---|
| `radial-burst` | 도보 이탈 | 35.12 | **36** | **+42** (0.70 s) | 2400 | 5330 | OK | 여유 |
| `line-sweep` | 측면 `DASH` | 18.00 | **18** | **+15** (0.25 s) | 900 | 2600 | OK | 여유 |
| `ground-cluster` | 간극 이동 | 26.34 | **27** | **+51** (0.85 s) | 1800 | 5330 | OK | 여유 |
| `charge-rush` | 수직 `DASH` | 18.00 | **18** | **+15** (0.25 s) | 1100 | 2600 | OK | 여유 |
| `arena-close` | 안전지대 진입 | 38.05 | **39** | **+69** (1.15 s) | 2600 | 7380 | OK | 여유 |

`DASH`는 고정 18 tick이므로 올림 대상이 아니다.

전 패턴 여유 양수이며 전 치수가 가시 반경 3000 이내. `UNAVOIDABLE_PATTERNS = 0` 성립.

**대시 여유거리:** `line-sweep` 반폭 900 → 대시 2600으로 1700 초과 이탈. `charge-rush`
반폭 1100 → 1500 초과. 대시 방향이 다소 어긋나도 빠져나온다.

**연속 패턴 검산:** `PATTERN_COOLDOWN_MIN = 60`, 대시 충전 2 / 재생 90. 60 tick 간격
연속 2패턴은 충전 2로 대응 가능. 3연속(180 tick 경과)이면 재생 2회분이 들어와 충전 2가
회복된다. **대시 고갈로 회피 불가가 되는 구간은 없다.**

**이방성 데칼:** 원형 예고는 월드에서 타원으로 그린다
(`scale.x = r × 0.001167`, `scale.z = r × 0.002333`). 판정은 게임플레이 원이므로 표시가
월드 원이면 판정과 어긋난다(`camera-vfx-direction.md#2.6`).

### 4.3 패턴별 설계 의도

- **`radial-burst`** — 보스에게서 멀어지게 만든다. 근접 딜 중단을 강제하는 리듬 브레이커.
- **`line-sweep`** — 짧은 예고(45)로 즉각 반응을 시험한다. 2줄이므로 한 번 대시로 두 줄을
  동시에 피할 수 없게 간격을 900×2 + 1800으로 배치한다.
- **`ground-cluster`** — 공간을 읽게 만든다. 유일하게 **대시 무적으로 무시할 수 없는**
  패턴(장판은 지속 판정, `action-combat-spec.md#5.1`).
- **`charge-rush`** — 직선 위험. 수직 회피만 유효하며 뒤로 도망치면 잡힌다(돌진 6000 >
  도보 도달 2255).
- **`arena-close`** — 가장 긴 예고(120)로 가장 먼 이동(2600)을 요구한다. 딜 욕심을 처벌한다.

---

## 5. 페이즈 구성

`BOSS_PHASE_THRESHOLDS = HP 70% / 40%`.

### 5.1 페이즈별 변화

| 항목 | P1 (100–70%) | P2 (70–40%) | P3 (40–0%) |
|---|---|---|---|
| 패턴 풀 | 2종 | 3종 | 5종 |
| 패턴 쿨다운 | 150 | 120 | 90 |
| 애드 스폰 | 없음 | 600 tick마다 2 | 480 tick마다 3 |
| 예고 tick | **불변** | **불변** | **불변** |
| active/recovery | **불변** | **불변** | **불변** |
| 피해 | ×1.0 | ×1.15 | ×1.30 |

### 5.2 학습한 타이밍을 무효화하지 않는다 — 논증

`master-numeric-contract.md#6`은 페이즈가 학습된 타이밍을 무효화하지 못하게 요구한다.
이 설계가 그것을 지키는 이유:

1. **예고 tick이 페이즈에 걸쳐 상수다.** P1에서 `line-sweep`의 45 tick을 익히면 P3에서도
   45다. 플레이어가 다시 배울 것이 없다.
2. **active/recovery도 상수다.** 딜 윈도우 길이가 변하지 않으므로 "언제 때릴 수 있는가"의
   학습이 보존된다.
3. **변하는 것은 빈도·조합·피해량뿐이다.** 이 셋은 *압박*을 올리지만 *타이밍 지식*을
   폐기하지 않는다.
4. **신규 패턴은 추가만 되고 교체되지 않는다.** P1의 2종은 P3에도 그대로 있다. 배운 것이
   버려지지 않는다.

만약 P3에서 `line-sweep` 예고를 45 → 30으로 줄인다면 그것은 학습 무효화다. **금지한다.**
난이도는 예고 단축이 아니라 **동시성과 빈도**로 올린다.

### 5.3 페이즈 전환 창

| 항목 | 값 |
|---|---|
| 전환 무적 | 60 tick |
| 히트스톱 | 18 tick (`master#3.2`) |
| 진행 중 패턴 | 즉시 중단, 데칼 제거 |
| 플레이어 콤보 | **유지** (`action-combat-spec.md` 픽스처 16) |
| 애드 | 유지 (삭제하지 않음) |

전환 중 보스는 공격하지 않는다. 60 tick은 플레이어가 위치를 재정비하고 연출을 볼 시간이며,
`camera-vfx-direction.md`의 페이즈 전환 푸시인이 여기에 얹힌다.

---

## 6. 중간 보스 vs 최종 보스

| 항목 | `MIDBOSS` | `FINALE` |
|---|---|---|
| HP | 최종 보스의 45% | 100% |
| 패턴 수 | **2종** | **5종** |
| 페이즈 | 1개 (전환 없음) | 3개 (70%/40%) |
| 패턴 쿨다운 | **120** (고정) | 150 → 120 → 90 |
| 동시 패턴 | **금지** | P3에서만 허용 |
| 애드 | 600 tick마다 `guardian` 3 | §5.1 |
| 동시 생존 상한 | 12 | 8 |

### 6.1 `FINALE` 패턴 조합 규칙 (P3 한정)

- 동시 실행 최대 **2종**.
- 조합 시 **예고 시작 시점을 30 tick 이상 어긋나게** 한다. 두 데칼이 동시에 뜨면 판독
  부하가 급증한다.
- **금지 조합:** `arena-close` + 임의 패턴. 안전지대가 이미 이동을 강제하므로 중첩하면
  회피 여유가 음수가 된다.
- 허용 조합: `line-sweep` + `ground-cluster`, `radial-burst` + `line-sweep`,
  `charge-rush` + `ground-cluster`.
- 조합 후 다음 패턴까지 `PATTERN_COOLDOWN_MIN × 2 = 120` tick 대기.

---

## 7. 10스테이지 보스 배치

기존 보스 ID `[OBSERVED]` (`defense-catalog.js#BOSSES`)를 유지한다. 중보스는 기존 정예
ID(`STAGES[*].eliteId`)를 승격해 신규 고유명을 만들지 않는다.

| # | 스테이지 | 최종 보스 | 중간 보스 | P1 패턴 (2) | P2 추가 | P3 추가 (2) | 시그니처 |
|---|---|---|---|---|---|---|---|
| 1 | Cinder Span | `s1-cinder-warden` | `s1-ember-hunter` | `line-sweep`, `radial-burst` | `charge-rush` | `ground-cluster`, `arena-close` | 잿불 장판이 회피 경로에 잔류 |
| 2 | Veil Citadel | `s2-veil-tactician` | `s2-veil-sentinel` | `ground-cluster`, `line-sweep` | `radial-burst` | `charge-rush`, `arena-close` | 예고 데칼이 반투명 (판독 난도↑, 예고 길이는 불변) |
| 3 | Echo Throne | `s3-gate-sovereign` | `s3-throne-wraith` | `radial-burst`, `charge-rush` | `line-sweep` | `ground-cluster`, `arena-close` | 메아리 — 패턴이 60 tick 뒤 절반 위력으로 1회 반복 |
| 4 | Sunken Bastion | `s4-tide-warden` | `s4-anchor-diver` | `ground-cluster`, `arena-close` | `line-sweep` | `radial-burst`, `charge-rush` | 장판이 수면처럼 확산 (반경 +20%, 피해 −20%) |
| 5 | Howling Sprawl | `s5-pack-herald` | `s5-pack-sentinel` | `charge-rush`, `line-sweep` | `radial-burst` | `ground-cluster`, `arena-close` | 돌진이 애드를 동반 소환 |
| 6 | Glass Necropolis | `s6-requiem-choir` | `s6-choir-adept` | `radial-burst`, `ground-cluster` | `arena-close` | `line-sweep`, `charge-rush` | 방사 폭발이 유리처럼 파편 2차 확산 |
| 7 | Starless Canal | `s7-lantern-tyrant` | `s7-toll-keeper` | `line-sweep`, `arena-close` | `charge-rush` | `radial-burst`, `ground-cluster` | 안전지대가 등불 위치로 이동 |
| 8 | Shattered Causeway | `s8-bridge-colossus` | `s8-keystone-warden` | `charge-rush`, `radial-burst` | `ground-cluster` | `line-sweep`, `arena-close` | 돌진이 지형 장식을 파괴 (비보행, 게임플레이 불변) |
| 9 | Abyss Chancel | `s9-veiled-concordat` | `s9-oathbound-signatory` | `ground-cluster`, `charge-rush` | `line-sweep` | `radial-burst`, `arena-close` | 장판이 두 지점에서 교차 전개 |
| 10 | Gate Zenith | `s10-abyss-regent` | `s10-regent-herald` | `arena-close`, `radial-burst` | `line-sweep` | `charge-rush`, `ground-cluster` | P3에서 조합 2종을 상시 사용 |

**시그니처는 예고 길이를 건드리지 않는다.** 전부 형상·후속 효과·연출 변주이며, §5.2의
학습 보존 규칙을 지킨다. 2번 스테이지의 "반투명 데칼"도 예고 tick은 그대로이고 대비만
낮춘다 — 단, `web-accessibility` 관점에서 **최소 대비 하한을 두고**
`camera-vfx-direction.md`의 색 위계 규칙을 따른다.

---

## 8. 공정성 불변식

이 목록은 협상 대상이 아니다.

1. **모든 패턴은 `DASH` 1회 또는 도보 이동만으로 회피 가능하다.** §4.2가 5종 전부 증명.
2. **회피 불가 피해 0.** 예고 없는 피해원은 지속 장판(hazard)뿐이며, 장판은 진입 전에
   보인다.
3. **예고는 항상 active보다 먼저 온다.** 최소 45 tick.
4. **화면 밖 보스 피해 0.** `VISIBILITY_RADIUS = 9000` 밖 `windup` 진입 불가.
5. **보스 페이즈 중 동시 커밋 공격자 ≤ 8** (보스 포함).
6. **`windup` 진입 후 방향 재조준 0.**
7. **페이즈 전환이 예고/active/recovery tick을 바꾸지 않는다.**
8. **대시 고갈로 인한 회피 불가 구간 0.** §4.2 연속 패턴 검산.

---

## 9. 결정론 픽스처

| # | 픽스처 id | 시드 | 설정 | 단언 (전이/결과) |
|---|---|---|---|---|
| 1 | `ai-target-acquire` | 6001 | 지각 반경 경계 ±1 | 안쪽 `idle→pursue`, 바깥 `idle` 유지 |
| 2 | `ai-target-loss` | 6002 | 타겟이 반경 밖 + 180 tick | `pursue→idle`, 영구 추격 0 |
| 3 | `ai-obstruction` | 6003 | 차폐물 뒤 타겟 | `windup` 진입 0, 관통 접촉 0 |
| 4 | `ai-path-failure` | 6004 | 도달 불가 타겟 | `pursue→reposition`, 무한 루프 0 |
| 5 | `ai-close-pressure` | 6005 | `ranged` 3000 이내 진입 | `retreat` 진입, 간격 5500 회복 |
| 6 | `ai-multi-decision-slot` | 6006 | 60체 동시 | tick당 결정 ≤12, 슬롯 재배정 0, 다이제스트 동일 |
| 7 | `ai-no-turn-and-hit` | 6007 | `windup` 중 타겟 90° 이동 | 공격 방향 불변, 재조준 0 |
| 8 | `ai-stagger` | 6008 | `HEAVY`로 `guardian` 경직 | `windup→stagger`, 쿨다운 +30 |
| 9 | `ai-recover-no-spam` | 6009 | `recover` 직후 재공격 시도 | 최소 12 tick `idle` 강제 |
| 10 | `ai-committed-cap` | 6010 | 60체 전원 공격 시도 | 동시 `windup`/`attack` ≤8 |
| 11 | `ai-offscreen-block` | 6011 | 보스가 반경 9000 밖 | `windup` 진입 0 |
| 12 | `boss-phase-70` | 6012 | HP 70% 통과 | 무적 60 tick, 패턴 중단, 데칼 제거, 콤보 유지 |
| 13 | `boss-phase-40` | 6013 | HP 40% 통과 | 패턴 풀 5종, 쿨다운 90 |
| 14 | `boss-telegraph-invariant` | 6014 | P1/P2/P3에서 `line-sweep` | 예고 45 tick 3회 모두 동일 |
| 15 | `boss-dodge-radial` | 6015 | `radial-burst` 반경 중심 | 도보 이탈로 피해 0, 여유 34 tick |
| 16 | `boss-dodge-linesweep` | 6016 | `line-sweep` 정중앙 | 측면 `DASH`로 피해 0, 여유 15 tick |
| 17 | `boss-dodge-cluster` | 6017 | `ground-cluster` 장판 사이 | 간극 이동 피해 0, **대시 무적으로는 무효화 실패** |
| 18 | `boss-dodge-charge` | 6018 | `charge-rush` 정면 | 수직 `DASH` 피해 0, 후방 도주는 피격 |
| 19 | `boss-dodge-arenaclose` | 6019 | `arena-close` 최원거리 | 안전지대 도달, 여유 35 tick |
| 20 | `boss-combo-gap` | 6020 | P3 조합 2종 | 예고 시작 간격 ≥30 tick, `arena-close` 조합 0건 |
| 21 | `boss-dash-economy` | 6021 | 60 tick 간격 3연속 패턴 | 전 패턴 회피 성공, 충전 고갈 0 |
| 22 | `boss-midboss-single-phase` | 6022 | 중보스 HP 50% 통과 | 페이즈 전환 0, 패턴 2종 유지 |
| 23 | `ai-digest-parity` | 6023 | 같은 시드 2회 실행 | `getRunDigest()` 바이트 동일 |

전이를 단언한다. 최종 위치만 비교하지 않는다.
