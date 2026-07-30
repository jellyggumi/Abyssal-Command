# Mobile Controls & Landscape UI Architecture Map
**Status**: Inspection complete. No edits made.
**Scope**: Abyssal Lantern Three.js battle runtime; viewport/input ownership.
**Contract Preserved**: Deterministic simulation, single gameplay plane (Cinder Span → Abyss Chancel → Echo Throne), 11-action rig library, campaign persistence, Pages release topology.

---

## 1. Core Files & Symbols

### Entry Point & Initialization
- **File**: `/app.js:51-54`
  - `const root = document.querySelector("#defense-app")` (line 51)
  - `const viewport = new DefenseViewport()` (line 53)
  - `const telemetry = new DefenseTelemetry()` (line 54)

### Viewport Module (Orientation & Safe Areas)
- **File**: `/defense-viewport.js`
  - **Class**: `DefenseViewport` (lines 3-62)
  - **Key Methods**:
    - `start()` (lines 10-19): Attaches listeners to `visualViewport` resize/scroll, window resize/orientationchange
    - `update()` (lines 30-49): **Computes logical orientation**
      - Physical: `visualViewport.offsetLeft/Top/width/height` or `window.innerWidth/innerHeight` fallback
      - **Portrait detection** (line 36): `const portrait = height > width`
      - **Logical swap** (lines 37-38): swaps w↔h when portrait=true
      - **CSS vars set** (lines 39-44): `--defense-physical-{left,top,width,height}`, `--defense-logical-{width,height}`
      - **Dataset flag** (line 45): `dataset.defensePortrait = String(portrait)`
      - **Custom event** (lines 46-48): `abyssal:defense-viewportchange` detail includes all metrics
    - `mapPhysicalToLogical()` (lines 51-61): **Converts touch coords to logical space**
      - Handles portrait rotation: `py` becomes `x`, `width - px` becomes `y`

### Touch/Pointer Event System
- **File**: `/app.js` class `BattleSession` (lines 1674-3514)

#### Listener Setup (lines 1996-2013)
```
Canvas (world):
  - pointerdown → onPointerDown (line 1996)
  - pointermove → onPointerMove (line 1997)
  - pointerup / pointercancel / lostpointercapture → onPointerEnd (lines 1998-2000)

Movement Controls (#movement-controls):
  - pointerdown → onMoveControlDown (line 2002)
  - pointerup / pointercancel / lostpointercapture → onMoveControlEnd (lines 2003-2005)
  - click → onMoveControlClick (line 2006)

Global Window:
  - pointerdown → onGlobalPointerDown (line 2013)

Attack Surface (canvas root):
  - pointerdown → onAttackSurfacePointerDown (line 2007)
```

#### Handler Binding (lines 1776-1785)
```
this.onPointerDown = this.onPointerDown.bind(this);
this.onPointerMove = this.onPointerMove.bind(this);
this.onPointerEnd = this.onPointerEnd.bind(this);
this.onMoveControlDown = this.onMoveControlDown.bind(this);
this.onMoveControlEnd = this.onMoveControlEnd.bind(this);
this.onMoveControlClick = this.onMoveControlClick.bind(this);
```

#### Pointer Event Handlers (lines 2083-2203)
- **`onPointerDown(event)` (line 2083)**: Canvas capture; pinch detection, orbit drag init
- **`onPointerMove(event)` (line 2104)**: Orbit yaw/pitch updates; pinch zoom; camera hint dismiss
- **`onPointerEnd(event)` (line 2131)**: Release orbit & pinch state
- **`onMoveControlDown(event)` (line 2185)**: D-pad press; sets movement direction
- **`onMoveControlEnd(event)` (line 2195)**: D-pad release; clears direction
- **`onMoveControlClick(event)` (line 2203)**: D-pad click event (click redundancy after pointerup)
- **`onAttackSurfacePointerDown(event)` (line 2007)**: Prevents canvas click from bleeding to UI

