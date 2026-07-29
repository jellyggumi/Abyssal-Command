# Image-Driven Staging Spec — 화면과 이미지로 의미를 전달한다

```yaml
run_id: 20260729-abyssal-lantern-narrative
status: "[TARGET] — 미측정 설계 목표. 어떤 게이트도 통과하지 않았다"
owner_skill: build-game-camera-controls + create-game-vfx
authority_numeric: design/master-numeric-contract.md
authority_camera: design/camera-vfx-direction.md
authority_hud: ui/hud-information-architecture.md
renderer_authority: battle-realtime-three.js
depends_on:
  - design/abyssal-lantern-synopsis.md
  - design/boss-pattern-spec.md
  - design/action-combat-spec.md
scope: 비트별 카메라 언어, VFX 의미 사상, 스킬·아이템 피드백, 구역 분위기, 텍스트 예산, 몰입 유지
```

사용자 요구(원문): **"연출적인 부분은 텍스트위주가아니라 화면과 이미지로 구성해야해."**

이 문서는 그 요구를 **비트마다 텍스트 없이 무엇이 의미를 나르는가**로 번역한다. 텍스트를
줄이는 것이 목표가 아니라, **텍스트가 나르던 정보를 화면이 나르게** 하는 것이 목표다.

---

## 0. 렌더러 좌표계 — 내가 읽은 소스 라인 (필수 선행)

`production/task-manifest.md:45-51`이 기록한다: 지난 사이클 결함 **10–12는 렌더러 소스를
읽지 않고 카메라 수치를 설계한 결과**였다. 이 문서는 그것을 반복하지 않는다.

### 0.1 읽은 라인 목록 `[OBSERVED]`

| `battle-realtime-three.js` 라인 | 무엇을 확인했는가 | 확인된 값 |
|---|---|---|
| `:45` | `WORLD_SCALE` | `14` |
| `:52` | `TERRAIN_TARGET_HALF_EXTENT` | `WORLD_SCALE * 1.15` = 16.1 |
| `:58-65` | `TARGET_HEIGHT` 전체 | `commander 2.9 / boss 4.5 / elite 2.2 / enemy 1.7 / companion 1.3 / stageNpc 1.8` |
| `:82-83` | 피치 clamp | `MIN_ORBIT_PITCH` 30°, `MAX_ORBIT_PITCH` 85° |
| `:87` | `TERRAIN_CORNER_RADIUS` | `TERRAIN_TARGET_HALF_EXTENT * √2` = 22.769 |
| `:90` | `BOSS_RADIUS` | `TARGET_HEIGHT.boss / 2` = 2.25 |
| `:96` | `ORBIT_ZOOM_DEFAULT` | `hypot(14×1.05, 14×1.05)` = 20.789 |
| `:103-104` | **pre-mount 폴백** clamp | `ORBIT_ZOOM_DEFAULT × 0.5` / `× 2` = `[10.394, 41.578]` |
| `:115-116` | 림 라이트 | `RIM_LIGHT_DISTANCE 20`, `RIM_LIGHT_PITCH 35°` |
| `:121-133` | `MOTION_MODELS` 11종 | §3.1 캐스트 근거 |
| `:139-141` | 플레이어 메쉬 3경로 | source / runtime motion / `PLAYER_MESH` |
| `:147-151` | `BOSS_MODELS` | 3보스 1:1 |
| `:153-158` | `ENEMY_MODELS` | `rusher→scout`, `flanker→shade`, `guardian→shadow-soldier-v04`, `ranged→possessed` |
| `:387` | `MELEE_PRESENTATION_DISTANCE` | `TARGET_HEIGHT.boss` = 4.5 |
| `:391-396` | 히트 플래시 | 색 `0x5DE6FF` / heavy `0xA06BFF`, `180 ms` / heavy `320 ms`, peak `0.55` / `1.1` |
| `:400-403` | 넉백 | `160 ms` / heavy `260 ms`, 거리 `0.12` / heavy `0.26` 월드 유닛 |
| `:406-409` | **카메라 흔들림 실측** | `IMPACT_SHAKE_MS 220`, `AMPLITUDE 0.07`, `BOSS_AMPLITUDE 0.13`, `FREQUENCY 38` |
| `:412-428` | `IMPACT_FEEDBACK_SOURCES` | 6 이벤트 → `{attackerId, targetId, heavy}` |
| `:437` | `MOVE_EPSILON` | `0.01` |
| `:469-470` | 픽업 색 | `COLORS.pickup = 0xFFAA00` |
| `:479-483` | `STAGE_PALETTE_TINTS` | `cinder-span 0xF3592C`, `abyss-chancel 0x8F67FF`, `echo-throne 0x72C8FF` |
| `:487-492` | **`STAGE_FOG_MULTIPLIERS` — 3스테이지만** | base `{1.8, 4.2}`; `cinder-span {1.6, 3.6}`, `abyss-chancel {1.5, 3.3}`, `echo-throne {1.4, 3.0}` |
| `:498-501` | `stageFogRange(stageId)` | `{ near: 14×m.near, far: 14×m.far }`, **페이즈 인자 없음** |
| `:540-552` | `worldPointInto` | 정규화 분기 + `(v/WORLD_W×2−1)×14` |
| `:596-598` | `orbitDistanceForRadius` | `(radius / sin(fov/2)) × margin` |
| `:604-617` | `standardActorModelPath` | `commander → COMMANDER_MODEL` (`:606`) |
| `:619-640` | 폴백·명시 모션 라우팅 | `:626-627` commander/companion → `PLAYER_SOURCE_MESH` |
| `:642-649` | `actorTargetHeight` | `elite` 판정 `:647` |
| `:1364` | 포트레이트 카메라 | `PerspectiveCamera(35, 1, 0.05, 50)` — 로비 소형 뷰 |
| `:1535` | **기본 피치 실측** | `orbitPitch = degToRad(65)` |
| `:1536` | 기본 줌 | `zoomFactor = ORBIT_ZOOM_DEFAULT` |
| `:1623` | **mount 안개** | `THREE.Fog(COLORS.backgroundBottom, 14×1.8, 14×4.2)` = `near 25.2 / far 58.8` |
| `:1626` | **전투 카메라 생성** | `PerspectiveCamera(42, width/height, 0.1, 200)` |
| `:1632-1633` | **런타임 clamp 확정 지점** | `MIN = orbitDistanceForRadius(cam, BOSS_RADIUS, 1.2)`, `MAX = orbitDistanceForRadius(cam, TERRAIN_CORNER_RADIUS, 1.1)` |
| `:1635-1646` | 조명 3종 | ambient 1.1 / key 1.6 `(6,10,4)` / rim 0.6 |
| `:1648-1651` | 그룹 3종 | `terrainGroup`, `actorGroup`, `vfxGroup` |
| `:1686-1699` | 픽업 머티리얼 | emissive `1.2`, `depthWrite: false` |
| `:1826-1832` | 스테이지 안개 적용 | `stageFogRange(stageId)` → `fog.near/far` 덮어씀 |
| `:2482-2496` | 픽업 렌더 | `OctahedronGeometry(0.14, 0)`, emissive `0.8` |
| `:2643-2707` | **`updateCamera()` 전문** | 팔로우 → 오빗 위치 → 림 라이트 |
| `:2656-2658` | 팔로우 스무딩 실측 | `cameraTarget += (target − cameraTarget) × 0.18` **프레임률 의존** |
| `:2666-2676` | 거리·yaw·피치 clamp 적용 | `MIN/MAX_ORBIT_DISTANCE`, `MIN/MAX_ORBIT_PITCH` |
| `:2677-2686` | 구면 좌표 → 위치 + `lookAt` | `lookAt(x, y + 0.6, z)` |
| `:2735-2748` | `worldToNDC` | `project()` 후 `z` 범위 판정, `visible` 계산 |
| `:3002-3042` | `registerImpactFeedback` | heavy만 흔들림 (`:3034`) |
| `:3105-3119` | **`applyCameraShake` 실측** | `decay = (1−p)²`, 3축 `sin/sin/cos`, y축 `×0.6` |
| `:3163-3170` | `SKILL_CAST` / `SKILL_RESOLVED_DAMAGE` 처리 | `triggerAttackDelivery`, `bighit`/`hit` |
| `:3317-3318` | 리셋 시 기본값 | 피치 `65°`, 줌 `ORBIT_ZOOM_DEFAULT` |
| `:2591-2605` | 스테이지 시작 판정 | `STAGE_STARTED` + `tick === 0`, 신규 런 중복 제거 리셋 |
| `:2609-2626` | **`startStageIntro()`** | `presentation.cinematic.intro` 읽어 `stageIntro` 설정. `reducedMotion`이면 무동작 |
| `:2628-2641` | **`stageIntroOffsets(tick)`** | `distance`/`azimuth`/`polar` 선형 보간, `progress ≥ 1`이면 해제 |
| `:1799-1803` | 스테이지 분위기 소비 주석 | 렌더러가 per-stage atmosphere를 읽는다는 이력 |

**`battle-realtime-three.js` 외 읽은 파일 `[OBSERVED]`:**

