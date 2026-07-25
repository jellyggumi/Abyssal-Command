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
| 성능/접근성 회귀 | director (impl) | Stage3 | soak/perf 로그, `ops/*.md` | G4/G6 | done-with-note | 배포 준비 — G4(터치타깃/그레이스케일/reduced-motion) MET, 몰입감·레이턴시 인간 플레이테스트 항목만 FIX(자동화 불가, 다음 사이클); G6 ops-runbook 3종 신규 작성 완료(`ops/telemetry-contract.md`/`rollback-runbook.md`/`release-readiness.md`) — 작성 과정에서 실제 코드 교차버전 검증으로 **미문서화 회귀 위험 발견**: 이번 사이클(233a9d0) 이후 저장된 세이브를 그 이전 빌드로 롤백 시 `hasOnlyKeys` 엄격 검증이 신규 3키(wardenProgress 등)를 거부 → 플레이어 다음 액션 시 세이브 소실(전진 마이그레이션은 안전, 역방향만 위험) — `ops/rollback-runbook.md` 완화책 포함 문서화. G6 잔여 항목은 실제 프로덕션 롤백 라이브 테스트 1건뿐(고의적 인간 승인 대기, 이번 세션에서 임의 실행하지 않음) — `production/gate-reviews/stage3-review.md` |
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
| 파라메트릭 빌더 작성 | `scripts/build-world-content-pack.py` | done | 지형 7 + 보스 7 + 동료 6 + 아이템 8 + VFX 6 = 30 컬렉션/209 오브젝트, 캐논 팩 읽기 전용 사용. **[2026-07-25 추가 확인]** 당시 산출물 `world-content-pack.blend`을 2026-07-25 세션에서 헤드리스 재확인한 결과 52개 컬렉션 전부 0 오브젝트(빈 껍데기)였음 — 원인은 캐논 입력 `abyssal-command-resource-pack.blend` 자체가 이후 어느 시점(디스크 압박 정리로 추정, 확정 아님[INFERENCE])에 유실된 것. 형제 워크트리에서 캐논 팩 복사 후 빌더 재실행으로 260 오브젝트/36 컬렉션 재생성, export까지 완료(아래 섹션) |
| 캐논 리소스 팩 텍스처 결함 발견·완화 | `scripts/build-world-content-pack.py`(`ensure_materials`) | done | 9개 재사용 머티리얼의 링크된 텍스처 파일이 저장소에 부재(마젠타 렌더 유발) — 캐논 파일은 미변경, 빌더가 깨진 링크를 재빌드마다 결정론적으로 언링크 |
| 지오메트리 인접성 QA + 수정 | `scripts/check-asset-adjacency.py`, `scripts/build-world-content-pack.py` | done | 30개 컬렉션 전수 바운딩박스 인접성 검사, 9개 컬렉션 실제 결함 수정(목/팔 연결 누락, 소품 부유), 3개는 의도적 디자인으로 확인(무수정) |
| Cycles 결정론적 리뷰 렌더 검증 | `scripts/render-review-thumbnails.py` | done | 전체 30 컬렉션 재빌드 후 재검증 — pairwise gap 전수 0.0000, 육안 렌더 확인 |

## WebGL RealtimeBattle migration + Pages deploy wiring (this session)

`battle-realtime-three.js`가 Canvas2D 위에 3D처럼 보이도록 그리던 이전 구현이었음을 발견 — 사용자 요청("battle-realtime-three.js가 진짜로 three.js/WebGL을 쓰는지 검증하고, 아니면 실제로 만들어라")에 따라 전면 재작성. 상세 결정 경위는 `decision-log.md` D16 참조.