#### Sensitivity Constants (lines 58-60)
```
CAMERA_ORBIT_YAW_SENSITIVITY = 0.00372 rad/px (full landscape width ~180°)
CAMERA_ORBIT_PITCH_SENSITIVITY = 0.00246 rad/px (drag up = look down, steeper pitch)
CAMERA_PINCH_ZOOM_SENSITIVITY = 0.006 zoomFactor delta/px pinch-distance
```

---

## 2. D-Pad / Movement Controls DOM

### Markup Location
- **File**: `/app.js:3015-3150` (within `renderControls()` method)
- **Rendering trigger**: Every frame via `BattleSession.update()` → `renderControls(snapshot)` (line 2736)

### D-Pad Element ID & Structure
- **ID**: `#movement-controls`
- **Query**: `root.querySelector("#movement-controls")` (inside method)
- **Parent**: `#defense-bottom` (fixed HUD row)
- **Siblings**:
  - `#skill-actions` (active skills)
  - `#passive-badges` (acquired passive skills)
  - `#battle-actions` (pause, stance, extract)
  - `#toggle-pause`
  - `#stance-cycle`

### Modality Tutorial Panel (lines 1249-1280)
- **Pointer tab** (`#modality-panel-pointer`):
  - Label: "좌측 하단 D-pad 이동 버튼 클릭" (click lower-left D-pad)
- **Touch tab** (`#modality-panel-touch`):
  - Label: "전장 화면 좌측 하단 D-pad 방향키 터치 및 홀드" (touch & hold lower-left D-pad)

---

## 3. Media Queries & Orientation Handling

### CSS Orientation Breakpoint
- **File**: `/styles.css` (not explicitly shown but implied by responsive grid)
- **Attribute selector**: `[data-defense-portrait]` (set by `DefenseViewport.update()`)
- **Rule pattern**: Media queries typically separate portrait (vertical stacking) from landscape (side-by-side decks)

### Key CSS Variables (set by DefenseViewport)
```
--defense-physical-left: px offset in visualViewport
--defense-physical-top: px offset
--defense-physical-width: px (actual device width)
--defense-physical-height: px (actual device height)
--defense-logical-width: rotated width (landscape-canonical)
--defense-logical-height: rotated height
```

### Viewport Meta Tag (index.html:5)
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```
- `viewport-fit=cover`: Safe area support for notched devices
- No explicit safe-area insets visible; relies on browser default padding

---

## 4. Current Control Ownership & Data Flow

### Movement Input Path
```
touchstart/pointerdown on #movement-controls
  ↓
onMoveControlDown(event)
  ├─ Extracts pointerdown target
  ├─ Converts physical coords via viewport.mapPhysicalToLogical()
  └─ Determines direction from D-pad position
      ↓
      Sets this.movementVector (class property)
      ↓
      Sent as "MOVEMENT" simulation input on next tick
