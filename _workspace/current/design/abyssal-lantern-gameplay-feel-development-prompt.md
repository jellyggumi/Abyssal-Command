# Abyssal Lantern — 전투 감각·모션·사운드·VFX·카메라 개발 프롬프트

## 역할

당신은 Three.js/WebGL 액션 게임의 Gameplay Engineer이자 Technical Animator, Game Audio/VFX Engineer다. 현재 저장소의 공개 시뮬레이션 계약을 보존하면서 플레이어 입력부터 화면·소리 피드백까지 한 프레임의 전투 감각으로 연결한다.

## 목표

현재 구현된 3개 정식 스테이지 `Cinder Span → Abyss Chancel → Echo Throne`를 유지하고, 다음을 실제 런타임 동작으로 개선한다.

1. 캐릭터·동료·적·보스가 현재 공급 GLB와 11개 의미 모션(`idle`, `move`, `run`, `hit`, `bighit`, `attack`, `critical`, `avoid`, `defence`, `die`, `show`)을 사용해 자연스럽게 이어진다.
2. 입력 → 모션 → 발사/타격 → 피격/VFX → 카메라 → 사운드가 하나의 의미 체인으로 관찰된다.
3. BGM/앰비언스/효과음이 시작·목표·위기·보스·승리/패배 상태를 반영하며, 음소거·볼륨·일시정지·백그라운드 복귀가 누수 없이 동작한다.
4. 각 스테이지의 이동 경로, 중간 목표, 적 웨이브, 아이템/스킬/추출 연출이 서로 다른 전투 리듬을 만든다.
5. 카메라는 authored phase(`DESCENT`, `ADVANCE`, `LOCK`, `FINAL`)와 플레이어 orbit/zoom 입력을 보존하면서 전투 의미를 강조한다.

## 저장소 사실과 절대 계약

- canonical title은 **Abyssal Lantern**이다. Stage 4를 만들지 않는다.
- `defense-run-simulation.js`가 결정론적 전투 상태의 유일한 소유자다. presentation 코드가 snapshot을 수정하거나 결과를 재계산하지 않는다.
- `battle-realtime-three.js`가 실제 WebGL 표현을 소유한다. `battle-visualizer.js`는 Canvas2D fallback이며 동등한 핵심 피드백 의미를 유지해야 한다.
- 모션 권위는 `assets/motion/ingame/characters/registry.json`, 각 `manifest.json`, `RUNTIME_ANIMATION_CONTRACT.md`다. 런타임은 legacy OBJ/FBX를 직접 읽지 않는다.
- 공급 메시를 procedural primitive로 교체하거나, 가짜 animation/no-op/mock runtime/T-pose fallback을 만들지 않는다.
- 시뮬레이션 이벤트는 public event policy를 거친다. 새 표현 상태가 필요하면 기존 public event 또는 snapshot 필드에서 파생한다.
- `prefers-reduced-motion`, mobile safe area, portrait/landscape, WebGL 실패 시 fallback을 유지한다.
- 메인 루프에서 per-frame geometry/material/array allocation을 추가하지 않는다. transient VFX/audio는 pool·cap·dedup·dispose를 갖춘다.

## 먼저 읽을 파일

- `CLAUDE.md`
- `RUNTIME_ANIMATION_CONTRACT.md`
- `README.md`
- `defense-catalog.js`
- `defense-run-simulation.js`
- `stage-world-catalog.js`
- `battle-realtime-three.js`
- `battle-visualizer.js`
- `defense-audio.js`
- `app.js`
- `styles.css`
- `assets/motion/ingame/characters/registry.json`
- `_workspace/current/design/abyssal-lantern-world-synopsis.md`
- `_workspace/current/design/camera-vfx-direction.md`
- `_workspace/current/production/task-manifest.md`

## 구현 요구사항

### A. 모션 연결과 전투 접촉

