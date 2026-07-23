# Playtest discovery notes

**Dated:** 2026-07-22  
**Inputs:** pre-integration automated archetype sessions pinned to harness snapshots `defense-run-simulation.js#69A1` / `defense-catalog.js#9CA1`, a same-seed control, the browser journey, the five-title official-source survey, and the later current-head QA receipt.  
**Evidence boundary:** these are QA discoveries and analyst hypotheses. No statement below is a human impression, player preference, or human-panel result. The earlier `5/5`-win rotations are historical diagnostics; pre-routing current head later regressed to `0/50`, then objective routing improved the latest matrix to `5/50` (10%). Both supersede the baseline for gate decisions.

## Supported novelty candidate

**Echo-command extraction remains supported:** defeat an elite, receive a time-bounded extraction decision, convert it into a named permanent companion, and represent the result as recovered enemy memory rather than generic loot.

The bounded source survey found the complete conjunction in `0/5` official comparable descriptions:

- Vampire Survivors: persistent run currency/upgrades, but no evidenced elite-memory companion conversion.
- Brotato: materials, XP, items, and between-wave shopping, but no evidenced conversion.
- Arknights: persistent recruited Operators in mobile lane defense, but no evidenced defeated-elite extraction framing.
- Hades: persistent relationships/story and permanent growth, but no evidenced extracted enemy-memory combat companion.
- Death Must Die: Guardians, relic risk, blessings, and later-run items, but no evidenced conversion.

This clears only G8’s comparable-frequency target (`0 ≤ 2 of 5`). G8 remains **FIX** because five human impression scores and the ≥4/5 mean are absent. “Supported candidate” is the strongest defensible label; “proven novel” is not.

## Current-head status

Combat integration changed the shared runtime after the baseline sessions. The linked QA broadcast captured `9/23` failures and a pre-routing `0/50` matrix. Later QA reruns supersede both current claims: the focused suite is `15/23` pass and `8/23` fail, while the 09:05Z post-routing five-archetype × ten-stage matrix is `5/50` wins (10%) with `0/5` viable archetypes. That matrix logged 21 extractions, 31 items, 59 skills, and 21 boss reaches. Strict simulation remains `0/30` wins despite internal `pass:true`; pre-elite extraction, remote Bind without spatial hold, 4–12/s terrain rates quantized to 60/s, and occupation overflow to 214/180 remain open. See [`../messages/20260722-qa-stage1-fix-broadcast.md`](../messages/20260722-qa-stage1-fix-broadcast.md) for the earlier receipt. Green browser/observer smokes do not offset those rule defects. G2 and G8 remain **FIX**.

## Local interaction discovery

Gatekeeper’s pre-integration automated sequence demonstrated that the pinned baseline harness could express a renderer-neutral chain:

```text
Gate defense → elite defeated/candidate → growth choice → Echo extraction → companion joins → repeated skill casts → boss terminal → stage reward
```

At baseline ticks 678–708, `grave-pulse` was selected, `ember-cohort` was extracted, and the active skill began its repeated cooldown cadence. This is historical evidence that the candidate hook was functional in that harness rather than only described.

However, four baseline roaming policies reached victory without seeing an elite candidate, item, growth offer, or extraction. The target loop—Gate defense → Echo recovery → growth → occupation/extraction → boss kill—was therefore not a reliable baseline journey. That historical hook was path-sensitive and bypassable; current-head behavior is unresolved behind the recorded regressions.

## Emergent interaction hypotheses

