# Abyssal Command — 확장 3단계 BMAD-GDS 제작 실행 계획

**문서 상태:** 실행 계획 / 증거-우선 계약. 이 문서는 런타임, 테스트, task manifest, gate 판정을 변경하지 않는다.  
**대상 독자:** game-production director, 각 전문 책임자, Game QA, release operator.  
**결정:** 아래 Stage 1→2→3 순서와 각 출구 증거가 갖춰지기 전에는 공개 배포, 자산 생성/가져오기, provider 통합, gate PASS를 진행하지 않는다.

## 0. 현재 판정과 불변 경계

| 항목 | 현재 상태 | 해석 |
|---|---|---|
| G1–G8 | **NOT MEASURED / NOT PASSED** | 모든 수치와 연구 권고는 `[TARGET]`이며 측정 사실이 아니다. gate ledger만이 gate 상태의 기준이다. |
| G2 canonical diagnostic | **evidence-package integrity: PASS; G2: NOT MEASURED / NOT PASSED** | Canonical `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` has 17 integrity-valid records: a manifest, 5 profiles × seeds 17/18/19 (15 runs), and a summary for a bounded 360-tick Cinder Span diagnostic. It resolves XR-13/XR-14 observation surface only; it does not supply approved full-G2 preregistration, paired full-route/matchup, TTK, combo, coverage, or threshold-decision evidence. |
| Stage 2 director disposition | **REDO** | G2 canonical measurement contract와 G8 human impression evidence가 남아 있다. 이 판정은 release 판정이 아니다. |
| 공개 배포 | **BLOCKED — do not deploy** | 동일 build tuple의 모든 필수 evidence와 독립 reviewer가 없다. |

**바인딩 경계**

- `defense-catalog.js`는 유일한 authored rules authority이고 simulation은 **60 Hz** fixed tick이다. `MapPlan`과 `WavePlan`은 tick 0 전에 admission되고 이후 immutable이다.
- 게임은 단일 사용자, offline/local, no-commerce다. account, cloud sync, remote telemetry, network/provider gameplay call, background combat, ad, paid skip, multiplayer는 허용하지 않는다.
- Stage 10은 terminal이다. Stage 11, 무한 캠페인, presentation이 만드는 next-stage action은 금지한다.
- Canvas/HUD/VFX/audio/narration/haptics/accessibility/telemetry/export는 **detached observers**다. observer의 지연·누락·mute·asset fail·renderer fail은 canonical hash, RNG/deck cursor, input cursor, plan, damage, cooldown, offer, reward, persistence, terminal outcome을 바꾸지 않는다.
- 아래의 `Target`은 향후 fixture와 사람 대상 연구로 반증/측정할 가설이다. 측정 전에는 수용 기준이나 release result로 읽지 않는다.

**권위 소스:** [expanded roster](team-roster-expanded.md), [QA gate ledger](../qa/gate-measurements.md), [Stage 2 gate addendum](gate-reviews/stage-2-deterministic-measurement.md), [G2 canonical diagnostic](../qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl), [historical G2 raw receipt](../qa/evidence/gates/G2-archetype-and-combat-sweep-receipt.txt), [historical raw export](../qa/evidence/gates/G2-archetype-and-combat-sweep.json).

## 1. 목표, 비목표, 계획된 공개 비트

### 1.1 목표

`Cinder Span Command Feedback`을 하나의 **목표 90초** 공개 가능 비트로 준비한다. 비트는 다음을 한 번의 동일한 deterministic run 안에서 연결한다.

1. W-03 Gate Integrity와 player vitality를 읽고 movement-only route를 선택한다.
2. automatic normal/skill/critical/cooldown 결과를 confirmed source event의 정적·시각·음향 observer projection으로 읽는다.
3. bounded PCG map/wave/boss plan에서 objective → pressure → relief → boss/result 흐름을 체험한다.
4. 최대 3개의 run-only offer를 비교·commit하고, active progress와 Archive Return Permit 결과를 receipt로 확인한다.
5. W-01…W-05의 사실 기반 stage/world link와 Stage 10 terminal rule을 유지한다.

### 1.2 비목표

- 새 campaign route, Stage 11, live adaptation, hidden scaling, manual aim/target selection/tactical queue, commerce/ads/notifications, provider-backed runtime 또는 active-run PCG generation.
- 연구 숫자를 current-balance, player comprehension, immersion, fairness, novelty, performance, legal clearance, asset availability, gate pass로 선언하는 일.
- 실제 media 생성, ElevenLabs 요청, provider credential 입력, Blender bake, ppgen production run, Vox video 생성 또는 release.

### 1.3 계획된 공개 비트 (release가 아닌 검증 대상)

