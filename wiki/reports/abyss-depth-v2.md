---
type: report
date: 2026-07-30
related: "[[wiki/reports/2026-07-30-onslaught-pivot-gap-additions]]"
status: "구현 완료 (커밋 543194e8 v2 + 938fac99 UI겹침·캐시 수정)"
tags: [game-dev, difficulty-feel, abyss-depth, gap-research]
---

# Abyss Depth v2 — "게임처럼 느껴지는" 난이도 (재조사 + 재설계)

## 문제 (사용자 지적: 인게임에 바뀐 게 없음)
현재 Abyss Depth = **"+15% HP + 텍스트 배지"** → 적은 같은 정책으로 같은 타깃을 치고, 유일한 체감은 "같은 싸움, 더 느림"(=스탯스틱). 게다가 **심도 0은 identity**라 신규 세이브(0클리어)는 아무 변화도 못 겪는다. 지적이 정확하다.

## 재조사 (6게임, 게임필 관점)
Hades(Pact of Punishment) · Dead Cells(Boss Cells+엘리트 어피스+Malaise) · Risk of Rain 2(Eclipse+색코딩 elite) · Slay the Spire(Ascension 1–20) · Diablo/PoE(엘리트 어피스 팩) · Vampire Survivors(Arcana/Hyper). **6/6 수렴**: 난이도 단계 = **① 이름 붙은 규칙/능력 변화(글로벌 배수 아님) + ② 시각적으로 다르게 보임(재색 엘리트·오라·화면 처리·규칙 리스트) + ③ 보상 스테이크 결합.**
- 전문: `_workspace/20260728-gameplay-gap-research/research/difficulty-feel/report.md`
- 엔진 레버(현 코드 file:line): `.../difficulty-feel/engine-levers-for-feel.md`

## 재설계: 심도 = 이름 붙은 규칙변화 패키지
"+15% HP + 배지" 폐기 → 각 심도 = 4요소 묶음(적 정책믹스 고정 + 재색 엘리트 어피스 + 진입 연출 + 가시적 보상 스테이크).

| 심도 | 이름 | 행동 변화(숫자 아님) | 엘리트 | 진입 연출 | 보상 |
|---|---|---|---|---|---|
| D1 | 재의 추격 | `player-pursuit` 지배 — 적이 관문 대신 **지휘관 사냥** | 호위 +1, ember 오라 | 토스트+ember 틴트+경고 큐 | +1 티어 |
| D2 | 메아리 기근 | `resource-denial` 지배 — echo 차단, **지속력 고갈** + 회복예산 삭감 | 냉기 오라·denial | 토스트+한기 틴트+저음 큐 | 배수↑ |
| D3 | 협공의 장막 | `flank`+`low-hp-focus` + **빅/미드 밀도↑**(카메라·오디오 자동 고조) | ×HP↑, 호위 2기 | 토스트+보라 틴트+보스페이즈 큐 | 최고 티어 |

누적(StS식). 출전 셀렉터에서 **잠긴 심도도 패키지 내용 미리보기** → 잠겨도 "콘텐츠"로 읽힘.

## MVP (현 코드·결정론 안전·무수익화)
**#1 정책믹스 고정 + 진입 연출(토스트+틴트+큐) + 보상 스테이크** — 적이 다르게 **행동**하고(feel), 바뀐 걸 **알려주고**(legibility), 할 **가치가 생김**(stakes). 대략 +15% 패치 대체 비용. 엘리트 어피스·밀도·지속력 삭감은 심화 단계.
- 전체 스펙·엔진 매핑(file:line): `_workspace/20260728-gameplay-gap-research/production/abyss-depth-v2-proposal.md`

## 함께 처리된 것
- **UI 겹침 1차**(커밋 `674eb14c`): 심도 셀렉터를 전투개시 버튼 위 5.6rem/42dvh+5.4rem로 올려 겹침 해소(gap 14px).
- **UI 겹침 2차 = 모바일 오버플로 수정**(커밋 `938fac99`): 좁은 띠(218px)에서 셀렉터가 가로 한 줄이라 라벨이 좌측 덱을 침범하고 드롭다운이 화면 밖으로 나갔다 → **세로 스택**으로 재배치, 실측 넘침 0(라벨 x=119→175, 드롭다운 x=427→371).
- **"바뀐 게 안 보임" 근본 수정**(커밋 `938fac99`): 옛 서비스워커가 옛 캐시를 서빙하던 문제. `sw.js`가 로컬 빌드는 활성화 시 전 캐시를 비우도록(networkFirst 결합) → 재빌드 자동 반영. 실기 확인은 1회 `Cmd+Shift+R`.
- **before/after 데모**: `wiki/reports/abyss-depth-v2-demo/` (설명본 `.md` + 캡처 5장, 옵시디언 인라인). 열린 포트폴리오 볼트 사본: `ai-agent-portfolio/02-projects/abyssal-command-abyss-depth-v2/`.
