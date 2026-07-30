# Abyssal Surge: Simulation System Surface Map

## Surface Map

| Symbol | Location | Responsibility |
|--------|----------|-----------------|
| `tick(run)` | defense-run-simulation.js:2843 | Master loop entry point; increments run.tick, processes all phases in strict order |
| `emit(run, type, payload)` | defense-run-simulation.js:380 | Event emission; creates event object with version/tick/type/sequence, enriches with story/quest data, pushes to `run.events[]` |
| `run.events` | defense-run-simulation.js:2845 | Event queue (array); cleared each tick, populated during that tick, exported in snapshot |
| `STAGE_ENCOUNTER_ROUTES` | defense-catalog.js:470 | Map of `stageId → EncounterRoute` with commitmentCap, maxConcurrentEnemies, spawnIntervalTicks, objectives[], paths[], finale |
| `STAGE_WAVE_DOCTRINE` | defense-catalog.js:658 | Map of `stageId → {defenseTicks, waveCount, classes, kindCycle, pressureLane, midbossEnemy}` |
| `STAGES` | defense-catalog.js:814 | Array of 3 stage objects with id, name, scale, eliteKind, boss, **wavePlan** (derived from doctrine) |
| `ARENA` | defense-catalog.js:12 | `{width: 24000, height: 12000, gateX: 22000, gateY: 6000}` |
| `run.commander` | defense-run-simulation.js:3291 | Player actor with id, x, y, integrity, maxIntegrity, basicDamage, pickupRange, cooldownScale, critProfile, cooldowns{}, level, xp |
| `run.pickups[]` | defense-run-simulation.js:3248 | Array of pickup actors; each has id, kind ("echo"\|"item"), x, y, elevation, xp (echo only), itemId (item only), deniedUntil, deniedBy |
| `run.companions[]` | defense-run-simulation.js:3249 | Array of companion actors with id, companionId, status ("ACTIVE"\|"DOWNED"), hp, maxHp, aiState, aiTargetId |
| `run.waveSchedule[]` | (generated in createDefenseRun:3410) | Array of waves with slot, tick, waveIndex, kind, pattern, composition[], policyId, direction, routeId, objectiveId |
| `run.objectives` | defense-run-simulation.js:3282 | Object tracking phase ("gate-defense" → "occupation" → "boss-kill" → "extraction") and per-objective completion state |
| `run.terminal` | defense-run-simulation.js:3076 | Set to "DEFEAT", "VICTORY", or "FINAL_COMPLETION" when stage ends; gates growth offers |
| `getRunSnapshot(run)` | defense-run-simulation.js:3489 | Returns frozen clone of run suitable for serialization; feeds getRunDigest() and renderer |
| `getRunDigest(run)` | defense-run-simulation.js:3555 | Returns `JSON.stringify(getRunSnapshot(run))`; used for equality and replay comparison |

## Extension Points

### 1. Tick Loop Phase Order (lines 2843–3097)
Exact sequence within `tick(run)`:
1. **Line 2844**: Increment `run.tick`
2. **Line 2845**: Clear `run.events = []`
3. **Lines 2846**: Process queued inputs (if `run.inputs[0].at <= run.tick`)
4. **Lines 2847–3089**: Exit early if `run.growthOffer` exists (player waiting to select a skill)
5. **Lines 2849–2891**: Process encounter recovery, move commander (input-based + objective routing), emit MOVE events, update cooldowns, apply Warden regen
6. **Lines 2904–2912**: Wave spawning phase (enqueueEncounterWave if wave.at <= tick)
7. **Line 2915**: Spawn encounter entities (processEncounterSpawns)
8. **Lines 2917–2938**: Spawn elite after gate-defense completion, with escorts (terrain effects interleaved)
9. **Lines 2940**: Advance travelling projectiles (orbs)
10. **Lines 2943–2968**: Process legacy timed projectiles (enemy fire), resolve impacts
11. **Lines 2971–2981**: Resolve commander basic attack (if cooldown expired)
12. **Lines 2983**: Update companions (movement, AI targeting, collection claims)
13. **Line 2985**: Move enemies (policy-based targeting and pathfinding)
14. **Line 2987**: Separate overlapping bodies (unstick collision pairs)
15. **Line 2989**: Resolve deaths (emit ENEMY_DEFEATED, create pickups/candidate elite)
16. **Line 2990**: Process wave-clear recovery (commander + gate integrity)
17. **Line 2991**: Assign companion item claims (before collectPickups)
18. **Line 2992**: Collect pickups (echo XP + item grants, companion collection eligibility)
19. **Lines 2993–3034**: Update encounter objective completion, update objective phase, process objective pressure (pulse/deadline damage on gate)
20. **Lines 3036–3067**: Spawn boss if occupation completed and all non-boss enemies dead
21. **Lines 3069–3096**: Terminal check (defeat/victory) and growth offer gate

