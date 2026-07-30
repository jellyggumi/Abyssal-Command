# Abyssal Lantern — Stage Pacing Contract: 300–900 s of Real Play

```yaml
run_id: 20260728-onslaught-action-pivot
cycle: 10
lane: design
owner_skill: design-game-encounters
owner_agent: EncounterPacing
scope: >
  Per-stage duration budget, wave-doctrine deltas, objective-block composition,
  fairness caps, gimmick-to-pressure binding, and the deterministic measurement method
  that makes each of the three stages last 300-900 s of real play.
non_goals:
  - dungeon geometry, slab rects, corridor widths   -> DungeonLevelDesign (stage-dungeon-composition-spec.md)
  - drop tables, buff catalog, buff stacking        -> DropBuffSystem  (item-drop-timed-buff-spec.md)
  - VFX cue authoring                               -> VfxCueDesign    (vfx-drop-spawn-terrain-spec.md)
  - audio cue authoring, BGM state machine          -> AudioFeedbackDesign (audio-feedback-dungeon-spec.md)
  - HUD / joystick                                  -> UiOverhaulConcept
authorities_read:
  - defense-catalog.js         (STAGE_WAVE_DOCTRINE, STAGE_ENCOUNTER_ROUTES, STAGE_TACTICS, STAGES, buildDoctrineWavePlan)
  - defense-run-simulation.js  (processEncounterSpawns, enqueueEncounterWave, updateObjectivePhase, processObjectivePressure, grantEncounterRecovery)
  - scripts/measure-stage-playtime.mjs
depends_on:
  - design/encounter-wave-spec.md
  - design/master-numeric-contract.md
  - engineering/runtime-surface-maps/map-simulation.md
  - engineering/runtime-surface-maps/map-story-design.md
```

---

## 0. Citation basis — read this before trusting any line number

**Every `file:line` in this document was read from the git blob at commit `033877ad`, not from a
working tree.** Command used for every citation:

```bash
git show 033877ad:defense-catalog.js
git show 033877ad:defense-run-simulation.js
git show 033877ad:scripts/measure-stage-playtime.mjs
```

Verified line counts at `033877ad`: `defense-catalog.js` **923**, `defense-run-simulation.js`
**3570**, `scripts/measure-stage-playtime.mjs` **179**.

`[OBSERVED]` The authoring workspace `/Users/jangyoung/orca/Abyssal-Surge` carries uncommitted work
from a concurrent session: `defense-run-simulation.js` there is **4002** lines and
`defense-catalog.js` is **1012** lines. Line numbers taken from that tree are offset from the
committed state by up to ~430 lines. This spec deliberately does **not** cite that tree.

Independently cross-checked against the director's measured anchor table for
`/Users/jangyoung/orca/Abyssal-Surge-dungeon @ 033877ad`: `updateEncounterObjective` 1086,
`combatRng` rehydration 3446, `getRunSnapshot` 3489, `getRunDigest` 3555 — all agree with the
blob scan above.

**`defense-catalog.js` anchors happen to be identical in both trees**; the
`defense-run-simulation.js` anchors are not. Implementers: the durable anchor is the **symbol name
and the quoted code text**, never the number. Re-grep, confirm the quoted text matches, then edit.

### 0.1 Five provenance traps active in this cycle

Recorded because an `[OBSERVED]` mark is only as good as the path it was measured through.

1. **Relative paths resolve to the wrong tree.** The `grep` / `read` / `glob` / `ast_grep` tools
   resolve a relative path against `/Users/jangyoung/orca/Abyssal-Surge`, not the implementation
   worktree. A citation taken that way is evidence about a tree implementers must not touch.
   **This spec is immune by construction: every citation came from a `git show 033877ad:` blob, which
   is commit-addressed and identical from any worktree.**
2. **The `edit` / `write` hazard is worse than the read hazard.** A relative section header also
   resolves to the forbidden tree, and only the stale-tag check stops the write. For a file
   byte-identical across both trees the tag would match and the write would land in the wrong tree.
   Always pass the absolute implementation path in an edit header and re-read through it first.
3. **`_workspace/` is per-worktree.** Design specs snapshotted into another worktree mid-authoring go
   stale silently. Re-read a peer spec from the path you will implement against.
4. **Drift is not uniform per file.** At the base commit `defense-catalog.js` matched across trees while
   `defense-run-simulation.js` was offset ~430 lines. Verify per file; never assume a global offset.
5. **A document is not code.** Three separate lanes cited a design `.md` as shipped behaviour this
   cycle, including this one (see Open risk 14). A spec is a claim about *intent*; only a blob is a
   claim about *code*. When a number's justification traces to a `.md`, mark it `[TARGET]` and name the
   document — never let it wear an `[OBSERVED]` costume.

### 0.2 Identify the tree by PATH — never by line count

> **A line-count discriminator table previously lived here. It is RETIRED and was actively dangerous.**
> An earlier revision listed base-commit line counts as a "wrong tree" check. Implementation then grew
> those same files in the *correct* tree — `defense-catalog.js` 923 → 1077, `battle-realtime-three.js`
> 4846 → 5223, `app.js` 3807 → 4147. Anyone following that table literally would conclude they were in
> the wrong tree **while standing in the right one**, and might "correct" course into the forbidden
> tree. A line count is a snapshot of a moving target; it stopped being a valid discriminator the
> moment implementation began.

The two rules that do **not** decay:

1. **Path.** Pass an absolute `/Users/jangyoung/orca/Abyssal-Surge-dungeon/...` path to every
   `read` / `grep` / `glob` / `ast_grep` / `edit` / `write`, and `cwd` on every bash call.
2. **Commit-addressed reads.** `git show 033877ad:<path>` returns the base blob regardless of any
   working tree. That is the only identity check immune to concurrent edits.

**Re-grep the symbol immediately before each edit, every time** — not once at task start. The file
moves as your own edits land, and a sibling editing the same file moves it further.

For reference only, the line counts **of the base blob at `033877ad`** — these describe a frozen
commit, not any live worktree, and must not be used as a tree check:
`defense-catalog.js` 923 · `defense-run-simulation.js` 3570 · `scripts/measure-stage-playtime.mjs` 179.

Marking convention: `[OBSERVED]` = read from the `033877ad` blob. `[TARGET]` = authored by this
spec, never measured. `[INFERENCE]` = derived reasoning, not a measurement.

---

## 1. Current baseline `[OBSERVED]`

### 1.1 Quoted constants

| Field | cinder-span | abyss-chancel | echo-throne | Source at `033877ad` |
|---|---:|---:|---:|---|
| `defenseTicks` | 10200 | 10500 | 10800 | `defense-catalog.js:659-661` |
| `waveCount` | 10 | 10 | 11 | `defense-catalog.js:659-661` |
| `gateIntegrity` | 1600 | 1700 | 1800 | `defense-catalog.js:659-661` |
| `pressureLane` | `chokepath` | `flank` | `chokepath` | `defense-catalog.js:659-661` |
| `midbossEnemy` | `guardian` | `flanker` | `guardian` | `defense-catalog.js:659-661` |
| `kindCycle` | `normal/normal/big/mid` | `normal/big/normal/mid` | `normal/normal/big/mid` | `defense-catalog.js:659-661` |
| `classes` | `rusher/flanker/ranged` | `ranged/flanker/rusher/guardian` | `flanker/ranged/guardian` | `defense-catalog.js:659-661` |
| `spawnIntervalTicks` | 18 | 24 | 15 | `defense-catalog.js:475`, `:516`, `:559` |
| `maxConcurrentEnemies` | 8 | 9 | 10 | `defense-catalog.js:474`, `:515`, `:558` |
| `commitmentCap` | 3 | 4 | 4 | `defense-catalog.js:473`, `:514`, `:557` |
| `occupation.holdTicks` | 180 | 330 | 240 | `defense-catalog.js:354`, `:373`, `:382` |
| `extraction.windowTicks` | 600 | 600 | 600 | `defense-catalog.js:355`, `:374`, `:383` |
| boss HP | 40000 | 48000 | 60000 | `BOSSES` — `s1-cinder-warden` / `s2-veil-tactician` / `s3-gate-sovereign` |

Shared constants: `TICK_RATE = 60` (`defense-catalog.js:11`);
`PLAYER_BASELINE_DPS = 2250`, `WAVE_PRESSURE_BP = 5500` (`defense-catalog.js:682-683`);
`ARENA {width:24000, height:12000, gateX:22000, gateY:6000}` (`defense-catalog.js:12`).

Pressure constants, all in `defense-run-simulation.js`:

| Constant | Value | Line |
|---|---:|---|
| `OBJECTIVE_PRESSURE_GRACE_TICKS` | 3600 | `:429` |
| `OBJECTIVE_PRESSURE_INTERVAL_TICKS` | 600 | `:430` |
| `OBJECTIVE_PRESSURE_DAMAGE` | 100 | `:431` |
| `OBJECTIVE_PRESSURE_DEADLINE_OFFSET` | 9000 | `:432` |
| `BOSS_PRESSURE_GRACE_TICKS` | 1800 | `:433` |
| `ECHO_RECOVERY_PRESSURE_GRACE_TICKS` | 150 | `:434` |
| `WAVE_CLEAR_COMMANDER_RECOVERY_BP` | 800 | `:2645` |
| `WAVE_CLEAR_GATE_RECOVERY_BP` | 500 | `:2646` |

Gate-defense grace is **additive on top of the hold**:
`grace = phase === "gate-defense" ? run.stage.gateTicks + OBJECTIVE_PRESSURE_GRACE_TICKS : OBJECTIVE_PRESSURE_GRACE_TICKS`
(`defense-run-simulation.js:2675`). So the first pressure pulse in gate-defense cannot land before
`gateTicks + 3600`.

### 1.2 Derived cadence and last wave beat

`cadence = Math.floor(defenseTicks / waveCount)` (`defense-catalog.js:688`); wave beat is
`tick: slot * cadence` (`defense-catalog.js:744`); `gateTicks: doctrine.defenseTicks`
(`defense-catalog.js:803`).

| Stage | cadence | = s | last beat = `(waveCount-1)*cadence` | = s | tail clear before hold closes |
|---|---:|---:|---:|---:|---:|
| cinder-span | 1020 | 17.00 | 9180 | 153.0 | 1020 t = 17.0 s |
| abyss-chancel | 1050 | 17.50 | 9450 | 157.5 | 1050 t = 17.5 s |
| echo-throne | 981 | 16.35 | 9810 | 163.5 | 990 t = 16.5 s |

### 1.3 Expected duration today

Gate-defense closes at the first tick where **all five** conditions hold
(`defense-run-simulation.js:2592-2599`): `run.tick >= run.stage.gateTicks`, every wave started,
encounter `COMPLETE`, spawn queue empty, and no living non-elite non-boss body. The last wave beat
lands one full cadence before `gateTicks` in all three stages (1.2), so the binding term is
`gateTicks` itself.

Floor duration = `gateTicks` + occupation hold + echo-recovery contest + boss floor TTK +
extraction window + 300 t resolution. Boss floor TTK uses `PLAYER_BASELINE_DPS` 2250, i.e. the bare
commander with no companions, items, or ranks:

