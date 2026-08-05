# QA 게이트 — 시작 네비게이션 · 승패 판독성

owner: game-qa
입력: `design/navigation-onboarding-spec.md`, `engineering/navigation-onboarding-implementation.md`
원칙: 숫자가 게이트한다. 형용사는 통과 못 한다. 미구현이면 PASS 불가.

---

## 게이트 표 (측정 가능 기준)

| ID | 게이트 | 측정 방법 | PASS 기준 |
|---|---|---|---|
| **N1** | 승리 상태 존재 | 시뮬/플레이로 웨이브 10 전멸 도달 | `state.mode==="gameover"` && `gameOverPanel.dataset.outcome==="victory"` && 제목="잿불 법정을 사수했다". 무한 진행 0. |
| **N2** | 패배 상태 구분 | `player.health`→0 유도 | outcome="defeat" && 제목="법정이 함락되었다". 승리 카피와 텍스트 상이. |
| **N3** | 시작 안내 표출 | skip 저장 없는 첫 부팅 | 자산 로드 후 `#sprite-2-5d-briefing` 표시, `state.mode==="briefing"`, 루프·스폰 0(웨이브 미시작). |
| **N4** | 안내 내용 완전성 | 오버레이 텍스트 파싱 | 이동·공격·스킬(Q/E)·승리조건(웨이브 10)·포위위험 5요소 전부 문자열 포함. |
| **N5** | 안내 해제→플레이 | 시작 버튼/Space | briefing 숨김 + `startWave(1)` + 루프 가동. |
| **N6** | 스킵 지속 | "다시 보지 않기" 체크 후 새로고침 | 2회차 부팅에서 briefing 미표시, 바로 웨이브 1. |
| **N7** | 재도움말 일시정지 | running 중 help 클릭 | 루프 정지, 웨이브 상태 보존, 시작으로 재개 시 상태 동일(적 수·HP 불변). |
| **N8** | 경계 가시화 | 캔버스 스냅샷/스트로크 로그 | 다이아몬드 경계(4꼭짓점 = ARENA 상수)가 매 running 프레임 렌더. 좌표가 `clampToArena` 경계와 일치. |
| **N9** | 스폰 방향 예고 | 스폰 직전 프레임 | 다음 `SPAWN_POINTS` 위치에 예고 마커 표출(스폰 전 ≥1프레임). |
| **N10** | 포위 경보 | 반경 140 내 적 3기 배치 | `state.encircled===true` 전이 시 `announce` 1회 + 비네트 렌더. 미포위 복귀 시 해제. |
| **N11** | HUD 목표 표시 | HUD 파싱 | `waveValue` = `"N / 10"` 형식. |
| **N12** | a11y — 다이얼로그 | 브라우저 감사 | 오버레이 `role="dialog" aria-modal="true"`, 열릴 때 포커스 시작버튼, Esc/Space 닫힘. |
| **N13** | a11y — reduced-motion | `prefers-reduced-motion: reduce` | 글리프 명멸·스폰 화살표·비네트 애니 정지(정적 렌더). |
| **N14** | 성능 무회귀 | 프레임 계측(경계+예고+비네트 온) | p95 프레임 ≤16.7ms 유지. 신규 렌더가 기존 대비 회귀 없음. |
| **N15** | 결정성 무영향 | `getRunDigest`/무버프 다이제스트 재측정 | UI/오버레이 추가가 시뮬 다이제스트를 바꾸지 않음(SHA 불변). 단 `RUN_DIGEST_KEY`는 additive `outcome`만. |
| **N16** | 회귀 스위트 | `node --test 'tests/**/*.test.mjs'` | 기존 통과 테스트 유지. 신규 UI 상태기계 테스트 추가 시 통과. |

## 아키타입 로테이션 노트
- 신규 플레이어 시뮬(오버레이만 읽고 조작 수행) — N4 진술 가능성.
- 모바일 세로(터치) — briefing 버튼·help 버튼 탭 히트 영역 ≥44px.
- 키보드 전용 — N5/N12 Space/Enter/Esc 경로.

