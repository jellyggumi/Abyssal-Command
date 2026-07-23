---
gate: G1
owner: narrative-cinematics-director
date: 2026-07-22
status: FIX
---
# G1 shipped player-content trace receipt

## Verdict

**FIX pending G1-SKL-01; no waiver is granted.** The prior 136-entry catalog audit remains complete. This receipt extends inspection to the default shipped HTML/PWA entry, all app-rendered copy sites, companion/skill display surfaces, realtime canvas badges and effects, authored scenario identifiers, audio/cutscene observers, CSS-generated text, and the directly addressable privacy page. `privacy.html` OPS-COPY-01 is fixed. Raw skill IDs remain the sole live lore-copy violation until the approved display metadata lands.

This is a source/content receipt, not gameplay, balance, browser-impression, or release-gate evidence.

## Inspected shipped boundary

| source | inspected player surface | disposition |
|---|---|---|
| `index.html` | document metadata, title, no-script fallback | traced |
| `manifest.json`, `icon.svg` | install metadata and icon resource semantics | traced |
| `privacy.html` | directly addressable privacy disclosure and back link | traced; OPS-COPY-01 fixed by ReleaseEngineer |
| `app.js` | lobby, storage/status, controls, battle HUD, growth/reward cards, terminal actions, cutscene overlay | traced |
| `defense-catalog.js` | every authored label plus policy, actor, skill, stage, route, terrain, item, reward, cue, cutscene, and animation identifier | traced; G1-SKL-01 pending |
| `defense-run-simulation.js`, `campaign-state.js` | event/outcome/objective identifiers that select visible copy or presentation | traced; behavior is not certified here |
| `defense-cutscene.js` | visible cutscene titles and fallback title | traced |
| `battle-realtime-three.js` | canvas badges, event-effect selectors, commander/enemy texture identities | traced |
| `battle-visualizer.js`, `defense-viewport.js` | fallback geometry and viewport transform | no authored player text or new lore identifier |
| `defense-audio.js` | cue-ID observer | all authored cue IDs remain covered by `qa/lore-audit.md` |
| `styles.css`, `react-game-ui.css` | generated text and reduced-motion styles | only visible generated content is neutral `◆`; empty decorative pseudo-elements add no copy |
| `defense-storage.js`, `defense-telemetry.js` | visible backend names and local diagnostic-export semantics | traced through W-05; internal schemas/errors are not rendered |
| `sw.js` | default offline core asset list | no player text; confirms `privacy.html` is not a core app route but it remains directly addressable |

Tests, `_workspace` production notes, downloaded JSON payload contents, debug-only event records, comments, internal object keys, MIME strings, URLs, and DOM/data selectors are not player-visible shipped copy. They are not counted as display strings. Identifiers below are included when they select an observed effect/scenario even if the raw identifier is not drawn as text.

## Static app and metadata trace

