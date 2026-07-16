# Tech Verification — DB & Multiplayer (Wave A)

- 작성: 2026-07-16, Systems researcher (DbMpResearch)
- 대상: Abyssal Surge (GitHub Pages 정적 호스팅, PWA, 결정론적 규칙 엔진)
- 조사 원본: `.survey/shadow-lord-db-multiplayer/` (triage/context/solutions)
- 게이트 규칙 준수: 모든 수치는 측정 방법 병기. 수치 없는 형용사 없음.

## 1. 전제 — 코드 사실 (읽기 전용 조사)

| 사실 | 근거 위치 |
|------|-----------|
| save envelope = `{schema, schemaVersion, rulesVersion, trace}` | `campaign-state.js:317-325` |
| `restoreSaveEnvelope`는 trace를 `createCampaign()`부터 전량 리플레이하며 각 이벤트를 규칙 엔진으로 검증 | `campaign-state.js:327-348` |
| trace 상한 200 events | `campaign-state.js:8` `MAX_TRACE_EVENTS` |
| 저장은 IndexedDB → localStorage → memory 3단 폴백 | `app.js:38-124` `CampaignStorage` |
| JSON 파일 export/import 이미 존재 | `app.js:383, 401` |

**함의**: envelope는 자가 검증형(self-validating) 리플레이 포맷이다. 위조 trace는 리플레이 중 assert로 거부된다. 단, "규칙상 합법이지만 실제 플레이하지 않은" trace 위조는 클라이언트 검증으로 막을 수 없다(§5 실패 모드 F6).

## 2. 실측 — Ghost-share 페이로드 크기·복원 지연

측정 방법: Bun 1.3.14 / Apple M2 Pro, `campaign-state.js`를 직접 import하여 실행.
- 시나리오 A(현실 케이스): greedy 정책으로 3-stage 캠페인 완주 → 실제 trace 32 events.
- 시나리오 B(균일 최악): trace를 최장 이벤트(`{"kind":"action","action":"materialize"}`, 41 bytes/event)로 200개 패딩.
- 시나리오 C(적대적 최악): 10종 이벤트를 LCG 난수로 섞어 200개 — gzip 반복 압축을 최대한 무력화.
- 복원 지연: warmup 50회 후 1,000회 반복 평균 (`performance.now()`).

| 측정 항목 | A: 실캠페인 32ev | B: 균일 200ev | C: 적대적 200ev |
|-----------|------------------|----------------|------------------|
| JSON bytes | 1,281 | 8,279 | 7,420 |
| gzip bytes | 215 | 202 | 509 |
| base64url(gzip) 길이 | **287자** | 270자 | **679자** |
| base64url(raw) 길이 | 1,708자 | 11,039자 | — |

| 지연 측정 | 값 | 방법 |
|-----------|-----|------|
| `restoreSaveEnvelope` 평균 (32 events) | 0.349 ms | 1,000회 반복 평균, Bun 1.3.14, M2 Pro |
| 200 events 외삽치 | ~2.2 ms | 선형 외삽 [INFERENCE: replay는 이벤트당 O(1) 규칙 적용이므로 선형 가정] |

**판정**: 최악 조건(C) 679자 « URL 실무 안전선 2,000자 (indexed snippet: geeksforgeeks.org 등 복수 일치). gzip 없이 raw base64url은 200 events에서 11,039자로 URL 초과 → **압축은 필수**. 브라우저에서는 `CompressionStream("gzip")`(Baseline 2023, 전 주요 브라우저 지원)으로 동일 결과. 복원 지연은 프레임 예산(16.7 ms) 대비 무시 가능.

## 3. 벤치마크 비교표 — 옵션별 무료 한도·레이턴시·보안

