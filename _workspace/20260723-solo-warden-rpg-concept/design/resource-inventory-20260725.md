# Visual/3D/Animation Resource Inventory — Abyssal Surge

**Date:** 2026-07-25
**Scope:** Full catalog of visual, 3D, and animation resources in the repo usable for the core-loop/UI redesign, cross-referenced against what `battle-realtime-three.js` actually loads.
**Method:** Direct filesystem enumeration (`find`/`ls -la`), source grep of `battle-realtime-three.js`/`defense-catalog.js`/`rpg-catalog.js`/`tests/release-closure.test.mjs`, and Blender 5.1.2 headless inspection (`--background --python`) of a 13-file cross-category GLB sample. All counts below are directly observed, not estimated.

---

## 1. `assets/images/battle/` — Full Catalog

### 1.1 GLB models — `assets/images/battle/glb/`

| Category | Dir | Count | Total size | Notes |
|---|---|---:|---:|---|
| Bosses | `glb/bosses/` | 10 | 14.05 MB | `s1`–`s10` cinder-warden campaign roster |
| Companions | `glb/companions/` | 9 | 10.22 MB | matches all 9 `COMPANIONS` catalog ids |
| Enemies | `glb/enemies/` | 4 | 4.29 MB | matches all 4 `ENEMIES` archetypes |
| Commander | `glb/commander/` | 1 | 0.60 MB | player character (Dusk Warden) |
| Terrain | `glb/terrain/` | 10 | 0.33 MB | matches all 10 `STAGES` |
| VFX | `glb/vfx/` | 6 | 0.24 MB | one-shot event effects |
| Props | `glb/props/` | 5 | 0.13 MB | reward/modifier items |
| Equipment tiers | `glb/props/tiers/` | 5 | 0.02 MB | T1–T5 gem models |
| Previs (pre-production, unwired) | `glb/previs/` | 1 | 22.55 MB | see §5 — orphaned |
| **Total GLB files** | | **51** | **~52.4 MB** | |

**Filenames by category:**

- **`glb/bosses/`** (10): `abyss-regent.glb` (1.74MB), `bridge-colossus.glb` (1.78MB), `cinder-warden.glb` (1.66MB), `gate-sovereign.glb` (959KB), `lantern-tyrant.glb` (936KB), `pack-herald.glb` (1.75MB), `requiem-choir.glb` (1.73MB), `tide-warden.glb` (765KB), `veil-tactician.glb` (1.85MB), `veiled-concordat.glb` (968KB). Naming = the *boss identity name*, not the `s1`…`s10` stage-slot id; the stage-slot mapping lives in `BOSS_MODELS` (see §5).
- **`glb/companions/`** (9): `anchor-shard.glb` (1.06MB), `dawnless-crown.glb` (1.13MB), `ember-cohort.glb` (1.10MB), `lantern-reaver.glb` (1.13MB), `pack-warden.glb` (1.15MB), `requiem-warden.glb` (1.21MB), `rift-lens.glb` (1.09MB), `throne-echo.glb` (1.23MB), `veil-vanguard.glb` (1.14MB). Filenames equal `COMPANIONS` catalog ids in `defense-catalog.js` exactly (1:1, case-sensitive).
- **`glb/enemies/`** (4): `guard.glb` (1.03MB), `possessed.glb` (1.12MB), `scout.glb` (1.10MB), `shade.glb` (1.05MB). Filenames do **not** match `ENEMIES` catalog ids (`rusher`/`flanker`/`guardian`/`ranged`) — they are archetype-flavor names mapped indirectly through `ENEMY_MODELS` (see §5).
- **`glb/commander/`** (1): `dusk-warden.glb` (611KB) — the single player-character model, notably lower-poly than boss/companion/enemy models (2,165 verts vs. 10k–27k; see §3).
- **`glb/terrain/`** (10): `abyss-chancel.glb` (47KB), `cinder-span.glb` (35KB), `echo-throne-steps.glb` (11KB), `gate-zenith.glb` (76KB), `glass-necropolis.glb` (13KB), `howling-sprawl.glb` (19KB), `shattered-causeway.glb` (37KB), `starless-canal.glb` (36KB), `sunken-bastion.glb` (43KB), `veil-citadel.glb` (24KB). Filenames match `STAGES` ids exactly except `echo-throne` (catalog id) → `echo-throne-steps.glb` (file), which is handled by an explicit non-matching key in `TERRAIN_MODELS`.
- **`glb/vfx/`** (6): `boss-rally-aura.glb` (52KB), `companion-downed-fade.glb` (4KB), `critical-hit-burst.glb` (28KB), `echo-warden-awakening.glb` (86KB), `gate-breach-shockwave.glb` (36KB), `wardens-ward-shield.glb` (37KB). One file per `VFX_MODELS` event-type key.
- **`glb/props/`** (5, + 5 in `tiers/`): `abyssal-banner.glb` (20KB), `bulwark-brand.glb` (35KB), `choir-ward-crystal.glb` (6KB), `stillwater-hourglass.glb` (30KB), `warden-lantern.glb` (44KB) — 1:1 with `PROP_MODELS`. `props/tiers/`: `tier-t1.glb` (9KB), `tier-t2.glb` (2KB), `tier-t3.glb` (3KB), `tier-t4.glb` (2KB), `tier-t5.glb` (3KB) — 1:1 with `EQUIPMENT_TIER_MODELS`/`rpg-catalog.js` `EQUIPMENT_TIERS`.
- **`glb/previs/`** (1): `anchor-shard.previs.glb` (22.55MB) — a pre-production preview export, **not** part of any lookup table. See §5.

