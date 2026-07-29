# Abyssal Lantern / 심연의 등불 — 시나리오 시놉시스

```yaml
run_id: 20260729-abyssal-lantern-narrative
status: "[TARGET] — 서사 계약. 사람 판정·플레이 검증 이전"
owner_skill: webtoon-harness (scenario discipline only — 27-agent image pipeline NOT run)
authority_world: design/onslaught-action-product-contract.md#2
authority_boss: design/boss-pattern-spec.md#7
authority_cast: battle-realtime-three.js#MOTION_MODELS / #BOSS_MODELS / #ENEMY_MODELS
scope: 제목 재구성 premise, 3구역 극적 구조, 캐스트 시트, 연속성 규칙
non_scope: 패널 PNG 생성, 이미지 파이프라인 실행, 수치 재정의
```

이 문서는 **이야기**를 소유한다. 수치는 소유하지 않는다. 충돌 시
`design/master-numeric-contract.md`가 이긴다.

`webtoon-harness`의 **시나리오 규율만** 적용했다: 대사 주도, 고긴장, 비트마다 반전,
내레이션 덤프 금지. 27-에이전트 이미지 파이프라인은 실행하지 않았고 패널 PNG는 생성하지
않았다 (`skill://webtoon-harness` "Design principles" / "Phase 4 Visual").

---

## 0. 프리즈 검증 — 무엇을 바꾸지 않았는가 `[OBSERVED]`

세 구역과 세 보스는 동결이다. 이름을 바꾸거나 순서를 바꾸거나 추가·삭제하지 않았다.
바이트 동일성을 다음 위치에서 확인했다:

| 항목 | 검증 위치 | 확인된 문자열 |
|---|---|---|
| 구역 1 id / 표시명 / 보스명 | `defense-catalog.js:566` | `"cinder-span"`, `"Cinder Span"`, `"Cinder Warden"` |
| 구역 2 id / 표시명 / 보스명 | `defense-catalog.js:567` | `"abyss-chancel"`, `"Abyss Chancel"`, `"Veil Tactician"` |
| 구역 3 id / 표시명 / 보스명 | `defense-catalog.js:568` | `"echo-throne"`, `"Echo Throne"`, `"Gate Sovereign"` |
| 보스 엔티티 id 3종 | `defense-catalog.js:322-324` | `s1-cinder-warden`, `s2-veil-tactician`, `s3-gate-sovereign` |
| 보스 런타임 메쉬 3종 | `battle-realtime-three.js:147-151` | `assets/mesh/boss/{s1-cinder-warden,s2-veil-tactician,s3-gate-sovereign}/glb/base_basic_pbr.glb` |
| 보스 배치·시그니처 | `design/boss-pattern-spec.md:269-273` | 동일 3행, 동일 순서 |
| 구역 순서 제품 경계 | `design/onslaught-action-product-contract.md:29` | `Cinder Span → Abyss Chancel → Echo Throne` |
| 보스 메쉬 디렉터리 실재 | `ls assets/mesh/boss/` | `s1-cinder-warden`, `s2-veil-tactician`, `s3-gate-sovereign` (3/3) |

**`[OBSERVED]` 이 시놉시스가 도입한 신규 구역 0건, 신규 보스 0건, 순서 변경 0건.**

---

## 1. 재구성된 전제 — 왜 "등불"인가

### 1.1 한 문장

**심연은 이미 이겼다. Dusk Warden은 마지막 등불을 들고 세 구역을 내려가 Echo Throne에
도달하며, 등불을 지키려면 계속 태워야 하고 태우면 줄어든다.**

### 1.2 등불 모티프가 자산에 이미 존재한다 `[OBSERVED]`

제목은 장식이 아니다. 런타임이 이미 등불을 들고 있다.

