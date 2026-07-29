# Abyssal Lantern — Action Combat & Joint-Motion Contract

```yaml
run_id: 20260729-three-stage-refinement
status: "[CURRENT] — [OBSERVED] runtime facts and explicit [TARGET] ordering gaps"
title: Abyssal Lantern
owner_skill: threejs-animation + build-game-audio-feedback
authorities:
  - defense-catalog.js
  - defense-run-simulation.js
  - battle-realtime-three.js
  - defense-audio.js
scope: simulation-owned combat, joint-driven GLB motion, semantic clips, cross-fades, combat VFX/audio hooks
```

---

## 1. Authority boundary

Combat remains deterministic and renderer-neutral. `defense-run-simulation.js` owns positions, damage,
targeting, objective state, event order, and the accepted input surface. The Three.js renderer reads frozen
snapshots/events and may animate joints, attach presentation meshes, flash materials, offset a rendered root
briefly, or shake the camera; none of those may write back to the simulation.

- Existing inputs are `MOVE`, `ATTACK`, `SKILL_CAST`, `SKILL_SELECTED`,
  `GROWTH_OFFER_SELECTED`, `REWARD_SELECTED`, `RETRY_OBJECTIVE`, `EXTRACT_ELITE`,
  `M4_CARD_DECISION`, `M3_TARGET_PROBE`, and `STANCE_CYCLE`.
- Do not introduce `ATTACK_LIGHT`, `ATTACK_HEAVY`, `DASH`, or a renderer-owned combo clock in this
  planning lane. They are not current runtime APIs.
- Hit confirmation comes only from events such as `MELEE_IMPACT`, `PROJECTILE_IMPACT`,
  `SKILL_RESOLVED_DAMAGE`, and `CRITICAL_HIT`; a pose, trail, or collision-looking mesh is never damage
  authority.

## 2. Joint-driven GLB contract

### 2.1 Asset and clock

Each rigged actor uses one cloned skeleton and one `AnimationMixer`. Authored GLB keyframe tracks drive
the rig's joints; the snapshot keeps ownership of the actor root's gameplay position and elevation.
Mixers advance exactly once per rendered frame with clamped elapsed delta seconds. The renderer currently
caps a visual animation jump at six simulation ticks and wall-clock delta at `0.1 s`.

The stable clip convention is:

```text
<assetId>::<semantic-action>::v01
```

Bare semantic names remain a loader compatibility fallback, not an alternate authoring convention.
Named lookup is mandatory; clip array index is forbidden because export order may change.

### 2.2 Semantic clip library

| Family | Required semantic names | Loop/one-shot |
|---|---|---|
| locomotion | `idle`, `move`, `run` | loop |
| reaction | `hit`, `bighit`, `avoid`, `defence`, `die` | one-shot; `die` terminal |
| action | `attack`, `critical`, `show` | one-shot |
| commander delivery | `attack_melee`, `attack_ranged` | one-shot; deterministic fallback to `attack` / `critical` for actors that omit dedicated clips |

The base library is the canonical eleven actions through `show`; commander delivery adds the two named
specializations. `ANIMATION_CLIPS` in `defense-catalog.js` is legacy display vocabulary and must not
override the live GLB semantic names used by `battle-realtime-three.js`.

### 2.3 Event-to-motion routing

| Existing event | Actor semantic motion | Existing visual/audio hook |
|---|---|---|
| `STAGE_STARTED` | commander `show` | stage intro + `stage-start` |
| `ENEMY_SPAWNED`, `BOSS_SPAWNED` | spawned actor `show` | boss uses fracture VFX + `boss-spawned` priority 90 |
| `BASIC_ATTACK`, `WEAPON_FIRED` | delivery chooses `attack_melee` or `attack_ranged`; fallback by role/distance | weapon presentation + `attack-windup` |
| `SKILL_CAST` | `event.motion` or `critical` | semantic skill VFX + `skill-cast` |
| `SKILL_RESOLVED_DAMAGE` | target `hit` / `bighit` | impact flash + `impact-hit` |
| `CRITICAL_HIT` | target `bighit` | ember-wake VFX + `critical-hit` priority 68 |
| `PROJECTILE_IMPACT` | guarded actor `defence`; target `hit` or `avoid` | `block-contact` or `impact-hit` |
| `COMMANDER_DAMAGED`, `COMPANION_DAMAGED` | target `hit` | damage cue priority 74 / 70 |
| `BOSS_ATTACK_CANCELLED` | target `avoid` | ember-wake VFX + `attack-miss` |
| `WARDENS_WARD_TRIGGERED` | actor `defence` | mirror-static VFX |
| `COMPANION_DOWNED` | actor `die` | fracture VFX + `interrupt-alert` priority 78 |

Repeated renders of one event are deduplicated by stable event identity. A repeated same beat may restart
only after its own clip has advanced at least `1/60 s`; it must not rebuild its weapon/VFX attachment.

### 2.4 Cross-fade and interruption rules

- Locomotion boundaries cross-fade; the default is `0.20 s`.
- One-shot entry fades are semantic: `bighit 0.03`, `hit 0.05`, `avoid/defence 0.06`,
  `attack/attack_melee/attack_ranged/critical 0.08`, `show 0.20 s`.
- Return-to-locomotion fades are `bighit 0.28`, `defence/show 0.20`, `avoid 0.18`,
  `hit 0.15`, `attack/attack_melee/attack_ranged/critical 0.12 s`.
- A live one-shot is not blended into an incompatible one-shot. One queue slot keeps the highest-priority
  fresh beat: `die 100 > bighit 60 > defence/avoid 50 > hit 40 > attacks/critical 30 > show 10`.
