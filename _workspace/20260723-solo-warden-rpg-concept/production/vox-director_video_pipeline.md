# Vox Director Video Pipeline (Fallback Placeholder Renderer)

문서 목적: 스테이지 1~10 디펜스 RPG 컷시네마 산출 파이프라인을 실행 가능 상태로 고정하고,
오디오 믹스 → 파트 비디오 렌더 → 시퀀스 concat 순서로 반복 가능하게 정리합니다.

## 산출물 위치
- 음성 합성 결과 JSON: `_workspace/20260723-solo-warden-rpg-concept/production/vox-director_manifest.json`
- 파트 시퀀스 정의: `_workspace/20260723-solo-warden-rpg-concept/assets/video/vox-part-playlist.json`
- 파트 오디오 입력: `_workspace/20260723-solo-warden-rpg-concept/assets/audio/elevenlabs/**`
- 파트 오디오 믹스 출력: `_workspace/20260723-solo-warden-rpg-concept/assets/audio/elevenlabs/part_*.wav`
- 파트 비디오 출력: `_workspace/20260723-solo-warden-rpg-concept/assets/video/part_*.mp4`
- 스타일 variant: `_workspace/20260723-solo-warden-rpg-concept/assets/video/styles/<style>/part_*.mp4`
- 최종본:
  - `assets/video/defense_stage1to10_story_01.mp4`
  - `assets/video/defense_stage1to10_story_endingB.mp4`
  - `assets/video/defense_stage1to10_story_cutonly.mp4`
  - 스타일 variant는 스타일 suffix가 붙음 (`_anime_soft`, `_noir_cut`, `_webtoon_static`)
- 실행 리포트: `production/vox-director_video_run_report.json`

## 실행 스크립트
- `scripts/vox-video-pipeline.mjs` (2026-07-24: `tmp/`에서 이동 — 버그 수정을 영구 보존하기 위해 커밋 대상 위치로 이전됨. 과거 `tmp/vox-video-pipeline.mjs` 참조는 무효)

## 기본 실행
```bash
node scripts/vox-video-pipeline.mjs --all
```
- `--all` 는 다음을 모두 수행합니다.
  - 파트 오디오 믹스 생성
  - 스타일별 파트 비디오 렌더
  - 시퀀스 concat

## 개별 단계 실행
```bash
# 오디오 믹스만
node scripts/vox-video-pipeline.mjs --audio-only

# 파트 비디오만
node scripts/vox-video-pipeline.mjs --video-only

# 최종 concat만
node scripts/vox-video-pipeline.mjs --concat-only

# 특정 스타일만
node scripts/vox-video-pipeline.mjs --styles base,anime-soft,noir-cut

# 강제 덮어쓰기
node scripts/vox-video-pipeline.mjs --all --force
```

## 스타일 목록
- `base`
- `anime-soft`
- `noir-cut`
- `webtoon-static`

## 실행 순서 및 실패 복구
1. `--audio-only`로 `part_*_muxed.wav` 생성 확인
2. `--video-only --styles ...`로 파트 mp4 생성 확인
3. `--concat-only`로 최종본 생성

누락 파일이 있으면 `--force`로 재실행합니다.

## 상태 점검
```bash
ls -1 assets/audio/elevenlabs/part_*_muxed.wav
ls -1 assets/video/part_*.mp4
ls -1 assets/video/*.mp4 | grep defense_stage1to10
```

## 품질 체크(최소)
- `ffprobe`로 duration/codec 존재 여부
```bash
ffprobe -v error -show_streams -show_format assets/video/defense_stage1to10_story_01.mp4
ffprobe -v error -show_streams -show_format assets/video/defense_stage1to10_story_endingB.mp4
ffprobe -v error -show_streams -show_format assets/video/defense_stage1to10_story_cutonly.mp4
```

## 버그수정 이력 (2026-07-24)
- **버그**: 2컷 이상으로 구성된 파트(`part_stage01/02/03/04/08`)에서 `gatherTracks`/`buildAmixFilter`가 모든 컷의 오디오 트랙을 t=0부터 동시에 겹쳐 믹스(`amix duration=longest`)한 뒤 `atrim`으로 잘라내고 있었음. 결과적으로 보스 등장 내레이션/BGM이 진입 내레이션과 겹쳐 재생되고, 파트 전체 길이가 두 컷 합산(예: 21s)이 아니라 겹쳐진 가장 긴 단일 트랙 길이(~12s)로 잘림 — 비디오도 `-shortest`로 동일하게 잘림.
- **부수 결함**: `buildPartAudioMix`의 실제 믹스 분기(무음 생성 분기 제외)에 `-y` 플래그가 없어 기존 출력 파일이 있으면 ffmpeg가 대화형 덮어쓰기 프롬프트에서 멈춰 조용히 실패(스크립트는 계속 진행하지만 해당 파트는 갱신되지 않음).
- **부수 결함 2**: 단일컷 파트도 소스 트랙이 목표 길이보다 짧으면(`part_stage10`: 소스 최대 12.04s vs 목표 13s) `amix`+`atrim`이 목표 길이까지 확장할 수 없어 짧게 잘림.
- **수정**: 컷별 `offsetSec` 누적 후 `adelay`로 각 트랙을 올바른 시작 지점에 배치(순차 재생), `amix` 뒤 `apad`를 추가해 목표 길이까지 무음으로 패딩, `-y` 플래그 추가.
- **재검증**: 15개 파트 전부 wav/mp4 duration이 매니페스트와 정확히 일치, 12개 concat 산출물(4 스타일 × 3 시퀀스) duration 검증 완료, dtsfix 12종 재생성(moov-front faststart remux, 원본과 동일 atom 순서 확인), part_stage01 믹스의 RMS 엔벨로프로 컷 경계(t=9s)에서 boss-enter 오디오가 정상 진입하고 21s 전체에 걸쳐 콘텐츠가 존재함을 확인(겹침도 조기절단도 없음).
