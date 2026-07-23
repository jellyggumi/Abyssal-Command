# Balance sheet — Stage 1 data mirror and Stage 2 measurement contract

```yaml
system: defense-survivor
rules_version: defense-survivor-v1
tick_rate_hz: 60
data_mirror: defense-catalog.js
win_rate_band: [0.45, 0.55]
ttk_tolerance: 0.15
combo_ev_cap_vs_median: 1.30
archetype_gate: { tested: 5, viable: 3 }
status: catalog_complete_runtime_and_playtest_evidence_pending
```

This sheet mirrors authored catalog data. A row marked **target/unwired** is not a
claim that the simulation consumes it. Stage 2 cannot pass until the current
simulation, five archetypes, boss TTK, and every combo are measured.

## Stage 1 — shipped baseline and current → upgraded values

### Core loop, occupation, harvest, extraction, growth, and progression

| loop beat | catalog source | current value | upgraded / completion value |
|---|---|---:|---:|
| Gate defense | `GATE`, `COMMANDER`, `ARENA` | Gate 1000 integrity at (22000, 6000); commander 900 damage / 24 ticks / 6000 range / 4100 speed | Stage item, Archive reward, skill, companion, and occupation deltas below |
| Echo recovery / harvest | enemy `xp`, commander pickup radius | 12000 pickup radius; enemy XP 8 / 10 / 18 / 12 | `soul-magnet` 13500; `echo-compass` 14500; both 16000 |
| Growth | `XP_GROWTH`, `SKILLS` | level thresholds 30, 55, 85, 120, 160, 205, 255, 310; deterministic 3-choice offer | one unique skill per selection; active skill starts ready; passive applies once |
| Occupation | `STAGE_TACTICS.*.occupation` | no secured point; move 4100, basic/zero-radius range 6000, recovery 0/s | per-stage hold 180–360 ticks grants ×1.04–1.08 move, ×1.06–1.12 range, 4–12 recovery/s (**target/unwired until simulation consumes fields**) |
| Extraction | `STAGE_TACTICS.*.extraction`, stage elite | elite at `gateTicks / 2`; 4× scaled base HP; no companion before bind | enter the authored extraction point and complete within `windowTicks: 600` (10 s) to add the stage `eliteCompanion` (**point requirement target/unwired**) |
| Boss kill | `BOSSES`, stage `scale` | boss spawns after gate time and authored non-elites clear | terminal offers exactly the three `STAGE_REWARD_IDS[stageId]` |
| Stage progression | `STAGES`, `STAGE_ITEM_IDS`, `STAGE_REWARD_IDS` | `cinder-span` unlocked first | ten ordered clears end at `gate-zenith` / `FINAL_COMPLETION`; no next-Gate claim |

**Occupation meaning:** hold intercept space, not a separate territory/capture
game. Terrain and occupation modify the same movement, range, and recovery
decisions used by Gate defense and extraction.

### Commander and run-item mirror

| ID / stat | current | upgraded value | exact delta |
|---|---:|---:|---:|
| `COMMANDER.basicDamage` | 900 | 1080 with `ashen-sigil` | +180 |
| `COMMANDER.basicDamage` | 900 | 1140 with `dawnless-crown-shard` | +240 |
| `COMMANDER.basicCooldown` | 24 ticks (0.4 s) | unchanged by damage items | — |
| `GATE.maxIntegrity` | 1000 | 1080 with `ward-splinter` | +80 max and +80 current |
| `GATE.maxIntegrity` | 1000 | 1120 with `dawnless-crown-shard` | +120 max and +120 current |
| commander pickup radius | 12000 | 14500 with `echo-compass` | +2500 |
| commander cooldown scale | 1.00 | 0.90 with `hourglass-fragment` | −10% cooldown |

Run items are stage-local combat pickups and are not Archive power. Item IDs:
`ashen-sigil`, `ward-splinter`, `echo-compass`,
`hourglass-fragment`, `dawnless-crown-shard`.

### Three-choice skill mirror

