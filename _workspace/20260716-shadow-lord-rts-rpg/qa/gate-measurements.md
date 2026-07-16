# Gate measurements ledger

**Navigation:** [production contract](../production/production-contract.md) · [retrospective schema](../retrospectives/cycle_retrospective.py) · [task manifest](../production/task-manifest.md)

Gate-level `PASS` requires evidence for every threshold component; a target or documentary plan is never a measured value. Simulator rows label only what `node scripts/run-campaign-balance-sim.mjs` currently measures; a passing sampled sub-check does not promote an incomplete G2.

## G1

| Threshold | Current measured value | Method | Evidence | Verdict |
|---|---|---|---|---|
| 0 un-waived lore violations; 100% player-visible source traceability | lore-violation count: not-run; trace coverage: **failed** | direct source-to-worldview audit | `app.js` (`BOSS_SPEC` player-visible lore), `campaign-state.js` (`STAGES` objectives/rewards/messages), `design/worldview.md` §§24–32 | **FAIL** — the current source has no `AS-WV-*`/`inventory_id` trace metadata; e.g. `Cinder Warden`, `Veil Tactician`, `Ember Cohort`, and `Abyssal Banner` are player-visible but are not inventory-mapped. The documented Stage 1 boss is `Rift Guardian`, not `Cinder Warden`. A QA violation/waiver audit is also absent, so the zero-violation component remains NOT-RUN. |

## G6 (Stage 1 operations draft)

| Threshold | Current measured value | Method | Evidence | Verdict |
|---|---|---|---|---|
| telemetry fields implemented; rollback tested; p95 frame ≤16.7 ms; long frames <0.5%; 30-min stable memory; input ≤100 ms | not-run | instrumented browser/mobile session | `ops/telemetry-contract.md`, `engineering/architecture-contract.md` (plans only) | NOT-RUN |

## G2 — current simulator reconciliation

**Gate verdict: `NOT-RUN`.** Method: `node scripts/run-campaign-balance-sim.mjs` from the repository root. Evidence: current command stdout produced by `scripts/run-campaign-balance-sim.mjs` against `campaign-state.js` (`abyssal-surge-rules-v2`); no dated build/session ID or retained run artifact is asserted. The command supplies deterministic policy, casual-walker, and selected-combo measurements, not complete G2 coverage.

| Threshold component | Current result | Method | Evidence | Verdict |
|---|---|---|---|---|
| Every mechanic and matchup covered | no coverage matrix or matchup dataset emitted | simulator policy/fuzzer inspection | `scripts/run-campaign-balance-sim.mjs` (`ACTIONS`, `measureArchetypes`, `measureCombos`, summary) | **NOT-RUN** — the report gives policies and a fuzzer total, not per-mechanic coverage or matchup win rates. |
| Matchup win rates 45–55% | casual seeded legal walker: **55.0%** (110/200 wins; 90 defeats, all `echo-throne`) | 200 deterministic seeds (`archetypes.casual`) | current command stdout; `scripts/run-campaign-balance-sim.mjs` `CASUAL_TRIALS = 200` | **measured — in band for this one walker, not a complete matchup result** |
| TTK within ±15% | optimal action proxy: S1/S2/S3 **9/10/6** actions; derived 30–150 s only under the simulator's unmeasured 5–15 s/action assumption | action-count proxy | current command stdout `g7Proxy`; `scripts/run-campaign-balance-sim.mjs` `SEC_PER_ACTION_MIN/MAX`; `design/balance-sheet.md` §남은 미해결 수치 | **NOT-RUN** — no TTK target/baseline or elapsed-time measurement exists, so ±15% cannot be calculated. |
| No combo EV >1.3× median | selected 4-combo subset: max/median **1.118571×** | adaptive-optimal run across `ember-cohort`/`rift-lens` × `veil-vanguard`/`anchor-shard` | current command stdout `comboEv`; `scripts/run-campaign-balance-sim.mjs` `measureCombos`; `campaign-state.js` `STAGES` rewards | **NOT-RUN** — the measured subset is below 1.3×, but the runner omits `stillwater-hourglass`, `shadebreaker-brand`, and `abyssal-banner`; all live reward pairs have not been evaluated. |

## G3 — 아키타입 다양성 재측정

측정: 동일 명령 · 2026-07-16T15:22:22Z.

