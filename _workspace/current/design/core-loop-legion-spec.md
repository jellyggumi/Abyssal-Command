# Core loop, legion capacity, analog input, aim targeting — cycle 9 spec

owner: game-designer
gate inputs: G2 (balance), G3 (편성), G7 (core loop)
status: all numbers below are `[TARGET]` until QA measures them

Reference framing lives in `intake/reference-video-analysis.md`. Code seams cite
the four cycle-9 discovery reports. **Every value here is a target, not a
measurement**, and none of it promotes a gate.

---

## 1. Loop shape

### Current (cycle 8)

```
gate-defense → echo-recovery → growth → occupation → boss-kill → extraction → complete
```

Extraction is the **last** objective and opens only after `occupationProgress.captured`
AND the boss is defeated (`openExtractionWindow`, `defense-run-simulation.js:2577-2590`).
Its payload is a binary `run.extracted = true` flag (`processInput`, `:2160-2200`).

### Target (cycle 9)

Extraction becomes a **standing capability unlocked mid-run**, not a terminal
objective:

```
gate-defense → echo-recovery → growth → occupation → boss-kill → extraction → complete
                                   ▲
                     first midboss defeated
                     ⇒ extractionUnlocked = true
                     ⇒ corpses of midboss/elite/boss become extractable
                        for the remainder of the run
```

The 7-phase array (`updateObjectivePhase`, `:2592-2628`) is **not reordered**. The
terminal `extraction` objective stays exactly as it is — that objective is the
*run-completion elite extraction*, and PR #10's depth-0 identity plus the existing
objective tests depend on it.

What is added is an orthogonal capability flag. This distinction is load-bearing:

- `run.objectives.extraction` — terminal objective, **unchanged semantics**
- `run.extractionUnlocked` — new boolean, flips on first midboss defeat, gates
  in-run corpse extraction

Conflating the two would break `stage contract 12/12` and the objective-phase tests.

### Unlock trigger

Set `run.extractionUnlocked = true` when an enemy with `kind === "midboss"` reaches
`hp <= 0` in `resolveDeaths()` (`:2209`). Once true it never reverts within a run.

`[TARGET]` Rationale for midboss as the gate: it is the first encounter that is
both *named* and *guaranteed to occur mid-run*, so the capability lands at a
legible beat rather than on an arbitrary timer.

---

## 2. Extraction: corpse → channel → companion

### Grade eligibility (fixes D2)

The deferred module declares all enemies extractable. Corrected table:

| Enemy `kind` | Corpse created? | Extractable? |
|---|---|---|
| `normal` | no | no |
| `elite` | yes | yes, once `extractionUnlocked` |
| `midboss` | yes | yes, once `extractionUnlocked` |
| `boss` | yes | yes, once `extractionUnlocked` |

Trash mobs produce no corpse entity at all — this also bounds the corpse array,
which matters for the tick cost in §6.

### Timing contract

Adopted from the deferred module, unchanged, since these values are already
internally consistent at 60 Hz:

| Constant | Value | Meaning |
|---|---|---|
| `CORPSE_DURATION_TICKS` | 600 | corpse persists 10 s |
| `EXTRACTION_CHANNEL_TICKS` | 120 | channel takes 2 s |
| `EXTRACTION_RANGE` | 1200 | world units, commander must stay inside |

Channel breaks if the commander leaves range (`out-of-range`) and does **not**
resume from partial progress — the channel entry is deleted. `[TARGET]` This is
the deferred module's existing behavior and is kept so a contested extraction is a
real decision.

### Companion stat inheritance

`GRADE_COMPANION_MULTIPLIERS` from the deferred module, retained:

| Grade | damage× | fireTicks× | hpInherit | defaultRange | loyalty |
|---|---|---|---|---|---|
| BASIC | 1.5 | 0.8 | 0.30 | — | — |
| SHADOW | 1.8 | 0.75 | 0.40 | — | — |
| BOSS | 2.0 | 0.7 | 0.50 | 5200 | 150 |

Because `normal` enemies no longer yield corpses, the `BASIC` row applies only to
`elite`. Map `elite → BASIC`, `midboss → SHADOW`, `boss → BOSS`.

### ID generation (fixes D1 — mandatory, blocking)

**Do not** use the deferred module's module-level counters. Replace every ID site
with the repo's existing run-scoped primitive:

```
corpse id     ← nextId(run, "corpse")
companion id  ← nextId(run, "extracted")
```

`nextId(run, kind)` already backs `spawnEnemy`/`spawnBoss` and is seeded per run.
`Math.random()` is forbidden (`engineering/migration-map.md:82`). This fix is a
precondition for integration, not a follow-up.

---

## 3. Legion capacity: dynamic 3 → 10

### Constants

| Name | Value | Note |
|---|---|---|
| `COMPANION_CAPACITY_BASE` | 3 | replaces the meaning of `MAX_LOADOUT_SIZE` |
| `COMPANION_CAPACITY_MAX` | 10 | absolute ceiling, used by load-time validation |

### Unlock ladder

Seven unlockable slots (4th through 10th). Each requires **both** a stage-clear
gate and a Bound Fragment payment — level alone is insufficient, matching the
request (`레벨과 특정 조건(비용지불등)에 따라 해금`).

| Slot | Requires stage clears ≥ | Bound Fragment cost | Cumulative cost |
|---|---|---|---|
| 4 | 1 | 1 | 1 |
| 5 | 2 | 1 | 2 |
| 6 | 3 | 2 | 4 |
| 7 | 4 | 2 | 6 |
| 8 | 6 | 3 | 9 |
| 9 | 8 | 3 | 12 |
| 10 | 10 | 4 | 16 |

`[TARGET]` **Budget conflict, flagged for PM negotiation, not silently resolved:**
Bound Fragment earning is `campaign.resolvedIds.length`, capped at **10**
(`campaign-state.js:124`). Full slot unlock costs **16**. Equipment tiers already
compete for the same currency at 10 per slot to T5 (`rpg-catalog.js:190-191`).

The ladder as written is therefore **not affordable** within the current budget.
Three candidate resolutions, none chosen by the designer alone:

1. Raise Bound Fragment earning (changes economy pacing, PM owns)
2. Introduce a second currency for slots only (adds a system)
3. Lower cumulative slot cost to ≤6 so slots and one full equipment line coexist

This is exactly the designer↔PM coupling the harness requires a **signed
negotiation record** for. Implementation must ship the ladder as **data**, so the
numbers can change without touching logic.

### Validation placement (fixes the circular-validation hazard)

Confirmed from `campaign-state.js`: `validCampaign()` checks loadout length at
line 281 **before** validating `resolvedIds` at line 282, and there is **no
precedent** for derived-budget validation inside `validCampaign()` — the
Bound Fragment budget check runs only inside the mutator
`purchaseEquipmentTier()` (:574).

Therefore:

- **Load time** (`validCampaign`, line 281): validate against the literal
  `COMPANION_CAPACITY_MAX` (10). Never call a capacity resolver here — a tampered
  save must not self-certify its own capacity.
- **Mutation time** (`setCompanionLoadout`, line 503): validate against
  `companionCapacityForCampaign(campaign)`, the derived unlocked capacity.
- **Run time** (`addCompanion`, `defense-run-simulation.js:643-667`): add the
  missing capacity gate (fixes D3).

Three checkpoints, three different bounds. This is deliberate.

---

## 4. Analog movement input {#analog}

### The actual defect

There is no virtual keypad. `app.js:2372-2378` computes
`Math.atan2(dy,dx)/(π/4)` and **rounds to one of 8 octants**
(`JOYSTICK_OCTANTS`, `:74`), then sends a direction *string*. The stick is
already there; it throws its precision away. Keyboard does the same via
`DIRECTION_BY_VECTOR` (`:70-73`).

### Payload extension — the existing seam

`processInput` already accepts an object payload:

```js
// defense-run-simulation.js:2108
const direction = typeof input.payload === "string" ? input.payload : input.payload?.octant;
```

So `{ octant, analog }` is accepted today without changing the accepted-type list.

### Integer-millis contract

`OCTANT_VECTORS` are **integer millis at magnitude 1000**
(`E:{x:1000,y:0}`, `NE:{x:707,y:-707}`) and movement is
`Math.trunc(vector.x * speed / 1000 / TICK_RATE)` (`:2874`).

Analog therefore uses the **identical representation**:

```
payload = { octant: "<nearest octant string>", analog: { x: int, y: int } }
```

