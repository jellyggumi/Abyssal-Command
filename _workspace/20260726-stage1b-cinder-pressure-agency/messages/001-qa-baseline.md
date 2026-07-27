# QA Baseline Broadcast — Stage 2 Balance and Agency

to: game-designer, game-pm, game-programmer, game-production-director  
from: game-qa  
run-id: `20260726-stage2-balance-agency`  
timestamp: `2026-07-26T01:21:22Z`  
feedback-requested-by: 2026-07-26

## Gate position

**No Stage 2 gate is ready to pass from this baseline.** G2 and G3 are FIX; G7 and G8 are BLOCKED. The no-monetization boundary remains unchanged; G5 is N/A unless that boundary changes explicitly.

## Material findings

1. **Cinder Span is non-threatening in the current bare-stage baseline.** Across VANGUARD/TURRET/SPLIT on seed 401, all three routes win with a minimum gate of 98.00%; commander floors are 100/98/98%; boss TTK is 410/430/406 ticks. The public beat asks for a non-saturated Cinder sortie. G2 cannot be calibrated yet because `design/balance-sheet.md` and its TTK target are absent.
2. **Five scripted full campaign rotations clear 50/50 stage runs with no defeat.** Rusher, turtle, economy-greed, micro-optimizer, and casual all clear ten stages on seed 401. The RPG-inactive rusher control also clears 10/10 stages (mean boss TTK 810.8 ticks). This is baseline evidence, not a G3 pass: sample size is one seed and the outcomes are saturated.
3. **Companion risk does not resolve into loss.** The 30-run stance probe records 0 companion downs and 0 defeats. TURRET takes zero companion damage, but VANGUARD and SPLIT also produce no loss. The defensive stance is not yet a meaningful consequence-bearing choice.
4. **Rally-then-Turret is a reproducible candidate exploit.** In 10/10 runs it retains a boss rally, then takes zero companion damage after switching to TURRET; no runs down a companion or lose. Do not certify formation choice balance before a response and remeasurement.
5. **`EXTRACT_ELITE` reaches scripted end-to-end completion, but not human completion.** `scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-g7-engaged.json` at 2026-07-26T01:17:10.618Z produced 9/9 accepted commands, 9/9 window/completion/`ELITE_EXTRACTED` event chains, and 9/9 `extracted=true`. Cinder seeds 901–903: candidate at 14.10 s, window at 17.70–17.82 s, completion at 20.10–20.28 s, extracted one tick later. This is scripted simulation only; it does **not** meet the manifest’s player-visible end-to-end observation or G7’s >=70% voluntary human re-entry requirement.
6. **G8 has no evidence surface.** `design/novelty-scorecard.md`, a five-title survey frequency table, and a human QA impression score are absent.

## Required responses

- **Designer:** publish the G2 mechanics/TTK contract, define desired Cinder threat and companion-loss consequences, and decide whether the rally-then-Turret conversion is intended. Publish the G7 model and G8 novelty scorecard before requesting a gate pass.
- **PM:** preserve the recorded no-monetization boundary; no paid/free fairness conclusion is requested or implied. Confirm G5 remains N/A for this cycle.
- **Programmer:** after approved data-only changes, provide an actual player-facing `EXTRACT_ELITE` capture path for QA. Scripted success is not evidence of UI discoverability, hold progress, or persistent result presentation.
- **Director:** keep G2/G3 at FIX and G7/G8 BLOCKED; schedule remeasurement only after the missing contracts and approved implementation exist.

## QA evidence

- `qa/gate-measurements.md`
- `qa/playtest-report.md`
- `qa/exploit-register.md`
- `qa/test-plan.md`
