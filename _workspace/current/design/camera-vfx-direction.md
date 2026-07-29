# Abyssal Lantern — Three-Stage Camera, VFX & Audio Direction

```yaml
run_id: 20260729-three-stage-refinement
status: "[CURRENT] — runtime-grounded presentation contract"
title: Abyssal Lantern
owner_skill: game-vfx + build-game-camera-controls + build-game-audio-feedback
authorities:
  - stage-world-catalog.js
  - battle-realtime-three.js
  - defense-audio.js
  - defense-run-simulation.js
scope: flat-stage framing, per-stage VFX lifecycle, quality/reduced-motion policy, browser soundscape transitions
```

---

## 1. Non-negotiable presentation hierarchy

1. Keep the commander, active objective, routed ingress, committed attackers, and telegraph readable.
2. Keep the one-plane dungeon route and extraction direction unambiguous.
3. Add stage identity and spectacle only inside those constraints.

The renderer consumes frozen snapshots/events. Camera, joint animation, transient offsets, VFX, and
audio state never mutate simulation state.

All three design documents use:

```text
ingress -> intermediate objective(s) -> final objective/boss -> extraction
```

`[SHIPPED]` Runtime now resolves `boss-kill` before `extraction`. Presentation follows the emitted
boss-death and extraction-window events; it never fabricates a camera- or VFX-only objective state.

## 2. Exactly three stage worlds

| Sequence / stage | Flat spatial intent | Camera intent | Authored ambient VFX | Sound intent |
|---|---|---|---|---|
| 1 — `cinder-span` | Low-wide ash bridge blockade; `cinder-span:critical-route` carries `cinder-span:ingress → cinder-relay-crossing → cinder-forge-stand → encounter-path:cinder-span:boss-kill → cinder-bind`, corridor width `1200`, W/SW ingress. | Focus `(13800,6000,0)`; intro `90` ticks from distance `6`, azimuth `-0.24`, polar `-0.34`; hold the long route axis and show the final gate before commitment. | cue `cinder-span:ember-wake`, effect `cinder-span-ember-wake`, clip `stage-vfx::cinder-span::loop::v01`; warm moving embers indicate forward pressure. | Saw/triangle ash ambience; music fundamentals `55/82.41/123.47 Hz`; the least complex lane mix teaches warning versus contact. |
| 2 — `abyss-chancel` | Bent nave/colonnade; `abyss-chancel:critical-route` carries `abyss-chancel:ingress → chancel-nave-advance → chancel-transept-lock → encounter-path:abyss-chancel:boss-kill → chancel-bind`, corridor width `1000`, three approaches. | Focus `(13600,6000,0)`; intro `96` ticks from distance `6.4`, azimuth `0.30`, polar `-0.30`; frame side ingress without letting apse props occlude the contest point. | cue `abyss-chancel:mirror-static`, effect `abyss-chancel-mirror-static`, clip `stage-vfx::abyss-chancel::loop::v01`; violet static makes locks and denials legible. | Sine-led chancel bed at `73.42/110/164.81 Hz`; cleaner sustained tones leave warning pulses room during three-way pressure. |
| 3 — `echo-throne` | Axial fractured court; `echo-throne:critical-route` carries `echo-throne:ingress → throne-aisle-break → throne-dais-stand → encounter-path:echo-throne:boss-kill → throne-bind`, corridor width `1100`, fastest W/SW/NW convergence. | Focus `(14200,6000,0)`; intro `102` ticks from distance `6.8`, azimuth `-0.40`, polar `-0.28`; widest opening establishes the final court, then keeps dais, boss path, and extraction direction readable. | cue `echo-throne:fracture-echo`, effect `echo-throne-fracture-echo`, clip `stage-vfx::echo-throne::loop::v01`; cold fracture echoes carry boss and terminal beats. | Low `49/73.42/98 Hz` throne bed with saw pressure; boss mix is heaviest but never masks terminal or extraction cues. |

Every stage has one rectangular support mesh at elevation `0`, an empty `surfaces` list, one critical
route, an optional detour, at least eight non-overlapping retained props, and motivated lights attached to
visible emitters. Tall scenery is non-walkable dressing and may not create stairs, ramps, ledges, pits,
shortcuts, target elevation, or hidden spawn volumes.

## 3. Camera state and route framing

### 3.1 Existing camera envelope

| Contract | Current value |
|---|---|
| perspective | FOV `42`, near `0.1`, far `200` |
| pitch clamp | `30°–85°`; authored baseline `55°` |
| orbit distance | base `20.8`, clamp `10.4–41.6`, manual layer `±10%` |
| smoothing | position lambda `6`, look lambda `11`, exponential and delta-time based |
| tier transition | `90` ticks, normalized exponential |
| phase tier values | `DESCENT 20.8`, `SKIRMISH 26`, `SURGE 33`, `MIDBOSS 38`, `BIGWAVE/FINALE 41.5` |

