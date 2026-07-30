# Abyssal Surge Test Contract Surface Map

## 1. Complete Test File Inventory

### Stage World & Layout Tests
- **stage-world-quest-points.test.mjs:11-256** — Three stages (cinder-span, abyss-chancel, echo-throne) bind one quest giver to four ordered quest surfaces; world topology identity stays frozen (npcs, obstacles, props, routes, meshColliders, bounds).
- **stage-terrain-environment-contract.test.mjs** — Validates terrain GLB asset existence, format (GLB_MAGIC = 0x46546c67), and terrain catalog completeness for all stages.
- **stage-world-encounter-routing-contract.test.mjs:24-288** — Route clearance (critical, optional-detour), waypoint placement, obstacle blocking, encounter signatures, stage profile immutability, stageWorldFor() returns null for missing stages.

### Movement & Controls Tests
- **defense-stage-world-movement.test.mjs:12,16,62-408** — Commander footprint clamping to stage bounds (minY, maxX, maxY); diagonal obstacle slide-tangent physics; flat routes with two intermediate objectives per stage; flat support triangles for terrain traversal; companion FOLLOW/RETURN leash logic; hard-leash recovery step; speed tunnel-proof; terrain digest determinism.

### Combat & Animation Tests
- **combat-presentation-contract.test.mjs** — RealtimeBattle mount/render snapshot cycle; NPC/Boss model loading (GLTFLoader); prop mesh pack caching; cinematic intro duration (>13 ticks); cutscene event routing; motion model state integrity.
- **overlay-runtime-qa.test.mjs:11-20,77** — Overlay GLB (unarmed-core.glb) canonical actions (idle, move, run, hit, bighit, attack, critical, avoid, defence); fallback-only actions (die, show); GLTF load retry semantics.

### Audio Tests
- **battle-session-cutscene-audio.test.mjs:149-788** — BattleSession cutscene deferral, same-frame critical/story audio batching, same-stage remount reset, queued dialogue pause/resume ticks, timer completion overlay removal, cutscene pause semantics.
- **audio-feedback-runtime.test.mjs** — DefenseAudio graph lifecycle (start/stop/resetRun), persistent vs transient audio nodes, event deduplication (feedbackEvents, storyNarrations, narrations, narrationQueue), WebAudio context suspend/resume, speech synthesis cancellation, soundscape state preservation.

### Run Simulation & Determinism Tests
- **defense-run-simulation.test.mjs:185-1040** — Enemy XP scaling, seeded enemy composition variety, deterministic digest equality on identical seeds/inputs, boss wait/reward settlement, elite Bind extraction FIFO, skill event target linking, event identity ordering, item pickup apply gates/maxima, run digest preservation.
- **defense-run-simulation-rpg.test.mjs** — RPG-mode run variants and state contracts.

### Reward & Progression Tests
- **elite-extraction-reducer.test.mjs:13-88** — Capture state immutability on replay, duplicate prototype rejection, payload field validation, conflicting eventId rejection, single handoff per batch, distinct elite acceptance in later batches.
- **campaign-state-rpg.test.mjs** — Campaign stage progression, idle return settlement, victory/defeat transitions.

### Asset & VFX Tests
- **runtime-visual-assets.test.mjs:40-157** — Terrain GLB exist + format, retained manifest excludes retired artwork, Cinder Span twelve frozen prop placements (x, y, elevation, yawRadians), VFX single effect per stage, NPC lookout presence.
- **defense-asset-manifest.test.mjs** — Asset catalog completeness and path invariants.

### UI & Mobile Tests
- **defense-phone-battle-hud-browser.test.cjs** — Movement button data-move="E" focus/Enter semantics.
- **progression-mobile-ui-browser.cjs** — Movement buttons locator `[data-move]`, per-direction button activation (E, W, N, S directions).
- **defense-survivor-browser.cjs** — Movement buttons focus/hover state, direction coverage.
- **lobby-guide-disclosure-browser.test.mjs** — Lobby UI state preservation through mobile docks.
- **lobby-system-window-browser.test.mjs** — System window layout and dismissal.
- **shadow-legion-hud-browser.test.mjs** — HUD element placement and state.

### Browser-Proof Tests
- **stage-runtime-proof-browser.test.mjs:473,514** — All three stages load in isolated WebGL sessions; transient terrain failures allow retry on remount; writes to `_workspace/current/qa/stage-runtime-proof/stage-runtime-summary.json`.
- **overlay-runtime-qa.test.mjs** — Overlay GLB canonical action set invariants, load failure retry logic.

