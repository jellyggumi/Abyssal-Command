# Abyssal Surge — Stage 1

[![Deploy to Pages](https://github.com/jellyggumi/Abyssal-Surge/actions/workflows/static.yml/badge.svg)](https://github.com/jellyggumi/Abyssal-Surge/actions/workflows/static.yml)
[![GitHub Pages](https://img.shields.io/github/deployments/jellyggumi/Abyssal-Surge/github-pages?label=GitHub%20Pages)](https://jellyggumi.github.io/Abyssal-Surge/)
![Top Language](https://img.shields.io/github/languages/top/jellyggumi/Abyssal-Surge)
![Repo Size](https://img.shields.io/github/repo-size/jellyggumi/Abyssal-Surge)

---

## 🎮 게임 소개 (Game Introduction)

**Abyssal Surge — Stage 1**은 웹 브라우저 로컬 환경에서 실행되는 결정론적(Deterministic) 전술 전략 시뮬레이션 게임입니다. 

플레이어는 **The Stewardship(수호자)** 진영을 지휘하여 심연의 위협인 **The Abyssal Terror(심연의 공포)**와 대적하게 됩니다. 게임은 총 5회의 조우(Encounter)로 구성된 캠페인 형식으로 진행되며, 적의 예정된 행동 정보(STRIKE / SURGE 공격 의도)를 미리 파악하고 자원을 배분하여 적을 무찌르거나 공격을 막아내는 전술 퍼즐형 메커니즘을 가지고 있습니다.

### ⚠️ GitHub Pages 배포 제약 사항 및 로컬 실행 권장
GitHub Pages에 배포되는 라이브 서비스는 보안 및 자산 경계 거버넌스 정책에 따라 오직 5개의 정적 핵심 파일(`index.html`, `app.js`, `game-core.js`, `styles.css`, `privacy.html`)만 업로드하는 제한적인 배포 명세(`static.yml` allowlist)를 사용합니다.

이에 따라, **온라인 배포 페이지에서는 배경음/효과음 오디오(`assets/audio/`), 캐릭터 및 카드 이미지(`assets/images/`), PWA 서비스 워커(`sw.js`), 앱 매니페스트(`manifest.json`), 그리고 아이콘(`icon.svg`) 파일이 배포 대상에서 제외됩니다.** 이로 인해 온라인 페이지에서는 해당 미디어 자원들과 PWA 기능을 제공하지 않으며 텍스트 및 레이아웃 기반의 코어 로직만 동작합니다.

**사운드와 다이내믹 시각 효과(VFX), 아바타 이미지 등을 포함한 온전한 PWA 게임 경험을 누리기 위해서는 반드시 저장소를 클론한 뒤 로컬 컴퓨터 환경(Local/Source-only Run)에서 실행해주시기 바랍니다.**

---

## ⚙️ 핵심 메커니즘 (Core Mechanics)

### 1. 결정론적 상태 감소기 (Deterministic Reducer State Machine)
게임의 모든 전투 판정은 동일한 입력(커맨드, 틱, 시퀀스 정보)에 대해 항상 동일한 출력 상태를 보장하도록 설계된 무상태(Stateless) 감축기(`reduceEncounter`)를 통해 이루어집니다. 마우스/터치 클릭과 키보드 단축키 입력 모두 이 결정론적 상태 머신으로 통일되어 정확한 동기화를 보장합니다.

### 2. 전술 액션 카테고리 (Semantic Commands)
플레이어는 매 라운드 1의 포커스를 회복하거나 소모하여 아래의 커맨드 중 하나를 입력할 수 있습니다.
*   **STRIKE (공격)**: 포커스 1을 소모하여 적의 체력(Foe Health)을 2만큼 감소시킵니다.
*   **BRACE (방어)**: 포커스 1을 소모하여 적의 `STRIKE` 피해를 흡수하는 가드(Guard) 수치를 2만큼 채웁니다.
*   **DISRUPT (방해)**: 적의 공격 의도가 `SURGE`일 때만 유효하며, 포커스 1을 소모하여 적의 체력을 1 감소시키고 강력한 `SURGE` 피해와 압박(Pressure) 증가를 완전히 무력화시킵니다.
*   **RECOVER (회복)**: 현재 포커스가 2 이하일 때만 사용할 수 있으며, 포커스 1을 즉시 충전합니다.

### 3. 승리 및 패배 조건 (Outcomes & Rules)
*   **VICTORY (승리)**: 적의 체력(Foe Health)이 0이 되면 즉시 승리하며 캠페인 조각(Fragments) 2개를 획득합니다.
*   **HOLD (버티기)**: 적의 모든 공격을 버텨내고 예정된 모든 라운드를 생존하여 생명력을 지키면 버티기 성공으로 판정되어 조각 1개를 획득합니다.
*   **DEFEAT_INTEGRITY (생명력 소진 패배)**: 플레이어의 생명력(Integrity)이 0이 되면 게임오버가 되며 조각 0개를 얻습니다.
*   **DEFEAT_PRESSURE (압박 수치 패배)**: 심연의 압박(Pressure) 게이지가 최대치인 4에 도달하면 패배(0개 획득)로 처리됩니다.
*   **정산 (Settlement)**: 캠페인에서 획득한 조각들은 징표(Resolve Marks)로 정산됩니다. (징표 1개당 3 조각 소모, 최대 2개 징표 교환 가능)

### 4. 실시간 연출 엔진 & PWA (로컬 실행 시에만 온전히 지원)
*   `requestAnimationFrame` 기반의 실시간 렌더링 루프로 아군 요새(Castle)와 포탈 간 유닛들의 이동 및 격돌 상태를 다이내믹하게 묘사합니다.
*   공격/방어/방해 동작 시 발생하는 Visual FX 오버레이 효과가 전투의 몰입감을 더해줍니다.
*   PWA(Progressive Web App)를 지원하도록 Service Worker(`sw.js`)와 Manifest가 구성되어 있어, 로컬 실행 시 브라우저 오프라인 환경에서도 설치 및 즉시 플레이가 가능합니다.

---

## 📂 프로젝트 구조 (Project Directory Structure)

```text
Abyssal-Surge/
├── index.html          # 게임 메인 UI 구조 및 Cloudflare 웹 애널리틱스 동의 배너
├── styles.css          # 다크 판타지 스타일의 CSS 및 반응형 디자인 레이아웃
├── app.js              # UI 이벤트 바인딩, 다국어(EN/KR) 사전 토글, 오디오 믹서, 실시간 연출 컨트롤러
├── game-core.js        # 게임 규칙 버전을 정의한 무상태 결정론적 Reducer 및 Replay 검증 엔진
├── sw.js               # 오프라인 정적 파일 캐싱을 위한 서비스 워커 (PWA - 로컬 전용)
├── manifest.json       # PWA 설치 명세서 (로컬 전용)
├── privacy.html        # 데이터 수집 최소화를 보장하는 개인정보 처리방침 페이지
│
├── assets/             # 게임 리소스 폴더 (로컬 전용)
│   ├── images/         # 일러스트(스테이지 1~5), 아바타(수호자, 심연의 눈) 및 결과 이미지
│   └── audio/          # 오디오 배경음, 각 행동별 효과음(Strike, Brace 등) 및 네레이션 음원
│
├── tests/
│   ├── game-core.test.mjs             # 상태 변화 및 정산 규칙에 대한 결정론 검사 유닛 테스트
│   ├── stage1-vertical-slice.test.mjs  # UI 컨트롤 바인딩 및 정적 배포 상태 검증
│   ├── playtest-5-stages.test.mjs     # 5단계의 전체 캠페인 시뮬레이션 통합 플레이테스트
│   ├── validate-cycle-retrospective.test.mjs # 거버넌스 사양 검증 및 정책 제약사항 테스트
│   ├── test_workflow_state.py         # 파이썬 기반 거버넌스 워크플로우 상태 검증 테스트
│   ├── test_workflow_contract.py      # 파이썬 기반 거버넌스 워크플로우 계약 조건 테스트
│   └── playtest-browser.cjs           # Playwright 헤드리스 브라우저 테스트 및 캡처 스크립트
│
└── _workspace/         # 사이클 1~4까지 진행된 설계, 기획, QA, 밸런스 등 역사적 이력 아카이브
```

---

## 🧪 테스트 및 실행 방법 (Execution & Testing Guide)

### 1. 로컬 실행
브라우저에서 정적 파일을 바로 실행할 경우, 모듈 임포트(`type="module"`) 정책으로 인해 로컬 웹 서버가 필요합니다.
```bash
# Python을 사용한 초간단 웹 서버 실행
python -m http.server 8000
```
웹 서버 실행 후 브라우저에서 `http://localhost:8000`으로 접속하여 모든 오디오 및 시각 효과가 포함된 온전한 게임을 즐기실 수 있습니다.

### 2. 테스트 스위트 실행
본 저장소는 자바스크립트 테스트 및 파이썬 거버넌스 테스트를 포함하고 있습니다.

#### JavaScript 테스트 실행 (Node.js v18 이상 권장)
```bash
node --test tests/game-core.test.mjs tests/stage1-vertical-slice.test.mjs tests/playtest-5-stages.test.mjs tests/validate-cycle-retrospective.test.mjs
```

#### Python 테스트 실행 (Python 3.10 이상 권장)
```bash
python3 -m unittest tests/test_workflow_state.py tests/test_workflow_contract.py
```