| 파일 · 라인 | 무엇을 확인했는가 | 확인된 값 |
|---|---|---|
| `defense-catalog.js:566-568` | 3구역 프리즈 | id / 표시명 / 보스명 / `eliteId` / `eliteCompanion` |
| `defense-catalog.js:322-324` | 보스 엔티티 | `s1-cinder-warden` 40000 HP, `s2-veil-tactician` 48000, `s3-gate-sovereign` 60000 |
| `defense-catalog.js:294-298` | `ENEMIES` 4종 | `rusher`/`flanker`/`guardian`/`ranged` 수치 |
| `defense-catalog.js:300-310` | `COMPANIONS` 9종 | `lantern-reaver` 포함 |
| `defense-catalog.js:231-259` | `CUTSCENES` | 구역별 `intro`/`bossEntry`/`elite`/`victory`/`defeat` |
| `defense-catalog.js:575-597` | `STAGE_PRESENTATION_BY_ID` | 분위기·모티프·랜드마크·지형 패턴 |
| `stage-world-catalog.js:111-113` | `cinder-span` 프레젠테이션 | `accent #f3592c`, 안개 22.4/50.4, 인트로 90 tick |
| `stage-world-catalog.js:148-150` | `abyss-chancel` 동일 | `accent #8f67ff`, 안개 24/54, 인트로 96 tick |
| `stage-world-catalog.js:185-187` | `echo-throne` 동일 | `accent #72c8ff`, 안개 23/55, 인트로 102 tick |
| `stage-world-catalog.js:255-256` | 인트로 스키마 검증 | `durationTicks` 정수 `1–300` 강제 |
| `assets/motion/stage-vfx/manifest.json` 전문 | 스테이지 VFX 3종 | §3.1 |
| `tests/stage-runtime-proof-browser.test.mjs:153-154`, `:296-297` | 안개 오라클 | `stageFogRange()` 기준 단언 |
| `battle-visualizer.js:336-341` | `atmosphere.motif` 소비 | Canvas 폴백이 `motif`를 그린다 |
| `app.js:1044` | `atmosphere.descriptor` 소비 | 로비 브리핑 텍스트 |

### 0.2 좌표계 사실 — 이 문서가 쓰는 단위

`[OBSERVED]` `battle-realtime-three.js:540-552`, `:45`:

```
world.x = (gp.x / 24000 × 2 − 1) × 14
world.z = (gp.y / 12000 × 2 − 1) × 14
```

| 사실 | 값 | 근거 |
|---|---|---|
| 월드 평면 | 28 × 28 월드 유닛 | `:45`, `:547-548` |
| x축 환산 | 1 월드 = 857.14 게임플레이 | 24000 / 28 |
| z축 환산 | 1 월드 = 428.57 게임플레이 | 12000 / 28 |
| **이방성 z/x** | **2.0** | 위 두 행 |
| 전투 FOV | 42 | `:1626` |
| 카메라 far | 200 | `:1626` |
| 기본 피치 | **65°** | `:1535`, `:3317` |

**카메라 수치는 전부 월드 유닛으로 쓴다.** 게임플레이 단위로 카메라를 논하면 결함 10이
재발한다.

### 0.3 `[OBSERVED]` `design/camera-vfx-direction.md`와 라이브 소스의 불일치 — 4건

이 문서는 상위 카메라 권위(`camera-vfx-direction.md`)를 **재정의하지 않는다.** 그러나
그 문서의 라인 인용과 일부 수치가 현재 소스와 어긋난다. 여기 기록만 하고,
그 문서의 수정은 카메라 권위 소유자(`ui-senior-developer` 레인)와 부모 세션 소관이다.

| # | `camera-vfx-direction.md` 주장 | 라이브 소스 `[OBSERVED]` | 영향 |
|---|---|---|---|
| M1 | `:34-40` 카메라가 "라인 1500", 추적 "2426–2432", 흔들림 "2831–2834" | 카메라 `:1626`, `updateCamera()` `:2643-2707`, 흔들림 `:3105-3119` | 인용 라인 전부 드리프트. 추적 코드는 인용 범위에 없다 |
| M2 | `:104` 줌 clamp `[10.39, 41.58]` | 그 값은 **pre-mount 폴백**(`:103-104`). `mount()`이 `:1632-1633`에서 **덮어쓴다** → 실제 `[7.534, 69.888]` | §2 티어 표가 라이브 clamp를 기준으로 재검산되어야 한다 |
| M3 | `:48` 기본 피치 "55°로 고정 `[TARGET]`" | `:1535`, `:3317` 모두 `65°` | 55°는 아직 미구현 목표. 현재 프레이밍 관찰은 65° 기준 |
| M4 | `:338-345` 흔들림 진폭 0.6–4.0 월드 유닛 | `:406-409` `0.07` / boss `0.13` | **8.6×–57× 과대.** §4.2 참조 |

**검산 (내가 실행)** — `orbitDistanceForRadius`(`:596-598`)에 라이브 인자를 넣었다:

```
sin(42/2°)                    = 0.358368
MIN = (2.25      / 0.358368) × 1.2 =  7.534     // :1632, BOSS_RADIUS 2.25
MAX = (22.769    / 0.358368) × 1.1 = 69.888     // :1633, TERRAIN_CORNER_RADIUS 22.769
폴백 = 20.789 × 0.5 / × 2          = [10.394, 41.578]   // :103-104
```

**`[OBSERVED]` 라이브 clamp 상한 69.888 > mount 안개 far 58.8 (`:1623`).** 즉 현재 코드는
**안개 far를 넘는 거리까지 줌아웃을 허용한다.** `camera-vfx-direction.md:135-137`이 큰 줌을
기각한 근거가 "거리 62.4가 안개 far 58.8을 넘는다"였는데, 라이브 clamp는 그보다 더 먼
69.888을 이미 허용하고 있다.

`[TARGET]` 이 문서의 처분: **모든 비트를 clamp 상한이 아니라 안개 검증을 통과한 거리
안에서만 설계한다** (§2.3). clamp 자체를 바꾸라고 요구하지 않는다 — 그것은 카메라 권위
문서의 결정이다.

### 0.4 `[OBSERVED]` 팔로우 스무딩이 프레임률 의존이다

`battle-realtime-three.js:2656-2658`:

```js
this.cameraTarget.x += (targetX - this.cameraTarget.x) * 0.18;
```

`[OBSERVED]` 고정 계수 `0.18`이며 `dt`를 받지 않는다. 60 fps와 30 fps에서 다른 추종
속도가 된다. `camera-vfx-direction.md:64-65`가 지수 보간을 요구하는 이유가 정확히 이것이며,
**아직 구현되지 않았다.**

`[TARGET]` 이 문서의 비트 타이밍은 전부 **tick 단위**로 쓴다(ms 병기). 프레임률 의존
보간이 남아 있는 동안 초 단위 연출 타이밍은 기기마다 달라진다.

---

## 1. 최우선 원칙 — 이미지가 정보를 나른다는 것의 한계

`camera-vfx-direction.md:16-24`의 순서를 계승한다. **판독성 → 공정성 → 화려함.**

여기에 이 문서의 원칙 하나를 더한다:

> **이미지로 대체할 수 있는 텍스트만 대체한다.** 텍스트를 지워서 정보가 사라지면 그것은
> 연출 개선이 아니라 정보 삭제다.

| 텍스트 종류 | 처분 | 근거 |
|---|---|---|
| 위험 예고 | **이미 이미지다** — 월드 데칼. 텍스트 예고 금지 | `boss-pattern-spec.md:129` |
| 상태 (HP·쿨다운·충전) | **위치와 형태로** — 발밑 링, 아이콘 스윕 | `master-gdd-delta.md:198` |
| 페이즈 전환 | **카메라·안개·밀도로** — §3.2 | 이 문서 |
| 서사 (반전·동기) | **로비 미디어로 이관** — 전투 중 0자 | `lobby-story-presentation-spec.md:29` |
| 접근성 폴백 | **텍스트 유지 — 삭제 금지** | `lobby-story-presentation-spec.md:59-61` |
| 스크린 리더 | **텍스트 유지 — 삭제 금지** | `lobby-story-presentation-spec.md:69` |

**`[OBSERVED]` "텍스트 위주가 아니라"는 "텍스트 삭제"가 아니다.**
`lobby-story-presentation-spec.md:34-35`가 이미 같은 판정을 기록했다: 텍스트는
**1차 채널에서 폴백 채널로 강등**된다.

---

## 2. 카메라 언어 — 게임플레이 이벤트에 키된 명명 무브

### 2.1 기준 상태 (모디파이어 없음)

| 항목 | 값 | 근거 |
|---|---|---|
| FOV | 42 | `[OBSERVED]` `:1626` |
| 피치 | 65° (라이브) / 55° (`camera-vfx-direction.md:48` `[TARGET]`) | `[OBSERVED]` `:1535` |
| 거리 | 페이즈 티어 (§2.3) | `camera-vfx-direction.md:152-157` |
| 타겟 | 지휘관 1인 | `[OBSERVED]` `:2647-2651` |
| `lookAt` 오프셋 | `cameraTarget.y + 0.6` | `[OBSERVED]` `:2686` |

`[TARGET]` 모든 무브는 **기본 카메라 위의 일시 모디파이어**다. 종료 시 항상 기본으로
복귀한다 (`camera-vfx-direction.md:291-292` 계승).

### 2.2 명명 무브 8종 — 이벤트 키

**`[TARGET]` 아래 표의 모든 이름·길이·거리 배율·yaw 값은 이 문서가 새로 제안하는 설계
수치다. 측정값이 아니며 어떤 것도 구현되어 있지 않다.** 트리거 이벤트명만 기존 계약에서
가져왔다.

거리 배율은 **곱**, yaw는 **합**으로 합성한다 (`camera-vfx-direction.md:320-321`).
합성 결과 배율은 `[0.7, 1.25]`로 클램프하고 동시 활성 최대 3개
(`camera-vfx-direction.md:324-326`).

