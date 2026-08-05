# Gate Review — 버프 드랍 필드 가시성 (Stage 2 긴급 재진입)

harness: game-studio-harness. owner: game-production-director. 각 판정에 측정값 +
방법 + 증거 경로 첨부(quality-gates.md 규칙).

## 결함 판정: D-BUFFDROP-01 → RESOLVED

| 항목 | 값 | 증거 |
|---|---|---|
| 검증 게이트 V1 (필드 가시성) | **PASS** — cinder/echo 모두 maxOnField ≥1, 가시 60/270틱, 즉시수집 0 | `qa/buff-drop-visibility/gate-measurements.md#v1` |
| V2 (계약 회귀) | **PASS** — 18/18 (name-pattern 스코프) | `qa/.../gate-measurements.md#v2` |
| V3 (결정성 digest) | **PASS** — gate check 1 통과, 무드랍 런 불변 | `qa/.../gate-measurements.md#v3` |
| 독립 리뷰 (자기승인 회피) | **SAFE TO GATE** — 5속성 전부 PASS | `agent://ReviewBuffDropFix` |

## 표준 게이트 영향

| 게이트 | 판정 | 사유 |
|---|---|---|
| G2 밸런스 | **재측정 필요(불변)** | `DROP_SETTLE_TICKS`는 `[TARGET]`. 버프 가동시간이 최대 1초 늦게 시작 — G2 재측정 시 입력. PM `buff-drop-reward-coupling-check.md` 사이드노트. 이 사이클에서 PASS 안 됨. |
| G5 매출·밸런스 | **영향 없음** | PM 판정: 시한 버프, 역전/패리티 무관, 보상 총량 불변. `pm/buff-drop-reward-coupling-check.md` |
| G4 몰입 | **부분 개선(미측정)** | 드랍이 이제 필드 오브젝트로 존재 → 렌더러가 mesh/beacon을 그릴 데이터 확보. 실브라우저 몰입 측정은 미실행 → 게이트 이동 없음. |
| G6 결정성 불변 | **유지** | 무드랍 런 byte-identical(독립 리뷰 속성1). |

**어떤 게이트도 이 재진입에서 PASS로 바뀌지 않았다.** 결함 하나를 닫고 가시성을
확보했을 뿐, 밸런스·몰입 판정은 측정을 기다린다.

## 개정 verdict (사용자 결정: 필드 유지 + 걸어가서 줍기): **PASS** — 커밋 가능 상태

settle 지연만으로는 근접 처치 후 여전히 12000 자동 흡수됐다. 사용자가 "필드에 남아
걸어가서 줍기"를 선택 → 버프 수집을 `BUFF_PICKUP_RANGE=900` 전용 반경으로 분리.

| 검증 | 결과 | 증거 |
|---|---|---|
| V4-A 지속성 | 드랍 1800틱 필드 잔존(구 12000 흡수 제거) | `gate-measurements.md#v4` |
| V4-B walk-to | 5/5 걸어가서 수집 | `gate-measurements.md#v4` |
| V5 계약 회귀 | 19/19 pass (단독 실행) | `gate-measurements.md#v5` |
| V6 신규 회귀 테스트 | teeth 검증 통과 (`agent://WalkToRadiusTest`) | `gate-measurements.md#v6` |
| V7 라이브 E2E | webgl, pickupCount 1, dropBeaconCount 1, throw 없음 | `gate-measurements.md#v7` |

미결(정직 고지):
- `BUFF_PICKUP_RANGE=900`·`DROP_SETTLE_TICKS=60`은 `[TARGET]` — 손맛 미측정. G2/G4
  재측정 대상.
- 전체 스위트(`tests/**/*.test.mjs`)는 미실행 — 변경 표면(catalog 상수 2 + buff 분기)
  한정, 병렬 실행 시 회고의 오버서브스크립션 타임아웃 재현돼 단독 스코프로 축소.
- 커밋은 사용자 지시 대기.
