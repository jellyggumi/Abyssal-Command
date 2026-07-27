# Combat Motion FSM Specification — Anime-Combat State Mapping

run-id: `20260726-stage1b-cinder-pressure-agency`  
owner: engineering / combat-motion design  
scope: map anime-combat FSM research onto actual Abyssal Surge combat code  
labels: **[OBSERVED]** = measured in source/runtime; **[INFERENCE]** = derived from code structure; **[TARGET]** = proposed implementation, not current

---

## 1. Combat State Table — Tick/Frame Units

**[OBSERVED]** Simulation tick rate: **60 Hz** (`defense-catalog.js:11` `TICK_RATE = 60`)  
**[OBSERVED]** 1 frame in 30fps anime timing = 2 simulation ticks at 60 Hz  
**[INFERENCE]** Anime reference frames must be doubled for 60 Hz implementation

### Base Attack Cycle — Commander Example

**[OBSERVED]** Commander baseline: `COMMANDER.basicCooldown = 24` ticks (`defense-catalog.js:22`)  
**[OBSERVED]** Attack executes immediately when `cooldown <= 0` (`defense-run-simulation.js:814-823`)  
**[TARGET]** Proposed anime FSM mapping onto 24-tick window:

| State | Anime Frames (30fps) | Sim Ticks (60Hz) | Tick Range | Purpose |
|-------|---------------------|------------------|------------|---------|
| **Idle** | continuous | continuous | — | Target acquisition loop, breathing idle |
| **Pre-Attack (Windup)** | f1-6 (0.2s) | 1-12 ticks | t0 to t11 | Anticipation: weight shift, weapon draw-back, squash preparation |
| **Active (Hit Frame)** | f7-9 (0.1s) | 13-18 ticks | t12 to t17 | Release: fastest motion arc, hitbox active, contact frame |
| **Hit-Stop** | 1-5 frames | 2-10 ticks | t18 to t22 | Freeze on contact (both attacker and target), impact emphasis |
| **Recovery** | f10-20 (0.33s) | 19-40 ticks | t18 to end | Follow-through: arc completion, return to guard, settle |
| **Combo-Link Window** | f15-20 (overlap) | 30-40 ticks | t29 to end | Cancel window for input-chained next attack |

**[INFERENCE]** Current simulation fires projectile instantly at tick boundary; **[TARGET]** anime states require:
- **Simulation authority**: when damage resolves (hit-frame tick), hit-stop duration (affects movement/next-attack timing)
- **Presentation-only**: anticipation/follow-through arcs, smear meshes, VFX timing keys

---

## 2. State Mapping to Existing Simulation Functions

### 2.1 Current Auto-Attack Flow

**[OBSERVED]** Companions (`defense-run-simulation.js:812-826`, lines 812-826):
```javascript
companion.cooldown -= 1;
if (companion.cooldown <= 0) {
  if (target) {
    fire(run, companion, target, damage, ...);  // ← instant projectile spawn
  }
  companion.cooldown = companion.fireTicks;  // ← reset cooldown
}
```

**[OBSERVED]** Commander basic attack (implicit in `tick()` damage loop, not shown as dedicated function)  
**[OBSERVED]** `fire()` function (`defense-run-simulation.js:844-886`) creates projectile actor with `ttl=5` ticks  
**[INFERENCE]** No windup, no recovery phase — attack happens on a single tick boundary when cooldown expires

### 2.2 Target FSM Integration Points

**[TARGET]** To implement anime combat FSM, add per-actor state tracking:

| Simulation State | Where to Store | Authority | Hook Location |
|-----------------|----------------|-----------|---------------|
| `combatState` | `run.commander.combatState` / `companion.combatState` | **Simulation** | Initialize in `actor()` (`defense-run-simulation.js:37`) |
| `combatStateTick` | same | **Simulation** | Track state entry tick for duration |
| `windupTarget` | same | **Simulation** | Lock target during windup (prevent retargeting mid-swing) |
| `hitStopRemaining` | same | **Simulation** | Tick countdown, blocks movement/attack |

