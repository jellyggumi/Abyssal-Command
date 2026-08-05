# Abyssal Command — Actual Gameplay Systems Inventory

**Baseline:** git HEAD `2166c52` on branch `feature/first_lee` (verified `git rev-parse HEAD`).
**Method:** read-only source trace of `defense-run-simulation.js` (2371 ln), `defense-catalog.js` (703), `rpg-catalog.js` (344), `campaign-state.js` (387), `stage-world-catalog.js` (522), and the run-flow parts of `app.js` (2737). Every claim carries `file:line` or a symbol. The stale status doc was NOT used as a source.

**Genre in code:** mobile-first single-player defense-survivor. One deterministic 60 Hz run per stage; a 10-stage campaign; a permanent "Solo Warden" RPG meta layer; and an offline idle-settle ("Undertow Encroachment") layer. Two currencies: **Echo Core** + **Bound Fragment**.

---

## 1. Core combat loop

| Aspect | Actual behavior | Evidence |
|---|---|---|
| Tick model | Deterministic, renderer-neutral 60 Hz. `TICK_RATE=60`. `tick(run)` is the whole-frame step; `advanceDefenseRun(run, steps)` runs `steps` ticks, stopping early on growth-offer or terminal. RNG is xorshift32 (`rngNext`); combat crits use a separate `combatRng` stream. | `defense-catalog.js:11`; `defense-run-simulation.js:1803-2019`, `:2253-2294`, `:29`, `:2067` |
| Movement input | 8-direction "octant" D-pad only (`OCTANT_VECTORS`). `MOVE` input sets `commander.move`; touch D-pad + keyboard both emit `MOVE`/`IDLE`. Commander speed 4100. There is also an auto-route mode (`objectiveRoute`) that walks the commander to the occupation/extraction point. No free-aim / no tap-to-move to arbitrary point. | `defense-catalog.js:13-18`, `:21`; `app.js:1652`,`:1660`,`:1666`,`:1693-1694`; sim `:1202-1207`,`:1811-1836` |
| Auto-attack | Fully automatic. Commander fires every `basicCooldown=24` ticks at nearest priority target within `basicRange=6000`; `basicDamage=900`; crit 15% (`chanceBp:1500`) for ×2 (`multiplierBp:20000`). Companions auto-fire on their own `fireTicks` cadence at nearest target. Player never manually basic-attacks. | `defense-catalog.js:19-32`; sim `:1952-1962` (commander), `:820-832` (companions), `:836-850` (crit) |
| Skills | 5 active skills are player-cast via `SKILL_CAST` (targeted or radial AoE); each has a cooldown scaled by `cooldownScale`. 3 passive skills apply flat bonuses on pickup. Actives: Echo Bolt/Lance/Pulse/Aegis(heal)/Dusk Step. | `defense-catalog.js:294-303`; sim `:1009-1116`, `:985-1007`; `app.js:2373` |
| Enemy spawning / waves | Per-stage `waveSchedule` built by `buildWaveSchedule` from the stage's authored waves + seeded timing/density/lane jitter. Each stage has 3 authored wave slots. Wave-composition variety only exists for 4 stages (see §7/§8). | sim `:265-339`, `:1864-1891`; catalog `:521-531` |
| Elite fight | After gate-defense objective completes, exactly one **elite** spawns (a reskin of a base enemy type at ×4 HP, ×4 XP, ×0.8 speed) plus one guardian escort. Killing it drops the extraction candidate + a stage item and completes echo-recovery. | sim `:1894-1898`, `:471-529`, `:1306-1345` |
| Boss fight | After occupation+extraction objectives complete AND `tick ≥ stage.gateTicks` AND no non-boss enemies remain, the stage boss spawns. Bosses telegraph attacks (`attackWindup` → `BOSS_ATTACK_TELEGRAPHED`), have an arrival gate-hit, and a `BOSS_PRESSURE_GRACE_TICKS=1800` grace. 10 distinct boss stat blocks (HP 40k→150k). | sim `:1973-1978`, `:531-595`, `:1497-1516`, `:240`; catalog `:304-315` |
| Win condition | Boss killed → `terminal="VICTORY"` (or `"FINAL_COMPLETION"` on `gate-zenith`); opens the stage reward offer. | sim `:1989-2008` |
| Lose condition | `gate.integrity ≤ 0` OR `commander.integrity ≤ 0` OR extraction window failed → `terminal="DEFEAT"`. | sim `:1980-1988` |
| Objective phase machine | Ordered: `gate-defense → echo-recovery → growth → occupation → extraction → boss-kill → complete`. Phase drives enemy pressure targeting and the auto-route target. | sim `:1602-1617`, `:1585-1601` |
| Moment-to-moment | Steer the commander on an 8-way pad around a fixed gate; auto-attacks + companion fire clear scheduled waves; collect Echo (XP) pickups; survive to clear waves → kill the elite → hold occupation point → hold extraction point (timed window) → extract the elite (capture) → kill the boss. Hazard zones, choke slowdowns, and enemy "denial"/"flank"/"escort" policies add positional pressure. | sim `:1657-1800` (hazard/occupation/extraction), `:1352-1401` (enemy policies) |

