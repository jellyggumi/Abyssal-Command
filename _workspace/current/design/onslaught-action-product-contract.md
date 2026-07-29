# Onslaught Action Product Contract — 직접 베고 피하는 5–8분 심연 원정

```yaml
run_id: 20260728-onslaught-action-pivot
status: "[TARGET] — 제품 계약. 구현·밸런스·사람 플레이로 아직 검증되지 않음"
owner: game-production-director
scope: 제품 정의, 플레이어 약속, 세로 슬라이스 우선순위
numeric_authority: design/master-numeric-contract.md
implementation_authority: engineering/migration-map.md
supersedes:
  - docs/abyssal-command-defense-survivor-design.md # 삭제됨
  - docs/abyssal-surge-production-cycle.md # 삭제됨
```

## 1. 제품 한 문장

**Abyssal Surge는 Dusk Warden이 직접 베고, 취소하고, 대시로 피하며, 광역기로 군중을 정리한 뒤 패턴 보스를 쓰러뜨리는 모바일 우선 싱글플레이 Three.js 액션 핵앤슬래시 로그라이트다.**

한 원정은 5–8분이며, 시드 기반의 넓은 평면 셀을 가로질러 중간 보스와 최종 보스를 향한다. 실패해도 플레이어의 영구 성장과 해금 선택지는 남는다.

이 계약은 제품의 **무엇**을 소유한다. 수치·알고리즘·자산·구현은 각각 아래의 권위 문서를 소유하며, 이 문서가 그것을 다시 정의하지 않는다.

## 2. 지켜야 할 제품 경계

- 엔진: 정적 호스팅되는 vanilla JavaScript + Three.js 브라우저 게임. Unity/Unreal 경로는 적용하지 않는다.
- 시뮬레이션: 60 Hz 결정론 시뮬레이션이 권위이며, 렌더러·HUD·VFX·오디오는 스냅샷을 읽기만 한다.
- 저장: 오프라인 로컬 저장과 JSON 내보내기/가져오기를 유지한다. 계정·클라우드·멀티플레이는 없다.
- 비즈니스 모델: 광고, 프리미엄 화폐, 가챠, 유료 성장, 유료 회복은 없다.
- 캠페인: 심연 세계관의 세 구역 `Cinder Span → Abyss Chancel → Echo Throne`과 각 구역의 보스 `Cinder Warden → Veil Tactician → Gate Sovereign`을 유지한다. `Echo Throne` 승리가 종결이다.
- 공간: 모든 이동·충돌·목표·전투는 하나의 평면에서 일어난다. 높이는 비보행 장식일 뿐이다.
- 접근성: `prefers-reduced-motion`, 색 비의존 정보, 터치 대안을 처음부터 제품 계약으로 둔다.

근거: `intake/production-brief.md#2`, `design/master-gdd-delta.md#2.1`.

## 3. 플레이어 약속과 필러

| 필러 | 플레이어가 느껴야 하는 것 | 제품 규칙 |
|---|---|---|
| 직접성 | 자동전투가 아니라 내 손으로 베고 피한다 | `LIGHT_1 → LIGHT_2 → LIGHT_3`, `HEAVY`, `DASH`가 명시적 상태와 접촉 판정을 가진다. |
| 군중 지배 | 적이 몰릴수록 광역 스킬·위치 선정의 가치가 커진다 | 광역은 `SURGE`·`BIGWAVE`의 해답이며, 단일 대상에서 지배적이지 않아야 한다. |
| 공정한 압박 | 빅웨이브는 혼란스럽지만 억울하지 않다 | 화면 밖 피해, 회피 불가 패턴, 막힌 대시 경로를 허용하지 않는다. |
| 학습의 보상 | 보스에서 익힌 타이밍이 다음 페이즈에서도 유효하다 | 난도는 예고 단축이 아니라 빈도·조합·피해량으로 올린다. |
| 실패해도 남는 진전 | 실패가 진행 정지가 되지 않는다 | 실패에도 Warden XP 40%와 도달한 Echo Shard 100%를 보존한다. |
| 화려하지만 읽히는 화면 | 타격과 보스 연출은 강렬하되 위험을 덮지 않는다 | 판독성 → 공정성 → 화려함의 우선순위를 뒤집지 않는다. |

