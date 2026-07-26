# Task Manifest — T-pose Rigging and Animation

run-id: `20260726-tpose-rig-animation` · director · 2026-07-26  
Operating mode: **Stage 3 resource/animation verification and repair**.  
Next public beat: one visually verified, T-pose-compatible, animated character candidate that preserves the deployed runtime contract; no unverified asset replacement.

| task | owner | stage.phase | artifact | gate | status | beat |
|---|---|---|---|---|---|---|
| Full deployed T-pose / skin / clip audit | executor + QA | S3 audit | `engineering/tpose-rig-audit.{md,json}`, `qa/rig-contract-baseline.md` | G4/G6 | done — 1/24 structural T pass; 23 regeneration-only | truthful asset baseline |
| Visual image review | designer | S3 audit | `design/tpose-visual-audit.md`, pose frames | G4 | done — 24/24 image coverage; four-category deep review | visual evidence |
| AI regeneration preflight | director | S3 prep | `production/cinder-tpose-pilot-plan.json`, staged condition mesh | G4/G6 | done — Rodin addon present, no submission or credits | safe pilot preparation |
| Commander T-pose candidate source and rig | executor | S3 repair | `engineering/dusk-warden-candidate-blocker.{md,json}` | G4/G6 | blocked — no real complete-body mesh; staging candidate deliberately not created | preserve commander attachment boundaries |
| Character candidate contract test | QA | S3 verification | `qa/gate-measurements.md#g4` | G4/G6 | blocked: no eligible candidate | evidence before promotion |
| Interactive Rodin source regeneration | user-authenticated GUI Blender | S3 repair | staged candidates for 22 remaining A-pose Rodin meshes | G4/G6 | blocked: authenticated Hyper3D session and output inspection | remaining T-pose source meshes |
| Runtime promotion and renderer proof | programmer + QA | S3 verification | staged asset diff + browser evidence | G4/G6 | blocked: verified candidate | no broken runtime loading |

## Gate status

Stage 3 is **FIX 1/2**: G4, G6, and G1 have no exit-pass evidence. See `qa/gate-measurements.md`, `production/gate-reviews/stage-3-g4-g6-g1.md`, and `production/full-quality-status.md`.

## Hard policy

1. Never batch T-pose-bake the 23 A-pose deployed GLBs. The current unsplit-mesh pipeline can fuse attachments before rebinding; destructive deformation is directly evidenced for the Dusk Warden condition, not yet measured for every asset.
2. `bosses/pack-herald.glb` already meets the structural 12° T-pose gate; it is explicitly excluded from conversion.
3. Staged candidates require: both shoulder-to-hand elevations <=12°, fresh bind/clip image review, 24-joint skin, all 11 canonical clips, and focused contract pass before any promotion.
4. Generated images and Rodin outputs are source inputs/candidates—not shipped resources—until the validation row is complete.
