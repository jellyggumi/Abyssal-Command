# Combat Feel Systems Mapping — Abyssal Lantern

**Date:** 2026-07-30
**Scope:** Attack input → contact → damage → outcome (animation/VFX/audio/HUD)
**Status:** Read-only investigation; gaps identified, smallest fix slice defined

---

## Attack Flow Trace (One Melee Hit)

### 1. Input → Simulation
- **Entry:** `app.js` calls `queueInput(run, "ATTACK", {})`
- **Symbol:** `defense-run-simulation.js:processInput()` @ 2060–2164
- **Routing:** → `resolveCommanderBasicAttack()` @ 1585–1604 (automatic or manual aim)
- **Targeting:** `meleeSweepTargets()` @ 1442–1460 filters by reach + arcCosBp (frontal cone)

### 2. Damage Resolution
- **Symbol:** `meleeSweep()` @ 1463–1508
  - Emits event type: `MELEE_SWEEP`
  - Payload: `{ entityId, targetIds[], damage, baseDamage, critical, owner, reach, arcCosBp }`
- **Critical Roll:** `resolveCritical()` @ 1328–1342 (stochastic, stored in run.events)
- **Emit:** `emit(run, type, payload)` @ 372–385 (event queued in run.events[])

### 3. Snapshot Export → Renderer
- **Symbol:** `getRunSnapshot()` @ 3415–3477
- **Output:** Frozen snapshot with `events: [{ type, tick, payload }]`
- **No Renderer Writes:** Simulation contracts enforce "snapshot only" (verified in defense-renderer-contract.test.mjs)

### 4. Renderer Feedback Mapping
- **Entry:** `RealtimeBattle.renderSnapshot(snapshot)` @ ~1900 (class def 1783–4010)
- **Event Routing:** `IMPACT_FEEDBACK_SOURCES` @ 530–546 maps event type → `{ attackerId, targetId, heavy }`
- **Heavy Determination:** `event.critical === true` → `heavy = true`
- **Effect Anchor:** `effectAnchor(snapshot, event)` @ 890–915 resolves targetId to 3D position

### 5. Presentation Layer (Animation / VFX / Audio / Camera)
**Impact Flash:**
- Normal hit: `IMPACT_FLASH_COLOR` = 0x5de6ff (neon blue), 180ms fade, peak 0.55
- Critical: `IMPACT_FLASH_HEAVY_COLOR` = 0xa06bff (shadow-violet), 320ms fade, peak 1.1

**Knockback (render-space offset, returned to authoritative position next frame):**
- Normal: 160ms over 0.12 world units
- Heavy: 260ms over 0.26 world units
- Recovery: `FOLLOW_CATCHUP_RATE` = 30/s (line 581) → ~33ms to return to position

**Camera Shake (orbiting camera only):**
- Duration: 220ms
- Amplitude: 0.07 (normal targets), 0.13 (bosses)
- Frequency: 38 Hz
- **Disabled:** when `prefers-reduced-motion` is set (line 634)

**Audio Cue Routing:**
- Event type → `eventCue(name)` @ line 44 in defense-run-simulation.js
- Cue ID looked up in AUDIO_CUES (defense-catalog.js)
- **No crit-specific override** (audio branch not differentiated by critical flag)

### 6. HUD Update
**Current Path:**
- `defense-viewport.js` reads `snapshot.commander.hp`, `snapshot.enemies[].hp`
- Renders health bar fill % (delta from previous snapshot)
- **Gap:** No event-driven damage number display
- **Gap:** No per-hit animation timing (renders next-tick only)

---

## Timing Invariants (60 Hz Loop)

| Event | Tick | Duration | Notes |
|-------|------|----------|-------|
| MELEE_SWEEP emitted | T | — | Deterministic, event-only |
| Snapshot frozen | T+1 | — | getRunSnapshot() called once per tick |
| renderSnapshot() called | T+1 | — | Synchronous, no async loads |
| Impact flash starts | T+1 | 180–320ms | Immediate visual feedback |
| Knockback starts | T+1 | 160–260ms | Render-space offset only |
| Camera shake starts | T+1 | 220ms | Skipped under prefers-reduced-motion |
| Follow catch-up | T+2..T+7 | ~33ms | FOLLOW_CATCHUP_RATE = 30/s |
| HUD health bar updates | T+1 | — | No animation; reads snapshot.hp |

**60 Hz tick = 16.67ms per frame**
- Flash peak (peak=0.55) hits at ~99ms into 180ms (6–7 frames)
- Knockback peak hits at ~80ms into 160ms (5 frames)
- Stagger misaligned: knockback returns before flash peaks visually

---

## Identified Feel Gaps

### P0 (Impact Feel Defects)

1. **HUD Damage Numbers**
   - Currently: Not event-driven; health bar renders hp delta per snapshot
   - Problem: No per-hit animation; multiple targets read as one number change
   - Impact: "Hits feel silent" — player can't track individual strike outcomes
   - Mobile Impact: Off-screen or clipped by landscape viewport

