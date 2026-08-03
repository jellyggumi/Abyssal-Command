# Solution Landscape: Abyssal Surge / abbysal-oneline

## Solution List
| Name | Approach | Strengths | Weaknesses | Notes |
|------|----------|-----------|------------|-------|
| Authored stage graph | start→upgrade/recovery→hurdle→optional→exit node를 static profile로 commit | Stage 1–3 route와 hurdle 위치를 통제 | authoring/validation cost | runtime 생성물이 아닌 macro progression authority |
| Offline template/BSP proposal | graph node를 legal room/corridor template 또는 BSP leaf에 embed 후 curator가 profile로 전사 | non-overlap, camera/collision boundary, seed trace | 단독으로 pacing을 만들지 못함 | runtime geometry backend가 아님 |
| Offline CA local topology | cave/rubble/obstacle mask proposal만 생성 | 유기적 dressing 변주 | connectivity/room count 통제가 약함 | validated static profile의 cosmetic lane만 사용 |
| Offline WFC/model synthesis | tile adjacency·dressing motif constraint propagation으로 proposal 생성 | 2D tile/이미지 coherence | contradiction과 global route 실패 가능 | hard pin + bounded retry + human curation |
| Encounter director | vetted profile의 scheduled window에서 legal variant/reinforcement/recovery 선택 | peak와 lull을 만듦 | authored hurdle을 지우면 tuning 불명확 | runtime layout/stats rewrite 없이 bounded overlay |
| DDA | player condition에 따라 미래 content를 조정 | 넓은 skill band 보정 가능 | fairness/reproducibility 위험 | Stage 1–3 baseline 검증 후에만 고려 |
| 2D image-first renderer | orthographic camera + sprite atlas/card + explicit render bands | 3D asset production 감소, fixed-view readability | transparency/order와 visual/gameplay 혼동 위험 | read-only observer invariant |
| Existing asset promotion lane | `gti` concept/texture plates와 `ppgen` sprite bundle을 concept→candidate→receipt→runtime promotion으로 분리 | 기존 권리·provenance·runtime eligibility 경계를 재사용 | 새 2D 자산도 manifest/allowlist와 post-composite readability 검증이 필요 | sprite source는 simulation authority가 아니며 candidate는 기본 `runtimeEligible: false` (`CLAUDE.md#68-89`, `engineering/asset-pipeline/asset-lanes.json#35-50`) |

PCG Book은 constructive dungeon/level generation, grammar, experience-driven generation, generator evaluation을 다룬다. `direct page retrieval`: https://www.pcgbook.com/ ; chapter 3: https://www.pcgbook.com/chapter03.pdf. WFC는 lowest-entropy observation/constraint propagation을 쓰며 contradiction이 날 수 있음을 명시한다. `direct page retrieval`: https://github.com/mxgmn/WaveFunctionCollapse

## Categories
- **Macro progression:** graph/grammar는 offline curation 후 static `stage-world-catalog` profile이 되어 Stage boundary, critical path, recovery/hurdle slot을 소유한다.
- **Offline spatial proposal:** template/BSP/CA/WFC는 `layoutSeed`로 proposal만 만들고, validator와 curator가 static profile로 승인·commit한다. runtime은 이를 실행하지 않는다.
- **Runtime pacing:** director는 vetted profile의 schedule 내부에서 legal composition/reinforcement/recovery variant만 선택한다. layout, loot table, base stat, authored hurdle timestamp를 rewrite하지 않는다.
- **Visual presentation:** orthographic sprite/card layer는 simulation entity의 world foot anchor와 render tag를 소비할 뿐 collision·spawn·damage에 write-back하지 않는다.

### Image-first 2.5D Contract

