# Superseded Stage Composition Map — pre-three-stage catalog

> **Historical evidence only — superseded 2026-07-29.** This map records the removed
> ten-stage image-backed catalog and must not guide implementation or gate measurement.
> The active authority is `defense-catalog.js` plus
> `design/{pcg-stage-layout-spec,boss-pattern-spec,camera-vfx-direction}.md`; it defines
> only `Cinder Span → Abyss Chancel → Echo Throne`, mesh terrain, three boss meshes, and
> UI-only battle images. The evidence below remains unchanged for traceability.

```yaml
run_id: 20260728-onslaught-action-pivot
status: "[HISTORICAL] — measurement of superseded ten-stage catalog/disk state"
owner_skill: author-game-levels
scope: archived pre-cutover stages 2–10 evidence; not an active level specification
baseline: historical pre-cutover Cinder Span audit only
sources:
  - superseded catalog, world profiles, and runtime asset registry
```

---

## 0. 방법과 증거 규칙

이 문서의 모든 수치는 **출하된 데이터를 로드해 계산**한 값이다 `[OBSERVED]`. 채택한 절차:

1. `defense-catalog.js` / `stage-world-catalog.js` 를 Node ESM 으로 import 해 `STAGES`,
   `STAGE_PRESENTATION_BY_ID`, `CUTSCENES`, `STAGE_WAVE_DOCTRINE`, `STAGE_TACTICS`,
   `STAGE_WORLD_PROFILES` 를 **원본 객체 그대로** 읽었다.
2. 자산 존재 여부는 전부 `fs.existsSync(<repo-relative path>)` 결과다. 디렉터리 목록 추정이 아니다.
3. 런타임 경로는 `battle-realtime-three.js:121` `MODEL_ROOT` + `BOSS_MODELS`(`:127-138`) /
   `COMPANION_MODELS`(`:152-162`), `app.js:235-238` `stageArtPath()` 를 따라 **코드가 실제로 조립하는
   문자열**을 재현한 것이다.
4. 팔레트 id, `patternId`, `mapLabels`, 컷신 대사는 카탈로그 객체에서 **직렬화해 옮겼다**. 손으로 옮겨 적지 않았다.

범례: `[OBSERVED]` 측정/관측 · `[INFERENCE]` 관측에서 도출한 추론 · `[TARGET]` 미달성 설계 목표.

### 0.1 브리핑 용어 정정 — `xpTarget` 은 존재하지 않는다

작업 지시는 스테이지 행의 4번째 값을 `xpTarget` 이라 불렀다. **저장소 전체에 `xpTarget` 식별자는 0건이다**
`[OBSERVED]` (저장소 전역 정규식 검색 결과 no matches). `defense-catalog.js:659` 의 실제 시그니처는:

```js
const stage = (id, name, bossName, scale, eliteId, eliteKind, eliteCompanion, boss, legacyGateTicks, waves) => {
```

4번째 인자는 `scale` 이며 **경험치 목표가 아니라 적 HP 배율**이다 — `defense-catalog.js:600`:
`const scaledHp = (enemyId) => (ENEMIES[enemyId].hp * stageScale) / 100;`.
이 문서는 계약이 요구한 자리에 `scale` 을 싣되, 그 실제 의미로 다룬다.

### 0.2 기존 문서와의 관계

`_workspace/current/design/` 의 기존 스펙(`encounter-wave-spec.md`, `pcg-stage-layout-spec.md`,
`master-numeric-contract.md` 등)은 헤더에 `status: "[TARGET] — 미측정 설계 목표"` 를 달고 있다 `[OBSERVED]`.
이 문서는 그 목표들을 재정의하지 않는다. **현재 출하된 구성의 관측 기록**이며, 목표와 어긋나는 지점만 §4 에서 인용한다.
스테이지 1 의 대응 문서는 `_workspace/current/design/stage-composition-audit-stage1.md` 이며,
여기서는 기준선 수치로만 인용한다.

---

## 1. 교차 비교표 (스테이지 2–10)

| # | id | boss | `scale`¹ | legacy wave total² | terrain GLB | stage plate | world plate | boss GLB | reward companion GLB |
|---|---|---|---|---|---|---|---|---|---|
| 2 | `veil-citadel` | Veil Tactician | 115 | **12** | present | present | **absent** | present | present |
| 3 | `echo-throne` | Gate Sovereign | 130 | **10** | present | present | **absent** | present | present |
| 4 | `sunken-bastion` | Tide Warden | 145 | **12** | present | present | **absent** | present | present |
| 5 | `howling-sprawl` | Pack Herald | 160 | **13** | present | present | **absent** | present | present |
| 6 | `glass-necropolis` | Requiem Choir | 175 | **15** | present | present | **absent** | present | present |
| 7 | `starless-canal` | Lantern Tyrant | 190 | **16** | present | present | **absent** | present | present |
| 8 | `shattered-causeway` | Bridge Colossus | 205 | **18** | present | present | **absent** | present | present |
| 9 | `abyss-chancel` | Veiled Concordat | 220 | **19** | present | present | **absent** | present | present |
| 10 | `gate-zenith` | Abyss Regent | 240 | **21** | present | present | **absent** | present | present |

¹ 계약이 `xpTarget` 이라 부른 자리. 실제 필드명은 `scale` (§0.1) `[OBSERVED]`.
² `STAGES` 의 authored `waves` 트리플 합계. **시뮬레이션이 실제로 스케줄하는 수가 아니다** — §1.2 참조.

### 1.1 wave total 산술 — 전 행 검산

`waves` 는 `[tick, archetype, count]` 트리플 배열이다. 합계는 **세 트리플의 `count` 를 더한 값**이다.
`veil-citadel` 을 완전히 펼쳐 방법을 노출한다 `[OBSERVED]`:

```
veil-citadel.waves = [[0, "rusher", 5], [180, "flanker", 4], [420, "ranged", 3]]
                       │        └ count 5   │         └ count 4    │        └ count 3
                       └ tick 0             └ tick 180             └ tick 420

total = 5 + 4 + 3 = 12
```

동일 방법을 나머지 여덟 행에 적용한 결과 — 트리플은 카탈로그에서 직렬화한 원본이다:

| # | id | 트리플 `[tick, archetype, count]` | 산술 | total |
|---|---|---|---|---|
| 2 | `veil-citadel` | `[0, rusher, 5] [180, flanker, 4] [420, ranged, 3]` | 5 + 4 + 3 | **12** |
| 3 | `echo-throne` | `[0, flanker, 5] [210, ranged, 3] [480, guardian, 2]` | 5 + 3 + 2 | **10** |
| 4 | `sunken-bastion` | `[0, rusher, 6] [220, ranged, 4] [510, guardian, 2]` | 6 + 4 + 2 | **12** |
| 5 | `howling-sprawl` | `[0, flanker, 6] [240, ranged, 4] [540, guardian, 3]` | 6 + 4 + 3 | **13** |
| 6 | `glass-necropolis` | `[0, rusher, 7] [260, ranged, 5] [570, guardian, 3]` | 7 + 5 + 3 | **15** |
| 7 | `starless-canal` | `[0, flanker, 7] [270, ranged, 5] [600, guardian, 4]` | 7 + 5 + 4 | **16** |
| 8 | `shattered-causeway` | `[0, rusher, 8] [280, ranged, 6] [630, guardian, 4]` | 8 + 6 + 4 | **18** |
| 9 | `abyss-chancel` | `[0, flanker, 8] [300, ranged, 6] [660, guardian, 5]` | 8 + 6 + 5 | **19** |
| 10 | `gate-zenith` | `[0, rusher, 9] [300, ranged, 7] [690, guardian, 5]` | 9 + 7 + 5 | **21** |

전체 검산: 12 + 10 + 12 + 13 + 15 + 16 + 18 + 19 + 21 = **136** — 스테이지 2–10 authored 트리플 총합 `[OBSERVED]`.
(참고 기준선: `cinder-span` 은 4 + 3 + 2 = 9.)

### 1.2 authored 트리플 ≠ 실제 스케줄 — 반드시 함께 읽어야 하는 수치

`defense-catalog.js:654-658` 주석이 명시한다 `[OBSERVED]`:

> `legacyGateTicks`/`legacyWaves` are the pre-doctrine short-hold values. They are kept as the
> stage's `waves` triples (the spawn-budget and catalog contracts still read them as authored
> data) while `gateTicks` and `wavePlan` now come from STAGE_WAVE_DOCTRINE, **which is what the
> simulation actually schedules.**

따라서 §1 표의 `legacy wave total` 은 **카탈로그 계약상의 authored 값**이지 플레이되는 물량이 아니다.
실제로는 `buildDoctrineWavePlan()`(`defense-catalog.js:577-653`)이 생성한 `wavePlan` 이 스케줄된다.
두 값을 나란히 측정했다 `[OBSERVED]` — `wavePlan[].primary.count` 합계와, 각 웨이브의 1순위 조합
(`alternatives[0].composition`)을 `ENEMIES[x].hp * scale / 100` 으로 환산한 총 HP:

| # | id | legacy total | `wavePlan` 슬롯 | doctrine primary 합 | 1순위 조합 body 수 | 총 환산 HP | HP/body |
|---|---|---|---|---|---|---|---|
| 1 | `cinder-span` *(기준선)* | 9 | 10 | 74 | 89 | 277,800 | 3,121 |
| 2 | `veil-citadel` | 12 | 10 | **62** | 77 | 273,010 | 3,546 |
| 3 | `echo-throne` | 10 | 11 | **45** | 55 | 284,440 | 5,172 |
| 4 | `sunken-bastion` | 12 | 11 | **47** | 57 | 310,300 | 5,444 |
| 5 | `howling-sprawl` | 13 | 11 | **43** | 52 | 336,640 | 6,474 |
| 6 | `glass-necropolis` | 15 | 12 | **43** | 55 | 375,200 | 6,822 |
| 7 | `starless-canal` | 16 | 12 | **41** | 51 | 382,660 | 7,503 |
| 8 | `shattered-causeway` | 18 | 12 | **40** | 50 | 372,280 | 7,446 |
| 9 | `abyss-chancel` | 19 | 13 | **38** | 46 | 369,600 | 8,035 |
| 10 | `gate-zenith` | 21 | 13 | **43** | 56 | 446,880 | 7,980 |

**읽는 법** `[OBSERVED]`: authored 트리플은 12 → 21 로 단조 증가하지만, 실제 doctrine body 수는
62 → 38 로 **감소**하고(gate-zenith 만 43 으로 반등), 총 환산 HP 는 273,010 → 446,880 으로 **증가**한다.
body 당 HP 는 3,546 → 8,035 로 2.27배가 된다.

이는 결함이 아니라 **의도된 설계**다 — `defense-catalog.js:568-571` 주석 그대로 `[OBSERVED]`:

> The critical property for a 10-13 wave stage: because the divisor carries `stageScale`, late
> stages field FEWER, TOUGHER bodies instead of the same count at 2.4x HP, which is what made the
> long format unclearable at gate-zenith during measurement.

**다만 doctrine 블록 주석은 낡았다** `[OBSERVED]`. `defense-catalog.js:538-539` 는
*"`squadBase` and `waveCount` climb with it so density rises with the stage's own HP `scale`"* 라고
적었지만 — (a) `squadBase` 필드는 **10개 doctrine 행 어디에도 없다**(실제 키는 `gateIntegrity`,
`defenseTicks`, `waveCount`, `classes`, `kindCycle`, `pressureLane`, `midbossEnemy` 7개뿐),
(b) density 는 위 표대로 **상승하지 않는다**. §4 S6 에 문서 결함으로 등재한다.

### 1.3 자산 존재 확인 방법과 4중 교차검사

§1 표의 present/absent 는 전부 `fs.existsSync()` 결과다 `[OBSERVED]`. 36개 경로
(9 스테이지 × terrain/plate/boss/companion)를 4중으로 교차 확인했다:

1. 디스크 존재 — `fs.existsSync()`
2. `scripts/defense-runtime-assets.mjs#RETAINED_ASSET_PATHS` 등재
3. `.github/workflows/static.yml#PAGES_RUNTIME_PATHS` 등재
4. `assets/defense-asset-manifest.json` 에서 `disposition === "retain"` **및** `runtimeReference === true`

**36/36 이 네 검사를 모두 통과했다** `[OBSERVED]`. 스테이지 2–10 의 바인딩된 자산에는 누락도,
허용목록 이탈도 없다. 매니페스트 전체는 225행이며 그중 `retain` 80행 · `runtimeReference:true` 80행으로 일치한다.

world plate 열이 전 행 **absent** 인 것도 측정 결과다 `[OBSERVED]`: `assets/images/battle/world/` 의
실제 내용물은 `cinder-span-topdown-plate.webp`, `cinder-span-tactical-paper-plate.webp`,
`concept-sung-hum-boss.provenance.json` 3건뿐이다. `<key>-topdown-plate.webp` /
`<key>-tactical-paper-plate.webp` 를 스테이지 2–10 의 9개 art-file key 로 조회한 **18개 경로는 전부 부재**다.

소비처는 `battle-visualizer.js:22-25` `WORLD_TEXTURES` 이며 두 항목 모두 cinder-span 으로 **하드코딩**되어 있다:

```js
const WORLD_TEXTURES = Object.freeze({
  cinderSpanBackground: "./assets/images/battle/world/cinder-span-topdown-plate.webp",
  cinderSpanMap: "./assets/images/battle/world/cinder-span-tactical-paper-plate.webp",
});
```

스테이지별 조회 경로가 아니다. 따라서 스테이지 2–10 은 파일을 추가해도 **코드 변경 없이는 Canvas 폴백
렌더러에서 배경 플레이트를 가질 수 없다** `[INFERENCE — 위 하드코딩 관측에서 도출]`.

---

## 2. 스테이지별 구성 (캠페인 순서 2 → 10)

아홉 절 모두 동일한 5부 스키마를 따르므로 직접 비교 가능하다.

### 2.1 `veil-citadel` — Veil Citadel (캠페인 2/10)

**1. Identity**

| 항목 | 값 | 출처 |
|---|---|---|
| stage id | `veil-citadel` | `defense-catalog.js:677` |
| display name | Veil Citadel | `defense-catalog.js:677` |
| boss name | Veil Tactician | `defense-catalog.js:677` |
| campaign sequence | 2 / 10 | `STAGES` 배열 순서 · `stage-world-catalog.js:125` `sequence: 2` |
| art-file key | `veil-citadel` | `app.js:124` `STAGE_ART_FILE_BY_ID` |
| editorial showcase | `true` (order 2) | `stage-world-catalog.js` `editorial(...)` |

**2. Runtime asset binding** — 전 항목 `fs.existsSync()` 확인 `[OBSERVED]`

| 역할 | 경로 | 상태 |
|---|---|---|
| terrain GLB | `assets/images/battle/glb/terrain/veil-citadel.glb` | present |
| stage plate PNG | `assets/images/battle/ui/stages/veil-citadel.png` | present |
| world plate — topdown | `assets/images/battle/world/veil-citadel-topdown-plate.webp` | **absent** |
| world plate — tactical | `assets/images/battle/world/veil-citadel-tactical-paper-plate.webp` | **absent** |
| boss GLB | `assets/images/battle/glb/bosses/veil-tactician.glb` | present |
| reward companion GLB | `assets/images/battle/glb/companions/rift-lens.glb` | present |
| world lookout GLB | `assets/images/battle/glb/companions/rift-lens.glb` | present |

