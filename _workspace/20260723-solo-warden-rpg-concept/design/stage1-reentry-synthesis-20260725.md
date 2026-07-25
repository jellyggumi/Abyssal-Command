# Stage 1 재진입 종합 — 코어루프/UI 재설계 착수 기준 (2026-07-25)

run-id: `20260723-solo-warden-rpg-concept` · director: game-production-director (전 역할 대행)
입력: `design/trend-survey/defense-offense-rpg-hybrid-deep-research-20260725.md`(8게임 심층 리서치),
`design/resource-inventory-20260725.md`(리소스 전수조사), `design/implementation-audit-20260725.md`
(코드 대 문서 정합성 감사), `production/decision-log.md` D1-D20, `design/UNIFIED-GDD.md`.

**목적**: 리서치+감사 결과를 실제 코드 상태와 대조해 "이미 맞는 것"/"명세는 있으나 미구현인 것"/
"리서치가 제안하는 신규 항목"을 분리하고, 후속 코어루프·UI·스테이지구성·조작감 설계 4개 병렬
작업의 착수 기준을 확정한다. 이 문서는 GDD를 대체하지 않는다 — GDD에 append될 델타만 정의한다.

## 1. 확인됨 — 변경 불필요 (리서치가 기존 결정을 검증)

| ID | 기존 결정 | 검증 근거 |
|---|---|---|
| A | 성장소비 UI는 전투 화면과 분리(일시정지 중에만 풀스크린/대형 오버레이) | 8/8 레퍼런스 게임 만장일치. **[OBSERVED, 코드]** `app.js:1571-1574` `pauseOverlaySegment`로 이미 구현·라이브 — 3절 "🚩규칙위반후보"였던 일시정지 메뉴는 옵션 A로 확정·구현 완료 상태 |
| B | 전투 중 이산 선택은 엣지카드 토스트만, 신규 풀스크린 모달 없음 | Archero/Brotato 둘 다 전투 중 실시간 플로팅 선택 없음(분리 원칙 채택, 모달 메커니즘은 배제) — GDD §6.1 기존 결정과 정합 |
| F | 결정론적 페이싱 레버(Formation Surge)는 RNG 없는 실력표현 메커닉으로 안전 | KR Vengeance "Call Wave"가 동일 카테고리 — GDD §7.2 기존 결정 재확인 |
| 5탭 커맨드덱 셸 | 출정/성장/동료/인벤토리/요새 | **[OBSERVED, 코드]** `app.js:80-86` `COMMAND_TABS` 그대로 구현·라이브 |

**결론**: 위 4개 항목은 재설계 대상이 아니다. 후속 UI/코어루프 설계는 이 기준선을 유지한 채 그 안에서만 확장한다.

## 2. 명세는 있으나 미구현 — 이번 사이클 구현 대상 (재설계 아님, 완결 대상)

### 2.1 자유 궤도 카메라 (D17 스펙 vs 실제 코드)

**갭**: `design/presentation-spec.md:18-25`가 yaw 무제한/pitch [30°,85°]/핀치줌을 스펙화했고, `app.js`가
이미 입력 레이어를 완성했다(`CAMERA_ORBIT_YAW_SENSITIVITY`/`CAMERA_ORBIT_PITCH_SENSITIVITY`/
`CAMERA_PINCH_ZOOM_SENSITIVITY` 상수, `onPointerMove`의 `renderer?.orbit?.()` 호출, 핀치 처리의
`renderer?.zoom?.()` 호출 — 둘 다 optional-chaining이라 현재는 조용히 no-op). `battle-realtime-three.js`
쪽에는 `orbit()`/`zoom()` 메서드가 **존재하지 않는다** — `updateCamera()`가 매 프레임 고정 오프셋
(`WORLD_SCALE * 1.05` 등각각)으로 카메라 위치를 강제 재계산해, 사용자 입력이 있어도 다음 프레임에
즉시 덮어써진다.

**사용자 결정 (이번 세션)**: D17 스펙대로 완전한 자유 궤도 카메라를 구축한다(고정 카메라로의 롤백
아님) — 리서치가 제시한 "장르 표준은 고정 카메라"라는 새 근거를 알린 뒤 사용자가 명시적으로 재확인.

