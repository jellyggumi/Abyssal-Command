# 스테이지 구성(배경/분위기) — 자유 궤도 카메라 대응 (2026-07-25)

run-id: `20260723-solo-warden-rpg-concept` · lane: 스테이지 구성(배경/분위기) (`stage1-reentry-synthesis-20260725.md` §4-3)
입력: `design/worldview.md`(스테이지 계보/톤), `design/resource-inventory-20260725.md` §1.1/§3/§5(terrain GLB 전수조사+Blender 실측), `design/trend-survey/defense-offense-rpg-hybrid-deep-research-20260725.md` 카테고리4(고정카메라 근거), `design/stage1-reentry-synthesis-20260725.md` §2.1-2.2, `defense-catalog.js`(`STAGES`/`STAGE_TACTICS`/`STAGE_PRESENTATION_BY_ID`/`CUTSCENES`), `battle-realtime-three.js`(렌더러 원본, 읽기 전용).

이 문서는 §2.1(자유 궤도 카메라 확정: yaw 무제한, pitch [30°,85°])이 만드는 **에셋 노출 리스크**의 대응책만 다룬다. hunt→extract→materialize→capture→assault 체인, 10스테이지 순서(Cinder Span→Veil Citadel→Echo Throne→Sunken Bastion→Howling Sprawl→Glass Necropolis→Starless Canal→Shattered Causeway→Abyss Chancel→Gate Zenith)는 불변 — 재론하지 않는다.

## 0. 방법론 — 이 문서가 할 수 있는 것과 없는 것

`resource-inventory-20260725.md` §3의 Blender headless 실측은 **캐릭터 카테고리(보스/동료/적/커맨더) 우선**으로 13개 GLB를 샘플링했고, terrain은 `cinder-span.glb`/`gate-zenith.glb` 2개만 포함됐다(§3 표, 전체 10개 terrain 중 2개) [OBSERVED, `resource-inventory-20260725.md:114-128`]. `stage1-reentry-synthesis-20260725.md` §2.2가 정의한 후속 GLB 감사(8방위×2고도=16앵글 렌더링, 백페이스컬링/UV시접선/실루엣 확인)도 "보스 10종 전량+동료/적 대표 2종, 총 ~24종"으로 스코프가 짜였다 [OBSERVED, `stage1-reentry-synthesis-20260725.md:59-61`] — **terrain 10종은 이 감사 스코프에 명시적으로 포함되지 않는다**. 따라서 이 문서는:

1. 실측된 2개 terrain(`cinder-span`/`gate-zenith`)의 bounding box·폴리곤수를 근거로 형태적 리스크를 추론한다 [INFERENCE].
2. `STAGE_PRESENTATION_BY_ID`의 공식 분위기/랜드마크 텍스트(코드에 존재하는 디자인 어휘, 3D 렌더러 미연동 확인됨 — §1.2)를 목표 분위기의 근거로 삼는다 [OBSERVED, `defense-catalog.js:468-539`].
3. 나머지 8개 terrain은 **파일명·크기·스테이지명이 함의하는 지형학**(다리/성채/왕좌/수몰/황야/유리/운하/둑길/예배소)만으로 구조적 리스크를 추정하고, 실제 백페이스컬링/UV/실루엣 판정은 **전량 GLB 감사 확대 없이는 불가능**하다고 명시한다.
4. 그 결과 **10개 스테이지 전부 최종 판정은 NEEDS-AUDIT-CONFIRMATION**이다 — 이는 이 문서의 결함이 아니라 §2.2 감사 스코프가 terrain을 포함하지 않은 채 자유 궤도 카메라가 먼저 확정된 실제 프로젝트 상태를 정직하게 반영한 것이다(과제 지시 4항이 정확히 예견한 결과). 대신 **감사 우선순위**를 형태적 근거로 등급화해 디렉터가 어느 스테이지부터 §2.2 감사를 확대해야 하는지 판단할 수 있게 한다.

## 1. 전역 시스템 소견 — 10개 스테이지 전부에 선행 적용되는 4개 발견

개별 스테이지 절로 들어가기 전에, 코드 감사로 확인된 **스테이지 무관 전역 이슈** 4개를 먼저 기록한다. 아래 스테이지별 제안은 전부 이 4개 위에 얹힌다.

### 1.1 안개/조명/스카이박스가 전부 전역 상수 — 스테이지별 분기 없음

`RealtimeBattle.mount()`가 안개(`new THREE.Fog(COLORS.backgroundBottom, WORLD_SCALE*1.8, WORLD_SCALE*4.2)`)·조명 3종(ambient/key/rim, 고정 색상·고정 월드좌표)·환경맵(`buildEnvironmentMap()` — 6색 큐브 하나를 마운트 시 1회 생성)을 **스테이지 id와 무관하게 동일하게** 설정한다 [OBSERVED, `battle-realtime-three.js:670-682`, `582-603`]. 반면 `STAGE_PRESENTATION_BY_ID`에는 10개 스테이지 전부에 대해 이미 완성된 팔레트 슬롯(`surface`/`contour`/`landmark`/`hazard`/`objective`)과 분위기 서술(`descriptor`/`motif`)이 존재하지만, `battle-realtime-three.js` 전체에서 `stagePresentation`/팔레트 문자열을 읽는 코드가 **0건**이다 [OBSERVED, grep 결과 — `stagePresentationFor()`는 `app.js`의 Canvas2D/HUD 텍스트 경로에서만 소비됨, `app.js:113-115,1238-1241`]. 즉 **디자인 데이터는 이미 스테이지별로 완비돼 있으나 3D 렌더러에 배선되지 않은 상태**다.

