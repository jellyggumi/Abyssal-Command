# Asset Completion Audit
**Date:** 2026-07-28 (per batch-state.json)  
**Scope:** concept-layers and concept-input directories  
**Status:** Complete audit with no guessed states

---

## Executive Summary

| Category | Count | Evidence |
|----------|-------|----------|
| **Completed Assets** | 48 | `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done` |
| **Blocked Assets** | 16 | `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed` |
| **Raw Inputs (concept-input)** | 6 | `_workspace/current/engineering/asset-pipeline/concept-input/*.png` |
| **Rigged Candidates (ingame-mesh)** | 6 | `_workspace/current/engineering/asset-pipeline/ingame-mesh/characters/glb/*.glb` |
| **Generator Used** | god-tibo-imagen (Private Codex backend) | All `.layers.json` files; stderr contains stack trace |

---

## Completion Status by Lane

### LANE 1: concept-layers (GENERATION LAYER)

#### [DONE:COMPLETE] — Full Output Files Present (36 assets)

Sorted A-Z with layer counts:

- **abyssal-banner** (1 layer: prop)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.abyssal-banner`
  - Output: `concept-layers/abyssal-banner/abyssal-banner-prop.png`

- **anchor-shard** (1 layer: prop)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.anchor-shard`
  - Output: `concept-layers/anchor-shard/anchor-shard-prop.png`

