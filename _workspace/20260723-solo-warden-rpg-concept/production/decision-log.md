# Decision Log — Director Arbitrations

run-id: `20260723-solo-warden-rpg-concept`

## D1 — 스탠스 명칭 충돌: "결집(Rally)" → "포대(Turret)"

**충돌**: DesignerCoreLoop가 0-FRONT 스탠스를 "결집(Rally)"로 명명했으나, ProgFormationSim이 독립적으로 "Boss Rally Window"(FRONT≥1 요구 메카닉)를 설계 — 동일 단어가 반대 조건(0 FRONT vs ≥1 FRONT)을 가리켜 혼동 유발.
**증거**: 두 레인 모두 IRC로 자체 조율해 DesignerCoreLoop가 "포대(Turret)"로 개명 완료(`design/lane-coreloop.md` §7).
**판정**: **확정 채택.** "Rally"는 Boss Rally Window(전투 메카닉) 전용, 스탠스 3종은 전열/포대/분산.

## D2 — RPG 시스템 스키마 포크: Warden전용 vs 동료공유 스탯

**충돌**: DesignerRPGSystems(권위)는 Warden 6스탯 전용 + 동료는 역할패시브만; ProgDataArch는 5개 공유스탯 + 동료별 `allocatableStatIds` 배분 서브셋을 제안.
**증거**: 양쪽 다 필드명 어휘(`damageBonus` 등)는 일치 — 스키마 차이는 "어떤 키가 존재하는가"뿐, 구현 난이도 델타는 크지 않음(`lane-rpgsystems.md` §0).
**판정**: **designer안 채택.** 동료는 스탯 배분 없이 역할패시브+장비+특성으로만 성장. 근거: (1) "Warden만 고유 성장"이라는 세계관 원칙과 정합, 배분형 스탯을 동료에도 주면 원칙 희석. (2) Kingshot의 "구성 특화 vs 스탯 min-max" 원칙에 더 가까움. (3) R2(편성 조합 지배) 리스크 표면 축소 — 승수 원천 하나 감소. `ProgDataArch`의 `CompanionRecord.statPoints` 필드는 제거, `equipment`+`traits`만 유지.

## D3 — 로드아웃 정원: 3 고정 vs 3→6 확장

**충돌**: PMForecast가 스테이지 3/7/9에 로드아웃 정원 3→4→5→6 확장을 페이싱 피크로 제안. DesignerCoreLoop의 스탠스 오프셋 수학(전열/포대/분산)은 3-way 고정을 전제. PMForecast 자신도 이 의존성을 미해결로 명시(`lane-forecast.md` §7).
**판정**: **3 고정 채택**(`MAX_LOADOUT_SIZE=3`, 기존 코드값 그대로). 스탠스 수학 N슬롯 일반화는 범위 밖 후속 작업. PMForecast의 정원확장 피크는 **모드 언락**(stage7 열포지션, stage9 Assault Formation)으로 대체 — 6-peak/4-trough 리듬 자체는 보존.

## D4 — "Full Rally" 명칭·스코프: PM 스킬-역전 메카닉

**충돌**: PMRewardBands의 "Full Rally"(3슬롯 상한을 넘어 보유 동료 전원 합류)가 D3(3고정)와 정면 충돌, 이름도 D1의 Boss Rally Window와 겹침.
**판정**: **"결집 강화(Formation Surge)"로 개명 + 스코프 축소.** 3슬롯 상한 유지, 발동 시 "빈 슬롯 채움" 대신 "기존 3기 전원 일시 강화". 수치(충전3/스윙상한30%/천장90%/발동1회당전투)는 원안 그대로 채택.

## D5 — 일시정지 메뉴: 기존 "중앙패널 금지" 규칙과의 충돌

**충돌**: UIInfoArchitecture가 "런 도중 빌드 확인" 요구를 위한 일시정지 오버레이가 "적·투사체·위험영역을 덮는 중앙패널 금지" 규칙과 문언상 충돌한다고 플래그, A(정지중 허용)/B(문언엄수) 두 옵션 제시하고 미확정으로 남김.
**판정**: **옵션 A 채택.** 규칙의 명시된 근거는 "위험 영역을 가리지 않는다"(실시간 위협 회피 가능성 보존)이며, `userPaused===true`(시뮬레이션 정지) 상태에서는 실시간 위협이 없으므로 취지 위반이 아니다. 정지 중에만 열리는 대형 오버레이(스탯시트/인벤토리/동료상세) 허용, 재개 시 닫힘.

## D6 — R3 시행 지점 확정 요청 [부분 해소 — D6b 참조]

QARiskRegister가 지적: 곱연산 체인이 derive-fn(가산, 준수)과 fire-time 스탠스승수(곱연산) 2레이어로 나뉘어, 1.3× 상한을 derive-fn 출력에만 걸면 fire-time 배수가 빠져나간다. **원 판정**: 이번 사이클은 시행 지점을 확정하지 않고 요구사항만 명문화, 정확한 코드 위치는 Stage 2 이월.
**D6b 갱신**: `UNIFIED-GDD.md` §9.1/`balance-sheet.md` "전체 영구 파워 예산 거버넌스"에 **시행 바인딩 규칙**을 명문화 완료 — "R1/R3/R5 세 상한 전부 fire-time 이후 최종 effectiveDamage/effectiveStats에 대해 측정"으로 정책 레벨은 확정. **여전히 미해결**: 그 정책을 실제로 어느 함수 호출 지점(코드 라인)에서 강제할지는 코드가 없는 이번 사이클 성격상 확정 불가 — ProgFormationSim(fire-time 소유)+ProgDataArch(derive-fn 소유) 공동 구현이 Stage 2 여전히 필요. 정책과 구현 지점을 혼동하지 말 것.

## D7 — PRED-09 무비용 육탄방패 리스크 [설계 레버 도입 — D7b 참조]

DOWNED가 런스코프 한정(영구손실 없음)이라는 §4.4 설계 자체가 "방어투자 0인 동료를 FRONT에 세우는 것이 항상 최적해"가 될 위험을 연다는 QA 지적. **원 판정**: 이번 사이클은 설계를 변경하지 않음(영구성 계약 보존이 우선) — Stage 2 시뮬레이션으로 재검증 이월.
**D7b 갱신**: 완전 해소는 여전히 Stage 2 시뮬레이션 필요(조합 폭발 공간, 수식 하나로 단언 불가)하나, **레버 자체는 이번에 설계**했다 — `formationIntegrity`를 동료 장비 Ward 슬롯 등급에 연동(`base = damage × 8`, Ward 슬롯 T1~T5 배율 ×1.00~×2.00 그대로 곱연산 적용, `balance-sheet.md` companion-equipment-tier 기존 배율 재사용). 이전 설계는 방어 투자와 무관하게 `formationIntegrity`가 고정값이라 "무투자가 항상 최적"이라는 결함이 수식으로 확정돼 있었으나, Ward 슬롯 연동 시 무투자 동료는 기본값(×1.00, damage×8)에 머물고 완전투자 동료는 2배(damage×16) 생존 → 조기 DOWNED로 인한 후열시너지(+25%bp) 손실 위험이 무투자 쪽에 실제로 부과된다. **이것으로 PRED-09가 완전 해소됐다고 주장하지 않는다** — "버스트 딜로 죽기 전에 끝내는" 전략이 그래도 우월한지는 Stage 2 실측 없이는 모른다. 레버가 존재하지 않던 상태에서 레버가 존재하는 상태로 바뀐 것만 확정.

## D8 — 외부 워크스트림 캐논 위반 자산 (C1 참조): WAIVE-NOT-APPLICABLE-TO-THIS-GATE + 하드 커밋 차단 플래그

**충돌**: 별도 codex-cli 세션이 이번 run-id 워크스페이스와 `assets/images/battle/pilot/`에 `sungjinwoo`/`monarch` 등 Solo Leveling 원본 음역이 파일명·내부ID에 남은 콘셉트 자산을 기록(`conflicts.md` C1 전체 사실관계 참조). 이 디렉터가 소환하지 않은 제3자 프로세스이며, 그 자산의 archetype displayName 자체는 원화명으로 설계돼 있으나 파일명 레벨에서 원본 음역이 새어나왔다.

**판정 근거**:
1. **이번 사이클 G1 게이트 범위 밖**: G1은 "player-visible content"(실제 배포되는 문자열/이펙트/시나리오)를 감사 대상으로 한다(`quality-gates.md` G1 "QA audit pass over all player-visible content"). 해당 자산은 untracked·미커밋·미배포(Pages allowlist 밖) — 플레이어에게 노출된 적이 없으므로 G1 실측 대상이 아니다. **G1 draft를 이 사유로 FAIL 처리하지 않는다.**
2. **그러나 침묵 방치는 금지**: `main_constraint #4`(무차용 명칭 경계)를 위반하는 자산이 저장소 워킹트리에 실존하는 것은 사실이며, 이 디렉터가 발견하고도 기록하지 않으면 다음 세션이 이를 무의식적으로 커밋할 위험이 있다.
3. **디렉터는 타 워크스트림 파일을 임의로 이름변경/삭제하지 않는다** — `production/boss-motion-previs-action-pipeline.json`의 `transitionMatrix`·`bossAliases`가 정확한 파일명(`concept-sungjinwoo-boss.png` 등)을 참조 체인으로 물고 있어, 이 디렉터가 그 워크스트림의 진행 상태·다음 스테이지 계획을 모른 채 파일명을 바꾸면 진행 중인 별도 파이프라인을 깨뜨릴 수 있다.

