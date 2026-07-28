# Skill & Growth Spec — 제한 카테고리 · 단계적 해금 · 지속 성장

```yaml
run_id: 20260728-onslaught-action-pivot
status: "[TARGET] — 미측정 설계 목표"
owner_skill: build-game-inventory + build-isometric-arpg
authority: design/master-numeric-contract.md
depends_on: [design/action-combat-spec.md, design/encounter-wave-spec.md]
scope: 성장 축, 20종 스킬, 티어 해금, 경제, 로드아웃, 기존 시스템 통합, 무결성
```

---

## 1. 성장 축 개요

네 축이 서로 다른 속도로 진행한다. **동시에 끝나지 않는 것**이 설계 의도다.

| 축 | 범위 | 화폐 | 범위 | 리스펙 |
|---|---|---|---|---|
| Warden Level | 캠페인 영구 | 자동 (XP) | 1–60 | — |
| 스탯 포인트 | 캠페인 영구 | 레벨당 1(무료) + Echo Core(유료) | 75점 (스탯당 상한 19) | Echo Shard로 가능 |
| Echo Core | 캠페인 영구 | 정예 포획 + 스테이지 해결 | 40 | **불가** (기존 규칙) |
| Echo Shard | 캠페인 영구 | 페이즈·보스 처치 | 무상한 | — |
| 런 XP 성장 제안 | **런 한정** | 런 내 XP | 3회/스테이지 | 런 종료 시 소멸 |

`Echo Core`(40)와 `XP_GROWTH` 런 제안은 기존 계약 `[OBSERVED]`
(`campaign-state.js#echoCoreEarned`, `defense-catalog.js#XP_GROWTH`)를 유지한다.

### 1.1 패배해도 성장한다 (핵심 계약)

| 결과 | Warden XP | Echo Shard | Echo Core | 런 스킬 |
|---|---|---|---|---|
| 승리 | 100% | 100% | 규정대로 | 소멸 |
| 패배 | **40%** | **100% (도달분)** | 0 | 소멸 |

**왜 이것이 load-bearing인가:** `MIDBOSS`·`FINALE`은 처치 전용 페이즈이며 fail-forward가
없다(`encounter-wave-spec.md#5`). 패배가 순수 손실이면 실력 벽이 곧 진행 정지가 된다.
패배 시 XP 40% + Shard 100%는 **재도전마다 캐릭터가 강해진다**는 것을 보장하며, 이것이
사용자 요구 "캐릭터의 성장이 사용자 정보에 맞게 지속적으로 성장"의 기계적 실체다.

Echo Shard를 100% 주는 이유: Shard는 페이즈 완료 시점에 이미 획득한 것이다. 회수하면
"진행했는데 아무것도 남지 않았다"가 되어 재도전 동기를 깎는다.

---

## 2. 스킬 20종

카테고리 4 × 5종. 티어 T1(2) / T2(2) / T3(1).
기준 피해 `basicDamage = 900` `[OBSERVED]`. 레벨당 계수 `+18%` 누적(L5 = ×1.72).

### 2.1 `melee-amp` — 근접 증폭 (슬롯 2)

| id | 표시명 | 티어 | 쿨다운 | L1 효과 | 레벨당 | 상호작용 |
|---|---|---|---|---|---|---|
| `cinder-edge` | 잿날 | T1 | 패시브 | `LIGHT` 피해 +12% | +18% 누적 | `LIGHT_1/2/3` |
| `echo-riposte` | 메아리 반격 | T1 | 300 | 다음 `LIGHT_3`가 360°/2200 → 360°/3200 확대 | 반경 +18% | `LIGHT_3` |
| `sundering-arc` | 가르는 호 | T2 | 420 | `HEAVY` 접촉 시 방어 −25%, 8초 | 지속 +18% | `HEAVY` |
| `chain-severance` | 연쇄 절단 | T2 | 패시브 | 콤보 3타 완주 시 다음 체인 startup −20% | −18% 추가 | 콤보 |
| `abyssal-execution` | 심연 처형 | T3 | 600 | HP 25% 이하 대상 `HEAVY` 즉시 처치 | 임계 +18%p | `HEAVY` |

