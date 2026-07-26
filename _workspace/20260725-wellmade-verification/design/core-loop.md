# Core Loop — G7 measurement (run-id `20260725-wellmade-verification`)

Owner: DesignG7G8 (game-designer). **Measurement only** — no balance, system, or asset
change was made this cycle. Prior cycle's model lives at
`_workspace/20260723-solo-warden-rpg-concept/design/core-loop.md`; this document does not
edit it, it measures the shipped build against it.

Method: `scripts/measure-g7-core-loop.mjs` (new this session, measurement-only) imports
`defense-run-simulation.js` unmodified and instruments **real** `createDefenseRun` /
`advanceDefenseRun` runs tick-by-tick, deduplicating events by `eventSequence`.
Evidence: `design/evidence/g7-core-loop-instrumented.json` (108 runs).

Reproduce:
```
node scripts/measure-g7-core-loop.mjs \
  --output _workspace/20260725-wellmade-verification/design/evidence/g7-core-loop-instrumented.json
```

Matrix: 3 stages (`cinder-span`, `echo-throne`, `howling-sprawl`) × 3 seeds (901/902/903)
× 3 input policies (`minimal` / `engaged` / `bot`) × 4 input cadences (60/10/4/2 Hz) =
108 runs. Loadout `["ember-cohort","rift-lens","veil-vanguard"]`, no warden progress
(fresh campaign state).

---

## 0. The input-cadence confound, and why the sweep exists {#g7-method}

The first instrumented pass re-decided movement every tick and produced 28 s VICTORY
runs. Slowing re-decision to 2 Hz produced 162 s DEFEAT runs. Both are properties of the
*harness*, not the game, so a single hand-picked cadence would have reported a number I
chose rather than a number the build has. Cadence was therefore swept.

| re-decide cadence | victory rate (27 runs each) | median run |
|---|---|---|
| 60 Hz (1 tick) | **1.000** | 38.9 s |
| 10 Hz (6 ticks) | **1.000** | 38.9 s |
| 4 Hz (15 ticks) | **1.000** | 39.3 s |
| 2 Hz (30 ticks) | 0.111 – 0.556 | 79.2 s |

Run length is **flat from 60 Hz down to 4 Hz** and only collapses at 2 Hz. The plateau is
the real signal: 4 Hz is the viability floor, and everything above it measures the game.
**All numbers below pool the three viable cadences (81 runs, victory rate 1.000)** unless
stated. The 2 Hz cohort is excluded from loop statistics and reported only as the floor.

That the floor exists at all is worth recording: a player who re-aims twice a second
loses 44–89% of the time while one who re-aims four times a second never loses. That is a
steep skill cliff located in movement cadence alone, on stages 1/3/5 with no boss-tier
threat, and it was not a designed target.

## 1. Four candidate loop boundaries, all measured on the same runs {#g7-candidates}

"Core loop" is only meaningful once the repeating unit is named. Four candidates were
instrumented simultaneously rather than assuming the modelled one.

| id | boundary definition | n windows | period median | actions/loop median | reward events/loop median |
|---|---|---|---|---|---|
| **L1** growth-offer circuit (*the modelled `vanguard-circuit`*) | `GROWTH_OFFER` → `GROWTH_OFFER` | 126 | **0.02 s** | **0** | 2 |
| **L2** wave circuit | `WAVE_VARIANT_STARTED` → next | 162 | 3.52 s | 5 | 0 |
| **L3** objective-phase beat | `OBJECTIVE_PHASE_CHANGED` → next | 324 | 2.50 s | 4 | 3 |
| **L4** stage sortie | run start → terminal | 81 | **38.90 s** | **72** | **13** |

G7 threshold is period 30–180 s, ≥3 actions/loop, ≥1 reward event/loop.
**L1, L2, L3 all fail the period band. L4 is the only candidate inside it.**

## 2. Model vs actual — the deliverable delta {#g7-delta}

Prior model (`20260723-solo-warden-rpg-concept/design/core-loop.md`, `vanguard-circuit`,
label `TARGET`) against the shipped build:

| metric | modelled `vanguard-circuit` | **measured L1** (same boundary as modelled) | delta | measured L4 (stage sortie) |
|---|---|---|---|---|
| period | 60 s (band 45–90) | **0.02 s** (min 0.02, max 0.02, n=126) | **−59.98 s / −99.97%** | 38.90 s (26.48–59.30, n=81) |
| actions / loop | 4 | **0** (n=126, max 0) | **−4** | 72 (25–711); 7 excluding MOVE |
| reward events / loop | 2 | 2 (1–2) | **0** | 13 (12–14) |
| repeat-rate proxy | 0.70 target | **PENDING** (§4) | — | PENDING (§4) |