Build-metadata sidecars (not visual assets, listed for completeness): `glb/.parts/*.json` (15 JSON part-manifests, ≤15.5KB each) and an empty `glb/.staging/` dir — these are intermediate build bookkeeping from the character-generation pipeline, not renderable resources.

### 1.2 2D sprite/atlas PNGs — `assets/images/battle/` (top level)

Two actor sprite sets, each with 4 asset "stages" (atlas variants → cleaned frames → final runtime frames), 21 files total (11.97 MB), plus `animation-manifest.json` (1.4 KB):

| Actor | Runtime frames (wired) | Non-runtime intermediates (unwired, kept for provenance/rollback) |
|---|---|---|
| **dusk-warden** (commander, 2D fallback) | `dusk-warden-frame-00.png`…`03.png` (264–344 KB each) | `dusk-warden-atlas.png` (1.6MB), `dusk-warden-atlas-white.png` (1.5MB, the `sourceAtlas` referenced by `animation-manifest.json`), `dusk-warden-atlas-rgba.png` (252KB), `dusk-warden-atlas-rgba-tight.png` (1.0MB), `dusk-warden-clean-00..03.png` (276–360 KB each) |
| **echo-rusher** (2D fallback for `rusher`/scout enemy) | `echo-rusher-frame-00.png`…`03.png` (228–252 KB each) | `echo-rusher-atlas.png` (1.8MB), `echo-rusher-atlas-white.png` (1.4MB), `echo-rusher-atlas-rgba.png` (256KB), `echo-rusher-atlas-rgba-tight.png` (892KB) |

**Naming pattern:** `{actor}-atlas*.png` = full 8-direction/multi-clip sheet exports from the Blender bake pipeline (§3 confirms 11-clip rigs); `{actor}-clean-NN.png` = post-matte-removal intermediate; `{actor}-frame-NN.png` = final 4-frame (idle/walk/strike/cast or idle/advance/strike/defeat) cycle actually loaded by `sw.js`, `defense-runtime-assets.mjs`, and the 4 test files (`defense-soak-browser.cjs`, `pages-artifact-smoke.cjs`, `release-closure.test.mjs`). `echo-rusher` is a **legacy Canvas2D-era codename**, not present anywhere in `defense-catalog.js`; per `_workspace/20260722-defense-survival-expansion/design/media-pipeline.md` and `_workspace/.../shared-reference-bundle.md` it is the earlier-cycle enemy-faction sprite corresponding to what the current catalog calls the `rusher`/`scout` archetype. It remains wired and functional as the 2D sprite fallback path (`battle-realtime-three.js` `sprite()` circa L493–507) — it is **not** orphaned, just a pre-3D-pipeline naming holdover. `assets/defense-asset-manifest.json` marks `animation-manifest.json` and all 8 atlas/clean intermediates as `"disposition": "delete"` (safe-to-remove once the 3D path is confirmed final) while all 8 `*-frame-NN.png` files are `"disposition": "retain"` + `"runtimeReference": true`.

