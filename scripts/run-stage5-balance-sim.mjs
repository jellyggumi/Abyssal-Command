#!/usr/bin/env node
import {
  CAMPAIGN_SCHEDULES,
  COMMANDS,
  awardFor,
  commandCost,
  initialEncounter,
  makeCommand,
  reduceEncounter,
} from "../game-core.js";

const STAGE_INDEX = 4;
const STAGE_FIVE = CAMPAIGN_SCHEDULES[STAGE_INDEX];

function nearestRank(values, percentile) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.ceil((percentile / 100) * ordered.length) - 1];
}

function runPlan(schedule, stageIndex, plan) {
  let state = initialEncounter(schedule, stageIndex);
  const accepted = [];
  let rejection = null;

  for (const command of plan) {
    if (state.outcome !== "ACTIVE") break;
    const result = reduceEncounter(state, makeCommand(command, state.round, accepted.length + 1));
    if (!result.accepted) {
      rejection = result.reason;
      break;
    }
    accepted.push(command);
    state = result.state;
  }

  return {
    accepted,
    rejection,
    state,
    award: state.outcome === "ACTIVE" ? 0 : awardFor(state.outcome),
  };
}

function allPlans(length, prefix = []) {
  if (prefix.length === length) return [prefix];
  return COMMANDS.flatMap((command) => allPlans(length, [...prefix, command]));
}

function reactivePlan(schedule) {
  return schedule.map((intent) => (intent === "SURGE" ? "DISRUPT" : "BRACE"));
}

function counterCostCurve() {
  return CAMPAIGN_SCHEDULES.map((schedule, stageIndex) => {
    let state = initialEncounter(schedule, stageIndex);
    const costs = [];
    for (const command of reactivePlan(schedule)) {
      if (command === "DISRUPT") costs.push(commandCost(state, command));
      const result = reduceEncounter(state, makeCommand(command, state.round, state.round + 1));
      if (!result.accepted || result.state.outcome !== "ACTIVE") break;
      state = result.state;
    }
    return costs.length === 0 ? "-" : costs.join(",");
  });
}

const namedPlans = {
  disrupt_lock: ["DISRUPT", "DISRUPT", "BRACE"],
  reactive_two_button: reactivePlan(STAGE_FIVE),
  brace_only: ["BRACE", "BRACE"],
  strike_only: ["STRIKE", "STRIKE"],
  deliberate_trade: ["STRIKE", "DISRUPT", "STRIKE"],
};

const namedResults = Object.fromEntries(
  Object.entries(namedPlans).map(([name, plan]) => [name, runPlan(STAGE_FIVE, STAGE_INDEX, plan)]),
);
const exhaustive = allPlans(STAGE_FIVE.length).map((plan) => runPlan(STAGE_FIVE, STAGE_INDEX, plan));
const outcomes = Object.fromEntries(["VICTORY", "HOLD", "DEFEAT_INTEGRITY", "DEFEAT_PRESSURE", "ACTIVE"].map((outcome) => [outcome, 0]));
for (const result of exhaustive) outcomes[result.state.outcome] += 1;
const awards = exhaustive.map((result) => result.award);
const reactive = namedResults.reactive_two_button;
const dominantStrategyDetected = reactive.state.outcome === "VICTORY" && reactive.award > 0;

console.log("model=stage5-balance-sim-v1");
console.log(`rules_version=${initialEncounter(STAGE_FIVE, STAGE_INDEX).rules_version}`);
console.log(`stage5_schedule=${STAGE_FIVE.join(",")}`);
console.log(`counter_cost_curve=${counterCostCurve().map((curve, index) => `S${index + 1}:${curve}`).join(" ")}`);
for (const [name, result] of Object.entries(namedResults)) {
  const { state } = result;
  console.log(`${name}=plan:${result.accepted.join(",")}|outcome:${state.outcome}|award:${result.award}|integrity:${state.integrity}|pressure:${state.pressure}|focus:${state.focus}|foe:${state.foe_health}|rejection:${result.rejection || "none"}`);
}
console.log(`stage5_policy_space=plans:${exhaustive.length}|victory:${outcomes.VICTORY}|hold:${outcomes.HOLD}|defeat_integrity:${outcomes.DEFEAT_INTEGRITY}|defeat_pressure:${outcomes.DEFEAT_PRESSURE}|active_or_invalid:${outcomes.ACTIVE}`);
console.log(`stage5_progression=award_p50:${nearestRank(awards, 50)}|award_p90:${nearestRank(awards, 90)}|reactive_guarantees_victory:${dominantStrategyDetected}`);