**[INFERENCE]** States that affect **damage resolution timing** or **movement blocking** MUST live in simulation  
**[INFERENCE]** States that only affect **visual arc/timing** MAY live presentation-side (renderer `AnimationMixer` state)

### 2.3 Required Simulation Hooks (Deterministic Boundary)

**[TARGET]** Add to `defense-run-simulation.js` (line ranges approximate, insertion points):

#### 2.3.1 State Machine Update (`tick()` loop, ~line 1500)
```javascript
// AFTER movement update, BEFORE damage resolution
function updateCombatStates(run) {
  [run.commander, ...run.companions, ...run.enemies].forEach(actor => {
    if (!actor.combatState) return;
    if (actor.hitStopRemaining > 0) {
      actor.hitStopRemaining -= 1;
      return; // freeze: no state advance, no movement, no attack
    }
    const elapsed = run.tick - actor.combatStateTick;
    // State transitions based on elapsed ticks and FSM table
    // emit COMBAT_STATE_CHANGED event for renderer observation
  });
}
```
**[OBSERVED]** Current `tick()` is at `defense-run-simulation.js:1460-1920`  
**[TARGET]** Insert `updateCombatStates(run)` before damage/projectile update (~line 1604)

#### 2.3.2 Windup-Gated Attack (`fire()` replacement, ~line 844)
**[OBSERVED]** Current `fire()` creates projectile immediately  
**[TARGET]** Replace with:
```javascript
function beginAttack(run, source, target, damage, owner) {
  source.combatState = "WINDUP";
  source.combatStateTick = run.tick;
  source.windupTarget = target;  // lock target
  source.pendingDamage = damage;
  source.pendingOwner = owner;
  emit(run, "ATTACK_WINDUP_START", { entityId: source.id, targetId: target.id });
}
function resolveHitFrame(run, source) {
  // Called when combatState advances WINDUP -> ACTIVE at hit-frame tick
  const target = source.windupTarget;
  const damage = source.pendingDamage;
  fire(run, source, target, damage, source.pendingOwner, 5);  // existing fire()
  source.combatState = "HITSTOP";
  source.hitStopRemaining = calculateHitStop(damage, target);  // 2-10 ticks
  if (target) target.hitStopRemaining = source.hitStopRemaining;  // freeze target too
}
```

**[INFERENCE]** This preserves deterministic damage timing while adding anime motion phases  
**[TARGET]** Existing `companion.cooldown` countdown continues unchanged; state machine runs in parallel

#### 2.3.3 Movement Blocking During Combat States
**[OBSERVED]** Commander movement: `defense-run-simulation.js:1465-1499` (processInput MOVE)  
**[OBSERVED]** Companion movement: `defense-run-simulation.js:787-826` (updateCompanions)  
**[TARGET]** Add guard at movement entry points:
```javascript
if (entity.hitStopRemaining > 0 || ["WINDUP", "ACTIVE", "RECOVERY"].includes(entity.combatState)) {
  return; // block movement during attack commitment
}
```

**[OBSERVED]** Current system allows movement every tick; **[INFERENCE]** anime combat requires commitment window

---

## 3. Presentation-Side State Observation (Renderer-Only)

**[OBSERVED]** Renderer contract: `battle-realtime-three.js:793-923` `renderSnapshot()` reads frozen snapshot, never writes back  
**[OBSERVED]** `AnimationMixer` drives clips at `battle-realtime-three.js:1508-1675`  
**[TARGET]** Renderer observes `COMBAT_STATE_CHANGED` / `ATTACK_WINDUP_START` / `WEAPON_FIRED` events to:

1. **Clip selection**: switch `idle → attack → critical → recovery_pose → idle`
2. **Smear mesh spawn**: create procedural trail geometry during ACTIVE state (frame 13-18)
3. **VFX timing**: spawn slash/impact VFX at hit-frame tick, not windup start
4. **Camera shake**: trigger on hit-frame resolve, intensity scaled by damage
5. **Trail VFX lifespan**: persist 6-12 ticks (0.1-0.2s) after hit-frame

