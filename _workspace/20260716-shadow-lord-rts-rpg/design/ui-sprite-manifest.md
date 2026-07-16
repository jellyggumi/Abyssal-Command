# UI 스프라이트 매니페스트 — Shadow Lord RTS-RPG (Abyssal Surge)

Wave A 산출물. `assets/images/ui/` 하위 16개 PNG의 생성 기록·프롬프트·통합 가이드.

## 생성 파이프라인 (측정 포함)

| 단계 | 도구/방법 | 측정치 |
|---|---|---|
| 생성 | `gti --provider codex-cli` (private-codex는 HTTP 429로 폴백) | 1장당 wall time ~87s (action-hunt 단독 측정 86.76s), 원본 1254×1254 (portrait 1122×1402 / 1024×1536), 원본 1.6–2.4MB |
| 다운스케일 | `sips -Z 512` (종횡비 유지) | 512px 기준, RGBA 유지 |
| 배경 정리 | `ops/fix_background.py` — 모델이 투명 배경 대신 **가짜 체커보드**(회색 ~232/252 교대) 또는 **그린스크린**을 그려넣음 → 테두리 BFS flood-fill로 배경 감지 후 단색 `#0E1218` 치환 + 경계 45% 블렌드 페더링 | 배경 비율 37–69% 치환 (파일별 로그: fix_background 실행 출력) |
| 그린 잔여 제거 | `ops/degreen.py` — greenness = g − max(r,b) > 16 픽셀을 어둡게 블렌드 (teal은 b≈g라 보존) | assault 4,141px / throne-echo 28,820px / ember-cohort 303px 처리 |
| 압축 | Pillow `quantize(256, MEDIANCUT, FLOYDSTEINBERG)` 팔레트 PNG | 총합 6.01MB → **0.90MB** (85% 감소) |

**투명 배경 실패 기록**: 16/16 전부 생성기가 알파 채널 없이 체커보드/그린스크린을 페인팅함 (알파 히스토그램 전수 검사: a0=0, a255=대부분). 과제 허용 폴백대로 어두운 단색 `#0E1218` 배경으로 통일 — 게임의 심해 팔레트와 일치하며 16장 전체가 동일 배경이라 세트 일관성 확보.

## 파일 표 (16/16 성공 — 재시도 필요 없음)

| 파일 | 크기 | 용량 | 프롬프트 요지 (전체 프롬프트: `ops/genlogs/` 및 아래 스타일 규격) |
|---|---|---|---|
| `action-hunt.png` | 512×512 | 55KB | void sonar eye — 동심 에코 링을 발산하는 거대 안구 |
| `action-extract.png` | 512×512 | 52KB | soul wisp torn from rift — 균열에서 뜯겨나오는 영혼 리본 |
| `action-materialize.png` | 512×512 | 46KB | shadow soldier coalescing — 연기·보라 불씨에서 응고되는 병사 |
| `action-capture.png` | 512×512 | 53KB | dark banner on ley-node — 룬 맥동하는 어둠 군기 |
| `action-possess.png` | 512×512 | 53KB | ethereal hand gripping sentinel — 석상 구속하는 유령 손 |
| `action-domain.png` | 512×512 | 66KB | monarch aura dome — 왕관 정점의 군주 오라 돔 |
| `action-assault.png` | 512×512 | 74KB | shadow blade strike — 보라 궤적의 그림자 대검 |
| `reward-ember-cohort.png` | 512×512 | 55KB | Ember Cohort (+12 legion slots) — 불씨 병사 대열 |
| `reward-rift-lens.png` | 512×512 | 50KB | Rift Lens (possession +1 dmg) — 균열 에너지 집속 렌즈 |
| `reward-veil-vanguard.png` | 512×512 | 66KB | Veil Vanguard (+1 materialize shade) — 선봉 정예 셰이드 |
| `reward-anchor-shard.png` | 512×512 | 67KB | Anchor Shard (+16 legion slots) — 닻 형상 흑요석 결정 |
| `reward-throne-echo.png` | 512×512 | 72KB | Throne Echo (final oath archive) — 기억 링 공명 옥좌 잔향 |
| `reward-dawnless-crown.png` | 512×512 | 53KB | Dawnless Crown (gate-forged crown) — 게이트 파편 흑철 왕관 |
| `boss-cinder-warden.png` | 409×512 | 55KB | Cinder Warden — 용암 균열 갑주의 재의 기사 (Stage 1, HP 8) |
| `boss-veil-tactician.png` | 341×512 | 38KB | Veil Tactician — listening-stone 얼굴의 후드 전략가 (Stage 2, HP 9) |
| `boss-gate-sovereign.png` | 409×512 | 54KB | Gate Sovereign — 불타는 게이트 아치 왕관의 거인 군주 (Stage 3, HP 12) |

**합계: 919KB (0.90MB) ≤ 4MB 목표 충족. 개별 최대 74KB ≤ 300KB 충족. 검증: `du` + Pillow 전수 측정 (위 표 수치).**

## 스타일 규격 (세트 일관성)

- 공통 접미 프롬프트: `deep abyssal teal and violet palette with faint ember accents, strong chiaroscuro painterly shading, dark fantasy painterly concept art style, centered emblem composition, no text, no frame, no watermark`
- 보스 초상은 `dramatic bust portrait composition` + `ember red accents` (Stage 배경 이미지의 붉은 게이트 톤과 연결)
- 톤 매칭 기준: `assets/images/cinder-span.png` (심해 청록+보라, 붉은 균열 광원)
- 배경: 전 파일 공통 `#0E1218`

## 통합 가이드 (어느 UI 요소에 어떤 파일)

| UI 요소 | 파일 | 권장 표시 크기 |
|---|---|---|
| 액션 버튼 (hunt/extract/materialize/capture/possess/domain/assault 7종) | `ui/action-*.png` | 48–64px 아이콘. `border-radius` + 어두운 배경이라 원형/사각 크롭 모두 자연스러움 |
| 보상 선택 카드 (스테이지 클리어 시 2택) | `ui/reward-*.png` | 카드 상단 96–128px. `chooseReward()` UI의 rewardId와 파일명 1:1 매칭 (`reward-<rewardId>.png`) |
| 스테이지 브리핑/보스 패널 | `ui/boss-*.png` | 세로형(409×512, 341×512) — 패널 우측 세로 배치 권장. STAGES[i].id ↔ cinder-warden(1)/veil-tactician(2)/gate-sovereign(3) |
| 전투 로그 하이라이트 | 해당 액션 아이콘 재사용 | 24–32px 인라인 |

- 파일명 규칙: 액션은 `action-<actionId>.png`, 보상은 `reward-<rewardId>.png` — `campaign-state.js`의 id 문자열과 정확히 일치하므로 `\`assets/images/ui/reward-\${reward.id}.png\`` 형태로 바인딩 가능.
- 배경색 `#0E1218`은 카드/버튼 배경을 같은 색으로 깔면 아이콘 경계가 사라져 풀블리드처럼 보임.
- app.js/index.html/styles.css는 이 Wave에서 수정하지 않음 (다른 세션 소유) — 통합 시 위 표만 참조하면 됨.

## 재현 명령

```sh
# 생성 (파일당 ~87s)
gti --prompt "<프롬프트>" --output assets/images/ui/<name>.png --provider codex-cli
# 후처리
sips -Z 512 assets/images/ui/<name>.png
python3 _workspace/20260716-shadow-lord-rts-rpg/ops/fix_background.py
python3 _workspace/20260716-shadow-lord-rts-rpg/ops/degreen.py <green이 남은 파일들>
```