| 바인딩 식별자 | 값 | 해석 경로 |
|---|---|---|
| boss id | `s2-veil-tactician` | `battle-realtime-three.js` — `BOSS_MODELS["s2-veil-tactician"]` + `MODEL_ROOT`(`:121`) 접합 |
| elite id | `s2-veil-sentinel` | `defense-catalog.js:677` — **전용 카탈로그 없음**: `ELITES` 라는 export 자체가 존재하지 않는다 `[OBSERVED]` |
| elite archetype (`eliteKind`) | `flanker` | `defense-catalog.js:677` · `ENEMIES` 4종(`rusher`/`flanker`/`guardian`/`ranged`) 중 하나로 해석됨 |
| reward companion | `rift-lens` | `COMPANIONS` 카탈로그 등재 확인 · `COMPANION_MODELS`(`battle-realtime-three.js:152-162`) 매핑 확인 |
| world lookout actor | `rift-lens` | `stage-world-catalog.js:151` |
| stage item | `ward-splinter` | `defense-catalog.js#STAGE_ITEM_IDS` |

**3. Presentation vocabulary** — `STAGE_PRESENTATION_BY_ID` 객체에서 직렬화, 표기 그대로 `[OBSERVED]`

팔레트 (`defense-catalog.js:701`):

| slot | id |
|---|---|
| `surface` | `surface-veil-stone` |
| `contour` | `contour-veil` |
| `landmark` | `landmark-rampart` |
| `hazard` | `hazard-static` |
| `objective` | `objective-signal` |

지형 패턴 (`defense-catalog.js:702`) — patternId `terrain.veil-citadel.veiled-lines` · label `장막의 선`

랜드마크 (`defense-catalog.js:703`):

- `landmark.veil-rampart` — `장막 성벽`
- `landmark.veil-twins` — `쌍둥이 장막`

분위기 (`defense-catalog.js:704`) — descriptor `성채의 장막이 신호와 시야를 삼킨다.` · motif `거울빛 장막과 정전`

`mapLabels` 9개 키 전체 (`defense-catalog.js:705`):

| key | label |
|---|---|
| `title` | `장막 성채` |
| `domain` | `장막의 봉쇄선` |
| `chokepath` | `쌍둥이 장막길` |
| `flank` | `북쪽 측면` |
| `elevation` | `장막 성벽` |
| `hazard` | `거울 정전` |
| `occupation` | `장막 신호` |
| `extraction` | `결속 지점` |
| `objective` | `장막 신호를 붙들고 결속하라.` |

병행 영문 분위기 (`stage-world-catalog.js` `presentation.atmosphere`) — descriptor
`The citadel veil consumes signal and sight.` · motif `mirror light and static` ·
fogNear `21` · fogFar `47.6` · accent `#2cadd6`

**4. Encounter composition**

authored wave table (`defense-catalog.js:677`) — `[tick, archetype, count]` `[OBSERVED]`:

| tick | archetype | count |
|---|---|---|
| 0 | `rusher` | 5 |
| 180 | `flanker` | 4 |
| 420 | `ranged` | 3 |
| — | **합계** | **12** &nbsp; (5 + 4 + 3 = 12) |

| 항목 | 값 | 출처 |
|---|---|---|
| `scale` — 계약의 "xpTarget" 자리 | **115** | `defense-catalog.js:677` |
| boss id | `s2-veil-tactician` | `defense-catalog.js:677` |
| `gateTicks` | 10200 (= doctrine `defenseTicks`) | `defense-catalog.js:665` |
| `legacyGateTicks` | 780 — pre-doctrine 보존값 | `defense-catalog.js:677` |
| doctrine `gateIntegrity` | 1700 | `defense-catalog.js:545` |
| doctrine `waveCount` | 10 | `defense-catalog.js:545` |
| doctrine `classes` | `rusher` · `flanker` · `ranged` | `defense-catalog.js:545` |
| doctrine `kindCycle` | `normal` · `big` · `normal` · `mid` | `defense-catalog.js:545` |
| doctrine `pressureLane` | `flank` | `defense-catalog.js:545` |
| doctrine `midbossEnemy` | `flanker` | `defense-catalog.js:545` |
| 실제 `wavePlan` 슬롯 | 10 (midboss 슬롯 2) | `buildDoctrineWavePlan()` 산출 |
| 실제 doctrine primary 합 | **62** — authored 12 대비 5.17배 | §1.2 |
| 점유점 `occupation` | `veil-signal` @ (18000, 4200) r=850 hold=210t | `defense-catalog.js:403`~ |
| 추출점 `extraction` | `veil-bind` @ (15800, 3400) r=950 window=600t | `defense-catalog.js:403`~ |
| 스폰 방향 | `W` · `NW` | `defense-catalog.js:403`~ |

컷신 (`defense-catalog.js:239`) — 실제 존재 키: `intro`, `elite`, `victory`, `defeat` `[OBSERVED]`:

| 키 | 대사 |
|---|---|
| `intro[0]` | `장막 성채가 신호를 삼킨다.` |
| `intro[1]` | `점유점과 추출점을 붙들고 장막의 잔향을 결속하라.` |
| `bossEntry` | **부재 — 이 키가 객체에 존재하지 않는다** |
| `elite` | `감시석의 빈 투구가 새로운 의지를 기다린다.` |
| `victory` | `거울의 명령이 끊기고 왕좌의 방향이 열린다.` |
| `defeat` | `장막이 다시 닫혔다. 신호를 되찾아라.` |

**5. Composition gaps** — 스테이지 1 과 동일 완성도까지 남은 것

1. `cinematic.intro` 부재. cinder-span 만 보유(`stage-world-catalog.js:102-108`, `durationTicks 90`). 소비처 `battle-realtime-three.js:2453` 가 `?.` 로 조회하므로 이 스테이지 진입은 **연출 없이 즉시 시작**된다.
2. `meshColliders` 0개. cinder-span 은 1개/6삼각형. `defense-run-simulation.js:2895` `usesMeshSupport` 가 false 로 떨어져 고도 판정이 `surfaces` AABB 경로(`:79-98`)로만 처리된다.
3. `CUTSCENES["veil-citadel"].bossEntry` 부재 — Veil Tactician 등장에 대사가 없다.
4. world plate 2종 부재: `assets/images/battle/world/veil-citadel-topdown-plate.webp`, `assets/images/battle/world/veil-citadel-tactical-paper-plate.webp`.
5. `STAGE_TACTICS["veil-citadel"]` 에 `mapVariant`/`surpriseTable` 없음 → `protectedCorridor` 선언 부재, `LORE_SURPRISE_RESOLVED` 발생 불가.

---

### 2.2 `echo-throne` — Echo Throne (캠페인 3/10)

**1. Identity**

| 항목 | 값 | 출처 |
|---|---|---|
| stage id | `echo-throne` | `defense-catalog.js:678` |
| display name | Echo Throne | `defense-catalog.js:678` |
| boss name | Gate Sovereign | `defense-catalog.js:678` |
| campaign sequence | 3 / 10 | `STAGES` 배열 순서 · `stage-world-catalog.js:158` `sequence: 3` |
| art-file key | `echo-throne-steps` — ⚠ **id ≠ 파일명** | `app.js:125` `STAGE_ART_FILE_BY_ID` |
| editorial showcase | `true` (order 3) | `stage-world-catalog.js` `editorial(...)` |

> ⚠ **10 스테이지 중 유일하게** id 와 art-file key 가 다르다. `app.js:125` 가 `echo-throne` → `echo-throne-steps` 로
> 매핑하고, `stage-world-catalog.js:160` 의 `terrainGlbPath` 도 같은 `echo-throne-steps` 기저명을 쓴다.
> 두 표면이 서로 **일관**하며 디스크 파일명과도 일치한다 `[OBSERVED]` — 깨진 참조가 아니라
> **의도된 명명 규약 이탈**이다. 전수 조사 결과는 §3.

**2. Runtime asset binding** — 전 항목 `fs.existsSync()` 확인 `[OBSERVED]`

| 역할 | 경로 | 상태 |
|---|---|---|
| terrain GLB | `assets/images/battle/glb/terrain/echo-throne-steps.glb` | present |
| stage plate PNG | `assets/images/battle/ui/stages/echo-throne-steps.png` | present |
| world plate — topdown | `assets/images/battle/world/echo-throne-steps-topdown-plate.webp` | **absent** |
| world plate — tactical | `assets/images/battle/world/echo-throne-steps-tactical-paper-plate.webp` | **absent** |
| boss GLB | `assets/images/battle/glb/bosses/gate-sovereign.glb` | present |
| reward companion GLB | `assets/images/battle/glb/companions/throne-echo.glb` | present |
| world lookout GLB | `assets/images/battle/glb/companions/throne-echo.glb` | present |

| 바인딩 식별자 | 값 | 해석 경로 |
|---|---|---|
| boss id | `s3-gate-sovereign` | `battle-realtime-three.js` — `BOSS_MODELS["s3-gate-sovereign"]` + `MODEL_ROOT`(`:121`) 접합 |
| elite id | `s3-throne-wraith` | `defense-catalog.js:678` — **전용 카탈로그 없음**: `ELITES` 라는 export 자체가 존재하지 않는다 `[OBSERVED]` |
| elite archetype (`eliteKind`) | `ranged` | `defense-catalog.js:678` · `ENEMIES` 4종(`rusher`/`flanker`/`guardian`/`ranged`) 중 하나로 해석됨 |
| reward companion | `throne-echo` | `COMPANIONS` 카탈로그 등재 확인 · `COMPANION_MODELS`(`battle-realtime-three.js:152-162`) 매핑 확인 |
| world lookout actor | `throne-echo` | `stage-world-catalog.js:184` |
| stage item | `echo-compass` | `defense-catalog.js#STAGE_ITEM_IDS` |

**3. Presentation vocabulary** — `STAGE_PRESENTATION_BY_ID` 객체에서 직렬화, 표기 그대로 `[OBSERVED]`

팔레트 (`defense-catalog.js:708`):

| slot | id |
|---|---|
| `surface` | `surface-throne-stone` |
| `contour` | `contour-echo` |
| `landmark` | `landmark-dais` |
| `hazard` | `hazard-rift` |
| `objective` | `objective-domain` |

지형 패턴 (`defense-catalog.js:709`) — patternId `terrain.echo-throne.court-steps` · label `왕좌의 계단`

랜드마크 (`defense-catalog.js:710`):

- `landmark.throne-dais` — `왕좌 단상`
- `landmark.throne-aisle` — `왕좌 회랑`

분위기 (`defense-catalog.js:711`) — descriptor `달 없는 궁정의 메아리가 왕좌 회랑을 울린다.` · motif `메아리와 단상의 균열`

`mapLabels` 9개 키 전체 (`defense-catalog.js:712`):

| key | label |
|---|---|
| `title` | `메아리 왕좌` |
| `domain` | `달 없는 궁정` |
| `chokepath` | `왕좌 회랑` |
| `flank` | `남쪽 측면` |
| `elevation` | `왕좌 단상` |
| `hazard` | `메아리 균열` |
| `occupation` | `왕좌 영역` |
| `extraction` | `결속 지점` |
| `objective` | `왕좌 영역을 지켜 결속하라.` |

병행 영문 분위기 (`stage-world-catalog.js` `presentation.atmosphere`) — descriptor
`A moonless court echoes along the throne aisle.` · motif `echoes and fractures` ·
fogNear `19.6` · fogFar `42` · accent `#3c2c5b`

**4. Encounter composition**

authored wave table (`defense-catalog.js:678`) — `[tick, archetype, count]` `[OBSERVED]`:

| tick | archetype | count |
|---|---|---|
| 0 | `flanker` | 5 |
| 210 | `ranged` | 3 |
| 480 | `guardian` | 2 |
| — | **합계** | **10** &nbsp; (5 + 3 + 2 = 10) |

| 항목 | 값 | 출처 |
|---|---|---|
| `scale` — 계약의 "xpTarget" 자리 | **130** | `defense-catalog.js:678` |
| boss id | `s3-gate-sovereign` | `defense-catalog.js:678` |
| `gateTicks` | 10800 (= doctrine `defenseTicks`) | `defense-catalog.js:665` |
| `legacyGateTicks` | 840 — pre-doctrine 보존값 | `defense-catalog.js:678` |
| doctrine `gateIntegrity` | 1800 | `defense-catalog.js:546` |
| doctrine `waveCount` | 11 | `defense-catalog.js:546` |
| doctrine `classes` | `flanker` · `ranged` · `guardian` | `defense-catalog.js:546` |
| doctrine `kindCycle` | `normal` · `normal` · `big` · `mid` | `defense-catalog.js:546` |
| doctrine `pressureLane` | `chokepath` | `defense-catalog.js:546` |
| doctrine `midbossEnemy` | `guardian` | `defense-catalog.js:546` |
| 실제 `wavePlan` 슬롯 | 11 (midboss 슬롯 2) | `buildDoctrineWavePlan()` 산출 |
| 실제 doctrine primary 합 | **45** — authored 10 대비 4.50배 | §1.2 |
| 점유점 `occupation` | `throne-domain` @ (18400, 6000) r=800 hold=240t | `defense-catalog.js:412`~ |
| 추출점 `extraction` | `throne-bind` @ (16200, 7600) r=900 window=600t | `defense-catalog.js:412`~ |
| 스폰 방향 | `W` · `SW` · `NW` | `defense-catalog.js:412`~ |

컷신 (`defense-catalog.js:245`) — 실제 존재 키: `intro`, `elite`, `victory`, `defeat` `[OBSERVED]`:

| 키 | 대사 |
|---|---|
| `intro[0]` | `Moonless Court의 메아리 왕좌가 세 번째 봉쇄선 위에 떠 있다.` |
| `intro[1]` | `한 번뿐인 군주의 영역으로 관문을 버텨라.` |
| `bossEntry` | **부재 — 이 키가 객체에 존재하지 않는다** |
| `elite` | `왕좌의 잔향이 Moonless Court의 명령을 기억한다.` |
| `victory` | `왕좌의 명령이 끊기고 세 번째 봉쇄선이 이어졌다.` |
| `defeat` | `왕좌의 명령이 관문을 되찾았다. 세 번째 봉쇄선으로 복귀하라.` |

**5. Composition gaps** — 스테이지 1 과 동일 완성도까지 남은 것

1. **id ≠ 파일명**: art-file key 가 `echo-throne-steps` 다. terrain GLB 와 stage plate 양쪽 표면에 전파된다(§3). 캠페인 10스테이지 중 유일.
2. `cinematic.intro` 부재 — 캠페인 유일 `Moonless Court` 왕좌 등장이 연출 없이 시작된다.
3. `meshColliders` 0개 — 이 스테이지에서는 `surfaces` 가 **유일한 고도 권위**가 된다(§4.1 S3).
4. `bossEntry` 부재 — Gate Sovereign 등장 대사 없음.
5. world plate 2종 부재: `assets/images/battle/world/echo-throne-steps-topdown-plate.webp`, `assets/images/battle/world/echo-throne-steps-tactical-paper-plate.webp` (art-file key 규약을 따르면 이 이름이 된다).
6. `mapVariant`/`surpriseTable` 부재.

---

### 2.3 `sunken-bastion` — Sunken Bastion (캠페인 4/10)