`abyssal-execution` 임계는 L5에서 25% × 1.72 = **43%**. 보스에는 임계 1/4(L5 = 10.75%)로
적용해 즉사 남용을 막는다.

### 2.2 `aoe-burst` — 광역 파괴 (슬롯 2)

`SURGE`/`BIGWAVE`의 답. 근접 처치율 2.7/s로는 밀도 60을 감당할 수 없다
(`encounter-wave-spec.md#4.1`).

| id | 표시명 | 티어 | 쿨다운 | L1 효과 | 레벨당 | 형상 |
|---|---|---|---|---|---|---|
| `ash-nova` | 재의 신성 | T1 | 480 | 1400 피해 | +18% | 원형 360° / 3600 |
| `veil-lance` | 장막 창 | T1 | 360 | 1100 피해, 관통 | +18% | 직선 폭 900 / 8000 |
| `drowned-toll` | 잠긴 조종 | T2 | 600 | 900 피해 × 3연타 (0.5초 간격) | +18% | 원형 360° / 4200 |
| `starless-collapse` | 별없는 붕괴 | T2 | 720 | 2600 피해 + 1초 경직 | +18% | 원형 360° / 3000 |
| `regents-verdict` | 섭정의 판결 | T3 | 900 | 반경 내 적 수 × 400 피해 (상한 12명) | +18% | 원형 360° / 5000 |

`regents-verdict`는 밀도에 비례한다 — `BIGWAVE` 상한 60 중 12명 명중 시 L1 4800 피해.
**빅웨이브 전용 설계**이며 단일 대상에는 400으로 쓸모없다. 이것이 카테고리 슬롯 2칸을
"둘 다 광역"이 아니라 "밀집용 + 산개용"으로 나누게 만든다.

### 2.3 `mobility` — 기동 (슬롯 1)

| id | 표시명 | 티어 | 쿨다운 | L1 효과 | 레벨당 |
|---|---|---|---|---|---|
| `dusk-slip` | 황혼 미끄러짐 | T1 | 패시브 | `DASH` 충전 2 → 3 | 재생 −18% |
| `warden-stride` | 파수 활보 | T1 | 패시브 | `DASH` 거리 2600 → 3100 | +18% |
| `phase-recoil` | 위상 반동 | T2 | 패시브 | `DASH` 무적 10 → 13 tick | +1 tick/레벨 (L5 = 17) |
| `tidal-repositioning` | 조류 재배치 | T2 | 540 | 즉시 5200 이동 + 착지 지점 800 반경 1200 피해 | +18% |
| `gate-translation` | 관문 전이 | T3 | 780 | 화면 내 임의 지점 순간이동, 무적 20 tick | 무적 +2 tick |

`phase-recoil` L5의 17 tick 무적은 `TELEGRAPH_MIN_TICKS = 45`보다 훨씬 짧으므로 패턴 회피
난이도를 무너뜨리지 않는다. 단 `DASH` 총 길이 18 tick에 근접하므로 **L5 상한 17로 고정**하고
그 이상 올리지 않는다 — 18을 넘으면 대시 전체가 무적이 되어 §5 금지 항목 "무적 남용"에
걸린다.

### 2.4 `sustain` — 방어/유지 (슬롯 1)

| id | 표시명 | 티어 | 쿨다운 | L1 효과 | 레벨당 |
|---|---|---|---|---|---|
| `ward-flicker` | 파수 명멸 | T1 | 420 | 최대 내구 12% 실드, 6초 | +18% |
| `ember-draught` | 잿불 한 모금 | T1 | 600 | 즉시 최대 내구 10% 회복 | +18% |
| `requiem-bulwark` | 진혼 방벽 | T2 | 720 | 4초간 받는 피해 −40% | 지속 +18% |
| `hollow-covenant` | 공허 서약 | T2 | 패시브 | 내구 30% 이하 최초 도달 시 무적 40 tick (런당 1회) | 무적 +18% |
| `abyss-reclamation` | 심연 회수 | T3 | 900 | 4초간 가한 피해의 15%를 내구로 회복 | +18% |

