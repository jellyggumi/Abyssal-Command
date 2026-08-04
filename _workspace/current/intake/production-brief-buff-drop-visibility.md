# Production Brief — 캠페인 버프 드랍 필드 가시성 (Stage-2 긴급 재진입)

harness: game-studio-harness. run-id 표기는 CLAUDE.md §1에 따라 날짜 폴더 대신
`_workspace/current/` 레인에 기입한다. operating mode: **Stage 2 긴급 재진입**
(스킬 Example 3 패턴 — QA가 확정한 결함이 재튜닝을 구동).

## bmad-gds intake schema

| 필드 | 값 |
|---|---|
| game_type | 3D Three.js 실시간 디펜스/서바이버 (campaign.html · app.js) |
| team_shape | director + designer + pm + programmer + qa (agent-team OFF → 순차 fallback) |
| engine | Three.js / WebGL 브라우저 (CLAUDE.md §2) |
| current_stage | cycle-10 drop/buff 레인 미종결 (회고 §1.5 "NOT closed") |
| next_public_beat | "등불 점화 작전" 실플레이에서 아이템이 필드에 떨어져 보이는 것 |
| source_packet | 이전 세션 진단 프로브 + `item-drop-timed-buff-spec.md` |
| main_constraint | 결정성 digest 불변 — 무드랍 런은 byte-identical 유지 (spec §9 check 1) |
| main_question | 버프 드랍이 필드 오브젝트로 뜨고 걸어가 줍도록, 즉시 흡수를 어떻게 끊는가 |

## 문제 진술 [OBSERVED]

사용자 보고: "등불 점화 작전" 진행 중 아이템이 떨어져야 하는데 드랍이 안 됨.

진단(이전 세션, 실런 프로브):
- 시뮬은 드랍을 **정상 생성**한다 (cinder/seed17: 17킬→`DROP_SPAWNED` 1,
  echo-throne/seed42: 71킬→5). mesh 파일(`prop-sprite-sheet-single-object.03/.05`
  GLB)도 실재.
- 그러나 **모든 드랍이 생성된 그 틱에 수집**된다. 필드 잔존 0틱.
- 원인: 틱 순서 `resolveDeaths`(드랍 생성) → `collectPickups`(수집)가 같은 틱.
  드랍은 시체+`DROP_OFFSET_X=240`에 생성되는데, 버프 수집 반경은
  `effectivePickupRange` = 커맨더 `pickupRange` **12000**(아레나 24000×12000의
  절반). 240 ≪ 12000 → 즉시 흡수.
- 결과: `kind:"buff"` 드랍이 `snapshot.pickups`에 한 틱도 안 남아, 렌더러의
  mesh·beacon(spec §4.2 하드 요구)이 그릴 대상 자체가 없다.

## 결함 심각도

S2 — 기능은 코드상 존재하나 플레이어에게 전달되지 않음(dead feature). 스펙 §4.2가
beacon을 "폴리시가 아니라 하드 요구"로 규정했는데 12000 흡수가 그 전제를 무효화.
스펙 자체의 내적 모순(beacon 근거 vs 12000 vacuum)이기도 하다.

## 이번 재진입이 바꾸지 않는 것

- 드랍 롤 로직(`rollBuffDrop`), RNG 스트림(`dropRng`), 드랍률/희귀도 테이블.
- echo(XP)·item(영구 스테이지 아이템) pickup 수집 — 12000 vacuum 유지.
- 무드랍 런의 digest.
