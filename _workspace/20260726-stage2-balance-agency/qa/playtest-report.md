# Stage 2 Post-Retune Scripted Playtest Report

run-id: `20260726-stage2-balance-agency`
measurement window: `2026-07-26T01:48:38.430Z–01:57:39.509Z`
classification: deterministic headless simulation, **not** a human playtest.

Commands, timestamps, parsed source values, and raw-output locations are durable in `qa/post-retune-derived-summary.json`. Scripted evidence establishes deterministic behavior only; it cannot establish player comprehension, subjective impression, rendered completion, or voluntary re-entry.

## Retune guardrails: **PASS**

| Exact measurement | Method / timestamp | Evidence path | Status |
|---|---|---|---|
| Focused test: `1` pass, `0` failures. It pins Cinder `gateTicks=900`, the signed `7/5/4` wave packets, rally cooldown reduction `0`, and TURRET derived FRONT count `1`. | `node --test tests/stage2-balance-retune.test.mjs` · `2026-07-26T01:59:56.754Z–01:59:56.851Z` | `qa/post-retune-derived-summary.json#guardrails` | **PASS** |

## Cinder pressure and TTK: **FIX**

| Stance | Cinder rows | Terminal / defeats | Gate-minimum % (min–max; mean) | Boss TTK s (min–max; mean) | Required band comparison | Status |
|---|---:|---|---|---|---|---|
| VANGUARD | 5 | `5` VICTORY / `0` | `91.4–96.8; 94.00` | `6.77–7.17; 7.01` | gate target `55–80` fails all 5; TTK `5.95–8.05` passes | **FIX** |
| TURRET | 5 | `5` VICTORY / `0` | `91.4–96.0; 93.48` | `6.63–7.17; 6.97` | gate target fails all 5; TTK passes | **FIX** |
| SPLIT | 5 | `5` VICTORY / `0` | `88.0–94.0; 90.40` | `6.43–7.17; 6.78` | gate target fails all 5; TTK passes | **FIX** |

Method: `node scripts/run-g2-margin-probe.mjs --seeds 401,402,403,404,405 --stances VANGUARD,TURRET,SPLIT --output /tmp/abyssal-s2-retune-margin.json` · output `2026-07-26T01:52:13.567Z` · evidence `qa/post-retune-derived-summary.json#cinderMargin`.

The defeat-rate subcriterion is **PASS** at `0/15` (`0.00%`, target `0–20%`). The Cinder gate-minimum subcriterion is **FIX** because `15/15` rows are above `80%`; therefore G2 cannot pass even though all TTK values are in band.

## Five-archetype campaign rotation: **FIX**

| Archetype | Seeds | Stage clears / attempts | Defeats | Mean boss TTK ticks | Status |
|---|---|---:|---:|---:|---|
| rusher | 401–405 | 50 / 50 | 0 | 561.04 | **FIX** |
| turtle | 401–405 | 50 / 50 | 0 | 722.88 | **FIX** |
| economy-greed | 401–405 | 50 / 50 | 0 | 716.04 | **FIX** |
| micro-optimizer | 401–405 | 50 / 50 | 0 | 594.30 | **FIX** |
| casual | 401–405 | 50 / 50 | 0 | 584.86 | **FIX** |

Method: `node scripts/run-g2-archetype-rotation.mjs <archetype> --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-retune-<archetype>.json` · outputs `2026-07-26T01:48:38.430Z–01:48:43.514Z` · evidence `qa/post-retune-derived-summary.json#archetypes`.

The threshold count is measured (`5` archetypes; `250/250` stage clears), but the all-clear result is non-discriminating. The required symmetric export of `20` paired trials per archetype is absent, so the `45–55%` matchup and `maxEV / medianEV <= 1.30` criteria are **BLOCKED**, not inferred.

## Formation, targetability, and exploit: **FIX**

| Probe | Exact measurement | Method / timestamp | Evidence path | Status |
|---|---|---|---|---|
| Stance events | `50` runs per stance, `150/150` terminal clears, `0` companion downs. VANGUARD: FRONT `2`, rallies `50`, damage `30,510`; TURRET: FRONT `1`, rallies `50`, damage `260`; SPLIT: FRONT `1`, rallies `50`, damage `5,966`. | `node scripts/run-g3-stance-events.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-retune-stance.json` · output `2026-07-26T01:54:51.673Z` | `qa/post-retune-derived-summary.json#stance` | **FIX** — TURRET targetability is **PASS**, but no companion-down consequence appears |
| Rally-then-Turret | Candidate arm: `50/50` rallies and switches, FRONT `1`, pre-switch companion damage `30,510`, post-switch companion damage `0`, and `0` downs. The focused guardrail test pins cooldown reduction to `0`. | `node scripts/run-g3-exploit-probe.mjs --seeds 401,402,403,404,405 --output /tmp/abyssal-s2-retune-exploit.json` · output `2026-07-26T01:57:32.110Z` | `qa/post-retune-derived-summary.json#exploit` | **FIX** — zero cooldown is verified, but the old retained-rally-to-zero-post-switch-risk pattern is not proven prevented |

