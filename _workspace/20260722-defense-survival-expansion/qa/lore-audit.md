---
gate: G1
owner: narrative-cinematics-director
date: 2026-07-22
verdict: FIX
catalog_snapshot: "defense-catalog.js#74A9 after resolved-copy handoff"
---
# Player-visible lore trace audit

## Verdict

**FIX — not PASS.** The six requested catalog groups are completely inventoried: **136/136 string/event entries** have unique trace IDs and a W-01…W-05 mapping. **Zero live lore/continuity violations remain in those six groups.** Four presentation/integration gaps and the not-exhaustive full-app boundary remain. No G4 claim is made.

| group | expected | audited | coverage |
|---|---:|---:|---:|
| `CUTSCENES` | 55 authored text entries (ten stage sets plus `default`) | 55 | 100% |
| `ITEMS` | 5 names + 5 descriptions | 10 | 100% |
| `REWARDS` | 9 names + 9 descriptions | 18 | 100% |
| `AUDIO_CUES` | 13 cue/event entries | 13 | 100% |
| `STAGES` | 10 stage names + 10 boss names | 20 | 100% |
| `ANIMATION_CLIPS` | 20 clip labels/events | 20 | 100% |
| **Total** | **136** | **136** | **100%** |

“Conformant” below means the inspected entry has a direct narrative trace. It does not mean its consumer was browser-tested. “Trace-only” means the declaration is mapped but no inspected runtime consumer established player visibility. “Violation” points to the exact issue list.

## Authority and inspection boundary

Inspected sources:

- Active vault report: `wiki/reports/2026-07-22-abyssal-command-defense-rpg-production-plan.md`.
- Catalog snapshot `defense-catalog.js#74A9`: lines 23–128 for the six narrative/presentation groups and lines 176–310 for stage tactics/order.
- Event attachment and spatial consumers: `defense-run-simulation.js#8BF5`, including cue lookup, policy targeting, movement/range, hazards, occupation, extraction, terminal outcomes, and stage start.
- Overlay consumption: `defense-cutscene.js` lines 5–35 and `app.js` lines 476–505.
- Catalog label rendering sampled in `app.js` lines 91–141 and 534–645; stage labels are supplied by the identical campaign-stage list in `campaign-state.js`.
- Audio observation: `defense-audio.js` lines 37–60.
- Existing evidence: `tests/defense-cutscene.test.mjs`, `tests/defense-survivor-browser.cjs`, and cycle-1 retrospective lines 6–9, as reported by the production director. This evidence covers stage entry only; it is not a full G1/G4 pass.

This audit does **not** claim a full-app string audit. Sampled non-catalog app copy is categorized at the end so the catalog result is not mistaken for all player-visible content.

## `CUTSCENES` — 55/55

