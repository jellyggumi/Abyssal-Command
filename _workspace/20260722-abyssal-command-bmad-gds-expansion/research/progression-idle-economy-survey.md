# Progression and Idle Economy Survey

**Status:** research-backed target specification. This file makes no code change, reports no runtime measurement, and does not claim a gate pass.

## Decision

Use active play for every campaign-critical and tactic-affecting result. A concluded active run may issue one local **Archive Return Permit**; the next resume settles it once into a small, player-directed Archive-preparation credit. The settlement is deterministic, capped, receipted, and replayable from its persisted inputs. It is not simulated combat, a daily-login reward, a timer appointment, a random reward, or a monetized acceleration path.

The target is a satisfying visible growth signal after absence while retaining movement, build choice, extraction, boss resolution, stage access, and campaign completion as earned active-play outcomes.

## Product and evidence boundary

Abyssal Command is an offline deterministic 60 Hz single-player browser defense-survivor. It has no account, cloud sync, network dependency, commerce, ads, paid skips, premium currency, subscriptions, social comparison, or purchase path. `defense-catalog.js` and the deterministic simulation remain the future rules authority; a return receipt must never become a second rules authority. These are product constraints, not measurements.

External research supports a direction rather than an exact timer or value. Self-determination theory links autonomy and competence support with more volitional engagement, while idle-game scholarship identifies the agency risk of delegated play. Probability-disclosure research warns that disclosures can be inaccessible even where they exist. Therefore the safest design is deterministic mechanical progression and optional, fully disclosed non-mechanical variance only. No source below establishes the numerical bands in this packet; every number is an **unverified target**.

## Evidence ledger

| ID | Evidence and URL | Accessed | Evidence used | Limit |
| --- | --- | --- | --- | --- |
| E1 | Ryan & Deci, *Self-Determination Theory* — <https://selfdeterminationtheory.org/theory/> | 2026-07-22 | The authors describe autonomy and competence support as conditions for more volitional, high-quality motivation and engagement. | General motivation theory, not a reward-cap experiment. |
| E2 | Przybylski, Rigby & Ryan (2010), *A Motivational Model of Video Game Engagement* — <https://doi.org/10.1037/a0019440> | 2026-07-22 | The article frames game appeal through satisfaction of competence, autonomy, and relatedness. | Does not prescribe a cadence or an idle model. |
| E3 | Fizek (2018), *Interpassivity and the Joy of Delegated Play in Idle Games* — <https://doi.org/10.26503/todigra.v3i3.81> | 2026-07-22 | Idle/incremental games can make participation optional or redundant. | Game-studies analysis, not causal balance evidence. |
| E4 | Xiao, Henderson & Newall (2023), *What are the odds?* — <https://doi.org/10.1371/journal.pone.0286681> | 2026-07-22 | The study found probability disclosures in sampled commercial games were often not prominent or easily accessible. | Commercial loot boxes; this product has no paid randomized purchase. |
| E5 | W3C, *Understanding SC 2.2.1 Timing Adjustable* — <https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html> | 2026-07-22 | Time limits require user control such as turn-off, adjustment, or extension where applicable. | Accessibility guidance, not a game-economy result. |
| E6 | Apple, *App Review Guidelines*, §3.1.1 — <https://developer.apple.com/app-store/review/guidelines/> | 2026-07-22 | Randomized virtual items obtained through purchase require odds disclosure before purchase. | Purchase-only policy; cited as a transparency floor, not an applicable monetization rule. |
| E7 | Google Play, *Monetization and Ads policy* — <https://support.google.com/googleplay/android-developer/answer/9858738> | 2026-07-22 | Games offering randomized virtual items from a purchase must disclose odds before and near that purchase. | Purchase-only policy; Abyssal Command must not add such a purchase. |
| E8 | NIST SP 800-90A Rev. 1 — <https://csrc.nist.gov/pubs/sp/800/90/a/r1/final> | 2026-07-22 | Deterministic random-bit generation can be specified reproducibly. | Cryptographic RNG standard, not an anti-cheat or reward-balance model. |
| E9 | MDN, `Window: storage` event — <https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event> | 2026-07-22 | A storage mutation event is delivered to other same-origin documents, not the initiating window. | Browser API behavior; it does not make local storage tamper-proof. |

## Research interpretation