**판정: WAIVE-NOT-APPLICABLE(이번 G1 게이트에 대해) + 하드 커밋 차단 플래그.** `conflicts.md` C1에 사실관계 전량 기록 완료. **커밋/배포 전 필수 조치**: (a) `concept-sungjinwoo-boss.*`→`concept-{archetype}-boss.*`(archetype id, 예: `concept-sung-hum-boss.*`) 또는 확정된 originalized displayName 기반 파일명으로 전면 개명, `monarch`→`shadow-commander`류 이미 존재하는 non-IP 별칭으로 통일, 관련 previs sidecar·pipeline 참조까지 일괄 갱신 (b) `boss-concept-prompt-pack.json`의 자체 `antiCopyrightConstraints`를 파일명·내부ID 레벨까지 적용 범위를 넓히도록 그 워크스트림 소유자가 갱신. 이 조치 없이 커밋되면 다음 세션의 G1 실측은 반드시 FAIL.

## D9 — 킹샷 "거점 방어" 축 누락 발견 및 보강: 저지선 구역(Undertow Encroachment)

**발견**: 사용자가 "킹샷의 디펜스 요소가 어떻게 들어간건지" 질의 → 15개 레인·`shared-reference-bundle.md` 전체 재검색 결과 `siege`/`invasion`/`침공`/`방어해야` 0건 확인. 원인 추적: 디렉터 본인이 작성한 `shared-reference-bundle.md` Source 2 요약이 킹샷의 "Town/keep growth"(성장)만 기록하고 "Defend Against Invasions"(방어)는 누락 — QABenchmarkSurvey 레인이 나중에 독립적으로 공식 앱스토어 설명(iTunes Search API)에서 발견했으나, 그 시점엔 이미 세계관/코어루프 레인이 병렬 완료된 뒤라 반영되지 못함.

**판정**: 사용자 승인(옵션 2 선택) 하에 **저지선 구역(Undertow Encroachment)**을 Farwatch Hold 5번째 기능구역으로 추가. 설계 근거:
1. 킹샷 원본은 오프라인 실시간 침공 시뮬레이션이나, 이는 `.survey/abyssal-command-systems-expansion/`의 기존 경계(백그라운드 전투 시뮬레이션 금지)와 정면 충돌 — 문자 그대로 이식 불가.
2. 대신 기존 `settleIdleReturn()`(`campaign-state.js`)과 동일한 **결정론적 단일 정산** 패턴으로 재해석: `wardLevel`(기존 필드에서 파생, 신규 자원 불필요) vs `pressure`(오프라인 경과시간 비례, 기존 idle 상수 재사용) 비교 → HELD/ENCROACHED.
3. ENCROACHED 결과는 idle 진행도 적립 보류만 — 동료/장비/영구성장 손실 없음(기존 "완전 상실 없음" 원칙과 동일 선상), 다음 스테이지 승리로 자동 복구(기존 DOWNED 리셋 패턴 재사용).
4. 예산 40/41/10 세트, R3 fire-time 승수 체인 어디에도 관여하지 않는 순수 hub 레이어 부가 시스템 — 기존 밸런스 거버넌스를 재개할 필요 없음.

반영 파일: `design/worldview.md`(추가절+동사체인 갱신), `design/UNIFIED-GDD.md`(§1.2 표+신규 §1.4), `design/balance-sheet.md`(YAML 블록).

## D10 — Bound Fragment 공급 규칙 확정: 정예 종류 무관, 보스 처치 1회당 1개 고정

**발견**: 사용자의 "Stage 2→10 진행 심화" 요청에 따라 실제 `defense-catalog.js` STAGES 데이터를 `captureElite()` 로직과 대조 계산한 결과, `design/lane-rpgsystems.md` §4.4가 암묵 전제한 "반복 정예 처치 시에만 Bound Fragment 지급" 해석을 그대로 적용하면 캠페인 10스테이지 중 실제 반복 정예는 4회뿐(신규 동료 해금 6회, 반복 4회 — `captureElite()`가 반복 캡처 시에만 `evolution`+1). `balance-sheet.md`가 확정한 "캠페인 예산 10" 전제와 4개는 불일치.
**판정**: **정예가 신규 해금이든 반복이든 무관하게, 보스 처치 1회당 Bound Fragment 1개 고정 지급**으로 규칙을 명확화(`balance-sheet.md`가 이미 "보스 처치 1회당 1개, 스테이지당 1회"라고 적어뒀던 원안 그대로 채택 — 반복 조건은 애초에 명문화된 적 없었고 이번에 실측으로 모호성만 제거). 10스테이지 완주 시 정확히 예산 10 확보, 장비 슬롯 1개가 캠페인 종료 시점에 정확히 T5 도달(§`stage-progression.md` §3).
**반영**: `design/stage-progression.md` §3/§5.

## D11 — Stage 1 페이싱 과다주장 정정: Tier-1 노드는 Stage 1에서 구매 불가

**발견**: 동일 실측 과정에서 `design/UNIFIED-GDD.md` §8(PMForecast 페이싱 표 기반)의 "Stage 1 PEAK = Tier-1 분기 1개 선택"이 실제 자원 곡선과 모순됨을 발견 — Stage 1 종료 시 누적 Echo Core는 4(정예1+보스3), Track A 최저비용 노드(echo-backlash/wardens-ward)는 각 5. **Stage 1 시점엔 노드를 살 수 없다.**
**판정**: 페이싱 서술 정정 — Stage 1 = 스킬트리 UI 최초 노출(양쪽 브랜치 존재 학습, 구매는 아직 불가) / **Stage 2 종료 시(누적8) = 실제 첫 노드 구매 가능 시점**. `design/UNIFIED-GDD.md` §4.6에 정정 사실을 기록, §8 페이싱 표 자체는 다음 병합 시 이 정정에 맞춰 갱신 필요(이번 사이클은 §4.6 정정 노트로 대체, §8 표 직접 수정은 표 전체 재구성이 필요해 `stage-progression.md`를 단일 진실 소스로 지정).
**반영**: `design/stage-progression.md`(정본), `design/UNIFIED-GDD.md` §4.6(정정 노트+상호참조).

## D12 — §8 페이싱 표 자가발생 모순 발견 및 정정: Class 열 YAML 역행, Stage 8 EP-5 위반

**발견**: D11 반영 과정에서 §8 표를 "구매 가능 시점" 기준으로 전면 재구성했는데, 이것이 표 바로 위의 `pacing_rhythm` YAML(peak=[1,3,5,7,9,10]/trough=[2,4,6,8], 9-10만 유일한 인접 더블피크)과 정면 모순되는 결과를 낳았다 — Stage 2/4/6이 PEAK로, Stage 3/5/7이 TROUGH로 뒤집혀 7-peak/3-trough 구조가 되고 6-7이 새 인접 더블피크로 생겨 "9-10만 유일한 예외"라는 YAML 주석과 제 디렉터 노트 자체가 거짓이 됐다(외부 검수로 지적받음, 1차 응답에서는 "이미 해소됨"으로 오판했다가 재검토 후 실제 결함으로 재확인). 별도로 Stage 8 "스탯 재분배 창"이 §7.1 EP-5("비가역·리스펙 없음, Stage2 안건")와 정면 모순되는 것도 같은 편집에서 발견됨.
**근본 원인**: PEAK/TROUGH는 PMForecast가 설계한 "신규 구조 노출 vs 기존 구조 소비"라는 참여 리듬 축이며, D11이 정정을 요구한 "구매 가능 시점"은 별개의 축(Track A/B 셀 텍스트에만 속함)이다. 두 축을 혼동해 Class 자체를 재도출한 것이 오류.
**판정**: Class 열을 YAML 원본 그대로 복원(`eval`로 10행 전수 대조, 불일치 0건 확인). D11의 구매-불가 사실은 Track A 셀 텍스트로만 국한. Stage 3의 무효화된 "슬롯+1" 언락은 `defense-catalog.js` 실측(첫 Support 역할 해금, throne-echo)으로 대체 — 임의 창작 아님. Stage 8 리스펙 문구는 EP-6(장비강화)로 교체, 리스펙 시스템 자체는 여전히 §12 미해결 항목으로 유지(도입하지 않음).
**교훈**: 외부 검수의 1차 지적("2번은 이미 해소됨")을 재검증 없이 받아들였다가 재지적을 받고서야 실제 결함을 확인했다 — 표 재구성처럼 여러 필드가 얽힌 편집은 관련 열 전체를 재대조해야 하며, 부분 일치를 전체 해소로 오판하면 안 된다.
**반영**: `design/UNIFIED-GDD.md` §8 표 전체 재작성 + 정정이력 각주.

