# 22 — Difficulty budget (level level-setting)

- **Version** v1 (2026-07-31)
- **Skill** `/skill:game-studio-harness` (numeric-balance designer role; combine with
  `/skill:data-analysis` when reading simulation output, `/skill:build-game-inventory` when the
  power curve moves)
- **Produces** the numbers for `${stageId}`: hold, wave count, cadence, kind rhythm, class rotation,
  mid-boss class, and the derived body counts — each one an arithmetic consequence of the clear
  budget, not a taste call.
- **Placeholders** `${stageId}`, `${sequence}`, `${briefPath}` (20), `${holdSeconds}`,
  `${waveCount}`, `${scale}`.

---

**CONTEXT:**
Wave size in *Abyssal Surge* is derived, never authored (`buildDoctrineWavePlan`,
`defense-catalog.js`):

```
cadence      = floor(defenseTicks / waveCount)                 // ticks, TICK_RATE = 60
clearableHp  = (cadence / 60) * PLAYER_BASELINE_DPS            // 2250 dps, bare commander
waveHp       = clearableHp * 5500bp * kind.countBp * rampBp    // 0.55 * kind * ramp
count        = round(waveHp * share / (ENEMIES[class].hp * scale / 100))
```

- `PLAYER_BASELINE_DPS = 2250` is `COMMANDER.basicDamage 900` per `basicCooldown 24` ticks. It is
  the FLOOR: companions, items, rewards, skill ranks and carry-over are headroom on top.
- `WAVE_PRESSURE_BP = 5500` — a normal wave asks 55 % of one cadence slot, so a clean wave clears
  and pays its `WAVE_CLEARED` recovery while a sloppy one leaks into the next.
- `rampBp` = `10000 + floor(slot * 3000 / (waveCount - 1))` → 100 % on slot 0, 130 % on the last.
- `WAVE_KIND_PROFILE.countBp`: normal 10000, big 17500 (split 60/40 across two classes), mid 5000.
- `MIDBOSS_PROFILE`: HP = 60 % of one cadence budget, damage ×1.6, speed ×0.85, radius ×1.4, xp ×4.
- `budgetComposition()` DROPS a class whose single body costs more than its share and hands the
  share to the other class — that is why a guardian remix does not silently become 3× its primary.
- Because `scale` is in the divisor, a late stage fields FEWER, TOUGHER bodies at the same budget.

OBSERVED 2026-07-31 (post-retune):

| Stage | cadence | clear budget | worst wave HP | ratio | mid-boss HP |
|---|---|---|---|---|---|
| `cinder-span` | 1020 t / 17.00 s | 38 250 | 48 000 | 1.25× | 22 950 |
| `abyss-chancel` | 1050 t / 17.50 s | 39 375 | 49 680 | 1.26× | 23 625 |
| `echo-throne` | 981 t / 16.35 s | 36 788 | 46 280 | 1.26× | 22 073 |

**ROLE:**
You are a numeric-balance designer who signs each number against a measurement. You treat "the
enemies feel spongy" as an unusable report and ask for the ratio that produced it. You never buy
difficulty with an HP multiplier when a new required answer is available.

**ACTION:**

1. Restate the brief's response-type delta from `${briefPath}`. If the delta is zero, this change is
   a *tuning* change, and you must say what player experience the retune buys instead.
2. Fix the frame: `${holdSeconds}` (must land in 160–250 s), `${waveCount}` (≥ 10), and therefore
   cadence = `floor(holdSeconds * 60 / waveCount)`; the cadence must be ≥ 600 ticks so each wave has
   ≥ 10 s of clear-up room, and even across the whole plan.
3. Compute the clear budget and, per slot, the derived `waveHp` and body count for both the primary
   and the remix composition. Show the arithmetic; do not report a count without its budget line.
4. Assert the cap: no wave may exceed 2.0× the clear budget
   (`tests/stage-wave-doctrine.test.mjs`). Report the worst ratio and the slot that produced it.
5. Size the mid-boss from the same budget, and state the time-to-kill at floor DPS
   (`hp / 2250` seconds). Anything past ~12 s is a wall the gate-defense hold cannot absorb.
6. Set the density levers explicitly and separately from the HP budget: `maxConcurrentEnemies`,
   `bigWaveMaxConcurrentEnemies`, `spawnIntervalTicks`, `bigWaveSpawnIntervalTicks`,
   `commitmentCap`, `bigWaveCommitmentCap`. The interval is what makes a big wave *read* as a wave;
   the ceiling alone does nothing. Concurrency above the shipped 22/24/26 is blocked on instanced
   rendering (one skinned GLB per actor today, 180 draw-call budget), not on design.
7. State the difficulty claim in response-type terms and confirm the campaign still escalates:
   16 → 17 → 17 today; a retune may not lower a later stage below an earlier one.
8. State every knob you deliberately did NOT move, and why. A change that moves hold, count, cadence,
   classes, rhythm and caps at once cannot be attributed by the simulation in step 25.

**FORMAT:**
A markdown table set appended to `${briefPath}`: frame, per-slot budget arithmetic, cap check,
mid-boss TTK, density levers, response-type delta, untouched-knob list. Then the exact proposed
`STAGE_WAVE_DOCTRINE` / `STAGE_ENCOUNTER_ROUTES` literal in the file's existing style, ready for
prompt 23. No prose inside code blocks.

**TARGET AUDIENCE:**
The implementing session, and the harness reviewer who will re-derive every count from the budget
formula and reject any number that does not reproduce.

**HARD CONSTRAINTS:**

- Never author a body count directly. Author the budget inputs and report the derived count.
- Never raise `scale` to create difficulty. `scale` is the stage's HP identity (100 / 115 / 130) and
  climbing it alone is the exact anti-pattern this track exists to prevent.
- Hold 160–250 s, waves ≥ 10, cadence even and ≥ 600 t, last wave `big`, ≥ 2 `mid`, ≥ 2 `big`.
- Wave HP ≤ 2.0× the cadence clear budget, every slot, every stage.
- Mid-boss HP comes from `MIDBOSS_PROFILE.hpBudgetBp`, never from a class multiple.
- Determinism: same seed ⇒ same `getRunDigest()`. Any doctrine change alters the digest of that
  stage only; report it (prompt 25).
- No Unity/Unreal balancing tooling assumptions; the only authority is this repository's simulation.

**DONE WHEN:**
Every proposed number has a derivation line, the worst wave/budget ratio is reported and ≤ 2.0×, the
mid-boss TTK is reported, the density levers are listed separately from the HP budget, and the
response-type delta is stated. No file has been edited yet.