| skill ID | role | current → upgraded value | raw EV input |
|---|---|---|---:|
| `rift-bolt` | priority assault | no cast → 1800 damage every 390 ticks (6.5 s) | 276.92 single-target DPS |
| `soul-lance` | fast assault | no cast → 1200 every 270 ticks (4.5 s) | 266.67 single-target DPS |
| `grave-pulse` | area control | no cast → 650 per target in radius 3000 every 240 ticks (4.0 s) | 162.5 DPS × targets hit |
| `void-aegis` | recovery | no cast → +50 commander integrity every 300 ticks (5.0 s) | 10 integrity/s while missing integrity |
| `shadow-step` | mobile area assault | no cast → 900 per target in radius 4500 every 210 ticks (3.5 s) | 257.14 DPS × targets hit |
| `eclipse-edge` | basic assault passive | basic 900 → 1080 | +450 basic DPS at 24 ticks |
| `soul-magnet` | harvest passive | pickup 12000 → 13500 | +12.5% pickup radius |
| `ward-binder` | recovery passive | commander max/current integrity 1000 → 1120 | +120 capacity/current |

The active `void-aegis` and passive `ward-binder` affect commander integrity,
not Gate integrity. Their viability therefore depends on hazard/player-pressure
consumption; they must not be reported as Gate healing.

### Extracted companion mirror

| companion ID | damage | fire ticks / seconds | range | raw DPS |
|---|---:|---:|---:|---:|
| `ember-cohort` | 420 | 36 / 0.60 | 4600 | 700.00 |
| `rift-lens` | 540 | 48 / 0.80 | 5200 | 675.00 |
| `veil-vanguard` | 360 | 28 / 0.47 | 4000 | 771.43 |
| `anchor-shard` | 720 | 70 / 1.17 | 5600 | 617.14 |
| `throne-echo` | 480 | 38 / 0.63 | 4800 | 757.89 |
| `dawnless-crown` | 600 | 52 / 0.87 | 6000 | 692.31 |

Companion loadout is deduplicated and capped at three. Extraction adds the
stage prototype once per run; it does not silently grant every Archive reward.

### Stage reward and Archive mirror

| reward ID | layer | current → upgraded value |
|---|---|---|
| `ember-cohort-legacy` | extracted companion legacy | no starting cohort → `ember-cohort` in the next-run loadout |
| `rift-lens-archive` | Archive record | absent → recorded; no numeric combat delta |
| `stillwater-hourglass` | Archive modifier | cooldown scale 1.00 → 0.80 |
| `bulwark-brand` | Archive modifier | incoming Gate damage $d$ → $\max(0,d-2)$ |
| `veil-vanguard-legacy` | extracted companion legacy | no starting vanguard → `veil-vanguard` in the next-run loadout |
| `anchor-shard-archive` | Archive modifier | Gate 1000 → 1040 max/current |
| `abyssal-banner` | Archive modifier | each starting and later extracted companion damage $d$ → $d+60$ |
| `throne-echo-record` | Archive record | absent → recorded; no numeric combat delta |
| `dawnless-crown` | Archive record | absent → recorded; no numeric combat delta |

There is no commerce, account, network, paid branch, reroll purchase, or paid
power delta. Current structural paid/free win-rate delta is 0 percentage points.
The fairness targets remain ≤5 pp and free tactical parity within 10–20 sessions.

## Four build axes and measurable synergy inputs

| axis | skill / item / companion / reward examples | measurable trade-off | data readiness |
|---|---|---|---|
| Priority assault | `rift-bolt`, `soul-lance`, `eclipse-edge`; `ashen-sigil`; `ember-cohort`; `stillwater-hourglass` | highest single-target DPS; gives up pickup radius, Gate capacity, and broad target count | complete |
| Area control | `grave-pulse`, `shadow-step`; elevated occupation range; `veil-vanguard` | EV scales with measured targets hit; weaker raw boss DPS at one target | complete; occupation consumption pending |
| Harvest growth | `soul-magnet`; `echo-compass`; fast/central occupation route; `rift-lens` | 12000 → 13500 → 14500 → 16000 pickup radius accelerates threshold timing but adds no direct commander damage | complete; Echo/occupation telemetry pending |
| Recovery command | `void-aegis`, `ward-binder`; `ward-splinter`; `anchor-shard-archive`, `bulwark-brand`; recovery occupation | commander recovery/capacity and Gate capacity/damage reduction trade boss speed for survival | complete; hazard/player-pressure consumption pending |

### Combo EV calculation contract

All cooldowns use 60 Hz ticks:

$$
\mathrm{DPS}_{single}=\frac{\mathrm{damage}\times60}{\mathrm{cooldownTicks}},
\qquad
\mathrm{DPS}_{area}=\mathrm{DPS}_{single}\times\mathrm{targetsHit}.
$$

