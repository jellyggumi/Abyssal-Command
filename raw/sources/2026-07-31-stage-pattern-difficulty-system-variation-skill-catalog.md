---
captured: 2026-07-31
capture_kind: operator-message
source: session operator (Abyssal Surge)
mutable: false
note: |
  Verbatim capture of the operator's third skill/tool catalog for this repository — stage wave and
  encounter patterns, difficulty level, numeric balance, system diversification, and the
  verification gates. Sister captures:
  raw/sources/2026-07-31-stage-map-composition-skill-catalog.md and
  raw/sources/2026-07-31-game-vfx-animation-cinematic-skill-catalog.md.
  The accompanying instruction was: "규칙을 확인하고 준수해. 게임 시스템, 레벨, 기획부분을
  업데이트할꺼야. 다음 내용 참조해서 업데이트할껀데, 각 단계별 지시사항은 스킬이용해서 디테일하게
  적용하고 개선해줘."
---

# 스테이지별 패턴 · 레벨 수준 · 시스템 다변화 패턴 구성용 AI 스킬 / 에이전트 스킬 카탈로그

> **대상:** Abyssal Surge — Abyssal-Command (Three.js / WebGL 웹 게임)
> **범위:** 스테이지별 웨이브/인카운터 패턴 · 난이도 곡선(레벨 수준) · 수치 밸런스 · 시스템 다변화(모디파이어·아키타입·룰 변주) · 검증 게이트
> **작성일:** 2026-07-31
> **자매 문서:** `game-map-dungeon-stage-ai-skills.md` · `game-vfx-animation-cinematic-ai-skills.md` · `concept-to-web-game-3d-pipeline.md`

---

## 목차

1. 로컬 에이전트 스킬 — 스테이지 패턴 / 인카운터 설계
2. 로컬 에이전트 스킬 — 수치 밸런스 / 레벨 수준
3. 로컬 에이전트 스킬 — 시스템 다변화 패턴
4. 로컬 에이전트 스킬 — 데이터·시뮬레이션 기반 튜닝
5. 로컬 에이전트 스킬 — 플레이테스트 / QA 게이트
6. 기획 프레임워크 스킬
7. 외부 레퍼런스 — 난이도 곡선 · 절차적 변주 이론
8. 외부 툴 — 밸런싱 · 텔레메트리
9. 본 저장소 적용 매핑

---

## 1. 로컬 에이전트 스킬 — 스테이지 패턴 / 인카운터 설계

| 스킬 | 쓰임새 | 업스트림 |
|---|---|---|
| `/skill:design-game-encounters` | **스테이지 패턴의 1차 도구.** 아레나 레이아웃, 적 구성, 스폰 페이싱, 목표, 보스 페이즈, 보상 케이던스. "압력원은 한 번에 하나씩 추가하고, 각 아키타입은 서로 다른 대응을 강제한다" | https://github.com/MengTo/Skills/tree/main/agent-skills/game-development |
| `/skill:tune-enemy-ai` | 적 AI의 aggro·타깃 선택·내비게이션·간격·공격 선택·텔레그래프·후퇴·보스 행동을 행동 상태머신으로. **결정론적 AI 회귀 테스트 포함** | MengTo/Skills |
| `/skill:design-action-combat` | 전투 verb 단위 타이밍 계약(startup/active/recovery, 가드·회피 윈도우, 포스처, 락온) — 난이도의 실제 단위 | MengTo/Skills |
| `/skill:build-game-monster-system` | 몬스터 아키타입을 하나의 공유 시스템으로 — hurtbox/attack volume/전투 상태, 결정론 리뷰 픽스처 | MengTo/Skills |
| `/skill:author-game-levels` | 인카운터 존·목표·게이트를 결정론적 레벨 데이터로 확정 | MengTo/Skills |
| `/skill:web-game-development` | 위 19개 웹게임 스킬 중 최적 서브스킬 라우터 | https://github.com/MengTo/Skills/tree/main/agent-skills/game-development |

## 2. 로컬 에이전트 스킬 — 수치 밸런스 / 레벨 수준