**[INFERENCE]** These are **presentation hints** reading authoritative simulation state, never overriding it  
**[OBSERVED]** Existing VFX system: `battle-realtime-three.js:210-258` `VFX_MODELS`, lifetime tracked presentation-side

---

## 4. Cartoon Motion Authoring Rules — Blender Clip Integration

**[OBSERVED]** Clip library: `scripts/author-wholebody-clips-blender.py:118-133` defines 13 action keys  
**[OBSERVED]** Canonical clips: `idle, move, run, hit, bighit, attack, critical, avoid, defence, die, show, attack_melee, attack_ranged`  
**[TARGET]** Extend clip set with anime combat phases:

| New Clip Name | Duration | Keyframe Density | Authoring Notes |
|--------------|----------|------------------|-----------------|
| `attack_windup` | 12 ticks (0.2s) | 6-8 poses | Squash & anticipation: weight shift back, weapon draw |
| `attack_active` | 6 ticks (0.1s) | 3-4 poses | Fastest arc: stretch into contact, smear layer |
| `attack_recovery` | 12 ticks (0.2s) | 5-7 poses | Follow-through: settle, slow-in ease back to guard |
| `critical_windup` | 18 ticks (0.3s) | 8-10 poses | Exaggerated anticipation for big hit |
| `critical_recovery` | 18 ticks (0.3s) | 7-9 poses | Overshoot and settle |

**[OBSERVED]** Existing amplitude control: `author-wholebody-clips-blender.py:119-133` `CLIP_AMPLITUDE` dict  
**[TARGET]** Add entries:
```python
CLIP_AMPLITUDE = {
    # ... existing ...
    "attack_windup": 18.0,
    "attack_active": 24.0,   # highest amplitude for fastest arc
    "attack_recovery": 14.0,
    "critical_windup": 22.0,
    "critical_recovery": 20.0,
}
```

### 4.1 Anime Principles — Whole-Body Coordination

**[OBSERVED]** Wholebody motion system: `author-wholebody-clips-blender.py:136-364` pose functions `_gait`, `_strike`, `_recoil`, etc.  
**[TARGET]** Extend with anime-specific pose generators:

#### Squash (Anticipation Phase)
```python
def _squash(amp: float, env: float) -> dict[str, tuple[float, float, float]]:
    """Crouch and coil: sink into legs, pull weapon back, compress spine."""
    return {
        "thigh.L": (-amp * 0.60 * env, 0.0, 0.0),
        "thigh.R": (-amp * 0.60 * env, 0.0, 0.0),
        "shin.L": (amp * 0.80 * env, 0.0, 0.0),
        "shin.R": (amp * 0.80 * env, 0.0, 0.0),
        "spine": (amp * 0.40 * env, 0.0, -amp * 0.30 * env),  # twist back
        "upper_arm.R": (-amp * 1.20 * env, 0.0, -amp * 0.50 * env),  # draw weapon
        "pelvis.L": (amp * 0.20 * env, 0.0, 0.0),
    }
```

#### Stretch (Active/Release Phase)
```python
def _stretch(amp: float, env: float) -> dict[str, tuple[float, float, float]]:
    """Extend into strike: drive from back foot, unfold spine, extend arm."""
    return {
        "thigh.R": (-amp * 0.80 * env, 0.0, 0.0),  # push off back leg
        "toe.R": (amp * 0.90 * env, 0.0, 0.0),
        "spine": (-amp * 0.30 * env, 0.0, amp * 0.40 * env),  # untwist forward
        "upper_arm.R": (amp * 1.50 * env, 0.0, amp * 0.40 * env),  # extend strike
        "forearm.R": (amp * 0.80 * env, 0.0, 0.0),
    }
```

**[OBSERVED]** Existing `pose_for()` at line 337 dispatches by clip name  
**[TARGET]** Add branches for new clips, compose squash → stretch → settle sequence

### 4.2 Smear Mesh Generation (Presentation-Side Procedural)