- world foot anchor는 simulation `position.x/z`이다. `footAnchorDepth`는 camera view-space의 anchor `z`를 `1/1024` world-unit grid로 round한 값이며, actor/shadow/pickup/telegraph/foreground의 screen depth는 이것과 authored render-band key에서 결정된다. sprite pixels, alpha, animation frame은 authority가 아니다.
- deterministic sort key는 `(renderBand, footAnchorDepth, entityStableId)`다. band 순서는 `ground` → `shadow` → `actor/pickup` → `telegraph` → `VFX` → `foreground` → `HUD`다; entityStableId는 동일 quantized depth의 tie-breaker다.
- ground/opaque silhouette은 opaque 또는 cutout(alpha-test)로 유지한다. soft VFX와 transparent card는 sorted blended lane이며, gameplay-critical telegraph는 foreground 뒤나 untestable blended surface에 둘 수 없다. actor/VFX/foreground 합성 뒤에도 camera-visible active telegraph와 egress marker의 visible pixel/mask coverage는 fixture record가 선언한 threshold 이상이어야 한다.
- deterministic visual fixture는 overlapping actor, active telegraph, pickup, foreground와 equal/near-equal foot depth를 same seed/camera에서 렌더한다. fixture record는 camera, profile-content hash, seed, expected ID/mask, coverage threshold를 갖고 composited visible coverage·telegraph union/egress·foot anchor가 runtime snapshot과 일치하는지 검증한다.

## What People Actually Use
- Valve의 Left 4 Dead 발표는 damage/incapacitation/nearby kills 등의 intensity를 pressure population의 Build Up→Sustain Peak→Peak Fade→Relax에 연결하고 boss cadence를 분리한다. exact timing을 이 게임에 복사할 근거는 아니지만, pressure를 HP 하나가 아닌 population·lull로 제어하는 선례다. `direct page retrieval`: https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf
- Valve playtest methodology는 death, level time, friendly fire를 기록하고 baselines/trends/experiments를 쓰되 aggregate average가 extreme과 causal context를 가린다고 경고한다. `direct page retrieval`: https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ValvesApproachToPlaytesting.pdf
- Unity Analytics와 GameAnalytics는 progression outcome과 custom event를 제공한다. extra custom key-value는 raw export에서만 볼 수 있으므로 dashboard event와 raw diagnostic schema를 분리해야 한다. `direct page retrieval`: https://docs.unity.com/en-us/analytics/events/record-event ; https://docs.gameanalytics.com/event-tracking-and-integrations/sdks-and-collection-api/game-engine-sdks/unity/event-tracking/
- Three.js Sprite는 camera-facing plane이며 shadow를 cast하지 않는다. OrthographicCamera는 distance와 무관하게 object size를 유지한다. `direct page retrieval`: https://threejs.org/docs/pages/Sprite.html ; https://threejs.org/docs/pages/OrthographicCamera.html

## Frequency Ranking
*이 순위는 시장 점유율이 아니라 본 조사에서 독립 source가 반복한 architecture pattern의 빈도다.*
1. Abstract gameplay topology를 geometry보다 먼저 고정 — PCG Book/grammar/Dormans record.
2. Constraint와 별도 validation/repair — CA repair, WFC contradiction, connectivity constraint.
3. Seeded constructive **offline proposal plus committed profile** — PCG Book/WFC. seed만으로 replay가 끝나지 않으며 `profileId`, profile-content hash, PRNG stream·fixed tick·input도 기록해야 한다.
4. Pressure peak와 recovery valley를 분리하는 pacing controller — Valve Director/DDA literature.
5. Single stat multiplier — [OBSERVED] 이 저장소의 난이도 계약은 HP 단독 배율보다 clear budget·response type·class rotation·density/concurrency를 분리한다 (`wiki/concepts/stage-difficulty-and-system-variation.md#43-72`). 외부 practice의 일반화는 [INFERENCE]이며 단독 해결책이 아니다.

