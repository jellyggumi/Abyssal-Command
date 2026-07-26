# G2 adversarial tape v1 — measurement-control contract

```yaml
schema_version: g2-adversarial-tape-control-contract/1
contract_id: g2-adversarial-tape-v1
run_id: 20260725-defense-rpg-development
status: PREPARATION_ONLY_UNMEASURED
owner: game-designer
purpose: >-
  Freeze the public-input control policy and finite population required to make
  G2 measurable. This contract changes no simulation rule, catalog value,
  campaign state, reward, asset, or gate status.

source_evidence:
  authorization:
    path: _workspace/20260725-defense-rpg-development/pm/negotiation-record.md#authorization_b
    facts:
      - input_only
      - tuple_matrix_5_archetypes_x_10_stages_x_3_seeds
      - duplicate_replay_byte_stable
      - no_renderer_audio_wall_clock_random_or_direct_authority_write
  design_matrix:
    path: _workspace/20260725-defense-rpg-development/design/balance-sheet.md#x-01
    facts:
      - tape_id_g2-adversarial-tape-v1
      - required_archetypes_and_stages
      - seeds_301_302_303
  historical_archetypes:
    path: scripts/run-g2-archetype-rotation.mjs#ARCHETYPES
  historical_input_loop:
    path: scripts/run-g2-archetype-rotation.mjs#queueObjectiveCommands
    source_lines: [35, 36, 37, 38, 39, 40]
    queued_inputs:
      - {type: SKILL_SELECTED, payload: skillId, source_line: 36}
      - {type: MOVE, payload: octant, source_line: 37}
      - {type: SKILL_CAST, payload: skillId, source_line: 38}
      - {type: EXTRACT_ELITE, payload: enemyId, source_line: 39}
  historical_terminal_cap:
    path: scripts/run-g2-archetype-rotation.mjs#driveBattleToTerminal
    source_lines: [42, 43, 44, 45]
    max_steps: 20000
  stages_and_routes:
    path: defense-catalog.js#STAGES_and_STAGE_TACTICS
  public_api:
    path: defense-run-simulation.js#createDefenseRun_queueInput_advanceDefenseRun_getRunSnapshot_isTerminalRun_getRunDigest
    queueInput_source_lines: [1899, 1900, 1901, 1902, 1903, 1904]
    processInput_source_lines: [844, 847, 848, 849, 850, 854, 855, 856, 857, 858, 859, 866, 869, 870, 894, 925, 926, 927, 928, 929, 930]
    snapshot_source_lines: [1949, 1953, 1957, 1969, 1971, 1974, 1981, 1983, 1985, 1986, 1990, 1991, 1993, 2002]
  simulation_events:
    path: defense-run-simulation.js
    source_lines:
      - {event: BOSS_SPAWNED, line: 369}
      - {event: GROWTH_OFFER, line: 628}
      - {event: ELITE_CANDIDATE_AVAILABLE, line: 966}
      - {event: OBJECTIVE_PHASE_CHANGED, line: 1254}
      - {event: STAGE_STARTED, line: 1880}
      - {event: INPUT_ACCEPTED, line: 925}
      - {event: INPUT_REJECTED, line: 925}
  growth_offer_construction:
    path: defense-run-simulation.js#makeOffer
    source_lines: [617, 620, 621, 622, 623, 624, 625, 627, 628]
    facts:
      - choices_are_drawn_from_public_unowned_skill_ids
      - choices_are_removed_from_available_after_each_draw
      - a_three_choice_offer_has_three_distinct_skill_ids
  canonical_serialization:
    path: g2-full-route-runner.js#canonicalStringify_sha256_checksumRecord

public_api_only:
  allowed_calls:
    - createDefenseRun
    - queueInput
    - advanceDefenseRun
    - getRunSnapshot
    - isTerminalRun
    - getRunDigest
  queueable_input_types:
    - MOVE
    - SKILL_CAST
    - SKILL_SELECTED
    - EXTRACT_ELITE
    - STANCE_CYCLE
  queueable_input_evidence:
    historical_runner: [MOVE, SKILL_CAST, SKILL_SELECTED, EXTRACT_ELITE]
    simulation_only:
      STANCE_CYCLE:
        source: defense-run-simulation.js#queueInput_processInput
        source_lines: [1900, 854, 855, 856, 857, 858, 859]
        payload: null
        acceptance_precondition: snapshot.tick >= snapshot.stanceCooldownUntilTick
    payload_contracts:
      MOVE: {payload: {octant: "one of NW,N,NE,W,IDLE,E,SW,S,SE"}, source_lines: [849, 850]}
      SKILL_CAST: {payload: {skillId: public_skill_id}, source_lines: [869, 870]}
      SKILL_SELECTED: {payload: {skillId: "snapshot.growthOffer.choices[index]"}, source_lines: [866, 867]}
      EXTRACT_ELITE: {payload: {enemyId: "snapshot.eliteCandidate.enemyId"}, source_lines: [894, 895, 896, 897, 898]}
  prohibited_control_surfaces:
    - DOMAIN_AVAILABLE
    - DOMAIN_OCCUPY
    - direct_run_mutation
    - direct_catalog_mutation
    - direct_campaign_storage_write
    - renderer_state_read
    - audio_state_read
    - wall_clock_read
    - runtime_randomness
  unknown_public_surface:
    trigger: any_policy_rule_names_an_action_event_snapshot_field_or_call_not_listed_in_this_contract_source_evidence
    disposition: FAIL_UNKNOWN_PUBLIC_SURFACE
    tuple_status: INVALID_UNKNOWN_PUBLIC_SURFACE
  rejected_control_surface_disposition:
    DOMAIN_AVAILABLE:
      status: REJECTED_UNAVAILABLE_PUBLIC_EVENT
      substitute: null
    DOMAIN_OCCUPY:
      status: REJECTED_UNAVAILABLE_PUBLIC_INPUT
      substitute: null
    REWARD_SELECTED:
      status: NOT_QUEUED
      reason: terminal reward selection is outside authorization_b input-only measurement boundary

finite_population:
  archetypes:
    - rusher
    - turtle
    - economy-greed
    - micro-optimizer
    - casual
  stage_ids:
    - cinder-span
    - veil-citadel
    - echo-throne
    - sunken-bastion
    - howling-sprawl
    - glass-necropolis
    - starless-canal
    - shattered-causeway
    - abyss-chancel
    - gate-zenith
  seeds: [301, 302, 303]
  tuple_count: 150
  expansion: FORBIDDEN
  tuples:
    - rusher/cinder-span/301
    - rusher/cinder-span/302
    - rusher/cinder-span/303
    - rusher/veil-citadel/301
    - rusher/veil-citadel/302
    - rusher/veil-citadel/303
    - rusher/echo-throne/301
    - rusher/echo-throne/302
    - rusher/echo-throne/303
    - rusher/sunken-bastion/301
    - rusher/sunken-bastion/302
    - rusher/sunken-bastion/303
    - rusher/howling-sprawl/301
    - rusher/howling-sprawl/302
    - rusher/howling-sprawl/303
    - rusher/glass-necropolis/301
    - rusher/glass-necropolis/302
    - rusher/glass-necropolis/303
    - rusher/starless-canal/301
    - rusher/starless-canal/302
    - rusher/starless-canal/303
    - rusher/shattered-causeway/301
    - rusher/shattered-causeway/302
    - rusher/shattered-causeway/303
    - rusher/abyss-chancel/301
    - rusher/abyss-chancel/302
    - rusher/abyss-chancel/303
    - rusher/gate-zenith/301
    - rusher/gate-zenith/302
    - rusher/gate-zenith/303
    - turtle/cinder-span/301
    - turtle/cinder-span/302
    - turtle/cinder-span/303
    - turtle/veil-citadel/301
    - turtle/veil-citadel/302
    - turtle/veil-citadel/303
    - turtle/echo-throne/301
    - turtle/echo-throne/302
    - turtle/echo-throne/303
    - turtle/sunken-bastion/301
    - turtle/sunken-bastion/302
    - turtle/sunken-bastion/303
    - turtle/howling-sprawl/301
    - turtle/howling-sprawl/302
    - turtle/howling-sprawl/303
    - turtle/glass-necropolis/301
    - turtle/glass-necropolis/302
    - turtle/glass-necropolis/303
    - turtle/starless-canal/301
    - turtle/starless-canal/302
    - turtle/starless-canal/303
    - turtle/shattered-causeway/301
    - turtle/shattered-causeway/302
    - turtle/shattered-causeway/303
    - turtle/abyss-chancel/301
    - turtle/abyss-chancel/302
    - turtle/abyss-chancel/303
    - turtle/gate-zenith/301
    - turtle/gate-zenith/302
    - turtle/gate-zenith/303
    - economy-greed/cinder-span/301
    - economy-greed/cinder-span/302
    - economy-greed/cinder-span/303
    - economy-greed/veil-citadel/301
    - economy-greed/veil-citadel/302
    - economy-greed/veil-citadel/303
    - economy-greed/echo-throne/301
    - economy-greed/echo-throne/302
    - economy-greed/echo-throne/303
    - economy-greed/sunken-bastion/301
    - economy-greed/sunken-bastion/302
    - economy-greed/sunken-bastion/303
    - economy-greed/howling-sprawl/301
    - economy-greed/howling-sprawl/302
    - economy-greed/howling-sprawl/303
    - economy-greed/glass-necropolis/301
    - economy-greed/glass-necropolis/302
    - economy-greed/glass-necropolis/303
    - economy-greed/starless-canal/301
    - economy-greed/starless-canal/302
    - economy-greed/starless-canal/303
    - economy-greed/shattered-causeway/301
    - economy-greed/shattered-causeway/302
    - economy-greed/shattered-causeway/303
    - economy-greed/abyss-chancel/301
    - economy-greed/abyss-chancel/302
    - economy-greed/abyss-chancel/303
    - economy-greed/gate-zenith/301
    - economy-greed/gate-zenith/302
    - economy-greed/gate-zenith/303
    - micro-optimizer/cinder-span/301
    - micro-optimizer/cinder-span/302
    - micro-optimizer/cinder-span/303
    - micro-optimizer/veil-citadel/301
    - micro-optimizer/veil-citadel/302
    - micro-optimizer/veil-citadel/303
    - micro-optimizer/echo-throne/301
    - micro-optimizer/echo-throne/302
    - micro-optimizer/echo-throne/303
    - micro-optimizer/sunken-bastion/301
    - micro-optimizer/sunken-bastion/302
    - micro-optimizer/sunken-bastion/303
    - micro-optimizer/howling-sprawl/301
    - micro-optimizer/howling-sprawl/302
    - micro-optimizer/howling-sprawl/303
    - micro-optimizer/glass-necropolis/301
    - micro-optimizer/glass-necropolis/302
    - micro-optimizer/glass-necropolis/303
    - micro-optimizer/starless-canal/301
    - micro-optimizer/starless-canal/302
    - micro-optimizer/starless-canal/303
    - micro-optimizer/shattered-causeway/301
    - micro-optimizer/shattered-causeway/302
    - micro-optimizer/shattered-causeway/303
    - micro-optimizer/abyss-chancel/301
    - micro-optimizer/abyss-chancel/302
    - micro-optimizer/abyss-chancel/303
    - micro-optimizer/gate-zenith/301
    - micro-optimizer/gate-zenith/302
    - micro-optimizer/gate-zenith/303
    - casual/cinder-span/301
    - casual/cinder-span/302
    - casual/cinder-span/303
    - casual/veil-citadel/301
    - casual/veil-citadel/302
    - casual/veil-citadel/303
    - casual/echo-throne/301
    - casual/echo-throne/302
    - casual/echo-throne/303
    - casual/sunken-bastion/301
    - casual/sunken-bastion/302
    - casual/sunken-bastion/303
    - casual/howling-sprawl/301
    - casual/howling-sprawl/302
    - casual/howling-sprawl/303
    - casual/glass-necropolis/301
    - casual/glass-necropolis/302
    - casual/glass-necropolis/303
    - casual/starless-canal/301
    - casual/starless-canal/302
    - casual/starless-canal/303
    - casual/shattered-causeway/301
    - casual/shattered-causeway/302
    - casual/shattered-causeway/303
    - casual/abyss-chancel/301
    - casual/abyss-chancel/302
    - casual/abyss-chancel/303
    - casual/gate-zenith/301
    - casual/gate-zenith/302
    - casual/gate-zenith/303

initial_options:
  createDefenseRun:
    stageId: tuple.stage_id
    seed: tuple.seed
    companionLoadout: []
    rewardIds: []
    measurementProfileId: null
    wardenProgress: null
    wardenEquipment: {}
    companionEquipment: {}
    formation: {}
  static_snapshot_expectations:
    formationStance: VANGUARD
    commander.move: IDLE
    growthOffer: null
    eliteCandidate: null
    terminal: null
  archetype_interpretation:
    status: INPUT_ONLY_DETERMINISTIC_POLICY
    policy_source: archetype_policies
    boundary: >-
      Every archetype differs only by policy-selected queueInput requests derived
      from public snapshots/events. No policy changes initial options, catalog,
      campaign, reward, asset, renderer, audio, or randomness.

route_directives:
  movement_projection:
    input: [snapshot.commander.x, snapshot.commander.y, target.x, target.y]
    dx: target.x - snapshot.commander.x
    dy: target.y - snapshot.commander.y
    epsilon: 0
    octant_by_sign:
      dx_negative_dy_negative: NW
      dx_zero_dy_negative: N
      dx_positive_dy_negative: NE
      dx_negative_dy_zero: W
      dx_zero_dy_zero: IDLE
      dx_positive_dy_zero: E
      dx_negative_dy_positive: SW
      dx_zero_dy_positive: S
      dx_positive_dy_positive: SE
    tie_break: SIGN_OF_DX_THEN_SIGN_OF_DY; zero_is_exact_numeric_equality
  directive_ids:
    - id: SAFE_CHOKE
      target:
        x: snapshot.stageLayout.chokepath.x
        y: snapshot.commander.y
      source_fields: [snapshot.stageLayout.chokepath.x, snapshot.commander.x, snapshot.commander.y]
    - id: COUNTER_FLANK
      target:
        x: snapshot.stageLayout.flank.entryX
        y: snapshot.stageLayout.flank.entryY
      source_fields: [snapshot.stageLayout.flank.entryX, snapshot.stageLayout.flank.entryY, snapshot.commander.x, snapshot.commander.y]
    - id: GATE_INTERCEPT
      target:
        x: snapshot.gate.x
        y: snapshot.gate.y
      source_fields: [snapshot.gate.x, snapshot.gate.y, snapshot.commander.x, snapshot.commander.y]
    - id: OCCUPATION_ALIAS
      target:
        x: snapshot.stageLayout.occupationPoint.x
        y: snapshot.stageLayout.occupationPoint.y
      source_fields: [snapshot.stageLayout.occupationPoint.x, snapshot.stageLayout.occupationPoint.y, snapshot.commander.x, snapshot.commander.y]
    - id: BIND_ROUTE
      target:
        x: snapshot.stageLayout.extractionPoint.x
        y: snapshot.stageLayout.extractionPoint.y
      source_fields: [snapshot.stageLayout.extractionPoint.x, snapshot.stageLayout.extractionPoint.y, snapshot.commander.x, snapshot.commander.y]
  per_stage:
    cinder-span: {safe_route_id: SAFE_CHOKE, counter_route_id: COUNTER_FLANK, occupation_alias_id: OCCUPATION_ALIAS, bind_route_id: BIND_ROUTE}
    veil-citadel: {safe_route_id: SAFE_CHOKE, counter_route_id: COUNTER_FLANK, occupation_alias_id: OCCUPATION_ALIAS, bind_route_id: BIND_ROUTE}
    echo-throne: {safe_route_id: SAFE_CHOKE, counter_route_id: COUNTER_FLANK, occupation_alias_id: OCCUPATION_ALIAS, bind_route_id: BIND_ROUTE}
    sunken-bastion: {safe_route_id: SAFE_CHOKE, counter_route_id: COUNTER_FLANK, occupation_alias_id: OCCUPATION_ALIAS, bind_route_id: BIND_ROUTE}
    howling-sprawl: {safe_route_id: SAFE_CHOKE, counter_route_id: COUNTER_FLANK, occupation_alias_id: OCCUPATION_ALIAS, bind_route_id: BIND_ROUTE}
    glass-necropolis: {safe_route_id: SAFE_CHOKE, counter_route_id: COUNTER_FLANK, occupation_alias_id: OCCUPATION_ALIAS, bind_route_id: BIND_ROUTE}
    starless-canal: {safe_route_id: SAFE_CHOKE, counter_route_id: COUNTER_FLANK, occupation_alias_id: OCCUPATION_ALIAS, bind_route_id: BIND_ROUTE}
    shattered-causeway: {safe_route_id: SAFE_CHOKE, counter_route_id: COUNTER_FLANK, occupation_alias_id: OCCUPATION_ALIAS, bind_route_id: BIND_ROUTE}
    abyss-chancel: {safe_route_id: SAFE_CHOKE, counter_route_id: COUNTER_FLANK, occupation_alias_id: OCCUPATION_ALIAS, bind_route_id: BIND_ROUTE}
    gate-zenith: {safe_route_id: SAFE_CHOKE, counter_route_id: COUNTER_FLANK, occupation_alias_id: OCCUPATION_ALIAS, bind_route_id: BIND_ROUTE}
  threat_policy_priority:
    - gate-pressure
    - low-hp-focus
    - flank
    - player-pursuit
    - resource-denial
    - elite-escort
  threat_selection:
    eligible: snapshot.enemies where enemy.policyId is in threat_policy_priority
    primary_order: threat_policy_priority_index_ascending
    tie_break: enemy.id_lexicographic_ascending
    route:
      flank: COUNTER_FLANK
      gate-pressure: GATE_INTERCEPT
      low-hp-focus: GATE_INTERCEPT
      player-pursuit: GATE_INTERCEPT
      resource-denial: GATE_INTERCEPT
      elite-escort: GATE_INTERCEPT

occupation_alias:
  id: ONLY_LEGAL_OCCUPATION_ALIAS
  observed_event:
    type: OBJECTIVE_PHASE_CHANGED
    predicate: event.objectiveId == occupation
  action: MOVE
  directive_id: OCCUPATION_ALIAS
  forbidden_substitutes: [DOMAIN_AVAILABLE, DOMAIN_OCCUPY]
  completion_observation: snapshot.occupationProgress

common_controls:
  evaluation_clock: simulation_tick_only
  snapshot_source: getRunSnapshot
  public_inputs_only: true
  state_memory:
    allowed: [observed_eventId_set, accepted_or_rejected_inputId_set, bind_request_phase, boss_cast_cursor]
    forbidden: [wall_clock, random_value, renderer_state, audio_state, campaign_state, catalog_state, direct_run_write]
  event_deduplication: event.eventId; if absent_or_duplicate_then_FAIL_EVENT_ID_UNAVAILABLE
  action_limit_per_snapshot: 1
  common_action_priority_descending:
    - TERMINAL_NO_OP
    - GROWTH_OFFER_CARDINALITY_CHECK
    - OCCUPATION_ALIAS_MOVE
    - BIND_REQUEST
    - BIND_READY_REQUEST
    - BIND_ROUTE
    - BOSS_CAST
  trigger_rules:
    - id: TERMINAL_NO_OP
      predicate: snapshot.terminal != null
      requested_action: null
      directive: NO_OP
      disposition: record_terminal_and_stop
    - id: GROWTH_OFFER_CARDINALITY_CHECK
      trigger: {event_type: GROWTH_OFFER}
      predicate: snapshot.growthOffer != null and snapshot.growthOffer.choices.length == 3 and snapshot.growthOffer.choices[0] != snapshot.growthOffer.choices[1] and snapshot.growthOffer.choices[0] != snapshot.growthOffer.choices[2] and snapshot.growthOffer.choices[1] != snapshot.growthOffer.choices[2]
      requested_action: null
      disposition: enable_exactly_one_archetype_growth_selection_rule
      rejected_if: snapshot.growthOffer.choices.length != 3 or snapshot.growthOffer.choices[0] == snapshot.growthOffer.choices[1] or snapshot.growthOffer.choices[0] == snapshot.growthOffer.choices[2] or snapshot.growthOffer.choices[1] == snapshot.growthOffer.choices[2]
      rejection_code: FAIL_GROWTH_OFFER_SHAPE_OR_DUPLICATE
    - id: BIND_REQUEST
      trigger: {event_type: ELITE_CANDIDATE_AVAILABLE}
      predicate: snapshot.eliteCandidate != null and snapshot.extracted == false
      requested_action: EXTRACT_ELITE
      payload: {enemyId: snapshot.eliteCandidate.enemyId}
      phase_transition: INITIAL_REQUESTED
      once_per: elite_candidate_eventId
    - id: BIND_ROUTE
      trigger: {snapshot_condition: snapshot.objectives.phase == extraction and snapshot.eliteCandidate != null and snapshot.extracted == false and snapshot.extractionProgress.ready == false}
      requested_action: MOVE
      directive_id: BIND_ROUTE
      phase_transition: ROUTING
    - id: BIND_READY_REQUEST
      trigger: {snapshot_transition: snapshot.extractionProgress.ready false_to_true}
      predicate: snapshot.eliteCandidate != null and snapshot.extracted == false
      requested_action: EXTRACT_ELITE
      payload: {enemyId: snapshot.eliteCandidate.enemyId}
      phase_transition: READY_REQUESTED
      once_per: elite_candidate_eventId
    - id: OCCUPATION_ALIAS_MOVE
      trigger: {event_type: OBJECTIVE_PHASE_CHANGED, objectiveId: occupation}
      requested_action: MOVE
      directive_id: OCCUPATION_ALIAS
      once_per: objective_phase_eventId
    - id: BOSS_CAST
      trigger: {event_type: BOSS_SPAWNED}
      predicate: snapshot.commander.skills.length > boss_cast_cursor
      requested_action: SKILL_CAST
      payload: {skillId: "snapshot.commander.skills.sort_lexicographically[boss_cast_cursor]"}
      cursor_rule: increment_cursor_after_input_receipt_regardless_of_acceptance
      recurrence: one_skill_cast_attempt_per_snapshot_until_each_snapshot.commander.skills_has_been_attempted_once
  common_vs_policy_dispatch:
    order: terminal_then_growth_cardinality_check_then_highest_priority_common_action_then_highest_priority_archetype_action
    simultaneous_action_tie_break: common_action_priority_descending_then_archetype_policy.rule_priority_descending
    no_eligible_action: queue_nothing_and_advance_exactly_one_tick
    unknown_rule_action_event_snapshot_field_or_call: FAIL_UNKNOWN_PUBLIC_SURFACE

archetype_policies:
  shared:
    selection_domain:
      events: snapshot.events
      fields: [snapshot.tick, snapshot.commander, snapshot.growthOffer, snapshot.formationStance, snapshot.stanceCooldownUntilTick, snapshot.enemies, snapshot.stageLayout, snapshot.gate]
    movement_payload: {type: MOVE, octant: route_directives.movement_projection}
    threat_selection:
      eligible: snapshot.enemies where enemy.policyId is in route_directives.threat_policy_priority
      primary_order: route_directives.threat_policy_priority_index_ascending
      tie_break: enemy.id_lexicographic_ascending
    growth_offer_precondition: snapshot.growthOffer != null and snapshot.growthOffer.choices.length == 3 and snapshot.growthOffer.choices[0] != snapshot.growthOffer.choices[1] and snapshot.growthOffer.choices[0] != snapshot.growthOffer.choices[2] and snapshot.growthOffer.choices[1] != snapshot.growthOffer.choices[2]
    growth_offer_tie_break: original_public_choice_index_ascending
    policy_rule_contract:
      trigger: public_snapshot_or_event_only
      action: one_of_public_api_only.queueable_input_types
      state_value_mutation: forbidden
      priority: fixed_descending_list_order
      no_matching_rule: queue_nothing
  rusher:
    delta: gate-directed movement and first offered growth skill
    rule_priority_descending: [RUSHER_GROWTH_SELECTION, RUSHER_STAGE_START_MOVE, RUSHER_THREAT_MOVE, RUSHER_IDLE_MOVE]
    rules:
      - {id: RUSHER_GROWTH_SELECTION, trigger: unprocessed_GROWTH_OFFER_event_and_shared.growth_offer_precondition, requested_action: SKILL_SELECTED, payload: {skillId: "snapshot.growthOffer.choices[0]"}, choice_rule: public_choice_index_0, tie_break: original_public_choice_index_ascending}
      - {id: RUSHER_STAGE_START_MOVE, trigger: unprocessed_STAGE_STARTED_event, requested_action: MOVE, directive_id: GATE_INTERCEPT, tie_break: eventId_lexicographic_ascending}
      - {id: RUSHER_THREAT_MOVE, trigger: shared.threat_selection_has_result, requested_action: MOVE, directive_id: GATE_INTERCEPT, tie_break: shared.threat_selection.tie_break}
      - {id: RUSHER_IDLE_MOVE, trigger: no_higher_priority_rusher_rule, requested_action: MOVE, directive_id: GATE_INTERCEPT, tie_break: directive_id_lexicographic_ascending}
  turtle:
    delta: choke-directed movement, second offered growth skill, and one public stance transition from VANGUARD
    rule_priority_descending: [TURTLE_GROWTH_SELECTION, TURTLE_STAGE_START_MOVE, TURTLE_STANCE_CYCLE, TURTLE_THREAT_MOVE, TURTLE_IDLE_MOVE]
    rules:
      - {id: TURTLE_GROWTH_SELECTION, trigger: unprocessed_GROWTH_OFFER_event_and_shared.growth_offer_precondition, requested_action: SKILL_SELECTED, payload: {skillId: "snapshot.growthOffer.choices[1]"}, choice_rule: public_choice_index_1, tie_break: original_public_choice_index_ascending}
      - {id: TURTLE_STAGE_START_MOVE, trigger: unprocessed_STAGE_STARTED_event, requested_action: MOVE, directive_id: SAFE_CHOKE, tie_break: eventId_lexicographic_ascending}
      - {id: TURTLE_STANCE_CYCLE, trigger: snapshot.formationStance == VANGUARD and snapshot.tick >= snapshot.stanceCooldownUntilTick, requested_action: STANCE_CYCLE, payload: null, choice_rule: cycle_once_from_public_VANGUARD_state, tie_break: no_payload}
      - {id: TURTLE_THREAT_MOVE, trigger: shared.threat_selection_has_result, requested_action: MOVE, directive_id: SAFE_CHOKE, tie_break: shared.threat_selection.tie_break}
      - {id: TURTLE_IDLE_MOVE, trigger: no_higher_priority_turtle_rule, requested_action: MOVE, directive_id: SAFE_CHOKE, tie_break: directive_id_lexicographic_ascending}
  economy-greed:
    delta: occupation-directed movement and third offered growth skill
    rule_priority_descending: [ECONOMY_GROWTH_SELECTION, ECONOMY_STAGE_START_MOVE, ECONOMY_THREAT_MOVE, ECONOMY_IDLE_MOVE]
    rules:
      - {id: ECONOMY_GROWTH_SELECTION, trigger: unprocessed_GROWTH_OFFER_event_and_shared.growth_offer_precondition, requested_action: SKILL_SELECTED, payload: {skillId: "snapshot.growthOffer.choices[2]"}, choice_rule: public_choice_index_2, tie_break: original_public_choice_index_ascending}
      - {id: ECONOMY_STAGE_START_MOVE, trigger: unprocessed_STAGE_STARTED_event, requested_action: MOVE, directive_id: OCCUPATION_ALIAS, tie_break: eventId_lexicographic_ascending}
      - {id: ECONOMY_THREAT_MOVE, trigger: shared.threat_selection_has_result, requested_action: MOVE, directive_id: OCCUPATION_ALIAS, tie_break: shared.threat_selection.tie_break}
      - {id: ECONOMY_IDLE_MOVE, trigger: no_higher_priority_economy_rule, requested_action: MOVE, directive_id: OCCUPATION_ALIAS, tie_break: directive_id_lexicographic_ascending}
  micro-optimizer:
    delta: lexicographically minimum offered skill and flank-directed movement
    rule_priority_descending: [MICRO_GROWTH_SELECTION, MICRO_STAGE_START_MOVE, MICRO_THREAT_MOVE, MICRO_IDLE_MOVE]
    rules:
      - {id: MICRO_GROWTH_SELECTION, trigger: unprocessed_GROWTH_OFFER_event_and_shared.growth_offer_precondition, requested_action: SKILL_SELECTED, payload: {skillId: "minimum_lexicographic(snapshot.growthOffer.choices)"}, choice_rule: lexicographic_skill_id_ascending, tie_break: original_public_choice_index_ascending}
      - {id: MICRO_STAGE_START_MOVE, trigger: unprocessed_STAGE_STARTED_event, requested_action: MOVE, directive_id: COUNTER_FLANK, tie_break: eventId_lexicographic_ascending}
      - {id: MICRO_THREAT_MOVE, trigger: shared.threat_selection_has_result, requested_action: MOVE, directive_id: COUNTER_FLANK, tie_break: shared.threat_selection.tie_break}
      - {id: MICRO_IDLE_MOVE, trigger: no_higher_priority_micro_rule, requested_action: MOVE, directive_id: COUNTER_FLANK, tie_break: directive_id_lexicographic_ascending}
  casual:
    delta: deterministic tick-indexed growth skill, initial IDLE command, and 120-tick choke refresh
    rule_priority_descending: [CASUAL_GROWTH_SELECTION, CASUAL_STAGE_START_IDLE, CASUAL_CADENCE_MOVE]
    rules:
      - {id: CASUAL_GROWTH_SELECTION, trigger: unprocessed_GROWTH_OFFER_event_and_shared.growth_offer_precondition, requested_action: SKILL_SELECTED, payload: {skillId: "snapshot.growthOffer.choices[snapshot.tick modulo 3]"}, choice_rule: public_tick_modulo_3_choice_index, tie_break: original_public_choice_index_ascending}
      - {id: CASUAL_STAGE_START_IDLE, trigger: unprocessed_STAGE_STARTED_event, requested_action: MOVE, payload: {octant: IDLE}, choice_rule: fixed_public_octant_IDLE, tie_break: eventId_lexicographic_ascending}
      - {id: CASUAL_CADENCE_MOVE, trigger: snapshot.tick modulo 120 == 0, requested_action: MOVE, directive_id: SAFE_CHOKE, choice_rule: fixed_public_tick_cadence, tie_break: directive_id_lexicographic_ascending}

input_receipt_policy:
  required_for_every_queued_input:
    - tick
    - event_trigger
    - requested_action
    - accepted_action
    - rejection_reason
    - position_or_target_directive
    - inputId
    - inputType
  authoritative_receipt_events: [INPUT_ACCEPTED, INPUT_REJECTED]
  accepted_action: receipt.inputType when receipt.type == INPUT_ACCEPTED else null
  rejection_reason: receipt.reason when receipt.type == INPUT_REJECTED else null
  queue_failure: FAIL_PUBLIC_INPUT_UNAVAILABLE
  unexpected_rejection: record_rejection_then_fail_tuple
  expected_rejection:
    trigger_rule_id: BIND_REQUEST
    reason: EXTRACTION_HOLD_INCOMPLETE
    disposition: record_rejection_and_transition_to_ROUTING
  all_other_rejections: record_rejection_then_fail_tuple
  no_op_records:
    terminal: {requested_action: null, accepted_action: null, rejection_reason: null, position_or_target_directive: NO_OP}
    unavailable_domain: {requested_action: null, accepted_action: null, rejection_reason: UNAVAILABLE_CONTROL_SURFACE, position_or_target_directive: null}

evidence_schema:
  tuple_identity: [rules_version, tape_id, tape_hash, stage, seed, archetype, duplicate_replay_hash]
  accepted_input_rows: [tick, event_trigger, requested_action, accepted_action, rejection_reason, position_or_target_directive]
  terminal_and_balance: [tuple_status, steps_executed, terminal_outcome, terminal_cause, minimum_gate_integrity, minimum_warden_integrity, boss_spawn_tick, boss_defeat_tick, boss_ttk_ticks, ordered_accepted_action_classes, combo_ev_max_over_median]
  offer_and_item_boundary: [growth_offer_id, growth_option_ids, growth_accepted_selection_count, run_item_opportunity_count, run_item_scope, run_item_campaign_write_count]
  extraction_boundary: [elite_candidate_tick, bind_requested_tick, bind_terminal_outcome, elite_extracted_tick, accepted_extraction_handoff_count, companion_campaign_write_count]
  state_boundaries: [catalog_snapshot_hash_before, catalog_snapshot_hash_after, run_state_hash_before, run_state_hash_after, campaign_state_hash_before, campaign_state_hash_after, persistent_write_families]
  derivations:
    steps_executed: count_of_calls_to_advanceDefenseRun_for_tuple
    tuple_status:
      terminal_before_or_at_engineering_ceiling: TERMINAL_RECORDED
      steps_executed_equals_20000_and_final_snapshot.terminal_is_null: INVALID_TIMEOUT
      otherwise: FAIL_EXECUTION_PROTOCOL
    terminal_outcome: final_snapshot.terminal when tuple_status == TERMINAL_RECORDED else null
    terminal_cause: TIMEOUT_ENGINEERING_CEILING when tuple_status == INVALID_TIMEOUT else final_TERMINAL_event.objectiveId when tuple_status == TERMINAL_RECORDED else null
    minimum_gate_integrity: minimum_of_all_observed_snapshot.gate.integrity
    minimum_warden_integrity: minimum_of_all_observed_snapshot.commander.integrity
    boss_spawn_tick: first_BOSS_SPAWNED_event.tick_or_null
    boss_defeat_tick: final_TERMINAL_event.tick when tuple_status == TERMINAL_RECORDED and final_TERMINAL_event.objectiveId == boss-kill else null
    boss_ttk_ticks: final_TERMINAL_event.bossTtkTicks when tuple_status == TERMINAL_RECORDED else null
    ordered_accepted_action_classes: INPUT_ACCEPTED.inputType_in_eventSequence_ascending_order
    input_receipt_rows:
      source: every_INPUT_ACCEPTED_or_INPUT_REJECTED_event
      order: eventSequence_ascending
      row_shape:
        tick: receipt.atTick
        event_trigger: queued_input.trigger_rule_id
        requested_action: queued_input.type
        accepted_action: receipt.inputType when receipt.type == INPUT_ACCEPTED else null
        rejection_reason: receipt.reason when receipt.type == INPUT_REJECTED else null
        position_or_target_directive: queued_input.directive_id_or_null
      join: receipt.inputId == queued_input.inputId
      missing_join: FAIL_INPUT_RECEIPT_UNMATCHED
    accepted_input_rows: input_receipt_rows
    growth_offer_id: GROWTH_OFFER.eventId_array_in_eventSequence_ascending_order
    growth_option_ids: GROWTH_OFFER.choices_array_aligned_to_growth_offer_id
    growth_accepted_selection_count:
      shape: integer_array_aligned_to_growth_offer_id
      value: count_of_INPUT_ACCEPTED_receipts_joined_to_GROWTH_SELECTION_for_that_GROWTH_OFFER_eventId
    run_item_opportunity_count: count_of_unique_observed_snapshot.pickups_id_where_pickup.kind == item
    run_item_scope: run
    run_item_campaign_write_count: 0
    elite_candidate_tick: first_ELITE_CANDIDATE_AVAILABLE_event.tick_or_null
    bind_requested_tick: first_input_receipt_for_BIND_REQUEST_or_BIND_READY_REQUEST.tick_or_null
    bind_terminal_outcome:
      when_no_ELITE_CANDIDATE_AVAILABLE: NOT_OFFERED
      when_ELITE_EXTRACTED: EXTRACTED
      when_OBJECTIVE_FAILED_with_objectiveId_extraction: EXPIRED
      when_candidate_exists_and_terminal_precedes_ELITE_EXTRACTED: "concat('INTERRUPTED_BY_', terminal_event.outcome, '_', terminal_event.objectiveId)"
      otherwise: null
    bind_terminal_event_id:
      ELITE_EXTRACTED: ELITE_EXTRACTED.eventId
      OBJECTIVE_FAILED_with_objectiveId_extraction: OBJECTIVE_FAILED.eventId
      terminal_precedes_ELITE_EXTRACTED: TERMINAL.eventId
      otherwise: null
    bind_terminal_tick:
      ELITE_EXTRACTED: ELITE_EXTRACTED.tick
      OBJECTIVE_FAILED_with_objectiveId_extraction: OBJECTIVE_FAILED.tick
      terminal_precedes_ELITE_EXTRACTED: TERMINAL.tick
      otherwise: null
    elite_extracted_tick: first_ELITE_EXTRACTED_event.tick_or_null
    accepted_extraction_handoff_count: count_of_INPUT_ACCEPTED_where_inputType_is_EXTRACT_ELITE
    companion_campaign_write_count: 0
    catalog_snapshot_hash_before: sha256(raw_UTF8_bytes_of_defense-catalog.js_before_tuple)
    catalog_snapshot_hash_after: sha256(raw_UTF8_bytes_of_defense-catalog.js_after_tuple)
    run_state_hash_before: sha256(getRunDigest_after_createDefenseRun_before_queueInput)
    run_state_hash_after: sha256(getRunDigest_at_terminal_or_fail_closed_stop)
    campaign_state_hash_before: null
    campaign_state_hash_after: null
    persistent_write_families: []
  replay:
    repetitions_per_tuple: 2
    equality_requirement: byte_stable_outcome_and_accepted_input_logs
    serialization: g2-canonical-json-sha256-v1
    serialization_functions: [canonicalStringify, sha256, checksumRecord]
    tape_hash:
      algorithm: sha256(canonicalStringify(payload))
      payload_shape: object
      payload_property_source:
        archetype_policies: contract.archetype_policies
        combo_ev: contract.combo_ev
        common_controls: contract.common_controls
        contract_id: contract.contract_id
        evidence_schema: contract.evidence_schema
        finite_population: contract.finite_population
        initial_options: contract.initial_options
        input_receipt_policy: contract.input_receipt_policy
        no_mutation_no_evidence_pass_boundary: contract.no_mutation_no_evidence_pass_boundary
        occupation_alias: contract.occupation_alias
        owner: contract.owner
        public_api_only: contract.public_api_only
        purpose: contract.purpose
        route_directives: contract.route_directives
        run_id: contract.run_id
        schema_version: contract.schema_version
        status: contract.status
        terminal_ceiling: contract.terminal_ceiling
      payload_exclusions: [source_evidence]
    duplicate_replay_hash:
      algorithm: sha256(canonicalStringify(payload))
      payload_shape:
        tuple_identity:
          rules_version: tuple.rules_version
          tape_id: tuple.tape_id
          tape_hash: tuple.tape_hash
          stage: tuple.stage
          seed: tuple.seed
          archetype: tuple.archetype
        terminal_and_balance:
          tuple_status: tuple.tuple_status
          steps_executed: tuple.steps_executed
          terminal_outcome: tuple.terminal_outcome
          terminal_cause: tuple.terminal_cause
          minimum_gate_integrity: tuple.minimum_gate_integrity
          minimum_warden_integrity: tuple.minimum_warden_integrity
          boss_spawn_tick: tuple.boss_spawn_tick
          boss_defeat_tick: tuple.boss_defeat_tick
          boss_ttk_ticks: tuple.boss_ttk_ticks
          ordered_accepted_action_classes: tuple.ordered_accepted_action_classes
          combo_ev_max_over_median: tuple.combo_ev_max_over_median
        accepted_input_rows: tuple.accepted_input_rows
        offer_and_item_boundary:
          growth_offer_id: tuple.growth_offer_id
          growth_option_ids: tuple.growth_option_ids
          growth_accepted_selection_count: tuple.growth_accepted_selection_count
          run_item_opportunity_count: tuple.run_item_opportunity_count
          run_item_scope: tuple.run_item_scope
          run_item_campaign_write_count: tuple.run_item_campaign_write_count
        extraction_boundary:
          elite_candidate_tick: tuple.elite_candidate_tick
          bind_requested_tick: tuple.bind_requested_tick
          bind_terminal_outcome: tuple.bind_terminal_outcome
          bind_terminal_event_id: tuple.bind_terminal_event_id
          bind_terminal_tick: tuple.bind_terminal_tick
          elite_extracted_tick: tuple.elite_extracted_tick
          accepted_extraction_handoff_count: tuple.accepted_extraction_handoff_count
          companion_campaign_write_count: tuple.companion_campaign_write_count
        state_boundaries:
          catalog_snapshot_hash_before: tuple.catalog_snapshot_hash_before
          catalog_snapshot_hash_after: tuple.catalog_snapshot_hash_after
          run_state_hash_before: tuple.run_state_hash_before
          run_state_hash_after: tuple.run_state_hash_after
          campaign_state_hash_before: tuple.campaign_state_hash_before
          campaign_state_hash_after: tuple.campaign_state_hash_after
          persistent_write_families: tuple.persistent_write_families
      input_row_order: eventSequence_ascending

terminal_ceiling:
  status: ENGINEERING_TERMINAL_SAFETY_CEILING
  per_tuple_steps: 20000
  source:
    path: scripts/run-g2-archetype-rotation.mjs#driveBattleToTerminal
    source_lines: [42, 43, 44, 45]
    observed_loop_guard: step < maxSteps and not_isTerminalRun
  purpose: technical_fail_closed_upper_bound_only
  timeout_predicate: steps_executed == 20000 and final_snapshot.terminal == null
  required_fail_closed_result:
    tuple_status: INVALID_TIMEOUT
    terminal_outcome: null
    terminal_cause: TIMEOUT_ENGINEERING_CEILING
    boss_defeat_tick: null
    boss_ttk_ticks: null
    g2_status: NOT_PASSED
    g3_status: NOT_PASSED
  prohibited_interpretations:
    - timeout_is_a_win
    - timeout_is_a_terminal_victory
    - timeout_is_valid_ttk
    - timeout_is_in_band_ttk
    - timeout_is_a_G2_PASS
    - timeout_is_a_G3_PASS
    - missing_terminal_is_a_pass

combo_ev:
  combo_ev_max_over_median: null
  status: UNBOUND_COMPARATOR
  reason: >-
    The existing M6 comparator is not bound to this 5 x 10 x 3 population.
    No combo-EV median, cap result, or G2 disposition may be fabricated.
  activation_requirement: separately_signed_finite_comparator_contract
  g2_status: UNRESOLVED

no_mutation_no_evidence_pass_boundary:
  mutations_forbidden:
    - campaign_state
    - campaign_storage
    - catalog_values
    - authored_stage_values
    - rewards_or_persistent_reward_effects
    - commerce
    - account_network_ads_subscription
    - assets_generated_art_renderer_audio
    - damage_waves_outcomes_or_direct_input_bypass
  evidence_pass_forbidden:
    - G2_PASS
    - G3_PASS
    - G4_PASS
    - G6_PASS
    - G7_PASS
    - G8_PASS
  allowed_output: >-
    An INCOMPLETE/NOT_PASSED measurement receipt, or a fail-closed tuple
    receipt, only. This contract creates neither a gate result nor a
    game-quality claim.
```
