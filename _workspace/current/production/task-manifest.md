# Task Manifest — Onslaught 액션 피벗

run-id: `20260728-onslaught-action-pivot`
cycle: 1 (설계)
next-beat: director 스코프 리뷰 → 슬라이스 2 사람 플레이 판정

---

## 1. 사이클 1 — 설계 (완료)

| task | owner | 산출물 | 게이트 | 상태 |
|---|---|---|---|---|
| 피벗 범위·프리즈 경계 정의 | game-production-director | `intake/production-brief.md` | — | done |
| 마스터 수치 계약 | game-designer | `design/master-numeric-contract.md` | G2/G7 입력 | done |
| Hit & slash 전투 동사 | game-designer | `design/action-combat-spec.md` | G2 입력 | done |
| 웨이브·빅웨이브·보스 구성 | game-designer | `design/encounter-wave-spec.md` | G2/G7 입력 | done |
| PCG 셀 배치 | level-designer | `design/pcg-stage-layout-spec.md` | G6 입력 | done |
| 스킬 카테고리·영구 성장 | game-designer | `design/skill-and-growth-spec.md` | G3 입력 | done |
| 보스 패턴·적 AI | game-designer | `design/boss-pattern-spec.md` | G2 입력 | done |
| 카메라·VFX 연출 | ui-senior-developer | `design/camera-vfx-direction.md` | G4/G6 입력 | done |
| HUD 정보 구조 | ui-senior-developer | `ui/hud-information-architecture.md` | G4 입력 | done |
| 로비 서사 매체 | game-designer | `design/lobby-story-presentation-spec.md` | G1/G4 입력 | done |
| 코드 마이그레이션 맵 | game-programmer | `engineering/migration-map.md` | G6 입력 | done |
| **마스터 GDD 델타** | game-production-director | `design/master-gdd-delta.md` | **전 게이트 입력** | done |

`master-gdd-delta.md`와 `migration-map.md`는 독자가 다르다 — 전자는 **제품이 무엇이
되는가**(필러·루프·승패·캠페인), 후자는 **어느 파일이 어떻게 바뀌는가**를 진술한다.
두 문서 중 하나만으로는 피벗을 판정할 수 없다.

### 1.1 설계 중 발견·수정한 결함

산술·좌표계 오류를 문서에 남기지 않기 위해 시뮬레이션으로 검증했다.

| # | 결함 | 수정 |
|---|---|---|
| 1 | 페이즈 종료 규칙이 모호해 `FINALE` 타임아웃 승리가 성립 | 시간상한/처치전용 2종으로 분리, 하드 실링 강제 종막 |
| 2 | DPS 균형을 취소 없는 타임라인으로 계산 (체인이 43% 지배) | startup 상향, 취소-압축 기준 재계산 (3343–3510 수렴) |
| 3 | 스폰 표가 분수 개체 생성 | 정수 규칙 + 시뮬레이션 생성 궤적으로 교체 |
| 4 | 백로그가 정수/배열 타입 충돌, 드레인 규칙 부재 | `EnemyTemplate[]` FIFO 큐 단일 규칙 |
| 5 | 이월 25를 최대값으로 오인 (실제 최악 60 + 217) | `CARRYOVER_QUEUE_MAX = 16` + 보스 피해 부채 전이 정책 |
| 6 | 전이 시 개체 제거 규칙 부재 → 중복 스폰 가능 | 전면 제거 + 신규 id 재생성 명시 |
| 7 | Echo Shard 110/스테이지가 성장 축을 1.4판에 소진 | 8/스테이지로 재조정, 세 축 19/63/95판 |
| 8 | 완주 판수를 내림 처리 | 올림 명시 (62 → 63) |
| 9 | 스폰→보스 거리를 아레나 코너 대각으로 오산 | 셀 중심 간 17088 (4.17 s) |
| 10 | **카메라 거리를 게임플레이 단위로 계산** | 렌더러 좌표계 실측, `zoomFactor` 20.8–41.5 |
| 11 | **`VISIBILITY_RADIUS = 9000` 구현 불가** (월드 z반경 21 > 평면 14) | 3000으로 정정, 패턴 치수 전면 축소 |
| 12 | NDC 검증이 안개를 무시 (빅웨이브 경계 선명도 0.38) | 스테이지×페이즈 절대 하한 + 정보 레이어 안개 면제 |
| 13 | 회피 소요 tick 내림 | `ceil` 명시 |

