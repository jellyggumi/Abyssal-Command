# Abyssal Lantern — Three-Stage Dungeon & Routed-Wave Spec

```yaml
run_id: 20260729-three-stage-refinement
status: "[CURRENT] — catalog-authored encounter truth with recovery ordering closure"
title: Abyssal Lantern
owner_skill: author-game-levels + design-game-encounters
authorities:
  - defense-catalog.js
  - defense-run-simulation.js
  - stage-world-catalog.js
depends_on:
  - design/action-combat-spec.md
  - design/camera-vfx-direction.md
scope: dense flat dungeon composition, routed wave ingress, objective gates, recovery, boss/extraction escalation
```

---

## 1. Canonical campaign and route

There are exactly three official stages:

```text
cinder-span -> abyss-chancel -> echo-throne
```

There is no Stage 4. Every stage uses this route:

```text
ingress -> intermediate objective(s) -> final objective/boss -> extraction
```

The route is not a decorative spline. The world catalog owns flat spatial waypoints; the encounter
catalog owns objective order, wave-slot ownership, ingress paths, retry budgets, commitment caps, and
finale paths. The simulation consumes those immutable definitions and exposes them through snapshot/events.
Renderers may show them but may not move, reorder, complete, or retry them.

`[SHIPPED]` Runtime and catalog order is
`gate-defense → echo-recovery → growth → occupation → boss-kill → extraction`. Boss spawn waits for
occupation capture, the extraction window waits for boss defeat, and the implementation reuses the
existing objective IDs, input types, and event types.

## 2. Flat dense dungeon contract

- All movement, collision, routes, objective points, spawn waypoints, hazards, pickups, boss paths, and
  extraction points stay on elevation `0`.
- Each stage has one rectangular two-triangle support mesh and `surfaces: []`.
- Stairs, ramps, raised platforms, drops, pits, bridges, ledges, vertical shortcuts, elevated spawns, and
  height-based targeting are forbidden.
- Background height may shape the skyline only. It cannot alter navigation, occlude a threat/objective,
  or imply a walkable route.
- Each stage keeps one `critical` route plus at least one `optional-detour`. The critical route has ingress,
  two intermediate waypoints, and the canonical final gate.
- Dense means authored landmarks and props at decision points, not scattered clutter: at least eight
  retained props, four landmarks, two motivated-light anchors, and one fog-break per stage. Props must not
  overlap each other or the protected corridor.
- Visible geometry and simplified collision must agree. A hidden collider, unsupported obstacle, detached
  local light, or decoration-inferred route is a blocking defect.

## 3. Exact three-stage escalation

| Sequence | Stage / route ID | Spatial identity | Wave doctrine | Fairness caps | Stage presentation |
|---:|---|---|---|---|---|
| 1 | `cinder-span` / `encounter-route:cinder-span:v2` | `cinder-span:critical-route`: ash bridge, width `1200`, W/SW ingress, low-wide forge blockade | `10200` defense ticks, `10` waves, classes `rusher/flanker/ranged`, cycle `normal/normal/big/mid`, final forced `big` | committed `3`, concurrent non-boss `8`, spawn interval `18` | camera intro `90` ticks; `cinder-span:ember-wake`; ash soundscape |
| 2 | `abyss-chancel` / `encounter-route:abyss-chancel:v2` | `abyss-chancel:critical-route`: bent nave, width `1000`, W/SW/NW ingress, tighter transept | `10500` ticks, `10` waves, adds `guardian`, cycle `normal/big/normal/mid`, final forced `big` | committed `4`, concurrent `9`, interval `24` | intro `96`; `abyss-chancel:mirror-static`; sine-led chancel soundscape |
| 3 | `echo-throne` / `encounter-route:echo-throne:v2` | `echo-throne:critical-route`: axial court, width `1100`, W/SW/NW ingress converging on dais | `10800` ticks, `11` waves, `flanker/ranged/guardian`, cycle `normal/normal/big/mid`, final forced `big` | committed `4`, concurrent `10`, fastest interval `15` | intro `102`; `echo-throne:fracture-echo`; lowest throne soundscape |

Escalation is decision pressure, not visual nonsense:

- Stage 1 teaches two ingress directions and three attacker commitments.
- Stage 2 adds a third direction, a fourth commitment, guardians, a narrower route, longer contest/recovery,
  and denser side pressure even though its per-body spawn interval is deliberately slower.
