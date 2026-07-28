# Migration Map — 디펜스 서바이버 → 액션 핵앤슬래시

```yaml
run_id: 20260728-onslaught-action-pivot
status: "[TARGET] — 설계 단계. 코드 변경 미착수"
owner_skill: build-isometric-arpg
authority: design/master-numeric-contract.md
scope: 런타임 파일별 변경 범위, 데이터 스키마 델타, 테스트 영향, 슬라이스 순서
```

---

## 1. 변경 규모 요약

| 파일 | 줄 수 `[OBSERVED]` | 변경 등급 | 사유 |
|---|---|---|---|
| `defense-run-simulation.js` | 2371 | **대규모** | 전투 동사, 페이즈, 스폰 큐, 보스 패턴 |
| `defense-catalog.js` | 703 | **대규모** | 스킬 20종, 패턴, 페이즈 예산 |
| `app.js` | 2737 | **중규모** | HUD 재구성, 조작 추가, 기록 탭 |
| `battle-realtime-three.js` | 3147 | **중규모** | 카메라 티어, 안개, 예고 데칼, VFX |
| `rpg-catalog.js` | 344 | **중규모** | 스탠스 폐기, 스킬 카테고리 |
| `campaign-state.js` | 387 | **소규모** | 스키마 v2, 마이그레이션 |
| `stage-world-catalog.js` | 522 | **소규모** | 표면 타입 개명, PCG 모듈 |
| `defense-cutscene.js` | 109 | **소규모** | 미디어 비트 지원 |
| `battle-visualizer.js` | 618 | **소규모** | 신규 상태 폴백 표시 |
| `defense-audio.js` | 532 | **소규모** | 신규 이벤트 큐 |
| `defense-storage.js` | 275 | **소규모** | v2 저장 |
| `defense-telemetry.js` | 239 | **소규모** | 신규 지표 |

**보존:** 60 Hz 결정론, 스냅샷 단방향, 오프라인 로컬 저장, 무수익화, 심연 고유명,
10스테이지 순서, `prefers-reduced-motion`, 단일 게임플레이 평면.

---

## 2. `defense-run-simulation.js`

### 2.1 추가

| 영역 | 내용 | 근거 |
|---|---|---|
| 전투 동사 FSM | `verbState`, `verbTick`, `actionId`, `comboStep`, `comboWindowUntil`, `dashCharges`, `dashRechargeTick`, `inputBuffer`, `staggerUntil` | `action-combat-spec.md#1` |
| 입력 3종 | `ATTACK_LIGHT`, `ATTACK_HEAVY`, `DASH` | `#2.1` |
| 접촉 판정 | 부채꼴/원형/원뿔 형상, `(actionId, targetId)` 중복 방지 | `#3` |
| 페이즈 타임라인 | 6페이즈, 시간상한/처치전용 2종 종료 규칙 | `master#2.1` |
| 스폰 큐 | `spawnQueue: EnemyTemplate[]`, FIFO, `admitted = splice(0, freeSlots)` | `encounter#4.2.1` |
| 전이 정책 | `CARRYOVER_QUEUE_MAX = 16`, 보스 피해 부채 | `encounter#1.6` |
| 보스 패턴 | 5종 windup/active/recovery, 예고 데칼 좌표 | `boss-pattern-spec.md#4` |
| 결정 슬롯 | `decisionSlot = hash32(id) % 6` | `boss#2.2` |
| PCG 레이아웃 | 시드 생성, 셀 배치, 검증 | `pcg#5` |
| 신규 이벤트 | §2.3 |

### 2.2 폐기

| 대상 | 처분 |
|---|---|
| 자동 기본 공격 (`basicCooldown`) | 삭제 |
| `orderedTargets(…, basicRange)` 자동 타겟 | 접촉 형상으로 대체 |
| `updateObjectivePhase` 6단계 목표 체인 | 페이즈 타임라인으로 대체 |
| `OBJECTIVE_PRESSURE_*` 게이트 감쇠 | 웨이브 밀도 압박으로 대체 |
| `STANCE_CYCLE` 입력 | 삭제 |
| `GATE` 내구도 실패 조건 | 지휘관 생존으로 이동 |