| hypothesis | automated support | disconfirming evidence / next probe |
|---|---|---|
| A recovered elite creates a legible mid-run identity shift. | Gatekeeper gained Ember Cohort before terminal and completed faster than the roaming policies. | Human players must identify the companion, explain its origin, and rate the beat; compare accept vs decline under the same seed. |
| Movement policy can create build identity even with auto-combat. | Baseline fixed-seed terminal duration ranged 25.2–38.5s across policies. | The measured baseline flat arena had no chokepath/elevation/hazard/occupation semantics; remeasure current head only after its regressions are fixed. |
| Guaranteed elite milestones plus occupation may prevent hook bypass. | Baseline roaming changed contact/clear timing, showing route sensitivity. | This is a remedy hypothesis, not a causal result. Isolate spawn, contact, candidate, recovery, extraction, and boss-eligibility timing under shared seeds. |
| An explicit wave grammar can make strategy readable. | Baseline policies produced distinct defeated counts and Gate integrity. | Baseline data did not label scout/pressure/flank/ranged/elite/boss patterns or enemy policy decisions; require fresh current-head receipts before claiming readability. |

## Frustration discoveries

1. **Historical signature-feature bypass:** 4/5 baseline archetypes won without Echo recovery, growth, occupation, or extraction. The diagnosis is credible for the old global-event-gate design but must be rerun after combat integration.
2. **Historical Collector inversion:** baseline field circulation yielded zero item/growth events while holding still yielded both. Occupation is a mandated mechanic and a remedy hypothesis, not yet a causally proven fix.
3. **Pressure oscillation:** baseline was 100% wins; pre-routing current head was 0/50; objective routing improved the latest matrix to only 5/50 (10%) with 8/23 focused failures and 0/5 viable archetypes. None meets the 45–55% target.
4. **Timing spread without boss telemetry:** the baseline stage-terminal proxy exceeded the ±15% band, but boss-only TTK could not be isolated; current-head replacement evidence is blocked by regressions.
5. **Choice layers are not yet gate-testable:** four baseline runs never saw a skill offer, while current-head active-skill/extraction/reward contracts regress. Combo EV and current→upgraded comprehension remain unmeasured.
6. **Map mechanics require behavioral proof:** current source may now declare chokepaths, flanks, elevation, hazards, and occupation/extraction effects, but the failing current-head run provides no end-to-end receipt.
7. **Enemy intent requires behavioral proof:** source/telemetry fields cannot by themselves establish gate pressure, pursuit/attack, flank, resource denial, elite escort, or low-HP focus.
8. **Current spatial hook is invalid:** pre-elite extraction and remote Bind bypass the required defeated-elite, contested occupation/extraction decision; the novelty concept remains source-supported, but its current implementation cannot earn G8.

## Evidence-backed FIX priorities

1. Guarantee exactly one deterministic elite milestone per stage; routing and Domain occupation may change access, contest, and risk, but must not determine whether the elite exists.
2. Preserve the authored scout → pressure → flank → ranged → elite → boss order with seeded variation, recording spawn direction/density and chosen enemy intent.
3. Treat occupation as a contract requirement to test, not a proven cure: isolate spawn, contact, candidate creation, recovery, extraction, and boss-eligibility timestamps under shared seeds.
4. Fix the current `8/23` behavioral regressions and `5/50` (10%) post-routing pressure collapse before balance interpretation; do not nerf catalog HP/density merely to raise the win count.
5. Instrument boss spawn/defeat, enemy HP/damage/speed/density/spawn direction, and combo EV so G2 is measured rather than inferred.
6. Verify separated run items, three-choice skills, stats, synergies, companions, stage rewards, and Archive growth with current→upgraded values in actual runs.
7. Re-run five archetypes under a shared seed bank until win rate is 45–55%, boss TTK is ±15%, combo EV is ≤1.3× median, and at least three strategies remain viable; only then collect human comprehension, ≤100ms feedback, immersion, repeat-intent, and G8 impression receipts.

## Out-of-lane dependencies

Simulation/catalog owners must make the deterministic milestone sequence and terrain/occupation/policy effects work behaviorally and expose stable event IDs/timestamps. Renderer, VFX, audio, and cinematic lanes may only observe those events; presentation cannot repair a missing progression chain. QA can specify and re-measure the contracts but cannot close runtime regressions in documentation.
