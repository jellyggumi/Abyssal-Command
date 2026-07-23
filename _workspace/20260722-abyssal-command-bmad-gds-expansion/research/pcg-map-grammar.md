# Abyssal Command: deterministic PCG map grammar research

**Research date:** 2026-07-22  
**Scope:** Concept-validation proposal only. This packet neither changes the product contract nor defines new lore, objectives, enemies, rewards, module art, or runtime behavior.

## Research question

How can a movement-first defense/survivor make repeated runs feel spatially broad while retaining authored, readable objectives and deterministic 60 Hz replay—and without turning map generation into an unconstrained random-objective system?

## Non-negotiable boundary

The repository's product contract makes this a single-player, movement-first, automatic-combat game; it requires deterministic fixed-step 60 Hz rules, offline/local-first state, snapshot-only presentation, a fixed 10-stage campaign, and Stage 10 as the campaign ending. [P0] A generated map is therefore a **bounded plan made before play**, not an endless stream of topology, an online service, or a renderer-owned choice.

> **Decision:** unconstrained random objectives are rejected. A seed may choose only from an authored stage's pre-approved spatial modules and ranges. It may not choose, reorder, delete, reinterpret, or synthesize a player-facing objective, its prerequisite, campaign consequence, or Stage 10 ending.

“Infinite-feeling” here means that a finite authored module library produces many legible route/pressure combinations across runs. It does **not** mean infinite geometry, endless map extension, or unbounded mission generation during a run.

## Evidence ledger