**[TARGET]** Renderer-side smear logic (NOT in Blender clips):
- **When**: ACTIVE state (tick 13-18), fastest motion arc
- **Geometry**: Extruded mesh along weapon's bone-tip trajectory over last 3-4 ticks
- **Material**: Additive blend, alpha gradient fade tail-to-tip
- **Lifespan**: 6 ticks (0.1s) after creation
- **Reference**: `battle-realtime-three.js:273-278` `COMBAT_PRESENTATION_MODELS.melee.effects` already lists `vfx/melee-slash.glb`

**[INFERENCE]** Smear is presentation candy reading simulation velocity, never affecting damage/hitbox

### 4.3 Spacing & Easing

**[OBSERVED]** Current `pose_for()` envelope: `author-wholebody-clips-blender.py:352` uses `sin(t * pi * 0.5)` for one-shot clips  
**[TARGET]** Replace with anime-style ease curve:

```python
def anime_ease(t: float, phase: str) -> float:
    """Non-linear spacing: slow anticipation, fast release, slow settle."""
    if phase == "windup":
        return t * t  # ease-in quadratic (slow start)
    elif phase == "active":
        return 1.0 - (1.0 - t) ** 3  # ease-out cubic (explosive release)
    elif phase == "recovery":
        return 1.0 - (1.0 - t) ** 2  # ease-out quadratic (gradual settle)
    return t
```

**[TARGET]** Apply in `pose_for()` branches for new clips:
```python
if clip == "attack_windup":
    env = anime_ease(t, "windup")
    return _squash(amp, env)
elif clip == "attack_active":
    env = anime_ease(t, "active")
    return _stretch(amp, env)
```

---

## 5. Per-Archetype AI Motion-Generation Prompts

**[OBSERVED]** Equipment slots: `rpg-catalog.js:176` defines `["weapon", "ward", "trinket"]`  
**[OBSERVED]** No individual weapon types (dagger/gun/staff/orb); system uses **role archetypes** + **presentation families**  
**[OBSERVED]** Companion roles: `rpg-catalog.js:87-91` `COMPANION_ROLES = {vanguard, striker, support}`  
**[OBSERVED]** Combat presentation: `battle-realtime-three.js:271-278` `MELEE` vs `RANGED` families  
**[OBSERVED]** Enemy archetypes: `defense-catalog.js` (not shown) + `battle-realtime-three.js:142-147` `ENEMY_MODELS = {rusher, flanker, guardian, ranged}`

**[INFERENCE]** "Per-weapon prompts" map onto **role × presentation-family** matrix:

### 5.1 Melee Combat (Vanguard/Striker/Rusher/Flanker/Guardian)

**[TARGET]** AI motion prompt structure for Blender clip generation:

#### Vanguard (Tank/Guard)
```
Clip: attack_melee
Identity: Heavy defender, grounded stance
Windup (f1-6): Deep crouch, shield/ward raised, weight sinks into back leg
Active (f7-9): Upward shield bash or short forward thrust, minimal horizontal travel (holds position)
Recovery (f10-20): Return to guard stance, feet planted, shield forward
Spacing: Slow windup (ease-in), medium active, slow settle
Amplitude: Moderate (defensive posture, not overextended)
Lower-body: Continuous contact, knees flexed, stable base
```

#### Striker (Damage Dealer)
```
Clip: attack_melee
Identity: Aggressive forward combatant
Windup (f1-6): Sharp twist back, weapon drawn high/back, front foot lifts slightly
Active (f7-9): Explosive diagonal slash, full-body rotation, drive from back leg push-off
Recovery (f10-20): Wide follow-through arc, overshoot then settle, return to combat-ready
Spacing: Medium windup, VERY FAST active (ease-out cubic), gradual settle
Amplitude: High (maximum extension, largest strike arc)
Lower-body: Back leg extension generates power, front leg plants on contact
```

#### Rusher/Flanker (Fast Melee)
```
Clip: attack_melee
Identity: Mobile skirmisher
Windup (f1-4): Minimal (short commitment), lean into strike direction
Active (f5-7): Quick jab or swipe, body follows weapon
Recovery (f8-16): Fast return to mobile stance, ready to dodge
Spacing: Fast windup, instant active, fast settle (all ease-out)
Amplitude: Low-medium (speed over power)
Lower-body: Light on feet, weight shift not full commitment
```