| trace | exact inspected copy | W mapping |
|---|---|---|
| G1-META-01 | `Abyssal Command — 심연 방어선`; `심연의 관문을 지키는 모바일 생존 방어 캠페인`; `심연 방어선을 지휘하려면 JavaScript가 필요합니다.` | W-03 |
| G1-META-02 | manifest `Abyssal Command`; `AbyssalCommand`; `A browser-local deterministic Abyssal defense-survivor campaign.` | W-03, W-05 |
| G1-META-03 | corrected privacy copy: `Abyssal Command is an offline, browser-local game.`; no analytics SDK/account/cookies/telemetry upload/consent banner; local campaign/settings and user-triggered diagnostic JSON; static-host HTTP boundary; `Back to game` | W-05 |
| G1-UI-01 | `ABYSSAL COMMAND · DEFENSE SURVIVOR`; `심연 방어선`; `관문을 지키고 잔향을 회수해 성장한 뒤, 추출점을 점유해 정예를 결속하고 보스를 봉쇄하십시오. 결속한 동료와 보상은 기록실에 남습니다.` | W-01…W-05 |
| G1-UI-02 | `관문 방어`; `잔향 회수`; `성장`; `점유·추출`; `보스 봉쇄`; `심연 방어선 이야기` | W-03; W-01; W-04; W-02; W-03 |
| G1-UI-03 | `출전 구역`; `잠김`; `선택됨`; `출전 가능`; `<sequence>. <stage> · <boss>`; `<stage> 출전` | W-03 |
| G1-UI-04 | `동료 편성 · <n>/3`; `동료는 정예를 쓰러뜨린 뒤 추출하면 영구 기록됩니다. 전투 중에는 편성을 바꿀 수 없습니다.`; `진화 <n> · 추출 <n>`; `정예 후보를 처치하고 추출하면 동료가 이곳에 기록됩니다.` | W-01, W-02, W-05 |
| G1-UI-05 | `영구 보상 · <n>`; `기록된 보상`; `보스 승리 후 한 가지 보상을 기록합니다.`; `업적 <n>개 · 추출 동료 <n>명 · 기록은 오프라인 저장됩니다.` | W-02, W-03, W-05 |
| G1-UI-06 | `캠페인 제어`; `기록 내보내기`; `기록 가져오기`; `진단 내보내기`; `새 기록`; `저장소: <backend>`; `확인 중` | W-05 |
| G1-UI-07 | `기록을 불러오는 중입니다.`; `동료 편성을 저장했습니다.`; `내보낼 유효한 기록이 없습니다.`; `기록 형식을 확인할 수 없습니다.`; `기록을 가져왔습니다.`; `새 기록을 시작했습니다.`; `출전 기록을 저장했습니다.`; `저장소에 기록하지 못했습니다. 현재 세션은 계속됩니다.`; `저장소 <backend> 준비됨` | W-05 |
| G1-UI-08 | `<companion> 동료를 기록했습니다.`; `패배 기록을 저장했습니다.`; `방어 기록과 보상을 저장했습니다.` | W-02, W-03, W-05 |
| G1-UI-09 | `심연 방어 전장`; `방어 전장`; `활성 스킬`; `전투 행동`; `사용자 일시 정지`; `전투 계속`; `일시 정지`; `전투 종료` | W-03, W-04 |
| G1-UI-10 | `성장 선택 중 · 전투 정지`; `성장 선택 · 전투 일시 정지`; `등급 <n> → <n>`; `기본 공격 <n> → <n>`; `회수 반경 <n> → <n>`; `최대 내구 <n> → <n>`; `피해 <n> → <n>`; `회복 <n> → <n>`; `재사용 <n>초` | W-01, W-03, W-04 |
| G1-UI-11 | `보상 선택 중 · 기록 대기`; `보상 선택 · 영구 기록`; `이번 승리의 보상 하나를 다음 출전에 적용합니다.`; `Archive 기록 <n> → <n>`; `쿨다운 감소 <n>% → <n>%`; `관문 피해 감소 <n> → <n>`; `관문 최대 내구 <n> → <n>`; `추출 동료 <n> → 1`; `동료 공격 보너스 <n> → <n>`; `이미 기록됨`; `기록 보상` | W-02, W-03, W-04, W-05 |
| G1-UI-12 | `시간 <n>초 · Lv.<n>`; `관문 내구 <n>/<n>`; `적 <n> · 처치 <n> · 아이템 <n>`; `정예 추출 · <companion>` | W-01, W-02, W-03, W-04 |
| G1-UI-13 | `방어선이 무너졌습니다`; `심연 방어선 완수`; `관문 방어 성공`; `같은 구역 재도전`; `기록실로`; `다음 구역`; `로비` | W-03, W-05 |
| G1-CIN-01 | `봉쇄선 진입`; `정예 잔향`; `전투 기록`; fallback `심연 기록`; dismissal `계속` | W-01, W-02, W-03, W-05 |

`indexeddb`, `localstorage`, and `memory` can appear only as the value of the explicitly local `저장소` status. They describe the W-05 persistence backend and introduce no world entity.

## Catalog names and visible interpolations