| ID | Source and provenance | Observed evidence | Bounded relevance and limit |
| --- | --- | --- | --- |
| P0 | [Abyssal Command defense/survivor design](../../../docs/abyssal-command-defense-survivor-design.md) — **primary project contract, direct local source** | Requires movement-focused input and automatic combat; requires fixed-interval deterministic 60 Hz simulation; says identical saved state and input sequence reproduce the result; presentation reads deterministic state only; defines the 10-stage route and Stage 10 completion. | Governs all proposal decisions. It does not itself prescribe a PCG algorithm. |
| E1 | Joris Dormans, [*Adventures in Level Design: Generating Missions and Spaces for Action Adventure Games*](https://doi.org/10.1145/1814256.1814257) (2010) — **primary scholarly publication** | The paper presents mission generation using graph grammars and a distinct spatial realization using shape grammars. | Supports separating an objective/mission graph from physical modules. It concerns action-adventure examples, not deterministic replay, Abyssal content, or this game's exact control model. |
| E2 | Michael Booth (Valve), [*Replayable Cooperative Game Design: Left 4 Dead*](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf) (GDC 2009) — **primary developer presentation** | Slide 34 defines “structured unpredictability” as designed possibilities selected through randomized constraints; slides 64 and 69–75 describe designer-bounded population/placement choices, valid navigation areas, and constrained spawn selection. | Supports selecting among authored possibilities subject to validity checks. It describes a different, co-op shooter and does not prove procedural-map generation or deterministic replay. No title-specific content is transferable. |
| E3 | Melissa E. O’Neill, [PCG reference implementation: basic C usage](https://www.pcg-random.org/using-pcg-c-basic.html) — **primary algorithm-author documentation** | Documents PCG state plus sequence/stream and states that `pcg32_srandom_r` called with the same arguments produces the same output. | Supports recording an algorithm/variant, initial state, and stream identifier rather than a display seed alone. It does not guarantee an entire game is deterministic. |
| E4 | Ahmed Khalifa et al., [*The Procedural Content Generation Benchmark*](https://arxiv.org/html/2503.21474v2) (FDG 2025 author version) — **primary scholarly paper** | Separates quality, diversity, and controllability; defines diversity through pairwise content difference and rejects output that is identical or only small variants. | Supports reporting validity and variety separately rather than calling arbitrary randomness “variety.” Its benchmark tasks and metrics need adaptation to this graph domain. |
| E5 | Glenn Fiedler, [*Fix Your Timestep!*](https://gafferongames.com/post/fix_your_timestep/) — **primary practitioner article** | Explains that exact reproducibility from the same inputs requires fixed simulation steps rather than frame-dependent remainder steps, with 1/60 used as an example. | Reinforces P0's simulation-clock boundary. It does not specify procedural-map serialization or a full replay format. |
| E6 | Salmon, Moraes, Dror, and Shaw, [*Parallel Random Numbers: As Easy as 1, 2, 3*](https://www.thesalmons.org/john/random123/papers/random123sc11.pdf) (SC11) — **primary peer-reviewed conference paper** | States that streams derived from application variables rather than machine parameters enable deterministic results across different platforms. | Supports deriving generation randomness from stable IDs rather than task order. It is a random-number paper, not a level-design study. |

### Evidence limits

- E1–E6 justify architectural patterns and test questions, not particular Abyssal map content, difficulty numbers, module counts, objective verbs, visual language, or player outcomes.
- The target values below are **original concept-validation targets**, not claims reported by these sources.
- No external source permits copying level layouts, characters, bosses, enemy behavior, UI, art, sounds, story, or code from another game.

## Observed patterns and synthesis

1. **Mission semantics and physical space should be separate artifacts.** E1 explicitly separates a mission graph from the spatial realization. **[INFERENCE]** For Abyssal, the authored objective contract can remain stable while only its valid spatial realization changes.
2. **Randomness is more accountable when constrained by authored alternatives.** E2's “structured unpredictability” is a collection of designed possibilities with randomized constraints, not free generation. **[INFERENCE]** A module catalog, port rules, and candidate rejection log are preferable to noise-driven topology.
3. **Variation is not a quality substitute.** E4 evaluates quality, diversity, and controllability separately. **[INFERENCE]** A novel map that lacks a valid path or hides the objective is a rejected map, not a successful varied map.
4. **A seed alone is insufficient replay evidence.** E3 distinguishes state and stream; E6 makes stable application-derived streams important for platform-independent deterministic results. **[INFERENCE]** A replay key must include generator/version information and all stream namespaces, while candidate enumeration and tie-breaking must be stable.
5. **Map authority must stop at the deterministic simulation boundary.** P0 and E5 make tick-stable rules authoritative and projections non-authoritative. **[INFERENCE]** Render cadence, reduced-motion state, audio/VFX, device time, and asynchronous module loading cannot affect map selection or objective state.

## Original proposal: seed-to-map graph contract

### 1. Inputs and immutable output

This is an original contract proposal; names describe data boundaries, not an implementation mandate.

| Artifact | Required fields | Authority rule |
| --- | --- | --- |
| `StageMapSpec` (authored) | `stageId`, `mapGrammarVersion`, ordered semantic backbone, canonical objective reference, allowed module-set IDs per role, per-role copy/dimension ranges, compatibility predicates, map validation version | Authored rules authority. It is versioned and reviewed; it does not contain runtime-selected state. |
| `MapKey` (saved/replayable) | `stageId`, `runSeed` as unsigned 64-bit big-endian integer, `mapGrammarVersion`, `moduleCatalogVersion`, `constraintVersion`, `prngAlgorithmId = pcg32-xsh-rr/1`, `subSeedDerivationHashAlgorithmId = sha-256/1`, `mapDigestAlgorithmId = sha-256/1`, `canonicalEncodingVersion`, named stream identifiers | The complete identity of a map plan. A bare seed is invalid replay evidence. |
| `MapPlan` (generated before tick 0) | `MapKey`, canonical node list, canonical directed edge list, chosen module IDs/transforms, node-to-canon-anchor metadata, validation report, `mapDigest` | Immutable authoritative input to simulation. It is never selected by projection code or mutated by player-frame timing. |
| `MapSnapshot` (presentation) | Read-only geometric/objective state projection of `MapPlan` plus simulation state | May display a route/objective; cannot choose a module, reroll a branch, or change a graph edge. |

`mapDigest` is a SHA-256 digest (`mapDigestAlgorithmId = sha-256/1`) over `canonicalEncodingVersion` bytes: fields use the table-declared order and nested records use the matching versioned schema; unsigned integers are 64-bit big-endian and signed integers are two's-complement 64-bit big-endian; booleans are one byte `0x00`/`0x01`; strings are NFC-normalized UTF-8 prefixed by an unsigned 32-bit big-endian byte length; arrays are prefixed by an unsigned 32-bit big-endian count; node IDs and `(fromNodeId, toNodeId, edgeKind)` edges are sorted by their encoded bytes. Identifiers must be NFC-normalized before entry. Do not use incidental object iteration or unspecified `JSON.stringify` ordering as the replay protocol.

### 2. Fixed semantic backbone

Every stage instantiates exactly one finite backbone, in this order:

```text
Ingress -> Orientation -> Approach -> ObjectiveAnchor -> Gate -> Resolution
                     \-> [0..B] optional Detour/Pressure modules -> rejoin
```

- **Ingress:** spawn/first valid movement space.
- **Orientation:** makes the approved objective-bearing route locatable before high pressure.
- **Approach:** an authored role for traversal pressure between orientation and objective.
- **ObjectiveAnchor:** the sole primary-objective location node. Its canonical semantics come from the authored stage contract, not from PCG.
- **Gate:** an authored stage-gate location/connection, not an emergent or randomly selected ending.
- **Resolution:** a finite post-gate map role. It does not determine campaign progress; P0's authoritative stage/boss result does.
- **Detour/Pressure:** optional, bounded modules that add route choice or pressure but cannot replace, conceal, or introduce an objective. Each must rejoin a backbone node.

The grammar permits an authored stage to set `B` and every role's min/max module count, length, port type, and allowed transforms. It does **not** permit a seed to change the six role identities, add a second primary objective, or produce an unbounded chain. A stage may select `0` detours. If a desired map needs a new role, that is an authored grammar revision with a new version, not a seed outcome.

### 3. Authored modules and bounded ranges

Each `ModuleDefinition` is a finite reviewed asset record:

```text
moduleId; moduleCatalogVersion; role; ports[]; allowedTransforms[];
integerBounds; navComponents; visibility/occlusion tags; ingress tags;
objectiveEligibility; gateEligibility; pressureBudgetTag; accessibilityMarkers
```

`StageMapSpec` references only module IDs in its approved role set and supplies the bounds—e.g., `minCopies`, `maxCopies`, port-degree cap, and integer grid extents. The generator may choose a member and permitted transform, but may not synthesize an unreviewed module or alter the declared range. Spatial dimensions, placement coordinates, and route costs use defined integer grid units for generation/validation; simulation remains governed by P0's stable 60 Hz rules.

### 4. Grammar productions and hard constraints

The following original productions make selection auditable:

| Production | May select | Must preserve |
| --- | --- | --- |
| `PlaceBackbone(role)` | One approved module/transform for the current fixed role. | Its required port signature, role identity, and stage's canonical-objective reference. |
| `ExpandApproach` | A bounded number of approved Approach modules. | An oriented path from Orientation to ObjectiveAnchor; no duplicate primary objective. |
| `AttachDetour` | Zero through `B` approved Detour/Pressure modules at an authored eligible port. | A deterministic rejoin edge; no cul-de-sac unless the module declares an accessible return route. |
| `BindGate` | One approved Gate module/transform. | ObjectiveAnchor precedes Gate on every required progression path. |
| `Finalize` | A canonical ordering and digest after validation. | Exactly one Ingress, ObjectiveAnchor, Gate, and Resolution; no unresolved ports. |

Generation **rejects and logs** a candidate that violates any predicate. It never silently fixes an invalid graph with a random substitute after validation. Required predicates are:

1. exactly one of each fixed backbone semantic node;
2. a directed, navigably connected path `Ingress -> ObjectiveAnchor -> Gate -> Resolution`;
3. each optional branch has a rejoin path and leaves the primary path traversable;
4. all connected ports have compatible type/orientation and no declared occupancy collision;
5. ObjectiveAnchor and Gate use only modules explicitly eligible for that role;
6. the stage's authored dimensional, branch, degree, and pressure-budget ranges all hold;
7. all canonical references are fixed `StageMapSpec` data—no random objective ID, objective order, prerequisite, or campaign result;
8. a stable validation report and `mapDigest` exist before the first authoritative tick.

A finite candidate budget must be authored with the spec. Exhaustion is a build/content-validation failure for that `(StageMapSpec, MapKey)`; production must not fall back to a new unrecorded seed, wall-clock entropy, or an unconstrained map.

### 5. Deterministic seed rules

1. **Persist the whole `MapKey`, not just `runSeed`.** E3 establishes that a PCG stream/sequence and initialization matter, while E6 supports deriving streams from stable application variables.
2. **Derive isolated named streams from stable serialized inputs:** `topology`, `module`, `transform`, and `cosmetic`. Compute `D = SHA-256` (`subSeedDerivationHashAlgorithmId = sha-256/1`) over `(canonical MapKey bytes || length-prefixed stream name || semantic node ID || unsigned 32-bit copy ordinal)`. Decode `D[0..7]` as unsigned 64-bit big-endian `initstate` and `D[8..15]` as unsigned 64-bit big-endian `initseq`, then initialize `pcg32-xsh-rr/1` with that ordered pair. The exact derivation hash and PRNG are versioned fields. A cosmetic draw cannot consume topology randomness.
3. **Give every generated node a stable ID before selection:** `stageId / role / ordinal`. Enumerate module candidates lexicographically by `moduleId`, then transform ID; resolve equal scores with the designated stream and record the draw.
4. **Never consume RNG by iteration/thread completion order.** Parallel candidate evaluation, if introduced, receives stable node IDs and cannot change selection order. This applies E6's application-variable direction.
5. **Materialize and validate once, before tick 0.** The resulting `MapPlan` is part of the simulation's saved/replayed state. No renderer, reduced-motion branch, narration/VFX, wall clock, device locale, or network value enters `MapKey`, candidate ranking, or validation.
6. **Version changes intentionally break digest equivalence.** A changed grammar, catalog, constraint, canonical encoding, derivation hash, digest algorithm, or PRNG version is a new `MapKey` contract. Older replay files use their matching installed tuple or are rejected with an explicit incompatibility result; they are never silently regenerated under a new grammar.

## Canonical anchors and stage progression

The following link is deliberately structural. It assigns no new objective actions, lore facts, rewards, enemy content, UI strings, or campaign rules to W-01–W-05.

| Canon anchor | Map-grammar attachment | Explicit non-invention guard |
| --- | --- | --- |
| W-01 **Command Echo** | `Orientation` may carry the `W-01` anchor label for the authored stage to resolve. | The label does not define a signal modality, narrative statement, task, or completion condition. |
| W-02 **Bind/Extract** | `ObjectiveAnchor` is the only node permitted to reference `W-02`; any exact rule remains authored elsewhere. | PCG cannot choose whether a bind or extract occurs, create a second target, change prerequisite order, or alter persistent companion rules. |
| W-03 **Gate Integrity** | `Gate` carries the `W-03` anchor label and is placed only after the validated objective path. | The placement does not invent gate mechanics, integrity values, boss behavior, or unlock behavior. |
| W-04 **Domain** | `StageMapSpec` declares the finite Domain-specific module palette and allowed vocabulary for a stage. | A seed may choose only approved module IDs/transforms; it cannot create a new domain, lore, biome, or hazard taxonomy. |
| W-05 **Archive** | `Resolution` may emit a read-only reference to the authoritative completed-stage record. | It cannot persist run-only XP/skills, infer unrecorded history, create a progression flag, or decide the next stage. |

Stage progression remains P0-authoritative: a stage/boss victory opens the next stage, failure restarts the current run with run-only skills reset, and Stage 10 is the ending. The map grammar supplies readable spatial roles inside a stage; it cannot branch the campaign, rearrange stage order, or extend a post-Stage-10 route.

## Abyssal implications, targets, and experiments

All numbers in this section are **[TARGET — original concept-validation proposal]**, not source-derived facts.

### A. Seeded map identity must be replay-complete

- **Implication:** Treat the full `MapKey` and canonical `MapPlan` digest as a first-class replay artifact; a UI seed string alone is insufficient.
- **[TARGET]** For 64 fixed keys spanning at least two valid module choices per semantic role, three independent generation passes per key produce byte-identical canonical `MapPlan` encodings and identical `mapDigest` values: **192/192 exact matches**.
- **Experiment/telemetry:** Log `stageId`, all version fields, PRNG/stream IDs, candidate count, selected module/transform per stable node ID, validation predicate results, and digest. Diff the first unequal canonical field if a replay fails.

### B. Variation must alter route composition without losing authored recognizability

- **Implication:** Measure topology/module variety only after validity and objective readability pass.
- **[TARGET]** In a 100-key corpus per stage: **100%** pass all hard constraints; exact duplicate variable-subgraph fingerprints are **≤2%**; no permitted module is selected above **40%** of eligible placements unless the authored palette has fewer than three eligible alternatives.
- **Experiment/telemetry:** Strip fixed backbone labels, then calculate (1) exact variable-subgraph fingerprint collisions, (2) pairwise label-aware normalized graph distance, and (3) per-role module-selection entropy. Report invalid plans separately; never use invalid novelty to improve a diversity score. The 2%/40% gates are initial hypotheses to tune against an authored baseline.

### C. Readable objective placement is a map-quality gate, not decoration

- **Implication:** A player should be able to identify the direction/role of the approved objective before committing to a pressure branch, with no new aiming or command interface.
- **[TARGET]** In moderated first-exposure tests with 12 participants per evaluated stage, at least **10/12** identify the primary objective's direction and distinguish the gate route after Orientation; at least **10/12** retain that result with reduced motion enabled.
- **Experiment/telemetry:** Test two different valid keys per stage. Capture wrong-turn count before first objective approach, time/tick to first correct route commitment, map role misidentification, and whether any cue depended on continuous motion, audio alone, or a central combat-obscuring panel.

### D. Fairness is controlled by the authored envelope, not by luckier seeds

- **Implication:** Seeds may vary route shape and pressure composition only inside per-role authored ranges; they must not create an objectively missing route or uncontrolled difficulty spike.
- **[TARGET]** Across the same 100-key corpus, every key has a simulation-valid primary path and every measured route/pressure variable lies within the stage's declared range; **0** validation fallbacks, hidden extra objectives, or unlogged candidate substitutions.
- **Experiment/telemetry:** For each key, record shortest valid route cost, branch count, ingress count, and declared pressure-budget tags by role. Compare distributions by key quartile and manually review outliers rather than accepting an aggregate average. This does not claim equal difficulty until a separate combat-balance study defines valid difficulty measures.

## Anti-repetition metric definitions

These are proposed, inspectable measures adapted to the quality/diversity distinction in E4.

| Metric | Definition | Interpretation |
| --- | --- | --- |
| Valid-plan rate | `valid MapPlans / requested MapKeys`, with each failed predicate counted. | Quality floor. A varied invalid map remains a failure. |
| Exact variable-subgraph collision rate | Pairs of distinct keys whose canonical variable-node/edge/module/transform fingerprint matches exactly, divided by all distinct-key pairs. | Detects literal repeated map plans while ignoring intentionally fixed semantics. |
| Label-aware graph distance | Normalized edit distance across variable nodes/edges/module IDs/transforms after anchoring fixed roles; report median and 10th percentile. | Detects “small variants” that differ only cosmetically. It must be reported with validity, not optimized alone. |
| Module palette concentration | Maximum share of selections for a module within a role plus normalized Shannon entropy of that role's selection histogram. | Detects a nominal catalog that collapses to one frequent answer. Interpret only when the role has adequate eligible modules. |
| Objective-readability rate | Participants correctly identify objective and gate roles before the first pressure commitment, split by motion setting. | Detects whether spatial variety has obscured the authored purpose. |
| Authored-envelope violation rate | Plans with any route, branch, port, pressure tag, or canonical-reference value outside `StageMapSpec`. | Fairness/control floor; any nonzero result is a release blocker. |

## Reproducibility test: `MapPlanReplayCorpus`

**Purpose:** falsify the claim that fixed keys reproduce the same authoritative map, independent of projection conditions.

1. Freeze a corpus of at least 64 complete `MapKey` fixtures, including every protocol-algorithm ID and canonical-encoding version, plus expected canonical `MapPlan` byte files/digests under one explicit version tuple.
2. For every fixture, generate the map three times in fresh process state; assert canonical bytes, validation report, selected-module trace, and digest match the fixture exactly.
3. Run the same generation under two execution-order modes: serial candidate evaluation and a deliberately permuted/parallel candidate-evaluation harness. Assert identical map bytes and selected-module trace. This falsifies hidden dependency on task order.
4. Start deterministic 60 Hz simulations from the same saved simulation state and input fixture using the same `MapPlan`; replay through normal projection and reduced-motion projection. Assert equal authoritative map digest at tick 0 and equal authoritative simulation-state digest at each recorded tick checkpoint. Rendering output is not compared as gameplay authority.
5. Inject one negative fixture per hard predicate (unmatched port, unreachable ObjectiveAnchor, second objective reference, missing rejoin, out-of-range module). Assert generation rejects with that predicate ID and never replaces it with a wall-clock/new-seed fallback.
6. On grammar/catalog/constraint/canonical-encoding/derivation-hash/digest-algorithm/PRNG version changes, require either a fixture migration approved as a new version baseline or an explicit incompatibility result. A fixture that omits or mismatches a protocol-algorithm ID is rejected; a changed digest is not silently accepted as replay success.

**Pass condition [TARGET]:** all positive fixtures match exactly; all negative fixtures fail for the expected predicate; normal and reduced-motion projections yield identical authoritative checkpoints. One mismatch blocks expansion of the module catalog until its first differing serialized field and stream decision are explained.

## Risks, contradictions, and failure-mode tests

| Risk/failure mode | Why it matters | Falsification test / required evidence |
| --- | --- | --- |
| **Authority leak:** Canvas/HUD, audio, VFX, or narration selects a module or rerolls an objective after the run begins. | Violates P0's read-only projection rule and makes frame/audio/accessibility state alter gameplay. | Instrument all map-selection call sites; run normal and reduced-motion projections against the same `MapKey`/input fixture. `MapPlan` digest and authoritative checkpoint digests must match exactly. Any presentation-owned RNG call in generation is a blocker. |
| **Reproducibility leak:** enumeration order, wall clock, locale, async asset completion, or global RNG consumption changes a choice. | The same save/input can produce a different graph despite a nominal seed. | `MapPlanReplayCorpus` serial/permuted-order test plus isolated-stream trace; diff the first canonical field on mismatch. |
| **Accessibility failure:** Orientation/objective reading relies on motion, flash, or audio-only signals. | P0 requires reduced-motion static contrast/text readability while players are moving under automatic combat. | The objective-readability test must meet the same target under reduced motion; audit each module's `accessibilityMarkers` for a static non-audio route/objective cue that does not cover threats. |
| **Fairness failure:** one seed consumes the allowed topology but leaves a route untraversable or supplies unbudgeted pressure. | Randomness becomes an unreviewed difficulty system rather than authored variation. | Corpus constraint audit: zero envelope violations; inspect route/pressure outliers by deterministic key. |
| **Canon leak:** a map-production rule quietly defines what W-01–W-05 mean. | It would create content/campaign logic outside the canonical authority. | Schema review: anchors are labels/references only; reject any map field that creates objective text, objective order, reward, persistent flag, or Stage 10 continuation. |

## Recommended concept-validation slice

Create one internal map spec for one existing conceptual stage: the six fixed semantic roles, a finite module palette, explicit bounds, one canonical-objective reference, and a 64-key replay corpus. Prove the contract, constraint rejection, reduced-motion parity, and anti-repetition measurements before authoring additional role types or a larger catalog. This validates the authority and reproducibility boundary; it neither adds canonical content nor changes the current runtime.

## Source list

- P0 — project contract: [`docs/abyssal-command-defense-survivor-design.md`](../../../docs/abyssal-command-defense-survivor-design.md)
- E1 — Dormans (2010), primary scholarly publication: <https://doi.org/10.1145/1814256.1814257>
- E2 — Booth / Valve (2009), primary developer presentation: <https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf>
- E3 — O’Neill, primary algorithm-author documentation: <https://www.pcg-random.org/using-pcg-c-basic.html>
- E4 — Khalifa et al. (2025), primary scholarly paper: <https://arxiv.org/html/2503.21474v2>
- E5 — Fiedler, primary practitioner article: <https://gafferongames.com/post/fix_your_timestep/>
- E6 — Salmon et al. (2011), primary conference paper: <https://www.thesalmons.org/john/random123/papers/random123sc11.pdf>
