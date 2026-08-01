# 광역 타격 스펙 — `aoe-burst` 런타임 실장 + 반경 진실성 VFX

run-id: `20260728-onslaught-action-pivot`
cycle: 10 인접 (오디오 레인과 동일 세션 소유)
lane: `design` + `engineering` (구현 동반)
owner: 본 세션 (wide-hit 레인)
authority: `design/skill-and-growth-spec.md` §2.2 (`aoe-burst` 정본),
`design/master-numeric-contract.md` §2·§4 (수치 권위), `CLAUDE.md` (엔진·증거 규율)

engine: **Three.js + WebGL 브라우저 전용**. Unity/Unreal 개념 없음.

레퍼런스: 오퍼레이터 제공 `화면 기록 2026-07-30 오후 11.25.21.mov`
(16.1s, 860×1626 세로, Mintegral 스틱맨 서바이버 광고).

---

## 0. 소유 경계 [OBSERVED]

cycle 10이 소유한 **VFX 신규 큐**는 `드롭·적 스폰·지형 변형` 3종이다
(`design/vfx-drop-spawn-terrain-spec.md`, `intake/production-brief-cycle10-stage-dungeon.md` §0).
본 문서는 그 3종을 건드리지 않는다. 본 문서가 소유하는 것은 **스킬 광역 타격**
하나이며, 기존 `SKILL_CAST` 이벤트 위에만 올라간다. 신규 이벤트 타입 0개.

`skill-and-growth-spec.md`가 예고한 `SKILLS` → `SKILL_CATEGORIES` 20종 전면 교체는
**본 문서의 범위가 아니다**. 그 마이그레이션은 캠페인 저장 스키마 v2·로드아웃·티어
게이트·Echo Shard를 함께 옮겨야 하는 성장 레인 작업이다. 본 문서는 **기존 `SKILLS`
형태 안에서 `aoe-burst` 2종만 가산**한다.

---

## 1. 레퍼런스가 실제로 보여준 것 [OBSERVED]

프레임을 2초 간격으로 추출해 판독했다(`ffmpeg fps=1/2`, 8프레임).

| 프레임 | 관측 |
|---|---|
| 2 | 화면에 적 15+ 동시 표시. 플레이어 발밑 녹색 원형 지면 링. 좌측 스킬 3개가 방사형 쿨다운 충전 |
| 4 | 무기 병합 오버레이 (본 문서 범위 밖) |
| **6** | **자홍색 특이점(vortex)**: 검은 코어 + 밝은 자홍 림, 적·전리품이 안쪽으로 빨려듦, 청록 초승달 호(arc)가 궤도 회전, 분홍 입자 외곽 확산. 좌우 가장자리의 적 2기가 끌려들어오는 중 |
| 8 | VICTORY 배너 |

**핵심 판독:** 프레임 2의 압박(적 15+)과 프레임 6의 해소(단일 광역기)가 한 쌍이다.
"몰려오는 빅웨이브"의 답이 **한 번의 광역 이펙트**라는 것이 레퍼런스의 구조다.
차용 대상은 **구조**(압박→단일 광역 해소)와 **형태 언어**(수축→폭발, 궤도 호, 경계 링)이며,
스틱맨 아트 스타일이나 병합 UI가 아니다.

---

## 2. 코드 현실 — 왜 지금은 광역이 넓게 느껴지지 않는가 [OBSERVED]

### 2.1 광역기가 사실상 1종이었다

`defense-catalog.js#SKILLS` 액티브 5종 중 `radius > 0`은 2종뿐이다.

| id | radius | 성격 |
|---|---:|---|
| `rift-bolt` | 0 | 단일 |
| `soul-lance` | 0 | 단일 |
| `void-aegis` | 0 | 실드 |
| `grave-pulse` | 3000 | 원형 |
| `shadow-step` | 4500 | 이동 + 원형 |

`master-numeric-contract.md` §2는 `SURGE` 밀집 웨이브에 대해 **"광역기 필요성 발생"**을
명시하고, `skill-and-growth-spec.md` §2.2는 `aoe-burst` 5종을 이미 저작해 두었다.
**설계는 존재했고 런타임에 실리지 않았다.**

### 2.2 [측정] 지면 링이 실제 피해 반경의 일부만 그리고 있었다

