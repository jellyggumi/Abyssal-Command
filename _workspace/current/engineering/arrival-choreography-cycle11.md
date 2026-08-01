# Arrival choreography — simulation slice

Prompt: `prompts/approved/11-arrival-choreography.md`. Decision taken: **draw from the RNG**
(operator approval, this session).

## 1. The decision, and what it actually cost

The prompt framed the choice as "derive from existing draws (digest stable)" vs "draw fresh and
re-baseline". The codebase offered a third option that neither the prompt nor the framing
anticipated, and it is strictly better than both: a **derived stream**.

`run.rng` is the wave-schedule and growth-offer stream, and `defense-run-simulation.js:1518`
records that every draw on it is positional. The runtime already solves this for four other
consumers — `combatRng` (`seed ^ 0x9e3779b9`), `dropRng` (`^ 0x85ebca6b`), the surprise roll
(`^ 0x6d2b79f5`), `gimmickRng` (`^ 0xc2b2ae35`). Arrival choreography now has its own:
`arrivalRng = rngNext(seed ^ 0x27d4eb2f)`, Knuth's 32-bit mixing constant, distinct from all four.

Result: full random freedom for formations, and wave composition/timing/lane/direction/policy/
growth offers provably unchanged. `getRunSnapshot` never serialised RNG state
(`defense-run-simulation.js:5063`), so the stream itself adds nothing to the digest.

## 2. Digest evidence [OBSERVED]

Measured with `scripts/qa-arrival-digest-baseline.mjs`. Both columns run against the **same
working-tree catalog**, using a temporary `git show HEAD:defense-run-simulation.js` module so the
comparison isolates this change from a concurrent session's edits.

| Window | digest | waveVariantId |
|---|---|---|
| 9 long windows (3 stages x seeds 1/7/42, 3600 ticks, growth answered) | **9/9 MOVED** | **0/9 moved** |
| `cinder-span/71/500 +ember-cohort` | IDENTICAL | — |
| `cinder-span/71/500 bare` | IDENTICAL | — |
| `abyss-chancel/71/1000 bare` | IDENTICAL | — |
| `echo-throne/12/500 bare` | IDENTICAL | — |

Digests move exactly where bodies moved, and nowhere else. The four `PRE_FEATURE_DIGEST_SHA256`
fixtures did **not** require re-baselining.

Formation census over those 9 windows (`arrivals` column of the harness): all five formations
observed, `9/9 windows actually reached a non-lane formation`.

### Two measurement defects found and fixed before trusting any of the above

1. **The first harness measured nothing.** `advanceDefenseRun(run, 3600)` is immutable *and*
   halts at the first growth offer — tick 457-834 on these stages, before wave 1 spawns (~980).
   The window never contained a formation, so it reported "no change" for a feature it never
   reached. The harness now answers growth offers, and prints a census plus an explicit
   `N/9 windows actually reached a non-lane formation` line so this cannot recur silently.
2. **The first implementation moved digests for the wrong reason.** Storing `arrivalFormation` /
   `arrivalGrade` / `arrivalTelegraphTicks` on the body put them in `sortedActors`, so *every*
   run's digest moved — including runs whose every wave drew `lane`. Removed; the formation is
   carried on the `ENEMY_SPAWNED` event instead (events are not part of the snapshot, and the
   renderer already consumes that event). This is the same conditional-presence discipline
   `abyssDepth`, `measurementProfileId` and `buffs` follow.

## 3. What shipped

| Formation | Grade | Telegraph | Placement |
|---|---|---|---|
| `lane` | BASIC | 30 | unchanged `spawnPoint()` — byte-identical to before |
| `abreast` | BASIC | 30 | same edge, spread across the lane at 900 spacing, centred on the authored lane |
| `encircle` | SHADOW | 60 | even ring at radius 2600 around the commander |
| `emerge` | SHADOW | 90 | scattered 1800-2600 from the commander |
| `skydrop` | SHADOW | 90 | scattered 1800-2600; also the mid-boss entrance |

- **Fairness.** Near-player arrivals write their telegraph into **both** `attackCooldown` and
  `rangedCooldown`, so the advertised window is the enforced window — a ranged body cannot open
  fire from inside the ring. `ARRIVAL_NEAR_RADIUS_MIN` 1800 is exactly twice the largest contact
  range in the catalog (guardian 540 + commander 360), and inside `COMMANDER.basicRange` 6000.
