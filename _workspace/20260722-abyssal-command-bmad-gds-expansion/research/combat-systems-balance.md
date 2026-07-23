# Deterministic health, critical-hit, and cooldown balance model

## Research question and scope

How should a deterministic 60 Hz, movement-first automatic-combat game make health, critical outcomes, and cooldown cadence legible while keeping combat resolution reproducible and keeping presentation powerless?

This packet defines a rules-and-measurement model, not visual or audio assets. **Target** means an original proposed tuning or acceptance band, not a sourced industry value. **Source-derived** means an externally stated fact. It preserves the product constraints: `defense-catalog.js` is authored rules authority; fixed 60 Hz simulation resolves combat; Canvas/render, VFX, audio, narration, haptics, and HUD observe resulting snapshots only; offline local-first; no accounts, commerce, or network; reduced motion; automatic attacks with movement-first input; and Stage 10 is the ending.

## Source ledger

| ID | Source / provenance | Exact factual support | Bounded use here |
|---|---|---|---|
| S1 | [Current product contract](../../../docs/abyssal-command-defense-survivor-design.md) — repository primary source | Defines deterministic 60 Hz simulation, snapshot projection, movement-first automatic combat, local-first operation, and reduced-motion fallback. | This contract overrides a genre convention or source whenever they conflict. |
| S2 | [Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/) — Glenn Fiedler, author technical reference | Shows that variable time steps make behavior frame-rate dependent and describes a fixed `1/60` simulation step with a renderer accumulator. | Supports resolving health, crit, and cooldowns in integer tick space rather than from render delta. It is not a source for the numeric targets below. |
| S3 | [PCG: A Family of Simple Fast Space-Efficient Statistically Good Algorithms for Random Number Generation](https://www.pcg-random.org/pdf/hmc-cs-2014-0905.pdf) — M. E. O'Neill primary technical report | Defines PCG as a specified family of pseudorandom generators and discusses reproducible, statistically tested PRNG algorithms. | A concrete, versioned PRNG algorithm and state are preferable to ambient/renderer randomness. This does not mandate PCG over another specified integer PRNG. |
| S4 | [Xbox Accessibility Guideline 103: Communicate information through multiple sensory methods](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103) — Microsoft official guidance | States that color alone must never convey information; critical visual and audio information need another sensory method; haptics must accompany another cue because it can be unavailable. | Health thresholds and cooldown state require non-color visual meaning; optional audio/haptics can reinforce, never gate play. |
| S5 | [Understanding WCAG 2.2 SC 2.3.1: Three Flashes or Below Threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) — W3C primary standard explanation | States content must not flash more than three times in any one-second period unless below its stated threshold, and flags saturated red flashing as particularly hazardous. | A safety ceiling for any crit or low-health presentation. It is not a claim of full game WCAG conformance. |
| S6 | [Game Accessibility Guidelines: full list](https://gameaccessibilityguidelines.com/full-list/) — specialist game-accessibility guidance | Calls for no essential information to be communicated by color or sound alone, distinct important event sounds, and alternatives to background movement. | Reduced-motion/muted feedback must preserve static health, crit, and cooldown semantics. These are guidelines, not certification requirements. |

**Source-quality note.** S1 is the governing local primary authority. S3 is a primary technical publication; S4 and S5 are official/standards guidance. The numerical bands in this report are deliberately labeled targets because no cited source establishes a universal combat balance value.

## Observed patterns and bounded synthesis

1. **Rule time and display time must be separate.** S2 supports fixed rule stepping rather than frame-rate-dependent simulation. Therefore health changes, critical eligibility, and cooldown readiness are resolved against an integer `sim_tick`; presentation can interpolate only a result already resolved at that tick.
2. **A critical result needs an auditable cause.** S3 supports specifying the generator rather than taking incidental platform or presentation randomness. The useful audit surface is not a particle count but `(seed/version, stream, draw index or deck position, chance, multiplier, final damage, tick)`.
3. **Persistent survival state and transient combat result have different visibility needs.** Player health and W-03 Gate Integrity are persistent, edge-HUD state; elite/boss health can be anchored to its world entity. A dense field should not receive a bar per common enemy. This is a bounded design inference from S1 and from the feedback hierarchy already required by the product contract, not an external empirical claim.
4. **Cooldown has value only when it changes a movement decision.** In automatic combat, showing every basic-attack interval gives observation without agency. A readiness state deserves prominent exposure only if it changes the next short-horizon damage/risk tradeoff; otherwise an aggregate cadence/status representation is enough. This is a bounded inference from movement-first input in S1.
5. **Semantic redundancy must survive accessibility settings.** S4–S6 require alternatives to color-only, sound-only, or motion-only information. A static shape/text/status relation must remain when effects, haptics, audio, or motion are unavailable.

## Resolution authority and non-negotiable feedback rule

### Tick order

For each `sim_tick`, use one stable entity ordering and this rule sequence:

1. advance authored cooldown counters and determine eligible automatic actions;
2. choose target and resolve hit eligibility from simulation state only;
3. obtain a crit outcome from the versioned core RNG/deck only when the authored action consumes a crit draw;
4. calculate integer damage, apply shields/health, death, W-03 Gate Integrity, and cooldown reset effects;
5. append an immutable `damage_resolved` event and canonical state checkpoint data; then
6. publish an observation snapshot/event queue for HUD, renderer, VFX, audio, narration, and haptics.

**Rule R-Display-0 — mandatory.** Display feedback **MUST NOT** affect critical-hit or RNG resolution. Renderer cadence, frame delta, particle completion, audio completion/failure, narration timing, haptic availability, muted/reduced-motion settings, HUD visibility, and any observer callback may neither advance/read the combat RNG stream nor mutate target selection, damage, health, cooldown, or canonical state. An observer may be dropped without changing the next simulation checkpoint.

### Integer rule model

Use integer units to make rounding and replay visible. Let `Q = 10,000` basis points, `t = 60` ticks per second, `D` be pre-crit integer damage, `c` be crit chance in bp, and `m` be crit multiplier in bp.

```text
crit = critDeckOrPrng.nextBp() < c
multiplierBp = crit ? m : Q
finalDamage = floor(D * multiplierBp / Q)
healthAfter = clamp(healthBefore - finalDamage, 0, healthMax)
ready(tick) = tick >= cooldownReadyTick
cooldownReadyTick = resolutionTick + cooldownTicks
```

`critDeckOrPrng` is a versioned integer algorithm and its position is part of canonical replay state. Targeting and entity iteration must be stable before any draw occurs. A deterministic shuffled deck (for example, a fixed 100-outcome deck containing exactly `c / 100` critical tickets for integer-percent `c`, permuted by the core seed) is a valid **target candidate** when bounded streaks are preferred; an independent seeded draw is also valid. The chosen contract must be singular per rules version, never selected by graphics or accessibility mode.

## Algebraic target bands

### Health and incoming-pressure bands

Let `P_s` be the authored reference incoming damage per second for stage `s` after the intended defensive baseline, and `H_s` player max health.

```text
survivalWindow_s = H_s / P_s
H_s = ceil(H_1 * (1 + g_H)^(s - 1))
enemyHealth_s = ceil(E_1 * (1 + g_E)^(s - 1))
```

| Quantity | Target band | Reasoning / testable intent |
|---|---:|---|
| `survivalWindow_s` under the reference sustained-pressure fixture | **Target: 7–12 s** | Below 7 s makes one navigation error dominate; above 12 s risks removing meaningful movement pressure. This is a tuning hypothesis, not a sourced threshold. |
| `g_H`, stage-to-stage player-health growth | **Target: 8–13%** | Keeps nine transitions to Stage 10 from creating a discontinuous late-game pool. |
| `g_E`, ordinary-enemy health growth | **Target: 10–16%** | Should exceed or match expected baseline player-output growth only when the intended stage TTK remains in band. |
| ordinary enemy time-to-kill at reference output | **Target: 0.35–1.25 s** | Maintains crowd throughput without making every target a bar-reading task. |
| elite time-to-kill at reference output | **Target: 6–14 s** | Long enough for movement and cooldown cadence to matter; short enough not to turn an automatic encounter into a static sponge. |
| boss/Stage-10 climax time-to-kill at reference output | **Target: 35–90 s** | A production tuning hypothesis to be verified by a complete Stage-10 fixture, not assumed as a shipping value. |

Health semantics: player health and W-03 Gate Integrity should expose a filled fraction plus a non-color state label/shape at defined bands (`stable`, `pressured`, `critical`); the exact breakpoint is **Target: 35% / 15%**. The underlying value and damage event are authoritative; smoothing the visible bar cannot change them. For common enemies, do not make a health bar a mandatory information layer; use bar visibility for elite/boss/selected targets only.

### Crit frequency and multiplier bands

```text
expectedHitDamage = D * (1 + (c / Q) * ((m - Q) / Q))
critEVUplift = (c / Q) * ((m - Q) / Q)
variancePerHit = D^2 * p * (1 - p) * (M - 1)^2
```

Where `p = c / Q` and `M = m / Q`.

| Quantity | Target band | Guardrail |
|---|---:|---|
| baseline crit chance `c` | **Target: 5–15%** | A visible but non-dominant baseline. |
| specialized crit chance `c` | **Target: 20–35%; hard cap 40%** | At `p=.35`, `M=2.0`, crit EV uplift is 35%; exceeding this risks collapsing non-crit paths into a trap. |
| crit multiplier `M` | **Target: 1.50–2.00; hard cap 2.25** | Keeps one crit legible without making a single result substitute for movement/position. |
| crit EV uplift of a complete build | **Target: 8–35% of comparable non-crit EV** | Compare at equal authored budget, including cooldown output. |
| 100-action crit-count error | **Target: report p5/p50/p95 by seed; no undocumented smoothing** | The target is auditability first. If a deck is chosen, assert its exact count; if independent draws are chosen, report its empirical distribution rather than calling streaks a bug without a defined fairness rule. |

A critical event must have a non-color static distinguishability path, but its feedback is a consequence of `damage_resolved`; it never creates, rerolls, confirms, or suppresses `crit`.

### Cooldown visibility and decision-impact bands

```text
cooldownSeconds = cooldownTicks / 60
abilityEVPerUse = A * (1 + p * (M - 1))
abilityEVdps = 60 * abilityEVPerUse / cooldownTicks
nextHorizonImpact = abilityEVPerUse / targetHealthAtDecision
```

| Quantity | Target band | Rule |
|---|---:|---|
| automatic active cooldown | **Target: 60–360 ticks (1–6 s)** | A shorter cadence is usually a passive attack cadence, not a player-facing countdown; longer cadence must justify a distinct encounter role. |
| automatic active hard floor after reductions | **Target: 30 ticks (0.5 s)** | Prevents presentation-heavy cadence from becoming uninspectable and bounds event density. |
| readiness lead time for a decision-relevant active | **Target: expose by 45 ticks (0.75 s) before ready, then persist while ready** | A readable “nearly ready/ready” state, not a promise of manual activation. |
| numeric cooldown display | **Target: required only when `cooldownTicks ≥ 60` and the state is decision-relevant** | Under one second, use a semantic fill/shape rather than a rapidly changing numeral. |
| minimum decision impact for prominent readiness feedback | **Target: nextHorizonImpact ≥ 10% of the relevant elite/boss current health over the next 120 ticks (2 s), or it changes an authored escape/survival route** | If it cannot plausibly affect route/positioning, keep it subordinate/aggregate. |
| aggregate ability-EV share | **Target: 15–40% of total build EV for a cooldown-focused archetype** | Below 15% readiness rarely changes a decision; above 40% one timer risks becoming the whole build. |

Cooldown reduction, if authored, should be represented in one integer formula with a cap, for example `effectiveCooldownTicks = max(floor(baseCooldownTicks * (Q - reductionBp) / Q), minimumTicks)`. **Target:** total cooldown reduction cap at 25% until a full build matrix demonstrates that higher values preserve event-density and decision-impact bands. Never compute it from elapsed render time.

## Five-archetype consequences and combo EV

The archetypes are analytical comparison profiles, not character classes, assets, or promised player choices. All values are **Target** inputs for a spreadsheet/simulator at equal authored power budget.

| Archetype | Intended allocation | Target health / crit / cooldown profile | EV consequence and risk |
|---|---|---|---|
| **Bulwark** | Survival and reliable sustained output | `H = 1.25–1.40×` reference; `p=5–10%`, `M=1.5–1.7`; active `240–360` ticks | Longer survival window should buy more route correction, not merely absorb ignored hazards. Low variance keeps this profile credible. |
| **Striker** | High-rate automatic hits | `H = 0.90–1.05×`; `p=10–20%`, `M=1.5–1.8`; passive cadence `18–45` ticks, no prominent per-shot cooldown UI | With many trials, crit variance averages out; showing every micro-cooldown would create noise and false agency. |
| **Gambit** | Crit specialization | `H = 0.85–1.00×`; `p=25–35%`, `M=1.8–2.0`; active `120–240` ticks | The EV budget comes from crit uplift, so health/cooldown must not also be best-in-class. Test drought distribution and burst TTK, not mean DPS alone. |
| **Conductor** | Periodic automatic active | `H = 0.95–1.10×`; `p=10–20%`, `M=1.5–1.8`; active `60–150` ticks | Cooldown output should contribute 15–40% of total EV. Readiness feedback is useful only near route/elite decisions. |
| **Rift hybrid** | Multi-hit combo / conditional payoff | `H = 0.90–1.05×`; `p=15–25%`, `M=1.7–1.9`; setup `90–210` ticks | Must be judged by combo distribution and miss/target-loss cases, not a perfect stationary-target spreadsheet alone. |

For a combo of `n` same-damage crit-eligible hits with base `D`, independent seeded draws have:

```text
E[comboDamage] = n * D * (1 + p * (M - 1))
P(at least one crit) = 1 - (1 - p)^n
Var(comboDamage) = n * D^2 * p * (1 - p) * (M - 1)^2
```

For heterogeneous hits, use `Σ D_i * (1 + p_i * (M_i - 1))`; for an automatic active with base damage `A`, add `A * (1 + p_A * (M_A - 1))` for each resolved use. If the selected fairness model is a shuffled critical deck, long-run EV remains the same at its exact ticket rate, but independence and the variance formula do not; report empirical combo p5/p50/p95 by deck position/seed. This is essential for Gambit and Rift hybrid fairness.

**Worked target comparison.** With `D=100`, `p=.25`, `M=1.8`, a five-hit sequence has `E=600`, a 76.3% chance of at least one crit, and `Var=6000`. The same expected mean does not establish fair play: a route decision made before the combo needs p5/p50/p95 damage, time-to-kill, and no-crit drought evidence.

## Specific Abyssal implications

1. **[Target] Make health arithmetic authoritative and inspectable.** Every health mutation records `before`, `finalDamage`, `after`, source/target IDs, `sim_tick`, and rule version; the HUD value is a snapshot of that record. Player and W-03 health remain persistent edge-HUD state; ordinary enemy bars remain optional/subordinate.
2. **[Target] Version the critical scheduler.** Store PRNG/deck algorithm ID, seed/state, draw/deck position, and chance/multiplier in checkpoints. Do not permit “cosmetic” critical rerolls or client-side effect choices to consume combat entropy.
3. **[Target] Reserve cooldown attention for movement-relevant auto actives.** Display `near-ready`, `ready`, and cooldown fraction with non-color static semantics only when the 10%-of-health / route-impact test applies. A basic automatic attack can remain visible as aggregate cadence/status rather than a repeated clock.
4. **[Target] Tune complete profiles by EV *and* distribution.** Admit an archetype only if reference health window, ordinary/elite TTK, total EV, cooldown EV share, combo p5/p50/p95, and no-crit drought meet its stated band. A mean-DPS tie cannot approve a high-variance profile.
5. **[Target] Treat reduced motion/mute as observer substitutions.** They may replace motion/audio with shape/text/contrast but must leave tick order, state checkpoints, crit outcomes, cooldown ready ticks, and Stage-10 resolution byte-identical.

## Balance test matrix

| Fixture / question | Deterministic inputs and observables | Target pass condition | Fails when |
|---|---|---|---|
| Health conservation | Fixed seed, stage, incoming-damage tape; record all `health_changed` events | `after = clamp(before - Σ finalDamage + Σ authored healing, 0, max)` for 100% of events; reference survival window is 7–12 s | HUD/bar or simulation changes without reconcilable event arithmetic. |
| Stage scaling | Reference build vs. ordinary, elite, and Stage-10 fixtures for stages 1–10 | Health growth, ordinary/elite TTK, and survival window remain in their labeled target bands or the exception is documented | Growth is tuned only by final-stage mean DPS or causes a discontinuous Stage-10 spike. |
| Crit rule truth | Forced crit/non-crit seeds or deck positions; capture `c,m,D,drawIndex,finalDamage` | 100% `crit`/damage equation agreement and stable PRNG/deck position under replay | A label appears without its resolved event, or a non-crit gets crit damage. |
| Crit frequency and fairness | At least 10,000 fixed seeds × 100 eligible actions for each `p` band; include combo windows | Report empirical mean and p5/p50/p95 count, longest drought, five-hit combo p5/p50/p95, and TTK distribution; selected independent/deck contract matches its exact rule | Only average DPS is reported, scheduler version is absent, or a profile's p5 makes elite TTK/survival invalid. |
| Cooldown boundary | Ready-tick fixtures at `C-1`, `C`, `C+1`; reductions at cap/floor; target loss while ready | No action before `readyTick`; exactly one authored use when valid; effective cooldown respects integer cap/floor | Render delta, frame rate, or feedback callback changes readiness or causes duplicate use. |
| Decision impact | Counterfactual route A/B snapshots around `near-ready` and `ready` states | Prominent readiness appears only where next-120-tick impact is ≥10% relevant target health or changes authored survival route; otherwise subordinate indicator | Countdown is presented as a major decision aid with no measurable alternative outcome. |
| Five-profile parity | Equal authored-budget simulator sweep across five archetypes | Each profile meets its own health/EV/cooldown-share band without simultaneously winning all metrics | Gambit/Rift are approved on mean EV despite unacceptable p5, or Bulwark invalidates movement pressure. |
| Observer separation | Same seed/input tape at 30/60/120 Hz render cadence; no renderer, muted, reduced-motion, VFX overload, delayed audio, alternate HUD | Byte-identical canonical checkpoints, RNG/deck positions, health, cooldown ready ticks, and Stage-10 outcome | Any presentation setting or observer availability changes canonical state. |
| Accessibility/safety | Static capture plus standard/reduced-motion, muted/no-haptic, color-vision prefilter; high-crit and low-health density fixture | 100% critical health/cooldown meanings retain shape/text/fill path; no essential color/sound/motion-only state; no component exceeds S5's source-derived three-flashes-per-second ceiling | “Ready,” “critical,” or low health only appears through color, sound, or animation. |

## Risks, contradictions, and falsification

- **Reproducibility/authority leak (P0):** An effect-completion callback, random particle seed, animation frame, or audio promise reads/advances crit state. **Test:** run the observer-separation row with an observer that intentionally drops every event and another that delays/doubles callbacks; canonical state hashes and RNG/deck positions must remain byte-identical. The first divergent tick is the failure artifact.
- **Fairness contradiction:** Independent draws are transparent mathematically but can create visible droughts; a deck bounds frequency but changes short-window distribution and may create detectable periodicity. **Test:** preregister one scheduler, then compare 10,000-seed distribution, longest drought, and combo/TTK p5/p50/p95 against the five-profile matrix. Do not switch scheduler after seeing only favorable averages.
- **Accessibility contradiction:** A visually restrained cooldown may be less cluttered but unreadable under reduced motion or color-vision loss. **Test:** semantic snapshot and participant comprehension task with audio/motion disabled; the static state must identify `cooling`, `near-ready`, and `ready` without color.
- **Health inflation risk:** Increasing `H_s` can conceal unreadable hazards and make Bulwark objectively safest and fastest through opportunity cost avoidance. **Test:** compare route-error survivability and elite TTK at equal power budget; require the 7–12 s survival window and profile tradeoffs together.
- **Cooldown false agency:** A visible automatic cooldown may imply the player can trigger it manually. **Test:** first-seen comprehension asks who controls activation and what movement decision is available; reject labels/placement that imply a button or manual timing.

## Experiment and telemetry packet

Keep diagnostics local, append-only, and excluded from gameplay state. Each record should include rule version, build/fixture ID, seed hash, `sim_tick`, canonical checkpoint hash, archetype ID, stage, and reduced-motion/observer mode. Required records:

- `damage_resolved`: source/target, base damage, crit flag, chance, multiplier, RNG/deck position, final damage, health before/after, event ID.
- `cooldown_set` and `cooldown_ready`: ability ID, resolution tick, ready tick, effective cooldown ticks, target validity, event ID.
- `archetype_sample`: health window, ordinary/elite/Stage-10 TTK, total EV DPS, active EV share, combo damage, no-crit drought.
- `feedback_observed`: event ID, snapshot revision, semantic channels (`text`, `shape`, `fill`, `color`, `motion`, `audio`, `haptic`), explicitly marked observer-only.
- `replay_checkpoint`: canonical hash, PRNG/deck state, cooldown state, entity ordering/version.

Run (1) fixed-seed property tests for every matrix row, (2) 10,000-seed distribution sweeps per crit profile/scheduler, (3) route counterfactuals at cooldown readiness, (4) normal/reduced/muted observer differential replays, and (5) preregistered human comprehension checks for critical health, crit discrimination, automatic activation ownership, and cooldown route choice. No live performance or user-comprehension claim should be made until its corresponding fixture/export exists.

## Handoff

Adopt a single integer, versioned core resolution path and tune it by distribution as well as EV. Health scaling must preserve a measurable movement-survival window; crit must be auditable at the draw/deck position and bounded by complete-build EV; cooldown feedback must earn prominence by changing a short-horizon route decision. Most importantly, presentation remains a pure observer: it may clarify a resolved result but can never create, delay, reroll, or otherwise influence it.