**Critical**: Events emitted during tick are collected in `run.events[]`, cleared at start of next tick, and exported in snapshots for renderer consumption.

### 2. STAGES, STAGE_ENCOUNTER_ROUTES, STAGE_TACTICS, ARENA Shapes

#### ARENA (defense-catalog.js:12)
```
export const ARENA = freeze({ 
  width: 24000,        // World width in units
  height: 12000,       // World height in units  
  gateX: 22000,        // Gate x-position (right side)
  gateY: 6000          // Gate y-position (center height)
});
```

#### STAGES (defense-catalog.js:814)
Three entries (cinder-span, abyss-chancel, echo-throne); each is a `stage()` factory call returning:
```
{
  id: string,                          // stage id
  name: string,                        // display name
  bossName: string,                    // boss entity name
  scale: number,                       // enemy HP scale (100=base, 240=hardest)
  eliteId: string,                     // elite companion id
  eliteKind: string,                   // elite enemy class for spawning
  eliteCompanion: string,              // elite extraction companion prototype id
  boss: string,                        // boss entity id
  legacyGateTicks: number,             // pre-doctrine authoring (unused by sim, kept for spawn budget)
  waves: [[tick, enemy, count], ...],  // legacy wave triples (fallback if wavePlan missing)
  doctrine: {...},                     // STAGE_WAVE_DOCTRINE entry
  wavePlan: [wave0, wave1, ...],       // Authoritative waves from buildDoctrineWavePlan()
  tactics: {...},                      // STAGE_TACTICS entry (terrain, spawns, objectives)
  encounterRoute: {...},               // STAGE_ENCOUNTER_ROUTES entry (objectives, paths)
  wavePattern: [...]                   // Pattern vocabulary for rendering
}
```

#### STAGE_ENCOUNTER_ROUTES[stageId] (defense-catalog.js:470)
```
{
  id: `encounter-route:${stageId}:v1`,
  commitmentCap: number,               // Max concurrent enemies committed to an objective
  maxConcurrentEnemies: number,        // Total concurrent enemies allowed
  spawnIntervalTicks: number,          // Ticks between spawns
  objectives: [                        // Ordered objective definitions
    {
      id: string,                      // "gate-defense", "occupation", "echo-recovery", "boss-kill"
      kind: string,                    // "gate" | "occupation" | "echo" | "boss"
      cameraCueId: string,
      point: {x, y},                   // Objective point in world coordinates
      waveSlots: [slot0, slot1, ...],  // Wave indices assigned to this objective
      retry: {commanderFloorBp, gateFloorBp, ...},  // Recovery after failure
      recovery: {commanderBp, gateBp, ...},         // Recovery after wave clear
      contestTicks: number             // Ticks an enemy must occupy to contest
    },
    ...
  ],
  paths: [                             // Encounter route paths
    {
      id: `encounter-path:${stageId}:${objectiveId}:${direction}`,
      objectiveId: string,
      direction: "W" | "NW" | "SW" | ...
      waypoints: [{id, x, y}, ...]     // Ordered path points (simulation coordinates)
    },
    ...
  ],
  finale: {                            // Elite and boss paths
    elitePathId: string,
    bossPathId: string,
    paths: [eliteRoute, bossRoute]
  }
}
```