`qa/lore-audit.md` remains authoritative for all 136 exact entries in `CUTSCENES` (55), `ITEMS` (10), `REWARDS` (18), `AUDIO_CUES` (13), `STAGES` (20), and `ANIMATION_CLIPS` (20). Current routes render every stage name/boss name, known reward name/description, and companion display name from authored catalog entries; raw-ID fallbacks are not selected by the current valid catalog.

| trace | exact display names | W mapping | result |
|---|---|---|---|
| G1-CMP-01 | `Ember Cohort`; `Rift Lens`; `Veil Vanguard`; `Anchor Shard`; `Throne Echo`; `Moonless Command` | W-02, W-05; stage/cutscene relationship supplies W-01/W-03 | conformant |
| G1-SKL-01 | approved display names: `Echo Bolt`; `Echo Lance`; `Echo Pulse`; `Gate Aegis`; `Dusk Step`; `Dusk Edge`; `Echo Magnet`; `Gate Binder` | W-01, W-03, W-04 | **pending catalog metadata; raw IDs remain visible until fixed** |

## Realtime renderer labels and effects

| trace | exact label/effect identifiers | W mapping |
|---|---|---|
| G1-VFX-01 | `CHOKE`; `FLANK`; `RANGE`; `HAZARD` | W-03 |
| G1-VFX-02 | `OCCUPY`; `CONTESTED`; `OCCUPIED`; `GROWTH`; `DOMAIN` | W-02, W-03, W-04 |
| G1-VFX-03 | `BIND LOCKED`; `EXTRACT`; `EXTRACTED`; `EXTRACT FAILED`; `ECHO BOUND` | W-01, W-02 |
| G1-VFX-04 | `GATE DANGER`; `GATE HIT`; `BOSS`; `LINE RESTORED` | W-03 |
| G1-VFX-05 | `ITEM`; `ARCHIVED` | W-01, W-05 |
| G1-VFX-06 | event-effect selectors `GATE_HIT`, `CAST`, `EXTRACTION`, `ITEM`, `BOSS`, `VICTORY`, `REWARD` selected from `GATE_BREACHED`, `SKILL_CAST`, `ELITE_EXTRACTED`, `ITEM_COLLECTED`, `BOSS_SPAWNED`, `TERMINAL`, `REWARD_SELECTED` | W-01…W-05 |
| G1-VFX-07 | `dusk-warden-frame-00…03.png`; `echo-rusher-frame-00…03.png` | W-03; W-01 |

The renderer draws labels from observer state only. This trace does not certify effect reachability, latency, reduced-motion browser behavior, or human immersion.

## Authored scenario and route identifiers