| 순간 | 반드시 보이는 사실 | 허용 observer 표현 | 금지 |
|---|---|---|---|
| 0–20 s Ingress/Orientation | stage/objective, player/Gate instrument, first safe route | W-01/W-03/W-04 caption-first edge marker, static telegraph | 중앙 불투명 overlay, lore 추정, movement lock |
| 20–55 s Probe/Pressure | safe lane, confirmed normal/skill/crit, cooldown state | world-local geometry, `CRIT` static glyph, bounded P3 sound | aim input, VFX가 threat를 가림, audio-only meaning |
| 55–75 s relief/choice | relief reached, offer order/effect/role, progression condition | full-page semantic choice surface (최대 3 options) | timed autopick, hidden odds, dominant option 은폐 |
| 75–90 s Gate/result | boss/Gate/result fact, W-05 receipt, optional next action | caption/static result, local fallback/silence | presentation callback grant, claim urgency, Stage 11 implication |

이 비트는 **target** 90초 fixture이며 G7, G4, G1 또는 release 증거가 아니다. Stage 10인 경우 마지막 행은 `TERMINAL + FINAL_COMPLETION`의 W-05 recap으로 끝나며 next-stage cue/action을 만들지 않는다.

## 2. source event → observer 경계

### 2.1 한 방향 계약

```text
catalog + fixed 60 Hz simulation
  → resolved immutable event / snapshot / checkpoint
  → observer adapter (HUD | VFX | audio | narration | controls shell | telemetry)
  → local presentation, capture, optional explicit export
```

| Source event / committed state | 허용 observer 소비자 | 최소 immutable join | observer가 해서는 안 되는 일 |
|---|---|---|---|
| `combat.damage.resolved`, `gate.integrity.changed` | HUD, VFX, audio, telemetry | `eventId`, `simTick`, `sequence`, source/target, final damage, before/after health, world anchor | damage 재계산, crit reroll, health/cooldown write |
| `combat.ability.resolved`, cooldown SET/READY | HUD, VFX, audio, control feedback | ability ID, resolved area/position, cooldown ready tick, result state | target ID 공급, cast를 성공으로 바꿈, cooldown 소모 |
| `MapPlan` / `WavePlan` admitted | map renderer, narrative/objective UI, telemetry | `MapKey`/ReplayKey, version/digest, objective reference, selected card/anchor/fallback trace | tick 중 reroll/reseed, objective/reward/stage order 변경 |
| `BOSS_SPAWNED`, `TERMINAL` | VFX/audio/narrative/result UI | stage ID, boss/result, W anchor, committed state | spawn/ending 지연, gate unlock, Stage 11 cue |
| `choice.offered` / `choice.committed` | choice UI, receipt, telemetry | ordered option IDs, visible summaries, commit ID, before/after hash | offer reorder/reroll, grant, wall-clock selection |
| `idle.claim.committed` | Archive receipt, accessibility UI, telemetry | permit ID, rule/formula revision, accepted elapsed, output, save revision | reopen 재계산, double claim, combat/extraction/stage result 부여 |

**처리 규칙:** 모든 observer decision은 `(simTick, subjectId/entityId, type/kind, ordinal)` 또는 immutable `eventId`로 join한다. observer가 실패하면 `static fallback`, local suppression, 또는 silence만 선택한다. canonical simulation에 command channel, retry channel, RNG read/advance, persistence mutation은 없다.

## 3. 책임·hand-off

| Hand-off | R → A → 소비자 | 동결 payload | 수령 전제 / 실패 시 |
|---|---|---|---|
| Rules/observer envelope | Game programmer → Game QA → presentation leads | versioned resolved event, canonical checkpoint, no command channel | schema/anchor 누락이면 static placeholder도 rules source처럼 가장하지 말고 package를 BLOCKED |
| Catalog plan admission | Game designer + Level/PCG → programmer + QA | `StageSpec`, `ReplayKey`, `MapPlan`, `WavePlan`, `BossPlan`, validation/fallback trace | tick 0 전 digestable plan이 없으면 run 시작 금지 |
| Balance/reward change | Systems/progression → Game designer + PM → programmer + QA | equal-budget ledger, hypothesis, paired seed fixture, signed request | signed request 또는 exact evidence 없음: player-facing retune 금지 |
| Presentation allowlist | Narrative + Combat feedback → VFX/audio/UI/UX → Accessibility QA | W trace, event map, semantic static fallback, rank/priority, mode behavior, asset ID | untraced/asset-dependent state는 reject |
| Asset import | Technical art + Audio → Performance/release → QA | approval, provenance/rights, SHA-256, decoded measurement, fallback, provider scan | 하나라도 누락: quarantine 또는 old map/fallback 유지 |
| Study/telemetry | Playtest research + Accessibility QA → Game QA → director | preregistration, local consent, fixture/capture ID, raw-to-derived trace, exclusions | raw evidence 없는 conclusion은 NOT MEASURED |
| Release/rollback | Performance/release + QA → PM + director | pinned build tuple, device trace, no-network/export-delete proof, rollback receipt | tuple mismatch/any missing path: BLOCKED |

