# Stage 2 Scripted Playtest Report

run-id: `20260726-stage2-balance-agency`  
session: `2026-07-26T01:16:30Z–01:21:22Z`  
rules version: `defense-survivor-v1`

## Evidence classification

This is a **scripted simulation report, not a human playtest**. Headless policies drive the shipped `createDefenseRun` state machine. They can establish deterministic route/event behavior and pressure signals; they cannot establish player comprehension, voluntary repeat rate, subjective immersion, or end-to-end player completion in the rendered build.

## Scripted full-campaign rotation

Method: `node scripts/run-g2-archetype-rotation.mjs <archetype> --seeds 401 --output /tmp/abyssal-s2-<archetype>-active.json` executed `2026-07-26T01:20:50Z–01:21:22Z`. Each policy runs all ten stages; final-stage `FINAL_COMPLETION` counts as a clear.

| Archetype | Distinct policy emphasis | Stage clears / attempts | Defeats | Mean boss TTK (ticks / seconds) | Final terminal | G3 comparison | Assessment |
|---|---|---:|---:|---:|---|---|---|
| rusher | damage-first, aggro formation | 10 / 10 | 0 | 558.3 / 9.31 | FINAL_COMPLETION | contributes to >=5 tested and >=3 viable | preliminary viable; one seed only |
| turtle | gate/defense-first, passive formation | 10 / 10 | 0 | 704.7 / 11.75 | FINAL_COMPLETION | contributes to >=5 tested and >=3 viable | preliminary viable; 1.262× rusher TTK |
| economy-greed | reclaim/equipment-spread priority | 10 / 10 | 0 | 708.5 / 11.81 | FINAL_COMPLETION | contributes to >=5 tested and >=3 viable | preliminary viable; slowest baseline |
| micro-optimizer | damage/gate mixed priority, aggro formation | 10 / 10 | 0 | 627.6 / 10.46 | FINAL_COMPLETION | contributes to >=5 tested and >=3 viable | preliminary viable |
| casual | randomized/skip policy | 10 / 10 | 0 | 555.2 / 9.25 | FINAL_COMPLETION | contributes to >=5 tested and >=3 viable | preliminary viable; fastest baseline |

**Threshold result:** the literal `>=5 archetypes tested` threshold is met. The literal `>=3 independently viable` threshold is only a preliminary scripted result: all five clear one seed, but current pressure does not distinguish outcomes. The single-player no-`>50%` dominance threshold has no direct PvP measurement; it is **blocked**, not inferred from clear rates.

### RPG-inactive control

Method: `node scripts/run-g2-archetype-rotation.mjs rusher --seeds 401 --rpg-inactive --output /tmp/abyssal-s2-rusher-inactive.json` executed `2026-07-26T01:20:50Z–01:21:22Z`.

| Policy | Clears / attempts | Defeats | Mean boss TTK | Comparison | Assessment |
|---|---:|---:|---:|---|---|
| rusher with RPG inactive | 10 / 10 | 0 | 810.8 ticks / 13.51 s | active rusher is 1.45× faster, but both clear all stages | FIX — progression changes speed, not the observed outcome |

## Controlled Cinder rotation

Method: `node scripts/run-g2-archetype-sweep.mjs --output /tmp/abyssal-s2-cinder-rotation.jsonl` at `2026-07-26T01:19:24Z`.

| Measured value | Result | Threshold comparison | Assessment |
|---|---:|---|---|
| Controlled profiles | 5: bulwark, striker, gambit, conductor, rift | G3 requires >=5 archetypes tested | PASS for count |
| Profile-seed runs | 15 (3 seeds each) | deterministic diagnostic | PASS |
| Replay digest matches | 15 / 15 | deterministic measurement prerequisite | PASS |
| Gate/commander damage in 360-tick no-movement window | 0 / 0 for every profile | runner explicitly does not observe route win rate or full TTK | non-discriminating; not a G2 completion result |
| Manifest status | `INCOMPLETE` | G2 requires full-route evidence | correctly blocked by the runner itself |

## Cinder Span pressure