| Stage | gateTicks | +hold | +echo contest | +boss floor TTK | +extr window | +res | **floor** |
|---|---:|---:|---:|---:|---:|---:|---:|
| cinder-span | 10200 | 180 | 90 | 1067 | 600 | 300 | **12437 t = 207.3 s** |
| abyss-chancel | 10500 | 330 | 105 | 1280 | 600 | 300 | **13115 t = 218.6 s** |
| echo-throne | 10800 | 240 | 120 | 1600 | 600 | 300 | **13660 t = 227.7 s** |

Echo-recovery contest ticks are the `finale` elite waypoint `contestTicks`: 90 / 105 / 120
(`defense-catalog.js:508`, `:551`, `:594`). Boss floor TTK = `round(bossHp / 2250 * 60)`.

`[OBSERVED]` **All three stages currently floor below 300 s. None reaches the 5-minute lower bound.**

### 1.4 Worst case is a hard defeat at 320–330 s, not a long run

`run.objectivePressure.deadlineTick = stage.gateTicks + OBJECTIVE_PRESSURE_DEADLINE_OFFSET`
(`defense-run-simulation.js:3339`). At that tick, if the gate still has integrity,
`processObjectivePressure` zeroes it outright:

```js
if (run.tick >= pressure.deadlineTick && run.gate.integrity > 0) {   // :2690
  const damage = run.gate.integrity;
  run.gate.integrity = 0;                                            // :2693
```

and the terminal check `if (run.gate.integrity <= 0 || ...)` (`:3044`) converts that to **DEFEAT** on
the same tick.

| Stage | `deadlineTick` | = s | Outcome at that tick |
|---|---:|---:|---|
| cinder-span | 10200 + 9000 = 19200 | **320.0** | forced DEFEAT |
| abyss-chancel | 10500 + 9000 = 19500 | **325.0** | forced DEFEAT |
| echo-throne | 10800 + 9000 = 19800 | **330.0** | forced DEFEAT |

The only extension is recovery pause: `run.objectivePressure.deadlineTick += pausedTicks`
(`defense-run-simulation.js`, `processEncounterRecovery` at `:1054`), bounded by
`maxAttempts: 3` × the objective's `recoveryTicks` (≤ 300) ≈ ≤ 900 t = 15 s.

> **Correction to a carried claim.** `map-simulation.md:317` states "Practical ceiling: ~3000–4000
> seconds worst case." That is wrong: it derives a grind time from
> `OBJECTIVE_PRESSURE_DAMAGE` 100 per 600 t pulse while overlooking
> `OBJECTIVE_PRESSURE_DEADLINE_OFFSET` (`:432`) and the deadline branch at `:2690`. The true worst
> case is a **hard defeat at 320 / 325 / 330 s**. This matters: it means the 300–900 s window is
> currently **unreachable by construction**, not merely un-tuned, and `OBJECTIVE_PRESSURE_DEADLINE_OFFSET`
> is a required change, not an optional one.

---

## 2. Target duration budget `[TARGET]`

Eight pacing blocks per stage, using the director-ruled ids verbatim:
`ingress · objective-1 · objective-2 · midboss · occupation · boss · extraction · resolution`.

Blocks are a **pacing overlay**, not new encounter objectives. The stage keeps exactly two
`STAGE_ENCOUNTER_ROUTES` objectives — the validator at `defense-catalog.js:785-792` requires every
wave slot owned once in ascending objective order, and `map-story-design.md` binds those two
objective ids to story beats. `midboss` is the window owned by the trailing `mid` wave through the
forced-final `big` wave; the active `objectiveId` there is still objective-2.

`occupation` spans echo-recovery **and** the occupation hold. Echo-recovery has no separate ruled
block id, and its contest window (90–120 t) is too short to be a block of its own.

### 2.1 cinder-span — target 390 s, band 330–420 s

| Block | Wave slots | Ticks | Seconds | Window `[from..to]` |
|---|---|---:|---:|---|
| `ingress` | — | 1200 | 20.0 | 0 .. 1200 |
| `objective-1` | 0–5 | 6120 | 102.0 | 1200 .. 7320 |
| `objective-2` | 6–10 | 5100 | 85.0 | 7320 .. 12420 |
| `midboss` | 11–13 | 3060 | 51.0 | 12420 .. 15480 |
| `occupation` | — | 2580 | 43.0 | 15480 .. 18060 |
| `boss` | — | 4140 | 69.0 | 18060 .. 22200 |
| `extraction` | — | 900 | 15.0 | 22200 .. 23100 |
| `resolution` | — | 300 | 5.0 | 23100 .. 23400 |
| **total** | 14 waves | **23400** | **390.0** | |

### 2.2 abyss-chancel — target 525 s, band 450–600 s

| Block | Wave slots | Ticks | Seconds | Window `[from..to]` |
|---|---|---:|---:|---|
| `ingress` | — | 1320 | 22.0 | 0 .. 1320 |
| `objective-1` | 0–7 | 8400 | 140.0 | 1320 .. 9720 |
| `objective-2` | 8–14 | 7350 | 122.5 | 9720 .. 17070 |
| `midboss` | 15–18 | 4200 | 70.0 | 17070 .. 21270 |
| `occupation` | — | 3900 | 65.0 | 21270 .. 25170 |
| `boss` | — | 4830 | 80.5 | 25170 .. 30000 |
| `extraction` | — | 1200 | 20.0 | 30000 .. 31200 |
| `resolution` | — | 300 | 5.0 | 31200 .. 31500 |
| **total** | 19 waves | **31500** | **525.0** | |

### 2.3 echo-throne — target 750 s, band 600–900 s

| Block | Wave slots | Ticks | Seconds | Window `[from..to]` |
|---|---|---:|---:|---|
| `ingress` | — | 1440 | 24.0 | 0 .. 1440 |
| `objective-1` | 0–11 | 14400 | 240.0 | 1440 .. 15840 |
| `objective-2` | 12–18 | 8400 | 140.0 | 15840 .. 24240 |
| `midboss` | 19–22 | 4800 | 80.0 | 24240 .. 29040 |
| `occupation` | — | 4920 | 82.0 | 29040 .. 33960 |
| `boss` | — | 8940 | 149.0 | 33960 .. 42900 |
| `extraction` | — | 1800 | 30.0 | 42900 .. 44700 |
| `resolution` | — | 300 | 5.0 | 44700 .. 45000 |
| **total** | 23 waves | **45000** | **750.0** | |

### 2.4 Band floor proof

The target column is a budget. The **floor** is what a bare commander who never stalls will produce,
and it is the number that must clear the band minimum. Floor replaces the `boss` budget with boss
floor TTK and the `extraction` budget with travel-and-channel floor:

| Stage | gate blocks (ingress+o1+o2+midboss) | occupation | boss floor TTK | extr floor | resolution | **floor** | band min | pass |
|---|---:|---:|---:|---:|---:|---:|---:|:--:|
| cinder-span | 15480 | 2580 | 1067 | 480 | 300 | **19907 t = 331.8 s** | 330 | ✅ |
| abyss-chancel | 21270 | 3900 | 1280 | 600 | 300 | **27350 t = 455.8 s** | 450 | ✅ |
| echo-throne | 29040 | 4920 | 1600 | 720 | 300 | **36580 t = 609.7 s** | 600 | ✅ |

Ceiling is enforced, not hoped for: §3.2 sets `pressureDeadlineOffsetTicks` so the forced-defeat
deadline lands exactly on each band maximum (420 / 600 / 900 s).

**Load-bearing consequence:** the occupation holds in §3.3 (2100 / 3300 / 4200 t) are not flavour.
Drop cinder's hold below **1993 t** and its floor falls under 330 s. Any later reduction to a hold
must be paid back tick-for-tick elsewhere in the same stage.

**Boss-block headroom is an assumption, not a guarantee** `[INFERENCE]`: boss budget minus boss floor
TTK is 51.2 s (cinder) / 59.2 s (chancel) / 122.3 s (throne). That headroom must be delivered by boss
telegraph, phase transitions, and add windows — owned by `design/boss-pattern-spec.md`, not by this
spec. Boss HP lives in `BOSSES`, which this spec does not modify. If boss design delivers none of it,
each stage lands at its floor, which is still inside band.

---

## 3. Wave doctrine deltas

### 3.1 Two new authored fields, and why `defenseTicks` alone cannot express the budget

`buildDoctrineWavePlan` derives cadence from the hold:

```js
const cadence = Math.floor(doctrine.defenseTicks / doctrine.waveCount);   // defense-catalog.js:688
...
tick: slot * cadence,                                                     // defense-catalog.js:744
```

Two consequences block §2 as written:

1. **Cadence is not authorable.** Raising `defenseTicks` to lengthen a stage silently stretches
   cadence, which raises per-wave HP — `waveHp` scales linearly with `cadenceSeconds`
   (`defense-catalog.js:701`). Lengthening the stage would make every wave harder as a side effect.
2. **There is no ingress.** Slot 0 fires at `tick: 0`. There is no orientation beat before first
   contact, so the `ingress` block cannot exist.

Minimal additive fix — **two** new doctrine fields plus one derived value:

| Field | Kind | Meaning |
|---|---|---|
| `ingressTicks` | new, integer | Orientation window before wave slot 0 |
| `waveCadenceTicks` | new, integer | Authored ticks between wave beats; replaces the derived divide |
| `defenseTicks` | existing, now **derived** | `ingressTicks + waveCount * waveCadenceTicks` |

Two edits inside `buildDoctrineWavePlan`, both one line:

```js
// was: const cadence = Math.floor(doctrine.defenseTicks / doctrine.waveCount);   // :688
const cadence = doctrine.waveCadenceTicks;

// was: tick: slot * cadence,                                                     // :744
tick: doctrine.ingressTicks + slot * cadence,
```

`gateTicks: doctrine.defenseTicks` (`defense-catalog.js:803`) is unchanged and still correct, because
`defenseTicks` now already contains ingress. Authoring `defenseTicks = ingressTicks + waveCount *
waveCadenceTicks` makes the last beat land exactly one cadence before the hold closes — preserving
the existing tail-clear property from §1.2 by construction.

> Do **not** keep `Math.floor(defenseTicks / waveCount)`. With the §3.2 values it yields 1105 / 1119 /
> 1262 instead of the authored 1020 / 1050 / 1200, inflating every wave's HP budget by 8–9 %.

### 3.2 `STAGE_WAVE_DOCTRINE` before → after

Target: `defense-catalog.js:658-662`. Field names exactly as they exist in code; new fields flagged.

#### cinder-span — `defense-catalog.js:659`

| Field | Before | After | Note |
|---|---:|---:|---|
| `gateIntegrity` | 1600 | **1600** | unchanged |
| `defenseTicks` | 10200 | **15480** | now derived: 1200 + 14×1020 |
| `waveCount` | 10 | **14** | +4 |
| `classes` | `["rusher","flanker","ranged"]` | **unchanged** | |
| `kindCycle` | `["normal","normal","big","mid"]` | **unchanged** | 14 slots → last forced `big` |
| `pressureLane` | `"chokepath"` | **unchanged** | |
| `midbossEnemy` | `"guardian"` | **unchanged** | |
| `ingressTicks` | — | **1200** | NEW |
| `waveCadenceTicks` | — | **1020** | NEW; equals the old derived cadence |
| `pressureDeadlineOffsetTicks` | — | **9720** | NEW; per-stage override |

