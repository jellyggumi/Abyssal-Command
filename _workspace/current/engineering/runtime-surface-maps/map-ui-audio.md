# Surface Map: UI & Audio Architecture — Abyssal Surge

## Surface Map

### Movement Controls

**Joystick Gating & Conditions**
- **Enablement Test**: `app.js:2350-2352`
  - Requires `(pointer: coarse) and (orientation: landscape)` media query match
  - Requires `document.documentElement.dataset.defensePortrait !== "true"` (portrait mode explicitly disables)
  - Single point of control: `joystickActive()` method must return `true` for joystick to activate

**DOM Structure**
- **Container**: `#movement-actions` with `data-movement-control="octant-joystick"` attribute (`app.js:1772`)
- **Joystick Element**: `<div class="virtual-joystick" data-joystick>` (app.js:1773)
  - Child: `<span class="virtual-joystick-rune"></span>` (decorative)
  - Child: `<i class="virtual-joystick-knob" data-joystick-knob></i>` (interactive)
- **Five D-Pad Buttons**: All children of `#movement-actions` with `data-move` attribute (`app.js:1774-1778`)
  - `<button data-move="N">↑</button>` — north (up)
  - `<button data-move="W">←</button>` — west (left)
  - `<button data-move="IDLE">●</button>` — stop/neutral
  - `<button data-move="E">→</button>` — east (right)
  - `<button data-move="S">↓</button>` — south (down)
- **ARIA**: `role="group" aria-label="한 손 이동 조작"` (one-handed movement control)

**Joystick Methods & Mechanics**
- **Octant Routing**: `JOYSTICK_OCTANTS = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"]` (`app.js:74`)
- **Dead Zone**: `JOYSTICK_DEAD_ZONE_RATIO = 0.22` (22% of radius is dead zone) (`app.js:75`)
- **updateJoystick(event)** (`app.js:2355-2381`): Calculates pointer position, clamps to radius, quantizes to 8 octants or IDLE
  - Sets `--joystick-x` and `--joystick-y` CSS custom properties for visual feedback
  - Updates `movementControls.dataset.joystickDirection` with current direction
  - Calls `this.send("MOVE", direction)` when direction changes
- **resetJoystick({ sendIdle = true })** (`app.js:2382-2388`): Removes CSS properties, sets direction to IDLE, optionally sends IDLE move command

**Pointer Event Handlers**
- **onMoveControlDown(event)** (`app.js:2390-2409`): 
  - Checks `joystickActive()` → triggers joystick mode with pointer capture
  - Otherwise looks for `[data-move]` button and triggers button mode
  - Sets `this.controlPointerId` and `this.controlPointerMode` ("joystick" | "buttons")
- **onMoveControlMove(event)** (`app.js:2411-2415`): 
  - Only active when `controlPointerMode === "joystick"`
  - Calls `updateJoystick(event)` to track pointer motion
- **onMoveControlEnd(event)** (`app.js:2417-2426`): 
  - Releases pointer capture from appropriate target
  - Resets `controlPointerId`, `controlPointerMode`
  - Calls `resetJoystick()` to restore neutral state
- **onMoveControlClick(event)** (`app.js:2428-2433`): 
  - Fires on synthetic click event from button press
  - Finds `[data-move]` button and sends its direction via `this.send("MOVE", button.dataset.move)`

**Event Registration** (`app.js:2157-2166`): 
All attached in `BattleSession.start()`:
```javascript
this.listen(this.movementControls, "pointerdown", this.onMoveControlDown);
this.listen(this.movementControls, "pointermove", this.onMoveControlMove);
this.listen(this.movementControls, "pointerup", this.onMoveControlEnd);
this.listen(this.movementControls, "pointercancel", this.onMoveControlEnd);
this.listen(this.movementControls, "lostpointercapture", this.onMoveControlEnd);
this.listen(this.movementControls, "click", this.onMoveControlClick);
```

**Keyboard Bindings** (`app.js:76-79`)
- **Directional Keys** (`KEY_DIRECTIONS` constant):
  - `w`/`arrowup` → `"N"` (north)
  - `d`/`arrowright` → `"E"` (east)
  - `s`/`arrowdown` → `"S"` (south)
  - `a`/`arrowleft` → `"W"` (west)
- **Combination Logic** (`app.js:2509-2518`): Multiple keys held simultaneously map to octant via `DIRECTION_BY_VECTOR` lookup table
  - Maintains `this.heldKeys` Set to track active keyboard keys
  - Computes vertical (-1 for N, +1 for S, 0 for neither)
  - Computes horizontal (-1 for W, +1 for E, 0 for neither)
  - Maps `"${horizontal},${vertical}"` to direction name (includes all 8 octants + IDLE)