### Artifact & Smoke Tests
- **pages-artifact-smoke.cjs:7-73** — Runtime file existence (all .js, .css, .json, .glb, .png, .webp, .svg, .woff2); REQUIRED_FILES array; module specifier validation.
- **release-closure.test.mjs** — Production closure file list validation.

### Story & Quest Tests
- **stage-story-progression.test.mjs:29-180** — Story stage IDs (cinder-span, abyss-chancel, echo-throne) bind to live stage-world profiles; quest givers placed; quest NPC IDs resolve.
- **stage-world-quest-points.test.mjs:179-256** — Quest giver placement, quest surface immutability, deeply frozen quest metadata.

---

## 2. Tests Sensitive to Stage Layout Changes

### Critical: Route & Obstacle Geometry
| File | Test Name | Asserted Invariant | Line |
|------|-----------|-------------------|------|
| defense-stage-world-movement.test.mjs | `commander movement clamps...` | minY, maxX, maxY bounds per stage | 62-73 |
| defense-stage-world-movement.test.mjs | `diagonal obstacle contact...` | obstacle footprint (x, y, radius) contact slide physics | 78-102 |
| defense-stage-world-movement.test.mjs | `all three stage worlds publish flat routes...` | One critical route, two intermediate objectives, optional-detour per stage | 104-125 |
| defense-stage-world-movement.test.mjs | `flat support triangles keep...` | meshColliders[0].triangles provide walkable support | 127-153 |
| defense-stage-world-movement.test.mjs | `legacy entities...elevation...` | Flat support reacquisition without time advancement | 155-177 |
| defense-stage-world-movement.test.mjs | `companions cannot follow...beyond...terrain` | Walkable terrain routes prevent out-of-bounds following | 179-212 |
| defense-stage-world-movement.test.mjs | `boundary-clipped RETURN...` | RETURN state arrival at walkable formation anchor | 214-250 |
| defense-stage-world-movement.test.mjs | `hard-leash recovery...tangent...west ash wall` | Authored return step, bounded tangent to named obstacle (cinder-span:west-ash-wall) | 252-306 |
| stage-world-encounter-routing-contract.test.mjs | `critical-route clearance rejects...` | Route waypoint placement blocked by obstacle.footprint (x, y, radius) | 290-296 |
| stage-world-quest-points.test.mjs | `all three stage worlds bind...` | Exact props, obstacles, meshColliders, routes per stage in EXPECTED_WORLD_TOPOLOGY | 179-222 |

### Expected World Topology by Stage (stage-world-quest-points.test.mjs:13-134)
**Cinder Span:**
- Props: seal-brand, forge-relic, forge-arch, collapsed-parapet-prop, west-ash-wall-prop, east-ash-wall-prop, relay-debris-north-prop, relay-debris-south-prop, ingress-beacon-prop, south-forge-teeth-prop, north-ash-talon-prop, gate-beacon-prop (12 total)
- Obstacles: drowned-forge-arch, collapsed-parapet, west-ash-wall (3 total)
- MeshColliders: walkable-support with two triangles [[600,800,0],[23400,800,0],[23400,11200,0]], [[600,800,0],[23400,11200,0],[600,11200,0]]
- Routes: critical-route (kind="critical", clearance=1200, ingress→cinder-relay-crossing→cinder-forge-stand→final-gate), optional-detour (kind="optional-detour", clearance=700, detour-entry→ash-cache→detour-exit)

**Abyss Chancel:**
- Props: oath-relic, nave-blade, oath-apse-prop, nave-seal-prop, west-colonnade-prop, east-colonnade-prop, vestry-debris-prop, apse-wing-prop, west-processional-lamp-prop, south-nave-screen-prop, east-processional-lamp-prop, vestry-screen-prop (12 total)
- Obstacles: oath-apse, nave-seal, west-colonnade, east-colonnade, vestry-debris, apse-wing (6 total)
- Routes: critical-route (clearance=1000, ingress→chancel-nave-advance→chancel-transept-lock→final-gate), optional-detour (clearance=700, detour-entry→vestry-cache→detour-exit)

**Echo Throne:**
- Props: dais-relic, aisle-blade, fractured-dais-prop, echo-aisle-prop, west-fractured-wing-prop, east-fractured-wing-prop, [+ 6 more defined in lines 93-133]
- Routes: critical-route, optional-detour with equivalent structure