| Finding | Translation for this game | Explicit rejection |
| --- | --- | --- |
| Autonomy and competence support are relevant to engagement (E1–E2). | Show the player exactly what active action advanced, what the return permit can do, and let the player select a known Archive destination. | Opaque progress, forced claim animations, automatic spend, or a reward that changes no understandable state. |
| Delegated play can displace agency (E3). | Idle settlement remains auxiliary preparation; it cannot solve survival, aiming/movement, extraction, boss, stage, or campaign challenges. | Offline battle simulation, AFK clear rewards, queued combat, or a return-exclusive combat advantage. |
| Discoverability matters as much as disclosure (E4, E6–E7). | Mechanical outcomes are deterministic. Any future non-mechanical random outcome presents its complete table and exact odds in the same pre-commit panel. | Hidden odds, rarity labels without numbers, variable odds, duplicates used to stretch progress, near-miss effects, or a settings-only disclosure. |
| Nonessential timing should be controllable (E5). | A cap is an inflation bound, not an expiry. Receipt remains inspectable and credit does not decay after the cap. | Streaks, notifications, countdowns, daily reset, storage-full pressure, missed-content loss, or return multipliers. |
| Determinism needs an explicit state contract (E8–E9). | Persist permit inputs and a single settled receipt atomically; resolve duplicate-tab/save-race behavior by monotonic save revision and compare-before-write. | Recalculate on panel reopen, advance combat RNG, or assume browser-local storage is a secure server clock. |

## Progression decision table

All rows are targets pending implementation and measurement. `Active Seal` is a future, visible active-play progress unit; `Archive Credit` is restricted credit and never a general currency.

| Surface | Source and cadence | Target numeric band | Player-visible disclosure | Allowed value | Hard boundary | Gate relevance |
| --- | --- | --- | --- | --- | --- | --- |
| Run-build choice | Active XP threshold during a run | Exactly 3 options; target >=80% immediate-effect prediction in moderated comprehension | Effect, tactical role, and before/after numerical value when applicable; no auto-pick timer | Run-only build change | Cannot persist as raw-stat power or require manual aim | G5 fairness; G7 loop readability |
| Permanent tactical breadth | Eligible active elite/extraction condition | 1 visible nonresetting increment per eligible completion; named unlock in <=3 eligible completions | Reward identity, condition, and `current / 3` before next run | Equal-power sidegrade / companion breadth | 0% hidden chance, duplicate requirement, paid path, or idle-only completion | G5 |
| Boss/stage/campaign | Active boss victory only | 100% active condition; Stage 10 remains active terminal rule | Boss objective and stage condition | Stage access/campaign progression | 0% Archive Credit, timer, probability, or absence settlement contribution | G5; G8 preserves authored stage outcome |
| Archive Return Permit | One concluded active run may issue one permit | <=1 unsettled permit; <=1 settlement per permit; accepted absence 0–12 h | Permit state, 12 h cap, formula, and single-settlement rule | Small Archive-preparation credit | Starting, reopening, or calendar presence cannot mint another permit | G5, G8 |
| Archive Credit | One deterministic resume settlement | <=20% of `activeSealValueAtIssue`; each sidegrade requires >=80% active seals plus separate active confirmation | Exact fixed-point inputs/output, rules revision, settled permit ID, and allowed spend | Preparation toward previously known equal-power sidegrade | 0 combat XP/run XP, boss/stage/extraction/companion/campaign completion, combat-stat delta, or simulated combat | G5 |
| Optional presentation surprise | Only if future scope separately approves it | 0 mechanical value; 100% outcome-set and exact-odds visibility; 100% duplicate-free until table exhaustion | Full table, each percentage, table revision, seed/derivation, pity state, and static/reduced-motion reveal before commit | Cosmetic/Archive flavor only | No purchase, timer, repeat-pressure, combat effect, or progress value | G5; exclude from G8 proof until independently tested |

### Deterministic settlement target

```text
elapsedMs = max(resumeWallMs - issuedAtWallMs, 0)
acceptedElapsedMs = min(elapsedMs, 43_200_000) // 12 h in milliseconds
returnCreditMicroSeals = floor(
  activeSealValueAtIssueMicroSeals * acceptedElapsedMs / 216_000_000
)
```

`1 Seal = 1_000_000 microSeals`. Timestamps are whole milliseconds. Evaluate the numerator and division as arbitrary-precision integers, with exactly one final floor toward zero; do not round an intermediate value. `216_000_000 = 5 × 43_200_000`, so the result is exactly the <=20% linear cap. The receipt persists `permitId`, prior and new save revision, rules revision, issued timestamp, resume timestamp, `acceptedElapsedMs`, snapshot active-seal value in microSeals, formula identifier, output in microSeals, `settled=true`, and an active-confirmation requirement. Reopening renders the receipt; it does not invoke settlement.

A local clock is mutable and browser storage may be deleted or concurrently written. This design limits, but does not claim to prevent, device-time manipulation. Negative, malformed, rollback, or impossible elapsed intervals yield **zero new credit** and preserve the valid prior state. A forward clock change is bounded by the one-permit and 20% limits; it cannot grant campaign progress. There is no punitive cooldown or deletion response.

