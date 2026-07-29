# 캐릭터 모션 자연 rest-pose 컷오버

## 결정

11개 self-contained character GLB의 bind pose는 `natural`로 고정한다. `tpose` bake는 진단 전용이며 런타임 후보를 생성하는 기본 경로가 아니다.

## 근거

- 기존 `tpose` bake는 source mesh에 융합된 망토·견갑·무기를 팔과 함께 회전시켜, 팔 동작에서 지오메트리가 고무처럼 늘어난 듯 보이게 했다.
- `scripts/rig-character-asset-blender.py`의 자연 bind 경로는 source의 조형 pose와 skin modifier를 유지한다. runtime action은 여전히 quaternion rotation-only다.
- Guard의 자연 bind smoke render와 갱신된 11개 contact sheet는 팔이 수평 T-pose로 고정되지 않은 동작을 보인다.

## 현재 계약

- generation: `18f2f33f00b2825777fc9753c81281c2a5aee0bd9c97ad441bd11ba54fe53e7c`
- assets: 11
- clips: 121 (retargeted 110, authored fallback 11)
- promoted bytes: 132800560
- 모든 authoring `rig-report.json`: `restPose: natural`, `restPoseOk: true`, orphan vertices 0, max influences 4, legacy `tposeOk` 없음.

## 증거

- `_workspace/current/qa/natural-motion-runtime-smoke.json`
- `_workspace/current/qa/natural-motion-battle-browser.webp`
- `_workspace/current/engineering/asset-pipeline/character-motion-library/*/review/contact-sheet.png`

## 검증

- `node --test _workspace/current/engineering/asset-pipeline/tests/character-motion-library.test.mjs` — 13/13 pass
- `node --test tests/ingame-motion-pack.test.mjs` — 5/5 pass
- `node --test tests/realtime-motion-routing.test.mjs` — 2/2 pass
- `node --test tests/release-closure.test.mjs` — 4/4 pass
- `python3 _workspace/current/engineering/asset-pipeline/tools/build-character-motion-library-index.py --check` — 현재 generation/byte 수 확인