- 현재 semantic action router를 기준으로 locomotion과 one-shot action의 전환 규칙을 명시하고 구현한다.
- 이동 시작/정지, 방향 전환, 공격 준비, 공격 접촉, 피격, 강피격, 회피, 방어, 사망, 등장 사이에 hard cut 또는 rest-pose flash가 없어야 한다.
- 공격 delivery(`melee`/`ranged`)는 target 거리와 actor 역할에서 결정하고, dedicated `attack_melee`/`attack_ranged`가 없을 때만 검증된 semantic fallback을 쓴다.
- one-shot 종료 뒤 현재 snapshot 상태에 맞는 locomotion으로 복귀한다. 동일 event 재렌더는 클립을 재시작하지 않는다.
- 이동 중 발이 미끄러지는 느낌을 줄이되 시뮬레이션 위치·속도를 바꾸지 않는다. root motion은 시각 계층 안에서만 처리한다.
- 피격 flash·knockback·camera shake는 presentation-only로 유지하고, 반복 피격 뒤 material emissive와 actor root가 정확히 복구된다.

### B. 플레이·조작 반응

- 키보드, D-pad/touch, 수동 공격, 스킬, stance, 추출 입력이 동일한 public command로 귀결된다.
- 입력 승인/거절/쿨다운/방해 상태를 100ms 안에 버튼 상태, world feedback, audio 중 최소 두 채널로 확인할 수 있게 한다.
- 입력을 길게 누르거나 빠르게 반복해도 공격·이동·스킬 이벤트가 중복 재생되거나 queue가 무한 증가하지 않는다.
- pause 시 simulation, transient audio, camera choreography가 멈추고 resume 시 elapsed-time catch-up 없이 이어진다.
- `visibilitychange`/window blur에서 이동 입력을 `IDLE`로 정리하고 audio lifecycle을 일관되게 suspend/resume한다.

### C. BGM·앰비언스·효과음

- `DefenseAudio`의 node/voice cap, 우선순위 preemption, event dedup을 보존한다.
- AudioContext는 사용자 제스처 뒤 확실히 resume되고, 음소거 해제 또는 전투 시작 시 persistent layer가 들릴 수 있는 상태가 된다.
- 전투 오디오는 최소 다음 stem/state를 구분한다: lobby/descent, active wave, objective pressure, boss, terminal victory, terminal defeat. 매 전환은 gain ramp/crossfade이며 oscillator 재시작 폭주가 없어야 한다.
- 세 스테이지는 서로 다른 음색/기본음 조합을 사용하되 효과음 의미는 공통으로 유지한다: Cinder=낮은 화염/금속, Chancel=공명/성가, Throne=심연/왕좌 저역.
- 다음 의미를 서로 구별한다: input accepted/rejected, melee/ranged windup, weapon fire, hit, block, miss, critical, skill cast, pickup, objective waypoint/complete, extraction ready/complete, boss spawn/phase, ally down, retry, victory/defeat/final completion.
- pause/mute/background에서는 transient와 narration을 즉시 정리한다. resume은 idempotent해야 한다. stop/dispose 뒤 node=0, voice=0이다.
- 사용자 음소거와 master volume을 UI가 제어할 수 있도록 안정적인 public method/state를 제공한다. 저장이 필요하면 기존 campaign/storage 소유권을 재사용하며 별도 SSOT를 만들지 않는다.

### D. VFX·스킬·아이템 표현

- 모든 VFX는 `public event → semantic VFX id → pooled instance → lifetime/dispose` 흐름을 따른다.
- 스킬별 실루엣을 구분한다: `soul-lance` 직선 관통, `grave-pulse` 반경 파동, `shadow-step` 짧은 이동 잔상, `void-aegis` 방어막, `rift-bolt` 투사체 궤적.
- 아이템은 world pickup, 접근 가능 상태, 획득, 거절을 색·형태·사운드로 구분한다. HUD 아이콘만 바꾸고 world state가 보이지 않는 구현은 불가하다.
- 보스 telegraph는 타격 전에 바닥/방향/시간 창을 읽을 수 있어야 하며 실제 hit timing과 맞는다.
- critical, boss phase, objective complete만 강한 shake/flash를 허용한다. 일반 공격은 과한 카메라 흔들림으로 목표 읽기를 방해하지 않는다.
- reduced-motion에서는 shake/knockback/trail 양을 줄이거나 제거하되 색·outline·sound 등 동등 의미는 남긴다.

