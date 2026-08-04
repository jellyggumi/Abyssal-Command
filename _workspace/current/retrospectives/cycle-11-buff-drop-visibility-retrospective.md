# Retrospective — 버프 드랍 필드 가시성 (game-studio-harness Stage 2 재진입)

harness: game-studio-harness. operating mode: Stage 2 긴급 재진입 (단일 결함).
agent-team: OFF → director 주도 순차 fallback, 독립 리뷰만 서브에이전트 분리.

## 무엇을 고쳤나

캠페인(`campaign.html`/`app.js`, 3D)에서 아이템(버프) 드랍이 시뮬상 생성되지만
**같은 틱에 흡수돼 플레이어에게 안 보이던** dead-feature를 고쳤다. 원인은
버프 수집이 커맨더 `pickupRange=12000`(아레나 절반)을 그대로 써서, 시체+240에
뜬 드랍을 생성 즉시 회수한 것.

수정: **정착 지연(settle delay)**. 드랍은 `collectableAtTick = tick + DROP_SETTLE_TICKS(60)`
전까지 수집 불가 → 최소 1초 필드에 존재 → 렌더러가 mesh + spec §4.2 beacon을
그린 뒤 기존 vacuum이 회수. 반경은 안 건드려 `reclaimer-pulse` 의미·spec read-site
불변.

## 게이트 측정값

| 게이트/검증 | 값 | 방법 |
|---|---|---|
| V1 필드 가시성 | maxOnField 0→1(cinder)/0→2(echo), 가시 60/270틱 | 실런 프로브 exit 0 |
| V2 계약 회귀 | 18/18 | name-pattern 스코프 node --test |
| V3 결정성 | 무드랍 런 digest 불변 | gate check 1 |
| 독립 리뷰 | SAFE TO GATE (5속성 PASS) | 서브에이전트 read-only |
| 표준 게이트 | 어느 것도 PASS로 안 바뀜 | design/asset은 측정 아님 |

## 배운 것 / 리스크

1. **스펙 내적 모순이 결함의 근원.** spec §4.2가 beacon을 하드 요구로 두면서
   §4.3 수집은 12000 pickupRange를 썼다 — 두 조항이 동시에 참일 수 없다. cycle-10
   회고가 "drop/buff 레인은 테스트 0으로 착지"라 기록한 그 미검증 구간이 정확히
   여기였다.
2. **whole-file 테스트 hang은 사전 존재.** `tests/defense-run-simulation.test.mjs`
   전체 실행은 273초 무응답(cycle-9/10 회고와 일치). name-pattern 스코프가 필수.
3. **`DROP_SETTLE_TICKS=60`은 `[TARGET]`.** 손맛/밸런스 측정 없이 정한 값. G4(몰입)
   실브라우저 판정과 G2(가동시간) 재측정에서 튜닝 대상.
4. **미검증 §9 체크 존재.** 스펙이 요구한 결정성 체크 6/7/13/14/16/18/19은 테스트로
   작성된 적이 없다(cycle-10 미종결의 잔재). 이번 변경은 그 중 check 1(digest)만
   재확인했다.

## 다음 진입 결정

- **Stage 2 유지 재측정**, Stage 1 개념 전환 아님. 남은 물리 단계:
  1. 실브라우저에서 렌더러가 실제 mesh/beacon을 그리는지 확인(campaign.html).
  2. `DROP_SETTLE_TICKS` 손맛 판정 + G2 가동시간 재측정.
  3. spec §9 미작성 결정성 체크(field cap TTL grace 등) 테스트 보강.
- 커밋: 사용자 지시 대기. 이 세션은 소스 2파일 수정 + `_workspace/current/`
  아티팩트만 작성, 커밋/푸시 안 함.

## 변경 파일

- `defense-catalog.js` — `DROP_SETTLE_TICKS = 60` 신설
- `defense-run-simulation.js` — import 1줄, `rollBuffDrop` collectableAtTick 세팅,
  `collectPickups` 버프 분기 정착 게이트