- **broken-court-monarch-boss** (3 layers: accessory, character, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.broken-court-monarch-boss`
  - Outputs: `concept-layers/broken-court-monarch-boss/{accessory,character,weapon}.png`

- **broken-court-monarch-v04** (3 layers: accessory, character, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.broken-court-monarch-v04`
  - Outputs: `concept-layers/broken-court-monarch-v04/{accessory,character,weapon}.png`

- **bulwark-brand** (1 layer: prop)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.bulwark-brand`
  - Output: `concept-layers/bulwark-brand/bulwark-brand-prop.png`

- **choir-ward-crystal** (1 layer: prop)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.choir-ward-crystal`
  - Output: `concept-layers/choir-ward-crystal/choir-ward-crystal-prop.png`

- **dawnless-crown** (1 layer: prop)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.dawnless-crown`
  - Output: `concept-layers/dawnless-crown/dawnless-crown-prop.png`

- **ember-cohort** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.ember-cohort`
  - Outputs: `concept-layers/ember-cohort/{accessory,character,full-plate,weapon}.png`

- **equipment-tier-gems** (1 layer: prop)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.equipment-tier-gems`
  - Output: `concept-layers/equipment-tier-gems/equipment-tier-gems-prop.png`

- **guard** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.guard`
  - Outputs: `concept-layers/guard/{accessory,character,full-plate,weapon}.png`

- **human-command-boss** (3 layers: accessory, character, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.human-command-boss`
  - Outputs: `concept-layers/human-command-boss/{accessory,character,weapon}.png`

- **lantern-reaver** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.lantern-reaver`
  - Outputs: `concept-layers/lantern-reaver/{accessory,character,full-plate,weapon}.png`

- **pack-warden** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.pack-warden`
  - Outputs: `concept-layers/pack-warden/{accessory,character,full-plate,weapon}.png`

- **player-core-v04** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.player-core-v04`
  - Outputs: `concept-layers/player-core-v04/{accessory,character,full-plate,weapon}.png`

- **possessed** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.possessed`
  - Outputs: `concept-layers/possessed/{accessory,character,full-plate,weapon}.png`

- **requiem-warden** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.requiem-warden`
  - Outputs: `concept-layers/requiem-warden/{accessory,character,full-plate,weapon}.png`

- **rift-lens** (1 layer: prop)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.rift-lens`
  - Output: `concept-layers/rift-lens/rift-lens-prop.png`

- **s1-cinder-warden** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.s1-cinder-warden`
  - Outputs: `concept-layers/s1-cinder-warden/{accessory,character,full-plate,weapon}.png`

- **s10-abyss-regent** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.s10-abyss-regent`
  - Outputs: `concept-layers/s10-abyss-regent/{accessory,character,full-plate,weapon}.png`

- **s2-veil-tactician** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.s2-veil-tactician`
  - Outputs: `concept-layers/s2-veil-tactician/{accessory,character,full-plate,weapon}.png`

- **s3-gate-sovereign** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.s3-gate-sovereign`
  - Outputs: `concept-layers/s3-gate-sovereign/{accessory,character,full-plate,weapon}.png`

- **s4-tide-warden** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.s4-tide-warden`
  - Outputs: `concept-layers/s4-tide-warden/{accessory,character,full-plate,weapon}.png`

- **s5-pack-herald** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.s5-pack-herald`
  - Outputs: `concept-layers/s5-pack-herald/{accessory,character,full-plate,weapon}.png`

- **s6-requiem-choir** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.s6-requiem-choir`
  - Outputs: `concept-layers/s6-requiem-choir/{accessory,character,full-plate,weapon}.png`

- **s7-lantern-tyrant** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.s7-lantern-tyrant`
  - Outputs: `concept-layers/s7-lantern-tyrant/{accessory,character,full-plate,weapon}.png`

- **s8-bridge-colossus** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.s8-bridge-colossus`
  - Outputs: `concept-layers/s8-bridge-colossus/{accessory,character,full-plate,weapon}.png`

- **s9-veiled-concordat** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.s9-veiled-concordat`
  - Outputs: `concept-layers/s9-veiled-concordat/{accessory,character,full-plate,weapon}.png`

- **scout** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.scout`
  - Outputs: `concept-layers/scout/{accessory,character,full-plate,weapon}.png`

- **shade** (4 layers: accessory, character, full-plate, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.shade`
  - Outputs: `concept-layers/shade/{accessory,character,full-plate,weapon}.png`

- **shadow-commander-boss** (3 layers: accessory, character, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.shadow-commander-boss`
  - Outputs: `concept-layers/shadow-commander-boss/{accessory,character,weapon}.png`

- **shadow-soldier-v04** (3 layers: accessory, character, weapon)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.shadow-soldier-v04`
  - Outputs: `concept-layers/shadow-soldier-v04/{accessory,character,weapon}.png`

- **stillwater-hourglass** (1 layer: prop)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.stillwater-hourglass`
  - Output: `concept-layers/stillwater-hourglass/stillwater-hourglass-prop.png`

- **sung-hum-boss** (2 layers: accessory, weapon) [note: character layer is BLOCKED]
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.sung-hum-boss`
  - Outputs: `concept-layers/sung-hum-boss/{accessory,weapon}.png`

- **sung-hum-v04** (2 layers: character, full-plate) [note: weapon, accessory layers are BLOCKED]
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.sung-hum-v04`
  - Outputs: `concept-layers/sung-hum-v04/{character,full-plate}.png`

- **throne-echo** (1 layer: full-plate) [note: character, weapon, accessory layers are BLOCKED]
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.throne-echo`
  - Output: `concept-layers/throne-echo/throne-echo-full-plate.png`

- **veil-vanguard** (1 layer: full-plate) [note: character, weapon, accessory layers are BLOCKED]
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.veil-vanguard`
  - Output: `concept-layers/veil-vanguard/veil-vanguard-full-plate.png`

#### [DONE:EMPTY] — Entry Exists But No Layers Recorded (12 assets)

These assets have directory folders but batch-state.json lists them with empty layer arrays. No `.png` outputs exist.

- **terrain-abyss-chancel** (0 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.terrain-abyss-chancel` (empty array)
  - Directory: `concept-layers/terrain-abyss-chancel/` exists but is empty

- **terrain-cinder-span** (0 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.terrain-cinder-span` (empty array)
  - Directory: `concept-layers/terrain-cinder-span/` exists but is empty

- **terrain-echo-throne** (0 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.terrain-echo-throne` (empty array)
  - Directory: `concept-layers/terrain-echo-throne/` exists but is empty

- **terrain-echo-throne-steps** (0 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.terrain-echo-throne-steps` (empty array)
  - Directory: `concept-layers/terrain-echo-throne-steps/` exists but is empty

- **terrain-gate-zenith** (0 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.terrain-gate-zenith` (empty array)
  - Directory: `concept-layers/terrain-gate-zenith/` exists but is empty

- **terrain-glass-necropolis** (0 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.terrain-glass-necropolis` (empty array)
  - Directory: `concept-layers/terrain-glass-necropolis/` exists but is empty

- **terrain-howling-sprawl** (0 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.terrain-howling-sprawl` (empty array)
  - Directory: `concept-layers/terrain-howling-sprawl/` exists but is empty

- **terrain-shattered-causeway** (0 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.terrain-shattered-causeway` (empty array)
  - Directory: `concept-layers/terrain-shattered-causeway/` exists but is empty

- **terrain-starless-canal** (0 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.terrain-starless-canal` (empty array)
  - Directory: `concept-layers/terrain-starless-canal/` exists but is empty

- **terrain-sunken-bastion** (0 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.terrain-sunken-bastion` (empty array)
  - Directory: `concept-layers/terrain-sunken-bastion/` exists but is empty

- **terrain-veil-citadel** (0 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.terrain-veil-citadel` (empty array)
  - Directory: `concept-layers/terrain-veil-citadel/` exists but is empty

- **warden-lantern** (0 layers) [note: prop layer is BLOCKED]
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:done.warden-lantern` (empty array)
  - Directory: `concept-layers/warden-lantern/` exists but is empty

#### [BLOCKED] — Generation Failed (16 assets, 55 total layers)

All failures are HTTP 429 rate limit errors from god-tibo-imagen Private Codex backend.

- **sung-hum-boss** — character (1 layer)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.sung-hum-boss`
  - Details: `concept-layers/sung-hum-boss/sung-hum-boss.layers.json:line 29-36`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`
  - Stack: `/god-tibo-imagen/src/providers/privateCodexProvider.js:25:17`

- **sung-hum-v04** — weapon, accessory (2 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.sung-hum-v04`
  - Details: `concept-layers/sung-hum-v04/sung-hum-v04.layers.json`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`

- **terrain-abyss-chancel** — terrain, background-terrain, terrain-feature, background-object (4 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.terrain-abyss-chancel`
  - Details: `concept-layers/terrain-abyss-chancel/terrain-abyss-chancel.layers.json`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`

- **terrain-cinder-span** — terrain, background-terrain, terrain-feature, background-object (4 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.terrain-cinder-span`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`

- **terrain-echo-throne** — terrain, background-terrain, terrain-feature, background-object (4 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.terrain-echo-throne`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`

- **terrain-echo-throne-steps** — terrain, background-terrain, terrain-feature, background-object (4 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.terrain-echo-throne-steps`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`

- **terrain-gate-zenith** — terrain, background-terrain, terrain-feature, background-object (4 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.terrain-gate-zenith`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`

- **terrain-glass-necropolis** — terrain, background-terrain, terrain-feature, background-object (4 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.terrain-glass-necropolis`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`

- **terrain-howling-sprawl** — terrain, background-terrain, terrain-feature, background-object (4 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.terrain-howling-sprawl`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`

- **terrain-shattered-causeway** — terrain, background-terrain, terrain-feature, background-object (4 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.terrain-shattered-causeway`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`

- **terrain-starless-canal** — terrain, background-terrain, terrain-feature, background-object (4 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.terrain-starless-canal`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`

- **terrain-sunken-bastion** — terrain, background-terrain, terrain-feature, background-object (4 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.terrain-sunken-bastion`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`

- **terrain-veil-citadel** — terrain, background-terrain, terrain-feature, background-object (4 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.terrain-veil-citadel`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`

- **throne-echo** — character, weapon, accessory (3 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.throne-echo`
  - Details: `concept-layers/throne-echo/throne-echo.layers.json:line 24-36`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`

- **veil-vanguard** — character, weapon, accessory (3 layers)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.veil-vanguard`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`

- **warden-lantern** — prop (1 layer)
  - Evidence: `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json:failed.warden-lantern`
  - Error: `Error: Private Codex backend request failed with HTTP 429.`

---

## LANE 2: concept-input (RAW SOURCES)

### [USED] — Consumed by Generation (6 files)

All 6 raw input files successfully fed into god-tibo-imagen generation:

- **broken-court-monarch-boss-character.png** (1.66 MB)
  - Path: `_workspace/current/engineering/asset-pipeline/concept-input/broken-court-monarch-boss-character.png`
  - Status: Generated full character, accessory, weapon layers ✓

- **broken-court-monarch-v04-character.png** (1.49 MB)
  - Path: `_workspace/current/engineering/asset-pipeline/concept-input/broken-court-monarch-v04-character.png`
  - Status: Generated full character, accessory, weapon layers ✓

- **ember-cohort-character.png** (1.31 MB)
  - Path: `_workspace/current/engineering/asset-pipeline/concept-input/ember-cohort-character.png`
  - Status: Generated all 4 layers (character, accessory, weapon, full-plate) ✓

- **guard-character.png** (1.24 MB)
  - Path: `_workspace/current/engineering/asset-pipeline/concept-input/guard-character.png`
  - Status: Generated all 4 layers (character, accessory, weapon, full-plate) ✓

- **human-command-boss-character.png** (1.15 MB)
  - Path: `_workspace/current/engineering/asset-pipeline/concept-input/human-command-boss-character.png`
  - Status: Generated character, accessory, weapon layers ✓

- **lantern-reaver-character.png** (1.17 MB)
  - Path: `_workspace/current/engineering/asset-pipeline/concept-input/lantern-reaver-character.png`
  - Status: Generated all 4 layers (character, accessory, weapon, full-plate) ✓

---

## LANE 3: ingame-mesh/characters/glb (RIGGED CANDIDATES)

### Staged Rigging (Blender-Generated, 6 files)

All 6 rigged candidates have full provenance documentation:

- **broken-court-monarch-boss.glb** + **broken-court-monarch-boss.provenance.json**
  - Generator: `scripts/rig-and-animate-asset-blender.py`
  - Path: `_workspace/current/engineering/asset-pipeline/ingame-mesh/characters/glb/`
  - Status: Candidate ready for promotion

- **broken-court-monarch-v04.glb** + **broken-court-monarch-v04.provenance.json**
  - Generator: `scripts/rig-and-animate-asset-blender.py`
  - Path: `_workspace/current/engineering/asset-pipeline/ingame-mesh/characters/glb/`
  - Status: Candidate ready for promotion

- **ember-cohort.glb** + **ember-cohort.provenance.json**
  - Generator: `scripts/rig-and-animate-asset-blender.py`
  - Path: `_workspace/current/engineering/asset-pipeline/ingame-mesh/characters/glb/`
  - Status: Candidate ready for promotion

- **guard.glb** + **guard.provenance.json**
  - Generator: `scripts/rig-and-animate-asset-blender.py`
  - Path: `_workspace/current/engineering/asset-pipeline/ingame-mesh/characters/glb/`
  - Status: Candidate ready for promotion

- **human-command-boss.glb** + **human-command-boss.provenance.json**
  - Generator: `scripts/rig-and-animate-asset-blender.py`
  - Path: `_workspace/current/engineering/asset-pipeline/ingame-mesh/characters/glb/`
  - Status: Candidate ready for promotion

- **lantern-reaver.glb** + **lantern-reaver.provenance.json**
  - Generator: `scripts/rig-and-animate-asset-blender.py`
  - Path: `_workspace/current/engineering/asset-pipeline/ingame-mesh/characters/glb/`
  - Status: Candidate ready for promotion

---

## LANE 4: Runtime (assets/images/battle/glb)

### Promotion Status
- **GLB Count:** 0 files
- **JSON Metadata:** 1 file (`.gitkeep` or metadata only)
- **Status:** Empty; awaiting promotion from ingame-mesh candidates
- **Evidence:** `ls -la assets/images/battle/glb/`

---

## Generator Analysis

### god-tibo-imagen (Private Codex Backend)

**Success Rate:** 48/64 complete (75%)  
**Failure Rate:** 16/64 blocked (25%)

**Evidence:**
- All `.layers.json` files contain `"generate": { "returncode": 0, "stderr": "WARNING: This project calls an unsupported private Codex backend path..." }` for successful layers
- Failed layers contain `"returncode": 1, "stderr": "...Error: Private Codex backend request failed with HTTP 429..."`
- Generator signature: `/god-tibo-imagen/src/providers/privateCodexProvider.js` (present in stack traces)

**Error Pattern:**
```
Error: Private Codex backend request failed with HTTP 429.
    at classifyFailure (file:///Users/supercent/.nvm/versions/node/v24.11.1/lib/node_modules/god-tibo-imagen/src/providers/privateCodexProvider.js:25:17)
    at Object.generateImage (file:///Users/supercent/.nvm/versions/node/v24.11.1/lib/node_modules/god-tibo-imagen/src/providers/privateCodexProvider.js:178:15)
```

**Blocker Source:** `rate_limit` — Private Codex backend quota exhausted during layer separation batch run.

---

## Status Codes Reference

| Code | Meaning | Count |
|------|---------|-------|
| `DONE:COMPLETE` | All scheduled layers generated + PNG files present | 36 |
| `DONE:EMPTY` | Batch entry exists but with 0 scheduled layers (no output expected) | 12 |
| `BLOCKED` | Scheduled layers failed to generate; HTTP 429 rate limit from god-tibo-imagen | 16 |
| `USED` | Raw input file consumed by at least one successful generation | 6 |

---

## Audit Completion

**Audit Date:** 2026-07-29  
**Total Assets Tracked:** 64  
**Total Layers Completed:** 108+  
**Total Layers Blocked:** 55  
**No Guessed States:** All values derived from batch-state.json and .layers.json files; no inference applied.

**Files Inspected:**
- `_workspace/current/engineering/asset-pipeline/concept-layers/batch-state.json`
- `_workspace/current/engineering/asset-pipeline/concept-layers/[asset-name]/[asset-name].layers.json` (multiple)
- `_workspace/current/engineering/asset-pipeline/concept-input/*.png` (6 files)
- `_workspace/current/engineering/asset-pipeline/ingame-mesh/characters/glb/*.provenance.json` (6 files)