**1. Identity**

| 항목 | 값 | 출처 |
|---|---|---|
| stage id | `sunken-bastion` | `defense-catalog.js:679` |
| display name | Sunken Bastion | `defense-catalog.js:679` |
| boss name | Tide Warden | `defense-catalog.js:679` |
| campaign sequence | 4 / 10 | `STAGES` 배열 순서 · `stage-world-catalog.js:191` `sequence: 4` |
| art-file key | `sunken-bastion` | `app.js:126` `STAGE_ART_FILE_BY_ID` |
| editorial showcase | **`false`** (order 0) | `stage-world-catalog.js` `editorial(...)` |

**2. Runtime asset binding** — 전 항목 `fs.existsSync()` 확인 `[OBSERVED]`

| 역할 | 경로 | 상태 |
|---|---|---|
| terrain GLB | `assets/images/battle/glb/terrain/sunken-bastion.glb` | present |
| stage plate PNG | `assets/images/battle/ui/stages/sunken-bastion.png` | present |
| world plate — topdown | `assets/images/battle/world/sunken-bastion-topdown-plate.webp` | **absent** |
| world plate — tactical | `assets/images/battle/world/sunken-bastion-tactical-paper-plate.webp` | **absent** |
| boss GLB | `assets/images/battle/glb/bosses/tide-warden.glb` | present |
| reward companion GLB | `assets/images/battle/glb/companions/anchor-shard.glb` | present |
| world lookout GLB | `assets/images/battle/glb/companions/anchor-shard.glb` | present |

| 바인딩 식별자 | 값 | 해석 경로 |
|---|---|---|
| boss id | `s4-tide-warden` | `battle-realtime-three.js` — `BOSS_MODELS["s4-tide-warden"]` + `MODEL_ROOT`(`:121`) 접합 |
| elite id | `s4-anchor-diver` | `defense-catalog.js:679` — **전용 카탈로그 없음**: `ELITES` 라는 export 자체가 존재하지 않는다 `[OBSERVED]` |
| elite archetype (`eliteKind`) | `guardian` | `defense-catalog.js:679` · `ENEMIES` 4종(`rusher`/`flanker`/`guardian`/`ranged`) 중 하나로 해석됨 |
| reward companion | `anchor-shard` | `COMPANIONS` 카탈로그 등재 확인 · `COMPANION_MODELS`(`battle-realtime-three.js:152-162`) 매핑 확인 |
| world lookout actor | `anchor-shard` | `stage-world-catalog.js:217` |
| stage item | `hourglass-fragment` | `defense-catalog.js#STAGE_ITEM_IDS` |

**3. Presentation vocabulary** — `STAGE_PRESENTATION_BY_ID` 객체에서 직렬화, 표기 그대로 `[OBSERVED]`

팔레트 (`defense-catalog.js:715`):

| slot | id |
|---|---|
| `surface` | `surface-bastion-flood` |
| `contour` | `contour-tide` |
| `landmark` | `landmark-anchor` |
| `hazard` | `hazard-flood` |
| `objective` | `objective-pump` |

지형 패턴 (`defense-catalog.js:716`) — patternId `terrain.sunken-bastion.flood-arcs` · label `침수 호`

랜드마크 (`defense-catalog.js:717`):

- `landmark.bastion-anchor` — `보루 닻`
- `landmark.bastion-floodgate` — `침수 수문`

분위기 (`defense-catalog.js:718`) — descriptor `가라앉은 보루의 수문에서 조류가 밀려든다.` · motif `침수선과 닻의 잔향`

`mapLabels` 9개 키 전체 (`defense-catalog.js:719`):

| key | label |
|---|---|
| `title` | `가라앉은 보루` |
| `domain` | `조류의 봉쇄선` |
| `chokepath` | `침수 수문` |
| `flank` | `수로 측면` |
| `elevation` | `보루 닻` |
| `hazard` | `침수 파동` |
| `occupation` | `보루 펌프` |
| `extraction` | `결속 지점` |
| `objective` | `보루 펌프를 점유하고 결속하라.` |

병행 영문 분위기 (`stage-world-catalog.js` `presentation.atmosphere`) — descriptor
`Tide pushes through the flooded bastion gates.` · motif `flood lines and anchor resonance` ·
fogNear `21` · fogFar `46.2` · accent `#258f9e`

**4. Encounter composition**

authored wave table (`defense-catalog.js:679`) — `[tick, archetype, count]` `[OBSERVED]`:

| tick | archetype | count |
|---|---|---|
| 0 | `rusher` | 6 |
| 220 | `ranged` | 4 |
| 510 | `guardian` | 2 |
| — | **합계** | **12** &nbsp; (6 + 4 + 2 = 12) |

| 항목 | 값 | 출처 |
|---|---|---|
| `scale` — 계약의 "xpTarget" 자리 | **145** | `defense-catalog.js:679` |
| boss id | `s4-tide-warden` | `defense-catalog.js:679` |
| `gateTicks` | 11400 (= doctrine `defenseTicks`) | `defense-catalog.js:665` |
| `legacyGateTicks` | 900 — pre-doctrine 보존값 | `defense-catalog.js:679` |
| doctrine `gateIntegrity` | 1900 | `defense-catalog.js:547` |
| doctrine `waveCount` | 11 | `defense-catalog.js:547` |
| doctrine `classes` | `rusher` · `ranged` · `guardian` | `defense-catalog.js:547` |
| doctrine `kindCycle` | `big` · `normal` · `normal` · `mid` | `defense-catalog.js:547` |
| doctrine `pressureLane` | `chokepath` | `defense-catalog.js:547` |
| doctrine `midbossEnemy` | `guardian` | `defense-catalog.js:547` |
| 실제 `wavePlan` 슬롯 | 11 (midboss 슬롯 2) | `buildDoctrineWavePlan()` 산출 |
| 실제 doctrine primary 합 | **47** — authored 12 대비 3.92배 | §1.2 |
| 점유점 `occupation` | `bastion-pump` @ (17800, 7600) r=900 hold=240t | `defense-catalog.js:421`~ |
| 추출점 `extraction` | `bastion-bind` @ (15600, 8000) r=950 window=600t | `defense-catalog.js:421`~ |
| 스폰 방향 | `W` · `SW` | `defense-catalog.js:421`~ |

컷신 (`defense-catalog.js:251`) — 실제 존재 키: `intro`, `elite`, `victory`, `defeat` `[OBSERVED]`:

| 키 | 대사 |
|---|---|
| `intro[0]` | `가라앉은 보루의 네 번째 봉쇄선이 흔들린다.` |
| `intro[1]` | `침수된 추출점을 점유하고 닻의 잔향을 결속하라.` |
| `bossEntry` | **부재 — 이 키가 객체에 존재하지 않는다** |
| `elite` | `닻의 잔향이 물길의 추출점에 머문다.` |
| `victory` | `조류의 명령이 끊기고 네 번째 봉쇄선이 이어졌다.` |
| `defeat` | `침수 압력이 관문을 무너뜨렸다. 네 번째 봉쇄선으로 복귀하라.` |

**5. Composition gaps** — 스테이지 1 과 동일 완성도까지 남은 것

1. **`editorial.showcase: false`, `order: 0`** — 로비 쇼케이스에서 처음으로 빠지는 스테이지. `STAGE_SHOWCASE_IDS` 는 `cinder-span`/`veil-citadel`/`echo-throne` 3개로 고정이고 `stage-world-catalog.js:584` 가 정확히 3개를 강제한다. 4–10 은 카드 아트가 있어도 쇼케이스 노출 경로가 없다.
2. `cinematic.intro` 부재.
3. `meshColliders` 0개 — 이 스테이지에서는 `surfaces` 가 **유일한 고도 권위**가 된다(§4.1 S3).
4. `bossEntry` 부재 — Tide Warden 등장 대사 없음.
5. world plate 2종 부재: `assets/images/battle/world/sunken-bastion-topdown-plate.webp`, `assets/images/battle/world/sunken-bastion-tactical-paper-plate.webp`.
6. `mapVariant`/`surpriseTable` 부재.

---

### 2.4 `howling-sprawl` — Howling Sprawl (캠페인 5/10)

**1. Identity**

| 항목 | 값 | 출처 |
|---|---|---|
| stage id | `howling-sprawl` | `defense-catalog.js:680` |
| display name | Howling Sprawl | `defense-catalog.js:680` |
| boss name | Pack Herald | `defense-catalog.js:680` |
| campaign sequence | 5 / 10 | `STAGES` 배열 순서 · `stage-world-catalog.js:224` `sequence: 5` |
| art-file key | `howling-sprawl` | `app.js:127` `STAGE_ART_FILE_BY_ID` |
| editorial showcase | **`false`** (order 0) | `stage-world-catalog.js` `editorial(...)` |

**2. Runtime asset binding** — 전 항목 `fs.existsSync()` 확인 `[OBSERVED]`

| 역할 | 경로 | 상태 |
|---|---|---|
| terrain GLB | `assets/images/battle/glb/terrain/howling-sprawl.glb` | present |
| stage plate PNG | `assets/images/battle/ui/stages/howling-sprawl.png` | present |
| world plate — topdown | `assets/images/battle/world/howling-sprawl-topdown-plate.webp` | **absent** |
| world plate — tactical | `assets/images/battle/world/howling-sprawl-tactical-paper-plate.webp` | **absent** |
| boss GLB | `assets/images/battle/glb/bosses/pack-herald.glb` | present |
| reward companion GLB | `assets/images/battle/glb/companions/veil-vanguard.glb` | present |
| world lookout GLB | `assets/images/battle/glb/companions/pack-warden.glb` | present |

| 바인딩 식별자 | 값 | 해석 경로 |
|---|---|---|
| boss id | `s5-pack-herald` | `battle-realtime-three.js` — `BOSS_MODELS["s5-pack-herald"]` + `MODEL_ROOT`(`:121`) 접합 |
| elite id | `s5-pack-sentinel` | `defense-catalog.js:680` — **전용 카탈로그 없음**: `ELITES` 라는 export 자체가 존재하지 않는다 `[OBSERVED]` |
| elite archetype (`eliteKind`) | `guardian` | `defense-catalog.js:680` · `ENEMIES` 4종(`rusher`/`flanker`/`guardian`/`ranged`) 중 하나로 해석됨 |
| reward companion | `veil-vanguard` | `COMPANIONS` 카탈로그 등재 확인 · `COMPANION_MODELS`(`battle-realtime-three.js:152-162`) 매핑 확인 |
| world lookout actor | `pack-warden` — ⚠ **보상 동료와 불일치** | `stage-world-catalog.js:251` |
| stage item | `ashen-sigil` | `defense-catalog.js#STAGE_ITEM_IDS` |

**3. Presentation vocabulary** — `STAGE_PRESENTATION_BY_ID` 객체에서 직렬화, 표기 그대로 `[OBSERVED]`

팔레트 (`defense-catalog.js:722`):

| slot | id |
|---|---|
| `surface` | `surface-sprawl-dust` |
| `contour` | `contour-wind` |
| `landmark` | `landmark-ridge` |
| `hazard` | `hazard-gust` |
| `objective` | `objective-beacon` |

지형 패턴 (`defense-catalog.js:723`) — patternId `terrain.howling-sprawl.wind-hatch` · label `바람 해칭`

랜드마크 (`defense-catalog.js:724`):

- `landmark.sprawl-ridge` — `황야 능선`
- `landmark.sprawl-funnel` — `바람깔때기`

분위기 (`defense-catalog.js:725`) — descriptor `울부짖는 바람이 황야의 측면을 열어젖힌다.` · motif `교차풍과 능선의 골`

`mapLabels` 9개 키 전체 (`defense-catalog.js:726`):

| key | label |
|---|---|
| `title` | `울부짖는 황야` |
| `domain` | `바람길 봉쇄선` |
| `chokepath` | `바람깔때기` |
| `flank` | `교차풍 측면` |
| `elevation` | `황야 능선` |
| `hazard` | `울부짖는 돌풍` |
| `occupation` | `황야 봉화` |
| `extraction` | `결속 지점` |
| `objective` | `황야 봉화를 지켜 결속하라.` |

병행 영문 분위기 (`stage-world-catalog.js` `presentation.atmosphere`) — descriptor
`Crosswinds tear open the wasteland flank.` · motif `crosswind and ridge hollows` ·
fogNear `28` · fogFar `61.6` · accent `#c5a56a`

**4. Encounter composition**

authored wave table (`defense-catalog.js:680`) — `[tick, archetype, count]` `[OBSERVED]`:

| tick | archetype | count |
|---|---|---|
| 0 | `flanker` | 6 |
| 240 | `ranged` | 4 |
| 540 | `guardian` | 3 |
| — | **합계** | **13** &nbsp; (6 + 4 + 3 = 13) |

| 항목 | 값 | 출처 |
|---|---|---|
| `scale` — 계약의 "xpTarget" 자리 | **160** | `defense-catalog.js:680` |
| boss id | `s5-pack-herald` | `defense-catalog.js:680` |
| `gateTicks` | 12000 (= doctrine `defenseTicks`) | `defense-catalog.js:665` |
| `legacyGateTicks` | 960 — pre-doctrine 보존값 | `defense-catalog.js:680` |
| doctrine `gateIntegrity` | 2000 | `defense-catalog.js:548` |
| doctrine `waveCount` | 11 | `defense-catalog.js:548` |
| doctrine `classes` | `flanker` · `ranged` · `guardian` | `defense-catalog.js:548` |
| doctrine `kindCycle` | `normal` · `big` · `normal` · `mid` | `defense-catalog.js:548` |
| doctrine `pressureLane` | `flank` | `defense-catalog.js:548` |
| doctrine `midbossEnemy` | `flanker` | `defense-catalog.js:548` |
| 실제 `wavePlan` 슬롯 | 11 (midboss 슬롯 2) | `buildDoctrineWavePlan()` 산출 |
| 실제 doctrine primary 합 | **43** — authored 13 대비 3.31배 | §1.2 |
| 점유점 `occupation` | `sprawl-beacon` @ (17400, 3600) r=950 hold=270t | `defense-catalog.js:430`~ |
| 추출점 `extraction` | `sprawl-bind` @ (15000, 2600) r=1000 window=600t | `defense-catalog.js:430`~ |
| 스폰 방향 | `W` · `NW` · `SW` | `defense-catalog.js:430`~ |

컷신 (`defense-catalog.js:257`) — 실제 존재 키: `intro`, `elite`, `victory`, `defeat` `[OBSERVED]`:

| 키 | 대사 |
|---|---|
| `intro[0]` | `울부짖는 황야가 다섯 번째 관문의 측면을 연다.` |
| `intro[1]` | `측면 추출점을 점유하고 무리의 잔향을 회수하라.` |
| `bossEntry` | **부재 — 이 키가 객체에 존재하지 않는다** |
| `elite` | `무리의 잔향이 바람길의 결속 신호로 남는다.` |
| `victory` | `측면의 명령이 끊기고 다섯 번째 봉쇄선이 닫혔다.` |
| `defeat` | `측면 압력이 관문을 갈랐다. 다섯 번째 봉쇄선으로 복귀하라.` |

**5. Composition gaps** — 스테이지 1 과 동일 완성도까지 남은 것

