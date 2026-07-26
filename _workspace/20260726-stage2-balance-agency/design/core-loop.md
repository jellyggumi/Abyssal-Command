# Core Loop — Cinder Extraction Decision

**Gate state:** G7 **BLOCKED**. The scripted simulation proves a reachable event chain; it does not prove player-visible comprehension or voluntary re-entry. This document does not alter extraction data.

```yaml
gate: G7
status: BLOCKED
loop:
  id: cinder-extraction-circuit
  stage_id: cinder-span
  intended_period_s: 45
  permitted_period_s: [30, 90]
  actions_required: 4
  actions: [move_to_pressure, select_growth_or_cast_skill, choose_formation, hold_and_extract_elite]
  reward_events_required: 1
  reward_event: ELITE_EXTRACTED
  voluntary_reentry_rate_required: 0.70
  voluntary_reentry_minimum: "14 of 20 eligible human re-entry decisions"
data_mirrors:
  objective_order: defense-run-simulation.js#updateObjectivePhase
  extraction_acceptance: defense-run-simulation.js#processInput(EXTRACT_ELITE)
  cinder_occupation: defense-catalog.js#STAGE_TACTICS[cinder-span].occupation
  cinder_extraction: defense-catalog.js#STAGE_TACTICS[cinder-span].extraction
  cinder_gate_phase: defense-catalog.js#STAGES[cinder-span].gateTicks
  pressure_retune: design/balance-sheet.md#before-proposed-data-change
extraction_guardrail:
  ids_frozen: [cinder-span, s1-ember-hunter, rusher, ember-cohort]
  occupation: {radius: 900, holdTicks: 180, moveMultiplier: 1.05, rangeMultiplier: 1.08}
  extraction: {radius: 1000, windowTicks: 600, hard_floor_windowTicks: 180}
  scripted_window_to_ready_s_baseline: 2.46
  scripted_window_slack_s_baseline: 7.54
scripted_baseline:
  routes: 9
  accepted_extract_commands: 9
  completed_extractions: 9
  elite_extracted_events: 9
  cinder_completion_s: [20.10, 20.30]
  cinder_terminal_s: [26.90, 27.70]
  status: "reachability only; not human completion or re-entry"
human_evidence:
  completion_observed: false
  eligible_reentries_observed: 0
  voluntary_reentries_observed: 0
  status: missing
```

## Boundary and baseline

The engineering extraction memo establishes that Cinder's data-owned window is **600 ticks / 10.00 s** and the scripted route becomes ready **2.46 s** after the window opens, leaving **7.54 s** slack. Cinder seeds 901–903 completed the scripted chain at **20.10–20.30 s** and reached terminal victory at **26.90–27.70 s**. The baseline is an event-chain result only: `engineering/extraction-agency-analysis.md#current-evidence`; `qa/gate-measurements.md#g7`; `qa/playtest-report.md#scripted-extract-elite-route`.

## Before → proposed model

| Data / evidence surface | Before | Proposed | Why / acceptance boundary |
|---|---|---|---|
| `design/core-loop.md` numeric G7 model | absent | `cinder-extraction-circuit`, 45 s intended, 30–90 s allowed, 4 actions, 1 `ELITE_EXTRACTED` reward | Establishes the mandatory numeric loop contract; it is a measurement target, not a claim that the current UI teaches it. |
| `defense-catalog.js#STAGES[cinder-span].gateTicks` | `720` ticks | `900` ticks, per `balance-sheet.md` | Adds bounded pre-elite pressure; post-retune Cinder duration must remain inside the 30–90 s loop band. |
| `defense-catalog.js#STAGE_TACTICS[cinder-span].extraction.windowTicks` | `600` ticks | `600` ticks (freeze) | The current window is already reachable with observed slack; increasing it would dilute the decision and reducing it is unjustified before a human failure signal. |
| `...extraction.radius` | `1000` | `1000` (freeze) | Preserve the existing objective separation and player route. |
| `...occupation.radius / holdTicks` | `900 / 180` | `900 / 180` (freeze) | Preserve the precursor hold; the pressure problem is Cinder combat saturation, not missing extraction availability. |
| Player-visible extraction and return decision | not observed | 20 eligible human re-entry decisions; at least 14 voluntary re-entries | Separates a working command from the G7 behavioral threshold. |

## Verification plan

### 1. Scripted regression — reachability, not gate completion

After only the approved balance data is applied, run:

```sh
node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output /tmp/abyssal-s2-retune-g7-scripted.json
```

QA must preserve the raw output and verify for Cinder seeds `901–903`: one accepted `EXTRACT_ELITE`, `EXTRACTION_WINDOW_OPENED`, `EXTRACTION_COMPLETED`, `ELITE_EXTRACTED`, and `extracted=true` per successful route. Record candidate, window-open, ready, and event times; `window-open → ready` must be `< 10.00 s`. This pass only establishes that the balance retune did not break scripted reachability.

### 2. Required human session — the only G7 completion evidence

Run a rendered-build, moderated session with **10 human participants**, each given two independent Cinder sorties after a one-sentence control explanation. A sortie is *eligible for re-entry* only when it reaches the post-result staging choice after either extraction success or decline; no reward, reminder, or facilitator prompt may favor replay.

For each of **20** eligible decisions, retain a screen recording and observer row with:

1. visible elite candidate/prompt;
2. the participant's movement into the extraction zone;
3. visible hold-progress completion;
4. their `EXTRACT_ELITE` action accepted by the player-facing build;
5. visible `ELITE_EXTRACTED` result and persisted `ember-cohort` state after returning to staging;
6. whether the participant voluntarily starts the next Cinder circuit before ending the session.

QA reports `voluntary reentries / eligible re-entry decisions`; G7 needs **≥14/20 (70%)**. Also compute the circuit duration from first actionable movement to result/staging return and require every completed circuit to lie in **30–90 s**. A lower rate, missing evidence step, or a player-visible failure leaves G7 **BLOCKED** (or **FIX** only after the director records the evidence gap as remediable).

## Gate conclusion

The loop model and reachability-preserving data freeze are established. G7 remains **BLOCKED** because the baseline has **0** observed human completions and **0/0** voluntary re-entry decisions. Scripted 9/9 completion must never be relabeled as the required ≥70% human re-entry result.
