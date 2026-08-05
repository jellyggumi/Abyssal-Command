# Cycle 1 Retrospective — 20260728-gameplay-gap-research

## 성격
연구+회의 사이클(구현 아님). 요청: 현 구조 파악 → 동일 장르 게임 조사 → 게임성 갭 도출 → 데이터 기반 회의. deep-research(outline→deep→report) + game-studio-harness 회의.

## 산출물 (전부 `_workspace/20260728-gameplay-gap-research/`)
- `production/current-structure-baseline.md` — 코드 file:line 검증 현 상태 (HEAD 2166c52)
- `engineering/current-systems-inventory.md` · `intake/design-intent-digest.md` — 베이스라인 근거 2종
- `research/comparable-gameplay/{outline.yaml,fields.yaml,report.md}` + `results/*.json` ×10 — 10게임·152출처, 필드커버리지 100% 검증
- `production/gap-analysis.md` — 5갭 × 10게임 매트릭스 + 우선순위
- `{design,pm,engineering,qa,ui}/meeting-position-*.md` ×5 — 전문 포지션
- `production/meeting-record.md` — director 종합 + 차기 판정

## 게이트 측정치 (참고 — 이번은 연구사이클이라 G1-G8 신규 측정 아님; 기존 stage1b 값 인용)
- G2 밸런스: legal-combo maxEV/medianEV **1.70** (목표 ≤1.30) — FAIL
- G3 플레이어타입: 동료 다운 **0/100**, 스위치후 데미지 **0/50** — FAIL
- G6 성능: 미드티어 p95 **33.3ms**, low **50ms**, soak heap **0.1138 MiB/min** — FAIL
- G7/G8: human **0/10** — 미측정
- G8 노벨티(초안): 차별축 4개(true-offline+capture+formation+무수익화) 동시보유 = 10비교작 중 유일

## 핵심 결과
1. **만장일치(5/5) Stage 1 컨셉 시프트** — 단 G6 성능 + G2 밸런스 선결 게이트. 실패는 밸런스 숫자가 아니라 루프 모양(풀클리어=재투자 소멸).
2. **최소 스텝 5/5 수렴** — 아이들 `totalProgress`(vanity, `campaign-state.js:248`)를 소비 화폐 "Undertow Silt"로 배선 → 워든 메타 싱크(dead 동료 3 활성). meta+UI only, getRunDigest 바이트동일.
3. **QA 신규 코드 발견** — `campaign-state.js:218,220,241` wardlinePressure 8-캡으로 ENCROACHED가 ~8클리어 후 dead. 아이들이 소비 가능해지면 무한재투자 exploit. S0에서 선결.
4. **데이터가 브리핑 전제 정정** — LoM은 계정 리셋 프레스티지 아님(무한 스테이지+스택 영구배수). Kingshot 디펜스는 온보딩 훅일 뿐 코어는 4X.

## 미해결 리스크
- red 베이스라인(G2/G3/G6 FAIL) 위 신규 피처 = 3연속 이월 반복 위험. → 판정: S0 게이트 복구 선행.
- 엔드리스/추가 액터는 G6 통과 전 금지(Soulstone 후반 붕괴 선례).
- G7/G8 human 검증은 여전히 시뮬 대체 불가 — 4사이클째 구조적 공백.

## 차기 사이클 진입 결정
**하이브리드: 컨셉 시프트 승인 · 진입은 Stage 2 게이트-복구(S0)** → 직후 **S1 = G2 아이들 싱크**(첫 피처, sim 무위험, 5/5 수렴). S2 엔드리스 티어 래더는 G6 통과 뒤, S3 포메이션 깊이는 밸런스 green 뒤. 시퀀스·게이트는 `production/meeting-record.md` §4.

## 다음 공개 비트
아이들 정산이 vanity 카운터가 아니라 실제 워든 파워로 재투자되는 빌드(Undertow Silt → 동료 레벨링), idle:active ≤0.30 · EV ≤1.30 · getRunDigest 바이트동일로 검증. 단 pressure 캡 해제 + G2/G6 복구가 선결.
