# UI 재설계 델타 — Stage 1 리서치 반영 (2026-07-25)

run-id: `20260723-solo-warden-rpg-concept` · role: `ui-senior-developer` · lane: `UILayoutRedesign`
입력: `design/stage1-reentry-synthesis-20260725.md`(§2/§3), `design/trend-survey/defense-offense-rpg-hybrid-deep-research-20260725.md`
(교차-카테고리 종합, `defense-offense-rpg-hybrid-deep-research-20260725.md:224-250`), 기존 `ui/lane-hud-layout.md`,
`ui/lane-info-architecture.md`. 이 문서는 두 기존 문서를 대체하지 않는다 — **델타**만 정의하며, 병합은 디렉터 소관이다.

**전제 확인 [OBSERVED, `app.js:80-86`]**: 5탭 커맨드덱 셸(출정/성장/동료/인벤토리/요새, `COMMAND_TABS`)은 이미 라이브 —
탭 구조 자체는 재설계 대상이 아니다. 이 문서는 그 안의 콘텐츠 밀도/패턴만 다룬다.

---

## 1. 백로그 판정 — C / D / E (synthesis §3)

### C. Whiteout Survival 노랑/빨강 검증-버블 — **ACCEPT**

**근거**: Whiteout Survival의 Squad Deploy 화면(공식 패치노트 원문 인용)은 "배정된 영웅이 City에 없으면 노란
버블, 병력 부족이면 빨간 버블"을 표시 — 블로킹 모달 없이 무효/위험 편성을 사전경고하는 저비용 패턴
[OBSERVED, `defense-offense-rpg-hybrid-deep-research-20260725.md:64,238`]. 이 프로젝트는 이미 동형의 검증 표면을
갖고 있다: FRONT 슬롯 동료는 `formationIntegrity` 소모 리스크를 지며[OBSERVED, `rpg-catalog.js:124-132`
`companionFormationIntegrity(baseDamage, wardTierIndex)`], 전투 중 `entry.status === "DOWNED"`로 전이한다
[OBSERVED, `defense-run-simulation.js:1166-1168,1534-1536`]. 이 정보가 지금은 **편성 화면 어디에도 노출되지
않는다** — `formationRowMarkup()`은 슬롯 라벨(`FRONT`/`BACK`)만 그리고 위험도는 표시하지 않는다
[OBSERVED, `app.js:394-399`].

**타이밍 정정(synthesis §3 원문 대비)**: synthesis 표는 "동료 편성 화면(2.6 세그먼트)"을 대상으로 지목했는데,
실제로는 **두 개의 분리된 신호**로 갈라야 정확하다 — `DOWNED`는 런-스코프 라이브 상태(런 종료 시 리셋, §2.2
GDD 확인)이고 `formationIntegrity`는 런 시작 **전** 장비 티어로부터 계산되는 예측 가능한 값이다. 따라서:

| 신호 | 발생 위치 | 화면 |
|---|---|---|
| 노랑 버블 — 저(低) `formationIntegrity` 예상 | 편성 확정 **전**, 정적 계산(`wardTierIndex`가 낮을수록) | 동료 › 편성 세그먼트 (오프배틀, `renderCompanionsTab()` `formation` 세그먼트) — 신규 편성-편집 컨텍스트 |
| 빨강 버블 — `DOWNED` 라이브 상태 | 런 중, 시뮬레이션이 상태 전이시킴 | 동일 편성 화면(일시정지 오버레이 경유 재진입 시) + `lane-hud-layout.md` 행6 "동료 로스터 트레이"(신규, 화면공간) — 이 문서 §3에서 별도 취급 |

**시각 스펙** (edge-card 어휘 재사용, `ui/lane-info-architecture.md` §0 근거):

- 컨테이너: `.growth-formation-slot`(기존, `styles.css:213`) 우상단에 절대배치 원형 배지 `.formation-integrity-badge`,
  지름 `1rem`(48dp 카드 안에서 코너 오버레이 — §접근성 밀도 규칙과 무충돌, 배지는 별도 탭 타깃이 아니라 상태
  표시 전용이므로 48dp 타깃 규칙 미적용).
