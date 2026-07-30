# Task Manifest — Abyssal Lantern 자연 관절 모션·3스테이지 통합

run-id: `20260728-onslaught-action-pivot`
cycle: 8 (런타임 통합·배포 검증)
next-beat: 독립 사람 플레이 판정으로 G4/G7/G8 재측정

---

## 1. 사이클 1 — 설계 (완료)

| task | owner | 산출물 | 게이트 | 상태 |
|---|---|---|---|---|
| 피벗 범위·프리즈 경계 정의 | game-production-director | `intake/production-brief.md` | — | done |
| 마스터 수치 계약 | game-designer | `design/master-numeric-contract.md` | G2/G7 입력 | done |
| Hit & slash 전투 동사 | game-designer | `design/action-combat-spec.md` | G2 입력 | done |
| 웨이브·빅웨이브·보스 구성 | game-designer | `design/encounter-wave-spec.md` | G2/G7 입력 | done |
| PCG 셀 배치 | level-designer | `design/pcg-stage-layout-spec.md` | G6 입력 | done |
| 스킬 카테고리·영구 성장 | game-designer | `design/skill-and-growth-spec.md` | G3 입력 | done |
| 보스 패턴·적 AI | game-designer | `design/boss-pattern-spec.md` | G2 입력 | done |
| 카메라·VFX 연출 | ui-senior-developer | `design/camera-vfx-direction.md` | G4/G6 입력 | done |
| HUD 정보 구조 | ui-senior-developer | `ui/hud-information-architecture.md` | G4 입력 | done |
| 로비 서사 매체 | game-designer | `design/lobby-story-presentation-spec.md` | G1/G4 입력 | done |
| 코드 마이그레이션 맵 | game-programmer | `engineering/migration-map.md` | G6 입력 | done |
| **마스터 GDD 델타** | game-production-director | `design/master-gdd-delta.md` | **전 게이트 입력** | done |

`master-gdd-delta.md`와 `migration-map.md`는 독자가 다르다 — 전자는 **제품이 무엇이
되는가**(필러·루프·승패·캠페인), 후자는 **어느 파일이 어떻게 바뀌는가**를 진술한다.
두 문서 중 하나만으로는 피벗을 판정할 수 없다.

### 1.1 설계 중 발견·수정한 결함

산술·좌표계 오류를 문서에 남기지 않기 위해 시뮬레이션으로 검증했다.

| # | 결함 | 수정 |
|---|---|---|
| 1 | 페이즈 종료 규칙이 모호해 `FINALE` 타임아웃 승리가 성립 | 시간상한/처치전용 2종으로 분리, 하드 실링 강제 종막 |
| 2 | DPS 균형을 취소 없는 타임라인으로 계산 (체인이 43% 지배) | startup 상향, 취소-압축 기준 재계산 (3343–3510 수렴) |
| 3 | 스폰 표가 분수 개체 생성 | 정수 규칙 + 시뮬레이션 생성 궤적으로 교체 |
| 4 | 백로그가 정수/배열 타입 충돌, 드레인 규칙 부재 | `EnemyTemplate[]` FIFO 큐 단일 규칙 |
| 5 | 이월 25를 최대값으로 오인 (실제 최악 60 + 217) | `CARRYOVER_QUEUE_MAX = 16` + 보스 피해 부채 전이 정책 |
| 6 | 전이 시 개체 제거 규칙 부재 → 중복 스폰 가능 | 전면 제거 + 신규 id 재생성 명시 |
| 7 | Echo Shard 110/스테이지가 성장 축을 1.4판에 소진 | 8/스테이지로 재조정, 세 축 19/63/95판 |
| 8 | 완주 판수를 내림 처리 | 올림 명시 (62 → 63) |
| 9 | 스폰→보스 거리를 아레나 코너 대각으로 오산 | 셀 중심 간 17088 (4.17 s) |
| 10 | **카메라 거리를 게임플레이 단위로 계산** | 렌더러 좌표계 실측, `zoomFactor` 20.8–41.5 |
| 11 | **`VISIBILITY_RADIUS = 9000` 구현 불가** (월드 z반경 21 > 평면 14) | 3000으로 정정, 패턴 치수 전면 축소 |
| 12 | NDC 검증이 안개를 무시 (빅웨이브 경계 선명도 0.38) | 스테이지×페이즈 절대 하한 + 정보 레이어 안개 면제 |
| 13 | 회피 소요 tick 내림 | `ceil` 명시 |

**10–12는 렌더러 소스를 읽지 않았으면 발견 못 했을 결함이다.** 설계 수치가 구현 좌표계와
분리되면 문서가 통과해도 코드가 불가능해진다.

---

## 2. 사이클 2 — director 리뷰 (완료)

| task | owner | 산출물 | 게이트 | 상태 |
|---|---|---|---|---|
| 액션 피벗 승인·범위 동결 | game-production-director | `production/decision-log.md#D-20260728-OAP-01` | 전체 | done — 설계 착수 승인, 게이트 통과 아님 |
| 제품 계약 SSOT 작성 | game-production-director | `design/onslaught-action-product-contract.md` | G1/G7 입력 | done — 제품 정의가 델타 문서에만 남지 않음 |
| 엔지니어링 결정 6건 확정 | game-production-director | `production/decision-log.md#엔지니어링-선택-확정` | G3/G6 입력 | done |
| 권위 수치 충돌 정정 | game-production-director | `design/encounter-wave-spec.md`, `design/master-gdd-delta.md`, `engineering/migration-map.md` | G2/G3 입력 | done |

### 2.1 director 결정 결과

