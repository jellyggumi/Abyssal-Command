# Architecture contract — Cinder Span Command Feedback

**Status:** Stage 1 concept-validation handoff. No implementation or measurement is claimed.

## Audience and action

Engineers implement a bounded, reproducible vertical slice without making presentation, audio, diagnostics, or generated assets authoritative. QA uses the interfaces and evidence paths below to reject the first divergence.

## Binding boundaries

- `defense-catalog.js` is the single authored rules authority. It owns rules versions, stage objective semantics, reward rules, stage order, and the Stage 10 ending. New authored map/wave records are catalog data or catalog-referenced immutable data; they are never renderer configuration.
- The deterministic core owns fixed 60 Hz tick advancement, stable input ordering, map-plan admission before tick 0, wave spawning, targeting, combat resolution, cooldowns, RNG/deck cursors, outcome, and canonical checkpoints.
- `campaign-state.js` owns only already-authorized local persistent campaign/companion and bounded Archive-return records. It never resolves a run.
- Input normalizes device intent to `move(x,y)` and, only if already catalog-authorized, `ability(slot)`. It must not supply target IDs, aim angles, damage, cooldown values, raw coordinates, device time, or presentation state to rules.
- HUD, Canvas renderers, VFX, audio, narration, haptics, accessibility modes, telemetry, and export are downstream observers. A dropped, delayed, duplicated, muted, reduced-motion, or failed observer must leave canonical state byte-identical.
- The product stays offline/local: no account, commerce, remote telemetry, cloud sync, background combat, or gameplay-time provider call. W-01 Command Echo, W-02 Bind/Extract, W-03 Gate Integrity, W-04 Domain, and W-05 Archive are labels only; Stage 10 remains the ending.

## Deterministic plan ownership

```yaml
plan_protocol:
  status: target_not_implemented
  simulation_rate_hz: 60
  map_owner: deterministic_core
  wave_owner: deterministic_core
  authored_authority: defense-catalog.js
  plan_admission: before_tick_0
  no_runtime_regeneration: true
  forbidden_inputs: [render_delta, wall_clock, locale, network, observer_mode, asset_completion]
  fixed_backbone: [Ingress, Orientation, Approach, ObjectiveAnchor, Gate, Resolution]
  optional_roles: [Detour, Pressure]
  map_key_required:
    - stageId
    - runSeed_u64_be
    - mapGrammarVersion
    - moduleCatalogVersion
    - constraintVersion
    - prngAlgorithmId
    - subSeedDerivationHashAlgorithmId
    - mapDigestAlgorithmId
    - canonicalEncodingVersion
    - namedStreamIdentifiers
  map_plan_required:
    - mapKey
    - canonicalNodes
    - canonicalEdges
    - moduleSelectionsAndTransforms
    - canonicalAnchorMetadata
    - validationReport
    - mapDigest
  wave_plan_required:
    - stageId
    - waveGrammarVersion
    - encounterCatalogVersion
    - encounterPlanId
    - deterministicSeedDerivation
    - orderedWaveEntries
    - pressureBudgetTags
    - spawnPolicyIds
    - validationReport
  acceptance: future_only
  evidence_path: qa/replay-corpus/map-plan-replay-report.json
```

`MapPlan` and `WavePlan` are immutable runtime inputs after admission. A seed may choose only catalog-approved spatial modules, transforms, encounter compositions, and pressure ranges. It may not create/reorder objectives, alter prerequisite or campaign consequence, choose an ending, substitute an unlogged fallback seed, or extend Stage 10.

## Rule order and event contract

For a tick, use stable entity/action ordering: admit normalized inputs; advance authored cooldowns; resolve planned wave spawns and target eligibility; resolve integer combat/RNG; apply health, Gate Integrity, death, extraction, choice, and stage state; append immutable rule events; checkpoint; then publish detached observer data.

