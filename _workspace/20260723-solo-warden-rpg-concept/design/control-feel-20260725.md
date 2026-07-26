# 조작감 설계 — 3-스탠스 전환 & 자유 궤도 카메라 피드백 (2026-07-25)

run-id: `20260723-solo-warden-rpg-concept` · lane: 조작감 설계 (`stage1-reentry-synthesis-20260725.md` §4-4)
입력: `stage1-reentry-synthesis-20260725.md`(§1 확인됨/§2 구현갭/§3 백로그), `trend-survey/defense-offense-rpg-hybrid-deep-research-20260725.md`(8게임 심층 리서치), `presentation-spec.md:14-38`(D17 카메라 스펙), `UNIFIED-GDD.md:69-112`(코어루프/포메이션), `app.js`(입력레이어 원본), `defense-audio.js`(절차적 합성 오디오).

이 문서는 §2.1(자유 궤도 카메라)과 §2.3(3-스탠스 편성)의 구현 요구사항 중 **입력 상호작용 및 피드백**(시각/오디오/모션) 축만 다룬다 — 카메라 구면좌표 계산·오프셋 수치 산출은 `battle-realtime-three.js` 구현 소관(§2.1 요구사항 1-4)이며, 이 문서는 그 위에 얹히는 **느낌(feel)** 계약만 정의한다. hunt→extract→materialize→capture→assault 체인은 불변 — 이 문서는 assault 단계 내 입력 표면에만 관여한다.

## 1. 컨트롤 존 분리 확인 — 충돌 리스크 없음

**결론**: 이동 입력과 궤도 카메라 입력은 DOM 요소·포인터캡처·상태머신 3중으로 분리되어 있어 제스처 오인식 리스크가 없다. 근거:

1. **별개 DOM 요소, 별개 리스너**: 이동은 `#movement-actions`(`app.js:825`, `root.querySelector("#movement-actions")`)에 바인딩된 `onMoveControlDown`/`onMoveControlEnd`(`app.js:826-830`)가 처리하고, 궤도/줌은 `this.canvas`(`app.js:820-824`)에 바인딩된 `onPointerDown`/`onPointerMove`/`onPointerEnd`가 처리한다. 두 리스너 그룹은 서로 다른 이벤트 타깃에 등록되어 있어 브라우저 레벨에서 이벤트가 섞이지 않는다. [OBSERVED, `app.js:820-830`]
2. **포인터캡처로 제스처 도중 소유권 고정**: 이동 버튼을 누르면 `button.setPointerCapture?.(event.pointerId)`(`app.js:961`)가 해당 pointerId를 버튼에 고정시킨다 — 이후 손가락이 캔버스 영역까지 미끄러져도 `pointermove`/`pointerup`은 계속 버튼으로 라우팅되며 캔버스의 `onPointerMove`는 이 pointerId를 아예 모른다(`this.activePointers`에 등록된 적이 없으므로 `app.js:925`의 `if (!this.activePointers.has(event.pointerId)) return;`에서 조기 반환). 캔버스 드래그도 대칭적으로 `this.canvas.setPointerCapture?.(event.pointerId)`(`app.js:907`)로 고정된다. **결론**: 한 손가락이 시작한 제스처는 끝까지 시작 요소가 소유하며, 중간에 다른 컨트롤로 "새어나가는" 경로가 구조적으로 없다.
3. **기하학적 위치도 방어선을 이중화**: `#movement-actions`는 `.one-thumb-controls`(styles.css:189, `max-width: min(45vw, 320px)`)로 좌하단에 배치되고 `.defense-bottom`(styles.css:40)이 `bottom: max(.4rem, var(--defense-safe-bottom))`으로 화면 최하단에 고정된다. 캔버스의 `centralRegionContains`(`app.js:893-897`)는 궤도 입력을 `height * 0.14` ~ `height * 0.86` 세로 범위로만 허용한다 — 즉 하단 14% 밴드(이동 D-pad가 실제로 자리한 영역)는 애초에 오빗 트리거 대상에서 제외된다. 이는 포인터캡처 방어선이 실패하더라도(예: 터치 시작점이 D-pad 픽셀 경계에 정확히 걸친 극단적 케이스) 기하 경계가 2차 방어선 역할을 한다는 뜻이다.
4. **의도가 코드 주석으로 명문화되어 있음**: `app.js:899-902`의 주석 — "Canvas pointer input now drives the free camera (Cycle 3 / D17), never movement: one-finger drag orbits (yaw/pitch), two-finger pinch zooms. Movement input is exclusively #movement-actions (D-pad) and keyboard — both fully independent of the canvas, so no movement capability is lost." [OBSERVED, `app.js:899-902`] — 이 분리는 사고가 아니라 D17 결정의 명시적 구현 의도다.

