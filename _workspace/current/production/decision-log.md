# Production Decision Log — Onslaught 액션 피벗

## D-20260728-OAP-01 — 액션 핵앤슬래시 제품 계약 승인

```yaml
decision_id: D-20260728-OAP-01
run_id: 20260728-onslaught-action-pivot
date: 2026-07-28
status: GO_FOR_VERTICAL_SLICE_PLANNING
scope: Cinder Span 1스테이지의 계획·구현 순서·증명 조건
product_contract: design/onslaught-action-product-contract.md
numeric_authority: design/master-numeric-contract.md
evidence_state: "[TARGET] — 설계 승인이지 구현·밸런스·사람 플레이 통과가 아님"
```

### 결정

**GO — 기존 디펜스 서바이버 오토배틀러를 모바일 우선 Three.js 액션 핵앤슬래시 로그라이트로 피벗한다.** 첫 실물 목표는 Cinder Span의 5–8분 플레이 가능한 세로 슬라이스다.

이 결정은 사용자가 요청한 직접 조작, 광역 스킬과 빅웨이브, 중간·최종 보스의 회피 패턴, PCG 오픈월드 감각, 지속 성장, 화려하지만 판독 가능한 연출, 미디어 중심 로비 서사를 제품 요구로 확정한다. 근거는 `intake/production-brief.md#1`–`#5`와 `design/onslaught-action-product-contract.md`다.

### 승인 범위

| 결정 | 처리 | 근거 |
|---|---|---|
| 제품 정의 | 액션 핵앤슬래시 로그라이트로 전환 | `design/onslaught-action-product-contract.md#1` |
| 스테이지 | 6페이즈, 기준 360초·허용 300–480초 | `design/master-numeric-contract.md#2` |
| 전투 | 입력 기반 콤보·강공격·대시, 자동 기본 공격 폐기 | `design/action-combat-spec.md#1`–`#4` |
| 월드 | 시드 기반 3×2 평면 셀, 모서리 스폰·대각 보스 | `design/pcg-stage-layout-spec.md#2`, `#5` |
| 성장 | 4카테고리 6슬롯, 20스킬, L1–L5, 실패 보존 | `design/skill-and-growth-spec.md#1`–`#5` |
| 동료·스탠스 | 자동 추종은 유지, 정예 추출은 최종 보상으로 유지, `FORMATION_STANCES`는 폐기 | `design/skill-and-growth-spec.md#6`, `engineering/migration-map.md#6` |
| 연출·HUD | 카메라·VFX는 판독성 이후, HUD는 즉시 정보를 월드에 둠 | `design/camera-vfx-direction.md#0`, `ui/hud-information-architecture.md#1` |
| 서사 | 로비 `기록` 탭에서 비디오·인엔진·스틸 중심으로 제공 | `design/lobby-story-presentation-spec.md#2`–`#4` |

### 엔지니어링 선택 확정

| # | 사안 | 결정 | 이유 |
|---:|---|---|---|
| 1 | 동료 아이템 획득 거리 | 기본 공격 사거리와 분리한 동료 전용 상수로 둔다 | 자동 기본 공격 폐기 후에도 동료 동작이 숨은 전투 사거리에 의존하지 않게 한다. |
| 2 | Pages 자산 allowlist | 미디어·PCG 모듈의 명시적 manifest를 유지한다 | 정적 배포에서 경로, 용량, 출처 검증을 잃지 않는다. 디렉터리 와일드카드 전환은 승인하지 않는다. |
| 3 | 안개 API | `stageFogRange(stageId, phase)`로 확장한다 | 페이즈별 가시성 하한을 하나의 권위 API에서 계산한다. |
| 4 | `layoutVersion` 불일치 | 사용자 고지 후 해당 스테이지를 재시작한다 | 시드 재현성과 저장 복잡도 사이에서 5–8분 원정 손실을 허용 가능한 비용으로 둔다. |
| 5 | 무효화된 기존 테스트 | 피벗 사유와 대체 픽스처를 기록한 뒤에만 교체한다 | `skip`으로 남겨 거짓 녹색을 만들지 않고, 조용히 삭제하지도 않는다. |
| 6 | 동료 시스템 | 자동 추종 + 최종 보상 정예 추출만 유지한다 | 입력 과부하를 막되, 수집·캠페인 동기를 보존한다. |