`battle-realtime-three.js#SKILL_IMPACT_SIGNATURES`의 `glow.radius`는 **고정 상수**로,
시뮬레이션이 실제로 피해를 주는 반경과 아무 관계가 없었다.

반경 환산: `worldPointInto()`가 좌표를 `(x / 24000 * 2 - 1) * 14`로 사상하므로,
**길이**는 `2 * WORLD_SCALE / WORLD_WIDTH = 0.0011666`배가 된다.

| 스킬 | 실제 피해 반경 | 화면에 그리던 반경 | **표시율** |
|---|---:|---:|---:|
| `grave-pulse` | 3000 sim = **3.50** world | 1.75 | **50%** |
| `shadow-step` | 4500 sim = **5.25** world | 0.80 | **15%** |

플레이어는 광역기의 크기를 **실제의 1/2 ~ 1/7로 학습하고 있었다.** 이것이
"광역 타격이 넓게 느껴지지 않는다"의 기계적 실체다. 연출 부족이 아니라 **거짓 정보**였다.

### 2.3 밀도와 이펙트가 무관했다

`SKILL_CAST` 연출은 적 1기를 맞히든 20기를 맞히든 동일했다. 빅웨이브를 해소한 순간과
허공에 쏜 순간이 시각적으로 구분되지 않으므로, **광역기가 웨이브의 답이라는 사실 자체가
전달되지 않았다.**

---

## 3. 실장한 것

### 3.1 `aoe-burst` 2종 (기존 `SKILLS` 가산) [OBSERVED — 구현됨]

`skill-and-growth-spec.md` §2.2의 저작 값을 그대로 사용한다. 둘 다 원형 360°이며,
`orderedTargets()`가 이미 반경 질의를 네이티브로 지원하므로 신규 타게팅 원시연산이 없다.

| id | 표시명 | 피해 | 쿨다운 | 반경 | 성격 |
|---|---|---|---:|---:|---|
| `ash-nova` | Ash Nova | 1400 고정 | 480 | 3600 | 밀집 정리 |
| `regents-verdict` | Regent's Verdict | **적 수 × 400** (상한 12) | 900 | 5000 | **빅웨이브 전용** |

`regents-verdict`가 요청의 핵심이다. **밀도가 곧 피해**이므로 적 1기에는 400, 12기에는
4800이 된다. 단일 대상에는 쓸모없고 빅웨이브에서만 최대가 되는 설계가
"둘 다 광역"이 아니라 "밀집용 + 산개용"으로 슬롯을 가른다.

**미실장 명시:** `veil-lance`(직선 관통), `drowned-toll`(3연타),
`starless-collapse`(경직)는 각각 **직선 형상 / 다단 타이밍 / 상태이상**이라는 신규
시뮬레이션 원시연산을 요구한다. 지금 넣으면 기존 반경 질의를 흉내로 대체하게 되므로
**착수하지 않았다.** 실장하려면 `orderedTargets()`에 형상 인자를 먼저 도입해야 한다.

### 3.2 밀도 비례 피해 규칙 [OBSERVED — 구현됨]

`defense-run-simulation.js#skillCastBaseDamage()`:

```
damagePerTarget 없음  -> skillRankDamage() 그대로 (기존 스킬 바이트 동일)
damagePerTarget 있음  -> round(damagePerTarget * min(n, targetCap) * rankScale)
```

`n`은 **캐스트당 1회** 확정되어 모든 대상에 동일 적용된다. `orderedTargets()`의
id 정렬 순서가 결과를 바꿀 수 없다 — 12기를 맞힌 캐스트는 어느 id가 먼저 정렬되든
각 대상에 같은 수치를 준다.

### 3.3 반경 진실성 VFX [OBSERVED — 구현됨]

`battle-realtime-three.js`:

- `aoeWorldRadiusFor(skillId)` — `SKILLS[id].radius`를 읽어 world 단위로 환산.
  **연출이 시뮬레이션 반경을 참조한다.** 고정 상수를 쓰지 않는다.
- `attachAoeBurst()` — 경계 링(annulus) + 궤도 호 + 코어. 링의 바깥 모서리가
  **실제 피해 경계**다.
- **잘못된 `glow`는 추가가 아니라 제거했다.** `grave-pulse` 1.75 / `shadow-step` 0.80
  고정 glow는 이제 진실한 링과 크기가 어긋나므로 삭제하고, 진원지를 표시하는 수직
  spear만 남겼다. 서로 모순되는 두 개의 링을 남기지 않는다.

