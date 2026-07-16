# Solution Landscape: Shadow Lord DB & Multiplayer (Abyssal Surge)

## Solution List

| Name | Approach | Strengths | Weaknesses | Notes |
|------|----------|-----------|------------|-------|
| S1 `navigator.storage.persist()` | best-effort → persistent 승격 | LRU eviction 면제, 코드 1줄 | Firefox는 사용자 프롬프트 발생 | [direct page retrieval: MDN Storage quotas] |
| S2 PWA 설치 유도 | 설치형 PWA는 Safari ITP 7-day eviction 면제 | 매니페스트 이미 존재, 무료 | 설치 전환율은 UX 의존 | [direct page retrieval: MDN Storage quotas] |
| S3 envelope 이중 기록 | IndexedDB+localStorage 동시 기록 (현 순차 폴백 강화) | 손상 내성 ↑ | envelope ≤8.3 KB라 5 MiB 한도 내 여유 | 로컬 코드 조사: app.js:106-123 |
| S4 OPFS | 파일형 대용량 저장 | 대용량 | envelope 최대 ~8.3 KB(실측)라 과잉 | [direct page retrieval: MDN Storage quotas] |
| S5 **Ghost-share 코드 공유** | envelope→gzip→base64url→URL/클립보드; 수신자는 `restoreSaveEnvelope` 검증·리플레이 | 인프라 0, 키 0, 엔진 내장 치팅 방어, 실측 최악 679자 | 비동기만 가능 | 실측 상세: WS tech-verification 문서 §2 |
| S6 이모지 결과 공유 | 체크리스트/클리어 기록을 이모지 그리드 텍스트로 | Wordle 검증 바이럴 패턴, 구현 최소 | 데이터가 아닌 자랑용 텍스트 | [indexed snippet: howtogeek.com Wordle 분석] |
| S7 Daily seed 챌린지 | 날짜 시드로 전원 동일 조건 → 결과를 S5/S6로 공유 | 데일리 장르 표준, 반복률(G7) 기여 | 시드 파이프가 엔진에 필요 | [indexed snippet: stackoverflow.com daily-seed 패턴] |
| S8 Supabase Free | Postgres+RLS+Realtime BaaS | 500 MB DB, 50k MAU, Realtime 200 conn/2M msg | **1주 방치 시 정지, 활성 2 프로젝트 제한**, RLS 누락 시 DB 전체 노출 | [direct page retrieval: supabase.com/pricing] |
| S9 Firebase Spark | Firestore/RTDB BaaS | Firestore 1 GiB·50k reads/day·20k writes/day; RTDB 100 conn | 일일 쿼터 하드 리셋, Rules 필수 | [indexed snippet: firebase.google.com/pricing 요약 — 채택 시 재검증] |
| S10 Cloudflare Durable Objects | Workers Free의 stateful edge | 100k req/day·13k GB-s/day·SQLite 5 GB, WebSocket 20:1 과금 완화 | 한도 초과 시 하드 실패, 별도 배포 파이프라인 | [direct page retrieval: developers.cloudflare.com DO pricing] |
| S11 PartyKit | DO 위 멀티플레이 SDK | 2024-04 CF 인수, 자기 계정 배포 시 추가 요금 없음 | S10 제약 동일 | [direct page retrieval: blog.cloudflare.com PartyKit 인수] |
| S12 WebRTC DataChannel | 실시간 P2P | 최저 지연 | **시그널링 서버 불가피**, TURN 릴레이 필요율 ~10–20% | [indexed snippet: webrtc.org, medium.com, edgegap.com] |
| S13 서버리스 시그널링 | p2pt(토렌트 트래커)/PeerJS 공용/Metered free(100 conn·100k msg/월) | 자체 서버 0 | 공용 인프라 가용성 보장 없음 | [indexed snippet: github.com/subins2000/p2pt, metered.ca] |

## Categories

- **Zero-backend** (S1–S7): 인프라 0, 키 노출 0, 가용성 = GitHub Pages. 비동기 전용.
- **Serverless BaaS** (S8–S9): 공개 키 + 정책(RLS/Rules) 모델. 영구 공유 저장·리더보드 가능. 방치-정지(S8)/일일 쿼터(S9)가 함정.
- **Edge stateful** (S10–S11): 실시간 WebSocket까지 확장. 별도 배포 필요.
- **P2P** (S12–S13): 서버 최소화하되 시그널링 불가피. NAT 실패 커버에 TURN.

