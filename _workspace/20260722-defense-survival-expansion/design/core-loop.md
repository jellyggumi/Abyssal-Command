---
gate: G7
owner: game-designer
updated: 2026-07-22
status: FIX-human-repeat-and-runtime-contract-open
period_s_target: 90
period_s_band: [30, 180]
actions_per_loop_min: 3
reward_events_per_loop_min: 1
repeat_rate_target: 0.70
---
# Core loop — defend, recover, grow, occupy, extract

## One rules-authority sequence

`Gate defense → Echo recovery → growth → occupation/extraction → boss kill → stage completion`

The simulation owns ticks, seeded wave resolution, actors, health, paths, hazards, Domain state, drops, growth, extraction, terminal outcomes and event order. `defense-catalog.js` owns authored values. `app.js` queues input and orchestrates overlays/persistence. Renderers and audio only observe snapshots/events. Nothing in this document is a second executable rules table.

## Numeric 90-second observation model

This is the G7 measurement model for a completed gameplay loop, not a claim that the current-head build satisfies it. A qualifying loop may finish anywhere inside 30–180 seconds; 90 seconds is the tuning center.

| target time | beat | player decision / countable action | expected simulation evidence |
|---:|---|---|---|
| 0–15 s | Gate defense + scout | **Action 1:** choose and occupy a firing lane while reading spawn direction | `MOVE`, wave phase/intent, Gate/Warden HP |
| 15–35 s | pressure + Echo recovery | **Action 2:** leave safety to recover an Echo/item or rotate to the threatened choke | pickup/recovery event, position region change |
| 30–50 s | growth + ranged pressure | **Action 3:** select one of three skills after reading current → upgraded values; cast or reposition for it | three-choice offer, `SKILL_SELECTED`, optional `SKILL_CAST` |
| 45–70 s | flank + elite escort | **Action 4:** occupy/contest a Domain point that affects movement, range or recovery | Domain progress/state/contest events |
| 55–75 s | elite extraction | **Action 5:** enter the eligible point and complete Bind during the 600-tick / 10-second candidate lifetime | candidate, countdown, `ELITE_EXTRACTED` or expiry |
| 70–90 s | boss pressure | **Action 6:** evade/pursue, preserve the Gate and commit the build to the boss | boss intent, HP/TTK, terminal event |
| ≤180 s | stage completion | choose a stage reward and admit the next stage | `REWARD_SELECTED`, stage resolved/unlocked |

The scout/pressure/flank/ranged/elite/boss phase windows may overlap. Catalog-authored stage timing is allowed to vary by stage and seed, but event ordering is stable and the observation window must contain at least three distinct deliberate action classes and one accepted reward event.

### Count rules

A deliberate action is one of: (1) region-to-region reposition, (2) active skill cast, (3) three-choice growth selection, (4) Domain occupation completion, (5) Bind/extraction attempt, or (6) stage-reward selection. Repeated key/pointer samples within one continuous move count once. Auto-attacks, passive damage, involuntary knockback and overlay dismissal do not count.

An accepted reward event is one of: skill growth applied, run item collected, elite companion extracted, or stage/Archive reward selected. XP movement without a resolved gain does not satisfy the reward limb. The event log must identify tick, stage, run seed, action class and reward type.

## Decision cadence

1. **Defend:** read the Gate/Warden HP and phase telegraph; occupy attack geometry rather than waiting at the Gate.
2. **Recover:** cross a chokepath or flank to collect W-01 Echoes before resource-denial pressure controls them.
3. **Grow:** choose one of three skills; every option shows the changed stat as `current → upgraded` and its lifetime (`run`).
4. **Occupy:** hold the stage's W-04 point for its catalog-authored 180–360 ticks. Capture applies that stage's combined movement ×1.04–1.08, range ×1.06–1.12 and integrity-recovery +4–12/s candidate values. The public beat additionally requires resource-denial enemies to contest rather than delete progress.
5. **Extract:** defeat the elite, reach the separate W-02 point and complete its current 120-tick / 2-second spatial Bind during the 600-tick / 10-second candidate-relative lifetime. Success must add the companion to the run and persistent local collection in one trace.
6. **Kill:** respond to boss pursuit/attack while preserving Gate and Warden HP; boss death produces terminal victory.
7. **Complete:** select one of three W-05 stage rewards, persist the record, unlock the next ordered stage, and make the next stage admission visible.