### 3.4 수축→폭발 (레퍼런스 프레임 6) [OBSERVED — 구현됨]

`regents-verdict`는 `implode: true`다. `advanceAoeBurst()`가 캐스트의 앞 35%를
바깥(1.15배)에서 코어(0.12배)로 **수축**시키고, 이후 경계 너머(1.12배)로 **폭발**시킨다.
자홍색(`0xff5de6`)과 궤도 호 6개가 레퍼런스의 특이점 판독을 옮긴 것이다.

**정직성 경계:** 레퍼런스는 적을 물리적으로 빨아들인다. 본 실장은 **끌어당기지 않는다** —
시뮬레이션에 이동 강제가 없기 때문이다. 그래서 연출을 "흡입"이 아니라 **"수축 후 폭발"**로
저작했다. 존재하지 않는 게임플레이 효과를 시각적으로 주장하지 않는다.

### 3.5 밀도 결합 — 빅웨이브를 해소한 순간이 보이게 [OBSERVED — 구현됨]

`aoeTargetCountFor()`가 같은 `castInstanceId`를 공유하는 `SKILL_RESOLVED_DAMAGE`
이벤트 수를 **동결 스냅샷에서** 센다. 신규 시뮬레이션 필드가 필요 없다.

| 결합 대상 | 1기 명중 | 12기 명중 |
|---|---|---|
| 궤도 호 개수 | 최소 | 최대 (예산 상한) |
| 링·호 밝기 | 0.55배 | 1.00배 |
| 카메라 임펄스 | 없음 (밀도 0.25 이하 무시) | `IMPACT_SHAKE_MAX_AMPLITUDE` 이내 최대 |

이것이 **"빅웨이브를 해결해주는 주요 이펙트"**의 기계적 실체다. 같은 스킬이라도
웨이브를 지웠을 때만 화면이 실제로 크게 반응한다.

### 3.6 fill-rate 예산 [OBSERVED — 계산됨]

큰 반경은 곧 큰 가산 혼합 면적이므로 형상이 예산을 결정한다.

- `regents-verdict` r=5.83 world. **채운 원반** = π·5.83² = 106.8 world²
- 실제로 그리는 **환형** = π(5.83² − 5.48²) = 12.4 world² → **원반의 12%**

링 + 얇은 호만 쓰고 **원반을 쓰지 않는 이유**가 이 수치다. 소프트웨어 WebGL은
fill 비중이 더 크므로 호·코어를 버리고 **반경을 진술하는 링만** 남긴다
(`AOE_BURST_BUDGET.software`).

---

## 4. 증거 [OBSERVED]

| 항목 | 결과 |
|---|---|
| `scripts/verify-cycle9-digest-identity.mjs` | **PASS** — seed 1/17/4242 sha256 3개 전부 불변, commander 키 26개 유지 |
| `tests/aoe-burst-wide-hit-contract.test.mjs` (신규) | **9/9** |
| `tests/defense-run-simulation.test.mjs` | 27/27 |
| 렌더러 4개 스위트 | 67/67 |
| observers + public-contract | 16/16 |
| 라이브 밀도 규칙 | 12,492 캐스트 전부 `min(n,12)×400` 준수 |

**결정성이 유지된 이유:** `makeOffer()`는 `Object.keys(SKILLS)`를 `seed % available.length`로
뽑으므로 스킬 id 추가는 원칙적으로 제안 조합을 회전시킨다. 그러나 디지털 기준선 프로브는
300 tick·이동 전용이며 성장 제안에 도달하지 않는다(`growthOffer: null` 확인). 따라서
기준선 3개 해시는 불변이다. **레벨업에 도달하는 더 긴 런에서는 제안 조합이 바뀐다** —
이는 제안 가능한 콘텐츠를 추가하면 필연이며, 기준선의 목적(필드 누출 탐지)과 무관하다.

---

## 5. 미해결 — 설계 레인이 판정해야 할 것

### 5.1 `targetCap: 12`가 현재 런타임에서 도달 불가 [OBSERVED]

`skill-and-growth-spec.md` §2.2는 "`BIGWAVE` 상한 60 중 12명 명중"을 전제한다.
**실측: 반경 5000 안에 동시에 존재하는 적의 최대치는 7기다** (seed 23, abyssDepth 0/4/8,
14000 tick 주사).