## Earned versus probabilistic reward contract

### Mechanical rewards: certainty required

| Rule | Target |
| --- | --- |
| Tactic-affecting permanent unlocks with disclosed deterministic condition | 100% |
| Tactic-affecting permanent unlocks that require hidden probability, duplicate, near miss, payment, or return time | 0% |
| Mechanical probability in Archive settlement | 0% |
| Archive Credit share of a sidegrade cost | <=20% |
| Required active-seal share | >=80% |
| Separate active confirmation to complete sidegrade | 100% |

The product does not need a mechanical pity system because its proposed permanent path is finite, visible, and deterministic. `current / 3` is a direct bounded guarantee, not a covert pity counter.

### Optional non-mechanical randomness: disclosure and pity rule

This is a **constraint for a future approved cosmetic-only table**, not a recommendation to ship randomness.

1. Before the player commits, the UI must show every possible result, exact probability of each result in basis points and percent, table revision, whether the table is exhausted, duplicate policy, and the maximum attempts to every unique outcome.
2. The odds table is immutable for a receipt/table revision. Any revision creates a new table identifier and is shown before a player can select it; it cannot silently alter an existing player's odds.
3. **Duplicate protection:** each finite table must contain only not-yet-owned items. On grant, remove that item before the next attempt. The table stops when exhausted; it never automatically resets and has no duplicate-conversion currency.
4. **Pity/guarantee rule:** a separate pity counter is prohibited. Finite duplicate-free exhaustion is the guarantee: with `N` listed outcomes, every eligible outcome is granted within at most `N` attempts, and the pre-commit UI shows the current remaining count and maximum `N`. There is no non-exhaustible fallback table.
5. No near-miss animation, fake rarity roll, obscured odds, changing probabilities, or repeat prompt is permitted. The player can decline without losing any item, progress, or future opportunity.

The default remains no random reward table. A future implementation must prefer a finite deterministic cosmetic unlock track over adding the table above.

## Fair reward cadence and growth-feeling hypotheses

| Hypothesis | Target measurement | Falsifier / decision rule | Stage |
| --- | --- | --- | --- |
| Visible active increments create growth without raw-power inflation. | In a 12–16 person moderated pilot, >=80% rate “I knew what advanced” and “I could recover” at 4–5/5. | More than 10% rate pressure to retry at 4–5/5, or any participant needs a fourth eligible completion for the named unlock. | Stage 2 balance/rewards |
| A small receipt is comfort rather than an appointment. | Test 0 h, 2 h, 6 h, 12 h, and 24 h resumes; >=80% rate receipt understanding at 4–5/5 and <=10% report time obligation at 4–5/5. | Any loss/decay after cap, a notification exposure, or >10% appointment pressure rejects the cadence. | Stage 2 growth; Stage 3 QA |
| Return credit cannot change practical combat parity. | Matched 10- and 20-session local fixtures, same active-earned state and seeds, compare zero versus maximum return credit; median completion/boss times within +/-15%, clear rates within 5 pp, normalized damage/hazard errors within +/-10%. | A point estimate outside a band or unresolved preregistered bootstrap 95% interval is not a pass. | Stage 2 balance; G5 evidence target |
| Settlement is replayable and idempotent. | 0 h, cap, cap+1, negative, malformed, clock rollback, forward jump, reopen x100, two-tab write race, and storage-denied cases. | Any duplicate receipt/grant, combat RNG advance, state mutation after settlement, or unrecoverable save failure rejects the implementation. | Stage 3 QA/release |
| A future optional surprise stays transparent and non-coercive. | Player rule-recall probe and table audit: 100% table/odds/pity/duplicate-policy visibility and 0 mechanical values. | Hidden chance, duplicate before exhaustion, a paid/timed retry, or player inability to identify guarantee condition rejects the table. | Stage 2 rewards; Stage 3 QA |

## Abuse prevention and player-control safeguards

