# 아이템 "호출 안됨" 정밀 분석 + 드랍률 가시성 수정

harness: game-studio-harness. 사용자: "index 와 campaign에서 아이템이 호출안됨,
정확히 코드 분석 후 다시".

## 정밀 진단 [OBSERVED] — 결함 아님, 코드는 전부 작동

이전 두 라운드(settle 지연, walk-to 반경)가 실제로 서빙되는지 포함해 전 계층 실증:

1. **서빙 바이트 = 디스크**: `diff` 서빙본 vs 디스크 byte-identical(92227B).
   `BUFF_PICKUP_RANGE=900`, `DROP_SETTLE_TICKS=60` 서빙 확인.
   (`curl|grep`가 0을 반환한 건 rtk 래핑 grep 오작동 — `diff`+`read`로 정정.)
2. **시뮬 스폰**: 서빙 코드 헤드리스 구동(브라우저·노드) — cinder/17에서 17킬 →
   `DROP_SPAWNED` 1, `maxOnField` 1(즉시 흡수 아님). 6% BASIC의 기대치와 일치.
3. **렌더 경로**: 라이브 배틀에 드랍 주입 → `pickupCount 1`, `dropBeaconCount 1`,
   prop GLB(`...05/glb/base_basic_pbr.glb`) 200 로드, meshIntegrity 유효(23895 verts),
   스크린샷에 beacon 링 표시.

**결론: 버그 없음.** "안 보인다"의 실제 원인 = **드랍률이 너무 낮음**. BASIC 6%면
17킬당 ~1개 + 작은 메시 + 은은한 beacon → 일반 플레이에서 사실상 안 보임.

## 수정 — 드랍률 상향 (가시성)

`defense-catalog.js` `DROP_CHANCE_BP` (모두 `[TARGET]`, 미측정):

| 스테이지 | BASIC (전→후) | SHADOW (전→후) | BOSS |
|---|---|---|---|
| cinder-span | 600 → **4500** | 2500 → **6000** | 10000 |
| abyss-chancel | 800 → **5000** | 3000 → **6500** | 10000 |
| echo-throne | 1400 → **5500** | 3500 → **7000** | 10000 |

across-stage 상승(등가 cadence 의도) 유지. BASIC ~45–55%로 ~2킬당 1드랍.

## 검증 [OBSERVED]

- 노드(신규 프로세스, 캐시 없음) cinder/17: `spawnCount` 1 → **4**, maxOnField 3,
  드랍 가시 2310/3518틱(66%), walk-to 수집 2건, 지속성 1800틱.
- 라이브 캠페인(캐시 비활성 재로드): 첫 드랍 **2킬**째(구 ~17), `peakPickup 4`,
  `peakBeacon 4`, 스크린샷에 beacon 다수. 실플레이에서 아이템이 보인다.
- 모듈 캐시 함정 기록: `import('/x.js?q')`는 그 모듈의 내부 `import './dep.js'`(쿼리
  없음)를 캐시본으로 바인딩 → 서빙 재측정은 신규 노드 프로세스 또는 캐시 비활성
  풀 리로드로 해야 함.

## 두 게임 최종 상태

- **캠페인(3D)**: settle(60t) + walk-to(900) + 드랍률 상향. 라이브 확인.
- **스프라이트 아레나(2.5D)**: 이미 100% 드랍, 자석 78→160으로 수집 정상(별도 기록
  `sprite-arena-drop-lane.md`). 라이브 확인(유물 0→2).

## 미결(정직 고지)

- 드랍률·자석·settle 값 전부 `[TARGET]` — 손맛/밸런스(G2/G5) 미측정. 과하면 하향.
- 회귀 테스트: 드랍률은 상수 변경이라 기존 계약 스위트가 커버(값 비의존). 드랍
  가시성 자체의 자동 회귀 가드는 후속.
- 커밋 미실행.