Method: `node scripts/run-g2-margin-probe.mjs --seeds 401 --stances VANGUARD,TURRET,SPLIT --output /tmp/abyssal-s2-margin.json` at `2026-07-26T01:19:33Z–01:20:05Z`. Bare-stage simulation with no campaign/RPG layer.

| Stance | Terminal | Minimum gate | Minimum commander | Boss TTK | Companion downs | G2 comparison | Assessment |
|---|---|---:|---:|---:|---:|---|---|
| VANGUARD | VICTORY | 98.00% | 100.00% | 410 ticks / 6.83 s | 0 | named beat requires non-saturated Cinder; target absent | FIX |
| TURRET | VICTORY | 98.00% | 98.00% | 430 ticks / 7.17 s | 0 | named beat requires non-saturated Cinder; target absent | FIX |
| SPLIT | VICTORY | 98.00% | 98.00% | 406 ticks / 6.77 s | 0 | named beat requires non-saturated Cinder; target absent | FIX |

The full 30-run pressure set records 0 defeats and 0 companion downs. Worst tail-stage floors are SPLIT 29.00% gate / 9.82% commander, TURRET 37.00% / 16.07%, and VANGUARD 70.54% / 61.50%. That is a useful retune input, but it cannot meet G2 while `design/balance-sheet.md` and its target TTK are absent.

## Formation risk and companion loss

Method: `node scripts/run-g3-stance-events.mjs --seeds 401 --output /tmp/abyssal-s2-stance.json` at `2026-07-26T01:20:11Z–01:20:42Z`. Ten stages per stance.

| Stance | Runs | Defeats | Rally windows | Synergy uptake | Companion damage taken | Companion damage dealt | Companion downs | G3 comparison | Assessment |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| VANGUARD | 10 | 0 | 10 | 42.8% | 5,562 | 869,580 | 0 | structural reward exists | FIX: no loss consequence |
| TURRET | 10 | 0 | 0 | 0.0% | 0 | 847,320 | 0 | zero-risk identity | FIX: protection has no observed loss state |
| SPLIT | 10 | 0 | 10 | 70.2% | 680 | 840,825 | 0 | structural reward exists | FIX: no loss consequence |

## Scripted `EXTRACT_ELITE` route

Method: `node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-g7-engaged.json` at `2026-07-26T01:17:10.618Z`. The objective-seeking policy re-decides movement at 4 Hz and submits `EXTRACT_ELITE` only after `extractionProgress.completed`.

| Scope | Scripted command acceptance | Scripted event completion | Terminal outcome | Player completion | G7 assessment |
|---|---:|---:|---:|---|---|
| Cinder Span / Echo Throne / Howling Sprawl, seeds 901–903 | 9 / 9 accepted `EXTRACT_ELITE` inputs | 9 / 9 window-opened, completion, and `ELITE_EXTRACTED` events; 9 / 9 `extracted=true` | 9 / 9 VICTORY | **Not observed**; no rendered human run occurred | route works in scripted sim; gate is BLOCKED on human completion/re-entry |

Cinder Span exact scripted evidence:

| Seed | Elite candidate | Window opened | Extraction completed | Elite extracted | Accepted `EXTRACT_ELITE` | Terminal |
|---:|---:|---:|---:|---:|---:|---|
| 901 | 14.10 s / tick 846 | 17.82 s | 20.28 s | 20.30 s | 1 | VICTORY at 26.90 s |
| 902 | 14.10 s / tick 846 | 17.70 s | 20.10 s | 20.12 s | 1 | VICTORY at 27.30 s |
| 903 | 14.10 s / tick 846 | 17.70 s / tick 846 | 20.10 s | 20.12 s | 1 | VICTORY at 27.70 s |

The campaign rotations independently show a post-Cinder persisted `ember-cohort` loadout for all five policies, but that is still scripted campaign-state evidence, not a player-facing verification.

## G7/G8 limits

The scripted whole-run proxy has median 36.9 s, 51 actions, four action types, and 14 macro rewards. This is not an approved 30–180 s core-loop model. `design/core-loop.md` does not exist, voluntary human re-entry was not sampled, `design/novelty-scorecard.md` and its 5-title survey are absent, and no human impression score was collected. G7 and G8 are therefore blocked rather than passed.
