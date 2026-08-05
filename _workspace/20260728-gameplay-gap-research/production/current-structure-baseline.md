# 현 구조 베이스라인 — Abyssal Command (HEAD 2166c52)

> 근거: `engineering/current-systems-inventory.md`(코드 file:line 정적 검증) + `intake/design-intent-digest.md`(설계의도·게이트, 최신 4런). read-only. 스테일 status 문서(d941490)는 가설로만 취급, 사실 소스 아님.

## 비전·필러
- 모바일 우선 싱글플레이 디펜스-서바이버, 고정 10스테이지 캠페인, **이동만 입력 + 자동전투**, 정적/오프라인(GitHub Pages).
- 코어 판타지: 어비셜 워든 1기 + 소형 포메이션으로 hold → surge → extract 사이클.
- 필러: 결정론 60Hz(렌더러는 스냅샷만 읽음), 이동전용 입력(agency는 3스탠스 포메이션), 모바일 full-bleed + 엣지 HUD, **무수익화(G5 영구 N/A)**, 런스코프/영구상태 2경로 분리, 런타임 의존성 0.

## 구현된 게임플레이 (코드 검증)
- **코어루프**: 8방향 D-pad, 자동공격 900dmg/24틱·크리 15%, 스케줄 웨이브 → 정예 → 점령 hold → 시한 추출 → 보스. 승=보스 처치, 패=게이트 붕괴 / 지휘관 integrity≤0 / 추출 실패 (sim:1803-2019).
- **목표 페이즈머신**: gate-defense → echo-recovery → growth → occupation → extraction → boss-kill (sim:1602-1617).
- **서바이버 층**: 최대 레벨 9(XP_GROWTH 8임계), 레벨업마다 8중 3택, **교체·인런 랭크·시너지 없음** — 단일 빌드 축 (catalog:138,294-303; sim:971-982).
- **워든 RPG**: 6스탯(비용커브 [2,2,3,3,4,4,5,5,6,6] 합 40), 5노드 스킬트리(**총비용 41 > 예산 40 — 다 못 찍음**), 8특성/클리어 2·4·6·8·10에 5회 3택1, 5티어×3슬롯 장비, 3역할, 3스탠스(VANGUARD/TURRET/SPLIT 2·1·1 FRONT, 4s cd), BACK행 +25% 시너지 (rpg-catalog.js).
- **메타**: 엄격 선형 게이팅, 정예 점령 → Bind → 명시 EXTRACT → 영구 동료화(진화 1-3), 워든/장비/보상 영구 (campaign-state.js:186-300).
- **아이들(Undertow Encroachment)**: completedStages × 경과분 누적(cap 8h), pressure>wardLevel이면 ENCROACHED(0 보상). **싱크 없음** — totalProgress는 소비 불가 vanity (campaign-state.js:217-247).
- **경제**: Echo Core 40(정예 cap10 + 스테이지 cap30) → 스탯/트리, Bound Fragment 10(스테이지) → 장비. 풀클리어 = 정확히 40 EC + 10 BF, "다 사기엔 딱 부족".

## 콘텐츠 볼륨
10 스테이지 / 기본 적 4종 / 정예 10(기본클래스 리스킨 ×4 HP·XP) / 보스 10(HP 40k→150k) / 동료 9(**6 포획가능 · 3 보상전용=컬렉션 미진입**) / 스킬 8(액티브 5 + 패시브 3) / 아이템 5 / 보상 14 / 스탠스 3 / stage-world 쇼케이스 3.
- 스테이지 변주: 지형(bounds·장애물 2·램프 1+플랫폼 1) + 스테이지별 hazard/choke/점령/추출. **웨이브 구성 변주는 스테이지 1-4만, 5-10은 타이밍·밀도 지터뿐**.
- 적 AI: gate-pressure / pursuit / flank / resource-denial(echo denial) / elite-escort / low-hp-focus.

## Dead / Inert 콘텐츠 (플레이어 미도달, 9)
POWER_GOVERNANCE(테스트 전용·미집행) · ARCHIVE_RETURN(소비자 0) · 아이들 totalProgress(싱크 없음) · **M4 카드 시스템**(sim 기계장치만, UI·전투효과 없음) · BOSS_RALLY_COOLDOWN_REDUCTION=0(no-op, 토스트만 0%) · 동료 진화(코스메틱) · 보상전용 동료 3종 · STAGE/world presentation(표시전용) · lore-surprise 테이블(플레이버).

## 검증된 게임성 갭 (5)
1. **유한 1회성 천장** — NG+/프레스티지/엔드리스 없음. 풀클리어하면 재투자 루프 소멸.
2. **뼈대뿐인 아이들** — 누적만 되고 재투자 싱크 없음(vanity), 컴백 훅 약함.
3. **얕은 로그라이트 깊이** — 단일 8스킬 드래프트 축, 인런 랭크·진화·시너지·스케일링 없음, 최대 레벨 9.
4. **오소링 콘텐츠 미도달** — 위 dead 9종. 만든 데이터가 플레이어 경험이 안 됨.
5. **밸런스·성능·휴먼 게이트 미충족(최신 stage1b 런)** — G2 밸런스 FAIL / G3 플레이어타입 FAIL / G6 성능 FAIL(모바일 33-50ms, heap 0.11 MiB/min) / G7·G8 human 미측정.

## 미충족 게이트 원본 (stage1b, intake 다이제스트)
G2 FAIL/FIX/REDO(아키타입 9-11/20 이탈, Cinder 게이트-min 55-80% 이탈 10-15/15, legal-combo EV 1.70 vs ≤1.30, 20-paired 대칭 export 부재) · G3 FAIL/FIX/REDO(동료 다운 0/100 VANGUARD+SPLIT, 스위치후 데미지 0/50) · G6 FAIL(desktop p95 16.8ms, midtier 33.3ms, low 50ms, soak heap 0.1138 MiB/min memoryStable=false) · G7 BLOCKED(0/10 참가) · G8 BLOCKED(0/5 타이틀) · G5 N/A.

## 출처
- `_workspace/20260728-gameplay-gap-research/engineering/current-systems-inventory.md`
- `_workspace/20260728-gameplay-gap-research/intake/design-intent-digest.md`
