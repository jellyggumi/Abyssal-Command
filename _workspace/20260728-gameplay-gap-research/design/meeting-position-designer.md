# 회의 포지션 — Designer (core loop · novelty · G2 sink shape · G1 tier ladder)

> 입력: `gap-analysis.md` · `current-structure-baseline.md` · `research/comparable-gameplay/report.md`(10게임·152출처) · `engineering/current-systems-inventory.md`(file:line) · `intake/design-intent-digest.md`(게이트). read-only 분석 — 소스 무수정, 이 포지션 파일만 작성.
> 담당 도메인: 코어 루프의 **모양**, 노벨티, 제안 G2 idle-sink / G1 tier-ladder의 **수치 스케치**.

---

## 1. 포지션 — Stage-1 CONCEPT SHIFT (컨셉 시프트), Stage-2 리튠 아님

**주장: 최고 레버리지는 "유한 캠페인 → 재투자 로그라이트-라이트"로의 축 이동(G2+G1)이다. 또 한 번의 밸런스 데이터 리튠이 아니다.**

근거 3층:

1. **리튠은 잘못된 문제를 푼다.** 우리 실패 게이트는 밸런스 숫자만이 아니라 *루프 모양*이다. 풀클리어 = 정확히 40 EC + 10 BF 소진 후 재투자 루프 소멸(`campaign-state.js:55-66`, baseline:17). Track A 예산(EC 40)은 실제 항구 수요 **281 EC**(6스탯 240 + 트리 41, `rpg-catalog.js:30-44,46-54`)에 정면 미달 — 즉 **소비하고 싶은 파워는 이미 카탈로그에 있는데 화폐 공급이 캠페인 1회분으로 막혀 있다.** 리튠은 이 공급 상한을 못 건드린다. 화폐 재획득 경로를 열어야 하는데 그건 컨셉 결정이다.
2. **거버넌스가 이미 리튠을 금지.** stage1b가 `BLOCKED → director review`; 다이제스트 §4: *"another data-only retune prohibited until redesign reviewed."* Stage-2 데이터 재튜닝은 문이 닫혀 있다 — 재설계 리뷰가 선행 조건. 이 회의가 그 리뷰다.
3. **10게임 중 8게임이 재투자 루프로 수렴.** VS·Brotato·Soulstone·20MTD는 idle이 없지만 **전부** endless/난이도 래더로 유한 클리어 뒤에 파워의 출구를 만든다(Soulstone Curse 티어=클리어해야 해금+보상배수, report:81/91; 20MTD Darkness 0-15 스택, report:121/131; Brotato Danger 0-5 +12/26/40%, report:61). Melvor·Kingshot·LoM·AFK는 idle을 **닫힌 재투자 루프**로 만든다(Melvor: 오프라인 산출=원자재 즉시 소비, report:164/171; LoM: idle gold→Lamp→gear→BP→다음스테이지→더 많은 idle, report:204/211; AFK: idle Gold/EXP→hero level→AFK Stage↑→idle rate↑, report:224/231). **우리 true-offline 아키텍처는 이미 존재하고 HoloCure보다 우월**(HoloCure는 앱-오픈 필수, 우리는 진짜 오프라인 정산, report:104/111) — 컨셉 시프트의 90%가 이미 코드에 있다. 빠진 건 *싱크*와 *출구*, 즉 루프 모양이다.

