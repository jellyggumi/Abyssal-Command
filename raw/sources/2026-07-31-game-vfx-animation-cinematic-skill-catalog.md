# RAW CAPTURE — 게임 3D VFX · 이펙트 · 애니메이션 · 연출용 AI 스킬 / 에이전트 스킬 카탈로그

- Captured: 2026-07-31
- Capture kind: user-supplied document (chat), verbatim
- Immutable per `CLAUDE.md` §4. Corrections go to `wiki/`, never here.
- Sibling capture: `raw/sources/2026-07-31-stage-map-composition-skill-catalog.md` (map/dungeon/stage track)
- Addendum at the end of this file records the second user message in the same session.

---

## VERBATIM DOCUMENT

> **대상:** Abyssal Surge — Abyssal-Command (Three.js / WebGL 웹 게임)
> **범위:** 실시간 VFX(파티클·셰이더) · 캐릭터 애니메이션/모션 · 컷신·시네마틱 연출 · 오디오 연출
> **작성일:** 2026-07-31
> **자매 문서:** [`game-map-dungeon-stage-ai-skills.md`](game-map-dungeon-stage-ai-skills.md) (맵/던전/스테이지), [`concept-to-web-game-3d-pipeline.md`](concept-to-web-game-3d-pipeline.md) (캐릭터 파이프라인)

---

## 목차

