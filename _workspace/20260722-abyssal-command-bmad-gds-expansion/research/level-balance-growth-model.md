# Proposed deterministic level, balance, and growth model

## Purpose, status, and boundary

This is a **research target model**, not an edit to the authoritative catalog and not a gate result. It gives a future balance sheet/simulator a single quantitative starting point for health, damage, crits, cooldowns, resources, stages, Archive return, and player growth in the offline deterministic 60 Hz defense-survivor.

**No numerical value in this document is a present-build measurement.** Every number marked **Target** is unmeasured until a named fixture produces an evidence artifact. The only current facts used here are product-contract facts: single-player, offline/local-first, fixed 60 Hz rules; movement-first input with automatic basic combat/targeting; run-only skills; local persistent companions; ten campaign stages; and Canvas snapshot projection that cannot change rules. The contract gives no measured health, damage, cooldown, economy, win-rate, TTK, retention, or performance value.

| Category | Current established fact | Explicitly not established now |
|---|---|---|
| Rule authority | Fixed 60 Hz deterministic simulation; render cadence cannot alter rule ticks. | The current values or distributions of damage, health, crits, cooldowns, or stage outcomes. |
| Growth split | Run skills reset on run end; permanent companions/progress are local persistent state. | The present XP curve, offer cadence, companion power, or unlock cost. |
| Campaign | Boss victory opens the next stage; Stage 10 boss finishes the campaign. | Stage-by-stage difficulty, clear rate, time, or boss TTK. |
| Offline return | Local persistence is available; no account, network, commerce, or cloud sync is required. | Any observed idle award, session behavior, or return cadence. |

### Assumptions to falsify before adoption

1. **A1 — integer rule units:** health, damage, chance, cooldown, XP, and persistent-credit units can be represented as non-negative integers; `Q = 10,000` basis points and `T = 60` ticks/second are sufficient precision.
2. **A2 — reference fixture:** each stage can define one reproducible reference build, movement/input tape, enemy tape, and encounter mix. It is a balancing instrument, not a claim that players behave identically.
3. **A3 — power budget:** alternatives are compared at equal authored budget; a build cannot receive best-in-class health, damage, crit EV, cooldown reduction, and resource gain at once.
4. **A4 — no absence power:** active play remains the sole source of campaign completion, combat stats, run XP, skill effects, extraction, and companion acquisition. Archive credit can only advance a bounded equal-power sidegrade record.
5. **A5 — deterministic observability:** diagnostics are local, append-only, stable-key serialized, and never consume a gameplay RNG draw or mutate canonical rules state.

If an assumption fails, reject or revise the target model; do not silently compensate by editing a catalog value.

## Evidence ledger

