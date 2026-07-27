# 캐릭터 24종 기술 계보 재검토 — Blender / Rodin / previs motion / god-tibo-imagen

- 검토 대상: `assets/images/battle/glb/character-build-provenance.json`이 기록한 캐릭터 24종 (boss 10, companion 9, enemy 4, commander 1)
- 검토 기준 커밋: `origin/main` = `d8d1c3f`, 개선 전 자산 상태 = `0285b00`
- 질문: "blender mcp, rodin bridge, previs motion, god-tibo-imagen으로 24개 메시에 이음새·텍스처·애니메이션을 다 적용한 게 맞나?"
- 답: **아니다. 네 기술 중 24종 전체에 실제로 적용된 것은 Blender 계열 스크립트 파이프라인 하나뿐이다.** 나머지 셋은 1종(commander) 또는 다른 자산군에만 닿았다.

상태 표기는 저장소 규칙을 따른다: `[OBSERVED]`는 이 저장소에서 명령/파일로 확인한 값, `[INFERENCE]`는 확인값에서 끌어낸 판단이다.

## 1. 기술 × 24 메시 커버리지

| 기술 | 24종 중 실제 적용 | 근거 | 판정 |
|---|---|---|---|
| Blender (headless python) | **24 / 24** | `character-build-provenance.json`의 `pipeline` = `bind-static-lower-mesh.py` → `author-wholebody-clips-blender.py` → `bake-character-albedo.py`; 23종 `lowerMeshBound:true`, 24종 모두 `clipBalance` 기록 | `[OBSERVED]` 적용됨. 단 **대화형 "Blender MCP" 세션이 아니라** 저장소에 체크인된 headless 스크립트다 |
| Rodin bridge | **1 / 24** (commander) | `_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline/rodin-candidates/` 아래에 `commander/player-core-rodin-tpose-v01.glb` 단 하나만 존재 | `[OBSERVED]` 23종은 Rodin 산출물이 아님 |
| previs motion | **0 / 24** (캐릭터 clip 기준) | previs 자산은 `assets/images/battle/glb/previs/anchor-shard.previs.glb` 1개뿐이고 이는 companion previs 프록시다. 런타임 11개 clip은 `author-wholebody-clips-blender.py`가 authoring한 결과 | `[OBSERVED]` 캐릭터 애니메이션은 previs motion 라이브러리에서 오지 않았다 |
| god-tibo-imagen | **0 / 24** (런타임 텍스처 기준) | 유일한 gti 산출물은 `engineering/asset-pipeline/concept-input/dusk-warden-cartoon-albedo-v2/v3.png`이며, 자체 provenance 사이드카가 `runtimeEligible: false`, `"concept/reference lane only"`로 못 박음 | `[OBSERVED]` 런타임 albedo 중 gti 바이트는 0종 |

Rodin이 아무 데도 안 쓰인 것은 아니다. 스테이지/프롭 쪽에는 실제로 쓰였다: `_workspace/20260726-stage1b-cinder-pressure-agency/qa/stage-worlds-v06-rodin-evidence.json`, `qa/rodin-landmark-submission-v05.json`, 런타임 프롭 `assets/images/battle/glb/props/tide-lock-beacon-rodin.glb`. `[OBSERVED]`

## 2. 캐릭터 본체 24종은 어디서 왔나

- commander(`dusk-warden`) 1종: Rodin bridge (`scripts/rodin-tpose-regen.py`, 후보 lane `rodin-candidates/commander/`). `[OBSERVED]`
- 나머지 23종: `scripts/tpose_blockout.py`의 **parametric T-pose blockout**. 이 스크립트와 43개 GLB는 커밋 `d8e9d9f` "feat: T-pose character pipeline (43 GLBs)"에서 함께 들어왔다(`git log --follow -- assets/images/battle/glb/bosses/abyss-regent.glb`). `[OBSERVED]`

즉 "24개 메시를 Rodin으로 뽑았다"는 서술은 성립하지 않는다. `[INFERENCE]`

## 3. 텍스처: 재검토에서 드러난 실제 결함

개선 전(`0285b00`) 24개 런타임 GLB에 박힌 이미지 해시를 전부 덤프한 결과:

- `abyssal-toon-normal-v01.png` — **24 / 24 공유** `[OBSERVED]`
- `abyssal-toon-surface-subtle-v01.png` (256 px detail tile) — **23 / 24 공유**, 유일한 차이는 머티리얼의 `baseColorFactor` 한 값 `[OBSERVED]`
- 자기만의 base color 아틀라스를 가진 캐릭터 — commander 1종뿐 `[OBSERVED]`