## D13 — D8 조치 범위 밖 잔존 위반 발견: `monarch` archetype 네임스페이스 + "Shadow Monarch" 직접 인용

**발견**: D8이 지시한 개명 조치(bossId 레벨: `concept-sungjinwoo-boss.*`→`concept-sung-hum-boss.*`, `concept-monarch-boss.*`→`concept-broken-court-monarch-boss.*`, previs sidecar 파일명)를 실행하던 중, `boss-concept-prompt-pack.json`의 `archetype` 필드(`sung-hum|shadow-soldier|player-core|monarch`)가 bossId와 **별개의 네임스페이스**이며 D8 지시 범위에 포함되지 않았음을 발견. 이 `monarch` archetype id가 콘셉트 배리언트 파일명 템플릿(`concept-{archetype}-{variant}.png`→`concept-monarch-v01.png` 등), motion-previs previsTag(`boss:monarch:{action}`), ElevenLabs sfx 큐 ID(`sfx_boss_monarch_*`)로 하위 전파되어 있었다. 방치했다면 이번 세션에서 신규 생성하는 16종 콘셉트 이미지 중 4종이 `concept-monarch-v0N.png`로 저장되어 **같은 종류의 위반을 재생산**할 뻔했다.

추가로 `aw-mo-v01`의 `promptEnglish`가 "Regent-grade **shadow monarch** archetype"으로 시작하는 것을 발견 — "Shadow Monarch"는 원작 주인공의 정본 칭호(각성 후 최종 계급명) 그 자체이며, `antiCopyrightConstraints`("no copied names... use original titles instead of source-character transliterations")를 프롬프트 텍스트 레벨에서 위반하고 있었다. archetype displayName(`Crown of the Broken Court`)은 이미 originalized였으나 실제 생성 프롬프트에는 그 originalize가 관철되지 않은, D8이 지적한 것과 동일한 구조의 결함.

**판정**: D8과 동일한 원칙 적용 — archetype id `monarch`→`broken-court-monarch` 전면 개명(파일명 템플릿·previsTag·sfx 큐 ID·promptSchema enum 포함), `shadow monarch` 문구→`broken-court ruler`로 재작성. 개명 후 실제 헤드리스 Blender(5.1.2, `/Applications/Blender.app`)로 previs 재베이크하여 산출물(`boss_previs_timings.json`, sidecar 4종) 일관성 확인 완료. 이 조치는 D8의 "커밋 전 필수 조치" 완료 조건에 실질적으로 포함되는 것으로 취급 — bossId 레벨만 고치고 archetype 레벨을 방치했다면 D8 판정 자체가 불완전했을 것.

**교훈**: 동일 콘텐츠에 대한 두 개의 독립적 ID 네임스페이스(bossId/archetype)가 존재할 때, 한쪽만 감사·개명하고 다른 쪽을 "관련 없음"으로 가정하면 안 된다 — 두 네임스페이스가 파일명 템플릿을 통해 실제로 하위 산출물에 합류하는지 반드시 추적해야 한다.

**반영**: `design/boss-concept-prompt-pack.json`, `production/{boss-motion-previs-timing,boss_previs_timings,storyboard-motion-sound-matrix,elevenlabs_sound_plan}.json`, `design/defense-rpg-cinematic-arc.md`, `production/boss_previs_workfile.blend`(재베이크).

## D14 — 콘셉트 이미지 생성 중 발견: 프롬프트 선두 명사구가 타이틀 카드로 오인되어 텍스트 번인

**발견**: D13 개명 완료 후 16종 콘셉트 배리언트(4 archetype × v01-v04)를 god-tibo-imagen(`gti --provider codex-cli`, private-codex는 HTTP 429로 재차 폴백)으로 생성, 산출물 전수 육안 검수 중 `concept-broken-court-monarch-v02.png` 1건에서 "HIGH MONARCH SENTINEL" 타이틀과 "OBSIDIAN CEREMONIAL GAUNTLETS" 등 다수 캡션이 이미지 픽셀에 직접 번인된 것을 발견 — `promptSchema.generationContract.noText: true` 위반이자, 렌더된 라벨에 "MONARCH"가 그대로 노출되어 D13이 막으려던 것과 동일한 종류의 결함이 파일명이 아닌 이미지 데이터 레벨에서 재발.
**원인**: 해당 배리언트의 `promptEnglish`가 "High monarch sentinel with..."로 시작하는 타이틀-케이스 명사구였고, 말미의 "clear 2.5D comic-like readability" 지시가 결합되어 모델이 이를 캐릭터-시트/카드 레이아웃 요청으로 오인. 나머지 15건은 같은 배치에서 문제 없이 생성됨 — 이 프롬프트 하나의 구조적 특이점.
**판정**: 재생성 자체는 원 프롬프트("High monarch sentinel with...")에 ad-hoc no-text 네거티브(no titles/captions/labels/typography/infographic/callout boxes/watermark)만 즉석으로 덧붙여 실행 — 재생성 결과 텍스트 번인 없음 확인(`concept-broken-court-monarch-v02.provenance.json`의 `prompt` 필드가 이 실제 발신 문자열 그대로를 기록). **그 이후** `boss-concept-prompt-pack.json`의 `aw-mo-v02.promptEnglish`를 별도로 정본 재작성(타이틀-케이스 명사구 제거, "monarch" 대신 "broken-court sentinel" 사용, 동일 네거티브 상시 포함)했으나 이는 향후 재생성 시 회귀를 막기 위한 사전 조치일 뿐 — 이번에 실제 사용된 프롬프트가 아니므로 provenance sidecar는 pack 텍스트가 아닌 실제 발신 문자열을 기록한다(D12 교훈: 미검증 주장을 방치하지 않는다). 나머지 15건은 원 프롬프트 그대로 재사용(문제 없었으므로 무변경).
**교훈**: 이미지 생성 프롬프트의 negative 제약이 파일명·메타데이터 레벨에만 있고 프롬프트 원문 자체에 "no text"가 없으면, 스타일 지시어("readability", "card concept" 등)가 모델을 인포그래픽 레이아웃으로 유도할 수 있다 — 생성 완료 후 산출물 전수 육안 검수(파일명 검증만으로는 불충분)가 필수.
**반영**: `design/boss-concept-prompt-pack.json` (aw-mo-v02 promptEnglish), `assets/images/battle/pilot/concept-broken-court-monarch-v02.png` (재생성).

**Addendum (동일 QA 회차 중 별도 발견)**: 위 육안 검수 도중 provenance sidecar 16종을 작성하면서, `aw-sjh-v01.negative` 배열의 항목 "no exact replica of source **Jin-Woo** face/pose"가 원작 주인공 이름을 문자 그대로 포함하고 있음을 발견. 이 세션의 `concept-sung-hum-v01.png` 생성 호출은 이 배열을 사용하지 않고 손으로 요약한 별도 negative 문구를 사용했으므로 **이번에는 실제로 API에 전송되지 않았음**을 sidecar `note` 필드로 확인·기록했으나, 배열 자체가 pack에 남아있으면 향후 자동화된 재생성(예: `negative.join(', ')` 패턴)이 이 이름을 그대로 전송할 잠재 위험이 있었다. `boss-concept-prompt-pack.json`의 `negative` 항목을 "no exact replica of source protagonist face/pose"로, `sung-hum.category`를 형제 archetype과 동일한 originalized 패턴("Human hunter-commander archetype (originalized)")으로 각각 수정해 원천 제거. 반영: `design/boss-concept-prompt-pack.json` (`aw-sjh-v01.negative[2]`, `sung-hum.category`), `assets/images/battle/pilot/concept-sung-hum-v01.provenance.json` (`note` 필드로 미전송 사실 명시).

## D15 — World-content-pack Blender 자산 생성 중 발견: 캐논 리소스 팩 전역 텍스처 링크 결함 + 신규 지오메트리 인접성 결함

**배경**: 사용자 요청으로 Stage 4-10 지형(7종), 캐릭터(보스 7 + 동료 6), 아이템(리워드 프롭 3 + 장비타입 젬 5), VFX(기배포 텔레메트리 이벤트 5종 대응 6종) 총 202개 오브젝트를 파라메트릭 Python 빌더(`scripts/build-world-content-pack.py`)로 생성, 기존 `assets/models/abyssal-command/abyssal-command-resource-pack.blend`를 베이스로 헤드리스 Blender(5.1.2)에서 빌드.

