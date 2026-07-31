# echo-throne doctrine retune — evidence (2026-07-31)

Change under test: the `echo-throne` row of `STAGE_WAVE_DOCTRINE` in `defense-catalog.js`
(`classes` → flanker/ranged/guardian/rusher, `kindCycle` → normal,mid,normal,big,normal,
`midbossEnemy` → ranged). Nothing else moved.

**Isolation.** Another session was concurrently editing `defense-run-simulation.js` (arrival
choreography). Every measurement below was therefore taken in a sandbox built by **copying**
`git show HEAD:<file>` for every root `*.js` (never symlinking — Node resolves a symlinked module
from its realpath and would silently load the working-tree file), then swapping in exactly one
candidate `defense-catalog.js`.

| File | Produced by | Reads |
|---|---|---|
| `balance-head.json` | `node scripts/run-defense-balance-sim.mjs --strict` in the HEAD sandbox | determinism + termination baseline |
| `balance-mycatalog.json` | same command, HEAD simulation + retuned catalog | `pass: true`, stages 1–2 digests byte-identical, `echo-throne` FINAL_COMPLETION ×3 |
| `playtime-baseline-head.json` | `node scripts/measure-stage-playtime.mjs --seeds 3` in the HEAD sandbox | 192.13 / 205.27 / 210.08 s medians |
| `playtime-mycatalog.json` | same command with the retuned catalog | 192.13 / 205.27 / 209.68 s medians, 9/9 victories, 9/9 in the 180–360 s target |
| `stage-variation-before.json` | `node scripts/scan-stage-variation.mjs` before the retune | response types 16 → 17 → **16**, two escalation failures |
| `stage-variation-after.json` | `node scripts/scan-stage-variation.mjs --strict` after | `pass: true`, worst pair 3/20 = 0.15, response types 16 → 17 → 17 |
| `probe-digest.mjs` | `node _workspace/current/qa/stage-variation-retune-20260731/probe-digest.mjs` | the three pinned `<stage>/<seed>/500 bare` digests, for recomputing the fixture in `tests/defense-run-simulation.test.mjs` |

Resolved: the pinned `echo-throne/12/500 bare` fixture in `tests/defense-run-simulation.test.mjs`
was re-baselined to `01972547729aa402735cb70eef54c126a816ec062bc2e165a511e04de825107a` — the value
both the HEAD sandbox and the working tree produce for this catalog, once the concurrent arrival
work had become digest-neutral at every pinned checkpoint (the `cinder-span` and `abyss-chancel`
rows are unchanged). `node --test tests/defense-run-simulation.test.mjs` → **40 / 40 / 0**.

Still open and NOT owned by this change: `tests/defense-expansion-contract.test.mjs` fails
`gate pressure advances toward the gate` (15/17) in the working tree. HEAD simulation + HEAD catalog
is 17/17 and HEAD simulation + this catalog is 17/17, so the assertion belongs to the in-flight
arrival work in `defense-run-simulation.js`.

---

# 실행 기록 — 2026-07-31 (계획 v4, 브랜치 `retune/echo-throne-response-types`)

승인: 사용자 `실행ㄱㄱㄱ`. 합의: Architect / Critic 모두 APPROVE_WITH_CHANGES(3차).
격리: `git worktree add -b retune/echo-throne-response-types ../abyssal-retune HEAD` + `ln -s node_modules`.
원 트리는 무변형 — 상대 세션의 미커밋 6파일(`defense-run-simulation.js`, `battle-realtime-three.js`,
`tests/combat-presentation-contract.test.mjs`, `tests/stage-wave-doctrine.test.mjs`,
`scripts/run-stage1b-pressure-packets.mjs`, `wiki/concepts/motion-generation-for-runtime-rigs.md`)은 그대로 남아 있다.

## AC 결과

