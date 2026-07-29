# Abyssal Lantern — 심연의 등불

[![Deploy to Pages](https://github.com/jellyggumi/Abyssal-Lantern/actions/workflows/static.yml/badge.svg)](https://github.com/jellyggumi/Abyssal-Lantern/actions/workflows/static.yml)
[![GitHub Pages](https://img.shields.io/github/deployments/jellyggumi/Abyssal-Lantern/github-pages?label=GitHub%20Pages)](https://jellyggumi.github.io/Abyssal-Lantern/)

**Abyssal Lantern**(심연의 등불)은 심연 세계관의 모바일 우선 싱글플레이 액션 온슬로트 캠페인입니다. 마지막 등불을 든 Dusk Warden이 `Cinder Span -> Abyss Chancel -> Echo Throne`의 세 구역을 내려가며 세 보스와 맞섭니다. 플레이어는 워든을 직접 이동·공격하고 런마다 스킬을 선택하며, 쓰러뜨린 정예의 Echo를 회수해 영구 동료로 성장시킵니다. 전장은 실시간 3D(Three.js/WebGL) 씬으로 렌더링되며, 단계별 전술 카메라와 플레이어 오빗·줌 입력을 함께 제공합니다. WebGL을 사용할 수 없는 환경에서는 동일한 스냅샷 계약을 공유하는 Canvas 2D 대체 어댑터가 표시를 이어갑니다.

제목 근거와 인픽션 해설은 [제목 컨셉 근거](_workspace/current/design/title-concept-rationale.md),
서사는 [시놉시스](_workspace/current/design/abyssal-lantern-synopsis.md),
연출 규격은 [이미지 주도 연출 스펙](_workspace/current/design/image-driven-staging-spec.md)에 있습니다.

## 플레이 계약

- 전장은 모바일 화면을 가득 쓰는 full-bleed Canvas입니다. HUD는 화면 가장자리에 배치하여 전장과 적의 위험 신호를 가리지 않습니다.
- 브라우저가 허용하는 범위에서 fullscreen과 landscape lock을 자동 요청합니다. 잠금할 수 없는 세로 화면에서는 회전 안내를 띄우지 않고, 시계 방향 논리 가로 화면을 세로 뷰포트에 표시합니다.
- 이동은 `W/A/S/D` 또는 방향키, 수동 공격은 `Space/J`, 스킬 선택·시전은 숫자키와 HUD 버튼으로 조작합니다. 적절한 표적에는 지원 공격이 이어지며, XP 제안은 현재 런에만 적용됩니다.
- 캠페인 진행은 워든 스탯 포인트, 5노드 스킬 트리, 5단계 장비 티어(무기/방어구/장신구), 스테이지 클리어 시퀀스로 해금되는 특성(trait)으로 영구 성장합니다. 스탯 포인트와 스킬 트리는 같은 Echo Core 예산을 공유합니다.
- 정예 적은 처치 뒤 추출할 수 있으며, 추출한 동료는 영구 캠페인 진행으로 남습니다. 동료는 전열(FRONT, 최대 2)/후열(BACK) 포메이션에 배치되어 역할(선봉/타격대/지원)별 패시브를 받습니다.
- 각 스테이지는 `gate-defense → echo-recovery → growth → occupation → boss-kill → extraction` 순서로 닫힙니다. Stage 3 `Gate Sovereign` 처치 뒤 최종 Echo를 추출하면 캠페인이 완료됩니다.

## 기술 계약

- 전투 규칙은 결정론적 60 Hz 시뮬레이션으로 진행합니다. 같은 저장 상태와 입력 순서는 같은 결과를 재현해야 합니다.
- 진행 데이터는 기기 로컬에 오프라인으로 저장하며, JSON 내보내기/가져오기로 백업과 이동을 지원합니다. 클라우드 동기화나 온라인 멀티플레이는 이 계약에 포함되지 않습니다.
- 전장 투영은 스냅샷 어댑터로 게임 규칙과 분리됩니다. 기본 어댑터(`battle-realtime-three.js`)는 GLB 모델을 로드하는 실제 Three.js 씬 그래프이며, 렌더러 오류나 WebGL 컨텍스트 생성 실패 시 같은 스냅샷 계약의 Canvas 2D 대체 어댑터(`battle-visualizer.js`)가 표시를 이어갑니다.
- reduced motion을 존중하고, 움직임·번쩍임을 줄인 읽기 쉬운 표현을 제공합니다.

캐릭터 소스 메시, 리깅, 모션 클립, 권리 상태와 checksum은
[캐릭터 에셋 파이프라인 위키](docs/character-asset-pipeline.md)에 기록합니다.

### 런타임 메시·모션·VFX 계약

- 플레이어·소환수·일반 적은 공급된 Lantern Reaver 계열의 리타게팅 런타임 GLB를 사용한다. 원본 소스 메시는 `assets/mesh/character/lantern-reaver-character/glb/base_basic_pbr.glb`, 런타임 모션 메시는 `assets/motion/ingame/characters/lantern-reaver/model.glb`이다.
- 일반 적은 `rusher → scout`, `flanker → shade`, `guardian → shadow-soldier-v04`, `ranged → possessed`로 모션 레지스트리에서 선택한다. 11개 액션(`idle`, `move`, `run`, `hit`, `bighit`, `attack`, `critical`, `avoid`, `defence`, `die`, `show`)의 이름·권리·checksum은 [`registry.json`](assets/motion/ingame/characters/registry.json)과 각 캐릭터의 `manifest.json`이 소유한다.
- 세 보스는 모션 대체물이 아니라 공급 메시를 직접 사용한다: `assets/mesh/boss/{s1-cinder-warden,s2-veil-tactician,s3-gate-sovereign}/glb/base_basic_pbr.glb`.
- 전장 장식과 무기는 `assets/mesh/terrain/`, `assets/mesh/prop/`에서, 스테이지·공격 VFX는 `assets/motion/stage-vfx/`에서 해석한다. 전면 HUD와 버튼 외의 `assets/images/battle/` 이미지는 런타임 계약에 포함되지 않는다.

배포 전 character-motion 검증은 아래 명령으로 실행한다.

```bash
python3 _workspace/current/engineering/asset-pipeline/tools/build-character-motion-library-index.py --check
node --test tests/realtime-motion-routing.test.mjs tests/ingame-motion-pack.test.mjs _workspace/current/engineering/asset-pipeline/tests/character-motion-library.test.mjs
```

#### 관절 단위 스킨 웨이트 (joint articulation)

공급된 bind는 한 정점을 본 계층에서 **3–10 edge 떨어진 본들**에 동시에 배분했다. 팔 정점 하나가
어깨·상완·전완·손에 함께 매달리면 어느 관절에서도 접히지 않고 팔 전체가 고무처럼 늘어난다 —
"마디로 동작하지 않는" 원인이다. `scripts/repair-joint-weights.py`가 각 정점의 영향본을 지배본의
1-edge 이웃으로 마스킹하고, 메시 토폴로지 위에서 완화(relax)해 falloff를 연속으로 유지한 뒤
재정규화한다. rest pose는 정의상 불변이다: rest에서 모든 joint matrix가 항등이므로 합이 1.0인
웨이트 집합은 원래 정점을 그대로 재현한다 (실측: before/after GLB `POSITION` 최대 차이 **0.0**).

`scripts/gate-joint-weight-repair.py`가 자산별로 3개 게이트를 강제한다 — spread는 0, seam은 그
자산 자신의 이전 값 이하, 단일 영향 정점은 메시의 0.5% 이하. 게이트를 통과하지 못한 자산은
**공급 바이트 그대로 남긴다**(반쯤 수리된 자산이 미수리 자산보다 나쁘다). 실측 결과는
11개 중 **9개 통과**이며, `broken-court-monarch-boss`와 `ember-cohort`는 융착된 망토 지오메트리
때문에 seam 게이트에 도달하지 못해 손대지 않았다. 이 둘의 진짜 해법은 리웨이팅이 아니라
기하 분리이며 `scripts/rig-character-asset-blender.py` 소관이다.

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/measure-joint-articulation.py   # 측정
python3 scripts/gate-joint-weight-repair.py --check                                            # 게이트 현황
```

로비 → 인게임 HUD → 버튼/컨트롤에 쓰이는 16개 UI 리소스는 `god-tibo-imagen`으로 생성해
`assets/images/battle/ui/`에 배치하며, 생성 근거와 실측 증거는
[UI 리소스 계약](_workspace/current/ui/ui-asset-refresh-routing-and-contract.md)에 기록합니다.

> **문서 상태 안내.** 이전에 이 자리에서 참조하던 `docs/abyssal-command-defense-survivor-design.md`와
> `docs/abyssal-surge-production-cycle.md`는 현재 저장소에 없습니다. 위 문단의 플레이·기술
> 계약이 현재 배포 빌드에 대한 유효한 요약입니다.

## 구현된 액션 온슬로트

`_workspace/current/`은 2026-07-29 액션 전환 사이클의 설계·제작·검증 근거를 보존하는
단일 작업 폴더입니다. 현재 배포 빌드는 다음 계약을 구현합니다.

| 축 | 현재 배포 계약 |
|---|---|
| 장르 | 모바일 우선 싱글플레이 액션 온슬로트 로그라이트 |
| 조작 | 이동, 수동 공격, 스탠스 전환, 액티브 스킬, 동료 포메이션 |
| 한 판 길이 | 목적지를 추적하는 봇 기준 스테이지당 3–6분 |
| 월드 | 분리된 지형·소품 GLB를 배치한 `Cinder Span → Abyss Chancel → Echo Throne` |
| 전투 흐름 | 게이트 방어, Echo 회수, 성장, 점령, 보스 처치, 최종 추출 |
| 캐릭터 | 11개 동작 클립을 가진 관절 구동 GLB; 런타임 OBJ/외부 텍스처 경로 없음 |
| 연출 | 단계별 전술 카메라, GLB 키프레임 크로스페이드, 사건 기반 VFX·오디오 |
| UI | full-bleed 전장, 목적·상태·행동을 분리한 반응형 3패널 HUD |

제품·수치·월드·보스·로비 서사의 권위 문서는 각각
[제품 계약](_workspace/current/design/onslaught-action-product-contract.md),
[마스터 델타](_workspace/current/design/master-gdd-delta.md),
[스테이지 레이아웃](_workspace/current/design/pcg-stage-layout-spec.md),
[보스 패턴](_workspace/current/design/boss-pattern-spec.md),
[로비 프레젠테이션](_workspace/current/design/lobby-story-presentation-spec.md)이다.
게이트 상태와 미해결 결정은 [태스크 매니페스트](_workspace/current/production/task-manifest.md)에 기록한다.

액션 전환 구현 게이트는 런타임·에셋·브라우저 계약으로 검증되었으며, 남은 판단과 배포
증거는 [태스크 매니페스트](_workspace/current/production/task-manifest.md)에 기록합니다.

## 로컬 실행

정적 파일을 제공할 수 있는 로컬 HTTP 서버로 저장소 루트를 엽니다. `file://` 직접 실행은 ES module과 오프라인 저장 테스트를 우회하므로 지원하지 않습니다.

```bash
npm ci
python3 -m http.server 4173
# http://127.0.0.1:4173/
```

## 검증

```bash
node --test 'tests/**/*.test.mjs'
node tests/defense-survivor-browser.cjs
node tests/defense-hud-responsive-browser.cjs
node tests/defense-performance-browser.cjs
```

브라우저 계약은 로비 → Cinder Span 전투 → 키보드/터치 이동 → 성장 수치 비교와 선택을 확인합니다. 성능 프로브는 모바일/데스크톱 뷰포트의 DOM 수, 프레임 간격, 입력 피드백을 검사합니다. Pages 아티팩트는 `.github/workflows/static.yml`의 candidate-SHA 런타임 allowlist와 `tests/pages-artifact-smoke.cjs`로 별도 폐쇄 검증합니다.

### 상시 커맨드 덱 (좌우 슬라이드 메뉴 폐기)

좌우 슬라이드 독은 제거했다. 대신 두 개의 고정 컬럼이 `#defense-battle-surface`의 형제로
상시 마운트된다 — 좌측 `#command-deck-left`는 **캐릭터 시트**(상태창 / 인벤토리 / 성장:
스킬·스탯·특성 / 군단), 우측 `#command-deck-right`는 **전황 시트**(출정 쇼케이스 / 브리핑 /
진행 / 요새 기록실)다. open/close 상태도 탭 상태도 없다: 모든 섹션이 로드 시점에 DOM에
존재하므로 **인벤토리와 스킬을 탭 0회·제스처 0회로 사용**한다. 마스트헤드의 점프 칩은 이미
마운트된 섹션으로 스크롤할 뿐, 어떤 것도 노출시키지 않는다. 런이 시작되면 두 덱은 비워져
전투가 화면 전체를 갖고, 캔버스 터치와 겹칠 노드가 남지 않는다.

`#start-defense`는 어느 덱에도 속하지 않는 하단 중앙 FAB이라 로드 직후 상호작용 0회로
도달할 수 있다(브라우저 계약). 연출은 문단이 아니라 화면과 이미지가 담당한다: 생성된 아이콘
플레이트, 메시 포트레이트, 게이지·프레임이 산문을 대체하며, 플레이트가 없으면 이전 글리프로
폴백한다. 설계 근거와 실측 증거는 [덱 전환 계획](_workspace/current/ui/dock-removal-plan.md)에 있다.

### UI 리소스 레이어

`styles.css`는 두 계열의 속성으로 생성 리소스를 바인딩합니다. `[data-ui-icon]`은 요소
자체가 아이콘인 경우(덱 섹션 마크, 점프 칩, 브랜드 마크, 통화 칩, 출정 셰브런)이고,
`[data-ui-icon-lead]`는 요소가 자기 내용을 유지하면서 `::before`로 선행 아이콘만 얻는
경우(HUD 게이지, XP 행, 일시정지 버튼)입니다. 후자는 요소의 레이아웃 역할을 바꾸지 않으므로
기존 HUD 기하 검증이 그대로 유효합니다.

아이콘을 지닌 노드는 모두 이미 `aria-hidden="true"` + 인접 `.sr-only` 라벨이거나 자체
`aria-label`을 갖고 있어, 글리프를 이미지로 교체해도 보조기술 노출은 달라지지 않습니다.
`iconId`가 없으면 이전 글리프로 폴백하므로 리소스 누락이 빈 상자로 나타나지 않습니다.

```bash
python3 scripts/build-ui-icon-assets.py --json    # 컨셉 plate -> 런타임 lane (idempotent)
python3 scripts/build-ui-icon-assets.py --check   # 런타임 리소스 최신 여부만 확인
```

런타임 allowlist는 네 곳이 동시에 일치해야 합니다:
`scripts/defense-runtime-assets.mjs`의 `RETAINED_ASSET_PATHS`,
`assets/defense-asset-manifest.json`, `.github/workflows/static.yml`의
`PAGES_RUNTIME_PATHS`, 그리고 오프라인 부팅을 위한 `sw.js`의 `CORE_ASSETS`입니다.

## 플레이 영상

실제 브라우저에서 새 저장소로 시작해 Cinder Span의 컷신, 전투, Gate/Echo 이후 성장 수치 비교와 선택까지 캡처한 영상은 [`assets/video/abyssal-surge-defense-survivor-smoke.mp4`](assets/video/abyssal-surge-defense-survivor-smoke.mp4)입니다. H.264 1280×720 25fps 영상과 AAC-LC 48kHz 스테레오 사운드트랙을 담은 32.20초 MP4입니다.

## GitHub Pages 배포

`main`에 푸시하면 [Deploy static content to Pages](.github/workflows/static.yml) 워크플로가 실행됩니다. Pages URL은 https://jellyggumi.github.io/Abyssal-Lantern/ 입니다. 저장소는 `Abyssal-Command` → `Abyssal-Lantern`으로 rename을 완료했고, 위 배지와 이 링크는 rename 후 경로를 가리킵니다. service-worker 캐시 접두사(`sw.js`의 `CACHE_PREFIX`)도 `abyssal-lantern-defense-survivor-`로 함께 바뀌었으며, 이 문자열은 `.github/workflows/static.yml`의 검증 grep과 `tests/release-closure.test.mjs`가 같이 참조하므로 **세 곳이 항상 동일해야** 합니다.

개명에서 **의도적으로 제외한 식별자**: `defense-storage.js`의 `abyssal-command-defense`는
localStorage 키이자 IndexedDB 데이터베이스 이름이다. 이 문자열을 바꾸면 기존 플레이어의 저장
데이터가 전부 고아가 된다 — 오프라인 로컬 저장 게임에서 이는 데이터 손실이므로, 사용자에게
보이지 않는 내부 식별자는 예전 이름을 유지한다. `assets/video/abyssal-surge-defense-survivor-smoke.mp4`
역시 실제 파일명이므로 링크와 함께 그대로 둔다.

배포 아티팩트는 커밋된 런타임 파일 allowlist에서만 생성됩니다. `defense-audio.js`, 2.5D 전투 스프라이트 프레임, 위 플레이 영상은 allowlist에 포함되며, 런타임 코드와 전투 프레임은 service-worker 캐시에도 포함됩니다. 로컬 작업 트리의 미추적 파일이나 allowlist 밖 파일은 Pages에 포함되지 않습니다. 상단 배지와 GitHub Actions 실행 기록은 실제 배포 상태를 확인하는 근거입니다.

## 저장소 구조

```text
Abyssal-Lantern/
├── index.html                 # 게임 진입점과 공개 메타데이터
├── app.js                     # 입력, HUD, 런 흐름, 로컬 저장 연결
├── defense-run-simulation.js  # 결정론적 60 Hz 전투 규칙
├── defense-catalog.js         # 스테이지·정예·스킬·아이템·보상 authored 데이터
├── defense-audio.js           # 오프라인 절차적 BGM/효과음 큐
├── defense-telemetry.js       # 용량 제한된 오프라인 런 이벤트 관측·내보내기
├── defense-cutscene.js        # authored 스테이지 컷신 이벤트 정규화
├── campaign-state.js          # 영구 캠페인·동료 진행 상태
├── battle-realtime-three.js   # 기본 Canvas 스냅샷 전장 투영·GLB 메시·모션 해석
├── battle-visualizer.js       # 대체 Canvas 스냅샷 전장 투영
├── lobby-cinematic.js         # 출전 전 로비 연출 카메라·대사 릴레이
├── assets/mesh/               # 지형·캐릭터·보스·소품 공급 메시
├── assets/motion/             # 런타임 캐릭터 모션과 스테이지 VFX
├── assets/images/battle/ui/   # 생성 UI 리소스 (HUD·아이콘·plates)
├── assets/images/battle/pilot/ # 컨셉 lane — 생성 원본 + .provenance.json (런타임 비적격)
├── assets/video/              # 캡처된 플레이 영상
├── docs/                      # 현재 제품·제작 문서
└── tests/                     # 자동화된 테스트 소스
```