**발견 1 — 캐논 리소스 팩 전역 결함**: 리뷰 렌더(Cycles, 결정론적 확인)에서 다수 오브젝트가 마젠타(Blender 표준 "broken shader" 폴백)로 렌더링됨. 근본 원인 추적 결과, 재사용된 캐논 머티리얼 9종(`Ash Cloth`/`Cinder Ember`/`Cold Steel`/`Cyan Rift`/`Gate Gold`/`Obsidian`/`Old Bone`/`Violet Ether`/`Void Obsidian`) 전량이 `Albedo`/`Normal Texture` 이미지 노드를 갖고 있으나, 참조 텍스처 파일(`textures/*.png`)이 저장소 어디에도 존재하지 않음(`assets/models/abyssal-command/`에 텍스처 디렉터리 자체가 없음) — **이번 세션 이전에 아무도 이 파일을 EEVEE/Cycles로 렌더링한 적이 없어(previs 파이프라인은 `.blend` 저장만 하고 렌더는 호출하지 않음) 발견되지 않은 채로 존재하던 결함**. 캐논 파일(`abyssal-command-resource-pack.blend`) 자체는 이번 세션에서 일절 쓰기 접근하지 않음(빌드는 읽기 전용 베이스로만 사용, `--out`으로 별도 워크스페이스 경로에 저장) — MD5/mtime 대조로 무변경 확인.
**판정**: 캐논 파일은 건드리지 않음(9개 텍스처 프로덕션 자체가 이 세션 범위 밖 + 다른 워크스트림이 참조 중인 공유 자산). 대신 `build-world-content-pack.py`의 `ensure_materials()`에 `_unlink_broken_image_textures()`를 추가 — 이미지가 없거나 디스크에 없는(`packed_file`은 예외) Image Texture 노드의 아웃고잉 링크만 끊어 Principled BSDF가 이미 올바르게 설정된 `default_value`로 폴백하도록 함. 재빌드 시마다 결정론적으로 자동 적용(1회성 수동 패치 아님). **후속 조치 필요**: 9개 텍스처 파일을 실제로 프로덕션하거나(권장) 머티리얼에서 텍스처 노드 자체를 제거하는 정본 결정은 캐논 팩 소유 워크스트림의 판단 사항으로 남김.

**발견 2 — 신규 지오메트리 인접성 결함**: 마젠타 해소 후 재렌더에서 `bridge-colossus`가 사지 연결 지오메트리 없이 어깨/주먹이 허공에 뜬 채 렌더링되는 등, 자체 제작 파라메트릭 지오메트리 다수가 부품 간 접촉 없이 배치된 것을 발견. 캐논 오브젝트(`warden-robe`/`warden-skull`, z-겹침 0.265) 대조로 "부품 간 실제 겹침"이 이 리소스 팩의 확립된 아트 컨벤션임을 확인(부유 실루엣은 스타일이 아니라 결함). 바운딩박스 인접성 분석 스크립트(`scripts/check-asset-adjacency.py`, union-find 클러스터링) 작성 후 30개 신규 컬렉션 전수 검사 — 11개 결함 발견, 개별 좌표 대조로 의도적 디자인(예: `shattered-causeway`의 붕괴 간극, `vfx-gate-breach-shockwave`의 방사형 파편, `equipment-tier-gems`의 5종 비교 진열대)과 실제 버그(목/팔 연결 누락, 소품 부유)를 구분해 9개 컬렉션 수정(`sunken-bastion`/`starless-canal`/`abyss-chancel`/`pack-herald`/`requiem-choir`/`bridge-colossus`/`veil-vanguard`/`dawnless-crown`/`abyssal-banner`). 소형 소품(할로 샤드, 오브 프롭, 태슬)은 바운딩박스 상 0.08 이내 간극도 자체 크기 대비 시각적으로 부유해 보임을 실제 렌더로 확인 — 전수 겹침(gap=0) 기준으로 전량 재수정.
**교훈**: 좌표 산술은 도구로 검증하고 신뢰할 것 — 이번 수정 과정에서 반경/전체너비 혼동, 스테일 베이스라인 재사용, AABB 단일축만 확인(3축 전부 필요) 등 3건의 손계산 오류를 직접 범했고, 매번 렌더 또는 수치 재측정으로만 발견됨. 최종 수정 전량은 pairwise gap=0.0000(수치 재측정)과 육안 렌더 재확인 양쪽으로 검증 완료.

**반영**: `scripts/build-world-content-pack.py`(머티리얼 언링크 로직 + 9개 지오메트리 좌표 수정 + 2개 신규 연결 오브젝트: 콜로서스 팔 2 + 쇄골 2, 뱅가드 방패암 1, 랜턴 포스트 2), `scripts/render-review-thumbnails.py`(신규, bbox 오토프레임 리뷰 렌더 유틸), `scripts/check-asset-adjacency.py`(신규, 인접성 QA 유틸), `_workspace/20260723-solo-warden-rpg-concept/production/world-content-pack.blend`(30 컬렉션/209 오브젝트, 재빌드로 재생성 가능).

## D16 — 사용자 요청 "내레이션/스킬 음성 재생성" 중 발견: 음성 프로필 시스템 전체가 미작동 상태였음 + 잔존 IP 유출 2건

**배경**: 사용자가 내레이션/스킬 음성을 성우톤으로, 특히 스킬은 플레이어의 단호함·결연함을 표현하도록 재생성 요청.

**발견 1 — `pickVoiceForProfile`/`genTextToSpeech` 필드명 불일치로 `voiceProfiles`의 개별 설정이 전량 무시됨**: `scripts/generate-audio.mjs`(구 `tmp/generate-audio.mjs`)의 `parsePlan()`은 narration/state/skill 아이템에 `.voiceProfile`(프로필명 문자열)을 세팅하는데, `genTextToSpeech()`는 `.voiceId`만 읽었다 — 조건이 항상 거짓이 되어 모든 아이템이 즉시 하드코드 폴백(단일 음성 `onwK4e9ZLuTAKqWW03F9` + 고정 `stability=0.4/style=0.5/speed=1.0`)으로 직행했다. 결과: 기존 94개 음성 클립(내레이션 17 + 스킬 7 + 상태 7 + NPC 다수) 전량이 `voiceProfiles`가 정의한 프로필별 톤 차이(내레이터 vs playerStatus vs NPC 3종) 없이 완전히 동일한 설정으로 생성돼 있었다. 부가로 `voiceProfiles.*.voiceId`가 전부 `V1_*` 플레이스홀더였던 것도 확인(`pickVoiceForProfile`이 이를 감지해 fallback 처리하도록 설계돼 있었으나, 애초에 `.voiceProfile` 필드를 안 읽으니 이 로직 자체에 도달하지 못함).
**판정**: `genTextToSpeech`가 `item.voiceProfile || item.voiceId`를 읽도록 수정(NPC 아이템과의 하위호환 유지). `voiceProfiles`에 실제 ElevenLabs voice ID 배정 — `narrator`는 기존 클립이 전부 사용해온 `onwK4e9ZLuTAKqWW03F9`(Daniel) 유지(음성 자체 교체가 아니라 마침내 authored 설정이 실제로 반영되게 하는 수정), 스킬 전용 신규 프로필 `playerCombat`을 `TxGEqnHWrfWFTfGW9XjX`(Josh)로 추가해 내레이터와 음색을 분리. 설정값은 ElevenLabs 권장 안정 구간(낮은 stability + 높은 style 조합은 cross-lingual 생성에서 불안정 위험, 특히 영어 프리메이드 음성의 한국어 생성) 내로 보수적으로 설정, 강도 표현은 `speed`를 주 레버로 사용.

**발견 2 — narration/skill/state 텍스트에 원작(Solo Leveling) 주인공 실명 "성진우" 잔존**: `elevenlabs_sound_plan.json`의 `narr_intro_01`(TTS로 실제 음성 합성되어 배포 후보 자산에 포함되는 텍스트)과 `skillTriggerNarrations.player.attack`에서 발견. D8/D13이 처리한 파일명·archetype 레벨 유출과 별개로, 이번엔 **실제 발화 텍스트 레벨** 유출 — previs/파일명보다 심각도가 높다(TTS로 합성되면 음성 데이터 자체에 실명이 담긴다). `design/defense-rpg-cinematic-arc.md:109`(모션 바인딩 키 개발자 주석)에도 동일 실명 발견.
**판정**: 전부 세계관 확립 정본 호칭 **Dusk Warden**(`design/worldview.md` 등 15개 레인이 이미 사용 중인 이름)으로 교체. `narr_intro_01`은 단순 치환이 아니라 전면 재작성(아래 발견 3 참조로 길이도 함께 축소).

**발견 3(재생성 과정에서 파생 발견) — 컷 오디오 예산 대비 실측 미검증**: `narr_intro_01`/`narr_lobby_intro` 재생성 후 실측 duration이 각각 배정 컷(C01=8.0s, C02=10.0s) 예산을 17.55s(+119%)·10.53s(+5%) 초과하는 것을 발견 — 원 텍스트 분량이 애초에 8s/10s 안에 들어갈 수 없는 길이였는데, 이전까지 아무도 TTS 실측 duration을 컷 예산과 대조 검증한 적이 없었다(모든 컷 mix가 `-t {cutDur}`로 강제 트림되므로 초과분은 조용히 잘려나갈 뿐 에러가 나지 않는다 — 발견되지 않은 채로 존재할 수 있는 결함군).
**판정**: 두 클립 모두 텍스트 축소 재작성(C01: 96→39자, C02: 70→48자) 후 실측 재검증(마진 22-35%). 나머지 15개 기존 내레이션 클립도 전수 재측정해 전부 컷 예산 내(마진 8.9-55.6%) 확인. **후속 권고**: 향후 신규 내레이션 작성 시 이 세션에서 실측한 내레이터 평균 발화 속도(약 5.8자/초, eleven_multilingual_v2 기준) 대비 목표 컷 길이의 85-90%를 문자수 상한으로 잡을 것 — 정확한 사전 계산은 모델 stochasticity(동일 텍스트/설정 반복 생성 시 실측 편차 최대 ±8%, 이번 세션 5회 반복 테스트로 확인) 때문에 불가능하니 반드시 생성 후 재측정.