| # | 무브 이름 | 트리거 이벤트 | 길이 | 카메라 변화 | 플레이어가 읽어야 하는 것 | 가리면 안 되는 것 |
|---|---|---|---|---|---|---|
| CM1 | `lantern-descent` | 스테이지 진입 (`snapshot.tick` 0) | **90 / 96 / 102 tick (구역별 저작값)** | 저작 `from` → `to` 선형 보간 (§2.2.1) | "여기가 어디인가" — 구역 실루엣 각인 | 없음 (전투 전) |
| CM2 | `warden-reveal` | `BOSS_SPAWNED` | 180 tick (3.00 s) | yaw +120° 등속, 거리 ×0.85 | 보스 실루엣 크기와 아레나 범위 | 없음 (전투 정지 구간) |
| CM3 | `phase-press` | `BOSS_PHASE_CHANGED` | 60 tick (1.00 s) | 거리 ×0.80 ease-out → 복귀 | "더 위험해졌다" | 보스 실루엣 |
| CM4 | `telegraph-breathe` | `TELEGRAPH_BIG` 시작 | 예고 tick과 동일 | 거리 ×1.12 ease-in-out | 예고 데칼 **전체** | **예고 데칼 전체** |
| CM5 | `swarm-widen` | `BIGWAVE` 진입 | 90 tick (1.50 s) | 거리 → `BIGWAVE` 티어 지수 보간 | 포위 형태 | 예고 데칼, 안전지대 |
| CM6 | `finisher-hold` | `MELEE_CONTACT`(`LIGHT_3`) 접촉 ≥4체 | 20 tick (0.33 s) | yaw +8°, 표시 시계 ×0.65 | "쓸었다" | 주변 적 위치 |
| CM7 | `ember-fade` | 지휘관 HP <25% | 지속 | 가장자리 비네트 60% 알파, 카메라 이동 없음 | "등불이 짧다" | 중앙 70% 영역 |
| CM8 | `throne-settle` | 스테이지 클리어 | 240 tick (4.00 s) | 거리 ×1.22 등속, 피치 +8° | "끝났다 / 다음이 있다" | 없음 (전투 종료) |

### 2.2.1 `[OBSERVED]` CM1은 신규가 아니다 — 이미 구현되어 있다

`battle-realtime-three.js:2609-2626` `startStageIntro()`가
`stageWorldFor(stageId).presentation.cinematic.intro`를 읽어 `stageIntro`를 세우고,
`:2628-2641` `stageIntroOffsets(tick)`이 `distance`/`azimuth`/`polar`를 선형 보간해
`:2665`에서 `updateCamera()`의 기본 오빗에 **오프셋으로 가산**된다. 즉
`camera-vfx-direction.md:291-292`가 요구한 "기본 카메라 위의 일시 모디파이어" 구조가
진입 무브에는 **이미 성립해 있다.**

**`[OBSERVED]` 저작값:**

| 구역 | `durationTicks` | `from {distance, azimuth, polar}` | `to` | 근거 |
|---|---|---|---|---|
| `cinder-span` | 90 (1.50 s) | `{6, −0.24, −0.34}` | `{0, 0, 0}` | `stage-world-catalog.js:113` |
| `abyss-chancel` | 96 (1.60 s) | `{6.4, 0.3, −0.3}` | `{0, 0, 0}` | `stage-world-catalog.js:150` |
| `echo-throne` | 102 (1.70 s) | `{6.8, −0.4, −0.28}` | `{0, 0, 0}` | `stage-world-catalog.js:187` |

`[OBSERVED]` 스키마 검증이 `durationTicks`를 `1–300`으로 강제한다
(`stage-world-catalog.js:256`). `[OBSERVED]` `reducedMotion`이면 진입 무브 전체가
생략된다 (`battle-realtime-three.js:2610`, `:2630`).

`[INFERENCE]` 세 구역의 `from.distance`가 6 → 6.4 → 6.8로 **증가**하고 `durationTicks`가
90 → 96 → 102로 **증가**한다. 구역이 진행될수록 더 멀리서 더 길게 들어온다 —
`abyssal-lantern-synopsis.md#2`의 하강 구조와 방향이 일치한다. 이것은 서사가 요구한 것이
아니라 이미 저작되어 있던 값이다.

`[TARGET]` **따라서 CM1은 신규 구현이 아니라 저작값 재조정 대상이다.** 이 문서가 요구하는
것은 코드가 아니라 위 9개 숫자의 연출 의도 확정이다.

**`[OBSERVED]` CM8만 신규다** — `camera-vfx-direction.md:294-303`의 8종에도, 렌더러에도
스테이지 **종료** 무브는 없다. `[INFERENCE]` 서사 반전
(`abyssal-lantern-synopsis.md#2`)이 전투 중 텍스트 없이 전달되려면 구역의 첫 프레임과
마지막 프레임이 그 일을 해야 하며, **첫 프레임은 이미 장치가 있고 마지막 프레임은 없다.**
진입·종료 모두 전투 구간과 겹치지 않으므로 판독성 위험은 0이다.

**우선순위** (`camera-vfx-direction.md:327` 계승 + 신규 2종 삽입):

```
CM2 warden-reveal  >  CM4 telegraph-breathe  >  CM3 phase-press  >  CM5 swarm-widen
   >  CM1 lantern-descent  =  CM8 throne-settle  >  CM6 finisher-hold  >  CM7 ember-fade
```

`CM4`가 `CM3`보다 높은 이유는 계승된다: 풀백은 예고 데칼 전체를 프레임에 담기 위한 것이며
**회피 가능성 = 공정성** 문제다 (`camera-vfx-direction.md:329-330`).
`CM1`/`CM8`은 전투 구간과 겹치지 않으므로 실제 경쟁이 발생하지 않는다.

### 2.3 거리 티어 — 안개 안에서만 설계한다

`camera-vfx-direction.md:152-157`의 티어를 **인용**한다. 재정의하지 않는다.

| 페이즈 | `zoomFactor` (월드) | 근거 |
|---|---|---|
| `DESCENT` | 20.8 | `camera-vfx-direction.md:152` |
| `SKIRMISH` | 26.0 | `:153` |
| `SURGE` | 33.0 | `:154` |
| `MIDBOSS` | 38.0 | `:155` |
| `BIGWAVE` | 41.5 | `:156` |
| `FINALE` | 41.5 | `:157` |

`[OBSERVED]` 전 티어가 라이브 clamp `[7.534, 69.888]`(§0.3) 안에 든다. **clamp 변경 불필요.**

`[OBSERVED]` 그러나 mount 안개 far는 58.8(`:1623`)이고 스테이지 안개는 그보다 짧다
(`stageFogRange`, `:498-501`):

| 스테이지 | `near` | `far` | 근거 |
|---|---|---|---|
| `cinder-span` | 22.4 | **50.4** | `[OBSERVED]` `:489` `{1.6, 3.6}` × 14 |
| `abyss-chancel` | 21.0 | **46.2** | `[OBSERVED]` `:490` `{1.5, 3.3}` × 14 |
| `echo-throne` | 19.6 | **42.0** | `[OBSERVED]` `:491` `{1.4, 3.0}` × 14 |

**`[OBSERVED]` `echo-throne`의 안개 far 42.0 < `BIGWAVE`/`FINALE` 티어 거리 41.5 + 경계
깊이.** 최종 구역의 최종 페이즈가 안개에 묻히는 구조다. 이것이
`camera-vfx-direction.md:209-212`가 발견한 결함 12와 같은 문제이며, 해결책
(`:246-247` 페이즈별 `fogFar` 하한)은 **아직 구현되지 않았다** — `stageFogRange`
(`:498`)가 여전히 `stageId` 하나만 받는다.

`[TARGET]` **이 문서의 모든 비트는 안개 미해결을 전제로 설계한다.** 구체적으로:

| 규칙 | 내용 |
|---|---|
| S1 | 정보 레이어(예고 데칼·안전지대·회피 성공·실루엣 외곽선)는 `material.fog = false` — `camera-vfx-direction.md:216-224` 계승 |
| S2 | **의미를 나르는 이미지를 경계에 두지 않는다.** 안개 하한 구현 전에는 지휘관 반경 2500 게임플레이(월드 x 2.92 / z 5.83) 안에 배치 |
| S3 | 구역 분위기(§5)는 **근경 안개**로 표현한다. `fogNear`는 스테이지 저작값 그대로이며 (`camera-vfx-direction.md:274`) 미구현 위험이 없다 |
| S4 | `echo-throne`에서 원경 실루엣에 의존하는 연출을 쓰지 않는다 |

### 2.4 `[OBSERVED]` 이방성이 무브에 주는 제약

z/x = 2.0 (§0.2). **같은 게임플레이 반경이 남북으로 2배 크게 보인다.**

`[TARGET]` 원형 데칼은 월드 타원으로 그린다 —
`scale.x = r × 0.001167`, `scale.z = r × 0.002333` (`camera-vfx-direction.md:188-189` 계승,
`boss-pattern-spec.md:174-176` 동일). 검산: `1/857.14 = 0.001167`, `1/428.57 = 0.002333`.
§0.2의 환산과 일치한다.

`[TARGET]` 무브에 대한 추가 제약: **CM2 `warden-reveal`의 yaw 120° 등속 회전 중 보스
실루엣 화면 크기가 최대 2배 변한다** (yaw가 x축 정면 → z축 정면으로 갈 때). 대응:
`warden-reveal`의 시작 yaw는 **z축 정면(남북)에서 출발**해 x축으로 회전한다 — 큰 것에서
작은 것으로 가는 방향이 인상에 유리하고, 마지막 프레임이 기본 카메라 프레이밍에 가깝다.

---

## 3. VFX 언어 — 어떤 효과가 어떤 상태를 말하는가

### 3.1 `[OBSERVED]` 실존 스테이지 VFX 3종 — 구역과 1:1

`assets/motion/stage-vfx/` 실측: GLB 3개 + provenance 3개 + `manifest.json` + `qa/`.

| 구역 | `effectId` | 길이 | 프레임 | 실루엣 (manifest 원문) | 팔레트 core / accent | 근거 |
|---|---|---|---|---|---|---|
| `cinder-span` | `cinder-span-ember-wake` | 4.0 s | 1–96 @24fps | `"Lantern core, seal ring, cross-wind ember wake."` | `#FFBB66` / `#F23A20` | `assets/motion/stage-vfx/manifest.json:10-28` |
| `abyss-chancel` | `abyss-chancel-mirror-static` | 5.0 s | 1–120 @24fps | `"Rift lens, twin scan rings, offset mirror shards."` | `#74E4FF` / `#008BC2` | `assets/motion/stage-vfx/manifest.json:54-72` |
| `echo-throne` | `echo-throne-fracture-echo` | 6.0 s | 1–144 @24fps | `"Caged lantern core, three echo rings, crown-like fractures."` | `#C7A6FF` / `#6B36C9` | `assets/motion/stage-vfx/manifest.json:98-116` |

