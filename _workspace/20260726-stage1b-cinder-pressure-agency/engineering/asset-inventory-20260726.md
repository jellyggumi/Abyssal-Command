# Asset Inventory — 2026-07-26

**Snapshot:** 2026-07-26T08:58:28Z  
**Scope:** repository-authored game media and adjacent asset/stage metadata under the repository root. `node_modules/` is excluded as installed third-party content; its three package UI images are listed under exclusions. `.git/`, `.gjc/`, agent caches, and generated graph indexes are not game-asset lanes. No asset, catalog, script, or production-code file was changed.

## Evidence vocabulary

- **OBSERVED** — read from the filesystem, a checked catalog/reference, or the GLB JSON chunk.
- **INFERENCE** — role/readiness inferred from names or placement where no runtime contract proves it.
- **TARGET** — proposed next-slice use; not current behavior.

## Executive census

**OBSERVED — physical files:** 295 files after the stated exclusion boundary.

| Kind | Exact extension counts | Total |
|---|---:|---:|
| Images | `.png` 212, `.jpg` 9, `.webp` 5, `.svg` 1, `.ico` 1 | **228** |
| 3D/source models | `.glb` 51, `.blend` 7 | **58** |
| Video/presentation clips | `.mp4` 6, `.webm` 2 | **8** |
| Standalone audio | `.wav` 1; `.mp3/.ogg/.m4a/.aac/.flac` 0 | **1** |
| **Total** |  | **295** |

**OBSERVED — primary-use classification:** each physical file is counted once. “Runtime-used” means an active production consumer, not merely a retained manifest row.

| Class | `.png` | `.jpg` | `.webp` | `.svg` | `.ico` | `.glb` | `.blend` | `.wav` | `.mp3` | `.mp4` | `.webm` | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Runtime-used | 2 | 0 | 2 | 1 | 0 | 40 | 0 | 0 | 0 | 0 | 0 | **45** |
| Available-but-unused | 14 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 0 | 1 | 0 | **25** |
| Candidate/non-runtime | 78 | 0 | 0 | 0 | 0 | 1 | 7 | 1 | 0 | 0 | 0 | **87** |
| Duplicate/stale/transient | 118 | 9 | 3 | 0 | 1 | 0 | 0 | 0 | 0 | 5 | 2 | **138** |
| **Existing total** | **212** | **9** | **5** | **1** | **1** | **51** | **7** | **1** | **0** | **6** | **2** | **295** |
| Broken/missing references (not existing files) | 85 | 0 | 0 | 0 | 0 | 15 | 0 | 0 | 4 | 0 | 0 | **104** |

The 104 missing references are all in stale/candidate presentation metadata; **OBSERVED: active production runtime path maps have zero missing targets**.

## Exhaustive path-family coverage

These disjoint rows cover all 295 physical files.

| Family | Exact content | Count | Primary class |
|---|---|---:|---|
| repository root | `icon.svg`, `favicon.ico`, `generated-1784872471882.png` | 3 | runtime UI 1; stale duplicate 1; candidate unknown 1 |
| `assets/icons/` | `icon-192.png`, `icon-512.png` | 2 | runtime UI |
| `assets/images/battle/` direct PNGs | 8 runtime-retained actor frames plus 12 atlas/cleanup intermediates | 20 | available-unused 8; stale 12 |
| `assets/images/battle/pilot/` | 63 concept PNGs | 63 | candidate/non-runtime |
| `assets/images/battle/world/` | 2 Cinder Span WebP plates | 2 | runtime terrain/presentation |
| `assets/images/battle/glb/` | 50 retained GLBs plus 1 excluded previs GLB | 51 | runtime 40; available-unused 10; candidate 1 |
| `assets/video/` | one gameplay-smoke MP4 | 1 | available presentation evidence |
| `design/assets/cinematic/` | six cinematic PNGs | 6 | available presentation resources |
| current run workspace | 12 UI-audit screenshots plus two Dusk Warden texture candidates | 14 | candidate/evidence; non-runtime |
| `tmp/` direct files | 46 PNG, 5 JPG, 3 WebP, 2 MP4, 1 WAV, 1 Blend | 58 | WAV/Blend candidate; remainder transient |
| `tmp/atlas/` | 9 PNG | 9 | stale/transient atlas output |
| `tmp/final-capture*/` | 1 PNG, 2 WebM | 3 | stale/transient evidence |
| `tmp/units/` | 50 PNG, 6 Blend | 56 | Blend candidate sources; PNG render intermediates |
| `tmp/vox-director-upstream/` | 4 JPG, 3 MP4 | 7 | stale third-party showcase material; not Abyssal content |
| **Total** |  | **295** |  |