1. **보상 동료 ≠ 배치 lookout**: 보상은 `veil-vanguard`, 월드에 서 있는 lookout 은 `pack-warden`(`stage-world-catalog.js:251`). 스테이지 이름/보스(Pack Herald)와 일치하는 쪽은 `pack-warden` 이지만 보상은 그것이 아니다.
2. `pack-warden.glb` 는 디스크·허용목록·매니페스트에 모두 존재하나 **어떤 스테이지의 보상도 아니다**.
3. `cinematic.intro` 부재.
4. `meshColliders` 0개 — 이 스테이지에서는 `surfaces` 가 **유일한 고도 권위**가 된다(§4.1 S3).
5. `bossEntry` 부재 — Pack Herald 등장 대사 없음.
6. world plate 2종 부재: `assets/images/battle/world/howling-sprawl-topdown-plate.webp`, `assets/images/battle/world/howling-sprawl-tactical-paper-plate.webp`.
7. `mapVariant`/`surpriseTable` 부재.

---

### 2.5 `glass-necropolis` — Glass Necropolis (캠페인 6/10)

**1. Identity**

| 항목 | 값 | 출처 |
|---|---|---|
| stage id | `glass-necropolis` | `defense-catalog.js:681` |
| display name | Glass Necropolis | `defense-catalog.js:681` |
| boss name | Requiem Choir | `defense-catalog.js:681` |
| campaign sequence | 6 / 10 | `STAGES` 배열 순서 · `stage-world-catalog.js:258` `sequence: 6` |
| art-file key | `glass-necropolis` | `app.js:128` `STAGE_ART_FILE_BY_ID` |
| editorial showcase | **`false`** (order 0) | `stage-world-catalog.js` `editorial(...)` |

**2. Runtime asset binding** — 전 항목 `fs.existsSync()` 확인 `[OBSERVED]`

| 역할 | 경로 | 상태 |
|---|---|---|
| terrain GLB | `assets/images/battle/glb/terrain/glass-necropolis.glb` | present |
| stage plate PNG | `assets/images/battle/ui/stages/glass-necropolis.png` | present |
| world plate — topdown | `assets/images/battle/world/glass-necropolis-topdown-plate.webp` | **absent** |
| world plate — tactical | `assets/images/battle/world/glass-necropolis-tactical-paper-plate.webp` | **absent** |
| boss GLB | `assets/images/battle/glb/bosses/requiem-choir.glb` | present |
| reward companion GLB | `assets/images/battle/glb/companions/throne-echo.glb` | present |
| world lookout GLB | `assets/images/battle/glb/companions/requiem-warden.glb` | present |

| 바인딩 식별자 | 값 | 해석 경로 |
|---|---|---|
| boss id | `s6-requiem-choir` | `battle-realtime-three.js` — `BOSS_MODELS["s6-requiem-choir"]` + `MODEL_ROOT`(`:121`) 접합 |
| elite id | `s6-choir-adept` | `defense-catalog.js:681` — **전용 카탈로그 없음**: `ELITES` 라는 export 자체가 존재하지 않는다 `[OBSERVED]` |
| elite archetype (`eliteKind`) | `ranged` | `defense-catalog.js:681` · `ENEMIES` 4종(`rusher`/`flanker`/`guardian`/`ranged`) 중 하나로 해석됨 |
| reward companion | `throne-echo` | `COMPANIONS` 카탈로그 등재 확인 · `COMPANION_MODELS`(`battle-realtime-three.js:152-162`) 매핑 확인 |
| world lookout actor | `requiem-warden` — ⚠ **보상 동료와 불일치** | `stage-world-catalog.js:284` |
| stage item | `ward-splinter` | `defense-catalog.js#STAGE_ITEM_IDS` |

**3. Presentation vocabulary** — `STAGE_PRESENTATION_BY_ID` 객체에서 직렬화, 표기 그대로 `[OBSERVED]`

팔레트 (`defense-catalog.js:729`):

| slot | id |
|---|---|
| `surface` | `surface-glass-crypt` |
| `contour` | `contour-glass` |
| `landmark` | `landmark-spire` |
| `hazard` | `hazard-shard` |
| `objective` | `objective-choir` |

지형 패턴 (`defense-catalog.js:730`) — patternId `terrain.glass-necropolis.fractures` · label `유리 균열`

랜드마크 (`defense-catalog.js:731`):

- `landmark.glass-spire` — `유리 첨탑`
- `landmark.glass-crypt` — `유리 납골당`

분위기 (`defense-catalog.js:732`) — descriptor `유리 묘역의 반사면이 고지와 사선을 가른다.` · motif `파편빛과 합창의 잔향`

`mapLabels` 9개 키 전체 (`defense-catalog.js:733`):

| key | label |
|---|---|
| `title` | `유리 묘역` |
| `domain` | `유리 고지 봉쇄선` |
| `chokepath` | `유리 납골당` |
| `flank` | `반사 측면` |
| `elevation` | `유리 첨탑` |
| `hazard` | `유리 파편비` |
| `occupation` | `유리 합창` |
| `extraction` | `결속 지점` |
| `objective` | `유리 합창을 점유하고 결속하라.` |

병행 영문 분위기 (`stage-world-catalog.js` `presentation.atmosphere`) — descriptor
`Reflective tomb planes split elevation from sightline.` · motif `shard-light and choir resonance` ·
fogNear `23.8` · fogFar `53.2` · accent `#b6dce5`

**4. Encounter composition**

authored wave table (`defense-catalog.js:681`) — `[tick, archetype, count]` `[OBSERVED]`:

| tick | archetype | count |
|---|---|---|
| 0 | `rusher` | 7 |
| 260 | `ranged` | 5 |
| 570 | `guardian` | 3 |
| — | **합계** | **15** &nbsp; (7 + 5 + 3 = 15) |

| 항목 | 값 | 출처 |
|---|---|---|
| `scale` — 계약의 "xpTarget" 자리 | **175** | `defense-catalog.js:681` |
| boss id | `s6-requiem-choir` | `defense-catalog.js:681` |
| `gateTicks` | 12600 (= doctrine `defenseTicks`) | `defense-catalog.js:665` |
| `legacyGateTicks` | 1020 — pre-doctrine 보존값 | `defense-catalog.js:681` |
| doctrine `gateIntegrity` | 2100 | `defense-catalog.js:549` |
| doctrine `waveCount` | 12 | `defense-catalog.js:549` |
| doctrine `classes` | `rusher` · `ranged` · `guardian` | `defense-catalog.js:549` |
| doctrine `kindCycle` | `normal` · `normal` · `big` · `mid` | `defense-catalog.js:549` |
| doctrine `pressureLane` | `chokepath` | `defense-catalog.js:549` |
| doctrine `midbossEnemy` | `ranged` | `defense-catalog.js:549` |
| 실제 `wavePlan` 슬롯 | 12 (midboss 슬롯 2) | `buildDoctrineWavePlan()` 산출 |
| 실제 doctrine primary 합 | **43** — authored 15 대비 2.87배 | §1.2 |
| 점유점 `occupation` | `glass-choir` @ (18200, 3200) r=800 hold=270t | `defense-catalog.js:439`~ |
| 추출점 `extraction` | `glass-bind` @ (16000, 3600) r=900 window=600t | `defense-catalog.js:439`~ |
| 스폰 방향 | `W` · `NW` | `defense-catalog.js:439`~ |

컷신 (`defense-catalog.js:263`) — 실제 존재 키: `intro`, `elite`, `victory`, `defeat` `[OBSERVED]`:

| 키 | 대사 |
|---|---|
| `intro[0]` | `유리 묘역의 고지가 여섯 번째 관문을 내려다본다.` |
| `intro[1]` | `반사되는 사선을 피해 추출점을 점유하라.` |
| `bossEntry` | **부재 — 이 키가 객체에 존재하지 않는다** |
| `elite` | `합창의 잔향이 깨진 기록면 위에 머문다.` |
| `victory` | `반사된 명령이 멎고 여섯 번째 봉쇄선이 이어졌다.` |
| `defeat` | `집중 사격이 관문을 깨뜨렸다. 여섯 번째 봉쇄선으로 복귀하라.` |

**5. Composition gaps** — 스테이지 1 과 동일 완성도까지 남은 것

1. **램프 상승 600 이 `COLLISION.stepHeight` 600 과 정확히 같다 — 여유 0.** `climbableFrom()`(`defense-run-simulation.js:212`)이 `<=` 비교라 현재는 통과하지만 마진이 없다. 캠페인에서 여유가 0 인 유일한 스테이지이며, `gate-zenith`(−80) 바로 위다. §4.1 S11 참조.
2. **보상 중복**: `throne-echo` 는 이미 `echo-throne`(3스테이지) 의 보상이다. 6스테이지 클리어가 새 동료를 주지 않는다.
3. **보상 ≠ lookout**: lookout 은 `requiem-warden`(`stage-world-catalog.js:284`) 으로 보스 Requiem Choir 와 이름이 맞지만, 보상은 `throne-echo` 다.
4. `cinematic.intro` 부재.
5. `meshColliders` 0개 — 이 스테이지에서는 `surfaces` 가 **유일한 고도 권위**가 된다(§4.1 S3).
6. `bossEntry` 부재 — Requiem Choir 등장 대사 없음.
7. world plate 2종 부재: `assets/images/battle/world/glass-necropolis-topdown-plate.webp`, `assets/images/battle/world/glass-necropolis-tactical-paper-plate.webp`.
8. `mapVariant`/`surpriseTable` 부재.

---

### 2.6 `starless-canal` — Starless Canal (캠페인 7/10)

**1. Identity**

| 항목 | 값 | 출처 |
|---|---|---|
| stage id | `starless-canal` | `defense-catalog.js:682` |
| display name | Starless Canal | `defense-catalog.js:682` |
| boss name | Lantern Tyrant | `defense-catalog.js:682` |
| campaign sequence | 7 / 10 | `STAGES` 배열 순서 · `stage-world-catalog.js:291` `sequence: 7` |
| art-file key | `starless-canal` | `app.js:129` `STAGE_ART_FILE_BY_ID` |
| editorial showcase | **`false`** (order 0) | `stage-world-catalog.js` `editorial(...)` |

**2. Runtime asset binding** — 전 항목 `fs.existsSync()` 확인 `[OBSERVED]`

| 역할 | 경로 | 상태 |
|---|---|---|
| terrain GLB | `assets/images/battle/glb/terrain/starless-canal.glb` | present |
| stage plate PNG | `assets/images/battle/ui/stages/starless-canal.png` | present |
| world plate — topdown | `assets/images/battle/world/starless-canal-topdown-plate.webp` | **absent** |
| world plate — tactical | `assets/images/battle/world/starless-canal-tactical-paper-plate.webp` | **absent** |
| boss GLB | `assets/images/battle/glb/bosses/lantern-tyrant.glb` | present |
| reward companion GLB | `assets/images/battle/glb/companions/anchor-shard.glb` | present |
| world lookout GLB | `assets/images/battle/glb/companions/lantern-reaver.glb` | present |

| 바인딩 식별자 | 값 | 해석 경로 |
|---|---|---|
| boss id | `s7-lantern-tyrant` | `battle-realtime-three.js` — `BOSS_MODELS["s7-lantern-tyrant"]` + `MODEL_ROOT`(`:121`) 접합 |
| elite id | `s7-toll-keeper` | `defense-catalog.js:682` — **전용 카탈로그 없음**: `ELITES` 라는 export 자체가 존재하지 않는다 `[OBSERVED]` |
| elite archetype (`eliteKind`) | `ranged` | `defense-catalog.js:682` · `ENEMIES` 4종(`rusher`/`flanker`/`guardian`/`ranged`) 중 하나로 해석됨 |
| reward companion | `anchor-shard` | `COMPANIONS` 카탈로그 등재 확인 · `COMPANION_MODELS`(`battle-realtime-three.js:152-162`) 매핑 확인 |
| world lookout actor | `lantern-reaver` — ⚠ **보상 동료와 불일치** | `stage-world-catalog.js:318` |
| stage item | `echo-compass` | `defense-catalog.js#STAGE_ITEM_IDS` |

**3. Presentation vocabulary** — `STAGE_PRESENTATION_BY_ID` 객체에서 직렬화, 표기 그대로 `[OBSERVED]`

팔레트 (`defense-catalog.js:736`):

| slot | id |
|---|---|
| `surface` | `surface-canal-ink` |
| `contour` | `contour-lock` |
| `landmark` | `landmark-towpath` |
| `hazard` | `hazard-undertow` |
| `objective` | `objective-toll` |

지형 패턴 (`defense-catalog.js:737`) — patternId `terrain.starless-canal.lock-stripes` · label `수문 줄무늬`

랜드마크 (`defense-catalog.js:738`):

- `landmark.canal-towpath` — `운하 견인로`
- `landmark.canal-lock` — `잠긴 수문`

분위기 (`defense-catalog.js:739`) — descriptor `별 없는 수로의 저류가 통행길을 끌어당긴다.` · motif `수문과 어두운 물결`

`mapLabels` 9개 키 전체 (`defense-catalog.js:740`):

| key | label |
|---|---|
| `title` | `별 없는 운하` |
| `domain` | `위험 수로 봉쇄선` |
| `chokepath` | `잠긴 수문` |
| `flank` | `수문 측면` |
| `elevation` | `운하 견인로` |
| `hazard` | `수로 저류` |
| `occupation` | `운하 통행점` |
| `extraction` | `결속 지점` |
| `objective` | `운하 통행점을 점유하고 결속하라.` |

병행 영문 분위기 (`stage-world-catalog.js` `presentation.atmosphere`) — descriptor
`A starless undertow pulls against the towpath.` · motif `locks and dark water` ·
fogNear `19.6` · fogFar `40.6` · accent `#16233f`

**4. Encounter composition**

authored wave table (`defense-catalog.js:682`) — `[tick, archetype, count]` `[OBSERVED]`:

| tick | archetype | count |
|---|---|---|
| 0 | `flanker` | 7 |
| 270 | `ranged` | 5 |
| 600 | `guardian` | 4 |
| — | **합계** | **16** &nbsp; (7 + 5 + 4 = 16) |

| 항목 | 값 | 출처 |
|---|---|---|
| `scale` — 계약의 "xpTarget" 자리 | **190** | `defense-catalog.js:682` |
| boss id | `s7-lantern-tyrant` | `defense-catalog.js:682` |
| `gateTicks` | 13200 (= doctrine `defenseTicks`) | `defense-catalog.js:665` |
| `legacyGateTicks` | 1080 — pre-doctrine 보존값 | `defense-catalog.js:682` |
| doctrine `gateIntegrity` | 2200 | `defense-catalog.js:550` |
| doctrine `waveCount` | 12 | `defense-catalog.js:550` |
| doctrine `classes` | `flanker` · `ranged` · `guardian` | `defense-catalog.js:550` |
| doctrine `kindCycle` | `normal` · `big` · `normal` · `mid` | `defense-catalog.js:550` |
| doctrine `pressureLane` | `flank` | `defense-catalog.js:550` |
| doctrine `midbossEnemy` | `ranged` | `defense-catalog.js:550` |
| 실제 `wavePlan` 슬롯 | 12 (midboss 슬롯 2) | `buildDoctrineWavePlan()` 산출 |
| 실제 doctrine primary 합 | **41** — authored 16 대비 2.56배 | §1.2 |
| 점유점 `occupation` | `canal-toll` @ (17600, 7600) r=900 hold=300t | `defense-catalog.js:448`~ |
| 추출점 `extraction` | `canal-bind` @ (15200, 8200) r=950 window=600t | `defense-catalog.js:448`~ |
| 스폰 방향 | `W` · `SW` · `NW` | `defense-catalog.js:448`~ |