- `D-20260728-OAP-01`은 Cinder Span 5–8분 세로 슬라이스의 **계획·구현 순서만** 승인한다.
- 동료는 자동 추종과 최종 보상 정예 추출만 유지하며, `FORMATION_STANCES`는 폐기한다.
- `layoutVersion` 불일치는 사용자 고지 후 해당 원정을 재시작하고, 기존 무효화 테스트는 대체 픽스처가 생긴 뒤에만 교체한다.
- README 공개 제품 설명은 슬라이스 2의 사람 플레이 판정 뒤에 갱신한다. 아직 구현되지 않은 목표를 현재 기능으로 표기하지 않는다.
- 모든 신규 수치와 설계는 `[TARGET]`이며, 기존 게이트를 PASS로 바꾸지 않는다.

---

## 3. 게이트 상태

| 게이트 | 이전 `[OBSERVED]` | 현재 | 사유 |
|---|---|---|---|
| G1 세계관 | PASS | **영향 없음** | 고유명·순서 유지, 전달 매체만 변경 |
| G2 밸런스 | FAIL | **재측정 필요** | 5–8분 밸런스는 27초 측정과 무관 |
| G3 편성 | FAIL | **재정의** | 스탠스 → 카테고리 로드아웃 |
| G4 몰입/접근성 | PASS (로비) | **재측정 필요** | HUD 전면 변경 |
| G5 | N/A | N/A | — |
| G6 운영/성능 | FAIL | **재측정 필요** | 빅웨이브 60체 × VFX |
| G7 코어 루프 | BLOCKED | **재정의** | 30–180 s → 300–480 s |
| G8 최초 노출 | BLOCKED | **재측정 필요** | 신규 조작 학습 곡선 |

**어떤 게이트도 이 사이클에서 PASS로 바뀌지 않았다.** 설계 문서는 측정이 아니다.

---

## 4. 증거 규칙

- 이 런의 모든 수치는 `[TARGET]`이다. 기존 `[OBSERVED]` 측정치를 새 목표로 재라벨하지 않는다.
- 시뮬레이션으로 검증한 표(빅웨이브 궤적, 전이 정책, 카메라 티어, 안개 선명도, 회피 여유,
  경제 곡선)는 **설계 산술의 내적 정합성**을 증명할 뿐, 게임이 재미있다는 증거가 아니다.
- 27초 오토배틀 측정치는 5–8분 액션 루프의 증거가 되지 않는다.
- 사람 플레이 판정 없이 G4/G7/G8을 PASS로 바꾸지 않는다.
- [OBSERVED] 이 세션의 `git status --short`는 Git이 아닌 실행 샌드박스에서 `fatal: not a git repository`로 차단됐다. 저장소 손상 증거가 아니다.
- 커밋 전에는 Git 실행이 가능한 환경에서 `git status --short`와 아래 변경 경로의 diff를 반드시 검토한다: `production/task-manifest.md`, `design/encounter-wave-spec.md`, `design/master-gdd-delta.md`, `engineering/migration-map.md`.

---

## 5. 다음 물리적 단계

1. `engineering/migration-map.md#9` 슬라이스 1(이동·카메라)과 `cam-*` 픽스처를 구현한다.
2. 슬라이스 2(전투 동사)와 `combat-*` 픽스처를 구현하고, 실제 브라우저에서 사람 플레이 판정을 받는다.
3. 손맛 판정이 통과할 때만 슬라이스 3–12를 문서 순서대로 진행한다. 통과 전 VFX·HUD·로비 구현은 시작하지 않는다.
4. 슬라이스 12 뒤 빅웨이브 성능, 전체 플레이 여정 QA, 배포 증명을 별도 실행한다.

---

## 6. 2026-07-28 — `_workspace/` 레이아웃 정규화

| task | owner | 산출물 | 게이트 | 상태 |
|---|---|---|---|---|
| 루트 날짜 폴더 위반 기록 | workspace-normalization | `production/workspace-normalization-20260728.md` | — | done — 기록 전용, 파일시스템·Git 변경 0건 |
| 아카이브 삭제 36개 복원 확인 | 부모 세션 (기록: workspace-normalization) | `archive/20260726-stage1b-cinder-pressure-agency/qa/browser-runtime-1440x900/` | — | done — [OBSERVED] 36개, 0바이트 0개, PNG 33/33·JSON 3/3 유효 |
| 루트 날짜 폴더 추적분 소유 레인 통합 | WorkspacePathMigration (기록: workspace-normalization) | `current/qa/`, `current/engineering/blender/textures/` | — | done — [OBSERVED] 비무시 14개 전부 이동, wellmade 폴더 소멸, 아카이브 245개 불변 |
| 생성물·후보 레인 미승격 유지 | 부모 세션 | — | — | done — [OBSERVED] 434개 중 420개가 `.gitignore` 선언 대상, 승격 영수증 0건 |

### 6.1 위반 수량 [OBSERVED]

- `_workspace/` 루트에 날짜 폴더 2개가 존재했다: `20260725-wellmade-verification`(파일 1개),
  `20260726-stage1b-cinder-pressure-agency`(파일 434개). CLAUDE.md §1은 `current/` 와
  `archive/<run-id>/` 만 허용한다.
- 루트 434개 ↔ 아카이브 245개 비교: 경로 겹침 **11**, 루트 전용 **423**, 아카이브 전용 **234**.
  겹침이 2.5%뿐이므로 루트는 아카이브의 사본이 아니다.
- 겹치는 11개는 SHA-256 **11/11 불일치**이며 루트가 더 최신이다
  (`generatedAt` 루트 2026-07-28T14:30:40Z vs 아카이브 2026-07-27T20:37:19Z).
- 루트 434개 중 **비무시 14개 / 무시 420개**. 승격 가능 판정은 0건 — §1이 요구하는
  provenance/rights/runtime receipt 가 어느 항목에도 없다.
- 복원된 36개는 ctime == mtime == **2026-07-29 00:58:44** 단일 초(신규 inode, 일괄 복사)이고
  같은 트리 나머지 209개는 2026-07-28 22:45 다. 삭제·복원이 실제로 일어나 완료됐다는 양성
  증거다. 단, 이 36개의 mtime 은 더 이상 출처 신호가 아니므로 이후 인용은 내용 해시로 한다.
