# Balance sheet — deterministic combat targets

**Status:** every number in this sheet is a **UNVERIFIED TARGET**. No gate is passed, no value is measured, and this document does not alter `defense-catalog.js` or define runtime implementation.

## Rules model and formula guard

All combat arithmetic is proposed in integer units at 60 Hz. `Q = 10_000` basis points; `D` is pre-critical integer damage; `c` is critical chance in bp; `m` is critical multiplier in bp; `tick` is an integer simulation tick.

```text
crit = versionedCritScheduler.nextBp() < c
multiplierBp = crit ? m : Q
finalDamage = floor(D * multiplierBp / Q)
healthAfter = clamp(healthBefore - finalDamage, 0, healthMax)
ready(tick) = tick >= cooldownReadyTick
cooldownReadyTick = resolutionTick + cooldownTicks

survivalWindow_s = H_s / P_s
H_s = ceil(H_1 * (1 + g_H)^(s - 1))
enemyHealth_s = ceil(E_1 * (1 + g_E)^(s - 1))

expectedHitDamage = D * (1 + (c / Q) * ((m - Q) / Q))
critEVUplift = (c / Q) * ((m - Q) / Q)
abilityEVPerUse = A * (1 + p * (M - 1))
abilityEVdps = 60 * abilityEVPerUse / cooldownTicks
nextHorizonImpact = abilityEVPerUse / targetHealthAtDecision
```

**EV guard — UNVERIFIED TARGET:** compare complete builds at equal authored power budget, including all resolved cooldown output and any conditional/multi-hit behavior. A crit path cannot receive best-in-class health and cooldown at the same time. If a critical deck is selected, report empirical combo p5/p50/p95 by seed/deck position; do not apply independent-draw variance formulas to deck results.

## Gate-target YAML

```yaml
system: expanded-defense-survivor
data_mirror: "defense-catalog.js (future data synchronization; no current runtime change)"
win_rate_band: [0.45, 0.55]
ttk_target_s: 60
ttk_tolerance: 0.15
combo_ev_cap_vs_median: 1.30
artifact_contract:
  schema_version: artifact-contract/1
  artifact_id: design.balance-sheet
  artifact_path: design/balance-sheet.md
  gate: G2
  status: unverified_target_only
  current_gate_status: unpassed
  evidence_paths:
    deterministic_sweep: qa/gate-measurements.md
    archetype_fixture: qa/test-plan.md
    local_event_trace: ops/telemetry-contract.md
balance_sheet:
  status: unverified_target_only
  gate_status: unpassed
  authority:
    rules_authority: defense-catalog.js
    simulation_hz: 60
    presentation: observer_only
    arithmetic: integer_units_and_basis_points
  health:
    survival_window_seconds:
      target_band: [7, 12]
      status: unverified
    player_health_growth_per_stage_percent:
      target_band: [8, 13]
      status: unverified
    ordinary_enemy_health_growth_per_stage_percent:
      target_band: [10, 16]
      status: unverified
    ordinary_enemy_ttk_seconds:
      target_band: [0.35, 1.25]
      status: unverified
    elite_ttk_seconds:
      target_band: [6, 14]
      status: unverified
    stage_10_boss_ttk_seconds:
      target_band: [35, 90]
      status: unverified
    state_labels:
      target_breakpoints_percent: [35, 15]
      labels: [stable, pressured, critical]
      status: unverified
  critical:
    baseline_chance_percent:
      target_band: [5, 15]
      status: unverified
    specialist_chance_percent:
      target_band: [20, 35]
      hard_cap: 40
      status: unverified
    multiplier:
      target_band: [1.5, 2.0]
      hard_cap: 2.25
      status: unverified
    complete_build_ev_uplift_percent:
      target_band: [8, 35]
      status: unverified
  cooldown:
    automatic_active_ticks:
      target_band: [60, 360]
      status: unverified
    hard_floor_ticks:
      target: 30
      status: unverified
    readiness_lead_ticks:
      target: 45
      status: unverified
    prominent_readiness_minimum_horizon_impact_percent:
      target: 10
      horizon_ticks: 120
      status: unverified
    cooldown_reduction_cap_percent:
      target: 25
      status: unverified
    cooldown_focused_ev_share_percent:
      target_band: [15, 40]
      status: unverified
  feedback:
    player_and_gate_state: persistent_edge_hud_with_non_color_label
    common_enemy_persistent_bars: prohibited
    source_event_to_feedback_agreement_percent:
      target: 100
      status: unverified
  validation:
    replay_hashes_equal_across_observer_modes:
      target: true
      status: unverified
    evidence_paths:
      - qa/gate-measurements.md
      - qa/test-plan.md
      - ops/telemetry-contract.md
```

