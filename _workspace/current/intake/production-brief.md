# Production Brief — Onslaught 액션 피벗 (Hit & Slash / Wave / PCG)

```yaml
run_id: 20260728-onslaught-action-pivot
game_type: mobile-first single-player action hack-and-slash roguelite (PIVOT)
prior_type: mobile-first single-player defense-survivor auto-battler
team_shape: solo dev + AI production harness
engine: vanilla JS + Three.js (no framework), static-hosted (GitHub Pages)
predecessor_runs:
  - _workspace/20260726-stage1b-cinder-pressure-agency   # 압박/주도권 재설계, G2/G3/G6 FAIL, G7/G8 BLOCKED
  - _workspace/20260727-outgame-reference-survey         # 아웃게임 레퍼런스 조사
  - _workspace/20260727-outgame-lobby-concept            # 로비 컨셉
  - _workspace/20260727-lobby-dock-redesign              # 사이드독 로비 (G4/G6 PASS)
next_public_beat: rendered vertical slice — Cinder Span 1스테이지 5~8분 완주
source_packet: >
  사용자 요청(한국어): "_workspace/ 의 기획내용을 디벨롭할꺼야. 주요 기획 발전방향은
  플레이스타일을 hit & slash + 역동적, 광역스킬과 몬스터 떼로 몰아치는 웨이브,
  정신없는 빅웨이브와 중간 보스와, 최종보스의 패턴을 피해가는 pcg 오픈월드 맵 느낌의
  플레이 기획으로 진행하고 하나의 스테이지는 5~8분정도의 흐름을 갖고 몰입할 수 있도록해.
  성장의 느낌은 캐릭터의 성장이 사용자 정보에 맞게 지속적으로 성장할수있고 습득한 스킬은
  단계적으로 사용가능하고 레벨업이 가능한 기능이 제한된 스킬 카테고리가 정해져있어야해.
  카메라 연출과 vfx 등 화려한 연출이 주가 되도록하고 ui/ux 도 심플하지만 정보전달이
  명확하도록 설계되어야해. 게임에 대한 스토리를 로비에서 확인할수있는데 텍스트보다는
  비디오와 연출된 이미지의 연출이 주가되어야해."
```

## 1. 이것은 장르 피벗이다 [OBSERVED]

측정된 현재 런타임과 요청 사이의 격차는 튜닝 범위가 아니다.

| 축 | 현재 런타임 [OBSERVED] | 요청 [TARGET] | 배율 |
|---|---|---|---|
| 스테이지 길이 | 26.9–27.7 s (`design/core-loop.md#scripted_baseline`) | 300–480 s | **11–18×** |
| 플레이어 공격 | 없음 — 자동 (`defense-catalog.js#COMMANDER.basicCooldown=24`) | hit & slash 입력 | 신규 |
| 회피 | 없음 — `dodge`/`iframe` 심볼 0건 | 대시 + 무적 프레임 | 신규 |
| 웨이브 | 스테이지당 3슬롯 (`CINDER_SPAN_WAVE_PLAN`, tick 0/120/240) | 다단 웨이브 + 빅웨이브 | 재설계 |
| 보스 패턴 | 없음 — 단일 추격 정책 (`BOSSES[*].policyId`) | 텔레그래프 회피 패턴 | 신규 |
| 중간 보스 | 없음 | 스테이지당 1 | 신규 |
| 맵 | authored 고정 좌표 (`STAGE_TACTICS`) | PCG 오픈월드 느낌 | 재설계 |
| 스킬 | 플랫 8종, 레벨 없음 (`SKILLS`) | 카테고리 제한 + 레벨업 | 재설계 |
| 스토리 | 텍스트 컷신 (`CUTSCENES[*].lines`) | 비디오 + 연출 이미지 | 재설계 |

**결론:** 디펜스 서바이버 오토배틀러 → 액션 핵앤슬래시 로그라이트. 유지되는 것은
결정론적 60 Hz 시뮬레이션 경계, 스냅샷 렌더 계약, 오프라인 로컬 저장, 심연 세계관,
10스테이지 캠페인 골격, 무수익화 경계뿐이다.

## 2. 유지되는 계약 (변경 금지)

- 60 Hz 결정론 시뮬레이션이 권위. 렌더러는 스냅샷을 읽기만 하고 `getRunDigest()` 입력을 바꾸지 않는다.
- 오프라인 로컬 저장 + JSON 내보내기/가져오기. 계정·클라우드·멀티플레이 없음.
- 광고·프리미엄 화폐·가챠·유료 성장·유료 복구 없음.
- 심연 세계관 고유명(Dusk Warden, Echo Deep, Moonless Court, Gate Zenith)과 10스테이지 순서.
- `prefers-reduced-motion` 존중, 색 비의존 정보 전달.
- 단일 게임플레이 평면(플랫). 시각적 높이는 비보행 배경 장식으로만 허용.

## 3. 대체되는 계약 (명시적 폐기)

- 관문 내구도(`GATE.maxIntegrity`) 중심 실패 조건 → 지휘관 생존 중심으로 이동.
- `gate-defense → echo-recovery → growth → occupation → extraction → boss-kill` 6단계 순차 목표
  → 웨이브 페이즈 타임라인으로 대체.
- 자동 기본 공격 → 입력 기반 콤보.
- `OBJECTIVE_PRESSURE_*` 게이트 감쇠 압박 → 웨이브 밀도 압박.
- 3스탠스 편성(`FORMATION_STANCES`) → 스킬 카테고리 로드아웃으로 흡수 검토.

## 4. 게이트 관련성

| 게이트 | 영향 | 사유 |
|---|---|---|
| G1 세계관 | 낮음 | 고유명·서사 골격 유지, 전달 매체만 변경 |
| G2 밸런스 | **전면 재측정** | 5–8분 스테이지 밸런스는 기존 27초 측정과 무관 |
| G3 편성 | **재정의** | 스탠스 → 스킬 카테고리 로드아웃 |
| G4 몰입/접근성 | **높음** | 카메라·VFX 연출 주도, reduced-motion 등가물 필수 |
| G6 운영/성능 | **높음** | 빅웨이브 동시 액터 수 × VFX 예산 |
| G7 코어 루프 | **재정의** | 30–180 s 밴드 → 300–480 s 밴드 |
| G8 최초 노출 | 재측정 | 신규 조작 학습 곡선 |

## 5. 작업 순서 (lifecycle)

`design-action-combat`(전투 동사) → `design-game-encounters`(웨이브 구성) →
`author-game-levels`(PCG 셀 배치) → `tune-enemy-ai`(보스 패턴) →
`build-game-camera-controls` + `create-game-vfx`(연출) → `build-mobile-threejs-games`(조작/HUD) →
`optimize-threejs-games`(빅웨이브 성능) → `test-playable-web-games`(플레이 증명).

VFX/오디오 연출은 그것이 전달할 시스템이 정의된 뒤에만 착수한다.

## 6. 증거 규칙

이 런의 모든 수치는 `[TARGET]`이다. 기존 `[OBSERVED]` 측정치를 새 목표로 재라벨하지 않는다.
새 밸런스는 신규 픽스처로 다시 측정해야 하며, 27초 오토배틀 측정치는 5–8분 액션 루프의
증거가 되지 않는다.
