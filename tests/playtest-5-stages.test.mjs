import assert from "node:assert/strict";
import {
  CAMPAIGN_SCHEDULES,
  initialEncounter,
  makeCommand,
  reduceEncounter,
  settleCampaign,
} from "../game-core.js";

console.log("=== Starting 5-Stage Campaign Playtest Simulation ===");

let encounterIndex = 0;
let sequence = 0;
let records = [];
let outcomes = [];
let settlement = null;

// Play through each of the 5 stages
for (let stage = 0; stage < CAMPAIGN_SCHEDULES.length; stage++) {
  console.log(`\n--- Starting Stage ${stage + 1} ---`);
  const schedule = CAMPAIGN_SCHEDULES[stage];
  let encounter = initialEncounter(schedule, stage);
  records = [];
  sequence = 0;
  
  console.log(`Initial State: Integrity=${encounter.integrity}/${encounter.max_integrity}, Focus=${encounter.focus}/${encounter.max_focus}, Foe Health=${encounter.foe_health}/${encounter.max_foe_health}, Foe Intent=${encounter.foe_intent}`);
  
  while (encounter.outcome === "ACTIVE") {
    // Stage 5 requires a readable risk trade: absorb the first SURGE, counter
    // the second, then finish before the final STRIKE resolves. Earlier stages
    // retain the baseline counterplay smoke policy.
    let command;
    if (stage === 4) {
      command = ["STRIKE", "DISRUPT", "STRIKE"][encounter.round];
    } else if (encounter.focus === 0) {
      command = "RECOVER";
    } else if (encounter.foe_intent === "SURGE") {
      command = "DISRUPT";
    } else if (encounter.guard < 2) {
      command = "BRACE";
    } else {
      command = "STRIKE";
    }
    
    const record = makeCommand(command, encounter.round, ++sequence);
    records.push(record);
    
    const result = reduceEncounter(encounter, record);
    assert.equal(result.accepted, true, `Command ${command} should be accepted at round ${encounter.round}`);
    
    encounter = result.state;
    const entry = encounter.trace.at(-1);
    
    console.log(`Round ${entry.round}: Command=${command} | Foe Resolved=${entry.foe_resolved} | Integrity=${encounter.integrity}, Focus=${encounter.focus}, Foe Health=${encounter.foe_health}, Foe Intent=${encounter.foe_intent} | Outcome=${encounter.outcome}`);
  }
  
  console.log(`Stage ${stage + 1} finished with outcome: ${encounter.outcome}`);
  assert.ok(["VICTORY", "HOLD"].includes(encounter.outcome), `Encounter must end in VICTORY or HOLD, got ${encounter.outcome}`);
  if (stage === 4) assert.equal(encounter.outcome, "VICTORY", "Stage 5 needs the deliberate victory line, not a passive HOLD");
  
  outcomes.push(encounter.outcome);
}

// Settle the campaign after all 5 stages
console.log("\n=== Campaign Finished. Settling outcomes ===");
console.log("Outcomes:", outcomes);

settlement = settleCampaign(outcomes);
console.log("Settlement:", settlement);

// Assert correct settlement results
assert.equal(typeof settlement.fragments_earned, "number");
assert.equal(typeof settlement.fragment_wallet, "number");
assert.equal(typeof settlement.resolve_marks, "number");
assert.ok(settlement.fragments_earned >= 0 && settlement.fragments_earned <= 10);

console.log("\n=== Playtest Simulation PASS: All 5 stages function and settle successfully ===");
