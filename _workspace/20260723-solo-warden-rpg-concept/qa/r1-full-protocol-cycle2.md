# R1 Full-Protocol Measurement — Cycle 2

Closes: `production/gate-reviews/stage2-review.md` — "R1: PENDING full-protocol
measurement — isolated stress-test shows a real effect but not the literal
all-10-stages/realistic-loadout protocol."

run-id: `20260723-solo-warden-rpg-concept` · measured by: R1GovernanceProtocol (QA sub-agent, this cycle)

## What this replaces

Cycle 1's R1 entry (`qa/gate-measurements.md#r1-r3-r5-total-permanent-power-governance`)
measured R1 via an isolated, zero-companion `gate-zenith` stress-test — a build
nobody would actually play, since companions are free. That measured a real
effect (0/5→3/5 seed win-rate shift) but not the spec's literal protocol:
"stat-only contribution across all 10 stages with realistic loadouts"
(`design/UNIFIED-GDD.md` §9.1 `r1_warden_capacity_ceiling`).

This cycle's `qa/evidence-cycle2/sweep-*.json` (7 archetypes × 3 seeds ×
10 stages, real-simulation-driven, from D15's re-run) supplies exactly that:
each stage result carries the archetype's actual recorded `statPoints`,
`traitIds`, `loadout`, and `wardLevel` at that point in a real campaign. This
report computes the R1 ratio directly from that data for all 210
archetype/seed/stage combinations.

## Method

For each of the 210 `(archetype, seed, stage)` combinations in
`qa/evidence-cycle2/sweep-*.json`:

1. **Warden's own raw-stat contribution.** Call
   `deriveWardenRuntimeStats({statPoints: <stage.statPoints>, skillTreeIds: [],
   traitIds: <stage.traitIds>, equipment: {}})` (`rpg-catalog.js:145-236`) using
   the stage's actual recorded `statPoints`/`traitIds`. `skillTreeIds: []` because
   the sweep JSON doesn't record skill-tree picks (Track A skill tree is a
   separate, unused-by-the-archetype-policy allocation this cycle — confirmed
   absent from every `stageResults[]` entry across all 7 files).
2. **Companion contribution.** For each `companionId` in that stage's `loadout`,
   call `deriveCompanionRuntimeStats(companionId, {equipment: {}})`
   (`rpg-catalog.js:242-260`) and read its `damageBonus`/`eliteDamageBonus`.
3. **Ratio.** Warden's contribution as a percentage of (Warden + Σcompanions).

### Unit-normalization disclosure (methodology decision, stated up front)

