# Raw capture — 게임 맵 · 3D 던전 · 스테이지 구성용 AI 스킬 / 에이전트 스킬 카탈로그 (2026-07-31)

Immutable capture. Do not edit after writing; corrections belong in
`wiki/sources/2026-07-31-stage-map-composition-skill-catalog.md` or a follow-up capture.

## Capture metadata

- Captured: 2026-07-31
- Capture 1 — operator-supplied document, pasted verbatim into the session that produced
  `prompts/approved/*`. Original author states the source files were
  `3D_Dungeon_Generation_Tools.csv` (sections 4–6) and `~/.agents/skills/*/SKILL.md` (sections 1–3).
- Capture 2 — https://raw.githubusercontent.com/f/prompts.chat/main/README.md (fetched 2026-07-31)
- Capture 3 — https://raw.githubusercontent.com/f/prompts.chat/main/prompts.csv (fetched 2026-07-31,
  116684 lines; three rows excerpted below). Prompt content in that file is CC0 1.0.

---

## Capture 1 — operator document (verbatim)

> **대상:** Abyssal Surge — Abyssal-Command (Three.js / WebGL 웹 게임)
> **범위:** 맵 구성(level layout) · 3D 던전 생성(procedural dungeon) · 스테이지 구성(stage/encounter progression)
> **작성일:** 2026-07-31

이 문서는 (1) 로컬에 설치되어 바로 `/skill:<name>`으로 호출 가능한 **에이전트 스킬**,
(2) 외부 **AI 툴 / 플러그인 / 알고리즘 레퍼런스**를 URL과 함께 정리한다.
각 항목은 "언제 쓰는가 → 무엇을 산출하는가" 기준으로 배치했다.

### 1. 로컬 에이전트 스킬 — 맵 · 스테이지 저작

`~/.agents/skills` 에 설치되어 있으며 세션에서 `/skill:<name>` 으로 즉시 호출된다.
업스트림은 대부분 **MengTo/Skills — agent-skills/game-development** 계열이다.
URL: https://github.com/MengTo/Skills/tree/main/agent-skills/game-development