원인은 `refreshAttackerCommitment()`의 `commitmentCap`과 스폰 페이싱이다. 필드 전체
동시 생존이 7기를 넘지 않는 구간이 대부분이다.

| 밀도 | `regents-verdict` 총피해 | `ash-nova` 총피해 |
|---:|---:|---:|
| 5기 | 5 × 2000 = **10,000** | 5 × 1400 = 7,000 |
| 7기 (실측 상한) | 7 × 2800 = **19,600** | 7 × 1400 = 9,800 |
| 12기 (상한, 미도달) | 12 × 4800 = 57,600 | 16,800 |

**규칙은 정상 동작하고 밀집에서 이미 `ash-nova`보다 강하다.** 그러나 상한 12는 지금
구속력이 없다. 판정 필요: (a) `commitmentCap`/스폰 페이싱을 올려 설계 전제(밀도 60)를
런타임에 맞출 것인가, (b) 상한을 실측 밀도에 맞춰 내릴 것인가. **수치 권위는
`master-numeric-contract.md`이므로 본 세션이 단독 결정하지 않는다.**

### 5.2 미측정

- **실브라우저 청감/체감 판정 미실시.** 링 반경·밝기·카메라 임펄스의 실제 가독성은
  사람 플레이 관찰 전까지 PASS로 승격하지 않는다. G4/G7 미승격.
- 빅웨이브 구간 동시 광역 캐스트 시 fill-rate 실측(p95 프레임 시간) 미측정.
- `veil-lance` / `drowned-toll` / `starless-collapse` 미실장 (§3.1).

---

## 6. 구현 중 발견한 선행 결함 — 스킬 VFX가 한 번도 표시된 적이 없다 [OBSERVED]

§3.3 배선을 통합 검증하다가 발견했다. **본 세션의 신규 기능이 아니라 기존 결함이다.**

`battle-realtime-three.js#effectAnchor()`는 이벤트에서 앵커를 찾을 때
`targetId ?? entityId ?? enemyId ?? bossId`를 읽는다. 그런데
`defense-run-simulation.js`의 `SKILL_CAST` emit은
`{ skillId, motion, vfx, castInstanceId, causalRootId, cue }`만 싣는다 — **대상 id가 없다.**

따라서 `SKILL_CAST`는 `switch`의 `default: return null`로 떨어지고,
`spawnVfx()`는 `if (!anchor) return;`에서 아무것도 할당하지 않고 즉시 반환했다.

결과: `SKILL_VFX_MODELS`(5종), `SKILL_VFX_SILHOUETTES`(5종),
`SKILL_VFX_LIFETIME_TICKS`(5종), `SKILL_IMPACT_SIGNATURES`(5종) — **스킬 캐스트용
연출 테이블 전체가 도달 불가능한 죽은 코드였다.** 스킬을 써도 저작된 이펙트가
단 한 번도 화면에 나오지 않았다.

**수정:** `effectAnchor()`의 커맨더 케이스에 `SKILL_CAST`를 추가했다. 커맨더가 곧
시전 원점이다 — `castSkill()`이 `orderedTargets(run, run.commander, skill.radius)`로
대상을 뽑으므로, 커맨더에 앵커하면 **시뮬레이션이 실제로 피해를 준 원과 정확히 같은
위치**에 광역 발자국이 놓인다.

**파급:** 이 한 줄로 신규 2종뿐 아니라 **기존 5종(`rift-bolt`, `soul-lance`,
`grave-pulse`, `void-aegis`, `shadow-step`) 전부가 처음으로 저작된 연출을 표시한다.**
"타격 재미가 없다"의 상당 부분이 여기에 있었다.

회귀 잠금: `tests/aoe-burst-wide-hit-contract.test.mjs`의
`every catalog skill cast spawns its authored effect, anchored on the caster`.

---

## 7. §5.1 해소 — 빅웨이브 동시성 상승 [OBSERVED]

§5.1이 남긴 "`targetCap: 12` 도달 불가(실측 7)"를 실장으로 해소했다.

### 7.1 `commitmentCap`은 구속 조건이 아니었다