**리스크 플래그 (경미, 구현 단계 확인 필요)**: `centralRegionContains`의 8%/14% 마진 비율은 `#movement-actions`/`#skill-actions`(`app.js:702`, 우상단)의 실제 CSS 크기와 별도로 하드코딩된 값이다 [OBSERVED, `app.js:894-896` vs `styles.css:189-190,240`] — 현재는 두 값이 우연히 호환되지만, 향후 HUD 레이아웃이 변경되어 엣지 패널이 14%/8% 마진보다 안쪽으로 확장되면(예: 스탠스 버튼이 `#battle-actions`에 추가되어 좌하단 패널 폭이 넓어지는 경우, 아래 §2 참조) `pointer-events: auto`인 버튼 위에서 시작된 터치가 여전히 캔버스 `centralRegionContains` 판정을 통과할 여지가 이론상 생긴다. 실제로는 버튼 자체가 `pointer-events: auto`이고 캔버스보다 z-index상 위(`#defense-edge-hud`가 `#defense-canvas` 다음에 위치, `styles.css:36-38`)에 있으므로 버튼 위 터치는 버튼이 먼저 소비해 캔버스까지 도달하지 않는다 — 이것이 실질적 방어선이며 마진 비율은 여유분에 불과하다. **결론**: 현재 코드로는 충돌 없음, 구현 단계에서 신규 HUD 요소 추가 시 z-index/pointer-events 레이어 순서만 유지하면 이 분리는 자동으로 보존된다.

## 2. 3-스탠스 전환 피드백 스펙

### 2.1 기존 오디오 인프라 재사용 매핑

`defense-audio.js`는 이미 이벤트 타입 → 큐 프로파일 매핑 체계(`EVENT_CUE_IDS`, `defense-audio.js:107-138`)와 성공/거부 분기를 위한 베리언트 체계(`CUE_VARIANTS`, `defense-audio.js:74-105`)를 갖추고 있다. 카테고리:
- **상태 전환류**(성공, 확신감 있는 톤): `growth-offer`(`triangle 320→400 + sine 480→640`, `defense-audio.js:32-35`), `extraction-ready`(`sine 360→540 + triangle 180→270`, `defense-audio.js:64-67`), `occupation-captured`(`triangle 240→360 + sine 120→240`, `defense-audio.js:68-71`) — 전부 상승 주파수의 2단 톤으로 "성공적 상태 진입"을 표현하는 공유 문법.
- **거부/무효류**: `impact-hit`의 `PICKUP_DENIED` 베리언트(`square 76→42, 0.08s`, `defense-audio.js:85-87`) — 짧고 낮은 단일 buzz로 "행동 거부"를 표현.
- **재사용 불가 판정**: 신규 톤 프로파일을 발명하지 않는다. 스탠스 전환은 이 두 기존 문법 중 하나에 정확히 대응된다.

**제안 매핑** (신규 `EVENT_CUE_IDS` 엔트리 2개, 기존 `CUE_PROFILES`/`CUE_VARIANTS` 재사용):

| 이벤트 | 재사용 큐 | 근거 |
|---|---|---|
| `STANCE_SWITCHED`(성공) | `occupation-captured` 프로파일 재사용(또는 신규 alias) | 스탠스 전환도 "새 상태로의 확정적 진입"이라는 동일 의미 카테고리 — `occupation-captured`의 상승 2단 톤(`triangle 240→360 + sine 120→240`)이 "전열→분산 같은 재배치가 완료됐다"는 확신감을 그대로 전달한다. `OCCUPATION_PROGRESS`가 이미 같은 프로파일을 진행 틱용으로 재사용하는 선례(`defense-audio.js:82-84`)가 있어, 스탠스 전환도 동일 재사용 패턴을 따르면 새 신스 보이스를 추가하지 않는다. |
| `STANCE_SWITCH_BLOCKED`(쿨다운 중 시도) | `impact-hit:PICKUP_DENIED` 베리언트 그대로 재사용 | 의미가 동일하다 — "지금은 안 됨". `CUE_REFRACTORY_SECONDS`에 `impact-hit: 0.025`(`defense-audio.js:143`)가 이미 설정돼 있어 연타해도 청각 피로 없이 짧게 반복 가능. |

