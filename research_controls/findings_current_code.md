# Current-code controls audit: `battle-realtime-three.js`, `battle-visualizer.js`, `stage-navigation.js`

Scope: read-only audit of WASD/Shift/pointer, drag/select/order, camera, minimap, state authority, and stage-navigation behavior. Semantic search was run first, followed by narrow line reads/greps. No source files were changed; no formatters, linters, or project-wide tests were run.

## Evidence map

| Area | 3D realtime renderer | Canvas fallback visualizer | Shared navigation / adjacent authority |
|---|---|---|---|
| Keyboard | `battle-realtime-three.js:35-36, 1803-1814, 1443-1499` | `battle-visualizer.js:372-397, 1914-1958` | — |
| Pointer / drag / select | `battle-realtime-three.js:1861-2037` | `battle-visualizer.js:1076-1292` | — |
| Orders / pathing | `battle-realtime-three.js:2059-2179` | `battle-visualizer.js:1293-1348, 1914-1939` | — |
| Camera / focus | `battle-realtime-three.js:1734-1786, 2757-2760` | `battle-visualizer.js:428-464, 1380-1389` | — |
| Minimap snapshot | `battle-realtime-three.js:2762-2826` | `battle-visualizer.js:1391-1467` | Minimap viewport contract: `tactical-minimap.js:496-508`; wiring: `app.js:859-920` |
| State authority | `battle-realtime-three.js:2201-2231, 2456-2486` | `battle-visualizer.js:1528-1555, 1730-1736` | Stage transition: `campaign-state.js:1113-1148` |
| Stage navigation | Renderer construction: `battle-realtime-three.js:334-406`; visualizer construction: `battle-visualizer.js:155-229` | Shared data API: `stage-navigation.js:1-55, 107-168, 368-532` | Stage selector is disabled: `app.js:2445-2463` |

## 1. `battle-realtime-three.js` — implemented behavior

### Keyboard movement and Shift surge

**FACT:** The module declares WASD plus arrow movement codes and left/right Shift surge codes (`battle-realtime-three.js:35-36`). Its key handler only accepts input while the canvas is the active element, stores pressed codes, and prevents default movement-key behavior (`1803-1810`). `hasSurge()` checks either Shift code (`1812-1814`).

**FACT:** `moveCommander()` maps W/Up to negative Z, S/Down to positive Z, A/Left to negative X, and D/Right to positive X (`1443-1450`). Any keyboard direction cancels a clicked commander path/order (`1453-1457`). With no keyboard direction, the clicked path/order continues waypoint-by-waypoint (`1459-1487`). Base movement speed is `7.2` while Shift is held and `4.1` otherwise, then terrain gimmick and mobility multipliers apply (`1490-1499`).

**FACT:** Shift feedback is a brighter/more frequent accent-color footstep trail (`1548-1559`).

### Pointer modes, drag-select, and orders

**FACT:** Pointer-down focuses the canvas and chooses modes: placement, orbit for touch/middle/Alt-primary, right-click, or default select (`1861-1888`). Pointer capture is established (`1888`). Default select starts a marquee rectangle (`1890-1900`).

**FACT:** Pointer movement marks a gesture as moved after a 12 px touch or 6 px non-touch threshold; orbit adjusts azimuth/elevation (`1903-1928`), while select updates marquee coordinates and selection (`1929-1934`).

**FACT:** On select-pointer release, a short tap first invokes a semantic action if present, then selects the hit ally, otherwise clears selection and calls `pick(event, "personal")` (`1978-1999`). Right-click release calls `pick(event, "allies")` (`2001-2004`). Touch tap in orbit mode selects an ally or issues an ally/personal pick (`2005-2024`).

**FACT:** The renderer owns a local `selection: Set` and emits aggregate selection summaries through `onSelectionChange`; the summary reports count/health/possessed/engaged/moving/order (`battle-realtime-three.js:1164-1221`).

