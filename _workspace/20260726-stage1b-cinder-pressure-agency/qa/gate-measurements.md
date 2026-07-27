# Stage 2 Gate Measurements — Post-Retune QA

run-id: `20260726-stage2-balance-agency`
measurement window: `2026-07-26T01:48:38.430Z–01:59:56.851Z`
method: deterministic headless scripts plus the focused catalog guardrail test; no human playtest.

Raw session outputs are ephemeral `/tmp/abyssal-s2-retune-*.json` files. Parsed values, commands, timestamps, and source-output paths are durably recorded in `qa/post-retune-derived-summary.json`; scripted evidence is never human G7/G8 evidence.

## G2 — Rules and balance numbers: **FIX**

| Conclusion | Exact measurement | Method / timestamp | Durable evidence path | Status |
|---|---|---|---|---|
| Signed six-value guardrails hold | `1` test passed, `0` failed; Cinder `gateTicks=900`; waves `rusher:7`, `flanker:5`, `ranged:4`; rally cooldown reduction `0`; TURRET derived FRONT count `1`. | `node --test tests/stage2-balance-retune.test.mjs` · `2026-07-26T01:59:56.754Z–01:59:56.851Z` | `qa/post-retune-derived-summary.json#guardrails` | **PASS** |
| Cinder gate-minimum target band | `15/15` Cinder rows are outside the required `55.0–80.0%`: VANGUARD `91.4–96.8%` (mean `94.0%`), TURRET `91.4–96.0%` (mean `93.48%`), SPLIT `88.0–94.0%` (mean `90.4%`). | `node scripts/run-g2-margin-probe.mjs --seeds 401,402,403,404,405 --stances VANGUARD,TURRET,SPLIT --output /tmp/abyssal-s2-retune-margin.json` · output `2026-07-26T01:52:13.567Z` | `qa/post-retune-derived-summary.json#cinderMargin` | **FIX** |
| Cinder defeat-rate target band | `0/15` Cinder defeats (`0.00%`), within the `0–20%` band. | Same margin command / timestamp | `qa/post-retune-derived-summary.json#cinderMargin` | **PASS** for this subcriterion |
| Cinder boss-TTK target band | All `15/15` Cinder values are within `5.95–8.05 s`: VANGUARD `6.77–7.17 s`, TURRET `6.63–7.17 s`, SPLIT `6.43–7.17 s`. | Same margin command / timestamp | `qa/post-retune-derived-summary.json#cinderMargin` | **PASS** for this subcriterion |
| Five archetype rotation | rusher, turtle, economy-greed, micro-optimizer, and casual each clear `50/50` stage runs at seeds `401–405`; combined `250/250` clears, `0` defeats. Mean boss TTK ticks: `561.04`, `722.88`, `716.04`, `594.30`, `584.86`. | Five `node scripts/run-g2-archetype-rotation.mjs <archetype> --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-retune-<archetype>.json` commands · outputs `2026-07-26T01:48:38.430Z–01:48:43.514Z` | `qa/post-retune-derived-summary.json#archetypes` | **FIX** — count and clears are measured, but outcomes are non-discriminating and G2 remains failed by the Cinder gate band |
| Symmetric matchup / EV criterion | Required `20` paired symmetric trials per archetype, a `45–55%` matchup export, and defined `maxEV / medianEV <= 1.30` data are absent. | Artifact check after the required five rotations · `2026-07-26T01:59:56.851Z` | `qa/regression-matrix.md#unmet-required-evidence` | **BLOCKED** — no matchup or EV claim is inferred |

## G3 — Player-type diversity: **FIX**

| Conclusion | Exact measurement | Method / timestamp | Durable evidence path | Status |
|---|---|---|---|---|
| TURRET is targetable | TURRET has FRONT count `1` in `50/50` stance runs and takes `260` companion damage; VANGUARD is FRONT `2` / `30,510` damage; SPLIT is FRONT `1` / `5,966` damage. | `node scripts/run-g3-stance-events.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-retune-stance.json` · output `2026-07-26T01:54:51.673Z` | `qa/post-retune-derived-summary.json#stance` | **PASS** for removal of zero-targetable-TURRET state |
| Consequential companion-risk outcome | Across `150/150` stance runs: `0` companion downs and `0` defeats. Rally windows are `50/50/50` for VANGUARD/TURRET/SPLIT. | Same stance command / timestamp | `qa/post-retune-derived-summary.json#stance` | **FIX** — damage exists, but no observed loss consequence establishes the trade-off |
| Rally-then-Turret exploit regression | The candidate arm switches `50/50` times after `50` rallies; it has FRONT `1`, `30,510` pre-switch companion damage, **`0` post-switch companion damage**, and `0` downs. Focused test pins rally cooldown reduction to `0`. | `node scripts/run-g3-exploit-probe.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-retune-exploit.json` · output `2026-07-26T01:57:32.110Z`; plus focused test above | `qa/post-retune-derived-summary.json#exploit` | **FIX** — the cooldown and targetability guardrails pass, but retained-rally switching still has zero post-switch damage; original exploit prevention is not proven |
| Dominance / EV ceiling | No symmetric matchup export or defined per-archetype EV series supports `maxEV / medianEV <= 1.30`. | Artifact check · `2026-07-26T01:59:56.851Z` | `qa/regression-matrix.md#unmet-required-evidence` | **BLOCKED** |