| trace ID | catalog path | exact inspected text | W trace | result |
|---|---|---|---|---|
| TR-CUT-001 | `cinder-span.intro[0]` | `심연의 문이 열렸다.` | W-03 | conformant: Gate/containment threat |
| TR-CUT-002 | `cinder-span.intro[1]` | `잿빛 교량에서 재의 메아리를 묶어라.` | W-01, W-02 | conformant: Echo recovery and binding |
| TR-CUT-003 | `cinder-span.elite` | `열기가 없는 불씨가 영혼 웅덩이를 남긴다.` | W-01 | conformant as defeat residue; “영혼 웅덩이” is not elevated to a new system term |
| TR-CUT-004 | `cinder-span.victory` | `다리 끝의 재가 다음 봉쇄선을 가리킨다.` | W-03 | conformant for a non-final containment-line victory |
| TR-CUT-005 | `cinder-span.defeat` | `첫 번째 봉쇄선이 끊어졌다. Dusk Warden, 관문으로 복귀하라.` | W-03 | conformant: defender, line, and Gate are explicit |
| TR-CUT-006 | `veil-citadel.intro[0]` | `장막 성채가 신호를 삼킨다.` | W-02, W-03 | conformant only as an obedience-signal threat; no new signal type inferred |
| TR-CUT-007 | `veil-citadel.intro[1]` | `점유점과 추출점을 붙들고 장막의 잔향을 결속하라.` | W-01, W-02, W-03 | conformant: both authored points and Bind language are explicit |
| TR-CUT-008 | `veil-citadel.elite` | `감시석의 빈 투구가 새로운 의지를 기다린다.` | W-02 | conformant as extraction candidacy; no identity beyond the text is asserted |
| TR-CUT-009 | `veil-citadel.victory` | `거울의 명령이 끊기고 왕좌의 방향이 열린다.` | W-02, W-03 | conformant as a severed command and route to the next stage |
| TR-CUT-010 | `veil-citadel.defeat` | `장막이 다시 닫혔다. 신호를 되찾아라.` | W-02, W-03 | conformant as signal recovery after failed defense |
| TR-CUT-011 | `echo-throne.intro[0]` | `Moonless Court의 메아리 왕좌가 세 번째 봉쇄선 위에 떠 있다.` | W-01, W-03 | conformant: faction, place, and campaign position are explicit |
| TR-CUT-012 | `echo-throne.intro[1]` | `한 번뿐인 군주의 영역으로 관문을 버텨라.` | W-03, W-04 | conformant as a bounded Domain defending the Gate; “군주” affiliation is not inferred |
| TR-CUT-013 | `echo-throne.elite` | `왕좌의 잔향이 Moonless Court의 명령을 기억한다.` | W-01, W-02 | conformant: recovered matter and faction command are explicit |
| TR-CUT-014 | `echo-throne.victory` | `왕좌의 명령이 끊기고 세 번째 봉쇄선이 이어졌다.` | W-02, W-03 | conformant containment progress |
| TR-CUT-015 | `echo-throne.defeat` | `왕좌의 명령이 관문을 되찾았다. 세 번째 봉쇄선으로 복귀하라.` | W-02, W-03 | conformant defeat and retry direction |
| TR-CUT-016 | `sunken-bastion.intro[0]` | `가라앉은 보루의 네 번째 봉쇄선이 흔들린다.` | W-03 | conformant |
| TR-CUT-017 | `sunken-bastion.intro[1]` | `침수된 추출점을 점유하고 닻의 잔향을 결속하라.` | W-01, W-02, W-03 | conformant; point and flood hazard are authored |
| TR-CUT-018 | `sunken-bastion.elite` | `닻의 잔향이 물길의 추출점에 머문다.` | W-01, W-02 | conformant |
| TR-CUT-019 | `sunken-bastion.victory` | `조류의 명령이 끊기고 네 번째 봉쇄선이 이어졌다.` | W-02, W-03 | conformant |
| TR-CUT-020 | `sunken-bastion.defeat` | `침수 압력이 관문을 무너뜨렸다. 네 번째 봉쇄선으로 복귀하라.` | W-03 | conformant |
| TR-CUT-021 | `howling-sprawl.intro[0]` | `울부짖는 황야가 다섯 번째 관문의 측면을 연다.` | W-03 | conformant; flank is authored |
| TR-CUT-022 | `howling-sprawl.intro[1]` | `측면 추출점을 점유하고 무리의 잔향을 회수하라.` | W-01, W-02, W-03 | conformant |
| TR-CUT-023 | `howling-sprawl.elite` | `무리의 잔향이 바람길의 결속 신호로 남는다.` | W-01, W-02 | conformant |
| TR-CUT-024 | `howling-sprawl.victory` | `측면의 명령이 끊기고 다섯 번째 봉쇄선이 닫혔다.` | W-02, W-03 | conformant |
| TR-CUT-025 | `howling-sprawl.defeat` | `측면 압력이 관문을 갈랐다. 다섯 번째 봉쇄선으로 복귀하라.` | W-03 | conformant |
| TR-CUT-026 | `glass-necropolis.intro[0]` | `유리 묘역의 고지가 여섯 번째 관문을 내려다본다.` | W-03 | conformant; elevation is authored |
| TR-CUT-027 | `glass-necropolis.intro[1]` | `반사되는 사선을 피해 추출점을 점유하라.` | W-02, W-03 | conformant; hazard and extraction point are authored |
| TR-CUT-028 | `glass-necropolis.elite` | `합창의 잔향이 깨진 기록면 위에 머문다.` | W-01, W-05 | conformant |
| TR-CUT-029 | `glass-necropolis.victory` | `반사된 명령이 멎고 여섯 번째 봉쇄선이 이어졌다.` | W-02, W-03 | conformant |
| TR-CUT-030 | `glass-necropolis.defeat` | `집중 사격이 관문을 깨뜨렸다. 여섯 번째 봉쇄선으로 복귀하라.` | W-03 | conformant |
| TR-CUT-031 | `starless-canal.intro[0]` | `별 없는 운하가 일곱 번째 관문으로 갈라진다.` | W-03 | conformant |
| TR-CUT-032 | `starless-canal.intro[1]` | `위험 수로의 추출점을 점유하고 통행 잔향을 회수하라.` | W-01, W-02, W-03 | conformant; hazard and point are authored |
| TR-CUT-033 | `starless-canal.elite` | `통행의 잔향이 잠긴 수문에서 결속을 기다린다.` | W-01, W-02 | conformant |
| TR-CUT-034 | `starless-canal.victory` | `수로의 명령이 끊기고 일곱 번째 봉쇄선이 이어졌다.` | W-02, W-03 | conformant |
| TR-CUT-035 | `starless-canal.defeat` | `갈라진 수로가 관문을 포위했다. 일곱 번째 봉쇄선으로 복귀하라.` | W-03 | conformant |
| TR-CUT-036 | `shattered-causeway.intro[0]` | `부서진 둑길이 여덟 번째 관문 앞에서 끊겼다.` | W-03 | conformant |
| TR-CUT-037 | `shattered-causeway.intro[1]` | `붕괴 구간의 추출점을 점유하고 교량 잔향을 결속하라.` | W-01, W-02, W-03 | conformant; hazard and point are authored |
| TR-CUT-038 | `shattered-causeway.elite` | `교량의 잔향이 무너진 연결부를 붙든다.` | W-01, W-02 | conformant |
| TR-CUT-039 | `shattered-causeway.victory` | `거상의 압력이 멎고 여덟 번째 봉쇄선이 이어졌다.` | W-03 | conformant |
| TR-CUT-040 | `shattered-causeway.defeat` | `붕괴 충격이 관문에 닿았다. 여덟 번째 봉쇄선으로 복귀하라.` | W-03 | conformant |
| TR-CUT-041 | `abyss-chancel.intro[0]` | `심연 예배소의 서약이 아홉 번째 관문을 억누른다.` | W-03 | conformant; no new faction is inferred |
| TR-CUT-042 | `abyss-chancel.intro[1]` | `서약의 추출점을 점유하고 명령 잔향을 역전하라.` | W-01, W-02, W-03 | conformant |
| TR-CUT-043 | `abyss-chancel.elite` | `서명자의 잔향이 결속할 새 명령을 기다린다.` | W-01, W-02 | conformant |
| TR-CUT-044 | `abyss-chancel.victory` | `가려진 서약이 끊기고 아홉 번째 봉쇄선이 이어졌다.` | W-02, W-03 | conformant |
| TR-CUT-045 | `abyss-chancel.defeat` | `서약의 압력이 관문을 닫았다. 아홉 번째 봉쇄선으로 복귀하라.` | W-03 | conformant |
| TR-CUT-046 | `gate-zenith.intro[0]` | `Gate Zenith에서 Moonless Court의 명령망이 Echo Deep과 맞닿는다.` | W-01, W-02, W-03 | conformant; established antagonist, matter, and final Gate are explicit |
| TR-CUT-047 | `gate-zenith.intro[1]` | `Dusk Warden, 마지막 추출점을 점유하고 열 번째 관문을 지켜라.` | W-02, W-03 | conformant; player identity and finality are explicit |
| TR-CUT-048 | `gate-zenith.elite` | `섭정의 잔향이 마지막 결속 신호로 남는다.` | W-01, W-02 | conformant |
| TR-CUT-049 | `gate-zenith.victory` | `Moonless Court의 명령망이 끊겼다. 열 번째 봉쇄선은 유지되고 Echo Deep은 남는다.` | W-01, W-02, W-03, W-05 | conformant final ending; containment, not abyss destruction |
| TR-CUT-050 | `gate-zenith.defeat` | `마지막 관문이 무너졌다. Dusk Warden, 열 번째 봉쇄선으로 복귀하라.` | W-03, W-05 | conformant |
| TR-CUT-051 | `default.intro[0]` | `새 봉쇄선이 신호를 삼킨다.` | W-02, W-03 | conformant fallback |
| TR-CUT-052 | `default.intro[1]` | `관문을 지키고 메아리를 추출하라.` | W-01, W-02, W-03 | conformant fallback |
| TR-CUT-053 | `default.elite` | `잔향이 다음 전선을 가리킨다.` | W-01, W-03 | conformant candidate fallback; not extraction success |
| TR-CUT-054 | `default.victory` | `봉쇄선이 유지되고 다음 관문이 열린다.` | W-03 | conformant only as a non-final fallback; no current stage selects it |
| TR-CUT-055 | `default.defeat` | `관문이 무너졌다. 다시 일어나라.` | W-03 | conformant fallback |

