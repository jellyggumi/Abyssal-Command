# Stage 1 playtest report — preregistration shell

## Result

**NOT RUN.** No participants, sessions, ratings, comprehension results, immersion scores, repeat behavior, or defect occurrence are claimed. This document preserves the future report format so a later study cannot convert targets into observations.

## Phase 2a deterministic tactical-fixture exploit hunt — G2 bounded evidence

**Result: MEASURED — bounded simulation only.** This section records no participants, player preferences, comprehension, immersion, fairness, or human-playtest outcome. It does **not** pass G2 or any other gate: all gate statuses remain **NOT MEASURED / NOT PASSED** pending their named full artifacts and independent review.

### Reproduction tuple and commands

| field | fixed value |
|---|---|
| rules identity exposed by catalog | `defense-survivor-v1`; 60 Hz; snapshot version 4; event version 2 |
| fixture | `cinder-span`; pre-run companion loadout listed below; no rewards |
| seeds | `17`, `18`, `19` |
| input policy | every tick: queue `MOVE(IDLE)`; choose first offered skill; queue every learned skill cast; queue eligible elite extraction |
| horizon | terminal outcome or 12,000 simulation ticks |
| measurement APIs | `createDefenseRun`, `queueInput`, `advanceDefenseRun`, `getRunSnapshot`, `getRunDigest` from `defense-run-simulation.js` |
| targeted verification command | `node --test tests/defense-run-simulation.test.mjs tests/cinder-span-vertical-slice.test.mjs` (cwd: `/Users/jangyoung/orca/Abyssal-Surge`) |
| observed verification result | 18 tests, 18 passed, 0 failed; 2026-07-22 |
| replay check | complete 15-row measurement array replayed identically; FNV-1a of serialized rows: `e185f567` |

The exact measurement runner was executed as an equivalent local module-evaluator program. Re-run this exact shell block from the current simulation source root, `/Users/jangyoung/orca/Abyssal-Surge` (not the evidence workspace):

```sh
node --input-type=module <<'NODE'
import { createDefenseRun, queueInput, advanceDefenseRun, getRunSnapshot, getRunDigest, isTerminalRun } from "./defense-run-simulation.js";
const profiles = [["baseline", []], ["ember-cohort", ["ember-cohort"]], ["rift-lens", ["rift-lens"]], ["veil-vanguard", ["veil-vanguard"]], ["anchor-shard", ["anchor-shard"]]];
const seeds = [17, 18, 19];
const command = (run) => {
  const s = getRunSnapshot(run);
  if (s.growthOffer) return queueInput(run, "SKILL_SELECTED", { skillId: s.growthOffer.choices[0] });
  let next = queueInput(run, "MOVE", { octant: "IDLE" });
  for (const skillId of s.commander.skills) next = queueInput(next, "SKILL_CAST", { skillId });
  return s.eliteCandidate && !s.extracted ? queueInput(next, "EXTRACT_ELITE", { enemyId: s.eliteCandidate.enemyId }) : next;
};
const measure = ([profile, loadout], seed) => {
  let run = createDefenseRun({ stageId: "cinder-span", seed, companionLoadout: loadout });
  let critCount = 0, basicFires = 0, maxBasicCritDrought = 0, drought = 0, companionImpactDamage = 0, commanderImpactDamage = 0, skillCasts = 0, bossTtkTicks = null;
  for (let step = 0; step < 12000 && !isTerminalRun(run); step += 1) {
    run = advanceDefenseRun(command(run), 1);
    for (const e of getRunSnapshot(run).events) {
      if (e.type === "CRITICAL_HIT") critCount += 1;
      if (e.type === "WEAPON_FIRED" && e.entityId === "commander" && e.combatSource === "basic") { basicFires += 1; drought = e.critical ? 0 : drought + 1; maxBasicCritDrought = Math.max(maxBasicCritDrought, drought); }
      if (e.type === "PROJECTILE_IMPACT" && e.hit) { if (e.owner === "commander") commanderImpactDamage += e.damage; else companionImpactDamage += e.damage; }
      if (e.type === "SKILL_CAST") skillCasts += 1;
      if (e.type === "OBJECTIVE_COMPLETED" && e.objectiveId === "boss-kill") bossTtkTicks = e.bossTtkTicks;
    }
  }
  const s = getRunSnapshot(run);
  return { profile, seed, loadout, tick: s.tick, terminal: s.terminal, gateIntegrity: s.gate.integrity, commanderIntegrity: s.commander.integrity, defeated: s.progress.defeated, extracted: s.progress.extracted, skillsLearned: s.progress.skillsLearned, critCount, basicFires, maxBasicCritDrought, companionImpactDamage, commanderImpactDamage, skillCasts, bossTtkTicks, digest: getRunDigest(run).length };
};
const rows = profiles.flatMap((p) => seeds.map((seed) => measure(p, seed)));
const fnv1a = (text) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, "0"); };
console.log(JSON.stringify({ rows, fnv1a: fnv1a(JSON.stringify(rows)) }, null, 2));
NODE
```