**구현 요구사항**:
1. `RealtimeBattle`에 `orbitYaw`/`orbitPitch`/`zoomFactor` 상태 필드 추가(디폴트: yaw=0 person-relative,
   pitch=65°, zoom=1.0).
2. `orbit(dYaw, dPitch)` 메서드: yaw는 무제한 누적(랩어라운드), pitch는 `[30°, 85°]`로 clamp.
3. `zoom(delta)` 메서드: zoomFactor를 `[near, far]`로 clamp — 정확한 near/far는 §2.2 GLB 감사 결과로
   바운딩구체 기반 산출(현재 썸네일 렌더러의 `radius / sin(fov/2) * 1.35` 공식 재사용 가능, `battle-realtime-three.js:535`).
4. `updateCamera(snapshot)`을 고정 오프셋에서 `orbitYaw`/`orbitPitch`/`zoomFactor`를 반영한 구면좌표
   계산으로 전면 교체 — 단, **커맨더 추적(follow) 로직 자체는 유지**(타겟 지점만 궤도 중심으로 사용).
   `reduced-motion` 시 auto-follow lag(0.18 easing)만 hard-cut, 사용자 드래그/핀치는 항상 반응(스펙
   §카메라 문구 그대로).
5. 계약 불변량: `tests/defense-renderer-contract.test.mjs`/`tests/world-presentation-contract.test.mjs`가
   시뮬레이션 상태 비변경·`getRunDigest` 불변을 이미 검증 — 카메라는 옵저버이므로 이 불변량에 신규
   영향 없음(D17 판정 5번 항목과 동일 근거).

### 2.2 GLB 임의각 뷰잉 준비도 감사 (신규 전제조건)

카메라가 자유 궤도로 바뀌면 지금까지 한 번도 검증되지 않은 뷰잉 조건(측면/후면/저각/고각)이
전부 실제로 노출된다. 리서치가 지적한 리스크(Diablo Immortal/Torchlight Infinite가 고정카메라를
쓰는 이유 — 애셋이 단일 시점 전제로 제작됨)를 이 프로젝트의 51개 라이브 GLB에 대해 실측 확인해야
한다. 감사 항목: (a) 백페이스 컬링으로 뒤에서 보면 뚫려 보이는 지오메트리, (b) UV 시접선이 측면/후면
각도에서 노출되는지, (c) 리깅된 캐릭터의 실루엣이 T-pose 잔재나 관절 폴리곤 교차 없이 모든 각도에서
자연스러운지. 방법: Blender headless로 각 GLB를 8방위(N/NE/E/SE/S/SW/W/NW) × 2고도(30°/85° pitch)
= 16개 앵글로 렌더링, 실측 스크린샷 육안 확인(카테고리별 대표 샘플 우선 — 보스 10종 전량 + 동료/적
카테고리별 대표 2종, 총 ~24종 우선 감사 후 문제 발견 시 전량 확대).

### 2.3 3-스탠스 편성 시스템 (D1/GDD §2.2 vs 실제 코드)

**갭**: `production/decision-log.md` D1(Cycle 1)이 "전열(Vanguard)/포대(Turret)/분산(Split)" 3-스탠스를
확정하고 `design/UNIFIED-GDD.md:77-85`가 오프셋·반경·효과·파생FRONT수까지 완전히 수치화했다
(전열=전방1,400유닛/±500반경/파생FRONT2, 포대=후방300유닛/300반경/파생FRONT0, 분산=측면2,000+
후방300/최대폭9,000/파생FRONT1, 전환쿨다운4초). 그러나 라이브 코드(`rpg-catalog.js:98`
`FORMATION_SLOTS = ["FRONT", "BACK"]`, `defense-run-simulation.js`의 `resolveFormation`,
`app.js:394-399` `formationRowMarkup`)는 여전히 **Cycle 1 이전의 2슬롯 FRONT/BACK 이진 시스템**이다
— `BACK_ROW_SYNERGY_DAMAGE_BONUS`(25% 고정)만 존재, 스탠스별 차별화된 오프셋/반경/파생FRONT수
로직은 어디에도 없다. QA 리스크등록부 R2(`qa/lane-risk-register.md`)가 예견한 "편성 조합 지배"
리스크도 이 2슬롯 시스템 기준으로만 평가돼 있어 3-스탠스 도입 시 재평가가 필요하다.

