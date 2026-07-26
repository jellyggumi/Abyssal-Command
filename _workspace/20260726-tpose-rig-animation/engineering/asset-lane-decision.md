# Asset Lane Decision — T-pose / Texture / Motion

- run-id: `20260726-tpose-rig-animation`
- date: `2026-07-26`
- decision: keep concept/reference inputs, deployed runtime assets, and unshipped candidates in separate lanes.

## Lane contract

| lane | canonical paths | runtime eligibility |
|---|---|---|
| concept/reference | `assets/images/battle/pilot/`, `_workspace/20260726-tpose-rig-animation/{visual,angle-representatives,design,intake,production}/` | always false |
| runtime | `assets/images/battle/glb/`, `assets/images/battle/world/`, `assets/audio/`, existing manifest paths | existing IDs/paths preserved |
| candidate | `_workspace/20260726-tpose-rig-animation/runtime-candidates/` | false until provenance, rights, GLB embedding, and browser/fallback receipts exist |

The validator rejects concept-marked files in runtime paths, lane overlap, disallowed extensions, and candidate artifacts without a sibling `.provenance.json` containing the required promotion fields. The one excluded legacy misplaced provenance file is explicit in `asset-lanes.json`; no broad suffix exemption remains.

## Pipeline outputs

- `scripts/rodin-tpose-regen.py` reads deployed GLBs and stages concept inputs, T-pose condition meshes, and Rodin outputs under candidate siblings. It never writes deployed GLBs by default; `--accept-runtime` is explicit and still requires an existing staged candidate.
- `scripts/apply-cartoon-texture-blender.py` reads the runtime GLB plus a concept texture with `runtimeEligible=false` provenance, reports a candidate output, and preserves source GLB/armature/actions. Default output is under `runtime-candidates/cartoon-texture/`.
- `scripts/build-motion-prompt-batch.py` emits 11 deterministic concept/reference prompts for `idle`, `move`, `run`, `hit`, `bighit`, `attack`, `critical`, `avoid`, `defence`, `die`, and `show`. Blender NLA remains the authoring step; `runtimeHandoff.runtimeEligible=false`.

## Evidence

- `python3 scripts/validate-asset-lanes.py --json --allow-missing-candidates`: pass; 263 files scanned (170 concept, 93 runtime, 0 candidate), 0 violations.
- `python3 -m py_compile scripts/validate-asset-lanes.py scripts/apply-cartoon-texture-blender.py scripts/rodin-tpose-regen.py scripts/build-motion-prompt-batch.py`: pass.
- `node --test tests/asset-lane-separation.test.mjs`: pass; 6 tests, 0 failures, 0 skipped.
- Cartoon dry-run: pass; `assetLane=candidate`, `sourceLane=runtime`, `textureLane=concept`, `runtimeEligible=false`, no candidate GLB written.
- Motion batch generation: pass; 11 ordered prompts, deterministic output, runtime handoff false.

## Open gate

Blender CLI execution is now verified; the live Blender MCP bridge and browser/fallback verification remain open. No generated candidate is a shipped runtime resource until the sidecar and runtime verification evidence are complete.

## 2026-07-26 retry evidence

- Blender CLI: Blender 5.1.2 with `a_Rodin` enabled; the live Blender MCP bridge remained unavailable, so CLI execution was used.
- Rodin submission: `scripts/rodin-tpose-regen.py --submit --only cinder-warden` returned `submitted` with operator result `FINISHED`; the generated T-pose condition remains concept-only and `runtimeEligible=false`.
- Cartoon texture: `scripts/apply-cartoon-texture-blender.py` completed a GLB round-trip from the deployed Dusk Warden asset, applying a body-only cel-compatible material while preserving the armature and 11 actions. The exported review artifact and its receipt were relocated under `visual/cartoon-texture-review/` because runtime promotion evidence is still pending.
- Motion/NLA: `scripts/build-motion-prompt-batch.py` emitted 11 deterministic action prompts; the NLA dry-run validated all action budgets for `anchor-shard`.
- Verification: `python3 scripts/validate-asset-lanes.py --json --allow-missing-candidates` passed with 269 files scanned and 0 violations; `node --test tests/asset-lane-separation.test.mjs` passed 6/6; focused pipeline scripts compiled.
