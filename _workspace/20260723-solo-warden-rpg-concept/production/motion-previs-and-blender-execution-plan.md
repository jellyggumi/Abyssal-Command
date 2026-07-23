# Motion-previs + Blender 실행 플랜 (4종 보스)

## 0) 목표
- `assets/images/battle/pilot/concept-*-boss.png` 4종을 **즉시 모션 레퍼런스**로 전환
  - `concept-sung-hum-boss.png`
  - `concept-human-command-boss.png`
  - `concept-shadow-commander-boss.png`
  - `concept-broken-court-monarch-boss.png`
- 목표 결과물:
  1. 보스별 3–5초 루프 쇼케이스 모션프리비즈 (`.json` 타이밍 테이블 + `.mp4` 저해상도 검수컷)
  2. Blender용 실행 가능한 초기 구간 씬(`.blend`, `.json` 키프레임)
  3. 런타임 흡수 전까지 리그/셋업 한계가 문서화된 제약표

## 1) 산출물 지도
- 개념 프레임
  - `assets/images/battle/pilot/concept-sung-hum-boss.png`
  - `assets/images/battle/pilot/concept-human-command-boss.png`
  - `assets/images/battle/pilot/concept-shadow-commander-boss.png`
  - `assets/images/battle/pilot/concept-broken-court-monarch-boss.png`
- 개념 메타
  - 각 보스별 `.provenance.json` (기존 생성)
- 모션 타이밍 정의
- 모션 프리비즈 액션 파이프라인(액션/변형/키프레임/전이/리타겟/QA)
  - `_workspace/20260723-solo-warden-rpg-concept/production/boss-motion-previs-action-pipeline.json`
  - `_workspace/20260723-solo-warden-rpg-concept/production/qa-gate-log.json`
- Blender 실행 스크립트(비실행형 템플릿)
  - `scripts/boss-motion-previs-blender.py`
- 단계별 실행 노트/체크리스트
  - 본 파일

## 2) 스테이지 정의(직접 진행)

### Stage 0 — 고정 포맷 정렬 (0.5일)
- 리그: `technical-artist-2d5d`, `narrative-cinematics-director`
- 산출: `boss-motion-previs-timing.json` 초안 확정
- 체크:
  - 보스당 180–300프레임(30fps면 3–5초) 루프 정의
  - 루프 인-포인트와 아웃-포인트 일치(시작/종료 각도·근접 높이)
  - #FF00FF 마스크 컷아웃에 과도한 색 번짐 없음

### Stage 1 — 블록킹 모션 스케치 (0.5–1일)
- 리그: `narrative-cinematics-director`
- 산출: key poses only(anticipation, attack-peak, settle)
- 체크:
  - 보스별 최소 6키포즈 고정
  - 첫 키프레임과 루프 종료 키프레임이 형태/축 정합
  - 카메라: 3/4 아이소메트릭 각도 유지

### Stage 2 — 타임시트 정합 및 2D 프레임 판독 (0.5일)
- 리그: `game-production-director` + `technical-artist-2d5d`
- 산출: 타임시트 기준 충돌표
  - 프레임 번호, 포즈명, 회전축, 시각 피로 포인트
- 체크:
  - 보스 실루엣 가독성: 1초당 최소 1회 큰 형태 변화
  - 2.5D 정지컷 판독성 보장(보스 핵심 장비/상징물 분리 가능)

### Stage 3 — Blender Previs 씬 구성 (1일)
- 리그: `game-programmer` 보조 + `technical-artist-2d5d`
- 산출:
  - `assets/models/abyssal-command/abyssal-command-resource-pack.blend` 복제본: `_workspace/.../production/boss_previs_workfile.blend`
  - 기본 카메라/조명/그리드/참조평면 구축
- 체크:
  - 루트 기준점(origin) z=0 정렬
  - 월드 스케일 1BU=1m, 보행/점프/공격 이동 대비 1~3m 범위

### Stage 4 — F-curve 이전 및 샘플 룩데브 (1–2일)
- 리그: `game-programmer`
- 산출:
  - 보스별 `NLA` 애니메이션 스트립(시퀀스)
  - `playblast` 프리뷰(압축 mp4)
