# 병합 후 시스템 상태 — cycle 9·10 통합 + 진입 라우팅 피벗

작성: 2026-08-04. 브랜치: `feature/first_lee`. HEAD: `ff0cbd74`.

이 문서는 `origin/main`(176 커밋)을 현재 브랜치로 fast-forward 병합한 직후의
시스템 상태를 코드에서 재분석한 것이다. 게이트 판정은 이 세션이 새로 측정하지
않았다 — cycle 9·10 회고의 판정은 **이월 증거(carried)** 로 인용하고, 이 세션이
실제로 실행한 것만 [OBSERVED]로 표기한다.

---

## 1. 병합 사실 [OBSERVED]

- 방식: fast-forward. `feature/first_lee`는 병합 전 `origin/main` 기준 0 ahead /
  176 behind였고, 병합 후 0/0으로 완전 동기화. 충돌 0건.
- 규모: 685개 파일, +684,619 / −1,663. 그중 `_workspace/current/` 하위 414개.
- 로컬 `main`은 병합 대상이 아니었다: `origin/main` 기준 244 커밋 뒤처진 stale
  브랜치이며, 현재 브랜치가 이미 그보다 앞서 있어 로컬 `main` 병합은 no-op였다.
- 병합이 진전시킨 작업 축: **cycle 9**(코어 루프·조작감)와 **cycle 10**(스테이지
  던전), 그리고 회고에 없던 **진입 라우팅 피벗**.

---

## 2. 가장 큰 구조 변화 — 진입 라우팅 피벗 [OBSERVED]

Pages 루트가 Three.js 캠페인에서 **2.5D 스프라이트 아레나**로 교체됐다. 시드
`_workspace/current/intake/seed-sprite25d-entry-routing.md`(FROZEN)의 옵션 c다.

| 경로 | 현재 내용 | 근거 |
|---|---|---|
| `index.html` | 2.5D 스프라이트 아레나 (`sprite-2-5d.js` 로드) | `index.html:13,220` — `sprite-2-5d.css` + `<script src="sprite-2-5d.js">` |
| `campaign.html` | 기존 Three.js 메인 캠페인 (`app.js`) | `campaign.html:10-11,30` — `styles.css`·`react-game-ui.css` + `<script src="app.js">` |
| `abbysal-oneline.html` | 오타본 → 정본 리다이렉트 | `abbysal-oneline.html:6` — `meta refresh 0; url=abyssal-oneline.html` |
| `abyssal-oneline.html` | 후속 연결(one-line) 페이지, CTA는 `campaign.html` | 커밋 `9d4f4bad`·`8d0813e3` — oneline CTA/fixture를 `campaign.html`로 재지정 |

의미: 루트 URL(`/`)로 들어오면 이제 3D 캠페인이 아니라 스프라이트 아레나가
노출된다. 3D 캠페인 자산·시뮬레이션(cycle 9·10 작업 대부분)은 `campaign.html`
뒤로 이동해 보존됐고 폐기되지 않았다.

**초기 오해 정정 [OBSERVED]:** 이 세션 초반 "프로젝트 실행"에서 루트가 렌더한 것은
Three.js가 아니라 이미 이 스프라이트 아레나였다. 브라우저 부팅 시 `hasThree:false`,
`<canvas>` 1개, 오일/충전/유물 HUD는 모두 `sprite-2-5d.js` 구조와 일치한다.
아이소메트릭 외형은 사전 렌더된 스프라이트 배경(`assets/images/sprite-2-5d/
cinder-court-backdrop.png`)이지 Three.js 씬이 아니다.

---

## 3. 신규 런타임 모듈 3종

### 3.1 `sprite-2-5d.js` — 잿불 법정 단일 페이지 아레나 [OBSERVED]

- 2D `<canvas>` 렌더러, 고정 60Hz 스텝(`FIXED_STEP 1/60`, 최대 5스텝 catch-up),
  깊이 스케일로 2.5D를 흉내낸다(`FAR_DEPTH_SCALE 0.62`~`NEAR 1`). `sprite-2-5d.js:1-11`.
- 자체 완결형 수치 계약: 플레이어 HP 100 / 속도 218 / 데미지 58, 적 cap 20,
  랜턴 충전 100(초당 7 재생, 킬당 6), 노바(비용 45·반경 250·데미지 96)·워드
  (비용 30·3초). `sprite-2-5d.js:12-36`.
- **오디오 무자산**: 오디오 파일 없이 오실레이터 엔벨로프로 큐를 합성한다(단일
  페이지·무자산 라우트 유지). `sprite-2-5d.js:479-556`.
- 자산 의존은 배경 1장 + 워든/코호트 스프라이트 시트·매니페스트뿐
  (`assets/images/sprite-2-5d/`). `sprite-2-5d.js:62-68`.
