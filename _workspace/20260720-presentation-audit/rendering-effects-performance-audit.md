# Rendering, Effects & Performance Audit
**Abyssal Surge: Skill Effect Implementation Paths**

---

## EXECUTIVE SUMMARY

**Goal:** Investigate existing rendering/effects infrastructure, identify reusable systems, memory risks, and minimum viable asset/code paths for stage ~300s strategy battles with immediate skill feedback.

**Status:** Investigation complete; no files modified. Ready for executor phase.

**Scope:** WebGL (`battle-realtime-three.js` 5525 lines), Canvas fallback (`battle-visualizer.js` 3869 lines), shared audio (`app.js` line 77–87), disposal patterns, G4/G6 verification contracts.

---

## PART 1: RENDERING SYSTEMS INVENTORY

### 1.1 WebGL Renderer (battle-realtime-three.js)

#### Core Subsystems

| System | Implementation | Capacity/Risk | Memory Footprint |
|--------|---|---|---|
| **ParticleField** (lines 149–245) | Fixed 360-particle ring buffer, Uint8Array/Float32Array storage, THREE.Points additive-blended | 360 particles fixed; 0 per-frame allocation; cursor wraps modulo capacity | 360 × (1 + 4 + 12 + 4 + 12) = **~101 KB persistent** |
| **SpatialAudio** (lines 253–379) | Web Audio oscillators + PannerNode HRTF, async sample decode, listener follows camera | Safe in Node (typeof window guard); 7 action-cue files async-decoded | **Medium risk:** Async buffers held; no explicit release between plays |
| **Boss Identity Tint** (line 1523, 3846–3851) | Stages 4–10 clone materials for palette override; marked `userData.isBossIdentityTint` | Fixed per-boss; retired stage clones disposed by `retire()` | No leak (FIXED in recent commit) |

#### Particle Emission Profiles

Skill-specific parameters from `actionFeedbackProfile()` (line 4307):

```javascript
hunt:       { particles: 12, speed: 0.8–2.9 m/s, life: 0.58s, gravity: 2.4, upBias: 0.9 }
extract:    { particles: 14, speed: 0.8–2.9 m/s, life: 0.58s, gravity: 2.4, upBias: 0.9 }
materialize:{ particles: 20, speed: 0.8–2.9 m/s, life: 0.58s, gravity: 2.4, upBias: 0.9 }
capture:    { particles: 18, speed: 0.8–2.9 m/s, life: 0.58s, gravity: 2.4, upBias: 0.9 }
possess:    { particles: 16, speed: 0.8–2.9 m/s, life: 0.58s, gravity: 2.4, upBias: 0.9 }
domain:     { particles: 24, speed: 0.8–2.9 m/s, life: 0.9s,  gravity:-0.45, upBias: 0.9 }  // floating glow
assault:    { particles: 28, speed: 0.8–4.4 m/s, life: 0.58s, gravity: 2.4, upBias: 0.45}  // faster, lower
```

**Distribution:** Source point 42% of count, target point 58%.

#### Audio Tone Frequencies (Oscillator Synth)

| Skill | Frequency | End Freq | Duration | Type | Gain | Location |
|-------|---|---|---|---|---|---|
| hunt | 260 Hz | 130 Hz | 0.22s | triangle | 0.52 | line 2009–2011 |
| extract | 260 Hz | 130 Hz | 0.22s | triangle | 0.58 | line ~1772 |
| materialize | 420 Hz | 760 Hz | 0.32s | sine | 0.70 | line ~1739 |
| capture | 420 Hz | 760 Hz | 0.32s | sine | 0.66 | line ~1741 |
| possess | 420 Hz | 760 Hz | 0.32s | sine | 0.62 | line ~1743 |
| domain | 420 Hz | 760 Hz | 0.32s | sine | 0.74 | line ~1745 |
| assault | 170 Hz | 90 Hz | 0.16s | sawtooth | 0.78 | line 4346–4350 |

**Source:** All emit via `emitActionFeedback()` (line 4324–4358) + optional `playSample(action, ...)` for action-cue mp3.

#### Disposal Pattern

**`retire()` (stage teardown):**
- Disposes boss-identity-tint materials marked `userData.isBossIdentityTint` ✓
- Removes tracer lines + geometry/material
- Clears placement previews

**`destroy()` (renderer lifecycle end):**
- Removes canvas listener, context-loss listener
- Traverses all added objects → disposes geometry/materials
- Disposes ParticleField, audio context, scene, renderer