- `x`, `y` are integers in `[-1000, 1000]`
- magnitude clamped so `hypot(x,y) ≤ 1000`
- the client quantizes to integers **before** sending; the sim never sees a float

Integers in → `Math.trunc` → integers out. Determinism is preserved by
construction, and analog is a strict generalization of the octant table rather
than a parallel code path.

### Digest safety (fixes D4 — mandatory)

`getRunSnapshot():3510` is `commander: run.commander`, so the whole object enters
the digest. Adding an always-present field breaks depth-0 byte-identity and every
stored digest fixture.

### Integer-truncation bounds — measured, not assumed

Per-axis `Math.trunc` at `:2874-2875` can in principle produce two analog-only
artifacts that octants can never expose: a **silent dead zone** (low deflection
truncating to zero movement) and **per-axis truncation bias** (shallow angles
losing their minor axis). Both were quantified rather than guessed.

`getCommanderSpeed()` (`:1142-1149`) carries exactly **one** multiplier — the
occupation `moveMultiplier`, default **1.15**, an *increase*. There is no slow,
debuff, or terrain penalty. **Minimum reachable commander speed is
`COMMANDER.speed` = 4100.**

Measured at speed 4100:

| Quantity | Value |
|---|---|
| Minimum analog millis that produces motion | **15** |
| Dead-zone threshold (0.22 × 1000) | **220** |
| Margin | dead zone masks the truncation floor by **14×** |
| Worst heading error, full deflection | **0.79°** (at 5°) |
| Worst heading error, minimum live deflection (250) | **3.0°** |
| Diagonal vs cardinal speed fidelity | 67.88 vs 68.00 units/tick (0.18 % loss) |

Error only becomes perceptible if speed drops far below anything reachable:
3.0° at speed 1000, 17° at 200, 36.5° at 100. At those speeds the truncation
floor (300, 600 millis) would also exceed the dead zone and create genuinely
dead input.

**Decision**: ship **no** magnitude floor. A `Math.max(1, ...)` guard — as used
by the pursuit branch at `:2864` — would be dead code here, because the state it
protects is unreachable while 4100 is the floor speed.

**Required guard instead**: a test asserting `getCommanderSpeed()` never returns
below the threshold at which the truncation floor reaches the dead zone
(speed ≥ 300). If anyone later adds a slow effect, that test fails loudly and
points here, rather than shipping a silent dead zone. The assumption is
load-bearing, so it must be enforced, not commented.

### Facing survives analog input — verified, thin margin

Facing is derived in the renderer from the **rendered position delta**
(`battle-realtime-three.js:3315-3336`), gated on `MOVE_EPSILON = 0.01` world units
so a standing actor does not spin on rounding noise. Analog input produces smaller
per-tick deltas than octants, so this gate could in principle suppress facing
updates during slow analog movement.

Checked against the coordinate mapping (24000 sim units across 28 world units):

| Analog deflection | Sim step/tick | World delta | Margin over `MOVE_EPSILON` |
|---|---|---|---|
| 220 (dead-zone edge) | 15 | 0.0175 | **1.75×** |
| 250 | 17 | 0.0198 | 2.0× |
| 500 | 34 | 0.0397 | 4.0× |
| 1000 (full) | 68 | 0.0793 | 7.9× |

Facing updates at **every live deflection**. But the tightest margin is only
1.75×, and it is the product of two independently-designed constants
(`JOYSTICK_DEAD_ZONE_RATIO = 0.22` in the client, `MOVE_EPSILON = 0.01` in the
renderer) that have no declared relationship. Lowering the dead zone below ~0.13
would push slow analog movement under the epsilon and **silently freeze facing
while the actor still slides** — a bug that would present as "my character
doesn't turn sometimes".

**Required guard — enforced, not commented.** This section originally prescribed
only a code comment. That was inconsistent with the speed guard above, which
demands a failing test for a **14×** margin; this coupling has a **1.75×** margin,
spans two files, and sits on the constant most likely to be retuned for feel. The
weaker mitigation was wrong.

Add a test asserting the *derived relationship*, not the literal values:

```
worldDelta(DEAD_ZONE_RATIO × 1000, floorSpeed) > MOVE_EPSILON
```