| task | artifact | status | note |
|---|---|---|---|
| RealtimeBattle 전면 재작성 (실제 WebGL) | `battle-realtime-three.js` | done | THREE.WebGLRenderer/Scene/PerspectiveCamera 기반 재작성, mount/renderSnapshot/dispose/onVisualFeedback/debugMetrics 계약 유지(app.js의 RealtimeBattle→BattleVisualizer 폴백 패턴 무변경). GLTF 로딩(캐싱+공유), dual-mode 좌표 해석(정규화 `[-1,1]` vs raw arena 0-24000, 구 렌더러 계약과 동일 휴리스틱), 카메라 이징+reduced-motion 스냅, VFX 5종 스폰 전량 브라우저 실측(터레인/보스/동료/적/커맨더/게이트/VFX 렌더 확인, 스크린샷 증거) |
| GLB 룩업 테이블 완전성 검증 | `battle-realtime-three.js` | done | ~~42개 GLB 실측 대조 — 지형10+보스10+적4+동료6+커맨더1+VFX6=37개 결선~~ **[2026-07-25 정정]** 이 "37개 결선" 주장은 룩업 테이블 코드상의 키 매핑 완전성만 확인한 것으로, 실제 파일 존재/네트워크 로드는 검증하지 않았음. 2026-07-25 세션에서 실측 재검증 결과 당시 디스크엔 `anchor-shard.glb` 1개만 실재(나머지는 `loadGltf()`의 `.catch()`가 조용히 삼켜 렌더 무발동). 근본원인·해결은 아래 "3D 자산 결선 실체 확인" 섹션 참조. items/*.glb 4개+echo-throne.glb가 렌더러 미참조라는 부분(보상은 DOM 카드로 렌더)은 검증 재확인됨, 정정 대상 아님 |
| vendor 파일 bare specifier 버그 발견·수정 | `vendor/loaders/GLTFLoader.js`, `vendor/utils/{BufferGeometryUtils,SkeletonUtils}.js` | done | CDN에서 그대로 복사된 3개 파일이 `from 'three'`(npm 패키지 bare specifier) 사용 — 브라우저는 `index.html`의 importmap으로 해석했지만 순수 Node(`node --test`)는 해석 불가, CI 전체 블로킹 버그. 상대경로(`from '../three.module.js'`)로 수정, importmap을 사장(死藏) 코드로 판단해 `index.html`에서 제거 |
| 렌더러 계약 테스트 전면 재작성 | `tests/defense-renderer-contract.test.mjs`, `tests/world-presentation-contract.test.mjs` | done | 구 테스트가 RealtimeBattle/BattleVisualizer를 동일 Canvas2D 어댑터로 가정(둘 다 mock canvas의 `arc`/`fillText` 등 호출을 assert) — RealtimeBattle은 이제 진짜 WebGL이라 이 가정이 깨짐. WebGL 컨텍스트 생성 실패 시 mount()가 throw하는 계약(app.js 폴백의 전제) 테스트 추가, RealtimeBattle 전용 테스트는 실제 THREE.Scene/Camera/Group을 직접 구성해 WebGLRenderer만 우회(mock 없이 진짜 reconcileActors/updateCamera/ensureStageTerrain 로직 실행). Canvas2D 전용 계약(포틀레이트 라벨 counter-rotation 등, 3D에는 대응 없음 — 해당 정보는 DOM/CSS atlas 패널로 이전됨)은 BattleVisualizer 전용으로 재scope |
| 배포 파이프라인 5개소 배선 | `.github/workflows/static.yml`, `scripts/defense-runtime-assets.mjs`, `sw.js`, `tests/release-closure.test.mjs`, `tests/pages-artifact-smoke.cjs`, `assets/defense-asset-manifest.json` | done | vendor 5개+GLB 42개(sw.js는 미참조 5개 제외한 37개만 precache)를 Pages 배포 allowlist·서비스워커 precache·자산 매니페스트·릴리즈 클로저 테스트에 전량 등록. 두 테스트 파일(`defense-asset-manifest.test.mjs`, `release-closure.test.mjs`)에 남아있던 "assets/models는 영구 금지"라는 구 RTS 시대(커밋 `141b8f7`) 불변식을 발견·완화(당시엔 다른 GLB 경로 체계였고, 이번 재도입은 프로덕션 문서(`motion-previs-and-blender-execution-plan.md`)가 명시한 의도된 산출물) |
| 전체 스위트 회귀 검증 | `node --test` 출력 | done | 169개 중 157 pass — 실패 12개 전량 이 세션과 무관한 기존 dirty-tree 원인 2가지로 추적: (1) `_workspace/20260722-abyssal-command-bmad-gds-expansion/` 전체가 git 인덱스엔 있으나 워킹트리에서 미스테이지 삭제됨(10개 테스트), (2) `assets/images/battle/world/cinder-span-topdown-plate.webp`가 별도 워크스트림에 의해 `pilot/`로 미스테이지 이동됨(2개 테스트) — 둘 다 이 세션이 건드리지 않은 경로, `git show HEAD:`로 원본 확인 |
| 브라우저 실 WebGL 스모크 테스트 | 스크린샷 증거 | done | 로컬 정적 서버로 실제 `index.html` 서빙 → 로비→전투 시작→실제 GLB 42개 중 다수 네트워크 요청 확인(vendor 5개+터레인/커맨더/적3종/VFX2종)→WebGL 컨텍스트 존재 확인→3D 커맨더 모델(왕관 스파이크 형상)·게이트 토러스·터레인 평면이 성장선택 HUD와 함께 렌더되는 스크린샷 확보, 콘솔 에러 0건 |

## 동료 3종 + 아이템 2종 확장 (this session)

사용자 요청으로 6개 동료(스테이지 1-3 계보)에 3종 추가(9종, 스테이지 4-10 계보) + REWARDS 신규 2종. 상세 결정 경위는 `decision-log.md` D18 참조.

| task | artifact | status | note |
|---|---|---|---|
| 신규 동료 3종 데이터+역할 배선 | `defense-catalog.js`, `rpg-catalog.js` | done | `pack-warden`(vanguard)·`lantern-reaver`(striker)·`requiem-warden`(support), COMPANION_ROLES 3역할×2명 하드코딩 없음 확인 후 동적 배선만으로 완료 |
| 신규 REWARDS 2종 | `defense-catalog.js`(REWARDS, STAGE_REWARD_IDS), `defense-run-simulation.js` | done | `warden-lantern`(pickupRange 버프)·`choir-ward-crystal`(critChanceBonusBp 버프), 기존 `applyOwnedRewards` 필드에 직접 후킹(신규 시뮬레이션 코드 불필요) |
| 3D 에셋 빌드 확장 | `scripts/build-world-content-pack.py` | done | 기존 6동료 빌드 패턴 답습, 신규 5컬렉션(동료3+아이템2) 인접성 QA 첫 시도 클린 통과(0 결함) |
| 전체 38컬렉션 재검증 | `scripts/check-asset-adjacency.py` | done | 회귀 없음, 기존 2개 flagged(D15 의도된 예외)만 유지 |
| GLB export + 배포 배선 | `scripts/export-battle-glb.py`, `.github/workflows/static.yml`, `sw.js`, `scripts/defense-runtime-assets.mjs`, `tests/release-closure.test.mjs`, `tests/pages-artifact-smoke.cjs`, `assets/defense-asset-manifest.json` | done | 신규 GLB 5종을 6개소 전량 등록(D16 교훈 재적용); release-closure 파일 내 리스트 2곳 중복 존재를 최초 누락했다가 advisory로 즉시 보정 |
| 런타임 배선 | `battle-realtime-three.js`(COMPANION_MODELS), `app.js`(companionGlyph) | done | 3종 GLB 경로 + 3종 UI glyph 추가 |
| 회귀 테스트 (3개 서브에이전트 병렬) | `tests/rpg-catalog.test.mjs`, `tests/defense-run-simulation-rpg.test.mjs`, `tests/defense-run-simulation.test.mjs` | done | 각자 IRC로 파일 소유권 조율(충돌 없음), teeth-test로 assertion 실효성 자체 증명 |

## 3D 자산 결선 실체 확인 + T-pose 캐릭터 배치 + 리깅 도구 결정 (this session)

사용자 요청("나머지 이미지 매쉬도 T-Pose로 생성후, 리깅해야해... 실제 리소스가 반영되어 구성 동작하도록해야해")에 따라 진행. 상세 경위는 `decision-log.md` D19 참조.

| task | artifact | status | note |
|---|---|---|---|
| Rodin Confirm 버튼 좌표 버그 발견·해결 | (프로세스 지식, 코드 아님) | done | 이전 세션 내내 다운로드가 실패한 근본 원인 — DOM에 동일 텍스트("Confirm") 요소가 5개 존재, 잘못된 좌표를 클릭해 잠긴 Pack 섹션을 계속 누르고 있었음. `document.elementFromPoint()`로 실제 렌더 위치 역산 후 해결. `saveAs()`/`download.path()`가 sandboxed fs 제약으로 타임아웃되는 것도 발견 — 다운로드 이벤트에서 서명 URL(`file.hyper3d.com/.../base.glb?X-Tos-...`)만 추출해 `curl` 직접 다운로드로 우회 |
| 보스 T-pose GLB 5종 확보 (s1-s5) | `pipeline/bosses/raw/{s1-cinder-warden,s2-veil-tactician,s3-gate-sovereign,s4-tide-warden,s5-pack-herald}.raw.glb` | done | 전량 glTF magic 검증 + SHA-256 상호 고유성 확인(5개 전부 다른 해시). s4는 T-pose 적용 전 Geometry가 이미 confirm된 상태였음이 밝혀져 `.NOTPOSE.` 파일명 마커로 표시(31.5MB, quad 리토폴로지 미적용 원본 밀도) — 재생성하지 않고 보존, Blender 리포즈 필요 사항으로 명시 |
| **3D 런타임 자산 결선 갭 발견·해결** | `assets/images/battle/glb/*.glb`(40개), `assets/models/abyssal-command/abyssal-command-resource-pack.blend`, `_workspace/.../world-content-pack.blend` | done | 직전 커밋(`0b50089`)이 스스로 문서화한 기지 갭 재확인: `battle-realtime-three.js`의 40개 매핑 중 `anchor-shard.glb` 1개만 실재, 나머지 39개는 `loadGltf()`의 `.catch()`가 조용히 삼켜 무발동 상태. 캐논 리소스팩(`abyssal-command-resource-pack.blend`)이 디스크 압박 정리로 유실된 것이 근본원인 — 형제 워크트리(`Abyssal-Surge-3d-overhaul`, `Abyssal-Surge-cycle2`, 동일 origin) 대조로 확인 후 복사, `build-world-content-pack.py`+`export-battle-glb.py` 재실행으로 40/40 GLB 신규 export(260 오브젝트, 36 컬렉션). 전량 glTF magic 검증 통과, 헤드리스 서버+브라우저 실측(WebGL 컨텍스트 확인, 네트워크에서 4종 GLB 200 확인 — dusk-warden/cinder-span/scout/shade, 스크린샷으로 보스+터레인+VFX 실제 렌더 확인) |
| 삭제된 workspace 5개 안전성 재검증·복구 | `_workspace/20260716-*`(2개, 복구 불필요 확인), `_workspace/20260722-*`(3개, 복구 완료), `assets/images/battle/{dusk-warden,echo-rusher}-*`(20개), `assets/images/battle/pilot/concept-{shadow-commander,sung-hum}-boss.*`(4개), `assets/models/abyssal-command/abyssal-command-resource-pack.glb`, `assets/video/abyssal-surge-defense-survivor-smoke.mp4`, `assets/images/battle/animation-manifest.json` | done | 최초 판단("커밋 메시지가 ship이니 안전")이 틀렸음을 테스트 실패로 발견 — `git ls-files`가 tracked로 보고하는 모든 경로를 디스크 존재 여부로 전수 재검증, 형제 워크트리에서 HEAD와 diff 0 확인 후 복구(git 조작 아님, 순수 파일 복사 — 형제가 동일 origin의 다른 체크아웃이므로 버전 어긋남 없음 확인). 코드/테스트가 참조하지 않는 나머지 3개(20260716- 2종 + 미참조분)는 정리 유지 |
| G2 fixture 1건 진짜 유실 확인·문서화 | `tests/g2-prepared-prerequisite-bindings.test.mjs` | done | `g2-prepared-prerequisite-bindings-v1.json` — git 히스토리에도 형제 워크트리 2곳에도 존재하지 않음, 진짜 복구 불가로 결론. 위조 대신 `existsSync` 가드 + 사유 명시된 `test(..., { skip: "..." })`로 처리(영구 red 스위트 방지) |
| 전체 스위트 회귀 검증 | `node --test` 출력 | done | 174개 중 173 pass, 1 skip(위 fixture, 사유 명시), 0 fail. `tmp/marker-test.mjs`(손상된 유니코드 삽입된 디버그 스크래치 파일)도 발견·제거 |
| 리깅 도구 조사 + ADR | `.claude/skills/game-studio-harness/references/quality-gates.md`("Character asset pipeline standard" 섹션) | done | AccuRig/Mixamo/Tripo AI/Mesh2Motion 4종 라이선스+자동화+포맷 비교(서브에이전트 위임 리서치). 결론: Tripo AI(REST API+SDK, 휴머노이드+크리처 겸용, 네이티브 GLB, CC BY 4.0 무료 티어)가 배치 자동화 유일 옵션 — AccuRig/Mesh2Motion은 라이선스는 깨끗하나 GUI 전용(배치 불가), Mixamo는 2026년 인증/업로드 불안정성 다수 보고로 비권장 |
| ~~**BLOCKER 1: 크레딧 부족**~~ | Rodin 계정 잔액 27.5 | **[2026-07-25 정정, 즉시 반증]** 이 판단은 틀렸음 — s6 신규 생성(비-redo, concept 이미지→T-pose)을 실측한 결과 실제 소모는 캐릭터당 0.5크레딧(27.5→27.0)뿐이었다. 17개 전량 신규 생성에 필요한 예산은 ~8.5크레딧으로 27.5 잔액 내에서 충분(19 여유). "캐릭터당 수 크레딧"이라는 최초 추정은 실측 없이 UI의 다른 숫자(Confirm 버튼의 "0.5 Credits" 표시를 다른 항목으로 오인)에서 잘못 도출됨. BLOCKER 아님 — 취소선 처리, 17개 생성 계속 진행 |
| ~~**BLOCKER: 리깅 API 키 부재**~~ | `TRIPO_API_KEY` 미설정 | **[2026-07-25 해소]** Tripo API 키 조달 대신 Blender 내장 Rigify(무료, 이미 로컬에 설치됨)로 우회 — `scripts/rig-and-animate-asset-blender.py`(pedestal-cut 분리 + Rigify human metarig 피팅 + automatic-weights 바인딩 + 11-action 키프레임 라이브러리)를 22개 캐릭터 배치에 실행, 19/23 성공(skin+11 clips 검증). 4개 실패(gate-sovereign/tide-warden/lantern-tyrant/veiled-concordat)는 API 키 부재가 아니라 각 보스의 화려한 로브/케이프 실루엣이 radius-minima pedestal-cut 휴리스틱을 속여(다중 허위 "허리" 후보) bone-heat weighting이 결정론적으로 실패 — 5회 재시도로도 재현, 지오메트리 특이적 문제로 다음 사이클 개별 처리 필요. 상세: `decision-log.md` D20 |

## 리소스 실제 적용 확인 + 애니메이션/배포/UI 자재 정합 (this session)

사용자 요청("추가된 리소스로 게임리소스 업데이트... 콘셉트이미지기반으로 만들었으니까 알맞게 적용... 각
리소스와 게임 UI 대대적으로 개편")에 따라, 직전 커밋(`d8e9d9f`)이 "완료"로 표시한 T-pose 파이프라인을
실측 검증한 결과 3개의 독립적 결함을 발견·해결. 상세 경위는 `decision-log.md` D20 참조.

| task | artifact | status | note |
|---|---|---|---|
| **배포 allowlist 갭 발견·해결** | `scripts/defense-runtime-assets.mjs`, `.github/workflows/static.yml`, `tests/release-closure.test.mjs`, `sw.js`, `assets/defense-asset-manifest.json` | done | 40개 GLB 중 `anchor-shard.glb` 1개만 4개소(RETAINED_ASSET_PATHS/PAGES_RUNTIME_PATHS/RUNTIME_PATHS/CORE_ASSETS) 전부에 등록돼 있었음 — 로컬 dev 서버는 저장소 전체를 서빙해 이 갭을 가렸으나, 실제 Pages 배포는 `git archive`로 allowlist만 포장하므로 나머지 39개 GLB가 라이브 사이트에서 전량 404됐을 것(로컬에서는 발견 불가능한 종류의 버그). 4개소 전부 동기화, 매니페스트 재생성, `node --test` 그린 확인 |
| **3개 미참조 GLB 정리** | `assets/images/battle/glb/{abyssal-banner,broken-court-monarch-boss,warden-lantern}.glb`(87MB) + previs 형제 3종 | done | 코드 전체 grep으로 무참조 확인(warden-lantern/abyssal-banner는 REWARDS 텍스트 카드로만 존재, GLB 미사용; broken-court-monarch-boss는 탐색적 콘셉트 잔재) — 삭제, 매니페스트 자동 반영 |
| **AnimationMixer 부재 발견·해결(핵심 버그)** | `battle-realtime-three.js` | done | `instantiateActorModel()`이 `gltf.animations`를 한 번도 읽지 않음 — 리깅된 GLB가 11개 액션 클립을 담고 있어도 AnimationMixer가 없어 전량 정지 T-pose로 렌더링(로컬 실측: 스크린샷상 별모양 정적 실루엣). `SkeletonUtils.clone()`(멀티 인스턴스 스켈레톤 독립 바인딩)+`THREE.AnimationMixer`+11-액션 크로스페이드 상태머신 신규 구현 — 이동은 위치델타 기반 idle/move, 전투는 `WEAPON_FIRED`/`ENEMY_ATTACK`/`COMPANION_DOWNED`/`ENEMY_DEFEATED` 이벤트로 attack/hit/die 트리거(검증된 이벤트 필드 형태만 사용, 미검증 필드 추측 안 함). 적 처치는 시체 애니메이션을 위한 death-echo 임시 액터로 구현(원본 액터는 시뮬레이션 계약대로 즉시 제거, 죽음 이펙트는 순수 시각 잔향) |
| **커맨더(Dusk Warden) 미리깅 발견·해결** | `assets/images/battle/glb/dusk-warden.glb` | done | 22개 배치 리깅 대상에서 커맨더 자신이 누락돼 있었음(D19가 "나머지"로 지칭한 범위에 포함 안 됨) — 항상 화면에 보이는 유일한 캐릭터가 유일하게 미리깅 상태로 방치되던 것 발견. 16-파트 프로시저럴 메시(팔레트: Void Obsidian/Cold Steel/Cyan Rift/Zenith Void Gold)를 Blender join으로 단일 메시화 후 표준 리그 파이프라인 그대로 통과(첫 시도 성공, 36 joints, 11 clips) |
| **20개 캐릭터 GLB 리깅+애니메이션 배치(19 기존+커맨더 1)** | `assets/images/battle/glb/*.glb` | done | `scripts/rig-and-animate-asset-blender.py`를 boss 6/enemies 4/companions 9 + dusk-warden에 개별 Blender 서브프로세스로 실행, 매 결과물 skin+11-clips 검증 후에만 런타임 경로 복사(검증 실패 2건 발견 → 즉시 git checkout으로 원복, 아래 D20 "런타임 오염 사고" 참조). 4개 보스(gate-sovereign/tide-warden/lantern-tyrant/veiled-concordat)는 5회 재시도에도 결정론적으로 bone-heat weighting 실패(로브/케이프 실루엣이 pedestal-cut 휴리스틱의 신뢰도를 무너뜨림) — 다음 사이클 개별 처리 항목으로 명시 이월, 무리한 재시도로 시간 소모하지 않음 |
| **PMREM 환경광 추가** | `battle-realtime-three.js` | done | 리깅과 별개로 발견: PBR 머티리얼(metallic 0.32-0.72)이 ambient+directional 조명만으로는 반사광 없이 flat하게 렌더링(three.js PBR BSDF의 specular IBL 항이 환경맵을 요구하는 구조적 한계, 머티리얼 자체는 정상 authored). `COLORS` 팔레트 재사용한 프로시저럴 룸 베이크(`THREE.PMREMGenerator`)를 `scene.environment`에 연결 — 신규 애셋/네트워크 요청 없이 기존 조명 색상의 연장으로 구현, 브라우저 실측(터레인 그라디언트 가독성 향상 스크린샷 확인) |
| **CSS 캔온 팔레트 정합** | `styles.css` | done | Blender 머티리얼 데이터에서 직접 측정한 sRGB 값(Void Obsidian #3c2c5b, Cold Steel #737990, Cyan Rift #2cadd6, Zenith Void Gold #ddc869)을 `--canon-*` 토큰으로 신규 추가, 로비 aurora/glow-ring/portrait 소켓/panel-glass 4개 고노출 표면에 적용 — 기존 `--rc-*` 시맨틱 토큰(체력바 그라디언트, 역할 배지 등)은 무변경(디자인 의도 보존), 장식용 chrome만 실제 게임 자산과 동일 재질 언어로 재도색 |
| **stale 문서 정정** | `ui/lane-hud-layout.md` | done | §4/director-handoff가 "Option A(Canvas2D) 채택 확정"으로 서술하고 있었으나 D17이 이미 Option B(실제 WebGL)로 번복 완료 — 현재 출하 코드가 진짜 `THREE.WebGLRenderer`임을 재확인 후, 원문 보존+정정 노트 추가 방식(이 워크스페이스의 기존 D11/D12 패턴과 동일)으로 수정 |
| **런타임 오염 사고 발견·복구** | `assets/images/battle/glb/*.glb`(13개) | done | 배치 리깅 도중 git status로 13개 런타임 GLB가 애니메이션 없는 상태로 예기치 않게 덮어써진 것을 발견 — staging 격리 경로(`/tmp/rig-batch-staging`)만 사용했음에도 발생, 원인 미확정(동시 실행 중이던 별도 Blender GUI 프로세스 의심되나 확증 못함). `git checkout`으로 즉시 원복, staging 재검증 후 안전하게 재배포. 상세: `decision-log.md` D20 |
| **전체 회귀 검증** | `node --test` 출력 | done | 174개 중 173 pass·1 skip(기존 사유 명시된 스킵, 무관)·0 fail. `no-rts-closure.test.mjs`가 신규 `ACTION_KEYS` 식별자를 구-RTS 용어로 오탐 — `RIG_ACTION_KEYS`로 개명하여 해소(코드 밖 정성적 명칭 문제, `ACTION_KEYS`가 지칭하는 실제 개념과는 무관) |
| **브라우저 실측** | 스크린샷 증거 | done | 로컬 서버+실 브라우저: 로비→전투 진입→커맨더/적 4종 애니메이션 실제 렌더 확인(idle breathing bone quaternion 프레임간 변화 직접 샘플링으로 증명), 이동 커맨드 후 walk 전환, 전투 진행 중 적 attack 포즈 전환 스크린샷 확보, 콘솔 에러 0건. 서비스워커 캐시가 리깅 이전 GLB를 계속 서빙하던 함정도 발견·해소(등록 해제+캐시 삭제 필요) |

## Deferred out of this cycle (explicit, not silently dropped)

- 4개 보스(gate-sovereign/tide-warden/lantern-tyrant/veiled-concordat) 리깅 — bone-heat weighting이 로브/케이프 실루엣에서 결정론적으로 실패, pedestal-cut 휴리스틱 자체의 개선(예: 볼록껍질 기반 waist 탐지) 또는 수동 리토폴로지가 필요. 정적 메시로 폴백 렌더링(형태/색상은 정상, 애니메이션만 없음) — 게임플레이 블로킹 아님
- (정정: 이전 초안이 여기서 주장한 "5번째 적 아키타입 reinforce 미배치"는 오류 — `defense-catalog.js`/`battle-realtime-three.js` 재확인 결과 `ENEMY_MODELS`는 4개 아키타입(rusher/flanker/guardian/ranged→scout/shade/guard/possessed)만 정의, reinforce는 ASSET_AUDIT.md의 구 리소스팩 문서에만 존재하는 폐기된 5번째 유닛으로 현재 게임에 참조 없음 — 실제 결손 아님)
- `--rc-*` 시맨틱 토큰(체력바/위협/역할배지 그라디언트)의 canon 팔레트 이관 — 이번 세션은 고노출 장식 표면(aurora/glow/portrait/glass)만 재도색, 기능색은 의도적으로 무변경(사용자가 명시적으로 "각 리소스" 개편을 요청했으나 기능적 UX 신호를 canon 팔레트로 대체하는 것은 별도 디자인 결정이 필요해 임의 확장하지 않음)