#### STAGE_WAVE_DOCTRINE[stageId] (defense-catalog.js:658)
```
{
  gateIntegrity: number,               // Initial gate HP (1600/1700/1800)
  defenseTicks: number,                // Gate-hold duration in ticks (10200/10500/10800 = 170/175/180 s)
  waveCount: number,                   // Total waves (10/10/11)
  classes: ["class1", "class2", ...],  // Rotating enemy class pool
  kindCycle: ["normal", "big", "mid"], // Wave kind pattern (cycles every 4)
  pressureLane: "chokepath" | "flank", // Big wave pressure direction
  midbossEnemy: string                 // Guardian or flanker
}
```

#### STAGE_TACTICS[stageId] (defense-catalog.js:348)
```
{
  chokepath: {id, x, halfWidth},       // Pressure push point (center of a corridor)
  flank: {id, entryX, entryY, ...},    // Alternate flanking route
  spawnDirections?: ["W", "NW", ...],  // Override directions (defaults to W/NW/SW)
  elevation: {id, x, y, radius, ...},  // Terrain features
  hazard: {id, x, y, radius, damage, ...},  // Damage zones
  occupation: {id, x, y, radius, ...}, // Occupation objective point
  extraction: {id, x, y, radius, ...}  // Extraction objective point
}
```

### 3. Wave/Encounter Structure

#### Wave Declaration (defense-catalog.js:742, result of buildDoctrineWavePlan)
Each wave object in `stage.wavePlan[]`:
```
{
  slot: number,                        // Index 0 to waveCount-1
  waveIndex: number,                   // Same as slot
  kind: "normal" | "big" | "mid",      // WAVE_KIND_PROFILE[kind].countBp
  pattern: number,                     // Cadence ranking for UI
  count: number,                       // Total enemy count in this wave
  composition: [{enemy, count}, ...],  // Sized from HP budget, not body count
  direction: "W" | "NW" | "SW" | ...,  // Spawn direction
  routeId: string,                     // encounter-path:stageId:objectiveId:direction
  objectiveId: string,                 // Wave assigned to this objective
  policyId?: string,                   // "gate-pressure" (big) | "elite-escort" (mid) | null (normal rolls policy)
  selectionId: string,                 // Remix variant id
  alternativeId?: string,              // Alternative composition id
}
```

#### Phase Transitions (defense-run-simulation.js:2592, updateObjectivePhase)
Objective phase progression: "gate-defense" → "occupation" → "boss-kill" → "extraction"
- Triggered by: completion status of current objective (all waves fought, objective cleared)
- Emits: `OBJECTIVE_PHASE_CHANGED` event with old/new objectiveId
- Pressure timer resets on phase change (line 2625)

#### Boss Trigger (defense-run-simulation.js:3036)
Boss spawns when:
- `!run.bossSpawned` AND
- `run.objectives.occupation.completed` AND
- `run.objectives.phase === "boss-kill"` AND
- `run.tick >= run.stage.gateTicks` AND
- No boss-class enemies remain

#### Objective Completion Events
- `ENCOUNTER_OBJECTIVE_COMPLETED` (line 1106): Wave objective completed, emits with attempt/retries
- `OCCUPATION_CAPTURED` (line 2746): Occupation point held `maxHoldTicks` (emits effects object)
- `OBJECTIVE_COMPLETED` (line 2602/2607/2959): Final phase objective (gate-defense/growth/boss-kill)

### 4. Pickup Lifecycle

#### Creation (defense-run-simulation.js:2215)
After each enemy death (`resolveDeaths` line 2209):
```javascript
const echo = actor(nextId(run, "pickup"), "pickup", entry.x, entry.y, 1, 1, 
  { kind: "echo", xp: entry.xp, elevation: entry.elevation || 0 }
);
placeOnTerrain(run, echo, echo);
run.pickups.push(echo);
```
- Spawn point: enemy death location (x, y)
- Pickup object struct: `{id, kind, x, y, elevation, hp: 1, maxHp: 1, xp, deniedUntil: undefined, deniedBy: undefined}`
- Item pickups (from reward selection): inserted via applyReward -> applyItem (line 1750–1803)