## Wave, seed and enemy-pressure contract

Each stage must resolve `scout → pressure → flank → ranged → elite → boss`. Seeded variation may change count within an authored band, spawn direction within an authored set, tick within an authored jitter band, and policy choice within authored mappings. It may not reorder mandatory phases, omit elite/boss/reward opportunities, or sample in a renderer. `app.js` hashes campaign ID, reset epoch, stage ID and attempt into the run seed; the simulation's xorshift32 schedule must reproduce identical snapshots/events for identical seed and inputs. Current `wavePattern` names all six phases, but only three authored wave rows are scheduled before separate elite/boss spawns, so the full grammar is still a target contract.

Enemy policies must create choices rather than only walk toward the Gate:

- gate-pressure units route to W-03 Gate integrity;
- pursuit/attack units make Warden HP and movement meaningful;
- flank units bypass the occupied primary choke;
- resource-denial units contest the active Domain or unrecovered Echo cluster;
- escort units screen the elite/extraction point;
- low-HP-focus units select the lowest eligible defender below an authored threshold.

A stage does not qualify for G7 if three actions occur without meaningful defeat pressure. QA records minimum Gate HP, minimum Warden HP, boss TTK, density and spawn direction alongside loop actions.

## Progression/readability handoff

The HUD must keep run item, skill, derived stat, synergy, extracted companion, stage reward and Archive growth visibly distinct. Every choice that changes a number displays `current → upgraded`; no generic “stronger” label is acceptable. The full-field 2.5D camera keeps current ingress, Gate, active Domain, extraction marker and relevant hazard readable. Eight-way keyboard/pointer movement remains available while combat is live; controls must not overlap the combat focus and primary targets are ≥44 CSS px.

## G7 measurement receipt schema

For each of at least five archetypes, record:

| field | required value |
|---|---|
| trace identity | build/rules version, stage, archetype, run seed |
| duration | first combat input tick through accepted reward tick; 30–180 s |
| actions | ordered tick + one of the six countable classes; ≥3 distinct classes |
| reward | event tick + accepted reward type; ≥1 |
| pressure | min Gate HP, min Warden HP, boss TTK, peak density, spawn directions |
| continuation | whether tester voluntarily starts another loop/run after seeing the reward |

A tester counts as a repeat only when they voluntarily begin another combat loop/run after observing one complete reward event, without facilitator instruction. `repeat_rate = repeaters / eligible testers`; target is ≥0.70.

## Current evidence and verdict

The current head exposes deterministic 60 Hz movement/auto-combat, Warden and Gate integrity, ten authored tactic records, seeded timing/density/spawn direction, six policy IDs, occupation progress/capture, spatial extraction progress, XP/growth/item/companion/reward paths and ten-stage campaign state. The catalog's R2 occupation bounds are 180–360-tick holds, movement ×1.04–1.08, range ×1.06–1.12 and recovery +4–12/s; extraction windows are 600 ticks and the current spatial hold is 120 ticks.

That surface is not verified. Current-head QA reports 9/23 focused simulation/adapter failures involving elite extraction, final victory/rewards, active-skill offers, item ordering and cutscene expectations. A five-archetype × ten-stage probe produced 0/50 wins. Earlier 100%-win short-stage observations are historical, not current-head evidence.

**G7 verdict: FIX.** The 30–180-second numeric model, ≥3-action rule and ≥1-reward rule are explicit, but event ordering, candidate-relative extraction, viable outcomes and the mandatory feature chain are red or unproven. No qualifying human repeat-rate receipt exists. Therefore G7 is not PASS.