Nested `formation-assault` model (period 100 s, band 70–160, 4 actions/loop):

| metric | modelled | measured (elite→boss encounter gap) | delta |
|---|---|---|---|
| period | 100 s (70–160) | **7.32 s** (5.63–8.58, n=81) | **−92.68 s / −92.7%** |
| frequency per stage | "elite 1–2 + boss 1" | exactly 1 elite + 1 boss, every run (81/81) | in-spec on count |

### Why L1 collapses to one tick — structural, not stochastic

`L1 period = 0.02 s` is one tick, with **zero variance across all 126 windows, all three
policies, and all three cadences**. That rules out a harness artifact. The cause is in
the shipped code:

- `defense-run-simulation.js:1679-1684` — `makeOffer` requires
  `objectives.gateDefense.completed && objectives.echoRecovery.completed`. Level-ups are
  **gated behind two objective completions**.
- `defense-run-simulation.js:963-964` — `echoRecovery.completed` is set the instant the
  stage elite dies.
- `defense-run-simulation.js:1456` — `tick()` returns early while `run.growthOffer` is
  open: the sim **freezes** until the player answers.

So XP banks silently through the whole gate-defense phase while offers are suppressed,
then the elite dies and the dam bursts: every banked level cashes out in consecutive
ticks. Measured 2–3 growth offers per run (median 3), all inside a ~2-tick window.

**The modelled 60 s level-up circuit does not exist in the shipped build.** It is not
slow, or mistuned — it is not a cycle. It is a single one-shot cash-out event. An
"actions/loop = 0" reading is the honest consequence: no player action fits between two
offers one tick apart.

### Reward cadence is bimodal, not rhythmic

Across 1,008 measured inter-reward gaps: median **0.02 s**, mean **1.91 s**, max
**16.13 s**, and **67.8% of all gaps are under 0.1 s**. Rewards arrive in simultaneous
clusters separated by dead air, not on a beat. Aggregate rate is 21.4 macro rewards/min,
which looks healthy and is misleading — the distribution, not the rate, is what a player
feels.

Representative timeline (`engaged`, `cinder-span`, seed 901):
```
12.00s  OBJECTIVE_COMPLETED
16.50s  ELITE_CANDIDATE_AVAILABLE + OBJECTIVE_COMPLETED + ITEM_COLLECTED
16.52s  GROWTH_OFFER
16.53s  OBJECTIVE_COMPLETED + GROWTH_OFFER
```
Seven of the run's macro rewards land inside 30 ms.

## 3. What the loop actually is {#g7-actual}

The shipped structure is **not** a repeating intra-stage circuit. `updateObjectivePhase`
(`defense-run-simulation.js:1241-1249`) advances a **linear, non-repeating** chain:

```
gate-defense → echo-recovery → growth → occupation → extraction → boss-kill → complete
```

Each phase completes once. Nothing returns to a prior phase. The only genuinely repeating
unit is the sortie itself: **stage → resolve → invest → next stage**.

```yaml
core_loop_measured:
  - id: gate-sortie
    role: primary
    boundary: run start -> terminal
    label: MEASURED            # not TARGET — 81 instrumented runs
    period_s: 38.90            # median; min 26.48, max 59.30
    period_band_observed: [26.48, 59.30]
    actions_per_loop: 72       # median total; 7 excluding MOVE re-aims
    distinct_action_types_per_loop: 2   # median; max 3 (MOVE, STANCE_CYCLE, SKILL_CAST)
    reward_events_per_loop: 13 # median macro; min 12, max 14
    repeat_rate_proxy: PENDING # see §4
    threshold_check:
      period_30_180s: PASS
      actions_ge_3: PASS
      rewards_ge_1: PASS
      repeat_rate_ge_070: PENDING
  - id: vanguard-circuit
    role: modelled-primary
    label: NOT_PRESENT
    note: >
      Modelled at 60 s. Measured at 0.02 s with zero variance across 126 windows.
      Structurally impossible as a cycle — makeOffer is gated behind two one-shot
      objective completions (sim:1679-1684) and the sim freezes while an offer is open
      (sim:1456). Not a mistuned loop; not a loop.
  - id: formation-assault
    role: modelled-nested
    label: PRESENT_BUT_COMPRESSED
    modelled_period_s: 100
    measured_period_s: 7.32    # elite -> boss, median; 5.63-8.58
    note: occurs exactly once per stage as modelled; duration is 7.3% of model
```

