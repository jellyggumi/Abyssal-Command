# Abyssal Command: bounded procedural stage/world research

**Research date:** 2026-07-22  
**Scope:** Concept-validation input only. This report does not change Abyssal canon, runtime behavior, persistence, or the product contract.

## Research question

How can a movement-first, automatic-combat defense/survivor use seeded, bounded procedural stage variation and an authored phase grammar to make each run readable, pace objectives intentionally, and hand a coherent world consequence to the next stage—while preserving deterministic simulation and snapshot-only presentation?

## Constraints carried into the research

The current product contract establishes a deterministic fixed-step **60 Hz** simulation; identical saved state plus input sequence must reproduce the same result; Canvas adapters observe simulation snapshots only; persistence is offline/local; movement is the primary input; and reduced-motion must retain readable static signals. Campaign progression is a fixed **10-stage** route, where boss victory opens the next stage; run skills reset after failure; companion unlocks persist locally. These are **source-derived product constraints**, not recommendations. [P0]

The source comparison is for general structure only. It does not authorize copying characters, named places, enemies, objectives, lore, art, UI, sounds, code, or numerical tuning from any cited title.

## Evidence ledger

| ID | Source and provenance | Exact factual support | What it supports here | Boundary |
| --- | --- | --- | --- | --- |
| P0 | [Abyssal Command defense/survivor design](../../../docs/abyssal-command-defense-survivor-design.md) — **direct local retrieval; primary project contract** | “fixed time interval deterministic 60 Hz simulation”; renderer adapters “only read deterministic simulation state”; same saved state and inputs give same result; offline local persistence; boss victory opens the next stage. | Non-negotiable authority, replay, input, persistence, and campaign limits. | Existing contract, not external research. |
| E1 | [GDC Vault: *Procedurally Generating History in Caves of Qud*](https://www.gdcvault.com/play/1024990/Procedurally-Generating-History-in-Caves-of-Qud) — **direct page retrieval; primary developer presentation** | The session description says the team avoided “building a full historical simulation” by generating events and rationalizing them after the fact; it names “replacement grammars” as a way to produce convincing history on a tight scope budget. | A coherent world can be represented by bounded authored rules and derived records rather than an expensive, continuously simulated world. | The cited game’s content and history system are not a template for Abyssal content. |
| E2 | [Deep Rock Galactic: Survivor, Steam store page](https://store.steampowered.com/app/2321470/Deep_Rock_Galactic_Survivor/) — **direct page retrieval; official publisher/developer product page** | The page calls it a “single player survivor-like auto-shooter”; says each mission has its own procedural cave generation and enemy waves; and connects mission objectives, extraction, deeper progression, and becoming stronger. | Objectives can give procedural combat a legible purpose and a handoff rather than being a disconnected kill timer. | This is a comparable product claim, not a claim about its implementation. |
| E3 | [Deep Rock Galactic, Steam store page](https://store.steampowered.com/app/548430/Deep_Rock_Galactic/) — **direct page retrieval; official publisher/developer product page** | The description combines “procedurally-generated destructible environments,” cave exploration/mining, survival, and alien hordes. | A world affordance can be tightly coupled to the action loop rather than merely decorating it. | Its co-op, destructibility, mining, and named fiction are out of scope for Abyssal. |
| E4 | [Hades, Steam store page](https://store.steampowered.com/app/1145360/Hades/) — **direct page retrieval; official developer product page** | The page says every escape attempt grows the player stronger and unravels more story; the Underworld is “ever-shifting”; bosses remember the player; and permanent upgrades help the next attempt. | A repeatable action structure can retain narrative continuity when each run exposes a bounded consequence tied to existing progression. | No character, mythology, dialogue system, progression economy, or story structure is transferable. |
| E5 | [Vampire Survivors, Steam store page](https://store.steampowered.com/app/1794680/Vampire_Survivors/) — **direct page retrieval; official developer product page** | The page calls it a time-survival game with minimalistic gameplay and roguelite elements; it says the player gathers gold in a run for upgrades that help the next survivor. | Confirms the comparable genre pattern of simple in-run survival plus cross-run continuity. | Its named setting, content, economy, and exact progression are not input to Abyssal design. |

### Evidence limits

- E2–E5 are storefront descriptions, not technical postmortems. They support publicly claimed product structure, not hidden generation algorithms, timings, or retention outcomes.
- E1 is the only source here that directly describes an authored procedural-history technique. It supports **bounded grammar and post-hoc rationale** as a pattern, not an instruction to build a world simulation.
- Therefore the phase grammar, evaluation thresholds, and lore mapping below are clearly marked **original hypotheses/targets**, not source-derived claims.

## Repeated patterns and synthesis

1. **Variation is legible when an invariant purpose survives it.** E2 binds changing caves and waves to a mission objective and extraction. E3 binds procedural space to exploration and survival. In Abyssal terms, the seed may vary local geometry, enemy routes, hazard placement, and objective location, but the player must still recognize the same stage promise.
2. **Progression reads as world continuity when the game records a consequence, not merely a score.** E2’s objective/extraction loop and E4’s run-to-run story/upgrade continuity both connect a completed action to the next attempt or stage. For Abyssal, the consequence must be derived from authoritative stage completion, not from a renderer animation or an unbounded world simulation.
3. **Grammar is a scope-control device.** E1 explicitly contrasts replacement grammars with a full historical simulation. For Abyssal, authored beat labels and deterministic rules can produce a coherent local explanation without simulating an entire oceanic society/ecosystem.
4. **Minimal control schemes make objective readability more—not less—important.** E2’s auto-shooter framing and E5’s minimalistic survivor framing leave the player moving through pressure. Abyssal objectives should affect route choice and danger reading, never introduce manual aim, tactical queues, or a central combat-blocking panel.
5. **Persistent continuity need not preserve run power.** E4 and E5 demonstrate cross-run continuity in their own systems, while P0 strictly separates Abyssal’s persistent companions from run-only skills. The Abyssal handoff should therefore be a small campaign/world interpretation of existing milestones, not retention of temporary combat state.

## Original Abyssal application: authored phase grammar

> **Hypothesis:** Each canonical stage owns a compact authored grammar; a deterministic seed selects bounded variants within each phase. The grammar makes a stage feel like a place with a problem, while the seed makes its traversal and pressure replayable.

### Data model at design level (not implementation)

A stage descriptor is authored data:

`stageId + stagePromise + domainVocabulary + phaseSequence + permittedVariantSets + objectiveContract + bossGate + handoffTemplate`

A run seed deterministically chooses only among permitted variants. It does **not** decide the stage’s canonical promise, phase order, boss gate, progression result, or lore conclusion. The simulation resolves stage state; a snapshot projection only visualizes the result.

### Generic phase sequence

The exact content is deliberately unfilled so Abyssal retains its own canon.

| Authored phase | Player-readable question | Seed may vary | Must remain invariant | Pacing purpose |
| --- | --- | --- | --- | --- |
| **Ingress / signal** | What is wrong here, and which route is currently safer? | Entry lanes, landmark placement, low-intensity enemy composition, objective bearing. | Stage promise, primary movement tutorial/read, visible objective category. | Establish context before density rises. |
| **Pressure / commitment** | Can I keep the route open while approaching or sustaining the objective? | Route topology within safe-path constraints, hazard pattern, enemy mix, side-route reward placement. | Objective rule, movement-first agency, readable escape route. | Convert recognition into spatial commitment. |
| **Pivot / consequence** | What changed because the objective was advanced or defended? | Which pre-authored visual state variant appears, secondary route opens/closes, enemy approach family. | State change is simulation-derived; no change to temporary-skill persistence rules. | Create contrast and a world-state response without a cutscene. |
| **Gate / resolution** | Can I secure the stage outcome and reach/defeat the boss gate? | Final arena arrangement, telegraph sequence selection, non-critical dressing. | Boss victory condition and next-stage unlock contract. | Deliver a deterministic climax and clear handoff. |

The grammar is intentionally phase-based rather than a free-form map generator. It gives level design a reviewable list of allowable variants and gives QA a seed corpus with known invariants.

## Explicit stage/world lore trace: W-01 through W-05

This trace proposes **presentation semantics only**. It does not define new lore facts, named characters, collectables, or currencies. The labels must be reviewed against the canon owner before production.

| Canon anchor | Stage grammar role | Objective-to-world linkage | Next-stage handoff, derived only from authoritative state |
| --- | --- | --- | --- |
| **W-01 Echo** | The Ingress signal identifies an earlier disturbance through a repeatable, stage-local environmental cue. | Advancing the objective changes the stage’s deterministic `echoResolved` condition. | The next opening may summarize the prior resolved condition as a static briefing line/icon; it cannot reroll enemies, rewards, or route data. |
| **W-02 Bind** | Pressure frames the objective as holding/maintaining a connection while moving, not as an extra command interface. | Success/failure of the bound objective is an existing stage outcome field or a derived display condition; it is not a new persistent build stat. | The stage handoff declares whether the connection was secured in the prior victory snapshot; temporary skills still reset exactly as P0 requires. |
| **W-03 Gate Integrity** | Gate is the authored resolution condition, not a random emergent endpoint. | Objective completion authorizes the canonical boss gate; visual integrity changes are projections of simulation values. | Boss victory’s existing next-stage unlock is the only mechanical campaign transition. The briefing can name the state of integrity without changing that unlock rule. |
| **W-04 Domain** | Domain is the reusable local vocabulary that constrains seeds: silhouettes, path affordances, hazards, and encounter families. | A stage objective makes one Domain property legible before the pressure phase asks the player to navigate it. | Next stage exposes a distinct authored Domain promise; it does not inherit arbitrary runtime debris or presentation-only effects. |
| **W-05 Archive** | Archive is a bounded recap grammar, not a simulated global history. | The resolved stage outcome is serialized from authorized local campaign state or deterministically recomputed from it. | A compact, static stage record can establish continuity before the next run. **Hypothesis:** persistent Archive records require an explicit contract decision; Stage 1 should prove the handoff with derivable/session-local text first. |

### Handoff rule

A stage may hand forward only: the existing unlocked-stage milestone, the existing locally unlocked companion roster, the stable stage identifier, the seed/version needed to reproduce the completed run, and outcome fields computed by the simulation. It may **not** hand forward temporary XP level, offer set, skill effects, renderer state, device time, frame timing, or a presentation-selected branch.

## Design implications and measurable candidate experiments

All thresholds below are **targets**, not source-derived values. They are initial concept-validation gates and should be changed only after controlled playtests.

### Implication A — Seeded variation must be recognized as the same authored stage

**Original hypothesis:** A stage’s Domain/phase grammar will preserve place identity if each generated seed contains the same ordered phase roles and the same objective contract, while changing only bounded route/encounter variants.

- **Target:** For each stage, evaluate **30** fixed seeds and require **100%** to contain the authored phase order, exactly **one** primary objective contract, one valid boss gate, and at least one simulation-valid escape path from each pressure layout.
- **Target experiment:** Show experienced testers two seeds from the same stage and one from another stage without names. Ask them to group the two matching seeds by stage promise and identify the objective before the first pressure escalation. Success target: at least **80%** correct grouping and objective identification.
- **Instrumentation:** record `stageId`, grammar version, seed, phase enter/exit tick, objective spawn/complete tick, boss gate tick, death/restart tick, and validation failure reason. These are authoritative simulation events, not renderer analytics.

### Implication B — Objectives must alter movement decisions, not add a second control mode

**Original hypothesis:** An objective is meaningful in an auto-combat survivor only when its location/state changes the player’s path under pressure.

- **Target:** In playtest replays, at least **70%** of successful objective advances should include a direction change or route commitment attributable to the objective bearing/state; `objective advance with no route decision` is a review failure class, not automatically a player failure.
- **Target experiment:** Compare a seed pair with the same enemy budget and geometry but one with an objective-bearing/route cue and one with a purely timer-based objective. Measure time spent moving toward the intended zone, restart rate, and post-run ability to state why the objective mattered.
- **Accessibility target:** Every objective state has both a static high-contrast HUD/edge indicator and a non-motion-dependent world marker under reduced motion. The marker does not obscure enemies, projectiles, or hazards.

### Implication C — Pacing must be authored and testable at the phase level

**Original hypothesis:** Tension is more controllable when the seed fills a phase budget rather than freely spawns unrelated events.

- **Target:** Each stage’s design sheet defines a named pressure budget for every phase and a maximum permitted simultaneous readability demand (objective cue, hazard family, enemy approach family). The initial target is no more than **three** simultaneous demand categories in Pressure, unless a specific stage is approved as an exception.
- **Target experiment:** Across **30** fixed seeds, chart phase duration in ticks, health lost by phase, objective completion rate, and restart location. Review variance by phase, not only average stage completion; a seed is rejected if it produces an unplanned peak in Ingress or a missing Gate climax.
- **Source-derived invariant:** Pacing timestamps must be ticks in the deterministic **60 Hz** simulation, never wall-clock/render-frame samples. [P0]

### Implication D — World-state feedback must be a derived consequence, not a simulation

**Original hypothesis:** A one-line Archive-style handoff derived from stage outcome can improve continuity without adding a global world model.

- **Target:** The handoff template accepts only an allowlisted outcome payload: `stageId`, grammar version, completion/failure state, boss-gate state, existing unlock milestone, and existing companion-unlock result. A schema test rejects any run-only skill, render state, device timestamp, network value, or unseeded random input.
- **Target experiment:** After a completed stage, compare a control transition with a deterministic summary to an otherwise identical transition with no summary. Before the next stage starts, ask testers what changed and what the next stage is about. Target: a **20 percentage-point** improvement in correct explanation with no increased time-to-first-movement beyond the approved UI budget.
- **Scope guard:** Do not persist an Archive log in Stage 1. Use a derivable or session-local summary until a product-contract decision explicitly authorizes new local campaign data.

## Risks, contradictions, and hard guards

### Simulation/presentation authority leaks — release blockers

| Risk | Why it breaks the contract | Guard and acceptance evidence |
| --- | --- | --- |
| Canvas or HUD chooses/re-rolls a stage variant after the run begins. | Two projections could produce different space, encounters, or progression from the same state/input. | Seed, grammar version, and stage plan are created/validated by authoritative simulation before first gameplay snapshot. Snapshot consumers have no generator/RNG write API. Replay the same saved state/input through both projections and require identical stage outcomes. |
| A visual cue, animation completion, audio event, or reduced-motion branch decides objective completion. | Presentation timing becomes gameplay authority and changes outcomes by frame rate or accessibility setting. | Simulation alone owns objective/gate transitions. Reduced motion changes only snapshot presentation; replay outcomes must match across motion settings. |
| Narrative handoff writes a new progression flag or consumes a temporary skill field. | Violates P0’s explicit separation of run-only skills from local-persistent companions/campaign progress. | Allowlist handoff inputs; schema validation fails closed. Test a win and loss: skills/offers reset on restart, while only already-authorized persistent milestones remain. |
| “World state” becomes an unbounded global simulation. | Scope, determinism, save complexity, and testability expand without a product-contract mandate. | Use authored replacement/recap grammar: derive a small stage record from outcome, do not simulate unseen actors, ecology, economy, or history. E1 supports this bounded direction. |
| Dynamic objective systems use device time, frame duration, or presentation RNG. | Reproducibility fails despite a nominal seed. | All selection and phase timing use fixed simulation tick plus stored seed/version; reject inputs from wall-clock/render paths in deterministic tests. |
| Handshake text becomes an interrupting narrative panel over combat. | Conflicts with movement-first play and P0’s prohibition on central battlefield panels covering threats. | Display handoff before the next active run or in edge HUD only; retain immediate movement input at stage start. Test reduced-motion and narrow portrait projection separately. |

### Design risks and contradictions

- **Too much variation can erase learning.** If a seed changes objective semantics or boss-gate logic, it is a different stage wearing the same name. Keep semantics and phase order authored; vary only the enumerated local set.
- **Too little variation can make “procedural” decorative.** If only background dressing changes, the system adds complexity without meaningful replay value. The seed must affect route/encounter decisions while passing the same grammar checks.
- **A coherent recap can overclaim player agency.** Do not phrase a handoff as an irreversible world change if the gameplay state did not actually carry that consequence. Use factual, deterministic summary language tied to the outcome payload.
- **Comparable products differ materially.** E2/E3 use mining/extraction and E4 uses a story-rich action roguelike; E5 uses a minimal survival loop. These examples justify questions and patterns, not mechanics to transplant.
- **Persistence is unresolved by the present contract.** P0 permits local persistence but specifies campaign stage/boss and companion rules. Any permanent Archive record beyond derivable existing state needs explicit design-contract approval.

## Recommended Stage 1 validation slice

Build one internal, non-canon prototype descriptor for a single existing conceptual stage. Include two permitted seed variants per phase, one authored objective contract, one boss gate, deterministic event logging, and a non-persistent handoff template. Run the seed corpus and motion-setting replay checks above before authoring more stages. This validates the grammar/authority boundary first; it does not add runtime content or change campaign canon.

## Source list

- P0 — `docs/abyssal-command-defense-survivor-design.md`, direct local retrieval, primary project contract.
- E1 — GDC Vault / Freehold Games, direct page retrieval, primary developer presentation: <https://www.gdcvault.com/play/1024990/Procedurally-Generating-History-in-Caves-of-Qud>
- E2 — Funday Games / Ghost Ship Publishing Steam product page, direct page retrieval, official product information: <https://store.steampowered.com/app/2321470/Deep_Rock_Galactic_Survivor/>
- E3 — Ghost Ship Games / Coffee Stain Publishing Steam product page, direct page retrieval, official product information: <https://store.steampowered.com/app/548430/Deep_Rock_Galactic/>
- E4 — Supergiant Games Steam product page, direct page retrieval, official product information: <https://store.steampowered.com/app/1145360/Hades/>
- E5 — poncle Steam product page, direct page retrieval, official product information: <https://store.steampowered.com/app/1794680/Vampire_Survivors/>