```yaml
observer_event_envelope:
  schema: abyssal.observer-event
  schema_version: 1
  producer: deterministic_core
  immutable_fields: [eventId, simTick, sequence, type, rulesVersion, payload]
  event_id: "${simTick}:${subjectId}:${type}:${ordinal}"
  payload_rules:
    - payload is resolved fact only
    - presentation may cite eventId but may not invent it
    - consumers receive a detached copy
  observer_commands_allowed: [showCaption, playLocalCue, renderEffect, emitLocalDiagnostic, suppress]
  observer_commands_forbidden: [writeRuleState, advanceRng, mutatePlan, persistCampaign, reorderInput, retryGameplay]
```

Required proposed event families:

| Family | Required resolved fields | Consumer use |
|---|---|---|
| `map.plan.committed` | `mapKey`, `mapDigest`, validation result, canonical anchor labels | route/objective projection, replay diagnosis |
| `wave.plan.committed` | encounter plan ID, descriptor, pressure budget, spawn policies | encounter projection and corpus audit |
| `combat.damage.resolved` | event ID, source/target, base/final damage, crit, RNG/deck cursor, health before/after | health/crit VFX, cue, diagnostic join |
| `combat.cooldown.changed` | ability ID, previous/ready tick, state | static cooldown/readiness projection |
| `gate.integrity.changed` | Gate value/bucket and source event | W-03 HUD/audio/caption |
| `objective.state.changed` | approved objective ID/state and map anchor | W-01/W-02/W-04 projection |
| `stage.result.committed` | stage ID, result, existing milestone, Stage-10 completion flag | W-05 recap only |
| `idle.claim.committed` | basis version, idempotency key, before/after totals, result | Archive receipt; no background combat |
| `sim.checkpointed` | canonical state hash, input cursor, RNG/deck cursor, map/wave digest | deterministic replay comparison |

## Presentation and stage/world linkage

Projection reads `MapPlan` anchors and confirmed events. The only permitted bridge is:

| Canon label | Plan/event attachment | Explicitly prohibited |
|---|---|---|
| W-01 Command Echo | Orientation or confirmed objective state | inventing history or rerolling route |
| W-02 Bind/Extract | ObjectiveAnchor or confirmed extraction state | creating an opportunity/unlock |
| W-03 Gate Integrity | Gate and resolved integrity/boss state | changing damage, boss timing, or unlock |
| W-04 Domain | authored stage module/encounter vocabulary | creating a domain or hazard taxonomy |
| W-05 Archive | committed result or valid local receipt | persisting run skills or Stage 11 |

Narrative selection is presentation-local and may be deterministic for captures using `hash(selectionKeyVersion, stagePlanVersion, eventId, beatId)`. It must not consume core RNG or write replay/campaign state. Captions/static labels are immediate and canonical; local audio is optional.

## Failure modes and target evidence

| Failure | Severity | Future falsifier | Required evidence path |
|---|---|---|---|
| observer changes canonical state | P0 | first unequal checkpoint across observer/mode matrix | `qa/replay-corpus/observer-differential-report.json` |
| map/wave differs from same protocol tuple | P0 | first unequal canonical field, selection trace, or digest | `qa/replay-corpus/map-plan-replay-report.json` |
| plan fails but receives a replacement seed | P0 | any unlogged fallback or changed `MapKey` | `qa/replay-corpus/map-negative-fixtures.json` |
| map changes objective/campaign semantics | P0 | schema contains unapproved semantic/campaign field | `qa/schema/map-wave-authority-audit.json` |
| audio/narration affects a result | P0 | mode/asset failure causes a hash mismatch | `qa/replay-corpus/audio-observer-differential.json` |

All entries are **future evidence targets**. Gate status: **G1–G8 UNPASSED**; this document is not measurement evidence.

## Phase 2c response — deferred measurement-surface remediation

**Phase 2c status:** **DEFERRED.** The Phase 2a deterministic corpus provides fixture/test coverage only; it does not provide the equal-budget five-profile or active-skill accounting evidence needed for a G2 conclusion. The G8 artifact's three deterministic local checks are comparator-source context only, not gate evidence. **G2 and G8 remain NOT MEASURED / NOT PASSED.**