`hollow-covenant`는 기존 `wardens-ward` 스킬 트리 노드 `[OBSERVED]`
(`rpg-catalog.js#WARDEN_SKILL_TREE`)와 개념이 겹친다. §6에서 처분을 정한다.

---

## 3. 단계적 해금

### 3.1 티어 게이트

| 티어 | 조건 | 카테고리당 |
|---|---|---|
| T1 | 캠페인 시작부터 | 2 |
| T2 | **해당 카테고리** T1 스킬 하나가 L3 도달 | 2 |
| T3 | **해당 카테고리** T2 스킬 하나가 L4 도달 **AND** 캠페인 3스테이지 클리어 | 1 |

게이트는 **카테고리별로 독립**이다. `aoe-burst`를 먼저 파면 `aoe-burst` T2만 열린다.
이것이 "제한된 스킬 카테고리" 요구를 진행 구조로 만든다.

### 3.2 워크드 해금 타임라인

Echo Shard 8/스테이지(§4), 승률 70% 가정, Stage 5 반복 기준.

| 시점 | 누적 Shard | 전형적 배분 | 접근 가능 스킬 | 레벨 완료 |
|---|---|---|---|---|
| Warden L10 (≈5판) | 40 | `ash-nova` L3(6) + `cinder-edge` L3(6) + `ward-flicker` L2(2) + 여유 26 | T1 8종 + `aoe-burst` T2 2종 + `melee-amp` T2 2종 | 2종 L3 |
| Warden L25 (≈24판) | 192 | 6칸 평균 L4 (13×6=78) + T2 4종 L3 (6×4=24) + 여유 90 | T1 8 + T2 8 = 16종 (T3는 조건 미달 가능) | 6종 L4 |
| Warden L45 (≈60판) | 480 | 6칸 L5 (150) + 잔여 12종 평균 L4 (13×12=156) | **20종 전부** | 6종 L5 + 12종 L4 |

**L10 시점 검산:** 40 Shard로 L3(누적 6) 두 개 + L2(누적 2) 하나 = 14 소비, 26 여유.
T2 해금 조건(T1 하나가 L3)이 두 카테고리에서 충족된다. **첫 5판 안에 확장이 시작된다** —
초반 정체를 만들지 않는다.

**T3 3스테이지 클리어 조건:** Warden L10 시점에 5판을 했다면 캠페인 진행도에 따라
3스테이지 클리어는 이미 충족되었을 수 있다. 그러면 T3 게이트는 실질적으로 "T2를 L4까지
올렸는가"만 남는다. L4 누적 13 Shard이므로 L10 시점(40)에도 도달 가능하지만, 6칸을
고르게 올리는 플레이어는 L25 근처에서 T3를 연다. **의도된 선택 압력**이다: 넓게 갈지
좁게 파고들지.

---

## 4. 경제

### 4.1 Echo Shard 수급

| 시점 | Shard |
|---|---|
| `DESCENT` 완료 | 0 |
| `SKIRMISH` 완료 | 1 |
| `SURGE` 완료 | 1 |
| `MIDBOSS` 처치 | 2 |
| `BIGWAVE` 완료 | 1 |
| `FINALE` 처치 | 3 |
| **스테이지 합계** | **8** |

`encounter-wave-spec.md#6`의 보상 케이던스 표와 동일한 값이다. 두 문서가 어긋나면
`master-numeric-contract.md`를 권위로 삼고 이 절을 정본으로 복원한다.

### 4.2 승급 비용과 소요

| 레벨 | 비용 | 누적 |
|---|---|---|
| L2 | 2 | 2 |
| L3 | 4 | 6 |
| L4 | 7 | 13 |
| L5 | 12 | 25 |