#### abyss-chancel — `defense-catalog.js:660`

| Field | Before | After | Note |
|---|---:|---:|---|
| `gateIntegrity` | 1700 | **1700** | unchanged |
| `defenseTicks` | 10500 | **21270** | 1320 + 19×1050 |
| `waveCount` | 10 | **19** | +9 |
| `classes` | `["ranged","flanker","rusher","guardian"]` | **unchanged** | |
| `kindCycle` | `["normal","big","normal","mid"]` | **unchanged** | |
| `pressureLane` | `"flank"` | **unchanged** | |
| `midbossEnemy` | `"flanker"` | **unchanged** | |
| `ingressTicks` | — | **1320** | NEW |
| `waveCadenceTicks` | — | **1050** | NEW |
| `pressureDeadlineOffsetTicks` | — | **14730** | NEW |

#### echo-throne — `defense-catalog.js:661`

| Field | Before | After | Note |
|---|---:|---:|---|
| `gateIntegrity` | 1800 | **1800** | unchanged |
| `defenseTicks` | 10800 | **29040** | 1440 + 23×1200 |
| `waveCount` | 11 | **23** | +12 |
| `classes` | `["flanker","ranged","guardian"]` | **unchanged** | |
| `kindCycle` | `["normal","normal","big","mid"]` | **unchanged** | |
| `pressureLane` | `"chokepath"` | **unchanged** | |
| `midbossEnemy` | `"guardian"` | **unchanged** | |
| `ingressTicks` | — | **1440** | NEW |
| `waveCadenceTicks` | 981 (derived) | **1200** | NEW; +22 % cadence, the only intentional per-wave HP increase |
| `pressureDeadlineOffsetTicks` | — | **24960** | NEW |

`classes`, `kindCycle`, `pressureLane`, and `midbossEnemy` are **unchanged in all three stages** —
stage identity is already legible and lengthening is a content problem, not an identity problem.

`pressureDeadlineOffsetTicks` consumption — one line in `processObjectivePressure`'s initialiser
(`defense-run-simulation.js:3339`), falling back to the global constant so nothing else changes:

```js
// was: deadlineTick: stage.gateTicks + OBJECTIVE_PRESSURE_DEADLINE_OFFSET,
deadlineTick: stage.gateTicks + (stage.doctrine.pressureDeadlineOffsetTicks ?? OBJECTIVE_PRESSURE_DEADLINE_OFFSET),
```

Resulting deadlines: 15480+9720 = **25200 t = 420 s**, 21270+14730 = **36000 t = 600 s**,
29040+24960 = **54000 t = 900 s** — exactly the band maxima.

### 3.3 `STAGE_TACTICS` and `STAGE_ENCOUNTER_ROUTES` deltas

| Field | Stage | Before | After | Source | Why |
|---|---|---:|---:|---|---|
| `occupation.holdTicks` | cinder | 180 | **2100** | `:354` | floor proof §2.4 |
| `occupation.holdTicks` | chancel | 330 | **3300** | `:373` | floor proof §2.4 |
| `occupation.holdTicks` | throne | 240 | **4200** | `:382` | floor proof §2.4 |
| `extraction.windowTicks` | cinder | 600 | **900** | `:355` | extraction block ceiling |
| `extraction.windowTicks` | chancel | 600 | **1200** | `:374` | extraction block ceiling |
| `extraction.windowTicks` | throne | 600 | **1800** | `:383` | extraction block ceiling |
| `maxConcurrentEnemies` | throne | 10 | **11** | `:558` | ceiling ≥ max block cap (10) + 1 midboss body |
| `commitmentCap` | throne | 4 | **5** | `:557` | ceiling ≥ max block committed cap (5) |
| `maxConcurrentEnemies` | cinder / chancel | 8 / 9 | **unchanged** | `:474`, `:515` | already ≥ block caps |
| `commitmentCap` | cinder / chancel | 3 / 4 | **unchanged** | `:473`, `:514` | already ≥ block caps |
| `spawnIntervalTicks` | all | 18 / 24 / 15 | **unchanged** | `:475`, `:516`, `:559` | becomes the route-level default; per-block overrides in §4 |

The occupation hold is **contested**, never a passive timer: progress accrues only while the
commander is inside the point radius, so the block's pressure source (§4) is what makes 35–70 s of
holding a fight. If implementation makes the hold uncontested, this block becomes dead air and the
budget is invalid.

### 3.4 Objective wave-slot re-split

`waveSlots` on `objectiveDefinition` (`defense-catalog.js:446`). The validator
(`defense-catalog.js:785-792`) requires every slot owned exactly once, ascending, in objective order.

| Stage | Objective 1 | slots | Objective 2 | slots |
|---|---|---|---|---|
| cinder-span | `cinder-relay-crossing` (`:478`) | **0–5** (was 0–4) | `cinder-forge-stand` (`:487`) | **6–13** (was 5–9) |
| abyss-chancel | `chancel-nave-advance` (`:519`) | **0–7** (was 0–3) | `chancel-transept-lock` (`:528`) | **8–18** (was 4–9) |
| echo-throne | `throne-aisle-break` (`:562`) | **0–11** (was 0–5) | `throne-dais-stand` (`:571`) | **12–22** (was 6–10) |

Objective-2's slot range **contains** the `midboss` pacing block (cinder 11–13, chancel 15–18,
throne 19–22). Objective ids, `kind`, `point`, `retry`, `recovery`, and `contestTicks` are all
unchanged.

### 3.5 Resulting wave plan (generated, for verification)

Computed by replaying the shipped sizing formula (`defense-catalog.js:699-728`) against §3.2. Body
counts are the `primary` alternative.

| Stage | kinds by slot | bodies by slot | total bodies |
|---|---|---|---:|
| cinder-span | `n,n,B,m,n,n,B,m,n,n,B,m,n,B` | 7,6,13,4,6,8,13,3,9,8,14,5,9,15 | 120 |
| abyss-chancel | `n,B,n,m,n,B,n,m,n,B,n,m,n,B,n,m,n,B,B` | 7,10,6,1,7,11,7,1,8,11,7,1,8,12,8,1,9,13,11 | 139 |
| echo-throne | `n,n,B,m,n,n,B,m,n,n,B,m,n,n,B,m,n,n,B,m,n,n,B` | 5,7,6,3,7,2,11,4,2,6,10,1,6,8,7,3,8,3,13,4,3,7,11 | 137 |

`n` = normal, `B` = big, `m` = mid. The `mid` slots carry 1–5 escort bodies plus the midboss, which
is correct: `MIDBOSS_PROFILE.hpBudgetBp = 6000` (`defense-catalog.js:646`) spends 60 % of a cadence
slot on the midboss itself, leaving little for escorts.

---

## 4. Objective-block composition

Per-block `concurrentCap`, `spawnIntervalTicks`, and `committedCap` are **new optional overrides**
resolved from the active pacing block, falling back to the route-level value. Resolution is
deterministic — the current block is the one whose slot range contains the highest started wave slot,
so no RNG and no new state.

Consumption, in `processEncounterSpawns` (`defense-run-simulation.js:1002`):

```js
// was: if (activeBodies >= encounter.maxConcurrentEnemies) return;            // :1008
if (activeBodies >= (blockCapFor(run) ?? encounter.maxConcurrentEnemies)) return;

// was: encounter.nextSpawnAt = run.tick + Math.max(1, encounterRouteFor(run)?.spawnIntervalTicks || 1);   // :1015
encounter.nextSpawnAt = run.tick + Math.max(1, blockIntervalFor(run) ?? encounterRouteFor(run)?.spawnIntervalTicks ?? 1);
```

and in the commitment slice (`defense-run-simulation.js:2366`):

```js
// was: const nextIds = candidates.slice(0, encounter.commitmentCap).map(({ id }) => id);
const nextIds = candidates.slice(0, blockCommittedFor(run) ?? encounter.commitmentCap).map(({ id }) => id);
```

### 4.1 cinder-span

| Block | Slots | Concurrent cap | Spawn interval | Committed cap | Pressure source added (exactly one) | Archetype introduced | Distinct response required | Recovery window after clear |
|---|---|---:|---:|---:|---|---|---|---:|
| `ingress` | — | 0 | — | 0 | none — orientation only | — | read the corridor, find the relay | — |
| `objective-1` | 0–5 | 6 | 24 | 2 | **closing distance** (`chokepath` push, `cinder-center`) | `rusher` | hold spacing; dash through, never backpedal | 180 t (3.0 s) |
| `objective-2` | 6–10 | 8 | 18 | 3 | **off-axis arrival** (`SW` flank ingress) | `flanker` | break facing lock; re-orient mid-fight | 210 t (3.5 s) |
| `midboss` | 11–13 | 7 (+1 midboss = 8) | 15 | 3 | **an HP wall that does not yield to chip** | `guardian` midboss | commit a burst window; stop kiting | 240 t (4.0 s) |
| `occupation` | — | 4 | — | 2 | **ground you must not leave** (`cinder-seal` hold 2100 t) | — | trade damage for position | 240 t (4.0 s) |
| `boss` | — | 3 | — | 2 | **telegraphed lethality** | boss | learn one pattern under add pressure | — |
| `extraction` | — | 2 | — | 1 | **a closing window** (900 t) | — | leave on time | — |
| `resolution` | — | 0 | — | 0 | none | — | — | — |

### 4.2 abyss-chancel

| Block | Slots | Concurrent cap | Spawn interval | Committed cap | Pressure source added | Archetype introduced | Distinct response required | Recovery window |
|---|---|---:|---:|---:|---|---|---|---:|
| `ingress` | — | 0 | — | 0 | none | — | read three ingress mouths | — |
| `objective-1` | 0–7 | 7 | 30 | 3 | **damage from range + echo denial** | `ranged` (`resource-denial`) | close or break line of sight; XP is now contested | 240 t (4.0 s) |
| `objective-2` | 8–14 | 9 | 24 | 4 | **a third simultaneous lane** (`flank`, `chancel-transept`) | `guardian` in rotation | pick a lane and refuse the bait | 270 t (4.5 s) |
| `midboss` | 15–18 | 8 (+1 = 9) | 20 | 4 | **a fast mover you cannot corner** | `flanker` midboss | track a mobile target while adds land | 300 t (5.0 s) |
| `occupation` | — | 5 | — | 3 | **ground you must not leave** (`chancel-oath` hold 3300 t) | — | trade damage for position, longer | 300 t (5.0 s) |
| `boss` | — | 4 | — | 3 | **telegraphed lethality + classification** | boss | break the repeated answer | — |
| `extraction` | — | 3 | — | 2 | **a closing window** (1200 t) | — | leave on time | — |
| `resolution` | — | 0 | — | 0 | none | — | — | — |

### 4.3 echo-throne

