# Stage1b G3/G7 회귀 — bisect 결과

원인 커밋: **`175d1bf9` "feat: deepen Cinder campaign combat"** (다른 작성자, 2026-08-03).

## [OBSERVED] 증거

동일 테스트를 두 리비전에서 실행:

| 리비전 | `node --test tests/stage1b-g3-g7-verification.test.mjs` |
|---|---|
| `175d1bf9^` | `# pass 3 / # fail 0` |
| `175d1bf9` | `# pass 1 / # fail 2` |
| `HEAD` (7d4d9c5c) | `# pass 1 / # fail 2` — 동일 실패 |

실패 assertion:
- `the G3 sample must observe a boss arrival`
- `extraction hold must be observable`

시뮬레이션 샘플(`stageId: cinder-span`, `seed: 401`, loadout
`ember-cohort / rift-lens / veil-vanguard`, 커맨더 `MOVE octant: IDLE`) 재현 결과:

| 리비전 | terminal | tick | wave | BOSS_SPAWNED |
|---|---|---|---|---|
| `175d1bf9^` | `VICTORY` | 13702 | 10 | 1 |
| `HEAD` | `DEFEAT` | 4683 | 5 | 0 |

`HEAD`에서 커맨더 integrity는 970/1000으로 건재하고 `GATE_BREACHED` 53회 —
패배 원인은 커맨더 사망이 아니라 **게이트 붕괴**(`defense-run-simulation.js:5062`).

## [INFERENCE] 기전

`175d1bf9`가 `moveEnemies`의 `commanderPressureDelayed` 분기(게이트 페이즈 동안
`ENEMY_PRESSURE_DELAYED`를 emit하고 실제 피해를 유예하던 로직)를 **삭제**했고,
동시에 근접 사거리를 `contactRangeFor()`(`MELEE_CONTACT_TOLERANCE = 8`)로 넓혔다.
그 결과 gate-defense 페이즈의 초반 압력이 그대로 게이트에 들어가고, 웨이브 5에서
게이트가 무너져 보스 스폰 조건(`occupation.completed && phase === "boss-kill"`,
`defense-run-simulation.js:5054`)에 도달하지 못한다.

## 파급 (같은 원인으로 판단되는 실패)

- `tests/stage1b-g3-g7-verification.test.mjs` — 2건
- `tests/stage1b-evidence-exporters.test.mjs` — 2건 (G3 exporter, G2 canonical pressure exporter)
- `tests/stage1b-persistence.test.mjs` — 1건 (persistence exporter CLI)
- 배치 회귀에서 관측된 `defense-run-simulation` 계열 실패(보스 압력/추출 개방,
  스테이지 해저드-점령 회복) 다수

## 미결 판단 (사람 소유)

이것이 **의도된 난이도 상향인지**(그렇다면 G3/G7 샘플 컨트롤러와 익스포터 기대값을
갱신해야 함) **압력 유예 삭제의 부작용인지**(그렇다면 시뮬레이션 쪽 수정)는
`175d1bf9` 작성자의 설계 의도에 달려 있다. 이 세션은 **테스트를 완화하지 않았고
전투 밸런스를 임의로 되돌리지 않았다** — 원인만 고정해 인계한다.

## 참고

- `tests/stage1b-gate-evaluator.test.mjs` (49 pass), `tests/stage1b-pressure-packets.test.mjs`
  (3 pass), `tests/stage2-balance-retune.test.mjs` (1 pass) 는 정상.
- `tests/stage1b-evidence-exporters.test.mjs` 는 내부 `spawnSync` 타임아웃이 30분이라
  단독 실행에 약 56분이 걸린다. 배치 회귀 시 타임아웃 예산을 따로 잡을 것.