### 세로 슬라이스 통제점

1. `engineering/migration-map.md#9`의 슬라이스 1(이동·카메라)과 슬라이스 2(전투 동사)를 먼저 완성한다.
2. 슬라이스 2 뒤 **사람 플레이 판정**을 한다. “때리는 느낌”이 부족하면 PCG·보스·VFX·HUD의 후속 슬라이스는 진행하지 않는다.
3. 사람 판정 통과 후에만 적 1종 → 페이즈 골격 → 보스 패턴 1종 → PCG → 성장·저장 → 나머지 콘텐츠 순서로 진행한다.
4. VFX, HUD, 로비 서사는 전달할 시스템이 존재한 뒤에만 구현한다.
5. 빅웨이브 성능, 전체 여정 QA, 배포는 마지막이다.

### 증거와 게이트 상태

- 현재 설계값은 전부 `[TARGET]`이다. 계산 검산은 내부 정합성일 뿐 재미·성능·사람 사용성의 증거가 아니다.
- 기존 27초 자동전투의 G2/G3/G7 결과는 5–8분 액션 제품의 증거로 재사용하지 않는다.
- G2/G3/G4/G6/G7/G8은 액션 제품 기준으로 재정의 또는 재측정이 필요하다. 이 결정으로 PASS가 된 게이트는 없다.
- Cinder Span 빅웨이브의 성능 목표는 동시 적 60, p95 프레임 시간 16.7 ms 이하, VFX high/balanced/low 상한 120/70/35이다. 이는 `[TARGET]`이다.

근거: `production/task-manifest.md#3`–`#5`, `design/master-gdd-delta.md#10`, `design/master-numeric-contract.md#9`.

### 문서 정합성 조치

- 새 제품 SSOT: `design/onslaught-action-product-contract.md`.
- 기존 세부 스펙은 각 영역의 권위 문서로 유지한다. 새 제품 계약은 수치·알고리즘을 복제하지 않는다.
- README의 공개 제품 설명은 슬라이스 2 사람 플레이 판정 뒤 갱신한다. 구현되지 않은 목표를 현재 기능처럼 표기하지 않는다.
- `design/encounter-wave-spec.md#1`의 페이즈별 Shard 보상은 마스터 계약의 `0/1/1/2/1/3`, 총 8로 정정했다. `master-gdd-delta.md`와 `engineering/migration-map.md`의 스탯 상한도 `19`로 정정했다.
---

## D-20260730-01 — ooo 스펙 정제안의 런타임 적용 범위 확정

