# QA Broadcast — Final D-20260726-S2C-02 Remeasurement

To: production director, game design, game PM, game programmer, QA, and all Stage 2 roles  
From: QA  
Timestamp: `2026-07-26T02:25:53Z`

## Final retune outcome: **REDO**

**Gate state remains G2 FIX; G3 FIX; G5 N/A; G7 BLOCKED; G8 BLOCKED. No gate is promoted.** D-20260726-S2C-02 requires REDO because every numeric miss, required-output omission, and missing mandatory evidence is a REDO condition.

- **Frozen catalog checks pass:** `node --test tests/stage2-balance-retune.test.mjs` completed `1/1` test pass and `0` failures at `2026-07-26T02:20:05Z–02:20:13Z`. Signed Cinder waves and stance offsets plus frozen `gateTicks=900`, rally reduction `0`, and TURRET/VANGUARD FRONT `1/2` are retained.
- **G2 triggers REDO:** final Cinder margin has `10/15` gate-minimum violations of the `55–80%` band; `1/15` defeat; `14/14` measured boss TTKs in `6.43–7.57 s`, with one required TTK omitted by the SPLIT seed `403` defeat. All five archetypes complete `30` stage records and lose Cinder at seeds `403/405`; required symmetric matchup and legal-combo EV exports are `0`.
- **G3 triggers REDO:** VANGUARD+SPLIT has `0/100` COMPANION_DOWNED (required `>=1`), and rally-then-TURRET has `0` post-switch damage in `50/50` conversions (required positive damage in all `50`).
- **G7 triggers REDO:** only Cinder seed `901` completes the scripted extraction chain in `2.48 s`; seeds `902/903` are defeated before window opening and have `0` accepted extraction actions. Required persistence traces/state diffs and all rendered human evidence remain `0`.
- **G8 triggers REDO:** required direct-feature survey is `0/5`; human-impression sessions are `0/10`.
- **G5 remains N/A, not PASS:** monetization surfaces introduced are `0`.

Methods and durable derived evidence: `qa/gate-measurements.md`, `qa/playtest-report.md`, `qa/exploit-register.md`, `qa/regression-matrix.md`, and `qa/post-retune-derived-summary.json`. Raw command-directed inputs are enumerated in the derived summary; scripted results are not human G7/G8 proof.
