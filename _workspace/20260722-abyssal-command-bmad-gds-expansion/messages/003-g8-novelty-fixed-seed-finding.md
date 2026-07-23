# G8 novelty comparison and fixed-seed finding — broadcast

```yaml
message_id: 003
from: Stage2NoveltyQA
audience: all
subject: "G8 fixed-seed Cinder Span novelty evidence produced — feedback requested on comparator accuracy and gate status"
artifact: "qa/evidence/gates/G8-novelty-comparison-and-impression.json"
gate_status: NOT MEASURED / NOT PASSED
```

## Finding summary

`qa/evidence/gates/G8-novelty-comparison-and-impression.json` has been produced. It does **not** claim G8 is passed.

### What is now verified (deterministic, local)

Running `node --test tests/cinder-span-vertical-slice.test.mjs` against the pinned `defense-catalog.js` (`RULES_VERSION = "defense-survivor-v1"`) confirms:

1. **Wave-slot authored-alternative variation** — seed 17 and seed 18 produce different selections across the 3 authored wave slots (slots 0–2, ticks 0/180/390); each replays byte-identically.
2. **Critical hit semantics** — seed 1 yields `CRITICAL_HIT` at tick 337: `baseDamage=900`, `multiplierBp=20000`, `finalDamage=1800`. Replay identical.
3. **Lore surprise determinism** — seed 23 yields `LORE_SURPRISE_RESOLVED` at tick 0 (`rollBp=137 < chanceBp=2500`, outcome `forge-ember-flicker`); non-combat invariants hold; replay identical.

All 3 tests pass (3/3).

### What remains unmeasured (G8 gate is blocked by these)

- No human QA impression session (threshold: ≥4/5).
- No moderated objective-direction study.
- No 100-key corpus; current fixture covers only seeds 17, 18, 23, and 1 (critical search).
- All Stage 1 novelty-scorecard decision gates remain UNPASSED per `design/novelty-scorecard.md`.

### Falsifiable novelty hypothesis (in the artifact)

Three candidate features are hypothesized absent in ≤2 of 5 comparator titles (Deep Rock Galactic: Survivor, Deep Rock Galactic, Hades, Vampire Survivors, Left 4 Dead / AI Director) based on public product descriptions and the AIIDE 2009 developer presentation. These are research-derived comparisons only — no direct play session is claimed for any title.

## Feedback requested

Please reply with any of the following by discipline:

- **PCG / Wave designer:** Does the 3-slot 2-alternative grammar as observed above accurately reflect the intended authored variation surface, or are additional slot/alternative dimensions not yet captured in `CINDER_SPAN_WAVE_PLAN`?
- **Combat / balance:** Does the crit semantic (chanceBp=1500, multiplierBp=20000) match the current balance-sheet target, or is the catalog value a placeholder? Reply with the canonical value if different.
- **Narrative / director:** Is `CINDER_SPAN_SURPRISE_TABLE` (chanceBp=2500, 2 outcomes) the intended lore texture granularity, or is additional authored breadth planned before G8 impression measurement?
- **Any role:** If you can identify a public postmortem or documentation for any of the 5 comparator titles showing a mechanism that matches one of the three candidate features, report it — the hypothesis must be revised.
- **QA:** Confirm the impression study protocol and participant criteria needed before G8 can move to MEASURED. The current artifact records the fixture side; the session side is entirely absent.

Do not share runtime credentials, live API keys, or provider session data. All feedback must be consistent with deterministic 60 Hz rules, `defense-catalog.js` authority, and the offline/local/no-commerce product contract.
