# Abyss Depth v2 — "게임처럼 느껴지는" 난이도 재설계 제안

> 근거: `../research/difficulty-feel/report.md`(6게임·게임필) + `../research/difficulty-feel/engine-levers-for-feel.md`(현 코드 레버 file:line) + 현 구현(커밋 `fc8599cb`, `674eb14c`). 전부 **현 디펜스-서바이버 빌드에서 렌더 가능**, 결정론(`getRunDigest`)·reduced-motion·무수익화 보존. 상태: `[제안]` — 구현 승인 대기.

## 왜 지금은 "인게임에 바뀐 게 없다"가 맞나 (근본원인)
1. **심도 0이 설계상 완전 identity** → 신규 세이브(0클리어)는 심도 1+를 못 열어 **아무 변화도 못 겪는다.**
2. **심도 1+여도 변화가 "+15% HP + 텍스트 배지"뿐** → 적은 같은 정책으로 같은 타깃을 치고, 유일한 체감은 "같은 싸움, 더 느림"(=스탯스틱). 진입 순간도, 스테이크도 없음.
3. 엔진에 이미 있는 극적 연출(빅웨이브/미드보스 카메라 티어 `battle-realtime-three.js:743-751`, 경고 큐 `defense-audio.js:199,225`)이 **심도로 트리거되지 않는다.**

6게임(Hades·Dead Cells·RoR2·StS·Diablo/PoE·VS)이 6/6으로 같은 답을 준다: **난이도 단계 = 이름 붙은 규칙/능력 변화 + 시각적으로 다르게 보임 + 보상 스테이크 결합.** 우리도 그렇게 바꾼다.

## 핵심 전환
**"심도 = +15% HP + 배지"를 폐기**하고 **"심도 = 이름 붙은 규칙변화 패키지"** 로. 각 심도 = 4요소 묶음:
1. **적 정책믹스 고정**(적 행동이 바뀜) — 스탯스틱 탈출의 최고효율
2. **재색 엘리트 어피스 1종**(눈에 띄게 다른 적 + 새 위협)
3. **진입 연출**(토스트 + 화면 틴트 + 오디오 큐) — "이건 다른 모드다" 신호
4. **가시적 보상 스테이크**(출전 셀렉터·결과 카드에 보상 상승 표시)

`+15%`는 완전 제거가 아니라 **헤드라인에서 강등**(잔잔한 언더톤, 배지가 아니라 패키지가 주인공).

## 심도별 패키지 (3단계, clear-to-unlock, 결정론 프리셋)

| 심도 | 이름 | ①정책믹스(행동변화) | ②엘리트 어피스 | ③진입 연출 | ④보상 스테이크 |
|---|---|---|---|---|---|
| **D1** | 재의 추격 (Ashen Pursuit) | `player-pursuit` 지배 — 적이 관문 대신 **지휘관을 사냥** | guardian 호위 +1, ember 오라 재색 | 토스트 "심연 1 · 추격 활성" + ember 틴트 + warning 큐 | 보상 선택 +1 티어 표시 |
| **D2** | 메아리 기근 (Echo Famine) | `resource-denial` 지배 — echo 픽업 차단, **지속력 고갈** + 웨이브 회복예산 삭감 | 냉기 오라 엘리트, denial 능력 | 토스트 + 한기 틴트 + 저음 큐 | 보상 배수 표시 상승 |
| **D3** | 협공의 장막 (Veil of Flanking) | `flank`+`low-hp-focus` — 측면·약자 집중, **빅/미드 웨이브 밀도↑**(카메라·오디오 자동 고조) | ×HP↑ + 호위 2기, 보라 오라 | 토스트 + 심연 보라 틴트 + 보스페이즈 큐 재활용 | 최고 보상 티어 |

각 심도는 하위 심도 규칙을 **누적**(StS Ascension식). 출전 셀렉터에서 잠긴 심도도 **패키지 내용을 미리 보여줘**(preview) 잠겨 있어도 "콘텐츠"로 읽히게.

