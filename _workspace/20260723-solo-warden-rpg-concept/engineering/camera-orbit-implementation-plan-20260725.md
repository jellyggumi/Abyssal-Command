# camera-orbit-implementation-plan-20260725.md — `RealtimeBattle` 자유 궤도 카메라 구현 계획

```yaml
run_id: 20260723-solo-warden-rpg-concept
lane: engineering / rendering-programmer (Camera Implementation Plan)
stage: 1-concept  # DOCUMENT ONLY — pseudocode-level plan, no shipped/committed code this cycle
owner: CameraImplPlan
consumes:
  - _workspace/20260723-solo-warden-rpg-concept/design/stage1-reentry-synthesis-20260725.md (§2.1 요구사항, §2.2 GLB 감사 선행조건)
  - _workspace/20260723-solo-warden-rpg-concept/design/presentation-spec.md:14-25 (카메라 타겟 스펙)
  - _workspace/20260723-solo-warden-rpg-concept/production/decision-log.md (D17, 두 번째 항목 — 렌더러=옵저버 불변량)
  - battle-realtime-three.js (RealtimeBattle 클래스 전체 — 읽기 전용 감사 대상)
  - app.js:41-63, 869-954 (기존 입력 계약 — orbit()/zoom() 호출부)
sibling_lanes:
  - { id: ControlFeelDesign, facet: "조작감/입력 반응성 — 이 문서의 orbit()/zoom() 수치 계약을 소비" }
  - { id: CoreLoopRedesign, facet: "코어루프 재설계 — 카메라 변경과 독립" }
director_decision_incorporated: "2026-07-25 IRC — 자동추적 재개 시 orbitYaw/orbitPitch/zoomFactor는 리셋되지 않고 무기한 유지, cameraTarget(팬 타겟)만 0.18 lag easing으로 커맨더를 재추적한다. ControlFeelDesign이 요구사항 4의 '커맨더 추적 로직 자체는 유지, 타겟 지점만 궤도 중심으로 사용' 문구에서 독립적으로 도출, director가 확정."
```

## 0. 범위

이 문서는 `RealtimeBattle`(`battle-realtime-three.js`)에 자유 궤도 카메라를 구현하기 위한
**의사코드 수준 계획**이다 — 실제 코드 변경 없음(assignment 5번 "Do NOT write or apply actual code changes" 준수). 대상: 신규 상태 필드, `orbit()`/
`zoom()` 메서드, `updateCamera()` 전면 재작성, near/far(정확히는 궤도 거리 clamp) 산출 방식,
기존 테스트 계약과의 상호작용. 범위 밖: GLB 임의각 뷰잉 준비도 실측 감사(synthesis 문서 §2.2,
별도 선행 작업), UI 궤도카메라 컨트롤 힌트(UILayoutRedesign 소관), 조작감 튜닝 수치 자체
(ControlFeelDesign 소관 — 이 문서는 그 팀이 소비할 메서드 계약만 확정한다).

## 1. 기존 계약 — 읽기 전용 감사 결과 ([OBSERVED])

### 1.1 `RealtimeBattle` 클래스 구조