## What People Actually Use

정적/인디 웹게임의 실전 채택 (indexed snippet 종합: Wordle 분석 글, scottantipa.com URL-state 사례, unity.com ghost-data 문서, HN/Reddit 인디 토론):

- 데일리 퍼즐 장르: 클립보드 이모지 공유 + localStorage 저장 + 날짜 시드가 사실상 표준 스택.
- 빌드/퍼즐 공유 게임: lz-string + base64url URL fragment 인코딩 (scottantipa.com이 실무 레퍼런스로 반복 인용됨).
- 타임어택/레이싱 계열: ghost data(입력 시퀀스) 기록·재생 — 본 게임의 event-sourced trace와 구조적으로 동일.
- 리더보드가 필요한 소규모 게임: Firebase/Supabase free tier가 1순위. 실시간 대전까지 가면 Cloudflare Workers/DO 또는 전용 호스팅으로 이탈.
- WebRTC 직접 구현은 드묾 — 시그널링·TURN 운영 부담 대비 이득이 작다는 회고가 반복 등장.

## Frequency Ranking

1. 클립보드 결과 공유 (이모지 그리드) — 구현 최소, 바이럴 최대
2. URL 인코딩 상태 공유 (lz-string/base64url)
3. Daily seed 챌린지
4. Firebase/Supabase serverless 리더보드
5. Ghost data 비동기 대전
6. WebRTC 실시간 P2P (최하위 — 운영 부담)

## Key Gaps

- 실시간 대전은 어떤 경로로도 zero-backend 불가 — WebRTC조차 시그널링 서버 필요 [indexed snippet: webrtc.org]. 실시간 요구 확정 시 S10/S11 재평가.
- 글로벌 리더보드의 신뢰 문제 미해결 — 결정론 리플레이 검증은 "규칙상 합법이지만 실제 플레이하지 않은" trace 위조를 못 막는다. 서버 검증 전까지 랭킹은 친구 간 비교로 범위 제한이 정직한 설계.
- Firebase 무료 한도 수치는 검색 요약(indexed snippet) 단계 — 채택 결정 전 공식 pricing 페이지 직접 재검증 필요.

## Contradictions

- 검색 요약들은 "Cloudflare 무료 티어로 인디 멀티플레이 충분"이라 낙관하지만, 공식 문서 기준 Workers Free는 한도 초과 시 해당 연산 하드 실패 [direct page retrieval: developers.cloudflare.com DO pricing]. 바이럴 스파이크 시 기능이 통째로 죽는 시나리오와 양립 불가 — 낙관론은 할인 수용.
- "Supabase anon key는 안전" 주장과 "RLS 누락 시 DB 전체 노출" 경고가 공존 — 안전성은 키 속성이 아니라 RLS 규율의 함수. 정적 사이트에서는 RLS 감사 체계 없이는 채택 불가.

## Key Insight

본 게임의 save envelope는 이미 자가 검증형 리플레이 포맷이다(결정론 엔진 + schema/rulesVersion 가드 + ≤200 events, `campaign-state.js:317-348`). 실측 결과 최악 조건 gzip+base64url 679자로 URL 안전선(2,000자) 이내, 복원 0.35 ms — **서버 없이 URL/클립보드로 유통 가능한 비동기 멀티플레이(고스트 대전)가 이번 사이클에 사실상 공짜로 열려 있다.** 업계 표준 패턴(ghost data + URL 인코딩 + 이모지 공유)과도 정확히 합치한다. 측정·게이트 상세: `_workspace/20260716-shadow-lord-rts-rpg/engineering/tech-verification/db-multiplayer.md`.

## Curated Sources

1. https://supabase.com/pricing — [direct page retrieval]
2. https://developers.cloudflare.com/durable-objects/platform/pricing/ — [direct page retrieval]
3. https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria — [direct page retrieval]
4. https://blog.cloudflare.com/cloudflare-acquires-partykit/ — [direct page retrieval]
5. https://scottantipa.com/storing-app-state-in-urls — [indexed snippet]
6. https://github.com/subins2000/p2pt — [indexed snippet]
7. https://firebase.google.com/pricing — [indexed snippet: 검색 요약 경유]
8. https://www.metered.ca/ — [indexed snippet]