**함의**: 아래 스테이지별 "구도 제안"의 안개색/림틴트 값들은 이 배선이 존재한다고 가정한 [TARGET] 제안이다 — 구현 단계에서 `mount()`/`ensureStageTerrain()`이 `stageId`를 받아 `STAGE_PRESENTATION_BY_ID[stageId].palette`를 안개색·조명색·환경맵 틴트로 매핑하는 신규 함수(가칭 `applyStagePalette(stageId)`)가 필요하다. 이 문서는 그 함수의 스펙을 발명하지 않고 목표 색 방향성만 제시한다.

### 1.2 림 라이트가 월드 고정 — 궤도 카메라와 반대로 회전하면 역광이 사라짐

`rim.position.set(-8, 5, -6)`은 씬 좌표계에 고정된 방향광이다 [OBSERVED, `battle-realtime-three.js:680-681`]. 고정 카메라(기존 ~45° 오프셋)에서는 이 방향이 항상 카메라 반대편(실루엣 강조)으로 작동하지만, 자유 궤도가 도입되면 카메라가 궤도를 돌아 림 라이트와 같은 방향에 서는 순간 림 효과가 사라지고 반대편에서는 과도한 역광이 생긴다 — **모든 10개 스테이지에 동일하게 적용되는 조명 버그이지 스테이지별 이슈가 아니다**. 연구문서 카테고리4가 지적한 "고정 카메라라 애셋이 단일 시점 전제로 제작됐다"는 리스크의 조명판 등가물이다 [OBSERVED, `defense-offense-rpg-hybrid-deep-research-20260725.md:190`]. **제안**: `rim`을 카메라 상대 좌표(예: 카메라 위치의 궤도 반대편 65% 지점, 매 프레임 `orbitYaw`/`orbitPitch` 갱신 시 재계산)로 전환 — 스테이지 구성이 아니라 §2.1 카메라 구현 요구사항에 추가해야 할 항목이나, 모든 스테이지의 "임의각 준비도"에 직접 영향을 주므로 여기 기록한다.

### 1.3 스폰 방향이 전부 서쪽 편향 — 지형의 "정면"이 항상 서쪽

`STAGE_TACTICS`의 `spawnDirections`를 10개 스테이지 전부 확인한 결과, 모든 스테이지가 `W`를 포함하고(단독 `W`부터 `W/NW/SW`까지) 동쪽(`E`) 스폰은 단 한 건도 없다 [OBSERVED, `defense-catalog.js:342-441`, 전체 10개 항목 직접 확인]. `ARENA.gateX=22000`(동쪽 끝)·게이트가 동쪽에 있고 적은 서쪽에서 온다 [OBSERVED, `defense-catalog.js:12`] — 즉 기존 고정 카메라 프레이밍과 전투 텔레그래프(위험지대·타겟팅 우선순위)는 전부 "서쪽에서 동쪽을 바라보는" 구도로 설계됐을 가능성이 높다 [INFERENCE]. 자유 궤도가 카메라를 동쪽(게이트 뒤편)으로 돌리면, 지금까지 플레이어가 한 번도 정면으로 본 적 없는 "관문 뒤 배경"이 노출된다 — **동쪽/북동쪽 앵글이 10개 스테이지 공통으로 가장 검증되지 않은 각도**라는 뜻이다. 스테이지별 절의 체크리스트에서 이 공통 리스크를 반복 언급하지 않고 여기 1회 기록한다.

### 1.4 안개 근/원 거리가 지형 풋프린트와 독립적으로 산출됨

`TERRAIN_TARGET_HALF_EXTENT = WORLD_SCALE * 1.15 = 16.1`(모든 지형이 이 절반폭으로 자동 맞춰짐 [OBSERVED, `battle-realtime-three.js:22-29`])인 반면, 안개 근/원 거리는 `WORLD_SCALE * 1.8 = 25.2` / `WORLD_SCALE * 4.2 = 58.8`이다 [OBSERVED, `battle-realtime-three.js:672`] — 두 상수 모두 `WORLD_SCALE`에서 파생됐지만 서로 다른 배수라 지형 가장자리가 안개 시작점(25.2) 안쪽에 위치하는지 바깥쪽에 위치하는지는 **줌 팩터(§2.1 요구사항 3, 아직 근/원 값 미확정)에 따라 달라진다** — 카메라가 지형에 가까이 줌인하면 안개가 전혀 개입하지 않아 지형 가장자리(다리 끝, 지평선과의 접합부)가 그대로 노출된다. `presentation-spec.md:22`도 줌 클램프값을 "TBD at implementation, measured against GLB content"로 명시하고 있어 [OBSERVED] 아직 확정되지 않았다. **제안**: 줌 근/원 클램프를 확정할 때 안개 근거리가 항상 지형의 실제(자동맞춤 후) 풋프린트 대각선보다 작도록(즉 어떤 줌 레벨에서도 지형 가장자리가 안개에 걸리도록) 역산해야 한다 — 정확한 스테이지별 풋프린트 대각선은 런타임 측정 없이는 알 수 없으므로 [INFERENCE] 표기, 구현 단계 확인 필요.

## 2. 임의각 준비도 체크리스트 — 연구문서 카테고리4 이식