**FACT:** `pick(..., "allies")` computes a temporary `plannedOrders` array, A* paths for each selected ally, and then writes each ally's `customPath`, `customOrder`, and `customOrderReached` (`2059-2132`). A successful ally order emits particles/audio and updates the rally point (`2111-2141`). A personal ground pick focuses the tactical cell, emits `onTacticalRequest({type: "focus"})`, computes a path, and writes `commanderPath`/`commanderOrder` (`2142-2177`). Failed paths emit hostile particles/audio (`2100-2108, 2152-2161`).

**FACT:** The current order representation is one active path/order per commander or ally. A new commander path replaces `commanderPath`; a new ally order overwrites `customPath`/`customOrder` (`2129-2131, 2164-2169`). The temporary `plannedOrders` array is planning work, not a persistent command queue (`2075-2097`).

### Camera and feedback

**FACT:** Initial camera state is orbit azimuth `-0.9`, elevation `0.55`, zoom `18` (`battle-realtime-three.js:407-421`). Drag orbit adjusts azimuth/elevation (`1923-1928`); focused cells steer the camera look target (`1734-1743`), which is smoothed unless reduced motion is active (`1758-1762`) and clamped to navigation bounds (`1764-1773`). Wheel zoom is active only when the canvas is focused and clamps zoom to 9–30 (`2053-2057`).

**FACT:** Pointer ground orders provide focus highlight and tactical callback (`2146-2150`), plus order particles and tones (`2171-2177`). Selection rings/marquee/focus are rendered locally; `focusTacticalCell()` stores the cell and updates the highlight (`2757-2760`).

### State authority boundary

**FACT:** `applyCampaignState()` receives campaign/stage/encounter/state, reconciles authoritative legion, possessed status, boss health, skills, encounter, and deployments (`2201-2231`). Runtime publication is a compact encounter summary through `onRuntimeState` (`2456-2477`).

**FACT:** The source explicitly says action feedback is renderer-local and that campaign state has already accepted the action; the renderer does not establish/remove units, encounters, rewards, damage, or player orders (`2484-2486`).

**FACT:** Tactical callbacks emitted by pointer ground interaction are `focus` and `deploy` (`1960-1962, 2149-2150`); ally/commander movement orders are written directly to renderer-local objects in `pick()` (`2129-2140, 2164-2169`).

**[INFERENCE]** If movement orders must survive renderer teardown/recreation, replay, or authoritative campaign reload, this file currently has no order persistence callback/state field. If orders are intentionally presentation-local, the contract should be documented and surfaced in runtime state so UI/replay cannot imply persistence.

## 2. `battle-visualizer.js` — implemented behavior

### Keyboard movement and Shift gap

**FACT:** `init()` makes the canvas focusable and registers keydown/keyup/blur handlers (`battle-visualizer.js:372-397`). The handlers recognize W/A/S/D and arrow codes only (`378-390`); there is no Shift code handling in the handler.

**FACT:** `moveCommander()` maps W/Up, S/Down, A/Left, D/Right and follows a clicked path only when no key is pressed (`1914-1939`). Speed is `commander.speed` times terrain/mobility multipliers (`1941-1949`).

**FACT:** A search for `Shift`, `hasSurge`, or `surge` in `battle-visualizer.js` found no control implementation (only unrelated `Array.shift()` path operations at `1930`, `2101`, and `2152`).

**GAP:** The fallback renderer does not implement the 3D renderer's Shift surge or surge-specific feedback. This makes WASD behavior non-parity across renderer modes.

### Pointer, drag-select, and formation orders

**FACT:** `attachPointerHandlers()` handles right-click directly: prevent default, pick a tile, and when selection is non-empty issue a formation move, set a 1.2-second order flag, and play a spatial tone (`1076-1092`).

**FACT:** Primary/middle/Alt pointer-down establishes capture and either begins panning or action focus (`1094-1116`). Touch drags pan; mouse/pen drags build `dragRect` after 6 px (12 px touch) (`1118-1158`).

**FACT:** On drag release the visualizer clears selection and selects every ally whose projected point is inside the rectangle (`1161-1187`). There is no additive-selection modifier branch in this path (`1175-1187`).

**FACT:** Short primary taps handle placement, semantic actions, ally selection, touch formation movement, or personal commander focus/pathing (`1188-1238`). Ground commander taps call `onTacticalRequest({type: "focus"})` and write a path into `commander.path` (`1226-1235`).

