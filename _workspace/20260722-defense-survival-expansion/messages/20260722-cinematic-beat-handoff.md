# Narrative/cinematic handoff — Stage 1 FIX

- **From:** narrative-cinematics-director
- **To:** systems designer, game programmer, app/presentation, audio, VFX, animation, QA
- **Authority:** active llm-wiki production report; `design/worldview.md`; inspected `defense-catalog.js`
- **Status:** four-beat specification plus resolved catalog copy present in `defense-catalog.js#74A9`; not browser evidence

## Four-beat contract

| beat | trigger | duration | fallback | trace | inspected state |
|---|---|---:|---|---|---|
| Intro | `STAGE_STARTED` + stage `intro` | 8s, skippable immediately | same title/lines in a static status overlay; no camera, flash, or video | W-03; W-01/W-02 when named | stage-entry overlay and dismissal inspected; automated evidence is stage-entry only |
| Extraction | successful recovered-memory resolution after elite defeat and spatial hold; current candidate/progress/success event names are not sufficient until QA-D003/QA-X002 converge | 6s, skippable immediately | static 결속 완료 + companion/Archive result; no pulsing seal or video | W-01, W-02, W-05 | events carry cues but no cutscene payload; QA observed pre-elite and remote-elite bypasses |
| Boss victory | `TERMINAL` with `VICTORY` or `FINAL_COMPLETION` | 8s, skippable immediately | static victory line + reward/next action | W-03, W-05 | terminal cutscene payload inspected; no browser evidence claimed |
| Defeat | `TERMINAL` with `DEFEAT` | 6s, skippable immediately | static defeat line + retry/lobby actions | W-03, W-05 | terminal cutscene payload inspected; no browser evidence claimed |

All presentation observes deterministic simulation events. No beat changes state, blocks input, or depends on runtime video.

## Accepted stage-specific catalog copy added in the SystemsDesigner handoff

The following copy is now present in `defense-catalog.js#5249`. It uses canonical Dusk Warden/Moonless Court/Echo Deep/Gate language and stage/boss labels already in the catalog. The newly authored spatial terms are backed by inspected deterministic stage tactics and simulation consumers; that source inspection is not runtime-test evidence.

### `sunken-bastion` — W-01, W-02, W-03

- `intro[0]`: `가라앉은 보루의 네 번째 봉쇄선이 흔들린다.`
- `intro[1]`: `침수된 추출점을 점유하고 닻의 잔향을 결속하라.`
- `elite`: `닻의 잔향이 물길의 추출점에 머문다.`
- `victory`: `조류의 명령이 끊기고 네 번째 봉쇄선이 이어졌다.`
- `defeat`: `침수 압력이 관문을 무너뜨렸다. 네 번째 봉쇄선으로 복귀하라.`

### `howling-sprawl` — W-01, W-02, W-03

- `intro[0]`: `울부짖는 황야가 다섯 번째 관문의 측면을 연다.`
- `intro[1]`: `측면 추출점을 점유하고 무리의 잔향을 회수하라.`
- `elite`: `무리의 잔향이 바람길의 결속 신호로 남는다.`
- `victory`: `측면의 명령이 끊기고 다섯 번째 봉쇄선이 닫혔다.`
- `defeat`: `측면 압력이 관문을 갈랐다. 다섯 번째 봉쇄선으로 복귀하라.`

### `glass-necropolis` — W-01, W-02, W-03

- `intro[0]`: `유리 묘역의 고지가 여섯 번째 관문을 내려다본다.`
- `intro[1]`: `반사되는 사선을 피해 추출점을 점유하라.`
- `elite`: `합창의 잔향이 깨진 기록면 위에 머문다.`
- `victory`: `반사된 명령이 멎고 여섯 번째 봉쇄선이 이어졌다.`
- `defeat`: `집중 사격이 관문을 깨뜨렸다. 여섯 번째 봉쇄선으로 복귀하라.`

### `starless-canal` — W-01, W-02, W-03

- `intro[0]`: `별 없는 운하가 일곱 번째 관문으로 갈라진다.`
- `intro[1]`: `위험 수로의 추출점을 점유하고 통행 잔향을 회수하라.`
- `elite`: `통행의 잔향이 잠긴 수문에서 결속을 기다린다.`
- `victory`: `수로의 명령이 끊기고 일곱 번째 봉쇄선이 이어졌다.`
- `defeat`: `갈라진 수로가 관문을 포위했다. 일곱 번째 봉쇄선으로 복귀하라.`

### `shattered-causeway` — W-01, W-02, W-03

- `intro[0]`: `부서진 둑길이 여덟 번째 관문 앞에서 끊겼다.`
- `intro[1]`: `붕괴 구간의 추출점을 점유하고 교량 잔향을 결속하라.`
- `elite`: `교량의 잔향이 무너진 연결부를 붙든다.`
- `victory`: `거상의 압력이 멎고 여덟 번째 봉쇄선이 이어졌다.`
- `defeat`: `붕괴 충격이 관문에 닿았다. 여덟 번째 봉쇄선으로 복귀하라.`

### `abyss-chancel` — W-01, W-02, W-03

