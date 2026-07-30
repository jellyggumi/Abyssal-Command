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
