# Encounter, Boss, and Variety Survey — Deterministic Ten-Stage Timeline

## Purpose, authority, and non-claims

This packet turns research and existing Abyssal encounter contracts into **proposed, testable encounter targets** for the offline, deterministic 60 Hz defense-survivor. It covers ordinary waves, elites, mini-bosses, bosses, big waves, role combinations, build/skill interaction, pacing, and anti-repetition. It does **not** modify production code or tests, set live adaptive difficulty, or assert that any gate has passed.

`defense-catalog.js` remains the authored rules authority. The encounter scheduler, combat resolution, health, rewards, safe-lane checks, and outcomes use integer simulation ticks and a recorded rules digest. Canvas, VFX, audio, narration, HUD, reduced-motion settings, and any diagnostic export are observers only: they cannot select a card, consume encounter RNG, mutate encounter state, or alter a replay. The current wave grammar's card/phase and fallback rules are normative input to this proposal [A1].

**Vocabulary.** A *decision* is a telegraphed, movement-only change in the best route, safe lane, or optional objective. It is not an automatic shot, a HUD event, or a demand for target selection. *Reference output* and *reference build* mean a pre-registered baseline fixture at a specified stage, health band, catalog digest, seed family, and scripted movement policy. All numeric entries labelled **[TARGET—UNVERIFIED]** are original calibration hypotheses, not externally established genre constants.

## Evidence ledger