상세 계약: `design/action-combat-spec.md`, `design/encounter-wave-spec.md#4.3`, `design/boss-pattern-spec.md#5.2`, `design/skill-and-growth-spec.md#1.1`, `design/camera-vfx-direction.md#0`.

## 4. 한 원정의 제품 흐름

기준 원정은 360초이고 허용 범위는 300–480초다. 총 540초에 도달하면 보스를 건너뛰지 않는 강제 종막만 발동한다.

| 순서 | 페이즈 | 플레이어 질문 | 제품적 목적 |
|---|---|---|---|
| 1 | `DESCENT` | “이동·콤보·대시는 어떻게 연결되는가?” | 안전하게 손맛과 지형 읽기를 가르친다. |
| 2 | `SKIRMISH` | “정면, 측면, 원거리 위협에 어떻게 반응하는가?” | 콤보를 완주하고 첫 런 성장 선택을 한다. |
| 3 | `SURGE` | “광역기를 언제 써야 군중이 무너지는가?” | 광역 로드아웃의 필요를 입증한다. |
| 4 | `MIDBOSS` | “예고를 보고 어떤 대시·이동으로 피하는가?” | 두 패턴을 반복 학습시키는 첫 시험이다. |
| 5 | `BIGWAVE` | “포위되지 않고 군중을 정리할 수 있는가?” | 동시 60체 한도 안에서 최대 밀도를 전달한다. |
| 6 | `FINALE` | “배운 회피를 패턴 조합 속에서도 유지하는가?” | 세 페이즈의 최종 보스를 처치해야만 원정이 끝난다. |
| 7 | 결과 | “이번 원정으로 무엇이 늘었고 다음엔 무엇을 바꿀까?” | Warden XP·Echo Shard·정예 추출·보상 선택을 명확히 돌려준다. |

시간, 종료 조건, 이월, 보상은 `design/master-numeric-contract.md#2`, `design/encounter-wave-spec.md#1`, `#1.6`, `#6`만이 소유한다.

### 순간 전투 루프

```
위협을 본다 → 간격을 고른다 → 콤보를 취소로 압축한다
                         ↓
              예고를 보고 대시/이동으로 피한다
                         ↓
        안전한 창에서 재개하거나 광역기로 밀도를 끊는다
```

이 루프를 보스 패턴도, 잡몹 역할도, 카메라·HUD·VFX도 강화해야 한다. 이를 우회하는 자동 공격, 화면 밖 피해, 텍스트만의 위험 경고는 제품 계약 위반이다.

## 5. 월드와 적의 역할

- 스테이지는 `arena` 3, `transit` 2, `boss` 1의 3×2 시드 기반 셀 배치로 오픈월드 같은 횡단감을 만든다.
- 시드는 `stageId`, `campaignSeed`, `sortieIndex`에서 결정되며 같은 입력은 같은 레이아웃을 재현한다.
- 스폰은 항상 모서리 셀, 보스는 대각 반대편에 둔다. 플레이어는 보스 셀까지 실제로 횡단한 감각을 얻는다.
- `rusher`, `flanker`, `guardian`, `ranged` 네 역할은 각각 콤보, 360° 피니셔, 강공격 경직, 대시 접근을 요구한다. 새 적 수를 늘려 압박원을 중복하지 않는다.
- 최종 보스는 5종 패턴을 70%/40% 경계의 세 페이즈에 걸쳐 확장한다. 예고·active·recovery 타이밍은 보존한다.

상세 계약: `design/pcg-stage-layout-spec.md#2`, `#5`, `#6`; `design/encounter-wave-spec.md#2`; `design/boss-pattern-spec.md#4`–`#6`.

## 6. 성장과 빌드의 약속

### 영구 성장