## `ITEMS` — 10/10

The item objects are consumed mechanically and emit `ITEM_COLLECTED` with `itemId`. No inspected app reference renders `ITEMS.name` or `ITEMS.description`; the strings are audited because they are authored catalog copy, not claimed as currently visible.

| trace ID | catalog path | exact inspected string | W trace | result |
|---|---|---|---|---|
| TR-ITM-001 | `ashen-sigil.name` | `Ashen Sigil` | W-01 | conformant: recovered Echo material used for run power |
| TR-ITM-002 | `ashen-sigil.description` | `기본 공격 피해 +180` | W-01 | conformant mechanical outcome |
| TR-ITM-003 | `ward-splinter.name` | `Ward Splinter` | W-03 | conformant Gate-defense material |
| TR-ITM-004 | `ward-splinter.description` | `관문 최대 내구 +80, 즉시 +80` | W-03 | conformant |
| TR-ITM-005 | `echo-compass.name` | `Echo Compass` | W-01 | conformant |
| TR-ITM-006 | `echo-compass.description` | `XP 흡수 반경 +2500` | W-01 | conformant harvest effect |
| TR-ITM-007 | `hourglass-fragment.name` | `Hourglass Fragment` | W-04 | conformant as bounded ability timing |
| TR-ITM-008 | `hourglass-fragment.description` | `스킬 쿨다운 10% 감소` | W-04 | conformant |
| TR-ITM-009 | `dawnless-crown-shard.name` | `Moonless Command Shard` | W-01, W-03 | conformant Moonless Court command residue |
| TR-ITM-010 | `dawnless-crown-shard.description` | `Moonless Court 명령 파편: 기본 공격 피해 +240, 관문 최대 내구 +120` | W-01, W-03 | conformant source and mechanics |