## G7 — Core loop and Elite Extract route: **BLOCKED**

| Conclusion | Exact measurement | Method / timestamp | Durable evidence path | Status |
|---|---|---|---|---|
| Cinder scripted extraction happy path | Seeds `901/902/903`: event order is candidate → window opened → completion → extracted; window-to-completion is `2.40/3.60/3.90 s` (<`10.00 s`); each has `1` accepted `EXTRACT_ELITE`, `extracted=true`, and `VICTORY`. | `node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-retune-g7-scripted.json` · generated `2026-07-26T01:57:39.505Z` | `qa/post-retune-derived-summary.json#extraction` | **PASS** for scripted Cinder happy-path event order and one-handoff cap |
| Persistence regression scenarios | Required retained event traces and campaign-state before/after diffs for victory, defeat after acceptance, and defeat before acceptance are absent; the scripted output contains only the happy-path victories. | Artifact check against `production/decision-log.md#mandatory_post_change_measurement` · `2026-07-26T01:59:56.851Z` | `qa/regression-matrix.md#unmet-required-evidence` | **FIX** |
| Human completion and re-entry | No rendered moderated session, `10` participants, `20` eligible re-entry decisions, `14` voluntary Cinder re-entries, or player-visible prompt/movement/hold/result evidence exists. | Artifact check · `2026-07-26T01:59:56.851Z` | `qa/regression-matrix.md#unmet-required-evidence` | **BLOCKED** — scripted success is not human completion |

## G8 — Novelty / striking element: **BLOCKED**

| Conclusion | Exact measurement | Method / timestamp | Durable evidence path | Status |
|---|---|---|---|---|
| Novelty proof | Five-title frequency, `<=2/5` comparison, and QA impression `>=4/5` are not measured; no scorecard, survey, or human impression artifact exists. | Artifact check · `2026-07-26T01:59:56.851Z` | `qa/post-retune-derived-summary.json#g8` | **BLOCKED** |

## G5 — Monetization: **N/A**

| Conclusion | Exact measurement | Method / timestamp | Durable evidence path | Status |
|---|---|---|---|---|
| Product boundary | No paid path, account, premium currency, ads, gacha, or paid power was introduced by the authorized six-value data retune. | Frozen-boundary check against `engineering/architecture-contract.md` · `2026-07-26T01:59:56.851Z` | `qa/post-retune-derived-summary.json#g5` | **N/A** |

---

## Final D-20260726-S2C-02 remeasurement — **REDO**

Final measurement window: `2026-07-26T02:20:05Z–02:25:53Z`. Prior post-retune results remain above and are historical only; final raw-derived values are durable in `qa/post-retune-derived-summary.json`.