## Five-archetype comparison matrix

These are analytic profiles—not characters, promised choices, or content classes. Every cell is a **UNVERIFIED TARGET** evaluated at equal authored power budget.

| Profile | Health target | Critical target | Cooldown / cadence target | Intended counterweight and EV guard |
| --- | --- | --- | --- | --- |
| **Bulwark** | `1.25–1.40×` reference | `p=5–10%`, `M=1.5–1.7` | Active `240–360` ticks | Longer window must buy route correction, not hazard immunity; low variance supports sustained output. |
| **Striker** | `0.90–1.05×` | `p=10–20%`, `M=1.5–1.8` | Passive cadence `18–45` ticks; no prominent per-shot timer | Many trials stabilize variance; do not present micro-cadence as false agency. |
| **Gambit** | `0.85–1.00×` | `p=25–35%`, `M=1.8–2.0` | Active `120–240` ticks | Critical uplift consumes budget; health and cooldown cannot also lead. Test droughts and burst TTK, not mean damage only. |
| **Conductor** | `0.95–1.10×` | `p=10–20%`, `M=1.5–1.8` | Active `60–150` ticks | Cooldown output target share is `15–40%`; prominence is justified only near route/elite decisions. |
| **Rift hybrid** | `0.90–1.05×` | `p=15–25%`, `M=1.7–1.9` | Setup `90–210` ticks | Evaluate missed, retargeted, and moving-target cases; no perfect-stationary-target approval. |

## Phase 2b G2 measurement-fixture decision — designer sign-off

**Decision status:** **SIGNED — measurement instrumentation only (designer, 2026-07-22).** This authorizes the following five **analytic QA fixtures** under one equal-budget ID. It does **not** approve a combat retune, player-facing classes, content selection, or a G2 result. XR-13 established that the current catalog has no five-profile equal-budget surface; XR-14 established that its current event stream cannot reconstruct ordinary active-skill EV/cooldown share. Both remain measurement blockers until the named fixture and observer evidence exist. **G2 remains NOT MEASURED / NOT PASSED.**

### Boundary from the current runtime

- The current runtime remains unchanged: `COMMANDER.maxIntegrity=1000`, `basicDamage=900`, `basicCooldown=24`, `critProfile.chanceBp=1500`, and `critProfile.multiplierBp=20000`. The fixture values below are catalog-owned measurement inputs for a future QA-only `createDefenseRun` selection path; they must not be used by normal application construction.
- “Equal budget” means equal **authored measurement ledger** allocation, not measured equal DPS, TTK, survival, EV, or fun. XR-14 is precisely why those outcomes are not asserted here.
- Each fixture suppresses companions, item pickups, reward modifiers, and hidden pre-run modifiers. Its single listed skill is the entire loadout. Input tape, seed/MapKey, stage/objective, starting state, catalog digest, and observer modes remain common controlled variables owned by QA.
- `fixtureActiveCooldownTicks` is a measurement input, never a player-facing timer promise. It is finite, at or above the 30-tick hard floor, and its source-skill reference preserves catalog compatibility. Only Conductor requires a fixture-only override: `shadow-step`'s current 210-tick catalog cooldown becomes 120 ticks solely inside this measurement definition.

### Authorized equal-budget ledger

