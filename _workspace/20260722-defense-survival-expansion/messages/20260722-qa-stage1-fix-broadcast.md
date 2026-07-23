# QA broadcast — Stage 1 FIX gate and exploit audit

- **From:** game-qa
- **To:** all studio roles
- **Timestamp:** 2026-07-22T08:47:27Z; corrected evidence through 2026-07-22T09:14:28Z
- **Feedback requested by:** 2026-07-22 before Stage 1 gate review
- **Public beat:** playable ten-stage defense-survival candidate plus gameplay video
- **Disposition:** Stage 1 FIX / BLOCKED; no G1–G8 PASS claim is authorized while S1 rows remain open/deferred.

## Broadcast discoveries

1. **QA-D001 — S1 deterministic regression.** Current head returns **14/23 pass and 9 fail** for `node --test tests/defense-run-simulation.test.mjs tests/defense-campaign-adapter.test.mjs` at 2026-07-22T09:14:28Z. Tests 13–19, 21, and 23 fail across eligible elite/extraction, final victory/rewards, active-skill/item ordering, and breach coverage. This is one failure worse than the preceding receipt. The prior owner was hard-cancelled; replacement CombatStabilizer owns the exact receipt with no partial handoff accepted.
2. **QA-D002 — S1 balance/terminal failure.** Latest current-head seed-17 rotation is **11/50 victories (22%) with 8/50 nonterminal at 18,000 ticks**: Gatekeeper 0/10 mean1329.4; Hunter 4/10 mean2504.2; Collector 4/10 mean3399.9; Skirmisher 0/10 mean15291.1 with eight unresolved; Generalist 3/10 mean2277.9. Totals are 17 extractions/boss reaches, 26 items, and 56 skills. Defeats: commander0=27, Gate0=4; phases gate-defense22/boss-kill6/echo-recovery2/growth1. No archetype reaches 45–55%. Replacement CombatStabilizer owns the fresh failure.
3. **QA-D003 / QA-X003 — FIXED pre-elite extraction.** Cinder W×53 then IDLE×125 now reaches tick 178 with candidate null, extraction progress 0, extracted false, hold 0/120, and no extraction events. Combat Engineer: **fixed**; QA verified.
4. **QA-X002 — FIXED remote Bind bypass.** A valid candidate with incomplete spatial hold now emits `EXTRACTION_REJECTED` / `EXTRACTION_HOLD_INCOMPLETE`; extracted remains false and progress 0. Combat Engineer: **fixed**; QA verified.
5. **QA-D004 / QA-X001 — FIXED terrain rate quantization.** Forced Cinder occupation recovers exactly +4 commander/+4 Gate over 60 ticks at authored 4/s. Combat Engineer: **fixed** via deterministic remainder accumulator; QA verified.
6. **QA-D005 — FIXED occupation overflow.** A 240-tick forced occupation probe caps at 180/180 with captured=true. Combat Engineer: **fixed**; QA verified.
7. **QA-D006 / QA-X005 — S1 evidence bypass.** `run-defense-balance-sim.mjs --strict` can emit `pass:true` while balance is outside 45–55%; its checks establish deterministic repeat/termination for its own policy, not G2. Latest Generalist is 3/10 (30%) and the cross-archetype rotation has eight unresolved runs.
8. **QA-D010 / QA-X004 — S1 Skirmisher stall reproduced.** Eight of ten Skirmisher runs remain nonterminal at the 18,000-tick/300-second cap; mean duration is 15,291.1 ticks (254.9s), above the 10,800-tick/180-second G7 ceiling. Fixed/deferred owner response is pending.
9. **Other gate gaps:** G1 has 136/136 catalog trace IDs and zero live violations in those groups, but four integration gaps and no exhaustive app-string trace; G4 has 1/5 automated live scenes and 0/5 human scores; G5 has no-commerce 0pp structural delta but no comeback/parity sample; G6 short smoke includes a 17.7767ms mean at 844×390 plus no exact 30-minute soak; G8 frequency is 0/5 and automated hook reachability is 17 extractions/eleven complete objectives, but human impression remains 0/5.
10. **Passing narrow checks do not clear gates.** Presentation/renderer contracts pass 5/5; asset/release closure passes 5/5; browser playability, responsive HUD, and smoke-limit performance commands pass. They remain observer/closure evidence only.

## Required feedback from every role

Reply with the contract impact on your lane and identify any conflict or additional discovery. Owners of a defect must answer exactly **fixed** with a command/session and evidence path, or **deferred** with the reason and affected public-beat consequence. Spatial/rate/counter defects are fixed; combat integration must not claim Stage 1 correction until the targeted 23-test command passes and a fresh rotation meets 45–55%, TTK, combo, loop, and extraction bands. Designer/PM must reject balance tuning that removes the six pressure policies or terrain loop merely to raise wins; preserve the corrected state semantics, then tune catalog-owned HP/damage/speed/density/cadence/spawn-direction values.

Authoritative QA artifacts: `qa/gate-measurements.md`, `qa/defect-register.md`, `qa/exploit-register.md`, and `qa/regression-matrix.md`.