- **Budget.** At most `ARRIVAL_NEAR_CAP = 4` bodies per wave arrive near the player, equal to the
  renderer's `NEW_VFX_FAMILY_LIVE_BUDGET.spawn`. The remainder fall back to `lane`, so a large
  wave reads as ambush-then-push and the renderer never sees a 5th arrival cue.
- **Wave 0 never ambushes**, so the stage intro dolly is never fought through.
- **Route consumption.** A near arrival sets `waypointIndex` past its route, because a body that
  materialised past its approach must not walk back to a west entry waypoint. The authored route
  is preserved on the body and on the event for the encounter contract.
- **The dead hook is now live.** `ENEMY_SPAWNED` emits `grade` and `telegraphTicks`. The renderer
  has always branched on both (`isCriticalVfxEvent`, `resolveVfxLifetimeTicks`) but nothing
  emitted them, so the SHADOW pool exemption and the 60-tick arrival telegraph were unreachable
  and every arrival resolved to the 30-tick fallback and stayed evictable.

## 4. Verification [OBSERVED]

| Command | Result |
|---|---|
| `node --test tests/arrival-choreography-contract.test.mjs` | 12 tests, 12 pass, 0 fail |
| ten-suite presentation gate (see `prompts/approved/18`) | 129 tests, 129 pass, 0 fail |
| `node --test tests/defense-run-simulation.test.mjs tests/stage-wave-doctrine.test.mjs` | 50 tests, 49 pass, **1 fail** — see §5 |
| `node --test tests/stage-world-encounter-routing-contract.test.mjs tests/stage-world-quest-points.test.mjs tests/stage1b-pressure-packets.test.mjs tests/aoe-burst-wide-hit-contract.test.mjs` | 30 tests, 30 pass, 0 fail |

The new suite asserts the properties, not the existence: derived-stream non-interference, the
arming window on both cooldowns, the fairness radius, the 4-slot budget, wave-0 exclusion, route
consumption, legacy-save rehydration, and a guard that fails if the window stops exercising
formations at all.

## 5. Not mine: `echo-throne/12/500 bare`

`tests/defense-run-simulation.test.mjs` "gate check 1" fails on the `echo-throne` fixture. It is
**not** caused by this change:

```
stored baseline SHA        : cf3f32b176712c9cfec62be5c071645c342e714962a9db96298b02237ef46b32
HEAD sim + CURRENT catalog : 01972547729aa402735cb70eef54c126a816ec062bc2e165a511e04de825107a  != stored
MY   sim + CURRENT catalog : 01972547729aa402735cb70eef54c126a816ec062bc2e165a511e04de825107a  != stored
HEAD sim vs MY sim         : IDENTICAL -> my change is NOT the cause
```

A concurrent session modified `defense-catalog.js` `STAGE_WAVE_DOCTRINE["echo-throne"]` during
this work (classes `+rusher`, `kindCycle` -> 5-slot rotation, `midbossEnemy` guardian -> ranged),
which legitimately moves that stage's digest. Re-baselining that constant belongs to the session
that made the change. Left untouched per `CLAUDE.md` §5.

## 6. Fixed on the way: a latent bug in the stage1b auditor

`scripts/run-stage1b-pressure-packets.mjs` attributed a passive integrity grant using the flat
catalog value, assuming every `SKILL_SELECTED` was a first acquisition. `applySkillRankEffects`
grants `SKILL_RANK_PASSIVE_SHARE` (0.5) of the authored value on a rank-**up**, so the moment a
run ranked `ward-binder` up, the auditor expected 120 where the simulation applied 60 and reported
an unobservable delta.

Verified as latent, not new: pure HEAD in an isolated worktree, with the current catalog, passed —
this change shifted *which rank* was selected at tick 8548 and exposed it. Fixed at the source by
reading `event.rank`, which the emit already carries. Rank-1 selections are unchanged (`* 1`).

## 7. Not done in this slice

The **renderer entry presentation** is not implemented. `emerge` and `skydrop` currently place the
body correctly, telegraph correctly, and emit a SHADOW-graded arrival cue the renderer now pools
as critical — but the body does not yet visually rise from the floor or fall from the sky. That is
prompt 14 work (a render-space vertical offset over the telegraph window, following the knockback
precedent, plus a reduced-motion branch resolving instantly to the authoritative position).

Knockback strengthening (prompt 12) is also not started.

---

# Revision — retrospective pass

A full-regression sweep after the first pass found four defects. Three were mine.

## R1. Gate-bound bodies were arriving on top of the player [MINE, fixed]

`tests/defense-expansion-contract.test.mjs` "gate pressure advances toward the gate" failed. Proved
mine with an isolated HEAD worktree carrying the current catalog (17/17 there, 15/17 here).

