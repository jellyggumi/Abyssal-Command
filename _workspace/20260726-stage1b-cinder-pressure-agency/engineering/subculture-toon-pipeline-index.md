# Subculture Cartoon-Rendering Pipeline — Spec Index

run-id: `20260726-stage1b-cinder-pressure-agency`
lane: engineering
status: **[TARGET]** — design/spec layer only. No renderer, simulation, Blender, or audio
code was changed by this pass; nothing here has been measured on the build.

## Purpose

Applies the supplied subculture cartoon-rendering research brief (NPR cel shading,
combat motion FSM, Blender procedural VFX, ElevenLabs audio) to the resources that
actually exist in this repository, under the game-studio-harness Stage 1
(concept / presentation / animation / resources) lane.

## Documents

| Spec | Path | Applied to (observed resource) |
|---|---|---|
| NPR toon rendering | `engineering/npr-toon-render-spec.md` | `battle-realtime-three.js` (`toonMaterial()`, `CEL_SHADOW_BANDS`, remaining `MeshStandardMaterial` props), `battle-visualizer.js` Canvas2D fallback, `scripts/apply-cartoon-texture-blender.py` |
| Combat motion FSM | `engineering/combat-motion-fsm-spec.md` | `defense-catalog.js` (`TICK_RATE = 60`), `defense-run-simulation.js` attack path, `scripts/author-wholebody-clips-blender.py`, `scripts/qa-motion-probe.mjs` |
| Procedural VFX | `engineering/blender-procedural-vfx-spec.md` | `_workspace/.../blender/*.py`, `scripts/export-battle-glb.py`, Three.js trail/projectile meshes |
| Generative audio | `engineering/elevenlabs-audio-pipeline-spec.md` | `scripts/generate-audio.mjs` (existing ElevenLabs client, `.env.game-audio`, `assets/audio/elevenlabs/`), `defense-audio.js` procedural cues |

## Cross-cutting constraints carried into every spec

- **Determinism**: presentation code may read simulation snapshots but must never
  write back into simulation state or alter `getRunDigest()` inputs. Hit-stop
  duration and hit-frame timing are the only combat-feel elements that belong on
  the simulation side; anticipation arcs, smear meshes, VFX, camera shake, FOV
  punch, and chromatic aberration are presentation-only.
- **Shared palette**: cel ramp band thresholds (toon spec) and Blender VFX emission
  ramps (VFX spec) must be authored against one palette; outline width scales with
  camera distance.
- **Frame contract**: the FSM Active / Hit-Stop frame keys are the single sync
  source for VFX spawn, screen shake, and the SFX transient peak.
- **Secrets**: `.env.game-audio` and machine-local runtime state are never committed.

## Not done in this pass

- No gate (G1–G8) verdict is claimed or changed; these specs are inputs, not evidence.
- No asset was generated, rendered, or synthesized; no ElevenLabs API call was made.
- Implementation, benchmarking, and QA verification remain open follow-up work.

## Known workspace conflict

`CLAUDE.md` names `_workspace/20260726-stage2-balance-agency/` as the retained run,
but the retained folder on disk is `_workspace/20260726-stage1b-cinder-pressure-agency/`
(which contains `production/task-manifest-stage2-balance-agency.md`). Both records are
preserved here; the specs were filed into the folder that exists. Director to reconcile.