| ID | Evidence URL / access date | What it supports | What it does **not** support |
|---|---|---|---|
| E1 | Local primary product contract: [`docs/abyssal-command-defense-survivor-design.md`](../../../docs/abyssal-command-defense-survivor-design.md), accessed 2026-07-22 | Product constraints listed above, including fixed 60 Hz, local-first, ten stages, automatic baseline combat, and run/persistent split. | Any proposed numerical target below. |
| E2 | [Glenn Fiedler, *Fix Your Timestep!*](https://gafferongames.com/post/fix_your_timestep/), accessed 2026-07-22 | Fixed-step simulation separates rule time from render time. | Universal balance bands or a browser performance result. |
| E3 | [M. E. O'Neill, *PCG: A Family of Simple Fast Space-Efficient Statistically Good Algorithms for Random Number Generation*](https://www.pcg-random.org/pdf/hmc-cs-2014-0905.pdf), accessed 2026-07-22 | A specified PRNG family can be reproduced from algorithm/state. | A requirement to choose PCG or a fair crit rate. |
| E4 | [NIST SP 800-90A Rev. 1](https://csrc.nist.gov/pubs/sp/800/90/a/r1/final), accessed 2026-07-22 | Deterministic random-bit generation is a specified technical concept. | Game balancing, cheat resistance, or persistence policy. |
| E5 | [MDN: `Window.localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), accessed 2026-07-22 | Browser local storage is origin-scoped and may be unavailable/cleared by policy or private browsing. | A trusted wall-clock or entitlement service. |
| E6 | [W3C WCAG 2.2, Understanding SC 2.2.1 Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html), accessed 2026-07-22 | Nonessential timed content needs an adjustable/avoidable timing path. | A numeric idle cap or full game conformance. |

**Research inference.** E1–E6 justify fixed-tick, versioned, auditable rules and a non-punitive local return design. The target bands below are original hypotheses, not source-derived industry standards.

## Common deterministic equations

Use a fixed rule order per `simTick`: advance cooldowns → choose target in stable entity order → consume a crit draw only for an eligible action → resolve integer damage/health/XP → update persistent transaction only at an explicit post-run boundary → emit observer events. Rendering, VFX, audio, narration, accessibility mode, and diagnostics observe these outcomes only.

```text
Q = 10_000                           // basis points
T = 60                               // simulation ticks/second
clamp(x, lo, hi) = min(max(x, lo), hi)

crit = coreRng.nextBp() < critChanceBp
multiplierBp = crit ? critMultiplierBp : Q
finalDamage = floor(preCritDamage * multiplierBp / Q)
healthAfter = clamp(healthBefore - finalDamage, 0, healthMax)

cooldownReadyTick = resolutionTick + effectiveCooldownTicks
ready = simTick >= cooldownReadyTick
effectiveCooldownTicks = max(
  floor(baseCooldownTicks * (Q - cooldownReductionBp) / Q),
  minimumCooldownTicks
)
```

The deployed catalog remains authoritative. A prospective simulator must receive a copy/versioned test fixture, never mutate a catalog entry while sweeping candidates.

## Proposed target model

### 1. Health, damage, and stage difficulty

For stage `s ∈ [1, 10]`, where `s=1` is the first campaign stage:

```text
playerHealth_s = ceil(H1 * (1 + gH)^(s - 1))
referenceDps_s = ceil(DPS1 * (1 + gD)^(s - 1))
ordinaryHealth_s = ceil(E1 * (1 + gE)^(s - 1))
incomingPressure_s = ceil(P1 * (1 + gP)^(s - 1))

ordinaryTTK_s = ordinaryHealth_s / referenceDps_s
eliteTTK_s = eliteHealth_s / referenceDps_s
survivalWindow_s = playerHealth_s / incomingPressure_s
```

| Parameter | **Unmeasured target** | Floor / cap | Hypothesis and implementation boundary |
|---|---:|---:|---|
| `H1` | 100 health units | `>= 1` | Normalization unit only; do not write it into the catalog. |
| `DPS1` | 130 damage/s | `>= 1` | Reference-build output before encounter-specific modifiers. |
| `E1` | 100 ordinary-enemy health | `>= 1` | With the reference DPS, Stage-1 ordinary TTK is `0.77 s`. |
| `P1` | 10 incoming damage/s | `>= 1` | With the target health, Stage-1 survival window is `10 s`. |
| `gH` | 10.0% per stage | **Target guardrail:** 8–13% | Player health should not grow faster than pressure without an intentional survival-window change. |
| `gD` | 10.0% per stage | **Target guardrail:** 8–13% | Includes expected active build growth, not a raw catalog stat grant. |
| `gE` | 12.5% per stage | **Target guardrail:** 10–16% | Exceeds target DPS growth slightly, making ordinary TTK rise gradually. |
| `gP` | 10.5% per stage | **Target guardrail:** 8–13% | Keeps the target survival window near 10 seconds while allowing more pressure later. |
| Elite health multiplier | `11.0 × ordinaryHealth_s` | **Target guardrail:** 8–14× | Produces a decision-sized elite rather than a common enemy with a bar. |
| Stage-10 boss multiplier | `65.0 × ordinaryHealth_10` | **Target guardrail:** choose only if TTK is 35–90 s | Applies only to the Stage-10 boss reference fixture, never every enemy. |

**Worked target checkpoints** (rounded from the equations; not measurements):

| Stage | Player health | Reference DPS | Ordinary health | Ordinary TTK | Incoming pressure | Survival window | Elite TTK |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 100 | 130 | 100 | 0.77 s | 10 | 10.00 s | 8.46 s |
| 5 | 147 | 191 | 160 | 0.84 s | 15 | 9.80 s | 9.21 s |
| 10 | 236 | 307 | 289 | 0.94 s | 25 | 9.44 s | 10.35 s |

The Stage-10 boss target is about `18,785 / 307 = 61.2 s`, inside the unmeasured 35–90 s target band. Ordinary `0.35–1.25 s`, elite `6–14 s`, and boss `35–90 s` are all research targets inherited for consistency with the separate combat-balance packet; they are not observed game performance.

### 2. Damage, crit chance, and multiplier

```text
p = critChanceBp / Q
M = critMultiplierBp / Q
expectedHitDamage = baseDamage * (1 + p * (M - 1))
critEVUplift = p * (M - 1)
variancePerHit = baseDamage^2 * p * (1 - p) * (M - 1)^2
```

| System | **Unmeasured target** | Hard constraint | Anti-runaway reason |
|---|---:|---:|---|
| Baseline crit chance | 5–15% | 0–40% | A baseline benefit should not make non-crit choices nonviable. |
| Specialized crit chance | 20–35% | 40% cap | Forces a trade against health, cooldown output, or resource gain. |
| Crit multiplier | 1.50–2.00× | 2.25× cap | Bounds single-event burst and short-window TTK variance. |
| Complete-build crit EV uplift | 8–35% vs equal-budget non-crit profile | 35% cap | Crit output is budgeted with all other output; it is not additive free power. |
| Damage modifier stack | Add each candidate modifier in bp before one final integer floor | no hidden post-floor multiplier | Defines rounding and prevents order-dependent multiplication creep. |
| Burst test | p5/p50/p95 five-hit and 100-hit damage, by fixed seed | report every candidate | A mean alone cannot approve a high-variance build. |

Target examples: `p=10%, M=1.75` gives `7.5%` crit EV uplift; `p=25%, M=1.80` gives `20.0%`; `p=35%, M=2.00` gives `35.0%`, the proposed ceiling. A complete profile at the ceiling must surrender an equivalent amount of another output axis in the same authored-budget ledger.

### 3. Skill cooldown and active-output budget

```text
abilityEVPerUse = abilityBaseDamage * (1 + p * (M - 1))
abilityEVdps = T * abilityEVPerUse / effectiveCooldownTicks
activeShare = abilityEVdps / totalBuildExpectedDps
```

| Parameter | **Unmeasured target** | Floor / cap | Measurement hypothesis |
|---|---:|---:|---|
| Decision-relevant automatic active cooldown | 60–360 ticks (1–6 s) | 30-tick / 0.5-s hard floor | It must change a route, survival, or elite/boss choice—not advertise false manual agency. |
| Total cooldown reduction | 0–25% | 25% cap pending full matrix | At the cap, a 180-tick ability becomes 135 ticks: 33.3% more uses, so it consumes power budget. |
| Cooldown-active share | 15–40% total expected DPS for a cooldown profile | 40% cap | Above the cap, one cadence risks dominating every encounter. |
| Prominent readiness | within 45 ticks / 0.75 s of ready | only when impact threshold is met | `abilityEVPerUse / relevantTargetHealth >= 10%` over a 120-tick horizon, or it changes an authored escape route. |
| Numeric countdown | only at cooldown ≥60 ticks and decision-relevant | none below 60 ticks | A shorter cadence uses a static fill/shape; it is not a player button prompt. |

### 4. Resource pace, run growth, persistent growth, and Archive return

Resource labels below are **normalised model units**, not existing catalog currencies or prices.

```text
xpToNextLevel(L) = ceil(100 * 1.18^(L - 1))
runBudgetAtLevel(L) = 100 * (L - 1) budget points
sidegradeBudget = activeEarned + archiveCredit
archiveCredit = activeSealValueAtIssue * 0.20 * acceptedHours / 12
acceptedHours = clamp((resumeWallMs - permitIssuedWallMs) / 3_600_000, 0, 12)
```

| Growth surface | **Unmeasured target** | Floor / cap | Required boundary |
|---|---:|---:|---|
| XP step curve | `+18%` XP requirement per level | must remain positive; recalibrate from fixture time | This is an offer-pacing hypothesis, not a retention objective. |
| Core-loop offer cadence | 1 meaningful reward event per 30–180 s loop | never an unannounced automatic pick | The exact offer count follows measured run duration/XP, not a hidden calendar rule. |
| Per-run option budget | +100 normalised points per accepted level | compare equal-budget profiles only | A selection may trade axes; it cannot increase every axis. Run-only effects reset on run end. |
| Permanent companion / sidegrade growth | equal-power tactical variation | zero direct raw health, damage, crit, rate, or armor gain without a new approved model | It cannot invalidate the reference stage model by accumulating combat stats. |
| Archive permit | one permit after an eligible active-run conclusion | one unsettled permit maximum | App open/reopen does not mint a permit. |
| Archive absence window | linear 0–12 h | 12-h cap; negative/invalid time = 0 | A cap limits inflation; it is not a daily appointment. |
| Archive contribution | at most 20% of an active sidegrade record | active contribution >=80% plus active confirmation | No XP, combat stat, boss, extraction, companion, stage, or ending mutation. |
| Mechanical idle randomness | none | 0% | No loot table, streak, reroll, multiplier, or hidden eligibility factor. |

A model candidate may be tuned only if it preserves the active/persistent split. It must not persist a run skill, XP level, current combat layout, unchosen offer, or combat RNG position as Archive growth.

### 5. Stage difficulty composition

The growth curves set a baseline; encounter composition creates the local difficulty without changing the global model mid-run.

| Stage tier | **Unmeasured target composition** | Difficulty control | Must not do |
|---|---|---|---|
| 1–3: teach | ordinary pressure near `P_s`; at most one target elite in reference tape | readability and route learning | Hide a catalog-stat spike behind an untelegraphed first elite. |
| 4–6: combine | ordinary pressure plus one overlapping route constraint | increase hazard choice before raw health | Raise both enemy HP and pressure beyond target bands simultaneously without a TTK/survival rationale. |
| 7–9: mastery | pressure near `P_s`; elite timing tests cooldown/route interaction | test tradeoffs and archetype viability | Require a crit burst or one specific companion to clear. |
| 10: finale | boss multiplier plus phase-specific fixed tape | keep boss TTK and survival evidence separately reported | Treat normal-enemy TTK as evidence for boss fairness. |

Every stage fixture must retain a versioned encounter tape, stable spawn/entity order, seed, input tape, rule revision, and target build. Stage difficulty is an authored fixture property; adaptive difficulty based on wall time, device speed, observer mode, or account/session data is outside this model.

## Caps, floors, and anti-runaway constraints

| Failure mode | Constraint | Deterministic assertion |
|---|---|---|
| Multiplicative stat inflation | Compare each complete build with the same total budget; enforce crit EV ≤35%, CDR ≤25%, cooldown-active share ≤40%. | Candidate ledger sum equals reference budget; no axis is a free add-on. |
| Survivability erases movement | Keep reference `survivalWindow_s` in target 7–12 s and health growth within 8–13%. | `H_s / P_s` recorded by stage; a profile outside band is rejected or documented as an exception. |
| Enemy sponge escalation | Keep ordinary/elite/boss target TTK bands distinct. | `ordinary 0.35–1.25 s`, `elite 6–14 s`, `Stage-10 boss 35–90 s` in each fixed fixture. |
| Crit burst dominates | Crit chance ≤40%, multiplier ≤2.25×, EV uplift ≤35%; report distribution, not just mean. | 10,000-seed sweep exports p5/p50/p95 and longest drought for every crit profile. |
| Cooldown loop runaway | CDR ≤25%; cooldown ≥30 ticks; output share ≤40%. | Boundary fixtures at base, cap, one-bp-over-cap, and floor cannot produce duplicate/early uses. |
| Resource / choice snowball | Equal run budget per level; option budget must trade axes. | Choice application diff is attributable to the selected option and total assigned budget remains fixed. |
| Idle becomes optimal progression | One permit; 12-h cap; ≤20% credit share; active confirmation required. | Reopen/clock matrix produces at most one receipt and no combat-field diff. |
| Calendar/FOMO pressure | No decay, streak, notification, daily reset, loss multiplier, or missed-reward condition. | Fixture has zero timed-notification/deadline dependencies and late return receives the same capped receipt. |
| Presentation changes rules | Observer mode can neither write state nor read/advance core RNG. | Canonical checkpoints, RNG state, offer IDs, and persistent totals are byte-identical under 30/60/120 Hz and observer variants. |

## Sensitivity analysis — target-only calculations

These calculations show which assumptions require the earliest sweep. They are not runtime observations.

| One-variable perturbation | Stage-10 / system effect from formula | Interpretation and decision rule |
|---|---:|---|
| `gH: 10% → 8%` | `1.10^9 = 2.36×` becomes `1.08^9 = 2.00×` (−15.3% Stage-10 health versus baseline). | If `gP` stays 10.5%, survival window contracts; retune only after fixture evidence. |
| `gH: 10% → 12%` | `2.36× → 2.77×` (+17.4%). | Raises error forgiveness; reject if survival window exceeds 12 s. |
| `gE: 12.5% → 10.5%` | `1.125^9 = 2.89×` becomes `1.105^9 = 2.46×` (−14.9% enemy health). | Ordinary TTK may flatten or fall; use when the intended late-stage pressure is composition-led. |
| `gE: 12.5% → 14.5%` | `2.89× → 3.38×` (+16.9%). | Risks a sponge curve; reject if ordinary/elite/boss TTK leaves its respective band. |
| Crit: `10%, 1.75× → 35%, 2.00×` | Expected uplift `7.5% → 35.0%` (+27.5 pp). | Requires removing 27.5 percentage points of equivalent expected output/survival budget; otherwise it is runaway growth. |
| CDR: `0 → 25%` on 180 ticks | 180 → 135 ticks; uses/s `0.333 → 0.444` (+33.3%). | The 25% stated reduction is a one-third cadence-output increase; budget it as such. |
| Archive share: `20% → 25%` | Passive share exceeds active 80/20 split. | Reject without an explicit revised G5 fairness decision; 25% conflicts with this model. |
| Idle cap: `12 h → 24 h`, same max value | Half the hourly accrual rate, same inflation ceiling. | Test comprehension/obligation rather than assume a cadence effect; retain whichever has no target breach. |

### Required two-way sweeps

Do not approve one-dimensional optimums. Sweep these pairs over fixed seeds and encounter tapes:

1. `gE × gD`: preserve ordinary TTK while varying late-stage pressure.
2. `gH × gP`: preserve the survival window while testing route-error forgiveness.
3. `critEV × cooldownActiveShare`: reject combinations over either EV cap even if their mean total DPS matches.
4. `ArchiveCredit × active-sidegrade state`: test 0 versus maximum eligible credit with otherwise identical active-earned state.
5. `stage composition × archetype`: no archetype may be approved from a stationary-target or one-stage-only result.

## Deterministic measurement plan

### Preregistration and fixture contract

Before any sweep, freeze a `rulesRevision`, fixture IDs, target grid, seed list, stable entity ordering, input tape, simulator build hash, and the equations/caps above. Publish the exact sampling plan in the future QA evidence packet; candidate changes receive a new version and do not overwrite old results.

| Phase | Fixed inputs | Required outputs | **Target acceptance hypothesis** | Evidence destination |
|---|---|---|---|---|
| Unit algebra | Boundary values for 0, 1, max, one-bp-over-cap, and overflow-safe limits | integer health/damage/cooldown/XP/idle results | 100% equation agreement; no negative state; all caps/floors bind exactly | `qa/gate-measurements.md#g2` future fixture export |
| Stage reference sweep | Stages 1–10, reference build, enemy/pressure tapes | ordinary/elite/boss TTK and survival window | TTK bands and 7–12-s survival window are met or exception is explicit | `qa/gate-measurements.md#g2`, simulation logs |
| Archetype matrix | At least five equal-budget profiles and at least five tested archetypes | win rate, completion, damage, resource use, p5/p50/p95 | G2 matchup result 45–55%; G3 ≥3 viable and no >50% dominance | `qa/playtest-report.md`, per-archetype table |
| Crit sweep | 10,000 fixed seeds × 100 eligible actions per profile | mean, p5/p50/p95 count/damage, longest drought, combo TTK | expected formula agrees; no claim that a frequency target passed until export exists | sim logs plus `replay_checkpoint` stream |
| Cooldown boundary | `C−1`, `C`, `C+1`; 0/cap/over-cap reduction; target-loss cases | ready ticks, uses, active share | no early/duplicate use; floor/cap exact; output share 15–40% for cooldown profile | G2 fixture report |
| Resource/choice | fixed XP/offer seed, every option, stale/repeated input | offer IDs/order, before/after budget and rule hash | one valid choice, equal budget, no persisted run state | `qa/gate-measurements.md#g5` |
| Archive faults | 0/2/12/24 h, negative/future clock, storage denied/corrupt, 100 reopen attempts | receipt, persistent before/after, idempotency key | 100% recomputation/idempotency; zero invalid award; no combat-field mutation | G5 transaction/property-test export |
| Cross-observer replay | same seed/input at 30/60/120 Hz, normal/reduced motion, observer A/B, save/load checkpoint | canonical hash/RNG state/offer IDs/persistent totals | byte-identical canonical checkpoints; zero observer rule writes | G2/G5/G6/G7 determinism export |

All diagnostics remain local-only and optional-user-exportable. Minimum envelope: `schema_version`, `rules_revision`, `fixture_id`, `seed_hash`, `sim_tick`, canonical checkpoint hash, input cursor, stage, archetype/build ID, observer mode, and stable sequence number. Add `damage_resolved`, `cooldown_set`, `cooldown_ready`, `choice_offered`, `choice_committed`, `idle_accrual_calculated`, `idle_claim_committed`, and `replay_checkpoint` records as applicable. Do not add accounts, analytics transport, network requests, or commerce to satisfy this plan.

## Exact G1–G8 gate metric mapping

This table maps the model to the harness contract exactly. A mapping is **not** a verdict. Only QA-measured values plus the named evidence path can support PASS/FIX/REDO.

| Gate | Harness metric / threshold | Model metric and fixture | Stage relevance | Status here |
|---|---|---|---|---|
| G1 narrative consistency | 0 un-waived lore violations; 100% shipped strings/effects/scenarios trace to worldview. | No balance number is a direct G1 metric. If Stage-10 phase names/copy are added, trace them separately; numeric curves cannot prove lore. | Stage 1 draft; Stage 3 final | Out of direct scope; no claim. |
| G2 rules and balance | 100% mechanics covered in balance sheet; matchup win-rates 45–55%; TTK ±15% of target; no combo pair >1.3× median EV. | Health/damage/crit/cooldown formulas; reference TTK; 10,000-seed crit distribution; five-profile equal-budget sweep; combo EV ratio. | **Stage 2** | All values are targets awaiting fixture evidence. |
| G3 player-type diversity | ≥3 independently viable archetypes; no archetype >50% optimal-play dominance; ≥5 archetypes tested. | Five equal-budget profile matrix, stage-composition × archetype sweep, profile win/completion data. | **Stage 2** | Targets only; no archetypes measured. |
| G4 immersion | median immersion ≥4.0/5; feedback latency ≤100 ms; 0 unresolved S1/S2 readability complaints. | This model supplies only the target cooldown/health semantic inputs; feedback testing belongs to feedback QA. | **Stage 3** | Indirect dependency only; no measured latency or score. |
| G5 revenue–balance synergy | paid/free win-rate delta ≤5 pp; instant-reversal probability ≤30%/activation with cap/cooldown; free-path parity 10–20 sessions; signed record for every revenue point. | No paid path is allowed. Use active-vs-Archive matched 10/20-session parity: completion/boss rate delta ≤5 pp, median clear/boss-time ±15%, Archive share ≤20%, active share ≥80%, 0 combat-field mutations. Any comeback mechanic must be separately modeled and respect the ≤30% harness cap. | **Stage 2** | Targets only; no cohort, session, or parity results. |
| G6 operations | telemetry contract implemented; rollback tested; release checklist 100%; p95 frame ≤16.7 ms, long frames <0.5%, memory stable for 30 min, input ≤100 ms. | Versioned local fixture/event export and 30/60/120-Hz differential replay support observability. Performance values require engineering/QA measurement, not this paper model. | Stage 1 ops draft; **Stage 3 final** | No runtime/performance claim. |
| G7 core loop | ≥1 loop; 30–180 s period; ≥3 actions/loop; ≥1 reward/loop; repeat proxy ≥70%. | XP/offer resource pacing is a candidate reward event. Verify loop duration and three actions with a real tape; the `+18%` XP curve is not evidence of a loop. | Stage 1 draft; **Stage 2 final** | Target only; repeat-rate unmeasured. |
| G8 novelty | ≥1 element in ≤2 of ≥5 surveyed comparables and QA impression ≥4/5. | No direct balance metric. The deterministic fixed-point Archive receipt is a candidate implementation detail, not a novelty claim. | **Stage 2** | Out of direct scope; no frequency/impression claim. |

## Handoff and implementation boundaries

1. **Do not edit `defense-catalog.js`, runtime sources, or tests from this model.** Adopt only after a separate design decision names a rules revision, catalog diff, migration/rollback path, and fixture evidence.
2. Keep the simulator behind a read-only fixture adapter. It can load catalog snapshots and emit proposals/reports, but it must not write back candidate values.
3. Implement active/persistent state partitions explicitly. Run skills, XP level, offers, active cooldown/RNG state, and combat layout do not become Archive growth; the Archive receipt does not advance combat RNG or the 60 Hz clock.
4. Treat a first divergent checkpoint tick, an over-cap candidate, an out-of-band TTK, or an unbudgeted axis as a failed hypothesis with its fixture/seed attached—not as a reason to weaken a threshold retroactively.
5. Any future numerical override requires an explicit decision-log entry, a versioned fixture sweep, G2/G3/G5 impact assessment as applicable, and QA evidence. This packet authorizes neither a catalog change nor a gate PASS.