## `REWARDS` — 18/18

Reward names/descriptions are rendered in the inspected lobby and terminal reward cards.

| trace ID | catalog path | exact inspected string | W trace | result |
|---|---|---|---|---|
| TR-RWD-001 | `ember-cohort-legacy.name` | `Ember Cohort Legacy` | W-02, W-05 | conformant companion/Archive vocabulary |
| TR-RWD-002 | `ember-cohort-legacy.description` | `다음 런의 동료 슬롯에 Ember Cohort 기록` | W-02, W-05 | conformant |
| TR-RWD-003 | `rift-lens-archive.name` | `Rift Lens Archive` | W-05 | conformant |
| TR-RWD-004 | `rift-lens-archive.description` | `Rift Lens의 결속 기록을 기록실에 보존` | W-02, W-05 | conformant lore-only Archive record |
| TR-RWD-005 | `stillwater-hourglass.name` | `Stillwater Hourglass` | W-04, W-05 | conformant |
| TR-RWD-006 | `stillwater-hourglass.description` | `런 시작 시 스킬 쿨다운 20% 감소` | W-04, W-05 | conformant |
| TR-RWD-007 | `bulwark-brand.name` | `Bulwark Brand` | W-03, W-05 | conformant |
| TR-RWD-008 | `bulwark-brand.description` | `보스 반격 피해 2 감소` | W-03, W-05 | conformant |
| TR-RWD-009 | `veil-vanguard-legacy.name` | `Veil Vanguard Legacy` | W-02, W-05 | conformant |
| TR-RWD-010 | `veil-vanguard-legacy.description` | `다음 런 시작 시 그림자 1기 추가` | W-02, W-05 | conformant as a recorded companion; no faction identity inferred |
| TR-RWD-011 | `anchor-shard-archive.name` | `Anchor Shard Archive` | W-03, W-05 | conformant |
| TR-RWD-012 | `anchor-shard-archive.description` | `다음 스테이지 진입 시 관문 내구 +40` | W-03, W-05 | conformant |
| TR-RWD-013 | `abyssal-banner.name` | `Abyssal Banner` | W-02, W-05 | conformant as extracted-companion command modifier |
| TR-RWD-014 | `abyssal-banner.description` | `런 시작 및 이후 추출 동료 공격력 +60` | W-02, W-05 | conformant |
| TR-RWD-015 | `throne-echo-record.name` | `Moonless Court Echo Record` | W-01, W-05 | conformant faction Echo record |
| TR-RWD-016 | `throne-echo-record.description` | `Moonless Court 왕좌에서 회수한 잔향을 기록실에 보존` | W-01, W-05 | conformant |
| TR-RWD-017 | `dawnless-crown.name` | `Moonless Command Archive` | W-05 | conformant faction command Archive |
| TR-RWD-018 | `dawnless-crown.description` | `Moonless Court의 최종 명령 잔향을 기록실에 보존` | W-01, W-05 | conformant |

