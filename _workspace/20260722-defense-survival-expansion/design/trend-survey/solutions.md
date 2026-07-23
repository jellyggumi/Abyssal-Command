# Solution synthesis — familiar survivor grammar, distinct command extraction

## Solution List

| solution | evidence basis | design decision | strength | weakness / gate |
|---|---|---|---|---|
| Movement-led automated defense | Vampire Survivors, Brotato and Death Must Die disclose movement/auto-combat or auto-aim patterns | keep automatic basic attacks; spend input budget on positioning, active skill, Domain occupation and Bind | accessible on touch and readable at speed | becomes passive if enemy policies only walk to Gate |
| Short combat→choice cadence | Brotato discloses 20–90-second waves; four action roguelites disclose run build choices | tune one stage loop around 90 s, accept 30–180 s only with ≥3 action classes and ≥1 reward | measurable G7 rhythm | current and current-head balance receipts do not establish this complete loop |
| Defense geometry with direct avatar control | Arknights validates goal/lane defense, while survivor titles validate direct movement | give all ten stages a primary choke, flank, elevation, hazard and two Domain points | creates distinct stage positioning without operator-deployment imitation | requires catalog, simulation, pathing and renderer work |
| Numeric build layers | survivor/roguelike comparables repeatedly expose weapons, items, powers and persistence | separate run item, 3-choice skill, derived stat, synergy, companion, stage reward and Archive growth; show current → upgraded | prevents generic “upgrade” ambiguity | combo EV and comprehension remain unmeasured |
| Echo-command extraction | strict four-part pattern appears in 0/5 inspected disclosures | make elite defeat→10 s candidate→spatial Domain Bind→run ally→permanent local collection one trace | source-supported differentiation candidate | not novel until implemented and rated ≥4/5 by five people |
| Seeded threat grammar | comparable loops rely on escalating wave/encounter structure; active contract requires reproducibility | resolve scout→pressure→flank→ranged→elite→boss from one simulation-owned seed | repeatable tuning with varied pressure | must never move RNG into presentation or allow mandatory phases to disappear |

## Categories

### Familiar foundation

- Eight-way movement on keyboard/pointer/touch.
- Automatic basic attacks with explicit active-skill decisions.
- Collectible combat resources and three-choice run growth.
- Compact full-field threat readability.
- Persistent local unlocks after a run/stage.

These patterns reduce onboarding cost. They are not marketed as novelty.

### Abyssal Command differentiation

- Gate and Warden survival pressure in the same direct-control run.
- Stage-authored chokepaths, flanks, elevation and deterministic hazards.
- Domain occupation that changes movement/range/recovery and can be contested.
- One mandatory elite milestone whose hostile memory is spatially extracted into a permanent named companion.
- Policy-visible enemies that choose Gate pressure, Warden pursuit/attack, flank, resource denial, elite escort or low-HP focus.

### Measurement infrastructure

- Seed/tick-stable event traces.
- Five archetypes: Gatekeeper, Hunter, Collector, Skirmisher and Generalist.
- HP, damage, speed, density, spawn direction, policy, boss spawn/death ticks and reward values.
- Win 45–55%, boss TTK ±15%, combo EV ≤1.30× median, ≥3 viable archetypes.

## What People Actually Use

The bounded evidence shows products repeatedly combining a low-friction combat grammar with high-frequency build decisions:

- Vampire Survivors sells survival snowball through movement, automatic weapons and pickups/upgrades.
- Brotato exposes the clearest short-wave benchmark: default auto-fire, 20–90-second waves, materials and weapon/item construction.
- Arknights makes lane/goal pressure and persistent specialist units legible on a bounded map.
- Hades keeps manual action density high but still punctuates encounters with power choices and between-attempt progression.
- Death Must Die combines survivor pressure with blessings, items, heroes and explicit synergies.

The practical common layer is **movement/combat → visible reward choice → stronger next encounter**, plus some persistent reason to return. Abyssal Command should reuse that grammar and spend novelty on the spatial extraction conversion, not on renaming ordinary loot.

## Frequency Ranking

Coding uses only the five-title disclosure set in `context.md`.