| ID | Source and access date | Evidence used | Bounded application |
|---|---|---|---|
| E1 | Michael Booth, Valve, *The AI Systems of Left 4 Dead* (AIIDE 2009), [official PDF](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf), accessed 2026-07-22. | Describes Build Up → Sustain Peak → Peak Fade → Relax; says constant combat fatigues while extended inactivity bores; describes a dealt boss/witch/nothing sequence that prevents immediate repetition (pp. 74–82). | Supports intentional peak/recovery rhythm and constrained landmark selection. Its co-op FPS timings and adaptive director are not ported. |
| E2 | Godot Engine, [Random number generation](https://docs.godotengine.org/en/stable/tutorials/math/random_number_generation.html), accessed 2026-07-22. | Fixed seeds reproduce a PRNG sequence; state can be saved; a shuffle bag is recommended where no-immediate-repeat still permits visible patterns. | Supports separate, recorded encounter streams and bag/deck selection. It does not establish player-preferred repetition limits. |
| E3 | Salmon, Moraes, Dror & Shaw, [*Parallel Random Numbers: As Easy as 1, 2, 3*](https://www.thesalmons.org/john/random123/papers/random123sc11.pdf), SC11/ACM 2011, accessed 2026-07-22. | Counter-based generators can derive deterministic, machine-independent streams from keys and counters. | Supports addressable selection from stable schedule fields; it does not prescribe an RNG implementation or encounter rate. |
| E4 | Pedersen, Togelius & Yannakakis, [*Modeling Player Experience for Content Creation*](https://doi.org/10.1109/TCIAIG.2010.2043950), IEEE T-CIAIG 2010, accessed 2026-07-22. | Explores player-experience models from gameplay metrics and content features. | Supports collecting schedule and behavior traces alongside reported experience; telemetry alone is not a boredom/fairness verdict. |
| E5 | Togelius, Yannakakis, Stanley & Browne, [*Search-Based Procedural Content Generation: A Taxonomy and Survey*](https://doi.org/10.1109/TCIAIG.2011.2148116), IEEE T-CIAIG 2011, accessed 2026-07-22. | Frames content quality criteria as explicit generator objectives. | Supports validation/lint rules for authored encounter cards instead of unconstrained randomness. |
| E6 | Glenn Fiedler, [*Fix Your Timestep!*](https://gafferongames.com/post/fix_your_timestep/), accessed 2026-07-22. | Explains fixed-step simulation and renderer decoupling; variable time steps make behavior frame-rate dependent. | Supports 60 Hz integer tick scheduling; it is not evidence for any TTK target. |
| A1 | [Wave Encounter Composition: Deterministic Variety Without More Inputs](wave-encounter-composition.md), local authoritative planning input, accessed 2026-07-22. | Defines role vocabulary, `approach → probe → pressure → peak → fade → relief`, safe-lane, anti-repetition, deterministic selection, and relief targets. | This document extends, never replaces, that grammar. |
| A2 | [Deterministic health, critical-hit, and cooldown balance model](combat-systems-balance.md), local authoritative planning input, accessed 2026-07-22. | Defines reference TTK/survival-window targets, complete-build EV distribution checks, and presentation separation. | Supplies compatible TTK and build-comparison vocabulary. |
| A3 | [Game Studio Harness quality gates](../../../.claude/skills/game-studio-harness/references/quality-gates.md), local harness contract, accessed 2026-07-22. | Defines G2 (TTK/matchup/EV), G3 (archetype viability), G7 (30–180 s core loop, three actions, reward, repeat proxy), and G8 novelty evidence. | Gate thresholds are authoritative; this survey specifies future evidence, not a verdict. |

**Evidence limit.** E1 is a different genre and player count; E2/E3/E6 are technical determinism sources; E4/E5 do not prove a particular target value. Therefore every proposed number below remains explicitly unverified until fixed-seed simulation and human playtest evidence exist.

## Encounter taxonomy and numeric bands

### Target combat-duration and decision-density bands

| Encounter class | Job in the cadence | Reference TTK **[TARGET—UNVERIFIED]** | Meaningful movement decisions | Required recovery / exit rule |
|---|---|---:|---:|---|
| Ordinary wave | Throughput and route upkeep; establishes one readable pressure role. | 0.35–1.25 s per ordinary enemy (A2-compatible). | 1–2 per 20–40 s card; **3–5/min** including transitions. | Must resolve into `fade` before the next major role; no hidden reinforcement after card end. |
| Elite | A visible, durable route modifier; tests a skill/item interaction without becoming a sponge. | 6–14 s. | 1–3 during the engagement; safe-lane switch must be possible. | After death/timeout, no same-role elite for 600 ticks and a `fade` is mandatory. |
| Mini-boss | Short landmark that proves a newly introduced composition can be answered. | 15–30 s (Stages 2–5); 24–42 s (Stages 6–9). | 2–4; one must be an announced route choice, not survival through raw health. | Follow with 900–1500 tick relief; it cannot be followed directly by a big wave. |
| Big wave | A crowd peak: density/route problem, not a health-bar problem. | 18–36 s to reach its fade condition; ordinary units remain in ordinary TTK band. | 3–5; **5–7/min** during the peak. | New major-role spawns stop during `fade`; safe lane becomes reachable before relief. |
| Boss | Stage punctuation and build coverage check. | 35–75 s (Stages 4–9); Stage 10 climax 50–90 s, within A2's 35–90 s endpoint band. | 4–7; **5–9/min** depending on stage. | One 180-tick minimum pre-spawn telegraph and an authored post-boss reward/reposition beat. |

**Decision-density formula.** For a card window of duration `T` ticks, count each `decision_event` once when a persistent telegraph gives at least 120 ticks of lead time and a baseline build has two or more reachable movement responses whose next-120-tick survival/route outcomes differ. `decision_density_per_min = 3600 * distinct_decision_events / T`. Multiple VFX, audio cues, or repeated hits tied to the same route shift count once. This prevents visual noise from being misreported as agency.

### Difficulty bands and escalation budget

| Band | Intended stage use | Target pressure characteristics **[TARGET—UNVERIFIED]** | Permitted new information | Forbidden escalation |
|---|---|---|---|---|
| 1 — orientation | 1 | 3–5 decisions/min; reference survival window 10–12 s under sustained pressure. | One role and one safe-lane convention. | Flanker + denier, elite, or full-screen route closure. |
| 2 — combination | 2–3 | 4–6 decisions/min; survival window 9–11 s. | A complementary two-role card after each role has appeared alone. | A new role family and a landmark in the same first-seen card. |
| 3 — test | 4–5 | 5–7 decisions/min; survival window 8–10 s. | First mini-boss/big-wave rule; one optional objective. | Two simultaneous high-consequence telegraphs or mandatory optional-objective reward. |
| 4 — stress | 6–8 | 6–8 decisions/min; survival window 7–9 s. | Three-role composition only if one is low-pressure support. | Two denial families, all-lane closure, or a boss without an intervening recovery card. |
| 5 — climax | 9–10 | 7–9 decisions/min during declared peaks; survival window 7–8 s. | Recombines taught roles and a multi-phase boss. | New unpractised counterplay, emergency spawn on player, or endless post-Stage-10 escalation. |

The 7–12 s survival-window range and ordinary/elite/boss TTK comparison values intentionally align with A2. They are tuning hypotheses that must be evaluated at equal authored build budget and as p5/p50/p95 distributions, not only by mean DPS.

## Composition constraints

These constraints are proposed content-validator rules. They preserve the existing spatial-role grammar (`pursuer`, `screen`, `flanker`, `denier`, `anchor`, `harvester`, `relief`) rather than creating a competing runtime system.

| Constraint | Deterministic rule | Failure it prevents |
|---|---|---|
| Safe route | Every non-relief card declares a stable `safeLaneAnchorId`; path validation finds a route from every eligible spawn anchor for every baseline build in its declared starting-state envelope. | A nominally telegraphed encounter that is physically unwinnable. |
| Telegraph | Any `flanker`, `denier`, elite, mini-boss, or boss route change begins at least 120 ticks before harm; boss entry is at least 180 ticks. It has persistent non-color/non-motion semantics. | Damage arriving before the movement-only answer is readable. |
| Role mix | Ordinary/probe cards: one pressure role. Pressure/big-wave cards: exactly two complementary primary roles. Three roles are permitted only in Bands 4–5, with exactly one `anchor` **or** `denier`, never both. | Density inflation that adds no legible decision. |
| Closure ban | No `denier` may cover every designated lane; `screen` must retain a deterministic seam; `anchor + denier` needs reachability proof; no spawn on current player position. | Full-ring/no-route deaths. |
| Landmark spacing | At least one `fade` and 900–1500 tick `relief` separate a mini-boss/big-wave/boss from the next landmark. A boss cannot overlap a mini-boss. | Back-to-back peaks and exhausted comprehension. |
| Build fairness | Each card lists reviewed coverage for at least five test archetypes and an expected movement answer. All baseline catalog-compliant builds retain a deterministic route; optional objectives may not be required for baseline progression. | Hidden seed/build hard counters. |
| Scheduler purity | Selection uses `(runSeed, grammarVersion, stageIndex, segmentIndex, decisionIndex, domain)` plus lexically ordered eligible IDs. It records card, anchor, count, fallback reason, and tick. | Frame-rate, observer, or unordered-iteration drift. |
| Fallback | If an eligible card fails reachability/cooldown validation, choose the first valid authored fallback and emit its reason; never re-roll. | Non-reproducible recovery from an invalid composition. |

## Ten-stage encounter timeline

Each stage is a complete **90–180 s [TARGET—UNVERIFIED]** loop candidate: it contains at least three movement actions, a visible reward/advancement event, and a post-stage reposition or choice. This matches the G7 loop-duration envelope but is not proof of its repeat-rate requirement. `O` = ordinary, `E` = elite, `M` = mini-boss, `B` = boss, and `BW` = big wave. Durations are authored integer ticks at 60 Hz.

| Stage | Cadence and target duration | Primary composition / skill-item interaction | Target TTK and decision band | Escalation, failure, and recovery expectation |
|---|---|---|---|---|
| 1 — Wake | `approach O → probe O → pressure screen+pursuer → fade → relief`; 90–110 s. | Teach lane seam and moving while automatic attacks clear pursuers; no conditional build check. | O 0.35–0.70 s; 3–5 decisions/min; Band 1. | A failed seam is expected to cost correctable health, not end the route. Relief has 0 major spawns and a full reposition path. |
| 2 — Crosscurrent | Add `E(anchor)` after separately taught flanker probe; 100–120 s. | Sustained/cooldown build learns that moving through a gap preserves automatic output. | E 6–8 s; O 0.45–0.80 s; 4–5 decisions/min; Band 2. | Elite may pressure one lane but cannot deny both. Elite resolution is followed by fade + 900 tick relief. |
| 3 — Split Shoal | `screen+pursuer` then `flanker` rotation; one optional harvester; 105–125 s. | Mobility/collection synergy: cross a marked optional lane, then leave before compression. | E 7–10 s; 4–6 decisions/min; Band 2. | Missing harvester reward loses only optional value. No objective can make the subsequent survival route invalid. |
| 4 — Pressure Test | First `M(anchor+screen)` with ordinary escort; 110–135 s. | First boss-like target verifies burst versus sustained output while the seam remains available. | M 15–22 s; E 8–10 s; 5–6 decisions/min; Band 3. | At least two announced safe-lane changes; a bad first route may be recovered by kiting, not a forced hit. M death triggers reward + 1200 tick relief. |
| 5 — Floodline | First `BW(screen+pursuer)`; 120–145 s. | Area/throughput synergy: test crowd clear without granting stationary immunity. | BW 18–26 s; O 0.55–0.95 s; 5–7 decisions/min; Band 3. | Fade begins when big-wave objective resolves; no new major role during fade. If crowd remains, clear route must still recover before relief. |
| 6 — Riptide Warden | `B(anchor+flanker)` after a low-pressure approach; 125–150 s. | First true boss: cooldown/burst timing changes where to stand, while crit builds are evaluated by p5 burst rather than mean alone. | B 35–48 s; 5–7 decisions/min; Band 4. | Boss telegraphs entry ≥180 ticks and phase transition ≥120 ticks. It may shift one safe lane, never close all. Post-boss gives reward/reposition, not another peak. |
| 7 — Broken Formation | `M(denier)+E(pursuer)` in separate cards, then `BW` without denier; 130–155 s. | Defensive/mobility trade-off: leave an expensive region while preserving sustained contact. | M 24–32 s; BW 22–30 s; 6–7 decisions/min; Band 4. | Denier's boundary is exit-able and never coincides with flanker. A route error should consume health within survival-window target and lead to a declared recovery lane. |
| 8 — Abyssal Chorus | `B(anchor+screen)` plus a later harvester choice; 140–165 s. | Hybrid/combo build test: target loss and moving boss must be included in combo p5/p50/p95. | B 42–58 s; 6–8 decisions/min; Band 4. | Boss has two taught phase changes, not a new mechanic. Optional harvester is only available after boss fade, preventing concurrent reward/route overload. |
| 9 — Siege Current | `BW(screen+pursuer)` → relief → `M(anchor+flanker)`; 145–175 s. | Pre-climax synthesis: throughput and single-target profiles each receive one readable advantage but neither gets a bypass. | BW 26–36 s; M 30–42 s; 7–8 decisions/min; Band 5. | Two landmarks are legal only because relief separates them. Mini-boss cannot appear while unreconciled BW major roles remain. |
| 10 — Command Depth | Approach/reprise → multi-phase `B` with recombined taught roles → terminal fade/reward/end; 150–180 s. | Final test of route memory, cooldown readiness, and build synergy; Stage 10 is the end, not an endless escalation. | B 50–90 s; O 0.70–1.25 s; 7–9 decisions/min only in declared phases; Band 5. | Each phase keeps a route taught in earlier stages. A phase failure must be diagnosable by event/card/route trace; no surprise phase, hidden scaling, or post-clear swarm. |

### Role-combination deck

Use a deterministic landmark deck and a no-repeat bag for eligible signatures. Each signature includes its objective, topology, anchor set, and intensity—role labels alone are not sufficient to define repetition.

| Combination | Allowed stages | Movement-only question | Item/skill test | Non-negotiable constraint |
|---|---:|---|---|---|
| `screen + pursuer` | 1, 3, 5, 9 | Which seam preserves forward motion under rear pressure? | Throughput / movement speed. | Screen seam exists; pursuer is not the sole role every time. |
| `flanker + ordinary` | 2, 3, 6, 9 | Turn into the announced safe arc or cross a gap? | Mobility / short-cooldown reliability. | Flanker has an announced escape lane; no concurrent denier. |
| `anchor + screen` | 4, 8, 10 | Kite focal threat while selecting a seam? | Sustained single-target / cooldown pacing. | One anchor maximum; no all-lane screen. |
| `anchor + flanker` | 6, 9, 10 | Reposition before the boss moves route geometry? | Burst / crit distribution. | Never pair with denier; boss movement remains bounded. |
| `denier + pursuer` | 7 only, then reprise in 10 only if taught answer retained | Leave costly ground without reversing into rear pressure? | Defense / mobility. | Denier leaves a reachable lane and has no player-position spawn. |
| `harvester + low pressure` | 3, 8 | Is optional movement value worth the safe route detour? | Collection/range. | Reward is optional and never gates stage survival/progression. |

## Escalation and recovery policy

1. **Escalate one axis at a time.** Between consecutive stages, add or materially increase exactly one of: role topology, landmark duration, enemy health/TTK, safe-lane changes, optional-objective value, or number of concurrent role families. Do not increase all axes in the same transition. A stage may recombine taught axes only after each was introduced separately.
2. **Health may not substitute for a new decision.** Ordinary, elite, and boss values must remain within their target bands; extending TTK without changing spatial counterplay is a content defect candidate, not escalation.
3. **Recovery is structural, not invisible rubber-banding.** The scheduler may use a pre-authored, recorded fallback only for invalid geometry/cooldown eligibility. It must not alter health, damage, drops, RNG, or spawn composition from inferred player emotion or renderer performance. Relief means no new major roles, a reachable route, and time to reposition; it is not a hidden invulnerability state.
4. **Failure must be attributable.** A failed encounter report records `(stage, card/signature, role mix, anchors, safe lane, starting health band, build, seed family, first forced-hit or route-unreachable tick)`. A player mistake and an invalid geometry/card must not be merged into one generic failure.
5. **Failure does not create progression debt.** Optional harvester/landmark value may be forfeited, but a baseline build with the declared movement answer must still retain a route to stage completion. If the complete stage fails, retry/recovery behavior must be authored separately and must not introduce mid-run hidden compensation.

## Novelty, repetition, and build-parity measurement

### Schedule lint targets **[TARGET—UNVERIFIED]**

| Measure | Definition | Target / action |
|---|---|---|
| Exact signature recurrence | Same ordered `(phase, role counts, objective, topology bucket, anchor set, landmark modifier, intensity band)` in a 12-card non-relief window. | At most 2 exact duplicates; reject schedule if exceeded. |
| N-gram rhythm | Same ordered 3-card signature sequence inside a run. | 0 repeated 3-grams; use authored fallback, not a reroll. |
| Role rotation | Distinct primary role families over any four non-relief cards. | At least 3; `denier`/`flanker` may not follow itself without relief. |
| Landmark novelty | Boss/mini-boss mechanic vector in prior three stages. | No exact mechanic vector repeat; a reprise must alter topology and movement answer. |
| Recovery validity | During relief: major-role spawns, reachable lanes, damage events, clear-route latency. | 0 new major roles; at least one reachable lane from each eligible anchor; record all damage exceptions. |
| Archetype exposure | Card × build coverage cells that have a reviewed movement answer. | 100% of eligible card/build cells for at least five test archetypes; no `unknown` entry. |
| Dominance alert | Within identical rules/stage/seed-family/starting-state/signature cohort, one build's route-progress and survival-time median exceed cohort median while damage taken is no worse. | Flag at +25% on both outcomes; require paired replay and coverage diagnosis before any balance change. |

G8's `≤2 of 5` comparable-title frequency and QA impression-score requirement remain separate gate evidence. This survey supplies an encounter-signature inventory and a falsifiable distinctiveness definition; it does not claim novelty merely because card names differ.

### Measurable hypotheses

| ID | Question | Controlled comparison and evidence | Future result criterion **[TARGET—UNVERIFIED]** |
|---|---|---|---|
| H1 | Does the ten-stage grammar reduce perceived repetition versus an equal-threat density ramp? | Counterbalanced local playtest; hold rules digest, seed family, starting health, total threat budget, and run length. Collect signature trace, rating (`repetitive`, `fair/readable`, `wanted more pressure`), route progress, and voluntary re-entry. | Grammar lowers reported repetition without worse fairness rating or lower route progress. |
| H2 | Are peaks followed by real recovery rather than only quieter effects? | Fixed-seed traces for every landmark. Log major-role spawns, reachability, damage, and path-clear time through fade/relief. | 100% declared landmark transitions satisfy the recovery-validity lint; any exception is an authored defect. |
| H3 | Does every viable archetype retain a movement-only answer? | For each `(stage, card, anchors, baseline build, starting health band)`, run deterministic route-policy replay; inspect failures with the first divergent/forced-hit tick. | 0 failures attributable to absent declared safe route or pre-telegraph forced hit. |
| H4 | Do boss and mini-boss TTK targets preserve G2 parity rather than favor burst or sustained damage? | Equal-budget 10,000-seed combat sweep where relevant; report p5/p50/p95 TTK, combo damage, survival, and route progress by build and signature. | Each encounter class stays ±15% of target TTK and no combo pair exceeds 1.30× median EV under the G2 measurement contract. |
| H5 | Is Stage 10 a satisfying finite culmination instead of an endless-density trap? | Fixed seed/scripted input through terminal phase; inspect stage-end event, post-clear scheduled spawns, TTK, and phase telegraph trace. | 100% paths emit one terminal outcome and schedule 0 post-clear major spawns; no unpractised mechanic occurs. |

## Gate linkage and implementation boundaries

| Gate | Required future evidence from this packet | This packet does not prove |
|---|---|---|
| **G2 — rules and balance** | Reference fixtures for every encounter class; TTK p5/p50/p95 by stage/build; matchup and combo-EV reports; exact card/anchor/seed traces; evidence that observed TTK is within the harness ±15% target. | A G2 PASS, current matchup balance, or that a displayed mean DPS is fair. |
| **G3 — player-type diversity** | At least five archetypes tested across the card/build coverage matrix; three independently viable archetypes with distinct movement answers; dominance alert review using paired seed families. | That five labels equal viable playstyles, or an optimal-play dominance result without rotation evidence. |
| **G7 — core loop** | A staged 90–180 s trace with ≥3 movement actions, ≥1 authored reward/advancement event, stage-end/re-entry observation, and voluntary re-entry measurement segmented by stage/build. | The required ≥70% repeat proxy until a playtest report exists. |
| **G8 — novelty (supporting only)** | Signature inventory, repetition lint result, comparable-title frequency table, and QA impression protocol. | The mandatory ≤2-of-5 frequency or ≥4/5 score. |

**Implementation boundary.** A future implementation may add authored encounter-card data, deterministic scheduler validation, replay events, fixed-seed fixtures, and local-only diagnostics. It must not add online telemetry, accounts, commerce, nondeterministic timers, dynamic personal difficulty, random presentation coupling, target-selection controls, or runtime authority in observers. Stage 1 owns concept/core-loop presentation; Stage 2 owns G2/G3 balance, archetype rotation, and novelty validation; Stage 3 owns combat feedback, performance, QA regression, and release evidence.

## Required future fixture fields

Every future simulation or playtest row should record: `grammarVersion`, `catalogDigest`, `runSeed`/seed family, `stage`, `segmentIndex`, `cardId`, `signatureId`, selected anchors/counts, fallback ID/reason, `sim_tick`, phase, build/archetype, starting health band, TTK, decision-event IDs, safe-lane reachability, damage/forced-hit events, route-progress result, reward event, terminal outcome, observer mode, and canonical checkpoint hash. Local subjective ratings must remain explicitly separate from rule state.

No numerical target in this survey is measured evidence. The next admissible action is a fixed-seed fixture/lint implementation followed by paired playtest validation; until then, G2, G3, G7, and G8 remain unclaimed.