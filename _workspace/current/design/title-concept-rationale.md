# Title Concept Rationale — Abyssal Lantern / 심연의 등불

```yaml
run_id: 20260729-abyssal-lantern-narrative
status: "[TARGET] — 제목 근거. 개명 자체는 이 문서가 수행하지 않는다"
owner_skill: webtoon-harness (scenario discipline only)
depends_on: [design/abyssal-lantern-synopsis.md]
scope: 제목 정당화, 인픽션 해설, 기존 프리즈와의 정합성, 개명 소유권 명시
non_scope: README/package.json/워크플로 수정, 저장소·Pages 개명, 자산 생성
```

**개명 소유권 `[OBSERVED]`:** 실제 개명(`Abyssal Surge` → `Abyssal Lantern`, 저장소
`Abyssal-Surge` → `Abyssal-Lantern`, Pages 경로)은 **부모 세션의 릴리스 단계 소관**이다.
이 문서는 `README.md`, `package.json`, `.github/workflows/`를 수정하지 않았고, 그 어떤
코드 상수도 바꾸지 않았다. 근거 문서만 제공한다.

---

## 1. 제목이 풀어야 했던 문제

`[OBSERVED]` 기존 제목 `Abyssal Surge`는 폐기된 제품 정의를 가리킨다:

| `Surge`가 함의하는 것 | 현재 제품 상태 | 근거 |
|---|---|---|
| 밀려오는 파도 = **방어 대상** | 관문 방어 목표는 **폐기** | `design/master-gdd-delta.md:72` |
| 파도를 **버티는** 게임 | 직접 베고 피하는 액션 핵앤슬래시 | `design/onslaught-action-product-contract.md:17` |
| 플레이어는 **수비자** | 플레이어는 세 구역을 **횡단하는** 원정자 | `design/pcg-stage-layout-spec.md:83` (스폰→보스 17088) |
| 파도의 주체는 **적** | 주체는 Dusk Warden | `design/master-gdd-delta.md:41` (실패 조건: 지휘관 생존 실패) |

`[OBSERVED]` `SURGE`는 게임 안에 **페이즈 이름으로 이미 존재한다**
(`design/master-numeric-contract.md:27`, 4500 tick / 75 s). 즉 제품 제목이 자기 6페이즈 중
하나와 같은 단어다.

`[INFERENCE]` 제목이 페이즈 이름과 충돌하면 문서와 대화에서 "Surge"가 제품을 뜻하는지
`SURGE` 페이즈를 뜻하는지 매번 모호해진다. 이것만으로도 개명 근거가 된다.

---

## 2. 왜 `Lantern`인가 — 자산이 먼저 있었다

제목은 서사에서 역산한 것이 아니다. **런타임 자산에 이미 박혀 있던 단어다.**

### 2.1 `[OBSERVED]` 저장소 실측 근거

| # | 근거 | 위치 | 확인된 문자열 |
|---|---|---|---|
| L1 | 플레이어 원본 메쉬 경로 | `battle-realtime-three.js:139` | `assets/mesh/character/lantern-reaver-character/glb/base_basic_pbr.glb` |
| L2 | 플레이어 런타임 모션 모델 | `battle-realtime-three.js:127` | `assets/motion/ingame/characters/lantern-reaver/model.glb` |
| L3 | `PLAYER_MESH` 별칭 | `battle-realtime-three.js:140-141` | `PLAYER_RUNTIME_MOTION_MESH` → `PLAYER_MESH` |
| L4 | 미사상 동료 7종의 폴백 | `battle-realtime-three.js:163` | `MOTION_MODELS[id] ?? PLAYER_MESH` |
| L5 | 동료 카탈로그 표시명 | `defense-catalog.js:308` | `"lantern-reaver": { name: "Lantern Reaver", ... }` |
| L6 | 구역 1 VFX 실루엣 | `assets/motion/stage-vfx/manifest.json:19` | `"Lantern core, seal ring, cross-wind ember wake."` |
| L7 | 구역 1 reduced-motion 규칙 | `assets/motion/stage-vfx/manifest.json:20` | `"Keep the static lantern and seal ring; ..."` |
| L8 | 구역 3 VFX 실루엣 | `assets/motion/stage-vfx/manifest.json:107` | `"Caged lantern core, three echo rings, crown-like fractures."` |
| L9 | 구역 3 reduced-motion 규칙 | `assets/motion/stage-vfx/manifest.json:108` | `"Keep the static lantern and innermost echo ring; ..."` |
| L10 | 캐릭터 메쉬 디렉터리 실재 | `ls assets/mesh/character/` | `lantern-reaver-character`, `lantern-reaver-character.png` |
| L11 | 모션 디렉터리 실재 | `ls assets/motion/ingame/characters/` | `lantern-reaver` |
| L12 | 자산 승격 기록 | `production/task-manifest.md:174` | `Lantern Reaver 원본·런타임 경로 확정` |
| L13 | 승격 산출물 진술 | `production/task-manifest.md:185-186` | source `lantern-reaver-character`, 렌더 경로 `characters/lantern-reaver/model.glb` |

