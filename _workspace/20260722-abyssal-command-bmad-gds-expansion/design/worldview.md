# Worldview — five anchors, one bounded campaign

**Stage 1 status:** proposed design vocabulary only. All validation gates are **UNVERIFIED / UNPASSED**. The anchors below are a traceability grammar, not new lore facts, characters, objectives, rewards, or runtime content.

## Canon stance

Abyssal Command is a sequence of authored places under pressure, not a simulated global ocean. Each stage can vary its bounded route, encounter composition, and presentation texture, while its purpose, objective contract, Gate logic, reward outcome, and campaign order stay authored and deterministic. The player moves; automatic combat resolves; the system records only consequences already committed by rules.

## W-01…W-05 system trace

| Anchor | World meaning in Stage 1 | Systems that may carry it | Hard boundary |
| --- | --- | --- | --- |
| **W-01 Echo** | An authored signal or acknowledgement that orients the player to a confirmed stage/objective condition. | Ingress/Orientation label, concise caption, sparse sonic call/answer, skill identity shape, local history-free recap. | It may not invent an unseen past, predict a result, consume RNG, or reroll a route. |
| **W-02 Bind** | A confirmed objective/extraction relationship that gives movement pressure a legible purpose. | ObjectiveAnchor, existing bind/extraction state, W-02 icon/caption, confirmed skill/result projection. | It may not add manual commands, promise an unlock before the authoritative result, or create a second primary objective. |
| **W-03 Gate Integrity** | The stable stage-risk contract: player survival and the Gate are readable, separate, stateful obligations. | Edge HUD, Gate node, boss arrival, pressure BGM layer, danger cue, factual warning beat. | It may not predict success/failure, let a health bar change rules, or use presentation completion to spawn/defeat a boss. |
| **W-04 Domain** | The authored local vocabulary that makes a stage recognizable across valid seed variants. | Stage descriptor, approved module palette, hazard/encounter family, ingress placard, map-plan labels, BGM ambience. | A seed may select approved variants only; it cannot name a new biome, geography, population, or objective taxonomy. |
| **W-05 Archive** | A bounded record of a confirmed result or a fair, existing local accounting receipt. | Result recap, existing campaign milestone, companion result if supplied, one-settlement return receipt, local diagnostic/export metadata. | It cannot become an unbounded world history, simulate absence, persist run-only skills, or create a Stage 11 route. |

## Stage grammar and world linkage

The stage's authored phase order is fixed:

```text
Ingress -> Orientation -> Approach -> ObjectiveAnchor -> Gate -> Resolution
                         \-> bounded Detour/Pressure modules -> deterministic rejoin
```

A seed can choose only approved module, transform, bounded branch, route pressure, encounter card, and cosmetic/presentation variants. It cannot change the phase identity, canonical objective, objective order, Gate, campaign result, or final ending.

| Phase | Player-facing world question | Anchor emphasis | Invariant handoff fact |
| --- | --- | --- | --- |
| Ingress | Where am I entering and what can I safely read first? | W-04, optional W-01 | Stage/domain/objective labels are authored and committed before play. |
| Orientation | What route and objective matter? | W-01, W-04 | Objective bearing and landmark come from the committed stage plan. |
| Approach / bounded detours | How do I keep moving through pressure? | W-04, W-02 | Variation changes route and encounter composition, not objective semantics. |
| ObjectiveAnchor | What confirmed state is I advancing? | W-02 | Only one primary objective exists; its state is rule-owned. |
| Gate | Can I protect the stage condition through the climax? | W-03 | Gate follows the objective on every required route; health/integrity is authoritative. |
| Resolution | What factual consequence may carry forward? | W-05 | Existing stage result/milestone may be summarized after commit; run-only build state does not transfer. |

## Stage-to-world handoff

A handoff accepts only committed, allowlisted fields: `stageId`, stage/grammar/map-plan versions, completion or failure result, confirmed Gate/boss state, existing unlock milestone, and existing companion result where supplied. It may show a static caption, marker, or optional local voice. It cannot use renderer state, device time, frame cadence, presentation-selected variants, current offer set, temporary XP/skills, network values, or unseeded randomness.

- **Stage 1–9 victory:** W-05 may state the existing committed next-stage milestone. The stage transition itself already happened in rules; the handoff cannot cause it.
- **Defeat:** W-05 may state the factual current-stage run end. Run-only skills reset according to the existing product contract; no recap preserves them.
- **Idle resume:** W-05 may state only a validated existing receipt/summary. If no safe payload exists, it is silent rather than fabricated.
- **Stage 10 victory:** the only permitted result grammar is **W-05 recap: campaign completion**. It must not mention a next stage, queue entry narration, or imply an eleventh stage.

## World continuity without scope growth

The world feels continuous because a replayable stage produces a confirmed consequence, not because the game simulates unseen factions, ecology, economy, or history. The Archive may render a compact derivable/session-local summary while the product contract has not authorized new persistent narrative state. An optional build-time audio asset can enrich a confirmed beat, but text and static markers remain the baseline truth path.

## Gate targets and evidence posture

| Claim to falsify | Evidence path required | Status |
| --- | --- | --- |
| Every fixed seed preserves phase order, exactly one primary objective, one valid Gate, and a valid escape route. | Future `MapPlanReplayCorpus` and seed corpus evidence. | **UNPASSED** |
| A player can identify objective direction and Gate route with normal and reduced motion. | Future objective-recognition study and static captures. | **UNPASSED** |
| Handoff uses allowlisted committed data and leaves rules state unchanged. | Future event schema, save-diff, and replay-hash evidence. | **UNPASSED** |
| Stage 10 is understood as final completion without a next-stage expectation. | Future Stage 10 result fixture and comprehension evidence. | **UNPASSED** |

## Research basis

- `research/stage-world-procedural.md`
- `research/pcg-map-grammar.md`
- `research/narrative-stage-presentation.md`
- `research/audio-narration-direction.md`
- `research/progression-idle-economy.md`
- `research/telemetry-playtest-contract.md`
- `.survey/abyssal-command-systems-expansion/{context,solutions}.md`
- Current product contract: `_workspace/20260722-defense-survival-expansion/design/gameplay-contract.md`