- 색상: 노랑 `#e9c46a`(기존 `.integrity-meter i` 그라디언트 중간 정지점 재사용, `styles.css:194`), 빨강
  `#e26b72`(동일 그라디언트 첫 정지점 재사용) — **신규 색상 도입 없음**.
- **색-독립 채널(필수, GDD §6.3 원칙 준용)**: 배지 안에 아이콘 — 노랑=`!`(느낌표, 저위험), 빨강=`✕`(교차,
  전열불가) — 그레이스케일 렌더에서도 두 상태가 아이콘 형태로 구분됨. 텍스트 채널: `aria-label`에
  `"편성 경고: {companionLabel} 전열 정예 편성 위험 — 워드 등급 낮음"`(노랑) /
  `"편성 경고: {companionLabel} 현재 전열 이탈(DOWNED) 상태"`(빨강).
- 트리거 조건: 노랑 = 해당 동료가 `FRONT` 슬롯에 있고 `equipment.ward` 티어 인덱스 `0`(T1, Echo-Bound,
  배율 1.00 — 무강화 상태)[OBSERVED 티어 정의: `rpg-catalog.js:107-115`] **[INFERENCE: "낮음"의 정확한 임계값은
  밸런스 시트 소관 — T1 무강화를 최소 기준선으로 제안, 확정치 아님]**. 빨강 = 해당 동료 레코드가
  전 런에서 `DOWNED`로 종료된 상태를 유지 중(런 리셋 전 재진입, 예: 일시정지 오버레이 경유).
- 비블로킹 확인: 배지는 정보 표시만 하며 편성 확정을 막지 않는다 — Whiteout 원 패턴과 동일하게 "경고이지
  차단이 아님"[OBSERVED: `defense-offense-rpg-hybrid-deep-research-20260725.md:64` "커밋 전 무효 편성을 잡아내는
  경량 일견성 검증"].

---

### D. 색-독립 인코딩을 동료 네임플레이트/체력바로 확장 — **ACCEPT**

**근거**: 카테고리4 종합이 명시 — "Diablo Immortal/Torchlight Infinite 두 게임 모두 동료-vs-적-vs-플레이어 시각
구분을 잘 해결하지 못했다"[OBSERVED: `defense-offense-rpg-hybrid-deep-research-20260725.md:220`]. 구체적으로
Torchlight Infinite는 소환 동료가 "플레이어와 동일한 네임플레이트+바 관례를 공유"하며 리뷰어가 그 결과 전투를
"지저분하고 혼란스럽다"고 명시 비판했다[OBSERVED: `defense-offense-rpg-hybrid-deep-research-20260725.md:209,211`].
Abyssal Surge는 편성-기반 동료전투(최대 3, `MAX_LOADOUT_SIZE`[OBSERVED: `campaign-state.js:20`])로 두 레퍼런스보다
동시 동료 수가 많아 이 실패를 반복할 위험이 더 크다.

GDD §6.3은 이미 아이템 등급에 대해 "색상+아이콘(꼭짓점수)+텍스트 3중 인코딩, 최소 2채널이 색상 없이도 식별
가능"을 강제한다[OBSERVED: `UNIFIED-GDD.md:259`, 구현: `styles.css:215-221` `.tier-icon[data-tier-vertices]`].
이 원칙의 **축을 등급(rarity)에서 개체유형(entity-type: 동료/적/커맨더)으로 확장**한다 — 별개 인코딩 문제이므로
`.tier-icon`과 충돌하지 않는다.

**시각 스펙** (`ui/lane-hud-layout.md` §1 행11 "동료 네임플레이트+체력바"의 구현 세부사항으로 병합 제안):