1. [로컬 에이전트 스킬 — 실시간 VFX / 셰이더](#1-로컬-에이전트-스킬--실시간-vfx--셰이더)
2. [로컬 에이전트 스킬 — 애니메이션 / 모션](#2-로컬-에이전트-스킬--애니메이션--모션)
3. [로컬 에이전트 스킬 — 시네마틱 / 영상 연출](#3-로컬-에이전트-스킬--시네마틱--영상-연출)
4. [로컬 에이전트 스킬 — 오디오 연출](#4-로컬-에이전트-스킬--오디오-연출)
5. [로컬 에이전트 스킬 — 이미지 / 컨셉 소스](#5-로컬-에이전트-스킬--이미지--컨셉-소스)
6. [외부 AI 툴 — 영상 / 모션 생성](#6-외부-ai-툴--영상--모션-생성)
7. [외부 AI 툴 — 모션 캡처 / 리깅](#7-외부-ai-툴--모션-캡처--리깅)
8. [DCC / 엔진 VFX 시스템](#8-dcc--엔진-vfx-시스템)
9. [본 저장소 적용 매핑](#9-본-저장소-적용-매핑)

---

## 1. 로컬 에이전트 스킬 — 실시간 VFX / 셰이더

| 스킬 | 쓰임새 | 업스트림 |
|---|---|---|
| `/skill:create-game-vfx` | Three.js 게임 VFX 저작. 공격·임팩트·피격 피드백·상태이상·주문 트레일·파티클·셰이더·텔레그래프, 품질 티어, reduced-motion 대체 | https://github.com/MengTo/Skills/tree/main/agent-skills/game-development |
| `/skill:game-vfx` | VFX 스펙·라이프사이클·엔진 핸드오프. 파티클 풀링, 스모크/번개/화염/트레일, 블룸·글로우, 레이어드 스펠 타임라인, 프레임 예산 진단 | https://github.com/lev-os/agents |
| `/skill:threejs-shaders` | ShaderMaterial / RawShaderMaterial / GLSL, uniforms·varyings, `onBeforeCompile`, 셰이더 청크, 인스턴싱, GPU 성능 점검 | https://github.com/CloudAI-X/threejs-skills/tree/main/skills/threejs-shaders |
| `/skill:optimize-threejs-games` | VFX 추가 후 draw call·텍스처·지오메트리 예산 회복, 적응형 품질 | MengTo/Skills |
| `/skill:optimize-web-animations` | 애니메이션 중심 프론트 성능 감사 — 오프스크린 일시정지, rAF 루프, 메모리 누수, 장시간 세션 저하 | https://github.com/MengTo/Skills/tree/main/agent-skills/codex/optimize-web-animations |
| `/skill:dalamud-vfx-editor` | FFXIV AVFX/PAP/TMB/SCD 이펙트 편집 — **상용 VFX 데이터 구조 레퍼런스**로 참고 가치 | https://github.com/0ceal0t/Dalamud-VFXEditor |

**참고 문서:** Three.js Shader 매뉴얼 https://threejs.org/manual/#en/shader · ShaderMaterial https://threejs.org/docs/#api/en/materials/ShaderMaterial

## 2. 로컬 에이전트 스킬 — 애니메이션 / 모션

| 스킬 | 쓰임새 | 업스트림 |
|---|---|---|
| `/skill:threejs-animation` | AnimationMixer / AnimationClip / AnimationAction, GLTF 애니 재생, 스켈레탈 리그, 모프 타깃, 크로스페이드, 프레임레이트 독립 절차 모션 | https://github.com/CloudAI-X/threejs-skills/tree/main/skills/threejs-animation |
| `/skill:video-motion-previs` | `video-motion-previs` CLI로 레퍼런스 영상 → 포즈(OpenPose BODY_25)·뎁스·카메라 솔브·컨트롤 레이어 → Blender/AI-video 프로덕션 팩 | https://github.com/wassermanproductions/motion-previs-studio |
| `/skill:motion-previs-studio` | Motion Previs Studio v4 데스크톱 앱 셋업·확장·익스포트 파이프라인 최적화 (Seedance/ComfyUI/Blender/Runway/Kling 연동) | https://github.com/wassermanproductions/motion-previs-studio · Blockout https://github.com/wassermanproductions/blockout |
| `/skill:build-game-monster-system` | 몬스터 리그 계약 — semantic joint/socket, hurtbox, 전투 애니 상태, LOD | MengTo/Skills |
| `/skill:design-action-combat` | 전투 동작의 startup/active/recovery 타이밍을 상태머신으로 명시 — 애니메이션이 아니라 타이밍이 진실 | MengTo/Skills |

**Three.js 레퍼런스:** AnimationMixer https://threejs.org/docs/#api/en/animation/AnimationMixer · Animation System https://threejs.org/manual/#en/animation-system

## 3. 로컬 에이전트 스킬 — 시네마틱 / 영상 연출

| 스킬 | 쓰임새 | 업스트림 |
|---|---|---|
| `/skill:video-production` | 프로그래머블/자동 영상 제작 라우터(코드 우선·템플릿 우선·하이브리드). 컷신 배치 렌더, 자막·로컬라이즈 변형 | 로컬 번들 (canonical) |
| `/skill:remotion-video-production` | 위 스킬의 Remotion 호환 별칭 — React 컴포지션 기반 렌더 | https://www.remotion.dev/ |
| `/skill:video-shotcraft` | 샷 레시피 카드 + 검증 템플릿으로 시네마틱 프로모/데모 영상 제작 (2.5D 운반 카메라, 리듬 컷, 사운드 디자인) | https://vincentwei1021.github.io/video-shotcraft/ |
| `/skill:video-to-superprompt` | 레퍼런스 영상 → 초상세 재현 프롬프트(모션 시스템·트랜지션·WebGL 연출 분해) | https://github.com/MengTo/Skills/tree/main/agent-skills/codex/video-to-superprompt |
| `/skill:browser-video-recording` | 60fps 4K 브라우저 캡처 영상 — 인게임 플레이 데모/트레일러 소스 | https://github.com/MengTo/Skills/tree/main/agent-skills/codex/browser-video-recording |
| `/skill:oma-slide` / `/skill:presentation-builder` | 연출 기획안·샷 시트를 공유 가능한 덱으로 | 로컬 번들 |

## 4. 로컬 에이전트 스킬 — 오디오 연출

| 스킬 | 쓰임새 |
|---|---|
| `/skill:build-game-audio-feedback` | 액션 사운드, 전투 레이어, 뮤직 스테이트, 공간 오디오, 믹스 우선순위, 모바일 오디오 언락, 접근성 |
| `/skill:oma-voice` | 로컬 우선 TTS/STT (Voicebox MCP) — 나레이션·보이스 컷 |
| `/skill:game-sounds` | 에이전트 이벤트 사운드(개발 편의). 게임 인게임 사운드와 무관 — https://github.com/Citedy/game-sounds |

인게임 SFX/BGM 생성은 저장소의 `scripts/generate-audio.mjs`, `scripts/generate-defense-audio.mjs` (ElevenLabs API) 경로를 그대로 사용한다. ElevenLabs Sound Effects: https://elevenlabs.io/sound-effects

## 5. 로컬 에이전트 스킬 — 이미지 / 컨셉 소스

| 스킬 | 쓰임새 | URL |
|---|---|---|
| `/skill:god-tibo-imagen` (`gti`) | Codex 인증 재사용 이미지 생성 — VFX 컨셉/키비주얼/텍스처 레퍼런스 | https://github.com/NomaDamas/god-tibo-imagen |
| `/skill:oma-image` | 멀티벤더 이미지 생성 병렬 디스패치 | 로컬 번들 |
| `/skill:image-generation` | MCP 기반 구조화 프롬프트 이미지 생성 | 로컬 번들 |
| `/skill:aura-asset-images` / `/skill:unsplash-asset-images` | 스톡 배경·추상 텍스처 소스 | https://www.aura.build/assets |

## 6. 외부 AI 툴 — 영상 / 모션 생성

| 툴 | 설명 | URL |
|---|---|---|
| **Runway (Gen-4)** | 텍스트/이미지 → 영상, 카메라 컨트롤·모션 브러시. 시네마틱 컷신 프리비즈 | https://runwayml.com/ |
| **Kling AI** | 고품질 이미지→영상, 긴 지속시간·모션 강도 제어 | https://klingai.com/ |
| **Luma Dream Machine** | 빠른 이미지→영상, 키프레임 보간 | https://lumalabs.ai/dream-machine |
| **Pika** | 짧은 이펙트 클립·Pikaffects 스타일 변형 | https://pika.art/ |
| **OpenAI Sora** | 장면 일관성 높은 영상 생성 | https://openai.com/sora |
| **ComfyUI** | 노드 기반 로컬 확산 파이프라인 — AnimateDiff/ControlNet으로 컨트롤 레이어(뎁스·포즈) 주입 | https://github.com/comfyanonymous/ComfyUI |
| **AnimateDiff** | Stable Diffusion 모션 모듈 — 스타일 고정 루프 이펙트 | https://github.com/guoyww/AnimateDiff |
| **Wonder Dynamics (Wonder Studio)** | 실사 영상 → CG 캐릭터 자동 교체·라이팅 매치 | https://wonderdynamics.com/ |

## 7. 외부 AI 툴 — 모션 캡처 / 리깅

| 툴 | 설명 | URL |
|---|---|---|
| **Cascadeur** | AI 보조 물리 기반 키프레임 애니메이션(오토포즈·밸런스) — 액션 모션 저작에 최적 | https://cascadeur.com/ |
| **DeepMotion Animate 3D** | 단일 영상 → 3D 모션(FBX/BVH) | https://www.deepmotion.com/ |
| **Move.ai** | 마커리스 멀티카메라 모캡 | https://www.move.ai/ |
| **Rokoko Vision** | 웹캠/영상 무료 모캡 + Blender/Unity 플러그인 | https://www.rokoko.com/products/vision |
| **Mixamo** | 자동 리깅 + 기성 모션 라이브러리(프로토타이핑 기준선) | https://www.mixamo.com/ |
| **Meshy / Tripo** | 3D 에셋 생성 + 스켈레톤 익스포트 | https://www.meshy.ai/ · https://www.tripo3d.ai/ |

## 8. DCC / 엔진 VFX 시스템

| 시스템 | 설명 | URL |
|---|---|---|
| **Unreal Niagara** | UE5 표준 파티클/시뮬레이션 시스템 — 레이어드 스펠 타임라인 레퍼런스 | https://dev.epicgames.com/documentation/en-us/unreal-engine/niagara-visual-effects |
| **Unity VFX Graph** | GPU 기반 대규모 파티클 그래프 | https://unity.com/features/visual-effect-graph |
| **JangaFX EmberGen** | 실시간 화염/연기/폭발 시뮬 → 플립북 텍스처 익스포트 (웹게임 VFX에 직결) | https://jangafx.com/software/embergen |
| **Houdini** | 절차적 시뮬레이션·이펙트의 표준 | https://www.sidefx.com/products/houdini/ |
| **Blender** | 본 저장소의 실제 리깅/애니/베이킹 실행 환경 | https://www.blender.org/ |
| **BlenderMCP** | Blender를 MCP로 에이전트 제어 | https://github.com/ahujasid/blender-mcp |
| **three.js examples — particles/postprocessing** | 웹 런타임 이펙트 구현 기준 예제 | https://threejs.org/examples/ |

## 9. 본 저장소 적용 매핑

이미 저장소에 VFX/모션 파이프라인 스크립트와 회귀 테스트가 존재한다. 위 스킬은 **그 계약을 대체하지 않고 저작을 가속**한다.

| 저장소 자산 | 결합할 스킬/툴 |
|---|---|
| `scripts/build-stage-vfx-blender.py` | `/skill:create-game-vfx`, `/skill:game-vfx`, EmberGen 플립북 |
| `scripts/rig-and-animate-asset-blender.py`, `scripts/retarget-ingame-motion-blender.py` | `/skill:threejs-animation`, Cascadeur, Rokoko Vision, Mixamo |
| `scripts/boss-motion-previs-blender.py`, `scripts/build-motion-prompt-batch.py` | `/skill:video-motion-previs`, `/skill:motion-previs-studio` |
| `scripts/qa-motion-probe.mjs`, `scripts/audit-fbx-motion-bench.py` | 모션 품질 게이트 — 신규 모션은 여기를 통과해야 함 |
| `scripts/render-clip-frames.py`, `render-pose-contact-sheet.py`, `render-review-thumbnails.py` | 리뷰 산출물 → `/skill:video-shotcraft` 샷 시트 |
| `scripts/generate-audio.mjs`, `generate-defense-audio.mjs` | `/skill:build-game-audio-feedback`, ElevenLabs SFX |
| `design/assets/cinematic/scene_01_vfx_priority.csv`, `scene_01_shot_sheet.csv`, `scene_01_audio_cue.csv` | 연출 계약 원장 — `/skill:video-production` 입력 |
| `tests/combat-presentation-contract.test.mjs`, `stage-framing-and-motion-profile.test.mjs`, `realtime-motion-routing.test.mjs`, `ingame-motion-pack.test.mjs`, `runtime-visual-assets.test.mjs`, `world-presentation-contract.test.mjs` | **회귀 게이트** — VFX/모션 변경은 전부 여기서 증명 |

### 권장 순서 (신규 이펙트/모션 1건 추가 시)

1. `/skill:game-vfx` — 트리거·소유자·지속시간·게임플레이 의미·스폰 캡·정리 규칙·reduced-motion 대체를 **먼저 스펙으로 확정**
2. `/skill:video-motion-previs` 또는 Cascadeur/Rokoko — 모션 소스 확보(레퍼런스 영상 → 포즈/카메라 솔브)
3. `scripts/rig-and-animate-asset-blender.py` → `retarget-ingame-motion-blender.py` — 인게임 리그로 리타깃
4. `/skill:create-game-vfx` + `/skill:threejs-shaders` — 런타임 구현(파티클/셰이더/포스트프로세싱), EmberGen 플립북 필요 시 병행
5. `/skill:build-game-audio-feedback` + `scripts/generate-audio.mjs` — 텔레그래프/임팩트 사운드 레이어 정합
6. `/skill:optimize-threejs-games` + `/skill:optimize-web-animations` — 프레임 예산 회복, 오프스크린 정지
7. `npm test`의 presentation/motion 계약 테스트 + `/skill:test-playable-web-games` 브라우저 증명
8. `/skill:video-shotcraft` 또는 `/skill:browser-video-recording` — 릴리스용 연출 캡처

---

**출처:** 섹션 1~5는 `~/.agents/skills/*/SKILL.md` frontmatter의 `source` 필드에서 직접 추출. 섹션 6~8의 외부 툴 URL은 공개 제품 페이지 기준이며 링크 라이브 검증은 하지 않았다. 섹션 9는 본 저장소의 실제 `scripts/`, `design/assets/cinematic/`, `tests/` 파일 목록에 기반한다.

---

## ADDENDUM — 동일 세션 2차 요구 (verbatim)

> 추가로 넉백과 적이 플에이어 공격할때 직렬로 오지않고 병렬, 원형진입, 플레이어 주변에서 올라오는 연출, 하늘에서 떨어지는 연출등을 통해 다양한 연출도 고려하여 반영해줘

Requirement decomposition recorded for traceability (this decomposition is capture-adjacent
interpretation, not part of the quoted text):

- knockback presentation strengthening
- enemy engagement must stop reading as a single-file serial column; wanted variants:
  parallel / abreast, circular or encircling entry, emergence from the ground around the
  player, drop from the sky
- these are arrival + engagement *choreography*, spanning both simulation spawn placement
  and renderer entry presentation
