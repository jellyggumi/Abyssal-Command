# Wave Encounter Composition: Deterministic Variety Without More Inputs

## Research question

How should **Abyssal Command** compose and pace authored automatic-combat survival encounters so that the player keeps making movement decisions, receives genuine recovery time, and sees meaningful variation without increasing input complexity or compromising the deterministic 60 Hz rules authority?

**Scope.** This packet concerns wave scheduling only. `defense-catalog.js` remains the authored rules authority. Simulation emits encounter events; render, audio, VFX, narration, and reduced-motion presentation observe those events and cannot choose composition, timing, damage, or outcomes. The proposal is offline/local-first, has no account, commerce, network, or gameplay-time API dependency, and uses Stage 10 as the ending rather than an endless-mode substitute.

**Evidence labels.** **Observed** means the cited source says or demonstrates it. **Inference** is a bounded transfer to this game. **[TARGET—UNVERIFIED]** is an original calibration hypothesis, not an externally established threshold.

## Source ledger

| ID | Source and provenance | Evidence used | Limits |
| --- | --- | --- | --- |
| S1 | Michael Booth, Valve, *The AI Systems of Left 4 Dead* (AIIDE 2009), [official Valve CDN PDF](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf). **Primary developer technical presentation.** | Valve describes designer-authored candidate item locations selected by the Director; boss events spaced along route with randomized offset; a shuffled/dealt Boss/Witch/Nothing sequence that disallows immediate repeats; and a Build Up → Sustain Peak → Peak Fade → Relax pacing state machine (pp. 74–82). It explicitly calls constant combat fatiguing and long inactivity boring (p. 78). | Co-op first-person campaign, not single-player auto-combat. Its numbers are evidence of one shipped implementation, not portable thresholds. |
| S2 | Godot Engine, [Random number generation](https://docs.godotengine.org/en/stable/tutorials/math/random_number_generation.html). **Official engine documentation.** | A fixed seed produces the same PRNG sequence; independent RNG instances have independent seed/state; saved state supports replay/rewind; a shuffle bag is recommended when no-immediate-repeat alone still permits visible ping-pong. | Engine API documentation, not an encounter-design experiment. It does not establish which variation players prefer. |
| S3 | Salmon, Moraes, Dror & Shaw, [*Parallel Random Numbers: As Easy as 1, 2, 3*](https://www.thesalmons.org/john/random123/papers/random123sc11.pdf), SC11/ACM 2011. **Peer-reviewed primary research.** | Counter-based PRNGs derive output from a key plus counter and can derive streams from application variables; the authors identify machine-independent deterministic streams as useful for repeatability/debugging. | Simulation/PRNG research, not gameplay research. It supports addressable randomness, not a specific RNG implementation choice. |
| S4 | Pedersen, Togelius & Yannakakis, [*Modeling Player Experience for Content Creation*](https://doi.org/10.1109/TCIAIG.2010.2043950), IEEE T-CIAIG 2010. **Peer-reviewed primary research.** | It models player experience from gameplay metrics and level features for content creation. | A telemetry model needs validation against reported experience; behavioral traces do not prove that a player was bored. |
| S5 | Togelius, Yannakakis, Stanley & Browne, [*Search-Based Procedural Content Generation: A Taxonomy and Survey*](https://doi.org/10.1109/TCIAIG.2011.2148116), IEEE T-CIAIG 2011. **Peer-reviewed survey.** | Supports treating content quality criteria as explicit generation objectives rather than allowing unconstrained random output. | Survey evidence does not validate the specific objective functions below. |
| S6 | Unity Technologies, [`Random.InitState`](https://docs.unity3d.com/ScriptReference/Random.InitState.html). **Official engine API documentation.** | A fixed seed reproduces a procedural pattern; global RNG state is serializable, while the original seed cannot be recovered after initialization. | Documentation reinforces recording the run seed/state at creation; it is not a cross-engine replay guarantee. |

At least two practical primary/official sources are present (S1, S2, S3, S4, S6). All external factual claims in this report are tied to this ledger.

## Observed patterns and bounded implications

### 1. Author choices plus constrained selection beat unrestricted random waves

- **Observed (S1):** Valve kept authored placement candidates while its Director selected which candidates existed. It also used a shuffled/dealt event set and prohibited successive repeats.
- **Observed (S2):** preventing only an immediate repeat can still create an obvious A/B/A/B pattern; a shuffle bag is the stronger anti-repetition pattern.
- **Inference:** Abyssal should author a small finite grammar of **encounter cards**, spawn anchors, route-pressure patterns, and objective shapes. The schedule selects only among eligible cards rather than procedurally inventing every composition. This preserves legibility and makes fairness review possible.

### 2. Pressure needs a release valve, not a permanently rising spawn rate

- **Observed (S1):** Valve’s Director uses Build Up, Sustain Peak, Peak Fade, then Relax. Peak Fade lets the active engagement resolve before Relax begins; Relax uses a minimal threat population. Valve also treats boss punctuation separately from adaptive pacing.
- **Inference:** A wave should be a short spatial question with a bounded answer, followed by relief that is mechanically real: fewer new threats, safe movement space, and an opportunity to reposition. A landmark/elite should be an authored punctuation card, not merely “more normal enemies.”
- **Constraint:** Because Abyssal is automatic-combat, a role may change **where and when to move**, but may not require target selection, rapid button sequences, or a new reaction input to survive.

### 3. Variation must be addressable and replayable

- **Observed (S2, S6):** fixed seeds reproduce PRNG patterns, and saved state reproduces subsequent draws in the documented engine models.
- **Observed (S3):** keyed counter-based generation can derive independent deterministic streams from stable application variables rather than physical execution order.
- **Inference:** deterministic variety requires more than one run seed. Candidate IDs, schema version, selection order, RNG domain, tick, and fallback order must be stable. A cosmetic random draw must never shift an encounter decision.

### 4. Telemetry is a detector, not a mind reader

- **Observed (S4):** player-experience content work can model experience from gameplay metrics and content features.
- **Risk:** a repeated orbit, low input, or quitting may reflect accessibility needs, interruptions, skill, completion, or device issues rather than boredom.
- **Inference:** use behavioral metrics to select a playtest clip or cohort, then validate it with a low-friction post-run rating before changing the grammar. Never silently adapt a live run from a guessed boredom score; this preserves run fairness and reproducibility.

## Original encounter grammar

### Role vocabulary: spatial pressure, never extra controls

Each card declares a mix from this vocabulary. Names are design placeholders; authored `defense-catalog.js` identifiers are authoritative when implementation begins.

| Role | Spatial job | Movement-only counterplay | Prohibited composition use |
| --- | --- | --- | --- |
| `pursuer` | Builds directional pressure from rear/side and punishes standing still. | Move through an open lane; change heading before compression. | Cannot be the only role in every non-relief card. |
| `screen` | Forms a slow front/edge occupancy that changes the best route. | Route around its low-density seam. | Must leave a deterministic traversable seam; cannot close all anchors. |
| `flanker` | Telegraphs an approaching side angle and discourages a single stable orbit. | Turn toward the announced safe arc or cross a gap. | Never appears without a telegraphed escape lane. |
| `denier` | Temporarily makes a region expensive rather than impossible. | Exit its marked area; choose a different route. | No untelegraphed spawn on current player position; no simultaneous full-ring denial. |
| `anchor` | Durable focal threat that changes path geometry and time-to-clear. | Kite through open space, use automatic fire while moving, wait for a route opening. | Requires a cap and a meaningful lane; never stack with all-lane denial. |
| `harvester` | Makes movement toward an extract/collection position worthwhile. | Move to the marked zone, then leave before closure. | Objective must remain optional if resource loss would create an unwinnable run. |
| `relief` | Minimal active pressure, clear route, and recovery/readability beat. | Reposition and observe; no mandatory precision action. | Cannot be visually quiet while simulation secretly schedules an immediate unavoidable hit. |

### Card sequence grammar

A **stage segment** resolves as an authored card chain, not an unconstrained density curve:

1. `approach` — short orientation or route statement; `relief`/low `pursuer` only.
2. `probe` — one role asks one movement question (for example, flank **or** screen).
3. `pressure` — a complementary two-role composition, not two copies of the same spatial question.
4. `peak` — bounded objective or landmark card; it may use an `anchor`, but must preserve the declared escape lane.
5. `fade` — existing threats resolve; no new major role may enter.
6. `relief` — deterministic low-pressure interval before the next `approach`.

The scheduler may omit `peak` for a short segment, but may not omit `relief`. Stage-level landmark cards are selected from an authored deck and are outside any adaptive tuning loop, following the separation between normal pacing and punctuation seen in S1.

**Adjacency rules (original):**

- `pressure → pressure` is illegal unless the second card has a different primary objective and a different dominant role family.
- A card with `denier` or `flanker` must declare at least one `safeLaneAnchorId`; a card with `screen` must declare a seam.
- `anchor + denier` requires a live test that reaches every designated escape anchor from every eligible spawn anchor under baseline movement.
- The same `signatureId` cannot appear twice in the previous three non-relief cards; the same `objectiveId` cannot appear in consecutive cards.
- A `landmark` card may not repeat within the stage deck cycle; if the eligible deck is exhausted, use a declared non-landmark fallback rather than resetting the bag early.
- A cooldown is an eligibility rule, never a timer hidden in presentation.

## Original configuration schema

This is data shape and validation policy, not runtime code. All durations and cooldowns are integer simulation ticks at 60 Hz. The example values are **[TARGET—UNVERIFIED]** starter values.

```yaml
encounterSchedule:
  grammarVersion: "wave-grammar/1"       # replay contract, immutable once shipped
  catalogDigest: "sha256:defense-catalog-rules" # exact authored-rules snapshot
  runSeed: "u64-recorded-at-run-creation"
  tickRate: 60
  stages:
    - stageId: "W-02"
      stageIndex: 2
      landmarkDeckCardIds: []           # explicit: this segment has no landmark punctuation
      landmarkFallbackCardIds:           # must name only cardKind: normal cards
        - "w02-pressure-screen-pursuer"
        - "w02-relief-clearwater"
      fallbackOrder:                    # stable, authored order; re-filtered for current eligibility
        - "w02-crosscurrent-probe"
        - "w02-pressure-screen-pursuer"
        - "w02-relief-clearwater"
      cards:
        - id: "w02-crosscurrent-probe"
          signatureId: "probe/flanker/route-shift/a"
          phase: probe                    # approach | probe | pressure | peak | fade | relief
          cardKind: normal               # normal | landmark; landmark cards use landmarkDeckCardIds
          intensityBand: 1                # authored ordinal, not a UI metric
          primaryRoleFamily: flanker    # required for adjacency and rotation linting
          startingStateEnvelopeRef: "W-02-baseline"
          baselineBuildCoverage:
            - { buildTag: "baseline-mobile", expectedMovementAnswer: "turn-to-safe-arc", status: "reviewed" }
            - { buildTag: "baseline-stationary-damage", expectedMovementAnswer: "leave-current-lane", status: "reviewed" }
          roleMix:
            - roleId: flanker
              minCount: 1
              maxCount: 2
              spawnAnchorSetId: "crosscurrent-sides-a"
              arrival: "telegraphed"
          objective:
            id: "route-shift"
            winCondition: "survive_until_end_tick"
            optional: false
          counterplay:
            safeLaneAnchorIds: ["lane-east", "lane-west"]
            telegraphSpecs:
              - { id: "side-current-marker", leadTicks: 120, requiredChannels: ["persistent-shape", "lane-label"] }
            forbiddenStates: ["full-ring-denial", "spawn-on-player"]
          durationTicks:
            min: 180                       # [TARGET—UNVERIFIED] 3 s
            max: 360                       # [TARGET—UNVERIFIED] 6 s
            exit: "duration_and_no_major_engagement"
          cooldown:
            selfTicks: 1440                # [TARGET—UNVERIFIED] 24 s
            objectiveTicks: 900            # [TARGET—UNVERIFIED] 15 s
            roleFamilyTicks: 600           # [TARGET—UNVERIFIED] 10 s
          eligibility:
            requiresPreviousPhase: [approach, relief]
            excludesRecentSignatures: 3
            excludesRecentObjectives: 1
            requiresReachableSafeLane: true
          variation:
            candidateSpawnAnchorSetIds:
              - "crosscurrent-sides-a"
              - "crosscurrent-sides-b"
            stableCandidateOrder: "lexicographic-id"
            selectionDomain: "encounter.spawn-anchor"

        - id: "w02-pressure-screen-pursuer"
          signatureId: "pressure/screen+pursuer/extract-lane/a"
          phase: pressure
          cardKind: normal
          intensityBand: 2
          primaryRoleFamily: screen
          startingStateEnvelopeRef: "W-02-baseline"
          baselineBuildCoverage:
            - { buildTag: "baseline-mobile", expectedMovementAnswer: "cross-forward-seam", status: "reviewed" }
            - { buildTag: "baseline-stationary-damage", expectedMovementAnswer: "move-through-forward-seam", status: "reviewed" }
          roleMix:
            - { roleId: screen, minCount: 1, maxCount: 1, spawnAnchorSetId: "forward-seam-a", arrival: "telegraphed" }
            - { roleId: pursuer, minCount: 4, maxCount: 7, spawnAnchorSetId: "rear-flow-a", arrival: "continuous" }
          objective:
            id: "hold-extract-lane"
            winCondition: "remain_in_any_safe_lane_for_ticks"
            optional: false
          counterplay:
            safeLaneAnchorIds: ["forward-seam"]
            telegraphSpecs:
              - { id: "seam-marker", leadTicks: 120, requiredChannels: ["persistent-shape", "lane-label"] }
              - { id: "rear-flow-cue", leadTicks: 120, requiredChannels: ["persistent-shape", "lane-label"] }
            forbiddenStates: ["sealed-route", "simultaneous-flanker"]
          durationTicks: { min: 360, max: 600, exit: "duration_or_route_progress" }
          cooldown: { selfTicks: 1800, objectiveTicks: 900, roleFamilyTicks: 900 }
          eligibility:
            requiresPreviousPhase: [probe]
            excludesRecentSignatures: 3
            excludesRecentObjectives: 1
            requiresReachableSafeLane: true
          variation:
            candidateSpawnAnchorSetIds: ["forward-seam-a", "forward-seam-b"]
            stableCandidateOrder: "lexicographic-id"
            selectionDomain: "encounter.card"

        - id: "w02-relief-clearwater"
          signatureId: "relief/clearwater/reposition/a"
          phase: relief
          cardKind: normal
          intensityBand: 0
          primaryRoleFamily: relief
          startingStateEnvelopeRef: "W-02-baseline"
          baselineBuildCoverage:
            - { buildTag: "baseline-mobile", expectedMovementAnswer: "reposition", status: "reviewed" }
            - { buildTag: "baseline-stationary-damage", expectedMovementAnswer: "reposition", status: "reviewed" }
          roleMix: [{ roleId: relief, minCount: 1, maxCount: 1, spawnAnchorSetId: "none", arrival: "none" }]
          objective: { id: "reposition", winCondition: "duration", optional: true }
          counterplay:
            safeLaneAnchorIds: ["all-open-lanes"]
            requiredTelegraphs: []
            forbiddenStates: ["new-major-spawn", "forced-hit"]
          durationTicks: { min: 900, max: 1500, exit: "duration_and_no_major_engagement" }
          cooldown: { selfTicks: 0, objectiveTicks: 0, roleFamilyTicks: 0 }
          eligibility:
            requiresPreviousPhase: [fade, peak]
            excludesRecentSignatures: 0
            excludesRecentObjectives: 0
            requiresReachableSafeLane: true
          variation:
            candidateSpawnAnchorSetIds: ["none"]
            stableCandidateOrder: "lexicographic-id"
            selectionDomain: "encounter.relief"
```

**Schema validation rules.** Reject an authored schedule before play if any ID is duplicated; a min/max is negative or inverted; a duration/cooldown/telegraph lead is non-integer or non-60 Hz; a role or `primaryRoleFamily` is absent from the catalog vocabulary; a safe lane or telegraph spec is absent; a telegraph has no positive `leadTicks` or lacks a persistent non-motion/non-color-only channel; a non-relief card lacks a starting-state envelope or a reviewed baseline-build coverage entry; any coverage entry is `unknown`; an adjacency/cooldown rule cannot be satisfied; the authored `fallbackOrder` is not unique, stable, and resolvable to known cards; or the stage has no relief card. Resolve the whole card sequence at stage start (or record each resolution in the run trace before it can influence play), then validate reachability and coverage against the same rules snapshot.

**Landmark validation.** Every card has `cardKind: normal|landmark`. Each landmark card appears exactly once in `landmarkDeckCardIds`; every listed deck ID resolves to `cardKind: landmark`; every `landmarkFallbackCardIds` entry resolves to `cardKind: normal`; neither list has duplicates; and an exhausted landmark deck may only select its declared normal fallback. Reject the stage otherwise.

## Deterministic schedule safeguards

1. **One rules snapshot.** Record `grammarVersion`, `catalogDigest`, stage ID, run seed, and all selected card/anchor IDs in the save/replay header. A changed catalog or grammar is a different replay contract; do not silently replay it as the old one.
2. **Addressable encounter randomness.** Derive a decision value from stable fields such as `(runSeed, grammarVersion, stageIndex, segmentIndex, cardDecisionIndex, domain)`. Domains are separate for `encounter.card`, `encounter.spawn-anchor`, `encounter.count`, `loot`, and `cosmetic`. Render/audio/VFX/narration may not consume an encounter domain. This is the bounded application of S3's key/counter model.
3. **Stable candidate resolution.** Filter eligibility using only current 60 Hz simulation state; sort candidate IDs lexicographically; then choose with the named domain. Never depend on unordered collection iteration, frame time, wall clock, asynchronous asset completion, or presentation events.
4. **Tick-only time.** `startTick`, `endTick`, cooldown expiry, phase transition, and queue order are integer ticks. For a 60 Hz simulation, a three-second duration is encoded as `180`, not a floating seconds value.
5. **Deterministic fallback.** Each stage's authored `fallbackOrder` is a stable list of card IDs. If the selected card fails a reachability or cooldown check, filter that list by the same current eligibility rules, choose its first valid ID, and emit `encounter_fallback(selectedId, reason, fallbackId)`. The validator rejects a missing, duplicate, or unknown fallback ID. Never re-roll until something works.

   **Landmark deck rule.** Consume `landmarkDeckCardIds` without replacement. An exhausted landmark deck filters `landmarkFallbackCardIds` by current eligibility and selects its first valid normal card; it never resets the deck or falls through to another landmark.
6. **Replay checkpoint.** At every phase boundary write `(tick, phaseId, selectedCardId, selectedAnchors, rules digest, scheduler state hash)`. A headless replay must produce the same ordered checkpoint list and terminal result; cosmetic-event logs are excluded from this comparison.

## Boredom, repetition, and anti-dominant-build contract

### Signals to collect, not claims to make

| Signal | Definition | Why it is only a candidate signal |
| --- | --- | --- |
| Encounter-signature recurrence | Ordered vector of `phase`, role counts, objective, anchor topology bucket, landmark/modifier set, and intensity band. Measure exact duplicate rate and recurring 2-/3-card n-grams within a run. | Same signature may remain enjoyable in a different spatial context; validate against reported repetition. |
| Movement-loop recurrence | Quantize heading/speed plus safe-lane entry/exit and classify repeated steering loops during a card. | A consistent loop can be effective mastery or an accessibility adaptation. |
| Relief validity | During a `relief` card, log new major-role spawns, reachable lane count, damage events, and time to a clear route. | A low event count does not by itself prove the player perceived recovery. |
| Encounter exit/abandon | Log voluntary post-card/menu exit only in consented playtests, with prior signature history. | Interrupted sessions and finished goals confound it. Never use as a hidden in-run difficulty input. |
| Build conditional outcome | Per build and comparable cohort: clear rate, effective survival time, damage avoided, route-progress rate, and resource delta, stratified by stage, card signature, seed family, starting health, and rules version. | Build selection and player skill confound raw win rate; no strict game-theory “dominance” claim is warranted in a single-player loop. |
| Subjective anchor | At selected card boundaries in playtest, collect one optional rating each for “repetitive,” “fair/readable,” and “wanted more pressure.” | This is the validation label for telemetry; keep it separate from run simulation. |

### Anti-dominant-build composition constraints

These are original rules to test, not balance claims:

- Every non-relief card declares **at least one** movement-only counterplay path and a telegraph. The scheduler rejects a card if it cannot materialize that path at the selected anchors.
- Do not use role selection as an opaque hard counter to a build. A role may expose a trade-off (for example, a stationary-damage build must move through a safe lane), but all baseline catalog-compliant builds must retain a deterministic survival route under the card's stated starting-state envelope.
- Build coverage is an authored matrix: each card lists valid baseline build tags and its expected movement answer. No card ships with an unreviewed `unknown` coverage cell.
- A card's reward/advancement cannot require an optional high-risk objective that a baseline build cannot execute. This prevents an apparently survivable encounter from becoming progression-hostile.
- If a build overperforms, change the authored role/route trade-off or catalog rule after paired replay evidence; do not introduce hidden seed-specific punishment or mid-run personal adaptation.

## Measurable pattern targets

These are deliberately falsifiable calibration targets; none are presented as research-established universal thresholds.

1. **[TARGET—UNVERIFIED] No forced repeat rhythm.** In a 12-card non-relief window, exact signature duplicates are at most `2`, no 3-card signature n-gram repeats, and no primary objective is consecutive. **Measurement:** resolved schedule trace before a run; fail the content build on violation.
2. **[TARGET—UNVERIFIED] Genuine relief.** Each stage segment has at least one `relief` interval of `900–1500` ticks and logs `0` new major-role spawns during it; the designated safe lane remains reachable from all eligible spawn anchors. **Measurement:** 60 Hz event trace plus headless reachability test.
3. **[TARGET—UNVERIFIED] Legible peak duration.** A normal `probe` is `180–360` ticks, `pressure` is `360–600` ticks, and a non-landmark `peak` has a declared cap of at most `900` ticks before fade or objective resolution. **Measurement:** card schema validation and transition trace. These ranges are an Abyssal starting hypothesis, not a port of S1's timings.
4. **[TARGET—UNVERIFIED] Role-family rotation.** Across any four non-relief cards, at least `3` primary role families occur; a `denier` or `flanker` card is never followed by the same primary role family without a `relief` card between them. **Measurement:** stage schedule linter against resolved card IDs.
5. **[TARGET—UNVERIFIED] No unexplained build outlier.** Within a stratified cohort (same rules version, stage, starting-state band, card signature, and seed family), flag a build for review if its route-progress and survival-time median both exceed the cohort median by `25%` **and** its damage-taken median is no worse. **Measurement:** paired seed replay and bootstrap confidence interval; do not nerf from a flag alone.
6. **[TARGET—UNVERIFIED] Repetition signal must agree with people.** Treat a signature/movement recurrence alert as actionable only if it has a pre-registered association with higher optional repetition ratings or voluntary post-card exit in a playtest cohort; otherwise retain it as an observation. **Measurement:** blind card-order test and analysis plan locked before results.

## Experiments and telemetry

### E1 — Grammar versus density-ramp comparison

- **Question:** Does authored alternation improve perceived variety without reducing movement engagement?
- **Design:** Paired, counterbalanced local playtest. Compare the grammar above against an equal-total-threat monotonic density ramp. Hold stage, catalog digest, seed family, starting state, and run length constant; rotate order.
- **Collect:** schedule trace, signature recurrence, movement-loop recurrence, relief-validity events, survival/route progress, optional ratings for repetition/fairness/desired pressure, and post-card exit.
- **Pass condition [TARGET—UNVERIFIED]:** grammar condition reduces reported repetition without a worse fairness rating or lower route-progress rate. Do not claim causality if the paired analysis is not run.

### E2 — Deck versus independent random selection

- **Question:** Does a no-repeat bag reduce visible repetition beyond seeded independent picks?
- **Design:** Same authored cards and fixed seeds; compare independent weighted choice, no-immediate-repeat, and shuffle-bag choice. Present anonymized replay clips to raters who do not know the generator.
- **Collect:** exact/n-gram recurrence, card-order ratings, and deterministic checkpoint trace.
- **Pass condition [TARGET—UNVERIFIED]:** shuffle bag improves perceived non-repetition while preserving card eligibility, stage difficulty budget, and identical replay checksums for each condition.

### E3 — Spatial fairness and build coverage sweep

- **Question:** Does every baseline build have a movement-only answer to every eligible card?
- **Design:** For every `(card, anchor set, baseline build, starting-state band)` tuple, run a deterministic headless replay with a scripted movement policy that uses only the card's declared safe-lane response; then manually inspect failures.
- **Collect:** reachability, unavoidable damage before telegraph, forced-hit count, clear/route progress, phase trace, catalog/grammar digest.
- **Pass condition [TARGET—UNVERIFIED]:** zero tuples fail due to a missing declared route or an untelegraphed forced hit. A policy failure due to intentionally poor steering must be distinguished from a geometry/card failure.

### E4 — Dominance review with paired seeds

- **Question:** Is a build's apparent advantage caused by the build, encounter mix, player skill, or a seed artifact?
- **Design:** Run matched scripted and human playtests over the same seed families, stage/card schedule, starting state, and rules version. Stratify before aggregation.
- **Collect:** build vector, conditional outcomes, movement answer used, card signature, seed family, and subjective fairness/range ratings.
- **Pass condition [TARGET—UNVERIFIED]:** no catalog adjustment is made until a suspected outlier reproduces across paired seeds and the coverage matrix identifies the interaction that caused it.

## Stage 2 design-to-measurement synthesis

**Status.** This section is a future, data-only encounter contract. It makes the proposed mini-boss, boss, big-wave, and role-combination targets measurable without authorizing a catalog, runtime, reward, progression, or gate-state change. **G2, G3, and G8 are NOT MEASURED / NOT PASSED.** The existing 15/15 replay-identical G2 receipt is integrity-only; it is not an equal-budget five-archetype balance result and cannot satisfy G2 ([`pcg-map-and-wave-survey.md`](pcg-map-and-wave-survey.md#L228-L230); [`architecture-contract.md`](../engineering/architecture-contract.md#L126-L135)).

### Plan boundary — resolve once, then execute

The authored `StageSpec`/catalog and complete replay tuple first resolve `MapPlan`, `WavePlan`, and `BossPlan`; their validation reports and canonical digests must be admitted **before tick 0**. `MapPlan` supplies the resolved node/anchor set; `WavePlan` supplies every non-boss card, count, anchor, start/end tick, and fallback trace; `BossPlan` supplies the Gate-linked variant, acts, act modifiers, and fixed escalation ledger. They are immutable authoritative inputs thereafter. This is the synthesis of the map-plan authority boundary ([`pcg-map-grammar.md`](pcg-map-grammar.md#L50-L57), [`pcg-map-grammar.md`](pcg-map-grammar.md#L117-L122)) and the complete stage-plan boundary ([`pcg-map-and-wave-survey.md`](pcg-map-and-wave-survey.md#L49-L70), [`architecture-contract.md`](../engineering/architecture-contract.md#L18-L65)).

1. At compilation, filter only catalog-approved candidates against the immutable map, slot predicate, reviewed starting-state envelope, and named role/adjacency history; byte-sort IDs; select only through the recorded named domain (`wave.card`, `wave.anchor`, `wave.count`, `wave.timing`, `boss.variant`, or `boss.act`).
2. Resolve every selected card/act, anchor set, count, integer start/end tick, safe lane, pressure token total, deck cursor, and selected-or-fallback reason into canonical plan bytes. A failed candidate takes the first eligible ID from its authored stable fallback list and records `(candidateId, predicateId, fallbackId)`; it never re-rolls or changes seed.
3. At tick time, the scheduler may only consume the already-resolved plan at its integer tick. It MUST NOT choose a card, anchor, role combination, boss act, count, fallback, or difficulty response from current health, player behavior, device/frame state, observer output, wall time, telemetry, or a random runtime draw.
4. A map/slot predicate failure, candidate exhaustion, missing coverage row, or replay digest mismatch rejects the content tuple. It does not permit a replacement seed, an unlogged runtime selection, or a lower pressure budget. Observer modes remain downstream-only and must not change plan bytes or checkpoints ([`architecture-contract.md`](../engineering/architecture-contract.md#L11-L16), [`pcg-map-and-wave-survey.md`](pcg-map-and-wave-survey.md#L191-L216)).

### Staged encounter constraints **[TARGET—UNVERIFIED]**

| Encounter form | Authored pre-tick plan rule | Spatial/sequence constraints | Testable variety target |
|---|---|---|---|
| **Mini-boss** | A `peak` card selected only from the resolved landmark deck; permit Stage 4–5 reference bands of 15–30 s and Stage 6–9 bands of 24–42 s. | One announced route choice; at least two reachable movement responses for every covered archetype; no boss overlap; `fade` then 900–1500-tick `relief` are mandatory before any big wave or next landmark. | Its mechanic vector cannot exactly match any mini-boss/boss vector in the preceding three stages; a reprise changes both topology bucket and declared movement answer. |
| **Big wave** | A resolved `pressure`/`peak` card with 18–36 s to its authored fade condition; normal units remain in ordinary TTK bands. | Exactly two complementary primary roles, or three only in Bands 4–5 with exactly one `anchor` **or** `denier`; declared seam/lane remains reachable; no major role enters during `fade`. | It cannot follow a mini-boss/boss without the required `fade` and `relief`, and it cannot use the same primary role family as the preceding non-relief pressure card. |
| **Boss** | The only `BossPlan` attaches to the single Gate after the ObjectiveAnchor; choose its approved variant/acts before tick 0. Acts have a fixed total pressure ledger and an authored terminal condition. | `BossIntro` has ≥180 telegraph ticks; Act 1/2 each retain a safe lane; intermission is 300–600 ticks with no unavoidable fresh major spawn; Act 2 route question differs from Act 1; optional Act 3 is finite; Stage 10 schedules zero post-clear major spawns. | No immediate boss variant or act-signature repeat inside the stage deck; all phase questions must be taught in an earlier stage or separately introduced before recombination. |
| **Role combination** | Each card records its role mix, signature, objective, topology bucket, anchors, safe lane, telegraph, and reviewed movement-only answer per archetype. | `screen+pursuer`, `flanker+ordinary`, `anchor+screen`, `anchor+flanker`, `denier+pursuer`, and `harvester+low pressure` retain the allowed-stage and prohibition matrix ([`encounter-boss-variety-survey.md`](encounter-boss-variety-survey.md#L89-L96)); never pair `denier` with `flanker`, seal all lanes, or spawn on the current player position. | In each 12-card non-relief window: ≤2 exact signature duplicates, 0 repeated ordered 3-card signature n-grams, ≥3 primary role families in every four non-relief cards, and no early landmark-bag reset. |

The duration, decision, and recovery bands above remain proposed calibration ranges from the encounter survey, not measured combat outputs ([`encounter-boss-variety-survey.md`](encounter-boss-variety-survey.md#L31-L39), [`encounter-boss-variety-survey.md`](encounter-boss-variety-survey.md#L53-L66)). They preserve the existing six-phase card rhythm and mandatory relief ([`pcg-map-and-wave-survey.md`](pcg-map-and-wave-survey.md#L147-L160)), rather than creating a second scheduler.

### Anti-dominance and boredom-risk metrics **[TARGET—UNVERIFIED]**

All aggregation is stratified by the complete authored cohort:
`rulesDigest, grammarVersion, stageId, mapDigest, stagePlanDigest, cardId/signatureId, bossAct when present, anchorSetId, startingStateEnvelopeRef, seedFamily, scripted movement policy, and archetype`. Never aggregate across a different pre-tick plan and call the difference build skill.

| Metric | Computation | Target / disposition |
|---|---|---|
| **Dominance alert** | For each complete cohort, calculate each archetype's median route progress, survival time, and damage taken. Flag when one archetype is >25% above the cohort median in **both** route progress and survival time while its median damage taken is no worse. Retain paired per-seed rows and a confidence interval; do not use a blended all-stage average. | A flag is diagnosis, not an automatic nerf. It blocks the affected G3 interpretation until paired replay and coverage review identify whether the cause is rules, route, card, anchor, or policy. |
| **G2 parity cross-check** | On the same complete cohorts, report class/build TTK p5/p50/p95, matchup result, combo EV, cooldown evidence, route outcome, and first forced-hit/divergent tick. | Every encounter class targets TTK within ±15% of its reference and no combo pair above 1.30× median EV; any out-of-band row blocks that authored record from G2 evidence. |
| **Boredom-risk schedule signal** | Lint the resolved signature trace for exact duplicates, 3-card n-grams, primary-role rotation, landmark mechanic-vector recurrence, and relief validity. Pair the flagged/unflagged clips with optional post-run `repetitive`, `fair/readable`, and `wanted more pressure` ratings. | A recurrence is only a triage signal. It becomes actionable only when its preregistered paired study associates it with worse optional repetition ratings without a compensating fairness/route benefit; it never adapts the live run. |
| **G8 distinctiveness check** | Keep the schedule/descriptor corpus separate from the five-comparable ledger and a fixed-seed first-impression task. Record the exact plan digest, clip, criterion, source, reviewer score, and missing session rows. | The gate target remains ≥1 element occurring in ≤2 of ≥5 comparables **and** QA impression ≥4/5. Existing deterministic/comparator context without a human session is not a score or a pass. |

This preserves the distinction between a behavior trace and a player-experience claim ([`wave-encounter-composition.md`](wave-encounter-composition.md#L234-L245)); the catalog/route rules may be changed only after the paired evidence identifies an authored cause, never by per-player counter-selection.

### Five-archetype sweep and gate evidence contract

The required sweep is **Bulwark, Striker, Gambit, Conductor, and Rift hybrid**. For every eligible resolved mini-boss, boss act, big wave, and role-combination card, run all five archetypes at equal authored budget across matched seed families, the same `MapPlan`/`StagePlan`, reviewed starting-health band, and declared movement-only policy. First run the deterministic route reachability/telegraph fixture; then retain headless and moderated-player rows separately. A missing cell, unknown movement answer, altered plan digest, or observer-induced divergence is a failed/incomplete fixture—not an excusable exclusion. This matches the required five-profile scope and its unimplemented/deferred measurement surface ([`architecture-contract.md`](../engineering/architecture-contract.md#L126-L135), [`pcg-map-and-wave-survey.md`](pcg-map-and-wave-survey.md#L220-L230)).

| Target check | Owner | Measurement method | Required future evidence path | Blocked / deferred condition |
|---|---|---|---|---|
| Pre-tick plan purity and deterministic encounter replay | game-programmer + game-QA | Fresh-process ×3, serial/permuted compilation, and normal/reduced/muted/no-observer cadence differential over the resolved plan corpus; compare plan bytes, fallback traces, phase checkpoints, and terminal hashes. | `qa/replay-corpus/map-plan-replay-report.json`; `qa/replay-corpus/observer-differential-report.json` | BLOCKED until immutable map/wave/boss plan compilation and the complete corpus exist; any replacement seed, unlogged fallback, or unequal hash fails the fixture. |
| Mini-boss/boss/big-wave G2 parity | game-QA (fixture owner); game-designer (authored interpretation) | Equal-budget five-archetype sweep by encounter class and boss act; emit TTK p5/p50/p95, matchup, combo EV, cooldown evidence, safe-lane/forced-hit trace, and plan identity. | `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` | **G2 NOT MEASURED / NOT PASSED.** Deferred by the absent five-profile fixture surface and active-skill EV/cooldown accounting; the integrity-only receipt is insufficient. |
| Archetype viability and anti-dominance | game-QA (measurement); game-designer (route/coverage review) | Five-archetype matched-plan rotation with scripted and moderated rows; test ≥3 independently viable archetypes, zero missing declared route, and no >50% optimal-play dominance; review every +25% dominance alert. | `qa/evidence/gates/G3-archetype-rotation-and-playtest.jsonl` | **G3 NOT MEASURED / NOT PASSED.** Blocked until every eligible card/archetype/anchor/envelope cell is implemented, measured, and human rows are available. |
| Repetition/boredom-risk lint | game-designer (signature/grammar owner) + game-QA (study owner) | Run the 12-card / four-card / landmark-vector lint on the resolved corpus; preregister and perform the paired grammar-versus-density and clip-rating protocol without using ratings as runtime input. | `qa/evidence/gates/G8-novelty-comparison-and-impression.json` | **G8 NOT MEASURED / NOT PASSED.** Existing artifact lacks a human impression session and score; a lint result or deterministic seed variation alone is not gate evidence. |
| G8 comparator and first-impression criterion | game-QA | Five-title ledger plus fixed-seed moderated first-exposure task; preserve reviewer/source/criterion/plan-digest linkage and report missingness rather than inferring a score. | `qa/evidence/gates/G8-novelty-comparison-and-impression.json` | **G8 NOT MEASURED / NOT PASSED** until the ≤2-of-5 comparative condition and ≥4/5 human impression are both measured; the current artifact explicitly has no impression score ([`qa/evidence/gates/G8-novelty-comparison-and-impression.json`](../qa/evidence/gates/G8-novelty-comparison-and-impression.json#L3-L17), [`qa/evidence/gates/G8-novelty-comparison-and-impression.json`](../qa/evidence/gates/G8-novelty-comparison-and-impression.json#L244-L252)). |

No row above changes the authoritative QA ledger or authorizes release. The next admissible work is a versioned fixture/corpus and the named local evidence; this packet neither measures nor passes G2, G3, or G8.

## Risks, contradictions, and required failure test

### Authority-leak failure mode: presentation changes simulation

**Failure mode.** A VFX/audio/narration callback consumes the shared RNG, completes asynchronously, or gates a phase transition. This can change card selection or timing between machines and makes a supposedly fair seed unreplayable.

**Falsification test.** Run the same input/seed/catalog/grammar for a full Stage 10 completion in (a) headless/no-presentation mode and (b) maximal presentation plus reduced-motion mode. Compare the ordered phase-boundary checkpoint tuples and terminal simulation state hash. **Any difference fails.** Presentation may differ visually/audibly; simulation schedule and result may not.

### Accessibility failure mode: variation hides the movement answer

**Failure mode.** A flanker/denier relies on motion, particle density, color, or audio alone, so a reduced-motion player cannot identify the safe lane in time. Variation has then increased sensory complexity even though it did not add a button.

**Falsification test.** For every card requiring a telegraph, render the reduced-motion configuration and verify that a persistent non-motion, non-color-only lane marker appears at least the card's authored telegraph lead time before danger. Replay E3 with that presentation configuration; any forced-hit delta caused by missing information fails the card.

### Fairness failure mode: an eligible card has no survivable declared answer

**Failure mode.** A selected role/anchor combination seals the declared lane or causes unavoidable damage before its declared telegraph lead time for an eligible baseline build and starting-state envelope. It is neither fair nor solved merely because a different build or spawn could survive.

**Falsification test.** Enumerate schema-authored `(card, anchor set, reviewed baseline build, starting-state envelope)` tuples and run E3's deterministic movement-only replay. **Any** tuple with no reachable declared lane, an `unknown` coverage entry, or unavoidable pre-telegraph damage fails the card and blocks the schedule. Store the failing tuple, tick, telegraph spec, and checkpoint trace so the result is reproducible.

### Other risks

- **Overconstrained decks:** no valid card may remain after cooldowns. The deterministic fallback must be authored and logged; a random retry loop only conceals a content error.
- **False boredom diagnosis:** telemetry signals may track mastery, disability accommodation, or session interruption. Ratings and paired study design are required before a grammar change.
- **Novelty versus fairness:** a role combination can be novel but accidentally seal every lane. Reachability validation is a precondition, not a balance afterthought.
- **Stage 10 dilution:** a late landmark must resolve ending intent rather than reset the deck into another endless survival cadence. Treat it as a fixed authored end card with its own replay contract.

## Recommended decision

Adopt a small authored card grammar with deterministic deck selection, explicit spatial counterplay, mandatory relief, and a replay checkpoint contract. Start calibration with the six targets above, but ship no target as “proven” until E1–E4 produce paired evidence. This adds compositional variety through route questions and rhythm, not through more inputs, hidden adaptation, or presentation authority.
