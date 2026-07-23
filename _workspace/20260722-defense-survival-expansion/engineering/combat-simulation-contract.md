# Combat simulation contract

## Authority and cadence

`defense-run-simulation.js` is the only authority for a defense run. It advances in exact integer ticks at `TICK_RATE = 60`, consumes queued commands on their authored tick, and returns deeply frozen state. Catalog values remain immutable in `defense-catalog.js`; renderers, audio, telemetry, campaign persistence, and UI code are passive observers of snapshots and events.

The public run functions remain `createDefenseRun`, `queueInput`, `advanceDefenseRun`, `getRunSnapshot`, `getRunDigest`, and `isTerminalRun`. A run uses integer positions, damage, cooldowns, progress counters, and xorshift32 state. It never reads wall-clock time, DOM state, network state, or ambient randomness.

## Catalog schema consumed

The simulation consumes the live catalog conventions coordinated with Systems Design:

- `ENEMIES[id].policyId`, `BOSSES[id].policyId`, and `ENEMIES/BOSSES.attackTicks`.
- `ENEMY_POLICIES[id] = { id, target, intent }`.
- `STAGES[].tactics` / `STAGE_TACTICS[stageId]` with `chokepath`, `flank`, `elevation`, `hazard`, `occupation`, `extraction`, `spawnDirections`, and `seededVariation`.
- `STAGES[].wavePattern` and `STAGES[].waves`.

The engine does not copy authored per-stage values into another content table. Its only fallback tactics preserve old or incomplete stage records.

## Replay and seeded waves

A nonzero unsigned run seed initializes xorshift32. Zero normalizes to one. Each authored wave deterministically derives:

- timing jitter;
- density delta;
- authored spawn direction;
- lane offset;
- policy selection from the role-compatible deterministic set (including pursuit and low-HP focus variants).

`waveVariant` is versioned and records the seed, stable variant ID, and detached schedule. The schedule sorts by `at`, then original `waveIndex`; actor and target ties sort by stable entity ID after priority, distance, and HP. Same catalog, seed, and queued inputs therefore produce the same digest. Different seeds expose their variation through `waveVariant`, `WAVE_VARIANT_STARTED`, `spawnDirection`, routes, and policy events.

## Lane and terrain resolution

Enemies use small authored waypoint arrays, not runtime pathfinding:

- gate pressure traverses the stage chokepath before the Gate;
- flank traverses the authored flank entry before choosing Warden or Gate by distance;
- pursuit tracks the Warden's current position;
- resource denial tracks the nearest Echo using distance then stable ID;
- elite escort follows the living elite/boss and falls back to the Gate;
The stage elite and one guardian escort enter only after Gate defense completes. The escort acquires the living elite, exposes `escortLeaderId` in snapshots, and emits `ESCORT_LEADER_ACQUIRED`; this makes escort behavior observable without opening pre-Gate Echo recovery.
- low-HP focus compares current Warden/Gate integrity ratios.

Chokepaths reduce traversal speed while occupied. Elevation changes effective Warden/companion range. Hazards apply their exact authored `damagePerSecond` through deterministic fixed-point remainders. Occupation applies authored movement and range effects after capture. Recovery applies only while the Warden is physically inside the occupation point, uses the same fixed-point accumulation, and caps actual per-stage Warden/Gate recovery at 25 percent of each maximum integrity. An authored `4/s` therefore produces exactly four integrity over 60 continuously eligible ticks, not one per tick.

## Mandatory objective chain

The authoritative objective order is:

1. `gate-defense`: the gate tick is reached, all seeded waves have spawned, and non-elite attackers are resolved;
2. `echo-recovery`: the stage's single elite is defeated and creates its Echo candidate;
3. `growth`: at least one deterministic three-choice run skill is learned;
4. `occupation`: the Warden holds the authored point for the consecutive authored `holdTicks`, reset by leaving or contest;
5. `extraction`: the Warden holds the authored Bind point for 120 consecutive uncontested ticks;
6. `boss-kill`: the extracted Echo joins the run, then the boss spawns and must die.