- Stage 3 adds an eleventh wave, the fastest routed admission, the highest concurrent cap, longer contests,
  strongest wave HP ramp, and final-court boss pressure.
- Each wave's count is sized from clearable HP budget (`PLAYER_BASELINE_DPS 2250`,
  `WAVE_PRESSURE_BP 5500`) and stage scale. Late stages use fewer tougher bodies where needed rather than
  unreadable actor spam.

## 4. Stable intermediate objective gates

| Stage | Objective 1 | Owned slots | Objective 2 | Owned slots |
|---|---|---|---|---|
| `cinder-span` | `cinder-relay-crossing` (`corridor`, contest `60`) | `0–4` | `cinder-forge-stand` (`arena`, contest `75`) | `5–9` |
| `abyss-chancel` | `chancel-nave-advance` (`corridor`, contest `75`) | `0–3` | `chancel-transept-lock` (`arena`, contest `90`) | `4–9` |
| `echo-throne` | `throne-aisle-break` (`corridor`, contest `90`) | `0–5` | `throne-dais-stand` (`arena`, contest `105`) | `6–10` |

An intermediate objective completes only when:

1. every wave assigned to it has started;
2. its pending spawn queue is empty; and
3. no living enemy owned by that objective remains.

Completion grants its authored one-time recovery, emits `ENCOUNTER_OBJECTIVE_COMPLETED`, advances the
immutable objective index, then emits `ENCOUNTER_OBJECTIVE_STARTED` for the next gate. The renderer may
use those events for waypoint transition; it does not infer completion from absence of models.
Both encounter events are mapped in `AUDIO_EVENT_POLICY`; `ENCOUNTER_OBJECTIVE_COMPLETED` is mapped in `VFX_MODELS`. The mappings reuse existing cue/effect vocabulary and do not add event aliases.

Every scheduled wave slot belongs to exactly one objective in ascending objective order. Duplicate,
missing, out-of-range, or backward slot ownership invalidates the stage.

## 5. Routed wave ingress

Wave authoring produces a stable `routeId` and `objectiveId` for every slot. Paths are:

```text
encounter-path:<stageId>:<objectiveId>:<direction-lowercase>
```

Each path carries authored flat waypoints and terminates at `contest:<objectiveId>`. `WAVE_VARIANT_STARTED`
announces `waveIndex`, `slot`, `kind`, `alternativeId`, composition, `policyId`, `spawnDirection`,
`midbossId`, `variantId`, and `objectiveId`. Spawned enemies keep their route and objective ownership;
the renderer uses snapshot route data only.

| Stage/objective | Allowed routed ingress paths |
|---|---|
| `cinder-relay-crossing` | `encounter-path:cinder-span:cinder-relay-crossing:w`, `...:sw` |
| `cinder-forge-stand` | `encounter-path:cinder-span:cinder-forge-stand:w`, `...:sw` via the completed relay contest |
| `chancel-nave-advance` | `encounter-path:abyss-chancel:chancel-nave-advance:w`, `...:sw`, `...:nw` |
| `chancel-transept-lock` | `encounter-path:abyss-chancel:chancel-transept-lock:w`, `...:sw`, `...:nw` via the nave contest |
| `throne-aisle-break` | `encounter-path:echo-throne:throne-aisle-break:w`, `...:sw`, `...:nw` |
| `throne-dais-stand` | `encounter-path:echo-throne:throne-dais-stand:w`, `...:sw`, `...:nw` via the aisle contest |

Admission is FIFO. While an encounter is `ACTIVE`, at most one pending body is admitted per stage spawn
interval and only while active non-boss/non-elite bodies are below that stage's concurrent cap. A full
cap delays admission; it does not drop, teleport, or re-route the body.

Normal waves keep seeded policy selection. `big` waves explicitly use the stage pressure lane
(`gate-pressure`, or `flank` where authored); `mid` waves use `elite-escort`. Midboss identity remains
stable as `<stageId>-midboss-<slot>`.

## 6. Readable recovery and retry

`RETRY_OBJECTIVE` is the existing recovery input. While an intermediate objective is `ACTIVE`, a
player-triggered recovery may retry only below its authored `maxAttempts: 3`; runtime does not infer a
separate failure state before accepting this input.

