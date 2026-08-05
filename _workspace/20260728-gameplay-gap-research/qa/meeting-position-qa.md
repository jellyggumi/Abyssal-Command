# 회의 포지션 — QA (Risk / Exploit / Gate)

> 도메인: 아키타입 로테이션(≥5) · exploit register · 측정 가능 게이트. 입력: `gap-analysis.md` + `current-structure-baseline.md` + `report.md`(10게임·152출처) + `design-intent-digest.md`(stage1b 게이트). read-only, 포지션 문서만 작성.

QA의 결론을 한 줄로: **현재 baseline은 red다. 우리는 아직 통과 못 한 게이트 위에 새 곱셈축(idle-funded power + tier 배수 + formation 심화)을 3개나 얹으려 하고 있다.** 방향(컨셉 시프트)에는 찬성하지만, **무장 순서를 게이트로 강제**하지 않으면 이번 사이클도 stage1b처럼 BLOCKED로 끝난다.

---

## 1. red baseline 위에 새 시스템을 쌓는 리스크 — 리튠 먼저냐 컨셉 시프트냐

### 지금 이미 FAIL인 게이트 (stage1b, `design-intent-digest.md §3`)
| 게이트 | 상태 | 측정치 | 목표 |
|---|---|---|---|
| **G2 밸런스** | FAIL/FIX/REDO | 아키타입 **9-11/20 win 이탈**(5/5 전부 이탈), Cinder gate-min **55-80% 밴드 10-15/15 이탈**, **legal-combo EV = 1.70** | 45-55% 밴드, **maxEV/medianEV ≤ 1.30**, 20-paired 대칭 export |
| **G3 플레이어타입** | FAIL/FIX/REDO | **companion down 0/100**(VANGUARD+SPLIT), **rally-후 TURRET 데미지 0/50**, dominance EV ceiling 미증명 | 결과적 리스크 존재, ≥2 구조적으로 다른 comp가 동일 보스 클리어 |
| **G6 성능** | FAIL | desktop p95 **16.8ms**(>16.7), midtier **33.3ms** ratio 0.021(>0.005), low **50ms** ratio 0.193, soak heap **0.1138 MiB/min** memoryStable=false | p95 ≤16.7ms, long-frame ratio ≤0.005, heap slope 평탄 |
| **G7 코어루프** | BLOCKED | 0/10 참가, 0/20 결정, 0/14 재진입 | 인간 증거 |
| **G8 노벨티** | BLOCKED | 0/5 frequency, 0/10 impression | ≤2/5, median ≥4.0/5 |

### 왜 "red 위에 쌓기"가 위험한가 — 3개 구체 리스크
1. **곱셈 밸런스 표면 폭발 (R3/R5 미해결).** legal-combo EV가 **현재 축만으로 이미 1.70**(목표 1.30의 131%)이다. G1 tier 배수(Echo Core/Bound Fragment 배수)와 G2 idle-funded power는 **새 곱셈 입력**이다. R3(item×trait×formation 곱셈 체인 1.3× ceiling)의 **enforcement point가 아직 미해결**(`§99, §12.2`)인 상태에서 입력을 2개 더 추가하면 EV는 1.70에서 더 벌어진다. cross-category power-governance object 자체가 `[DESIGNED-NOT-BUILT]`(`features table`)다 — **측정할 단일 밸런스시트가 아직 없다.**
2. **성능 예산이 이미 마이너스인데 tier 래더가 액터를 늘린다.** G6는 midtier **33.3ms / low 50ms**로 이미 FAIL. Soulstone의 **#1 불만이 "후반 엔드리스 = 프레임 붕괴"**(report.md:90, RTX 4090에서도 드랍). VS도 동일(report.md:50, "endless/cluttered에서 CPU 드랍"). G1 tier 래더는 정의상 **더 스케일된 적 + 더 많은 이펙트**를 부른다 — 우리가 가장 못 버티는 예산에 가장 무거운 피처를 얹는 꼴. 성능 헤드룸 확보 전 tier 래더 액터 증분은 **자살골**.
3. **idle-funded power가 G3의 "무결과" 실패를 악화시킨다.** G3는 이미 **companion down 0/100** = 결과적 리스크 0. idle로 스탯을 사서 컨텐츠를 out-stat하면 리스크는 더 사라진다. Melvor/HoloCure 공통 불만이 "power-fantasy 가속 후 컨텐츠 trivialize"(report.md:110). idle 캐치업이 곧 파워면 down-rate는 영원히 0에 고정된다.

### 그럼에도 순수 리튠(Stage 2)이 답이 아닌 이유
- stage1b는 **이미 data-only 리튠을 시도**했고 같은 벽에 부딪혔다 — cycle-2 retro는 **"another data-only retune prohibited until redesign reviewed"**(`§120`)라고 명시. 재투자 루프가 **구조적으로 부재**(idle→vanity counter, 코드 검증 `campaign-state.js:244-248` `totalProgress`는 소비 불가)한 게임을 숫자만 만져서 45-55% 밴드에 넣어도, **"싱크 없는 아이들 + 유한 천장"이라는 근본 갭은 그대로**다. 리튠은 red 게이트를 green으로 바꿀 순 있어도 없는 루프를 만들진 못한다.