그래서 "24개 메시에 텍스처를 적용했다"는 문장은 *형식적으로만* 참이었다. 모든 primitive에 baseColor/normal 텍스처가 물려 있는 것은 맞지만(그건 `tests/runtime-visual-assets.test.mjs`가 지킨다), 23종은 **동일한 타일 하나를 색만 바꿔 쓴 것**이라 캐릭터 고유의 albedo 아트가 존재하지 않았다. 커밋 `0285b00`의 메시지도 같은 사실을 기록하고 있다. `[OBSERVED]`

이음새(UV seam) 역시 검증 대상이 아니었다. 공유 타일은 UV 아일랜드와 무관하게 반복되므로 seam padding이라는 개념 자체가 성립하지 않았다. `[INFERENCE]`

## 4. 애니메이션은 실제로 24종 전부 적용돼 있다

- 23종: `<id>::{idle,move,run,hit,bighit,attack,critical,avoid,defence,die,show}::v01` 11개 clip
- commander: 위 11개 + 전용 strike 2개 = 13개 clip (`player-combat-animation-candidate/author_player_combat_clips.py` 계보)
- 모든 clip이 상·하체 양쪽 travel > 0 (`clipBalance`), `tests/promoted-character-assets.test.mjs`가 강제

`[OBSERVED]` 이 항목은 사용자 주장과 일치한다.

## 5. 재검토 뒤 실행한 개선

1. **캐릭터별 cartoon albedo bake** — `scripts/bake-character-albedo.py` 신설. 잃어버린 원본 아틀라스를 찾는 대신, 각 메시가 실제로 쓰는 UV 언랩 위에 직접 굽는다. 삼각형을 UV 공간에 barycentric rasterize → 로컬 높이·노멀·방위각으로 shadow/body/lit/rim 4-band + accent(sash·boot·crown)를 구성 → 기존 detail tile을 낮은 진폭으로 곱해 grain 유지.
   - 23종 baked, commander 1종 copy-through(이미 authored 아틀라스 보유 + 배포 바이트 고정) `[OBSERVED]`
   - 아틀라스 1024², UV coverage 0.502–0.646, dilation 후 0.905–0.977 `[OBSERVED]`
   - 24개 아틀라스 해시가 전부 서로 다름 = 공유 타일 소멸 `[OBSERVED]`
2. **이음새(seam) 보증** — 아일랜드 바깥으로 12 texel dilation. 셰이더 필터링/밉맵이 seam 너머 배경을 샘플링할 수 없다. 굽힌 texel은 sRGB 0으로 떨어지지 않도록 바닥을 깔아, "세 채널 모두 0 = 배경"이 정확히 성립하고 PNG만으로 padding을 측정할 수 있다. `[OBSERVED]`
3. **이중 착색 제거** — albedo가 텍스처로 들어갔으므로 `baseColorFactor`를 `[1,1,1,1]`로 되돌림. `[OBSERVED]`
4. **계보를 자산에 각인** — `character-build-provenance.json`의 자산마다 `bodyOrigin`(rodin-bridge / parametric-tpose-blockout)·`albedoOrigin`·`albedoBake`(아틀라스 해시, 해상도, coverage, dilation, palette)를 기록. 이제 "이 메시를 무슨 도구가 만들었나"를 채팅 기록이 아니라 런타임 lane에서 답할 수 있다. `[OBSERVED]`
5. **테스트로 고정** — `tests/character-albedo-bake.test.mjs` 신설(53 assertions/subtests). 24개 아틀라스 유일성, 1024² 규격, 채움 비율, UV vertex texel 주변 12 texel 무배경, provenance ↔ 실제 바이트 해시 일치, `--check` 재실행 바이트 재현성, `bodyOrigin`이 Rodin으로 표시된 캐릭터가 정확히 commander 1종일 것.

## 6. 남은 사실 / 미해결

- `[OBSERVED]` 육안 검증은 아직 사람 몫이다. 이번 개선은 구조·수치로만 검증했다(밴드 수, coverage, seam padding, 해시). 게임 카메라 기준 before/after 캡처는 별도 작업이다.
- `[OBSERVED]` 23종 본체는 여전히 parametric blockout이다. albedo는 캐릭터별로 갈렸지만 **실루엣 다양성은 이번 작업 범위가 아니다.**
- `[OBSERVED]` `node --test 'tests/**/*.test.mjs'` 결과 561 pass / 3 fail / 10 skipped. 실패 3건은 전부 `tests/defense-expansion-contract.test.mjs`의 게임플레이 계약(예: "echo recovery must unlock occupation recovery")이며, 개선 전 `0285b00` 기준선에서도 동일하게 실패한다. 이번 자산 변경과 무관하다.
- `[OBSERVED]` candidate lane 대부분이 `.gitignore` 대상이라 clean checkout에서는 lane 의존 테스트가 skip된다. 런타임에 실린 바이트는 `character-build-provenance.json` 해시로만 검증된다.