| Block | Slots | Concurrent cap | Spawn interval | Committed cap | Pressure source added | Archetype introduced | Distinct response required | Recovery window |
|---|---|---:|---:|---:|---|---|---|---:|
| `ingress` | — | 0 | — | 0 | none | — | read the axial court | — |
| `objective-1` | 0–11 | 8 | 20 | 3 | **incomplete information** (`SIGHT` gimmick, §6) | `flanker`+`ranged` mixed | fight without full visibility; hold a heading | 210 t (3.5 s) |
| `objective-2` | 12–18 | 10 | 15 | 4 | **standing damage you must cede ground to** (`HAZARD`) | `guardian` lead | give up ground deliberately | 300 t (5.0 s) |
| `midboss` | 19–22 | 10 (+1 = 11) | 12 | 5 | **maximum admitted density** | `guardian` midboss | prioritise targets under full pressure | 330 t (5.5 s) |
| `occupation` | — | 6 | — | 3 | **ground you must not leave** (`throne-domain` hold 4200 t) | — | hold 70 s under contest | 330 t (5.5 s) |
| `boss` | — | 5 | — | 3 | **telegraphed lethality + command echo** | boss | break the command, multi-phase | — |
| `extraction` | — | 3 | — | 2 | **a closing window** (1800 t) | — | leave on time | — |
| `resolution` | — | 0 | — | 0 | none | — | — | — |

### 4.4 Admission drain proof

A block is only legible if its biggest wave is fully admitted well inside one cadence slot;
otherwise waves silently overlap and "one pressure source at a time" is a fiction. Drain =
`maxBodiesInBlock × spawnIntervalTicks`.

| Stage | Block | max bodies | interval | drain (t) | % of cadence | pass |
|---|---|---:|---:|---:|---:|:--:|
| cinder-span (cadence 1020) | `objective-1` | 13 | 24 | 312 | 31 % | ✅ |
| | `objective-2` | 14 | 18 | 252 | 25 % | ✅ |
| | `midboss` | 15 | 15 | 225 | 22 % | ✅ |
| abyss-chancel (cadence 1050) | `objective-1` | 11 | 30 | 330 | 31 % | ✅ |
| | `objective-2` | 12 | 24 | 288 | 27 % | ✅ |
| | `midboss` | 13 | 20 | 260 | 25 % | ✅ |
| echo-throne (cadence 1200) | `objective-1` | 11 | 20 | 220 | 18 % | ✅ |
| | `objective-2` | 13 | 15 | 195 | 16 % | ✅ |
| | `midboss` | 11 | 12 | 132 | 11 % | ✅ |

Every block drains in under one third of its cadence slot. The remaining ≥ 69 % is fight-and-clear
time, which is what pays the `WAVE_CLEARED` recovery at `defense-run-simulation.js:2647`.

### 4.5 Events this spec owns

Per director ruling, `EncounterPacing` owns block and spawn events.

```
PACING_BLOCK_STARTED  { blockId, objectiveId, waveSlots }
PACING_BLOCK_CLEARED  { blockId, objectiveId, recoveryTicks }
ENEMY_SPAWNED         { enemyId, kind, grade, x, y, slabId, telegraphTicks,
                        entityId, enemyType, elite, midboss, midbossId,
                        spawnDirection, routeId, route, objectiveId, waveIndex }
```

**Two of these field names ALREADY EXIST at `033877ad` on other events.** Neither is renamed — both are
semantically correct here — but every consumer MUST match `event.type` before reading a field:

| Field | Pre-existing use | Meaning there | Collision risk |
|---|---|---|---|
| `telegraphTicks` | `ENCOUNTER_PATH_CONTESTED` (`defense-run-simulation.js:2296`) | `contestTicks` — how long a body must hold a contest waypoint | **HIGH.** Fires per routed body per waypoint (120/139/137 per stage). A type-agnostic cue-lifetime reader exhausts the 24-slot pool. See the boxed rule in §6.3. |
| `recoveryTicks` | `ENCOUNTER_RECOVERY_STARTED` (`:1049`, from `objective.retry.recoveryTicks`) | retry countdown after an objective failure | **LOW.** Same concept at a different scope, and both are integer tick spans, so a mis-read degrades to a wrong-but-plausible duration rather than a flood. Still match on type. |

`grade`, `gimmickClass`, `slabId`, and `blockId` are genuinely new — **0 occurrences** in the blob.

> **STANDING POLICY — grep the blob for a payload field name before introducing it.**
> `git show 033877ad:<path> | grep -n <field>`. Five agents independently hit this trap in one cycle; it
> is now policy rather than advice. Cycle-wide results:
>
> - **Collision-free:** `grade`, `gimmickClass`, `slabId`, `blockId`, `dropId`, `buffId`, `rarity`,
>   `stat`, `magnitude`, `stacks`, `durationTicks`, `expiresAtTick`.
> - **Pre-existing, MUST be type-gated:** `telegraphTicks` (`:2296`, contest duration), `recoveryTicks`
>   (`:1049`, retry window), and `reason`.
>
> `reason` is the **worst** of the three even though it is not mine: `DropBuffSystem` found it already
> carrying **four incompatible vocabularies across six events** (e.g. `PROJECTILE_EXPIRED` uses lowercase
> `"bounds" | "range"`). The value sets happen not to overlap today, so a `reason`-keyed table
> **fails silently rather than loudly** — no exception, no visible wrong cue, just a branch that never
> matches. `telegraphTicks` at least floods visibly. Prefer a loud failure mode when choosing a key.

`ENEMY_SPAWNED` is **extended, never renamed**. The shipped emit
(`defense-run-simulation.js:743`) already carries `entityId`, `enemyType`, `elite`, `midboss`,
`midbossId`, `spawnDirection`, `routeId`, `route`, `objectiveId`, `waveIndex`. Those fields stay:
`effectAnchor()`'s id chain resolves `entityId`, and other consumers read `enemyType`. The ruled
`enemyId` / `kind` are added as same-valued aliases; `grade`, `x`, `y`, `slabId`, `telegraphTicks`
are genuinely new.

`grade` is derived **at the emit site** from the existing booleans, per ruling R4 — presentation
never re-derives:

| `elite` | `midboss` | `grade` |
|:--:|:--:|---|
| false | false | `"BASIC"` |
| either true | | `"SHADOW"` |
| — | — | `"BOSS"` (emitted by `BOSS_SPAWNED`, not here) |

`telegraphTicks` `[TARGET]`: **BASIC 30, SHADOW 60, BOSS 90**.

> **Grounding corrected.** An earlier draft of this section justified 30 t as "one full `DASH` cycle
> (18 t)" from `master-numeric-contract.md:108`. That was a defect: **`DASH` does not exist in shipped
> code.** Grep of the `033877ad` blobs returns **zero** occurrences of `DASH`, `dash`, `iframe`,
> `invuln`, `startup`, `LIGHT_1`, or `HEAVY` in either `defense-catalog.js` or
> `defense-run-simulation.js`; the `COMMANDER` block (`defense-catalog.js:19-32`) carries only
> `radius`, `speed`, `basicCooldown`, `basicDamage`, `basicRange`, `maxIntegrity`, `integrity`,
> `critProfile`. The verb table in `master-numeric-contract.md` is an **unshipped design target**, in
> the same category as `core-loop-legion-spec.md`. The values below are unchanged; only the rationale
> is re-derived, on constants that exist.

Re-grounded on `COMMANDER.basicCooldown = 24` (`defense-catalog.js:22`), `COMMANDER.speed = 4100`
(`:21`) → 68.3 units/tick, and `COMMANDER.radius = 360` (`:20`):

| `grade` | `telegraphTicks` | = s | attack cooldowns | repositioning at shipped speed | body radii |
|---|---:|---:|---:|---:|---:|
| `BASIC` | 30 | 0.50 | 1.25 | 2050 u | 5.7 |
| `SHADOW` | 60 | 1.00 | 2.50 | 4100 u | 11.4 |
| `BOSS` | 90 | 1.50 | 3.75 | 6150 u | 17.1 |

Rationale: **30 t exceeds one full attack cooldown plus margin and buys ≥ 5 body radii of
repositioning** — an arrival is always escapable by walking, which is the only evasive verb that
exists at this commit. 60 t covers a committed basic plus that escape. 90 t matches the shipped boss
cue. If a dash ships later these floors only get more generous; nothing here depends on it.

**Cue lifetime MUST read the field, never a constant.** Presentation sets an arrival-cue lifetime to
`Number.isInteger(event.telegraphTicks) ? event.telegraphTicks : 90`. A hardcoded per-event-type
constant is wrong by construction, because `telegraphTicks` varies by `grade` here and by
`gimmickClass` in §6.3 — a single constant makes the cue outlive or undercut the window it exists to
cover.

All durations are integer ticks. No floats enter any payload — floats break `getRunDigest()`
byte-identity (`defense-run-simulation.js:3555`).

`slabId` values are the frozen ids in §6.2, verified 12/12 by point-in-rect.

---

## 5. Fairness rules

### R1 — Simultaneous committed attackers

Enforced by the existing slice at `defense-run-simulation.js:2366`:
`candidates.slice(0, encounter.commitmentCap)`, seeded from
`commitmentCap: Math.max(1, route?.commitmentCap || 1)`.

| Stage | Route `commitmentCap` | Per-block caps (`ingress`→`resolution`) |
|---|---:|---|
| cinder-span | 3 (unchanged) | 0 / 2 / 3 / 3 / 2 / 2 / 1 / 0 |
| abyss-chancel | 4 (unchanged) | 0 / 3 / 4 / 4 / 3 / 3 / 2 / 0 |
| echo-throne | **5** (was 4) | 0 / 3 / 4 / 5 / 3 / 3 / 2 / 0 |

The route value is a **ceiling**: no block cap may exceed it, and raising a block cap without raising
the route cap is a silent no-op. Escorts holding a leader are already excluded from committing
(`enemy.policyId === "elite-escort" && enemy.escortLeaderId` returns early), so escort bodies never
consume a commitment slot.

### R2 — Minimum recovery window between blocks

**Floor: 180 ticks (3.0 s).** Chosen to match the smallest authored `retry.recoveryTicks` in the
shipped catalog — `cinder-relay-crossing` `recoveryTicks: 180` (`defense-catalog.js:482`) — so the
pacing floor and the retry floor are the same number rather than two competing conventions.

Per-block values are in §4 and climb with stage: cinder 180/210/240/240, chancel 240/270/300/300,
throne 210/300/330/330. Each equals or exceeds its objective's authored `retry.recoveryTicks`
(180 / 210 / 240 / 270 / 210 / 300 at `defense-catalog.js:482`, `:491`, `:523`, `:532`, `:566`, `:575`).

The window opens when the last body owned by the block dies and closes when the next block's first
wave enqueues. During it: **zero routed admission**. This is the gap `AudioFeedbackDesign` needs for
an unmasked BGM state change, and it is the only place a block transition is audible.

### R3 — No offscreen damage

Two properties make this checkable rather than aspirational:

1. **Pressure never hits the commander.** `processObjectivePressure` damages only the gate:
   `const damage = Math.min(OBJECTIVE_PRESSURE_DAMAGE, run.gate.integrity)` then
   `run.gate.integrity -= damage` (`defense-run-simulation.js:2670`+). Pulses cannot kill a player
   who cannot see their source.
2. **Arrivals are telegraphed for a bounded window.** No body may deal commander damage until it has
   been within the camera frustum for at least its `telegraphTicks` (30 / 60 / 90).

