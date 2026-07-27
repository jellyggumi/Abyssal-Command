# Stage 2b Balance Sheet — Final Cinder Data-Retune Proposal

**Current gate state:** G2 **FIX**; G3 **FIX**; G5 **N/A**; G7 **BLOCKED**; G8 **BLOCKED**. This is the one permitted second-retune proposal, not an implementation, measurement, or gate verdict. A failed mandatory post-change retest returns this work to **REDO** under `quality-gates.md`; nothing here self-promotes a gate.

## Gate contract

```yaml
proposal:
  id: stage-2b-final-cinder-data-retune
  status: proposed_not_applied
  authorization_limit: 1
  permitted_runtime_data:
    - defense-catalog.js#CINDER_SPAN_WAVE_PLAN[0]
    - defense-catalog.js#CINDER_SPAN_WAVE_PLAN[1]
    - defense-catalog.js#CINDER_SPAN_WAVE_PLAN[2]
    - rpg-catalog.js#STANCE_CONFIG.TURRET.offsets[0]
    - rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[0]
    - rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[1]
  retained_values:
    cinder_gateTicks: 900
    boss_rally_cooldown_reduction: 0.0
    turret_derivedFrontCount: 1
    vanguard_derivedFrontCount: 2
  cinder_acceptance:
    sample: "15 rows: VANGUARD, TURRET, SPLIT × seeds 401–405"
    gateMinPct_band: [55.0, 80.0]
    defeat_rate_band: [0.0, 0.20]
    boss_TTK_s_band: [5.95, 8.05]
  formation_acceptance:
    rally_then_turret:
      sample: "50 conversions at seeds 401–405"
      boss_rally_cooldown_reduction: 0.0
      turret_front_count: 1
      zero_post_switch_damage_attempts_maximum: 0
      post_switch_companion_damage_required: positive_every_conversion
    non_turret_consequence:
      sample: "50 VANGUARD plus 50 SPLIT runs at seeds 401–405"
      companion_downs_minimum: 1
      defeat_rate_ceiling: 0.20
  frozen:
    extraction:
      occupation: {radius: 900, holdTicks: 180, moveMultiplier: 1.05, rangeMultiplier: 1.08, recoveryPerSecond: 4}
      extraction: {radius: 1000, windowTicks: 600, hard_floor_windowTicks: 180}
      accepted_elite_handoffs_per_run_maximum: 1
    runtime_ids: [cinder-span, s1-ember-hunter, rusher, ember-cohort]
    no_player_visible_canon_change: true
    no_campaign_schema_change: true
    no_GLB_or_renderer_change: true
    no_monetization: [paid_path, account, premium_currency, ads, gacha, paid_power, paid_reroll, paid_recovery]
    G5: N/A
```

The current post-retune evidence is not a viable result: all Cinder minima are `88.0–96.8%` against a `55.0–80.0%` requirement, despite `0/15` defeats and `6.43–7.17 s` boss TTK; rally-then-TURRET has `0` post-switch companion damage in `50/50` conversions. Source: `qa/gate-measurements.md#g2`, `#g3`, and `qa/post-retune-derived-summary.json#cinderMargin`, `#exploit`.

## Exact current → proposed values

