# Stage 2 Post-Retune Regression Matrix

run-id: `20260726-stage2-balance-agency`  
measurement window: `2026-07-26T01:48:38.430Z–01:59:56.851Z`  
classification: deterministic scripted evidence only; it is not human G7/G8 completion.

| Contract / gate | Exact measure | Method / timestamp | Durable evidence path | Status |
|---|---|---|---|---|
| Signed six-value data guardrails | `1` focused test pass, `0` failure: Cinder `gateTicks=900`; signed `7/5/4` waves; rally cooldown reduction `0`; TURRET derived FRONT `1`. | `node --test tests/stage2-balance-retune.test.mjs` · `2026-07-26T01:59:56.754Z–01:59:56.851Z` | `qa/post-retune-derived-summary.json#guardrails` | **PASS** |
| G2 Cinder pressure | `15/15` Cinder gate minima are `88.0–96.8%`, outside `55–80%`; defeat rate `0/15`; TTK `6.43–7.17 s`. | `node scripts/run-g2-margin-probe.mjs --seeds 401,402,403,404,405 --stances VANGUARD,TURRET,SPLIT --output /tmp/abyssal-s2-retune-margin.json` · output `2026-07-26T01:52:13.567Z` | `qa/post-retune-derived-summary.json#cinderMargin` | **FIX** |
| G2 archetype coverage | Five named archetypes at seeds `401–405`: `250/250` stage clears, `0` defeats; mean boss TTK ticks rusher/turtle/economy/micro/casual = `561.04/722.88/716.04/594.30/584.86`. | Five `node scripts/run-g2-archetype-rotation.mjs <archetype> --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-retune-<archetype>.json` commands · outputs `2026-07-26T01:48:38.430Z–01:48:43.514Z` | `qa/post-retune-derived-summary.json#archetypes` | **FIX** — clear count is measured but does not cure failed Cinder pressure |
| G3 targetable TURRET | TURRET FRONT `1` in `50/50` stance runs and `260` companion damage. | `node scripts/run-g3-stance-events.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-retune-stance.json` · output `2026-07-26T01:54:51.673Z` | `qa/post-retune-derived-summary.json#stance` | **PASS** |
| G3 consequential risk | VANGUARD/TURRET/SPLIT take `30,510/260/5,966` companion damage but have `0/0/0` downs across `50/50/50` runs. | Same stance command / timestamp | `qa/post-retune-derived-summary.json#stance` | **FIX** |
| G3 rally-then-Turret | Candidate arm: `50` rallies, `50` switches, FRONT `1`, `30,510` pre-switch damage, `0` post-switch damage, `0` downs. | `node scripts/run-g3-exploit-probe.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-retune-exploit.json` · output `2026-07-26T01:57:32.110Z` | `qa/post-retune-derived-summary.json#exploit` | **FIX** — original exploit prevention is not proven |
| G7 Cinder event chain | Seeds `901/902/903`: valid event order; window-to-completion `2.40/3.60/3.90 s`; one accepted `EXTRACT_ELITE` each; `3/3` extracted and victorious. | `node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-retune-g7-scripted.json` · generated `2026-07-26T01:57:39.505Z` | `qa/post-retune-derived-summary.json#extraction` | **PASS** — scripted happy path only |
| G5 boundary | No paid path, account, premium currency, ads, gacha, or paid power changed. | Frozen-boundary check · `2026-07-26T01:59:56.851Z` | `qa/post-retune-derived-summary.json#g5` | **N/A** |
| G8 novelty | No five-title frequency or human QA impression measurement. | Artifact check · `2026-07-26T01:59:56.851Z` | `qa/post-retune-derived-summary.json#g8` | **BLOCKED** |

## Unmet required evidence