- `intro[0]`: `심연 예배소의 서약이 아홉 번째 관문을 억누른다.`
- `intro[1]`: `서약의 추출점을 점유하고 명령 잔향을 역전하라.`
- `elite`: `서명자의 잔향이 결속할 새 명령을 기다린다.`
- `victory`: `가려진 서약이 끊기고 아홉 번째 봉쇄선이 이어졌다.`
- `defeat`: `서약의 압력이 관문을 닫았다. 아홉 번째 봉쇄선으로 복귀하라.`

### `gate-zenith` — W-01, W-02, W-03, W-05

- `intro[0]`: `Gate Zenith에서 Moonless Court의 명령망이 Echo Deep과 맞닿는다.`
- `intro[1]`: `Dusk Warden, 마지막 추출점을 점유하고 열 번째 관문을 지켜라.`
- `elite`: `섭정의 잔향이 마지막 결속 신호로 남는다.`
- `victory`: `Moonless Court의 명령망이 끊겼다. 열 번째 봉쇄선은 유지되고 Echo Deep은 남는다.`
- `defeat`: `마지막 관문이 무너졌다. Dusk Warden, 열 번째 봉쇄선으로 복귀하라.`

## Resolved catalog copy fixes

Systems Designer responded `fixed` for all seven live lore violation IDs and applied these replacements without changing object IDs or mechanics. The applied strings were inspected in `defense-catalog.js#74A9`.

| resolved violation | catalog path | previous text | applied replacement | trace |
|---|---|---|---|---|
| LOR-01 | `CUTSCENES[\"cinder-span\"].defeat` | `군단의 닻이 끊어졌다. 다시 일어나라.` | `첫 번째 봉쇄선이 끊어졌다. Dusk Warden, 관문으로 복귀하라.` | W-03 |
| LOR-02 | `CUTSCENES[\"veil-citadel\"].intro[1]` | `두 거점을 붙들고 빙의의 힘을 깨워라.` | `점유점과 추출점을 붙들고 장막의 잔향을 결속하라.` | W-01, W-02, W-03 |
| LOR-03/LOR-04 | `CUTSCENES[\"echo-throne\"].intro[0]` | `메아리 왕좌가 마지막 바다 위에 떠 있다.` | `Moonless Court의 메아리 왕좌가 세 번째 봉쇄선 위에 떠 있다.` | W-01, W-03 |
| LOR-04 | `CUTSCENES[\"echo-throne\"].elite` | `왕좌의 잔향이 군단의 맹세를 기억한다.` | `왕좌의 잔향이 Moonless Court의 명령을 기억한다.` | W-01, W-02 |
| LOR-04 | `CUTSCENES[\"echo-throne\"].defeat` | `빈 왕좌는 없다. 다시 일어나라.` | `왕좌의 명령이 관문을 되찾았다. 세 번째 봉쇄선으로 복귀하라.` | W-02, W-03 |
| LOR-04 | `REWARDS[\"throne-echo-record\"].name` | `Throne Echo Record` | `Moonless Court Echo Record` | W-01, W-05 |
| LOR-04 | `REWARDS[\"throne-echo-record\"].description` | `왕좌의 마지막 서약을 기록` | `Moonless Court 왕좌에서 회수한 잔향을 기록실에 보존` | W-01, W-05 |
| LOR-05 | `CUTSCENES[\"echo-throne\"].victory` | `침묵한 문 앞에서 그림자 군단이 왕좌에 오른다.` | `왕좌의 명령이 끊기고 세 번째 봉쇄선이 이어졌다.` | W-02, W-03 |
| LOR-07 | `ITEMS[\"dawnless-crown-shard\"].name` | `Dawnless Crown Shard` | `Moonless Command Shard` | W-01, W-03 |
| LOR-07 | `ITEMS[\"dawnless-crown-shard\"].description` | `기본 공격 피해 +240, 관문 최대 내구 +120` | `Moonless Court 명령 파편: 기본 공격 피해 +240, 관문 최대 내구 +120` | W-01, W-03 |
| LOR-07 | `REWARDS[\"dawnless-crown\"].name` | `Dawnless Crown` | `Moonless Command Archive` | W-05 |
| LOR-07 | `REWARDS[\"dawnless-crown\"].description` | `최종 관문 승리의 왕관을 기록` | `Moonless Court의 최종 명령 잔향을 기록실에 보존` | W-01, W-05 |
| LOR-07 | `COMPANIONS[\"dawnless-crown\"].name` | `Dawnless Crown` | `Moonless Command` | W-02, W-05 |
| LOR-08 | `REWARDS[\"rift-lens-archive\"].description` | `빙의 보너스를 기록실에 보존` | `Rift Lens의 결속 기록을 기록실에 보존` | W-02, W-05 |

## Integration conditions

1. Do not attach the extraction beat to `ELITE_CANDIDATE_AVAILABLE` or progress events; it must confirm `ELITE_EXTRACTED` or `EXTRACTION_COMPLETED`.
2. Keep `FINAL_COMPLETION` distinct from ordinary victory and never say another Gate opens after Stage 10.
3. If a future spatial cutscene names an extraction point, elevation, flank, hazard, or recovery effect, verify the deterministic simulation-owned contract before shipping the copy.
4. Animation/VFX/audio remain optional observers. Text and outcome controls are the complete fallback.
5. Game programmer defect responses must be `fixed` or `deferred` with a reason; QA must not infer implementation from this handoff.
