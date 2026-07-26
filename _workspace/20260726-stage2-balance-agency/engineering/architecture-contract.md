# Stage 2d Architecture Contract — Final Signed Data-Only Retune

**Authority:** `production/decision-log.md` `D-20260726-S2C-02` — final Stage 2b retune authorization. It authorizes one data-only application and remeasurement; it is not a gate verdict.

**Gate state:** G2 and G3 remain **FIX**; G5 remains **N/A, not PASS**; G7 and G8 remain **BLOCKED**. No command result promotes a gate.

## Exact field-to-runtime mapping

| Authorized field | Final value | Runtime path and effect |
|---|---|---|
| `defense-catalog.js#CINDER_SPAN_WAVE_PLAN[0]` | tick `0`; primary `{ enemy: "rusher", count: 14 }`; alternatives `rusher:14` or `rusher:8 + flanker:6` | `STAGES["cinder-span"].wavePlan` is selected by `planWaveSources`, carried to `STAGE_PLAN_DESCRIPTORS["cinder-span"].wavePlan.waves`, then scheduled by `buildWaveSchedule`. |
| `defense-catalog.js#CINDER_SPAN_WAVE_PLAN[1]` | tick `120`; primary `{ enemy: "flanker", count: 10 }`; alternatives `flanker:10` or `flanker:7 + rusher:3` | Same authored-wave-plan path; this is the existing second slot. |
| `defense-catalog.js#CINDER_SPAN_WAVE_PLAN[2]` | tick `240`; primary `{ enemy: "ranged", count: 8 }`; alternatives `ranged:8` or `ranged:5 + flanker:3` | Same authored-wave-plan path; this is the existing third slot. |
| `rpg-catalog.js#STANCE_CONFIG.TURRET.offsets[0]` | `freeze({ x: Math.round(OCTANT_VECTORS.W.x * 0.3), y: Math.round(OCTANT_VECTORS.W.y * 0.3) })` | Active stance position sync places the retained first targetable TURRET FRONT toward the west-side approach. |
| `rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[0]` | `freeze({ x: Math.round(OCTANT_VECTORS.NW.x * 2.0), y: Math.round(OCTANT_VECTORS.NW.y * 2.0) })` | Active stance position sync moves the existing first VANGUARD FRONT screen farther into the approach. |
| `rpg-catalog.js#STANCE_CONFIG.VANGUARD.offsets[1]` | `freeze({ x: Math.round(OCTANT_VECTORS.SW.x * 2.0), y: Math.round(OCTANT_VECTORS.SW.y * 2.0) })` | Active stance position sync moves the existing second VANGUARD FRONT screen farther into the approach. |

`CINDER_SPAN_WAVE_PLAN` remains the active Cinder schedule source because `planWaveSources` uses `stageEntry.wavePlan` whenever present. The older `STAGES["cinder-span"].waves` tuple array remains unchanged and is not the runtime schedule source for this authored plan.

## Retained freezes

- `STAGES["cinder-span"].gateTicks = 900`; `BOSS_RALLY_COOLDOWN_REDUCTION = 0.0`; `STANCE_CONFIG.TURRET.derivedFrontCount = 1`; and `STANCE_CONFIG.VANGUARD.derivedFrontCount = 2` remain frozen, not application targets.
- Extraction remains unchanged: occupation radius `900`, hold ticks `180`, move multiplier `1.05`, range multiplier `1.08`, recovery per second `4`; extraction radius `1000`, window ticks `600`, and hard floor `180`. At most one elite handoff is accepted per run; reject duplicate accepted handoffs and persistent writes without accepted `EXTRACT_ELITE`.
- Runtime IDs `cinder-span`, `s1-ember-hunter`, `rusher`, and `ember-cohort`; player-visible canon and strings; campaign schema; GLBs; renderer; global enemy stats; rewards; source; and tests remain unchanged.
- No paid path, account, premium currency, ads, gacha, paid power, paid reroll, or paid recovery is introduced.

## Mandatory remeasurement

Run the raw commands after implementation and retain their outputs at the named evidence locations:

```sh
node scripts/run-g2-margin-probe.mjs --seeds 401,402,403,404,405 --stances VANGUARD,TURRET,SPLIT --output /tmp/abyssal-s2-final-margin.json
node scripts/run-g2-archetype-rotation.mjs rusher --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-rusher.json
node scripts/run-g2-archetype-rotation.mjs turtle --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-turtle.json
node scripts/run-g2-archetype-rotation.mjs economy-greed --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-economy-greed.json
node scripts/run-g2-archetype-rotation.mjs micro-optimizer --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-micro-optimizer.json
node scripts/run-g2-archetype-rotation.mjs casual --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-casual.json
node scripts/run-g3-stance-events.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-stance.json
node scripts/run-g3-exploit-probe.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-exploit.json
node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-final-g7-scripted.json
```

- G2: retain all 15 Cinder rows with each gate minimum `55.0–80.0%`, aggregate defeats `0–3/15`, and each boss TTK `5.95–8.05 s`. The symmetric export needs 20 paired trials per archetype at fixed seeds `401–405`, identical value budgets, `archetypeId`, `counterProfileId`, seed, and winner before a 45–55% matchup claim; legal-combo `maxEV / medianEV <= 1.30`.
- G3: retain `BOSS_RALLY_COOLDOWN_REDUCTION=0.0` and one TURRET FRONT; all 50 rally-then-TURRET conversions need `takenAfterSwitch > 0` with zero zero-damage conversions; 50 VANGUARD plus 50 SPLIT runs need at least one `COMPANION_DOWNED` and at most 20% combined defeats; legal-combo `maxEV / medianEV <= 1.30`.
- G7 scripted regression: Cinder seeds `901–903` must retain `EXTRACTION_WINDOW_OPENED`, window-open-to-ready `<10.00 s`, accepted `EXTRACT_ELITE`, `EXTRACTION_COMPLETED`, `ELITE_EXTRACTED`, `extracted=true`, and at most one accepted handoff. Retain event traces and campaign-state before/after diffs for victory, defeat after acceptance, and defeat before acceptance.
- G7 human evidence remains BLOCKED until a rendered moderated session provides 10 participants, 20 eligible re-entry decisions, at least 14 voluntary Cinder re-entries, and visible prompt, movement, hold, accepted action, result, persistence, and re-entry evidence. G8 remains BLOCKED until a five-title direct-feature survey is `<=2/5` and a ten-session human-impression median is `>=4.0/5`. G5 remains N/A, not PASS.

## REDO rule

Any signed-value mismatch, frozen-boundary breach, numeric-threshold miss, required-output omission, or missing evidence is **REDO**. Retain G2/G3 **FIX**, G5 **N/A**, and G7/G8 **BLOCKED**; do not substitute values, infer a pass, or issue further retune authority.