| Risk | Required safeguard | Verification target |
| --- | --- | --- |
| Quit/reopen farming | Permit is issued only after a concluded eligible active run; one outstanding permit maximum; settled receipt is authoritative. | Reopen and repeated-resume fixture grants exactly once. |
| Local-clock rollback/forward manipulation | Negative or invalid delta grants zero; positive delta caps at 12 h; one permit and 20% ceiling bound forward changes. Do not claim cheat-proofing. | Clock-back, 24 h, and absurd-future timestamp cases preserve prior state and add no over-cap value. |
| Duplicate-tab settlement | Persist compare-before-write against monotonic save revision; one winner writes receipt, losing tab reloads receipt. | Simultaneous-resume fixture produces one permit receipt and one credit value. |
| Save deletion/storage denial | Preserve in-memory active state where feasible; show local recovery/export guidance without creating a reward fallback or remote account dependency. | Storage-denied and malformed-save tests do not mint credit or corrupt active progression. |
| Reward laundering into combat power | Restricted credit has an allowlisted Archive destination; each completion requires active >=80% seals and a separate active confirmation; diff combat/progression fields. | Property matrix shows zero deltas to prohibited fields. |
| Appointment pressure | No notification, expiration, streak, daily reset, countdown, full-storage warning, late penalty, or cap decay; player may dismiss receipt and inspect later. | UI/content scan returns zero prohibited strings/events; moderated obligation band remains <=10%. |
| Forced/unclear claim | Settlement is automatic and idempotent; receipt has static, reduced-motion, keyboard/switch-accessible rendering and does not auto-dismiss. Player chooses later whether to spend credit. | Reduced-motion, muted, keyboard/switch, and screen-reader checks preserve the same receipt data. |
| Probability manipulation | Default no table; if approved, immutable revision, exact basis-point odds, finite duplicate-free exhaustion, disclosed `N`-attempt guarantee, no repeat pressure. | Table audit and seeded receipt replay reproduce the same disclosed rule. |

## Implementation boundary by production stage

| Stage | Authorized planning boundary | Explicit non-goals | Gate relation |
| --- | --- | --- | --- |
| Stage 1 — concept / presentation / core loop | Define result-screen language, Archive receipt information architecture, static/reduced-motion presentation, and the active-versus-Archive taxonomy. | No runtime source, reward retune, timer, random table, provider, network, commerce, or gate assertion. | Supports future G5 readability evidence; does not measure G5 or G8. |
| Stage 2 — balance / rewards / growth / encounters | Preregister value bands, finite active unlock progression, sidegrade parity cohorts, optional-table disclosure contract, and 6/12/24 h cadence study. | No reward outcome based on map seed, wave composition, absence time, or payment; no campaign or combat rules change under this packet. | G5 is the fairness target. G8 remains limited to authored novelty/QA impression; reward variation cannot be offered as G8 evidence. |
| Stage 3 — combat feedback / resources / performance / QA / release | Specify deterministic receipt fixtures, save-race/clock/storage fault matrix, accessible receipt checks, local export/delete expectation, and content scans for prohibited pressure. | No release authorization, no gate pass, no cloud account, remote clock, telemetry network transmission, or runtime audio/provider dependency. | Produces only future G5 evidence inputs. G8 requires its own five-comparable and human-impression method; this survey provides none. |

## G5 and G8 considerations

**G5 — fairness and no-commerce reward balance.** The governing future method is the existing G5 requirement: demonstrate absent paid paths, an active-only finite reward route, permit cap, <=20% return-credit share, >=80% active component, active confirmation, 10/20-session paired parity, and no return-only combat outcome. This survey sets targets only. G5 remains **NOT MEASURED / NOT PASSED**.

**G8 — novelty / striking element.** Deterministic return accounting and a transparent receipt are fairness infrastructure, not a novelty claim. PCG seeds, wave variation, and narrative presentation must not alter a boss/stage condition, reward identity, return-credit amount, table odds, pity counter, or campaign outcome. If a future Archive presentation is proposed as an authored novelty surface, it still requires G8's independent five-comparable comparison and human QA impression protocol. G8 remains **NOT MEASURED / NOT PASSED**.

## Implementation-ready acceptance checklist

Before any future implementation may be evaluated, it must provide all of the following as data and test fixtures, not design prose:

1. A versioned local receipt schema with atomic settled-state write and a monotonic save revision.
2. Fixed-point settlement fixtures for 0 h, 2 h, 6 h, 12 h, 24 h, negative, malformed, rollback, forward jump, re-open, and two-tab conflict cases.
3. A forbidden-field diff proving settlement changes no combat XP, run XP, run skill, extraction, boss, stage, companion, campaign, or combat-stat fields.
4. Sidegrade spend fixtures proving <=20% Archive Credit, >=80% active seals, and an active confirmation prerequisite.
5. Static, reduced-motion, muted, keyboard/switch, and screen-reader receipt checks with no timed dismissal.
6. A content/config audit proving no commerce, ads, paid skips, premium currency, account/cloud sync, notification/streak/countdown, hidden probability, or non-disclosed duplicate path.
7. A preregistered 10/20-session parity analysis and moderated cadence study before any G5 review.

Until those artifacts exist and are independently reviewed, these targets are not entitlement, runtime behavior, acceptance evidence, or a gate result.
