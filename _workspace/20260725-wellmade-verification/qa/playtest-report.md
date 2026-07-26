# Playtest Report — Archetype Rotation, Well-Made Verification Cycle

run-id: `20260725-wellmade-verification` · measured by: `BalanceG2G3` (QA sub-agent)
Backs `qa/gate-measurements.md#g3`. Simulated archetype-rotation sessions, not human
playtests — see [What this is not](#what-this-is-not).

## Protocol

- **7 archetypes** (G3 requires ≥5), each driven by a deterministic investment policy
  defined in `scripts/run-g2-archetype-rotation.mjs` `ARCHETYPES`.
- **5 seeds** (301–305) × **10 stages** = 50 stage-runs per archetype, 350 total per arm.
- Run in **both** arms: RPG layer active, and RPG layer fully disabled (`wardenProgress: null`,
  all equipment stripped) to isolate the layer's contribution.
- Command:
  `node scripts/run-g2-archetype-rotation.mjs <archetype> --seeds 301,302,303,304,305 [--rpg-inactive] --output _workspace/20260725-wellmade-verification/qa/evidence/sweep-rpg-{active,inactive}-<archetype>.json`
- Evidence: `qa/evidence/sweep-rpg-active-*.json`, `qa/evidence/sweep-rpg-inactive-*.json` (14 files)

## Per-archetype table (RPG-active)

| archetype | campaigns cleared | mean boss TTK | ratio vs median | mean stage ticks | stat line actually invested | warden weapon | companion gear | distinct loadouts | within 1.3× |
|---|---:|---:|---:|---:|---|---:|---:|---:|---|
| rusher | **5/5** | 569 | 0.833 | 2,557 | binding-might, fracture-precision, abyssal-resonance | T4 | T0 | 4 | YES |
| casual | **5/5** | 604 | 0.885 | 2,606 | gate-resolve, echo-swiftness, binding-might, abyssal-resonance, reclaim-radius, fracture-precision | T4 | T0 | 5 | YES |
| micro-optimizer | **5/5** | 622 | 0.912 | 2,638 | binding-might, gate-resolve, abyssal-resonance | T4 | T0 | 4 | YES |
| completionist-collector | **5/5** | 683 | 1.000 | 2,730 | binding-might, abyssal-resonance, echo-swiftness | T1 | T1 | 5 | YES |
| economy-greed | **5/5** | 730 | 1.069 | 2,787 | reclaim-radius, echo-swiftness | T1 | T1 | 5 | YES |
| turtle | **5/5** | 739 | 1.082 | 2,805 | gate-resolve, echo-swiftness, fracture-precision | T4 | T0 | 6 | YES |
| single-companion-main | **5/5** | 861 | 1.261 | 3,088 | binding-might, abyssal-resonance | T0 | T2 | 1 | YES |

Median boss TTK **683 ticks**. Max deviation **1.261×**, inside the documented 1.3×
combo-EV cap (`design/balance-sheet.md#band-overrides`, D15).

## Per-archetype table (RPG-inactive) — the isolation arm

| archetype | campaigns cleared | mean boss TTK | RPG speedup (inactive ÷ active) |
|---|---:|---:|---:|
| rusher | **5/5** | 844 | 1.48× |
| casual | **5/5** | 857 | 1.42× |
| micro-optimizer | **5/5** | 851 | 1.37× |
| single-companion-main | **5/5** | 1,104 | 1.28× |
| completionist-collector | **5/5** | 857 | 1.26× |
| turtle | **5/5** | 926 | 1.25× |
| economy-greed | **5/5** | 850 | 1.17× |
| **ALL** | **35/35** | **899** | **1.309×** |

**Clear-rate delta, active vs inactive: 0.0 %p** (35/35 both arms, 350/350 stage-runs both
arms, 0 defeats anywhere).

The RPG layer produces a genuine 1.309× power swing and **zero** outcome change. The
difficulty ceiling sits below the RPG-inactive floor.

## Strategy distinctness

G3 requires viable archetypes to use *distinct strategies*, not merely to post similar
results. Measured, not asserted:

- **7/7 archetypes invest a distinct stat-priority set.** No two archetypes converge on the
  same stat line across 50 stage-runs each.
- **Equipment strategies genuinely diverge**: four archetypes drive warden weapon to T4 and
  buy no companion gear at all; `completionist-collector` and `economy-greed` spread to T1/T1;
  `single-companion-main` inverts entirely — T0 warden, T2 companion.
- **Loadout breadth ranges 1–6 distinct rosters** (`single-companion-main` is 1 by policy
  construction; `turtle` explores 6).

The strategies are real and separable. That part of G3 is a genuine PASS.

## Why the viability result is nonetheless reported as FIX

Every archetype clears every campaign. So does an archetype with the entire RPG layer
switched off. Across all 1,000 stage-runs measured this cycle (350 active + 350 inactive +
300 stance/exploit probes) there were **0 defeats and 0 companions downed**, and the worst
moment of the worst run still held **60.4% gate / 55.8% commander**.

A viability metric that a zero-investment build also passes is not discriminating between
archetypes — it is reporting that the content cannot fail anyone. The correct reading of
7/7 is **"no archetype is disqualified"**, not "7 archetypes are independently viable under
pressure". The stronger claim is currently **unmeasurable** and should be re-run once the
difficulty gap in `#g2` is closed.

Full reasoning and gate verdict: `qa/gate-measurements.md#g3`.

## Stance-layer sessions (3-stance system)

Separate protocol, identical loadout (`ember-cohort`, `rift-lens`, `veil-vanguard`) and
seeds across all three stances, 50 runs each — so any difference is attributable to stance
alone.

| stance | derived FRONT | rally windows | synergy uptake | companion dmg dealt | companion dmg taken | companions downed | gate floor (mean) | commander floor (mean) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| VANGUARD | 2 | 50/50 | 42.9% | 4,324,020 | 27,056 | **0** | 82.9% | 88.0% |
| TURRET | 0 | **0/50** | **0.0%** | 4,221,420 | **0** | **0** | 77.9% | 70.7% |
| SPLIT | 1 | 50/50 | 70.3% | 4,172,790 | 5,952 | **0** | 78.0% | 73.4% |

**Verdict: structurally real, behaviourally decorative.** TURRET is totally excluded from
both `FRONT>=1`-gated mechanics — and pays only **2.37%** of total output for it, because
its tight `radius: 300` cluster fires **19.5% more shots** than SPLIT's `radius: 9000`
spread, very nearly cancelling the +25% per-shot synergy. Net firepower spread across all
three stances: **1.0362×**.

Two prior-cycle claims refuted at larger n:
- *"TURRET has the lowest firepower"* — false campaign-wide (**SPLIT < TURRET < VANGUARD**).
  True only at stage 7 in isolation, which is where the prior cycle sampled.
- *"a real trade-off with no dominant strategy"* — the damage-taken axis is categorically
  different (27,056 / 0 / 5,952) but **never converts to an outcome**: 0 companions downed
  in 300 runs. TURRET's zero-risk identity defends against a consequence that cannot happen.

Additionally: companions take **zero damage after boss spawn in any stance** (measured
6,810 pre-boss vs **0** post-boss in permanent VANGUARD on the two hardest stages). The
FRONT/BACK risk model is inert during every boss fight.

Evidence: `qa/evidence/g3-stance-events.json`, `qa/evidence/margin-probe-{VANGUARD,TURRET,SPLIT}.json`

## What this is not {#what-this-is-not}

These are **simulated** rotation sessions driven by deterministic investment policies, not
human playtests. They measure mechanical outcomes — clear rate, TTK, damage, resource
floors, event firing. They cannot measure:

- whether any archetype is *enjoyable* to play,
- whether the stance system *feels* differentiated to a human even though it measures at
  2.37% (a player may well perceive the 0-vs-27,056 damage-taken difference as meaningful
  regardless of its outcome irrelevance — and that perception is a legitimate design
  consideration this data cannot settle),
- the G7 loop repeat-rate proxy (≥70% voluntary re-entry), which requires real testers.

Those remain **PENDING** and need human playtesting. They are not claimed here.

Also un-run this cycle: the archetype policies themselves are QA constructs. `turtle`'s
refusal to ever invest `binding-might`/`abyssal-resonance` (confirmed deterministic across
all 50 of its stage-runs) makes it a strawman defensive build, and is the direct cause of
the `#g2` turtle-ceiling violation. **The policy should be fixed before that violation is
treated as a game-balance defect.**