| 목표 | 총 Shard | 스테이지 (올림) |
|---|---|---|
| 스킬 1종 L5 | 25 | 25/8 = 3.13 → **4** |
| 로드아웃 6칸 L5 | 150 | 150/8 = 18.75 → **19** |
| 20종 전부 L5 | 500 | 500/8 = 62.50 → **63** |

완주 판수는 **올림**이다. 62판은 496 Shard로 4 부족하다.

### 4.3 Warden Level 곡선

```
xpToNext(n) = round(120 * n^0.55)
xpReward(stageSeq, win) = (300 + 40*(stageSeq-1)) * (win ? 1.0 : 0.4)
```

| 레벨 | 승급 비용 | 누적 XP | Stage 5 승리 판수 | 패배만 판수 | 대략 시간 |
|---|---|---|---|---|---|
| L5 | 291 | 773 | 2 | 5 | 0.2 h |
| L10 | 426 | 2514 | 6 | 14 | 0.6 h |
| L25 | — | 10993 | 24 | 60 | 2.4 h |
| L45 | — | 27760 | 61 | 151 | 6.1 h |
| L60 | 1130 | 43560 | **95** | 237 | **9.5 h** |

Stage 5 승리 XP = `300 + 40×4 = 460`, 패배 = 184. 판수는 **올림**이다.
스테이지 6분 기준 환산.

### 4.4 세 축의 어긋난 완주 시점 (동시 종료 회피)

| 축 | 완주 판수 (올림) | 대략 시간 | 직전 축 대비 |
|---|---|---|---|
| 로드아웃 6칸 L5 | **19** | 1.9 h | — |
| 20종 전부 L5 | **63** | 6.3 h | **3.32×** |
| Warden L60 | **95** | 9.5 h | **1.51×** |

**등비가 아니다.** 간격은 3.32× → 1.51×로 좁아진다. 설계 목표는 균등 배분이 아니라
**동시 종료 회피**이며, 하나가 끝나도 다른 축이 남아 "더 할 것이 있다"가 유지되면 성립한다.

#### 19판에서 성장의 성격이 바뀐다

| 구간 | Echo Shard 용도 | 체감 |
|---|---|---|
| 1–19판 | 장착 6칸 L5 | **깊이** — 쓰는 스킬이 강해진다 |
| 20–63판 | 미장착 14종 육성 | **넓이** — 빌드 교체지가 늘어난다 |
| 64–95판 | 잉여 누적 | 리스펙 실험 자유도 |
| 전 구간 | (Shard 아님) Warden Level → 스탯 | **끊기지 않는 유일한 파워 축** |

| 판수 | 누적 Shard | 미장착용 여유 | Warden Level | **누적 획득 스탯 포인트** (Warden Level 경로) |
|---|---|---|---|---|
| 19 | 152 | 2 | L21 | 20 |
| 30 | 240 | 90 | L28 | 27 |
| 45 | 360 | 210 | L37 | 36 |
| 63 | 504 | 354 | L46 | 45 |
| 95 | 760 | 610 | L60 | 59 |

**19판 이후 Shard는 파워가 아니라 선택지를 산다.** 파워 곡선은 스탯 포인트가 이어받으며,
이것이 §6에서 스탯 상한을 10 → **19**로 올린 이유다.

스탯 포인트 출처는 **둘**이고, 비용은 **스탯별로** 매겨진다 `[OBSERVED]`
(`app.js:490`이 `wardenStatPointCost(points + 1)`을 스탯별 호출):

| 출처 | 최대 | 비용 |
|---|---|---|
| Warden Level (신규) | 59점 | 없음 (레벨당 1) |
| Echo Core (기존) | **16점** (4스탯 균등, 스탯당 4점) | Echo Core 40 |
| **합계** | **75점** | — |

| 스탯당 상한 | 4스탯 수용 | 75점 대비 |
|---|---|---|
| 10 (기존) | 40 | 35점 낭비 |
| 18 | 72 | 3점 낭비 |
| **19 (채택)** | **76** | **낭비 0** |

**Echo Core 40은 10점이 아니라 16점을 산다.** 비용 인덱스가 전역이 아니라 스탯별이므로
앞쪽 싼 구간(2,2,3,3)을 4스탯에서 각각 쓸 수 있다.

