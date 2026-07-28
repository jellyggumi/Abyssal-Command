# Stage playtime doctrine — 3–6분 스테이지, 웨이브 편성, 스킬 랭크, 스테이지 간 계승

- run-id: `20260728-stage-playtime-doctrine` (retained run folder `_workspace/20260726-stage1b-cinder-pressure-agency/` 에 수록)
- 적용 코드: `defense-catalog.js`, `defense-run-simulation.js`, `campaign-state.js`, `app.js`
- 측정 하네스: `scripts/measure-stage-playtime.mjs` (게임 스튜디오 하네스 방식 — 출하 시뮬레이션을 수정 없이 import 하고 관측만 함)
- 회귀: `tests/stage-wave-doctrine.test.mjs`

## 1. 문제 정의

[OBSERVED] 변경 전 기준선: `scripts/measure-g7-core-loop.mjs` 로 측정한 승리 런의 중앙값은 **약 30–45초**였다.
스테이지 구성은 웨이브 3개(예: cinder-span `[[0,rusher,4],[180,flanker,3],[390,ranged,2]]`)와 게이트 유지 900틱(15초)이 전부였고,
성장(레벨업) 회로는 `gate-defense`/`echo-recovery` 목표가 끝난 **뒤에야** 열렸다.

[TARGET] 스테이지 1회 플레이타임 **180–360초**, 긴 웨이브 열 + 중간보스 + 맵 성격에 맞는 웨이브 패턴,
스킬 특성(랭크) 강화, 스킬·아이템 효과의 스테이지 간 계승, 그리고 그 모든 것의 수치 기반 설계.

## 2. 웨이브 독트린 (`STAGE_WAVE_DOCTRINE`, defense-catalog.js)

스테이지마다 한 줄의 독트린이 있고, 웨이브 계획은 그 줄에서 **결정론적으로 생성**된다.

| 항목 | 값 |
| --- | --- |
| `defenseTicks` (= `stage.gateTicks`) | 10200 → 15000틱 (170초 → 250초), 스테이지 순서대로 상승 |
| `waveCount` | 10 → 13 |
| `gateIntegrity` | 1600 → 2500 (기존 고정 1000에서 유지 시간에 비례해 재설계) |
| 웨이브 간격 | `defenseTicks / waveCount` = 약 1020–1150틱 (17–19초) |
| `kindCycle` | 스테이지별 authored 리듬, 마지막 웨이브는 항상 `big` |
| `classes` | 그 맵이 운용하는 적 클래스 회전 순서 |
| `pressureLane` | `chokepath` / `flank` — 빅 웨이브가 어느 라인으로 밀고 들어오는지 |
| `midbossEnemy` | 중간보스의 기반 클래스 |

### 웨이브 종류

| 종류 | 라벨 | 예산 배수 (`countBp`) | 성격 |
| --- | --- | --- | --- |
| `normal` | 웨이브 | 1.00 | 그 맵의 회전 클래스 1종, 클래스 고유 정책 |
| `big` | 빅 웨이브 | 1.75 | 2종 혼합(6:4), 맵의 압박 라인(chokepath 돌파 또는 flank)으로 진입 |
| `mid` | 미들 웨이브 | 0.50 + 중간보스 | 소규모 호위 + 중간보스 1기, `elite-escort` 정책 |

접근 방향과 정책은 각 스테이지의 `STAGE_TACTICS`(`spawnDirections`, `chokepath`, `flank`)에서 나오므로
**맵마다 웨이브 패턴이 다르게 읽힌다.** 각 웨이브는 시드 리믹스 대안 2종을 유지해 같은 스테이지도 매번 같지 않다.

### 중간보스

중간보스는 **elite 가 아닌 일반 적**이다(의도적). elite 스폰은 추출/포획 플로우를 구동하므로, 중간보스를 elite 로 만들면
추출 흐름을 오염시킨다. 대신 `MIDBOSS_PROFILE` 배수(피해 1.6배, 속도 0.85배, 반경 1.4배, XP 4배)를 받은 일반 적이며,
`gate-defense` 완료 판정이 "elite/boss 가 아닌 적이 남아 있지 않을 것"을 요구하므로 **중간보스를 잡아야 유지 단계가 닫힌다.**

HP 는 클래스 배수가 아니라 **클리어 예산의 지분**이다: `hp = cadenceSeconds × PLAYER_BASELINE_DPS × 0.60`.
[OBSERVED] 초기 시도(클래스 HP × 3.2배)는 guardian 기반·scale 240 스테이지에서 57,000 HP 벽이 되어 유지 단계 자체가 멈췄다.

