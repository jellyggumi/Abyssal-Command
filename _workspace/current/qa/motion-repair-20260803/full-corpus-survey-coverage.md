# S0.D1 Raw Survey Coverage

- Command: `/Applications/Blender.app/Contents/MacOS/Blender -b -P _workspace/current/engineering/asset-pipeline/tools/derive-kinematic-bounds-blender.py -- --survey --config _workspace/current/engineering/asset-pipeline/character-motion-library/library-config.json --corpus-manifest _workspace/current/engineering/asset-pipeline/motion-bench/full-corpus-v1.json --vectors _workspace/current/engineering/asset-pipeline/motion-bench/kinematic-conformance-vectors-v1.json --out _workspace/current/qa/motion-repair-20260803/full-corpus-survey.json`
- Blender: 5.1.2 (`/Applications/Blender.app/Contents/MacOS/Blender`)
- Surveyed raw candidates: 116 total — 66 loose FBX and 50 archive members.
- Observed channels: 4,292; sampled frames: 6,958 at 24 FPS.
- Manifest-labeled `die` candidates: 5 — exactly three loose and two archive members.
- `assets/motion/bench/Turn To Knocked Unconscious.fbx` remains a raw candidate with no `die` label; its death-adjacent filename is explicitly excluded by `full-corpus-v1.json`.
- Authored fallback rows excluded from this raw survey: 11.

This is policy-free observed coverage only. It emits no bounds, margin, outlier, or runtime-routing decision.
