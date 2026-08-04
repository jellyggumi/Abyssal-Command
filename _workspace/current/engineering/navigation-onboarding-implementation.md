# 구현 스펙 — 시작 네비게이션 · 승패 상태기계 · 경계 가시화

owner: game-programmer
입력: `design/navigation-onboarding-spec.md`, `ui/navigation-overlay-ia.md`
대상 파일: `sprite-2-5d.js`, `index.html`, `sprite-2-5d.css`
드리프트 고지: 라인 번호는 현 스냅샷(`sprite-2-5d.js` 1770줄) 기준. 병행 수정 가능 → 심볼명으로 재탐색.

---

## 0. 변경 요약 (4갈래)

1. 승패 상태기계: `TARGET_WAVE` 승리 분기 + `endRun(reason, outcome)` + 결과별 패널.
2. `briefing` 모드 + 시작 오버레이 + 부팅 흐름 변경.
3. 아레나 경계 링 렌더 + 스폰 방향 예고 + 포위 경보.
4. HUD 웨이브 `N / TARGET_WAVE` 정합.

## 1. 승패 상태기계 (F1)

### 1.1 상수 (파일 상단 상수군, `ENEMY_CAP` 부근 `:21` 뒤)
```js
const TARGET_WAVE = 10;            // 승리: 이 웨이브 확보 시
const ENCIRCLE_RADIUS = 140;       // 포위 경보 반경(px)
const ENCIRCLE_THRESHOLD = 3;      // 반경 내 적 수 임계
const BRIEFING_SKIP_KEY = "abyssal-lantern:cinder-court:skip-briefing";
```

### 1.2 `updateWave()` 승리 분기 (`:1072-1077` 전멸 분기 교체)
```js
if (state.pendingSpawns === 0 && state.livingEnemies === 0) {
  if (state.wave >= TARGET_WAVE) {          // ← 신규
    endRun("cleared", "victory");
    announce(`웨이브 ${TARGET_WAVE} 완주. 잿불 법정을 사수했다.`);
    return;
  }
  state.intermission = 2.15;
  setMode("wave-clear");
  state.hudDirty = true;
  announce(`웨이브 ${state.wave} 확보. 다음 군단이 모이고 있다.`);
}
```

### 1.3 `endRun(reason, outcome="defeat")` (`:740-751` 확장)
```js
function endRun(reason, outcome = "defeat") {
  setMode("gameover");
  clearInput();
  const digest = writeRunDigest(reason, outcome);          // §1.5
  gameOverPanel.dataset.outcome = outcome;                  // CSS 스킨
  const victory = outcome === "victory";
  gameOverEyebrow.textContent = victory ? "랜턴이 끝까지 타올랐다" : "랜턴이 꺼져간다";
  gameOverTitle.textContent   = victory ? "잿불 법정을 사수했다" : "법정이 함락되었다";
  finalScoreNode.textContent  = victory
    ? `점수 ${state.score.toLocaleString()} · 웨이브 ${TARGET_WAVE} 완주`
    : `점수 ${state.score.toLocaleString()} · 웨이브 ${state.wave}`;
  runSummaryNode.textContent  = `유물 ${state.relics} · 처치 ${state.kills}`;
  gameOverPanel.hidden = false;
  playCue(victory ? "wave" : "gameover");   // 승리 전용 큐 없으면 wave 재사용
  startContinueCountdown();
  restartButton.focus({ preventScroll: true });
  return digest;
}
```
- `damagePlayer` 사망 호출(`:879`)은 `endRun("overrun", "defeat")`로 명시(선택; 기본값 동일).
- 신규 DOM 핸들 캐시(모듈 상단 셀렉터군 `:76-99`):
  `const gameOverEyebrow = document.querySelector("#sprite-2-5d-game-over-eyebrow");`
  `const gameOverTitle = document.querySelector("#game-over-title");`

### 1.4 `index.html` 결과 패널 (`:44-59`)
`<p class="eyebrow">랜턴이 꺼져간다</p>` → `<p class="eyebrow" id="sprite-2-5d-game-over-eyebrow">랜턴이 꺼져간다</p>`.
(제목 `#game-over-title`는 이미 존재.) 나머지 구조 유지.

### 1.5 `writeRunDigest(reason, outcome)` (`:698-714`)
`digest`에 `outcome` 필드 추가. 하위호환(기존 리더는 무시). 그 외 불변.

## 2. briefing 모드 + 부팅 흐름 (F2)

### 2.1 셀렉터 캐시 (모듈 상단)
```js
const briefingPanel = document.querySelector("#sprite-2-5d-briefing");
const briefingStart = document.querySelector("#sprite-2-5d-briefing-start");
const briefingSkip  = document.querySelector("#sprite-2-5d-briefing-skip");
const helpButton    = document.querySelector("#sprite-2-5d-help");
```

### 2.2 `boot()` 변경 (`:1734-1755`)
`restartGame()` 직접 호출 대신:
```js
loadingPanel.hidden = true;
if (readSkipBriefing()) { restartGame(); }        // 스킵 저장 시 바로 시작
else { showBriefing(); }
```