`[TARGET]` assertion: across a full seeded run per stage, count `COMMANDER_DAMAGED` events whose
`enemyId` was offscreen for the whole preceding `telegraphTicks`. **Required result: 0.**

Existing per-policy lead already supports this: `GATE_PRESSURE_RELEASE_LEAD`
(`player-pursuit` 360, `resource-denial` 240) gives routed bodies a pre-attack approach.

### R4 — Anti-duplicate reward on retry

`grantEncounterRecovery` dedupes on a per-encounter key list:

```js
function grantEncounterRecovery(run, rewardKey, recovery, payload = {}) {   // :918
  const encounter = ensureEncounterState(run);
  if (encounter.rewardKeys.includes(rewardKey)) return null;               // :920
```

Wave-clear recovery already keys `wave:${waveIndex}` (`processWaveClearRecovery`, `:2647`), so a
re-enqueued wave after retry cannot pay twice.

**Rule:** block recovery uses the same mechanism with key **`block:${blockId}`**, pushed into the same
`encounter.rewardKeys` array. Therefore:

- each of the 8 blocks pays its recovery **at most once per run**, regardless of retries;
- `retry.maxAttempts: 3` (all six objectives) caps retry count;
- a retry re-enqueues only that objective's previously started wave indices — it never re-pays
  `wave:*` or `block:*`;
- `[TARGET]` a full fail→retry→clear cycle on every objective adds **zero** new entries to
  `rewardKeys` beyond the first grant per key.

### R5 — Concurrent-body ceiling

Blocks with routed waves are bounded by R1's cap table and enforced at
`defense-run-simulation.js:1008`. **Post-gate blocks are not enforced by admission** — the spawn
queue is empty, so `processEncounterSpawns` returns at `:1004`. Their population is bounded by
construction instead:

| Source | Max bodies | Evidence |
|---|---:|---|
| elite arrival | 1 elite + ≤ 2 escorts | `escortCount = depthPkg?.eliteEscorts ?? 1` (`:2927`); max `eliteEscorts: 2` at abyss depth 3 (`defense-catalog.js:302`) |
| boss | 1 | `spawnBoss` |

So `occupation` peaks at 3 bodies and `boss` at 1 + adds. The §4 caps for those blocks are **QA
assertions on `snapshot.enemies.length`**, not admission gates. Stating them as enforced would be
false.

### R6 — Max simultaneous `ENEMY_SPAWNED` in one tick = 4

Routed admission is hard-throttled to one body per call: `processEncounterSpawns` reads only
`spawnQueue[0]`, shifts exactly one, spawns it, then sets
`encounter.nextSpawnAt = run.tick + spawnIntervalTicks` (`:1015`). It is called once per tick
(`:2914`).

Three paths stack:

| Path | Bodies | Evidence |
|---|---:|---|
| routed admission | 1 | `:1002-1015` |
| midboss, off-queue on the wave beat | 1 | `if (wave.midboss)` `:962`, comment `:963` — queuing it would hide the cue |
| elite arrival + escorts | 1 + ≤ 2 | `:2917`, `:2927` |

Worst tick = elite arrival at depth 3 = **4** (routed admission at `:2914` precedes the elite block at
`:2917` in the same tick). Occurs once per run. Midboss cannot collide with it: the last wave beat is
one cadence before `gateTicks`, and the elite requires `gateDefense.completed`. Mid-wave worst tick is
1 midboss + 1 routed = **2**.

`[INFERENCE]` This bounds `VfxCueDesign`'s 24-slot pool proof at 4 concurrent arrival cues with a
60-tick worst lifetime — 16.7 % peak occupancy, once per run.

> Cycle 9's "legion 3→10" is the **player's companion cap**, not enemy spawns. It does not enter this
> arithmetic.

---

## 6. Gimmick integration

### 6.1 Ownership boundary

`DungeonLevelDesign` owns gimmick ids, positions, corridor widths, and slab rects. This spec owns
**only** which block owns each gimmick, what it emits, and how it changes spawn/route behaviour. Ids
below are adopted verbatim from `DungeonLevelDesign`'s frozen list — this spec coins none.

**Elevation invariant:** every gimmick stays at elevation 0. Narrowing is a hazard or steering band
inside the authored corridor — never new collision, never a moved plane. No gimmick may imply stairs,
ramps, or pits.

### 6.2 Block ownership — 13 gimmicks

| # | Gimmick id | Owning block | Objective / point | `gimmickClass` | Steering shape | Effect on spawn / route | `slabId` |
|---:|---|---|---|---|---|---|---|
| 1 | `cinder-span:gimmick-ash-causeway-collapse` | `objective-1` | `cinder-relay-crossing` | **deformation** | FUNNEL 1400→900 | `W`+`SW` ingress merge to one lane for the block's remaining slots; admission interval unchanged | `cinder-span:slab-02` |
| 2 | `cinder-span:gimmick-forge-pressure-vents` | `objective-2` | `cinder-forge-stand` | **hazard** | HAZARD (cycles) | routed bodies re-path around the live vent footprint; no interval change | `cinder-span:slab-03` |
| 3 | `cinder-span:gimmick-seal-oath-ring` | `occupation` | `cinder-seal` | **gate** | progress ring | concentrates the hold; **no pathing change** | `cinder-span:slab-03` |
| 4 | `cinder-span:gimmick-warden-chain-fall` | `boss` | `boss-kill` | **deformation** | FUNNEL 1400→1000, ≤2 phases | narrows the boss approach per phase | `cinder-span:slab-02` |
| 5 | `abyss-chancel:gimmick-mirror-answer-aisle` | `objective-1` | `chancel-nave-advance` | **mirror** | SIGHT (per wave) | ingress direction concealed until first contest contact | `abyss-chancel:slab-02` |
| 6 | `abyss-chancel:gimmick-transept-three-way-lock` | `objective-2` | `chancel-transept-lock` | **gate** | FUNNEL 1400→900, 3 bars | each bar removes one of the three ingress directions for that slot | `abyss-chancel:slab-04` |
| 7 | `abyss-chancel:gimmick-oath-ring-shortcut` | `occupation` | `chancel-oath` | **gate** | progress ring, opens a 900 lane | opens one additional approach; **no pathing change** | `abyss-chancel:slab-03` |
| 8 | `abyss-chancel:gimmick-classification-craze` | `boss` | `boss-kill` | **deformation** | FUNNEL 1400→900, ≤2 phases | narrows the boss approach per phase | `abyss-chancel:slab-02` |
| 9 | `echo-throne:gimmick-returning-aisle` | `objective-1` | `throne-aisle-break` | **mirror** | SIGHT (per kill batch) | mirrors a kill in `slab-03` to `y' = 12000 - y`, landing in the opposite gallery by construction | `echo-throne:slab-03` |
| 10 | `echo-throne:gimmick-dais-command-echo` | `objective-2` | `throne-dais-stand` | **hazard** | HAZARD | routed bodies re-path around the live footprint | `echo-throne:slab-05` |
| 11 | `echo-throne:gimmick-crescent-gallery-shutters` | `midboss` | `throne-dais-stand` | **gate** | FUNNEL 1400→900 | closes the north/south galleries during the midboss window; `W` only | `echo-throne:slab-05` |
| 12 | `echo-throne:gimmick-domain-command-ring` | `occupation` | `throne-domain` | **gate** | progress ring | concentrates the hold; **no pathing change** | `echo-throne:slab-05` |
| 13 | `echo-throne:gimmick-sovereign-command-shear` | `boss` | `boss-kill` | **deformation** | FUNNEL 1400→900, ≤2 phases | narrows the boss approach per phase | `echo-throne:slab-03` |