**OBSERVED — excluded third-party media:** `node_modules/playwright-core/lib/server/chromium/appIcon.png` and two `playwright-logo.svg` files (3 files) are package implementation assets, not repository game assets.

## Runtime path families and live consumers

| Path family | Active use | Count | Evidence |
|---|---|---:|---|
| `assets/images/battle/glb/terrain/*.glb` | one stage terrain per 10 stages | 10 | `battle-realtime-three.js` `TERRAIN_MODELS` |
| `assets/images/battle/glb/bosses/*.glb` | one boss per 10 stages | 10 | `BOSS_MODELS` |
| `assets/images/battle/glb/enemies/*.glb` | rusher→scout, flanker→shade, guardian→guard, ranged→possessed | 4 | `ENEMY_MODELS` |
| `assets/images/battle/glb/companions/*.glb` | nine companion IDs | 9 | `COMPANION_MODELS` |
| `assets/images/battle/glb/commander/dusk-warden.glb` | commander actor and UI portrait | 1 | `COMMANDER_MODEL`, `COMMANDER_MESH_ROOT` |
| `assets/images/battle/glb/vfx/*.glb` | six event-driven VFX | 6 | `VFX_MODELS` |
| `assets/images/battle/world/*.webp` | Cinder Span Canvas fallback background/map | 2 | `battle-visualizer.js` `WORLD_TEXTURES` |
| `icon.svg`, `assets/icons/*.png` | PWA icons | 3 | root `manifest.json`; PNGs also in `sw.js` |

**OBSERVED:** `assets/defense-asset-manifest.json` and `scripts/defense-runtime-assets.mjs` retain 50 GLBs, 10 PNGs, and 2 WebPs. Active-consumer tracing narrows that to 40 GLBs, two WebPs, and the two PNG icons. The remaining 10 GLBs are cataloged portrait resources with no current callsite, and the eight actor-frame PNGs are service-worker precache entries with no renderer consumer.

## GLB and animation inventory

All 51 GLBs passed lightweight header/length/JSON-chunk parsing as glTF 2.0. No model was regenerated or imported into Blender.

| Role/path | Models | Animated models | Clip count | Skin count | Size | Status |
|---|---:|---:|---:|---:|---:|---|
| Bosses `glb/bosses/` | 10 | 10 | 110 | 10 | 15.85 MiB | runtime-used |
| Commander `glb/commander/` | 1 | 1 | 11 | 1 | 0.48 MiB | runtime-used |
| Companions `glb/companions/` | 9 | 9 | 99 | 9 | 9.12 MiB | runtime-used |
| Enemies `glb/enemies/` | 4 | 4 | 44 | 4 | 3.80 MiB | runtime-used |
| Terrain `glb/terrain/` | 10 | 0 | 0 | 0 | 0.33 MiB | runtime-used, static |
| VFX `glb/vfx/` | 6 | 0 | 0 | 0 | 0.24 MiB | runtime-used, runtime-transformed static meshes |
| Props `glb/props/` (five rewards + five tier gems) | 10 | 0 | 0 | 0 | 0.15 MiB | available-but-unused |
| Previs `glb/previs/anchor-shard.previs.glb` | 1 | 1 | 1 | 0 | 22.55 MiB | candidate/non-runtime; explicitly excluded by `asset-lanes.json` |
| **Total** | **51** | **25** | **265** | **24** | **52.52 MiB** |  |

**OBSERVED:** the 50 retained/runtime-lane GLBs total 29.97 MiB. Every one of the 24 runtime character GLBs has the same 11 named clips: `idle`, `move`, `run`, `hit`, `bighit`, `attack`, `critical`, `avoid`, `defence`, `die`, `show`, using `{assetId}::{action}::v01`. `battle-realtime-three.js` creates an `AnimationMixer`, loops idle/move/run, and treats the others as one-shots. Terrain, props, and VFX contain no embedded clips.

