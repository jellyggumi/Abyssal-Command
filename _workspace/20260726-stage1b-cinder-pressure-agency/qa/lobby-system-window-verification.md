# QA — 로비 시스템 상태창 (monarch status window)

변경: `app.js` `monarchStatusMarkup()` / `monarchRankFor()` 추가 및 `renderLobby()`의 헤더 바로 아래 삽입, `styles.css` `.monarch-*` 스킨. 표시 전용 — `campaign` 과 `wardenGrowthData()` 를 읽기만 하며 시뮬레이션/스냅샷/`getRunDigest()` 입력에 쓰지 않는다.

## 검증 (2026-07-27, 실제 실행 결과)

- [OBSERVED] `node --test tests/lobby-system-window-browser.test.mjs` → `# pass 2 # fail 0`
  - 게이지 `width`/`data-monarch-mana-percent`/`aria-label` 이 `잔여 EC / 획득 EC` 비율과 일치, 0 분모 가드
  - `결속 병력`·`군단 정원` 수치가 군단 탭의 동료 카드 수·채워진 편성 슬롯 수와 일치
  - 상태창이 `#idle-return-summary` 바로 위에 위치, 콘솔/페이지 에러 0
  - 390×844 · 320×568 · 844×390 에서 `documentElement.scrollWidth <= clientWidth`, 패널이 뷰포트 안에 레이아웃됨
- [OBSERVED] `node --test 'tests/**/*.test.mjs'` → `# pass 567 # fail 0 # skipped 10`
- [OBSERVED] CI 브라우저 게이트 3종 exit 0 — `tests/defense-hud-responsive-browser.cjs`, `tests/defense-survivor-browser.cjs`, `tests/defense-performance-browser.cjs`

## 계약 준수

- `tests/defense-public-contract-regressions.test.mjs` 의 금지 어휘(`그림자 군단/세력/진영`, `복속`)를 쓰지 않고 `그림자 마력`, `군단 정원`, `ARISE` 만 사용.
- 애니메이션은 `@media (prefers-reduced-motion: no-preference)` 안의 게이지 `width` 트랜지션 뿐이며, 상태 의미는 텍스트로 전달된다.
