# Context: Abyssal Surge / abbysal-oneline

## Workflow Context
[OBSERVED] 이 저장소의 시뮬레이션은 renderer와 분리되어야 한다. stage map은 runtime 절차 생성물이 아니라 seed·좌표·검증을 갖는 코드 계약이고, renderer는 snapshot을 읽기만 한다 (`wiki/concepts/stage-map-composition-pipeline.md`). [DECISION] layout PCG는 **offline authoring only**다: `layoutSeed`와 `generatorVersion`이 proposal을 만들고, 사람이 route/clearance/camera/objective를 검증·curate한 뒤 static `stage-world-catalog` profile로 commit한다. runtime은 vetted `profileId`와 profile-content hash를 읽기만 하며, `encounterSeed`로 legal authored encounter variant만 선택한다. runtime layout·loot generation과 presentation write-back은 금지한다.

Survivor.io는 공식 Google Play 설명에서 one-hand control, stage-specific difficulty, 대규모 horde를 내세우고, Vampire Survivors는 최소 조작·roguelite 성장·나중에 회수 가능한 pickup을 강조한다. 이는 압박·회복·성장 비교군이지 이 프로젝트의 입력 모델은 아니다. [OBSERVED] Abyssal Surge 제품 계약은 자동전투가 아니라 명시적 `LIGHT_1 → LIGHT_2 → LIGHT_3`, `HEAVY`, `DASH`의 직접 전투를 요구한다 (`design/onslaught-action-product-contract.md#39-44,66-74`). `direct page retrieval`: https://play.google.com/store/apps/details?id=com.dxx.firenow ; https://store.steampowered.com/app/1794680/Vampire_Survivors/

[TARGET] 범위가 all-and-only `cinder-span` → `abyss-chancel` → `echo-throne`이면 gameplay clock은 `cinder-span`의 first controllable simulation tick에서 `echo-throne` final objective resolution tick까지이며 pause·modal/loading transition은 제외한다. 각 Stage의 계획 band 300–480초와 기준 360초를 합치면 세 Stage 캠페인의 계획 band는 **900–1440초, 기준 1080초**다. Stage가 band를 넘으면 Stage별 540초 hard ceiling에서 보스를 건너뛰지 않는 강제 종막으로 끝나므로 절대 최대는 1620초다 (`design/master-numeric-contract.md#17-19`). 600초는 사용자가 요구한 10분 하한을 충족할 수는 있어도 이 세 Stage 범위의 계약값이 아니다. 각 hurdle은 한 가지 새로운 위치 질문(전후 압박, 좁은 탈출구, 지연 AoE, pickup 위험)을 내고, 이후 플레이어가 방향을 재정렬하고 성장 효과를 체감할 회복 창을 제공한다.

## Affected Users
| Role | Responsibility | Skill Level |
|------|----------------|-------------|
| 모바일/신규 플레이어 | 한 손 이동으로 horde와 telegraph를 읽고 build를 선택 | 입문–중급 |
| 키보드·패드·터치 플레이어 | 서로 다른 조작 정밀도로 같은 encounter를 통과 | 입문–고급 |
| 숙련 roguelite 플레이어 | 시너지·route·risk를 최적화해 Stage 3 hurdle을 돌파 | 고급 |
| 디자이너/밸런서 | seed·build·입력 cohort별 pressure를 진단 | 전문 |
| 2D 자산 제작자 | actor, shadow, telegraph, pickup, foreground의 가독성 계층 유지 | 전문 |

Xbox Accessibility Guidelines는 디자인·개발·테스트 전체에서 접근성을 다룬다. 따라서 위험은 색상·미세 애니메이션·사운드 하나에만 의존하면 안 된다. `direct page retrieval`: https://learn.microsoft.com/en-us/xbox/accessibility/guidelines

## Current Workarounds
1. [OBSERVED] 현 난이도 계약은 HP multiplier가 아니라 clear budget, response type, class rotation, density/concurrency를 분리한다. 그러나 simultaneous telegraph area를 직접 제한하지 않고 concurrency ceiling을 proxy로 쓴다 (`wiki/concepts/stage-difficulty-and-system-variation.md`).
2. 플레이어는 pickup이 사라지지 않는 규칙을 이용해 즉시 회수보다 안전한 kiting route를 택한다. 이는 위치 선택의 실제 workaround다. `direct page retrieval`: Vampire Survivors Steam starting tip.
3. 이미지 기반 렌더링은 불투명 silhouette과 blended art를 분리해야 한다. Three.js는 transparent surface의 정렬 한계와 alpha-test/manual split을 설명한다. `direct page retrieval`: https://threejs.org/manual/en/transparency.html
4. 반복되는 장식물은 `InstancedMesh` 또는 atlas로 batch할 수 있으나, 개별 telegraph/hit shape의 의미를 instance 최적화에 숨기면 안 된다. `direct page retrieval`: https://threejs.org/docs/pages/InstancedMesh.html ; https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices

## Adjacent Problems
- [OBSERVED] Pages runtime resource는 `scripts/defense-runtime-assets.mjs`, `assets/defense-asset-manifest.json`, `.github/workflows/static.yml`, `sw.js`의 네 allowlist가 일치해야 한다 (`README.md#154-157`). [TARGET] 새 2D resource는 generated candidate→rights/provenance receipt→four-allowlist promotion을 거친 승인본만 deploy한다.
- [TARGET] transparent billboard, VFX, foreground decoration이 fair telegraph를 가리는 경우는 난이도가 아니라 readability defect로 기록한다.
- [TARGET] offline generator는 player start lane·egress width·spawn affordance를 위반하는 proposal을 reject한다. curator가 static profile로 전사하기 전에는 runtime에 들어갈 수 없다. art가 collision을 결정해서는 안 된다.
- [TARGET] 조작 방식별 reversal time·collision·escape 성공률을 따로 본다. 한 입력의 보정 실패가 난이도 증가로 오판되면 안 된다.

## User Voices
- "The horde far outnumbers you"와 "one-hand controls" — Survivor.io 공식 제품 설명. `direct page retrieval`: Google Play listing.
- "Take your time to grab gems and items, they won't disappear." — Vampire Survivors 공식 starting tip. `direct page retrieval`: Steam listing.
- "The gameplay does get a little repetitive ... because you level up all the weapons really quickly." — cadence/diversity 검증 가설일 뿐 유병률 근거가 아니다. `thin evidence`: Google Play user review.
- "endless combos, and challenges to keep you on your toes" — visible power growth와 positional demand를 함께 검증할 가설일 뿐 유병률 근거가 아니다. `thin evidence`: Google Play user review.
