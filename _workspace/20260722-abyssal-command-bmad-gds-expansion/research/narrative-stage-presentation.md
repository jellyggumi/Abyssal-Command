# Abyssal Command: event-observed stage presentation and narration

**Research date:** 2026-07-22  
**Scope:** Concept-validation packet for the presentation and narrative layer. It does not add runtime content, change simulation, persistence, campaign progression, or canon.

## Research question

How can event-driven stage presentation make a seeded map objective, boss gate, result, and return state legible as an Abyssal story beat—at stage entry, objective reveal, boss arrival, player bark, victory/defeat, and idle return—without adding a stage, inventing canon facts, introducing a gameplay-time service dependency, or granting presentation authority over deterministic 60 Hz rules?

## Fixed boundaries

- The project contract defines a movement-first, automatic-combat, single-player campaign of **exactly 10 stages**. Boss victory opens the next stage; **Stage 10 boss victory completes the campaign**; defeat restarts the current-stage run and clears run-only skills. [P0]
- Fixed-step simulation is deterministic at 60 Hz. Canvas adapters read deterministic simulation snapshots only; changing projection must not change combat, offers, extraction, or campaign progression. [P0]
- The product is offline/local-first. This packet proposes no account, network, commerce, runtime generation service, or gameplay-time API dependency. [P0]
- Reduced motion must preserve danger, damage, and selection through static contrast and text. [P0]
- `defense-catalog.js` is the immutable authored data source for the renderer-neutral run; it defines the 60 Hz tick rate and Gate data. The deterministic simulation consumes it, and narration, VFX, render, and audio may only observe confirmed rule events. [P1]
- The five supplied anchors are treated as canon labels only: **W-01 Command Echo**, **W-02 Bind/Extract**, **W-03 Gate Integrity**, **W-04 Domain**, and **W-05 Archive**. The grammar below supplies no characters, places, factions, items, or new lore facts.

## Source ledger