| 개체유형 | 색상 채널 | 형태 채널(색-독립) | 근거 |
|---|---|---|---|
| 커맨더(플레이어 자신) | 기존 청록/시안 계열 유지(`--canon-cyan-rift` 계열) | 무표식(위치가 항상 카메라 중심 근접이라 모호성 낮음, 기존 관례 유지) | 변경 없음 |
| 동료(companion) | 쿨톤 — 기존 `.gate-panel-bar-track.gate`의 `#5c8ecf→#79d6ff` 그라디언트 재사용 | **모서리 둥근 필(pill) 프레임** — 네임플레이트 배경이 완전 둥근 라운드(`border-radius: 999px`) | 아군을 시각적으로 "부드러운" 형태로 통일 |
| 적(enemy)/엘리트 | 웜톤 — 기존 `.gate-panel-bar-track.commander`의 `#e26b72→#e9c46a` 그라디언트 재사용(피해색과 공유해도 무방 — 적 대상 정보이므로 문맥상 모호성 없음) | **각진 브래킷 프레임** — 네임플레이트 배경 모서리 `border-radius: 2px`(거의 각짐) 또는 다이아몬드 클립(꼭짓점 4, 단 `.tier-icon[data-tier-vertices="4"]`와는 별개 클래스 — 등급 인코딩과 개체유형 인코딩이 같은 형태를 다른 의미로 쓰면 그레이스케일에서 오독 가능하므로, 적 네임플레이트는 클립-패스가 아닌 `border-radius` 축만 사용해 형태 축을 분리) | 적을 "날카로운" 형태로 통일, 등급 아이콘과 형태-어휘 겹치지 않게 분리 |

- **그레이스케일 검증 요구**: GDD §6.3 기존 검증 절차("그레이스케일 렌더 테스트")를 이 신규 채널에도 동일
  적용 — 회색조에서 둥근 필(동료) vs 각진 브래킷(적)이 형태만으로 구분되는지 디자이너가 확정 팔레트 시점에
  검증. **[TARGET]** 정확한 `border-radius` px값은 디자이너 소관.
- **구현 경로**: `ui/lane-hud-layout.md` §4가 이미 확정한 대로 신규 요소는 `battle-realtime-three.js`의
  `#world-hud-overlay` DOM 오버레이로 구현된다(Option B 패턴, 해당 문서 §4 정정 노트 근거) — 개체유형별로
  `.world-hud-nameplate--companion` / `.world-hud-nameplate--enemy` 두 클래스만 추가하면 되고, 신규 DOM 서브트리
  구조 변경은 없다(같은 컴포넌트에 modifier 클래스 부여).

**구현 중 정정 (Implementation phase, CameraRenderLane 발견)**: 위 표의 "적(enemy)/엘리트" 행이 가정한
"적 네임플레이트" DOM 요소는 실제로 존재한 적이 없다 — `app.js`의 `#world-hud-overlay` DOM 오버레이
시스템은 설계상 companion 전용이며(`renderWorldHud()` 독스트링, "companion nameplates/health bars,
elite capture prompt, floating damage numbers"), 적은 전량 WebGL 씬 내부 오브젝트로만 렌더링된다(별도
in-world 체력 표시 방식, DOM 텍스트 아님). `.world-hud-nameplate--enemy` CSS 클래스는 구현됐으나
(styles.css, 준비된 상태) 적용 지점이 코드베이스에 없다 — 이는 이번 사이클에서 신규 적 네임플레이트
UI를 구축할 스코프가 아니라(§D의 원 취지는 companion 판독성 개선이었고 적 비교 대상은 리서치 근거일
뿐), 표 자체의 가정 오류였다. 후속 사이클에서 적 전용 world-space HUD 요소가 실제로 필요해지면 이
CSS 클래스를 재사용할 수 있다.

---

### E. 영구(Track A/B) vs 런스코프 아이콘 형태 차별화 — **ACCEPT with MODIFY (형태 변경)**

**근거**: 8개 게임 중 6개(Kingshot/Whiteout 제외 전부)가 영구 vs 런스코프 진행에 형태 자체가 다른 아이콘을
쓴다[OBSERVED: `defense-offense-rpg-hybrid-deep-research-20260725.md:246`]. Archero가 가장 명확한 사례 —
영구 Talent는 "4열×3행 대형 육각형 아이콘 그리드", 런스코프 스킬은 "세로 테두리 정사각 아이콘
카드"[OBSERVED: `defense-offense-rpg-hybrid-deep-research-20260725.md:84`]. 종합 결론: "두 시스템은 아이콘
시각언어조차 공유하지 않음 — 이는 '이것들은 다른 종류의 힘'이라는 멘탈모델을 강화한다"
[OBSERVED: `defense-offense-rpg-hybrid-deep-research-20260725.md:89`]. 채택 근거 자체는 강하다 — 화면공간
비용 없이(기존 아이콘 컨테이너의 `clip-path`/`border-radius`만 교체) 모호성을 제거하는 순수 시각 재스킨.

