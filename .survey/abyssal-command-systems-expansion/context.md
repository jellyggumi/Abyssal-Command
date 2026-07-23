# Context: Abyssal Command Systems Expansion

## Workflow Context
**[OBSERVED — direct local retrieval]** 현재 계약은 모바일 우선 단일 플레이, 자동 기본 공격·이동 우선 입력, 고정 60 Hz 결정론, 로컬 우선 저장, 10단계 종료, 감소된 모션의 정적 의미 보존을 요구한다. 다음 90초 슬라이스는 전투 피드백, 명시적 성장/보상 선택, 오프라인 귀환 주장, 시드 스테이지→월드 서사 핸드오프를 함께 시험한다.

**[BOUNDARY]** 전투/목표/보상/진행은 확정된 시뮬레이션 상태에서 먼저 결정된다. Canvas·HUD·VFX·오디오·내레이션·측정은 그것을 표시하거나 기록할 수만 있고 RNG, 입력 순서, 타깃, 피해, 쿨다운, 추출, 스테이지 결과를 바꿀 수 없다. 네트워크, 계정, 상거래, 광고, 원격 텔레메트리, 클라우드 동기화, 백그라운드 전투는 없다.

## Affected Users
| Role | Responsibility | Skill Level |
|------|----------------|-------------|
| 이동 중심 플레이어 | 위험을 읽고 경로·능력 선택으로 생존 | 초심~숙련 |
| 감각/입력 제약 플레이어 | 음소거, 모노, 감소된 모션, 키보드·컨트롤러로 같은 의미와 조작 접근 | 다양함 |
| 콘텐츠·밸런스 설계자 | 저작된 목표·보상·맵 범위 안에서 선택/압력 변형을 설계 | 전문 |
| QA·플레이테스트 진행자 | 고정 시드/입력/시계 결함으로 재현성·이해도·공정성을 반증 | 전문 |

## Current Workarounds
1. **[OBSERVED]** 유사 장르는 한 손 자동전투, 절차적 공간/웨이브, 런 간 성장 또는 목표·추출 핸드오프을 공개적으로 내세운다. 그러나 이것은 구조의 존재만 보이며 내부 알고리즘·효과·접근성 성과는 증명하지 않는다.
2. **[INFERENCE]** 정보 과밀을 피하려면 일반 타격은 집계/생략하고, 위험·피해·보스·스킬 준비·결과만 다중 감각의 정적 대안을 가진 우선순위 신호로 남긴다.
3. **[INFERENCE]** 절차성은 자유 목표 생성 대신 저작된 의미 백본과 유한 모듈 팔레트에서 시드가 경로/압력만 선택하는 방식으로 제한한다.
4. **[INFERENCE]** 부재 보상은 전투를 시뮬레이션하지 않고, 한 번 정산되는 제한적·결정론적 Archive 준비 크레딧으로 축소한다. 시계 역행·저장 실패는 벌이 아니라 0 보상/명시적 실패로 처리한다.
5. **[INFERENCE]** 내레이션·생성 음원은 확정 이벤트의 캡션 우선 관찰자이며, 외부 음성 생성은 권리 검토된 정적 자산을 빌드 시 반입할 때만 가능하다.

## Adjacent Problems
- **선택 과부하:** 선택 수가 많거나 효과가 불투명하면 자율성 대신 지연·후회가 생길 수 있다. 3개의 비교 가능한 런 한정 선택과 기계적 결과 표시는 **[TARGET]**이며 측정 전에는 효능을 주장할 수 없다.
- **장기 공정성:** 영구 수집이 원시 전투 수치 우위가 되거나 오프라인 보상이 동료/스테이지/보스를 완료하면 이동 숙련을 대체한다.
- **표현 권위 누출:** 오디오 완료, 애니메이션, 화면 회전, 감소된 모션, 실험 코호트가 규칙 상태를 바꾸면 재현성과 공정성이 동시에 무너진다.
- **접근성과 밀도의 충돌:** 모든 타격에 텍스트·소리·효과를 중복하면 위험 신호가 묻힌다. 필수 의미의 중복과 비필수 질감의 집계는 분리해야 한다.
- **현지 시간 신뢰성:** 오프라인 기기는 신뢰할 수 있는 시간 증명이 없으므로, 시간 조작 방지는 제한된 이득·단일 정산·영수증으로만 다룬다.

## User Voices
- 직접 인터뷰, 설문, 상점 리뷰 코딩, 플레이테스트 발화는 제공된 패킷에 **없다**. 따라서 “플레이어가 재미있다/이해한다/재방문한다”는 관측된 사용자 목소리가 아니다.
- **[OBSERVED — direct page retrieval]** `Deep Rock Galactic: Survivor`의 공식 페이지는 절차적 동굴·웨이브와 목표/추출을, `Vampire Survivors`의 공식 페이지는 런 중 획득과 다음 런 업그레이드를 제품 설명으로 제시한다. 이는 사용자 증언이나 인과 효과가 아닌 제품의 공개 주장이다.
- **정확한 공개 증거 공백:** 90초 슬라이스에서 위험 방향, 치명타, 건강/게이트, 선택 효과, 귀환 영수증, 스테이지 목표를 이해하는지에 대한 한국어권·음소거·감소된 모션·보조 입력별 관측치는 없다.

## Source Ledger
| ID | Evidence label | Source URL | 사용 한계 |
|---|---|---|---|
| C1 | **direct page retrieval** / 현재 제품 계약 | `docs/abyssal-command-defense-survivor-design.md` | 60 Hz, 오프라인, 이동 우선, 10단계 경계를 정한다. 시장 성과 증거가 아니다. |
| C2 | **direct page retrieval** / 공식 제품 페이지 | https://store.steampowered.com/app/2321470/Deep_Rock_Galactic_Survivor/ | 절차적 임무·웨이브·추출의 공개 구조만 확인한다. |
| C3 | **direct page retrieval** / 공식 제품 페이지 | https://store.steampowered.com/app/1794680/Vampire_Survivors/ | 단순 생존과 런 간 업그레이드의 공개 구조만 확인한다. |
| C4 | **direct page retrieval** / 표준 | https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html | 초당 3회 초과 플래시 금지 방향의 안전 경계다. 게임 적합성 인증은 아니다. |
| C5 | **direct page retrieval** / 접근성 지침 | https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103 | 색/소리/햅틱 단독 필수 정보 금지 방향을 뒷받침한다. |
| C6 | **direct page retrieval** / 학술 연구 | https://doi.org/10.26503/todigra.v3i3.81 | 대리 플레이가 행위성을 약화할 수 있다는 분석이다. 최적 귀환 상한을 제공하지 않는다. |
| C7 | **direct page retrieval** / 알고리즘 저자 문서 | https://www.pcg-random.org/using-pcg-c-basic.html | 동일 초기화의 결정적 PRNG 사용을 뒷받침한다. 게임 전체 재현성을 보장하지 않는다. |
| C8 | **direct page retrieval** / W3C 매체 접근성 | https://www.w3.org/WAI/media/av/ | 의미 있는 음향의 캡션/대본 필요성을 뒷받침한다. 전투 UI 전체 명세는 아니다. |
| C9 | **direct page retrieval** / 제공자 문서 | https://elevenlabs.io/docs/api-reference/text-to-speech/convert | 음성 합성 기능만 문서화한다. 런타임 사용·권리 승인·한국어 품질을 보장하지 않는다. |
