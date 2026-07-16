# Abyssal Surge 시나리오 바이블 — 3-Stage 연속 서사

**Navigation:** [worldview](worldview.md) · [concept](concept.md) · [narration-scripts](narration-scripts.md) · [cinematic scene 00](cinematic-scene-00-package.md)

**방법론:** webtoon-harness 서사 원칙 적용 — 고긴장 곡선, 대사 중심(침묵하는 주인공 + 말하는 보스), **매 스테이지 1반전**, 1스테이지 심기(plant) → 3스테이지 회수(payoff), 스테이지 말미 클리프(다음 스테이지 후크).

**G1 규율:** 본 문서의 모든 고유명사는 §7 자가 감사 표에 등재된다. worldview.md 원전 canon(AS-WV-001~010)과 모순되는 신규 설정 0건이 통과 조건이다. 본 문서는 *확장*(canon이 침묵하는 영역의 서술)만 허용하고 *수정*(canon 문장과 충돌)은 금지한다.

---

## 1. 세계관 요약 (worldview.md 요약 — 신규 설정 없음)

달의 균열(Abyssal Surge)이 버려진 해안 구역으로 Echo Deep의 물질을 흘려보낸다. **Moonless Court**는 이 균열을 *정복이 아니라 봉쇄*하는 소규모 감시자 결사다. 플레이어는 **Dusk Warden** — 불안정한 메아리를 결속하는 *침묵의* 야전 지휘관이다. 처치된 **Ash Echo**는 짧게 지속되는 영혼 잔류(soul pool)를 남기고, **Arise**(일어나라) 명령이 그것을 임시 군단 유닛으로 결속한다. **Lord's Domain**은 아군 붕괴를 지연시키는 짧고 한정된 결계다.

캠페인 무대: **Cinder Span**(잿빛 교량) → **Veil Citadel**(거울이 명령 링크를 왜곡하는 이동 요새) → **Echo Throne**(Gate Sovereign이 장악한 균열의 명령 중추).

### 1.1 명칭 조정 (기존 코드·문서 간 불일치의 서사적 해소)

worldview.md와 campaign-state.js 사이에 선행 불일치가 존재한다(본 문서 이전 발생, §7.3에 기록). 본 바이블은 아래 조정을 **정식 해석**으로 제안한다:

| 코드(campaign-state.js) | worldview canon | 조정 해석 |
|---|---|---|
| Cinder Warden (Stage 1 boss) | Rift Guardian (AS-WV-006) | **Rift Guardian은 종(種)명, Cinder Warden은 Cinder Span에 자란 해당 개체의 호명.** "breach-grown sentinel"의 개체별 이름 규약. |
| forge node (Stage 1 capture) | Sable Relay (AS-WV-005) | **forge node는 Sable Relay가 Cinder Span의 물에 잠긴 대장간 위에 내린 정박점.** index.html도 "capture the Sable Relay"로 지칭 — 동일 대상. |
| Veil Tactician (Stage 2 boss) | (canon 침묵) | Veil Citadel(AS-WV-007)의 거울 진형을 지휘하는 파수 지성. 신규 등재 필요(§7.3). |

이 조정으로 재작명 없이 코드·문서·서사가 하나의 대상을 가리킨다. worldview 인벤토리 등재(AS-WV-011+)는 Design 소유의 후속 작업이다.

---

## 2. 주인공 — Dusk Warden (그림자 군주)