| trace | complete exact identifier set | W mapping |
|---|---|---|
| G1-SCN-01 stage IDs | `cinder-span`; `veil-citadel`; `echo-throne`; `sunken-bastion`; `howling-sprawl`; `glass-necropolis`; `starless-canal`; `shattered-causeway`; `abyss-chancel`; `gate-zenith` | W-03; W-01/W-02 where named by stage copy |
| G1-SCN-02 policy IDs | `gate-pressure`; `player-pursuit`; `flank`; `resource-denial`; `elite-escort`; `low-hp-focus` | W-01, W-02, W-03 |
| G1-SCN-03 enemy/boss classes | `rusher`; `flanker`; `guardian`; `ranged`; `s1-cinder-warden`; `s2-veil-tactician`; `s3-gate-sovereign`; `s4-tide-warden`; `s5-pack-herald`; `s6-requiem-choir`; `s7-lantern-tyrant`; `s8-bridge-colossus`; `s9-veiled-concordat`; `s10-abyss-regent` | W-01, W-03 |
| G1-SCN-04 elite IDs | `s1-ember-hunter`; `s2-veil-sentinel`; `s3-throne-wraith`; `s4-anchor-diver`; `s5-pack-sentinel`; `s6-choir-adept`; `s7-toll-keeper`; `s8-keystone-warden`; `s9-oathbound-signatory`; `s10-regent-herald` | W-01, W-02, W-03 |
| G1-SCN-05 companion IDs | `ember-cohort`; `rift-lens`; `throne-echo`; `anchor-shard`; `veil-vanguard`; `dawnless-crown` | W-02, W-05; `dawnless-crown` is a stable internal ID whose visible name is `Moonless Command` |
| G1-SCN-06 skill IDs | `rift-bolt`; `soul-lance`; `grave-pulse`; `void-aegis`; `shadow-step`; `eclipse-edge`; `soul-magnet`; `ward-binder` | W-01, W-03, W-04; IDs remain mechanics/event keys and must not be visible after G1-SKL-01 |
| G1-SCN-07 wave/objective/outcome IDs | `scout`; `pressure`; `flank`; `ranged`; `elite`; `boss`; `gate-defense`; `echo-recovery`; `growth`; `occupation`; `extraction`; `boss-kill`; `survival`; `complete`; `VICTORY`; `DEFEAT`; `FINAL_COMPLETION` | W-01…W-05 |
| G1-SCN-08 chokepaths | `cinder-center`; `veil-twins`; `throne-aisle`; `bastion-floodgate`; `sprawl-funnel`; `glass-crypt`; `canal-lock`; `causeway-gap`; `chancel-nave`; `zenith-threshold` | W-03 |
| G1-SCN-09 flanks | `cinder-south`; `veil-north`; `throne-south`; `bastion-channel`; `sprawl-crosswind`; `glass-reflection`; `canal-sluice`; `causeway-rubble`; `chancel-transept`; `zenith-umbra` | W-03 |
| G1-SCN-10 elevations | `cinder-overlook`; `veil-rampart`; `throne-dais`; `bastion-anchor`; `sprawl-ridge`; `glass-spire`; `canal-towpath`; `causeway-keystone`; `chancel-apse`; `zenith-crown` | W-03, W-04 |
| G1-SCN-11 hazards | `ash-surge`; `mirror-static`; `echo-rift`; `flood-pulse`; `howling-gust`; `glass-shardfall`; `canal-undertow`; `causeway-collapse`; `oath-pressure`; `deep-command` | W-01, W-03 |
| G1-SCN-12 occupations | `cinder-seal`; `veil-signal`; `throne-domain`; `bastion-pump`; `sprawl-beacon`; `glass-choir`; `canal-toll`; `causeway-brace`; `chancel-oath`; `zenith-last-seal` | W-02, W-03, W-04 |
| G1-SCN-13 extractions | `cinder-bind`; `veil-bind`; `throne-bind`; `bastion-bind`; `sprawl-bind`; `glass-bind`; `canal-bind`; `causeway-bind`; `chancel-bind`; `zenith-bind` | W-01, W-02 |
| G1-SCN-14 spawn/variation | `W`; `SW`; `NW`; deterministic `timingJitterTicks`, `densityDelta`, `laneJitter` | W-03 |

Stage-item and stage-reward route tables contain only IDs already traced in `qa/lore-audit.md`; every route resolves to a current known item/reward. No route creates a new visible string.

## Defect dispositions

| ID | finding | disposition |
|---|---|---|
| G1-SKL-01 | Raw `SKILLS` IDs were rendered at `app.js` active-skill and growth-choice surfaces, exposing undefined soul/grave/void/shadow/eclipse vocabulary and developer-form labels. | GameProgrammer fixed both consumers to `SKILLS[id]?.name ?? id`; SystemsDesigner must add the eight approved display-only names. No waiver. |
| OPS-COPY-01 | `privacy.html` previously claimed Cloudflare analytics and an `Accept` banner that did not exist. | **fixed** by ReleaseEngineer with truthful offline-local/no-upload copy; release closure 3/3 and Chromium source/static smoke reported. Not a lore violation. |

## QA handoff

Do not mark G1 clear until G1-SKL-01 is fixed and this receipt is refreshed against the resulting catalog snapshot. Even after content clears, Stage 1, G4, balance, extraction semantics, release, and public-beat video remain governed by their own evidence gates.