Enemy roster (base classes, HP/speed/dmg/xp): `rusher 3000/3000/10/8`, `flanker 3600/3300/12/10`, `guardian 9000/1700/20/18`, `ranged 2800/2000/20/12` (ranged has a 6000 projectile). Enemy HP+XP scale by `stage.scale` (100→240). — `defense-catalog.js:277-282`; sim `:472-479`.

---

## 2. Survivor / roguelite layer (in-run growth)

| Aspect | Actual | Evidence |
|---|---|---|
| XP source | Every enemy killed drops an Echo pickup worth its `xp`; commander absorbs within `pickupRange`. `ranged`/`resource-denial` enemies can temporarily *deny* echoes (60-tick lockout). | sim `:1294`, `:908-968`, `:1437-1456` |
| Level curve | `XP_GROWTH = [30,55,85,120,160,205,255,310]` — 8 thresholds. Effective **max level 9** (8 level-ups). | catalog `:138`; sim `:2016`, `:989` |
| Level-up offer | On threshold reached (gated: gate-defense + echo-recovery done, integrity >10%, no item collected that tick), `makeOffer` presents **3 choices** drawn without replacement from the **pool of 8** skills not yet learned. | sim `:971-982`, `:2012-2018` |
| Skill pool | 8 total: 5 active (`rift-bolt`, `soul-lance`, `grave-pulse`, `void-aegis`=+50 integrity, `shadow-step`) + 3 passive (`eclipse-edge` +180 basic dmg, `soul-magnet` +1500 pickup, `ward-binder` +120 max integrity). | catalog `:294-303` |
| Per-run build variety | Determined by WHICH subset of the 8 skills you pick and in WHAT order (3 offered per level, no dupes). No skill ranks/upgrades within a run beyond first acquisition (`skillRanks[id]=1`). No stat-choice cards, no weapon evolutions — the only in-run roguelite axis is the 8-skill draft. | sim `:985-1007`, `:992` |
| In-run items | Elite drops one authored stage item (5 distinct `ITEMS`); companions can auto-collect items. Items give flat run buffs (dmg / max-integrity / pickup / cooldown). | catalog `:139-145`, `:617-628`; sim `:1307-1311`, `:896-906`, `:738-785` |
| Reward selection | On victory, `rewardOffer.choices = STAGE_REWARD_IDS[stage]` (3–5 per stage); player picks one via `REWARD_SELECTED`; it's banked to the campaign and re-applied at the *start* of future runs (companion legacy / cooldown / integrity / crit / pickup modifiers). | sim `:1995`, `:1226-1231`, `:452-469`; catalog `:629-640` |

---

## 3. Warden RPG layer (permanent, Solo Warden — Track A)

All permanent; **no respec** anywhere. Composed into runtime modifiers by `deriveWardenRuntimeStats` (`rpg-catalog.js:216-307`) and applied in `createDefenseRun` (`sim:2196-2223`).