Basic DPS is $900\times60/24=2250$. `ashen-sigil` and `eclipse-edge`
each add $180\times60/24=450$ DPS. `stillwater-hourglass` changes an
active cooldown to $0.8c$; `hourglass-fragment` changes it to $0.9c$;
together they produce $0.7c$ because the simulation subtracts reductions.

| combo sample | current → combo | measurable EV input |
|---|---|---:|
| `rift-bolt` + `eclipse-edge` + `ashen-sigil` | 2250 base → 3150 basic plus 276.92 skill | 3426.92 single-target DPS |
| `rift-bolt` + `stillwater-hourglass` | 276.92 → 346.15 skill DPS | +69.23 DPS |
| `rift-bolt` + hourglass + fragment | 276.92 → 395.60 skill DPS | +118.68 DPS |
| `grave-pulse` + elevated occupation | radius 3000 and 162.5 DPS/target → range multiplier 1.08–1.12 | targets hit must be counted; no invented flat EV |
| `soul-magnet` + `echo-compass` | 12000 → 16000 pickup radius | measure ticks to each XP threshold |
| `ward-binder` + `void-aegis` | 1000 → 1120 commander capacity, +50/5 s | 10 recovery/s while damaged |
| `ward-splinter` + `anchor-shard-archive` | Gate 1000 → 1120 max/current | +120 Gate capacity |
| companion + `abyssal-banner` | damage $d$ → $d+60$ | DPS uplift = $60\times60/\mathrm{fireTicks}$ |

The R3 raw active-pair proxy uses unnormalized
`effect / cooldownTicks` for direct damage only. It intentionally does not
inflate `grave-pulse` or `shadow-step` for target count and prices
`void-aegis` recovery at zero in this narrow denominator:

| active pair | raw pair EV |
|---|---:|
| `grave-pulse` + `void-aegis` | 2.7083333333 |
| `void-aegis` + `shadow-step` | 4.2857142857 |
| `soul-lance` + `void-aegis` | 4.4444444444 |
| `rift-bolt` + `void-aegis` | 4.6153846154 |
| `grave-pulse` + `shadow-step` | 6.9940476190 |
| `soul-lance` + `grave-pulse` | 7.1527777778 |
| `rift-bolt` + `grave-pulse` | 7.3237179487 |
| `soul-lance` + `shadow-step` | 8.7301587302 |
| `rift-bolt` + `shadow-step` | 8.9010989011 |
| `rift-bolt` + `soul-lance` | 9.0598290598 |

The median is 7.0734126984, so the maximum pair is
1.2808285683× median and the raw-pair proxy is within 1.30×. This is not a
full combo-EV or G2 PASS: encounter EV must separately normalize observed
targets hit, casts, prevented damage/integrity, item and companion effects,
occupation value, and boss TTK under identical seeds.

The source-unchanged public-API measurement froze 200 accepted inputs before
EV inspection: every unordered pair × all 10 stages × the frozen Hunter65 and
Generalist controllers, with identical full companion loadout and reward
semantics. Each pair was acquired in 20/20 runs; all 200 deterministic replays
matched.

| active pair | normalized eight-axis encounter EV |
|---|---:|
| `grave-pulse` + `rift-bolt` | 0.9827852405 |
| `grave-pulse` + `shadow-step` | 1.0152392994 |
| `grave-pulse` + `soul-lance` | 1.0064052923 |
| `grave-pulse` + `void-aegis` | 1.4007728549 |
| `rift-bolt` + `shadow-step` | 1.0088097581 |
| `rift-bolt` + `soul-lance` | 1.0017112882 |
| `rift-bolt` + `void-aegis` | 1.3842265318 |
| `shadow-step` + `soul-lance` | 1.0256352927 |
| `shadow-step` + `void-aegis` | 1.3798734223 |
| `soul-lance` + `void-aegis` | 1.4368797005 |

The frozen eight-axis median is 1.0204372961 and the maximum is
1.4368797005, so normalized max/median is **1.4081019050×** and fails the
≤1.30× gate. The raw proxy still passes at 1.2808285683×. Exact commands,
source/catalog hashes, accepted seeds, axis medians, observed inputs, and
replays are in `qa/run-all-pair-ev.mjs`, `qa/all-pair-ev-manifest.json`, and
`qa/all-pair-ev-result.json`. G2 therefore remains FIX; the raw proxy cannot
override measured normalized encounter EV.