| AC | 결과 | 증거 |
|---|---|---|
| AC-1 소유권 대조 | PASS | `git status --short` 대조 후 명시 pathspec만 스테이징, 상대 세션 파일 0건 포함 |
| AC-2 1차 커밋 | PASS | 55 files / +71154 |
| AC-3 워크트리 격리 | PASS | 원 트리 상대 세션 6파일 잔존 확인 |
| AC-4 커밋 단계 | PASS | 브랜치 신규 커밋 4개(①리튠+래칫+문서 ②계측 ③증거 ④브라우저 캡처 도구+증거) |
| AC-5 저비용 3수트 | 부분 | **63 tests / 62 pass / 1 fail / 119961 ms**. 실패 1건은 `stage1b-persistence`의 exporter 시맨틱 digest 불일치 — **깨끗한 HEAD 워크트리에서도 동일 실패(10/11)** 로 사전 존재 결함임을 격리 증명 |
| AC-6 verdict 생성 | PASS | `qa/evidence/gates/stage1b-verdict.json`, `overallDisposition: BLOCKED` |
| AC-7 G7/G8 BLOCKED 명시 | PASS | `--g7/--g8-*` 미공급 → `artifact path was not supplied` → 자동 BLOCKED |
| AC-8 계측 확장 | PASS | `--depth`, `--seed-list`, `minGateIntegrity` 추가(커밋 ②) |
| AC-9 20런 | PASS | cinder-span × 시드 401-405 × depth 0/1/2/3, `depth/playtime-depth{0..3}.json` |
| AC-10 뎁스 순서 검증 | **FAIL → 발견으로 기록** | 아래 §심연 뎁스 참조 |
| AC-11 브라우저 증거 | **PASS** | `midboss-evidence.json` + `.png` — `MIDBOSS_SPAWNED(enemyType="ranged")` @ tick 981, hp 22073, 방향 SW, 브랜치·sha 동봉, 콘솔/페이지 에러 0 |
| AC-12 exporters | 미실행(사유 기록) | `git log -1 -- defense-run-simulation.js` = `9ba2aa39` ≠ HEAD `c139b508` → 상대 세션 변경이 아직 미커밋이므로 트리거 미충족 |
| AC-13 푸시 | PASS | origin/main 위로 재정렬 후 푸시, `@{upstream}..HEAD` 검사 |
| AC-14 증거 집약 | PASS | 이 문서 |

## 발견 1 — 아키타입 밸런스가 실측상 붕괴 (신규, 리튠과 무관)

`stage1b-symmetric-trials-v1` 아티팩트는 저장소에 **존재한 적이 없었다**(qa/evidence 전역 검색 0건).
이번에 정규 생산자로 처음 생성(100행, 21.5초)하자 G2 임계(각 아키타입 9–11/20)가 이렇게 어긋났다:

| 아키타입 | 명시 승수 | 임계 |
|---|---|---|
| striker | **20/20** | 9–11 |
| conductor | 15/20 | 9–11 |
| gambit | 6/20 | 9–11 |
| bulwark | 5/20 | 9–11 |
| rift | **4/20** | 9–11 |

귀속: 깨끗한 HEAD 워크트리에서 동일 스크립트를 돌린 결과가 **완전히 같다**(striker 20/20, rift 4/20)
→ 이번 리튠과 무관한 **사전 존재 결함이며, 이번에 처음 측정된 것**이다.

## 발견 2 — 심연 뎁스는 규칙을 바꾸지만 난이도를 바꾸지 않는다 (AC-10 FAIL)

cinder-span × 시드 401-405, 봇 기준(바닥 커맨더):

| depth | 플레이타임 중앙 | 게이트 무결성 바닥값 중앙 | 바닥값 5시드 |
|---|---|---|---|
| 0 | 192.58 s | 1580 | 1570 / 1576 / 1580 / 1600 / 1600 |
| 1 | 193.33 s | 1580 | 1561 / 1572 / 1580 / 1588 / 1588 |
| 2 | 192.33 s | 1577 | 1553 / 1554 / 1577 / 1588 / 1600 |
| 3 | 193.73 s | 1588 | 1560 / 1560 / 1588 / 1588 / 1588 |

- 판정 ① 모든 depth>0의 바닥값 < depth 0 → **FAIL** (d1 동률 1580, d3 오히려 1588로 상승)
- 판정 ② 회복캡 순서 depth2 ≤ depth3 ≤ depth1 → **FAIL**
- 전 구간 5/5 승리, 5/5 목표 시간(180–360 s) 내. 델타는 최대 11/1600 = 0.7%로 노이즈 수준.

**측정 유효성은 별도로 확인했다** — 뎁스는 정상 적용된다:

| depth | `snapshot.abyssDepth` | 이름 | 회복캡 | 600틱 시점 적 정책 분포 |
|---|---|---|---|---|
| 0 | (없음) | – | 0.25 | player-pursuit 1 / flank 2 |
| 1 | 1 | 재의 추격 | 0.25 | player-pursuit 3 |
| 2 | 2 | 메아리 기근 | 0.12 | resource-denial 2 / flank 2 |
| 3 | 3 | 협공의 장막 | 0.20 | flank 4 |

