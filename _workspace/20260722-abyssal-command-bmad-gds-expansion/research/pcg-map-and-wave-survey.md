# PCG Map and Wave Survey — Finite Grammar, Replay-Safe Extension

**Status:** Research and implementation-planning artifact, 2026-07-22. All numeric values marked **[TARGET—UNVERIFIED]** are original calibration hypotheses. This document claims no implementation, corpus result, human outcome, or gate PASS.

**Audience and action:** Engineers can turn the proposed catalog schemas, pure plan compiler, and corpus checks into a bounded vertical slice. Designers can author only approved modules, encounter cards, and boss acts. QA can reject the first invariant or replay divergence.

## Decision and boundaries

Use an **authored finite graph grammar** that compiles a complete `StagePlan` before simulation tick 0. It binds a finite spatial map, its biome/domain palette, encounter slots, and a complete wave/boss schedule. The plan is immutable throughout the run. The generator may select from reviewed records and integer ranges; it may never invent a map module, biome, objective, enemy, reward, campaign transition, or Stage 11.

“Effectively unbounded stage extension” has one safe meaning here: a finite, versioned grammar can address a very large set of reproducible **variants** and future authored stage specs using stable seeds. It **does not** mean unbounded geometry, chunk streaming, runtime generation after tick 0, or an endless campaign. Each run has a finite `StagePlan`; the product retains its authored ten-stage campaign and Stage 10 ending.

### Explicit implementation boundaries

| Boundary | Required rule | Prohibited |
| --- | --- | --- |
| Authoring authority | `defense-catalog.js` (or catalog-referenced immutable data) owns stage semantics, module/card/boss records, versions, and numeric envelopes. | Renderer-, asset-, or network-owned gameplay data. |
| Plan compiler | Pure deterministic core compiles and validates the map and wave plan before tick 0. | Regeneration, adaptive reseeding, or a replacement seed after admission. |
| Simulation | Fixed 60 Hz, integer ticks and stable entity/action ordering resolve the committed plan. | Wall-clock durations, floats as serialization identity, or unordered iteration. |
| Observers | HUD, Canvas, VFX, audio, narration, accessibility modes, export, and local telemetry read resolved facts only. | RNG consumption, plan mutation, spawn choice, result gating, or campaign writes. |
| Persistence | Replay/save stores a complete protocol tuple and canonical digests. | A display seed without version/algorithm/catalog identity. |
| Offline product | Local deterministic single-player only. | Network, account, commerce, cloud sync, remote service, or runtime provider dependency. |

The local product contract requires movement-first automatic combat, deterministic 60 Hz simulation, offline local saves, and Stage 10 campaign completion. It is the governing source; this packet does not change it.[P0]

## Evidence ledger

