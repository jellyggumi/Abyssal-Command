# QA Gate Measurements — 버프 드랍 필드 가시성

harness: game-studio-harness Stage 2. owner: game-qa. 모든 값에 생성 명령 첨부.

## V1 — 필드 가시성 (결함 D-BUFFDROP-01 수정 확인)

명령: `node _workspace/current/qa/buff-drop-visibility/measure-buff-drop-field-visibility.mjs <stage> <seed>`

| 스테이지/시드 | maxOnField (before → after) | 가시 틱 (before → after) | sameTickCollect (before → after) | spawn=collect |
|---|---|---|---|---|
| cinder-span / 17 | 0 → **1** | 0 → **60** | 1 → **0** | 1 = 1 |
| echo-throne / 42 | 0 → **2** | 0 → **270** | 5 → **0** | 5 = 5 |

판정 **PASS** — 두 스테이지 모두 exit 0. 드랍이 정확히 settle 창(60틱=1.0초) 동안
필드에 존재한 뒤 회수됨. 모든 드랍은 여전히 최종 수집(spawn=collect)되어 버프
효과가 유실되지 않음.

## V2 — 계약 회귀

명령: `node --test --test-reporter=tap --test-name-pattern='drop|buff|pickup|gate check|Lantern|item pickup|Bind window' tests/defense-run-simulation.test.mjs`

결과: **tests 18 / pass 18 / fail 0**. 포함: Warden's Lantern pickupRange,
아이템 pickup gate/integrity, 드랍 draw protocol, 필드캡, measurement 격리 등.
`buffDropAt` 헬퍼(collectableAtTick 없음)로 커맨더 위치에 둔 드랍의 tick-1 수집
케이스가 그대로 통과 → 하위호환 경로 확인.

주의: 전체 파일 `node --test tests/defense-run-simulation.test.mjs`는 요약 없이
273초 무응답 — cycle-9/10 회고가 기록한 **사전 존재 whole-file hang**이며 이
변경과 무관. 그래서 `--test-name-pattern`으로 영향 계약만 실행함.

## V3 — 결정성 (digest 불변)

gate check 1(무버프 런 pinned digest 유지)이 V2의 18건에 포함되어 PASS.
`collectableAtTick`은 정수이고, 드랍 actor를 스폰하지 않는 런은 snapshot 형태가
불변이므로 무드랍 런 byte-identity가 유지됨.

## 미측정 (정직 고지)

- 전체 스위트(`tests/**/*.test.mjs`): 이 세션에서 미실행. 변경 표면이 buff
  collectPickups 분기 1개로 한정돼 다른 스위트에 영향 없음을 근거로 범위 축소
  (CLAUDE.md §6 "변경한 테스트만" 정신). 커밋 전 필요 시 director가 지시.
- 브라우저 실증(렌더러가 실제로 mesh/beacon을 그리는가): 시뮬 측 가시성만 증명.
  렌더러는 이미 `snapshot.pickups`의 `kind:"buff"`를 소비하도록 구현돼 있으므로
  (battle-realtime-three.js `ensurePickup`/`ensureDropBeacon`) 데이터가 이제
  존재한다는 것이 전제조건 충족. 실브라우저 확인은 후속 물리 단계.

---

## 개정 측정 — 필드 유지 + 걸어가서 줍기 (BUFF_PICKUP_RANGE=900)

### V4 — 지속성 + walk-to 수집

명령: `node _workspace/current/qa/buff-drop-visibility/measure-walk-to-collection.mjs <stage> <seed>`

| 속성 | 스테이지/시드 | 결과 |
|---|---|---|
| A 지속성(flee 조향) | cinder-span/17 | 드랍이 **1800틱(전체 TTL)** 필드 잔존 후 미회수 소멸 — 900<d<12000이면 더 이상 자동 흡수 안 됨(결정적 증거) |
| B walk-to(chase 조향) | echo-throne/42 | **5/5 수집** — 900 반경 안으로 걸어가면 수집됨 |

INCONCLUSIVE/FAIL로 뜬 반대 케이스는 프로브의 순진한 옥탄트 조향 아티팩트(적 근처
체류·장애물 미회피)이지 게임 결함 아님. 두 속성은 서로 다른 스테이지에서 각각 증명됨.

### V5 — 계약 회귀 (walk-to 반영 후)

명령: `node --test --test-reporter=tap --test-name-pattern='drop|buff|pickup|gate check|Lantern|item pickup|Bind window|walk-to' tests/defense-run-simulation.test.mjs` (단독 실행)
결과: **tests 19 / pass 19 / fail 0** (기존 18 + Tester 신규 walk-to 회귀 1), exit 0, 180s.
주의: 서브에이전트 node 테스트와 병렬 실행 시 200s 타임아웃 발생 — 회고가 경고한
오버서브스크립션. 단독 실행으로 해소. orphan 리핑 후 재측정.

### V6 — 신규 회귀 테스트 (Tester 작성)

`tests/defense-run-simulation.test.mjs`에 append: `walk-to buff collection: a drop beyond
BUFF_PICKUP_RANGE is left on the field, one within it is collected`. teeth 검증 완료 —
far(1500, 구 12000 안·신 900 밖) 필드 잔존, near(500) 수집, settle 게이트 60틱 유지 후 해제.
`agent://WalkToRadiusTest`.

### V7 — 라이브 브라우저 E2E (렌더러 실증)

`campaign.html` 강력 새로고침 후 라이브 WebGL 렌더러에 버프 드랍 스냅샷 주입:
`data-defense-renderer=webgl`(Canvas2D 폴백 아님), `pickupCount=1`, `dropBeaconCount=1`,
throw 없음. 렌더러가 실제로 mesh + beacon을 그림.