**MODIFY 사유 — synthesis §3 원문의 "육각형" 제안은 기존 코드와 충돌**: 육각형(6-꼭짓점)은 이미
`EQUIPMENT_TIERS`의 **T5(최고 등급) 색-독립 인코딩 형태로 확정 배정**되어 있다[OBSERVED: `rpg-catalog.js:107-115`
`vertexCount: 6`, 구현 `styles.css:221` `.tier-icon[data-tier-vertices="6"]`]. Archero의 원 패턴을 문자 그대로
가져오면 "이 아이콘이 영구 성장 트랙을 뜻하는가, T5 최고 등급 장비를 뜻하는가"라는 신규 모호성을 만들어낸다 —
정확히 이 항목(D)이 해결하려는 "색-독립 인코딩 채널이 서로 충돌하지 않아야 한다"는 원칙에 위배된다. 따라서
형태를 바꿔 제안한다:

| 트랙 | 형태 | 근거 |
|---|---|---|
| 영구(Track A/B — Echo Core 스탯/스킬트리, 동료 장비) | **정사각형(모서리 소폭 라운드, `border-radius: 3px`)** — 축을 정렬한 사각형, `.tier-icon`의 어떤 `data-tier-vertices` 값과도 형태가 겹치지 않음(0=원, 3=삼각, 4=다이아몬드[45° 회전 사각], 5=오각, 6=육각 — 축정렬 사각형은 이 다섯과 시각적으로 구별됨) | 기존 등급 형태 어휘와 충돌 없는 신규 형태 |
| 런스코프(기존 XP임계값 스킬제안 카드, `#defense-edge-hud`의 `.edge-card` 선택지) | **원형** — `.tier-icon[data-tier-vertices="0"]`과 동일 형태이지만 별개 CSS 클래스(`.progression-icon[data-track="run-scoped"]`)로 구현해 등급 배지와 물리적으로 다른 컨테이너에 위치(스킬제안 카드는 편성/인벤토리 화면에 나타나지 않으므로 같은 화면에서 원형 등급 배지와 원형 런스코프 아이콘이 동시에 보일 일이 없음 — 형태 재사용이 안전) | 기존 `data-pick` 선택 버튼(`app.js:1497`)의 시각적 프레이밍을 유지하며 최소 변경 |

- 색상은 이 구분에 관여하지 않음 — 형태만으로 "영구 vs 런스코프"를 인코딩, 색상 채널은 기존 팔레트/등급
  의미를 그대로 유지(간섭 없음).
- **적용 범위**: 성장 탭의 `.growth-skill-node`(영구 Track A 스킬트리, `styles.css:203`) 아이콘 슬롯에
  `.progression-icon[data-track="permanent"]`(정사각) 부여; 전투 중 스킬제안 카드(`app.js:1497`
  `data-pick` 버튼) 아이콘 슬롯에 `.progression-icon[data-track="run-scoped"]`(원형) 부여. 동료 장비(Track
  B)도 동일 정사각 규약 적용(`growth-equip-slot`, `styles.css:210`).
- **디렉터 승인 필요 사항**: synthesis §3 원문이 명시한 "육각 vs 정사각"에서 형태 하나(육각→정사각-축정렬)를
  바꿨다 — GDD 병합 시 이 변경을 그대로 승인할지, 다른 형태(예: 별)를 원할지 디렉터 확인 필요.

---

## 2. 신규 커밋 기능 UI — 3-스탠스 선택 / 궤도카메라 발견성

### 2-a. 3-스탠스 포메이션 선택 UI

