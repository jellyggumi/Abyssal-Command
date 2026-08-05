# Solutions

조사 대상: 2D/2.5D 탑다운·아레나 액션에서 타격감을 만드는 표준 "juice" 기법과, 참조 게임(Vampire Survivors / Hades / Soul Knight / Dead Cells 계열)의 반복 패턴. 각 항목은 Abyssal 루트 라우트(canvas2d·결정론·다크판타지 청록/주황 팔레트)에 적용 가능 여부로 판정한다.

## Solutions

### 1. 히트스톱(Hit-stop / freeze frame)
타격 순간 관련 오브젝트(또는 전체)를 3~5프레임 정지시켜 "무게"를 각인. 무거운 공격일수록 길게. 전역 timeScale보다 국소 정지 권장. [OBSERVED] 문헌 반복 1순위 기법.
- **Abyssal 적용 [INFERENCE]:** 루트 라우트는 RNG 없음 + digest는 종료 요약뿐 → `fixedUpdate` 앞에 `hitStopTicks` 카운터를 두고 N틱 동안 시뮬 스텝을 건너뛰어도 결과 불변. 라이트 히트 2~3틱, 노바/처치 4~6틱. 감소된 모션에서는 1틱 또는 0. **여기선 안전한 결정론 예외.**

### 2. 스프라이트 실루엣 플래시(damage flash)
피격 시 스프라이트 픽셀을 몇 프레임 흰색/밝은색으로 덮어 "맞았다"를 즉시 통지. 셰이더 없는 canvas2d에서는 `globalCompositeOperation='source-atop'` + 스프라이트 bbox fillRect로 실루엣만 틴트. [OBSERVED] canvas2d 표준 기법.
- **Abyssal 적용 [INFERENCE]:** 현재의 "타원 외곽선"을 **스프라이트 자체가 번쩍이는** 실루엣 플래시로 교체/보강. 첫 2~3프레임 강한 흰색 → 색조 플래시로 감쇠. 별도 화이트 시트 불필요.

### 3. 화면 흔들림(screen shake)
카메라를 짧게 랜덤/노이즈 오프셋 후 이징으로 감쇠(0.1~0.3s). 이벤트별 강도 차등으로 "언어" 형성. 과용 시 멀미. [OBSERVED] 문헌 반복.
- **Abyssal 적용 [INFERENCE]:** `render()` 진입 시 base transform 위에 `translate(shakeX, shakeY)`를 save/restore로 감쌈. 라이트 히트 미세 지터, 노바/처치 강한 셰이크. 감소된 모션 시 강도 0. digest 무관.

### 4. 파티클 버스트(impact particles)
접촉 지점에 불티/파편/먼지를 짧게 방출. 종류별 색·모양 구분. 성능은 단일 스프라이트시트·`'lighter'` 배칭·정수 좌표. [OBSERVED] 문헌 + canvas2d 최적화.
- **Abyssal 적용 [INFERENCE]:** 다크판타지 청록/주황 팔레트에 **불티(ember spark)**가 완벽히 맞음. 경량 파티클 풀(고정 상한, e.g. 64) + 렌더 순서: 일반 스프라이트 → `'lighter'`로 파티클 → `source-over` 복귀. 피격=주황 불티, 노바=대량 방사, 처치=파편 폭발.

### 5. 슬래시 트레일(slash trail)
무기 궤적을 mesh/폴리라인으로 그려 이동을 시각화. 빠른 궤적은 베지어 스무딩. [OBSERVED] 문헌.
- **Abyssal 적용 [INFERENCE]:** 현재 정적 호를 공격 프레임 동안 스윕하는 **초승달 트레일**(그라디언트 알파 폴리곤)로 교체. 방향(facing)에 따라 좌/우 스윕.

### 6. 넉백/스태거(knockback & flinch)
피격 시 적을 접촉 반대로 살짝 밀거나 뒤로 변위. 데미지 비례 거리. 커스텀 애니 없으면 순간 변위로 대체. [OBSERVED] 문헌.
- **Abyssal 적용 [INFERENCE]:** 시뮬 넉백은 규칙 변경이라 회피. 대신 **렌더 전용 넉백 오프셋**(캠페인의 `IMPACT_KNOCKBACK` 패턴 이식) — 매 프레임 권위 위치로 복귀시켜 digest 무관. 캠페인이 이미 검증한 접근.

### 7. 데미지 넘버(floating damage numbers)
데미지량을 숫자로 튀워 성장·크리티컬을 즉시 전달. Vampire Survivors류의 핵심 도파민. [OBSERVED] 문헌.
- **Abyssal 적용 [INFERENCE]:** 경량 텍스트 파티클(상승+페이드). 선택적(가독성 vs 정보). 노바 다중 히트 시 숫자 폭포로 "파워 판타지" 강화.