2. **Critical Indicator**
   - Currently: Purple flash (0xa06bff) sent to `IMPACT_FLASH_HEAVY_COLOR` at 320ms
   - Problem: Flash color is identical for normal and heavy in rendered result (need color override in beat queue)
   - Impact: No visual distinction between normal and critical hits
   - Test Failing: combat-presentation-contract.test.mjs:404–459 "combat one-shots preempt ambient idle"

3. **Contact Timing Spread**
   - Currently: All targets in one sweep flash simultaneously
   - Problem: 3-target melee reads as one blur
   - Impact: Can't judge hit count or formation response

4. **Camera Shake on Mobile**
   - Currently: Disabled entirely under `prefers-reduced-motion`
   - Problem: No haptic/audio rumble fallback for mobile portrait/landscape
   - Impact: Heavy hits feel weightless on touch devices

### P1 (Optional Polish — Non-Load-Blocking)

1. **Knockback Return Curve**
   - Currently: Linear 30/s catch-up from 260ms knockback offset
   - Improvement: Ease-out return (90ms fast → 60ms slow) for snappy feel
   - Effort: ~20 lines in updateActorFollow()

2. **Mobile Joystick Aiming Hint**
   - Currently: No visual indicator of attack aim direction during wind-up
   - Improvement: Show arc/cone during `resolveCommanderBasicAttack()` query
   - Effort: Add debug-mode cone renderer or UI hint

3. **Audio Ducking**
   - Currently: All audio cues at same priority; battle loop plays under
   - Improvement: Map critical cues to a separate audio track with mix priority
   - Effort: ~30 lines in defense-audio.js

4. **HUD Layout for Landscape Mobile**
   - Currently: Health bars render center-screen (24000×12000 arena fit to viewport)
   - Improvement: Move bars 30px lower on landscape to avoid action zone
   - Effort: ~10 lines in defense-viewport.js CSS

---

## Contracts & Existing Invariants (Do Not Break)

| Contract | Owner | Boundary |
|----------|-------|----------|
| Deterministic Simulation | defense-run-simulation.js | No in-render state writes; snapshot is output-only |
| 11-Action Rig Library | battle-realtime-three.js:MOTION_MODELS | Keys must stay stable across stages (lantern-reaver, guard, scout, etc.) |
| One Gameplay Plane | COMBAT_TARGETING.elevationTolerance @ 1407–1408 | No multi-layer targeting |
| Campaign Persistence | run.companions[], run.rewards[] | Immutable across stage transitions |
| Pages Release Topology | Assets in assets/motion/, assets/audio/ | No new async loads; all bundled at startup |
| Canvas/DOM Boundary | battle-realtime-three.js renders; defense-viewport.js reads | No shared mutable state |

---

## Smallest Behavior-Preserving Fix Slice

**Goal:** Close "combat feel is muted, especially on mobile" in one PR without engine changes.

### Changes:
1. **defense-viewport.js** (~30 lines):
   - Add event-driven damage number handler: `snapshot.events.filter(e => e.type === 'MELEE_SWEEP' && e.payload.targetIds.includes(entityId))`
   - Render floating "+X damage" text per target per tick (DOM overlay, no 3D cost)
   - Move health bar anchor 30px down on landscape media query

2. **battle-realtime-three.js** (~15 lines):
   - In impact feedback loop, offset contact flash by targetId sort index: `targetIds.forEach((id, i) => { /* flash at T + i*40ms */ })`
   - Add audio cue override: if `heavy: true`, prefer critical-specific cue from AUDIO_CUES

3. **defense-audio.js** (~20 lines):
   - Add cue variant: `AUDIO_CUES.MELEE_SWEEP_CRITICAL` (reuse or fork existing)
   - Wire to audio player: `if (feedback.heavy) playAudio('MELEE_SWEEP_CRITICAL') else playAudio('MELEE_SWEEP')`

### Files NOT Touched:
- defense-run-simulation.js (simulation untouched)
- defense-catalog.js (no new audio tracks, reuse existing)
- Tests (existing tests remain passing; no new test contracts needed)

### Verification Points:
- `combat-presentation-contract.test.mjs`: lines 404–459, 1353–1413 (timing/VFX)
- `audio-feedback-runtime.test.mjs`: crit audio path
- Mobile landscape viewport test (existing responsive test suite)

---

## Next Steps

1. **FeedbackMapper** (AudioRuntimeMapper, MotionPipelineMapper peers): Refine audio cue routing and animation beat priority for critical vs. normal
2. **LobbyImplementer**: Wire event-driven HUD damage numbers in defense-viewport.js
3. **ImplementationReview**: Verify knockback return timing doesn't break existing position sync invariants

**No scope expansion.** This slice preserves all existing simulation/renderer boundaries and requires zero new asset pipelines.