### 2.3 신규 이벤트 목록

전부 `getRunSnapshot().events`로 노출한다. 렌더러·오디오·QA가 소비한다.

```
VERB_STARTED  VERB_CANCELLED  MELEE_CONTACT  COMBO_ADVANCED  COMBO_DROPPED
DASH_IFRAME_START  DASH_IFRAME_END  INPUT_BUFFER_DROPPED  COMMANDER_STAGGERED
PHASE_CHANGED  PHASE_CARRYOVER_PURGED  SPAWN_BACKLOG_SATURATED  FINALE_OVERTIME
BOSS_PATTERN_TELEGRAPH  BOSS_PATTERN_ACTIVE  BOSS_PHASE_CHANGED
```

### 2.4 결정론 위험

| 위험 | 완화 |
|---|---|
| 부동소수 각도 판정 | 8옥탄트 스냅 (`action-combat#2.3`) |
| 60체 결정 순서 | `id` 오름차순 정렬 고정 |
| 결정 슬롯 배정 | 스폰 시 1회 확정, 재배정 없음 |
| PCG PRNG | mulberry32 정수 연산, `Math.random()` 금지 |
| 히트스톱 | 렌더러 전용, 시뮬 tick 불변 |

---

## 3. `defense-catalog.js`

| 대상 | 처분 |
|---|---|
| `COMMANDER.basicCooldown` / `basicRange` | 삭제 |
| `COMMANDER.basicDamage = 900` | **유지** — 배율 기준 |
| `COMPANION_AUTONOMY.itemClaimRange` | `basicRange` 참조 끊고 독립 상수화 |
| `SKILLS` 플랫 8종 | 삭제 → `SKILL_CATEGORIES` 20종 |
| `CINDER_SPAN_WAVE_PLAN` / `STAGES[*].waves` | 삭제 → `PHASE_TIMELINE` |
| `STAGES[*].gateTicks` | 삭제 → 페이즈 예산 |
| `BOSSES` 10종 | **유지** + `patterns`, `midbossId` 필드 추가 |
| `ENEMIES` 4종 | **유지** + 지각/예고/커밋 필드 추가 |
| `CUTSCENES` | **유지** — 미디어 폴백 원본 |
| `STAGE_TACTICS` 고정 좌표 | PCG 셀 앵커로 대체 |

---

## 4. `campaign-state.js`

### 4.1 스키마 v2

```
wardenProgress: {
  // statPoints 폐기 -> 유료/무료 분리 (비용 순서 의존성 제거)
  corePointsByStat:  { "<statId>": 0..10 },  // 유료. wardenStatPointCost 인덱스
  levelPointsByStat: { "<statId>": 0.. },    // 무료. Warden Level 지급분
  skillTreeIds, traitIds,               // 기존
  wardenLevel, wardenXp,                // 신규
  skillLevels: { "<id>": 1..5 },        // 신규 — 해금+레벨 단일 출처
  loadout: [ "<id>", ... ]              // 신규 — 길이 ≤6
}
campaign.echoShard: 0                   // 신규
campaign.schemaVersion: 2               // 신규

// 파생 (미저장): effectiveStat(id) = core + level, 상한 STAT_CAP = 19
```

### 4.2 마이그레이션 v1 → v2

| 필드 | 값 |
|---|---|
| `wardenLevel` / `wardenXp` | 1 / 0 |
| `echoShard` | `resolvedIds.length × 8` |
| `skillLevels` | T1 8종 L1 |
| `loadout` | T1에서 카테고리 상한대로 자동 구성 |
| `statPoints` → `corePointsByStat` | 값 그대로 이관 (v1엔 무료 출처가 없었으므로 전부 유료) |
| `levelPointsByStat` | 전 스탯 0 |
| 스탯 상한 | 10 → **19** |

**필수 코드 변경 3건:**

| 위치 `[OBSERVED]` | 변경 |
|---|---|
| `campaign-state.js:63` `echoCoreSpent()` | `statPoints` → `corePointsByStat` 합산 |
| `campaign-state.js:96` `validWardenProgress()` | 동일 + `hasOnlyKeys` 목록에서 `statPoints` 제거, 신규 6키 추가 |
| `app.js:490` | `wardenStatPointCost(corePointsByStat[id] + 1)`, 표시는 `effectiveStat(id)` |