**분리 카운터 필수:** 무료 레벨 포인트와 유료 Core 포인트가 카운터를 공유하면 Core 비용이
할당 순서에 의존한다(레벨 4점 후 Core 1점 = 4, 반대 순서 = 2). `corePointsByStat`와
`levelPointsByStat`를 분리하고 비용은 전자만 인덱싱한다. 권위 계산은
`master-numeric-contract.md#5.3`.

---

## 5. 로드아웃 계약

### 5.1 슬롯

| 카테고리 | 상한 |
|---|---|
| `melee-amp` | 2 |
| `aoe-burst` | 2 |
| `mobility` | 1 |
| `sustain` | 1 |
| **합계** | **6** |

- 변경은 **로비에서만**. 런 중 변경 불가 — 빌드 결정을 사전 커밋으로 만든다.
- 미해금 스킬은 장착 불가. 카테고리 상한 초과는 UI가 커밋 전에 차단
  (`ui/hud-information-architecture.md`).

### 5.2 원자적 교체

```
swapLoadout(slotIndex, nextSkillId):
  1. 검증: nextSkillId 해금됨 && 카테고리 상한 위반 없음 && 중복 장착 아님
  2. 실패 시 즉시 반환 — 부분 적용 없음
  3. 성공 시 새 배열을 만들어 통째로 치환 (in-place 변형 금지)
  4. 저장 커밋 후에만 UI 갱신
```

저장 실패 시 이전 로드아웃이 그대로 유지된다. 중간 상태가 관측되지 않는다.

### 5.3 저장 스키마 델타

기존 `campaign.wardenProgress` `[OBSERVED]`는
`{ statPoints, skillTreeIds, traitIds }`만 갖는다(`campaign-state.js#validWardenProgress`는
이 세 키만 허용).

```
wardenProgress: {
  // statPoints 는 폐기 -> 두 카운터로 분리 (§4.4 순서 의존성 제거)
  corePointsByStat:  { "<statId>": 0..10 },  // 유료. 비용 인덱스는 이것만
  levelPointsByStat: { "<statId>": 0.. },    // 무료. Warden Level 지급분
  skillTreeIds: [ ... ],          // 기존 (§6에서 축소)
  traitIds:     [ ... ],          // 기존
  wardenLevel:  1,                // 신규
  wardenXp:     0,                // 신규
  skillLevels:  { "<id>": 1..5 }, // 신규 — 해금+레벨을 한 맵으로 표현
  loadout:      [ "<id>", ... ]   // 신규 — 길이 ≤6, 카테고리 상한 준수
}
campaign.echoShard: 0             // 신규 (최상위)
campaign.schemaVersion: 2         // 신규

// 파생값 (저장하지 않는다)
effectiveStat(id) = corePointsByStat[id] + levelPointsByStat[id]   // <= STAT_CAP(19)
```

`skillLevels`에 키가 없으면 **미해금**이다. 별도 `unlockedIds` 배열을 두지 않는다 —
두 곳에 진실을 두면 동기화 버그가 생긴다.

`effectiveStat`도 저장하지 않는다. 같은 이유다.

### 5.4 마이그레이션 (v1 → v2)

| 필드 | 처리 |
|---|---|
| `wardenLevel` | 1 |
| `wardenXp` | 0 |
| `echoShard` | `resolvedIds.length * 8` — 기존 진행에 소급 지급 |
| `skillLevels` | T1 8종을 L1로 부여 |
| `loadout` | T1에서 카테고리 상한대로 자동 구성 |
| `statPoints` → `corePointsByStat` | **기존 값을 그대로 이관.** 전부 Echo Core로 산 것이므로 유료 카운터가 맞다 |
| `levelPointsByStat` | 전 스탯 0 |
| 상한 | 10 → **19** (§4.4) |
| `echoCoreSpent()` | `corePointsByStat` 기준으로 재계산 — **바꾸지 않으면 무료 포인트가 예산을 잡아먹어 저장 검증이 실패한다** |
| `hasOnlyKeys` 검증 | `statPoints` 제거, 신규 6키 추가 |