### E. 스테이지별 연출과 콘텐츠

- `stage-world-catalog.js`의 authored route/waypoint/objective/obstacle를 사용한다. 장식은 경로를 막지 않고 collision source와 표시 mesh가 일치해야 한다.
- **Cinder Span**: 화염 압박과 좁은 choke, 방어/점령/추출의 기본 문법을 명확히 가르친다.
- **Abyss Chancel**: vertical nave와 transept 이동, 합창/공명 분위기, flank pressure와 위치 선택을 강조한다.
- **Echo Throne**: throne/dais 방향성, 최종 보스 phase 전환, 이전 스테이지에서 배운 방어·스킬·추출을 결합한다.
- 각 스테이지에서 ingress → intermediate objective → arena/boss로 이동 경로가 world waypoint와 카메라 framing으로 읽힌다.
- 웨이브는 authored objective corridor를 따라 출현하고, 장식/벽 안 또는 도달 불가 영역에 spawn하지 않는다.
- Stage 3 `FINAL_COMPLETION`만 최종 서사·최종 terminal 연출을 사용한다.

### F. 카메라

- 기본 authored 값과 player orbit/zoom authority를 유지한다. updateCamera가 매 프레임 user yaw/pitch/manual zoom을 덮어쓰지 않는다.
- lobby face-off → stage descent → advance → boss lock → final reveal의 전환을 부드러운 easing으로 구성한다.
- boss/critical shake는 카메라 authoritative orbit state가 아니라 최종 렌더 위치에만 적용하고 만료 시 잔류 offset이 0이다.
- portrait/landscape/phone에서 actor, objective waypoint, telegraph, HUD가 동시에 읽히는 clamp/framing을 보장한다.
- reduced-motion은 snap 또는 짧은 transition으로 대체하되 카메라 phase 의미를 유지한다.

## 테스트와 증거

테스트를 약화하거나 구현 세부를 그대로 재진술하지 말고 public behavior를 검증한다.

- 기존 관련 Node 테스트를 실행한다: audio, camera, renderer, stage-world, encounter-routing, movement, cutscene/session.
- 새 분기에는 최소 다음 회귀 테스트를 추가한다: audio state transition/crossfade, pause/resume/background/mute/stop cleanup, semantic motion return, VFX dedup/lifetime, camera state preservation, stage route reachability.
- browser proof는 실제 WebGL renderer인지 `data-defense-renderer="webgl"`로 확인하고 Canvas fallback 통과를 성공으로 대체하지 않는다.
- 1440×900, 390×844, 844×390에서 lobby → 시작 → 이동 → 공격 → 스킬 → pause/resume → objective → boss/terminal 흐름을 수행한다.
- 콘솔 uncaught error 0, failed request 0, horizontal overflow 0, 일시정지 catch-up 0, dispose 후 leaked audio/VFX 0을 보고한다.
- 산출물은 정확한 변경 파일, 실행 명령, pass/fail 수, screenshot/video 경로, 남은 blocker만 보고한다.

## 금지

- simulation result를 renderer/app에서 재계산
- snapshot mutation
- 새 Stage 4, 임의 title/세계관 변경
- merged OBJ 또는 legacy OBJ/FBX runtime read
- procedural primitive/placeholder asset로 supplied mesh 대체
- event 없이 시간·DOM text만 보고 gameplay state 추정
- 무제한 particles/audio nodes/event-key set
- `git reset --hard`, `git clean`, force-push, 사용자 변경 삭제
- 테스트 skip/threshold 완화로 green 만들기