Class tally, verified against `DungeonLevelDesign`'s authored set: **deformation 4** (#1, #4, #8, #13),
**hazard 2** (#2, #10), **gate 5** (#3, #6, #7, #11, #12), **mirror 2** (#5, #9) = 13. The four
deformation gimmicks are exactly the four whose corridor widths they published, so this column is
adopted, not inferred.

`slabId` column verified by point-in-rect against `DungeonLevelDesign`'s frozen slab rects: **12/12
objective, occupation, and extraction points resolve to exactly one slab**, with no point falling in
two rects and none falling outside. Their published objective→slab mapping and this table agree on
every row.

**Corridor floor is an actor-fit rule, not a validator rule.** `COMMANDER.radius = 360`
(`defense-catalog.js:20`) ⇒ **diameter 720**. Every `corridorWidthAfter` is **≥ 900**, giving ≥ 90 units
of clearance per side: 900 / 1000 / 900 / 900 / 900 / 900.

> **Superseded values — recorded so nobody re-derives from the old set.** An earlier revision carried
> `1200→700`, `1200→800`, `1000→700`, `1100→700` with a stated floor of 600. Those are **wrong and
> unplayable**: at diameter 720, a 700-wide band leaves **−20 units** of clearance and a 600-wide floor
> leaves **−120**. The validator would have passed both, because it checks a corridor floor rather than
> actor fit — so the "narrowing" was not a skill check, it was guaranteed chip damage with no
> damage-free line. `DungeonLevelDesign` caught this against `COMMANDER.radius` and re-validated;
> critical corridors are now 1400 on all three stages and detours 900. This lane's walk-clear margins
> below are recomputed on the corrected widths.

One gimmick per block, except `throne-dais-stand`, whose slot range spans both `objective-2` and
`midboss` and therefore carries two (#10, #11) — one per pacing block, consistent with
`DungeonLevelDesign`'s "2 in the dais block".

`ingress`, `extraction`, and `resolution` own **no** gimmick. Ingress is orientation; extraction and
resolution are egress.

The three ring gimmicks (#3, #7, #12) are `gimmickClass: "gate"` — **progress gates, not collision**.
Nothing about them blocks pathing; modelling them as a hard block would be a defect.

### 6.3 Events

Emitted by the simulation, per director rulings R5 and R8:

```
GIMMICK_ARMED      { gimmickId, gimmickClass, slabId, objectiveId, x, y, telegraphTicks }
GIMMICK_TRIGGERED  { gimmickId, gimmickClass, slabId, x, y, corridorWidthBefore, corridorWidthAfter }
GIMMICK_RESOLVED   { gimmickId, gimmickClass, slabId, x, y }
```

`gimmickClass` ∈ `"deformation" | "gate" | "mirror" | "hazard"`. `x, y` are integer gameplay units —
presentation never computes slab centroids. There is no `TERRAIN_DEFORMED`; a second name for the same
moment is forbidden. Existing `TERRAIN_RECOVERY` is unrelated and untouched.

**`telegraphTicks` timing contract:** `GIMMICK_ARMED` at tick `T` ⇒ `GIMMICK_TRIGGERED` at exactly
`T + telegraphTicks`. It is the full player reaction window, not a hint, and it is the same contract as
`ENEMY_SPAWNED.telegraphTicks`.

Four tiers, **ruled by the director and adopted verbatim**. The `[TARGET]` floors this lane derived are
kept in the last column as the justification; every ruled value meets or exceeds its floor, so the two
agree and the ruled value is what implementations emit.

| `gimmickClass` | Ruled `telegraphTicks` | = s | Gimmicks | This lane's floor | Basis for the floor |
|---|---:|---:|---|---:|---|
| `deformation` | **180** | 3.00 | #1, #4, #8, #13 | ≥ 180 | 7.50 attack cooldowns; 12300 u ≈ 34 body radii |
| `gate` (narrowing) | **120** | 2.00 | #6, #11 | ≥ 90 | 5.00 cooldowns; 8200 u ≈ 23 body radii |
| `gate` (progress ring) / `mirror` | **90** | 1.50 | #3, #7, #12, #5, #9 | ≥ 60 | 3.75 cooldowns; no pathing change, readability only |
| `hazard` | **60** | 1.00 | #2, #10 | ≥ 60 | 2.50 cooldowns; footprint is re-pathed around, not walled |

Presentation must **not** assume membership in a fixed set. Treat the floors as the contract and the
ruled values as today's data, so a later retune inside the floors needs no renderer change.

Physical sufficiency, computed at `COMMANDER.speed = 4100` (`defense-catalog.js:21`) = 68.3 units/tick,
against `COMMANDER.radius = 360` (`:20`) ⇒ diameter 720. A narrowing closes each side by half the width
delta, so the walk-clear cost is small and every ruled telegraph clears it by a wide margin. The final
column is the surviving damage-free line — it must stay positive, which is what the old 700-wide values
violated:

| Gimmick | width | each side closes | ticks to walk clear | ruled `telegraphTicks` | margin | clearance after |
|---|---|---:|---:|---:|---:|---:|
| `ash-causeway-collapse` | 1400→900 | 250 u | 4 | 180 | +176 | 90 u/side |
| `warden-chain-fall` | 1400→1000 | 200 u | 3 | 180 | +177 | 140 u/side |
| `classification-craze` | 1400→900 | 250 u | 4 | 180 | +176 | 90 u/side |
| `sovereign-command-shear` | 1400→900 | 250 u | 4 | 180 | +176 | 90 u/side |
| `transept-three-way-lock` | 1400→900 | 250 u | 4 | 120 | +116 | 90 u/side |
| `crescent-gallery-shutters` | 1400→900 | 250 u | 4 | 120 | +116 | 90 u/side |

Cue-silhouette budget for the VFX lane is the width delta: **500 / 400 / 500 / 500 / 500 / 500** units,
up from the superseded set (500 / 400 / 300 / 400 / 400 / 400) — the correction gives arrival cues more
to read, not less.

> **Grounding corrected**, same defect as §4.5: an earlier draft justified the 90 t floor as "a
> narrowing can trap a committed dash (18 t)". **`DASH` does not exist at `033877ad`** — zero grep hits
> in either simulation or catalog blob. The floor stands; it is now derived from shipped commander speed
> and attack cooldown instead of an unshipped verb table.

**Cue lifetime MUST read the field, never a per-event-type constant.** Presentation sets
`lifetime = Number.isInteger(event.telegraphTicks) ? event.telegraphTicks : 180`, where 180 is a
**fallback/clamp only**. Hardcoding 180 for all `GIMMICK_ARMED` is wrong for **9 of 13** gimmicks: a
60 t mirror cue on a 180 t constant lingers **120 ticks past its own `GIMMICK_TRIGGERED`**, telling the
player a gimmick is still arming after it has already fired. That is worse than a short cue, and it
contradicts verification check 29.

> ### `telegraphTicks` IS NOT A NEW FIELD NAME — switch on `event.type` FIRST
>
> `[OBSERVED]` `telegraphTicks` **already exists at `033877ad`**, at
> `defense-run-simulation.js:2296`, on a completely unrelated event:
>
> ```js
> emit(run, "ENCOUNTER_PATH_CONTESTED", {          // :2290
>   entityId: enemy.id, routeId: enemy.routeId, waypointId: waypoint.id,
>   objectiveId: enemy.encounterObjectiveId, releaseAt: enemy.routeReleaseAt,
>   telegraphTicks: contestTicks,                  // :2296  <- NOT a cue lifetime
> });
> ```
>
> There it carries `contestTicks` (`:2284`, `waypoint.contestTicks || objective?.contestTicks || 60`)
> and means **how long a body must hold a contest waypoint** — a routing duration, not a reaction
> window.
>
> **A type-agnostic `event.telegraphTicks` reader is a pool-exhaustion vector, not a cosmetic bug.**
> `ENCOUNTER_PATH_CONTESTED` fires for **every routed body at every contest waypoint** — 120 / 139 / 137
> bodies per stage by §3.5 — and would feed lifetimes of 60/75/90/105 (objective `contestTicks`) and
> 90–150 (finale waypoints) into a **24-slot** pool. That is one telegraph cue per arriving enemy
> instead of one per gimmick: the pool is exhausted and the gimmick and arrival cues it was sized for
> are evicted.
>
> **Required dispatch shape — an ALLOW-SET checked before any field read.** Prefer this over an
> if-chain: it fails closed for every event family added later, and it also blocks *presence-keyed*
> reads, which are the subtler half of the trap.
> ```js
> const GIMMICK_EVENTS = new Set(["GIMMICK_ARMED", "GIMMICK_TRIGGERED", "GIMMICK_RESOLVED"]);
> if (!GIMMICK_EVENTS.has(event.type)) return;          // fail closed, before touching a field
> const lifetime = Number.isInteger(event.telegraphTicks) && event.telegraphTicks > 0
>   ? event.telegraphTicks : 180;
> ```
> `ENEMY_SPAWNED` uses the same pattern with a fallback of 90. `ENCOUNTER_PATH_CONTESTED` is in neither
> set and must never reach a cue-lifetime path.
>
> **Presence-keying is not a safe substitute for type-matching.** `ENCOUNTER_PATH_CONTESTED` also carries
> `objectiveId`, so a gimmick chip keyed on "has `objectiveId` and `telegraphTicks`" would render a
> **complete, plausible-looking chip** — real label, real lifetime — for a route contest with no gimmick
> behind it. A defect that looks correct survives review. Credit `UiOverhaulConcept` for that sharpening.
>
> `[OBSERVED]` **Already correct in the shipped renderer**, verified independently by the director and by
> `DropBuffSystem` against `battle-realtime-three.js`: `resolveVfxLifetimeTicks` (`:517-527`) dispatches
> on `event.type` first, and of 10 grep hits for `telegraphTicks` **8 are comments and exactly 2 are real
> reads** — one inside the `ENEMY_SPAWNED` branch (`:523`), one inside `GIMMICK_ARMED` (`:525`). There is
> no shared `effectLifetime(event)` helper. `ENCOUNTER_PATH_CONTESTED` falls through to `return table`
> and, having no `VFX_MODELS` entry, is dropped by `spawnVfx` at `if (!relPath) return;` before a lifetime
> is used. `telegraphLifetime` (`:514`) further requires `Number.isInteger(value) && value > 0`, so a
> float or zero degrades to the class fallback. **The flood cannot occur today** — check 36 is discharged
> by that reading. The rule stays because nothing structural prevents a future consumer from
> reintroducing it.
>
> Found by `AudioFeedbackDesign`; blast radius quantified and blob-verified by this lane. This lane did
> **not** rename its field: `telegraphTicks` is semantically right for an arrival and a gimmick arm, and
> renaming would break the director-ruled payload. The fix is dispatch discipline, not a new name.

**Pool exemption.** `deformation` and `hazard` narrowing is **simulation-enforced** as a hazard/steering
band, so its cue carries gameplay-critical information: evicting it would hide a live hazard. Both
classes are pool-exempt in the VFX layer — predicate
`gimmickClass === "deformation" || gimmickClass === "hazard"`. `gate` and `mirror` cues are not exempt.

`[OBSERVED GAP]` Hazard-class *visual* design has no owner this cycle. `forge-pressure-vents` and
`dais-command-echo` will ship with correct pool behaviour and **no dedicated cue**; reusing a
deformation seam asset for a pressure vent is prohibited, because a narrowing seam and a vent are
different claims about the world. Recorded as an unresolved gap, not as done.

### 6.4 Determinism and collision

- **No RNG in trigger ordering.** Two gimmicks never trigger in the same tick, stage-wide: authored
  integer `order`, lower wins, loser defers exactly 1 tick. Deterministic, no draw.
- **Any future gimmick probability uses `run.gimmickRng = rngNext(seed ^ 0xc2b2ae35)`** — a derived
  stream, never `run.rng`. Consuming `run.rng` would shift every downstream draw and break
  `getRunDigest()` and every seeded fixture. Registry of all four streams, grep-verified free of
  collision:

| Stream | XOR constant |
|---|---|
| `combatRng` | `0x9e3779b9` |
| surprise roll | `0x6d2b79f5` |
| `dropRng` | `0x85ebca6b` |
| `gimmickRng` | `0xc2b2ae35` |

  Pattern and placement: `run.combatRng = rngNext(...)` sits in the run literal at
  `defense-run-simulation.js:3217`, rehydrated at `:3446`. Two streams seeded with the same constant
  would be perfectly correlated — a determinism defect no existing test would catch.
- Max concurrently armed per stage **2**, of which **deformation 1**. Satisfied by construction here:
  each stage's deformation gimmicks sit in **distinct pacing blocks** (cinder `objective-1` + `boss`;
  chancel `boss`; throne `boss`), and blocks never overlap in time, so two deformations can never be
  armed together.
- A gimmick may change ingress **direction availability** and **route waypoints**; it may **never**
  change `spawnIntervalTicks`, a concurrent cap, or a committed cap. Those are pacing fields owned by
  §4, and letting geometry move them would make the drain proof in §4.4 unverifiable.
- Renderer/presentation reads gimmick state from snapshots and never writes back.

---

## 7. Measurement method

### 7.1 Harness

```bash
cd /Users/jangyoung/orca/Abyssal-Surge-dungeon && \
  node scripts/measure-stage-playtime.mjs --seeds 3 --stages <stageId> --output <path.json>
```

> **The `cd` prefix is mandatory, not decoration.** The default bash working directory is
> `/Users/jangyoung/orca/Abyssal-Surge`, which carries a concurrent session's uncommitted work. A bare
> invocation therefore measures **another session's simulation**, not the pacing change under test — a
> pass would say nothing and a failure would not be a regression in this lane. Every command in this
> section carries the prefix for that reason.

`scripts/measure-stage-playtime.mjs` imports the shipped simulation unmodified and drives an
objective-seeking bot. Duration is read from `run.seconds` = `ticks / TICK_RATE`, and
`summaries[].medianSeconds` / `minSeconds` / `maxSeconds` are the band evidence.

### 7.2 Two prerequisite edits — the harness cannot measure this window as shipped

Both are measurement-only. Neither touches simulation code.

| Line @ `033877ad` | Current | Required | Why |
|---|---|---|---|
| `:26` | `const PLAYTIME_TARGET_SECONDS = Object.freeze({ min: 180, max: 360 });` | `{ min: 300, max: 900 }` | `withinTarget` (`:121-123`) would report **false for every compliant run** |
| `:27` | `const MAX_TICKS = 60 * 60 * 8;` (28800 t = 480 s) | `60 * 60 * 16` (57600 t = 960 s) | hard runaway guard **truncates** any run past 480 s; every echo-throne target (600–900 s) would terminate `TIMEOUT`, not `VICTORY` |

Without both, a passing echo-throne run is indistinguishable from a hang.

Because bands differ per stage, per-stage assertion is on `medianSeconds` against §2's band, **not**
on the harness's single global `withinTarget` flag.

### 7.3 Seeded scenario per stage

Seeds are deterministic: `101 + index * 37` (`:136`), so `--seeds 3` yields exactly **101, 138, 175**.

| Stage | Command | Seeds | Expected terminal | Band assertion on `medianSeconds` |
|---|---|---|---|---|
| cinder-span | `--stages cinder-span --seeds 3` | 101, 138, 175 | `VICTORY` | 330 ≤ x ≤ 420, target 390 |
| abyss-chancel | `--stages abyss-chancel --seeds 3` | 101, 138, 175 | `VICTORY` | 450 ≤ x ≤ 600, target 525 |
| echo-throne | `--stages echo-throne --seeds 3` | 101, 138, 175 | `FINAL_COMPLETION` | 600 ≤ x ≤ 900, target 750 |

`echo-throne` returns `FINAL_COMPLETION`, not `VICTORY` (`run.terminal = run.stage.id === "echo-throne" ? "FINAL_COMPLETION" : "VICTORY"`). The harness counts both as a victory (`:147`).

### 7.4 Cost warning

After the `MAX_TICKS` raise, the tick budget is up to **9×** what the 480 s cap allowed. Run stages
**one at a time**, and take `--seeds 1` first to establish per-run wall cost before committing to 9
runs. Do not run this concurrently with the Node suite — the suite has wall-clock-sensitive subtests,
and oversubscription manufactures timeouts indistinguishable from real regressions.

### 7.5 Determinism check, paired with every duration run

```bash
cd /Users/jangyoung/orca/Abyssal-Surge-dungeon && \
  node -e 'import("./defense-run-simulation.js").then(...)'   # getRunDigest twice, same seed
```

If any Node test file is used to discharge a static check, it carries the same prefix and bounded
concurrency: `cd /Users/jangyoung/orca/Abyssal-Surge-dungeon && node --test --test-concurrency=2 tests/<file>`.
This spec never invokes the full glob; that run is the director's alone, and only in the quoted form
`node --test 'tests/**/*.test.mjs'` — a shell-expanded glob is not equivalent.

Same seed twice ⇒ byte-identical `getRunDigest()` (`defense-run-simulation.js:3555`, exactly
`JSON.stringify(getRunSnapshot(run))`). `getRunSnapshot` (`:3489`) serializes no `rng`, `combatRng`,
or `seed`, and `SNAPSHOT_VERSION` is 7 (`:378`) and must not be bumped. A duration number from a run
whose digest is not reproducible is not evidence.

---

## Verification matrix

| # | Check | Concrete assertion | Where measured |
|---:|---|---|---|
| 1 | Stage count and ids unchanged | `STAGES.map(s => s.id)` === `["cinder-span","abyss-chancel","echo-throne"]` | `tests/stage-catalog.test.mjs` (or existing catalog contract test) |
| 2 | `defenseTicks` is the derived sum | for each stage `defenseTicks === ingressTicks + waveCount * waveCadenceTicks` → 15480 / 21270 / 29040 | catalog unit test on `STAGE_WAVE_DOCTRINE` |
| 3 | Cadence is authored, not divided | `stage.wavePlan[1].tick - stage.wavePlan[0].tick` === 1020 / 1050 / 1200; **not** 1105 / 1119 / 1262 | catalog unit test on `buildDoctrineWavePlan` |
| 4 | Ingress offset applied | `stage.wavePlan[0].tick` === 1200 / 1320 / 1440 (never 0) | catalog unit test |
| 5 | Tail clear preserved | `defenseTicks - stage.wavePlan.at(-1).tick` === `waveCadenceTicks` for all three | catalog unit test |
| 6 | Slot ownership valid | `STAGES` constructs without throwing; validator at `defense-catalog.js:785-792` passes for 14 / 19 / 23 slots | catalog import in any test |
| 7 | Block budgets sum to target | per stage, Σ block ticks === 23400 / 31500 / 45000 | design-data test over the §2 tables |
| 8 | Band floor holds | computed floor (§2.4) ≥ band min: 19907 ≥ 19800, 27350 ≥ 27000, 36580 ≥ 36000 ticks | design-data test |
| 9 | Deadline equals band max | `stage.gateTicks + pressureDeadlineOffsetTicks` === 25200 / 36000 / 54000 | catalog unit test |
| 10 | Measured duration in band | `medianSeconds` within 330–420 / 450–600 / 600–900 | `cd /Users/jangyoung/orca/Abyssal-Surge-dungeon && node scripts/measure-stage-playtime.mjs --seeds 3 --stages <id>`, after the §7.2 edits |
| 11 | No forced-deadline defeat | across all 9 runs, zero `OBJECTIVE_PRESSURE_DEADLINE` events and zero `TIMEOUT` terminals | same harness run, `runs[].terminal` |
| 12 | Admission drain inside cadence | for each block, `maxBodies × spawnIntervalTicks` < `waveCadenceTicks` (all 9 rows, §4.4) | design-data test over §3.5 + §4 |
| 13 | Concurrent cap respected | during any routed block, `snapshot.enemies.filter(e => e.class !== "boss" && !e.elite).length` ≤ that block's cap | harness run, per-tick sampling |
| 14 | Route ceiling ≥ block caps | `maxConcurrentEnemies` ≥ max block cap + 1 (throne 11 ≥ 10+1); `commitmentCap` ≥ max block committed cap (throne 5 ≥ 5) | catalog unit test |
| 15 | Committed attackers capped | `snapshot.encounters.committedAttackerCount` ≤ block committed cap, every tick | harness run |
| 16 | Max spawns per tick ≤ 4 | across all 9 runs, `max(count of ENEMY_SPAWNED per tick)` ≤ 4 | harness run, event tally |
| 17 | Recovery window honoured | between `PACING_BLOCK_CLEARED` and the next `WAVE_VARIANT_STARTED`, elapsed ≥ that block's recovery ticks; zero `ENEMY_SPAWNED` inside it | harness run |
| 18 | No duplicate reward on retry | after 3 fail→retry→clear cycles per objective, `encounter.rewardKeys` contains each `wave:*` and `block:*` key exactly once | targeted simulation test |
| 19 | No offscreen damage | zero `COMMANDER_DAMAGED` whose `enemyId` was offscreen for the whole preceding `telegraphTicks` | browser proof, Main's verification phase |
| 20 | `grade` present and not re-derived | every `ENEMY_SPAWNED` carries `grade` ∈ {`BASIC`,`SHADOW`,`BOSS`}; renderer/audio contain no `elite`/`midboss` branch for arrival cues | event-shape test + grep of consumers |
| 21 | `ENEMY_SPAWNED` back-compatible | payload still carries `entityId`, `enemyType`, `routeId`, `objectiveId`, `waveIndex` | event-shape test |
| 22 | Integer-only payloads | every numeric field on `ENEMY_SPAWNED`, `PACING_BLOCK_*`, `GIMMICK_*` satisfies `Number.isInteger` | event-shape test |
| 23 | Gimmick block ownership complete | all 13 ids map 1:1 to a block per §6.2; `ingress`/`extraction`/`resolution` own none | design-data test |
| 24 | No two gimmicks in one tick | across all 9 runs, no tick carries 2+ `GIMMICK_TRIGGERED`; ≤ 2 armed per stage, ≤ 1 deformation | harness run |
| 25 | Elevation invariant | every gimmick `x,y` and every route waypoint resolves at elevation 0 | `enc-flat-world` gate in `encounter-wave-spec.md:207` |
| 26 | Digest reproducible | same seed twice ⇒ byte-identical `getRunDigest()`; `SNAPSHOT_VERSION` still 7 | §7.5, paired with every duration run |
| 27 | `gimmickClass` tally exact | across §6.2: deformation 4, hazard 2, gate 5, mirror 2, total 13; every value ∈ `{deformation,gate,mirror,hazard}` | design-data test over §6.2 |
| 28 | Telegraph matches the ruled tier | `GIMMICK_ARMED.telegraphTicks` === 180 deformation (#1,#4,#8,#13) / 120 narrowing gate (#6,#11) / 90 ring+mirror (#3,#7,#12,#5,#9) / 60 hazard (#2,#10) | event-shape test |
| 29 | Arm→trigger interval exact | for every gimmick, `tick(GIMMICK_TRIGGERED) - tick(GIMMICK_ARMED) === telegraphTicks` — no early or late trigger | harness run, event pairing |
| 30 | `slabId` resolves to exactly one slab | all 12 objective / occupation / extraction points fall inside exactly one authored slab rect; zero points in two rects, zero outside | design-data point-in-rect test |
| 31 | RNG stream constants distinct | `combatRng` `0x9e3779b9`, surprise `0x6d2b79f5`, `dropRng` `0x85ebca6b`, `gimmickRng` `0xc2b2ae35` — four distinct values, and `run.rng` is never consumed by pacing or gimmick code | grep + catalog unit test |
| 32 | Recovery window clears the audio ramp | every authored block `recoveryTicks` ≥ `SOUNDSCAPE_RAMP_SECONDS × 60` (21 t); minimum authored value is 180 | design-data test over §4 |
| 33 | Cue lifetime reads the field, not a constant | grep the renderer: no per-event-type literal lifetime for `ENEMY_SPAWNED` or `GIMMICK_ARMED`; both resolve `event.telegraphTicks` with a fallback. A 60 t `mirror` cue must expire at 60, not 180 | grep of consumers + event-shape test |
| 34 | Telegraph floors hold independently of the ruled values | every emitted `telegraphTicks` ≥ its class floor (deformation 180, narrowing gate 90, ring/mirror/hazard 60). Floors are the contract, ruled values are today's data, so a retune inside the floors needs no renderer change and no fixed-set assumption | event-shape test |
| 35 | No spec number rests on an unshipped verb | grep the `033877ad` blobs: `DASH`, `iframe`, `LIGHT_1`, `HEAVY` return zero hits, and no rationale in this spec cites them. Telegraph floors derive only from `basicCooldown` 24 and `speed` 4100 | static grep, re-run if the spec is edited |
| 36 | No type-agnostic `telegraphTicks` reader | each read of `event.telegraphTicks` is guarded by an `event.type` match; `ENCOUNTER_PATH_CONTESTED` never reaches a cue-lifetime path. **DISCHARGED [OBSERVED]** — `resolveVfxLifetimeTicks` (`battle-realtime-three.js:517-527`) dispatches on type first; 8 of 10 grep hits are comments, the 2 real reads sit inside the `ENEMY_SPAWNED` (`:523`) and `GIMMICK_ARMED` (`:525`) branches; no shared `effectLifetime` helper exists. Re-assert on any new consumer | grep of consumers — read twice independently (director, `DropBuffSystem`) |
| 37 | Contest events spawn no telegraph cue | across all 9 runs, count telegraph cues whose source event is `ENCOUNTER_PATH_CONTESTED`. **Required: 0.** A non-zero count means one cue per arriving body (120/139/137 per stage) against a 24-slot pool | harness run + renderer instrumentation |
| 38 | Pool survives the worst block | at the busiest tick of the busiest block, live cue count ≤ pool cap with the 4 arrival cues (§5 R6) and any armed gimmick cue simultaneously present | harness run, per-tick pool sampling |

Checks 1–9, 12, 14, 23, 27, 30, 31, 32, 35 are **static** — provable from catalog and spec data without
running the simulation. Checks 10, 11, 13, 15–18, 24, 26, 29, 37, 38 require the harness. Checks 19, 25
require the browser proof. Checks 20–22, 28, 33, 34 require the event-shape test or a consumer grep.
**Check 36 is the only one discharged** — by two independent readings of the shipped renderer, not by a
run. All harness and browser checks belong to Main's verification phase; **none has been run.**

Checks 27 and 30 were **executed statically during authoring** against `DungeonLevelDesign`'s frozen
slab rects and gimmick set: class tally returned deformation 4 / hazard 2 / gate 5 / mirror 2 = 13, and
point-in-rect returned **12/12 with zero multi-slab and zero outside**. That is spec-data arithmetic,
not a simulation run — it does not discharge any harness check.

---

## Open risks

1. **Every duration in this spec is unmeasured `[TARGET]` arithmetic.** No simulation run backs any
   number here. One harness invocation was attempted during authoring
   (`node scripts/measure-stage-playtime.mjs --seeds 3`); it timed out at 900 s with no output under
   contended load and produced nothing that entered this document. It was also issued **without the
   `cd` prefix**, so it ran against the authoring tree rather than the implementation worktree — void on
   two independent grounds, and a live example of why §7.1's prefix is mandatory. Breaks: the G2
   balance gate cannot pass on this spec alone; check 10 is the gate.

2. **`OBJECTIVE_PRESSURE_DEADLINE_OFFSET` is a simulation constant, not catalog data.** §3.2 requires
   a per-stage override at `defense-run-simulation.js:3339`, inside `DropBuffImpl`'s exclusive file.
   Two lanes needing one line in one file is a collision risk. Breaks: the ceiling half of every band;
   without it all three stages hard-defeat at 320–330 s (§1.4) and check 11 fails. **Mitigation:
   coordinate the one-line change through the file owner; do not edit it from this lane.**

3. **`buildDoctrineWavePlan` cadence change alters every wave's HP budget if done wrong.** `waveHp`
   scales linearly with `cadenceSeconds` (`defense-catalog.js:701`). Leaving the old
   `Math.floor(defenseTicks / waveCount)` in place yields 1105 / 1119 / 1262 and inflates every wave
   8–9 %. Breaks: check 3, and silently every balance assumption in §3.5. Also breaks
   `enc-slot-ownership` in `encounter-wave-spec.md:209`, which asserts `10/10/11` — that gate text
   must be updated to `14/19/23` or it will fail on correct data.

4. **Wave counts rise 40–109 % (10→14, 10→19, 11→23).** Total bodies per stage go 120 / 139 / 137.
   Nothing here proves a player can sustain 23 waves; `WAVE_CLEAR_COMMANDER_RECOVERY_BP = 800`
   (`:2645`) per wave is the only sustain, and it is capped once per wave by `rewardKeys`. Breaks:
   G2, and possibly G6 performance if concurrent bodies rise with wave count. Check 13 bounds
   concurrency but not attrition.

5. **Occupation holds rise 11.7× / 10× / 17.5×** (180→2100, 330→3300, 240→4200). They are load-bearing
   for the band floor (§2.4). If the hold turns out to be an uncontested timer, 35–70 s of standing is
   dead air and the stage is padded, not paced. Breaks: G4 immersion, and the honesty of check 8 —
   the floor would be arithmetically met while the play is empty.

6. **Boss-block headroom (51–122 s) is entirely unowned by this spec.** Boss HP is in `BOSSES`, which
   this spec does not modify; the headroom must come from `design/boss-pattern-spec.md`. If it
   delivers nothing, every stage lands at its floor — still in band, but the *target* durations
   (390 / 525 / 750 s) are then fiction. Breaks: nothing measurable; it makes the target column
   aspirational.

7. **Per-block cap/interval overrides need a block resolver in the simulation.** §4 assumes
   `blockCapFor(run)` / `blockIntervalFor(run)` / `blockCommittedFor(run)`. These do not exist.
   Resolution is deterministic (highest started wave slot) but it is new state read inside
   `processEncounterSpawns` (`:1002`) and the commitment slice (`:2366`). Breaks: checks 13 and 15;
   until then route-level values apply and per-block escalation is inert — the spec degrades to
   correct-but-flat rather than wrong.

8. **`PACING_BLOCK_STARTED` / `PACING_BLOCK_CLEARED` do not exist yet.** `AudioFeedbackDesign` binds
   BGM state transitions to `blockId`, and check 17 measures recovery windows from these events.
   Breaks: audio state machine has no trigger; check 17 unmeasurable.

9. **`ENEMY_SPAWNED` field aliasing is a deliberate deviation from "one concept, one name."** Ruling
   R19 forbids translation maps, yet the ruled `enemyId` / `kind` name concepts the shipped payload
   already carries as `entityId` / `enemyType` (`:743`). This spec keeps **both**, because dropping
   `entityId` breaks `effectAnchor()`'s id chain and every existing consumer. This is knowingly two
   names for two of the fields and should be ratified or collapsed by the director rather than left
   implicit. Breaks: check 21 if the shipped names are removed; R19 as written if they are kept.

10. **`ENEMY_SPAWNED.x` / `.y` will not render a cue until renderer PR-1 lands.** `effectAnchor()`
    never reads top-level `event.x`/`event.y`, and `spawnVfx()` hard-returns on a null anchor.
    `ENEMY_SPAWNED` happens to survive because `enemyId` resolves via the id chain, but `GIMMICK_*`
    carries only `x,y` and will silently produce no cue. Breaks: check 20's cue half and all §6.3
    presentation; simulation acceptance is unaffected. Owner: `VfxCueDesign` PR-1.

11. **`slabId` — RESOLVED, no longer a promise.** `DungeonLevelDesign`'s 12 slab ids and rects are
    frozen, and this lane verified the mapping independently rather than adopting it on trust:
    point-in-rect over all 12 objective / occupation / extraction points returned **12/12 resolving to
    exactly one slab**, zero points in two rects, zero outside. Emit the real ids, not `null`.
    Residual risk is narrow: the rects are authored data this lane did not re-derive from the world
    catalog, so if `DungeonLevelDesign` moves a rect the mapping must be re-run. Breaks:
    `slabId`-keyed footstep timbre and slab-scoped QA if a rect changes without re-verification.

12. **Line numbers here are `033877ad` blob coordinates and will drift.** The authoring workspace is
    already ~430 lines ahead in `defense-run-simulation.js`. Any implementer who patches by number
    instead of re-grepping the quoted symbol will edit the wrong location. Breaks: silently, anywhere.
    **Mitigation: §0 states the rule; treat symbol name and quoted code text as the anchor.**

13. **`encounter-wave-spec.md` becomes partially stale on adoption.** Its §3 table quotes
    `10200/10500/10800` ticks and `10/10/11` waves, and its `enc-concurrency` gate asserts `8/9/10`
    and `3/4/4`. After §3 those read as contradictions. Breaks: the `enc-slot-ownership` and
    `enc-concurrency` gates as literally written. That spec needs a follow-up edit; this lane did not
    modify it.

14. **A document is not code — this spec shipped that defect once and it was caught late.** §4.5 and
    §6.3 originally justified the 30 t / 90 t telegraph floors as "one full `DASH` cycle (18 t)", citing
    `master-numeric-contract.md:108`. **`DASH` does not exist at `033877ad`**: zero grep hits for `DASH`,
    `dash`, `iframe`, `invuln`, `startup`, `LIGHT_1`, `HEAVY` in either simulation or catalog blob, and
    the `COMMANDER` block (`defense-catalog.js:19-32`) has no dodge verb at all. The values survived
    re-grounding on `basicCooldown: 24` and `speed: 4100` with 20–45x margin, so nothing changed
    numerically — but the justification had been propagated into a director ruling and into renderer
    constants before it was caught. Breaks: nothing today; check 35 is the guard. **Residual risk: this
    spec's floors assume walking is the only evasive verb. If a dash with i-frames ships, the floors
    become more generous than intended and should be re-derived, not merely inherited.**

15. **Telegraph tiers are ruled data, not derived data.** §6.3 emits 180 / 120 / 90 / 60 because the
    director ruled those values; this lane independently derived only the *floors* (180 / 90 / 60). The
    ruled narrowing-gate value of 120 sits above this lane's 90 floor, so if a future retune drops it,
    90 is the number that must hold. Breaks: check 28 on any retune, and check 34 only if a value falls
    below its floor. **Mitigation: presentation reads `event.telegraphTicks` and asserts floors, never
    a fixed set — so a retune inside the floors is a data change, not a code change.**

16. **`telegraphTicks` and `recoveryTicks` are NOT new field names — VERIFIED CLOSED in both consumers,
    but the rule stands.** `[OBSERVED]` `telegraphTicks` already exists at
    `defense-run-simulation.js:2296` on `ENCOUNTER_PATH_CONTESTED`, carrying `contestTicks` — a routing
    duration, not a reaction window. That event fires for **every routed body at every contest waypoint**
    (120 / 139 / 137 bodies per stage by §3.5), so a type-agnostic cue-lifetime reader would produce one
    telegraph cue per arriving enemy against a 24-slot pool and evict the cues it was sized for.
    `recoveryTicks` also pre-exists (`:1049`, `ENCOUNTER_RECOVERY_STARTED`) but collides benignly — same
    concept, different scope, both integer tick spans.

    Closure evidence, from two lanes, by two different methods:

    | Consumer | Result | How |
    |---|---|---|
    | Renderer | **guarded** | `resolveVfxLifetimeTicks` (`battle-realtime-three.js:517-527`) dispatches on `event.type` first; 2 real reads, both inside type branches; no shared helper. Read independently by the director and `DropBuffSystem`. |
    | Audio | **unreachable** | Both colliding events are absent from `AUDIO_EVENT_POLICY`, carry no `event.cue`, and hit the `default: return null` of `audioSoundscapeForEvent`. Three independent barriers; `AudioFeedbackDesign` proved it by executing the real authority functions rather than reading them. |

    Breaks: checks 37 and 38 remain open (harness); check 36 is discharged. The rule stays in §6.3
    because nothing *structural* stops a future consumer from reintroducing a cross-family reader —
    today's safety is a property of two implementations, not of the vocabulary.

    Neither field is renamed: both are semantically correct on my events, and renaming would break the
    director-ruled payloads. **Prefer the allow-set shape over an if-chain**, and never key on field
    *presence*: `ENCOUNTER_PATH_CONTESTED` also carries `objectiveId`, so a presence-keyed gimmick chip
    would render a complete, plausible-looking artefact for a route contest with no gimmick behind it —
    a defect that looks correct survives review.

    **Residual risk, and the real lesson: this was caught by a peer, not by me.** I introduced a payload
    field without grepping whether it already existed, on a spec whose entire §0 is about verifying
    against the blob. Five agents hit the same trap in one cycle, which is why §4.5 now carries it as
    standing policy. Note also that `reason` — not mine, but the same family — is **worse**: four
    incompatible vocabularies across six events, and because the value sets happen not to overlap, a
    `reason`-keyed table **fails silently rather than loudly**. When choosing a key, prefer the loud
    failure mode.