**`[OBSERVED]` `lantern`은 저장소에서 13개 독립 지점에 등장한다** — 메쉬 경로, 모션 경로,
코드 상수, 동료 카탈로그, 3구역 중 2구역의 VFX 실루엣 명세, reduced-motion 규칙, 승격
기록.

**`[OBSERVED]` 대조: `surge`는?** `SURGE`는 페이즈 이름(`master-numeric-contract.md:27`)과
제품 제목으로만 존재하고, **런타임 자산 경로·메쉬 이름·VFX 실루엣 명세에는 없다.**

`[INFERENCE]` 즉 자산 계층은 이미 등불 게임이다. 제목이 뒤늦게 따라붙는 것이다.

### 2.2 `[OBSERVED]` 두 구역이 `low` 품질에서도 등불을 남긴다

`assets/motion/stage-vfx/manifest.json` 품질 정책 실측
(`:118-136` 및 구역 1·2 대응 블록):

```
qualityGroups: { core: "vfx-core", detail: "vfx-detail", decor: "vfx-decor" }
qualityPolicy: high [core, detail, decor] / balanced [core, detail] / low [core]
```

`[OBSERVED]` `low` 티어에서는 `core`만 살아남는다. 그리고 구역 1·3의 `core`에 담긴 것이
**등불이다** (L6, L8 — 각각 `Lantern core`, `Caged lantern core`).

`[INFERENCE]` **최저 품질 기기에서 화면에 남는 마지막 형태가 등불이다.** 제목이 가리키는
대상이 성능 열화의 끝까지 생존한다는 뜻이며, 이것은 제목으로서 이례적으로 강한 근거다.

### 2.3 `[OBSERVED]` 정확성 경계 — 과장하지 않는다

**Dusk Warden이 전투에서 렌더하는 모델은 `lantern-reaver`가 아니다.**

| 사실 | 값 | 라인 |
|---|---|---|
| 지휘관 표준 모델 해석 | `COMMANDER_MODEL` | `battle-realtime-three.js:606` |
| `COMMANDER_MODEL` 값 | `MOTION_MODELS["human-command-boss"]` | `:165` |
| 실제 경로 | `assets/motion/ingame/characters/human-command-boss/model.glb` | `:126` |
| 지휘관 폴백 경로 | `PLAYER_SOURCE_MESH` (= `lantern-reaver-character`) | `:626-627`, `:139` |

`[INFERENCE]` 따라서 정확한 진술은:

> **`lantern-reaver`는 Dusk Warden의 전투 실루엣이 아니라 그가 속한 계보다** — 원본 식별
> 메쉬(L1), 동료로 배치될 때의 모델(L4, L5), 그리고 미사상 동료 7종이 폴백하는 형태(L4).

제목의 근거는 **이 계보**이며 전투 실루엣이 아니다. 이 구분을 지우면 근거가 거짓이 된다
(`design/abyssal-lantern-synopsis.md#3.1` 동일 경고).

---

## 3. 왜 `Abyssal`을 유지하는가

