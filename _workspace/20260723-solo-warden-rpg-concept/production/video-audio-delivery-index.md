# Stage 1-10 사운드/비디오 배포 아티팩트

## 상태 요약
- 사운드 작업: **완료, 내레이션/스킬 음성 재생성 완료 + 경로 버그 수정 후 콘텐츠 검증 완료** (`readyCount 106 / requiredCount 106`, 누락 없음. 2026-07-24: 사용자 요청으로 내레이션 17종 + 스킬 7종 음성을 성우톤/플레이어 결연함 표현으로 재생성 — 음성 프로필 시스템 버그(`.voiceProfile` 필드 미반영) 수정, IP 유출 텍스트 2건 수정, 컷 duration 예산 초과 2건 수정. **후속 발견**: 최초 재생성이 `OUT_BASE` 경로 버그로 저장소 루트에 기록되어 실제 배포 경로(워크스페이스)에는 반영되지 않았던 것을 사용자 요청 재검증 중 발견·수정 — 경로 수정 후 재생성, Whisper 로컬 전사로 9개 샘플 클립 + 렌더링된 `part_intro.mp4` 실제 콘텐츠 대조 완료(9/9 일치, "성진우" 0건). 상세는 `decision-log.md#D16` 및 D16 정정 섹션 참조)
- 비디오 파이프라인: **완료, duration 버그 수정 + 음성 재생성(경로 수정 후 최종본) 반영 후 전량 재검증** (`part` 15종 + `concat` 12종 모두 매니페스트 duration과 정확히 일치 확인. 2026-07-24: 2컷 이상 파트에서 오디오가 겹쳐 재생/조기절단되던 버그를 수정하고 재렌더, 이어서 내레이션/스킬 음성 교체(경로 버그 수정 후 워크스페이스 경로 기준)에 맞춰 `--all --force` 전체 재실행 — 상세는 `vox-director_video_pipeline.md#버그수정-이력` 참조)
- 비디오 DTS 보정본: **재생성 완료** (`*_dtsfix.mp4`, moov-front faststart remux, concat 12종 + part-level ending 3종 전량 원본과 duration/stream 일치 검증. 음성 경로 수정 후 최종본 기준)

## 1) 사운드 산출물 루트
- 경로: `_workspace/20260723-solo-warden-rpg-concept/assets/audio/elevenlabs/`
- 컷 기반 믹스 오디오:
  - `part_intro_muxed.wav`
  - `part_lobby_muxed.wav`
  - `part_stage01_muxed.wav` ~ `part_stage10_muxed.wav`
  - `part_ending_common_muxed.wav`
  - `part_ending_branch_a_muxed.wav`
  - `part_ending_branch_b_muxed.wav`
- 카테고리별 폴더:
  - `narration/` (내레이션)
  - `bgm/` (스테이지/엔딩 BGM)
  - `ambience/` (배경 환경음)
  - `sfx/` (전투/상황 효과음)
  - `combat/` (전투 전용)
  - `skill/` (플레이어 스킬: idle/move/run/hit/bighit/attack/critical/avoid/defence)
  - `state/` (플레이어 상태: safe/critical/lowhp/skill_cd/defence_ready/die)
  - `npc/` (로비 NPC 브리핑)

### 검증 아티팩트
- `_workspace/20260723-solo-warden-rpg-concept/production/audio-resource-fulfillment.json`
  - `readyCount: 106`, `missingCount: 0`
- `_workspace/20260723-solo-warden-rpg-concept/production/audio-cut-stage-manifest.json`
  - `intro + lobby + stage1~10 + ending` 컷 매핑

## 2) 비디오 산출물 루트
### 기본(Base)
- `.../assets/video/`
  - 파트 영상:
    - `part_intro.mp4`
    - `part_lobby.mp4`
    - `part_stage01.mp4` ~ `part_stage10.mp4`
    - `part_ending_common.mp4`
    - `part_ending_branch_a.mp4`
    - `part_ending_branch_b.mp4`
  - 합본 영상:
    - `defense_stage1to10_story_01.mp4`
    - `defense_stage1to10_story_cutonly.mp4`
    - `defense_stage1to10_story_endingB.mp4`
  - DTS 보정본(권장 배포본):
    - `defense_stage1to10_story_01_dtsfix.mp4`
    - `defense_stage1to10_story_cutonly_dtsfix.mp4`
    - `defense_stage1to10_story_endingB_dtsfix.mp4`
    - `part_ending_common_dtsfix.mp4`
    - `part_ending_branch_a_dtsfix.mp4`
    - `part_ending_branch_b_dtsfix.mp4`