- 정규화 종료 상태 [OBSERVED]: `20260725-wellmade-verification/` 소멸, `20260726-...` 루트는
  434 → **1개**(무시 대상 `.blend1` 잔존물), 아카이브는 **245개 불변**. 최신
  `qa/stage-runtime-proof/` 11개는 `current/qa/stage-runtime-proof/` 에 놓이고 아카이브 사본은
  `generatedAt` 2026-07-27T20:37:19Z 원본을 유지했다 — 덮어쓰기 없음, §1 불변성 충족.

### 6.2 재발 원인 — 코드가 위반을 재생성한다 [OBSERVED]

날짜 루트 경로를 참조하는 파일 **35개**(그중 생성 호출 포함 **22개**). 직접 생성이 확인된
6개 중 결정적인 둘:

- `tests/stage-runtime-proof-browser.test.mjs:26` 의 `OUTPUT_DIR` + `:350`
  `mkdir(recursive)` → `20260726-.../qa/stage-runtime-proof` 재생성. 루트 비무시 11개와 1:1 일치.
- `scripts/qa-motion-probe.mjs:19-21,179` → `20260725-.../qa/evidence/data/motion.json`.
  wellmade 폴더의 유일한 파일과 1:1 일치.

`scripts/audit-stage-scenes.mjs` 는 `:10` 에서 아카이브를 올바로 읽으면서 `:8` 은 날짜 루트에
쓴다. **폴더만 정리하면 다음 브라우저 테스트 실행에서 즉시 회귀한다** — 상수 수정이 선행
조건이다. 소스 수정은 부모 세션 소관이며 이 항목으로는 수행하지 않았다.

### 6.3 타 세션 작업 보존 [INFERENCE]

선행 세션의 슬라이스 2 전투 작업이 Git 인덱스에 스테이지된 상태로 남아 있다
(`app.js`, `defense-catalog.js`, `defense-run-simulation.js`, `battle-realtime-three.js`,
`stage-world-catalog.js`, 테스트 4개). CLAUDE.md §5는 흡수·폐기를 금지하므로 부모 세션은
**명시적 pathspec 만으로 커밋한다.** 정규화 작업이 이 경로들을 스테이징에 끌어들이지 않는다.

### 6.4 상시 규칙

`_workspace/` 직하위에는 `current/` 와 `archive/<run-id>/` 만 둔다. 산출물 경로는
`_workspace/current/<lane>/` 로 향하게 하고 날짜 run-id 를 코드 상수에 박지 않는다. 루트에
날짜 폴더가 보이면 지우기 전에 그것을 만든 상수를 먼저 찾는다.

---

## 7. 2026-07-29 — 캐릭터 모션 라이브러리 승격

| task | owner | 산출물 | 게이트 | 상태 |
|---|---|---|---|---|
| 모션 벤치·권리 receipt·registry 검증 | character-motion-pipeline | `assets/motion/ingame/characters/registry.json` | asset 11, clip 121, checksum·rights receipt 일치 | done |
| Lantern Reaver 원본·런타임 경로 확정 | game-programmer | `battle-realtime-three.js#PLAYER_SOURCE_MESH` | source mesh 1, runtime motion mesh 1 | done |
| 적 역할별 11클립 리타게팅 | character-motion-pipeline | `assets/motion/ingame/characters/*/model.glb` | 11 assets, 110 retargeted + 11 authored fallback clips | done |
| 보스 메시 직접 배치 | game-programmer | `battle-realtime-three.js#BOSS_MODELS` | Cinder Warden·Veil Tactician·Gate Sovereign 3/3 | done |
| GLB 구조·참조·runtime routing 계약 테스트 | Tester | `tests/runtime-visual-assets.test.mjs`, `tests/realtime-motion-routing.test.mjs` | runtime visual 6/6, motion routing 2/2 | done |
| Three.js 실전 로드·재생 스모크 | character-motion-pipeline | `qa/character-motion-runtime-smoke.json` | WebGL, HTTP 200, `guard::move::v01`, 48-frame bone delta | done |

### 7.1 산출물 상태 [OBSERVED]

- `registry.json`은 runtime-eligible asset **11**, clip **121**(retargeted 110,
  authored fallback 11), 총 **132,800,560 bytes**를 checksum과 권리 receipt로 고정한다.
- 런타임의 플레이어 원본 식별은
  `assets/mesh/character/lantern-reaver-character/glb/base_basic_pbr.glb`이며,
  애니메이션 렌더 경로는 `assets/motion/ingame/characters/lantern-reaver/model.glb`다.
- 일반 적은 `scout`, `shade`, `shadow-soldier-v04`, `possessed`의 4개 역할별 모션
  모델로 배치된다. 이 외 모션 GLB는 레지스트리에 보존되며 명시적 `motionAssetId`에서만 선택한다.
- 세 캠페인 보스는 `assets/mesh/boss/`의 공급 메시를 직접 로드한다. 일반 모션 레지스트리와
  혼합하지 않는다.
- self-authored 런타임 모델은 generic `unarmed-core.glb` overlay를 요청하지 않고 포함된
  base clip을 재생한다. 레거시 image battle GLB의 overlay 및 load-failure fallback은 폐기했다.

### 7.2 자원 컷오버 [OBSERVED]

- 현행 카탈로그는 `Cinder Span → Abyss Chancel → Echo Throne` 세 구역과 세 보스만 소유한다.
- 지형·소품·보스는 `assets/mesh/`, 모션·스테이지 VFX는 `assets/motion/`에서만 해석한다.
- `assets/images/battle/`은 UI만 남기며, 비 UI 전장 이미지와 GLB는 런타임 allowlist에서 제거했다.
- `tests/runtime-visual-assets.test.mjs`가 세 구역의 메쉬·VFX·Lantern Reaver lookout 계약과
  UI 외 이미지 배제를 검증한다.

---

### 7.3 자연 rest-pose 컷오버 [OBSERVED]