`[OBSERVED]` `Abyssal`은 프리즈 대상이다:

| 근거 | 위치 | 내용 |
|---|---|---|
| G1 세계관 게이트 | `production/task-manifest.md:78` | `G1 세계관 \| PASS \| 영향 없음 \| 고유명·순서 유지, 전달 매체만 변경` |
| 보존 필러 | `design/master-gdd-delta.md:61` | `심연 세계관 고유명과 3구역 여정` |
| 제품 경계 | `design/onslaught-action-product-contract.md:29` | `심연 세계관의 세 구역 ... 유지한다` |
| 구역 2 id 자체 | `defense-catalog.js:567` | `"abyss-chancel"` |
| 구역 2 표시명 | `defense-catalog.js:567` | `"Abyss Chancel"` |
| 한국어 표기 | `defense-catalog.js:588` | `"심연 예배소"` |

`[OBSERVED]` `Abyssal`을 바꾸면 G1이 PASS에서 재측정 대상으로 내려간다. **개명은 G1을
건드리지 않아야 한다.**

`[INFERENCE]` 따라서 개명의 자유도는 두 번째 단어뿐이었다:
`Abyssal ______`. `Lantern`은 그 자리에 자산 근거(§2)를 갖고 들어온다.

---

## 4. 인픽션 해설 — 제목이 게임 안에서 무엇을 뜻하는가

### 4.1 표층

**심연의 등불** = Dusk Warden이 들고 내려가는 마지막 광원.

### 4.2 심층 — 소유격의 이중성

한국어 `심연의 등불`의 `의`는 두 가지로 읽힌다. **둘 다 참이도록 의도했다.**

| 독법 | 뜻 | 서사 대응 |
|---|---|---|
| **주격적** — 심연이 소유한 등불 | 등불은 원래 심연의 것이다. Warden은 빌린 것을 들고 내려간다 | `abyssal-lantern-synopsis.md#2.3` — Gate Sovereign은 왕좌가 삼킨 등불잡이다. 등불은 결국 심연으로 돌아간다 |
| **처소격적** — 심연 속의 등불 | 어둠 안에 있는 하나의 빛 | `abyssal-lantern-synopsis.md#1.1` — 등불을 지키려면 태워야 하고 태우면 줄어든다 |

`[INFERENCE]` 영어 `Abyssal Lantern`도 같은 이중성을 갖는다: `abyssal`이 형용사로
`심연 같은/심연에 속한` 둘 다 되므로, `심연이 만든 등불`과 `심연에서 켜진 등불`이 동시에
읽힌다.

### 4.3 3구역이 제목의 세 가지 뜻이다

| 구역 | 등불의 역할 | 극적 질문 (시놉시스 §2) | 자산 근거 |
|---|---|---|---|
| Cinder Span | **들고 간다** | 이것이 구조인가, 심연에 길을 밝혀주는 것인가? | `[OBSERVED]` `Lantern core, seal ring` (L6) — 등불이 온전하다 |
| Abyss Chancel | **반사된다** | 내 등불이 비추는 것이 길인가, 나 자신인가? | `[OBSERVED]` `Rift lens, ... offset mirror shards` (`assets/motion/stage-vfx/manifest.json:63`) — **등불이 없고 렌즈만 있다** |
| Echo Throne | **갇힌다** | 왕좌에 놓으면 닫히는가, 다음 군주가 생기는가? | `[OBSERVED]` `Caged lantern core` (L8) — 등불이 **우리에 갇혀** 있다 |

**`[OBSERVED]` 이 3단 구조는 내가 만든 것이 아니다.** 세 VFX 실루엣 명세가 이미
`온전한 등불 → 등불 없음(렌즈) → 갇힌 등불`로 저작되어 있다
(`assets/motion/stage-vfx/manifest.json:19`, `:63`, `:107`).

`[INFERENCE]` 세 구역의 앰비언트 VFX가 우연히 이 순서를 이룰 확률은 낮다. 자산 저작 시점에
이미 등불의 변화가 의도되었거나, 최소한 제목이 그 의도와 충돌하지 않는다.

