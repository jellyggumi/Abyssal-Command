# Abyssal Lantern — 통합 UI/UX 전면 개선 개발 프롬프트

## 역할

당신은 모바일 우선 Three.js 액션 RPG의 Senior Game UI/UX Engineer다. 기존 persistent command-deck 구조와 실시간 전투 canvas를 유지하면서 정보 우선순위, 입력 가능성, 반응형 레이아웃, 접근성, 오디오 설정, 로비→전투→결과의 연속성을 실제 코드와 브라우저 증거로 개선한다.

## 목표

1. 처음 방문한 플레이어가 10초 안에 현재 스테이지, 목표, 조작, 편성, 출전 버튼을 찾는다.
2. 전투 중에는 canvas와 위협이 중심이고, HUD는 현재 목표·생존·스킬·추출·pause만 남긴다.
3. 390×844 portrait, 844×390 landscape, 1440×900 desktop에서 겹침·잘림·가로 스크롤 없이 모든 핵심 조작이 가능하다.
4. lobby → sortie → combat → pause → reward/terminal → lobby가 동일 DOM shell 안에서 예측 가능하게 이어진다.
5. keyboard/touch/screen reader/reduced motion/high contrast가 동등한 기능을 가진다.

## 저장소 사실과 절대 계약

- canonical title은 **Abyssal Lantern**이고 정식 스테이지는 `Cinder Span`, `Abyss Chancel`, `Echo Throne` 세 개뿐이다.
- `mountShell()`은 페이지 lifetime 동안 persistent battle shell을 한 번만 만든다. 새 화면 라우터나 두 번째 shell/SSOT를 만들지 않는다.
- `BattleSession.beginRun()`만 `started=true`와 run attempt를 기록한다. 로비 탐색이 시뮬레이션을 advance하거나 attempt를 증가시키면 안 된다.
- battle HUD는 snapshot의 public state/event를 읽기만 한다. UI가 결과·쿨다운·진행률을 독자 계산하지 않는다.
- 실제 전장은 `battle-realtime-three.js`, fallback은 `battle-visualizer.js`다. UI가 WebGL canvas를 대체하지 않는다.
- 모든 버튼은 최소 44×44 CSS px, safe-area 대응, keyboard activation, focus visible을 유지한다.
- 저장소의 기존 token/command deck/HUD patterns를 확장하며 새 디자인 체계를 병렬로 만들지 않는다.

## 먼저 읽을 파일

- `CLAUDE.md`
- `README.md`
- `app.js`
- `styles.css`
- `index.html`
- `manifest.webmanifest`
- `sw.js`
- `defense-catalog.js`
- `stage-world-catalog.js`
- `defense-audio.js`
- `battle-realtime-three.js`
- `battle-visualizer.js`
- `_workspace/current/design/abyssal-lantern-world-synopsis.md`
- `_workspace/current/design/camera-vfx-direction.md`
- `_workspace/current/production/task-manifest.md`

## 구현 요구사항

### A. 정보 구조와 로비

- 왼쪽 deck은 성장/스킬/인벤토리/군단, 오른쪽 deck은 출전/기록의 단일 소유권을 유지한다.
- stage selection은 잠금/해금/클리어, 정식 순서, 한 줄 목표, 주요 위협, 예상 보상, 현재 선택을 스캔 가능하게 보여준다.
- 선택한 stage의 3D tick-0 preview와 lobby cinematic을 유지한다. 카드 선택이 가짜 preview 또는 run advance를 만들지 않는다.
- `작전 개시`는 가장 강한 primary CTA 하나다. 잠김/편성 불충분/저장 실패 등 실행 불가 사유는 CTA 근처의 구체적 문장으로 제공한다.
- 장황한 설명은 접고, 첫 화면에는 `스테이지 → 목표 → 편성 → 출전`만 남긴다.
## Observed implementation [8.1]

**Lobby minimap**: `app.js#renderSortieTabBody` renders the fixed
Cinder→Chancel→Throne route as three native stage buttons. A new campaign reveals
Cinder only; later nodes become enabled through `campaign.unlockedStageIndex`
after the preceding stage clear. Selection reuses the existing briefing and
battle canvas—there is no per-node preview renderer or simulation advance.

