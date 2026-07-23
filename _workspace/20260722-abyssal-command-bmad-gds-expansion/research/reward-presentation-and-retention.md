# Reward Presentation, Trust, and Voluntary Retention Research Packet

## Decision

Use **guaranteed, visible mechanical progression** as the default. Present every post-run and idle settlement as a short, reviewable receipt: **what happened → what changed → why it changed → what is optional next**. A probabilistic reveal is not a retention mechanic for this product; if it is ever approved for a strictly non-mechanical collectible, the full table, exact odds, revision, and deterministic reveal record must be available before commitment. No purchases, ads, premium currency, paid skips, timed offers, notifications, accounts, network calls, or gameplay-time provider dependencies are in scope.

All numeric values below are **unmeasured design targets**, not research findings or gate results. This packet does not assert G5 or G8 passes.

## Product and implementation boundary

Abyssal Command is an offline, deterministic 60 Hz browser defense-survivor. The fixed simulation and `defense-catalog.js` remain the only reward/rules authority; local persistence records a concluded result or settlement receipt. HUD, VFX, audio, narration, and reward UI consume confirmed records and cannot alter an outcome, RNG, save value, cooldown, stage, or offer. This preserves the intake brief's no-commerce/no-network constraint and the existing reward-band contract.

| Boundary | Required implementation rule | Explicitly excluded |
| --- | --- | --- |
| Mechanical reward | Boss/stage, extraction/Archive progress, run choice, and idle credit resolve from a confirmed deterministic rule record. | Presentation callback as a grant trigger; wall-clock or audio-dependent result. |
| Offline settlement | A permit settles exactly once from persisted fields; reopen displays the same receipt. Invalid/negative local elapsed time grants zero new credit without deleting state. | Background combat, server clock, retry-roll, simulated extraction/boss win, or a remote entitlement. |
| Presentation | Each screen renders an immutable receipt payload: `receiptId`, `ruleRevision`, `simTick|settledAt`, inputs, formula/table revision, deltas, and final balance/progress. | Cosmetic RNG that changes a reward; a hidden stateful probability modifier. |
| Retention | Voluntary replay is invited only after the player can inspect/close the result. The result remains accessible in Archive/history. | FOMO, daily streaks, expiring claim, storage-full alarm, countdown-to-claim, social comparison, or a paid/earned return multiplier. |
| Sensory feedback | Motion, sound, narration, haptics, and color enrich a text/shape/contrast-safe receipt. Settings may silence all of them without changing the receipt. | Sound-only, color-only, flash-only, or narration-complete-as-claim confirmation. |

## Evidence ledger

