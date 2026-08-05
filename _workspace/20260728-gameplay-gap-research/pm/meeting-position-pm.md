# Meeting Position — PM (Economy / Reward-Band / Retention)

> Owner: reward bands (comeback ≤30%, win-rate delta ≤5%p/tier). Free/paid parity **N/A** (no monetization, pillar). "Session value" & retention forecast use pillar-legal proxies (progress-per-session, voluntary re-entry) — **revenue is N/A**, G5 permanently N/A never PASS.
> Evidence: `current-structure-baseline.md`, `engineering/current-systems-inventory.md` (file:line), `research/comparable-gameplay/report.md` (game names). Read-only; no source touched.

---

## 0. The economy today (code-verified, the thing we are re-banding)

- **Echo Core (EC): budget 40**, active-only — `+1 / distinct captured elite id` (cap 10) `+3 / resolved stage` (cap 30). Sink: Warden 6-stat curve `[2,2,3,3,4,4,5,5,6,6]`=40 + 5-node tree=41. Combined **41 > 40 → forced tradeoff**. `campaign-state.js:55-66`; `rpg-catalog.js:29,46,38-44`.
- **Bound Fragment (BF): budget 10**, active-only — `+1 / resolved stage` (max 10). Sink: equipment tier steps `[1,2,3,4]` (one slot T1→T5 = 10 = whole budget). `campaign-state.js:60-72`; `rpg-catalog.js:185-192`.
- **Full-clear = exactly 40 EC + 10 BF, "deliberately just short of buy-everything"** (`baseline` §경제, inventory:94). This is a **closed finite budget** — clean, and the reason the loop ends at Stage 10.
- **Idle:** `awardedProgress = completedStages × floor(elapsedMs/60_000)`, cap `MAX_ELAPSED = 8h`; `totalProgress` is a **vanity counter, zero sink** (`campaign-state.js:10-12,221-249,248`; inventory:79-82). Encroachment: `wardlinePressure=min(floor(hrs),8) > wardLevel → ENCROACHED, 0 awarded` (`campaign-state.js:217-243`).
- Enemy scale today: `stage.scale 100→240` across 10 stages (~+15%/stage; inventory:26). Max Warden **Lv9/run**. 3 **reward-only companions never reach the player** (`campaign-state.js:291-297`, G4 dead content).

---

## 1. Can a G2 idle-sink + G1 tier-ladder economy hold reward bands? — YES, with a firewall + 3 hard caps

**The runaway if idle FEEDS EC/BF directly (must NOT ship this way):**
At full-clear the idle rate is `10 stages × 480 min = 4,800 units / 8h settle`. Convert even 1 EC per 100 units → **48 EC per single 8h collect > the entire 40-EC campaign budget**. A player who never plays a sortie idles once and buys out the whole Warden build → the defense-survivor core (our load-bearing pillar) is bypassed. Layer the G1 tier ladder on top and it compounds LoM-style: idle→EC→power→clear higher tier→**higher idle rate** (AFK "cleared stage sets the rate")→more EC→… — an **infinite-reinvest spiral** that, without monetization or a content wall to absorb it, trivializes the game in days. LoM/Kingshot survive this only because their sink is bottomless **and** monetized; ours is neither.

**Fix = one firewall + three caps (all sourced):**

1. **FIREWALL (primary rec):** idle NEVER mints EC/BF. Route the already-computed idle accrual (`campaign-state.js:248`) into a **new parallel currency "Undertow Silt (US)"** that funds a *separate* sink (companion leveling, equipment reroll/enchant, formation/trait re-roll) — the **Melvor pattern** (offline output = raw materials the next loop eats, never your achievement-gated currency). EC/BF stay strictly earned by active clears/captures → the campaign power budget is **untouchable by idling**. This also honors our run-scoped↔permanent 2-path pillar.
2. **TIME CAP → raise 8h to 16h (AFK model).** Report caps: **Melvor 24h**, **AFK 16h**, **LoM 8h**. Reject LoM 8h — it exists explicitly to pressure "log in ≥ every 8h to avoid waste" = the mild FOMO our pillar forbids. Reject Melvor 24h — over a tier-scaled rate it makes one daily login a jackpot and kills the return cadence. **16h (AFK)** "gently enforces a once-or-twice-daily login without punishing missed pushes" — accrual STOPS at cap (our `CAPACITY_REACHED` already does this).
3. **DAILY-EFFICIENCY CEILING (AFK "daily efficiency limit so pushing far ahead doesn't runaway").** Clamp idle currency to **≤25% of average active per-hour throughput** (headroom under the 30% comeback ceiling). This severs the compounding: idle rate is clamped to a fraction of active throughput and does NOT scale unbounded with tier.
4. **SINK SCALES AHEAD OF INCOME (Melvor "sinks scale ahead of income at every stage" + Kingshot "always-hungry sink, nothing accrues to a dead-end").** Each tier's sink cost grows faster than the idle income that tier unlocks → idle can never fully fund the next step; active play must cover the gap. This is the structural anti-runaway.

Net: reward bands hold because idle becomes **catch-up, not a path**; EC/BF remain a finite, playtime-earned budget; the tier ladder is fed by active clears with idle only greasing the parallel Silt sink.

---

## 2. G1 tier-ladder payout curve (≤5%p power-delta-per-tier discipline)

Reuse the 10 stages as **Encroachment Tiers 1–9** (matches max Warden Lv9; zero new authoring — gap-analysis "신규 오소링 0"). Soulstone rule: **clear Tier N at its scaling to unlock N+1** ("unlock next Curse Tier only by clearing the prior"); Soulstone "higher curses **multiply currency/reward output**" — so difficulty and farm-rate are linked, the anti-wall governor.