| Contract / conclusion | Exact final measurement | Method / timestamp | Durable evidence path | Status |
|---|---|---|---|---|
| Signed values and frozen catalog boundary | `1/1` focused test passes (`0` failures): Cinder `gateTicks=900`; signed `14/10/8` primary waves at ticks `0/120/240`; TURRET/VANGUARD offsets; rally reduction `0`; TURRET/VANGUARD FRONT `1/2`; Cinder IDs and occupation/extraction values match. | `node --test tests/stage2-balance-retune.test.mjs` · `2026-07-26T02:20:05Z–02:20:13Z`; focused source-value check · `2026-07-26T02:25:53Z` | `qa/post-retune-derived-summary.json#frozenBoundaryChecks` | **PASS** for checked frozen values; no gate promotion |
| G2 Cinder row count and gate-minimum band | `15/15` rows: VANGUARD `78.0/85.0/91.0/77.4/88.0%`; TURRET `80.2/85.0/92.2/78.4/88.0%`; SPLIT `61.4/51.0/0.0/61.6/41.2%`. `10/15` are outside required `55.0–80.0%`. | `node scripts/run-g2-margin-probe.mjs --seeds 401,402,403,404,405 --stances VANGUARD,TURRET,SPLIT --output /tmp/abyssal-s2-final-margin.json` · output `2026-07-26T02:24:28.384984Z` | `qa/post-retune-derived-summary.json#g2.cinderMargin` | **FIX → REDO** |
| G2 defeat and boss-TTK bounds | `1/15` defeat (`6.67%`, within `0–3/15`); `14/14` measured boss TTKs are `6.43–7.57 s` within `5.95–8.05 s`, but SPLIT seed `403` is defeated and has no boss TTK. | Same margin command / timestamp | `qa/post-retune-derived-summary.json#g2.cinderMargin` | **REDO** — required every-row TTK output is absent |
| G2 five archetype campaigns | rusher, turtle, economy-greed, micro-optimizer, and casual: each has `5` campaigns, `30` successes, `2` Cinder defeats (seeds `403/405`), and `32` stage records. Mean measured boss TTK ticks are `561.7333/725.6667/729.5000/600.9667/582.3667`. | Five mandated `node scripts/run-g2-archetype-rotation.mjs <archetype> --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-<archetype>.json` commands · outputs `2026-07-26T02:21:40.313124Z–02:21:45.210701Z` | `qa/post-retune-derived-summary.json#g2.archetypeCampaigns` | **FIX → REDO** — Cinder requirement fails |
| G2 matchup and EV proof | Required `20` paired trials per archetype, `45–55%` matchup export, and legal-combo `maxEV / medianEV <=1.30` series are absent (`0` qualifying exports). | Artifact check · `2026-07-26T02:25:53Z` | `qa/post-retune-derived-summary.json#g2.missingRequiredEvidence` | **REDO** — no claim inferred |
| G3 targetable formation | TURRET is FRONT `1/50` and takes `32,902` companion damage; VANGUARD is FRONT `2/50` and takes `35,826`; SPLIT is FRONT `1/50` and takes `5,966`. | `node scripts/run-g3-stance-events.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-stance.json` · output `2026-07-26T02:24:28.724587Z` | `qa/post-retune-derived-summary.json#g3.stanceEvents` | **PASS** only for targetability |
| G3 consequential risk | VANGUARD+SPLIT has `0` COMPANION_DOWNED across `100` runs; `1/100` defeat (`1.0%`, within `<=20%`). | Same stance command / timestamp | `qa/post-retune-derived-summary.json#g3.stanceEvents` | **FIX → REDO** — required down count is `>=1` |
| G3 rally-then-TURRET | `50/50` rallies and switches, FRONT `1`, `35,826` pre-switch damage, `0` post-switch damage, `50/50` zero-damage conversions, `0` downs. | `node scripts/run-g3-exploit-probe.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-final-exploit.json` · output `2026-07-26T02:24:34.116440Z` | `qa/post-retune-derived-summary.json#g3.rallyThenTurret` | **FIX → REDO** |
| G7 scripted Cinder extraction | Seed `901`: window `20.62 s`, complete `23.10 s`, `2.48 s`, one accepted handoff, extracted true, victory. Seeds `902/903`: defeat before window, `0` accepted extraction, extracted false. | `node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-final-g7-scripted.json` · generated `2026-07-26T02:20:40.094Z` | `qa/post-retune-derived-summary.json#g7.scriptedCinder` | **BLOCKED → REDO** |
| G7 persistence and human proof | `0` retained victory/defeat-before/defeat-after trace-and-diff sets; `0/10` participants, `0/20` eligible re-entry decisions, `0/14` voluntary re-entries evidenced. | Artifact check · `2026-07-26T02:25:53Z` | `qa/post-retune-derived-summary.json#g7.missingRequiredEvidence` | **BLOCKED → REDO** |
| G8 proof | `0/5` direct-feature survey entries and `0/10` human-impression sessions evidenced. | Artifact check · `2026-07-26T02:25:53Z` | `qa/post-retune-derived-summary.json#g8` | **BLOCKED → REDO** |
| G5 boundary | `0` monetization surfaces introduced; no paid path, account, premium currency, ads, gacha, paid power, paid reroll, or paid recovery. | Frozen-boundary check · `2026-07-26T02:25:53Z` | `qa/post-retune-derived-summary.json#g5` | **N/A**, not PASS |

**Final gate state: G2 FIX; G3 FIX; G5 N/A; G7 BLOCKED; G8 BLOCKED. D-20260726-S2C-02 triggers mandatory REDO; no gate is promoted.**