#### Guardian (Elite Tank)
```
Clip: attack_melee
Identity: Immovable fortress
Windup (f1-8): VERY slow, methodical wind-back, grounded and heavy
Active (f9-12): Single massive overhead slam, vertical emphasis
Recovery (f13-24): Overshoot into ground, slow rise back to guard
Spacing: Extreme slow-in windup, medium active, slow settle (all quadratic ease)
Amplitude: Very high (largest model, biggest strike)
Lower-body: No jump/lift, pure weight-driven ground impact
```

### 5.2 Ranged Combat (Support/Ranged-Enemy)

**[OBSERVED]** Ranged presentation: `battle-realtime-three.js:274-277` weapon `arc-caster.glb`, effects `abyss-orb.glb, ranged-bolt.glb`

#### Support (Orb/Casting)
```
Clip: attack_ranged
Identity: Channeled energy caster
Windup (f1-8): Arms raise/extend, palms face target, orb materialization glow
Active (f9-12): Release pulse (hands push forward slightly), orb projectile spawns
Recovery (f13-20): Arms lower to neutral, settle breathing
Spacing: Slow windup (gather energy), instant active, medium settle
Amplitude: Low (minimal body motion, focus on hand/arm extension)
Lower-body: Stationary, slight weight shift forward on release
VFX note: Orb glow builds during windup (presentation-side particle system)
```

#### Ranged-Enemy (Gun/Crossbow/Arc-Caster)
```
Clip: attack_ranged
Identity: Aimed projectile attacker
Windup (f1-6): Weapon raise/aim, shoulder braces, sight alignment
Active (f7-9): Recoil snap (shoulder/torso jolt back), muzzle flash frame
Recovery (f10-18): Settle recoil, re-aim or lower weapon
Spacing: Medium windup (aim time), instant active (shot), fast settle (recoil absorption)
Amplitude: Medium (recoil emphasis on upper body, lower stable)
Lower-body: Braced stance, knees slightly bent, absorbs recoil
VFX note: Muzzle flash + bolt trail on active frame
```

### 5.3 Critical-Hit Motion Variants

**[OBSERVED]** Critical animation clip exists: `author-wholebody-clips-blender.py:128` `"critical": 18.0` amplitude  
**[TARGET]** Critical variants exaggerate ALL dimensions:

```
Critical melee (any role):
- Windup duration +50% (18 ticks vs 12)
- Anticipation exaggeration: crouch deeper, wind further back, hold pause 2-3 frames
- Active speed: SAME (or faster) — maintains snappy release contrast
- Recovery overshoot: weapon swing carries past target, full-body rotation, wide settle arc
- Spacing: Extreme slow-in windup with hold, explosive active, extended settle
- Amplitude: +30-50% over base attack

Critical ranged:
- Windup: Charging glow VFX builds over 18 ticks (presentation-side)
- Active: Larger projectile model, screen shake +50%
- Recovery: Arms/weapon snap back from recoil, settle slower
```

**[INFERENCE]** Critical state hooks into existing `resolveCritical()` at `defense-run-simulation.js:828-842`  
**[TARGET]** `COMBAT_STATE_CHANGED` event payload includes `{critical: true}` flag to select clip variant

---

## 6. Event-Key Sync Table — Frame-Accurate Timing

**[OBSERVED]** Event system: `defense-run-simulation.js:214-227` `emit()` function creates timestamped events  
**[OBSERVED]** Existing combat events: `WEAPON_FIRED`, `CRITICAL_HIT`, `ENEMY_ATTACK` (`defense-run-simulation.js:856-885`)  
**[TARGET]** New event keys for anime combat FSM:

| Event Type | Emission Tick | Payload | Presentation Trigger |
|------------|---------------|---------|---------------------|
| `ATTACK_WINDUP_START` | Tick 0 (cooldown expires) | `{entityId, targetId, windupDuration, attackType}` | Start windup clip, face target |
| `ATTACK_ANTICIPATION_HOLD` | Tick 8-10 (windup peak) | `{entityId}` | Hold squash pose 2-3 frames |
| `ATTACK_HIT_FRAME` | Tick 12 (active start) | `{entityId, targetId, damage}` | Hitbox activate, smear spawn, camera shake |
| `WEAPON_FIRED` | Tick 12 (same as hit-frame) | **existing event** | Projectile VFX spawn |
| `IMPACT_CONTACT` | Tick 13-14 (projectile hits) | `{projectileId, targetId, damage}` | Impact VFX, hit SFX, screen shake |
| `HITSTOP_START` | Tick 18 (after contact) | `{entityId, targetId, duration}` | Freeze both actors, flash frame |
| `HITSTOP_END` | Tick 18 + duration | `{entityId}` | Resume animation |
| `ATTACK_RECOVERY_START` | Tick 18 (hitstop end) | `{entityId}` | Play recovery clip, follow-through arc |
| `COMBO_WINDOW_OPEN` | Tick 30 | `{entityId}` | Allow input cancel (if implementing combos) |

**[OBSERVED]** Audio cues: `defense-catalog.js:162-184` `AUDIO_CUES` defines procedural waveforms  
**[TARGET]** Add combat SFX cues:
```javascript
export const AUDIO_CUES = freeze({
  // ... existing ...
  attackWindup: { id: "attack-windup", waveform: "triangle", frequency: 140, duration: 0.10 },
  hitImpact: { id: "hit-impact", waveform: "sawtooth", frequency: 95, duration: 0.08 },
  criticalCharge: { id: "critical-charge", waveform: "sine", frequency: 380, duration: 0.25 },
  // ...
});
```

### 6.1 VFX Spawn Timing (Presentation-Side)

**[OBSERVED]** VFX models: `battle-realtime-three.js:210-217` `VFX_MODELS` map event types to GLB paths  
**[OBSERVED]** VFX lifetime: `battle-realtime-three.js:251-258` tick-based duration  
**[TARGET]** Extend VFX table with combat motion keys:

| VFX Name | Spawn Event | Lifetime (ticks) | Notes |
|----------|-------------|------------------|-------|
| `melee-slash.glb` | `ATTACK_HIT_FRAME` (melee) | 12 ticks | Arc trail, follows weapon bone |
| `melee-impact.glb` | `IMPACT_CONTACT` | 18 ticks | Spark burst at contact point |
| `ranged-bolt.glb` | `WEAPON_FIRED` (ranged) | 30 ticks | Projectile flight (existing) |
| `critical-hit-burst.glb` | `CRITICAL_HIT` | 18 ticks | Radial burst (existing) |
| `hit-flash.glb` | `HITSTOP_START` | 6 ticks | White flash overlay at contact |

**[INFERENCE]** VFX are presentation decorations reading simulation events; lifespans tracked in renderer state, never in `getRunDigest()`

### 6.2 Screen Shake Intensity Mapping

**[TARGET]** Camera shake parameters keyed to damage/attack-type:

| Attack Type | Damage Threshold | Shake Amplitude | Frequency | Duration (ticks) |
|-------------|------------------|-----------------|-----------|------------------|
| Basic melee | Any | 0.02 units | 30 Hz | 6 ticks |
| Basic ranged | Any | 0.01 units | 20 Hz | 4 ticks |
| Critical | Any | 0.05 units | 40 Hz | 12 ticks |
| Boss attack | Any | 0.08 units | 25 Hz | 18 ticks |

**[OBSERVED]** Camera state is renderer-owned: `battle-realtime-three.js:822-833` camera position/rotation  
**[INFERENCE]** Shake is presentation effect reading `ATTACK_HIT_FRAME` event, modulates camera position additively  
**[TARGET]** Implement as damped sine wave: `offset = amplitude * sin(2π * frequency * t) * exp(-3t)`

---

## 7. Simulation vs Presentation Boundary — Implementation Checklist