**발견 4(부수, 이번 세션 내 앞선 작업의 재확인)** — 비디오 파이프라인 오디오 시퀀싱 버그: 이번 음성 재생성 이전에 같은 세션 안에서 이미 발견·수정 완료된 건(2컷 이상 파트의 오디오가 t=0부터 겹쳐 믹스되던 버그, `vox-director_video_pipeline.md#버그수정-이력` 참조) — 음성 재생성으로 인한 전체 파이프라인 재실행(`--all --force`) 후에도 15개 파트 + 12개 concat 산출물 전부가 매니페스트 duration과 정확히 일치함을 재검증해 회귀 없음 확인.

**검증 범위와 한계**: duration/RMS 레벨/피크 클리핑/무음비율은 전량 실측 검증(클리핑 0건, 피크 26-61%, RMS -22~-27dB, 무음비율 21-39% — 전부 정상 발화 범위). **실제 음성 품질(자연스러움, 발음, 감정 전달)은 청취 없이 검증 불가** — 이 세션은 duration/레벨/생성 성공 여부만 실측 확인했고, "성우톤으로 결연함을 표현"이라는 정성적 목표의 실제 청취 검수는 사용자 또는 후속 세션 필요.

**반영**: `scripts/generate-audio.mjs`(신규 위치, 구 `tmp/generate-audio.mjs`에서 이동 + `.voiceProfile` 필드 버그 수정), `production/elevenlabs_sound_plan.json`(voiceProfiles 6종 전체 재설정, `playerCombat` 신규 추가, narr_intro_01/narr_lobby_intro 텍스트 축소, skillTriggerNarrations 7종 전면 재작성), `design/defense-rpg-cinematic-arc.md:109`(IP 유출 수정), `assets/audio/elevenlabs/narration/*.mp3`(17종 재생성), `assets/audio/elevenlabs/skill/*.mp3`(7종 재생성), 비디오 파이프라인 전체 재실행 산출물(15 parts + 12 concat + 15 dtsfix).

**D16 정정 (사용자 요청 "실제 생성되어 교체되었는지 검증" 중 발견) — `OUT_BASE`가 저장소 루트로 잘못 resolve되어, 위 "발견 1-4"의 재생성이 실제로는 배포 경로에 반영되지 않았음**:

**발견 5(치명) — `scripts/generate-audio.mjs`의 `OUT_BASE`가 하드코드로 `resolve(ROOT, 'assets/audio/elevenlabs')`(저장소 루트)였고, `ROOT`는 스크립트 파일 위치 기준으로 계산되어 `--matrix` 인자·`matrix.artifactRoot`와 무관하게 항상 저장소 루트를 가리켰다.** 반면 비디오 파이프라인(`vox-video-pipeline.mjs`)·사운드플랜(`elevenlabs_sound_plan.json`의 `outputConfig.path`)·오디오 매니페스트는 전부 `_workspace/20260723-solo-warden-rpg-concept/assets/audio/elevenlabs/`(워크스페이스 경로)를 기준으로 동작한다. 결과: 위 D16 본문의 재생성 24개 클립(내레이션 17 + 스킬 7)이 실제로는 저장소 루트의 별도 트리에 기록됐고, 비디오 파이프라인이 실제로 읽는 워크스페이스 경로의 파일은 세션 시작 전 원본(`narr_intro_01`=14.81s, "성진우" 포함, `skill.player.attack`=원본 3인칭 기계적 문구)이 그대로 남아있었다. 이 세션의 duration 재검증 셀들도 동일한 저장소 루트 기준 상대경로(`pathlib.Path('.')`)를 사용해 자기 자신과만 대조하는 착시 검증이었다 — 실제로 배포될 워크스페이스 경로 파일은 한 번도 검증되지 않았다. **"D16 판정"/"반영" 문구가 주장한 재생성·재검증은 저장소 루트의 고립된 트리에 대해서만 사실이었고, 실제 산출물 경로에는 반영되지 않은 상태로 커밋 전 상태를 방치할 뻔했다.**
**판정**: `OUT_BASE`를 `let` 바인딩으로 변경, `main()`에서 `matrix.artifactRoot`(사운드플랜과 동일한 소스 오브 트루스)를 읽어 재계산하도록 수정 — `matrix.artifactRoot`가 이미 `_workspace/20260723-solo-warden-rpg-concept`로 정확히 선언돼 있음을 확인 후 그대로 사용. 저장소 루트에 잘못 생성됐던 `assets/audio/elevenlabs/`(94개 클립, ambience/bgm/combat/narration/npc/sfx/skill/state 8개 카테고리 전량 — 이번 세션 이전의 원본 생성분까지 포함해 이 버그가 오래된 결함이었음을 시사) 전체를 삭제(라이브 게임 엔진 어디에서도 참조되지 않음을 `defense-audio.js`/`app.js`/`index.html`/`sw.js`/`defense-catalog.js` grep으로 확인 후 삭제). 수정된 스크립트로 내레이션 17종 + 스킬 7종을 워크스페이스 경로에 정확히 재생성(경로가 결과 로그에 `_workspace/...`로 정확히 기록됨을 확인), 비디오 파이프라인 전체 재실행(`--all --force`), dtsfix 15종 재생성, duration 전량 재검증(15 parts + 12 concat 매니페스트와 정확히 일치).
**실제 콘텐츠 검증(청취 대체 수단)**: 이전 판정의 "청취 없이 검증 불가" 한계를 로컬 Whisper(openai-whisper, small→ambiguous 1건은 medium으로 재확인)로 부분 해소 — 워크스페이스 경로의 실제 파일 9종(내레이션 2 + 스킬 7)을 전사해 authored 텍스트와 대조, 렌더링된 `part_intro.mp4`에서 오디오를 추출해 별도 전사. 결과: 9/9 텍스트 일치(구두점 차이 제외), "성진우"/"Jin-Woo" 0건, `narr_intro_01`이 "다스(트)워든"(Dusk Warden의 한국어 음역)으로 정확히 전사됨, 렌더링된 최종 산출물(`part_intro.mp4`)에서도 동일 확인 — 소스 자산과 최종 배포 산출물 양쪽에서 실제 콘텐츠 교체를 실증.
**교훈**: "duration이 일치한다"는 검증은 **콘텐츠가 맞다는 증거가 아니다** — 오래된 오디오도 우연히 같은 길이 예산에 맞을 수 있고(이번 케이스가 정확히 그랬다), 파이프라인의 강제 트림(`-t`/`atrim`)은 어떤 오디오가 들어가든 목표 길이로 잘라내므로 "성공"처럼 보이는 duration 매치가 잘못된 소스를 완전히 가릴 수 있다. 경로 관련 버그는 특히 위험하다 — 스크립트가 에러 없이 "성공" 종료해도 엉뚱한 곳에 쓰고 있을 수 있다. 상대경로(`pathlib.Path('.')`)로 검증 셀을 작성하면 실행 환경의 cwd에 따라 검증 대상 자체가 바뀔 수 있으므로, 앞으로 이런 교차검증에는 항상 명시적 절대/워크스페이스 상대경로를 사용하고, 가능하면 실제 배포/소비 경로(이번 경우 `_workspace/.../assets/...`)를 하드코드해 대조할 것.
**반영(정정)**: `scripts/generate-audio.mjs`(`OUT_BASE` let 바인딩 + `matrix.artifactRoot` 기반 재계산), 저장소 루트 `assets/audio/elevenlabs/` 트리 삭제(버그 산출물, 라이브 게임 미참조 확인 후), `_workspace/20260723-solo-warden-rpg-concept/assets/audio/elevenlabs/narration/*.mp3`(17종, 올바른 경로에 재생성 확인), `_workspace/20260723-solo-warden-rpg-concept/assets/audio/elevenlabs/skill/*.mp3`(7종, 올바른 경로에 재생성 확인), 비디오 파이프라인 전체 재실행 산출물(15 parts + 12 concat + 15 dtsfix, 올바른 소스 오디오 기준으로 재생성).

## D17 — `battle-realtime-three.js` 검증 요청 중 발견: "WebGL 렌더러"가 실제로는 Canvas2D를 3D처럼 그리던 코드였음 + 관련 3개 테스트 파일의 "assets/models 영구 금지" 구시대 불변식