| 근거 | 위치 | 확인된 값 |
|---|---|---|
| 플레이어 원본 메쉬 이름 | `battle-realtime-three.js:139` | `assets/mesh/character/lantern-reaver-character/glb/base_basic_pbr.glb` |
| 플레이어 런타임 모션 메쉬 | `battle-realtime-three.js:127`, `:140-141` | `assets/motion/ingame/characters/lantern-reaver/model.glb` |
| 구역 1 VFX 실루엣 | `assets/motion/stage-vfx/manifest.json:19` | `"Lantern core, seal ring, cross-wind ember wake."` |
| 구역 3 VFX 실루엣 | `assets/motion/stage-vfx/manifest.json:107` | `"Caged lantern core, three echo rings, crown-like fractures."` |
| 구역 1 reduced-motion 규칙 | `assets/motion/stage-vfx/manifest.json:20` | `"Keep the static lantern and seal ring; ..."` |
| 구역 3 reduced-motion 규칙 | `assets/motion/stage-vfx/manifest.json:108` | `"Keep the static lantern and innermost echo ring; ..."` |
| 동료 카드에도 같은 이름 | `defense-catalog.js:308` | `"lantern-reaver": { name: "Lantern Reaver", ... }` |

`[INFERENCE]` 세 구역 중 둘의 앰비언트 VFX가 실루엣 명세에 문자 그대로 `lantern core`를
갖고, 플레이어 메쉬 이름 자체가 `lantern-reaver`다. 제목 `Abyssal Lantern`은 새 모티프를
발명하는 것이 아니라 **이미 자산에 박혀 있던 모티프에 이름을 주는 것**이다.

`[OBSERVED]` 구역 2(`abyss-chancel`)의 VFX 실루엣은 `"Rift lens, twin scan rings, offset
mirror shards."`(`assets/motion/stage-vfx/manifest.json:63`)로 등불이 아니라 **렌즈**다. 이것은 결함이 아니라
§2.2의 극적 구조에 직접 쓰인다 — 중간 구역은 등불을 **들지 않고 반사하는** 구역이다.

### 1.3 등불이 게임 규칙과 어긋나지 않는 이유

서사 장치가 시뮬레이션 규칙을 재정의하면 거짓말이 된다. 등불은 다음과 **모순되지 않는다**:

| 게임 규칙 `[OBSERVED]` | 근거 | 등불 해석 |
|---|---|---|
| 실패해도 Warden XP 40% + 도달 Shard 100% 보존 | `design/onslaught-action-product-contract.md:43` | 등불은 꺼지지 않는다. **줄어들 뿐이다.** 죽음은 소멸이 아니라 심지가 짧아지는 것 |
| 캠페인 실패 조건 없음 — 패배는 재도전 | `design/master-gdd-delta.md:236` | 등불을 든 자가 죽으면 다음 Warden이 같은 등불을 든다 |
| 한 원정 300–480 s, 기준 360 s | `design/master-numeric-contract.md:17-19` | 등불 하나가 버티는 시간 |
| 승리는 `FINALE` 처치 뿐, 시간 승리 금지 | `design/master-gdd-delta.md:229` | 심연은 기다려서 닫히지 않는다 |
| 스테이지별 안개가 후반 페이즈에 걷힌다 | `design/camera-vfx-direction.md:279` | 등불이 밝아진 것이 아니라 **플레이어의 눈이 어둠에 적응**한 것 |

**등불은 자원이 아니다.** 게임에 등불 게이지는 없고, 이 문서는 그것을 신설하라고
요구하지 않는다. 등불은 **읽기 전용 은유**이며 `getRunDigest()` 입력에 아무것도 더하지
않는다 (`CLAUDE.md §2` 결정론 불변식).

---

## 2. 구역별 극적 구조

각 구역은 4항으로만 진술한다: **극적 질문 · 상승 · 반전 · 보스의 동기.**
보스는 스탯 블록이 아니라 인물로 쓴다. 수치는 `design/boss-pattern-spec.md`가 소유한다.