| Defect | Response | Owner | Reason | Next authorized-cycle dependency |
|---|---|---|---|---|
| XR-13 — no equal-budget five-profile simulation surface | deferred | game-programmer | Its safe resolution is a multi-file catalog/factory/event/telemetry measurement-surface change outside this bounded Stage 2 evidence cycle. | Implement the signed analytic fixture catalog and QA-only `createDefenseRun` profile-selection factory that materialize the five-profile equal-authoring-budget ledger. |
| XR-14 — active-skill EV/cooldown accounting is unobservable | deferred | game-programmer | Its safe resolution is a multi-file catalog/factory/event/telemetry measurement-surface change outside this bounded Stage 2 evidence cycle. | In that same signed measurement-surface slice, emit local observer-only resolved-damage and cooldown records for every active-skill resolution so EV and cooldown share are auditable. |

No runtime, balance, reward, idle-return, or monetization change occurred in Phase 2c. The deferred dependency is measurement-only: it must preserve the current player-facing catalog and canonical outcomes while exposing the future QA fixture and observer records.

**Authorizing signatures:** the game-designer signed the Phase 2b measurement-instrumentation-only decision in `design/balance-sheet.md` (“Phase 2b G2 measurement-fixture decision — designer sign-off”, 2026-07-22); the game-PM signed PMD-06 in `pm/negotiation-record.md` (2026-07-22). Those signatures authorize no retune; a later combat/reward/idle/monetization change still requires a measured G2 result and a newly signed PM/designer correction.

## Stage 2 systems-integration boundary — deferred

**Status:** **DEFERRED design boundary; no implementation authorized by this section.** It describes the smallest dependency-ordered way a later, separately authorized cycle could connect existing rule facts to feedback, persistence, and local diagnostics. It changes no catalog value, plan, save, event implementation, runtime behavior, target, or gate result. **G1–G8 remain NOT MEASURED / NOT PASSED.** Any G2 receipt produced by the future chain is **integrity-only** until the separately required equal-budget fixture, sweep, and falsification artifacts exist; it is neither a balance conclusion nor a pass.

This boundary applies the fixed-tick resolved-event rule from `research/combat-systems-balance.md:30-58`, the immutable planned-schedule rules from `research/wave-encounter-composition.md:223-232`, the one-settlement Archive rule from `research/progression-idle-economy.md:46-76`, and the local observer-only envelope from `research/telemetry-playtest-contract.md:36-61`. The current binding boundaries above remain controlling.

### Deferred connection model

The proposed future path is deliberately one-way:

```text
catalog snapshot + admitted immutable MapPlan/WavePlan
  -> deterministic 60 Hz resolution
  -> immutable resolved rule event
  -> canonical checkpoint
  -> detached projection / local diagnostic records
```