**CoreLoopRedesign 조율 메모(IRC 확인, `design/core-loop-redesign-20260725.md` 참조 예정)**: 트리거 모델은
코어루프 레인 소관으로 이미 확정 — **단일 edge-HUD 버튼 탭-사이클**(전열→포대→분산→전열 순환), 드래그나
메뉴 목록이 아님. 근거: Kingshot/Whiteout 둘 다 배치를 "명명된 슬롯 간 드래그앤드롭이 아니라 비율/탭-선택
기반"으로 처리[OBSERVED: `defense-offense-rpg-hybrid-deep-research-20260725.md:40,64`] — Arknights의 타입-지정
타일 드래그는 화면공간이 필요해 edge-only-HUD와 맞지 않는다는 점도 코어루프 레인이 근거로 확인. 4초 전환
쿨다운은 GDD §2.2 확정치[OBSERVED: `UNIFIED-GDD.md:85`]. 이 절은 **좌표/시각 스펙만** 제안한다 — 트리거
로직/전환 타이밍의 게임플레이 의미는 코어루프 문서 소관이며, 아래는 그 UX 흐름을 전제로 한 배치 제안이다.
**병합 시 코어루프 문서와 대조 확인 필요** — 이 문서는 그쪽 최종 산출물을 아직 읽지 못했다.

