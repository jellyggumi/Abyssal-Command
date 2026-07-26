# Core Loop Implementation — Defense/Offense + RPG Slice

run-id: `20260725-defense-rpg-development`

## Authority and scope

This is an implementation-facing slice of the existing contract, not a second rules table. `defense-run-simulation.js` owns ticks, actors, waves, hazards, growth, extraction, rewards, and terminal outcomes; `campaign-state.js` owns persistent companions/rewards/achievements; `app.js` owns input, overlays, audio lifecycle, and persistence; `battle-realtime-three.js` and `battle-visualizer.js` observe snapshots; catalog files own authored values (`_workspace/20260722-defense-survival-expansion/engineering/architecture-contract.md`).

**Stage 2 order:** first re-measure Tier 0.1–0.4, then enable the slice. A research comparator or design inference never writes runtime state.

## Measured loop contract

The observation window begins at the first combat input and ends at the accepted reward event. A qualifying loop must finish in **30–180 seconds**, contain **at least three distinct deliberate action classes**, and contain **at least one accepted reward**. These are contract targets, not current evidence (`_workspace/20260722-defense-survival-expansion/design/core-loop.md:20-40`).

| window | beat | deliberate action (count once per distinct class) | expected observable evidence |
|---:|---|---|---|
| 0–15 s | defend + scout | move to a firing lane while reading ingress | `MOVE`, wave phase, Gate and Warden HP |
| 15–35 s | offense + recover | rotate out of safety to collect Echo/item or respond to threatened choke | pickup/recovery event, region change |
| 30–55 s | RPG choice | accept one three-choice skill showing `current → upgraded`; cast or reposition | growth offer + `SKILL_SELECTED` and optional `SKILL_CAST` |
| 45–80 s | contest | occupy the authored Domain while resource-denial/flank pressure contests it | occupation progress/capture and pressure events |
| 55–100 s | extract | after elite defeat, enter the separate point and hold Bind during the candidate-relative window | `EXTRACTION_READY`, accepted `EXTRACT_ELITE`, `ELITE_EXTRACTED` |
| 70–180 s | boss + reward | preserve Gate/Warden while committing offense; select one stage reward | boss HP/TTK, terminal victory, `REWARD_SELECTED` |

The phases may overlap, but the trace must identify tick, stage, seed, action class, and reward type. Auto-attacks, passive damage, knockback, and overlay dismissal do not count as deliberate actions. XP movement without a resolved reward does not satisfy the reward limb.

## Defense/offense + RPG acceptance slice

- **Defense:** a Gate-pressure enemy threatens Gate integrity while pursuit/low-HP-focus pressure makes Warden positioning meaningful.
- **Offense:** movement changes target geometry; one active skill or basic attack choice creates a visible current → upgraded trade-off; the player can rotate instead of waiting at the Gate.
- **RPG:** one three-choice offer, one stage-local item, one extracted companion handoff, and one stage reward remain visibly separate. Run items stay run-local; Archive rewards persist only through `campaign-state.js`.
- **Extraction:** elite defeat opens a bounded candidate-relative window; player input closes the spatial Bind; success emits a trace and adds the companion to the run/local collection in one authoritative path.
- **Failure:** a stage must be able to end in defeat so G2 can be measured. The latest evidence is 0 defeats in 700 clears, so no failure claim is made until a new receipt exists (`_workspace/20260725-wellmade-verification/production/gate-reviews/stage-gate-review.md:23-37`).

## Receipt fields and thresholds

For each of at least five archetypes, record build/rules version, stage, seed, first combat-input tick, accepted reward tick, duration, ordered action classes, reward event, minimum Gate HP, minimum Warden HP, boss TTK, peak density, spawn directions, extraction outcome, and whether the tester voluntarily starts another run. The existing repeat target is `repeaters / eligible testers ≥ 0.70`; no human repeat-rate receipt exists yet.

**Required outcome labels:** `QUALIFY`, `FAIL_DURATION`, `FAIL_ACTION_COUNT`, `FAIL_REWARD`, `FAIL_PRESSURE`, `FAIL_EXTRACTION`, or `FAIL_NO_BOSS`. Missing samples are not in-band results. Do not convert a target or catalog value into a PASS.

## Implementation guardrails

- Seed is the only source of variation; presentation never selects a wave, policy, route, or result (`_workspace/20260722-defense-survival-expansion/design/balance-sheet.md:290-292`).
- Every new event needs a deterministic state test and a presentation fallback (`_workspace/20260722-defense-survival-expansion/engineering/architecture-contract.md:13-15`).
- Reduced motion removes decoration but preserves text, status, and reward semantics (`_workspace/20260722-defense-survival-expansion/design/gameplay-contract.md:27-29`).
- No human-impression evidence exists in this run; schedule that review only after Tier 0 and the slice produce a stable, replayable build.