**발견**: 사용자가 "battle-realtime-three.js가 진짜로 three.js/WebGL을 쓰는지 검증하라"고 요청. 실제로 읽어본 결과 `RealtimeBattle` 클래스가 `canvas.getContext('2d')`를 사용하며 `arc`/`fillRect`/`translate` 등 순수 Canvas2D API만 호출 — 파일명과 클래스 doc-comment는 "WebGL"을 주장했지만 실제 구현은 `battle-visualizer.js`(진짜 Canvas2D 폴백)와 동일한 그리기 기법이었다. 테스트 스위트(`defense-renderer-contract.test.mjs`, `world-presentation-contract.test.mjs`)도 이 착시를 그대로 반영 — 두 어댑터를 동일한 mock Canvas2D context로 테스트하며 `arc`/`fillText` 호출 존재를 assert하고 있었다.

**판정**: `battle-realtime-three.js`를 실제 `THREE.WebGLRenderer`/`Scene`/`PerspectiveCamera`/`GLTFLoader` 기반으로 전면 재작성. 기존 공개 계약(`mount`/`renderSnapshot`/`dispose`/`onVisualFeedback`/`debugMetrics`, app.js의 try-RealtimeBattle-catch-BattleVisualizer 폴백 패턴)은 무변경 유지 — WebGL 컨텍스트 생성 실패 시 `mount()`가 throw하는 것이 이제 이 폴백의 실제 트리거 조건이 됨(구현 세부사항이 아니라 계약으로 취급, 전용 테스트 추가). 좌표계는 구 Canvas2D 렌더러의 `screenPoint()`/`terrainPoint()`가 쓰던 것과 동일한 dual-mode 휴리스틱(정규화 `[-1,1]` 또는 raw arena 0-24000 자동 판별)을 그대로 이식 — 처음엔 이를 놓쳐 "커맨더/적이 전부 원점 근처에 뭉쳐 렌더"되는 회귀를 브라우저 실측으로 발견, 재조사 후 수정.

**부수 발견 1 — vendor 파일 bare specifier 버그**: CDN에서 그대로 복사된 `vendor/loaders/GLTFLoader.js`와 그 하위 2개 유틸 파일이 `from 'three'`(npm 패키지 bare specifier)를 사용 — 브라우저는 `index.html`의 `<script type="importmap">`으로 해석 가능했지만, `node --test`를 포함한 순수 Node 환경은 해석 불가(`ERR_MODULE_NOT_FOUND`). 이 상태로는 CI(`node --test tests/...`)가 전면 실패했을 것 — 상대경로(`from '../three.module.js'`)로 수정, 이제 importmap 자체가 사장 코드가 되어 `index.html`에서 제거.

**부수 발견 2 — 3개 테스트 파일의 "assets/models 영구 금지" 구시대 불변식**: `release-closure.test.mjs`(PAGES_RUNTIME_PATHS 정규식)와 `defense-asset-manifest.test.mjs`(row별 assert)가 `assets/models`를 절대 retain하지 못하도록 하드코딩 — git 이력 추적 결과 커밋 `141b8f7`("feat: ship abyssal defense survivor campaign")가 **다른 GLB 경로 체계**(`assets/models/abyssal-command/props/*.glb`, RTS 시절 유산)를 완전히 제거하며 남긴 "이제 모델은 다시 안 씀" 일회성 불변식이었다. 이번 3D 마이그레이션은 그 불변식이 막으려던 대상이 아니라 완전히 별개의, 프로덕션 문서(`motion-previs-and-blender-execution-plan.md`)가 명시적으로 산출·배포 대상으로 지정한 42개 GLB(`assets/models/battle/*`) — 두 파일 모두에서 해당 assert만 정밀 제거, 나머지 진짜 유효한 retired-surface 가드(react-game-ui/minimap/battle-field 등)는 무변경 유지.

**부수 발견 3 — 테스트가 검증하는 대상 자체가 어댑터별로 근본적으로 달라짐**: RealtimeBattle이 진짜 WebGL이 되면서 BattleVisualizer(Canvas2D)와의 "동일 렌더 어댑터" 가정이 깨짐 — 특히 포틀레이트 라벨 counter-rotation 테스트(canvas `fillText`/rotation matrix 검증)는 3D 배틀 캔버스에 대응 개념이 없음(해당 월드맵 텍스트 정보는 DOM/CSS "stage-atlas" 패널로 이미 별도 존재, `world-presentation-browser.cjs`가 실 브라우저로 검증). RealtimeBattle에 mock 없이 진짜 THREE.Scene/Camera/Group을 직접 구성해 WebGLRenderer 하나만 우회하는 하네스를 도입 — reconcileActors/updateCamera/ensureStageTerrain의 실제 로직을 Node 환경에서 검증(가짜로 통과시키는 게 아니라 진짜 실행).

**교훈**: 파일명·클래스 doc-comment·존재하는 테스트 스위트가 모두 "이건 WebGL이다"라고 말해도, 실제 `getContext()` 호출 한 줄을 확인하기 전까진 참이 아니다 — 사용자가 명시적으로 "검증하라"고 요청한 것이 정확히 옳았다. 또한 과거 세션이 "다시는 이러지 마라"는 취지로 작성한 불변식(`assets/models` 금지)은 그 세션의 특정 컨텍스트(RTS 시절 GLB 경로)에 묶여 있을 수 있으므로, 재도입 시 프로덕션 문서의 명시적 의도와 대조해 재평가해야 한다 — 맹목적으로 유지하면 정당한 신규 작업을 막고, 맹목적으로 삭제하면 실제 회귀를 놓친다.

**반영**: `battle-realtime-three.js`(전면 재작성), `vendor/loaders/GLTFLoader.js`+`vendor/utils/{BufferGeometryUtils,SkeletonUtils}.js`(상대경로 수정), `index.html`(importmap 제거), `tests/defense-renderer-contract.test.mjs`+`tests/world-presentation-contract.test.mjs`(전면 재작성), `tests/defense-asset-manifest.test.mjs`+`tests/release-closure.test.mjs`+`tests/pages-artifact-smoke.cjs`(assets/models 불변식 완화 + GLB/vendor 경로 등록), `.github/workflows/static.yml`+`scripts/defense-runtime-assets.mjs`+`sw.js`+`assets/defense-asset-manifest.json`(배포 배선), 브라우저 실측 스크린샷(로비→전투→3D 렌더 확인, GLB 네트워크 요청 13건 확인).

## D18 — 사용자 요청 "동료 3종 + 아이템 2종 추가" — 신규 콘텐츠 전량 파이프라인 관통 검증

**요청**: 플레이어 장식/아이템 스코프 명확화 인터뷰 후, 사용자가 "동료 3종(6→9) + REWARDS 신규 항목 + 완전한 3D 에셋" 확정. 범위: 아이템 규모(꾸미기 소품 다수 아님, 완전한 신규 카탈로그 항목) + GLB 모델 포함.

**설계**: `pack-warden`(vanguard, howling-sprawl 계보)·`lantern-reaver`(striker, starless-canal 계보)·`requiem-warden`(support, glass-necropolis 계보) — 기존 6개 동료가 스테이지 1-3 계보였던 것과 달리 신규 3종은 스테이지 4-10 세계관(이번 세션 `world-content-pack.blend`로 구축된 캐논)에서 계보를 취해 스토리 진행과 정합. REWARDS 신규 2종(`warden-lantern`: pickupRange 버프, `choir-ward-crystal`: critChanceBonusBp 버프)은 기존 kind:"modifier" 패턴을 따르되 신규 필드가 아닌 `applyOwnedRewards`에 이미 존재하던 `run.commander.pickupRange`/`critProfile.chanceBp`에 직접 후킹 — 신규 시뮬레이션 코드 불필요.

**검증**: COMPANION_ROLES 3역할×2명 구조가 테스트에 하드코딩되어 있는지(9번째 컴패니언 추가 시 깨질지) 먼저 확인 — 아니었다(모든 로직이 `Object.values(COMPANION_ROLES).flatMap(...)` 동적 순회, `app.js`의 로드아웃 UI도 `campaign.companionCollection`을 동적 순회). REWARDS/STAGE_REWARD_IDS도 동일하게 완전 동적 확인 후 데이터 계층 추가만으로 배선 완료.

**3D 파이프라인**: `build-world-content-pack.py`의 기존 6개 동료 빌드 패턴을 그대로 답습해 3종 추가 + 2개 아이템 프롭 + 10개 스테이지 전량 장식 소품 추가. 인접성 QA에서 신규 5개 컬렉션 전량 클린 통과(0 결함) — 기존 D15가 발견했던 것과 같은 종류의 부유/미연결 버그 없음, 첫 시도부터 클린. 재빌드 후 전체 38개 컬렉션(기존 33 + 신규 5) 재검증도 회귀 없음, 기존 2개 flagged(의도된 D15 예외)만 그대로 유지 확인.