That 1.4081019050× receipt is the pre-candidate `void-aegis.integrity: 70`
baseline. PM authorized one evidence-gathering R3 candidate:
`void-aegis.integrity: 50`, with cooldown 300, damage/radius, acquisition,
persistence, access, Domain, parity, and zero-commerce terms unchanged.
Using the observed non-Void integrity-axis median 25.8732989891 as the unchanged
terrain/survival baseline and scaling only observed Aegis excess per cast,
$I_p(v)=M+(I_p(70)-M)v/70$, projects the maximum normalized ratio from
1.4081019050× to **1.2716991762×**. This projection is not evidence or G2 PASS;
the manifest, 200-pair replay, five-archetype matrix, and reference TTK must be
regenerated against the candidate catalog hash.

Stage 2 must calculate every tested combo under identical seeds, use the median
completion/action EV as denominator, and require
`max(combo EV) / median(combo EV) <= 1.30`. The formulas above are inputs, not
a substitute for measured encounter EV.

## Stage 1 — enemy and policy data

| enemy ID | HP | damage / `attackTicks` | speed | XP | default `policyId` |
|---|---:|---:|---:|---:|---|
| `rusher` | 3000 | 10 / 60 | 3000 | 8 | `gate-pressure` |
| `flanker` | 3600 | 12 / 60 | 3300 | 10 | `flank` |
| `guardian` | 9000 | 20 / 90 | 1700 | 18 | `elite-escort` |
| `ranged` | 2800 | 20 / 120 | 2000 | 12 | `resource-denial` |

`ranged` additionally uses range 6000 and `projectileTicks: 120`; all bosses
use `attackTicks: 90`. Contact, Gate, and commander attacks must consume this
deterministic per-actor cooldown rather than apply authored damage every tick.
`ENEMY_POLICIES` also defines `player-pursuit` and `low-hp-focus`; bosses use
those defaults where authored. Policy targets are Gate, commander, flank route,
Echo pickup, elite, and lowest-HP friendly respectively. Contextual policy
changes must remain deterministic and visible in simulation snapshots/events.

## Stage 1 — ten-stage terrain, wave, extraction, item, and reward mirror

Every stage declares `wavePattern` =
`scout → pressure → flank → ranged → elite → boss`. Current `waves` counts in
the table are the actual three authored non-elite tuples; the elite is
deterministically scheduled at half the Gate tick and the boss after the Gate
tick plus non-elite clearance. `seededVariation` is authored metadata and must
not be credited until the simulation consumes seed-bound timing, density, and
lane variation.

