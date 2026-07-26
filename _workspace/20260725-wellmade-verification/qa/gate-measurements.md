# Gate Measurements — Well-Made Verification Cycle

run-id: `20260725-wellmade-verification` · measured by: `BalanceG2G3` (QA sub-agent)
scope: the **formal G2 and G3 protocols** every prior cycle deferred. Measurement-only —
no game-balance file was modified (see [Non-modification proof](#non-modification-proof)).

Every number below was produced in this session by a named command against a committed
evidence file. Nothing is inherited from a prior cycle; where a prior number is quoted it
is explicitly labelled as the prior cycle's and re-derived here.

## Separability note (read before cross-referencing the asset gates)

G2/G3 are **headless simulation** measurements. They drive `defense-run-simulation.js`
directly with zero GLB load, zero renderer, zero Three.js. None of this cycle's rig/asset
defects (`engineering/rig-pipeline-root-cause.md` D1–D6) can confound any number in this
document, and no number in this document is evidence about those defects. The balance
gates and the asset gates are cleanly separable and must stay separate in the backlog.

## Method summary

| arm | command | runs | evidence |
|---|---|---|---|
| RPG-active campaign sweep | `node scripts/run-g2-archetype-rotation.mjs <archetype> --seeds 301,302,303,304,305 --output qa/evidence/sweep-rpg-active-<archetype>.json` | 7 archetypes × 5 seeds × 10 stages = 350 stage-runs | `qa/evidence/sweep-rpg-active-*.json` (7 files) |
| RPG-inactive campaign sweep | same + `--rpg-inactive` | 350 stage-runs | `qa/evidence/sweep-rpg-inactive-*.json` (7 files) |
| difficulty-margin probe | `node scripts/run-g2-margin-probe.mjs --seeds 301,302,303,304,305 --stances <S> --output qa/evidence/margin-probe-<S>.json` | 3 stances × 10 stages × 5 seeds = 150 | `qa/evidence/margin-probe-{VANGUARD,TURRET,SPLIT}.json` |
| stance-event probe | `node scripts/run-g3-stance-events.mjs --seeds 301,302,303,304,305 --output qa/evidence/g3-stance-events.json` | 150 | `qa/evidence/g3-stance-events.json` |
| exploit probe | `node scripts/run-g3-exploit-probe.mjs --seeds 301,302,303,304,305 --output qa/evidence/g3-exploit-probe.json` | 150 | `qa/evidence/g3-exploit-probe.json` |

**Seed count**: 5 (301–305). The prior cycle used 3; running the formal protocol at a
larger n is the point of this cycle, and it changed one headline result (see #g2 finding b).

**Harness changes made this cycle** (measurement-only, additive):
- `scripts/run-g2-archetype-rotation.mjs` — added `--seeds`, added `--rpg-inactive`, and
  extended the recorded per-stage row with `skillTreeIds`, `wardenEquipment`,
  `companionEquipment`, `rpgActive`, `formationStance`. The equipment capture is what
  closes finding (c) below.
- `scripts/run-g2-margin-probe.mjs`, `scripts/run-g3-stance-events.mjs`,
  `scripts/run-g3-exploit-probe.mjs` — new measurement scripts (this cycle).

**Proof the harness edit did not perturb any number**: the pristine `HEAD` version of the
rotation script was extracted (`git show HEAD:scripts/run-g2-archetype-rotation.mjs`) and
run side by side against the edited version on the default seed set. Shared-field diff:
**0 fields across all 3 seeds × 10 stages**. The edit is a verified no-op in default mode.

## Cross-cycle integrity finding (report to retrospective)

Re-running the **unmodified HEAD** script this session does not reproduce cycle 2's
committed evidence. `outcome`, `terminal`, `statPoints`, `traitIds`, `loadout`,
`wardLevel`, `echoCoreEarned` are byte-identical, but `ticksUsed` and `bossTtkTicks`
differ on **all 10 stages** (e.g. `rusher`/`echo-throne` 586 → 687 ticks, +17%).

Cause: the in-flight 3-stance core-loop redesign changed companion positioning, which
changes engagement timing, which changes TTK. That is expected. What is *not* acceptable
is that **cycle 2's committed TTK table silently became wrong and nothing flagged it** —
`qa/evidence-cycle2/` carries no simulation-version stamp and no test asserts that
committed evidence still reproduces.

This is the same failure class as `rig-all-characters.sh` installing over its own
`tposeOk: false`: a pipeline producing a green artifact that its own data contradicts.
Every TTK figure in this document is re-derived from this session's runs; **do not read
cycle-2's TTK numbers as current.**

Recommended: stamp evidence files with a simulation-rules digest (the repo already has
`scripts/read-defense-rules-version.mjs`) and fail CI when committed evidence no longer
reproduces.

---

## #g2 — Rules & balance numbers {#g2}

**Verdict input: FIX.** Four specific measurements fail; one gate sub-requirement is
un-run. Details and the exact failing values below.

### g2.1 — The campaign has no reachable failure state

| arm | campaigns cleared | stage-runs cleared | defeats |
|---|---|---|---|
| RPG-active | **35 / 35** (100.0%) | 350 / 350 (100.0%) | **0** |
| RPG-inactive (`wardenProgress: null`, all equipment stripped) | **35 / 35** (100.0%) | 350 / 350 (100.0%) | **0** |
| **clear-rate delta** | **0.0 %p** | | |

Adding the margin/stance/exploit probes: **0 defeats and 0 companions downed across all
1,000 stage-runs measured this cycle.**

This is the headline gameplay finding of the cycle, and it is not a G2 footnote: **the
game currently cannot be lost.** Clear-rate has no resolution left as a metric — it is
saturated at both ends of a deliberately extreme A/B.

- Command: `node scripts/run-g2-archetype-rotation.mjs <a> --seeds 301,302,303,304,305 [--rpg-inactive] --output …`
- Evidence: `qa/evidence/sweep-rpg-active-*.json`, `qa/evidence/sweep-rpg-inactive-*.json`

### g2.2 — Closing prior finding (a): the RPG layer is exonerated

The prior cycle suspected the 100% clear rate came from the RPG layer's additive power and
recommended exactly this experiment. Run, and the answer is the opposite:

- The RPG layer is **not weak** — it delivers a real, large power swing: mean boss TTK
  **899 → 687 ticks, a 1.309× speedup** (n=350 per arm).
- That large swing produces **zero** outcome change (35/35 both arms).
- Therefore the difficulty ceiling sits **below the RPG-inactive floor**. The base stage
  budgets are undertuned; the RPG layer is not the cause.

Per-archetype RPG speedup (inactive TTK ÷ active TTK): rusher 1.48×, casual 1.42×,
micro-optimizer 1.37×, single-companion-main 1.28×, completionist-collector 1.26×,
turtle 1.25×, economy-greed 1.17×.

**Backlog owner: base stage difficulty (`defense-catalog.js` stage budgets), not `rpg-catalog.js`.**

### g2.3 — Sizing the gap: the non-saturated margin distribution

Since clear-rate is saturated, the load-bearing number is how close anything ever came to
losing. Measured on **bare stages with no RPG layer at all** — the hardest case, i.e. the
conservative floor.

**Gate integrity, worst value ever reached during the run, % of max** (VANGUARD, n=5 seeds/stage):

| stage | min | p25 | median | p75 | max |
|---|---:|---:|---:|---:|---:|
| 1 cinder-span | 98.0% | 98.0% | 99.0% | 99.0% | 99.0% |
| 2 veil-citadel | 86.1% | 87.4% | 88.7% | 90.4% | 90.6% |
| 3 echo-throne | 93.6% | 95.2% | 96.0% | 96.0% | 97.6% |
| 4 sunken-bastion | 81.3% | 82.7% | 85.5% | 85.7% | 86.5% |
| 5 howling-sprawl | 78.0% | 81.4% | 83.2% | 84.0% | 86.0% |
| 6 glass-necropolis | 79.6% | 81.5% | 82.4% | 85.2% | 90.7% |
| 7 starless-canal | 83.6% | 86.0% | 87.6% | 90.0% | 96.0% |
| 8 shattered-causeway | 67.0% | 68.0% | 74.0% | 74.0% | 78.0% |
| 9 abyss-chancel | **60.4%** | 60.4% | 61.2% | 66.8% | 72.0% |
| 10 gate-zenith | 67.0% | 68.8% | 69.8% | 73.2% | 75.0% |
| **ALL 50** | **60.4%** | 74.3% | 84.6% | 90.5% | 99.0% |

**Commander integrity, worst ever, % of max**:

| stage | min | p25 | median | p75 | max |
|---|---:|---:|---:|---:|---:|
| 1 cinder-span | 89.3% | 89.3% | 100.0% | 100.0% | 100.0% |
| 2 veil-citadel | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% |
| 3 echo-throne | 87.5% | 87.5% | 89.3% | 98.0% | 98.0% |
| 4 sunken-bastion | 81.9% | 82.6% | 82.7% | 95.0% | 95.0% |
| 5 howling-sprawl | 85.7% | 85.7% | 96.0% | 96.0% | 96.0% |
| 6 glass-necropolis | 96.0% | 96.0% | 96.0% | 96.0% | 96.0% |
| 7 starless-canal | 78.2% | 79.6% | 81.8% | 92.9% | 93.0% |
| 8 shattered-causeway | 85.7% | 85.7% | 96.0% | 96.0% | 96.0% |
| 9 abyss-chancel | 63.6% | 65.5% | 81.6% | 81.6% | 83.6% |
| 10 gate-zenith | **55.8%** | 55.8% | 57.2% | 76.8% | 79.8% |
| **ALL 50** | **55.8%** | 82.1% | 91.1% | 96.0% | 100.0% |

**The closest any run ever came to defeat** — across every stage, seed and stance measured —
was `gate-zenith` seed 304009: **gate still at 69.8%, commander still at 55.8%.** Stated
plainly: at the worst moment of the worst run of the hardest stage with the RPG layer
switched off, the player still held over half of both health pools.

**Shape, not just level.** The curve is real and monotone-ish: mean gate consumed rises
from **5.7%** across stages 1–3 to **31.0%** across stages 8–10 (5.4× escalation). The
authored progression works — its **amplitude** is the defect, not its shape. Fix by
scaling the curve, not by flattening or replacing it.

Implied uniform pressure scale needed to bring each stage's worst case to a 15%-remaining
threat line:

| stage | worst gate floor | consumed | implied scale |
|---|---:|---:|---:|
| 1 cinder-span | 98.0% | 2.0% | 42.50× |
| 2 veil-citadel | 86.1% | 13.9% | 6.12× |
| 3 echo-throne | 93.6% | 6.4% | 13.28× |
| 4 sunken-bastion | 81.3% | 18.7% | 4.55× |
| 5 howling-sprawl | 78.0% | 22.0% | 3.86× |
| 6 glass-necropolis | 79.6% | 20.4% | 4.17× |
| 7 starless-canal | 83.6% | 16.4% | 5.18× |
| 8 shattered-causeway | 67.0% | 33.0% | 2.58× |
| 9 abyss-chancel | 60.4% | 39.6% | 2.15× |
| 10 gate-zenith | 67.0% | 33.0% | 2.57× |

The 42.5× vs 2.15× spread is why **a single global multiplier is the wrong fix** — early
stages are disproportionately trivial. Tuning is the designer's call, not QA's; this table
sizes the gap only.

- Command: `node scripts/run-g2-margin-probe.mjs --seeds 301,302,303,304,305 --stances VANGUARD --output qa/evidence/margin-probe-VANGUARD.json`
- Evidence: `qa/evidence/margin-probe-VANGUARD.json`

### g2.4 — Efficiency spread vs the 1.3× combo-EV cap — PASS

Genre override in force: `win_rate_band 45–55%` is DEPRECATED for this single-player PvE
campaign (`design/balance-sheet.md#band-overrides`, approved `production/decision-log.md#D15`).
The adopted substitute is cross-archetype efficiency spread against the `combo_ev_cap_vs_median: 1.3`
constant. This cycle **reuses that documented precedent** and does not invent a new band.

Campaign-mean boss TTK, RPG-active, n=50 stage-runs per archetype:

| archetype | mean boss TTK | ratio vs median |
|---|---:|---:|
| rusher | 569 | 0.833 |
| casual | 604 | 0.885 |
| micro-optimizer | 622 | 0.912 |
| completionist-collector | 683 | 1.000 |
| economy-greed | 730 | 1.069 |
| turtle | 739 | 1.082 |
| single-companion-main | 861 | 1.261 |

Median 683. **Max deviation 1.261× — within the 1.3× cap. PASS.** (Prior cycle measured
1.166× at n=3; the larger sample moved it up but not over.) Fastest/slowest spread 1.513×,
which is a spread statistic, not the capped metric.

### g2.4b — Pairwise combo-EV (dominant *pairs*, not single archetypes) — PASS

g2.4 scores each archetype individually against the median. The gate text, however, binds
the cap to **pairs** ("no dominant pair >1.3× median EV"), and a pair can be in-band on
each member alone yet out-of-band together. That distinction was raised by `NarrativeG1`
from an analogous defect on the narrative side (a string cleared row-by-row that became a
violation only as part of a set) and it applies here, so it was measured rather than assumed.

Method: every stage-run is scored by boss TTK normalised against that stage's own median
(stages differ several-fold in absolute TTK, so raw pooling would be a denominator error).
For every trait pair co-occurring in ≥10 stage-runs, the pair's median relative TTK is
converted to an EV multiplier (`EV = 1 / relTTK`; faster than median = higher EV).

| trait pair | n | median rel-TTK | EV vs median | breach |
|---|---:|---:|---:|---|
| desperate-echo + echo-overflow | 10 | 0.826 | 1.211× | ok |
| chain-reaction + elite-hunter | 14 | 0.826 | 1.211× | ok |
| echo-overflow + elite-hunter | 10 | 0.826 | 1.211× | ok |
| chain-reaction + echo-overflow | 11 | 0.850 | 1.176× | ok |
| elite-hunter + reckless-reclaim | 11 | 0.863 | 1.159× | ok |
| companions-wardpact + elite-hunter | 17 | 0.874 | 1.144× | ok |
| chain-reaction + first-strike | 111 | 0.908 | 1.102× | ok |

**24 pairs evaluated at n≥10; 0 breach the 1.3× cap. Strongest pair 1.211×.**

Superadditivity — is any pair stronger than *either* member alone, i.e. a genuine
interaction rather than one strong trait carrying a weak partner? **7 pairs are
superadditive**, the largest being `first-strike + reckless-reclaim` at **1.082×** over its
best member. All well inside the cap. `elite-hunter` is the strongest single contributor
(solo rel-TTK 0.840) and appears in 4 of the top 7 pairs, but never pushes a pair past 1.3×.

**PASS on the pairwise reading as well as the per-archetype reading.**

- Evidence: `qa/evidence/sweep-rpg-active-*.json` (`traitIds` + `bossTtkTicks` fields)

### g2.5 — Closing prior finding (b): turtle TTK ceiling — still FIX, count revised

Band `[1.00, 1.15]×` for `turtle` vs the `rusher`+`micro-optimizer` median
(`design/balance-sheet.md#band-overrides`).

| stage | turtle TTK | rusher+micro median | ratio | in band |
|---|---:|---:|---:|---|
| 1 cinder-span | 580 | 580 | 1.000 | yes |
| 2 veil-citadel | 523 | 511 | 1.023 | yes |
| 3 echo-throne | 638 | 631 | 1.011 | yes |
| 4 sunken-bastion | 579 | 555 | 1.043 | yes |
| 5 howling-sprawl | 590 | 509 | 1.159 | **VIOLATES** |
| 6 glass-necropolis | 804 | 580.5 | 1.385 | **VIOLATES** |
| 7 starless-canal | 802 | 582.5 | 1.377 | **VIOLATES** |
| 8 shattered-causeway | 983 | 626 | 1.570 | **VIOLATES** |
| 9 abyss-chancel | 922 | 614 | 1.502 | **VIOLATES** |
| 10 gate-zenith | 986 | 743.5 | 1.326 | **VIOLATES** |

**6 / 10 stages violate** (prior cycle: 7/10 at n=3 — the extra seeds moved
`sunken-bastion` back in band; the escalating tail stages 5–10 are unchanged and
worsening, peaking at 1.570×).

Root cause **re-confirmed at n=50**: `ARCHETYPES.turtle.statPriority` invests only
`gate-resolve`, `echo-swiftness`, `fracture-precision` across all 5 seeds × 10 stages.
`binding-might`: never. `abyssal-resonance`: never. Deterministic, not sampling noise.

Carrying the prior cycle's disposition: this is a defect **in the QA archetype policy**
(`scripts/run-g2-archetype-rotation.mjs`), not confirmed as a game-numbers defect. A
"turtle" that refuses every damage stat is a strawman, and it is the reason the
defense-archetype ceiling reads as violated. **Recommended: fix the policy, then re-measure
before touching any game number.** Until then this row should not drive a balance change.

### g2.6 — Closing prior finding (c): R1 warden-share, now on real equipment data

The prior cycle could not compute this and recommended exactly this extension. Equipment
tiers are now captured per stage — **proof it is live data**: warden weapon reaches T4,
warden ward/trinket T1, companion weapon/ward/trinket T2 across the sweep.

**Denominator discipline** (adopting the director's method note — verify what you divided
by). Three defensible bases exist and they disagree wildly, so all three are stated rather
than one being silently chosen:

| basis | definition | >20% ceiling | median | max |
|---|---|---:|---:|---:|
| A — share of total player damage | `wardenDmg / (wardenDmg + Σcompanions)` | 350/350 | 45.5% | 68.0% |
| B — share of *added* power over baseline | `wardenAdded / (wardenAdded + Σcompanions_added)` | **127/350** | **14.4%** | **40.1%** |
| prior cycle's fractional proxy, + equipment | cycle-2 formula with equipment passed in | 250/330 | — | 86.4% |

**Basis A is degenerate and is discarded**: a warden with *zero* RPG investment already
holds ~40% share, because `COMMANDER.basicDamage = 900` is a base-game value, not RPG
capacity. A 20% ceiling is structurally unreachable on that basis, so it cannot be what
the rule meant.

**Basis B is the reported result** — the only basis on which the 20% ceiling is a
meaningful, reachable constraint.

| archetype | median added-share | max | points >20% | warden weapon reached |
|---|---:|---:|---:|---:|
| micro-optimizer | 25.2% | **40.1%** | 33/50 | T4 |
| rusher | 25.2% | 37.8% | 30/50 | T4 |
| turtle | 20.2% | 31.0% | 30/50 | T4 |
| casual | 19.3% | 34.5% | 24/50 | T4 |
| completionist-collector | 7.4% | 25.2% | 5/50 | T1 |
| economy-greed | 2.8% | 21.1% | 5/50 | T1 |
| single-companion-main | 9.4% | 13.4% | **0/50** | T0 |

**R1 result: 127/350 points (36.3%) exceed the 20% ceiling, worst 40.1% (2.0× the
ceiling), at `micro-optimizer`/`gate-zenith`/seed 304.**

**The prior cycle's open question is now answered: equipment WIDENS the gap.** On the
prior cycle's own proxy, adding equipment moves the ratio by a mean of **+30.77 %p**;
**280 of 330** measurable points widen, only 45 narrow. The mechanism is visible in the
table above — warden weapon tier is the single dominant driver. Every archetype that
reaches T4 warden weapon exceeds the ceiling; every archetype that stays at T0–T1 does not.
`single-companion-main` — the prior cycle's *worst* offender at 36.84% stat-only — inverts
to the **best** at 13.4%, because its own policy
(`scripts/run-g2-archetype-rotation.mjs:64`, `singleCompanionOnly` excludes `"warden"` from
the purchase owner list) spends its entire equipment budget on the companion.

Progression confirms the compounding mechanism the prior cycle predicted: median added-share
runs 21.1% (s1) → 10.5% (s2, dips as companions join and dilute) → 21.1% (s6–s8) → **31.0%
(s10)**, max **40.1%** at stage 10.

**Caveat retained**: the fire-time stance multiplier (`BACK_ROW_SYNERGY_DAMAGE_BONUS`) is
still not folded into the R1 ratio. It is measured separately in #g3 (uptake 0–70.3% by
stance) but applying it here needs a decision on which stance is the canonical basis —
that is a designer/director call, not a QA one. Every R1 figure above is
**equipment-inclusive, stance-exclusive**.

- Evidence: `qa/evidence/sweep-rpg-active-*.json` (`wardenEquipment`/`companionEquipment` fields)

### g2.7 — Un-run G2 sub-requirement

"100% of mechanics covered in `design/balance-sheet.md`" — **PENDING, not measured this
cycle.** This is a document-audit requirement orthogonal to simulation, and was also
un-run in cycles 1 and 2. Naming it so it stops being invisible. It is the only G2
sub-requirement with no number attached.

### #g2 verdict input

**FIX**, on these specific measurements:

1. **No reachable failure state** — 0 defeats / 1,000 stage-runs; clear-rate delta between
   RPG-active and RPG-inactive is 0.0 %p; worst-ever margin 60.4% gate / 55.8% commander.
   Owner: base stage difficulty.
2. **R1 exceeded** — 127/350 points over the 20% ceiling, max 40.1%, driven by warden
   weapon tier; equipment widens rather than narrows.
3. **turtle TTK ceiling** — 6/10 stages over `[1.00,1.15]`, max 1.570×. Suspected QA-policy
   defect, not a game-numbers defect; fix the policy and re-measure first.
4. **Committed evidence silently went stale** — cycle-2 TTK no longer reproduces and
   nothing detected it.

PASS on: efficiency spread 1.261× vs the 1.3× cap.
PENDING: balance-sheet mechanics-coverage audit.

---

## #g3 — Player-type diversity {#g3}

**Verdict input: FIX.** The literal thresholds pass, but they pass *vacuously* — and the
one axis the prior cycle certified as a real trade-off is measurably decorative in outcome
terms.

Genre note: this is a single-player PvE campaign with no PvP win/loss, so the harness's
"no archetype >50% dominance" cannot be measured as written. The documented
efficiency-spread proxy (`#band-overrides`, D15) is used, and is named as a proxy.

### g3.1 — Literal threshold check

| requirement | threshold | measured | result |
|---|---|---|---|
| archetypes tested | ≥5 | **7** | PASS |
| independently viable | ≥3 | **7/7** cleared 5/5 campaigns, all within 1.3× median TTK | PASS (vacuous — see g3.2) |
| distinct strategies | qualitative | **7/7 distinct stat-priority sets**, 1–6 distinct loadouts each | PASS |
| no >50% dominance | ≤50% | not measurable (no PvP); efficiency spread max 1.261× median | PASS by proxy |

Full per-archetype table: `qa/playtest-report.md`.

### g3.2 — Why the viability PASS is vacuous

"Independently viable" is measured by campaign completion. Every archetype completes every
campaign — **but so does every archetype with the entire RPG layer disabled** (g2.2), and
no run in this cycle ever came within 55% of losing (g2.3). A viability test whose pass
condition is met by a build with no investment at all is not discriminating between
archetypes; it is reporting that the content cannot fail anyone.

The 7/7 PASS should be read as "no archetype is *disqualified*", not as "7 archetypes are
independently viable under pressure". The latter is **unmeasurable until g2's difficulty
gap is closed**, and should be re-run then. This is the honest reading and it is why the
gate verdict input is FIX rather than PASS.

### g3.3 — The 3-stance system: structurally real, behaviourally decorative

Tested directly, identical loadout/seeds across all three stances, 50 runs each.

**The structural exclusion is real and total** — confirming the prior cycle:

| stance | derived FRONT | BOSS_RALLY_WINDOW | synergy-buffed shots | raw shots | synergy uptake | companion dmg taken | companions DOWNED |
|---|---:|---:|---:|---:|---:|---:|---:|
| VANGUARD | 2 | 50 | 3,853 | 5,120 | 42.9% | 27,056 | **0** |
| TURRET | 0 | **0** | **0** | 9,640 | **0.0%** | **0** | **0** |
| SPLIT | 1 | 50 | 5,671 | 2,397 | 70.3% | 5,952 | **0** |

TURRET receives **0 of 50** Boss Rally Windows and **0.0%** back-row synergy uptake. Both
`FRONT>=1`-gated mechanics exclude it completely. The prior cycle's structural finding is
**CONFIRMED**.

**But the exclusion costs almost nothing**, and this refutes the prior cycle's
characterisation:

| stance | total shots | dmg/shot | total companion damage | vs VANGUARD |
|---|---:|---:|---:|---:|
| VANGUARD | 8,973 | 481.9 | 4,324,020 | 0.00% |
| TURRET | 9,640 | 437.9 | 4,221,420 | **−2.37%** |
| SPLIT | 8,068 | 517.2 | 4,172,790 | **−3.50%** |

Losing 100% of a +25% damage bonus and 100% of the rally window costs TURRET **2.37%** of
total output. The mechanism: TURRET's tight `radius: 300` cluster keeps all three
companions in range, firing **19.5% more shots** than SPLIT's `radius: 9000` spread. The
per-shot synergy bonus and the wide-formation uptime penalty **very nearly cancel** — net
spread across all three stances is **1.0362×**.

**Two prior-cycle claims are refuted at larger n:**

1. *"TURRET has the LOWEST firepower"* — false across the full campaign. Ordering is
   **SPLIT (4,172,790) < TURRET (4,221,420) < VANGUARD (4,324,020)**; TURRET is the
   *middle*. The prior claim came from a stage-7-only sample, where TURRET *is* lowest
   (468,360) — a real small-sample artifact, reproducible and now bounded.
2. *"the 3 stances are a real trade-off with no dominant strategy"* — the trade-off exists
   in the damage-taken column (VANGUARD 27,056 / TURRET 0 / SPLIT 5,952, a genuinely
   categorical difference) but **never converts into an outcome**: 0 companions downed in
   all 300 stance runs, 0 defeats. TURRET's "zero-risk" identity protects against a
   consequence that never occurs.

Per-stage, the convergence tightens as stages grow (max/min ratio 1.238× at `cinder-span`,
**1.009×** at `shattered-causeway`), so this is not an averaging artifact.

### g3.4 — The FRONT/BACK risk model is inert during every boss fight

Measured separately because it is load-bearing for the exploit verdict: in **permanent
VANGUARD** on the two hardest stages, companion damage taken splits as **pre-boss 6,810 /
post-boss 0** (6 runs, all seeds, zero exceptions).

Companions take **no damage at all after boss spawn**. The FRONT slot's entire defensive
cost is paid during trash clear; at the boss — the climax of every stage — holding FRONT
is pure upside. This is a structural design gap independent of the difficulty problem,
and it is what makes the exploit below free.

- Evidence: `qa/evidence/g3-stance-events.json`, `qa/evidence/g3-exploit-probe.json`

### #g3 verdict input

**FIX**, on these specific measurements:

1. **Viability PASS is vacuous** — 7/7 viable, but an RPG-disabled build is equally
   viable and nothing ever came within 55% of defeat. Re-run after g2's difficulty fix.
2. **Stance differentiation is 2.37% in outcome terms** despite 0% vs 70.3% synergy
   uptake — the strategic layer's headline mechanic is near-decorative.
3. **Companion loss is unreachable** — 0 DOWNED in 300 runs makes TURRET's defensive
   identity valueless.
4. **FRONT/BACK is inert during boss phases** — 0 companion damage post-boss-spawn.

Literal thresholds (≥5 tested, ≥3 viable, ≤50% dominance) all pass on the numbers.

---

## Exploits

See `qa/exploit-register.md`. Four entries, one S2 and one latent-S2.

## Non-modification proof {#non-modification-proof}

`git status --porcelain` at close of this work shows **no modification to any
game-balance file**. `defense-catalog.js`, `rpg-catalog.js`, `defense-run-simulation.js`
and `campaign-state.js` are untouched. The only changes attributable to this agent are:

- `scripts/run-g2-archetype-rotation.mjs` (measurement harness, additive flags + recorded
  fields; verified no-op against HEAD)
- `scripts/run-g2-margin-probe.mjs`, `scripts/run-g3-stance-events.mjs`,
  `scripts/run-g3-exploit-probe.mjs` (new measurement scripts)
- `_workspace/20260725-wellmade-verification/qa/**` (this document, playtest report,
  exploit register, evidence)

Pre-existing dirty state from the in-flight rig pass (GLB binaries,
`battle-realtime-three.js`, `scripts/rig-*`, `scripts/tpose_blockout.py`,
`tests/character-rig-contract.test.mjs`) is not this agent's and was not touched.
