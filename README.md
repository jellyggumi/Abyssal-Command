# Abyssal Surge

[![Deploy to Pages](https://github.com/jellyggumi/Abyssal-Command/actions/workflows/static.yml/badge.svg)](https://github.com/jellyggumi/Abyssal-Command/actions/workflows/static.yml)
[![GitHub Pages](https://img.shields.io/github/deployments/jellyggumi/Abyssal-Command/github-pages?label=GitHub%20Pages)](https://jellyggumi.github.io/Abyssal-Command/)

**Abyssal Surge**는 심연 세계관의 모바일 우선 싱글플레이 디펜스 서바이버 캠페인입니다. 플레이어는 Dusk Warden을 이동시키고 자동 공격으로 적군을 막으며, 런마다 스킬을 선택하고 정예를 추출해 영구 동료로 성장시킵니다. 전장은 실시간 3D(Three.js/WebGL) 씬으로 렌더링되며, 카메라는 커맨더를 따라가는 고정 앵글 버드아이 시점을 유지합니다. WebGL을 사용할 수 없는 환경에서는 동일한 스냅샷 계약을 공유하는 Canvas 2D 대체 어댑터가 표시를 이어갑니다. 캠페인은 `Cinder Span → Abyss Chancel → Echo Throne`의 세 구역과 세 보스로 끝납니다.

## 플레이 계약

- 전장은 모바일 화면을 가득 쓰는 full-bleed Canvas입니다. HUD는 화면 가장자리에 배치하여 전장과 적의 위험 신호를 가리지 않습니다.
- 브라우저가 허용하는 범위에서 fullscreen과 landscape lock을 자동 요청합니다. 잠금할 수 없는 세로 화면에서는 회전 안내를 띄우지 않고, 시계 방향 논리 가로 화면을 세로 뷰포트에 표시합니다.
- 이동 입력 외에 기본 공격은 자동입니다. XP를 얻을 때마다 현재 런에만 적용되는 스킬 제안 중 하나를 선택합니다.
- 캠페인 진행은 워든 스탯 포인트, 5노드 스킬 트리, 5단계 장비 티어(무기/방어구/장신구), 스테이지 클리어 시퀀스로 해금되는 특성(trait)으로 영구 성장합니다. 스탯 포인트와 스킬 트리는 같은 Echo Core 예산을 공유합니다.
- 정예 적은 처치 뒤 추출할 수 있으며, 추출한 동료는 영구 캠페인 진행으로 남습니다. 동료는 전열(FRONT, 최대 2)/후열(BACK) 포메이션에 배치되어 역할(선봉/타격대/지원)별 패시브를 받습니다.
- 보스를 쓰러뜨리면 다음 구역으로 진행합니다. Stage 3 `Gate Sovereign` 승리가 캠페인을 마칩니다.

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

로비 → 인게임 HUD → 버튼/컨트롤에 쓰이는 16개 UI 리소스는 `god-tibo-imagen`으로 생성해
`assets/images/battle/ui/`에 배치하며, 생성 근거와 실측 증거는
[UI 리소스 계약](_workspace/current/ui/ui-asset-refresh-routing-and-contract.md)에 기록합니다.

> **문서 상태 안내.** 이전에 이 자리에서 참조하던 `docs/abyssal-command-defense-survivor-design.md`와
> `docs/abyssal-surge-production-cycle.md`는 현재 저장소에 없습니다. 위 문단의 플레이·기술
> 계약이 현재 배포 빌드에 대한 유효한 요약입니다.

## 계획 중인 액션 전환

`_workspace/current/`은 최신 액션 온슬로트 설계의 단일 작업 폴더다. 아래는 `[TARGET]`이며
현재 배포 빌드에는 아직 반영되지 않았다. 세 구역·세 보스 메시 계약과 UI 외 `assets/images/battle/`
배제는 이 설계의 변경 불가 자원 경계다.

| 축 | 현재 배포 빌드 | 액션 전환 목표 |
|---|---|---|
| 장르 | 디펜스 서바이버 | 액션 핵앤슬래시 로그라이트 |
| 조작 | 이동만, 전투 자동 | 이동 + 공격 3동사 + 액티브 스킬 |
| 한 판 길이 | 약 27초 | 300–480초 |
| 월드 | 저밀도 전장 장식 | 넓은 평면 메쉬 지형 + 시드 기반 셀 배치 |
| 캠페인 | `Cinder Span → Abyss Chancel → Echo Throne` | 동일한 3구역·3보스 서사 |
| 연출 | HUD·단일 전장 카메라 | 카메라 키프레임, GLB 애니메이션, `assets/motion/` VFX |

제품·수치·월드·보스·로비 서사의 권위 문서는 각각
[제품 계약](_workspace/current/design/onslaught-action-product-contract.md),
[마스터 델타](_workspace/current/design/master-gdd-delta.md),
[스테이지 레이아웃](_workspace/current/design/pcg-stage-layout-spec.md),
[보스 패턴](_workspace/current/design/boss-pattern-spec.md),
[로비 프레젠테이션](_workspace/current/design/lobby-story-presentation-spec.md)이다.
게이트 상태와 미해결 결정은 [태스크 매니페스트](_workspace/current/production/task-manifest.md)에 기록한다.

**액션 전환 구현 게이트는 아직 통과하지 않았다.** 현행 런타임은 위의 메시·이미지 경계와
세 구역 카탈로그만 반영한다.

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

### UI 리소스 레이어

`styles.css`는 두 계열의 속성으로 생성 리소스를 바인딩합니다. `[data-ui-icon]`은 요소
자체가 아이콘인 경우(독 레일 탭, 브랜드 마크, 닫기, 통화 칩, 출정 셰브런)이고,
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

`main`에 푸시하면 [Deploy static content to Pages](.github/workflows/static.yml) 워크플로가 실행되도록 구성되어 있습니다. 현재 저장소의 Pages URL은 https://jellyggumi.github.io/Abyssal-Command/ 입니다. 저장소가 `Abyssal-Surge`로 실제 rename된 뒤에는 이 링크와 배지를 함께 갱신해야 합니다.

배포 아티팩트는 커밋된 런타임 파일 allowlist에서만 생성됩니다. `defense-audio.js`, 2.5D 전투 스프라이트 프레임, 위 플레이 영상은 allowlist에 포함되며, 런타임 코드와 전투 프레임은 service-worker 캐시에도 포함됩니다. 로컬 작업 트리의 미추적 파일이나 allowlist 밖 파일은 Pages에 포함되지 않습니다. 상단 배지와 GitHub Actions 실행 기록은 실제 배포 상태를 확인하는 근거입니다.

## 저장소 구조

```text
Abyssal-Command/
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
