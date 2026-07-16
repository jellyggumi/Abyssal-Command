# Context: Shadow Lord DB & Multiplayer (Abyssal Surge)

## Workflow Context

현재 게임의 저장/복원 파이프라인 (읽기 전용 코드 조사, direct page retrieval — 로컬 리포):

1. `campaign-state.js:317` `createSaveEnvelope(state)` — `{schema, schemaVersion, rulesVersion, trace}` 반환. `trace`는 event-sourced 이벤트 배열 (`start`/`action`/`reward`/`retry`), 상한 `MAX_TRACE_EVENTS = 200` (`campaign-state.js:8`).
2. `campaign-state.js:327` `restoreSaveEnvelope(envelope)` — 스키마/버전/rulesVersion 검증 후 `createCampaign()`부터 trace 전체를 **결정론적으로 리플레이**. 각 이벤트가 규칙 엔진 검증을 통과해야만 복원됨 → 조작된 save는 replay 단계에서 거부된다.
3. `app.js:38` `CampaignStorage` — `open()`에서 IndexedDB 시도, 실패 시 `mode="fallback"`; `save()`는 IndexedDB → localStorage(`FALLBACK_KEY`) → in-memory 순 3단 폴백; `load()`도 동일 순서.
4. `app.js:383` 수동 export — envelope를 JSON Blob으로 다운로드; `app.js:401` import — 파일 선택 후 `restoreSaveEnvelope` 통과 시 저장.

핵심 구조적 사실: **save envelope가 이미 "검증 가능한 리플레이 데이터"다.** 멀티플레이 조사의 출발점은 "서버 없이 이 envelope를 어떻게 유통시키느냐"로 좁혀진다.

## Affected Users

| Role | Responsibility | Skill Level |
|------|----------------|-------------|
| 플레이어 | 캠페인 진행·저장. 브라우저 데이터 삭제/eviction 시 유실 위험 — Safari는 7일 무상호작용 시 스크립트 저장소 능동 삭제(설치형 PWA 제외) [direct page retrieval: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria] | 비개발자 |
| 공유 지향 플레이어 | 기록 자랑·비교. 현재 JSON 파일 export/import 외 수단 없음 → 마찰로 사실상 미사용 | 비개발자 |
| 개발팀 (게임 프로그래머) | 정적 호스팅 제약 하에서 저장/멀티플레이 설계. 서버 비밀 키를 둘 곳 없음 (`.env.game-audio` 키도 빌드 산출물 포함 금지) | 전문가 |
| PM/게이트 담당 | 무료 한도·운영 부담·G7 반복률 영향 판단 | 중급 |

## Current Workarounds

1. 저장 내구성: IndexedDB → localStorage → memory 3단 폴백 (이미 구현). localStorage는 origin당 5 MiB(웹 표준 계열 상한 10 MiB) [direct page retrieval: MDN Storage quotas].
2. 공유: JSON 파일 수동 export/import (이미 구현). 파일 기반이라 모바일 공유 UX가 나쁨.
3. 업계 일반 워크어라운드: Wordle류는 결과 이모지 텍스트 클립보드 복사, 퍼즐/시뮬류는 URL fragment에 상태 인코딩(lz-string + Base64url), 레이싱/러너류는 "ghost data"(입력 시퀀스 기록)를 공유해 비동기 대전 구현 [indexed snippet: scottantipa.com, stackoverflow.com, unity.com discussions].

## Adjacent Problems

- 브라우저 저장소 eviction: best-effort 저장은 디스크 압박 시 LRU로 origin 단위 전체 삭제. `navigator.storage.persist()`로 persistent 승격 가능(Chromium/Safari는 사이트 상호작용 이력 기반 자동 승인, Firefox는 사용자 프롬프트) [direct page retrieval: MDN Storage quotas].
- PWA 설치 여부가 Safari 7-day eviction 면제 조건 → 게임이 이미 PWA이므로 설치 유도가 저장 내구성 대책이 됨.
- URL 공유 시 URL 길이 제한: 실무 안전선 ~2,000자 (proxy/server 414 회피 기준) [indexed snippet: geeksforgeeks.org, lineserve.net 등 복수 출처 일치].
- 정적 사이트에서의 키 노출: Supabase `anon` key는 공개 전제로 설계되었으나 RLS 없으면 DB 전체 노출; `service_role` key는 절대 클라이언트 배포 불가 [indexed snippet: supabase.com docs 계열].
- 치팅: 서버 검증이 없으므로 공유되는 모든 기록은 클라이언트 재검증(결정론 리플레이)이 유일한 방어선. 본 게임 엔진은 이 방어선을 이미 내장.

## User Voices

- "Store the sequence of moves rather than the full state to keep the data payload small" — ghost data 패턴 권고 [indexed snippet: stackoverflow.com].
- "If a direct P2P connection fails (~10–20% of cases, especially corporate/strict networks), data must be relayed through a TURN server" — P2P 실패율에 대한 실무 증언 [indexed snippet: medium.com/edgegap.com WebRTC 실무 글].
- "Free projects are paused after 1 week of inactivity. Limit of 2 active projects." — Supabase Free 플랜의 방치-일시정지 조건, 소규모 인디 게임에 치명적일 수 있는 함정 [direct page retrieval: https://supabase.com/pricing].
- "On Workers Free plan: if you exceed any one of the free tier limits, further operations of that type will fail with an error." — Cloudflare DO 무료 한도 초과 시 하드 실패 [direct page retrieval: https://developers.cloudflare.com/durable-objects/platform/pricing/].