```yaml
fixture_budget:
  id: g2-measurement-fixture-budget-v1
  total_authored_budget_units: 1000
  ledger_categories:
    health: max_integrity_only
    critical: chance_bp_and_multiplier_bp_only
    cadence: basic_damage_and_basic_cooldown_ticks_only
    active: one_skill_id_damage_radius_integrity_and_fixture_cooldown_only
  common_inputs:
    basic_damage: 900
    companion_id: null
    item_ids: []
    reward_modifier_ids: []
    cooldown_reduction_bp: 0
    manual_aim: false
  invariant: "health + critical + cadence + active = 1000 for every fixture"
  non_claims:
    - not_a_runtime_cost_model
    - not_a_measured_ev_or_ttk_equivalence
    - not_a_player_facing_build_or_balance_approval
```

### Numeric measurement fixtures

All values are finite integers. `critEVUpliftPercent` is a formula check only: `100 * chanceBp / 10000 * (multiplierBp / 10000 - 1)`. It does not include basic cadence, skill output, target availability, or integrity value; it is not a total-build EV result.

| Fixture | Ledger ABU (`H/C/Cd/A`) | Health inputs | Critical inputs | Cadence inputs | Active/cooldown inputs | Loadout and catalog compatibility | Formula check |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| **Bulwark** | `400 / 100 / 200 / 300 = 1000` | `maxIntegrity=1250` | `chanceBp=500`, `multiplierBp=15000` | `basicDamage=900`, `basicCooldownTicks=30` | `void-aegis`; `damage=0`, `integrity=50`, `fixtureActiveCooldownTicks=300` | Existing `void-aegis` damage/integrity/cooldown values (`0/50/300`) are retained; no companion/items/modifiers. | `2.5%` crit-only uplift |
| **Striker** | `200 / 200 / 400 / 200 = 1000` | `maxIntegrity=1000` | `chanceBp=1500`, `multiplierBp=17000` | `basicDamage=900`, `basicCooldownTicks=18` | `soul-lance`; `damage=1200`, `integrity=0`, `fixtureActiveCooldownTicks=270` | Existing `soul-lance` damage/cooldown (`1200/270`) retained; high-rate automatic cadence is analytic only; no companion/items/modifiers. | `10.5%` crit-only uplift |
| **Gambit** | `100 / 400 / 200 / 300 = 1000` | `maxIntegrity=900` | `chanceBp=3000`, `multiplierBp=19000` | `basicDamage=900`, `basicCooldownTicks=30` | `grave-pulse`; `damage=650`, `radius=3000`, `integrity=0`, `fixtureActiveCooldownTicks=240` | Existing `grave-pulse` damage/radius/cooldown (`650/3000/240`) retained; no companion/items/modifiers. | `27.0%` crit-only uplift |
| **Conductor** | `200 / 150 / 150 / 500 = 1000` | `maxIntegrity=1000` | `chanceBp=1500`, `multiplierBp=17000` | `basicDamage=900`, `basicCooldownTicks=24` | `shadow-step`; `damage=900`, `radius=4500`, `integrity=0`, `fixtureActiveCooldownTicks=120` | Existing `shadow-step` damage/radius (`900/4500`) retained. Its catalog cooldown is `210`; the `120` value is the explicitly scoped fixture-only cooldown override. No companion/items/modifiers. | `10.5%` crit-only uplift |
| **Rift** | `150 / 250 / 250 / 350 = 1000` | `maxIntegrity=1000` | `chanceBp=2000`, `multiplierBp=18000` | `basicDamage=900`, `basicCooldownTicks=30` | `shadow-step`; `damage=900`, `radius=4500`, `integrity=0`, `fixtureActiveCooldownTicks=210` | Existing `shadow-step` damage/radius/cooldown (`900/4500/210`) retained; no companion/items/modifiers. | `16.0%` crit-only uplift |

