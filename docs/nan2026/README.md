# NAN 2026 Game X AI 해커톤 — 사전 과제 제출물

**팀명**: Hong팀
**팀 프로젝트**: Abyssal Lantern — Hold the Cinder Court
**팀원**: 정장영 (기획·게임구현·리소스제작) · 이석민 (기획·UI·QA) · 정우영 (기획·QA)

## 문서 자산

| 파일 | 용도 |
|---|---|
| `assets/core-loop.svg` | Cinder Court 코어 루프 |
| `assets/range-asymmetry.svg` | 사거리 비대칭 · 스탠드오프 밴드 |
| `assets/ai-pipeline.svg` | AI 제작 파이프라인 (제작 시점 / 런타임 분리) |
| `assets/capture-authenticity.svg` | 플레이 영상 캡처 경로 (배제 / 채택) |
| `assets/team-lanes.svg` | 팀 레인 분리와 증거 흐름 |

SVG는 마크다운에서 그대로 렌더링되고, PDF 빌드 시 `rsvg-convert`가 벡터
PDF로 변환해 삽입합니다. 코드 블록의 한글은 D2Coding 고정폭 폰트로
렌더링되므로 글자가 사라지지 않습니다.

대회 규정상 5개 항목을 **모두** 제출해야 하며, 하나라도 누락되면 심사
대상에서 제외됩니다.

## 제출물 현황

| # | 제출물 | 제출 형태 | 이 저장소의 산출물 | 상태 |
|---|---|---|---|---|
| 1 | 플레이 가능한 빌드 및 소스 코드 | GitHub Pages 링크 + 전체 소스 | <https://jellyggumi.github.io/Abyssal-Lantern/> · <https://github.com/jellyggumi/Abyssal-Lantern> | 배포 파이프라인 가동 중 |
| 2 | 플레이 동영상 | YouTube 링크 (30~60초) | `assets/video/nan2026-cinder-court-play.mp4` | 캡처 완료 · **업로드 필요** |
| 3 | 게임 소개 및 설명 문서 | PDF | [`01-game-overview.md`](01-game-overview.md) → `pdf/01-game-overview.pdf` | 완료 |
| 4 | AI 활용 기술 문서 | PDF | [`02-ai-tech.md`](02-ai-tech.md) → `pdf/02-ai-tech.pdf` | 완료 |
| 5 | 팀원 롤 기술서 | PDF | [`03-team-roles.md`](03-team-roles.md) → `pdf/03-team-roles.pdf` | 완료 (3인 팀이므로 필수) |

## 사람이 해야 하는 남은 작업

에이전트가 대신할 수 없는 항목입니다.

1. **YouTube 업로드** — `assets/video/nan2026-cinder-court-play.mp4`를
   공개 또는 일부 공개(링크 공유)로 업로드하고, 받은 링크를
   `01-game-overview.md` 4장의 `(제출 시 링크 기재)` 자리에 채운 뒤 PDF를
   다시 생성합니다.
2. **GitHub Pages 재배포 확인** — 현재 배포본이 최신 Cinder Court 진입점을
   서빙하는지 확인합니다. 확인 명령:
   ```bash
   curl -s https://jellyggumi.github.io/Abyssal-Lantern/ | grep -o '<title>[^<]*</title>'
   # 기대값: <title>Abyssal Lantern — Cinder Court</title>
   ```
3. **저장소 공개 여부 확인** — 공개 제출이 권장됩니다. 비공개로 둘 경우
   심사 계정 `dl_gameai_reviewer@nhn.com`을 초대해야 합니다.
4. **신청서 제출** — 개인정보 수집·이용 및 저작권 동의 포함.

접수 마감 후에는 제출 내용을 변경할 수 없습니다.

## PDF 생성

```bash
node scripts/build-nan2026-pdf.mjs
```

`docs/nan2026/pdf/` 아래에 세 개의 PDF를 생성합니다. 마크다운 원본을
수정한 뒤 다시 실행하면 갱신됩니다.

## 플레이 영상 재캡처

```bash
node scripts/capture-cinder-court-play.mjs --seconds 44
```

실제 브라우저에서 실제 입력으로 게임을 플레이하며 실제 렌더 프레임을
인코딩합니다. 프레임 합성·보간·생성이 없으므로 대회 규정
*"실제 플레이 화면 그대로"* 를 만족합니다. 상세 근거는
[`02-ai-tech.md`](02-ai-tech.md) 6장에 있습니다.