**배포 배선 재현**: D16의 교훈(`assets/defense-asset-manifest.json`/`release-closure.test.mjs`/`pages-artifact-smoke.cjs`/`static.yml`/`sw.js`/`defense-runtime-assets.mjs` 6개소 결합)을 그대로 다시 적용 — 5개 신규 GLB(동료 3+아이템 2)를 6개소 전량 등록. 최초 패스에서 `release-closure.test.mjs`/`pages-artifact-smoke.cjs` 2개를 누락했다가 advisory로 재확인 후 즉시 보정(release-closure는 동일 리스트가 파일 내 2곳에 중복 존재 — RUNTIME_PATHS assert 세트 + `required` 픽스처 배열, 양쪽 다 갱신 필요).

**테스트**: 3개 병렬 서브에이전트(UpdateRoleTest/CompanionStatsCoverage/RewardEffectsCoverage)에 위임, 각자 IRC로 파일 소유권 조율(`rpg-catalog.test.mjs` / `defense-run-simulation-rpg.test.mjs` / `defense-run-simulation.test.mjs` 3파일 분리, 충돌 없음). 각 서브에이전트가 실제 teeth-test(의도적 회귀 주입 후 실패 확인, 원복 후 재통과 확인)로 assertion이 진짜 동작을 검증함을 자체 증명.

**반영**: `defense-catalog.js`(COMPANIONS 3종+REWARDS 2종+STAGE_REWARD_IDS), `rpg-catalog.js`(COMPANION_ROLES 3역할에 신규 멤버 추가), `defense-run-simulation.js`(pickupRange/critChanceBonusBp 필드 처리), `scripts/build-world-content-pack.py`(동료/아이템/장식 빌드 함수 확장), `battle-realtime-three.js`(COMPANION_MODELS), `app.js`(companionGlyph 3종 추가), `.github/workflows/static.yml`+`sw.js`+`scripts/defense-runtime-assets.mjs`+`tests/release-closure.test.mjs`(2곳)+`tests/pages-artifact-smoke.cjs`(5개 GLB 경로 전량 등록), `tests/rpg-catalog.test.mjs`+`tests/defense-run-simulation-rpg.test.mjs`+`tests/defense-run-simulation.test.mjs`(신규 테스트, 3개 서브에이전트 산출).

**브라우저 실측 스모크 테스트**: 로컬 정적 서버(no-cache 헤더 강제, Chromium HTTP 디스크 캐시가 이전 세션 응답을 heuristic-fresh로 재사용하는 문제 발견 — `Network.clearBrowserCache` CDP 호출로 해소)로 `campaign-state.js`의 `captureElite`/`setCompanionLoadout`을 직접 호출해 `pack-warden` 편성 세이브 시딩 → 리로드 → UI 확인(성장 패널에 "출전 편성 1/3 슬롯", 동료 탭에 "Pack Warden" 이름+◊ glyph+결속 표시 정상 렌더) → 실제 전투 진입 → `performance.getEntriesByType('resource')`로 `pack-warden.glb` 네트워크 페치 확인(21432 bytes) → `battle-realtime-three.js:192`(`COMPANION_MODELS[entity.companionId]`)가 시뮬레이션이 실제로 스폰한 `kind:"companion", companionId:"pack-warden"` 액터에서만 그 경로를 조회한다는 소스 확인으로 "GLB 페치=실제 시뮬레이션 스폰 증거" 인과관계 확정 → WebGL 컨텍스트+3D 씬 스크린샷 확보(콘솔 에러 0건).

**부수 발견 — `DefenseStorage.save(campaign)` 시그니처 오용 함정**: 스모크 테스트 중 `store.save(JSON.stringify(campaign))`(문자열)을 호출해 "Invalid defense campaign" 에러 — `save()`는 원본 캠페인 객체를 받아 내부적으로 `serializeCampaign()`(→`requireCampaign()`)을 호출하므로 사전 직렬화된 문자열을 넘기면 그 검증에서 실패한다(`defense-storage.js:123,186-189`). 이 API 오용은 프로덕션 코드 경로가 아니라 이번 세션의 임시 디버그 스크립트에서만 발생했으나, 향후 유사 디버깅 시 재발 방지를 위해 기록.

## D19 — 사용자 요청 "나머지 T-pose 생성+리깅, 실제 리소스 결선" 중 발견: 런타임 GLB 39/40 무발동 + 캐논 리소스팩 유실 + 5개 workspace 삭제 오판 + Rodin 다운로드 근본원인

**배경**: 사용자가 (1) 서브에이전트 교차검증 체계, (2) 남은 캐릭터 T-pose 생성+리깅(무료+상용게임 허용 도구: AccuRig/Mixamo, 크리처는 Tripo AI/Mesh2Motion), (3) game-studio-harness 문서 갱신, (4) 논-캐릭터 리소스의 실제 게임 결선, (5) 최종검증+git/Pages 푸시를 요청.

**발견 1 — Rodin 다운로드가 이번 세션(및 추정컨대 이전 세션) 내내 실패해온 근본원인**: Pack 섹션 다운로드 버튼을 반복 클릭해도 무발동이던 문제를, `document.elementFromPoint()`로 화면상 보이는 "Confirm" 버튼의 실제 렌더 좌표를 역산해 확인 — DOM에 텍스트가 동일한 "Confirm" 요소가 5개 존재했고(사이드바 카드 버튼, 숨겨진 opacity:0 트리거, 실제 Geometry 패널 버튼 등), 텍스트 매칭 셀렉터가 매번 다른(잘못된) 요소를 클릭하고 있었다. 실제 버튼은 `.group\/confirmBtn` 클래스로 식별 가능. 추가로 `download.saveAs()`/`download.path()`가 playwriter의 sandboxed fs 제약(cwd/`/tmp`/OS temp 외 쓰기 거부)으로 조용히 타임아웃되는 것도 발견 — `download.url()`이 반환하는 pre-signed HTTPS URL(`file.hyper3d.com/.../base.glb?X-Tos-...`)을 직접 `curl`로 받는 우회로 완전 해소.
**판정**: 위 두 발견을 결합해 s1-s5 5개 보스의 T-pose GLB를 실제로 확보(전량 glTF magic 검증 + SHA-256 상호 고유성 확인). s4는 T-pose 적용 전 Geometry가 이미 confirm되어 있었음이 밝혀져 재생성 대신 `.NOTPOSE.` 파일명 마커로 보존(31.5MB 고밀도 원본 — Blender 리포즈 후속 필요).

**발견 2 — `battle-realtime-three.js`의 40개 GLB 매핑 중 39개가 무발동 상태였음**: 직전 커밋(`0b50089`)의 커밋 메시지 자체가 "Only anchor-shard.glb currently has a real file on disk; the other ~40 mapped entries 404 and skip rendering gracefully"라고 이미 고지하고 있었다 — `loadGltf()`의 `.catch(() => { record.loading = false })`가 실패를 크래시 없이 삼키는 설계라, 이전 세션들의 "37개 결선"/"209 오브젝트" 주장이 룩업 테이블 키 매핑 완전성만 확인했을 뿐 실제 파일 존재·네트워크 로드는 검증하지 않았던 것으로 판명(task-manifest.md 해당 행에 취소선+정정 주석 추가). 근본원인 추적: 캐논 입력 `assets/models/abyssal-command/abyssal-command-resource-pack.blend` 자체가 디스크에 없었고, 그로부터 빌드된 `world-content-pack.blend`도 헤드리스 재확인 결과 52개 컬렉션 전부 0 오브젝트(빈 껍데기)였다.
**판정**: 동일 origin(`github.com/jellyggumi/Abyssal-Command`)의 형제 워크트리(`~/orca/Abyssal-Surge-3d-overhaul`, `~/orca/Abyssal-Surge-cycle2`)에서 캐논 팩을 복사(git 조작 아님, 순수 파일 복사 — 대상이 git 비추적 바이너리라 checkout 불가) → `build-world-content-pack.py` 재실행(260 오브젝트/36 컬렉션 재생성) → `export-battle-glb.py`를 정확한 런타임 경로(`assets/images/battle/glb/`, 기존 `assets/models/battle/` 기본값과 다름을 소스 확인 후 override)로 재실행 → 40/40 GLB 신규 export, 전량 glTF magic 검증 통과. 헤드리스 정적 서버+실 브라우저(headless Chromium)로 최종 검증: 로비→전투 시작→WebGL 컨텍스트 확인→네트워크에서 dusk-warden/cinder-span/scout/shade 4종 200 확인→스크린샷으로 cinder-warden 보스(별모양 지오메트리)+테레인+VFX 링 실제 렌더 확인.