| # / stage ID | scale; Gate / elite time | waves; encounter density | boss ID; scaled HP | elite ID / kind / scaled HP → companion | terrain / objective IDs and effects | item → three rewards |
|---|---|---|---|---|---|---|
| 1 `cinder-span` | 100%; 12 s / 6 s | 0s `rusher`×4; 3s `flanker`×3; 6.5s `ranged`×2; 11 incl. elite+boss | `s1-cinder-warden`; 40000 | `s1-ember-hunter` / rusher / 12000 → `ember-cohort` | choke `cinder-center`; flank `cinder-south`; elevation `cinder-overlook` ×1.08; hazard `ash-surge` 8/s; occupy `cinder-seal` 180 ticks, ×1.05 move/×1.08 range/+4/s; extract `cinder-bind` 600 ticks; W/SW | `ashen-sigil` → `ember-cohort-legacy`, `stillwater-hourglass`, `bulwark-brand` |
| 2 `veil-citadel` | 115%; 13 s / 6.5 s | 0s rusher×5; 3s flanker×4; 7s ranged×3; 14 total | `s2-veil-tactician`; 55200 | `s2-veil-sentinel` / flanker / 16560 → `rift-lens` | `veil-twins`; `veil-north`; `veil-rampart` ×1.12; `mirror-static` 9/s; `veil-signal` 210 ticks, ×1.04/×1.10/+5/s; `veil-bind`; W/NW | `ward-splinter` → `rift-lens-archive`, `anchor-shard-archive`, `abyssal-banner` |
| 3 `echo-throne` | 130%; 14 s / 7 s | 0s flanker×5; 3.5s ranged×3; 8s guardian×2; 12 total | `s3-gate-sovereign`; 78000 | `s3-throne-wraith` / ranged / 14560 → `throne-echo` | `throne-aisle`; `throne-south`; `throne-dais` ×1.10; `echo-rift` 10/s; `throne-domain` 240 ticks, ×1.06/×1.08/+6/s; `throne-bind`; W/SW/NW | `echo-compass` → `throne-echo-record`, `veil-vanguard-legacy`, `stillwater-hourglass` |
| 4 `sunken-bastion` | 145%; 15 s / 7.5 s | 0s rusher×6; 3.67s ranged×4; 8.5s guardian×2; 14 total | `s4-tide-warden`; 98600 | `s4-anchor-diver` / guardian / 52200 → `anchor-shard` | `bastion-floodgate`; `bastion-channel`; `bastion-anchor` ×1.10; `flood-pulse` 11/s; `bastion-pump` 240 ticks, ×1.05/×1.08/+7/s; `bastion-bind`; W/SW | `hourglass-fragment` → `anchor-shard-archive`, `bulwark-brand`, `abyssal-banner` |
| 5 `howling-sprawl` | 160%; 16 s / 8 s | 0s flanker×6; 4s ranged×4; 9s guardian×3; 15 total | `s5-pack-herald`; 121600 | `s5-pack-sentinel` / guardian / 57600 → `veil-vanguard` | `sprawl-funnel`; `sprawl-crosswind`; `sprawl-ridge` ×1.09; `howling-gust` 10/s; `sprawl-beacon` 270 ticks, ×1.08/×1.06/+6/s; `sprawl-bind`; W/NW/SW | `ashen-sigil` → `veil-vanguard-legacy`, `ember-cohort-legacy`, `rift-lens-archive` |
| 6 `glass-necropolis` | 175%; 17 s / 8.5 s | 0s rusher×7; 4.33s ranged×5; 9.5s guardian×3; 17 total | `s6-requiem-choir`; 147000 | `s6-choir-adept` / ranged / 19600 → `throne-echo` | `glass-crypt`; `glass-reflection`; `glass-spire` ×1.14; `glass-shardfall` 13/s; `glass-choir` 270 ticks, ×1.04/×1.12/+7/s; `glass-bind`; W/NW | `ward-splinter` → `rift-lens-archive`, `stillwater-hourglass`, `anchor-shard-archive` |
| 7 `starless-canal` | 190%; 18 s / 9 s | 0s flanker×7; 4.5s ranged×5; 10s guardian×4; 18 total | `s7-lantern-tyrant`; 174800 | `s7-toll-keeper` / ranged / 21280 → `anchor-shard` | `canal-lock`; `canal-sluice`; `canal-towpath` ×1.10; `canal-undertow` 12/s; `canal-toll` 300 ticks, ×1.07/×1.08/+8/s; `canal-bind`; W/SW/NW | `echo-compass` → `abyssal-banner`, `bulwark-brand`, `throne-echo-record` |
| 8 `shattered-causeway` | 205%; 19 s / 9.5 s | 0s rusher×8; 4.67s ranged×6; 10.5s guardian×4; 20 total | `s8-bridge-colossus`; 205000 | `s8-keystone-warden` / guardian / 73800 → `ember-cohort` | `causeway-gap`; `causeway-rubble`; `causeway-keystone` ×1.12; `causeway-collapse` 15/s; `causeway-brace` 300 ticks, ×1.05/×1.10/+9/s; `causeway-bind`; W/NW | `hourglass-fragment` → `ember-cohort-legacy`, `veil-vanguard-legacy`, `abyssal-banner` |
| 9 `abyss-chancel` | 220%; 20 s / 10 s | 0s flanker×8; 5s ranged×6; 11s guardian×5; 21 total | `s9-veiled-concordat`; 242000 | `s9-oathbound-signatory` / guardian / 79200 → `dawnless-crown` | `chancel-nave`; `chancel-transept`; `chancel-apse` ×1.13; `oath-pressure` 16/s; `chancel-oath` 330 ticks, ×1.05/×1.11/+10/s; `chancel-bind`; W/SW/NW | `ashen-sigil` → `dawnless-crown`, `throne-echo-record`, `bulwark-brand` |
| 10 `gate-zenith` | 240%; 21 s / 10.5 s | 0s rusher×9; 5s ranged×7; 11.5s guardian×5; 23 total | `s10-abyss-regent`; 360000 | `s10-regent-herald` / flanker / 34560 → `dawnless-crown` | `zenith-threshold`; `zenith-umbra`; `zenith-crown` ×1.15; `deep-command` 18/s; `zenith-last-seal` 360 ticks, ×1.06/×1.12/+12/s; `zenith-bind`; W/NW/SW | `dawnless-crown-shard` → `dawnless-crown`, `throne-echo-record`, `rift-lens-archive` |

