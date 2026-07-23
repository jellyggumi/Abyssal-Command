# Fair Offline Archive-Return Economy Research Packet

## Research question

How can an offline, no-commerce **Abyssal Command** give a player a satisfying return after an absence without simulating combat, turning absence into superior combat power, pressuring a return cadence, or breaking the tactical-parity envelope between 10- and 20-session accounts?

## Product boundary

This packet treats an active run as the authority for combat XP, survival, movement mastery, boss resolution, extraction, stage access, run skills, and permanent companion acquisition. The fixed 60 Hz combat rules remain the authority; Archive return is a local post-run accounting action only. W-05 **Archive** may record a return, but W-01 Echo, W-02 Bind, W-03 Gate Integrity, W-04 Domain, and the Stage 10 ending remain earned in active play.

**Idle progress** means a pre-authorized, capped conversion of elapsed absence into a small Archive credit. **Combat-power substitution** means the absent player receives any result that would otherwise require movement, targeting/build judgment, enemy survival, extraction, a boss clear, or a superior numerical loadout. The former is a convenience layer; the latter is out of scope.

## Source ledger

| ID | Source | Provenance | Observed support used | Limit |
| --- | --- | --- | --- | --- |
| S1 | *Abyssal Command Defense Survivor Design*, `docs/abyssal-command-defense-survivor-design.md` | **Direct local product source** | Establishes deterministic 60 Hz rules, offline/local-first operation, movement-first automatic combat, no commerce/accounts/network, five canon windows, and Stage 10 ending. | Product contract, not external evidence. |
| S2 | Ryan, Rigby & Przybylski, “The Motivational Pull of Video Games: A Self-Determination Theory Approach” (2006), <https://doi.org/10.1007/s11031-006-9051-8> | **Peer-reviewed primary research** | The article’s reported studies connect in-game autonomy and competence to enjoyment and preference. | It does not prescribe an idle-economy cap or prove this genre’s outcomes. |
| S3 | Fizek, “Interpassivity and the Joy of Delegated Play in Idle Games” (2018), <https://doi.org/10.26503/todigra.v3i3.81> | **Peer-reviewed primary game-studies article** | Analyses idle games as delegated play, where player participation can become optional or redundant. | Critical/game-studies analysis; not a controlled balance experiment. |
| S4 | NIST SP 800-90A Rev. 1, *Recommendation for Random Number Generation Using Deterministic Random Bit Generators*, <https://csrc.nist.gov/pubs/sp/800/90/a/r1/final> | **Official primary technical standard** | Specifies deterministic methods for generating random bits. | Cryptographic RNG guidance, not a game-save or anti-cheat specification. |
| S5 | W3C, *Understanding Success Criterion 2.2.1: Timing Adjustable*, <https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html> | **Primary standards-body guidance** | Says users need adequate time and identifies turn-off/adjust/extend alternatives; notes that time-driven content updates can form time limits. | WCAG applies to web content; use here as accessibility evidence, not a claim of game conformance. |
| S6 | Apple, *App Review Guidelines*, §3.1.1, <https://developer.apple.com/app-store/review/guidelines/> | **Primary platform policy** | Requires odds disclosure before purchase for randomized virtual items. | It applies to purchases; Abyssal has none. It supports a stronger voluntary clarity rule, not a legal requirement for this design. |
| S7 | Xiao, Henderson & Newall, “What are the odds? Poor compliance with UK loot box probability disclosure industry self-regulation” (2023), <https://doi.org/10.1371/journal.pone.0286681> | **Peer-reviewed primary study** | Reports that disclosure can be difficult to find and insufficiently prominent in commercial games. | Commercial paid loot boxes are not comparable to this no-commerce system; use only for the visibility warning. |

**Source-evidence boundary.** S2–S7 establish motivations, delegated-play risk, deterministic-method availability, timing accessibility, and disclosure visibility. They do **not** establish a correct 12-hour window, an appropriate credit amount, or the present campaign’s power curve. Every numbered value below is an **unverified target** to test.