- Warden Level 1–60, 무료 레벨 스탯 포인트, 기존 Echo Core, Echo Shard가 서로 다른 속도로 진행한다.
- `corePointsByStat`와 `levelPointsByStat`을 분리한다. 무료 포인트가 Echo Core 예산을 소모하거나 비용 순서가 결과를 바꾸면 안 된다.
- 스탯 상한은 `STAT_CAP = 19`다. 이 값은 총 75점의 두 출처를 낭비 없이 수용하기 위해 정해졌다.
- 로드아웃 6칸이 강해지는 초반, 미장착 스킬 폭이 넓어지는 중반, Warden Level이 계속 파워를 주는 장기 축을 의도적으로 겹치지 않게 둔다.

### 제한된 스킬 선택

| 카테고리 | 슬롯 | 역할 |
|---|---:|---|
| `melee-amp` | 2 | 콤보·피니셔를 강화한다. |
| `aoe-burst` | 2 | 밀집 군중을 무너뜨린다. |
| `mobility` | 1 | 대시와 재배치를 변형한다. |
| `sustain` | 1 | 보호·회복·실수 복구를 제공한다. |

- 20개 스킬은 카테고리별 T1 2종, T2 2종, T3 1종으로 구성한다.
- T2는 그 카테고리 T1 하나를 L3까지, T3는 T2 하나를 L4까지 올리고 캠페인 3스테이지를 클리어해야 해금된다.
- 스킬 레벨은 L1–L5이며, 로드아웃 교체는 로비에서만 원자적으로 커밋한다.
- 런 내 성장 선택은 원정당 3회다. 영구 성장과 런 한정 변주를 섞지 않는다.

상세 계약: `design/master-numeric-contract.md#4`, `#5`; `design/skill-and-growth-spec.md#1`–`#5`; `ui/hud-information-architecture.md#5`.

## 7. 연출과 HUD의 약속

### 카메라·VFX

- 카메라는 지휘관을 유일한 권위 타겟으로 삼고, 위치·시선을 독립적으로 부드럽게 보간한다.
- 페이즈가 강해질수록 거리 티어를 넓혀 군중과 보스 패턴을 읽게 한다. 보스 등장, 페이즈 전환, 큰 예고, 피니셔 같은 연출은 기본 카메라에 일시 모디파이어로만 얹는다.
- 위험 예고·안전지대·회피 성공 신호는 어떤 품질 티어에서도 제거하지 않는다. 풀링, 인스턴싱, 품질 단계는 장식 파티클부터 열화한다.
- 카메라 흔들림과 히트스톱은 손맛을 강화하지만 시뮬레이션 시간을 멈추거나 예고를 가리지 않는다.

### HUD·UX

- 즉시 판단해야 하는 정보는 캐릭터와 월드에 둔다: 위험 데칼, 지휘관 내구 링, 대시 충전.
- 화면 가장자리에는 쿨다운·콤보·보스 HP·페이즈 진행만 둔다. 미니맵, 적 수, DPS, 실시간 Shard 카운터는 전투 HUD에 넣지 않는다.
- 최대 4개의 액티브 스킬을 상시 노출하고 5–6번째만 확장 팔레트로 감춘다.
- 동시 HUD 요소는 9개 이하, 빅웨이브 텍스트는 12자 이하, HUD 점유는 18% 이하다.
- portrait와 landscape, 터치·키보드·마우스, reduced-motion 모두가 같은 정보와 핵심 조작을 보장해야 한다.

상세 계약: `design/camera-vfx-direction.md#1`–`#8`, `ui/hud-information-architecture.md#1`–`#8`.

## 8. 로비에서의 이야기

이야기는 전투 중 텍스트 컷신이 아니라 좌측 사이드독의 `기록` 탭에서 다시 본다. 전장 캔버스를 가리지 않는 16:9 미디어 패널을 사용한다.

- 스테이지마다 `approach`, `confrontation`, `aftermath` 세 비트, 총 30개를 둔다.
- 매체는 움직임·시간·감정 고조에는 사전 렌더 비디오, 모델 재사용이 유리한 보스 첫 대면에는 인엔진 시퀀스, 장면의 인상에는 연출 스틸, 보충 설명에만 텍스트를 쓴다.
- 정적 호스팅 예산에 맞춰 비디오 6, 인엔진 10, 스틸 14로 배분한다.
- 모든 미디어는 자막과 1–3문장 텍스트 폴백을 가진다. 로드 실패, 오프라인, reduced-motion, 스크린 리더에서 정보가 사라지면 안 된다.
- 아직 도달하지 않은 스테이지는 제목·썸네일·내용까지 봉인해 스포일러를 막는다.