### 3.2 Bind existing events to readable beats

| Existing event/state | Camera beat | Never hide |
|---|---|---|
| `STAGE_STARTED` / ingress | play that stage's authored intro, then settle to `DESCENT` | ingress, first objective marker |
| `ENCOUNTER_OBJECTIVE_STARTED` | ease look target between current and next contest point; no cut | commander, previous safe route, new objective |
| `WAVE_VARIANT_STARTED kind=normal` | `SKIRMISH`; no shake | routed ingress arrow and contest radius |
| `WAVE_VARIANT_STARTED kind=big` | `BIGWAVE`; pull back over `90` ticks | every committed attacker and escape corridor |
| `MIDBOSS_SPAWNED` | `MIDBOSS`; one bounded emphasis | midboss path, telegraph, commander |
| `ENCOUNTER_RECOVERY_STARTED` | hold position and reduce motion; do not orbit a failed state | retry floor, withdrawn route, countdown |
| `BOSS_SPAWNED` | `FINALE`; use the existing `show` beat and boss cue | boss path and threat silhouette |
| post-boss extraction `[SHIPPED]` | relax toward route overview without a hard reset | extraction point, remaining safe corridor |

`[SHIPPED]` `resolveCameraPhase()` maps objective IDs and emitted encounter events onto the existing
camera tiers, including `gate-defense`, `echo-recovery`, `occupation`, `boss-kill`, and `extraction`.
Unknown values still fail safely to `DESCENT`; no renderer-owned simulation phase enum was added.

Stage fog is authored per world and remains stage-specific:

| Stage | `fogNear` | `fogFar` |
|---|---:|---:|
| `cinder-span` | 22.4 | 50.4 |
| `abyss-chancel` | 24 | 54 |
| `echo-throne` | 23 | 55 |

Telegraphs, objective rings, ingress arrows, and extraction markers must remain readable at the worst
allowed orbit/pitch. Atmosphere may be thinned; information layers may not.

## 4. VFX lifecycle

### 4.1 Stage ambient lifecycle

Each official stage mounts exactly its single `presentation.vfxCues` record. The loader requires the exact
named loop clip, creates one mixer/action for that cloned root, and separates groups
`vfx-core`, `vfx-detail`, and `vfx-decor`.

```text
stage mount -> load/clone -> exact clip lookup -> loop -> quality/reduced-motion policy
            -> stage change/dispose -> stop actions -> remove owned root/resources
```

- Full: core + detail + decor visible; loop action plays.
- Low quality: core stays; detail and decor hide; loop may continue.
- Reduced motion: core remains static; detail/decor hide; loop action stops.
- A missing exact clip yields a static core, not an arbitrary first animation.
- Stage VFX stays at elevation `0` plus the renderer's `0.04` ground lift and never becomes collision.

### 4.2 Transient event lifecycle

Transient GLB VFX are keyed from existing events and anchored from the snapshot. The current renderer caps
active instances and pending loads at `24`; the oldest active record retires first. Load completion checks
the current generation before attachment so late promises cannot resurrect a disposed effect.

| Existing event | Asset family | Lifetime |
|---|---|---:|
| `INPUT_ACCEPTED`, `PROJECTILE_EXPIRED` | ember wake | `12` ticks |
| `INPUT_REJECTED`, `PROJECTILE_BLOCKED`, `CRITICAL_HIT` | mirror static / ember wake | `18` ticks |
| `OBJECTIVE_PHASE_CHANGED`, `WAVE_CLEARED` | mirror static / ember wake | `36` ticks |
| `OBJECTIVE_COMPLETED`, `OCCUPATION_CAPTURED` | ember wake | `48` ticks |
| `EXTRACTION_WINDOW_OPENED`, `EXTRACTION_COMPLETED` | mirror static / fracture echo | `60` ticks |
| `BOSS_ATTACK_TELEGRAPHED` | mirror static | exact `windupTicks`, fallback `45` |
| `BOSS_SPAWNED`, `TERMINAL` | fracture echo | `90` ticks |
| `ECHO_WARDEN_AWAKENING_TRIGGERED` | ember wake | `120` ticks |

Skill events keep their current semantic IDs and silhouettes:
`rift-bolt`, `soul-lance`, `grave-pulse`, `void-aegis`, `shadow-step`.
No new particle emitter API is implied by this document.

### 4.3 Information priority and overlap

1. Boss telegraph / objective deadline / terminal.
2. Damage, block, interrupt, extraction readiness.
3. Attack, skill contact, pickup.
4. Decorative stage particles and death texture.

When the `24`-instance cap is pressured, decorative/oldest transient work yields first. A warning or
objective marker must also have a non-animated geometry/UI equivalent so its meaning survives a missed
GLB load, reduced motion, or low quality. Additive effects may not wash out route arrows, contest rings,
actor silhouettes, or attached motivated lights.

## 5. Audio priorities and music state