#### Position Selection
- **Echo**: Placed at enemy death location via `placeOnTerrain()` (terrain collision adjusted)
- **Item**: Placed at reward grant location (same as echo)
- Elevation derived from terrain or explicitly set

#### Collection Detection (line 1762, collectPickups)
Two collection modes:
1. **Echo collection** (lines 1768–1790):
   - Triggers if commander within `run.commander.pickupRange` (default 12000 units)
   - Checks resource-denial policy (enemies that block xp)
   - If denied: set `deniedUntil = run.tick + 60` (1 second hold)
   - If not denied: remove from `run.pickups`, add `xp` to `run.commander.xp`, emit `ECHO_DENIED` or nothing

2. **Item collection** (lines 1793–1815):
   - Companion collects if claiming the pickup AND within `COMPANION_AUTONOMY.itemContactRange`
   - Commander collects if within pickupRange and no companion claimed it
   - If collected: remove from `run.pickups`, call `applyItem(run, pickup.itemId)`, emit `ITEM_COLLECTED`

#### Events Emitted
- `PICKUP_DENIED` (line 1785): Echo denied by resource-denial enemy
- `ECHO_DENIED` (line 1786): Same event, duplicate for legacy
- `ITEM_COLLECTED` (line 1805): Item granted, includes entityId (companion or commander), companionId (null if commander)

#### Current Grants (applyItem, line 1750)
```javascript
function applyItem(run, itemId) {
  const item = ITEMS[itemId];
  if (item.damageBonus) run.commander.basicDamage += item.damageBonus;
  if (item.maxIntegrity) {
    run.gate.maxIntegrity += item.maxIntegrity;
    run.gate.integrity = clamp(run.gate.integrity + item.integrity, 0, run.gate.maxIntegrity);
  }
  if (item.pickupRange) run.commander.pickupRange += item.pickupRange;
  if (item.cooldownReduction) run.commander.cooldownScale = clamp(run.commander.cooldownScale - item.cooldownReduction, 0.5, 1);
}
```
- Stat grants: basicDamage (immediate), maxIntegrity (gate only), pickupRange, cooldownScale
- Grants are direct assignments; no duration or timer mechanism

### 5. Player/Companion Stat Model and Buff/Modifier Truth

#### Player (Commander) Stats (line 3291)
```javascript
{
  integrity: number,           // Current HP
  maxIntegrity: number,        // Max HP
  basicDamage: number,         // Base melee/projectile damage
  basicCooldown: number,       // Current cooldown counter (decrements each tick)
  basicTicks: number,          // Base cooldown in ticks (COMMANDER.basicCooldown = 24)
  cooldownScale: number,       // Multiplier (1.0 = no reduction, 0.5 = 50% faster)
  pickupRange: number,         // Detection radius for pickups
  critProfile: {chanceBp, damageBp},  // Crit chance (basis points) and damage multiplier
  cooldowns: {skillId: ticksRemaining, ...},  // Per-skill cooldown map
  level: number,               // Experience level (1–8)
  xp: number                   // Accumulated experience
}
```

#### Companion Stats (line 3375)
```javascript
{
  companionId: string,         // Reference id
  status: "ACTIVE" | "DOWNED", // Alive/dead state
  hp: number,                  // Current health
  maxHp: number,               // Max health (derived from class)
  aiState: string,             // "IDLE" | "COMBAT" | "COLLECT" | "DOWNED"
  aiTargetId: string | null,   // Target enemy or pickup id
  formationSlot: "FRONT" | "BACK"  // Position rank (read-only, derived from stance + index)
}
```