- 기존 T-pose bake는 융합된 망토·견갑·무기 지오메트리를 팔과 함께 벌려 고무처럼
  늘어나는 원인이었다. `scripts/rig-character-asset-blender.py`는 이제 source의
  `natural` bind pose를 기본값으로 보존하며, T-pose는 명시적 진단 모드에만 남긴다.
- 11/11 authoring `rig-report.json`은 `status: completed`, `restPose: natural`,
  `restPoseOk: true`, orphan vertex 0, 최대 influence 4를 기록한다. legacy `tposeOk`는
  모든 현재 report에서 제거됐다.
- 승격 generation은 `18f2f33f00b2825777fc9753c81281c2a5aee0bd9c97ad441bd11ba54fe53e7c`이며,
  browser 증거는 `_workspace/current/qa/natural-motion-runtime-smoke.json` 및
  `natural-motion-battle-browser.webp`에 있다. live battle canvas가 표시됐고 registry의
  11 model GLB는 모두 HTTP 200, 실제 전투는 commander/scout/shade/possessed motion
  model을 요청했다.
- 회귀 게이트: character library Node test 13/13, ingame motion pack 5/5,
  realtime routing 2/2, release closure 4/4. `build-character-motion-library-index.py
  --check`은 동일 generation/총 byte 수로 성공했다.
---

## Combat & Extraction Systems (Phase: engineering)

### Delivered Files

| File | Lane | Status |
|---|---|---|
| `engineering/enemy-grade-system.js` | engineering | delivered |
| `engineering/item-weapon-catalog.js` | engineering | delivered |
| `engineering/collision-system.js` | engineering | delivered |
| `engineering/extraction-system.js` | engineering | delivered |
| `engineering/equipment-database.js` | engineering | delivered |
| `engineering/leveling-system.js` | engineering | delivered |
| `design/combat-extraction-systems-design.md` | design | delivered |

### System Summary

- **적 등급 시스템**: BASIC/SHADOW/BOSS 3단계, 65% 스탯 편차, 등급별 절대적 수치 상승
- **무기/아이탬 시스템**: 근거리/중거리/원거리 범위공격 (논타겟팅), 12종 무기, AoE 패턴 5종
- **충돌 시스템**: 메쉬 오브젝트간 Sphere/Mesh 충돌처리, 고도 인식, 12-pass 분리
- **추출 시스템**: 적 사체 10초 유지 → 추출 채널링 2초 → 동료 소환 (보스 포함 모든 적 대상)
- **장비 DB**: 프롭 오브젝트 → 착용가능 아이탬, 15종 특성, 3종 세트 보너스, 적/보스/플레이어/동료 모두 착용
- **레벨링 시스템**: 동료/장비 레벨업, 등급 조합 (3개 합성 → 상위등급), 장비 강화 (성공률 체계)

### Deferred work (not part of the verified §8 runtime slice)

- [ ] Integration into defense-run-simulation.js tick loop
- [ ] Three.js renderer support for extraction VFX, equipment attachment
- [ ] Blender MCP pipeline for individual mesh rigging & attachment points
- [ ] Test coverage for all new systems
- [ ] Balance pass with QA simulation
- [ ] webtoon-harness 캐릭터 특성 연동

---
## 8. 2026-07-29 — 자연 관절 모션·3스테이지 런타임 통합

| task | owner | 산출물 | 게이트 | 상태 |
|---|---|---|---|---|
| 자연 rest-pose 기반 semantic rig 재빌드 | character-motion-pipeline | `assets/motion/ingame/characters/*/model.glb`, `registry.json` | asset 11, clip 121, library test 15/15 | done |
| 인접 관절 weight repair·변형 계측 | Blender technical animation | `motion-bench/joint-weight-repair-gate.json`, `joint-articulation-report.json` | joint gate 11/11, MCP 24 DEF bones·9 split meshes | done |
| runtime action·facing·카메라 전환 | game-programmer | `battle-realtime-three.js` | focused integration 78/78 | done |
| 전투·목표·보스·추출 음향 정책 | game-audio | `defense-audio.js`, `battle-visualizer.js`, `defense-catalog.js` | audio/cutscene test 13/13 | done |
| Cinder/Chancel/Throne 개별 소품·route·objective | level-designer | `stage-world-catalog.js` | movement 11/11, route contract 12/12 | done |
| corridor wave·실패/회복/재시도·보상 멱등성 | game-programmer | `defense-run-simulation.js`, `defense-catalog.js` | stage contract 12/12 | done |
| 세 스테이지 시놉시스·연출 handoff | narrative director | `design/abyssal-lantern-world-synopsis.md` | stage order 3, dialogue 5/5/6, gameplay links | done |
| 로비·가이드·전투 HUD 접근성 회귀 | UI/UX | `app.js`, `styles.css` | focused integration 78/78 | done |
| real-WebGL 3스테이지 proof | QA | `qa/stage-runtime-proof/` | isolated canonical stages 3/3 | done |
| 최종 개선 실행 프롬프트 | prompt editor | `design/abyssal-lantern-final-development-prompt.md` | prompts.chat 구조·runtime/narrative 독립 재검토 PASS | done |

### 8.1 이번 사이클의 [OBSERVED] 기준선

- `build-character-motion-library-index.py --check`:
  generation `b0178e95651a0b29beffe28d8006d9c5cb2cb6ce7c6a00ebec36e4e7108529be`,
  asset **11**, clip **121**, **133,242,428 bytes**.
- Blender MCP의 Lantern Reaver 장면은 armature **1**, DEF bone **24**, 분리 mesh part **9**,
  semantic action **11**을 노출했고 모든 mesh가 같은 armature modifier에 바인딩됐다.
- `gate-joint-weight-repair.py --check`는 11개 asset 전부 PASS했다. 이 판정은 해당 gate의
  허용치를 만족했다는 뜻이며, 사람 눈으로 모든 동작이 완벽하다는 뜻이 아니다.