**`echoCoreSpent()`를 바꾸지 않으면 무료 레벨 포인트가 Echo Core 예산을 잡아먹어 저장
검증이 실패한다.** `hasOnlyKeys` 누락 시에도 v2 저장이 전부 거부된다.

멱등: `schemaVersion === 2`면 즉시 반환.

---

## 5. `battle-realtime-three.js`

| 영역 | 변경 |
|---|---|
| 카메라 거리 | 페이즈별 `zoomFactor` 티어 (`camera#2.4`). **clamp 불변** |
| 카메라 스무딩 | 위치/시선 독립 지수 보간 |
| 안개 | `stageFogRange(stageId)` → `stageFogRange(stageId, phase)` 확장 |
| 안개 면제 | 예고·안전지대·회피신호·실루엣 외곽선 `material.fog = false` |
| 예고 데칼 | 신규. **이방성 스케일** `x = r×0.001167`, `z = r×0.002333` |
| 흔들림 | 누적 상한 `SHAKE_ACCUM_CAP = 6.0` 도입 |
| 히트스톱 | 표시 시계 분리, `HITSTOP_ACCUM_CAP = 20` |
| 적 렌더 | 60체 인스턴스드 필수 |
| VFX 풀링 | 사전 할당, 티어별 상한 120/70/35 |
| 연출 모디파이어 | 8종, 동시 3개 상한, 배율 클램프 |

**보존:** `WORLD_SCALE = 14`, `worldPointInto` 매핑, FOV 42, 피치 clamp 30–85,
`ORBIT_ZOOM_DEFAULT`, 오빗 yaw 드래그.

---

## 6. `rpg-catalog.js`

| 대상 | 처분 |
|---|---|
| `FORMATION_STANCES` / `STANCE_CONFIG` | **삭제** (`skill-and-growth#6.1`) |
| `MAX_FRONT_SLOTS` / `orderCompanionsByFormationIntent` | 단순 추종으로 축소 |
| `BOSS_RALLY_COOLDOWN_REDUCTION` | 삭제 (값이 0이라 무효과) |
| `WARDEN_SKILL_TREE` 5노드 | **2노드로 축소** — `echo-backlash`/`echo-cascade`/`wardens-ward`는 신규 스킬과 중복 |
| `WARDEN_STATS` | 유지, 상한 19 |
| `WARDEN_TRAITS` 8종 | 유지 |
| `EQUIPMENT` | 유지 |
| `COMPANION_ROLES` | 유지 |
| `SKILL_CATEGORIES` | **신규** — 20종 정의 |

---

## 7. `stage-world-catalog.js`

| 대상 | 처분 |
|---|---|
| `surface(...)` 타입 `ramp`/`platform` | `decor-ramp`/`decor-platform`으로 개명 |
| `elevation` 필드 | `visualElevation`으로 개명 |
| `obstacle`/`landmark`의 `elevation` | 동일 |
| PCG 모듈 팔레트 | 신규 (`arena` 8 / `transit` 6 / `boss` 4) |
| 광원 인벤토리 | 신규 (`pcg#7.1`) |

**렌더 결과는 바뀌지 않는다** — 이미 표현 전용이었다(`pcg#1.1`). 개명과 검증만 추가된다.

---

## 8. 테스트 영향

### 8.1 무효화되는 기존 테스트

| 테스트 | 사유 |
|---|---|
| `defense-run-simulation.test.mjs` 자동공격 DPS | 자동 공격 폐기 |
| `defense-expansion-contract.test.mjs` 스탠스 | 스탠스 폐기 |
| `no-rts-closure.test.mjs` | 재검토 필요 |
| `world-presentation-contract.test.mjs` 안개 | `stageFogRange` 시그니처 변경 |
| `defense-survivor-browser.cjs` | HUD 전면 변경 |
| `defense-hud-responsive-browser.cjs` | 동일 |