The serialized-row schema and field order are exactly the object literal in `measure`: `profile`, `seed`, `loadout`, `tick`, `terminal`, `gateIntegrity`, `commanderIntegrity`, `defeated`, `extracted`, `skillsLearned`, `critCount`, `basicFires`, `maxBasicCritDrought`, `companionImpactDamage`, `commanderImpactDamage`, `skillCasts`, `bossTtkTicks`, `digest`.

The five fixture types below are **current authored tactical fixtures**, not the analytic Bulwark/Striker/Gambit/Conductor/Rift profiles from the balance sheet. `companion impact` includes impacts from the pre-run companion and the same eligible extracted companion; it is not an isolated initial-loadout DPS claim. `drought` counts consecutive commander basic fires without a critical; `skill casts` is not total active-skill damage.

| fixture / initial tactic | seed | terminal @ tick | gate / commander integrity | boss TTK ticks | commander / companion projectile impact damage | crits; max basic drought | skill casts |
|---|---:|---|---|---:|---:|---:|---:|
| F2A-baseline / no pre-run companion | 17 | VICTORY @ 2286 | 903 / 973 | 652 | 86040 / 7200 | 11; 18 | 5 |
| F2A-baseline / no pre-run companion | 18 | VICTORY @ 2166 | 933 / 1000 | 652 | 79560 / 7160 | 11; 13 | 4 |
| F2A-baseline / no pre-run companion | 19 | VICTORY @ 2166 | 933 / 1101 | 628 | 80100 / 7160 | 9; 28 | 0 |
| F2A-ember / `ember-cohort` | 17 | VICTORY @ 2190 | 953 / 993 | 624 | 77580 / 17700 | 11; 15 | 5 |
| F2A-ember / `ember-cohort` | 18 | VICTORY @ 2118 | 973 / 1000 | 604 | 72540 / 15140 | 10; 13 | 4 |
| F2A-ember / `ember-cohort` | 19 | VICTORY @ 2166 | 983 / 1081 | 640 | 74340 / 16820 | 8; 28 | 0 |
| F2A-rift / `rift-lens` | 17 | VICTORY @ 2094 | 953 / 993 | 528 | 73260 / 23220 | 11; 15 | 4 |
| F2A-rift / `rift-lens` | 18 | VICTORY @ 2022 | 973 / 1000 | 508 | 68220 / 21140 | 10; 13 | 4 |
| F2A-rift / `rift-lens` | 19 | VICTORY @ 2070 | 983 / 1081 | 556 | 68940 / 22520 | 7; 28 | 0 |
| F2A-veil / `veil-vanguard` | 17 | VICTORY @ 2094 | 953 / 993 | 528 | 71460 / 22140 | 11; 15 | 4 |
| F2A-veil / `veil-vanguard` | 18 | VICTORY @ 2022 | 973 / 1000 | 508 | 68220 / 19520 | 10; 13 | 4 |
| F2A-veil / `veil-vanguard` | 19 | VICTORY @ 2094 | 983 / 1081 | 556 | 70920 / 21440 | 8; 28 | 0 |
| F2A-anchor / `anchor-shard` | 17 | VICTORY @ 2111 | 953 / 993 | 545 | 71280 / 22200 | 11; 24 | 4 |
| F2A-anchor / `anchor-shard` | 18 | VICTORY @ 2023 | 973 / 1000 | 509 | 68220 / 19580 | 10; 13 | 4 |
| F2A-anchor / `anchor-shard` | 19 | VICTORY @ 2094 | 973 / 1081 | 556 | 70920 / 20720 | 8; 28 | 0 |

### Exploit-hunt outcomes and bounded inference

| check | status | bounded observation |
|---|---|---|
| replay divergence in the 15 fixed fixtures | NOT OBSERVED | the identical second pass serialized to the same 15 rows and FNV-1a `e185f567`; this is not an observer-mode differential test |
| terminal viability in this corpus | OBSERVED | all 15 fixtures reached `VICTORY`; this establishes only these seeds, stage, policy, and horizon |
| G2 five-profile parity | BLOCKED — XR-13 | the current catalog has one global crit profile and no equal-authored-budget fixture tuple for the five analytic profiles |
| total EV / cooldown EV share | BLOCKED — XR-14 | current events expose casts and projectile impacts, but not a general ordinary direct active-skill resolution |
| dominant-tactic exploit | NOT DETERMINED | unequal pre-run loadouts and the common extracted companion make any dominance inference invalid |

### Phase 2b questions

