# 24종 캐릭터 메시 디테일 향상 계획 (mesh detail uplift)

- 대상: `assets/images/battle/glb/` 의 캐릭터 24종 (bosses 10, commander 1, companions 9, enemies 4)
- 실측 원본: `_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline/mesh-detail-audit.json`
- 수집 도구: `scripts/audit-mesh-detail-blender.py` / `Blender 5.1.2 headless bpy import` (headless)
- 표기: `[OBSERVED]` 이 저장소에서 측정/확인, `[INFERENCE]` 측정치로부터의 추론, `[TARGET]` 통과 목표, `[BLOCKED]` 현 환경에서 실행 불가

## 1. 실측 결과 (24/24, 오류 항목 0건)

| assetId | 카테고리 | 정점 | 폴리곤 | UV | 베이스컬러 해상도 | 본 수 | 클립 수 | 표준 11클립 외 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `abyss-regent` | bosses | 27,056 | 39,518 | O | 1024x1024 | 24 | 11 | — |
| `bridge-colossus` | bosses | 23,633 | 37,555 | O | 1024x1024 | 24 | 11 | — |
| `cinder-warden` | bosses | 23,573 | 37,254 | O | 1024x1024 | 24 | 11 | — |
| `gate-sovereign` | bosses | 23,556 | 38,040 | O | 1024x1024 | 24 | 11 | — |
| `lantern-tyrant` | bosses | 22,824 | 38,179 | O | 1024x1024 | 24 | 11 | — |
| `pack-herald` | bosses | 25,342 | 38,762 | O | 1024x1024 | 24 | 11 | — |
| `requiem-choir` | bosses | 26,138 | 39,327 | O | 1024x1024 | 24 | 11 | — |
| `tide-warden` | bosses | 21,680 | 15,067 | O | 1024x1024 | 24 | 11 | — |
| `veil-tactician` | bosses | 24,207 | 38,097 | O | 1024x1024 | 24 | 11 | — |
| `veiled-concordat` | bosses | 23,647 | 39,344 | O | 1024x1024 | 24 | 11 | — |
| `dusk-warden` | commander | 26,611 | 30,062 | O | 1254x1254 | 24 | 13 | attack_melee, attack_ranged |
| `anchor-shard` | companions | 11,287 | 15,686 | O | 1024x1024 | 24 | 11 | — |
| `dawnless-crown` | companions | 13,240 | 15,754 | O | 1024x1024 | 24 | 11 | — |
| `ember-cohort` | companions | 11,319 | 15,520 | O | 1024x1024 | 24 | 11 | — |
| `lantern-reaver` | companions | 12,423 | 15,545 | O | 1024x1024 | 24 | 11 | — |
| `pack-warden` | companions | 14,112 | 16,132 | O | 1024x1024 | 24 | 11 | — |
| `requiem-warden` | companions | 13,871 | 15,549 | O | 1024x1024 | 24 | 11 | — |
| `rift-lens` | companions | 11,203 | 15,347 | O | 1024x1024 | 24 | 11 | — |
| `throne-echo` | companions | 15,015 | 16,166 | O | 1024x1024 | 24 | 11 | — |
| `veil-vanguard` | companions | 12,342 | 15,562 | O | 1024x1024 | 24 | 11 | — |
| `guard` | enemies | 10,309 | 15,813 | O | 1024x1024 | 24 | 11 | — |
| `possessed` | enemies | 11,814 | 15,214 | O | 1024x1024 | 24 | 11 | — |
| `scout` | enemies | 11,193 | 15,344 | O | 1024x1024 | 24 | 11 | — |
| `shade` | enemies | 10,369 | 15,280 | O | 1024x1024 | 24 | 11 | — |