| rank | disclosed pattern | observed titles | measured frequency |
|---:|---|---|---:|
| 1 | persistent roster/stat/unlock progression | all five in the bounded coding | 5/5 |
| 2 | run build choices via weapons/items/powers | Vampire Survivors, Brotato, Hades, Death Must Die | 4/5 |
| 3 | movement-led automated/auto-aim combat support | Vampire Survivors, Brotato, Death Must Die | 3/5 |
| 4 | bounded lane/goal defense with persistent units | Arknights | 1/5 |
| 5 | strict elite-memory extraction into named permanent ally | none in inspected disclosures | **0/5** |

The strict hook frequency threshold is `≤2/5`; the measured disclosure frequency is `0/5`. This supports only the frequency limb. Human impression is absent, so G8 remains FIX.

## Target Data/Behavior Contract

`defense-catalog.js` remains the only authored-values authority. The current R2 values below are signed as **candidate bounds pending correctness restoration, retune and evidence—not PASS**.

### Ten-stage tactic schema and candidate bounds

Every `STAGE_TACTICS[stageId]` currently declares one `chokepath`, `flank`, `elevation`, `hazard`, `occupation`, `extraction`, `spawnDirections` set and `seededVariation` record. Across ten stages:

| field | current authored range / contract | public-beat condition |
|---|---|---|
| elevation range multiplier | ×1.08–1.15 | resolved by simulation and shown by renderer |
| hazard damage | 8–18 integrity/s | affects Warden/enemies deterministically; telegraphed before contact |
| occupation radius | 750–950 units | one readable W-04 point per stage |
| occupation hold | 180–360 ticks / 3–6 s | spatial consecutive hold; progress/event visible |
| occupation movement | ×1.04–1.08 | current → upgraded value visible |
| occupation range | ×1.06–1.12 | current → upgraded value visible |
| occupation recovery | +4–12 integrity/s | Warden/Gate recovery, not XP pickup; current → upgraded value visible |
| extraction radius | 850–1000 units | separate readable W-02 point per stage |
| extraction candidate window | 600 ticks / 10 s | starts on elite defeat/candidate creation |
| spatial Bind hold | 120 ticks / 2 s in current simulation | must complete inside candidate-relative window |
| seed jitter | timing ±12–30 ticks; density ±1; lane ±300–720 units | sampled only in simulation |
| spawn directions | authored subsets of W/NW/SW | emitted in snapshots/telemetry |

Current occupation capture persists after the authored hold and is intended to apply movement/range/recovery. QA observed occupation `214/180` and showed that `Math.max(1, trunc(recoveryPerSecond / 60))` turns every authored +4–12/s value into +60/s, so the recovery bounds are not faithfully implemented. Resource-denial enemies must contest occupation/Bind progress without deleting an Echo/item; that contest behavior is also open. The simulation creates an elite candidate with `expiresAt = defeatedAt + windowTicks`, but its separate spatial objective currently allows progress at tick 157 before any candidate and checks stage-relative `run.tick <= windowTicks`; legacy `EXTRACT_ELITE` can also complete remotely. Replace both bypasses with candidate availability/expiry plus the spatial hold, and emit the canonical companion-add/persistence chain exactly once.

### Wave and seed contract

The public beat requires `scout → pressure → flank → ranged → elite → boss` in that order. Current stages author three wave rows, map them to the first three `wavePattern` labels, spawn the elite at half `gateTicks`, and spawn the boss after `gateTicks` once non-elites clear. Therefore six labels exist, but a complete six-phase schedule is not yet proven.

The 90-second G7 table in `../core-loop.md` is the tuning center; any qualifying loop may resolve in 30–180 seconds if it includes ≥3 distinct action classes, ≥1 reward and the mandatory elite/growth/extraction opportunity. Extending duration with idle time does not qualify.

`app.js` FNV-1a-hashes campaign ID, reset epoch, stage ID and attempt into a nonzero run seed. The simulation's xorshift32 schedule varies timing, density, direction, lane and policy deterministically. Same seed plus same queued inputs must reproduce wave schedule, actors, policies, objectives, rewards and terminal events. Presentation never samples randomness.

### Enemy policy behavior