| System | Actual | Evidence |
|---|---|---|
| 6 stats + cost curve | 6 stats, each max 10 points: `binding-might` (+15 basic/pt), `abyssal-resonance` (+2% skill dmg/pt), `echo-swiftness` (+0.5% CDR/pt, cap 5%), `gate-resolve` (+20 max integrity/pt), `fracture-precision` (+100bp crit/pt), `reclaim-radius` (+150 pickup/pt). n-th point costs `ceil(n/2)+1` → `[2,2,3,3,4,4,5,5,6,6]`, one stat fully maxed = 40 Echo Core (= entire budget). | `rpg-catalog.js:30-44`; budget `:29` |
| 5-node skill tree | 5 nodes, two branches + shared capstone. `echo-backlash`(5)→`echo-cascade`(8) [attack]; `wardens-ward`(5)→`wardens-vigil`(8) [survival]; `echo-warden-awakening`(15) capstone requires both t2. **Total cost 41 > 40 budget** (intentional: cannot buy everything). | `rpg-catalog.js:46-54` |
| Traits | **8-trait pool**, offered **3-at-a-time, pick-1**, at stage-clear sequences **2/4/6/8/10** (`WARDEN_TRAIT_UNLOCK_SEQUENCES`) → max **5 traits owned**. Deterministic round-robin offers, already-owned excluded. Each is a tradeoff (e.g. `elite-hunter` +20% vs elites / −10% normal). | `rpg-catalog.js:56-84`; UI `app.js:511-515`,`:799` |
| Equipment tiers | Shared 5-tier ladder (T1 ×1.00 → T5 ×2.00), 3 slots (`weapon`/`ward`/`trinket`), for the Warden AND each companion. Weapon→damage, ward→max integrity (Warden) / formation-integrity (companion), trinket→pickup(Warden)/range(companion). | `rpg-catalog.js:175-203`, derive `:216-331` |
| Formation | Loadout max 3 (`MAX_LOADOUT_SIZE`). Saved per-companion **FRONT/BACK intent** map chooses position rank; the live FRONT count is owned by the **in-run stance** (§below), max 2 FRONT (`MAX_FRONT_SLOTS`). BACK companions get **+25% damage** when ≥1 FRONT alive (`BACK_ROW_SYNERGY_DAMAGE_BONUS`). | `rpg-catalog.js:97-110`; sim `:826-828`, `:375-381` |
| Formation stances (in-run) | 3 stances `VANGUARD / TURRET / SPLIT`, cycled live via `STANCE_CYCLE` input on a 4-second cooldown; each has offsets + `derivedFrontCount` (2/1/1). Replaces the old "companions snap to commander" model. | `rpg-catalog.js:118-173`; sim `:1208-1219`, `:367-377`; `app.js:2484` |
| Companion roles | 3 role passives (`vanguard`/`striker`/`support`), fixed by companion id (3 members each) — no per-companion stat allocation. Roles buff self-integrity / damage / commander pickup+CDR. | `rpg-catalog.js:86-95`; sim `:2214-2221` |
| Power governance | `POWER_GOVERNANCE` ceilings (R1/R3/R5) exist as DATA but are **NOT enforced at runtime** (see §Dead/Stub). | `rpg-catalog.js:333-344` |

---

## 4. Meta-progression (campaign persistence)

Owned by `campaign-state.js`; persisted via `DefenseStorage`. Immutable-copy state machine.

