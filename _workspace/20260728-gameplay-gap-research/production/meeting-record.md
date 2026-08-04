# 회의록 — 게임성 갭 데이터 리뷰 (director 종합)

> run: 20260728-gameplay-gap-research · 입력: `current-structure-baseline.md`(코드검증) · `research/comparable-gameplay/report.md`(10게임·152출처) · `gap-analysis.md`(5갭×근거). 참석: designer · pm · programmer · qa · ui-senior-developer. 산출: 각 `*/meeting-position-*.md`.

## 1. 만장일치 투표: **Stage 1 컨셉 시프트 (게이트)**
5/5 전원 **"Stage 1 concept shift"** — 단 전원이 **G6 성능 + G2 밸런스 선결**에 게이트를 걸었다.
- **근거(공통):** 실패 게이트는 밸런스 *숫자*가 아니라 **루프 모양**이다 — 풀클리어=재투자 소멸, 화폐 공급이 캠페인 1회분(정확히 40 EC + 10 BF)으로 상한. 리튠으로는 없는 루프/티어를 못 만든다(구조=컨셉 레벨). 거버넌스가 data-only 리튠을 이미 금지(§120). 10중 8게임이 재투자 루프로 수렴(Melvor/Kingshot/LoM/Brotato/HoloCure). 우리 true-offline 아키텍처가 그 90%를 이미 보유.
- **그러나(공통):** red 베이스라인(G2 EV 1.70 vs ≤1.30, G6 모바일 33-50ms) 위에 엔드리스/티어를 올리면 Soulstone #1 불만(후반 프레임 붕괴, report:90)을 그대로 재현. → 컨셉 시프트는 **시퀀스**로, 게이트 뒤.

## 2. 수렴한 최소 스텝 (5/5 동일 지점)
**아이들 `settleIdleReturn.totalProgress`(`campaign-state.js:248`, vanity)를 소비 가능한 3번째 화폐 "Undertow Silt"로 배선 → 워든 메타 싱크 1개.** meta+UI only, tick-path 무편집.
- designer: 특성 리롤 + 인런 드래프트 리롤 + **dead 보상전용 동료 3종 breadth 언락**(`defense-catalog.js:158-160`).
- pm: **동료 레벨링**(dead 동료 3종 활성, `campaign-state.js:291-297`), 16h 캡 + 25% 컴백 + sink-scales-ahead.
- programmer: `allocateWardenStatPoint` earned/spent 패턴(`:333`) 미러 + quick-battle 스윕. **getRunDigest 바이트동일** 보존.
- ui: 좌측 rail 3번째 통화 pill(`renderRailCurrency` `app.js:1152` 확장) + idle-return 토스트 딥링크 리타겟(`app.js:1170`). **신규 탭/독 0.**
→ **신규 스테이지 0 · 신규 파워축 0 · sim 무편집.** 죽은 카운터 → 살아있는 싱크 + G4 죽은 콘텐츠(동료 3) 부활. **firewall: Silt는 EC/BF 0 발행.**

## 3. QA 신규 코드 발견 (blocking)
`campaign-state.js:218,220,241` — **wardLevel은 무한 증가하나 wardlinePressure가 8에 하드캡** → ~8클리어 후 ENCROACHED(아이들 리스크 브레이크)가 영영 미발동. 지금은 무해(vanity)지만 **아이들이 소비 가능해지고 G1 티어 래더가 8+ 영역으로 보내는 순간 catastrophic**(무한 재투자 exploit). → **S1 전에 pressure 캡 해제(wardLevel 추적) 필수.**

