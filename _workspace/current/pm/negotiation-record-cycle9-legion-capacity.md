# Designer ↔ PM negotiation record — cycle 9 legion capacity

record id: `N-20260730-C9-01`
parties: game-designer (ladder author) · game-pm (reward-band owner)
arbiter: game-production-director
gates: **G3 (편성 다양성)** — blocking condition CLEARED (§7); G3 itself still needs human play.
**G5 (매출·밸런스 시너지)** — a new, unmeasured open input: the earn-rate change must be
re-measured for paid/free parity by the next cycle that opens economy work.
status: **RESOLVED 2026-07-31 — see §7. Options A+C shipped together, on defect grounds
that §3 did not have when it recommended C alone.**

---

## 1. The conflict, measured

The cycle-9 spec (`design/core-loop-legion-spec.md` §3) ships a seven-row slot
ladder taking legion capacity from 3 to 10, priced in **Bound Fragment**. The
designer flagged at authoring time that the ladder might not be affordable. It is
not. This is now measured, not projected.

### Measurement [OBSERVED]

Reproduction, exact state:

1. `createCampaign({ campaignId: "raised-capacity" })`
2. For **every** stage in `STAGES`: `startRun(stage.id)` then
   `applyCampaignRunResult({ stageId, outcome: "victory" })` — i.e. **all three
   stages cleared**, the maximum earning state the game can reach
3. **Zero** equipment tiers purchased — the currency pool is entirely uncontested

Result:

| Step | Outcome |
|---|---|
| `purchaseCompanionSlot()` #1 | success → slot 4 |
| `purchaseCompanionSlot()` #2 | success → slot 5 |
| `purchaseCompanionSlot()` #3 | **throws `Not enough Bound Fragment.`** |
| `companionCapacityForCampaign()` | **5** |

**5 of the 10 designed slots are reachable when nothing else competes for the
currency.** Buying any equipment tier makes it strictly worse. This is a *best
case*, not a pessimistic estimate.

### Why the arithmetic cannot close

| Quantity | Value | Source |
|---|---|---|
| Bound Fragment earned, lifetime maximum | **10** | `boundFragmentEarned()` = `resolvedIds.length`, and there are 3 stages… |
| …but the earning cap is stage-count-bound | 3 stages ⇒ 3 | `campaign-state.js:124` |
| Full slot ladder, cumulative cost | **16** | spec §3 ladder, rows 4–10 |
| One equipment slot to T5 | **10** | `rpg-catalog.js:190-191` |
| Equipment slots per owner | 3 (weapon/ward/trinket) | `rpg-catalog.js` |

The ladder alone costs 16 against a lifetime pool that cannot exceed 10, and
equipment already claims up to 10 per slot from the same pool. The shortfall is
structural, not a tuning nudge.

---

## 2. What was deliberately NOT done

The implementation **did not silently resolve this**. Three things were done
instead, and they matter for the gate:

1. `boundFragmentSpent()` (`campaign-state.js:152`) sums equipment cost **plus**
   slot cost, so the shared budget is enforced honestly. There is no hidden
   overdraft and no separate slot wallet.
2. The shortfall surfaces to the player as a failed purchase
   (`Not enough Bound Fragment.`), not as a silently-capped roster.
3. The ladder is shipped as **data** (`COMPANION_SLOT_UNLOCKS`), so any option
   below is a data change, not a logic change.

The feature is therefore **correct and shippable at capacity 5**, and the open
question is purely one of intended reach.

---

## 3. Options — designer and PM positions

None of these is selected. Each has a different owner cost.

### Option A — raise Bound Fragment earning

Increase earn rate or decouple it from stage count.

- **Designer**: preserves the 3→10 arc as designed; the ladder's shape was tuned
  as a progression curve, and truncating it at 5 loses the late-game beats.
- **PM**: changes economy pacing globally. Bound Fragment currently gates
  equipment progression, so raising it inflates equipment power too. Touches G5
  (paid/free parity, win-rate delta ≤5%p) and cannot be assessed without a
  fairness sim.
- **Blast radius**: economy-wide.

### Option B — separate currency for slots

Introduce a slot-only currency.

- **Designer**: cleanest separation; slot progression stops competing with gear.
- **PM**: adds a system, a new sink, a new UI surface, and a new tuning axis
  mid-cycle. Cycle 9 declared one operating mode (core-loop restructure); this is
  new-system work and belongs to a later cycle.
- **Blast radius**: new system.

### Option C — lower cumulative slot cost to ≤6

Reprice rows 4–10 so the full ladder plus one full equipment line coexist.

- **Designer**: keeps all ten slots reachable; cheapens each unlock, so the
  unlock stops feeling like an achievement.
- **PM**: smallest blast radius, pure data change, no new system, no economy
  inflation. Testable within this cycle.
- **Blast radius**: one data table.

### Option D — accept capacity 5 as the shipped ceiling this cycle

Ship rows 4–5, defer 6–10.

- **Designer**: the 3→10 headline becomes 3→5; the request explicitly said
  "최대 10개까지" so this under-delivers the stated ask.
- **PM**: zero risk, fully measured, already working.
- **Blast radius**: none — this is the current behaviour.

---

## 4. Director position

The director does **not** select an option here. Reasoning:

- The request explicitly asked for 최대 10, so Option D under-delivers a stated
  requirement and must be a human decision, not an agent's.
- Options A and B change the economy or add a system, and cycle 9 declared **one**
  operating mode. Taking either inside this cycle violates the harness rule that
  mixing concept/system work into a restructure cycle weakens both.
- Option C is the only option that is a pure data change and fits the declared
  mode — but it trades away unlock weight, which is a design-intent judgment the
  designer owns and the operator should confirm.