`[OBSERVED]` 24종 전부 active UV 를 보유하고(`hasUv: true`), 전부 baseColorTexture 가 연결되어 있으며, 전부 `DEF-` 본 24개 리그를 공유한다.
`[OBSERVED]` 베이스컬러 해상도는 23종이 1024x1024, `dusk-warden` 만 1254x1254 이다.
`[OBSERVED]` 클립 수는 23종이 표준 11개이고 `dusk-warden` 만 13개(`attack_melee`, `attack_ranged` 추가)다.
`[OBSERVED]` 폴리곤 최소는 `tide-warden` 15,067, 최대는 `abyss-regent` 39,518 이다.
`[OBSERVED]` 23종의 클립 타이밍 서명(액션별 길이)이 완전히 동일하다: attack 3.75s / avoid 1.75s / bighit 3.5s / critical 3.0s / defence 3.25s / die 3.0s / hit 2.25s / idle 5.0s / move 3.0s / run 3.5s / show 4.0s.

## 2. 실측에서 도출되는 우선순위

1. **모션 개별화 (최우선)** — `[OBSERVED]` 23종이 액션별로 한 프레임도 다르지 않은 동일 길이를 쓴다. `[INFERENCE]` 캐릭터별로 authored 된 타이밍이 아니라 공통 템플릿이 그대로 복제된 상태다. `[TARGET]` 보스/커맨더/컴패니언/일반 적의 체급에 따라 attack·hit·bighit 길이와 anticipation/impact 프레임을 분리해, 최소한 카테고리 단위로 서로 다른 타이밍 서명을 갖게 한다.
2. **공격 클립 분리** — `[OBSERVED]` `dusk-warden` 만 `attack_melee` / `attack_ranged` (각 1.0417s) 를 갖는다. `[TARGET]` 원거리 공격을 하는 보스·컴패니언도 발사 프레임이 명확한 짧은 공격 클립을 갖게 하여 렌더러의 투사체 발사 시점과 동기화한다.
3. **텍셀 밀도** — `[OBSERVED]` 폴리곤 39,518(`abyss-regent`)과 15,067(`tide-warden`) 이 같은 1024x1024 알베도를 공유한다. `[INFERENCE]` 화면 점유가 큰 보스 쪽 텍셀 밀도가 상대적으로 부족하다. `[TARGET]` 보스 10종은 2048x2048 알베도로 재베이크하고 일반 적 4종은 1024 유지.
4. **`tide-warden` 지오메트리 점검** — `[OBSERVED]` 24종 중 폴리곤이 가장 낮다(15,067). `[INFERENCE]` 실루엣 디테일 부족 가능성. `[TARGET]` 육안/Blender 검수 후 필요 시 재생성 후보 lane 등록.

## 3. 다음 단계 명령 (실재하는 스크립트만)

```bash
# 실측 재수집 (변경 후 회귀 비교용)
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/audit-mesh-detail-blender.py

# 카툰 텍스처 재적용 후보 생성
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/apply-cartoon-texture-blender.py

# 상·하체 전체가 움직이는 클립 재작성 후보
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/author-wholebody-clips-blender.py

# 리그 + 애니메이션 재작성 후보
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/rig-and-animate-asset-blender.py

# Rodin 재생성 계획만 출력 (제출은 아래 BLOCKED 참조)
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/rodin-tpose-regen.py -- --plan-only
```

`[BLOCKED]` `scripts/rodin-tpose-regen.py -- --submit` 은 GUI Blender 와 인증된 Rodin 브라우저 세션을 요구하므로 이 환경에서 자동 실행할 수 없다. 메시 자체의 재생성(정점/폴리곤 증가)은 사람이 GUI 에서 제출해야 하며, 그때까지 본 계획의 1·2·3 항목(모션 개별화, 공격 클립 분리, 텍스처 재베이크)만 headless 로 진행 가능하다.

## 4. 승격 경로 (docs/character-asset-pipeline.md 계약 준수)

1. 모든 산출물은 `_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline/runtime-candidates/<lane>/` 에만 쓴다. `assets/images/battle/glb/` 의 런타임 GLB 를 직접 덮어쓰지 않는다.
2. 승격 전 필요 조건: rights receipt, genuine T-pose, 지형/무기 부재, skin weight, 클립 세트, GLB export, Three.js + Canvas fallback 검증.
3. 승격은 별도 리뷰에서 수행하며 런타임 ID 와 기존 배포 GLB 를 자동 교체하지 않는다.