| Threshold | Current measured value | Method | Evidence | Verdict |
|---|---|---|---|---|
| 유효 아키타입 ≥3 | **4/5 승리 가능 + 1 의도적 패배 교본.** optimal(25act·counter-1 티어), greedy(56act·만벽 fortress), comeback(27act·domain 역전), casual(51%)이 서로 다른 시퀀스·결과로 완주. rusher는 S3 사망 — "domain 없는 얇은 돌격은 죽는다"는 규칙의 실증 | 아키타입별 시퀀스 서명 + 결과 궤적 비교 | stdout `diversity` (`uniqueDeterministicSequences: 4`, `distinctDeterministicOutcomes: 4`) | measured — 충족 (v1: 사실상 1종) |
| 지배 아키타입 ≤50% | 결정론 4종 결과 4종 분화(승률 0/100 × 액션 19–56 × integrity 궤적 상이). comeback은 rusher와 S1/S2 동일 궤적에서 domain 결정 하나로 승패가 갈림 — 전략 선택이 결과 변수를 실제로 지배 | 시퀀스 서명 4종/4종, branch census | stdout `diversity.branchCensus` (결정 지점 중 복수 선택지 비율: optimal 0.76, greedy 0.84, rusher 0.68, comeback 0.67, casual 0.89) | measured — 충족 |
| comeback 성립 | domain 발동 전 integrity 3 → +4 회복 + aegis 2로 반격 2회 무효 → 동일 라인이 domain 없으면 defeat, 있으면 완주 | 계약 프로브 쌍(동일 S1/S2, S3만 분기) | stdout `contractProbes.comebackDomainFlip`, `domainConvertsDefeatToWin: true` | measured — 충족 (v1: 구현 불가) |

## G7 — 루프 구조 (시뮬 proxy + 라이브 측정)

측정 1: `node scripts/run-campaign-balance-sim.mjs` · 2026-07-16T15:22:22Z (proxy, 액션당 5–15 s 가정).
측정 2: **라이브 브라우저 세션** (Playwright/헤드리스 Chromium, localhost:8123, rules v2, 봇 페이스 0.50–0.62 s/액션) · 2026-07-16.

| Threshold | Current measured value | Method | Evidence | Verdict |
|---|---|---|---|---|
| period 30–180 s | **라이브 스테이지 클리어 실측**: legion-build 정책 S1 7.1 s/14act · S2 8.8 s/16act · S3 9.3 s/17act (봇 페이스 0.5 s/act) → 인간 페이스 환산(5–15 s/act) S1 70–210 s, S2 80–240 s, S3 85–255 s. **인간-사고시간 세션**(0.62 s/act + 내레이션 대기): S1 26.6 s/9act — 동일 환산 45–135 s. 75 s 설계 목표는 9–14act × 5–15 s/act 밴드의 중앙 | 라이브 UI 자동 조작 (stage-clear 이벤트 타임스탬프) | 본 문서 측정 2 로그; `qa/playtest-report.md` | measured(live-bot) — 환산 밴드 내, 상단 여유 축소 주의 (S2/S3 액션 수 증가 시 180 s 초과 위험) |
| ≥3 actions/loop | 라이브 9–17 act/스테이지 (시뮬 6–10과 정합; 봇의 경제 루프 추가 사용 반영) | 동일 | 동일 | measured — 충족 |
| ≥1 reward event/loop | 스테이지당 정확히 1 (라이브 3/3 스테이지 재현) | 라이브 stage-clear 로그 | 동일 | measured — 충족 |
| repeat proxy ≥70% | **부분 실측**: 봇 세션은 자발 의사 없음. 완주 직후 재시작 버튼 동작 확인(1/1). 인간 자발 반복 10세션은 여전히 필요 | 완주 → restart 클릭 검증 | 본 문서 | PARTIAL — 인간 세션 필요 |

라이브 측정 로그 (legion-build, 2026-07-16): `[{stage-clear S1 t=7.095 act=14 int=7}, {stage-clear S2 t=15.929 act=30 int=5}, {stage-clear S3 t=25.233 act=47 int=0}, {campaign-complete t=25.963}]` — Stage 3를 integrity 0 직전에 클리어(사망 직전 승리 서사 실증). assault-우선 무모 정책은 S2에서 패배 도달(defeat/retry 경로 라이브 재현, B1 해소 실증).

## Future gate slots

G2/G3/G7 시뮬레이션 수치는 위에 부착됨(밸런스 v2). G5, G8 attach in Stage 2; G4 and final G6 attach in Stage 3. Each must state canonical threshold, measured value, method, evidence paths, timestamp, revision loops, and verdict.