| 기준 | Z1: Ghost-share (채택) | Z2: 이모지 결과 공유 | B1: Supabase Free | B2: Firebase Spark | E1: CF Durable Objects / PartyKit | P1: WebRTC P2P |
|------|------------------------|----------------------|--------------------|---------------------|-----------------------------------|----------------|
| 무료 한도 | 무제한 (인프라 0) | 무제한 | 500 MB DB·5 GB egress·Realtime 200 conn/2M msg·**1주 방치 시 정지, 프로젝트 2개** [direct: supabase.com/pricing] | Firestore 1 GiB·50k reads/day·20k writes/day·RTDB 100 conn [indexed snippet — 채택 시 재검증] | 100k req/day·13k GB-s/day·SQLite 5 GB·초과 시 하드 실패 [direct: developers.cloudflare.com] | 시그널링 인프라에 종속 (Metered free: 100 conn·100k msg/월 [indexed snippet]) |
| 전송/응답 레이턴시 | 0 (클립보드/URL) + 복원 0.35 ms(32ev, 실측 §2) | 0 | REST 왕복: 리전 의존, 미실측 — 비동기 용도라 비차단 | 동일 | edge 근접 라우팅, 미실측 | P2P 직결로 최저 지연이나 TURN 릴레이 필요율 ~10–20% [indexed snippet: medium.com/edgegap.com] |
| 정적 사이트 키 노출 | 해당 없음 (키 자체가 없음) | 해당 없음 | `anon` key 공개 전제 + RLS 필수, RLS 누락 시 DB 전체 노출 [indexed snippet: supabase docs 계열] | Security Rules 필수 | 키 없음, 단 Worker 별도 배포 필요 | 키 없음, 공용 시그널링 가용성 리스크 |
| 치팅 방어 | 결정론 리플레이 검증 (엔진 내장) | 없음 (텍스트) | 서버 함수로 검증 가능 | 동일 | Worker에서 리플레이 검증 실행 가능 (최강) | 상호 클라이언트 검증 |
| 운영 부담 | 0 | 0 | 프로젝트 방치-정지 관리 필요 | 쿼터 모니터링 | 배포 파이프라인 신설 | 시그널링+TURN 운영 |
| 실시간 대전 | 불가 (비동기만) | 불가 | 가능 (Realtime, 200 conn) | 가능 (RTDB, 100 conn) | 가능 (WebSocket) | 가능 |

## 4. 결론 — 이번 사이클 채택안

### 채택: Z1 — save-envelope 기반 async ghost-share 코드 공유 (zero-backend 비동기 멀티플레이)

- **무엇**: `createSaveEnvelope` → `CompressionStream("gzip")` → base64url → URL fragment(`#g=...`) 또는 클립보드 코드. 수신 측은 역변환 후 `restoreSaveEnvelope`로 검증·리플레이하여 "고스트 캠페인"(상대 기록과 스테이지별 비교/대전 화면) 표시.
- **왜 지금**:
  1. 인프라·비용·키 노출 0 — 정적 호스팅 제약과 완전 정합.
  2. 실측 최악 679자로 URL 공유 가능 (§2), 복원 0.35 ms.
  3. 엔진의 결정론 리플레이 검증이 조작 방어를 공짜로 제공 (F6 한계는 §5).
  4. 기존 export/import(`app.js:383,401`)와 동일 코드 경로 재사용 — 신규 표면적 최소.
- **함께 채택 (저장 내구성, 동일 사이클 저비용)**: `navigator.storage.persist()` 1회 호출 + PWA 설치 유도 배너. 근거: persistent 승격 시 LRU eviction 면제, 설치형 PWA는 Safari 7-day eviction 면제 [direct: MDN Storage quotas].

### 차기 사이클 후보 (우선순위순)

1. **B1 Supabase Free** — 글로벌 비동기 기능(고스트 갤러리, 주간 챌린지 보드)이 필요해질 때. 전제 게이트: RLS 전 테이블 활성화 + 방치-정지 대응(주 1회 keep-alive 또는 유료 전환 판단).
2. **E1 PartyKit/Durable Objects** — 실시간 대전 요구 확정 시. WebSocket 하이버네이션 API 사용 전제(과금 §3 참조). GitHub Pages와 별도의 Worker 배포 파이프라인 비용을 수용할 때만.
3. P1 WebRTC는 보류 — 시그널링 서버가 어차피 필요해서 E1 대비 이점 없음 (TURN 실패율 10–20% 리스크만 추가).

## 5. 실패 모드 및 폴백 경로

| # | 실패 모드 | 감지 | 폴백 |
|---|-----------|------|------|
| F1 | 공유 코드 URL이 2,000자 초과 (이론상 불가능 — 실측 최악 679자이나, 스키마 확장 대비) | 인코딩 직후 길이 검사 | URL 대신 클립보드 코드 전용 모드로 전환 (클립보드는 길이 제한 없음) |
| F2 | 수신 envelope 검증 실패 (스키마/rulesVersion 불일치, 조작) | `restoreSaveEnvelope`의 assert 예외 | 기존 import 실패 UX 재사용 (`app.js:406` catch 경로) — 사용자에게 "호환되지 않는 기록" 메시지 |
| F3 | `CompressionStream` 미지원 브라우저 (Baseline 2023 이전) | `"CompressionStream" in window` 피처 검사 | raw base64url (32ev 실측 1,708자 — 현실 trace는 URL 한도 내) + 200ev 근접 시 F1 폴백 |
| F4 | 브라우저 저장소 eviction으로 로컬 캠페인 유실 | `load()` null 반환 | (기존) localStorage 폴백 → (신규) persist() 승격 + PWA 설치 유도로 발생률 자체를 낮춤 [direct: MDN] |
| F5 | rulesVersion 업그레이드로 구버전 고스트 코드 무효화 | F2와 동일 경로 | 정책: 마이너 룰 변경 시 rulesVersion 유지 + 리플레이 회귀 테스트, 브레이킹 변경 시 명시적 "시즌 리셋" 공지 |
| F6 | "합법이지만 위조된" trace (실제 플레이 없이 조립) | 클라이언트에서 감지 불가 | 범위 제한이 폴백: 이번 사이클 소셜 기능을 친구 간 비교로 한정, 전역 랭킹 금지. 서버 검증(차기 B1/E1) 도입 전까지 유지 |
| F7 | (차기 B1 채택 시) Supabase 1주 방치-정지 | 프로젝트 상태 모니터링 | keep-alive cron 또는 기능 비활성 배너; 게임 코어는 zero-backend라 영향 없음이 설계 불변식 |