`defense-offense-rpg-hybrid-deep-research-20260725.md` 카테고리4가 Diablo Immortal/Torchlight Infinite의 고정 카메라 채택 근거로 확인한 문장: **"환경/지형/적 에셋이 단일 시점을 위해 제작되었으며 회전을 허용하면 '렌더링되지 않은 영역이 노출될 가능성'이 있다"** [OBSERVED, `defense-offense-rpg-hybrid-deep-research-20260725.md:190`, "environment/enemy assets are built for a single viewpoint... rotation risks exposing unrendered areas"]. 이를 `stage1-reentry-synthesis-20260725.md` §2.2의 감사 항목(백페이스컬링/UV시접선/실루엣)과 결합해 스테이지별 체크리스트로 이식한다:

| 체크 항목 | 통과 조건 | 이 문서에서 검증 가능한 방법 |
|---|---|---|
| **A. 백페이스컬링 노출** | 회전 시 지오메트리 "뚫려 보임" 없음 | bbox 종횡비([INFERENCE] — 극단적으로 얇은 축이 있으면 그 축에 수직으로 볼 때 카드처럼 납작해질 위험) + GLB 감사 확대 필요 |
| **B. UV 시접선 노출** | 측/후면 각도에서 텍스처 이음선 안 보임 | 코드/인벤토리로 검증 불가 — 전량 GLB 감사 확대 필요 |
| **C. 단일시점 실루엣 미완성** | 동쪽/후면(§1.3) 앵글에서 지형이 "끊긴" 것처럼 안 보임 | 랜드마크 명칭이 함의하는 건축학적 방향성([INFERENCE], 아래 스테이지별) + GLB 감사 확대 필요 |
| **D. 안개/카메라 거리로 완화 가능한가** | §1.4 안개 근거리가 지형 가장자리를 가릴 수 있는가 | 실측 bbox 2건에서 직접 계산 가능, 나머지는 [INFERENCE] |

**판정 규칙**: A/B/C 중 하나라도 GLB 감사 없이 결론 내릴 수 없으면 스테이지 전체 판정은 `NEEDS-AUDIT-CONFIRMATION`이다. `PASS`는 이론상 A/B/C 전부가 실측 근거로 배제된 경우에만 가능하며, 이 문서 작성 시점 기준 그런 스테이지는 없다(§0 참조) — 대신 아래 각 절이 **감사 착수 시급도**(높음/중간/낮음)를 부여해 우선순위를 대체한다.

## 3. 스테이지별 구성 제안 (10종)

### 3.1 Stage 1 — Cinder Span (잿빛 교량)

**자산 근거**: `terrain/cinder-span.glb`, 35KB, 8 mesh obj, 840 vert / 356 poly, bbox **5.20×2.70×0.65**(X×Y×Z) [OBSERVED, `resource-inventory-20260725.md:32,123`]. 랜드마크: `ember-relay-spire`(불씨 중계탑), `drowned-forge-arch`(잠긴 용광로 아치) [OBSERVED, `defense-catalog.js:472`]. `audit-05-combat-hud.png`(기존 고정카메라 스크린샷)가 대각선으로 후퇴하는 계단형 석재 슬랩과 짙은 안개 비네팅을 확인시켜준다 [OBSERVED, 직접 시각 확인].

**분위기 목표**: "잿빛 바람이 교량의 봉쇄선을 훑는다" / 모티프 "불씨와 재의 흐름" [OBSERVED, `defense-catalog.js:473`]. 컷신: "잿빛 파수꾼이 용광로의 사슬을 끌며 둑길을 차단한다" [OBSERVED, `defense-catalog.js:182`].

**구도 제안**:
- Z축(0.65)이 X축(5.20)의 1/8에 불과한 극단적 편평 bbox — 다리(span) 구조상 당연하지만, 자유 궤도가 이 다리를 옆에서(90° yaw 근처) 보면 실루엣이 "얇은 카드"처럼 읽힐 위험이 구조적으로 가장 크다 [INFERENCE, 실측 bbox 기반].
- 안개(§1.4)를 이 스테이지에서 특히 타이트하게(다리 양 끝단이 항상 안개에 잠기도록) 설정해 "다리가 허공에서 끊긴다"는 인상 대신 "안개 속으로 사라진다"는 의도된 소실을 연출 — 재(ash) 모티프와 서사적으로도 정합.
- 림 라이트 틴트를 `COLORS.rim`(0x6ea8ff, 차가운 톤)에서 이 스테이지 한정 온기 있는 앰버(불씨 모티프)로 이동 제안 — `ember-relay-spire` 랜드마크가 임의각에서도 "빛나는 랜드마크"로 인식되도록.
- 동쪽(§1.3) 앵글에서 `drowned-forge-arch`(잠긴 용광로 아치)가 시각적으로 완결되는지가 최우선 확인 대상 — 아치형 구조물은 관통형이라 뒤에서 보면 반대편이 그대로 보이는 구조이므로 뒷면 재질/지오메트리가 앞면과 대칭인지가 핵심.

**임의각 준비도 체크리스트**: A=[INFERENCE 위험 높음, 편평 bbox], B=미확인, C=미확인(아치 후면), D=계산 가능(§1.4 방식 재사용). **판정: NEEDS-AUDIT-CONFIRMATION (감사 착수 시급도: 높음)** — 10개 중 구조적 위험 신호가 가장 명확한 스테이지.

### 3.2 Stage 2 — Veil Citadel (장막 성채)