- 종료 시 `abyssal-oneline.html`로 전환(클리어·게임오버 공통, 9초 카운트다운),
  진행 상태는 `localStorage` 다이제스트로 전달. `sprite-2-5d.js:37-39,697-751`.
- 세계관은 캠페인과 공유(잿불 법정 = 하층 성유물고, 6개 LORE_BEATS 순환).
  `sprite-2-5d.js:42-52`.

### 3.2 `defense-speech-bubble.js` — 서사 전달 매체 교체 [OBSERVED]

- 캠페인(`campaign.html`/`app.js`)의 서사 전달을 `speechSynthesis` 음성에서
  **월드 공간 말풍선**으로 교체. 뮤트 탭·한국어 시스템 보이스 부재·3D 씬에서
  화자 신체에 부착 불가라는 세 결함을 해소. `defense-speech-bubble.js:1-24`.
- 편집 계약(어떤 이벤트가 말하는가·순서·중복제거·선점)은 `defense-audio.js`의
  `STORY_NARRATION_EVENT_TYPES`와 **집합이 동일**해야 한다 — 한 비트가 말풍선
  없이 음성 큐만 얻는 일을 막는 불변식. `defense-speech-bubble.js:33-45`.
- 2계층 분리: 순수 리졸버(`speechBubbleFor` 등, DOM·시계·오디오 없음, Node에서
  테스트 가능) + `SpeechBubbleDirector`(우선순위·중복·동시 3개 cap·홀드 타이밍).
  `defense-speech-bubble.js:12-18,260-369`. 뮤트가 말풍선을 숨겨선 안 되고 일시정지는
  버리지 말고 얼려야 한다는, 음성과 역(逆)인 수명주기가 분리 근거.
- 회귀: `tests/speech-bubble.test.mjs`.

### 3.3 `sealbound.js` — 별도 프로토타입 라우트 [OBSERVED]

- `sealbound.html`이 로드하는 독립 IIFE 프로토타입. 60Hz 고정 스텝, 정수
  에너지 자원(최대 6·초기 3·초당 0.6 재생)과 3능력(Crescent 1 / Rift Lance 2 /
  Bind Seal 3), 세 전선(cinder-span·abyss-chancel·echo-throne)을 정의한다.
  `sealbound.js:1-50`.
- 캠페인·스프라이트 아레나와 코드/자산을 공유하지 않는 별개 실험 라우트다
  (전선 이름만 세계관과 공유). 회귀: `tests/sealbound-browser.cjs`.

---

## 4. cycle 9 — 코어 루프·조작감 (캠페인 측) [carried]

권위 문서: `_workspace/current/retrospectives/cycle-9-retrospective.md`,
`_workspace/current/intake/production-brief-cycle9.md`. 아래는 회고의 판정이다.

- **추출 루프 성립**: 첫 중간보스 처치 시 `run.extractionUnlocked` on → 사체
  10초 유지 → 2초 채널링 → 동료 소환(중간보스 이후 등급만, `normal` 제외).
  E2E 게이트가 tick 3817→3936에서 legion 0→1을 실측(회고 §4 `verify-cycle9-extraction-e2e` PASS 6/6).
- **군단 3→10 도달 가능**: 용량이 동적으로 3→10 해석되고 10이 실제 도달 가능.
  경제 결함 2건(풀이 3에 불과, 슬롯 7–10이 3스테이지로는 영원히 잠김) 수정.
  9개 사이트에 걸친 blast radius 중 2곳이 silent였다(`defense-run-simulation.js:48`,
  `app.js:1187`).
- **아날로그 조이스틱**: 기존 조이스틱이 8옥탄트로 양자화되던 것을 연속값으로.
  옥탄트 표의 일반화이므로 digest-safe. 세로 모드 CSS 게이트까지 제거. 390×844
  실측 magnitude 563→966→1000.
- **에임 타게팅**: `AIM_BIAS_BP 30000` 가중, 에임 없으면 최근접과 bit-identical.
- **의도적 미실행**: 캐릭터별 공격 패턴(12무기 카탈로그는 import 0의 사장 모듈),
  캐릭터 리스케일.

## 5. cycle 10 — 스테이지 던전 [carried]

권위 문서: `_workspace/current/retrospectives/cycle-10-retrospective.md`,
`_workspace/current/intake/production-brief-cycle10-stage-dungeon.md`.

- **합성 던전 바닥**: 단일 절차적 quad → 슬래브 바닥(cinder 3·chancel 4·throne
  5) + 비보행 apron. wrap seam 0.0000, `fitFootprint` 1.000000. `resize-then-blend`가
  seam을 0으로 수렴시킨 핵심(JPEG q88은 seam을 1.3792로 악화). 4개 asset
  allowlist에 등록, `terrainRuntimeEligible:true`.