## `AUDIO_CUES` — 13/13

Cue IDs are consumed from simulation events by `DefenseAudio`; waveform/frequency/duration are presentation parameters, not player-facing lore text. Five newly authored cue IDs have no inspected event attachment and are marked trace-only.

| trace ID | catalog cue | inspected event attachment | W trace | result |
|---|---|---|---|---|
| TR-AUD-001 | `stageStart` / `stage-start` | `STAGE_STARTED` | W-03 | conformant |
| TR-AUD-002 | `enemyDefeated` / `enemy-defeated` | `ENEMY_DEFEATED` | W-01 | conformant Echo-release cue |
| TR-AUD-003 | `eliteExtracted` / `elite-extracted` | `ELITE_EXTRACTED` and `EXTRACTION_COMPLETED` | W-02, W-05 | conformant; two success events share the cue |
| TR-AUD-004 | `itemCollected` / `item-collected` | `ITEM_COLLECTED` and `OCCUPATION_CAPTURED` | W-01, W-02 | conformant event sound, but subject to GAP-AUD-01 |
| TR-AUD-005 | `growthOffer` / `growth-offer` | `GROWTH_OFFER` and `SKILL_SELECTED` | W-01, W-04 | conformant |
| TR-AUD-006 | `skillCast` / `skill-cast` | `SKILL_CAST` | W-04 | conformant |
| TR-AUD-007 | `bossSpawned` / `boss-spawned` | `BOSS_SPAWNED` | W-03 | conformant Gate-pressure cue |
| TR-AUD-008 | `movementStep` / `movement-step` | no inspected attachment | W-03 | trace-only movement feedback |
| TR-AUD-009 | `weaponFire` / `weapon-fire` | no inspected attachment | W-03, W-04 | trace-only combat feedback |
| TR-AUD-010 | `impactHit` / `impact-hit` | no inspected attachment | W-01, W-03 | trace-only impact feedback |
| TR-AUD-011 | `extractionReady` / `extraction-ready` | no inspected attachment | W-02 | trace-only extraction availability |
| TR-AUD-012 | `occupationCaptured` / `occupation-captured` | no inspected attachment | W-02, W-03 | trace-only occupation resolution |
| TR-AUD-013 | `terminal` / `terminal` | `TERMINAL` and `REWARD_SELECTED` | W-03, W-05 | conformant; one cue ID serves terminal and reward selection |

