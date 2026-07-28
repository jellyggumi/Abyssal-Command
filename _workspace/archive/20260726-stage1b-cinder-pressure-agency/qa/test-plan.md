# Stage 2 QA Test Plan — Balance and Agency

run-id: `20260726-stage2-balance-agency`  
prepared: `2026-07-26T01:16:30Z`  
rules version: `defense-survivor-v1`

## Evidence policy

This baseline uses deterministic, headless `createDefenseRun` scripted policies only. It is **not a human playtest**. Scripted command acceptance and scripted event completion are recorded separately from end-to-end player completion. No game source, test, asset, manifest, or G1 artifact was changed.

Raw observer outputs are session evidence in `/tmp/abyssal-s2-*.{json,jsonl}`; durable measured summaries and assessments are in `qa/gate-measurements.md`, `qa/playtest-report.md`, and `qa/exploit-register.md`.

## Executed matrix

| ID | Question / method | Command and session timestamp | Expected band | Evidence path | Assessment |
|---|---|---|---|---|---|
| P1 | Controlled Cinder Span rotation across five measurement profiles, 3 seeds/profile, with replay digest comparison | `node scripts/run-g2-archetype-sweep.mjs --output /tmp/abyssal-s2-cinder-rotation.jsonl` · `2026-07-26T01:19:24Z` | G3: at least 5 archetypes tested; G2 requires a full route and TTK target, so this probe cannot satisfy it | `qa/playtest-report.md#controlled-cinder-rotation` | PASS as deterministic five-profile diagnostic; explicitly insufficient for G2 completion |
| P2 | Full active campaign rotation: rusher, turtle, economy-greed, micro-optimizer, casual; seed 401; ten stages each | `node scripts/run-g2-archetype-rotation.mjs <archetype> --seeds 401 --output /tmp/abyssal-s2-<archetype>-active.json` · `2026-07-26T01:20:50Z–01:21:22Z` | G3: >=5 tested, >=3 independently viable under meaningful pressure; G2: TTK must be within ±15% of the documented target | `qa/playtest-report.md#scripted-full-campaign-rotation` | FIX: five rotations completed but only one seed; no current target is documented and clears remain saturated |
| P3 | RPG-inactive rusher control, full campaign | `node scripts/run-g2-archetype-rotation.mjs rusher --seeds 401 --rpg-inactive --output /tmp/abyssal-s2-rusher-inactive.json` · `2026-07-26T01:20:50Z–01:21:22Z` | A weaker control should expose pressure if base content is calibrated | `qa/gate-measurements.md#g2` | FIX: 10/10 clear; base pressure does not discriminate in this control |
| P4 | Bare-stage pressure / TTK / companion-down probe across every stage and all three stances | `node scripts/run-g2-margin-probe.mjs --seeds 401 --stances VANGUARD,TURRET,SPLIT --output /tmp/abyssal-s2-margin.json` · `2026-07-26T01:19:33Z–01:20:05Z` | G2: TTK ±15% of target; G3: archetypes must have meaningful independent viability | `qa/gate-measurements.md#g2` | FIX: no defeat in 30 runs; current target is absent; Cinder Span leaves 98% gate health in every stance |
| P5 | Formation risk and companion loss across every stage / stance | `node scripts/run-g3-stance-events.mjs --seeds 401 --output /tmp/abyssal-s2-stance.json` · `2026-07-26T01:20:11Z–01:20:42Z` | G3 needs distinct strategies with non-vacuous consequences | `qa/playtest-report.md#formation-risk-and-companion-loss` | FIX: 0 companion downs in 30 runs |
| P6 | Rally-then-Turret exploit with permanent Vanguard/Turret controls | `node scripts/run-g3-exploit-probe.mjs --seeds 401 --output /tmp/abyssal-s2-exploit.json` · `2026-07-26T01:20:10Z–01:20:43Z` | G2/G3: no free dominant defensive conversion | `qa/exploit-register.md#s2-003` | FIX: exploit arm retains 10 rallies and takes 0 post-switch companion damage |
| P7 | Objective-seeking engaged extraction route; 4 Hz decision cadence; Cinder Span, Echo Throne, Howling Sprawl; seeds 901–903 | `node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-g7-engaged.json` · `2026-07-26T01:17:10Z` | G7: documented 30–180 s loop, >=3 actions and >=1 reward/loop, >=70% voluntary human re-entry; G8 requires score >=4/5 and survey frequency <=2/5 | `qa/gate-measurements.md#g7` | Scripted route PASS (9/9 extraction event completions); G7/G8 gate PASS blocked: no human completion/re-entry, core-loop document, novelty survey, or impression score |

## Re-entry requirements after tuning

1. Re-run P2 with at least five seeds per archetype after a signed `design/balance-sheet.md` names the TTK target and all mechanics.
2. Re-run P4–P6 after pressure/formation changes. A pass cannot rely on saturated clears or a no-consequence defensive stance.
3. Verify `EXTRACT_ELITE` in the player-facing build with a human-controlled route; record observation of prompt, hold, accepted command, completion, and persistent companion state separately.
4. Do not assert G7 until human voluntary re-entry is sampled; do not assert G8 until the required survey and impression score exist.