**OBSERVED:** `anchor-shard.previs.glb` has one `anchor-shard_previs` animation, no skin, is 22.55 MiB by itself, and is excluded from the runtime lane. **INFERENCE:** without a skin and runtime receipt it is presentation previs, not a drop-in replacement for the skinned companion.

**OBSERVED — `.blend` sources (7, all non-runtime):**

- Boss-role candidates: `tmp/gate-sovereign.blend`, `tmp/units/sovereign.blend` (role is **INFERENCE** from filename).
- Enemy-role candidates: `tmp/units/{guard,possessed,reinforce,scout,shade}.blend` (role is **INFERENCE** from filename).
- Animation metadata inside these Blend files is **UNKNOWN**; no Blender regeneration or heavyweight scene load was performed.

## Image inventory and role map

### Runtime/available images

- **UI:** `icon.svg`, `assets/icons/icon-{192,512}.png` are active PWA icons.
- **Terrain:** `assets/images/battle/world/cinder-span-{topdown-plate,tactical-paper-plate}.webp` are actively drawn by the Canvas fallback on Cinder Span.
- **Commander:** four `dusk-warden-frame-0[0-3].png` files are retained and precached, but no current renderer consumes them.
- **Enemy:** four `echo-rusher-frame-0[0-3].png` files are retained and precached, but no current renderer consumes them.
- **Stage/presentation:** `design/assets/cinematic/scene_{00_opening_gate_prompt,00_opening_gate_v01,01_soul_pool_v01,03_possession_action_v01,04_domain_shift_v01,07_return_ui_v01}.png` are valid stills referenced only by design shot/control files, not production runtime.
- **Presentation evidence:** `assets/video/abyssal-surge-defense-survivor-smoke.mp4` is not embedded by the game; README/release checks reference it. `ffprobe` observed H.264 1280×720 at 25 fps plus AAC 48 kHz stereo, 32.2 s.

### Pilot concept set — 63 PNG, all candidate/non-runtime

Role groupings below are exact and disjoint; role on legacy concepts is **INFERENCE** from names.

| Role | Files/patterns | Count |
|---|---|---:|
| Commander | `dusk-warden-{cartoon-albedo,idle-gti,idle-gti-refstyle}`, `concept-player-core-v01..v04`, `concept-sung-hum-v01..v04` | 11 |
| Companion | `concept-{anchor-shard,dawnless-crown,ember-cohort,lantern-reaver,pack-warden,requiem-warden,rift-lens,throne-echo,veil-vanguard}` | 9 |
| Enemy | `concept-{guard,possessed,scout,shade}`, `concept-shadow-soldier-v01..v04` | 8 |
| Boss | `concept-s1..s10-*` (10), `concept-broken-court-monarch-{boss,v01..v04}` (5), `concept-{human-command-boss,shadow-commander-boss,sung-hum-boss}` (3) | 18 |
| Terrain | `concept-terrain-{abyss-chancel,cinder-span,echo-throne-steps,echo-throne,gate-zenith,glass-necropolis,howling-sprawl,shattered-causeway,starless-canal,sunken-bastion,veil-citadel}` | 11 |
| Prop/UI | `concept-{abyssal-banner,bulwark-brand,choir-ward-crystal,equipment-tier-gems,stillwater-hourglass,warden-lantern}` | 6 |
| **Total** |  | **63** |

Each pilot PNG has an adjacent provenance JSON. `blocked-verification.json` records that the PerfectPixel pilot did not validate and runtime ingestion was not approved.

### Current workspace candidates/evidence — 14 PNG

- Commander texture candidates: `engineering/asset-pipeline/concept-input/dusk-warden-cartoon-albedo-v{2,3}.png` (2). V3 provenance explicitly says `runtimeEligible: false`; rights review, GLB bake/embedding, and browser/fallback verification remain pending.
- UI evidence: `design/current-ui-audit-*.png` (12: desktop companions/cutscene/defeat/growth/lobby/movement/paused/stance and portrait battle/lobby/movement/unlocked-battle). These are audit evidence, not game runtime resources.

### Duplicate/stale/transient images — 138 media files total

