# 3D 캠페인 타격감 개선 — 조사 결과 및 계획

대상: `campaign.html` → `app.js` + `battle-realtime-three.js` (Three.js/WebGL 스웜 오토배틀러). 상태: **조사 완료 — 결정 대기, 코드 미변경.**
경계: `CLAUDE.md §2`(결정론 하드 불변식), `getRunDigest()` SHA-핀 테스트군.

## 0. 핵심 발견 — 캠페인은 스프라이트 루트처럼 빈약하지 않다
스프라이트 루트는 "얇은 stroke 한 겹"이 전부였지만, **캠페인은 이미 성숙한 타격감 시스템**을 갖고 있다. grep·코드로 확인한 현존 요소:

| 요소 | 위치 | 상태 |
|---|---|---|
| 피격 플래시(emissive+반투명 blink, heavy/critical 색 구분) | `battle-realtime-three.js:6248 registerImpactFeedback` | ✅ 있음 |
| 렌더 넉백(실루엣 질량 스케일) | `:6277 knockbacks` | ✅ 있음 |
| 카메라 셰이크(보스/AoE 변형, 감쇠) | `:6290, :6440 applyKnockbacks / :6481` | ✅ 있음 |
| 임팩트 시그니처(크리티컬 골든 스피어) | `:2411 IMPACT_SIGNATURES` | ✅ 있음 |
| AoE 버스트 링/아크 | `:2512 AOE_BURST_SIGNATURES` | ✅ 있음 |
| 컨택트 스태거(다수 타겟 시차) | `:5987 impactContactDelayMs` | ✅ 있음 |
| **플로팅 데미지 넘버**(풀링 24, 크리 인식) | `app.js:3833-3870 .world-damage-number` | ✅ **이미 있음** |

즉 스프라이트에 새로 넣은 juice의 대부분이 캠페인엔 **이미 존재**한다.

## 1. 실제 격차 (grep으로 부재 확인)
1. **컨택트 스파크/불티 파티클** — 접촉 지점의 파편 방출. `THREE.Points`/파티클 버스트 심볼 grep 무결과 = **부재**.
2. **히트스톱** — `hitStop`/`timeScale`/`freezeFrame` grep 무결과 = **부재**.

## 2. 결정론 안전성 (증거)
- `getRunDigest(run) = JSON.stringify(getRunSnapshot(run))` — **런 상태의 순수 함수**. RNG·타이밍은 직렬화 안 됨(`defense-run-simulation.js:5708`).
- 디짓 테스트군은 전부 **직접 `advanceDefenseRun(run, N)` 틱 루프**로 구동 — 월클럭 `loop()`을 타지 않음.
- **히트스톱**: `app.js loop():2820-2827`의 accumulator를 잠깐 멈추는 것. 이미 pause/cutscene/hidden에서 동일하게 sim을 멈추고 digest 영향 0 → **자동 짧은 pause = digest-safe**.
- **스파크**: 렌더러가 frozen 스냅샷만 읽음(기존 flash와 동일). `defense-observers-contract`/`defense-renderer-contract`가 "렌더가 digest 불변"을 검증 → 계약 내.

## 3. 설계상 함정 — 스웜 오토배틀러
캠페인은 단일 타겟 스프라이트 아레나와 다르다. **동시에 20+ 적이 피격**된다. 매 타격 히트스톱은 **끊김(stutter)**을 유발 → 표준 해법은 **선택적 히트스톱**(크리티컬/보스/heavy에만). 기존 코드도 이미 셰이크를 `IMPACT_SHAKE_BOSS_AMPLITUDE`로 보스만 강조하는 선례 있음.
스파크도 반드시 **풀링·상한·소프트웨어렌더/감소된모션 다운그레이드**를 지켜야 함(기존 VFX 예산 계약과 draw-count 테스트 준수).

## 4. 계획 (승인 시)
### A. 컨택트 스파크 (렌더러, 명확한 이득)
- `registerImpactFeedback`에서 접촉 지점 world 좌표로 스파크 버스트 방출.
- 기존 패턴 정확히 답습: `this.impactSparks` 풀 → `applyImpactSparks(nowMs)` 매 프레임 → reset/dispose/reduced-motion에서 clear. `THREE.Points` + additive, 상한(예: 동시 8버스트), 소프트웨어렌더 시 축소/비활성.
- dispose 계약 준수(geometry/material 정확히 1회, 멱등).

### B. 선택적 히트스톱 (세션 루프)
- `app.js loop()`에 `hitStopUntilMs`. frameEvents에 `CRITICAL_HIT` 또는 보스 컨택트가 있으면 짧게(예: 60~90ms) sim 스텝 스킵(렌더는 계속). 감소된 모션 시 0.
- 스웜 stutter 방지: 크리티컬/보스/heavy에만, 프레임당 1회, 최소 간격 쿨다운.

## 5. 검증 계획 (구현 시)
- `node --test 'tests/**/*.test.mjs'` — 특히 `defense-observers-contract`, `defense-renderer-contract`, `combat-presentation-contract`, `defense-run-simulation*`(digest SHA 핀).
- 브라우저 계약: `tests/deployed-defense-smoke.cjs` 등 캠페인 스위트.
- 실제 `campaign.html` 플레이 스모크(에러 0 + 육안).

## 6. 승인 필요 결정
1. **히트스톱 범위(스웜이라 중요):** (a) 크리티컬+보스만[권장·보수적] / (b) 크리티컬만 / (c) 넣지 않음(스파크만).
2. **스파크 범위:** 전체 피격 vs 크리티컬/보스 강조만(스웜 밀도 고려).
3. 혹시 캠페인에서 **특정 약점**을 느끼신 게 있나요? (예: 이펙트가 아예 안 보임 = 렌더러 폴백 문제일 수 있음 — 그럼 진단이 먼저)