마이그레이션은 **멱등**이다. `schemaVersion === 2`면 즉시 반환한다.

**v1 저장의 `statPoints`를 유료 카운터로 이관하는 것이 안전한 이유:** v1에는 무료 포인트
출처가 존재하지 않았다. 모든 점이 Echo Core 지출이므로 `echoCoreSpent()` 재계산 결과가
v1과 동일하다.

---

## 6. 기존 시스템 통합 — 유지 / 흡수 / 폐기

| 시스템 | 현재 `[OBSERVED]` | 처분 | 사유 |
|---|---|---|---|
| `WARDEN_STATS` 4종 | 상한 10, Echo Core 40 | **유지 + 확장** | **상한 19** (§4.4 두 출처 합산 75점), 포인트 출처에 Warden Level 추가 |
| `wardenStatPointCost` | `ceil(n/2)+1`, 스탯별 인덱스 | **유지, 호출부 변경** | 곡선은 그대로. 인덱스를 `corePointsByStat`로 바꾼다 (§5.3) |
| `WARDEN_SKILL_TREE` 5노드 | Echo Core, 총 41 | **축소 → 2노드** | `echo-backlash`/`echo-cascade`는 `cinder-edge`와 중복. `wardens-ward`는 `hollow-covenant`와 중복. **`gate-resolve` 계열 2노드만 남긴다** |
| `WARDEN_TRAITS` 8종 | 시퀀스 2/4/6/8/10에 3중1 | **유지** | 캠페인 마일스톤 보상이며 카테고리 스킬과 층위가 다름 |
| `EQUIPMENT` 3슬롯 × 5티어 | Bound Fragment | **유지** | 별도 화폐·별도 축. 스킬과 경쟁하지 않음 |
| `XP_GROWTH` 런 제안 | 런 한정 8종 | **유지** | 런 내 변주. 영구 스킬과 명확히 구분 |
| `SKILLS` 플랫 8종 | 5액티브 3패시브 | **폐기 → 20종으로 대체** | `SKILLS` 상수는 삭제하고 `SKILL_CATEGORIES`로 교체 |
| `FORMATION_STANCES` 3종 | VANGUARD/TURRET/SPLIT | **폐기** | 아래 |
| `COMPANIONS` 9종 + 편성 | 자동 전투 동료 | **유지, 축소** | 아래 |

### 6.1 `FORMATION_STANCES` 폐기 근거

스탠스는 자동 전투 동료의 배치 형태를 바꾸는 시스템이다 `[OBSERVED]`
(`rpg-catalog.js#STANCE_CONFIG`). 액션 전투에서 플레이어의 손은 이동 + 3동사 + 6스킬로
이미 포화 상태이며(`ui/hud-information-architecture.md`), 여기에 스탠스 순환을 더하면
입력이 무너진다. `STANCE_CYCLE` 입력을 폐기하고 그 자리를 스킬 카테고리 로드아웃이 받는다.

기존 G3 게이트(편성)는 **재정의**된다: "스탠스 전환이 동료 생존에 영향을 주는가"에서
"카테고리 로드아웃이 페이즈별 대응을 만드는가"로.

### 6.2 동료 축소

동료는 **자동 전투 3인 편성**을 유지하되 스탠스 없이 단순 추종한다. 정예 추출은
`FINALE` 보상으로 유지되어 수집 동기가 남는다. 동료 역할 패시브
(`COMPANION_ROLES`)는 그대로 적용한다.

---

## 7. 리스펙 비대칭

| 대상 | 리스펙 | 비용 |
|---|---|---|
| 스킬 레벨 | **가능, 무제한** | 환급 100%, 수수료 Echo Shard 5 |
| 스탯 포인트 | **가능** | 환급 100%, 수수료 Echo Shard 10 |
| Echo Core (스탯/트리) | **불가** | 기존 규칙 유지 |
| 특성(trait) | **불가** | 기존 규칙 유지 |