### 8. 처치 스펙터클(kill spectacle)
사망을 단순 페이드가 아니라 파편 폭발+플래시+짧은 셰이크로 "보상". [OBSERVED] 문헌(Hades/Soul Knight).
- **Abyssal 적용 [INFERENCE]:** 현재 `fadeTime` 페이드아웃에 처치 순간 불티 폭발 + 미세 셰이크 + (선택)히트스톱 4~6틱 오버레이.

## Frequency Ranking
문헌·참조 게임에서 "필수"로 반복 언급되는 순서(타격감 기여도 높은 순):
1. 히트스톱 — 무게의 1순위, 거의 모든 소스가 "가장 강력한 도구"로 지목.
2. 스프라이트 플래시 — "맞았다" 확정의 표준·최저비용 고효과.
3. 화면 흔들림 — 힘/강도 전달.
4. 파티클 버스트 — 반응/에너지, 스펙터클의 몸통.
5. 넉백/스태거 — 물리적 반응.
6. 슬래시 트레일 — 이동/궤적.
7. 데미지 넘버 — 성장/크리티컬 정보(선택).
8. 처치 스펙터클 — 위 요소들의 레이어링.

## Categories
- **타이밍 조작(무게):** 히트스톱.
- **즉각 확정(닿음):** 스프라이트 플래시, (오디오).
- **힘 전달:** 화면 흔들림, 넉백.
- **스펙터클/에너지:** 파티클, 슬래시 트레일, 처치 폭발.
- **정보:** 데미지 넘버, HP 바(기존).

## Curated Sources
- game-feel/juice 개론(hit-stop·screen shake·particles·layering): medium.com, hackread.com, thedesignlab.blog, moremountains.com, gamedeveloper.com (indexed snippet).
- 탑다운 아레나 특화(sprite flash·hitstop·slash trail·knockback): 통합 문헌 정리 (indexed snippet).
- 참조 게임 분석(Vampire Survivors / Hades / Soul Knight의 juice): gameanalytics.com, cornell.edu, bloodmooninteractive.com (indexed snippet).
- canvas2d 구현(`source-atop` 틴트 플래시·`lighter` 파티클 배칭·정수 좌표): stackexchange.com, pixijs.com, mozilla.org (indexed snippet).
- 저장소 내부 계약: `CLAUDE.md §2`, `wiki/concepts/runtime-presentation-and-arrival-choreography.md`, `sprite-2-5d.js`, `tests/sprite-2-5d-browser.cjs` (direct page retrieval).

## What People Actually Use
참조 게임들은 개별 기법이 아니라 **레이어링**을 쓴다: 한 타격 = 소리 + 스프라이트 플래시 + 파티클 버스트 + 히트스톱 + 화면 흔들림이 동시 발화. Vampire Survivors는 "시각 과부하 자체를 보상"으로(숫자·폭발이 화면을 채움), Hades/Soul Knight는 "스냅함 + 임팩트 프레임 + 사운드"로 정밀함을 판다. 공통점: **입력→피드백 지연 최소화**와 **다감각 동시 발화**. [OBSERVED]

## Common Workarounds
셰이더가 없는 환경(초기 프로토·canvas2d)에서는 (a) 화이트 스프라이트 오버레이 대신 `source-atop` 실루엣 틴트, (b) 파티클 스프라이트시트 1장 배칭, (c) 전역 timeScale 대신 국소 프레임 정지로 히트스톱을 흉내낸다. [OBSERVED]

## Pain Points With Current Solutions
- 흔들림·플래시 과용 → 멀미·가독성 저하. 강도 차등과 감소된 모션 대체가 필수. [OBSERVED]
- 히트스톱 전역 적용 시 UI·사운드 타이밍 오염. 국소 정지 권장. [OBSERVED]
- canvas2d 파티클은 상태 변경(`globalCompositeOperation`)이 잦으면 병목. 반드시 배칭. [OBSERVED]

## Sources
동일 목록: `## Curated Sources` 참조. 웹 소스는 Google 검색 그라운딩 경유 indexed snippet, 저장소 소스는 direct page retrieval.

## Key Insight
격차의 실체는 "이펙트 종류 부족"이 아니라 **레이어링과 무게의 부재**다. 루트 라우트의 전투 피드백은 전부 얇은 stroke 한 겹뿐이고, 타격 순간에 여러 감각이 동시에 터지지 않는다. 그리고 결정적으로, **이 라우트는 RNG가 없고 digest가 종료 요약만 저장하므로 히트스톱·흔들림·파티클을 결과 불변으로 안전하게 넣을 수 있다** — 캠페인 라우트의 시뮬-digest 제약이 여기엔 적용되지 않는다.

## Key Gap
가장 큰 미측정 가설[TARGET]: 각 기법의 정확한 강도·지속(틱/프레임/px)과, 다수 적·노바 동시 히트 시 파티클 상한이 60Hz p95 프레임 예산을 지키는지. 이는 구현 후 실측으로만 종결된다(계약 테스트 + 프레임 계측).