| 사실 | 근거 |
|---|---|
| 클래스 선언, `constructor()` | [OBSERVED] `battle-realtime-three.js:614-648` |
| `this.cameraTarget = new THREE.Vector3()`, `this.cameraFollowInit = false` — 생성자에서 초기화 | [OBSERVED] `battle-realtime-three.js:632-633` |
| `mount()` — 카메라 생성: `new THREE.PerspectiveCamera(42, width/height, 0.1, 200)` (FOV 42°, near=0.1, far=200 — **이 near/far는 프러스텀 클립 평면이지, 아래 §3의 궤도 거리 clamp("near/far scaled from bounding box")와는 다른 값이다**, 혼동 방지를 위해 본 문서에서 궤도 거리 clamp는 `minDistance`/`maxDistance`로 명명) | [OBSERVED] `battle-realtime-three.js:674-675` |
| `renderSnapshot(snapshot, frame)` 호출 순서: `ensureStageTerrain` → `captureDeathEchoes` → `reconcileActors` → `updateCamera(snapshot)` → `updateAnimations` → `collectFeedback` → `renderer.render()` | [OBSERVED] `battle-realtime-three.js:1098-1115` |
| `updateCamera(snapshot)` 현재 구현 — 고정 등각 오프셋 | [OBSERVED] `battle-realtime-three.js:925-942` (전문 인용 §2.3) |
| `dispose()` — `cameraFollowInit = false`로 리셋, `camera = null`(mount() 재호출 전까지 카메라 인스턴스 자체가 사라짐) | [OBSERVED] `battle-realtime-three.js:1122-1163`, 구체적으로 `1151`(`cameraFollowInit`), `1147`(`camera = null`) |
| `debugMetrics()` — `{geometries, textures, programs}` 3필드 고정, 카메라 상태 노출 없음(이번 변경과 무관) | [OBSERVED] `battle-realtime-three.js:1165-1173` |
| `WORLD_SCALE = 14` — actor-space `[-1,1]` 정규화를 월드 유닛으로 매핑하는 유일한 스케일 상수 | [OBSERVED] `battle-realtime-three.js:22` |
| `TERRAIN_TARGET_HALF_EXTENT = WORLD_SCALE * 1.15 = 16.1` — 모든 테레인 GLB가 `fitFootprint()`로 이 half-extent에 강제 스케일됨(원본 GLB 크기 무관, **결정론적 상수**) | [OBSERVED] `battle-realtime-three.js:29`, `fitFootprint()` 구현 `battle-realtime-three.js:366-372`, 호출부 `battle-realtime-three.js:431-436`(`instantiateTerrainModel`) |
| `TARGET_HEIGHT = { commander: 2.9, boss: 4.5, elite: 2.2, enemy: 1.7, companion: 1.3 }` — 액터별 Y축 목표 높이(스케일 후) | [OBSERVED] `battle-realtime-three.js:34-40` |
| `worldPoint(entity)` — actor-space를 월드좌표로 매핑, 정규화 좌표는 `x * WORLD_SCALE` / raw arena 좌표(`WORLD_WIDTH=24000, WORLD_HEIGHT=12000`)는 `(x/WORLD_WIDTH*2-1) * WORLD_SCALE` — 두 경로 모두 결과는 `[-WORLD_SCALE, WORLD_SCALE] = [-14, 14]`로 bounded | [OBSERVED] `battle-realtime-three.js:284-294`, `273-274`(WORLD_WIDTH/HEIGHT) |
| 썸네일 렌더러(`MeshThumbnailService`)의 bounding-sphere-fit 공식: `distance = radius / sin((camera.fov/2) * (PI/180)) * 1.35` | [OBSERVED] `battle-realtime-three.js:529-535` — `camera.fov`는 그 서비스 자신의 카메라(FOV 35°, `battle-realtime-three.js:496`), `RealtimeBattle.camera`(FOV 42°)와는 별개 인스턴스 |
| `THREE.MathUtils`가 vendored three.js에서 export됨(clamp/degToRad/radToDeg 등 사용 가능) | [OBSERVED] `vendor/three.module.js` — `MathUtils` 심볼이 export 목록에 존재(grep 확인) |

### 1.2 `app.js` 기존 입력 계약 — 이 구현이 만족해야 하는 정확한 시그니처

| 사실 | 근거 |
|---|---|
| 감도 상수 3개: `CAMERA_ORBIT_YAW_SENSITIVITY = 0.00372`(rad/px), `CAMERA_ORBIT_PITCH_SENSITIVITY = 0.00246`(rad/px), `CAMERA_PINCH_ZOOM_SENSITIVITY = 0.006`(zoomFactor delta/px) | [OBSERVED] `app.js:52-54` |
| `CAMERA_FOLLOW_EASING = 0.18` — 이미 `battle-realtime-three.js:934-935`가 하드코드로 재사용 중인 값과 **동일**(별도 import 없이 각자 리터럴로 보유 — 이번 변경도 이 컨벤션 유지, 신규 cross-file 의존성 도입 안 함) | [OBSERVED] `app.js:67`, `battle-realtime-three.js:934-935` |
| 원포인터 드래그 → `this.renderer?.orbit?.(dx * CAMERA_ORBIT_YAW_SENSITIVITY, -dy * CAMERA_ORBIT_PITCH_SENSITIVITY)` — **`dy`에 이미 음수 부호가 적용되어 전달됨**(위로 드래그 = 아래를 봄 = pitch 증가라는 의도가 호출부에 이미 인코딩) → `orbit()` 자체는 부호 반전 없이 인자를 그대로 더하기만 하면 됨 | [OBSERVED] `app.js:940` |
| 핀치 → `this.renderer?.zoom?.(-deltaDistance * CAMERA_PINCH_ZOOM_SENSITIVITY)` — **손가락이 벌어짐(`deltaDistance > 0`) → 음수 인자 → `zoom()`은 인자를 그대로 거리에 더하기만 하면 축소(zoom in)**, 별도 부호 처리 불필요 | [OBSERVED] `app.js:928-933` |
| 두 호출 모두 optional-chaining(`renderer?.orbit?.()`) — 메서드가 없으면 조용히 no-op, `BattleVisualizer` 폴백 경로는 이 메서드들을 구현할 필요 없음(범위 밖) | [OBSERVED] `app.js:932,940` |
| 캔버스 드래그는 오직 궤도용, 이동 입력과 완전 분리(D-pad/키보드 전용) — 주석이 이미 명시 | [OBSERVED] `app.js:899-902` |

