// Pre-change baseline capture for item-drop-timed-buff-spec.md §9 check 1.
// Mirrors tests/defense-run-simulation.test.mjs:265-275 (seed 71, cinder-span, 500 ticks).
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "/Users/jangyoung/orca/Abyssal-Surge-dungeon/defense-run-simulation.js";

function advanceWithOffers(run, steps) {
  let next = run;
  for (let tick = 0; tick < steps && !isTerminalRun(next); tick += 1) {
    const snapshot = getRunSnapshot(next);
    if (snapshot.growthOffer) next = queueInput(next, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
    next = advanceDefenseRun(next, 1);
  }
  return next;
}

const out = {};
for (const stageId of ["cinder-span", "abyss-chancel", "echo-throne"]) {
  for (const seed of [71, 4, 12]) {
    let run = createDefenseRun({ stageId, seed, companionLoadout: ["ember-cohort"] });
    for (const input of [["MOVE", { octant: "NW" }], ["MOVE", { octant: "SE" }]]) {
      run = queueInput(run, input[0], input[1]);
    }
    run = advanceWithOffers(run, 500);
    out[`${stageId}:${seed}`] = getRunDigest(run);
  }
}
// A longer horizon on the primary seed, so drops have real chances to roll post-change.
{
  let run = createDefenseRun({ stageId: "cinder-span", seed: 71, companionLoadout: ["ember-cohort"] });
  run = advanceWithOffers(run, 3000);
  out["cinder-span:71:3000"] = getRunDigest(run);
}
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