### 2.3 신규 함수
```js
function readSkipBriefing() {
  try { return window.localStorage.getItem(BRIEFING_SKIP_KEY) === "1"; } catch { return false; }
}
function persistSkipBriefing(skip) {
  try { window.localStorage.setItem(BRIEFING_SKIP_KEY, skip ? "1" : "0"); } catch {}
}
function showBriefing() {
  setMode("briefing");
  briefingPanel.hidden = false;
  briefingSkip.checked = readSkipBriefing();
  briefingStart.focus({ preventScroll: true });
}
function dismissBriefing() {
  persistSkipBriefing(briefingSkip.checked);
  briefingPanel.hidden = true;
  if (state.mode === "briefing" && !gameStarted) restartGame();  // 최초 시작
  else { setMode("running"); startLoop(); }                       // help 재개
}
```
- `gameStarted` 모듈 플래그: `restartGame()` 진입 시 true 세팅. help 재열람과 최초 시작을 구분.

### 2.4 help 트리거 (running→briefing 일시정지)
```js
helpButton.addEventListener("click", () => {
  if (state.mode === "running" || state.mode === "wave-clear") { stopLoop(); showBriefing(); }
});
```

### 2.5 이벤트 바인딩 (`restartButton.addEventListener` 부근 `:1729`)
```js
briefingStart.addEventListener("click", dismissBriefing);
```
`handleKeyDown`(`:1611-1646`)에 briefing 분기 선두 추가:
```js
if (state.mode === "briefing") {
  if (event.code === "Space" || event.code === "Enter" || event.code === "Escape") {
    event.preventDefault(); dismissBriefing();
  }
  return;   // briefing 중 게임 입력 차단
}
```

## 3. 경계 가시화 · 스폰 예고 · 포위 경보 (F3)

### 3.1 아레나 경계 링 (모듈 상수 + `render()` `:1465-1519` 내 `drawPickups()` 앞)
다이아몬드 4꼭짓점은 상수:
```js
const ARENA_RING = [
  [ARENA_X, ARENA_Y - ARENA_HALF_HEIGHT],
  [ARENA_X + ARENA_HALF_WIDTH, ARENA_Y],
  [ARENA_X, ARENA_Y + ARENA_HALF_HEIGHT],
  [ARENA_X - ARENA_HALF_WIDTH, ARENA_Y],
];
function drawArenaBoundary() {
  context.save();
  context.strokeStyle = "rgba(120, 233, 241, 0.22)";
  context.lineWidth = 2;
  context.setLineDash([14, 10]);
  context.beginPath();
  context.moveTo(ARENA_RING[0][0], ARENA_RING[0][1]);
  for (let i = 1; i < ARENA_RING.length; i += 1) context.lineTo(ARENA_RING[i][0], ARENA_RING[i][1]);
  context.closePath();
  context.stroke();
  context.restore();
}
```
`render()`에서 backdrop 직후·`drawPickups()` 전에 `drawArenaBoundary()` 호출.
(`clampToArena`는 L1 노름이라 경계가 정확히 이 다이아몬드 — 시각/충돌 일치.)

### 3.2 스폰 방향 예고
`spawnEnemy()`에서 `pendingSpawns>0`이고 `spawnTimer`가 임박(예: <0.35s)일 때 다음 스폰
포인트를 `state.spawnCue = {point, t}`로 세팅, `render()`에서 명멸 화살표를 해당 `SPAWN_POINTS`
좌표(→아레나 중심 방향)로 그린다. reduced-motion 시 정적 삼각형 1프레임.

### 3.3 포위 경보 (`fixedUpdate` 또는 `updatePlayer` 말미)
```js
let near = 0;
for (const e of state.enemies) {
  if (e.dead) continue;
  const dx = e.x - player.x, dy = (e.y - player.y) * 1.42;
  if (dx*dx + dy*dy <= ENCIRCLE_RADIUS*ENCIRCLE_RADIUS) near += 1;
}
const encircled = near >= ENCIRCLE_THRESHOLD;
if (encircled !== state.encircled) {   // 상태 전이에서만 announce(스팸 방지)
  state.encircled = encircled;
  if (encircled) announce("포위됐다 — 뚫고 나가라.");
}
```
`render()`에서 `state.encircled`면 화면 가장자리 붉은 비네트(reduced-motion 시 정적). `state`에 `encircled:false`, `spawnCue:null` 필드 추가(`:192-218`).

## 4. HUD 웨이브 정합 (`updateHud` `:1527`)
```js
waveValue.textContent = `${state.wave} / ${TARGET_WAVE}`;
```
`drawWaveMarker()`(`:1298-1315`)의 `웨이브 ${state.wave} 확보`는 유지.

## 5. CSS (`sprite-2-5d.css`) 신규 클래스
`.briefing-panel`(오버레이, `.game-over-panel` 레이아웃 재사용), `.briefing-list`,
`.briefing-glyph[data-glyph]`(4종 아이콘, CSS만), `.briefing-actions`, `.help-button`,
`.game-over-panel[data-outcome="victory"|"defeat"]` 색 분기, `.arena-vignette`(비네트).
reduced-motion 미디어쿼리에서 명멸/애니 정지.

## 6. 회귀 주의
- `setMode`의 `setControlsEnabled`는 running/wave-clear만 true — briefing에서 D-pad 비활성 정상.
- `frame()` 루프 가드 `isActiveMode()`는 briefing 포함 안 함 → 오버레이 중 루프 정지 정상.
- `restartGame()`은 gameover의 R/재점화에서 briefing 건너뛰고 바로 시작(현행 유지).
- `RUN_DIGEST_KEY` 스키마 변경은 additive만.