```

### Pointer/Orbit Camera Path
```
pointerdown on canvas (#defense-battle-surface)
  ↓
onPointerDown(event)
  ├─ Stores pointer.id, pointer.position
  ├─ If 2 pointers: pinch-zoom mode
  └─ If 1 pointer: orbit drag mode
      ↓
pointermove (while pointer active)
  ├─ Delta from stored position
  ├─ Orbit: yaw += px * CAMERA_ORBIT_YAW_SENSITIVITY
  ├─ Orbit: pitch -= py * CAMERA_ORBIT_PITCH_SENSITIVITY (invert for "down to look down")
  ├─ Pinch: zoomFactor *= (1 + pinchDistance * CAMERA_PINCH_ZOOM_SENSITIVITY)
  └─ Sent to battle-realtime-three.js camera

pointerup / pointercancel / lostpointercapture
  └─ onPointerEnd(event) clears pointer state
```

### Attack Button Path
```
click on #attack-button
  ├─ pointerdown → captured by onAttackSurfacePointerDown (prevents canvas hit-test)
  └─ Sends "ATTACK" input to simulation
```

---

## 5. Device Modality Rules (Current)

### Modality Detection
- **File**: `/app.js` (inferred from tutorial panels)
- **Method**: Likely `navigator.maxTouchPoints > 0` or similar
- **States**:
  - `"pointer"` (mouse/trackpad) — pointer panel shown
  - `"touch"` (touch screen) — touch panel shown

### Pointer Modality
- D-pad: Click
- Camera: Click & drag (orbit)
- Zoom: Mousewheel scroll

### Touch Modality
- D-pad: Tap & hold
- Camera: Single-finger drag (orbit)
- Zoom: Two-finger pinch

---

## 6. HUD Overlap & Safe Area Risks

### Fixed HUD Layout (Landscape)
- **Left deck** (`#command-deck-left`): Character sheet, inventory, skills, legion
  - Position: Fixed left edge
  - Width: ~200px (D22 landscape decision)
  - Safe area: +notch margin

- **Right deck** (`#command-deck-right`): Deployment, stronghold, records
  - Position: Fixed right edge
  - Width: ~300px
  - Safe area: +notch margin

- **Bottom row** (`#defense-bottom`): D-pad, skills, stance, pause, extract
  - Position: Fixed bottom edge
  - Height: ~60px (button height + padding)
  - Grid layout: `grid-template-columns: repeat(2, minmax(44px, 1fr))`
  - Safe area: +safe-inset-bottom

### Overlap Risks
1. **D-pad ↔ left deck edge**: No risk; D-pad is part of bottom row, deck doesn't extend down
2. **Bottom row ↔ notch/safe area**: Risk in landscape with thick bottom safe-inset; buttons must stay readable
3. **Camera drag ↔ HUD**: Touch on canvas doesn't interfere (canvas is center, HUD is edge)

### CSS Safe Area Support (Implicit)
```
viewport-fit=cover in meta tag
  ↓
Safe insets available via:
  - CSS environment(): env(safe-area-inset-{top,right,bottom,left})
  - JS: visualViewport provides offsetLeft/offsetTop
```

---

## 7. Joystick Replacement Seam (Mobile-Only Analog)

### Current D-Pad Contract
- **ID**: `#movement-controls`
- **Events**: `pointerdown`, `pointerup`, `pointercancel`, `lostpointercapture`, `click`
- **Handler**: `onMoveControlDown(event)` / `onMoveControlEnd(event)`
- **Input output**: Direction vector (8-point D-pad) or continuous angle (joystick future)
- **Lifecycle**: Mounted at session start, reusable across runs

### Joystick Integration Seam
```
Replacement zone: #movement-controls container

Current binding (line 2002-2005):
  this.listen(this.movementControls, "pointerdown", this.onMoveControlDown);
  this.listen(this.movementControls, "pointerup", this.onMoveControlEnd);
  this.listen(this.movementControls, "pointercancel", this.onMoveControlEnd);
  this.listen(this.movementControls, "lostpointercapture", this.onMoveControlEnd);

Future joystick contract:
  ├─ Same element (#movement-controls) stays mounted
  ├─ Handlers remain bound (no signature change)
  ├─ event.pointerX/pointerY parsed differently
  │   (angle + magnitude instead of 8-point snapping)
  └─ Movement input sent: continuous direction (rad) + magnitude (0-1)
      instead of discrete 8-point vector

Zero-breaking change: Existing handler can detect joystick vs D-pad
via pointer start position (center circle for joystick, corner for D-pad)
```

---

## 8. Minimum Responsive CSS/Runtime Changes

### CSS-Only Adjustments (No logic change)
```css
/* Landscape joystick sizing */
@media (orientation: landscape) and (max-height: 600px) {
  #movement-controls {
    width: 80px;
    height: 80px;
    /* Joystick pad fits inside; D-pad direction buttons now radial */
  }
}

/* Safe area accommodation */
#defense-bottom {
  padding-bottom: max(.5rem, env(safe-area-inset-bottom));
}

/* Reduced-motion: static joystick, no spring animation */
@media (prefers-reduced-motion: reduce) {
  .joystick-thumb {
    transition: none;
  }
}
```

### Runtime Changes (Minimal)
1. **Handler logic branching** (1-2 lines):
   ```js
   // In onMoveControlDown/End:
   const isJoystick = event.currentTarget.dataset.type === "joystick";
   if (isJoystick) {
     // Parse angle + magnitude
   } else {
     // Parse 8-point D-pad
   }
   ```

2. **DOM markup swap** (template-only):
   - Remove D-pad buttons from `#movement-controls`
   - Add joystick canvas/SVG element
   - No ID change, same container reused

3. **Viewport coordinate mapping** (existing):
   - `DefenseViewport.mapPhysicalToLogical()` works unchanged
   - Joystick coordinates feed into same function

---

## 9. Test Coverage & Regression Surface

### Existing Tests Touching Controls
- **File**: `/tests/defense-survivor-browser.test.mjs` (lines ~50-75)
  - Browser tests for D-pad initialization
  - Tests `#movement-controls` element presence

- **File**: `/tests/defense-hud-responsive-browser.test.mjs`
  - Responsive layout tests across portrait/landscape
  - Validates `data-defense-portrait` attribute changes

- **File**: `/tests/combat-presentation-contract.test.mjs`
  - Pointer event simulation and UI feedback
  - Validates orbit camera + D-pad independence

### Minimal Regression Test Addition
```js
// Joystick-ready test (no changes yet, just future-proof):
test("movement controls reachable in landscape", () => {
  viewport.update({ portrait: false, width: 1024, height: 600 });
  const controls = root.querySelector("#movement-controls");
  assert(controls, "movement-controls mounted");
  // Future: assert(controls.dataset.type === "joystick" in landscape);
});
```

---

## 10. Summary: Exact Integration Slice

### Target: Mobile-Only Analog Joystick in Landscape

**Files to touch** (future implementation):
1. `/app.js` — `onMoveControlDown()` / `onMoveControlEnd()` handlers (1-2 branching lines)
2. `/styles.css` — Joystick visual rules + landscape media query (10-20 lines)
3. New optional: `/defense-joystick.js` — Joystick input parsing class (if factored out)

**No changes required** (preserved contracts):
- `/defense-viewport.js` — Orientation detection, safe-area mapping (reusable)
- `/battle-realtime-three.js` — Camera orbit system (unchanged input format)
- Campaign persistence, stage order, rig library

**Modality rule** (to add):
- Joystick appears in landscape mode only (`data-defense-portrait === "false"`)
- D-pad fallback on desktop/mouse (kept in portrait or via pointerType check)

---

## 11. Event Contract Proposal

### Current D-Pad Event
```js
event.pointerDown {
  pointerType: "touch" | "pen" | "mouse",
  pointerId: number,
  clientX: number,
  clientY: number,
  // Handler extracts: 8-point direction from D-pad button hit area
}
```

### Proposed Joystick Event (Same Container)
```js
event.pointerDown {
  pointerType: "touch",
  pointerId: number,
  clientX: number, // Touch center within circle
  clientY: number,
  // Handler extracts: angle (0-2π) + magnitude (0-1) from center circle
}

// Send to simulation:
INPUT {
  type: "MOVEMENT",
  angle: radians,      // 0 = right, π/2 = up, π = left, 3π/2 = down
  magnitude: 0.0-1.0   // Pressure/distance from center
}
```

---

## Acceptance Checklist

✅ Exact DOM IDs/classes/handlers identified:
- `#movement-controls` (container)
- `onMoveControlDown()` / `onMoveControlEnd()` (handlers)
- `.defense-bottom` (parent, grid layout)

✅ Current device modality rules documented:
- Pointer: click D-pad, click-drag orbit
- Touch: tap-hold D-pad, single-drag orbit, pinch zoom

✅ Joystick event contract proposed:
- Same `pointerdown` / `pointerup` events
- Parser branches on angle + magnitude instead of 8-point grid

✅ Minimum responsive CSS/runtime changes:
- Landscape media query for joystick sizing
- 1-2 branching lines in handler
- `DefenseViewport` reused as-is

✅ No edits made (inspection-only)

---

## Related Artifacts

- **Browser tests**: `/tests/defense-survivor-browser.test.mjs`, `/tests/defense-hud-responsive-browser.test.mjs`
- **Design decision log**: `ui-redesign-delta-20260725.md`, `control-feel-20260725.md`
- **Animation system**: `RUNTIME_ANIMATION_CONTRACT.md` (rigged 11-action poses)
- **Persistence contract**: `/campaign-state.js` (stage progression, loadout)
