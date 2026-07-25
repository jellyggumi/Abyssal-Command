# 게임 UI 트렌드 서베이 — Behance RPG/디펜스 UI (2026-07-25)

**요청 출처**: 사용자 요청 "behance.net 검색 rpg game ui / 디펜스 ui 참조해서 game-studio-harness 이용해서 업데이트". `survey` 스킬 대신 `playwriter`로 실 브라우저 탐색(behance.net JS-렌더 사이트, 정적 fetch 불가).

## 조사 대상 3건

### 1. Dark RPG Game UI Concept Design (가장 근접한 레퍼런스)
- URL: https://www.behance.net/gallery/248294903/Dark-RPG-Game-UI-Concept-Design
- **명시적으로 "Phantom Blade Zero" 이미지에서 영감받았다고 크레딧** — Souls류 다크 판타지 HUD 계열, Abyssal Command와 동일 계열
- **HUD 패턴**: 화면 상단 중앙 좁은 HP 바(적 이름 + 게이지만, 큰 패널 없음), 좌하단에 4개 액션 아이콘 타이트 그리드, 미니맵 우상단 소형 인셋 — 이미 이 프로젝트의 "엣지 전용 HUD, 중앙 패널 금지"(D5) 철학과 정확히 일치. 신규 채택 필요 없음, **기존 결정이 이미 이 스타일과 정합됨을 확인**하는 근거로 활용.
- **인벤토리 패턴**: 좌측 그리드(아이템 아이콘, 소지 슬롯) + 우측 상세 패널(아이콘/이름/설명/사용처/수량) 분할 구조, 다크 차콜 배경 + 골드 하이라이트(통화/희귀도), serif 판타지 타이포. 현재 `.growth-equip-grid`/`.pause-overlay-grid`가 유사한 그리드 구조지만 좌우 분할 상세 패널은 없음(hover/select 시 요약 텍스트만).

### 2. Zombie Tower Defense Mobile Game UI
- URL: https://www.behance.net/gallery/83075681/Zombie-Tower-Defense-Mobil-Game-UI
- 코믹/캐주얼 톤(좀비 만화 캐릭터, 노란 아웃라인 타이포) — **Abyssal Command 톤과 불일치, 직접 채용 대상 아님**
- 유용한 구조만 추출: 원형 아이콘 버튼(상점/랭킹/도움말) 3개를 코너에 배치, "START" 버튼에 손가락 포인터 애니메이션 강조 — 이미 이 프로젝트엔 해당 없음(모바일 온보딩 튜토리얼 화살표 미구현 상태, 향후 고려 가능한 낮은 우선순위 항목)

### 3. BUGWAVE 1.0 Tower Defense
- URL: https://www.behance.net/gallery/56939697/BUGWAVE-10-tower-defense-game
- 유기적 가든/자연 테마 — 톤 불일치
- **구조적으로 유용한 패턴**: 타워 업그레이드 패널이 Level/Cost/Damage/Range 컬럼의 테이블로 표시 — 이미 이 프로젝트의 `EQUIPMENT_TIERS`(T1-T5 사다리, tier별 vertexCount/cost)와 개념적으로 동일한 정보 구조. **검증**: 현재 `equipmentOwnersMarkup()`이 tier 진행을 `tier-icon`(vertex-count 도형) + 단일 텍스트 라인으로만 표시 — BUGWAVE처럼 명시적 테이블은 아니지만 같은 목적(등급별 수치 진행 가시화)을 다른 방식으로 이미 충족.

## 종합 판단 (game-designer 역할)

**신규로 채택할 변경 없음** — 3건의 레퍼런스 모두 확인 결과, 이 프로젝트의 기존 UI 결정(엣지 전용 HUD, 다크+골드 팔레트, tier-icon 진행 표시)이 다크 판타지 RPG 장르의 확립된 관례와 **이미 정합**되어 있음을 재확인하는 근거로 작용. 유일한 실질적 갭: 인벤토리 상세 패널(선택 아이템의 아이콘+설명+사용처를 별도 패널에 크게 보여주는 좌우 분할 레이아웃)이 Dark RPG 레퍼런스만큼 상세하지 않음 — 현재는 hover 시 요약 텍스트 한 줄.

**권고**: 이 갭은 낮은 우선순위(기능 결손 아님, 정보 밀도 개선 여지) — 이번 사이클의 실제 블로커(CI WebGL 회귀, T-pose 재생성 요청, 텍스처 파이프라인)보다 먼저 처리하지 않음. 별도 백로그 항목으로 기록.

## Links
- 관련: `presentation-spec.md`(카메라/화풍 결정), `ui/lane-hud-layout.md`(엣지 전용 HUD 원본 근거)