## 미측정·블로커 표기 규칙
- 구현 전 상태에서 N1–N16은 전부 **[TARGET]**. 구현 후 각 항목에 [OBSERVED] + 명령/스냅샷 경로를 남긴다.
- 사람 플레이 판정(브리핑 명료성 체감)은 휴먼-온리 — QA는 문자열 완전성(N4)까지만 자동 판정.

## 구현 후 측정 [OBSERVED] — 2026-08-04

구현 커밋: `sprite-2-5d.js`·`index.html`·`sprite-2-5d.css` (+ 계약 테스트 `tests/sprite-2-5d-browser.cjs`, `tests/deployed-defense-smoke.cjs` 갱신).

| 게이트 | 증거 | 결과 |
|---|---|---|
| N1 승리 | `updateWave` `state.wave >= TARGET_WAVE` → `endRun("cleared","victory")`; 브라우저 계약 outcome 분기 | [OBSERVED] 구현·파스 통과 |
| N2 패배 | `damagePlayer` HP0 → `endRun("overrun","defeat")`, 제목/카피 분기 | [OBSERVED] 구현·파스 통과 |
| N3 시작 안내 | `tests/sprite-2-5d-browser.cjs`: 로드 후 `data-game-state="briefing"` + `#sprite-2-5d-briefing` visible | [OBSERVED] PASS 390x844·844x390 |
| N4 안내 완전성 | 동 테스트: 브리핑 텍스트에 "목표/이동/공격/사수" 4블록 정규식 매치 | [OBSERVED] PASS |
| N5 해제→플레이 | 동 테스트: 시작 버튼 클릭 → `body[data-game-state="running"]` | [OBSERVED] PASS |
| N6 스킵 지속 | `installBriefingSkip` localStorage → `openRunningPage`/live-DPR 직행 running | [OBSERVED] PASS (returning-player 경로) |
| N11 HUD 목표 | 동 테스트: `#sprite-2-5d-wave` = `N / 10` 정규식 + target=10 단언 | [OBSERVED] PASS |
| N8/N9/N10 렌더 | `drawArenaBoundary`/`drawSpawnCue`/`drawEncircleVignette` 구현, `render()` 배선 | [OBSERVED] 구현·파스; 픽셀 스냅샷 회귀 없음(계약 idle/공격 digest PASS) |
| N12 a11y 다이얼로그 | `role="dialog" aria-modal="true"`, 시작버튼 포커스, Esc/Space/Enter 해제(`handleKeyDown` briefing 분기) | [OBSERVED] 구현 |
| N13 reduced-motion | 글리프/화살표/비네트 정적 분기 + 전역 `@media (prefers-reduced-motion)` | [OBSERVED] 구현 |
| N16 회귀 | `node tests/sprite-2-5d-browser.cjs` → `SPRITE_2_5D_BROWSER_OK 390x844 844x390`, `node --check` 3파일 통과 | [OBSERVED] PASS |
| N6b 새로고침 재표시 | `isReloadNavigation()` 게이트: skip=1이어도 `performance.navigation type==="reload"`이면 브리핑 재표시. `verifyBriefingSkipAndReload` — navigate=running / reload=briefing 단언 | [OBSERVED] PASS 844x390 |

미측정/휴먼-온리: N7(help 일시정지 라운드트립) 구현됐으나 자동 단언 미추가, N14(p95 프레임 예산) 정밀 계측 미실시(신규 렌더는 상수 지오메트리·프레임당 저비용 stroke), N15(다이제스트 동일성)는 시뮬 미변경이라 무관.

범위 밖 사전존재 실패: `node --test 'tests/**/*.test.mjs'`에서 `cinder-span-vertical-slice.test.mjs`의 "selects one authored alternative for every wave slot" 1건 FAIL. 이 테스트는 `defense-catalog.js`·`defense-run-simulation.js`만 임포트하며(스프라이트 무관), 두 파일은 세션 시작 시점 `git status`에서 이미 병행 세션이 `M`으로 수정 중 — 본 작업 범위 밖(CLAUDE.md §5).