`basicDamageBonus` (Warden's field) is a **flat additive damage-point value**
(15/stat-point, `WARDEN_STATS["binding-might"]`, capped at 150 for 10 points).
`damageBonus`/`eliteDamageBonus` (companion fields) are **fractional
multipliers** (striker role: +0.20 normal / +0.30 elite; vanguard/support: 0).
These are not directly summable — a literal `basicDamageBonus /
(basicDamageBonus + Σcompanion.damageBonus)` sum was computed as a check and
produces a degenerate 0%–99.8% range dominated entirely by whichever raw
number is larger by coincidence of units, not game balance (e.g.
`single-companion-main`/`gate-zenith` literal-sum ratio = 99.81%, because 105
raw damage points dwarfs a 0.2 fraction — this is a units artifact, not a
balance finding, and is discarded).

**Normalization used for the reported ratio**: Warden's flat bonus is
converted to the same fractional-multiplier space companions are already in,
using `COMMANDER.basicDamage = 900` (`defense-catalog.js:23`, the base value
`basicDamageBonus` is added to at run start — `defense-run-simulation.js:1824`)
as the reference baseline:

```
wardenFraction = (1 + basicDamageBonus / 900) * damageMultiplier - 1
```

`damageMultiplier` is folded in because it is a real, trait-driven
(`gate-keeper`: ×0.92) part of `deriveWardenRuntimeStats`'s output with
`skillTreeIds: []` — the assignment names both `basicDamageBonus` and
`damageMultiplier` as relevant output fields, and D6/§9.1 bind R1 to the
*final* effectiveDamage, not the raw stat-point count alone. Only positive
fractions count toward the "power budget" — a trait that pulls the Warden
*below* its own 900 baseline (e.g. `gate-keeper` with low `binding-might`
investment) is not "capacity" in the R1 sense; negative values clamp to 0
before the ratio is taken. `Math.max(0, x)` is applied to Warden and to the
companion sum independently before dividing.

Two companion bases are reported side by side because the boss-TTK context
(this is a TTK-adjacent gate) makes both readings relevant:
- **normal-target basis** — `damageBonus` only (0.20 for striker, 0 else).
  This is the **conservative** (higher-Warden-share) reading and is what the
  PASS/FIX verdict below is keyed to.
- **elite/boss-target basis** — `eliteDamageBonus` (0.30 for striker, 0
  else — this is the companion's *total* effective bonus against
  elite/boss targets, not stacked on top of the 0.20; confirmed via
  `defense-run-simulation.js:1591`, `(isElite ? 1 + eliteDamageBonus : 1)`
  replaces, not adds to, the normal multiplier).

### Explicit data gap: equipment tier not in source data

`qa/evidence-cycle2/sweep-*.json` `stageResults[]` entries do not record
equipment purchases (`weapon`/`ward`/`trinket` tier) at any stage — confirmed
by direct inspection of all 7 sweep files' field lists (`archetypeId`, `seed`,
`stageId`, `outcome`, `terminal`, `ticksUsed`, `bossTtkTicks`,
`echoCoreEarned`, `wardLevel`, `loadout`, `statPoints`, `traitIds` — no
`equipment` key anywhere). `deriveWardenRuntimeStats`/`deriveCompanionRuntimeStats`
were therefore called with `equipment: {}` (implicit all-T1,
`weaponTierMultiplier`/`wardTierMultiplier`/`trinketTierMultiplier` = 1.00,
i.e. no equipment-driven damage at all) for both Warden and every companion —
symmetric, not biased toward either side, but this means **every ratio below
is a stat-only proxy, not the true final-effectiveDamage ratio** the §9.1
spec's `enforcement_binding` calls for ("R1/R3/R5 are measured on
final effectiveDamage after fire-time stance multiplier — step_1 output alone
was ruled 'insufficient' by D6"). Fire-time formation-stance multiplier
(`BACK_ROW_SYNERGY_DAMAGE_BONUS`) is also not applied here for the same
reason — it isn't in the sweep data either. Every number in this report is
labeled **stat-only, equipment-tier not captured in source data**.

## Results — 7 archetypes × 10 stages (210 archetype/seed/stage points)

