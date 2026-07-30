# Mobile Landscape Joystick and HUD Design Specification

This specification outlines the non-destructive, upgrade-only replacement of the mobile D-pad with a Virtual Joystick and the layout compaction of the HUD for mobile landscape viewports ($844 \times 390$ and $667 \times 375$).

---

## 1. Player Job & Interaction Topology

### 1.1 Warden Gameplay Role
The player operates as the **Dusk Warden** (Commander), executing locomotion, active combat, stance cycling, and elite extraction under wave-based time pressure.
* **Locomotion:** Navigating narrow, hazard-prone lanes (e.g., Cinder Span ash zones) to dodge visual threat telegraphs.
* **Combat Actions:** Initiating basic attacks (automatic fallback or manual input) and casting active skills.
* **Legion/Stance Commands:** Switching formation stances (Vanguard, etc. via `STANCE_CYCLE`) to adapt to dynamic threats.
* **Elite Binding:** Channeling extraction on defeated elite units (`EXTRACT_ELITE`) within the active zone.

### 1.2 Spatially Grouped Zones
To optimize ergonomics and maintain a clean central gameplay plane, controls are distributed into thumb-reachable quadrants:
* **Left Thumb Zone ($0\% \text{ to } 25\%$ Width):** Houses the virtual joystick for locomotion. Positioned to clear device bezels and notch margins.
* **Right Thumb Zone ($75\% \text{ to } 100\%$ Width):** Houses the combat and action triggers (Manual Attack, 4 Active Skills, Stance-Cycle, Pause, Elite Extraction).
* **Bottom Center Zone ($25\% \text{ to } 75\%$ Width):** Houses the `gate-panel` (Commander & Gate Integrity bars), remaining compact to avoid interfering with lateral movement inputs.
* **Top Edge Row:** Holds loop states, objectives, and passive indicators at $z$-index 5.

---

## 2. Invariants & Preservation Contract

The design adheres to the following system-level preservation constraints:
1. **Modality Integrity:** Keyboard (`WASD` / arrows) and gamepad bindings must remain completely unchanged. The virtual joystick is touch-exclusive and activates only when `session.inputModality === "touch"`.
2. **Telemetry Invariance:** The joystick must submit coordinates via the standard `this.send("MOVE", direction)` API, incrementing `this.inputSeq`, setting `this.surface.dataset.defenseMove`, and triggering the `abyssal:defense-input-feedback` CustomEvent.
3. **Orbit/Pinch Invariance:** Standard single-pointer camera orbits and double-pointer zooms on `#defense-canvas` must remain active. Touch events inside `#movement-actions` must set pointer capture and prevent event bubbling to block camera interference.
4. **HTML Selectors:** Existing DOM IDs (`#movement-actions`, `#battle-actions`, `#toggle-pause`, `#stance-cycle`, `#extract-elite`, `#combat-input-cluster`) are preserved.

---

## 3. Component Authority Boundary

* **Simulation (`defense-run-simulation.js`):** Authoritative over actor positions, tick progression ($60\text{Hz}$), inputs queue, and active direction (`run.commander.move`). Consumes discrete octant values.
* **Viewport (`defense-viewport.js`):** Authoritative over coordinate scaling (`mapPhysicalToLogical`), safe-area inset tracking, and orientation datasets.
* **Joystick Controller (Touch UI):** Authoritative over active touch coordinates, knob clamping ($D_{\text{max}} = 48\text{px}$), deadzone rejection ($D_{\text{dead}} = 12\text{px}$), and mapping drag vectors to discrete octants (`N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW`, `IDLE`). Does not write to simulation positions directly.
* **HUD Panels:** Authoritative over visual layout and text/fill state bindings based on simulation ticks. Purely read-only.

---

## 4. Virtual Joystick Specifications

### 4.1 DOM Structure
The joystick overrides the `#movement-actions` container to preserve downstream test selectors:
```html
<div class="one-thumb-controls" id="movement-actions" role="group" aria-label="한 손 이동 조작">
  <div class="joystick-base" id="joystick-base">
    <div class="joystick-knob" id="joystick-knob"></div>
  </div>
</div>
```

