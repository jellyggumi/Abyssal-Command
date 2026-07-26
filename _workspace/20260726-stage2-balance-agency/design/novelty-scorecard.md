# Novelty Scorecard — Pressure-Bound Elite Extraction

**Gate state:** G8 **BLOCKED**. The candidate is defined so it can be measured; no survey frequency or human impression score exists yet, and this document makes no novelty-success claim.

```yaml
gate: G8
status: BLOCKED
candidate:
  id: pressure-bound-elite-extraction
  description: "During a live defense sortie, choose whether to leave the immediate fight, complete a timed uncontested hold, issue EXTRACT_ELITE, and carry the canonical captured companion into the next campaign state."
  required_player_actions: [move_to_occupation, survive_pressure, hold_extraction_zone, issue_EXTRACT_ELITE, confirm_persisted_companion]
  data_mirrors:
    objective_order: defense-run-simulation.js#updateObjectivePhase
    extraction_input: defense-run-simulation.js#processInput(EXTRACT_ELITE)
    cinder_tactics: defense-catalog.js#STAGE_TACTICS[cinder-span].{occupation,extraction}
    canonical_capture: campaign-state.js#captureElite
    loop_contract: design/core-loop.md#loop
survey:
  comparable_titles_required: 5
  direct_feature_frequency_max: 2
  current_titles_scored: 0
  direct_feature_frequency: null
  status: missing
impression:
  scale: [1, 5]
  aggregate: median
  required_median: 4.0
  current_scored_sessions: 0
  current_median: null
  status: missing
verification:
  source_table_complete_when: "five title rows contain a reviewed source URL, quoted/mechanical evidence, taxonomy value, reviewer, and review date"
  qa_complete_when: "ten rendered-build first-exposure sessions have raw 1–5 scores, recordings, and a computed median"
```

## Candidate boundary

The candidate is **not** merely “having companions,” “having a boss,” or “having a timed hold.” It is the player-owned sequence of combat pressure → spatial hold → explicit extraction choice → persistent canonical companion. The existing Cinder route is mechanically real in scripted simulation, but that establishes neither novelty nor player impression: `engineering/extraction-agency-analysis.md#existing-source-path`; `qa/gate-measurements.md#g7` and `#g8`.

## Before → proposed evidence state

| Evidence / data mirror | Before | Proposed | Gate interpretation |
|---|---|---|---|
| Candidate definition | absent | `pressure-bound-elite-extraction` with five required actions | Defines one falsifiable unit for comparison; it is not a novelty assertion. |
| Comparable-title frequency table | absent; `0/5` scored | five reviewed rows and direct-feature count `0–5` | Pass only if direct-feature frequency is **≤2/5**. Unknown, adjacent, and absent are not interchangeable. |
| QA impression evidence | absent; no human sessions | 10 rendered-build first exposures; median 1–5 score | Pass only if median is **≥4.0/5**; no scripted score substitutes. |
| Cinder objective data | occupation `900/180`, extraction `1000/600` | unchanged per `core-loop.md` | Candidate must be judged on the live, reachable route, not an invented novelty mechanic. |
| Cinder pressure | scripted baseline has 98% minimum gate integrity | apply only the bounded `balance-sheet.md` wave/timing retune, then re-observe | Novelty scoring is invalid if the “under pressure” premise remains a trivial 98% gate state. |

## Five-title survey protocol — missing evidence to collect

The reviewer uses the following single taxonomy for every title. **Direct** means the cited build/documentation shows all three: (1) the player chooses the interaction in a live PvE run, (2) it requires a spatial/time commitment under active combat pressure, and (3) it grants a persistent ally/companion into later play. **Adjacent** means one or two properties match; **Absent** means the source contradicts the feature; **Unknown** means the source cannot establish it. Only **Direct** increments `direct_feature_frequency`.

| Comparable title | Required source to review | Current taxonomy | Required evidence field |
|---|---|---|---|
| Arknights | [official site](https://arknights.global/) and [official store listing](https://play.google.com/store/apps/details?id=com.YoStarEN.Arknights) | `unknown` | Quote/link for operator deployment, persistent roster, and whether a live timed extraction choice exists. |
| Kingdom Rush | [official game page](https://www.ironhidegames.com/Games/kingdom-rush) and [Steam listing](https://store.steampowered.com/app/246420/Kingdom_Rush___Tower_Defense/) | `unknown` | Quote/link for tower/hero progression and whether all three direct criteria occur together. |
| Dungeon Warfare 2 | [Steam listing](https://store.steampowered.com/app/698540/Dungeon_Warfare_2/) | `unknown` | Quote/link for trap/skill persistence and live-run companion-extraction equivalence or absence. |
| Vampire Survivors | [Steam listing](https://store.steampowered.com/app/1794680/Vampire_Survivors/), [Stages](https://vampire.survivors.wiki/w/Stages), [Evolution](https://vampire.survivors.wiki/w/Evolution) | `unknown` | Quote/link for run evolution and whether a persistent ally capture is chosen under an in-run hold. |
| Hades | [official FAQ](https://www.supergiantgames.com/blog/hades-faq/) and [Steam listing](https://store.steampowered.com/app/1145360/Hades/) | `unknown` | Quote/link for boon/meta progression and whether it meets all direct criteria. |

The reviewed artifact must add a `design/trend-survey/pressure-bound-elite-extraction.md` table containing: title, source URL, accessed date, quoted evidence, taxonomy, direct boolean, reviewer, and uncertainty. A claim of `≤2/5` without all five rows is invalid.

## QA impression session — exact missing-score plan

After the approved data-only retune is applied and the G7 rendered-build route is available, run **10** independent first-exposure sessions. Each participant receives only the normal control explanation; do not describe the candidate as novel or desirable. For each participant:

1. Record one Cinder sortie in the rendered build, including the visible candidate/prompt, occupation and extraction holds, input acceptance, result, and post-return persisted `ember-cohort` state.
2. Immediately after the first completed or deliberately declined extraction opportunity, ask exactly: **“How distinctive and memorable was choosing to leave the fight to bind this elite for future runs?”** Score integer `1` (not distinctive) through `5` (very distinctive).
3. Record `participantId`, route outcome, whether the choice was visible/comprehended, integer score, recording path, and any quoted confusion. Do not convert non-comprehension into a favorable score.

QA computes the median of all ten integers. G8 can pass its impression half only at **median ≥4.0/5** and with no unresolved comprehension failure. The survey-frequency half still requires a complete 5-title table with **direct frequency ≤2/5**. Otherwise G8 remains **BLOCKED**.

## Gate conclusion

`direct_feature_frequency = null` and `impression_median = null`; both mandatory G8 measures are missing. The candidate, evidence taxonomy, sources, data mirrors, and scoring protocol are now explicit, but G8 is **BLOCKED**, not FIX or PASS, until the survey and human QA evidence exist.
