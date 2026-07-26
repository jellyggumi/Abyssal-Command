# Stage-Gate Review — G1–G8 verdicts

run-id `20260725-wellmade-verification` · director · 2026-07-25
Verdicts: PASS / FIX (≤2 revision loops) / REDO. An open S1 or missing evidence
blocks any PASS (`references/quality-gates.md:32-34`).

## Verdict table

| gate | verdict | headline measurement | evidence |
|---|---|---|---|
| **G1** narrative consistency | **FIX** | 1 S1 + 3 S3 violations; 111/119 proper nouns trace (93.3%) | `qa/narrative-audit.md#g1` |
| **G2** rules & balance | **FIX** | **0 defeats in 700 stage clears** — no reachable failure state; turtle TTK ceiling violated 6/10 stages; R1 warden-share 127/350 points (36.3%) over the 20% ceiling | `qa/gate-measurements.md#g2` |
| **G3** player-type diversity | **FIX** | 7/7 archetypes viable, but **vacuously** — an RPG-disabled build is equally viable; 3-stance system structurally real, behaviourally decorative | `qa/gate-measurements.md#g3` |
| **G4** effects & animation immersion | **FIX** | 4 bosses' idle has **0 moving bones** (literal frozen statue); all 24 characters share one identical procedural clip library; 23/24 off-canon flat mauve, 0 textures project-wide | `qa/evidence/data/*.json`, `qa/evidence/screens/`, `engineering/rig-pipeline-root-cause.md` |
| **G5** revenue–balance synergy | **N/A** | no monetization exists (explicit no-commerce project boundary) | `UNIFIED-GDD.md §0/§7` |
| **G6** game-ops plan | **FIX** | desktop/shipped-mobile PASS (p95 3.2ms, 0 long frames); **low-tier mobile FAILS** (p95 24.2ms, 8.30% long frames); **GPU texture leak confirmed** — 1 leaked texture per actor spawn, linear, unbounded | `engineering/evidence/g6-*.json` |
| **G7** core loop | **FIX** | the modelled 60s `vanguard-circuit` **does not exist** — measured period 0.02s; only the stage-sortie loop (L4) falls inside the 30–180s band; `EXTRACT_ELITE` unreachable | `design/core-loop.md#g7-delta` |
| **G8** novelty | **FREQUENCY PASS / IMPRESSION BLOCKED** | N2 elite-capture: 0 of 11 comparable titles — cleanest frequency result in the survey. But the mechanic **is not a player action in the shipped build**, so no impression score can be honestly gathered | `design/novelty-scorecard.md#g8-frequency` |

**No gate reaches PASS.** G8 clears its frequency half and is blocked on its
impression half by a code defect, not by a design shortfall.

## The three findings that decide the "well made" question

### 1. The campaign cannot be lost — G2

7 archetypes × 5 seeds × 10 stages, run twice (RPG layer active and inactive):
**70 campaigns, 700 stage clears, 0 defeats.** Delta between arms: **0.0%p**.

The RPG layer is exonerated and is not weak — it delivers a real **1.309×**
boss-TTK speedup (899 → 687 ticks, n=350/arm). The difficulty ceiling simply
sits below even the RPG-inactive floor, so a large genuine power swing produces
zero outcome change. Clear-rate has no resolution left as a metric.

Backlog owner is base stage difficulty (`defense-catalog.js` stage budgets), not
`rpg-catalog.js`. A game that cannot be lost is not "well balanced" — it is
unmeasured.

### 2. Every character plays the same 11 animations, and 4 bosses do not move at all — G4

Measured from the loaded clips in a real browser, not from file inspection:

- All 24 characters carry an **identical procedural clip library** — same 11
  clips, same 24 Hz sample rate, same 8 varying bones in idle, same
  `maxValueSpread` of 0.0035. A wolf-beast and a robed sorcerer play the same
  walk cycle.
- `gate-sovereign`, `lantern-tyrant`, `tide-warden`, `veiled-concordat`: idle has
  **0 varying bones, 0 varying tracks, maxValueSpread 1.28e-17**. Not stuttery —
  frozen. These are 4 of the 10 stage bosses.
- Idle on the other 20 moves 8 of 24 bones with a value spread of 0.0035, which
  is close to imperceptible.

**Correction to my own earlier finding:** I reported a "3.1× sparser sample
rate" on those 4 bosses. That was wrong in mechanism. `VisualG4` proved sample
rate is identical (24 Hz) on both cohorts; the difference is how many bones
carry motion, and aggregate keyframe counts fall because constant tracks
compress to one key. The corrected finding is worse than mine, not milder.

### 3. The 3D scene has no colour identity, while the UI does — G4