`†` marks a stage where `statPoints`/`traitIds` differ across the 3 seeds
(archetype policy has RNG-driven branching there — `micro-optimizer` stages
4-10, `casual` stages 1-10); the displayed ratio is a range across the 3
seeds' individual values in that case. All other rows are byte-identical
across all 3 seeds (deterministic archetype policy), so one value covers all 3.
"companion loadout" is the stage-fixed roster (`defense-catalog.js` `STAGES`
table pairs each stage with one fixed unlocked companion; `loadout` shows
everything unlocked-and-alive by that stage per the archetype's actual run).
The ratio is a **snapshot from live data**, not the sweep script's own
computation — it is derived directly from `rpg-catalog.js` in this report.
### rusher  ⚠️ FIX — genuinely exceeds 20% ceiling (normal-target basis)

| stage | statPoints (seed 301; † = varies by seed, see note) | companion loadout | basicDamageBonus | damageMultiplier | ratio, normal-target % | ratio, elite/boss-target % |
|---|---|---|---|---|---|---|
| 1 cinder-span | binding-might:2 | ember-cohort | 30 | 1 | 14.3% | 10.0% |
| 2 veil-citadel | binding-might:3 | ember-cohort, rift-lens | 45 | 1 | 11.1% | 7.7% |
| 3 echo-throne | binding-might:4, fracture-precision:1 | ember-cohort, rift-lens, throne-echo | 60 | 1 | 14.3% | 10.0% |
| 4 sunken-bastion | binding-might:5, fracture-precision:1 | anchor-shard, ember-cohort, rift-lens | 75 | 1 | 17.2% | 12.2% |
| 5 howling-sprawl | binding-might:6, fracture-precision:1 | anchor-shard, ember-cohort, rift-lens | 90 | 1 | 20.0% (=20%, at ceiling, not exceeding) | 14.3% |
| 6 glass-necropolis | binding-might:6, fracture-precision:2, abyssal-resonance:1 | anchor-shard, ember-cohort, rift-lens | 90 | 1 | 20.0% (=20%, at ceiling, not exceeding) | 14.3% |
| 7 starless-canal | binding-might:6, fracture-precision:3, abyssal-resonance:1 | anchor-shard, ember-cohort, rift-lens | 90 | 1 | 20.0% (=20%, at ceiling, not exceeding) | 14.3% |
| 8 shattered-causeway | binding-might:7, fracture-precision:3, abyssal-resonance:1 | anchor-shard, ember-cohort, rift-lens | 105 | 1 | 22.6% **>20% (FIX)** | 16.3% |
| 9 abyss-chancel | binding-might:7, fracture-precision:4, abyssal-resonance:1 | anchor-shard, ember-cohort, rift-lens | 105 | 1 | 22.6% **>20% (FIX)** | 16.3% |
| 10 gate-zenith | binding-might:8, fracture-precision:4, abyssal-resonance:1 | anchor-shard, ember-cohort, rift-lens | 120 | 1 | 25.0% **>20% (FIX)** | 18.2% |

### turtle

| stage | statPoints (seed 301; † = varies by seed, see note) | companion loadout | basicDamageBonus | damageMultiplier | ratio, normal-target % | ratio, elite/boss-target % |
|---|---|---|---|---|---|---|
| 1 cinder-span | gate-resolve:2 | ember-cohort | 0 | 1 | 0.0% | 0.0% |
| 2 veil-citadel | gate-resolve:3 | ember-cohort, rift-lens | 0 | 1 | 0.0% | 0.0% |
| 3 echo-throne | gate-resolve:4, echo-swiftness:1 | ember-cohort, rift-lens, throne-echo | 0 | 1 | 0.0% | 0.0% |
| 4 sunken-bastion | gate-resolve:5, echo-swiftness:1 | anchor-shard, ember-cohort, rift-lens | 0 | 0.92 | 0.0% | 0.0% |
| 5 howling-sprawl | gate-resolve:6, echo-swiftness:1 | anchor-shard, ember-cohort, veil-vanguard | 0 | 0.92 | 0.0% | 0.0% |
| 6 glass-necropolis | gate-resolve:6, echo-swiftness:2, fracture-precision:1 | anchor-shard, ember-cohort, veil-vanguard | 0 | 0.92 | 0.0% | 0.0% |
| 7 starless-canal | gate-resolve:6, echo-swiftness:3, fracture-precision:1 | anchor-shard, ember-cohort, veil-vanguard | 0 | 0.92 | 0.0% | 0.0% |
| 8 shattered-causeway | gate-resolve:7, echo-swiftness:3, fracture-precision:1 | anchor-shard, ember-cohort, veil-vanguard | 0 | 0.92 | 0.0% | 0.0% |
| 9 abyss-chancel | gate-resolve:7, echo-swiftness:4, fracture-precision:1 | anchor-shard, dawnless-crown, veil-vanguard | 0 | 0.92 | N/A | N/A |
| 10 gate-zenith | gate-resolve:8, echo-swiftness:4, fracture-precision:1 | anchor-shard, dawnless-crown, veil-vanguard | 0 | 0.92 | N/A | N/A |

### economy-greed

| stage | statPoints (seed 301; † = varies by seed, see note) | companion loadout | basicDamageBonus | damageMultiplier | ratio, normal-target % | ratio, elite/boss-target % |
|---|---|---|---|---|---|---|
| 1 cinder-span | reclaim-radius:2 | ember-cohort | 0 | 1 | 0.0% | 0.0% |
| 2 veil-citadel | reclaim-radius:3 | ember-cohort, rift-lens | 0 | 1 | 0.0% | 0.0% |
| 3 echo-throne | reclaim-radius:3 | ember-cohort, rift-lens, throne-echo | 0 | 1 | 0.0% | 0.0% |
| 4 sunken-bastion | reclaim-radius:4 | anchor-shard, ember-cohort, throne-echo | 0 | 0.92 | 0.0% | 0.0% |
| 5 howling-sprawl | reclaim-radius:4 | anchor-shard, ember-cohort, throne-echo | 0 | 0.92 | 0.0% | 0.0% |
| 6 glass-necropolis | reclaim-radius:5 | anchor-shard, ember-cohort, throne-echo | 0 | 0.92 | 0.0% | 0.0% |
| 7 starless-canal | reclaim-radius:6 | anchor-shard, ember-cohort, throne-echo | 0 | 0.92 | 0.0% | 0.0% |
| 8 shattered-causeway | reclaim-radius:6, echo-swiftness:2 | anchor-shard, ember-cohort, throne-echo | 0 | 0.92 | 0.0% | 0.0% |
| 9 abyss-chancel | reclaim-radius:6, echo-swiftness:3 | anchor-shard, dawnless-crown, throne-echo | 0 | 0.92 | N/A | N/A |
| 10 gate-zenith | reclaim-radius:7, echo-swiftness:3 | anchor-shard, dawnless-crown, throne-echo | 0 | 0.92 | N/A | N/A |

### micro-optimizer  ⚠️ FIX — genuinely exceeds 20% ceiling (normal-target basis)

| stage | statPoints (seed 301; † = varies by seed, see note) | companion loadout | basicDamageBonus | damageMultiplier | ratio, normal-target % | ratio, elite/boss-target % |
|---|---|---|---|---|---|---|
| 1 cinder-span | binding-might:2 | ember-cohort | 30 | 1 | 14.3% | 10.0% |
| 2 veil-citadel | binding-might:3 † | ember-cohort, rift-lens | 45 | 1 | 11.1% | 7.7% |
| 3 echo-throne | binding-might:4, gate-resolve:1 † | ember-cohort, rift-lens, throne-echo | 60 | 1 | 14.3% | 10.0% |
| 4 sunken-bastion | binding-might:5, gate-resolve:1 † | anchor-shard, ember-cohort, throne-echo | 75 | 1 | 0.0%–29.4% **>20% (FIX)** | 0.0%–21.7% |
| 5 howling-sprawl | binding-might:6, gate-resolve:1 † | anchor-shard, ember-cohort, throne-echo | 90 | 1 | 5.7%–33.3% **>20% (FIX)** | 3.8%–25.0% |
| 6 glass-necropolis | binding-might:6, gate-resolve:2, abyssal-resonance:1 † | anchor-shard, ember-cohort, throne-echo | 90 | 1 | 5.7%–33.3% **>20% (FIX)** | 3.8%–25.0% |
| 7 starless-canal | binding-might:6, gate-resolve:3, abyssal-resonance:1 † | anchor-shard, ember-cohort, throne-echo | 90 | 1 | 5.7%–33.3% **>20% (FIX)** | 3.8%–25.0% |
| 8 shattered-causeway | binding-might:7, gate-resolve:3, abyssal-resonance:1 † | anchor-shard, ember-cohort, throne-echo | 105 | 0.92 | 12.0% | 8.4% |
| 9 abyss-chancel | binding-might:7, gate-resolve:4, abyssal-resonance:1 † | anchor-shard, ember-cohort, throne-echo | 105 | 0.92 | 12.0% | 8.4% |
| 10 gate-zenith | binding-might:8, gate-resolve:4, abyssal-resonance:1 † | anchor-shard, ember-cohort, throne-echo | 120 | 0.92 | 17.6% | 12.5% |

### casual

| stage | statPoints (seed 301; † = varies by seed, see note) | companion loadout | basicDamageBonus | damageMultiplier | ratio, normal-target % | ratio, elite/boss-target % |
|---|---|---|---|---|---|---|
| 1 cinder-span | gate-resolve:1, echo-swiftness:1 † | ember-cohort | 0 | 1 | 0.0% | 0.0% |
| 2 veil-citadel | gate-resolve:2, echo-swiftness:2 † | ember-cohort, rift-lens | 0 | 1 | 0.0% | 0.0% |
| 3 echo-throne | gate-resolve:2, echo-swiftness:2 † | ember-cohort, rift-lens, throne-echo | 0 | 1 | 0.0% | 0.0% |
| 4 sunken-bastion | gate-resolve:2, echo-swiftness:2, binding-might:1 † | anchor-shard, ember-cohort, rift-lens | 15 | 1 | 0.0%–4.0% | 0.0%–2.7% |
| 5 howling-sprawl | gate-resolve:2, echo-swiftness:2, binding-might:1, abyssal-resonance:1, reclaim-radius:1 † | anchor-shard, ember-cohort, rift-lens | 15 | 1 | 0.0%–4.0% | 0.0%–2.7% |
| 6 glass-necropolis | gate-resolve:2, echo-swiftness:2, binding-might:1, abyssal-resonance:2, reclaim-radius:1 † | anchor-shard, ember-cohort, rift-lens | 15 | 1 | 0.0%–4.0% | 0.0%–2.7% |
| 7 starless-canal | gate-resolve:2, echo-swiftness:3, binding-might:1, abyssal-resonance:2, reclaim-radius:1 † | anchor-shard, ember-cohort, rift-lens | 15 | 1 | 0.0%–4.0% | 0.0%–2.7% |
| 8 shattered-causeway | gate-resolve:2, echo-swiftness:3, binding-might:1, abyssal-resonance:2, reclaim-radius:1 † | anchor-shard, ember-cohort, rift-lens | 15 | 1 | 0.0%–4.0% | 0.0%–2.7% |
| 9 abyss-chancel | gate-resolve:2, echo-swiftness:3, binding-might:1, abyssal-resonance:2, reclaim-radius:1 † | anchor-shard, dawnless-crown, ember-cohort | 15 | 1 | 0.0%–7.7% | 0.0%–5.3% |
| 10 gate-zenith | gate-resolve:2, echo-swiftness:3, binding-might:2, abyssal-resonance:2, reclaim-radius:2, fracture-precision:1 † | anchor-shard, dawnless-crown, ember-cohort | 30 | 1 | 0.0%–14.3% | 0.0%–10.0% |

### completionist-collector

| stage | statPoints (seed 301; † = varies by seed, see note) | companion loadout | basicDamageBonus | damageMultiplier | ratio, normal-target % | ratio, elite/boss-target % |
|---|---|---|---|---|---|---|
| 1 cinder-span | binding-might:2 | ember-cohort | 30 | 1 | 14.3% | 10.0% |
| 2 veil-citadel | binding-might:3 | ember-cohort, rift-lens | 45 | 1 | 11.1% | 7.7% |
| 3 echo-throne | binding-might:4, abyssal-resonance:1 | ember-cohort, rift-lens, throne-echo | 60 | 1 | 14.3% | 10.0% |
| 4 sunken-bastion | binding-might:5, abyssal-resonance:1 | anchor-shard, ember-cohort, rift-lens | 75 | 0.92 | 0.0% | 0.0% |
| 5 howling-sprawl | binding-might:6, abyssal-resonance:1 | anchor-shard, ember-cohort, rift-lens | 90 | 0.92 | 2.9% | 2.0% |
| 6 glass-necropolis | binding-might:6, abyssal-resonance:2, echo-swiftness:1 | anchor-shard, ember-cohort, rift-lens | 90 | 0.92 | 2.9% | 2.0% |
| 7 starless-canal | binding-might:6, abyssal-resonance:3, echo-swiftness:1 | anchor-shard, ember-cohort, rift-lens | 90 | 0.92 | 2.9% | 2.0% |
| 8 shattered-causeway | binding-might:7, abyssal-resonance:3, echo-swiftness:1 | anchor-shard, ember-cohort, rift-lens | 105 | 0.92 | 6.4% | 4.4% |
| 9 abyss-chancel | binding-might:7, abyssal-resonance:4, echo-swiftness:1 | anchor-shard, dawnless-crown, ember-cohort | 105 | 0.92 | 12.0% | 8.4% |
| 10 gate-zenith | binding-might:8, abyssal-resonance:4, echo-swiftness:1 | anchor-shard, dawnless-crown, ember-cohort | 120 | 0.92 | 17.6% | 12.5% |

### single-companion-main  ⚠️ FIX — genuinely exceeds 20% ceiling (normal-target basis)

| stage | statPoints (seed 301; † = varies by seed, see note) | companion loadout | basicDamageBonus | damageMultiplier | ratio, normal-target % | ratio, elite/boss-target % |
|---|---|---|---|---|---|---|
| 1 cinder-span | binding-might:2 | ember-cohort | 30 | 1 | 14.3% | 10.0% |
| 2 veil-citadel | binding-might:3 | ember-cohort | 45 | 1 | 20.0% (=20%, at ceiling, not exceeding) | 14.3% |
| 3 echo-throne | binding-might:3 | ember-cohort | 45 | 1 | 20.0% (=20%, at ceiling, not exceeding) | 14.3% |
| 4 sunken-bastion | binding-might:4 | ember-cohort | 60 | 1 | 25.0% **>20% (FIX)** | 18.2% |
| 5 howling-sprawl | binding-might:4 | ember-cohort | 60 | 1 | 25.0% **>20% (FIX)** | 18.2% |
| 6 glass-necropolis | binding-might:5 | ember-cohort | 75 | 1 | 29.4% **>20% (FIX)** | 21.7% |
| 7 starless-canal | binding-might:6 | ember-cohort | 90 | 1 | 33.3% **>20% (FIX)** | 25.0% |
| 8 shattered-causeway | binding-might:6, abyssal-resonance:2 | ember-cohort | 90 | 1 | 33.3% **>20% (FIX)** | 25.0% |
| 9 abyss-chancel | binding-might:6, abyssal-resonance:3 | ember-cohort | 90 | 1 | 33.3% **>20% (FIX)** | 25.0% |
| 10 gate-zenith | binding-might:7, abyssal-resonance:3 | ember-cohort | 105 | 1 | 36.8% **>20% (FIX)** | 28.0% |

## Verdict

**FIX — the stat-only ratio genuinely exceeds the 20% ceiling
(`POWER_GOVERNANCE.r1WardenCapacityCeilingPct`) on the conservative
normal-target basis, at specific, identifiable stages for 3 of 7 archetypes.**

- **34 of 210** archetype/seed/stage points exceed 20% (epsilon-clean, i.e.
  genuinely above 20.000000%, not floating-point noise at the boundary — see
  below), spanning **14 unique archetype/stage combinations**:

  | archetype | stages exceeding 20% (normal-target basis) |
  |---|---|
  | `single-companion-main` | 4, 5, 6, 7, 8, 9, 10 (sunken-bastion through gate-zenith) — **7 of its 10 stages** |
  | `rusher` | 8, 9, 10 (shattered-causeway, abyss-chancel, gate-zenith) |
  | `micro-optimizer` | 4, 5, 6, 7 (sunken-bastion through starless-canal, seed-301-only — RNG trait branch) |

- On the **elite/boss-target basis** (`eliteDamageBonus`, softer reading), 19
  of 210 points exceed 20%, same 3 archetypes, a subset of the same stages
  (`single-companion-main` stages 6-10, `micro-optimizer` stages 4-7,
  `rusher` never exceeds on this basis — its max is 18.2% at stage 10).
- **5 additional points sit exactly at 20.000000%** (`rusher` stages 5-7,
  `single-companion-main` stages 2-3, all 3 seeds) — floating-point-verified
  exact boundary, not counted as exceeding (20% is the ceiling, not the
  exceedance threshold).
- **Most extreme measured ratio**: **`single-companion-main` / stage 10
  (`gate-zenith`) / all 3 seeds identical / 36.84%** (normal-target basis) —
  1.84× the 20% ceiling. Contributing values: `basicDamageBonus=105`
  (7 `binding-might` points), `damageMultiplier=1.0` (no active
  multiplier-affecting trait at that point), single companion in loadout
  (`ember-cohort`, striker, `damageBonus=0.20`). On the elite/boss-target
  basis the same cell reads 28.00%.
- This confirms the assignment's prediction on both named watch-archetypes:
  `single-companion-main` (fewest companions to dilute the ratio) is the
  worst offender by a wide margin — 7/10 stages exceed, its exceedance
  starts as early as stage 4 and only worsens as the campaign progresses
  (Warden stat investment compounds every stage; companion count is capped
  at 3 loadout slots after stage 4-5 and stops diluting further).
  `micro-optimizer` (heaviest Warden stat investment) also exceeds, but only
  on the RNG branch that skips `reckless-reclaim`/`gate-keeper` (traits that
  would otherwise suppress `damageMultiplier`) — seed-301-only in this
  3-seed sample, stages 4-7, then drops back under 20% once `gate-keeper`
  (seed 301 too) and the loadout composition shift at stage 8 change the mix.
- `rusher` was not named as a watch-archetype in the assignment but exceeds
  independently at stages 8-10 (single-companion `ember-cohort`+`rift-lens`
  builds compound similarly to `single-companion-main` once `binding-might`
  crosses ~7 points against a fixed 2-companion loadout).
- `turtle` and `economy-greed` never invest `binding-might` at all
  (confirmed: `statPoints` has no `binding-might` key at any of their 30
  combined stage/seed points) — `basicDamageBonus=0` throughout, ratio is
  0.0% everywhere it has a signal (stages 9-10 for `turtle` are N/A: 0
  Warden bonus **and** an all-vanguard/support loadout at those two stages
  give a 0/0 undefined ratio, not a Warden-dominance case — reported as N/A,
  not silently as 0% or 100%).

### Caveat this verdict carries (do not treat as a clean FIX in isolation)

This is a **stat-only proxy measurement**, per the data-gap section above —
equipment tiers (which scale both Warden and companion damage multiplicatively,
up to ×2.00 at T5) and the fire-time formation-stance multiplier are absent
from the source data entirely, for both sides of the ratio symmetrically. A
realistic campaign accumulates `bound-fragment` currency and spends it on
equipment across the same 10 stages this sweep covers, and equipment tier
could plausibly narrow or widen the gap in either direction depending on
whether players over-index Warden gear or companion gear — this report cannot
determine which. **The FIX verdict is real and actionable as far as it goes**
(pure stat-point allocation, unmodified by gear, already crosses the ceiling
on `single-companion-main`, `rusher`, and `micro-optimizer` seed-301), but a
complete close-out of `design/UNIFIED-GDD.md` §9.1's literal
`enforcement_binding` requirement ("measured on final effectiveDamage" after
step_2 fire-time multiplier) still needs equipment-tier data captured
per-stage. **Recommended next step if full closure is required**: extend
`scripts/run-g2-archetype-rotation.mjs` to record each stage's
`equipment: {weapon, ward, trinket}` tier indices (both Warden's and each
companion's) in its `stageResults[]` output, then re-run this exact
computation with real `equipment` objects instead of `{}`.

## Evidence

- Source data: `qa/evidence-cycle2/sweep-{rusher,turtle,economy-greed,micro-optimizer,casual,completionist-collector,single-companion-main}.json` (7 files, unmodified, D15's Cycle 2 re-run).
- Computation: `deriveWardenRuntimeStats`/`deriveCompanionRuntimeStats`/`POWER_GOVERNANCE` imported live from `rpg-catalog.js` (unmodified) in an eval session against all 210 archetype/seed/stage combinations; `COMMANDER.basicDamage=900` from `defense-catalog.js` (unmodified) as the normalization baseline.
- Cross-checked against `defense-run-simulation.js:1824` (`commander.basicDamage = (base + basicDamageBonus) * weaponTierMultiplier`) and `:1591` (`isElite ? 1 + eliteDamageBonus : 1`) to confirm the normalization and elite-multiplier semantics used above match the actual runtime composition order.
