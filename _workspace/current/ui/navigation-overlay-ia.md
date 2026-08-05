# UI 정보구조 — 시작 브리핑 오버레이 · 결과 패널

owner: ui-senior-developer
입력: `design/navigation-onboarding-spec.md`
게이트: G4(정보구조)·G6(a11y/입력지연) 입력

---

## 1. 화면 상태(모드) ↔ 표시 요소

기존 `state.mode` ∈ {loading, running, wave-clear, gameover, error}. **신규 `briefing` 추가.**

| mode | 오버레이 | 조작 활성 | 루프 |
|---|---|---|---|
| loading | `#sprite-2-5d-loading` | off | off |
| **briefing** | **`#sprite-2-5d-briefing`** | off | off (대기) |
| running/wave-clear | 없음(HUD) | on | on |
| gameover | `#sprite-2-5d-game-over` (결과별 카피) | off | off |
| error | loading(에러 스킨) | off | off |

`setControlsEnabled`는 running/wave-clear에서만 true(현행 유지). briefing에서는 오버레이
버튼만 포커스 대상.

## 2. 브리핑 오버레이 DOM (index.html, `.arena-frame` 내부, `#sprite-2-5d-loading` 뒤에 삽입)

```html
<section class="briefing-panel" id="sprite-2-5d-briefing"
         aria-labelledby="briefing-title" role="dialog" aria-modal="true" hidden>
  <p class="eyebrow">작전 브리핑</p>
  <h2 id="briefing-title">잿불 법정 방어</h2>
  <ul class="briefing-list">
    <li><span class="briefing-glyph" data-glyph="goal" aria-hidden="true"></span>
        <b>목표</b> 웨이브 <b>10</b>까지 버텨 랜턴을 지켜라. 랜턴 내구도가 0이면 함락.</li>
    <li><span class="briefing-glyph" data-glyph="move" aria-hidden="true"></span>
        <b>이동</b> WASD · 방향키 · 방향 패드. 세로 이동은 원근으로 느리게 보인다.</li>
    <li><span class="briefing-glyph" data-glyph="attack" aria-hidden="true"></span>
        <b>공격</b> Space·타격으로 전방을 벤다. Q 잿불 노바 · E 랜턴 결계(기름 소모).</li>
    <li><span class="briefing-glyph" data-glyph="hold" aria-hidden="true"></span>
        <b>사수</b> 당신이 곧 랜턴이다. 사방에서 몰려와 <b>포위</b>하면 순식간에 무너진다.
        계속 움직이고, 빛의 경계 밖으론 나갈 수 없다.</li>
  </ul>
  <div class="briefing-actions">
    <button class="briefing-start" id="sprite-2-5d-briefing-start" type="button">
      시작 <kbd>Space</kbd></button>
    <label class="briefing-skip">
      <input type="checkbox" id="sprite-2-5d-briefing-skip"> 다시 보지 않기</label>
  </div>
</section>
```

## 3. 재도움말(help) 트리거 (running 중 재열람 → briefing 재진입=일시정지)

`controls-card` 헤딩에 버튼 추가:
```html
<button class="help-button" id="sprite-2-5d-help" type="button" aria-label="작전 브리핑 다시 보기">?</button>
```
클릭 시 `setMode("briefing")` + `stopLoop()`; 시작 버튼으로 running 복귀 + `startLoop()`.
(running에서 열면 웨이브 상태 보존, 재개.)

## 4. 결과 패널 확장 (기존 `#sprite-2-5d-game-over`)

기존 노드 재사용. `outcome` 데이터셋으로 스킨 분기 + 카피 교체:
- `gameOverPanel.dataset.outcome = "victory" | "defeat"`
- 신규 노드: `#sprite-2-5d-game-over-eyebrow`(eyebrow), `#game-over-title`(제목) 텍스트를 JS가 결과별로 채움.
- CSS: `.game-over-panel[data-outcome="victory"]` 청록 계열, `[data-outcome="defeat"]` 잔불 계열.

## 5. HUD 정합 변경

- 웨이브 값: `waveValue.textContent = \`${state.wave} / ${TARGET_WAVE}\``.
- "랜턴 내구도" 라벨에 마이크로카피 툴팁/aria: "랜턴 내구도 = 당신의 생명. 0이면 함락."
  (index.html `.health-row` 첫 `<span>`에 `title`/`aria-description` 부여.)

## 6. 접근성 계약 (G6)

- 오버레이 `role="dialog" aria-modal="true"`; 열릴 때 시작 버튼에 `focus({preventScroll:true})`.
- Esc/Space/Enter로 시작(닫기). 포커스 트랩은 버튼 2개뿐이라 경량 처리(첫/마지막 순환).
- `prefers-reduced-motion`: 글리프 명멸·비네트·스폰 화살표 애니메이션은 reduced 시 정적.
- 스폰 방향 경고·포위 경보는 시각(캔버스) + `aria-live` 텍스트(`announce`) 이중 전달.
- 색만으로 승패를 전하지 않는다(제목 텍스트가 결과를 명시).

## 7. 입력지연/성능 노트 (G6)

- 오버레이는 DOM(리플로우 1회). 캔버스 경계 링·스폰 화살표는 `render()` 프레임 내 저비용
  stroke/path로, 액터 루프 밖 고정 지오메트리. 프레임 예산 p95 ≤16.7ms 회귀 없어야 함.
- 경계 링 지오메트리는 상수 → 프레임마다 재계산 금지, 모듈 상수로 1회 산출.