## Key Gaps
- 외부 source는 이 게임의 Stage별 계획 band 300–480초, hard ceiling 540초, 세 Stage 기준 1080초 campaign curve, enemy speed ratio, TTK/TTD, spawn density의 보편 상수를 제공하지 않는다. 시간 수치는 `design/master-numeric-contract.md#17-19`의 `[TARGET]`이고, 나머지는 telemetry calibration 대상이다.
- [OBSERVED] 현 레포는 wave HP/response를 계약화했지만 wave pressure/readability의 simultaneous telegraph coverage는 직접 측정하지 않는다 (`wiki/concepts/stage-difficulty-and-system-variation.md#43-72,185-189`). local density와 simultaneous telegraph coverage/egress가 필요하다.
- WFC/CA는 global exit path, encounter sightline, camera readability를 보장하지 않는다. offline graph/template validation과 human curation이 선행해야 한다.
- [OBSERVED] 새 runtime resource의 Pages 승격은 네 allowlist 일치가 필요하다 (`README.md#154-157`). raw candidate는 deployable resource가 아니다.
- [OBSERVED] asset lane은 concept/candidate/runtime을 분리하고 candidate sidecar에 source·generator·rightsReceipt·runtimeReceipt와 `runtimeEligible: false`를 요구한다 (`engineering/asset-pipeline/asset-lanes.json#35-50`). 2D sprite/plate도 이 경계를 통과하기 전에는 runtime resource가 아니다.

## Contradictions
- **상승 baseline vs DDA:** 고정 Stage 1–3 curve는 비교 가능해야 하지만 unrestricted DDA는 실제 난이도를 바꾼다. [DECISION] current slice에서는 schedule·hurdle timestamp를 hard constraint로 두고 adaptation은 defer한다.
- **director vs difficulty rewrite:** director가 variant/timing을 바꾸는 것과 base stats를 바꾸는 것은 별개다. [DECISION] director는 legal budget variant만 고른다.
- **2D visual occlusion vs gameplay occlusion:** PNG alpha/overlap은 collision과 LOS가 아니다. [DECISION] simulation primitive와 foot anchor만 authority다.
- **사인 파형 vs 검증:** [DECISION] curve는 logistic sigmoid가 아니다. versioned record는 normalized components `density(t)`, `damagePressure(t)`, `telegraphCoverage(t)`, `egressRisk(t)`를 declared cap으로 `[0,1]`에 normalize하여 `load(t)`를 계산한다. `load(t) = B(t) + Σ a_i·w_i(t)`에서 `B(t)`는 단조이고 `w_i(t)=sin(π·(t-start_i)/(end_i-start_i))` for `start_i ≤ t < end_i`, otherwise `0` (`half-sine-v1`)다. planned/realized pulse record는 shape/version, stageId, start/end/recovery tick, amplitude bound, expected response, sample stride, max error를 가지며 every declared sample에서 compare한다. 이것은 `[TARGET]` 계측 계약이며 난이도·재미 PASS 증거가 아니다.

## Key Insight
PCG는 pacing의 주인이 아니라 **offline-authored pacing contract의 constrained realization**이어야 한다. layout seed가 만든 proposal은 사람의 route/clearance/camera/objective validation을 거쳐 committed static profile이 되고, runtime은 그 profile에서 deterministic encounter variant만 고른다. image-first renderer는 foot anchor와 render band를 read-only로 투영하며, 입력은 직접 콤보·대시를 유지한다. 이 구조만이 one-stick-adjacent mobile readability, telegraph egress, 2.5D visual depth, profile-aware replay, Stage 1–3 variation, 그리고 측정 가능한 상승+사인형 hurdle 곡선을 함께 보장한다. [TARGET] 세 Stage 계획 band는 900–1440초(기준 1080초)이고 Stage별 hard ceiling 540초를 모두 쓰면 1620초다. G4/G7/G8의 사람 플레이 게이트는 별도 검증 없이는 PASS가 아니다.

## Curated Sources
- `direct page retrieval` — PCG Book (constructive dungeons, experience-driven PCG, evaluation): https://www.pcgbook.com/
- `direct page retrieval` — Hunicke, DDA player-experience risk: https://dl.acm.org/doi/10.1145/1178477.1178573
- `direct page retrieval` — Valve Director pacing/pressure deck: https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf
- `direct page retrieval` — Three.js transparency: https://threejs.org/manual/en/transparency.html
- `direct page retrieval` — Three.js Object3D render order: https://threejs.org/docs/pages/Object3D.html
- `direct page retrieval` — Gaffer fixed timestep/replay framing: https://gafferongames.com/post/fix_your_timestep/