## Elite Extract scripted regression: **BLOCKED**

| Cinder seed | Ordered events | Window-open → completion | Accepted `EXTRACT_ELITE` | Terminal / extracted | Status |
|---:|---|---:|---:|---|
| 901 | candidate `17.30s` → window `20.70s` → completion `23.10s` → extracted `23.12s` | 2.40 s | 1 | VICTORY / true | **PASS** scripted happy path |
| 902 | candidate `17.70s` → window `21.70s` → completion `25.30s` → extracted `25.32s` | 3.60 s | 1 | VICTORY / true | **PASS** scripted happy path |
| 903 | candidate `17.83s` → window `22.20s` → completion `26.10s` → extracted `26.12s` | 3.90 s | 1 | VICTORY / true | **PASS** scripted happy path |

Method: `node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-retune-g7-scripted.json` · generated `2026-07-26T01:57:39.505Z` · evidence `qa/post-retune-derived-summary.json#extraction`.

The Cinder event order, `<10.00 s` completion window, and one accepted handoff cap are **PASS** in script. Required traces/diffs for defeat before and after acceptance are **FIX** because absent. Rendered moderated evidence (`10` participants, `20` re-entry decisions, `>=14` voluntary Cinder re-entries, and player-visible route proof) is **BLOCKED**; G7 remains blocked.

## Unmeasured human gates

| Gate | Exact missing measure | Evidence path | Status |
|---|---|---|---|
| G7 | Rendered human completion and voluntary re-entry evidence | `qa/regression-matrix.md#unmet-required-evidence` | **BLOCKED** |
| G8 | Five-title novelty frequency and human QA impression score | `qa/post-retune-derived-summary.json#g8` | **BLOCKED** |
| G5 | No monetization path is in scope or changed | `qa/post-retune-derived-summary.json#g5` | **N/A** |

---

## Final D-20260726-S2C-02 scripted remeasurement — **REDO**

This section supersedes no history: the preceding report is retained as the prior post-retune record. Final run window: `2026-07-26T02:20:05Z–02:25:53Z`; all values below are deterministic scripted results, not human playtest evidence.

| Surface | Exact final result | Method / timestamp | Durable evidence path | Outcome |
|---|---|---|---|---|
| Catalog and retained freezes | `1` focused test passed, `0` failed; signed six data changes plus Cinder IDs/occupation/extraction and frozen `900/0/1/2` values checked. | `node --test tests/stage2-balance-retune.test.mjs` · `2026-07-26T02:20:05Z–02:20:13Z`; source-value check · `2026-07-26T02:25:53Z` | `qa/post-retune-derived-summary.json#frozenBoundaryChecks` | **PASS** for values checked |
| Cinder pressure | `10/15` gate minima violate `55–80%`; row values by stance are recorded in full. `1/15` defeats and `14/14` measured TTKs `6.43–7.57 s` pass their sub-bounds, but one defeated row has no TTK. | Final margin command · output `2026-07-26T02:24:28.384984Z` | `qa/post-retune-derived-summary.json#g2.cinderMargin` | **REDO** |
| Five archetypes | Each of five mandated archetypes has `5` campaigns, `30` successes and `2` Cinder defeats at seeds `403/405`; symmetric `20`-pair-per-archetype matchup and EV files total `0`. | Five final archetype commands · outputs `2026-07-26T02:21:40.313124Z–02:21:45.210701Z`; artifact check `2026-07-26T02:25:53Z` | `qa/post-retune-derived-summary.json#g2.archetypeCampaigns`, `#g2.missingRequiredEvidence` | **REDO** |
| Formation risk | VANGUARD+SPLIT: `0/100` companion downs and `1/100` defeats; TURRET has FRONT `1/50` with `32,902` damage. | Final stance command · output `2026-07-26T02:24:28.724587Z` | `qa/post-retune-derived-summary.json#g3.stanceEvents` | **REDO** — down threshold misses |
| Rally-then-TURRET | `50/50` conversions switch after a rally, but post-switch companion damage is `0` in `50/50`. | Final exploit command · output `2026-07-26T02:24:34.116440Z` | `qa/post-retune-derived-summary.json#g3.rallyThenTurret` | **REDO** |
| Elite Extract Cinder route | Seed `901` passes at `2.48 s` window-to-completion with one handoff; seeds `902/903` defeat before opening the window and have `0` accepted extraction actions. | Final G7 command · generated `2026-07-26T02:20:40.094Z` | `qa/post-retune-derived-summary.json#g7.scriptedCinder` | **REDO** |
| Human G7/G8 evidence | Rendered moderated G7 session evidence is `0/10` participants, `0/20` decisions, `0/14` re-entries; G8 has `0/5` survey and `0/10` impression sessions. | Artifact check · `2026-07-26T02:25:53Z` | `qa/post-retune-derived-summary.json#g7.missingRequiredEvidence`, `#g8` | **BLOCKED → REDO** |

Final classification: **REDO**. Gate states remain **G2 FIX; G3 FIX; G5 N/A; G7 BLOCKED; G8 BLOCKED**.