즉 **행동은 설계대로 바뀌는데 결과가 안 바뀐다.** 계획 v4의 AC-10 괄호 조항대로 롤백하지 않고
설계-수치 불일치로 기록한다. 후속 가설: ① 봇이 점령 지점에 오래 머물지 않아 `recoveryCapRatio`가
실효를 갖지 못함 ② 정책 교체가 게이트 압력의 총량을 바꾸지 않음 ③ 엘리트 호위 +1/+2가 게이트
바닥값이 정해지는 구간(초·중반) 밖에서 발생.

## 발견 3 — 게이트 증거 체인의 readiness가 스키마 불일치로 BLOCKED

`verdict.json` 43 failures. 인자 미공급으로 인한 BLOCKED(G6/G7/G8, 7건)를 제외한 나머지는
기존 아티팩트가 현재 evaluator 스키마를 만족하지 못해서다:
`pressure-readiness: canonical 15-run sample plan is incomplete`, `run N is missing retained measurement fields`,
`persistenceInstrumentation: BLOCKED`. G3는 FAIL(3건).
→ "기존 입력으로 verdict를 만들 수 있다"는 전제는 symmetric뿐 아니라 pressure/persistence 아티팩트에도
성립하지 않는다. 이들은 고비용 exporters 영역이므로 AC-12 트리거(상대 세션 커밋) 이후로 이월.

## Phase D — 브라우저 미드보스 증거: PASS

`scripts/capture-midboss-evidence.mjs` (신규). 왜 스크립트인가: `app.js`에 `midboss`/`bossSpawned`
문자열이 **없다** — 미드보스 스폰은 DOM에 아무 신호도 남기지 않고 렌더러만 소비한다. 따라서 유일하게
정직한 자동 판정은 렌더러가 실제로 건네받는 스냅샷을 관측하는 것이며,
`RealtimeBattle.prototype.renderSnapshot`을 후킹한다(`tests/stage-runtime-proof-browser.test.mjs:96`과 동일 훅).

측정 중 발견한 함정: 첫 시도는 120초 타임아웃으로 실패했고 진단 결과 `GROWTH_OFFER` 이벤트 3020회에
`WAVE_VARIANT_STARTED` 1회 — **성장 오퍼("성장 선택 · 전투 일시 정지")가 런을 멈춰 세워** 미드웨이브
틱(981)에 도달하지 못했다. 캡처 루프가 `#defense-growth-offer [data-pick]`을 응답하도록 고쳐 해소.

결과:

| 필드 | 값 |
|---|---|
| `pass` | true |
| 이벤트 | `MIDBOSS_SPAWNED`, `enemyType: "ranged"` |
| tick / frame | 981 / 340 (관측 최대 틱 1046) |
| hp / 방향 | 22073 / SW |
| midbossId | `echo-throne-midboss-1` |
| 프레임 수 | 362 |
| 성장 오퍼 응답 | 1회 |
| 스크린샷 | `midboss-evidence.png` 983421 B, `sha256:6333020665b7306b…` |
| provenance | branch `retune/echo-throne-response-types`, commit `39c09e78` |
| 콘솔/페이지 에러 | 0 / 0 |

이로써 리튠이 바꾼 `midbossEnemy: guardian → ranged`가 시뮬레이션 데이터가 아니라 **실제 렌더된 화면에서**
확인됐다. hp 22073은 카탈로그가 유도한 값(cadence 16.35 s × 2250 dps × 0.6)과 정확히 일치한다.

## 재현 커맨드

```bash
git worktree add -b retune/echo-throne-response-types ../abyssal-retune HEAD
ln -s "$PWD/node_modules" ../abyssal-retune/node_modules
cd ../abyssal-retune
node scripts/run-stage1b-symmetric-trials.mjs --output qa/evidence/gates/G2/stage1b-symmetric-trials.json
node --test tests/stage1b-pressure-packets.test.mjs tests/stage1b-gate-evaluator.test.mjs tests/stage1b-persistence.test.mjs
node scripts/evaluate-stage1b-gates.mjs --symmetric qa/evidence/gates/G2/stage1b-symmetric-trials.json \
  --g3 qa/evidence/gates/G3/stage1b-formation-attribution.json \
  --pressure qa/evidence/gates/G2/stage1b-cinder-pressure-packets.json \
  --persistence qa/evidence/gates/G7/stage1b-persistence-scenarios.json \
  --output qa/evidence/gates/stage1b-verdict.json
for d in 0 1 2 3; do node scripts/measure-stage-playtime.mjs --stages cinder-span \
  --seed-list 401,402,403,404,405 --depth $d \
  --output _workspace/current/qa/stage-variation-retune-20260731/depth/playtime-depth$d.json; done
node scripts/capture-midboss-evidence.mjs --timeout 180000
```