지시는 "`commitmentCap` 올리고 진행"이었으나, 코드를 읽으니 스폰을 막는 것은
`processEncounterSpawns()`의 `activeBodies >= encounter.maxConcurrentEnemies`였다.
`commitmentCap`은 **동시에 공격하는 수**만 제한하고, 비커밋 적도 반경 안에 서 있으므로
광역 밀도에는 직접 기여한다. 따라서 **세 레버를 함께** 올렸다.

| 레버 | 역할 | 안 올리면 |
|---|---|---|
| `maxConcurrentEnemies` | 필드 동시 생존 상한 | 밀도 자체가 안 생김 |
| `commitmentCap` | 실제 공격 인원 | 밀도는 있으나 **압박이 없는 배경 군중** |
| `spawnIntervalTicks` | 큐 배출 속도 | 상한이 놀고 **"웨이브"가 아니라 "줄서기"** |

### 7.2 근본 원인 — 런타임이 DESCENT 등급에 고정돼 있었다 [OBSERVED]

`master-numeric-contract.md` §2는 동시 적 상한이 `DESCENT 8 → SKIRMISH 18 → SURGE 34
→ BIGWAVE 60`으로 **상승**한다고 저작한다. 런타임은 루트당 **단일 상수**(8/9/10)만 가져
`kind: "big"` 웨이브조차 개막 교전보다 조밀해질 수 없었다.

수정: `waveConcurrencyCeilings(run, waveIndex)`가 `run.waveSchedule`의 `kind`를 **파생
조회**해 big 웨이브에만 상향 값을 적용한다. `spawnQueue` 항목이 이미 `waveIndex`를,
스케줄이 이미 `kind`를 나르므로 **신규 스냅샷 필드 0개**다.

### 7.3 저작값과 상한 근거

| 스테이지 | 평시 (동시/커밋/간격) | **빅웨이브** |
|---|---|---|
| `cinder-span` | 8 / 3 / 18 | **22 / 7 / 5** |
| `abyss-chancel` | 9 / 4 / 24 | **24 / 8 / 6** |
| `echo-throne` | 10 / 4 / 15 | **26 / 8 / 4** |

계약의 BIGWAVE 60을 쓰지 않은 이유: §9가 60을 **"적 메시 인스턴스드 렌더 필수
(60개 개별 draw 금지)"**에 걸어 두었고, 현 렌더러는 액터당 스킨드 GLB를 클론한다
(`instantiateActorModel`). 60이면 draw call 180 예산을 즉시 초과한다.
**상향 여지는 이 표가 아니라 인스턴스드 렌더링에 묶여 있다.**

### 7.4 실측 결과

| 스테이지 | 변경 전 r=5000 최대 | **변경 후** | 필드 최대 | `targetCap 12` |
|---|---:|---:|---:|---|
| `cinder-span` | 7 | **13** | 16 | **도달 ✅** |
| `abyss-chancel` | 7 | **12** | 16 | **도달 ✅** |
| `echo-throne` | 3 | **9** | 11 | 미도달 |

**`echo-throne` 미도달은 상한 문제가 아니다.** 구성이 `flanker`/`ranged`/`guardian`이고
`ranged`는 `projectileRange: 6000`에서 정지하므로 반경 5000 밖에 머문다. 상한을 더 올려도
원거리 유닛이 안으로 들어오지 않는다. 조합 문제이며 별도 판정 대상이다.

### 7.5 광역기가 실제로 밀도를 지운다 [OBSERVED]

동일 봇으로 광역기 유무만 바꾼 A/B:

| 스테이지 | 광역기 X 최대밀도 | 광역기 O 최대밀도 |
|---|---:|---:|
| `cinder-span` | 13 | **9** |
| `abyss-chancel` | 12 | **10** |
| `echo-throne` | 9 | **6** |

캐스트가 군중을 실제로 제거해 첨두 밀도가 내려간다. 계약 §2의
**"`SURGE` → 광역기 필요성 발생"**이 런타임에서 성립한다.

### 7.6 결정성 [OBSERVED]

`scripts/verify-cycle9-digest-identity.mjs` **PASS** (해시 3개 불변). 상승은
`kind: "big"`에서만 발동하고 최초 big 웨이브는 tick 2040인데 기준선 프로브는 300 tick
이동 전용이므로 관측 구간에 진입하지 않는다. 스냅샷에 실리는 `encounter.commitmentCap` /
`maxConcurrentEnemies`(평시 값)도 **변경하지 않았다**.

### 7.7 프로브 결함 정정 [OBSERVED]