**비대칭 정당화:** Echo Shard 축은 로그라이트 실험 축이다 — 빌드를 갈아 끼우며 페이즈별
대응을 찾는 것이 재미의 핵심이므로 되돌릴 수 있어야 한다. Echo Core와 trait는 캠페인
서사 마일스톤이며 **되돌릴 수 없는 선택**이라는 무게가 그 가치다. 둘을 같은 규칙으로
묶으면 한쪽은 무겁고 다른 쪽은 가벼운 이유가 사라진다.

수수료를 두는 이유: 0이면 매 스테이지 전 최적 조합을 재계산하는 것이 항상 옳아져
로드아웃 결정이 의미를 잃는다. 5–10은 스테이지 1판(8) 수준으로, **가끔 바꾸는 것은
자유롭지만 매판 바꾸는 것은 손해**인 값이다.

---

## 8. 무결성 픽스처

| # | 픽스처 id | 설정 | 단언 |
|---|---|---|---|
| 1 | `grw-loadout-atomic` | 교체 중 저장 실패 주입 | 이전 로드아웃 유지, 부분 적용 0 |
| 2 | `grw-loadout-category-cap` | `melee-amp` 3개 장착 시도 | 거부, 상태 불변 |
| 3 | `grw-loadout-duplicate` | 같은 스킬 2슬롯 장착 시도 | 거부 |
| 4 | `grw-loadout-locked-skill` | 미해금 T3 장착 시도 | 거부 |
| 5 | `grw-migration-v1-v2` | v1 저장(`resolvedIds` 3개, `statPoints` 있음) 로드 | `echoShard`=24, T1 8종 L1, `corePointsByStat`에 v1 값 이관, `levelPointsByStat` 전부 0, `echoCoreSpent()` v1과 동일, `schemaVersion`=2 |
| 6 | `grw-migration-idempotent` | v2 저장 2회 마이그레이션 | 두 번째는 무변경 |
| 7 | `grw-migration-key-allowlist` | v2 저장 → `validWardenProgress` | `statPoints` 제거·신규 6키 통과, 거부 0 |
| 7b | `grw-stat-cost-order-independent` | 레벨 4점 후 Core 1점 vs 역순 | 두 경우 Core 비용 동일(2), 최종 `effectiveStat` 동일 |
| 7c | `grw-core-budget-isolation` | 레벨 포인트 20점 배분 후 Core 구매 | `echoCoreSpent()` 불변, 예산 40 잠식 0 |
| 7d | `grw-core-max-points` | Echo Core 40 최적 배분 | 16점 획득 (4스탯 × 4점), 몰빵 시 10점 |
| 8 | `grw-shard-underflow` | Shard 3에서 L5 승급(12) 시도 | 거부, 잔액 3 유지 |
| 9 | `grw-defeat-award` | `BIGWAVE`에서 패배 | Warden XP 40%, Shard 도달분 100%, Echo Core 0 |
| 10 | `grw-tier-gate-t2` | `aoe-burst` T1 L3 도달 | `aoe-burst` T2만 해금, 타 카테고리 T2 잠김 유지 |
| 11 | `grw-tier-gate-t3` | T2 L4 + 3스테이지 클리어 | T3 해금. 둘 중 하나만이면 잠김 |
| 12 | `grw-respec-refund` | L5 스킬 리스펙 | 환급 25, 수수료 5, 순 +20, 레벨 1 복귀 |
| 13 | `grw-duplicate-grant` | 같은 페이즈 보상 2회 트리거 | Shard 1회만 지급 |
| 14 | `grw-level-curve` | XP 43560 주입 | `wardenLevel`=60, 초과 XP 보존, 61 미도달 |
| 15 | `grw-stat-cap` | 한 스탯 19점 시도 | 18에서 거부. 두 출처 합산 69점이 4스탯 수용 72 이내 |
| 16 | `grw-interrupted-save` | 승급 중 저장 중단 | Shard 미차감 또는 레벨 미상승 — 한쪽만, 중간 없음 |
