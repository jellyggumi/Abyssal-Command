# Novelty scorecard — Stage 2 extraction status

run-id: `20260725-defense-rpg-development`  
owner: game designer  
status: reachability remeasured; human-impression condition blocked

## Candidate hook

A defeated elite opens a bounded, spatial Bind window; the player must reach the visible point and close Bind before expiry; success converts that hostile memory into a named companion in the current run and offline collection.

```yaml
gate: G8
candidate: elite_defeat_to_bounded_spatial_bind_to_named_companion
frequency_evidence:
  status: carried
  observed_strict_matches: 0
  comparable_titles_inspected: 11
  source: _workspace/20260725-wellmade-verification/retrospectives/cycle-1-retrospective.md
  gate_threshold: at_most_2_of_at_least_5
reachability_evidence:
  status: observed_current_run
  engaged_traces: 9
  extracted_true: 9
  extraction_contract_tests: 25
  extraction_contract_passed: 25
  source: qa/gate-measurements.md#g8
human_impression:
  target_median: 4.0
  scale: [1, 5]
  required_independent_raters: 5
  measured_scores: null
  verdict: blocked
current_g8_verdict: blocked
```

## What current evidence establishes

The 4 Hz engaged receipt emitted `ELITE_EXTRACTED` / `extracted: true` in **9/9** deterministic traces, and the extraction contract suite passed **25/25**. This resolves the carried *unreachable-input* condition only. It is deterministic reachability evidence, not an impression, comprehension, or novelty result.

**Therefore, current 9/9 deterministic reachability does not clear the human-impression condition.** G8 remains blocked until five independent people observe a stable, complete extraction sequence and score the exact hook.

## Required future panel

| Step | Requirement | Evidence |
|---|---|---|
| Stable input | Use a build where Cinder/selected loop meets its own 30–180 s and UI prerequisites; do not score a sub-30 s failure as a complete loop. | Trace ID, build/rules version, stage, seed, browser capture. |
| Prompt | Ask: “How striking and specific was converting a defeated enemy memory into a permanent command companion?” | Raw 1–5 score plus one sentence per independent participant. |
| Gate calculation | Median of five independent scores must be ≥4.0/5. | Score sheet with raw values and median. |
| Boundary | Record human impression separately from `ELITE_EXTRACTED`; no rater score changes simulation/campaign state. | QA playtest evidence only. |

## D-01 response

The Cinder spec requires visible candidate, Bind point, countdown, success/expiry, and run-versus-persistent scope. The next trace must still record candidate → accepted/rejected Bind → handoff; it must not auto-grant the companion or infer human impression from reachability.