### 스타일 변형(추가)
- `.../assets/video/styles/anime-soft/`
  - `defense_stage1to10_story_01_anime_soft.mp4`
  - `defense_stage1to10_story_cutonly_anime_soft.mp4`
  - `defense_stage1to10_story_endingB_anime_soft.mp4`
  - 각 파일 `_dtsfix` 보정본도 동일 폴더에 생성

- `.../assets/video/styles/noir-cut/`
  - `defense_stage1to10_story_01_noir_cut.mp4`
  - `defense_stage1to10_story_cutonly_noir_cut.mp4`
  - `defense_stage1to10_story_endingB_noir_cut.mp4`
  - 각 파일 `_dtsfix` 보정본도 동일 폴더에 생성

- `.../assets/video/styles/webtoon-static/`
  - `defense_stage1to10_story_01_webtoon_static.mp4`
  - `defense_stage1to10_story_cutonly_webtoon_static.mp4`
  - `defense_stage1to10_story_endingB_webtoon_static.mp4`
  - 각 파일 `_dtsfix` 보정본도 동일 폴더에 생성

### 비디오 검증 아티팩트
- `_workspace/20260723-solo-warden-rpg-concept/production/vox-director_video_run_report.json`
  - 파트/스타일/합본 목록, 실행 로그 포함 (2026-07-24 버그수정 후 재생성됨)
- `_workspace/20260723-solo-warden-rpg-concept/production/vox-director_manifest.generated.json`
  - 씬/컷/오디오 매핑 매니페스트 (입력 스펙 — 목표 duration만 선언, 렌더 결과 아님)
- 실행 스크립트: `scripts/vox-video-pipeline.mjs` (커밋 대상 위치; 구 `tmp/vox-video-pipeline.mjs`는 더 이상 사용하지 않음)

## 3) 통합 사용 권장 순서
1. 스테이지 컷 시퀀스는 `part_intro.mp4 -> part_lobby.mp4 -> part_stage01..part_stage10 -> end` 순으로 합성.
2. 최종 엔딩 분기: `part_ending_common + part_ending_branch_a` 또는 `+ part_ending_branch_b`.
3. 엔진 연동은 `part_*.mp4` + 대응 `part_*.wav`(`part_*.muxed.wav`)를 사용해 컷씬/브랜치별 동기화.
4. 배포용 기본값은 각 스타일별 `_dtsfix.mp4` 사용 권장.

## 4) 타임코드 동기화 맵 (완료)
- `_workspace/20260723-solo-warden-rpg-concept/production/stage1to10-timecode-sync.json`
  - 3개 시퀀스(`mainline`/`ending_branch_b`/`cut_only`) 전체에 대해 파트/컷 단위 시작-종료 시각(초 단위 + 30fps 프레임 단위)을 산출. 컷 경계 간 gap/overlap 없음 검증 완료(연속성 assert 통과).
  - 각 occurrence에 `cutId`/`label`/`stage`/`interactive`/`triggers`/`motion`/`audioRefs` 포함 — storyboard-motion-sound-matrix.json을 별도로 조인하지 않아도 재생 동기화에 필요한 메타데이터를 바로 사용 가능.
  - Blender/Unity 임포트 가이드는 파일 내 `usage` 필드 참조.

## 5) 다음 단계(선택)
- 스테이지 11+ 확장 시, 동일 네이밍 규칙으로 `part_stage11*`와 `bgm/sfx/state/skill` 항목을 추가 후 `scripts/vox-video-pipeline.mjs --all --force`로 파이프라인 재실행, 이어서 `stage1to10-timecode-sync.json` 생성 로직 재실행(파트/컷 수 확장에 맞춰 스크립트화 권장 — 현재는 1회성 계산).
- Blender previs 워크플로우: `production/boss_previs_workfile.blend` + `boss_previs_timings.json` 참조(별도 파이프라인, 이번 컷 타임코드와는 무관).