### 1.3 World textures — `assets/images/battle/world/`

3 files, 0.36 MB: `cinder-span-tactical-paper-plate.webp` (221KB), `cinder-span-topdown-plate.webp` (154KB) — both wired via `WORLD_TEXTURES` in `battle-visualizer.js` L22–25, both `"disposition": "retain"` in the asset manifest, both in every deploy/test closure list. Third file `concept-sung-hum-boss.provenance.json` (1KB) is a **misplaced provenance sidecar** for a pilot concept PNG that actually lives in `pilot/` — flagged in `image-prompt-index.json` line 20 as a known cross-workstream artifact, left in place intentionally, not a runtime asset.

### 1.4 Pilot concept art — `assets/images/battle/pilot/`

125 files, 131.2 MB total. 62 PNGs + 62 matching `.provenance.json` sidecars + 1 `blocked-verification.json` (a stale early-pipeline exploration log for a rejected `ppgen` provider attempt, superseded by the working `gti`-based pipeline). **Every PNG here is explicitly marked non-runtime**: sidecars carry `"status": "concept-pilot-not-runtime"`, `"runtimeEligible": false`, `"purpose": "rodin-image-to-3d-source"` — i.e., these are 2D concept-art inputs meant to feed an image-to-3D generation step (Rodin), not direct game assets.

The 62 PNGs split into two groups:

**(a) Concept art matching the CURRENT catalog** (39 files) — directly corresponds to entities present in `defense-catalog.js`/`rpg-catalog.js` and already has a shipped GLB counterpart:
- Bosses (10): `concept-s1-cinder-warden.png` … `concept-s10-abyss-regent.png`
- Companions (9): `concept-anchor-shard.png`, `concept-dawnless-crown.png`, `concept-ember-cohort.png`, `concept-lantern-reaver.png`, `concept-pack-warden.png`, `concept-requiem-warden.png`, `concept-rift-lens.png`, `concept-throne-echo.png`, `concept-veil-vanguard.png`
- Enemies (4): `concept-guard.png`, `concept-possessed.png`, `concept-scout.png`, `concept-shade.png`
- Terrain (10): `concept-terrain-abyss-chancel.png`, `concept-terrain-cinder-span.png`, `concept-terrain-echo-throne.png`, `concept-terrain-echo-throne-steps.png` (duplicate concept for same stage), `concept-terrain-gate-zenith.png`, `concept-terrain-glass-necropolis.png`, `concept-terrain-howling-sprawl.png`, `concept-terrain-shattered-causeway.png`, `concept-terrain-starless-canal.png`, `concept-terrain-sunken-bastion.png`, `concept-terrain-veil-citadel.png`
- Props (5) + equipment gems (1): `concept-abyssal-banner.png`, `concept-bulwark-brand.png`, `concept-choir-ward-crystal.png`, `concept-stillwater-hourglass.png`, `concept-warden-lantern.png`, `concept-equipment-tier-gems.png`

**(b) Orphaned early-cycle boss concepts** (20 files) — a pre-catalog boss cast (`broken-court-monarch`, `human-command-boss`, `shadow-commander-boss`, `sung-hum`, `shadow-soldier`, `player-core`) that does **not** appear anywhere in `defense-catalog.js`, `rpg-catalog.js`, or `battle-realtime-three.js`. These names *do* appear as `requiredCharacterIds` in `_workspace/20260723-solo-warden-rpg-concept/production/storyboard-motion-sound-matrix.json` (the cinematic-cutscene pipeline, distinct from the live in-game roster — see §3/§4): `concept-broken-court-monarch-boss.png`, `concept-broken-court-monarch-v01..v04.png` (5), `concept-human-command-boss.png`, `concept-player-core-v01..v04.png` (4), `concept-shadow-commander-boss.png`, `concept-shadow-soldier-v01..v04.png` (4), `concept-sung-hum-boss.png`, `concept-sung-hum-v01..v04.png` (5).

