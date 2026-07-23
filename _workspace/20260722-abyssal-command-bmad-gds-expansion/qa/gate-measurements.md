# Gate measurements — Stage 1 evidence ledger

**Status:** no gate is passed. This is the single QA location for G1–G8 values. Every `NOT MEASURED` entry is intentional: research targets are not measurements.

```yaml
measurement_ledger:
  status: NOT MEASURED
  authored_date: 2026-07-22
  rules_authority: defense-catalog.js
  simulation_tick_rate_hz: 60
  local_only: true
  inherited_gate_status: not asserted
  global_blockers:
    - canonical_g2_diagnostic_incomplete: "Canonical `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` exists and is integrity-valid for a bounded 5-profile × 3-seed, 360-tick Cinder Span diagnostic. Its manifest is `INCOMPLETE` / `NOT_PASSED`; it does not satisfy full-G2 preregistration, paired full-route/matchup, TTK, combo-comparator, cooldown-boundary, or threshold-decision requirements."
    - no_preregistered_human_playtest_results: "A G8 comparison/impression artifact exists but records no human impression session."
    - no_pcq_corpus_or_observer_differential_output
  passable_now: false
```

## G1 — narrative/worldview consistency

```yaml
gate: G1
status: NOT MEASURED
verdict: NOT PASSED
measured_value: NOT MEASURED
threshold: "0 un-waived lore violations; 100% player-visible strings/effects/scenarios trace to worldview"
method: "Audit final player-visible content and event payloads against canon W-01..W-05, stage range 1..10, Stage-10 terminal rule, and allowlisted stage/world handoff schema."
evidence_path: "qa/evidence/gates/G1-narrative-canon-audit.json"
timestamp: "2026-07-22 (plan authored; execution timestamp unavailable)"
blocking_evidence: "design/worldview.md exists as an unverified target contract; missing implementation content inventory, final payload audit, and G1 evidence export."
```

## G2 — rules and balance numbers

```yaml
gate: G2
status: NOT MEASURED
verdict: NOT PASSED
measured_value: NOT MEASURED
threshold: "100% mechanics coverage; matchup win rate 45–55%; TTK within +/-15% target; no combo pair >1.3x median EV"
method: "Equal-budget deterministic sweep over Bulwark, Striker, Gambit, Conductor, and Rift hybrid; report health arithmetic, crit distribution, cooldown boundaries, TTK, EV, and route outcome by paired seed."
evidence_path: "qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl"
timestamp: "2026-07-22 (bounded canonical diagnostic generated and independently audited)"
blocking_evidence: "The canonical JSONL is internally valid for its explicit 5-profile × 3-seed, 360-tick Cinder Span diagnostic scope, including accumulated combat and cooldown facts. It remains INCOMPLETE: no full-route paired matchup matrix, full TTK distribution, combo-EV comparator corpus, cooldown-boundary matrix, or threshold decision exists."
```

## G3 — player-type diversity

```yaml
gate: G3
status: NOT MEASURED
verdict: NOT PASSED
measured_value: NOT MEASURED
threshold: ">=5 archetypes tested; >=3 independently viable; no archetype >50% dominance in optimal play"
method: "Rotate five archetypes across matched seed/card families and recorded movement policies; combine stratified route/clear outcomes with moderated playtest ratings."
evidence_path: "qa/evidence/gates/G3-archetype-rotation-and-playtest.jsonl"
timestamp: "2026-07-22 (plan authored; execution timestamp unavailable)"
blocking_evidence: "No archetype fixture corpus, no controlled session data"
```

## G4 — effects and animation immersion