**배치**: `#battle-actions`(하단 우측, 기존 `.hud-actions` 클러스터) 내부, **클러스터 최선두**(pause 버튼
왼쪽) — 근거: 스탠스 전환은 런 내내 재선택 가능한 빈번 행동(코어루프 레인 확인, "mid-run reselectable")이므로
`#extract-elite`/랠리 버튼 같은 컨텍스트성 1회 행동보다 접근 안정성이 더 중요하다. `.hud-actions`는
`justify-content: flex-end`로 우측 정렬되므로[OBSERVED: `styles.css:43`] 클러스터 내 상대 순서(pause 대비
거리)는 안정적으로 유지되나, 화면 우측 끝으로부터의 절대 거리는 컨텍스트 버튼 유무에 따라 소폭 유동 —
`#movement-actions`(좌하단, 한손 조작)와 물리적으로 분리되어 다른 엄지 담당이라는 기존 "양손 엄지" 원칙과
정합[OBSERVED 패턴 근거: `defense-offense-rpg-hybrid-deep-research-20260725.md:192` "가상조이스틱 좌하단,
스킬클러스터 우하단"].

**시각 스펙**:

- 버튼 자체: 기존 `.hud-actions button`(44px 최소, `styles.css:44`) 크기 유지 — 이 화면은 접근성 레인의
  48dp 예외 3화면(인벤토리/스킬트리/포메이션-**셋업**)에 해당하지 않는 인-배틀 HUD이므로 44px 기준 그대로.
- 아이콘: 스탠스 3종 각각 고유 정적 글리프(예: 전열=화살촉, 포대=원, 분산=삼지창 — **정확한 글리프는
  디자이너 소관, TARGET**) — 현재 스탠스만 표시(탭하면 다음 스탠스로 순환, 목록 아님).
- **쿨다운 표시(4초)**: 기존 `--rc-glow-angle` conic-gradient 프리미티브[OBSERVED: `styles.css:370-377`]를
  재사용하되 무한 스핀이 아니라 **JS 구동 진행률**로 — 버튼 테두리에 `conic-gradient(from 0deg, var(--canon-cyan-rift) {progress}%, transparent {progress}%)` 형태로 매 틱 갱신, 쿨다운 종료 시 사라짐. 이 정확한 시각(radial-fill
  링)은 코어루프 레인 IRC 확인에서 "정확한 처리는 UI 레인 재량"으로 위임받음.
  - 쿨다운 중 탭 처리: 버튼은 계속 탭 가능하되(하드 잠금 아님) 쿨다운 중 탭은 무시 + 짧은 시각 피드백(예:
    버튼 미세 흔들림, `prefers-reduced-motion` 시 흔들림 생략하고 즉시 원상태) — 실력 표현 억제를 피하기
    위해 완전 비활성화(disabled + 회색처리)보다 소프트 블록 권장. **[INFERENCE, 디자이너 확인 필요]**
  - 감산-모션: 링 갱신은 애니메이션이 아니라 매 틱 진행률 스냅(연속 회전 없음)이므로 `prefers-reduced-motion`
    영향 없음 — 링 자체는 기능 정보(쿨다운 잔여시간)이지 장식이 아니므로 `lane-hud-layout.md` §3의 "월드
    앵커 위치추적은 장식이 아니라 유지" 원칙과 동형 논리로 유지.
- `aria-live="polite"` 텍스트: `"편성 스탠스: {현재 스탠스명} ({쿨다운 중이면 '전환까지 N초' 부기})"` — 기존
  `#battle-event-feedback` 패턴과 별개로 버튼 자체의 `aria-label`에 매 틱 갱신.

### 2-b. 궤도카메라 컨트롤 발견성 힌트

**제약**: 편집 가능한 상시 버튼/패널이 아니다 — 궤도카메라는 제스처 전용 입력(한손가락 드래그=궤도,
두손가락 핀치=줌)[OBSERVED: `presentation-spec.md:23`, 구현 확인 `app.js:924-941` `onPointerMove`
`renderer?.orbit?.()`/`renderer?.zoom?.()`]이라 "컨트롤"에 해당하는 상시 UI 요소 자체가 없다 — 문제는 순수
발견성(discoverability)이다: 플레이어가 이 제스처가 존재한다는 것을 어떻게 알게 하는가.

**기각한 대안들**:
- 풀스크린 튜토리얼 오버레이 — `docs/abyssal-command-defense-survivor-design.md:9`의 "위험 영역을 덮는 중앙
  패널 금지" 규칙에 문언·취지 둘 다 정면 위반, 이미 프로젝트가 명시 거부한 패턴(카테고리2 종합의 "배울 것은
  분리 원칙이지 모달 메커니즘이 아니다"[OBSERVED: `defense-offense-rpg-hybrid-deep-research-20260725.md:91,116`]와 동일 논리).
- 상시 코너 아이콘 배지 — 학습 후에도 화면공간을 영구 점유, 조사한 8개 게임 어디에도 상시 제스처-힌트
  아이콘 선례 없음(전부 카메라 고정이라 이 문제 자체가 없거나, 이 프로젝트처럼 자유 궤도인 사례가 리서치
  범위에 없었음 — 이 프로젝트의 자유 궤도 카메라는 조사 대상 8게임 중 어디에도 없는 신규 조합[OBSERVED:
  카테고리4 종합, `defense-offense-rpg-hybrid-deep-research-20260725.md:190,214` 양쪽 다 "고정/비회전"]).

**채택안 — 1회성 edge-anchored 토스트 힌트**:

- 컴포넌트: 기존 `.edge-card.defense-toast` 패턴 그대로 재사용[OBSERVED: `styles.css:274-278`, 인스턴스 예시
  `app.js:1504` `showToast()` 레벨업 토스트] — **신규 CSS 패턴 도입 없음**, 전투 첫 진입 1회만 트리거.
- 내용(이 프로젝트의 국영문 혼용 관례 준수): `"손가락 1개로 드래그해 시야를 돌리고(Orbit), 손가락 2개로
  꼬집어 확대/축소(Pinch Zoom)하세요"` — 텍스트 앞에 각 제스처를 나타내는 소형 인라인 픽토그램(드래그
  화살표 아이콘, 핀치 화살표쌍 아이콘, 16-20px, 기존 `.tier-icon` 스케일 참고) 배치해 텍스트만으로 부족한
  공간적 제스처 설명을 보완 — 순수 텍스트 힌트는 "드래그"라는 단어 자체가 이 사이클 전(Cycle 1/2)에는
  이동을 의미했다가 Cycle 3부터 궤도로 의미가 바뀐 용어라 텍스트 단독으로는 모호할 위험이 있음[OBSERVED
  코드 주석 근거: `app.js:899-902` "Canvas pointer input now drives the free camera... never movement"].
- 트리거: `RealtimeBattle`(또는 `App`) 세션 상태에 `hasSeenCameraHint` 플래그(캠페인 로컬 저장, 신규 필드) —
  전투 캔버스 최초 마운트 시 아직 `false`면 토스트 표시, `true`로 즉시 마킹(재접속 시 재노출 안 함).
- 위치: 기존 `.defense-toast` 앵커 규칙(`top: max(3.4rem, calc(var(--defense-safe-top) + 3rem))`, 미션 패널
  아래) 그대로 — 신규 앵커 좌표 불필요.
- 해제: 5초 경과 자동 페이드아웃 **또는** 플레이어의 첫 궤도/핀치 입력 발생 시 즉시 해제(둘 중 빠른 쪽) —
  기존 토스트의 탭-즉시-닫힘 관례와 정합, 성공적 제스처 자체가 최선의 확인 신호이므로 그 순간 힌트를 치움.
- **edge-only-HUD 위반 검증**: 이 토스트는 뷰포트 중앙이 아니라 상단 근처 edge-card 위치에 뜨고(기존
  레벨업/보상 토스트와 동일 좌표 규칙), 시뮬레이션을 멈추지 않으며(non-blocking, `pointer-events: auto`는
  토스트 자체 영역에만 적용 — 배틀필드는 그대로 노출), 1회성이라 상시 화면공간을 점유하지 않는다 — 규칙
  위반 없음.
- 감산-모션: 페이드 전환은 `prefers-reduced-motion` 시 즉시 표시/즉시 해제로 대체(기존 `.integrity-meter i`
  트랜지션 무력화 패턴과 동형, `styles.css:246`).

---

## 3. 밀도 벤치마크 대조 (교차-카테고리 종합 근거)

리서치의 "정보 밀도" 관찰치를 기존 8-화면/3-마이크로패널 인벤토리[OBSERVED: `ui/lane-info-architecture.md`
§6 YAML `screens_offbattle_total: 8`, `screens_inbattle_micropanel_new: 3`]와 대조한다.

### 오프배틀 풀스크린 화면

리서치가 관찰한 "밀집 허브" 화면들의 동시 요소 수: Whiteout 영웅그리드 최소 38타일(페이지네이션 없음)
[OBSERVED: `defense-offense-rpg-hybrid-deep-research-20260725.md:63`], KR Vengeance 업그레이드트리 "5개 분기에
걸쳐 약 24개 동시 해금가능 노드"[OBSERVED: `:135`], Archero 영구 Talent "4열×3행 = 12개 동시 옵션"
[OBSERVED: `:85`]. 이 프로젝트의 GDD 접근성 예산은 인벤토리 ≤450노드(가상스크롤 목표 **120**), 스킬트리
≤300노드[OBSERVED: `UNIFIED-GDD.md:261`] — 인벤토리 가상스크롤 목표(120)는 Whiteout의 38타일보다 여유 있고,
스킬트리 노드 상한(300)은 KR의 24개·Archero의 12개보다 훨씬 크지만 **실제 스킬트리 규모는 GDD §2.2 인접
확정치로 5노드**뿐이다[OBSERVED: synthesis 문서가 인용하는 GDD 원문 "Echo Core 스탯 6종 + 스킬트리 5노드"
— `defense-offense-rpg-hybrid-deep-research-20260725.md:246`] — 즉 **미달 위험 없음, 오히려 여유 상한**:
8-화면 인벤토리가 밀도 과소는 아니다. **판정: 오프배틀 밀도는 리서치 벤치마크 대비 과소·과밀 둘 다 아님 —
현재 상한 설계가 이미 여유 있게 잡혀 있다.**

### 인-배틀 edge-HUD

리서치의 스펙트럼: Archero 3개(일시정지/체력·레벨바/통화, "매우 낮은 고정-HUD 밀도")[OBSERVED: `:85`] ~
Brotato 코너당 소형 클러스터 1개(솔로 기준, "저밀도")[OBSERVED: `:108`] ~ Diablo Immortal 6-8개("중간-높음")
[OBSERVED: `:187`] ~ Torchlight Infinite 12개(**"지저분하고 혼란스럽다"는 리뷰 비판 직결**)[OBSERVED: `:211,216`].

현재 `ui/lane-hud-layout.md` §1 화면공간 표는 **행1-9,18 = 10개 항목**을 나열하지만, 이 중 스킬 액션바/이동
조작은 상시 동일 위치의 "컨트롤"이지 "정보"가 아니고(Diablo Immortal 계수 관행과 동일 — 조이스틱/스킬버튼은
정보밀도 카운트에서 컨트롤로 별도 취급됨, `:192` 참조), 순수 정보성 요소로 좁히면 커맨더 내구·게이트
내구·미션패널·[신규]동료로스터·[신규]버프트레이·추출카운트다운 = **6개**로, Diablo Immortal의 "6-8개,
중간-높음(수용 가능)" 밴드에 정확히 위치한다.

**밀도 상승 경고 [신규 관찰, 이 문서의 기여]**: 이번 사이클이 신규로 커밋하는 §2-a 스탠스-선택 버튼과 §2-b
카메라힌트(1회성이라 상시 카운트 제외)를 더하면, **상시 정보 요소가 6→7개(스탠스 상태 자체도 정보)**로
증가한다. 여기에 `ui/lane-hud-layout.md`가 이미 제안했으나 아직 미구현인 [신규]동료 로스터 트레이(행6)와
[신규]버프/디버프 트레이(행7)가 향후 사이클에 합류하면 **9개**로, Torchlight Infinite의 비판받은 12개에는
못 미치지만 Diablo Immortal의 "수용 가능" 상한(8)을 넘어선다. **판정: 현재 확정 상태(6-7개)는 과소하지
않으며 벤치마크 범위 내이지만, §1 표의 미구현 신규 항목(로스터 트레이+버프 트레이)이 향후 그대로 합류하면
Torchlight Infinite 방향으로 밀도가 이동한다 — 디렉터 핸드오프 노트 참조.**

월드공간 앵커(행10-17, 8개)는 Torchlight Infinite의 3유닛 네임플레이트+바 쌍(6개 텍스트/바 요소)과
Kingshot의 12개 이상 상시 건물 라벨[OBSERVED: `:33,35`]보다 적고, 카메라-추적 위치 확인이라는 기능적 필요와
직결되므로(§D의 형태 인코딩이 적용되면 오히려 판독성이 리서치의 두 부정 사례보다 개선됨) 과밀 판정 대상
아님.

---

## 디렉터 핸드오프 노트

가장 중요한 결정은 **§3의 밀도 상승 경고**다 — 이번 사이클이 신규로 커밋하는 스탠스-선택 버튼(§2-a)이
인-배틀 상시 정보 요소를 6→7개로 늘리는 것 자체는 Diablo Immortal 벤치마크 범위 내라 문제없지만,
`ui/lane-hud-layout.md`가 이미 설계는 해두고 아직 구현되지 않은 [신규]동료 로스터 트레이(행6)와 [신규]
버프/디버프 트레이(행7)가 다음 사이클에 그대로 합류하면 9개로 올라가 Torchlight Infinite가 리뷰어에게
"지저분하고 혼란스럽다"고 비판받은 12개 방향으로 이동한다 — 이 프로젝트의 리서치 전체가 바로 그 실패
패턴(카테고리4 종합)을 피하자는 목적이었으므로, 병합 시점에 로스터 트레이+버프 트레이를 **별개 2개 요소로
유지할지, 하나의 통합 "상태 트레이"로 합쳐 요소 수를 늘리지 않을지** 디렉터가 명시적으로 결정해야 한다 —
이 문서는 통합을 권고하지만 강제하지 않는다. 두 번째로 승인이 필요한 결정은 **항목 E의 형태 변경**이다 —
synthesis §3 원문이 제안한 "육각형"은 기존 `EQUIPMENT_TIERS` T5 색-독립 인코딩과 충돌해 이 문서가 "축정렬
정사각형"으로 바꿔 제안했는데, 이는 원 리서치 문서의 문자 그대로의 제안을 디자이너 확인 없이 변경한 것이므로
GDD 병합 시 명시 승인이 필요하다. 마지막으로, §2-a의 스탠스-선택 UI는 `CoreLoopRedesign` 레인의 최종
산출물(`design/core-loop-redesign-20260725.md`, 이 문서 작성 시점에 아직 미완료)과 좌표/트리거 세부사항을
대조 확인해야 한다 — IRC로 트리거 모델(탭-사이클, 단일버튼, 4초 쿨다운)은 조율했지만 문서 대 문서 최종
대조는 병합 단계에서 수행 필요.