- **설계 스펙 6종(6,800+행)**: `stage-dungeon-composition-spec.md`,
  `stage-pacing-5to15min-spec.md`, `item-drop-timed-buff-spec.md`,
  `vfx-drop-spawn-terrain-spec.md`, `audio-feedback-dungeon-spec.md`,
  `ui/hud-overhaul-joystick-cutover-spec.md`.
- **오디오 피드백**: 발소리 un-shadowing(사장 코드 재배선), 신규 11큐,
  soundscape 6→9 상태.
- **HUD 개편**: 조이스틱 cutover 4구성(phone landscape/portrait·desktop·Steam),
  route rail·gimmick chip·버프 스트립.
- **RNG 레지스트리 고정**: `combatRng 0x9e3779b9` / surprise `0x6d2b79f5` /
  `dropRng 0x85ebca6b` / `gimmickRng 0xc2b2ae35`. 두 에이전트가 같은 상수를
  독립 선택한 충돌을 어떤 테스트도 못 잡았기에 4개로 폐쇄.

---

## 6. 게이트 상태 — 어느 사이클도 PASS를 만들지 않았다 [carried]

두 회고 모두 명시: **설계·자산은 측정이 아니다.**

| 게이트 | cycle 9 | cycle 10 |
|---|---|---|
| G1 세계관 | 영향 없음 | 영향 없음 |
| G2 밸런스 | 미측정 | 재측정 필요(pacing은 `[TARGET]` 미구현) |
| G3 편성 | 차단조건 CLEARED(사람 플레이 잔여) | cycle 9 소관, fence out |
| G4 몰입/접근성 | 미측정(세로 스틱 기능만 확인) | 부분 증거(4구성 측정, 사람 판정 없음) |
| G5 매출 | 신규 OPEN 미측정(earn 3→12) | — |
| G6 운영/성능 | 부분(VFX cap 24, storm 측정 미완) | 부분(터레인 30–40ms, draw-call/frame 미측정) |
| G7 코어 루프 | 미측정 | 재측정 필요(5–15분 완주 미측정) |
| G8 최초 노출 | 미측정 | 미측정 |

---

## 7. 미결·리스크

- **drop/buff 레인 미종결 [carried]**: 시뮬 코드(`run.buffs`·`dropRng`·
  `rollBuffDrop`·`expireBuffs`·`reconcileGateCap`·`BUFF_ITEMS`)는 착지했으나
  스펙 §9의 결정성 7체크가 하드 게이트이고 `grep -rl dropRng tests/`가 무결과였다.
  이후 관련 테스트(`tests/aoe-burst-wide-hit-contract`, `stage-*` 계약군)가 병합에
  포함됐으나, 7체크 종결 여부는 이 세션이 재측정하지 않았다.
- **cycle 10 orphan 문제는 병합으로 해소 [INFERENCE]**: cycle 9 회고가 미결로
  남긴 "`feat/cycle10-stage-dungeon`을 병합할지 아카이브할지" 결정은, 해당 작업이
  `origin/main`에 이미 들어와 이번 병합으로 현재 브랜치에 반영되면서 사실상 병합
  경로로 정리됐다.
- **전체 스위트 baseline**: cycle 10 회고는 5차 시도에서 57파일 566 pass / 1 fail
  (`stage1b-persistence.test.mjs:332`, base에서도 재현되는 이월 실패)로 종결됐다고
  기록. 이 세션은 전체 스위트를 재실행하지 않았다.

---

## 8. 이 세션이 실제로 검증한 것 [OBSERVED]

정적 서버 `python3 -m http.server 8000`(127.0.0.1) 기준:

- 라우트 HTTP: `/`=200, `/campaign.html`=200, `/sprite-2-5d.js`=200,
  `/sealbound.html`=200.
- 서빙된 루트가 참조하는 스크립트: `src="sprite-2-5d.js"` (grep 확인) — 라우팅
  피벗이 디스크뿐 아니라 실제 서빙에서도 유효.
- 루트 브라우저 부팅: console/page 에러 0, `<canvas>` 1개 렌더, `hasThree:false`,
  HUD·스킬 패널 정상. 초기 실행에서 웨이브 1 진행 후 게임오버 화면까지 도달.

이 절 밖의 수치(게이트, 테스트 카운트, seam/pacing 등)는 모두 §4–§7의 [carried]
이며 이 세션의 새 측정이 아니다.

## 9. 다음 물리적 단계

1. drop/buff 스펙 §9 결정성 7체크를 실제 실행해 게이트 종결 여부 확정.
2. `campaign.html`(3D)·`index.html`(2.5D) 두 라우트의 사람 플레이 판정으로
   G4/G7/G8 이동.
3. `sealbound` 프로토타입의 존치/승격/아카이브 결정(현재 독립 실험 상태).
