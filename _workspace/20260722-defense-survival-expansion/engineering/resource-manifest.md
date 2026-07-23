# Resource manifest and provenance gate

| resource class | current source | runtime status | required provenance before replacement |
|---|---|---|---|
| 2.5D actor/terrain | `assets/models/abyssal-command/**/*.glb` | existing | GLB export version, source prompt, embedded-texture validation |
| Blender resource pack | `assets/models/abyssal-command/abyssal-command-resource-pack.blend` + `.glb` | Blender-readable/importable offline; browser runtime loading not verified | Blender 5.1.2 read/import receipt, object/action counts, SHA-256, runtime load/fallback evidence |
| texture families | `assets/models/abyssal-command/textures/` | existing | GodTiboImagen request/result ID, SHA-256, license, 1024² validation |
| UI and object art | code/SVG/existing assets | existing | GodTiboImagen provenance; PerfectPixel `extractMethod: none` |
| animation/VFX | renderer/code and GLB clips | existing | Blender file/version, clip list/pivot/16fps design validation |
| cinematic review MP4 | `assets/video/abyssal-surge-defense-survivor-smoke.mp4` | shipped evidence with locally synthesized soundtrack | H.264/AAC playback receipt; Vox Director provenance required before replacing the visual cut |
| Dusk Warden one-state pilot | `assets/images/battle/pilot/dusk-warden-idle-gti.png` + provenance JSON + blocked-verification JSON | direct GTI concept pilot; not runtime art; PerfectPixel integration blocked | provenance JSON records response/session IDs, prompt, SHA-256, dimensions, pending rights review, and failed PerfectPixel path |

## Resource ingestion rule
No generated file is copied into the runtime path until it has a manifest row and passes load/fallback checks. The PerfectPixel `god-tibo-imagen` provider path failed before request submission. After that failure was isolated, a direct GodTiboImagen one-image concept pilot was generated and provenance-recorded; it remains outside runtime because PerfectPixel validation and rights review are incomplete.

## Blender resource pack — offline verified

Blender 5.1.2 (`ec6e62d40fa9`) opened `assets/models/abyssal-command/abyssal-command-resource-pack.blend` and imported `assets/models/abyssal-command/abyssal-command-resource-pack.glb` non-destructively in background mode. Each operation returned `FINISHED` with 101 objects, 42 actions, and one scene. The `.blend` is 197,491 bytes with SHA-256 `5ea58be5dcfee1e2c89fc41102f53f5fad61d1da4a58ad28dbb6b2690ab091c4`; the `.glb` is 351,356 bytes with SHA-256 `513eb59431c1277874343270a1685aedb751d5343c352f165f9fd71649930a61`. Exact method and paths are in `tech-verification/blender-resource-pack.md`.

This proves offline Blender readability/import only. No browser loader, runtime renderer, material/texture fidelity, clip playback, service-worker path, or deployed fallback was exercised; the GLB is not claimed as browser-runtime content.

## Dusk Warden one-state pilots

`assets/images/battle/pilot/blocked-verification.json` and `tech-verification/image-pipeline.md` preserve the exact PerfectPixel failure: installed `ppgen` rejects provider `god-tibo-imagen`, and its current CLI exposes no `extractMethod: none`/no-pixel-conversion path.

The direct GTI concept pilot is `assets/images/battle/pilot/dusk-warden-idle-gti.png`: a decoded RGB PNG, 1536×1024, 1,955,612 bytes, SHA-256 `4973ac1058c81375f477b80232eaa8de304c5236b0c1ebd1002dcc6edb93d291`. Visual inspection shows the requested original 2.5D full-body Dusk Warden on a uniform magenta matte. Its validated provenance records response `resp_079851467cc87389016a60822eb3808191a64e916adf194674`, session `4c2263a3-b31e-4362-b94a-1719710bcae3`, provider `private-codex`, and model `gpt-5.4`. A later retry exited nonzero after HTTP 429 and did not overwrite the prior successful output. `runtimeEligible` remains false because generated-output rights review and the PerfectPixel adapter/processing path are incomplete; existing runtime resources were not replaced and full-state generation was not started.

## Archive disposition — 2026-07-22
A pre-pilot non-destructive repository scan found 43 asset files, but reference analysis has not yet proven any asset unused across source, service worker, Pages allowlist, tests, and docs. The blocked-verification JSON added afterward is evidence, not runtime art. `assets/_archive/` exists as the required destination; **zero files were moved**. This avoids losing user work or breaking deploy references. A future archive batch must record original path, SHA-256, references searched, mover, timestamp, and restoration command.

## Gameplay video verification
`ffprobe -v error -show_entries format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels -of json assets/video/abyssal-surge-defense-survivor-smoke.mp4` ran on 2026-07-22 after an atomic mux. The shipped 32.200000s MP4 contains full-frame H.264 1280×720 video at 25fps plus AAC-LC 48kHz stereo audio; size 1,532,036 bytes. The image sequence was freshly recorded from the current public browser build and contains the Stage 1 cutscene, combat, Gate/Echo-gated growth card, and post-selection play with zero page/console errors; the battle surface and Canvas both measured 1280×720. The soundtrack was synthesized locally from the authored stage/extraction/occupation cue sheet and passed a separate 60.000000s WAV probe with no clipping. Atlas Cloud/Vox Director was unavailable, so no claim of a Vox-generated cutscene is made.