상세 계약: `design/lobby-story-presentation-spec.md#2`–`#7`.

## 9. Cinder Span 세로 슬라이스 순서

이 제품은 연출부터 만들지 않는다. `Cinder Span` 1스테이지에서 아래 순서를 지키며, 앞 단계의 플레이 증명이 없으면 다음을 시작하지 않는다.

1. 이동·카메라·충돌·일시정지: 평면 위에서 지휘관과 즉시 위협을 읽을 수 있어야 한다.
2. 전투 동사: `LIGHT_1/2/3`, `HEAVY`, `DASH`, 접촉, 콤보 취소, 피격·회피 피드백을 완성한다.
3. **사람 플레이 판정:** “직접 때리는 감각”이 없으면 이후 PCG·보스·VFX·HUD 범위를 진행하지 않는다.
4. 적 1종과 텔레그래프를 넣어 하나의 대응 관계를 증명한다.
5. 페이즈 골격, 중간 보스의 `line-sweep`, PCG 셀 생성, 성장·저장, 나머지 적·패턴을 순서대로 확장한다.
6. VFX·HUD·로비 기록은 그 의미를 전달할 시스템이 먼저 완성된 뒤에만 추가한다.
7. 빅웨이브 성능, 전체 플레이 여정 QA, 배포 검증은 마지막에 수행한다.

구현 슬라이스와 증명 목록: `engineering/migration-map.md#9`. 게이트는 아직 어떤 것도 통과하지 않았으며, 이 문서의 모든 수치와 계획은 `[TARGET]`이다.

## 10. 검증을 위한 제품 가설

| 가설 | 필요한 증거 | 통과가 아닌 현재 상태 |
|---|---|---|
| 직접 전투가 손맛을 만든다 | 슬라이스 2의 실제 브라우저 플레이와 사람 판정 | `[TARGET]` |
| 5–8분 흐름이 몰입을 유지한다 | 완주·사망·재시도 표본의 시간과 질적 피드백 | `[TARGET]` |
| 빅웨이브가 화려하면서 공정하다 | 동시 60체, p95 프레임, 화면 밖 피해·회피 경로 검증 | `[TARGET]` |
| 보스가 학습 가능한 회피 시험이다 | 다섯 패턴별 회피 여유·텔레그래프 가독성·플레이 관측 | `[TARGET]` |
| 성장과 UI가 다음 출정을 만든다 | 저장/복원·실패 보상·로드아웃 교체·터치 HUD 사용성 검증 | `[TARGET]` |

측정 없는 설계는 증명이 아니다. 기존 27초 자동전투 결과는 이 제품의 밸런스, 몰입, 최초 노출 게이트에 사용할 수 없다.

## 11. 권위 문서 맵

| 주제 | 권위 문서 |
|---|---|
| 제품 수치 | `design/master-numeric-contract.md` |
| 전투 | `design/action-combat-spec.md` |
| 웨이브·보상·전이 | `design/encounter-wave-spec.md` |
| PCG 월드 | `design/pcg-stage-layout-spec.md` |
| 성장·스킬·저장 | `design/skill-and-growth-spec.md` |
| 보스·AI | `design/boss-pattern-spec.md` |
| 카메라·VFX | `design/camera-vfx-direction.md` |
| HUD·접근성 | `ui/hud-information-architecture.md` |
| 로비 서사 | `design/lobby-story-presentation-spec.md` |
| 구현·픽스처 순서 | `engineering/migration-map.md` |
| 승인·보류·게이트 | `production/decision-log.md`, `production/task-manifest.md` |

이 문서는 위 문서를 요약·연결하는 제품 SSOT다. 충돌 시에는 `design/master-numeric-contract.md`가 수치에서 우선하고, 각 세부 영역 문서가 구현 세부에서 우선한다.