### 2.1 구역 1 — Cinder Span (잿빛 교량)

`[OBSERVED]` 런타임 분위기: `"잿빛 바람이 교량의 봉쇄선을 훑는다."` / 모티프
`"불씨와 재의 흐름"` (`defense-catalog.js:580`). 랜드마크 `불씨 중계탑`,
`잠긴 용광로 아치` (`:579`).

| 항 | 내용 |
|---|---|
| **극적 질문** | 등불을 들고 내려가는 것이 구조인가, 아니면 심연에 길을 밝혀주는 것인가? |
| **상승** | 교량은 건너는 곳이다. 건널수록 뒤가 무너진다. 재는 발밑에서 쌓이고, 불씨는 등불이 아니라 **적의 잔불**이다 — 처치한 것이 열을 남긴다 (`boss-pattern-spec.md:271` 시그니처 `잿불 장판이 회피 경로에 잔류`). |
| **반전** | Cinder Warden은 교량을 **막고 있던** 것이 아니다. 사슬로 교량을 **붙들고 있었다.** 파수꾼을 처치한 순간 교량이 무너지기 시작하고, 돌아갈 길이 사라진다. 첫 승리가 첫 퇴로 상실이다. |
| **보스의 동기** | Cinder Warden(`s1-cinder-warden`)은 문지기가 아니라 **마지막 정비공**이다. 그는 심연을 섬기지 않는다. 심연이 위로 올라오지 못하도록 교량을 자기 사슬로 묶어두었고, 그 자세로 굳었다. 그가 Warden을 공격하는 이유는 적이라서가 아니라 — **내려가려는 자가 사슬을 풀 것이기 때문이다.** 그는 옳고, 플레이어는 그를 죽여야 한다. |

`[OBSERVED]` 기존 대사가 이 독법을 지지한다:
`"잿빛 파수꾼이 용광로의 사슬을 끌며 둑길을 차단한다."` (`defense-catalog.js:234`) —
사슬은 무기가 아니라 **끌고 있는 것**이다.
`"다리 끝의 재가 다음 봉쇄선을 가리킨다."` (`:236`) — 승리가 곧 다음 하강 지시다.

### 2.2 구역 2 — Abyss Chancel (심연 예배소)

`[OBSERVED]` 런타임 분위기: `"심연 예배소의 서약이 시야를 봉인한다."` / 모티프
`"서약 고리와 보랏빛 정전"` (`defense-catalog.js:587`). VFX 실루엣은 등불이 아니라
`"Rift lens, twin scan rings, offset mirror shards."` (`assets/motion/stage-vfx/manifest.json:63`).

| 항 | 내용 |
|---|---|
| **극적 질문** | 내 등불이 비추는 것이 길인가, 나 자신인가? |
| **상승** | 예배소는 반사면으로 봉쇄되어 있다. 등불을 들면 사방이 밝아지는 대신 **사방에 등불이 늘어난다.** 어느 빛이 내 것인지 판단해야 한다. `[OBSERVED]` 보스 시그니처: `서약 고리가 안전 경로를 압박하되 예고 길이는 불변` (`boss-pattern-spec.md:272`) — 압박은 오되 규칙은 정직하다. |
| **반전** | 거울에 비친 것은 Warden이 아니다. **이전에 이 등불을 들고 내려갔던 Warden들이다.** 예배소는 성소가 아니라 기록이다. Veil Tactician은 그들을 이겨서 여기 있는 것이 아니라, 그들이 전부 여기까지만 왔기 때문에 여기 있다. |
| **보스의 동기** | Veil Tactician(`s2-veil-tactician`)은 싸우지 않는다. **분류한다.** 그는 내려온 자마다 같은 서약을 제시했고 전부 같은 답을 골랐다. 그가 전장을 재배열하는 이유는 이기기 위해서가 아니라 — **이번에도 같은 답을 고르는지 확인하기 위해서다.** 그의 패배는 그의 가설이 틀렸다는 증명이며, 그는 그것을 기다리고 있었을지도 모른다. |