**자산 근거**: `terrain/veil-citadel.glb`, 24KB — Blender 실측 대상에 미포함 [OBSERVED, `resource-inventory-20260725.md:32`, `114-128`에 부재]. 랜드마크: `veil-rampart`(장막 성벽), `veil-twins`(쌍둥이 장막) [OBSERVED, `defense-catalog.js:479`].

**분위기 목표**: "성채의 장막이 신호와 시야를 삼킨다" / 모티프 "거울빛 장막과 정전" [OBSERVED, `defense-catalog.js:480`]. 컷신: "장막 성채가 신호를 삼킨다" [OBSERVED, `defense-catalog.js:187-188`].

**구도 제안**:
- 성채(citadel/rampart) 명명은 통상 성벽+안뜰 구조를 함의 — 전형적 리스크는 "정면 파사드만 모델링되고 후면은 단순 블록"인 패턴([INFERENCE], 게임 지형 관행). `veil-twins`(쌍둥이 장막)이 좌우 대칭 구조라면 yaw 회전에 상대적으로 안전하나, 실측 없이는 확인 불가.
- 안개색을 `mirror-static`(거울 정전) 해저드 모티프와 연결해 청회색 계열로, 스카이박스 큐브의 rim 면(측면) 색을 이 스테이지에서 "거울빛" 반사감이 도는 방향으로 틴트 — 단, §3.6(Glass Necropolis)의 반사재질 이슈와 달리 이 스테이지는 반사 모티프가 텍스트("거울빛")일 뿐 실제 반사 재질(metalness) 사용 여부는 리소스 인벤토리에 재질 정보가 없어 확인 불가.
- `veil-rampart`(장막 성벽)가 elevation 랜드마크로 지정돼 있어 고각(85° 근접) 시야에서 성벽 상단이 지붕처럼 평평하게 잘려 보이지 않는지 확인 필요.

**체크리스트**: A/B/C 전부 미확인(GLB 미실측). **판정: NEEDS-AUDIT-CONFIRMATION (감사 착수 시급도: 중간)**.

### 3.3 Stage 3 — Echo Throne (메아리 왕좌)

**자산 근거**: `terrain/echo-throne-steps.glb`, **11KB — 10개 terrain 중 최소 용량** [OBSERVED, `resource-inventory-20260725.md:32`]. 주의: 스테이지 id는 `echo-throne`이지만 실제 GLB 파일명은 `echo-throne-steps.glb`(계단 지형)이며, 별도의 `echo-throne` 컬렉션 자체는 장식용 왕좌 프롭으로 스테이지 루트가 아니다 [OBSERVED, `battle-realtime-three.js:49-52`]. 랜드마크: `throne-dais`(왕좌 단상), `throne-aisle`(왕좌 회랑) [OBSERVED, `defense-catalog.js:486`].

**분위기 목표**: "달 없는 궁정의 메아리가 왕좌 회랑을 울린다" / 모티프 "메아리와 단상의 균열" [OBSERVED, `defense-catalog.js:487-488`]. 컷신: "Moonless Court의 메아리 왕좌가 세 번째 봉쇄선 위에 떠 있다" [OBSERVED, `defense-catalog.js:194`] — "떠 있다(위에)"는 표현이 구조물이 지면에서 분리된 부양형임을 시사.

**구도 제안**:
- 11KB는 10개 중 가장 작은 파일이므로 폴리곤 예산이 가장 낮을 가능성이 높다 [INFERENCE] — 임의각에서 지오메트리 디테일 부족(저해상도 실루엣)이 가장 먼저 드러날 후보.
- "회랑(aisle)"이라는 명명은 좁고 긴 통로 구조를 함의 — Stage 1과 유사하게 측면 앵글에서 얇게 보일 위험. `throne-dais`(단상)가 회랑 끝에 있다면 저각(30°)에서 단상이 회랑에 가려 보이지 않을 수 있음 — 저각 프레이밍 시 단상 가시성 확인 필요.
- "떠 있다"는 컷신 텍스트가 사실이라면(부양형 구조) 임의 고각(85°)에서 구조물 하부가 노출될 수 있음 — 하부 마감 여부가 핵심 확인 항목.
- 안개를 이 스테이지에서 가장 짙게(메아리/공허 모티프) 설정해 저해상도 지오메트리를 자연스럽게 은폐하는 것을 임시 완화책으로 제안 — 근본 해결은 아니며 GLB 감사 후 폴리곤 밀도가 실제로 부족하면 재작업 필요.

**체크리스트**: A=[INFERENCE 위험 중~높음, 최소 용량], B=미확인, C=[INFERENCE 위험 높음, 부양형+회랑 구조], D=계산 가능. **판정: NEEDS-AUDIT-CONFIRMATION (감사 착수 시급도: 높음)**.

### 3.4 Stage 4 — Sunken Bastion (가라앉은 보루)

**자산 근거**: `terrain/sunken-bastion.glb`, 43KB — 미실측 [OBSERVED, `resource-inventory-20260725.md:32`]. 랜드마크: `bastion-anchor`(보루 닻), `bastion-floodgate`(침수 수문) [OBSERVED, `defense-catalog.js:494`].

**분위기 목표**: "가라앉은 보루의 수문에서 조류가 밀려든다" / 모티프 "침수선과 닻의 잔향" [OBSERVED, `defense-catalog.js:495`]. 컷신: "가라앉은 보루의 네 번째 봉쇄선이 흔들린다", "침수된 추출점을 점유하고 닻의 잔향을 결속하라" [OBSERVED, `defense-catalog.js:200`].

