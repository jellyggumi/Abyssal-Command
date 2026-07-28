# Cycle 2 Retrospective — Stage 1b Cinder Pressure and Agency

## Cycle outcome

**Final disposition: BLOCKED.**

The cycle produced durable, reproducible machine-measurement surfaces, but it did not clear the outcome gates. G2, G3, and G6 are **FAIL**; G7 and G8 are **BLOCKED**; G5 is **N/A, not PASS**. The authoritative result is `qa/stage1b-gate-verdict-20260726.json`, with the evidence-first narrative in `qa/stage1b-measurement-report.md`.

This cycle makes no human-evidence claim. Pressure, formation, symmetric-trial, and persistence outputs are deterministic scripted or synthetic evidence. The G7 and G8 inputs remain templates.

## What worked

### The measurement packet became durable

- **OBSERVED pressure readiness:** the exporter retained `15/15` planned runs and `45` pressure packets in `qa/stage1b-pressure-packets-20260726.json`.
- **OBSERVED persistence readiness:** the exporter retained `3` scenarios and `2` accepted handoffs in `qa/stage1b-persistence-scenarios-20260726.json`.
- The symmetric, G3 attribution, pressure, persistence, and final evaluator contracts execute through focused tests. The evaluator reproduces the canonical `BLOCKED` verdict rather than inferring a pass from partial evidence.
- The evaluator distinguishes outcome state from instrumentation readiness. Readiness PASS for an exporter does not promote G2, G3, G6, G7, or G8.

### Attribution exposed the actual agency failures

- **OBSERVED:** all `50/50` rally-to-TURRET conversions were not exposed and had zero post-switch damage.
- **OBSERVED:** TURRET retained one FRONT companion and boss rally cooldown reduction remained `0`, so the failed gate is not attributed to violating those frozen constraints.
- **OBSERVED:** VANGUARD+SPLIT controls recorded `0` companion downs and `12/100` defeats.
- **OBSERVED:** legal-combo maxEV/medianEV was `1.70` against `<=1.30`.

The packet now names the failed causal surfaces directly: exposure, post-switch consequence, control companion-down consequence, and dominance.

### Performance evidence became isolated and provenance-aware

- **OBSERVED:** both full-app and soak measurements are marked isolated.
- **OBSERVED:** the telemetry contract is retained with `11` pass and `0` fail.
- **OBSERVED:** the focused UI browser gate is retained at `844x390` and `2056x1082`.
- **OBSERVED:** the isolated soak ran for `1807155 ms` and retained frame, input, long-frame, heap-slope, and stability fields.

These artifacts are useful because they fail closed. Passing telemetry or focused browser evidence does not hide failed device tiers, unstable soak memory, or missing operational provenance.

## What failed

### G2 — balance and pressure did not converge

Every archetype misses the required `9-11/20` explicit-win envelope:

- bulwark: `4/20`
- conductor: `14/20`
- gambit: `7/20`
- rift: `5/20`
- striker: `20/20`

The pressure evidence records gate-minimum failures for VANGUARD/401-405, TURRET/401-405, and SPLIT/401-403. SPLIT/402 and SPLIT/403 are `NOT_SPAWNED_DEFEAT/null` for boss TTK. The set records `2/15` defeats and only `13` measured boss TTKs. The valid defeat band does not repair the gate-minimum or missing-TTK failures.

### G3 — formation risk remained non-consequential and dominant

The required conversion was not demonstrated: `50/50` rally-to-TURRET cases had zero post-switch damage. Controls produced `0` companion downs. The legal-combo EV ratio remained `1.70`, above `1.30`. Passing retained subconstraints—cooldown reduction `0`, one TURRET FRONT, and a `12/100` control defeat count—cannot promote the gate.

### G6 — performance and release provenance remained incomplete

- Desktop frame p95 is `16.8 ms`, above `16.7 ms`.
- Midtier mobile proxy frame p95 is `33.3 ms`, and long-frame ratio `0.02106` is not below `0.005`.
- Low mobile proxy frame p95 is `50 ms`, and long-frame ratio `0.19329` is not below `0.005`.
- The soak heap slope is `0.1138 MiB/min`, with `memoryStable=false`.
- Rollback-runbook PASS provenance is absent.
- Release-readiness PASS provenance is absent.

The shipped-mobile tier, focused UI browser gate, telemetry contract, and isolated soak submetrics are evidence, but G6 requires all tiers, stable soak memory, and complete provenance.

### G7 and G8 remained blocked on human evidence

- **G7 BLOCKED:** `0/10` participants, `0/20` eligible decisions, `0/14` voluntary re-entries.
- **G8 BLOCKED:** direct-feature survey `0/5`; first-exposure scores `0/10`; median unavailable.

Templates are not sessions. Synthetic persistence and scripted extraction behavior cannot establish comprehension, preference, voluntary re-entry, or first-exposure impression.

### G5 remained out of scope

`monetizationSurfaceIntroduced=false`. G5 is **N/A**, not PASS, and contributes no promotion signal.

## Why the packet returns to director review

The packet succeeded as instrumentation and failed as a promotion case. It now provides enough attribution to show that the remaining problems are not missing counters in a report:

1. G2 misses the balance envelope across every archetype and misses the pressure envelope across the exact rows recorded in the verdict.
2. G3 preserves frozen stance constraints but still produces no post-switch consequence, no control companion-down consequence, and an over-ceiling EV ratio.
3. G6 proves that the mobile proxy and memory/provenance gaps survive isolated measurement.
4. G7 and G8 cannot be resolved by more synthetic runs; they require completed human evidence.

Those conditions cross design, performance, operations, and study-readiness boundaries. The cycle therefore returns to director review for scope and sequencing. It does not authorize another public beat, a release-readiness claim, or a human-study claim.

## Lessons retained

- **Readiness is not outcome.** A complete packet can correctly return FAIL or BLOCKED.
- **Subcriterion success is not a gate pass.** One TURRET FRONT, cooldown reduction `0`, an in-ceiling defeat count, passing telemetry, and a focused browser result remain subordinate to the full gate contracts.
- **Isolation improves the credibility of failure.** The mobile proxy misses and `0.1138 MiB/min` soak slope cannot be dismissed as concurrent exporter noise in the recorded session.
- **Synthetic evidence must stop at its boundary.** Persistence scenarios can verify scripted handoff semantics; they cannot establish voluntary re-entry or impression.
- **Fail-closed provenance matters.** Missing rollback and release-readiness artifacts keep G6 failed even when other G6 components exist.

## Director-review handoff

Director review receives:

- the canonical gate verdict: `qa/stage1b-gate-verdict-20260726.json`
- the final measurement report: `qa/stage1b-measurement-report.md`
- G2/G3 machine evidence: `qa/stage1b-symmetric-trials-20260726.json`, `qa/stage1b-pressure-packets-20260726.json`, `qa/stage1b-g3-stance-events-20260726.json`
- persistence evidence: `qa/stage1b-persistence-scenarios-20260726.json`
- isolated G6 evidence: `qa/g6-fullapp-isolated-20260726.json`, `qa/g6-soak-30m-isolated-20260726.json`, `qa/g6-provenance-20260726.json`
- G7/G8 templates, explicitly classified as no human evidence

No threshold changes are proposed in this retrospective. The unchanged thresholds remain those in the canonical verdict.

## Next public beat

**The next public beat remains deferred.**

The cycle closes with no release or demonstration authorization. Reconsideration requires a later evidence packet that clears the failed gates and replaces the blocked G7/G8 templates with valid completed evidence; this statement is a gate condition, not a release promise.