- `die` hard-cuts, clears the queued beat, never restarts, and never returns to locomotion.
- Mixer completion owns one-shot recovery. Parallel setTimeout animation clocks are forbidden.
- Any small procedural joint correction runs after `mixer.update(delta)` so authored keyframes do not
  overwrite it. Procedural root drift is forbidden.

## 3. Shared three-stage route and combat escalation

All design documents use one route sentence:

```text
ingress -> intermediate objective(s) -> final objective/boss -> extraction
```

| Stage | Stable spatial chain | Combat/motion intent |
|---|---|---|
| `cinder-span` | `cinder-span:ingress` → `cinder-relay-crossing` → `cinder-forge-stand` → `encounter-path:cinder-span:boss-kill` → `cinder-bind` | Teach readable `show → locomotion → attack → hit`; W/SW threats and cap 3 committed attackers keep one-shot reactions legible. |
| `abyss-chancel` | `abyss-chancel:ingress` → `chancel-nave-advance` → `chancel-transept-lock` → `encounter-path:abyss-chancel:boss-kill` → `chancel-bind` | Add W/SW/NW cross-pressure, cap 4, guard/avoid reactions, and stronger warning priority without changing clip names. |
| `echo-throne` | `echo-throne:ingress` → `throne-aisle-break` → `throne-dais-stand` → `encounter-path:echo-throne:boss-kill` → `throne-bind` | Final cap 4, fastest routed ingress, eleven waves, decisive `bighit/defence/die` readability, then extraction release. |

`[SHIPPED]` The simulation and `STAGE_ENCOUNTER_ROUTES[*].finale.objectiveOrder` now preserve
`gate-defense → echo-recovery → growth → occupation → boss-kill → extraction`. The boss is defeated
before the extraction window opens; existing objective IDs, events, and input APIs remain unchanged.

## 4. VFX and browser-audio handshake

The strongest visual and sonic beat must share the same simulation event. Presentation consumers may
drop decorative work but never invent contact.

| Information rank | Existing event examples | VFX rule | Audio rule |
|---|---|---|---|
| critical | `TERMINAL`, `COMMANDER_DOWNED`, `BOSS_SPAWNED`, `BOSS_RALLY_WINDOW` | preserve boss/terminal silhouette; expire or retire deterministically | priorities `100`, `98`, `90`, `88` pre-empt lower voices |
| danger | `BOSS_ATTACK_TELEGRAPHED`, `OBJECTIVE_PRESSURE_DEADLINE`, `MIDBOSS_SPAWNED` | readable telegraph for the full authored windup | priorities `86`, `88`, `82`; `warning-pulse` refractory `0.35 s` |
| player consequence | damage, block, interrupt | flash/reaction must align with the event's first rendered frame | damage/block/interrupt priorities outrank attacks and movement |
| texture | attacks, kills, input accept | pool/reuse; safe to thin under load | refractory gates and voice stealing may suppress these first |

Web Audio unlocks only from pointer/keyboard gesture, respects mute/volume, suspends on pause/background,
and releases completed oscillator/gain nodes. Persistent soundscapes transition by ramping existing layers
for `0.35 s`; they do not restart tracks on each wave.

## 5. Measurable gates

| Gate ID | Pass condition |
|---|---|
| `anim-named-clips` | Every rig clip resolves by semantic name; missing names produce a controlled fallback, never array-index playback. |
| `anim-joint-authority` | At 30/60 fps, joint motion duration differs by at most one rendered frame while snapshot root position/digest remains identical. |
| `anim-transition-continuity` | Locomotion/action/reaction matrix shows no bind-pose frame; all fade durations match §2.4 within `±1/60 s`. |
| `anim-one-shot-queue` | At most one queued beat; priority order is exact; `die` leaves zero queued/active non-death actions. |
| `anim-repeat-idempotence` | Re-rendering one snapshot event does not restart a clip or allocate another presentation root. |
| `anim-lifecycle` | Ten actor mount/unmount cycles leave zero active actions, mixers, presentation roots, or finished listeners. |
| `combat-hook-parity` | Every tabled event produces the same semantic motion/VFX/audio decision from the same event ID; no renderer-originated damage event exists. |
| `audio-browser-lifecycle` | First gesture unlocks; mute/pause/background emits no transient voice; focus resumes without duplicate persistent layers. |
| `audio-budget` | Active voices `≤12`, transient nodes `≤48`, total nodes `≤64`; a full pool rejects or steals only lower-priority voices. |
| `reduced-motion-equivalence` | Joint clips still communicate state; procedural idle/follow, camera shake, and transient VFX motion are removed while critical cues retain a static visual equivalent. |
| `route-contract` | Each official stage resolves only its listed ingress, two intermediate objectives, existing boss path, and extraction point; no Stage 4 ID appears. |

## 6. Source IDs

- `defense-catalog.js#AUDIO_CUES`, `#ANIMATION_CLIPS`, `#STAGES`, `#STAGE_ENCOUNTER_ROUTES`
- `defense-run-simulation.js#queueInput`, `#emit`, `#createDefenseRun`, `#spawnBoss`
- `battle-realtime-three.js#MOTION_MODELS`, `#RIG_ACTION_KEYS`, `#BEAT_PRIORITY`,
  `#ONE_SHOT_ENTRY_FADE_SECONDS`, `#LOCOMOTION_RECOVERY_FADE_SECONDS`,
  `#crossfadeToAction`, `#triggerCombatActions`
- `defense-audio.js#AUDIO_EVENT_POLICY`, `#CUE_REFRACTORY_SECONDS`,
  `#audioSoundscapeForEvent`, `#DefenseAudio`