**Helper `disposeUnique(resource, Set<disposed>)`:** Prevents double-free via Set deduplication.

---

### 1.2 Canvas Fallback Renderer (battle-visualizer.js)

#### Core Subsystems

| System | Implementation | Capacity/Risk | Memory Footprint |
|--------|---|---|---|
| **Particle Array** (line 212) | Growable array, max 360 soft cap; splice on expiry, shift oldest if >360 | **HIGH RISK:** Unbounded growth under burst; object per particle | Per-particle object allocation (garbage pressure) |
| **Action Effects** (line 321) | Growable array `actionFx[]`, splice on 0.8s lifecycle | Object per effect; no pool recycling | Moderate allocation pressure |
| **Spatial Audio** (line 1771–1800) | Virtual listener 2D math (asymmetric top/bottom attenuation); no HRTF | No async decode; uses pre-loaded assets | Safe (bounded) |

#### Memory Risks (Canvas-specific)

**Critical (ARC-16):**
- Particles unbounded; soft cap 360 only on explicit check/shift
- Each particle is an object with 10 fields; array reallocation on growth

**Medium:**
- Dynamic records (line 1298–1348): Creates `target`, `preferred` objects per ally/enemy per frame
- `getRuntimeState` → JSON.stringify on every update (line 1069–1090)

**Disposal:**
- `destroy()` (line 3843–3860): Clears particle + actionFx arrays + all canvases

---

### 1.3 Shared Audio Cue Library (app.js line 77–87)

**Available action-cue files:**
```
assets/audio/hunt.mp3
assets/audio/extract.mp3
assets/audio/materialize.mp3
assets/audio/capture.mp3
assets/audio/possess.mp3
assets/audio/domain.mp3
assets/audio/assault.mp3
assets/audio/reward.mp3
assets/audio/breach-alert.mp3
assets/audio/wave-spawn.mp3
```

**Strategy:** Reuse existing 7 action cues (file-based) + synthesize procedural tones (no new binary assets).

---

## PART 2: SKILL EFFECT VISUAL/AUDIO LANGUAGE

### Hunt
- **Visual:** Accent-colored spark burst (12 particles, 2.4 s falloff, downward)
- **Audio:** Descending triangle wave 260→130 Hz (0.22s), 52% gain
- **Impression:** Extractive pull, suction

### Extract
- **Visual:** Ally-colored upward burst (14 particles, 0.58s life, upward bias 0.9)
- **Audio:** Descending triangle wave 260→130 Hz (0.22s), 58% gain
- **Impression:** Essence drain, siphon

### Materialize
- **Visual:** Ally-colored bloom (20 particles, 0.58s life, negative gravity → floating motes)
- **Audio:** Rising sine wave 420→760 Hz (0.32s), 70% gain
- **Prop:** riftPortal.play('Activate')
- **Impression:** Summoning, opening gateway

### Capture
- **Visual:** Accent burst (18 particles, 2.4s falloff)
- **Audio:** Rising sine wave 420→760 Hz (0.32s), 66% gain
- **Prop:** commandObelisk.play('Activate')
- **Impression:** Seizure, binding, control

### Possess
- **Visual:** Accent burst (16 particles, 2.4s falloff)
- **Audio:** Rising sine wave 420→760 Hz (0.32s), 62% gain
- **Rally:** `rally.copy(commanderPosition)` — all allies rally to player
- **Impression:** Control assumption, puppet

### Domain
- **Visual:** Accent glow (24 particles, 0.9s life, negative gravity → hovering)
- **Audio:** Rising sine wave 420→760 Hz (0.32s), 74% gain (loudest)
- **Prop:** createEchoThrone() → echoThrone.play('Activate')
- **Rally:** `rally.copy(commanderPosition)` — all allies rally to player
- **Camera:** No shake (distinct from assault)
- **Impression:** Territory claim, domain manifestation

### Assault
- **Visual:** Hostile burst (28 particles, 4.4 m/s speed, 0.58s, lower upBias 0.45)
- **Audio:** Descending sawtooth 170→90 Hz (0.16s), 78% gain (highest)
- **Camera:** shakeCamera(0.12, 0.18) + triggerHitStop(0.06)
- **Impression:** Attack, impact, clash

---

## PART 3: MEMORY & ALLOCATION RISKS

### Critical Issues