**10–12는 렌더러 소스를 읽지 않았으면 발견 못 했을 결함이다.** 설계 수치가 구현 좌표계와
분리되면 문서가 통과해도 코드가 불가능해진다.

---

## 2. 사이클 2 — director 리뷰 (대기)

| task | owner | 산출물 | 게이트 |
|---|---|---|---|
| 피벗 승인 여부 판정 | game-production-director | `production/decision-log.md` | 전체 |
| 미해결 결정 6건 재정 | game-production-director | 동일 | G3/G6 |
| 기존 무효화 테스트 처분 | game-production-director | 동일 | G6 |
| 아카이브 이관 | game-production-director | `_workspace/archive/` | — |

### 2.1 director 결정 필요 항목

`engineering/migration-map.md#10`의 6건 + 아래:

| # | 사안 | 쟁점 |
|---|---|---|
| 7 | 피벗 자체 승인 | 27초 오토배틀 → 5–8분 액션. 기존 G2/G3/G7 측정이 전부 무효화된다 |
| 8 | 동료 시스템 축소 | 자동 추종만 남길지, 정예 추출 동기까지 재설계할지 |
| 9 | 스탠스 폐기 | G3 게이트 재정의를 수반 |
| 10 | 178 신규 픽스처 | 작성 순서와 CI 편입 시점 |
| 11 | **제품 계약 문서 부재** | 다른 세션이 `docs/abyssal-command-defense-survivor-design.md`와 `docs/abyssal-surge-production-cycle.md`를 삭제(스테이징). **현재 "이 게임이 무엇인가"를 진술하는 문서가 없다.** 복원할지, 피벗 승인 후 액션 기준으로 신규 작성할지 |
| 12 | `README.md` 정합성 | 디펜스 서바이버 기준으로 작성되어 피벗 후 사실과 어긋난다. 갱신 시점 결정 |

11–12는 이 런이 만든 문제가 아니라 **발견한 상태**다. 상세와 갱신 대상 목록은
`design/master-gdd-delta.md#0`, `#9`.

---

## 3. 게이트 상태

| 게이트 | 이전 `[OBSERVED]` | 현재 | 사유 |
|---|---|---|---|
| G1 세계관 | PASS | **영향 없음** | 고유명·순서 유지, 전달 매체만 변경 |
| G2 밸런스 | FAIL | **재측정 필요** | 5–8분 밸런스는 27초 측정과 무관 |
| G3 편성 | FAIL | **재정의** | 스탠스 → 카테고리 로드아웃 |
| G4 몰입/접근성 | PASS (로비) | **재측정 필요** | HUD 전면 변경 |
| G5 | N/A | N/A | — |
| G6 운영/성능 | FAIL | **재측정 필요** | 빅웨이브 60체 × VFX |
| G7 코어 루프 | BLOCKED | **재정의** | 30–180 s → 300–480 s |
| G8 최초 노출 | BLOCKED | **재측정 필요** | 신규 조작 학습 곡선 |

**어떤 게이트도 이 사이클에서 PASS로 바뀌지 않았다.** 설계 문서는 측정이 아니다.

---

## 4. 증거 규칙

- 이 런의 모든 수치는 `[TARGET]`이다. 기존 `[OBSERVED]` 측정치를 새 목표로 재라벨하지 않는다.
- 시뮬레이션으로 검증한 표(빅웨이브 궤적, 전이 정책, 카메라 티어, 안개 선명도, 회피 여유,
  경제 곡선)는 **설계 산술의 내적 정합성**을 증명할 뿐, 게임이 재미있다는 증거가 아니다.
- 27초 오토배틀 측정치는 5–8분 액션 루프의 증거가 되지 않는다.
- 사람 플레이 판정 없이 G4/G7/G8을 PASS로 바꾸지 않는다.

---

## 5. 다음 물리적 단계

1. director가 §2.1의 10건을 재정한다.
2. 승인 시 `engineering/migration-map.md#9`의 슬라이스 1–2를 착수한다.
3. **슬라이스 2 완료 시점에 사람 플레이 판정을 받는다** — "때리는 느낌"이 나지 않으면
   이후 슬라이스는 무의미하다.
4. 판정 통과 후 슬라이스 3–12를 순차 진행한다.