컷신 (`defense-catalog.js:269`) — 실제 존재 키: `intro`, `elite`, `victory`, `defeat` `[OBSERVED]`:

| 키 | 대사 |
|---|---|
| `intro[0]` | `별 없는 운하가 일곱 번째 관문으로 갈라진다.` |
| `intro[1]` | `위험 수로의 추출점을 점유하고 통행 잔향을 회수하라.` |
| `bossEntry` | **부재 — 이 키가 객체에 존재하지 않는다** |
| `elite` | `통행의 잔향이 잠긴 수문에서 결속을 기다린다.` |
| `victory` | `수로의 명령이 끊기고 일곱 번째 봉쇄선이 이어졌다.` |
| `defeat` | `갈라진 수로가 관문을 포위했다. 일곱 번째 봉쇄선으로 복귀하라.` |

**5. Composition gaps** — 스테이지 1 과 동일 완성도까지 남은 것

1. **보상 중복**: `anchor-shard` 는 이미 `sunken-bastion`(4스테이지) 의 보상이다.
2. **보상 ≠ lookout**: lookout 은 `lantern-reaver`(`stage-world-catalog.js:318`) 로 보스 Lantern Tyrant 와 이름이 맞지만, 보상은 `anchor-shard` 다. `lantern-reaver.glb` 는 어떤 스테이지의 보상도 아니다.
3. `cinematic.intro` 부재.
4. `meshColliders` 0개 — 이 스테이지에서는 `surfaces` 가 **유일한 고도 권위**가 된다(§4.1 S3).
5. `bossEntry` 부재 — Lantern Tyrant 등장 대사 없음.
6. world plate 2종 부재: `assets/images/battle/world/starless-canal-topdown-plate.webp`, `assets/images/battle/world/starless-canal-tactical-paper-plate.webp`.
7. `mapVariant`/`surpriseTable` 부재.

---

### 2.7 `shattered-causeway` — Shattered Causeway (캠페인 8/10)

**1. Identity**

| 항목 | 값 | 출처 |
|---|---|---|
| stage id | `shattered-causeway` | `defense-catalog.js:683` |
| display name | Shattered Causeway | `defense-catalog.js:683` |
| boss name | Bridge Colossus | `defense-catalog.js:683` |
| campaign sequence | 8 / 10 | `STAGES` 배열 순서 · `stage-world-catalog.js:325` `sequence: 8` |
| art-file key | `shattered-causeway` | `app.js:130` `STAGE_ART_FILE_BY_ID` |
| editorial showcase | **`false`** (order 0) | `stage-world-catalog.js` `editorial(...)` |

**2. Runtime asset binding** — 전 항목 `fs.existsSync()` 확인 `[OBSERVED]`

| 역할 | 경로 | 상태 |
|---|---|---|
| terrain GLB | `assets/images/battle/glb/terrain/shattered-causeway.glb` | present |
| stage plate PNG | `assets/images/battle/ui/stages/shattered-causeway.png` | present |
| world plate — topdown | `assets/images/battle/world/shattered-causeway-topdown-plate.webp` | **absent** |
| world plate — tactical | `assets/images/battle/world/shattered-causeway-tactical-paper-plate.webp` | **absent** |
| boss GLB | `assets/images/battle/glb/bosses/bridge-colossus.glb` | present |
| reward companion GLB | `assets/images/battle/glb/companions/ember-cohort.glb` | present |
| world lookout GLB | `assets/images/battle/glb/companions/ember-cohort.glb` | present |

| 바인딩 식별자 | 값 | 해석 경로 |
|---|---|---|
| boss id | `s8-bridge-colossus` | `battle-realtime-three.js` — `BOSS_MODELS["s8-bridge-colossus"]` + `MODEL_ROOT`(`:121`) 접합 |
| elite id | `s8-keystone-warden` | `defense-catalog.js:683` — **전용 카탈로그 없음**: `ELITES` 라는 export 자체가 존재하지 않는다 `[OBSERVED]` |
| elite archetype (`eliteKind`) | `guardian` | `defense-catalog.js:683` · `ENEMIES` 4종(`rusher`/`flanker`/`guardian`/`ranged`) 중 하나로 해석됨 |
| reward companion | `ember-cohort` | `COMPANIONS` 카탈로그 등재 확인 · `COMPANION_MODELS`(`battle-realtime-three.js:152-162`) 매핑 확인 |
| world lookout actor | `ember-cohort` | `stage-world-catalog.js:351` |
| stage item | `hourglass-fragment` | `defense-catalog.js#STAGE_ITEM_IDS` |

**3. Presentation vocabulary** — `STAGE_PRESENTATION_BY_ID` 객체에서 직렬화, 표기 그대로 `[OBSERVED]`

팔레트 (`defense-catalog.js:743`):

| slot | id |
|---|---|
| `surface` | `surface-causeway-rubble` |
| `contour` | `contour-fracture` |
| `landmark` | `landmark-keystone` |
| `hazard` | `hazard-collapse` |
| `objective` | `objective-brace` |

지형 패턴 (`defense-catalog.js:744`) — patternId `terrain.shattered-causeway.rubble` · label `파편 더미`

랜드마크 (`defense-catalog.js:745`):

- `landmark.causeway-keystone` — `둑길 쐐기돌`
- `landmark.causeway-gap` — `끊긴 둑길`

분위기 (`defense-catalog.js:746`) — descriptor `부서진 둑길의 틈이 관문 앞에서 흔들린다.` · motif `붕괴선과 쐐기돌`

`mapLabels` 9개 키 전체 (`defense-catalog.js:747`):

| key | label |
|---|---|
| `title` | `부서진 둑길` |
| `domain` | `교량 봉쇄선` |
| `chokepath` | `끊긴 둑길` |
| `flank` | `파편 측면` |
| `elevation` | `둑길 쐐기돌` |
| `hazard` | `둑길 붕괴` |
| `occupation` | `둑길 버팀점` |
| `extraction` | `결속 지점` |
| `objective` | `둑길 버팀점을 지켜 결속하라.` |

병행 영문 분위기 (`stage-world-catalog.js` `presentation.atmosphere`) — descriptor
`The broken causeway trembles before the Gate.` · motif `collapse lines and keystone mass` ·
fogNear `22.4` · fogFar `49` · accent `#8a674f`

**4. Encounter composition**

authored wave table (`defense-catalog.js:683`) — `[tick, archetype, count]` `[OBSERVED]`:

| tick | archetype | count |
|---|---|---|
| 0 | `rusher` | 8 |
| 280 | `ranged` | 6 |
| 630 | `guardian` | 4 |
| — | **합계** | **18** &nbsp; (8 + 6 + 4 = 18) |

| 항목 | 값 | 출처 |
|---|---|---|
| `scale` — 계약의 "xpTarget" 자리 | **205** | `defense-catalog.js:683` |
| boss id | `s8-bridge-colossus` | `defense-catalog.js:683` |
| `gateTicks` | 13800 (= doctrine `defenseTicks`) | `defense-catalog.js:665` |
| `legacyGateTicks` | 1140 — pre-doctrine 보존값 | `defense-catalog.js:683` |
| doctrine `gateIntegrity` | 2300 | `defense-catalog.js:551` |
| doctrine `waveCount` | 12 | `defense-catalog.js:551` |
| doctrine `classes` | `rusher` · `ranged` · `guardian` | `defense-catalog.js:551` |
| doctrine `kindCycle` | `big` · `normal` · `normal` · `mid` | `defense-catalog.js:551` |
| doctrine `pressureLane` | `chokepath` | `defense-catalog.js:551` |
| doctrine `midbossEnemy` | `guardian` | `defense-catalog.js:551` |
| 실제 `wavePlan` 슬롯 | 12 (midboss 슬롯 2) | `buildDoctrineWavePlan()` 산출 |
| 실제 doctrine primary 합 | **40** — authored 18 대비 2.22배 | §1.2 |
| 점유점 `occupation` | `causeway-brace` @ (18400, 4400) r=800 hold=300t | `defense-catalog.js:457`~ |
| 추출점 `extraction` | `causeway-bind` @ (16400, 4000) r=900 window=600t | `defense-catalog.js:457`~ |
| 스폰 방향 | `W` · `NW` | `defense-catalog.js:457`~ |

컷신 (`defense-catalog.js:275`) — 실제 존재 키: `intro`, `elite`, `victory`, `defeat` `[OBSERVED]`:

| 키 | 대사 |
|---|---|
| `intro[0]` | `부서진 둑길이 여덟 번째 관문 앞에서 끊겼다.` |
| `intro[1]` | `붕괴 구간의 추출점을 점유하고 교량 잔향을 결속하라.` |
| `bossEntry` | **부재 — 이 키가 객체에 존재하지 않는다** |
| `elite` | `교량의 잔향이 무너진 연결부를 붙든다.` |
| `victory` | `거상의 압력이 멎고 여덟 번째 봉쇄선이 이어졌다.` |
| `defeat` | `붕괴 충격이 관문에 닿았다. 여덟 번째 봉쇄선으로 복귀하라.` |

**5. Composition gaps** — 스테이지 1 과 동일 완성도까지 남은 것

1. **보상 중복**: `ember-cohort` 는 이미 `cinder-span`(1스테이지) 의 보상이다. 8스테이지 보상이 튜토리얼 스테이지 보상과 같다.
2. lookout 도 `ember-cohort` 로, 1스테이지 lookout 을 그대로 재사용한다(`stage-world-catalog.js:351` vs `:118`).
3. `cinematic.intro` 부재.
4. `meshColliders` 0개 — 이 스테이지에서는 `surfaces` 가 **유일한 고도 권위**가 된다(§4.1 S3).
5. `bossEntry` 부재 — Bridge Colossus 등장 대사 없음.
6. world plate 2종 부재: `assets/images/battle/world/shattered-causeway-topdown-plate.webp`, `assets/images/battle/world/shattered-causeway-tactical-paper-plate.webp`.
7. `mapVariant`/`surpriseTable` 부재.

---

### 2.8 `abyss-chancel` — Abyss Chancel (캠페인 9/10)

**1. Identity**

| 항목 | 값 | 출처 |
|---|---|---|
| stage id | `abyss-chancel` | `defense-catalog.js:684` |
| display name | Abyss Chancel | `defense-catalog.js:684` |
| boss name | Veiled Concordat | `defense-catalog.js:684` |
| campaign sequence | 9 / 10 | `STAGES` 배열 순서 · `stage-world-catalog.js:358` `sequence: 9` |
| art-file key | `abyss-chancel` | `app.js:131` `STAGE_ART_FILE_BY_ID` |
| editorial showcase | **`false`** (order 0) | `stage-world-catalog.js` `editorial(...)` |

**2. Runtime asset binding** — 전 항목 `fs.existsSync()` 확인 `[OBSERVED]`

| 역할 | 경로 | 상태 |
|---|---|---|
| terrain GLB | `assets/images/battle/glb/terrain/abyss-chancel.glb` | present |
| stage plate PNG | `assets/images/battle/ui/stages/abyss-chancel.png` | present |
| world plate — topdown | `assets/images/battle/world/abyss-chancel-topdown-plate.webp` | **absent** |
| world plate — tactical | `assets/images/battle/world/abyss-chancel-tactical-paper-plate.webp` | **absent** |
| boss GLB | `assets/images/battle/glb/bosses/veiled-concordat.glb` | present |
| reward companion GLB | `assets/images/battle/glb/companions/dawnless-crown.glb` | present |
| world lookout GLB | `assets/images/battle/glb/companions/requiem-warden.glb` | present |

| 바인딩 식별자 | 값 | 해석 경로 |
|---|---|---|
| boss id | `s9-veiled-concordat` | `battle-realtime-three.js` — `BOSS_MODELS["s9-veiled-concordat"]` + `MODEL_ROOT`(`:121`) 접합 |
| elite id | `s9-oathbound-signatory` | `defense-catalog.js:684` — **전용 카탈로그 없음**: `ELITES` 라는 export 자체가 존재하지 않는다 `[OBSERVED]` |
| elite archetype (`eliteKind`) | `guardian` | `defense-catalog.js:684` · `ENEMIES` 4종(`rusher`/`flanker`/`guardian`/`ranged`) 중 하나로 해석됨 |
| reward companion | `dawnless-crown` | `COMPANIONS` 카탈로그 등재 확인 · `COMPANION_MODELS`(`battle-realtime-three.js:152-162`) 매핑 확인 |
| world lookout actor | `requiem-warden` — ⚠ **보상 동료와 불일치** | `stage-world-catalog.js:385` |
| stage item | `ashen-sigil` | `defense-catalog.js#STAGE_ITEM_IDS` |

**3. Presentation vocabulary** — `STAGE_PRESENTATION_BY_ID` 객체에서 직렬화, 표기 그대로 `[OBSERVED]`

팔레트 (`defense-catalog.js:750`):

| slot | id |
|---|---|
| `surface` | `surface-chancel-abyss` |
| `contour` | `contour-oath` |
| `landmark` | `landmark-apse` |
| `hazard` | `hazard-oath` |
| `objective` | `objective-oath` |

지형 패턴 (`defense-catalog.js:751`) — patternId `terrain.abyss-chancel.oath-rings` · label `서약 고리`

랜드마크 (`defense-catalog.js:752`):

- `landmark.chancel-apse` — `예배소 후진`
- `landmark.chancel-nave` — `예배소 본당`

분위기 (`defense-catalog.js:753`) — descriptor `심연 예배소의 서약이 관문 위로 압력을 드리운다.` · motif `서약 고리와 가려진 서명`

`mapLabels` 9개 키 전체 (`defense-catalog.js:754`):

| key | label |
|---|---|
| `title` | `심연 예배소` |
| `domain` | `서약의 봉쇄선` |
| `chokepath` | `예배소 본당` |
| `flank` | `교차 회랑 측면` |
| `elevation` | `예배소 후진` |
| `hazard` | `서약의 압력` |
| `occupation` | `예배소 서약` |
| `extraction` | `결속 지점` |
| `objective` | `예배소 서약을 역전해 결속하라.` |

병행 영문 분위기 (`stage-world-catalog.js` `presentation.atmosphere`) — descriptor
`Oath-pressure hangs above the chancel nave.` · motif `oath rings and veiled signatures` ·
fogNear `19.6` · fogFar `42` · accent `#6f4e8b`

**4. Encounter composition**

authored wave table (`defense-catalog.js:684`) — `[tick, archetype, count]` `[OBSERVED]`:

| tick | archetype | count |
|---|---|---|
| 0 | `flanker` | 8 |
| 300 | `ranged` | 6 |
| 660 | `guardian` | 5 |
| — | **합계** | **19** &nbsp; (8 + 6 + 5 = 19) |