| Lever | Value | Why (band discipline) |
|---|---|---|
| Enemy scale / tier | **+8% HP+dmg** | Tiers stack on an already-maxed build, so steps are gentler than the campaign's ~+15%/stage (`stage.scale 100→240`). +8% keeps first-entry win-rate dip **≤5%p**. |
| Reward multiplier | **m(N) = 1 + 0.10·N** (linear +10% EC/BF payout/tier) | Reward (+10%) slightly outpaces difficulty (+8%) → net progression velocity ~+2%p, so **no wall** (Soulstone's "hard wall at cycle 5-8" is the anti-pattern). Linear, NOT exponential — exponential = LoM/Survivor.io reward-chase treadmill we reject. |
| Trivialize guard | reward reinvest ≤ tier's +8% recovery | Prevents VS/20MTD "solved build trivializes." Matched effort restores the band, never over-shoots. |
| Cadence | **3-day rotating "featured tier"** (Survivor.io Challenge Normal/Hard/Nightmare 3-day reset, "consumes no energy") | De-FOMO'd: rotation only *highlights* a tier with a small bonus; **you never lose access to any tier**, missing a rotation costs 0 permanent (contrast Survivor.io medals→time-limited crates). |

**Band statement (mechanically checkable via G2 archetype-rotation):** at expected-power entry, each tier's +8% scale drops win-rate ≤5 percentage points and is recovered to the **45–55% G2 envelope** after one +10% reward cycle. No tier trivializes (win-rate stays <55%) and none walls (recoverable in ≤1 cycle).

---

## 3. Comeback band — the number

**For any absence of duration T: `idle_progress(T) ≤ 0.30 × active_progress(T)`, and idle saturates at the 16h cap.**

Setting the daily-efficiency rate at **25% of active throughput** (headroom under the 0.30 ceiling) with the 16h cap:
- one full daily collect ≤ `16h × 0.25 = 4.0 active-hours-equivalent` of Silt — a real "payday" but ≈⅓ of a dedicated play-day;
- a 48h absence still pays only the 16h-capped amount → effective ratio shrinks further;
- **active play is always ≥3.3× more efficient per unit wall-clock.** Idle is catch-up, never the main path — the pillar guarantee.
- Keep Encroachment (`pressure>wardLevel → 0`) as the natural over-idle governor, but re-point it at the **Silt** sink so it never zeroes a player's earned EC/BF.

---

## 4. Retention forecast — "why come back tomorrow" without FOMO

Adopt Survivor.io's **bite-size daily cadence** (15-20 min of small chores: Quick-Patrol claim + 3-day Challenge), **discard its coercion** (energy gate, event FOMO, monetization walls). Contrast the predatory anchors we explicitly reject: **Kingshot "second full-time job" + timed alliance FOMO**, **LoM "log in ≥ every 8h to avoid waste" + whale walls** (report complaints: both #1-rated as predatory).

Three non-coercive return-drivers:
1. **Idle payday** (~30s): collect the 16h Silt. Not FOMO — capped, no penalty for one collect/day vs two, missing a day forfeits only overflow past 16h, feeds a non-competitive sink.
2. **Rotating tier target** (~3-5 min): the 3-day featured tier is a fresh goal, like VS's always-visible "next unlock" checklist — a suggestion engine, not claim-or-lose. Single-player = zero competitor = zero fall-behind pressure (the Kingshot poison).
3. **Next authored unlock**: Silt/tier sinks light up the 3 dead reward-companions (`:291-297`), M4 cards, evolution → a directed "next thing" that pulls return with no timer (VS/Soulstone intrinsic model).

**"Session value" proxies (revenue N/A):** median session **3-5 min**, **≥1 meaningful power gain/session**, and **voluntary re-entry ≥14 per 10 participants** — the exact G7 band (currently **0/14**, digest §G7). Forecast: a ≤5-min daily loop with one clear reason to return and no reason you *must* → sustainable single-player retention that does not decay into obligation.

---

## VOTE — **Stage 1 concept shift** (gated behind G6-perf + G2-balance repair)

The idle-sink + tier-ladder + 3rd-currency reward system is a **new progression axis** (finite 40EC/10BF budget → bounded reinvest-loop with a scaling tier ladder). Number-retuning the current finite economy **cannot** produce a reinvest loop or a tier that does not exist — the change is structural, i.e. concept-level, not a Stage 2 retune. **But** you cannot bolt an endless tier ladder onto a build that already FAILs the frame budget (G6: 33-50ms mobile) and the win-envelope (G2), so this concept shift is **sequenced after** the G6/G2 fixes.

**Smallest high-leverage step (economy domain):** Wire the already-computed idle `totalProgress` (`campaign-state.js:248`) into **one** new currency **Undertow Silt** that funds **only companion leveling** — activating the 3 dead reward-companions (`campaign-state.js:291-297`, G4) — under the **16h cap + 25% comeback rate + sink-scales-ahead** discipline. One currency, one sink, reuses existing idle math and already-authored-but-dead content. **Zero new content.** Proves the reinvest loop + comeback band in isolation before the tier ladder ships.

**Proof-number (single, mechanically checkable):** in one G2 archetype-rotation soak with the idle sink live — **measured `idle:active progress ratio ≤ 0.30` AND `legal-combo EV ≤ 1.30`** (the R3 1.3× cross-category ceiling; currently **1.70 FAIL**). Ratio proves idle is catch-up-not-path and the firewall holds (idle buys 0 EC/BF power); EV proves the new sink did not inflate the multiplicative power chain past the band. Both green = the economy holds its reward bands.
