# Context

## Workflow Context
루트 라우트는 2D `<canvas>` 렌더러 + 고정 60Hz 스텝(`FIXED_STEP 1/60`, 최대 5스텝 catch-up)이다. 전투는 근접 아크 판정 + 노바(AoE)·워드(실드) 두 스킬. 렌더 파이프라인은 매 프레임: 백드롭 → 지면 링 → 픽업 → 깊이정렬 액터 → `drawCombatFeedback`(공격 아크) → `drawWardAura` → `drawNovaBurst` → 웨이브 마커. [OBSERVED] `sprite-2-5d.js:1465-1519`

현재 존재하는 전투 VFX의 **전부**는 다음 넷이며, 모두 단색 `context.stroke()`/`ellipse` 한 겹이다. [OBSERVED]
- **피격 플래시(`writeHitFlashGeometry`+draw):** 액터 위에 타원 외곽선 1개. 색만 다름(플레이어 `#7ff6ff` / 적 `#ff8a4c`), 지속 0.13s(적)/0.16s(플레이어). 파티클·스프라이트 틴트 없음. `sprite-2-5d.js:1121-1250, 838-845`
- **공격 아크(`writeAttackArcGeometry`):** 공격 클립 프레임 2~3에서만 보이는 반투명 호 stroke 1개(`#ffb064`, alpha 0.5). 트레일·잔상 없음. `sprite-2-5d.js:1151-1161, 1268-1296`
- **노바 버스트(`drawNovaBurst`):** 팽창하는 타원 링 stroke 1개(`#ffb161`), 0.42s 페이드. 코어 플래시·파편·충격파 다중 링 없음. `sprite-2-5d.js:1364-1386`
- **워드 오라(`drawWardAura`):** 정적 타원 stroke 1개(`#9af4ef`), 알파만 시간에 비례. 회전·펄스·굴절 없음. `sprite-2-5d.js:1348-1362`

없는 것: 히트스톱, 화면 흔들림, 스프라이트 실루엣 플래시, 파티클(불티/파편/먼지), 슬래시 트레일, 넉백 시각, 데미지 넘버, 처치 스펙터클. [OBSERVED]

## Affected Users
한 손 모바일 플레이어가 핵심. 타격이 "닿았는지" 확신하지 못하면 조작 신뢰가 무너진다. 음소거 사용자(오디오는 무자산 오실레이터 합성뿐)에게는 시각 피드백이 유일한 확정 신호다. 감소된 모션(`prefers-reduced-motion`) 사용자에게는 흔들림·강한 플래시를 반드시 정적 등가물로 대체해야 한다. [OBSERVED] `sprite-2-5d.js:100, 843, 875, 1122`

## Current Workarounds
- **오디오로 타격을 알림:** `strike`/`hit`/`kill` 오실레이터 큐가 사실상 유일한 "닿음" 확인선. 뮤트 시 전멸. [OBSERVED] `sprite-2-5d.js:501-507`
- **HP 바 감소로 확인:** 적 HP 바가 줄어드는 것으로 데미지를 유추. 즉각적 임팩트가 아니라 "결과 조회". [OBSERVED] `sprite-2-5d.js:1131-1148`
- **넉백은 시뮬 안 함:** 넉백/스태거가 시뮬에도 렌더에도 없어, 적이 맞아도 물리적 반응 없이 계속 전진한다. [OBSERVED] `sprite-2-5d.js:956-1030`(hit 반응 없음)

## Adjacent Problems
- **연출-시뮬 경계:** `CLAUDE.md §2`는 렌더러가 시뮬 스냅샷을 읽되 되쓰기 금지·digest 입력 변경 금지. 단 루트 라우트는 RNG가 없고(스폰은 `waveSeed + nextEnemyId*3` 결정적 인덱싱) digest는 런 종료 요약(wave/score/kills/relics)만 저장 → **히트스톱·흔들림·파티클이 이 라우트에선 결과에 영향 없이 안전**. [OBSERVED] `sprite-2-5d.js:698-713, 807-808`
- **계약 테스트:** `tests/sprite-2-5d-browser.cjs`가 `readRenderSnapshot()`의 `hitFlash`/`shadow`/`healthBar` 형태와 깊이 스케일 비율을 검증. 신규 이펙트는 기존 스냅샷 키를 깨지 말고 additive로 확장해야 한다. [OBSERVED] `tests/sprite-2-5d-browser.cjs:819-846`
- **캠페인 라우트는 이미 성숙:** `battle-realtime-three.js`는 knockback(render-space)·flash·shake·AoE burst를 이미 갖췄다(`IMPACT_KNOCKBACK`, `IMPACT_SHAKE`, `AOE_BURST_BUDGET`). 루트 라우트가 이 성숙도에 크게 못 미치는 것이 격차의 실체. [OBSERVED] `wiki/concepts/runtime-presentation-and-arrival-choreography.md §3`

## User Voices
- 직접 피드백: "현재 스킬 및 때리는 이펙트가 게임스럽지 못해." — 이번 요청의 발단. [OBSERVED]
- 업계 통설: 폴리시 없는 전투는 "floaty, weak, disconnected"로 느껴진다; "한 타격은 소리+파티클 버스트+히트스톱+화면 흔들림을 동시에 촉발해야 한다". [OBSERVED] game-feel 문헌(medium/hackread/thedesignlab 정리, indexed snippet)
