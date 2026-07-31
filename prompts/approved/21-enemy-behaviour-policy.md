# 21 — Enemy behaviour policy

- **Version** v1 (2026-07-31)
- **Skill** `/skill:tune-enemy-ai` (narrowest match; `/skill:build-game-monster-system` when the
  change adds an archetype, `/skill:design-action-combat` for step timing)
- **Produces** the behaviour half of a pattern change for `${stageId}`: which policy each body
  carries, which attack pattern it runs, and which AI response answers each telegraph — as a state
  machine, before any number moves.
- **Placeholders** `${stageId}`, `${archetypeId}`, `${policyId}`, `${briefPath}` (output of 20).

---

**CONTEXT:**
Behaviour in this repository is data, and it is already complete enough to reason about:

- `ENEMY_POLICIES` (6): `gate-pressure`→gate/breach, `player-pursuit`→commander/attack,
  `flank`→gate/flank, `resource-denial`→echo-pickup/deny, `elite-escort`→elite/escort,
  `low-hp-focus`→lowest-hp-friendly/focus.
- Class defaults: rusher `gate-pressure`, flanker `flank`, guardian `elite-escort`,
  ranged `resource-denial`.
- The seeded pool in `buildWaveSchedule()` (`defense-run-simulation.js`) rolls the wave's policy
  from `rusher: [gate-pressure, player-pursuit, low-hp-focus]`, `flanker: [flank, low-hp-focus]`,
  `guardian: [elite-escort, gate-pressure]`, `ranged: [resource-denial, player-pursuit]` — **only**
  when the wave pins no policy. Pinning every wave deletes those behaviours from the game.
- `ABYSS_DEPTH_PACKAGES` 1–3 override the normal-wave policy mix per wave index, without advancing
  the RNG stream (the depth is read, never rolled).
- `ATTACK_PATTERNS` are ordered looping steps of telegraph / active / recovery ticks with a shape
  (`disc` on the attacker, `lead` on the target, `ring`), a radius, a damage share in bp, and an
  optional lingering `fieldTicks`. `samplePattern(patternId, elapsedTicks)` is pure and total, so a
  pattern fixture is reproducible without playing the encounter.
- `AI_RESPONSE_PATTERNS` answer those telegraphs: `evade` (45 t, +3500 bp speed, 2500 bp rim
  clearance), `spread` (≥ 2 bodies, 60 t, 6000 bp separation), `punish` (60 t, allied cooldown
  ×0.70), `brace` (30 t, incoming ×0.65).
- `GATE_PRESSURE_RELEASE_LEAD` gives each non-gate policy a lead before it is released toward the
  gate: `player-pursuit` 360, `resource-denial` 240, `low-hp-focus` 240, `flank` 120 ticks.

**ROLE:**
You are an enemy-AI engineer who writes behaviour as an explicit state machine with named
transitions and deterministic fixtures. You never express a behaviour difference as a stat change,
and you never ship a telegraph the player has no counter to.

**ACTION:**

1. Read `${briefPath}` and restate, per fielded archetype, the answer the brief demanded.
2. For `${archetypeId}`, write the state machine: `spawn → approach(route) → engage(policy target)
   → attack(pattern step) → recover → (retreat|re-engage)`, naming for each transition its trigger,
   its tick budget, and its observable event (`ENEMY_SPAWNED`, `ENEMY_POLICY_SELECTED`,
   `MIDBOSS_SPAWNED`, `ESCORT_LEADER_ACQUIRED`, `ESCORT_RETREATED`, `PICKUP_DENIED`).
3. State which policy the body carries and *how it got there*: class default, wave pin, seeded pool
   roll, or depth-package override. If the change pins a policy on a normal wave, justify deleting a
   seeded behaviour from that stage.
4. State the pattern the body runs, step by step, in ticks: telegraph / active / recovery, shape,
   radius, `damageBp`, `fieldTicks`. Prove the telegraph is longer than the player's reaction floor
   and that the recovery window is long enough for `punish` (60 t) to be worth taking.
5. Name the AI response each telegraph is supposed to provoke, and the geometry that makes it
   possible (room to evade outside the rim, ≥ 2 bodies for `spread`, a recovery window for
   `punish`, an unavoidable case that justifies `brace`).
6. For a mid-boss, state the answer its base class forces once `MIDBOSS_PROFILE` is applied:
   damage ×1.6, speed ×0.85, radius ×1.4, xp ×4.0, HP = 60 % of one cadence clear budget. A ranged
   mid-boss must be closed on; a guardian mid-boss must be out-traded. Say which one this is.
7. Specify deterministic AI fixtures: seed + tick offset for each transition, and the assertion that
   proves it (position delta toward the policy target, emitted event, phase from `samplePattern`).
8. State the digest impact. Any change to draw order or draw count in `buildWaveSchedule()` or
   `spawnEnemy()` is a whole-run behaviour change: report `getRunDigest()` before and after, for
   every stage, or state that no RNG draw was added.

**FORMAT:**
A markdown section appended to `${briefPath}` (state machine, policy provenance, pattern step table,
response mapping, fixtures, digest statement) plus, when catalog data changes, the exact literal for
`ENEMY_POLICIES` / `ATTACK_PATTERNS` / `AI_RESPONSE_PATTERNS` in the file's existing one-entry-per-
line style. No prose inside code blocks.

**TARGET AUDIENCE:**
The implementing session and the deterministic-AI reviewer, who will re-run the fixtures and diff
the digest.

**HARD CONSTRAINTS:**

- Behaviour before numbers: this prompt may not change HP, counts, cadence, or `scale`.
- The seeded policy pool must survive. At least the normal waves of `${stageId}` stay unpinned.
- `evade`/`spread`/`punish`/`brace` windows are shared constants; changing one changes every
  encounter in the game and requires the full regression, not just this stage's suites.
- The renderer may read behaviour state and may never write it back (`CLAUDE.md` §2).
- Any added RNG draw is reported as a digest change, never silently absorbed.
- No Unity/Unreal behaviour-tree concepts. Three.js + WebGL, plain data + pure functions.

**DONE WHEN:**
Every fielded archetype has one state machine, one policy provenance, one pattern step table and one
named counter-response; every fixture is a seed + tick + assertion; and the digest statement is
explicit. `node --test tests/defense-expansion-contract.test.mjs` passes (it asserts gate pressure,
flank routing, resource denial, elite escort acquisition/retreat, pursuit and low-HP focus).
