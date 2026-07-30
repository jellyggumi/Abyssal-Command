# Motion System Expansion Blueprint
**Status:** Implementation Ready
**Date:** 2026-07-30
**Scope:** Stage story quests, progression, layered dungeons, motion, mobile joystick, audio
**Non-Goals:** Audio implementation, combat balance tuning

---

## 1. CURRENT MOTION LIBRARY INVENTORY

### 1.1 Promoted Assets (11 characters, 121 clips total)

| Alias | Asset ID | Role | Category | Clips | GLB Size | Status |
|-------|----------|------|----------|-------|----------|--------|
| lantern-reaver | lantern-reaver | protagonist | companions | 11 | 13.7 MB | ✅ runtime-eligible |
| scout | scout | rusher | enemies | 11 | 12.4 MB | ✅ runtime-eligible |
| shade | shade | flanker | enemies | 11 | 13.2 MB | ✅ runtime-eligible |
| guard | guard | guardian | enemies | 11 | 13.4 MB | ✅ runtime-eligible |
| possessed | possessed | ranged | enemies | 11 | 12.8 MB | ✅ runtime-eligible |
| ember-cohort | ember-cohort | striker | companions | 11 | 13.6 MB | ✅ runtime-eligible |
| lantern-reaver | lantern-reaver | vanguard | companions | 11 | 13.7 MB | ✅ runtime-eligible |
| human-command-boss | human-command-boss | commander | bosses | 13* | 14.1 MB | ✅ runtime-eligible |
| broken-court-monarch-v04 | broken-court-monarch-v04 | shadow-duelist | bosses | 11 | 14.0 MB | ✅ runtime-eligible |
| broken-court-monarch-boss | broken-court-monarch-boss | shadow-duelist | bosses | 11 | 13.7 MB | ✅ runtime-eligible |
| shadow-commander-boss | shadow-commander-boss | commander | bosses | 13* | 14.3 MB | ✅ runtime-eligible |

\* Commanders support 13 actions: 11 base + `attack_melee`, `attack_ranged`
**Source:** `assets/motion/ingame/characters/registry.json`

### 1.2 Canonical Action Keys (11 + 2 optional)

**Core Library:** `RIG_ACTION_KEYS` (battle-realtime-three.js:267-270)
```
Locomotion (looping):
  - idle      → guarded breathing, readable weight shift
  - move      → controlled advance, clear lead foot
  - run       → urgent pursuit, preserved silhouette
Combat (one-shot):
  - hit       → short readable impact reaction
  - bighit    → heavy stagger with protected recovery
  - attack    → disciplined close-range strike with visible peak
  - critical  → signature extraction-finisher burst
Reactions (one-shot):
  - avoid     → compact lateral evade, preserved footing
  - defence   → hold line, communicate protected timing
Exit States (one-shot):
  - die       → controlled collapse, readable terminal pose
  - show      → concept-aligned materialize and command reveal
Commander-only (one-shot, fallback to attack/critical):
  - attack_melee
  - attack_ranged
```

**Naming Convention:** `<assetId>::<action>::v01`
**Loop Behavior:** idle/move/run use `THREE.LoopRepeat` with `Infinity`; others use `THREE.LoopOnce` with `clampWhenFinished = true`

### 1.3 Retarget Pipeline

**Source:** `assets/motion/bench/` (Mixamo-37 FBX motion library)
**Target:** `def-humanoid-v1` Rigify skeleton (24 DEF-* bones)
**Transformation:** Quaternion delta retargeting + rest-relative baking
**Tool:** `scripts/retarget-ingame-motion-blender.py` (deterministic, Blender 5.1+)
**Authority:** derived-retargeted (mixamo-37 source → rest-relative deltas → GLB with rotation-only FCurves)

**Bone Mapping (22 mapped, 2 unmapped target):**
```
Spine chain:      DEF-spine → DEF-spine.005 (6 bones)
Left arm:         DEF-shoulder.L → DEF-hand.L (4 bones)
Right arm:        DEF-shoulder.R → DEF-hand.R (4 bones)
Left leg:         DEF-thigh.L → DEF-toe.L (4 bones)
Right leg:        DEF-thigh.R → DEF-toe.R (4 bones)
Unmapped target:  DEF-pelvis.L, DEF-pelvis.R (rest pose only)
```