## `STAGES` — 20/20

The inspected app renders an identical campaign-stage list: stage name in lobby/HUD and boss name in lobby labels. `defense-catalog.js` itself supplies the simulation’s stage/boss snapshot. A W-03 trace describes their role as containment-line location and named pressure source; it does not assert any boss’s faction or biography.

| trace ID | catalog field | exact inspected string | W trace | result |
|---|---|---|---|---|
| TR-STG-001 | `cinder-span.name` | `Cinder Span` | W-03 | conformant location label |
| TR-STG-002 | `cinder-span.bossName` | `Cinder Warden` | W-03 | conformant named Gate threat; affiliation not asserted |
| TR-STG-003 | `veil-citadel.name` | `Veil Citadel` | W-03 | conformant location label |
| TR-STG-004 | `veil-citadel.bossName` | `Veil Tactician` | W-03 | conformant named Gate threat; affiliation not asserted |
| TR-STG-005 | `echo-throne.name` | `Echo Throne` | W-01, W-03 | conformant location label; current intro identifies it with Moonless Court |
| TR-STG-006 | `echo-throne.bossName` | `Gate Sovereign` | W-03 | conformant named Gate threat; affiliation not asserted |
| TR-STG-007 | `sunken-bastion.name` | `Sunken Bastion` | W-03 | conformant location label |
| TR-STG-008 | `sunken-bastion.bossName` | `Tide Warden` | W-03 | conformant named Gate threat; affiliation not asserted |
| TR-STG-009 | `howling-sprawl.name` | `Howling Sprawl` | W-03 | conformant location label |
| TR-STG-010 | `howling-sprawl.bossName` | `Pack Herald` | W-03 | conformant named Gate threat; affiliation not asserted |
| TR-STG-011 | `glass-necropolis.name` | `Glass Necropolis` | W-03 | conformant location label |
| TR-STG-012 | `glass-necropolis.bossName` | `Requiem Choir` | W-03 | conformant named Gate threat; affiliation not asserted |
| TR-STG-013 | `starless-canal.name` | `Starless Canal` | W-03 | conformant location label |
| TR-STG-014 | `starless-canal.bossName` | `Lantern Tyrant` | W-03 | conformant named Gate threat; affiliation not asserted |
| TR-STG-015 | `shattered-causeway.name` | `Shattered Causeway` | W-03 | conformant location label |
| TR-STG-016 | `shattered-causeway.bossName` | `Bridge Colossus` | W-03 | conformant named Gate threat; affiliation not asserted |
| TR-STG-017 | `abyss-chancel.name` | `Abyss Chancel` | W-03 | conformant location label |
| TR-STG-018 | `abyss-chancel.bossName` | `Veiled Concordat` | W-03 | conformant named Gate threat; affiliation not asserted |
| TR-STG-019 | `gate-zenith.name` | `Gate Zenith` | W-03, W-05 | conformant final containment/record location |
| TR-STG-020 | `gate-zenith.bossName` | `Abyss Regent` | W-03 | conformant named final Gate threat; affiliation not asserted |

## `ANIMATION_CLIPS` — 20/20

No inspected source imports `ANIMATION_CLIPS`; the current realtime renderer cycles texture frames independently. These entries are therefore **trace-only authored motion vocabulary**, not claimed runtime clips.