| 스킬 | 쓰임새 | 업스트림 |
|---|---|---|
| `/skill:game-studio-harness` | **5역할(디렉터·수치밸런스 디자이너·수익밴드 PM·검증엄격 프로그래머·아키타입로테이션 QA) 스튜디오 하네스.** 3단계 운영 사이클(컨셉/프레젠테이션/코어빌드 → 밸런스/코어루프/신선도 → 운영안정성/플레이임팩트)을 **8개 수치 품질 게이트**로 통제. 디자이너↔PM 서명 협상 기록 | `akillness/jeo-skills` |
| `/skill:bmad-gds` | GDD → 마일스톤 → 플레이테스트 → 런치옵스. 스테이지 단위 기획 산출물의 상위 골격 | `akillness/jeo-skills` |
| `/skill:build-game-inventory` | 아이템 스키마·스택 규칙·장비 슬롯·세이브 마이그레이션 **+ 프로그레션 시스템** — 레벨 수준과 파워 커브를 잇는 지점 | MengTo/Skills |
| `/skill:task-estimation`, `/skill:prioritization-frameworks` | 밸런스 작업 우선순위(RICE/ICE 등)와 사이징 | 로컬 번들 |

**핵심 규율:** 난이도는 "적 HP 배수"가 아니라 **플레이어에게 요구되는 대응의 종류 수**로 정의한다(`design-game-encounters`). 수치는 그 다음이며, 반드시 시뮬레이션으로 검증한다(9절).

## 3. 로컬 에이전트 스킬 — 시스템 다변화 패턴

"매 스테이지가 같은 전투의 숫자만 다른 반복"이 되지 않게 하는 축.

| 축 | 스킬 | 다변화 수단 |
|---|---|---|
| 적 행동 변주 | `/skill:tune-enemy-ai` | 아키타입별 aggro/간격/후퇴 정책 교체, 보스 페이즈 전환 |
| 공간 변주 | `/skill:author-game-levels`, `/skill:build-game-map-editor` | 아레나 형상·고저·차폐·게이트 배치 |
| 절차적 변주 | WFC / Dungeon Architect (맵 문서 참조) | 제약 기반 레이아웃 재조합 |
| 목표 변주 | `/skill:design-game-encounters` | 섬멸/방어/호위/생존/수집 등 목표 타입 교체 |
| 자원 변주 | `/skill:build-game-inventory` | 드롭 테이블·장비 슬롯·소모품 가용성 |
| 연출 변주 | `/skill:create-game-vfx`, `/skill:build-game-audio-feedback` | 텔레그래프 강도·품질 티어 |
| 규칙 변주(모디파이어) | `/skill:game-studio-harness` (신선도 게이트) | 스테이지 모디파이어·주간 룰셋 — **novelty** 지표로 측정 |
| 반복 패턴 탐지 | `/skill:pattern-detection` | 스테이지 정의/로그/텔레메트리에서 **중복 형상·이상치** 스캔 → 단조로움 조기 발견 |

`pattern-detection` 참고 도구: https://ast-grep.github.io/guide/introduction.html · https://semgrep.dev/docs/writing-rules/pattern-syntax

## 4. 로컬 에이전트 스킬 — 데이터·시뮬레이션 기반 튜닝

| 스킬 | 쓰임새 | URL |
|---|---|---|
| `/skill:data-analysis` | 결정 우선 데이터 분석(CSV/SQL/노트북/텔레메트리/실험) — 시뮬 결과 해석 | https://duckdb.org/docs/stable/guides/python/jupyter · https://pandas.pydata.org/ |
| `/skill:ab-test-analysis` | 난이도 변형 A/B 유의성·표본크기·신뢰구간 검증 | 로컬 번들 |
| `/skill:cohort-analysis` | 스테이지별 이탈/리텐션 커브 — "몇 스테이지에서 꺾이는가" | 로컬 번들 |
| `/skill:metrics-dashboard` | 클리어율·평균 시도수·평균 플레이타임 대시보드 정의 | 로컬 번들 |
| `/skill:north-star-metric` | 코어 지표 + 3~5개 입력 지표 정합 | 로컬 번들 |
| `/skill:dummy-dataset` | 튜닝 파이프라인 검증용 합성 데이터 | 로컬 번들 |
| `/skill:pattern-detection` | 메트릭 이상치·재발 패턴 1차 트리아지 | 위 URL |
| `/skill:autoresearch` | Karpathy식 자율 실험 탐색 — 밸런스 파라미터 탐색을 야간 배치로 돌릴 때의 루프 설계 참조 | https://github.com/karpathy/autoresearch |

## 5. 로컬 에이전트 스킬 — 플레이테스트 / QA 게이트

