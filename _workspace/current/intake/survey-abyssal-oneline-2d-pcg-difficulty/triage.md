# Triage
- Problem: [OBSERVED] 현재 런타임은 Three.js/WebGL의 `cinder-span`, `abyss-chancel`, `echo-throne` 세 스테이지와 결정론적·read-only renderer projection을 보유한다 (`wiki/concepts/stage-map-composition-pipeline.md#12-20,25`). 이미지 우선 2.5D 표현과 직접 콤보·대시 전투를 보존한 **offline PCG authoring**·난이도 계측 계약은 아직 분리된 완성 설계가 아니다. 기존 난이도 문서는 HP 배율보다 대응 유형·클리어 예산을 우선하지만, 웨이브의 동시 텔레그래프 압력은 아직 직접 측정하지 않는다 (`wiki/concepts/stage-difficulty-and-system-variation.md#185-189`).
- Audience: 모바일 우선의 한 손 조작 플레이어, 키보드/패드/터치 플레이어, 콘텐츠·밸런스 운영자, 그리고 이미지 자산을 제작·승격하는 아트/엔지니어링 담당자.
- Why now: [TARGET] `abbysal-oneline` GitHub Pages 표면에서 세 스테이지 캠페인을 만들기 전에, `cinder-span` → `abyss-chancel` → `echo-throne`의 **계획 band 900–1440초·기준 1080초** gameplay clock(각 Stage 300–480초, 기준 360초)과 Stage별 강제 종막의 **절대 ceiling 540초**(세 Stage 최대 1620초), offline layout proposal→human curation→committed static profile, 이미지 자산 승격, 그리고 같은 source의 난이도 검증 계약을 고정해야 한다. 이는 수치 권위 문서의 설계 목표이며 사람 플레이 측정이 아니다 (`design/master-numeric-contract.md#17-19`).

## Frozen Research Question
[TARGET] Abyssal Surge의 결정론적 Three.js 브라우저 런타임에서, 기존 세계관과 직접 콤보·대시·광역기 조작을 보존하면서 **offline으로 생성·검증·curate한 Stage 1–3 profile**, 이미지 우선 2.5D, 10분을 넘는 세 스테이지 캠페인을 어떻게 구성하고, 상승 추세 위의 사인형 허들 파형을 어떤 계측으로 검증할 것인가?

## Evidence Contract
- Primary mode: `workflow-landscape`; scope: `medium`; output language: Korean; platform map: not required.
- 외부 주장은 원문 URL과 `direct page retrieval` 등 provenance를 붙였다. 리포지터리 수치는 명시적으로 `[OBSERVED]`, 제안 수치는 `[TARGET]` 또는 `[INFERENCE]`로 구분한다. `design/master-numeric-contract.md`가 시간 수치에서 우선하며, 이 조사는 어떤 밸런스·사용성 게이트도 PASS로 바꾸지 않는다.
- [DECISION] 사용자의 `sign 곡선의 파형`은 logistic sigmoid가 아니라 **단조 상승 baseline 위의 bounded half-sine hurdle pulses**다. 구현 전 `difficultyCurveVersion` record는 각 pulse의 `shape: half-sine-v1`, `stageId`, `startTick`, exclusive `endTick`, normalized bounded `amplitude`, `recoveryEndTick`, `expectedResponseType`, `sampleTickStride`, `maxAbsError`를 모두 가져야 한다. `w_i(t)=sin(π·(t-startTick)/(endTick-startTick))` for `startTick ≤ t < endTick`, otherwise `0`; `B(t)`는 단조다. planned/realized는 declared sample ticks에서 비교하며 어느 하나라도 `maxAbsError`를 넘거나 window 밖 pulse가 있으면 실패다. 정확한 schedule 수치는 telemetry calibration 전에는 확정하지 않는다.
- 이 패키지는 리포지터리의 단일 쓰기 경로 규칙에 따라 루트 `.survey/`가 아니라 `_workspace/current/intake/`에 보관한다. 파일명·필수 heading은 survey 계약과 동일하다.