| trace ID | catalog clip | W trace | result |
|---|---|---|---|
| TR-ANI-001 | `commander.idle` | W-03 | trace-only Gate-defense posture |
| TR-ANI-002 | `commander.walk` | W-03 | trace-only pressure-axis repositioning |
| TR-ANI-003 | `commander.strike` | W-01, W-03 | trace-only threat suppression before Echo recovery |
| TR-ANI-004 | `commander.cast` | W-04 | trace-only Domain/active-skill presentation |
| TR-ANI-005 | `commander.damage` | W-03 | trace-only player pressure feedback |
| TR-ANI-006 | `commander.low-hp` | W-03 | trace-only low-integrity feedback |
| TR-ANI-007 | `enemy.idle` | W-03 | trace-only Gate-threat read state |
| TR-ANI-008 | `enemy.advance` | W-03 | trace-only Gate-pressure movement |
| TR-ANI-009 | `enemy.strike` | W-03 | trace-only Gate/player pressure |
| TR-ANI-010 | `enemy.defeat` | W-01 | trace-only Echo release |
| TR-ANI-011 | `enemy.flank` | W-03 | trace-only flank policy readability |
| TR-ANI-012 | `enemy.escort` | W-03 | trace-only elite-escort readability |
| TR-ANI-013 | `effects.extract` | W-02 | trace-only successful binding/extraction |
| TR-ANI-014 | `effects.extraction-ready` | W-02 | trace-only extraction availability |
| TR-ANI-015 | `effects.item` | W-01 | trace-only run-item harvest |
| TR-ANI-016 | `effects.skill` | W-04 | trace-only bounded skill effect |
| TR-ANI-017 | `effects.reward` | W-05 | trace-only Archive reward confirmation |
| TR-ANI-018 | `effects.occupation` | W-02, W-03 | trace-only occupied-point state |
| TR-ANI-019 | `effects.echo-recovery` | W-01 | trace-only Echo harvest |
| TR-ANI-020 | `effects.boss-defeat` | W-03, W-05 | trace-only containment victory/Archive transition |

## Explicit lore and continuity violations

**None live in the six named catalog groups at snapshot `defense-catalog.js#74A9`.** Every previously unexplained entry received an exact W-mapped catalog fix; no waiver was used.

| resolved ID | fixed fields | observed resolution |
|---|---|---|
| LOR-01 | TR-CUT-005 | Dusk Warden, first containment line, and Gate are explicit. |
| LOR-02 | TR-CUT-007 | The two authored objectives now use occupation/extraction and Bind vocabulary. |
| LOR-03 | TR-CUT-011 | Stage 3 and Moonless Court identity replace false “last sea” finality. |
| LOR-04 | TR-CUT-011, TR-CUT-013, TR-CUT-015, TR-RWD-015, TR-RWD-016, TR-STG-005 | Throne language is explicitly Moonless Court Echo/command matter. |
| LOR-05 | TR-CUT-014 | Stage-3 result restores the third containment line rather than taking a throne. |
| LOR-06 | TR-CUT-046…050 | Gate Zenith preserves Dusk Warden, Moonless Court, Echo Deep, the tenth Gate, and containment rather than destruction. |
| LOR-07 | TR-ITM-009, TR-ITM-010, TR-RWD-017, TR-RWD-018 | Crown/kingdom copy is replaced by Moonless Court command residue/Archive language; object IDs stay stable. |
| LOR-08 | TR-RWD-004 | Unsupported “빙의 보너스” is replaced by a lore-only Bind record. |

All ten stages have explicit cutscene sets; `default` is not selected by the current `STAGES`.

## Presentation and integration gaps (not lore rewrites)

| ID | inspected gap | trace | disposition |
|---|---|---|---|
| GAP-CIN-01 | Neither `ELITE_EXTRACTED` nor `EXTRACTION_COMPLETED` carries `cutscene`. QA also observed `EXTRACTION_COMPLETED` at tick 157 before an elite candidate and a remote `EXTRACT_ELITE` path without position/hold validation; neither event can yet truthfully anchor the required recovered-memory success beat. | W-01, W-02, W-05 | combat/programmer: `fixed` or `deferred` with reason; evidence in `../messages/20260722-qa-stage1-fix-broadcast.md` |
| GAP-CIN-03 | Reduced-motion CSS removes overlay shadow, but the complete camera/flash/strobe fallback has no inspected browser evidence. | W-01…W-05 | presentation/QA evidence required |
| GAP-ANI-01 | All 20 `ANIMATION_CLIPS` labels still have no inspected import/consumer. | W-01…W-05 | animation/programmer: `fixed` or `deferred` with reason |
| GAP-AUD-01 | `OCCUPATION_CAPTURED` emits `item-collected` instead of authored `occupation-captured`; `extraction-ready`, movement, weapon, and impact cues are also unattached. | W-01…W-04 | audio/programmer: `fixed` or `deferred` with reason |