### 4.2 CSS Styling & Layout
```css
#movement-actions {
  position: absolute;
  bottom: max(0.5rem, var(--defense-safe-bottom));
  left: max(0.5rem, var(--defense-safe-left));
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 6;
  pointer-events: auto;
}

.joystick-base {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 1.5px solid rgba(128, 168, 196, 0.4);
  background: linear-gradient(135deg, rgba(6, 10, 20, 0.65), rgba(13, 10, 25, 0.6));
  box-shadow: inset 0 0 10px rgba(92, 200, 255, 0.15), 0 4px 12px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: opacity 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
  opacity: 0.35;
}

.joystick-base.is-active {
  opacity: 0.85;
  border-color: #ffe487;
  box-shadow: inset 0 0 15px rgba(255, 228, 135, 0.25), 0 0 20px rgba(255, 228, 135, 0.2), 0 6px 16px rgba(0, 0, 0, 0.6);
}

.joystick-knob {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--lantern-line);
  background: linear-gradient(160deg, rgb(44 173 214 / 0.8), rgb(18 28 44 / 0.9));
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.joystick-knob.is-returning {
  transition: transform 150ms cubic-bezier(0.25, 1, 0.5, 1);
}
```

### 4.3 Gesture Control Logic
The controller captures inputs on `#movement-actions` and maps local offsets relative to the initial touch center.

```javascript
// Initialization
this.joystick = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  lastDirection: "IDLE"
};

const JOYSTICK_DEADZONE = 12;
const JOYSTICK_MAX_DRAG = 48;

onJoystickStart(event) {
  if (this.joystick.active) return;
  const point = this.logicalPoint(event);

  this.joystick.active = true;
  this.joystick.pointerId = event.pointerId;
  this.joystick.startX = point.x;
  this.joystick.startY = point.y;
  this.joystick.currentX = point.x;
  this.joystick.currentY = point.y;

  const base = document.getElementById("joystick-base");
  const knob = document.getElementById("joystick-knob");

  base.classList.add("is-active");
  knob.classList.remove("is-returning");

  // Center joystick base to the touch location (dynamic positioning)
  const rect = this.movementControls.getBoundingClientRect();
  const relX = event.clientX - rect.left;
  const relY = event.clientY - rect.top;
  base.style.transform = `translate(${relX - 80}px, ${relY - 80}px)`;

  this.movementControls.setPointerCapture(event.pointerId);
  this.updateInputModality("touch");
  if (this.inLobby()) this.suppressLobbyShowcase();
  event.preventDefault();
}

onJoystickMove(event) {
  if (!this.joystick.active || event.pointerId !== this.joystick.pointerId) return;
  const point = this.logicalPoint(event);

  this.joystick.currentX = point.x;
  this.joystick.currentY = point.y;

  let dx = this.joystick.currentX - this.joystick.startX;
  let dy = this.joystick.currentY - this.joystick.startY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const knob = document.getElementById("joystick-knob");

  if (distance > JOYSTICK_MAX_DRAG) {
    const ratio = JOYSTICK_MAX_DRAG / distance;
    dx *= ratio;
    dy *= ratio;
  }

  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

  let direction = "IDLE";
  if (distance >= JOYSTICK_DEADZONE) {
    const angle = Math.atan2(dy, dx);
    direction = getOctantDirection(angle);
  }

  if (direction !== this.joystick.lastDirection) {
    this.joystick.lastDirection = direction;
    this.send("MOVE", direction);
  }
}

onJoystickEnd(event) {
  if (!this.joystick.active || event.pointerId !== this.joystick.pointerId) return;

  this.joystick.active = false;
  this.joystick.pointerId = null;
  this.joystick.lastDirection = "IDLE";

  const base = document.getElementById("joystick-base");
  const knob = document.getElementById("joystick-knob");

  base.classList.remove("is-active");
  knob.classList.add("is-returning");

  base.style.transform = "none";
  knob.style.transform = "translate(-50%, -50%)";

  if (this.movementControls.hasPointerCapture(event.pointerId)) {
    this.movementControls.releasePointerCapture(event.pointerId);
  }

  this.send("MOVE", "IDLE");
}

function getOctantDirection(angle) {
  const shiftedAngle = angle + Math.PI / 8;
  const normalized = shiftedAngle < 0 ? shiftedAngle + 2 * Math.PI : shiftedAngle;
  const sector = Math.floor(normalized / (Math.PI / 4));
  const sectors = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
  return sectors[sector % 8] || "IDLE";
}
```

