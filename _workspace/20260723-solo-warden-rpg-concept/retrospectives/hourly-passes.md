# Hourly Improvement Passes — 상임 지시 루프

run-id: `20260723-solo-warden-rpg-concept` · 이 파일은 매시간 단일-축 개선 패스의 누적 로그다.
각 패스 = 하나의 완결된 개선(설계 문서만이 아니라 실제로 작동+검증된 코드 변경).

---

## Pass #1 — 2026-07-25 22:24 KST · 축: 코어루프/조작감 (%5 = 1)

**HEAD at start**: `33b160a`

### 고른 초점
축 순환 기본값(패스 #1 → %5=1 → 조작감)을 그대로 채택. 더 시급한 다른 축 없음 —
Cycle 4가 자유궤도 카메라·3-스탠스를 명세·구현·검증까지 닫았고, 조작감 축에는 그
사이클이 남긴 **명세됐으나 미구현된 구체적 피드백 갭**이 하나 있었다(아래).

### 리서치 재사용 (재조사 안 함 — 규칙 준수)
조작감 축은 이미 딥리서치 완료 상태:
`design/trend-survey/defense-offense-rpg-hybrid-deep-research-20260725.md`(8게임) +
`design/control-feel-20260725.md`(Archero/Brotato 교차검증, §4). 규칙("이미 조사한 축은
재조사하지 마라")에 따라 새 survey를 돌리지 않고 기존 `control-feel-20260725.md` §3.3/§3.5를
직접 구현으로 번역했다. control-feel §4의 결론(모델 전환 불필요, Brotato형 이동-발사 분리가
이미 최적)은 재확인만 하고 건드리지 않음.

### 무엇을 바꿨는가 (측정값 포함)
**문제**: 자유궤도 카메라의 피치([30°,85°])·줌 클램프가 **완전 무음 하드 클램프**였다 —
플레이어가 경계까지 드래그하면 카메라가 그냥 멈추고 아무 피드백이 없다. "입력에 반응이
없다"는 것은 조작감의 근본 결함이고, `control-feel-20260725.md` §3.3 item 2가 정확히 이걸
플래그하며 저비용 해결책(경계 도달 시 짧은 저음량 오디오 tick 1회 + 리프랙토리)을 명세했으나
Cycle 4 구현에는 들어가지 않았다. [OBSERVED — `battle-realtime-three.js` orbit()/zoom()이
반환값 없이 조용히 clamp만 하던 것을 커밋 전 확인]

**구현** (5파일, 결정론/무과금/오프라인 계약 전부 준수):
1. `defense-catalog.js` — 전용 큐 `camera-clamp`(sawtooth 90→60Hz, 0.035s) 신설.
   `impact-hit` 재사용을 **의도적으로 거부**: 전투 중 상시 흐르는 impact-hit 스트림과
   refractory·lastCueAt 버킷을 공유하면 (a) 경계 tick이 전투음에 묻히고 (b) 0.025s refractory로
   연타 버즈가 생긴다. 전용 큐가 두 문제를 동시에 해결(control-feel §3.3의 "0.15s 신규 등록"과 일치).
2. `defense-audio.js` — `camera-clamp` 프로파일(gain 0.03, impact-hit 0.075보다 낮게) +
   refractory 0.15s.
3. `battle-realtime-three.js` — `orbit()`/`zoom()`이 "이번 입력이 포화된 클램프에 잘렸는가"를
   boolean 반환(`|desired - clamped| > 1e-9`). 렌더러 단방향 계약 무손상(순수 옵저버, 시뮬 미접촉).
   추가로 MIN/MAX_ORBIT_DISTANCE에 mount() 이전 안전 기본값 부여(`ORBIT_ZOOM_DEFAULT×[0.5,2]`) —
   mount()가 항상 덮어쓰므로 프로덕션 동작 무변화, pre-mount zoom()이 null 클램프로 zoomFactor를
   0으로 파괴하던 잠재 버그도 함께 제거.
4. `app.js` — onPointerMove가 orbit/zoom 반환값을 보고 `signalCameraClamp()` → `audio.play("camera-clamp")`.
   reduced-motion 분기 없음(오디오는 모션과 직교 — §3.3이 reduced-motion에서도 살아남는 유일한
   경계 신호로 오디오를 고른 이유).

**측정/검증** (자기보고 아님):
- 신규 자동 테스트 2건, 전부 통과:
  - `defense-renderer-contract.test.mjs`: orbit()/zoom()의 경계-반환 계약 — 범위 내 false,
    피치 상/하한·줌 근/원한 초과 시 true, yaw 전용은 항상 false, 클램프가 실제로 값을 범위 내
    유지함까지 검증.
  - `defense-observers-contract.test.mjs`: `camera-clamp`가 실제 카탈로그 큐로 resolve됨,
    0.15s refractory가 즉시 2연타를 억제함, `CAMERA_CLAMP` 형태 이벤트를 consume해도 어떤 큐에도
    매핑되지 않음(시뮬 이벤트 스트림 밖 = 결정론 무영향).
- 전체 스위트: **184 pass / 0 fail / 1 skip** (변경 전 182 → +2 신규 테스트). 3파일 syntax-check OK.
- 결정론 가드: 기존 "rendering, telemetry, and audio observation leave the simulation digest
  unchanged" 테스트 통과 유지 — 내 변경이 `getRunDigest`에 영향 없음을 실증.

### 무엇이 여전히 미해결인가 (은폐 없음)
1. **[이 패스가 발견] `tests/defense-survivor-browser.cjs`가 HEAD에서 이미 RED.**
   `verifyWorldHudOverlay`의 "Bug #1 guard" — 동료 world-nameplate transform이 라이브
   플레이스루에서 렌더되지 않음(world-unit heightOffset 회귀). **내 변경과 무관함을 실증**:
   내 diff를 stash한 clean `33b160a`에서 동일 실패 재현. 이건 축2(UI) 소관이라 이 조작감
   패스에서 고치지 않음(축 혼합 금지). **다음 UI 패스(#2, %5=2)의 최우선 입력으로 이월.**
2. **경계 tick의 실제 청감은 브라우저 오디오로만 확인 가능** — node 테스트는 큐 resolve·refractory·
   반환 계약까지만 실증한다. 실제 "경계에서 tick이 들린다"는 사람이 브라우저에서 드래그해봐야
   최종 확인되는 항목(자동화 불가, Cycle 1부터의 표준 결핍과 동종). 단, 로직 경로는 전부 테스트로 닫힘.
3. control-feel §3.4 오토팔로우 재개 정책(각도 유지 vs 리셋)은 D22 판정 5에서 "각도 유지"로 이미
   확정·구현됨(`updateCamera` Section 1 주석) — 이 패스 범위 아님, 재론 안 함.

### 다음 패스가 이 축(조작감)을 다시 잡을 때 알아야 할 것
- 경계 tick 인프라가 이제 존재한다. 유사한 "무음 하드 리밋" 지점이 또 있으면(예: 스탠스
  쿨다운 외 다른 게이팅) 같은 `camera-clamp`류 전용-큐 패턴을 재사용하라 — impact-hit 재사용은
  전투 스트림 오염 때문에 피할 것.
- orbit()/zoom()은 이제 클램프-히트 boolean을 반환한다. 향후 시각 경계 신호(§3.3은 오디오
  단독을 골랐지만)를 추가하고 싶으면 이 반환값이 이미 훅 포인트다.
- 4초 스탠스 쿨다운의 "체감 지루함" 여부는 여전히 열린 실증 질문(control-feel §4 말미) — 이건
  밸런스 축(%5=5)의 플레이테스트 소관이지 조작감 코드 문제가 아니다.

---

## Pass #5 — 2026-07-26 03:00 KST · 축: 밸런스/재미있는 코어타임 (%5 = 5)

**HEAD at start**: `41b12d5`

### 고른 초점
축 순환 기본값(%5=5 → 밸런스) 채택. 직전 패스들이 이월한 월드공간 HUD 회귀는 HEAD
`41b12d5`(D25/D26)가 이미 복원 완료 — 더 시급한 다른 축 없음. 밸런스 질문("수치가 밴드
안인가 / 반복 플레이가 지루해지는 지점은?")으로 난이도 곡선을 조사.

### 리서치 재사용 (재조사 안 함 — 규칙 준수)
기존 `design/trend-survey/defense-offense-rpg-hybrid-deep-research-20260725.md:79`(Archero
보상 케이던스: "레벨업마다, 런당 상한 없이 빈번")이 이 각도를 이미 커버. 신규 survey
미실시. 이 레퍼런스를 "우리 프로젝트에 무엇을 바꿀 것인가"로 번역 → 후반 스테이지 레벨업
케이던스 정체 수정.

### 무엇을 바꿨는가 (측정값 포함)
**발견 (산술적 사실)**: 적 HP는 `run.stage.scale`(100→240)로 스케일되지만
(`defense-run-simulation.js:283`) 적 XP는 평면 상수였다(`:298`). → gate-zenith rusher는
HP 7,200인데 XP 8, 같은 레벨업에 2.4배 노동. 인런 성장 아크가 후반으로 갈수록 늘어져
"난이도 정점 = 보상 정체"라는 반복플레이 권태 지점을 만든다.

**측정 (3-웨이브 스폰 예산, 순수 계산)**:
- 전(평면 XP): 웨이브 HP 28,400→219,840(7.7×), XP 예산 86→246(2.9×) — XP/HP가 스테이지1의
  37%로 붕괴. 웨이브XP 레벨업 2~3 정체.
- 후(스케일 XP): XP 예산 86→582(6.8×), HP 성장 근사 추종. 레벨업 2→5 상승.
- 영구 파워 상한 r5=1.6×(session15)는 적 HP 2.4×를 못 따라감 → 영구성장으로 상쇄 안 되는
  실제 결함임을 확인.

**구현**: 기존 HP 스케일 라인 미러링 — `const xpReward = scaled(data.xp, run.stage.scale)`,
`xp: elite ? xpReward*4 : xpReward`. 매직넘버 0(스테이지 `scale` 데이터 재사용). 보스 XP는
미변경(보스 HP는 authored 비스케일이므로 XP도 그대로).

**측정/검증 (자기보고 아님)**:
- 신규 테스트 1건 통과: cinder-span rusher xp==8(scale-100 항등 가드, digest 보존),
  gate-zenith rusher xp==scaled(8,240)==19, 19>8.
- 전체 스위트: **189 tests / 188 pass / 0 fail / 1 skip**(변경 전 188/187 → +1 신규).
- **g2-full-route-runner(10스테이지 전 구간 실시뮬) 포함 전원 통과** — 후반 스테이지 실행이
  스케일된 XP로도 결정론 유지됨을 실증. cinder-span은 정수 항등이라 digest 바이트 동일.

### 무엇이 여전히 미해결인가 (은폐 없음)
1. **디자이너/사람 재확인 대기 (규칙 #6)**: "평면 XP가 의도"였을 가능성(후반=영구빌드 의존)을
   완전히 배제 못 함. 확정 결정 번복은 아님(평면 XP 명시 결정 없음을 grep 실측)이나, 라이브
   보상 경제 변경이라 D27에 재확인 대상으로 명시. QA "꾸준 보상" 밴드 관점 교차검증 이월.
2. **브라우저 실행 검증 미실시 — 사유 명시**: 이 변경은 렌더링 코드 0줄 접촉(순수 시뮬 XP
   수치). 게다가 `defense-survivor-browser.cjs`는 현재 `verifyBossMeshRegression`에서
   **사전 존재하는 노후-테스트 실패**(구 렌더러 API 참조, D26 소관)를 가진다 — 실행해도 내
   변경과 무관한 RED가 나와 기록을 흐린다. 대신 g2-full-route(10스테이지 실시뮬)가 실행
   검증을 대체. sim-only 변경엔 이게 정당한 오라클.
3. **다른 밸런스 정체 지점 (이번 패스 범위 밖)**: 스테이지 2~10은 seeded wave variation이
   없다(cinder-span만 CINDER_SPAN_WAVE_PLAN 보유) — 스테이지5 재플레이는 항상 동일 구성.
   이것도 "반복 플레이 권태" 원천이나 wave 스케줄러를 건드리는 큰 변경이라 별도 패스로.
   또한 idle/방어형 플레이는 후반에 XP가 ranged(resource-denial) 적에게 전량 denied되어
   레벨업 0 — 플레이스타일 의존이라 이번 스케일 변경과 별개 축(웨이브 구성).

### 다음 패스가 이 축(밸런스)을 다시 잡을 때 알아야 할 것
- XP 스케일 인프라가 이제 존재(`xpReward = scaled(data.xp, scale)`). 다른 보상(드롭률 등)이
  스테이지 난이도와 어긋나면 같은 패턴 재사용.
- 위 미해결 #3(스테이지 2~10 wave variation 부재)이 다음 밸런스/반복성 후보 1순위.
- 이 변경의 디자이너 재확인 결과를 D27에 회신할 것 — 승인되면 label을 CONFIRMED로,
  기각되면 revert + 사유 기록.