**구도 제안**:
- "침수선(waterline)" 모티프가 명시적 — 수몰형 지형의 전형적 제작 단축(shortcut)은 "수면 위만 모델링하고 수면 아래는 절단"인데, 기존 고정 카메라(약 45° 부감)에서는 수면 위만 보이므로 이 단축이 티가 안 났을 가능성이 높다 [INFERENCE]. 자유 궤도가 저각(30°, 거의 수면 높이)으로 내려가면 수면 아래 절단면이 그대로 노출될 위험이 이 스테이지의 핵심 리스크.
- 안개 하단부(안개는 원래 카메라 거리 기반이라 수직 방향엔 무관하지만) 대신, 이 스테이지에 한해 수면 높이 근처에 페이크 반사/굴절 평면(기존 water-shader 없음 확인 — `battle-realtime-three.js` 전체에 `water`/`refraction` 키워드 0건, 신규 자산 아님, 기존 `MeshStandardMaterial` 조합만으로 표현 가능한 범위)을 저각 시야 완화책으로 제안 — 단 이는 코드 구현 영역이라 이 문서는 필요성만 표기.
- `bastion-anchor`(닻)가 elevation 랜드마크로 지정 — 닻은 통상 사슬로 지면/구조물에 연결되므로 임의각에서 사슬-닻 연결부가 자연스러운지 확인.

**체크리스트**: A=미확인, B=미확인, C=[INFERENCE 위험 높음, 침수선 절단 패턴], D=계산 가능. **판정: NEEDS-AUDIT-CONFIRMATION (감사 착수 시급도: 높음)**.

### 3.5 Stage 5 — Howling Sprawl (울부짖는 황야)

**자산 근거**: `terrain/howling-sprawl.glb`, 19KB — 미실측 [OBSERVED, `resource-inventory-20260725.md:32`]. 랜드마크: `sprawl-ridge`(황야 능선), `sprawl-funnel`(바람깔때기) [OBSERVED, `defense-catalog.js:501`].

**분위기 목표**: "울부짖는 바람이 황야의 측면을 열어젖힌다" / 모티프 "교차풍과 능선의 골" [OBSERVED, `defense-catalog.js:502`]. 컷신: "울부짖는 황야가 다섯 번째 관문의 측면을 연다" [OBSERVED, `defense-catalog.js:206`].

**구도 제안**:
- 황야/능선(wasteland/ridge)형 지형은 유기적 하이트필드 형태라 건축형 지형(다리/성채/왕좌)보다 임의각 회전에 상대적으로 안전한 편 — 자연 지형은 "정면"이라는 개념 자체가 약함 [INFERENCE, 일반적 게임 지형 제작 관행]. 10개 중 구조적 리스크가 상대적으로 낮은 후보.
- 다만 `sprawl-funnel`(바람깔때기)이라는 명명은 방향성 있는 지형(깔때기 = 한쪽이 좁아지는 통로)을 함의 — 이 부분만 국소적으로 방향성 리스크가 남는다.
- 안개를 이 스테이지에서 가장 옅게(먼지/바람 모티프, "탁 트인 황야"라는 인상) 설정해 나머지 스테이지 대비 대조를 주는 것을 제안 — 능선의 실루엣이 원거리에서도 읽혀야 "능선"이라는 지형 정체성이 성립.
- 스카이박스 rim/key 면에 먼지/모래 톤(황토색 계열)을 실어 원거리 대기 산란감 보강.

**체크리스트**: A=[INFERENCE 위험 낮음, 유기적 지형], B=미확인, C=[INFERENCE 위험 중간, 깔때기 국소 방향성], D=계산 가능. **판정: NEEDS-AUDIT-CONFIRMATION (감사 착수 시급도: 낮음)** — 10개 중 상대적으로 안전한 편이나 여전히 실측 미확인.

### 3.6 Stage 6 — Glass Necropolis (유리 묘역)

**자산 근거**: `terrain/glass-necropolis.glb`, 13KB — 10개 중 두 번째로 작은 용량, 미실측 [OBSERVED, `resource-inventory-20260725.md:32`]. 랜드마크: `glass-spire`(유리 첨탑), `glass-crypt`(유리 납골당) [OBSERVED, `defense-catalog.js:508`].

**분위기 목표**: "유리 묘역의 반사면이 고지와 사선을 가른다" / 모티프 "파편빛과 합창의 잔향" [OBSERVED, `defense-catalog.js:509`]. 컷신: "유리 묘역의 고지가 여섯 번째 관문을 내려다본다", "반사되는 사선을 피해 추출점을 점유하라" [OBSERVED, `defense-catalog.js:212`].

