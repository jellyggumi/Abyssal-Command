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

### 8.2 게이트 해석

- 위 자동화 증거는 asset/runtime/route/browser 로딩 계약을 증명한다.
- 사람 플레이 관찰 없이 손맛·장기 몰입·G4/G7/G8을 PASS로 승격하지 않는다.
- final prompt의 다음 개선 실행은 이 기준선을 다시 측정해야 하며 과거 PASS를 새 변경의
  증거로 재사용하지 않는다.
