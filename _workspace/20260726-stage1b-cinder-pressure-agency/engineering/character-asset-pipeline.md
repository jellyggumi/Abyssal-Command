# Character Asset Pipeline Handoff — Stage 2

**Run:** `20260726-stage2-balance-agency`
**Owner:** programmer / production handoff
**Scope:** reusable Rodin character-source, cartoon texture, rigging, and animation pipeline
**Gate posture:** not a Stage 2 balance gate verdict; runtime asset promotion remains blocked until the evidence checklist is complete.

## Applied in this cycle

- Rodin prompt contract is explicit in `scripts/rodin-tpose-regen.py`:
  - genuine T-pose;
  - character body only;
  - no terrain, floor, pedestal, platform, rocks, weapons, shields, held props, equipment, debris, or background geometry;
  - negative prompt is serialized into every plan.
- Candidate output defaults now use `_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline/` rather than a superseded workspace.
- `scripts/validate-asset-lanes.py` accepts `--policy` and defaults to `engineering/asset-pipeline/asset-lanes.json`.
- `scripts/apply-cartoon-texture-blender.py` uses the current pipeline workspace, requires an active body UV map, and explicitly maps active UV coordinates to the cartoon Base Color image node.
- `scripts/rig-character-asset-blender.py` rejects imported mesh object names that indicate terrain or held props instead of silently binding them into the body.
- Existing split `_pedestal` geometry is removed before the rig candidate export; arbitrary fused terrain cannot be safely inferred and remains a visual-audit reject.
- `scripts/rig-all-characters.sh` keeps its legacy runtime-rerig default (`--rest-pose natural`); the clean-source command above uses `--rest-pose tpose`.
- `scripts/build-motion-prompt-batch.py` uses the current action contract and the corrected v3 texture reference.
- `tests/asset-lane-separation.test.mjs` now uses the retained current candidate lane.

## Evidence

| Item | Result | Evidence |
|---|---|---|
| Authenticated image CLI | `[OBSERVED]` present | `$HOME/.codex/auth.json` exists; `gti --dry-run` completed without warnings in the request body |
| T-pose prompt shape | `[OBSERVED]` | `scripts/rodin-tpose-regen.py#promptContract` |
| Cartoon texture candidates | `[OBSERVED]` generated, not runtime | v2 rejected after visual review found generated labels; v3 retained as an unlabelled concept atlas with adjacent provenance |
| Texture candidate checksum | `[OBSERVED]` | v3 SHA-256 `0f269d2f0de0b54c314697bda9ed9a6b629c6d84d61be1a536361b97e0c0668d` |
| Lane validator | `[OBSERVED]` pass | `python3 scripts/validate-asset-lanes.py --json --allow-missing-candidates` → `ok: true`, 198 lane files, 0 violations |
| Motion action contract | `[OBSERVED]` defined | `engineering/asset-pipeline/action-pipeline.json`, 11 actions |
| Blender execution | `[BLOCKED]` | `blender` is not installed on this workstation |
| Rodin browser handoff | `[BLOCKED]` | requires GUI Blender plus logged-in Rodin session |
| Runtime promotion | `[BLOCKED]` | no T-pose, UV bake, skin-weight, GLB export, or browser/fallback receipt yet |

## Required next handoff evidence

1. Run Rodin for one pilot asset in GUI Blender and save the condition mesh plus candidate result in the current candidate lane.
2. Reject any result with terrain, pedestal, weapon, shield, held prop, or background geometry.
3. Verify body UVs, project/bake the cartoon atlas, and retain the Blender report with active UV name and layer count.
4. Rig the clean body with `rig-character-asset-blender.py --rest-pose tpose` and retain T-pose deviation, bind method, weighted vertex count, and clip count.
5. Generate the 11-action prompt packet, author NLA clips, export a candidate GLB, and run glTF/animation census checks.
6. Add provenance fields `rightsReceipt` and `runtimeReceipt`; keep `runtimeEligible: false` until Three.js and Canvas fallback evidence is attached.

Full operating instructions and external references: `docs/character-asset-pipeline.md`.