| ID | Source and provenance | Directly observed support | Use and limit |
| --- | --- | --- | --- |
| P0 | [Abyssal Command defense/survivor design](../../../docs/abyssal-command-defense-survivor-design.md) — **primary project contract; direct local retrieval** | Defines automatic combat/movement-first input, fixed 10-stage campaign, Stage 10 completion, 60 Hz determinism, local-first persistence, reduced-motion readability, and read-only Canvas adapters. | Binding authority for this packet. It does not specify narrative content. |
| P1 | [`defense-catalog.js`](../../../defense-catalog.js) and [`defense-run-simulation.js`](../../../defense-run-simulation.js) — **primary local implementation evidence; direct retrieval** | The catalog declares immutable authored data, `TICK_RATE = 60`, `GATE`, stages, bosses, tactics, and authored cutscene text; the simulation imports it and emits `BOSS_SPAWNED` and `GATE_BREACHED` when it resolves boss arrival/gate damage. | Confirms the present data/rules vocabulary, not a new narrative event API or UI contract. |
| E1 | [GDC Vault: *Procedurally Generating History in Caves of Qud*](https://www.gdcvault.com/play/1024990/Procedurally-Generating-History-in-Caves-of-Qud) — **primary developer presentation; direct page retrieval** | The session overview says its author avoided a full historical simulation by generating events and rationalizing them after the fact, and discusses replacement grammars for convincing history within a tight scope. | Supports a bounded authored recap grammar rather than a simulated off-screen world. It does not transfer fiction, algorithms, or content. |
| E2 | [ink: *Running your ink*](https://github.com/inkle/ink/blob/master/Documentation/RunningYourInk.md) — **primary official runtime documentation; direct retrieval** | Documents tags as non-player-facing metadata, line tags including audio filenames, wrapper components, variable observers, and game-bound external functions. | Supports typed content metadata and observation patterns. Ink is an example only; it is not a proposed dependency or runtime architecture. |
| E3 | [Godot Engine: *Using signals*](https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html) — **primary official engine documentation; direct retrieval** | Defines signals as messages emitted on a change and consumed by connected listeners; describes them as an observer/delegation mechanism that reduces coupling. | Supports a one-way event consumer boundary. It does not license a new engine or prove a particular game outcome. |
| E4 | [W3C WCAG 2.2, Understanding SC 1.2.2](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html) — **primary accessibility standard explanation; direct retrieval** | Captions convey dialogue, speaker identification, and important non-speech audio; they should not obscure relevant information. | Supports equivalent captions/labels for authored voice and compact placement. Its prerecorded-media criterion is an accessibility principle, not a complete game UI specification. |

### Evidence limits

E1 supports bounded, authored rationalization, not procedural narrative complexity. E2 and E3 demonstrate metadata and observer patterns in other tools; their APIs are **not** requirements for this codebase. E4 applies to synchronized media, so its captioning principles are adapted here as an original accessibility target. P1 describes current implementation vocabulary, while the proposed presentation-event schemas remain proposals. All beat names, slot rules, timings, targets, and telemetry below are **original hypotheses**, except where explicitly marked [P0] or [P1].

## Observed patterns and synthesis

1. **Bounded explanation can be authored after an authoritative result.** E1 provides a scope-safe precedent for deriving a convincing record from events rather than simulating every unseen consequence. For Abyssal, W-05 Archive should summarize an already resolved stage outcome; it must not determine or embellish unrecorded gameplay consequences.
2. **Narrative metadata should travel with content, not be inferred from rendered pixels.** E2 shows tags can carry non-displayed metadata such as voice asset references. The applicable pattern is a typed beat descriptor that declares canon anchor, speaker role, caption, and variant constraints before rendering—not OCR, audio analysis, or renderer heuristics.
3. **Presentation consumers should be downstream listeners.** E3's signal model separates an emitted change from a reacting object. The Abyssal version is stricter: only the authoritative simulation emits a confirmed event; narrative may react but never issue a game command.
4. **Every narrated fact needs a readable text equivalent.** E4 identifies speaker and meaningful non-speech information as caption content and warns against obscuring relevant imagery. Thus a narration beat needs a caption/label even when audio is muted, and it belongs in edge HUD or pre-run space rather than over hazards.
5. **Procedural maps need a stable semantic handhold.** The generated location can vary, but the stage's objective class, Domain cue, and gate condition must arrive from the authored stage plan. Presentation should explain that invariant, never hallucinate a map-specific explanation from visual dressing.

## Canon-safe narrative beat grammar

### Authoring grammar

A beat is an authored template, not free-form generated dialogue:

```text
Beat := CanonAnchor + Function + FactSlots + Delivery + VariantPolicy
CanonAnchor := W-01 | W-02 | W-03 | W-04 | W-05
Function := orient | direct | acknowledge | warn | resolve | recap
FactSlots := only allowlisted fields from the confirmed event payload
Delivery := caption-first label, optional local prerecorded voice, optional non-blocking visual cue
VariantPolicy := authored alternatives + priority + cooldown + deterministic selection key
```

**Safety rule:** Fact slots are declarative labels, not invented prose. They may name a canonical anchor, `stageId`, stage-authored objective label, authored Domain label, confirmed gate state, or confirmed result. They may not claim an unobserved cause, future reward, enemy intent, combat prediction, hidden probability, or permanent world change.

### Canon slot dictionary

| Anchor | Permitted function | Safe fact slots | Prohibited expansion |
| --- | --- | --- | --- |
| W-01 Command Echo | Orient / acknowledge | stage-authored signal label; confirmed objective reveal/progress state | A speaker's memory, an unseen prior event, a causal claim not carried by the event. |
| W-02 Bind/Extract | Direct / acknowledge | confirmed binding/extraction opportunity or result; objective state | A promise of companion unlock unless the authoritative result already confirms it. |
| W-03 Gate Integrity | Warn / resolve | confirmed integrity bucket, gate-open state, boss-arrival state | A prediction that the gate will hold, fail, or unlock a reward. |
| W-04 Domain | Orient / direct | authored stage Domain label, objective category, map-plan landmark label | A newly named place, route, population, or ecosystem. |
| W-05 Archive | Recap | confirmed stage result, stage id, existing campaign milestone, existing companion-unlock result when supplied | A new persistent journal, global history, or Stage 11/epilogue. |

### Beat table

All example wording below is **structural notation, not player-facing final copy**. `[…]` means a supplied allowlisted fact slot.

| Beat | Confirmed observation input | Canon grammar / allowed fact | Channel and player interaction | Variant & suppression policy |
| --- | --- | --- | --- | --- |
| **Stage entry** | `stageEntered` after the simulation has committed `stageId` 1–10, stage plan version, authored objective label, and Domain label | `W-04 orient: [Domain] / [objective]`; optional `W-01 orient: [signal]` | Edge/pre-run caption; optional local voice after input is live. Never a central modal or movement lock. | One variant per stage entry; no repeat on resumed snapshot/re-render; suppress any lower-priority bark for 180 ticks. |
| **Objective reveal / map objective acquired** | `objectiveRevealed` from the authoritative generated stage plan, containing objective id/category and map-authored landmark label | `W-04 direct: [objective] at [landmark]`; optional `W-01 acknowledge: [signal located]` | Static world marker plus compact caption. Voice optional; no world marker may decide completion. | First reveal only per objective instance; 600-tick category cooldown; do not narrate cosmetic rerolls or marker redraws. |
| **Bind / extraction opportunity** | `bindStateChanged` or `extractionOpportunityConfirmed` | `W-02 direct: [bind/extract state]` | Existing objective/HUD read plus caption. This is an acknowledgment, not a new interaction step. | One line for a state edge; 900-tick anchor cooldown; suppress while imminent hazard/boss warning is active. |
| **Boss arrival / gate state** | `BOSS_SPAWNED` or `GATE_BREACHED` observed from simulation, plus its already committed Gate snapshot [P1] | `W-03 warn: [integrity bucket] / [boss arrival]` | A Gate edge-HUD, **if an approved UI exposes one**, is primary; one caption and optional short voice are secondary. No cinematic takes input away. | Exactly once per boss-arrival event id; highest narrative priority except defeat; bars ordinary barks for 1,200 ticks. |
| **Player bark** | A *confirmed* player-relevant event such as objective advance, elite defeat, confirmed damage threshold crossing, or extraction result | `W-01/W-02/W-03 acknowledge: [confirmed state]` | Caption plus optional local voice. It must never substitute for a telegraph, health state, or an approved Gate edge read. | Choose only when no higher priority beat is queued; per family cooldown 1,200 ticks; no exact variant twice in the prior 3 selections. |
| **Victory** | `stageResultCommitted = victory`, including boss result and canonical progression milestone | `W-05 recap: [stage result]`; optional W-03 resolve: `[gate resolved]` | Post-result caption and optional voice, after simulation already commits the next-stage unlock. Stage 1–9 may show the existing next-stage milestone; it cannot modify it. | Exactly once per committed result; disable all non-result beats until transition completes. |
| **Defeat** | `stageResultCommitted = defeat` | `W-05 recap: [current-stage run ended]`; optional W-03 acknowledge: `[integrity result]` | Brief, dismissible/static result label before the existing restart path. No blameful or predictive copy. | Exactly once per result; no bark chain; no objective recap beyond confirmed state. |
| **Idle return** | An authoritative `resumeSummaryReady` that contains only already-authorized local resume data; otherwise no narration event | `W-05 recap: [stored, confirmed resume summary]` | Quiet Archive label plus optional local voice on resume. It is never required to proceed. | Once per resume session; no wall-clock-generated prose. If no safe summary exists, render no line rather than invent one. |

### Campaign-end guard

The grammar range is `stageId ∈ {1…10}`. For **Stage 10 victory**, the only legal result beat is `W-05 recap: campaign completion` derived from the committed campaign-complete result. It must not mention a next stage, queue a stage-entry beat, or imply an eleventh stage. For Stage 1–9 victory, the narration can state the already committed next-stage milestone but cannot cause it.

## Event-to-presentation trace map

| Authoritative producer | Immutable observed event / allowlisted fields | Narrative selection (downstream only) | Presentation outputs | Forbidden return path |
| --- | --- | --- | --- | --- |
| `defense-catalog.js` / deterministic simulation | `stageEntered {eventId, simTick, stageId, stagePlanVersion, objectiveLabelId, domainLabelId, echoLabelId?}` | Entry descriptor validates stage range and selects an authored variant. | Caption id, optional local-asset id, optional visual emphasis id. | No callback may alter seed, stage plan, input, spawn, enemy, objective, or stage transition. |
| Generated-map plan committed by simulation | `objectiveRevealed {eventId, simTick, stageId, objectiveId, objectiveLabelId, landmarkLabelId}` | Objective descriptor reads only the committed labels. | Edge text/static marker request; optional voice/caption. | Narrative cannot relocate/reveal/hide the objective, alter paths, or resolve it. |
| Simulation rules | `bindStateChanged` / `extractionOpportunityConfirmed {eventId, simTick, stateId, result?}` | W-02 descriptor reads confirmed state edge. | Caption/voice request only. | No request may create an extraction, write persistence, or choose an offer. |
| Simulation rules [P1] | `BOSS_SPAWNED` / `GATE_BREACHED` plus the corresponding committed Gate snapshot `{eventId, simTick, stageId, bossEventId?, integrityValue}` | A candidate W-03 adapter derives an **original presentation-only** `integrityLabelId` from the committed value and selects a warning. | Caption, optional local cue, optional approved Gate callout. | No cue completion, audio timing, or renderer timing may mutate Gate state or spawn/defeat a boss. |
| Simulation rules | `playerRelevantConfirmed {eventId, simTick, semanticFamily, stateId}` | Bark arbiter applies priority/history/cooldowns. | One caption/voice variant or suppression. | The arbiter cannot write health, damage, targeting, XP, skills, or enemy state. |
| Simulation/campaign state | `stageResultCommitted {eventId, simTick, stageId, result, milestoneId, companionResultId?}` | W-05 result descriptor selects a recap. | Result caption, optional local voice, visual Archive tag. | Presentation cannot grant/withhold unlocks, preserve run skills, restart, or advance stage. |
| Deterministic simulation after validated local-state hydration, if a safe feature is authorized | `resumeSummaryReady {eventId, resumeId, summaryTemplateId, allowedValues}` | W-05 selector picks an authored recap. | Optional quiet resume caption/voice. | No device-time check, background combat, grant calculation, progression write, or clock repair is allowed in narration. |

### Observation-only guarantee

1. The deterministic simulation is the **only** producer of these events, including `resumeSummaryReady` only after it has validated/hydrated existing local state, and commits state before emitting a presentation observation.
2. The narrative router receives an immutable event copy and can return only a presentation command from this closed set: `showCaption`, `playLocalVoice`, `showStaticMarker`, `emitTelemetry`, or `suppress`.
3. The router has no reference to rules mutation APIs, RNG used by rules, persistence mutation, timers that govern rules, input control, or catalog authoring.
4. Output completion, voice playback failure, muted audio, captions disabled, reduced-motion mode, dropped frames, renderer swap, and an unavailable audio asset all resolve to **no presentation output**; none retries or changes the source event.
5. Replay authority remains simulation state plus input sequence [P0]. For reproducible presentation capture, record the selected `beatId` and `variantId`; never let a presentation-local selection write back into the replay or campaign state.

This is a release-blocking boundary: every trigger described in this packet is **observation-only**.

## Anti-repetition and cooldown contract

### Required authored data

```text
NarrativeBeatDefinition {
  beatId, canonicalAnchor, function, priority,
  triggerEventType, requiredPayloadSchema, allowedStageRange,
  factSlotAllowlist, variantIds, captionIds, localVoiceAssetIds?,
  staticFallbackId, cooldownTicks, mutualExclusionGroup,
  maxPerRun, maxPerResult, historyWindow, reducedMotionPolicy,
  selectionKeyVersion
}

NarrativeEventObservation {
  eventId, simTick, stageId, stagePlanVersion,
  semanticFamily, allowlistedFactValues
}

NarrativePresentationHistory { // presentation-local; never simulation authority
  sessionId, eventId, beatId, variantId, selectedAtTick,
  suppressionReason, deliveryOutcome
}
```

- `cooldownTicks`, priority, stage range, variant count, and mutual exclusion are authored data—not voice-system improvisation.
- `selectionKey = hash(selectionKeyVersion, stagePlanVersion, eventId, beatId)` deterministically orders eligible variants for capture/replay. It is neither a simulation RNG input nor a campaign-state write.
- A candidate is eligible only when its payload schema validates, its stage range includes `stageId`, its mutual-exclusion group is clear, no higher-priority beat is pending, `simTick - lastFamilyTick ≥ cooldownTicks`, and it has not exceeded its run/result cap.
- Selection is deterministic among the eligible authored list: first the lowest non-recent variant in the `historyWindow`, then the key order. If none qualify, **suppress**. Do not repeat a line simply because the event occurred.
- History serves delivery quality only. It resets with the presentation session/restart unless an explicitly authorized local setting later requires otherwise; it never alters objectives, outcomes, persistence rewards, or content availability.

### Initial validation targets — original, not source-derived

1. **Variant availability target:** every player-bark family has at least **4** authored caption variants and at least **1** static fallback; stage entry, boss arrival, victory, defeat, and idle return each have at least **2** variants where more than one canon-safe fact combination exists.
2. **Repetition target:** in a 20-minute fixed-seed replay, no `beatId + variantId` repeats within its declared `historyWindow`; no player-bark family delivers more than once per **1,200 simulation ticks**; every suppression logs a reason.
3. **Competition target:** in a fixture that emits bark, objective, boss-arrival, and defeat observations within 300 ticks, the visible sequence contains the highest-priority result/boss beat only, with no overlapping caption region.
4. **Map-link comprehension target:** after a stage-entry plus objective-reveal capture, at least **80%** of testers identify the objective category and its authored landmark without needing audio. This is a target to falsify, not an established result.

## Risks, contradictions, and failure tests

| Risk or contradiction | Consequence | Guard | Falsification test |
| --- | --- | --- | --- |
| **Authority leak:** a voice callback, animation end, or subtitle dismissal calls a rule mutation. | Frame rate, mute state, or missing asset could change a run. | Closed presentation-command set; no mutation dependencies; simulation-first event commit. | Replay identical state/input with captions on/off, voice asset available/missing, reduced motion on/off, and two render rates. Require byte-equal authoritative outcome/event sequence. |
| Objective narration reads a visual landmark rather than the committed map plan. | A decorative rerender can state the wrong target or leak seed variance into facts. | Require `objectiveLabelId` and `landmarkLabelId` from the authoritative plan; reject free-text or renderer-derived slots. | Feed a valid event with an invalid/unlisted label and a changed visual skin. Require schema rejection/suppression and unchanged simulation. |
| Repeated bark delivery masks a boss/gate warning. | The player loses the most relevant current signal. | Priority queue, mutual-exclusion groups, tick cooldowns, and caption lane ownership. | Collision fixture emits four families in one 300-tick window; assert boss/result delivery and logged suppression of lower priority. |
| **Accessibility failure:** voice is the sole explanation or captions obscure a hazard. | d/Deaf/hard-of-hearing players and players using mute cannot access the fact; caption placement harms combat readability. | Caption-first semantic text; speaker/semantic identifier where applicable; edge/pre-run placement; static fallback; no motion-only meaning. E4 supports the caption principle. | Audio-muted and reduced-motion task test: target ≥80% correct objective/gate/result identification; screenshot audit finds zero caption overlap with active hazard/critical HUD area. |
| **Reproducibility failure:** wall-clock or nondeterministic presentation RNG selects different capture lines. | A replay cannot be audited consistently, even if rules stay equal. | Selection key derives from stored event/plan identifiers; all cooldowns use `simTick`; selection id is logged. | Run the same observation log twice with different device clock values/frame pacing. Require identical `(eventId, beatId, variantId, suppressionReason)` sequence. |
| Archive recap becomes a new permanent history system. | Scope/persistence expands beyond the contract; copy may overstate player impact. | Session-local/derivable recap only until a product contract explicitly authorizes a persistent Archive record. | Save-diff test around a result/resume flow: only existing authorized campaign/companion fields change; no narrative-history field appears. |
| Idle-return copy implies autonomous combat or clock-derived rewards. | Violates movement-first agency and local reproducibility constraints. | Only observe a precomputed authoritative resume summary; absent safe summary means silent return. | Simulate a clock rollback and an unavailable resume summary. Require no narration claim, no grant, and no simulation mutation from the presentation layer. |

## Abyssal implications and experiments

1. **[TARGET] One canonical objective explanation per generated stage plan.** Each committed stage plan exposes a stable `objectiveLabelId`, `landmarkLabelId`, `domainLabelId`, and `stagePlanVersion` before entry. Across **30 fixed seeds per stage**, require 100% schema-valid entry and objective-reveal events and 0 renderer-derived facts.
2. **[TARGET] Caption-first, non-blocking orientation.** In a static/reduced-motion test of entry, boss arrival, victory, defeat, and resume, target **100%** of beats with a text equivalent and 0 central-panel captures covering enemies, projectiles, or hazards. This enforces P0 and adapts E4's non-obscuring-caption principle.
3. **[TARGET] Beat quality by event, not by impression.** Log event-to-delivery latency in simulation ticks, selected/suppressed variants, queue collisions, and caption mode. Review a fixed corpus for: 95% of eligible high-priority beats delivered within the authored tick budget; 100% of missing assets resolving to fallback or suppression with no rules change.
4. **[TARGET] Result narration earns its transition time.** A/B test a derivable W-05 result recap against no recap with identical authoritative results. Before the next run, target a **15 percentage-point** improvement in correctly stating the prior result and next objective, with no increase in time to first movement beyond the approved UX budget. Stage 10 is measured separately: participants must recognize campaign completion, not expect another stage.
5. **[TARGET] No idle narration without a truthful payload.** Test valid resume, clock anomaly, malformed resume payload, and no resume payload. Require 100% of invalid/absent cases to suppress narration; no path may call a progression, combat, reward, or persistence mutation from the narrative router.

## Telemetry and review packet

Use only local, offline diagnostics consistent with P0. Each observation/delivery record should include:

```text
runOrSessionId, replayId?, stageId, stagePlanVersion, eventId, eventType,
simTick, canonicalAnchor, beatId, variantId?, priority, cooldownTicks,
deliveryMode, deliveredAtTick?, suppressionReason?, captionFallbackUsed,
reducedMotionEnabled, audioAvailable, rulesStateDigestBefore, rulesStateDigestAfter
```

- `rulesStateDigestBefore` must equal `rulesStateDigestAfter` for every narrative delivery/suppression record. Any mismatch is an authority-leak failure.
- Never log raw voice recordings, account identifiers, network identifiers, device wall-clock values, or text generated at runtime.
- Review by fixed observation-log replay: event schema validity, selected variant sequence, suppression reasons, caption placement capture, and authoritative digest equality.

## Recommended validation slice

Create a non-canon internal fixture for one existing stage in the **1–10** range with two fixed map seeds and six observations: stage entry, objective reveal, boss arrival, one player bark, victory, and defeat. Use authored placeholder label IDs rather than final fiction. Feed the same event log to normal, muted, missing-voice, reduced-motion, and alternate-frame-pacing projections. The slice passes only if output text/selection logs meet the targets above and the authoritative state digest is unchanged across every projection.

## Source list

- P0 — `docs/abyssal-command-defense-survivor-design.md`, primary project contract, direct local retrieval.
- P1 — `defense-catalog.js` and `defense-run-simulation.js`, primary local implementation evidence, direct retrieval.
- E1 — GDC Vault / Jason Grinblat, Freehold Games, primary developer presentation: <https://www.gdcvault.com/play/1024990/Procedurally-Generating-History-in-Caves-of-Qud>
- E2 — inkle, official runtime documentation: <https://github.com/inkle/ink/blob/master/Documentation/RunningYourInk.md>
- E3 — Godot Engine, official documentation: <https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html>
- E4 — W3C Web Accessibility Initiative, WCAG 2.2 explanation: <https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html>
