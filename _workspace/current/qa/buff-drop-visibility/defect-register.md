# QA Defect Register — 버프 드랍 필드 가시성

harness: game-studio-harness Stage 2. QA broadcast: ALL agents (director,
designer, pm, programmer, ui). feedback-requested-by: 이번 사이클 종료 전.

## D-BUFFDROP-01 [S2] 버프 드랍이 생성 즉시 흡수돼 필드에 뜨지 않는다

| 필드 | 값 |
|---|---|
| 심각도 | S2 (기능 존재하나 플레이어 미전달) |
| 재현 | `node _workspace/current/qa/buff-drop-visibility/measure-buff-drop-field-visibility.mjs <stage> <seed>` |
| 측정 (before) | cinder-span/17: spawn 1, sameTickCollect 1, maxOnField **0**, 가시틱 **0**. echo-throne/42: spawn 5, sameTickCollect 5, maxOnField **0**, 가시틱 **0**. |
| 기대 | 버프 드랍이 최소 1틱 이상 `snapshot.pickups`에 남아 렌더러가 mesh·beacon을 그릴 수 있어야 함 |
| 근본 원인 | `collectPickups`의 `kind:"buff"` 분기가 `effectivePickupRange`(=커맨더 `pickupRange` 12000)를 수집 반경으로 사용. 드랍은 시체+`DROP_OFFSET_X`(240)에 생성 → 같은 틱 `collectPickups`가 흡수. `resolveDeaths`(생성) → `collectPickups`(수집)가 동일 틱. |
| 코드 | `defense-run-simulation.js` `collectPickups` `kind==="buff"` 분기; `effectivePickupRange` `:1937`; `DROP_OFFSET_X` `defense-catalog.js:553`; 커맨더 `pickupRange:12000` `:5352` |
| status | OPEN → 이번 사이클에서 수정 대상 |
| broadcast-at | 2026-08-04 |

## 검증 게이트 (수정 후 재측정)

- V1 필드 가시성: 위 프로브가 두 스테이지 모두 exit 0 (maxOnField ≥ 1).
- V2 회귀: 버프 드랍 계약 스위트(`tests/defense-run-simulation.test.mjs` 버프
  드랍 케이스군) 그린 유지.
- V3 결정성: 무드랍 런 digest byte-identical (spec §9 check 1 정신).