### Frozen pre-measurement boss TTK targets

These targets are pacing-derived before final QA inspects measured boss TTK.
They are not fitted to run results. For stage $s$:

$$
D_s=2250+B_s+\frac{257.142857}{q_s}+C_s,\qquad
T_s=\operatorname{round}\left(\frac{HP_s}{D_s}\times60\right).
$$

- 2250 is the authored commander basic DPS
  ($900\times60/24$).
- 257.142857 is the median single-boss contribution of one acquired R3 active
  ($900\times60/210$). $q_s=0.9$ only for the stages whose authored item is
  `hourglass-fragment`; otherwise $q_s=1$.
- $B_s$ is the authored same-run basic-attack item contribution: +450 DPS for
  `ashen-sigil`, +600 for `dawnless-crown-shard`, and zero otherwise.
- $C_s$ is the expected extracted loadout DPS after the mandatory Bind:
  `ember-cohort` = 700; then +`rift-lens` = 675; then
  +`throne-echo` = 757.89. From Stage 5, the three-slot reference replaces
  `rift-lens` with `veil-vanguard` = 771.43. It excludes optional
  `abyssal-banner` and other reward bonuses, so reward choice cannot move the
  frozen target.
- The acceptable band is
  $[\operatorname{round}(0.85T_s),\operatorname{round}(1.15T_s)]$.
  Projected loop time adds authored Gate time, occupation hold, the 120-tick
  Bind, and a fixed 3 s Echo/growth/transition allowance to target boss time.
  The resulting 30.94–99.46 s range is inside the signed 30–180 s loop budget.

| # / stage ID | authored scaled boss HP | expected reference DPS | target TTK ticks / seconds | frozen ±15% tick band | projected loop seconds |
|---|---:|---:|---:|---:|---:|
| 1 `cinder-span` | 40000 | 3657.14 | 656 / 10.94 | 558–754 | 30.94 |
| 2 `veil-citadel` | 55200 | 3882.14 | 853 / 14.22 | 725–981 | 35.72 |
| 3 `echo-throne` | 78000 | 4640.04 | 1009 / 16.81 | 858–1160 | 39.81 |
| 4 `sunken-bastion` | 98600 | 4668.61 | 1267 / 21.12 | 1077–1457 | 45.12 |
| 5 `howling-sprawl` | 121600 | 5186.47 | 1407 / 23.45 | 1196–1618 | 48.95 |
| 6 `glass-necropolis` | 147000 | 4736.47 | 1862 / 31.04 | 1583–2141 | 57.54 |
| 7 `starless-canal` | 174800 | 4736.47 | 2214 / 36.91 | 1882–2546 | 64.91 |
| 8 `shattered-causeway` | 205000 | 4765.04 | 2581 / 43.02 | 2194–2968 | 72.02 |
| 9 `abyss-chancel` | 242000 | 5186.47 | 2800 / 46.66 | 2380–3220 | 77.16 |
| 10 `gate-zenith` | 360000 | 5336.47 | 4048 / 67.46 | 3441–4655 | 99.46 |

Final QA must grade boss spawn-to-defeat ticks against this table without
changing the reference loadout after seeing results. Runs that never spawn or
defeat a boss are missing TTK samples, not in-band observations.

Per-stage variation inputs progress from 12 to 30 timing-jitter ticks, density
delta 1, and 300 to 720 lane-jitter units. The run seed must be the only source
of variation; presentation never chooses a wave, policy, route, or result.

## Stage 1 — presentation-data coverage