| System | Actual | Evidence |
|---|---|---|
| Elite capture → companion | On extraction, `applyEliteExtractionEvents`→`captureElite` adds the elite's `prototype` to `companionCollection` (evolution starts 1, +1 per new elite id captured, capped 3). Only ONE elite handoff per run. | `campaign-state.js:251-300`; `app.js:2654` |
| Persistent state | `unlockedStageIndex`, `resolvedIds`, `attemptsByStage`, `companionCollection`, `companionLoadout`, `companionFormation`, `rewardIds`, `achievementIds`, `wardenProgress` (statPoints/skillTreeIds/traitIds), `ownedEquipmentIds`, `idleReturn`. All survive across runs; serialized/restored. | `campaign-state.js:128-146`, `:377-387` |
| Stage unlock gating | `startRun` rejects stages `> unlockedStageIndex`. On victory, `applyCampaignRunResult` bumps `unlockedStageIndex` to `min(index+1, 9)` and records `stage-clear:*` achievement + the chosen reward. Strictly linear 10-stage gate. | `campaign-state.js:186-215` |
| Companion evolution | `evolution` (1–3) is tracked + shown in UI ("진화 N") but has **no gameplay effect** — no runtime-stat function reads it (see §Dead/Stub). | `campaign-state.js:297`; `app.js:602`; absent from `rpg-catalog.js:313-331` |

---

## 5. Idle layer — "Undertow Encroachment" / `settleIdleReturn`