- focused runtime 통합은 test **78/78**, character-motion 묶음은 **15/15**,
  real-WebGL stage proof는 canonical stage **3/3**을 통과했다.
- Cinder obstacle 재배치 중 companion RETURN deadlock이 한 차례 재현됐고,
  겹치는 clearance circle을 제거한 뒤 movement contract **11/11**로 회귀를 닫았다.
- **로비 미니맵**: Cinder→Chancel→Throne 순서의 3-node 진행형 route이며, 새 캠페인은
  Cinder 한 node만 노출한다. `app.js#renderSortieTabBody`, `stage-world-catalog.js#STAGE_SHOWCASE_IDS`.
- **카메라**: commander를 고정 초점으로 삼고, lobby `distanceScale`을 renderer 수동 zoom의
  합법 범위인 `0.9–1.1` 안에서 순환시킨다. reduced-motion은 정적 `1.0`이다.
  `lobby-cinematic.js#showcaseCamera`, `app.js#applyShowcaseCamera`.
- **지형**: 세 stage 모두 `terrainGlbPath: null`, provenance용
  `terrainSourceCandidatePath` 유지, runtime은 `procedural-flat-support`를 사용한다.
  props·obstacles·route anchors는 gameplay elevation 0 검증을 통과한다.
- **소품**: stage당 8–14개의 sparse retained mesh placement를 사용하며 모두 기본 평면 위에
  ground된다. `stage-world-catalog.js#STAGE_WORLD_PROFILES`.
- **픽업**: `run.pickups`가 authority다. renderer는 item을 prop `.03`, 그 외 collectible을
  prop `.05`로 표시하고 snapshot을 변경하지 않는다. `battle-realtime-three.js#PROP_MODELS`.
- **VFX**: melee/projectile/skill impact와 commander/companion damage를 transient pool
  24개로 제한하며, cold-load 중에도 boss telegraph를 우선 수용한다.
- **오디오**: `defense-audio.js#AUDIO_EVENT_POLICY`가 event priority, voice cap, mute,
  pause/resume을 소유하고 `debugMetrics()`로 node/voice 수를 노출한다.
- **브라우저 증거** [OBSERVED]:
  - Desktop `1440×900`: WebGL, minimap node 3개/초기 reveal 1개, console error 0.
  - Mobile `390×844`: horizontal overflow 0, WebGL, minimap node 3개.
  - final real-WebGL stage proof: canonical stage **3/3**, prop mesh integrity·grounding PASS.
- **자동 회귀** [OBSERVED]: `node --test 'tests/**/*.test.mjs'`는 tests **469**,
  pass **444**, fail **0**, skip **25**를 기록했다. skip은 기존 historical/fixture-gated
  lane이며 이번 변경을 우회하도록 새로 추가하지 않았다.

### 8.2 게이트 해석

- 위 자동화 증거는 asset/runtime/route/browser 로딩 계약을 증명한다.
- 사람 플레이 관찰 없이 손맛·장기 몰입·G4/G7/G8을 PASS로 승격하지 않는다.
- final prompt의 다음 개선 실행은 이 기준선을 다시 측정해야 하며 과거 PASS를 새 변경의
  증거로 재사용하지 않는다.
- **남은 게이트**: G4 몰입/접근성, G7 코어 루프, G8 최초 노출 모두 **재측정 필요** (사람 플레이).
- **배포**: push와 Pages production smoke는 아직 미측정이다.

## 9. 2026-07-30 — 3스테이지 스토리 퀘스트·성장·모바일·오디오 확장

### 9.1 구현된 계약

- **스토리/퀘스트**: Cinder Span → Abyss Chancel → Echo Throne 각 스테이지는 퀘스트 NPC,
  정확히 4개의 순차 목표, 전용 반전·보스 진입·결말을 갖는다.
- **보상/성장**: 최초 클리어의 추출 스킬과 외형 장비는 중복 없이 저장되며, 장착·해제와
  스킬 Lv.1→5 강화 비용은 `campaign-state.js` 한 곳에서 검증한다.
- **월드/프레젠테이션**: 네 퀘스트 지점은 스토리 목표 이벤트와 1:1로 결속되고,
  보스 등장 VFX는 지점 대체물이 아니라 실제 보스 엔티티에 고정된다.
- **모션**: 3스테이지 12개 스토리 비트는 검증된 11-action 라이브러리의
  `show`/`defence`/`bighit`에 매핑되며 새 모션·이미지 재생성은 필요하지 않다.
- **오디오**: 같은 프레임의 전투·스토리 이벤트는 한 배치로 우선순위를 결정하고,
  브라우저 기본 음성 큐가 여러 스토리 대사를 순서대로 한 번씩 재생한다. 스테이지 재마운트는
  실행별 중복 제거·tick·refractory 상태만 초기화하고 음량·음소거·지속 사운드스케이프는 보존한다.
- **모바일**: 기존 5개 키보드/버튼 입력은 유지하고 coarse pointer 가로 모드에만
  8방향 드래그 조이스틱을 추가한다. 취소·포인터 손실·방향 전환은 모두 `IDLE`로 수렴한다.
- **보존 계약**: 기존 출전 미니맵, 로비 카메라 연출, 넓은 단일 평면,
  mesh-collider·grounding·prop pickup·VFX cap 계약은 유지한다.

### 9.2 현재 권위 문서와 증거

- 개발 프롬프트: `design/abyssal-lantern-final-development-prompt.md` §I
- 런타임 매핑: `design/QUEST_RUNTIME_MAPPING.md`
- 모션 청사진: `design/MOTION_SYSTEM_EXPANSION_BLUEPRINT.md`
- 퀘스트 모션 프리비스:
  `engineering/asset-pipeline/motion-previs/quest-beat-previs.json`
- 스테이지 에피소드:
  `design/cinder-span-episode-scenario.md`,
  `design/abyss-chancel-stage-episode.md`,
  `design/echo-throne-stage3-final-episode.md`