| Objective | Recovery ticks | Commander floor | Gate floor | Completion recovery (commander / gate) |
|---|---:|---:|---:|---:|
| `cinder-relay-crossing` | 180 | 35% | 30% | 9% / 6% |
| `cinder-forge-stand` | 210 | 40% | 35% | 11% / 7% |
| `chancel-nave-advance` | 240 | 40% | 35% | 10% / 7% |
| `chancel-transept-lock` | 270 | 45% | 40% | 12% / 8% |
| `throne-aisle-break` | 210 | 45% | 40% | 11% / 7.5% |
| `throne-dais-stand` | 300 | 50% | 45% | 13% / 9% |

On player-triggered recovery:

1. Objective-owned enemies withdraw and their IDs are reported.
2. Objective-owned pending spawns are removed.
3. Commander/gate rise only to the authored floors, never above current higher values.
4. `ENCOUNTER_OBJECTIVE_FAILED` and `ENCOUNTER_RECOVERY_STARTED` expose reason, attempt, countdown.
5. `[SHIPPED]` During recovery there is no enemy admission, warning spam, hidden damage, or wave-clear grant. `processObjectivePressure()` exits for `RECOVERY`; `processEncounterRecovery()` shifts the pressure clock by the exact paused duration; `processWaveClearRecovery()` exits before interpreting recovery withdrawal as a clear. `[OBSERVED GAP]` The renderer has no `RECOVERY` camera branch yet; held camera/no-orbit remains an event-consumer contract.
6. At expiry, `ENCOUNTER_RETRY_STARTED` increments the attempt and re-enqueues only that objective's
   previously started wave indices.

Wave-clear recovery is also readable and deduplicated: when a scheduled wave has fully cleared before the
next pressure lands, `WAVE_CLEARED` restores commander `8%` and gate `5%` once for `wave:<index>`.
`ENCOUNTER_REWARD_GRANTED.rewardKey` prevents farming by re-entry.

## 7. Final objective, boss, and extraction

| Stage | Existing echo path | Existing boss path | Existing occupation / extraction IDs |
|---|---|---|---|
| `cinder-span` | `encounter-path:cinder-span:echo-recovery` | `encounter-path:cinder-span:boss-kill` | `cinder-seal` / `cinder-bind` |
| `abyss-chancel` | `encounter-path:abyss-chancel:echo-recovery` | `encounter-path:abyss-chancel:boss-kill` | `chancel-oath` / `chancel-bind` |
| `echo-throne` | `encounter-path:echo-throne:echo-recovery` | `encounter-path:echo-throne:boss-kill` | `throne-domain` / `throne-bind` |

Target choreography, using only those stable IDs:

1. Clear both intermediate gates and the gate-defense wave budget.
2. Resolve `echo-recovery`, `growth`, and occupation preparation.
3. Enter the existing `boss-kill` route and defeat the stage boss.
4. Open the existing extraction point as the final egress; extraction completion closes the stage.

The simulation performs steps 3 and 4 in this order. Presentation consumes the authoritative events;
it may not duplicate the boss, pre-play `EXTRACTION_COMPLETED`, or synthesize a replacement event.

## 8. Animation, VFX, camera, and sound handoff

| Encounter event | Joint-motion intent | Camera/VFX intent | Audio intent |
|---|---|---|---|
| `STAGE_STARTED` | commander `show`, then `idle/run` | stage-authored intro and ambient loop | `stage-start`; soundscape `descent` |
| `ENCOUNTER_OBJECTIVE_STARTED` | locomotion remains responsive | ease toward objective; preserve ingress arrow | `[SHIPPED]` `objective-waypoint` priority 60 |
| `WAVE_VARIANT_STARTED` | spawned actor `show`, then routed locomotion | normal/big/mid camera tier; routed ingress equivalent | `warning-pulse` priority 64; `active-wave` |
| `MIDBOSS_SPAWNED` | midboss `show` | bounded emphasis; no route occlusion | `warning-pulse` priority 82 |
| `ENCOUNTER_OBJECTIVE_FAILED` / recovery | withdraw without death celebration; survivors return to locomotion/offstage | static retry countdown, no shake/orbit | `[SHIPPED]` `interrupt-alert` at objective-failure priority 84 |
| `ENCOUNTER_OBJECTIVE_COMPLETED`, `WAVE_CLEARED` | finish live one-shot before locomotion | `[SHIPPED]` route completion reuses objective/ember completion VFX; wave clear retains its existing mapping | `[SHIPPED]` `objective-complete` priority 64 for encounter completion; wave clear uses 58 |
| `BOSS_SPAWNED` | boss `show`; semantic attacks/reactions thereafter | `FINALE`, fracture echo, telegraphs preserved | `boss-spawned` priority 90; state `boss` |
| `TERMINAL` | `die` or held victory silhouette | retire transient clutter, preserve outcome/extraction direction | priority 100; `victory`/`defeat` |