**FACT:** `issueFormationMove()` performs an 8-neighbor BFS around the target to assign separate walkable target cells, computes one path per selected ally, and writes `ally.path`; it emits the new selection summary (`1293-1348`). A subsequent order overwrites the prior `ally.path`; there is no persistent order queue.

### Camera and feedback

**FACT:** The fallback uses a fixed 2D dimetric view. `computeView()` fits the whole navigation grid, or when `focusCell` exists sets scale to `defaultScale * 2` and centers that cell (`428-460`). `focusTacticalCell()` stores/clears focus, recomputes view/static layer, and renders (`1380-1389`).

**FACT:** Pointer handling has panning but no wheel listener/zoom implementation in `attachPointerHandlers()` (`1076-1292`); zoom changes only as a side effect of tactical-cell focus (`450-455`).

**[INFERENCE]** A user cannot freely zoom the fallback view with the wheel/pinch under this class's current pointer contract, unlike the realtime renderer's focused wheel zoom (`battle-realtime-three.js:2053-2057`).

### State authority boundary

**FACT:** `applyCampaignState()` reconciles authoritative legion/possessed state, node count, encounters, and deployment list (`battle-visualizer.js:1528-1555`). The source explicitly says deployment reconciliation is authoritative-only and the renderer mirrors `campaign.stage.deployments` (`1551-1555`). Runtime publication is a deduplicated encounter summary (`1730-1736`).

**FACT:** Local selection, paths, order flags, focus, and action FX are not included in the runtime summary shown at `1730-1736`; tactical snapshots expose selection count/focus/viewport but not pending order paths (`1421-1467`).

**[INFERENCE]** The fallback has the same persistence ambiguity as the 3D renderer: movement orders are local renderer state and are not reconciled from campaign state.

## 3. Minimap and camera-to-minimap contract

**FACT:** Both renderers expose tactical snapshots containing navigation, units, deployments, focus, selection count, and viewport (`battle-realtime-three.js:2762-2826`; `battle-visualizer.js:1421-1467`).

**FACT:** Both viewport objects currently provide `{x, z, zoom}` only (`battle-realtime-three.js:2825`; `battle-visualizer.js:1466`).

**FACT:** `TacticalMinimap` documents/uses viewport `{x, z, width, depth}` and defaults missing width/depth to 8/4 when drawing the viewport box (`tactical-minimap.js:496-508`). `app.js` forwards renderer snapshots unchanged through `normalizeMinimapSnapshot()`/`syncMinimap()` (`app.js:859-920`).

**GAP:** The minimap viewport rectangle cannot represent the actual camera footprint from these renderer snapshots; it falls back to a fixed 8×4 world-space box. `zoom` is present but not consumed by the minimap viewport contract (`tactical-minimap.js:498-503`).

**FACT:** Minimap focus callbacks call `visualizer.focusTacticalCell(cell)` (`app.js:886-892`), which recenters/zooms the fallback (`battle-visualizer.js:1380-1389`) and steers the realtime camera on its next update (`battle-realtime-three.js:1739-1762, 2757-2760`).

## 4. `stage-navigation.js` — behavior and navigation gaps

### Implemented shared navigation

**FACT:** The module defines a 24×12 grid, fixed lanes, expected node counts, and ten stage metadata records (`stage-navigation.js:1-38`). Stage numbers are normalized/clamped to 1–10 (`53-55`).

**FACT:** `compile()` builds authored lane routes, terrain elevations, deployment frontages, reconnect columns, frozen cells/routes, hostile spawns, anchors, and gimmick zones (`107-168`).

**FACT:** `createStageNavigation(stageNumber)` returns an immutable per-stage object with bounds, cells, anchors, routes, zones, height/elevation/walkability/climb checks, grid/world transforms, pathfinding, route paths, anchor lookup, gimmicks, and deployment validation (`373-532`). Deployment validation rejects out-of-bounds/unwalkable, occupied, protected anchor/base, or path-sealing barricades (`415-494`).

### Stage-navigation limitations