**판정**: 이것은 재설계가 아니라 **1 사이클 이상 지연된 확정 명세의 실행**이다 — 코어루프 재설계
작업(§3)의 산출물이 이 3-스탠스 구조를 전제로 서술해야 하며, 구현 단계에서 `FORMATION_SLOTS`를
3값으로 확장하고 시뮬레이션의 위치오프셋·타겟팅·데미지보너스 로직을 GDD §2.2 표 그대로 구현한다.

## 3. 리서치 신규 발견 — 후속 설계 백로그 (이번 사이클에 반영 권고, 미확정)

이 3개 항목은 GDD에 대응 규정이 없는 **신규 제안**이며, 아래 §4의 UI 재설계 작업이 채택 여부를
최종 결정한다(이 문서는 강제하지 않는다):

| ID | 발견 | 이식 형태 제안 | 대상 시스템 |
|---|---|---|---|
| C | Whiteout Survival 노랑/빨강 검증-버블(무효 편성 사전경고) | 편성 화면에서 DOWNED 상태이거나 formationIntegrity 낮은 슬롯에 경고 버블 — 블로킹 모달 없이 §2.1 소모 리스크 사전 가시화 | 동료 편성 화면(2.6 세그먼트) |
| D | 동료-vs-적-vs-플레이어 시각 구분 — 2/2 ARPG 레퍼런스 모두 미해결(리뷰어가 "지저분함" 지적) | GDD §6.3 "아이템 등급 색-독립 인코딩" 원칙을 동료 네임플레이트/체력바에도 명시 확장 | 월드공간 HUD(`ui/lane-hud-layout.md`) |
| E | 영구(Track A/B) vs 런스코프 아이콘 형태 자체를 시각적으로 구분(육각 vs 정사각형 등, 8게임 중 6개 채택) | Track A/B 아이콘 형태와 기존 런스코프 XP임계값 스킬제안 아이콘 형태를 다르게 하는 저비용 규약 | 성장 탭 UI, 전투 중 스킬제안 카드 |

## 4. 후속 병렬 작업 착수 기준

이 문서를 입력으로 4개 설계 작업을 병렬 실행한다:
1. **코어루프 재설계**: §2.3(3-스탠스) 전제 + 리서치 카테고리1-3 교차패턴을 반영해
   `design/lane-coreloop.md`/`UNIFIED-GDD.md §2` 갱신안 작성. 기존 hunt→extract→materialize→capture→
   assault 체인은 불변(§1 확인됨 기준선 유지) — 3-스탠스가 이 체인의 assault 단계에 미치는 영향만 재설계.
2. **UI 레이아웃 재설계**: §3(C/D/E) 채택 여부 결정 + §2.1/§2.3 신규 UI 요구사항(궤도카메라 컨트롤
   힌트, 3-스탠스 선택 UI) 반영. `ui/lane-hud-layout.md`/`ui/lane-info-architecture.md` 갱신안.
3. **스테이지 구성(배경/분위기)**: `design/worldview.md` 계보(Cinder Span→Veil Citadel→...→Gate Zenith)
   기준, 궤도카메라 도입으로 노출될 배경 디테일 요구사항 반영.
4. **조작감 설계**: §2.1(궤도카메라 입력 반응성) + §2.3(스탠스 전환 4초 쿨다운의 피드백) 중심.

각 작업은 이 문서 + 관련 기존 레인 문서를 입력으로 받아 갱신안(GDD에 append할 델타)만 작성한다 —
기존 확정 사항(§1)을 재론하지 않는다.

## Links
- 리서치: `design/trend-survey/defense-offense-rpg-hybrid-deep-research-20260725.md`
- 리소스 감사: `design/resource-inventory-20260725.md`
- 구현 감사: `design/implementation-audit-20260725.md`
- 결정 기록: `production/decision-log.md` D1(스탠스 명칭), D17(카메라/렌더러)
- 코드: `app.js`(입력레이어), `battle-realtime-three.js`(렌더러), `rpg-catalog.js`/`defense-run-simulation.js`(편성 시뮬레이션)