**Designer authorization:** Catalog may define these tuples only under `g2-measurement-fixture-budget-v1`, and QA may select them only in the future deterministic fixture path. Instrumentation must emit observer-safe active-skill resolution records sufficient to reconcile `source`, `target`, `baseDamage`, `finalDamage`, `sim_tick`, cooldown identity, and readiness tick without changing canonical simulation state. No normal-run source, economy/progression value, presentation state, G8 evidence, or current balance number is authorized to change by this decision.

## Stage 2 proposal — deterministic measurement and retune contract

**Proposal status:** **NOT AUTHORIZED FOR RUNTIME OR CATALOG CHANGE.** Every number in this section is a **TARGET / future measurement**, not an observation. **Observed result:** **NOT MEASURED** for every row; G1–G8 remain **NOT MEASURED / NOT PASSED**. A completed matrix row is future QA evidence, not an automatic tuning approval.

### Scope, authority, and source anchors

- **Fixed-profile scope:** measure only the five analytic, equal-budget fixtures already defined above—Bulwark, Striker, Gambit, Conductor, and Rift—using their listed finite inputs. The fixture path suppresses companions, items, reward modifiers, manual aim, and hidden pre-run modifiers. It is not a player-facing class, normal-run loadout, or a measured parity claim.
- **Fixed deterministic scope:** freeze `rulesRevision`, fixture ID, catalog digest, simulator build hash, seed list, MapKey, stable entity order, stage/objective, starting state, enemy/pressure tape, and input tape before a sweep. Resolve at **60 Hz integer simulation ticks**; render, HUD, audio, VFX, reduced-motion mode, and diagnostics remain observer-only. A prospective simulator reads a versioned catalog snapshot and never writes it back.
- **Catalog authority:** `defense-catalog.js` remains the sole authored rules authority. The existing fixture-only values above are measurement inputs only; this proposal neither adopts them nor changes a normal run.
- **Target versus observation rule:** retain `TARGET` on every proposed band and add `OBSERVED` only beside a dated QA export that names the frozen fixture identity. Formula examples, fixture inputs, and a passing algebra assertion are not observed combat, economy, retention, or gate results.