### Resolved in the SystemsDesigner/CombatEngineer handoff

- **GAP-CIN-02 resolved:** ten stage-specific cutscene sets exist.
- **GAP-STG-01 resolved at the inspected data/simulation boundary:** all ten stages author chokepath, flank, elevation, hazard, occupation, extraction, spawn-direction, and seeded-variation data. The inspected simulation consumes range, movement, recovery, hazard, occupation, extraction, flank/policy, and deterministic wave schedule state. This audit does not substitute for runtime test evidence.

## Sampled player-facing copy outside the six catalog groups

This is categorization evidence, not a complete app audit.

| trace ID | inspected app copy | W trace | note |
|---|---|---|---|
| TR-APP-S01 | `심연 방어선` | W-03 | lobby title |
| TR-APP-S02 | `관문을 지키고 잔향을 회수해 성장한 뒤, 추출점을 점유해 정예를 결속하고 보스를 봉쇄하십시오. 결속한 동료와 보상은 기록실에 남습니다.` | W-01, W-02, W-03, W-04, W-05 | fixed lobby loop summary |
| TR-APP-S03 | `관문 방어 / 잔향 회수 / 성장 / 점유·추출 / 보스 봉쇄` | W-03, W-01, W-04, W-02, W-03 | fixed five-beat story strip |
| TR-APP-S04 | `영구 보상` / `보상 선택 · 영구 기록` | W-05 | reward UI |
| TR-APP-S05 | `관문 내구` | W-03 | battle HUD |
| TR-APP-S06 | `성장 선택 · 전투 일시 정지` | W-04 | growth UI |
| TR-APP-S07 | `정예 추출` | W-02 | extraction action |
| TR-APP-S08 | `봉쇄선 진입` / `정예 잔향` / `전투 기록` / `심연 기록` | W-01, W-02, W-03, W-05 | cutscene adapter titles |
| TR-APP-S09 | `계속` | W-03 | immediate cutscene dismissal control; neutral UI text |
| TR-APP-S10 | `심연 방어선 완수` / `관문 방어 성공` / `방어선이 무너졌습니다` | W-03, W-05 | terminal result headings |
| TR-APP-S11 | `GATE DANGER` | W-03 | inspected realtime renderer Gate-pressure badge |
| TR-APP-S12 | `DOMAIN` | W-04 | inspected realtime renderer cast badge |
| TR-APP-S13 | `EXTRACT` / `ECHO BOUND` | W-01, W-02 | inspected realtime renderer extraction-point and success badges |
| TR-APP-S14 | `LINE RESTORED` / `ARCHIVED` | W-03, W-05 | inspected realtime renderer victory/reward badges |
| TR-APP-S15 | `Moonless Command` | W-02, W-05 | fixed extracted-companion display name; object ID remains `dawnless-crown` |

Because additional lobby, control, error, storage, skill-ID, and status strings exist outside this sample, **100% catalog coverage must not be reported as 100% of all player-visible content**.

## Cinematic acceptance check

| required beat | trigger named | duration 6–10s | fallback named | trace named | current runtime claim |
|---|---:|---:|---:|---:|---|
| intro | yes | 8s | yes | yes | stage-entry overlay only is evidence-backed |
| extraction | yes | 6s | yes | yes | specification gap; not claimed implemented |
| boss victory | yes | 8s | yes | yes | event payload inspected; browser behavior unverified |
| defeat | yes | 6s | yes | yes | event payload inspected; browser behavior unverified |

The authoritative beat details and accepted post-handoff stage-specific copy are in `../messages/20260722-cinematic-beat-handoff.md`.