§5.1의 "실측 7"은 **측정 오류였다.** `advanceDefenseRun()`은 `growthOffer`가 열린 채
선택 입력이 없으면 `break`하여 런을 그 tick에 **영구 정지**시킨다. 이전 프로브가 성장
제안을 응답하지 않아 웨이브가 2개에서 멈췄고, big 웨이브(스케줄상 3개 존재)에 도달한 적이
없었다. 제안을 응답하도록 고친 뒤 웨이브 20–22개·big 6–9개가 정상 진행된다.
회귀 잠금: `tests/aoe-burst-wide-hit-contract.test.mjs`
`a live run actually exceeds the flat concurrency tier once a big wave lands`.

### 7.8 남은 미측정

- 봇 런은 tick ~19200에서 **objective 압박 데드라인**으로 DEFEAT한다. 이는 봇이 목표를
  완주하지 못해 걸리는 것이며 **변경 전후 동일 지점**이다(밸런스 퇴행 아님). 승률 판정은
  사람 플레이 게이트 소관이다.
- 빅웨이브 16기 동시 + 광역 VFX 동시 캐스트의 **p95 프레임 시간 미측정.** 계약 예산은
  ≤16.7 ms이며 현 렌더러는 비인스턴스드다. 실브라우저 측정 전까지 성능 PASS 주장 안 함.

---

## 8. §7.8 미측정 해소 — perf 실측과 `echo-throne` 조합 [OBSERVED]

### 8.1 프레임 예산 실측 — **이미 초과 상태였다**

`scripts/run-g6-perf-budget.mjs scenario` (`G6_STAGE=cinder-span`, seed 7, 600프레임).
peak scene: **적 13 / 총 액터 17 / skinnedMesh 162 / bone 3888**.

| 티어 | held renderWork p95 | **live** frameΔ p95 | **drawCalls p95** | longFrameRatio |
|---|---:|---:|---:|---:|
| desktop M2 Pro (dsf1) | 1.8 ms | 16.8 ms | **542** | 0.022 |
| shipped-mobile (dsf2) | 1.7 ms | 16.8 ms | **542** | 0.022 |
| **midtier proxy (dsf2, cpu 4x)** | 9.4 ms | **50.1 ms** | **542** | **0.499** |

계약 §9 예산은 draw call **≤180**, 프레임 p95 **≤16.7 ms**다. 실측은 **542 draw call(3배)**,
미드티어에서 **프레임의 절반이 롱프레임**이다.

**이 수치는 본 레인의 VFX 탓이 아니다.** perf 러너의 `step()`은 스킬을 캐스트하지 않으므로
측정 구간에 광역 버스트가 한 번도 생성되지 않는다. 즉 **선행 상태**이며, held(1.7–1.8 ms)와
live(5.3 ms)의 격차가 보여주듯 비용은 액터·전환 인스턴스화에 있다.

**따라서 결론은 하나다: 개체 수를 더 늘리는 선택지는 없다.** §7.3에서 BIGWAVE 60을
인스턴스드 렌더링 선행 조건으로 보류한 판단이 실측으로 확인됐고, 22/24/26조차 실제 도달치
13–16에서 이미 예산을 넘긴다.

### 8.2 `echo-throne` 조합 실측 — 원형으로는 구조적으로 불가

| 스테이지 | `ranged` 비중 | 커맨더 5000 **밖** |
|---|---:|---:|
| `cinder-span` | 33% | 55% |
| **`echo-throne`** | **69%** | **58%** |

`ranged`는 `projectileRange 6000`에서 정지한다. 저작된 모든 원형(`regents-verdict` 5000,
`ash-nova` 3600)보다 **멀다.** 실측 명중 분포가 이를 확정한다 — `regents-verdict`의
5000 밖 명중은 `echo-throne`·`cinder-span` 모두 **0%**다(반경이 곧 상한이므로 당연하다).

형상별 최대 포착:

| 스테이지 | 원형 r5000 | 직선 900×8000 | 승자 |
|---|---:|---:|---|
| `echo-throne` | 7 | **9** | 직선 |
| `cinder-span` | **13** | 11 | 원형 |

이것이 스펙 §2.2가 두 `aoe-burst` 슬롯을 **"밀집용 + 산개용"**으로 가르라고 한 이유의
실측 근거다.

### 8.3 해소 — `veil-lance` 실장 (개체가 아니라 사거리)

