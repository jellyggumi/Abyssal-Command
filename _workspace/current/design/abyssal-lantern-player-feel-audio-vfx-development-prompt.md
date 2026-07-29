# Abyssal Lantern — 플레이 감각·오디오·모션·VFX·카메라 개발 실행 프롬프트

## 프롬프트 분류

```yaml
prompt_need:
  category: coding
  use_case: workflow-pipeline
  domain: software/game-development
  current_pain: structure/consistency/verification
```

출처·적용 방식: [prompts.chat](https://github.com/f/prompts.chat)의 **Game Developer**, **Continue Coding Assistant**, **Code Reviewer** 패턴에서 `역할 → 작업 → 제약 → 측정 가능한 인수 조건 → 결과 보고` 구조만 채택했다. 이 저장소와 무관한 멀티플레이·서버·단일 파일 전제는 사용하지 않는다.

---

## 복사해서 사용할 프롬프트

```text
# 역할

당신은 Abyssal Lantern의 Three.js Game Feel Engineer이자 Technical Audio Designer, Combat Motion/VFX Director, Camera Engineer, 결정론 QA·Release Engineer다. 설계안만 남기지 말고 현재 소스와 테스트를 조사한 뒤, 플레이어 입력부터 시뮬레이션 이벤트, 오디오·모션·VFX·카메라 반응, 정리(dispose), 실제 브라우저 증거까지 한 흐름으로 구현·검증하라.

# 작업

Abyssal Lantern의 현재 Three.js/WebGL 런타임과 Canvas2D fallback을 보존하면서 플레이어 감각, 오프라인 절차적 BGM, 이벤트 권위형 게임 사운드, semantic motion, 전투 VFX, 카메라 연출을 완성한다.

정식 스테이지와 순서는 아래 세 개뿐이다.

1. Cinder Span (`cinder-span`)
2. Abyss Chancel (`abyss-chancel`)
3. Echo Throne (`echo-throne`)

네 번째 스테이지를 만들거나 이름·음악·후일담·잠금 슬롯·hook으로 암시하지 마라. Echo Throne의 `FINAL_COMPLETION` 뒤에는 presentation-only aftermath만 허용된다.

## 1. 작업 전 조사와 기준선

먼저 저장소 `CLAUDE.md`와 현재 작업 규칙을 읽고 따른다. `git status --short`, 현재 diff, 브랜치, remote, Pages workflow를 확인해 사용자와 동시 세션 변경을 식별한다. 아래 파일과 심볼을 실제로 읽고, 익숙하지 않은 Three.js/Web Audio API는 현재 vendor 소스·타입·공식 문서로 확인한다.

### 필수 소스

- `defense-audio.js`
  - `AUDIO_EVENT_POLICY`, `audioCueForEvent()`, `DefenseAudio`
  - `start()`, `consume()`, `play()`, `pause()`, `resume()`, `suspendForBackground()`, `resumeFromBackground()`, `stop()`
  - voice/node cap, refractory, ambience/music lifecycle
- `defense-catalog.js`
  - `AUDIO_CUES`, `ANIMATION_CLIPS`, `STAGES`, `STAGE_PRESENTATION_BY_ID`
- `defense-run-simulation.js`
  - `emit()`, `processInput()`, 공격/접촉/방어/실패/피해/치명타/objective/boss/extraction/reward 이벤트
  - `queueInput()`, `advanceDefenseRun()`, `getRunSnapshot()`, `getRunDigest()`
- `battle-realtime-three.js`
  - `RealtimeBattle`, semantic action routing, locomotion↔one-shot 전환, impact feedback
  - camera follow/orbit/zoom, event dedupe, transient VFX lifetime/cap/dispose, reduced-motion/quality 처리
- `battle-visualizer.js`
  - `visualFeedbackForEvent()`, `BattleVisualizer`, Canvas fallback의 event dedupe/effect cap/cleanup
- `app.js`
  - `BattleSession`의 입력 전달, 오디오 시작·소비·pause/background/stop, WebGL→Canvas fallback 경계
- `assets/audio/defense-audio-manifest.json`
- `scripts/generate-audio.mjs`

### 필수 focused tests

- `tests/audio-feedback-runtime.test.mjs`
- `tests/battle-session-cutscene-audio.test.mjs`
- `tests/realtime-motion-routing.test.mjs`
- `tests/defense-renderer-contract.test.mjs`
- `tests/camera-slice-contract.test.mjs`
- `tests/defense-run-simulation.test.mjs`
- `tests/defense-run-simulation-rpg.test.mjs`
- `tests/defense-phone-battle-hud-browser.test.cjs`
- `tests/stage-runtime-proof-browser.test.mjs`

편집 전 아래 기준선을 실행한다. 실패를 숨기지 말고 기존 실패와 새 회귀를 분리한다.

- `node --test tests/audio-feedback-runtime.test.mjs tests/battle-session-cutscene-audio.test.mjs`
- `node --test tests/realtime-motion-routing.test.mjs tests/defense-renderer-contract.test.mjs tests/camera-slice-contract.test.mjs`
- `node --test tests/defense-run-simulation.test.mjs tests/defense-run-simulation-rpg.test.mjs`
- `node --test tests/defense-phone-battle-hud-browser.test.cjs`
- `node --test tests/stage-runtime-proof-browser.test.mjs`

## 2. 관찰된 출발점과 목표를 구분하라

아래는 현재 소스에서 관찰된 출발점이지 이 작업의 PASS 선언이 아니다. working tree에서 다시 확인하고 달라졌으면 실제 값을 따른다.

- `defense-run-simulation.js`는 60 Hz 결정론 시뮬레이션이며 event마다 `eventSequence`와 `eventId`를 부여하고 frozen snapshot을 제공한다.
- `defense-audio.js#AUDIO_EVENT_POLICY`에는 audible policy와 `MOVE`, spawn, policy, cooldown 등에 대한 `intentionalSilence` policy가 함께 있다.
- `DefenseAudio`에는 master/SFX/ambience/music bus, mute/volume, pause/background, voice priority/preemption, event dedupe, `stop()` 정리가 있다.
- 현재 music은 하나의 지속 oscillator bed로 시작한다. 세 스테이지 × 세 음악 상태의 구별 및 전이 계약은 이 작업에서 새로 증명할 TARGET이다.
- `battle-realtime-three.js`에는 11-action semantic library, 선택적 `attack_melee`/`attack_ranged`, one-shot 우선순위와 locomotion 복귀, impact flash/knockback/shake, transient VFX cap과 dispose 경로가 있다.
- `battle-visualizer.js`는 같은 simulation snapshot을 소비하는 Canvas2D fallback이며 별도 게임 결과를 계산하지 않는다.
- 기존 focused tests가 일부 policy, voice cap, mute/pause, idempotent stop, semantic asset routing, snapshot 비변경, camera 30/60 fps 보간을 검사한다. 모바일 unlock, background lifecycle 전체, spatial audio, stage/state BGM, hit-stop, VFX pool/quality 전체가 이미 통과한다고 간주하지 마라.

## 3. 변경 불가 제약

1. 전투 결과·피해·치명타·방어·빗나감·objective·boss·extraction·reward·terminal은 `defense-run-simulation.js`의 public snapshot/event가 권위다. presentation은 이를 읽기만 하며 simulation 객체, tick, HP, cooldown, objective, RNG, terminal을 수정하지 않는다.
2. 렌더러·오디오가 event가 없다는 이유로 거리, HP 변화, 화면 위치, wall clock을 보고 새로운 hit/block/critical/boss phase를 추측하지 않는다. 필요한 의미가 public event에 없다면 simulation-owned event/field와 결정론 전이 테스트를 먼저 추가하고 모든 consumer를 한 번에 clean cutover한다. 전투 수치·밸런스는 바꾸지 않는다.
3. `defense-audio.js#AUDIO_EVENT_POLICY`가 유일한 event→audio cue authority다. `MOVE`, `ENEMY_SPAWNED`, `ENEMY_POLICY_SELECTED`, `SKILL_COOLDOWN_SET`, `SKILL_COOLDOWN_READY`, `ESCORT_LEADER_ACQUIRED`, `ENEMY_PRESSURE_DELAYED` 등 `intentionalSilence: true` 항목에 명시적 계약 변경 없이 소리를 붙이지 않는다. event의 `cue` fallback이나 renderer 직접 `play()`로 이 silence를 우회하지 않는다.
4. 오디오는 선택적 presentation이다. AudioContext 생성·decode·resume 실패나 오디오 비지원 환경에서도 게임 상태와 입력 결과가 동일해야 한다. 런타임은 네트워크, API key, 외부 SaaS에 의존하지 않는다.
5. 히트스톱은 표시 시계/animation/camera modifier에만 적용한다. `advanceDefenseRun()` 호출과 simulation tick은 계속 진행하며 `getRunDigest()`는 히트스톱 유무와 무관하게 바이트 동일해야 한다.
6. 카메라는 simulation phase를 추측하거나 두 번째 gameplay phase enum을 만들지 않는다. 현재 routed beat는 `snapshot.encounter.objectiveId`, recovery/completion은 `snapshot.encounter.status`, legacy objective chain은 `snapshot.objectives.phase`만 읽는다. `snapshot.objectives.phase`를 `DESCENT/SKIRMISH/SURGE/MIDBOSS/BIGWAVE/FINALE`와 직접 비교하지 않는다. 6-tier 연출이 필요하면 simulation-owned public field와 전이 테스트를 먼저 만든 뒤 consumer를 clean cutover한다.
7. Three.js/WebGL이 primary이며 Canvas2D는 실제 fallback이다. 두 renderer가 동일 그림을 그릴 필요는 없지만 input 결과, 위험/안전/objective/terminal 의미, event 중복 방지, reduced-motion, cleanup 계약은 같아야 한다.
8. 기존 11개 action 이름 `idle`, `move`, `run`, `hit`, `bighit`, `attack`, `critical`, `avoid`, `defence`, `die`, `show`와 registry/manifest/checksum/rights/provenance 계약을 임의 변경하지 않는다. `attack_melee`/`attack_ranged`는 현재의 선택적 delivery clip이며 없는 actor는 결정론 fallback을 사용한다.
9. remote 생성 오디오, TTS, 신규 UI 전면 개편, 전투 밸런스, enemy AI, stage/world geometry, 캠페인 진행, 저장 schema, 리깅/메시 재생성은 이 레인의 비목표다. `scripts/generate-audio.mjs`의 외부 서비스 경로는 선택적 authoring 도구로 남길 수 있지만 필수 offline runtime 경로가 되어서는 안 된다.
10. placeholder, no-op, mock-only runtime, 무제한 particle/source 생성, 테스트 skip/완화, assertion을 버그에 맞춰 좁히는 변경은 금지한다.
11. UI/UX 레인과 동시에 제출되는 작업이다. 기존 control의 DOM 구조·카피·레이아웃을 재설계하지 말고, audio unlock/volume/mute와 입력 피드백 연결에 꼭 필요한 최소 integration만 한다.

## 4. 구현 요구

### A. 오프라인 절차적 BGM과 세 스테이지 음악 상태

`defense-audio.js`와 `assets/audio/defense-audio-manifest.json`을 실제 runtime truth와 일치시킨다. 필요한 경우 `scripts/generate-audio.mjs`에 API key 없이 실행 가능한 deterministic offline/procedural 모드를 추가하되, remote ElevenLabs 경로와 명확히 분리한다.

세 스테이지 각각에 아래 3개의 presentation music state를 제공해 3 × 3 = 9개의 식별 가능한 program/profile을 만든다.

- `stage`: 진입·일반 hold/encounter. 장기 반복에서 피로도가 낮고 micro-cue를 가리지 않는 기본 bed.
- `pressure`: `OBJECTIVE_PRESSURE_PULSE`, `OBJECTIVE_PRESSURE_DEADLINE`, encounter recovery/failure처럼 simulation이 공개한 압력 신호를 소비하는 긴장층.
- `boss`: `BOSS_SPAWNED` 이후 boss가 살아 있는 구간 및 `BOSS_RALLY_WINDOW`의 강조층.

스테이지 음색은 `STAGE_PRESENTATION_BY_ID`의 palette/atmosphere를 소리로 번역하되 gameplay 의미를 추가하지 않는다.

- Cinder Span: ember/ash의 건조한 pulse와 금속성 리듬.
- Abyss Chancel: oath/choir의 얇은 공명과 절제된 저역.
- Echo Throne: echo/fracture의 비대칭 반복과 최종 긴장.

동일 state 재요청은 새 source/node를 만들지 않는다. state 전환은 이전/다음 program 사이 gain crossfade로 수행하며, 전환 중 music voice/program은 최대 2개, 이전 program은 전환 시작 후 1.5초 안에 gain 0·stop·disconnect되어야 한다. `TERMINAL`은 outcome별 terminal cue를 보존하고 지속 BGM을 멈추거나 resolution 상태로 정리하되, stage 4용 track/state를 만들지 않는다. `RETRY_STARTED`/`RUN_RETRIED`는 같은 stage의 `stage` 상태로 정확히 한 번 복귀한다.

offline 생성 결과가 파일 자산이면 동일 입력/seed/config에서 byte-stable 또는 manifest checksum-stable이어야 하고, loop seam은 시작·끝 50 ms window에서 click이 없어야 한다. runtime oscillator/program 방식이면 같은 profile ID의 oscillator/envelope 구성이 stable JSON으로 검증 가능해야 한다. 어느 방식을 택해도 네트워크 0, 필수 secret 0, missing optional asset 시 procedural fallback 유지가 인수 조건이다.

### B. 이벤트 권위형 SFX와 mix

`AUDIO_EVENT_POLICY`에 아래 의미군을 명시적으로 유지·완성한다. 한 simulation event는 한 번만 소비한다. 같은 event를 `app.js`, cutscene, WebGL renderer, Canvas renderer가 중복 재생하지 않는다.

- input: `INPUT_ACCEPTED`, `INPUT_REJECTED`, `STANCE_SWITCHED`, `STANCE_SWITCH_BLOCKED`, `EXTRACTION_REJECTED`
- windup: `BASIC_ATTACK`, `WEAPON_FIRED`, `MELEE_SWEEP`, `SKILL_CAST`, `BOSS_ATTACK_TELEGRAPHED`
- contact: `PROJECTILE_IMPACT`, `MELEE_IMPACT`, `ENEMY_ATTACK`
- block: `PROJECTILE_BLOCKED`, `PICKUP_DENIED`, `ECHO_DENIED`, guarded contact
- miss/cancel: `PROJECTILE_EXPIRED`, `BOSS_ATTACK_CANCELLED`
- damage/interrupt: `SKILL_RESOLVED_DAMAGE`, `COMMANDER_DAMAGED`, `COMPANION_DAMAGED`, `GATE_BREACHED`, `HAZARD_DAMAGE`, downed/interrupted/failed events
- critical: `CRITICAL_HIT`
- objective: phase change, progress, captured/completed/failed, wave clear, pressure pulse/deadline
- boss: `MIDBOSS_SPAWNED`, `BOSS_SPAWNED`, `BOSS_RALLY_WINDOW`, telegraph/cancel
- extraction: candidate→window→progress/interruption→completion→extracted의 각 public event
- reward/terminal: item, growth, skill selected, reward selected, retry, `TERMINAL`의 `DEFEAT`/`VICTORY`/`FINAL_COMPLETION`

windup/contact/block/miss/damage/critical은 onset, pitch contour, duration 또는 layer 구성 중 최소 2개가 달라 audio-only로도 의미가 구분되어야 한다. 다만 한 event의 causal chain에서 같은 의미를 중복 강조하지 않는다. 예: `CRITICAL_HIT`과 뒤따른 contact는 critical accent + bounded contact로 섞되 voice cap을 넘기거나 같은 critical cue를 두 번 내지 않는다.

priority/preemption은 terminal > boss/critical interrupt > objective/damage > ordinary contact/windup/input 순서를 보존한다. public active voice cap 12, transient node cap 48, total node cap 64를 넘지 않는다. cap에서 낮은 priority cue만 drop/preempt하고 terminal/objective 경고는 ordinary chatter에 밀리지 않는다. mute 상태에서는 transient node allocation 0이다.

공간 음향은 world-owned SFX에만 적용한다. entity/impact/objective 좌표는 snapshot event의 `entityId`, `sourceId`, `targetId`, `objectiveId`를 renderer의 현재 public projection/actor lookup으로 해석한다. BGM, terminal, UI input/rejection은 non-spatial center bus다. Web Audio Panner를 사용할 수 없거나 source가 화면 밖/미로딩이면 안전한 center fallback을 사용하며 simulation을 조회·변경하지 않는다. distance attenuation 뒤에도 boss telegraph/objective warning이 들리지 않게 사라져서는 안 된다.

### C. 모바일 unlock, volume/mute, pause/background/resume/stop

AudioContext 생성·resume은 실제 사용자 gesture에서만 시도한다. 첫 pointer/keyboard activation에서 한 번 unlock하고, 실패하면 다음 유효 gesture에서 재시도할 수 있어야 한다. page load, render loop, 매 tick마다 context를 만들거나 resume하지 않는다.

- volume은 `[0,1]`로 clamp하고 NaN/무한대는 기존 값을 유지한다.
- mute는 master gain 0 + transient/narration 정리이며, mute 중 새 node를 만들지 않는다. unmute는 BGM을 중복 시작하지 않는다.
- pause는 transient/narration과 hit-stop/camera transient를 즉시 정리하고 context를 한 번 suspend한다.
- background(`visibilitychange hidden`)는 transient/narration을 정리하고 suspend한다. foreground는 user pause가 아니고 mute가 아닐 때만 한 번 resume한다.
- background/paused 동안 지난 event를 foreground에서 몰아서 재생하지 않는다.
- `stop()`은 context, oscillator/source, gain/panner, listener, narration, music crossfade timer/state를 멱등 해제한다. 두 번 호출해도 예외·중복 close가 없다.

### D. semantic motion, crossfade, anticipation/contact/recovery

`battle-realtime-three.js`에서 actor kind/role과 simulation event에 따라 semantic action을 선택한다. renderer 자체의 hit 판정이나 독립 combat state machine은 만들지 않는다.

- 이동: 실제 snapshot 위치 변화로 `idle`/`move`/`run`을 선택하되 commander 위치는 입력 지연처럼 보이는 follow smoothing을 적용하지 않는다. companion trail/facing은 시간 기반 지수 보간으로 30/60 fps 결과가 같아야 한다.
- 공격: melee/ranged delivery는 현재 `attack_melee`/`attack_ranged`를 우선하고, clip이 없으면 `attack`/`critical`로 결정론 fallback한다.
- 결과: normal hit=`hit`, heavy/critical=`bighit`, guarded=`defence`, miss/cancel=`avoid` 또는 공격 recovery, downed/death=`die`, entrance=`show`의 우선순위를 event payload로 결정한다.
- locomotion loop↔one-shot은 `fadeIn`/`crossFadeFrom`/`fadeOut` 또는 동등한 mixer weight 전환을 사용한다. pose snap, frame-0 flash, double loop, stuck one-shot, 오래된 reaction queue가 없어야 한다.
- 공격 실루엣은 anticipation→contact→recovery가 읽혀야 한다. contact 시점은 simulation contact event에 맞추며 animation marker가 피해를 발생시키지 않는다. event가 제공하지 않는 startup/active/recovery를 wall clock으로 gameplay 판정하지 않는다.
- 같은 tick에 event가 겹치면 `die > bighit > defence/avoid > hit > critical/attack > show` 우선순위와 최신 동률 규칙을 결정론적으로 적용하고 stale reaction을 나중에 재생하지 않는다.

히트스톱은 contact event를 소비하는 presentation-only hold다. normal contact 2 tick, critical/heavy 5 tick, boss-heavy 6 tick을 기본값으로 하되 한 frame/event에서 중복 누적하지 않고 누적 상한 20 tick을 지킨다. simulation은 멈추지 않는다. hold 종료 후 현재 snapshot에 즉시 sync한다. pause, terminal, retry, remount, dispose에서 hold는 0이 된다. reduced-motion에서는 길이를 절반(올림)으로 줄이고 camera shake/knockback 이동은 제거하되 hit flash, outline, sound, 상태 의미는 유지한다.

### E. 조작 반응성과 플레이어 감각

키보드, pointer, touch가 같은 public input 경로를 사용하게 한다.

- ATTACK/MOVE/SKILL/EXTRACT 입력은 `queueInput()`으로만 simulation에 들어간다. local visual acknowledgement는 결과를 확정하지 않으며 다음 snapshot의 `INPUT_ACCEPTED`/`INPUT_REJECTED`가 성공/실패 의미를 확정한다.
- 한 tap/keydown은 한 input만 enqueue한다. pointerdown+click, key repeat, touch synthetic click으로 이중 공격하지 않는다.
- MOVE release, pointercancel, lostpointercapture, window blur, document hidden은 다음 simulation tick까지 `IDLE`을 enqueue해 stuck movement를 남기지 않는다.
- 공격 표면과 camera drag/pinch의 gesture ownership을 분리한다. drag/pinch가 ATTACK을 발생시키거나 attack tap이 camera orbit을 움직이면 실패다.
- commander visual root는 매 snapshot의 authoritative 위치에 즉시 붙는다. 카메라/동료의 미세 보간 때문에 직접 조작이 늦어 보이지 않게 한다.
- real browser에서 input gesture→첫 시각/음향 acknowledgement p95는 desktop과 mobile viewport 각각 100 ms 이하이고, simulation 결과 event는 enqueue 다음 tick에 나타나야 한다.

### F. 카메라 choreography

기본 follow/orbit/zoom 위에 일시적 modifier만 합성하고 종료 후 base camera로 복귀한다. modifier는 simulation event/snapshot을 소비하며 입력이나 simulation tick을 막지 않는다.

- stage intro: `STAGE_STARTED`, 최대 90 tick. critical route와 commander를 동시에 유지한다.
- objective: `OBJECTIVE_PHASE_CHANGED`, objective failure/recovery/completion, extraction window, 최대 60 tick. waypoint/telegraph를 화면 밖으로 밀지 않는다.
- boss: `BOSS_SPAWNED`, `BOSS_RALLY_WINDOW`, public boss telegraph, 최대 180 tick. 어떤 player input이든 장식성 orbit/push를 즉시 끝내고 base follow로 복귀한다.
- impact: critical/boss-heavy contact만 bounded shake를 사용한다. 한 impact shake는 220 ms 이하, 동시 흔들림 amplitude는 기존 cap을 넘지 않는다.
- terminal/reward: `TERMINAL`, `REWARD_SELECTED`, 최대 90 tick. `FINAL_COMPLETION`은 Echo Throne aftermath만 보여 주며 다음 stage 방향으로 pan하지 않는다.

transition은 급격한 cut 없이 authored tick에 끝나며, malformed/unknown field는 safe opening framing으로 fail closed한다. camera follow/look smoothing은 delta-time 지수식으로 30/60 fps 동일 시간 후 오차 허용범위 안에 있어야 한다. shake는 aim, enemy telegraph, objective marker, HUD를 읽지 못하게 만들지 않는다. portrait/landscape 전환에서 camera state와 simulation state를 잃지 않는다. reduced-motion은 shake 0, 자동 orbit 0, 즉시 안정 framing + outline/static emphasis로 같은 정보를 전달한다.

### G. VFX 계약, socket, cap, pooling, cleanup

각 VFX entry를 아래 필드를 가진 명시적 data contract로 관리한다. 흩어진 type switch를 늘리지 말고 기존 `VFX_MODELS`, `SKILL_VFX_MODELS`, lifetime/palette/event mapping 패턴을 확장한다.

- `id`
- `trigger`: public simulation event type과 필요한 payload 조건
- `owner`: source/target/objective/stage 중 수명 소유자
- `durationTicks`: 60 Hz 정수, 1 이상
- `meaning`: telegraph/windup/contact/block/miss/damage/critical/objective/extraction/reward 중 하나
- `palette`: stage accent와 gameplay hierarchy를 분리한 색/형태
- `socket`: `weapon`, right/left hand, muzzle, ground, target, impact, objective 중 하나와 deterministic fallback
- `capPriority`: cap에서 무엇을 먼저 버리는지
- `quality`: `full`, `low`, `reduced-motion` 동작
- `cleanup`: event expiry, owner retirement, stage remount, terminal, dispose 조건

weapon/muzzle/hand effect는 semantic bone/socket을 먼저 사용하고 없으면 actor root의 명시된 fallback offset을 사용한다. projectile trail은 source socket에서 시작해 simulation projectile 위치를 따라가며 contact/block/expire event에서 정확히 끝난다. target/impact effect는 event가 가리키는 실제 target/impact/objective 위치에 고정한다.

시각 의미는 색만으로 전달하지 않는다.

- 적 위험/telegraph: 지면 외곽선·방향/형태 + 위험 palette. additive 포화 금지.
- player/companion attack: source silhouette/trail + stage와 구분되는 accent.
- block/miss: 접촉 spark와 다른 shield plane/deflection arc/소멸 형태.
- critical/damage: normal contact보다 강한 silhouette·짧은 flash. 화면 전체 white flash 금지.
- objective/extraction/reward: 위험 decal과 다른 높이·형태·motion channel.

WebGL과 Canvas fallback 모두 transient effect 최대 24개를 넘지 않는다. cap에 도달하면 telegraph/objective/terminal을 보존하고 decorative dust/trail/ordinary contact를 먼저 drop 또는 재사용한다. 반복 생성되는 spark, decal, trail, ring은 pool/reuse하고, async GLB load가 expiry/dispose 뒤 완료되면 즉시 폐기한다. owner가 사라진 effect, expired projectile trail, stage 전환 전 effect가 다음 frame에 남으면 실패다.

quality `low`는 decorative particle·secondary light·trail subdivision부터 제거한다. telegraph, objective marker, block/miss, extraction, terminal 의미는 모든 품질에서 유지한다. reduced-motion은 camera shake·rapid rotation·large knockback을 제거하고 static outline, 짧은 opacity/scale 변화, progress fill로 대체한다. Canvas fallback은 같은 정보를 간단한 shape/label로 전달하고 WebGL asset을 필요로 하지 않는다.

## 5. 측정 가능한 인수 조건

아래 조건을 모두 증거로 통과해야 완료다. “더 좋음”, “더 역동적”, “몰입감 향상” 같은 주관 문구만으로 PASS하지 않는다.

### Simulation authority

- 같은 seed와 동일 input stream에서 presentation 전체 활성/비활성, WebGL/Canvas, normal/reduced-motion, hit-stop on/off의 `getRunDigest()`가 바이트 동일하다.
- renderer/audio가 frozen snapshot을 변경한 경우 0건.
- 새 event/field가 필요했다면 event version과 모든 consumer/test가 clean cutover되고 combat 수치·terminal 결과 변화 0건.
- stage ID는 `cinder-span`, `abyss-chancel`, `echo-throne` 정확히 3개이며 stage 4 참조 0건.

### Audio/BGM

- 3 stages × 3 music states = 9 profile ID가 manifest와 runtime에서 일치하며, stage/state 조합별 program signature가 서로 구별된다.
- 안정된 같은 music state를 100회 요청해 추가 music source/node 생성 0.
- 모든 crossfade에서 동시 program ≤2, 이전 program은 1.5초 이내 stop+disconnect.
- runtime network request 0, 필수 API key 0, optional generated asset 누락 시 procedural fallback으로 gameplay 지속.
- `AUDIO_EVENT_POLICY`의 모든 key가 audible 또는 `intentionalSilence`로 명시되고, intentional-silence event 재생 0.
- 같은 `eventId` 10회 소비 시 재생 1회, 서로 다른 `eventId`는 refractory/priority 계약 안에서 합쳐지지 않는다.
- active voices ≤12, transient nodes ≤48, total nodes ≤64. mute 중 allocation 0.
- input/windup/contact/block/miss/damage/critical/objective/boss/extraction/reward 각 의미군에 최소 1개 deterministic mapping test가 있다.
- spatial source 좌/우/거리 test, Panner 미지원 center fallback test, UI/BGM non-spatial test가 PASS한다.
- user gesture 이전 AudioContext allocation 0; 첫 gesture unlock 1회; 실패 후 다음 gesture 재시도 가능.
- pause/background/foreground/mute/unmute를 각 10회 반복해 중복 source 0, paused-time catch-up cue 0.
- `stop()` 2회 후 context/listener/node/voice/narration/music timer 0, close 1회, 예외 0.

### Motion/control feel

- 11 routed actor assets가 semantic base clips를 유지하고 missing dedicated attack clip은 정해진 fallback으로만 간다.
- locomotion→one-shot→locomotion 반복 100회에서 active locomotion loop 1개 이하, stuck one-shot 0, stale reaction 0.
- attack, skill, normal hit, critical/heavy hit, guard, miss/cancel, downed/death 각각 기대 semantic clip test PASS.
- 30 fps와 60 fps에서 같은 simulation tick 후 facing/follow/animation state가 허용오차 안에서 같다.
- normal/critical/boss-heavy hit-stop이 각각 2/5/6 tick이고 누적 ≤20 tick; reduced-motion은 각각 1/3/3 tick; pause/terminal/retry/dispose 후 0.
- hit-stop 활성/비활성 digest 동일.
- tap/keydown 1회당 input enqueue 1회. pointer+click 및 key repeat 이중 attack 0.
- MOVE release/cancel/blur/hidden 뒤 다음 tick에 IDLE. stuck movement 0.
- drag/pinch→attack 0, attack tap→camera orbit delta 0.
- desktop/mobile 실제 Chrome에서 input→acknowledgement p95 ≤100 ms.

### Camera/VFX

- stage/objective/boss/impact/terminal choreography가 위 최대 duration 안에 base camera로 복귀하고 stale modifier 0.
- camera position/look smoothing의 30/60 fps 동일 시간 결과가 focused test 허용오차 안에 있다.
- malformed phase는 opening framing, reduced-motion shake/orbit 0.
- 모든 VFX mapping이 trigger/owner/duration/meaning/palette/socket/capPriority/quality/cleanup 9개 필드를 가진다.
- transient effect ≤24. 1초 20 contact, boss telegraph+objective 동시 상황에서도 telegraph/objective 누락 0.
- stage remount 10회, terminal/retry, `dispose()` 2회 후 stale VFX/projectile trail/target ring 0; pending async load도 잔존 0.
- `full`/`low`/`reduced-motion` 모두 telegraph, objective, block/miss, extraction, terminal 의미를 보존한다.
- Canvas fallback에서 동일 event의 정보성 effect가 표시되고 WebGL asset request 0.
- real browser console의 신규 uncaught error, unhandled rejection, failed required asset request 0.

## 6. 테스트와 실제 브라우저 증거

테스트는 public behavior를 검증한다. production 구현을 그대로 복제하거나 private 상수 문자열만 검사하는 저가치 assertion을 만들지 않는다. 기존 테스트를 삭제·skip·완화하지 않는다.

최소한 다음 focused coverage를 추가 또는 갱신한다.

- `tests/audio-feedback-runtime.test.mjs`: policy/silence, 9 BGM profile, state transition/crossfade, priority/caps, mute/volume, spatial fallback, idempotent stop.
- `tests/battle-session-cutscene-audio.test.mjs`: user-gesture unlock, pause/background/resume, event exactly-once, paused-time catch-up 방지.
- `tests/realtime-motion-routing.test.mjs`: semantic selection, dedicated attack fallback, crossfade/recovery, hit-stop display clock.
- `tests/defense-renderer-contract.test.mjs`: snapshot immutability, WebGL/Canvas information parity, VFX cap/pool/cleanup, reduced-motion.
- `tests/camera-slice-contract.test.mjs`: event choreography duration, base-camera 복귀, 30/60 fps, malformed fail-closed, reduced-motion.
- simulation event를 확장한 경우 `tests/defense-run-simulation.test.mjs`와 해당 RPG test에 동일 seed/input/event ordering/digest coverage.

focused test 후 아래 회귀를 실행한다.

- `node --test tests/audio-feedback-runtime.test.mjs tests/battle-session-cutscene-audio.test.mjs`
- `node --test tests/realtime-motion-routing.test.mjs tests/defense-renderer-contract.test.mjs tests/camera-slice-contract.test.mjs`
- `node --test tests/defense-run-simulation.test.mjs tests/defense-run-simulation-rpg.test.mjs`
- `node --test tests/defense-phone-battle-hud-browser.test.cjs`
- `node --test tests/stage-runtime-proof-browser.test.mjs`
- `node --test 'tests/**/*.test.mjs'`

실제 Chrome/Chromium에서 각 스테이지를 독립 real-WebGL session으로 실행한다. 최소 viewport는 1440×900과 390×844이며, Canvas fallback도 강제로 한 번 검증한다. 각 스테이지에서 stage BGM→pressure→boss→terminal/reward, keyboard/touch attack, move release, skill, block/miss, critical, objective, extraction, pause/background/resume, reduced-motion을 확인한다.

증거는 `_workspace/current/qa/` 아래에 저장한다.

- 세 스테이지별 screenshot 또는 짧은 video: input/windup/contact, objective/extraction, boss/terminal
- browser trace 또는 timestamp JSON: input→acknowledgement latency p50/p95
- audio debug JSON: music state, active programs/voices/nodes, unlock/pause/background/stop lifecycle
- VFX debug JSON: active/pool/peak/drop-by-priority, remount/dispose 후 0
- console/network summary: 오류 수와 required asset 실패 수

증거 파일이 없으면 해당 acceptance는 PASS가 아니다.

## 7. Git·릴리스 안전

- 작업 시작 전에 변경 ownership allowlist를 만들고 그 파일만 명시적으로 stage한다.
- `git add -A`, `git reset --hard`, `git clean`, rebase, force-push를 사용하지 않는다.
- 무관한 사용자·동시 세션 변경을 수정·되돌림·흡수하지 않는다.
- `battle-realtime-three.js`, `defense-run-simulation.js`, `app.js`는 충돌 위험이 높으므로 각 파일 단일 소유자를 정하고 UI/UX 레인과 먼저 합의한다.
- focused/full gate와 browser evidence가 일치하는 exact commit만 push한다.
- Pages workflow와 배포 페이지가 같은 commit SHA인지 확인한다. 권한·인증이 없으면 나머지를 완료한 뒤 실패한 정확한 명령과 현재 remote 상태를 blocker로 보고하며 성공으로 쓰지 않는다.

# 결과 보고 형식

최종 답변은 아래 템플릿 순서로만 작성한다.

1. 결과
   - 플레이어 입력부터 audio/motion/VFX/camera까지 실제로 달라진 동작.
2. 변경 파일
   - `path#symbol`: 변경 내용과 권위 경계.
3. Simulation authority
   - seed/input fixture, digest 비교, snapshot mutation 0 증거, event version 변경 여부.
4. Audio/BGM
   - 9 profile 표, event→cue policy/silence, unlock/lifecycle, spatial/cap/cleanup 수치.
5. Motion/control feel
   - semantic routing, crossfade, hit-stop, 30/60 fps, input latency/중복/해제 결과.
6. Camera/VFX
   - choreography trigger/duration, cap/pool/quality/reduced-motion/cleanup 결과.
7. 브라우저 증거
   - stage, viewport, renderer, screenshot/video/trace/debug JSON 경로, console/network 결과.
8. 테스트
   - 실행한 정확한 명령, pass/fail/skip 수, 기존 실패와 새 회귀 구분.
9. Git·릴리스
   - commit SHA, push remote/branch, Pages workflow/run URL, 배포 URL과 SHA read-back.
10. 미해결
   - 남은 blocker만 기록. 없으면 `없음`.

“개선했다”, “대체로 완료”, “기반을 마련했다”, “추후 검증”으로 미완료를 완료처럼 포장하지 마라. 수치나 증거가 없는 항목은 PASS가 아니다.
```
