# Design Decision — 버프 드랍 수집 모델 (settle delay)

harness: game-studio-harness Stage 2. owner: game-designer. 입력: QA
`defect-register.md#D-BUFFDROP-01`.

## 결정

버프 필드 드랍은 **생성 후 짧은 정착(settle) 지연 동안 수집 불가**로 두고, 그
뒤 기존 자동 흡수(12000 pickupRange)로 회수한다. 즉 "보이게 뜬 뒤 빨려간다."

- 신규 상수 `DROP_SETTLE_TICKS = 60` (60Hz 기준 **1.0초**). `[TARGET]` —
  이번 사이클 측정 대상, 밸런스 게이트를 PASS로 바꾸지 않음.
- 수집 반경은 **바꾸지 않는다**: `effectivePickupRange`(=pickupRange 12000)를
  유지 → `reclaimer-pulse`의 pickupRange 버프 의미 보존, spec §3.2 read-site 불변.

## 왜 반경 축소가 아니라 정착 지연인가

- 반경만 줄이면 근접(point-blank) 처치 시 시체+240에 뜬 드랍이 여전히 커맨더
  반경 안이라 같은 틱 흡수 → 가시성 **보장 불가**.
- 정착 지연은 커맨더 위치와 무관하게 모든 드랍이 최소 60틱 필드에 존재함을
  **보장** → 렌더러가 mesh + spec §4.2 beacon을 반드시 그릴 수 있다.
- 장르(웨이브 디펜스/서바이버)의 표준 손맛: 보상이 튀어나와 보인 뒤 자동 회수.
  이는 루트 2.5D 스프라이트 아레나(`sprite-2-5d.js`)의 가시 드랍 모델과도 일치.

## 하위호환·결정성 (프로그래머 계약)

- 정착 필드(`collectableAtTick`)는 **실제로 스폰된 드랍(`rollBuffDrop`)만**
  보유한다. 테스트가 직접 만든 드랍(`buffDropAt` 헬퍼)과 구세이브에는 필드가
  없고, `collectPickups`는 필드 부재를 "즉시 수집 가능"으로 취급한다.
  → 기존 계약 테스트(커맨더 위치 드랍 tick-1 수집, TTL grace)는 **무변경 그린**.
- 무드랍 런은 드랍 actor가 없으므로 snapshot byte-identical → spec §9 check 1
  digest 불변 유지. 드랍이 있는 런만 수집 시점이 뒤로 밀린다(이미 분기된 런).
- `collectableAtTick`은 정수(`run.tick + DROP_SETTLE_TICKS`)라 float 누출 없음.

## 수용 기준 (QA 재측정)

- 필드 가시성: 실런 프로브가 cinder/echo 모두 `maxBuffDropsOnField ≥ 1`.
- 회귀: 버프 드랍 계약 스위트 그린.
- 결정성: 무드랍 런 digest 불변.

---

## 개정 (사용자 결정: 필드 유지 + 걸어가서 줍기)

settle 지연만으로는 근접 처치 후 1초 뒤 12000 반경이 여전히 자동 흡수한다. 사용자가
"필드에 남아 걸어가서 줍기"를 선택 → 버프 수집을 12000 vacuum에서 분리한다.

- 신규 상수 `BUFF_PICKUP_RANGE = 900` (`defense-catalog.js`). 게임 내 상호작용
  스케일에 정합: GATE.radius 900, guardian.radius 540, 드랍 스폰 오프셋 240.
  `[TARGET]` — 손맛 미측정.
- `collectPickups`의 `kind:"buff"` 분기는 `effectivePickupRange`(12000) 대신
  `BUFF_PICKUP_RANGE`로 근접 판정. echo(XP)·item pickup은 12000 vacuum 유지.
- settle 지연(`DROP_SETTLE_TICKS=60`)은 **유지**: 근접 처치로 드랍이 커맨더
  900 안에 떠도 최소 1초는 필드에 보인 뒤 회수되도록.
- 원거리/AoE 처치(6000/1800–5000 반경)의 드랍은 900 밖에 떨어져 필드에 남고,
  플레이어가 beacon을 보고 걸어가 줍는다. 미회수분은 TTL(1800틱=30초)에 소멸.
- `reclaimer-pulse`(pickupRange 버프)는 이제 echo 수집만 넓힌다. spec §10 risk 8이
  경고한 "버프가 자기를 준 드랍의 수집 반경을 넓히는" 자기합성 캐스케이드가
  구조적으로 제거된다.

### 하위호환·결정성 (불변)

- 무드랍 런 digest byte-identical(드랍 actor 미생성). BUFF_PICKUP_RANGE는 드랍이
  실제로 존재하는 런에서만 판정에 쓰여, 무드랍 경로 불변.
- 기존 계약 테스트: 커맨더 위치(거리 0) 드랍은 900 안이라 그대로 수집,
  far 드랍(400,400 등)은 900 밖이라 그대로 미수집 → 그린 유지(반경을 12000에서
  900으로 줄여도 두 케이스의 판정은 안 바뀜).