| ID | Source (accessed 2026-07-22) | What it supports | Limit |
| --- | --- | --- | --- |
| P0 | [Abyssal Command defense/survivor design](../../../docs/abyssal-command-defense-survivor-design.md) — primary project contract | Fixed 60 Hz replay, automatic combat, offline/local operation, fixed ten-stage campaign, Stage 10 ending, observer projection boundary. | Does not prescribe a generator or targets. |
| E1 | Joris Dormans, [*Adventures in Level Design: Generating Missions and Spaces for Action Adventure Games*](https://doi.org/10.1145/1814256.1814257), 2010 — primary scholarly publication | Separates mission graph generation from spatial realization. | Different genre; does not establish this grammar or replay protocol. |
| E2 | Michael Booth, Valve, [*Replayable Cooperative Game Design: Left 4 Dead*](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf), 2009 — primary developer presentation | Designer-bounded possibilities, constrained population/placement, and structured unpredictability. | Co-op shooter; its content, pacing numbers, and director behavior are not imported. |
| E3 | Melissa E. O’Neill, [PCG reference implementation: basic C usage](https://www.pcg-random.org/using-pcg-c-basic.html) — algorithm-author documentation | Same initialization arguments reproduce a PCG sequence; state and stream are material. | A PRNG does not make the whole game deterministic. |
| E4 | Salmon, Moraes, Dror & Shaw, [*Parallel Random Numbers: As Easy as 1, 2, 3*](https://www.thesalmons.org/john/random123/papers/random123sc11.pdf), SC11 2011 — peer-reviewed primary paper | Application-variable-derived streams avoid dependence on machine/task order. | Does not specify level or encounter design. |
| E5 | Godot Engine, [Random number generation](https://docs.godotengine.org/en/stable/tutorials/math/random_number_generation.html) — official documentation | Independent RNG state and shuffle bags are practical ways to preserve reproducibility and reduce visible repeat patterns. | Engine-specific API; it does not validate enjoyment targets. |
| E6 | Khalifa et al., [*The Procedural Content Generation Benchmark*](https://arxiv.org/html/2503.21474v2), FDG 2025 author version — primary scholarly paper | Quality/validity, diversity, and controllability must be measured separately. | Benchmark definitions require adaptation to this graph and card domain. |
| E7 | Glenn Fiedler, [*Fix Your Timestep!*](https://gafferongames.com/post/fix_your_timestep/) — primary practitioner article | Fixed simulation steps prevent render cadence from becoming rules time. | Does not specify plan serialization. |

**Synthesis:** E1 supports separating fixed objective semantics from spatial realization. E2 and E5 support selection from authored alternatives with an anti-repeat deck rather than unrestricted randomness. E3/E4 support an explicit versioned, named-stream protocol. E6 supports reporting validity, diversity, and controllability separately. E7 reinforces P0’s 60 Hz authority boundary. The proposed counts and thresholds below are not source-derived.

## Seed-to-map-to-wave contract

### Deterministic inputs, outputs, and forbidden inputs

| Artifact | Required canonical fields | Owner / timing |
| --- | --- | --- |
| `StageSpec` | `stageId`, `stageIndex`, `worldDomainId`, `objectiveRef`, `mapGrammarVersion`, `waveGrammarVersion`, `moduleCatalogVersion`, `encounterCatalogVersion`, `bossCatalogVersion`, `constraintVersion`, bounded role/palette/envelope references | Authored catalog; immutable before run creation. |
| `ReplayKey` | `stageId`, `runSeedU64BE`, all versions above, `prngId`, `subseedHashId`, `digestId`, `canonicalEncodingVersion`, ordered named stream IDs | Save/replay header; required before compile. |
| `StagePlan` | `ReplayKey`, `MapPlan`, `EncounterSlotPlan`, `WavePlan`, `BossPlan`, per-plan validation reports, `stagePlanDigest` | Pure compiler output, admitted before tick 0 and immutable afterward. |
| `MapPlan` | canonical nodes/edges, module IDs/transforms, integer coordinates, canonical W-01…W-05 labels, biome/domain tags, map digest | Deterministic-core input. |
| `WavePlan` | `encounterPlanId`, `ReplayKey`/named-derivation identity, ordered slots/cards, integer start/end ticks, counts, spawn-anchor IDs, stable `spawnPolicyIds`, pressure-budget tags, card/deck cursor trace, wave digest | Deterministic-core input. |
| `BossPlan` | Gate-linked boss card ID, ordered acts, escalation tokens, act trigger ticks/authoritative state conditions, fallback policy, boss digest | Deterministic-core input. |

**Forbidden inputs:** `renderDelta`, frame rate, wall clock, locale, device form factor, input latency, audio/VFX/narration completion, reduced-motion preference, asset load completion, network, account state, telemetry, player-survey response, object insertion order, and global/shared RNG position. A cosmetic choice must use its own named stream and cannot alter `StagePlan` bytes.

### Canonical bytes and named randomness

The protocol should retain the current architecture contract’s canonical encoding: NFC-normalized UTF-8 strings with unsigned 32-bit big-endian lengths; unsigned/signed 64-bit integers encoded big-endian/two’s-complement; one-byte booleans; length-prefixed arrays; byte-sorted node/edge records. Compute `stagePlanDigest = SHA-256/1(canonical StagePlan bytes)`. Do not use incidental `JSON.stringify` or host object ordering as replay identity.

For each decision derive `D = SHA-256/1(canonical ReplayKey bytes || length-prefixed domain || length-prefixed stableDecisionId || u32 ordinal)`. Decode `D[0..7]` as `initstate` and `D[8..15]` as `initseq` for `pcg32-xsh-rr/1`, or retain an explicitly versioned counter-based generator. The chosen algorithm is less important than preserving the exact ID and canonical derivation forever for that replay tuple.

Required non-overlapping domains:

```text
map.topology | map.module | map.transform | map.detour | map.decorative
slot.bind     | wave.card  | wave.anchor   | wave.count | wave.timing
boss.variant  | boss.act   | loot          | cosmetic
```

Candidates are filtered solely by catalog predicates, sorted lexicographically by stable ID, then selected by their named domain. A failed selected candidate follows an authored, stable fallback list and records `(candidateId, reason, fallbackId)`; it never re-rolls or changes the seed. This applies E3–E5 without making cosmetic randomness authoritative.

### Finite grammar

`StageSpec` defines a finite role alphabet. All repetitions have authored maximums; every resulting run plan is finite.

```text
Stage ::= WorldDomain Backbone Extension{0..4} EncounterSchedule GateBoss -> Resolution
WorldDomain ::= Domain(stageId, approvedModulePalette, approvedEncounterPalette, canonicalLabels)
Backbone ::= Ingress -> Orientation -> Approach{1..3} -> ObjectiveAnchor -> Gate
Extension ::= Detour | PressureBranch
Detour ::= Attach(backboneEligiblePort) -> Module{1..2} -> DeterministicRejoin
PressureBranch ::= Attach(backboneEligiblePort) -> PressureModule{1..2} -> DeterministicRejoin
EncounterSchedule ::= Slot{entry, orientation, approach*, objective, detour*, gate}
Slot ::= Approach -> Probe -> Pressure -> [Peak] -> Fade -> Relief
GateBoss ::= BossIntro -> Act1 -> Intermission -> Act2 -> [Act3] -> BossResolution
Resolution ::= ObserverOnlyRead(authoritative stage result)
```

`*` means each eligible pre-resolution spatial node can bind zero or one compatible combat slot; it does **not** introduce a new player objective. `Resolution` is not a combat slot and cannot run the six-phase rhythm; it reads only the committed result after `BossResolution`. The compiler first instantiates the fixed semantic backbone, then bounded approach/extension modules, then binds slots and resolves the full schedule. The only semantic objective is `ObjectiveAnchor`; the gate is exactly one distinct node following it on each required route.

### Why this provides extension without replay corruption

The grammar’s extension is combinatorial and addressable, not infinite runtime content. A finite module/card catalog, selectable transforms, bounded extension slots, and 64-bit keys create many possible **finite** stage plans. Adding a future authored module or stage requires a new catalog/version tuple, which intentionally creates different plan digests. Old replays must either load their exact installed tuple or report explicit incompatibility; they must never silently regenerate under newer data.

## World/biome linkage and spatial contract

`worldDomainId` is an authored stage descriptor, not a seed result. It limits spatial and encounter vocabulary while leaving the phase identity and campaign semantics fixed.

| Map role | World anchor / linkage | Generated selection may change | Must remain invariant |
| --- | --- | --- | --- |
| `Ingress` | W-04 Domain, optional W-01 label | Approved entry module/transform. | One valid spawn space and readable first route. |
| `Orientation` | W-01 Echo + W-04 | Landmark/module and low-pressure slot. | Objective bearing is discernible before high pressure. |
| `Approach` | W-04 | 1–3 compatible traversal modules and route geometry. | Progression remains toward the authored objective. |
| `Detour` / `PressureBranch` | W-04 | 0–4 bounded optional branches. | Rejoin, accessible return, no new objective or mandatory reward. |
| `ObjectiveAnchor` | W-02 Bind/Extract | Only approved physical realization. | Exactly one authored objective reference; no seed-selected prerequisite/reward. |
| `Gate` | W-03 Gate Integrity | Approved gate module and Gate encounter anchors. | Exactly one gate after objective, never a randomly selected ending. |
| `Resolution` | W-05 Archive | Approved exit/resolution geometry. | Reads only committed stage result; never creates persistence or Stage 11. |

### Map variation budget

| Dimension | **[TARGET—UNVERIFIED]** authored budget per stage | Validation rationale |
| --- | ---: | --- |
| Fixed semantic roles | Exactly 6 | Preserves orientation and campaign contract. |
| `Approach` modules | 1–3 | Creates route variety while bounding compile/search space. |
| Optional extension branches | 0–4 total; max depth 2; max 2 attached to a backbone role | Prevents an endless/opaque tree. |
| Required path branch degree | ≤3 | Keeps movement route reading bounded. |
| Domain palettes | ≥3 eligible modules per variable role where a variety target is claimed | Avoids pretending a two-item palette has broad variety. |
| Route-cost band | 0.85–1.15 × the authored reference route, integer grid units | A seed cannot become an unreviewed difficulty slider. |
| Spatial pressure tokens | 8–12 stage tokens; each node declares 0–3 | Wave allocation cannot exceed the authored envelope. |
| Candidate attempts | 32 deterministic candidates per StageSpec | Exhaustion is an authored-content failure, not permission to reroll. |

The exact token values and route bands need a future authoring baseline; they are controls to verify, not balance conclusions.

## Encounter slots, wave patterns, and escalation

### Slot binding

An encounter slot is a plan record, not a presentation callback:

```yaml
EncounterSlot:
  slotId: "stageId/nodeStableId/ordinal"
  mapNodeId: "canonical MapPlan node"
  phase: approach | probe | pressure | peak | fade | relief | boss
  allowedCardIds: ["sorted, authored IDs"]
  spawnAnchorSetIds: ["sorted, map-resolved IDs"]
  spawnPolicyIds: ["sorted catalog policy IDs"]
  startingStateEnvelopeRef: "reviewed authored envelope"
  baselineBuildCoverage: ["reviewed buildTag -> movement-only response; no unknown cells"]
  pressureTokenCap: 0 # authored integer
  requiredSafeLaneIds: ["map-resolved IDs"]
  predecessorSlotIds: ["stable IDs"]
  fallbackCardIds: ["stable authored order"]

Binding happens after map validation. A slot is invalid if its selected card has no reachable declared safe lane, lacks a compatible anchor set or `spawnPolicyId`, exceeds the node/stage pressure budget, has an unknown or absent baseline-build coverage cell, lacks a reviewed `startingStateEnvelopeRef`, fails any covered build’s declared movement-only route, or introduces an unapproved objective. Slot cardinality is finite and derived from `MapPlan` nodes, so the schedule can be fully resolved before tick 0.

### Wave grammar and target pattern budget

Each non-boss slot resolves a fixed six-phase rhythm. A phase’s duration, counts, anchors, and variation are integer ticks/integers only.

| Phase | Job | **[TARGET—UNVERIFIED]** variation / safety budget | Hard anti-repetition rule |
| --- | --- | --- | --- |
| `Approach` | Orient and establish readable movement space. | 180–360 ticks; 0–1 pressure token. | Cannot be followed by a same-signature approach. |
| `Probe` | Ask one movement question. | 180–360 ticks; one primary role family; 1–2 eligible anchor sets. | Objective/signature cannot equal the immediately previous non-relief card. |
| `Pressure` | Combine complementary route pressures. | 360–600 ticks; 2–3 tokens; exactly one declared safe lane. | Same dominant role family cannot follow itself. |
| `Peak` | Bounded landmark/elite punctuation. | Optional; ≤900 ticks; 3–4 tokens. | Landmark deck without replacement. |
| `Fade` | Let active threat resolve. | 120–300 ticks; no new major role. | Never substitutes for relief. |
| `Relief` | Reposition/readability. | 900–1500 ticks; 0 new major-role spawns. | Required after every completed pressure/peak chain. |

A `Pressure` card may use only role mixtures with declared movement-only counterplay; a `denier`/`flanker` card requires a telegraphed reachable lane, and a `screen` card requires a deterministic seam. A slot resolution stores `startTick`, `endTick`, card ID, anchor IDs, count selections, deck cursor, token total, and a phase checkpoint hash.

### Boss escalation, bounded by the Gate

Bosses are fixed authored Gate punctuations, not a stochastic “endless wave” substitute. The seed can select among approved variants/anchor sets/act modifiers only; it cannot omit the Gate, move the boss before the objective, create a new boss, extend Stage 10, or scale indefinitely with runtime performance.

| Boss phase | **[TARGET—UNVERIFIED]** pressure budget | Required invariant | Allowed deterministic variation |
| --- | ---: | --- | --- |
| `BossIntro` | 0–1 | Gate is reachable; static/text fallback telegraph exists. | Approved intro anchor/set only. |
| `Act1` | 3–4 | At least one declared safe lane from every eligible spawn anchor. | Variant deck, anchor set, 0–1 approved modifier. |
| `Intermission` | 0–1 | 300–600 ticks; no unavoidable fresh major spawn. | Approved reposition topology only. |
| `Act2` | 4–5 | Retains a reachable lane and produces a distinct declared route question from Act1. | 1–2 approved modifiers, no repeat of Act1 signature. |
| `Act3` (optional) | 5–6 | Present only if authored by the boss record; finite cap/resolution condition. | One approved finale modifier, no new semantic objective. |
| `BossResolution` | 0 | Reads authoritative boss/Gate result only. | Cosmetic stream only after resolved result. |

The escalation budget is a fixed ledger (`act1 + act2 + act3 ≤ stage boss cap`) in `BossPlan`; never a hidden multiplier from player health, device performance, survey data, or elapsed wall time. It is calibration input, not a G2 claim.

## Anti-repetition and variety controls

| Surface | Mechanism | **[TARGET—UNVERIFIED]** corpus signal | Rejection / fallback behavior |
| --- | --- | --- | --- |
| Map topology | Strip fixed backbone labels; compare variable graph/module/transform fingerprints. | Exact duplicate fingerprints ≤2% across 100 keys/stage; 10th-percentile label-aware graph distance ≥0.20. | Preserve deterministic ranked candidate order; record failure if no candidate satisfies hard constraints. |
| Palette concentration | Histogram by variable role. | No eligible module >40% of placements when ≥3 candidates exist; normalized entropy ≥0.70. | Content author adds/retunes approved alternatives; do not skew a live seed. |
| Spatial rhythm | Lock `orientation → approach → objective → gate → resolution`; vary only role-safe modules. | 100% of plans preserve six-role order and one objective. | Reject candidate. |
| Wave signatures | Shuffle bag by `signatureId`; previous-three non-relief history excludes same signature. | ≤2 exact duplicates per 12 non-relief cards; zero repeated 3-card n-gram. | Stable fallback card list after eligibility filtering; never reset a landmark bag early. |
| Role rotation | Role-family cooldown plus mandatory relief. | ≥3 primary role families per any 4 non-relief cards. | Reject/reslot card before plan admission. |
| Boss punctuation | Boss variant deck and act-signature history. | Zero immediate variant/act-signature repeat within a stage deck. | Declared normal/variant fallback, never reroll. |
| Variety versus readability | Test objective/gate recognition before pressure. | ≥10/12 correct under normal and reduced-motion captures for each evaluated stage/key pair. | Treat as a content/readability failure; do not hide it with more randomness. |

These measurements implement E6’s separation: validity is a precondition, diversity is measured only among valid plans, and controllability is enforced by versioned bounds. None is evidence that players find a plan fun until a controlled playtest collects that outcome.

## Required validation invariants

### Compile-time hard invariants

1. The complete protocol tuple is present and every referenced catalog/version/algorithm ID resolves exactly; `WavePlan` includes its `encounterPlanId`, named-derivation identity, and sorted `spawnPolicyIds` in canonical bytes/digest.
2. `stageIndex` is an integer in `1..10`. Stage 10 permits only the authored campaign-completion result reference, with no next-stage, queue, or Stage 11 transition; every other stage references only its authored campaign successor/failure contract.
3. Canonical IDs/arrays are normalized and sorted; no candidate choice depends on host iteration order or parallel completion order.
4. `MapPlan` has exactly one each of `Ingress`, `Orientation`, `ObjectiveAnchor`, `Gate`, and `Resolution`; it has one to three `Approach` nodes.
5. A navigable directed path exists: `Ingress → Orientation → ObjectiveAnchor → Gate → Resolution`. Every optional extension has a deterministic rejoin/return path.
6. Ports/transforms/occupancy/coordinates are compatible, all integer, and inside the `StageSpec` bounds; no unresolved port remains.
7. `ObjectiveAnchor` contains exactly the authored `objectiveRef`; no map/wave/boss field contains an objective order, persistent reward, campaign transition, or ending selection.
8. Every encounter slot resolves to a compatible map node, card, anchor set, spawn policy, safe lane, telegraph, integer-tick duration, pressure-token budget, reviewed starting-state envelope, and non-unknown baseline-build coverage. Every covered build/anchor tuple retains its declared movement-only route.
9. The full wave schedule has mandatory relief, valid fallback order, no prohibited adjacency/repetition, and a finite terminal tick.
10. `BossPlan` attaches to the only Gate after objective completion, has two or three finite acts, satisfies the act budget, and ends in `BossResolution` rather than an endless loop.
11. `MapPlan`, `WavePlan`, `BossPlan`, validation reports, and `stagePlanDigest` exist before tick 0. Candidate exhaustion rejects the content tuple; it never silently selects another seed.

### Replay and observer invariants

| Test | Expected result | Failure interpretation |
| --- | --- | --- |
| Same complete `ReplayKey`, fresh process ×3 | Byte-identical `StagePlan` canonical bytes, all child digests, candidate traces, and validation reports. | Hidden dependency or incomplete protocol tuple. |
| Serial vs deliberately permuted/parallel candidate evaluation | Identical selected IDs, fallback traces, and digests. | Enumeration/order leak. |
| Normal, reduced-motion, muted, no-observer, dropped, delayed, duplicated, and thrown-observer-callback replay | Equal tick-0 plan digest, ordered checkpoint sequence, and terminal canonical state hash for every observer mode. | Observer authority/RNG or observer-failure containment leak. |
| 30/60/120 Hz render cadence against one input tape | Equal authoritative state hash and phase checkpoint list. | Render time leaked into rules. |
| Negative map/card fixtures | Expected predicate ID and no fallback seed/retry. | Validation or content-error handling defect. |
| Save/reload at each phase boundary | Same remaining plan, deck cursor, tick, and terminal state hash. | Incomplete persistence or cursor ownership. |

## Gate implications — targets, not evidence

| Gate | What this plan contributes | Required future artifact / falsifier | Status |
| --- | --- | --- | --- |
| **G2 — rules and balance numbers** | A versioned pressure-token ledger and boss-act envelopes make the enemy/card conditions reproducible for the exact equal-budget Bulwark, Striker, Gambit, Conductor, and Rift hybrid sweep. No boss/wave number may be treated as balanced merely because it is deterministic. | Paired fixed-seed sweep must report health arithmetic, crit distribution, cooldown boundaries, card/boss act, TTK, EV, route outcome, and first divergent tick at `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl`; it must evaluate 100% mechanics coverage, 45–55% matchup win rate, TTK within ±15% of target, and no combo pair above 1.30× median EV. Any out-of-band result blocks the affected authored record. | **NOT MEASURED / NOT PASSED.** |
| **G3 — player-type diversity** | Slot-level safe-lane, reviewed starting-state envelope, and baseline-build coverage let Bulwark, Striker, Gambit, Conductor, and Rift hybrid be compared against the same map/wave tuple rather than luckier seeds. | Rotate all five across matched seed/card/boss-act families and recorded movement policies; report stratified route/clear outcomes plus moderated ratings at `qa/evidence/gates/G3-archetype-rotation-and-playtest.jsonl`. Evaluate ≥5 archetypes tested, ≥3 independently viable, and no archetype above 50% dominance in optimal play. Any eligible tuple without a movement-only survival route is a content failure. | **NOT MEASURED / NOT PASSED.** |
| **G7 — core loop** | The fixed `Orientation → route choice → encounter/reward → Gate/boss → result` plan makes an end-to-end loop tape inspectable without adding controls or online adaptation. | Verify the authored loop against a deterministic **90-second** fixture with offer/commit chain, meaningful objective movement decision, result/return transition, at least three distinct actions, one accepted reward, and preregistered moderated re-entry rows at `qa/evidence/gates/G7-loop-trace-and-repeat-study.jsonl`; assess the 30–180-second period and ≥70% voluntary-repeat proxy. Plan hashes must remain equal across observer/cadence variants. | **NOT MEASURED / NOT PASSED.** |

G8 will additionally consume the seed corpus, descriptor comparisons, and impression rows, but is not redefined by this document. All G1–G8 remain unpassed.

### Current G2 receipt boundary

The raw controlled G2 fixture discovery recorded **15/15 replay-identical runs** across Bulwark, Striker, Gambit, Conductor, and Rift at seeds 17/18/19, with **0 digest mismatches** in a 360-tick no-render, audio-disabled, reduced-motion local fixture. It is raw deterministic implementation evidence at `qa/evidence/gates/G2-archetype-and-combat-sweep.json`, not the required canonical JSONL gate artifact or a complete equal-budget/player-facing balance result. It remains **INCOMPLETE / NOT PASSED** and authorizes no catalog, reward, idle, monetization, release, or G2 gate change.

## Implementation handoff: smallest safe vertical slice

1. Author one existing stage’s `StageSpec`, finite module palette, encounter cards, and one two-act Gate boss; do not add mechanics, objectives, or rewards.
2. Implement a pure `compileStagePlan(ReplayKey, StageSpec, catalogSnapshot)` that materializes map, slots, wave, and boss plans before tick 0, writes canonical bytes/digests, and returns only a valid immutable plan or explicit validation failure.
3. Add a 64-key positive corpus and one negative fixture for every hard predicate. Include serial/permuted compiler modes and normal/reduced/no-observer replay comparison.
4. Only after those controls exist, collect the 100-key diversity report and paired G2/G3/G7 evidence. A corpus target miss is a content/grammar decision, not a license to use live adaptation, remote data, or unlogged reseeding.

## Source and local cross-references

- [P0 — product contract](../../../docs/abyssal-command-defense-survivor-design.md)
- [Existing map grammar proposal](pcg-map-grammar.md) — compatible source for canonical encoding, map roles, and corpus outline.
- [Existing wave composition proposal](wave-encounter-composition.md) — compatible source for card roles, wave safety rules, and replay checkpoints.
- [Architecture contract](../engineering/architecture-contract.md) — binding authority, pre-tick admission, and observer boundary.
- [Worldview](../design/worldview.md) — W-01…W-05 labels and campaign-terminality boundary.
- [QA gate measurements](../qa/gate-measurements.md) — authoritative G2, G3, and G7 methods/status.
- E1: <https://doi.org/10.1145/1814256.1814257>
- E2: <https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf>
- E3: <https://www.pcg-random.org/using-pcg-c-basic.html>
- E4: <https://www.thesalmons.org/john/random123/papers/random123sc11.pdf>
- E5: <https://docs.godotengine.org/en/stable/tutorials/math/random_number_generation.html>
- E6: <https://arxiv.org/html/2503.21474v2>
- E7: <https://gafferongames.com/post/fix_your_timestep/>