The elite cannot suicide-breach out of the run. Its defeat makes the candidate available for the growth and occupation phases; capturing occupation opens the authored extraction window and emits `EXTRACTION_WINDOW_OPENED`. No extraction progress exists before that candidate. Leaving or contesting the Bind resets progress. Completion is capped at 120 ticks, emits `EXTRACTION_COMPLETED` and exactly one `ELITE_EXTRACTED`, adds exactly one canonical companion, and marks `extracted`. The legacy `EXTRACT_ELITE` input cannot bypass the spatial hold; a valid early attempt starts deterministic Warden routing through the current occupation/Bind objective while still emitting `EXTRACTION_REJECTED` with `EXTRACTION_HOLD_INCOMPLETE`. Invalid attempts emit a deterministic rejection reason. Bind-window expiry emits `OBJECTIVE_FAILED` and resolves the run as defeat.

Occupation progress is capped at its authored maximum. Capture persists. Resource-denial actors can contest points and temporarily deny collection of an Echo without deleting the item/Echo record; denial exposes `PICKUP_DENIED` and `ECHO_DENIED`.

## Combat pressure

Warden and companion attacks create projectiles. Every launch emits `WEAPON_FIRED`; every resolved projectile emits `PROJECTILE_IMPACT` with actual damage, hit state, source, target, owner, and an optional escort guard. Elite escorts reduce intercepted damage to a nearby leader by 25 percent.

Enemies and bosses have deterministic `attackCooldown` / catalog `attackTicks`. Contact damage is never applied once per simulation tick. Boss contact starts a catalog-length, stationary `BOSS_ATTACK_TELEGRAPHED` windup; disengaging cancels it truthfully, while remaining in contact resolves a real attack and authoritative damage. Ranged cadence remains catalog `projectileTicks`. Attacks emit `ENEMY_ATTACK`, followed by authoritative `COMMANDER_DAMAGED` or `GATE_BREACHED`. Gate-pressure non-elites breach once; elites and bosses remain present and attack on cooldown. Each stage-specific boss uses its catalog HP directly rather than receiving a second stage-scale multiplication. Pursuit and low-HP policies make Warden movement and current integrity change real pressure rather than presentation-only motion.

## Snapshot and event projection

Snapshot schema version is `4`; event schema version is `2`. `getRunSnapshot` returns detached, deeply frozen plain data including:

- `stageLayout` with chokepath, flank, elevation, hazard, occupation point, and extraction point;
- `waveVariant` and each enemy's route, waypoint, `spawnDirection`, `policyId`, `policyIntent`, and `policyTarget`;
- authoritative `objectives`, `occupationProgress`, `extractionProgress`, and `objectiveProgress`;
- Gate, Warden, enemies, companions, projectiles, pickups, rewards, growth, cutscene, and terminal state;
- versioned events.

Movement events carry actual before/after coordinates. Policy, wave, weapon, impact, hazard, recovery, occupation, extraction, objective, boss, reward, and terminal events report simulation truth. Telemetry and presentation must not infer or overwrite state.

## Compatibility boundaries

Exported function names, input names, stage/enemy/reward IDs, sorted actor snapshots, deterministic digest behavior, campaign reward selection, and the three original stage cutscenes remain compatible. Later-stage cutscene lookup keeps the established default fallback contract. The new spatial Bind intentionally rejects the previous remote one-tick extraction shortcut.
## 2026-07-22 stabilization handoff

The stabilization keeps catalog HP, damage, speed, attack cadence, wave fields, and seeded policy selection unchanged. A run records whether the Warden has authored combat input. During Gate defense, commander-targeting policies still move toward the Warden, but engaged runs defer their attack release using deterministic per-policy leads (`player-pursuit` 360 ticks, `resource-denial` and `low-hp-focus` 240 ticks, `flank` 120 ticks); literal no-input runs receive no deferment and still lose to pressure. When an engaged Warden is guarding the Gate, incoming commander pressure is intercepted by the healthier integrity pool, with separate authoritative `COMMANDER_DAMAGED` and `GATE_BREACHED` events. After extraction the same Gate-screening rule remains available while the Warden is in range. Bosses receive a deterministic 1,800-tick objective-entry pressure grace, deal a minimal authoritative Gate breach on arrival, and must resolve real attack pressure before lethal damage can complete the stage.

Every incomplete objective phase now has deterministic pressure state in the snapshot. After 3,600 ticks in one phase, `OBJECTIVE_PRESSURE_PULSE` applies 100 Gate damage every 600 ticks. `OBJECTIVE_PRESSURE_DEADLINE` consumes remaining Gate integrity at `stage.gateTicks + 9,000`; terminal resolution remains the ordinary ordered `TERMINAL` defeat path. Phase changes reset the pulse grace but not the absolute deadline. This resolves the previously stalled Skirmisher and incomplete Gate-defense runs without auto-completing Gate defense, Echo recovery, growth, occupation, extraction, or boss kill.