| Aspect | Actual | Evidence |
|---|---|---|
| Trigger | On app boot: `storage.settleIdleReturn({ now })` → one-time "welcome back" toast + persisted recap. | `app.js:2723-2726`, `:1062-1069` |
| Accrual | `awardedProgress = completedStages × floor(settledElapsedMs / 60_000)` — i.e. (# cleared stages) per elapsed minute. Interval 60 s; capped at `MAX_ELAPSED = 8h`. | `campaign-state.js:10-12`, `:221-249` |
| Encroachment (comeback risk) | `wardlinePressure = min(floor(hours), 8)` vs `wardLevel = resolvedIds.length + floor(companionCollection.length/2)`. If **pressure > wardLevel → `ENCROACHED`, zero progress awarded** that window. So neglecting the campaign while under-leveled loses the idle payout. | `campaign-state.js:217-243` |
| Caps / outcomes | Outcomes: `INITIALIZED / EARLY / NO_COMPLETED_STAGES / ENCROACHED / CAPACITY_REACHED / SETTLED`. Needs ≥1 cleared stage to earn. | `campaign-state.js:224-249` |
| Sink | **NONE.** `idleReturn.totalProgress` only accumulates and is displayed ("누적 N"); it is never spent, converted, or consumed by any system. Purely a vanity counter. | `campaign-state.js:248`; `app.js:310-315` (only reader) |

---

## 6. Economy — Echo Core vs Bound Fragment

| Currency | Sources (budget) | Sinks | Evidence |
|---|---|---|---|
| **Echo Core** (`echo-core`) | +1 per **distinct captured elite id** (cap 10) **+3 per resolved stage** (cap 30) = **budget 40**. | Warden **stat points** (`wardenStatTotalCost`) + **skill-tree nodes** (node cost). Combined tree cost 41 > 40 budget → forced tradeoff. | `campaign-state.js:55-66`; `rpg-catalog.js:29`,`:46`,`:38-44` |
| **Bound Fragment** (`bound-fragment`) | +1 per **resolved stage** = **max 10**. | **Equipment tier upgrades** only. Per-tier-step cost `[1,2,3,4]` (T1→T5 one slot = 10 = whole budget). | `campaign-state.js:60-61`,`:67-72`; `rpg-catalog.js:185-192` |
| Budget enforcement | `allocateWardenStatPoint`/`unlockWardenSkillNode` check `echoCoreEarned − echoCoreSpent`; `purchaseEquipmentTier` checks `boundFragmentEarned − boundFragmentSpent`. Prereqs + max-tier enforced. | `campaign-state.js:325-375` |

Full-clear campaign yields exactly 40 Echo Core + 10 Bound Fragment — both budgets are sized to the 10-stage campaign, deliberately just short of "buy everything."

---

## 7. Content volume (actual catalog counts)

| Content | Count | Evidence |
|---|---|---|
| Stages (campaign) | **10** | `defense-catalog.js:520-531`; `campaign-state.js:13-24` |
| Base enemy classes | **4** (rusher, flanker, guardian, ranged) | `defense-catalog.js:277-282` |
| Elites | **10** — one authored `eliteId` per stage; each is a base-class reskin (×4 HP/XP) mapped to an `eliteCompanion` | `defense-catalog.js:521-530` |
| Bosses | **10** distinct stat blocks (s1–s10, HP 40k→150k) | `defense-catalog.js:304-315` |
| Companions (catalog) | **9** total. **6** are elite-capturable → persistent (ember-cohort, rift-lens, throne-echo, anchor-shard, veil-vanguard, dawnless-crown). **3** (pack-warden, lantern-reaver, requiem-warden) are **reward-legacy only** and NEVER persist (see §Dead/Stub). | `defense-catalog.js:283-293`; capturable set from `stage.eliteCompanion` `:521-530`; reward companions `:158-160` |
| Survivor skills | **8** (5 active + 3 passive) | `defense-catalog.js:294-303` |
| In-run items | **5** | `defense-catalog.js:139-145` |
| Campaign rewards | **14** | `defense-catalog.js:146-161` |
| Warden stats | **6** | `rpg-catalog.js:30-37` |
| Warden skill-tree nodes | **5** | `rpg-catalog.js:47-53` |
| Warden traits | **8** (pool); max **5** selectable/campaign | `rpg-catalog.js:58-67`,`:57` |
| Companion roles | **3** | `rpg-catalog.js:87-91` |
| Formation stances | **3** | `rpg-catalog.js:118` |
| Equipment tiers × slots | **5 tiers × 3 slots** | `rpg-catalog.js:176-184` |
| Stage-world profiles | **10** (mandatory 2 obstacles + 1 ramp + 1 platform each) | `stage-world-catalog.js:66-400`,`:461-464` |
| Editorial showcases | **3** | `stage-world-catalog.js:511-517` |

---

## 8. Stage / world variety (`stage-world-catalog.js`)

- **What it adds to gameplay:** per-stage walkable `bounds`, `obstacles` (circular footprints the sim pushes actors out of / blocks line-of-fire against), and elevation `surfaces` (exactly one `ramp` + one `platform` per stage). These feed the terrain functions `terrainElevationAt / clampToWorld / insideObstacle / pushOutsideObstacle / moveOnTerrain / firstObstacleHit` in the sim — real collision + elevation. — `stage-world-catalog.js:16-41`,`:72-82`,`:461-464`; sim `:44-219`, imported `:16`.
- **Presentation-only (no sim effect):** `terrainGlbPath`, `palette`, `atmosphere` (fog), `landmarks`, `props`, `npcs` (lookouts), and the `editorial` showcase text. Validated but never read by simulation. — `stage-world-catalog.js:83-98`,`:466-499`.
- **Per-stage tactical modifiers live in `defense-catalog.js` `STAGE_TACTICS` (not the world catalog):** each stage authors a `chokepath` (0.85× enemy slowdown band), a `hazard` zone (`damagePerSecond` 8→18, escalating by stage), an `occupation` point (hold N ticks → recovery buff + opens extraction window), an `extraction` point (timed window, fail = defeat), `elevation` (range multiplier), `flank`, and `spawnDirections`+`seededVariation`. All consumed by the sim's `processTerrainEffects`. — `defense-catalog.js:356-457`; sim `:1657-1800`, `:1412` (choke).
- **Wave-composition variety is thin:** only **3 stages** (`veil-citadel`, `echo-throne`, `sunken-bastion`) have `STAGE_WAVE_VARIANTS` (per-slot alt compositions); `cinder-span` has its own authored `CINDER_SPAN_WAVE_PLAN`; **stages 5–10 have no composition variants** (only timing/density/lane jitter). — `defense-catalog.js:459-511`,`:326-354`; sim `:265-339`.

---

## Dead / stub / no-op content (catalog data with no runtime consumer)

1. **`POWER_GOVERNANCE`** (rpg-catalog.js:333-344) — R1/R3/R5 power ceilings. **Never enforced.** Only consumer is `tests/rpg-catalog.test.mjs:301-306`; the doc comment says the enforcement site is "explicitly deferred to Stage 2." Pure spec placeholder in shipped code.
2. **`ARCHIVE_RETURN`** (defense-catalog.js:185-192) — an old idle/return spec (`creditsPerHour`, `maxCredits`, `commerce:false`). **Zero consumers repo-wide** (grep confirms only the definition). Superseded by `settleIdleReturn` in campaign-state.js; dead constant.
3. **Idle `totalProgress`** (campaign-state.js:248) — accrues but is **never spent/consumed**; only rendered as a vanity "누적" counter (`app.js:310-315`). The entire idle economy has no sink.
4. **M4 "card" decision system** (sim:1128-1196, `M4_CARD_DECISION` input) — full state machine (AVAILABLE→RECOVERY_PENDING→RECOVERED/FALLBACK) + events, but **no player UI** in `app.js` (no `M4_CARD_DECISION` sender, no `renderM4`) and **no combat effect** — nothing reads `m4.status`/`selectedCardId` to alter damage, gate, or spawns. Telemetry/replay scaffolding only.
5. **`BOSS_RALLY_COOLDOWN_REDUCTION = 0`** (rpg-catalog.js:110) — the boss-rally window fires an event but the value is **0**, so the advertised companion-cooldown benefit is a **no-op** (`sim:562-565`). Observable event, zero mechanical payload (documented as intentional "Stage 2d value is zero").
6. **Companion `evolution`** (campaign-state.js:291-297) — incremented on repeat captures and displayed ("진화 N", app.js:602), but **no runtime-stat function consumes it** (`deriveCompanionRuntimeStats` ignores it) → cosmetic only.
7. **Reward-legacy companions `pack-warden` / `lantern-reaver` / `requiem-warden`** — added to a *run* via `applyOwnedRewards→addCompanion` when the reward is owned, but they are **never elite-capturable** (`captureElite` only ever gets `stage.eliteCompanion`, and no stage maps to them), so they can **never enter `companionCollection`** and thus can never be placed in a persistent loadout/formation. Partial companions: they fight in the reward-run but aren't real collectibles. — catalog `:158-160`,`:521-530`; sim `:452-457`,`:426-450`; campaign `:285-300`.
8. **`STAGE_PRESENTATION_BY_ID`** (defense-catalog.js:537-608) and stage-world `presentation`/`editorial` blocks — display vocabulary only; explicitly "never participate in stage resolution or simulation" (doc `:534-536`).
9. **Lore surprise table** (`CINDER_SPAN_SURPRISE_TABLE`, catalog:317-324; `loreSurprise`, sim:2032-2046,2234) — 25% chance to emit one of two flavor-text lines; **no gameplay effect** (lore-only event).

**TODO/FIXME/stub markers in gameplay code:** none found. `grep` for `TODO|FIXME|XXX|stub|unimplemented|placeholder` across the six gameplay files returned only the `POWER_GOVERNANCE` "deferred to Stage 2" doc comment (#1 above) and the `STAGE_WAVE_VARIANTS` "stages 5-10 have no variants yet" comment (§8). No literal `TODO`/stub tokens.

---

## Cross-cutting notes for the gap analysis

- **Single-player only.** No PvP, guild, leaderboard, gacha, or live-service hooks anywhere in these files.
- **Finite content ceiling.** 10 stages, 40 Echo Core / 10 Bound Fragment total budget, max Warden level 9/run, 5 traits/campaign, 6 real persistent companions. The whole progression is sized to complete once; no prestige/NG+/endless mode in code.
- **Idle layer is skeletal:** accrues an unspendable counter and can be zeroed by encroachment; no offline combat, no resource generation the player can reinvest.
- **Roguelite depth is a single axis:** the 8-skill in-run draft (3 offered/level). No item synergies, evolutions, or randomized modifiers beyond wave jitter.
- **Deterministic sim is a strength:** everything is seed-reproducible (`getRunDigest`), which is unusual and useful for a survivor game, but currently serves QA/replay more than player-facing features.