세부 RACI는 [expanded roster](team-roster-expanded.md#concise-raci--hand-off-matrix)가 기준이다. Game QA만 ledger를 업데이트하고 production director만 independent evidence 후 FIX/PASS/REDO disposition을 기록한다.

## 4. 수치 목표 레지스터 — 전부 UNVERIFIED TARGET

| 영역 | Target | 향후 측정 / 증거 |
|---|---:|---|
| Gate G2 | 100% mechanics coverage; win rate 45–55%; TTK ±15%; combo ≤1.3× median EV | `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` |
| Gate G3 | ≥5 profiles, ≥3 independently viable, no profile >50% optimal-play dominance | `qa/evidence/gates/G3-archetype-rotation-and-playtest.jsonl` |
| Gate G4 | median immersion ≥4.0/5; feedback ≤100 ms; unresolved S1/S2 = 0 | `qa/evidence/gates/G4-presentation-readability-and-playtest.json` |
| Gate G5 | paid/free delta ≤5pp (no-commerce에서는 paid path absent를 별도 확인); 10–20 session parity; idle ≤20%, active ≥80% | `qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl` |
| Gate G6 | p95 frame ≤16.7 ms; >33.4 ms frames <0.5%; 30-min memory stable; input ≤100 ms | `qa/evidence/gates/G6-ops-perf-and-local-telemetry.json` |
| Gate G7 | 30–180 s, ≥3 actions, ≥1 reward event, voluntary repeat ≥70% | `qa/evidence/gates/G7-loop-trace-and-repeat-study.jsonl` |
| Gate G8 | ≥1 element in ≤2 of ≥5 comparables; QA impression ≥4/5 | `qa/evidence/gates/G8-novelty-comparison-and-impression.json` |
| PCG | 64 complete keys × 3 fresh runs; stage corpus 100/key-stage; collision ≤2%; module share ≤40% when palette ≥3 | expanded A02/A03 exports |
| Encounter | telegraph ≥120 ticks; boss ≥180 ticks; landmark relief 900–1500 ticks; ordinary/elite/boss TTK 0.35–1.25 / 6–14 / 35–90 s | schedule lint + paired sweep |
| Feedback | health response ≤2 rendered frames; normal 9–14 ticks ≤4 subparticles; skill 24–42 ticks ≤12; crit 12–18 ticks ≤6; flash ≤3/s | feedback truth + mask safety capture |
| Controls | pause/settings ≥48dp; ability ≥52dp; movement input→admission p95 ≤2 ticks; visible confirmation p95 ≤100 ms | input parity / geometry / input-chain trace |
| Rewards/idle | XP ≤3 options; unlock ≤3 eligible completions; 0 hidden chance for permanent tactics; 12h cap; one permit/one settlement | reward ledger, account parity, idle transaction export |
| Resource | rank-4 ≤6 emitters + ≤2 labels/500ms/160dp; coverage ≤18% viewport/≤8% protected zone; static media ≤13MiB compressed | VFX density, manifest, target-device trace |

## 5. Stage 1 — concept / presentation / core loop

### 목표

설계된 90초 Cinder Span 비트가 deterministic source fact만을 관찰하고, objective/world/feedback/control/receipt의 정적 의미를 먼저 보존하도록 **계약·fixture·semantic projection**을 동결한다.

### 순서화된 work package

| ID | 작업과 소유자 | 의존성 / 비중복 규칙 | 산출물·출구 증거 |
|---|---|---|---|
| S1-01 | **Rules/fixture envelope** — programmer + QA | canonical catalog, 60 Hz, schema version; presentation은 read-only | complete build tuple, fixed input tape, `eventId`/tick/sequence join, 30/60/120Hz observer differential design |
| S1-02 | **Finite StageMap/World handoff** — Level/PCG + narrative | catalog-owned `StageMapSpec`; one primary objective; W-01…W-05 allowlist | `Ingress→Orientation→Approach→ObjectiveAnchor→Gate→Resolution`; MapKey/MapPlan contract; W trace schema; Stage 10 terminal negative fixture |
| S1-03 | **Wave/boss seed grammar** — Encounter + designer | admitted plan before tick 0; safe lane/card fallback authored | six-phase card chain, role rules, boss/mini-boss/big-wave telegraphs, relief and fallback spec |
| S1-04 | **Health/crit/cooldown feedback contract** — Combat feedback + VFX/UI | resolved damage/cooldown event fields and world snapshot anchor | Tier T0–T4 recipe, static equivalence, health/Gate separation, crit/cooldown/source join fixture |
| S1-05 | **One-thumb control/accessibility contract** — UI/UX + accessibility QA | normalized `move(x,y)`, `ability(slot)`, overlay actions only | handedness, dead zone 6/12/18%, touch/keyboard/controller parity, focus/overlay/cancel/rotation script |
| S1-06 | **Caption-first narrative/audio map** — narrative + audio | committed `STAGE_STARTED`, `BOSS_SPAWNED`, `TERMINAL`; no new canon | W traceable cue IDs, Korean caption slot, mute/silence behavior, Stage 10 final-only template |
| S1-07 | **Reward and idle receipt schema** — Systems/progression + PM + QA | future rules record; no UI-owned grant | active-vs-Archive partition, offer/receipt fields, finite condition display, Return Permit property fixture specification |
| S1-08 | **Stage-1 asset brief, not asset production** — VFX/audio/performance | asset approval gates in §8 | approved-needed brief + static fallback map only; no candidate bytes, no provider request, no runtime import |

### Stage 1 exit evidence

Stage 1 exits to Stage 2 only when the following artifacts exist for one pinned fixture tuple and are reviewed by Game QA. They remain evidence inputs, not a gate PASS.

- A01 observer differential: source event/hash/RNG/input/plan/offer/persistent totals identical across 30/60/120Hz, reduced-motion, mute, missing observer, and export state.
- A02: 64 complete `MapKey`s × three fresh serial/permuted compilation with expected canonical bytes/digests and negative hard-predicate rejection.
- A04: map/wave schedule lint with safe lane, telegraph, relief, and recorded fallback validation.
- A07: health/crit/cooldown arithmetic and semantic snapshot join including C-1/C/C+1.
- A13/A14: normalized input parity, safe geometry, focus return, neutral-on-cancel proof.
- W-01…W-05 payload inventory with zero unallowlisted fact and zero Stage-10 continuation.
- 90-second trace design (not a player outcome) containing ≥3 actions and ≥1 reward event.

**Exit blockers:** source-event missingness, plan after tick 0, observer write, any network/provider surface, missing static semantic fallback, undefined deterministic extraction condition, asset dependency, or a missing tuple field invalidates the evidence.

## 6. Stage 2 — balance / rewards / growth / encounters

### 목표

Stage 1 contracts 위에서만 equal-budget balance, growth/idle fairness, probabilistic-reward exclusion, PCG/wave variety, boss/miniboss/big-wave pacing, G2/G3/G5/G7/G8 measurement을 수행한다. 새 player-facing rule은 evidence-backed signed change control 없이는 금지한다.

### 순서화된 work package

| ID | 작업과 소유자 | 의존성 / guardrail | 산출물·출구 증거 |
|---|---|---|---|
| S2-01 | **Canonical G2 measurement completion** — programmer → QA | QA-only `g2-measurement-fixture-budget-v1`; no player-facing retune | full canonical JSONL: Bulwark/Striker/Gambit/Conductor/Rift, paired maps/waves/policies, health/crit/cooldown/TTK/EV/cooldown-EV share |
| S2-02 | **Distributional combat/boss balance** — systems + encounter + QA | integer rules, no mean-only conclusion, no hidden dynamic difficulty | ordinary/elite/Stage-10 p5/p50/p95, crit drought, combo EV, survival window, minimal exploit tape |
| S2-03 | **PCG and wave variety corpus** — Level/PCG + encounter + QA | StagePlan immutable; lexical candidates, named RNG domains, no reseed | 100-key/stage validity/diversity report; schedule n-gram/role/landmark/relief/safe-lane audit |
| S2-04 | **Boss/miniboss/big-wave grammar** — encounter + combat feedback | announced route choice; no all-lane closure; boss no overlap with miniboss | card validator, 120/180-tick telegraph captures, 900–1500 tick landmark relief audit |
| S2-05 | **Guaranteed reward ledger** — systems/progression + PM + QA | permanent tactic = deterministic condition/finite meter; XP run-bound | probability/table audit, exact option/effect hashes, current/target receipt, no hidden chance/duplicate/near miss |
| S2-06 | **Archive Return Permit** — systems/progression + programmer + QA | one active-issued unsettled permit; local atomic fixed-point settlement | 0/short/12h/cap+/24h/clock rollback/storage failure/reopen×100 property export, no run/combat/stage/boss/extraction/companion grant |
| S2-07 | **10/20 session parity and sidegrade model** — PM + systems + playtest research | active ≥80%, return credit ≤20%, no raw-stat supremacy | paired Stage 1–10/boss corpus and finite unlock ≤3 eligible completions report |
| S2-08 | **Novelty and voluntary-loop research** — narrative + PCG + playtest research + QA | deterministic traces cannot substitute for human answer | five-title comparison ledger, fixed-seed first exposure, preregistered repeat/impression sessions |

### G2 raw export의 정확한 후속 처리

현재 raw export는 fixture/instrumentation integrity를 보이는 **PASS**일 뿐, G2 pass가 아니다. 다음 순서를 강제한다.

1. raw receipt의 15 records, catalogue/input-tape digests 및 checksum은 archive한다. receipt-to-export 84.323s offset은 start-versus-export timing discrepancy로 기록하며 tuple/checksum contradiction으로 처리하지 않는다.
2. canonical contract의 `.jsonl`을 생성한다. 현재 360 ticks/no-movement single slice를 complete route, ordinary/elite/Stage-10 contexts, declared movement policies, full cooldown/active-skill EV data로 확장한다.
3. 5 profiles의 equal authored budget, same catalog digest, same starting band, paired seed/card/deck positions을 고정한다. 동일 seed 결과가 아닌 pooled mean만으로 viability/dominance를 판단하지 않는다.
4. Game QA가 raw-to-derived result와 failure rows를 독립 review한다. 조건 미달은 signed hypothesis/retune proposal로 돌아가며, 수정을 수치 목표에 맞추기 위해 evidence를 좁히지 않는다.

### Stage 2 exit evidence

- G2 full artifact, G3 rotation + moderated records, G5 reward/idle/parity evidence, G7 full 90-second loop/re-entry study, G8 five-comparable + impression record.
- reward table/property validation: permanent mechanics 100% deterministic/fixed finite meter; optional future non-mechanical surprise만 full odds, table revision, duplicate exhaustion, deterministic reveal record를 pre-commit에 제공.
- PCG/wave corpus: invalid plan/reseed/unsafe route/unlogged fallback/Stage 11 = fail.
- all modes observer differential equal. Any XR-01–XR-12 reproduced P0/P1 risk or new minimal reproduction blocks mapped measurement.

**Stage 2 실패/rollback 선택:** failed balance target은 live adaptation이나 secret health/damage scaling으로 덮지 않는다. signed change control이 없으면 catalog unchanged; incorrect candidate artifact은 evidence-only로 retain하고 retune은 designer/PM sign-off 후 deterministic fixture를 같은 shape로 재실행한다. idle/reward persistence fault는 settlement surface를 disable하거나 known-good receipt path로 되돌리고, 캠페인 데이터 삭제나 re-roll은 금지한다.

## 7. Stage 3 — combat feedback / resources / performance / QA / release

### 목표

확정된 Stage 1/2 fact를 observer-only feedback, approved static resource, accessible controls, local diagnostics, target-device performance, rollback 및 release evidence로 검증한다. Stage 3은 release 권한 자체가 아니라 release decision 입력을 만든다.

### 순서화된 work package

| ID | 작업과 소유자 | 의존성 / guardrail | 산출물·출구 증거 |
|---|---|---|---|
| S3-01 | **VFX/HUD implementation validation** — VFX + combat feedback + accessibility QA | source event join; T0/T1 semantic priority never culled | rank masks, flash/contrast, density, standard/reduced/static capture set |
| S3-02 | **Audio/narration observer validation** — Audio + narrative + QA | local reviewed file or procedural/silence fallback; caption primary | sound on/mute/mono/decode fail/missing asset/delayed playback differentials, zero provider scan |
| S3-03 | **Controls/accessibility validation** — UI/UX + accessibility QA | same normalized stream; no manual aim | touch/keyboard/controller/switch parity, focus/safe-area/a11y audit, input chain |
| S3-04 | **Local telemetry/privacy validation** — programmer + QA + privacy reviewer | bounded ring, explicit export/delete, zero transport/identity fields | local export/delete/network-disabled trace, schema/missingness/redaction validation |
| S3-05 | **Target-device performance** — performance/release + QA | Pixel 6a/Chrome, iPhone 13/Safari, low viewport; no desktop proxy | warm-up, dense 90s, paired presentation, 30-min soak, memory/backlog/CPU/GPU artifact |
| S3-06 | **Asset manifest/resource audit** — technical art + audio + release | approved static hashes only, fallback per asset | provenance/rights/hash/media measurement/compiled provider scan; resource budget report |
| S3-07 | **Final canon + human readability** — narrative + playtest + QA | deterministic evidence complete before subjective study | W trace audit, normal/reduced/mute caption sessions, S1/S2 defect triage |
| S3-08 | **Rollback rehearsal + release decision** — release + QA → PM/director | exact pinned tuple, independent reviewer | rollback recovery report, release tuple audit, GO/BLOCKED decision record |

### Stage 3 exit / release decision evidence

Release approval에는 아래 모두가 같은 build tuple로 존재하고 independent reviewer가 확인해야 한다.

1. G1 final canon/W-01…W-05/Stage 10 audit.
2. G4 readability/immersion/latency study 및 no unresolved S1/S2.
3. G6 target device p95/long-frame/30-min soak/input/local telemetry/no-network/export-delete/rollback evidence.
4. G2/G3/G5/G7/G8 evidence의 regression protection; Stage 3 presentation/resource work가 canonical replay를 바꾸지 않음.
5. compiled output의 provider/secret/remote audio/network surface = 0; resource provenance/rights/fallback/hash measurement complete.
6. static artifact, rules/catalog/grammar/serializer/asset manifest/device/fixture/human reviewer가 모두 포함된 pinned release tuple.

하나라도 누락/tuple mismatch/failed recovery면 상태는 **BLOCKED**, 배포 금지다. CI 또는 Pages workflow의 성공만으로 game gate/release를 통과시키지 않는다.

## 8. 자산·도구 승인 및 생산 gate

### 8.1 현재 readiness — 생성·import가 여전히 차단됨

| 도구/경로 | 관찰된 사실 | 현재 결정 |
|---|---|---|
| `gti` / god-tibo-imagen | `gti --dry-run` 성공. 이미지 생성/가져오기는 없었다. | concept configuration check만 가능. **No asset exists.** non-dry-run은 G-PRE/G-RIGHTS/G-SPEND 후에만 가능. |
| `ppgen` / PerfectPixel | 설치됨. observed provider allowlist는 `gemini`, `openrouter`, `fal`, `byteplus`이며 documented `god-tibo-imagen` provider를 지원하지 않는다. | **BLOCKED.** compatible provider, terms/rights/cost, brief가 승인되기 전 sprite request 금지. gti fallback을 추정하지 않는다. |
| Blender | scene object-summary inspection이 30 seconds에 timeout. scene을 읽거나 bake한 사실이 없다. | **BLOCKED.** source hash와 actual scene inspection 후에만 source/bake approval. runtime particle authority 금지. |
| ElevenLabs | account/credential/request/generated media/license clearance/browser validation 없음. | **BLOCKED.** user-provided scoped credential와 per-asset rights/terms/consent approval이 있어야 private build candidate만 가능. runtime integration은 영구 금지. |
| Vox Director | marketing/release-only. approved beat map/style board/narration/music-rights/spend ceiling 없음. | **BLOCKED.** future approved beat map 뒤에만 trailer generation; in-game video/asset/runtime dependency 불가. |

### 8.2 strict approval sequence

`G-BRIEF → G-PRE → G-RIGHTS → G-SPEND → G-CANDIDATE → G-IMPORT → G-OFFLINE-VERIFY`

| Gate | 최소 입력 | 통과 조건 | 실패 시 |
|---|---|---|---|
| G-BRIEF | cue/asset ID, stage, source event, static fallback, scope | narrative/VFX/audio/UX owner가 semantic meaning과 fallback을 승인 | production 요청 금지 |
| G-PRE | original prompt/script/reference declaration, technical target | style/IP/canon/non-authority review | quarantine 또는 rewrite |
| G-RIGHTS | terms URL/date, input/voice consent, territory/use, attribution decision | named rights reviewer 승인 | asset/provenance import 금지 |
| G-SPEND | provider, cost ceiling, operator, credential boundary | human spend authority | provider call 금지 |
| G-CANDIDATE | private quarantine bytes, source/output hashes, semantic/Korean intelligibility/style review | candidate accepted; secret/raw provider response는 public manifest에 없음 | purge/quarantine; old mapping 유지 |
| G-IMPORT | content-addressed same-origin final file, decoded measures, captions/transcript, fallback | immutable manifest + checksum validation | no precache / no runtime mapping |
| G-OFFLINE-VERIFY | compiled scan, missing/decode/mute/mono/reduced-motion observer differential | no provider host/SDK/key/URL; same rule hash; caption/static fallback works | release evidence block / asset-only rollback |

Vox의 G-BRIEF는 **release owner가 사전 승인한 future beat map**을 명시해야 한다. gti, ppgen, Blender, ElevenLabs, Vox 어느 것도 gameplay rule, asset availability, release readiness, 또는 gate PASS를 증명하지 않는다.

## 9. validation matrix

| 영역 | 자동/결정론 검증 | 사람/수동 검증 | 결과 artifact | blocker |
|---|---|---|---|---|
| Determinism | fixed seeds at 30/60/120Hz; observer/audio/motion/export A/B | 해당 없음 | `qa/evidence/determinism/expanded-observer-differentials.jsonl` | canonical mismatch / observer write |
| PCG/world | 64×3 replay, serial/permuted, negative predicates, 100 keys/stage | objective orientation | `qa/evidence/pcg/{expanded-map-plan-replay,stage-variety-envelope}.json[l]` | reroll, invalid route, extra objective, Stage 11 |
| Waves/bosses | role/card/depleted deck/fallback/cooldown adjacency sweep | route readability | `qa/evidence/waves/expanded-combination-lint.json` | no relief/safe lane/telegraph |
| Balance | five profiles, ordinary/elite/Stage 10, forced crit and C-1/C/C+1 | distinct strategy/fairness probe | G2/G3 JSONL | mean-only conclusion, EV/TTK band breach |
| Feedback | health conservation, source-to-presentation join, rank/flash/contrast | normal/crit, danger, health/cooldown discrimination | combat/presentation artifacts + G4 | essential semantic absence |
| Rewards | all tables/predicates enumerated, exact rational odds if optional cosmetic, stale/double commit | effect/receipt comprehension | reward audit, parity export | hidden chance, duplicate, false grant |
| Idle | property cases including clocks/storage/reopen×100 | receipt clarity/pressure probe | return transaction JSONL | duplicate/lost/run-state grant |
| Controls | touch/key/controller/switch normalized tape, focus/rotation/cancel | essential-action operability | input parity + accessibility audit | stale movement, aim input, focus trap |
| Audio/assets | sound/mute/mono/decode/missing/delayed, static scan | caption/narration comprehension | offline fallback + provider scan | provider request/secret/no fallback |
| Performance/ops | named target device 90s + 30min, memory/frame/backlog, network disabled/export/delete | rollback review | G6 packet + recovery report | missing device tuple, budget breach, network |
| Narrative/release | W payload allowlist / terminal negative tests | final copy/caption review | G1 audit / release tuple | untraced canon / Stage 11 / tuple mismatch |

## 10. failure, rollback, escalation

| 실패 class | 즉시 선택 | rollback | 재진입 조건 |
|---|---|---|---|
| canonical/replay/plan/persistence defect | stop promotion; P0/S1 defect; preserve first divergent tick/tape | matching prior app + rules/catalog/grammar/serializer tuple | identical replay and affected property corpus |
| VFX/audio/narration/resource defect | disable only optional map; retain text/static semantic path | approved prior manifest or procedural/silent fallback | observer differential, caption and provider scan pass |
| PCG/wave safe-lane/relief failure | reject plan/card; no fallback reseed | matching prior grammar/catalog plus corpus | recorded stable fallback or fixed authored content |
| balance/reward/idle target miss | retain raw result; do not hot-tune | no change unless designer/PM signed correction | same fixture re-run and independent QA review |
| privacy/network/provider exposure | block artifact; isolate/revoke private credential outside client if needed | last clean static build; disable export only if rules unaffected | compiled scan and network-disabled evidence |
| performance target breach | preserve trace/backlog; reduce rank-4/optional assets first | prior renderer/config/asset tuple or static semantic fallback | named-device remeasure; no tick drop/semantic removal |
| asset rights/provenance missing | quarantine/reject candidate | old hashed asset/fallback | complete G-RIGHTS/G-IMPORT records |

Rollback never deletes local saves, regenerates with a new seed, mutates campaign to match a visual result, invokes a provider at runtime, or uploads diagnostics. Recovery is not a gate pass; it remains NOT-RUN/BLOCKED until required evidence is captured and independently reviewed.

## 11. Gate status and stage exit ledger

| Gate | Current | Planned primary stage | Required future evidence |
|---|---|---|---|
| G1 canon/world | **NOT MEASURED / NOT PASSED** | S1 contract → S3 final | final W inventory, payload allowlist, Stage 10 terminal audit |
| G2 rules/balance | **NOT MEASURED / NOT PASSED** | S2 | canonical equal-budget full sweep; raw integrity package does not suffice |
| G3 diversity | **NOT MEASURED / NOT PASSED** | S2 | five-profile rotation plus moderated records |
| G4 feedback/immersion | **NOT MEASURED / NOT PASSED** | S3 | captures/differentials + counterbalanced readability/immersion study |
| G5 fairness/no-commerce | **NOT MEASURED / NOT PASSED** | S2 | no-paid-path verification, reward/idle property + 10/20 parity |
| G6 ops/performance/telemetry | **NOT MEASURED / NOT PASSED** | S3 | named device trace, rollback, local export/delete, zero network/provider scan |
| G7 core loop | **NOT MEASURED / NOT PASSED** | S1 trace design → S2 study | 30–180 s, ≥3 actions, ≥1 reward, voluntary repeat study |
| G8 novelty | **NOT MEASURED / NOT PASSED** | S2 | five-comparable ledger and human fixed-seed impression ≥4/5 |

## 12. Source ledger — integration inputs

이 계획은 아래 artifact를 참조한다. 링크된 research의 값은 target이고, QA/ops artifact의 실행되지 않은 path는 future evidence다.

### Research / design inputs

- Feedback·VFX·controls: [vfx-and-particle-direction](../research/vfx-and-particle-direction.md), [combat-feedback-survey](../research/combat-feedback-survey.md), [combat-feedback-controls](../research/combat-feedback-controls.md), [vfx-hud-feedback](../research/vfx-hud-feedback.md), [ui-ux-persona-and-controls](../research/ui-ux-persona-and-controls.md), [controls-accessibility](../research/controls-accessibility.md).
- Balance·growth·rewards: [combat-systems-balance](../research/combat-systems-balance.md), [level-balance-growth-model](../research/level-balance-growth-model.md), [progression-rewards-idle](../research/progression-rewards-idle.md), [progression-idle-economy](../research/progression-idle-economy.md), [progression-idle-economy-survey](../research/progression-idle-economy-survey.md), [reward-presentation-and-retention](../research/reward-presentation-and-retention.md).
- PCG·world·encounter: [pcg-map-and-wave-survey](../research/pcg-map-and-wave-survey.md), [pcg-map-grammar](../research/pcg-map-grammar.md), [wave-encounter-composition](../research/wave-encounter-composition.md), [encounter-boss-variety-survey](../research/encounter-boss-variety-survey.md), [stage-world-procedural](../research/stage-world-procedural.md), [narrative-stage-presentation](../research/narrative-stage-presentation.md), [narrative-stage-presentation-survey](../research/narrative-stage-presentation-survey.md).
- Audio·asset·performance·measurement: [audio-narration-direction](../research/audio-narration-direction.md), [elevenlabs-integration](../research/elevenlabs-integration.md), [elevenlabs-audio-feasibility](../research/elevenlabs-audio-feasibility.md), [asset-production-pipeline](../research/asset-production-pipeline.md), [performance-and-rendering-budget](../research/performance-and-rendering-budget.md), [qa-measurement-protocol](../research/qa-measurement-protocol.md), [telemetry-playtest-contract](../research/telemetry-playtest-contract.md).

### QA / operations inputs

- QA execution and evidence shape: [expanded stage test plan](../qa/expanded-stage-test-plan.md), [test plan](../qa/test-plan.md), [regression matrix](../qa/regression-matrix.md), [benchmark notes](../qa/benchmark-notes.md), [discovery notes](../qa/discovery-notes.md), [exploit register](../qa/exploit-register.md), [defect register](../qa/defect-register.md), [playtest report](../qa/playtest-report.md), [Stage 2 reverification](../qa/stage-2-reverification.md), [gate measurements](../qa/gate-measurements.md).
- Operations and release: [local telemetry contract](../ops/telemetry-contract.md), [release readiness](../ops/release-readiness.md), [rollback runbook](../ops/rollback-runbook.md), [release and deployment plan](../ops/release-and-deployment-plan.md).
- Production controls: [expanded roster](team-roster-expanded.md), [task manifest](task-manifest.md), [Stage 1 draft review](gate-reviews/stage-1-draft.md), [Stage 2 deterministic measurement addendum](gate-reviews/stage-2-deterministic-measurement.md).

## 13. Explicit blocked state

이 계획은 다음 이유로 실제 asset/video generation, provider integration, release를 **허가하지 않는다**.

1. asset readiness가 없거나 미검증이다: gti dry-run 외 생성된 asset 없음, ppgen provider mismatch, Blender inspection timeout, ElevenLabs credential/rights/terms/candidate/validation 없음, Vox approved beat map 없음.
2. provider는 build-time private candidate source일 수 있을 뿐 runtime dependency가 될 수 없고, compiled static bundle은 zero provider/secret/remote URL surface를 증명해야 한다.
3. G1–G8 전체가 NOT MEASURED/NOT PASSED다. G2 raw export의 evidence-package integrity PASS는 G2 PASS가 아니다.
4. release에는 pinned build tuple, target-device evidence, rollback rehearsal, asset provenance, no-network/local-export proof, independent review가 없다.

따라서 현재 허용되는 다음 동작은 **Stage 1의 evidence-ready 계약/fixture admission 준비**와 **Stage 2의 canonical measurement completion**뿐이다. 이 문서 자체는 implementation 또는 release claim이 아니다.
