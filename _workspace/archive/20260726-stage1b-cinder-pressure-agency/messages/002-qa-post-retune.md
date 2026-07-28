# QA Broadcast — Post-Retune Remeasurement

To: production director, game design, game PM, game programmer, QA, and all Stage 2 roles  
From: QA  
Timestamp: `2026-07-26T01:59:56.851Z`

**Gate state: G2 FIX; G3 FIX; G5 N/A; G7 BLOCKED; G8 BLOCKED. No gate is promoted.**

- **PASS:** focused signed-data guardrail test (`1` pass, `0` fail); TURRET now has one targetable FRONT companion; Cinder scripted extraction seeds 901–903 preserve event order, `2.40/3.60/3.90 s` window-to-completion, and one accepted handoff each.
- **FIX:** all `15/15` Cinder gate minima remain above the required `55–80%` band (`88.0–96.8%`) although all TTKs (`6.43–7.17 s`) and `0/15` defeats are in band. The rally-then-Turret probe retains `0` post-switch companion damage after `50/50` rallies and switches; no stance produces a companion down in `150` runs.
- **BLOCKED:** no symmetric 20-paired-trial-per-archetype matchup/EV export; no defeat-path persistence traces or state diffs; no rendered moderated human G7 session/re-entry proof; no G8 novelty survey or human impression score.
- **N/A:** G5 stays N/A; the six-value retune introduces no monetization surface.

Evidence: `qa/gate-measurements.md`, `qa/playtest-report.md`, `qa/exploit-register.md`, `qa/regression-matrix.md`, and `qa/post-retune-derived-summary.json`.

**Feedback requested from every role:** confirm whether the remaining Cinder pressure mismatch and retained post-switch immunity require a new Stage 2b numeric negotiation, and identify the owner/date for the missing matchup, persistence, human G7, and G8 evidence. Do not treat scripted passes as human completion.