## Observed patterns and bounded inferences

1. **[Source evidence]** S3 identifies the genre tension: delegated progress can make player participation optional. **[Bounded inference]** That tension is unusually costly in a movement-first survivor, because positioning and survival—not waiting—are the intended evidence of competence. Return rewards must therefore stop before any combat-resolution boundary.
2. **[Source evidence]** S2 relates autonomy/competence to game enjoyment. **[Bounded inference]** A return feels better when it explains exactly what happened and lets the player choose a harmless Archive destination, rather than presenting an opaque windfall.
3. **[Source evidence]** S5 favors eliminating or giving users control over nonessential time pressure. **[Bounded inference]** A cap must be an inflation ceiling, not a “vault full” alarm, a streak, or an expiring pickup. The player must not lose a unique reward or content for returning late.
4. **[Source evidence]** S6 and S7 show that merely having an odds rule does not make a random-reward interface legible. **[Bounded inference]** The safest return reward is fully deterministic; probability disclosure is a fallback for non-mechanical cosmetics only.
5. **[Source evidence]** S4 demonstrates that deterministic random methods are feasible. **[Bounded inference]** Do not use randomness at all in the economic return calculation. If optional non-mechanical Archive flavor later uses a seeded table, persist its seed and table revision before reveal so the result is reproducible.

## Fair return windows: what the system may and may not buy

| Absence outcome | Fair, allowed effect | Disallowed substitution | Why |
| --- | --- | --- | --- |
| Player returns after minutes | Small fractional Archive credit from one already-issued return permit. | A kill, combat XP, run skill, extraction roll, stage progress, boss result, companion, or a stronger stat. | Short absences should not become quit/reopen farming. |
| Player returns between 2 and 12 hours | The same linear, deterministic credit continues toward its clearly displayed ceiling. | Additional “while you were away” fights, simulated movement, loot rolls, or a bonus multiplier. | This is a convenience curve, not an autonomous game session. |
| Player returns after 12 hours | Credit has reached its ceiling and remains claimable; no credit decays and no unique content is missed. | A second permit, catch-up for every missed 12-hour block, or a notification-driven storage-full penalty. | The 12-hour number limits inflation rather than creating a daily appointment. |
| Local clock moves backward / save reopens | Zero new credit for the anomalous interval; preserve the save and show a neutral clock-warning state. Reopen yields no second grant. | Data deletion, a punitive cooldown, or recomputing/re-rolling a reward. | Local time is not a trustworthy authority; the safe response must be non-destructive. |

A 12-hour ceiling is a candidate, not an evidence-derived optimum. It should be tested against 6-, 12-, and 24-hour candidates with equal total value. **Reject any candidate whose perceived obligation is higher than its clarity/comfort benefit.** The no-FOMO requirement has more authority than a retention cadence.

## Proposed model: Archive Return Permit and Credit

### State and eligibility

1. An **active run conclusion**—win, loss, or voluntary end after the first meaningful encounter—may set `returnPermit = 1`. The save holds at most one permit. Starting/reopening the app cannot mint another permit.
2. The permit snapshots only local accounting data: `permitId`, `issuedAtWallMs`, `archiveRulesRevision`, `activeSealValueAtIssue`, and `settled = false`. It has no RNG seed because the core award is deterministic.
3. On the next resume, calculate once, atomically persist `settled = true`, the accepted elapsed time, the output credit, and the incremented save revision **before** showing the return panel. A reopened panel reads the recorded receipt; it never recalculates.

### Formula and restricted spend

**Unverified target formula:**

```text
acceptedHours = clamp((nowLocalWallMs - issuedAtWallMs) / 3_600_000, 0, 12)
returnCredit = activeSealValueAtIssue × 0.20 × (acceptedHours / 12)
```

Use fixed-point integer units, not floating point. Negative deltas produce `0`; deltas above 12 hours produce the 12-hour ceiling. The receipt stores every formula input and output so the UI and an exported local save can reproduce it.

