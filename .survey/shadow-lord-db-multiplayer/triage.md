# Triage

- Problem: Abyssal Surge(Shadow Lord RTS-RPG)는 GitHub Pages 정적 호스팅 + PWA 구조라 서버가 없다. 현재 영속 저장은 IndexedDB → localStorage → in-memory 3단 폴백(`app.js` `CampaignStorage`)뿐이며, 멀티플레이/소셜 기능(기록 공유, 고스트 대전, 리더보드)은 전무하다. 정적 사이트 제약(비밀 키 노출 불가, 서버 코드 실행 불가) 안에서 (a) 저장 내구성 강화와 (b) 멀티플레이/소셜 도입 경로를 확정해야 한다.
- Audience: Abyssal Surge 개발팀(게임 프로그래머·PM), Wave A 생산 사이클에서 신기술 채택을 결정하는 엔지니어링 게이트 담당자.
- Why now: Wave A에서 3-stage 캠페인 루프가 완성되어 결정론적 규칙 엔진(`campaign-state.js`)의 event-sourced save envelope(≤200 events, deterministic replay)가 안정화됐다. 이 구조는 "trace 자체가 곧 공유 가능한 리플레이"라는 성질을 가지므로, 백엔드 도입 전에 zero-backend 소셜 기능의 실현 가능성을 지금 검증하는 것이 비용상 최적이다. G7(루프 30–180s·반복률 ≥70%) 게이트의 반복률 목표에도 소셜 훅이 직접 기여한다.