## 4. director 시퀀스 판정 (숫자 게이트)
| 단계 | 내용 | 통과 게이트(측정→목표) |
|---|---|---|
| **S0 · red 복구(모든 피처 PASS 차단)** | (1) pressure 8-캡 해제 → ENCROACHED가 wardLevel>8에서 발동 (2) G2 evidence-exporter → **단일 cross-category balance-sheet**(idle+tier+formation 곱셈체인) 6 아키타입 × 20-paired 시드 (3) 3 tripwire arm | legal-combo maxEV/medianEV **1.70 → ≤1.30**; ENCROACHED fires at level>8; 20-paired 대칭 export 존재 |
| **S1 · G2 아이들 싱크(첫 피처, 최저비용, 5/5 수렴)** | Silt 배선 + 동료 레벨링 싱크(dead 3 활성) + rail pill + 토스트 딥링크. meta+UI only | getRunDigest **바이트동일**; Silt 소비율 **>0**(현재 provably 0); idle:active **≤0.30**; EV **≤1.30**; tap→DOM **≤100ms**; shell DOM **<350**; 타깃 **≥48dp** |
| **S2 · G1 티어 래더(G6 통과 뒤)** | 기존 10스테이지 재사용 "Encroachment tiers", clear-N→open-N+1, 화폐 배수, **≤5%p 파워델타/티어**, 티어별 적 정책 로테이션(solved-build 지연) | **BLOCKED until** 미드티어 p95 **33.3 → ≤16.7ms**, heap slope **0.1138 → ≤0 MiB/min**. 액터 1개 추가도 그 전엔 불가 |
| **S3 · G3 포메이션 깊이(G2/G3 밸런스 green 뒤)** | AFK식 스탠스 시너지 임계 + 전/후열 위치 결과 + 수동 버스트; **M4 카드 → 인런 결정 UI**(dead sim 부활) | stance-EV max/median **≤1.30**; 공격 스탠스 down-rate **>0/100**(현재 0/100 FAIL) |

## 5. Exploit 레지스터 (QA, S1+ 대상)
- (a) 아이들 무한재투자/idle-then-stomp: **idle-income-growth/tier ≤ enemy-scaling/tier (비증가 ≤1.0)** + pressure 캡 해제.
- (b) G1 티어 SKIP/보상배수 파밍: **하드 clear-gate(예외 0, Soulstone 모델)** + reward-per-minute max/median ≤1.30.
- (c) 포메이션 스탠스 지배: **max(stanceEV)/median(stanceEV) ≤1.30** + meat-shield 차단(PRED-09).
- 단일 idle-funded 구매 **> +5% 워든 파워 금지**(R1 20%캡/4); 최고가 구매 **> 8h 아이들 1창** 소요.

## 6. 교차 회피 (불만 데이터)
수익화 포식(Kingshot/LoM/Survivor.io 최상위 불만) — 우리 무수익화=공짜 승점, 천장은 숙련·시간으로 페이싱. "solved build→반복"(VS/20MTD/HoloCure) — S2 적 정책 로테이션 + S3 콤비 깊이로 지연. 후반 성능 붕괴(Soulstone) — S2가 G6 뒤에 게이트. 아이템풀 희석(Brotato) — 드래프트 풀 과팽창 금지.

## 7. 노벨티(G8) 초안
차별점 = **true-offline 정산 + 정예 포획 + 포메이션 agency + 무수익화**의 결합(10 비교작 중 이 4개 동시 보유 없음). capture+formation 축 frequency ≤2/5 유지해 파생감 회피.

## 차기 사이클 진입 결정
**하이브리드: 컨셉 시프트 승인 · 진입은 Stage 2 게이트-복구(S0).** red 위에선 어떤 신규 피처도 PASS 불가(전원 게이트 + QA 최상위 리스크). S0 복구 직후 **S1(G2 아이들 싱크)** 를 첫 피처로 착수 — meta+UI-only, sim 무위험, 5/5 수렴. 엔드리스(S2)/포메이션(S3)은 각각 G6/밸런스 게이트 뒤. 이는 이전 사이클들이 3연속 이월한 G4/G6/G7/G8을 "새 피처로 덮기" 대신 "선결"로 돌리는 판정.