`[OBSERVED]` 기존 대사: `"Veil Tactician이 무너진 제단의 반사를 따라 전장을 재배열한다."`
(`defense-catalog.js:241`) — 재배열의 근거가 **반사**다.
`"봉인된 성가가 꺼지고 왕좌로 향하는 균열이 열린다."` (`:243`) — 승리가 문을 여는 것이지
문제를 푸는 것이 아니다.

### 2.3 구역 3 — Echo Throne (메아리 왕좌)

`[OBSERVED]` 런타임 분위기: `"달 없는 궁정의 메아리가 왕좌 회랑을 울린다."` / 모티프
`"메아리와 단상의 균열"` (`defense-catalog.js:594`). VFX 실루엣
`"Caged lantern core, three echo rings, crown-like fractures."` (`assets/motion/stage-vfx/manifest.json:107`) —
등불이 **갇혀** 있다.

| 항 | 내용 |
|---|---|
| **극적 질문** | 등불을 왕좌에 놓으면 심연이 닫히는가, 아니면 다음 군주가 생기는가? |
| **상승** | 왕좌는 비어 있다. 비어 있다는 사실이 위협이다. `[OBSERVED]` 보스 시그니처: `메아리 — 패턴이 60 tick 뒤 절반 위력으로 1회 반복` (`boss-pattern-spec.md:273`). 플레이어의 모든 회피가 **한 번 더 요구된다.** 배운 것이 그대로 되돌아온다. |
| **반전** | Gate Sovereign은 왕좌에 앉은 자가 아니다. **왕좌가 마지막으로 삼킨 등불잡이다.** 메아리는 그의 능력이 아니라 그가 여기서 반복하고 있는 것이다 — 그는 Warden이 지금 하는 일을 이미 끝냈고, 그 결과가 지금의 그다. 등불을 왕좌에 놓는 것이 승리 조건이 아니라 **그가 놓았던 행동**이다. |
| **보스의 동기** | Gate Sovereign(`s3-gate-sovereign`)은 심연을 지배하지 않는다. **심연이 되어 버렸다.** 그가 왕좌의 파편을 하나의 명령으로 묶는 이유는 권력이 아니라 — 그것이 그가 마지막으로 내린 결정의 잔향이기 때문이다. 그는 Warden에게 이기려 하지 않는다. **자기가 옳았다는 것을 증명하려 한다.** |

`[OBSERVED]` 기존 대사: `"Gate Sovereign이 왕좌의 파편을 모아 전장을 하나의 명령으로
묶는다."` (`defense-catalog.js:248`). 승리 대사
`"왕좌의 명령이 끊겼다."` (`:250`) — 군주가 죽었다고 하지 않는다. **명령이 끊겼다**고 한다.
`[INFERENCE]` 이 표현은 위 독법과 정확히 호환된다.

### 2.4 3구역 반전이 하나의 곡선을 이루는가

| 구역 | 반전의 종류 | 플레이어가 잃는 것 |
|---|---|---|
| Cinder Span | **퇴로** 반전 — 승리가 길을 끊는다 | 돌아갈 수 있다는 가정 |
| Abyss Chancel | **정체성** 반전 — 거울이 선행자를 보여준다 | 내가 처음이라는 가정 |
| Echo Throne | **목적** 반전 — 보스가 곧 나의 결말이다 | 이기면 끝난다는 가정 |

`[TARGET]` 세 반전은 각각 다른 축(공간 / 정체 / 목적)을 친다. 같은 축을 세 번 치면 3구역이
같은 이야기로 읽힌다. 이 배치가 `boss-pattern-spec.md:271-273`의 시그니처 3종(잔류 장판 /
서약 고리 압박 / 패턴 메아리)과 1:1로 대응한다 — 서사 반전이 기계적 시그니처와 같은
것을 말한다.