**[OBSERVED]** Deterministic boundary: `defense-run-simulation.js:1964-2029` `getRunDigest()` hashes public snapshot state  
**[OBSERVED]** Renderer contract: `tests/defense-renderer-contract.test.mjs:196-275` proves renderers read-only  
**[INFERENCE]** Any state affecting **damage timing, movement blocking, or deterministic outcome** MUST be in simulation

### 7.1 MUST Live in Simulation (Affects `getRunDigest()`)

**[TARGET]** Add to `actor()` constructor (`defense-run-simulation.js:37`):
```javascript
const actor = (id, kind, x, y, hp, maxHp, extra = {}) => ({
  id, kind, x, y, elevation: 0, hp, maxHp,
  combatState: "IDLE",          // ← NEW: state machine
  combatStateTick: 0,            // ← NEW: entry tick
  hitStopRemaining: 0,           // ← NEW: freeze countdown
  windupTargetId: null,          // ← NEW: locked target ID
  pendingDamage: 0,              // ← NEW: damage to apply at hit-frame
  ...extra
});
```

**[TARGET]** Simulation events that MUST emit (affect observer state machine):
- `ATTACK_WINDUP_START` — locks target, starts state duration
- `ATTACK_HIT_FRAME` — resolves damage, spawns projectile
- `HITSTOP_START` / `HITSTOP_END` — blocks movement/next-attack
- `COMBAT_STATE_CHANGED` — general state transition (for instrumentation)

### 7.2 MAY Live Presentation-Side (Pure Visual)

**[TARGET]** Renderer-owned state (NOT in snapshot):
- Animation clip selection (`attack_windup` → `attack_active` → `attack_recovery`)
- `AnimationMixer.time` offset (sub-tick interpolation for 30fps clip playback at 60Hz sim)
- Smear mesh geometry/materials (procedural GPU buffer)
- VFX particle lifetimes (tracked in `VisualEffectInstance` array)
- Camera shake offset accumulator
- Trail VFX spawn/despawn (tied to VFX_LIFETIME_TICKS, not sim state)

**[INFERENCE]** Renderer reads `combatState` from snapshot, interprets it into visual presentation, but never writes it back  
**[OBSERVED]** Existing pattern: `battle-realtime-three.js:1508-1675` mixer updates from snapshot actors, never modifies `this.run`

### 7.3 Instrumentation Events (Observation-Only)

**[TARGET]** Export telemetry for motion QA (does NOT affect gameplay):
- `combatTransition` row: `{tick, entityId, fromState, toState, targetId, damage}`
- `hitFrameTiming` row: `{tick, entityId, windupDuration, hitStopDuration, totalCommitment}`
- `animationCoverage` row: `{clipName, playedFrames, expectedFrames, coverage%}`

**[INFERENCE]** These feed motion-quality reports, not balance tuning; replay digest unchanged

---

## 8. Open Implementation Risks

| Risk ID | Description | Mitigation |
|---------|-------------|-----------|
| **R1** | Adding windup/recovery states doubles effective attack cooldown if not carefully designed | **[TARGET]** Windup+active+recovery total MUST fit within existing `fireTicks` budget; e.g., 24-tick cooldown = 12 windup + 6 active + 6 recovery, NOT additive |
| **R2** | Hit-stop freeze affects movement responsiveness; too long feels unresponsive | **[TARGET]** Cap hit-stop at 10 ticks (0.17s) max; test with `tests/defense-survivor-browser.cjs` input latency measurement |
| **R3** | Deterministic replay breaks if smear/VFX affect gameplay (e.g., blocking projectiles) | **[OBSERVED]** Current contract: presentation never writes sim state; **[TARGET]** enforce via renderer-contract test extension |
| **R4** | Blender clip export at 30fps keyframes played at 60Hz sim introduces timing mismatch | **[TARGET]** Author clips at 60fps native, OR ensure clip `duration` in GLB matches tick budget exactly (12 ticks = 0.2s duration) |
| **R5** | Combo/cancel windows require input buffering not currently in `queueInput` | **[TARGET]** Phase 1: document state, no combo implementation; Phase 2: add `inputBuffer` queue if validated as necessary |