### 1.3 스펙 타겟 ([OBSERVED], `design/presentation-spec.md:18-25`)

```yaml
camera:
  angle: free orbit — yaw unrestricted, pitch clamped [30°, 85°] from ground plane (default 65°)
  follow: world-space 3D target tracking (commander position), lag easing 0.18, reduced-motion
    hard-cut on auto-follow only — user-driven drag/pinch input always responsive regardless of
    reduced-motion
  zoom: distance clamped to [near, far] scaled from arena/model bounding box (exact values TBD
    at implementation, measured against GLB content)
  control: one-finger drag = orbit (yaw/pitch), two-finger pinch = zoom
```

### 1.4 D17 렌더러=옵저버 불변량 ([OBSERVED])

`production/decision-log.md` 두 번째 D17 항목("`battle-realtime-three.js` 검증 요청 중 발견…"), **판정
요약 5번**:

> 어댑터 계약 테스트(`tests/defense-renderer-contract.test.mjs`, `tests/world-presentation-contract.test.mjs`)의
> "두 렌더러가 바이트 동일 카메라 변환을 생성해야 한다"는 기존 불변량은 **더 이상 성립하지 않음**…
> 유지되어야 할 진짜 불변량: **동일 정본 스냅샷 입력, 시뮬레이션 상태 비변경, `getRunDigest` 불변**
> — 투영 결과 자체의 동일성은 더 이상 요구하지 않는다.

[OBSERVED] `production/decision-log.md:161` — §5에서 이 계획이 이 불변량을 위반하지 않음을 확인한다.

## 2. 신규 상태 필드

`constructor()`(`battle-realtime-three.js:615-648`)의 `this.cameraTarget`/`this.cameraFollowInit`
선언 직후에 추가:

```js
// Free-orbit camera state (D17 / presentation-spec.md:18-25). orbitYaw accumulates
// unrestricted (wrapped for float precision, never clamped -- see wrapAngle()).
// orbitPitch and the zoom distance are clamped every call. Persisted across frames;
// dispose() resets these to their defaults (fresh camera angle per mount() session --
// see director-decision note below for why per-frame auto-follow does NOT touch these).
this.orbitYaw = 0; // radians, person-relative (0 = initial mount-time camera azimuth)
this.orbitPitch = THREE.MathUtils.degToRad(65); // radians, clamped [30°, 85°]
this.zoomFactor = /* legacy-continuity default distance, world units -- see §3.3 */ 20.79;
```