`textures: 0` on **all 51 GLB**. 23 of 24 characters carry exactly one flat
material. Against the documented 5-token canon palette (`styles.css:381-388`),
redmean-weighted RGB distance across the 23 non-commander materials is
**min 44.4 / median 93.3 / max 201.7**; only `dusk-warden` conforms, at distance
**0.0** on all four of its materials.

The screenshots make the consequence plain: `screens/11-lineup-bosses-1.png` and
`13-lineup-mixed-classes.png` show characters, terrain and background collapsing
into one pink/rust hue family. `screens/01-lobby.png` shows the lobby using the
canon palette with strong contrast and clean hierarchy. **The UI is well made and
the 3D scene is not**, and they are the same product.

## Supporting verdicts

### G6 — performance is fine until the device is slow

| tier | frameWork p95 | p99 | long-frame % | input p95 |
|---|---|---|---|---|
| desktop M2 Pro | 2.9 ms | 3.9 ms | 0.000% | 0.4 ms |
| shipped mobile (dpr 2) | 3.2 ms | 4.9 ms | 0.000% | 0.4 ms |
| mid-tier mobile (4× CPU) | 15.0 ms | 20.6 ms | 0.736% | 2.8 ms |
| **low-tier mobile (6× CPU)** | **24.2 ms** | **33.7 ms** | **8.302%** | 5.6 ms |

Budget is p95 ≤16.7 ms and long-frame <0.5%. Mid-tier is marginal, low-tier
fails outright. Input latency passes everywhere by two orders of magnitude
(budget 100 ms, worst measured 5.6 ms).

30-minute soak: 105,593 frames, long-frame ratio **0.056%** — PASS.

**GPU texture leak, confirmed:** across 40 spawn/despawn generations the live
scene graph stays flat at 11 actors while renderer-held textures grow
**52 → 297, dead-linear at exactly 1 leaked texture per actor spawn**.
`disposeObject3D` never calls `Skeleton.dispose()`, so bone textures are never
freed. At the measured churn of 18.8 spawns/min this orphans ~1.24 MiB of GPU
memory per 30-minute session — bounded rate, unbounded total.

### G7 — the documented core loop is not the shipped core loop

Four candidate loop boundaries were instrumented simultaneously rather than
assuming the modelled one. The modelled `vanguard-circuit` (60 s period,
3 actions, 1 reward) measures at **0.02 s period with 0 actions** — `GROWTH_OFFER`
events fire one tick apart in bursts. **67.8% of all reward gaps are under
0.1 s.** Rewards arrive in simultaneous clumps, not in rhythm.

Only L4, the whole-stage sortie, falls inside the 30–180 s band. The game has a
real loop; it is one stage long, not the intra-stage circuit the design
documents describe.

### G8 — the novelty element is real and unreachable

`N2` elite-capture → permanent roster companion scores **0 of 11** comparable
titles surveyed (YAZS has in-run recruitment, not elite-sourced permanent
capture). That is the cleanest frequency result in the survey and it passes.

But `EXTRACT_ELITE` is **unreachable dead code**, verified two independent ways:
- Runtime: 1,033 inputs issued across a full run, **0 accepted** (465
  `EXTRACTION_HOLD_INCOMPLETE`, 568 `INPUT_TYPE_UNSUPPORTED`).
- Static: `extractionProgress.completed = true` has exactly one writer,
  `defense-run-simulation.js:1411`, and that same block sets `run.extracted =
  true` at :1413. The input guard at :894 requires `!run.extracted` and :897
  requires `completed`. The required state has no producer.

The capture happens automatically by standing in a zone. "Defeat an elite and
choose to capture it" and "stand in a zone for N seconds" are different games,
and only the first is what the design documents promise. Impression scoring is
blocked on the fix rather than estimated against the wrong mechanic.

## Cross-cutting finding — six audits, one failure mode

Independently, in four lanes:

- `NarrativeG1`: V1 provenance — commit `2c39fce` changed the lobby h1 one day
  after an audit cleared the old string. The audit was never re-run and still
  reads green for text that no longer exists.
- `BalanceG2G3`: cycle-2's committed TTK table was silently invalidated by the
  in-flight stance redesign. Nothing flagged it.
- Rig pipeline: writes `tposeOk: false` into its own report, then installs
  anyway, because `rig-all-characters.sh` gates on process exit code.
- Director: two wrong denominators, both retracted mid-cycle.

Same shape every time — **an artifact that was true when produced, never rebound
to its source, and trusted afterwards.** A dated markdown audit expires
silently; a CI assertion cannot. This is the strongest argument in the cycle for
converting these six audits into standing tests.
