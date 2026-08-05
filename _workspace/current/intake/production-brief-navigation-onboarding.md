# Production Brief — 게임 시작 네비게이션 · 승패 판독성

run-id(작업 레인): `current` (병행 세션, `_workspace/current/`에 직접 기록)
작성: game-production-director
operating-mode: **UX 판독성 슬라이스** (한 사이클, 컨셉 시프트 아님)
next-public-beat: 첫 플레이어가 게임을 켜자마자 (1) 어떻게 움직이고 때리는지, (2) 무엇이 승리·패배인지, (3) 어디를 지켜야 하는지 **읽지 않고도** 알 수 있는 빌드.

---

## 1. 소스 패킷 (사용자 요청)

> "현재 아레나 게임을 실행하면 어떻게 해야 승리인지 실패인지 알 수가 없다. 게임 시작 시
> 네비게이션 정보가 필요하다. 네비게이션이란 게임 진행에 최소한의 설명 — 움직이고,
> 때리고, 어디로 몬스터가 들어가면 안 되는지 — 을 뜻한다. 조사해서 구현할 내용을 정리하라."

대상 게임: `index.html` → `sprite-2-5d.js` — "어비스 랜턴 · 잿불 법정". 단일 화면 2.5D
스프라이트 서바이벌 아레나. (Three.js 라인인 `app.js`/`battle-realtime-three.js`가 **아니다**.)

## 2. 현 상태 결함 [OBSERVED] — 코드 근거 포함

| # | 결함 | 근거 |
|---|---|---|
| **F1** | 승리 조건 부재. `updateWave()`는 웨이브를 무한히 `startWave(wave+1)` 한다. 상한·보스·클리어 없음. 유일한 종료는 `player.health===0` → `endRun("overrun")`. 게임오버 패널 카피는 항상 패배("법정이 함락되었다") 고정. | `sprite-2-5d.js:1072-1077`, `:878-880`, `:740-751`; `index.html:44-59` |
| **F2** | 시작 안내 부재. `boot()`가 자산 로드 직후 `restartGame()`→`startWave(1)`로 즉시 전투 진입. 온스크린 조작·목표 설명 오버레이 없음. 조작 legend는 우측 `controls-card` 텍스트뿐이라 모바일 세로에서 화면 밖. | `sprite-2-5d.js:1734-1755`, `:773-804`, `:758-771`; `index.html:168-208` |
| **F3** | "진입 금지 구역"이 기계적으로 존재하지 않음. 별도 랜턴/게이트 액터 없음. HUD "랜턴 내구도"=`player.health`. 적은 플레이어 좌표로 직진(`updateEnemy`). 아레나 경계(다이아몬드 클램프)는 렌더되지 않아 벽 위치 불가시. | `clampToArena:446-459`, `updateEnemy:956-1030`, `render:1465-1519`, `SPAWN_POINTS:270-279` |

## 3. 메인 제약

- **엔진**: Three.js/Canvas 브라우저 단일 페이지. Unity/Unreal 지침 금지 (CLAUDE.md §2).
- **결정성**: 렌더는 시뮬 스냅샷을 읽기만 한다. 이 작업은 UI/프리젠테이션 + 얇은 상태기계
  추가이므로 `getRunDigest` 입력 불변식과 무관 — 다만 `RUN_DIGEST_KEY` 스키마에 `outcome`
  필드를 추가할 때 하위호환을 지킨다.
- **접근성**: 기존 `role`/`aria-live`/`prefers-reduced-motion` 계약 유지. 오버레이도 동일 준수.
- **자산 0 추가**: 오버레이·경계·승리 화면은 전부 DOM/Canvas 프리미티브로. 신규 스프라이트/오디오 파일 없음(절차 오디오 큐 재사용 가능).

## 4. 메인 질문 (게이트가 답해야 할 것)

1. **승리를 무엇으로 정의하나?** → 설계 스펙 §2가 `TARGET_WAVE` 클리어로 확정(초기값 제안 10, 튜너블).
2. **"진입 금지 구역"의 정답은?** → 설계 스펙 §4가 2-tier로 확정: Tier 1(현 메커니즘을 가르친다: 당신이 랜턴, 포위=패배, 아레나 경계 가시화) 즉시 채택 / Tier 2(중앙 브레이저 코어를 실 오브젝트로 방어) 옵션·후행.
3. **시작 안내를 어떻게 붙이나?** → UI IA 스펙이 `briefing` 모드 + 오버레이 패널로 확정.

## 5. 산출물 레인 맵

| 산출물 | 경로 | 소유 |
|---|---|---|
| 본 브리프 | `intake/production-brief-navigation-onboarding.md` | director |
| 설계(목표·승패·금지구역·오버레이 카피) | `design/navigation-onboarding-spec.md` | game-designer |
| UI 정보구조(DOM·컴포넌트·a11y) | `ui/navigation-overlay-ia.md` | ui-senior-developer |
| 구현 스펙(정확한 코드 변경) | `engineering/navigation-onboarding-implementation.md` | game-programmer |
| QA 게이트(측정 기준) | `qa/navigation-onboarding-gates.md` | game-qa |

## 6. 이 사이클의 스코프 경계

- **In**: 시작 브리핑 오버레이, 승리 상태·패널, 아레나 경계 가시화, 스폰 방향 표시, HUD 라벨 정합(당신=랜턴), 재도움말 버튼.
- **Out(후행 후보)**: Tier 2 실물 코어 방어, 난이도 선택, 다국어, 튜토리얼 강제 실습(첫 킬 유도 등).