### Final measured receipt

- Baseline reproduced before edits: legacy simulation/campaign `14/23`; expansion set `20/26`; seed-17 five-archetype rotation `11/50` victories with Gatekeeper `0/10`, Hunter `4/10`, Collector `4/10`, Skirmisher `0/10` plus eight unresolved, and Generalist `3/10`.
- The growth XP P1 remains fixed by capturing the completed-level threshold before mutating `commander.level`; the first `36` XP offer spends `30` and preserves `6`, with the same carryover rule for later levels. Growth offers now additionally require both Gate defense and Echo recovery to be complete; accumulated XP is retained until the observable `growth` phase.
- The final public controller’s current-head baseline was `20/50` victories (`40%`), zero unresolved: Gatekeeper `4/10`, Hunter `2/10`, Collector `4/10`, Skirmisher `6/10`, Generalist `4/10`, with `20` exact-order clears.
- One global causal lever was tested: engaged, commander-targeted enemy attacks consume their ordinary cooldown and emit `ENEMY_PRESSURE_DELAYED` during the first fixed ticks of Echo recovery. At `100` ticks: `21/50` (`42%`), Gatekeeper `5`, Hunter `2`, Collector `4`, Skirmisher `6`, Generalist `4`, viable `1`, ordered clears `21`. At `150` ticks: `24/50` (`48%`), Gatekeeper `6`, Hunter `3`, Collector `4`, Skirmisher `6`, Generalist `5`, viable `1`, ordered clears `24`. At `300` ticks: `27/50` (`54%`), Gatekeeper `7`, Hunter `3`, Collector `5`, Skirmisher `6`, Generalist `6`, viable `1`, ordered clears `27`. Every candidate had zero unresolved and replay `50/50`. Production freezes the aggregate-safe `150`-tick base for honest adaptive-controller testing; the over-buffing `300`-tick result and under-band `100`-tick result are evidence only.
- The authorized orthogonal candidate combined the `150`-tick grace with one positive commander-damage application per tick and deterministic blocked-hit evidence. Its exact matrix produced `34/50` (`68%`), zero unresolved, replay `50/50`, ordered clears `34`: Gatekeeper `6`, Hunter `7`, Collector `7`, Skirmisher `8`, Generalist `6`, viable archetypes `0`. It violated aggregate, diversity, and Skirmisher caps. The serialization helper, event, contact/projectile hooks, and transient field were fully removed; no part of that candidate remains.
- Two-active damage-per-cooldown combo EV is explicitly measured across ten pairs: median `7.0734126984`, maximum `9.0598290598`, ratio `1.2808285683×`. The current catalog is within the signed `1.30×` cap.
- The last pre-sequencing strict receipt was `30/30`, zero internal failures, `pass: true`; final QA must regenerate it because the offer gate changes run timing.
- Frozen production source receipt: `ECHO_RECOVERY_PRESSURE_GRACE_TICKS = 150`, serialization absent, SHA-256 `7b6f0c3bd1410c2055a98225179b7448acf7efd7aaa1b228bd17234ebde90c0c`. `node --check defense-run-simulation.js` passed. `node --test tests/defense-run-simulation.test.mjs tests/defense-expansion-contract.test.mjs` passed `32/32`, including S1 order and literal no-input defeat.
- Same-seed and edge-equivalent digests pass; different seeds retain distinct wave/policy snapshots in the focused command above.

### Fixed / deferred disposition

Fixed: mandatory Gate defense → Echo recovery → growth sequencing; correct XP threshold spending with carryover across growth levels; QA-D010 incomplete-objective stalls and unresolved 18k outcomes; literal no-input defeat; deterministic pressure snapshot/event evidence; authoritative Bulwark Brand Gate-damage delta; authoritative post-route boss pressure.
Deferred: QA-D002/G3 archetype diversity. Production uses the `150`-tick Echo grace (`24/50`, `48%`) as the best aggregate-safe base; only Generalist is exactly `5/10`, so honest adaptive-controller evidence remains required. The rejected serialization candidate remains fully absent. Catalog HP, damage, speed, attack cadence, and active-skill values remain frozen.