**구도 제안 — 이 스테이지는 다른 9개와 다른 종류의 리스크(코드 근거 확정)를 가진다**:
- "반사(reflection)"가 텍스트 모티프 수준이 아니라 스테이지 정체성의 핵심이다 — 그런데 `buildEnvironmentMap()`이 생성하는 환경맵은 **마운트 시점에 1회 생성되는 전역 6색 큐브**(모든 스테이지 공유)이며 특정 지형 지오메트리를 반사하지 않는다 [OBSERVED, `battle-realtime-three.js:582-603`, `671`]. 즉 "유리"로 설계된 재질(`MeshStandardMaterial`에 높은 metalness/낮은 roughness를 준 표면이 있다면)이 있어도 반사되는 것은 이 스테이지의 첨탑/납골당이 아니라 6색 큐브뿐이다 — **임의각에서 유리 표면이 회전해도 반사 내용이 안 변하거나(카메라 상대 반사가 아니라 고정 큐브라 실제로는 변하긴 하지만 지형과 무관한 내용을 비춘다) "이 장면의 무엇을 비추고 있는가"라는 서사적 정합이 애초에 존재하지 않는다** — 이는 GLB 형상 문제가 아니라 확정된 코드 아키텍처 문제이므로 실측 없이도 결론 낼 수 있는 유일한 스테이지다.
- 완화책: 스테이지별 환경맵 틴트(§1.1의 `applyStagePalette` 확장)만으로는 근본 해결이 안 됨 — "반사가 부정확해도 최소한 스테이지 팔레트와 색조는 일치시킨다" 정도가 신규 지오메트리/코드 아키텍처 변경 없이 가능한 최선.
- 13KB(최소권 용량)도 Stage 3과 동일한 저밀도 실루엣 리스크를 공유 — 유리 파편(shard) 모티프는 오히려 저폴리 각진 형태와 미학적으로 어울릴 수 있어 이 스테이지에 한해 저밀도가 리스크보다 스타일 요소로 재해석 가능할 여지가 있음 [INFERENCE].

**체크리스트**: A=미확인(형상), B=미확인, C=미확인(형상), **환경맵 서사 정합 = 확정 실패(코드 근거)**. **판정: NEEDS-AUDIT-CONFIRMATION, 단 환경맵 이슈는 GLB 감사와 무관하게 이미 확정된 별도 결함으로 기록 (감사 착수 시급도: 높음 — 형상 리스크 미확인 + 확정된 재질 아키텍처 결함 중첩)**.

### 3.7 Stage 7 — Starless Canal (별 없는 운하)

**자산 근거**: `terrain/starless-canal.glb`, 36KB — 미실측 [OBSERVED, `resource-inventory-20260725.md:32`]. 랜드마크: `canal-towpath`(운하 견인로), `canal-lock`(잠긴 수문) [OBSERVED, `defense-catalog.js:514`].

**분위기 목표**: "별 없는 수로의 저류가 통행길을 끌어당긴다" / 모티프 "수문과 어두운 물결" [OBSERVED, `defense-catalog.js:515`]. 컷신: "별 없는 운하가 일곱 번째 관문으로 갈라진다" [OBSERVED, `defense-catalog.js:218`].

**구도 제안**:
- Stage 4(Sunken Bastion)와 동일한 수계 지형 리스크 클래스 — 수문(lock)/운하(canal) 구조는 수면 절단선 리스크를 공유한다 [INFERENCE]. 다만 "견인로(towpath)"는 운하변을 따라가는 보행로이므로 완전 침수형인 Stage 4보다는 지상 비중이 높을 가능성 [INFERENCE, 명칭 기반 추정].
- 밤/무성(별 없는) 모티프이므로 안개색을 가장 어둡게, key 라이트 강도를 상대적으로 낮춰 실루엣 위주 조명으로 — 이는 형상 결함을 은폐하는 효과도 동반하므로(의도치 않은 완화책) GLB 감사에서 문제가 발견돼도 최종 비주얼에서 체감 영향이 작을 수 있다는 점을 참고로 기록.
- `canal-lock`(잠긴 수문)이 elevation 랜드마크가 아니라 chokepath로 지정돼 있어(§ tactics 표) 정면 통과형 구조물 — 아치형(Stage 1의 forge-arch)과 유사하게 관통 구조의 반대면 마감 확인 필요.

**체크리스트**: A=미확인, B=미확인, C=[INFERENCE 위험 중간, 수면절단+관통구조 중첩], D=계산 가능(야간 모티프로 안개 완화 여지 있음). **판정: NEEDS-AUDIT-CONFIRMATION (감사 착수 시급도: 중간~높음)**.

### 3.8 Stage 8 — Shattered Causeway (부서진 둑길)

**자산 근거**: `terrain/shattered-causeway.glb`, 37KB — 미실측 [OBSERVED, `resource-inventory-20260725.md:32`]. 랜드마크: `causeway-keystone`(둑길 쐐기돌), `causeway-gap`(끊긴 둑길) [OBSERVED, `defense-catalog.js:521`].

**분위기 목표**: "부서진 둑길의 틈이 관문 앞에서 흔들린다" / 모티프 "붕괴선과 쐐기돌" [OBSERVED, `defense-catalog.js:522`]. 컷신: "부서진 둑길이 여덟 번째 관문 앞에서 끊겼다" [OBSERVED, `defense-catalog.js:224`].

**구도 제안**:
- 붕괴/파편(shattered/rubble) 지형은 형태적으로 불규칙해 "정면에서만 그럴듯한" 인위적 대칭성이 낮은 편 — 일반적으로 임의각 회전에 비교적 관대한 카테고리 [INFERENCE]. 그러나 스테이지명 자체가 "끊긴 둑길(causeway-gap)"이라는 **의도된 결손(gap)**을 핵심 지형 요소로 삼고 있어, 이 gap의 절단면이 실제로 파단면처럼 모델링됐는지 아니면 단순 평면 절단(박스 컬링과 유사한 셰이더 트릭 없이 지오메트리를 그냥 자른 형태)인지가 핵심 리스크 — 정면(원래 고정카메라 각도)에서는 갭의 절단면이 원근에 가려 안 보였을 가능성.
- Stage 1(Cinder Span)과 마찬가지로 다리류 지형이라 편평 bbox 위험을 공유할 가능성 [INFERENCE, 미실측이라 확정 불가].
- 붕괴 파티클(먼지) 모티프를 스카이박스보다는 근접 VFX 성격으로 다루는 게 적합 — 이는 스테이지 구성보다 VFX 레인 소관이므로 이 문서에서는 방향성만 표기.