- 집중 회귀 [OBSERVED]:
  - quest/world/VFX/appearance: **32/32 PASS**
  - audio lifecycle + remount integration: **25/25 PASS** (`17 + 8`)
  - 모바일·HUD 브라우저 3개 스위트: **17/17 PASS**
  - 실제 브라우저: Cinder Span `STAGE_STARTED`, EMBER LOOKOUT 정확 화자 대사,
    console error **0**, page error **0**
- 독립 코드 리뷰 [OBSERVED]: P0 **0**, P1 **0**, **APPROVE**
- 전체 Node 회귀: `node --test 'tests/**/*.test.mjs'`는 로컬 병렬 실행이 완료 요약 없이 종료되어 **[BLOCKED]**다. 세 번의 시도 모두 `# fail 0` 종결 블록을 만들지 못했으므로 PASS로 계산하지 않는다.
- Pages/PR 동등 릴리스 게이트 [OBSERVED]:
  - engine contract: **61/61 PASS**
  - release closure·서비스워커·패키지 계약: **4/4 PASS**
  - character rig + merge decision: **36/36 PASS**
  - workflow browser allowlist: **5/5 exit code 0**, progression **4/4 PASS**, phone HUD **12/12 PASS**

### 9.3 릴리스 게이트

- 구현 commit SHA / remote branch: `b29f54b846e2f54938a6fc4eda4a2eaff72da1d1` / `origin/main`
- GitHub Pages workflow: run `30512950567` **SUCCESS** — `https://github.com/jellyggumi/Abyssal-Lantern/actions/runs/30512950567`
- Production: `https://jellyggumi.github.io/Abyssal-Lantern/`; `version.json.candidate_sha`가 구현 SHA와 일치한다. 배포 로비 smoke는 미니맵 노드 **3**, Canvas **1**, horizontal overflow **0**, console error **0**, page error **0**을 기록했다.

---

## 10. 2026-07-30 — 사이클 10: 스테이지 던전 구성

run-id: `20260728-onslaught-action-pivot` · cycle 10
branch: `feat/cycle10-stage-dungeon` · worktree `/Users/jangyoung/orca/Abyssal-Surge-dungeon` · base `033877ad`
operating mode: Stage 1 재진입 — 3스테이지 던전 콘텐츠·자산 구축

### 10.1 동시 세션 경계 [OBSERVED]

타 세션이 cycle 9(코어 루프·컨트롤 감각)를 **공유 워크트리에서 구현 중**이며, 이 사이클이
건드리는 모든 파일에 미커밋 변경이 있었다: `app.js`, `battle-realtime-three.js`,
`defense-audio.js`, `defense-catalog.js`, `defense-run-simulation.js`, `campaign-state.js`.
`defense-run-simulation.js`는 세션 중 3571 → 4002행으로 자랐다.

CLAUDE.md §5에 따라 격리 워크트리에서 작업했다. `core-loop-legion-spec.md`는 **그들의
cycle 9 스펙이며 이미 그들 쪽에 구현되어 있다** — 그들의 `defense-catalog.js`(1025행)가
`AIM_BIAS_BP`, `EXTRACTION*`, `COMPANION_SLOT_UNLOCKS`를 그 스펙을 인용하며 노출한다.
범위 밖으로 명시했다(ruling R27).

### 10.2 작업과 산출물

| task | owner | 산출물 | 게이트 | 상태 |
|---|---|---|---|---|
| 런타임 5개 표면 지도 | explore ×6 | `engineering/runtime-surface-maps/` 6개 | — | done |
| 프로덕션 브리프·범위 경계 | game-production-director | `intake/production-brief-cycle10-stage-dungeon.md` | 전체 | done |
| 던전 슬랩·경로·기믹 설계 | level-designer | `design/stage-dungeon-composition-spec.md` (1197행) | G1/G7 입력 | done |
| 5–15분 페이싱 설계 | game-designer | `design/stage-pacing-5to15min-spec.md` (996행) | G2/G7 입력 | done |
| 드롭·시한 버프 설계 | systems-designer | `design/item-drop-timed-buff-spec.md` (1256행) | G2 입력 | done |
| VFX 큐 설계 | vfx-designer | `design/vfx-drop-spawn-terrain-spec.md` (1250행) | G4/G6 입력 | done |
| 오디오·BGM 설계 | game-audio | `design/audio-feedback-dungeon-spec.md` (1426행) | G4 입력 | done |
| HUD·조이스틱 설계 | ui-senior-developer | `ui/hud-overhaul-joystick-cutover-spec.md` (984행) | G4/G8 입력 | done |
| 플레이트 → 탑다운 타일 역투영 | asset-pipeline | `engineering/asset-pipeline/terrain-dungeon/deproject-terrain-plate.py` | — | done — 시임 0.0000 |
| 슬랩 조합 바닥 빌더 | asset-pipeline | `.../build-dungeon-floor-blender.py` | G6 입력 | done — fit 1.000000 |
| 3스테이지 바닥 빌드·승격 | asset-pipeline | `assets/mesh/terrain/*/runtime/terrain/*-floor.glb` + provenance | — | done |
| 카탈로그 지형 승격 3필드 | game-programmer | `stage-world-catalog.js` | G6 입력 | done — 검증기 green |
| 자산 allowlist 4곳 동기 | game-programmer | `defense-runtime-assets.mjs`, `pages-artifact-smoke.cjs`, `static.yml` | — | done (지형만) |
| 지형 계약 테스트 반전 | Tester | 3개 테스트 파일 | — | done — 22/22 |
| 드롭·버프 시뮬레이션 | game-programmer | `defense-catalog.js`, `defense-run-simulation.js` | G2 입력 | in flight |
| 렌더러 앵커 수정·VFX | game-programmer | `battle-realtime-three.js` | G4/G6 입력 | in flight |
| 조이스틱 컷오버·HUD | ui-senior-developer | `app.js`, `styles.css` | G4/G8 입력 | in flight |
| 오디오 발소리·큐·BGM | game-audio | `defense-audio.js` | G4 입력 | in flight |