- 체크:
  - 프레임 드리프트 < 1px / 240px 구간 기준, 뚜렷한 쉐도우/머티리얼 튐 없음
  - 카메라 이동: 과한 푸티지 흔들림 금지, 6프레임 이상 연속 급정지 없음

### Stage 5 — FX 슬롯 지정 + 픽싱 패스 (0.5일)
- 리그: `game-programmer` + `vfx-designer`
- 산출:
  - FX placeholder 레이어(에너지 리본, 충격파, 바닥 반응)
  - 루프 끝 복귀 애니메이션 보정
- 체크:
  - FX는 보스 실루엣을 가리지 않는 채로 Peak 프레임과 동기화
  - 과도한 번짐/픽셀 번짐 금지(원본 콘셉트 대비 색상 히트맵 손실 10% 이하)

### Stage 6 — 검수/마감 (0.5일)
- 리그: `game-qa`, `game-production-director`
- 산출: 최종 승인 보드
- 체크:
  - `G4` 입장 기준 임시 충족(몰입감 임팩트 점수 >=4/5 목표치)
  - 보스별 루프 2회 연속 재생 시 눈에 띄는 점프 없음
  - 산출물 경로가 `production` 하위로 아카이브

## 3) 즉시 실행형 스크립트(Blender)
- Blender가 없는 환경에서 실행 불가이므로, 로컬에서 아래 순서로 실행.

```bash
# 예시 실행 경로(프로젝트 루트 기준)
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/boss-motion-previs-blender.py -- \
  --blend /Users/jangyoung/orca/Abyssal-Surge/assets/models/abyssal-command/abyssal-command-resource-pack.blend \
  --timeline /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260723-solo-warden-rpg-concept/production/boss-motion-previs-timing.json \
  --outdir /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260723-solo-warden-rpg-concept/production/ \
  --fps 60
```

- 출력 기대치:
  - `boss_previs_workfile.blend`
  - `boss_previs_timings.json` (재산출본)
  - `sung-hum.previs.json`, `human-command.previs.json` 등 각 보스별 sidecar

## 4) 완료 기준
- 보스당 1개 이상 `*.json` 프리비즈 키시트(현재 기본 산출) 존재 (`*.previs.json`, `boss_previs_timings.json`, `boss_previs_workfile.blend`)
- Stage 0~6 체크 항목의 모든 항목이 통과 로그에 남아야 함
- 런타임 통합 전까지 리그·자원 경계가 `runtimeEligible=false`와 함께 명시

## 5) 실패/리스크 대응(문서)
- 프롬프트 일관성 이탈(포즈가 콘셉트와 어긋남) → Stage1 재정의
- 블렌드 호환성 문제(Armature mismatch) → Stage3에서 프록시 리그 교체
- 카메라가 실루엣을 가림 → Stage4에서 카메라 레이어/패스 분리
- 퍼포먼스 저하/재생 불연속 → Stage5에서 keyframe 간격 늘림 + overshoot 감소
## 6) 모션-프리비즈 액션 파이프라인(v2)

### 6.1 대상 액션 정의 (11개)

| 액션 | Loop | 예산(60fps 소스) | 최소 키포즈 | 엔트리/익싯 윈도우 |
|---|---|---|---|---|
| idle | O | 72–180 | 3–5 | 6 / 6 |
| move | O | 48–108 | 4–7 | 6 / 8 |
| run | O | 48–120 | 5–9 | 6 / 8 |
| hit | X | 36–84 | 5–8 | 4 / 10 |
| bighit | X | 54–132 | 6–10 | 4 / 12 |
| attack | X | 54–132 | 6–10 | 5 / 8 |
| critical | X | 42–96 | 5–8 | 8 / 14 |
| avoid | X | 24–72 | 4–7 | 4 / 6 |
| defence | X | 48–114 | 4–7 | 5 / 9 |
| die | X | 45–96(+24 hold) | 4–6 | 8 / 0 |
| show | X | 48–180 | 5–8 | 8 / 10 |

- `bighit`: 임팩트 정점 하드 프레임 4f 고정
- `die`: 종료 프레임은 24f 종료 홀드 포함으로 강제
- `show`: 재생 시작 24f 내 보스 실루엣 정체성 노출 1회 이상
- `critical`: 감속/정지 상태가 공격 유효성 판단에 들어가는 임계 이벤트로 분류

### 6.2 전이 처리(Transition)