---

## 3. 캐스트 시트 — 전원 실존 자산 매핑

**규칙: 메쉬 없는 인물은 등장하지 않는다.** 아래 표의 모든 항목은 런타임에 이미 존재한다.

### 3.1 플레이어 · 보스

| 서사 이름 | 런타임 식별 | 자산 경로 | 근거 |
|---|---|---|---|
| Dusk Warden (플레이어) | `entity.id === "commander"` | 렌더 모델 `assets/motion/ingame/characters/human-command-boss/model.glb` | `battle-realtime-three.js:165` `COMMANDER_MODEL = MOTION_MODELS["human-command-boss"]`, 해석 `:606` |
| Dusk Warden — 등불 정체성 메쉬 | `PLAYER_SOURCE_MESH` | `assets/mesh/character/lantern-reaver-character/glb/base_basic_pbr.glb` | `battle-realtime-three.js:139`, 폴백 경로 `:626-627` |
| Dusk Warden — 등불 모션 메쉬 | `MOTION_MODELS["lantern-reaver"]` | `assets/motion/ingame/characters/lantern-reaver/model.glb` | `battle-realtime-three.js:127`, `:140-141` |
| Cinder Warden | `s1-cinder-warden` | `assets/mesh/boss/s1-cinder-warden/glb/base_basic_pbr.glb` | `battle-realtime-three.js:148`, 스탯 `defense-catalog.js:322` |
| Veil Tactician | `s2-veil-tactician` | `assets/mesh/boss/s2-veil-tactician/glb/base_basic_pbr.glb` | `battle-realtime-three.js:149`, 스탯 `defense-catalog.js:323` |
| Gate Sovereign | `s3-gate-sovereign` | `assets/mesh/boss/s3-gate-sovereign/glb/base_basic_pbr.glb` | `battle-realtime-three.js:150`, 스탯 `defense-catalog.js:324` |

**`[OBSERVED]` 플레이어 메쉬 라우팅의 사실관계 — 서사가 이것을 왜곡하면 안 된다.**
전투 중 지휘관이 실제로 렌더하는 모델은 `human-command-boss`다
(`battle-realtime-three.js:606` → `:165`). `lantern-reaver`는 (a) 원본/폴백 식별 메쉬
(`:139`, `:626-627`), (b) 동료로 배치될 때의 모델(`:162-163`), (c) 동료 카드 이름
(`defense-catalog.js:308`)로 존재한다.

`[INFERENCE]` 따라서 "Dusk Warden = lantern-reaver 메쉬"는 **부정확**하다. 정확한 진술은
`Dusk Warden은 human-command-boss 실루엣으로 싸우고, lantern-reaver는 그가 드는 등불의
계보(원본 메쉬 · 동료 · 카드)로 존재한다`다. 제목의 근거는 이 계보이며, 전투 실루엣이
아니다. 이 구분을 지우면 §1.2의 근거가 거짓이 된다.

### 3.2 잡몹 — 4역할, 4메쉬

`[OBSERVED]` `battle-realtime-three.js:153-158`의 `ENEMY_MODELS`가 시뮬레이션 역할을
모션 자산에 사상한다. 서사는 **이 4종 외의 적을 만들지 않는다.**

| 서사 호칭 | 시뮬 역할 | 모션 자산 id | 자산 경로 | 근거 |
|---|---|---|---|---|
| 재를 쫓는 것 | `rusher` | `scout` | `assets/motion/ingame/characters/scout/model.glb` | `:154`, `:129` |
| 등 뒤의 것 | `flanker` | `shade` | `assets/motion/ingame/characters/shade/model.glb` | `:155`, `:130` |
| 사슬에 남은 것 | `guardian` | `shadow-soldier-v04` | `assets/motion/ingame/characters/shadow-soldier-v04/model.glb` | `:156`, `:132` |
| 빛을 되쏘는 것 | `ranged` | `possessed` | `assets/motion/ingame/characters/possessed/model.glb` | `:157`, `:128` |