**발견 3 — 디스크 압박(92% 사용) 정리로 삭제된 것으로 추정되는 workspace 5개 중, "커밋 메시지가 ship이니 안전"이라는 최초 판단이 실제로는 틀렸음**: `_workspace/20260716-abyssal-surge-revision`, 20260716- 접두사의 또 다른 구 run-id 디렉토리(이후 정본 세계관으로 완전히 대체된 초기 컨셉 스캐폴딩, no-rts-closure 테스트의 EXCLUDED_PREFIXES에 이미 등재된 접두사), `20260722-abyssal-command-bmad-gds-expansion`, `20260722-abyssal-command-vertical-slice-implementation`, `20260722-defense-survival-expansion` 5개가 unstaged 삭제 상태(git status: 447 D)로 발견됨. 각각의 마지막 커밋이 "ship"/"feat" 완료 커밋이라는 이유로 "안전한 정리"로 최초 판단했으나, 전체 테스트 스위트 실행 결과 `20260722-abyssal-command-bmad-gds-expansion`(G2 fixture 10개 테스트) + `20260722-abyssal-command-vertical-slice-implementation`(no-rts-closure 1개 테스트) + `20260722-defense-survival-expansion`(동일 테스트의 다른 fixture) 3개가 실제로 코드/테스트 의존성을 갖고 있어 삭제가 11개 테스트를 깨뜨리고 있었음이 드러남.
**판정**: 판단 오류를 인정하고 `git ls-files -co --exclude-standard`가 tracked/untracked로 보고하는 모든 경로를 디스크 존재 여부로 전수 재검증(단발성 grep이 아니라). 총 28개 파일(3개 workspace 디렉토리 전체 + `assets/images/battle/{dusk-warden,echo-rusher}-*` 20개 + pilot concept 4개 + `abyssal-command-resource-pack.glb` + smoke mp4 + `animation-manifest.json`)을 형제 워크트리에서 복구, 전량 `git diff HEAD` 0(완전 일치)로 안전성 확인 후 반영. `20260716-*` 2개는 코드/테스트 참조 0건 확인 후 삭제 상태 유지 — 전부를 무비판적으로 되살리지 않고 실제 의존성 유무로 개별 판정.
**교훈**: "마지막 커밋이 ship이었다"는 휴리스틱은 그 커밋이 대상 디렉토리의 *모든* 내용을 산출물로 흡수했다는 것을 보장하지 않는다 — QA fixture나 테스트 전용 자산처럼 "산출물"이 아니라 "검증 도구"인 파일은 ship 이후에도 여전히 살아있는 테스트가 참조할 수 있다. 삭제 안전성 판단은 커밋 메시지가 아니라 실제 코드베이스 grep + 테스트 실행으로만 확정해야 한다.

**발견 4 — G2 fixture 1건은 진짜 복구 불가로 확인**: `g2-prepared-prerequisite-bindings-v1.json`은 git 히스토리 어디에도 자신만의 커밋이 없고(다른 fixture들과 달리), 형제 워크트리 2곳에도 존재하지 않음 — 위 발견 3의 복구 절차로도 닫히지 않는 진짜 유실.
**판정**: 위조하지 않고 `existsSync` 가드 + 사유가 명시된 `test(..., { skip: "..." })`로 처리(코드에 자기설명 남김, decision-log 상호참조). 영구 red 스위트로 방치하지 않되 거짓 green으로도 만들지 않음.

**발견 5 — 리깅 도구 4종(AccuRig/Mixamo/Tripo AI/Mesh2Motion) 조사 결과 하드 블로커 1개 확인(당초 2개로 오판)**: 서브에이전트 위임 리서치 결과, 22개(남은 17개+검토된 5개) 캐릭터 배치 규모에서 실제 자동화가 가능한 유일한 경로는 Tripo AI(REST API + `tripo3d` Python SDK, `animate_rig`가 휴머노이드/크리처 겸용, 네이티브 GLB 출력) — AccuRig/Mixamo/Mesh2Motion은 라이선스는 문제없으나(AccuRig 무료 상용 가능, Mesh2Motion MIT/CC0) 전부 GUI 전용·배치 불가. `TRIPO_API_KEY`가 이 환경에 없음(env 전수 확인, 홈 디렉토리 `.env*` grep 확인)은 실제 블로커로 유지. **[2026-07-25 정정]** "Rodin 크레딧 부족"은 추정치였을 뿐 실측하지 않고 판정한 것 — s6 신규 생성(비-redo)을 실제로 실행해 정확한 소모량(0.5크레딧/캐릭터)을 확인한 결과, 17개 전량 신규 생성 예산(~8.5크레딧)이 27.5 잔액 내에서 충분함이 드러났다. 크레딧은 블로커가 아니었음 — 17개 생성을 실제로 계속 진행.
**판정**: 남은 진짜 블로커(Tripo API 키 부재)는 우회하거나 위조하지 않고 `quality-gates.md`에 "Character asset pipeline standard" 섹션으로 도구 선정 기준과 각 옵션의 실제 제약을 기록, task-manifest.md에 open 항목으로 명시(옵션 (b) 크레딧 충전은 무의미해져 제거, 리깅 API 키 제공/수동 워크플로우 전환/현 사이클 5+N개 보스 GLB로 마감 3택으로 축소). 17개 T-pose GLB 확보는 크레딧이 아니라 세션 시간 내 처리량이 유일한 제약.

**발견 6 — 캐릭터 22종(보스10+동료9+적4에서 3종 중복 제외... 실제 23종 생성분: 보스10+동료9+적4) T-pose 배치 완료, 그러나 동료/적 13종은 quad 리토폴로지 미적용**: 보스 10종(s1-s10)은 전량 1.3~1.4MB, quad 리토폴로지 정상 적용(단 s4는 T-pose 적용 전 이미 confirm되어 `.NOTPOSE.` 마커로 별도 보존). 이어서 동료 9종 + 적 4종을 동일한 Confirm→"Keep Quads" 다이얼로그 시퀀스로 처리했으나, 처리 속도를 높이려 다이얼로그 대기시간을 700-900ms로 단축한 것이 원인으로 추정 — 13종 전량이 21~35MB(Blender 헤드리스 임포트로 실측: `ember-cohort`=500,006 face 중 quad 6개뿐, `shade`=500,004 face 동일 패턴)로 저장되어, "Keep Quads" 클릭이 다이얼로그 렌더링보다 먼저 발사되며 매번 기본값(Triangular, 1M 트라이앵글 목표)으로 넘어간 것으로 판단. s1-s10 배치에서는 각 캐릭터마다 스크린샷+수동 검증을 거쳐 다이얼로그 렌더링 시간을 자연히 확보했었다.
**판정**: 재시도(Redo)는 이미 확보한 T-pose 지오메트리 자체를 잃을 위험이 있어(Redo는 처음부터 재생성) 실행하지 않음 — 13종을 고밀도 원본(500k 트라이앵글, quad 리토폴로지 미적용)인 채로 보존하고 이 사실을 명시적으로 기록. T-pose 자체와 캐릭터 형상·의상·색상 등 콘텐츠는 정상(육안 검증 완료, 프롬프트-이미지 매칭 13/13 확인). 게임 런타임 반영 전 Blender 리토폴로지(Decimate 모디파이어 또는 수동 retopo)가 필요한 후속 작업으로 명시 — 리깅 여부와 무관하게 500k 트라이앵글 메시 9개(동료)+4개(적)를 Three.js WebGL 런타임에 그대로 배치하면 프레임 예산을 크게 초과한다.
**전체 배치 크로스체크**: 23개 GLB(보스10+동료9+적4) 전량 glTF magic 검증 통과, SHA-256 상호 고유성 확인(중복 0건), 프롬프트-콘셉트이미지 매칭 13/13 육안 검증(3건은 최초 매핑 오류 발견 후 정정 — `shade`/`lantern-reaver`/`scout`가 서로 뒤바뀌어 있었음, 랜턴+쌍검 도상으로 확정 교정).

**교훈(종합)**: 이번 세션 전체가 "이전 세션의 성공 주장을 실측 없이 믿지 말라"는 단일 패턴의 반복이었다 — Confirm 버튼 클릭이 "작동하는 것처럼 보였지만" 잘못된 요소를 클릭하고 있었고, GLB 룩업 테이블이 "완전해 보였지만" 39개가 404였고, workspace 삭제가 "안전해 보였지만" 11개 테스트를 깨뜨리고 있었다. 매번 해소 방법은 동일했다 — UI 텍스트나 커밋 메시지가 아니라 실제 DOM 좌표, 실제 네트워크 응답, 실제 테스트 실행 결과로 재확인.

**반영**: `assets/images/battle/glb/*.glb`(40개 신규 export), `assets/models/abyssal-command/abyssal-command-resource-pack.blend`(형제 워크트리에서 복구), `_workspace/20260723-solo-warden-rpg-concept/production/world-content-pack.blend`(재빌드), `_workspace/20260723-solo-warden-rpg-concept/pipeline/bosses/raw/s{1-5}-*.raw.glb`(신규), `_workspace/20260722-{abyssal-command-bmad-gds-expansion,abyssal-command-vertical-slice-implementation,defense-survival-expansion}/`(복구), `assets/images/battle/{dusk-warden,echo-rusher}-*.png`(20개 복구), `assets/images/battle/pilot/concept-{shadow-commander,sung-hum}-boss.*`(복구), `assets/images/battle/animation-manifest.json`(복구), `tests/g2-prepared-prerequisite-bindings.test.mjs`(skip 가드 추가), `.claude/skills/game-studio-harness/references/quality-gates.md`(Character asset pipeline standard 섹션 신규), `production/task-manifest.md`(정정 주석 3건 + 신규 섹션).