- 기본 크로스페이드: 6f, 최대 12f
- 상태 전환 정책:
  - `show→*`(show 제외): 12f 완충 후 전환
  - `avoid`: 3f 빠른 전이
  - `critical→defence/avoid`: 속도 벡터가 0.35 미만일 때 hard-stop 허용
  - `die`: 컷 종료(포함 동작의 다음 프레임 하드 컷)
- 루프 전이 규칙:
  - `idle/move/run`는 시작/끝 포즈 및 페이싱 일치
  - `attack`은 recover-준비 자세를 fallback 루프 프레임으로 반환 가능해야 함
- 전환 게이트:
  - 상태 그래프는 `BossMotionTransition` 시트(`production/boss-motion-previs-action-pipeline.json`의 `transitionMatrix`)로 고정

### 6.3 리타겟 호환성

- 리그 매핑:
  - `sung-hum` / `human-command` / `monarch` → `human`
  - `shadow-commander` → `shadow`
- 공통 필수 본: `hips|spine|chest|neck|head|upperarm/lowerarm/hand(L/R)|thigh/shin/foot(L/R)`
- 추가 본: human(`clavicle`, `cape_*`) / shadow(`cloak_*`, `tail_root`, `jaw`)
- 수동 IK 채널은 FK 캡처 모드에서 제외, 필요 시 프록시 리그로 다운캐스트
- 리타겟 체크:
  - 필수 본 존재
  - 프레임별 변환값이 유한
  - 액션 경계에서 root 이동 연속성 0.03m 이하
  - 클립 마커가 `action::{action}::{variant}` 네이밍 패턴 준수

### 6.4 Stage 게이트(0~6)

각 스테이지는 `production/qa-gate-log.json`에 `status/passCount/failCount/notes`를 남기고, StageN이 모두 통과해야 다음 Stage로 진행한다.

| Stage | 핵심 통과 조건 | 필수 산출물 |
|---|---|---|
| 0 | 파이프라인/프롬프트 스키마 정렬, 11액션 4변형 존재, 키프레임 예산 범위 정합 | `boss-motion-previs-action-pipeline.json`, `boss-concept-prompt-pack.json` |
| 1 | 블로킹 포즈(anticipation/impact/recover) 존재, 실루엣 오버랩 제외, 카메라 2.5D 구도 | 보스별 스케치 키포즈 노트 |
| 2 | 24f 당 major pose 변화 1회 이상, 무빙 액션 바운스/중심 오차 체크 | `boss_motion_previs_timing.json` 타임시트 |
| 3 | Blender 원점/단위 스케일 정합, 프록시 대체 근거 기록 | `boss_previs_workfile.blend` |
| 4 | NLA 라벨/크로스페이드 마커 정합, 루프 드리프트 체크 | 재생 체크로그, `boss_previs_timings.json` |
| 5 | FX 트리거 프레임 정렬, die 2루프 무단절차 점검, show 노출성 검사 | 픽스/플레이블러스트 |
| 6 | Blend/런타임 임포트 스키마 통과, 리타겟맵 존재, `runtimeEligible=false` 표기 | 최종 QA 승인 판정 |

### 6.5 실행 시퀀스

- `pipeline`의 `executionSequencing` 규칙을 따른다.
- Stage 진입/이탈은 `qa-gate-log.json`에 기록(실패 시 보류, 성공 시 다음 Stage 오픈).
- `action::{action}::{variant}` 마커 네이밍과 `frameBudgetSync`(`source60→runtime30`) 규약은 리그 교차 테스트 자동화에서 사용한다.

### 6.6 콘셉트-모션 결합

- pipeline의 `promptSchema`와 `characterPromptProfiles`에서 4개 변형(v01~v04) 템플릿을 추출해:
  - `idle/move/run`은 유지 포즈 중심
  - `attack/hit/bighit/critical`은 임팩트 전 준비·정점·회복 구조
  - `avoid/defence`는 판독성 유지형 회피/방어 구조
  - `die/show`는 종료/연출 정지성 보장 구조로 배치한다.
- `concept/boss ID` 매핑은 pipeline의 `bossAliases`를 사용한다 (`sung-hum|human-command|shadow-commander|monarch` ↔ `sung-hum|player-core|shadow-soldier|monarch`).