1. What exact equal-authored-budget tuple realizes each analytic Bulwark, Striker, Gambit, Conductor, and Rift profile without changing live balance numbers?
2. Which local observer-only trace supplies `baseDamage`, `finalDamage`, `target`, `source`, and `sim_tick` for every active-skill resolution so total EV and cooldown share are auditable?
3. Which ordinary, elite, and Stage-10 fixtures, fixed input tapes, and 10,000-seed critical-distribution corpus will measure target bands instead of this Stage-1 boss-only sweep?
4. Can the resulting tuple pass normal/reduced/muted and observer A/B differential replay with identical canonical checkpoints before any G2 conclusion is proposed?

```yaml
study:
  id: cinder-span-command-feedback-stage-1
  status: NOT RUN
  planned_slice_s: 90
  collection: local_opt_in_only
  network_transport: prohibited
  participant_identity_in_export: prohibited
  required_preregistration:
    - fixture_manifest
    - answer_key
    - assignment_manifest
    - missingness_policy
    - exclusion_policy
    - stopping_rule
    - consent_and_delete_path
  required_segmentation:
    - build_id
    - fixture_id
    - rules_catalog_grammar_serializer_versions
    - device_viewport
    - input_mode
    - sound_mode
    - reduced_motion
    - renderer_id
```

## Planned archetype rotation

| profile | primary question | deterministic record | moderated probe | current result |
|---|---|---|---|---|
| Bulwark | Does survivability preserve route correction rather than remove movement pressure? | health window, route correction, elite TTK | identify safe route under pressure | NOT MEASURED |
| Striker | Does high-rate automatic output remain readable without cooldown/noise overload? | event density, normal/crit distinction, movement route | distinguish normal automatic hit from critical | NOT MEASURED |
| Gambit | Are crit spikes/droughts understandable and fair by distribution, not average DPS? | draw/deck position, drought, combo p5/p50/p95 | predict event meaning from static/muted cue | NOT MEASURED |
| Conductor | Does readiness change a movement decision without falsely implying manual activation? | ready tick, active EV share, route counterfactual | state who activates and what route choice changes | NOT MEASURED |
| Rift hybrid | Does conditional payoff remain viable when targets/routes change? | combo misses, target loss, TTK, safe-lane outcome | select readable build effect and route response | NOT MEASURED |

## Planned session cells

```yaml
session_cells:
  presentation: [normal, reduced_motion_static, sound_off_captioned]
  input: [touch, keyboard, controller]
  fixed_conditions:
    - same_seed_or_counterbalanced_seed_family
    - same_catalog_and_grammar_digest
    - same_objective_and_offer_hash
    - same_clock_case
  assignment_integrity:
    expected_vs_observed_counts_required: true
    stop_comparison_on_mismatch: true
  outcome_categories:
    - correct_action
    - correct_interpretation
    - response_ms
    - safe_direction
    - player_vs_elite_or_gate_health
    - critical_vs_normal
    - cooldown_ready_and_automatic_ownership
    - choice_effect_prediction_and_recall
    - objective_and_stage_world_handoff_recall
    - optional_immersion_rating
    - voluntary_loop_reentry
    - optional_repetition_fairness_pressure_ratings
```

## Planned scenario order

1. Entry/orientation: identify W-04 Domain and W-01 signal/objective bearing from a fixed MapPlan without audio.
2. Combat readability: normal hit, forced critical, player damage, health threshold, W-03 Gate threshold, boss/elite state, and cooldown C-1/C/ready snapshots.
3. Movement/encounter: take the announced safe lane through probe, pressure, peak/fade, and a genuine relief card; no manual aiming is introduced.
4. Choice: compare all three visible mechanical options, choose a stated goal, and identify committed result. The offer/effect hashes must match across presentation cells.
5. Stage/world: explain objective/gate/result handoff using only confirmed W-01…W-05 caption/static facts; Stage 10 condition expects campaign completion, not another stage.
6. Audio/narration: repeat meaningful cues under sound on, mono, muted/captioned, missing/decode-failed local asset; rules must remain unchanged.
7. Idle return: inspect a static one-settlement receipt; explain accepted elapsed time, cap, credit, and prohibited combat effects. This is a property/understanding task, not retention evidence.

## Report table to complete only after execution

| fixture/session | mode/input | assigned/observed | valid responses | correct action | correct interpretation | immersion median | voluntary re-entry | data-quality decision | raw local evidence |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| None | — | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT RUN | N/A |

## Reporting rules

- Retain skipped/invalid/missing responses; never replace them with a success.
- Report participant data only from consented local studies and maintain participant-code linkage outside exported gameplay records.
- Do not infer boredom from movement trace, quitting, or session duration. Pair telemetry with the optional direct rating.
- Do not call an audio/caption/presentation cell a gameplay advantage: compare authoritative hashes first; then report comprehension by modality.
- A future result must link its fixture, event log, capture/caption, assignment manifest, answer key, and local export checksum under `qa/evidence/playtest/`.

Sources: `research/{telemetry-playtest-contract,qa-measurement-protocol,combat-systems-balance,wave-encounter-composition,controls-accessibility,audio-narration-direction,narrative-stage-presentation,progression-idle-economy}.md`.