### Runtime Prop Placement (Exact XY + Yaw)
runtime-visual-assets.test.mjs:100-156 hardcodes Cinder Span placements:
- cinder-span:collapsed-parapet-prop: {x:13200, y:9300, elevation:0, yawRadians:1.5708}
- cinder-span:east-ash-wall-prop: {x:20800, y:9900, elevation:0, yawRadians:1.5708}
- [+ 10 more props with exact coordinates]

---

## 3. Movement Controls & Input Tests

### Joystick/Button Directions Tested
**Movement button data-move attributes:**
- Directions: E, W, N, S (cardinal), NE, NW, SE, SW (diagonal) inferred from OCTANT_VECTORS
- Browser tests reference: `[data-move="E"]`, `[data-move="W"]`, `[data-move]` selector

**Test Files:**
- defense-phone-battle-hud-browser.test.cjs — Activates `#movement-actions [data-move="E"]` with Enter keystroke
- progression-mobile-ui-browser.cjs — Iterates `movement.locator("button[data-move]")`, activates per-direction button
- defense-survivor-browser.cjs — Focus/hover on `[data-move="E"]`, `[data-move="W"]`

### Octant Movement Assertions
defense-stage-world-movement.test.mjs:29-31, 78-102:
- `step(run, octant, ticks)` queues MOVE input with octant vector
- Diagonal (NE) motion computes naive (x + vector.x * speed/1000/TICK_RATE, y + vector.y * speed/1000/TICK_RATE)
- Obstacle contact removes inward component, slides tangent, maintains clearance ≥ radius - 1

### No Explicit Virtual Joystick Tests in Visible Suite
(Joystick implementation lives in battle-realtime-three.js; tests assume button/octant abstraction only)

---

## 4. Audio Events & Cutscene Audio Tests

### Audio Event Assertions
**battle-session-cutscene-audio.test.mjs:**
- Line 149-160: Cutscene deferral until `beginRun()` completes
- Line 257-362: Same-frame critical + story audio batching before cutscene presentation
- Line 363-463: Same-stage remount resets audio before tick-zero preview
- Line 464-547: Retains authored stage intro + story dialogue through queued live presentation
- Line 548-610: Pauses simulation across queued dialogue/narration, resumes one tick on next frame
- Line 611-670: Timer completion removes overlay and resumes without paused-time catch-up
- Line 671-737: Timer completion hands to queued narration, ignores stale dismissal
- Line 738-788: Keeps timer-completed cutscenes paused by user intent until one next-frame tick

**audio-feedback-runtime.test.mjs:**
- DefenseAudio.debugMetrics() exposes: voices, feedbackEvents, storyNarrations, narrations, narrationQueue, nodes, transientNodes
- resetRun() assertions (lines ~680-800):
  - `beforeReset.voices > 0` (transient feedback voices exist)
  - `beforeReset.feedbackEvents` = 1 (ordinary event remembered)
  - `beforeReset.storyNarrations` = 2 (both authored stories)
  - `beforeReset.narrations` = 2 (active + native-pending)
  - After reset: feedbackEvents=0, storyNarrations=0, narrations=0, narrationQueue=0
  - `context.closeCount` = 0 (audio context never closed)
  - Persistent oscillators: stopCount=0, disconnectCount=0

---

## 5. VFX Pools, Effect IDs & Prop Model Mapping

### Prop Model References
runtime-visual-assets.test.mjs:82-99:
- Each stage publishes exactly one dense prop mesh, one VFX effect, one Lantern Reaver lookout NPC
- stage-runtime-proof-browser.test.mjs:196-199 captures: `profile.presentation.props[].{id, modelPath}`, `profile.presentation.npcs[].{id, actorId, modelPath}`, `profile.presentation.vfxCues[].{id, modelPath, effectId}`

### VFX Effect IDs
stage-runtime-proof-browser.test.mjs:199 reads `vfxCues[].effectId` and validates against runtime catalog.
Expected IDs:
- cinder-span: cinder-span-ember-wake (assets/motion/stage-vfx/cinder-span-ember-wake.glb)
- abyss-chancel: abyss-chancel-mirror-static (assets/motion/stage-vfx/abyss-chancel-mirror-static.glb)
- echo-throne: echo-throne-fracture-echo (assets/motion/stage-vfx/echo-throne-fracture-echo.glb)