## Metric Candidate Matrix
| Metric | Grain | What it falsifies | Target status |
|------|------|-------------------|---------------|
| Run scope and duration | `cinder-span`→`abyss-chancel`→`echo-throne`, first controllable tick→final objective tick, declared cohort | Stage가 계획 band 300–480초를 벗어난 원인을 설명하지 못함, Stage별 540초 hard ceiling 초과 또는 보스 생략 강제 종막, Stage 4/legacy route 혼입, pause/loading으로 부풀린 시간 | [TARGET] all-and-only three profiles: planned gameplay clock 900–1440 s, nominal 1080 s; absolute forced-finale ceiling 1620 s (`design/master-numeric-contract.md#17-19`) |
| Conditional failure hazard | 30 s bin, profile/seed/build/input cohort | unplanned collapse 또는 hurdle 후 회복 실패 | [TARGET] monotone baseline + declared pulse만 허용 |
| TTK | spawn/first-hit→death, normal/elite/boss | HP·armor·DPS mismatch | [TARGET] stage cohort별 p10/p50/p90 |
| TTD / damage pressure | trailing 10 s post-mitigation incoming DPS | unfair spike, recovery 부재 | [TARGET] hurdle 뒤 declared recoveryEndTick readout |
| Density/composition | 1 s sample: local count, spawn rate, mix, bearing | body count가 아닌 screen pressure | [TARGET] scheduled vs realized budget 비교 |
| Telegraph coverage and egress | fixed samples + every telegraph onset: playable/camera-visible space와 active-telegraph union intersection, overlap count, connected unthreatened egress lanes/minimum width; pulse/profile/seed/build/input cohort | no-escape 또는 unreadable overlap spike | [TARGET] planned vs realized compare; declared bound 밖 union/overlap 또는 zero legal egress는 fail |
| Telegraph composite visibility | deterministic fixture: camera/profile hash/seed/expected ID-mask, active telegraph + actor/VFX/foreground composition, visible coverage and egress-marker pixels | foreground/blend layer가 simulation상 legal한 telegraph를 실제 화면에서 가림 | [TARGET] every camera-visible active telegraph and egress marker meets declared post-composite coverage threshold |
| Enemy speed/contact time | enemy/player speed ratio와 first-contact distribution | kiting space 상실 | [TARGET] normal은 player보다 느리게 시작, elite에서만 단기 압박 |
| DPS/kill throughput | source/ability/target split | dominant build 또는 false pick-rate 판단 | [TARGET] seed-matched conditional comparison |
| Ability offer/pick | offer, choice, reroll, later outcome | choice diversity가 없는 성장 | [TARGET] every offer log |
| Hurdle cadence | `difficultyCurveVersion`, `half-sine-v1` pulse id, planned/actual start/end/recovery tick, amplitude, response type, sample stride/error | intended pulse 생략/중복/범위 밖 spike 또는 non-sine waveform | [TARGET] `B(t)` monotone; every `w_i(t)` is half-sine in its declared window and 0 outside |
| PCG fairness | `layoutSeed`, generator version, `profileId`, profile-content hash, reachability, spawn affordance | offline proposal에서 유입된 geometry-origin difficulty outlier | [TARGET] outlier proposal reject/revise before profile commit |
| Replay integrity | profileId/content hash, encounter seed/PRNG streams, tick, input/event sequence hash | vetted profile가 아닌 실행 또는 balance 비교의 신뢰 상실 | [TARGET] same profile+seed+input = same event sequence |

## Sources
- `direct page retrieval` — Valve playtest empiricism: https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ValvesApproachToPlaytesting.pdf
- `direct page retrieval` — Unity event schema: https://docs.unity.com/en-us/analytics/events/record-event
- `direct page retrieval` — GameAnalytics tracking: https://docs.gameanalytics.com/event-tracking-and-integrations/sdks-and-collection-api/game-engine-sdks/unity/event-tracking/
- `direct page retrieval` — Drachen et al. behavioral telemetry clustering: https://arxiv.org/abs/1407.3950
- `direct page retrieval` — Zohaib DDA review: https://doi.org/10.1155/2018/5681652