`returnCredit` is **Archive-only restricted credit**, not a general currency:

- It can pay at most **one-fifth** of the cost of an already-active **Archive sidegrade record**. The remaining **at least four-fifths** must be active `Field Seals` earned under a visible encounter condition.
- It can never meet the final active condition for a companion, stage, boss, extraction, or campaign ending. If a sidegrade record would complete from a fractional credit, it stays *prepared* until its distinct active confirmation condition occurs.
- A sidegrade must be an equal-power tactical alternative, not a raw damage/health/armor/rate/stat increase. It may change loadout route, information organization, or an already-unlocked companion’s role presentation only if the parity tests below pass.
- Unspent credit remains local and never expires. There is no shop, premium conversion, trade, ad watch, payment, account sync, social comparison, daily reset, or push-notification prompt.

This creates a small growth signal—an Archive record moves visibly toward a player-selected, previously known sidegrade—without awarding the combat achievement itself. A player who never uses the system still reaches every campaign-critical unlock through active play.

### Determinism and local-clock limits

The outcome is deterministic for a given saved permit and resume timestamp; it neither advances the 60 Hz simulation nor consumes combat RNG. Persisting a receipt makes same-save reopening idempotent. Offline local storage cannot establish a trusted wall clock: a player can manually move time forward. The permit cap, one-settlement rule, and **active-run issuance requirement** bound the benefit to one small credit per active run; they do not pretend to provide cheat-proof time attestation. That limitation must be disclosed in implementation notes and validated through save tests.

## Certainty, probability, and no-FOMO disclosure

### Return panel: compulsory, static, readable

The first frame after resume must contain text, not only animation:

- `Archive return: 1 permit settled once.`
- `Accepted absence: 8 h 14 m of 12 h maximum.`
- `Credit: 0.137 Archive Seal (20% maximum of the active record value).`
- `Rule: credit cannot clear a stage, resolve extraction, unlock a companion, or change combat stats.`
- `Source: your prior completed run; no reward expires while you are away.`
- `View receipt` exposes inputs, cap, fixed-point formula, rules revision, and settled permit ID.

The panel must be dismissible without collection animation; its information remains in W-05 Archive. Reduced-motion mode uses a static receipt and does not time out. This follows the direction of S5: no reading deadline or transient-only explanation.

### Certainty rules

- **100% deterministic:** return credit, eligible item, credit cap, whether the permit exists, and the active confirmation condition. Show exact numbers before any Archive spend.
- **0% probability in mechanical return rewards:** no loot table, rarity tier, duplicate, near-miss, changing chance, streak bonus, “bonus” claim button, or hidden eligibility factor.
- **If an optional non-mechanical surprise is ever added:** disclose the full outcome set and exact percentage before it is triggered; persist the table revision and seed; provide no mechanical value; allow reduced-motion/static reveal; and provide a duplicate-free exhaustion rule. This is a future constraint, not a recommendation to add randomness.

### No-FOMO safeguards

1. One permit is issued by active play, not by calendar presence; a player never has a daily-login deficit.
2. At the 12-hour ceiling the receipt remains available indefinitely. Time beyond the ceiling does not erase, downgrade, or block content.
3. No “return now,” “storage full,” streak, countdown, scheduled event, notification, loss multiplier, or missed-reward screen is permitted.
4. The same active-only path unlocks all campaign-critical content. Archive credit only reduces a bounded sidegrade-record cost and never becomes the dominant progression route.
5. Settlement always occurs automatically and atomically once at resume; disabling the presentation only suppresses its animation. The static, keyboard/switch-accessible receipt is retained for later inspection and is never a second settlement control.

## Risks, contradictions, and falsification

