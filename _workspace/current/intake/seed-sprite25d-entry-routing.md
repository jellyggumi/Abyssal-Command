# Seed — sprite-2-5d 진입 라우팅 + 게임 구성 개선

상태: FROZEN. 언어: ko. 유형: brownfield.
(이전 세션의 미완료 인터뷰 state `--seed 메인전투씬에 추가할 게임요소 구상`는
현재 요청과 무관한 잔여물이며, 본 시드로 대체한다.)

## 확정 요구사항 (사용자 응답 기반)

1. **진입 라우팅 (옵션 c)** — `sprite-2-5d.html`의 내용을 GitHub Pages 루트
   `index.html`로 승격하고, 현재 Abyssal Lantern 메인 캠페인 페이지는
   `campaign.html`로 이동해 보존한다. `/Abbysal-Lantern/` 접근 시 sprite-2-5d
   게임이 노출된다.
2. **오타 정리** — 정본은 `abyssal-oneline.html`. `abbysal-oneline.html`은
   정본으로 리다이렉트한다.
3. **전환 트리거** — sprite-2-5d 게임 종료 시 `abyssal-oneline.html`로 이동.
   클리어와 게임오버 **모두** 포함.
4. **후속 연결 페이지 구성 기준** — `abyssal-oneline.html`의 구성을 기준으로
   이후 연결 페이지를 맞춘다.
5. **개선 범위** — sprite-2-5d의 게임성, 스킬 사용, 세계관, 사운드, 아이템
   구성을 추가/개선. 자산 생성 키는 설정 완료됨.

## 참조

- `$web-game-development` (Three.js/브라우저 전용, CLAUDE.md §2)
- 자산 도구: god-tibo-imagen, game-sounds, ElevenLabs API, prompts-chat

## 실행 중 판단 사항

- 진행 상태(점수/아이템) 전달은 localStorage 우선.
- 신규 연결 페이지는 기존 파일 범위 내 정리 우선.