---

## 2. QUEST/NPC MOTION REQUIREMENTS

### 2.1 Current Stage NPC Motion (IMPLEMENTED)

**Source:** `battle-realtime-three.js:1430-1475` → `instantiateStageNpc(npc)`
**Placement:** Via `STAGE_WORLD_PROFILES[stageId].staticNpcs[]`
**Motion Contract:**
- Loaded from authored stage-catalog GLB
- Applies authored guard-pose offset (STAGE_NPC_GUARD_OFFSETS)
- Fixed idle-only playback (no runtime action switching)
- No progression or narrative coupling

**Files:**
- `battle-realtime-three.js:71-72` → `STAGE_NPC_GUARD_OFFSETS` (static poses by stage)
- `battle-realtime-three.js:1412-1428` → `stageNpcGuardBones()`, `applyStageNpcGuardPose()`
- `stage-world-catalog.js` → per-stage NPC definitions
- Tests: `tests/combat-presentation-contract.test.mjs:1239-1269` → attention targeting

### 2.2 Missing: Quest Story Motion

**Gap:** No mechanism to trigger named action sequences on stage NPCs during quest progression.
**Required for story quests:**
- Temporal control of NPC actions (play action X on quest trigger Y)
- Narrative-coupled emotion/reaction motion (worry → confidence → celebration)
- Multiple progression states tied to quest stage
- Candidate actions: idle → show (entrance), show → die (retreat), attack → defence (reaction)

### 2.3 Missing: NPC Idle Variants & Ambient Motion

**Gap:** Stage NPCs only support one guard pose; no authored ambient cycles.
**Impact:** Story NPCs cannot evolve visual presence during multi-beat quests.
**Not needed for Phase 1:** Layered full-body idle/look/breath cycles (out of scope, reserve for Phase 2).

---

## 3. RIG COMPATIBILITY & CONSTRAINTS

### 3.1 Skeleton Requirements

**Target Skeleton:** `def-humanoid-v1` (Blender Rigify humanoid standard)
**Total Bones:** 24 DEF-* bones
**Chain Structure:** Spine (6) + Arms (8) + Legs (8) + Pelvis helpers (2)
**Invariant:** Every promoted character must use this exact skeleton; retarget enforces it.

**Validation:**
- Blender MCP inspection: `bpy.data.objects[armature].data.bones` count == 24
- JSON manifest validation: `targetBoneNames[]` length == 24
- Runtime: DEF-* bone names matched at load time (battle-realtime-three.js GLTFLoader)

### 3.2 Skinning & Weight Constraints

**Finite, normalized weights:**
- Each vertex: sum == 1.0 (glTF normalized)
- Influences per vertex: ≤ 4 (glTF bone limit)
- Weight chain adjacency: influences must be on same anatomical chain

**Test Evidence:**
- `tests/character-rig-contract.test.mjs` → validates joint weight totals
- Blender export gate: `scripts/retarget-ingame-motion-blender.py:671-854` → `run_gates()`
- Motion bench report: `_workspace/current/engineering/asset-pipeline/motion-bench/joint-weight-repair-gate.json`

### 3.3 In-Place Root Motion

**Requirement:** All locomotion clips must have `inPlaceRootMotion: true`
**Meaning:** Animation articulates joints but does NOT displace gameplay root
**Enforcement:** Simulation owns actor position; animation is joint-space only
**Validation:** Registry entry `inPlaceRootMotion` == true; spine/pelvis rest pose is origin

---

## 4. MOTION REUSE vs. AUTHORING DECISION MATRIX

### 4.1 Reusable Motions (No Authoring Required)