#### Temporary Modifiers: **NONE EXISTS**
The system has NO buff, aura, status-effect, or timer-based modifier mechanism.
- Stat changes are immediate and permanent (item grants, skill ranks, carry-over)
- The only time-based effects are:
  1. **cooldownScale**: Multiplicative cooldown modifier (persistent, item/skill/reward grant)
  2. **deniedUntil**: Echo denial hold timer (line 1772, 60-tick hold after denial)
  3. **Warden damage response thresholds**: One-time triggers at integrity ≤30% (wardensWard) and ≤15% (awakening reset), marked consumed and never re-trigger
  4. **First-strike flag**: One-per-run bonus damage flag (consumeFirstStrikeFactor line 1180)

**Critical for buff implementation**: To add timed stat buffs, create a new `run.modifiers` array:
```javascript
run.modifiers = [{
  id: string,           // unique id
  stat: "basicDamage" | "maxIntegrity" | "pickupRange" | ...,
  value: number,        // bonus/multiplier
  kind: "add" | "mult", // application method
  expiresAt: number     // tick when this expires
}];
```
Then in `tick()` before combat resolution (line 2971), iterate modifiers, remove expired, apply active to run.commander stats. No existing infrastructure—you must wire it from scratch.

### 6. Stage Duration Bounds

#### Tick Budget
- **TICK_RATE**: 60 Hz (defense-catalog.js:11)
- **Gate-hold window** (defenseTicks from STAGE_WAVE_DOCTRINE):
  - cinder-span: 10,200 ticks = 170 seconds
  - abyss-chancel: 10,500 ticks = 175 seconds
  - echo-throne: 10,800 ticks = 180 seconds
- **Hard ceiling**: None; simulation runs until terminal condition (DEFEAT/VICTORY)

#### Wave Count
- cinder-span: 10 waves
- abyss-chancel: 10 waves
- echo-throne: 11 waves

#### Objective Pressure Deadlines
- **OBJECTIVE_PRESSURE_GRACE_TICKS**: 3600 (60 seconds) — applies AFTER gate-defense defenseTicks + 60-second slack
- **OBJECTIVE_PRESSURE_INTERVAL_TICKS**: 600 (10 seconds) — pulse interval
- **OBJECTIVE_PRESSURE_DAMAGE**: 100 per pulse (on gate.integrity)
- **BOSS_PRESSURE_GRACE_TICKS**: 1800 (30 seconds) — boss-phase grace
- **ECHO_RECOVERY_PRESSURE_GRACE_TICKS**: 150 (2.5 seconds) — echo phase grace

Max run length (gate-hold only): 10,800 + 3,600 + enough pulsing to grind gate to 0. At 100 damage per 10-second pulse, ~100 pulses = 1000 seconds extra. **Practical ceiling: ~3000–4000 seconds worst case.**

### 7. getRunDigest() and Determinism

#### Contract (line 3555)
```javascript
export function getRunDigest(run) { 
  return JSON.stringify(getRunSnapshot(run)); 
}
```

#### What Feeds Digest (getRunSnapshot, line 3489)
All snapshot-version-7 fields:
- `tick`, `stageId`, `terminal`
- `plan` (identity, mapPlanId, wavePlanId, m4PlanId)
- `gate`, `commander` (full state including all stats)
- `companions[]`, `enemies[]`, `projectiles[]`, `pickups[]` (sorted by id)
- `objectives`, `objectivePressure`, `occupationProgress`, `extractionProgress`
- `waveVariant`, `rewardOffer`, `growthOffer`, `itemIds[]`, `rewardIds[]`
- `progress`, `encounters`, `m4`, `eliteCandidate`, `wardenState` (selective fields)
- `events[]` (all emitted during this tick, included in snapshot)

#### Determinism Invariant
Digest equality guarantees **identical gameplay state**. Breaking determinism requires:
- Seeded RNG change (affects wave composition rolling): `run.rng` mutation outside buildWaveSchedule
- Floating-point math: current code uses integer-only arithmetic
- Unordered collection iteration: all enemies/projectiles/pickups sorted by id before snapshot
- Input processing order: inputs queued and processed in tick order
- Any non-deterministic input injection or state read without replay seed