역할 수치는 `defense-catalog.js:295-298`(`ENEMIES`)과
`design/boss-pattern-spec.md:88-97`이 소유한다. 이 표는 **호칭 대응만** 정의한다.

`[TARGET]` 호칭 규칙: 잡몹은 고유명을 갖지 않는다. `~것`으로 부른다. 이유는 표현 취향이
아니라 서사 논리다 — §2.2의 반전(거울 속 선행자)이 성립하려면 **이름을 가진 존재가
희소해야** 한다. 이름을 가진 것은 Warden, 세 보스, 동료뿐이다.

### 3.3 중간 보스 — 신규 고유명 없음

`[OBSERVED]` `design/boss-pattern-spec.md:267`: `중간 보스는 기존 정예 ID(STAGES[*].eliteId)를
승격해 신규 고유명을 만들지 않는다.`

| 정예 id | 소속 구역 | `eliteKind` | 해석되는 메쉬 | 근거 |
|---|---|---|---|---|
| `s1-ember-hunter` | Cinder Span | `rusher` | `scout` 모션 모델, 높이 `TARGET_HEIGHT.elite = 2.2` | `defense-catalog.js:566`; `battle-realtime-three.js:154`, `:61`, `:647` |
| `s2-veil-sentinel` | Abyss Chancel | `flanker` | `shade` 모션 모델, 동일 | `defense-catalog.js:567`; `:155`, `:647` |
| `s3-throne-wraith` | Echo Throne | `ranged` | `possessed` 모션 모델, 동일 | `defense-catalog.js:568`; `:157`, `:647` |

**`[OBSERVED]` 세 정예 id 전용 메쉬는 저장소에 없다.** 확인:
`find assets -maxdepth 3 -iname '*ember-hunter*' -o -iname '*veil-sentinel*' -o -iname
'*throne-wraith*'` → **0건**. 정예는 자기 `eliteKind`의 역할 메쉬를 `elite` 높이(2.2 vs
일반 1.7, `battle-realtime-three.js:61-62`)로 렌더한다.

`[TARGET]` 서사 처분: 정예는 **인물이 아니라 상태**다. `s1-ember-hunter`는 "재를 쫓는 것
중 아직 열을 가진 것"이며 대사도 이름 호출도 없다. 신규 메쉬를 요구하지 않는다.

### 3.4 동료 — 9종, 전원 기존 카탈로그

`[OBSERVED]` `defense-catalog.js:300-310`(`COMPANIONS`) 9종, 모델 사상은
`battle-realtime-three.js:160-163`(`COMPANION_MODELS`).

| 동료 id | 표시명 | 해석되는 모델 | 근거 |
|---|---|---|---|
| `ember-cohort` | Ember Cohort | `assets/motion/ingame/characters/ember-cohort/model.glb` | `defense-catalog.js:301`; `battle-realtime-three.js:124`, `:161` |
| `lantern-reaver` | Lantern Reaver | `assets/motion/ingame/characters/lantern-reaver/model.glb` | `defense-catalog.js:308`; `:127`, `:162` |
| `rift-lens` | Rift Lens | 미사상 → `PLAYER_MESH` 폴백 | `defense-catalog.js:302`; `:163` `?? PLAYER_MESH` |
| `veil-vanguard` | Veil Vanguard | 동일 폴백 | `defense-catalog.js:303`; `:163` |
| `anchor-shard` | Anchor Shard | 동일 폴백 | `defense-catalog.js:304`; `:163` |
| `throne-echo` | Throne Echo | 동일 폴백 | `defense-catalog.js:305`; `:163` |
| `dawnless-crown` | Moonless Command | 동일 폴백 | `defense-catalog.js:306`; `:163` |
| `pack-warden` | Pack Warden | 동일 폴백 | `defense-catalog.js:307`; `:163` |
| `requiem-warden` | Requiem Warden | 동일 폴백 | `defense-catalog.js:309`; `:163` |