- **Authority leak / reproducibility failure:** If the UI recomputes on every open, renders a rounded number inconsistent with the stored integer, or lets the wall clock mutate a settled receipt, presentation becomes an alternate rules authority. **Test:** clone a save before resume; resume/reopen it 100 times at the same timestamp and assert one receipt, identical fixed-point output, no RNG advancement, and byte-for-byte identical rules state after the first settlement.
- **Fairness failure:** If return credit can finish an active-gated companion or confers a raw stat increase, the absent player has bought combat power with time. **Test:** property-test every spend recipe: `return-credit share <= 20%`, active seals `>= 80%`, `finalActiveCondition === true`, and delta to combat-stat fields is zero.
- **Accessibility failure:** A timed flourish that hides the formula or auto-dismisses the reward makes a return harder to understand for users who need more reading time. **Test:** keyboard/switch and screen-reader pass in reduced-motion mode; the full receipt must be available without a timed action and the panel must never auto-close.
- **Design contradiction:** A 12-hour cap can still be interpreted as “check twice daily.” **Test:** compare 6/12/24-hour caps with identical max value; collect obligation (“I felt I needed to return at a particular time”) and comprehension. Reject any cadence where >10% of testers score obligation 4–5/5 or where participants describe the cap as a daily requirement.
- **Unverified target warning:** The proposed credit is intentionally conservative; it may feel too weak. Increasing it is not the first fix. First test better explanation, player-selected destination, and an immediate visible Archive record. Raise its value only if parity and no-substitution tests remain green.

## Testable targets and telemetry

All figures are **unverified design targets**, not sourced facts.

1. **[Target: active authority]** `100%` of return receipts have zero changes to combat XP, run XP, stage/boss/extraction/ending flags, companion acquisition, run-skill state, and combat-stat fields. Instrument an allowlist diff of saved fields before/after settlement; fail CI/replay QA on any violation.
2. **[Target: bounded catch-up]** For every return permit, `returnCredit <= 20%` of `activeSealValueAtIssue`; each sidegrade record requires `>=80%` active Field Seals and a separate active confirmation. Instrument credited value, spend share, permit issuer, and active confirmation ID; property-test boundary values 0 h, 2 h, 12 h, 24 h, negative time, and repeat open.
3. **[Target: 10–20 session tactical parity]** First test the causal return-credit effect with matched 10- and 20-session account fixtures that have identical active-earned state, fixed seeds, locked/equivalent sidegrades, and randomized `returnCredit = 0` versus maximum-eligible treatment; then run representative 10- and 20-session fixtures with appropriate unlocked equal-power sidegrades. In every matched treatment pair, median Stage 1–10 completion time and median boss-clear time must differ by no more than **±15%**, completion and boss-clear rates by no more than **5 percentage points**, normalized damage taken by no more than **10%**, and movement-hazard errors by no more than **10%**. Use a predeclared bootstrap 95% confidence interval for each treatment delta; its entire interval must remain inside the stated bound. Log selected sidegrade, active-vs-return credit, damage taken, and hazard errors. Any bound failure or a treatment-linked delta rejects the credit value, regardless of aggregate 10-vs-20 results.
4. **[Target: transparent certainty]** `100%` of participants in a comprehension check can identify the return cap, the precise reward, and at least one forbidden combat outcome before dismissing the panel; `0%` report a mechanical return probability because none exists. Capture answer accuracy, receipt-view use, and UI-to-saved-receipt equality.
5. **[Target: no appointment pressure]** In a 12–16 person moderated pilot spanning 0 h, 2 h, 12 h, and 24 h resumes, at most `10%` rate “I felt I had to return at a particular time” as 4–5 on a five-point scale, while at least `80%` rate “I understood what I received” as 4–5. Also record notification exposure (`0` by design), late-return loss reports (`0`), and whether a participant can reach Stage 10 without consuming return credit (`100%`).

## Recommended decision

Adopt **one active-issued, one-settlement Archive Return Permit** with a linear 0–12-hour, fixed-point, Archive-restricted credit and a 20% ceiling. It is intentionally a modest catch-up toward an equal-power, active-confirmed sidegrade—not a simulated run, a power grant, or a daily timer. The model lets the Archive acknowledge time away while preserving the campaign’s core proposition: Stage 10 and every tactically consequential achievement are earned by active movement and combat decisions.