| Runtime data field | Current implemented value | Proposed value | Data-owned reason and bounded observable |
|---|---|---|---|
| `defense-catalog.js#CINDER_SPAN_WAVE_PLAN[0]` | `tick: 0`; pure `{rusher: 7}`; mixed `{rusher: 4, flanker: 3}` | `tick: 0`; pure `{rusher: 14}`; mixed `{rusher: 8, flanker: 6}` | Doubles the opening authored packet without adding an enemy ID, branch, or wave slot. The 15-row Cinder probe must keep every `gateMinPct` in `55.0–80.0`, total defeats in `0–3/15`, and each TTK in `5.95–8.05 s`. |
| `defense-catalog.js#CINDER_SPAN_WAVE_PLAN[1]` | `tick: 180`; pure `{flanker: 5}`; mixed `{flanker: 3, rusher: 2}` | `tick: 120`; pure `{flanker: 10}`; mixed `{flanker: 7, rusher: 3}` | Moves the second existing packet forward exactly `60` ticks and doubles its total to prevent a fully cleared opening from restoring the current safe margin. The same 15-row Cinder envelope is the acceptance test. |
| `defense-catalog.js#CINDER_SPAN_WAVE_PLAN[2]` | `tick: 390`; pure `{ranged: 4}`; mixed `{ranged: 2, flanker: 2}` | `tick: 240`; pure `{ranged: 8}`; mixed `{ranged: 5, flanker: 3}` | Moves the existing denial packet forward exactly `150` ticks and doubles its total. Both authored branches change from `16` to `32` total enemies over `0/120/240` ticks; no global enemy stat, reward, or `STAGES["cinder-span"].gateTicks` change. The same 15-row Cinder envelope is the acceptance test. |
| `rpg-catalog.js#STANCE_CONFIG.TURRET.offsets[0]` | `freeze({x: Math.round(OCTANT_VECTORS.E.x * 0.3), y: Math.round(OCTANT_VECTORS.E.y * 0.3)})` | `freeze({x: Math.round(OCTANT_VECTORS.W.x * 0.3), y: Math.round(OCTANT_VECTORS.W.y * 0.3)})` | Keeps the one existing TURRET FRONT at exactly the `300`-unit stance magnitude but puts that indexed FRONT between the west-side approach and commander. In all `50` rally-then-TURRET conversions, `takenAfterSwitch` must be `>0`; zero-damage conversions must be `0/50`. |
| `rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[0]` | `freeze({x: Math.round(OCTANT_VECTORS.NW.x * 1.4), y: Math.round(OCTANT_VECTORS.NW.y * 1.4)})` | `freeze({x: Math.round(OCTANT_VECTORS.NW.x * 2.0), y: Math.round(OCTANT_VECTORS.NW.y * 2.0)})` | Moves the first of the existing two VANGUARD FRONT screens from magnitude `1,400` to `2,000`; `derivedFrontCount` remains `2`. Across the 50 VANGUARD and 50 SPLIT runs, QA must observe at least one non-TURRET `COMPANION_DOWNED` while the combined defeat rate remains `≤20%`. |
| `rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[1]` | `freeze({x: Math.round(OCTANT_VECTORS.SW.x * 1.4), y: Math.round(OCTANT_VECTORS.SW.y * 1.4)})` | `freeze({x: Math.round(OCTANT_VECTORS.SW.x * 2.0), y: Math.round(OCTANT_VECTORS.SW.y * 2.0)})` | Symmetric second VANGUARD screen at magnitude `2,000`; no stance ID, slot count, companion, or formation mechanic changes. It shares the same non-TURRET consequence and defeat-ceiling acceptance test. |

`STAGES["cinder-span"].gateTicks` remains `900`; `BOSS_RALLY_COOLDOWN_REDUCTION` remains `0.0`; and `STANCE_CONFIG.TURRET.derivedFrontCount` remains `1`. Repeating those already-applied values would not address the measured failures. Re-enabling rally cooldown reduction is excluded because it reintroduces a bankable retained-rally benefit.

## Runtime ownership and source mapping

| Concern | Authoritative data owner | Runtime path that consumes it | Why this proposal can affect the measured field |
|---|---|---|---|
| Cinder packet size and arrival overlap | `defense-catalog.js#CINDER_SPAN_WAVE_PLAN` | `STAGES["cinder-span"].wavePlan` → `planWaveSources` → `STAGE_PLAN_DESCRIPTORS["cinder-span"].wavePlan.waves` → `defense-run-simulation.js#buildWaveSchedule` → `spawnEnemy` | `buildWaveSchedule` uses the authored Cinder alternatives without density jitter; each proposed count and tick is therefore the active schedule input for the margin probe. |
| TURRET post-switch target exposure | `rpg-catalog.js#STANCE_CONFIG.TURRET.offsets[0]`, with retained `derivedFrontCount: 1` | `activeStanceConfig` → per-tick companion position sync → `stanceSlotForIndex` → `livingFrontCompanions` / `playerSideTarget` | The current first FRONT is east/rear of the commander. The proposed west/front offset makes that same living FRONT no farther than the commander for west-approaching player-targeting enemies, so `playerSideTarget` may select it after the switch. The exploit probe exposes this as `takenAfterSwitch`. |
| Non-TURRET loss consequence | `rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[0..1]`, with retained `derivedFrontCount: 2` | The same stance position sync and FRONT target selection path | The two existing VANGUARD FRONT companions move further into the approach. `COMPANION_DAMAGED` and `COMPANION_DOWNED` are emitted by the runtime when a selected companion reaches zero integrity; the stance probe records those events. |