**`[OBSERVED]` 세 효과 모두 `spawnCap: 1`이고 `meaning`이 `cosmetic`/`non-authoritative`로
명시된다** (`assets/motion/stage-vfx/manifest.json:18`, `:62`, `:106`). 즉 **이 세 효과는 게임 상태를 말하지
않는다.** 앰비언트 랜드마크다.

`[TARGET]` **따라서 이 3종에 상태 정보를 얹지 않는다.** 이들이 나르는 것은 §5의
**분위기**뿐이다. 상태를 앰비언트에 얹으면 `spawnCap: 1` 때문에 동시 상태를 표현할 수
없고, `cosmetic` 선언과도 모순된다.

`[OBSERVED]` 품질 정책도 확인: `qualityPolicy` `high [core, detail, decor]` /
`balanced [core, detail]` / `low [core]` (`assets/motion/stage-vfx/manifest.json:123-136`). **`low`에서 `core`만
남으므로**, `core`에 담긴 것(등불 코어 / 렌즈)이 최저 품질에서도 유일하게 살아남는다.
`[INFERENCE]` 이것이 §5 분위기를 `core` 실루엣에 걸어도 안전한 이유다.

### 3.2 상태 → 효과 사상 (전투 VFX)

전투 VFX 사양은 `camera-vfx-direction.md:378-427`이 소유한다. 이 문서는 **플레이어가
각 효과에서 무엇을 읽어야 하는가**만 정의한다 — 그것이 "텍스트 없이 의미 전달"의 실체다.

| 효과 (권위 소유) | 상태 | 플레이어가 읽는 문장 (화면에 쓰이지 않음) | 근거 |
|---|---|---|---|
| `tele-radial` | `radial-burst` 예고 | "보스에게서 멀어져라" | `camera-vfx-direction.md:382`; 의도 `boss-pattern-spec.md:180` |
| `tele-line` | `line-sweep` 예고 | "측면으로 대시" | `:383`; `boss-pattern-spec.md:181` |
| `tele-cluster` | `ground-cluster` 예고 | "간극을 찾아 걸어라 — 대시 무적 무효" | `:384`; `boss-pattern-spec.md:183` |
| `tele-charge` | `charge-rush` 예고 | "수직으로 피해라 — 뒤로 도망치면 잡힌다" | `:385`; `boss-pattern-spec.md:185` |
| `tele-arena` | `arena-close` 예고 | "딜을 포기하고 안전지대로" | `:386`; `boss-pattern-spec.md:187` |
| `tele-mob` | 잡몹 windup | "이 방향에서 곧 온다" | `:387` |
| `hit-light` | `LIGHT_1/2` 접촉 | "닿았다" | `:396` |
| `hit-finisher` | `LIGHT_3` 접촉 | "군중이 쓸렸다" | `:397` |
| `hit-heavy` | `HEAVY` 접촉 | "무겁게 들어갔다" | `:398` |
| `hit-taken` | 지휘관 피격 | "내가 맞았다" | `:399` |
| `hit-blocked` | `DASH` 무적 무효화 | **"회피가 통했다"** | `:400-403` |
| `status-stagger` | 적 경직 | "지금 때려라" | `:421` |
| `wave-incoming` | 웨이브 3 s 전 | "저 방향에서 온다" | `:423` |
| `death-elite` | 정예 처치 | "값진 것을 죽였다" | `:425` |
| `extract-ready` | 추출 가능 | "가져갈 수 있다" | `:426` |
| `phase-transition` | 보스 페이즈 전환 | "규칙이 늘었다" | `:427` |

**`hit-blocked`가 가장 중요하다.** `camera-vfx-direction.md:402-403`:
`회피 성공을 즉시 알리는 유일한 신호다. 이것이 없으면 플레이어는 무적이 작동했는지 모른다.`
`[TARGET]` 어떤 품질 티어에서도, 어떤 텍스트 예산 압박에서도 삭제하지 않는다
(`camera-vfx-direction.md:491`).

### 3.3 `[OBSERVED]` 구역 팔레트가 교차되어 있다 — VFX manifest가 단독 이상치

내가 발견한 불일치다. `STAGE_PALETTE_TINTS`(`battle-realtime-three.js:479-483`)와
스테이지 VFX `palette.core`(`assets/motion/stage-vfx/manifest.json`)의 색상(hue)을
비교했다:

| 구역 | 런타임 tint | tint hue | VFX `core` | core hue | **자기 구역 내 hue 차** |
|---|---|---|---|---|---|
| `cinder-span` | `#F3592C` | 14° | `#FFBB66` | 33° | **19°** — 정합 |
| `abyss-chancel` | `#8F67FF` (보라) | 256° | `#74E4FF` (청록) | 192° | **64°** — 불일치 |
| `echo-throne` | `#72C8FF` (하늘) | 203° | `#C7A6FF` (연보라) | 262° | **59°** — 불일치 |

**교차 검산:**

| 비교 | hue 차 |
|---|---|
| `abyss-chancel` VFX core (192°) ↔ `echo-throne` tint (203°) | **11°** |
| `echo-throne` VFX core (262°) ↔ `abyss-chancel` tint (256°) | **6°** |

`[INFERENCE]` 자기 구역 내 차이가 64°/59°인데 **교차 차이가 11°/6°**다. 두 시스템에서
구역 2와 구역 3의 색이 **서로 뒤바뀐 것으로 보인다.** 우연히 이 정도로 정확히 교차하기는
어렵다.

**`[OBSERVED]` 세 번째 출처가 tint 쪽을 지지한다.**
`stage-world-catalog.js`의 `presentation.palette.accent`는 `STAGE_PALETTE_TINTS`와
**3/3 바이트 동일**하다:

| 구역 | `accent` (`stage-world-catalog.js`) | `STAGE_PALETTE_TINTS` (`battle-realtime-three.js`) | 동일? |
|---|---|---|---|
| `cinder-span` | `#f3592c` (`:111`) | `0xf3592c` (`:480`) | **예** |
| `abyss-chancel` | `#8f67ff` (`:148`) | `0x8f67ff` (`:481`) | **예** |
| `echo-throne` | `#72c8ff` (`:185`) | `0x72c8ff` (`:482`) | **예** |

`[INFERENCE]` 독립된 두 출처(카탈로그 `accent` + 렌더러 `STAGE_PALETTE_TINTS`)가 일치하고
**스테이지 VFX manifest만 어긋난다.** 따라서 정정 대상은 tint 쪽이 아니라 VFX manifest
쪽일 가능성이 높다.

`[OBSERVED]` 그럼에도 이것이 결함으로 확정되었다고 이 문서는 주장하지 않는다. 판정에는
(a) VFX 저작 시점의 의도, (b) 세 GLB의 실제 정점 색/머티리얼 확인이 필요하다.
**소스·자산 수정은 내 레인 밖이다** — 기록하고 라우팅한다(§9 R7).

`[TARGET]` §5의 구역 분위기는 **두 시스템 중 어느 쪽이 정본이 되어도 성립하도록**
쓴다: 구역 2는 "반사/렌즈", 구역 3은 "메아리/균열"로 **형태**에 걸고 색에 걸지 않는다.
형태는 두 시스템이 일치한다 (`mirror shards` ↔ `oath rings`, `echo rings` ↔ `court steps`).

---

## 4. 스킬·아이템 피드백 — 화면이 무엇을 하는가

### 4.1 `[OBSERVED]` 라이브 임팩트 피드백 실측

`battle-realtime-three.js:391-409`. **ms 단위이며 tick이 아니다.**

| 항목 | 일반 | heavy | 라인 |
|---|---|---|---|
| 플래시 색 | `#5DE6FF` | `#A06BFF` | `:391-392` |
| 플래시 길이 | 180 ms (10.8 tick) | 320 ms (19.2 tick) | `:393-394` |
| 플래시 피크 | 0.55 | 1.1 | `:395-396` |
| 넉백 길이 | 160 ms (9.6 tick) | 260 ms (15.6 tick) | `:400-401` |
| 넉백 거리 | 0.12 월드 | 0.26 월드 | `:402-403` |
| 흔들림 | **없음** | 220 ms (13.2 tick) | `:406`, `:3034` |
| 흔들림 진폭 | — | 0.07 / 보스 대상 0.13 | `:407-408` |
| 흔들림 주기 | — | `FREQUENCY 38` | `:409` |

`[OBSERVED]` `:3034` `if (!heavy) return;` — **일반 타격은 카메라를 흔들지 않는다.**
`[OBSERVED]` `:3039` 진폭 선택은 **대상**이 보스인지로 갈린다
(`targetRecord.kind === "boss"`), 공격자가 아니다.

`[OBSERVED]` `:3114` 감쇠는 `(1 − progress)²`이며 `camera-vfx-direction.md:366`이 명세한
`SHAKE_DECAY^t` 지수 감쇠가 **아니다.**

### 4.2 §0.3 M4 — 흔들림 진폭 검산

내가 계산한 화면 영향 (FOV 42, 반뷰 높이 = `d × tan(21°)`):

| 진폭 출처 | 값 | 평면 폭(28) 대비 | 반뷰 대비 @20.8 | 반뷰 대비 @41.5 |
|---|---|---|---|---|
| 라이브 일반 (`:407`) | 0.07 | 0.25% | 0.9% | 0.4% |
| 라이브 보스 (`:408`) | 0.13 | 0.46% | 1.6% | 0.8% |
| 문서 `일반 접촉` (`camera-vfx-direction.md:340`) | 0.6 | 2.14% | 7.5% | 3.8% |
| 문서 `보스 패턴 착탄` (`:344`) | 3.0 | 10.71% | 37.6% | 18.8% |
| 문서 `페이즈 전환` (`:345`) | 4.0 | 14.29% | **50.1%** | 25.1% |