1. **Admit, then reference.** Before tick 0, the deterministic core admits only a catalog-authorized `MapPlan` and `WavePlan`. Each later rule event carries an immutable `planRef` copied from those admitted records: `stageId`, `mapDigest`, `encounterPlanId`, `waveGrammarVersion`, and the applicable catalog/rules version. A projection may use that reference to place a cue at an existing anchor; it may not regenerate a plan, select a different card/anchor, or infer a new objective.
2. **Resolve, then project.** The core resolves cooldown eligibility, target selection, crit outcome, integer damage, health/Gate mutation, and result in tick order. Only after resolution does it issue a rule-owned event ID. `combat.damage.resolved` carries the resolved source/target IDs, base/final integer value, `crit`, chance/multiplier versioned inputs, RNG/deck cursor, health before/after, `simTick`, `rulesVersion`, and `planRef`. `combat.cooldown.changed` carries ability ID, prior and ready tick, and resolved state. A feedback adapter receives a detached event/snapshot and may choose static text, shape, fill, color, motion, local cue, caption, or suppression; none of those choices feed back into the core.
3. **Commit progression only from catalog-authorized results.** A reward/choice record can be proposed only after the deterministic core emits the catalog-approved stage/objective result that authorizes it. The future record must contain the rule-issued result/offer ID, catalog/rules version, ordered option or grant IDs, and before/after effect hash. It is not a renderer callback, stage/map-plan edit, or alternate campaign authority. `campaign-state.js` may persist the already-authorized transaction, but cannot infer a reward from a cue or from plan geography.
4. **Settle Archive return as a separate local transaction.** An active run conclusion may create the catalog/rules-authorized return permit; resume may settle that permit exactly once into a stored receipt before its panel is projected. The future `idle.claim.committed` record references the settled permit/receipt, basis version, before/after restricted totals, and result. It has no `simTick` because it is outside a run, and it must neither advance the 60 Hz core nor consume combat RNG. The Archive panel is a read-only projection of the persisted receipt.
5. **Observe only after the checkpoint boundary.** A local telemetry adapter can copy rule-owned IDs and resolved fields into the proposed versioned local envelope after the rule event and checkpoint. Presentation records may join by event ID and diagnostics may join by local run/session IDs, but neither observer timing, export choice, cohort, accessibility mode, audio availability, nor a participant response may be read by rules code. Export remains explicit, local, and deleteable.

The combat packet requires feedback to be a consequence of `damage_resolved`, including static non-color semantics for health/critical/cooldown state (`research/combat-systems-balance.md:147-153`); the telemetry packet likewise treats a presentation record as correlation evidence rather than a rule result (`research/telemetry-playtest-contract.md:63-89`). The Stage 2 connection therefore adds no new authority surface.

### Required reference and field discipline

| Future connection | Rule-owned source of truth | Permitted downstream fields | Forbidden reverse edge |
|---|---|---|---|
| Stage/world feedback | admitted `MapPlan`/`WavePlan`, committed objective/state event | `planRef`, existing anchor label/ID, event ID, resolved objective state | renderer-created anchor, regenerated map/wave, changed objective/campaign consequence |
| Health / critical feedback | `combat.damage.resolved` after integer resolution | event ID, source/target, base/final value, crit flag, chance/multiplier provenance, RNG/deck cursor, health before/after, tick | HUD/VFX/audio reroll, particle/random effect consuming core RNG, display-side health mutation |
| Cooldown feedback | `combat.cooldown.changed` after authored calculation | ability ID, previous/ready tick, resolved state, tick | render-delta countdown, feedback completion advancing readiness, manual affordance not catalog-authorized |
| Reward persistence | catalog-authorized result/choice commitment | rule-issued result/offer ID, ordered IDs, effect hashes, catalog/rules version | cue-derived grant, reordered offer, UI-side campaign mutation, plan-derived unlock |
| Archive return | atomic settled local receipt | permit/receipt ID, basis version, accepted elapsed input, before/after restricted totals, result | panel reopen recalculation, background combat, combat XP/stat/stage/ending mutation, clock-as-rules authority |
| Local telemetry | copied rule event plus detached observer status | schema/version, local run/session IDs, sequence, fixture/cohort label, observer fields, canonical hash/cursors where emitted | remote transport, identity/fingerprint, cohort/export/accessibility mode read by simulation, instrumentation writing rule state |

The field sets are proposed contracts, not existing APIs. They must remain compatible with the immutable event envelope at `engineering/architecture-contract.md:71-84`; a later schema addition requires a new version rather than mutating an exported meaning. Event names and typed fields must be frozen before collection as required by `research/telemetry-playtest-contract.md:164-169`.

### Smallest future implementation slices

Each slice is **DEFERRED** and requires a separate authorization decision. The order is a dependency order, not a release plan. “Evidence path” names a future artifact; none is asserted to exist.