The current simulation now authors and selects all six policy IDs:

- `gate-pressure` routes through the stage chokepath toward the Gate;
- `player-pursuit` targets and attacks the Warden;
- `flank` follows the authored flank route, then chooses Warden/Gate by proximity;
- `resource-denial` seeks the nearest Echo with stable entity-ID tie-break, then pressures the Warden;
- `elite-escort` follows the elite/boss when present, then falls back to Gate;
- `low-hp-focus` compares Warden and Gate integrity ratios and targets the lower.

Each resolved policy/target, spawn direction, damage and HP change must be observable in telemetry and readable through presentation. Current-head 0/50 wins show that “real pressure exists” is not enough; pressure must be retuned to the G2/G3 viability gates after event ordering is fixed.

### Extraction invariant

Every stage seed schedules exactly one elite. Path choice may alter access, contest and risk but may never suppress elite spawn, item drop, candidate creation or the opportunity to Bind. The canonical trace is:

`elite defeated → item/Echo emitted → candidate available for 600 ticks → Warden holds extraction point 120 ticks before candidate expiry → exactly one ELITE_EXTRACTED/companion add → local persistent collection record`.

Failure/expiry must be explicit. A separate stage-start extraction timer, renderer timeout, or completion event disconnected from the elite fails the hook.

### Growth and balance

Three-choice offers are deterministic for a seed and must label lifetime plus current → upgraded value. Run items, skills, stats, synergies, companions, stage rewards and Archive modifiers remain separate records. Five archetypes—Gatekeeper, Hunter, Collector, Skirmisher and Generalist—record seed, stage, min Gate/Warden HP, damage, speed, peak density, spawn directions, policy counts, boss spawn/death ticks, reward chain and terminal state. Tune toward 45–55% wins, boss TTK ±15%, combo EV ≤1.30× median, ≥5 tested and ≥3 viable.

## Key Gaps

1. Current-head QA reports 9/23 focused simulation/adapter failures and 0/50 wins across five archetypes × ten stages; restore event/terminal contracts before balance tuning.
2. Spatial extraction can progress pre-elite and `EXTRACT_ELITE` can complete remotely; both break the strict hook.
3. Authored +4–12/s occupation recovery currently quantizes to +60/s, invalidating the signed R2 numeric bounds; occupation also exceeded the sampled hold (`214/180`).
4. Resource-denial contest, six complete wave phases and all policy telegraphs are not proven end to end.
5. Current → upgraded values are not proven across every progression layer.
6. G2 boss-only TTK and combo EV receipts are absent; G7 has no qualifying human repeat sample.
7. G8 has no five-person impression panel or verified canonical spatial extraction trace.

## Contradictions

- Comparables reward low-friction control, but the target adds occupation and active extraction. Resolution: one movement stick plus context-sensitive Bind; no second free camera or unit-placement mode.
- Defense wants stable lanes; survivor play wants roaming recovery. Resolution: primary choke plus flank plus contested Domain makes movement change reach/risk without hiding the Gate.
- Randomized builds create surprise; deterministic simulation requires reproduction. Resolution: seed-owned choice/spawn variation, never renderer RNG.
- Persistent allies are common; hostile-memory extraction is the candidate difference. Resolution: keep defeat, countdown, spatial Bind and permanent conversion contiguous and visible.
- A 90-second target is longer than the current short terminal proxy but still within the 30–180-second gate. Resolution: mandatory phase/reward milestones, not artificial idle time.
- More pressure can create real defeat, but current-head 0/50 is already overtuned/regressed. Resolution: first restore ordering/candidate/reward correctness, then tune catalog values; never declare pressure successful from universal defeat.

## Key Insight

**Familiar movement and growth should make the game learnable; the memorable beat is choosing to leave Gate safety, occupy a contested Domain and recover a defeated elite's command-memory before its ten-second window closes.** The hook fails if roaming can skip the elite, if Bind is only a menu click, if persistence reads as ordinary recruitment, or if added pressure collapses viability. Source frequency is favorable at 0/5, but only implementation traces, five-archetype balance and five human impressions can promote the gate.

**Survey verdict: research complete; design/public-beat gate FIX.**