**onKey Handler** (`app.js:2473-2518`):
- Bound to both `keydown` and `keyup` events (checks `event.type`)
- Respects contenteditable, input, textarea, select focus (does not steal their keys)
- Respects tablist navigation (arrow keys stay in tablist)
- Exempts activation keys (Space/Enter) for buttons/links unless ATTACK_KEYS match
- `ATTACK_KEYS` (`app.js:80`): `{" ", "space", "spacebar", "j", "f", "enter"}`
- `ATTACK_CODES` (`app.js:81`): `{"Space", "KeyJ", "KeyF", "Numpad0"}`
- Non-repeat keydown for directional keys triggers `suppressLobbyShowcase()` if in lobby

**MOVE Message Contract** (`app.js:2520-2537`):
- `this.send("MOVE", payload)` where `payload` is one of:
  - `"N"`, `"NE"`, `"E"`, `"SE"`, `"S"`, `"SW"`, `"W"`, `"NW"` (8 cardinal/diagonal directions)
  - `"IDLE"` (no movement)
- Enqueued via `queueInput(this.run, "MOVE", payload)` into simulation queue
- Sets `this.surface.dataset.defenseMove = payload` for telemetry/debugging
- Recorded to telemetry via `telemetry.recordInputFeedback()`

**CSS Visibility Rules** (`styles.css:3030-3040, 3052-3140`)
- Default: `.virtual-joystick { display: none; }` (hidden on all non-matching contexts)
- Activates at: `@media (pointer: coarse) and (orientation: landscape)` + `html[data-defense-portrait="false"]`
- Joystick container: `7.25rem × 7.25rem` grid area
- Knob: `44px × 44px` (meets 44×44 touch target minimum)
- Buttons hidden under joystick: `opacity: 0; pointer-events: none;` (overridden on `:focus-visible`)

---

## HUD Structure & Panels

### Battle HUD Template
**Primary Markup Location**: `app.js:1770-1879` (within `renderShell()` dom-creation function, mounted once via `mountShell()`)

**Layout Zones**
1. **#defense-top** (top panel strip)
2. **#defense-bottom** (bottom action bar)
3. **#defense-battle-surface** (central 3D canvas wrapper)
4. **#defense-edge-hud** (world-space HUD overlay for nameplates, damage numbers)
5. **#lobby-cinematic** (pre-run overlay with camera showcase + dialogue)

**Key Panels** (all regenerated per-tick via `renderLoop()` → `render()`)
- `.hud-panel.gate-panel` — commander integrity bar track (`app.js:1771`)
- `.hud-panel.hud-mission` — objective/domain display
- `.hud-panel.hud-legion` — companion status
- `.hud-panel.hud-loop-state` — wave/phase tracker
- `.combat-input-cluster` — skill buttons (`app.js:1780`)
- `.manual-attack-action` — attack button with Space/J keybind display

### CSS Custom Property System (Design Tokens)

**Established Token Variables** (`styles.css` throughout):