Root cause was a real design defect, not a test conflict: any policy could take a near-player
formation. A `gate-pressure` body dropped beside the commander skips the approach the whole defense
loop is built on, and when the commander is standing near the gate it lands at its objective for
free — measured at 1161 units from the gate, moving 0.

Fixed with `ARRIVAL_NEAR_POLICIES`: only `player-pursuit`, `low-hp-focus` and `resource-denial` may
arrive inside the commander's space, corroborated by `pressureTarget()`, which resolves exactly
those three to the player side. `gate-pressure`, `flank` and `elite-escort` keep their lane.
Rule: **things that want you come to you; things that want the gate walk the lane.**

## R2. `skydrop` never fired, and `abreast` stopped firing [MINE, fixed]

Two separate faults the coverage guards caught:

- The restructure in R1 collapsed *every* non-near formation to `lane`, killing `abreast`. Edge
  formations change where a body enters, not what it skips, so they are now unconditional.
- `skydrop` was confined to `big` waves. A big wave must *also* contain a player-facing body, and
  across 84 enqueued waves that combination never once landed on it. A formation that never fires
  is a stub, so `skydrop` is now offered on normal waves too. `emerge` stays exclusive to `big`.

Formation draw is now conditioned on the wave's composition (`ARRIVAL_EDGE_CANDIDATES` when the
wave has nothing player-facing), so a near formation is offered only to a wave that can perform one.
Still exactly one draw per wave.

## R3. The arena clamp could breach the fairness floor [MINE, fixed]

`arrivalPoint` clamped the ring to the arena. With the commander fighting near a wall the clamp
collapsed the arc onto the edge and placed a body **808** units away against an authored floor of
1800. `arrivalPoint` now treats the angle as a preference: if the clamp ate the distance it
re-projects to the opposite side, which by construction points back into the arena.

## R4. Two stale assertions, fixed at source [NOT mine in origin, exposed by mine]

- `tests/stage-world-encounter-routing-contract.test.mjs` checked `committedAttackerCount` against
  the flat `route.commitmentCap` (3 on cinder-span) while `refreshAttackerCommitment` deliberately
  slices by `waveConcurrencyCeilings()`, which raises it to `bigWaveCommitmentCap` (7) during a big
  wave. The assertion **immediately below it** already carries this exact fix for the concurrency
  ceiling, citing decision-log D-20260730-04 — the sibling line was simply missed. Both the ceiling
  check and the `maxObserved` boundary check now use the two-ceiling rule.
- `scripts/run-stage1b-pressure-packets.mjs` (first pass) attributed passive integrity at rank-1
  value; fixed by reading `event.rank`.

## R5. My own test was measuring the wrong moment [MINE, fixed]

Two harness defects that manufactured phantom failures:

1. While a growth offer holds the run, `advanceDefenseRun` returns without advancing and the same
   `ENEMY_SPAWNED` stays on the snapshot. Re-reading it paired one spawn with a commander position
   from a later tick. De-duped by entity id.
2. The fairness floor was asserted against the body's **live** position. It is a *placement*
   guarantee, not a permanent standoff — a body placed correctly at 1863 read as 857 once it had
   closed, which is the ambush working. `ENEMY_SPAWNED` now carries `arrivalDistance`, measured at
   placement, which the renderer also needs to scale an `emerge` rise or a `skydrop` fall.

The harness `scripts/qa-arrival-digest-baseline.mjs` also ran a 3600-tick window (~4 waves) and
double-drove every run. Now 9000 ticks, single pass, matching the contract test.

## Verification after the revision [OBSERVED]

| Command | Result |
|---|---|
| arrival + expansion + routing + quest + variation + wave + stage1b-pressure | 64 tests, 64 pass, 0 fail |
| ten-suite presentation gate | 129 tests, 129 pass, 0 fail |

Formation census, 9 windows x 9000 ticks: all five formations present in volume
(`abreast` 217, `lane` 300, `skydrop` 49, `encircle` 24, `emerge` 4).

## Still open, and NOT mine

- `tests/defense-run-simulation.test.mjs` gate check 1, `echo-throne/12/500 bare`.
- `tests/stage1b-persistence.test.mjs` test 11, exporter CLI.

Both reproduce at pure HEAD with the current catalog, so both belong to the concurrent
stage-doctrine/variation session.

## Also observed

`node --test 'tests/**/*.test.mjs'` did not finish inside 30 minutes. The full gate is currently too
slow to run in a normal edit loop; `--test-concurrency=8` over the non-slow subset covered 380 tests
in ~25 min.