Named joint clips and cross-fades follow `action-combat-spec.md`; VFX lifetime/quality/reduced-motion and
browser audio budgets follow `camera-vfx-direction.md`. The strongest visual and sonic beat is always
driven by the same simulation event.

The gaps above require consumer-policy rows for the existing encounter events. They do not authorize an
event alias, duplicate simulation emission, or new cue/effect ID.

## 9. Measurable gates

| Gate ID | Pass condition |
|---|---|
| `enc-stage-count` | Exactly three route/doctrine/world records cover exactly the three `STAGES` IDs. |
| `enc-flat-world` | Every critical/optional route point, objective, ingress waypoint, boss path, occupation, and extraction point resolves on elevation `0`; no walkable vertical link exists. |
| `enc-dense-clearance` | Each world has `≥8` props and `≥4` landmarks; prop/collider overlap with a protected route is `0`; every obstacle has matching visible geometry. |
| `enc-slot-ownership` | All `10/10/11` stage wave slots are owned once, in objective order, with no duplicate or missing slot. |
| `enc-route-resolution` | Every scheduled wave resolves an existing route matching its `objectiveId` and direction; missing-path throws before play. |
| `enc-concurrency` | Non-boss active bodies never exceed `8/9/10`; committed attackers never exceed `3/4/4`; queue entries are delayed, not dropped. |
| `enc-ingress-readability` | On desktop and `390×844`, each W/SW/NW route gives at least one warning cue before the first attacker enters contest range; no offscreen damage. |
| `enc-objective-gate` | Objective completion is impossible while an owned wave is unstarted, pending, or alive; completion/reward emits once. |
| `enc-recovery` | All six objectives honor exact ticks/floors/max attempts; recovery admits zero enemies and applies zero hidden damage; retry requeues only owned started waves. |
| `enc-audio-priority` | Objective failure, midboss, boss, and terminal cues remain audible at the 12-voice cap; wave/kill texture yields first. |
| `enc-vfx-budget` | One ambient stage cue plus transient pool `≤24`; warning/objective meaning remains under low quality and reduced motion. |
| `enc-animation-continuity` | Spawn/show, routed locomotion, attack/reaction, withdrawal/retry, death, and boss transitions show no bind-pose frame or stale queued reaction. |
| `enc-route-contract` | Deterministic captures traverse ingress → both listed intermediate objectives → existing boss path → existing extraction point for all three stages. |
| `enc-glitch-reset` | Ten fail/retry/stage-reset cycles leave no duplicate reward key, withdrawn enemy, stale route arrow, ambient mixer, transient VFX, or audio voice. |

## 10. Source IDs

- `defense-catalog.js#STAGE_TACTICS`, `#STAGE_ENCOUNTER_ROUTES`,
  `#STAGE_WAVE_DOCTRINE`, `#WAVE_KIND_PROFILE`, `#buildDoctrineWavePlan`, `#STAGES`
- `defense-run-simulation.js#encounterStateFor`, `#enqueueEncounterWave`, `#processEncounterSpawns`, `#beginEncounterRecovery`, `#processEncounterRecovery`, `#updateEncounterObjective`, `#updateObjectivePhase`, `#processObjectivePressure`, `#processWaveClearRecovery`, `#spawnBoss`
- `stage-world-catalog.js#STAGE_WORLD_PROFILES`, `#validateProfile`, `#STAGE_SHOWCASE_IDS`
- `battle-realtime-three.js#triggerCombatActions`, `#spawnVfx`, `#CAMERA_PHASE_TIERS`
- `defense-audio.js#AUDIO_EVENT_POLICY`, `#audioSoundscapeForEvent`, `#DefenseAudio`