**(c) Standalone commander explorations** (2 files, referenced only within this workspace's own design docs, not runtime): `dusk-warden-idle-gti.png`, `dusk-warden-idle-gti-refstyle.png`.

---

## 2. Audio assets

### 2.1 Live-runtime audio — `assets/audio/`

**`defense-audio-manifest.json` only — zero audio media files.** The live runtime (`defense-audio.js`, 501 lines) is **fully procedural**: `"mode": "offline-procedural"`, `"externalAssets": []`, `"api": "Web Audio oscillator and gain nodes only"`. All SFX/ambience/music cues are synthesized at runtime via oscillator/gain nodes with a strict node budget (64 total, 48 transient), not sourced from files. There is no gap here to fill from existing files — this is a deliberate zero-asset architecture.

### 2.2 Generated narration/BGM/SFX pipeline — `_workspace/20260723-solo-warden-rpg-concept/assets/audio/elevenlabs/`

**121 audio files total** (49 MB), entirely **orphaned from live game code** — confirmed via grep across `index.html`, `app.js`, `sw.js`, `battle-realtime-three.js`, `defense-audio.js`, `defense-cutscene.js`: zero references to `elevenlabs`, `_workspace...assets/audio`, or any of these filenames.

| Subdir | Count | Size | Purpose |
|---|---:|---:|---|
| (root, muxed) | 15 | (included below) | `part_{stage01..10, intro, lobby, ending_common, ending_branch_a, ending_branch_b}_muxed.wav` — pre-mixed narration+music+SFX combined tracks, one per cutscene "part" |
| `narration/` | 17 | 1.5 MB | Per-cut voice narration (`narr_intro_01.mp3`, `narr_stage01_entry.mp3` … `narr_boss01_show.mp3` … `narr_ending_a/b.mp3`) |
| `bgm/` | 17 | 3.2 MB | Stage/lobby/ending background music tracks |
| `ambience/` | 10 | 1.9 MB | Per-stage ambient loops (`bg_stage01_entry.mp3` … `bg_stage10_entry.mp3`) |
| `sfx/` | 40 | 960 KB | General + boss-specific + player-action SFX (e.g. `sfx_boss_broken_court_monarch_attack.mp3`, `sfx_player_hit.mp3`) |
| `combat/` | 6 | 1.1 MB | Combat-specific stingers (`sfx_boss_impact_burst.mp3`, `sfx_ward_rise.mp3`, `sfx_defence_break.mp3`) |
| `skill/` | 7 | 212 KB | Player skill-action voice/SFX cues (`skill.player.attack.mp3`, `.defence.mp3`, `.critical.mp3`, etc. — matches the 7 non-idle `requiredActions`) |
| `state/` | 7 | 488 KB | Player state cues (`state.player.safe/critical/lowhp/skill_cd/defence_ready/die/move.mp3`) |
| `npc/` | 2 | 168 KB | Lobby NPC dialogue (`npcHaram_lobby_opening.mp3`, `npcMeri_lobby_timing.mp3`) |

Purpose per `production/storyboard-motion-sound-matrix.json` and `production/video-audio-delivery-index.md`: this is a **complete narrative cutscene audio pipeline** (Stage 1–10 story arc, "나 혼자만 레벨업" defense-RPG narrative), verified `readyCount: 106 / requiredCount: 106` in `production/audio-resource-fulfillment.json`, content-verified via Whisper transcription per the delivery doc. It targets 5 non-catalog character ids (`sung-hum`, `human-command`, `shadow-commander`, `broken-court-monarch`, `npc`) that match the orphaned pilot concept art in §1.4(b) — i.e., this audio and that concept art belong to the **same abandoned/parked early-cycle cast**, not the live `s1`-`s10` roster. Usable for the redesign only if that cutscene arc/cast is reactivated; not directly usable for the current in-game entity roster without re-recording under current names.

### 2.3 Video — `assets/video/` (live) vs. `_workspace/.../assets/video/` (generated)

**Live/wired (1 file):** `assets/video/abyssal-surge-defense-survivor-smoke.mp4` — a 32.20s H.264/AAC gameplay demo video, referenced in `README.md`, `.github/workflows/static.yml` (deploy allowlist), and `tests/release-closure.test.mjs` (`GAMEPLAY_VIDEO` constant). This is wired and current.

**Orphaned in workspace (61 files, 80 MB):** `_workspace/20260723-solo-warden-rpg-concept/assets/video/`:
- Base cut: `part_intro.mp4`, `part_lobby.mp4`, `part_stage01..10.mp4`, `part_ending_common/branch_a/branch_b.mp4`, plus 3 concatenated masters (`defense_stage1to10_story_01.mp4`, `_cutonly.mp4`, `_endingB.mp4`) and their `_dtsfix` remuxed variants.
- `styles/anime-soft/` (21 files, 40 MB) and `styles/noir-cut/` (21 files, 41 MB): full alternate visual-style re-renders of the same cut sequence.
- `styles/webtoon-static/`: directory exists but is **empty** (only `.DS_Store`) — a planned third style variant never rendered.

Same status as the audio pipeline: zero references anywhere in live game code (`index.html`, `app.js`, `sw.js`, or any renderer file). Per `production/video-audio-delivery-index.md`, this is a finished Stage 1–10 narrative cutscene sequence (intro → lobby → 10 stages → branching ending), timecode-synced (`production/stage1to10-timecode-sync.json`) and duration-verified, but not yet integrated into the actual game runtime — it exists purely as workspace production output.

---

## 3. Blender headless animation-capability inspection

**Method:** `/Applications/Blender.app/Contents/MacOS/Blender --background --python <script>` importing each GLB via `bpy.ops.import_scene.gltf`, then reading `bpy.data.actions`, `bpy.data.objects` (mesh/armature), and computed world-space bounding box. Ran against 13 files spanning all 8 categories (exceeds the required minimum of 5). Blender 5.1.2's action data model changed to layered actions (`action.layers[].strips[].channelbags[].fcurves`), which the inspection script accounts for.

| File | Category | Mesh objs | Vertices | Polygons | BBox (X×Y×Z) | Armature bones | Animation clips |
|---|---|---:|---:|---:|---|---:|---:|
| `cinder-warden.glb` | boss | 3 | 23,573 | 37,256 | 1.90×2.00×2.88 | 35 | **11** |
| `abyss-regent.glb` | boss | 3 | 26,964 | 39,525 | 1.90×2.00×2.86 | 36 | **11** |
| `ember-cohort.glb` | companion | 3 | 11,287 | 15,520 | 1.90×2.00×2.66 | 35 | **11** |
| `anchor-shard.glb` | companion | 3 | 11,223 | 15,688 | 1.90×2.00×2.89 | 35 | **11** |
| `scout.glb` | enemy | 3 | 11,160 | 15,344 | 1.90×2.00×2.15 | 35 | **11** |
| `guard.glb` | enemy | 3 | 10,296 | 15,814 | 1.90×2.00×2.60 | 35 | **11** |
| `dusk-warden.glb` | commander | 3 | 2,165 | 1,114 | 1.90×2.00×2.98 | 36 | **11** |
| `cinder-span.glb` | terrain | 8 | 840 | 356 | 5.20×2.70×0.65 | 0 | **0** |
| `gate-zenith.glb` | terrain | 8 | 2,064 | 1,008 | 2.30×2.30×2.18 | 0 | **0** |
| `critical-hit-burst.glb` | vfx | 9 | 624 | 256 | 0.72×0.72×0.16 | 0 | **0** |
| `warden-lantern.glb` | prop | 4 | 1,152 | 552 | 0.26×0.22×0.46 | 0 | **0** |
| `tier-t3.glb` | equipment tier | 2 | 32 | 12 | 0.26×0.26×0.32 | 0 | **0** |
| `anchor-shard.previs.glb` | previs (orphaned) | 1 | 550,426 | 500,000 | 1.50×1.38×1.90 | 0 | 1 (object-transform only, 7 fcurves) |

**Findings:**

1. **All character models (bosses, companions, enemies, commander) share an identical animation architecture**: a 35–36 bone armature and exactly **11 baked action clips** per character — `idle`, `move`, `run`, `hit`, `bighit`, `attack`, `critical`, `avoid`, `defence`, `die`, `show` (verified via full action-name list on `dusk-warden.glb` and `cinder-warden.glb`). This matches `storyboard-motion-sound-matrix.json`'s `global.requiredActions` exactly (11 entries), confirming a single unified rigging/animation pipeline across the whole character roster. **These are fully riggable/animatable** — real skeletal animation, not static meshes.
2. **Character mesh density varies ~13x** (2,165–26,964 verts) despite identical rig topology — `dusk-warden.glb` (commander) is a notable outlier at only 2,165 verts / 1,114 polys vs. 10k–27k for bosses/companions/enemies, worth flagging if visual parity with the roster matters for the redesign.
3. **Terrain, VFX, and props/equipment-tier models are entirely static** — 0 armatures, 0 action clips across every sampled file in these 4 categories. They are meshes/props only, not animated.
4. **`anchor-shard.previs.glb` (the one orphaned GLB, §1.1 and §5) is categorically different**: 550,426 vertices / 500,000 polygons (23-1000x denser than any wired asset), no armature, a single low-fidelity object-transform animation (7 fcurves, not skeletal). This is a raw high-poly previs/scan export, not game-ready — consistent with its "previs" naming and its absence from every lookup table.

---

## 4. Additional generated content in `_workspace/20260723-solo-warden-rpg-concept/assets/`

Confirmed via full recursive listing: **no images, GLBs, or other visual formats exist under this workspace's `assets/` beyond what's covered in §2** (audio + video). `find … -not -iname "*.mp3" -not -iname "*.wav" -not -iname "*.mp4" -not -iname "*.json" -not -iname ".DS_Store"` returns zero results. The one JSON artifact present, `assets/video/vox-part-playlist.json`, is a playback-order manifest for the video parts, not a visual asset itself.

Beyond `assets/`, this workspace also contains (not requested visual assets but noted for completeness, per §1.4 cross-reference): `pipeline/tpose/concepts/ember-cohort-tpose-concept.png` and `ember-cohort-tpose-single.png` (T-pose reference concepts for the rigging pipeline), `qa/evidence/world-art-audit.png` (a QA screenshot, not source art), and `models-out/anchor-shard.glb` (a single pipeline-output GLB, separate from and not verified identical to the shipped `assets/images/battle/glb/companions/anchor-shard.glb`). The `pipeline/{bosses,companions,enemies}/{raw,retopo}/` dirs hold 37 intermediate-stage GLBs (10 boss `raw`, 1 boss `retopo`, 9 companion `raw`, 9 companion `retopo`, 4 enemy `raw`, 4 enemy `retopo`) — these are pre-rig production intermediates (no `rig/` subdirectory has any files), not additional finished assets beyond what's already shipped to `assets/images/battle/glb/`.

---

## 5. Wired vs. Orphaned — cross-reference against `battle-realtime-three.js`

All 7 lookup tables read directly from `battle-realtime-three.js` (lines 54–195):

| Table | Keys | Entries | Disk files matched | Orphaned |
|---|---:|---:|---:|---:|
| `TERRAIN_MODELS` (L54–65) | stage id → `terrain/*.glb` | 10 | 10/10 | 0 |
| `BOSS_MODELS` (L70–81) | `sN-*` boss id → `bosses/*.glb` | 10 | 10/10 | 0 |
| `ENEMY_MODELS` (L87–92) | archetype (`rusher`/`flanker`/`guardian`/`ranged`) → `enemies/*.glb` | 4 | 4/4 | 0 |
| `COMPANION_MODELS` (L95–105) | companion id → `companions/*.glb` | 9 | 9/9 | 0 |
| `COMMANDER_MODEL` (L107) | fixed | 1 | 1/1 | 0 |
| `VFX_MODELS` (L155–162) | event type → `vfx/*.glb` | 6 | 6/6 | 0 |
| `PROP_MODELS` (L173–178) | reward id → `props/*.glb` | 5 | 5/5 | 0 |
| `EQUIPMENT_TIER_MODELS` (L189–195) | tier id → `props/tiers/*.glb` | 5 | 5/5 | 0 |
| **Total wired** | | **50** | **50/50** | **0** |

Cross-checked independently against `tests/release-closure.test.mjs`'s `BATTLE_GLB_ASSETS` constant (the release-closure allowlist) — identical 50-file list, byte-for-byte match with the 7 lookup tables above.

**Disk inventory:** 51 total `.glb` files under `assets/images/battle/glb/` (§1.1). **50 are wired; exactly 1 is orphaned:**

| Orphaned file | Size | Why unwired |
|---|---:|---|
| `assets/images/battle/glb/previs/anchor-shard.previs.glb` | 22.55 MB | Pre-production previs export (§3: 550k verts, no armature, object-level animation only) — never added to any lookup table, structurally unsuited for real-time use as-is (23–1000x the polycount of the shipped `companions/anchor-shard.glb`). Not deploy-listed, not test-closure-listed. |

This confirms the current model closure is fully consistent: **every GLB actually used by the renderer exists on disk, and the disk has exactly one leftover pre-production artifact beyond that**, not a large pool of unused resources. (This matches a documented finding in `_workspace/.../production/decision-log.md` D19–D20: an earlier session found 39/40 GLB mappings were dangling — that gap has since been closed as of commit `b502598`, per the current clean `git status` and the 50/50 match confirmed here.)

**2D sprite assets are separately wired** (not part of the GLB tables): `dusk-warden-frame-00..03.png` and `echo-rusher-frame-00..03.png` are the only runtime-referenced sprite files (§1.2); all atlas/clean intermediates (16 files) are unwired but intentionally retained for rollback (kill-switch documented in `UNIFIED-GDD.md` and `lane-render-arch.md`: swap `animation-manifest.json`'s `sourceAtlas` path to revert instantly with zero code change).

**Everything else identified as available-but-unused for the redesign:**
- 1 orphaned previs GLB (22.55 MB, high-poly, not game-ready without retopo/rig work) — §5 above.
- 12 unwired 2D sprite intermediates (atlas/clean variants, ~9 MB) — §1.2, kept for rollback only.
- 20 orphaned early-cycle boss concept PNGs (§1.4b) — 2D concept art for an abandoned/parked alternate cast (broken-court-monarch, human-command, shadow-commander, sung-hum, shadow-soldier, player-core), all marked `runtimeEligible: false`, meant as Rodin image-to-3D source material, never converted to GLB.
- 106 generated narration/BGM/SFX audio files (49 MB) + 61 generated cutscene video files (80 MB) in `_workspace/20260723-solo-warden-rpg-concept/assets/` — a complete, QA-verified Stage 1–10 narrative cutscene package, zero live-code references (§2.2–2.3). Directly reusable only if the associated 5-character cutscene cast is brought into the live roster; the `skill/`+`state/` subsets (14 files) use player-action naming that could map onto the current single-commander roster with re-association work.
- 37 pre-rig pipeline intermediate GLBs (`_workspace/.../pipeline/{bosses,companions,enemies}/{raw,retopo}/`) — production-stage artifacts already superseded by the finished, rigged, wired GLBs in `assets/images/battle/glb/`.

---

## 6. Summary counts

| Bucket | Files | Size | Wired to live game? |
|---|---:|---:|---|
| GLB models (wired) | 50 | ~29.9 MB | Yes — 100% cross-referenced match |
| GLB previs (orphaned) | 1 | 22.55 MB | No |
| 2D sprite runtime frames | 8 | ~2.3 MB | Yes |
| 2D sprite intermediates (rollback-only) | 12 | ~9.7 MB | No (intentional retention) |
| World textures | 2 | 0.36 MB | Yes |
| Pilot concept art matching current roster | 39 PNG + 39 sidecars | included in 131.2 MB pilot total | No (Rodin source material, not runtime) |
| Pilot concept art, orphaned early-cycle cast | 20 PNG + 20 sidecars | included in 131.2 MB pilot total | No |
| Live gameplay demo video | 1 | ~unmeasured (small) | Yes |
| Workspace narration/BGM/SFX audio | 121 | 49 MB | No |
| Workspace cutscene video (all styles) | 61 | 80 MB | No |
| Pipeline pre-rig intermediates | 37 GLB | not measured (superseded) | No |

**Bottom line for the redesign:** the live 3D pipeline is essentially fully wired (50/51 GLBs, 0 truly "available but forgotten" character/terrain/prop assets beyond the 1 previs file). The larger reservoir of unused material is the **cinematic package** (200+ files, ~130 MB combined audio+video) built for a Stage 1–10 narrative arc with a different 5-character cast than the live roster — high-value if the redesign wants a story/cutscene layer, but requires either recasting to the current roster or reactivating the parked alternate-cast concept art, since none of it currently speaks to the live `defense-catalog.js`/`rpg-catalog.js` entities.