### Overlay Animation Actions (VFX State Machine)
overlay-runtime-qa.test.mjs:11-20:
- CANONICAL_BASE_ACTIONS: idle, move, run, hit, bighit, attack, critical, avoid, defence, die, show (11 total)
- OVERLAY_ACTIONS (runtime): idle, move, run, hit, bighit, attack, critical, avoid, defence (9 total)
- FALLBACK_ONLY_ACTIONS: die, show (2 total)
- Assertion: OVERLAY_ACTIONS + FALLBACK_ONLY_ACTIONS == CANONICAL_BASE_ACTIONS

### Model Load Assertions
combat-presentation-contract.test.mjs:1251-1255:
- `profile.presentation.props[0].modelPath` resolves via GLTFLoader
- Missing model triggers load failure; pack cached by URL for module lifetime
- Asserts: `.statusCode !== 404`, `.byteLength > 0` (GLB binary format)

---

## 6. Pickups, Rewards, Run Digest Determinism

### Elite Extraction & Reward Tests
elite-extraction-reducer.test.mjs:13-88:
- Line 13-20: Same eventId replay preserves campaign reference identity
- Line 21-30: Same elite/prototype capture preserves reference without auto-equip
- Line 31-51: New elite capture preserves schema, rejects if fields missing/invalid (line 52-59)
- Line 60-68: Replayed eventId rejects conflicting payload; same elite rejects different prototype mapping (line 69-78)
- Line 79-87: Single handoff per batch allowed; distinct elite accepted in later batch

### Run Digest Determinism
defense-run-simulation.test.mjs:265-276:
- **assertion:** Equal seeds + identical inputs → identical deterministic digests
- Uses `createDefenseRun({ seed, runId })` + `advanceDefenseRun()` reproducibility

### Item Pickup Application
defense-run-simulation.test.mjs:963-981:
- Assertion: `itemPickup()` applies both gate maximum AND current integrity atomically
- Repeated ticks post-pickup do NOT compound Abyssal Banner companion damage (line 982-1020)

### Inventory Item Buffs (Stat Delta)
defense-run-simulation.test.mjs:912-945:
- Warden's Lantern: +400 pickupRange over baseline
- Choir Ward Crystal: +300bp crit chance over baseline
- Applied once at run creation; never compound across ticks without pickups
- Bulwark Brand: Reduces gate breach damage (line 896-910)

---

## 7. Browser-Proof Tests

### stage-runtime-proof-browser.test.mjs (Lines 22-613)

**Launch Mechanism:**
- startServer() (line 67-89): HTTP server on 127.0.0.1 random port
- INSTALL_RUNTIME_PROBE (line 95-123): Injects `window.__stageRuntimeQa` probe into page via script injection
- chromium (playwright 1.52.0) creates isolated browser context per test

**Output Location:**
- `_workspace/current/qa/stage-runtime-proof/stage-runtime-summary.json` (line 24, SUMMARY_FILE)
- Relative path: `_workspace/current/qa/stage-runtime-proof/stage-runtime-summary.json`

**Pass Criteria (Test 473-512):**
- Line 473: "all three canonical stages load their authored runtime world in isolated real-WebGL sessions" (timeout: 180s)
- Verifies: campaign fully unlocked (line 48-60), stage-runtime-fixture.html loads (line 69-73)
- Assertions per stage (verifyStage, line 195-210):
  - `profile.presentation.props[].{id, modelPath}` match captured records
  - `profile.presentation.npcs[].{id, actorId, modelPath}` match captured records
  - `profile.presentation.vfxCues[].{id, modelPath, effectId}` match captured records
  - qa.patched === true (injection successful)
  - qa.frames > 0 (WebGL rendered frames)
  - No terrain load errors

**Transient Terrain Retry (Test 514-560):**
- Line 514: "disposing after a transient terrain failure lets the same stage retry on remount"
- Simulates GLTFLoader failure on first terrain load
- Verifies: resetGltfFailures() allows retry success on remount
- Timeout: 60s

### overlay-runtime-qa.test.mjs (No explicit browser launch visible)
- Loads GLB from disk (line 57-75)
- Validates canonical vs overlay action set (line 11-20)
- No explicit browser output; assertion-only on action state machine

### pages-artifact-smoke.cjs (Executable Node.js test)