where `worldDelta(millis, speed) = Math.trunc(millis × speed / 1000 / TICK_RATE)
× WORLD_SPAN / ARENA.width`. The assertion must fail if `JOYSTICK_DEAD_ZONE_RATIO`
drops below ~0.13, if `MOVE_EPSILON` rises, or if the arena→world mapping changes.
Point its failure message at this spec section.

Both guards then have the same shape: the assumption is executable, so violating
it breaks a test instead of shipping a feel bug ("my character doesn't turn
sometimes") that no one would trace back to a dead-zone tune.

**Required pattern** — conditional presence, mirroring the codebase's own
`abyssDepth` handling at `:3498`:

- `run.commander.moveAnalog` is set **only** when a MOVE payload carries a valid
  `analog` object.
- Octant-only input (keyboard, buttons, and any existing replay/fixture) leaves
  the field **absent**, so the serialized commander is byte-identical to today.
- When absent, movement reads `OCTANT_VECTORS[run.commander.move]` exactly as now.

**Acceptance**: every existing digest/replay fixture must pass unmodified. If any
fixture requires editing, the implementation is wrong — revert and re-derive.

### Dead zone and gating

| Item | Current | Target |
|---|---|---|
| Dead zone | `0.22 × radius`, snaps to IDLE | keep 0.22 as the IDLE threshold |
| Above dead zone | round to 45° | continuous, magnitude-scaled |
| Availability | touch **landscape only** (`app.js:2351-2352`) | any coarse pointer, portrait **and** landscape |
| Magnitude | always full speed | `hypot/1000` scales speed — walk vs run emerges from the stick |

Removing the landscape gate is what makes it feel like a stick on a phone held
upright. The portrait safe-edge insets from
`tests/defense-hud-responsive-browser.cjs` still bound where it may be drawn.

---

## 5. Aim-based targeting

### Current

`nearestEnemy(run, source, range)` (`:1454-1468`) picks minimum distance, ties by
id. `aimDirection()` (`:1471-1482`) returns a unit vector toward that nearest
enemy, else `source.facing`. **No player input reaches either.**

### Target — aim biases selection, never replaces it

Add an optional aim vector on the commander, supplied by the same MOVE-style
integer-millis contract, and use it to **weight** candidate selection:

```
score(enemy) = distance² × (1 + AIM_BIAS × (1 - cosθ) / 2)
```

where `θ` is the angle between the aim vector and the vector to the enemy.

| Constant | `[TARGET]` value | Effect |
|---|---|---|
| `AIM_BIAS` | 3.0 | an enemy directly behind you must be ~2× closer to win over one you are aiming at |
| aim absent | — | score reduces to `distance²`, i.e. **exactly today's behavior** |

Properties this buys:
- With no aim input the function is bit-identical to `nearestEnemy` — no fixture churn
- Auto-hunt (the reference's `자동 사냥`) remains valid: it simply supplies no aim
- Ties still break by id, so determinism holds

Selection stays **integer-safe**: compare scores in scaled integer arithmetic, not
floats, to keep the comparison deterministic across engines.

---

## 6. Performance envelope

New per-tick costs, against the existing budget (p95 frame ≤16.7 ms, input ≤100 ms):

| Addition | Cost | Bound |
|---|---|---|
| `updateCorpses()` | O(corpses) filter | corpses only from elite/midboss/boss ⇒ small |
| Corpse cap | — | `[TARGET]` hard cap **12**; oldest evicted first |
| `attemptExtraction()` | O(corpses) distance test, commander only | ≤12 |
| Aim scoring | replaces existing distance loop, adds one dot product | no new iteration |
| Analog movement | 2 extra int mults | negligible |

Corpses are simulation entities and therefore enter the snapshot. `[TARGET]` They
must be added to `getRunSnapshot()` under the **same conditional-presence rule** as
`moveAnalog`: absent until a corpse exists, so pre-extraction digests are
unchanged.

---

## 7. What this spec does not decide

- **Bound Fragment budget conflict** (§3) — PM negotiation required, blocking G3/G5
- **Per-character attack patterns** — the 12-weapon/5-AoE catalog is deferred with
  zero imports; wiring it is a separate slice and is *not* claimed here
- **Character mesh scale** — no JS scale constants exist; scale is intrinsic to the
  GLBs. Must be **measured** before any change. Investigate, do not adjust.
- **Whether the loop is fun** — G7 needs human play. No simulation result
  substitutes for it.