**체크리스트**: A=[INFERENCE 위험 중간, 다리류 가능성], B=미확인, C=[INFERENCE 위험 중간, gap 절단면], D=계산 가능. **판정: NEEDS-AUDIT-CONFIRMATION (감사 착수 시급도: 중간)**.

### 3.9 Stage 9 — Abyss Chancel (심연 예배소)

**자산 근거**: `terrain/abyss-chancel.glb`, **47KB — 10개 중 두 번째로 큰 용량**(Gate Zenith 다음), 미실측 [OBSERVED, `resource-inventory-20260725.md:32`]. 랜드마크: `chancel-apse`(예배소 후진), `chancel-nave`(예배소 본당) [OBSERVED, `defense-catalog.js:528`]. `STAGE_TACTICS`의 flank가 `chancel-transept`(예배소 **교차 회랑** — 원문 "transept"는 십자형 성당 건축의 좌우 날개) [OBSERVED, `defense-catalog.js:427-428`, `mapLabels.flank: "교차 회랑 측면"`, `defense-catalog.js:530`].

**분위기 목표**: "심연 예배소의 서약이 관문 위로 압력을 드리운다" / 모티프 "서약 고리와 가려진 서명" [OBSERVED, `defense-catalog.js:529`]. 컷신: "심연 예배소의 서약이 아홉 번째 관문을 억누른다" [OBSERVED, `defense-catalog.js:230`].

**구도 제안**:
- **10개 스테이지 중 유일하게 완전한 성당 건축 어휘(nave 본당/apse 후진/transept 교차랑)를 3개 필드에 걸쳐 공식적으로 사용**한다 — 이는 십자형(cruciform) 평면 구조를 명시적으로 함의하며, 만약 실제 GLB가 본당(nave, 정면 접근 축)만 상세 모델링하고 좌우 익부(transept)를 생략했다면, 자유 궤도가 측면(90° 근처)으로 돌았을 때 "성당이 갑자기 끝난다"는 인상이 다른 어떤 스테이지보다 구조적으로 뚜렷하게 노출될 위험이 있다 [INFERENCE, 건축 어휘 3필드 일치 기반 — 단순 명칭 하나가 아니라 화면구성표 자체가 4방향 십자축을 전제로 설계됨].
- 47KB라는 상대적으로 큰 용량이 이 리스크를 완화할 수도(전체 십자평면이 실제로 모델링됨) 악화시킬 수도(디테일이 nave 한 축에 집중돼 용량이 큼) 있어 판단 불가 — 실측 필요성이 10개 중 가장 명확한 케이스.
- 서약/억압(oath/pressure) 모티프에 맞춰 안개를 무겁게, key 라이트를 낮은 각도(제단 조명처럼)로 조정 제안. `chancel-apse`(elevation 랜드마크)가 후진(제단 뒤 반원형 구조)이라면 고각(85°)에서 반원 천장의 곡률이 자연스러운지 확인 대상.

**체크리스트**: A=미확인, B=미확인, C=[INFERENCE **위험 매우 높음**, 3필드 일치 십자평면 함의], D=계산 가능. **판정: NEEDS-AUDIT-CONFIRMATION (감사 착수 시급도: 높음 — Cinder Span과 함께 최우선)**.

### 3.10 Stage 10 — Gate Zenith (관문 정점)

**자산 근거**: `terrain/gate-zenith.glb`, **76KB — 10개 중 최대 용량**, Blender 실측 완료: 8 mesh obj, **2,064 vert / 1,008 poly**, bbox **2.30×2.30×2.18**(X×Y×Z) [OBSERVED, `resource-inventory-20260725.md:32,124`]. 랜드마크: `zenith-crown`(정점의 왕관), `zenith-threshold`(관문의 문턱) [OBSERVED, `defense-catalog.js:535-536`].

**분위기 목표**: "관문 정점에서 명령망이 심연과 맞닿는다" / 모티프 "문턱 광선과 마지막 봉인" [OBSERVED, `defense-catalog.js:536-537`]. 승리 대사(캠페인 완료 대사, 원문 불변): "Moonless Court의 명령망이 끊겼다. 열 번째 봉쇄선은 유지되고 Echo Deep은 남는다" [OBSERVED, `defense-catalog.js:238`, `worldview.md:10`].