`_workspace/current/refinement-prompts/README.md`(프롬프트 #1–#5)와
`design/per-stage-camera-framing-addendum.md`가 이번 사이클의 개선 스펙이다.
이 중 **에셋 재생성 없이 런타임만으로 완결되는 항목**을 이번에 구현하고,
Blender 리타겟/신규 FBX가 선행되어야 하는 항목은 명시적으로 미착수로 남긴다.

| 스펙 | 처리 | 근거 |
|---|---|---|
| 프롬프트 #5 §1 (속도·크기 차별화) | **구현** — `motionProfileFor(targetHeight)`가 mesh 높이 비율의 함수로 `locomotionRate`/`oneShotRate`/`reactionArcScale`을 산출하고, 믹서 `setEffectiveTimeScale`로만 적용 | `RUNTIME_ANIMATION_CONTRACT.md#8` |
| 프롬프트 #2 (방향×레벨 히트 리액션) | **런타임 라우팅만 구현** — `triggerHitReaction()`이 공격자 위치를 타겟 프레임으로 환산해 `hit_<dir>`/`bighit_<dir>` 클립을 선택하고, 클립이 없으면 평면 키로 결정적 폴백 | `RUNTIME_ANIMATION_CONTRACT.md#8` |
| 카메라 애드덤 §1/§3/§4 | **구현** — `STAGE_CAMERA_ENVELOPES` + `stageZoomClamp()`/`stagePitchRange()`/`stageFinaleLookOffset()` | `design/per-stage-camera-framing-addendum.md#5` |
| 프롬프트 #1/#4, #5 §2–§3 | **미착수** — 신규 Mixamo FBX 확보와 `retarget-ingame-motion-blender.py`의 per-bone proportional 개편이 선행 조건 | `refinement-prompts/README.md#1`, `#4` |
| 카메라 애드덤 §2 (occlusion fade) | **미착수** — `resolveStageTerrain()`에 `occlusionFadeProps` 레지스트리가 아직 없다 | `design/per-stage-camera-framing-addendum.md#5` |

### 증거

- `node --test tests/stage-framing-and-motion-profile.test.mjs` → 7/7 통과 (신규 계약 테스트).
- `node --test` 렌더러 인접 9개 파일(`camera-slice-contract`, `combat-presentation-contract`,
  `defense-renderer-contract`, `ingame-motion-pack`, `overlay-runtime-qa`,
  `realtime-motion-routing`, `runtime-visual-assets`, `world-presentation-contract`,
  `stage-framing-and-motion-profile`) → 98/98 통과.
- **[OBSERVED] 선행 결함**: `tests/defense-asset-manifest.test.mjs`의
  `defense asset manifest has literal, complete dispositions when generated`는
  본 변경을 stash한 상태에서도 동일하게 실패한다(`assets/motion/bench/**`의
  FBX 다수가 작업 트리에 없음). 이번 변경과 무관한 기존 상태이며 수정하지 않았다.
- 시뮬레이션 결정성 불변식은 유지된다. 추가된 코드는 전부 프레젠테이션 계층이며
  `getRunDigest()` 입력에 쓰지 않는다.

---

## D-20260730-02 — 오디오를 하이브리드 샘플-절차 모드로 전환

```yaml
decision_id: D-20260730-02
date: 2026-07-30
status: IMPLEMENTED_RUNTIME_VERIFIED
scope: defense-audio.js 재생 계층, ElevenLabs 생성 파이프라인, 큐/variant 샘플 자산
evidence_state: "[OBSERVED] — 계약 테스트 통과. 브라우저 청감 레벨 튜닝은 미측정"
```

### 결정

**절차 오실레이터 단일 모드를 유지-폴백으로 강등하고, Abyssal Lantern 컨셉으로
ElevenLabs sound-generation에서 재생성한 샘플(원샷 33종 + 스테이지 루프 6종)을
동일 큐 어휘 위에 옵트인 하이브리드로 얹는다.** 큐 ID·variant 키·우선순위·refractory·
보이스 캡·reduced-motion·내레이션 선점 계약은 전부 불변이다.

| 사안 | 결정 | 이유 |
|---|---|---|
| 재생 경로 | `sampleMapUrl` 옵트인, 큐 단위 자동 폴백 | 오프라인·fetch/decode 부재·파일 누락에서도 기존 절차 경로가 그대로 성립 — 테스트 mock 무변경 |
| 샘플 키 | 런타임 `variantKey`/`cueId`와 1:1 (`index.json`) | 신규 큐는 절차 재생이 기본값, 샘플 추가는 플랜 1엔트리 + 재생성 1회 |
| BGM/앰비언스 | 스테이지별 루프 버퍼가 `SOUNDSCAPE_STATES` gain/pitch 믹스를 `playbackRate`/gain 램프로 소비 | 6상태 사운드스케이프 의미론 보존, 스테이지 전환은 루프 스왑 |
| API 키 | 생성 시점 전용 (`.env.game-audio`, 커밋 금지) | 런타임 무의존 — 정적 Pages 배포 계약 유지 |
| sw.js precache | mp3 39종(2.0MB)을 CORE_ASSETS에 넣지 않음 | 설치 비대 방지; 일반 fetch 경로의 런타임 캐시로 충분, 실패 시 절차 폴백 |

### 소유 경계 (cycle 9/10 병행 세션)

- cycle 10이 소유한 **오디오 설계 결정**(발소리 un-shadowing, 던전 신규 큐, BGM 상태 확장)은
  이 결정의 대상이 아니다. 이 결정은 그 설계가 올라탈 **재생 인프라**만 제공한다.
  드리프트 고지: `design/audio-feedback-dungeon-spec.md` §0.1, `engineering/runtime-surface-maps/map-ui-audio.md` 상단.
- `MOVE = silentPolicy` 유지. `movement-step` 샘플은 생성되어 있으나 cycle 10의 설계 결정 전까지 비활성.

### 증거

- `tests/audio-sample-hybrid.test.mjs` 6/6 (기본 생성 네트워크 0, 버퍼 우선 재생, variant 해석,
  루프 리믹스/스왑, fetch 실패 폴백, 배포 index↔파일 무결성·큐 계약 커버리지).
- `audio-feedback-runtime` 17/17, `battle-session-cutscene-audio` 8/8,
  `defense-observers-contract`+`defense-public-contract-regressions`+`release-closure` 20/20.
- 생성 산출: 39/39 성공, `assets/audio/elevenlabs/` 2.0MB, 플랜 `assets/audio/elevenlabs-sound-plan.json`,
  재생성 스크립트 `scripts/generate-defense-audio.mjs` (`--force`/`--only`/`--dry-run`).
- 매니페스트: `assets/audio/defense-audio-manifest.json` schemaVersion 3 `hybrid-sample-procedural`.
- **미측정**: 실브라우저 청감 레벨 밸런스(마스터 0.055 하 샘플 게인). `index.json` 게인 수치만으로
  조정 가능하며 코드 변경 불요. 이 항목이 끝나기 전까지 G4 오디오 측면 PASS를 주장하지 않는다.

---

## D-20260730-03 — 광역 타격(`aoe-burst`) 런타임 실장과 반경 진실성 VFX

```yaml
decision_id: D-20260730-03
date: 2026-07-30
status: IMPLEMENTED_CONTRACT_VERIFIED
scope: SKILLS aoe-burst 2종, 밀도 비례 피해 규칙, 스킬 광역 VFX, SKILL_CAST 앵커 결함
evidence_state: "[OBSERVED] — 계약 테스트·결정성 게이트 통과. 사람 플레이 판정 미실시"
authority: design/skill-and-growth-spec.md §2.2, design/master-numeric-contract.md
```

### 결정

**핵앤슬래시의 타격 재미를 광역 스킬 축으로 세운다.** 이미 저작되어 있었으나 런타임에
실리지 않은 `aoe-burst`(광역 파괴) 카테고리를 기존 `SKILLS` 형태 안에서 2종 실장하고,
광역 연출이 **실제 피해 반경을 그리도록** 고친다.

| 사안 | 결정 | 근거 |
|---|---|---|
| 신규 스킬 | `ash-nova`(1400/480/r3600), `regents-verdict`(적 수×400 상한12/900/r5000) | `skill-and-growth-spec.md` §2.2 저작값 그대로 |
| 빅웨이브 답 | `regents-verdict`는 **밀도가 곧 피해** — 단일 대상 400, 12기 4800 | 사용자 요구("빅웨이브를 해결하는 주요 이펙트")의 기계적 실체 |
| 반경 연출 | 고정 상수 glow 폐기 → `SKILLS[id].radius` 참조 링 | 기존 표시율 50%(`grave-pulse`)·15%(`shadow-step`) 실측 |
| 밀도 결합 | 같은 `castInstanceId`의 `SKILL_RESOLVED_DAMAGE` 수로 호·밝기·카메라 임펄스 스케일 | 신규 시뮬레이션 필드 0개, 동결 스냅샷만 읽음 |
| 형상 | 환형(annulus) + 얇은 호. **원반 금지** | r=5.83에서 원반 106.8 world² 대비 환형 12.4 world² (12%) |
| 미실장 | `veil-lance`/`drowned-toll`/`starless-collapse` | 직선 형상·다단 타이밍·상태이상이라는 신규 시뮬레이션 원시연산 선행 필요 |

### 선행 결함 수정 (본 세션 신규 아님)

`effectAnchor()`에 `SKILL_CAST` 케이스가 없어 **모든 스킬 캐스트 VFX가 도달 불가능한
죽은 코드였다.** 커맨더(시전 원점)에 앵커하도록 수정했고, 이로써 기존 5종도 처음으로
저작된 연출을 표시한다. 상세: `design/wide-area-hit-aoe-burst-spec.md` §6.

### 소유 경계

cycle 10이 소유한 VFX 3종(드롭·스폰·지형 변형)은 건드리지 않았다. 신규 이벤트 타입 0개.
`SKILLS` → `SKILL_CATEGORIES` 20종 전면 교체(저장 스키마 v2 동반)는 성장 레인 소유로 남긴다.

### 증거

- `scripts/verify-cycle9-digest-identity.mjs` **PASS** (seed 1/17/4242 sha256 불변, commander 키 26).
  기준선 프로브는 300 tick·이동 전용이라 성장 제안에 도달하지 않으므로(`growthOffer: null`)
  스킬 id 추가가 해시를 움직이지 않는다. **레벨업에 도달하는 더 긴 런에서는 제안 조합이
  바뀐다** — 제안 가능 콘텐츠 추가의 필연이며 기준선의 목적(필드 누출 탐지)과 무관하다.
- `tests/aoe-burst-wide-hit-contract.test.mjs` **12/12** (신규)
- `defense-run-simulation` 27/27, 렌더러 5개 스위트 69/69, observers+regressions 16/16
- 라이브 밀도 규칙: 12,492 캐스트 전부 `min(n,12)×400` 준수

### 미해결 — 수치 권위 판정 필요

**`targetCap: 12`가 현재 런타임에서 도달 불가.** 실측 결과 반경 5000 안 동시 생존
최대치는 **7기**(seed 23, depth 0/4/8, 14000 tick). 설계 전제는 "밀도 60 중 12명"이었다.
`commitmentCap`/스폰 페이싱을 올릴지, 상한을 실측에 맞춰 내릴지는
`master-numeric-contract.md` 권위 사안이므로 본 세션이 단독 결정하지 않았다.

---

## D-20260730-04 — 빅웨이브 동시성 상승 (D-20260730-03 §5.1 해소)

```yaml
decision_id: D-20260730-04
date: 2026-07-30
status: IMPLEMENTED_MEASURED
scope: 빅웨이브 동시 적 상한 / 커밋 인원 / 큐 배출 속도 (kind:"big" 한정)
supersedes_open_item: D-20260730-03 "targetCap 12 도달 불가"
evidence_state: "[OBSERVED] — 실측·결정성 통과. p95 프레임 시간과 승률은 미측정"
```

### 결정

**`kind: "big"` 웨이브에만 적용되는 상승 등급을 도입한다.** 평시 값은 불변.

| 스테이지 | 평시 (동시/커밋/간격) | 빅웨이브 |
|---|---|---|
| `cinder-span` | 8 / 3 / 18 | 22 / 7 / 5 |
| `abyss-chancel` | 9 / 4 / 24 | 24 / 8 / 6 |
| `echo-throne` | 10 / 4 / 15 | 26 / 8 / 4 |

지시는 `commitmentCap`이었으나 실제 구속 조건은 `maxConcurrentEnemies`(스폰 차단)였고,
상한만 올리면 `spawnIntervalTicks`가 큐를 찔끔 흘려 상한이 놀았다(상한 22에 실측 14).
**세 레버를 함께 올려야 빅웨이브가 성립한다.**

계약의 BIGWAVE 60은 채택하지 않았다 — §9가 60을 인스턴스드 렌더링에 걸어 두었고 현
렌더러는 액터당 스킨드 GLB 클론이라 draw call 180 예산을 초과한다. **상향은 이 표가
아니라 인스턴스드 렌더링에 묶여 있다.**

### 결과 [OBSERVED]

- `targetCap 12` **도달**: `cinder-span` 13, `abyss-chancel` 12 (변경 전 각 7)
- `echo-throne` 9 — 상한 문제 아님. `ranged`가 `projectileRange 6000`에서 정지해 반경
  5000 밖에 머문다. 조합 문제로 별도 판정 필요.
- 광역기 A/B: 캐스트 시 첨두 밀도 13→9 / 12→10 / 9→6. 군중이 실제로 지워진다.

### 증거

- `scripts/verify-cycle9-digest-identity.mjs` **PASS** — 상승은 `kind:"big"`(최초 tick
  2040)에서만 발동, 기준선 프로브는 300 tick이라 미진입. 스냅샷 직렬화되는 평시 값 불변.
- `tests/aoe-burst-wide-hit-contract.test.mjs` **14/14** (신규 2건: 등급 계약 + 라이브 초과 검증)
- `defense-run-simulation` 27/27, observers+regressions+release-closure 20/20

### 정정 — 이전 "실측 7"은 측정 오류

`advanceDefenseRun()`은 `growthOffer`가 열린 채 선택이 없으면 `break`하여 런을 해당 tick에
영구 정지시킨다. 이전 프로브가 성장 제안을 응답하지 않아 웨이브가 2개에서 멈췄고 big
웨이브에 도달한 적이 없었다. D-20260730-03 §미해결의 "밀도 상한 7"은 이 결함의 산물이다.

### 미해결

- 빅웨이브 16기 동시 + 광역 VFX의 **p95 프레임 시간 미측정** (계약 ≤16.7 ms, 비인스턴스드 렌더러).
- 봇 런은 tick ~19200 압박 데드라인에서 DEFEAT하나 **변경 전후 동일 지점**이다. 승률은 사람 플레이 게이트 소관.
- `echo-throne` 원거리 조합으로 인한 밀도 미달 — 조합/반경 판정 필요 (수치 권위).

---

## D-20260731-01 — pull 동기화 시 이 워크트리의 미커밋 초안 처리

`main`이 52 커밋 앞선 상태(`7a98515` → `e240809`, PR #10–#17)에서 pull을 수행했다.
이 워크트리에는 커밋되지 않은 tracked 수정 16개가 있었고, 그중 9개가 유입분과 충돌했다.

### 처리

| 파일 | 처리 | 근거 |
|---|---|---|
| `app.js`, `styles.css`, `defense-catalog.js`, `defense-run-simulation.js` | **upstream 채택** | 로컬 초안은 상류가 이미 다른 설계로 대체함 (아래 증거) |
| `_workspace/current/qa/stage-runtime-proof/*.png`, `stage-runtime-summary.json` | **upstream 채택** | cycle 9/10 실측본이 최신 |
| `.gitignore` | **양쪽 병합** — upstream 규칙 + 로컬의 `.vercel`, `.env*` | 두 항목은 상류에 없고, 작업 트리에 실제로 `.vercel/`·`.env.local`이 존재해 유출 방지가 필요 |
| `llm-wiki/**`, `assets/mesh/boss/**/*.glb`, `qa/evidence/gates/G2/*.receipt.json` | **로컬 유지** | 상류가 건드리지 않아 충돌 없음. 다른 세션 작업이므로 그대로 둔다 |

### 대체 판정의 증거 [OBSERVED]

- `defense-run-simulation.js`: 로컬 초안은 `FSM.*` 상태기계(perceive/decide/stagger, 387줄)를 담고 있으나,
  상류 파일에는 `fsmState`/`FSM.` 출현이 **0회**이고 대신 `AI_RESPONSE_PATTERNS` + always-area 전투(PR #11)가 있다.
  같은 문제를 푸는 **평행 설계**이며 상류 쪽이 테스트·증거와 함께 머지되었다.
- `app.js`: 로컬은 군단 정원 `loadout.length}/3`으로 고정. 상류 cycle 9는 정원 3 → 10으로 상향했다.
- `styles.css` / `app.js`의 조이스틱·`#skill-actions` 초안은 상류 cycle 9/10 HUD 오버홀에 이미 포함(각각 15/31회 매칭).

### 복구 경로 (초안은 파기되지 않음)

- `git stash list` → `stash@{0}` "pre-pull-sync 20260731T011927Z"
- `~/.abyssal-pull-backup/uncommitted-tracked-20260731T011927Z.patch` (+ `-binary-` 버전)
- 태그 `pre-pull-sync-20260731T011927Z` = `7a98515`

### 동기화 후 검증 [OBSERVED]

- `node --check` — `battle-realtime-three.js`, `app.js`, `defense-run-simulation.js` 통과.
- `node --test` 11개 파일 → **116/116 통과**
  (`stage-framing-and-motion-profile`, `camera-slice-contract`, `realtime-motion-routing`,
  `overlay-runtime-qa`, `defense-asset-manifest`, `area-combat-model`,
  `aoe-burst-wide-hit-contract`, `audio-sample-hybrid`, `combat-presentation-contract`,
  `world-presentation-contract`, `ingame-motion-pack`).
- D-20260730-01의 모션 프로파일·방향 리액션·스테이지 카메라 봉투는 상류 리라이트 이후에도 유지된다.

---

## D-20260802-AON-01 — 상세 구현 워커 격리 규칙

```yaml
decision_id: D-20260802-AON-01
date: 2026-08-02
status: APPLIES_FROM_NEXT_IMPLEMENTATION
scope: abbysal-oneline 2D/2.5D, PCG, 난이도, GitHub Pages 관련 상세 구현
evidence_state: "[OBSERVED] gjc v0.12.5 --help 확인; 아직 이 규칙으로 실행된 구현 워커 없음"
```

### 결정

**GO — 이후 상세 구현은 `gjc --tmux --worktree`로 독립 worktree와 tmux 세션을 가진 구현 워커에게 위임한다.**

- 워커마다 명시적 파일 소유권, 검증 명령, handoff artifact를 지정한다. 하나의 shared worktree에서 여러 구현 워커를 실행하지 않는다.
- `--tmux`는 interactive launcher이므로 parent가 반환값을 기다리는 subagent API가 아니다. 실행 세션의 확인·재접속은 `gjc session`으로 한다.
- 비대화형 분석/짧은 결과만 필요한 경우에만 `gjc -p`를 사용한다. 탐색·리뷰·증거 수집은 이 규칙과 충돌하지 않는 별도 read-only worker로 둘 수 있다.
- [TARGET] 이 결정은 다음 사용자 인터뷰에서 Stage 1–3 범위와 acceptance criteria가 동결된 뒤의 구현에 적용한다. 이 기록 자체는 코드·밸런스·Pages 배포를 완료했다는 뜻이 아니다.

---

## D-20260804-NAV-01 — 시작 네비게이션·승패 판독성 슬라이스 스펙 승인

```yaml
decision_id: D-20260804-NAV-01
date: 2026-08-04
status: SPEC_APPROVED_FOR_IMPLEMENTATION
scope: index.html → sprite-2-5d.js "어비스 랜턴 · 잿불 법정" 아레나의 시작 안내·승패 상태·경계 가시화
source_packet: 사용자 요청 — "승리/실패를 알 수 없다, 시작 네비게이션(이동·공격·진입금지) 필요"
evidence_state: "[OBSERVED] 코드 결함 3종 확인(F1 승리조건 부재/F2 시작안내 부재/F3 금지구역 불실재). [TARGET] 스펙 승인이지 구현·게이트 통과 아님"
```

### 결정

**GO — 대상 게임을 `sprite-2-5d.js`(단일 화면 2.5D 아레나)로 확정하고, UX 판독성 슬라이스 1사이클을 승인한다.** 컨셉 시프트가 아니라 기존 메커니즘을 가르치고 승패를 명시하는 얇은 상태기계+UI 추가다.

### 확인된 결함 [OBSERVED]

| # | 결함 | 근거 |
|---|---|---|
| F1 | 승리 조건 부재 — `updateWave` 무한 `startWave(wave+1)`, 종료는 사망뿐, 패널 항상 패배 카피 | `sprite-2-5d.js:1072-1077`, `:740-751`, `index.html:44-59` |
| F2 | 시작 안내 부재 — `boot()`가 즉시 웨이브1 진입, 온스크린 오버레이 없음 | `sprite-2-5d.js:1734-1755`, `:773-804` |
| F3 | 진입 금지 구역 불실재 — 별도 랜턴/게이트 액터 없음(HUD 내구도=`player.health`), 경계 미렌더 | `clampToArena:446-459`, `render:1465-1519`, `updateEnemy:956-1030` |

### 확정 사항

| 사안 | 결정 | 근거 |
|---|---|---|
| 승리 정의 | `TARGET_WAVE=10` 확보 시 승리(`endRun` outcome 분기) | `design/navigation-onboarding-spec.md#2` |
| 진입 금지 구역 | 2-tier — Tier 1(당신=랜턴 교육 + 경계 링·스폰 예고·포위 경보 가시화) 즉시 채택 / Tier 2(중앙 코어 실물 방어) 옵션·후행 | `design/navigation-onboarding-spec.md#4` |
| 시작 안내 | `briefing` 모드 + 5블록 오버레이(이동·공격·스킬·목표·사수), skip 지속 | `ui/navigation-overlay-ia.md#2`, `#3` |
| 자산·결정성 | 신규 파일 0(DOM/Canvas 프리미티브), `RUN_DIGEST_KEY`는 additive `outcome`만 | `engineering/navigation-onboarding-implementation.md#6` |

### 산출물

intake `production-brief-navigation-onboarding.md` · design `navigation-onboarding-spec.md` · ui `navigation-overlay-ia.md` · engineering `navigation-onboarding-implementation.md` · qa `navigation-onboarding-gates.md`(게이트 N1–N16).

- [TARGET] 이 결정은 스펙 승인이다. 구현·N1–N16 게이트 측정·사람 플레이 판정은 후행이다.