## 6. 단계적 도입 게이트 (게임 프로그래머 신기술 검증 규약)

- **Gate V0 (본 문서로 통과)**: 페이로드 실측 — 최악 679자 < 2,000자 ✅; 복원 0.35 ms < 프레임 예산 ✅; 인프라 비용 $0 ✅.
- **Gate V1 (구현 후)**: round-trip property 테스트 — 임의 유효 trace 1,000건에 대해 `encode(decode(x)) == x` 및 리플레이 상태 동치. 통과 기준: 실패 0건.
- **Gate V2 (구현 후)**: 실브라우저 스모크 — Chrome/Safari/Firefox에서 URL fragment 공유 → 복원 → 고스트 화면 표시. iOS Safari 클립보드 권한 경로 포함. 통과 기준: 3 브라우저 모두 성공.
- **Gate V3 (G7 연동)**: 고스트 대전 루프가 30–180s 루프 규격에 들어오는지 QA 시뮬 확인 (QaBalanceSim 소관).
- **차기 사이클 진입 게이트**: 주간 고스트 공유 횟수가 측정 가능해지고(공유 버튼 클릭 카운트, 로컬 텔레메트리) 사용률이 유의미할 때만 B1(서버 저장) 검토 개시. 수치 기준은 PM이 Wave B에서 확정.

## 부록 — 측정 재현 방법

```
# Bun 1.3.14, repo root에서
# 1) campaign-state.js를 import, greedy 정책으로 캠페인 완주 (32 events)
# 2) JSON.stringify → Bun.gzipSync → base64url 길이 측정
# 3) 200-event 최악 케이스: 균일 패딩 + LCG(seed=42) 적대적 믹스
# 4) restoreSaveEnvelope 1,000회 반복 평균 (warmup 50회)
```
스크립트는 세션 eval 셀로 실행 (결과 원본: 본 문서 §2 표). 재현 시 동일 수치 ±10% 기대 (JIT/기기 편차).

## 출처 (전체 URL)

| 라벨 | 출처 |
|------|------|
| direct page retrieval | https://supabase.com/pricing (Supabase Free 한도: 500 MB DB·5 GB egress·50k MAU·Realtime 200 conn/2M msg·1주 방치 정지·2 프로젝트) |
| direct page retrieval | https://developers.cloudflare.com/durable-objects/platform/pricing/ (DO Free: 100k req/day·13k GB-s/day·SQLite 5 GB·초과 시 하드 실패·WebSocket 20:1) |
| direct page retrieval | https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria (localStorage 5 MiB/origin·persist() eviction 면제·Safari 7-day·설치형 PWA 면제) |
| direct page retrieval | https://blog.cloudflare.com/cloudflare-acquires-partykit/ (PartyKit 2024-04 인수, 표준 Workers 과금 외 추가 요금 없음) |
| indexed snippet | https://firebase.google.com/pricing (Spark: Firestore 1 GiB·50k reads/day·20k writes/day·RTDB 100 conn — 검색 요약 경유, 채택 시 직접 재검증) |
| indexed snippet | https://scottantipa.com/storing-app-state-in-urls (URL 상태 인코딩 실무 사례) |
| indexed snippet | https://github.com/subins2000/p2pt (트래커 기반 서버리스 WebRTC 시그널링) |
| indexed snippet | https://www.metered.ca/ (관리형 시그널링/TURN free tier: 100 conn·100k msg/월) |
| indexed snippet | https://webrtc.org/getting-started/peer-connections (WebRTC 시그널링 서버 필요성) |
| indexed snippet | https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream (CompressionStream Baseline 2023) |
| 로컬 측정 | 본 문서 §2 (Bun 1.3.14, Apple M2 Pro, 재현 방법 부록 참조) |