**→ 컨셉 시프트가 맞다. 단, 무장 순서를 게이트로 묶는 조건부.**

---

## 2. Exploit Register — 제안된 시스템의 악용 벡터 + catch-band

### (a) G2 idle-sink: infinite-reinvest / idle-then-stomp
**벡터.** 오프라인 정산 화폐를 소비 가능하게 배선하면(제안), 플레이어는 (1) 8h idle → 전액 단일 축(워든 스탯/장비티어)에 dump → 컨텐츠 out-stat, (2) 상위 tier 클리어 → idle rate↑ → 더 큰 dump → **런어웨이 루프**. Brotato가 경고한 정확한 실패: reroll이 **shop 내 escalate하지만 shop마다 rebase 안 하면** 뱅킹 후 완벽 빌드 fishing 가능(report.md:65, 71).

**코드 검증 — 브레이크가 이미 죽어있다 (신규 발견).** `wardLevel = resolvedIds.length + floor(companionCollection.length/2)`(`campaign-state.js:218`)는 스테이지·동료로 **무한 증가**. 반면 `wardlinePressure = min(floor(h), 8)`는 **8에 캡**(`:220`). 풀클리어(10 resolved + 동료 3) → level 13 > pressure ≤8 → `ENCROACHED` 브랜치(`:241`)가 **영원히 발화 안 함**. 즉 **G1 tier 래더가 보내는 바로 그 엔드게임 상태에서 idle 리스크-브레이크가 구조적으로 해제**된다. 지금은 totalProgress가 vanity라 무해하지만, 소비 가능해지는 순간 = 무한 축적 → 무한 파워.

**catch-band (측정):**
- **idle income growth per tier ≤ enemy scaling per tier.** tier N→N+1의 idle rate 증가율이 적 HP/DPS 스케일 증가율을 **초과하면 FAIL**. Melvor 원칙(report.md:165, "sinks scale ahead of income at every stage"). 비(ratio) = idleRate(N+1)/idleRate(N) ÷ enemyScale(N+1)/enemyScale(N) 는 **non-increasing, ≤1.0**.
- **pressure cap을 wardLevel과 동조.** 8 하드캡 제거, `pressure`는 `wardLevel`에 비례해서 상승 → idle 무한지대 봉쇄. ENCROACHED가 엔드게임에서도 발화 가능해야 함(현재 0회).

### (b) G1 curse/tier SKIP + reward-multiplier farming
**벡터 1 (SKIP).** tier N 미클리어 상태로 N+1 보상 tier 언락 → 감당 못 하는 컨텐츠를 farming. **벡터 2 (farming).** 하위 tier의 reward-per-minute가 상위 tier보다 높으면(적 HP가 배수보다 빨리 스케일) 플레이어가 **sweet-spot에 캠핑, 푸시 인센티브 소멸**. VS가 겪은 실패: PowerUp 맥스 후 **골드 무가치화**(report.md:50).

**catch-band (측정), Soulstone curse-clear-gating 인용(report.md:81):**
- **clear-gate 하드 게이트.** tier N+1 언락 = **tier N 클리어 기록 필수, 예외 0.** Soulstone은 "다음 Curse Tier는 직전 tier 최고 curse를 *클리어*해야만 언락"(report.md:81). 측정: 미클리어 tier 언락 이벤트 = **0/∞ (any > 0 → FAIL)**.
- **reward-per-minute 밴드.** 모든 언락 tier의 RPM에 대해 **max(RPM)/median(RPM) ≤ 1.30** (G2 EV ceiling 재사용). 어느 tier도 지배적 farm이 되면 FAIL. Soulstone은 **reward 배수를 curse 난이도에 직결**(report.md:81, "difficulty and farm rate are directly linked")시켜 상위 tier가 항상 더 당기게 함 — 이를 수치로 강제.

### (c) G3 formation-stance dominance (한 스탠스가 전부 해결)
**벡터.** 3스탠스 심화(AFK식 시너지 임계 + 위치역할) 도입 시, **단일 스탠스/comp가 모든 tier·보스를 클리어**하면 agency 축이 장식이 됨. AFK Journey가 증명한 위험이자 강점: **포메이션 = 스킬 레이어**(report.md:220-231)지만, 지배 comp 하나면 "solved build→반복"(VS/20MTD/HoloCure 공통 불만, report.md:50, 130). 우리 **PRED-08**(single-main ≥ diversified → Kingshot축 장식화, top-severity 미검증, `design-intent-digest §105`)와 정확히 동일.

**catch-band (측정):**
- **stance/comp EV 균형.** 각 보스 tier에 대해 **max(stanceEV)/median(stanceEV) ≤ 1.30.** R2 요구(≥2 구조적으로 다른 comp가 동일 보스 클리어, `§98`)를 수치화.
- **down-rate 트립와이어.** 공격형 스탠스(VANGUARD/SPLIT)의 **companion down > 0/100** (현재 0/100 = FAIL). 결과적 리스크 존재 증명.
- **meat-shield 봉쇄 (PRED-09, `§106`).** no-permadeath DOWNED로 일회용 전열 세우는 익스플로잇: down 후 재활용 comp의 승률이 no-down comp 대비 **+X% 초과 이득이면 FAIL** (Ward-tier integrity 레버로 페널티).