| Source anchor | Bounded use in this proposal |
| --- | --- |
| [`research/combat-systems-balance.md#L30-L58`](../research/combat-systems-balance.md#L30-L58), [`#L155-L167`](../research/combat-systems-balance.md#L155-L167) | Fixed tick order, integer health/crit/cooldown resolution, and deterministic combat measurement cases. |
| [`research/level-balance-growth-model.md#L16-L24`](../research/level-balance-growth-model.md#L16-L24), [`#L217-L234`](../research/level-balance-growth-model.md#L217-L234) | Assumptions to falsify, read-only fixture discipline, and preregistered sweep/export requirements. |
| [`research/level-balance-growth-model.md#L80-L101`](../research/level-balance-growth-model.md#L80-L101), [`#L113-L138`](../research/level-balance-growth-model.md#L113-L138) | Health, TTK, crit, and cooldown targets are unmeasured hypotheses. |
| [`research/progression-idle-economy.md#L46-L76`](../research/progression-idle-economy.md#L46-L76), [`#L115-L123`](../research/progression-idle-economy.md#L115-L123) | One-settlement Archive permit, 0–12-hour/20% target envelope, active-only power boundary, and future property/comprehension tests. |

### Deterministic measurement matrix

| Metric | **TARGET / future measurement** | Fixed fixture and deterministic method | Owner | Future evidence path | Blocking/deferred condition — catalog change prohibited when |
| --- | --- | --- | --- | --- | --- |
| Health arithmetic and movement survival | `100%` health-event reconciliation; reference `survivalWindow_s = H_s / P_s` in `7–12 s` for every measured stage/profile. | At 60 Hz, replay fixed stage 1–10 pressure tapes for all five profiles; reconcile integer `before`, `finalDamage`, `after`, healing, and `sim_tick` against canonical checkpoints. | QA measurement owner; game designer owns any later retune recommendation. | `qa/gate-measurements.md#g2-health`; fixed-seed health-event export. | Any unreconciled event, non-integer/unstable tick result, missing controlled input, or out-of-band survival window. |
| Stage and level scaling | Player-health growth `8–13%`/stage, ordinary-enemy-health growth `10–16%`/stage; level offers remain equal-budget tradeoffs, with the `+18%` XP step curve only a target model. | Freeze stage tape and reference build; calculate `H_s`, `E_s`, pressure, XP/offer ledger, and before/after budget diff in integer units. Compare all stages, never a Stage-10-only mean. | Game designer. | `qa/gate-measurements.md#g2-stage-scaling`; `qa/gate-measurements.md#g5-resource-choice`. | A profile receives free multi-axis growth, a budget diff cannot be attributed to one choice, a stage is absent, or a growth/pressure result lacks its frozen tape. |
| Ordinary, elite, and Stage-10 time-to-kill | Ordinary `0.35–1.25 s`; elite `6–14 s`; Stage-10 boss `35–90 s`; all are targets, not current combat times. | For each fixed profile and stage/objective tape, record integer resolution ticks from eligible engagement to defeat and convert only as `ticks / 60`; report mean and p5/p50/p95 where crit applies. | QA measurement owner; game designer evaluates tradeoffs. | `qa/gate-measurements.md#g2-ttk`; per-profile replay checkpoint export. | A target type, profile, stage, seed distribution, or 60 Hz conversion is missing; any target band fails; or a result uses observer/render time. |
| Critical chance, multiplier, and distribution | Baseline chance `5–15%`; specialist `20–35%` with `40%` cap; multiplier `1.50–2.00×` with `2.25×` cap; complete-build crit EV uplift `8–35%`. | Use one declared versioned scheduler only; run `10,000` fixed seeds × `100` eligible actions/profile. Record chance, multiplier, draw/deck position, final damage, five-hit p5/p50/p95, TTK distribution, and longest drought. | QA measurement owner; game designer owns future profile retune. | `qa/gate-measurements.md#g2-critical`; `ops/telemetry-contract.md#damage_resolved`; replay checkpoints. | Scheduler/version or draw position is absent; deck and independent-draw statistics are conflated; a cap or equal-budget constraint fails; or only mean DPS is reported. |
| Automatic cooldown, readiness, and active-output share | Active cooldown `60–360` ticks, floor `30` ticks, reduction cap `25%`, cooldown-profile active EV share `15–40%`; prominent readiness only within `45` ticks and only for `>=10%` next-`120`-tick relevant-target impact or an authored survival route. | Test `C-1`, `C`, `C+1`, zero/cap/one-bp-over-cap reduction, target loss, and observer variants at 60 Hz. Record integer ready tick, use count, effective cooldown, active EV, and route counterfactual. | QA measurement owner; game designer owns future retune/readiness recommendation. | `qa/gate-measurements.md#g2-cooldown`; `ops/telemetry-contract.md#cooldown_ready`; route replay export. | An early/duplicate use, floor/cap miss, observer-mode difference, missing counterfactual, false-manual-agency presentation, or active-share breach occurs. |
| Observer and catalog-authority invariance | Canonical state, RNG/deck position, health, cooldown ready ticks, offers, and persistent totals are byte-identical across 30/60/120 Hz rendering and normal/reduced/muted/dropped-observer modes. | Replay the same frozen inputs under each observer mode; compare canonical checkpoint hashes and catalog digest while prohibiting observer writes and RNG reads. | QA measurement owner; programmer supplies a future read-only fixture adapter. | `qa/gate-measurements.md#g2-observer-invariance`; `ops/telemetry-contract.md#replay_checkpoint`. | Any hash, RNG/deck, rules-state, or digest divergence occurs; a simulator writes a catalog entry; or the fixture adapter is not demonstrably read-only. |
| Archive idle-return fairness | One active-issued, one-settlement permit; linear `0–12 h` accepted absence; credit `<=20%` of active record value; active contribution `>=80%`; `0` combat XP/stat/stage/boss/extraction/ending/companion mutation. | Use cloned-save property fixtures at `0/2/12/24 h`, negative clock, storage fault, and `100` reopen attempts; compare before/after allowlisted save fields and paired 10-/20-session equal-active-state fixtures. | QA measurement owner; game designer owns future progression retune recommendation. | `qa/gate-measurements.md#g5-archive`; local receipt/property-test export; `qa/playtest-report.md#g5-parity`. | More than one settlement, a clock/reopen recomputation, credit over cap, absent-player combat-power mutation, missing active confirmation, no-FOMO violation, or unmeasured parity/comprehension result. |

### Retune and catalog-change prohibition

1. **Current prohibition:** do not alter `defense-catalog.js`, its normal-run consumers, runtime balance values, save schema, or tests from this proposal. The fixture-only authorization above does not waive this prohibition.
2. **Future evidence prerequisite:** a catalog candidate remains prohibited until every affected matrix row has an immutable, locally stored QA export at its named evidence path, with frozen inputs, catalog digest, rules revision, seed list, and observed results explicitly labeled. A target without that export is unresolved, not “close enough.”
3. **Determinism prerequisite:** prohibit a candidate if a 60 Hz algebra, replay checkpoint, observer-invariance, cooldown boundary, or critical-scheduler assertion fails. Do not compensate by changing a catalog number or relaxing a target after observing the failed seed.
4. **Progression prerequisite:** prohibit a candidate if an Archive outcome changes combat authority or if active-only confirmation, `<=20%` credit share, `>=80%` active share, paired-session parity, or no-FOMO evidence is incomplete. Archive accounting never advances the 60 Hz clock or combat RNG.
5. **Decision prerequisite:** even if future measurements meet targets, no catalog change occurs without a separate explicit design decision that names the candidate rules revision, exact catalog diff, rollback/migration plan, affected G2/G3/G5 evidence, and QA verification scope. No present gate verdict is implied.

## Feedback constraints bound to balance

- Player health and W-03 Gate Integrity are persistent, distinct edge-HUD states: fill plus text/icon/pattern. The **UNVERIFIED TARGET** state bands are stable/pressured/critical at 35%/15%.
- Only selected elite/boss targets receive persistent target health detail. Common-enemy health bars are prohibited as a required information layer.
- A critical is a post-resolution result. It uses a static non-color fracture-ring/`CRIT` identity in reduced motion and can never change damage, RNG, cooldown, or target selection.
- A cooldown becomes prominent only if its next 120 ticks plausibly change an elite/boss decision by at least the target horizon impact or changes an authored survival route. Numeric display is reserved for decision-relevant cooldowns of 60 ticks or more.
- Presentation may smooth bars or animate readiness after observation, but it may not read render time, animation completion, audio state, or accessibility mode to produce arithmetic.

## Required future falsifiers

| Target claim | Failure condition | Required evidence path | Current status |
| --- | --- | --- | --- |
| Health is internally truthful and readable. | Any unresolved delta, out-of-range value, or health state that lacks text/shape in reduced motion. | `qa/gate-measurements.md` plus fixed-seed health snapshots. | **UNPASSED** |
| Critical feedback is truthful. | A crit label without a resolved crit, a resolved crit without linked feedback, or divergent observer-mode hash. | Forced crit/non-crit traces and event-to-feedback joins. | **UNPASSED** |
| Cooldown feedback earns attention. | It does not meet the EV/route-impact condition, or it obscures movement/telegraphs. | Archetype replay matrix and capture masks. | **UNPASSED** |
| Archetypes retain tradeoffs. | Any profile exceeds EV, survival, and cadence budget simultaneously. | Equal-budget spreadsheet/simulator plus p5/p50/p95 report. | **UNPASSED** |

## Research basis

- `research/combat-systems-balance.md`
- `research/combat-feedback-controls.md`
- `research/vfx-hud-feedback.md`
- `research/qa-measurement-protocol.md`
- `research/telemetry-playtest-contract.md`
- `.survey/abyssal-command-systems-expansion/{context,solutions}.md`
- Current product contract: `_workspace/20260722-defense-survival-expansion/design/gameplay-contract.md`
