# Task Manifest — Solo Warden RPG Concept Cycle

run-id: `20260723-solo-warden-rpg-concept` · scope: Stage 1 implementation (code, not concept-only)

| task | owner | stage.phase | artifact | gate | status | beat |
|---|---|---|---|---|---|---|
| rpg-catalog.js 신규 작성 | director (impl) | Stage1.data | `rpg-catalog.js` | G7 draft input | done | 데이터 층 |
| campaign-state.js RPG 확장 | director (impl) | Stage1.data | `campaign-state.js` | G7 draft input | done | 데이터 층 (migrateCampaign 데이터손실 버그 자체 발견/수정) |
| defense-run-simulation.js 포메이션/랠리/DOWNED | director (impl) | Stage1.sim | `defense-run-simulation.js` | G1/G7 draft | done | 시뮬레이션 층 — `resolveFormation`/`livingFrontCompanions`/BOSS_RALLY_WINDOW/COMPANION_DOWNED 전량 구현 확인(`defense-run-simulation.js:174-350,1160-1600`) |
| SNAPSHOT_VERSION 6 | director (impl) | Stage1.sim | `defense-run-simulation.js` | G7 draft | done | 결정론 계약 — `SNAPSHOT_VERSION = 6`(line 39), 레거시 파라미터 생략 시 byte-identical 재현 테스트 통과 |
| 최소 UI 패널 | director (impl) | Stage1.ui | `app.js`/`index.html`/`styles.css` | G6-ops draft | done | 스탯/장비/저지선 조작 가능 — `allocateWardenStatPoint`/`purchaseEquipmentTier`/`setCompanionFormationSlot` 전량 UI 핸들러 결선 확인(`app.js` growth-panel) |
| 신규 로직 테스트 | Tester 위임 | Stage1.ui | `tests/*.test.mjs` | G1/G7 | done | 회귀 안전망 — `rpg-catalog.test.mjs`/`campaign-state-rpg.test.mjs`/`defense-run-simulation-rpg.test.mjs` 57/57, 전체 스위트 164/165(유일 실패는 20260722 워크스페이스의 미커밋 fixture ENOENT, 이번 사이클 범위 밖) |
| 기존 스위트 회귀 | director (impl) | Stage1.ui | `node --test` 출력 | 전체 | done | 회귀 없음 확인 — `node --test 'tests/**/*.test.mjs'` 164 pass / 1 pre-existing fail(무관 fixture) |
| Stage1 gate review | director | Stage1.ui | `production/gate-reviews/stage1-review.md` | G7/G1/G6-ops | done | Stage1 종료 |
| QA 아키타입 실측 | director (impl as QA) | Stage2 | `qa/gate-measurements.md` | G2/G3/G5 | done | 밸런스 검증 — 7 archetype × 3 seed × 10 stage 실측 시뮬레이션 완료 |
| R1/R3/R5 거버넌스 실측 | director (impl) | Stage2 | `qa/gate-measurements.md` | G2/G3/G5 | done | 지배빌드 방지 검증 |
| Stage2 gate review | director | Stage2 | `production/gate-reviews/stage2-review.md` | G2/G3/G5/G7final/G8 | done | Stage2 종료 |
| 성능/접근성 회귀 | director (impl) | Stage3 | soak/perf 로그 | G4/G6 | done-with-note | 배포 준비 — G4(터치타깃/그레이스케일/reduced-motion) MET, 몰입감·레이턴시 인간 플레이테스트 항목만 FIX(자동화 불가, 다음 사이클); G6(perf/텔레메트리) MET, ops-runbook 문서 부재만 FIX(스코프 결정 필요) — `production/gate-reviews/stage3-review.md` |
| 커밋+푸시+Pages 확인 | director (impl) | Stage3 | git log, Pages 응답 | — | done | 배포 — `e7d5e8d`(stale-base allowlist 회귀 정정+world-art 기능 병합)+`b1be9d5`(정리) 푸시 완료, CI 전체 그린(`engine_contract`/`browser_contract`/`release_closure`/`package_pages`/`artifact_smoke`/`deploy_pages`/`deployed_smoke`/`release_receipt`), 라이브 사이트 200 확인(https://jellyggumi.github.io/Abyssal-Command/) |
| Stage3 gate review + retrospective | director | Stage3 | `retrospectives/cycle-1-retrospective.md` | G4/G6/G1 final | done | 사이클 종료 — G1 final PASS, G4/G6 done-with-note(위 참조) |

## Note on scope reconciliation vs original Stage1 GDD document-only intent

`intake/production-brief.md` originally scoped this run as **"document-only, no shipped code"** (Stage 1 Concept). The user's most recent live-session instruction explicitly requested continuing into implementation ("다음 단계 진행" — 3-stage implementation-to-deployment plan). This manifest supersedes the document-only constraint for code stages; the GDD documents remain the frozen source of truth for numbers (all still labeled [TARGET], unvalidated until Stage 2 QA simulation per the documents' own gate self-audit in UNIFIED-GDD.md §13).