**`[INFERENCE]` 문서의 `페이즈 전환` 4.0을 그대로 구현하면 카메라가 반뷰 높이의 절반을
흔든다.** 이것은 예고 데칼 판독을 파괴하며, 같은 문서가
`:360-361`에서 금지한 것(`흔들림이 누적되어 예고 데칼이 읽히지 않는다... 공정성 문제`)을
스스로 유발한다.

`[TARGET]` **이 문서는 흔들림을 라이브 스케일로 쓴다.** 라이브 `0.07`/`0.13`을 기준으로
비례 배분:

| 이벤트 | 진폭 `[TARGET]` | 라이브 기준 배수 | 근거 |
|---|---|---|---|
| 일반 접촉 (`LIGHT_1/2`) | **0** | — | `[OBSERVED]` `:3034` 현행 동작 유지 |
| `LIGHT_3` 피니셔 | 0.07 | ×1.0 | 라이브 `IMPACT_SHAKE_AMPLITUDE` |
| `HEAVY` 접촉 | 0.10 | ×1.43 | 최고 배율 동사 |
| 정예 처치 | 0.10 | ×1.43 | `death-elite`와 동기 |
| 보스 패턴 착탄 | 0.13 | ×1.86 | 라이브 `IMPACT_SHAKE_BOSS_AMPLITUDE` |
| 페이즈 전환 | 0.18 | ×2.57 | 최대. 반뷰 대비 2.3% @20.8 |
| **누적 상한** | **0.36** | ×5.14 | §4.3 |

**최댓값 0.18은 반뷰의 2.3%(@20.8) / 1.1%(@41.5)다.** 문서의 4.0(50.1%)과 달리 예고
데칼을 가리지 않는다.

### 4.3 누적 상한 검산

`camera-vfx-direction.md:350`의 구조(`SHAKE_ACCUM_CAP`)를 계승하되 값을 라이브 스케일로
재산정한다.

`[OBSERVED]` `BIGWAVE` 처치율 4.2/s (`camera-vfx-direction.md:357`).
`[TARGET]` 일반 접촉 진폭 0이므로 처치 자체는 흔들림을 만들지 않는다. 흔들림원은
피니셔·`HEAVY`·정예 처치·보스 패턴·페이즈 전환뿐이다.

```
최악 시나리오 (BIGWAVE + FINALE P3 동시 패턴):
  피니셔 0.07 × 초당 1회        = 0.07
  HEAVY   0.10 × 초당 1회        = 0.10
  정예 처치 0.10 × 초당 0.5회    = 0.05
  보스 패턴 착탄 0.13 × 초당 0.5회 = 0.065
                            합계 = 0.285  < 상한 0.36  (여유 0.075)
```

`[TARGET]` `SHAKE_ACCUM_CAP = 0.36` (= 최대 단일 진폭 0.18 × 2). 초과분은 진폭만 깎고
VFX·사운드는 정상 재생한다 (`camera-vfx-direction.md:355-356` 계승).

`[TARGET]` 감쇠는 라이브 `(1 − progress)²`(`:3114`)를 유지한다. 지수 감쇠로 바꾸라고
요구하지 않는다 — `(1−p)²`는 이미 프레임률 독립이다(`progress`가 ms 기반, `:3109`).

### 4.4 스킬 발동 — 화면 상태로서

`[OBSERVED]` 라이브 처리: `SKILL_CAST` → `triggerAttackDelivery(commander, null, nowMs,
true)` (`:3164-3166`); `SKILL_RESOLVED_DAMAGE` → 배달 + 대상에 `bighit`/`hit`
(`:3167-3170`).

`[OBSERVED]` 카테고리별 시각 언어는 `camera-vfx-direction.md:407-412`가 소유:
`melee-amp` 백금 무기 광휘 / `aoe-burst` 심연 보라 지면 형상 / `mobility` 청록 잔상 /
`sustain` 호박 껍질.

`[TARGET]` 이 문서가 더하는 것은 **시간 배분**이다. 스킬 1회 발동이 화면에서 나르는 3단계:

| 단계 | 길이 `[TARGET]` | 화면 상태 | 왜 이 길이인가 |
|---|---|---|---|
| **예고** (`SKILL_CAST` → 판정) | 12 tick (200 ms) | 카테고리 색이 **지휘관에서** 발생. 프레이밍 변화 0 | 반응 예산 12 tick과 동일 (`boss-pattern-spec.md:132`) — 적이 반응할 기회를 스킬에도 준다 |
| **발현** (판정 순간) | 8 tick (133 ms) | 카테고리 형상 최대 크기. `aoe-burst`만 지면에서 솟음 | `LIGHT_1` active 3 tick보다 길고 `LIGHT_3` active 5 tick보다 길다 — 스킬이 동사보다 크게 읽혀야 한다 |
| **잔향** | 24 tick (400 ms) | 알파 감쇠. 판정 없음 | `LIGHT_3` 잔광 12 tick(`action-combat-spec.md:77`)의 2배 |

**`[TARGET]` 스킬 이름을 화면에 쓰지 않는다.**
`[OBSERVED]` 근거: `ui/hud-information-architecture.md:219`
`스킬 이름 라벨 | 아이콘 + 카테고리 색으로 충분. 글자 수 예산 초과`. 이미 결정된 사항이며
이 문서는 그것을 **강화**한다 — 카테고리 색 + 형상 + 발생 위치(무기 / 지면 / 지휘관 주변)
3중 채널로 어느 카테고리인지 읽힌다.

`[TARGET]` 히트스톱: 스킬 발현에 `LIGHT_3`와 같은 5 tick을 준다
(`action-combat-spec.md:77`). `HEAVY`의 6 tick을 넘기지 않는다 — 최고 배율 동사보다 스킬이
더 무겁게 느껴지면 동사가 무의미해진다. `HITSTOP_ACCUM_CAP = 20 tick`
(`action-combat-spec.md:314`)이 상한이다.

### 4.5 아이템 획득 — 화면 상태로서

`[OBSERVED]` 라이브 픽업 렌더: `OctahedronGeometry(0.14, 0)`, `COLORS.pickup = 0xFFAA00`,
emissive `0.8` (생성 시) / `1.2` (전용 머티리얼), `depthWrite: false`
(`:2482-2496`, `:469-470`, `:1686-1699`).

`[OBSERVED]` 색 위계에서 `보상/획득`은 금 `#FFD60A`이고 **비색 채널은 "위로 떠오르는
궤적"** (`camera-vfx-direction.md:443`). 라이브 `0xFFAA00`은 그보다 주황에 가깝다
(hue 40° vs 51°) — `[INFERENCE]` 실질 구분은 가능하나 팔레트 정본과 정확히 같지 않다.

`[TARGET]` 획득 순간 화면이 하는 것:

| 채널 | 값 | 근거 |
|---|---|---|
| 프레이밍 | **변화 0** | 획득은 위험이 아니다. 카메라를 움직이면 위험 신호와 혼동된다 |
| 궤적 | 픽업 → 지휘관, 8 tick (133 ms), ease-in | 방향이 "누가 가졌는가"를 말한다 |
| 스케일 | 획득 순간 ×1.6 → 0, 8 tick | 소멸이 아니라 흡수로 읽히게 |
| 플래시 | 지휘관 실루엣 외곽선 금색 6 tick (100 ms) | `[OBSERVED]` 외곽선은 이미 안개 면제 대상 (`camera-vfx-direction.md:222`) |
| 히트스톱 | **0** | 획득은 타격이 아니다 |
| 흔들림 | **0** | §4.2 |
| 텍스트 | **0자** | §6 |

**`[TARGET]` 색맹 대응:** 위험 적(`#FF3B30`)과 보상 금이 적록 색맹에서 혼동될 수 있다
(`camera-vfx-direction.md:449-450`). 라이브 픽업은 이미 **공중 부유**하고 위험은 **지면
데칼**이므로 위치로 구분된다. `[TARGET]` 획득 궤적이 **위로 향하는 구간을 포함**해야
한다 — 지면으로 흡수되면 위치 구분이 깨진다.

### 4.6 저체력 — 등불이 짧아진다

`[OBSERVED]` CM7 `ember-fade`는 `camera-vfx-direction.md:303`의 저체력 비네트를 계승한다
(HP <25%, 가장자리 60% 알파, 중앙 70% 보존).

`[TARGET]` 이 문서가 더하는 것: **비네트 색이 구역 VFX `core` 색을 따른다.**

| 구역 | 비네트 색 근거 | 값 |
|---|---|---|
| `cinder-span` | `assets/motion/stage-vfx/manifest.json:14` `core` | `#FFBB66` |
| `abyss-chancel` | `assets/motion/stage-vfx/manifest.json:58` `core` | `#74E4FF` |
| `echo-throne` | `assets/motion/stage-vfx/manifest.json:102` `core` | `#C7A6FF` |

`[INFERENCE]` 위험 적(`#FF3B30`)을 쓰지 않는 이유: 저체력은 **지속 상태**이고 위험 적은
**즉시 위협**이다. 같은 색이면 지속 상태가 즉시 위협 신호를 상시 점등한 것처럼 읽혀
`hit-taken`(`camera-vfx-direction.md:399`, 가장자리 적색 플래시)과 구분되지 않는다.

`[TARGET]` §3.3의 팔레트 교차가 해소되면 이 표의 색도 함께 정정한다. **형태(가장자리
비네트)는 색 결정과 무관하게 유효하다.**

---

## 5. 구역 분위기 — 팔레트 · 안개 · 광원 · 실루엣

### 5.1 조명 기준 `[OBSERVED]`