**Lobby camera**: `lobby-cinematic.js#showcaseCamera` emits a commander-focused
animated `distanceScale` of `0.9–1.1`; reduced motion is a static `1.0`.
`app.js#applyShowcaseCamera` applies the shot through public renderer APIs.
Framing thresholds are `.96/1.05`.

**VFX/audio**: impact VFX are short-lived and capped at 24; critical boss
telegraphs preempt expendable cold loads. `defense-audio.js#AUDIO_EVENT_POLICY`
owns cue priority, voice caps, mute, and pause/resume behavior.

**Verification** [8.1]: desktop `1440×900` observed WebGL, three minimap nodes,
one initial reveal, and zero console errors. Mobile `390×844` observed WebGL,
three nodes, and zero horizontal overflow. The final quoted Node gate recorded
469 tests, 444 pass, 0 fail, and 25 existing fixture/history skips.
- 현재 title, stage, currency, selected companion/loadout state가 서로 다른 창에서 불일치하지 않아야 한다.

### B. 조작 학습과 발견 가능성

- 첫 런 전 또는 도움말에서 다음을 기기별로 설명한다: WASD/화살표·D-pad 이동, Space/J·attack button, skill, stance, extraction, drag orbit, pinch/wheel zoom, P/Escape pause.
- desktop keyboard, pointer, phone touch를 분리해서 보여주고 현재 input modality를 우선한다.
- 도움말 dialog는 accessible name, focus trap/return, Escape close, keyboard traversal을 갖춘다.
- 게임 시작 후 튜토리얼이 중앙을 막지 않는다. edge toast/world marker로 한 번만 안내하고 실제 입력 뒤 사라진다.
- 조작 안내 문구와 실제 key bindings/버튼 id가 일치한다.

### C. 전투 HUD 우선순위

- 전투 시작 시 command decks는 빈 상태로 두고 canvas 위에는 다음만 유지한다: stage/current objective, commander/gate integrity, legion state, active skills/cooldowns, stance, extraction, pause.
- objective, warning, damage, reward를 동일 강도로 표시하지 않는다. 우선순위는 terminal/boss warning > objective deadline/ally down > skill/extraction ready > pickup/ordinary damage다.
- world marker는 target을 가리지 않고 screen edge에서 clamp되며, actor nameplate/health가 서로 중첩되지 않도록 한다.
- skill button은 glyph, 이름/accessible label, cooldown 남은 시간, ready/blocked 상태를 함께 제공한다. 색만으로 상태를 전달하지 않는다.
- stance는 현재 상태와 다음 전환, blocked 이유를 읽을 수 있어야 한다.
- extraction은 대상, hold 진행률, 중단/완료를 world와 HUD에서 동기화한다.
- damage number와 event toast는 pool/cap을 사용해 DOM을 무한 증가시키지 않는다.

### D. Pause·설정·결과

- pause overlay는 canvas를 얼린 상태에서만 중앙 dialog로 허용한다. 전투 재개가 첫 focus이며 P/Escape와 버튼 모두 동일 toggle path를 사용한다.
- pause에 `스탯`, `인벤토리`, `동료` read-only segment를 유지하고, 직접 조정 가능한 최소 설정으로 `음소거`와 `master volume`을 제공한다.
- 오디오 설정 UI는 `DefenseAudio.setMuted()`/`setVolume()`의 public state와 동기화한다. 중복 listener, AudioContext, 저장 SSOT를 만들지 않는다.
- terminal은 defeat, victory, Stage 3 final completion을 명확히 구분한다. 보상 선택 전에는 결과 확정을 위장하지 않는다.
- result action과 lobby action은 fresh tick-0 preview로 돌아가되 attempt/reward/telemetry가 중복 기록되지 않는다.

### E. 반응형 구조