| 스킬 | 쓰임새 | URL |
|---|---|---|
| `/skill:test-playable-web-games` | 결정론 픽스처 + 실제 브라우저 증거로 E2E 게임플레이 QA, 회귀·세이브 플로우·성능 스모크 | MengTo/Skills |
| `/skill:game-demo-feedback-triage` | 플레이테스트 노트·Steam Playtest 응답·스트리머 반응을 가중 근거로 수선 우선순위화 | https://partner.steamgames.com/doc/features/playtest · https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/tips |
| `/skill:game-build-log-triage` | 빌드/CI 로그의 첫 실패 원인 특정 | 로컬 번들 |
| `/skill:build-game-changelog` | 스테이지 밸런스 변경의 인게임 릴리스 원장 — 버전 연속성·배포 provenance | MengTo/Skills |
| `/skill:ship-web-games` | 검증된 커밋만 릴리스, 프로덕션 스모크 | MengTo/Skills |

## 6. 기획 프레임워크 스킬

| 스킬 | 쓰임새 |
|---|---|
| `/skill:bmad-gds` / `/skill:bmad` | 아이디어 → GDD → PRD → 마일스톤 phased delivery |
| `/skill:task-planning` | 스테이지 배치 작업을 실행 단위로 분해 |
| `/skill:sprint-retrospective` | 마일스톤/스테이지 배치 회고 |
| `/skill:pre-mortem` | 난이도 설계 리스크 사전 분석 |
| `/skill:grill-me` / `/skill:grill-with-docs` | 밸런스 설계안 스트레스 테스트 |

## 7. 외부 레퍼런스 — 난이도 곡선 · 절차적 변주 이론

| 항목 | 설명 | URL |
|---|---|---|
| **PCG Book (Procedural Content Generation in Games)** | 절차적 콘텐츠 생성 표준 교재 — 난이도 적응(DDA), 경험 주도 PCG 장 포함. 무료 웹판 | https://www.pcgbook.com/ |
| **Dynamic Difficulty Adjustment 개관 (Hunicke, "The Case for Dynamic Difficulty Adjustment in Games")** | DDA 설계의 고전 논문 | https://dl.acm.org/doi/10.1145/1178477.1178573 |
| **MDA Framework** | Mechanics-Dynamics-Aesthetics — 시스템 변주가 체감으로 이어지는 경로 분석 틀 | https://users.cs.northwestern.edu/~hunicke/MDA.pdf |
| **Game Programming Patterns** | 상태머신·컴포넌트·타입 객체 — 다변화 시스템의 구현 패턴 | https://gameprogrammingpatterns.com/ |
| **Wave Function Collapse** | 제약 기반 조합 변주 알고리즘 | https://github.com/mxgmn/WaveFunctionCollapse |
| **GDC Vault** | 실제 타이틀의 난이도 곡선/밸런싱 사례 발표 | https://gdcvault.com/ |
| **Machinations.io** | 게임 이코노미·루프를 노드 다이어그램으로 시뮬레이션 | https://machinations.io/ |

## 8. 외부 툴 — 밸런싱 · 텔레메트리

| 툴 | 설명 | URL |
|---|---|---|
| **Machinations** | 경제/진행 루프 시뮬 — 스테이지 보상 곡선 사전 검증 | https://machinations.io/ |
| **Unity ML-Agents** | 학습 에이전트로 자동 플레이테스트·밸런스 탐색 (`/skill:npc-ml-agents`) | https://github.com/Unity-Technologies/ml-agents |
| **PettingZoo / Gymnasium** | 자체 시뮬 환경을 RL 인터페이스로 감싸 자동 플레이 밸런싱 | https://gymnasium.farama.org/ |
| **PostHog** | 오픈소스 프로덕트 애널리틱스 — 스테이지 퍼널/리텐션 | https://posthog.com/ |
| **Amplitude** | 코호트·퍼널 분석 | https://amplitude.com/ |
| **DuckDB** | 로컬 시뮬 로그 대량 집계 (`/skill:data-analysis` 기본 엔진) | https://duckdb.org/ |
| **Optuna** | 밸런스 파라미터 탐색(베이지안 최적화) | https://optuna.org/ |

## 9. 본 저장소 적용 매핑

Abyssal-Command는 **이미 스테이지 패턴·게이트·시뮬레이션 인프라를 코드로 소유**하고 있다. 위 스킬은 이 계약을 대체하지 않고, 그 안에서 저작·검증을 가속한다.

### 데이터 소유자