---

## 3. 최우선 G2 이동의 pass/fail 수치 (idle-sink 배선)

| 지표 | PASS | FAIL |
|---|---|---|
| **idle 캐치업 상한** | 동일 실시간당 idle income ≤ **활성 플레이 income의 30%** | > 30% (idle이 활성을 대체 → "idle-then-stomp") |
| **단일 idle-funded 구매 파워 점프** | 어떤 단일 구매도 워든 파워 **≤ +5%** (R1 "축당 20% cap"의 1/4로 idle 전용 보수 설정, `§97`) | 단일 구매 > +5% 파워 (급점프 = out-stat) |
| **구매 가격 하한** | 최고가 파워 구매 = **> 1 full idle window(8h) 산출** (Brotato식 "매번 재투자 강제", report.md:64) | 8h idle 1회로 최고 축 완결 구매 가능 |
| **idle rate / enemy scale 비** | tier별 non-increasing, **≤ 1.0** (Melvor "sink scales ahead", report.md:165) | idle rate가 적 스케일보다 빠르게 성장(런어웨이) |
| **ENCROACHED 발화** | 엔드게임(level>8)에서도 pressure>level 발생 가능, down-side 존재 | pressure 8-cap로 엔드게임 브레이크 영구 해제(현 코드 `:220`) |

---

## 4. 아키타입 커버리지 — 신규 축이 테스트되어야 할 ≥5 플레이어 타입

현행 G2는 combat 스킬 기준 5 아키타입을 45-55% 밴드로 본다. 하지만 **idle-sink + tier + formation 축은 "화폐를 어떻게 쓰는가 / tier를 어떻게 고르는가"라는 행동축**이라 새 로테이션이 필요하다. 최소 5:

1. **Idle-Maximizer** — idle 주기당 1회 로그인, 전액 dump. → **idle 캐치업 ≤30% + idle-then-stomp 런어웨이** 검증.
2. **Active-Grinder** — idle 거의 안 씀, 연속 플레이. → **시스템이 idle 의존을 강제하지 않는지**(Active가 페널티 안 받는지) 검증.
3. **Tier-Rusher** — 항상 최고 tier 푸시. → **frontier 난이도-보상 스케일 + clear-gate SKIP 봉쇄** 검증.
4. **Farm-Optimizer** — 최고 RPM tier 캠핑. → **reward-multiplier farming 밴드(max/median RPM ≤1.30) + 아이템풀 희석**(Brotato, report.md:70) 검증.
5. **Formation-Loyalist** — 단일 comp/스탠스 고정, 교체 거부. → **stance dominance(max/median EV ≤1.30) + PRED-08** 검증.
6. (추가) **Meat-Shield Abuser** — no-permadeath DOWNED 익스플로잇. → **PRED-09 + down-rate 트립와이어** 검증.

각 아키타입은 **20-paired 대칭 시드**로 돌려 EV export(G2 계약)에 편입 — 현재 부재한 대칭 export를 이 6타입 축으로 확장.

---

## VOTE

**VOTE = "Stage 1 concept shift" (조건부 게이트).** 이유: 재투자 루프가 **구조적으로 부재**한 게임은 리튠으로 못 고친다(stage1b가 data-only 리튠으로 이미 실패, `§120`). 컨셉 시프트가 맞다. **단, 무장 순서를 하드 게이트로 강제**한다 — G2 idle-sink는 hardened EV ceiling 뒤에서만 먼저 배선하고, **G6 성능이 PASS(p95 ≤16.7ms)로 돌아오기 전까지 G1 tier-래더 액터 증분은 금지**. 순서 없이 3축을 동시 투입하면 1.70 EV는 더 벌어지고 이번 사이클도 BLOCKED로 끝난다.

**가장 작은 고레버리지 스텝 (QA 도메인):** G2 evidence-exporter를 **단일 cross-category balance-sheet**로 확장 — idle-funded power + tier 배수 + formation을 하나의 곱셈 체인 export에 넣고, **위 6 아키타입 × 20-paired 대칭 시드**로 `maxEV/medianEV`를 계산. (R3 enforcement point가 미해결이라 지금은 "측정할 시트"부터 만들어야 함.) 동시에 3개 트립와이어를 blocking gate로 무장: idle캐치업 ≤30%, max/median tier-RPM ≤1.30, max/median stance-EV ≤1.30.

**성공을 증명하는 단일 수치:** **legal-combo `maxEV/medianEV` — 현재 1.70 → 신규 idle+tier 입력을 체인에 넣은 상태에서 ≤1.30, 그때 idle 캐치업이 ≤30%로 측정될 것.** 이 비가 1.30에 들어오면 스택이 안전하다는 증거고, 못 들어오면 우리는 red 위에 쌓고 있는 것 — 멈춰야 한다.