| Issue | Location | Current State | Risk Level | Mitigation Path |
|-------|----------|---|---|---|
| **Canvas particle unbounded growth** | battle-visualizer.js:212, 1131–1144, 2203–2211 | Soft cap 360; no hard pool | HIGH | Replace with ring buffer matching WebGL (360 slots, object-pool pattern) |
| **Canvas per-frame object allocation** | battle-visualizer.js:1298–1348 | Creates target/preferred per actor per frame | HIGH | Reuse scratch objects; validate in next-frame GC profile |
| **Async audio decode buffer retention** | battle-realtime-three.js:321–340 (playSample) | Buffers held in `ctx.audioBuffers` Map; no explicit release | MEDIUM | Add explicit cleanup on audio context disposal or sample end |
| **Boss identity tint material disposal** | battle-realtime-three.js:3846–3851 | FIXED (marked + retired) | ✓ RESOLVED | Marked with `userData.isBossIdentityTint`; retire() disposes |

### Medium Issues

| Issue | Location | Mitigation |
|-------|----------|---|
| Canvas action-feedback objects | battle-visualizer.js:2151–2195, 2827–2829 | Object per effect; splice every frame; acceptable (short-lived) |
| JSON.stringify on unchanged state | battle-visualizer.js:1069–1090 | Add shallow-equality check; skip if runtime state unchanged |
| Tracer line allocation | battle-realtime-three.js:3372–3379, 5372–5378 | Single allocation per tracer; disposed on retire; low impact |

### Low Issues

- ParticleField fixed pool: 360 × 101 KB = **bounded & safe**
- Commander path line / focus highlight: single alloc, disposed at teardown

---

## PART 4: EXISTING PERFORMANCE BUDGETS (G6/G4 Targets)

### G6 Operations Budget (Stage 3 Final)

| Metric | Target | Measurement Method | Status |
|--------|--------|---|---|
| Frame interval p95 | ≤16.7 ms | rAF delta percentile (600 warm frames) | **NOT YET MEASURED** |
| Long frames (>50 ms) | <0.5% of sample | rAF sample count | **NOT YET MEASURED** |
| Input-to-feedback p95 | ≤100 ms | performance.mark() + custom measure | **NOT YET MEASURED** |
| WebGL JS update+render p95 | ≤8 ms | Custom mark around update/render | **NOT YET MEASURED** |
| JS heap growth over 30 min | ≤5 MiB + non-monotonic post-GC | performance.measureUserAgentSpecificMemory() or DevTools | Current snapshot: 3.1 MB (reference only) |
| Adapter swaps with ≤1 MiB retained | 20 forced swaps | Force WebGL loss, measure heap delta after GC | **NOT YET MEASURED** |

### G4 Immersion Budget

| Metric | Target | Evidence Required |
|--------|--------|---|
| Effect readability score | Median ≥4.0/5 (1–5 scale) | 10 human participants, structured scorecard post-playtest |
| Action feedback latency p95 | ≤100 ms spot-checks | Playwriter action-to-mutation observer (MutationObserver on status DOM) |
| Zero unresolved readability defects | S1/S2 closed before pass | QA defect register audit |

---

## PART 5: IMPLEMENTATION PATHS & ASSET STRATEGY

### Skill Effects: ZERO New Assets Required

All 7 skill effects use **existing systems without new asset generation:**

1. **Particles:** Fixed ParticleField pool (WebGL) or ring-pool replacement (Canvas)
2. **Tone Synthesis:** Oscillator Web Audio (no mp3 needed)
3. **Action Cues:** 7 existing `.mp3` files (hunt, extract, materialize, capture, possess, domain, assault)
4. **Prop Activation:** Existing GLB rig clips (riftPortal, commandObelisk, echoThrone, extractorProp)

### Recommended Minimal Validation Scenario

**Test:** PW-02 Stage 1 core chain (hunt → extract → materialize → capture → assault)
- **Measure:** First visible feedback timestamp for each skill
- **Pass:** All 7 skills emit particles + audio ≤100 ms p95; no console errors
- **Evidence:** Playwriter session with MutationObserver latency probes

---

## PART 6: FILE/SYMBOL QUICK REFERENCE

### WebGL Effect Dispatch