- `_workspace/current/` — intake/design/pm/qa/production 아티팩트 (harness 산출물)

---

## 개정 — 사용자 결정으로 walk-to 모델 채택 (2차 패스)

settle 지연만으로는 근접 처치 후 1초 뒤 12000 반경이 여전히 드랍을 자동 흡수해,
"떨어지긴 하나 곧바로 빨려가 안 보인다"가 남았다. 사용자가 **"필드에 남아 걸어가서
줍기"** 를 명시 선택.

### 추가 변경

- `defense-catalog.js`: `BUFF_PICKUP_RANGE = 900` 신설.
- `defense-run-simulation.js`: import + `collectPickups` 버프 분기가 `effectivePickupRange`
  (12000) 대신 `BUFF_PICKUP_RANGE`(900)로 근접 판정. echo/item pickup은 12000 유지.
- settle 지연은 유지(근접 처치 가시성 보장). `reclaimer-pulse` 자기합성 캐스케이드
  (spec §10 risk 8) 구조적 제거.
- `tests/defense-run-simulation.test.mjs`: Tester가 walk-to 회귀 테스트 1건 append.

### 검증

- 지속성: cinder 드랍 1800틱 필드 잔존(구 12000 흡수 제거). walk-to: echo 5/5 수집.
- 계약: 19/19 pass(단독). 신규 회귀 teeth 검증. 라이브 E2E: webgl, 드랍 렌더 확인.
- 라이브 실행 교훈 재확인: 서브에이전트 node 테스트와 병렬 실행 시 200s 타임아웃
  (회고 §오버서브스크립션). 단독 실행 + orphan 리핑이 정답.

### 최종 변경 파일 (2차 포함)

- `defense-catalog.js` — `DROP_SETTLE_TICKS=60`, `BUFF_PICKUP_RANGE=900`
- `defense-run-simulation.js` — import, `rollBuffDrop` collectableAtTick, `collectPickups`
  버프 분기(settle 게이트 + walk-to 반경)
- `tests/defense-run-simulation.test.mjs` — walk-to 회귀 테스트 1건(append)
- `_workspace/current/` — intake/design/pm/qa/production 아티팩트

---

## 2번째 레인 — 2.5D 스프라이트 아레나 (사용자: "캠페인과 2D 스프라이트 아레나도")

`sprite-2-5d.js`(루트 `index.html`, 캠페인과 별개 코드)도 대상 확정. 라이브 진단:
드랍 시스템(생성·렌더·필드 잔존)은 정상이나 **수집이 안 됨** — 처치 5회에 유물 0,
체력 100→65. 원인은 수집 자석 `PICKUP_MAGNET_RADIUS=78`(세로 ~55)가 플레이어 공격
사거리 160보다 좁아, 자기가 죽인 드랍이 자기 수집권 밖에 떨어짐.

수정: `PICKUP_MAGNET_RADIUS` **78 → 160**(공격 사거리와 일치). 걸어가서 줍기 유지,
원거리 Nova(반경 250) 드랍은 여전히 걸어가야 함.

검증(동일 구동 before/after): 유물 0→**2**, 힐 0→**1**, 체력 100→65 → 100 유지.
스크린샷으로 유물 2 HUD 확인. 상세: `qa/buff-drop-visibility/sprite-arena-drop-lane.md`.

미결: `PICKUP_MAGNET_RADIUS=160` `[TARGET]`(손맛 미측정). 스프라이트 아레나 브라우저
테스트에 pickup 수집 커버리지 0건 — 회귀 가드는 후속.

### 두 레인 최종 변경 파일

- 캠페인(3D): `defense-catalog.js`, `defense-run-simulation.js`,
  `tests/defense-run-simulation.test.mjs`
- 스프라이트 아레나(2.5D): `sprite-2-5d.js` (`PICKUP_MAGNET_RADIUS` 78→160)
- `_workspace/current/` 하네스 아티팩트