### 4.4 게임 규칙과의 정합 — 등불은 자원이 아니다

`[TARGET]` **게임에 등불 게이지·연료·충전은 없고, 이 문서는 그것을 신설하라고 요구하지
않는다.**

| 규칙 `[OBSERVED]` | 근거 | 등불 해석 |
|---|---|---|
| 결정론 시뮬레이션 권위, 렌더러는 읽기 전용 | `CLAUDE.md §2`; `design/master-gdd-delta.md:58` | 등불은 **읽기 전용 은유**. `getRunDigest()` 입력에 아무것도 더하지 않는다 |
| 실패 시 Warden XP 40% + 도달 Shard 100% 보존 | `design/onslaught-action-product-contract.md:43` | 등불은 꺼지지 않는다. **심지가 짧아질 뿐이다** |
| 캠페인 실패 조건 없음 | `design/master-gdd-delta.md:236` | 든 자가 죽으면 다음 Warden이 같은 등불을 든다 |
| 승리는 `FINALE` 처치 뿐 | `design/master-gdd-delta.md:229` | 심연은 기다려서 닫히지 않는다 |
| 한 원정 300–480 s | `design/master-numeric-contract.md:18` | 등불 하나가 버티는 시간 |
| 구역 진행에 따라 안개 `near`/`far` 감소 | `[OBSERVED]` `battle-realtime-three.js:489-491` (`1.6/3.6 → 1.5/3.3 → 1.4/3.0`) | 내려갈수록 보이는 범위가 줄어든다 — **이미 저작된 값이 하강을 표현한다** |

`[INFERENCE]` 마지막 행이 특히 중요하다. 안개가 구역마다 좁아지는 것은 제목을 위해 바꾼
것이 아니라 **원래 그렇게 저작되어 있었다.** 제목이 기존 저작값에 이름을 준다.

---

## 5. 프리즈 무영향 확인

| 프리즈 항목 | 개명이 바꾸는가 | 근거 |
|---|---|---|
| 구역 3개와 순서 `Cinder Span → Abyss Chancel → Echo Throne` | **아니오** | `defense-catalog.js:566-568` 미수정 |
| 보스 3명 `s1-cinder-warden` / `s2-veil-tactician` / `s3-gate-sovereign` | **아니오** | `defense-catalog.js:322-324`, `battle-realtime-three.js:147-151` 미수정 |
| 보스 표시명 `Cinder Warden` / `Veil Tactician` / `Gate Sovereign` | **아니오** | `defense-catalog.js:566-568` 미수정 |
| 스테이지 id 3개 | **아니오** | 동일 |
| `Echo Throne` 종결 | **아니오** | `design/master-gdd-delta.md:235` |
| G1 세계관 게이트 PASS | **아니오** — `Abyssal` 유지 (§3) | `production/task-manifest.md:78` |
| 자산 경로 | **아니오** | `assets/**` 미수정 |
| 런타임 allowlist 4파일 | **아니오** | `scripts/defense-runtime-assets.mjs`, `assets/defense-asset-manifest.json`, `.github/workflows/static.yml`, `sw.js` 전부 미수정 |
| 결정론 다이제스트 | **아니오** | 코드 상수 0건 수정 |

**`[OBSERVED]` 이 문서가 수정한 파일: 0건. 생성한 파일: 자기 자신 1건
(`_workspace/current/design/title-concept-rationale.md`).**

---

## 6. 개명 체크리스트 — 부모 세션용 (실행하지 않았음)

`[TARGET]` 부모 세션이 릴리스 단계에서 개명을 수행할 때 참조할 목록이다. **내가 실행하지
않았고, 완전성을 보증하지 않는다** — 실제 수행 전에 저장소 전역 검색으로 확인해야 한다.

