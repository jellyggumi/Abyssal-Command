# Stage 1 G1 review — narrative consistency

**Navigation:** [production contract](../production-contract.md) · [worldview](../../design/worldview.md) · [measurement ledger](../../qa/gate-measurements.md#g1)

- **Canonical threshold:** 0 un-waived lore violations; 100% player-visible strings, effects, and scenarios trace to worldview inventory.
- **Required evidence:** runtime string/effect/scenario inventory, inventory IDs, build/session ID, QA violation list, waiver expiry/approval if any.
- **Current status:** `FAIL` — source trace coverage has failed; the un-waived lore-violation count is still `NOT-RUN`.
- **Observed:** direct source audit of `app.js` and `campaign-state.js` found no `AS-WV-*` or `inventory_id` mapping for player-visible BOSS_SPEC lore, stage objectives, rewards, or messages. `Cinder Warden`, `Veil Tactician`, `Ember Cohort`, and `Abyssal Banner` are untraceable; the worldview’s Stage 1 boss is `Rift Guardian`, not `Cinder Warden`. No QA violation list, waiver record, build/session ID, or completed build audit is attached.
- **Director action:** do not promote G1. Repair the source-to-worldview inventory and attach the required QA audit; count/approve any waiver before a fresh gate decision.

## Exit record

| Value | Entry | Exit requirement | Observed result |
|---|---:|---:|---|
| Un-waived lore violations | 0 allowed | 0 | **NOT-RUN** — no QA violation list or waiver approval/expiry evidence |
| Trace coverage | source audit incomplete | 100% | **FAIL** — current player-visible source has no required inventory mapping and contains the named untraceable/mismatched content above |