**[INFERENCE]** Smallest safe slice: implement windup → hit-frame → recovery state machine in simulation, hook presentation-side clip playback, defer combo/cancel mechanics to Phase 2

---

## 9. Verification Plan

**[TARGET]** Acceptance criteria for anime-combat FSM implementation:

| ID | Criterion | Evidence |
|----|-----------|----------|
| **V1** | Commander basic attack progresses `IDLE → WINDUP → ACTIVE → HITSTOP → RECOVERY → IDLE` in correct tick sequence | Simulation test asserting `combatState` transitions at t0, t12, t18, t24 |
| **V2** | Damage applies at hit-frame tick (t12), NOT at windup start (t0) | Deterministic test: target HP unchanged at t11, reduced at t12 |
| **V3** | Movement blocked during windup/active/hitstop, allowed during recovery | Input test: `MOVE` command rejected during t0-t18, accepted at t24 |
| **V4** | Two identical runs (same seed, inputs, RPG state) produce byte-identical `getRunDigest()` with FSM enabled | Extend `tests/defense-run-simulation-rpg.test.mjs:304-324` replay test |
| **V5** | Renderer observes `ATTACK_HIT_FRAME` event and spawns VFX at correct tick, never writes back to simulation | Renderer-contract test: mock event stream, verify VFX spawn without `run` mutation |
| **V6** | Blender-exported clips play back at correct duration (12-tick windup = 0.2s GLB clip duration) | QA probe: `scripts/qa-motion-probe.mjs` measures clip `durationSec` matches tick budget |
| **V7** | Critical-hit variant uses longer windup (18 ticks vs 12), preserves deterministic RNG draw order | Simulation test: critical flag from existing `resolveCritical()` selects correct state duration |

**[INFERENCE]** V1-V4 are simulation-layer correctness; V5-V7 are presentation-contract compliance

---

## 10. Summary — Mapped Execution Path

**[OBSERVED]** Current system: cooldown tick → instant projectile spawn → reset cooldown  
**[TARGET]** Anime FSM: cooldown tick → enter WINDUP (12t) → hit-frame damage (t12) → HITSTOP freeze (6t) → RECOVERY (6t) → IDLE

**[INFERENCE]** Implementation order:
1. Add `combatState` / `hitStopRemaining` fields to `actor()` (simulation)
2. Implement `updateCombatStates(run)` and `beginAttack()` / `resolveHitFrame()` (simulation)
3. Emit `ATTACK_WINDUP_START` / `ATTACK_HIT_FRAME` / `HITSTOP_START` events (simulation)
4. Hook renderer to observe events, select clips, spawn VFX (presentation)
5. Author new clips `attack_windup` / `attack_active` / `attack_recovery` in Blender (asset pipeline)
6. Extend `author-wholebody-clips-blender.py` with `_squash` / `_stretch` pose generators (asset pipeline)
7. Add smear mesh procedural generator in renderer (presentation)
8. Wire screen shake + audio cues to hit-frame event (presentation)

**[OBSERVED]** Grounding files read:
- `defense-run-simulation.js:1-2364` (simulation tick loop, auto-attack, event emission)
- `defense-catalog.js:1-200` (tick rate, cooldowns, audio cues)
- `battle-realtime-three.js:1-300` (renderer contract, VFX models, animation mixer)
- `rpg-catalog.js:1-400` (roles, equipment, no individual weapon types)
- `scripts/author-wholebody-clips-blender.py:1-656` (clip library, pose functions, amplitude control)
- `scripts/qa-motion-probe.mjs:1-189` (motion measurement, clip duration validation)
- `_workspace/20260726-stage1b-cinder-pressure-agency/engineering/current-core-loop-map-20260726.md:1-186` (combat flow, deterministic boundary, reachable inputs)

**[INFERENCE]** Spec bridges anime-combat research onto deterministic 60Hz defense-survivor simulation without breaking replay contract.