### Action mix is thinner than the model claims

The model lists 4 actions: move / stance switch / auto-combat consumption / reward check.
Measured accepted action types per sortie: median **2**, max **3**
(`MOVE`, `STANCE_CYCLE`, `SKILL_CAST`). Pooled over 9 reference runs: 408 MOVE, 41
SKILL_CAST, 36 STANCE_CYCLE. Excluding MOVE re-aims, **median 7 discrete decisions per
38.9 s sortie** — roughly one every 5.6 s.

### `EXTRACT_ELITE` is unreachable — the capture is not a player action {#g7-extract}

`EXTRACT_ELITE` was accepted **0 times in all 108 runs**, while `extracted: true` and an
`ELITE_EXTRACTED` event fired in **81/81** viable runs. That is not a harness quirk;
it was isolated with two standalone probes.

Probe A (`/tmp/probe-extract.mjs`) — drive a run issuing **only** `MOVE` and
`SKILL_SELECTED`, never `EXTRACT_ELITE`:
```
stage echo-throne seed 901 · inputs: { MOVE: 39, SKILL_SELECTED: 2 }
EXTRACT_ELITE ever issued? -> false
terminal: VICTORY | run.extracted: true | progress.extracted: 1
companions: companion-1, companion-2, companion-3, companion-147  (count=4)
```
A 4th companion joined the roster with the capture input never pressed.

**A false negative I produced first, and how it was caught.** Probe A was originally run
on `cinder-span`, which returned `companions: count=3` — no 4th companion — and briefly
looked like evidence that the capture had *not* happened without input. It had. The
stage's `eliteCompanion` for `cinder-span` is `ember-cohort`
(`defense-catalog.js:452`), which was already in my probe's loadout, so `addCompanion`'s
dedup guard (`defense-run-simulation.js:240`,
`run.companions.some((entry) => entry.companionId === companionId)`) silently discarded
it. The roster stayed at 3 for a reason that had nothing to do with the mechanic.
Re-running on `echo-throne` (elite companion `throne-echo`, not in the loadout) isolated
the effect and produced the 4th companion above. The masking was my harness's, not the
game's; recorded because the finding had to survive it.

Probe B (`/tmp/probe-extract2.mjs`) — issue `EXTRACT_ELITE` every tick a candidate exists:
```
EXTRACT_ELITE issued: 1033
EXTRACT_ELITE ACCEPTED: 0
rejections: { EXTRACTION_HOLD_INCOMPLETE: 465, INPUT_TYPE_UNSUPPORTED: 568 }
ticks where (extractionProgress.completed && !run.extracted): 0
```

**Root cause, in the shipped code.** There are two write paths for the capture:
- `defense-run-simulation.js:1397-1431` (`processTerrainEffects`) — holding the extraction
  zone uncontested to `maxHoldTicks` sets `extractionProgress.completed = true` **and**
  `run.extracted = true` **and** calls `addCompanion(...)`, in one block.
- `defense-run-simulation.js:894-910` (`processInput`) — the player press, guarded by
  `EXTRACT_ELITE && !run.extracted` and requiring `run.extractionProgress.completed`.

The input path needs the state `extractionProgress.completed === true && run.extracted
=== false`. The auto path sets both flags in the same block, so that state **never
exists** — measured at 0 ticks out of a full run. Before the hold finishes the press is
rejected `EXTRACTION_HOLD_INCOMPLETE`; after it, `!run.extracted` is false, the branch is
skipped entirely and the input falls to the terminal `else` as
`INPUT_TYPE_UNSUPPORTED`. **Line 894-910 is dead code.**

**Independently confirmed by static analysis** (director, separate method): across the
whole file, `extractionProgress.completed = true` has **exactly one writer** —
`:1411` — and that same block sets `run.extracted = true` at `:1413` and calls
`addCompanion` at `:1416`. The state the input guard requires therefore has **no
producer at all**. Runtime (1,033 issued / 0 accepted, 0 qualifying ticks) and static
(single writer, co-assigned flags) agree: unreachable **by construction**, not merely
unobserved in the runs sampled. Logged as proven rather than suspected.