**FACT:** The module exports stage geometry/navigation construction and validation (`368-532`); it does not expose a next/previous stage transition, unlock/selection operation, or campaign-state mutation API.

**[INFERENCE]** Stage progression authority lives outside this module. The renderer constructors bind a stage once (`battle-realtime-three.js:334-406`; `battle-visualizer.js:155-229`), and their `applyCampaignState()` methods reconcile state but do not replace `stageNumber` or rebuild `navigation` (`battle-realtime-three.js:2201-2231`; `battle-visualizer.js:1528-1555`). A live renderer cannot be switched to another stage through a documented method; the app must recreate it or a future stage-switch API must be added.

**FACT (adjacent authority check):** Campaign reward selection advances `stageId`, `stageIndex`, status, and stage state (`campaign-state.js:1120-1145`). The stage selector UI currently disables every stage button (`app.js:2445-2455`), so there is no direct stage-navigation selection affordance in the current app flow.

**[INFERENCE]** Because `normalizeStageNumber()` silently clamps invalid numbers (`stage-navigation.js:53-55`), callers that pass an invalid stage do not receive an explicit navigation error; this may hide stale/miswired stage identifiers.

## 5. Minimal candidate changes and acceptance checks

These are audit recommendations only; no code was changed.

1. **Shift parity in fallback:** Add a Shift-held state to `BattleVisualizer`'s key handlers (`battle-visualizer.js:378-394`) and apply a surge multiplier/feedback in `moveCommander()` (`1914-1958`), matching the realtime semantic contract. **Acceptance:** a focused fallback canvas receives Shift+W; movement speed and visible/audio feedback change only while Shift is held; blur/keyup clears it; existing WASD tests remain valid.

2. **Explicit order semantics/persistence:** Define whether orders replace or queue. If queueing is required, add an order-queue field and enqueue/consume at `RealtimeBattle.pick()` (`2059-2179`) and `BattleVisualizer.issueFormationMove()`/commander tap (`1226-1235, 1293-1348`). If persistence is required, emit accepted order intents through `onTacticalRequest` and reconcile them from campaign state alongside deployments (`2201-2231`, `1528-1555`). **Acceptance:** repeated clicks have deterministic documented behavior; renderer teardown/re-init either preserves accepted orders or explicitly proves orders are renderer-local; snapshots/UI show pending-order state if exposed.

3. **Minimap viewport accuracy:** Extend both `getTacticalSnapshot()` viewport payloads (`battle-realtime-three.js:2825`; `battle-visualizer.js:1466`) with world-space `width`/`depth` derived from the actual camera/view, or change the minimap contract to consume zoom/frustum. **Acceptance:** viewport box width/depth changes with realtime wheel zoom and fallback focus/scale; box remains aligned after camera orbit/pan; no fixed 8×4 fallback for normal snapshots.

4. **Fallback camera parity:** Add an explicit wheel/pinch zoom path adjacent to `BattleVisualizer.attachPointerHandlers()` (`1076-1292`) and preserve focus center while zooming (`computeView`, `428-460`). **Acceptance:** wheel/pinch changes scale within bounded limits; panning and drag-select remain disambiguated; minimap viewport reflects the changed footprint.

5. **Stage switch contract:** Either keep renderer recreation as the sole transition contract and assert it in integration tests, or add a named `setStageNavigation(stageNumber)` lifecycle operation that replaces `navigation`, stage anchors, units, camera bounds, and minimap snapshot atomically. Candidate symbols: renderer constructors (`battle-realtime-three.js:334-406`, `battle-visualizer.js:155-229`) and `applyCampaignState()` methods. **Acceptance:** selecting/advancing a stage cannot leave stale routes/anchors/units/focus; `getTacticalSnapshot().stageNumber` and navigation revision agree with campaign state; stage 10 completion remains terminal.

6. **Invalid-stage diagnostics:** Replace silent clamp or add an explicit validation/error path around `normalizeStageNumber()` (`stage-navigation.js:53-55`). **Acceptance:** invalid/non-numeric stage input is rejected or surfaced diagnostically, while valid 1–10 behavior and existing navigation validation remain unchanged.