| # | 대상 | 내가 확인한 상태 | 주의 |
|---|---|---|---|
| 1 | `README.md` | `[OBSERVED]` `design/master-gdd-delta.md:273`이 이미 **전면 개정 대상**으로 지정 | `production/task-manifest.md:69` — README 갱신은 슬라이스 2 사람 플레이 판정 **뒤** |
| 2 | `package.json` | 미확인 (내 레인 밖) | 이름 변경이 빌드·배포 경로에 영향할 수 있다 |
| 3 | `.github/workflows/` | 미확인 (내 레인 밖) | `PAGES_RUNTIME_PATHS`는 **자산 경로**이며 제목과 무관 — 자산 경로를 바꾸지 말 것 |
| 4 | 저장소명 `Abyssal-Surge` → `Abyssal-Lantern` | 미실행 | Pages URL 변경 → 기존 링크 파손 |
| 5 | `index.md` / `log.md` (llm-wiki) | `[OBSERVED]` `design/master-gdd-delta.md:277`이 갱신 대상으로 지정 | `CLAUDE.md §4` — 4개 동시 갱신 규칙 |
| 6 | `assets/video/abyssal-surge-defense-survivor-smoke.mp4` | `[OBSERVED]` 실존 (`lobby-story-presentation-spec.md:21`) | **파일명에 `abyssal-surge` 포함.** 개명 시 allowlist 4파일 동기 필요 — 리스크 대비 이득이 낮으므로 **유지 권고** |
| 7 | `SURGE` 페이즈 이름 | `[OBSERVED]` `design/master-numeric-contract.md:27` | **바꾸지 말 것.** 페이즈 이름은 수치 계약 소유이며 제목과 별개다 |
| 8 | `_workspace/archive/**` | — | `CLAUDE.md §1` — **불변.** 개명이 아카이브를 소급 수정하지 않는다 |

**`[TARGET]` 7번이 함정이다.** 제목에서 `Surge`를 없애는 것과 `SURGE` 페이즈 상수를
바꾸는 것은 다른 일이다. 후자는 `master-numeric-contract.md`, `encounter-wave-spec.md`,
시뮬레이션 코드, 테스트 픽스처를 동시에 건드리며 **결정론 다이제스트에 영향한다.**
제목 개명은 페이즈 이름을 건드리지 않는다.

---

## 7. 기각한 대안

| 대안 | 기각 사유 |
|---|---|
| `Abyssal Descent` | `DESCENT`가 이미 페이즈 이름 (`master-numeric-contract.md:23-26`). `Surge`와 같은 충돌을 반복한다 |
| `Abyssal Warden` | `Warden`이 과적재 상태 — 플레이어 호칭(Dusk Warden), 보스명(Cinder Warden), 레벨 축(Warden Level `master-gdd-delta.md:150`), 동료 2종(`pack-warden`, `requiem-warden` `defense-catalog.js:307`,`:309`). 다섯 번째 의미를 얹으면 모호해진다 |
| `Abyssal Throne` | `Echo Throne`이 구역 3 (`defense-catalog.js:568`). 제목이 최종 구역만 가리켜 3구역 여정을 지운다 |
| `Abyssal Reaver` | `lantern-reaver`의 절반만 취한다. `[OBSERVED]` VFX 실루엣이 명세하는 단어는 `lantern`이며 `reaver`가 아니다 (L6, L8) |
| `Lantern of the Abyss` | 영문 4단어. 저장소명·Pages 경로·패키지명에서 길다 |
| 제목 유지 (`Abyssal Surge`) | §1의 네 가지 함의 불일치 + 페이즈 이름 충돌이 남는다 |

---

## 8. 이 문서가 주장하지 않는 것

- 개명이 승인되었다는 것 — 승인은 `production/decision-log.md`와 부모 세션 소관.
- 개명이 수행되었다는 것 — `[OBSERVED]` 이 세션의 코드·설정·워크플로 수정 0건.
- 제목이 좋다는 것 — 사람 판정 사항. §2는 **자산 정합성**만 증명한다.
- 자산 저작자가 등불 3단 구조를 의도했다는 것 — §4.3은 `[INFERENCE]`다. `[OBSERVED]`인
  것은 세 `manifest.json` 실루엣 문자열이 그 순서를 이룬다는 사실뿐이다.
- 체크리스트(§6)가 완전하다는 것 — 저장소 전역 검색으로 보강해야 한다.