| Order / bounded slice | Future owner | Narrow change boundary | Test / measurement method | Future evidence path | Blocked / deferred condition |
|---|---|---|---|---|---|
| S2-1 — freeze rule-to-observer schema | game-programmer | Define versioned, detached projections for the existing resolved damage, cooldown, plan, checkpoint, stage-result, and idle-claim event families; do not retune catalog values or add player controls. | Fixed seed/input/clock fixture validates required field presence, stable serialization, and that consumers cannot mutate the emitted object. | `qa/replay-corpus/stage2-event-envelope-contract.json` | Blocked until XR-13's signed analytic fixture catalog and the existing event family owners agree a singular rules/schema version. |
| S2-2 — bind immutable plan references | game-programmer | Copy admitted `MapPlan`/`WavePlan` identity into rule events at admission; projection reads only that copy and existing anchors. No runtime generation or plan mutation. | Same protocol tuple replay; compare plan reference, phase checkpoints, wave order, and terminal hash across headless and presentation modes. | `qa/replay-corpus/stage2-plan-reference-replay-report.json` | Deferred until a validated plan-admission fixture exists; any missing/changed digest, unlogged fallback, or post-tick plan lookup blocks the slice. |
| S2-3 — expose resolved combat feedback facts | game-programmer | Emit detached health/crit/cooldown facts after core resolution and checkpoint only; keep HUD/VFX/audio/narration/haptics as consumers. | Forced crit/non-crit and cooldown `C-1/C/C+1` fixtures plus 30/60/120 Hz, muted, reduced-motion, dropped/delayed/duplicated observer differential replay. | `qa/replay-corpus/stage2-combat-feedback-differential.json` | Blocked until XR-14's active-skill accounting path is present for the fixture scope; any RNG cursor, ready tick, health arithmetic, or canonical hash difference fails. |
| S2-4 — catalog-authorized reward and Archive transaction adapters | game-programmer | Persist only a result/choice transaction already authorized by the catalog and an atomically settled Archive receipt. Do not add a reward economy, commerce, background run, or campaign shortcut. | Offer/order/effect-hash replay; save allowlist diff; clone-save 100 reopen cases with injected zero/cap/negative/rollback clock inputs and network disabled. | `qa/replay-corpus/stage2-reward-idle-integrity-report.json` | Deferred pending catalog-side authorization for the concrete reward records; any combat XP/stat/stage/boss/extraction/ending/companion mutation, duplicate settlement, or remote dependency blocks the slice. |
| S2-5 — local diagnostic adapter and fixture export | QA + game-programmer | Append versioned observer records and explicit local export/delete operations after checkpoints. No online analytics, account identifier, experiment-driven rule choice, or gameplay telemetry dependency. | Compare normal/reduced-motion/sound-off/cohort/export-enabled matrices using fixed seed/input/clock; validate field allowlist, no-network trace, stable export manifest/checksum, and first divergence capture. | `qa/replay-corpus/stage2-local-telemetry-noninterference-report.json` | Blocked until S2-1 through S2-4 have deterministic fixture IDs and expected checkpoint hashes; any missing required link, schema/cohort mismatch, identity field, network activity, or simulation divergence invalidates results. |
| S2-6 — G2 measurement-only sweep | QA + game-programmer | Run the separately signed equal-budget five-profile fixture and local observer records; do not adjust balance, rewards, idle values, or catalog entries. | Preregistered fixed-seed profile sweep, active-skill EV/cooldown accounting, health/crit/cooldown property tests, and first-falsifier reporting. | `qa/replay-corpus/stage2-g2-measurement-receipt.json` and `qa/replay-corpus/stage2-g2-falsification-report.json` | Blocked until S2-1 through S2-5 pass their integrity checks. The receipt remains integrity-only unless the required complete fixture/export supports a separate gate review. |

### Prohibited shortcuts