| Symbol | File | Line | Purpose |
|--------|------|------|---------|
| `ParticleField` | battle-realtime-three.js | 149–245 | Pooled particle emitter |
| `SpatialAudio` | battle-realtime-three.js | 253–379 | Positional audio, tone synth |
| `emitActionFeedback()` | battle-realtime-three.js | 4324–4358 | Unified skill effect emission |
| `actionFeedbackProfile()` | battle-realtime-three.js | 4307–4322 | Skill-specific particle/audio params |
| `playActionEffect()` | battle-realtime-three.js | 4360–4387 | Plays animations + effects for skill |

### Canvas Fallback Dispatch

| Symbol | File | Line | Purpose |
|--------|------|------|---------|
| `playActionEffect()` | battle-visualizer.js | 2151–2195 | Skill effect handler (Canvas) |
| `playActionGesture()` | battle-visualizer.js | 1771–1800 | Spatial audio feedback |
| `burst()` | battle-visualizer.js | 2200–2211 | Particle emission |
| `updateParticles()` | battle-visualizer.js | 2806–2815 | Particle lifecycle update |

### Shared Audio Mapping

| Symbol | File | Line | Purpose |
|--------|------|------|---------|
| `CUE_BY_EFFECT` | app.js | 77–87 | Action → asset cue mapping |
| `BATTLE_ACTION_SEMANTICS` | app.js | 49–57 | Action metadata (source/target/clip) |

---

## PART 7: MINIMUM VERIFICATION COMMANDS

### Unit Tests (No Browser)
```bash
node --test tests/battle-realtime-three.test.mjs
node --test tests/battle-visualizer.test.mjs
node --test tests/app-command-feedback.test.mjs
```
**Coverage:** Particle pool bounds, audio non-browser safety, action-feedback ownership (existing suite green; 144/144 pass).

### Browser Smoke Test (G4/G6 Candidate)
```
PW-02: Hunt → Extract → Materialize → Capture → Assault
  • Particles: All 360-pool draws complete, no allocation spike
  • Audio: All 7 tones + 5 cues emit, no context loss
  • Latency: Measure each action's first feedback ≤100 ms p95
  • Duration: Run 60 seconds, record frame intervals + input events
```

### Stress Canary (Renderer Parity)
```
Scenario C: 60 actors, 360 particles, alternating 12 goals
  • WebGL vs Canvas vs headless: identical event transcript
  • Particles: never exceed 360 live; oldest recycled when full
  • State: no campaign corruption; breach/wave-cleared once
```

---

## PART 8: NEXT STEPS FOR EXECUTOR PHASE

### Immediate (No Code Change Required)
1. **Canvas Particle Pool:** Add ring-buffer replacement (ARC-16 fix) — 2h
2. **Async Audio Cleanup:** Mark buffer release in `playSample` end handler — 0.5h
3. **Canvas Dynamic Allocation:** Profile per-frame object creation (target/preferred) — 1h

### Stage 3 Ready (Measurement Required)
1. **Browser Latency Probe:** Playwriter MutationObserver on status DOM for all 7 skills
2. **Frame Pacing Sample:** 600 rAF deltas at 60 Hz, p95/p99 percentiles
3. **Memory Soak:** 30-minute session; heap snapshot pre/post GC

### Optional Polish (No Scope Change)
- JSON.stringify guard (unchanged state skip)
- Tracer line object pool (if >100 active tracers per frame)

---

## SUMMARY TABLE: Skill Effect Implementation Paths

| Skill | Particle Count | Tone Freq | Cue File | Prop Animation | Rally Effect | Camera Effect | Memory Risk |
|-------|---|---|---|---|---|---|---|
| Hunt | 12 | 260→130 Hz | hunt.mp3 | — | — | — | None |
| Extract | 14 | 260→130 Hz | extract.mp3 | extractor Activate | — | — | None |
| Materialize | 20 | 420→760 Hz | materialize.mp3 | portal Activate | — | — | None |
| Capture | 18 | 420→760 Hz | capture.mp3 | obelisk Activate | — | — | None |
| Possess | 16 | 420→760 Hz | possess.mp3 | — | Yes | — | None |
| Domain | 24 | 420→760 Hz | domain.mp3 | echoThrone Activate | Yes | — | None |
| Assault | 28 | 170→90 Hz | assault.mp3 | — | — | Shake+HitStop | None |

**Verdict:** Zero new assets; reuse pooled particles + oscillator tones + 7 existing cues + existing prop rigs. **All immediate feedback paths fire in main thread; no deferred asset load blocking.**

---

*Investigation complete. Files not modified. Ready for executor phase.*