| 스킬 | 쓰임새 | 산출물 |
|---|---|---|
| `/skill:author-game-levels` | Three.js 플랫 월드 레벨 저작·수정. 이동/카메라 동선, 콜리전·내비게이션, 인카운터 존, 랜드마크, 목표, 픽업, 동기화된 조명, 가시성 | 결정론적 레벨 데이터 + 데스크톱/모바일 플레이스루 검증 |
| `/skill:build-game-map-editor` | 프로덕션 연동 브라우저 맵 에디터 구축(디렉터 뷰). 아웃라이너·레이어·선택·드래그·스냅·인스펙터·카메라, aggro/leash/patrol 오버레이, draft import/export/undo | 버전드 에디터 문서 + 보안 라우트 |
| `/skill:design-game-encounters` | 스테이지 단위 인카운터 설계: 아레나 레이아웃, 적 구성, 스폰 페이싱, 목표, 보스 페이즈, 보상 케이던스 | 인카운터 픽스처 + 난이도 검증 |
| `/skill:underworld-overseer-save-mapper` | 던전 세이브(JSON) → 인터랙티브 던전 맵 HTML. 룸 좌표/DescriptorID 시각화 | 던전 맵 HTML (업스트림: https://github.com/RobThePCGuy/Underworld-Overseer-Save-Mapper) |
| `/skill:build-mobile-threejs-games` | 모바일 웹에서의 스테이지 조작성: 터치 이동, 세이프 에어리어, 포트레이트/랜드스케이프 레이아웃 | 모바일 브라우저 QA 포함 |

### 2. 로컬 에이전트 스킬 — 스테이지 구성 보조(전투/VFX/성능)

| 스킬 | 쓰임새 |
|---|---|
| `/skill:design-action-combat` | 스테이지 내 전투 상태머신 — startup/active/recovery, 가드·회피 윈도우, 보스 페이즈 |
| `/skill:build-game-monster-system` | 리깅된 몬스터 런타임 계약(joint/socket/hurtbox/attack volume, LOD) — 던전 배치 대상 액터 |
| `/skill:create-game-vfx` | 텔레그래프/임팩트/상태이상 VFX, 품질 티어, reduced-motion 대체 |
| `/skill:optimize-threejs-games` | 던전 규모 확대 시 draw call·텍스처·지오메트리 예산, 적응형 품질 |
| `/skill:game-performance-profiler` | Unity/Unreal 프레임타임 병목 우선 프로파일링 브리프 |
| `/skill:ship-web-games` | 스테이지 릴리스: 배포 + 프로덕션 스모크 + 브라우저 증명 |
| `/skill:test-playable-web-games` | 플레이 가능 상태의 브라우저 QA |

### 3. 에이전트 스킬 번들 / 라우터

| 스킬 / 번들 | URL | 비고 |
|---|---|---|
| `/skill:web-game-development` | https://github.com/MengTo/Skills/tree/main/agent-skills/game-development | 19개 웹게임 스킬 라우터 — 맵/레벨/카메라/적AI/VFX/릴리스 중 최적 서브스킬로 라우팅 |
| `/skill:agentic-gamedev-skills` | https://github.com/abagames/agentic-gamedev-skills | 미니게임 설계, Godot, crisp-game-lib, 텔레메트리 스킬 선택 설치 |
| `/skill:unity-gamedev-skill-pack` | https://github.com/tjboudreaux/cc-plugin-unity-gamedev | Unity 워크플로(Addressables, Cinemachine, GAS, VContainer) 스킬팩 도입 심사 |
| `/skill:game-studio-harness` | (로컬 번들) | 디렉터·수치밸런스·PM·프로그래머·QA 5역할 3단계 스테이지 게이트 |
| `/skill:bmad-gds` | (로컬 번들) | GDD → 마일스톤 → 스테이지 단위 기획 문서화 |
| `/skill:omu` | (로컬 번들) | Unity3D 멀티에이전트 오케스트레이션 |
| `/skill:unity-mcp` | (로컬 번들) | Unity Editor를 MCP로 제어 — 씬/스크립트/에셋/테스트 |

### 4. 엔진 플러그인 — 절차적 던전 생성

| 툴 | 설명 | URL |
|---|---|---|
| **Dungeon Architect** | Unity/Unreal용 업계 표준. Flow Graph + 스냅 기반으로 구조적이고 일관된 3D 던전 레이아웃 생성 | https://dungeonarchitect.dev/ |
| **Houdini Engine** | 프로 절차적 콘텐츠 생성의 기준. 노드 기반 비파괴 워크플로로 지형·인테리어 대규모 생성 | https://www.sidefx.com/products/houdini-engine/ |
| **shun126/DungeonGenerator** | UE5용 오픈소스 그리드 기반 3D 던전 생성 플러그인. 커스텀 메시로 프로토타이핑에 적합 | https://github.com/shun126/DungeonGenerator |
| **Unreal PCG Framework** | UE5 내장 절차적 콘텐츠 생성 그래프 (지형/프롭 산포/룰 기반 배치) | https://dev.epicgames.com/documentation/en-us/unreal-engine/procedural-content-generation-overview |

### 5. AI 3D 에셋 / 환경 생성

| 툴 | 설명 | URL |
|---|---|---|
| **Meshy.ai** | 텍스트/이미지 → 깔끔한 토폴로지 + PBR 텍스처 3D 모델. 던전 프롭 채우기에 유용 | https://www.meshy.ai/ |
| **Tripo AI** | 빠른 3D 생성, 스켈레톤 익스포트·파트 세그멘테이션 지원 | https://www.tripo3d.ai/ |
| **Sloyd.ai** | 파라메트릭 + 생성형 결합. 편집 가능한 게임레디 프롭/가구/건물 | https://www.sloyd.ai/ |
| **CSM.ai** | 2D(사진/영상/스케치) → 3D 모델 및 물리 기반 3D 환경 | https://csm.ai/ |
| **Promethean AI** | 3D 레벨 드레싱 전문. 설명과 시맨틱 룰로 환경 자동 배치 | https://www.prometheanai.com/ |
| **Blockade Labs (Skybox AI)** | 360° 환경 스카이박스 즉시 생성 — 스테이지 배경 톤 확정 | https://www.blockadelabs.com/ |
| **Luma AI (Genie)** | 텍스트 → 탐색 가능한 인터랙티브 3D 환경(월드 모델) | https://lumalabs.ai/genie |
| **Scenario** | 자체 아트로 학습해 캐릭터/환경/텍스처 스타일 일관성 유지 | https://www.scenario.com/ |

### 6. 알고리즘 · CLI 레퍼런스

| 항목 | 설명 | URL |
|---|---|---|
| **Wave Function Collapse (WFC)** | 제약 기반 타일 레이아웃 무한 생성. 던전/지형 타일링의 사실상 표준 알고리즘 | https://github.com/mxgmn/WaveFunctionCollapse |
| **marian42/wavefunctioncollapse** | WFC의 3D 모듈형 구현(Unity) — 3D 던전 모듈 조립 참고 | https://github.com/marian42/wavefunctioncollapse |
| **Watabou Procedural Generators** | 도시·던전·저택 절차 생성기 모음. 룸/코리더 구조화 레퍼런스 | https://watabou.itch.io/ |
| **PCG Book (Procedural Content Generation in Games)** | 절차 생성 이론 표준 교재(무료 웹판) | https://www.pcgbook.com/ |
| **Roguebasin — Dungeon-Building Algorithms** | BSP, 룸+코리더, 셀룰러 오토마타 등 고전 던전 알고리즘 색인 | https://www.roguebasin.com/index.php/Articles#Map |

### 7. MCP 서버 (에이전트 ↔ 3D 툴 연결)

| 서버 | 설명 | URL |
|---|---|---|
| **BlenderMCP** | Blender를 MCP로 제어 — 씬 구성, 메시 생성, 배치 자동화(본 저장소의 Blender 파이썬 파이프라인과 결합) | https://github.com/ahujasid/blender-mcp |
| **Unity MCP** | Unity Editor 씬/에셋/테스트 제어 (`/skill:unity-mcp`) | https://github.com/CoplayDev/unity-mcp |
| **Godot MCP** | Godot 에디터/씬 트리 제어 | https://github.com/Coding-Solo/godot-mcp |

### 8. 본 저장소 적용 매핑

Abyssal-Command는 이미 스테이지/월드 데이터를 코드로 소유하고 있다. 위 스킬은 **그 데이터를 대체하지 않고 저작·검증을 가속**하는 용도로만 사용한다.

| 저장소 자산 | 결합할 스킬/툴 |
|---|---|
| `stage-world-catalog.js` (스테이지·월드 정의) | `/skill:author-game-levels`, `/skill:design-game-encounters` |
| `defense-catalog.js`, `defense-run-simulation.js` | `/skill:design-action-combat`, `/skill:game-studio-harness` (수치 밸런스) |
| `tests/stage-world-*.test.mjs`, `world-presentation-contract.test.mjs` | 스테이지 변경 시 **회귀 게이트** — 스킬 산출물은 반드시 이 테스트를 통과해야 함 |
| `scripts/build-stage-vfx-blender.py` | BlenderMCP + `/skill:create-game-vfx` |
| `design/assets/concept/` | Meshy / Tripo / Scenario (스타일 일관성) → GLB 런타임 통합 |
| `docs/concept-to-web-game-3d-pipeline.md` | 캐릭터 파이프라인. 본 문서는 그 **월드/스테이지 대응편** |

#### 권장 순서 (신규 스테이지 1개 추가 시)

1. `/skill:design-game-encounters` — 목표·적 구성·스폰 페이싱 정의
2. `/skill:author-game-levels` — 동선·콜리전·랜드마크·조명을 결정론적 데이터로 확정
3. WFC / Dungeon Architect / Houdini — 던전형 스테이지면 레이아웃 절차 생성 후 수동 큐레이션
4. Meshy / Sloyd / Blockade Labs — 프롭·스카이박스 채우기 (`design/assets/`)
5. `/skill:create-game-vfx` → `/skill:optimize-threejs-games` — 연출 후 예산 회복
6. `tests/stage-world-*.test.mjs` 회귀 + `/skill:test-playable-web-games` 브라우저 증명
7. `/skill:ship-web-games` — 배포 및 프로덕션 스모크

**출처 원본:** `3D_Dungeon_Generation_Tools.csv` (섹션 4~6의 툴 목록), `~/.agents/skills/*/SKILL.md` (섹션 1~3의 스킬 설명).

---

## Capture 2 — prompts.chat README (excerpt)

- "The world's largest open-source prompt library for AI"; formerly *Awesome ChatGPT Prompts*.
- Data formats: `prompts.csv`, `PROMPTS.md`, Hugging Face dataset `fka/prompts.chat`.
- Integrations: CLI (`npx prompts.chat`), Claude Code plugin marketplace `f/prompts.chat`,
  MCP server at `https://prompts.chat/api/mcp` (remote) or `npx -y prompts.chat mcp` (local).
- License: source MIT; **prompt content and data are CC0 1.0 (public domain)**, which is why the
  rows below may be adapted into this repository without attribution obligations. Attribution is
  kept anyway for provenance.

## Capture 3 — prompts.csv rows used as seeds (verbatim)

### Row: `Act as a Procedural Content Generator` (contributor `loshu2000`)

> I want you to act as a Procedural Content Generation (PCG) Expert. Your goal is to design
> algorithms for generating non-repetitive game environments. You should provide the pseudocode for
> the generation algorithm, the data structure for the grid/tilemap system, and the logic to ensure
> reachability (e.g., A* or Flood Fill checks). Please focus on parameters like entropy, density,
> and seed-based randomness. Do not include any narrative elements or UI design. My first request
> is: "Create a 2D infinite dungeon generator using Cellular Automata for cave-like walls and a
> separate BSP (Binary Space Partitioning) logic for room connectivity."

### Row: `Procedural 3D Environment Designer` (contributor `loshu2000`)

> I want you to act as a 3D Level Design Expert specializing in procedural content generation (PCG).
>
> Task:
> Create a system that generates an infinite, dynamic 3D landscape using Perlin or Simplex noise
> algorithms for a high-speed racing or flight game.
>
> Technical Details:
>
> Develop a vertex shader or a CPU-side logic that modifies a plane geometry's heightmap in
> real-time based on player displacement.
>
> Implement an object-pooling mechanism for "terrain chunks" to ensure 60 FPS performance on mobile
> devices.
>
> Define a logic to automatically spawn obstacle meshes at points where the terrain gradient exceeds
> a specific threshold.
>
> Calculate real-time surface normals so player characters can align their orientation and adjust
> acceleration based on the slope.
>
> Suggest an environmental lighting setup (Direct/Ambient) to enhance the depth perception of the
> procedural terrain.

### Row: `Prompt Generator` — the C.R.A.F.T. skeleton (contributor `cperalesg@gmail.com`, excerpt)

> FORMAT:
> For organizational purposes, you will use an acronym called "C.R.A.F.T." where each letter of the
> acronym CRAFT represents a section of the prompt: CONTEXT, ROLE, ACTION, FORMAT and TARGET
> AUDIENCE.
> - Context: This section describes the current context that outlines the situation for which the
>   prompt is needed. […]
> - Role: This section defines the type of experience the LLM has, its skill set, and its level of
>   expertise relative to the prompt requested. […]
> - Action: This is the action that the prompt will ask the LLM to take. It should be a numbered
>   list of sequential steps […]
> - Format: This refers to the structural arrangement or presentation style of the LLM's generated
>   content. […]
> - Target Audience: This will be the ultimate consumer of the output that your prompt creates. […]