| 파일 | 역할 |
|---|---|
| `stage-world-catalog.js` | 스테이지/월드 정의 원장 |
| `defense-catalog.js` | 방어 유닛·적 수치 카탈로그 |
| `defense-run-simulation.js` | 런 시뮬레이션 엔진 — 밸런스 판단의 근거 |

### 실행 스크립트

| 스크립트 | 역할 | 결합 스킬 |
|---|---|---|
| `scripts/run-defense-balance-sim.mjs` | 밸런스 시뮬 배치 실행 | `/skill:game-studio-harness`, `/skill:data-analysis` |
| `scripts/run-stage1b-pressure-packets.mjs`, `export-stage1b-pressure-packets.mjs` | 스테이지 압력 패킷 산출 | `/skill:design-game-encounters` |
| `scripts/run-stage1b-symmetric-trials.mjs` | 대칭 시행으로 편향 제거 | `/skill:ab-test-analysis` |
| `scripts/evaluate-stage1b-gates.mjs` | **게이트 평가기 — 수치 품질 게이트의 실체** | `/skill:game-studio-harness` (8게이트) |
| `scripts/export-stage1b-formation-attribution.mjs` | 편성 기여도 귀속 | `/skill:data-analysis`, `/skill:pattern-detection` |
| `scripts/run-stage1b-persistence-scenarios.mjs` | 영속 상태 시나리오 | `/skill:build-game-inventory` |
| `scripts/measure-stage-playtime.mjs` | 스테이지 플레이타임 측정 | `/skill:cohort-analysis`, `/skill:metrics-dashboard` |
| `scripts/audit-stage-scenes.mjs` | 스테이지 씬 감사 | `/skill:author-game-levels` |

### 회귀 게이트 (변경 시 반드시 통과)

| 테스트 | 보증 대상 |
|---|---|
| `tests/stage-wave-doctrine.test.mjs` | 웨이브 패턴 독트린 |
| `tests/stage2-balance-retune.test.mjs` | 밸런스 리튠 계약 |
| `tests/stage1b-gate-evaluator.test.mjs`, `stage1b-g3-g7-verification.test.mjs` | 게이트 평가 정합 |
| `tests/stage1b-pressure-packets.test.mjs` | 압력 패킷 산출 |
| `tests/stage1b-persistence.test.mjs`, `stage1b-evidence-exporters.test.mjs` | 영속·증거 익스포트 |
| `tests/stage-world-encounter-routing-contract.test.mjs` | 인카운터 라우팅 계약 |
| `tests/stage-world-quest-points.test.mjs`, `stage-story-progression.test.mjs` | 진행·퀘스트 포인트 |
| `tests/defense-run-simulation.test.mjs`, `defense-stage-world-movement.test.mjs` | 시뮬 엔진·이동 |
| `tests/stage-runtime-proof-browser.test.mjs`, `progression-mobile-ui-browser.cjs` | 실제 브라우저 증명 |

### 권장 순서 (신규 스테이지 패턴 / 난이도 조정 1건)

1. `/skill:design-game-encounters` — 목표·적 아키타입·압력원·보상 케이던스를 **먼저 언어로** 확정
2. `/skill:tune-enemy-ai` — 아키타입별 행동 정책 차이를 상태머신으로 명시(숫자보다 행동 먼저)
3. `stage-world-catalog.js` / `defense-catalog.js` 수정 — 데이터 원장에만 변경 반영
4. `scripts/run-defense-balance-sim.mjs` + `run-stage1b-symmetric-trials.mjs` — **수치 판단은 시뮬 결과로만**
5. `scripts/evaluate-stage1b-gates.mjs` — 게이트 통과 여부 확인, `/skill:data-analysis`로 실패 게이트 원인 분해
6. `/skill:pattern-detection` — 기존 스테이지와의 중복 형상 스캔(단조로움 방지), 필요 시 3절의 다변화 축 하나를 교체
7. `tests/stage-wave-doctrine` · `stage2-balance-retune` · `stage1b-*` 회귀 + `/skill:test-playable-web-games` 브라우저 증명
8. `/skill:build-game-changelog` — 밸런스 변경을 인게임 릴리스 원장에 기록 → `/skill:ship-web-games`

---

**출처:** 1~6절의 스킬 설명·업스트림은 `~/.agents/skills/*/SKILL.md` frontmatter에서 직접 추출. 9절은 본 저장소의 실제 `scripts/`·`tests/`·루트 카탈로그 파일 목록에 기반. 7~8절 외부 URL은 공개 페이지 기준이며 링크 라이브 검증은 하지 않았다.
