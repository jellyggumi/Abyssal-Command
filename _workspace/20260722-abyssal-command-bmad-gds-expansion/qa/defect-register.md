# QA defect register

No defects have been observed in this Stage 1 concept-validation package. This register defines the required evidence shape if a planned fixture fails; risks remain in `qa/exploit-register.md` until reproduced.

```yaml
defect_register:
  status: NO OBSERVED DEFECTS
  checked_implementation: false
  reason: "The assigned work is a design/evidence package; expanded systems and fixtures have not been implemented or measured."
  triage_severity:
    S1: "rules authority, determinism, corruption, hidden network/provider dependency, inaccessible mandatory state, or campaign-boundary violation"
    S2: "core slice path fails, misleading combat feedback, major control/focus or persistence recovery failure"
    S3: "material readability/performance/quality degradation with workaround"
    S4: "minor cosmetic/documentation issue without rule or accessibility impact"
  mandatory_failure_record:
    - defect_id
    - observed_date_utc
    - fixture_id
    - build_and_rules_versions
    - seed_map_key_input_tape_clock_case
    - observer_accessibility_configuration
    - expected_result
    - actual_result
    - first_divergent_tick_or_event_id
    - minimal_reproduction_prefix
    - raw_evidence_path
    - linked_gate_and_exploit_id
```

| defect id | severity | system | observed behavior | evidence | status | linked gate |
|---|---|---|---|---|---|---|
| None recorded | — | — | No expanded-system fixture has run; no bug occurrence is claimed. | N/A | NOT OBSERVED | G1–G8 |

## Intake rules

1. A planned risk is not a defect. Promote it only after a reproducible fixture yields observed output.
2. A single canonical mismatch is S1 until triage proves it is solely a non-authoritative capture artifact.
3. Missing required evidence is an invalid result and blocks a gate; it is not silently downgraded to a defect-free pass.
4. A narration/audio/VFX issue is S1 if it changes rules, exposes a secret/live provider dependency, or removes an essential static/caption fallback; otherwise severity follows player impact.
5. Idle duplicate/loss, run-only persistence leak, stage/campaign mutation, hidden reward chance, and a Stage-10-to-11 implication are at least S1 pending triage.

Sources: `research/{qa-measurement-protocol,telemetry-playtest-contract,combat-systems-balance,elevenlabs-integration,narrative-stage-presentation,controls-accessibility,progression-idle-economy}.md`.