| Requirement | Exact absence | Required evidence destination | Status |
|---|---|---|---|
| Symmetric matchup export | No `20` paired trials per archetype; no `45–55%` matchup result; no defined/exported `maxEV / medianEV <= 1.30`. | `qa/gate-measurements.md#g2`, `qa/playtest-report.md` | **BLOCKED** |
| G7 persistence regression | No event traces and campaign-state before/after diffs for victory, defeat after accepted extraction, and defeat before acceptance. | `qa/gate-measurements.md#g7`, `qa/playtest-report.md` | **FIX** |
| G7 human completion / re-entry | No rendered moderated `10`-participant session; no `20` eligible decisions; no `>=14` voluntary Cinder re-entries; no player-visible route evidence. | `qa/gate-measurements.md#g7`, `qa/playtest-report.md` | **BLOCKED** |
| G8 novelty proof | No scorecard, five-title survey, or human impression score `>=4/5`. | `qa/gate-measurements.md#g8` | **BLOCKED** |

---

## Final D-20260726-S2C-02 regression verdict — **REDO**

The preceding matrix is preserved as prior evidence. Final measurement window: `2026-07-26T02:20:05Z–02:25:53Z`.

| Contract / gate | Exact final measure | Method / timestamp | Durable evidence path | Status |
|---|---|---|---|---|
| Signed values / frozen boundary | `1/1` focused guardrail test passed; signed Cinder waves and stance offsets, frozen `gateTicks=900`, cooldown `0`, TURRET/VANGUARD FRONT `1/2`, stable IDs, and Cinder occupation/extraction values checked. | Focused test `2026-07-26T02:20:05Z–02:20:13Z`; source-value check `2026-07-26T02:25:53Z` | `qa/post-retune-derived-summary.json#frozenBoundaryChecks` | **PASS** for checked values |
| G2 Cinder pressure / TTK | `15` rows; gate band passes `5/15`, violations `10/15`; defeats `1/15`; measured TTK passes `14/14`, required TTK missing `1/15`. | Final margin command · output `2026-07-26T02:24:28.384984Z` | `qa/post-retune-derived-summary.json#g2.cinderMargin` | **FIX → REDO** |
| G2 archetypes | Five required campaigns executed; each is `30` successes / `2` Cinder defeats. | Five final archetype commands · outputs `2026-07-26T02:21:40.313124Z–02:21:45.210701Z` | `qa/post-retune-derived-summary.json#g2.archetypeCampaigns` | **FIX → REDO** |
| G2 matchup / EV | Qualifying paired exports `0`; EV series `0`. | Artifact check · `2026-07-26T02:25:53Z` | `qa/post-retune-derived-summary.json#g2.missingRequiredEvidence` | **REDO** |
| G3 formation | TURRET FRONT is `1/50`; VANGUARD+SPLIT has `0/100` downs and `1/100` defeats. | Final stance command · output `2026-07-26T02:24:28.724587Z` | `qa/post-retune-derived-summary.json#g3.stanceEvents` | **FIX → REDO** |
| G3 conversion exploit | `50/50` zero-damage post-switch conversions; required is `0`. | Final exploit command · output `2026-07-26T02:24:34.116440Z` | `qa/post-retune-derived-summary.json#g3.rallyThenTurret` | **FIX → REDO** |
| G7 Cinder chain | `1/3` happy paths; `2/3` fail before extraction. | Final G7 command · generated `2026-07-26T02:20:40.094Z` | `qa/post-retune-derived-summary.json#g7.scriptedCinder` | **BLOCKED → REDO** |
| G7 persistence / human proof | Required trace-and-diff sets `0`; rendered human evidence is `0/10` participants, `0/20` decisions, `0/14` re-entries. | Artifact check · `2026-07-26T02:25:53Z` | `qa/post-retune-derived-summary.json#g7.missingRequiredEvidence` | **BLOCKED → REDO** |
| G8 novelty | Required survey entries `0/5`; human impressions `0/10`. | Artifact check · `2026-07-26T02:25:53Z` | `qa/post-retune-derived-summary.json#g8` | **BLOCKED → REDO** |
| G5 commerce boundary | Monetization surfaces introduced `0`. | Frozen-boundary check · `2026-07-26T02:25:53Z` | `qa/post-retune-derived-summary.json#g5` | **N/A**, not PASS |

**Mandatory disposition: REDO.** Numeric misses and required-output/evidence omissions preserve **G2 FIX; G3 FIX; G5 N/A; G7 BLOCKED; G8 BLOCKED**.