| 광원 | 값 | 라인 |
|---|---|---|
| Ambient | `COLORS.ambient` 강도 1.1 | `:1635` |
| Key (directional) | `COLORS.key` 강도 1.6, 위치 `(6, 10, 4)` | `:1636-1637` |
| Rim (directional) | `COLORS.rim` 강도 0.6 | `:1642` |
| Rim 배치 | **카메라 반대편 azimuth**, 거리 20, 피치 35° | `:2698-2705`, `:115-116` |

`[OBSERVED]` `:2698` `const rimYaw = cameraYaw + Math.PI;` — 림 라이트가 매 프레임 카메라
반대편으로 재배치된다. **따라서 실루엣 역광은 카메라 각도와 무관하게 항상 성립한다.**

`[TARGET]` 이것이 §5.4 실루엣 판독의 기반이다. 구역별로 **key 방향을 바꾸지 않는다** —
바꾸면 카메라 상대 rim과의 관계가 구역마다 달라져 실루엣 일관성이 깨진다. 구역 차이는
**색과 안개**로만 만든다.

### 5.2 구역별 분위기 표

| 항목 | Cinder Span | Abyss Chancel | Echo Throne |
|---|---|---|---|
| 런타임 tint `[OBSERVED]` | `#F3592C` (`:480`) | `#8F67FF` (`:481`) | `#72C8FF` (`:482`) |
| VFX core / accent `[OBSERVED]` | `#FFBB66` / `#F23A20` (`assets/motion/stage-vfx/manifest.json:14-15`) | `#74E4FF` / `#008BC2` (`:58-59`) | `#C7A6FF` / `#6B36C9` (`:102-103`) |
| VFX shadow `[OBSERVED]` | `#301018` (`:16`) | `#061A2C` (`:60`) | `#150925` (`:104`) |
| 안개 near / far `[OBSERVED]` | 22.4 / 50.4 (`:489`) | 21.0 / 46.2 (`:490`) | 19.6 / 42.0 (`:491`) |
| **상대 개방감** | 가장 열림 | 중간 | **가장 닫힘** |
| 저작 분위기 `[OBSERVED]` | `"잿빛 바람이 교량의 봉쇄선을 훑는다."` (`defense-catalog.js:580`) | `"심연 예배소의 서약이 시야를 봉인한다."` (`:587`) | `"달 없는 궁정의 메아리가 왕좌 회랑을 울린다."` (`:594`) |
| 저작 모티프 `[OBSERVED]` | `"불씨와 재의 흐름"` (`:580`) | `"서약 고리와 보랏빛 정전"` (`:587`) | `"메아리와 단상의 균열"` (`:594`) |
| 지형 패턴 `[OBSERVED]` | `재의 띠` (`:578`) | `서약 고리` (`:585`) | `왕좌의 계단` (`:592`) |
| 랜드마크 `[OBSERVED]` | `불씨 중계탑`, `잠긴 용광로 아치` (`:579`) | `예배소 후진`, `예배소 본당` (`:586`) | `왕좌 단상`, `왕좌 회랑` (`:593`) |
| **형태 언어 `[TARGET]`** | **흐름** — 가로 방향 이동하는 재 | **반사** — 대칭·중복된 실루엣 | **반복** — 같은 형태의 감쇠 에코 |
| **서사 반전과의 대응** | 퇴로 상실 | 정체성 | 목적 | 

`[TARGET]` **형태 언어가 세 구역을 구분하는 1차 채널이다. 색은 2차다.** 이유는 §3.3의
팔레트 교차가 미해결이기 때문이며, 형태는 두 시스템(tint / VFX manifest)이 일치한다.

### 5.3 안개 — 두 출처가 어긋나고, 하나는 소비되지 않는다

**`[OBSERVED]` 저장소에 스테이지 안개 값이 두 곳에 있고 2/3 구역에서 불일치한다.**

| 구역 | A: `stageFogRange()` near/far | B: `atmosphere.fogNear/fogFar` | 일치? |
|---|---|---|---|
| `cinder-span` | 22.4 / 50.4 (`battle-realtime-three.js:489`) | 22.4 / 50.4 (`stage-world-catalog.js:112`) | **일치** |
| `abyss-chancel` | 21.0 / 46.2 (`battle-realtime-three.js:490`) | 24 / 54 (`stage-world-catalog.js:149`) | **불일치** |
| `echo-throne` | 19.6 / 42.0 (`battle-realtime-three.js:491`) | 23 / 55 (`stage-world-catalog.js:186`) | **불일치** |

**`[OBSERVED]` A가 정본이고 B는 소비되지 않는다.** 근거:

- 렌더러가 적용하는 것은 A뿐이다 — `battle-realtime-three.js:1830-1832`가
  `stageFogRange(stageId)`의 반환값을 `scene.fog.near/far`에 쓴다.
- `fogNear`/`fogFar` 식별자를 저장소에서 검색한 결과, 소비 지점은
  `tests/stage-runtime-proof-browser.test.mjs:153-154`와 `:296-297`뿐이며 **그 테스트도
  `stageFogRange()`를 오라클로 쓴다.** `atmosphere.fogNear`를 읽는 코드는 **0건**이다.
- `stage-world-catalog.js`의 `atmosphere` 객체에서 실제로 소비되는 필드는 `motif`
  (`battle-visualizer.js:336`)와 `descriptor`(`app.js:1044`)다. 안개 두 필드는 **죽은
  데이터**다.

**`[OBSERVED]` 두 출처는 방향이 반대다.** A에서 `echo-throne`의 `far` 42.0은 **가장
짧고**(가장 닫힘), B에서 55는 **가장 길다**(가장 열림).

`[OBSERVED]` 정본 A의 순서: `fogNear` 22.4 → 21.0 → 19.6 (**감소**),
`fogFar` 50.4 → 46.2 → 42.0 (**감소**).

`[INFERENCE]` 정본 A에서는 구역이 진행될수록 근경과 원경이 **동시에 좁아진다.**
`abyssal-lantern-synopsis.md#2`의 하강 구조와 방향이 일치한다 — 내려갈수록 보이는 범위가
줄어든다. 서사가 요구한 것이 아니라 이미 저작된 값이 그렇게 되어 있다.

**`[INFERENCE]` 만약 B가 저작 의도였다면 이 독법은 뒤집힌다.** 따라서 §5의 분위기는
**안개 방향에 서사를 걸지 않는다** — 안개는 판독성 제약(§2.3)으로만 쓰고, 구역 구분은
§5.2의 형태 언어가 담당한다. 어느 출처가 정본으로 확정되어도 §5가 무너지지 않는다.

`[TARGET]` 이 문서는 안개 값을 **바꾸지 않는다.** `fogNear`는 정본 A의 저작값 그대로 두고
(`camera-vfx-direction.md:274` 계승), `fogFar`만 공정성 하한에 걸릴 때 완화한다 —
그 하한 구현은 §2.3 S1–S4가 우회한다. **B의 처분(정정 또는 삭제)은 내 레인 밖이다**
(§9 R11).

### 5.4 실루엣 판독 규칙

| 규칙 | 값 | 근거 |
|---|---|---|
| 액터 높이 위계 유지 | boss 4.5 > commander 2.9 > elite 2.2 > enemy 1.7 > companion 1.3 | `[OBSERVED]` `:58-65` |
| 외곽선 안개 면제 | 적 본체는 안개 받음, **외곽선 1 px 면제** | `camera-vfx-direction.md:222` |
| 지휘관 실루엣 안개 면제 | 유지 | `camera-vfx-direction.md:224` |
| 지휘관 반경 1500 내 가산 이펙트 | **금지** | `camera-vfx-direction.md:459` |
| 오클루전 | 장식 페이드 40%, 전역 투명화 금지 | `camera-vfx-direction.md:77` |
| 역광 | 카메라 반대편 rim 자동 | `[OBSERVED]` `:2698-2705` |

`[TARGET]` 구역별 추가 제약: **`echo-throne`에서 원경 실루엣에 의존하지 않는다** (§2.3
S4). 안개 far 42.0이 가장 짧으므로 원경 랜드마크가 가장 먼저 묻힌다. 구역 3의 공간감은
**근경 반복 형태**(계단·에코 링)로 만든다.

---

## 6. 텍스트 예산 — 비트당 최대 온스크린 단어 수

### 6.1 상속하는 상한 `[OBSERVED]`

이 문서는 HUD 예산을 **재정의하지 않는다.** `ui/hud-information-architecture.md`가 소유한다.

| 상한 | 값 | 라인 |
|---|---|---|
| `BIGWAVE` 중 화면 텍스트 **글자 수** | **12** | `:205` |
| 동시 HUD 요소 | 9 | `:204` |
| HUD 점유 면적 | ≤18% | `:206` |
| 동시 애니메이션 HUD 요소 | 3 | `:207` |
| HUD 색상 수 | 5 | `:208` |
| 폰트 크기 종류 | 3 | `:209` |
| 검사 `hud-text-budget` | `BIGWAVE` 캡처 시 글자 수 ≤12 | `:273` |

`[OBSERVED]` `:205`의 12자 내역: `쿨다운 숫자 4×2 + 페이즈명 4`.
**즉 12자는 이미 전부 배정되어 있고 서사·연출용 여유는 0자다.**

UI 레인 확인 `[OBSERVED]`: 신규 상시 커맨드 덱은 런 시작 전에만 렌더되고
`data-defense-started`가 true로 바뀌는 즉시 언마운트되므로, 전투 중 위 3개 수치는
변경되지 않는다 (UiDockOverhaul 회신, 2026-07-29).

### 6.2 비트별 예산 `[TARGET]`

**단위 주의: 상위 권위는 "글자 수"를 쓴다. 이 표도 글자 수로 쓴다.** 단어 수로 바꾸면
상위 계약과 대조할 수 없다.