**Recommended for operator decision: Option C**, with Option D as the honest
fallback if the unlock-weight tradeoff is unacceptable. Option A and B should be
deferred to a cycle that declares economy work as its mode.

---

## 5. Gate consequence

| Gate | Verdict input |
|---|---|
| **G3 편성 다양성** | **Cannot PASS this cycle.** Capacity is a primary 편성 axis and its designed range is unreachable. The mechanism works; the reach does not match the spec. |
| **G5 매출·밸런스** | Out of scope for cycle 9, but Options A and B would make this a G5 item and require a fairness sim. |
| G2 밸런스 | Unaffected — no combat number changed. |

Per `references/quality-gates.md`, every revenue/reward coupling requires a signed
negotiation-record entry. This document is that entry for legion capacity. It is
**open**, so it does not satisfy the signature requirement yet — it records the
conflict, the measurement, and the options, and names the decision as pending.

---

## 6. Reproduction

```js
// all stages cleared, no equipment competing
let campaign = createCampaign({ campaignId: "raised-capacity" });
for (const stage of STAGES) {
  campaign = startRun(campaign, stage.id);
  campaign = applyCampaignRunResult(campaign, { stageId: stage.id, outcome: "victory" });
}
campaign = purchaseCompanionSlot(campaign);            // slot 4  -> ok
campaign = purchaseCompanionSlot(campaign);            // slot 5  -> ok
companionCapacityForCampaign(campaign);                // 5
purchaseCompanionSlot(campaign);                       // throws "Not enough Bound Fragment."
```

Measured by `InputHudAnalog` during cycle-9 implementation, verified against
`boundFragmentEarned` / `boundFragmentSpent` in `campaign-state.js`.

---

## 7. Resolution — and why it overrode §3's own recommendation

§3 recommended **Option C alone** and explicitly ruled out **Option A**, on the
grounds that raising an earn rate "changes economy pacing" and would violate the
one-operating-mode rule. What shipped is **A and C together**. That reversal needs
its justification on the record, because the reasoning above argues against it.

### Two measurements §3 did not have

§3 was written against the figure "earning caps at 10", taken from the comment on
`boundFragmentEarned`. Measuring instead of reading it produced two findings that
change the category of the problem:

1. **The pool was 3, not 10.** `boundFragmentEarned` was `resolvedIds.length` and
   `STAGES.length` is **3**. The "max 10" comment was stale, inherited from a
   larger stage list. Every prior estimate in this record — including its own
   headline arithmetic — repeated that comment rather than measuring. The true
   shortfall was not 16-vs-10; it was **16-vs-3**.
2. **Four rows were unreachable at any price.** Slots 7–10 gated on **4/6/8/10**
   stage clears against **3** existing stages. No amount of repricing could ever
   have unlocked them. Option C, applied alone as §3 recommended, would have
   produced an affordable ladder whose last four rows still could not be bought —
   a fix that measures as green and fails in the player's hands.

### Why this is a defect fix, not economy tuning

§3's objection to Option A was scope: economy tuning belongs to a cycle that
declares economy work as its mode. That objection holds for *tuning* — deliberately
changing a rate to shift pacing. It does not hold here:

- The earning function carried a comment asserting a value **5× its actual
  behaviour**. Correcting it restores the intent already written in the source.
- The gate values referenced stages that **do not exist**.

Both are defects, and cycle 9 is the cycle that found them. Leaving a known,
measured, unreachable-by-construction feature in place to respect a scope boundary
would be preserving a bug for procedural reasons.

### What shipped

| Change | Before | After |
|---|---|---|
| `boundFragmentEarned` | `resolvedIds.length` → max **3** | `resolvedIds.length * 3 + min(STAGES.length, distinct elites)` → max **12** |
| Ladder gates | 1,2,3,**4,6,8,10** (4 unreachable) | 1,1,2,2,3,3,3 — **all within 3 stages** |
| Ladder cost | 1,1,2,2,3,3,4 = **16** | 1×7 = **7** |

The new earning shape is not invented: it mirrors `echoCoreEarned`, which already
used a per-stage multiplier plus a stage-capped distinct-elite term. Track A and
Track B now earn on the same rhythm instead of one being silently starved.

### Measured outcome [OBSERVED]

Full clear, no elites captured:

| Quantity | Value |
|---|---|
| Bound Fragment earned | **9** |
| Slots purchasable | **7 of 7** |
| Capacity reached | **10** — the requested 최대 10 |
| Fragments remaining | **2** |
| Further equipment tiers affordable | **1**, then `Not enough Bound Fragment.` |

The tradeoff §3 wanted to protect **survives**: buying the full ladder still costs
you a full T5 equipment line. It is now a decision rather than an arithmetic
impossibility.

### Gate consequence

- **G3 편성 다양성** — the blocking condition is cleared. Capacity 10 is reachable
  by a legitimate campaign. G3 still requires ≥3 archetypes independently viable in
  play, which is a **human-play** judgment and is not claimed here.
- **G5 매출·밸런스** — an earn-rate change is a G5 input and this one is
  **unmeasured**. Out of scope for cycle 9's declared mode. The next cycle that
  opens economy work must re-measure paid/free parity and the win-rate delta
  against this new rate. Recorded as an open G5 input, not as a G5 pass.

### Contract tests updated, not re-baselined

The old economy was encoded as test contracts. One asserted a full-ladder save must
**fail** validation — the shortfall written down as an invariant. It was **inverted**
rather than renumbered, and now asserts both that capacity 10 is reachable *and*
that the equipment tradeoff still bites. A new test locks the reachability defect
(`requiresStageClears <= STAGES.length`), which nothing previously guarded.