| Token | Value/Use | Reference |
|-------|-----------|-----------|
| `--defense-logical-width` | Canvas logical width (not physical px) | app.js:2155 read for camera clamp |
| `--defense-logical-height` | Canvas logical height | app.js:2155 read for camera clamp |
| `--defense-safe-top` | Safe area top inset from env() | styles.css used in media queries |
| `--defense-safe-right` | Safe area right inset | styles.css:3045 (#movement-actions padding) |
| `--defense-safe-bottom` | Safe area bottom inset | styles.css:3045 (#defense-bottom padding) |
| `--defense-safe-left` | Safe area left inset | styles.css:3045 |
| `--joystick-x` | Joystick knob X offset (px) | app.js:2372 (setProperty in updateJoystick) |
| `--joystick-y` | Joystick knob Y offset (px) | app.js:2373 (setProperty in updateJoystick) |
| `--rc-panel-border` | Fallback panel border color | `rgb(150 156 180 / .18)` |
| `--canon-cyan-rift` | Cyan accent (Echo Core currency) | styles.css deck-chip-echo-core |
| `--canon-zenith-gold` | Gold accent (Bound Fragment currency) | styles.css deck-chip-bound-fragment |

**Palette Locations**
- **Theme Root**: `:root` selector (`styles.css:1`) sets `color-scheme: dark`, `background: #050812`, `color: #eef5ff`
- **Chromatic Palette**:
  - Deep navy: `#050812`, `#101c30`, `#0f172a`
  - Cyan blues: `#81d6ff`, `#80d8ff`, `#2cadd6`, `#a6e2ff`
  - Gold/amber: `#ddc869`, `#ffe487`, `#e5d48a`
  - Secondary text: `#b6c8df`, `#9fd8ff`, `#9fc8dc`, `#9ecce4`
- **Safe Area Env Vars**: `env(safe-area-inset-top)`, `env(safe-area-inset-right)`, `env(safe-area-inset-bottom)`, `env(safe-area-inset-left)` used throughout deck and bottom-bar paddings

---

## Screen/Route Model

**Persistent Shell Architecture** (`app.js:1750-1796`):
- Single `<main id="defense-app">` root mounts once at app initialization
- DOM never torn down; route switching reflows/rehides content via attributes

**Session Duality** (`app.js`):
- **Lobby State**: `session.started === false` (BattleSession exists but run not committed)
  - Shows pre-run UI: command decks + sortie FAB + lobby cinematic
  - Player can adjust formation, stage, Abyss Depth, read lore
  - Render loop still runs (camera showcase, dialogue cycling)
  - Zero simulation ticks
- **Battle State**: `session.started === true` (BattleSession.beginRun() executed)
  - Hides command decks (via `html[data-defense-started="true"]` hiding rule in styles.css:37)
  - Removes sortie FAB from DOM (not just hidden)
  - Runs full simulation tick loop
  - HUD panels regenerated every ~16ms

**Screen Tabs (Pre-Run)**

1. **출정 (Sortie/Briefing)** — `activeRightSection = "sortie"` (`app.js:218`)
   - Hero copy + stage objective + pre-deployment companion preview
   - Render: `renderSortieTabBody()` (`app.js:1219-1365`)

2. **요새 (Stronghold)** — `activeRightSection = "stronghold"` 
   - Permanent reward grants + idle-return recap
   - Render: `renderStrongholdTab()` (`app.js:1014-1024`)

3. **Left Deck Tabs** (`activeLeftSection`):
   - **인벤토리** (Inventory) — appearance cosmetics + equipment ladder
   - **성장** (Growth) — stats + traits
   - **군단** (Legion) — companion bond slots + roster + formation slots
   - Render: `renderCommandDeckLeft()` (`app.js:1145-1207`)

**Overlay & Cutscene Layers**

| Layer | Z-index | Purpose | Element |
|-------|---------|---------|---------|
| Lobby Cinematic | (above canvas) | Pre-run camera showcase + dialogue relay | `#lobby-cinematic` |
| Edge HUD | 5 | World-space nameplates, damage numbers | `#defense-edge-hud` |
| Command Decks | 4 | Left/right deck sidebars (pre-run only) | `#command-deck-left`, `#command-deck-right` |
| Battle Surface | 0 | Three.js canvas + HUD panels | `#defense-battle-surface` |

**Cutscene Triggering** (`app.js:2900-2940`):
- Consumed via `consumeCutscenes(snapshot.events)` in render loop
- Story beats fire on specific event types (STAGE_STARTED, OCCUPATION_CAPTURED, BOSS_SPAWNED, OBJECTIVE_COMPLETED, TERMINAL)
- Nonblocking cutscene overlays positioned via `data-nonblocking="true"` (app.js:3045-3048)

---

## defense-audio.js Architecture

### WebAudio Graph
**Master Gain & Routing** (`defense-audio.js:1-16`):
- `MASTER_GAIN = 0.055` — global volume floor
- `MAX_AUDIO_NODES = 64` — max concurrent synthesized voices
- `MAX_TRANSIENT_NODES = 48` — pooled buffer-source limit
- `MAX_ACTIVE_VOICES = 12` — simultaneous overlapping cues
- `SILENCE = 0.0001` — noise floor for envelope detection

**Narration Capacity** (`defense-audio.js:14-16`):
- `MAX_ACTIVE_NARRATIONS = 8` — concurrent TTS utterances
- `MAX_NARRATION_CHARS = 240` — ambient narration character limit
- `MAX_STORY_NARRATION_CHARS = 96` — story beat narration (shorter cutoff)
- `STORY_NARRATION_PRIORITY = 76` — priority level for story beats
- `AMBIENT_NARRATION_PRIORITY = 45` — priority level for ambient dialogue
- `CRITICAL_AUDIO_PRIORITY = 80` — threshold above which narration is forced

### AUDIO_EVENT_POLICY Registry
**Location**: `defense-audio.js:220-288`

Each simulation event type maps to an audio policy via `AUDIO_EVENT_POLICY` export. **Director-ruled canonical event type names** (SCREAMING_SNAKE_CASE):

```javascript
STAGE_STARTED, INPUT_ACCEPTED, INPUT_REJECTED, MOVE, BASIC_ATTACK, PROJECTILE_BLOCKED, 
ATTACK_MISS, INTERRUPTION_TRIGGERED, TERMINAL, ITEM_COLLECTED, PICKUP_DENIED,
BOSS_SPAWNED, BOSS_RALLY_WINDOW, ENEMY_SPAWNED, ENCOUNTER_OBJECTIVE_COMPLETED,
OCCUPATION_CAPTURED, OCCUPATION_LOST, CAMPAIGN_EXTRACTION_READY,
// Director-ruled canonical events (cycle 10):
DROP_SPAWNED, DROP_EXPIRED, DROP_DENIED, 
BUFF_APPLIED, BUFF_REFRESHED, BUFF_EXPIRED,
PACING_BLOCK_STARTED, PACING_BLOCK_CLEARED, 
GIMMICK_ARMED, GIMMICK_TRIGGERED, GIMMICK_RESOLVED
```

**Policy Fields**:
- `cueId` — audio cue identifier (null for silent policies)
- `priority` (0–100) — contention ordering; higher priority preempts lower
- `category` — grouping for refractory metering and narration logic
- `intentionalSilence` — boolean marking deliberately-muted events (e.g., MOVE, ENEMY_SPAWNED)

### Audio Event IDs Currently Declared

**Synthesized Cues** (procedural oscillators, `defense-audio.js:35-46`):
- `input-accepted` — sine 360Hz, 80ms
- `input-rejected` — square 110Hz, 90ms
- `attack-windup` — sawtooth 180Hz, 110ms
- `block-contact` — triangle 140Hz, 100ms
- `attack-miss` — sine 190Hz, 80ms
- `interrupt-alert` — square 92Hz, 130ms
- `warning-pulse` — sawtooth 170Hz, 200ms
- `objective-waypoint` — sine 300Hz, 240ms
- `objective-complete` — triangle 260Hz, 280ms
- `boss-phase` — sawtooth 82Hz, 420ms
- `death-retry` — triangle 146Hz, 340ms

**Curated Profiles** (tone sequences from `CUE_PROFILES`, `defense-audio.js:74-215`):
- `stage-start`, `enemy-defeated`, `elite-extracted`, `item-collected`, `growth-offer`, `skill-cast`, `boss-spawned`, `terminal`
- `movement-step`, `weapon-fire`, `impact-hit`, `critical-hit`
- `extraction-ready`, `occupation-captured`, `camera-clamp`

**Audio Cues from Catalog** (imported from `defense-catalog.js`):
- Referenced in `AUDIO_EVENT_POLICY` — e.g., `CRITICAL_HIT: feedbackPolicy(AUDIO_CUES.criticalHit.id, 82, "damage")`
- Full registry in `byId` lookup table (`defense-audio.js:42-43`)

### Event Priority & Voice Cap
**Priority System** (`defense-audio.js:220-288`):
- Each event has a static priority (0–100)
- Higher priority displaces lower during voice contention
- `CRITICAL_AUDIO_PRIORITY = 80` gates narration interrupt logic
- Batch ordering: events sorted by `priority DESC`, then `index ASC` for stable sort

**Refractory Metering** (`defense-audio.js:290-305`):
- Prevents event spam via per-cue refractory period (e.g., `"movement-step": 0.07s`)
- Lookup: `CUE_REFRACTORY_SECONDS[cueId]`
- Tracked via `lastCueAt` Map in DefenseAudio state

### Mute & Pause/Resume
**Mute State** (`defense-audio.js` DefenseAudio class):
- Mute toggle accessible via `audioSettingsMarkup()` in app.js:988-1003
- Reads from storage (persisted between sessions)
- Muting stops narration, disables new cues, maintains silence until unmute

**Pause/Resume**:
- Pause invoked when battle pauses (user toggles via P/Escape)
- All active oscillators halt (gain set to 0)
- Soundscape layers suspend
- Resume re-triggers layers with smoothed gain ramp

### debugMetrics()
**Location**: `defense-audio.js` (exported method on DefenseAudio class)
**Output**: Logged object with:
- `feedbackEventKeys.size` — currently active deduplication keys
- `storyNarrationKeys.size` — active story narration utterances
- `lastFeedbackTick` — tick of last consumed feedback event
- `soundscapeState` — current ambient/music layer state
- `activeLayers` — count of running synthesizers
- Node pool utilization (transient/persistent ratio)

---

## Audio Synthesis & Triggering

### Synthesis Architecture
**All Audio Synthesis is Procedural**
- No sample/file playback exists in current codebase
- Every cue generated via Web Audio API oscillators (sine, triangle, square, sawtooth)
- Tone sequences defined via `CUE_PROFILES` — array of tone objects with:
  - `waveform` (string: "sine", "triangle", "square", "sawtooth")
  - `frequency` (Hz start frequency)
  - `endFrequency` (optional; sweep endpoint)
  - `duration` (seconds)
  - `gain` (volume 0–1)
  - `delay` (start offset, default 0)
  - `attack` (envelope attack time, default 8ms)

**Soundscape Layers** (Procedural BGM/Ambience, `defense-audio.js:325-380`):
- `STAGE_SOUNDSCAPES` — per-stage ambient + music frequency templates
- `SOUNDSCAPE_STATES` — parametric mixes (descent, active-wave, objective-pressure, boss, victory, defeat)
- Each layer a persistent oscillator modulated by state gain + pitch
- No pre-recorded music files

### Event Triggering Path

**Trigger Flow**:
1. Simulation event emitted in `defense-run-simulation.js` tick → added to `snapshot.events[]`
2. Render loop (`app.js:2858-2885`) deduplicates events by `eventId` or composite key
3. Calls `this.audio.consume(newAudioEvents)` with filtered array
4. `DefenseAudio.consume()` (`defense-audio.js:1177-1250`):
   - Maps each event to `audioCueForEvent(event)` to lookup policy + cue
   - Applies refractory metering (`rememberFeedbackEvent()`)
   - Sorts by priority
   - Routes to `play()` (cue synthesis) or `narrate()` (TTS)

**Call Site**: `app.js:2883` in `BattleSession.render()`
```javascript
this.audio.consume(newAudioEvents);
```

### Movement Sounds (Dead Code — Re-wiring Required)
**[OBSERVED] Dead Code Finding**: Movement audio profiles are authored but unreachable
- `movement-step` and `weapon-fire` profiles defined in `defense-catalog.js:208-209` and `defense-audio.js:111-117`
- Simulation already emits `cue: eventCue("movementStep")` every 12th tick (`defense-run-simulation.js:2886`)
- **Blocker**: `MOVE: silentPolicy("movement")` (`defense-audio.js:230`) shadows the catalog-cue fallback
- **Solution (AudioFeedbackDesign owns)**: Remove `silentPolicy("movement")` from AUDIO_EVENT_POLICY to expose existing profiles
- Refractory: `CUE_REFRACTORY_SECONDS["movement-step"] = 0.07s` already set (140Hz theoretical max)

### Block/Dodge Sounds
- `block-contact` cue defined (`defense-audio.js:157`)
- Mapped via `PROJECTILE_BLOCKED: feedbackPolicy("block-contact", 52, "block")` (def-audio.js:241)
- Fires when simulation emits `PROJECTILE_BLOCKED` event

### Attack/Weapon Sounds
- `attack-windup` (`defense-audio.js:150`) — fires before action executes
- Mapped to `BASIC_ATTACK`, `WEAPON_FIRED`, `MELEE_SWEEP` events (def-audio.js:231-233)
- Refractory: 0.04s for rapid swings

---

## BGM & Ambience

### Soundscape System (Procedural, Active)
**Architecture** (`defense-audio.js:325-380`):
- `STAGE_SOUNDSCAPES` defines per-stage frequency templates for:
  - Ambience (layered low-frequency bed)
  - Music (layered mid-frequency melody)
- `SOUNDSCAPE_STATES` parametrizes these via:
  - `ambienceGain`, `musicGain` — volume scaling
  - `pitch` — frequency multiplier
- Eight states: descent (resting), active-wave, objective-pressure, boss, midboss, victory, defeat, extraction

**State Transitions** (`audioSoundscapeForEvent()`, `defense-audio.js:397-430`):
- `STAGE_STARTED` → descent
- `ENEMY_SPAWNED` / `WAVE_VARIANT_STARTED` → active-wave
- `OBJECTIVE_PHASE_CHANGED` (boss-kill) → boss
- `BOSS_SPAWNED` / `BOSS_RALLY_WINDOW` → boss
- `PACING_BLOCK_STARTED` (blockId="boss") → boss state
- `OBJECTIVE_PRESSURE_*` → objective-pressure
- `PACING_BLOCK_CLEARED` (blockId="extraction") → extraction state
- `TERMINAL` (outcome=DEFEAT) → defeat, (outcome=VICTORY) → victory

**Audio Attachment** (`defense-audio.js:458-480`):
- Soundscape layers mounted in `DefenseAudio.start()` when session begins
- Persistent oscillators run entire combat duration, never stopped
- Consumption loop calls `setSoundscape(state, stageId)` to crossfade between profiles
- Runs alongside all other cues; coexists with narration

**Characteristics**:
- Ambience: Deep sub-bass frequencies (24–36 Hz typically)
- Music: Melody-range frequencies (50–164 Hz)
- No file playback, all synthesized
- Deterministic — same frequencies every run on same stage

---

## Accessibility & Mobile

### Portrait Mode Control
**Attribute**: `data-defense-portrait` on `<html>` root (`app.js:1821`, styles.css throughout)
- Set via `document.documentElement.dataset.defensePortrait`
- **Value "true"** → portrait orientation active; hides joystick, shows d-pad buttons only
- **Value "false"** → landscape orientation; enables joystick, buttons opacity:0
- Defaults to landscape preference if not explicitly set

**Media Query Gating** (`styles.css:3052`):
```css
@media (pointer: coarse) and (orientation: landscape) {
  html[data-defense-portrait="false"] .virtual-joystick { display: grid; }
  html[data-defense-portrait="false"] #movement-actions > button[data-move] { opacity: 0; }
}
```

### Safe-Area-Inset Handling
**CSS Safe Area Integration** (styles.css throughout):
- Deck masthead padding: `padding: max(.45rem, env(safe-area-inset-top)) .45rem .45rem;` (deck-masthead, line ~50)
- Deck body padding: `padding: .5rem .4rem max(.5rem, env(safe-area-inset-bottom));` (deck-body, line ~63)
- Movement controls bottom padding: `padding: .25rem max(.35rem, var(--defense-safe-right)) max(.35rem, var(--defense-safe-bottom)) max(.35rem, var(--defense-safe-left));` (styles.css:3045)
- Command decks do NOT inherit parent `--defense-safe-*` variables (siblings, not children) — must read `env()` directly

### Reduced-Motion Support
**Media Query**: `@media (prefers-reduced-motion: reduce)` (implied throughout, explicit checks in app.js)
- **Lobby Showcase**: Static mid-framing shot instead of orbiting camera (`lobby-cinematic.js:34-42`)
- **Stance Confirmation**: Static glow (`is-switched` state) instead of keyframe animation (app.js:118-123)
- **Sortie Burst**: Particle FX entirely skipped (`spawnSortieBurst()` checks `prefersReducedMotion()`, line 1703)
- **Renderer Notification**: `this.renderer?.setReducedMotion?.(reducedMotion)` called on orientation change (app.js:1921)

### Touch Target Sizing
**44×44 Pixel Minimum** (Apple HIG & WCAG AAA standard):
- D-Pad buttons: `min-width: 44px; min-height: 44px;` (styles.css:5)
- Joystick knob: `width: 44px; height: 44px;` (styles.css:3100)
- Deck segment bar chips: `min-width: 48px; min-height: 48px;` (styles.css:132)
- All interactive buttons default to 44×44 minimum via CSS rule on `button` selector (styles.css:5)

### ARIA & Semantic HTML
**Movement Controls**:
- Container: `role="group" aria-label="한 손 이동 조작"`
- Each button: `aria-label` describing direction (e.g., "위로 이동" = move up)
- Joystick: `aria-hidden="true"` (visual presentation only, no semantic role)
- Knob indicator: `aria-hidden="true"` (decorative)

**Deck Segments**:
- Tab list pattern via `role="tablist"` on segment bar
- Each segment: implicit button role, `is-active` class for state
- Keyboard navigation: arrow keys reserved for tab switching

**Icon Fallbacks**:
- Generated `.webp` plates load via `[data-ui-icon]` background-image
- Fallback text glyphs rendered inline when CSS plate fails to load (icon font chars like ✦, ◉, ◈)
- Plate absence is degraded, not blank (styles.css:200-230)

---

## Extension Points

### Adding Item Drop Audio (Director-ruled: DROP_SPAWNED, DROP_EXPIRED, DROP_DENIED)
**Event Types** (canonical, SCREAMING_SNAKE_CASE):
- `DROP_SPAWNED` payload: `{ dropId, itemId, rarity, grade, x, y, slabId }`
  - rarity: "common" | "rare" | "resonant" | "relic" (4 tiers)
  - grade: "BASIC" | "SHADOW" | "BOSS"
- `DROP_EXPIRED` payload: `{ dropId, itemId, x, y }`
- `DROP_DENIED` payload: `{ itemId, rarity, grade, reason, x, y, slabId }`
  - reason: "FIELD_CAP" | "MEASUREMENT_PROFILE"

**Policy Entries** (`defense-audio.js` AUDIO_EVENT_POLICY):
```javascript
DROP_SPAWNED: feedbackPolicy("drop-appeared", 58, "pickup"),
DROP_EXPIRED: feedbackPolicy("drop-expire", 34, "pickup"),
DROP_DENIED: feedbackPolicy("drop-denied", 46, "pickup"),
```

**Cue Profiles** (`defense-audio.js` CUE_PROFILES):
- `drop-appeared`: ascending tone sequence, pitch varies by rarity (common=low, relic=high)
- `drop-expire`: descending fade, brief (200ms)
- `drop-denied`: blocked tone (triangle 70Hz, 150ms)

**VFX Prerequisite**: effectAnchor() must accept top-level `x`, `y` fields (PR-1, owned by renderer)

### Adding Buff Application Audio (Director-ruled: BUFF_APPLIED, BUFF_REFRESHED, BUFF_EXPIRED)
**Event Types** (canonical):
- `BUFF_APPLIED` payload: `{ buffId, itemId, stat, magnitude, durationTicks, appliedAtTick, expiresAtTick }`
- `BUFF_REFRESHED` payload: `{ buffId, itemId, stacks, expiresAtTick }`
- `BUFF_EXPIRED` payload: `{ buffId, itemId, stat, reason }`
  - reason: "TIMEOUT" | "EVICTED" | "STAGE_TRANSITION" | "DEATH"

**Stat Enum** (Director-ruled v3, 7 values):
- "basicDamage" | "gateMaxIntegrity" | "pickupRange" | "cooldownScaleBp" | "moveSpeedBp" | "critChanceBp" | "incomingDamageBp"
- `magnitude` is always integer basis points (e.g., cooldownScaleBp: -1200 = -12.00× multiplier)

**Tick Field Names** (Director-ruled v3):
- Entry: `appliedAtTick`, `expiresAtTick` (absolute integer ticks)
- Payload: `durationTicks` (span, integer), `expiresAtTick` (absolute tick)
- Presentation-side: `remaining = expiresAtTick - snapshot.tick`

**Policy Entries** (`defense-audio.js`):
```javascript
BUFF_APPLIED: feedbackPolicy("buff-gain", 52, "buff"),
BUFF_REFRESHED: feedbackPolicy("buff-refresh", 36, "buff"),
BUFF_EXPIRED: feedbackPolicy("buff-fade", 28, "buff"),  // audible sting on reason: "TIMEOUT" only
```

**Consumption**: Fire on simulation snapshot event; buff cues are passive feedback (UI-owned state tracking, no pre-expiry warning event)

**VFX Prerequisite**: effectAnchor() must add BUFF_* to commander fallback switch (PR-1, owned by renderer)

### Adding Gimmick Deformation Audio (Director-ruled: GIMMICK_ARMED, GIMMICK_TRIGGERED, GIMMICK_RESOLVED)
**Event Types** (canonical):
- `GIMMICK_ARMED` payload: `{ gimmickId, slabId, objectiveId, telegraphTicks, gimmickClass, x, y }`
- `GIMMICK_TRIGGERED` payload: `{ gimmickId, slabId, gimmickClass, corridorWidthBefore, corridorWidthAfter, x, y }`
- `GIMMICK_RESOLVED` payload: `{ gimmickId, slabId, x, y }`
- gimmickClass: "deformation" | "gate" | "mirror" | "hazard"
- x, y: integer gameplay units (can be 0)

**Policy Entries** (`defense-audio.js`):
```javascript
GIMMICK_ARMED: feedbackPolicy("gimmick-telegraph", 64, "gimmick"),
GIMMICK_TRIGGERED: feedbackPolicy("gimmick-impact", 76, "gimmick"),
GIMMICK_RESOLVED: feedbackPolicy("gimmick-resolve", 42, "gimmick"),
```

**Cue Profiles** (`defense-audio.js`):
- `gimmick-telegraph`: ascending alert tone, duration = `telegraphTicks` / 60 seconds, branches by gimmickClass
- `gimmick-impact`: impact thump (sawtooth 140–80Hz sweep, 200ms), correlates to width delta
- `gimmick-resolve`: resonant decay (sine 60Hz, 400ms)

**VFX Prerequisite**: effectAnchor() must accept event-level `x`, `y` for spatial events (PR-1, owned by renderer)

### Adding Pacing Block Transitions (Director-ruled: PACING_BLOCK_STARTED, PACING_BLOCK_CLEARED)
**Event Types** (canonical):
- `PACING_BLOCK_STARTED` payload: `{ blockId, objectiveId, waveSlots }`
  - blockId: "ingress" | "objective-1" | "objective-2" | "midboss" | "occupation" | "boss" | "extraction" | "resolution"
- `PACING_BLOCK_CLEARED` payload: `{ blockId, objectiveId, recoveryTicks }`

**Policy Entries** (`defense-audio.js`):
```javascript
PACING_BLOCK_STARTED: feedbackPolicy("block-start", 62, "pacing"),
PACING_BLOCK_CLEARED: feedbackPolicy("block-clear", 68, "pacing"),
```

**Cue Profiles** (`defense-audio.js`):
- `block-start`: context-aware (ingress=fanfare, objective=tense, midboss=roar, boss=epic, extraction=ascent)
- `block-clear`: victory flourish, duration/pitch varies with block tier

### Adding Enemy Spawn Audio (Director-ruled: ENEMY_SPAWNED)
**Event Type** (canonical):
- `ENEMY_SPAWNED` payload: `{ enemyId, kind, grade, elite, midboss, x, y, slabId, telegraphTicks }`
  - grade: "BASIC" | "SHADOW" | "BOSS" (derived at emit from elite/midboss booleans; presentation reads grade ONLY)

**Current Status**: Mapped to `silentPolicy("enemy-spawn")` — audio disabled (no variant cues yet)

**Note**: MIDBOSS_SPAWNED (:758) stays for compatibility but is audio-ignored; use ENEMY_SPAWNED with grade: "SHADOW" instead

**Extension Pattern**:
```javascript
// In DefenseAudio.consume(), dispatch to grade-specific cue:
if (event.type === "ENEMY_SPAWNED") {
  const cueId = {
    "BASIC": "enemy-spawn-basic",
    "SHADOW": "enemy-spawn-shadow",
    "BOSS": "enemy-spawn-boss",
  }[event.grade];
  this.play(cueId, event);
}
```

**Cue Profiles** (`defense-audio.js`):
- `enemy-spawn-basic`: low beep (sine 160Hz, 80ms)
- `enemy-spawn-shadow`: mid alert (triangle 220Hz, 120ms)
- `enemy-spawn-boss`: roar (sawtooth 80–120Hz sweep, 300ms), priority 82

---

## Risks & Constraints

### Determinism
- All synthesis is deterministic (seed-based frequency generation)
- No randomness except TTS voice selection (offline, no network call)
- Soundscape pitch modulation is fully derived from state machine
- **Risk**: Any Web Audio timing variance could desync audio from simulation state

### Voice Contention
- Max 12 simultaneous voices means high-frequency events compete
- Priority system disambiguates, but rapid sequences may queue
- **Risk**: Long narration blocks (MAX_STORY_NARRATION_CHARS = 96, TTS ~1.2s/word) may starve movement/combat feedback

### Renderer PR-1 Prerequisite
- DROP_SPAWNED, BUFF_*, GIMMICK_* events carry spatial fields that VFX renderer does not yet accept
- All cues marked "no visual until PR-1" are audio-only until effectAnchor() lands
- Audio will fire correctly; VFX will silently no-op
- Three required renderer changes (PR-1a/b/c) are additive and preserve byte-identical existing behavior

### Movement Audio Dead Code
- Movement-step profiles are authored but unreachable due to `silentPolicy("movement")` override
- Un-shadowing is one-line change (AudioFeedbackDesign owns)

### Browser Audio Compatibility
- Safari: `.webkitAudioContext` fallback required (not visible in current code; may be in Web Audio polyfill)
- iOS: GestureRecognizer audio unlock needed (play silent buffer on first user gesture before audio unmute)
- **Risk**: muted audio on iOS until first interaction

### No HTML5 Audio Element Fallback
- Entirely Web Audio API (OscillatorNode / AnalyserNode)
- No `<audio>` tag, no preload strategy
- **Risk**: Memory accumulation if synthesis nodes not garbage-collected after drain

---

## Verification Checklist

- [x] Movement control surface complete: 5 buttons, joystick, keyboard mappings, gating conditions
- [x] HUD structure: command decks, panels, layer ordering
- [x] CSS token system: safe-area, custom properties, chromatic palette
- [x] Screen model: lobby vs battle, tab switching, overlay stacking
- [x] Audio event registry: 50+ event IDs including all director-ruled canonical types (SCREAMING_SNAKE_CASE)
- [x] Audio triggering: render loop → consume → play/narrate
- [x] BGM: soundscape system with state transitions, procedural layers
- [x] Accessibility: portrait mode, safe-area insets, reduced-motion, 44×44 touch targets, ARIA labels
- [x] No sample playback (all procedural synthesis)
- [x] Extension points documented for all director-ruled event types (v1, v2, v3 consolidated)
- [x] Buff stat enum finalized (7 values with `Bp` units and `gate` target prefix)
- [x] Tick field names standardized (appliedAtTick, expiresAtTick, durationTicks)
- [x] Movement audio dead-code finding documented with un-shadowing solution
- [x] Renderer PR-1 prerequisite documented with three additive changes
- [x] One-concept-one-name principle documented (no translation maps between lanes)