## Deferred out of this cycle (explicit, not silently dropped)

- 5-tab UI shell (§6.1) — minimal single-panel UI only this cycle, tab shell is a follow-up
- Blender cel-shade bake pipeline (§5.1) — existing realistic atlas stays in place, kill-switch preserved
- World-space camera window + deadzone follow (§5.2) — visual-only, no simulation dependency, independent follow-up
- Formation stance system (Vanguard/Turret/Split positioning, §2.2) — FRONT/BACK slot mechanics (targeting/DOWNED/synergy/rally) ARE implemented this cycle; the 3-stance *positioning offset* layer is deferred (pure visual/positioning, no mechanic dependency)
- Loadout size 3→N expansion (§2.4) — explicitly out of scope per director decision in the source doc itself
- Track A respec (§12 item 5) — undecided in source doc, not implemented

## External motion-previs workstream — D8 remediation + resource generation (this session)

별도 codex-cli 워크스트림(`conflicts.md` C1, `decision-log.md` D8)이 남긴 캐논 위반 소지 자산에 대한 커밋 전 필수 조치를 이번 세션에서 완료:

| task | artifact | status | note |
|---|---|---|---|
| bossId 레벨 개명 (D8 원 지시 범위) | `assets/images/battle/pilot/concept-{sung-hum,broken-court-monarch}-boss.*`, `production/{sung-hum,broken-court-monarch}.previs.json` | done | `concept-sungjinwoo-boss.*`→`concept-sung-hum-boss.*`, `concept-monarch-boss.*`→`concept-broken-court-monarch-boss.*`; previs sidecar 파일명·내부 참조 일괄 갱신 |
| provenance sidecar 정정 | `assets/images/battle/pilot/concept-*-boss.provenance.json` (4종) | done | `asset` 필드가 구 파일명을 가리키던 문제 수정, `prompt` 필드의 "Solo Leveling boss concept" IP 직접 언급 4건 전량 originalized 문구로 교체 |
| **archetype 레벨 개명 (D8 미포함 범위, 이번에 발견)** | `design/boss-concept-prompt-pack.json`, `production/{boss-motion-previs-timing,boss_previs_timings,storyboard-motion-sound-matrix,elevenlabs_sound_plan}.json`, `design/defense-rpg-cinematic-arc.md` | done | `monarch` archetype id가 bossId 개명과 별개 네임스페이스로 남아있던 것 발견 — `concept-monarch-v0N.png` 배리언트 파일명, `boss:monarch:*` previsTag, `sfx_boss_monarch_*` 큐 ID, promptSchema enum 전량 `broken-court-monarch`로 통일 |
| "Shadow Monarch" 직접 인용 제거 | `design/boss-concept-prompt-pack.json` (aw-mo-v01 promptEnglish) | done | Sung Jin-Woo의 정본 칭호("Shadow Monarch")가 생성 프롬프트에 그대로 남아있던 것을 "broken-court ruler"로 재작성 |
| Blender previs 재베이크 | `production/boss_previs_workfile.blend`, `boss_previs_timings.json`, 4종 sidecar | done | 개명 후 실제 헤드리스 Blender(5.1.2) 재실행으로 산출물 일관성 확보(dry-run 아님, 실제 bake) |
| 콘셉트 배리언트 16종 생성 (god-tibo-imagen) | `assets/images/battle/pilot/concept-{sung-hum,shadow-soldier,player-core,broken-court-monarch}-v0{1-4}.png` | done | `--provider codex-cli` 폴백 사용(private-codex는 HTTP 429). 16/16 생성 완료 |
| 산출물 전수 육안 QA | 16종 이미지 | done | 15건 정상, 1건(`concept-broken-court-monarch-v02.png`) 타이틀/캡션 텍스트 번인 발견 → D14 참조, 재생성으로 해소 확인 |
| provenance sidecar 16종 작성 | `assets/images/battle/pilot/concept-{sung-hum,shadow-soldier,player-core,broken-court-monarch}-v0{1-4}.provenance.json` | done | sha256/치수/promptId/archetype/motionAffinity 포함; 실제 발신 프롬프트와 사후 수정된 pack 텍스트가 다른 2건(`sung-hum-v01`, `broken-court-monarch-v02`)은 `note` 필드로 그 괴리를 명시 |
| pack 내 잔존 캐릭터명 발견·제거 | `design/boss-concept-prompt-pack.json` (`aw-sjh-v01.negative`, `sung-hum.category`) | done | `negative` 배열 항목이 "Jin-Woo"를 문자 그대로 포함 — 향후 자동 재생성 시 API로 전송될 수 있는 잠재 유출로 판단해 "source protagonist"로 교체; `category` 라벨도 형제 archetype과 동일한 originalized 패턴으로 통일 |