## 3. 수치 기반 밸런스 — 클리어 예산

웨이브 크기는 authored 마릿수가 아니라 **HP 예산**에서 역산한다.

```
clearableHp = cadenceSeconds × PLAYER_BASELINE_DPS      // 2250 = COMMANDER.basicDamage 900 / (24틱/60)
waveHp      = clearableHp × WAVE_PRESSURE_BP(0.55) × kind.countBp × ramp(1.00 → 1.30)
count(적)   = (waveHp × 구성 지분) / (ENEMIES[적].hp × stage.scale / 100)
```

- `PLAYER_BASELINE_DPS` 는 **맨몸 지휘관의 단일 대상 DPS**다. 동료·아이템·보상·스킬 랭크·메타 성장은 전부 그 위의 여유분이다.
- 나눗셈에 `stage.scale` 이 들어가므로, 후반 스테이지는 같은 마릿수를 2.4배 HP로 주는 대신 **더 적고 더 단단한 개체**를 준다.
  [OBSERVED] 이 규칙이 없을 때 gate-zenith 는 유지 단계가 클리어 불가능해져 승률 0이었다.
- 리믹스 구성도 **같은 예산**으로 나눈다. 마릿수로 나누면 guardian 리믹스가 rusher 원본의 몇 배 HP를 갖게 된다.

### 장기전 유지력 — 웨이브 클리어 회복

3–6분 유지는 소모전 문제다. 다음 웨이브가 오기 전에 현재 웨이브를 전멸시키면 (`gate-defense` 단계 한정, 웨이브당 1회)
지휘관 최대 내구의 **8%**, 관문 최대 내구의 **5%** 를 회복한다(`WAVE_CLEARED` 이벤트). 유지 단계가 끝나면 더 이상 발생하지 않는다.

### 목표 압박(anti-stall) 유예 재설계

`gate-defense` 단계의 유예는 이제 `stage.gateTicks + 3600틱`이다. 기존의 고정 60초 유예는 authored 170–250초 유지 중
정상 플레이에도 100 피해 펄스를 계속 때려 관문을 갈아버린다. 이후 단계들의 유예는 변경 없음.

## 4. 스킬 특성 강화 (랭크)

- 이미 배운 스킬은 `MAX_SKILL_RANK = 5` 까지 성장 제안 풀에 **계속 남는다**. 재선택 = 랭크 업(스킬 id 중복 없음).
- 액티브: 랭크당 피해 **+25%**, 쿨다운 **-6%** (하한 70%). 캐스트 시점에 랭크를 읽으므로 계승된 랭크도 동일하게 적용된다.
- 패시브: 랭크 1은 원래 효과 전부, 이후 랭크는 **50%** 씩 추가 적립.
- 성장 제안 게이트 변경: 기존에는 `gate-defense`+`echo-recovery` 완료 후에만 제안이 열렸다.
  [OBSERVED] 그 게이트를 유지하면 170–250초 유지 전체를 레벨 1·업그레이드 0으로 치르게 되고, 측정에서 실제로
  후반 스테이지가 성장 목표 단계에서 교착해 패배했다. 이제 XP 임계값만이 게이트이며, 저내구 보호와 아이템 획득 비트 보호는 유지된다.

## 5. 스테이지 간 계승 (스킬·아이템)

- 승리 시 `runCarryOver(run)` 이 반환하는 것: 스킬별 랭크(**-1 감쇠**, `CARRY_OVER_MAX_RANK = 3` 상한)와
  마지막에 획득한 아이템 최대 `CARRY_OVER_MAX_ITEMS = 3`개.
- `campaign.stageCarryOver` 에 저장(스키마 버전 1, 마이그레이션·검증 포함, 저장/복원 라운드트립 보장). **패배 시 초기화.**
- 다음 런은 `createDefenseRun({ carryOver })` 로 시작하며, 스킬은 랭크 1..N 효과를 순차 적용, 아이템은 원래 효과 그대로 재적용하고
  `CARRY_OVER_APPLIED` 이벤트를 남긴다.
- 설계 의도: 캠페인이 **복리로 쌓이되 눈덩이가 되지는 않게** — 한 랭크 감쇠 + 상한 3 + 패배 시 소멸.

## 6. 변경하지 않은 것

- 결정론: 웨이브 스케줄은 authored 방향/정책을 쓰더라도 RNG 추출 순서를 그대로 소비한다. 같은 시드 = 같은 런.
- elite/추출/보스 목표 체인, 점유·추출 좌표, 스테이지 id·아이템 id·보상 id·저장 키.
- 렌더러/프레젠테이션은 스냅샷을 읽기만 한다.