| 비트 | 최대 온스크린 글자 수 | 그 글자가 무엇인가 | 텍스트를 대신하는 것 |
|---|---|---|---|
| 스테이지 진입 (CM1) | **0** | — | CM1 카메라 무브 + 구역 VFX `core` 실루엣 + 안개 근경 |
| `DESCENT` | 8 | 쿨다운 숫자만 | 데칼 없음 = 안전. 조작 학습은 반응으로 |
| `SKIRMISH` | 12 | 쿨다운 8 + 페이즈명 4 | `tele-mob` 발밑 호가 방향을 말한다 |
| `SURGE` | 12 | 동일 | 밀도 자체가 광역 필요를 말한다 |
| 웨이브 예고 | +0 | `wave-incoming`은 **화살 + 카운트다운 링**, 글자 아님 | `camera-vfx-direction.md:423` 비색 채널 |
| 보스 등장 (CM2) | **0** | — | CM2 오빗이 실루엣·아레나를 각인. 보스 이름 표시 금지 |
| `MIDBOSS` | 12 | 쿨다운 8 + 페이즈명 4 | 예고 데칼 5종이 위험을 말한다 |
| 페이즈 전환 (CM3) | **0** | — | CM3 푸시인 + `phase-transition` 백색 확산 + 보스 HP 바 단계 표시 |
| `BIGWAVE` | **12 (하드 상한)** | `ui#:205` 내역 그대로 | `swarm-widen` 프레이밍 + 밀도 |
| `FINALE` | 12 | 동일 | 동일 |
| 스킬 발동 | +0 | 이름 금지 (`ui#:219`) | 카테고리 색 + 형상 + 발생 위치 3채널 (§4.4) |
| 아이템 획득 | +0 | 숫자 금지 | 궤적 방향 + 스케일 + 외곽선 플래시 (§4.5) |
| 저체력 (CM7) | +0 | — | 비네트 + 발밑 링 (`master-gdd-delta.md:198`) |
| 회피 성공 | +0 | — | `hit-blocked` 청색 굴절 링 |
| 스테이지 클리어 (CM8) | **0** | — | CM8 무브. 결과 텍스트는 **결과 화면**으로 이관 |
| 결과 화면 | 예산 없음 | 전투 중이 아니다 | — |
| 로비 `기록` 탭 | 예산 없음 | 전투 중이 아니다 | `lobby-story-presentation-spec.md#3` |

**`[TARGET]` 규칙 T1: 전투 중 서사 텍스트는 0자다.** 예산 12자가 이미 쿨다운·페이즈명에
전부 배정되어 있으므로 (`ui#:205`) 서사에 줄 자리가 물리적으로 없다.

**`[TARGET]` 규칙 T2: 데미지 숫자는 기본 OFF를 유지한다.**
`[OBSERVED]` 근거 `ui/hud-information-architecture.md:220`:
`선택 설정, 기본 OFF. BIGWAVE에서 초당 4.2 처치 × 숫자는 화면을 덮는다`.

**`[TARGET]` 규칙 T3: 접근성 텍스트는 예산에서 제외한다.** 스크린 리더 낭독, 자막,
텍스트 폴백은 **온스크린 시각 텍스트가 아니다.**
`[OBSERVED]` 근거 `lobby-story-presentation-spec.md:59-69`. 예산으로 접근성을 깎으면
`CLAUDE.md`가 요구하는 접근성 계약을 위반한다.

### 6.3 무엇이 글자를 대신하는가 — 채널 인벤토리

`[TARGET]` 전투 중 사용 가능한 비텍스트 채널 8종. 각 채널은 **동시에 한 종류의 의미만**
나른다.

| # | 채널 | 나르는 의미 | 실존 근거 |
|---|---|---|---|
| 1 | 지면 데칼 (월드 공간) | 위험 영역·안전지대 | `boss-pattern-spec.md:129`; 안개 면제 `camera-vfx-direction.md:220` |
| 2 | 카메라 거리 | 페이즈 압박 단계 | `[OBSERVED]` `:2666-2670` clamp 적용 지점 |
| 3 | 카메라 yaw | 보스 각인 (CM2 전용) | `[OBSERVED]` `:2671` |
| 4 | 실루엣 외곽선 | 위치 (안개 무관) | `camera-vfx-direction.md:222` |
| 5 | 발밑 링 | 지휘관 내구·대시 충전 | `master-gdd-delta.md:198` |
| 6 | 색 + 형태 조합 | 카테고리 (9종 위계) | `camera-vfx-direction.md:435-445` |
| 7 | 궤적 방향 | 획득 / 손실 / 출처 | `camera-vfx-direction.md:443` 비색 채널 |
| 8 | 히트스톱 + 흔들림 | 타격 무게 | `[OBSERVED]` `:3105-3119`; `action-combat-spec.md:76-78` |

**`[TARGET]` 채널 충돌 금지:** 한 프레임에서 같은 채널이 두 의미를 나르면 텍스트를 없앤
대가로 모호함을 얻는다. 예: 채널 2(카메라 거리)를 페이즈 압박과 저체력에 동시에 쓰면
플레이어가 어느 것이 변했는지 모른다 — 그래서 CM7 `ember-fade`는 **카메라를 움직이지
않고** 비네트만 쓴다 (§4.6).

---

## 7. 몰입 유지 — 중반 평탄화를 막는다

### 7.1 런 길이 기준 `[OBSERVED]`

| 항목 | 값 | 근거 |
|---|---|---|
| 기준 총 길이 | 21600 tick (360 s) | `design/master-numeric-contract.md:17` |
| 허용 밴드 | 18000–28800 tick (300–480 s) | `:18` |
| 하드 실링 | 32400 tick (540 s) | `:19` |
| 시간 상한 페이즈 합계 | 14400 tick (고정) | `:54` |
| 가변분 | `MIDBOSS` + `FINALE`만 | `design/master-gdd-delta.md:113` |

`[OBSERVED]` 제품 가설 중 미검증 항목: `5–8분 흐름이 몰입을 유지한다 | ... | [TARGET]`
(`design/onslaught-action-product-contract.md:161`). **이 절은 그 가설을 통과시키지 않는다.
설계 장치만 제안한다.**

### 7.2 평탄 구간 특정

`[OBSERVED]` 페이즈 예산 (`master-numeric-contract.md:23-30` + `master-gdd-delta.md:98-103`):

| 페이즈 | tick | 초 | 누적 초 | 동시 적 상한 |
|---|---|---|---|---|
| `DESCENT` | 1800 | 30 | 30 | — |
| `SKIRMISH` | 4500 | 75 | 105 | — |
| `SURGE` | 4500 | 75 | 180 | 34 |
| `MIDBOSS` | 3600 | 60 | 240 | 12 + 1 |
| `BIGWAVE` | 3600 | 60 | 300 | 60 |
| `FINALE` | 3600 | 60 | 360 | 8 + 1 |

`[INFERENCE]` **위험 구간은 `SKIRMISH` + `SURGE` = 150초(총 360초의 41.7%)다.** 근거:

1. 두 페이즈가 **연속으로 각 75초**이며 전체에서 가장 긴 단일 블록이다.
2. 둘 다 **시간 상한 종료**(`master-numeric-contract.md:27`)이므로 플레이어의 실력이
   길이를 줄이지 못한다. 잘해도 75초를 채워야 한다.
3. 카메라 티어 차이가 26.0 → 33.0으로 **1.27배**뿐이다
   (`camera-vfx-direction.md:153-154`). `DESCENT`→`BIGWAVE` 전체 2.0배 중 작은 몫이다.
4. 보스가 없으므로 CM2/CM3 같은 큰 무브가 발동하지 않는다.

### 7.3 대응 — 이미지 채널만으로

`[TARGET]` 텍스트나 신규 시스템을 추가하지 않고, 이미 있는 채널(§6.3)의 **변화율**로
150초를 분절한다.

| 시점 (누적 초) | 페이즈 | 변화 | 어느 채널 | 신규 자산 필요 |
|---|---|---|---|---|
| 30 | `SKIRMISH` 진입 | 티어 20.8 → 26.0, 90 tick 보간 | 2 (거리) | 없음 |
| 60 | `SKIRMISH` 중반 | `wave-incoming` 스폰 **방향이 바뀐다** — 첫 방향과 다른 옥탄트 | 7 (궤적) | 없음 |
| 75 | 성장 선택 1 | 화면 정지 없이 선택 UI. 전투 캔버스 유지 | — | 없음 |
| 105 | `SURGE` 진입 | 티어 26.0 → 33.0, 90 tick 보간 | 2 (거리) | 없음 |
| 130 | `SURGE` 중반 | 밀도가 광역 임계를 넘김 — `LIGHT_3` 접촉 ≥4체가 CM6 `finisher-hold`를 처음 발동 | 3+8 (yaw+히트스톱) | 없음 |
| 150 | 성장 선택 2 | 동일 | — | 없음 |
| 180 | `MIDBOSS` 진입 | 티어 33.0 → 38.0 + **CM2 `warden-reveal`** | 2+3 | 없음 |

**`[INFERENCE]` 핵심 장치는 130초의 CM6 첫 발동이다.** `SURGE`의 설계 목적이
`광역기 필요성 체감`(`master-numeric-contract.md:27`)인데, 광역이 **성공했을 때 화면이
달라진다는 것**을 그 순간 처음 가르치면 페이즈 목적과 연출이 같은 것을 말한다.

`[OBSERVED]` CM6의 트리거 조건은 `LIGHT_3` 접촉 ≥4체
(`camera-vfx-direction.md:299`)이고 `SURGE` 동시 적 상한은 34
(`master-numeric-contract.md:27`)다. `[INFERENCE]` 34체 밀도에서 4체 접촉은 달성 가능하며,
`SKIRMISH`의 적 4–6체(`camera-vfx-direction.md:153`)에서는 어렵다 — **자연히 `SURGE`가
CM6의 첫 발동 지점이 된다.** 인위적 게이트가 필요 없다.

### 7.4 강제 종막 구간의 연출