`[OBSERVED]` `MOTION_MODELS`(`:121-133`)에 실제 키가 있는 동료는 `ember-cohort`와
`lantern-reaver` **2종뿐**이며 나머지 7종은 `PLAYER_MESH`(= `lantern-reaver` 모션 모델,
`:141`)로 폴백한다.

`[TARGET]` 서사 처분: 동료는 대사를 갖지 않는다. `[OBSERVED]` 동료는 자동 전투이며
플레이어가 개입할 수 없다 (`ui/hud-information-architecture.md:221`
`동료는 자동 전투... 개입 불가면 표시 불필요`). 개입할 수 없는 존재에게 대사를 주면
플레이어가 반응할 수 없는 정보가 화면에 남는다. 동료는 **구역별 각인**으로만 쓴다:
구역 1 `ember-cohort`, 구역 2 `rift-lens`, 구역 3 `throne-echo`
(`defense-catalog.js:566-568`의 `eliteCompanion` 인자).

`[INFERENCE]` 7종이 등불 실루엣으로 폴백하는 현재 상태는 서사적으로 유리하다 — §2.2의
"사방에 등불이 늘어난다"가 렌더 결과와 우연히 일치한다. 단, 이것은 자산 공백의 부작용이며
**설계 의도로 주장하지 않는다.** 고유 메쉬가 생기면 서사는 그것을 따른다.

### 3.5 캐스트 총계 — 발명 0건

| 분류 | 서사 등장 수 | 실존 자산 뒷받침 | 발명 |
|---|---|---|---|
| 플레이어 | 1 | 1 (`human-command-boss` 렌더 + `lantern-reaver` 계보) | **0** |
| 보스 | 3 | 3 (`assets/mesh/boss/` 3/3 확인) | **0** |
| 잡몹 역할 | 4 | 4 (`scout`/`shade`/`shadow-soldier-v04`/`possessed`) | **0** |
| 정예 | 3 | 3 (역할 메쉬 + `elite` 높이 재사용, 전용 메쉬 0) | **0** |
| 동료 | 9 | 9 (2 고유 + 7 폴백) | **0** |
| **합계** | **20** | **20** | **0** |

---

## 4. 연속성 규칙 — 다음 에피소드가 모순 없이 확장하려면

`skill://webtoon-harness` Phase 6 `Wrap-up — continuity update, next-episode seed`에 대응한다.
이 절은 다음 세션이 여기를 깨지 않고 이어 쓰는 조건이다.

### 4.1 불변 사실 (다음 에피소드가 바꿀 수 없다)

| # | 불변 | 근거 |
|---|---|---|
| C1 | 구역은 3개이며 순서는 `Cinder Span → Abyss Chancel → Echo Throne` | `defense-catalog.js:566-568`, `design/onslaught-action-product-contract.md:29` |
| C2 | 보스는 3명이며 id는 `s1-cinder-warden`/`s2-veil-tactician`/`s3-gate-sovereign` | `defense-catalog.js:322-324`, `battle-realtime-three.js:147-151` |
| C3 | `Echo Throne` 승리가 캠페인 종결 | `design/master-gdd-delta.md:235` |
| C4 | 캠페인 실패 조건은 없다. 패배는 재도전이다 | `design/master-gdd-delta.md:236` |
| C5 | 등불은 게이지가 아니다. 시뮬레이션 상태를 갖지 않는다 | `CLAUDE.md §2`, `design/master-gdd-delta.md:58` |
| C6 | 이름을 가진 존재는 Warden · 3보스 · 동료뿐. 잡몹은 무명 | §3.2 `[TARGET]` |
| C7 | 정예는 인물이 아니라 상태. 전용 메쉬를 요구하지 않는다 | §3.3, `design/boss-pattern-spec.md:267` |
| C8 | 서사는 전투 중 텍스트 릴레이로 전달되지 않는다 | `design/master-gdd-delta.md:76`, `design/lobby-story-presentation-spec.md:29` |