**구도 제안**:
- **10개 중 유일하게 bbox가 거의 정육면체(2.30×2.30×2.18, 최대/최소축 비율 1.05배)** — Cinder Span의 8:1 편평 비율과 정반대로, 어느 축도 극단적으로 얇지 않아 형태적으로 임의각 회전에 가장 관대한 구조다 [OBSERVED 기반 INFERENCE]. 폴리곤수(1,008)도 실측된 2개 중 최대(Cinder Span의 356의 약 2.8배)라 디테일 예산도 가장 넉넉하다.
- 그럼에도 **캠페인 최종 스테이지라는 서사적 비중이 가장 크다** — 다른 9개 스테이지에서 사소한 형상 결함은 플레이가 빠르게 다음 스테이지로 넘어가며 희석되지만, Gate Zenith는 엔딩 컷신·정점 왕관(`zenith-crown`)이 화면에 오래 머무는 최종 보스전 무대이므로 임의각 노출 빈도와 플레이어 주목도가 최대치다 [INFERENCE].
- `zenith-threshold`(관문의 문턱)가 chokepath 지정 — "문턱 광선(threshold-rays)"이 terrain patternId에 명시된 만큼 광원 연출(광선다발)이 핵심 요소로 보이며, 이는 §1.1의 스테이지별 key 라이트 방향 커스터마이징이 가장 강하게 요구되는 스테이지 — 문턱을 관통하는 광선 방향이 궤도 카메라의 임의 yaw에서도 "위에서 아래로 관통"하는 구도로 일관되게 읽히려면 key 라이트를 카메라 상대가 아니라 씬 절대 수직에 가깝게 고정하는 편이 오히려 유리 [INFERENCE — §1.2의 "카메라 상대 림 라이트" 제안과는 목적이 다른, 이 스테이지 특유의 예외 케이스로 명시].
- 안개를 10개 중 가장 옅게(정점/제니스=최고점이라는 이름 자체가 "가장 멀리, 가장 넓게 보인다"는 함의) 설정해 캠페인 완주 시점의 개방감 있는 조망을 강조하는 것을 제안.

**체크리스트**: A=[INFERENCE 위험 낮음, 실측 정육면체 근사], B=미확인(실측 범위 밖), C=[INFERENCE 위험 낮음~중간, 형태는 안전하나 서사적 노출 빈도가 최대], D=계산 가능(가장 여유). **판정: NEEDS-AUDIT-CONFIRMATION, 단 형태적 사전 신호는 10개 중 가장 양호 (감사 착수 시급도: 중간 — 리스크 신호는 낮지만 서사적 비중 때문에 감사 순번에서 뒤로 미룰 수 없음)**.

## 4. 요약 — 감사 착수 시급도 순위

| 스테이지 | GLB 용량 | 실측 여부 | 핵심 리스크 신호 | 감사 시급도 |
|---|---:|---|---|---|
| Cinder Span | 35KB | 실측(bbox 8:1 편평) | 극단적 편평 bbox + 관통 아치 후면 | **높음** |
| Abyss Chancel | 47KB | 미실측 | 십자평면 건축 어휘 3필드 일치(nave/apse/transept) | **높음** |
| Glass Necropolis | 13KB | 미실측 | 반사 서사 vs 전역 6색 큐브 환경맵 — **확정된 코드 결함** | **높음** |
| Echo Throne | 11KB(최소) | 미실측 | 최소 용량 + 부양형 회랑 구조 함의 | **높음** |
| Sunken Bastion | 43KB | 미실측 | 침수선 절단 패턴(저각에서 수면 하부 노출) | **높음** |
| Starless Canal | 36KB | 미실측 | 수면절단 + 관통형 수문 중첩 | 중간~높음 |
| Veil Citadel | 24KB | 미실측 | 성채형 정면파사드 편중 가능성 | 중간 |
| Shattered Causeway | 37KB | 미실측 | 다리류 편평 가능성 + gap 절단면 | 중간 |
| Gate Zenith | 76KB(최대) | 실측(bbox 정육면체 근사) | 형태 신호는 최선이나 최종보스 노출빈도 최대 | 중간 |
| Howling Sprawl | 19KB | 미실측 | 유기적 지형(상대적 안전) + 국소 깔때기 방향성 | **낮음** |

## Director Handoff Note (디렉터 핸드오프 노트)

가장 중요한 결정: **§2.2 GLB 임의각 감사 스코프를 terrain 10종까지 확대할지, 그리고 확대한다면 이 문서의 "감사 시급도" 순위(§4)를 그대로 따를지**다. `stage1-reentry-synthesis-20260725.md` §2.2는 감사 대상을 "보스 10종 전량 + 동료/적 대표 2종, 총 ~24종"으로 확정했고 terrain을 명시적으로 포함하지 않았다 [OBSERVED, `stage1-reentry-synthesis-20260725.md:59-61`] — 그런데 자유 궤도 카메라가 배경/지형에도 동일한 "단일 시점 전제" 리스크를 적용한다는 것이 이 문서의 핵심 발견이며, 특히 **Glass Necropolis의 환경맵 문제(§3.6)는 GLB 형상 감사와 무관하게 이미 코드로 확정된 결함**이라 감사를 기다릴 필요 없이 지금 바로 스코프에 넣어야 한다. 두 번째로 시급한 결정은 **§1.1의 `applyStagePalette(stageId)` 배선 여부**다 — `STAGE_PRESENTATION_BY_ID`에 10개 스테이지 전부의 분위기/팔레트 데이터가 이미 완비돼 있는데 3D 렌더러가 이를 전혀 읽지 않는 상태이므로, 이 문서의 스테이지별 안개색/림틴트 제안 전부가 이 배선이 존재한다고 전제한 [TARGET]이다 — 디렉터가 이 배선 작업을 이번 사이클 구현 대상에 넣지 않으면 §3의 색채 제안은 적용 지점이 없다. 감사 우선순위만 놓고 보면 **Cinder Span·Abyss Chancel·Glass Necropolis·Echo Throne·Sunken Bastion 5개**가 형태적 근거(편평 bbox/건축어휘/코드결함/최소용량/절단선 모티프)로 가장 먼저 확인돼야 하고, **Gate Zenith는 형태 신호는 양호하나 최종보스전이라는 서사적 노출 빈도 때문에 감사 순번에서 뒤로 미룰 수 없다**는 점이 유일하게 "안전해 보이지만 미룰 수 없는" 예외 케이스임을 디렉터가 인지해야 한다.