`[OBSERVED]` 32400 tick 도달 시 강제 종막: 보스 피해 ×1.5, 패턴 쿨다운 ×0.7
(`master-gdd-delta.md:227`). 보스를 건너뛰지 않는다 (`master-numeric-contract.md:81`).

`[TARGET]` 이 구간의 연출은 **텍스트 경고 0자**로 처리한다:

| 채널 | 변화 | 왜 |
|---|---|---|
| CM7 `ember-fade` 강제 활성 | HP와 무관하게 비네트 진입 | "시간이 나를 죽이고 있다"를 상태로 |
| 구역 VFX `core` | 밝기 감소 (등불이 짧아진다) | `[OBSERVED]` `spawnCap: 1`이므로 단일 인스턴스 유니폼 변경으로 가능 (`assets/motion/stage-vfx/manifest.json:29`) |
| 흔들림 진폭 | §4.2 표 그대로 | 압박을 흔들림으로 올리면 예고가 묻힌다 |
| 텍스트 | **0자** | 예산 12자는 이미 배정됨 (§6.1) |

**`[TARGET]` 패턴 쿨다운 ×0.7이 예고 tick을 줄이지 않는다** —
`boss-pattern-spec.md:220` `예고 단축은 학습 무효화. 금지한다.` 연출도 예고를 가리지
않는다.

---

## 8. 검증 표 — 이 문서가 추가하는 검사

`camera-vfx-direction.md:527-559`의 24검사와 `ui/hud-information-architecture.md:266-277`을
**중복하지 않는다.** 이 문서 고유 주장만 검사한다.

| # | 검사 id | 시나리오 | 통과 기준 |
|---|---|---|---|
| 1 | `stage-camera-live-clamp` | 전 6페이즈 티어 | `zoomFactor`가 라이브 clamp 안 — 하한 `orbitDistanceForRadius(cam, 2.25, 1.2)`, 상한 `(cam, 22.769, 1.1)`. **폴백 `[10.394, 41.578]`을 오라클로 쓰지 않는다** |
| 2 | `stage-camera-fog-bound` | 3구역 × 6페이즈 = 18 | 의미 전달 이미지가 `stageFogRange(stageId).far` 안에 든다 (§2.3 S2) |
| 3 | `stage-shake-live-scale` | §4.2 표 전 이벤트 | 진폭 ≤0.18, 누적 ≤0.36. **0.6–4.0 값 0건** |
| 4 | `stage-shake-normal-zero` | `LIGHT_1/2` 접촉 20회 | 카메라 흔들림 0 (`:3034` 현행 동작 보존) |
| 5 | `stage-text-budget-zero-narrative` | 6비트 전부 캡처 | 서사 텍스트 온스크린 0자 (T1) |
| 6 | `stage-text-budget-inherit` | `BIGWAVE` 캡처 | 글자 수 ≤12 — `ui#:205`와 **같은 오라클** |
| 7 | `stage-skill-no-name` | 스킬 6종 발동 | 스킬 이름 온스크린 0건 (`ui#:219`) |
| 8 | `stage-pickup-no-camera` | 획득 20회 | 카메라 위치·거리·yaw 변화 0 (§4.5) |
| 9 | `stage-pickup-rises` | 획득 궤적 | 궤적에 상향 구간 존재 (색맹 위치 구분, §4.5) |
| 10 | `stage-channel-no-collision` | `BIGWAVE` + 저체력 + 페이즈 전환 동시 | §6.3 채널당 동시 의미 1개 |
| 11 | `stage-cm1-cm8-no-combat` | CM1 / CM8 활성 구간 | 활성 적 0, 예고 데칼 0 |
| 12 | `stage-cm2-yaw-origin` | CM2 발동 | 시작 yaw가 z축 정면 (§2.4) |
| 13 | `stage-vfx-ambient-stateless` | 3구역 앰비언트 VFX | 상태 정보 사상 0건 — `spawnCap 1` / `cosmetic` 계약 보존 (§3.1) |
| 14 | `stage-vfx-low-tier-core` | `low` 품질 × 3구역 | `core` 그룹 생존, 분위기 식별 가능 (`assets/motion/stage-vfx/manifest.json:133-135`) |
| 15 | `stage-region-form-language` | 3구역 스크린샷 | 색을 그레이스케일로 변환해도 구역 구분 가능 (형태 1차 채널, §5.2) |
| 16 | `stage-surge-cm6-first` | 기준 런 1회 | CM6 첫 발동이 `SURGE` 구간 (§7.3) |
| 17 | `stage-forced-close-no-text` | 32400 tick 도달 | 경고 텍스트 0자, 예고 tick 불변 (§7.4) |
| 18 | `stage-reduced-motion-parity` | `prefers-reduced-motion` | CM1–CM8 등가물 동작, 예고 유지, 흔들림 0. **CM1은 완전 생략**이 정답 (`battle-realtime-three.js:2610`, `:2630`) |
| 19 | `stage-echo-throne-no-far-silhouette` | `echo-throne` 6페이즈 | 원경 실루엣 의존 연출 0건 (§2.3 S4) |
| 20 | `stage-digest-parity` | 연출 유/무 동일 입력열 | `getRunDigest()` 바이트 동일 — 연출이 시뮬레이션에 쓰지 않음 (`CLAUDE.md §2`) |
| 21 | `stage-fog-single-source` | 3구역 | `scene.fog.near/far`가 `stageFogRange()`와 일치. `atmosphere.fogNear/fogFar`를 읽는 코드 **0건** 유지 (§5.3, R11) |
| 22 | `stage-intro-authored-bounds` | 3구역 인트로 | `durationTicks` 정수 `1–300`, `from`/`to` 6값 전부 유한 — 스키마 위반 0건 (`stage-world-catalog.js:256`) |
| 23 | `stage-intro-offset-only` | 3구역 인트로 재생 | 인트로가 `zoomFactor`/`orbitYaw`/`orbitPitch` **필드를 쓰지 않음** — 오프셋 가산만 (`battle-realtime-three.js:2665-2676`) |
| 24 | `stage-palette-three-source` | 3구역 | `stage-world-catalog.js` `accent` = `STAGE_PALETTE_TINTS` 3/3 유지. VFX manifest 교차는 R7 판정까지 **형태 채널로 우회** (§3.3, §5.2) |

---

## 9. 미해결 · 라우팅

내 레인(`_workspace/current/design/`) 밖의 조치가 필요한 항목이다. **이 세션에서 소스를
수정하지 않았다.**

| # | 항목 | 근거 | 소유 |
|---|---|---|---|
| R1 | `camera-vfx-direction.md` 라인 인용 4건 드리프트 (§0.3 M1) | `:34-40` vs 라이브 `:1626`/`:2643`/`:3105` | 카메라 권위 문서 소유자 |
| R2 | 줌 clamp `[10.39, 41.58]` → 라이브 `[7.53, 69.89]` (§0.3 M2) | `:103-104` 폴백 vs `:1632-1633` mount | 동일 |
| R3 | 기본 피치 55° `[TARGET]` vs 라이브 65° (§0.3 M3) | `camera-vfx-direction.md:48` vs `:1535`, `:3317` | 동일 |
| R4 | 흔들림 진폭 8.6×–57× 과대 (§0.3 M4, §4.2) | `:338-345` vs `:406-409` | 동일 |
| R5 | 팔로우 스무딩 프레임률 의존 (§0.4) | `:2656-2658` 고정 계수 0.18 | 엔지니어링 |
| R6 | `stageFogRange`에 페이즈 인자 없음 — 공정성 하한 미구현 (§2.3) | `:498-501`; 요구 `camera-vfx-direction.md:283-285` | 엔지니어링 |
| R7 | 구역 2/3 팔레트 교차 의심 (§3.3) | tint `:481-482` vs `assets/motion/stage-vfx/manifest.json:58`,`:102` — 교차 hue 차 11°/6° | 아트 디렉션 + 엔지니어링 |
| R8 | 라이브 clamp 상한 69.888 > mount 안개 far 58.8 (§0.3) | `:1633` vs `:1623` | 엔지니어링 |
| R9 | 픽업 색 `0xFFAA00` vs 팔레트 정본 금 `#FFD60A` (§4.5) | `:469-470` vs `camera-vfx-direction.md:443` | 아트 디렉션 |
| R10 | `CUTSCENES`가 §2 반전 구조를 담지 않음 | `defense-catalog.js:231-259` | 별도 구현 작업 |
| R11 | **`atmosphere.fogNear/fogFar`가 죽은 데이터이며 정본과 2/3 불일치** (§5.3) | `stage-world-catalog.js:112`,`:149`,`:186` vs `battle-realtime-three.js:489-491`; 소비 지점 0건 | 엔지니어링 — 정정 또는 삭제 |
| R12 | CM1 저작값 연출 의도 미확정 (§2.2.1) | `stage-world-catalog.js:113`,`:150`,`:187` — 구현은 존재, 값의 의도는 미기록 | 카메라 권위 문서 소유자 |

---

## 10. 이 문서가 주장하지 않는 것

- 연출이 재미있다는 것 — 사람 판정 전까지 미증명
  (`onslaught-action-product-contract.md:160-164`).
- 카메라 티어를 재정의한다는 것 — §2.3은 `camera-vfx-direction.md:152-157` **인용**이다.
- HUD 예산을 정의한다는 것 — §6.1은 `ui/hud-information-architecture.md:204-209`
  **상속**이다.
- 안개 공정성 하한이 구현되었다는 것 — `[OBSERVED]` `stageFogRange`(`:498`)는 여전히
  `stageId` 하나만 받는다. §2.3 S1–S4가 미구현을 전제로 우회한다.
- 팔레트 교차가 결함으로 판정되었다는 것 — §3.3은 `[INFERENCE]`이며 아트 디렉션 판단이
  필요하다.
- 이미지 자산이 생성되었다는 것 — `gti` 0회 호출, 신규 이미지 0장. §7.3의 모든 대응이
  **신규 자산 0개**로 성립한다.