- **Desktop 1440×900**: canvas 중심, 양쪽 deck, lobby cinematic/CTA가 시각적으로 분리되며 전투 중 deck가 hit-test를 막지 않는다.
- **Phone portrait 390×844**: 왼쪽 성장 deck + 하단 출전 deck의 현재 구조를 유지하거나 더 단순화한다. CTA와 주요 전투 조작이 thumb reach 안에 있고 canvas 중요 영역을 가리지 않는다.
- **Phone landscape 844×390**: 좌우 edge와 safe-area를 고려해 HUD 높이를 줄인다. 한 손 이동, attack/skill, pause가 동시에 보이고 세로 잘림이 없다.
- **320px minimum**: content가 가로 스크롤 없이 줄바꿈/축약된다. 의미 있는 label을 무조건 숨기지 말고 accessible name은 유지한다.
- orientation 변화 중 session/state가 보존되고 listener/RAF가 중복 생성되지 않는다.

### F. 시각 체계와 분위기

- 기존 dark abyss/cyan/purple/ember/gold palette를 유지하며 다음 semantic token을 분리한다: focus, ready, warning, danger, reward, disabled.
- glass/blur는 읽기와 성능을 해치지 않는 edge HUD/로비 panel에만 사용하고, high contrast에서는 제거한다.
- typography는 Korean과 English를 함께 읽을 수 있는 크기/line-height를 사용한다. 영어 eyebrow가 한국어 목표보다 강하게 보이지 않게 한다.
- Cinder/Chancel/Throne의 accent와 objective copy는 서로 구분되지만 component layout은 동일해서 학습이 누적된다.
- 애니메이션은 상태 전환을 설명하는 데만 쓴다. reduced-motion에서 정보 손실이 없어야 한다.

### G. 접근성과 상태 계약

- landmark/heading/dialog/tablist/status/live region 계층을 실제 의미에 맞게 사용한다.
- 모든 icon-only 버튼에 accessible name과 visible focus를 제공한다.
- `aria-pressed`, `aria-selected`, `aria-disabled`, `aria-live`는 DOM visual state와 일치한다.
- overlay open 시 background interaction을 막고 close 시 합리적인 trigger에 focus를 돌린다.
- touch target 44×44, 200% zoom/reflow, prefers-contrast, reduced-motion을 검증한다.
- 화면에 표시되는 stage/title/objective는 canonical catalog/source에서 파생하며 하드코딩한 중복 데이터를 늘리지 않는다.

## 테스트와 브라우저 증거

테스트는 public behavior와 사용자 경로를 검증한다.

- 기존 관련 Node/browser 테스트를 실행한다: UI contract, lobby guide/disclosure, phone HUD, camera slice, renderer, cutscene/session, stage runtime proof.
- 새 behavior에는 최소 다음 회귀를 추가한다: audio settings UI state, pause focus/keyboard, lobby CTA disabled reason, responsive no-overflow, orientation state preservation, terminal→lobby idempotency.
- browser proof는 1440×900, 390×844, 844×390 세 viewport에서 각각 수행한다.
- 각 viewport에서 `stage select → guide open/close → formation → start → move/attack/skill → pause/audio setting/resume → objective/boss/terminal → lobby return`을 확인한다.
- 실제 WebGL 경로는 `data-defense-renderer="webgl"`로 증명한다. Canvas fallback 성공으로 대체하지 않는다.
- 확인 항목: uncaught console error 0, failed request 0, horizontal overflow 0, hidden/covered required control 0, touch target 위반 0, focus trap/return 위반 0, duplicate listener/RAF/audio context 0.
- screenshot/video를 각 viewport와 주요 상태(lobby, battle, pause, terminal)에서 남기고 정확한 경로를 보고한다.

## 완료 보고 형식

1. 변경 파일과 각 파일이 소유하는 behavior
2. 제거한 중복/obsolete UI 경로
3. 정확한 테스트·브라우저 명령과 pass/fail 수
4. screenshot/video/DOM evidence 경로
5. 접근성·responsive·performance 관찰값
6. 남은 blocker만 명시; 검증하지 않은 항목을 완료로 쓰지 않는다.

## 금지

- 새 router/shell 또는 별도 lobby SSOT
- simulation snapshot mutation/결과 재계산
- Stage 4, title 변경, canonical catalog 복제
- canvas 중앙에 상시 panel/modal 배치
- hover-only/색상-only 의미
- 44px 미만 핵심 touch target
- `display:none`으로 desktop 기능을 mobile에서 삭제하고 대체 경로를 주지 않는 방식
- 테스트 skip/threshold 완화
- `git reset --hard`, `git clean`, force-push, 사용자 변경 삭제