두 이벤트 모두 `CUE_REFRACTORY_SECONDS`에 스탠스 전용 리프랙토리를 추가할 필요가 없다 — 4초 쿨다운 자체가 이미 `STANCE_SWITCHED` 발생 빈도의 자연스러운 하한이고, `STANCE_SWITCH_BLOCKED`는 재사용하는 `impact-hit`의 기존 0.025초 리프랙토리로 충분하다.

### 2.2 쿨다운 상태 표시 — 시각

기존 `#battle-actions`(`app.js:715`)의 버튼 패턴을 그대로 따른다 — `#toggle-pause`가 `aria-pressed`(`app.js:1515`)를, 스킬 버튼이 `disabled` + 남은 초 텍스트(`app.js:1473`, `${cooldown ? \`${(cooldown / TICK_RATE).toFixed(1)}s\` : "준비됨"}\`)를 쓰는 것과 동일한 문법:

```
<button class="stance-action" data-stance="VANGUARD" aria-pressed="${current === "VANGUARD"}" ${onCooldown ? "disabled" : ""}>
  <span class="stance-glyph" aria-hidden="true">${glyph}</span>
  <span class="stance-copy"><strong>전열</strong><small>${onCooldown ? `${remainingSeconds.toFixed(1)}s` : "전환 가능"}</small></span>
</button>
```

- **쿨다운 중**: `disabled` + 잔여 초 텍스트 — 스킬 버튼과 동일 언어이므로 플레이어가 이미 학습한 패턴을 재사용(신규 UI 문법 학습 비용 없음). `reduced-motion`에서도 완전히 유효 — 애니메이션에 의존하지 않고 텍스트/disabled 상태만으로 정보 전달.
- **쿨다운 완료 임박(마지막 0.5초)**: 애니메이션 없이 `disabled` 속성만 해제하는 것으로 충분하다는 것이 기본안이지만, `reduced-motion` 미적용 시에 한해 버튼 테두리 색이 정적 회색→활성색으로 전환되는 CSS `transition`(비-transform, 비-opacity 애니메이션이 아닌 `border-color` 전환이므로 `styles.css:93`의 전역 `@media (prefers-reduced-motion: reduce) { … transition: none !important; }`가 이미 자동으로 무력화함 — 별도 처리 불필요)만 추가 고려. **핵심 제약**: 펄스/글로우 루프 애니메이션은 추가하지 않는다 — `styles.css:414-417`의 `.rc-glow-ring`류 이미 존재하는 reduced-motion 예외 처리 패턴을 신규로 늘리지 않기 위함이며, 스킬 버튼도 현재 펄스 없이 텍스트만으로 쿨다운을 표현하는 기존 관행과 일치시킨다.
- **현재 선택된 스탠스**: `aria-pressed="true"` + 시각적 강조(배경색, 아이콘 형태 자체가 아니라 배경/테두리 대비만 — §3의 아이콘 형태 분화 백로그(§3 D)는 영구 Track A/B vs 런스코프 구분용이며 스탠스 3종은 이미 서로 다른 상태이므로 색 대비만으로 충분, 신규 아이콘 형태 규약 불필요).

### 2.3 쿨다운 중 시도 시 피드백 (성공 못지않게 중요)

플레이어가 4초 쿨다운 중 스탠스 버튼을 다시 누르면: (a) `STANCE_SWITCH_BLOCKED` 오디오 큐(§2.1) 즉시 재생, (b) 버튼에 짧은 `shake` 클래스 토글(reduced-motion 시 `styles.css:93` 전역 룰로 자동 무력화되므로 별도 분기 불필요) — Whiteout Survival의 노랑/빨강 검증-버블 패턴(§3 백로그 C, `stage1-reentry-synthesis-20260725.md:86`)과 동일한 "실행 전 무효 시도를 즉시 알린다"는 원칙을 여기서도 적용하되, 버블(별도 시각 위젯)을 새로 만들지 않고 이미 disabled인 버튼 자체가 그 역할을 겸하므로 화면공간 비용이 0이다.

### 2.4 촉각(햅틱) — 제안하지 않음

`app.js`/`defense-audio.js` 전체를 검색한 결과 `navigator.vibrate` 또는 유사 햅틱 API 호출이 현재 코드베이스에 전혀 없다 [OBSERVED, 코드 검색 — 매치 0건]. 신규 햅틱 인프라를 이 문서에서 제안하지 않는 이유: (1) iOS Safari는 `navigator.vibrate`를 지원하지 않아(웹 표준 API 한계) 크로스 플랫폼 일관성이 애초에 불가능하고, (2) 오디오+시각 이중 채널로 이미 성공/거부 피드백이 완결되므로 햅틱은 부가 채널이지 필수 채널이 아니다. **[INFERENCE]** 결론: 스탠스 전환 피드백은 오디오+시각 2채널로 완결하며 햅틱은 스코프 밖.

## 3. 자유 궤도 카메라 — 이징/모멘텀/클램프 저항 피드백

### 3.1 확정 스펙 재확인

`presentation-spec.md:18-25` [OBSERVED]:
```yaml
angle: free orbit — yaw unrestricted, pitch clamped [30°, 85°] from ground plane (default 65°)
follow: lag easing 0.18 (기존 CAMERA_FOLLOW_EASING 재사용), reduced-motion hard-cut on auto-follow only
control: one-finger drag = orbit, two-finger pinch = zoom
```
기존 `CAMERA_FOLLOW_EASING = 0.18`(`app.js:67`)이 현재 2D 팔로우 카메라(`updateCamera`, `app.js:869-887`)에서 이미 `this.camera.x + (target.x - this.camera.x) * CAMERA_FOLLOW_EASING` 형태의 지수 감쇠(exponential ease-out)로 쓰이고 있다 — 3D 오빗 카메라의 `orbitYaw`/`orbitPitch`/`zoomFactor` 오토팔로우도 **동일한 감쇠 상수·동일한 수식 형태**를 재사용해야 한다는 것이 §2.1 요구사항 1-4가 이미 명시한 방향이다(신규 값 발명 아님).

### 3.2 드래그 중 (사용자 입력 반응성) — 이징 없음, 즉각 1:1 추종

`onPointerMove`의 `renderer?.orbit?.(dx * CAMERA_ORBIT_YAW_SENSITIVITY, -dy * CAMERA_ORBIT_PITCH_SENSITIVITY)`(`app.js:940`)는 프레임마다 델타를 그대로 누적하는 1:1 추종이며 감쇠가 없다 — **이는 의도된 설계**다: 사용자가 손가락을 움직이는 동안 카메라가 지연되면 "드래그 반응이 둔하다"는 체감이 생기므로, 능동 드래그 중에는 이징을 걸지 않는다. 이 원칙은 pitch 클램프 저항(§3.3)에도 그대로 이어진다 — 클램프는 "더 이상 못 간다"는 하드 리밋이지 "천천히 저항하며 간다"는 소프트 감쇠가 아니다.

### 3.3 피치 클램프 경계 저항 ([30°, 85°])

**기본안: 하드 클램프, 오버스크롤 없음.** `pitch = Math.max(30°, Math.min(85°, pitch + dPitch))` 형태로 매 프레임 clamp — 사용자가 계속 위/아래로 드래그해도 값이 경계를 넘지 않는다. 근거:
1. **결정론 제약과의 정합**: `stage1-reentry-synthesis-20260725.md` §2.1 요구사항 5가 명시하듯 카메라는 시뮬레이션 상태에 영향을 주지 않는 순수 옵저버(`tests/defense-renderer-contract.test.mjs`가 이미 검증)다 — 오버스크롤-후-스프링백 같은 물리 모멘텀을 추가하면 카메라 상태 자체에 시간 종속 애니메이션 상태(스프링 속도/감쇠)가 새로 생기고, 이는 렌더 프레임 스킵/디바이스 성능차에 따라 시각적으로 미세하게 달라질 수 있는 비결정 요소를 도입한다 — 순수 옵저버라는 불변량을 지키려면 프레임당 즉시 clamp가 더 안전하다. **[INFERENCE — 오버스크롤 스프링이 시뮬레이션 계약을 직접 위반하지는 않지만(카메라는 어차피 시뮬레이션 상태를 읽기만 함), 렌더 어댑터의 복잡도와 QA 표면을 불필요하게 늘린다는 판단]**
2. **경계 도달을 알리는 신호는 필요**: 하드 클램프만 있으면 "내가 이미 최대각인데 왜 더 안 움직이지"라는 혼란이 생길 수 있다. 저비용 해결: 클램프 경계에 닿은 프레임에 한해 CSS `filter: brightness()` 없이(reduced-motion과 무관하게 유지하려면 색상/투명도 애니메이션도 피하는 게 안전) **오디오 신호만** 사용 — 경계 도달 시 `impact-hit`류의 아주 짧은(0.03-0.04s) 저음량 tick 1회(리프랙토리로 연속 드래그 중 반복 재생 방지, 예: `CUE_REFRACTORY_SECONDS`에 0.15s 정도 신규 등록). 시각 신호를 강제하지 않는 이유: 카메라 회전 중에는 이미 3D 월드 자체가 시각적으로 계속 움직이고 있어 추가 UI 오버레이가 시야를 방해할 위험이 크다 — 오디오 단독 신호가 non-intrusive.
3. **대안(모멘텀+오버스크롤)을 채택하지 않는 이유**: Diablo Immortal/Torchlight Infinite 둘 다 고정 카메라를 채택(§4 리서치, `defense-offense-rpg-hybrid-deep-research-20260725.md:190,214`)해 참고할 자유 궤도 카메라 저항감 선례가 8게임 리서치에 아예 없다 — 이 항목은 업계 선례 기반이 아니라 D17의 "완전한 자유 궤도 카메라를 구축한다"는 명시적 사용자 결정(`stage1-reentry-synthesis-20260725.md:35-36`)을 결정론/QA 단순성 제약과 절충한 설계 판단이다. **[INFERENCE]**

### 3.4 오토팔로우 재개 (드래그 종료 후)

포인터 업(`onPointerEnd`, `app.js:943-953`) 시 궤도 상태(`orbitYaw`/`orbitPitch`/`zoomFactor`)는 그 값을 유지한 채 고정되고, 익명(idle) 상태로 복귀하면 렌더러가 커맨더 추적을 재개해야 한다 — 다만 **재개 시점과 방식**은 스펙에 명시되지 않은 부분이므로 이 문서가 제안한다:

- **재개 트리거**: 포인터 업 즉시가 아니라, 짧은 유예(예: 1.5-2.5초 idle 후) 뒤 오토팔로우가 yaw/pitch를 커맨더 정면 기준값(default 65° pitch, person-relative yaw=0)으로 서서히 되돌리는 것이 아니라 — **[중요 정정]** §2.1 요구사항 4가 명시하듯 "커맨더 추적(follow) 로직 자체는 유지(타겟 지점만 궤도 중심으로 사용)"이므로, 오토팔로우가 되돌리는 것은 **카메라가 바라보는 타겟 위치**(팬)이지 **사용자가 설정한 궤도 각도**(yaw/pitch/zoom)가 아니다. 즉 플레이어가 옆에서 내려다보는 각도로 회전해뒀다면, 그 각도는 유지된 채 카메라 타겟만 계속 커맨더를 따라간다 — 각도를 강제로 원위치시키지 않는다. 이는 Diablo Immortal이 명시적으로 회피한 문제(고정 카메라라 애초에 이 질문 자체가 없음)와 달리, Abyssal Surge는 자유 궤도이므로 "사용자가 고른 시야각을 존중한다"는 원칙이 UX상 더 중요하다. **[INFERENCE — 스펙 문서가 재개 대상을 명시하지 않아 요구사항 4의 "타겟 지점만 궤도 중심으로 사용"이라는 문구에서 논리적으로 도출]**
- **재개 이징**: 타겟 위치(팬) 추적은 기존 `CAMERA_FOLLOW_EASING = 0.18`을 그대로 재사용(§3.1) — 드래그 종료 즉시 다음 프레임부터 지수 감쇠로 부드럽게 커맨더를 따라간다. 유예 없이 즉시 재개하는 이유: 유예를 두면 "드래그를 놓았는데 카메라가 안 움직인다"는 지연 체감이 생기고, 지수 감쇠(ease-out) 자체가 이미 "부드러운 재추종"의 체감을 주므로 별도 유예 타이머가 불필요.
- **reduced-motion**: 스펙이 명시한 대로 "auto-follow lag(0.18 easing)만 hard-cut, 사용자 드래그/핀치는 항상 반응"(`presentation-spec.md:21`) — 즉 `motionQuery.matches === true`일 때 팬 추적은 `updateCamera`의 기존 분기(`app.js:878-881`, `if (this.motionQuery?.matches) { this.camera = target; return target; }`)와 동일한 패턴으로 즉시 스냅해야 하며, 사용자 드래그 중 orbit/zoom 입력의 1:1 반응성(§3.2)은 reduced-motion 여부와 무관하게 항상 유지된다 — 이는 이미 스펙에 명문화되어 재론할 필요 없는 항목이지만, 구현 시 `orbitYaw`/`orbitPitch`용 신규 이징 코드가 `motionQuery.matches` 분기를 빠뜨리지 않도록 이 문서에서 명시적으로 재확인한다.

### 3.5 줌 (핀치) 이징/저항

`onPointerMove`의 핀치 처리(`app.js:928-934`)도 드래그와 동일하게 델타 즉시 반영, 이징 없음 — §3.2와 동일 원칙(능동 제스처 중에는 지연 없음). `zoomFactor`의 `[near, far]` 클램프(§2.1 요구사항 3, GLB 바운딩구체 기반 산출 예정)도 §3.3과 동일하게 하드 클램프 + 경계 도달 시 동일한 저음량 tick 오디오 신호 재사용(신규 사운드 불필요, `impact-hit` 계열 공유).

## 4. Archero vs Brotato 교차검증 — 기존 설계는 Brotato 모델에 가까우며 변경 불필요

**리서치 근거**: `defense-offense-rpg-hybrid-deep-research-20260725.md` §카테고리2 종합(라인 70-116). Archero는 실시간 이동이 곧 전투 결정("stutter-step" — 발사를 위해 정지, 회피를 위해 이동, 1-2초마다 결정, 라인 78)이며 인런 인터럽트가 킬-트리거 가변 케이던스다. Brotato는 웨이브 중 실시간 결정밀도가 "분당 0에 가까움(순수 이동/생존)"이며 모든 아이템화 결정이 웨이브-경계로 이연된다(라인 101, 111).

**Abyssal Surge의 현재 위치**: `lane-coreloop.md:20`(`stage1-reentry-synthesis-20260725.md`가 §1에서 재확인한 기존 결정) — "기본 공격과 타겟 선택은 계속 100% 자동 해상한다. 플레이어의 새 행위 주체성은 조준/락온이 아니라 '포메이션 스탠스'라는 상위 전략 레이어에 배치한다" [OBSERVED, `lane-coreloop.md:20`]. 전투 중 실시간 입력은 이동(8방향 D-pad/키보드)뿐이며, 발사/타겟팅은 전부 자동 — 이는 Archero의 "정지=발사, 이동=회피"라는 이동-발사 결합 모델이 아니라, Brotato의 "이동은 순수 포지셔닝, 발사는 자동"이라는 이동-발사 분리 모델과 구조적으로 동일하다. **결론: Abyssal Surge는 이미 Brotato 모델에 해당한다.**

**Archero 모델에서 가져올 것이 있는가 — 없음, 그리고 그 이유가 설계 제약과 직접 충돌**: Archero의 높은 결정밀도는 "이동으로 공격을 취소하고 재개한다"는 메커닉에서 나온다 — 즉 이동과 전투 해상이 같은 입력 채널을 다툰다. `lane-coreloop.md:26-27`의 기존 판정표가 이미 이 정확한 트레이드오프를 검토했다: 수동 조준/락온(Archero류 결합 모델로 가는 전제조건)은 "결정론적 60Hz 시뮬 / 렌더 분리" 및 "모바일 full-bleed Canvas + edge-only HUD" 두 항목에 불리하다고 판정되어 이미 기각됐다 [OBSERVED, `lane-coreloop.md:26-27`]. 즉 Archero 모델로 이동하는 것은 리서치가 새로 제기하는 미검토 트레이드오프가 아니라, **이미 명시적으로 검토되고 거부된 경로를 다시 여는 것**이다 — 이번 리서치가 이 판정을 뒤집을 새 근거를 제시하지 않으므로 재론하지 않는다.

**Archero의 두 번째 특징(가변 킬-트리거 인터럽트 케이던스)은 이미 부분 이식됨**: `UNIFIED-GDD.md` §2.3의 `vanguard-circuit` 코어루프가 "XP임계값 스킬제안"을 `reward_events_per_loop`로 이미 포함하고 있고(`UNIFIED-GDD.md:97`), 이는 Archero의 "레벨업마다 3택"과 동일한 킬-누적 트리거 문법이다 — 다만 실시간 전투 입력(이동)과는 분리된 별도 이벤트 채널이므로 Brotato식 웨이브-경계 분리 원칙(§3 이 리서치 문서의 결론 B, `stage1-reentry-synthesis-20260725.md:234`)과도 충돌하지 않는다. 즉 **Abyssal Surge는 이미 두 게임의 유용한 특성을 각자의 영역에서 취하고 있다**: 실시간 입력 밀도는 Brotato형(이동만, 발사 자동), 성장 인터럽트 트리거는 Archero형(킬/XP 누적 기반 가변 케이던스, 고정 타이머 아님).

**명시적 결론**: 변경 제안 없음. 이는 검토를 생략한 결과가 아니라 — (1) Archero의 결합형 이동-전투 모델은 기존 판정표가 이미 검토·기각했고, (2) Archero의 가변 인터럽트 케이던스는 이미 별도 채널로 이식되어 있어 추가로 가져올 요소가 없다는 것을 리서치 근거로 확인한 결과다. 유일하게 열려 있는 실증적 질문은 **4초 스탠스 쿨다운이 실시간 결정밀도를 너무 낮춰 "체감상 지루하다"고 느껴지는가**인데, 이는 수치 밸런싱(플레이테스트) 문제이지 모델 전환 문제가 아니므로 이 조작감 설계 문서의 스코프 밖이다.

## Director Handoff Note (디렉터 핸드오프 노트)

가장 중요한 결정: **§3.4의 오토팔로우 재개 정책**이다 — 스펙(`presentation-spec.md:21`)은 "auto-follow lag 0.18, reduced-motion hard-cut"만 명시하고 재개가 사용자의 궤도 각도(yaw/pitch/zoom)까지 초기화하는지는 침묵한다. 이 문서는 §2.1 요구사항 4의 "커맨더 추적 로직은 유지하되 타겟 지점만 궤도 중심으로 사용한다"는 문구에서 **각도는 유지, 팬 타겟만 재추종**이라고 추론했다(§3.4) — 이는 스펙의 명시적 확정이 아니라 이 레인의 해석이므로, 병합 시 디렉터가 반드시 명시적으로 확정해야 한다. 대안(일정 유예 후 각도까지 기본값 65°로 리셋)도 일부 모바일 ARPG에서 쓰이는 패턴이지만, 그 경우 "플레이어가 골라둔 시야각을 존중하지 않는다"는 트레이드오프가 생기며 8게임 리서치에는 이 질문에 답할 자유 궤도 카메라 선례가 아예 없다(Diablo Immortal/Torchlight Infinite 둘 다 고정 카메라, §3.3 항목 3) — 따라서 순수 설계 판단이며 디렉터의 명시적 재확인이 필요하다. 이 결정에 따라 `battle-realtime-three.js`의 `orbit()`/`updateCamera()` 구현이 "각도 유지+타겟만 추종" 또는 "각도까지 리셋" 중 어느 쪽으로 갈리는지가 갈라지므로, 구현 착수 전에 확정돼야 한다.
