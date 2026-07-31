# 11 — Arrival and engagement choreography

- **Version** v1 (2026-07-31)
- **Skills** `/skill:design-game-encounters` (formation intent), `/skill:game-vfx` (entry cue),
  `/skill:threejs-animation` (entry clip routing)
- **Produces** a spawn-formation change in `defense-run-simulation.js` **and** its entry
  presentation, with the digest consequence measured rather than discovered.
- **Placeholders** `${formationId}` (one of `abreast` `encircle` `emerge` `skydrop`), `${stageId}`,
  `${waveIndex}`, `${fixtureSeed}`, `${arrivalGrade}`.

---

**CONTEXT:**
Today every non-elite body enters from an arena edge and same-wave bodies are separated along one
lane, which is why engagement reads as a serial column:

```
spawnPoint(direction, laneOffset)   defense-run-simulation.js:582
  W (default)  x 500,   y ARENA.gateY + laneOffset
  NW           x 1000,  y clamp(1000 + |laneOffset|, 500, 4000)
  SW           x 1000,  y clamp(height - 1000 - |laneOffset|, 8000, height - 500)
  N            x clamp(6000 + laneOffset, 2000, 18000), y 500
  S            x clamp(6000 + laneOffset, 2000, 18000), y height - 500
elite          fixed x 14000, y ARENA.gateY
laneJitter     ±400 (tactics.seededVariation default)
multi-spawn    laneOffset + spawnIndex * 200
ARENA          24000 x 12000, gateX 22000, gateY 6000
```

Two hooks already exist and are unused. `ENEMY_SPAWNED` has exactly one emit site
(`defense-run-simulation.js:1036`) and its payload is
`entityId, enemyType, elite, midboss, midbossId, spawnDirection, routeId, route, objectiveId, waveIndex`
— **no `grade`, no `telegraphTicks`**. The renderer branches on both: `isCriticalVfxEvent()` exempts
`ENEMY_SPAWNED` only when `grade === "SHADOW"`, and `resolveVfxLifetimeTicks()` prefers
`event.telegraphTicks` with a graded fallback of `ENEMY_SPAWNED_SHADOW_LIFETIME_TICKS = 60` against
the table value 30. So today every arrival telegraph is 30 ticks and stays evictable, and the graded
arrival path is unreachable in production.

`ENEMY_SPAWNED` currently borrows `assets/motion/stage-vfx/echo-throne-fracture-echo.glb`; the
comment at `battle-realtime-three.js:398` names `arrival-breach-gate` as the intended dedicated
asset and records it as absent.

**ROLE:**
You are an encounter engineer who knows that where a body stands is authoritative and how it appears
there is not. You do not buy variety with fairness: a body that materialises inside the player's
reach without an arming window is an unfair hit, not a flourish. You treat the seeded RNG as a
load-bearing structure, not as a number source.

**ACTION:**

1. Classify `${formationId}` and split it across the boundary before writing anything:

   | Formation | Simulation change | Renderer change |
   |---|---|---|
   | `abreast` | N bodies on one perpendicular offset row, replacing `spawnIndex * 200` along the lane | none required |
   | `encircle` | ring of spawn points at radius R around the target, angle stepped deterministically | per-actor inward entry yaw |
   | `emerge` | spawn positions inside the target's local radius | rise from below ground across the telegraph window, ground-crack decal |
   | `skydrop` | same placement as `emerge` | fall plus landing impact, reusing the AoE burst ring and camera impulse |

2. Author the spawn geometry in `defense-run-simulation.js` as a **deterministic function of already
   drawn values**. `defense-run-simulation.js:1518` is explicit: the RNG is positional, and one extra
   `rngNext` shifts wave composition, timing jitter, lane offset, spawn direction and policy for the
   whole run. Derive the angle from the existing draw (e.g. `laneOffset`, `waveIndex`, `spawnIndex`),
   or accept a digest change and re-baseline it in the same commit — there is no third option.
3. Record the digest before and after: `getRunDigest()` on `${fixtureSeed}` at a fixed tick for all
   three stages. Report each value. If it moved, say exactly which suites re-baseline and why the
   move was necessary.
4. Emit `grade` and `telegraphTicks` on `ENEMY_SPAWNED`. Use the authored arrival tiers 30 / 60 / 90
   by grade. `${arrivalGrade}` must be `SHADOW` only when the arrival carries information the player
   must act on before it lands — `emerge` and `skydrop` inside the player's radius always qualify;
   an edge `abreast` walk-in does not.
5. Guarantee the arming window. For `emerge` and `skydrop`, the body must be visible and readable for
   the full `telegraphTicks` before its first attack can resolve. Prove it with the tick numbers, not
   with an assertion that it "feels fair".
6. Spend the pool honestly. The `spawn` family live budget is **4**. A twelve-body encirclement is
   **one formation cue plus per-actor entry animation** — entry clips cost no pool slot. Twelve cues
   is a defect.
7. Route the entry clip through the existing motion profile rather than authoring a new speed.
   `motionProfileFor(targetHeight)` scales `oneShotRate` within 0.72–1.15 against
   `MOTION_PROFILE_REFERENCE_HEIGHT = 1.7`, applied as `timeScale`, so a 4.5-unit boss drop reads
   heavy without a new clip and without touching determinism.
8. Verify the failure modes: two formations overlapping in one wave, a formation at the `spawn`
   family cap, a formation interrupted by stage switch, `dispose()` mid-entry, reduced motion, and
   the lowest quality tier. Under reduced motion the entry resolves instantly to the authoritative
   position — `setReducedMotion(true)` already clears knockbacks, camera shake and the stage intro,
   and the entry must follow the same rule.

**FORMAT:**
Markdown at `_workspace/current/engineering/arrival-${formationId}-${stageId}.md`: the
simulation/renderer split table, the spawn geometry with its RNG derivation, a digest table with
before/after per stage, the grade and telegraph tier assignment with the fairness arithmetic, the
pool accounting for the worst-case wave, and the failure-mode checklist with pass/fail per row.
Every number `[OBSERVED]` with the command that produced it.

**TARGET AUDIENCE:**
The simulation owner, who will reject any RNG change that is not accounted for, and the QA session
running prompt 18, which re-runs the digest and the stage-doctrine suites.

**HARD CONSTRAINTS:**

- Spawn positions are simulation state. The renderer may never compute or adjust them.
- One extra `rngNext` is a whole-run behaviour change. Either derive from existing draws or
  re-baseline the digest in the same commit and say so.
- `ENEMY_SPAWNED` has exactly one emit site. Adding a second one forks the arrival contract; extend
  the existing payload instead.
- `grade === "SHADOW"` removes a slot from a 40-slot pool. Grade up only what the player must act on.
- The `spawn` family live budget is 4, regardless of body count.
- No formation may place a body within attack range with less than its `telegraphTicks` of readable
  warning.
- Entry animation is `timeScale` on an existing clip via `motionProfileFor()`. Do not author a new
  clip in this step; that is prompt 13.
- Under reduced motion the entry is instantaneous and the body is at its authoritative position.

**DONE WHEN:**
`getRunDigest()` is reported before and after for all three stages on `${fixtureSeed}`, `grade` and
`telegraphTicks` are emitted and consumed end to end, the arming window is proven in ticks, the
worst-case wave stays inside the `spawn` budget of 4 and the pool cap of 40, the failure-mode
checklist is fully green, and `node --test tests/defense-run-simulation.test.mjs
tests/combat-presentation-contract.test.mjs` passes or its re-baseline is justified with numbers.