- `orbitYaw`/`orbitPitch`/`zoomFactor` 세 필드 모두 **회전/줌 상태**이며, `this.cameraTarget`
  (팬 타겟, 커맨더 추적 지점)과는 독립 축이다 — 이것이 §4의 director 결정("자동추적 재개는
  `cameraTarget`만 건드리고 궤도 각도는 절대 건드리지 않는다")이 성립하는 이유다.
- 이름은 synthesis 문서(§2.1 요구사항 1)의 필드명(`orbitYaw`/`orbitPitch`/`zoomFactor`)을
  그대로 따른다. `zoomFactor`라는 이름이지만 실제 값은 **월드 유닛 거리**(`[minDistance,
  maxDistance]`로 clamp)이지 0..1 배율이 아니다 — synthesis 문서 §2.1 요구사항 3("zoomFactor를
  `[near, far]`로 clamp")과 정합되는 해석.
- `dispose()`(`battle-realtime-three.js:1122-1163`)의 상태 리셋 블록(`this.cameraFollowInit
  = false` 근처, 라인 1151)에 3개 필드를 기본값으로 리셋하는 코드 추가 — **이것은 세션
  경계(재-`mount()`) 리셋이며, §4 director 결정이 다루는 "드래그 해제 시 리셋 금지"와 무관한
  별개 이벤트**임을 명시(신규 배틀 세션은 기본 65° 프레이밍으로 시작하는 것이 합리적 기본값,
  synthesis 문서가 명시한 "디폴트: yaw=0, pitch=65°, zoom=1.0" 요구사항과 일치).

## 3. `orbit(dYaw, dPitch)` / `zoom(delta)` 메서드

### 3.1 `orbit(dYaw, dPitch)`

```js
// Called by app.js's onPointerMove with already-sign-adjusted, already-sensitivity-scaled
// radians (app.js:940) -- this method does no further scaling or sign flips, just
// accumulate + clamp.
orbit(dYaw, dPitch) {
  if (this.disposed) return;
  this.orbitYaw = wrapAngle(this.orbitYaw + dYaw); // unrestricted, wrapped to (-PI, PI] for float hygiene only
  this.orbitPitch = THREE.MathUtils.clamp(
    this.orbitPitch + dPitch,
    MIN_ORBIT_PITCH, // degToRad(30)
    MAX_ORBIT_PITCH, // degToRad(85)
  );
}

// Module-level helper (private, alongside existing fitFootprint()/worldPoint() free functions):
function wrapAngle(radians) {
  const twoPi = Math.PI * 2;
  return ((radians % twoPi) + twoPi + Math.PI) % twoPi - Math.PI; // -> (-PI, PI]
}
```

- yaw는 **랩어라운드만 하고 절대 clamp하지 않음** — synthesis 문서 §2.1 요구사항 2("yaw는
  무제한 누적(랩어라운드)")를 그대로 구현. `wrapAngle`은 시각적으로 아무 효과 없음(2π 회전은
  원래 각도와 동일) — 순수하게 수십 분 세션에서 float 누적 오차를 방지하는 수치 위생 조치이며,
  §4 director 결정의 "무기한 유지" 요구사항을 위반하지 않는다(값이 바뀌어도 보이는 각도는 불변).
- pitch는 매 호출 clamp — `THREE.MathUtils.clamp`가 vendored three.js에 존재함을 §1.1에서 확인.
- `MIN_ORBIT_PITCH`/`MAX_ORBIT_PITCH`는 모듈 상단에 `THREE.MathUtils.degToRad(30)`/`degToRad(85)`로
  선언(기존 `WORLD_SCALE`/`TERRAIN_TARGET_HALF_EXTENT` 상수들과 같은 위치, 라인 22-29 부근).

### 3.2 `zoom(delta)`

```js
zoom(delta) {
  if (this.disposed) return;
  this.zoomFactor = THREE.MathUtils.clamp(this.zoomFactor + delta, MIN_ORBIT_DISTANCE, MAX_ORBIT_DISTANCE);
}
```

- `delta`는 app.js가 이미 부호를 맞춰 전달(§1.2) — 그대로 더하고 clamp만 수행.
- `MIN_ORBIT_DISTANCE`/`MAX_ORBIT_DISTANCE`는 §3.3에서 유도.

### 3.3 `minDistance`/`maxDistance` 산출 — 분석적 상수 방식 채택, GLB 런타임 측정 방식 기각

**결정: 씬 기하학적으로 이미 알려진 상수(`WORLD_SCALE`, `TERRAIN_TARGET_HALF_EXTENT`,
`TARGET_HEIGHT.boss`)로부터 분석적으로 유도한다 — `ensureStageTerrain`/액터 GLB에서 매 프레임
또는 로드 시점에 실측 바운딩 박스를 수집하지 않는다.**

**근거 (기각한 대안과의 비교)**:

| 방식 | 평가 |
|---|---|
| **A. 분석적 상수 유도 (채택)** | `fitFootprint()`(`battle-realtime-three.js:366-372`)가 **모든** 테레인 GLB를 원본 스케일 무관하게 `TERRAIN_TARGET_HALF_EXTENT`(고정 16.1)로 강제 정규화한다 — 이는 이미 §1.1에서 확인한 **결정론적 상수**다. 액터도 `TARGET_HEIGHT`로 동일하게 정규화됨. 즉 "런타임에 실측해야 알 수 있는 값"이 애초에 존재하지 않는다 — 저작 파이프라인이 이미 그 가변성을 제거했다. |
| **B. 런타임 GLB 바운딩 박스 수집 (기각)** | `ensureStageTerrain()`(`battle-realtime-three.js:701-725`)은 **비동기**(`instantiateTerrainModel().then(...)`) — 스테이지 전환 직후 첫 프레임에는 테레인이 아직 로드되지 않은 상태(`this.loadedStageId !== stageId`)일 수 있다. 줌 clamp 범위가 로드 완료를 기다려야 확정된다면, 로드 중 `zoom()` 호출이 정의되지 않은 범위에 clamp되거나 매 프레임 range가 흔들리는 문제가 생긴다. 게다가 A가 이미 정확한 값을 제공하므로 이 복잡도를 감수할 이유가 없다 — **정확성 이득 없이 비동기 의존성만 추가**. |

**공식 (§1.1의 썸네일 렌더러 `distance = radius / sin(fov/2) * margin` 패턴 재사용, 대상 반경만
교체)**:

```js
// zoom() bounds -- both computed lazily reading this.camera.fov (mirrors
// MeshThumbnailService's own pattern at battle-realtime-three.js:535 exactly;
// camera.fov is never reassigned after mount() sets it to 42, but reading it live
// avoids a duplicate hardcoded-42 constant and stays correct if FOV is ever tuned).
function orbitDistanceForRadius(camera, radius, margin) {
  return (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * margin;
}

// maxDistance: fit the full terrain footprint at any yaw. The terrain is a square
// TERRAIN_TARGET_HALF_EXTENT x TERRAIN_TARGET_HALF_EXTENT footprint (fitFootprint()) --
// the worst-case exposed radius (camera looking at a corner, not an edge midpoint) is
// the half-extent's diagonal: TERRAIN_TARGET_HALF_EXTENT * sqrt(2) ≈ 22.77.
const TERRAIN_CORNER_RADIUS = TERRAIN_TARGET_HALF_EXTENT * Math.SQRT2; // ≈ 22.77
// MAX_ORBIT_DISTANCE = orbitDistanceForRadius(camera, TERRAIN_CORNER_RADIUS, 1.1) ≈ 69.9
// (evaluated once in mount(), after `this.camera` exists -- camera.fov is fixed at
// construction so this is effectively a constant, but computing it from the live
// camera.fov avoids hand-duplicating the literal 42)

// minDistance: tightest useful framing without clipping the largest actor (boss,
// TARGET_HEIGHT.boss=4.5 world-unit height) at steepest pitch (30°, most oblique).
// Margin 1.2 (slightly tighter than the thumbnail renderer's 1.35 portrait-crop
// margin, since this is a lower bound, not a target framing) leaves headroom against
// the camera.near=0.1 clip plane and avoids the actor filling >90% of frame height.
const BOSS_RADIUS = TARGET_HEIGHT.boss / 2; // 2.25
// MIN_ORBIT_DISTANCE = orbitDistanceForRadius(camera, BOSS_RADIUS, 1.2) ≈ 7.5
```

**계산 결과 (evaluated, FOV=42°)**:

| 상수 | 유도 | 값(월드 유닛) |
|---|---|---|
| `MIN_ORBIT_DISTANCE` | `orbitDistanceForRadius(camera, TARGET_HEIGHT.boss/2, 1.2)` | ≈ 7.5 |
| `MAX_ORBIT_DISTANCE` | `orbitDistanceForRadius(camera, TERRAIN_TARGET_HALF_EXTENT * √2, 1.1)` | ≈ 69.9 |
| `zoomFactor` 기본값 | 기존 고정 오프셋의 유클리드 거리(`hypot(WORLD_SCALE*1.05, WORLD_SCALE*1.05)`) — 최초 프레임이 기존 Option-A 렌더와 시각적으로 동일한 "카메라 거리"로 시작하도록 연속성 유지, pitch만 스펙의 새 기본값(65°, 기존 45° 대비)로 전환 | ≈ 20.79 |

**[TARGET] 표기, 조건부 확정**: 위 margin 계수(1.1/1.2)는 synthesis 문서 §2.2가 요구하는 **GLB
임의각 뷰잉 준비도 감사**(보스 10종 최우선) 완료 전까지는 잠정치다 — 감사에서 특정 보스가 30°
pitch·근접 줌에서 실루엣이 깨지거나(백페이스 컬링 노출 등) 발견되면 `MIN_ORBIT_DISTANCE`의
margin을 상향 조정해야 한다. 이 문서의 공식 자체(A안 채택)는 그 감사 결과와 무관하게 유효 —
바뀌는 것은 margin 숫자뿐이다.

## 4. `updateCamera(snapshot)` 재작성 계획

### 4.1 현재 구현 ([OBSERVED] 전문 인용, `battle-realtime-three.js:925-942`)

```js
updateCamera(snapshot) {
  const commander = snapshot?.commander ?? snapshot?.player;
  const commanderPoint = worldPoint(commander ?? {});
  const targetX = commanderPoint.x;
  const targetZ = commanderPoint.z;
  if (!this.cameraFollowInit) {
    this.cameraTarget.set(targetX, 0, targetZ);
    this.cameraFollowInit = true;
  } else if (!this.reducedMotion) {
    this.cameraTarget.x += (targetX - this.cameraTarget.x) * 0.18;
    this.cameraTarget.z += (targetZ - this.cameraTarget.z) * 0.18;
  } else {
    this.cameraTarget.set(targetX, 0, targetZ);
  }
  const offset = new THREE.Vector3(0, WORLD_SCALE * 1.05, WORLD_SCALE * 1.05);
  this.camera.position.set(this.cameraTarget.x + offset.x, offset.y, this.cameraTarget.z + offset.z);
  this.camera.lookAt(this.cameraTarget.x, 0.6, this.cameraTarget.z);
}
```

### 4.2 재작성 계획 (의사코드)

```js
updateCamera(snapshot) {
  // --- Section 1: pan target (cameraTarget) -- COMMANDER-FOLLOW LOGIC UNCHANGED ---
  // Director decision (2026-07-25, confirmed via ControlFeelDesign's independent read
  // of requirement 4): this section is byte-identical to the current implementation.
  // It NEVER reads or writes orbitYaw/orbitPitch/zoomFactor -- auto-follow only ever
  // moves the orbit CENTER (cameraTarget), never the viewing angle chosen by the user.
  const commander = snapshot?.commander ?? snapshot?.player;
  const commanderPoint = worldPoint(commander ?? {});
  const targetX = commanderPoint.x;
  const targetZ = commanderPoint.z;
  if (!this.cameraFollowInit) {
    this.cameraTarget.set(targetX, 0, targetZ);
    this.cameraFollowInit = true;
  } else if (!this.reducedMotion) {
    this.cameraTarget.x += (targetX - this.cameraTarget.x) * 0.18;
    this.cameraTarget.z += (targetZ - this.cameraTarget.z) * 0.18;
  } else {
    this.cameraTarget.set(targetX, 0, targetZ);
  }

  // --- Section 2: orbit position -- REPLACES the fixed offset block ---
  // Spherical coordinates around cameraTarget, driven by orbitYaw/orbitPitch/zoomFactor.
  // orbitYaw=0, looking from the +Z side (matches the legacy fixed offset's viewing
  // direction, offset.z > 0, offset.x = 0 -- see §4.3 continuity check).
  const horizontalRadius = this.zoomFactor * Math.cos(this.orbitPitch);
  const height = this.zoomFactor * Math.sin(this.orbitPitch);
  const offsetX = horizontalRadius * Math.sin(this.orbitYaw);
  const offsetZ = horizontalRadius * Math.cos(this.orbitYaw);
  this.camera.position.set(
    this.cameraTarget.x + offsetX,
    this.cameraTarget.y + height, // cameraTarget.y is always 0 (Section 1 never sets it otherwise)
    this.cameraTarget.z + offsetZ,
  );
  this.camera.lookAt(this.cameraTarget.x, 0.6, this.cameraTarget.z); // lookAt height offset unchanged
}
```

- **Section 1(팬 타겟)은 현재 코드와 완전히 동일** — 라인 926-938을 그대로 재배치, 로직 변경
  0건. 이것이 §4 director 결정("커맨더 추적 로직 자체는 유지")과 요구사항 4("auto-follow는
  `cameraTarget`만 lerp, `orbitYaw`/`orbitPitch`/`zoomFactor`는 절대 건드리지 않음")를
  동시에 만족시키는 구조 — 두 관심사(팬 vs 궤도)가 처음부터 서로 다른 필드에 쓰기 때문에
  "건드리지 않는다"는 것이 코드 구조상 자명하게 성립한다(별도 가드 불필요).
- **reduced-motion 스코프 확인**: 스펙(§1.3)이 "auto-follow만 hard-cut, 사용자 드래그/핀치는
  항상 반응"이라 명시 — Section 1의 `this.reducedMotion` 분기는 원래도 `cameraTarget`에만
  적용되고(라인 933-937) `orbit()`/`zoom()`(§3)에는애초에 `reducedMotion` 체크가 없다(사용자
  입력은 프레임 이징과 무관하게 항상 즉시 반영) — 스펙 요구사항이 **이미** 이 설계로
  자동 충족됨, 추가 분기 불필요.
- **Section 2 좌표계**: yaw=0을 "카메라가 타겟의 +Z측에서 -Z방향을 바라봄"으로 정의(기존
  고정 오프셋의 `offset.z > 0, offset.x = 0`과 동일한 시야 방향 — §4.3에서 연속성 확인).
  `Math.sin(yaw)`/`Math.cos(yaw)`의 부호 조합이 드래그 방향과 "자연스럽게" 대응하는지는
  ControlFeelDesign의 실측 튜닝 대상(이 문서는 기하학적으로 유효한 구면좌표 공식만 확정).

### 4.3 연속성 확인 — 기본값에서 기존 렌더와 정합

기본값(`orbitYaw=0, orbitPitch=65°, zoomFactor≈20.79`)을 대입하면:

- `horizontalRadius = 20.79 * cos(65°) ≈ 8.79`
- `height = 20.79 * sin(65°) ≈ 18.84`
- `offsetX = 8.79 * sin(0) = 0`, `offsetZ = 8.79 * cos(0) ≈ 8.79`

기존 고정 오프셋(`offset = (0, 14.7, 14.7)`, 45° 앙각 등각뷰)과 비교하면 **X축 정렬은
동일(0)하지만 Y/Z 값은 다르다** — 이는 회귀가 아니라 **의도된 스펙 변경**: presentation-spec.md가
디폴트 pitch를 65°(더 가파른 탑다운)로 명시했고 기존 코드의 45°(등각)는 D17이 대체 대상으로
지정한 값이다. `zoomFactor` 기본값(≈20.79)만 기존 거리와 동일하게 유지해 "카메라-타겟 거리"
자체의 급격한 변화는 피했다 — 각도만 스펙대로 전환.

## 5. 기존 테스트 계약과의 상호작용

### 5.1 D17 옵저버 불변량 — 위반 없음 확인

§1.4에서 인용한 진짜 불변량("동일 정본 스냅샷 입력, 시뮬레이션 상태 비변경, `getRunDigest`
불변")을 §4.2 재작성안과 대조:

- `updateCamera(snapshot)`은 **여전히 `snapshot.commander`/`snapshot.player`를 읽기만
  한다** — 새로 추가되는 어떤 필드도 `snapshot`에 쓰지 않음(§4.2 코드에 `snapshot.` 좌변
  대입 0건).
- `orbit()`/`zoom()`은 `snapshot`을 인자로 받지 않는다(§3.1, §3.2 시그니처 확인) — 스냅샷과
  완전히 독립된 카메라 전용 상태(`this.orbitYaw`/`orbitPitch`/`zoomFactor`)만 변경.
- 시뮬레이션 계층(`defense-run-simulation.js`)에 대한 참조가 이 파일에 전혀 없음(§1.1의
  모듈 헤더 doc-comment가 이미 "no loop/input/campaign/outcome ownership"을
  `tests/defense-renderer-contract.test.mjs:371-379`로 강제 — 신규 메서드도 이 스캔을
  통과: `requestAnimationFrame`/`addEventListener`/`campaign-state`/outcome 키워드 중
  어느 것도 사용하지 않음).

**결론: 이 계획은 D17 불변량을 위반하지 않는다.** `getRunDigest`/`getRunSnapshot`은
`defense-run-simulation.js`가 소유하는 시뮬레이션 상태에서만 계산되며, 카메라 클래스의 어떤
필드도 그 계산 경로에 입력되지 않는다 — 이미 D17 판정이 "투영 결과 자체의 동일성은 더 이상
요구하지 않는다"고 명시했으므로, 카메라가 스냅샷마다 다른 화면을 그리는 것 자체는애초에
허용된 변경 범위다.

### 5.2 깨지는 테스트 — 구현 단계에서 갱신 필요 (명시적 플래그)

`tests/defense-renderer-contract.test.mjs:267-288`("RealtimeBattle eases its commander-follow
camera and snaps immediately under reduced motion")의 마지막 assertion:

```js
assert.equal(adapter.camera.position.y, 14.700000000000001, "camera keeps its fixed elevation offset above the follow target");
```

이 한 줄은 **§4.2 재작성 이후 실패한다** — `camera.position.y`가 더 이상 `WORLD_SCALE * 1.05`
고정값이 아니라 `zoomFactor * sin(orbitPitch)`로 계산되기 때문(§4.3 기본값 대입 시 ≈18.84,
14.7과 다름). 이는 회귀가 아니라 **이 assertion이 검증하던 대상(고정 앙각) 자체가 D17이
명시적으로 대체하기로 한 Option-A 카메라 모델의 속성**이기 때문 — assertion 메시지 자체가
"fixed elevation offset"이라고 명시하고 있어, 자유 궤도 카메라 도입과 근본적으로 양립 불가.

같은 테스트의 **다른 3개 assertion(라인 271-284, `cameraFollowInit`/`cameraTarget.x` 추적/이징
델타 범위)은 전부 `cameraTarget`만 검사하며 §4.2 Section 1이 그 로직을 완전히 보존하므로 무변경
통과**한다 — 갱신이 필요한 것은 `position.y` 하드코드 단 한 줄.

**구현 단계 권고**: 이 assertion을 `adapter.camera.position.y`의 정확한 숫자 대신, 기본 궤도
상태(`orbitYaw=0, orbitPitch=degToRad(65), zoomFactor` 기본값)에서 §4.2의 구면좌표 공식으로
계산한 기댓값과 비교하도록 재작성 — 즉 "고정 앙각"이 아니라 "orbit 상태가 카메라 위치에
결정론적으로 반영된다"는 새 불변량을 검증하는 assertion으로 교체.

### 5.3 영향받지 않는 테스트 (확인)

- `tests/world-presentation-contract.test.mjs:385-414`("commander-follow camera is bounded
  transient frame state…")는 `RealtimeBattle`이 아니라 **`app.js`의 `BattleSession` 클래스의
  `updateCamera()`**(2D 화면공간 팔로우 카메라, `app.js:869-887`)를 테스트한다 — 완전히 다른
  클래스의 동명 메서드([OBSERVED] 해당 테스트 `session.canvas`/`session.projected()` 사용,
  `battle-realtime-three.js`의 `RealtimeBattle`과 무관, `world-presentation-contract.test.mjs:1-8`
  import 목록 확인). 이 계획과 무관, 영향 없음.
- `tests/world-presentation-contract.test.mjs:465-495`(포틀레이트 라벨 counter-rotation)도
  `BattleVisualizer`(Canvas2D) 전용 — `RealtimeBattle`과 무관.
- `tests/defense-renderer-contract.test.mjs:290-300`("resolves a terrain model for every
  authored stage without touching the snapshot")은 `ensureStageTerrain()`만 검사, `orbit()`/
  `zoom()`/`updateCamera()` 변경과 독립.
- `debugMetrics()` 계약(3필드 고정)은 무변경 — 신규 필드를 그 반환 객체에 추가하지 않음.

## 6. Director Handoff Note (디렉터 핸드오프 노트)

가장 중요한 결정은 **`minDistance`/`maxDistance`(궤도 줌 범위)를 런타임 GLB 바운딩 박스
측정이 아니라, 이미 결정론적으로 정규화된 기존 상수(`WORLD_SCALE`, `TERRAIN_TARGET_HALF_EXTENT`,
`TARGET_HEIGHT.boss`)로부터 분석적으로 유도**한 것이다(§3.3). 이것이 성립하는 이유는
`fitFootprint()`가 이미 모든 테레인 GLB를 원본 스케일과 무관하게 동일한 half-extent로 강제
정규화하고 있기 때문 — "GLB를 실측해야 안다"는 전제 자체가 이 저장소의 저작 파이프라인에서는
거짓이다. 이 결정을 뒤집을 유일한 근거는 synthesis 문서 §2.2의 GLB 임의각 뷰잉 준비도 감사에서
특정 보스 GLB가 §3.3의 margin 계수(1.1/1.2)로 커버되지 않는 실루엣 결함(백페이스 노출 등)을
보인다는 실측이 나오는 경우뿐이며, 그 경우에도 **공식 자체(A안)는 유효하고 margin 숫자만
조정**하면 된다 — B안(런타임 측정)으로 전환할 필요는 없다(비동기 로드 타이밍 문제만 추가되고
정확성 이득이 없음, §3.3 표 참조). 두 번째로 확정해야 할 사항은 §5.2의 테스트 갱신 —
`tests/defense-renderer-contract.test.mjs:287`의 `camera.position.y === 14.7` 하드코드
assertion은 구현 착수 시 반드시 함께 갱신해야 한다(고정 앙각을 검증하던 로직이 자유 궤도
도입으로 전제 자체가 무효화됨, 나머지 3개 assertion은 무변경 유지). D17 렌더러=옵저버
불변량(스냅샷 입력·시뮬레이션 상태·`getRunDigest` 불변)은 이 계획 전체에서 위반되지
않음을 §5.1에서 코드 경로 추적으로 확인했다.