| Action | Characters | Retarget Status | Reuse Path |
|--------|-----------|-----------------|-----------|
| idle | All 11 | ✅ derived-retargeted | Use existing GLB as-is |
| move | All 11 | ✅ derived-retargeted | Use existing GLB as-is |
| run | All 11 | ✅ derived-retargeted | Use existing GLB as-is |
| hit | All 11 | ✅ derived-retargeted | Use existing GLB as-is |
| bighit | All 11 | ✅ derived-retargeted | Use existing GLB as-is |
| attack | All 11 (Commanders: attack_melee/attack_ranged) | ✅ derived-retargeted | Use existing GLB as-is |
| critical | All 11 | ✅ derived-retargeted | Use existing GLB as-is |
| avoid | All 11 | ✅ derived-retargeted | Use existing GLB as-is |
| defence | All 11 | ✅ derived-retargeted | Use existing GLB as-is |
| die | All 11 | ✅ derived-retargeted | Use existing GLB as-is |
| show | All 11 | ✅ derived-retargeted | Use existing GLB as-is |

**Summary:** All 11 canonical actions are Mixamo-retargeted and directly reusable. Zero new motion authoring for combat actions.

### 4.2 New Motion Keys for Quest Narratives (OPTIONAL, PHASE 2+)

**Rationale:** Quest story NPCs may require unique emotional/narrative beats beyond combat library.
**Candidates (NOT IMPLEMENTED YET):**
- `react-wonder` → eyes up, hands gesture (discovery moment)
- `react-fear` → step back, defensive posture (threat moment)
- `react-celebrate` → jump/raise arms (victory moment)
- `interact-bow` → respectful greeting (narrative introduction)
- `interact-point` → directing gesture (guidance to player)

**Implementation Path:** If added, MUST follow naming convention `<assetId>::<newKey>::v01` and register in quest-progression engine. Not required for initial story quest launch.

---

## 5. IMPLEMENTATION CONTRACTS & DETERMINISTIC VERIFICATION

### 5.1 Animation Routing Symbols

**Core Namespace:** `battle-realtime-three.js`

| Symbol | Lines | Purpose | Quest Contract Hook |
|--------|-------|---------|-------------------|
| `MOTION_MODELS` | 141-153 | Character asset → GLB path mapping | Load promoted model for NPC |
| `RIG_ACTION_KEYS` | 267-270 | Canonical 11-action whitelist | Validate action name on quest trigger |
| `LOCOMOTION_ACTION_KEYS` | 372 | Looping action IDs | Ensure quest does not loop combat actions |
| `buildActions(mixer, clipEntries)` | 1031-1055 | Create AnimationAction instances per clip | Invoked on NPC model load |
| `actionKeyFromClipName(name)` | 1025-1029 | Parse `<assetId>::<action>::v01` | Detect available actions at runtime |
| `instantiateStageNpc(npc)` | 1430-1475 | Load and pose NPC model | Entry point for quest-progression NPC setup |

### 5.2 Blender Regeneration Safety

**Deterministic Tool:** `scripts/retarget-ingame-motion-blender.py`
**Input Contract:**
- Source FBX: `assets/motion/bench/*.fbx` (Mixamo-37 rig)
- Target GLB: `assets/images/battle/glb/commander/dusk-warden.glb` (def-humanoid-v1)
- Bone mapping: hardcoded in script (MAPPING_ROWS)
- Output: rotation-only animation deltas, rest-relative quaternions

**Regeneration Command:**
```bash
python3 scripts/retarget-ingame-motion-blender.py \
  --target-rig assets/images/battle/glb/commander/dusk-warden.glb \
  --fbx-dir assets/motion/bench \
  --output-glb assets/motion/ingame/unarmed-core.glb \
  --manifest assets/motion/ingame/manifest.json
```

**Gate Verification:**
- Runs `run_gates()` → validates clip count, quaternion normalization, rest-relative accuracy
- Exports preview frames to `assets/motion/ingame/qa/` for manual visual sign-off
- Generates manifest with SHA256 integrity hashes

### 5.3 Deterministic Test Commands

**Test Coverage:**