| catalog | coverage |
|---|---|
| `CUTSCENES` | explicit intro/elite/victory/defeat copy for all 10 stage IDs plus `default`; `gate-zenith.victory` ends the tenth containment line and does not claim another Gate |
| `ANIMATION_CLIPS.commander` | `idle`, `walk`, `strike`, `cast`, `damage`, `low-hp` |
| `ANIMATION_CLIPS.enemy` | `idle`, `advance`, `strike`, `defeat`, `flank`, `escort` |
| `ANIMATION_CLIPS.effects` | `extract`, `extraction-ready`, `item`, `skill`, `reward`, `occupation`, `echo-recovery`, `boss-defeat` |
| `AUDIO_CUES` emitted baseline | `stage-start`, `enemy-defeated`, `elite-extracted`, `item-collected`, `growth-offer`, `skill-cast`, `boss-spawned`, `terminal` |
| `AUDIO_CUES` authored observers | `movement-step`, `weapon-fire`, `impact-hit`, `extraction-ready`, `occupation-captured`; event wiring must be proven separately |

All clips and cues are optional observers. Missing generated media must fall
back to state text and may not block or mutate the deterministic run.

## Stage 2 — measurement table

### Required five-archetype rotation

| archetype | committed axis | required measurements | viable when |
|---|---|---|---|
| assault | priority assault | win rate, boss TTK, basic/skill DPS, low-HP focus exposure | win 45–55%, each boss TTK within ±15% target |
| controller | area control | targets/cast, lane density, flank leaks, hazard time | win 45–55%, no combo >1.30× median |
| collector | harvest growth | Echo recovered, thresholds reached, pickup travel, item timing | win 45–55%, growth advantage has a direct-damage trade-off |
| defender | recovery command | Gate/commander damage, recovery, occupation hold, breaches | win 45–55%, cannot become indefinite immunity |
| commander | extracted companions | extract success, companion DPS share, escort/policy response | win 45–55%, ≤3 companions and no dominant legacy |

At least five are tested and at least three must be viable. “Viable” means the
full band, not merely one deterministic victory.

### Encounter and combo evidence ledger

| metric | target | current evidence / next proof |
|---|---:|---|
| win rate | 45–55% | not measured for the new terrain/policy schema; run ≥200 fixed-seed simulations per archetype |
| boss TTK | per-stage target ±15% | catalog scaled HP is 40000 → 360000; capture actual boss-spawn and boss-death ticks before setting targets |
| enemy HP / damage / speed | no untracked override | exact base/scaled values above; log effective policy and contextual modifiers |
| density / spawn direction | no unseen spawn | authored density 11 → 23 including elite+boss and directions above; measure seeded min/median/max after wiring |
| occupation | meaningful but not mandatory | log hold ticks, movement/range current→upgraded, recovery, abandon rate, and outcome delta |
| extraction | 10 s authored window | log candidate, arrival, success/expiry, companion ID, and outcome delta |
| growth | deterministic unique 3-choice offer | log offer IDs, chosen ID, current→upgraded value, XP threshold, and choice time |
| combo EV | ≤1.30× median | all 10 pairs acquired 20/20 with 200/200 replay matches; raw 1.2808285683× PASS, normalized eight-axis 1.4081019050× FAIL |
| paid/free delta | ≤5 pp | structural 0 pp; no commerce path |
| comeback / Domain | ≤30% reversal and ≤1 activation/run | Domain is absent from this catalog/runtime; do not claim a measured comeback mechanic |
| repeat loop | ≥70%, 30–180 s, ≥3 actions, ≥1 reward | human sessions pending |

### Current deterministic smoke evidence

`node --check defense-catalog.js` passes. The import path exercised by
`node scripts/run-defense-balance-sim.mjs --strict` also loads all 10 stages,
10 tactics rows, and six policies without a catalog exception.

The earlier strict-runner 0/30 result and 11/50 integration matrix are
superseded regression history, not current balance evidence.

On the frozen 150-tick Echo-grace source and the pre-result controller contract,
the exact seed-17 five-archetype matrix measured **27 victories / 50 runs
(54%)** with zero unresolved: Gatekeeper 6/10, Hunter 5/10, Collector 5/10,
Skirmisher 6/10, and Generalist 5/10. Hunter, Collector, and Generalist are
inside the discrete 45–55% per-archetype band, so the automated G3 count is
3/5. The source handoff passed syntax and the focused simulation+expansion
contract 32/32, including no-input defeat and ordered S1 objectives.

This does not close G2: the measured normalized pair EV is 1.4081019050×
median, and the dedicated reference-loadout boss-TTK probe remains pending.
Human repeat, comprehension, and immersion evidence also remain pending.

The provisional 2026-07-20 action-count pacing (16.5–21.1 actions/stage,
165–211 s point estimates) predates this defense schema. Keep ±15% as the gate,
but replace those targets only after live timing plus current simulation logs.