**Execution:**
- `node tests/pages-artifact-smoke.cjs [--build-dir <path>]` (line 83-89)
- Default build-dir: `./` (repo root)

**Artifact Validation (Lines 6-81):**
- REQUIRED_FILES array: 73 files covering:
  - Runtime: index.html, app.js, *.js modules, *.css, *.json, sw.js, manifest.json
  - Assets: terrain GLB, props, boss models, character model, VFX, audio manifest
  - Vendor: three.module.js, three.core.js, loaders, utilities
  - Icons/Images: .png, .webp, .svg, .woff2
  
**Pass Criteria:**
- All REQUIRED_FILES exist in build-dir (existsSync check)
- Module specifiers validation: localModuleSpecifiers() regex parses `from/import "\.{1,2}\/[^"']+"`
- Validates spec-declared paths resolve (line ~90-120)

---

## 8. Exact Commands to Run Tests

### Full Suite
```bash
# Run all .mjs/.cjs tests in tests/ and qa/ directories
node --test tests/**/*.test.mjs tests/**/*.test.cjs qa/**/*.test.mjs qa/**/*.test.cjs

# Or per npm script (if defined):
npm test
```

### Single Focused File
```bash
# Example: Run only movement tests
node --test tests/defense-stage-world-movement.test.mjs

# Example: Run only cutscene audio
node --test tests/battle-session-cutscene-audio.test.mjs

# Example: Run only runtime assets
node --test tests/runtime-visual-assets.test.mjs

# Example: Browser proof test (long timeout)
node --test --timeout=180000 tests/stage-runtime-proof-browser.test.mjs

# Example: Artifact smoke test
node tests/pages-artifact-smoke.cjs

# Example: By test name pattern (if your runner supports it; Node.js test runner does not natively filter by pattern):
# Workaround: edit test file temporarily or use grep + node:
node --test tests/defense-stage-world-movement.test.mjs 2>&1 | grep "flat routes"
```

### Per-Category Runs
```bash
# Stage & layout tests
node --test tests/stage-world-quest-points.test.mjs tests/stage-terrain-environment-contract.test.mjs tests/stage-world-encounter-routing-contract.test.mjs

# Movement tests
node --test tests/defense-stage-world-movement.test.mjs

# Audio tests
node --test tests/battle-session-cutscene-audio.test.mjs tests/audio-feedback-runtime.test.mjs

# VFX & assets
node --test tests/runtime-visual-assets.test.mjs tests/defense-asset-manifest.test.mjs

# Run simulation & determinism
node --test tests/defense-run-simulation.test.mjs

# Pickups & rewards
node --test tests/elite-extraction-reducer.test.mjs

# Browser proof (longest)
node --test --timeout=180000 tests/stage-runtime-proof-browser.test.mjs tests/overlay-runtime-qa.test.mjs

# Artifact validation
node tests/pages-artifact-smoke.cjs
```

---

## Surface Map Legend

**Line Citations:**
- `file.mjs:LINE–LINE` = lines containing assertions or test setup
- `file.mjs:LINE` = single-line exact assertion location

**Stage Layout Sensitivity:**
- **Critical** = Must update if adding/removing props, obstacles, routes, or changing bounds
- **Route** = Must update if changing waypoint placement or kind (critical, optional-detour, etc.)
- **Obstacle** = Must update if changing footprint (x, y, radius) or adding/removing obstacles
- **Prop** = Must update if changing prop count, placement (x, y, elevation, yawRadians), or modelPath

**Movement Control Sensitivity:**
- **Octant** = 8 cardinal/diagonal directions (E, W, N, S, NE, NW, SE, SW)
- **Bounds** = Stage bounds clamp (minY, maxX, maxY)
- **Physics** = Obstacle contact slide-tangent logic, leash recovery step

**Audio Event Sensitivity:**
- **Event Dedup** = feedbackEvents, storyNarrations, narrations, narrationQueue counters must match exact counts
- **Cutscene** = Pause/resume tick semantics, overlay removal timing
- **Graph Lifecycle** = Node count, persistent vs transient state across resetRun()

**VFX/Asset Sensitivity:**
- **Effect ID** = Exact stage→effectId mapping (cinder-span→cinder-span-ember-wake, etc.)
- **Prop Count** = Each stage must publish 12 props (verified in runtime-visual-assets.test.mjs:86)
- **Action State** = 9 overlay actions + 2 fallback-only must sum to 11 canonical base actions