perf가 "개체를 늘리지 말라"고 했으므로, `echo-throne`은 **사거리**로 해소했다.
§3.1에서 미실장으로 남겼던 산개용 직선기를 실장한다.

- 카탈로그: `veil-lance` — 1100 고정 피해 / 쿨다운 360 / `lane { halfWidth 450, length 8000 }`
  / `element: "veil"`. `areaRadius`·`fieldTicks` 없음 — 타 세션의 area 레이어는 반경 기반이며
  띠에는 넘길 반경이 없다.
- 시뮬레이션: `laneTargets()`가 **띠(strip)** 를 관통 판정한다. 진행거리순 정렬(동률은 id)로
  엔진 간 안정적이다.
- 조준 `laneDirection()`: **플레이어의 명시 조준(`commander.aim`)이 항상 최우선**,
  없을 때만 **가장 많이 꿰는 선**을 고른다. 최근접 적을 겨냥하던 초안은 실측 명중이
  캐스트당 **1**이었다 — 900 폭이 산개 진형과 정렬되는 일이 거의 없기 때문이다.
- 렌더러: `aoeWorldLaneFor()` + `aoe-burst-lane` strip. 원형과 동일한 진실성 규칙 —
  **그린 띠 = 피해 준 띠**. 범위는 카탈로그에서, 축만 이벤트에서 온다(변조 방어).

**조준 개선 효과 (실측):**

| 스테이지 | 최다 명중 (최근접 조준) | **최다 명중 (최다관통 조준)** | 5000 밖 명중 |
|---|---:|---:|---:|
| `echo-throne` | 1 | **8** | 47% |
| `cinder-span` | 1 | **14** | 67% |

`echo-throne`에서 `veil-lance`(최다 8)가 `regents-verdict`(최다 4)를 앞지르고,
원형이 **0%**인 5000 밖을 **47%** 때린다. 산개 스테이지의 답이 성립한다.

### 8.4 결정성과 타 레인 게이트

- `verify-cycle9-digest-identity.mjs` **PASS** (해시 3개 불변).
- `tests/defense-run-simulation.test.mjs`의 drop/buff 디지털 게이트 4픽스처 중
  `abyss-chancel/71/1000` **1건**이 갈렸다. 원인은 확정적으로 `veil-lance`가
  `makeOffer()` 풀에 들어간 것이다 — 스킬을 일시 제거하면 40/40 통과한다.
  `makeOffer()`는 `Object.keys(SKILLS)`를 `seed % available.length`로 뽑으므로
  **제안 가능한 스킬을 추가하면 시드 제안이 회전하는 것이 필연**이다.
- 그 게이트의 주장은 *"drop/buff 레이어가 무발생 구간에서 무해하다"*이지 스킬 카탈로그
  동결이 아니다. 재측정 시 전제(DROP 0 / BUFF 0 / tick 1000 / dropRng 전진 / `buffs` 키 부재)가
  **전부 통과**했고 sha 단언만 어긋났으므로, **해당 1건의 기준 상수만 사유를 명시해 재도출**했다.
  나머지 3픽스처는 성장 제안에 도달하지 않아 불변이다.

### 8.5 동시 세션 충돌 [OBSERVED]

머지 `0188366a`(PR #16, audio lane)가 본 세션의 **`veil-lance` 구현 전체를 삭제**했다
(카탈로그 항목 · `laneDirection`/`laneTargets` · 렌더러 strip). 삭제가 세 파일에 걸쳐
일괄적이어서 참조 불일치는 남지 않았고, 먼저 커밋된 AoE 버스트·반경 진실성·`SKILL_CAST`
앵커 수정·빅웨이브 상승은 **보존**됐다. 재적용하면서 타 세션이 새로 도입한
`element`/`areaRadius` 스키마에 맞춰 통합했다. 타 세션 커밋은 되돌리지 않았다.

### 8.6 남은 미해결

- **draw call 542 vs 예산 180** — 인스턴스드 렌더링 전까지 해소 불가. 광역 밀도의 상한을
  결정하는 것은 이제 시뮬레이션이 아니라 **렌더러**다.
- 광역 VFX를 실제로 캐스트하는 상태의 perf는 여전히 미측정(러너가 캐스트하지 않음).
- 사람 플레이 판정 미실시 — G4/G7 미승격.