**기존 실패와 신규 실패를 분리 보고한다.** 무효화된 테스트를 조용히 삭제하지 않고
"피벗으로 무효" 라벨을 붙여 기록한다.

### 8.2 신규 픽스처 수

| 스펙 | 픽스처 |
|---|---|
| `action-combat-spec.md#7` | 23 |
| `encounter-wave-spec.md#7` | 21 |
| `pcg-stage-layout-spec.md#9` | 24 |
| `skill-and-growth-spec.md#8` | 16 |
| `boss-pattern-spec.md#9` | 23 |
| `camera-vfx-direction.md#9` | 31 |
| `ui/hud-information-architecture.md#8` | 24 |
| `lobby-story-presentation-spec.md#8` | 16 |
| **합계** | **178** |

전부 `node --test 'tests/**/*.test.mjs'`로 실행 가능해야 한다(따옴표 포함 정확한 글로브).

---

## 9. 구현 슬라이스 순서

각 슬라이스는 **플레이 가능한 경로 + 결정론 픽스처**를 함께 낸다. 앞 슬라이스가 증명되기
전에 다음을 시작하지 않는다.

| # | 슬라이스 | 내용 | 완료 증명 |
|---|---|---|---|
| 1 | 이동·카메라 | 카메라 티어, 스무딩, 안개 확장 | `cam-*` 픽스처 8건 |
| 2 | 전투 동사 | `LIGHT_1/2/3`, `HEAVY`, `DASH`, 접촉, 콤보 | `combat-*` 23건 + 브라우저 1회 |
| 3 | 적 1종 | `rusher` FSM, 예고, 반격 | `ai-*` 5건 |
| 4 | 페이즈 골격 | 6페이즈 전이, 스폰 큐, 전이 정책 | `enc-*` 10건 |
| 5 | 보스 패턴 1종 | `line-sweep` 전 구간 | `boss-dodge-linesweep` + 회피 여유 실측 |
| 6 | PCG 레이아웃 | 셀 생성, 검증, 시드 재현 | `pcg-*` 24건 |
| 7 | 스킬 카테고리 | 20종, 티어 게이트, 로드아웃 | `grw-*` 16건 |
| 8 | 나머지 적·패턴 | `flanker`/`guardian`/`ranged`, 패턴 4종 | `ai-*`/`boss-*` 잔여 |
| 9 | VFX·연출 | 예고 데칼, 모디파이어, 흔들림 예산 | `vfx-*` 잔여 |
| 10 | HUD | 조작 레이아웃, 상태 표시 | `hud-*` 24건 + 실기 |
| 11 | 로비 기록 | 기록 탭, 미디어 재생 | `story-*` 16건 |
| 12 | 성능 | 인스턴스드 렌더, 품질 티어 | 빅웨이브 p95 ≤16.7 ms |

**슬라이스 2가 임계점이다.** 여기서 "때리는 느낌"이 나지 않으면 이후 전부가 무의미하므로,
슬라이스 2 완료 시점에 **사람 플레이 판정**을 받는다.

---

## 10. 미해결 엔지니어링 결정

| # | 사안 | 선택지 | 영향 |
|---|---|---|---|
| 1 | `COMPANION_AUTONOMY.itemClaimRange`가 `basicRange` 참조 | 독립 상수 / 형상 사거리 재사용 | 소 |
| 2 | Pages allowlist 114 경로 추가 | 나열 유지 / 디렉터리 단위 전환 | 중 — 워크플로 `test -f` 검증 로직 변경 |
| 3 | `stageFogRange` 시그니처 변경 | 페이즈 인자 추가 / 별도 함수 | 소 — 기존 테스트 오라클 갱신 |
| 4 | `layoutVersion` 불일치 시 처리 | 런 포기 / 레이아웃 스냅샷 저장 | 중 — 저장 용량 |
| 5 | 무효화 테스트 처리 | 삭제 / `skip` 라벨 유지 | 소 — 회귀 추적성 |
| 6 | 동료 시스템 축소 범위 | 자동 추종만 / 완전 폐기 | 중 — 정예 추출 동기 |

**1–6 전부 director 승인 대상이다.** 설계 문서가 단독으로 결정하지 않는다.
