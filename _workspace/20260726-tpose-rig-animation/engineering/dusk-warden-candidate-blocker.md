# Dusk Warden candidate decision: no candidate created

## Verdict

`_workspace/20260726-tpose-rig-animation/runtime-candidates/commander/dusk-warden.glb` was **not created**. The procedural source cannot meet the assigned bar for a real upright, symmetric T-pose body with lantern, blade, cape, and pedestal preserved as independent attachments.

## Evidence

- The new reference image at `../concept-input/dusk-warden-tpose-reference.png` is usable only as visual direction; it contains no 3D topology, armature, skin weights, or attachment ownership.
- `scripts/build-world-content-pack.py:617-633` defines the whole Dusk Warden as low-poly primitives: torso cylinder, head icosphere, cape cone, core torus, crown/shoulder cones, lantern components, and blade components. It contains no arm, hand, leg, or foot geometry. Creating a candidate from it would be placeholder anatomy, not the requested character.
- The current deployed audit is already structurally animation-ready but not T-posed: `./tpose-rig-audit.json` measures `dusk-warden` shoulder→hand deviations of **L 23.748° / R 75.997°**, with a 24-joint skin, all 2,137 vertices weighted, and 11 actual runtime clips/tracks.
- Even if the primitive source were accepted, the existing rig pipeline cannot preserve its attachments. `scripts/rig-character-asset-blender.py:209-219` gathers every `MESH` from an unsplit input and joins all of them into `body`. This would merge the lantern, blade, cape, torso, and decorative pieces before the T-pose bake. Lines `590-617` bake/rebind that one body; lines `782-796` export only root, rig, and body. There is no attachment-preservation option.
- This is the exact destructive condition the pipeline warns about at `scripts/rig-character-asset-blender.py:29-39`: attached geometry is dragged during a post-hoc T-pose bake.

## Required prerequisite

Provide a real Dusk Warden source mesh that has:

1. upright, symmetric horizontal arms and complete body topology;
2. lantern, blade, cape, and pedestal as distinct rigid or independently skinnable attachments; and
3. a staging rig/export path that retains those attachment boundaries instead of joining every mesh.

Only then can a workspace-only candidate be rigged with `--rest-pose tpose`, pass the 12° bilateral gate, and carry the 11-clip action library. No deployed asset, source script, runtime mapping, authentication session, or credit balance was changed.

Machine evidence: [`dusk-warden-candidate-blocker.json`](./dusk-warden-candidate-blocker.json).