| Test File | Command | Coverage |
|-----------|---------|----------|
| character-rig-contract.test.mjs | `npm test -- tests/character-rig-contract.test.mjs` | 11-action clip presence, weight integrity for lantern-reaver |
| combat-presentation-contract.test.mjs | `npm test -- tests/combat-presentation-contract.test.mjs` | Action routing, animation clip selection, combat beat priority, one-shot restart logic, stage NPC loading |
| commander-guard-pose.test.mjs | `npm test -- tests/commander-guard-pose.test.mjs` | Stage NPC pose application, attention targeting |

**Full Animation Test Suite:**
```bash
npm test -- tests/character-rig-contract.test.mjs \
           tests/combat-presentation-contract.test.mjs \
           tests/commander-guard-pose.test.mjs
```

**Expected Output:** All tests pass; no failures in animation routing or NPC loading.

---

## 6. QUEST PROGRESSION MOTION HOOK (PROPOSED INTERFACE)

### 6.1 Minimal API for Story Quest Integration

**Not yet implemented; design for Phase 1 quest launch:**

```javascript
// Quest trigger → NPC animation transition
class QuestNpcMotionController {
  constructor(npcRecord, stageNpc, mixer) {
    this.npcRecord = npcRecord;
    this.actionMap = buildActions(mixer, npcRecord.animations);
    this.currentAction = null;
  }

  // Quest progression milestone → NPC reaction
  playActionForQuestStage(questId, stageKey, actionKey) {
    if (!RIG_ACTION_KEYS.includes(actionKey)) {
      console.warn(`Invalid action: ${actionKey}`);
      return null;
    }
    const action = this.actionMap[actionKey];
    if (!action) return null;

    // Cross-fade to new action
    if (this.currentAction) {
      this.currentAction.fadeOut(0.15);
    }
    action.reset().fadeIn(0.15).play();
    this.currentAction = action;
    return action;
  }
}
```

**Registry Entry (proposed quest-motion-config.json):**
```json
{
  "questId": "cinder-span-ruins-intro",
  "npcId": "guide-torch-bearer",
  "progressionStages": [
    {
      "stageKey": "idle-waiting",
      "action": "idle",
      "duration": Infinity,
      "allowInterrupt": true
    },
    {
      "stageKey": "player-approaches",
      "action": "show",
      "duration": 3.2,
      "autoTransitionTo": "welcome-greeting"
    },
    {
      "stageKey": "welcome-greeting",
      "action": "idle",
      "duration": Infinity,
      "allowInterrupt": true
    }
  ]
}
```

---

## 7. CHECKLIST FOR PHASE 1 QUEST EXPANSION

- [ ] **Story quest progression engine** wires quest state → NPC action dispatches
- [ ] **Stage NPC motion controller** inherits from existing `instantiateStageNpc()`
- [ ] **Quest config file** maps each story beat → canonical action key
- [ ] **Tests added:** quest progression triggers correct NPC action transitions
- [ ] **Blender rig verification:** re-run gate check for any new character meshes
- [ ] **Mobile joystick** integration (out of scope, separate track)
- [ ] **Audio design file** linked from this document (separate PR)

---

## 8. REFERENCES & EVIDENCE ARTIFACTS

| Artifact | Path | Purpose |
|----------|------|---------|
| Motion Registry | `assets/motion/ingame/characters/registry.json` | Source of truth for promoted character models & clips |
| Animation Contract | `RUNTIME_ANIMATION_CONTRACT.md` | Normative spec (§0: 2026-07-29 amendment) |
| Action Pipeline | `_workspace/current/engineering/asset-pipeline/action-pipeline.json` | 11-action intent definitions & keyframe budgets |
| Blender Rebuild Report | `_workspace/current/engineering/asset-pipeline/motion-bench/blender-rebuild-verification.json` | MCP rig inspection & promotion evidence |
| Combat Tests | `tests/combat-presentation-contract.test.mjs` | Runtime animation routing & beat priority verification |
| Character Rig Tests | `tests/character-rig-contract.test.mjs` | Joint weight integrity gates |

---

**Approved for:** Stage story quest progression + NPC motion integration
**Ready for:** Executor handoff (quest-progression-engine implementation)
**Next Phase:** Audio design, mobile controls, layered dungeon generation