| ID | Evidence URL and access date | What it establishes | Bounded application |
| --- | --- | --- | --- |
| E1 | [Ryan & Deci — Self-Determination Theory](https://selfdeterminationtheory.org/theory/), accessed 2026-07-22; primary theory-author site | Autonomy and competence-supporting conditions foster more volitional, high-quality motivation; rewards/controls can be informational or controlling. | Make results explanatory feedback on a completed action, not pressure to keep playing. It does not prove a cadence target. |
| E2 | [Przybylski, Rigby & Ryan (2010), *A Motivational Model of Video Game Engagement*](https://doi.org/10.1037/a0019440), accessed 2026-07-22; peer-reviewed | Frames video-game appeal in terms of autonomy, competence, and relatedness satisfaction. | Use meaningful choice and mastery feedback; do not infer a causal retention rate for this game. |
| E3 | [Chernev, Böckenholt & Goodman (2015), *Choice Overload*](https://doi.org/10.1016/j.jcps.2014.08.002), accessed 2026-07-22; peer-reviewed meta-analysis | The 99-observation, 7,202-participant meta-analysis identifies choice-set complexity, task difficulty, preference uncertainty, and decision goal as moderators; confidence, regret, deferral, and switching are useful measures. | Keep high-pressure post-run choices compact and inspectable. Three options is a product target, not a source mandate. |
| E4 | [Xiao, Henderson & Newall (2023), *What are the odds?*](https://doi.org/10.1371/journal.pone.0286681), accessed 2026-07-22; peer-reviewed | In the sampled UK games, disclosure compliance was 64.0%; only 1/75 surfaced odds automatically on a purchase page. Probability disclosures can be inaccessible even when present. | An optional chance surface must make odds/table material before commitment, not bury them behind settings or an info icon. Commercial-loot-box findings are used as a transparency warning, not as a model to import. |
| E5 | [FTC, *Bringing Dark Patterns to Light*](https://www.ftc.gov/reports/bringing-dark-patterns-light), accessed 2026-07-22; official consumer-protection report | Treats interfaces that obscure, subvert, or impair autonomous choice as dark patterns; calls out false beliefs and delayed material disclosure. | Prohibit fabricated urgency, misleading odds/near misses, and asymmetric close/claim paths even without commerce. This is consumer-protection guidance, not game-specific research. |
| E6 | [W3C WCAG 2.2 — Three Flashes or Below Threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html), accessed 2026-07-22; official standard explanation | Content must not flash more than three times in one second unless below defined general/red thresholds. | Reward celebration never uses strobe/full-screen flash; an off switch after the first flash is not sufficient. No WCAG conformance claim follows. |
| E7 | [W3C WCAG 2.2 — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), accessed 2026-07-22; official standard explanation | Programmatically determinable status messages let assistive technology receive updates without focus movement. | Browser UI receipt/status changes need a non-disruptive semantic announcement path; Canvas-only spectacle cannot be the sole confirmation. |
| E8 | [Xbox Accessibility Guideline 103 — Visual and audio cues](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/103), accessed 2026-07-22; official guidance | Important information should be available through multiple sensory methods; color alone and haptics alone are insufficient. | Reward meaning is text/icon/shape first, with optional audio/haptic/motion reinforcement. |
| E9 | [Fizek (2018), *Interpassivity and the Joy of Delegated Play in Idle Games*](https://doi.org/10.26503/todigra.v3i3.81), accessed 2026-07-22; peer-reviewed game studies | Describes idle/incremental play as potentially making participation optional or redundant. | Keep offline settlement a bounded planning convenience, never a substitute for movement/build mastery. It does not establish a cap or acceptable reward ratio. |
| E10 | Local: [`intake/production-brief.md`](../intake/production-brief.md), [`pm/reward-bands.md`](../pm/reward-bands.md), [`research/progression-rewards-idle.md`](progression-rewards-idle.md), accessed 2026-07-22 | Establishes offline/local-only, deterministic 60 Hz, no-commerce scope, ≤3 active choices, finite permanent progress, one capped return permit, and G5 evidence needs. | This packet operationalizes presentation/retention UX without changing those product rules. |

## Reward UX hierarchy

The hierarchy is deliberately **result-first, spectacle-last**. A player must be able to understand the grant with audio muted and reduced motion enabled before any flourish begins.

| Rank | Surface and required reading | Standard presentation | Static/accessibility equivalent | Priority rule |
| --- | --- | --- | --- | --- |
| 0 — outcome fact | `GRANTED`, `NO NEW GRANT`, or `ALREADY SETTLED`; item/progress/credit identity and exact delta. | Brief receipt arrival, distinct confirmed sound. | Persistent text, icon/shape, and final numeric/progress state; semantic status message. | Cannot be concealed by animation, rank color, or narration. |
| 1 — causal explanation | Completed eligible action, condition, rule/formula/table revision, current/target progress. | One causal connector from result to Archive/permit. | Text sentence and inspectable detail pane. | Must precede any next-run invitation or random reveal. |
| 2 — player agency | Three-or-fewer run options, or a post-run/Archive next action; each shows tactical role, immediate outcome, and any cost (normally none). | Stable cards with optional recommendation and visible reason. | Same order and values, keyboard/touch reachable; no timer/autopick. | Closing/deferring is equal effort to selecting; no default commit. |
| 3 — emotional punctuation | A bounded resolution beat: icon settle, one short cue, optional lore line. | 250–700 ms local motion/one-shot cue, then return to static receipt. | Direct static state; player can skip/disable. | Never delays claim, changes state, or imitates a near miss. |
| 4 — return invitation | “Begin next run” after the receipt is acknowledged or left visible. | Calm focus treatment, not scarcity/urgency. | Same semantic control. | Never blocks Archive/history/close; no countdown or diminishing late value. |

### Post-run flow

1. **Freeze confirmed state, not input.** The result adapter receives the resolved run record. It may show a compact `Run concluded` status, but the rules outcome already exists.
2. **Show the fact (Rank 0).** List each grant separately: run-only build end; boss/stage result; eligible extraction/Archive progress; permit issuance if eligible. A loss cannot be cosmetically rewritten as a “near win.”
3. **Show why (Rank 1).** For each persistent delta, display condition, `current / target`, and finite remaining eligible completions. If no delta exists, say why in plain language.
4. **Offer agency (Rank 2).** The player may inspect Archive, change an allowed loadout, start another run, or close. A recommended tactical option may state its build/context reason but has no forced selection and no rank advantage.
5. **Add punctuation (Rank 3) only after state is legible.** Use an original Abyssal Archive chime, resolved item icon, and optional ≤12-word lore/caption line. No roulette, spinning wheel, decelerating carousel, pseudo-near-miss, or “try again” framing.
6. **Invite voluntary return (Rank 4).** The next-run control is available without an urgency message, and receipt/history remains available after leaving.

### Idle settlement flow

1. **Pre-settlement preview.** Before a claim action (or on resume where claim is automatic by product rule), show one line: stored permit identity, accepted elapsed time, cap, formula inputs, and `expected credit`. No “claim before it is lost” language.
2. **Atomic settlement.** Persist `settled=true`, receipt ID, formula revision, accepted elapsed time, grant, and resulting balance together. Reopen resolves to Rank 0: `Already settled — no new credit` plus the original receipt.
3. **Receipt then planning.** State the exact active-earned comparison: return credit is auxiliary and cannot resolve combat, extraction, a companion unlock, a boss, or a stage. The player can inspect Archive/start a run/close; none of those alters the settled amount.
4. **Cap without punishment.** At 12 h the receipt says `cap reached; claim remains available indefinitely`. Time after the cap neither reduces a stored grant nor unlocks an extra claim.

## Guaranteed versus probabilistic reward policy

| Reward class | Policy | Disclosure before commitment | Determinism/randomness boundary | Presentation prohibition |
| --- | --- | --- | --- | --- |
| Run-only XP/skill choice | Guaranteed offer event; choice effect is deterministic once selected. | Exact effect, tactical role, before/after numeric value where relevant, and recommendation reason. | Fixed seed determines offer sequence; chosen card/committed outcome is in replay. UI does not reroll or substitute cards. | Autopick countdown, hidden synergy, fake scarcity, or presenting a recommendation as the only viable choice. |
| Boss/stage and tactic-affecting Archive progress | Guaranteed, visible finite condition/progress meter. | Condition, reward identity, current/target value, and remaining finite steps. | No probability table, pity timer, duplicate, near miss, wall-clock multiplier, or presentation RNG. | “Almost unlocked” animation that implies a different result; a permanent mechanic gated by chance. |
| Idle return credit | Guaranteed formula result within the persisted cap; one settlement per permit. | Permit, accepted elapsed time, cap, formula revision, expected/actual credit, and prohibited outcomes. | Fixed-point formula and persisted fields determine grant. Local-clock anomaly is zero new credit, not a second calculation or penalty. | Countdown, expiring cap, “collect now” urgency, rolling counter, or an idle-combat montage that implies simulated combat. |
| Non-mechanical cosmetic/lore surprise (only if later approved) | Optional; **not recommended for the vertical slice**. Zero tactical/progression value. | Complete outcome set; exact per-outcome percentage/weight summing to 100%; duplicate/exhaustion rule; table revision; result-seed/reveal derivation; no purchase/time gate. | The table and a deterministic seed/reveal derivation are persisted before reveal. Rule/table revision changes require a visible version boundary and cannot retroactively alter a committed receipt. | Hidden odds, rarity-only labels, variable-rate retries, undisclosed pity, state-dependent chance, duplicate dilution, near-miss reel, or a “better luck next time” nudge. |

### Probability disclosure rules

If any row is probabilistic, all of these rules are mandatory; otherwise the product uses a guaranteed finite-progress replacement.

1. **Material-before-action:** the complete table and exact probability for every outcome appear in the same decision surface before `Reveal` is enabled; a tooltip/settings page is not sufficient.
2. **Auditable arithmetic:** displayed percentages sum to exactly **100.00%** at the displayed precision; any residual/rounding method and weighted-table revision are disclosed.
3. **Outcome identity:** each row has a name, visual identity, category, and explicit `mechanical value: 0`. No vague “rare/epic” label without the result set.
4. **No concealed state:** a chance cannot vary by attempts, time away, player status, platform, UI setting, or unshown table. If an exhaustion bag is used, show the remaining items and conditional odds before each reveal.
5. **Persisted proof:** record `receiptId`, table revision, immutable outcome IDs, seed/derivation version, selected index/outcome, and reveal timestamp. The presentation log may vary only cosmetic asset selection derived from the receipt ID.
6. **No repeated-pursuit pressure:** no currency, daily quota, timer, duplicate conversion, recurrence prompt, or messaging that asks the player to repeat a reveal. A deterministic cosmetic choice is preferred.
7. **Reduced-motion honest reveal:** static result and table remain visible before/after a skip. Reveal length may be **Target: ≤700 ms** and is instantly skippable; skipping cannot alter result or evidence.

## Cadence, emotional pacing, and choice architecture targets

The targets make rewards informational (E1–E2), control choice complexity (E3), and avoid delegated idle play displacing the active loop (E9). They are hypotheses to measure, not borrowed normative values.

| Moment | Target cadence / limit | Emotional purpose | Measurable hypothesis |
| --- | --- | --- | --- |
| Active-run choice | **≤3** options per offer; no selection timer; effect prediction target **≥80%** in moderated comprehension. | Restore agency at a breakpoint without freezing the player in a catalog. | Participants correctly state the immediate chosen effect before commit; deferral/regret is lower than a five-option control without one choice exceeding **70%** across matched contexts. |
| Persistent progress after eligible action | Visible nonresetting `current / target`; associated breadth unlock within **≤3** eligible completions. | Competence after success or a failed attempt; turns a setback into legible next mastery. | No participant exceeds the three-completion bound; **≥80%** rate “I knew what advanced” at 4–5/5. |
| Post-run receipt | Rank 0/1 content remains visible until explicit close/next action; Rank 3 punctuation begins only after it is already visible. | Completion and comprehension before celebration/renewal. | **≥90%** can identify the reward delta and causal condition from a muted/reduced-motion capture. |
| Post-run narration | **≤12 words** per optional line; no new non-emergency line within **8 s**; caption/log/skip retained. | Flavor without masking a decision or turning a result into a command. | **≥90%** recall the durable message in a dense 30-second fixture; zero narration is required for state understanding. |
| Idle settlement | **1** unsettled permit and **1** settlement per permit; accepted absence cap **12 h**; return value **≤20%** of active seal value at issue. | Welcome-back convenience, not an appointment. | Zero duplicate grants in fault/reopen matrix; **≤10%** of moderated participants rate obligation 4–5/5. |
| Return invitation | No notification/exposure, streak, expiry, or countdown; cap receipt remains indefinitely claimable. | Preserve voluntary re-entry and trust. | 0 notification exposures and 0 late-return-loss reports in scripted audit; players can explain no content was lost after 12 h. |
| Reward animation | Reveal/punctuation **≤700 ms**, immediately skippable, no more than **3 flashes/s**, no full-screen red wash. | Mark a confirmed change without manufacturing anticipation or sensory risk. | Capture analysis finds 0 flash violations; result recognition stays within **5 pp** between standard and reduced-motion modes. |

## Anti-dark-pattern protections

| Risk pattern | Required protection | Audit assertion |
| --- | --- | --- |
| Hidden or delayed material information | Place cause, delta, caps, formula/table revision, and exact odds on the result/decision surface. | Every persistent reward has one visible condition; every chance row is table-auditable before action. |
| Artificial urgency / false scarcity | No claim expiry, countdown, daily task, stock language, notification, or “last chance” copy. | Text/content scan finds 0 urgency/limited-time/return-now reward prompts. |
| Asymmetric choice | Close, inspect, defer, and choose use equal target size/contrast/focus order; `Begin next run` never auto-activates. | Keyboard/touch test closes/defers without extra confirmation and no default commit occurs. |
| Near-miss / variable-ratio theater | No reel/wheel, deceleration, unearned adjacent reward, retry copy, duplicate conversion, or hidden pity. | Video/presentation audit finds only confirmed outcome rendering; table audit finds no attempt-dependent modifier. |
| Idle coercion | The permit receipt is indefinitely claimable at cap; invalid clock is safe-zero; active play is still the main progress source. | Cap-plus-one/reopen/clock-back fixture gives no loss, no duplicate grant, no return-only combat outcome. |
| Sensory manipulation | Rank 0/1 meanings remain in text/icon/shape; sound/haptics/motion have controls; flashes remain below source threshold. | Muted, mono, high-contrast, and reduced-motion runs preserve receipt values and final simulation/state hash. |
| Authority confusion | UI labels distinguish `confirmed`, `preview`, `already settled`, and `no new grant`; no animation means “maybe.” | Rejected/duplicate/failed fixture cannot emit a confirmed-grant presentation event. |

## G5 and G8 linkage — targets only

| Gate | This packet contributes | Required future evidence | Current status |
| --- | --- | --- | --- |
| **G5 — fairness and no-commerce reward balance** | A no-commerce receipt contract; guaranteed tactic-affecting progress; exact probability rules if a non-mechanical surprise exists; atomic idle settlement and anti-FOMO copy. | `qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl`: absent-paid-path scan; reward-table/receipt inspection; 0/short/cap/cap-plus/negative/clock-back/reopen settlement property matrix; 10/20-session parity fixtures; moderated comprehension/pressure responses. | **NOT MEASURED / NOT PASSED.** Research targets do not satisfy the gate. |
| **G8 — novelty / striking element** | An original, receipt-first **Abyssal Archive Resolution** presentation: causal action-to-Archive trace plus optional sparse W-05 audio/visual punctuation, intentionally rejecting roulette/loot-box theater. | `qa/evidence/gates/G8-novelty-comparison-and-impression.json`: five-title comparison ledger limited to presentation categories; fixed-seed post-run/idle capture; first-impression task rating whether the causal receipt is distinctive and readable; explicit no-feature-equivalence claim. | **NOT MEASURED / NOT PASSED.** The concept is not an implemented or measured novelty result. |

## Validation packet and implementation handoff

| Test | Inputs | Target evidence / failure condition |
| --- | --- | --- |
| Receipt/replay invariance | Same resolved run and settlement records with normal, muted, mono, high-contrast, reduced-motion, missing-asset, and skipped-animation modes. | Reward receipt fields and final state/simulation hash are identical; any divergence is an authority leak. |
| Probability-table audit | Inject incomplete table, percentages not summing to 100%, hidden state modifier, duplicate before exhaustion, changed revision, and near-miss assets. | Reject/block the chance surface; no mechanic is chance-gated. |
| Choice comprehension | Counterbalanced 3-option versus 5-option fixed offers with stated player goal. | Assess effect prediction, decision time, confidence, deferral, regret, dominance, and unintended commit. Targets are in cadence table. |
| Idle settlement fault matrix | Zero/short/cap/cap-plus-one/negative/clock-back/reopen/malformed/denied-storage cases. | Exactly-once receipt, no late loss, safe-zero for invalid time, no combat/progression bypass. |
| Presentation safety | Largest-scale reward/idle/punctuation captures, including high-density transitions. | Static semantic alternative present; no >3 flashes/s; captions/status semantics work; no result hidden by flair. |
| Trust/pressure study | Moderated post-run and 0 h/2 h/12 h/24 h return scenarios. | Measure “I knew what changed,” “I could leave safely,” “I felt pressured to return,” and perceived fairness; report all responses, not only favorable ones. |

**Implementation boundary:** a future implementation may add a read-only reward receipt adapter, local receipt persistence/inspection, and presentation observers only after the owning rules/QA work defines their schemas. It must not add a commerce surface, network path, account, runtime provider, random mechanical reward, idle combat, or new rules authority. The G5/G8 evidence paths above remain the required gates; this research packet is planning input only.