### 10.3 측정된 증거 [OBSERVED]

- 역투영 시임 오차: 블렌드 후 3/3 타일 **0.0000 / 0.0000**. JPEG q88은 이를 1.3792로
  파괴하므로 PNG + 업스트림 리사이즈를 쓴다.
- `fitFootprint` 스케일 **1.000000** (3/3). 에이프런이 큰 축을 정확히 32.2로 맞춘다.
- 보행 가능 월드 경계 == `worldPointInto(bounds)` **소수 3자리까지 일치** (3/3, 양축).
- 보행 슬랩 수직 범위 **0** (에이프런만 −0.002). 슬랩 3/4/5개.
- GLB 로드 **30–40 ms**, 실제 `vendor/loaders/GLTFLoader.js` 경유.
- 브라우저 증거 `qa/cycle10-terrain-proof/`: WebGL 2.0, 1440×900, console error **0**,
  page error **0**, horizontal overflow **0**.
- 지형 계약 테스트 **22/22 PASS**. 사전 베이스라인 `qa/cycle10-baseline.md`는 동일
  4파일에서 **28/28 PASS, 36.0초**.

### 10.4 측정되지 않은 것

- **전체 스위트 베이스라인이 없다.** 4회 시도 전부 종료·무효화됐다(러너 4중 중첩,
  load 101–121). 파일 단위 베이스라인만 존재한다.
- 5–15분 실플레이 시간 미측정. 페이싱 델타는 미구현이며, 측정 하네스 자체가 두 상수
  때문에 목표 구간을 판정할 수 없다.
- 드로우콜·프레임 예산 델타 미측정.
- 사람 플레이 판정 없음 → G4/G7/G8 불변.

### 10.5 다음 사이클 진입

Stage 2(밸런스·코어 루프 안정화). 회고
`retrospectives/cycle-10-retrospective.md` §6에 의존 순서가 있다.

---

## 11. 2026-07-30 — 광역 전투 모델·공격 패턴 프리셋·AI 대응·보스 등장씬

세션 브랜치: `feat/motion-vfx-aoe-boss` → PR #11 → `main` `9562943b`.
동시 세션이 `defense-catalog.js` / `defense-run-simulation.js` / `battle-realtime-three.js` /
`app.js`를 편집 중이었으므로 `CLAUDE.md` §5에 따라 격리 워크트리
(`/Users/jangyoung/orca/Abyssal-Surge-motion`)에서 작업했고, 공유 워크트리는 건드리지 않았다.

### 11.1 구현된 계약

**광역 전투(모든 공격·피격은 광역).** `defense-catalog.js`가 네 개의 정수 basis-point 인자를
저작한다: 거리 감쇠 × 소스 가중치 × 속성 상성 × 지속시간.

```
share = areaFalloffBp(distance, radius)
      x weightBp(source)
      x elementMatchupBp(attacker, defender)
      x areaSustainBp(durationTicks)
```

- `resolveAreaImpact()`가 유일한 권위다. 근접 스윕, 이동 오브, 적 포탄, 스킬, 적 타격, 보스
  슬램이 모두 이 경로를 통과하며 1차 대상은 항상 제외된다(이중 피해 불가).
- 잔류 장판(`AREA_FIELD_STARTED/_PULSE/_ENDED`)은 저작된 주기로만 맥동하고, 개수 상한이
  있으며, 스냅샷에 공개되고, 항상 명시적으로 회수된다.
- `ATTACK_PATTERNS`: 모든 적 아키타입과 3보스에 대해 telegraph → active → recovery 3단계
  스텝의 순환 시퀀스. 순수 함수 `samplePattern(patternId, elapsed)`로 어떤 위상도 재현 가능.
- `AI_RESPONSE_PATTERNS`: evade / spread / brace / punish. 각각 시뮬레이션이 실제로 읽는
  유한 윈도(대형 앵커, 피해 지분, 아군 사격 주기).
- `MONSTER_STATES`: 바디당 하나의 의미 상태(build-game-monster-system의 runtime→view 이음매).
- `BOSS_SPAWNED`가 3초(180틱) 등장 윈도를 저작해 실어 보낸다.

**연출.** 피격체는 피격 플래시 동안 반투명 점멸(사각파)한다 — 1차·광역 대상 동일. 재질의
사전 알파는 1회 캡처 후 항상 복원되며, reduced motion은 점멸 없이 반투명만 유지한다.
지면 링은 절차적 생성이다: 광역 임팩트 / 텔레그래프(채워지는 시간 = 윈드업) / 잔류 장판 /
지휘관 상시 사거리 링. 보스 등장은 기본 팔로우캠 위에 얹히는 카메라 푸시 + 비차단 3초 자막
밴드이며 전투를 멈추지 않는다. 투명 VFX 예산 24 → 40(상수를 export해 계약 테스트가 리터럴
대신 저작값을 검증).

**비례.** 컴패니언 실루엣 1.3 → 1.45. 근거는 디코딩된 레퍼런스 캡처
(`intake/reference-video-analysis.md` §3): 군단 유닛은 플레이어와 같은 스케일로 읽히고 색으로
구분된다. 지휘관 1.55는 SKIRMISH 티어에서 화면 높이의 7.8%로 레퍼런스 대역(≈6.8%) 안에 있어
확대하지 않았다.

### 11.2 발견·수정한 결함 [OBSERVED]

1. **성장 선택 이벤트 소실.** `advanceDefenseRun()`이 성장 오퍼 입력을 `tick()` 이전에 처리하고,
   `tick()`은 `run.events = []`로 시작한다. ward-binder의 +120 integrity/maxIntegrity는 적용되는데
   `SKILL_SELECTED` 이벤트는 지워져, 어떤 관측자도 설명할 수 없는 델타가 남았다. 선택 이벤트를
   리셋 너머로 이월한다(자체 eventSequence 유지 → 스트림 순서 불변).