| 항목 | 값 | 출처 |
|---|---|---|
| `scale` — 계약의 "xpTarget" 자리 | **220** | `defense-catalog.js:684` |
| boss id | `s9-veiled-concordat` | `defense-catalog.js:684` |
| `gateTicks` | 14400 (= doctrine `defenseTicks`) | `defense-catalog.js:665` |
| `legacyGateTicks` | 1200 — pre-doctrine 보존값 | `defense-catalog.js:684` |
| doctrine `gateIntegrity` | 2400 | `defense-catalog.js:552` |
| doctrine `waveCount` | 13 | `defense-catalog.js:552` |
| doctrine `classes` | `flanker` · `ranged` · `guardian` | `defense-catalog.js:552` |
| doctrine `kindCycle` | `normal` · `big` · `normal` · `mid` | `defense-catalog.js:552` |
| doctrine `pressureLane` | `chokepath` | `defense-catalog.js:552` |
| doctrine `midbossEnemy` | `guardian` | `defense-catalog.js:552` |
| 실제 `wavePlan` 슬롯 | 13 (midboss 슬롯 3) | `buildDoctrineWavePlan()` 산출 |
| 실제 doctrine primary 합 | **38** — authored 19 대비 2.00배 | §1.2 |
| 점유점 `occupation` | `chancel-oath` @ (18200, 5200) r=800 hold=330t | `defense-catalog.js:466`~ |
| 추출점 `extraction` | `chancel-bind` @ (16000, 7000) r=850 window=600t | `defense-catalog.js:466`~ |
| 스폰 방향 | `W` · `SW` · `NW` | `defense-catalog.js:466`~ |

컷신 (`defense-catalog.js:281`) — 실제 존재 키: `intro`, `elite`, `victory`, `defeat` `[OBSERVED]`:

| 키 | 대사 |
|---|---|
| `intro[0]` | `심연 예배소의 서약이 아홉 번째 관문을 억누른다.` |
| `intro[1]` | `서약의 추출점을 점유하고 명령 잔향을 역전하라.` |
| `bossEntry` | **부재 — 이 키가 객체에 존재하지 않는다** |
| `elite` | `서명자의 잔향이 결속할 새 명령을 기다린다.` |
| `victory` | `가려진 서약이 끊기고 아홉 번째 봉쇄선이 이어졌다.` |
| `defeat` | `서약의 압력이 관문을 닫았다. 아홉 번째 봉쇄선으로 복귀하라.` |

**5. Composition gaps** — 스테이지 1 과 동일 완성도까지 남은 것

1. **보상 ≠ lookout**: 보상 `dawnless-crown`, lookout `requiem-warden`(`stage-world-catalog.js:385`) — `requiem-warden` 은 6스테이지 lookout 재사용이며 어떤 스테이지의 보상도 아니다.
2. **보상이 최종 스테이지와 중복**: `dawnless-crown` 은 `gate-zenith`(10스테이지) 의 보상이기도 하다. 9·10 연속 동일 보상.
3. `cinematic.intro` 부재 — 캠페인 종반 서약 장면이 연출 없이 시작된다.
4. `meshColliders` 0개 — 이 스테이지에서는 `surfaces` 가 **유일한 고도 권위**가 된다(§4.1 S3).
5. `bossEntry` 부재 — Veiled Concordat 등장 대사 없음.
6. world plate 2종 부재: `assets/images/battle/world/abyss-chancel-topdown-plate.webp`, `assets/images/battle/world/abyss-chancel-tactical-paper-plate.webp`.
7. `mapVariant`/`surpriseTable` 부재.

---

### 2.9 `gate-zenith` — Gate Zenith (캠페인 10/10)

**1. Identity**

| 항목 | 값 | 출처 |
|---|---|---|
| stage id | `gate-zenith` | `defense-catalog.js:685` |
| display name | Gate Zenith | `defense-catalog.js:685` |
| boss name | Abyss Regent | `defense-catalog.js:685` |
| campaign sequence | 10 / 10 | `STAGES` 배열 순서 · `stage-world-catalog.js:392` `sequence: 10` |
| art-file key | `gate-zenith` | `app.js:132` `STAGE_ART_FILE_BY_ID` |
| editorial showcase | **`false`** (order 0) | `stage-world-catalog.js` `editorial(...)` |

**2. Runtime asset binding** — 전 항목 `fs.existsSync()` 확인 `[OBSERVED]`

| 역할 | 경로 | 상태 |
|---|---|---|
| terrain GLB | `assets/images/battle/glb/terrain/gate-zenith.glb` | present |
| stage plate PNG | `assets/images/battle/ui/stages/gate-zenith.png` | present |
| world plate — topdown | `assets/images/battle/world/gate-zenith-topdown-plate.webp` | **absent** |
| world plate — tactical | `assets/images/battle/world/gate-zenith-tactical-paper-plate.webp` | **absent** |
| boss GLB | `assets/images/battle/glb/bosses/abyss-regent.glb` | present |
| reward companion GLB | `assets/images/battle/glb/companions/dawnless-crown.glb` | present |
| world lookout GLB | `assets/images/battle/glb/companions/dawnless-crown.glb` | present |

| 바인딩 식별자 | 값 | 해석 경로 |
|---|---|---|
| boss id | `s10-abyss-regent` | `battle-realtime-three.js` — `BOSS_MODELS["s10-abyss-regent"]` + `MODEL_ROOT`(`:121`) 접합 |
| elite id | `s10-regent-herald` | `defense-catalog.js:685` — **전용 카탈로그 없음**: `ELITES` 라는 export 자체가 존재하지 않는다 `[OBSERVED]` |
| elite archetype (`eliteKind`) | `flanker` | `defense-catalog.js:685` · `ENEMIES` 4종(`rusher`/`flanker`/`guardian`/`ranged`) 중 하나로 해석됨 |
| reward companion | `dawnless-crown` | `COMPANIONS` 카탈로그 등재 확인 · `COMPANION_MODELS`(`battle-realtime-three.js:152-162`) 매핑 확인 |
| world lookout actor | `dawnless-crown` | `stage-world-catalog.js:418` |
| stage item | `dawnless-crown-shard` | `defense-catalog.js#STAGE_ITEM_IDS` |

**3. Presentation vocabulary** — `STAGE_PRESENTATION_BY_ID` 객체에서 직렬화, 표기 그대로 `[OBSERVED]`

팔레트 (`defense-catalog.js:757`):

| slot | id |
|---|---|
| `surface` | `surface-zenith-void` |
| `contour` | `contour-threshold` |
| `landmark` | `landmark-crown` |
| `hazard` | `hazard-command` |
| `objective` | `objective-last-seal` |

지형 패턴 (`defense-catalog.js:758`) — patternId `terrain.gate-zenith.threshold-rays` · label `문턱 광선`

랜드마크 (`defense-catalog.js:759`):

- `landmark.zenith-crown` — `정점의 왕관`
- `landmark.zenith-threshold` — `관문의 문턱`

분위기 (`defense-catalog.js:760`) — descriptor `관문 정점에서 명령망이 심연과 맞닿는다.` · motif `문턱 광선과 마지막 봉인`

`mapLabels` 9개 키 전체 (`defense-catalog.js:761`):

| key | label |
|---|---|
| `title` | `관문 정점` |
| `domain` | `마지막 봉쇄선` |
| `chokepath` | `관문의 문턱` |
| `flank` | `그림자 측면` |
| `elevation` | `정점의 왕관` |
| `hazard` | `심연의 명령` |
| `occupation` | `마지막 봉인` |
| `extraction` | `마지막 결속 지점` |
| `objective` | `마지막 봉인을 지키고 관문을 방어하라.` |

병행 영문 분위기 (`stage-world-catalog.js` `presentation.atmosphere`) — descriptor
`At the Zenith, the command network touches the abyss.` · motif `threshold rays and the last seal` ·
fogNear `29.4` · fogFar `64.4` · accent `#d5ae58`

**4. Encounter composition**

authored wave table (`defense-catalog.js:685`) — `[tick, archetype, count]` `[OBSERVED]`:

| tick | archetype | count |
|---|---|---|
| 0 | `rusher` | 9 |
| 300 | `ranged` | 7 |
| 690 | `guardian` | 5 |
| — | **합계** | **21** &nbsp; (9 + 7 + 5 = 21) |

| 항목 | 값 | 출처 |
|---|---|---|
| `scale` — 계약의 "xpTarget" 자리 | **240** | `defense-catalog.js:685` |
| boss id | `s10-abyss-regent` | `defense-catalog.js:685` |
| `gateTicks` | 15000 (= doctrine `defenseTicks`) | `defense-catalog.js:665` |
| `legacyGateTicks` | 1260 — pre-doctrine 보존값 | `defense-catalog.js:685` |
| doctrine `gateIntegrity` | 2500 | `defense-catalog.js:553` |
| doctrine `waveCount` | 13 | `defense-catalog.js:553` |
| doctrine `classes` | `rusher` · `ranged` · `guardian` | `defense-catalog.js:553` |
| doctrine `kindCycle` | `big` · `normal` · `big` · `mid` | `defense-catalog.js:553` |
| doctrine `pressureLane` | `chokepath` | `defense-catalog.js:553` |
| doctrine `midbossEnemy` | `guardian` | `defense-catalog.js:553` |
| 실제 `wavePlan` 슬롯 | 13 (midboss 슬롯 3) | `buildDoctrineWavePlan()` 산출 |
| 실제 doctrine primary 합 | **43** — authored 21 대비 2.05배 | §1.2 |
| 점유점 `occupation` | `zenith-last-seal` @ (18800, 6000) r=750 hold=360t | `defense-catalog.js:475`~ |
| 추출점 `extraction` | `zenith-bind` @ (16600, 6000) r=850 window=600t | `defense-catalog.js:475`~ |
| 스폰 방향 | `W` · `NW` · `SW` | `defense-catalog.js:475`~ |

컷신 (`defense-catalog.js:287`) — 실제 존재 키: `intro`, `elite`, `victory`, `defeat` `[OBSERVED]`:

| 키 | 대사 |
|---|---|
| `intro[0]` | `Gate Zenith에서 Moonless Court의 명령망이 Echo Deep과 맞닿는다.` |
| `intro[1]` | `Dusk Warden, 마지막 추출점을 점유하고 열 번째 관문을 지켜라.` |
| `bossEntry` | **부재 — 이 키가 객체에 존재하지 않는다** |
| `elite` | `섭정의 잔향이 마지막 결속 신호로 남는다.` |
| `victory` | `Moonless Court의 명령망이 끊겼다. 열 번째 봉쇄선은 유지되고 Echo Deep은 남는다.` |
| `defeat` | `마지막 관문이 무너졌다. Dusk Warden, 열 번째 봉쇄선으로 복귀하라.` |

**5. Composition gaps** — 스테이지 1 과 동일 완성도까지 남은 것

1. **램프 상승폭 680 > `COLLISION.stepHeight` 600 — 캠페인 유일, 여유 −80.** 램프는 x축 1,700 단위 경사(0→680)라 점진 보행은 성립하지만, 플랫폼 상단(680)과 평지(0) 사이 **경계 진입은 한 스텝으로 오를 수 없다**. `defense-run-simulation.js:211-213` `climbableFrom()` 이 거부하고 `:287-293` 이 slideX/slideY 도 실패하면 **이동을 취소**한다(`resolved = origin`). lookout 은 그 680 플랫폼 위에 있다(`stage-world-catalog.js:418`). 덧붙여 플랫폼 680 은 `COMBAT_TARGETING.elevationTolerance` 700 에 **20 단위**까지 근접해 고도차 교전 여유도 캠페인 최소다. 전체 분해는 §4.3.
2. **보상 중복**: `dawnless-crown` 이 `abyss-chancel`(9스테이지) 과 동일. 캠페인 최종 보상이 새롭지 않다.
3. `cinematic.intro` 부재 — **캠페인 최종 스테이지에 등장 연출이 없다**.
4. `meshColliders` 0개 — 이 스테이지에서는 `surfaces` 가 **유일한 고도 권위**가 된다(§4.1 S3).
5. `bossEntry` 부재 — 최종 보스 Abyss Regent 등장 대사 없음.
6. world plate 2종 부재: `assets/images/battle/world/gate-zenith-topdown-plate.webp`, `assets/images/battle/world/gate-zenith-tactical-paper-plate.webp`.
7. `mapVariant`/`surpriseTable` 부재.

---

## 3. ID / 파일명 불일치 전수 조사

계약이 지목한 `echo-throne` 사례 외에 다른 불일치가 있는지 **여섯 축을 전수 대조**했다 `[OBSERVED]`.
대조 대상: `app.js#STAGE_ART_FILE_BY_ID` 10행, `stage-world-catalog.js` 의 `terrainGlbPath` 10건,
`battle-realtime-three.js#BOSS_MODELS` 10행, `assets/images/battle/ui/stages/` 10파일,
`assets/images/battle/glb/terrain/` 10파일, `assets/images/battle/glb/bosses/` 10파일.

| 축 | 검사 | 결과 |
|---|---|---|
| A | `STAGE_ART_FILE_BY_ID` 의 key ≠ value | **1건** — `echo-throne` → `echo-throne-steps` (`app.js:125`) |
| B | `terrainGlbPath` 기저명 ≠ stage id | **1건** — `echo-throne` → `echo-throne-steps.glb` (`stage-world-catalog.js:160`) |
| C | `terrainGlbPath` 기저명 ≠ art-file key | **0건** — 10/10 일치 |
| D | boss GLB 파일명 ≠ `bossName` 슬러그 | **0건** — 10/10 일치 |
| E | boss GLB 파일명 ≠ `bossId` 접미부(`s\d+-` 제거) | **0건** — 10/10 일치 |
| F | 디스크 고아 파일(어떤 스테이지에도 안 묶인 파일) | **0건** — `ui/stages/` 10/10, `glb/terrain/` 10/10 모두 바인딩됨 |

### 3.1 유일한 불일치: `echo-throne`

불일치는 **한 건이며, 두 표면에 나타난다** `[OBSERVED]`:

| 표면 | 선언 | 결과 경로 | 디스크 |
|---|---|---|---|
| art-file key | `app.js:125` `"echo-throne": "echo-throne-steps"` | `assets/images/battle/ui/stages/echo-throne-steps.png` | present |
| terrain GLB | `stage-world-catalog.js:160` `terrainGlbPath` | `assets/images/battle/glb/terrain/echo-throne-steps.glb` | present |

두 표면이 **동일한 `echo-throne-steps` 기저명**을 쓰고 디스크 파일명과도 일치한다. 축 C 가 0건이라는 것이
그 확인이다. 즉 이것은 **깨진 참조가 아니라 일관되게 적용된 명명 규약 이탈**이다 `[OBSERVED]`.

파생 영향 `[INFERENCE — 위 규약에서 도출]`: 이 스테이지의 world plate 를 나중에 만들 때 파일명은
stage id 가 아니라 art-file key 를 따라야 한다 — `echo-throne-steps-topdown-plate.webp`,
`echo-throne-steps-tactical-paper-plate.webp`. §2.2 와 §4 S1 에 그 이름으로 기재했다.

### 3.2 불일치는 아니지만 기록해야 할 ID 발산: 보상 동료 ≠ 배치 lookout

파일명 문제는 아니나, **보상으로 주는 동료와 그 맵에 실제로 서 있는 lookout 이 서로 다른 스테이지가
4건 있다** `[OBSERVED]`:

| # | id | 보상 동료 (`eliteCompanion`) | 배치 lookout (`presentation.npcs[0].actorId`) | 보스 |
|---|---|---|---|---|
| 5 | `howling-sprawl` | `veil-vanguard` | `pack-warden` | Pack Herald |
| 6 | `glass-necropolis` | `throne-echo` | `requiem-warden` | Requiem Choir |
| 7 | `starless-canal` | `anchor-shard` | `lantern-reaver` | Lantern Tyrant |
| 9 | `abyss-chancel` | `dawnless-crown` | `requiem-warden` | Veiled Concordat |

네 건 모두 **lookout 쪽이 보스/스테이지 주제와 이름이 맞고, 보상 쪽이 어긋난다** `[OBSERVED]`:
`Pack Herald` 맵에 `pack-warden` 이 서 있는데 보상은 `veil-vanguard`, `Requiem Choir` 맵에
`requiem-warden` 이 서 있는데 보상은 `throne-echo`, `Lantern Tyrant` 맵에 `lantern-reaver` 가
서 있는데 보상은 `anchor-shard` 다.

그 결과 **동료 GLB 3종이 어떤 스테이지의 보상도 아니다** `[OBSERVED]` — 디스크·허용목록·매니페스트에는
모두 정상 등재되어 있다:

| 동료 | GLB | 디스크 | 역할 |
|---|---|---|---|
| `pack-warden` | `assets/images/battle/glb/companions/pack-warden.glb` | present | lookout 전용 (`howling-sprawl`) — 보상 아님 |
| `requiem-warden` | `assets/images/battle/glb/companions/requiem-warden.glb` | present | lookout 전용 (`glass-necropolis`, `abyss-chancel`) — 보상 아님 |
| `lantern-reaver` | `assets/images/battle/glb/companions/lantern-reaver.glb` | present | lookout 전용 (`starless-canal`) — 보상 아님 |

---

## 4. 캠페인 전역 구성 격차 원장

출하 저지력(shipping blocker) 순으로 정렬한다. **체계적 격차**(다수 스테이지 공통)를 먼저,
**스테이지 고유 격차**를 뒤에 둔다. 명명 가능한 누락 산출물은 정확한 경로를 적었다.

### 4.1 체계적 격차 — 다수 스테이지에 걸침

| # | 격차 | 영향 범위 | 소비처 존재 | 저지력 |
|---|---|---|---|---|
| S1 | world plate 부재 | 9/9 (18파일) | **있음** (하드코딩) | 상 |
| S2 | `cinematic.intro` 부재 | 9/9 | **있음** (라이브) | 상 |
| S3 | `meshColliders` 부재 | 9/9 | **있음** (라이브) | 중상 |
| S4 | `surpriseTable` 부재 | 9/9 | **있음** (라이브) | 중 |
| S5 | `CUTSCENES.bossEntry` 부재 | 9/9 | **없음** | 중 |
| S6 | doctrine 주석 낡음 (`squadBase`) | 10/10 | 해당 없음 | 중하 |
| S7 | `mapVariant`/`protectedCorridor` 부재 | 9/9 | **없음** | 중하 |
| S8 | 쇼케이스 노출 불가 | 7/9 | 강제 상한 | 중하 |
| S9 | 보상 동료 중복·발산 | 6/9 | 해당 없음 | 중하 |
| S10 | 테스트 커버리지 비대칭 | 9/9 | 해당 없음 | 하 |

#### S1 — world plate 부재 (9/9, 누락 18파일) · 저지력 **상**

`assets/images/battle/world/` 에는 cinder-span 2파일만 있다 `[OBSERVED]`. 누락 경로 전체
(art-file key 기준, §3.1 규약 적용):

- `assets/images/battle/world/veil-citadel-topdown-plate.webp` · `assets/images/battle/world/veil-citadel-tactical-paper-plate.webp`
- `assets/images/battle/world/echo-throne-steps-topdown-plate.webp` · `assets/images/battle/world/echo-throne-steps-tactical-paper-plate.webp`
- `assets/images/battle/world/sunken-bastion-topdown-plate.webp` · `assets/images/battle/world/sunken-bastion-tactical-paper-plate.webp`
- `assets/images/battle/world/howling-sprawl-topdown-plate.webp` · `assets/images/battle/world/howling-sprawl-tactical-paper-plate.webp`
- `assets/images/battle/world/glass-necropolis-topdown-plate.webp` · `assets/images/battle/world/glass-necropolis-tactical-paper-plate.webp`
- `assets/images/battle/world/starless-canal-topdown-plate.webp` · `assets/images/battle/world/starless-canal-tactical-paper-plate.webp`
- `assets/images/battle/world/shattered-causeway-topdown-plate.webp` · `assets/images/battle/world/shattered-causeway-tactical-paper-plate.webp`
- `assets/images/battle/world/abyss-chancel-topdown-plate.webp` · `assets/images/battle/world/abyss-chancel-tactical-paper-plate.webp`
- `assets/images/battle/world/gate-zenith-topdown-plate.webp` · `assets/images/battle/world/gate-zenith-tactical-paper-plate.webp`

**파일만 만들어서는 해결되지 않는다** — `battle-visualizer.js:22-25` `WORLD_TEXTURES` 가 두 항목을
cinder-span 으로 하드코딩하고 있어 스테이지별 조회 경로가 없다 `[OBSERVED]`. 따라서 이 격차는
**자산 18개 + 렌더러 조회 경로 변경**의 2부 작업이다 `[INFERENCE]`. 파일 추가 시
`scripts/defense-runtime-assets.mjs#RETAINED_ASSET_PATHS`,
`.github/workflows/static.yml#PAGES_RUNTIME_PATHS`, `assets/defense-asset-manifest.json` 3중 동기화가 필요하다.

#### S2 — `cinematic.intro` 부재 (9/9) · 저지력 **상**

`presentation.cinematic.intro` 는 `cinder-span` 에만 있다 `[OBSERVED]`
(`stage-world-catalog.js:102-108`: `durationTicks 90`, `from {distance 6, azimuth -0.24, polar -0.34}`
→ `to {0, 0, 0}`). 소비처는 **라이브**다 — `battle-realtime-three.js:2453`:

```js
const intro = stageWorldFor(resolveStageId(snapshot))?.presentation?.cinematic?.intro;
```

`?.` 옵셔널 체이닝이라 크래시는 없고 **연출만 조용히 사라진다** `[OBSERVED]`. 결과적으로
스테이지 2–10 은 **캠페인 최종전(`gate-zenith`) 을 포함해 전부 카메라 도입부 없이 즉시 시작된다**.
스키마 검증기(`stage-world-catalog.js:540-543`)는 `cinematic` 객체가 있는데 `intro` 가 없을 때만
throw 하므로, `cinematic` 자체가 없는 9개 스테이지는 통과한다.

#### S3 — `meshColliders` 부재 (9/9) · 저지력 **중상**

`gameplay.meshColliders` 는 `cinder-span` 만 보유한다 `[OBSERVED]` —
`stage-world-catalog.js:88-97`, 1개 콜라이더 `cinder-span:walkable-support`, 삼각형 6개.
나머지 9개는 **0개**다. 검증기 `stage-world-catalog.js:512-514` 는 cinder-span 에만 존재를 강제한다:

```js
if (profile.stageId === "cinder-span" && meshColliders.length === 0) {
  throw new Error("Cinder Span requires an authored walkable support mesh.");
}
```

영향은 시뮬레이션 내부다 `[OBSERVED]`. `defense-run-simulation.js:79-81` `terrainSupportAt()` 은
**먼저 `meshSupportAt()` 을 시도하고 적중하면 즉시 반환한다** — 즉 mesh 가 `surfaces` 루프보다 **우선한다**:

```js
function terrainSupportAt(world, x, y) {
  const meshSupport = meshSupportAt(world, x, y);
  if (meshSupport) return meshSupport;   // ← 조기 반환: surfaces 루프에 도달하지 않음
  …
```

이 우선순위가 두 계층의 의미를 갈라놓는다 `[OBSERVED]`:

- **`cinder-span`**: 콜라이더가 **1차 고도 권위**이고 `surfaces` 의 ramp/platform 은 **폴백**이다.
- **스테이지 2–10**: 콜라이더가 없으므로 `surfaces` 의 축정렬 사각형이 **유일한 고도 권위**다.

따라서 스테이지 2–10 은 삼각형 단위 판정 없이 AABB 근사만으로 접지하며, §4.1 S11 의 고도 소비 문제는
**전적으로 이 9개 스테이지에 떨어진다**. 또한 `:2895` `usesMeshSupport` 가 false 가 되어
`:2900-2901` 의 접지 무결성 재검증이 mesh 경로 대신 `staleNonMeshContact` 경로를 탄다.

부수 결론 `[INFERENCE — 위 우선순위 관측에서 도출]`: `pcg-stage-layout-spec.md` §1.1 이 제안한
`decor-ramp`/`decor-platform` 개명은 **`cinder-span` 의 실제 고도 해석을 바꾸지 못한다** — 그 스테이지는
콜라이더가 우선이므로 surfaces 를 장식으로 재분류해도 해석 경로가 그대로다. 반대로 스테이지 2–10 에서는
같은 개명이 **유일한 고도 권위를 장식으로 재분류하는 것**이 된다. 두 계층은 함께 정리되어야 한다.

#### S4 — `surpriseTable` 부재 (9/9) · 저지력 **중**

`STAGE_TACTICS[].surpriseTable` 은 `cinder-span` 만 보유한다(`defense-catalog.js:401`,
`CINDER_SPAN_SURPRISE_TABLE`) `[OBSERVED]`. 소비처는 **라이브**다 —
`defense-run-simulation.js:2664-2672` 가 없으면 `rawSurprise = null` 로 떨어지고,
`:2872` `if (loreSurprise) emit(state, "LORE_SURPRISE_RESOLVED", …)` 가 발화하지 않는다.

`LORE_SURPRISE_RESOLVED` 는 `defense-cutscene.js:83-85` 에서 **유일하게 `narration` captionMode 를
트리거하는 이벤트**이며 `defense-audio.js:216-219` 에서 `method: "narrate"` 오디오 경로를 연다 `[OBSERVED]`.
따라서 스테이지 2–10 은 **내레이션 연출 채널 자체를 한 번도 사용하지 않는다**.

#### S5 — `CUTSCENES.bossEntry` 부재 (9/9) · 저지력 **중**

`bossEntry` 키는 `defense-catalog.js:234` 의 `cinder-span` 항목에만 존재한다 `[OBSERVED]`.
스테이지 2–10 의 컷신 객체 키는 전부 `intro`/`elite`/`victory`/`defeat` 4개다.

**폴백도 없다** `[OBSERVED]`: `defense-run-simulation.js:43` 은
`CUTSCENES[stage.id] || CUTSCENES.default` 인데, 9개 스테이지 모두 `CUTSCENES[stage.id]` 가
존재하므로 `default` 로 내려가지 않는다. 그리고 `CUTSCENES.default` 자체도 키가
`intro`/`elite`/`victory`/`defeat` 뿐이라 **bossEntry 는 어느 경로로도 얻을 수 없다**.

**단, 저지력을 정직하게 낮춰 적는다**: `bossEntry` 는 **런타임 소비처가 저장소 전체에 0건이다**
`[OBSERVED]`. 실제로 읽히는 키는 `intro`(`defense-run-simulation.js:2869`),
`elite`(`:1838`), `defeat`(`:2567`), `victory`(`:2587`) 넷뿐이다. 즉 스테이지 2–10 이 놓치고 있는 것은
**현재 어디서도 재생되지 않는 대사**다. 데이터 격차는 실재하나, 지금 화면에 비는 자리는 아니다.

#### S6 — doctrine 주석이 실제 데이터와 불일치 (10/10) · 저지력 **중하**

`defense-catalog.js:538-539` 주석이 `squadBase` 필드를 근거로 density 상승을 설명하지만 `[OBSERVED]`:

- `squadBase` 는 **10개 doctrine 행 어디에도 없다**. 실제 키는 `gateIntegrity`, `defenseTicks`,
  `waveCount`, `classes`, `kindCycle`, `pressureLane`, `midbossEnemy` 7개다.
- density 는 상승하지 않는다 — §1.2 표대로 body 수는 62 → 38 로 **감소**한다.

코드 동작은 옳고(§1.2 의 `:568-571` 주석이 정확하다) **주석 한 곳만 낡았다**. 문서 결함이지 로직 결함이 아니다.

#### S7 — `mapVariant` / `protectedCorridor` 부재 (9/9) · 저지력 **중하**

`STAGE_TACTICS[].mapVariant` 는 `cinder-span` 만 보유한다(`defense-catalog.js:392-400`) `[OBSERVED]`:
`version "v1"`, `modules ["ember-relay-spire","drowned-forge-arch"]`, 그리고
`protectedCorridor { declared: true, preservesObjectives: true, preservesRoutes: true }`.

**현재 런타임 소비처는 0건이다** `[OBSERVED]` — `defense-run-simulation.js`/`app.js`/
`battle-realtime-three.js` 어디에서도 `mapVariant` 를 읽지 않는다. 그러나
`_workspace/current/design/pcg-stage-layout-spec.md` 가 요구하는 보호 회랑 불변식의 **선언 지점**이
바로 이 필드이므로, PCG 작업이 스테이지 2–10 으로 확장되는 순간 9건이 동시에 필요해진다 `[INFERENCE]`.

#### S8 — 쇼케이스 노출 불가 (7/9) · 저지력 **중하**

`editorial.showcase: true` 는 `cinder-span`/`veil-citadel`/`echo-throne` 3개뿐이며,
`stage-world-catalog.js:584` 가 정확히 3개를 **강제**한다 `[OBSERVED]`:

```js
if (STAGE_SHOWCASE_IDS.length !== 3) throw new Error("Stage world catalog must expose exactly three editorial showcases.");
```

따라서 `sunken-bastion` 이후 7개 스테이지는 stage plate PNG 가 present 임에도 로비 쇼케이스
카드 경로로 노출될 수 없다. 4번째를 추가하려면 **이 상한 자체를 고쳐야 한다** — 데이터만으로는 불가능하다.

#### S9 — 보상 동료 중복 및 lookout 발산 (6/9) · 저지력 **중하**

9개 스테이지가 6종의 동료만 배분한다 `[OBSERVED]`. 중복 내역:

| 동료 | 보상으로 지정한 스테이지 |
|---|---|
| `ember-cohort` | `cinder-span` · `shattered-causeway` — **2회** |
| `throne-echo` | `echo-throne` · `glass-necropolis` — **2회** |
| `anchor-shard` | `sunken-bastion` · `starless-canal` — **2회** |
| `dawnless-crown` | `abyss-chancel` · `gate-zenith` — **2회** |

특히 `dawnless-crown` 은 9·10 **연속** 지급이라 캠페인 최종 보상이 직전 스테이지와 같다.
`ember-cohort` 는 8스테이지 보상이 1스테이지(튜토리얼) 보상과 같다.
동시에 `pack-warden`/`requiem-warden`/`lantern-reaver` 3종은 **보상 풀에 한 번도 등장하지 않는다**(§3.2).

#### S10 — 테스트 커버리지 비대칭 (9/9) · 저지력 **하**

`tests/` 64개 파일 중 stage id 를 언급하는 파일 수 `[OBSERVED]`:

| stage | 언급 테스트 파일 수 |
|---|---|
| `cinder-span` *(기준선)* | **31** |
| `veil-citadel` | 12 |
| `echo-throne` | 11 |
| `sunken-bastion` | 8 |
| `howling-sprawl` | 8 |
| `glass-necropolis` | 6 |
| `starless-canal` | 7 |
| `shattered-causeway` | 6 |
| `abyss-chancel` | 5 |
| `gate-zenith` | 13 |