The data mapping is grounded in `engineering/architecture-contract.md#exact-field-to-runtime-mapping`, `defense-catalog.js#CINDER_SPAN_WAVE_PLAN`, `defense-catalog.js#planWaveSources`, `defense-run-simulation.js#buildWaveSchedule`, `#playerSideTarget`, and `rpg-catalog.js#STANCE_CONFIG`. It does not imply that the proposed values have been applied or that their targets are met.

## Mandatory post-change measurement

1. **Data audit:** confirm the six table values exactly; confirm untouched `gateTicks=900`, rally reduction `0.0`, TURRET FRONT count `1`, all extraction values, frozen IDs, canon/schema/GLB/renderer surfaces, the one-handoff cap, and every no-monetization exclusion. Any mismatch is a failed boundary audit, not a substitute value.
2. **Cinder pressure and boss TTK:**
   ```sh
   node scripts/run-g2-margin-probe.mjs --seeds 401,402,403,404,405 --stances VANGUARD,TURRET,SPLIT --output /tmp/abyssal-s2-final-margin.json
   ```
   Retain the raw output and attach the Cinder `15` rows to `qa/gate-measurements.md#g2`. Every row must be `55.0–80.0%` gate minimum; aggregate defeats must be `0–3/15`; every boss TTK must be `5.95–8.05 s`.
3. **Five-archetype viability:** run:
   ```sh
   node scripts/run-g2-archetype-rotation.mjs rusher --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-rusher.json
   node scripts/run-g2-archetype-rotation.mjs turtle --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-turtle.json
   node scripts/run-g2-archetype-rotation.mjs economy-greed --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-economy-greed.json
   node scripts/run-g2-archetype-rotation.mjs micro-optimizer --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-micro-optimizer.json
   node scripts/run-g2-archetype-rotation.mjs casual --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-casual.json
   ```
   Retain the five outputs in `qa/playtest-report.md`; at least three must remain independently viable. Before any 45–55% G2 matchup statement, produce the still-missing deterministic symmetric export with `20` paired trials per archetype, fixed seeds `401–405`, identical value budgets, `archetypeId`, `counterProfileId`, `seed`, and `winner`; also calculate legal-combo `maxEV / medianEV <= 1.30`.
4. **Formation and exploit:**
   ```sh
   node scripts/run-g3-stance-events.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-stance.json
   node scripts/run-g3-exploit-probe.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-exploit.json
   ```
   Attach outputs to `qa/gate-measurements.md#g3` and `qa/exploit-register.md`. Confirm `BOSS_RALLY_COOLDOWN_REDUCTION=0.0`, TURRET FRONT count `1`, `takenAfterSwitch > 0` in all `50` rally-then-TURRET conversions, zero zero-damage conversions, at least one VANGUARD-or-SPLIT down in `100` stated runs, `≤20%` defeat rate, and the EV ceiling. Failure of any one condition leaves G3 FIX and forces REDO; it does not prove G3.
5. **Frozen extraction regression and evidence debt:** run
   ```sh
   node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-final-g7-scripted.json
   ```
   For Cinder seeds `901–903`, retain `EXTRACTION_WINDOW_OPENED`, window-open-to-ready `<10.00 s`, accepted `EXTRACT_ELITE`, `EXTRACTION_COMPLETED`, `ELITE_EXTRACTED`, `extracted=true`, and at most one accepted handoff. Retain event traces and campaign-state before/after diffs for victory, defeat-after-acceptance, and defeat-before-acceptance; reject duplicate handoffs or writes without acceptance. This is scripted regression evidence only.
6. **Unchanged human evidence requirements:** G7 stays BLOCKED until a rendered moderated session records 10 participants, 20 eligible re-entry decisions, at least 14 voluntary Cinder re-entries, and visible prompt/movement/hold/accepted-action/result/persistence/re-entry evidence. G8 stays BLOCKED until a five-title `≤2/5` direct-feature survey and a ten-session human impression median `≥4.0/5` exist. G5 remains N/A because this proposal introduces no monetization surface.

## Gate conclusion

This proposal is bounded to six current data fields and has numeric acceptance observations for each. It leaves G2 and G3 **FIX**, G5 **N/A**, and G7/G8 **BLOCKED** pending the mandatory evidence above. It neither changes a runtime/source/test file nor claims the next retest will pass.