### 4.2 확장 여지 (모순 없이 추가 가능한 곳)

| 여지 | 왜 안전한가 |
|---|---|
| **선행 Warden들** — §2.2 거울에 비친 자들 | 이름·수·결말이 정해지지 않았다. `[OBSERVED]` 메쉬가 필요 없다(거울 상은 기존 실루엣 재사용). 다음 에피소드가 그중 한 명을 인물로 승격할 수 있다 |
| **Cinder Warden의 사슬** — 누가 언제 걸었는가 | 현재 대사(`defense-catalog.js:234`)는 사슬의 존재만 진술하고 기원을 진술하지 않는다 |
| **왕좌를 만든 자** — Gate Sovereign 이전 | §2.3은 군주를 "삼켜진 등불잡이"로 두되 왕좌 자체의 기원은 비워 두었다 |
| **`abyss-chancel`이 왜 렌즈인가** — §1.2의 자산 사실 | `assets/motion/stage-vfx/manifest.json:63`이 렌즈를 명시하지만 이유는 미정 |
| **동료 7종의 고유 정체** | `[OBSERVED]` 현재 폴백 메쉬 상태(§3.4). 고유 메쉬가 생기면 그때 서사를 붙인다 |

### 4.3 확장 금지 (모순을 만든다)

| 금지 | 이유 |
|---|---|
| 구역 4 이상, 보스 4명 이상 | C1/C2 위반. `[OBSERVED]` 런타임 카탈로그가 3/3만 소유 (`task-manifest.md:196`) |
| 등불 잔량·연료·충전 시스템 | C5 위반. 시뮬레이션 상태 신설은 `getRunDigest()` 계약을 건드린다 |
| 잡몹 고유명 부여 | C6 위반. §2.2 반전의 희소성 근거가 무너진다 |
| "심연을 완전히 닫았다" 결말 | C4와 충돌. 재도전이 영구 가능한 구조에서 완전 종결은 루프와 모순 |
| 전투 중 대사 컷신 복원 | C8 위반. `design/lobby-story-presentation-spec.md:29`가 명시 폐기 |
| Dusk Warden을 `lantern-reaver` 메쉬로 단정 | §3.1 `[OBSERVED]` 위반. 전투 렌더는 `human-command-boss` |

### 4.4 다음 에피소드 시드

`[TARGET]` 가장 낮은 위험으로 가장 큰 확장을 얻는 지점은 **§2.2의 거울**이다. 이유:

1. 신규 메쉬 0개 — 거울 상은 기존 실루엣 재사용.
2. C1–C8 어느 것도 건드리지 않는다.
3. `[OBSERVED]` `abyss-chancel` VFX가 이미 `offset mirror shards`(`assets/motion/stage-vfx/manifest.json:63`)를
   실루엣에 갖고 있어 표현 근거가 존재한다.
4. 3구역 구조 밖에서 벌어지므로 캠페인 순서를 재협상하지 않는다.

---

## 5. 이 문서가 주장하지 않는 것

- 이야기가 좋다는 것 — 사람 판정 전까지 미증명.
- 수치를 정의한다는 것 — 전부 상위 권위 문서 소유.
- 이미지가 존재한다는 것 — 패널 PNG 0장 생성, `gti` 0회 호출.
- 런타임이 이 서사를 이미 전달한다는 것 — `[OBSERVED]` 현행 `CUTSCENES`
  (`defense-catalog.js:231-259`)는 구역별 `intro`/`bossEntry`/`elite`/`victory`/`defeat`
  텍스트이며 §2의 반전 구조를 담고 있지 않다. 그 갱신은 별도 구현 작업이다.