## 엔진 매핑 (전부 현 코드 레버, file:line)
| 요소 | 레버 | 위치 | 비용 |
|---|---|---|---|
| ① 정책믹스 고정 | 일반 웨이브가 시드풀로 fall-through하는 것을 심도별 `policyId` 고정 | `defense-run-simulation.js buildWaveSchedule:475-476`, `defense-catalog.js buildDoctrineWavePlan:717-723` | cheap |
| ② 엘리트 어피스 | 엘리트 스폰 블록을 심도별 파라미터화(정책·호위수·HP배수) | `defense-run-simulation.js:2881-2904`, `spawnEnemy:679` | cheap-med |
| ③ 진입 토스트 | `showToast` 1콜(지배 정책 명시) | `app.js` 토스트 경로 | cheap |
| ③ 화면 틴트 | 스테이지 팔레트 틴트 프리미티브 재사용 | `battle-realtime-three.js:597,2121-2201` | cheap |
| ③ 오디오 큐 | 미사용 큐(`boss-phase`/`warning-pulse`) 재활용 | `defense-audio.js:138-141,199` | cheap |
| ④ 보상 스테이크 | `TERMINAL.rewardChoices` 심도 매핑 + 결과 토스트·출전 셀렉터 표기 | `defense-run-simulation.js:3030-3036`, `app.js:3510-3512` | cheap-med |
| (지속력 삭감, D2) | `WAVE_CLEARED` 회복예산 `maxIntegrity/4` 심도별 축소 | `defense-run-simulation.js`(회복예산부) | cheap |
| 자동 카메라·오디오 고조(D3) | 빅/미드 웨이브 kind이 이미 카메라 티어·경고 큐 구동 | `battle-realtime-three.js:743-751`, `defense-audio.js:199,225` | free(파생) |

**전부 결정론 안전**(wave-rng·오소링 데이터·프레젠테이션만; 시뮬 tick 불변). **reduced-motion 안전**(틴트/토스트/큐의 비모션 등가 존재). **무수익화**(보상은 숙련·시간).

## 회피 (불만 데이터)
- 화면 밖/미텔레그래프 사망(Dead Cells 4→5BC 경고), 곱셈 폭주(RoR2 "delete or be deleted"), solved-build 반복(VS) → 정책 로테이션 + 텔레그래프 유지로 회피.
- **hitstop은 needs-build + 결정론 위험** → 이번 범위 제외(엔진레버 문서 정정: 현재 hitstop 없음).
- 유료 난이도 스킵 금지(무수익화).

## 최소 구현 슬라이스 (MVP)
**#1 정책믹스 고정 + ③ 진입 연출(토스트+틴트+큐) + ④ 보상 스테이크** = "새 콘텐츠"로 읽히는 최소 묶음.
- 적이 **다르게 행동**(feel) + **바뀐 걸 알려줌**(legibility) + **할 가치가 생김**(stakes).
- 대략 +15% 패치를 대체하는 비용, 결정론 안전.
- ② 엘리트 어피스와 D2 지속력 삭감·D3 밀도는 그다음 심화. 피벗기 보스페이즈/닷지패턴/hitstop은 최종 천장(이번 범위 밖).

## 검증 계획 (구현 시)
- depth 0 identity 유지(`getRunDigest` 바이트 동일) — 기존 유닛 76/76·CI 3/3.
- depth≥1: 정책 분포가 실제로 바뀌는지(정책별 스폰 카운트), 진입 토스트/틴트/큐 발화, 결과 카드 보상 상승 표기 — Playwright로 캡처.
- 성능: D3 밀도 상승 시 p95 ≤16.7ms·VFX 상한 유지.

## 출처
- 6게임 JSON: `../research/difficulty-feel/results/*.json` (Hades·Dead Cells·RoR2·StS·Diablo/PoE·VS)
- 엔진 레버: `../research/difficulty-feel/engine-levers-for-feel.md`
- 종합: `../research/difficulty-feel/report.md`