**단, 컨셉 시프트는 "재-피벗"이 아니라 "기존 기계장치 재배선"이다.** 신규 스테이지 0, 신규 화폐 0. 하드 게이트 2개: **G6 성능**(midtier 33.3ms/low 50ms/heap 0.1138 MiB/min, 다이제스트 §G6)와 **G2 밸런스**는 엔드리스/티어 확장 *전에* 선결 — 안 그러면 Soulstone 후반 랙(#1 불만, report:90)을 우리가 더 심하게 재현한다.

---

## 2. G2 sink — 수치 스케치 ("Undertow Silt" 소비 화폐, PM firewall 준수)

**모양: `idle.totalProgress`(현재 vanity 카운터, `campaign-state.js:248`, 유일 리더 `app.js:310-315`)를 소비 화폐 "Undertow Silt"로 배선.** **[PM-confirmed firewall]** Silt는 **EC/BF를 절대 발행하지 않는다** — earned 캠페인 예산에 손대지 않는 별도 economy. Silt는 *편의·breadth*(비게이트 항목)를 사고, *영구 파워(EC/BF)*는 오직 active tier ladder(§3)가 발행. 이게 정확히 Melvor 교훈의 정본 — 오프라인 산출은 **인접 루프**(재료/편의)를 먹이고 게이트된 코어는 active가 판다(report:164/171). run-scoped/영구 2경로 분리 필러(다이제스트 §31)와도 정합.

### 2a. 공급 (기존 accrual 재사용, 수치 무변경)
- accrual = `completedStages × floor(elapsedMin)`, cap 8h(`campaign-state.js:10-12,221-249`).
- 풀클리어 8h = **4,800 Silt** / 5스테이지 8h = **2,400 Silt** / window.

### 2b. 싱크 — Silt가 사는 것 (전부 NON-EC/BF, 신규 파워 축 0)
Silt는 게이트된 파워를 못 산다. 대신 **현재 죽어있거나 없는 편의·breadth 레버**를 살린다:

| Silt 싱크 | 비용 | 성격 | 재배선 대상(기존 dead/없음) | 근거 |
|---|---|---|---|---|
| **특성 리롤** | 200 | 영구-메타 편의(파워 아님, 선택지 셔플) | 현재 특성은 고정 round-robin·리롤 없음 `rpg-catalog.js:56-84` | Brotato 리롤 케이던스(report:65) |
| **인런 드래프트 리롤** | 300 | **run-scoped**, 런 종료 시 소멸 | 현재 3택8 리롤 없음 `sim:971-982` | VS/Brotato 스핀(report:65) |
| **로스터 breadth 언락** | 2,400 | 1회성: dead 보상전용 동료를 포획가능으로 활성 (breadth, 파워 아님) | 보상전용 3종 미도달 `defense-catalog.js:158-160`, baseline:24 §7 | HoloCure 컬렉션=재투자 싱크(report:111) |
| **vanity 아웃렛** | 잉여 | 순수 코스메틱(overflow 흡수) | 없음(신규 소액) | HoloCure 카지노/데코 vanity 싱크(report:105) |

→ **Silt는 새 파워 축을 만들지 않고, 죽은 콘텐츠(G4)를 살리고 없던 리롤 agency를 연다.** capture/formation 유일 축(§4)을 *증폭*하는 방향으로만 흐른다.

### 2c. 컨버전 캡 — "idle은 보조, active가 주력" (PM 2-lever)
- **catch-up 승수 ≤30%(PM rate 25%):** idle의 Silt-equiv 산출 ≤ 0.25× (동일 wall-clock active 산출). idle이 active를 절대 못 앞선다.
- 스핀 케이던스(8h 풀클리어 4,800 Silt): 특성 리롤 **24회** *또는* 드래프트 리롤 16회 *또는* 로스터 언락 2회. dead 동료 3종 전부 breadth 활성 = 7,200 Silt(다수 window). → Brotato식 상시 스핀 압력(report:64/71), 절대 vanity 은행화 없음.

### 2d. 컴백 밴드 — Silt-scoped, ≤30% (PM neglect-lever)
현재 `ENCROACHED → 0 보상`(`campaign-state.js:217-243`)은 **Silt 100% 몰수** = LoM "idle 날림" 약탈 패턴, 우리가 거부(report:204/210). 재설계 **[PM-confirmed]**:
- pressure(`min(floor(hours),8)`) > wardLevel(`resolvedIds.length + floor(companions/2)`)일 때 **Silt payout의 0%가 아니라 감쇠율**:
  `retain = 1 − min(0.30, 0.05×(pressure−wardLevel))` → 최소 **70% 유지**, 절대 0 아님.
- 두 레버 모두 **Silt에만** 적용(firewall) — earned EC/BF는 어느 쪽도 못 건드림. catch-up은 active의 30% 캡, neglect는 70% 플로어.

---

## 3. G1 "Encroachment tier" ladder — 수치 스케치 (기존 10스테이지 재사용)

**모양: 신규 오소링 0. 기존 10스테이지 위에 티어 배수만 얹는다.** Soulstone Curse(클리어해야 다음 티어, 보상배수, report:81/91) + 20MTD Darkness(스택 모디파이어, report:121) + Survivor.io 3-tier Challenge(report:141/151)의 합의 채택. **엔드리스 아님 — 유한 5티어**(뒤 §5 근거).

| 파라미터 | 값 | 근거 |
|---|---|---|
| 티어 수 | **5** (Encroachment I–V), 캠페인=T0 | 무한 트레드밀 회피(Survivor.io 290챕터, report:151; HoloCure endless=stat-check, report:101) |
| 적 스케일 스텝 | 적 HP·dmg **×1.08 / 티어** (≤5%p-per-tier 밴드 정합, T0 base scale 100→240 유지, `defense-catalog.js:277-282`) → T-V = **×1.47** | Brotato Danger +12%@D3(report:61) · 20MTD Darkness 스택(report:121) — 완만 스텝 채택 |
| 페이아웃 배수 | **[PM reward-band]** EC·BF **m(N)=1+0.10×N 선형**(step-jump 금지) → T-I ×1.1 … T-V ×1.5. 각 티어 reinvest는 +8% 스케일만 회복, 오버슈트 금지 | Soulstone 난이도↔파밍 직결(report:85), 단 sink-scales-ahead 규율 |
| 해금 규칙 | 티어 N 전(前)스테이지 클리어 → N+1 해금(`applyCampaignRunResult` 게이트 재사용, `campaign-state.js:186-215`) | Soulstone "이전 티어 최고 curse 클리어해야 다음 티어"(report:81) |
| **스케일 방식 — 하드 제약** | **액터 수·이펙트 불변, HP·dmg 배수만.** 스폰 밀도·동시 액터 증가 금지 | G6 이미 FAIL(다이제스트 §G6); Soulstone 후반 랙=액터/이펙트 saturation(report:90) → 배수는 성능 공짜 |

→ **티어 래더 = firewall 하에서 EC/BF의 유일 재획득 경로.** 캠페인 예산이 못 채우는 **항구 수요** — Echo Core 미충족 **241**(수요 281 = 6스탯 240 + 트리 41 vs 예산 40, `rpg-catalog.js:29,30-44,46-54`), Bound Fragment 미충족 **200**(수요 210 = 워든 3슬롯 30 + 6동료×3슬롯 180 vs 예산 10, `rpg-catalog.js:176-192`) — 을 여기서 판다. **[PM-disciplined]** 티어 I-V 1패스 페이아웃 = **195 EC + 65 BF**(base +3EC/+1BF × m(N) 합) = 구멍의 EC 81% / BF 32% — **단일 클라임이 예산을 트리비얼화하지 않음**(구 ×0.5 커브 375/125=base 9배는 active 자체가 runaway, PM flag). 나머지는 **래더 반복 패스**로 채워 sink가 income보다 앞서 스케일. T-V까지 오르려면 그 EC/BF 파워가 필요 → **G1 래더가 G1 수요를 스스로 만드는 닫힌 루프**(LoM idle→gear→다음스테이지, report:211). idle Silt(§2)는 이 코어를 절대 못 건드리고(firewall) breadth/편의만 증폭.

---

## 4. Novelty scorecard (G8) — 제안 축 vs 10 비교작

축별 "몇 개 비교작이 보유?"(G8 규칙: ≤2/5 frequency = novel, 다이제스트 §34). 낮을수록 차별화.

| 축 | 보유 비교작 | 빈도 | 판정 |
|---|---|---|---|
| **적 포획 → 영구 동료**(elite extraction hold→bind→capture) | 0/10 (전부 gacha/roster: VS 165캐릭 구매, Brotato 언락, Soulstone/HoloCure/20MTD/Survivor.io/Kingshot/LoM/AFK 소환) | **0/10** | **★ 최강 차별. 아무도 없음.** report:43/63/103/123/143/183/223 전부 "no capture" |
| **이동전용 입력 위 포메이션 agency**(3스탠스 전/후열 + BACK 시너지, move-only) | AFK 포메이션(단 무브 없음·타일배치, report:220) / 나머지 무브-only는 포메이션 0 | **1/10** | **★ 차별.** move-only(VS/Brotato/HoloCure/Survivor.io DNA) + 포메이션(AFK)의 교차는 유일 |
| **진짜 오프라인 정산**(앱 종료 중 시뮬) | Melvor/LoM/AFK/Kingshot(각 캡, report:164/204/224/184) | 4/10 | 파생 — 단 우리 것이 **품질 우위**(HoloCure는 앱-오픈 필수, report:104) |
| **무수익화 완전판**(영구 N/A) | HoloCure(report:108) | **1/10** | 차별(신뢰/리텐션 축), 게임성 novelty는 약 |
| idle-sink 재투자 루프 | 8/10 | 8/10 | **파생** — 채택하되 novelty 클레임 금지 |
| 난이도 티어 래더 | Soulstone/20MTD/Survivor.io/Brotato/VS/LoM/AFK | 7/10 | **파생** |
| 3-of-N 드래프트 | VS/Soulstone/HoloCure/20MTD/Survivor.io | 5/10 | 파생(경계선) |

**결론:** Abyssal의 novelty 앵커는 **capture + formation-on-move-only** 두 축(각 0/10, 1/10). 나머지(idle-sink, tier-ladder, 드래프트)는 전부 파생 — **차용은 하되 G8 클레임은 capture+formation에만 건다.** 전략적 수(firewall 준수): **idle Silt(§2)는 capture *breadth*로 라우팅**(로스터 언락→dead 보상전용 동료 3종 활성, 특성 리롤→포메이션 축 튜닝), **active tier 페이아웃(§3 EC/BF)은 capture/formation *파워*로 라우팅**(동료 장비 티어=BF게이트, 신규 포획 elite·동료 진화 활성) → 파생 싱크가 유일 축을 *증폭*하되 두 economy는 분리 유지. (stage1b G8 후보 "pressure-bound elite extraction," 다이제스트 §G8 — capture 축과 정합.)

---

## 5. "Solved-build / 반복" 리스크 (VS/20MTD/HoloCure 불만) — 설계적 방어

**리스크 원본:** VS "몇 시간이면 다 봤다·자동재생"(report:50) · 20MTD "solved build 찾으면 난이도 증발, endless=대기게임"(report:130) · HoloCure "endless=순수 stat-check"(report:101) · Survivor.io "rigid meta-build 고정"(report:150).

**우리는 지금 더 나쁘다:** 단일 3택8, 최대 Lv9, 인런 랭크·시너지·진화 0(`defense-catalog.js:294-303`; sim`:985-1007`, baseline:13) → 빌드 공간이 즉시 solved. 5-10스테이지는 웨이브 구성 변주도 없음(타이밍/밀도 지터뿐, baseline:21).

**방어 4레버(설계가 solve를 지연):**
1. **티어별 적 정책 로테이션.** 스케일 배수뿐 아니라 티어마다 지배 정책 교체(denial/flank/escort/resource-denial, `defense-catalog.js` STAGE_TACTICS·sim`:1352-1401`). 적 *수학*이 바뀌므로 단일 빌드가 전 티어를 못 푼다(20MTD 트레이드오프 시너지 철학, report:120).
2. **포메이션 깊이 = 진짜 anti-solve 축**(gap-analysis G3). 스탠스 시너지 임계 + 전/후열 결과 + 수동 버스트(AFK "타일 한 칸이 스탯 우위를 이긴다," report:231) → solved 빌드도 *조종*이 필요. **단 G3 이미 FAIL**(100런 0 다운·스위치후 0 데미지, 다이제스트 §G3) → 축 추가는 밸런스 선결 후.
3. **포획 로스터 로테이션.** 티어 진행마다 최적 동료 로드아웃이 이동(capture 축 재사용) → 조각이 바뀌니 빌드가 고정 안 됨.
4. **유한 5티어(엔드리스 거부).** HoloCure/Survivor.io stat-check 벽과 Soulstone 후반 붕괴를 원천 회피 — **"깊지만 끝이 있는" 래더 자체가 트레드밀 대비 차별**(gap-analysis 회피: Survivor.io 트레드밀·후반 성능).

---

## 결론

**(a) VOTE = "Stage 1 concept shift".**
이유(1줄): 실패 게이트는 밸런스 숫자가 아니라 *루프 모양*(풀클리어=재투자 소멸, 화폐 공급이 캠페인 1회분으로 상한) — 리튠은 이 상한을 못 건드리고, 거버넌스도 data-only 리튠을 이미 금지했으며, 10중 8게임이 재투자 루프로 수렴하고 우리 true-offline 아키텍처가 그 90%를 이미 갖췄다. (하드 게이트: G6 성능 + G2 밸런스 선결.)

**(b) 가장 작은 고레버리지 스텝:**
`idle.totalProgress` vanity 카운터(`campaign-state.js:248`, 리더 `app.js:310-315`)를 소비 화폐 **Undertow Silt**로 배선 → 특성 리롤 + 인런 드래프트 리롤 + dead 보상전용 동료 3종(`defense-catalog.js:158-160`) breadth 언락으로 소비. **firewall: Silt는 EC/BF 미발행**(§2). 신규 스테이지 0·신규 화폐 0·신규 파워 축 0. 오직 죽은 카운터 → 살아있는 편의 싱크 + G4 죽은 콘텐츠 부활. (영구 파워 재획득은 별건인 §3 티어 래더가 담당.)

**(c) 그게 통했는지 증명할 단 하나의 수:**
**Undertow Silt 소비율 > 0** (현재 코드상 provably 0 — `campaign-state.js:248` 유일 리더가 vanity 렌더뿐). 세컨더리 게이트: 티어-V에서 **p95 ≤ 16.7ms**(G6 예산, 다이제스트 §34) — 래더가 성능을 다시 깨지 않았음을 증명. firewall 무결성: idle 경로가 `echoCoreEarned`/`boundFragmentEarned`를 0회 증분(`campaign-state.js:325-375` 미경유). novelty는 capture+formation 축 **≤2/5** frequency 유지(§4).
