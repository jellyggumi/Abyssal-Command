# Abyssal Lantern — 최종 개발·개선 실행 프롬프트

## 프롬프트 분류

```yaml
prompt_need:
  category: coding
  use_case: workflow-pipeline
  domain: software/game-development
  current_pain: structure/consistency/verification
```

출처·적용 방식: [prompts.chat](https://github.com/f/prompts.chat)의 **Game Developer**, **Continue Coding Assistant**, **Code Reviewer** 패턴에서 `역할 → 작업 → 규칙 → 검증` 구조만 채택했다. 이 저장소의 실제 계약과 맞지 않는 멀티플레이·서버·단일 파일 제약은 사용하지 않았다.

---

## 복사해서 사용할 프롬프트

```text
당신은 이 저장소의 Principal Game Director이자 Three.js Gameplay Engineer, Blender Technical Animator, Game UI/UX Lead, QA·Release Lead다. 제안서만 쓰지 말고 현재 구현을 직접 조사하고, 필요한 코드를 수정하고, 실제 브라우저와 Blender/Node 검증을 통과시킨 뒤 커밋·푸시·GitHub Pages 배포 확인까지 완료하라.

# 0. 목표

Abyssal Lantern을 Cinder Span → Abyss Chancel → Echo Throne의 세 스테이지로 완결된 몰입형 브라우저 액션 핵앤슬래시 로그라이트 수직 슬라이스로 한 단계 더 개선한다. `defense-*` 명칭은 기존 런타임/카탈로그 계약명이며 제품 장르를 디펜스로 되돌리는 근거가 아니다.

정식 스테이지 순서와 이름은 아래 세 개뿐이다.
1. Cinder Span
2. Abyss Chancel
3. Echo Throne

네 번째 스테이지를 만들거나 암시하지 마라. 기존 구현을 다른 장르나 신규 프로젝트로 대체하지 말고, 현재 전투·동료·정예 추출·스킬·아이템·웨이포인트·웨이브 시스템을 더 자연스럽고 읽기 쉽고 깊게 연결하라.

# 1. 작업 전 필수 조사

1. 저장소의 CLAUDE.md와 현재 작업 규칙을 먼저 읽고 그대로 따른다.
2. 사용자 변경을 보존한다. `git status --short`, 현재 diff, 브랜치/remote/Pages workflow를 확인하되 무관한 변경을 흡수·삭제·되돌리지 않는다.
3. 아래 파일을 조사하되 권위는 영역별로 지킨다. `stage-world-catalog.js`는 월드 배치·경로, `defense-catalog.js`는 encounter/objective 콘텐츠, `defense-run-simulation.js`는 전투 결과·이벤트, `abyssal-lantern-world-synopsis.md`는 서사·대사, `camera-vfx-direction.md`는 연출 목표의 권위다. 테스트는 이 계약을 약화하지 않는 검증 계약이다. 렌더러·HUD·VFX·오디오는 시뮬레이션 이벤트를 소비할 뿐 결과를 만들지 않는다.
   - `README.md`
   - `RUNTIME_ANIMATION_CONTRACT.md`
   - `_workspace/current/design/abyssal-lantern-world-synopsis.md`
   - `_workspace/current/design/camera-vfx-direction.md`
   - `_workspace/current/production/task-manifest.md`
   - `assets/motion/ingame/characters/registry.json`
   - `battle-realtime-three.js`
   - `defense-catalog.js`
   - `defense-run-simulation.js`
   - `stage-world-catalog.js`
   - `app.js`, `styles.css`, `index.html`, `manifest.json`, `sw.js`, `defense-audio.js`, `battle-visualizer.js`
4. 편집 전 아래 기준선을 실행하고 실패를 숨기지 않는다. 기존 실패와 새 회귀를 구분해 기록한다.
   - `python3 _workspace/current/engineering/asset-pipeline/tools/build-character-motion-library-index.py --check`
   - `python3 scripts/gate-joint-weight-repair.py --check`
   - `node --test tests/realtime-motion-routing.test.mjs tests/ingame-motion-pack.test.mjs _workspace/current/engineering/asset-pipeline/tests/character-motion-library.test.mjs`
   - `node --test tests/camera-slice-contract.test.mjs tests/defense-renderer-contract.test.mjs tests/stage-world-encounter-routing-contract.test.mjs tests/defense-stage-world-movement.test.mjs tests/audio-feedback-runtime.test.mjs tests/battle-session-cutscene-audio.test.mjs tests/defense-phone-battle-hud-browser.test.cjs tests/lobby-guide-disclosure-browser.test.mjs`
   - `node --test tests/stage-runtime-proof-browser.test.mjs`
5. 서로 다른 파일군은 병렬화해도 되지만 `battle-realtime-three.js`, `defense-run-simulation.js`, `stage-world-catalog.js`, `app.js`, `styles.css`처럼 충돌 가능성이 큰 파일은 단일 소유자를 정한다. 겹치는 레인은 IRC/메시지로 계약을 먼저 합의한다.
6. 익숙하지 않은 Three.js/Blender API를 기억으로 호출하지 말고 현재 소스·타입·공식 문서로 확인한다.

# 2. 현재 확인된 출발 상태

다음은 새 기능 요구가 아니라 현재 저장소에서 다시 검증해야 할 기준선이다. 값이 달라졌으면 추측하지 말고 실제 파일과 명령 결과를 보고 수정한다.

- 정식 게임명은 `Abyssal Lantern`이다.
- 캐릭터 모션 registry는 11개 런타임 GLB와 총 121개 클립을 선언한다.
- 각 캐릭터는 `idle`, `move`, `run`, `hit`, `bighit`, `attack`, `critical`, `avoid`, `defence`, `die`, `show`의 11개 semantic action 계약을 가진다.
- 현행 리깅 기준은 24개 Rigify 호환 DEF bone, natural rest pose, 최대 influence 4, normalized weights다.
- Blender MCP에서 Lantern Reaver는 하나의 합쳐진 OBJ가 아니라 torso/head 결합부, 좌우 상·하완, 좌우 상·하퇴의 9개 semantic mesh part가 하나의 armature에 바인딩된 상태로 관찰됐다.
- Three.js 런타임은 semantic action 전환, one-shot 종료 후 locomotion 복귀, 프레임레이트 독립 회전, reduced-motion 즉시 전환, orbit/zoom 카메라를 가진다.
- 세 스테이지는 critical/optional route, 중간 objective, corridor→arena encounter, stage-specific wave pacing을 가진다.
- `_workspace/current/production/task-manifest.md` §8은 focused integration 78/78, character-motion 15/15, canonical real-WebGL 3/3을 carried evidence로 기록한다. 이것은 현재 PASS가 아니다. 아래 기준선을 새 working tree에서 다시 실행하고, 달라진 결과는 기존 실패와 새 회귀로 분리해 보고한다.

# 3. 변경 불가 계약

1. 신규·재생성 캐릭터 authoring source를 unrelated body/costume/accessory island가 융착된 단일 rigid OBJ/GLB로 공급하지 마라.
2. 기존 promoted GLB를 mesh/node 개수만 맞추기 위해 후처리 split/merge하지 마라. 융착 source 결함은 authoring source regeneration으로 해결하고 registry promotion pipeline을 다시 통과한다.
3. PASS는 고정 mesh-part 수가 아니라 asset별 semantic-region coverage, armature modifier, adjacent-chain weights, joint deformation samples, registry/manifest 증거로 판정한다. 무기·장비는 계약상 필요한 socket으로, 환경 prop은 개별 placement/collider로 유지한다.
4. placeholder primitive, fake animation, no-op, mock runtime, 정적 T-pose, 한 프레임 흔들기, 전체 모델 rigid translation을 완성품으로 제출하지 마라.
5. natural bind pose를 보존한다. 팔꿈치·무릎·어깨·골반·발목·손목 관절이 실제 bone rotation과 인접 weight blend로 움직여야 한다.
6. 기존 11-action 이름, registry/manifest/checksum/rights/provenance 계약을 임의로 바꾸지 마라. 변경이 필요하면 모든 consumer와 검증기를 한 번에 clean cutover한다.
7. `assets/images/battle/`의 레거시 비-UI GLB를 다시 런타임 source로 연결하지 마라.
8. 테스트를 삭제·skip·완화하거나 assertion을 현재 버그에 맞춰 좁혀 PASS를 만들지 마라.
9. 새 전역 시스템, 불필요한 추상화, 중복 카탈로그를 만들지 마라. 기존 SSOT와 패턴을 확장한다.
10. 사람 플레이 판정 없이 “재미”, “완벽한 몰입”, G4/G7/G8 PASS를 주장하지 마라.

# 4. 실행 작업

## A. Blender 리깅·키프레임 최종 개선

- Blender MCP로 현재 scene hierarchy, armature, mesh part, action, modifier를 먼저 관찰한다.
- 11개 캐릭터/적/보스 runtime GLB를 전수 검사한다.
- 각 semantic clip의 시작·중간·끝 key pose를 비교해 관절 회전, 무게중심 이동, 상·하체 counter-motion, 발 접지, 공격 anticipation/contact/recovery를 개선한다.
- walk/run은 발 미끄러짐, 무릎 역관절, 골반 튐, 팔꿈치 고정, 망토/무기 고무 늘어남이 없어야 한다.
- hit/bighit/critical/avoid/defence/attack/die/show는 동일한 전신 흔들기의 속도 변형이 아니라 의미가 구분되는 silhouette와 timing을 가져야 한다.
- 인접 관절 weight는 자연스럽게 분산하되 반대편 팔다리나 비인접 bone으로 누수하지 않게 한다.
- 수정 결과를 source `.blend`, runtime `model.glb`, manifest, rig report, registry generation/checksum까지 일관되게 승격한다.
- 원본 source mesh, authored animation, derived-retargeted 결과의 lineage와 rights receipt를 보존한다.

## B. Three.js 모션 런타임

- `battle-realtime-three.js`가 캐릭터 역할과 combat event에 맞는 semantic clip을 선택하는지 검증한다.
- locomotion loop↔one-shot crossfade가 pose snap, frame 0 flash, double loop, stuck action을 만들지 않게 한다.
- 공격 종료, 피격, 사망, 회피, 방어, 소환/등장 후의 우선순위와 복귀 상태를 결정론적으로 유지한다.
- heading/facing, companion trail, camera follow가 프레임레이트에 따라 달라지지 않게 한다.
- reduced-motion에서는 motion 정보가 사라지는 대신 즉시·안정적 상태 전환과 낮은 강도의 대체 피드백을 제공한다.
- render layer는 simulation state를 수정하지 않는다.

## C. 세 스테이지 맵·구조·목표·웨이브

각 스테이지를 “소품이 많은 방”이 아니라 이동 이유와 전투 리듬이 읽히는 던전으로 만든다.

### Cinder Span
- `cinder-span:critical-route`: ingress → relay-objective → blockade-gate → final-gate; `cinder-span:optional-detour`: detour-entry → ash-cache → detour-exit.
- encounter는 `cinder-relay-crossing`(slots 0–4) → `cinder-forge-stand`(5–9) 두 gate뿐이다. jagged parapet blockade, central ember relay, upper ash-service detour를 강화한다.

### Abyss Chancel
- `abyss-chancel:critical-route`: ingress → nave-objective → oath-gate → final-gate; `abyss-chancel:optional-detour`: detour-entry → vestry-cache → detour-exit.
- encounter는 `chancel-nave-advance`(0–3) → `chancel-transept-lock`(4–9) 두 gate뿐이다. S-bent nave, oath colonnades, sealed apse, lower vestry detour를 강화하며 카탈로그에 없는 침수 설정을 추가하지 않는다.

### Echo Throne
- `echo-throne:critical-route`: ingress → aisle-objective → dais-gate → final-gate; `echo-throne:optional-detour`: detour-entry → gallery-cache → detour-exit.
- encounter는 `throne-aisle-break`(0–5) → `throne-dais-stand`(6–10) 두 gate뿐이다. axial shattered court, crescent dais wings, upper whisper-gallery를 강화한다. `FINAL_COMPLETION` 뒤 hook만 허용하며 stage 4를 만들거나 암시하지 않는다.

공통 요구:
- critical/optional route waypoint와 intermediate objective를 실제 runtime event 및 HUD 안내와 연결한다.
- 적 wave는 objective corridor를 따라 진입하고, stage별 pattern/direction/pacing/cap/recovery/retry가 구분되어야 한다.
- committed attacker cap과 concurrent body cap을 항상 지킨다.
- objective fail→recovery→retry는 idempotent하고 같은 보상을 중복 지급하지 않는다.
- collider clearance는 commander뿐 아니라 companion/enemy radius까지 고려한다. 겹친 obstacle clearance circle 때문에 RETURN/FOLLOW가 영구 정지하면 실패다.
- 모든 prop/landmark/obstacle은 개별 node로 배치하고 authored route를 막지 않는다.

## D. 전투·스킬·아이템·정예 추출 연출

- basic/ranged/melee attack, skill cast, critical, damage, guard/avoid, objective, boss, extraction, reward event를 VFX·audio·camera에 한 번만 연결한다.
- 공격 VFX는 muzzle/hand/weapon/ground socket에서 시작하고 실제 target/impact 위치에서 끝난다.
- 광원, additive particle, decal, projectile trail, hit flash는 대상과 스테이지 palette를 구분하되 전장 판독을 가리지 않는다.
- stage transition 후 stale VFX, 중복 projectile, 남은 target ring, dispose 누락이 없어야 한다.
- 스킬과 아이템은 이름만 다른 동일 파티클이 아니라 범위·형태·위험·결과가 시각/음향으로 구분되어야 한다.
- `ELITE_CANDIDATE_AVAILABLE` → Bind 요청 → 지점 hold/`EXTRACTION_COMPLETED` → `ELITE_EXTRACTED`의 네 단계를 HUD/world marker/VFX/sound와 일치시킨다. 영구 companion collection 반영은 terminal의 기존 `applyEliteExtractionEvents` 경계 전에는 표시하거나 중복 적용하지 않는다.

## E. 게임 사운드

- `defense-audio.js#AUDIO_EVENT_POLICY`를 유일한 event→cue authority로 사용한다. `MOVE` 등 `intentionalSilence` 항목은 명시적 계약 변경 없이 소리를 추가하지 않는다.
- 동일 simulation event는 한 번만 재생하고 voice cap/priority/preemption을 지킨다.
- pause/mute/resume와 `visibilitychange` background suspend/resume는 allocation leak, 중복 source, paused-time catch-up 없이 동작하며 `stop()`은 context/node/listener를 멱등 해제한다.
- 세 스테이지 ambience와 boss cue는 gameplay 정보를 가리지 않는 범위에서만 구분한다.

## F. 카메라·VFX 연출

- 카메라가 simulation phase를 추측하거나 두 번째 phase enum을 만들지 않게 한다. 현재 routed beat는 `snapshot.encounter.objectiveId`, recovery/completion은 `snapshot.encounter.status`, legacy objective chain은 `snapshot.objectives.phase`만 읽는다.
- `snapshot.objectives.phase`를 uppercase `DESCENT/SKIRMISH/SURGE/MIDBOSS/BIGWAVE/FINALE` tier와 직접 비교하지 마라. 이 6-tier 연출이 필요하면 먼저 simulation-owned public snapshot field와 전이 테스트를 추가한 뒤 renderer/fog/camera consumer를 한 번에 clean cutover한다.
- phase 전환은 cut 없이 authored tick에 도달하고 unknown/malformed 값은 안전한 opening framing으로 fail closed한다.
- shake는 impact를 설명하되 aim/waypoint/HUD 가독성을 해치지 않는다.
- fog와 VFX는 critical route, 적 telegraph, objective marker를 가리지 않는다.
- portrait/landscape, 30/60fps, reduced-motion에서 동일한 gameplay 정보를 보존한다.

## G. UI/UX 전면 정리

- 로비, 3-stage 선택, guide, 편성/동료, 성장/스킬, HUD, pause, defeat/victory/final completion을 하나의 Abyssal Lantern 시각 체계로 정리한다.
- 프리런 로비와 전투 HUD를 동시에 노출하지 않는다.
- Cinder Span→Abyss Chancel→Echo Throne 진행 순서와 잠금 상태를 spoiler 없이 이해할 수 있게 한다.
- 조작 안내는 drag camera, WASD/화살표 이동, Space/J 공격, companion automation, Bind/정예 추출, skill cooldown을 정확히 설명한다.
- 버튼/탭/다이얼로그는 semantic role, accessible name, keyboard focus, Escape/Enter/Space 동작을 가진다.
- 1440×900, 390×844, 320×568에서 battlefield를 가리지 않고 모든 control이 최소 44px touch target과 가로 overflow 없음 조건을 만족해야 한다.
- reduced-motion과 색 대비를 보존한다. 장식보다 전투 판독성과 입력 피드백을 우선한다.

## H. 세계관·시놉시스 통합

- `abyssal-lantern-world-synopsis.md`의 mystery, dialogue, objective, boss turn, extraction, reward, final hook을 기존 stage/event/objective surface에 매핑한다. 새 서사 상태나 두 번째 게임플레이 시스템을 만들지 않는다.
- webtoon-harness는 긴장 상승·대사 중심·stage-end twist의 시나리오 규율에만 쓴다. 50장 패널·이미지 생성·webtoon viewer는 만들지 않는다.
- 대사는 lobby/archive, 접근성 텍스트 폴백, 안전한 전투 전·후 창에서만 전달한다. active combat에는 텍스트 대사 relay를 두지 않고 camera/VFX/audio/objective marker/telegraph로 비트를 전달한다.
- presentation-only aftermath와 dialogue는 시뮬레이션 상태를 만들지 않는다. 모든 전투 결과는 `defense-run-simulation.js` 이벤트가 권위이며 presentation은 읽기 전용이다.

## J. [TARGET] 로비 미니맵 & 스테이지 카드 진행형 공개

### 소스 참고

이 작업은 prompts.chat의 **Code Reviewer**, **Real-Time Multiplayer Defense Game**, **Continue Coding Assistant** 패턴을 구조 참고로만 사용했다. 이 세 소스의 멀티플레이·서버·단일 파일 제약은 Abyssal Lantern의 결정론적 시뮬레이션 + 자체 UI/카탈로그 계약과 맞지 않으므로 제외했다.

### 로비 카메라 (Commander 중심)

- 로비 scene의 카메라는 `focusRole=commander`로 고정되며, commander character rig의 위치를 중심으로 배치된다.
- 카메라는 bounded yaw, pitch, distanceScale 파라미터로 제어되고, world 좌표계에서 commander의 관절 움직임과 독립적으로 동작한다.
- 각 파라미터는 frame-rate independent interpolation을 따른다.
- reduced-motion이 활성화되면 카메라는 정적 shot (static head-on or side view)으로 고정된다.

### 로비 미니맵 & 진행형 공개 스테이지 카드

기존 right-side sortie stage cards를 accessible progressive-reveal minimap으로 대체한다.
minimap의 canonical node는 stage 내부 waypoint가 아니라 정확히 세 sortie stage
(Cinder Span → Abyss Chancel → Echo Throne)다.

**Canonical Stage/World 데이터 기반:**
- node 순서는 `stage-world-catalog.js#STAGE_SHOWCASE_IDS`를 그대로 사용한다.
- 선택한 revealed node는 기존 briefing과 공유 battle canvas를 갱신한다.
- minimap 자체는 두 번째 preview renderer를 만들거나 simulation을 advance하지 않는다.

**진행형 공개 (Progressive Reveal):**
- Cinder Span은 새 campaign에서 유일하게 revealed/unlocked 상태다.
- Cinder Span 완료 후 Abyss Chancel, Abyss Chancel 완료 후 Echo Throne을
  `campaign.unlockedStageIndex` 기준으로 순서대로 공개한다.
- locked stage는 disabled·spoiler-safe 상태를 유지한다.
- 모든 icon, label, touch target은 WCAG 2.1 AA 명도 대비와 최소 44px 기준을 만족해야 한다.

**Semantic Keyframe Action Routing (Character Rigs):**
- 모든 promoted runtime GLB character는 snapshot의 `presentationAction`과 기존 combat event로부터 semantic keyframe action을 수신한다.
- 가능한 action 값은 기존 `RIG_ACTION_KEYS` (`idle`, `move`, `run`, `attack`, `hit`, `bighit`, `critical`, `avoid`, `defence`, `die`, `show`)와 일치한다.
- renderer는 이 action을 animation mixer에 맞는 clip으로 라우팅하되, simulation state를 변경하지 않는다.
- 미승격 character rig이 snapshot에 나타나면 load 시점에 error logging하고 fallback 표시를 사용한다.

### 세 스테이지 구조 강화 (Runtime-Eligible Assets & Terrain Candidates)

세 stage의 terrain 후보는 모두 source provenance에 보존하되, runtime 게임플레이는 다음 규칙을 따른다.

**Cinder Span:**
- runtime에는 procedural-flat-support terrain mesh 하나만 load.
- eligible catalog prop은 현재 검증 범위인 8–14개를 sparse하게 유지한다.
- critical-route corridor와 optional-detour는 기존 catalog 구조를 따르며 수정하지 않음.

**Abyss Chancel, Echo Throne:**
- Chancel/Throne 소유 terrain candidate는 runtime에서 blocked.
- 오직 procedural-flat-support mesh + eligible catalog props만 load.
- 각 stage의 unique prop/landmark/obstacle은 8–14개 범위에서 sparse하게 유지한다.

### Collision Authority (defense-run-simulation Contract)

- gameplay actor의 terrain/obstacle placement는 `defense-run-simulation`의 `placeOnTerrain()`과
  `resolveTerrainPlacement()`가 권위이며 `supportMeshId`·`elevation` 검증을 따른다.
- presentation-only static prop은 `stage-world-catalog.js` placement를 사용하고 renderer의
  `inspectMeshIntegrity()`·`groundObjectOnPlane()`을 통과해야 한다.
- frame-rate independent movement와 deterministic resolver를 보존하며, 새로운 collision shape contract나 semantic prefix를 추가하지 않는다.

### Chancel/Throne Promotion Gate

- Abyss Chancel, Echo Throne의 terrain candidate는 runtime에서 blocked (procedural-flat-support mesh와 catalog props만 load).
- 기존 Chancel/Throne prop/character는 terrain override 없이 유지된다. promotion gate는 terrain 교체 정책에만 적용된다.
- Cinder Span 완료 후 (`FINAL_COMPLETION` event) Abyss Chancel unlock, Abyss Chancel 완료 후 Echo Throne unlock.

### 충돌·투과·무결성

- **No Terrain/Prop Penetration**: commander, companion, enemy 모두 terrain/obstacle collision을 `defense-run-simulation`의 resolver 계약 안에서 피해야 한다.
- **Collectible Prop Visuals Over Simulation Pickups**: 기존 simulation reward/item event는 그대로 두고, 각 event마다 visual representation (glowing orb, icon particle, floor marker)을 world space에 배치해 player가 획득 지점을 명시적으로 본다. `run.pickups`와 item→prop `.03` (blade) / echo→prop `.05` (relic) 매핑을 명시적으로 사용하며 더블-카운트는 안 된다.

### VFX·Audio Coverage

- attack 개시/hit/impact, skill cast/projectile/landing, critical trigger, pick-up/extraction, boss phase transition, objective complete/fail, stage transition 각각 sound cue + visual event가 paired.
- 단일 simulation event는 한 번만 trigger되며, old VFX/audio source는 phase transition 전 dispose된다.
- focused/full/browser/release 환경에서 동일 event sequence와 timing을 보장한다.

### Git·배포·증거

- **Selective Git Staging**: 본 section J 변경만 명시적 allowlist (`git add <path>`)로 stage하고, 무관 파일은 남겨둔다. `git add -A`는 사용하지 않는다.
- **Push**: staged commit 내용이 focused/full test 결과와 정확히 일치하는 경우에만 push.
- **Pages Deployment**: workflow trigger 후 실제 배포 페이지에서 production branch SHA를 read-back하여 동일성 확인.
- **Production Release Verification**: `.github/workflows/static.yml` workflow gates를 통해 build/test를 거친 후 배포하고, `results/release-receipt.json`에 배포 시점의 commit SHA와 page URL을 기록한다. deployed smoke test에서 실제 page URL을 read-back하여 프로덕션 배포 버전이 의도한 commit을 포함하는지 확인한다.

### 변경 불가 계약 (기존 보존)

- Stage 4는 만들거나 암시하지 않는다.
- Deterministic renderer contract (frame-rate independent, phase enum 중복 금지, simulation ownership 보존) 유지.
- 두 번째 SSOT (Source of Truth)를 만들지 않는다. stage-world-catalog, defense-catalog, defense-run-simulation이 유일한 권위다.

---

## I. README·이름·배포
# 5. 필수 수치·행동 게이트

아래를 모두 만족해야 완료다.

## Asset/Rig
- registry asset 11개, clip 121개, 캐릭터별 semantic action 11개가 일치한다.
- 모든 runtime GLB가 self-contained skinned mesh이며 필요한 animation을 포함한다.
- natural rest pose, orphan vertex 0, influence ≤ 4, normalized weight를 유지한다.
- joint-weight repair gate 11/11 PASS.
- Blender MCP 장면에서 armature, bone 수, 분리 mesh part, armature modifier, action 목록을 구조화해 증명한다.
- 최소 idle/move/run/attack/hit/die의 대표 프레임에서 관절 변위와 시각 proof를 남긴다.

## Runtime/World
- 세 스테이지 route clearance PASS.
- 세 스테이지가 서로 다른 objective/wave/pacing을 snapshot에 노출한다.
- attacker/body cap 위반 0.
- objective retry와 final reward 중복 0.
- companion RETURN/FOLLOW, enemy route, commander collision이 지형 경계나 obstacle에서 deadlock/tunneling하지 않는다.
- VFX/audio event duplicate 0, dispose 후 stale object/source 0.
- camera phase transition, 30/60fps smoothing, reduced-motion 계약 PASS.

## UI/Browser
- lobby→stage select→launch→combat HUD→objective→boss→completion 흐름을 실제 브라우저에서 검증한다.
- 세 스테이지 모두 isolated real-WebGL session에서 authored world를 로드한다.
- 1440×900, 390×844, 320×568에서 조작·HUD·guide·dialog 접근성 검증 PASS.
- 콘솔의 신규 uncaught error, failed runtime asset request, 무한 로딩 0.
- 각 스테이지 screenshot과 핵심 motion/VFX proof를 `_workspace/current/qa/` 아래에 저장하고 경로를 보고한다.

# 6. 최종 검증 명령

변경 범위의 focused test를 먼저 실행하고, 마지막에 저장소 규칙의 quoted glob 전체 Node 회귀를 실행한다.

- `python3 _workspace/current/engineering/asset-pipeline/tools/build-character-motion-library-index.py --check`
- `python3 scripts/gate-joint-weight-repair.py --check`
- `node --test tests/realtime-motion-routing.test.mjs tests/ingame-motion-pack.test.mjs _workspace/current/engineering/asset-pipeline/tests/character-motion-library.test.mjs`
- `node --test tests/camera-slice-contract.test.mjs tests/defense-renderer-contract.test.mjs tests/stage-world-encounter-routing-contract.test.mjs tests/defense-stage-world-movement.test.mjs tests/audio-feedback-runtime.test.mjs tests/battle-session-cutscene-audio.test.mjs tests/defense-phone-battle-hud-browser.test.cjs tests/lobby-guide-disclosure-browser.test.mjs`
- `node --test tests/stage-runtime-proof-browser.test.mjs`
- `node --test 'tests/**/*.test.mjs'`

Blender 검증은 repository의 현재 Blender binary와 authoring scripts를 사용하되, 실행한 정확한 명령과 report JSON 경로를 남긴다. 테스트가 실패하면 원인을 고친 후 동일 명령을 다시 실행한다. 테스트를 줄이거나 건너뛰지 않는다.

# 7. 완료 보고 형식

최종 답변은 아래 순서로만 보고한다.

1. 결과: 실제 플레이어 관점에서 무엇이 달라졌는지.
2. 변경 파일: 파일/심볼별 핵심 변경.
3. 자산 증거: registry generation, asset/clip 수, Blender rig/mesh/action 확인값, report 경로.
4. 런타임 증거: stage route/objective/wave/VFX/audio/camera 검증 결과.
5. 브라우저 증거: 세 스테이지, viewport, screenshot/video 경로, 콘솔 상태.
6. 테스트: 실행한 정확한 명령과 pass/fail 수.
7. 릴리스: commit SHA, push remote/branch, Pages workflow와 실제 URL.
8. 미해결: 남은 blocker만 명시. 없으면 `없음`.

“구현 예정”, “기반 마련”, “대체로 완료” 같은 표현으로 미완료를 완료처럼 포장하지 마라. 하나라도 검증되지 않았으면 해당 항목은 완료가 아니다. 현재 저장소의 기존 기능을 보존하면서 위 계약을 끝까지 구현·검증하라.
```