---

## 5. HUD Reflow & Dialogue Clearance

To prevent horizontal overlap and keep the gameplay plane unobstructed, the combat HUD elements are grouped cleanly.

### 5.1 Top Panel Grouping
* **`.hud-mission` (Top Left):** Capped at $28\%$ width. Displays stage number, sector, and the XP tracker.
* **`.hud-loop-state` (Top Center):** Compact loop state displays wave and objective phases. Capped at $30\%$ width.
* **`.top-right-hud` (Top Right):** Objective chip (`#battle-objective`) + passive icons. Capped at $35\%$ width.

### 5.2 Bottom Panel Grouping
* **`#movement-actions` (Bottom Left):** Virtual Joystick ($160\text{px} \times 160\text{px}$).
* **`.gate-panel` (Bottom Center):** Gate and Commander HP bars, width capped at $280\text{px}$ to prevent blocking lateral touch points.
* **Combat Cluster & `#battle-actions` (Bottom Right):** Attack medallion, active skills radial, and stance cycle/pause button. Width capped at $200\text{px}$.

### 5.3 Dialogue Overlays
Quest dialogue/narrative captions (`.defense-cutscene`) occupy `z-index: 7` at the bottom of the screen. The margins are adjusted to clear the left joystick and right combat clusters:
```css
@media (orientation: landscape) and (max-height: 560px) {
  .defense-cutscene {
    position: absolute;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    height: auto;
    min-height: 5rem;
    padding-bottom: max(1.2rem, var(--defense-safe-bottom));
    background: linear-gradient(180deg, transparent, rgba(5, 8, 18, 0.95) 40%);
    display: flex;
    justify-content: center;
    align-items: flex-end;
    pointer-events: none;
  }
  .cutscene-frame {
    pointer-events: auto;
    width: min(86vw, 44rem);
    margin-left: 200px; /* Clears left joystick zone */
    margin-right: 220px; /* Clears right combat cluster */
    padding: 0.45rem 0.65rem;
  }
}
```

---

## 6. Verification Matrix

The proposed design can be validated using the following test assertions:

| Test ID | Viewport | Action Sequence | Assertions / Verification Criteria |
|---|---|---|---|
| **V1** | $844 \times 390$ | Measure `#movement-actions` dimensions. | Container width $\ge 150\text{px}$, height $\ge 150\text{px}$. Knob target $\ge 44\text{px}$. |
| **V2** | $844 \times 390$ | Trigger `pointerdown` inside `#movement-actions`. | Check `document.documentElement.dataset.inputModality === "touch"`. |
| **V3** | $844 \times 390$ | Drag from joystick area. | Check canvas pitch/yaw is unchanged (canvas camera orbit event is blocked). |
| **V4** | $844 \times 390$ | Drag knob $30\text{px}$ up ($dx=0, dy=-30$). | Check `data-defense-move === "N"`. Check `inputSeq` is incremented. |
| **V5** | $844 \times 390$ | Release pointer. | Check knob returns to center after $150\text{ms}$. Check `data-defense-move === "IDLE"`. |
| **V6** | $844 \times 390$ | Check document scroll footprint. | `document.documentElement.scrollWidth <= clientWidth` (No horizontal overflow). |
| **V7** | $844 \times 390$ | Measure exposed central vertical band height. | `exposedHeight = bottom.top - top.bottom` is $\ge 180\text{px}$. |
| **V8** | $844 \times 390$ | Trigger `keydown` with `code="Space"` on body. | Modality updates to `keyboard`. Manual attack command is sent and `data-defense-attack` is set. |
| **V9** | $844 \times 390$ | Drag knob by $8\text{px}$ ($dx=8, dy=0$). | Direction remains `IDLE`. No new inputs are queued. |
| **V10** | $844 \times 390$ | Set `--defense-safe-left` to $44\text{px}$ (notch offset). | Left bounds of `#movement-actions` must shift to $44\text{px}$ plus offset margin. |