Web Audio is event-driven and browser-safe:

- Unlock on `pointerdown`/`keydown`; respect mute and master volume.
- Suspend and stop transient voices/narration on pause, blur, or hidden document; resume only after the
  browser allows it.
- Maximums are `12` active transient voices, `48` transient nodes, and `64` total nodes.
- When full, the oldest lowest-priority voice is stolen only if its priority is lower than the incoming
  cue. Per-cue refractory windows prevent buzz.
- Meaningful audio always has a visible equivalent: ingress/waypoint arrow, telegraph, damage flash,
  objective state, retry countdown, boss silhouette, or terminal panel.

Existing soundscape states transition over `0.35 s` by ramping persistent oscillators:

```text
descent -> active-wave -> objective-pressure -> active-wave
        -> boss -> victory/defeat
```

`STAGE_STARTED`/retry selects `descent`; wave ingress selects `active-wave`; pressure events select
`objective-pressure`; `BOSS_SPAWNED`/`BOSS_RALLY_WINDOW` selects `boss`; `TERMINAL` selects
`victory` or `defeat`. `OBJECTIVE_COMPLETED`/`WAVE_CLEARED` only relax pressure back to active wave.
State changes do not restart persistent layers.

Priority proof points are current IDs: `TERMINAL 100`, `COMMANDER_DOWNED 98`, retry `94`,
`BOSS_SPAWNED 90`, pressure deadline/boss rally `88`, boss telegraph `86`, objective failure `84`,
midboss `82`, normal wave warning `64`, kill texture `36`. This keeps survival information audible
above density noise.

Reduced motion disables persistent ambience/music and transient VFX motion in the current runtime, but
micro-cues remain available. The visual equivalent is still mandatory; reduced motion is never reduced
information.

## 6. Performance, accessibility, and glitch-prevention gates

| Gate ID | Pass condition |
|---|---|
| `stage-count` | `STAGE_SHOWCASE_IDS` is exactly `cinder-span`, `abyss-chancel`, `echo-throne`; no Stage 4 content appears. |
| `flat-plane` | Every route/objective/prop/VFX placement has elevation `0`; one support mesh; zero walkable surfaces/slopes/links. |
| `camera-route-readability` | At min/max pitch and zoom on desktop and `390×844`, commander, active objective, one ingress indicator, and safe corridor remain simultaneously visible. |
| `camera-event-mapping` | Each event in §3.2 reaches its listed tier within `90±1` ticks; unknown objective strings never silently hold `DESCENT` in an accepted capture. |
| `camera-no-pop` | Stage intro skip, objective change, retry, boss entry, and extraction produce no one-frame origin/bind-pose/camera jump. |
| `vfx-stage-lifecycle` | Ten stage switches leave one current ambient cue, zero retired mixers/actions, and zero late-load resurrection. |
| `vfx-cap` | Active transient records `≤24`, pending loads `≤24`; oldest retirement leaves no attached root or active action. |
| `vfx-reduced-motion` | Ambient core remains static, detail/decor hidden, all transient actions stopped, and every warning/objective meaning still visible. |
| `vfx-overlap` | Boss telegraph, objective ring, and three simultaneous contacts retain separable silhouettes with no additive white-out. |
| `audio-priority` | With 12 active voices, priority 86+ warning/terminal cues play by evicting only lower-priority voices; equal/higher voices are preserved. |
| `audio-transition` | Every soundscape state reaches target gain/pitch in `0.35±0.02 s` without creating another persistent layer. |
| `audio-lifecycle` | Gesture unlock, mute, pause, hidden tab, focus return, and stop leave `voices=0`, no duplicate ambience/music, and no closed-context exception. |
| `accessibility` | Color-independent shape/position cue exists for danger, safe route, objective, boss, extraction, and reward; reduced motion removes motion, not meaning. |
| `route-contract` | Captures show `ingress → two intermediate objectives → boss → extraction` with the stable IDs in §2 after the runtime ordering gap is closed. |

## 7. Source IDs

- `stage-world-catalog.js#STAGE_WORLD_PROFILES`, `#STAGE_SHOWCASE_IDS`, `#vfxCue`,
  `#validateProfile`
- `defense-catalog.js#STAGE_TACTICS`, `#STAGE_ENCOUNTER_ROUTES`, `#STAGES`, `#AUDIO_CUES`
- `battle-realtime-three.js#CAMERA_PHASE_TIERS`, `#resolveCameraPhase`, `#VFX_MODELS`,
  `#VFX_LIFETIME_TICKS`, `#instantiateStageVfx`, `#applyStageVfxPolicy`,
  `#spawnVfx`, `#trackVfxInstance`
- `defense-audio.js#AUDIO_EVENT_POLICY`, `#STAGE_SOUNDSCAPES`, `#SOUNDSCAPE_STATES`,
  `#audioSoundscapeForEvent`, `#DefenseAudio`