- **정체:** Moonless Court의 야전 지휘관. canon상 *침묵*한다 — 따라서 본 시나리오의 모든 음성 대사는 보스와 내레이터 몫이고, Warden은 행동·명령어(Arise, Lord's Domain)로만 말한다. webtoon-harness의 "대사 중심" 원칙은 **보스 독백 vs 침묵 주인공**의 비대칭 대화로 구현한다.
- **동기(표층):** 균열 봉쇄 — Court의 임무. 정복이 아니라 봉쇄라는 결사의 강령이 1~2스테이지의 행동 원리다.
- **동기(심층, 점진 노출):** Warden이 결속하는 그림자들은 무주(無主)의 잔재가 아니다. 스테이지가 진행될수록 "내가 부리는 이 군단은 누구의 것이었나"라는 질문이 조여 온다. 3스테이지에서 답이 나온다: **봉쇄자는 왕좌의 후계 절차다.**
- **호칭 규약:** 영문 인게임 표기는 Dusk Warden 고정. KR 내레이션·시네마틱 호칭은 **그림자 군주**(기존 cinematic-scene-00-package.md·타이틀 계열 확립 표기, §7.2).

---

## 3. Stage 1 — Cinder Span: 각성과 첫 군단

**아크 한 줄:** 사냥꾼으로 온 자가, 자기가 사냥하는 것이 *유해*임을 알게 된다.

**긴장 곡선(비트별 목표 강도, 1–10):** 진입 3 → 사냥 4 → 추출(10초 만료 압박) 6 → 실체화 5 → 거점 7 → 보스 8 → **반전 9** → 보상 6(이완+선택 긴장).

### 3.1 씬 비트

**① 진입 내레이션** — 오디오 `narr-stage1` + 타이핑 씬 `stage1` ([narration-scripts.md](narration-scripts.md) §2). 코드 진입 메시지 `"Cinder Span opens. Follow the spoor before the bridge cools."`와 동일 정보(개방 + 시간 압박)를 KR로 재진술: *"잿빛 교량, 신더 스팬. / 재의 메아리를 사냥하고 영혼을 거두어라."*

**② 목표 수행 중 상태 메시지 톤 가이드** — 기존 lastMessage 코퍼스(8문 표본, 37–71자 실측, [narration-scripts.md](narration-scripts.md) §5) 준수:
- 현재시제 선언문. 이미지 1개 + 규칙 정보 1개("recoils; **8** ward strength remains" 구조).
- 명령형은 거부/실패 메시지 전용("Regroup and retry this stage.").
- 감탄부호 금지, 세미콜론·콜론으로 리듬. 영문 ≤90자.
- **반전 심기(plant):** 기존 hunt 메시지 `"You find a heatless footprint in the cinders."` — *열 없는* 발자국은 산 자의 것이 아니다. 이 문장이 반전 1의 공식 복선이므로 톤 통일 시 이 문장은 수정 금지.

**③ 보스 조우 — Cinder Warden** (타이핑 씬 `boss1`):
> 다리 끝, 재가 일어선다.
> 「너도 결국 나처럼 묶인다.」
> 신더 워든이 방패를 세운다.

EN 인게임 후보(미구현, 등재 후 사용): *"You will be bound, as I was bound."* — "Warden"이라는 이름 자체가 복선이다(Dusk **Warden** ↔ Cinder **Warden**). 격파 순간 코드가 `"Cinder Warden dissolves into ash. Choose one lasting boon."`을 출력 — "재로 흩어진다"가 곧 반전 문장의 방아쇠.

**④ 반전 1 — 재의 메아리는 이전 군주의 잔영이다.**
Cinder Warden의 소멸 대사(시네마틱/웹툰 컷용): 「우리는 침입자가 아니다. **남겨진 자**다.」 Ash Echo는 Echo Deep의 침략 병기가 아니라, *이전에 왕좌를 쥐었던 군주의 군단이 흩어진 잔재*다. Warden이 Arise로 결속해 온 첫 군단은 곧 **선대 군주의 유해로 빚은 군단**이다. canon 적합성: AS-WV-004는 Ash Echo를 "hostile residue"로만 규정하고 잔재의 *출처*는 침묵 → 모순 없는 확장(§7.1).

**⑤ 보상 선택 프레이밍 — Ember Cohort vs Rift Lens:**
- **Ember Cohort**(+12 slots): "더 많은 잔영을 받아들인다" — 선대의 유산을 *넓게* 껴안는 길. 반전 직후라 선택 자체가 도덕적 무게를 갖는다.
- **Rift Lens**(빙의 +1 damage): "장막 너머를 꿰뚫는 렌즈" — Stage 2 빙의 서사의 복선. *깊게* 보는 길.
- 프레이밍 카피 방향: 두 선택지를 "計승(繼承)의 폭 vs 통찰의 깊이"로 대비. 코드 전이 메시지 `"{reward} carries into Veil Citadel."`가 브릿지.

**⑥ 클리어 내레이션 → 클리프:** 선대 군주가 *있었다*면, 왕좌는 비어 있지 않다 — 누가 앉아 있는가? (Stage 2 진입 동기)

---

## 4. Stage 2 — Veil Citadel: 빙의의 대가

**아크 한 줄:** 남의 의지를 접어 넣는 자는, 자기 의지가 접히는 소리를 듣지 못한다.

**긴장 곡선:** 진입 4 → 이중 거점(동시 유지) 7 → 빙의 6 → 보스 8 → **반전 9** → 보상 6.

### 4.1 씬 비트

**① 진입 내레이션** — 오디오 `narr-stage2` + 타이핑 씬 `stage2`: *"장막 성채, 베일 시타델. / 빙의의 힘이 깨어난다. / 두 거점을 동시에 장악하라."* canon: 거울이 명령 링크를 왜곡하는 이동 요새(AS-WV-007) — "신호 거점(signal node)" 2개 동시 유지라는 규칙이 세계관(왜곡된 명령망의 재장악)과 일치.

**② 상태 메시지 톤:** §3.1-② 공통 가이드. 스테이지 고유 축: 코드의 `"A signal node bends beneath the legion's banner (n/2)."` — *bend*(구부러진다) 동사군 유지. 거울·신호·왜곡 이미지만 사용, 새 고유명사 도입 금지.
- **빙의의 대가(서사적 코스트):** 코드 메시지 `"A sentinel's will is folded into your command."` — "접어 넣는다(fold)"는 흡수이지 살해가 아니다. 상태 메시지 텍스처: 빙의 이후 Warden 시점 문장에 파수병의 잔감각(거울에 비친 자기 실루엣이 낯설다)을 1회 삽입 권장. 대가 = **Warden의 윤곽이 군주 쪽으로 물든다**(반전 3의 두 번째 복선).

**③ 보스 조우 — Veil Tactician** (타이핑 씬 `boss2`):
> 거울이 명령을 삼킨다.
> 「나는 문을 지키지 않는다.」
> 베일 택티션이 진형을 뒤집는다.

**④ 반전 2 — Veil Tactician은 문을 지키는 게 아니라 가두는 자다.**
소멸 대사(컷용): 「거울은 밖을 막는 벽이 아니다. **안을 잠그는 자물쇠**다.」 Citadel의 거울-왜곡은 침입자 방어 기제가 아니라 **Echo Throne 쪽에서 나오는 것을 가두는 봉인 진형**이다 — 왕좌의 주인이 밖으로 걸어 나오지 못하도록. Tactician은 적장이 아니라 *간수*였고, Warden은 방금 감옥 문을 연 셈이다. canon 적합성: AS-WV-007은 거울이 "명령 링크를 왜곡한다"고만 규정, 왜곡의 *목적*은 침묵 → 확장(§7.1). Moonless Court의 강령("봉쇄, 비정복")과 구조적으로 같은 논리 — 간수를 죽인 봉쇄자, 라는 아이러니가 3스테이지의 도덕적 하중을 만든다.

**⑤ 보상 선택 프레이밍 — Veil Vanguard vs Anchor Shard:**
- **Veil Vanguard**(Echo Throne에서 실체화 +1): 간수의 선봉을 넘겨받는다 — *열어버린 문 안으로 더 많은 그림자를 데려가는* 길.
- **Anchor Shard**(+16 slots): "닻의 파편" — 패배 메시지 `"The legion loses its anchor."`의 그 닻. 군단의 붕괴를 붙드는 정박물. 방금 봉인을 부순 자가 *자기 닻*을 챙기는 아이러니.
- 프레이밍 방향: "창끝 vs 닻" — 공세의 확실성 vs 존속의 보험.

**⑥ 클리어 → 클리프:** 문은 열렸다. 이제 안에서 기다리던 것과 만난다. 코드 브릿지 `"{reward} carries into Echo Throne."`

---

## 5. Stage 3 — Echo Throne: 왕좌의 진실

**아크 한 줄:** 문을 닫으러 온 자가, 문 그 자체가 된다.

**긴장 곡선:** 진입 5 → 왕좌 거점 7 → Lord's Domain(1회 한정 역전) 9 → 보스 9 → **반전 10** → 보상·에필로그 7(하강 없는 종결 — 순환 구조라 완전 이완 금지).

### 5.1 씬 비트

**① 진입 내레이션** — 오디오 `narr-stage3` + 타이핑 씬 `stage3`: *"메아리 왕좌. / 군주의 영역을 펼쳐 게이트 소버린을 무너뜨려라."*

**② 상태 메시지 톤:** 공통 가이드 + 스테이지 고유 축: 코드 `"Lord's Domain unfolds once: the abyss restores what the gate had taken."` — **심연이 Warden 편에서 복원한다.** 이 문장이 반전 3의 최종 복선이다(심연은 왜 봉쇄자를 돕는가 → 후계자를 기르고 있으므로). 톤 통일 시 이 문장 수정 금지.

**③ 보스 조우 — Gate Sovereign** (타이핑 씬 `boss3`):
> 왕좌가 그대를 부른다.
> 「빈 왕좌는 없다. 오직 교대뿐.」
> 게이트 소버린이 문을 등지고 선다.

EN 인게임 후보: *"There is no empty throne. Only succession."*

**④ 반전 3 — Gate Sovereign 처치가 곧 왕좌 계승이다 (군주의 순환 구조).**
소멸 대사(컷용): 「나도 한때, 문을 닫으러 왔다.」 Gate Sovereign은 태초의 적이 아니라 **이전 회차의 봉쇄자** — 왕좌를 무너뜨리러 왔다가 왕좌가 된 자다. 3개 복선의 회수: (1) 열 없는 발자국·선대 군주의 잔영(S1), (2) 간수가 가두던 것 = 전대 Sovereign(S2), (3) 심연이 Warden을 복원한 이유(S3). Sovereign이 소멸하는 순간 왕좌는 비지 않는다 — *가장 강한 결속자*가 그 자리를 채운다. 그것이 Dusk Warden이다. 코드의 캠페인 종결 메시지가 이를 이미 지지한다: `"…the Gate Sovereign is gone, and the Abyssal Surge endures."` — Sovereign은 갔지만 **Surge는 존속한다.** canon 적합성: AS-WV-008은 왕좌를 "held by the Gate Sovereign"으로 규정할 뿐 Sovereign의 기원과 왕좌의 승계는 침묵 → 확장(§7.1).

**⑤ 보상 선택 프레이밍 — Throne Echo vs Dawnless Crown (이중 엔딩 프레임):**
- **Throne Echo**: "군단의 마지막 서약을 기록한다" — 계승을 *거부*하려는 자의 유언. 감시자로 남겠다는 맹세의 기록.
- **Dawnless Crown**: "닫힌 문으로 벼린 왕관을 기록한다" — 계승의 *수락*. 새벽 없는 왕관.
- 두 보상 모두 효과가 "기록(records)"뿐이라는 코드 사실이 서사적으로 완벽하다: **무엇을 선택하든 순환은 멈추지 않고, 남는 것은 기록뿐이다.** 프레이밍 카피는 이 무력감을 숨기지 말 것.

**⑥ 클리어 내레이션** — 오디오 `narr-victory` + 타이핑 씬 `victory`: *"침묵한 문 앞에서, / 그림자 군단이 왕좌에 오른다. / 심연은 다음 군주를 기억한다."* (3행째는 타이핑 전용 에필로그 라인 — 오디오 원고에는 없음, [narration-scripts.md](narration-scripts.md) §2 주석.)

---

## 6. 에필로그 후크 — 다음 캠페인

Moonless Court의 왕좌 기록부에 새 이름이 오른다. 새 균열이 다른 해안에서 열리고, Court는 **새 Dusk Warden**을 보낸다 — 이번에 봉쇄해야 할 것은 *방금 왕좌에 오른 선대 감시자*다. 다음 캠페인의 1스테이지에서 플레이어가 사냥할 "재의 메아리"는, 이번 캠페인에서 플레이어가 이끌던 바로 그 군단의 잔영이다(반전 1의 구조 재귀). 패배 내레이션 `"다시, 일어나라."`(narr-defeat)는 리트라이 UX 문구이자 이 순환 구조의 주제문을 겸한다.

---

## 7. G1 자가 감사

### 7.1 본 문서 신규 서사 요소 → canon 정합 판정

| # | 신규 요소 (본 문서 도입) | 관련 canon | 판정 | 근거 |
|---|---|---|---|---|
| 1 | 반전 1: Ash Echo = 이전 군주의 잔영 | AS-WV-004 (Ash Echo) | **확장 — 모순 0** | canon은 "hostile residue"의 출처를 규정하지 않음 |
| 2 | 반전 2: Veil Citadel 거울 = 봉인 진형(가두는 자) | AS-WV-007 (Veil Citadel) | **확장 — 모순 0** | canon은 "distort command links"의 목적을 규정하지 않음; Court 강령 "contain, not conquer"(AS-WV-002)와 동형 |
| 3 | 반전 3: Sovereign 처치 = 왕좌 계승(순환) | AS-WV-008 (Echo Throne) | **확장 — 모순 0** | canon은 Sovereign 기원·승계 절차에 침묵; 코드 종결문 "the Abyssal Surge endures"와 정합 |
| 4 | 선대 군주(previous lord) 개념 | AS-WV-003/-008 | **확장 — 모순 0** | 보통명사적 지위(고유명 미부여)로 도입, 별도 등재 불요하나 서사 설정으로 기록 |
| 5 | 보스 대사 3세트 (KR/EN) | AS-WV-006/-007/-008 | **신규 — 등재 필요** | 인게임 반영 전 worldview 인벤토리·resource manifest 트레이스 필수 (미반영 시 문서 전용) |
| 6 | 타이핑 전용 라인 "심연은 다음 군주를 기억한다." | AS-WV-001 | **신규 — 등재 필요** | 동상 |

**본 문서 발생 모순: 0건.** 신규 고유명사(사람·장소·물건의 새 이름) 도입: **0건** — 모든 명명은 기존 코드·문서 표기의 재사용 또는 KR 렌더링이다(§7.2).

### 7.2 KR 렌더링 대조표 (신규 명명 아님 — 기존 영문 canon/코드 표기의 한국어 표기 고정)

| EN (canon/코드) | KR 고정 표기 | 선례 |
|---|---|---|
| Cinder Span | 신더 스팬 | narr-stage1 (AudioGen 계약 원고) |
| Veil Citadel | 베일 시타델 | narr-stage2 |
| Echo Throne | 메아리 왕좌 | narr-stage3 |
| Gate Sovereign | 게이트 소버린 | narr-stage3 |
| Ash Echo | 재의 메아리 | narr-stage1 |
| Lord's Domain | 군주의 영역 | narr-stage3 |
| Arise | 일어나라 | cinematic-scene-00-package.md §0 |
| shadow legion | 그림자 군단 | cinematic package·narr-victory |
| Dusk Warden (호칭) | 그림자 군주 | cinematic package·narr-intro |
| Cinder Warden | 신더 워든 | 본 문서 boss1 (신규 KR 표기 — 음차) |
| Veil Tactician | 베일 택티션 | 본 문서 boss2 (신규 KR 표기 — 음차) |

### 7.3 선행 불일치 목록 (본 문서 산출물 아님 — 코드/문서 기존 결함, Design 후속 등재 대상)

| 항목 | 위치 | 문제 | 조치 제안 |
|---|---|---|---|
| Cinder Warden | campaign-state.js STAGES[0].bossName | worldview 인벤토리 부재 (canon Stage 1 boss는 Rift Guardian) | §1.1 조정(개체명/종명) 채택 + AS-WV-011 등재 |
| forge node | campaign-state.js STAGES[0].objective | Sable Relay(AS-WV-005)와 지칭 분열 | §1.1 조정(Relay 정박점) 채택 + 인벤토리 주석 |
| Veil Tactician | campaign-state.js STAGES[1].bossName | worldview 인벤토리 부재 | AS-WV-012 등재 |
| 보상명 6종 (Ember Cohort, Rift Lens, Veil Vanguard, Anchor Shard, Throne Echo, Dawnless Crown) | campaign-state.js STAGES[*].rewards | worldview 인벤토리 부재 | AS-WV-013~018 등재 |

**게이트 상태 정직 고지:** worldview.md의 G1 판정은 구현 콘텐츠 인벤토리 첨부 전까지 `NOT-RUN`이다. 본 표는 시나리오 산출물의 *자가 감사*이며 G1 통과 증거가 아니다. §7.3의 4행이 등재되기 전에는 어떤 문서도 "shipped 빌드 100% trace"를 주장할 수 없다.

**측정 방법:** worldview.md 전체(AS-WV-001~010) 및 campaign-state.js STAGES/lastMessage 전 문자열을 수동 대조; 본 문서 고유명사 전수(§7.1~7.2 합산 17항목) 각각에 canon 근거 또는 선례 열을 부여. 근거 없는 항목 0.