**전용 스테이지 테스트 파일은 `tests/cinder-span-vertical-slice.test.mjs` 1개뿐이다** `[OBSERVED]`.
(`tests/stage2-balance-retune.test.mjs` 는 이름과 달리 `STAGE_BY_ID["cinder-span"]` 를 검증하는
스테이지 1 리튠 회귀 테스트다 — 캠페인 2스테이지 테스트가 아니다.) `abyss-chancel` 이 5로 최저다.

#### S11 — 고도 데이터가 시뮬레이션에 소비된다 (10/10) · 기존 스펙 정정 필요

`pcg-stage-layout-spec.md:16-21` 은 게임플레이 단일 평면을 요구하고, 같은 문서 `:34-37` 은
**완화 요인**으로 *"이 고도값은 이미 표현용이며 시뮬레이션이 소비하지 않는다"* 라고 적었다 `[OBSERVED]`.

**이 완화 근거는 현재 코드와 맞지 않는다** `[OBSERVED]`. `defense-run-simulation.js:79-98`
`terrainSupportAt()` 은 `world.gameplay.surfaces` 의 `elevation.atMin`/`atMax` 를 직접 보간해
높이를 산출하며, 그 결과는 다음 세 지점에서 소비된다:

- `:147-153` `placeOnTerrain()` — 엔티티 접지 고도 및 `supportMeshId` 결정
- `:211-213` `climbableFrom()` — `COLLISION.stepHeight` 와 비교해 **이동 가능 여부를 판정**
- `:1350-1351` — 투사체 고도 갱신

`stage-world-catalog.js:4-9` 모듈 주석이 말하는 *"no collision or elevation-resolution behavior"* 는
**그 모듈 자신**이 해석 로직을 갖지 않는다는 뜻이지, 소비자가 없다는 뜻이 아니다 `[INFERENCE]`.
해석은 `defense-run-simulation.js` 쪽에 있다.

실측한 10개 스테이지 고도 데이터 `[OBSERVED]` — `ramp` 는 전부 x축 경사, `platform` 은 평탄:

| # | id | ramp 상승 | x-span | 기울기 | platform | `stepHeight` 600 여유 | `elevationTolerance` 700 여유 | meshColliders |
|---|---|---|---|---|---|---|---|---|
| 1 | `cinder-span` *(기준선)* | 420 | 1600 | 0.2625 | 420 | +180 | +280 | 1 |
| 2 | `veil-citadel` | 480 | 1500 | 0.3200 | 480 | +120 | +220 | 0 |
| 3 | `echo-throne` | 520 | 1500 | 0.3467 | 520 | +80 | +180 | 0 |
| 4 | `sunken-bastion` | 360 | 1500 | 0.2400 | 360 | +240 | +340 | 0 |
| 5 | `howling-sprawl` | 300 | 1700 | 0.1765 | 300 | +300 | +400 | 0 |
| 6 | `glass-necropolis` | 600 | 1700 | 0.3529 | 600 | **0** ⚠ | +100 | 0 |
| 7 | `starless-canal` | 280 | 1800 | 0.1556 | 280 | +320 | +420 | 0 |
| 8 | `shattered-causeway` | 460 | 1700 | 0.2706 | 460 | +140 | +240 | 0 |
| 9 | `abyss-chancel` | 540 | 1700 | 0.3176 | 540 | +60 | +160 | 0 |
| 10 | `gate-zenith` | 680 | 1700 | 0.4000 | 680 | **-80** ⛔ | **+20** ⚠ | 0 |

10/10 이 비영(非零) 게임플레이 고도를 갖는다. 램프/플랫폼 접합은 10/10 모두 연속이다
(`ramp.bounds.maxX === platform.bounds.minX` 이고 `ramp.elevation.atMax === platform.elevation.atMin`) `[OBSERVED]`.

**여유 폭이 격차를 만든다** `[OBSERVED]`. `climbableFrom()`(`:211-212`)은 `<=` 비교이므로:

- `glass-necropolis` — 상승 600 이 `stepHeight` 600 과 **정확히 같다**. `600 <= 600` 이라 통과하지만 **여유가 0** 이다.
  상수가 1 이라도 줄거나 지형이 1 단위라도 높아지면 그 즉시 벽이 된다.
- `gate-zenith` — 상승 680 > 600 으로 **유일하게 초과**한다(여유 −80). 동시에 플랫폼 680 은
  `COMBAT_TARGETING.elevationTolerance` 700 에 **20 단위**까지 근접해, 고도차 교전 판정 여유도 캠페인 최소다.
- 기준선 `cinder-span` 이 막히지 않는 것은 **구조가 아니라 여유 덕분이다** — 상승 420 은 `stepHeight` 대비 +180,
  플랫폼 420 은 `elevationTolerance` 대비 +280 이다. 기울기 0.2625 로는 한 틱에 x 축 2,286 단위를 움직여야
  `stepHeight` 를 넘는다. 즉 **현재 안전은 설계된 불변식이 아니라 여유 폭의 부산물이다** `[INFERENCE]`.

이 세 줄의 함의: PCG 모듈이 상승 600 초과 램프를 생성하면 `moveOnTerrain()` 경로에서 실제 벽이 된다.
현재 상한을 강제하는 검증기는 없다 `[OBSERVED]` — `stage-world-catalog.js` 의 표면 검증은 고도 크기를 보지 않는다.

이 항목은 `pcg-stage-layout-spec.md` 소유 영역이므로 **여기서 재설계하지 않는다**. 다만 그 문서의
완화 근거가 `[OBSERVED]` 로 표기되어 있으므로, 위 세 소비 지점을 근거로 **정정이 필요하다는 사실만 등재**한다.

### 4.2 스테이지 고유 격차

체계적 격차(S1–S11)를 제외하고, 해당 스테이지에만 존재하는 것들이다. 저지력 순.

| 순위 | 스테이지 | 격차 | 근거 |
|---|---|---|---|
| 1 | `gate-zenith` (10) | **램프 상승 680 > `COLLISION.stepHeight` 600** — 10개 중 유일 | `stage-world-catalog.js:394`~ 대 `defense-catalog.js#COLLISION` |
| 2 | `glass-necropolis` (6) | **램프 상승 600 = `stepHeight` 600, 여유 정확히 0** — `<=` 비교라 통과하나 마진이 없다 | `stage-world-catalog.js:260`~ 대 `defense-run-simulation.js:212` |
| 3 | `sunken-bastion` (4) | 쇼케이스에서 이탈하는 **첫** 스테이지 — 4–10 이 여기서 갈린다 | `editorial(false, 0, …)` |
| 4 | `echo-throne` (3) | 유일한 id ≠ 파일명. world plate 생성 시 이름 규약이 다름 | §3.1 |
| 5 | `gate-zenith` (10) | 최종 보상 `dawnless-crown` 이 9스테이지와 동일 | §S9 |
| 6 | `abyss-chancel` (9) | 보상 `dawnless-crown` 이 10스테이지와 중복, lookout 은 `requiem-warden`(6스테이지 재사용) | §S9 · §3.2 |
| 7 | `shattered-causeway` (8) | 보상·lookout 모두 `ember-cohort` — 1스테이지 자산 그대로 재사용 | §S9 · `stage-world-catalog.js:351` 대 `:118` |
| 8 | `glass-necropolis` (6) | 보상 `throne-echo` 가 3스테이지와 중복 | §S9 |
| 9 | `starless-canal` (7) | 보상 `anchor-shard` 가 4스테이지와 중복 | §S9 |
| 10 | `howling-sprawl` (5) | 보상 `veil-vanguard` 가 보스(`Pack Herald`)·lookout(`pack-warden`) 주제와 어긋남 | §3.2 |
| 11 | `abyss-chancel` (9) | 테스트 언급 5건으로 캠페인 최저 | §S10 |
| 12 | `veil-citadel` (2) | 고유 격차 없음 — 체계적 격차 5건만 해당. 스테이지 2–10 중 **가장 완성도가 높다** | §2.1 |

### 4.3 gate-zenith 램프 — 정확히 무엇이 문제이고, 무엇이 아닌가

과장하지 않기 위해 실패 경로를 코드 단위로 분해한다 `[OBSERVED]`.

**판정 함수** — `defense-run-simulation.js:211-213`:

```js
function climbableFrom(world, entity, fromElevation, point) {
  return terrainSupportAt(world, point.x, point.y).elevation - fromElevation <= COLLISION.stepHeight;
}
```

**실패 시 처리** — `defense-run-simulation.js:287-293` `moveOnTerrain()` 말미:

```js
if (!climbableFrom(world, entity, originElevation, rounded)) {
  const slideX = clampToWorld(world, entity, { x: rounded.x, y: origin.y });
  const slideY = clampToWorld(world, entity, { x: origin.x, y: rounded.y });
  if (climbableFrom(world, entity, originElevation, slideX)) resolved = slideX;
  else if (climbableFrom(world, entity, originElevation, slideY)) resolved = slideY;
  else resolved = origin;                       // ← 세 경로 모두 실패하면 이동 취소
}
```

즉 초과 고도는 **텔레포트가 아니라 이동 취소**로 처리된다. 그래서 증상은 크래시가 아니라 "못 올라감"이다.

이를 `gate-zenith` 수치에 대입하면:

- 램프는 x축 1,700 단위에 걸친 경사(`atMin 0` → `atMax 680`), 기울기 단위당 0.4 다. 한 틱 이동량이
  x축 1,500 단위 미만이면 스텝당 고도차가 600 미만이므로 **경사면 점진 보행은 성립한다** `[OBSERVED]`.
- 막히는 것은 **플랫폼 경계**다. 플랫폼(`minX 18300`~`maxX 19800`)은 전 구간 고도 680 평탄이고 바깥 평지는 0 이다.
  램프를 거치지 않고 측면·후면으로 진입하려는 경로는 한 스텝에 680 을 요구해 `680 <= 600` 이 거짓이 되고,
  slideX/slideY 도 같은 플랫폼 위를 향하면 함께 실패해 **`resolved = origin`** 으로 이동이 취소된다.
- lookout NPC 는 그 680 플랫폼 위에 배치되어 있다(`stage-world-catalog.js:418`, `elevation: 680`).
- 교전 측면에서는 플랫폼 680 이 `COMBAT_TARGETING.elevationTolerance` 700 **이내**이므로(여유 20)
  고도차 교전 판정 자체는 성립한다 `[OBSERVED]`.

나머지 8개 스테이지의 램프 상승은 280–600 으로 `stepHeight` 이내라 경계 진입도 한 스텝으로 올라설 여지가
남는다. `gate-zenith` 만 그 여지가 **음수(−80)** 다. 바로 아래 `glass-necropolis` 는 여유가 **정확히 0** 이다.

**확인하지 않은 것**: 이것은 데이터·코드 대조 결과이며 **재현된 이동 실패가 아니다**. 실제 도달 불가 여부는
틱당 이동량과 진입 경로에 달려 있으므로, 판정에는 `gate-zenith` 시드 런의 접지/이동 로그가 필요하다 `[INFERENCE]`.

---

## 5. 요약 — 스테이지 2–10 이 스테이지 1 완성도에 도달하려면

**이미 갖춰진 것** `[OBSERVED]`: 9개 스테이지 전부 terrain GLB · stage plate PNG · boss GLB ·
reward companion GLB 를 보유하고, 4중 검사(디스크 / `RETAINED_ASSET_PATHS` / `PAGES_RUNTIME_PATHS` /
매니페스트 `retain`+`runtimeReference`)를 36/36 통과한다. 프레젠테이션 어휘
(팔레트 5슬롯 · `patternId` · 랜드마크 2개 · 분위기 · `mapLabels` 9키)와 전술 데이터
(`chokepath`/`flank`/`elevation`/`hazard`/`occupation`/`extraction`/`spawnDirections`/`seededVariation` 8키)는
**10/10 완비**다. 인코딩된 자산 격차는 없다.

**비어 있는 것은 연출·검증 계층이다** `[OBSERVED]`. 저지력 순 상위 4건:

1. **world plate 18파일 + 렌더러 조회 경로** (S1) — 자산만으로 끝나지 않는 2부 작업
2. **`cinematic.intro` 9건** (S2) — 소비처가 살아 있어 데이터만 채우면 즉시 동작
3. **`meshColliders` 9건** (S3) — 현재 이 9개 스테이지는 `surfaces` AABB 가 **유일한 고도 권위**다
   (mesh 가 우선하므로 콜라이더를 넣는 순간 1차 권위가 바뀐다)
4. **`surpriseTable` 9건** (S4) — 내레이션 컷신 채널 자체를 여는 유일한 입력

**추가로 좁혀둔 두 지점** `[OBSERVED]`: `glass-necropolis` 는 램프 상승 600 이 `COLLISION.stepHeight` 600 과
정확히 같아 여유가 **0** 이고, `gate-zenith` 는 상승 680 으로 **유일하게 초과**(−80)하면서 플랫폼 680 이
`COMBAT_TARGETING.elevationTolerance` 700 에 **20 단위**까지 붙는다. 두 값 모두 검증기가 강제하지 않으므로
PCG 확장 시 상한 규칙이 필요하다 `[INFERENCE]`.

2·3·4 는 모두 **소비처가 이미 라이브이고 데이터만 없는** 형태다. 코드 변경 없이 카탈로그 추가만으로
동작한다 `[INFERENCE — 각 소비처의 옵셔널 조회 코드 관측에서 도출]`. 반면 1(하드코딩된 `WORLD_TEXTURES`)과
S8(3개 강제 상한)은 **코드 변경 없이는 데이터로 해결 불가능하다** `[OBSERVED]`.

### 5.1 이 문서가 확인하지 않은 것

정직하게 범위를 적는다:

- **플레이 검증 없음.** 전부 카탈로그·디스크·소스 대조다. 런 시뮬레이션도, 브라우저 실행도 하지 않았다.
  (배치 계약상 테스트 스위트 실행은 부모 세션 소유다.)
- **§4.3 `gate-zenith` 램프는 데이터 대조 결과**이며 재현된 이동 실패가 아니다.
- **자산 품질 미평가.** GLB/PNG 의 존재만 확인했다. 폴리곤·텍스처·리깅·시각적 일관성은 범위 밖이다.
- **스테이지 1 은 감사하지 않았다.** 기준선 수치로만 인용했다 —
  소유 문서는 `_workspace/current/design/stage-composition-audit-stage1.md`.

### 5.2 재현 방법

이 문서의 모든 수치는 저장소 루트에서 카탈로그를 import 해 재계산할 수 있다. 예: §1.1 의 wave 합계와
§1.2 의 doctrine 합계 —

```js
import { STAGES, ENEMIES } from "./defense-catalog.js";
for (const s of STAGES) {
  const legacy = s.waves.reduce((a, [, , n]) => a + n, 0);
  const doctrine = s.wavePlan.reduce((a, w) => a + (w.primary?.count ?? 0), 0);
  const hp = s.wavePlan.reduce((a, w) => a + w.alternatives[0].composition
    .reduce((b, c) => b + c.count * (ENEMIES[c.enemy].hp * s.scale) / 100, 0), 0);
  console.log(s.id, { legacy, doctrine, hp });
}
```