**Critical**: `run.events` is NOT deterministic across replays (external narrative context, quest data may differ); exclude from digest if running offline comparisons.

### 8. Event Emission Mechanism

#### Channel
Single array: `run.events[]` (cleared each tick, line 2845)

#### Emission Signature (line 380)
```javascript
const emit = (run, type, payload = {}) => {
  const event = {
    version: EVENT_VERSION,
    tick: run.tick,
    type,
    ...enrichedPayload,
    eventSequence,
    eventId: `${identity}:event:${eventSequence}`,
  };
  run.events.push(event);
  return event;
};
```

#### Event Types (Partial List)
**Spawn/Combat**:
- `ENEMY_SPAWNED`, `MIDBOSS_SPAWNED`, `BOSS_SPAWNED`
- `WEAPON_FIRED`, `PROJECTILE_IMPACT`, `PROJECTILE_BLOCKED`, `CRITICAL_HIT`
- `ENEMY_ATTACK`, `COMMANDER_DAMAGED`, `COMPANION_DAMAGED`
- `MELEE_SWEEP`, `MELEE_IMPACT`, `SKILL_CAST`, `SKILL_RESOLVED_DAMAGE`

**Objectives**:
- `ENCOUNTER_OBJECTIVE_COMPLETED`, `ENCOUNTER_OBJECTIVE_STARTED`, `ENCOUNTER_OBJECTIVE_FAILED`
- `OBJECTIVE_COMPLETED`, `OBJECTIVE_PHASE_CHANGED`
- `OCCUPATION_CAPTURED`, `EXTRACTION_COMPLETED`
- `WAVE_CLEARED`, `WAVE_VARIANT_STARTED`

**Pickups/Items**:
- `ITEM_COLLECTED`, `PICKUP_DENIED`, `ECHO_DENIED`
- `ELITE_EXTRACTED`, `ELITE_CANDIDATE_AVAILABLE`

**UI/Audio**:
- `GROWTH_OFFER`, `SKILL_SELECTED`, `REWARD_SELECTED`
- `MOVE`, `SKILL_COOLDOWN_READY`, `STANCE_SWITCHED`

**Termination**:
- `TERMINAL` (outcome: "DEFEAT", "VICTORY", "FINAL_COMPLETION")

#### Export to Renderer
Events exported in `getRunSnapshot()` line 3529:
```javascript
events: run.events.map((event) => ({ version: EVENT_VERSION, ...event })),
```
Snapshot is frozen and returned to caller (used by browser rendering and serialization).

---

## Risks

1. **No timed stat buffs exist**: Adding duration-based modifiers requires new per-modifier array, tick-loop integration for expiry, and stat application order (stacking conflicts with current immediate-assignment pattern).

2. **Wave composition determinism critical**: RNG seeding in buildWaveSchedule (line 458) is the only source of wave variance. Changing seed or RNG algorithm breaks all replays.

3. **Event enrichment narrative context**: Story/quest data injected during emit (line 390–404) is external; digest comparisons must exclude events if offline simulation cannot guarantee identical narrative state.

4. **Integer-only arithmetic for determinism**: All damage, damage multipliers, cooldowns, and position calculations use `Math.trunc()` and integer ops. Any float promotion silently breaks digest equality.

5. **Pickup denial window**: Denial hold (deniedUntil) is set to `run.tick + 60` (1-second hold) and checked on the same pickup in later ticks. Multiple deniers can stack this; no queue or fairness logic.

6. **Companion item claiming**: Claim order is deterministic (companions sorted by id, pickups sorted by id), but closest-distance ties are broken by position rank (index). Reordering companions in `run.companions` array will cause claim reallocation.

7. **Objective pressure timing**: Pressure grace is additive (defenseTicks + grace + standard 60s slack). If authoring new objectives, ensure pressure deadlines are intentional; current 3600-tick grace may be too generous for short phases.
