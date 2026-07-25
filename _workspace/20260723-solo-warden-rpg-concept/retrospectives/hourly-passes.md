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
