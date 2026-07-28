# Stage 1b Scope Review — Cinder Pressure and Agency

run-id: `20260726-stage1b-cinder-pressure-agency`
date: `2026-07-26`
status: **REMEASURED — REDESIGN REQUIRED**
source: `../decision-log.md#d-20260726-s2c-03`

## Decision boundary

The authorized concept, instrumentation, deterministic formation-order, and presentation-only slice is implemented. No Cinder numeric catalog value, extraction value, runtime ID, one-handoff cap, campaign schema, GLB, monetization surface, or simulation-ownership boundary changed. Scripted probes remain synthetic evidence and do not satisfy G7/G8.

## Evidence reviewed

- Frozen gate verdict: `../../qa/stage1b-gate-verdict-20260726.json`.
- Canonical pressure export: `../../qa/stage1b-pressure-packets-20260726.json` — 15 runs / 45 attributable packets.
- Canonical G3 export: `../../qa/stage1b-g3-stance-events-20260726.json` — 50 accepted rally-to-TURRET switches plus 100 control runs.
- Canonical persistence export: `../../qa/stage1b-persistence-scenarios-20260726.json` — victory, defeat after acceptance, and defeat before acceptance.
- Canonical symmetric export: `../../qa/stage1b-symmetric-trials-20260726.json` — five archetypes × 20 paired trials.
- Isolated G6 artifacts: `../../qa/g6-fullapp-isolated-20260726.json`, `../../qa/g6-soak-30m-isolated-20260726.json`, and `../../qa/g6-provenance-20260726.json`.
- Human-study protocol and blank templates: `../../study/`.

## Scope acceptance and remeasurement

| Requirement | Result | Status |
|---|---|---|
| Packet-level pressure attribution and explicit TTK state | 15 Cinder rows, 45 ordered packets, 13 measured TTKs, two `NOT_SPAWNED_DEFEAT` rows | IMPLEMENTED |
| Formation phase attribution from accepted switch events | 50/50 conversions retained accepted tick/sequence and pressure context | IMPLEMENTED |
| Symmetric paired-trial and legal-combo EV surface | 100 paired rows; recomputable EV ratio `1.70` | IMPLEMENTED |
| Three persistence scenarios with state diffs | three ordered traces; two accepted handoffs; zero writes without accepted extraction | IMPLEMENTED |
| G7 rendered collection protocol | valid blank schema for 10 participants / 20 eligible decisions / `>=14` voluntary re-entries, inclusive `30–180 s` circuits, `>=3` distinct canonical player actions, and `>=1` `ELITE_EXTRACTED` reward event per decision; observed `0/10`, `0/20`, `0/14` | BLOCKED / UNMEASURED |
| G8 five-title plus ten-session protocol | valid blank schema; `0/5` survey rows, `0/10` first-exposure sessions | BLOCKED / UNMEASURED |
| Frozen boundaries and no-monetization policy | preserved | PASS (scope only) |

## Frozen gate disposition

| Gate | Verdict | Observed reason |
| G2 | **FAIL** | Explicit archetype wins are `4/14/7/5/20` of 20; 13/15 pressure rows miss the `55.0–80.0%` gate-minimum band, including two defeats with no measured boss TTK. Ties do not count as wins. |
| G3 | **FAIL** | `50/50` rally-to-TURRET conversions are `NOT_EXPOSED`, control companion downs are `0`, combined control defeat rate is `12%`, and legal-combo maxEV/medianEV is `1.70`. |
| G5 | **N/A** | No monetization surface or cohort-dependent measurement exists. |
| G6 | **FAIL** | Isolated desktop full-app and soak evidence exists, but mobile proxy frame/long-frame limits fail, soak memory is not stable, and rollback/release-readiness provenance is absent. |
| G7 | **BLOCKED** | Canonical metadata and all human observations are missing: `0/10` participants, `0/20` eligible decisions, `0/14` voluntary re-entries; the inclusive `30–180 s`, `>=3` action, and `>=1` reward-event criteria are unmeasured. |
| G8 | **BLOCKED** | Canonical five-title survey and ten first-exposure sessions are missing. |

## Director gate

**NO GO for the next public beat.** The evidence infrastructure is accepted; the pressure/formation outcome is not. Stage 1b returns to director redesign because the frozen G2/G3/G6 gates failed and G7/G8 remain unmeasured. This decision does not authorize another threshold substitution, hidden fallback, or data-only retune.

## Required next evidence

1. Redesign the authored Cinder pressure path so every canonical row can be evaluated inside the unchanged gate-minimum, defeat, and TTK contract.
2. Create real post-switch non-grace exposure for rally-to-TURRET and at least one observable control companion down without breaching the combined defeat-rate ceiling.
3. Bring both mobile-proxy tiers and the 30-minute soak inside the frozen G6 budgets; add signed rollback and release-readiness provenance.
4. Only after a rendered slice reliably exposes a persistent Elite Extract decision, collect uninterrupted human G7 sessions and source-backed G8 survey/impression evidence under the frozen protocol.
## Instrumentation-only receipt set

The implementation receipt set is canonical and repo-local:

- `qa/evidence/gates/G2/g2-adversarial-tape-evidence.json` with `.receipt.json`
- `qa/evidence/gates/G2/g2-adversarial-tape-fixture.receipt.json`
- `qa/evidence/gates/G2/stage1b-cinder-pressure-packets.json` with `.receipt.json`
- `qa/evidence/gates/G3/stage1b-formation-attribution.json` with `.receipt.json`
- `qa/evidence/gates/G7/stage1b-persistence-scenarios.json` with `.receipt.json`

These receipts use injected source revision `stage1b-instrumentation-working-tree-20260726`; they prove deterministic instrumentation only and do not promote any gate or authorize tuning.