Why it matters beyond G7: elite-capture is the recommended **G8** novelty element
(`design/novelty-scorecard.md#g8-recommend`). Its frequency result (0 of 11 comparable
titles) is unaffected — the mechanic exists and the companion really does join the
permanent roster. But the *agency model* the design documents describe (player spots the
elite, presses capture) is not what ships: the capture is an automatic consequence of
standing in a zone. That is a materially different player experience from the one being
scored, and it is recorded in the scorecard rather than left to the reader.

## 4. Repeat-rate proxy — PENDING, with the reason {#g7-repeat}

**Threshold**: playtest repeat-rate ≥70% (testers voluntarily re-enter the loop).
**Status**: **PENDING — not measurable this cycle.** Not fabricated, not estimated.

Why no defensible scripted proxy exists:

1. **The construct requires a human.** "Voluntarily re-enter" is a measurement of desire.
   A simulated agent re-enters because its loop says to. Any number produced from the sim
   would measure the harness's `for` loop.
2. **The affordance for *voluntary* re-entry is structurally weak.** `campaign-state.js:189`
   / `:197` reject any `stageIndex > unlockedStageIndex`, and `:207` advances
   `unlockedStageIndex` on victory. Cleared stages remain selectable, so replay is
   *possible* — but the campaign's forward pressure is toward the next stage, and
   `attemptsByStage` (`:191`) counts attempts without distinguishing a forced retry after
   defeat from a voluntary replay after victory. **The one telemetry field that touches
   re-entry cannot separate the two cases**, so even a live build would not currently
   answer G7's question.
3. **No session telemetry exists** to source a real rate from.

What *can* be stated, measured this cycle:
- The loop reaches a clean terminal state 81/81 times at ≥4 Hz — re-entry is never
  blocked by a broken end state.
- Sortie length 26.5–59.3 s sits inside the 30–180 s band, i.e. the loop is short enough
  that repeat play is not gated on a time commitment.

Neither is a repeat-rate. Reported as preconditions, not as the metric.

**To close this**: (a) instrument `attemptsByStage` to distinguish post-victory replay
from post-defeat retry, and (b) run a structured session with ≥5 human testers recording
voluntary re-entry. Until both, G7's fourth threshold has no measured value.

## 5. G7 verdict input {#g7-verdict}

**Recommended verdict: FIX.**

| threshold | required | measured | result |
|---|---|---|---|
| ≥1 loop with numeric model | 1 | 1 (`gate-sortie`, L4) | PASS |
| period 30–180 s | in band | 38.90 s median (26.48–59.30) | PASS |
| ≥3 actions/loop | ≥3 | 72 median (7 excl. MOVE) | PASS |
| ≥1 reward event/loop | ≥1 | 13 median | PASS |
| repeat-rate proxy ≥70% | ≥0.70 | **no value** | **PENDING** |

Not PASS: G7 requires four thresholds and the fourth has no measured value. Per
`quality-gates.md`, "missing evidence path = FAIL regardless of claimed value" — the
honest reading is that the gate is not met, and FIX (rather than REDO) is right because
the three measurable thresholds all pass on a real loop that genuinely exists.

Two findings the director should weigh, both structural rather than tuning:

1. **The documented primary loop is absent from the build.** `vanguard-circuit` is
   modelled at 60 s and measures 0.02 s with zero variance. The gate passes only on
   `gate-sortie`, a loop the design documents never named. Design intent and shipped
   structure are describing different games.
2. **Rewards cluster instead of pacing.** 67.8% of inter-reward gaps are under 0.1 s;
   the longest is 16.1 s. The per-minute rate is fine and the felt rhythm is not.

## 6. Ranked improvements {#g7-improve}

1. **Ungate `makeOffer` from `echoRecovery.completed`** (`sim:1681`). One condition
   removal converts the level-up cash-out into a real repeating circuit and is the
   single change that would make the *documented* loop exist. Expected: L1 period moves
   from 0.02 s to a real interval; reward clustering drops materially because growth
   offers stop stacking on the elite-death instant. Highest value per unit of work.
2. **Spread the elite-death reward cluster.** Seven macro rewards inside 30 ms is the
   worst-paced moment in the run. Sequencing them over ~2 s costs no balance change.
3. **Investigate the 2 Hz cliff.** 100% → 11% win rate between 4 Hz and 2 Hz input
   cadence on early stages is a steep, undesigned difficulty wall in movement cadence.
   Measured, not diagnosed — hand to the balance lane.