- Do not let a renderer, HUD, audio/VFX/narration completion, haptic state, reduced-motion setting, export operation, or telemetry callback consume RNG, change input order, alter health/cooldown, mutate a plan, or retry gameplay. The required observer-differential failure test is stated in `research/combat-systems-balance.md:155-167` and `research/telemetry-playtest-contract.md:150-154`.
- Do not regenerate a map/wave after tick 0, reroll until an eligible encounter appears, select an unlogged fallback seed, or use an asset-ready callback as a scheduler condition. A card/anchor failure is a content/validation failure, not permission to hide it; see `research/wave-encounter-composition.md:223-232` and `research/wave-encounter-composition.md:298-323`.
- Do not make feedback a second reward authority: a caption, animation, plan anchor, or observer record cannot grant an option, persist a result, unlock a companion, advance a stage, add Stage 11, or revise catalog order.
- Do not simulate absence, issue a permit on app open, recompute on panel reopen, create a daily/streak/notification loop, or let Archive return change combat XP, combat stats, stage/boss/extraction/ending flags, or companion acquisition. The required active-authority and repeated-open tests are future targets in `research/progression-idle-economy.md:109-123`.
- Do not send, sync, remotely assign, or silently export telemetry; do not collect identity, fingerprint, raw input paths, or free text by default. Diagnostic data remains local, explicit, bounded, and non-authoritative as specified in `research/telemetry-playtest-contract.md:132-154`.

### Stage 2 target ledger

All rows are **TARGET / future measurement**, not observed results. No row passes a gate by itself.

| Target | Owner | Measurement method | Future evidence path | Blocked / deferred condition |
|---|---|---|---|---|
| Rule facts retain source authority and project without changing checkpoints. | QA + game-programmer | Differential replay across observer/mode matrix; compare canonical hashes, RNG/deck/input cursors, resolved health, and ready ticks at every checkpoint. | `qa/replay-corpus/stage2-combat-feedback-differential.json` | Deferred pending S2-3; first mismatch blocks, and G2 remains NOT MEASURED / NOT PASSED. |
| Admitted map/wave references remain immutable and point only to catalog-authorized content. | QA + game-programmer | Same-tuple plan replay plus negative admission fixtures for altered digest, fallback, and semantic fields. | `qa/replay-corpus/stage2-plan-reference-replay-report.json` | Deferred pending S2-2; any mismatch blocks, and G8 remains NOT MEASURED / NOT PASSED. |
| Reward/Archive transactions remain active-authorized, single-settlement, and combat-neutral. | QA + game-programmer | Save-field allowlist diff, offer/effect hash replay, repeat-open and injected-clock property matrix, with network disabled. | `qa/replay-corpus/stage2-reward-idle-integrity-report.json` | Deferred pending S2-4; any prohibited persistent-field delta or duplicate claim blocks, and G5 remains NOT MEASURED / NOT PASSED. |
| Diagnostics are local, schema-versioned, and non-interfering. | QA + game-programmer | Export/delete manifest check, no-network trace, field allowlist audit, and observer/cohort/export matrix differential replay. | `qa/replay-corpus/stage2-local-telemetry-noninterference-report.json` | Deferred pending S2-5; any network activity, identity field, schema mismatch, or divergent checkpoint blocks, and G6 remains NOT MEASURED / NOT PASSED. |
| Equal-budget health/crit/cooldown evidence is interpretable rather than merely traceable. | QA + game-programmer | Signed five-profile fixture, preregistered fixed-seed sweep, active-skill accounting, and explicit first-falsifier review. | `qa/replay-corpus/stage2-g2-measurement-receipt.json` plus `qa/replay-corpus/stage2-g2-falsification-report.json` | Deferred pending all prior slices and XR-13/XR-14 resolution; any receipt before that is integrity-only, not a G2 pass. |

## Source and evidence references

- Current contract: `docs/abyssal-command-defense-survivor-design.md`.
- Primary research: `research/pcg-map-grammar.md`, `research/combat-systems-balance.md`, `research/stage-world-procedural.md`, `research/narrative-stage-presentation.md`, `research/telemetry-playtest-contract.md`, and `.survey/abyssal-command-systems-expansion/{context,solutions}.md`.
- Future corpus fixture root: `qa/replay-corpus/` (not yet created; required before any pass claim).