- **Exact duplicate:** `favicon.ico` is byte-identical to `assets/icons/icon-192.png` (one redundant copy); no explicit `<link rel="icon">` references it.
- **Known stale intermediates:** 12 PNGs under `assets/images/battle/`: four Dusk Warden atlas variants, four Dusk Warden `clean-*` frames, and four Echo Rusher atlas variants. The current asset manifest marks all 12 `delete`.
- **Transient family:** `tmp/` contributes 125 stale/transient media after excluding its seven Blend candidates and one WAV candidate: 106 PNG, 9 JPG, 3 WebP, 5 MP4, 2 WebM. This includes screen captures, directional renders, atlas trials, and seven unrelated Vox showcase files. No production path references these files.

## Audio assets and cues

### Current runtime audio

**OBSERVED:** there are no runtime MP3/OGG/WAV dependencies. `defense-audio.js` synthesizes audio with Web Audio oscillators/gain nodes.

- 15 catalog cues in `defense-catalog.js`: `stage-start`, `enemy-defeated`, `elite-extracted`, `item-collected`, `growth-offer`, `skill-cast`, `boss-spawned`, `movement-step`, `weapon-fire`, `impact-hit`, `critical-hit`, `extraction-ready`, `occupation-captured`, `terminal`, `camera-clamp`.
- Two persistent programs: ambience (2 oscillator layers) and battle music (3 oscillator layers).
- 31 direct event→cue mappings in `defense-audio.js`, plus event-supplied cue handling and cue variants.

**OBSERVED — stale catalog:** `assets/audio/defense-audio-manifest.json` lists only 13 cues and omits current `critical-hit` and `camera-clamp`. It also has no external assets. Treat it as documentation drift, not runtime truth.

### Non-runtime audio

- `tmp/abyssal-release-soundtrack.wav`: PCM signed 16-bit little-endian, 48 kHz stereo, exactly 60 s; candidate/non-runtime.
- `assets/video/abyssal-surge-defense-survivor-smoke.mp4` includes the one project-relevant embedded AAC track.
- Three unrelated `tmp/vox-director-upstream` showcase MP4s also contain audio; they are stale third-party examples, not reusable Abyssal cues.

## Stage/presentation metadata and catalogs

**OBSERVED — 95 audited asset-control files:** 90 JSON plus five CSV.

| Status | Files | Count |
|---|---|---:|
| Current control catalogs | root `manifest.json`; `assets/defense-asset-manifest.json` | 2 JSON |
| Candidate/reference metadata | 64 pilot JSON + one world provenance JSON + six current-workspace pipeline JSON | 71 JSON |
| Stale catalogs/reports | `animation-manifest.json`, `defense-audio-manifest.json`, 15 `.parts/*.json` | 17 JSON |
| Available presentation controls | five `design/assets/cinematic/scene_01_*.csv` files | 5 CSV |
| **Total** |  | **95** |

- `defense-catalog.js` is the runtime stage/presentation catalog (10 stages, enemy/boss/companion/reward IDs, presentation labels).
- `battle-realtime-three.js` is the authoritative live GLB resolver.
- `battle-visualizer.js` is the authoritative Canvas world-plate consumer.
- `defense-catalog.js` + `defense-audio.js` are authoritative for audio; the JSON audio manifest is stale.
- `_workspace/.../asset-pipeline/asset-lanes.json` defines concept/runtime/candidate separation. `_workspace/.../action-pipeline.json` defines the 11-action contract but explicitly has `runtimeEligible: false` as a pipeline artifact.
- The five cinematic CSVs define scene script, shot sheet, subtitles, audio cues, and VFX priority. They are not loaded by `app.js`.

## Broken and missing reference audit

### Active runtime

**OBSERVED: 0 missing active targets.** All 40 actively consumed GLBs, two world WebPs, and three PWA icons exist. All 207 current rows in `assets/defense-asset-manifest.json` point to existing files; its 50 retained GLB rows exist.

### Stale `.parts` catalogs — 100 unique missing targets

The 15 JSON reports in `assets/images/battle/glb/.parts/` describe an older flat sprite-atlas export pipeline. None of their referenced files exists:

- 15 unique missing source GLBs under retired `assets/models/abyssal-command/{units,bosses,props,terrain}/`.
- 85 unique missing output PNGs: bosses 24 (three assets × eight actions), enemies 50 (five assets × ten actions), props 8 (four assets × two actions), terrain 3 (three assets × one plate).
- The 15 source IDs are `cinder-span`, `cinder-warden`, `command-obelisk`, `echo-throne-steps`, `echo-throne`, `gate-sovereign`, `guard`, `possessed`, `reinforce`, `rift-portal`, `scout`, `shade`, `soul-extractor`, `veil-citadel`, `veil-tactician`.

These are **stale report references**, not broken live requests. The current runtime uses categorized GLBs under `assets/images/battle/glb/` and does not load `.parts`.

### Cinematic audio control — 4 missing targets

`design/assets/cinematic/scene_01_audio_cue.csv` references absent `assets/audio/{hunt,capture,materialize,possess}.mp3`. These are presentation-pack blockers if that CSV is promoted. They are not live runtime requests.

### Validator default policy path — 1 missing control target

**OBSERVED:** `python3 scripts/validate-asset-lanes.py --json --allow-missing-candidates` failed because its default policy points at absent `_workspace/20260726-stage2-balance-agency/engineering/asset-pipeline/asset-lanes.json`. Supplying the current policy explicitly passed with 198 files, candidate 1, concept 132, runtime 65, and 0 violations. This missing JSON control target is separate from the 104 missing media references above.

### Stale historical ledger

`assets/defense-asset-manifest.json` also retains 398 `historicalDeletionRows`. Those are deletion history, not current missing-file defects, and are excluded from the 104 active report/reference misses above.

## Reuse plan for the next vertical slice

1. **TARGET — playable Cinder pressure slice:** keep the current direct set only: Cinder Span terrain, Dusk Warden, Cinder Warden, the four enemy archetypes, one selected companion, and event-driven VFX. This uses already-loaded, animation-complete runtime GLBs and preserves deterministic simulation because presentation remains downstream of event/state output.
2. **TARGET — reward/RPG visibility:** wire the five authored reward props (`stillwater-hourglass`, `bulwark-brand`, `abyssal-banner`, `warden-lantern`, `choir-ward-crystal`) and five tier gems into reward/equipment portraits. They are valid current GLBs but presently have no external callsite; reuse them before generating new art.
3. **TARGET — animation:** use the existing 11-clip character library. Do not promote `anchor-shard.previs.glb`; it is unskinned, one-clip, excluded, and 22.55 MiB. Do not treat the stale two-actor PNG animation manifest or missing `.parts` atlases as a fallback contract without a real consumer and validation pass.
4. **TARGET — terrain/presentation:** retain the two Cinder Span WebPs for Canvas fallback. The six cinematic stills can seed an interstitial/cutscene surface, but their four missing MP3 dependencies must be replaced by mapped procedural cues or supplied with rights/performance receipts before promotion.
5. **TARGET — audio:** continue the 15 runtime procedural cues plus two persistent beds for the slice. Reconcile the stale JSON manifest with `critical-hit` and `camera-clamp`; keep the 60-second WAV outside runtime until licensing, compression, decode/memory, and fallback checks pass.
6. **TARGET — commander texture:** V3 is the only current unlabelled Dusk Warden texture reference, but it remains concept-only. Require rights receipt, UV projection/bake, embedded-texture GLB verification, and browser/fallback evidence before replacing the shipped commander material.
7. **TARGET — cleanup boundary:** do not regenerate assets in this slice. Treat `tmp/`, the 12 atlas intermediates, `.parts` reports, and the duplicate favicon as non-authoritative; no new runtime path may point there.

## Reproduction evidence

- Filesystem census: recursive extension inventory over repository root, excluding only the boundary stated at top.
- Duplicate test: SHA-256 over all 295 scoped physical files; one exact duplicate group (`favicon.ico` and `assets/icons/icon-192.png`).
- GLB metadata: direct glTF header/declared-length/JSON-chunk parsing; 51/51 valid, with animation/skin counts reported above.
- Catalog integrity: existence check for all 207 current asset-manifest rows (0 missing), 170 `.parts` row references collapsed to 100 unique missing paths, and four cinematic MP3 paths.
- Media metadata: `ffprobe` read-only inspection for WAV/MP4/WebM containers.

No external factual claims are used; all evidence is repository-local.