```yaml
gate: G4
status: NOT MEASURED
verdict: NOT PASSED
measured_value: NOT MEASURED
threshold: "median immersion >=4.0/5; feedback latency <=100 ms; 0 unresolved S1/S2 readability complaints"
method: "Fixed low/normal/saturated captures plus rank-mask, flash, contrast, event-to-presentation and 30/60/120 Hz observer checks; then counterbalanced normal/reduced-motion/sound-off readability and immersion study."
evidence_path: "qa/evidence/gates/G4-presentation-readability-and-playtest.json"
timestamp: "2026-07-22 (plan authored; execution timestamp unavailable)"
blocking_evidence: "No presentation captures, latency trace, participant ratings, or defect triage"
```

## G5 — fairness and no-commerce reward balance

```yaml
gate: G5
status: NOT MEASURED
verdict: NOT PASSED
measured_value: NOT MEASURED
threshold: "paid/free delta <=5pp; reversal <=30% per activation; parity 10–20 sessions; signed reward record"
method: "For this no-commerce product, first verify absent paid paths. Test active-only finite rewards and Archive Return Permit property matrix: cap, <=20% credit share, >=80% active component, active confirmation, 10/20-session paired parity, and no return-only combat outcome."
evidence_path: "qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl"
timestamp: "2026-07-22 (plan authored; execution timestamp unavailable)"
blocking_evidence: "pm/reward-bands.md and pm/negotiation-record.md exist as unverified target contracts; missing account fixtures, idle transaction implementation, and G5 export."
```

## G6 — operations, performance, and telemetry

```yaml
gate: G6
status: NOT MEASURED
verdict: NOT PASSED
measured_value: NOT MEASURED
threshold: "telemetry implemented; rollback tested; readiness checklist complete; p95 frame <=16.7ms; long frames <0.5%; 30-min memory stable; input <=100ms"
method: "Local-only telemetry schema/conformance audit; fixed device/viewport 30-minute soak, p95/long-frame/backlog/allocation trace, input chain, offline export/delete and network-disabled flow."
evidence_path: "qa/evidence/gates/G6-ops-perf-and-local-telemetry.json"
timestamp: "2026-07-22 (plan authored; execution timestamp unavailable)"
blocking_evidence: "No expanded telemetry implementation, runbook exercise, or required soak trace"
```

## G7 — core loop

```yaml
gate: G7
status: NOT MEASURED
verdict: NOT PASSED
measured_value: NOT MEASURED
threshold: "period 30–180s; >=3 actions/loop; >=1 reward event/loop; voluntary repeat proxy >=70%"
method: "Verify authored loop model against deterministic 90-second fixture, offer/commit chain, objective movement decision, result/return transition, and preregistered moderated re-entry question."
evidence_path: "qa/evidence/gates/G7-loop-trace-and-repeat-study.jsonl"
timestamp: "2026-07-22 (plan authored; execution timestamp unavailable)"
blocking_evidence: "design/core-loop.md exists as an unverified target contract; missing implementation trace, pinned fixture, and participant repeat data."
```

## G8 — novelty / striking element

```yaml
gate: G8
status: NOT MEASURED
verdict: NOT PASSED
measured_value: NOT MEASURED
threshold: ">=1 element in <=2 of >=5 comparables and QA impression >=4/5"
method: "Audit the bounded seed-plan plus caption-first world handoff novelty claim against a five-title comparison ledger; run fixed-seed impression task after implementation without claiming external feature equivalence."
evidence_path: "qa/evidence/gates/G8-novelty-comparison-and-impression.json"
timestamp: "2026-07-22 (plan authored; execution timestamp unavailable)"
blocking_evidence: "design/novelty-scorecard.md and comparison research exist as unverified target contracts; missing implemented fixed-seed slice and QA impression sessions."
```

## Gate conclusion

```yaml
stage_1_gate_conclusion:
  G1: NOT PASSED
  G2: NOT PASSED
  G3: NOT PASSED
  G4: NOT PASSED
  G5: NOT PASSED
  G6: NOT PASSED
  G7: NOT PASSED
  G8: NOT PASSED
  reason: "Concept targets are not measurements. Incomplete G2 replay-integrity and G8 comparison artifacts exist, but neither satisfies its gate contract."
```