## Stage3 CI note: engine_contract gate blocked by pre-existing bug, not this cycle's scope

After 3 fix-forward commits (c2dbb97 missing imports, 9a06fcf foreign-content
removal from styles.css/defense-run-simulation.js, 687cf87 asset-manifest
regeneration for the 40 D8/D13 pilot images), `engine_contract`'s remaining
2 failures (`terminal victory accepts a queued reward selection...` /
`selecting an already-owned reward closes an all-owned terminal offer`,
both in `tests/defense-run-simulation.test.mjs`) are **pre-existing at
b0a0c57** (verified via direct baseline repro before any RPG work) — the
reward-selection flow appends `INPUT_ACCEPTED` after `REWARD_SELECTED`
(processInput's terminal emit), so `events.at(-1).type` never equals
`REWARD_SELECTED`. Not caused by, or fixable within, this cycle's RPG-layer
scope. A fix is already in-progress in the shared working tree (uncommitted,
another concurrent workstream — relaxes the assertion to
`events.find(e => e.type === "REWARD_SELECTED")`). Deploy (`package_pages`
onward) stays gated until that lands; `browser_contract` and
`release_closure` are green as of 687cf87.

## World-content-pack Blender 자산 생성 (this session)

사용자 요청으로 Stage 4-10 지형/보스/동료/아이템/VFX 3D 자산을 캐논 `abyssal-command-resource-pack.blend` 기반 파라메트릭 빌더로 생성. 세부 결함 발견·수정 경위는 `decision-log.md` D15 참조.

| task | artifact | status | note |
|---|---|---|---|
| 파라메트릭 빌더 작성 | `scripts/build-world-content-pack.py` | done | 지형 7 + 보스 7 + 동료 6 + 아이템 8 + VFX 6 = 30 컬렉션/209 오브젝트, 캐논 팩 읽기 전용 사용 |
| 캐논 리소스 팩 텍스처 결함 발견·완화 | `scripts/build-world-content-pack.py`(`ensure_materials`) | done | 9개 재사용 머티리얼의 링크된 텍스처 파일이 저장소에 부재(마젠타 렌더 유발) — 캐논 파일은 미변경, 빌더가 깨진 링크를 재빌드마다 결정론적으로 언링크 |
| 지오메트리 인접성 QA + 수정 | `scripts/check-asset-adjacency.py`, `scripts/build-world-content-pack.py` | done | 30개 컬렉션 전수 바운딩박스 인접성 검사, 9개 컬렉션 실제 결함 수정(목/팔 연결 누락, 소품 부유), 3개는 의도적 디자인으로 확인(무수정) |
| Cycles 결정론적 리뷰 렌더 검증 | `scripts/render-review-thumbnails.py` | done | 전체 30 컬렉션 재빌드 후 재검증 — pairwise gap 전수 0.0000, 육안 렌더 확인 |

## WebGL RealtimeBattle migration + Pages deploy wiring (this session)

`battle-realtime-three.js`가 Canvas2D 위에 3D처럼 보이도록 그리던 이전 구현이었음을 발견 — 사용자 요청("battle-realtime-three.js가 진짜로 three.js/WebGL을 쓰는지 검증하고, 아니면 실제로 만들어라")에 따라 전면 재작성. 상세 결정 경위는 `decision-log.md` D16 참조.

| task | artifact | status | note |
|---|---|---|---|
| RealtimeBattle 전면 재작성 (실제 WebGL) | `battle-realtime-three.js` | done | THREE.WebGLRenderer/Scene/PerspectiveCamera 기반 재작성, mount/renderSnapshot/dispose/onVisualFeedback/debugMetrics 계약 유지(app.js의 RealtimeBattle→BattleVisualizer 폴백 패턴 무변경). GLTF 로딩(캐싱+공유), dual-mode 좌표 해석(정규화 `[-1,1]` vs raw arena 0-24000, 구 렌더러 계약과 동일 휴리스틱), 카메라 이징+reduced-motion 스냅, VFX 5종 스폰 전량 브라우저 실측(터레인/보스/동료/적/커맨더/게이트/VFX 렌더 확인, 스크린샷 증거) |
| GLB 룩업 테이블 완전성 검증 | `battle-realtime-three.js` | done | 42개 GLB 실측 대조 — 지형10+보스10+적4+동료6+커맨더1+VFX6=37개 결선, items/*.glb 4개+echo-throne.glb(장식용, echo-throne-steps.glb로 대체)는 렌더러 미참조 확인(보상은 DOM 텍스트 카드로 렌더, 3D 모델 아님) |
| vendor 파일 bare specifier 버그 발견·수정 | `vendor/loaders/GLTFLoader.js`, `vendor/utils/{BufferGeometryUtils,SkeletonUtils}.js` | done | CDN에서 그대로 복사된 3개 파일이 `from 'three'`(npm 패키지 bare specifier) 사용 — 브라우저는 `index.html`의 importmap으로 해석했지만 순수 Node(`node --test`)는 해석 불가, CI 전체 블로킹 버그. 상대경로(`from '../three.module.js'`)로 수정, importmap을 사장(死藏) 코드로 판단해 `index.html`에서 제거 |
| 렌더러 계약 테스트 전면 재작성 | `tests/defense-renderer-contract.test.mjs`, `tests/world-presentation-contract.test.mjs` | done | 구 테스트가 RealtimeBattle/BattleVisualizer를 동일 Canvas2D 어댑터로 가정(둘 다 mock canvas의 `arc`/`fillText` 등 호출을 assert) — RealtimeBattle은 이제 진짜 WebGL이라 이 가정이 깨짐. WebGL 컨텍스트 생성 실패 시 mount()가 throw하는 계약(app.js 폴백의 전제) 테스트 추가, RealtimeBattle 전용 테스트는 실제 THREE.Scene/Camera/Group을 직접 구성해 WebGLRenderer만 우회(mock 없이 진짜 reconcileActors/updateCamera/ensureStageTerrain 로직 실행). Canvas2D 전용 계약(포틀레이트 라벨 counter-rotation 등, 3D에는 대응 없음 — 해당 정보는 DOM/CSS atlas 패널로 이전됨)은 BattleVisualizer 전용으로 재scope |
| 배포 파이프라인 5개소 배선 | `.github/workflows/static.yml`, `scripts/defense-runtime-assets.mjs`, `sw.js`, `tests/release-closure.test.mjs`, `tests/pages-artifact-smoke.cjs`, `assets/defense-asset-manifest.json` | done | vendor 5개+GLB 42개(sw.js는 미참조 5개 제외한 37개만 precache)를 Pages 배포 allowlist·서비스워커 precache·자산 매니페스트·릴리즈 클로저 테스트에 전량 등록. 두 테스트 파일(`defense-asset-manifest.test.mjs`, `release-closure.test.mjs`)에 남아있던 "assets/models는 영구 금지"라는 구 RTS 시대(커밋 `141b8f7`) 불변식을 발견·완화(당시엔 다른 GLB 경로 체계였고, 이번 재도입은 프로덕션 문서(`motion-previs-and-blender-execution-plan.md`)가 명시한 의도된 산출물) |
| 전체 스위트 회귀 검증 | `node --test` 출력 | done | 169개 중 157 pass — 실패 12개 전량 이 세션과 무관한 기존 dirty-tree 원인 2가지로 추적: (1) `_workspace/20260722-abyssal-command-bmad-gds-expansion/` 전체가 git 인덱스엔 있으나 워킹트리에서 미스테이지 삭제됨(10개 테스트), (2) `assets/images/battle/world/cinder-span-topdown-plate.webp`가 별도 워크스트림에 의해 `pilot/`로 미스테이지 이동됨(2개 테스트) — 둘 다 이 세션이 건드리지 않은 경로, `git show HEAD:`로 원본 확인 |
| 브라우저 실 WebGL 스모크 테스트 | 스크린샷 증거 | done | 로컬 정적 서버로 실제 `index.html` 서빙 → 로비→전투 시작→실제 GLB 42개 중 다수 네트워크 요청 확인(vendor 5개+터레인/커맨더/적3종/VFX2종)→WebGL 컨텍스트 존재 확인→3D 커맨더 모델(왕관 스파이크 형상)·게이트 토러스·터레인 평면이 성장선택 HUD와 함께 렌더되는 스크린샷 확보, 콘솔 에러 0건 |