2. **wardens-vigil 재생이 무이벤트.** `WARDENS_VIGIL_REGEN`을 발행하도록 수정.
3. **PR guard의 jq 파싱 중단.** 브라우저 게이트가 원시 stdout을 `results/*.json`으로 썼고
   `progression-mobile-ui-browser.cjs`는 TAP을 출력한다. Decide 단계의 `jq -sc ... results/*.json`이
   `1..N` 줄에서 "Invalid numeric literal"로 전체 스윕을 실패시켰다. 전사는
   `results/browser/*.txt`로 분리.

### 11.3 증거 [OBSERVED]

- `tests/area-combat-model.test.mjs`(신규) **19/19 PASS** — 인자 수학, 모든 패턴의 위상 경계,
  actionId 유지/갱신, 응답 윈도 상한, 라이브 광역 구조, 속성별 거리 단조성, 장판 주기·만료,
  digest 결정성, 몬스터 상태 계약.
- `defense-run-simulation` + `-rpg` + `companion-autonomy` + `combat-presentation-contract`
  **87/87 PASS**; `defense-renderer-contract` **22/22 PASS**;
  `defense-campaign-adapter` + `defense-asset-manifest` + `no-rts-closure` + `release-closure`
  **16/16 PASS**; stage1b pressure·persistence·evidence exporters **PASS**(관측성 수정 이후).
- `node scripts/run-defense-balance-sim.mjs --strict` → `"pass": true`, `"failures": []`.
- 브라우저 5종 로컬 **exit 0**: survivor `"pass": true`/`errors: []`, performance
  `rafMeanMs 16.94`/`failures: []`, hud-responsive, phone-battle-hud, progression-mobile-ui.
- CI(병합 결과 기준) 릴리스 파이프라인 run `30568810321` **전 게이트 SUCCESS**:
  resolve_revision · release_closure · engine_contract · browser_contract · package_pages ·
  artifact_smoke · deploy_pages · deployed_smoke · release_receipt.
- 배포 검증: `https://jellyggumi.github.io/Abyssal-Lantern/version.json` =
  `{"candidate_sha":"9562943b2ba22617916be0fe799edc956c68466c","rules_version":"defense-survivor-v1"}`.
  로컬에서 실행한 `tests/deployed-defense-smoke.cjs`도 라이브 URL 대상 `"pass": true`,
  `errors: []`(390×844, 844×390).
- 전체 Node 회귀(`node --test 'tests/**/*.test.mjs'`)는 §9.2와 동일하게 로컬에서 완료 요약을
  만들지 못했다 — 이번에도 PASS로 계산하지 않는다 [BLOCKED].

### 11.4 모션 팩 재타깃 [OBSERVED · 완료]

`assets/motion/ingame/unarmed-core.glb` 9클립 → **21클립**(189 KB → 495 KB), `main` `e4775b5c`.

- 기존 9개(idle/move/run/hit/bighit/attack/critical/avoid/defence)는 소스 무변경 — 어떤 리그도
  기존 모션을 잃거나 바꾸지 않는다. 추가분: 방향별 `hit_front/back/left/right`,
  `bighit_front/back/left/right`, `attack_melee`, `attack_ranged`, `die`, `show`.
- 런타임 변경 0줄. 오버레이 액션 키는 팩의 클립 이름(`unarmed-core::<action>::v01`)에서 읽고
  `RIG_ACTION_KEYS`로 승인되므로, 팩이 커지면 라우팅이 그대로 켜진다. 잠들어 있던
  `hitReactionKey()` 방향 분기가 24개 호환 리그 전부에서 처음으로 실제 클립을 얻었다.
- 관측 감사 66/66. 2026-07-29의 42개 코퍼스는 그대로 두고, 이후 추가된 24개만 동일 스크립트로
  심볼릭 링크 디렉터리에서 관측(`--expect-count 24`)해 병합했다. 양쪽 모두 실제 Blender 임포트다.
  (전체 66개 단일 실행은 부하 상태에서 특정 파일에 걸려 진행되지 않아 중단했다.)
- 레퍼런스 리그는 `assets/motion/ingame/characters/human-command-boss/model.glb`(지휘관의 실제
  런타임 리그). 스크립트의 옛 기본값 `assets/images/battle/glb/commander/dusk-warden.glb`는
  폐기된 GLB 레인과 함께 사라졌다.
- 팩 클립 수 게이트는 `CLIPS`에서 파생하도록 바꿔, 로스터가 바뀌어도 클립이 빠진 팩을 통과시킬 수 없다.
- 테스트는 오버레이 로스터를 배포된 매니페스트에서 읽는다 — "팩이 싣는 것은 오버레이, 나머지는
  리그 자체"라는 실제 규칙을 검증한다.
- 증거: 모션/라우팅/오버레이 QA/렌더러/자산 매니페스트/리그 계약/승격 자산 **51개 중 47 PASS,
  0 FAIL**(4 SKIP); engine contract 세트 **61/61**; `defense-survivor-browser` `"pass": true`;
  자산 매니페스트 재생성 diff 없음. 릴리스 run `30574564581` 전 게이트 SUCCESS.
- 배포 확인: 라이브 팩 21클립/495 072 B, 라이브 매니페스트 override 21개,
  `version.json.candidate_sha` = `e4775b5c9943394a1ad5c8bc193a6f4399c43115`,
  로컬 실행 `deployed-defense-smoke` `"pass": true`, `errors: []`.

### 11.5 남은 작업
- 텍스트-투-모션 생성 경로(MDM/T2M-GPT)는 실행하지 않았다. 프롬프트 템플릿은
  `wiki/concepts/motion-generation-for-runtime-rigs.md` §4에 있고, 산출물은 `CLAUDE.md` §3의
  provenance/감사 게이트를 통과해야 런타임에서 참조할 수 있다.
